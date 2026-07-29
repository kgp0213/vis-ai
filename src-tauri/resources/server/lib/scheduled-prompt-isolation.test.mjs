import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createPromptIsolation } from "./scheduled-prompt-isolation.mjs";

const launcherSource = readFileSync(new URL("../launcher.mjs", import.meta.url), "utf8");

describe("scheduled prompt isolation", () => {
  test("captures and restores the active loop history exactly once", () => {
    const calls = [];
    const history = [{ role: "user", content: "keep this" }];
    const loop = {
      model: "test-model",
      log: { toMessages: () => history.slice() },
      clearLog: () => calls.push("clear"),
      adoptHistory: (entries, model) => calls.push({ entries, model }),
    };

    const isolation = createPromptIsolation(loop, { enabled: true });
    assert.equal(isolation.enabled, true);
    assert.equal(isolation.snapshotCount, 1);
    assert.deepEqual(isolation.snapshot, history);
    assert.deepEqual(calls, ["clear"]);

    assert.equal(isolation.restore(), true);
    assert.equal(isolation.restore(), false);
    assert.deepEqual(calls, [
      "clear",
      { entries: history, model: "test-model" },
    ]);
  });

  test("does not touch the loop when isolation is disabled", () => {
    const calls = [];
    const loop = {
      log: { toMessages: () => [{ role: "user", content: "keep" }] },
      clearLog: () => calls.push("clear"),
      adoptHistory: () => calls.push("restore"),
    };
    const isolation = createPromptIsolation(loop, { enabled: false });
    assert.equal(isolation.enabled, false);
    assert.equal(isolation.restore(), false);
    assert.deepEqual(calls, []);
  });

  test("fails closed when a loop cannot snapshot history", () => {
    const loop = { clearLog: () => { throw new Error("must not clear"); } };
    const isolation = createPromptIsolation(loop, { enabled: true });
    assert.equal(isolation.enabled, false);
    assert.equal(isolation.reason, "active loop history is unavailable");
  });

  test("falls back to direct log restoration when history adoption fails", () => {
    const history = [{ role: "user", content: "preserve me" }];
    const restored = [];
    const loop = {
      model: "test-model",
      log: {
        toMessages: () => history.slice(),
        compactInPlace: (entries) => restored.push(entries),
      },
      clearLog: () => {},
      adoptHistory: () => { throw new Error("normalization failed"); },
    };

    const isolation = createPromptIsolation(loop, { enabled: true });
    assert.equal(isolation.restore(), true);
    assert.deepEqual(restored, [history]);
  });

  test("rebuilds the loop from the captured snapshot when both in-place restorers fail", () => {
    const history = [{ role: "user", content: "persisted conversation" }];
    const rebuilt = [];
    const loop = {
      model: "broken-model",
      log: {
        toMessages: () => history.slice(),
        compactInPlace: () => { throw new Error("log is unusable"); },
      },
      clearLog: () => {},
      adoptHistory: () => { throw new Error("loop is unusable"); },
    };

    const isolation = createPromptIsolation(loop, {
      enabled: true,
      rebuild: (snapshot) => {
        rebuilt.push(snapshot);
        return true;
      },
    });

    assert.equal(isolation.restore(), true);
    assert.equal(isolation.restore(), false);
    assert.deepEqual(rebuilt, [history]);
  });

  test("scheduled submissions opt into isolation and cannot reset the active conversation", () => {
    const triggerSource = launcherSource.slice(
      launcherSource.indexOf("async function triggerSchedule"),
      launcherSource.indexOf("function cancelScheduleRun"),
    );
    const submitSource = launcherSource.slice(
      launcherSource.indexOf("submitPrompt: async"),
      launcherSource.indexOf("abortTurn:"),
    );

    assert.match(triggerSource, /newConversation:\s*true,[\s\S]*isolated:\s*true/);
    assert.match(submitSource, /opts\.newConversation === true && opts\.isolated !== true/);
    assert.match(submitSource, /createPromptIsolation\(loop, \{[\s\S]*enabled: true,[\s\S]*rebuild:/);
    assert.match(submitSource, /opts\.isolated === true \|\| opts\.internalHandoff === true/);
    assert.match(submitSource, /promptIsolation\.snapshot[\s\S]*assistantText/);
    assert.match(submitSource, /catch \(historyError\)[\s\S]*isolationRestoreError/);
    assert.match(submitSource, /finally \{[\s\S]*await finalizeOperationBoundary\(operation, \{ requestId \}\)/);
    assert.match(submitSource, /const retrievalHistory = opts\.isolated === true \|\| opts\.internalHandoff === true \? \[\] : messages\.slice\(-12\)/);
    assert.match(submitSource, /opts\.isolated === true[\s\S]*promptIsolation\?\.restore/);
  });
});
