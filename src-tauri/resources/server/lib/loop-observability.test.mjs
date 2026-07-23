import { test } from "node:test";
import assert from "node:assert/strict";
import { createLoopTelemetry } from "./loop-observability.mjs";

test("loop telemetry exposes progress without generating user-visible messages", () => {
  let currentMs = 1_000;
  const telemetry = createLoopTelemetry({ startedAt: currentMs, now: () => currentMs });
  currentMs = 1_010;
  telemetry.observe({ role: "tool_start", turn: 2, toolName: "prepare_local_document" });
  currentMs = 1_020;
  telemetry.observe({ role: "tool", turn: 2, toolName: "prepare_local_document" });
  currentMs = 1_030;
  telemetry.observe({ role: "context_compacted", turn: 2 });
  currentMs = 1_040;
  const result = telemetry.observe({ role: "warning", turn: 2 });

  assert.deepEqual(result, {
    modelTurn: 2,
    toolDispatches: 1,
    toolResults: 1,
    contextCompactions: 1,
    warnings: 1,
    lastToolName: "prepare_local_document",
    lastActivityAt: 1_040,
    elapsedMs: 40,
  });
});
