import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { atomicWriteFileSync } from "./atomic-file.mjs";

const SCHEMA_VERSION = 1;
const DEFAULT_INPUT_THRESHOLD_CHARS = 24_000;
const DEFAULT_PENDING_LIMIT_CHARS = 64_000;
const DEFAULT_COMPLETE_OUTPUT_RATIO = 0.3;
const DEFAULT_READ_CHARS = 24_000;

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function freshState(turnId, turn = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    turnId,
    requiresArtifact: turn.requiresArtifact === true,
    requiresCompleteCoverage: turn.requiresCompleteCoverage === true,
    inputs: [],
    blockedReadCount: 0,
    cacheFailures: [],
    finalWithPending: false,
    completionClaimWithPending: false,
    interventionChoice: null,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeState(value, turnId, turn) {
  if (!value || value.schemaVersion !== SCHEMA_VERSION || value.turnId !== turnId || !Array.isArray(value.inputs)) {
    return freshState(turnId, turn);
  }
  return {
    ...freshState(turnId, turn),
    ...value,
    requiresArtifact: turn.requiresArtifact === true || value.requiresArtifact === true,
    requiresCompleteCoverage: turn.requiresCompleteCoverage === true || value.requiresCompleteCoverage === true,
    inputs: value.inputs.filter((entry) => entry && typeof entry.contextId === "string" && typeof entry.hash === "string"),
    cacheFailures: Array.isArray(value.cacheFailures) ? value.cacheFailures.map(String).slice(-8) : [],
  };
}

function pendingInputs(state) {
  return state.inputs.filter((entry) => entry.state !== "foldable");
}

function completionClaim(text) {
  const value = String(text ?? "").trim();
  if (!value || /(?:未完成|尚未完成|不完整|incomplete|not\s+(?:complete|finished|done))/i.test(value)) return false;
  return /(?:已完成|全部完成|处理完成|已保存|生成成功|\bcomplete(?:d)?\b|\bfinished\b|\bdone\b)/i.test(value);
}

function writtenChars(args) {
  if (!args || typeof args !== "object") return 0;
  let total = 0;
  for (const key of ["content", "replace", "text", "markdown"]) {
    if (typeof args[key] === "string") total += args[key].length;
  }
  if (Array.isArray(args.edits)) {
    for (const edit of args.edits) {
      if (typeof edit?.replace === "string") total += edit.replace.length;
    }
  }
  return total;
}

function interventionOptions() {
  return [
    { id: "continue", title: "继续处理（推荐）", summary: "按缓存顺序逐项写入或消化，再继续读取新内容。" },
    { id: "revise", title: "调整任务要求", summary: "先补充范围、格式或优先级，再继续执行。" },
    { id: "accept-partial", title: "接受当前部分结果", summary: "保留现有结果，并明确标记尚未覆盖的内容。" },
    { id: "stop", title: "停止任务", summary: "停止本轮处理，缓存仍保留用于后续恢复。" },
  ];
}

export function decideContextInputIntervention(status) {
  if (!status?.requiresIntervention) return null;
  const cacheFailed = Number(status.cacheFailureCount) > 0;
  const question = cacheFailed
    ? "部分输入无法安全保存到恢复缓存；本次任务要如何继续？"
    : "仍有输入内容尚未处理完成；本次任务要如何继续？";
  const options = interventionOptions();
  return {
    kind: "choice",
    question,
    options,
    allowCustom: true,
    payload: { question, options, allowCustom: true },
  };
}

export function buildContextInputFlushPrompt(status) {
  const references = Array.isArray(status?.pendingInputs) ? status.pendingInputs : [];
  const list = references.length > 0
    ? references.map((entry) => `- ${entry.contextId}: ${entry.chars} chars (${entry.source})`).join("\n")
    : "- 缓存写入失败；先说明缺失范围，并改用更小的读取批次。";
  return `[CONTEXT_INPUT_FLUSH_REQUIRED]\n当前任务仍有未处理输入。一次只处理一个待处理输入：使用 read_context_input 按段恢复，立即通过 write_file、append_file 或 edit_file 把该段持久化或整合到交付物，再读取下一段。不要声称任务已完整完成。\n\n${list}`;
}

export function createContextInputTransactionStore(root, options = {}) {
  const storeRoot = resolve(root);
  const blobRoot = resolve(storeRoot, "blobs");
  const transactionRoot = resolve(storeRoot, "transactions");
  const inputThresholdChars = Math.max(1, Number(options.inputThresholdChars) || DEFAULT_INPUT_THRESHOLD_CHARS);
  const pendingLimitChars = Math.max(inputThresholdChars, Number(options.pendingLimitChars) || DEFAULT_PENDING_LIMIT_CHARS);
  const completeOutputRatio = Math.min(1, Math.max(0.01, Number(options.completeOutputRatio) || DEFAULT_COMPLETE_OUTPUT_RATIO));
  const atomicWrite = options.atomicWrite ?? atomicWriteFileSync;
  let state = null;
  let statePath = null;

  function persist() {
    if (!state || !statePath) return;
    state.updatedAt = new Date().toISOString();
    atomicWrite(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }

  function beginTurn(turn = {}) {
    const turnId = String(turn.turnId ?? "").trim();
    if (!turnId) throw new Error("context input transaction requires turnId");
    statePath = resolve(transactionRoot, `${sha256(turnId)}.json`);
    let saved = null;
    if (existsSync(statePath)) {
      try {
        saved = JSON.parse(readFileSync(statePath, "utf8"));
      } catch {
        saved = null;
      }
    }
    state = normalizeState(saved, turnId, turn);
    return status();
  }

  function captureInput({ source = "unknown", content, metadata = null } = {}) {
    if (!state) throw new Error("beginTurn must be called before captureInput");
    const value = typeof content === "string" ? content : JSON.stringify(content ?? "");
    if (value.length < inputThresholdChars) return { ok: true, cached: false, chars: value.length };
    const hash = sha256(value);
    const contextId = `context:${hash}`;
    const existing = state.inputs.find((entry) => entry.contextId === contextId);
    if (existing) return { ok: true, cached: true, contextId, chars: existing.chars, deduplicated: true };

    const blobPath = resolve(blobRoot, `${hash}.txt`);
    try {
      if (!existsSync(blobPath)) atomicWrite(blobPath, value, "utf8");
      state.inputs.push({
        contextId,
        hash,
        source: String(source).slice(0, 160),
        metadata: metadata && typeof metadata === "object" ? metadata : null,
        chars: value.length,
        materializedChars: 0,
        state: "pending",
        capturedAt: new Date().toISOString(),
      });
      state.finalWithPending = false;
      state.completionClaimWithPending = false;
      persist();
      return { ok: true, cached: true, contextId, chars: value.length };
    } catch (error) {
      state.cacheFailures.push(String(error?.message || error).slice(0, 500));
      return { ok: false, cached: false, error: String(error?.message || error), chars: value.length };
    }
  }

  function readInput(contextId, readOptions = {}) {
    if (!state) throw new Error("beginTurn must be called before readInput");
    const entry = state.inputs.find((item) => item.contextId === String(contextId));
    if (!entry) return { ok: false, error: "unknown context input", contextId: String(contextId) };
    try {
      const full = readFileSync(resolve(blobRoot, `${entry.hash}.txt`), "utf8");
      const offset = Math.max(0, Math.min(full.length, Number(readOptions.offset) || 0));
      const requested = readOptions.maxChars == null ? full.length : Number(readOptions.maxChars);
      const maxChars = Math.max(1, Math.min(100_000, Number.isFinite(requested) ? requested : DEFAULT_READ_CHARS));
      const content = full.slice(offset, offset + maxChars);
      const nextOffset = offset + content.length;
      return {
        ok: true,
        contextId: entry.contextId,
        source: entry.source,
        metadata: entry.metadata,
        content,
        offset,
        nextOffset,
        totalChars: full.length,
        complete: nextOffset >= full.length,
      };
    } catch (error) {
      state.cacheFailures.push(String(error?.message || error).slice(0, 500));
      try { persist(); } catch {}
      return { ok: false, contextId: entry.contextId, error: String(error?.message || error) };
    }
  }

  function beforeToolCall(tool = {}) {
    if (!state || tool.contextControl === true || tool.readOnly !== true) return { blocked: false };
    const current = status();
    if (current.cacheFailureCount === 0 && current.backpressureChars <= pendingLimitChars) return { blocked: false };
    state.blockedReadCount += 1;
    try { persist(); } catch {}
    return {
      blocked: true,
      result: `${buildContextInputFlushPrompt(status())}\n\n[CONTEXT_INPUT_PENDING] 新的只读工具调用 ${String(tool.name || "unknown")} 已暂停。先处理缓存输入或解决缓存失败；控制工具和写入工具仍可使用。`,
    };
  }

  function beforeCompaction(compaction = {}) {
    const current = status();
    if (current.pendingCount === 0) return { blocked: false };
    if (compaction.emergency === true) return { blocked: false, retainReferences: true, memo: memo() };
    return { blocked: true, reason: "pending-context-input", memo: memo() };
  }

  function noteToolResult(tool = {}) {
    if (!state || tool.contextMaterializer !== true || tool.succeeded !== true) return status();
    const pending = pendingInputs(state);
    if (pending.length === 0) return status();
    const credit = writtenChars(tool.args);
    if (credit <= 0) return status();

    if (!state.requiresCompleteCoverage) {
      for (const entry of pending) {
        entry.materializedChars = Math.max(entry.materializedChars || 0, credit);
        entry.state = "foldable";
      }
    } else {
      let remaining = credit;
      for (const entry of pending) {
        if (remaining <= 0) break;
        const required = Math.max(1, Math.ceil(entry.chars * completeOutputRatio));
        const outstanding = Math.max(0, required - (entry.materializedChars || 0));
        const applied = Math.min(outstanding, remaining);
        entry.materializedChars = (entry.materializedChars || 0) + applied;
        remaining -= applied;
        entry.state = entry.materializedChars >= required ? "foldable" : "materialized";
      }
    }
    state.finalWithPending = false;
    state.completionClaimWithPending = false;
    try {
      persist();
    } catch (error) {
      state.cacheFailures.push(String(error?.message || error).slice(0, 500));
    }
    return status();
  }

  function noteAssistantFinal(text) {
    if (!state) return null;
    const pending = pendingInputs(state);
    if (pending.length === 0) return status();
    if (!state.requiresArtifact) {
      for (const entry of pending) entry.state = "foldable";
    } else {
      state.finalWithPending = true;
      state.completionClaimWithPending = completionClaim(text);
    }
    try {
      persist();
    } catch (error) {
      state.cacheFailures.push(String(error?.message || error).slice(0, 500));
    }
    return status();
  }

  function resolveIntervention(choice) {
    if (!state) return null;
    const selected = String(choice ?? "").trim();
    state.interventionChoice = selected || null;
    state.finalWithPending = false;
    state.completionClaimWithPending = false;
    if (selected === "continue") state.blockedReadCount = 0;
    if (selected === "accept-partial") {
      for (const entry of pendingInputs(state)) entry.state = "foldable";
    }
    try {
      persist();
    } catch (error) {
      state.cacheFailures.push(String(error?.message || error).slice(0, 500));
    }
    return status();
  }

  function status() {
    if (!state) {
      return {
        turnId: null,
        pendingCount: 0,
        pendingChars: 0,
        pendingInputs: [],
        blockedReadCount: 0,
        cacheFailureCount: 0,
        completionClaimWithPending: false,
        requiresIntervention: false,
      };
    }
    const pending = pendingInputs(state);
    const pendingView = pending.map((entry) => ({
      contextId: entry.contextId,
      source: entry.source,
      chars: entry.chars,
      materializedChars: entry.materializedChars || 0,
      state: entry.state,
    }));
    const requiresIntervention = state.cacheFailures.length > 0
      || state.blockedReadCount >= 2
      || (state.requiresArtifact && state.finalWithPending && pending.length > 0);
    return {
      turnId: state.turnId,
      requiresArtifact: state.requiresArtifact,
      requiresCompleteCoverage: state.requiresCompleteCoverage,
      pendingCount: pending.length,
      pendingChars: pending.reduce((sum, entry) => sum + entry.chars, 0),
      backpressureChars: pending
        .filter((entry) => entry.source.startsWith("tool:"))
        .reduce((sum, entry) => sum + entry.chars, 0),
      pendingInputs: pendingView,
      blockedReadCount: state.blockedReadCount,
      cacheFailureCount: state.cacheFailures.length,
      cacheFailures: [...state.cacheFailures],
      finalWithPending: state.finalWithPending,
      completionClaimWithPending: state.completionClaimWithPending,
      requiresIntervention,
      interventionChoice: state.interventionChoice,
    };
  }

  function memo() {
    const current = status();
    if (current.pendingCount === 0 && current.cacheFailureCount === 0) return "";
    const refs = current.pendingInputs.map((entry) => `${entry.contextId} (${entry.chars} chars, ${entry.state})`).join(", ");
    return `[Context input transaction]\nLossless source input is cached outside conversation history. Pending: ${refs || "cache write failed"}. Use read_context_input to recover one bounded segment, then materialize it before requesting more read-only input. These references must survive emergency compaction.`;
  }

  return {
    beginTurn,
    captureInput,
    readInput,
    status,
    beforeToolCall,
    beforeCompaction,
    memo,
    noteToolResult,
    noteAssistantFinal,
    resolveIntervention,
  };
}
