import { execFile as nodeExecFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { join as posixJoin, win32 as win32Path } from "node:path";

const execFileAsync = promisify(nodeExecFile);

function pathJoin(platform, ...parts) {
  return platform === "win32" ? win32Path.join(...parts) : posixJoin(...parts);
}

function isAbsolutePath(value, platform) {
  return platform === "win32" ? win32Path.isAbsolute(value) : value.startsWith("/");
}

function safeExists(exists, path) {
  try { return Boolean(exists(path)); } catch { return false; }
}

function versionFromPythonPath(path) {
  const match = String(path).match(/Python(\d+)(\d+)/i);
  return match ? `${match[1]}.${match[2]}` : null;
}

function pythonToolId(path, version) {
  const normalized = String(version || versionFromPythonPath(path) || "unknown").replace(/[^0-9.]/g, "").replace(/\.+$/u, "") || "unknown";
  return `python-cpython-${normalized.replaceAll(".", "-")}-win64`;
}

async function commandOutput(execFile, command, args = []) {
  try {
    const result = await execFile(command, args, { windowsHide: true, timeout: 3_000, encoding: "utf8" });
    return String(result?.stdout ?? result ?? "");
  } catch (error) {
    return String(error?.stdout ?? "");
  }
}

async function probePythonDetails(execFile, executable, fallbackVersion) {
  const script = "import json,platform,site,sys; print(json.dumps({'version':platform.python_version(),'architecture':platform.machine(),'implementation':platform.python_implementation(),'executable':sys.executable,'prefix':sys.prefix,'sitePackages':site.getsitepackages() if hasattr(site,'getsitepackages') else []}))";
  let details = null;
  try {
    const result = await execFile(executable, ["-c", script], { windowsHide: true, timeout: 3_000, encoding: "utf8" });
    const output = String(result?.stdout ?? result ?? "");
    details = JSON.parse(output.trim().split(/\r?\n/u).at(-1));
  } catch { return null; }
  if (!details || typeof details !== "object" || !String(details.executable || executable).trim()) return null;
  const version = String(details?.version || fallbackVersion || "").trim() || null;
  const architecture = String(details?.architecture || "").trim() || null;
  return {
    version,
    architecture,
    executable: String(details?.executable || executable),
    root: String(details?.prefix || executable.replace(/[\\/]python(?:\.exe)?$/iu, "")),
    metadata: {
      implementation: details?.implementation || "CPython",
      sysExecutable: details?.executable || executable,
      sysPrefix: details?.prefix || null,
      sitePackages: Array.isArray(details?.sitePackages) ? details.sitePackages.slice(0, 8) : [],
    },
    fingerprint: `sha256:${createHash("sha256").update(JSON.stringify({ executable: details?.executable || executable, version, architecture, implementation: details?.implementation || "CPython" })).digest("hex")}`,
  };
}

function parsePyInstallations(output) {
  const paths = [];
  for (const line of String(output ?? "").split(/\r?\n/u)) {
    const version = line.match(/(?:-V:)?(\d+\.\d+)/i)?.[1];
    const executable = line.match(/([A-Za-z]:[\\/].*[\\/]python(?:\.exe)?)\s*$/i)?.[1]
      ?? line.match(/(\/.*\/python(?:\d+(?:\.\d+)?)?)\s*$/i)?.[1];
    if (!version || !executable) continue;
    paths.push({ path: executable.trim(), version });
  }
  return paths;
}

function parseRegistryPythonPaths(output) {
  const paths = [];
  for (const line of String(output ?? "").split(/\r?\n/u)) {
    const match = line.match(/(?:ExecutablePath|InstallPath)\s+REG_SZ\s+(.+?)\s*$/iu);
    if (!match) continue;
    const value = match[1].trim();
    const executable = /python(?:\.exe)?$/iu.test(value) ? value : pathJoin("win32", value, "python.exe");
    if (isAbsolutePath(executable, "win32")) paths.push(executable);
  }
  return paths;
}

function windowsCommonCandidates(env = {}) {
  const localAppData = String(env.LOCALAPPDATA || "").trim();
  const appData = String(env.APPDATA || "").trim();
  const programFiles = String(env.ProgramFiles || "").trim();
  const userProfile = String(env.USERPROFILE || "").trim();
  const candidates = [];
  for (const version of ["310", "311", "312", "313", "314"]) {
    if (localAppData) candidates.push(pathJoin("win32", localAppData, "Programs", "Python", `Python${version}`, "python.exe"));
  }
  if (programFiles) candidates.push(pathJoin("win32", programFiles, "nodejs", "node.exe"));
  if (localAppData) candidates.push(pathJoin("win32", localAppData, "Programs", "nodejs", "node.exe"));
  if (userProfile) candidates.push(pathJoin("win32", userProfile, "scoop", "apps", "nodejs", "current", "node.exe"));
  if (appData) candidates.push(pathJoin("win32", appData, "npm", "npm.cmd"));
  return candidates;
}

export async function discoverRuntimeTools({
  resourceRoot,
  userDataRoot = null,
  platform = process.platform,
  exists = existsSync,
  execFile = execFileAsync,
  configuredPaths = [],
  env = process.env,
  runtimeManifest = { artifacts: [] },
  thirdPartyResources = { resources: [] },
} = {}) {
  const result = [];
  const add = (record) => {
    if (!record?.id || result.some((item) => item.id === record.id)) return;
    result.push({
      architecture: platform === "win32" ? "win64" : process.arch,
      status: "healthy",
      lastVerifiedAt: new Date().toISOString(),
      ...record,
    });
  };
  const resource = (relative) => pathJoin(platform, resourceRoot || "", relative);
  const packagedNode = resource("server/node.exe");
  if (safeExists(exists, packagedNode)) add({ id: "node-runtime", kind: "node", executable: packagedNode, root: pathJoin(platform, resourceRoot || "", "server"), version: runtimeManifest.artifacts?.find((item) => item.path === "server/node.exe")?.version ?? null, source: "packaged-resource" });

  for (const item of Array.isArray(runtimeManifest.artifacts) ? runtimeManifest.artifacts : []) {
    const relative = String(item.path ?? "");
    const id = relative.toLowerCase().endsWith("officecli.exe") ? "officecli" : relative.toLowerCase().endsWith("dws.exe") ? "dws" : null;
    const kind = id === "officecli" ? "officecli" : id === "dws" ? "dws" : null;
    if (!id || !kind) continue;
    const executable = resource(relative);
    if (safeExists(exists, executable)) add({ id, kind, executable, root: pathJoin(platform, resourceRoot || "", "server"), version: item.version ?? null, source: "packaged-resource" });
  }

  for (const item of Array.isArray(thirdPartyResources.resources) ? thirdPartyResources.resources : []) {
    if (!["pdfjs-dist", "napi-rs-canvas", "@napi-rs/canvas"].includes(item.id)) continue;
    const root = resource(item.path);
    if (safeExists(exists, root)) add({ id: item.id === "napi-rs-canvas" ? "@napi-rs/canvas" : item.id, kind: "node-module", root, version: item.version ?? null, source: "packaged-resource", metadata: { packagePath: root, moduleRoot: resource("server/visionox-pkg/node_modules") } });
  }

  for (const configured of Array.isArray(configuredPaths) ? configuredPaths : []) {
    const path = String(configured ?? "").trim();
    if (!path || !isAbsolutePath(path, platform) || !safeExists(exists, path)) continue;
    const lower = path.toLowerCase();
    if (lower.endsWith("python.exe") || lower.endsWith("python")) {
      const details = await probePythonDetails(execFile, path, versionFromPythonPath(path));
      if (!details) continue;
      add({ id: pythonToolId(details.executable, details.version), kind: "python", executable: details.executable, root: details.root, source: "user-configured", version: details.version, architecture: details.architecture, fingerprint: details.fingerprint, metadata: details.metadata });
    }
    else if (lower.endsWith("node.exe") || lower.endsWith("node")) add({ id: "node-user-configured", kind: "node", executable: path, root: path.replace(/[\\/]node(?:\.exe)?$/iu, ""), source: "user-configured" });
  }

  if (platform === "win32") {
    const registryOutput = await commandOutput(execFile, "reg.exe", ["query", "HKCU\\Software\\Python\\PythonCore", "/s"]);
    for (const executable of parseRegistryPythonPaths(registryOutput)) {
      if (!safeExists(exists, executable)) continue;
      const details = await probePythonDetails(execFile, executable, versionFromPythonPath(executable));
      if (!details) continue;
      add({ id: pythonToolId(details.executable, details.version), kind: "python", executable: details.executable, root: details.root, source: "windows-registry", version: details.version, architecture: details.architecture, fingerprint: details.fingerprint, metadata: details.metadata });
    }
    const output = await commandOutput(execFile, "py", ["-0p"]);
    for (const installation of parsePyInstallations(output)) {
      if (!safeExists(exists, installation.path) && installation.path) continue;
      const details = await probePythonDetails(execFile, installation.path, installation.version);
      if (!details) continue;
      add({ id: pythonToolId(details.executable, details.version), kind: "python", executable: details.executable, root: details.root, source: "pep514-py-launcher", version: details.version, architecture: details.architecture, fingerprint: details.fingerprint, metadata: details.metadata });
    }
    const commandCandidates = [
      ["where.exe", ["python.exe"], "python"],
      ["where.exe", ["node.exe"], "node"],
      ["where.exe", ["npm.cmd"], "npm"],
    ];
    for (const [command, args, kind] of commandCandidates) {
      const output = await commandOutput(execFile, command, args);
      for (const line of output.split(/\r?\n/u)) {
        const executable = line.trim();
        if (!/^[A-Za-z]:[\\/].+/u.test(executable) || !safeExists(exists, executable)) continue;
        if (kind === "python") {
          const details = await probePythonDetails(execFile, executable, versionFromPythonPath(executable));
          if (!details) continue;
          add({ id: pythonToolId(details.executable, details.version), kind: "python", executable: details.executable, root: details.root, source: "where.exe", version: details.version, architecture: details.architecture, fingerprint: details.fingerprint, metadata: details.metadata });
        } else if (kind === "node") {
          add({ id: "node-system", kind: "node", executable, root: executable.replace(/[\\/]node(?:\.exe)?$/iu, ""), source: "where.exe" });
        } else {
          add({ id: "npm-system", kind: "npm", executable, root: executable.replace(/[\\/]npm(?:\.cmd)?$/iu, ""), source: "where.exe" });
        }
        break;
      }
    }
    for (const candidate of windowsCommonCandidates(env)) {
      if (!safeExists(exists, candidate)) continue;
      const lower = candidate.toLowerCase();
      if (lower.endsWith("python.exe")) {
        const details = await probePythonDetails(execFile, candidate, versionFromPythonPath(candidate));
        if (!details) continue;
        add({ id: pythonToolId(details.executable, details.version), kind: "python", executable: details.executable, root: details.root, source: "common-user-install", version: details.version, architecture: details.architecture, fingerprint: details.fingerprint, metadata: details.metadata });
      } else if (lower.endsWith("node.exe")) {
        add({ id: "node-common-install", kind: "node", executable: candidate, root: candidate.replace(/[\\/]node(?:\.exe)?$/iu, ""), source: "common-user-install" });
      } else if (lower.endsWith("npm.cmd")) {
        add({ id: "npm-common-install", kind: "npm", executable: candidate, root: candidate.replace(/[\\/]npm(?:\.cmd)?$/iu, ""), source: "common-user-install" });
      }
    }
  }

  // The discovery boundary intentionally does not recurse through HOME or task output.
  // A configured PATH is only used for explicit command probes, never as a source of
  // persistent records because WindowsApps aliases are frequently non-executables.
  void userDataRoot;
  void env;
  return result;
}
