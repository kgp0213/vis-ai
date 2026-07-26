import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { normalizeRuntimeCommand } from "./runtime-command.mjs";

const bindings = {
  VISIONOX_PYTHON: "C:\\Users\\Test User\\Python312\\python.exe",
  VISIONOX_NODE: "C:\\Users\\Test User\\Visionox\\node.exe",
  VISIONOX_NPM: "C:\\Users\\Test User\\Visionox\\npm.cmd",
};

test("normalizes a bare Python command without changing script arguments", () => {
  const result = normalizeRuntimeCommand("python scripts\\check.py --name \"a b\"", bindings);
  assert.equal(result.kind, "python");
  assert.equal(result.changed, true);
  assert.match(result.command, /^"C:\\Users\\Test User\\Python312\\python\.exe" scripts\\check\.py/iu);
  assert.match(result.command, /--name "a b"$/u);
});

test("replaces py version selectors with the selected absolute interpreter", () => {
  const result = normalizeRuntimeCommand("py -3.12 -m pip --version", bindings);
  assert.equal(result.removedSelector, true);
  assert.equal(result.command, '"C:\\Users\\Test User\\Python312\\python.exe" -m pip --version');
});

test("normalizes Node and npm when bindings are present", () => {
  assert.match(normalizeRuntimeCommand("node script.mjs", bindings).command, /node\.exe" script\.mjs$/u);
  assert.match(normalizeRuntimeCommand("npm --version", bindings).command, /npm\.cmd" --version$/u);
});

test("does not rewrite shell wrappers, script contents, or unbound runtimes", () => {
  assert.equal(normalizeRuntimeCommand("powershell -Command python script.py", bindings).changed, false);
  assert.equal(normalizeRuntimeCommand("echo python script.py", bindings).changed, false);
  assert.equal(normalizeRuntimeCommand("python script.py", {}).changed, false);
});

test("launcher resolves bound runtimes by operation id when no signal is available", () => {
  const launcherPath = fileURLToPath(new URL("../launcher.mjs", import.meta.url));
  const source = readFileSync(launcherPath, "utf8");
  assert.match(source, /operationForSignal\(context\?\.signal, context\?\.operationId\)/u);
  assert.match(source, /operationById\.get\(String\(operationId\)\)/u);
  assert.match(source, /normalizeCommand: \(command, context = \{\}\)/u);
});

test("launcher keeps late dashboard events in the originating operation scope", () => {
  const launcherPath = fileURLToPath(new URL("../launcher.mjs", import.meta.url));
  const source = readFileSync(launcherPath, "utf8");
  assert.match(source, /AsyncLocalStorage/u);
  assert.match(source, /dashboardEventContext\.run\(\{\s*operationId: operation\.id/u);
});

test("shell permission checks use the original command before runtime normalization", () => {
  const shellPath = fileURLToPath(new URL("../visionox-pkg/dist/cli/chunk-O52OLQL3.js", import.meta.url));
  const source = readFileSync(shellPath, "utf8");
  assert.match(source, /if \(!isAllowAll\(\) && !isCommandAllowed\(cmd, getExtraAllowed\(\), rootDir\)\)/u);
  assert.match(source, /const executionCommand = normalizeCommand\s*\?/u);
  assert.match(source, /runCommand\(executionCommand, \{/u);
  assert.match(source, /jobs\.start\(executionCommand, \{/u);
});

test("CLI shell executes a bound command after allowlist approval and keeps its environment", async () => {
  const { registerShellTools } = await import("../visionox-pkg/dist/cli/chunk-O52OLQL3.js");
  const definitions = new Map();
  registerShellTools({ register(definition) { definitions.set(definition.name, definition); } }, {
    rootDir: process.cwd(),
    extraAllowed: () => ["node"],
    getEnvironment: async () => ({ VISIONOX_TEST_BOUND: "bound-ok" }),
    normalizeCommand: () => `"${process.execPath}" -e "console.log(process.env.VISIONOX_TEST_BOUND || 'missing')"`,
  });
  const result = await definitions.get("run_command").fn({ command: "node --version" }, {});
  assert.match(String(result), /\[exit 0\]/u);
  assert.match(String(result), /bound-ok/u);
});
