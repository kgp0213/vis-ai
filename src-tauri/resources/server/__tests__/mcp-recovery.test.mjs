import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { isMcpToolTimeout, mcpRecoveryError } from "../lib/mcp-recovery.mjs";

describe("MCP recovery policy", () => {
  test("只识别 tools/call 超时", () => {
    assert.equal(isMcpToolTimeout(new Error("MCP request tools/call (id=62) timed out after 60000ms")), true);
    assert.equal(isMcpToolTimeout(new Error("MCP request initialize (id=1) timed out after 60000ms")), false);
  });

  test("恢复提示要求先检查文件而不是盲目重放写操作", () => {
    const message = mcpRecoveryError("officecli");
    assert.match(message, /restarted/);
    assert.match(message, /Inspect the current file/);
    assert.match(message, /without duplicating/);
  });
});
