// Recovered from the product bundle; types are tightened incrementally without changing behavior.
// @ts-nocheck
import { createPortal as T2, memo as preactMemo } from "preact/compat";
import { useCallback as q2, useEffect as y2, useRef as A2, useState as d2 } from "preact/hooks";
import {
  ChatMessage,
  CheckpointModal,
  ChoiceModal,
  EditReviewModal,
  PickerModal,
  PlanModal,
  RevisionModal,
  ShellModal,
  ViewerModal,
  WorkspaceModal,
  parseToolArgs,
} from "../components/chat-internals.js";
import { MODE, TOKEN, api, writeClipboardText } from "../lib/api.js";
import { appBus, showToast } from "../lib/bus.js";
import { fmtBytes, fmtCost, fmtUsd, primaryBalance } from "../lib/format.js";
import { html as html4 } from "../lib/html.js";
import { confirmExternalArtifactOpen, showArtifactPreview } from "../lib/markdown.js";
import { subscribeSse, subscribeSseStatus } from "../lib/use-poll.js";
import { t as t4, useLang } from "../i18n/index.js";
const N2: any = preactMemo;

function planStatus(plan: any): string {
  if (plan?.status) return plan.status;
  if (plan?.completionRatio >= 1) return "done";
  if (plan?.completionRatio > 0) return "active";
  return "idle";
}

function statusPill(plan: any) {
  const status = planStatus(plan);
  if (status === "done") return html4`<span class="pill ok">${t4("plans.done")}</span>`;
  if (status === "active") return html4`<span class="pill info">${t4("plans.active")}</span>`;
  if (status === "pending") return html4`<span class="pill warn">${t4("plans.pending")}</span>`;
  return html4`<span class="pill">${t4("plans.idle")}</span>`;
}

var CHAT_DRAFT_KEY = "visionox.chatDraft.v1";
var CHAT_INITIAL_RENDER_COUNT = 30;
function parseProviderImportJson(text) {
  const parsed = JSON.parse(String(text || ""));
  if (parsed.schemaVersion === 3) {
    if (!Array.isArray(parsed.operations) || parsed.operations.length === 0) throw new Error("维护 JSON 必须包含非空 operations 数组");
    return parsed;
  }
  if (!Array.isArray(parsed.providers) || parsed.providers.length === 0) throw new Error("JSON 必须包含非空 providers 数组");
  for (const provider of parsed.providers) {
    if (!provider?.id || typeof provider.id !== "string") throw new Error("每个 provider 都必须包含 id");
    if (!Array.isArray(provider.models) || provider.models.length === 0) throw new Error(`provider ${provider.id} 必须包含模型`);
    for (const model of provider.models) {
      if (!model?.id || typeof model.id !== "string") throw new Error(`provider ${provider.id} 中存在无 id 的模型`);
      if (!Number.isSafeInteger(model.maxContextLength) || model.maxContextLength <= 0) throw new Error(`模型 ${model.id} 必须声明有效的 maxContextLength`);
    }
  }
  return parsed;
}
function providerOptionLabel(provider) {
  const name = provider?.name ?? provider?.id ?? "Provider";
  const models = Array.isArray(provider?.models) ? provider.models.filter((model) => model.disabled !== true) : [];
  if (models.length === 0) return name;
  const results = models.map((model) => {
    const modelName = model.name ?? model.id ?? "model";
    return model.testStatus === "passed" ? `${modelName} ✓` : modelName;
  });
  return `${name} · ${results.join(" · ")}`;
}
function providerDisplayGroups(providers) {
  const groups = new Map();
  for (const provider of Array.isArray(providers) ? providers : []) {
    const groupId = provider?.ui?.groupId || provider?.id || "default";
    const label = provider?.ui?.groupName || provider?.name || provider?.id || "服务商";
    const group = groups.get(groupId) || { id: groupId, label, providers: [] };
    group.providers.push(provider);
    groups.set(groupId, group);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      providers: group.providers.slice().sort((a, b) => (a?.ui?.order ?? 0) - (b?.ui?.order ?? 0))
    }))
    .sort((a, b) => Math.min(...a.providers.map((provider) => provider?.ui?.order ?? 0)) - Math.min(...b.providers.map((provider) => provider?.ui?.order ?? 0)));
}
function providerDisplayLabel(provider) {
  return provider?.ui?.modelLabel || providerOptionLabel(provider);
}
function reasoningEffortLabel(effort) {
  return {
    low: "快速",
    medium: "均衡",
    high: "深入",
    xhigh: "极致",
    max: "极致"
  }[effort] ?? effort;
}
function providerModelContextLabel(model) {
  const tokens = model?.capabilities?.maxContextTokens ?? model?.maxContextLength;
  if (!Number.isFinite(tokens) || tokens <= 0) return "";
  if (tokens >= 1e6) return `${Math.round(tokens / 1e5) / 10}M`;
  return `${Math.round(tokens / 1024)}K`;
}
function providerModelCapabilityLabels(model) {
  const labels = [];
  const modalities = model?.capabilities?.inputModalities ?? (model?.multimodal ? ["text", "image"] : ["text"]);
  labels.push(modalities.includes("image") ? "图文" : "仅文本");
  if (model?.capabilities?.roles?.some((role) => /code/i.test(role)) || /code/i.test(`${model?.id || ""} ${model?.name || ""}`)) labels.push("代码");
  const context = providerModelContextLabel(model);
  if (context) labels.push(context);
  return labels;
}
function providerModelTestSummary(providers) {
  const models = (providers ?? []).flatMap((provider) => (provider.models ?? []).filter((model) => model.disabled !== true));
  return {
    total: models.length,
    passed: models.filter((model) => model.testStatus === "passed").length,
    failed: models.filter((model) => model.testStatus === "failed").length,
    untested: models.filter((model) => model.testStatus === "untested").length
  };
}
var CHAT_RENDER_STEP = 30;
var CHAT_MESSAGE_PAGE_SIZE = 60;
var CHAT_TOP_LOAD_THRESHOLD = 96;
var FILE_ARTIFACT_EXTS = /* @__PURE__ */ new Set(["md", "markdown", "html", "htm", "txt", "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "csv", "json", "xml", "yaml", "yml", "py", "js", "ts", "tsx", "jsx", "css", "sql", "ps1", "bat", "cmd", "sh", "ini", "toml"]);
var FILE_ARTIFACT_PREVIEW_EXTS = /* @__PURE__ */ new Set(["md", "markdown", "html", "htm", "txt", "csv", "json", "xml", "yaml", "yml", "py", "js", "ts", "tsx", "jsx", "css", "sql", "ps1", "bat", "cmd", "sh", "ini", "toml"]);
var FILE_ARTIFACT_SCRIPT_EXTS = /* @__PURE__ */ new Set(["py", "js", "ts", "tsx", "jsx", "ps1", "bat", "cmd", "sh"]);
function captureChatScrollAnchor(feed) {
  if (!feed) return null;
  const feedTop = feed.getBoundingClientRect().top;
  const nodes = feed.querySelectorAll(".chat-msg[data-msg-id]");
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (rect.bottom >= feedTop) {
      return { id: node.dataset.msgId, offset: rect.top - feedTop };
    }
  }
  return { id: null, scrollHeight: feed.scrollHeight, scrollTop: feed.scrollTop };
}
function restoreChatScrollAnchor(feed, anchor, done) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    try {
      if (!feed || !anchor) return;
      if (anchor.id) {
        const node = Array.from(feed.querySelectorAll(".chat-msg[data-msg-id]")).find((item) => item.dataset.msgId === anchor.id);
        if (node) {
          const feedTop = feed.getBoundingClientRect().top;
          feed.scrollTop += node.getBoundingClientRect().top - feedTop - anchor.offset;
          return;
        }
      }
      if (Number.isFinite(anchor.scrollHeight)) {
        feed.scrollTop = anchor.scrollTop + Math.max(0, feed.scrollHeight - anchor.scrollHeight);
      }
    } finally {
      done?.();
    }
  }));
}

function upsertToolProgress(items, dash) {
  const toolCallId = String(dash.toolCallId || dash.id || "");
  if (!toolCallId) return items;
  const id = String(dash.id || `tool-${toolCallId}`);
  const next = {
    id,
    toolCallId,
    role: "tool",
    text: dash.content || "",
    toolName: dash.toolName,
    toolArgs: dash.args,
    toolStatus: dash.status || "running",
  };
  const index = items.findIndex((item) => String(item.toolCallId || item.id) === toolCallId || item.id === id);
  if (index < 0) return [...items, next];
  const copy = [...items];
  copy[index] = { ...copy[index], ...next, text: next.text || copy[index].text || "" };
  return copy;
}

function upsertActiveTool(items, dash) {
  const toolCallId = String(dash.toolCallId || dash.id || "");
  if (!toolCallId) return items;
  const next = { id: dash.id, toolCallId, toolName: dash.toolName, args: dash.args, status: dash.status || "running" };
  const index = items.findIndex((item) => item.toolCallId === toolCallId);
  if (index < 0) return [...items, next];
  const copy = [...items];
  copy[index] = { ...copy[index], ...next };
  return copy;
}
function chatDraftKey(workspaceDir, mode) {
  const ws = encodeURIComponent(workspaceDir || "default");
  const m3 = encodeURIComponent(mode || "general");
  return `visionox.chatDraft.v2:${ws}:${m3}`;
}
function removeChatDraft(key) {
  try {
    localStorage.removeItem(key);
    localStorage.removeItem(CHAT_DRAFT_KEY);
  } catch {
  }
}
function fileArtifactKind(ext) {
  const e3 = String(ext || "").replace(/^\./, "").toLowerCase();
  if (e3 === "md" || e3 === "markdown") return "Markdown 文档";
  if (e3 === "html" || e3 === "htm") return "HTML 页面";
  if (e3 === "pdf") return "PDF 文档";
  if (["doc", "docx"].includes(e3)) return "Word 文档";
  if (["ppt", "pptx"].includes(e3)) return "演示文稿";
  if (["xls", "xlsx"].includes(e3)) return "表格文档";
  if (e3 === "csv") return "CSV 表格";
  if (["json", "xml", "yaml", "yml"].includes(e3)) return "数据文件";
  if (FILE_ARTIFACT_SCRIPT_EXTS.has(e3)) return "脚本文件";
  if (["css", "sql", "ini", "toml", "txt"].includes(e3)) return "文本文件";
  return e3 ? `${e3.toUpperCase()} 文件` : "文件";
}
function fileArtifactExtOf(value) {
  const m3 = /\.([A-Za-z0-9]{1,12})(?:$|[?#\s，。；;、)）（\]`*_~])/.exec(String(value || ""));
  return m3 ? m3[1].toLowerCase() : "";
}
function pushFileArtifactCandidate(out, value) {
  const raw = String(value || "").trim().replace(/^["'“”‘’`*_~]+|["'“”‘’`*_~]+$/g, "");
  if (!raw || raw.length > 260) return;
  const ext = fileArtifactExtOf(raw);
  if (!FILE_ARTIFACT_EXTS.has(ext)) return;
  out.add(raw.replace(/[`*_~]+$/g, ""));
}
function extractFileArtifactCandidatesFromText(text, out) {
  const s3 = String(text || "");
  if (!s3) return;
  const extGroup = Array.from(FILE_ARTIFACT_EXTS).join("|");
  const quoted = new RegExp("[\"'“”‘’`]([^\"'“”‘’`\\r\\n]{1,220}\\.(" + extGroup + "))(?:[\"'“”‘’`]|$)", "gi");
  let m3;
  while ((m3 = quoted.exec(s3))) pushFileArtifactCandidate(out, m3[1]);
  const pathLike = new RegExp("((?:[A-Za-z]:\\\\|\\\\\\\\|/)[^\\r\\n\"'“”‘’`<>|]{1,220}\\.(" + extGroup + "))", "gi");
  while ((m3 = pathLike.exec(s3))) pushFileArtifactCandidate(out, m3[1].trim());
  const markdownWrapped = new RegExp("(?:^|[\\s：:,，。；;、])(?:\\*\\*|__|`|\\*)?([\\w\\u4e00-\\u9fff][\\w\\u4e00-\\u9fff ._()（）\\-]{0,120}\\.(" + extGroup + "))(?:\\*\\*|__|`|\\*)?(?=$|[\\s，。；;、)）（\\]])", "gi");
  while ((m3 = markdownWrapped.exec(s3))) pushFileArtifactCandidate(out, m3[1].trim());
  const bare = new RegExp("(?:^|[\\s：:,，。；;、])([\\w\\u4e00-\\u9fff][\\w\\u4e00-\\u9fff ._()（）\\-]{0,120}\\.(" + extGroup + "))(?=$|[\\s，。；;、)）（\\]`*_~])", "gi");
  while ((m3 = bare.exec(s3))) pushFileArtifactCandidate(out, m3[1].trim());
}
function latestTurnFileArtifactCandidates(messages) {
  return fileArtifactCandidatesForAssistant(messages, latestAssistantMessageId(messages));
}
function fileArtifactCandidatesForAssistant(messages, assistantId) {
  let assistantIndex = -1;
  if (assistantId) {
    assistantIndex = messages.findIndex((m3) => m3.role === "assistant" && String(m3.id || "") === String(assistantId));
  }
  if (assistantIndex < 0) {
    assistantIndex = messages.map((m3, i3) => [m3, i3]).reverse().find(([m3]) => m3.role === "assistant")?.[1] ?? -1;
  }
  if (assistantIndex < 0) return [];
  let start = 0;
  for (let i3 = assistantIndex - 1; i3 >= 0; i3--) {
    if (messages[i3]?.role === "user") {
      start = i3 + 1;
      break;
    }
  }
  const out = /* @__PURE__ */ new Set();
  const turn = messages.slice(start, assistantIndex + 1);
  for (const msg of turn) {
    extractFileArtifactCandidatesFromText(msg.text, out);
    if (msg.role === "tool") {
      const args = parseToolArgs(msg.toolArgs);
      for (const key of ["path", "filePath", "file_path", "filepath", "filename", "output", "outputPath", "reportPath"]) {
        if (typeof args?.[key] === "string") pushFileArtifactCandidate(out, args[key]);
      }
    }
  }
  return Array.from(out).slice(0, 20);
}
function latestAssistantMessageId(messages) {
  for (let i3 = messages.length - 1; i3 >= 0; i3--) {
    if (messages[i3]?.role === "assistant") return String(messages[i3].id || i3);
  }
  return "";
}
function fileArtifactGroupKey(files) {
  return files.map((f3) => f3.path).sort().join("|");
}
function mergeFileArtifacts(existing, incoming) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const file of [...(existing || []), ...(incoming || [])]) {
    if (!file?.path) continue;
    const key = String(file.path).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(file);
  }
  return out;
}
async function showFileArtifactPreview(file) {
  const res = await api("/artifacts/preview", { method: "POST", body: { path: file.path } });
  const ext = String(res.ext || file.ext || "").replace(/^\./, "").toLowerCase();
  showArtifactPreview({
    id: `file-${Date.now()}`,
    filename: res.filename || file.filename,
    path: res.path || file.path,
    dir: res.dir || file.dir,
    lang: ext === "md" ? "markdown" : ext,
    content: res.content || ""
  });
}
async function registerAndPreviewMarkdownDocument(path, cwd = "") {
  const file = await api("/artifacts/register-opened-document", {
    method: "POST",
    body: { path, cwd }
  });
  await showFileArtifactPreview(file);
  showToast(`已打开 ${file.filename || "Markdown 文档"}`, "info");
}
function cleanOpenedDocumentArg(value) {
  let raw = String(value || "").trim();
  raw = raw.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
  if (/^file:\/\//i.test(raw)) {
    try {
      raw = decodeURIComponent(raw.replace(/^file:\/\/\/?/i, navigator.platform?.toLowerCase?.().includes("win") ? "" : "/"));
    } catch {
    }
  }
  return raw;
}
function markdownDocumentArgs(args) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const value of Array.isArray(args) ? args : []) {
    const path = cleanOpenedDocumentArg(value);
    if (!path || path.startsWith("--")) continue;
    if (!/\.(md|markdown)(?:$|[?#])/i.test(path)) continue;
    const key = path.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(path);
  }
  return out;
}
async function openMarkdownDocumentFromArgs(args, cwd) {
  const docs = markdownDocumentArgs(args);
  if (docs.length === 0) return;
  const key = `${cwd || ""}\n${docs.join("\n")}`;
  const now = Date.now();
  const last = window.__visionoxLastOpenedDocumentArgs;
  if (last?.key === key && now - last.ts < 3e3) return;
  window.__visionoxLastOpenedDocumentArgs = { key, ts: now };
  try {
    await registerAndPreviewMarkdownDocument(docs[0], cwd || "");
  } catch (err) {
    showToast(err.message || "Markdown 文档打开失败", "error", 5e3);
  }
}
var MARKDOWN_DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;
function selectMarkdownDocumentFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".md,.markdown,text/markdown,text/plain";
    input.style.position = "fixed";
    input.style.left = "-10000px";
    input.style.top = "0";
    input.style.width = "1px";
    input.style.height = "1px";
    input.style.opacity = "0";
    const cleanup = () => {
      input.remove();
    };
    input.addEventListener("change", () => {
      const file = input.files?.[0] || null;
      cleanup();
      resolve(file);
    }, { once: true });
    input.addEventListener("cancel", () => {
      cleanup();
      resolve(null);
    }, { once: true });
    try {
      document.body.appendChild(input);
      input.click();
    } catch (err) {
      cleanup();
      reject(err);
    }
  });
}
async function previewSelectedMarkdownDocument(file) {
  if (!file) return;
  const filename = file.name || "Markdown 文档.md";
  if (!/\.(md|markdown)$/i.test(filename)) {
    throw new Error("请选择 Markdown 文档");
  }
  if (file.size > MARKDOWN_DOCUMENT_MAX_BYTES) {
    throw new Error(`文件过大，最大支持 ${Math.round(MARKDOWN_DOCUMENT_MAX_BYTES / 1024 / 1024)}MB`);
  }
  const content = await file.text();
  showArtifactPreview({
    id: `opened-markdown-${Date.now().toString(36)}`,
    lang: "markdown",
    ext: filename.toLowerCase().endsWith(".markdown") ? "markdown" : "md",
    label: "MD",
    filename,
    content,
    previewable: true,
    openable: false
  });
  showToast(`已打开 ${filename}`, "info");
}
function pickMarkdownFileFromBridge() {
  return api("/artifacts/pick-markdown-file", { method: "POST", body: {}, timeoutMs: 0 }).then((result) => result?.path || "").catch((apiErr) => {
  if (window.__TAURI__?.invoke) {
    return window.__TAURI__.invoke("pick_markdown_file").then((result) => {
      if (result?.error) throw new Error(result.error);
      return result?.path || "";
    });
  }
  return new Promise((resolve, reject) => {
    if (!window.parent || window.parent === window) {
      reject(new Error("本地文件选择器仅在桌面端可用"));
      return;
    }
    const requestId = `md-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const timer = setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error("文件选择器响应超时"));
    }, 5 * 60 * 1e3);
    function onMessage(event) {
      const data = event.data;
      if (!data || data.type !== "vis_pick_markdown_file_result") return;
      if (data.requestId && data.requestId !== requestId) return;
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      if (data.error) {
        reject(new Error(data.error));
        return;
      }
      resolve(data.path || "");
    }
    window.addEventListener("message", onMessage);
    try {
      window.parent.postMessage({ type: "vis_pick_markdown_file", requestId }, "*");
    } catch (err) {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      reject(err);
    }
  });
  });
}
function documentJobStatusLabel(status) {
  return {
    queued: "排队中",
    running: "处理中",
    waiting_foreground: "等待前台对话",
    waiting_provider: "等待其他模型任务",
    pausing: "正在暂停",
    paused: "已暂停",
    interrupted: "可继续",
    stopped: "已停止，可继续",
    abandoned: "已放弃",
    source_changed: "来源已变化",
    awaiting_output: "内容已完成，等待交付",
    completed: "已完成",
    completed_with_warnings: "已完成，需复核",
    failed: "失败",
    cancelled: "已取消"
  }[status] || status || "未知";
}
function backgroundJobNeedsAttention(job) {
  return job?.needsAttention === true
    || ["waiting_user", "blocked", "paused"].includes(job?.lifecycle)
    || ["delivered_with_warnings", "partial", "failed"].includes(job?.outcome)
    || ["queued", "running", "waiting_conversation", "needs_user", "user_paused"].includes(job?.handoff?.state);
}
function backgroundJobIsActive(job) {
  return job?.active === true || job?.running === true;
}
function backgroundJobGroup(job) {
  if (backgroundJobIsActive(job)) return "active";
  if (backgroundJobNeedsAttention(job)) return "attention";
  return "completed";
}
function backgroundJobGroups(jobs) {
  const values = Array.isArray(jobs) ? jobs : [];
  return [
    { key: "active", label: "运行中" },
    { key: "attention", label: "需要处理" },
    { key: "completed", label: "已完成" }
  ].map((group) => ({ ...group, jobs: values.filter((job) => backgroundJobGroup(job) === group.key) })).filter((group) => group.jobs.length > 0);
}
function isGenericBackgroundTask(job) {
  return String(job?.id ?? "").startsWith("task:");
}
function backgroundJobTitle(job) {
  return job?.goal || job?.command || job?.sourceName || `#${job?.id || "未知任务"}`;
}
function genericTaskLifecycleLabel(lifecycle) {
  return {
    created: "已创建",
    queued: "排队中",
    leased: "已领取",
    running: "处理中",
    assembling: "正在装配",
    paused: "已暂停",
    waiting_user: "等待用户处理",
    blocked: "受阻",
    terminal: "已结束"
  }[lifecycle] || lifecycle || "未知状态";
}
function genericTaskOutcomeLabel(outcome) {
  return {
    delivered: "已交付",
    delivered_with_warnings: "已交付，需复核",
    partial: "部分交付",
    failed: "失败",
    cancelled: "已取消"
  }[outcome] || outcome || "尚无结果";
}
function genericTaskQualityLabel(quality) {
  return {
    verified: "已验证",
    needs_review: "需复核",
    unknown: "未评估"
  }[quality] || quality || "未评估";
}
function genericTaskProgressLabel(job) {
  const progress = job?.progress || {};
  const completed = progress.completedUnits ?? progress.completed;
  const total = progress.totalUnits ?? progress.total;
  const unit = progress.unitLabel || "单元";
  if (Number.isFinite(completed) && Number.isFinite(total) && total > 0) return `${completed}/${total} ${unit}`;
  if (Number.isFinite(completed)) return `已完成 ${completed} ${unit}`;
  return progress.label || progress.currentLabel || genericTaskLifecycleLabel(job?.lifecycle);
}
function genericTaskProgressPercent(job) {
  const progress = job?.progress || {};
  if (Number.isFinite(progress.percent)) return Math.max(0, Math.min(100, progress.percent));
  const completed = Number(progress.completedUnits ?? progress.completed);
  const total = Number(progress.totalUnits ?? progress.total);
  return Number.isFinite(completed) && Number.isFinite(total) && total > 0 ? Math.max(0, Math.min(100, completed / total * 100)) : 0;
}
var GENERIC_TASK_ACTION_LABELS = new Map([
  ["pause", "暂停"],
  ["resume", "继续"],
  ["retry", "重试"],
  ["retry_delivery", "确认后重新交付"],
  ["cancel", "取消任务"],
  ["resolve_user_input", "提交处理结果"],
  ["retarget_output", "更改输出位置"],
  ["ack_outcome", "确认结果"],
  ["delete_record", "删除记录"]
]);
function genericTaskActionLabel(action) {
  return GENERIC_TASK_ACTION_LABELS.get(action) || action;
}
function genericTaskArtifactLabel(artifact, index) {
  return artifact?.filename || artifact?.name || artifact?.label || artifact?.path || artifact?.artifactId || `产物 ${index + 1}`;
}
function backgroundActionRequestId() {
  return globalThis.crypto?.randomUUID?.() || `background-action-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function documentHandoffNotice(job) {
  const state = job?.handoff?.state;
  return {
    queued: { tone: "warn", text: "后台处理已经结束，正在等待 AI 接管并继续交付。" },
    running: { tone: "warn", text: "AI 已接管后台结果，正在核实产物并继续处理。" },
    waiting_conversation: { tone: "warn", text: "任务属于另一个会话。返回发起任务的原会话后，AI 会自动继续处理。" },
    needs_user: { tone: "err", text: `AI 自动接管未完成：${job?.handoff?.lastError || "请检查模型配置后继续处理。"}。确认后可仅重新交付已有结果，不会重新处理文档。` },
    user_paused: { tone: "warn", text: "任务由用户暂停，点击“继续”后才会恢复。" },
    legacy_unassigned: { tone: "warn", text: "这是旧版本创建的任务，无法安全关联到原会话；请在后台面板中手动点击“继续”或“重试”。" }
  }[state] || null;
}
function retryDocumentDelivery(job) {
  return job?.kind === "document"
    && ["completed", "completed_with_warnings", "failed", "interrupted", "paused", "awaiting_output"].includes(job?.status)
    && job?.handoff?.state === "needs_user";
}
function documentJobStageLabel(stage) {
  return {
    extracting: "正在读取来源内容",
    "selecting-model": "正在选择可用模型",
    draft: "正在整理当前区块",
    "quality-repair": "正在补全当前区块",
    "quality-review": "正在审校当前区块",
    "batch-complete": "当前区块已保存",
    assembling: "正在组装完整文档",
    summary: "正在生成摘要",
    completed: "文档已经完成",
    failed: "任务执行失败",
    cancelled: "任务已取消",
    stopped: "已停止，检查点已保留",
    abandoned: "任务已放弃",
    "source-changed": "来源已变化",
    "awaiting-output": "最终草稿已保存，等待处理输出路径",
    "waiting-provider": "等待其他模型任务",
    "job-timeout": "本次执行总时限已到",
    "job-call-budget": "本次执行调用预算已用尽"
  }[stage] || "";
}
function documentJobProgressLabel(job) {
  const progress = job?.progress || {};
  const unit = progress.unitLabel || "区块";
  if (progress.total) return `${progress.completed}/${progress.total} ${unit}`;
  if (progress.completed) return `已完成 ${progress.completed} ${unit}`;
  return documentJobStageLabel(progress.stage) || "正在准备文档";
}
function documentRetryLabel(modelIssues) {
  const issues = Array.isArray(modelIssues) ? modelIssues : [];
  if (issues.some((issue) => issue.category === "insufficient_balance" || issue.category === "quota_exhausted")) return "余额/额度处理后重试";
  if (issues.some((issue) => issue.requiresUserAction === true)) return "处理模型问题后重试";
  return "重试失败部分";
}
function documentIssueBatchLabel(issue) {
  const batches = Array.isArray(issue?.affectedBatches) ? issue.affectedBatches : [];
  if (batches.length === 0) return "任务级模型调用";
  const labels = batches.slice(0, 6).map((batch) => batch.label || batch.id).filter(Boolean);
  return `${labels.join("、")}${batches.length > labels.length ? "等" : ""}`;
}
var BackgroundJobsWorkbench = N2(function BackgroundJobsWorkbench2({ jobs, pendingDeliveries, selectedId, detail, onSelect, onClose, onControl, onStop, onAbandon, onDelete, onPreview }) {
  const deliveries = Array.isArray(pendingDeliveries) ? pendingDeliveries : [];
  const deliveryTaskIds = new Set(deliveries.map((delivery) => String(delivery?.taskId ?? "")).filter(Boolean));
  const displayJobs = jobs.map((job) => deliveryTaskIds.has(String(job.id)) ? { ...job, needsAttention: true } : job);
  const detailMatchesSelection = detail && String(detail.id ?? "") === String(selectedId ?? "");
  const selected = detailMatchesSelection ? detail : displayJobs.find((job) => job.id === selectedId) || null;
  const groups = backgroundJobGroups(displayJobs);
  const isDocument = selected?.kind === "document";
  const isGenericTask = isGenericBackgroundTask(selected);
  const progress = selected?.progress || {};
  const sourcePaths = Array.isArray(selected?.sourcePaths) ? selected.sourcePaths : [];
  const criteria = Array.isArray(selected?.contract?.completionCriteria) ? selected.contract.completionCriteria : [];
  const modelHistory = Array.isArray(selected?.modelHistory) ? selected.modelHistory : [];
  const events = Array.isArray(selected?.events) ? selected.events.slice(-30).reverse() : [];
  const preview = selected?.preview?.content ? String(selected.preview.content).slice(0, 120000) : "";
  const modelIssues = Array.isArray(selected?.modelIssues) ? selected.modelIssues : [];
  const reviewWarnings = (Array.isArray(selected?.warnings) ? selected.warnings : []).filter((warning) => warning?.type !== "model-service-issue");
  const handoffNotice = documentHandoffNotice(selected);
  const deliveryRetryable = retryDocumentDelivery(selected);
  const showReviewReasons = selected?.status === "completed_with_warnings" || selected?.status === "failed" || selected?.qualityPassed === false;
  const resumable = ["paused", "interrupted", "stopped", "source_changed", "awaiting_output"].includes(selected?.status) || ["missing", "modified"].includes(selected?.artifactStatus) && Boolean(selected?.finalDraft);
  const active = selected?.running || ["queued", "waiting_foreground", "pausing"].includes(selected?.status);
  const handoffActive = ["queued", "running"].includes(selected?.handoff?.state);
  const abandonable = active || ["paused", "interrupted", "stopped", "failed", "source_changed"].includes(selected?.status);
  const deletable = isDocument && !active && !handoffActive && !selected?.running;
  const genericAllowedActions = Array.isArray(selected?.allowedActions) ? selected.allowedActions.filter((action) => GENERIC_TASK_ACTION_LABELS.has(action)) : [];
  const genericArtifacts = Array.isArray(selected?.artifactRefs) ? selected.artifactRefs : [];
  const genericWarnings = [
    ...(Array.isArray(selected?.warnings) ? selected.warnings : []),
    ...(Array.isArray(selected?.issues) ? selected.issues : [])
  ];
  const genericUserAction = selected?.userAction;
  const genericUserActionText = typeof genericUserAction === "string"
    ? genericUserAction
    : genericUserAction?.question || genericUserAction?.message || genericUserAction?.prompt || genericUserAction?.label || "任务需要你的补充信息后才能继续。";
  const genericOutcomeSummary = typeof selected?.outcomeSummary === "string" ? selected.outcomeSummary.trim() : "";
  const genericBlockingReason = selected?.blockingReason;
  const genericBlockingReasonText = typeof genericBlockingReason === "string"
    ? genericBlockingReason
    : genericBlockingReason?.message || genericBlockingReason?.reason || genericBlockingReason?.code || "";
  const genericBlockingReasonCode = typeof genericBlockingReason === "object" && genericBlockingReason?.code
    ? String(genericBlockingReason.code)
    : "";
  const genericUserInputRequestId = genericUserAction?.requestId || selected?.userInputRequest?.requestId || null;
  const selectedDeliveries = deliveries.filter((delivery) => String(delivery?.taskId ?? "") === String(selected?.id ?? ""));
  const selectedDelivery = selectedDeliveries.find((delivery) => delivery?.target === "task-center")
    || selectedDeliveries.find((delivery) => delivery?.target === "conversation")
    || selectedDeliveries[0]
    || null;
  const conversationDelivery = selectedDeliveries.find((delivery) => delivery?.target === "conversation") || null;
  const genericDeliveryStates = selectedDeliveries.filter((delivery) => delivery?.deliveryState);
  const runGenericAction = (action) => {
    if (!selected) return;
    if (["cancel", "delete_record"].includes(action) && !confirm(action === "cancel" ? "确定取消这个任务？已保存的检查点和产物不会被删除。" : "确定删除这条任务记录？已经交付的产物不会被删除。")) return;
    let payload = null;
    if (action === "resolve_user_input") {
      const options = Array.isArray(genericUserAction?.choices)
        ? genericUserAction.choices
        : Array.isArray(genericUserAction?.options) ? genericUserAction.options : [];
      const optionText = options.map((option, index) => `${index + 1}. ${option?.label || option?.value || option?.id || option}`).join("\n");
      const value = prompt(`${genericUserActionText}${optionText ? `\n\n${optionText}` : ""}`, "");
      if (value === null) return;
      const normalizedValue = value.trim();
      const indexedOption = /^[1-9]\d*$/.test(normalizedValue) ? options[Number(normalizedValue) - 1] : null;
      const matchedOption = indexedOption ?? options.find((option) => {
        const candidates = typeof option === "string"
          ? [option]
          : [option?.id, option?.choiceId, option?.value, option?.label];
        return candidates.some((candidate) => String(candidate ?? "").trim() === normalizedValue);
      });
      const choiceId = typeof matchedOption === "string"
        ? matchedOption.trim()
        : String(matchedOption?.id ?? matchedOption?.choiceId ?? matchedOption?.value ?? "").trim();
      payload = {
        ...(choiceId ? { choiceId } : { value: normalizedValue }),
        ...(genericUserInputRequestId ? { requestId: genericUserInputRequestId } : {})
      };
    }
    if (action === "retarget_output") {
      const path = prompt("请输入新的输出文件完整路径", selected.outputPath || "");
      if (path === null || !path.trim()) return;
      payload = { path: path.trim(), ...(genericUserInputRequestId ? { requestId: genericUserInputRequestId } : {}) };
    }
    if (action === "ack_outcome") {
      if (!selectedDelivery?.deliveryId || !selectedDelivery?.target) return;
      payload = { deliveryId: selectedDelivery.deliveryId, consumer: selectedDelivery?.target };
    }
    if (action === "retry_delivery") {
      if (!conversationDelivery?.deliveryId) return;
      if (!confirm("上一次对话交付结果不确定，重新交付可能产生重复回复。是否确认继续？")) return;
      payload = { deliveryId: conversationDelivery.deliveryId, consumer: "conversation" };
    }
    onControl(selected.id, action, payload);
  };
  const modelCaption = selected?.model
    ? `${selected.running ? "当前模型" : "最近使用模型"} · ${selected.model}${selected.modelRole === "fallback" ? "（备用候选）" : ""}`
    : "尚未开始模型调用";
  const retryLabel = documentRetryLabel(modelIssues);
  return html4`
    <section class="background-jobs-workbench" style="flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:var(--surface-default);border-top:1px solid var(--border-default)">
      <header class="background-jobs-header">
        <div class="background-jobs-heading"><strong>后台任务</strong><span class="meta">运行中 ${displayJobs.filter((job) => backgroundJobGroup(job) === "active").length} · 待处理 ${displayJobs.filter((job) => backgroundJobGroup(job) === "attention").length} · 共 ${displayJobs.length}${deliveries.length > 0 ? ` · 待确认通知 ${deliveries.length}` : ""}</span></div>
        <button type="button" class="background-jobs-close" onClick=${onClose} title="返回对话（Esc）" aria-label="返回对话"><span aria-hidden="true">←</span><span>返回对话</span></button>
      </header>
      <div class="background-jobs-layout">
        <nav class="background-jobs-list">
          ${displayJobs.length === 0 ? html4`<div class="meta" style="padding:18px">当前没有后台任务</div>` : groups.map((group) => html4`
            <section class="background-job-group" aria-label=${group.label}>
              <div class="background-job-group-title"><span>${group.label}</span><span>${group.jobs.length}</span></div>
              ${group.jobs.map((job) => html4`
                <button type="button" class=${`background-job-list-item ${job.id === selected?.id ? "selected" : ""}`} onClick=${() => onSelect(job.id)}>
                  <div class="background-job-list-heading"><span class=${`pill ${backgroundJobIsActive(job) ? "info" : backgroundJobNeedsAttention(job) ? "warn" : job.status === "completed" || job.outcome === "delivered" ? "ok" : ""}`}>${job.kind === "document" || job.taskType === "document" ? "文档" : job.lifecycle === "service" ? "服务" : "任务"}</span><span class="name">${backgroundJobTitle(job)}</span></div>
                  <div class="meta background-job-list-meta"><span>${isGenericBackgroundTask(job) ? genericTaskLifecycleLabel(job.lifecycle) : job.kind === "document" ? documentJobStatusLabel(job.status) : job.running ? "运行中" : `exit ${job.exitCode ?? "?"}`}</span><span>${isGenericBackgroundTask(job) ? genericTaskProgressLabel(job) : job.kind === "document" ? documentJobProgressLabel(job) : ""}</span></div>
                </button>
              `)}
            </section>
          `)}
        </nav>
        <main class="background-jobs-detail">
          ${!selected ? html4`<div class="meta">选择左侧任务查看详情</div>` : isGenericTask ? html4`
            <div class="background-task-detail-head">
              <div style="min-width:0;flex:1"><h3>${backgroundJobTitle(selected)}</h3><div class="meta">${selected.id} · ${genericTaskLifecycleLabel(selected.lifecycle)} · ${genericTaskOutcomeLabel(selected.outcome)} · ${genericTaskQualityLabel(selected.quality)}</div></div>
              <div class="background-task-actions">
                ${genericAllowedActions.map((action) => html4`<button type="button" class=${action === "resume" ? "primary" : action === "cancel" || action === "delete_record" ? "danger" : ""} onClick=${() => runGenericAction(action)}>${genericTaskActionLabel(action)}</button>`)}
              </div>
            </div>
            <div class="background-task-progress"><div style=${`width:${genericTaskProgressPercent(selected)}%`}></div></div>
            <div class="meta background-task-facts"><span>${genericTaskProgressLabel(selected)}</span><span>修订 ${selected.revision ?? 0}</span>${selected.executionEpoch ? html4`<span>执行轮次 ${selected.executionEpoch}</span>` : null}</div>
            ${genericOutcomeSummary ? html4`<div class="notice background-task-outcome-summary"><strong>结果摘要</strong><div>${genericOutcomeSummary}</div></div>` : null}
            ${genericBlockingReasonText ? html4`<div class="notice warn background-task-blocking-reason"><strong>阻塞原因</strong><div>${genericBlockingReasonText}${genericBlockingReasonCode && genericBlockingReasonCode !== genericBlockingReasonText ? html4` <span class="meta">(${genericBlockingReasonCode})</span>` : null}</div></div>` : null}
            ${selected.userAction ? html4`<div class="notice warn background-task-user-action"><strong>需要你的处理</strong><div>${genericUserActionText}</div></div>` : null}
            ${genericDeliveryStates.length > 0 ? html4`<section class="background-task-section"><h4>交付状态</h4>${genericDeliveryStates.map((delivery) => {
    const deliveryState = delivery.deliveryState || {};
    const deliveryMessage = deliveryState.lastError || deliveryState.reason || deliveryState.code || "等待交付确认";
    const deliveryCode = deliveryState.code && deliveryState.code !== deliveryMessage ? deliveryState.code : "";
    return html4`<div class=${`notice ${["blocked_user_retry", "exhausted"].includes(deliveryState.status) ? "err" : "warn"}`}><strong>${delivery.target === "conversation" ? "对话" : "任务中心"}交付 · ${deliveryState.status || "等待中"}</strong><div>${deliveryMessage}${deliveryCode ? html4` <span class="meta">(${deliveryCode})</span>` : null}</div></div>`;
  })}</section>` : null}
            ${genericWarnings.length > 0 ? html4`<section class="background-task-section"><h4>需要留意</h4>${genericWarnings.map((warning) => html4`<div class="notice ${warning?.severity === "error" ? "err" : "warn"}">${warning?.message || warning?.detail || warning}</div>`)}</section>` : null}
            <section class="background-task-section"><h4>产物</h4>${genericArtifacts.length === 0 ? html4`<div class="meta">暂未生成产物</div>` : html4`<ul class="background-task-artifacts">${genericArtifacts.map((artifact, index) => html4`<li><span title=${artifact?.path || ""}>${genericTaskArtifactLabel(artifact, index)}</span>${artifact?.path ? html4`<button type="button" onClick=${() => onPreview(selected, artifact)}>预览</button>` : null}</li>`)}</ul>`}</section>
            ${selected.coverage ? html4`<section class="background-task-section"><h4>覆盖情况</h4><div class="meta">${typeof selected.coverage === "string" ? selected.coverage : JSON.stringify(selected.coverage)}</div></section>` : null}
          ` : !isDocument ? html4`
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px"><div><h3 style="margin:0 0 6px;font-size:15px">${selected.command}</h3><div class="meta">${selected.running ? "正在运行" : `已结束 · exit ${selected.exitCode ?? "?"}`}</div></div>${selected.running ? html4`<button type="button" onClick=${() => onStop(selected.id)}>停止</button>` : null}</div>
          ` : html4`
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap">
              <div style="min-width:0;flex:1"><h3 style="margin:0 0 5px;font-size:16px;overflow-wrap:anywhere">${selected.command}</h3><div class="meta">${documentJobStatusLabel(selected.status)} · ${documentJobStageLabel(progress.stage) || "等待下一步"}</div></div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
                ${selected.running && !selected.paused ? html4`<button type="button" onClick=${() => onControl(selected.id, "pause")}>暂停</button>` : null}
                ${resumable ? html4`<button type="button" class="primary" onClick=${() => onControl(selected.id, "resume")}>${selected.artifactStatus === "modified" ? "另存后台草稿" : selected.artifactStatus === "missing" ? "恢复最终文件" : selected.status === "awaiting_output" ? "提交已保存草稿" : "继续"}</button>` : null}
                ${["completed_with_warnings", "failed"].includes(selected.status) ? html4`<button type="button" title=${modelIssues.find((issue) => issue.requiresUserAction)?.action || "重试失败部分"} onClick=${() => onControl(selected.id, "retry")}>${retryLabel}</button>` : null}
                ${deliveryRetryable ? html4`<button type="button" title="只重新交付已有结果，不会重新处理文档" onClick=${() => { if (confirm("只重新交付已有结果，不会重新处理文档。可能产生重复回复，是否继续？")) onControl(selected.id, "retry_delivery"); }}>仅重新交付</button>` : null}
                ${active ? html4`<button type="button" onClick=${() => onStop(selected.id)}>立即停止</button>` : null}
                ${abandonable ? html4`<button type="button" onClick=${() => { if (confirm("放弃任务会终止后续处理，但保留任务记录和已保存草稿。确定继续？")) onAbandon(selected.id); }}>放弃</button>` : null}
                ${selected.previewAvailable || ["completed", "completed_with_warnings"].includes(selected.status) ? html4`<button type="button" onClick=${() => onPreview(selected)}>预览产物</button>` : null}
                ${deletable ? html4`<button type="button" onClick=${() => { if (confirm("仅删除任务记录和中间草稿；源文件及已经生成的最终产物不会删除。确定继续？")) onDelete(selected.id); }}>删除记录</button>` : null}
              </div>
            </div>
            <div style="height:6px;background:var(--border-subtle);overflow:hidden;margin:16px 0 8px"><div style=${`height:100%;width:${progress.percent ?? 0}%;background:${selected.qualityPassed === false ? "var(--color-warning)" : "var(--accent-primary)"}`}></div></div>
            <div class="meta" style="display:flex;gap:18px;flex-wrap:wrap"><span>${documentJobProgressLabel(selected)}</span><span>累计模型调用 ${progress.taskModelCalls || 0} 次 · 本次执行 ${progress.executionModelCalls || 0} / ${progress.taskModelCallLimit || "—"} 次</span><span>${modelCaption}</span>${progress.currentLabel ? html4`<span title=${progress.currentLabel}>当前区块 · ${progress.currentLabel}</span>` : null}</div>
            ${handoffNotice ? html4`<div class=${`notice ${handoffNotice.tone}`} style="margin-top:12px">${handoffNotice.text}</div>` : null}
            ${selected.status === "awaiting_output" ? html4`<div class="notice warn" style="margin-top:12px"><strong>内容整理和最终草稿已经完成。</strong><div style="margin-top:4px">点击“提交已保存草稿”即可继续；若同名文件仍被占用，程序会自动使用新文件名，且不会再次调用模型。</div></div>` : null}
            ${selected.artifactStatus === "missing" ? html4`<div class="notice err" style="margin-top:12px"><strong>最终输出文件已不存在。</strong><div style="margin-top:4px">任务记录和后台保存的最终草稿仍在，可以点击“继续”尝试恢复交付。</div></div>` : null}
            ${selected.artifactStatus === "modified" ? html4`<div class="notice warn" style="margin-top:12px"><strong>最终输出文件已被修改。</strong><div style="margin-top:4px">当前文件与任务完成时保存的草稿不一致。点击“另存后台草稿”会保留当前文件，并把已验证草稿保存为新文件。</div></div>` : null}
            ${selected.status === "completed_with_warnings" ? html4`<div class="notice warn" style="margin-top:12px"><strong>任务已经结束，输出文件已生成。</strong><div style="margin-top:4px">部分区块未通过完整质量审查，请根据下方原因处理后复核或重试。</div></div>` : null}
            ${selected.error ? html4`<div class="notice err" style="margin-top:12px">${selected.error}</div>` : null}
            ${showReviewReasons && (reviewWarnings.length > 0 || modelIssues.length > 0) ? html4`
              <section style="margin-top:18px">
                <h4 style="font-size:13px;margin:0 0 8px">需要复核的原因</h4>
                ${reviewWarnings.map((warning) => html4`<div class="notice warn" style="margin:0 0 8px">${warning.message || "部分内容需要复核。"}</div>`)}
                ${modelIssues.map((issue) => html4`
                  <div class="notice warn" style="margin:0 0 8px">
                    <div><strong>${issue.providerId || "未知服务商"}/${issue.modelId || "未知模型"}</strong> · ${issue.message || "模型调用失败"}</div>
                    <div class="meta" style="margin-top:5px">影响区块 · ${documentIssueBatchLabel(issue)}</div>
                    ${issue.action ? html4`<div style="margin-top:5px">建议：${issue.action}</div>` : null}
                    ${Array.isArray(issue.technicalMessages) && issue.technicalMessages.length > 0 ? html4`<details style="margin-top:6px"><summary class="meta" style="cursor:pointer">技术信息</summary><div class="meta" style="margin-top:5px;overflow-wrap:anywhere">${issue.technicalMessages.join("；")}</div></details>` : null}
                  </div>
                `)}
              </section>
            ` : null}
            <section style="margin-top:18px"><h4 style="font-size:13px;margin:0 0 8px">来源与产物</h4><div class="meta" style="overflow-wrap:anywhere">输出 · ${selected.outputPath || "尚未确定"}</div>${sourcePaths.length > 0 ? html4`<ol style="margin:8px 0 0;padding-left:22px">${sourcePaths.map((path) => html4`<li style="font-size:12px;line-height:1.6;overflow-wrap:anywhere">${path}</li>`)}</ol>` : null}</section>
            ${criteria.length > 0 ? html4`<section style="margin-top:18px"><h4 style="font-size:13px;margin:0 0 8px">完成条件</h4><ul style="margin:0;padding-left:20px">${criteria.map((item) => html4`<li style="font-size:12px;line-height:1.6">${item}</li>`)}</ul></section>` : null}
            ${modelHistory.length > 0 ? html4`<section style="margin-top:18px"><h4 style="font-size:13px;margin:0 0 8px">模型调用链</h4><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th style="text-align:left;padding:6px;border-bottom:1px solid var(--border-default)">模型</th><th style="text-align:left;padding:6px;border-bottom:1px solid var(--border-default)">角色</th><th style="text-align:left;padding:6px;border-bottom:1px solid var(--border-default)">结果</th><th style="text-align:left;padding:6px;border-bottom:1px solid var(--border-default)">调用</th></tr></thead><tbody>${modelHistory.slice(-50).map((entry) => html4`<tr><td style="padding:6px;border-bottom:1px solid var(--border-subtle)">${entry.providerId}/${entry.modelId}</td><td style="padding:6px;border-bottom:1px solid var(--border-subtle)">${entry.role === "fallback" ? "备用" : "主模型"}</td><td style="padding:6px;border-bottom:1px solid var(--border-subtle)">${entry.passed ? "通过" : "未通过"}</td><td style="padding:6px;border-bottom:1px solid var(--border-subtle)">${entry.attempts || 0}</td></tr>`)}</tbody></table></div></section>` : null}
            ${preview ? html4`<section style="margin-top:18px"><h4 style="font-size:13px;margin:0 0 8px">已保存草稿预览${selected.preview?.partial ? "（处理中）" : ""}</h4><pre style="margin:0;max-height:360px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;padding:12px;background:var(--surface-subtle);border:1px solid var(--border-default);font-size:12px;line-height:1.55">${preview}${String(selected.preview.content).length > preview.length ? "\n\n[预览过长，已在工作台截断显示]" : ""}</pre></section>` : null}
            ${events.length > 0 ? html4`<section style="margin-top:18px"><h4 style="font-size:13px;margin:0 0 8px">最近事件</h4>${events.map((event) => html4`<div class="meta" style="display:grid;grid-template-columns:150px minmax(0,1fr);gap:8px;padding:5px 0;border-bottom:1px solid var(--border-subtle)"><span>${event.at ? new Date(event.at).toLocaleString() : ""}</span><span style="overflow-wrap:anywhere">${event.type || "event"}${event.batchId ? ` · ${event.batchId}` : ""}${event.error ? ` · ${event.error}` : ""}</span></div>`)}</section>` : null}
          `}
        </main>
      </div>
    </section>
  `;
});
function pickWorkspaceDirectoryFromBridge() {
  if (window.__TAURI__?.invoke) {
    return window.__TAURI__.invoke("pick_directory").then((result) => {
      if (result?.error) throw new Error(result.error);
      return result?.path || "";
    });
  }
  return new Promise((resolve, reject) => {
    if (!window.parent || window.parent === window) {
      reject(new Error("本地目录选择器仅在桌面端可用"));
      return;
    }
    const requestId = `workspace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const timer = setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error("目录选择器响应超时"));
    }, 5 * 60 * 1e3);
    function onMessage(event) {
      const data = event.data;
      if (!data || data.type !== "vis_pick_directory_result" || data.requestId !== requestId) return;
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      if (data.error) reject(new Error(data.error));
      else resolve(data.path || "");
    }
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "vis_pick_directory", requestId }, "*");
  });
}
async function openMarkdownDocumentByPicker() {
  try {
    showToast("请选择 Markdown 文档...", "info", 1500);
    try {
      const path = await pickMarkdownFileFromBridge();
      if (!path) return;
      await registerAndPreviewMarkdownDocument(path);
      return;
    } catch (pickerErr) {
      if (typeof document === "undefined") throw pickerErr;
      const file = await selectMarkdownDocumentFile();
      if (!file) return;
      await previewSelectedMarkdownDocument(file);
      return;
    }
  } catch (err) {
    showToast(err.message || "Markdown 文档打开失败", "error", 5e3);
  }
}
window.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "vis_open_args") return;
  openMarkdownDocumentFromArgs(data.args, data.cwd);
});
function FileArtifactsCard({ files, selected, onFollowLatest, onDismiss }) {
  useLang();
  if (!files || files.length === 0) return null;
  const visible = files.slice(0, 12);
  const more = files.length - visible.length;
  const groups = [];
  for (const file of visible) {
    const dir = file.dir || "";
    let group = groups.find((item) => item.dir === dir);
    if (!group) {
      group = { dir, files: [] };
      groups.push(group);
    }
    group.files.push(file);
  }
  const action = async (kind, file) => {
    try {
      if (kind === "preview") {
        await showFileArtifactPreview(file);
      } else if (kind === "open") {
        if (!await confirmExternalArtifactOpen(file)) return;
        await api("/artifacts/open-file", { method: "POST", body: { path: file.path } });
      } else if (kind === "folder") {
        if (!await confirmExternalArtifactOpen(file)) return;
        await api("/artifacts/open-folder", { method: "POST", body: { path: file.path } });
      } else if (kind === "copy") {
        await writeClipboardText(file.path);
        showToast("路径已复制", "info");
      }
    } catch (err) {
      showToast(err.message || "文件操作失败", "error", 5e3);
    }
  };
  return html4`
    <div class="rail-card file-artifact-card">
      <div class="rh">
        <span>${selected ? "当前回复文件" : "最新生成文件"}</span>
        ${selected ? html4`<button type="button" class="rail-card-link" onClick=${onFollowLatest}>回到最新</button>` : null}
        <button type="button" class="rail-card-close" onClick=${onDismiss} title="隐藏">×</button>
      </div>
      <div class="file-artifact-summary">检测到 ${files.length} 个可操作文件${groups.length > 1 ? ` · ${groups.length} 个文件夹` : ""}</div>
      <div class="file-artifact-list">
        ${groups.map((group) => html4`
          <div class="file-artifact-group" key=${group.dir || "root"}>
            ${groups.length > 1 ? html4`<div class="file-artifact-dir" title=${group.dir}>${group.dir || "当前目录"}</div>` : null}
            ${group.files.map((file) => {
    const ext = String(file.ext || "").replace(/^\./, "").toLowerCase();
    const canPreview = file.previewable || FILE_ARTIFACT_PREVIEW_EXTS.has(ext);
    const canOpen = !canPreview && file.openable !== false && !FILE_ARTIFACT_SCRIPT_EXTS.has(ext);
    return html4`
            <div class="file-artifact-item" key=${file.path}>
              <div class="file-artifact-name" title=${file.path}>${file.filename}</div>
              <div class="file-artifact-meta">${fileArtifactKind(ext)}${file.size ? ` · ${fmtBytes(file.size)}` : ""}</div>
              <div class="file-artifact-actions">
                ${canPreview ? html4`<button type="button" onClick=${() => action("preview", file)}>查看</button>` : null}
                ${canOpen ? html4`<button type="button" onClick=${() => action("open", file)}>打开</button>` : null}
                <button type="button" onClick=${() => action("folder", file)}>所在文件夹</button>
                <button type="button" onClick=${() => action("copy", file)}>复制路径</button>
              </div>
            </div>
          `;
  })}
          </div>
        `)}
      </div>
      ${more > 0 ? html4`<div class="file-artifact-more">还有 ${more} 个文件，已自动去重</div>` : null}
    </div>
  `;
}
function recentFileSourceLabel(source) {
  if (source === "report") return "任务报告";
  if (source === "opened") return "打开过";
  if (source === "saved") return "另存产物";
  if (source === "generated") return "生成文件";
  return "文件";
}
function fmtRecentFileTime(ms) {
  if (!Number.isFinite(Number(ms))) return "时间未知";
  try {
    return new Date(Number(ms)).toLocaleString();
  } catch {
    return "时间未知";
  }
}
function FilesPanel() {
  useLang();
  const [files, setFiles] = d2([]);
  const [loading, setLoading] = d2(true);
  const [error, setError] = d2(null);
  const [query, setQuery] = d2("");
  const load = q2(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api("/artifacts/recent", { method: "POST", body: { limit: 120 } });
      setFiles(Array.isArray(res.files) ? res.files : []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);
  y2(() => {
    load();
  }, [load]);
  const needle = query.trim().toLowerCase();
  const visible = needle ? files.filter((file) => {
    const text = [file.filename, file.path, file.dir, recentFileSourceLabel(file.source)].filter(Boolean).join(" ").toLowerCase();
    return text.includes(needle);
  }) : files;
  const action = async (kind, file) => {
    try {
      if (kind === "preview") {
        await showFileArtifactPreview(file);
      } else if (kind === "open") {
        await api("/artifacts/open-file", { method: "POST", body: { path: file.path } });
      } else if (kind === "folder") {
        await api("/artifacts/open-folder", { method: "POST", body: { path: file.path } });
      } else if (kind === "copy") {
        await writeClipboardText(file.path);
        showToast("路径已复制", "info");
      }
    } catch (err) {
      showToast(err.message || "文件操作失败", "error", 5e3);
    }
  };
  return html4`
    <div class="files-panel">
      <div class="files-toolbar">
        <div class="files-heading">
          <div class="files-title">文件中心</div>
          <div class="files-subtitle">集中查看最近生成、打开和任务输出的文件</div>
        </div>
        <input
          class="input files-search"
          value=${query}
          onInput=${(e3) => setQuery(e3.target.value)}
          placeholder="搜索文件名或路径"
        />
        <button class="btn" onClick=${load} disabled=${loading}>${loading ? "刷新中..." : "刷新"}</button>
      </div>
      ${error ? html4`<div class="files-notice err">文件列表加载失败：${error.message}</div>` : null}
      ${loading && files.length === 0 ? html4`<div class="files-empty">正在加载最近文件...</div>` : null}
      ${!loading && visible.length === 0 ? html4`<div class="files-empty">${query.trim() ? "没有匹配的文件。" : "暂无最近文件。对话生成文件、任务报告或打开 Markdown 后会出现在这里。"}</div>` : null}
      ${visible.length > 0 ? html4`
        <div class="files-summary">共 ${files.length} 个最近文件${query.trim() ? ` · 当前显示 ${visible.length} 个` : ""}</div>
        <div class="files-list">
          ${visible.map((file) => {
    const ext = String(file.ext || "").replace(/^\./, "").toLowerCase();
    const canPreview = file.previewable || FILE_ARTIFACT_PREVIEW_EXTS.has(ext);
    const canOpen = !canPreview && file.openable !== false && !FILE_ARTIFACT_SCRIPT_EXTS.has(ext);
    return html4`
            <div class="files-row" key=${file.path}>
              <div class="files-main">
                <div class="files-name" title=${file.path}>${file.filename || file.path}</div>
                <div class="files-path" title=${file.path}>${file.path}</div>
                <div class="files-meta">
                  <span>${fileArtifactKind(ext)}</span>
                  <span>${fmtBytes(file.size)}</span>
                  <span>${fmtRecentFileTime(file.mtimeMs)}</span>
                </div>
              </div>
              <div class="files-side">
                <span class="files-source">${recentFileSourceLabel(file.source)}</span>
                <div class="files-actions">
                  ${canPreview ? html4`<button type="button" onClick=${() => action("preview", file)}>查看</button>` : null}
                  ${canOpen ? html4`<button type="button" onClick=${() => action("open", file)}>打开</button>` : null}
                  <button type="button" onClick=${() => action("folder", file)}>所在文件夹</button>
                  <button type="button" onClick=${() => action("copy", file)}>复制路径</button>
                </div>
              </div>
            </div>
          `;
  })}
        </div>
      ` : null}
    </div>
  `;
}
function ChatPanel({ userAvatar = null } = {}) {
  useLang();
  const [messages, setMessages] = d2([]);
  const [streaming, setStreaming] = d2(null);
  const [reasoningExpanded] = d2(() => {
    try {
      return localStorage.getItem("visionox-reasoning-display") === "expanded";
    } catch (e) {
      return false;
    }
  });
  const [activeTools, setActiveTools] = d2([]);
  const [busy, setBusy] = d2(false);
  const initialInputRef = A2(null);
  if (initialInputRef.current === null) {
    try {
      initialInputRef.current = localStorage.getItem(CHAT_DRAFT_KEY) || "";
    } catch {
      initialInputRef.current = "";
    }
  }
  const inputValueRef = A2(initialInputRef.current);
  const inputRef = A2(null);
  const draftSaveTimerRef = A2(null);
  const [inputHasContent, setInputHasContent] = d2(Boolean(initialInputRef.current.trim()));
  const inputHasContentRef = A2(inputHasContent);
  const [promptOptimizing, setPromptOptimizing] = d2(false);
  const [jumpMessageId, setJumpMessageId] = d2(null);
  const [highlightMessageId, setHighlightMessageId] = d2(null);
  const [draftReady, setDraftReady] = d2(false);
  const [error, setError] = d2(null);
  const [bootError, setBootError] = d2(null);
  const [eventStreamConnected, setEventStreamConnected] = d2(true);
  const [statusLine, setStatusLine] = d2(null);
  const [modal, setModal] = d2(null);
  const [modalResolving, setModalResolving] = d2(false);
  const [editMode, setEditModeLocal] = d2(null);
  const [preset, setPresetLocal] = d2(null);
  const [effort, setEffortLocal] = d2(null);
const [mode, setModeLocal] = d2("general");
const [modes, setModesLocal] = d2(null);
const [activeMode, setActiveModeLocal] = d2(null);
const [eccRules, setEccRulesLocal] = d2(null);
const [providers, setProviders] = d2(null);
const [modelVerification, setModelVerification] = d2(null);
const [activeProviderId, setActiveProviderId] = d2(null);
const [providerCaps, setProviderCaps] = d2(null);
  const [stats, setStats] = d2(null);
  const [overviewModel, setOverviewModel] = d2(null);
  const activeProvider = (providers ?? []).find((provider) => provider.id === activeProviderId);
  const activeModel = activeProvider
    ?.models?.find((model) => model.disabled !== true && model.id === overviewModel);
  const pendingImageLimit = Math.min(5, Math.max(1, Number(activeModel?.capabilities?.maxImagesPerRequest) || 5));
  const [budgetUsd, setBudgetUsd] = d2(null);
  const [activePlan, setActivePlan] = d2(null);
  const [fileArtifacts, setFileArtifacts] = d2([]);
  const [fileArtifactsKey, setFileArtifactsKey] = d2("");
  const [fileArtifactsDismissed, setFileArtifactsDismissed] = d2(false);
  const [fileArtifactsSelectedMessageId, setFileArtifactsSelectedMessageId] = d2(null);
  const [fileArtifactsByMessageId, setFileArtifactsByMessageId] = d2({});
  const [fileArtifactsRetryTick, setFileArtifactsRetryTick] = d2(0);
  const fileArtifactsRetryRef = A2({ key: "", count: 0 });
  const [todos, setTodos] = d2([]);
  const [todoExpanded, setTodoExpanded] = d2(false);
  const [planContinuation, setPlanContinuation] = d2(null);
  const [semanticIndex, setSemanticIndex] = d2(null);
  const [indexRetrievalMode, setIndexRetrievalMode] = d2("tool");
  const [semanticRetrievalSources, setSemanticRetrievalSources] = d2([]);
  const [semanticRetrievalStatus, setSemanticRetrievalStatus] = d2("idle");
  const [showRetrievalSources, setShowRetrievalSources] = d2(false);
  const [slashCommands, setSlashCommands] = d2([]);
  const [popoverKind, setPopoverKind] = d2(null);
  const [popoverItems, setPopoverItems] = d2([]);
  const [popoverSel, setPopoverSel] = d2(0);
  const [semanticBannerDismissed, setSemanticBannerDismissed] = d2(() => {
    try {
      return localStorage.getItem("rx.semanticBannerDismissed") === "1";
    } catch {
      return false;
    }
  });
  y2(() => {
    try {
      localStorage.setItem("rx.semanticBannerDismissed", semanticBannerDismissed ? "1" : "0");
    } catch {
    }
  }, [semanticBannerDismissed]);
  const [turnStartedAt, setTurnStartedAt] = d2(null);
  const [nowTick, setNowTick] = d2(0);
  const [workspaceDir, setWorkspaceDirLocal] = d2(null);
  const [activeConversationId, setActiveConversationId] = d2(null);
  const [recentWss, setRecentWss] = d2([]);
  const [workspaceSelection, setWorkspaceSelection] = d2(null);
  y2(() => {
    if (todos.length === 0 || !todos.every((todo) => todo.status === "completed")) return;
    setTodoExpanded(false);
    const timer = setTimeout(() => {
      setTodos((current) => current.length > 0 && current.every((todo) => todo.status === "completed") ? [] : current);
    }, 5e3);
    return () => clearTimeout(timer);
  }, [todos]);
  const [showWsPicker, setShowWsPicker] = d2(false);
  const [showSkillPicker, setShowSkillPicker] = d2(false);
  const [showModelPicker, setShowModelPicker] = d2(false);
  const [openModelGroupId, setOpenModelGroupId] = d2(null);
  const modelGroupCloseTimerRef = A2(null);
  const [modelNotice, setModelNotice] = d2(null);
  const modelNoticeTimerRef = A2(null);
  const pushModelNotice = q2((text, kind = "info", ttl = 3e3) => {
    if (modelNoticeTimerRef.current !== null) clearTimeout(modelNoticeTimerRef.current);
    setModelNotice({ text, kind });
    modelNoticeTimerRef.current = ttl > 0 ? setTimeout(() => {
      modelNoticeTimerRef.current = null;
      setModelNotice(null);
    }, ttl) : null;
  }, []);
  const cancelModelGroupClose = q2(() => {
    if (modelGroupCloseTimerRef.current !== null) clearTimeout(modelGroupCloseTimerRef.current);
    modelGroupCloseTimerRef.current = null;
  }, []);
  const openModelGroup = q2((groupId) => {
    cancelModelGroupClose();
    setOpenModelGroupId(groupId);
  }, [cancelModelGroupClose]);
  const scheduleModelGroupClose = q2(() => {
    cancelModelGroupClose();
    modelGroupCloseTimerRef.current = setTimeout(() => setOpenModelGroupId(null), 180);
  }, [cancelModelGroupClose]);
  y2(() => () => {
    if (modelNoticeTimerRef.current !== null) clearTimeout(modelNoticeTimerRef.current);
    if (modelGroupCloseTimerRef.current !== null) clearTimeout(modelGroupCloseTimerRef.current);
  }, []);
  const [providerImporting, setProviderImporting] = d2(false);
  const [providerTesting, setProviderTesting] = d2(false);
  const [providerCleaning, setProviderCleaning] = d2(false);
  const [skillList, setSkillList] = d2([]);
  const [skillCredentialSetup, setSkillCredentialSetup] = d2(null);
  const [skillCredentialValue, setSkillCredentialValue] = d2("");
  const [skillCredentialSaving, setSkillCredentialSaving] = d2(false);
  const [pendingImages, setPendingImages] = d2([]);
  const pendingImagesRef = A2([]);
  const queuedAttachmentIdsRef = A2(new Set());
  const uploadScopeRef = A2(null);
  const [visibleMessageCount, setVisibleMessageCount] = d2(CHAT_INITIAL_RENDER_COUNT);
  const [totalMessages, setTotalMessages] = d2(0);
  const [loadingEarlierMessages, setLoadingEarlierMessages] = d2(false);
  const [queuedPrompts, setQueuedPrompts] = d2([]);
  const [queuePumpTick, setQueuePumpTick] = d2(0);
  const [queueReady, setQueueReady] = d2(false);
  const [queueSendingId, setQueueSendingId] = d2(null);
  const [queuePaused, setQueuePaused] = d2(false);
  const [operation, setOperation] = d2(null);
  const [backgroundJobs, setBackgroundJobs] = d2([]);
  const [pendingDeliveries, setPendingDeliveries] = d2([]);
  const [showBackgroundJobs, setShowBackgroundJobs] = d2(false);
  const [selectedBackgroundJobId, setSelectedBackgroundJobId] = d2(null);
  const [backgroundJobDetail, setBackgroundJobDetail] = d2(null);
  const backgroundJobDetailRequestRef = A2(0);
  var fileInputRef = A2(null);
  const queuedPromptsRef = A2([]);
  const queueSubmittingRef = A2(false);
  const CHAT_QUEUE_LIMIT = 5;
  const draftKey = T2(() => chatDraftKey(workspaceDir, mode), [workspaceDir, mode]);
  const queueStorageKey = T2(() => workspaceDir && activeConversationId
    ? `${draftKey}:conversation:${activeConversationId}:queue`
    : null, [draftKey, workspaceDir, activeConversationId]);
  const queueStorageKeyRef = A2(queueStorageKey);
  queueStorageKeyRef.current = queueStorageKey;
  const uploadScopeKey = `${activeConversationId || "unresolved"}\n${workspaceDir || ""}`;
  const persistDraftSoon = q2((value) => {
    if (draftSaveTimerRef.current !== null) clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = setTimeout(() => {
      draftSaveTimerRef.current = null;
      try {
        const text = String(value || "");
        if (text.trim()) localStorage.setItem(draftKey, text);
        else localStorage.removeItem(draftKey);
      } catch {
      }
    }, 250);
  }, [draftKey]);
  const setChatInput = q2((value, options = {}) => {
    const text = String(value ?? "");
    inputValueRef.current = text;
    if (inputRef.current && inputRef.current.value !== text) inputRef.current.value = text;
    const hasContent = Boolean(text.trim());
    if (inputHasContentRef.current !== hasContent) {
      inputHasContentRef.current = hasContent;
      setInputHasContent(hasContent);
    }
    if (options.persist !== false) persistDraftSoon(text);
  }, [persistDraftSoon]);
  const optimizeCurrentPrompt = q2(async () => {
    const source = inputValueRef.current.trim();
    if (!source || promptOptimizing) return;
    setPromptOptimizing(true);
    setError(null);
    try {
      const result = await api("/optimize-prompt", { method: "POST", body: { prompt: source } });
      if (inputValueRef.current.trim() !== source) {
        showToast("输入内容已变化，未覆盖你刚才的修改", "info");
        return;
      }
      const optimized = String(result?.prompt ?? "").trim();
      if (!optimized) throw new Error("模型没有返回可用的优化结果");
      setChatInput(optimized);
      setTimeout(() => {
        inputRef.current?.focus();
        try {
          inputRef.current.selectionStart = inputRef.current.selectionEnd = optimized.length;
        } catch {
        }
      }, 0);
      showToast("提示词已优化，请确认后发送", "success");
    } catch (err) {
      setError(`提示词优化失败：${err.message}`);
    } finally {
      setPromptOptimizing(false);
    }
  }, [promptOptimizing, setChatInput]);
  y2(() => {
    queuedPromptsRef.current = queuedPrompts;
  }, [queuedPrompts]);
  const refreshBackgroundJobs = q2(async () => {
    try {
      const result = await api("/background-jobs");
      const next = Array.isArray(result.jobs) ? result.jobs : [];
      setBackgroundJobs(next);
      setPendingDeliveries(Array.isArray(result.pendingDeliveries) ? result.pendingDeliveries : []);
      return next;
    } catch {
      return [];
    }
  }, []);
  const stopBackgroundJob = q2(async (id) => {
    try {
      if (String(id).startsWith("document:")) {
        await api(`/background-jobs/${encodeURIComponent(id)}`, { method: "POST", body: { action: "stop" } });
      } else {
        await api(`/background-jobs/${encodeURIComponent(id)}`, { method: "DELETE" });
      }
      await refreshBackgroundJobs();
    } catch (err) {
      setError(err.message);
    }
  }, [refreshBackgroundJobs]);
  const abandonBackgroundJob = q2(async (id) => {
    try {
      await api(`/background-jobs/${encodeURIComponent(id)}`, { method: "POST", body: { action: "abandon" } });
      await refreshBackgroundJobs();
    } catch (err) {
      setError(err.message);
    }
  }, [refreshBackgroundJobs]);
  const deleteBackgroundJobRecord = q2(async (id) => {
    try {
      await api(`/background-jobs/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (selectedBackgroundJobId === id) {
        setSelectedBackgroundJobId(null);
        setBackgroundJobDetail(null);
      }
      await refreshBackgroundJobs();
    } catch (err) {
      setError(err.message);
    }
  }, [refreshBackgroundJobs, selectedBackgroundJobId]);
  const controlDocumentJob = q2(async (id, action, payload = null) => {
    const requestId = backgroundJobDetailRequestRef.current;
    try {
      const current = String(backgroundJobDetail?.id ?? "") === String(id) ? backgroundJobDetail : backgroundJobs.find((job) => String(job.id) === String(id));
      const requestBody = String(id).startsWith("task:") ? {
        action,
        expectedRevision: current?.revision,
        requestId: backgroundActionRequestId(),
        payload
      } : { action };
      await api(`/background-jobs/${encodeURIComponent(id)}`, { method: "POST", body: requestBody });
      await refreshBackgroundJobs();
      if (requestId !== backgroundJobDetailRequestRef.current) return;
      const detail = await api(`/background-jobs/${encodeURIComponent(id)}`);
      if (requestId !== backgroundJobDetailRequestRef.current) return;
      const nextDetail = detail?.job ?? null;
      if (nextDetail && String(nextDetail.id ?? "") !== String(id)) return;
      setBackgroundJobDetail(nextDetail);
    } catch (err) {
      await refreshBackgroundJobs();
      if (requestId !== backgroundJobDetailRequestRef.current) return;
      try {
        const detail = await api(`/background-jobs/${encodeURIComponent(id)}`);
        if (requestId !== backgroundJobDetailRequestRef.current) return;
        const nextDetail = detail?.job ?? null;
        if (!nextDetail || String(nextDetail.id ?? "") === String(id)) setBackgroundJobDetail(nextDetail);
      } catch {
        // Keep the original control error visible when the detail refresh also fails.
      }
      if (requestId === backgroundJobDetailRequestRef.current) setError(err.message);
    }
  }, [refreshBackgroundJobs, backgroundJobDetail, backgroundJobs]);
  const closeBackgroundWorkbench = q2(() => {
    backgroundJobDetailRequestRef.current += 1;
    setShowBackgroundJobs(false);
    setBackgroundJobDetail(null);
  }, []);
  const openBackgroundWorkbench = q2(async (id = null) => {
    const requestId = ++backgroundJobDetailRequestRef.current;
    setShowBackgroundJobs(true);
    setShowSkillPicker(false);
    setShowWsPicker(false);
    setShowModelPicker(false);
    setBackgroundJobDetail(null);
    if (id !== null && id !== void 0) setSelectedBackgroundJobId(id);
    const refreshed = await refreshBackgroundJobs();
    if (requestId !== backgroundJobDetailRequestRef.current) return;
    const nextId = id || selectedBackgroundJobId || refreshed.find((job) => job.kind === "document")?.id || refreshed[0]?.id;
    if (!nextId) {
      setSelectedBackgroundJobId(null);
      return;
    }
    setSelectedBackgroundJobId(nextId);
    try {
      const detail = await api(`/background-jobs/${encodeURIComponent(nextId)}`);
      if (requestId !== backgroundJobDetailRequestRef.current) return;
      const nextDetail = detail?.job ?? null;
      if (nextDetail && String(nextDetail.id ?? "") !== String(nextId)) return;
      setBackgroundJobDetail(nextDetail);
    } catch (err) {
      if (requestId === backgroundJobDetailRequestRef.current) setError(err.message);
    }
  }, [refreshBackgroundJobs, selectedBackgroundJobId, backgroundJobs]);
  y2(() => {
    if (!showBackgroundJobs) return;
    const onEscape = (event) => {
      if (event.key !== "Escape" || event.defaultPrevented || modal) return;
      event.preventDefault();
      if (showSkillPicker || showWsPicker || showModelPicker || showRetrievalSources) {
        setShowSkillPicker(false);
        setShowWsPicker(false);
        setShowModelPicker(false);
        setShowRetrievalSources(false);
        return;
      }
      closeBackgroundWorkbench();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [showBackgroundJobs, modal, showSkillPicker, showWsPicker, showModelPicker, showRetrievalSources, closeBackgroundWorkbench]);
  const previewDocumentJob = q2(async (job, artifact = null) => {
    try {
      if (artifact?.path) {
        const filename = artifact.filename || artifact.name || artifact.path.split(/[\\/]/).pop() || "任务产物";
        const ext = filename.includes(".") ? filename.split(".").pop() : "";
        await showFileArtifactPreview({ path: artifact.path, filename, ext });
        return;
      }
      if (["completed", "completed_with_warnings"].includes(job?.status) && job?.outputPath && !["missing", "modified"].includes(job?.artifactStatus)) {
        await showFileArtifactPreview({ path: job.outputPath, filename: job.outputPath.split(/[\\/]/).pop() || "document.md", ext: "md" });
        return;
      }
      const detail = await api(`/background-jobs/${encodeURIComponent(job.id)}`);
      const preview = detail?.job?.preview;
      if (!preview?.content) throw new Error("当前还没有可预览的已完成区块");
      showArtifactPreview({
        id: `document-job-${Date.now()}`,
        filename: preview.filename || "文档中间预览.md",
        path: "",
        lang: "markdown",
        content: preview.content
      });
    } catch (err) {
      setError(err.message);
    }
  }, []);
  y2(() => {
    void refreshBackgroundJobs();
    if (!showBackgroundJobs && !backgroundJobs.some((job) => job.running)) return;
    const id = setInterval(refreshBackgroundJobs, 5e3);
    return () => clearInterval(id);
  }, [refreshBackgroundJobs, showBackgroundJobs, backgroundJobs.some((job) => job.running)]);
  y2(() => {
    const refreshOnFocus = () => {
      void refreshBackgroundJobs();
    };
    const refreshOnVisibility = () => {
      if (document.visibilityState === "visible") void refreshBackgroundJobs();
    };
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisibility);
    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisibility);
    };
  }, [refreshBackgroundJobs]);
  y2(() => {
    if (!showBackgroundJobs || !selectedBackgroundJobId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const detail = await api(`/background-jobs/${encodeURIComponent(selectedBackgroundJobId)}`);
        const nextDetail = detail?.job ?? null;
        if (!cancelled && (!nextDetail || String(nextDetail.id ?? "") === String(selectedBackgroundJobId))) setBackgroundJobDetail(nextDetail);
      } catch {
      }
    };
    void load();
    const timer = setInterval(load, 4e3);
    return () => { cancelled = true; clearInterval(timer); };
  }, [showBackgroundJobs, selectedBackgroundJobId]);
  y2(() => {
    if (!draftReady || !queueStorageKey) return;
    let cancelled = false;
    queuedAttachmentIdsRef.current = new Set();
    setQueueReady(false);
    api(`/prompt-queue?scope=${encodeURIComponent(queueStorageKey)}`).then((res) => {
      if (cancelled) return;
      const restored = (Array.isArray(res?.items) ? res.items : []).slice(0, CHAT_QUEUE_LIMIT).map((item) => {
        const id = item.id || `queued-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        return {
          id,
          requestId: item.requestId || id,
          text: String(item.text ?? "").trim(),
          images: Array.isArray(item.images) ? item.images.filter((img) => typeof img === "string" && img.startsWith("data:image/")) : [],
          attachments: Array.isArray(item.attachments) ? item.attachments.filter((attachmentId) => typeof attachmentId === "string" && attachmentId.startsWith("att_")) : [],
          status: item.status === "failed" ? "failed" : "queued",
          error: item.status === "failed" ? String(item.error ?? "") : null,
          createdAt: Number(item.createdAt ?? Date.now())
        };
      }).filter((item) => item.text || item.images.length > 0 || item.attachments.length > 0);
      for (const item of restored) {
        for (const attachmentId of item.attachments) queuedAttachmentIdsRef.current.add(attachmentId);
      }
      setQueuedPrompts(restored);
    }).catch((err) => {
      if (!cancelled) setError(t4("chat.queueFailed", { error: err.message }));
    }).finally(() => {
      if (!cancelled) setQueueReady(true);
    });
    return () => { cancelled = true; };
  }, [draftReady, queueStorageKey]);
  y2(() => {
    try {
      const scopedDraft = localStorage.getItem(draftKey) || "";
      const legacyDraft = localStorage.getItem(CHAT_DRAFT_KEY) || "";
      const nextDraft = scopedDraft || legacyDraft;
      if (!inputValueRef.current.trim() && nextDraft) setChatInput(nextDraft, { persist: false });
      if (legacyDraft && !scopedDraft) {
        localStorage.setItem(draftKey, legacyDraft);
      }
      localStorage.removeItem(CHAT_DRAFT_KEY);
    } catch {
    }
    setDraftReady(true);
  }, [draftKey, setChatInput]);
  y2(() => {
    return () => {
      if (draftSaveTimerRef.current !== null) clearTimeout(draftSaveTimerRef.current);
    };
  }, []);
  y2(() => {
    if (!busy) return;
    const id = setInterval(() => setNowTick((n3) => n3 + 1), 500);
    return () => clearInterval(id);
  }, [busy]);
  y2(() => {
    if (busy) {
      if (!turnStartedAt) setTurnStartedAt(Date.now());
    } else {
      setTurnStartedAt(null);
    }
  }, [busy, turnStartedAt]);
  const shouldAutoScroll = A2(true);
  const feedRef = A2(null);
  const autoScrollInFlight = A2(false);
  const loadingEarlierRef = A2(false);
  const scrollbarDraggingRef = A2(false);
  const topLoadArmedRef = A2(true);
  const loadEarlierMessagesRef = A2(null);
  const preserveVisibleHistoryOnAppend = q2(() => {
    if (!shouldAutoScroll.current) setVisibleMessageCount((count) => count + 1);
  }, []);
  const allVisibleMessages = streaming ? [
    ...messages,
    {
      id: streaming.id,
      role: "assistant",
      text: streaming.text,
      reasoning: streaming.reasoning
    }
  ] : messages;
  y2(() => {
    const pending = window.__visionoxPendingChatJump;
    if (pending?.messageId) setJumpMessageId(pending.messageId);
    const onJump = (ev) => {
      const id = ev.detail?.messageId;
      if (id) setJumpMessageId(id);
    };
    appBus.addEventListener("chat-jump-message", onJump);
    return () => appBus.removeEventListener("chat-jump-message", onJump);
  }, []);
  y2(() => {
    if (!jumpMessageId) return;
    const selector = `[data-msg-id="${String(jumpMessageId).replace(/"/g, '\\"')}"]`;
    const el = feedRef.current?.querySelector(selector);
    if (!el) {
      const index = messages.findIndex((message) => String(message?.id || "") === String(jumpMessageId));
      if (index >= 0) setVisibleMessageCount((count) => Math.max(count, messages.length - index));
      return;
    }
    shouldAutoScroll.current = false;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlightMessageId(jumpMessageId);
    setJumpMessageId(null);
    try {
      if (window.__visionoxPendingChatJump?.messageId === jumpMessageId) {
        window.__visionoxPendingChatJump = null;
      }
    } catch {
    }
    const id = setTimeout(() => {
      setHighlightMessageId((cur) => cur === jumpMessageId ? null : cur);
    }, 5e3);
    return () => clearTimeout(id);
  }, [jumpMessageId, messages, streaming, visibleMessageCount]);
  y2(() => {
    let cancelled = false;
    if (streaming) return () => {
      cancelled = true;
    };
    const sourceMessages = allVisibleMessages;
    const selectedExists = fileArtifactsSelectedMessageId && sourceMessages.some((m3) => m3.role === "assistant" && String(m3.id || "") === String(fileArtifactsSelectedMessageId));
    const turnKey = selectedExists ? String(fileArtifactsSelectedMessageId) : latestAssistantMessageId(sourceMessages);
    const candidates = fileArtifactCandidatesForAssistant(sourceMessages, turnKey);
    const eventFiles = fileArtifactsByMessageId[turnKey] || [];
    if (fileArtifactsSelectedMessageId && !selectedExists) {
      setFileArtifactsSelectedMessageId(null);
    }
    if (candidates.length === 0) {
      if (eventFiles.length > 0) {
        const nextKey = `${turnKey}|${fileArtifactGroupKey(eventFiles)}`;
        if (nextKey !== fileArtifactsKey) {
          setFileArtifacts(eventFiles);
          setFileArtifactsKey(nextKey);
          setFileArtifactsDismissed(false);
        }
        return () => {
          cancelled = true;
        };
      }
      if (!busy) {
        setFileArtifacts([]);
        setFileArtifactsKey("");
        setFileArtifactsDismissed(false);
        fileArtifactsRetryRef.current = { key: "", count: 0 };
      }
      return () => {
        cancelled = true;
      };
    }
    const candidateKey = `${turnKey}|${candidates.join("|")}`;
    if (fileArtifactsRetryRef.current.key !== candidateKey) {
      fileArtifactsRetryRef.current = { key: candidateKey, count: 0 };
    }
    (async () => {
      try {
        const res = await api("/artifacts/resolve", { method: "POST", body: { candidates } });
        if (cancelled) return;
        const files = res.files ?? [];
        if (files.length === 0) {
          if (eventFiles.length > 0) {
            const nextKey = `${turnKey}|${fileArtifactGroupKey(eventFiles)}`;
            if (nextKey !== fileArtifactsKey) {
              setFileArtifacts(eventFiles);
              setFileArtifactsKey(nextKey);
              setFileArtifactsDismissed(false);
            }
            return;
          }
          const retry = fileArtifactsRetryRef.current;
          if (retry.key === candidateKey && retry.count < 4) {
            const delays = [250, 750, 1500, 3000];
            const delay = delays[retry.count] ?? 3000;
            retry.count += 1;
            setTimeout(() => {
              if (!cancelled) setFileArtifactsRetryTick((v) => v + 1);
            }, delay);
          }
          return;
        }
        fileArtifactsRetryRef.current = { key: candidateKey, count: 0 };
        const mergedFiles = mergeFileArtifacts(eventFiles, files);
        const nextKey = `${turnKey}|${fileArtifactGroupKey(mergedFiles)}`;
        if (nextKey !== fileArtifactsKey) {
          setFileArtifacts(mergedFiles);
          setFileArtifactsKey(nextKey);
          setFileArtifactsDismissed(false);
        }
      } catch {
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [messages, streaming, busy, fileArtifactsKey, fileArtifactsRetryTick, fileArtifactsSelectedMessageId, fileArtifactsByMessageId]);
  y2(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api(`/messages?limit=${CHAT_MESSAGE_PAGE_SIZE}`);
        if (cancelled) return;
        setMessages(data.messages ?? []);
        setTotalMessages(data.totalMessages ?? data.messages?.length ?? 0);
        setBusy(Boolean(data.busy));
        setOperation(data.operation ?? null);
      } catch (err) {
        if (!cancelled) setBootError(err.message);
      }
      try {
        const m3 = await api("/modal");
        if (!cancelled && m3.modal) setModal(m3.modal);
      } catch {
      }
      try {
        const r3 = await api("/slash");
        if (!cancelled) setSlashCommands(r3.commands);
      } catch {
      }
      try {
        const retrieval = await api("/index-retrieval-mode");
        if (!cancelled) setIndexRetrievalMode(globalThis.VisionoxIndexModePolicy.normalize(retrieval.mode));
      } catch {
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const streamBufRef = A2(null);
  const streamRafRef = A2(null);
  const resyncingEventsRef = A2(false);
  const bufferedDashboardEventsRef = A2<any[]>([]);
  const flushStreaming = q2(() => {
    streamRafRef.current = null;
    if (streamBufRef.current) setStreaming(streamBufRef.current);
  }, []);
  const cancelStreamingRaf = q2(() => {
    if (streamRafRef.current !== null) {
      clearTimeout(streamRafRef.current);
      streamRafRef.current = null;
    }
    streamBufRef.current = null;
  }, []);
  const refetchCanonicalState = q2(async () => {
    try {
      const data = await api(`/messages?limit=${CHAT_MESSAGE_PAGE_SIZE}`);
      setMessages(data.messages ?? []);
      setTotalMessages(data.totalMessages ?? data.messages?.length ?? 0);
      setBusy(Boolean(data.busy));
      setOperation(data.operation ?? null);
      cancelStreamingRaf();
      setStreaming(null);
      setActiveTool(null);
    } catch {
    }
    try {
      const m3 = await api("/modal");
      setModal(m3.modal ?? null);
    } catch {
    }
    try {
      const retrieval = await api("/index-retrieval-mode");
      setIndexRetrievalMode(globalThis.VisionoxIndexModePolicy.normalize(retrieval.mode));
    } catch {
    }
  }, [cancelStreamingRaf]);
  y2(() => {
    let disposed = false;
    const applyDashboardEvent = (dash) => {
      if (dash.kind === "ping") return;
      if (dash.kind === "busy-change") {
        setBusy(dash.busy);
        if (!dash.busy) setSemanticRetrievalStatus((current) => current === "running" ? "idle" : current);
        return;
      }
      if (dash.kind === "semantic-retrieval") {
        setSemanticRetrievalSources(Array.isArray(dash.sources) ? dash.sources : []);
        setSemanticRetrievalStatus(dash.status ?? (dash.sources?.length ? "completed" : "empty"));
        return;
      }
      if (dash.kind === "operation-change") {
        setOperation(dash.operation ?? null);
        if (dash.operation?.state === "cancelled") {
          setActiveTools([]);
          setSemanticRetrievalSources([]);
          setSemanticRetrievalStatus("idle");
          setShowRetrievalSources(false);
          showToast(t4("chat.stopComplete"), "info");
        }
        void refreshBackgroundJobs();
        return;
      }
      if (dash.kind === "background-job-change") {
        void refreshBackgroundJobs();
        return;
      }
      if (dash.kind === "user") {
        setSemanticRetrievalSources([]);
        setSemanticRetrievalStatus("running");
        setShowRetrievalSources(false);
        setTodos((current) => current.length > 0 && current.every((todo) => todo.status === "completed") ? [] : current);
        setPlanContinuation(null);
        preserveVisibleHistoryOnAppend();
        setMessages((prev) => [...prev, { id: dash.id, role: "user", text: dash.text, images: dash.images }]);
        setTotalMessages((count) => count + 1);
        return;
      }
      if (dash.kind === "assistant_delta") {
        const cur = streamBufRef.current;
        if (!cur) preserveVisibleHistoryOnAppend();
        const baseId = cur?.id === dash.id ? cur : null;
        streamBufRef.current = {
          id: dash.id,
          text: (baseId?.text ?? "") + (dash.contentDelta ?? ""),
          reasoning: (baseId?.reasoning ?? "") + (dash.reasoningDelta ?? "")
        };
        if (streamRafRef.current === null) {
          streamRafRef.current = setTimeout(flushStreaming, 75);
        }
        return;
      }
      if (dash.kind === "assistant_final") {
        const completedStream = streamBufRef.current;
        const replacedStreaming = Boolean(completedStream);
        cancelStreamingRaf();
        setStreaming(null);
        setActiveTools([]);
        if (!replacedStreaming) preserveVisibleHistoryOnAppend();
        setMessages((prev) => [
          ...prev,
          {
            id: dash.id,
            role: "assistant",
            text: dash.text,
            reasoning: dash.reasoning ?? completedStream?.reasoning,
            receipt: dash.receipt,
            taskState: dash.taskState,
            artifactIncomplete: dash.artifactIncomplete === true,
            interventionChoice: dash.interventionChoice,
            warnings: Array.isArray(dash.warnings) ? dash.warnings : []
          }
        ]);
        setTotalMessages((count) => count + 1);
        return;
      }
      if (dash.kind === "tool_start") {
        if (!dash.status || dash.status === "queued") preserveVisibleHistoryOnAppend();
        setActiveTools((current) => upsertActiveTool(current, dash));
        setMessages((current) => upsertToolProgress(current, dash));
        return;
      }
      if (dash.kind === "tool") {
        setActiveTools((current) => current.filter((item) => item.toolCallId !== String(dash.toolCallId || dash.id || "")));
        setMessages((current) => upsertToolProgress(current, dash));
        return;
      }
      if (dash.kind === "artifact-created") {
        const assistantId = String(dash.assistantId || "");
        const files = Array.isArray(dash.files) ? dash.files.filter((file) => file?.path) : [];
        if (!assistantId || files.length === 0) return;
        setFileArtifactsByMessageId((prev) => {
          const merged = mergeFileArtifacts(prev[assistantId] || [], files);
          return { ...prev, [assistantId]: merged };
        });
        setFileArtifacts((prev) => mergeFileArtifacts(prev, files));
        setFileArtifactsKey(`${assistantId}|event:${Date.now()}`);
        setFileArtifactsDismissed(false);
        return;
      }
      if (dash.kind === "warning" || dash.kind === "error" || dash.kind === "info") {
        if (dash.kind === "error") {
          setActiveTools([]);
        }
        preserveVisibleHistoryOnAppend();
        setMessages((prev) => [...prev, { id: dash.id, role: dash.kind, text: dash.text }]);
        setTotalMessages((count) => count + 1);
        return;
      }
      if (dash.kind === "status") {
        setStatusLine(dash.text);
        setTimeout(() => setStatusLine((cur) => cur === dash.text ? null : cur), 5e3);
        return;
      }
      if (dash.kind === "messages-reset") {
        setActiveTools([]);
        setSemanticRetrievalSources([]);
        setSemanticRetrievalStatus("idle");
        setShowRetrievalSources(false);
        api("/index-retrieval-mode").then((retrieval) => setIndexRetrievalMode(globalThis.VisionoxIndexModePolicy.normalize(retrieval.mode))).catch(() => {});
        setMessages(dash.messages.map((m) => ({
          id: m.id || `hist-${Math.random()}`,
          role: m.role,
          text: m.text || ""
        })));
        setTotalMessages(dash.totalMessages ?? dash.messages.length);
        setFileArtifacts([]);
        setFileArtifactsKey("");
        setFileArtifactsDismissed(false);
        setFileArtifactsSelectedMessageId(null);
        setFileArtifactsByMessageId({});
        setQueuedPrompts([]);
        setQueueSendingId(null);
        setTodos([]);
        setPlanContinuation(null);
        setVisibleMessageCount(CHAT_INITIAL_RENDER_COUNT);
        topLoadArmedRef.current = true;
        return;
      }
      if (dash.kind === "config-changed") {
        Promise.allSettled([api("/overview"), api("/providers")]).then(([overviewResult, providersResult]) => {
          if (overviewResult.status === "fulfilled") {
            const o3 = overviewResult.value;
            setStats(o3.stats ?? null);
            setOverviewModel(o3.model ?? null);
            setPresetLocal(o3.preset ?? null);
            setEffortLocal(o3.reasoningEffort ?? null);
            setEditModeLocal(o3.editMode ?? null);
            setActiveProviderId(o3.activeProviderId ?? null);
            setProviderCaps(o3.providerCapabilities ?? null);
          }
          if (providersResult.status === "fulfilled") {
            setProviders(providersResult.value.providers ?? []);
            setModelVerification(providersResult.value.modelVerification ?? null);
          }
        });
        return;
      }
      if (dash.kind === "todo-update") {
        setTodos(dash.todos ?? []);
        return;
      }
      if (dash.kind === "plan-continuation-needed") {
        setPlanContinuation({
          attempts: dash.attempts ?? 0,
          maxAttempts: dash.maxAttempts ?? 0,
          completedSteps: dash.plan?.completedSteps ?? 0,
          totalSteps: dash.plan?.totalSteps ?? 0
        });
        return;
      }
      if (dash.kind === "plan-activated" || dash.kind === "plan-step-complete" || dash.kind === "plan-archived" || dash.kind === "plan-cancelled") {
        api("/plans").then((r3) => {
          setActivePlan((r3.plans ?? []).find((p3) => ["active", "pending"].includes(planStatus(p3))) ?? null);
        }).catch(() => {});
        return;
      }
      if (dash.kind === "modal-up") {
        setModalResolving(false);
        setModal(dash.modal);
        return;
      }
      if (dash.kind === "modal-down") {
        setModal((cur) => cur && (dash.gateId === void 0 ? cur.kind === dash.modalKind : cur._gateId === dash.gateId) ? null : cur);
        setModalResolving(false);
        return;
      }
    };
    const resyncDashboardEvents = async () => {
      if (resyncingEventsRef.current) return;
      resyncingEventsRef.current = true;
      try {
        await Promise.all([refetchCanonicalState(), refreshBackgroundJobs()]);
      } finally {
        if (!disposed) {
          const buffered = bufferedDashboardEventsRef.current.splice(0)
            .sort((left, right) => Number(left?.eventSeq ?? 0) - Number(right?.eventSeq ?? 0));
          resyncingEventsRef.current = false;
          for (const event of buffered) applyDashboardEvent(event);
        }
      }
    };
    const onDash = (dash) => {
      if (dash.kind === "resync-required") {
        void resyncDashboardEvents();
        return;
      }
      if (resyncingEventsRef.current) {
        bufferedDashboardEventsRef.current.push(dash);
        return;
      }
      applyDashboardEvent(dash);
    };
    const unsubscribe = subscribeSse("*", onDash);
    const unsubscribeStatus = subscribeSseStatus(({ connected, reconnected }) => {
      setEventStreamConnected(connected);
      if (connected && reconnected) {
        void resyncDashboardEvents();
      }
      if (!connected) {
        setError(t4("chat.eventStreamError"));
        setTimeout(() => setError(null), 3e3);
      }
    });
    return () => {
      disposed = true;
      unsubscribe();
      unsubscribeStatus();
      cancelStreamingRaf();
    };
  }, [refetchCanonicalState, refreshBackgroundJobs, cancelStreamingRaf, preserveVisibleHistoryOnAppend]);
  var handleFileChange = q2(async function(e) {
    var files = e.target.files;
    if (!files || files.length === 0) return;
    var newImages = pendingImages.slice();
    const scope = currentUploadScope();
    for (var i = 0; i < files.length && newImages.length < pendingImageLimit; i++) {
      try {
        var pendingImage = await uploadMediaAttachment(files[i], scope);
        newImages.push(pendingImage);
      } catch (err) {
        if (err?.name === "AbortError") continue;
        console.error("Media upload failed:", err);
        setError(`附件上传失败：${err.message}`);
      }
    }
    if (uploadScopeRef.current !== scope || scope.controller.signal.aborted) {
      await releaseUploadedImages(newImages.filter((item) => item?.uploadScopeKey === scope.key));
      e.target.value = "";
      return;
    }
    setPendingImages(newImages);
    e.target.value = "";
  }, [pendingImages, pendingImageLimit, uploadScopeKey]);
  var compressImage = function(file) {
    return new Promise(function(resolve, reject) {
      if (file.size < 100 * 1024) {
        var reader = new FileReader();
        reader.onload = function() { resolve(reader.result); };
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function() {
        URL.revokeObjectURL(url);
        var maxEdge = 1024;
        var w = img.width, h = img.height;
        if (w > maxEdge || h > maxEdge) {
          var ratio = Math.min(maxEdge / w, maxEdge / h);
          w = Math.round(w * ratio); h = Math.round(h * ratio);
        }
        var canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        var dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        if (dataUrl.length > 200 * 1024) {
          dataUrl = canvas.toDataURL("image/jpeg", 0.4);
        }
        if (dataUrl.length > 200 * 1024 && w > 512) {
          var r2 = Math.min(512 / img.width, 512 / img.height);
          canvas.width = Math.round(img.width * r2);
          canvas.height = Math.round(img.height * r2);
          var ctx2 = canvas.getContext("2d");
          ctx2.drawImage(img, 0, 0, canvas.width, canvas.height);
          dataUrl = canvas.toDataURL("image/jpeg", 0.5);
        }
        resolve(dataUrl);
      };
      img.onerror = function() { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
      img.src = url;
    });
  };
  var uploadChunkData = function(blob) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function() {
        var value = String(reader.result || "");
        resolve(value.slice(value.indexOf(",") + 1));
      };
      reader.onerror = function() { reject(reader.error || new Error("Failed to read image chunk")); };
      reader.readAsDataURL(blob);
    });
  };
  var currentUploadScope = function() {
    const current = uploadScopeRef.current;
    if (current && current.key === uploadScopeKey && !current.controller.signal.aborted) return current;
    const scope = {
      key: uploadScopeKey,
      sessionId: activeConversationId,
      workspace: workspaceDir,
      controller: new AbortController()
    };
    uploadScopeRef.current = scope;
    return scope;
  };
  var uploadMediaAttachment = async function(file, scope = currentUploadScope()) {
    if (!file || !Number.isFinite(file.size) || file.size < 1) throw new Error("附件文件为空");
    if (file.size > 50 * 1024 * 1024) throw new Error("附件超过 50 MB 限制");
    const isImage = String(file.type || "").startsWith("image/");
    const extension = /\.([^.]+)$/.exec(String(file.name || ""))?.[1]?.toLowerCase() || "";
    const videoMimeByExtension = { mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm" };
    const declaredMime = String(file.type || videoMimeByExtension[extension] || "application/octet-stream").toLowerCase();
    const isVideo = ["video/mp4", "video/quicktime", "video/webm"].includes(declaredMime) || Object.hasOwn(videoMimeByExtension, extension);
    if (!isImage && !isVideo) throw new Error("仅支持图片、MP4、MOV 或 WebM 视频");
    if (isImage && !canUploadImages) throw new Error("当前模型不支持图片输入");
    if (isVideo && !canUploadVideos) throw new Error("仅显式配置的官方 Kimi 视频模型支持视频输入");
    const preview = isImage ? await compressImage(file) : null;
    const initialized = await api("/attachments", {
      method: "POST",
      body: { action: "init", name: file.name || "image", size: file.size, mimeType: declaredMime },
      signal: scope?.controller.signal
    });
    const uploadId = initialized.uploadId;
    const uploadSessionId = initialized.sessionId || scope?.sessionId || null;
    const uploadWorkspace = initialized.workspace || scope?.workspace || null;
    const chunkBytes = Math.min(Number(initialized.chunkBytes) || 512 * 1024, 512 * 1024);
    try {
      for (let offset = 0; offset < file.size; offset += chunkBytes) {
        const data = await uploadChunkData(file.slice(offset, Math.min(file.size, offset + chunkBytes)));
        await api("/attachments", { method: "POST", body: { action: "chunk", uploadId, offset, data }, signal: scope?.controller.signal });
      }
      const completed = await api("/attachments", { method: "POST", body: { action: "finish", uploadId }, signal: scope?.controller.signal });
      if (!completed.attachment?.id) throw new Error("宿主未返回附件 ID");
      const result = {
        attachmentId: completed.attachment.id,
        preview,
        kind: completed.attachment.kind || (isVideo ? "video" : "image"),
        name: completed.attachment.name || file.name || "image",
        size: completed.attachment.size || file.size,
        mimeType: completed.attachment.mimeType || declaredMime,
        sessionId: completed.attachment.sessionId || uploadSessionId,
        workspace: completed.attachment.workspace || uploadWorkspace,
        uploadScopeKey: scope?.key || null
      };
      if (uploadScopeRef.current !== scope || scope?.controller.signal.aborted) {
        await releaseUploadedImages([result]);
        const staleError = new Error("附件上传所属会话或工作区已经切换");
        staleError.name = "AbortError";
        throw staleError;
      }
      return result;
    } catch (error) {
      await api("/attachments", {
        method: "POST",
        body: { action: "cancel", uploadId, sessionId: uploadSessionId, workspace: uploadWorkspace }
      }).catch(() => {});
      throw error;
    }
  };
  var releaseUploadedImages = function(items) {
    const attachments = (Array.isArray(items) ? items : [])
      .filter((item) => item && typeof item === "object" && item.attachmentId && item.sessionId && item.workspace)
      .map((item) => ({ id: item.attachmentId, sessionId: item.sessionId, workspace: item.workspace }));
    if (attachments.length === 0) return Promise.resolve();
    return api("/attachments", { method: "POST", body: { action: "release-upload", attachments } }).catch(() => {});
  };
  var rotateUploadScope = function() {
    const scope = uploadScopeRef.current;
    if (!scope) return;
    scope.controller.abort();
    if (uploadScopeRef.current === scope) uploadScopeRef.current = null;
    void releaseUploadedImages(pendingImagesRef.current.filter((item) => item?.uploadScopeKey === scope.key
      && !queuedAttachmentIdsRef.current.has(item?.attachmentId)));
  };
  y2(() => {
    pendingImagesRef.current = pendingImages;
  }, [pendingImages]);
  y2(() => {
    const scope = currentUploadScope();
    setPendingImages((current) => current.filter((item) => !item?.uploadScopeKey || item.uploadScopeKey === scope.key));
    return () => {
      scope.controller.abort();
      void releaseUploadedImages(pendingImagesRef.current.filter((item) => (!item?.uploadScopeKey || item.uploadScopeKey === scope.key)
        && !queuedAttachmentIdsRef.current.has(item?.attachmentId)));
      if (uploadScopeRef.current === scope) uploadScopeRef.current = null;
    };
  }, [uploadScopeKey]);
  const loadChatSkills = q2(async () => {
    if (skillList.length > 0) return skillList;
    const r3 = await api("/skills");
    const rows = [...(r3.project ?? []), ...(r3.global ?? []), ...(r3.builtin ?? [])];
    setSkillList(rows);
    return rows;
  }, [skillList]);
  const appendSkillMention = q2((name) => {
    const skillName = String(name ?? "").trim();
    if (!skillName) return;
    const base = inputValueRef.current;
    const spacer = base && !/\s$/.test(base) ? " " : "";
    setChatInput(`${base}${spacer}@${skillName} `);
    setShowSkillPicker(false);
    setPopoverKind(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [setChatInput]);
  const resolveSkillMention = q2(async (rawText) => {
    const text = String(rawText ?? "").trim();
    if (!text) return { text, skillInvocation: null };
    try {
      const skills = await loadChatSkills();
      const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      let selected = null;
      for (const s2 of skills) {
        const name = String(s2.name ?? "").trim();
        if (!name) continue;
        const re = new RegExp(`(^|[^A-Za-z0-9._-])@${escapeRegExp(name)}(?=$|[^A-Za-z0-9._-])`, "gi");
        let match;
        while ((match = re.exec(text))) {
          const start = match.index + (match[1] ? match[1].length : 0);
          const end = start + 1 + name.length;
          if (!selected || start >= selected.start) selected = { skill: s2, start, end };
          if (re.lastIndex === match.index) re.lastIndex++;
        }
      }
      if (!selected) return { text, skillInvocation: null };
      const task = `${text.slice(0, selected.start)}${text.slice(selected.end)}`.replace(/\s+/g, " ").trim() || t4("chat.skillInvokeTaskFallback");
      const skillInvocation = { name: selected.skill.name, task };
      if (selected.skill.name === "tavily-search") {
        try {
          const credential = await api(`/skills/credentials/${encodeURIComponent(selected.skill.name)}`);
          if (credential.required && !credential.configured) return { text, skillInvocation, credentialRequired: credential };
        } catch (err) {
          return { text, skillInvocation, credentialCheckError: err.message };
        }
      }
      return { text, skillInvocation };
    } catch {
      return { text, skillInvocation: null };
    }
  }, [loadChatSkills]);
  const submitPromptPayload = q2(async (payload) => {
    const resolved = await resolveSkillMention(payload?.text ?? "");
    const text = resolved.text;
    const imageItems = Array.isArray(payload?.images) ? payload.images.filter(Boolean) : [];
    const images = imageItems.filter((item) => typeof item === "string" && item.startsWith("data:image/"));
    const attachments = [...new Set([
      ...(Array.isArray(payload?.attachments) ? payload.attachments : []),
      ...imageItems.map((item) => typeof item === "object" ? item.attachmentId : null),
    ].filter(Boolean))];
    if (!text && images.length === 0 && attachments.length === 0) return { ok: false, reason: "empty" };
    if (resolved.credentialCheckError) {
      return { ok: false, reason: t4("chat.skillCredentialCheckFailed", { error: resolved.credentialCheckError }) };
    }
    if (resolved.credentialRequired) {
      return { ok: false, credentialRequired: resolved.credentialRequired };
    }
    try {
      const requestId = String(payload?.requestId || payload?.id || `prompt-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      var body = { prompt: text, requestId };
      if (resolved.skillInvocation) body.skillInvocation = resolved.skillInvocation;
      if (images.length > 0) body.images = images;
      if (attachments.length > 0) body.attachments = attachments;
      const res = await api("/submit", { method: "POST", body });
      if (!res.accepted) {
        return { ok: false, requiresUserRetry: res.requiresUserRetry === true, code: res.code ?? null, reason: res.reason ?? "rejected" };
      }
      if (res.duplicate && res.completed && res.completion?.ok === false) {
        return {
          ok: false,
          requiresUserRetry: true,
          code: "PROMPT_COMPLETION_FAILED",
          reason: res.completion.error ?? "上一次执行未成功，请明确重试。"
        };
      }
      shouldAutoScroll.current = true;
      return { ok: true };
    } catch (err) {
      if (err?.status === 409) {
        const busy = err.body?.busy === true || err.body?.code === "LOOP_BUSY";
        return {
          ok: false,
          busy,
          requiresUserRetry: err.body?.requiresUserRetry === true,
          code: err.body?.code ?? null,
          reason: err.body?.reason ?? err.message
        };
      }
      return { ok: false, reason: err.message };
    }
  }, [resolveSkillMention]);
  const persistQueuedPrompt = q2((item) => {
    if (!queueStorageKey || !item) return Promise.resolve();
    const storedItem = {
      ...item,
      images: Array.isArray(item.images) ? item.images.filter((image) => typeof image === "string" && image.startsWith("data:image/")) : [],
      attachments: [...new Set([
        ...(Array.isArray(item.attachments) ? item.attachments : []),
        ...(Array.isArray(item.images) ? item.images.map((image) => typeof image === "object" ? image.attachmentId : null) : []),
      ].filter(Boolean))],
    };
    return api("/prompt-queue", { method: "POST", body: { scope: queueStorageKey, item: storedItem } });
  }, [queueStorageKey]);
  const deletePersistedQueuedPrompt = q2((id = null) => {
    if (!queueStorageKey) return Promise.resolve();
    return api("/prompt-queue", { method: "DELETE", body: { scope: queueStorageKey, id } });
  }, [queueStorageKey]);
  const enqueuePrompt = q2(async (text, images = []) => {
    const trimmed = String(text ?? "").trim();
    const imageList = Array.isArray(images) ? images.slice() : [];
    if (!trimmed && imageList.length === 0) return false;
    const command = trimmed.split(/\s+/, 1)[0]?.toLowerCase();
    if (command === "/new" || command === "/clear" || command === "/retry") {
      setError(t4("chat.queueCommandBlocked"));
      return false;
    }
    const current = queuedPromptsRef.current ?? [];
    if (current.length >= CHAT_QUEUE_LIMIT) {
      setError(t4("chat.queueLimit", { count: CHAT_QUEUE_LIMIT }));
      return false;
    }
    const id = `queued-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const attachments = imageList.map((image) => typeof image === "object" ? image.attachmentId : null).filter(Boolean);
    const item = {
      id,
      requestId: id,
      text: trimmed,
      images: imageList,
      attachments,
      status: "queued",
      error: null,
      createdAt: Date.now()
    };
    const claimedQueueScope = queueStorageKey;
    for (const attachmentId of attachments) queuedAttachmentIdsRef.current.add(attachmentId);
    try {
      const persisted = await persistQueuedPrompt(item);
      if (persisted?.ok === false) throw new Error(persisted.error || "队列持久化失败");
    } catch (err) {
      for (const attachmentId of attachments) queuedAttachmentIdsRef.current.delete(attachmentId);
      const currentScopeKey = uploadScopeRef.current?.key ?? null;
      const ownershipStillActive = imageList.every((item) => !item?.uploadScopeKey || item.uploadScopeKey === currentScopeKey);
      if (!ownershipStillActive) void releaseUploadedImages(imageList);
      setError(t4("chat.queueFailed", { error: err.message }));
      return false;
    }
    if (queueStorageKeyRef.current !== claimedQueueScope) {
      const attachmentSet = new Set(attachments);
      for (const attachmentId of attachments) queuedAttachmentIdsRef.current.delete(attachmentId);
      pendingImagesRef.current = pendingImagesRef.current.filter((item) => !attachmentSet.has(item?.attachmentId));
      setPendingImages((current) => current.filter((item) => !attachmentSet.has(item?.attachmentId)));
      return false;
    }
    setQueuedPrompts((prev) => [...prev, item]);
    showToast(t4("chat.queueAdded", { count: current.length + 1 }), "info");
    setQueuePumpTick((v) => v + 1);
    return true;
  }, [persistQueuedPrompt, queueStorageKey]);
  const removeQueuedPrompt = q2(async (id) => {
    const removed = queuedPromptsRef.current.find((item) => item.id === id);
    const claimedQueueScope = queueStorageKey;
    try {
      const deleted = await deletePersistedQueuedPrompt(id);
      if (deleted?.ok === false) throw new Error(deleted.error || "队列删除失败");
    } catch (err) {
      setError(t4("chat.queueFailed", { error: err.message }));
      return false;
    }
    for (const attachmentId of removed?.attachments ?? []) queuedAttachmentIdsRef.current.delete(attachmentId);
    void releaseUploadedImages((removed?.attachments ?? []).map((attachmentId) => ({
      attachmentId,
      sessionId: activeConversationId,
      workspace: workspaceDir,
    })));
    if (queueStorageKeyRef.current !== claimedQueueScope) return true;
    setQueuedPrompts((prev) => prev.filter((item) => item.id !== id));
    return true;
  }, [deletePersistedQueuedPrompt, activeConversationId, workspaceDir, queueStorageKey]);
  const clearQueuedPrompts = q2(async () => {
    const count = queuedPromptsRef.current.length;
    if (count > 0 && !confirm(t4("chat.queueClearConfirm", { count }))) return;
    const claimedQueueScope = queueStorageKey;
    try {
      const deleted = await deletePersistedQueuedPrompt();
      if (deleted?.ok === false) throw new Error(deleted.error || "队列清空失败");
    } catch (err) {
      setError(t4("chat.queueFailed", { error: err.message }));
      return false;
    }
    const attachmentIds = queuedPromptsRef.current.flatMap((item) => item.attachments ?? []);
    for (const attachmentId of attachmentIds) queuedAttachmentIdsRef.current.delete(attachmentId);
    void releaseUploadedImages(attachmentIds.map((attachmentId) => ({ attachmentId, sessionId: activeConversationId, workspace: workspaceDir })));
    if (queueStorageKeyRef.current !== claimedQueueScope) return true;
    setQueuedPrompts([]);
    setQueueSendingId(null);
    return true;
  }, [deletePersistedQueuedPrompt, activeConversationId, workspaceDir, queueStorageKey]);
  const retryQueuedPrompt = q2((id) => {
    const retryRequestId = `prompt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setQueuedPrompts((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      const next = { ...item, requestId: retryRequestId, status: "queued", error: null };
      persistQueuedPrompt(next).catch((err) => setError(t4("chat.queueFailed", { error: err.message })));
      return next;
    }));
    setQueuePumpTick((v) => v + 1);
  }, [persistQueuedPrompt]);
  const confirmQueuedReset = q2(async () => {
    const count = queuedPromptsRef.current.length;
    if (count === 0) return true;
    if (!confirm(t4("chat.queueResetConfirm", { count }))) return false;
    const claimedQueueScope = queueStorageKey;
    try {
      const deleted = await deletePersistedQueuedPrompt();
      if (deleted?.ok === false) throw new Error(deleted.error || "队列清空失败");
    } catch (err) {
      setError(t4("chat.queueFailed", { error: err.message }));
      return false;
    }
    const attachmentIds = queuedPromptsRef.current.flatMap((item) => item.attachments ?? []);
    for (const attachmentId of attachmentIds) queuedAttachmentIdsRef.current.delete(attachmentId);
    void releaseUploadedImages(attachmentIds.map((attachmentId) => ({ attachmentId, sessionId: activeConversationId, workspace: workspaceDir })));
    if (queueStorageKeyRef.current !== claimedQueueScope) return true;
    setQueuedPrompts([]);
    setQueueSendingId(null);
    return true;
  }, [deletePersistedQueuedPrompt, activeConversationId, workspaceDir, queueStorageKey]);
  y2(() => {
    if (!queueReady || queuePaused || busy || queueSubmittingRef.current || queuedPrompts.length === 0) return;
    const item = queuedPrompts.find((q) => q.status !== "failed");
    if (!item) return;
    queueSubmittingRef.current = true;
    (async () => {
      try {
        setQueueSendingId(item.id);
        setQueuedPrompts((prev) => prev.map((q) => q.id === item.id ? { ...q, status: "sending", error: null } : q));
        await new Promise((resolve) => setTimeout(resolve, 300));
        const result = await submitPromptPayload(item);
        if (result.ok) {
          for (const attachmentId of item.attachments ?? []) queuedAttachmentIdsRef.current.delete(attachmentId);
          setQueuedPrompts((prev) => prev.filter((q) => q.id !== item.id));
          await deletePersistedQueuedPrompt(item.id);
          setTimeout(() => setQueuePumpTick((v) => v + 1), 700);
        } else if (result.busy) {
          setQueuedPrompts((prev) => prev.map((q) => q.id === item.id ? { ...q, status: "queued", error: null } : q));
          setTimeout(() => setQueuePumpTick((v) => v + 1), 900);
        } else if (result.credentialRequired) {
          setQueuePaused(true);
          setQueuedPrompts((prev) => prev.map((q) => q.id === item.id ? { ...q, status: "queued", error: null } : q));
          setSkillCredentialValue("");
          setSkillCredentialSetup({ ...result.credentialRequired, payload: item, queuedId: item.id });
        } else {
          const failedItem = { ...item, status: "failed", error: result.reason ?? "failed" };
          setQueuedPrompts((prev) => prev.map((q) => q.id === item.id ? failedItem : q));
          await persistQueuedPrompt(failedItem);
          setError(t4("chat.queueFailed", { error: result.reason ?? "failed" }));
          setTimeout(() => setQueuePumpTick((v) => v + 1), 700);
        }
      } finally {
        setQueueSendingId(null);
        queueSubmittingRef.current = false;
      }
    })();
  }, [busy, queuePaused, queuedPrompts, queuePumpTick, submitPromptPayload, persistQueuedPrompt, deletePersistedQueuedPrompt]);
  const send = q2(async () => {
    const text = inputValueRef.current.trim();
    const images = pendingImages.slice();
    if (!text && images.length === 0) return;
    setError(null);
    if (busy) {
      if (await enqueuePrompt(text, images)) {
        setChatInput("");
        pendingImagesRef.current = [];
        setPendingImages([]);
        setPopoverKind(null);
        removeChatDraft(draftKey);
      }
      return;
    }
    const result = await submitPromptPayload({
      text,
      images,
      attachments: images.map((image) => typeof image === "object" ? image.attachmentId : null).filter(Boolean),
    });
    if (result.ok) {
      setChatInput("");
      pendingImagesRef.current = [];
      setPendingImages([]);
      shouldAutoScroll.current = true;
      removeChatDraft(draftKey);
    } else if (result.busy) {
      if (await enqueuePrompt(text, images)) {
        setChatInput("");
        pendingImagesRef.current = [];
        setPendingImages([]);
        setPopoverKind(null);
        removeChatDraft(draftKey);
      }
    } else if (result.credentialRequired) {
      setSkillCredentialValue("");
      setSkillCredentialSetup({ ...result.credentialRequired, payload: { text, images } });
    } else {
      setError(result.reason ?? "rejected");
    }
  }, [busy, pendingImages, draftKey, enqueuePrompt, submitPromptPayload, setChatInput]);
  const saveSkillCredential = q2(async () => {
    if (!skillCredentialSetup || !skillCredentialValue.trim()) return;
    setSkillCredentialSaving(true);
    setError(null);
    try {
      await api(`/skills/credentials/${encodeURIComponent(skillCredentialSetup.skill)}`, {
        method: "POST",
        body: { apiKey: skillCredentialValue }
      });
      const payload = skillCredentialSetup.payload;
      setSkillCredentialSetup(null);
      setSkillCredentialValue("");
      const result = await submitPromptPayload(payload);
      if (result.ok) {
        if (skillCredentialSetup.queuedId) {
          for (const attachmentId of payload?.attachments ?? []) queuedAttachmentIdsRef.current.delete(attachmentId);
          setQueuedPrompts((prev) => prev.filter((item) => item.id !== skillCredentialSetup.queuedId));
          await deletePersistedQueuedPrompt(skillCredentialSetup.queuedId);
          setQueuePaused(false);
          setTimeout(() => setQueuePumpTick((value) => value + 1), 700);
        } else {
          setChatInput("");
          pendingImagesRef.current = [];
          setPendingImages([]);
          removeChatDraft(draftKey);
        }
        shouldAutoScroll.current = true;
      } else {
        setError(result.reason ?? "rejected");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSkillCredentialSaving(false);
    }
  }, [skillCredentialSetup, skillCredentialValue, submitPromptPayload, setChatInput, draftKey, deletePersistedQueuedPrompt]);
  const resumeIncompletePlan = q2(async () => {
    if (busy || !planContinuation) return;
    const paused = planContinuation;
    setPlanContinuation(null);
    const result = await submitPromptPayload({
      text: "继续执行当前未完成计划。不要重新制定计划，从中断处继续，完成实际产物并验证后再结束。"
    });
    if (!result.ok) {
      setPlanContinuation(paused);
      setError(result.reason ?? "继续执行失败");
    }
  }, [busy, planContinuation, submitPromptPayload]);
  const abort = q2(async () => {
    try {
      if (queuedPromptsRef.current.length > 0) setQueuePaused(true);
      setOperation((current) => current ? { ...current, state: "stopping", stopRequestedAt: new Date().toISOString() } : current);
      const result = await api("/abort", { method: "POST" });
      if (result.operation) setOperation(result.operation);
    } catch (err) {
      setError(err.message);
    }
  }, []);
  const waitForIdle = q2(async (timeoutMs = 5e3) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const state = await api("/messages?limit=1");
      if (!state.busy) return true;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return false;
  }, []);
  const newConversation = q2(async () => {
    const wasBusy = busy;
    if (busy) {
      if (!confirm(t4("chat.newConfirmBusy"))) return;
    } else if (messages.length > 0 && !confirm(t4("chat.newConfirm"))) {
      return;
    }
    if (!(await confirmQueuedReset())) return;
    try {
      if (wasBusy) {
        await api("/abort", { method: "POST" });
        const idle = await waitForIdle();
        if (!idle) throw new Error(t4("chat.stopTimeout"));
      }
      rotateUploadScope();
      await api("/submit", { method: "POST", body: { prompt: "/new" } });
      await releaseUploadedImages(pendingImages);
      const nextOverview = await api("/overview").catch(() => null);
      setActiveConversationId(nextOverview?.conversationId ?? null);
      const retrieval = await api("/index-retrieval-mode").catch(() => ({ mode: "tool" }));
      setIndexRetrievalMode(globalThis.VisionoxIndexModePolicy.normalize(retrieval.mode));
      setSemanticRetrievalSources([]);
      setSemanticRetrievalStatus("idle");
      setMessages([]);
      setTotalMessages(0);
      setVisibleMessageCount(CHAT_INITIAL_RENDER_COUNT);
      topLoadArmedRef.current = true;
      setStreaming(null);
      setActiveTool(null);
      setFileArtifacts([]);
      setFileArtifactsKey("");
      setFileArtifactsDismissed(false);
      setFileArtifactsSelectedMessageId(null);
      setFileArtifactsByMessageId({});
      setChatInput("");
      setPendingImages([]);
      setQueuedPrompts([]);
      setQueueSendingId(null);
      setQueuePaused(false);
      shouldAutoScroll.current = true;
      removeChatDraft(draftKey);
      showToast(t4("chat.newToast"), "info");
      setTimeout(async () => {
        try {
          const r3 = await api(`/messages?limit=${CHAT_MESSAGE_PAGE_SIZE}`);
          setMessages(r3.messages ?? []);
          setTotalMessages(r3.totalMessages ?? r3.messages?.length ?? 0);
        } catch {
        }
      }, 200);
    } catch (err) {
      setError(t4("chat.newFailed", { error: err.message }));
    }
  }, [busy, messages.length, draftKey, pendingImages, confirmQueuedReset, waitForIdle, setChatInput]);
  const changeIndexRetrievalMode = q2(async (event) => {
    const next = globalThis.VisionoxIndexModePolicy.normalize(event.target.value);
    try {
      const result = await api("/index-retrieval-mode", { method: "POST", body: { mode: next } });
      setIndexRetrievalMode(globalThis.VisionoxIndexModePolicy.normalize(result.mode, next));
      setSemanticRetrievalSources([]);
      setSemanticRetrievalStatus("idle");
      setShowRetrievalSources(false);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(null), 3e3);
    }
  }, []);
  const previewRetrievedSource = q2(async (source) => {
    if (!workspaceDir || !source?.path) return;
    try {
      await showFileArtifactPreview({ path: `${workspaceDir}/${source.path}` });
    } catch (err) {
      showToast(err.message || "索引来源预览失败", "error", 5e3);
    }
  }, [workspaceDir]);
  const clearScrollback = q2(async () => {
    if (!(await confirmQueuedReset())) return;
    try {
      rotateUploadScope();
      await api("/submit", { method: "POST", body: { prompt: "/clear" } });
      await releaseUploadedImages(pendingImages);
      const nextOverview = await api("/overview").catch(() => null);
      setActiveConversationId(nextOverview?.conversationId ?? activeConversationId);
      setMessages([]);
      setTotalMessages(0);
      setVisibleMessageCount(CHAT_INITIAL_RENDER_COUNT);
      topLoadArmedRef.current = true;
      setStreaming(null);
      setActiveTool(null);
      setFileArtifacts([]);
      setFileArtifactsKey("");
      setFileArtifactsDismissed(false);
      setFileArtifactsSelectedMessageId(null);
      setFileArtifactsByMessageId({});
      setChatInput("");
      setPendingImages([]);
      setQueuedPrompts([]);
      setQueueSendingId(null);
      setQueuePaused(false);
      shouldAutoScroll.current = true;
      removeChatDraft(draftKey);
      showToast(t4("chat.clearToast"), "info");
      setTimeout(async () => {
        try {
          const r3 = await api(`/messages?limit=${CHAT_MESSAGE_PAGE_SIZE}`);
          setMessages(r3.messages ?? []);
          setTotalMessages(r3.totalMessages ?? r3.messages?.length ?? 0);
        } catch {
        }
      }, 200);
    } catch (err) {
      setError(t4("chat.clearFailed", { error: err.message }));
    }
  }, [draftKey, pendingImages, confirmQueuedReset, setChatInput]);
  const updatePopover = q2(
    async (text) => {
      const slashMatch = /^\/([A-Za-z0-9_-]*)$/.exec(text);
      if (slashMatch) {
        const prefix = slashMatch[1].toLowerCase();
        const items = slashCommands.filter((c3) => c3.cmd.startsWith(prefix)).slice(0, 12).map((c3) => ({
          label: `/${c3.cmd}`,
          meta: (() => { const k = "chat.slashHints." + c3.cmd; const v = t4(k); return v === k ? c3.summary : v; })(),
          insert: `/${c3.cmd}${c3.argsHint ? " " : ""}`
        })).sort((a, b) => a.label === "/help" ? -1 : b.label === "/help" ? 1 : a.label.localeCompare(b.label));
        setPopoverKind("slash");
        setPopoverItems(items);
        setPopoverSel(0);
        return;
      }
      const mentionMatch = /@([^\s@]*)$/.exec(text);
      if (mentionMatch) {
        const prefix = mentionMatch[1] ?? "";
        const prefixLower = prefix.toLowerCase();
        try {
          const [skills, filesRes] = await Promise.all([
            loadChatSkills().catch(() => []),
            MODE === "attached" ? api("/files", { method: "POST", body: { prefix } }).catch(() => ({ files: [] })) : Promise.resolve({ files: [] })
          ]);
          const seenSkills = /* @__PURE__ */ new Set();
          const skillItems = skills.filter((s2) => {
            const name = String(s2.name ?? "");
            if (!name || seenSkills.has(name.toLowerCase())) return false;
            if (prefixLower && !name.toLowerCase().startsWith(prefixLower)) return false;
            seenSkills.add(name.toLowerCase());
            return true;
          }).map((s2) => ({
            label: s2.name,
            meta: `${t4("chat.skillMentionMeta")}${s2.description ? ` · ${s2.description}` : ""}`,
            insert: `@${s2.name} `,
            kind: "skill"
          }));
          const fileItems = (filesRes.files ?? []).slice(0, Math.max(0, 12 - skillItems.length)).map((f3) => ({
            label: f3,
            meta: t4("chat.projectFiles"),
            insert: `@${f3} `,
            kind: "file"
          }));
          const items = [...skillItems, ...fileItems];
          if (items.length === 0) {
            setPopoverKind(null);
            return;
          }
          setPopoverKind("mention");
          setPopoverItems(items);
          setPopoverSel(0);
        } catch {
          setPopoverKind(null);
        }
        return;
      }
      setPopoverKind(null);
    },
    [slashCommands, loadChatSkills]
  );
  const applyPopover = q2((idx) => {
    const item = popoverItems[idx ?? popoverSel];
    if (!item) return false;
    if (popoverKind === "slash") {
      setChatInput(item.insert);
    } else if (popoverKind === "mention") {
      const input = inputValueRef.current;
      const m3 = /@([^\s@]*)$/.exec(input);
      if (!m3) return false;
      const start = input.length - m3[0].length;
      setChatInput(`${input.slice(0, start)}${item.insert}`);
    }
    setPopoverKind(null);
    return true;
  }, [popoverItems, popoverSel, popoverKind, setChatInput]);
  const onInput = q2(
    (e3) => {
      const v3 = e3.target.value;
      inputValueRef.current = v3;
      const hasContent = Boolean(v3.trim());
      if (inputHasContentRef.current !== hasContent) {
        inputHasContentRef.current = hasContent;
        setInputHasContent(hasContent);
      }
      persistDraftSoon(v3);
      updatePopover(v3);
    },
    [updatePopover, persistDraftSoon]
  );
  const onKeyDown = q2(
    (e3) => {
      if (popoverKind && popoverItems.length > 0) {
        if (e3.key === "ArrowDown") {
          e3.preventDefault();
          setPopoverSel((i3) => (i3 + 1) % popoverItems.length);
          return;
        }
        if (e3.key === "ArrowUp") {
          e3.preventDefault();
          setPopoverSel((i3) => (i3 - 1 + popoverItems.length) % popoverItems.length);
          return;
        }
        if (e3.key === "Tab" || e3.key === "Enter" && !e3.shiftKey) {
          e3.preventDefault();
          if (applyPopover() && e3.key === "Enter" && popoverKind === "slash") {
            send();
          }
          return;
        }
        if (e3.key === "Escape") {
          e3.preventDefault();
          setPopoverKind(null);
          return;
        }
      }
      if (e3.key === "Enter" && !e3.shiftKey) {
        e3.preventDefault();
        send();
      }
    },
    [send, popoverKind, popoverItems, applyPopover]
  );
  var onPaste = q2(function(e) {
    e.preventDefault();
    var items = e.clipboardData?.items;
    var imageFiles = [];
    var fileNames = [];
    var fullPaths = [];
    var gotFullPaths = false;
    var plainText = "";
    function normalizeClipboardPathText(value) {
      return String(value || "").trim().replace(/^([A-Za-z]):(?![\\/])(?=\S)/, "$1:\\");
    }
    function pathLikeClipboardText(value) {
      var s = normalizeClipboardPathText(value);
      return /^[A-Za-z]:\\/.test(s) || s.startsWith("\\\\") || s.startsWith("/") || /^file:\/\//i.test(s);
    }
    function isImagePathName(value) {
      var s = String(value || "").trim().replace(/^file:\/\//i, "");
      s = s.split(/[?#]/, 1)[0];
      return /\.(?:png|jpe?g|gif|webp|bmp|tiff?|heic|heif|avif)$/i.test(s);
    }
    function decodeClipboardUri(value) {
      var raw = String(value || "").trim();
      if (!raw) return "";
      try {
        raw = decodeURIComponent(raw);
      } catch (_) {
        try { raw = decodeURI(raw); } catch (_) {}
      }
      if (/^file:\/\//i.test(raw)) {
        if (/^file:\/\/\/[A-Za-z]:/i.test(raw)) {
          return normalizeClipboardPathText(raw.replace(/^file:\/\/\//i, "").replace(/\//g, "\\"));
        }
        return normalizeClipboardPathText(raw.replace(/^file:\/\//i, ""));
      }
      return normalizeClipboardPathText(raw);
    }
    if (items) {
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (item.kind === "file") {
          var f = item.getAsFile();
          if (f?.name) fileNames.push(f.name);
          if (item.type.startsWith("image/") && f) imageFiles.push(f);
        }
      }
    }
    try {
      var uriList = e.clipboardData.getData("text/uri-list");
      if (uriList) {
        var uris = uriList.split(/\r?\n/).filter(function(s) { return s.trim() && !s.startsWith("#"); });
        fullPaths = uris.map(decodeClipboardUri).filter(Boolean);
        gotFullPaths = fullPaths.length > 0;
      }
    } catch (_) {}
    if (!gotFullPaths) {
      try {
        plainText = e.clipboardData.getData("text/plain") || "";
        if (plainText) {
          var lines = plainText.split(/\r?\n/).filter(function(s) { return s.trim(); });
          if (lines.length > 0 && pathLikeClipboardText(lines[0])) {
            fullPaths = lines.map(function(line) {
              return /^file:\/\//i.test(String(line || "").trim()) ? decodeClipboardUri(line) : normalizeClipboardPathText(line);
            }).filter(Boolean);
            gotFullPaths = true;
          }
        }
      } catch (_) {}
    }
    if (!gotFullPaths && fileNames.length > 0) {
      fullPaths = fileNames;
    }
    var inIframe = false;
    try { inIframe = window.parent !== window; } catch (_) {}

    var ta = e.target;
    var start = ta.selectionStart;
    var end = ta.selectionEnd;
    var input = inputValueRef.current;
    var before = input.slice(0, start);
    var after = input.slice(end);
    var inserted = false;
    function insertAtCursor(txt) {
      if (inserted) return;
      inserted = true;
      setChatInput(before + txt + after);
      setTimeout(function() {
        ta.selectionStart = ta.selectionEnd = start + txt.length;
      }, 0);
    }
    function addPendingImages(files) {
      var remaining = pendingImageLimit - pendingImages.length;
      if (remaining <= 0) return;
      var toProcess = files.slice(0, remaining);
      const scope = currentUploadScope();
      Promise.all(toProcess.map(function(f2) {
        return uploadMediaAttachment(f2, scope).catch(function(error) {
          if (error?.name === "AbortError") return null;
          console.error("Clipboard image upload failed:", error);
          return null;
        });
      })).then(function(results) {
        var valid = results.filter(function(r) { return r !== null; });
        if (uploadScopeRef.current !== scope || scope.controller.signal.aborted) {
          void releaseUploadedImages(valid);
          return;
        }
        if (valid.length > 0) {
          setPendingImages(pendingImages.slice().concat(valid).slice(0, pendingImageLimit));
        }
      });
    }
    function showClipboardNotice(msg) {
      setError(msg);
      setTimeout(function() { setError(null); }, 3000);
    }
    function looksLikeClipboardScreenshot() {
      if (imageFiles.length === 0 || gotFullPaths) return false;
      if (plainText.trim()) return false;
      if (fileNames.length === 0) return true;
      if (fileNames.length !== imageFiles.length) return false;
      return fileNames.every(function(name) {
        return /^(?:image|clipboard|screenshot|截图)(?:[-_\s]?\d+)?\.(?:png|jpe?g|gif|webp|bmp)$/i.test(String(name || "").trim());
      });
    }
    function shouldPasteImagesAsAttachments() {
      if (imageFiles.length === 0) return false;
      if (looksLikeClipboardScreenshot()) return true;
      if (fileNames.length > 0 && fileNames.length === imageFiles.length && fileNames.every(isImagePathName)) return true;
      if (gotFullPaths && fullPaths.length > 0 && fullPaths.every(isImagePathName)) return true;
      if (fileNames.length === 0 && !pathLikeClipboardText(plainText.split(/\r?\n/).find(function(s) { return s.trim(); }) || "")) return true;
      return false;
    }
    function insertPlainTextIfUsefulWithImages() {
      var text = plainText || "";
      if (!text.trim()) return;
      var first = text.split(/\r?\n/).find(function(s) { return s.trim(); }) || "";
      if (pathLikeClipboardText(first) || /^https?:\/\//i.test(first.trim())) return;
      insertAtCursor(text);
    }
    function shouldQueryClipboardPaths() {
      if (fileNames.length > 0) return true;
      if (imageFiles.length > 0) return false;
      if (gotFullPaths && fullPaths.length > 0) return false;
      if (plainText.trim()) return false;
      return true;
    }
    if (shouldPasteImagesAsAttachments()) {
      addPendingImages(imageFiles);
      insertPlainTextIfUsefulWithImages();
    } else if (shouldQueryClipboardPaths()) {
      var capBefore = before, capAfter = after, capStart = start;
      function insertPaths(paths) {
        if (inserted) return;
        inserted = true;
        var text = paths.map(normalizeClipboardPathText).join("\n");
        setChatInput(capBefore + text + capAfter);
        setTimeout(function() {
          ta.selectionStart = ta.selectionEnd = capStart + text.length;
        }, 0);
      }
      function fallbackPaste() {
        if (inserted) return;
        if (imageFiles.length > 0) {
          addPendingImages(imageFiles);
        } else if (gotFullPaths && fullPaths.length > 0) {
          insertPaths(fullPaths);
        } else if (plainText) {
          insertAtCursor(plainText);
        } else if (fileNames.length > 0) {
          showClipboardNotice("无法读取剪贴板中的文件路径，请重新复制文件或文件夹。");
        }
      }
      function tryServerClipboardPaths() {
        var clipboardUrl = "/api/clipboard-files" + (TOKEN ? "?token=" + encodeURIComponent(TOKEN) : "");
        fetch(clipboardUrl).then(function(r) { return r.json(); }).then(function(data) {
          var paths = data.paths || [];
          if (paths.length > 0) insertPaths(paths);
          else fallbackPaste();
        }).catch(fallbackPaste);
      }
      function tryRustBridge() {
        if (!inIframe) {
          tryServerClipboardPaths();
          return;
        }
        try {
          var handled = false;
          var listener = function(e2) {
            if (e2.data && e2.data.type === 'vis_clipboard_result') {
              handled = true;
              window.removeEventListener('message', listener);
              clearTimeout(timer);
              if (e2.data.paths && e2.data.paths.length > 0) {
                insertPaths(e2.data.paths.slice());
              } else {
                tryServerClipboardPaths();
              }
            }
          };
          window.addEventListener('message', listener);
          window.parent.postMessage({ type: 'vis_get_clipboard' }, '*');
          var timer = setTimeout(function() {
            if (!handled) {
              window.removeEventListener('message', listener);
              tryServerClipboardPaths();
            }
          }, 1000);
        } catch (_) {
          tryServerClipboardPaths();
        }
      }
      tryRustBridge();
    } else if (gotFullPaths && fullPaths.length > 0) {
      insertAtCursor(fullPaths.map(normalizeClipboardPathText).join("\n"));
    } else {
      try {
        var text = e.clipboardData.getData("text/plain");
        if (text) insertAtCursor(text);
      } catch (_) {}
    }
  }, [pendingImages, pendingImageLimit, setChatInput, uploadScopeKey]);
  y2(() => {
    if (bootError) return;
    const el = feedRef.current;
    if (!el) return;
    const maybeLoadEarlier = () => {
      if (el.scrollTop > CHAT_TOP_LOAD_THRESHOLD || scrollbarDraggingRef.current || loadingEarlierRef.current || !topLoadArmedRef.current) return;
      topLoadArmedRef.current = false;
      void loadEarlierMessagesRef.current?.();
    };
    const onScroll = () => {
      if (autoScrollInFlight.current) return;
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      shouldAutoScroll.current = distFromBottom < 80;
      if (el.scrollTop > CHAT_TOP_LOAD_THRESHOLD * 2) topLoadArmedRef.current = true;
      maybeLoadEarlier();
    };
    const onPointerDown = (event) => {
      const rect = el.getBoundingClientRect();
      const scrollbarWidth = Math.max(14, rect.width - el.clientWidth);
      if (el.scrollHeight > el.clientHeight && event.clientX >= rect.right - scrollbarWidth) {
        scrollbarDraggingRef.current = true;
      }
    };
    const onPointerUp = () => {
      if (!scrollbarDraggingRef.current) return;
      scrollbarDraggingRef.current = false;
      maybeLoadEarlier();
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [bootError]);
  y2(() => {
    if (!shouldAutoScroll.current) return;
    const el = feedRef.current;
    if (!el) return;
    autoScrollInFlight.current = true;
    el.scrollTop = el.scrollHeight;
    setTimeout(() => {
      autoScrollInFlight.current = false;
    }, 0);
  }, [messages, streaming]);
  const resolveModal = q2(async (kind, choice, text) => {
    if (modalResolving || !modal) return;
    const gateModal = kind === "shell" || kind === "choice" || kind === "plan" || kind === "checkpoint" || kind === "revision";
    if (gateModal && !Number.isInteger(modal._gateId)) return;
    const submittedModal = modal;
    const gateId = modal._gateId;
    setModalResolving(true);
    try {
      await api("/modal/resolve", {
        method: "POST",
        body: text !== void 0
          ? { kind, choice, text, ...(gateModal ? { gateId } : {}) }
          : { kind, choice, ...(gateModal ? { gateId } : {}) }
      });
      setModal((cur) => gateModal ? cur?._gateId === gateId ? null : cur : cur === submittedModal ? null : cur);
    } catch (err) {
      setError(`modal resolve failed: ${err.message}`);
    } finally {
      setModalResolving(false);
    }
  }, [modal, modalResolving]);
  y2(() => {
    if (!modal) return;
    const frame = requestAnimationFrame(() => {
      document.querySelector(".modal-card .modal-actions .primary, .modal-card .modal-choice-row")?.focus?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [modal?._gateId]);
  y2(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const o3 = await api("/overview");
        if (cancelled) return;
        setEditModeLocal(o3.editMode ?? null);
        setPresetLocal(o3.preset ?? null);
        setEffortLocal(o3.reasoningEffort ?? null);
        setModeLocal(o3.workMode ?? "general");
        setModesLocal(o3.modes ?? null);
        setActiveModeLocal(o3.activeMode ?? null);
        setEccRulesLocal(o3.eccRules ?? null);
        setWorkspaceDirLocal(o3.cwd ?? null);
        setActiveConversationId(o3.conversationId ?? null);
        setStats(o3.stats ?? null);
        setOverviewModel(o3.model ?? null);
        setBudgetUsd(o3.budgetUsd ?? null);
        setActiveProviderId(o3.activeProviderId ?? null);
        setProviderCaps(o3.providerCapabilities ?? null);
        if (!providers) {
          try {
            const pr = await api("/providers");
            if (!cancelled) {
              setProviders(pr.providers ?? []);
              setModelVerification(pr.modelVerification ?? null);
            }
          } catch {}
        }
        try {
          const plans = await api("/plans");
          if (!cancelled) setActivePlan((plans.plans ?? []).find((p3) => ["active", "pending"].includes(planStatus(p3))) ?? null);
        } catch {
          if (!cancelled) setActivePlan(null);
        }
        setSemanticIndex(o3.semanticIndexExists ?? null);
      } catch {
      }
    };
    tick();
    const unsubscribe = subscribeSse("overview", (o3) => {
      if (cancelled) return;
      setEditModeLocal(o3.editMode ?? null);
      setPresetLocal(o3.preset ?? null);
      setEffortLocal(o3.reasoningEffort ?? null);
      setModeLocal(o3.workMode ?? "general");
      setModesLocal(o3.modes ?? null);
      setActiveModeLocal(o3.activeMode ?? null);
      setEccRulesLocal(o3.eccRules ?? null);
      setWorkspaceDirLocal(o3.cwd ?? null);
      setActiveConversationId(o3.conversationId ?? null);
      setStats(o3.stats ?? null);
      setOverviewModel(o3.model ?? null);
      setBudgetUsd(o3.budgetUsd ?? null);
      setActiveProviderId(o3.activeProviderId ?? null);
      setProviderCaps(o3.providerCapabilities ?? null);
      setSemanticIndex(o3.semanticIndexExists ?? null);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);
  const setEditMode = q2(async (next) => {
    if (next === "yolo" || next === "admin") {
      const msg = next === "admin"
        ? "\u5207\u6362\u5230 admin \u6A21\u5F0F\u5C06\u79FB\u9664\u6240\u6709\u5B89\u5168\u9650\u5236\uFF08Shell \u548C\u6587\u4EF6\u7CFB\u7EDF\u5747\u65E0\u9650\u5236\uFF09\u3002\u786E\u5B9A\uFF1F"
        : "\u5207\u6362\u5230 yolo \u6A21\u5F0F\u5C06\u81EA\u52A8\u6267\u884C\u6240\u6709 Shell \u547D\u4EE4\uFF08\u4E0D\u518D\u9010\u6761\u786E\u8BA4\uFF09\u3002\u786E\u5B9A\uFF1F";
      if (!confirm(msg)) return;
    }
    setEditModeLocal(next);
    try {
      await api("/edit-mode", { method: "POST", body: { mode: next } });
    } catch (err) {
      setError(`mode switch failed: ${err.message}`);
      try {
        const o3 = await api("/overview");
        setEditModeLocal(o3.editMode ?? null);
      } catch {
      }
    }
  }, []);
  const setSetting = q2(async (key, value) => {
    const modelMenuSetting = key === "preset" || key === "reasoningEffort" || key === "model";
    if (modelMenuSetting) pushModelNotice("正在应用模型设置...", "info", 0);
    if (key === "preset") setPresetLocal(value);
    if (key === "reasoningEffort") setEffortLocal(value);
    if (key === "mode") setModeLocal(value);
    try {
      const updated = await api("/settings", { method: "POST", body: { [key]: value } });
      if (key === "mode") showToast("工作场景已切换，下次新对话生效", "info");
      if ((key === "preset" || key === "model") && updated?.modelSwitch) {
        const switched = updated.modelSwitch;
        const count = Number.isFinite(switched.messageCount) ? switched.messageCount : 0;
        const adaptation = switched.contextStatus?.needsCompaction ? "，发送下一条消息前将自动整理历史" : "";
        pushModelNotice(switched.deferred
          ? `已选择 ${switched.model}，将在当前回答结束后切换，保留 ${count} 条上下文${adaptation}`
          : `✓ 已切换到 ${switched.model}，保留 ${count} 条上下文${adaptation}`, "success");
      } else if (key === "preset") {
        pushModelNotice(`✓ 已选择 ${value} 模式`, "success");
      } else if (key === "reasoningEffort") {
        pushModelNotice(`✓ 推理强度已设为 ${reasoningEffortLabel(value)}`, "success");
      }
      try {
        const o3 = await api("/overview");
        setStats(o3.stats ?? null);
        setOverviewModel(o3.model ?? null);
        setPresetLocal(o3.preset ?? null);
        setEffortLocal(o3.reasoningEffort ?? null);
      } catch {}
    } catch (err) {
      if (modelMenuSetting) pushModelNotice(`切换失败：${err.message}`, "error", 5e3);
      else setError(`${key} switch failed: ${err.message}`);
      try {
        const o3 = await api("/overview");
        setPresetLocal(o3.preset ?? null);
        setEffortLocal(o3.reasoningEffort ?? null);
        setModeLocal(o3.workMode ?? "general");
        setModesLocal(o3.modes ?? null);
        setActiveModeLocal(o3.activeMode ?? null);
        setEccRulesLocal(o3.eccRules ?? null);
      } catch {
      }
    }
  }, [pushModelNotice]);
  const selectProviderModel = q2(async (providerId, modelId) => {
    pushModelNotice("正在切换模型...", "info", 0);
    try {
      const switched = await api("/providers/active", { method: "POST", body: { id: providerId, modelId } });
      const [pr, overview] = await Promise.all([api("/providers"), api("/overview")]);
      setProviders(pr.providers ?? []);
      setModelVerification(pr.modelVerification ?? null);
      setActiveProviderId(overview.activeProviderId ?? providerId);
      setProviderCaps(overview.providerCapabilities ?? pr.providerCapabilities ?? null);
      setPresetLocal(overview.preset ?? switched.preset ?? null);
      setEffortLocal(overview.reasoningEffort ?? null);
      setOverviewModel(overview.model ?? modelId);
      const count = switched?.modelSwitch?.messageCount;
      pushModelNotice(Number.isFinite(count) ? `✓ 已切换模型，保留 ${count} 条上下文` : "✓ 模型已切换", "success");
    } catch (err) {
      pushModelNotice(`切换失败：${err.message}`, "error", 5e3);
    }
  }, [pushModelNotice]);
  const confirmProviderImport = q2(async (draft, plan) => {
    pushModelNotice("正在导入模型配置...", "info", 0);
    try {
      await api("/providers/import", {
        method: "POST",
        body: { ...draft, confirmDestructive: plan.requiresConfirmation === true }
      });
      const [pr, overview] = await Promise.all([api("/providers"), api("/overview")]);
      setProviders(pr.providers ?? []);
      setModelVerification(pr.modelVerification ?? null);
      setActiveProviderId(overview.activeProviderId ?? null);
      setProviderCaps(overview.providerCapabilities ?? null);
      setPresetLocal(overview.preset ?? null);
      setEffortLocal(overview.reasoningEffort ?? null);
      setOverviewModel(overview.model ?? null);
      pushModelNotice("✓ 配置导入成功，请检测模型", "success", 5e3);
    } catch (err) {
      pushModelNotice(`导入失败：${err.message}`, "error", 5e3);
    }
  }, [pushModelNotice]);
  const loadProviderImportFile = q2(async (event) => {
    const file = event.target.files?.[0];
    if (!file || providerImporting) return;
    setProviderImporting(true);
    pushModelNotice("正在检查模型配置...", "info", 0);
    try {
      const draft = parseProviderImportJson(await file.text());
      const plan = await api("/providers/import/preview", { method: "POST", body: draft });
      if (plan.requiresConfirmation === true && !confirm("该配置会永久删除现有模型，确认继续导入吗？")) {
        pushModelNotice("已取消导入", "info");
        return;
      }
      await confirmProviderImport(draft, plan);
    } catch (err) {
      pushModelNotice(`导入失败：${err.message}`, "error", 5e3);
    } finally {
      setProviderImporting(false);
    }
  }, [providerImporting, confirmProviderImport, pushModelNotice]);
  const testAllProviders = q2(async () => {
    if (providerTesting) return;
    setProviderTesting(true);
    pushModelNotice("正在检测全部模型...", "info", 0);
    try {
      const tested = await api("/providers/test", { method: "POST", body: {} });
      const [pr, overview] = await Promise.all([api("/providers"), api("/overview")]);
      setProviders(pr.providers ?? []);
      setModelVerification(pr.modelVerification ?? null);
      setActiveProviderId(overview.activeProviderId ?? null);
      setProviderCaps(overview.providerCapabilities ?? null);
      setPresetLocal(overview.preset ?? null);
      setEffortLocal(overview.reasoningEffort ?? null);
      setOverviewModel(overview.model ?? null);
      const failed = tested.total - tested.passed;
      pushModelNotice(failed > 0 ? `检测完成：${tested.passed} 个可用，${failed} 个不可用` : `✓ ${tested.passed} 个模型全部可用`, failed > 0 ? "error" : "success", 5e3);
    } catch (err) {
      pushModelNotice(`模型检测失败：${err.message}`, "error", 5e3);
    } finally {
      setProviderTesting(false);
    }
  }, [providerTesting, pushModelNotice]);
  const cleanupFailedModels = q2(async () => {
    const failed = providerModelTestSummary(providers ?? []).failed;
    if (!failed || !modelVerification?.testedAt || providerCleaning) return;
    if (!confirm(`将删除 ${failed} 个检测失败模型，不影响可用模型。确认继续吗？`)) return;
    setProviderCleaning(true);
    pushModelNotice("正在删除检测失败模型...", "info", 0);
    try {
      const cleaned = await api("/providers/cleanup-failed", { method: "POST", body: { testedAt: modelVerification.testedAt } });
      const [pr, overview] = await Promise.all([api("/providers"), api("/overview")]);
      setProviders(pr.providers ?? []);
      setModelVerification(pr.modelVerification ?? null);
      setActiveProviderId(overview.activeProviderId ?? cleaned.activeProviderId ?? null);
      setProviderCaps(overview.providerCapabilities ?? pr.providerCapabilities ?? null);
      setPresetLocal(overview.preset ?? null);
      setEffortLocal(overview.reasoningEffort ?? null);
      setOverviewModel(overview.model ?? cleaned.activeModelId ?? null);
      pushModelNotice(`✓ 已删除 ${cleaned.removedModels} 个不可用模型`, "success", 5e3);
    } catch (err) {
      pushModelNotice(`删除失败：${err.message}`, "error", 5e3);
    } finally {
      setProviderCleaning(false);
    }
  }, [providers, modelVerification, providerCleaning, pushModelNotice]);
  const pickWorkspace = q2(async (dir) => {
    setShowWsPicker(false);
    try {
      const result = await api("/workspaces", { method: "POST", body: { path: dir } });
      setWorkspaceSelection(result);
      setRecentWss(result.recentWorkspaces ?? []);
      showToast(t4("chat.workspaceChanged", { path: result.configured }), "info", 5e3);
    } catch (err) {
      setError(err.message);
    }
  }, []);
  const loadWorkspaceOptions = q2(async () => {
    try {
      const result = await api("/workspaces");
      setWorkspaceSelection(result);
      setRecentWss(result.recentWorkspaces ?? []);
    } catch (err) {
      setError(err.message);
    }
  }, []);
  const removeWorkspaceOption = q2(async (path) => {
    try {
      const result = await api("/workspaces", { method: "DELETE", body: { path } });
      setWorkspaceSelection(result);
      setRecentWss(result.recentWorkspaces ?? []);
    } catch (err) {
      setError(err.message);
    }
  }, []);
  const browseWorkspace = q2(async () => {
    setShowWsPicker(false);
    let path = "";
    try {
      path = await pickWorkspaceDirectoryFromBridge();
    } catch {
      path = prompt(t4("chat.workspaceManual")) || "";
    }
    if (path.trim()) await pickWorkspace(path.trim());
  }, [pickWorkspace]);
  const copyMessage = q2(async (msg) => {
    const text = (msg.text ?? "").trim();
    if (!text) return;
    try {
      await writeClipboardText(text);
      showToast(t4("chat.copiedMessage"), "info");
    } catch (err) {
      setError(t4("chat.copyFailed", { error: err.message }));
    }
  }, [draftKey]);
  const fillInputFromMessage = q2((msg) => {
    const text = msg.text ?? "";
    if (!text.trim()) return;
    setChatInput(text);
    setPopoverKind(null);
    setTimeout(() => {
      inputRef.current?.focus();
      try {
        inputRef.current.selectionStart = inputRef.current.selectionEnd = text.length;
      } catch {
      }
    }, 0);
    showToast(t4("chat.filledInput"), "info");
  }, [setChatInput]);
  const selectArtifactMessage = q2((msg) => {
    setFileArtifactsSelectedMessageId(String(msg.id || ""));
    setFileArtifactsDismissed(false);
  }, []);
  const followLatestArtifacts = q2(() => {
    setFileArtifactsSelectedMessageId(null);
    setFileArtifactsDismissed(false);
  }, []);
  const dismissArtifacts = q2(() => setFileArtifactsDismissed(true), []);
  const loadEarlierMessages = q2(async () => {
    if (loadingEarlierRef.current) return;
    const feed = feedRef.current;
    const anchor = captureChatScrollAnchor(feed);
    const finishLoading = () => {
      loadingEarlierRef.current = false;
      setLoadingEarlierMessages(false);
    };
    if (visibleMessageCount < messages.length) {
      loadingEarlierRef.current = true;
      setLoadingEarlierMessages(true);
      setVisibleMessageCount((count) => Math.min(messages.length, count + CHAT_RENDER_STEP));
      restoreChatScrollAnchor(feed, anchor, finishLoading);
      return;
    }
    if (messages.length >= totalMessages) return;
    loadingEarlierRef.current = true;
    setLoadingEarlierMessages(true);
    try {
      const data = await api(`/messages?limit=${CHAT_MESSAGE_PAGE_SIZE}&offset=${messages.length}`);
      const earlier = Array.isArray(data.messages) ? data.messages : [];
      if (earlier.length > 0) {
        setMessages((current) => [...earlier, ...current]);
        setVisibleMessageCount((count) => count + Math.min(CHAT_RENDER_STEP, earlier.length));
      }
      setTotalMessages(data.totalMessages ?? totalMessages);
      restoreChatScrollAnchor(feed, anchor, finishLoading);
    } catch (err) {
      setError(err.message);
      finishLoading();
    }
  }, [visibleMessageCount, messages, totalMessages]);
  y2(() => {
    loadEarlierMessagesRef.current = loadEarlierMessages;
  }, [loadEarlierMessages]);
  const activeInputModalities = activeModel?.capabilities?.inputModalities ?? (activeModel?.multimodal ? ["text", "image"] : ["text"]);
  const canUploadImages = activeInputModalities.includes("image");
  const canUploadVideos = activeProvider?.providerType === "kimi" && activeInputModalities.includes("video");
  const canUploadMedia = canUploadImages || canUploadVideos;
  const acceptedAttachmentTypes = canUploadVideos
    ? `${canUploadImages ? "image/*," : ""}video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm`
    : "image/*";
  const activeModelEfforts = Array.isArray(activeModel?.efforts) ? activeModel.efforts : [];
  y2(() => {
    if (pendingImages.length === 0) return;
    const retained = pendingImages.filter((item) => {
      if (typeof item === "string") return canUploadImages;
      return item?.kind === "video" ? canUploadVideos : canUploadImages;
    });
    if (retained.length === pendingImages.length) return;
    const removed = pendingImages.filter((item) => !retained.includes(item));
    void releaseUploadedImages(removed);
    setPendingImages(retained);
  }, [canUploadImages, canUploadVideos]);
  if (bootError) {
    return html4`<div class="notice err">${t4("common.loadingFailed", { name: "chat", error: bootError })}</div>`;
  }
  return html4`
    <div class="chat-shell">
      <div class="chat-toolbar">
        <div class="header-pickers">${modes ? html4`
              <div class="work-mode-summary" title=${activeMode?.hint || "切换后下次新对话生效"}>
                <span class="work-mode-label">${activeMode?.label ?? mode}</span>
                <span class="work-mode-desc">${activeMode?.description ?? "切换工作场景"}</span>
                <span class="work-mode-meta">ECC ${(activeMode?.effectiveRules ?? activeMode?.rules ?? []).join("+") || "未启用"}${eccRules?.available ? ` · ${(eccRules.enabled ?? []).length}/${eccRules.available.length}` : ""}</span>
              </div>
              <div class="mode-picker work-mode-picker" title="工作场景 \u2014 下次新对话生效">
                ${modes.map((m) => html4`
                  <button
                    key=${m.id}
                    class="mode-btn ${mode === m.id ? "active accent" : ""}"
                    onClick=${() => setSetting("mode", m.id)}
                    title="${m.label}: ${m.description || "切换工作场景"} · ECC ${(m.effectiveRules||m.rules||[]).join("+")} · 下次新对话生效"
                  >${m.label}</button>
                `)}
              </div>
            ` : null}
          ${editMode ? html4`
              <div class="mode-picker" title=${t4("chat.editGateTitle")}>
                ${["auto", "yolo", "admin"].map(
    (m3) => html4`
                  <button
                    key=${m3}
                    class="mode-btn ${editMode === m3 ? "active" : ""} ${m3 === "auto" ? "auto" : ""} ${m3 === "yolo" ? "yolo" : ""} ${m3 === "admin" ? "admin" : ""}"
                    onClick=${() => setEditMode(m3)}
                    title=${m3 === "auto" ? t4("chat.editAutoTitle") : m3 === "yolo" ? t4("chat.editYoloTitle") : t4("chat.editAdminTitle")}
                  >${m3}</button>
                `
  )}
              </div>
            ` : null}
        </div>
      </div>

      ${!busy && statusLine ? html4`<div class="chat-status"><span class="muted">${statusLine}</span></div>` : null}
      ${!eventStreamConnected ? html4`<div class="chat-banner"><span class="chat-banner-icon">!</span><span class="chat-banner-text">${t4("chat.reconnecting")}</span></div>` : null}
      ${semanticIndex === false && !semanticBannerDismissed ? html4`<div class="chat-banner">
              <span class="chat-banner-icon">≈</span>
              <span class="chat-banner-text">
                <strong>${t4("chat.semanticBanner")}</strong>
                <span class="muted">
                  ${t4("chat.semanticBannerDesc")}
                </span>
              </span>
              <button
                class="primary"
                onClick=${() => appBus.dispatchEvent(new CustomEvent("navigate-tab", { detail: { tabId: "semantic" } }))}
              >${t4("chat.semanticBannerBtn")}</button>
              <button
                class="chat-banner-close"
                onClick=${() => setSemanticBannerDismissed(true)}
                title=${t4("chat.semanticBannerDismiss")}
              >×</button>
            </div>` : null}
      ${error ? html4`<div class="notice err">${error}</div>` : null}

      <div class=${`chat-body ${!showBackgroundJobs && (activePlan || fileArtifacts.length && !fileArtifactsDismissed) ? "with-rail" : ""}`}>
        <div class="chat-main">
          ${showBackgroundJobs ? html4`<${BackgroundJobsWorkbench}
            jobs=${backgroundJobs}
            pendingDeliveries=${pendingDeliveries}
            selectedId=${selectedBackgroundJobId}
            detail=${backgroundJobDetail}
            onSelect=${openBackgroundWorkbench}
            onClose=${closeBackgroundWorkbench}
            onControl=${controlDocumentJob}
            onStop=${stopBackgroundJob}
            onAbandon=${abandonBackgroundJob}
            onDelete=${deleteBackgroundJobRecord}
            onPreview=${previewDocumentJob}
          />` : html4`<${ChatFeed}
            messages=${messages}
            totalMessages=${totalMessages}
            streaming=${streaming}
            reasoningExpanded=${reasoningExpanded}
            innerRef=${feedRef}
            visibleCount=${visibleMessageCount}
            onLoadEarlier=${loadEarlierMessages}
            loadingEarlier=${loadingEarlierMessages}
            highlightMessageId=${highlightMessageId}
            onCopyMessage=${copyMessage}
            onFillInput=${fillInputFromMessage}
            userAvatar=${userAvatar}
            selectedArtifactMessageId=${fileArtifactsSelectedMessageId}
            onSelectArtifactMessage=${selectArtifactMessage}
          />`}

          ${modal ? html4`<div class=${modalResolving ? "modal-resolving" : ""}>${modal.kind === "shell" ? html4`<${ShellModal} modal=${modal} onResolve=${resolveModal} />` : modal.kind === "choice" ? html4`<${ChoiceModal} modal=${modal} onResolve=${resolveModal} />` : modal.kind === "plan" ? html4`<${PlanModal} modal=${modal} onResolve=${resolveModal} />` : modal.kind === "edit-review" ? html4`<${EditReviewModal} modal=${modal} onResolve=${resolveModal} />` : modal.kind === "workspace" ? html4`<${WorkspaceModal} modal=${modal} onResolve=${resolveModal} />` : modal.kind === "checkpoint" ? html4`<${CheckpointModal} modal=${modal} onResolve=${resolveModal} />` : modal.kind === "revision" ? html4`<${RevisionModal} modal=${modal} onResolve=${resolveModal} />` : modal.kind === "picker" ? html4`<${PickerModal} modal=${modal} onResolve=${resolveModal} />` : modal.kind === "viewer" ? html4`<${ViewerModal} modal=${modal} onResolve=${resolveModal} />` : null}</div>` : null}

          ${!showBackgroundJobs && planContinuation ? html4`
            <div class="plan-continuation-bar" role="status">
              <span class="plan-continuation-icon">!</span>
              <span class="plan-continuation-text">
                计划尚未完成 · ${planContinuation.completedSteps}/${planContinuation.totalSteps} 步
                <small>已自动续跑 ${planContinuation.attempts} 次</small>
              </span>
              <button type="button" class="primary" onClick=${resumeIncompletePlan} disabled=${busy}>继续执行</button>
              <button type="button" class="plan-continuation-dismiss" onClick=${() => setPlanContinuation(null)} title="暂时关闭">×</button>
            </div>
          ` : null}

          ${!showBackgroundJobs && todos.length > 0 ? html4`<${TodoBar} todos=${todos} expanded=${todoExpanded} onToggle=${() => setTodoExpanded(!todoExpanded)} />` : null}

          <div class="chat-input-area" style="position:relative;flex-direction:column;gap:2px;padding-top:6px">
            ${popoverKind && popoverItems.length > 0 ? html4`
                  <div class="popover" style="position:absolute;bottom:calc(100% + 6px);left:0;width:380px;max-height:280px;overflow-y:auto;z-index:10">
                    <div class="popover-h">${popoverKind === "slash" ? t4("chat.slashCommands") : t4("chat.mentionTargets")}</div>
                    ${popoverItems.map(
    (it, i3) => html4`
                        <div
                          class=${`popover-row ${i3 === popoverSel ? "sel" : ""}`}
                          onMouseDown=${(e3) => {
      e3.preventDefault();
      setPopoverSel(i3);
      applyPopover(i3);
    }}
                        >
                          <span class="g">${popoverKind === "slash" ? "/" : it.kind === "skill" ? "S" : "@"}</span>
                          <span class="name">${it.label}</span>
                          ${it.meta ? html4`<span class="meta">${it.meta}</span>` : null}
                        </div>
                      `
  )}
                  </div>
                ` : null}
            <div style="flex:1;display:flex;flex-direction:column;gap:2px;min-width:0">
              <div style="display:flex;gap:6px;align-items:flex-end">
            <div style="flex:1;display:flex;flex-direction:column;gap:2px;min-width:0">
            ${canUploadMedia ? html4`<input type="file" accept=${acceptedAttachmentTypes} multiple onChange=${handleFileChange} ref=${fileInputRef} style="display:none" />` : null}
            ${pendingImages.length > 0 ? html4`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px">${pendingImages.map(function(image, idx) { const preview = typeof image === "string" ? image : image?.preview; const isVideo = typeof image === "object" && image?.kind === "video"; return html4`<div style="position:relative;width:56px;height:56px;border-radius:4px;overflow:hidden;border:1px solid var(--border-default,#2a2e38);flex-shrink:0" title=${typeof image === "object" ? image.name : "图片"}>${preview ? html4`<img src=${preview} style="width:100%;height:100%;object-fit:cover" />` : html4`<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;font-size:11px;color:var(--text-muted)">${isVideo ? "视频" : "图片"}</span>`}<button onClick=${function() { void releaseUploadedImages([image]); var next = pendingImages.slice(); next.splice(idx, 1); setPendingImages(next); }} style="position:absolute;top:2px;right:2px;width:18px;height:18px;background:rgba(248,113,113,0.95);color:#fff;border:none;border-radius:50%;font-size:10px;line-height:18px;cursor:pointer;padding:0;box-shadow:0 1px 3px rgba(0,0,0,0.3);opacity:1;display:flex;align-items:center;justify-content:center;" title="删除附件">✕</button></div>`; })}</div>` : null}
            ${queuedPrompts.length > 0 ? html4`
              <div class="chat-queue">
                ${queuePaused ? html4`<div class="chat-queue-paused"><span>${t4("chat.queuePaused")}</span><button type="button" onClick=${() => { setQueuePaused(false); setQueuePumpTick((v) => v + 1); }}>${t4("chat.queueResume")}</button></div>` : null}
                <div class="chat-queue-head">
                  <span>${t4("chat.queueTitle", { count: queuedPrompts.length, max: CHAT_QUEUE_LIMIT })}</span>
                  ${queuedPrompts.length > 1 ? html4`<button type="button" onClick=${clearQueuedPrompts}>${t4("chat.queueClear")}</button>` : null}
                </div>
                <div class="chat-queue-list">
                  ${queuedPrompts.map((item, idx) => {
                    const imageCount = Math.max(item.images?.length ?? 0, item.attachments?.length ?? 0);
                    const text = item.text || t4("chat.queueImagesOnly", { count: imageCount });
                    const isSending = item.status === "sending" || queueSendingId === item.id;
                    const isFailed = item.status === "failed";
                    return html4`
                      <div class=${`chat-queue-item ${isSending ? "sending" : ""} ${isFailed ? "failed" : ""}`} key=${item.id}>
                        <span class="chat-queue-index">${idx + 1}</span>
                        <span class="chat-queue-text" title=${text}>${text}</span>
                        ${imageCount > 0 ? html4`<span class="chat-queue-meta">${t4("chat.queueImageMeta", { count: imageCount })}</span>` : null}
                        ${isSending ? html4`<span class="chat-queue-state">${t4("chat.queueSending")}</span>` : null}
                        ${isFailed ? html4`<span class="chat-queue-state error" title=${item.error || ""}>${t4("chat.queueFailedStatus")}</span>` : null}
                        ${isFailed ? html4`<button type="button" onClick=${() => retryQueuedPrompt(item.id)}>${t4("chat.queueRetry")}</button>` : null}
                        ${!isSending ? html4`<button type="button" onClick=${() => removeQueuedPrompt(item.id)}>${t4("chat.queueCancel")}</button>` : null}
                      </div>
                    `;
                  })}
                </div>
              </div>
            ` : null}
            ${skillCredentialSetup ? html4`
              <div class="card accent-brand" style="padding:10px 12px;margin-bottom:6px">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
                  <div style="min-width:0">
                    <div style="font-size:12px;font-weight:600;color:var(--fg-0)">${t4("chat.skillCredentialTitle", { label: skillCredentialSetup.label })}</div>
                    <div style="font-size:11px;color:var(--fg-3);line-height:1.45;margin-top:2px">${t4("chat.skillCredentialHint", { skill: skillCredentialSetup.skill })}</div>
                  </div>
                  <a href=${skillCredentialSetup.helpUrl} target="_blank" rel="noreferrer" style="font-size:11px;white-space:nowrap">${t4("chat.skillCredentialHelp")}</a>
                </div>
                <div style="display:flex;gap:6px;margin-top:8px;align-items:center">
                  <input
                    type="password"
                    autocomplete="off"
                    placeholder=${t4("chat.skillCredentialPlaceholder")}
                    value=${skillCredentialValue}
                    onInput=${(e3) => setSkillCredentialValue(e3.target.value)}
                    onKeyDown=${(e3) => { if (e3.key === "Enter") { e3.preventDefault(); void saveSkillCredential(); } }}
                    disabled=${skillCredentialSaving}
                    style="flex:1;min-width:0"
                  />
                  <button type="button" class="primary" disabled=${skillCredentialSaving || !skillCredentialValue.trim()} onClick=${saveSkillCredential}>${skillCredentialSaving ? t4("chat.skillCredentialSaving") : t4("chat.skillCredentialSave")}</button>
                  <button type="button" disabled=${skillCredentialSaving} onClick=${() => { setSkillCredentialSetup(null); setSkillCredentialValue(""); }}>${t4("common.cancel")}</button>
                </div>
              </div>
            ` : null}
            <textarea
              ref=${inputRef}
              placeholder=${busy ? t4("chat.placeholderBusy") : t4("chat.placeholder")}
              defaultValue=${inputValueRef.current}
              onInput=${onInput}
              onKeyDown=${onKeyDown}
              onPaste=${onPaste}
              onBlur=${() => setTimeout(() => setPopoverKind(null), 150)}
              style="flex:1"
              rows="4"
            ></textarea>
            <div class="composer-controls">
              <button type="button" class="composer-chip" aria-expanded=${showSkillPicker} onClick=${() => { setShowSkillPicker(!showSkillPicker); setShowWsPicker(false); if (!showSkillPicker) { loadChatSkills().catch(() => {}); } }}>🔧 技能</button>
              ${showSkillPicker && skillList.length > 0 ? html4`
                <div class="popover" style="position:absolute;bottom:100%;left:0;width:320px;max-height:260px;overflow-y:auto;z-index:10">
                  <div class="popover-h">选择技能</div>
                  ${skillList.map((s2) => html4`
                    <div class="popover-row" onMouseDown=${(e2) => { e2.preventDefault(); appendSkillMention(s2.name); }}>
                      <span class="name">${s2.name}</span>
                      <span class="meta">${(s2.description || '').slice(0,40)}</span>
                    </div>
                  `)}
                </div>
              ` : null}
              <button type="button" class="composer-chip" aria-expanded=${showWsPicker} onClick=${() => { const next = !showWsPicker; setShowWsPicker(next); setShowSkillPicker(false); if (next) void loadWorkspaceOptions(); }}>💻 工作空间 ▼</button>
              ${showWsPicker ? html4`
                <div class="popover" style="position:absolute;bottom:100%;left:0;width:360px;max-height:320px;overflow-y:auto;z-index:10">
                  <div class="popover-h">${t4("chat.workspacePicker")}</div>
                  ${workspaceSelection?.current ? html4`
                    <div class="popover-row" style="cursor:default">
                      <span class="name">✓ ${t4("chat.workspaceCurrent")}</span>
                      <span class="meta" title=${workspaceSelection.current}>${workspaceSelection.current}</span>
                    </div>
                  ` : null}
                  ${workspaceSelection?.pending ? html4`
                    <div class="popover-row" style="cursor:default">
                      <span class="name">○ ${t4("chat.workspacePending")}</span>
                      <span class="meta" title=${workspaceSelection.configured}>${workspaceSelection.configured}</span>
                    </div>
                  ` : null}
                  <div class="popover-row" onMouseDown=${(e3) => { e3.preventDefault(); void pickWorkspace("visionox-workspace"); }}><span class="name">⌂ ${t4("chat.workspaceDefault")}</span></div>
                  ${recentWss.filter((path) => path !== workspaceSelection?.current && path !== workspaceSelection?.configured).map((path) => html4`
                    <div class="popover-row" style="display:grid;grid-template-columns:minmax(0,1fr) 24px;align-items:center" onMouseDown=${(e4) => { e4.preventDefault(); void pickWorkspace(path); }}>
                      <span style="min-width:0"><span class="name">▣ ${path.split(/[\\/]/).filter(Boolean).pop() || path}</span><span class="meta" title=${path}>${path}</span></span>
                      <button type="button" class="ghost" title=${t4("chat.workspaceRemove")} aria-label=${t4("chat.workspaceRemove")} onMouseDown=${(event) => { event.preventDefault(); event.stopPropagation(); void removeWorkspaceOption(path); }} style="width:24px;height:24px;padding:0">×</button>
                    </div>
                  `)}
                  <div class="popover-row" onMouseDown=${(e5) => { e5.preventDefault(); void browseWorkspace(); }}><span class="name">▤ ${t4("chat.workspaceBrowse")}</span></div>
                </div>
              ` : null}
              <button type="button" class="composer-chip" aria-expanded=${showModelPicker} onClick=${() => { cancelModelGroupClose(); setShowModelPicker(!showModelPicker); setOpenModelGroupId(null); setShowSkillPicker(false); setShowWsPicker(false); }}>🤖 模型 ▼</button>
              ${showModelPicker ? html4`
                <div class="popover model-popover" style="position:absolute;bottom:100%;left:0;z-index:10" onMouseLeave=${scheduleModelGroupClose}>
                  <div class="popover-h">选择模型</div>
                  <div class="model-picker-browser">
                    <div class="model-cascade-menu" role="menu" aria-label="模型服务商">
                      ${providerDisplayGroups(providers ?? []).map((group) => {
                        const open = openModelGroupId === group.id;
                        const active = group.providers.some((provider) => provider.id === activeProviderId);
                        const models = group.providers.flatMap((provider) => (provider.models ?? []).filter((model) => model.disabled !== true).map((model) => ({ provider, model })));
                        return html4`
                          <div class=${`model-cascade-provider ${open ? "open" : ""}`} onMouseEnter=${() => openModelGroup(group.id)} onMouseLeave=${scheduleModelGroupClose}>
                            <button type="button" class=${`model-provider-trigger ${active ? "active" : ""}`} aria-haspopup="menu" aria-expanded=${open} onFocus=${() => openModelGroup(group.id)} onClick=${() => { cancelModelGroupClose(); setOpenModelGroupId(open ? null : group.id); }}>
                              <span>${group.label}</span>
                              <span class="model-provider-indicators"><span aria-hidden="true">${active ? "✓" : ""}</span><span class="model-menu-chevron" aria-hidden="true">›</span></span>
                            </button>
                            ${open ? html4`
                              <div class="model-cascade-submenu" role="menu" aria-label=${`${group.label} 模型`} onMouseEnter=${cancelModelGroupClose} onMouseLeave=${scheduleModelGroupClose}>
                                ${models.length > 0 ? models.map(({ provider, model }) => {
                                  const selected = provider.id === activeProviderId && model.id === overviewModel;
                                  const status = model.testStatus || "untested";
                                  const details = providerModelCapabilityLabels(model).join(" · ");
                                  const statusText = status === "passed" ? "已验证" : status === "failed" ? model.testError || "不可用" : "未检测";
                                  return html4`
                                    <button type="button" class=${`model-cascade-model ${selected ? "active" : ""} ${status}`} role="menuitemradio" aria-checked=${selected} disabled=${busy || status === "failed"} title=${`${details}${details ? " · " : ""}${statusText}`} onClick=${() => selectProviderModel(provider.id, model.id)}>
                                      <span>${model.name ?? providerDisplayLabel(provider)}</span><span class="model-row-indicators"><span class=${`model-row-status ${status}`}>${status === "passed" ? "可用" : status === "failed" ? "不可用" : "未检测"}</span><span class="model-current-check" aria-hidden="true">${selected ? "✓" : ""}</span></span>
                                    </button>
                                  `;
                                }) : html4`<div class="model-picker-empty">该服务商暂无可用模型</div>`}
                              </div>
                            ` : null}
                          </div>
                        `;
                      })}
                      ${providerDisplayGroups(providers ?? []).length === 0 ? html4`<div class="model-picker-empty">尚未导入模型</div>` : null}
                    </div>
                    <div class="model-menu-actions">
                      <input type="file" id="provider-import-file" accept=".json,application/json" style="display:none" onChange=${loadProviderImportFile} />
                      <button type="button" class="model-import-link" disabled=${busy || providerImporting || providerTesting || providerCleaning} onClick=${() => { const input = document.getElementById("provider-import-file"); input.value = ""; input.click(); }}>${providerImporting ? "导入中..." : "导入模型配置"}</button>
                      <button type="button" class="model-test-link" disabled=${busy || providerImporting || providerTesting || providerCleaning || providerModelTestSummary(providers ?? []).total === 0} onClick=${testAllProviders}>${providerTesting ? "检测中..." : "检测全部模型"}</button>
                      ${providerModelTestSummary(providers ?? []).failed > 0 && modelVerification?.dirty !== true ? html4`<button type="button" class="model-cleanup-link" disabled=${busy || providerImporting || providerTesting || providerCleaning} onClick=${cleanupFailedModels}>${providerCleaning ? "删除中..." : `删除检测失败模型（${providerModelTestSummary(providers ?? []).failed}）`}</button>` : null}
                    </div>
                    <div role="status" aria-live="polite" style="min-height:18px;margin-top:5px;font-size:11px;line-height:18px;overflow-wrap:anywhere;color:${modelNotice?.kind === 'error' ? 'var(--c-err)' : modelNotice?.kind === 'success' ? 'var(--c-ok)' : 'var(--fg-3)'};">${modelNotice?.text ?? ""}</div>
                    ${(() => {
                      if (modelVerification?.dirty) {
                        return html4`<div style="font-size:11px;margin-top:6px;color:var(--c-warn);">配置已更新，请重新检测全部模型</div>`;
                      }
                      const allModels = (providers ?? []).flatMap((provider) => (provider.models ?? []).filter((model) => model.disabled !== true).map((model) => ({ provider, model })));
                      const testedModels = allModels.filter(({ model }) => model.testStatus !== "untested");
                      if (testedModels.length === 0) return null;
                      const passed = allModels.filter(({ model }) => model.testStatus === "passed").length;
                      const failedModels = allModels.filter(({ model }) => model.testStatus === "failed");
                      return html4`
                        <div title=${failedModels.map(({ provider, model }) => `${provider.name ?? provider.id} / ${model.name ?? model.id}: ${model.testError ?? "检测失败"}`).join("\n")} style="display:flex;align-items:center;gap:5px;font-size:11px;margin-top:5px;color:var(--fg-3)">
                          <span>已通过 ${passed}/${allModels.length}</span>
                        </div>
                      `;
                    })()}
                  </div>
                  <div style="padding:8px;border-bottom:1px solid var(--border-default);">
                    <label style="display:block;font-size:11px;color:var(--text-secondary);margin-bottom:4px;">模式</label>
                    ${(providerCaps?.presets?.length ?? 0) > 1 ? html4`
                      <div class="model-choice-row">
                        ${providerCaps.presets.map((p3) => html4`<button type="button" key=${p3} class=${`model-choice ${preset === p3 ? "active" : ""}`} onClick=${() => { setSetting('preset', p3); }}>${p3}</button>`)}
                      </div>
                    ` : html4`<div style="font-size:12px;color:var(--text-primary);">${preset}（固定）</div>`}
                  </div>
                  ${activeModelEfforts.length > 0 ? html4`
                    <div style="padding:8px;border-bottom:1px solid var(--border-default);">
                      <label style="display:block;font-size:11px;color:var(--text-secondary);margin-bottom:4px;">思考强度</label>
                      ${activeModelEfforts.length > 1 ? html4`
                        <div class="model-choice-row">
                          ${activeModelEfforts.map((e3) => html4`<button type="button" key=${e3} title=${e3} disabled=${busy} class=${`model-choice ${effort === e3 ? "active" : ""}`} onClick=${() => { setSetting('reasoningEffort', e3); }}>${reasoningEffortLabel(e3)}</button>`)}
                        </div>
                      ` : html4`<div style="font-size:12px;color:var(--text-primary);">${reasoningEffortLabel(activeModelEfforts[0])}（固定）</div>`}
                    </div>
                  ` : null}
                </div>
              ` : null}
              <button type="button" title=${`运行中 ${backgroundJobs.filter((job) => job.running).length}，待处理 ${backgroundJobs.filter(backgroundJobNeedsAttention).length}`} class=${`composer-chip ${backgroundJobs.some((job) => job.running || backgroundJobNeedsAttention(job)) ? "has-activity" : ""}`} aria-expanded=${showBackgroundJobs} onClick=${() => showBackgroundJobs ? closeBackgroundWorkbench() : void openBackgroundWorkbench()}>${t4("chat.backgroundJobs", { count: backgroundJobs.filter((job) => job.running || backgroundJobNeedsAttention(job)).length })}</button>
              <label class="composer-chip composer-index">
                <span class="composer-index-label" title="索引用于从当前工作区和知识库中查找相关内容，帮助模型参考本地资料。">索引</span>
                <select title=${globalThis.VisionoxIndexModePolicy.hint(indexRetrievalMode)} value=${indexRetrievalMode} disabled=${busy} onChange=${changeIndexRetrievalMode}>
                  <option value="auto" title="每次发送消息前自动搜索索引，并把相关内容加入上下文。" disabled=${semanticIndex === false}>自动召回</option>
                  <option value="tool" title="不主动搜索，仅在模型判断有必要时调用索引工具。" disabled=${semanticIndex === false}>按需搜索</option>
                  <option value="off" title="完全关闭本地索引，不自动召回，也不提供索引工具。">不使用</option>
                </select>
              </label>
              ${indexRetrievalMode === "auto" && semanticRetrievalStatus === "running" ? html4`<span class="composer-retrieval-status muted">召回中...</span>` : null}
              ${indexRetrievalMode === "auto" && semanticRetrievalStatus === "empty" ? html4`<span class="composer-retrieval-status muted">未找到相关内容</span>` : null}
              ${indexRetrievalMode === "auto" && semanticRetrievalStatus === "timeout" ? html4`<span class="composer-retrieval-status" style="color:var(--c-warn)">召回超时</span>` : null}
              ${indexRetrievalMode === "auto" && semanticRetrievalStatus === "unavailable" ? html4`<span class="composer-retrieval-status" style="color:var(--c-warn)">索引不可用</span>` : null}
              ${indexRetrievalMode === "auto" && semanticRetrievalStatus === "error" ? html4`<span class="composer-retrieval-status" style="color:var(--c-err)">召回失败</span>` : null}
              ${semanticRetrievalSources.length > 0 ? html4`
                <button class="btn btn-sm" style="font-size:11px;padding:2px 7px" onClick=${() => setShowRetrievalSources(!showRetrievalSources)}>参考 ${semanticRetrievalSources.length}</button>
                ${showRetrievalSources ? html4`
                  <div class="popover" style="position:absolute;bottom:100%;right:0;width:420px;max-height:260px;overflow-y:auto;z-index:10">
                    <div class="popover-h">本轮索引来源</div>
                    ${semanticRetrievalSources.map((source) => html4`
                      <button class="popover-row" style="width:100%;text-align:left" onMouseDown=${(event) => { event.preventDefault(); void previewRetrievedSource(source); }}>
                        <span class="name" style="overflow-wrap:anywhere">${source.path}</span>
                        <span class="meta">L${source.startLine}-${source.endLine} · ${Number(source.score || 0).toFixed(3)}</span>
                      </button>
                    `)}
                  </div>
                ` : null}
              ` : null}
              ${(showSkillPicker || showWsPicker || showModelPicker || showRetrievalSources) ? html4`<div style="position:fixed;inset:0;z-index:5" onClick=${() => { setShowSkillPicker(false); setShowWsPicker(false); setShowModelPicker(false); setShowRetrievalSources(false); }}></div>` : null}
              <div style="flex:1"></div>
              ${canUploadMedia ? html4`<button
                type="button"
                class="image-upload-btn"
                onClick=${function() { if (fileInputRef.current) fileInputRef.current.click(); }}
                title=${canUploadVideos ? "添加图片或视频" : "添加图片"}
                aria-label=${canUploadVideos ? "添加图片或视频" : "添加图片"}
              >📎</button>` : null}
              <button
                type="button"
                class="composer-chip prompt-optimize-chip"
                disabled=${!inputHasContent || promptOptimizing}
                onClick=${optimizeCurrentPrompt}
                title="优化当前输入，不会自动发送"
                aria-label="优化当前提示词"
              >${promptOptimizing ? "优化中…" : "优化提示词"}</button>
            </div>
            </div>
            <div class="chat-input-actions">
              <button
                class="primary"
                onClick=${send}
                disabled=${!inputHasContent && pendingImages.length === 0}
              >${busy ? t4("chat.queueSend") : t4("chat.send")}</button>
              <button class="chat-secondary-action" onClick=${clearScrollback} title=${t4("chat.clearTitle")}>${t4("chat.clear")}</button>
              <button class="chat-secondary-action" onClick=${newConversation} title=${t4("chat.newTitle")}>${t4("chat.new")}</button>
            </div>
              </div>
            </div>
          </div>

          ${busy ? html4`<${InFlightRow}
                  streaming=${streaming}
                  activeTools=${activeTools}
                  startedAt=${turnStartedAt}
                  statusLine=${statusLine}
                  onAbort=${abort}
                  stopping=${operation?.state === "stopping"}
                  tick=${nowTick}
                />` : null}
          <${ChatStatusBar} stats=${stats} model=${overviewModel} />
        </div>
        ${!showBackgroundJobs && (activePlan || fileArtifacts.length && !fileArtifactsDismissed) ? html4`<${SideRail} activePlan=${activePlan} fileArtifacts=${fileArtifactsDismissed ? [] : fileArtifacts} artifactsSelected=${Boolean(fileArtifactsSelectedMessageId)} onFollowLatestArtifacts=${followLatestArtifacts} onDismissArtifacts=${dismissArtifacts} />` : null}
      </div>
    </div>
  `;
}
var ChatFeed = N2(function ChatFeed2({ messages, totalMessages = messages.length, streaming, reasoningExpanded = false, innerRef, visibleCount = CHAT_INITIAL_RENDER_COUNT, onLoadEarlier, loadingEarlier = false, searchMatchIndex = -1, highlightMessageId = null, onCopyMessage, onFillInput, selectedArtifactMessageId = null, onSelectArtifactMessage, userAvatar = null }) {
  useLang();
  const allMessages = streaming ? [
    ...messages,
    {
      id: streaming.id,
      role: "assistant",
      text: streaming.text,
      reasoning: streaming.reasoning
    }
  ] : messages;
  const hiddenCount = Math.max(0, allMessages.length - visibleCount);
  const remoteHiddenCount = Math.max(0, totalMessages - messages.length);
  const renderedMessages = hiddenCount > 0 ? allMessages.slice(hiddenCount) : allMessages;
  const displayTotal = Math.max(totalMessages, allMessages.length);
  return html4`
    <div class="chat-feed" ref=${innerRef}>
      ${allMessages.length === 0 ? html4`<div class="chat-empty">${t4("chat.noConversation")}</div>` : null}
      ${hiddenCount > 0 || remoteHiddenCount > 0 ? html4`
        <div class="chat-history-loader">
          <span>已显示 ${renderedMessages.length} / 共 ${displayTotal} 条</span>
          <button type="button" onClick=${onLoadEarlier} disabled=${loadingEarlier}>${loadingEarlier ? "加载中..." : t4("chat.loadEarlierMessages", { count: Math.min(hiddenCount || remoteHiddenCount, hiddenCount ? CHAT_RENDER_STEP : CHAT_MESSAGE_PAGE_SIZE) })}</button>
        </div>
      ` : null}
      ${renderedMessages.map(
    (m3, i3) => html4`
                <${ChatMessage}
                  key=${m3.id}
                  msg=${m3}
                  index=${i3 + hiddenCount}
                  searchMatch=${i3 + hiddenCount === searchMatchIndex || Boolean(highlightMessageId && m3.id === highlightMessageId)}
                  streaming=${Boolean(streaming && streaming.id === m3.id)}
                  onCopy=${onCopyMessage}
                  onFillInput=${onFillInput}
                  reasoningExpanded=${reasoningExpanded}
                  userAvatar=${userAvatar}
                  selectedForArtifacts=${Boolean(selectedArtifactMessageId && String(m3.id || "") === String(selectedArtifactMessageId))}
                  onSelectForArtifacts=${onSelectArtifactMessage}
                />
              `
  )}
    </div>
  `;
});
var SideRail = N2(function SideRail2({ activePlan, fileArtifacts, artifactsSelected, onFollowLatestArtifacts, onDismissArtifacts }) {
  useLang();
  if (!activePlan && (!fileArtifacts || fileArtifacts.length === 0)) return null;
  return html4`
    <aside class="chat-rail">
      ${fileArtifacts && fileArtifacts.length > 0 ? html4`<${FileArtifactsCard} files=${fileArtifacts} selected=${artifactsSelected} onFollowLatest=${onFollowLatestArtifacts} onDismiss=${onDismissArtifacts} />` : null}
      ${activePlan ? html4`<${ActivePlanCard} plan=${activePlan} />` : null}
    </aside>
  `;
});
function ActivePlanCard({ plan }) {
  useLang();
  const steps = plan.steps ?? [];
  const completedIds = new Set(plan.completedStepIds ?? []);
  const title = plan.summary ?? plan.title ?? steps[0]?.title ?? t4("plans.noTitle");
  const dots = [];
  for (let i3 = 0; i3 < plan.totalSteps; i3++) {
    const done = steps[i3]?.id ? completedIds.has(steps[i3].id) : i3 < plan.completedSteps;
    const active = i3 === plan.completedSteps;
    dots.push(
      html4`<div class=${`step-dot ${done ? "done" : active ? "active" : ""}`}>${i3 + 1}</div>`
    );
    if (i3 < plan.totalSteps - 1) {
      dots.push(html4`<div class=${`step-line ${done ? "done" : active ? "active" : ""}`}></div>`);
    }
  }
  return html4`
    <div class="rail-card">
      <div class="rh">${t4("chat.railActivePlan")} ${statusPill(plan)}</div>
      <div class="steps" style="margin-bottom:8px">${dots}</div>
      <div class="rail-kv"><span class="k" style="font-family:var(--font-sans);color:var(--fg-1);font-size:12.5px">${title}</span></div>
      <div class="rail-kv"><span class="k">${t4("chat.railProgress")}</span><span class="v">${plan.completedSteps} / ${plan.totalSteps}</span></div>
      ${steps.length > 0 ? html4`
        <div class="active-plan-steps">
          ${steps.slice(0, 6).map((step, i3) => {
    const done = completedIds.has(step.id);
    const active = !done && i3 === plan.completedSteps;
    return html4`<div class=${`active-plan-step ${done ? "done" : active ? "active" : ""}`}>
              <span class="idx">${i3 + 1}</span>
              <span class="txt">${step.title}</span>
            </div>`;
  })}
        </div>
      ` : null}
    </div>
  `;
}
function summarizeActiveTool(activeTool) {
  if (!activeTool) return null;
  const name = activeTool.toolName ?? "tool";
  const args = parseToolArgs(activeTool.args);
  const path = args?.path ?? args?.file_path ?? args?.filename;
  if (name === "write_file" && path) {
    const len = typeof args?.content === "string" ? args.content.length : null;
    return `${name} \u2192 ${path}${len != null ? ` (${len.toLocaleString()} ch)` : ""}`;
  }
  if ((name === "edit_file" || name.endsWith("_edit_file")) && path) {
    return `${name} \u2192 ${path}`;
  }
  if ((name === "run_command" || name === "run_background") && typeof args?.command === "string") {
    const c3 = args.command;
    return `${name} \u2192 $ ${c3.length > 80 ? `${c3.slice(0, 80)}\u2026` : c3}`;
  }
  if ((name === "read_file" || name === "list_files" || name === "search_files") && path) {
    return `${name} \u2192 ${path}`;
  }
  if (path) return `${name} \u2192 ${path}`;
  return name;
}
function InFlightRow({
  streaming,
  activeTools,
  startedAt,
  statusLine,
  onAbort,
  stopping,
  tick: _tick
}) {
  useLang();
  const elapsedMs = startedAt ? Date.now() - startedAt : 0;
  const elapsed = (elapsedMs / 1e3).toFixed(1);
  const reasoningLen = streaming?.reasoning?.length ?? 0;
  const textLen = streaming?.text?.length ?? 0;
  const activeTool = activeTools?.at?.(-1) ?? null;
  const toolSummary = summarizeActiveTool(activeTool);
  const activeToolCount = Array.isArray(activeTools) ? activeTools.length : 0;
  const phase = toolSummary ? t4("chat.inflightRunning") : reasoningLen > 0 && textLen === 0 ? t4("chat.inflightThinking") : textLen > 0 ? t4("chat.inflightStreaming") : t4("chat.inflightWaiting");
  return html4`
    <div class="chat-inflight">
      <span class="spinner"></span>
      <span class="chat-inflight-phase">${phase}</span>
      <span class="chat-inflight-sep">·</span>
      <span class="muted">${elapsed}s</span>
      ${toolSummary ? html4`
            <span class="chat-inflight-sep">·</span>
            <span class="chat-inflight-tool" title=${toolSummary}>${toolSummary}${activeToolCount > 1 ? ` +${activeToolCount - 1}` : ""}</span>
          ` : null}
      ${!toolSummary && (textLen > 0 || reasoningLen > 0) ? html4`
            <span class="chat-inflight-sep">·</span>
            <span class="muted">
              ${reasoningLen > 0 ? html4`${t4("chat.inflightReasoning", { count: reasoningLen.toLocaleString() })}` : null}
              ${reasoningLen > 0 && textLen > 0 ? html4`<span> · </span>` : null}
              ${textLen > 0 ? html4`${t4("chat.inflightOut", { count: textLen.toLocaleString() })}` : null}
            </span>
          ` : null}
      ${statusLine ? html4`
            <span class="chat-inflight-sep">·</span>
            <span class="muted">${statusLine}</span>
          ` : null}
      <button class="chat-inflight-abort" onClick=${onAbort} disabled=${stopping}>${stopping ? t4("chat.stoppingBtn") : t4("chat.abortBtn")}</button>
    </div>
  `;
}
function TodoBar({ todos, expanded, onToggle }) {
  const total = todos.length;
  if (total === 0) return null;
  const done = todos.filter((t) => t.status === "completed").length;
  const inProgress = todos.filter((t) => t.status === "in_progress").length;
  const pct = total > 0 ? Math.round(done / total * 100) : 0;
  const current = todos.find((t) => t.status === "in_progress");
  const allDone = done === total;
  return html4`
    <div class="todo-bar">
      <div class="todo-bar-header" onClick=${onToggle}>
        <span class="todo-bar-icon">${allDone ? "\u2705" : "\u{1F4CB}"}</span>
        <span class="todo-bar-count">${allDone ? "\u5168\u90E8\u5B8C\u6210" : `${done}/${total} \u5B8C\u6210`}</span>
        <div class="todo-bar-progress">
          <div class="todo-bar-progress-fill" style=${`width: ${pct}%;`}></div>
        </div>
        ${current && !allDone ? html4`<span class="todo-bar-current">${current.activeForm || current.content}</span>` : null}
        <span class="todo-bar-toggle">${expanded ? "\u25B4" : "\u25BE"}</span>
      </div>
      ${expanded ? html4`
        <div class="todo-bar-list">
          ${todos.map((t) => html4`
            <div class=${`todo-item todo-item-${t.status}`}>
              <span class="todo-item-mark">${t.status === "completed" ? "[x]" : t.status === "in_progress" ? "[>]" : "[ ]"}</span>
              <span class="todo-item-text">${t.status === "in_progress" ? (t.activeForm || t.content) : t.content}</span>
            </div>
          `)}
        </div>
      ` : null}
    </div>
  `;
}
var ChatStatusBar = N2(function ChatStatusBar2({ stats, model }) {
  useLang();
  if (!stats) {
    return html4`
      <div class="chat-statusbar">
        <span class="muted">${t4("chat.waitingStats")}</span>
      </div>
    `;
  }
  const currentContextTokens = stats.estimatedContextTokens ?? stats.lastPromptTokens;
  const ctxPct = stats.contextCapTokens > 0 ? currentContextTokens / stats.contextCapTokens * 100 : 0;
  const contextMarks = [
    { tokens: stats.contextFoldTokens, label: "普通压缩" },
    { tokens: stats.contextAggressiveTokens, label: "激进压缩" },
    { tokens: stats.contextForceSummaryTokens, label: "强制总结" },
  ].filter((mark) => Number.isFinite(mark.tokens) && mark.tokens > 0 && stats.contextCapTokens > 0)
    .map((mark) => ({ ...mark, pct: Math.min(100, mark.tokens / stats.contextCapTokens * 100) }));
  const balance = primaryBalance(stats);
  return html4`
    <div class="chat-statusbar">
      <span class="status-item">
        <span class="status-label">${t4("chat.statusModel")}</span>
        <code>${model ?? "\u2014"}</code>
      </span>
      <span class="status-item">
        <span class="status-label">${t4("chat.statusCtx")}</span>
        <span class="status-bar-mini">
          <span class="status-bar-mini-fill" style=${`width: ${Math.min(100, ctxPct).toFixed(1)}%;`}></span>
          ${contextMarks.map((mark) => html4`<span class="fold-mark" style=${`left:${mark.pct.toFixed(2)}%`} title=${`${mark.label} ${(mark.tokens / 1e3).toFixed(0)}K`}></span>`)}
        </span>
        <span class="muted">${currentContextTokens.toLocaleString()} / ${(stats.contextCapTokens / 1e3).toFixed(0)}K</span>
      </span>
      <span class="status-item">
        <span class="status-label">${t4("chat.statusCache")}</span>
        <span class=${stats.cacheHitRatio >= 0.9 ? "status-ok" : stats.cacheHitRatio >= 0.6 ? "status-warn" : "status-err"}>
          ${(stats.cacheHitRatio * 100).toFixed(1)}%
        </span>
      </span>
      <span class="status-item">
        <span class="status-label">${t4("chat.statusTurn")}</span>
        <code>${fmtCost(stats.lastTurnCostUsd, balance?.currency)}</code>
      </span>
      <span class="status-item">
        <span class="status-label">${t4("chat.statusSession")}</span>
        <code>${fmtCost(stats.totalCostUsd, balance?.currency)}</code>
        <span class="muted" style="font-size: 10px;">
          ${t4("chat.statusTurns", { count: stats.turns, s: stats.turns === 1 ? "" : "s" })}
        </span>
      </span>
      ${balance ? html4`
          <span class="status-item">
            <span class="status-label">${t4("chat.statusBalance")}</span>
            <code>${balance.total_balance ?? balance.total} ${balance.currency}</code>
          </span>
        ` : null}
    </div>
  `;
});

export {
  CHAT_DRAFT_KEY,
  ChatPanel,
  FilesPanel,
  TodoBar,
  openMarkdownDocumentByPicker,
  pickWorkspaceDirectoryFromBridge,
  providerDisplayGroups,
  showFileArtifactPreview,
};
