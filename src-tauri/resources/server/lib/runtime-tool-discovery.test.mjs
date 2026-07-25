import test from "node:test";
import assert from "node:assert/strict";
import { discoverRuntimeTools } from "./runtime-tool-discovery.mjs";

test("discovery prefers packaged Node/PDF resources and finds Python from py -0p", async () => {
  const discovered = await discoverRuntimeTools({
    resourceRoot: "C:\\Program Files\\Visionox\\resources",
    userDataRoot: "C:\\Users\\test\\.visionox",
    platform: "win32",
    exists: (path) => [
      "C:\\Program Files\\Visionox\\resources\\server\\node.exe",
      "C:\\Program Files\\Visionox\\resources\\server\\visionox-pkg\\node_modules\\pdfjs-dist",
      "C:\\Users\\test\\AppData\\Local\\Programs\\Python\\Python312\\python.exe",
    ].includes(path),
    execFile: async (command) => command === "py"
      ? ({ stdout: " -V:3.12 * C:\\Users\\test\\AppData\\Local\\Programs\\Python\\Python312\\python.exe\r\n" })
      : ({ stdout: JSON.stringify({ version: "3.12.12", architecture: "AMD64", implementation: "CPython", executable: command, prefix: "C:\\Users\\test\\AppData\\Local\\Programs\\Python\\Python312", sitePackages: [] }) }),
    runtimeManifest: { artifacts: [{ path: "server/node.exe", version: "v25.2.1" }] },
    thirdPartyResources: { resources: [{ id: "pdfjs-dist", path: "server/visionox-pkg/node_modules/pdfjs-dist", version: "5.4.296" }] },
  });
  assert.equal(discovered[0].id, "node-runtime");
  assert.equal(discovered[0].source, "packaged-resource");
  assert.ok(discovered.some((tool) => tool.id.startsWith("python-cpython-3-12")));
  assert.equal(discovered.find((tool) => tool.id === "pdfjs-dist").source, "packaged-resource");
});

test("discovery ignores PATH-only aliases when they are not real executables", async () => {
  const discovered = await discoverRuntimeTools({
    resourceRoot: "C:\\resources",
    platform: "win32",
    exists: () => false,
    execFile: async () => ({ stdout: "" }),
    env: { PATH: "C:\\Windows\\System32" },
    runtimeManifest: { artifacts: [] },
    thirdPartyResources: { resources: [] },
  });
  assert.equal(discovered.some((tool) => tool.kind === "python"), false);
});

test("discovery honors configured executables and deterministic Windows registry/common paths", async () => {
  const configuredPython = "C:\\Custom\\Python312\\python.exe";
  const registryPython = "C:\\Users\\test\\AppData\\Local\\Programs\\Python\\Python311\\python.exe";
  const commonNode = "C:\\Program Files\\nodejs\\node.exe";
  const existing = new Set([configuredPython, registryPython, commonNode]);
  const discovered = await discoverRuntimeTools({
    resourceRoot: "C:\\resources",
    platform: "win32",
    configuredPaths: [configuredPython],
    env: { ProgramFiles: "C:\\Program Files", LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local", USERPROFILE: "C:\\Users\\test" },
    exists: (path) => existing.has(path),
    execFile: async (command, args) => {
      if (command === "reg.exe") return { stdout: `ExecutablePath    REG_SZ    ${registryPython}\r\n` };
      if (command === "py") return { stdout: "" };
      if (command === "where.exe" && args[0] === "node.exe") return { stdout: "" };
      if (command === "where.exe") return { stdout: "" };
      const version = command.includes("Python311") ? "3.11.9" : "3.12.12";
      return { stdout: JSON.stringify({ version, architecture: "AMD64", implementation: "CPython", executable: command, prefix: command.replace(/\\python\.exe$/iu, ""), sitePackages: [] }) };
    },
    runtimeManifest: { artifacts: [] },
    thirdPartyResources: { resources: [] },
  });
  assert.equal(discovered.filter((tool) => tool.kind === "python").length, 2);
  assert.ok(discovered.some((tool) => tool.source === "user-configured"));
  assert.ok(discovered.some((tool) => tool.source === "windows-registry"));
  assert.ok(discovered.some((tool) => tool.id === "node-common-install"));
});

test("an executable path that cannot complete a Python probe is not marked healthy", async () => {
  const executable = "C:\\Users\\test\\AppData\\Local\\Microsoft\\WindowsApps\\python.exe";
  const discovered = await discoverRuntimeTools({
    resourceRoot: "C:\\resources",
    platform: "win32",
    configuredPaths: [executable],
    exists: (path) => path === executable,
    execFile: async (command) => {
      if (command === executable) throw new Error("execution alias unavailable");
      return { stdout: "" };
    },
    runtimeManifest: { artifacts: [] },
    thirdPartyResources: { resources: [] },
  });
  assert.equal(discovered.some((tool) => tool.kind === "python"), false);
});
