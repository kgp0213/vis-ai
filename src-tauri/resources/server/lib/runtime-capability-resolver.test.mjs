import test from "node:test";
import assert from "node:assert/strict";
import { createRuntimeCapabilityResolver } from "./runtime-capability-resolver.mjs";

test("capability resolver binds reusable runtime paths without exposing absolute paths", async () => {
  const resolver = createRuntimeCapabilityResolver({
    registry: {
      open: async () => {},
      listTools: () => [{ id: "python-cpython-3.12", kind: "python", executable: "C:\\Python312\\python.exe", version: "3.12.12", status: "healthy" }],
      listEnvironments: () => [],
    },
    discovery: { discover: async () => [] },
    environments: { ensureCapability: async () => ({ environmentId: "pyenv-pdf", toolId: "python-cpython-3.12", status: "healthy", reused: true, bindings: { VISIONOX_PYTHON: "C:\\Python312\\python.exe" } }) },
  });
  const result = await resolver.ensureCapability({ id: "pdf-reader", kind: "python" }, { operationId: "op-3" });
  assert.equal(result.status, "healthy");
  assert.equal(result.bindings.VISIONOX_PYTHON, "C:\\Python312\\python.exe");
  assert.equal(resolver.publicResult(result).environmentId, "pyenv-pdf");
  assert.equal(resolver.publicResult(result).bindings, undefined);
});

test("capability resolver discovers, resolves, repairs and projects runtime facts", async () => {
  const tools = [{ id: "node-runtime", kind: "node", version: "22.0.0", status: "healthy" }];
  const environments = [{ id: "nodeenv-pdf", baseToolId: "node-runtime", kind: "node", status: "healthy", requirementsHash: "sha256:stale" }];
  let discoveryCalls = 0;
  const registry = {
    open: async () => {},
    listTools: () => tools,
    listEnvironments: () => environments,
    upsertTool: async (tool) => { tools.push(tool); return tool; },
    findEnvironment: ({ requirementsHash }) => environments.find((item) => item.requirementsHash === requirementsHash) ?? null,
    getEnvironment: (id) => environments.find((item) => item.id === id) ?? null,
    getTool: (id) => tools.find((item) => item.id === id) ?? null,
  };
  const resolver = createRuntimeCapabilityResolver({
    registry,
    discovery: { discover: async () => { discoveryCalls += 1; return [{ id: "python-3-12", kind: "python", status: "healthy" }]; } },
    environments: {
      ensureCapability: async () => ({ status: "healthy", id: "nodeenv-pdf", baseToolId: "node-runtime" }),
      repairCapability: async (environment) => ({ status: "healthy", environmentId: environment.id, repaired: true }),
    },
    now: () => "2026-07-25T00:00:00.000Z",
  });

  assert.equal((await resolver.discoverRuntime()).length, 1);
  assert.equal(discoveryCalls, 0);
  assert.ok((await resolver.discoverRuntime({ force: true })).some((item) => item.id === "python-3-12"));
  assert.equal(discoveryCalls, 1);

  const requirement = { id: "node-pdf", kind: "node" };
  const missing = await resolver.resolveCapability(requirement);
  assert.equal(missing.status, "missing");
  environments[0].requirementsHash = missing.requirementsHash;
  const reused = await resolver.resolveCapability(requirement);
  assert.equal(reused.reused, true);
  assert.equal((await resolver.repairCapability("nodeenv-pdf")).repaired, true);
  assert.equal((await resolver.repairCapability("unknown")).code, "RUNTIME_NOT_FOUND");

  const listed = resolver.listCapabilities();
  assert.equal(listed.tools[0].executable, undefined);
  assert.equal(listed.environments[0].environmentId, "nodeenv-pdf");
  assert.deepEqual(resolver.bindings(null), {});
  assert.equal(resolver.publicResult({ status: "blocked", code: "NO_RUNTIME", message: "missing" }).code, "NO_RUNTIME");
});

test("capability resolver refreshes a known tool and reports unavailable environment repair", async () => {
  const tool = { id: "python-3-12", kind: "python", status: "missing" };
  const resolver = createRuntimeCapabilityResolver({
    registry: {
      open: async () => {},
      listTools: () => [tool],
      listEnvironments: () => [],
      getTool: (id) => id === tool.id ? tool : null,
      getEnvironment: (id) => id === "env-broken" ? { id, kind: "python", status: "degraded" } : null,
      upsertTool: async () => tool,
    },
    discovery: { discover: async () => [tool] },
    environments: { ensureCapability: async () => ({ status: "missing" }) },
  });

  assert.equal((await resolver.repairCapability(tool.id)).id, tool.id);
  assert.equal((await resolver.repairCapability("env-broken")).code, "RUNTIME_REPAIR_UNAVAILABLE");
});

test("forced discovery marks stale executable records missing", async () => {
  const records = new Map([["python-old", { id: "python-old", kind: "python", source: "where.exe", status: "healthy" }]]);
  const registry = {
    open: async () => {},
    listTools: () => [...records.values()],
    listEnvironments: () => [],
    upsertTool: async (value) => { records.set(value.id, value); return value; },
  };
  const resolver = createRuntimeCapabilityResolver({ registry, discovery: { discover: async () => [] }, environments: { ensureCapability: async () => ({}) } });
  await resolver.discoverRuntime({ force: true });
  assert.equal(records.get("python-old").status, "missing");
});
