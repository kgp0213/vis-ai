import test from "node:test";
import assert from "node:assert/strict";

import { createComplexTaskHostToolAccess } from "./complex-task-host-operations.mjs";
import { createHostToolBroker } from "./host-tool-broker.mjs";

function taskFixture() {
  return {
    id: "task:12345678-abcd-4abc-8abc-123456789012",
    lifecycle: "running",
    epoch: 2,
    lease: { leaseId: "lease-1", epoch: 2, owner: "worker-1", expiresAt: Date.now() + 60_000 },
    contract: {
      permissions: { readSources: true, writeOutput: false },
      sources: [{ sourceId: "source-1", uri: "D:/workspace/source.pdf", kind: "pdf", fingerprint: "sha256:source", required: true }],
      completion: { requiredCoverage: ["page-1", "page-2"] },
    },
    unitPlans: [
      { unitId: "unit-1", primaryCoverage: ["page-1"], dependencies: [], contextRefs: [] },
      { unitId: "unit-2", primaryCoverage: ["page-2"], dependencies: ["unit-1"], contextRefs: [{ sourceId: "source-1", range: "PDF page 1", role: "context-only" }] },
    ],
    unitResults: {
      "unit-1": { unitId: "unit-1", artifactRefs: ["artifact:unit-1@r1#aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"] },
    },
    metadata: {
      documentUnits: {
        "page-1": { id: "page-1", sourceId: "source-1", location: "PDF page 1", text: "Alpha" },
        "page-2": { id: "page-2", sourceId: "source-1", location: "PDF page 2", text: "Beta" },
      },
    },
  };
}

function context(overrides = {}) {
  return { taskId: taskFixture().id, unitId: "unit-2", leaseId: "lease-1", epochId: 2, ...overrides };
}

test("host access reads only source units authorized by the current UnitPlan", async () => {
  const task = taskFixture();
  const store = { async read() { return structuredClone(task); } };
  const access = createComplexTaskHostToolAccess({ store, artifactStore: { async read() { throw new Error("unused"); } } });
  const broker = createHostToolBroker({ operations: access.operations, authorize: access.authorize });

  const primary = await broker.invoke("read_source", { sourceId: "source-1", coverageId: "page-2" }, context());
  assert.equal(primary.text, "Beta");
  const dependencyContext = await broker.invoke("read_source", { sourceId: "source-1", coverageId: "page-1" }, context());
  assert.equal(dependencyContext.text, "Alpha");
  await assert.rejects(
    () => broker.invoke("read_source", { sourceId: "source-1", coverageId: "page-1" }, context({ unitId: "unit-1", leaseId: "wrong" })),
    (error) => error.code === "TOOL_NOT_AUTHORIZED",
  );
  await assert.rejects(() => broker.invoke("read_source", { sourceId: "source-1", coverageId: "page-99" }, context()), /not authorized/i);
});

test("host access reads only exact checkpointed artifacts owned by the same task", async () => {
  const task = taskFixture();
  const exactRef = task.unitResults["unit-1"].artifactRefs[0];
  const store = { async read() { return structuredClone(task); } };
  const artifactStore = {
    async read(ref) {
      assert.equal(ref, exactRef);
      return {
        manifest: { artifactId: "artifact:unit-1", revision: 1, sha256: "a".repeat(64), owner: { taskId: task.id, unitId: "unit-1", epoch: 1, attemptId: "a", kind: "unit" } },
        content: Buffer.from("checkpoint content"),
      };
    },
  };
  const access = createComplexTaskHostToolAccess({ store, artifactStore });
  const broker = createHostToolBroker({ operations: access.operations, authorize: access.authorize });
  const result = await broker.invoke("read_artifact", { artifactRef: exactRef }, context());
  assert.equal(result.text, "checkpoint content");
  await assert.rejects(() => broker.invoke("read_artifact", { artifactRef: "artifact:unit-1" }, context()), /exact artifactRef.*required/i);

  artifactStore.read = async () => ({
    manifest: { artifactId: "artifact:unit-1", revision: 1, sha256: "a".repeat(64), owner: { taskId: "task:87654321-abcd-4abc-8abc-123456789012", unitId: "unit-1", epoch: 1, kind: "unit" } },
    content: Buffer.from("foreign"),
  });
  await assert.rejects(() => broker.invoke("read_artifact", { artifactRef: exactRef }, context()), /does not belong/i);
});
