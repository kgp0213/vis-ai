import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  normalizeDwsResponse,
  runDwsExec,
  runDwsWrite,
  validateDwsExecArgs,
  validateDwsHelpArgs,
  validateDwsReadArgs,
  validateDwsWriteArgs,
} from "../../bootstrap-skills/dws/scripts/dws-json.mjs";

describe("DWS JSON read adapter", () => {
  test("allows verified reads and bounded pagination", () => {
    assert.deepEqual(validateDwsReadArgs(["chat", "message", "list-mentions", "--start", "2026-07-13T00:00:00+08:00", "--end", "2026-07-13T23:59:59+08:00", "--limit", "200"]), [
      "chat", "message", "list-mentions", "--start", "2026-07-13T00:00:00+08:00", "--end", "2026-07-13T23:59:59+08:00", "--limit", "200",
    ]);
    assert.deepEqual(validateDwsReadArgs(["calendar", "event", "list", "--calendar-id", "primary", "--limit", "50"]), ["calendar", "event", "list", "--calendar-id", "primary", "--limit", "50"]);
    assert.deepEqual(validateDwsReadArgs(["chat", "message", "list-unread-conversations", "--exclude-muted", "--count", "20"]), ["chat", "message", "list-unread-conversations", "--exclude-muted", "--count", "20"]);
    assert.deepEqual(validateDwsReadArgs(["chat", "message", "list-favorites", "--cursor", "20", "--size", "50"]), ["chat", "message", "list-favorites", "--cursor", "20", "--size", "50"]);
    assert.deepEqual(validateDwsReadArgs(["drive", "stats", "--node", "dentry-uuid-1"]), ["drive", "stats", "--node", "dentry-uuid-1"]);
    assert.deepEqual(validateDwsReadArgs(["sheet", "table-get", "--node", "node-1", "--sheet-id", "Sheet1", "--range", "A1:D20", "--no-header"]), ["sheet", "table-get", "--node", "node-1", "--sheet-id", "Sheet1", "--range", "A1:D20", "--no-header"]);
    assert.deepEqual(validateDwsReadArgs(["sheet", "pivot-table", "list", "--node", "node-1", "--sheet-id", "Sheet1", "--pivot-table-id", "pt-1"]), ["sheet", "pivot-table", "list", "--node", "node-1", "--sheet-id", "Sheet1", "--pivot-table-id", "pt-1"]);
  });

  test("rejects writes, unknown flags and excessive reads", () => {
    assert.throws(() => validateDwsReadArgs(["chat", "message", "send", "--text", "hello"]), /not allowed/);
    assert.throws(() => validateDwsReadArgs(["chat", "message", "list", "--yes"]), /not allowed/);
    assert.throws(() => validateDwsReadArgs(["chat", "message", "list", "--limit", "201"]), /1 to 200/);
  });

  test("normalizes inconsistent success shapes without discarding metadata", () => {
    assert.deepEqual(normalizeDwsResponse({ status: 0, stdout: JSON.stringify({ success: "true", result: { items: [1], hasMore: true, nextCursor: 20 }, traceId: "t-1" }) }), {
      ok: true,
      data: { items: [1], hasMore: true, nextCursor: 20 },
      error: null,
      meta: { status: 0, requestId: "t-1", hasMore: true, nextCursor: 20 },
    });
    assert.equal(normalizeDwsResponse({ status: 0, stdout: JSON.stringify({ errorMsg: "ok", result: [] }) }).ok, true);
  });

  test("surfaces malformed JSON and explicit failures", () => {
    assert.match(normalizeDwsResponse({ status: 0, stdout: "{" }).error, /invalid JSON/);
    assert.deepEqual(normalizeDwsResponse({ status: 1, stdout: JSON.stringify({ success: false, errorMsg: "denied" }) }).ok, false);
  });
});

describe("DWS JSON write adapter", () => {
  test("never starts a real write process in test mode", async () => {
    const previous = process.env.VISIONOX_TEST_MODE;
    process.env.VISIONOX_TEST_MODE = "1";
    try {
      const result = await runDwsWrite([
        "chat", "message", "send", "--user", "self", "--text", "test", "--uuid", "test-mode",
      ], { executable: "this-executable-must-not-start" });
      assert.equal(result.ok, false);
      assert.equal(result.meta?.testMode, true);
      assert.equal(result.skipped, true);

      const future = await runDwsExec([
        "future-product", "record", "create", "--name", "test",
      ], { executable: "this-executable-must-not-start" });
      assert.equal(future.ok, false);
      assert.equal(future.meta?.testMode, true);
      assert.equal(future.skipped, true);
    } finally {
      if (previous === undefined) delete process.env.VISIONOX_TEST_MODE;
      else process.env.VISIONOX_TEST_MODE = previous;
    }
  });

  test("allows only a bounded message send shape", () => {
    assert.deepEqual(validateDwsWriteArgs([
      "chat", "message", "send", "--user", "user-1", "--text", "hello", "--title", "notice", "--uuid", "request-1",
    ]), ["chat", "message", "send", "--user", "user-1", "--text", "hello", "--title", "notice", "--uuid", "request-1"]);
    assert.deepEqual(validateDwsWriteArgs([
      "chat", "message", "send", "--group", "group-1", "--msg-type", "file", "--file-path", "C:\\tmp\\report.pdf", "--uuid", "request-2",
    ]).slice(0, 3), ["chat", "message", "send"]);
  });

  test("rejects ambiguous targets, unsupported writes, and confirmation bypass flags", () => {
    assert.throws(() => validateDwsWriteArgs(["chat", "message", "send", "--user", "u", "--group", "g", "--text", "hello"]), /exactly one target/);
    assert.throws(() => validateDwsWriteArgs(["chat", "message", "send", "--user", "u", "--text", "hello", "--yes"]), /not allowed/);
    assert.throws(() => validateDwsWriteArgs(["todo", "task", "delete", "--task-id", "x"]), /not allowed/);
    assert.throws(() => validateDwsWriteArgs(["chat", "message", "send", "--user", "u", "--msg-type", "file"]), /file-path/);
  });
});

describe("DWS forward-compatible adapter", () => {
  test("accepts current and future command arguments without a business-command allowlist", () => {
    assert.deepEqual(validateDwsExecArgs([
      "future-product", "record", "create", "--name", "new capability", "--custom-flag", "value",
    ]), ["future-product", "record", "create", "--name", "new capability", "--custom-flag", "value"]);
    assert.deepEqual(validateDwsHelpArgs(["future-product", "record", "create"]), ["future-product", "record", "create"]);
    assert.deepEqual(validateDwsHelpArgs([]), []);
  });

  test("rejects process-control injection while leaving business flags unrestricted", () => {
    assert.throws(() => validateDwsExecArgs([]), /at least one/);
    assert.throws(() => validateDwsExecArgs(["chat", "message", "send", "--yes"]), /managed by Visionox/);
    assert.throws(() => validateDwsExecArgs(["chat", "message", "list", "--format", "text"]), /managed by Visionox/);
    assert.throws(() => validateDwsExecArgs(["chat", "message", "list", "bad\0value"]), /NUL/);
    assert.throws(() => validateDwsHelpArgs(["chat", "--yes"]), /managed by Visionox|command segments/);
  });
});

describe("DWS v1.0.55 service coverage", () => {
  test("allows hrbrain and devapp read-only commands with their documented flags", () => {
    assert.deepEqual(validateDwsReadArgs(["hrbrain", "talent-pool", "list", "--keyword", "储备", "--page-size", "20"]), ["hrbrain", "talent-pool", "list", "--keyword", "储备", "--page-size", "20"]);
    assert.deepEqual(validateDwsReadArgs(["hrbrain", "talent-pool", "employees", "--pool-code", "POOL-1", "--page", "1"]).slice(0, 3), ["hrbrain", "talent-pool", "employees"]);
    assert.deepEqual(validateDwsReadArgs(["hrbrain", "profile", "query", "--work-no", "1001", "--data-queries", "[{\"modelCode\":\"basic\"}]"]).slice(0, 3), ["hrbrain", "profile", "query"]);
    assert.deepEqual(validateDwsReadArgs(["hrbrain", "profile", "labels", "--staff-ids", "1001,1002", "--all-label"]).slice(0, 3), ["hrbrain", "profile", "labels"]);
    assert.deepEqual(validateDwsReadArgs(["hrbrain", "search", "employees-structured", "--origin-json", "{}", "--fields", "[]", "--order-by", "name"]).slice(0, 3), ["hrbrain", "search", "employees-structured"]);
    assert.deepEqual(validateDwsReadArgs(["devapp", "+list", "--name", "机器人", "--page-size", "20"]), ["devapp", "+list", "--name", "机器人", "--page-size", "20"]);
    assert.deepEqual(validateDwsReadArgs(["devapp", "+list", "--dry-run"]), ["devapp", "+list", "--dry-run"]);
    assert.deepEqual(validateDwsReadArgs(["devapp", "+permission-list", "--unified-app-id", "app-1", "--scope-type", "APP", "--cursor", "0"]).slice(0, 2), ["devapp", "+permission-list"]);
    assert.deepEqual(validateDwsReadArgs(["devapp", "+version-check-approval", "--unified-app-id", "app-1", "--version-id", "v1"]).slice(0, 2), ["devapp", "+version-check-approval"]);
    assert.deepEqual(validateDwsReadArgs(["contact", "dept", "search", "--keyword", "技术"]).slice(0, 3), ["contact", "dept", "search"]);
    assert.deepEqual(validateDwsReadArgs(["devdoc", "article", "search", "--query", "机器人", "--page", "1"]).slice(0, 3), ["devdoc", "article", "search"]);
  });

  test("rejects new-service writes, credential overrides and out-of-range pagination", () => {
    assert.throws(() => validateDwsReadArgs(["devapp", "+create", "--name", "x"]), /not allowed/);
    assert.throws(() => validateDwsReadArgs(["hrbrain", "profile", "query", "--work-no", "1", "--data-queries", "[]", "--yes"]), /not allowed/);
    assert.throws(() => validateDwsReadArgs(["hrbrain", "search", "employees", "--page-size", "201"]), /1 to 200/);
    assert.throws(() => validateDwsReadArgs(["devapp", "+list", "--client-secret", "x"]), /not allowed/);
    assert.throws(() => validateDwsReadArgs(["devapp", "+list", "--timeout", "5"]), /not allowed/);
  });
});
