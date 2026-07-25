import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createSkillRuntimeCoordinator, readSkillRuntimeRequirements } from "./runtime-requirements.mjs";

test("runtime requirements are read and validated beside SKILL.md", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-skill-runtime-"));
  await writeFile(join(root, "SKILL.md"), "# Example", "utf8");
  await writeFile(join(root, "runtime-requirements.json"), JSON.stringify({ schemaVersion: 1, requirements: [{ id: "pdf-reader", kind: "python", packages: [{ name: "pdfplumber", version: "0.11.9" }], healthChecks: ["import:pdfplumber"] }] }), "utf8");
  const manifest = await readSkillRuntimeRequirements(join(root, "SKILL.md"));
  assert.equal(manifest.requirements[0].id, "pdf-reader");
  assert.equal(manifest.requirements[0].packages[0].name, "pdfplumber");
});

test("skill coordinator binds healthy environments to the current operation before returning the Skill", async () => {
  const operation = { id: "op-skill", context: { runtimeBindings: {}, runtimeEnvironments: [] } };
  const coordinator = createSkillRuntimeCoordinator({
    skillStore: { read: () => ({ name: "pdf", path: "C:\\skills\\pdf\\SKILL.md" }) },
    readRequirements: async () => ({ schemaVersion: 1, requirements: [{ id: "pdf-reader", kind: "python" }] }),
    resolver: {
      ensureCapability: async () => ({ environmentId: "pyenv-pdf", toolId: "python-3-12", status: "healthy", reused: true, bindings: { VISIONOX_PYTHON: "C:\\runtime\\python.exe", VIRTUAL_ENV: "C:\\runtime" } }),
      publicResult: (result) => ({ environmentId: result.environmentId, toolId: result.toolId, status: result.status, reused: result.reused }),
      bindings: (result) => result.bindings,
    },
    getOperation: () => operation,
  });
  const result = await coordinator.prepare("pdf");
  assert.equal(result.ok, true);
  assert.equal(operation.context.runtimeBindings.VISIONOX_PYTHON, "C:\\runtime\\python.exe");
  assert.deepEqual(operation.context.runtimeEnvironments, [{ environmentId: "pyenv-pdf", toolId: "python-3-12", status: "healthy", reused: true }]);
});

test("runtime requirements report missing and invalid manifests without executing a Skill", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-skill-runtime-"));
  await writeFile(join(root, "SKILL.md"), "# Example", "utf8");
  assert.deepEqual((await readSkillRuntimeRequirements(join(root, "SKILL.md"))).requirements, []);
  await writeFile(join(root, "runtime-requirements.json"), JSON.stringify({ schemaVersion: 2, requirements: [] }), "utf8");
  await assert.rejects(() => readSkillRuntimeRequirements(join(root, "SKILL.md")), /schemaVersion/u);
  await writeFile(join(root, "runtime-requirements.json"), JSON.stringify({ schemaVersion: 1, requirements: [{ id: "Bad id", kind: "python" }] }), "utf8");
  await assert.rejects(() => readSkillRuntimeRequirements(join(root, "SKILL.md")), /id is invalid/u);
  await writeFile(join(root, "runtime-requirements.json"), JSON.stringify({ schemaVersion: 1, requirements: [{ id: "pdf", kind: "python", packages: [{ name: "safe", importName: "safe;__import__('os')" }] }] }), "utf8");
  await assert.rejects(() => readSkillRuntimeRequirements(join(root, "SKILL.md")), /invalid package or import name/u);
});

test("skill coordinator blocks unavailable runtimes and wrapper preserves that fact", async () => {
  const coordinator = createSkillRuntimeCoordinator({
    skillStore: { read: (name) => name === "pdf" ? { name, path: "C:\\skills\\pdf\\SKILL.md" } : null },
    readRequirements: async () => ({ schemaVersion: 1, requirements: [{ id: "pdf-reader", kind: "python" }] }),
    resolver: {
      ensureCapability: async () => ({ status: "approval_required", code: "RUNTIME_INSTALL_APPROVAL_REQUIRED", message: "approval needed" }),
      publicResult: (result) => result,
      bindings: () => ({}),
    },
  });
  assert.equal((await coordinator.prepare(" ")).status, "invalid");
  assert.equal((await coordinator.prepare("missing")).status, "missing");
  assert.equal((await coordinator.prepare("pdf")).status, "approval_required");
  assert.equal(coordinator.wrapSkillDefinition(null), null);

  let calls = 0;
  const definition = coordinator.wrapSkillDefinition({ name: "run_skill", fn: async () => { calls += 1; return "skill"; } });
  const result = JSON.parse(await definition.fn({ name: "pdf" }));
  assert.equal(result.error, "RUNTIME_CAPABILITY_UNAVAILABLE");
  assert.equal(calls, 0);
});

test("skill wrapper appends public runtime facts after successful preparation", async () => {
  const coordinator = createSkillRuntimeCoordinator({
    skillStore: { read: () => ({ name: "pdf", path: "C:\\skills\\pdf\\SKILL.md" }) },
    readRequirements: async () => ({ schemaVersion: 1, requirements: [{ id: "pdf-reader", kind: "python" }] }),
    resolver: {
      ensureCapability: async () => ({ environmentId: "pyenv-pdf", status: "healthy", reused: true }),
      publicResult: (result) => result,
      bindings: () => ({}),
    },
  });
  const definition = coordinator.wrapSkillDefinition({ fn: async () => "# PDF Skill", readOnly: true, parallelSafe: true });
  assert.equal(definition.readOnly, false);
  assert.equal(definition.parallelSafe, false);
  assert.match(await definition.fn({ name: "pdf" }), /runtime-capabilities/u);
});

test("optional runtime requirements never block a healthy required capability", async () => {
  const contexts = [];
  const coordinator = createSkillRuntimeCoordinator({
    skillStore: { read: () => ({ name: "pdf", path: "C:\\skills\\pdf\\SKILL.md" }) },
    readRequirements: async () => ({ schemaVersion: 1, requirements: [
      { id: "python-extra", kind: "python", optional: true },
      { id: "node-reader", kind: "node" },
    ] }),
    resolver: {
      ensureCapability: async (requirement, context) => {
        contexts.push(context);
        return requirement.optional ? { status: "unavailable" } : { environmentId: "node-reader", status: "healthy" };
      },
      publicResult: (result) => result,
      bindings: () => ({}),
    },
  });
  const prepared = await coordinator.prepare("pdf");
  assert.equal(prepared.ok, true);
  assert.equal(contexts[0].allowInstall, false);
});

test("failed required capability does not leave partial operation bindings", async () => {
  const operation = { id: "op-partial", context: { runtimeBindings: { VISIONOX_NODE: "C:\\node.exe" }, runtimeEnvironments: [{ environmentId: "existing", status: "healthy" }] } };
  const coordinator = createSkillRuntimeCoordinator({
    skillStore: { read: () => ({ name: "pdf", path: "C:\\skills\\pdf\\SKILL.md" }) },
    readRequirements: async () => ({ schemaVersion: 1, requirements: [
      { id: "node-reader", kind: "node" },
      { id: "missing-python", kind: "python" },
    ] }),
    resolver: {
      ensureCapability: async (requirement) => requirement.id === "node-reader"
        ? { environmentId: "node-env", status: "healthy", bindings: { NODE_PATH: "C:\\node-modules" } }
        : { status: "missing", code: "RUNTIME_MISSING" },
      publicResult: (result) => ({ environmentId: result.environmentId, status: result.status }),
      bindings: (result) => result.bindings || {},
    },
    getOperation: () => operation,
  });
  const result = await coordinator.prepare("pdf");
  assert.equal(result.ok, false);
  assert.deepEqual(operation.context.runtimeBindings, { VISIONOX_NODE: "C:\\node.exe" });
  assert.deepEqual(operation.context.runtimeEnvironments, [{ environmentId: "existing", status: "healthy" }]);
});
