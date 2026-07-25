import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRuntimePackageInstaller } from "./runtime-package-installer.mjs";

test("Python installer uses an absolute interpreter, python -m pip, and domestic source first", async () => {
  const calls = [];
  const installer = createRuntimePackageInstaller({
    registry: { listTools: () => [
      { id: "python-3-14", kind: "python", version: "3.14.0", executable: "C:\\Python314\\python.exe", status: "healthy" },
      { id: "python-3-12", kind: "python", version: "3.12.12", executable: "C:\\Python312\\python.exe", status: "healthy" },
    ] },
    runProcess: async (command, args) => { calls.push({ command, args }); return { code: 0, stdout: "", stderr: "" }; },
    exists: () => true,
  });
  const result = await installer.install({
    requirement: { kind: "python", versionRange: ">=3.10,<3.14", packages: [{ name: "pdfplumber", version: "0.11.9", importName: "pdfplumber" }] },
    stagingRoot: "C:\\runtime\\staging\\pdf",
    packageSources: ["https://pypi.tuna.tsinghua.edu.cn/simple", "https://pypi.org/simple"],
    context: {},
  });
  assert.equal(calls[0].command, "C:\\Python312\\python.exe");
  assert.deepEqual(calls[0].args.slice(0, 2), ["-m", "venv"]);
  assert.ok(calls.some((call) => call.args.includes("pip") && call.args.includes("https://pypi.tuna.tsinghua.edu.cn/simple")));
  assert.equal(result.packageSource, "https://pypi.tuna.tsinghua.edu.cn/simple");
  assert.equal(result.bindings.VISIONOX_PYTHON.endsWith("Scripts\\python.exe"), true);
});

test("Node installer refuses to write without an npm executable outside the task directory", async () => {
  const installer = createRuntimePackageInstaller({ registry: { listTools: () => [{ id: "node-runtime", kind: "node", executable: "C:\\Visionox\\node.exe", status: "healthy" }] } });
  await assert.rejects(() => installer.install({ requirement: { kind: "node", packages: [{ name: "example", version: "1.0.0" }] }, stagingRoot: "C:\\runtime\\staging\\node", packageSources: ["https://registry.npmmirror.com"], context: {} }), /npm executable/i);
});

test("Node installer retries mirrors and records the selected registry", async () => {
  const calls = [];
  const installer = createRuntimePackageInstaller({
    registry: { listTools: () => [
      { id: "node-runtime", kind: "node", version: "22.0.0", executable: "C:\\Visionox\\node.exe", status: "healthy" },
      { id: "npm-system", kind: "npm", executable: "C:\\Program Files\\nodejs\\npm.cmd", status: "healthy" },
    ] },
    runProcess: async (command, args) => {
      calls.push({ command, args });
      return { code: calls.length === 1 ? 1 : 0, stderr: calls.length === 1 ? "mirror unavailable" : "" };
    },
    writeJson: async () => {},
    platform: "win32",
  });
  const result = await installer.install({
    requirement: { kind: "node", versionRange: ">=20", packages: [{ name: "pdfjs-dist", version: "5.4.296" }] },
    stagingRoot: "C:\\runtime\\staging\\node",
    packageSources: ["https://registry.npmmirror.com", "https://registry.npmjs.org"],
    context: {},
  });
  assert.equal(calls.length, 2);
  assert.equal(result.packageSource, "https://registry.npmjs.org");
  assert.equal(result.bindings.VISIONOX_NODE, "C:\\Visionox\\node.exe");
  assert.match(result.bindings.NODE_PATH, /node_modules$/u);
});

test("package installer exposes deterministic failures for invalid kinds and Python checks", async () => {
  const noPython = createRuntimePackageInstaller({ registry: { listTools: () => [] } });
  await assert.rejects(() => noPython.install({ requirement: { kind: "python" }, stagingRoot: "C:\\runtime\\python", packageSources: [] }), /Python interpreter/u);
  await assert.rejects(() => noPython.install({ requirement: { kind: "ruby" } }), /unsupported runtime installer kind/u);

  let calls = 0;
  const failing = createRuntimePackageInstaller({
    registry: { listTools: () => [{ kind: "python", version: "3.12.0", executable: "C:\\Python312\\python.exe", status: "healthy" }] },
    runProcess: async () => ({ code: calls++ === 0 ? 0 : 1, stderr: "import failed" }),
  });
  await assert.rejects(() => failing.install({
    requirement: { kind: "python", packages: [{ name: "pdfplumber" }] },
    stagingRoot: "C:\\runtime\\python",
    packageSources: ["https://pypi.tuna.tsinghua.edu.cn/simple"],
  }), /pip install failed|import/u);
});

test("Node installer rejects a lock integrity mismatch", async () => {
  const stagingRoot = await mkdtemp(join(tmpdir(), "visionox-node-integrity-"));
  const installer = createRuntimePackageInstaller({
    registry: { listTools: () => [
      { id: "node-runtime", kind: "node", version: "22.0.0", executable: "C:\\Visionox\\node.exe", status: "healthy" },
      { id: "npm-system", kind: "npm", executable: "C:\\node\\npm.cmd", status: "healthy" },
    ] },
    runProcess: async () => {
      await mkdir(join(stagingRoot, "node_modules", "example"), { recursive: true });
      await writeFile(join(stagingRoot, "package-lock.json"), JSON.stringify({ packages: { "node_modules/example": { integrity: "sha512-actual" } } }), "utf8");
      return { code: 0, stdout: "", stderr: "" };
    },
  });
  await assert.rejects(() => installer.install({
    requirement: { kind: "node", packages: [{ name: "example", version: "1.0.0", integrity: "sha512-expected" }] },
    stagingRoot,
    packageSources: ["https://registry.npmmirror.com"],
  }), /integrity mismatch/u);
});

test("managed package cache enables a later Node repair without a registry request", async () => {
  const cacheRoot = await mkdtemp(join(tmpdir(), "visionox-node-cache-"));
  const calls = [];
  const requirement = { kind: "node", packages: [{ name: "example", version: "1.0.0" }] };
  const installer = createRuntimePackageInstaller({
    registry: { listTools: () => [
      { id: "node-runtime", kind: "node", version: "22.0.0", executable: "C:\\Visionox\\node.exe", status: "healthy" },
      { id: "npm-system", kind: "npm", executable: "C:\\node\\npm.cmd", status: "healthy" },
    ] },
    runProcess: async (_command, args) => {
      calls.push(args);
      const prefix = args[args.indexOf("--prefix") + 1];
      await mkdir(prefix, { recursive: true });
      await mkdir(join(cacheRoot, "npm"), { recursive: true });
      await writeFile(join(cacheRoot, "npm", "_cache-entry"), "fixture", "utf8");
      await writeFile(join(prefix, "package-lock.json"), JSON.stringify({ packages: { "node_modules/example": { version: "1.0.0", integrity: "sha512-cache" } } }), "utf8");
      return { code: 0, stdout: "", stderr: "" };
    },
  });
  await installer.install({ requirement, stagingRoot: join(cacheRoot, "online"), packageSources: ["https://registry.npmmirror.com"], context: { packageCacheRoot: cacheRoot } });
  assert.equal(await installer.canUseCache(requirement, { packageCacheRoot: cacheRoot }), true);
  const repaired = await installer.install({ requirement, stagingRoot: join(cacheRoot, "offline"), packageSources: [], context: { packageCacheRoot: cacheRoot, offline: true } });
  assert.equal(repaired.packageSource, "local-cache");
  assert.ok(calls.at(-1).includes("--offline"));
  assert.equal(calls.at(-1).includes("--registry"), false);
});
