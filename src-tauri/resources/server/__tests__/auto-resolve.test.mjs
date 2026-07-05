import { test, describe } from "node:test";
import assert from "node:assert/strict";

const chunkUrl = new URL("../visionox-pkg/dist/cli/chunk-45U62RI3.js", import.meta.url);
const { autoResolveVerdict, shouldAutoResolveCheckpoint } = await import(chunkUrl.href);

describe("shouldAutoResolveCheckpoint", () => {
  test("auto/yolo/admin → true（自动解决）", () => {
    assert.equal(shouldAutoResolveCheckpoint("auto"), true);
    assert.equal(shouldAutoResolveCheckpoint("yolo"), true);
    assert.equal(shouldAutoResolveCheckpoint("admin"), true);
  });

  test("review/undefined/null → false（不自动解决）", () => {
    assert.equal(shouldAutoResolveCheckpoint("review"), false);
    assert.equal(shouldAutoResolveCheckpoint(undefined), false);
    assert.equal(shouldAutoResolveCheckpoint(null), false);
    assert.equal(shouldAutoResolveCheckpoint(""), false);
    assert.equal(shouldAutoResolveCheckpoint("invalid"), false);
  });
});

describe("autoResolveVerdict", () => {
  test("plan_checkpoint + auto → { type: 'continue' }", () => {
    const result = autoResolveVerdict({ kind: "plan_checkpoint", payload: {} }, "auto");
    assert.deepEqual(result, { type: "continue" });
  });

  test("plan_checkpoint + review → null（review 不自动解决）", () => {
    assert.equal(autoResolveVerdict({ kind: "plan_checkpoint", payload: {} }, "review"), null);
  });

  test("run_command + auto → null（非 plan_checkpoint 不自动解决）", () => {
    assert.equal(autoResolveVerdict({ kind: "run_command", payload: {} }, "auto"), null);
    assert.equal(autoResolveVerdict({ kind: "path_access", payload: {} }, "admin"), null);
    assert.equal(autoResolveVerdict({ kind: "choice", payload: {} }, "yolo"), null);
  });
});
