import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createFileEffectStore } from "./complex-task-effect-store.mjs";

test("file effect store survives a process restart and keeps effect identities bounded", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-effect-store-"));
  try {
    const first = createFileEffectStore(root);
    await first.put({ effectId: "task:one:unit:send", state: "dispatched", operation: "send_message" });
    assert.equal((await first.get("task:one:unit:send")).state, "dispatched");
    const restarted = createFileEffectStore(root);
    assert.deepEqual(await restarted.get("task:one:unit:send"), {
      effectId: "task:one:unit:send",
      state: "dispatched",
      operation: "send_message",
    });
    assert.equal(await restarted.get("missing"), null);
    await assert.rejects(() => restarted.put({ state: "prepared" }), /effectId/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
