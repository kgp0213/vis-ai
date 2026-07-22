import test from "node:test";
import assert from "node:assert/strict";

import {
  assertWorkPlan,
  createWorkPlan,
  getRunnableWorkNodes,
  replanWorkPlan,
  validateWorkPlan,
} from "./complex-task-plan.mjs";

const PLAN_ID = "plan:document-demo";

function node(nodeId, overrides = {}) {
  return {
    nodeId,
    goal: `完成 ${nodeId}`,
    acceptanceCriteria: [`${nodeId} 的产物存在且可验证`],
    permissions: { readSources: ["source-1"], writeArtifacts: [nodeId] },
    requiredCapabilities: ["text"],
    dependencies: [],
    termination: { maxAttempts: 2, wallClockMs: 10_000, stallTimeoutMs: 2_000 },
    primaryCoverage: [nodeId],
    status: "pending",
    ...overrides,
  };
}

function plan(overrides = {}) {
  return {
    schemaVersion: 1,
    planId: PLAN_ID,
    planRevision: 1,
    goal: "完成示例任务",
    requiredCoverage: ["prepare", "write"],
    permissions: { readSources: ["source-1"], writeArtifacts: ["prepare", "write"] },
    termination: { maxReplans: 2 },
    nodes: [
      node("prepare"),
      node("write", { dependencies: ["prepare"] }),
    ],
    ...overrides,
  };
}

test("validates a structured work graph and produces a deterministic revision", () => {
  const first = assertWorkPlan(plan());
  const second = assertWorkPlan(plan());
  assert.equal(first.planRevision, 1);
  assert.equal(first.revisionId, second.revisionId);
  assert.deepEqual(first.topologicalOrder, ["prepare", "write"]);
  assert.equal(first.nodes[0].acceptanceCriteria.length, 1);
  const runtimeOnlyChange = assertWorkPlan(plan({ nodes: [node("prepare", { status: "completed" }), node("write", { dependencies: ["prepare"] })] }));
  assert.equal(runtimeOnlyChange.revisionId, first.revisionId);
});

test("rejects missing goal, acceptance, permissions, capabilities, and bounded termination", () => {
  const invalid = plan({
    nodes: [node("broken", {
      goal: "",
      acceptanceCriteria: [],
      permissions: null,
      requiredCapabilities: "text",
      termination: { maxAttempts: 0, wallClockMs: -1, stallTimeoutMs: "later" },
    })],
    requiredCoverage: ["broken"],
  });
  const result = validateWorkPlan(invalid);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /goal is required/);
  assert.match(result.errors.join("\n"), /acceptanceCriteria/);
  assert.match(result.errors.join("\n"), /permissions/);
  assert.match(result.errors.join("\n"), /requiredCapabilities/);
  assert.match(result.errors.join("\n"), /termination/);
});

test("rejects unknown dependencies, duplicate coverage owners, and dependency cycles", () => {
  const result = validateWorkPlan(plan({
    nodes: [
      node("a", { dependencies: ["missing", "b"], primaryCoverage: ["prepare"] }),
      node("b", { dependencies: ["a"], primaryCoverage: ["prepare"] }),
    ],
  }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /unknown dependency/);
  assert.match(result.errors.join("\n"), /coverage.*one owner|coverage.*unique/i);
  assert.match(result.errors.join("\n"), /cycle/i);
});

test("rejects node permissions that exceed the host permission boundary", () => {
  const result = validateWorkPlan(plan({
    permissions: { readSources: ["source-1"], writeArtifacts: ["prepare"] },
    nodes: [node("prepare", { permissions: { readSources: ["source-2"], writeArtifacts: ["prepare"] } })],
    requiredCoverage: ["prepare"],
  }), {
    permissionBoundary: { readSources: ["source-1"], writeArtifacts: ["prepare"] },
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /permission.*readSources|outside.*permission/i);
});

test("returns only dependency-ready nodes and never exposes completed nodes as runnable", () => {
  const current = assertWorkPlan(plan({
    nodes: [
      node("prepare", { status: "completed" }),
      node("write", { dependencies: ["prepare"], status: "pending" }),
    ],
  }));
  assert.deepEqual(getRunnableWorkNodes(current).map((item) => item.nodeId), ["write"]);
});

test("bounded replan replaces unfinished nodes, preserves completed nodes and results, and increments revision", () => {
  const current = assertWorkPlan(plan({
    nodes: [
      node("prepare", { status: "completed" }),
      node("write", { dependencies: ["prepare"], status: "failed" }),
    ],
    nodeResults: {
      prepare: { artifactRefs: ["artifact:prepare"], status: "completed" },
      write: { diagnostic: "timeout", status: "failed" },
    },
  }));
  const result = replanWorkPlan(current, {
    nodes: [node("write", { dependencies: ["prepare"], goal: "重新完成写入" })],
    reason: "bounded retry after timeout",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.planRevision, 2);
  assert.equal(result.value.parentRevision, current.revisionId);
  assert.equal(result.value.nodes.find((item) => item.nodeId === "prepare").status, "completed");
  assert.deepEqual(result.value.nodeResults.prepare, current.nodeResults.prepare);
  assert.equal(result.value.nodeResults.write, undefined);
  assert.equal(result.value.nodes.find((item) => item.nodeId === "write").status, "pending");
  assert.equal(result.value.replanCount, 1);
});

test("rejects replan that replaces completed nodes, drops coverage, creates a cycle, or exceeds bound", () => {
  const current = assertWorkPlan(plan({
    nodes: [node("prepare", { status: "completed" }), node("write", { dependencies: ["prepare"] })],
  }));
  const completedReplacement = replanWorkPlan(current, {
    replaceNodeIds: ["prepare"],
    nodes: [node("prepare", { goal: "试图改写已完成节点" })],
  });
  assert.equal(completedReplacement.ok, false);
  assert.match(completedReplacement.errors.join("\n"), /completed|preserve/i);

  const atLimit = assertWorkPlan(plan({ replanCount: 2 }));
  const overLimit = replanWorkPlan(atLimit, { nodes: [node("write", { primaryCoverage: ["write"] })] });
  assert.equal(overLimit.ok, false);
  assert.match(overLimit.errors.join("\n"), /replan.*limit|bound/i);

  const allowed = assertWorkPlan(plan());
  const dropped = replanWorkPlan(allowed, {
    replaceNodeIds: ["write"],
    nodes: [node("draft", { primaryCoverage: ["draft"] })],
  });
  assert.equal(dropped.ok, false);
  assert.match(dropped.errors.join("\n"), /required coverage.*write|unplanned.*write/i);

  const cyclic = replanWorkPlan(allowed, {
    replaceNodeIds: ["prepare", "write"],
    nodes: [node("prepare", { dependencies: ["write"] }), node("write", { dependencies: ["prepare"] })],
  });
  assert.equal(cyclic.ok, false);
  assert.match(cyclic.errors.join("\n"), /cycle/i);
});

test("accepts unitPlans as an input alias and keeps stable IDs through a no-op replan", () => {
  const source = plan();
  const aliased = { ...source, nodes: undefined, unitPlans: source.nodes };
  const created = createWorkPlan(aliased);
  assert.deepEqual(created.nodes.map((item) => item.nodeId), ["prepare", "write"]);
  const result = replanWorkPlan(created, { nodes: [node("write", { dependencies: ["prepare"] })] });
  assert.equal(result.ok, true);
  assert.equal(result.value.nodes.find((item) => item.nodeId === "prepare").status, "pending");
});

test("accepts structured acceptance checks while keeping the host-owned fields explicit", () => {
  const checked = assertWorkPlan(plan({
    nodes: [node("prepare", {
      acceptanceCriteria: [{ id: "artifact", description: "artifact hash is present" }],
    }), node("write", { dependencies: ["prepare"] })],
  }));
  assert.deepEqual(checked.nodes[0].acceptanceCriteria, [{ id: "artifact", description: "artifact hash is present" }]);
});
