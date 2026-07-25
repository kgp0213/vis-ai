import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const MAX_PROCESS_OUTPUT_CHARS = 128_000;

function appendBounded(current, chunk) {
  const next = `${current}${String(chunk ?? "")}`;
  return next.length <= MAX_PROCESS_OUTPUT_CHARS ? next : next.slice(-MAX_PROCESS_OUTPUT_CHARS);
}

function defaultRunProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, windowsHide: true, shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout = appendBounded(stdout, chunk); });
    child.stderr?.on("data", (chunk) => { stderr = appendBounded(stderr, chunk); });
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code: Number.isInteger(code) ? code : 1, signal, stdout, stderr }));
  });
}

function isWindowsPath(path) {
  return /^[A-Za-z]:[\\/]/u.test(String(path ?? ""));
}

function packageSpec(pkg) {
  return pkg?.version ? `${pkg.name}==${pkg.version}` : pkg.name;
}

function nodePackageSpec(pkg) {
  return pkg?.version ? `${pkg.name}@${pkg.version}` : pkg.name;
}

function cacheKey(requirement = {}) {
  return createHash("sha256").update(JSON.stringify({
    kind: requirement.kind ?? null,
    packages: normalizePackages(requirement).map((pkg) => ({ name: pkg.name, version: pkg.version, integrity: pkg.integrity })),
    lockHash: requirement.lockHash ?? null,
  })).digest("hex");
}

function cacheManifestPath(packageCacheRoot, requirement) {
  return join(packageCacheRoot, "manifests", `${cacheKey(requirement)}.json`);
}

function normalizePackages(requirement) {
  return (Array.isArray(requirement?.packages) ? requirement.packages : []).filter((pkg) => pkg?.name).slice(0, 128);
}

function assertIntegrity(expected, actual, label) {
  const normalize = (value) => String(value ?? "").replace(/^sha256[=:]/iu, "sha256:");
  if (expected && (!actual || normalize(expected) !== normalize(actual))) throw new Error(`${label} integrity mismatch`);
}

function versionParts(value) {
  const match = String(value ?? "").match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/u);
  return match ? match.slice(1, 4).map((part) => Number(part || 0)) : null;
}

function versionSatisfies(value, range) {
  const actual = versionParts(value);
  if (!range || !actual) return !range;
  return String(range).split(",").every((clause) => {
    const match = clause.trim().match(/^(>=|<=|>|<|=)?\s*(\d+(?:\.\d+){0,2})$/u);
    if (!match) return true;
    const expected = versionParts(match[2]);
    let comparison = 0;
    for (let index = 0; index < 3; index += 1) if (actual[index] !== expected[index]) { comparison = actual[index] < expected[index] ? -1 : 1; break; }
    return match[1] === ">" ? comparison > 0 : match[1] === ">=" ? comparison >= 0 : match[1] === "<" ? comparison < 0 : match[1] === "<=" ? comparison <= 0 : comparison === 0;
  });
}

export function createRuntimePackageInstaller({ registry, runProcess = defaultRunProcess, writeJson = async (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8"), exists = () => true, platform = process.platform } = {}) {
  function listTools() { return registry?.listTools?.() ?? []; }
  function findTool(kind, predicate = () => true) { return listTools().find((tool) => tool.kind === kind && tool.status === "healthy" && predicate(tool)) ?? null; }

  async function canUseCache(requirement = {}, { packageCacheRoot = null } = {}) {
    if (!packageCacheRoot || normalizePackages(requirement).length === 0) return false;
    try {
      const manifest = JSON.parse(await readFile(cacheManifestPath(packageCacheRoot, requirement), "utf8"));
      if (manifest?.kind !== requirement.kind || manifest?.cacheKey !== cacheKey(requirement)) return false;
      const root = requirement.kind === "python"
        ? join(packageCacheRoot, "python-wheelhouse")
        : join(packageCacheRoot, "npm");
      if (!(await stat(root)).isDirectory()) return false;
      const entries = await readdir(root, { withFileTypes: true });
      return entries.some((entry) => entry.isFile() || entry.isDirectory());
    } catch {
      return false;
    }
  }

  async function writeCacheManifest(packageCacheRoot, requirement, packageSource) {
    if (!packageCacheRoot || normalizePackages(requirement).length === 0) return;
    try {
      const path = cacheManifestPath(packageCacheRoot, requirement);
      await mkdir(join(packageCacheRoot, "manifests"), { recursive: true });
      await writeJson(path, {
        schemaVersion: 1,
        cacheKey: cacheKey(requirement),
        kind: requirement.kind,
        packages: normalizePackages(requirement).map((pkg) => ({ name: pkg.name, version: pkg.version, integrity: pkg.integrity ?? null })),
        packageSource: packageSource ?? "local-cache",
        createdAt: new Date().toISOString(),
      });
    } catch {
      // Cache metadata is an optimization. A failed write must not fail a valid install.
    }
  }

  async function installPython({ requirement, stagingRoot, packageSources, context = {} }) {
    const tool = context.baseTool ?? findTool("python", (candidate) => (!requirement.toolId || candidate.id === requirement.toolId) && versionSatisfies(candidate.version, requirement.versionRange));
    if (!tool?.executable) throw new Error("a discovered Python interpreter is required");
    await mkdir(stagingRoot, { recursive: true });
    const win = platform === "win32" || isWindowsPath(stagingRoot);
    const venvResult = await runProcess(tool.executable, ["-m", "venv", stagingRoot], { env: context.env, signal: context.signal });
    if (venvResult?.code !== 0) throw new Error(`python -m venv failed: ${venvResult?.stderr || venvResult?.stdout || "unknown error"}`);
    const python = join(stagingRoot, win ? "Scripts" : "bin", win ? "python.exe" : "python");
    const packages = normalizePackages(requirement);
    const reportPath = join(stagingRoot, "pip-install-report.json");
    const packageCacheRoot = context.packageCacheRoot || null;
    const wheelhouse = packageCacheRoot ? join(packageCacheRoot, "python-wheelhouse") : null;
    const processEnvironment = {
      ...(context.env || process.env),
      ...(packageCacheRoot ? { PIP_CACHE_DIR: join(packageCacheRoot, "pip") } : {}),
    };
    let selectedSource = null;
    let lastFailure = null;
    if (packages.length > 0 && context.offline === true) {
      if (!wheelhouse) throw new Error("Python package cache is unavailable");
      const result = await runProcess(python, ["-m", "pip", "install", "--disable-pip-version-check", "--no-input", "--no-index", "--find-links", wheelhouse, "--report", reportPath, ...packages.map(packageSpec)], { env: processEnvironment, signal: context.signal });
      if (result?.code !== 0) throw new Error(result?.stderr || result?.stdout || "cached pip install failed");
      selectedSource = "local-cache";
    } else if (packages.length > 0 && wheelhouse) {
      await mkdir(wheelhouse, { recursive: true });
      for (const source of Array.isArray(packageSources) ? packageSources : []) {
        const result = await runProcess(python, ["-m", "pip", "download", "--disable-pip-version-check", "--no-input", "--dest", wheelhouse, "--index-url", source, ...packages.map(packageSpec)], { env: processEnvironment, signal: context.signal });
        if (result?.code === 0) { selectedSource = source; break; }
        lastFailure = result?.stderr || result?.stdout || "pip download failed";
      }
      if (selectedSource) {
        const result = await runProcess(python, ["-m", "pip", "install", "--disable-pip-version-check", "--no-input", "--no-index", "--find-links", wheelhouse, "--report", reportPath, ...packages.map(packageSpec)], { env: processEnvironment, signal: context.signal });
        if (result?.code !== 0) throw new Error(result?.stderr || result?.stdout || "cached pip install failed");
      }
      if (!selectedSource) throw new Error(lastFailure || "pip download failed for all configured sources");
    } else {
      for (const source of Array.isArray(packageSources) ? packageSources : []) {
        const result = await runProcess(python, ["-m", "pip", "install", "--disable-pip-version-check", "--no-input", "--report", reportPath, "--index-url", source, ...packages.map(packageSpec)], { env: processEnvironment, signal: context.signal });
        if (result?.code === 0) { selectedSource = source; break; }
        lastFailure = result?.stderr || result?.stdout || "pip install failed";
      }
      if (packages.length > 0 && !selectedSource) throw new Error(lastFailure || "pip install failed for all configured sources");
    }
    for (const pkg of packages) {
      const importName = pkg.importName || pkg.name.replaceAll("-", "_");
      const check = await runProcess(python, ["-c", `import ${importName}`], { env: processEnvironment, signal: context.signal });
      if (check?.code !== 0) throw new Error(`Python health check failed: import ${importName}`);
    }
    let report = null;
    try { report = JSON.parse(await readFile(reportPath, "utf8")); } catch {}
    const recordedPackages = packages.map((pkg) => {
      const installed = report?.install?.find((item) => String(item?.metadata?.name || "").toLowerCase() === String(pkg.name).toLowerCase());
      const actualIntegrity = installed?.download_info?.archive_info?.hash ?? null;
      assertIntegrity(pkg.integrity, actualIntegrity, `Python package ${pkg.name}`);
      return {
        ...pkg,
        version: installed?.metadata?.version ?? pkg.version ?? null,
        integrity: actualIntegrity ?? pkg.integrity ?? null,
      };
    });
    await writeCacheManifest(packageCacheRoot, requirement, selectedSource);
    return {
      stagingRoot,
      baseToolId: tool.id ?? null,
      executable: python,
      scriptsPath: join(stagingRoot, win ? "Scripts" : "bin"),
      packageSource: selectedSource,
      packages: recordedPackages,
      bindings: {
        VISIONOX_PYTHON: python,
        VIRTUAL_ENV: stagingRoot,
        PATH: `${join(stagingRoot, win ? "Scripts" : "bin")}${win ? ";" : ":"}${context.env?.PATH || process.env.PATH || ""}`,
      },
    };
  }

  async function installNode({ requirement, stagingRoot, packageSources, context = {} }) {
    const node = context.baseTool ?? findTool("node", (candidate) => versionSatisfies(candidate.version, requirement.versionRange));
    const npm = context.npmTool ?? findTool("npm");
    if (!node?.executable) throw new Error("a discovered Node interpreter is required");
    if (!npm?.executable) throw new Error("an npm executable is required for managed Node environments");
    await mkdir(stagingRoot, { recursive: true });
    await writeJson(join(stagingRoot, "package.json"), { private: true, version: "0.0.0", dependencies: Object.fromEntries(normalizePackages(requirement).map((pkg) => [pkg.name, pkg.version || "latest"])) });
    let selectedSource = null;
    let lastFailure = null;
    const packageArgs = normalizePackages(requirement).map(nodePackageSpec);
    const npmBaseArgs = ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--prefix", stagingRoot, ...(context.offline === true ? ["--offline"] : ["--prefer-offline"])];
    for (const source of context.offline === true ? [null] : (Array.isArray(packageSources) ? packageSources : [])) {
      const args = source ? [...npmBaseArgs, "--registry", source, ...packageArgs] : [...npmBaseArgs, ...packageArgs];
      const result = await runProcess(npm.executable, args, {
        env: {
          ...(context.env || process.env),
          ...(context.packageCacheRoot ? { npm_config_cache: join(context.packageCacheRoot, "npm") } : {}),
        },
        signal: context.signal,
      });
      if (result?.code === 0) { selectedSource = source || "local-cache"; break; }
      lastFailure = result?.stderr || result?.stdout || "npm install failed";
    }
    if (normalizePackages(requirement).length > 0 && !selectedSource) throw new Error(lastFailure || "npm install failed for all configured sources");
    let lock = null;
    try { lock = JSON.parse(await readFile(join(stagingRoot, "package-lock.json"), "utf8")); } catch {}
    if (requirement.lockHash) {
      if (!lock) throw new Error("Node package lock file is missing");
      const lockHash = `sha256:${createHash("sha256").update(await readFile(join(stagingRoot, "package-lock.json"))).digest("hex")}`;
      if (lockHash !== requirement.lockHash) throw new Error("Node package lock integrity mismatch");
    }
    const moduleRoot = join(stagingRoot, "node_modules");
    await writeCacheManifest(context.packageCacheRoot || null, requirement, selectedSource);
    return {
      stagingRoot,
      baseToolId: node.id ?? null,
      executable: node.executable,
      packageSource: selectedSource,
      packages: normalizePackages(requirement).map((pkg) => {
        const actualIntegrity = lock?.packages?.[`node_modules/${pkg.name}`]?.integrity ?? null;
        assertIntegrity(pkg.integrity, actualIntegrity, `Node package ${pkg.name}`);
        return { ...pkg, integrity: actualIntegrity ?? pkg.integrity ?? null };
      }),
      bindings: { VISIONOX_NODE: node.executable, NODE_PATH: moduleRoot, PATH: `${dirnameSafe(npm.executable)}${platform === "win32" || isWindowsPath(npm.executable) ? ";" : ":"}${context.env?.PATH || process.env.PATH || ""}` },
    };
  }

  function dirnameSafe(path) { return String(path).replace(/[\\/][^\\/]+$/u, ""); }

  async function install(input = {}) {
    if (input.requirement?.kind === "python") return installPython(input);
    if (input.requirement?.kind === "node") return installNode(input);
    throw new Error(`unsupported runtime installer kind: ${input.requirement?.kind}`);
  }

  return { install, canUseCache };
}
