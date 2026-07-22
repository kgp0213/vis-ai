import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPromptQueueStore, promptRequestReceiptDecision } from "../lib/prompt-queue-store.mjs";

describe("prompt queue store", () => {
  let root;
  let path;
  const normalizeScope = (value) => String(value || "default");
  const normalizeItem = (value) => value?.id && value?.text ? { id: value.id, text: value.text } : null;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "visionox-prompt-queue-")); path = join(root, "queue.json"); });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  test("persists queue mutations and accepted request ids", () => {
    let now = 100;
    const store = createPromptQueueStore({ path, normalizeScope, normalizeItem, clock: () => now, acceptedTtlMs: 50 });
    assert.equal(store.upsert("one", { id: "a", text: "hello" }).ok, true);
    assert.equal(store.list("one")[0].text, "hello");
    store.rememberAccepted("a", { turnId: "turn-1" });
    assert.equal(store.acceptedRequest("a").turnId, "turn-1");
    now = 151;
    assert.equal(store.acceptedRequest("a"), null);
    assert.deepEqual(store.remove("one", "a").items, []);
    assert.equal(JSON.parse(readFileSync(path, "utf8")).version, 1);
  });

  test("persists a completed request receipt and returns it after a store restart", () => {
    let now = 100;
    const first = createPromptQueueStore({ path, normalizeScope, normalizeItem, clock: () => now });
    first.rememberAccepted("delivery-request", { turnId: "turn-1", ownerBootId: "boot-1" });
    first.rememberCompleted("delivery-request", {
      ok: true,
      assistantText: "后台任务已完成。",
      assistantMessageId: "assistant-1",
      taskState: "completed_with_warnings",
      warnings: ["需要人工复核"],
      artifactFiles: [{ path: "C:\\work\\report.md", filename: "report.md", size: 42, retention: "preserve" }],
      interventionChoice: "accept-partial",
      recoveryHandle: "turn:delivery-request",
    }, { ownerBootId: "boot-1" });

    const restarted = createPromptQueueStore({ path, normalizeScope, normalizeItem, clock: () => now });
    const receipt = restarted.acceptedRequest("delivery-request");
    assert.equal(receipt.state, "completed");
    assert.equal(receipt.ownerBootId, "boot-1");
    assert.deepEqual(receipt.completion, {
      ok: true,
      assistantText: "后台任务已完成。",
      assistantMessageId: "assistant-1",
      taskState: "completed_with_warnings",
      warnings: ["需要人工复核"],
      artifactFiles: [{ path: "C:\\work\\report.md", filename: "report.md", size: 42, retention: "preserve" }],
      interventionChoice: "accept-partial",
      recoveryHandle: "turn:delivery-request",
    });
  });

  test("an accepted receipt owned by an older process is uncertain and cannot be auto-replayed", () => {
    const first = createPromptQueueStore({ path, normalizeScope, normalizeItem });
    first.rememberAccepted("delivery-request", { turnId: "turn-1", ownerBootId: "boot-1" });
    const restarted = createPromptQueueStore({ path, normalizeScope, normalizeItem });
    assert.equal(restarted.acceptedRequest("delivery-request").state, "accepted");
    assert.deepEqual(promptRequestReceiptDecision(restarted.acceptedRequest("delivery-request"), "boot-2"), {
      action: "uncertain",
      reason: "上一次进程已接受请求，但结果未确认；为避免重复执行，未自动重试。请显式重新提交。",
    });
  });

  test("receipt decisions reuse completed work and fence in-flight or uncertain work", () => {
    const completed = {
      state: "completed",
      ownerBootId: "boot-1",
      completion: { ok: true, assistantText: "done" },
    };
    assert.deepEqual(promptRequestReceiptDecision(completed, "boot-2"), {
      action: "reuse-completion",
      completion: { ok: true, assistantText: "done" },
    });
    assert.deepEqual(promptRequestReceiptDecision({ state: "accepted", ownerBootId: "boot-2" }, "boot-2"), {
      action: "in-flight",
    });
    assert.deepEqual(promptRequestReceiptDecision({ state: "accepted", ownerBootId: "boot-1" }, "boot-2"), {
      action: "uncertain",
      reason: "上一次进程已接受请求，但结果未确认；为避免重复执行，未自动重试。请显式重新提交。",
    });
    assert.deepEqual(promptRequestReceiptDecision({ state: "accepted" }, "boot-2"), {
      action: "uncertain",
      reason: "上一次进程已接受请求，但结果未确认；为避免重复执行，未自动重试。请显式重新提交。",
    });
  });

  test("durable completed receipts survive TTL expiry across a restart", () => {
    let now = 100;
    const options = {
      path,
      normalizeScope,
      normalizeItem,
      clock: () => now,
      acceptedTtlMs: 50,
      isDurableReceiptId: (id) => id.startsWith("document-handoff-"),
    };
    const first = createPromptQueueStore(options);
    first.rememberAccepted("document-handoff-1", { turnId: "turn-1", ownerBootId: "boot-1" });
    first.rememberCompleted("document-handoff-1", {
      ok: true,
      assistantText: "durable completion",
      assistantMessageId: "assistant-1",
    }, { ownerBootId: "boot-1" });
    first.rememberAccepted("ordinary-1", { turnId: "turn-2", ownerBootId: "boot-1" });
    now = 151;
    const restarted = createPromptQueueStore(options);
    const durable = restarted.acceptedRequest("document-handoff-1");
    assert.equal(durable?.state, "completed");
    assert.deepEqual(promptRequestReceiptDecision(durable, "boot-2"), {
      action: "reuse-completion",
      completion: { ok: true, assistantText: "durable completion", assistantMessageId: "assistant-1" },
    });
    assert.equal(restarted.acceptedRequest("ordinary-1"), null);
  });

  test("durable receipts are not evicted by the ordinary receipt limit", () => {
    const store = createPromptQueueStore({
      path,
      normalizeScope,
      normalizeItem,
      acceptedLimit: 1,
      isDurableReceiptId: (id) => id.startsWith("document-handoff-"),
    });
    store.rememberAccepted("ordinary-1", { ownerBootId: "boot-1" });
    store.rememberAccepted("document-handoff-1", { ownerBootId: "boot-1" });
    store.rememberAccepted("ordinary-2", { ownerBootId: "boot-1" });
    const restarted = createPromptQueueStore({
      path,
      normalizeScope,
      normalizeItem,
      acceptedLimit: 1,
      isDurableReceiptId: (id) => id.startsWith("document-handoff-"),
    });
    assert.equal(restarted.acceptedRequest("ordinary-1"), null);
    assert.equal(restarted.acceptedRequest("ordinary-2")?.state, "accepted");
    assert.equal(restarted.acceptedRequest("document-handoff-1")?.state, "accepted");
    const persisted = JSON.parse(readFileSync(path, "utf8"));
    assert.deepEqual(persisted.accepted.map((entry) => entry.id), ["document-handoff-1", "ordinary-2"]);
  });

  test("a durable receipt becomes an ordinary TTL receipt only after explicit release", () => {
    let now = 100;
    const options = {
      path,
      normalizeScope,
      normalizeItem,
      acceptedTtlMs: 50,
      clock: () => now,
      isDurableReceiptId: (id) => id.startsWith("document-handoff-"),
    };
    const first = createPromptQueueStore(options);
    first.rememberAccepted("document-handoff-1", { ownerBootId: "boot-1" });
    first.rememberCompleted("document-handoff-1", { ok: true, assistantText: "done" });

    now = 200;
    assert.equal(first.releaseReceipt("document-handoff-1").ok, true);
    const restarted = createPromptQueueStore(options);
    assert.equal(restarted.acceptedRequest("document-handoff-1")?.state, "completed");
    now = 251;
    const expired = createPromptQueueStore(options);
    assert.equal(expired.acceptedRequest("document-handoff-1"), null);
  });

  test("reusing a released internal receipt id does not make it durable again", () => {
    let now = 100;
    const options = {
      path,
      normalizeScope,
      normalizeItem,
      acceptedTtlMs: 50,
      clock: () => now,
      isDurableReceiptId: (id) => id.startsWith("document-handoff-"),
    };
    const first = createPromptQueueStore(options);
    first.rememberAccepted("document-handoff-1", { ownerBootId: "boot-1" });
    first.rememberCompleted("document-handoff-1", { ok: true, assistantText: "done" });
    assert.equal(first.releaseReceipt("document-handoff-1").ok, true);

    now = 110;
    first.rememberAccepted("document-handoff-1", { ownerBootId: "boot-2" });
    assert.equal(first.acceptedRequest("document-handoff-1").durable, false);
    first.rememberCompleted("document-handoff-1", { ok: true, assistantText: "second attempt" });
    assert.equal(first.acceptedRequest("document-handoff-1").durable, false);
    now = 161;
    assert.equal(createPromptQueueStore(options).acceptedRequest("document-handoff-1"), null);
  });

  test("a failed completion receipt remains visible and is never auto-replayed", () => {
    const first = createPromptQueueStore({ path, normalizeScope, normalizeItem });
    first.rememberAccepted("uncertain-request", { turnId: "turn-1", ownerBootId: "boot-1" });
    first.rememberFailed("uncertain-request", "无法持久化本轮完成结果", { ownerBootId: "boot-1" });

    const restarted = createPromptQueueStore({ path, normalizeScope, normalizeItem });
    const receipt = restarted.acceptedRequest("uncertain-request");
    assert.equal(receipt.state, "failed");
    assert.equal(receipt.error, "无法持久化本轮完成结果");
    assert.deepEqual(promptRequestReceiptDecision(receipt, "boot-2"), {
      action: "failed",
      reason: "无法持久化本轮完成结果",
    });
  });

  test("enforces queue limits and rejects invalid items", () => {
    const store = createPromptQueueStore({ path, normalizeScope, normalizeItem, queueLimit: 1 });
    assert.equal(store.upsert("one", {}).ok, false);
    store.upsert("one", { id: "a", text: "one" });
    assert.match(store.upsert("one", { id: "b", text: "two" }).error, /queue limit/);
  });

  test("keeps malformed and newer stores read-only", () => {
    for (const body of ["{", '{"version":2,"queues":{},"accepted":[]}']) {
      writeFileSync(path, body);
      const issues = [];
      const store = createPromptQueueStore({ path, normalizeScope, normalizeItem, onIssue: (error) => issues.push(error) });
      assert.ok(store.status().readOnlyError);
      assert.throws(() => store.upsert("one", { id: "a", text: "one" }), /not modified/);
      assert.equal(readFileSync(path, "utf8"), body);
      assert.ok(issues[0]);
    }
  });
});
