import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";

import {
  assertReportSourceIntegrity,
  reportSourceIntegrityError,
  scanReportJsonlMessages,
} from "./report-session-source.mjs";

const roots = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function tempFile(name, content) {
  const root = mkdtempSync(join(tmpdir(), "visionox-report-source-"));
  roots.push(root);
  const path = join(root, name);
  writeFileSync(path, content, "utf8");
  return path;
}

describe("report JSONL source integrity", () => {
  test("retains valid records and reports the exact malformed line", async () => {
    const path = tempFile("session-a.jsonl", [
      JSON.stringify({ role: "user", content: "first" }),
      '{"role":"assistant","content":',
      JSON.stringify({ role: "assistant", content: "last" }),
      "",
    ].join("\n"));

    const result = await scanReportJsonlMessages(path, Number.POSITIVE_INFINITY, {
      source: "session-a",
      maxMessageChars: Number.POSITIVE_INFINITY,
    });

    assert.deepEqual(result.messages, [
      { role: "user", content: "first" },
      { role: "assistant", content: "last" },
    ]);
    assert.equal(result.totalMessages, 2);
    assert.equal(result.issues.length, 1);
    assert.equal(result.issues[0].type, "invalid-json");
    assert.equal(result.issues[0].source, "session-a");
    assert.equal(result.issues[0].line, 2);
    assert.match(result.issues[0].reason, /JSON|Unexpected|end/i);
  });

  test("reports invalid records and file read failures instead of returning a clean empty scan", async () => {
    const invalidPath = tempFile("invalid-record.jsonl", [
      JSON.stringify(["not", "a", "message"]),
      JSON.stringify({ role: "user" }),
      "",
    ].join("\n"));
    const invalid = await scanReportJsonlMessages(invalidPath, 1_000, { source: "invalid-record" });
    assert.equal(invalid.totalMessages, 0);
    assert.equal(invalid.issues.length, 2);
    assert.equal(invalid.issues[0].type, "invalid-record");
    assert.equal(invalid.issues[0].line, 1);
    assert.equal(invalid.issues[1].line, 2);
    assert.match(invalid.issues[1].reason, /content\/text/);

    const missing = await scanReportJsonlMessages(join(invalidPath, "missing.jsonl"), 1_000, { source: "missing-session" });
    assert.equal(missing.totalMessages, 0);
    assert.equal(missing.issues.length, 1);
    assert.equal(missing.issues[0].type, "read-failed");
    assert.match(missing.issues[0].reason, /ENOENT|not found|cannot find/i);
  });

  test("builds a bounded visible failure and refuses incomplete report sources", () => {
    assert.equal(reportSourceIntegrityError([]), null);
    assert.doesNotThrow(() => assertReportSourceIntegrity([]));

    const issues = [
      { source: "session-a", type: "invalid-json", line: 7, reason: "Unexpected end of JSON input" },
      { source: "session-b", type: "read-failed", reason: "access denied" },
    ];
    const error = reportSourceIntegrityError(issues);
    assert.equal(error.code, "REPORT_SOURCE_INCOMPLETE");
    assert.deepEqual(error.issues, issues);
    assert.match(error.message, /会话报告未生成/);
    assert.match(error.message, /session-a 第 7 行/);
    assert.match(error.message, /session-b/);
    assert.throws(() => assertReportSourceIntegrity(issues), (thrown) => thrown === error || thrown?.code === "REPORT_SOURCE_INCOMPLETE");
  });
});
