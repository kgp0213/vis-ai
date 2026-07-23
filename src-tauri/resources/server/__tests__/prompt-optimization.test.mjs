import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { readFileSync } from "node:fs";

const serverUrl = new URL("../visionox-pkg/dist/cli/server-XGDBRWMB.js", import.meta.url);
const { dispatch } = await import(serverUrl.href);
const TOKEN = "prompt-optimization-test-token";
const launcherSource = readFileSync(new URL("../launcher.mjs", import.meta.url), "utf8");

function mockRes() {
  let status = null;
  let body = null;
  return {
    writeHead(value) { status = value; },
    end(value) { body = value; },
    get status() { return status; },
    get json() { return body ? JSON.parse(body) : null; },
  };
}

async function apiPost(body, overrides = {}) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.url = "/api/optimize-prompt";
  req.method = "POST";
  req.headers = { "x-reasonix-token": TOKEN, "content-type": "application/json" };
  const res = mockRes();
  await dispatch(req, res, { ...overrides }, TOKEN);
  return res;
}

describe("prompt optimization API", () => {
  test("uses mode-specific intent inference without inventing requirements", () => {
    assert.match(launcherSource, /activeModeId === "coding"/);
    assert.match(launcherSource, /咨询、排查、修改、构建还是审查代码/);
    assert.match(launcherSource, /办公文档、数据整理、研究或界面设计/);
    assert.match(launcherSource, /不要替用户编造答案/);
    assert.match(launcherSource, /不要把讨论或诊断请求擅自改成实施请求/);
  });

  test("returns an editable result without submitting a conversation turn", async () => {
    let received = null;
    let submitted = false;
    const res = await apiPost({ prompt: "帮我处理这个文件" }, {
      optimizePrompt: async (prompt) => {
        received = prompt;
        return { prompt: "读取指定文件，完整处理其内容，并在交付前验证输出。" };
      },
      submitPrompt: async () => {
        submitted = true;
        return { accepted: true };
      },
    });
    assert.equal(res.status, 200);
    assert.equal(received, "帮我处理这个文件");
    assert.equal(res.json.prompt, "读取指定文件，完整处理其内容，并在交付前验证输出。");
    assert.equal(submitted, false);
  });

  test("rejects empty prompts before invoking the model", async () => {
    let called = false;
    const res = await apiPost({ prompt: " " }, {
      optimizePrompt: async () => {
        called = true;
        return { prompt: "unused" };
      },
    });
    assert.equal(res.status, 400);
    assert.equal(called, false);
  });
});
