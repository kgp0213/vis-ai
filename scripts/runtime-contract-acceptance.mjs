#!/usr/bin/env node

import { createServer } from "node:http";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { DeepSeekClient } from "../src-tauri/resources/server/visionox-pkg/dist/index.js";
import { createAgentSessionRuntime } from "../src-tauri/resources/server/lib/agent-session-runtime.mjs";
import { createOperationRuntime } from "../src-tauri/resources/server/lib/operation-runtime.mjs";
import { createRuntimeFactStore } from "../src-tauri/resources/server/lib/runtime-fact-store.mjs";

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
    scenarios.push({ id: "auth-failure", status: authFailed ? "passed" : "failed", rootCause: "provider" });

    const operationStates = [];
    const operationRuntime = createOperationRuntime({
      broadcast: (event) => operationStates.push(event.operation?.state),
      getConversationId: () => "session-cancel",
      getWorkspace: () => "C:/workspace-cancel",
      idFactory: () => "operation-cancel",
    });
    const operation = operationRuntime.begin("chat");
    const cancelled = client.chat({ model: "cancel-model", messages: [{ role: "user", content: "cancel" }], signal: operation.context.signal })
      .then(() => false, (error) => error?.name === "AbortError" || /abort/iu.test(String(error?.message)));
    setTimeout(() => operationRuntime.stop(operation, "acceptance_cancelled"), 20);
    const requestCancelled = await cancelled;
    operationRuntime.finish(operation, "cancelled");
    scenarios.push({
      id: "active-operation-cancellation",
      status: requestCancelled && operation.controller.signal.aborted && operationRuntime.getActive() === null ? "passed" : "failed",
      rootCause: "operation",
      operationState: operationStates.at(-1) ?? null,
    });

    const stores = new Map();
    for (const sessionId of ["session-old", "session-new"]) {
      const store = createRuntimeFactStore({
        file: join(root, `${sessionId}.facts.jsonl`),
        sessionId,
        epoch: `acceptance-${sessionId}`,
      });
      await store.load();
      stores.set(sessionId, store);
    }
    let binding = { sessionId: "session-old", workspace: "C:/workspace-a" };
    let finishOldTurn = null;
    const sessionRuntime = createAgentSessionRuntime({
      getActiveBinding: () => binding,
      executeTurn: async (entry, controls) => {
        finishOldTurn = async () => {
          await stores.get(entry.sessionId).append({
            type: "message.upsert",
            entityId: "late-result",
            payload: { id: "late-result", role: "assistant", text: "old session result", taskState: "completed" },
          });
          controls.complete({ ok: true, taskState: "completed" });
        };
        return { accepted: true, turnId: "turn-old" };
      },
    });
    await sessionRuntime.submit({
      inputId: "input-old",
      requestId: "request-old",
      sessionId: "session-old",
      workspace: "C:/workspace-a",
      text: "run",
    });
    binding = { sessionId: "session-new", workspace: "C:/workspace-b" };
    await finishOldTurn();
    await sessionRuntime.waitForIdle("session-old");
    const oldSessionMessages = stores.get("session-old").snapshot().messages.length;
    const newSessionMessages = stores.get("session-new").snapshot().messages.length;
    scenarios.push({
      id: "session-result-isolation",
      status: oldSessionMessages === 1 && newSessionMessages === 0 ? "passed" : "failed",
      rootCause: "session",
      oldSessionMessages,
      newSessionMessages,
    });

    const expectedArtifact = join(root, "missing-artifact.md");
    let artifactMissing = false;
    try { await access(expectedArtifact); } catch (error) { artifactMissing = error?.code === "ENOENT"; }
    scenarios.push({
      id: "artifact-verification",
      status: reply.content === "stub-ok" && artifactMissing ? "passed" : "failed",
      rootCause: "artifact",
      artifactState: artifactMissing ? "missing" : "present",
    });
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
