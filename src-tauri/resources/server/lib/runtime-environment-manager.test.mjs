import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRuntimeEnvironmentManager } from "./runtime-environment-manager.mjs";

test("healthy matching environment is reused without installation", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-runtime-env-"));
  let installations = 0;
  const registry = {
    findEnvironment: () => ({ id: "pyenv-pdf", status: "healthy", kind: "python", packages: [{ name: "pdfplumber", version: "0.11.9" }] }),
    upsertEnvironment: async (value) => value,
  };
  const manager = createRuntimeEnvironmentManager({ rootDir: root, registry, install: async () => { installations += 1; } });
  const result = await manager.ensureCapability({ id: "pdf-reader", kind: "python", packages: [{ name: "pdfplumber", version: "0.11.9" }] }, { operationId: "op-1" });
  assert.equal(result.reused, true);
  assert.equal(installations, 0);
  assert.equal(result.environmentId, "pyenv-pdf");
});

test("interrupted environments are never reused and network install requires one approval", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-runtime-env-"));
  const updates = [];
  const registry = {
    findEnvironment: () => ({ id: "pyenv-broken", status: "interrupted", kind: "python" }),
    upsertEnvironment: async (value) => { updates.push(value); return value; },
  };
  const manager = createRuntimeEnvironmentManager({ rootDir: root, registry, install: async () => ({ packages: [] }) });
  const blocked = await manager.ensureCapability({ id: "pdf-reader", kind: "python", packages: [{ name: "pdfplumber", version: "0.11.9" }] }, { operationId: "op-2" });
  assert.equal(blocked.status, "approval_required");
  assert.equal(updates.some((item) => item.status === "interrupted"), false);
});

test("optional capabilities do not request network authorization", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-runtime-env-"));
  let approvals = 0;
  const manager = createRuntimeEnvironmentManager({
    rootDir: root,
    registry: { findEnvironment: () => null, upsertEnvironment: async (value) => value },
    install: async () => ({}),
    authorizeNetwork: async () => { approvals += 1; return true; },
  });
  const result = await manager.ensureCapability({ id: "optional-python", kind: "python" }, { allowInstall: false });
  assert.equal(result.code, "RUNTIME_OPTIONAL_CAPABILITY_UNAVAILABLE");
  assert.equal(approvals, 0);
});

test("packaged or already installed local capability is promoted without network approval", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-runtime-env-"));
  let approvals = 0;
  const updates = [];
  const registry = {
    findEnvironment: () => null,
    upsertEnvironment: async (value) => { updates.push(value); return value; },
  };
  const manager = createRuntimeEnvironmentManager({
    rootDir: root,
    registry,
    resolveLocal: async () => ({ id: "nodeenv-packaged", kind: "node", baseToolId: "node-runtime", status: "healthy", bindings: { VISIONOX_NODE: "C:\\Visionox\\node.exe", NODE_PATH: "C:\\Visionox\\node_modules" }, packages: [{ name: "pdfjs-dist", version: "5.4.296" }] }),
    authorizeNetwork: async () => { approvals += 1; return true; },
  });
  const result = await manager.ensureCapability({ id: "pdf-node", kind: "node", packages: [{ name: "pdfjs-dist", version: "5.4.296" }] }, { operationId: "op-local" });
  assert.equal(result.status, "healthy");
  assert.equal(result.reused, true);
  assert.equal(approvals, 0);
  assert.equal(updates.at(-1).requirementsHash.startsWith("sha256:"), true);
});

test("approved installations are deduplicated, promoted atomically and rewrite staging bindings", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-runtime-env-"));
  const records = new Map();
  let installations = 0;
  const registry = {
    findEnvironment: ({ requirementsHash }) => [...records.values()].find((item) => item.requirementsHash === requirementsHash) ?? null,
    upsertEnvironment: async (value) => { records.set(value.id, value); return value; },
  };
  const manager = createRuntimeEnvironmentManager({
    rootDir: root,
    registry,
    authorizeNetwork: async () => true,
    install: async ({ stagingRoot, packageSources }) => {
      installations += 1;
      await mkdir(join(stagingRoot, "Scripts"), { recursive: true });
      await writeFile(join(stagingRoot, "Scripts", "python.exe"), "fixture", "utf8");
      return {
        stagingRoot,
        baseToolId: "python-3-12",
        executable: join(stagingRoot, "Scripts", "python.exe"),
        scriptsPath: join(stagingRoot, "Scripts"),
        modulePaths: [join(stagingRoot, "Lib", "site-packages")],
        bindings: { VISIONOX_PYTHON: join(stagingRoot, "Scripts", "python.exe"), VIRTUAL_ENV: stagingRoot },
        packageSource: packageSources[0],
        packages: [{ name: "pdfplumber", version: "0.11.9" }],
      };
    },
  });
  const requirement = { id: "pdf-reader", kind: "python", packages: [{ name: "pdfplumber", version: "0.11.9" }] };
  const [first, second] = await Promise.all([
    manager.ensureCapability(requirement, { operationId: "op-install" }),
    manager.ensureCapability(requirement, { operationId: "op-install" }),
  ]);

  assert.equal(installations, 1);
  assert.equal(first.installed, true);
  assert.deepEqual(first, second);
  assert.match(first.bindings.VISIONOX_PYTHON, /environments/u);
  assert.equal(first.packageSource, "pypi.tuna.tsinghua.edu.cn");
});

test("installation cancellation, unavailable installers and health failures stay non-healthy", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-runtime-env-"));
  const updates = [];
  const registry = {
    findEnvironment: () => null,
    upsertEnvironment: async (value) => { updates.push(value); return value; },
  };
  const unavailable = createRuntimeEnvironmentManager({ rootDir: root, registry, authorizeNetwork: async () => true });
  assert.equal((await unavailable.ensureCapability({ id: "pdf", kind: "python" }, { operationId: "op-none" })).code, "RUNTIME_INSTALLER_UNAVAILABLE");

  const aborted = createRuntimeEnvironmentManager({ rootDir: root, registry, install: async () => ({}) });
  assert.equal((await aborted.ensureCapability({ id: "pdf", kind: "python" }, { signal: AbortSignal.abort() })).code, "RUNTIME_INSTALL_CANCELLED");

  const unhealthy = createRuntimeEnvironmentManager({
    rootDir: root,
    registry,
    authorizeNetwork: async () => true,
    install: async ({ stagingRoot }) => ({ stagingRoot }),
    healthCheck: async () => false,
  });
  const failed = await unhealthy.ensureCapability({ id: "pdf-bad", kind: "python" }, { operationId: "op-bad" });
  assert.equal(failed.code, "RUNTIME_INSTALL_INTERRUPTED");
  assert.equal(updates.at(-1).status, "interrupted");
});

test("repair uses recorded requirements and blocks records that cannot be reconstructed", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-runtime-env-"));
  const environment = { id: "pyenv-pdf", kind: "python", status: "broken", metadata: { requirement: { id: "pdf", kind: "python" } } };
  let current = environment;
  const registry = {
    findEnvironment: () => current,
    upsertEnvironment: async (value) => { current = value; return value; },
  };
  const manager = createRuntimeEnvironmentManager({
    rootDir: root,
    registry,
    healthCheck: async () => true,
    repair: async (value) => ({ ...value, status: "healthy", bindings: {} }),
  });
  assert.equal((await manager.repairCapability({ id: "unknown", metadata: {} })).code, "RUNTIME_REQUIREMENTS_UNKNOWN");
  const repaired = await manager.repairCapability(environment);
  assert.equal(repaired.repaired, true);
  assert.equal(current.status, "healthy");
});

test("local package cache repairs an environment without requesting network approval", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-runtime-cache-repair-"));
  const records = new Map();
  let approvals = 0;
  let offline = false;
  const registry = {
    findEnvironment: ({ requirementsHash }) => [...records.values()].find((item) => item.requirementsHash === requirementsHash) ?? null,
    upsertEnvironment: async (value) => { records.set(value.id, value); return value; },
  };
  const manager = createRuntimeEnvironmentManager({
    rootDir: root,
    registry,
    cacheProbe: async () => true,
    authorizeNetwork: async () => { approvals += 1; return false; },
    install: async ({ stagingRoot, context }) => {
      offline = context.offline;
      await mkdir(join(stagingRoot, "Scripts"), { recursive: true });
      await writeFile(join(stagingRoot, "Scripts", "python.exe"), "fixture", "utf8");
      return { stagingRoot, executable: join(stagingRoot, "Scripts", "python.exe"), bindings: { VISIONOX_PYTHON: join(stagingRoot, "Scripts", "python.exe") }, packageSource: "local-cache", packages: [{ name: "example", version: "1.0.0" }] };
    },
  });
  const result = await manager.ensureCapability({ id: "cached", kind: "python", packages: [{ name: "example", version: "1.0.0" }] }, { operationId: "op-cache" });
  assert.equal(result.status, "healthy");
  assert.equal(result.packageSource, "local-cache");
  assert.equal(offline, true);
  assert.equal(approvals, 0);
});

test("failed local cache repair requests one network approval before mirror fallback", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-runtime-cache-fallback-"));
  const records = new Map();
  const attempts = [];
  let approvals = 0;
  const manager = createRuntimeEnvironmentManager({
    rootDir: root,
    registry: {
      findEnvironment: ({ requirementsHash }) => [...records.values()].find((item) => item.requirementsHash === requirementsHash) ?? null,
      upsertEnvironment: async (value) => { records.set(value.id, value); return value; },
    },
    cacheProbe: async () => true,
    authorizeNetwork: async () => { approvals += 1; return true; },
    install: async ({ stagingRoot, packageSources, context }) => {
      attempts.push(context.offline);
      if (context.offline) throw new Error("cache incomplete");
      await mkdir(join(stagingRoot, "Scripts"), { recursive: true });
      await writeFile(join(stagingRoot, "Scripts", "python.exe"), "fixture", "utf8");
      return { stagingRoot, executable: join(stagingRoot, "Scripts", "python.exe"), bindings: { VISIONOX_PYTHON: join(stagingRoot, "Scripts", "python.exe") }, packageSource: packageSources[0], packages: [] };
    },
  });
  const result = await manager.ensureCapability({ id: "fallback", kind: "python" }, { operationId: "op-fallback" });
  assert.equal(result.status, "healthy");
  assert.deepEqual(attempts, [true, false]);
  assert.equal(approvals, 1);
  assert.equal(result.packageSource, "pypi.tuna.tsinghua.edu.cn");
});
