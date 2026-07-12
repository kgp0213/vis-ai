import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const launcher = readFileSync(new URL("../launcher.mjs", import.meta.url), "utf8");

function block(startMarker, endMarker) {
  const start = launcher.indexOf(startMarker);
  const end = launcher.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `launcher block not found: ${startMarker}`);
  return launcher.slice(start, end);
}

test("Soul and project rules report degraded reads instead of silently changing context", () => {
  assert.match(block("function loadSoul", "// ── Mode system"), /trackPersistentStorageIssue\("soul-read"[\s\S]*"warning"/);
  assert.match(block("function loadRules", "function getRuleSetStatus"), /trackPersistentStorageIssue\([\s\S]*`rules:\$\{name\}`[\s\S]*"warning"/);
});

test("mode memory transactions surface incomplete rollback", () => {
  const move = block("function moveModeMemory", "function batchModeMemory");
  const batch = block("function batchModeMemory", "function clearSessionMemories");
  assert.match(move, /restoreModeMemoryAfterFailure[\s\S]*rollback incomplete/);
  assert.match(batch, /restoreModeMemoryAfterFailure[\s\S]*rollback incomplete/);
  assert.doesNotMatch(move, /writeModeMemory\([^\n]+catch \{\}/);
  assert.doesNotMatch(batch, /writeModeMemory\([^\n]+catch \{\}/);
});

test("unreadable knowledge topics cannot be overwritten", () => {
  const readManifest = block("function readKnowledgeManifest", "function writeKnowledgeManifest");
  const organize = block("async function generateSessionKnowledge", "async function updateKnowledgeSemanticIndex");
  assert.match(readManifest, /manualEdited:[^\n]+contentHash === null/);
  assert.match(readManifest, /knowledge-topics:[\s\S]*some knowledge topics could not be read/);
  assert.match(organize, /existing knowledge topic[\s\S]*could not be read/);
});

test("new conversation reports an active-plan cleanup failure", () => {
  const reset = block("async function resetActiveConversation", "function isValidSessionName");
  assert.match(reset, /clearPlanState\(planSession\)/);
  assert.match(reset, /active plan cleanup failed/);
});
