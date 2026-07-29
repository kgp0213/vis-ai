import assert from "node:assert/strict";
import test from "node:test";

const serverUrl = new URL("../visionox-pkg/dist/cli/server-XGDBRWMB.js", import.meta.url);
const { dispatch } = await import(serverUrl.href);
const TOKEN = "session-snapshot-test-token";

async function getMessages(path, { messages, snapshot, busy = false, operation = null }) {
  const req = { url: path, method: "GET", headers: { "x-reasonix-token": TOKEN } };
  let status = null;
  let body = null;
  let compatibilityReads = 0;
  const res = {
    writeHead(nextStatus) { status = nextStatus; },
    end(data) { body = data; },
  };
  await dispatch(req, res, {
    getMessages: () => {
      compatibilityReads += 1;
      return messages;
    },
    getSessionSnapshot: () => snapshot,
    isBusy: () => busy,
    getActiveOperation: () => operation,
  }, TOKEN);
  return { status, json: body ? JSON.parse(body) : null, compatibilityReads };
}

test("messages response is paged entirely from one canonical SessionSnapshotV1", async () => {
  const messages = Array.from({ length: 1094 }, (_, index) => ({ id: `m-${index}`, role: "user", text: `content-${index}` }));
  const snapshot = {
    schemaVersion: 1,
    sessionId: "session-large",
    eventCursor: "epoch-a:1095",
    busy: true,
    operation: { id: "operation-current", state: "running", sessionId: "session-large" },
    messages: [
      ...messages,
      { id: "m-durable-only", role: "assistant", text: "durable terminal", taskState: "completed" },
    ],
  };

  const latest = await getMessages("/api/messages", {
    messages: [{ id: "stale-session-message", role: "assistant", text: "must not leak" }],
    snapshot,
    busy: false,
    operation: { id: "stale-operation", state: "running" },
  });
  assert.equal(latest.status, 200);
  assert.equal(latest.json.messages.length, 200);
  assert.equal(latest.json.messages[0].id, "m-895");
  assert.equal(latest.json.messages.at(-1).id, "m-durable-only");
  assert.deepEqual(
    [latest.json.totalMessages, latest.json.startIndex, latest.json.hasMore],
    [1095, 895, true],
  );
  assert.equal(latest.json.busy, true);
  assert.equal(latest.json.operation.id, "operation-current");
  assert.equal(latest.compatibilityReads, 0);
  assert.equal(latest.json.snapshot.messages.length, 200);
  assert.equal(latest.json.snapshot.messages[0].id, "m-895");
  assert.equal(latest.json.snapshot.messages.at(-1).id, "m-durable-only");
  assert.deepEqual(latest.json.snapshot.messagePage, { totalMessages: 1095, startIndex: 895, hasMore: true });

  const earlier = await getMessages("/api/messages?limit=200&offset=200", { messages, snapshot });
  assert.equal(earlier.json.messages[0].id, "m-695");
  assert.equal(earlier.json.messages.at(-1).id, "m-894");
  assert.equal(earlier.json.snapshot.messages[0].id, "m-695");
  assert.equal(earlier.json.snapshot.messages.at(-1).id, "m-894");
  assert.deepEqual(earlier.json.snapshot.messagePage, { totalMessages: 1095, startIndex: 695, hasMore: true });
});
