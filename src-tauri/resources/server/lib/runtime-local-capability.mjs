import { execFile as nodeExecFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";

const execFile = promisify(nodeExecFile);

function versionParts(value) {
  const match = String(value ?? "").match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/u);
  return match ? match.slice(1, 4).map((part) => Number(part || 0)) : null;
}

function compareVersions(a, b) {
  const left = versionParts(a);
  const right = versionParts(b);
  if (!left || !right) return 0;
  for (let index = 0; index < 3; index += 1) if (left[index] !== right[index]) return left[index] < right[index] ? -1 : 1;
  return 0;
}

function satisfies(version, range) {
  if (!range) return true;
  return String(range).split(",").every((clause) => {
    const match = clause.trim().match(/^(>=|<=|>|<|=)?\s*(\d+(?:\.\d+){0,2})$/u);
    if (!match) return true;
    const comparison = compareVersions(version, match[2]);
    return match[1] === ">" ? comparison > 0
      : match[1] === ">=" ? comparison >= 0
        : match[1] === "<" ? comparison < 0
          : match[1] === "<=" ? comparison <= 0
            : comparison === 0;
  });
}

async function defaultPythonProbe(tool, pkg, { signal } = {}) {
  const importName = pkg.importName || pkg.name.replaceAll("-", "_");
  try {
    if (!/^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/u.test(importName)) return false;
    const result = await execFile(tool.executable, ["-c", `from importlib import import_module, metadata; import_module(${JSON.stringify(importName)}); print(metadata.version(${JSON.stringify(pkg.name)}))`], { windowsHide: true, timeout: 5_000, signal });
    const version = String(result.stdout ?? "").trim();
    return !pkg.version || version === pkg.version;
  } catch { return false; }
}

function localEnvironmentId(requirement, toolId) {
  const digest = createHash("sha256").update(JSON.stringify({ requirement, toolId })).digest("hex").slice(0, 16);
  return `${requirement.kind}env_local_${digest}`;
}

export async function resolveLocalRuntimeCapability(requirement = {}, { registry, probePython = defaultPythonProbe, signal = null } = {}) {
  const tools = registry?.listTools?.() ?? [];
  const packages = Array.isArray(requirement.packages) ? requirement.packages : [];
  if (requirement.kind === "python") {
    const candidates = tools.filter((tool) => tool.kind === "python" && tool.status === "healthy" && tool.executable && satisfies(tool.version, requirement.versionRange)).sort((left, right) => compareVersions(right.version, left.version));
    for (const tool of candidates) {
      let healthy = true;
      for (const pkg of packages) {
        if (!await probePython(tool, pkg, { signal })) { healthy = false; break; }
      }
      if (!healthy) continue;
      return { id: localEnvironmentId(requirement, tool.id), kind: "python", baseToolId: tool.id, executable: tool.executable, root: tool.root ?? null, packages, status: "healthy", bindings: { VISIONOX_PYTHON: tool.executable } };
    }
    return null;
  }
  if (requirement.kind === "node") {
    const node = tools.find((tool) => tool.kind === "node" && tool.status === "healthy" && tool.executable && satisfies(tool.version, requirement.versionRange));
    if (!node) return null;
    const modules = packages.map((pkg) => tools.find((tool) => tool.kind === "node-module" && tool.status === "healthy" && tool.id === pkg.name && (!pkg.version || tool.version === pkg.version)));
    if (modules.some((item) => !item)) return null;
    const modulePaths = [...new Set(modules.map((item) => item.metadata?.moduleRoot).filter(Boolean))];
    return { id: localEnvironmentId(requirement, node.id), kind: "node", baseToolId: node.id, executable: node.executable, root: node.root ?? null, modulePaths, packages: modules.map((module, index) => ({ name: packages[index].name, version: module.version ?? packages[index].version ?? null })), status: "healthy", bindings: { VISIONOX_NODE: node.executable, ...(modulePaths.length > 0 ? { NODE_PATH: modulePaths.join(process.platform === "win32" ? ";" : ":") } : {}) } };
  }
  return null;
}
