import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { forkSessionEntries, validateSessionWorkspace, createSessionRecoveryRuntime } from "./session-recovery.mjs";
import { serializeActiveSession } from "./active-session.mjs";

test("workspace validation blocks resume after a workspace change", () => {
  assert.equal(validateSessionWorkspace({ path: "C:\\one", fingerprint: "a" }, { path: "C:\\two", fingerprint: "a" }).reason, "workspace_changed");
  assert.equal(validateSessionWorkspace({ path: "C:\\one", fingerprint: "a" }, { path: "C:\\one", fingerprint: "a" }).ok, true);
});

test("workspace validation tolerates Windows separator and trailing-slash differences", () => {
  assert.equal(validateSessionWorkspace({ path: "C:\\work\\project\\" }, { path: "c:/work/project" }).ok, true);
});

test("fork preserves facts but clears active interaction and marks in-flight tools unknown", () => {
  const result = forkSessionEntries([
    { role: "assistant", receipt: { intervention: { active: true } } },
    { role: "tool", toolCallId: "call-1", toolStatus: "running", content: "tool was still running" },
  ], { sourceSessionId: "s1", targetSessionId: "s2" });
  assert.equal(result.entries[0].receipt.intervention.active, false);
  assert.equal(result.entries[1].toolStatus, "unknown");
  assert.equal(result.warnings.length, 2);
});

test("recovery runtime blocks cross-workspace resume unless explicitly overridden", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-session-recovery-"));
  const meta = new Map([["source", { version: 1, workspace: { path: "C:\\source" }, interactions: [{ id: "i-1" }] }]]);
  await writeFile(join(root, "source.jsonl"), serializeActiveSession([{ role: "user", content: "hello" }]), "utf8");
  const runtime = createSessionRecoveryRuntime({
    sessionPath: (name) => join(root, `${name}.jsonl`),
    isValidSessionName: (name) => /^[a-z-]+$/u.test(name),
    readMeta: (name) => meta.get(name) ?? {},
    currentWorkspace: () => ({ path: "C:\\current" }),
  });
  const blocked = await runtime.resume("source");
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, "SESSION_WORKSPACE_CHANGED");
  assert.equal((await runtime.resume("source", { allowWorkspaceMismatch: true })).ok, true);
});

test("recovery runtime keeps legacy sessions readable when no workspace snapshot exists", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-legacy-resume-"));
  await writeFile(join(root, "legacy.jsonl"), serializeActiveSession([{ role: "user", content: "legacy" }]), "utf8");
  const runtime = createSessionRecoveryRuntime({
    sessionPath: (name) => join(root, `${name}.jsonl`),
    isValidSessionName: (name) => /^[a-z-]+$/u.test(name),
    currentWorkspace: () => ({ path: "C:\\current" }),
  });
  const result = await runtime.resume("legacy");
  assert.equal(result.ok, true);
  assert.match(result.warnings[0], /no workspace snapshot/u);
});

test("recovery runtime forks facts without copying active side effects and refuses overwrite", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-session-fork-"));
  const metadata = new Map([["source", { version: 1, workspace: { path: "C:\\work" }, interactions: [{ id: "gate-1" }], preparedDocuments: [{ documentRef: "doc-1" }] }]]);
  await writeFile(join(root, "source.jsonl"), serializeActiveSession([
    { role: "user", content: "hello" },
    { role: "assistant", content: "waiting", receipt: { intervention: { active: true } } },
    { role: "tool", toolCallId: "call-1", toolStatus: "running", content: "tool was still running" },
  ]), "utf8");
  const runtime = createSessionRecoveryRuntime({
    sessionPath: (name) => join(root, `${name}.jsonl`),
    isValidSessionName: (name) => /^[a-z-]+$/u.test(name),
    readMeta: (name) => metadata.get(name) ?? {},
    writeMeta: async (name, value) => metadata.set(name, value),
    currentWorkspace: () => ({ path: "C:\\work" }),
    idFactory: () => "conversation-fork",
  });
  const result = await runtime.fork("source", "forked");
  assert.equal(result.ok, true);
  assert.equal(result.conversationId, "conversation-fork");
  assert.equal(metadata.get("forked").messageCount, 3);
  assert.equal(metadata.get("forked").interactions.length, 0);
  assert.deepEqual(metadata.get("forked").preparedDocuments, []);
  const persisted = (await readFile(join(root, "forked.jsonl"), "utf8"))
    .trim().split(/\r?\n/u).map((line) => JSON.parse(line));
  assert.equal(persisted[1].receipt.intervention.active, false);
  assert.equal(persisted[2].toolStatus, "unknown");
  assert.equal((await runtime.fork("source", "forked")).code, "SESSION_EXISTS");
});

test("recovery runtime rebinds fork attachments to the new conversation id", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-session-fork-attachments-"));
  const metadata = new Map([[
    "source",
    { version: 1, conversationId: "source-conversation", workspace: { path: "C:\\work" } },
  ]]);
  await writeFile(join(root, "source.jsonl"), serializeActiveSession([
    { role: "user", content: "look", attachments: [{ id: "att_image" }] },
  ]), "utf8");
  const calls = [];
  const runtime = createSessionRecoveryRuntime({
    sessionPath: (name) => join(root, `${name}.jsonl`),
    isValidSessionName: (name) => /^[a-z-]+$/u.test(name),
    readMeta: (name) => metadata.get(name) ?? {},
    writeMeta: async (name, value) => metadata.set(name, value),
    currentWorkspace: () => ({ path: "C:\\work" }),
    idFactory: () => "fork-conversation",
    rebindAttachments: async (ids, context) => {
      calls.push({ ids, context });
      return { attached: ids.length, warnings: [] };
    },
  });
  const result = await runtime.fork("source", "forked");
  assert.equal(result.ok, true);
  assert.deepEqual(calls, [{
    ids: ["att_image"],
    context: {
      sourceSessionId: "source-conversation",
      targetSessionId: "fork-conversation",
      operationId: null,
      workspace: { path: "C:\\work" },
    },
  }]);
});

test("recovery runtime refuses an orphan target metadata file", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-session-fork-meta-"));
  const metadata = new Map([[
    "source",
    { version: 1, workspace: { path: "C:\\work" } },
  ]]);
  await writeFile(join(root, "source.jsonl"), serializeActiveSession([{ role: "user", content: "hello" }]), "utf8");
  await writeFile(join(root, "forked.meta.json"), JSON.stringify({ todos: [{ id: "stale" }] }), "utf8");
  const runtime = createSessionRecoveryRuntime({
    sessionPath: (name) => join(root, `${name}.jsonl`),
    sessionMetaPath: (name) => join(root, `${name}.meta.json`),
    isValidSessionName: (name) => /^[a-z-]+$/u.test(name),
    readMeta: (name) => metadata.get(name) ?? {},
    currentWorkspace: () => ({ path: "C:\\work" }),
  });
  const result = await runtime.fork("source", "forked");
  assert.equal(result.code, "SESSION_EXISTS");
});

test("recovery runtime cleans a newly written fork when metadata persistence fails", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-session-fork-cleanup-"));
  await writeFile(join(root, "source.jsonl"), serializeActiveSession([{ role: "user", content: "hello" }]), "utf8");
  let rebound = false;
  const runtime = createSessionRecoveryRuntime({
    sessionPath: (name) => join(root, `${name}.jsonl`),
    isValidSessionName: (name) => /^[a-z-]+$/u.test(name),
    currentWorkspace: () => ({ path: "C:\\work" }),
    atomicWriteFile: async (path, value) => writeFile(path, value, "utf8"),
    writeMeta: async () => { throw new Error("metadata disk is read-only"); },
    rebindAttachments: async () => { rebound = true; return { attached: 0, warnings: [] }; },
  });
  await assert.rejects(runtime.fork("source", "forked"), /read-only/u);
  await assert.rejects(readFile(join(root, "forked.jsonl")));
  assert.equal(rebound, false);
});
