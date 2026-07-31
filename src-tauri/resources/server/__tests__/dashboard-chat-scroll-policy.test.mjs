import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const typescript = require("../visionox-pkg/node_modules/typescript/lib/typescript.js");

async function loadScrollPolicy() {
  const source = await readFile(new URL("../visionox-pkg/dashboard/src/lib/chat-scroll-policy.ts", import.meta.url), "utf8");
  const output = typescript.transpileModule(source, {
    compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 },
    fileName: "chat-scroll-policy.ts",
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output, "utf8").toString("base64")}`);
}

test("content growth pins only while following; otherwise it counts new messages below", async () => {
  const { computeGrowthEffect } = await loadScrollPolicy();

  assert.deepEqual(computeGrowthEffect(true, 1), { type: "pin" });
  assert.deepEqual(computeGrowthEffect(true, 5), { type: "pin" });

  // 手动阅读模式下，内容增长绝不写滚动位置，只累计提示计数。
  assert.deepEqual(computeGrowthEffect(false, 3), { type: "count", added: 3 });
  assert.deepEqual(computeGrowthEffect(false, 1), { type: "count", added: 1 });

  // 没有新增内容时什么都不做；非法输入按 1 条计。
  assert.deepEqual(computeGrowthEffect(true, 0), { type: "none" });
  assert.deepEqual(computeGrowthEffect(false, 0), { type: "none" });
  assert.deepEqual(computeGrowthEffect(false, undefined), { type: "count", added: 1 });
});

test("top auto-load requires a settled viewport still parked at the top", async () => {
  const { shouldTriggerTopLoad } = await loadScrollPolicy();
  const base = { scrollTop: 0, threshold: 96, loading: false, dragging: false, backgrounded: false, suppressed: false };

  assert.equal(shouldTriggerTopLoad(base), true);
  assert.equal(shouldTriggerTopLoad({ ...base, scrollTop: 96 }), true);

  // 已离开顶部、加载中、拖拽滚动条、后台工作台、挂载恢复期内，一律不触发。
  assert.equal(shouldTriggerTopLoad({ ...base, scrollTop: 97 }), false);
  assert.equal(shouldTriggerTopLoad({ ...base, loading: true }), false);
  assert.equal(shouldTriggerTopLoad({ ...base, dragging: true }), false);
  assert.equal(shouldTriggerTopLoad({ ...base, backgrounded: true }), false);
  assert.equal(shouldTriggerTopLoad({ ...base, suppressed: true }), false);
});

test("the frame scheduler coalesces repeated pin requests into one scroll write", async () => {
  const { createFrameScheduler } = await loadScrollPolicy();
  const callbacks = new Map();
  let nextId = 1;
  let writes = 0;
  const scheduler = createFrameScheduler({
    requestFrame(callback) {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    },
    cancelFrame(id) {
      callbacks.delete(id);
    },
    run() {
      writes += 1;
    },
  });

  scheduler.schedule();
  scheduler.schedule();
  scheduler.schedule();
  assert.equal(callbacks.size, 1);
  callbacks.values().next().value();
  assert.equal(writes, 1);
  assert.equal(callbacks.size, 0);

  scheduler.schedule();
  scheduler.cancel();
  assert.equal(callbacks.size, 0);
  assert.equal(writes, 1);
});
