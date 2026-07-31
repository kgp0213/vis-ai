// Recovered from the product bundle; types are tightened incrementally without changing behavior.
// @ts-nocheck
import { memo as preactMemo } from "preact/compat";
import { useCallback as q2, useEffect as y2, useMemo as T2, useRef as A2, useState as d2 } from "preact/hooks";
import {
  ChatMessage,
  CheckpointModal,
  ChoiceModal,
  EditReviewModal,
  PickerModal,
  PlanModal,
  RevisionModal,
  ToolGroup,
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
import {
  classifyPromptOptimizationDraft,
  createPromptOptimizationScope,
  describePromptOptimizationFailure,
  promptOptimizationButtonDisabled,
  promptOptimizationResponseIsCurrent,
} from "../lib/prompt-optimization.js";
import { subscribeSse, subscribeSseStatus } from "../lib/use-poll.js";
import {
  applyDashboardEvent as reduceDashboardEvent,
  createDashboardEventBatcher,
  createDashboardEventCursor,
  createDashboardEventGuard,
  createDashboardReducerState,
  dashboardEventsAfterCursor,
  dashboardSnapshotResponseIsCurrent,
  mergeDashboardMessagePages,
  observeDashboardEventCursor,
  orderedDashboardMessages,
  projectDashboardMessagePage,
} from "../lib/event-reducer.js";
import { groupToolMessages, toolFrameMatches } from "../lib/chat-turn-rendering.js";
import { assistantHasAuthoritativeFinalEvidence, projectChatTimeline } from "../lib/chat-timeline.js";
import { computeGrowthEffect, createFrameScheduler, shouldTriggerTopLoad } from "../lib/chat-scroll-policy.js";
import { redactSensitiveDisplayText, redactTechnicalMessages, safeTechnicalDisplayText } from "../lib/chat-display-safety.js";
import { t as t4, useLang } from "../i18n/index.js";
import { IconModel, IconWorkspace, IconJobs, IconSearch, IconWand, IconAttach, IconSkill } from "../ui/index.js";
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
    if (!Array.isArray(parsed.operations) || parsed.operations.length === 0) throw new Error(t4("chat.jsonNeedsOperations"));
    return parsed;
  }
  if (!Array.isArray(parsed.providers) || parsed.providers.length === 0) throw new Error(t4("chat.jsonNeedsProviders"));
  for (const provider of parsed.providers) {
    if (!provider?.id || typeof provider.id !== "string") throw new Error(t4("chat.providerNeedsId"));
    if (!Array.isArray(provider.models) || provider.models.length === 0) throw new Error(t4("chat.providerNeedsModels", { id: provider.id }));
    for (const model of provider.models) {
      if (!model?.id || typeof model.id !== "string") throw new Error(t4("chat.providerModelNoId", { id: provider.id }));
      if (!Number.isSafeInteger(model.maxContextLength) || model.maxContextLength <= 0) throw new Error(t4("chat.modelNeedsContext", { id: model.id }));
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
    const label = provider?.ui?.groupName || provider?.name || provider?.id || t4("chat.providerFallback");
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
    low: t4("chat.effortLow"),
    medium: t4("chat.effortMedium"),
    high: t4("chat.effortDeep"),
    xhigh: t4("chat.effortExtreme"),
    max: t4("chat.effortExtreme")
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
  labels.push(modalities.includes("image") ? t4("chat.capImageText") : t4("chat.capTextOnly"));
  if (model?.capabilities?.roles?.some((role) => /code/i.test(role)) || /code/i.test(`${model?.id || ""} ${model?.name || ""}`)) labels.push(t4("chat.capCode"));
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
  const nodes = feed.querySelectorAll(".chat-msg[data-msg-id], .process-card[data-process-anchor-id]");
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (rect.bottom >= feedTop) {
      const isProcess = Boolean(node.dataset.processAnchorId);
      return {
        kind: isProcess ? "process" : "message",
        id: isProcess ? node.dataset.processAnchorId : node.dataset.msgId,
        offset: rect.top - feedTop,
      };
    }
  }
  return { id: null, scrollHeight: feed.scrollHeight, scrollTop: feed.scrollTop };
}
function restoreChatScrollAnchor(feed, anchor, done, isCurrent = () => true) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    try {
      if (!feed || !feed.isConnected || !anchor || !isCurrent()) return;
      if (anchor.id) {
        const selector = anchor.kind === "process" ? ".process-card[data-process-anchor-id]" : ".chat-msg[data-msg-id]";
        const node = Array.from(feed.querySelectorAll(selector)).find((item) => anchor.kind === "process" ? item.dataset.processAnchorId === anchor.id : item.dataset.msgId === anchor.id);
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
    turnId: dash.turnId || null,
    stepId: dash.stepId || null,
    role: "tool",
    text: dash.content || "",
    toolName: dash.toolName,
    toolArgs: dash.args,
    toolStatus: dash.status || "running",
    category: dash.category || null,
    code: dash.code || null,
    recommendedAction: dash.recommendedAction || null,
    retryable: dash.retryable === true,
    diagnosticMessage: dash.message || null,
    repeatFailureBlocked: dash.repeatFailureBlocked === true,
    eventEpoch: dash.eventEpoch ?? null,
    eventSeq: dash.eventSeq ?? null,
  };
  const index = items.findIndex((item) => toolFrameMatches(item, next));
  if (index < 0) return [...items, next];
  const copy = [...items];
  copy[index] = { ...copy[index], ...next, text: next.text || copy[index].text || "" };
  return copy;
}

function upsertActiveTool(items, dash) {
  const toolCallId = String(dash.toolCallId || dash.id || "");
  if (!toolCallId) return items;
  const next = {
    id: dash.id,
    toolCallId,
    turnId: dash.turnId || null,
    stepId: dash.stepId || null,
    toolName: dash.toolName,
    args: dash.args,
    status: dash.status || "running",
  };
  const index = items.findIndex((item) => toolFrameMatches(item, next));
  if (index < 0) return [...items, next];
  const copy = [...items];
  copy[index] = { ...copy[index], ...next };
  return copy;
}

function projectChatMessagePage(data) {
  const page = projectDashboardMessagePage(data);
  const timeline = projectChatTimeline(page.messages, page.tools);
  return {
    ...page,
    messages: timeline.frames.map((frame) => ({
      ...frame.message,
      __timelineSegmentId: frame.segmentId,
      __timelineEventSeq: frame.eventSeq,
      __timelineEventEpoch: frame.eventEpoch,
    })),
  };
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
  if (e3 === "md" || e3 === "markdown") return t4("chat.fileMd");
  if (e3 === "html" || e3 === "htm") return t4("chat.fileHtml");
  if (e3 === "pdf") return t4("chat.filePdf");
  if (["doc", "docx"].includes(e3)) return t4("chat.fileWord");
  if (["ppt", "pptx"].includes(e3)) return t4("chat.filePpt");
  if (["xls", "xlsx"].includes(e3)) return t4("chat.fileExcel");
  if (e3 === "csv") return t4("chat.fileCsv");
  if (["json", "xml", "yaml", "yml"].includes(e3)) return t4("chat.fileData");
  if (FILE_ARTIFACT_SCRIPT_EXTS.has(e3)) return t4("chat.fileScript");
  if (["css", "sql", "ini", "toml", "txt"].includes(e3)) return t4("chat.fileText");
  return e3 ? t4("chat.fileGeneric", { ext: e3.toUpperCase() }) : t4("chat.fileFallback");
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
  showToast(t4("chat.mdOpened", { name: file.filename || t4("chat.mdDocFallback") }), "info");
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
    showToast(err.message || t4("chat.mdOpenFailed"), "error", 5e3);
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
  const filename = file.name || t4("chat.mdDocDefaultName");
  if (!/\.(md|markdown)$/i.test(filename)) {
    throw new Error(t4("chat.mdSelectRequired"));
  }
  if (file.size > MARKDOWN_DOCUMENT_MAX_BYTES) {
    throw new Error(t4("chat.mdTooLarge", { mb: Math.round(MARKDOWN_DOCUMENT_MAX_BYTES / 1024 / 1024) }));
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
  showToast(t4("chat.mdOpened", { name: filename }), "info");
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
      reject(new Error(t4("chat.localFileOnlyDesktop")));
      return;
    }
    const requestId = `md-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const timer = setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error(t4("chat.filePickerTimeout")));
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
    queued: t4("chat.statusQueued"),
    running: t4("chat.statusRunning"),
    waiting_foreground: t4("chat.statusWaitingForeground"),
    waiting_provider: t4("chat.statusWaitingProvider"),
    pausing: t4("chat.statusPausing"),
    paused: t4("chat.statusPaused"),
    interrupted: t4("chat.statusInterrupted"),
    stopped: t4("chat.statusStopped"),
    abandoned: t4("chat.statusAbandoned"),
    source_changed: t4("chat.statusSourceChanged"),
    awaiting_output: t4("chat.statusAwaitingOutput"),
    completed: t4("chat.statusCompleted"),
    completed_with_warnings: t4("chat.statusCompletedWarnings"),
    failed: t4("chat.statusFailed"),
    cancelled: t4("chat.statusCancelled")
  }[status] || status || t4("chat.statusUnknown");
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
    { key: "active", label: t4("chat.groupActive") },
    { key: "attention", label: t4("chat.groupAttention") },
    { key: "completed", label: t4("chat.groupCompleted") }
  ].map((group) => ({ ...group, jobs: values.filter((job) => backgroundJobGroup(job) === group.key) })).filter((group) => group.jobs.length > 0);
}
function isGenericBackgroundTask(job) {
  return String(job?.id ?? "").startsWith("task:");
}
function backgroundJobTitle(job) {
  return job?.goal || job?.command || job?.sourceName || `#${job?.id || t4("chat.unknownTask")}`;
}
function genericTaskLifecycleLabel(lifecycle) {
  return {
    created: t4("chat.lifecycleCreated"),
    queued: t4("chat.statusQueued"),
    leased: t4("chat.lifecycleLeased"),
    running: t4("chat.statusRunning"),
    assembling: t4("chat.lifecycleAssembling"),
    paused: t4("chat.statusPaused"),
    waiting_user: t4("chat.lifecycleWaitingUser"),
    blocked: t4("chat.lifecycleBlocked"),
    terminal: t4("chat.lifecycleTerminal")
  }[lifecycle] || lifecycle || t4("chat.lifecycleUnknown");
}
function genericTaskOutcomeLabel(outcome) {
  return {
    delivered: t4("chat.outcomeDelivered"),
    delivered_with_warnings: t4("chat.outcomeDeliveredWarnings"),
    partial: t4("chat.outcomePartial"),
    failed: t4("chat.statusFailed"),
    cancelled: t4("chat.statusCancelled")
  }[outcome] || outcome || t4("chat.outcomeNone");
}
function genericTaskQualityLabel(quality) {
  return {
    verified: t4("chat.qualityVerified"),
    needs_review: t4("chat.qualityNeedsReview"),
    unknown: t4("chat.qualityUnknown")
  }[quality] || quality || t4("chat.qualityUnknown");
}
function genericTaskProgressLabel(job) {
  const progress = job?.progress || {};
  const completed = progress.completedUnits ?? progress.completed;
  const total = progress.totalUnits ?? progress.total;
  const unit = progress.unitLabel || t4("chat.progressUnit");
  if (Number.isFinite(completed) && Number.isFinite(total) && total > 0) return `${completed}/${total} ${unit}`;
  if (Number.isFinite(completed)) return t4("chat.progressCompleted", { completed, unit });
  return progress.label || progress.currentLabel || genericTaskLifecycleLabel(job?.lifecycle);
}
function genericTaskProgressPercent(job) {
  const progress = job?.progress || {};
  if (Number.isFinite(progress.percent)) return Math.max(0, Math.min(100, progress.percent));
  const completed = Number(progress.completedUnits ?? progress.completed);
  const total = Number(progress.totalUnits ?? progress.total);
  return Number.isFinite(completed) && Number.isFinite(total) && total > 0 ? Math.max(0, Math.min(100, completed / total * 100)) : 0;
}
const GENERIC_TASK_ACTION_LABELS = new Set([
  "pause",
  "resume",
  "retry",
  "retry_delivery",
  "cancel",
  "resolve_user_input",
  "retarget_output",
  "ack_outcome",
  "delete_record",
]);
function genericTaskActionLabel(action) {
  return {
    pause: t4("chat.actPause"),
    resume: t4("chat.actResume"),
    retry: t4("chat.actRetry"),
    retry_delivery: t4("chat.actRetryDelivery"),
    cancel: t4("chat.actCancel"),
    resolve_user_input: t4("chat.actSubmitResult"),
    retarget_output: t4("chat.actRetarget"),
    ack_outcome: t4("chat.actAckOutcome"),
    delete_record: t4("chat.actDeleteRecord")
  }[action] || action;
}
function genericTaskArtifactLabel(artifact, index) {
  return artifact?.filename || artifact?.name || artifact?.label || artifact?.path || artifact?.artifactId || t4("chat.artifactFallback", { n: index + 1 });
}
function backgroundActionRequestId() {
  return globalThis.crypto?.randomUUID?.() || `background-action-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function documentHandoffNotice(job) {
  const state = job?.handoff?.state;
  const lastError = safeTechnicalDisplayText(job?.handoff?.lastError || t4("chat.handoffCheckModel"));
  return {
    queued: { tone: "warn", text: t4("chat.handoffQueued") },
    running: { tone: "warn", text: t4("chat.handoffRunning") },
    waiting_conversation: { tone: "warn", text: t4("chat.handoffWaitingConversation") },
    needs_user: { tone: "err", text: `${t4("chat.handoffNeedsUser", { error: lastError })}${t4("chat.handoffRedeliverNote")}` },
    user_paused: { tone: "warn", text: t4("chat.handoffUserPaused") },
    legacy_unassigned: { tone: "warn", text: t4("chat.handoffLegacy") }
  }[state] || null;
}
function retryDocumentDelivery(job) {
  return job?.kind === "document"
    && ["completed", "completed_with_warnings", "failed", "interrupted", "paused", "awaiting_output"].includes(job?.status)
    && job?.handoff?.state === "needs_user";
}
function documentJobStageLabel(stage) {
  return {
    extracting: t4("chat.stageExtracting"),
    "selecting-model": t4("chat.stageSelectingModel"),
    draft: t4("chat.stageDraft"),
    "quality-repair": t4("chat.stageQualityRepair"),
    "quality-review": t4("chat.stageQualityReview"),
    "batch-complete": t4("chat.stageBatchComplete"),
    assembling: t4("chat.stageAssembling"),
    summary: t4("chat.stageSummary"),
    completed: t4("chat.stageCompleted"),
    failed: t4("chat.stageFailed"),
    cancelled: t4("chat.stageCancelled"),
    stopped: t4("chat.stageStopped"),
    abandoned: t4("chat.stageAbandoned"),
    "source-changed": t4("chat.stageSourceChanged"),
    "awaiting-output": t4("chat.stageAwaitingOutput"),
    "waiting-provider": t4("chat.stageWaitingProvider"),
    "job-timeout": t4("chat.stageJobTimeout"),
    "job-call-budget": t4("chat.stageJobCallBudget")
  }[stage] || "";
}
function documentJobProgressLabel(job) {
  const progress = job?.progress || {};
  const unit = progress.unitLabel || t4("chat.progressUnitBatch");
  if (progress.total) return `${progress.completed}/${progress.total} ${unit}`;
  if (progress.completed) return t4("chat.progressCompletedUnits", { completed: progress.completed, unit });
  return documentJobStageLabel(progress.stage) || t4("chat.progressPreparing");
}
function documentRetryLabel(modelIssues) {
  const issues = Array.isArray(modelIssues) ? modelIssues : [];
  if (issues.some((issue) => issue.category === "insufficient_balance" || issue.category === "quota_exhausted")) return t4("chat.retryAfterBalance");
  if (issues.some((issue) => issue.requiresUserAction === true)) return t4("chat.retryAfterModelFix");
  return t4("chat.retryFailedPart");
}
function documentIssueBatchLabel(issue) {
  const batches = Array.isArray(issue?.affectedBatches) ? issue.affectedBatches : [];
  if (batches.length === 0) return t4("chat.taskLevelModelCall");
  const labels = batches.slice(0, 6).map((batch) => batch.label || batch.id).filter(Boolean);
  return `${labels.join(t4("chat.listSep"))}${batches.length > labels.length ? t4("chat.etcSuffix") : ""}`;
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
  const genericUserActionText = safeTechnicalDisplayText(typeof genericUserAction === "string"
    ? genericUserAction
    : genericUserAction?.question || genericUserAction?.message || genericUserAction?.prompt || genericUserAction?.label || t4("chat.userActionNeededFallback"));
  const genericOutcomeSummary = safeTechnicalDisplayText(selected?.outcomeSummary).trim();
  const genericBlockingReason = selected?.blockingReason;
  const genericBlockingReasonText = safeTechnicalDisplayText(typeof genericBlockingReason === "string"
    ? genericBlockingReason
    : genericBlockingReason?.message || genericBlockingReason?.reason || genericBlockingReason?.code || "").trim();
  const genericBlockingReasonCode = typeof genericBlockingReason === "object" && genericBlockingReason?.code
    ? safeTechnicalDisplayText(genericBlockingReason.code)
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
    if (["cancel", "delete_record"].includes(action) && !confirm(action === "cancel" ? t4("chat.confirmCancelTaskDetail") : t4("chat.confirmDeleteRecordDetail"))) return;
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
      const path = prompt(t4("chat.promptNewOutputPath"), selected.outputPath || "");
      if (path === null || !path.trim()) return;
      payload = { path: path.trim(), ...(genericUserInputRequestId ? { requestId: genericUserInputRequestId } : {}) };
    }
    if (action === "ack_outcome") {
      if (!selectedDelivery?.deliveryId || !selectedDelivery?.target) return;
      payload = { deliveryId: selectedDelivery.deliveryId, consumer: selectedDelivery?.target };
    }
    if (action === "retry_delivery") {
      if (!conversationDelivery?.deliveryId) return;
      if (!confirm(t4("chat.confirmRedelivery"))) return;
      payload = { deliveryId: conversationDelivery.deliveryId, consumer: "conversation" };
    }
    onControl(selected.id, action, payload);
  };
  const modelCaption = selected?.model
    ? `${selected.running ? t4("chat.currentModel") : t4("chat.recentModel")} · ${selected.model}${selected.modelRole === "fallback" ? t4("chat.fallbackModelSuffix") : ""}`
    : t4("chat.noModelCallYet");
  const retryLabel = documentRetryLabel(modelIssues);
  return html4`
    <section class="background-jobs-workbench" style="flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:var(--surface-default);border-top:1px solid var(--border-default)">
      <header class="background-jobs-header">
        <div class="background-jobs-heading"><strong>${t4("chat.bgJobsTitle")}</strong><span class="meta">${t4("chat.bgJobsHeaderMeta", { active: displayJobs.filter((job) => backgroundJobGroup(job) === "active").length, attention: displayJobs.filter((job) => backgroundJobGroup(job) === "attention").length, total: displayJobs.length })}${deliveries.length > 0 ? t4("chat.bgPendingDeliveries", { count: deliveries.length }) : ""}</span></div>
        <button type="button" class="background-jobs-close" onClick=${onClose} title=${t4("chat.bgJobsCloseTitle")} aria-label=${t4("chat.bgJobsClose")}><span aria-hidden="true">←</span><span>${t4("chat.bgJobsClose")}</span></button>
      </header>
      <div class="background-jobs-layout">
        <nav class="background-jobs-list">
          ${displayJobs.length === 0 ? html4`<div class="meta" style="padding:18px">${t4("chat.bgJobsEmpty")}</div>` : groups.map((group) => html4`
            <section class="background-job-group" aria-label=${group.label}>
              <div class="background-job-group-title"><span>${group.label}</span><span>${group.jobs.length}</span></div>
              ${group.jobs.map((job) => html4`
                <button type="button" class=${`background-job-list-item ${job.id === selected?.id ? "selected" : ""}`} onClick=${() => onSelect(job.id)}>
                  <div class="background-job-list-heading"><span class=${`pill ${backgroundJobIsActive(job) ? "info" : backgroundJobNeedsAttention(job) ? "warn" : job.status === "completed" || job.outcome === "delivered" ? "ok" : ""}`}>${job.kind === "document" || job.taskType === "document" ? t4("chat.kindDocument") : job.lifecycle === "service" ? t4("chat.kindService") : t4("chat.kindTask")}</span><span class="name">${backgroundJobTitle(job)}</span></div>
                  <div class="meta background-job-list-meta"><span>${isGenericBackgroundTask(job) ? genericTaskLifecycleLabel(job.lifecycle) : job.kind === "document" ? documentJobStatusLabel(job.status) : job.running ? t4("chat.genericRunning") : t4("chat.exitCode", { code: job.exitCode ?? "?" })}</span><span>${isGenericBackgroundTask(job) ? genericTaskProgressLabel(job) : job.kind === "document" ? documentJobProgressLabel(job) : ""}</span></div>
                </button>
              `)}
            </section>
          `)}
        </nav>
        <main class="background-jobs-detail">
          ${!selected ? html4`<div class="meta">${t4("chat.bgSelectTask")}</div>` : isGenericTask ? html4`
            <div class="background-task-detail-head">
              <div style="min-width:0;flex:1"><h3>${backgroundJobTitle(selected)}</h3><div class="meta">${selected.id} · ${genericTaskLifecycleLabel(selected.lifecycle)} · ${genericTaskOutcomeLabel(selected.outcome)} · ${genericTaskQualityLabel(selected.quality)}</div></div>
              <div class="background-task-actions">
                ${genericAllowedActions.map((action) => html4`<button type="button" class=${action === "resume" ? "primary" : action === "cancel" || action === "delete_record" ? "danger" : ""} onClick=${() => runGenericAction(action)}>${genericTaskActionLabel(action)}</button>`)}
              </div>
            </div>
            <div class="background-task-progress"><div style=${`width:${genericTaskProgressPercent(selected)}%`}></div></div>
            <div class="meta background-task-facts"><span>${genericTaskProgressLabel(selected)}</span><span>${t4("chat.revisionLabel", { n: selected.revision ?? 0 })}</span>${selected.executionEpoch ? html4`<span>${t4("chat.epochLabel", { n: selected.executionEpoch })}</span>` : null}</div>
            ${genericOutcomeSummary ? html4`<div class="notice background-task-outcome-summary"><strong>${t4("chat.outcomeSummaryTitle")}</strong><div>${genericOutcomeSummary}</div></div>` : null}
            ${genericBlockingReasonText ? html4`<div class="notice warn background-task-blocking-reason"><strong>${t4("chat.blockingReasonTitle")}</strong><div>${genericBlockingReasonText}${genericBlockingReasonCode && genericBlockingReasonCode !== genericBlockingReasonText ? html4` <span class="meta">(${genericBlockingReasonCode})</span>` : null}</div></div>` : null}
            ${selected.userAction ? html4`<div class="notice warn background-task-user-action"><strong>${t4("chat.userActionTitle")}</strong><div>${genericUserActionText}</div></div>` : null}
            ${genericDeliveryStates.length > 0 ? html4`<section class="background-task-section"><h4>${t4("chat.deliveryStateTitle")}</h4>${genericDeliveryStates.map((delivery) => {
    const deliveryState = delivery.deliveryState || {};
     const deliveryMessage = safeTechnicalDisplayText(deliveryState.lastError || deliveryState.reason || deliveryState.code || t4("chat.deliveryWaitingConfirm"));
     const deliveryCode = deliveryState.code && deliveryState.code !== deliveryMessage ? safeTechnicalDisplayText(deliveryState.code) : "";
     return html4`<div class=${`notice ${["blocked_user_retry", "exhausted"].includes(deliveryState.status) ? "err" : "warn"}`}><strong>${delivery.target === "conversation" ? t4("chat.deliveryConversation") : t4("chat.deliveryTaskCenter")} · ${safeTechnicalDisplayText(deliveryState.status || t4("chat.deliveryWaiting"))}</strong><div>${deliveryMessage}${deliveryCode ? html4` <span class="meta">(${deliveryCode})</span>` : null}</div></div>`;
  })}</section>` : null}
             ${genericWarnings.length > 0 ? html4`<section class="background-task-section"><h4>${t4("chat.warningsTitle")}</h4>${genericWarnings.map((warning) => html4`<div class="notice ${warning?.severity === "error" ? "err" : "warn"}">${safeTechnicalDisplayText(warning?.message || warning?.detail || warning)}</div>`)}</section>` : null}
            <section class="background-task-section"><h4>${t4("chat.artifactsTitle")}</h4>${genericArtifacts.length === 0 ? html4`<div class="meta">${t4("chat.artifactsEmpty")}</div>` : html4`<ul class="background-task-artifacts">${genericArtifacts.map((artifact, index) => html4`<li><span title=${artifact?.path || ""}>${genericTaskArtifactLabel(artifact, index)}</span>${artifact?.path ? html4`<button type="button" onClick=${() => onPreview(selected, artifact)}>${t4("chat.previewBtn")}</button>` : null}</li>`)}</ul>`}</section>
            ${selected.coverage ? html4`<section class="background-task-section"><h4>${t4("chat.coverageTitle")}</h4><div class="meta">${typeof selected.coverage === "string" ? selected.coverage : JSON.stringify(selected.coverage)}</div></section>` : null}
          ` : !isDocument ? html4`
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px"><div><h3 style="margin:0 0 6px;font-size:15px">${selected.command}</h3><div class="meta">${selected.running ? t4("chat.procRunning") : t4("chat.procEnded", { code: selected.exitCode ?? "?" })}</div></div>${selected.running ? html4`<button type="button" onClick=${() => onStop(selected.id)}>${t4("chat.stopBtn")}</button>` : null}</div>
          ` : html4`
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap">
              <div style="min-width:0;flex:1"><h3 style="margin:0 0 5px;font-size:16px;overflow-wrap:anywhere">${selected.command}</h3><div class="meta">${documentJobStatusLabel(selected.status)} · ${documentJobStageLabel(progress.stage) || t4("chat.waitingNextStep")}</div></div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
                ${selected.running && !selected.paused ? html4`<button type="button" onClick=${() => onControl(selected.id, "pause")}>${t4("chat.pauseBtn")}</button>` : null}
                ${resumable ? html4`<button type="button" class="primary" onClick=${() => onControl(selected.id, "resume")}>${selected.artifactStatus === "modified" ? t4("chat.resumeSaveAs") : selected.artifactStatus === "missing" ? t4("chat.resumeRecoverFinal") : selected.status === "awaiting_output" ? t4("chat.resumeSubmitDraft") : t4("chat.resumeContinue")}</button>` : null}
                ${["completed_with_warnings", "failed"].includes(selected.status) ? html4`<button type="button" title=${modelIssues.find((issue) => issue.requiresUserAction)?.action || t4("chat.retryFailedPart")} onClick=${() => onControl(selected.id, "retry")}>${retryLabel}</button>` : null}
                ${deliveryRetryable ? html4`<button type="button" title=${t4("chat.bgRedeliverTitle")} onClick=${() => { if (confirm(t4("chat.redeliverConfirm"))) onControl(selected.id, "retry_delivery"); }}>${t4("chat.redeliverBtn")}</button>` : null}
                ${active ? html4`<button type="button" onClick=${() => onStop(selected.id)}>${t4("chat.bgStopNow")}</button>` : null}
                ${abandonable ? html4`<button type="button" onClick=${() => { if (confirm(t4("chat.abandonConfirm"))) onAbandon(selected.id); }}>${t4("chat.abandonBtn")}</button>` : null}
                ${selected.previewAvailable || ["completed", "completed_with_warnings"].includes(selected.status) ? html4`<button type="button" onClick=${() => onPreview(selected)}>${t4("chat.previewArtifactBtn")}</button>` : null}
                ${deletable ? html4`<button type="button" onClick=${() => { if (confirm(t4("chat.deleteRecordConfirm"))) onDelete(selected.id); }}>${t4("chat.deleteRecordBtn")}</button>` : null}
              </div>
            </div>
            <div style="height:6px;background:var(--border-subtle);overflow:hidden;margin:16px 0 8px"><div style=${`height:100%;width:${progress.percent ?? 0}%;background:${selected.qualityPassed === false ? "var(--color-warning)" : "var(--accent-primary)"}`}></div></div>
            <div class="meta" style="display:flex;gap:18px;flex-wrap:wrap"><span>${documentJobProgressLabel(selected)}</span><span>${t4("chat.modelCallsSummary", { total: progress.taskModelCalls || 0, current: progress.executionModelCalls || 0, limit: progress.taskModelCallLimit || "—" })}</span><span>${modelCaption}</span>${progress.currentLabel ? html4`<span title=${progress.currentLabel}>${t4("chat.currentChunk", { label: progress.currentLabel })}</span>` : null}</div>
            ${handoffNotice ? html4`<div class=${`notice ${handoffNotice.tone}`} style="margin-top:12px">${handoffNotice.text}</div>` : null}
            ${selected.status === "awaiting_output" ? html4`<div class="notice warn" style="margin-top:12px"><strong>${t4("chat.awaitingOutputTitle")}</strong><div style="margin-top:4px">${t4("chat.awaitingOutputBody")}</div></div>` : null}
            ${selected.artifactStatus === "missing" ? html4`<div class="notice err" style="margin-top:12px"><strong>${t4("chat.artifactMissingTitle")}</strong><div style="margin-top:4px">${t4("chat.artifactMissingBody")}</div></div>` : null}
            ${selected.artifactStatus === "modified" ? html4`<div class="notice warn" style="margin-top:12px"><strong>${t4("chat.artifactModifiedTitle")}</strong><div style="margin-top:4px">${t4("chat.artifactModifiedBody")}</div></div>` : null}
            ${selected.status === "completed_with_warnings" ? html4`<div class="notice warn" style="margin-top:12px"><strong>${t4("chat.completedWarnTitle")}</strong><div style="margin-top:4px">${t4("chat.completedWarnBody")}</div></div>` : null}
            ${selected.error ? html4`<div class="notice err" style="margin-top:12px">${redactSensitiveDisplayText(selected.error)}</div>` : null}
            ${showReviewReasons && (reviewWarnings.length > 0 || modelIssues.length > 0) ? html4`
              <section style="margin-top:18px">
                <h4 style="font-size:13px;margin:0 0 8px">${t4("chat.reviewReasonsTitle")}</h4>
                ${reviewWarnings.map((warning) => html4`<div class="notice warn" style="margin:0 0 8px">${redactSensitiveDisplayText(warning.message || t4("chat.reviewWarningFallback"))}</div>`)}
                ${modelIssues.map((issue) => html4`
                  <div class="notice warn" style="margin:0 0 8px">
                     <div><strong>${safeTechnicalDisplayText(issue.providerId || t4("chat.unknownProvider"))}/${safeTechnicalDisplayText(issue.modelId || t4("chat.unknownModel"))}</strong> · ${safeTechnicalDisplayText(issue.message || t4("chat.modelCallFailed"))}</div>
                    <div class="meta" style="margin-top:5px">${t4("chat.affectedBatches", { label: documentIssueBatchLabel(issue) })}</div>
                     ${issue.action ? html4`<div style="margin-top:5px">${t4("chat.suggestionPrefix")}${safeTechnicalDisplayText(issue.action)}</div>` : null}
                    ${redactTechnicalMessages(issue.technicalMessages).length > 0 ? html4`<details style="margin-top:6px"><summary class="meta" style="cursor:pointer">${t4("chat.technicalInfo")}</summary><div class="meta" style="margin-top:5px;overflow-wrap:anywhere">${redactTechnicalMessages(issue.technicalMessages).join(t4("chat.techMsgJoin"))}</div></details>` : null}
                  </div>
                `)}
              </section>
            ` : null}
            <section style="margin-top:18px"><h4 style="font-size:13px;margin:0 0 8px">${t4("chat.sourceAndArtifact")}</h4><div class="meta" style="overflow-wrap:anywhere">${t4("chat.outputLabel", { path: selected.outputPath || t4("chat.outputUndecided") })}</div>${sourcePaths.length > 0 ? html4`<ol style="margin:8px 0 0;padding-left:22px">${sourcePaths.map((path) => html4`<li style="font-size:12px;line-height:1.6;overflow-wrap:anywhere">${path}</li>`)}</ol>` : null}</section>
            ${criteria.length > 0 ? html4`<section style="margin-top:18px"><h4 style="font-size:13px;margin:0 0 8px">${t4("chat.criteriaTitle")}</h4><ul style="margin:0;padding-left:20px">${criteria.map((item) => html4`<li style="font-size:12px;line-height:1.6">${item}</li>`)}</ul></section>` : null}
            ${modelHistory.length > 0 ? html4`<section style="margin-top:18px"><h4 style="font-size:13px;margin:0 0 8px">${t4("chat.modelHistoryTitle")}</h4><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th style="text-align:left;padding:6px;border-bottom:1px solid var(--border-default)">${t4("chat.thModel")}</th><th style="text-align:left;padding:6px;border-bottom:1px solid var(--border-default)">${t4("chat.thRole")}</th><th style="text-align:left;padding:6px;border-bottom:1px solid var(--border-default)">${t4("chat.thResult")}</th><th style="text-align:left;padding:6px;border-bottom:1px solid var(--border-default)">${t4("chat.thCalls")}</th></tr></thead><tbody>${modelHistory.slice(-50).map((entry) => html4`<tr><td style="padding:6px;border-bottom:1px solid var(--border-subtle)">${entry.providerId}/${entry.modelId}</td><td style="padding:6px;border-bottom:1px solid var(--border-subtle)">${entry.role === "fallback" ? t4("chat.roleFallback") : t4("chat.rolePrimary")}</td><td style="padding:6px;border-bottom:1px solid var(--border-subtle)">${entry.passed ? t4("chat.resultPass") : t4("chat.resultFail")}</td><td style="padding:6px;border-bottom:1px solid var(--border-subtle)">${entry.attempts || 0}</td></tr>`)}</tbody></table></div></section>` : null}
            ${preview ? html4`<section style="margin-top:18px"><h4 style="font-size:13px;margin:0 0 8px">${t4("chat.draftPreviewTitle")}${selected.preview?.partial ? t4("chat.draftPreviewPartial") : ""}</h4><pre style="margin:0;max-height:360px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;padding:12px;background:var(--surface-subtle);border:1px solid var(--border-default);font-size:12px;line-height:1.55">${preview}${String(selected.preview.content).length > preview.length ? t4("chat.previewTruncated") : ""}</pre></section>` : null}
            ${events.length > 0 ? html4`<details class="background-task-section" style="margin-top:18px"><summary style="cursor:pointer"><h4 style="display:inline;font-size:13px">${t4("chat.recentEventsTitle")}</h4></summary><div style="margin-top:8px">${events.map((event) => html4`<div class="meta" style="display:grid;grid-template-columns:150px minmax(0,1fr);gap:8px;padding:5px 0;border-bottom:1px solid var(--border-subtle)"><span>${event.at ? new Date(event.at).toLocaleString() : ""}</span><span style="overflow-wrap:anywhere">${redactSensitiveDisplayText(event.type || "event")}${event.batchId ? ` · ${redactSensitiveDisplayText(event.batchId)}` : ""}${event.error ? ` · ${redactSensitiveDisplayText(event.error)}` : ""}</span></div>`)}</div></details>` : null}
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
      reject(new Error(t4("chat.localDirOnlyDesktop")));
      return;
    }
    const requestId = `workspace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const timer = setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error(t4("chat.dirPickerTimeout")));
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
    showToast(t4("chat.selectMdDoc"), "info", 1500);
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
    showToast(err.message || t4("chat.mdOpenFailed"), "error", 5e3);
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
        showToast(t4("chat.pathCopied"), "info");
      }
    } catch (err) {
      showToast(err.message || t4("chat.fileOpFailed"), "error", 5e3);
    }
  };
  return html4`
    <div class="rail-card file-artifact-card">
      <div class="rh">
        <span>${selected ? t4("chat.currentReplyFiles") : t4("chat.latestFiles")}</span>
        ${selected ? html4`<button type="button" class="rail-card-link" onClick=${onFollowLatest}>${t4("chat.followLatest")}</button>` : null}
        <button type="button" class="rail-card-close" onClick=${onDismiss} title=${t4("chat.hide")}>×</button>
      </div>
      <div class="file-artifact-summary">${t4("chat.filesDetected", { count: files.length })}${groups.length > 1 ? t4("chat.foldersSuffix", { count: groups.length }) : ""}</div>
      <div class="file-artifact-list">
        ${groups.map((group) => html4`
          <div class="file-artifact-group" key=${group.dir || "root"}>
            ${groups.length > 1 ? html4`<div class="file-artifact-dir" title=${group.dir}>${group.dir || t4("chat.currentDir")}</div>` : null}
            ${group.files.map((file) => {
    const ext = String(file.ext || "").replace(/^\./, "").toLowerCase();
    const canPreview = file.previewable || FILE_ARTIFACT_PREVIEW_EXTS.has(ext);
    const canOpen = !canPreview && file.openable !== false && !FILE_ARTIFACT_SCRIPT_EXTS.has(ext);
    return html4`
            <div class="file-artifact-item" key=${file.path}>
              <div class="file-artifact-name" title=${file.path}>${file.filename}</div>
              <div class="file-artifact-meta">${fileArtifactKind(ext)}${file.size ? ` · ${fmtBytes(file.size)}` : ""}</div>
              <div class="file-artifact-actions">
                ${canPreview ? html4`<button type="button" onClick=${() => action("preview", file)}>${t4("chat.preview")}</button>` : null}
                ${canOpen ? html4`<button type="button" onClick=${() => action("open", file)}>${t4("chat.open")}</button>` : null}
                <button type="button" onClick=${() => action("folder", file)}>${t4("chat.openFolder")}</button>
                <button type="button" onClick=${() => action("copy", file)}>${t4("chat.copyPath")}</button>
              </div>
            </div>
          `;
  })}
          </div>
        `)}
      </div>
      ${more > 0 ? html4`<div class="file-artifact-more">${t4("chat.moreFilesDedup", { count: more })}</div>` : null}
    </div>
  `;
}
function recentFileSourceLabel(source) {
  if (source === "report") return t4("chat.srcReport");
  if (source === "opened") return t4("chat.srcOpened");
  if (source === "saved") return t4("chat.srcSaved");
  if (source === "generated") return t4("chat.srcGenerated");
  return t4("chat.srcFile");
}
function fmtRecentFileTime(ms) {
  if (!Number.isFinite(Number(ms))) return t4("chat.timeUnknown");
  try {
    return new Date(Number(ms)).toLocaleString();
  } catch {
    return t4("chat.timeUnknown");
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
        showToast(t4("chat.pathCopied"), "info");
      }
    } catch (err) {
      showToast(err.message || t4("chat.fileOpFailed"), "error", 5e3);
    }
  };
  return html4`
    <div class="files-panel">
      <div class="files-toolbar">
        <div class="files-heading">
          <div class="files-title">${t4("chat.filesTitle")}</div>
          <div class="files-subtitle">${t4("chat.filesSubtitle")}</div>
        </div>
        <input
          class="input files-search"
          value=${query}
          onInput=${(e3) => setQuery(e3.target.value)}
          placeholder=${t4("chat.filesSearchPlaceholder")}
        />
        <button class="btn" onClick=${load} disabled=${loading}>${loading ? t4("chat.refreshingBtn") : t4("chat.refreshBtn")}</button>
      </div>
      ${error ? html4`<div class="files-notice err">${t4("chat.filesLoadFailed")}${error.message}</div>` : null}
      ${loading && files.length === 0 ? html4`<div class="files-empty">${t4("chat.filesLoading")}</div>` : null}
      ${!loading && visible.length === 0 ? html4`<div class="files-empty">${query.trim() ? t4("chat.filesNoMatch") : t4("chat.filesEmpty")}</div>` : null}
      ${visible.length > 0 ? html4`
        <div class="files-summary">${t4("chat.filesSummary", { total: files.length })}${query.trim() ? t4("chat.filesSummaryFiltered", { count: visible.length }) : ""}</div>
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
                  ${canPreview ? html4`<button type="button" onClick=${() => action("preview", file)}>${t4("chat.preview")}</button>` : null}
                  ${canOpen ? html4`<button type="button" onClick=${() => action("open", file)}>${t4("chat.open")}</button>` : null}
                  <button type="button" onClick=${() => action("folder", file)}>${t4("chat.openFolder")}</button>
                  <button type="button" onClick=${() => action("copy", file)}>${t4("chat.copyPath")}</button>
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
  const [streamingSegments, setStreamingSegments] = d2([]);
  const [reasoningDisplay, setReasoningDisplay] = d2(() => {
    try {
      const stored = localStorage.getItem("visionox-reasoning-display");
      return stored === "expanded" || stored === "status" || stored === "hidden" ? stored : "live";
    } catch (e) {
      return "live";
    }
  });
  const reasoningExpanded = reasoningDisplay === "expanded";
  const changeReasoningDisplay = (mode) => {
    const next = mode === "status" || mode === "hidden" ? mode : "live";
    setReasoningDisplay(next);
    try {
      localStorage.setItem("visionox-reasoning-display", next);
    } catch (e) {
    }
  };
  // 过程显示三档：compact=全程单行卡；standard=状态行+事件驱动收敛；detailed=不收敛、明细常驻展开。
  const [processDisplay, setProcessDisplay] = d2(() => {
    try {
      const stored = localStorage.getItem("visionox-process-display");
      return stored === "compact" || stored === "detailed" ? stored : "standard";
    } catch (e) {
      return "standard";
    }
  });
  const changeProcessDisplay = (mode) => {
    const next = mode === "compact" || mode === "detailed" ? mode : "standard";
    setProcessDisplay(next);
    try {
      localStorage.setItem("visionox-process-display", next);
    } catch (e) {
    }
  };
  const [activeTools, setActiveTools] = d2([]);
  const [completedSteps, setCompletedSteps] = d2(0);
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
  const [promptOptimization, setPromptOptimization] = d2({ status: "idle", preview: null, scope: null });
  const [promptOptimizationRestore, setPromptOptimizationRestore] = d2(null);
  const promptOptimizationInFlightRef = A2(null);
  const promptDraftRevisionRef = A2(0);
  const promptDraftKindRef = A2(classifyPromptOptimizationDraft(initialInputRef.current, []).kind);
  const [promptDraftKind, setPromptDraftKind] = d2(promptDraftKindRef.current);
  const promptOptimizing = promptOptimization.status === "requesting";
  const promptOptimizationCleanupPending = promptOptimization.status === "cleanup"
    || promptOptimization.status === "cleanup_failed";
  const [jumpMessageId, setJumpMessageId] = d2(null);
  const [highlightMessageId, setHighlightMessageId] = d2(null);
  const [draftReady, setDraftReady] = d2(false);
  const [error, setError] = d2(null);
  const [bootError, setBootError] = d2(null);
  const [eventStreamConnected, setEventStreamConnected] = d2(true);
  const eventGuardRef = A2(null);
  if (eventGuardRef.current === null) eventGuardRef.current = createDashboardEventGuard();
  const executionStateRef = A2(null);
  if (executionStateRef.current === null) executionStateRef.current = createDashboardReducerState();
  const globalEventCursorRef = A2(createDashboardEventCursor(null));
  const snapshotSessionIdRef = A2(null);
  const snapshotHydratingRef = A2(true);
  const replayBufferedDashboardEventsRef = A2(null);
  const canonicalProjectionGenerationRef = A2(0);
  const canonicalMessageCountRef = A2(0);
  const resyncRunnerRef = A2(null);
  const eventBatcherRef = A2(null);
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
  const [activeConversationId, setActiveConversationIdState] = d2(null);
  const activeConversationIdRef = A2(activeConversationId);
  const workspaceDirRef = A2(workspaceDir);
  const modeRef = A2(mode);
  activeConversationIdRef.current = activeConversationId;
  workspaceDirRef.current = workspaceDir;
  modeRef.current = mode;
  const setActiveConversationId = q2((nextConversationId) => {
    const next = nextConversationId == null ? null : String(nextConversationId);
    if (String(activeConversationIdRef.current ?? "") !== String(next ?? "")) {
      canonicalProjectionGenerationRef.current += 1;
      activeConversationIdRef.current = next;
    }
    setActiveConversationIdState(next);
  }, []);
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
  const [showPlusMenu, setShowPlusMenu] = d2(false);
  const [showIndexPicker, setShowIndexPicker] = d2(false);
  const [steeringQueueId, setSteeringQueueId] = d2(null);
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
  const [backgroundJobsLoading, setBackgroundJobsLoading] = d2(false);
  const [showBackgroundJobs, setShowBackgroundJobs] = d2(false);
  const [selectedBackgroundJobId, setSelectedBackgroundJobId] = d2(null);
  const [backgroundJobDetail, setBackgroundJobDetail] = d2(null);
  const backgroundJobDetailRequestRef = A2(0);
  const backgroundHasActivity = backgroundJobs.some((job) => backgroundJobIsActive(job) || backgroundJobNeedsAttention(job));
  var fileInputRef = A2(null);
  const queuedPromptsRef = A2([]);
  const queueSubmittingRef = A2(false);
  // send() 重入守卫：一次提交 await 返回前忽略重复触发（双击发送/连按回车）。
  const sendInFlightRef = A2(false);
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
  const deletePromptOptimizationRequest = q2(async (requestId) => {
    const result = await api(`/optimize-prompt/${encodeURIComponent(requestId)}`, {
      method: "DELETE",
      timeoutMs: 15_000,
    });
    if (result?.cancelled !== true) throw new Error(t4("chat.optimizeCancelFailed"));
    return true;
  }, []);
  const cancelPromptOptimizationRequest = q2((reason = "cancelled", updateState = true) => {
    const flight = promptOptimizationInFlightRef.current;
    if (!flight) return Promise.resolve(true);
    if (flight.cancelPromise) return flight.cancelPromise;
    flight.cancelRequested = true;
    flight.controller.abort();
    const cancellationPromise = flight.cancelPromise = deletePromptOptimizationRequest(flight.requestId).then(() => {
      if (flight.cancelError) {
        const cancelError = flight.cancelError;
        flight.cancelError = null;
        setError((current) => current === cancelError ? null : current);
      }
      if (promptOptimizationInFlightRef.current === flight) promptOptimizationInFlightRef.current = null;
      if (updateState) setPromptOptimization({ status: reason, preview: null, scope: null });
      return true;
    }).catch((error) => {
      if (flight.cancelPromise === cancellationPromise) flight.cancelPromise = null;
      if (updateState && !flight.cleanupRequired && promptOptimizationInFlightRef.current === flight) {
        flight.cancelError = t4("chat.optimizeFailed", { msg: error.message });
        setError(flight.cancelError);
      }
      return false;
    });
    return cancellationPromise;
  }, [deletePromptOptimizationRequest]);
  const setChatInput = q2((value, options = {}) => {
    const text = String(value ?? "");
    const previous = inputValueRef.current;
    if (text !== previous) {
      promptDraftRevisionRef.current += 1;
      const nextKind = classifyPromptOptimizationDraft(text, slashCommands).kind;
      if (promptDraftKindRef.current !== nextKind) {
        promptDraftKindRef.current = nextKind;
        setPromptDraftKind(nextKind);
      }
      if (options.preserveOptimizationState !== true) {
        const hadActiveOptimization = Boolean(promptOptimizationInFlightRef.current);
        void cancelPromptOptimizationRequest("cancelled");
        if (!hadActiveOptimization) setPromptOptimization({ status: "idle", preview: null, scope: null });
        setPromptOptimizationRestore(null);
      }
    }
    inputValueRef.current = text;
    if (inputRef.current && inputRef.current.value !== text) inputRef.current.value = text;
    const hasContent = Boolean(text.trim());
    if (inputHasContentRef.current !== hasContent) {
      inputHasContentRef.current = hasContent;
      setInputHasContent(hasContent);
    }
    if (options.persist !== false) persistDraftSoon(text);
  }, [persistDraftSoon, cancelPromptOptimizationRequest, slashCommands]);
  y2(() => {
    const nextKind = classifyPromptOptimizationDraft(inputValueRef.current, slashCommands).kind;
    if (promptDraftKindRef.current !== nextKind) {
      promptDraftKindRef.current = nextKind;
      setPromptDraftKind(nextKind);
    }
  }, [slashCommands]);
  const optimizeCurrentPrompt = q2(async () => {
    const source = inputValueRef.current;
    const classification = classifyPromptOptimizationDraft(source, slashCommands);
    if (busy || promptOptimizationInFlightRef.current || ["empty", "command", "empty_skill"].includes(classification.kind)) return;
    const requestId = globalThis.crypto?.randomUUID?.() ?? `opt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const controller = new AbortController();
    const scope = createPromptOptimizationScope({
      requestId,
      draftRevision: promptDraftRevisionRef.current,
      original: source,
      sessionId: activeConversationIdRef.current ?? "",
      workspace: workspaceDirRef.current ?? "",
      mode: modeRef.current ?? "general",
    });
    const flight = { requestId, controller, scope, cancelRequested: false, cancelPromise: null, cancelError: null };
    promptOptimizationInFlightRef.current = flight;
    setPromptOptimization({ status: "requesting", preview: null, scope });
    setPromptOptimizationRestore(null);
    setError(null);
    try {
      const result = await api("/optimize-prompt", {
        method: "POST",
        body: { prompt: source, requestId, draftRevision: scope.draftRevision },
        signal: controller.signal,
        timeoutMs: 135_000,
      });
      if (promptOptimizationInFlightRef.current?.requestId !== requestId) return;
      if (!promptOptimizationResponseIsCurrent(result, scope, {
        draftRevision: promptDraftRevisionRef.current,
        original: inputValueRef.current,
        sessionId: activeConversationIdRef.current ?? "",
        workspace: workspaceDirRef.current ?? "",
        mode: modeRef.current ?? "general",
      })) {
        showToast(t4("chat.draftKept"), "info");
        setPromptOptimization({ status: "cancelled", preview: null, scope: null });
        return;
      }
      setPromptOptimization({ status: "preview", preview: result, scope });
    } catch (err) {
      if (err?.name === "AbortError" || controller.signal.aborted) {
        if (!flight.cancelRequested && promptOptimizationInFlightRef.current?.requestId === requestId) {
          setPromptOptimization({ status: "cancelled", preview: null, scope: null });
        }
        return;
      }
      if (promptOptimizationInFlightRef.current?.requestId !== requestId) return;
      const failure = describePromptOptimizationFailure(err);
      if (failure.cancelled) {
        setPromptOptimization({ status: "cancelled", preview: null, scope: null });
        return;
      }
      const primaryError = failure.messageKey
        ? t4(failure.messageKey)
        : t4("chat.optimizeFailed", { msg: err.message });
      setError(primaryError);
      if (failure.shouldCleanup) {
        flight.cleanupRequired = true;
        setPromptOptimization({ status: "cleanup", preview: null, scope });
        const cleaned = await cancelPromptOptimizationRequest("failed", false);
        setPromptOptimization({ status: cleaned ? "failed" : "cleanup_failed", preview: null, scope: null });
        return;
      }
      setPromptOptimization({ status: "failed", preview: null, scope: null });
    } finally {
      if (!flight.cancelRequested && promptOptimizationInFlightRef.current?.requestId === requestId) {
        promptOptimizationInFlightRef.current = null;
      }
    }
  }, [busy, slashCommands, cancelPromptOptimizationRequest]);
  const retryPromptOptimizationCleanup = q2(async () => {
    setPromptOptimization({ status: "cleanup", preview: null, scope: null });
    const cleaned = await cancelPromptOptimizationRequest("failed", false);
    setPromptOptimization({ status: cleaned ? "failed" : "cleanup_failed", preview: null, scope: null });
  }, [cancelPromptOptimizationRequest]);
  const applyPromptOptimization = q2(() => {
    const preview = promptOptimization.preview;
    if (!preview) return;
    setPromptOptimization({ status: "applying", preview, scope: promptOptimization.scope });
    setPromptOptimizationRestore({ original: preview.original });
    setChatInput(preview.optimized, { preserveOptimizationState: true });
    setPromptOptimization({ status: "idle", preview: null, scope: null });
    setTimeout(() => inputRef.current?.focus(), 0);
    showToast(t4("chat.optimizeDone"), "success");
  }, [promptOptimization, setChatInput]);
  const keepOriginalPrompt = q2(() => {
    setPromptOptimization({ status: "idle", preview: null, scope: null });
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);
  const restoreOriginalPrompt = q2(() => {
    if (!promptOptimizationRestore) return;
    const original = promptOptimizationRestore.original;
    setPromptOptimizationRestore(null);
    setChatInput(original, { preserveOptimizationState: true });
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [promptOptimizationRestore, setChatInput]);
  y2(() => {
    if (busy) void cancelPromptOptimizationRequest("cancelled");
  }, [busy, cancelPromptOptimizationRequest]);
  y2(() => {
    const hadActiveOptimization = Boolean(promptOptimizationInFlightRef.current);
    void cancelPromptOptimizationRequest("cancelled");
    if (!hadActiveOptimization) setPromptOptimization({ status: "idle", preview: null, scope: null });
    setPromptOptimizationRestore(null);
  }, [activeConversationId, workspaceDir, mode, cancelPromptOptimizationRequest]);
  y2(() => () => {
    void cancelPromptOptimizationRequest("cancelled", false);
  }, [cancelPromptOptimizationRequest]);
  y2(() => {
    queuedPromptsRef.current = queuedPrompts;
  }, [queuedPrompts]);
  const refreshBackgroundJobs = q2(async () => {
    setBackgroundJobsLoading(true);
    try {
      const result = await api("/background-jobs");
      const next = Array.isArray(result.jobs) ? result.jobs : [];
      setBackgroundJobs(next);
      setPendingDeliveries(Array.isArray(result.pendingDeliveries) ? result.pendingDeliveries : []);
      return next;
    } catch {
      return [];
    } finally {
      setBackgroundJobsLoading(false);
    }
  }, []);
  const stopBackgroundJob = q2(async (id) => {
    try {
      if (String(id).startsWith("document:") || String(id).startsWith("bg-")) {
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
      if (String(id).startsWith("bg-")) {
        await api(`/background-jobs/${encodeURIComponent(id)}`, { method: "POST", body: { action: "delete_record" } });
      } else {
        await api(`/background-jobs/${encodeURIComponent(id)}`, { method: "DELETE" });
      }
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
    backgroundWorkbenchRef.current = false;
    setShowBackgroundJobs(false);
    setBackgroundJobDetail(null);
  }, []);
  const openBackgroundWorkbench = q2(async (id = null) => {
    backgroundWorkbenchRef.current = true;
    // Invalidate any top-pagination request or delayed anchor restore that
    // belongs to the feed being replaced by the workbench.
    chatFeedGenerationRef.current += 1;
    earlierLoadTokenRef.current += 1;
    loadingEarlierRef.current = false;
    setLoadingEarlierMessages(false);
    const requestId = ++backgroundJobDetailRequestRef.current;
    // Capture while the feed is still mounted. The unmount cleanup may run
    // after the ref has detached and no longer describe the visible viewport.
    const currentFeed = feedRef.current;
    if (currentFeed) chatScrollSnapshotRef.current = {
      top: currentFeed.scrollTop,
      atBottom: currentFeed.scrollHeight - currentFeed.scrollTop - currentFeed.clientHeight < 80,
      anchor: captureChatScrollAnchor(currentFeed),
    };
    // 待处理的顶部加载属于即将卸下的旧 feed，跨工作台切换时必须丢弃，
    // 否则会在新 feed 恢复锚点后误触发加载、把视口移位一整页。
    if (topLoadTimerRef.current !== null) {
      clearTimeout(topLoadTimerRef.current);
      topLoadTimerRef.current = null;
    }
    setShowBackgroundJobs(true);
    // The feed context menu belongs to the chat viewport. Clear it before
    // replacing that viewport with the background workbench so a stale menu
    // cannot remain above the workbench or trigger hidden-chat actions.
    setFeedMenu(null);
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
        const filename = artifact.filename || artifact.name || artifact.path.split(/[\\/]/).pop() || t4("chat.artifactDefaultName");
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
      if (!preview?.content) throw new Error(t4("chat.noPreviewableChunk"));
      showArtifactPreview({
        id: `document-job-${Date.now()}`,
        filename: preview.filename || t4("chat.docPreviewDefaultName"),
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
    if (!showBackgroundJobs && !backgroundHasActivity) return;
    const id = setInterval(refreshBackgroundJobs, 5e3);
    return () => clearInterval(id);
  }, [refreshBackgroundJobs, showBackgroundJobs, backgroundHasActivity]);
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
  const feedRef = A2(null);
  // Preact may clear the object ref after the outgoing ChatFeed has already
  // unmounted, then attach the replacement feed on a later commit. Keep a
  // small mount generation so the scroll effect gets one more pass for the
  // connected replacement instead of consuming a workbench snapshot against
  // a detached node.
  const [feedMountVersion, setFeedMountVersion] = d2(0);
  const feedMountFrameRef = A2(null);
  const setFeedRef = q2((node) => {
    if (feedRef.current === node) return;
    feedRef.current = node;
    // Ref callbacks run during DOM commit, before the node is necessarily
    // attached to document. Defer the generation bump until the next paint so
    // the scroll restore effect sees a connected replacement feed instead of
    // early-returning on the transient pre-attachment state.
    if (feedMountFrameRef.current !== null) {
      cancelAnimationFrame(feedMountFrameRef.current);
      feedMountFrameRef.current = null;
    }
    if (!node) return;
    const trackedNode = node;
    const bumpWhenConnected = (remainingFrames) => {
      if (feedRef.current !== trackedNode) return;
      if (trackedNode.isConnected) {
        feedMountFrameRef.current = null;
        setFeedMountVersion((version) => version + 1);
        return;
      }
      if (remainingFrames <= 0) return;
      feedMountFrameRef.current = requestAnimationFrame(() => bumpWhenConnected(remainingFrames - 1));
    };
    feedMountFrameRef.current = requestAnimationFrame(() => bumpWhenConnected(2));
  }, []);
  // 滚动所有权唯一事实源：true=跟随底部（内容增长时贴底）；
  // false=手动阅读（程序禁止写 scrollTop，只累计"下方新消息"提示）。
  // 只有用户原始输入事件能置 false；只有显式动作（发送/回到底部/打开会话）能置 true。
  const followingBottomRef = A2(true);
  const scrollSchedulerRef = A2(null);
  const jumpHighlightTimerRef = A2(null);
  const chatScrollSnapshotRef = A2(null);
  const chatFeedGenerationRef = A2(0);
  const earlierLoadTokenRef = A2(0);
  const backgroundWorkbenchRef = A2(false);
  const renderedFrameCountRef = A2(0);
  const lastScrollTopRef = A2(0);
  const loadingEarlierRef = A2(false);
  const scrollbarDraggingRef = A2(false);
  const loadEarlierMessagesRef = A2(null);
  // 顶部自动加载的防抖句柄与挂载/恢复后的短暂抑制期：
  // 滚动停止 150ms 且仍停在顶部才触发历史加载。
  const topLoadTimerRef = A2(null);
  const suppressTopLoadUntilRef = A2(0);
  const [hasNewBelow, setHasNewBelow] = d2(false);
  const [newBelowCount, setNewBelowCount] = d2(0);
  const [feedMenu, setFeedMenu] = d2(null);
  const scheduleBottomPin = q2(() => {
    if (!scrollSchedulerRef.current) {
      scrollSchedulerRef.current = createFrameScheduler({
        run() {
          const el = feedRef.current;
          if (!el || !followingBottomRef.current) return;
          el.scrollTop = el.scrollHeight;
          lastScrollTopRef.current = el.scrollTop;
        },
      });
    }
    scrollSchedulerRef.current.schedule();
  }, []);
  // 脱离跟随：用户上滚/拖滚动条/触摸滑动/上翻按键/跳转消息时调用。
  // 从此程序不再写 scrollTop，直到用户显式回到底部。
  const stopFollowing = q2(() => {
    scrollSchedulerRef.current?.cancel();
    followingBottomRef.current = false;
  }, []);
  // 恢复跟随：仅发送消息、点"回到底部"/新消息 pill、打开会话等显式动作调用。
  const followBottom = q2(() => {
    followingBottomRef.current = true;
    setHasNewBelow(false);
    setNewBelowCount(0);
    scheduleBottomPin();
  }, [scheduleBottomPin]);
  // 顶部自动加载：滚动停止 150ms 后仍停在顶部才触发，一次性操作，
  // 加载完成后由锚点恢复保持视口位置，不持有任何长期滚动状态。
  const scheduleTopLoadCheck = q2(() => {
    if (topLoadTimerRef.current !== null) clearTimeout(topLoadTimerRef.current);
    topLoadTimerRef.current = setTimeout(() => {
      topLoadTimerRef.current = null;
      const el = feedRef.current;
      if (!el || !el.isConnected) return;
      if (!shouldTriggerTopLoad({
        scrollTop: el.scrollTop,
        threshold: CHAT_TOP_LOAD_THRESHOLD,
        loading: loadingEarlierRef.current,
        dragging: scrollbarDraggingRef.current,
        backgrounded: backgroundWorkbenchRef.current,
        suppressed: Date.now() < suppressTopLoadUntilRef.current,
      })) return;
      void loadEarlierMessagesRef.current?.();
    }, 150);
  }, []);
  const setAllToolGroupsOpen = (open) => {
    feedRef.current?.querySelectorAll("details.tool-log, details.process-card-details").forEach((node) => {
      node.open = open;
    });
  };
  const feedMenuAction = (action) => (event) => {
    event.stopPropagation();
    event.preventDefault();
    setFeedMenu(null);
    action();
  };
  const preserveVisibleHistoryOnAppend = q2(() => {
    if (!followingBottomRef.current) setVisibleMessageCount((count) => count + 1);
  }, []);
  const allVisibleMessages = projectChatTimeline(
    messages,
    [],
    streamingSegments.length > 0
      ? streamingSegments
      : streaming ? [{ ...streaming, messageId: streaming.id, segmentId: `${streaming.id}:segment:live` }] : [],
  ).frames.map((frame) => frame.message);
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
    // 跳转是一次性操作：脱离跟随后 scrollIntoView，不需要所有权定时器——
    // 居中定位必然不在底部，后续是否贴底只由用户的显式动作决定。
    stopFollowing();
    if (jumpHighlightTimerRef.current !== null) {
      clearTimeout(jumpHighlightTimerRef.current);
      jumpHighlightTimerRef.current = null;
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlightMessageId(jumpMessageId);
    setJumpMessageId(null);
    try {
      if (window.__visionoxPendingChatJump?.messageId === jumpMessageId) {
        window.__visionoxPendingChatJump = null;
      }
    } catch {
    }
    jumpHighlightTimerRef.current = setTimeout(() => {
      jumpHighlightTimerRef.current = null;
      setHighlightMessageId((cur) => cur === jumpMessageId ? null : cur);
    }, 5e3);
  }, [stopFollowing, jumpMessageId, messages, streaming, streamingSegments, visibleMessageCount]);
  y2(() => () => {
    if (jumpHighlightTimerRef.current !== null) clearTimeout(jumpHighlightTimerRef.current);
    jumpHighlightTimerRef.current = null;
  }, []);
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
  }, [messages, streaming, streamingSegments, busy, fileArtifactsKey, fileArtifactsRetryTick, fileArtifactsSelectedMessageId, fileArtifactsByMessageId]);
  y2(() => {
    let cancelled = false;
    const requestGeneration = canonicalProjectionGenerationRef.current;
    const requestSessionId = activeConversationIdRef.current;
    let responseSessionId = null;
    const requestIsCurrent = () => !cancelled && dashboardSnapshotResponseIsCurrent({
      requestGeneration,
      currentGeneration: canonicalProjectionGenerationRef.current,
      requestSessionId,
      activeSessionId: activeConversationIdRef.current,
      responseSessionId,
    });
    (async () => {
      try {
        const data = await api(`/messages?limit=${CHAT_MESSAGE_PAGE_SIZE}`);
        responseSessionId = data.snapshot?.sessionId ?? null;
        if (!requestIsCurrent()) return;
        const page = projectChatMessagePage(data);
        const snapshotState = page.state;
        setMessages(page.messages);
        canonicalMessageCountRef.current = page.loadedCount;
        setTotalMessages(page.totalMessages);
        setBusy(data.snapshot ? snapshotState.busy : Boolean(data.busy));
        setOperation(data.snapshot ? snapshotState.operation : data.operation ?? null);
        setTodos(Object.values(snapshotState.todos));
        setActivePlan(snapshotState.plan);
        setActiveTools(Object.values(snapshotState.tools).filter((tool) => ["queued", "running", "recovered"].includes(String(tool.state ?? tool.status ?? ""))));
        executionStateRef.current = snapshotState;
        globalEventCursorRef.current = createDashboardEventCursor(snapshotState);
        snapshotSessionIdRef.current = responseSessionId ?? activeConversationIdRef.current ?? null;
      } catch (err) {
        if (requestIsCurrent()) setBootError(err.message);
      } finally {
        if (requestIsCurrent()) {
          snapshotHydratingRef.current = false;
          replayBufferedDashboardEventsRef.current?.();
        }
      }
      try {
        const m3 = await api("/modal");
        if (requestIsCurrent() && m3.modal) setModal(m3.modal);
      } catch {
      }
      try {
        const r3 = await api("/slash");
        if (requestIsCurrent()) setSlashCommands(r3.commands);
      } catch {
      }
      try {
        const retrieval = await api("/index-retrieval-mode");
        if (requestIsCurrent()) setIndexRetrievalMode(globalThis.VisionoxIndexModePolicy.normalize(retrieval.mode));
      } catch {
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const streamBufRef = A2(null);
  const streamFullTextRef = A2("");
  const streamFullReasoningRef = A2("");
  const streamSegmentStartRef = A2(0);
  const streamReasoningStartRef = A2(0);
  const streamSegmentCounterRef = A2(0);
  const streamRafRef = A2(null);
  const resyncingEventsRef = A2(false);
  const bufferedDashboardEventsRef = A2<any[]>([]);
  const flushStreaming = q2(() => {
    streamRafRef.current = null;
    if (!streamBufRef.current) return;
    setStreaming(streamBufRef.current);
    setStreamingSegments([streamBufRef.current]);
  }, []);
  const cancelStreamingRaf = q2(() => {
    if (streamRafRef.current !== null) {
      clearTimeout(streamRafRef.current);
      streamRafRef.current = null;
    }
    streamBufRef.current = null;
    streamFullTextRef.current = "";
    streamFullReasoningRef.current = "";
    streamSegmentStartRef.current = 0;
    streamReasoningStartRef.current = 0;
    streamSegmentCounterRef.current = 0;
    setStreamingSegments([]);
  }, []);
  const refetchCanonicalState = q2(async () => {
    const requestGeneration = canonicalProjectionGenerationRef.current;
    const expectedSessionId = activeConversationIdRef.current;
    const isCurrentSession = (responseSessionId = null) => dashboardSnapshotResponseIsCurrent({
      requestGeneration,
      currentGeneration: canonicalProjectionGenerationRef.current,
      requestSessionId: expectedSessionId,
      activeSessionId: activeConversationIdRef.current,
      responseSessionId,
    });
    let canonicalLoaded = false;
    try {
      const data = await api(`/messages?limit=${CHAT_MESSAGE_PAGE_SIZE}`);
      if (!isCurrentSession(data.snapshot?.sessionId ?? null)) return false;
      const page = projectChatMessagePage(data);
      const snapshotState = page.state;
      setMessages(page.messages);
      canonicalMessageCountRef.current = page.loadedCount;
      setTotalMessages(page.totalMessages);
      setBusy(data.snapshot ? snapshotState.busy : Boolean(data.busy));
      setOperation(data.snapshot ? snapshotState.operation : data.operation ?? null);
      setTodos(Object.values(snapshotState.todos));
      setActivePlan(snapshotState.plan);
      cancelStreamingRaf();
      setStreaming(null);
      setActiveTools(Object.values(snapshotState.tools).filter((tool) => ["queued", "running", "recovered"].includes(String(tool.state ?? tool.status ?? ""))));
      setCompletedSteps(0);
      executionStateRef.current = snapshotState;
      globalEventCursorRef.current = createDashboardEventCursor(snapshotState);
      snapshotSessionIdRef.current = data.snapshot?.sessionId ?? expectedSessionId ?? null;
      canonicalLoaded = true;
    } catch {
      return false;
    }
    try {
      const m3 = await api("/modal");
      if (isCurrentSession()) setModal(m3.modal ?? null);
    } catch {
    }
    try {
      const retrieval = await api("/index-retrieval-mode");
      if (isCurrentSession()) setIndexRetrievalMode(globalThis.VisionoxIndexModePolicy.normalize(retrieval.mode));
    } catch {
    }
    return canonicalLoaded && isCurrentSession();
  }, [cancelStreamingRaf]);
  y2(() => {
    let disposed = false;
    const applyDashboardEvent = (dash) => {
      if (dash.kind === "ping") return;
      const reduced = reduceDashboardEvent(executionStateRef.current, dash);
      executionStateRef.current = reduced.state;
      if (reduced.duplicate) return;
      if (reduced.resyncRequired) {
        resyncRunnerRef.current?.(dash);
        return;
      }
      if (dash.kind === "todo-update") {
        setTodos(Object.values(reduced.state.todos));
      }
      if (dash.kind === "busy-change") {
        setBusy(reduced.state.busy);
        if (!reduced.state.busy) setSemanticRetrievalStatus((current) => current === "running" ? "idle" : current);
        return;
      }
      if (dash.kind === "semantic-retrieval") {
        setSemanticRetrievalSources(Array.isArray(dash.sources) ? dash.sources : []);
        setSemanticRetrievalStatus(dash.status ?? (dash.sources?.length ? "completed" : "empty"));
        return;
      }
      if (dash.kind === "operation-change") {
        setOperation(reduced.state.operation);
        if (reduced.state.operation?.state === "cancelled") {
          setActiveTools([]);
          setCompletedSteps(0);
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
        const storedMessage = reduced.state.messages[String(dash.id ?? dash.messageId ?? "")];
        const projectedMessage = storedMessage ? {
          ...storedMessage,
          turnId: dash.turnId ?? storedMessage.turnId ?? null,
          eventEpoch: dash.eventEpoch ?? storedMessage.eventEpoch ?? null,
          eventSeq: dash.eventSeq ?? storedMessage.eventSeq ?? null,
        } : null;
        if (!projectedMessage) return;
        setSemanticRetrievalSources([]);
        setSemanticRetrievalStatus("running");
        setShowRetrievalSources(false);
        setTodos((current) => current.length > 0 && current.every((todo) => todo.status === "completed") ? [] : current);
        setPlanContinuation(null);
        setCompletedSteps(0);
        // 幂等追加：重同步(canonical)与事件流可能携带同一条 user 消息
        // （busy-change 先于 user 广播时会触发 event-gap 重放），按 id 去重，
        // 避免同一消息渲染出两条气泡；totalMessages 只在真插入时 +1。
        let inserted = false;
        setMessages((prev) => {
          if (prev.some((item) => String(item.id || "") === String(dash.id || ""))) return prev;
          inserted = true;
          canonicalMessageCountRef.current += 1;
          return [...prev, projectedMessage];
        });
        if (inserted) {
          preserveVisibleHistoryOnAppend();
          setTotalMessages((count) => count + 1);
        }
        return;
      }
      if (dash.kind === "assistant_delta") {
        if (dash.streamReset === true) {
          cancelStreamingRaf();
        }
        const cur = streamBufRef.current;
        if (!cur) preserveVisibleHistoryOnAppend();
        const baseId = cur?.id === dash.id ? cur : null;
        const reducedStream = reduced.state.streamOffsets[String(dash.id ?? dash.messageId ?? "")];
        const reasoningDelta = String(dash.reasoningDelta ?? "");
        const contentDelta = String(dash.contentDelta ?? "");
        if (!baseId && !streamBufRef.current && streamFullTextRef.current === "") {
          streamSegmentStartRef.current = 0;
          streamReasoningStartRef.current = 0;
        }
        const fullText = reducedStream?.contentText !== undefined
          ? String(reducedStream.contentText)
          : streamFullTextRef.current + contentDelta;
        const fullReasoning = reducedStream?.reasoningText !== undefined
          ? String(reducedStream.reasoningText)
          : streamFullReasoningRef.current + reasoningDelta;
        streamFullTextRef.current = fullText;
        streamFullReasoningRef.current = fullReasoning;
        let turnReasoning = baseId?.turnReasoning ?? "";
        let reasoningTurns = baseId?.reasoningTurns ?? 0;
        let reasoningStale = baseId?.reasoningStale === true;
        if (reasoningDelta) {
          // 工具事件之后的第一个思考增量开启新一轮：尾迹只保留当前轮
          if (reasoningStale && turnReasoning) {
            turnReasoning = "";
            reasoningTurns += 1;
          }
          if (reasoningTurns === 0) reasoningTurns = 1;
          turnReasoning += reasoningDelta;
          reasoningStale = false;
        }
        const segmentIndex = baseId?.segmentIndex ?? ++streamSegmentCounterRef.current;
        const segmentId = baseId?.segmentId ?? `${dash.id}:segment:${segmentIndex}`;
        streamBufRef.current = {
          id: dash.id,
          messageId: dash.id,
          role: "assistant",
          turnId: dash.turnId ?? null,
          eventEpoch: dash.eventEpoch ?? null,
          startEventSeq: baseId?.startEventSeq ?? dash.eventSeq ?? null,
          segmentId,
          segmentIndex,
          text: fullText.slice(streamSegmentStartRef.current),
          reasoning: fullReasoning.slice(streamReasoningStartRef.current),
          turnReasoning,
          reasoningTurns,
          reasoningStale
        };
        if (streamRafRef.current === null) {
          streamRafRef.current = setTimeout(flushStreaming, 75);
        }
        return;
      }
      if (dash.kind === "assistant_content_final" || dash.kind === "assistant_final" || dash.kind === "turn_finalized") {
        const isFinalized = dash.kind === "turn_finalized";
        const compatibilityOnly = dash.kind === "assistant_final" && dash.compatibility === true;
        // Content completion is a display fact. The model may still be
        // validating artifacts or closing tool frames, so only the
        // authoritative turn_finalized event is allowed to close execution
        // state. Legacy command replies without an operation remain safe to
        // close because they do not own an execution turn.
        const closesExecution = isFinalized || (!compatibilityOnly && !dash.operationId && !dash.turnId);
        const projectedMessage = reduced.state.messages[String(dash.id ?? dash.messageId ?? "")];
        if (!projectedMessage) return;
        const completedStream = streamBufRef.current;
        const replacedStreaming = Boolean(completedStream);
        const finalFullText = String(projectedMessage.text ?? "");
        const finalSegmentText = streamSegmentStartRef.current > 0 && finalFullText.length >= streamSegmentStartRef.current
          ? finalFullText.slice(streamSegmentStartRef.current)
          : finalFullText;
        const nextMessage = {
          ...projectedMessage,
          text: finalSegmentText || completedStream?.text || "",
          reasoning: projectedMessage.reasoning ?? completedStream?.reasoning,
          reasoningTurns: completedStream?.reasoningTurns > 1 ? completedStream.reasoningTurns : void 0,
          segmentId: completedStream?.segmentId,
          eventEpoch: completedStream?.eventEpoch ?? dash.eventEpoch ?? projectedMessage.eventEpoch ?? null,
          eventSeq: completedStream?.startEventSeq ?? dash.eventSeq ?? projectedMessage.eventSeq ?? null,
          __timelineSegmentId: completedStream?.segmentId,
        };
        if (closesExecution) {
          cancelStreamingRaf();
          setStreaming(null);
          setActiveTools([]);
        }
        if (!replacedStreaming) preserveVisibleHistoryOnAppend();
        let inserted = false;
        setMessages((prev) => {
          const index = prev.findIndex((item) => String(item.id || "") === String(dash.id || ""));
          if (index < 0) {
            const hasReceiptOnlyContent = isFinalized && Boolean(
              projectedMessage.receipt
              || projectedMessage.taskState
              || projectedMessage.executionState
              || projectedMessage.goalState
              || (Array.isArray(projectedMessage.warnings) && projectedMessage.warnings.length > 0)
            );
            if (!String(projectedMessage.text ?? "").trim() && !hasReceiptOnlyContent) return prev;
            inserted = true;
            if (!isFinalized) canonicalMessageCountRef.current += 1;
            return [...prev, nextMessage];
          }
          const copy = [...prev];
          copy[index] = { ...copy[index], ...nextMessage };
          return copy;
        });
        if (inserted && !isFinalized) setTotalMessages((count) => count + 1);
        return;
      }
      if (dash.kind === "tool_start") {
        const projectedTool = Object.values(reduced.state.tools).find((tool) => toolFrameMatches(tool, dash));
        if (!projectedTool) return;
        if (!dash.status || dash.status === "queued") preserveVisibleHistoryOnAppend();
        if (streamBufRef.current) {
          if (streamRafRef.current !== null) {
            clearTimeout(streamRafRef.current);
            streamRafRef.current = null;
          }
          const frozenSegment = {
            ...streamBufRef.current,
            id: `${streamBufRef.current.id}:${streamBufRef.current.segmentId}`,
            assistantMessageId: streamBufRef.current.id,
            streaming: false,
            reasoningStale: true,
            __timelineSegmentId: streamBufRef.current.segmentId,
          };
          setMessages((current) => current.some((item) => item.__timelineSegmentId === frozenSegment.__timelineSegmentId)
            ? current
            : [...current, frozenSegment]);
          streamSegmentStartRef.current = streamFullTextRef.current.length;
          streamReasoningStartRef.current = streamFullReasoningRef.current.length;
          streamBufRef.current = null;
          setStreaming(null);
          setStreamingSegments([]);
        }
        setActiveTools((current) => upsertActiveTool(current, projectedTool));
        setMessages((current) => upsertToolProgress(current, projectedTool));
        return;
      }
      if (dash.kind === "tool") {
        const projectedTool = Object.values(reduced.state.tools).find((tool) => toolFrameMatches(tool, dash));
        if (!projectedTool) return;
        if (streamBufRef.current?.turnReasoning) streamBufRef.current = { ...streamBufRef.current, reasoningStale: true };
        setActiveTools((current) => current.filter((item) => !toolFrameMatches(item, projectedTool)));
        setCompletedSteps((count) => count + 1);
        setMessages((current) => upsertToolProgress(current, projectedTool));
        return;
      }
      if (dash.kind === "artifact-created") {
        const assistantId = String(dash.assistantId || "");
        const eventArtifacts = Array.isArray(dash.files) ? dash.files : [];
        const artifactIds = new Set(eventArtifacts.map((file) => String(file?.id ?? "")).filter(Boolean));
        const artifactPaths = new Set(eventArtifacts.map((file) => String(file?.path ?? "")).filter(Boolean));
        const files = Object.values(reduced.state.artifacts)
          .filter((file) => artifactIds.has(String(file.id ?? "")) || artifactPaths.has(String(file.path ?? "")))
          .filter((file) => file?.path);
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
          setCompletedSteps(0);
        }
        const messageId = String(dash.messageId ?? dash.id ?? (dash.eventId ? `notice:${dash.eventId}` : ""));
        const projectedMessage = reduced.state.messages[messageId];
        if (!projectedMessage) return;
        let inserted = false;
        setMessages((prev) => {
          if (prev.some((item) => String(item.id || "") === messageId)) return prev;
          inserted = true;
          return [...prev, projectedMessage];
        });
        if (inserted) {
          preserveVisibleHistoryOnAppend();
        }
        return;
      }
      if (dash.kind === "status") {
        setStatusLine(dash.text);
        setTimeout(() => setStatusLine((cur) => cur === dash.text ? null : cur), 5e3);
        return;
      }
      if (dash.kind === "messages-reset") {
        setActiveTools(Object.values(reduced.state.tools).filter((tool) => ["queued", "running", "recovered"].includes(String(tool.state ?? tool.status ?? ""))));
        setCompletedSteps(0);
        setSemanticRetrievalSources([]);
        setSemanticRetrievalStatus("idle");
        setShowRetrievalSources(false);
        api("/index-retrieval-mode").then((retrieval) => setIndexRetrievalMode(globalThis.VisionoxIndexModePolicy.normalize(retrieval.mode))).catch(() => {});
        const resetMessages = orderedDashboardMessages(reduced.state).map((message) => ({
          ...message,
          id: message.id || `hist-${Math.random()}`,
          text: message.text || ""
        }));
        setMessages(resetMessages);
        canonicalMessageCountRef.current = resetMessages.length;
        setTotalMessages(dash.totalMessages ?? resetMessages.length);
        setFileArtifacts([]);
        setFileArtifactsKey("");
        setFileArtifactsDismissed(false);
        setFileArtifactsSelectedMessageId(null);
        setFileArtifactsByMessageId({});
        setQueuedPrompts([]);
        setQueueSendingId(null);
        setTodos(Object.values(reduced.state.todos));
        setActivePlan(reduced.state.plan);
        setBusy(reduced.state.busy);
        setOperation(reduced.state.operation);
        setPlanContinuation(null);
        setVisibleMessageCount(CHAT_INITIAL_RENDER_COUNT);
        // 会话切换：恢复跟随底部并清空"下方新消息"提示。
        followingBottomRef.current = true;
        setHasNewBelow(false);
        setNewBelowCount(0);
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
      if (dash.kind === "plan-activated" || dash.kind === "plan-step-complete" || dash.kind === "plan-revised" || dash.kind === "plan-archived" || dash.kind === "plan-cancelled" || dash.kind === "plan-pending-discarded" || dash.kind === "plan-revision-discarded") {
        setActivePlan(reduced.state.plan);
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
    const eventBatcher = createDashboardEventBatcher({
      onFlush: (events) => {
        if (disposed) return;
        for (const event of events) applyDashboardEvent(event);
      },
    });
    eventBatcherRef.current = eventBatcher;
    const routeDashboardEvent = (dash) => {
      if (dash.kind === "resync-required") {
        void resyncRunnerRef.current?.(dash);
        return;
      }
      // eventSeq belongs to the process-wide transport, not to one Session.
      // Observe it before payload filtering so another Session cannot create
      // a false gap in the active Session projection.
      const observed = observeDashboardEventCursor(globalEventCursorRef.current, dash);
      globalEventCursorRef.current = observed.cursor;
      if (observed.resyncRequired) {
        void resyncRunnerRef.current?.(dash);
        return;
      }
      const eventSessionId = String(dash.sessionId ?? "").trim();
      const activeSessionId = String(activeConversationIdRef.current || snapshotSessionIdRef.current || "");
      if (eventSessionId && activeSessionId && eventSessionId !== activeSessionId) {
        // A foreign Session event advances the process transport cursor without
        // entering this Session's projection. Flush first so it remains a
        // strict ordering barrier for already queued local events.
        eventBatcher.flush();
        executionStateRef.current = createDashboardReducerState({
          ...executionStateRef.current,
          epoch: observed.cursor.epoch,
          lastSeq: observed.cursor.lastSeq,
        });
        return;
      }
      eventBatcher.enqueue(dash);
    };
    const replayBufferedDashboardEvents = (additionalEvents = []) => {
      const buffered = bufferedDashboardEventsRef.current.splice(0);
      const replay = dashboardEventsAfterCursor(
        [...additionalEvents, ...buffered].filter((event) => event && event.kind !== "resync-required"),
        executionStateRef.current,
      );
      for (const event of replay) routeDashboardEvent(event);
    };
    replayBufferedDashboardEventsRef.current = replayBufferedDashboardEvents;
    const resyncDashboardEvents = async (triggerEvent = null) => {
      if (resyncingEventsRef.current) return;
      resyncingEventsRef.current = true;
      snapshotHydratingRef.current = true;
      canonicalProjectionGenerationRef.current += 1;
      try {
        const [canonicalLoaded] = await Promise.all([refetchCanonicalState(), refreshBackgroundJobs()]);
        if (canonicalLoaded !== true || disposed) {
          if (!disposed) setError(t4("chat.eventStreamError"));
          return;
        }
        replayBufferedDashboardEvents(triggerEvent ? [triggerEvent] : []);
      } finally {
        if (!disposed) {
          snapshotHydratingRef.current = false;
          resyncingEventsRef.current = false;
        }
      }
    };
    resyncRunnerRef.current = resyncDashboardEvents;
    const onDash = (dash) => {
      if (!eventGuardRef.current?.accept(dash)) return;
      if (snapshotHydratingRef.current || resyncingEventsRef.current) {
        bufferedDashboardEventsRef.current.push(dash);
        return;
      }
      routeDashboardEvent(dash);
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
      eventBatcher.dispose();
      eventBatcherRef.current = null;
      resyncRunnerRef.current = null;
      replayBufferedDashboardEventsRef.current = null;
      resyncingEventsRef.current = false;
      bufferedDashboardEventsRef.current.splice(0);
      cancelStreamingRaf();
    };
  }, [refetchCanonicalState, refreshBackgroundJobs, cancelStreamingRaf, preserveVisibleHistoryOnAppend, activeConversationId]);
  y2(() => {
    // A session switch invalidates queued transient events from the previous
    // conversation. Canonical state loading will repopulate the new session.
    eventBatcherRef.current?.discard();
    bufferedDashboardEventsRef.current.splice(0);
    resyncingEventsRef.current = false;
    executionStateRef.current = createDashboardReducerState(globalEventCursorRef.current);
    snapshotSessionIdRef.current = activeConversationId ?? null;
    eventGuardRef.current?.reset();
    if (activeConversationId) {
      snapshotHydratingRef.current = true;
      void resyncRunnerRef.current?.();
    }
  }, [activeConversationId]);
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
        setError(t4("chat.uploadFailed", { msg: err.message }));
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
    if (!file || !Number.isFinite(file.size) || file.size < 1) throw new Error(t4("chat.attachmentEmpty"));
    if (file.size > 50 * 1024 * 1024) throw new Error(t4("chat.attachmentTooLarge"));
    const isImage = String(file.type || "").startsWith("image/");
    const extension = /\.([^.]+)$/.exec(String(file.name || ""))?.[1]?.toLowerCase() || "";
    const videoMimeByExtension = { mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm" };
    const declaredMime = String(file.type || videoMimeByExtension[extension] || "application/octet-stream").toLowerCase();
    const isVideo = ["video/mp4", "video/quicktime", "video/webm"].includes(declaredMime) || Object.hasOwn(videoMimeByExtension, extension);
    if (!isImage && !isVideo) throw new Error(t4("chat.attachmentTypeUnsupported"));
    if (isImage && !canUploadImages) throw new Error(t4("chat.imageNotSupported"));
    if (isVideo && !canUploadVideos) throw new Error(t4("chat.videoNotSupported"));
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
      if (!completed.attachment?.id) throw new Error(t4("chat.attachmentNoId"));
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
        const staleError = new Error(t4("chat.attachmentStale"));
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
          reason: res.completion.error ?? t4("chat.lastRunFailed")
        };
      }
      followBottom();
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
  }, [followBottom, resolveSkillMention]);
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
      if (persisted?.ok === false) throw new Error(persisted.error || t4("chat.queuePersistFailed"));
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
      if (deleted?.ok === false) throw new Error(deleted.error || t4("chat.queueDeleteFailed"));
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
  // 引导：把排队消息立即注入当前进行中的任务（服务端在下一次模型请求边界生效）；
  // 成功后从队列移除，失败（如任务刚好收尾）保留排队并提示。
  const steerQueuedPrompt = q2(async (item) => {
    const opId = operation?.id;
    if (!opId || !item?.text || steeringQueueId) return false;
    setSteeringQueueId(item.id);
    try {
      await api(`/operations/${encodeURIComponent(opId)}/steer`, { method: "POST", body: { instruction: item.text } });
      await removeQueuedPrompt(item.id);
      showToast(t4("chat.queueGuided"), "success");
      return true;
    } catch (err) {
      showToast(t4("chat.queueGuideFailed", { error: err.message }), "info", 5e3);
      return false;
    } finally {
      setSteeringQueueId(null);
    }
  }, [operation?.id, steeringQueueId, removeQueuedPrompt]);
  const editQueuedPrompt = q2(async (item) => {
    if (!item) return;
    await removeQueuedPrompt(item.id);
    setChatInput(item.text || "");
    inputRef.current?.focus();
  }, [removeQueuedPrompt, setChatInput]);
  const clearQueuedPrompts = q2(async () => {
    const count = queuedPromptsRef.current.length;
    if (count > 0 && !confirm(t4("chat.queueClearConfirm", { count }))) return;
    const claimedQueueScope = queueStorageKey;
    try {
      const deleted = await deletePersistedQueuedPrompt();
      if (deleted?.ok === false) throw new Error(deleted.error || t4("chat.queueClearFailed"));
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
      if (deleted?.ok === false) throw new Error(deleted.error || t4("chat.queueClearFailed"));
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
    // 重入守卫：上一次提交尚未返回时忽略重复触发（双击发送/连按回车）。
    // 否则同一条内容会被二次提交，被服务端 LOOP_BUSY 拒绝后落入队列，
    // 任务结束 drain 时在对话流中产生重复气泡。
    if (sendInFlightRef.current) return;
    if (promptOptimizationCleanupPending) return;
    const text = inputValueRef.current.trim();
    const images = pendingImages.slice();
    if (!text && images.length === 0) return;
    if (!await cancelPromptOptimizationRequest("cancelled")) return;
    setPromptOptimization({ status: "idle", preview: null, scope: null });
    setPromptOptimizationRestore(null);
    sendInFlightRef.current = true;
    try {
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
        followBottom();
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
    } finally {
      sendInFlightRef.current = false;
    }
  }, [followBottom, busy, pendingImages, draftKey, enqueuePrompt, submitPromptPayload, setChatInput, cancelPromptOptimizationRequest, promptOptimizationCleanupPending]);
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
        followBottom();
      } else {
        setError(result.reason ?? "rejected");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSkillCredentialSaving(false);
    }
  }, [followBottom, skillCredentialSetup, skillCredentialValue, submitPromptPayload, setChatInput, draftKey, deletePersistedQueuedPrompt]);
  const resumeIncompletePlan = q2(async () => {
    if (busy || !planContinuation) return;
    const paused = planContinuation;
    setPlanContinuation(null);
    const result = await submitPromptPayload({
      text: t4("chat.planContinuationText")
    });
    if (!result.ok) {
      setPlanContinuation(paused);
      setError(result.reason ?? t4("chat.planContinueFailed"));
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
    canonicalProjectionGenerationRef.current += 1;
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
      canonicalMessageCountRef.current = 0;
      setTotalMessages(0);
      setVisibleMessageCount(CHAT_INITIAL_RENDER_COUNT);
      followingBottomRef.current = true;
      setHasNewBelow(false);
      setNewBelowCount(0);
      cancelStreamingRaf();
      setStreaming(null);
      setActiveTools([]);
      setCompletedSteps(0);
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
      followBottom();
      removeChatDraft(draftKey);
      showToast(t4("chat.newToast"), "info");
      setTimeout(() => void resyncRunnerRef.current?.(), 200);
    } catch (err) {
      setError(t4("chat.newFailed", { error: err.message }));
    }
  }, [followBottom, busy, messages.length, draftKey, pendingImages, confirmQueuedReset, waitForIdle, setChatInput, cancelStreamingRaf]);
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
      showToast(err.message || t4("chat.indexPreviewFailed"), "error", 5e3);
    }
  }, [workspaceDir]);
  const clearScrollback = q2(async () => {
    if (!(await confirmQueuedReset())) return;
    canonicalProjectionGenerationRef.current += 1;
    try {
      rotateUploadScope();
      await api("/submit", { method: "POST", body: { prompt: "/clear" } });
      await releaseUploadedImages(pendingImages);
      const nextOverview = await api("/overview").catch(() => null);
      setActiveConversationId(nextOverview?.conversationId ?? activeConversationId);
      setMessages([]);
      canonicalMessageCountRef.current = 0;
      setTotalMessages(0);
      setVisibleMessageCount(CHAT_INITIAL_RENDER_COUNT);
      followingBottomRef.current = true;
      setHasNewBelow(false);
      setNewBelowCount(0);
      cancelStreamingRaf();
      setStreaming(null);
      setActiveTools([]);
      setCompletedSteps(0);
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
      followBottom();
      removeChatDraft(draftKey);
      showToast(t4("chat.clearToast"), "info");
      setTimeout(() => void resyncRunnerRef.current?.(), 200);
    } catch (err) {
      setError(t4("chat.clearFailed", { error: err.message }));
    }
  }, [followBottom, draftKey, pendingImages, confirmQueuedReset, setChatInput, cancelStreamingRaf]);
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
      setChatInput(v3);
      updatePopover(v3);
    },
    [updatePopover, setChatInput]
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
      if ((e3.ctrlKey || e3.metaKey) && String(e3.key || "").toLowerCase() === "u") {
        if (fileInputRef.current) {
          e3.preventDefault();
          fileInputRef.current.click();
        }
        return;
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
          showClipboardNotice(t4("chat.clipboardNoPath"));
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
    // During the workbench swap a ref can briefly still point at the old
    // detached feed. Do not consume a transition snapshot or attach listeners
    // to that node; wait for the connected replacement on the next effect.
    if (!el || !el.isConnected) return;
    // ChatFeed can be temporarily unmounted by the background workbench.
    // Re-arm scroll listeners against the new element without carrying a
    // previous element's scroll position across it. 挂载/恢复后的短暂窗口内
    // 抑制顶部自动加载，避免恢复过程把视口停在顶部时误触发翻页。
    scrollbarDraggingRef.current = false;
    lastScrollTopRef.current = el.scrollTop;
    suppressTopLoadUntilRef.current = Date.now() + 400;
    const savedScroll = chatScrollSnapshotRef.current;
    chatScrollSnapshotRef.current = null;
    renderedFrameCountRef.current = 0;
    if (savedScroll) {
      const restoreGeneration = chatFeedGenerationRef.current;
      // Preact may attach the new ref one frame after this effect runs while
      // the workbench swaps the feed subtree. Retry briefly instead of
      // allowing the auto-pin path to consume the transition with scrollTop=0.
      const restore = (remainingFrames) => {
        const current = feedRef.current;
        if (restoreGeneration !== chatFeedGenerationRef.current) return;
        if (!current) {
          if (remainingFrames > 0) requestAnimationFrame(() => restore(remainingFrames - 1));
          return;
        }
        if (!savedScroll.atBottom) {
          // 非底部快照代表用户当时正在阅读历史：恢复像素位置的同时
          // 保持手动阅读模式，挂载后的内容增长不得把视口拉到尾部。
          scrollSchedulerRef.current?.cancel();
          followingBottomRef.current = false;
          const anchor = savedScroll.anchor;
          if (anchor?.id) {
            const selector = anchor.kind === "process" ? ".process-card[data-process-anchor-id]" : ".chat-msg[data-msg-id]";
            const node = Array.from(current.querySelectorAll(selector)).find((item) => anchor.kind === "process"
              ? item.dataset.processAnchorId === anchor.id
              : item.dataset.msgId === anchor.id);
            if (node) {
              const feedTop = current.getBoundingClientRect().top;
              const nodeTop = node.getBoundingClientRect().top - feedTop;
              const delta = nodeTop - anchor.offset;
              const beforeTop = current.scrollTop;
              current.scrollTop = beforeTop + delta;
              lastScrollTopRef.current = current.scrollTop;
              if (remainingFrames > 0) {
                requestAnimationFrame(() => restore(remainingFrames - 1));
              }
              return;
            }
            if (remainingFrames > 0) {
              requestAnimationFrame(() => restore(remainingFrames - 1));
              return;
            }
          }
        }
        const maxTop = Math.max(0, current.scrollHeight - current.clientHeight);
        current.scrollTop = savedScroll.atBottom ? maxTop : Math.min(savedScroll.top, maxTop);
        lastScrollTopRef.current = current.scrollTop;
      };
      requestAnimationFrame(() => restore(3));
    } else if (followingBottomRef.current) {
      // ChatFeed may have been remounted after the background workbench was
      // closed. Re-arm one coalesced bottom pin without writing twice in one
      // render turn.
      scheduleBottomPin();
    }
    const onScroll = () => {
      // scroll 事件只记录位置并调度顶部加载检查，永不改变跟随状态——
      // 内容高度变化（流式收敛、卡片折叠）产生不了输入事件，无从误判。
      lastScrollTopRef.current = el.scrollTop;
      if (el.scrollTop <= CHAT_TOP_LOAD_THRESHOLD) scheduleTopLoadCheck();
    };
    const onWheel = (event) => {
      if (Number(event.deltaY) < 0) {
        stopFollowing();
        // 停在顶部时的上滚滚轮可能不再触发 scroll 事件，这里直接调度检查。
        if (el.scrollTop <= CHAT_TOP_LOAD_THRESHOLD) scheduleTopLoadCheck();
      }
    };
    const onPointerDown = (event) => {
      const rect = el.getBoundingClientRect();
      const scrollbarWidth = Math.max(14, rect.width - el.clientWidth);
      if (el.scrollHeight > el.clientHeight && event.clientX >= rect.right - scrollbarWidth) {
        scrollbarDraggingRef.current = true;
        stopFollowing();
      }
    };
    const onPointerUp = () => {
      scrollbarDraggingRef.current = false;
    };
    const onKeyDown = (event) => {
      if (event.key === "PageUp" || event.key === "ArrowUp" || event.key === "Home") stopFollowing();
    };
    const onTouchMove = () => stopFollowing();
    const onContextMenu = (event) => {
      event.preventDefault();
      setFeedMenu({
        x: Math.min(event.clientX, Math.max(8, window.innerWidth - 190)),
        y: Math.min(event.clientY, Math.max(8, window.innerHeight - 140))
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("pointerdown", onPointerDown, { passive: true });
    el.addEventListener("keydown", onKeyDown);
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
    return () => {
      if (topLoadTimerRef.current !== null) {
        clearTimeout(topLoadTimerRef.current);
        topLoadTimerRef.current = null;
      }
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("keydown", onKeyDown);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [bootError, feedMountVersion, scheduleBottomPin, scheduleTopLoadCheck, showBackgroundJobs, stopFollowing]);
  y2(() => {
    const nextCount = allVisibleMessages.length;
    const added = Math.max(0, nextCount - renderedFrameCountRef.current);
    renderedFrameCountRef.current = nextCount;
    // 内容增长的唯一决策：跟随中→贴底；手动阅读→只累计提示，绝不写 scrollTop。
    const effect = computeGrowthEffect(followingBottomRef.current, added);
    if (effect.type === "pin") scheduleBottomPin();
    else if (effect.type === "count") {
      setNewBelowCount((count) => count + effect.added);
      setHasNewBelow(true);
    }
  }, [messages, scheduleBottomPin, streaming, streamingSegments]);
  y2(() => () => scrollSchedulerRef.current?.cancel(), []);
  y2(() => {
    if (!feedMenu) return;
    const close = () => setFeedMenu(null);
    const onKey = (event) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [feedMenu]);
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
    if (modelMenuSetting) pushModelNotice(t4("chat.modelApplying"), "info", 0);
    if (key === "preset") setPresetLocal(value);
    if (key === "reasoningEffort") setEffortLocal(value);
    if (key === "mode") setModeLocal(value);
    try {
      const updated = await api("/settings", { method: "POST", body: { [key]: value } });
      if (key === "mode") showToast(t4("chat.modeSwitchedNextChat"), "info");
      if ((key === "preset" || key === "model") && updated?.modelSwitch) {
        const switched = updated.modelSwitch;
        const count = Number.isFinite(switched.messageCount) ? switched.messageCount : 0;
        const adaptation = switched.contextStatus?.needsCompaction ? t4("chat.compactionNote") : "";
        pushModelNotice(switched.deferred
          ? t4("chat.modelQueuedSwitch", { model: switched.model, count, adaptation })
          : t4("chat.modelSwitchedKeep", { model: switched.model, count, adaptation }), "success");
      } else if (key === "preset") {
        pushModelNotice(t4("chat.effortSelected", { value }), "success");
      } else if (key === "reasoningEffort") {
        pushModelNotice(t4("chat.effortSetTo", { label: reasoningEffortLabel(value) }), "success");
      }
      try {
        const o3 = await api("/overview");
        setStats(o3.stats ?? null);
        setOverviewModel(o3.model ?? null);
        setPresetLocal(o3.preset ?? null);
        setEffortLocal(o3.reasoningEffort ?? null);
      } catch {}
    } catch (err) {
      if (modelMenuSetting) pushModelNotice(t4("chat.switchFailed", { msg: err.message }), "error", 5e3);
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
    pushModelNotice(t4("chat.modelSwitching"), "info", 0);
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
      pushModelNotice(Number.isFinite(count) ? t4("chat.modelSwitchedKeepCount", { count }) : t4("chat.modelSwitched"), "success");
    } catch (err) {
      pushModelNotice(t4("chat.switchFailed", { msg: err.message }), "error", 5e3);
    }
  }, [pushModelNotice]);
  const confirmProviderImport = q2(async (draft, plan) => {
    pushModelNotice(t4("chat.importingConfig"), "info", 0);
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
      pushModelNotice(t4("chat.importOkVerify"), "success", 5e3);
    } catch (err) {
      pushModelNotice(t4("chat.importFailed", { msg: err.message }), "error", 5e3);
    }
  }, [pushModelNotice]);
  const loadProviderImportFile = q2(async (event) => {
    const file = event.target.files?.[0];
    if (!file || providerImporting) return;
    setProviderImporting(true);
    pushModelNotice(t4("chat.checkingConfig"), "info", 0);
    try {
      const draft = parseProviderImportJson(await file.text());
      const plan = await api("/providers/import/preview", { method: "POST", body: draft });
      if (plan.requiresConfirmation === true && !confirm(t4("chat.confirmImportDeletes"))) {
        pushModelNotice(t4("chat.importCancelled"), "info");
        return;
      }
      await confirmProviderImport(draft, plan);
    } catch (err) {
      pushModelNotice(t4("chat.importFailed", { msg: err.message }), "error", 5e3);
    } finally {
      setProviderImporting(false);
    }
  }, [providerImporting, confirmProviderImport, pushModelNotice]);
  const testAllProviders = q2(async () => {
    if (providerTesting) return;
    setProviderTesting(true);
    pushModelNotice(t4("chat.testingAll"), "info", 0);
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
      pushModelNotice(failed > 0 ? t4("chat.testDoneWithFail", { passed: tested.passed, failed }) : t4("chat.testAllPassed", { passed: tested.passed }), failed > 0 ? "error" : "success", 5e3);
    } catch (err) {
      pushModelNotice(t4("chat.testFailed", { msg: err.message }), "error", 5e3);
    } finally {
      setProviderTesting(false);
    }
  }, [providerTesting, pushModelNotice]);
  const cleanupFailedModels = q2(async () => {
    const failed = providerModelTestSummary(providers ?? []).failed;
    if (!failed || !modelVerification?.testedAt || providerCleaning) return;
    if (!confirm(t4("chat.confirmCleanFailed", { failed }))) return;
    setProviderCleaning(true);
    pushModelNotice(t4("chat.cleaningFailed"), "info", 0);
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
      pushModelNotice(t4("chat.cleanedModels", { count: cleaned.removedModels }), "success", 5e3);
    } catch (err) {
      pushModelNotice(t4("chat.cleanFailed", { msg: err.message }), "error", 5e3);
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
    if (loadingEarlierRef.current || backgroundWorkbenchRef.current) return;
    const feed = feedRef.current;
    if (!feed || !feed.isConnected) return;
    const feedGeneration = chatFeedGenerationRef.current;
    const loadToken = ++earlierLoadTokenRef.current;
    const feedIsCurrent = () => !backgroundWorkbenchRef.current
      && feedGeneration === chatFeedGenerationRef.current
      && loadToken === earlierLoadTokenRef.current
      && feed.isConnected
      && feedRef.current === feed;
    const anchor = captureChatScrollAnchor(feed);
    // 加载历史是一次性操作：完成后仅复位加载标志。跟随状态不受影响——
    // 用户既然滚到了顶部，此前必然已通过输入事件脱离跟随。
    const finishLoading = () => {
      if (loadToken !== earlierLoadTokenRef.current) return;
      loadingEarlierRef.current = false;
      setLoadingEarlierMessages(false);
    };
    if (visibleMessageCount < messages.length) {
      loadingEarlierRef.current = true;
      setLoadingEarlierMessages(true);
      setVisibleMessageCount((count) => Math.min(messages.length, count + CHAT_RENDER_STEP));
      restoreChatScrollAnchor(feed, anchor, finishLoading, feedIsCurrent);
      return;
    }
    if (canonicalMessageCountRef.current >= totalMessages) return;
    const requestOffset = canonicalMessageCountRef.current;
    const requestGeneration = canonicalProjectionGenerationRef.current;
    const requestSessionId = activeConversationIdRef.current;
    const requestIsCurrent = (responseSessionId = null) => dashboardSnapshotResponseIsCurrent({
      requestGeneration,
      currentGeneration: canonicalProjectionGenerationRef.current,
      requestSessionId,
      activeSessionId: activeConversationIdRef.current,
      responseSessionId,
    }) && feedIsCurrent();
    loadingEarlierRef.current = true;
    setLoadingEarlierMessages(true);
    try {
      const data = await api(`/messages?limit=${CHAT_MESSAGE_PAGE_SIZE}&offset=${requestOffset}`);
      if (!requestIsCurrent(data.snapshot?.sessionId ?? null) || canonicalMessageCountRef.current !== requestOffset) {
        finishLoading();
        return;
      }
      const page = projectChatMessagePage(data);
      const earlier = page.messages;
      canonicalMessageCountRef.current = page.loadedCount;
      if (earlier.length > 0) {
        setMessages((current) => mergeDashboardMessagePages(earlier, current));
        setVisibleMessageCount((count) => count + Math.min(CHAT_RENDER_STEP, earlier.length));
      }
      setTotalMessages(page.totalMessages);
      restoreChatScrollAnchor(feed, anchor, finishLoading, feedIsCurrent);
    } catch (err) {
      if (loadToken === earlierLoadTokenRef.current && !backgroundWorkbenchRef.current) setError(err.message);
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
              <div class="work-mode-summary" title=${activeMode?.hint || t4("chat.modeSwitchHint")}>
                <span class="work-mode-label">${activeMode?.label ?? mode}</span>
                <span class="work-mode-desc">${activeMode?.description ?? t4("chat.switchWorkMode")}</span>
                <span class="work-mode-meta">ECC ${(activeMode?.effectiveRules ?? activeMode?.rules ?? []).join("+") || t4("chat.eccNotEnabled")}${eccRules?.available ? ` · ${(eccRules.enabled ?? []).length}/${eccRules.available.length}` : ""}</span>
              </div>
              <div class="mode-picker work-mode-picker" title=${t4("chat.modePickerTitle")}>
                ${modes.map((m) => html4`
                  <button
                    key=${m.id}
                    class="mode-btn ${mode === m.id ? "active accent" : ""}"
                    onClick=${() => setSetting("mode", m.id)}
                    title=${t4("chat.modeOptionTitle", { label: m.label, desc: m.description || t4("chat.switchWorkMode"), rules: (m.effectiveRules || m.rules || []).join("+") })}
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
            canonicalMessageCount=${canonicalMessageCountRef.current}
            streaming=${streaming}
            streamingSegments=${streamingSegments}
            taskActive=${busy}
            reasoningExpanded=${reasoningExpanded}
            reasoningDisplay=${reasoningDisplay}
            processDisplay=${processDisplay}
            innerRef=${setFeedRef}
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
          ${!showBackgroundJobs && hasNewBelow ? html4`
            <button type="button" class="chat-new-messages-pill" onClick=${followBottom}>${t4("chat.newMessagesBelowCount", { count: newBelowCount })}</button>
          ` : null}
          ${!showBackgroundJobs && feedMenu ? html4`
            <div class="chat-feed-menu" style=${`left:${feedMenu.x}px;top:${feedMenu.y}px;`} role="menu">
              <button type="button" role="menuitem" onPointerDown=${feedMenuAction(() => { followBottom(); void resyncRunnerRef.current?.(); })}>${t4("chat.feedRefresh")}</button>
              <button type="button" role="menuitem" onPointerDown=${feedMenuAction(() => setAllToolGroupsOpen(true))}>${t4("chat.feedExpandAll")}</button>
              <button type="button" role="menuitem" onPointerDown=${feedMenuAction(() => setAllToolGroupsOpen(false))}>${t4("chat.feedCollapseAll")}</button>
              <button type="button" role="menuitem" onPointerDown=${feedMenuAction(() => { void newConversation(); })}>${t4("chat.new")}</button>
              <button type="button" role="menuitem" onPointerDown=${feedMenuAction(() => { void clearScrollback(); })}>${t4("chat.clear")}</button>
            </div>
          ` : null}

          ${modal ? html4`<div class=${modalResolving ? "modal-resolving" : ""}>${modal.kind === "shell" ? html4`<${ShellModal} modal=${modal} onResolve=${resolveModal} />` : modal.kind === "choice" ? html4`<${ChoiceModal} modal=${modal} onResolve=${resolveModal} />` : modal.kind === "plan" ? html4`<${PlanModal} modal=${modal} onResolve=${resolveModal} />` : modal.kind === "edit-review" ? html4`<${EditReviewModal} modal=${modal} onResolve=${resolveModal} />` : modal.kind === "workspace" ? html4`<${WorkspaceModal} modal=${modal} onResolve=${resolveModal} />` : modal.kind === "checkpoint" ? html4`<${CheckpointModal} modal=${modal} onResolve=${resolveModal} />` : modal.kind === "revision" ? html4`<${RevisionModal} modal=${modal} onResolve=${resolveModal} />` : modal.kind === "picker" ? html4`<${PickerModal} modal=${modal} onResolve=${resolveModal} />` : modal.kind === "viewer" ? html4`<${ViewerModal} modal=${modal} onResolve=${resolveModal} />` : null}</div>` : null}

          ${!showBackgroundJobs && planContinuation ? html4`
            <div class="plan-continuation-bar" role="status">
              <span class="plan-continuation-icon">!</span>
              <span class="plan-continuation-text">
                ${t4("chat.planIncomplete", { done: planContinuation.completedSteps, total: planContinuation.totalSteps })}
                <small>${t4("chat.planAutoResumed", { count: planContinuation.attempts })}</small>
              </span>
              <button type="button" class="primary" onClick=${resumeIncompletePlan} disabled=${busy}>${t4("chat.planResume")}</button>
              <button type="button" class="plan-continuation-dismiss" onClick=${() => setPlanContinuation(null)} title=${t4("chat.planDismiss")}>×</button>
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
            ${pendingImages.length > 0 ? html4`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px">${pendingImages.map(function(image, idx) { const preview = typeof image === "string" ? image : image?.preview; const isVideo = typeof image === "object" && image?.kind === "video"; return html4`<div style="position:relative;width:56px;height:56px;border-radius:4px;overflow:hidden;border:1px solid var(--border-default,#2a2e38);flex-shrink:0" title=${typeof image === "object" ? image.name : t4("chat.thumbImage")}>${preview ? html4`<img src=${preview} style="width:100%;height:100%;object-fit:cover" />` : html4`<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;font-size:11px;color:var(--text-muted)">${isVideo ? t4("chat.thumbVideo") : t4("chat.thumbImage")}</span>`}<button onClick=${function() { void releaseUploadedImages([image]); var next = pendingImages.slice(); next.splice(idx, 1); setPendingImages(next); }} style="position:absolute;top:2px;right:2px;width:18px;height:18px;background:rgba(248,113,113,0.95);color:#fff;border:none;border-radius:50%;font-size:10px;line-height:18px;cursor:pointer;padding:0;box-shadow:0 1px 3px rgba(0,0,0,0.3);opacity:1;display:flex;align-items:center;justify-content:center;" title=${t4("chat.deleteAttachment")}>✕</button></div>`; })}</div>` : null}
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
                        ${!isSending && !isFailed ? html4`<button
                          type="button"
                          class="chat-queue-guide"
                          disabled=${!operation?.id || steeringQueueId === item.id || imageCount > 0}
                          title=${imageCount > 0 ? t4("chat.queueGuideNoMedia") : operation?.id ? t4("chat.queueGuideTitle") : t4("chat.queueGuideNoTask")}
                          onClick=${() => void steerQueuedPrompt(item)}
                        >${steeringQueueId === item.id ? t4("chat.queueGuiding") : t4("chat.queueGuide")}</button>` : null}
                        ${!isSending ? html4`<button type="button" title=${t4("chat.queueEditTitle")} onClick=${() => void editQueuedPrompt(item)}>${t4("chat.queueEdit")}</button>` : null}
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
            ${promptOptimization.status === "requesting" ? html4`
              <div class="prompt-optimization-status" role="status" aria-live="polite">
                <span class="composer-optimize-spin"></span>
                <span>${t4("chat.optimizeRequesting")}</span>
                <button type="button" onClick=${() => cancelPromptOptimizationRequest("cancelled")}>${t4("chat.optimizeCancel")}</button>
              </div>
            ` : null}
            ${promptOptimization.status === "cleanup" ? html4`
              <div class="prompt-optimization-status prompt-optimization-cleanup" role="status" aria-live="polite">
                <span class="composer-optimize-spin"></span>
                <span>${t4("chat.optimizeCleanupPending")}</span>
              </div>
            ` : null}
            ${promptOptimization.status === "cleanup_failed" ? html4`
              <div class="prompt-optimization-status prompt-optimization-cleanup" role="status" aria-live="polite">
                <span>${t4("chat.optimizeCleanupFailed")}</span>
                <button type="button" onClick=${retryPromptOptimizationCleanup}>${t4("chat.optimizeCleanupRetry")}</button>
              </div>
            ` : null}
            ${promptOptimization.status === "preview" && promptOptimization.preview ? html4`
              <div class="prompt-optimization-preview" role="region" aria-label=${t4("chat.optimizePreviewTitle")}>
                <div class="prompt-optimization-head">
                  <strong>${t4("chat.optimizePreviewTitle")}</strong>
                  ${promptOptimization.preview.unchanged ? html4`<span class="muted">${t4("chat.optimizeUnchanged")}</span>` : null}
                </div>
                <div class="prompt-optimization-columns">
                  <section>
                    <span>${t4("chat.optimizeOriginal")}</span>
                    <pre>${promptOptimization.preview.original}</pre>
                  </section>
                  <section>
                    <span>${t4("chat.optimizeOptimized")}</span>
                    <pre>${promptOptimization.preview.optimized}</pre>
                  </section>
                </div>
                <div class="prompt-optimization-actions">
                  <button type="button" class="primary" onClick=${applyPromptOptimization}>${t4("chat.optimizeApply")}</button>
                  <button type="button" onClick=${keepOriginalPrompt}>${t4("chat.optimizeKeepOriginal")}</button>
                </div>
              </div>
            ` : null}
            ${promptOptimizationRestore ? html4`
              <div class="prompt-optimization-restore" role="status">
                <span>${t4("chat.optimizeApplied")}</span>
                <button type="button" onClick=${restoreOriginalPrompt}>${t4("chat.optimizeRestoreOriginal")}</button>
              </div>
            ` : null}
            <div class="composer-box">
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
            <div class="composer-bar">
              <button type="button" class="composer-chip-ghost" aria-expanded=${showModelPicker} title=${t4("chat.modelAndEffortTitle")} onClick=${() => { cancelModelGroupClose(); setShowModelPicker(!showModelPicker); setOpenModelGroupId(null); setShowSkillPicker(false); setShowWsPicker(false); setShowPlusMenu(false); setShowIndexPicker(false); setShowRetrievalSources(false); }}><${IconModel} /> ${t4("chat.chipModel")}</button>
              <button type="button" class="composer-chip-ghost" aria-expanded=${showWsPicker} title=${t4("chat.switchWorkspaceTitle")} onClick=${() => { const next = !showWsPicker; setShowWsPicker(next); setShowSkillPicker(false); setShowModelPicker(false); setShowPlusMenu(false); setShowIndexPicker(false); setShowRetrievalSources(false); if (next) void loadWorkspaceOptions(); }}><${IconWorkspace} /> ${t4("chat.chipWorkspace")}</button>
              <button
                type="button"
                class=${`composer-chip-ghost ${backgroundHasActivity ? "has-activity" : ""}`}
                title=${t4("chat.bgChipTitle", { total: backgroundJobs.length, running: backgroundJobs.filter(backgroundJobIsActive).length, attention: backgroundJobs.filter(backgroundJobNeedsAttention).length })}
                aria-expanded=${showBackgroundJobs}
                onClick=${() => { setShowPlusMenu(false); setShowIndexPicker(false); showBackgroundJobs ? closeBackgroundWorkbench() : void openBackgroundWorkbench(); }}
              ><${IconJobs} /> ${t4("chat.chipJobs")}${backgroundHasActivity ? html4`<span class="n">${backgroundJobs.filter((job) => backgroundJobIsActive(job) || backgroundJobNeedsAttention(job)).length}</span>` : null}</button>
              <span style="position:relative;display:inline-flex">
                <button type="button" class="composer-chip-ghost" aria-expanded=${showIndexPicker} title=${t4("chat.indexChipTitle")} onClick=${() => { const next = !showIndexPicker; setShowIndexPicker(next); setShowSkillPicker(false); setShowWsPicker(false); setShowModelPicker(false); setShowPlusMenu(false); setShowRetrievalSources(false); }}><${IconSearch} /> ${indexRetrievalMode === "tool" ? t4("chat.indexTool") : indexRetrievalMode === "off" ? t4("chat.indexOffShort") : t4("chat.indexAuto")}</button>
                ${showIndexPicker ? html4`
                  <div class="popover composer-plus-menu" style="position:absolute;bottom:calc(100% + 8px);left:0;width:240px;z-index:10">
                    <div class="popover-h">${t4("chat.indexTitle")}</div>
                    ${[["auto", t4("chat.indexAuto")], ["tool", t4("chat.indexTool")], ["off", t4("chat.indexOff")]].map(([mode, label]) => {
                      const modeDisabled = semanticIndex === false && mode !== "off";
                      return html4`<div class=${`popover-row ${indexRetrievalMode === mode ? "sel" : ""} ${modeDisabled ? "disabled" : ""}`} title=${globalThis.VisionoxIndexModePolicy.hint(mode)} onMouseDown=${(e2) => { e2.preventDefault(); if (modeDisabled || mode === indexRetrievalMode) return; void changeIndexRetrievalMode({ target: { value: mode } }); }}><span class="g">${indexRetrievalMode === mode ? "✓" : ""}</span><span class="name">${label}</span></div>`;
                    })}
                  </div>
                ` : null}
              </span>
              ${showPlusMenu ? html4`
                <div class="popover composer-plus-menu" style="position:absolute;bottom:calc(100% + 8px);right:0;width:280px;z-index:10">
                  <div class="popover-h">${t4("chat.moreActions")}</div>
                  ${canUploadMedia ? html4`<div class="popover-row" onMouseDown=${(e2) => { e2.preventDefault(); setShowPlusMenu(false); fileInputRef.current?.click(); }}><span class="g"><${IconAttach} /></span><span class="name">${canUploadVideos ? t4("chat.addImageOrVideo") : t4("chat.addImage")}</span><span class="meta">Ctrl+U</span></div>` : null}
                  <div class="popover-row" onMouseDown=${(e2) => { e2.preventDefault(); setShowPlusMenu(false); setShowSkillPicker(true); setShowWsPicker(false); setShowModelPicker(false); loadChatSkills().catch(() => {}); }}><span class="g"><${IconSkill} /></span><span class="name">${t4("chat.skillEntry")}</span><span class="meta">${t4("chat.skillPickerMeta")}</span></div>
                </div>
              ` : null}
              ${showSkillPicker && skillList.length > 0 ? html4`
                <div class="popover" style="position:absolute;bottom:100%;left:0;width:320px;max-height:260px;overflow-y:auto;z-index:10">
                  <div class="popover-h">${t4("chat.pickSkill")}</div>
                  ${skillList.map((s2) => html4`
                    <div class="popover-row" onMouseDown=${(e2) => { e2.preventDefault(); appendSkillMention(s2.name); }}>
                      <span class="name">${s2.name}</span>
                      <span class="meta">${(s2.description || '').slice(0,40)}</span>
                    </div>
                  `)}
                </div>
              ` : null}
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
              ${showModelPicker ? html4`
                <div class="popover model-popover" style="position:absolute;bottom:100%;left:0;z-index:10" onMouseLeave=${scheduleModelGroupClose}>
                  <div class="popover-h">${t4("chat.pickModel")}</div>
                  <div class="model-picker-browser">
                    <div class="model-cascade-menu" role="menu" aria-label=${t4("chat.modelProvidersAria")}>
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
                              <div class="model-cascade-submenu" role="menu" aria-label=${t4("chat.groupModelsAria", { group: group.label })} onMouseEnter=${cancelModelGroupClose} onMouseLeave=${scheduleModelGroupClose}>
                                ${models.length > 0 ? models.map(({ provider, model }) => {
                                  const selected = provider.id === activeProviderId && model.id === overviewModel;
                                  const status = model.testStatus || "untested";
                                  const details = providerModelCapabilityLabels(model).join(" · ");
                                  const statusText = status === "passed" ? t4("chat.statusVerified") : status === "failed" ? model.testError || t4("chat.statusUnavailable") : t4("chat.statusUntested");
                                  return html4`
                                    <button type="button" class=${`model-cascade-model ${selected ? "active" : ""} ${status}`} role="menuitemradio" aria-checked=${selected} disabled=${busy || status === "failed"} title=${`${details}${details ? " · " : ""}${statusText}`} onClick=${() => selectProviderModel(provider.id, model.id)}>
                                      <span>${model.name ?? providerDisplayLabel(provider)}</span><span class="model-row-indicators"><span class=${`model-row-status ${status}`}>${status === "passed" ? t4("chat.statusUsable") : status === "failed" ? t4("chat.statusUnavailable") : t4("chat.statusUntested")}</span><span class="model-current-check" aria-hidden="true">${selected ? "✓" : ""}</span></span>
                                    </button>
                                  `;
                                }) : html4`<div class="model-picker-empty">${t4("chat.providerNoModels")}</div>`}
                              </div>
                            ` : null}
                          </div>
                        `;
                      })}
                      ${providerDisplayGroups(providers ?? []).length === 0 ? html4`<div class="model-picker-empty">${t4("chat.noModelsYet")}</div>` : null}
                    </div>
                    <div class="model-menu-actions">
                      <input type="file" id="provider-import-file" accept=".json,application/json" style="display:none" onChange=${loadProviderImportFile} />
                      <button type="button" class="model-import-link" disabled=${busy || providerImporting || providerTesting || providerCleaning} onClick=${() => { const input = document.getElementById("provider-import-file"); input.value = ""; input.click(); }}>${providerImporting ? t4("chat.importingShort") : t4("chat.importConfigBtn")}</button>
                      <button type="button" class="model-test-link" disabled=${busy || providerImporting || providerTesting || providerCleaning || providerModelTestSummary(providers ?? []).total === 0} onClick=${testAllProviders}>${providerTesting ? t4("chat.testingShort") : t4("chat.testAllBtn")}</button>
                      ${providerModelTestSummary(providers ?? []).failed > 0 && modelVerification?.dirty !== true ? html4`<button type="button" class="model-cleanup-link" disabled=${busy || providerImporting || providerTesting || providerCleaning} onClick=${cleanupFailedModels}>${providerCleaning ? t4("chat.cleaningShort") : t4("chat.cleanFailedBtn", { count: providerModelTestSummary(providers ?? []).failed })}</button>` : null}
                    </div>
                    <div role="status" aria-live="polite" style="min-height:18px;margin-top:5px;font-size:11px;line-height:18px;overflow-wrap:anywhere;color:${modelNotice?.kind === 'error' ? 'var(--c-err)' : modelNotice?.kind === 'success' ? 'var(--c-ok)' : 'var(--fg-3)'};">${modelNotice?.text ?? ""}</div>
                    ${(() => {
                      if (modelVerification?.dirty) {
                        return html4`<div style="font-size:11px;margin-top:6px;color:var(--c-warn);">${t4("chat.configDirtyRetest")}</div>`;
                      }
                      const allModels = (providers ?? []).flatMap((provider) => (provider.models ?? []).filter((model) => model.disabled !== true).map((model) => ({ provider, model })));
                      const testedModels = allModels.filter(({ model }) => model.testStatus !== "untested");
                      if (testedModels.length === 0) return null;
                      const passed = allModels.filter(({ model }) => model.testStatus === "passed").length;
                      const failedModels = allModels.filter(({ model }) => model.testStatus === "failed");
                      return html4`
                        <div title=${failedModels.map(({ provider, model }) => `${provider.name ?? provider.id} / ${model.name ?? model.id}: ${model.testError ?? t4("chat.testFailedFallback")}`).join("\n")} style="display:flex;align-items:center;gap:5px;font-size:11px;margin-top:5px;color:var(--fg-3)">
                          <span>${t4("chat.testedSummary", { passed, total: allModels.length })}</span>
                        </div>
                      `;
                    })()}
                  </div>
                  <div style="padding:8px;border-bottom:1px solid var(--border-default);">
                    <label style="display:block;font-size:11px;color:var(--text-secondary);margin-bottom:4px;">${t4("chat.modeLabel")}</label>
                    ${(providerCaps?.presets?.length ?? 0) > 1 ? html4`
                      <div class="model-choice-row">
                        ${providerCaps.presets.map((p3) => html4`<button type="button" key=${p3} class=${`model-choice ${preset === p3 ? "active" : ""}`} onClick=${() => { setSetting('preset', p3); }}>${p3}</button>`)}
                      </div>
                    ` : html4`<div style="font-size:12px;color:var(--text-primary);">${preset}${t4("chat.fixedSuffix")}</div>`}
                  </div>
                  ${activeModelEfforts.length > 0 ? html4`
                    <div style="padding:8px;border-bottom:1px solid var(--border-default);">
                      <label style="display:block;font-size:11px;color:var(--text-secondary);margin-bottom:4px;">${t4("chat.effortLabel")}</label>
                      ${activeModelEfforts.length > 1 ? html4`
                        <div class="model-choice-row">
                          ${activeModelEfforts.map((e3) => html4`<button type="button" key=${e3} title=${e3} disabled=${busy} class=${`model-choice ${effort === e3 ? "active" : ""}`} onClick=${() => { setSetting('reasoningEffort', e3); }}>${reasoningEffortLabel(e3)}</button>`)}
                        </div>
                      ` : html4`<div style="font-size:12px;color:var(--text-primary);">${reasoningEffortLabel(activeModelEfforts[0])}${t4("chat.fixedSuffix")}</div>`}
                    </div>
                  ` : null}
                  <div style="padding:8px;border-bottom:1px solid var(--border-default);">
                    <label style="display:block;font-size:11px;color:var(--text-secondary);margin-bottom:4px;" title=${t4("chat.reasoningDisplayTitle")}>${t4("chat.reasoningDisplayLabel")}</label>
                    <div class="model-choice-row">
                      ${[["live", t4("chat.reasoningLive")], ["status", t4("chat.reasoningStatusOnly")], ["hidden", t4("chat.reasoningHidden")]].map(([mode, label]) => html4`<button type="button" key=${mode} class=${`model-choice ${reasoningDisplay === mode || mode === "live" && reasoningDisplay === "expanded" ? "active" : ""}`} onClick=${() => changeReasoningDisplay(mode)}>${label}</button>`)}
                    </div>
                  </div>
                  <div style="padding:8px;border-bottom:1px solid var(--border-default);">
                    <label style="display:block;font-size:11px;color:var(--text-secondary);margin-bottom:4px;" title=${t4("chat.processDisplayTitle")}>${t4("chat.processDisplayLabel")}</label>
                    <div class="model-choice-row">
                      ${[["compact", t4("chat.processCompact")], ["standard", t4("chat.processStandard")], ["detailed", t4("chat.processDetailed")]].map(([mode, label]) => html4`<button type="button" key=${mode} class=${`model-choice ${processDisplay === mode ? "active" : ""}`} onClick=${() => changeProcessDisplay(mode)}>${label}</button>`)}
                    </div>
                  </div>
                </div>
              ` : null}
              <div class="composer-bar-status">
              ${indexRetrievalMode === "auto" && semanticRetrievalStatus === "running" ? html4`<span class="composer-retrieval-status muted">${t4("chat.retrievalRunning")}</span>` : null}
              ${indexRetrievalMode === "auto" && semanticRetrievalStatus === "empty" ? html4`<span class="composer-retrieval-status muted">${t4("chat.retrievalEmpty")}</span>` : null}
              ${indexRetrievalMode === "auto" && semanticRetrievalStatus === "timeout" ? html4`<span class="composer-retrieval-status" style="color:var(--c-warn)">${t4("chat.retrievalTimeout")}</span>` : null}
              ${indexRetrievalMode === "auto" && semanticRetrievalStatus === "unavailable" ? html4`<span class="composer-retrieval-status" style="color:var(--c-warn)">${t4("chat.retrievalUnavailable")}</span>` : null}
              ${indexRetrievalMode === "auto" && semanticRetrievalStatus === "error" ? html4`<span class="composer-retrieval-status" style="color:var(--c-err)">${t4("chat.retrievalError")}</span>` : null}
              ${semanticRetrievalSources.length > 0 ? html4`
                <button class="btn btn-sm" style="font-size:11px;padding:2px 7px" onClick=${() => setShowRetrievalSources(!showRetrievalSources)}>${t4("chat.refsCount", { count: semanticRetrievalSources.length })}</button>
                ${showRetrievalSources ? html4`
                  <div class="popover" style="position:absolute;bottom:100%;right:0;width:420px;max-height:260px;overflow-y:auto;z-index:10">
                    <div class="popover-h">${t4("chat.retrievalSourcesTitle")}</div>
                    ${semanticRetrievalSources.map((source) => html4`
                      <button class="popover-row" style="width:100%;text-align:left" onMouseDown=${(event) => { event.preventDefault(); void previewRetrievedSource(source); }}>
                        <span class="name" style="overflow-wrap:anywhere">${source.path}</span>
                        <span class="meta">L${source.startLine}-${source.endLine} · ${Number(source.score || 0).toFixed(3)}</span>
                      </button>
                    `)}
                  </div>
                ` : null}
              ` : null}
              </div>
              ${(showPlusMenu || showIndexPicker || showSkillPicker || showWsPicker || showModelPicker || showRetrievalSources) ? html4`<div style="position:fixed;inset:0;z-index:5" onClick=${() => { setShowPlusMenu(false); setShowIndexPicker(false); setShowSkillPicker(false); setShowWsPicker(false); setShowModelPicker(false); setShowRetrievalSources(false); }}></div>` : null}
              <div style="flex:1"></div>
              <button type="button" class="composer-plus" aria-expanded=${showPlusMenu} title=${t4("chat.moreActions")} aria-label=${t4("chat.moreActions")} onClick=${() => { const next = !showPlusMenu; setShowPlusMenu(next); setShowSkillPicker(false); setShowWsPicker(false); setShowModelPicker(false); setShowIndexPicker(false); setShowRetrievalSources(false); }}><svg viewBox="0 0 16 16" width="19" height="19" aria-hidden="true"><path d="M8 2.5v11M2.5 8h11" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg></button>
              <button
                type="button"
                class="composer-optimize"
                disabled=${promptOptimizationButtonDisabled({
                  busy,
                  inFlight: Boolean(promptOptimizationInFlightRef.current),
                  draft: inputValueRef.current,
                  slashCommands,
                  classificationKind: promptDraftKind,
                })}
                onClick=${optimizeCurrentPrompt}
                title=${t4("chat.optimizeInputTitle")}
                aria-label=${t4("chat.optimizeInputAria")}
              ><${IconWand} size=${15} />${promptOptimizing ? html4`<span class="composer-optimize-spin"></span>` : null}</button>
              ${(() => {
                const canSendContent = inputHasContent || pendingImages.length > 0;
                const sendMode = busy ? canSendContent ? "queue" : "stop" : canSendContent ? "send" : "idle";
                const sendLabel = sendMode === "send" ? t4("chat.sendSend") : sendMode === "queue" ? t4("chat.sendQueue") : sendMode === "stop" ? t4("chat.sendStop") : t4("chat.sendIdle");
                return html4`
                  <button
                    type="button"
                    class=${`composer-send composer-send-${sendMode}`}
                    disabled=${sendMode === "idle" || (sendMode !== "stop" && promptOptimizationCleanupPending)}
                    title=${sendLabel}
                    aria-label=${sendLabel}
                    onClick=${() => { if (sendMode === "stop") void abort(); else void send(); }}
                  >${sendMode === "stop" ? html4`<span class="composer-send-square"></span>` : html4`<svg class="composer-send-arrow" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M8 13V3M8 3L3.5 7.5M8 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`}</button>
                `;
              })()}
            </div>
            </div>
            </div>
              </div>
            </div>
          </div>

          ${busy ? html4`<${InFlightRow}
                  streaming=${streaming}
                  activeTools=${activeTools}
                  completedSteps=${completedSteps}
                  startedAt=${turnStartedAt}
                  statusLine=${statusLine}
                  onAbort=${abort}
                  stopping=${operation?.state === "stopping"}
                  tick=${nowTick}
                />` : null}
          <${ChatStatusBar} stats=${stats} model=${overviewModel} onNew=${newConversation} busy=${busy} />
        </div>
          ${!showBackgroundJobs && (activePlan || fileArtifacts.length && !fileArtifactsDismissed) ? html4`<${SideRail} activePlan=${activePlan} fileArtifacts=${fileArtifactsDismissed ? [] : fileArtifacts} artifactsSelected=${Boolean(fileArtifactsSelectedMessageId)} onFollowLatestArtifacts=${followLatestArtifacts} onDismissArtifacts=${dismissArtifacts} />` : null}
      </div>
    </div>
  `;
}
var ChatFeed = N2(function ChatFeed2({ messages, totalMessages = messages.length, canonicalMessageCount = messages.length, streaming, streamingSegments = [], taskActive = false, reasoningExpanded = false, reasoningDisplay = "live", processDisplay = "standard", innerRef, visibleCount = CHAT_INITIAL_RENDER_COUNT, onLoadEarlier, loadingEarlier = false, searchMatchIndex = -1, highlightMessageId = null, onCopyMessage, onFillInput, selectedArtifactMessageId = null, onSelectArtifactMessage, userAvatar = null }) {
  useLang();
  const transientSegments = streamingSegments.length > 0
    ? streamingSegments
    : streaming ? [{ ...streaming, messageId: streaming.id, segmentId: `${streaming.id}:segment:live` }] : [];
  const timeline = projectChatTimeline(messages, [], transientSegments);
  const allMessages = timeline.frames.map((frame) => ({
    ...frame.message,
    __timelineSegmentId: frame.segmentId,
    __timelineStreaming: frame.streaming,
    __timelineEventSeq: frame.eventSeq,
  }));
  const hiddenCount = Math.max(0, allMessages.length - visibleCount);
  const remoteHiddenCount = Math.max(0, totalMessages - canonicalMessageCount);
  const renderedMessages = hiddenCount > 0 ? allMessages.slice(hiddenCount) : allMessages;
  const projectedTotal = totalMessages + Math.max(0, messages.length - canonicalMessageCount);
  const displayTotal = Math.max(projectedTotal, allMessages.length);
  // Prefer stable turn/step identities; legacy messages retain contiguous
  // grouping only when no identity is available.
  const renderUnits = groupToolMessages(renderedMessages).map((unit) => ({
    ...unit,
    items: unit.items?.map((item) => ({ ...item, index: item.index + hiddenCount })),
  }));
  const renderChatMessage = (m3, globalIndex) => html4`
                <${ChatMessage}
                  key=${m3.__timelineSegmentId || m3.id}
                  msg=${m3}
                  index=${globalIndex}
                  searchMatch=${globalIndex === searchMatchIndex || Boolean(highlightMessageId && m3.id === highlightMessageId)}
                  streaming=${m3.__timelineStreaming === true}
                  onCopy=${onCopyMessage}
                  onFillInput=${onFillInput}
                  reasoningExpanded=${reasoningExpanded}
                  reasoningDisplay=${reasoningDisplay}
                  userAvatar=${userAvatar}
                  selectedForArtifacts=${Boolean(selectedArtifactMessageId && String(m3.id || "") === String(selectedArtifactMessageId))}
                  onSelectForArtifacts=${onSelectArtifactMessage}
                />
              `;
  return html4`
    <div class="chat-feed" ref=${innerRef}>
      ${allMessages.length === 0 ? html4`<div class="chat-empty">${t4("chat.noConversation")}</div>` : null}
      ${hiddenCount > 0 || remoteHiddenCount > 0 ? html4`
        <div class="chat-history-loader">
          <span>${t4("chat.shownOfTotal", { shown: renderedMessages.length, total: displayTotal })}</span>
          <button type="button" onClick=${onLoadEarlier} disabled=${loadingEarlier}>${loadingEarlier ? t4("chat.loadingDots") : t4("chat.loadEarlierMessages", { count: Math.min(hiddenCount || remoteHiddenCount, hiddenCount ? CHAT_RENDER_STEP : CHAT_MESSAGE_PAGE_SIZE) })}</button>
        </div>
      ` : null}
      ${renderUnits.map(
    (unit, unitIndex) => {
      if (unit.kind !== "toolGroup") {
        return renderChatMessage(unit.msg, unit.index);
      }
      const hitIds = unit.items.filter((item) => item.index === searchMatchIndex || Boolean(highlightMessageId && item.msg.id === highlightMessageId)).map((item) => String(item.msg.id));
      // 只有最终回执/终态事实才允许工具组收敛；普通正文可能只是
      // “我继续处理”之类的中间说明，不能据此隐藏失败或仍在运行的步骤。
      const followedByAnswer = renderUnits.slice(unitIndex + 1).some((u) => u.kind === "msg"
        && u.msg.role === "assistant"
        && assistantHasAuthoritativeFinalEvidence(u.msg));
      return html4`<${ToolGroup}
                    key=${unit.id}
                    items=${unit.items.map((item) => item.msg)}
                    taskActive=${taskActive}
                    searchHitIds=${hitIds.length > 0 ? hitIds : null}
                    followedByAnswer=${followedByAnswer}
                    processDisplay=${processDisplay}
                    groupId=${unit.id}
                  />`;
    }
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
  completedSteps = 0,
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
      ${completedSteps > 0 ? html4`
            <span class="chat-inflight-sep">·</span>
            <span class="muted">${t4("chat.inflightSteps", { count: completedSteps.toLocaleString() })}</span>
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
var ChatStatusBar = N2(function ChatStatusBar2({ stats, model, onNew, busy }) {
  useLang();
  if (!stats) {
    return html4`
      <div class="chat-statusbar">
        <span class="muted">${t4("chat.waitingStats")}</span>
        ${onNew && !busy ? html4`<button type="button" class="status-new-btn" title=${t4("chat.newChatTitle")} onClick=${() => { void onNew(); }}>${t4("chat.newChatBtn")}</button>` : null}
      </div>
    `;
  }
  const currentContextTokens = stats.estimatedContextTokens ?? stats.lastPromptTokens;
  const ctxPct = stats.contextCapTokens > 0 ? currentContextTokens / stats.contextCapTokens * 100 : 0;
  const contextMarks = [
    { tokens: stats.contextFoldTokens, label: t4("chat.foldNormal") },
    { tokens: stats.contextAggressiveTokens, label: t4("chat.foldAggressive") },
    { tokens: stats.contextForceSummaryTokens, label: t4("chat.foldForceSummary") },
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
      ${onNew && !busy ? html4`<button type="button" class="status-new-btn" title=${t4("chat.newChatTitle")} onClick=${() => { void onNew(); }}>${t4("chat.newChatBtn")}</button>` : null}
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
