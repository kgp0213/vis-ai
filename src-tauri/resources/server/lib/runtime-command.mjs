const COMMAND_HEAD_RE = /^(\s*)(python(?:\.exe)?|python3(?:\.exe)?|py(?:\.exe)?|node(?:\.exe)?|npm(?:\.cmd)?)(?=\s|$)(.*)$/iu;
const PYTHON_NAMES = new Set(["python", "python.exe", "python3", "python3.exe", "py", "py.exe"]);
const NODE_NAMES = new Set(["node", "node.exe"]);
const NPM_NAMES = new Set(["npm", "npm.cmd"]);

function quoteCommandToken(value) {
  return `"${String(value).replaceAll('"', '\\"')}"`;
}
function bindingFor(name, bindings = {}) {
  const normalized = String(name ?? "").toLowerCase();
  if (PYTHON_NAMES.has(normalized)) return { kind: "python", executable: bindings.VISIONOX_PYTHON };
  if (NODE_NAMES.has(normalized)) return { kind: "node", executable: bindings.VISIONOX_NODE };
  if (NPM_NAMES.has(normalized)) return { kind: "npm", executable: bindings.VISIONOX_NPM };
  return null;
}

function removePyVersionSelector(rest) {
  return String(rest ?? "").replace(/^\s+-\d+(?:\.\d+)*(?:-[A-Za-z0-9_-]+)?(?=\s|$)/u, "");
}

/**
 * Resolve only an explicit command-head runtime token. Shell syntax and script
 * contents remain untouched; callers can safely pass the returned command to
 * the existing native tokenizer.
 */
export function normalizeRuntimeCommand(command, bindings = {}) {
  const original = String(command ?? "");
  const match = original.match(COMMAND_HEAD_RE);
  if (!match) return { command: original, changed: false, kind: null, executable: null, removedSelector: false };
  const [, prefix, name, rawRest] = match;
  const binding = bindingFor(name, bindings);
  if (!binding?.executable) return { command: original, changed: false, kind: binding?.kind ?? null, executable: null, removedSelector: false };
  const rest = String(name).toLowerCase().startsWith("py") ? removePyVersionSelector(rawRest) : rawRest;
  const next = `${prefix}${quoteCommandToken(binding.executable)}${rest}`;
  return {
    command: next,
    changed: next !== original,
    kind: binding.kind,
    executable: binding.executable,
    removedSelector: rest !== rawRest,
  };
}
