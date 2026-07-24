#!/usr/bin/env node

import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { DeepSeekClient } from "../src-tauri/resources/server/visionox-pkg/dist/index.js";

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address()));
  });
}

function close(server) {
  return new Promise((resolve) => {
    server.close(() => resolve());
    server.closeAllConnections?.();
  });
}

function json(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

export async function runRuntimeContractAcceptance() {
  const root = await mkdtemp(join(tmpdir(), "visionox-runtime-contract-"));
  const attempts = new Map();
  const server = createServer((req, res) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      let body = {};
      try { body = JSON.parse(raw || "{}"); } catch {}
      const model = String(body.model || "");
      attempts.set(model, (attempts.get(model) || 0) + 1);
      if (model === "retry-model" && attempts.get(model) === 1) {
        json(res, 429, { error: { message: "temporary rate limit" } }, { "retry-after": "0.001" });
        return;
      }
      if (model === "auth-model") {
        json(res, 401, { error: { message: "invalid api key" } });
        return;
      }
      if (model === "cancel-model") {
        const timer = setTimeout(() => json(res, 200, { choices: [{ message: { content: "late" } }] }), 2_000);
        req.once("close", () => clearTimeout(timer));
        return;
      }
      json(res, 200, {
        choices: [{ message: { content: "stub-ok", tool_calls: [] }, finish_reason: "stop" }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });
    });
  });
  const scenarios = [];
  let cleaned = false;
  try {
    const address = await listen(server);
    const retries = [];
    const client = new DeepSeekClient({
      apiKey: "test-only-key",
      baseUrl: `http://127.0.0.1:${address.port}`,
      timeoutMs: 1_000,
      retry: { maxAttempts: 4, initialBackoffMs: 1, maxBackoffMs: 5, onRetry: (event) => retries.push(event) },
    });
    const reply = await client.chat({ model: "retry-model", messages: [{ role: "user", content: "retry" }] });
    scenarios.push({ id: "retry-then-success", status: reply.content === "stub-ok" && retries.length === 1 ? "passed" : "failed" });

    let authFailed = false;
    try { await client.chat({ model: "auth-model", messages: [{ role: "user", content: "auth" }] }); } catch (error) { authFailed = /API 401/u.test(String(error?.message)); }
    scenarios.push({ id: "auth-failure", status: authFailed ? "passed" : "failed" });

    const controller = new AbortController();
    const cancelled = client.chat({ model: "cancel-model", messages: [{ role: "user", content: "cancel" }], signal: controller.signal })
      .then(() => false, (error) => error?.name === "AbortError" || /abort/iu.test(String(error?.message)));
    setTimeout(() => controller.abort(), 20);
    scenarios.push({ id: "cancellation", status: await cancelled ? "passed" : "failed" });
  } finally {
    await close(server).catch(() => {});
    await rm(root, { recursive: true, force: true });
    cleaned = true;
  }
  return {
    ok: scenarios.every((scenario) => scenario.status === "passed"),
    scenarios,
    externalNetworkUsed: false,
    dwsSendCount: 0,
    cleaned,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runRuntimeContractAcceptance().then((result) => {
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  }).catch((error) => {
    console.error(`[runtime-contract-acceptance] ${error?.stack || error}`);
    process.exitCode = 1;
  });
}
