#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const releaseRoot = join(root, "src-tauri", "target", "release");
const releaseLauncher = join(releaseRoot, "resources", "server", "launcher.mjs");
const releaseNode = join(releaseRoot, "resources", "server", "node.exe");
const resultJsonPath = join(root, "plan", "real-task-acceptance-results-2026-07-24.json");
const resultMarkdownPath = join(root, "plan", "real-task-acceptance-results-2026-07-24.md");

const MODEL_GROUPS = [
  { group: "weak", providerId: "volcengine-ark-doubao-2-code", modelId: "doubao-seed-2.0-code", label: "豆包 2.0 Code" },
  { group: "kimi", providerId: "volcengine-ark-kimi-k27-code", modelId: "kimi-k2.7-code", label: "Kimi K2.7 Code" },
  { group: "qwen", providerId: "local-qwen", modelId: "qwen3.5-397b-a17b", label: "Qwen3.5-397B" },
];

const BLOCKED_TASKS = [
  { id: "T3", reason: "encrypted-fixture-required" },
  { id: "T4", reason: "dws-authorization-required" },
  { id: "T5", reason: "dws-authorization-required" },
  { id: "T6", reason: "dws-authorization-required" },
];

export function sanitizeDiagnostic(value, max = 1600) {
  return String(value ?? "")
    .replace(/(?:sk|api)-[a-z0-9._-]{6,}/gi, "[redacted]")
    .replace(/([?&]token=)[^&\s;]+/gi, "$1[redacted]")
    .replace(/(--token\s+)[^\s]+/gi, "$1[redacted]")
    .replace(/\b[a-f0-9]{40,}\b/gi, "[redacted]")
    .slice(0, max);
}

function boundedText(value, max = 1600) {
  return sanitizeDiagnostic(value, max);
}

function claimedComplete(text) {
  return /(?:已完成|已经完成|完成了|任务完成|成功生成|successfully completed|completed successfully|done\b)/i.test(String(text ?? ""));
}

export function publicModelInventory(config = {}) {
  return (Array.isArray(config.providers) ? config.providers : []).map((provider) => ({
    providerId: String(provider?.id ?? ""),
    providerName: String(provider?.name ?? provider?.id ?? ""),
    configured: Boolean(String(provider?.baseUrl ?? "").trim() && String(provider?.apiKey ?? "").trim()),
    models: (Array.isArray(provider?.models) ? provider.models : []).map((model) => ({
      id: String(model?.id ?? ""),
      enabled: model?.disabled !== true,
    })),
  }));
}

export function classifyTaskEvidence({ blockedReason = null, assistantText = "", expectedArtifact = null, artifact = null, artifactCoverageRequired = false, receipt = null } = {}) {
  const modelClaimedComplete = claimedComplete(assistantText);
  if (blockedReason) return { status: "blocked", reason: String(blockedReason), modelClaimedComplete: false };
  if (expectedArtifact && (!artifact || artifact.bytes <= 0)) {
    return { status: "failed", reason: "required-artifact-missing", modelClaimedComplete };
  }
  if (expectedArtifact && artifactCoverageRequired && artifact?.coverage?.verified !== true) {
    return { status: "failed", reason: "artifact-coverage-unverified", modelClaimedComplete };
  }
  const taskState = receipt?.completion?.taskState ?? null;
  const receiptOk = receipt?.completion?.ok === true && !["incomplete", "needs_intervention"].includes(taskState);
  if (expectedArtifact && artifact?.bytes > 0) {
    return { status: "passed", reason: "artifact-verified", modelClaimedComplete };
  }
  if (receiptOk) return { status: "passed", reason: "receipt-completed", modelClaimedComplete };
  return { status: "failed", reason: "completion-not-verified", modelClaimedComplete };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function fileEvidence(path, coverage = null) {
  if (!path || !existsSync(path)) return null;
  const stat = statSync(path);
  if (!stat.isFile()) return null;
  const content = readFileSync(path);
  const evidence = {
    path: basename(path),
    bytes: stat.size,
    mtime: stat.mtime.toISOString(),
    sha256: createHash("sha256").update(content).digest("hex"),
  };
  if (coverage) {
    const text = content.toString("utf8").replace(/^\uFEFF/u, "");
    const lines = text.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
    const headings = lines.filter((line) => /^#{1,6}\s+/u.test(line)).length;
    const pageReferences = (text.match(/(?:第\s*\d+\s*页|page\s*\d+)/giu) || []).length;
    evidence.coverage = {
      nonEmptyLines: lines.length,
      headingCount: headings,
      pageReferenceCount: pageReferences,
      firstNonEmpty: boundedText(lines[0] || "", 180),
      lastNonEmpty: boundedText(lines.at(-1) || "", 180),
      verified: lines.length >= (coverage.minimumNonEmptyLines ?? 1)
        && headings >= (coverage.minimumHeadings ?? 0)
        && pageReferences >= (coverage.minimumPageReferences ?? 0),
    };
  }
  return evidence;
}

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolvePort(address.port));
    });
  });
}

async function waitFor(predicate, timeoutMs, intervalMs = 250) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await predicate();
    if (last) return last;
    await new Promise((resolveWait) => setTimeout(resolveWait, intervalMs));
  }
  throw new Error(`condition timed out after ${timeoutMs}ms; last=${boundedText(JSON.stringify(last), 500)}`);
}

function terminateProcessTree(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  } else {
    child.kill("SIGTERM");
  }
}

function prepareIsolatedHome(sourceConfigPath, tempRoot, workspace) {
  const home = join(tempRoot, "home");
  const visionox = join(home, ".visionox");
  mkdirSync(visionox, { recursive: true });
  const config = readJson(sourceConfigPath);
  config.workspaceDir = workspace;
  config.recentWorkspaces = [workspace];
  config.editMode = "yolo";
  config.mode = "general";
  config.indexRetrievalMode = "off";
  config.knowledgeAutoIndex = false;
  writeFileSync(join(visionox, "config.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return { home, config };
}

function prepareCodeFixture(workspace, suffix) {
  const directory = join(workspace, `code-${suffix}`);
  mkdirSync(join(directory, "src"), { recursive: true });
  mkdirSync(join(directory, "test"), { recursive: true });
  writeFileSync(join(directory, "package.json"), JSON.stringify({ type: "module", scripts: { test: "node --test" } }, null, 2), "utf8");
  writeFileSync(join(directory, "src", "math.mjs"), "export function total(values) { return values.reduce((sum, value) => sum + value, 0); }\n", "utf8");
  writeFileSync(join(directory, "src", "format.mjs"), "export function formatTotal(value) { return `Total: ${value}`; }\n", "utf8");
  writeFileSync(join(directory, "test", "app.test.mjs"), [
    'import assert from "node:assert/strict";',
    'import { test } from "node:test";',
    'import { total } from "../src/math.mjs";',
    'import { formatTotal } from "../src/format.mjs";',
    'test("totals numeric strings and formats the result", () => {',
    '  assert.equal(formatTotal(total(["2", "3", "5"])), "合计：10.00");',
    '});',
    "",
  ].join("\n"), "utf8");
  return directory;
}

function prepareRecoveryFixture(workspace, suffix) {
  const directory = join(workspace, `recovery-${suffix}`);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "actual-input.txt"), "RECOVERY-MARKER-20260724\n", "utf8");
  return directory;
}

async function createClient(port, token) {
  const base = `http://127.0.0.1:${port}`;
  const headers = { "x-reasonix-token": token };
  async function request(method, path, body) {
    const response = await fetch(`${base}/api/${path}`, {
      method,
      headers: body === undefined ? headers : { ...headers, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    let value;
    try { value = text ? JSON.parse(text) : {}; } catch { value = { raw: boundedText(text) }; }
    return { status: response.status, body: value };
  }
  return {
    request,
    messages: () => request("GET", "messages?limit=500"),
    modal: () => request("GET", "modal"),
    async waitIdle(timeoutMs = 60_000) {
      return waitFor(async () => {
        const response = await this.messages();
        return response.status === 200 && response.body.busy === false ? response.body : null;
      }, timeoutMs);
    },
    async waitBusy(timeoutMs = 10_000) {
      return waitFor(async () => {
        const response = await this.messages();
        return response.status === 200 && response.body.busy === true ? response.body : null;
      }, timeoutMs);
    },
  };
}

function finalAssistant(messages) {
  return [...(Array.isArray(messages) ? messages : [])].reverse().find((message) => message?.role === "assistant" && message?.text) ?? null;
}

async function resetConversation(client) {
  const response = await client.request("POST", "submit", { prompt: "/new", requestId: `matrix-new-${Date.now()}` });
  if (![202, 409].includes(response.status)) throw new Error(`new conversation failed: ${response.status} ${boundedText(JSON.stringify(response.body))}`);
  await client.waitIdle(30_000);
}

async function switchModel(client, model) {
  const response = await client.request("POST", "providers/active", { id: model.providerId, modelId: model.modelId });
  if (response.status !== 200) throw new Error(`model switch failed: ${response.status} ${boundedText(JSON.stringify(response.body))}`);
}

async function runPromptTask(client, { model, taskId, prompt, expectedArtifact = null, artifactCoverage = null, timeoutMs = 12 * 60_000 }) {
  await resetConversation(client);
  await switchModel(client, model);
  const requestId = `matrix-${model.group}-${taskId.toLowerCase()}-${Date.now()}`;
  const submittedAt = new Date().toISOString();
  const response = await client.request("POST", "submit", { prompt, requestId });
  if (response.status !== 202) {
    return { taskId, modelGroup: model.group, modelId: model.modelId, submittedAt, status: "blocked", reason: `submit-${response.status}`, detail: boundedText(JSON.stringify(response.body)) };
  }
  let operationId = null;
  try { operationId = (await client.waitBusy(10_000)).operation?.id ?? null; } catch {}
  let finalPage;
  let waitError = null;
  try {
    finalPage = await client.waitIdle(timeoutMs);
  } catch (error) {
    waitError = error;
    await client.request("POST", "abort", {});
    try { finalPage = await client.waitIdle(30_000); } catch {}
  }
  const assistant = finalAssistant(finalPage?.messages);
  const artifact = fileEvidence(expectedArtifact, artifactCoverage);
  const classified = waitError
    ? { status: "failed", reason: "task-timeout", modelClaimedComplete: claimedComplete(assistant?.text) }
    : classifyTaskEvidence({ assistantText: assistant?.text, expectedArtifact, artifact, artifactCoverageRequired: Boolean(artifactCoverage), receipt: assistant?.receipt });
  const modal = await client.modal().catch(() => ({ body: {} }));
  return {
    taskId,
    modelGroup: model.group,
    modelId: model.modelId,
    requestId,
    operationId,
    submittedAt,
    completedAt: new Date().toISOString(),
    ...classified,
    artifact,
    taskState: assistant?.taskState ?? assistant?.receipt?.completion?.taskState ?? null,
    toolResults: assistant?.receipt?.tools?.results ?? 0,
    toolFailures: assistant?.receipt?.tools?.failures ?? 0,
    interventionCount: assistant?.receipt?.intervention?.shown ?? 0,
    receiptErrors: Array.isArray(assistant?.receipt?.errors) ? assistant.receipt.errors : [],
    pendingModal: modal?.body?.modal?.kind ?? null,
    assistantText: boundedText(assistant?.text),
    error: waitError ? boundedText(waitError.message) : null,
  };
}

async function runCancellationTask(client, model, pdfPath, taskId = "T7") {
  await resetConversation(client);
  await switchModel(client, model);
  const requestId = `matrix-${model.group}-${taskId.toLowerCase()}-${Date.now()}`;
  const prompt = `读取 ${pdfPath} 的全部内容并生成完整 Markdown。开始后持续处理直到全部完成。`;
  const response = await client.request("POST", "submit", { prompt, requestId });
  if (response.status !== 202) return { taskId, modelGroup: model.group, modelId: model.modelId, status: "blocked", reason: `submit-${response.status}` };
  const busy = await client.waitBusy(15_000).catch(() => null);
  const aborted = await client.request("POST", "abort", {});
  const idle = await client.waitIdle(60_000).catch(() => null);
  const passed = Boolean(busy?.operation?.id && [200, 202].includes(aborted.status) && idle?.busy === false && !idle?.operation);
  return {
    taskId,
    modelGroup: model.group,
    modelId: model.modelId,
    operationId: busy?.operation?.id ?? null,
    status: passed ? "passed" : "failed",
    reason: passed ? "cancelled-without-active-operation" : "cancel-propagation-unverified",
    modelClaimedComplete: false,
    abortStatus: aborted.status,
  };
}

async function runSessionSwitchTask(client, model, pdfPath) {
  await resetConversation(client);
  await switchModel(client, model);
  const requestId = `matrix-${model.group}-t8-${Date.now()}`;
  const response = await client.request("POST", "submit", { prompt: `分析 ${pdfPath} 的全部章节并给出逐章检查结果。`, requestId });
  if (response.status !== 202) return { taskId: "T8", modelGroup: model.group, modelId: model.modelId, status: "blocked", reason: `submit-${response.status}` };
  const busy = await client.waitBusy(15_000).catch(() => null);
  const rejectedSwitch = await client.request("POST", "submit", { prompt: "", session: `matrix-switch-${model.group}` });
  await client.request("POST", "abort", {});
  await client.waitIdle(60_000).catch(() => null);
  const reset = await client.request("POST", "submit", { prompt: "/new", requestId: `matrix-new-after-switch-${Date.now()}` });
  const idle = await client.waitIdle(30_000).catch(() => null);
  const passed = Boolean(busy?.operation?.id && rejectedSwitch.status === 409 && reset.status === 202 && idle?.busy === false);
  return {
    taskId: "T8",
    modelGroup: model.group,
    modelId: model.modelId,
    operationId: busy?.operation?.id ?? null,
    status: passed ? "passed" : "failed",
    reason: passed ? "busy-switch-rejected-and-new-session-recovered" : "session-switch-isolation-unverified",
    modelClaimedComplete: false,
    busySwitchStatus: rejectedSwitch.status,
    resetStatus: reset.status,
  };
}

function blockedRecord(model, task) {
  return { taskId: task.id, modelGroup: model.group, modelId: model.modelId, ...classifyTaskEvidence({ blockedReason: task.reason }) };
}

function renderMarkdown(payload) {
  const counts = payload.results.reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] ?? 0) + 1 }), {});
  const rows = payload.results.map((item) => `| ${item.modelGroup} | ${item.modelId} | ${item.taskId} | ${item.status} | ${item.reason} | ${item.interventionCount ?? 0} | ${item.artifact?.bytes ?? "-"} | ${item.artifact?.coverage?.verified === true ? "是" : item.artifact?.coverage ? "否" : "不适用"} |`).join("\n");
  return `# 真实任务验收结果（2026-07-24）\n\n`+
    `- 被测运行时提交：\`${payload.runtimeCommit}\`\n`+
    `- 验收器提交：\`${payload.harnessCommit}\`\n`+
    `- 开始：${payload.startedAt}\n`+
    `- 完成：${payload.completedAt}\n`+
    `- 汇总：通过 ${counts.passed ?? 0}，失败 ${counts.failed ?? 0}，阻塞 ${counts.blocked ?? 0}\n`+
    `- DWS：未发送；所有相关用例因缺少本轮发送授权而明确阻塞。\n`+
    `- 临时环境：已清理，未保留 API Key、完整服务地址或测试产物正文。\n\n`+
    `| 分组 | 模型 | 任务 | 结果 | 原因 | 干预次数 | 产物字节 | 覆盖证据 |\n|---|---|---|---|---|---:|---:|---|\n${rows}\n`;
}

async function executeMatrix() {
  const sourceConfigPath = join(homedir(), ".visionox", "config.json");
  if (!existsSync(sourceConfigPath)) throw new Error(`missing user config: ${sourceConfigPath}`);
  if (!existsSync(releaseLauncher) || !existsSync(releaseNode)) throw new Error("release runtime is missing; run npm run release:check first");
  const pdfPath = "C:\\Users\\Lenovo\\Desktop\\mipi\\MIPI_CSI_specification_Version_2.0.pdf";
  if (!existsSync(pdfPath)) throw new Error(`long-document fixture is missing: ${pdfPath}`);

  const tempRoot = mkdtempSync(join(tmpdir(), "visionox-real-matrix-"));
  const workspace = join(tempRoot, "workspace");
  mkdirSync(workspace, { recursive: true });
  const { home, config } = prepareIsolatedHome(sourceConfigPath, tempRoot, workspace);
  const inventory = publicModelInventory(config);
  const port = await freePort();
  const token = randomBytes(24).toString("hex");
  const child = spawn(releaseNode, [releaseLauncher, "--port", String(port), "--token", token], {
    cwd: workspace,
    env: { ...process.env, HOME: home, USERPROFILE: home },
    stdio: ["ignore", "ignore", "pipe"],
    windowsHide: true,
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-24_000); });
  const startedAt = new Date().toISOString();
  const results = [];
  try {
    const client = await createClient(port, token);
    await waitFor(async () => {
      try { return (await client.request("GET", "health")).status === 200; } catch { return false; }
    }, 30_000);
    for (const model of MODEL_GROUPS) {
      const publicProvider = inventory.find((provider) => provider.providerId === model.providerId);
      const available = publicProvider?.configured && publicProvider.models.some((candidate) => candidate.id === model.modelId && candidate.enabled);
      if (!available) {
        for (const taskId of ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9"]) {
          results.push(blockedRecord(model, { id: taskId, reason: "model-not-configured" }));
        }
        continue;
      }
      const suffix = `${model.group}-${Date.now()}`;
      const markdownPath = join(workspace, `mipi-csi-${model.group}.md`);
      results.push(await runPromptTask(client, {
        model,
        taskId: "T1",
        prompt: `提取 ${pdfPath} 的完整内容，并保存为 ${markdownPath}。必须覆盖全部页面，保存后检查文件存在、大小和首尾内容；不要只返回摘要。`,
        expectedArtifact: markdownPath,
        artifactCoverage: { minimumNonEmptyLines: 40, minimumHeadings: 3, minimumPageReferences: 1 },
      }));
      const codeDir = prepareCodeFixture(workspace, suffix);
      results.push(await runPromptTask(client, {
        model,
        taskId: "T2",
        prompt: `修改 ${join(codeDir, "src", "math.mjs")} 和 ${join(codeDir, "src", "format.mjs")}：total 必须把数字字符串按数值相加，formatTotal 输出“合计：10.00”格式。运行 node --test ${join(codeDir, "test", "app.test.mjs")} 并修复到通过。最后把验证摘要写入 ${join(codeDir, "result.txt")}。`,
        expectedArtifact: join(codeDir, "result.txt"),
        timeoutMs: 5 * 60_000,
      }));
      for (const task of BLOCKED_TASKS) results.push(blockedRecord(model, task));
      results.push(await runCancellationTask(client, model, pdfPath));
      results.push(await runSessionSwitchTask(client, model, pdfPath));
      const recoveryDir = prepareRecoveryFixture(workspace, suffix);
      const recoveryOutput = join(recoveryDir, "recovered.txt");
      results.push(await runPromptTask(client, {
        model,
        taskId: "T9",
        prompt: `先尝试读取 ${join(recoveryDir, "missing-input.txt")}；该路径预期会失败。失败后不要停止，查找同目录实际存在的 txt 输入，读取标记并将其原样写入 ${recoveryOutput}，然后验证输出。`,
        expectedArtifact: recoveryOutput,
        timeoutMs: 3 * 60_000,
      }));
    }
  } finally {
    terminateProcessTree(child);
    rmSync(tempRoot, { recursive: true, force: true });
  }

  const harnessCommit = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8", windowsHide: true }).stdout.trim();
  const releaseManifest = readJson(join(releaseRoot, "release-manifest.json"));
  const runtimeCommit = String(releaseManifest?.build?.git?.commit ?? "unknown").slice(0, 12);
  const payload = {
    schemaVersion: 1,
    runtimeCommit,
    harnessCommit,
    startedAt,
    completedAt: new Date().toISOString(),
    inventory: inventory.filter((provider) => MODEL_GROUPS.some((model) => model.providerId === provider.providerId)),
    results,
    diagnostics: { launcherStderrTail: boundedText(stderr.slice(-4000), 4000) },
  };
  writeFileSync(resultJsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  writeFileSync(resultMarkdownPath, renderMarkdown(payload), "utf8");
  return payload;
}

async function main() {
  const configPath = join(homedir(), ".visionox", "config.json");
  if (!process.argv.includes("--execute")) {
    if (!existsSync(configPath)) throw new Error(`missing user config: ${configPath}`);
    console.log(JSON.stringify({ execute: false, models: publicModelInventory(readJson(configPath)) }, null, 2));
    return;
  }
  const payload = await executeMatrix();
  const summary = payload.results.reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] ?? 0) + 1 }), {});
  console.log(JSON.stringify({ runtimeCommit: payload.runtimeCommit, harnessCommit: payload.harnessCommit, summary, resultMarkdownPath, resultJsonPath }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[real-task-acceptance] ${boundedText(error?.stack || error, 4000)}`);
    process.exitCode = 1;
  });
}
