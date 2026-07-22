import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { atomicWriteFileSync } from "./atomic-file.mjs";

const SCHEMA_VERSION = 1;
const DEFAULT_INPUT_THRESHOLD_CHARS = 24_000;
const DEFAULT_PENDING_LIMIT_CHARS = 64_000;
const DEFAULT_READ_CHARS = 24_000;
const MIN_PROGRESS_RATIO = 0.01;
const METADATA_ONLY_TOOLS = new Set([
  "get_file_info",
  "list_directory",
  "prepare_local_document",
  "run_skill",
]);

function comparablePath(value) {
  const text = String(value ?? "").trim().replace(/\//g, "\\").replace(/\\+$/g, "");
  return process.platform === "win32" ? text.toLowerCase() : text;
}

function normalizePathList(values) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const normalized = comparablePath(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function pathMatches(value, candidates) {
  const current = comparablePath(value);
  if (!current) return false;
  return normalizePathList(candidates).some((candidate) => (
    current === candidate
    || current.endsWith(`\\${candidate}`)
    || candidate.endsWith(`\\${current}`)
  ));
}

function pathWithin(value, roots) {
  const current = comparablePath(value);
  if (!current) return false;
  return normalizePathList(roots).some((root) => current === root || current.startsWith(`${root}\\`));
}

function toolName(source, metadata) {
  const explicit = String(metadata?.tool ?? "").trim().toLowerCase();
  if (explicit) return explicit;
  const match = String(source ?? "").match(/^tool:([^\s]+)/i);
  return String(match?.[1] ?? "").toLowerCase();
}

function contentMentionsPath(content, paths) {
  const text = comparablePath(content);
  if (!text) return false;
  return normalizePathList(paths).some((path) => text.includes(path));
}

function commandHasRedirect(content) {
  return commandRedirectPaths(content).length > 0;
}

function commandRedirectPaths(content) {
  const firstLine = String(content ?? "").split(/\r?\n/, 1)[0] ?? "";
  if (!/^\$\s/.test(firstLine)) return [];
  const paths = [];
  const redirectPattern = /(?:^|\s)(?:\d*(?:>>|>|&>))\s*(?:"([^"]+)"|'([^']+)'|([^\s]+))/g;
  for (const match of firstLine.matchAll(redirectPattern)) {
    const value = match[1] ?? match[2] ?? match[3] ?? "";
    if (value) paths.push(value);
  }
  return normalizePathList(paths);
}

function inputCoverage({ source, metadata, content, artifactPaths, referenceRoots }) {
  const name = toolName(source, metadata);
  if (METADATA_ONLY_TOOLS.has(name)) return "metadata";
  if (name === "read_file" && (
    pathMatches(metadata?.path, artifactPaths)
    || pathWithin(metadata?.path, referenceRoots)
  )) return "metadata";
  if (name === "run_command" && commandHasRedirect(content)) return "artifact-output";
  return "source";
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

const TOOL_OUTPUT_RESOURCE_MARKER = "[TOOL_OUTPUT_RESOURCE]";

function parseToolOutputResource(content, resourceRoot) {
  const line = String(content ?? "").split(/\r?\n/, 1)[0] ?? "";
  if (!line.startsWith(TOOL_OUTPUT_RESOURCE_MARKER)) return null;
  let descriptor;
  try {
    descriptor = JSON.parse(line.slice(TOOL_OUTPUT_RESOURCE_MARKER.length).trim());
  } catch {
    return null;
  }
  const resourcePath = String(descriptor?.path ?? "").trim();
  const resourceId = String(descriptor?.resourceId ?? "").trim();
  if (!/^tool-output-[A-Za-z0-9-]+\.txt$/.test(resourceId)) return null;
  if (!resourcePath || !pathWithin(resourcePath, [resourceRoot]) || !existsSync(resourcePath)) return null;
  return {
    resourceId,
    path: resolve(resourcePath),
    chars: Math.max(0, Number(descriptor?.chars) || 0),
    bytes: Math.max(0, Number(descriptor?.bytes) || 0),
  };
}

function freshState(transactionId, turnId, turn = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    transactionId,
    turnId,
    requiresArtifact: turn.requiresArtifact === true,
    requiresCompleteCoverage: turn.requiresCompleteCoverage === true,
    artifactPaths: normalizePathList(turn.artifactPaths),
    referenceRoots: normalizePathList(turn.referenceRoots),
    artifactEvidence: [],
    inputs: [],
    blockedReadCount: 0,
    readLease: null,
    materializerCalls: 0,
    cacheFailures: [],
    finalWithPending: false,
    completionClaimWithPending: false,
    interventionChoice: null,
    lastInterventionFingerprint: null,
    recoveryReadAllowance: 0,
    stalledMaterializerCalls: 0,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeState(value, transactionId, turnId, turn) {
  if (!value || value.schemaVersion !== SCHEMA_VERSION || !Array.isArray(value.inputs)) {
    return freshState(transactionId, turnId, turn);
  }
  const savedTransactionId = String(value.transactionId || value.turnId || "");
  if (savedTransactionId !== transactionId) {
    return freshState(transactionId, turnId, turn);
  }
  return {
    ...freshState(transactionId, turnId, turn),
    ...value,
    transactionId,
    turnId,
    requiresArtifact: turn.requiresArtifact === true || value.requiresArtifact === true,
    requiresCompleteCoverage: turn.requiresCompleteCoverage === true || value.requiresCompleteCoverage === true,
    artifactPaths: normalizePathList([...(value.artifactPaths ?? []), ...(turn.artifactPaths ?? [])]),
    referenceRoots: normalizePathList([...(value.referenceRoots ?? []), ...(turn.referenceRoots ?? [])]),
    artifactEvidence: Array.isArray(value.artifactEvidence) ? value.artifactEvidence.slice(-8) : [],
    inputs: value.inputs
      .filter((entry) => entry && typeof entry.contextId === "string" && typeof entry.hash === "string")
      .map((entry) => ({ ...entry, coveredChars: Math.max(0, Number(entry.coveredChars) || 0) })),
    readLease: value.readLease && typeof value.readLease === "object" ? value.readLease : null,
    materializerCalls: Number.isSafeInteger(value.materializerCalls) ? Math.max(0, value.materializerCalls) : 0,
    cacheFailures: Array.isArray(value.cacheFailures) ? value.cacheFailures.map(String).slice(-8) : [],
    lastInterventionFingerprint: typeof value.lastInterventionFingerprint === "string" ? value.lastInterventionFingerprint : null,
    recoveryReadAllowance: Number.isSafeInteger(value.recoveryReadAllowance) ? Math.max(0, value.recoveryReadAllowance) : 0,
    stalledMaterializerCalls: Number.isSafeInteger(value.stalledMaterializerCalls) ? Math.max(0, value.stalledMaterializerCalls) : 0,
  };
}

function pendingInputs(state) {
  return state.inputs.filter((entry) => !["foldable", "invalid", "discarded"].includes(entry.state));
}

function interventionFingerprint(state) {
  const pending = pendingInputs(state).map((entry) => ({
    contextId: entry.contextId,
    state: entry.state,
    materializedChars: entry.materializedChars || 0,
    chars: entry.chars,
  }));
  return sha256(JSON.stringify({
    pending,
    cacheFailures: state.cacheFailures,
    blockedReadCount: Math.min(2, state.blockedReadCount),
    finalWithPending: state.finalWithPending,
    completionClaimWithPending: state.completionClaimWithPending,
    stalledMaterializerCalls: state.stalledMaterializerCalls,
  }));
}

function shouldEnforceReadLease(state, pendingLimitChars) {
  if (!state?.requiresArtifact) return false;
  if (state.requiresCompleteCoverage) return true;
  return pendingInputs(state)
    .some((entry) => entry.source.startsWith("tool:") && Number(entry.chars) > pendingLimitChars);
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

function safeTextEnd(text, offset, maxChars) {
  let end = Math.min(text.length, offset + maxChars);
  if (end < text.length && end > offset
    && /[\uD800-\uDBFF]/.test(text[end - 1])
    && /[\uDC00-\uDFFF]/.test(text[end])) {
    end -= 1;
  }
  if (end === offset && offset + 1 < text.length
    && /[\uD800-\uDBFF]/.test(text[offset])
    && /[\uDC00-\uDFFF]/.test(text[offset + 1])) {
    return offset + 2;
  }
  return end;
}

function interventionOptions(status = {}) {
  const hasArtifact = Array.isArray(status.artifactPaths) && status.artifactPaths.length > 0;
  const options = [
    {
      id: "continue",
      title: hasArtifact ? "继续补齐当前文件（推荐）" : "继续处理剩余内容（推荐）",
      summary: hasArtifact
        ? "保留当前文件，按顺序处理剩余内容，仍以完整结果为目标。"
        : "按顺序处理剩余内容，完成后再报告结果。",
    },
  ];
  if (Number(status.cacheFailureCount) > 0) {
    options.push({
      id: "discard-invalid",
      title: "跳过无法恢复的内容并继续",
      summary: "可能丢失这部分内容；仅在确认缓存确实损坏时选择。",
    });
  }
  options.push(
    {
      id: "revise",
      title: "修改范围或输出要求",
      summary: "暂停当前任务，先调整范围、格式或优先级，再决定是否继续。",
    },
    {
      id: "accept-partial",
      title: "接受当前不完整结果",
      summary: hasArtifact
        ? "立即保留当前文件，并明确标记尚未覆盖的内容。"
        : "保留现有结果，并明确标记仍未处理的内容。",
    },
    { id: "stop", title: "停止并保留现场", summary: "停止任务，保留当前文件和恢复记录，之后可从这里继续。" },
  );
  return options;
}

function formatInputChars(value) {
  const chars = Math.max(0, Number(value) || 0);
  if (chars >= 10_000) return `${(chars / 10_000).toFixed(chars >= 100_000 ? 0 : 1)} 万字符`;
  return `${chars.toLocaleString()} 字符`;
}

export function decideContextInputIntervention(status) {
  if (!status?.requiresIntervention) return null;
  const cacheFailed = Number(status.cacheFailureCount) > 0;
  const artifactPaths = Array.isArray(status.artifactPaths) ? status.artifactPaths : [];
  const pendingCoverageCount = Number(status.pendingCoverageCount ?? status.pendingCount ?? 0);
  const recorded = Number(status.totalInputChars) || 0;
  const materialized = Number(status.materializedChars) || 0;
  const pendingChars = Number(status.pendingCoverageChars ?? status.pendingChars) || 0;
  const reason = cacheFailed
    ? "部分刚读取的内容没有被可靠保存，继续读取可能造成遗漏。"
    : status.progressAnomaly
      ? "读取内容与当前已写入结果明显不匹配，结果可能不完整。"
      : status.finalWithPending
        ? "模型准备结束，但仍有内容没有写入或确认到结果中。"
        : status.blockedReadCount >= 2
          ? "读取流程连续被暂停，系统需要确认如何处理尚未写入的内容。"
          : "当前任务仍有内容没有写入或确认到结果中。";
  const statusSummary = [
    recorded > 0 ? `已读取 ${formatInputChars(recorded)}` : "已读取量暂不可统计",
    materialized > 0 ? `已确认写入 ${formatInputChars(materialized)}` : "已确认写入 0 字符",
    pendingCoverageCount > 0 ? `待处理约 ${formatInputChars(pendingChars)}（${pendingCoverageCount} 批）` : "仍有待处理内容",
  ].join("；");
  const question = "请选择下一步。若仍要求完整结果，请选择第一项。";
  const options = interventionOptions(status);
  return {
    kind: "choice",
    title: "任务已暂停，需要你决定下一步",
    question,
    options,
    allowCustom: true,
    contextInput: {
      reason,
      statusSummary,
      recommendation: artifactPaths.length > 0
        ? "推荐“继续补齐当前文件”：当前文件会保留，系统会从安全位置继续处理。"
        : "推荐“继续处理剩余内容”：系统会先处理已缓存内容，再继续任务。",
    },
    payload: {
      title: "任务已暂停，需要你决定下一步",
      question,
      options,
      allowCustom: true,
      contextInput: {
        reason,
        statusSummary,
        recommendation: artifactPaths.length > 0
          ? "推荐“继续补齐当前文件”：当前文件会保留，系统会从安全位置继续处理。"
          : "推荐“继续处理剩余内容”：系统会先处理已缓存内容，再继续任务。",
      },
    },
  };
}

export function buildContextInputFlushPrompt(status) {
  const references = Array.isArray(status?.pendingInputs) ? status.pendingInputs : [];
  const list = references.length > 0
    ? references.map((entry) => entry.resourceId
      ? `- ${entry.contextId}: ${entry.chars} chars (${entry.source})\n  这是资源型输入，必须使用 read_tool_output：resourceId=${entry.resourceId}，从 offsetBytes=${Math.max(0, Number(entry.coveredChars) || 0)} 开始，建议 maxBytes=24000；读取后立即用 write_file 或 append_file 持久化，再读取下一段。`
      : `- ${entry.contextId}: ${entry.chars} chars (${entry.source})\n  这是普通缓存输入，使用 read_context_input 按 offset 分段恢复；读取后立即用 write_file 或 append_file 持久化，再读取下一段.`).join("\n")
    : "- 缓存写入失败；先说明缺失范围，并改用更小的读取批次。";
  return `[CONTEXT_INPUT_FLUSH_REQUIRED]\n当前任务仍有未处理输入。一次只处理一个待处理输入：先按每项标注的恢复工具读取，立即通过 write_file、append_file 或 edit_file 把该段持久化或整合到交付物，再读取下一段。不要声称任务已完整完成。\n\n${list}`;
}

export function requiresCompleteContextCoverage(text, artifactRequest = {}) {
  if (artifactRequest.required !== true) return false;
  const value = String(text ?? "");
  if (/(?:只要|仅需|仅|只).{0,12}(?:摘要|总结|概述|要点)|summary[ -]?only|brief summary/i.test(value)) return false;
  if (/(?:完整(?:内容|全文)?|全文|全部内容|逐页完整|无损|verbatim|lossless|complete content|entire (?:document|content)|full content)/i.test(value)) return true;
  const existingDocument = /\.(?:pdf|docx?|xlsx?|pptx?|html?|md|markdown|csv|txt)(?:\b|["'`，。；、)）（\]])|\b(?:pdf|word|excel|powerpoint|ppt)\b/i.test(value);
  const markdownOutput = /\.(?:md|markdown)(?:\b|["'`，。；、)）（\]])|markdown|保存为\s*md|转(?:为|成)\s*md/i.test(value);
  return existingDocument && markdownOutput;
}

export function startsFreshContextTransaction(text) {
  const value = String(text ?? "").trim().toLowerCase();
  if (!value) return false;
  return /^(?:\/retry|重试(?:本次|当前)?(?:任务|操作)?|重新(?:执行|开始)(?:(?:本次|当前|这个)?(?:任务|操作))?|从头开始|重新来一遍)$/.test(value);
}

export function createContextInputTransactionStore(root, options = {}) {
  const storeRoot = resolve(root);
  const blobRoot = resolve(storeRoot, "blobs");
  const transactionRoot = resolve(storeRoot, "transactions");
  const resourceRoot = resolve(storeRoot, "tool-results");
  const inputThresholdChars = Math.max(1, Number(options.inputThresholdChars) || DEFAULT_INPUT_THRESHOLD_CHARS);
  const pendingLimitChars = Math.max(inputThresholdChars, Number(options.pendingLimitChars) || DEFAULT_PENDING_LIMIT_CHARS);
  const atomicWrite = options.atomicWrite ?? atomicWriteFileSync;
  let state = null;
  let statePath = null;
  let deferredInputs = [];
  let deferredChars = 0;

  function persist() {
    if (!state || !statePath) return;
    state.updatedAt = new Date().toISOString();
    atomicWrite(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }

  function entryMentionsArtifact(entry, paths) {
    if (toolName(entry?.source, entry?.metadata) !== "run_command") return false;
    try {
      return contentMentionsPath(readFileSync(resolve(blobRoot, `${entry.hash}.txt`), "utf8"), paths);
    } catch {
      return false;
    }
  }

  function entryRedirectsToArtifact(entry, paths) {
    return pathMatches(entry?.metadata?.redirectPaths, paths);
  }

  function beginTurn(turn = {}) {
    const turnId = String(turn.turnId ?? "").trim();
    if (!turnId) throw new Error("context input transaction requires turnId");
    const transactionId = String(turn.transactionId ?? turnId).trim();
    if (!transactionId) throw new Error("context input transaction requires transactionId");
    statePath = resolve(transactionRoot, `${sha256(transactionId)}.json`);
    let saved = null;
    if (existsSync(statePath)) {
      try {
        saved = JSON.parse(readFileSync(statePath, "utf8"));
      } catch {
        saved = null;
      }
    }
    state = normalizeState(saved, transactionId, turnId, turn);
    deferredInputs = [];
    deferredChars = 0;
    return status();
  }

  function captureInput({ source = "unknown", content, metadata = null } = {}) {
    if (!state) throw new Error("beginTurn must be called before captureInput");
    const value = typeof content === "string" ? content : JSON.stringify(content ?? "");
    const resource = parseToolOutputResource(value, resourceRoot);
    if (resource) {
      const existingResource = state.inputs.find((entry) => entry.resourceId && entry.resourceId === resource.resourceId);
      if (existingResource) {
        return {
          ok: true,
          cached: false,
          resourceBacked: true,
          resourceId: resource.resourceId,
          contextId: existingResource.contextId,
          chars: existingResource.chars,
          bytes: resource.bytes,
        };
      }
      const resourceHash = sha256(`resource:${resource.resourceId || resource.path}`);
      const resourceEntry = {
        contextId: `context:${resourceHash}`,
        hash: resourceHash,
        source: String(source).slice(0, 160),
        metadata: { ...(metadata && typeof metadata === "object" ? metadata : {}), resourcePath: resource.path },
        chars: resource.chars || resource.bytes,
        materializedChars: 0,
        coveredChars: 0,
        coverage: "source",
        resourceId: resource.resourceId,
        resourcePath: resource.path,
        state: "pending",
        capturedAt: new Date().toISOString(),
      };
      state.inputs.push(resourceEntry);
      state.finalWithPending = false;
      state.completionClaimWithPending = false;
      state.lastInterventionFingerprint = null;
      try { persist(); } catch (error) {
        state.cacheFailures.push(String(error?.message || error).slice(0, 500));
        return { ok: false, cached: false, error: String(error?.message || error) };
      }
      return {
        ok: true,
        cached: false,
        resourceBacked: true,
        resourceId: resource.resourceId,
        contextId: resourceEntry.contextId,
        chars: resourceEntry.chars,
        bytes: resource.bytes,
      };
    }
    const hash = sha256(value);
    const contextId = `context:${hash}`;
    const existing = state.inputs.find((entry) => entry.contextId === contextId);
    if (existing) return { ok: true, cached: true, contextId, chars: existing.chars, deduplicated: true };
    const candidateMetadata = metadata && typeof metadata === "object" ? { ...metadata } : {};
    if (toolName(source, metadata) === "run_command") {
      const redirectPaths = commandRedirectPaths(value);
      if (redirectPaths.length > 0) candidateMetadata.redirectPaths = redirectPaths;
    }
    const candidate = {
      contextId,
      hash,
      source: String(source).slice(0, 160),
      metadata: Object.keys(candidateMetadata).length > 0 ? candidateMetadata : null,
      content: value,
      coverage: inputCoverage({
        source,
        metadata,
        content: value,
        artifactPaths: state.artifactPaths,
        referenceRoots: state.referenceRoots,
      }),
    };
    const cumulativeToolInput = candidate.source.startsWith("tool:");
    if (value.length < inputThresholdChars) {
      if (!cumulativeToolInput) return { ok: true, cached: false, contextId, chars: value.length };
      deferredInputs.push(candidate);
      deferredChars += value.length;
      if (deferredChars < inputThresholdChars) return { ok: true, cached: false, contextId, chars: value.length };
    } else {
      deferredInputs.push(candidate);
      deferredChars += value.length;
    }

    try {
      const knownIds = new Set(state.inputs.map((entry) => entry.contextId));
      const additions = [];
      for (const pending of deferredInputs) {
        if (knownIds.has(pending.contextId)) continue;
        const blobPath = resolve(blobRoot, `${pending.hash}.txt`);
        if (!existsSync(blobPath)) atomicWrite(blobPath, pending.content, "utf8");
        knownIds.add(pending.contextId);
        additions.push({
          contextId: pending.contextId,
          hash: pending.hash,
          source: pending.source,
          metadata: pending.metadata,
          chars: pending.content.length,
          materializedChars: 0,
          coveredChars: 0,
          coverage: pending.coverage,
          state: pending.coverage === "metadata" ? "foldable" : "pending",
          capturedAt: new Date().toISOString(),
        });
      }
      state.inputs.push(...additions);
      state.finalWithPending = false;
      state.completionClaimWithPending = false;
      state.lastInterventionFingerprint = null;
      state.recoveryReadAllowance = 0;
      persist();
      deferredInputs = [];
      deferredChars = 0;
      return { ok: true, cached: true, contextId, chars: value.length };
    } catch (error) {
      state.cacheFailures.push(String(error?.message || error).slice(0, 500));
      return { ok: false, cached: false, error: String(error?.message || error), chars: value.length };
    }
  }

  function readInput(contextId, readOptions = {}) {
    if (!state) throw new Error("beginTurn must be called before readInput");
    const requestedContextId = String(contextId);
    const requestedOffset = Math.max(0, Number(readOptions.offset) || 0);
    const replayingAfterCompaction = state.readLease?.stale === true;
    if (replayingAfterCompaction) state.readLease = null;
    const enforceReadLease = shouldEnforceReadLease(state, pendingLimitChars);
    if (enforceReadLease && state.readLease && (state.readLease.contextId !== requestedContextId || state.readLease.offset !== requestedOffset)) {
      state.blockedReadCount += 1;
      try { persist(); } catch {}
      return {
        ok: false,
        blocked: true,
        error: "previous context segment must be materialized before reading another segment",
        contextId: requestedContextId,
        readLease: state.readLease,
      };
    }
    const entry = state.inputs.find((item) => item.contextId === requestedContextId);
    if (!entry) {
      state.cacheFailures.push(`unknown context input: ${String(contextId)}`.slice(0, 500));
      try { persist(); } catch {}
      return { ok: false, error: "unknown context input", contextId: String(contextId) };
    }
    if (["invalid", "discarded"].includes(entry.state)) {
      return { ok: false, error: "context input was discarded as invalid", contextId: entry.contextId };
    }
    if (entry.resourceId) {
      state.blockedReadCount += 1;
      try { persist(); } catch {}
      return {
        ok: false,
        blocked: true,
        error: "resource-backed input must be read with read_tool_output",
        recoveryTool: "read_tool_output",
        contextId: entry.contextId,
        resourceId: entry.resourceId,
        offsetBytes: 0,
        hint: `Use read_tool_output with resourceId=${entry.resourceId} and offsetBytes=0, then materialize the returned segment before continuing.`,
      };
    }
    const coveredChars = Math.max(0, Number(entry.coveredChars) || 0);
    const startsAfterUncoveredPrefix = state.requiresCompleteCoverage
      && coveredChars === 0
      && requestedOffset !== 0;
    if (!replayingAfterCompaction && (startsAfterUncoveredPrefix || (requestedOffset !== coveredChars && coveredChars > 0))) {
      state.blockedReadCount += 1;
      try { persist(); } catch {}
      return {
        ok: false,
        blocked: true,
        error: `next context segment must start at offset ${coveredChars}`,
        contextId: entry.contextId,
        expectedOffset: coveredChars,
      };
    }
    try {
      const full = readFileSync(resolve(blobRoot, `${entry.hash}.txt`), "utf8");
      const offset = Math.max(0, Math.min(full.length, requestedOffset));
      const requested = readOptions.maxChars == null ? full.length : Number(readOptions.maxChars);
      const maxChars = Math.max(1, Math.min(100_000, Number.isFinite(requested) ? requested : DEFAULT_READ_CHARS));
      const content = full.slice(offset, safeTextEnd(full, offset, maxChars));
      const nextOffset = offset + content.length;
      if (content.length > 0 && enforceReadLease) {
        state.readLease = {
          contextId: entry.contextId,
          offset,
          nextOffset,
          chars: content.length,
          issuedAt: new Date().toISOString(),
        };
        state.lastInterventionFingerprint = null;
        try { persist(); } catch {}
      }
      return {
        ok: true,
        contextId: entry.contextId,
        source: entry.source,
        metadata: entry.metadata,
        coverage: entry.coverage ?? "source",
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

  function invalidateInput(contextId, reason = "marked-invalid") {
    if (!state) throw new Error("beginTurn must be called before invalidateInput");
    const target = String(contextId ?? "").trim();
    const entries = target
      ? state.inputs.filter((entry) => entry.contextId === target)
      : pendingInputs(state);
    if (entries.length === 0) return { ok: false, error: "unknown context input", contextId: target || null };
    for (const entry of entries) {
      entry.state = "invalid";
      entry.invalidReason = String(reason || "marked-invalid").slice(0, 500);
    }
    state.blockedReadCount = 0;
    state.readLease = null;
    state.cacheFailures = [];
    state.finalWithPending = false;
    state.completionClaimWithPending = false;
    state.lastInterventionFingerprint = null;
    state.recoveryReadAllowance = 0;
    state.stalledMaterializerCalls = 0;
    try { persist(); } catch (error) {
      state.cacheFailures.push(String(error?.message || error).slice(0, 500));
      return { ok: false, error: String(error?.message || error) };
    }
    return { ok: true, invalidated: entries.map((entry) => entry.contextId) };
  }

  function beforeToolCall(tool = {}) {
    if (!state || tool.contextProbe === true || tool.readOnly !== true) return { blocked: false };
    if (tool.name === "read_context_input" && state.readLease?.stale === true) {
      return { blocked: false };
    }
    if (tool.name === "read_context_input" && shouldEnforceReadLease(state, pendingLimitChars) && state.readLease) {
      state.blockedReadCount += 1;
      try { persist(); } catch {}
      return {
        blocked: true,
        result: `${buildContextInputFlushPrompt(status())}\n\n[CONTEXT_INPUT_SEGMENT_PENDING] 先将刚刚恢复的片段写入或整合到交付物，再读取下一段。`,
      };
    }
    if (tool.contextControl === true) return { blocked: false };
    if (state.recoveryReadAllowance > 0) {
      state.recoveryReadAllowance -= 1;
      try { persist(); } catch {}
      return { blocked: false, recoveryWindow: true };
    }
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
    if (compaction.emergency === true) {
      if (state.readLease) state.readLease = { ...state.readLease, stale: true };
      try { persist(); } catch {}
      return { blocked: false, retainReferences: true, memo: memo() };
    }
    return { blocked: true, reason: "pending-context-input", memo: memo() };
  }

  function noteToolResult(tool = {}) {
    if (!state || tool.contextMaterializer !== true || tool.succeeded !== true) return status();
    const pending = pendingInputs(state);
    if (pending.length === 0) return status();
    const credit = writtenChars(tool.args);
    if (credit <= 0) {
      if (state.requiresCompleteCoverage && !state.readLease) {
        state.stalledMaterializerCalls += 1;
        try { persist(); } catch {}
      }
      return status();
    }
    state.materializerCalls += 1;
    const lease = state.readLease;
    const leasedEntry = lease ? pending.find((entry) => entry.contextId === lease.contextId) : null;
    // In complete-coverage mode, a successful write after read_context_input
    // is the protocol's unit of progress. The host cannot infer source
    // fidelity from output character counts, so a fixed percentage must not
    // decide whether a segment is complete.
    if (state.requiresCompleteCoverage && !leasedEntry) {
      state.stalledMaterializerCalls += 1;
      try { persist(); } catch {}
      return status();
    }
    const orderedPending = leasedEntry
      ? [leasedEntry, ...pending.filter((entry) => entry !== leasedEntry)]
      : pending;

    if (!state.requiresCompleteCoverage) {
      for (const entry of orderedPending) {
        entry.materializedChars = Math.max(entry.materializedChars || 0, credit);
        const required = entry === leasedEntry
          ? Math.max(1, Math.ceil((lease?.chars || entry.chars) * MIN_PROGRESS_RATIO))
          : 1;
        entry.state = entry.materializedChars >= required ? "foldable" : "materialized";
      }
    } else {
      leasedEntry.materializedChars = Math.min(
        leasedEntry.chars,
        (leasedEntry.materializedChars || 0) + credit,
      );
      leasedEntry.coveredChars = Math.max(
        Number(leasedEntry.coveredChars) || 0,
        Math.min(leasedEntry.chars, Number(lease?.nextOffset) || 0),
      );
      leasedEntry.state = leasedEntry.coveredChars >= leasedEntry.chars ? "foldable" : "pending";
    }
    state.finalWithPending = false;
    state.completionClaimWithPending = false;
    state.lastInterventionFingerprint = null;
    state.recoveryReadAllowance = 0;
    state.stalledMaterializerCalls = 0;
    if (leasedEntry) state.readLease = null;
    try {
      persist();
    } catch (error) {
      state.cacheFailures.push(String(error?.message || error).slice(0, 500));
    }
    return status();
  }

  function noteResourceRead(read = {}) {
    if (!state) return null;
    const resourceId = String(read.resourceId ?? "").trim();
    const entry = pendingInputs(state).find((item) => item.resourceId === resourceId);
    if (!entry) return { ok: false, error: "unknown tool output resource", resourceId };
    const offsetBytes = Math.max(0, Number(read.offsetBytes) || 0);
    const nextOffsetBytes = Math.max(offsetBytes, Number(read.nextOffsetBytes) || offsetBytes);
    const totalBytes = Math.max(nextOffsetBytes, Number(read.totalBytes) || entry.chars);
    const staleLease = state.readLease?.stale === true;
    if (!staleLease && state.readLease && (
      state.readLease.contextId !== entry.contextId
      || state.readLease.nextOffset !== offsetBytes
    )) {
      state.blockedReadCount += 1;
      try { persist(); } catch {}
      return { ok: false, blocked: true, error: "previous resource segment must be materialized before reading another segment", resourceId, readLease: state.readLease };
    }
    const coveredChars = Math.max(0, Number(entry.coveredChars) || 0);
    const startsAfterUncoveredPrefix = state.requiresCompleteCoverage
      && coveredChars === 0
      && offsetBytes !== 0;
    if (!staleLease && (startsAfterUncoveredPrefix || (coveredChars > 0 && offsetBytes !== coveredChars))) {
      state.blockedReadCount += 1;
      try { persist(); } catch {}
      return { ok: false, blocked: true, error: `next resource segment must start at offset ${coveredChars}`, resourceId, expectedOffsetBytes: coveredChars };
    }
    entry.chars = Math.max(entry.chars, totalBytes);
    state.readLease = {
      contextId: entry.contextId,
      resourceId,
      offset: offsetBytes,
      nextOffset: nextOffsetBytes,
      chars: Math.max(0, nextOffsetBytes - offsetBytes),
      totalChars: totalBytes,
      resource: true,
      issuedAt: new Date().toISOString(),
    };
    state.lastInterventionFingerprint = null;
    try { persist(); } catch {}
    return { ok: true, resourceId, contextId: entry.contextId, complete: read.complete === true || nextOffsetBytes >= totalBytes, nextOffsetBytes };
  }

  function noteArtifactEvidence(evidence = {}) {
    if (!state) return null;
    const paths = normalizePathList(evidence.paths);
    if (paths.length === 0) return status();
    const verified = evidence.verified === true;
    const sourceReferences = (Array.isArray(evidence.sourceReferences) ? evidence.sourceReferences : [])
      .map((value) => String(value ?? ""))
      .filter(Boolean)
      .slice(0, 8);
    const record = {
      paths,
      producer: String(evidence.producer ?? "unknown").slice(0, 160),
      verified,
      reason: String(evidence.reason ?? "artifact-observed").slice(0, 240),
      sourceReferences,
      recordedAt: new Date().toISOString(),
    };
    state.artifactPaths = normalizePathList([...state.artifactPaths, ...paths]);
    state.artifactEvidence = [...state.artifactEvidence, record].slice(-8);

    if (verified) {
      for (const entry of pendingInputs(state)) {
        const coverage = entry.coverage ?? "source";
        const matchesArtifact = pathMatches(entry.metadata?.path, paths)
          || entryRedirectsToArtifact(entry, paths)
          || entryMentionsArtifact(entry, paths)
          || sourceReferences.some((reference) => (
            (entry.resourceId && reference.includes(entry.resourceId))
            || (entry.resourcePath && comparablePath(reference).includes(comparablePath(entry.resourcePath)))
          ));
        if (coverage === "metadata" || matchesArtifact) {
          entry.coverage = coverage === "metadata" ? "metadata" : "artifact-output";
          entry.state = "foldable";
          entry.coveredBy = { type: "artifact", paths, producer: record.producer, verifiedAt: record.recordedAt };
        }
      }
      state.finalWithPending = false;
      state.completionClaimWithPending = false;
      state.lastInterventionFingerprint = null;
      state.recoveryReadAllowance = 0;
      state.stalledMaterializerCalls = 0;
    }
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
    if (selected === "continue") {
      state.blockedReadCount = 0;
      state.cacheFailures = [];
      state.recoveryReadAllowance = 1;
    }
    if (selected === "discard-invalid") {
      invalidateInput(null, "user-discarded");
    }
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

  function claimIntervention() {
    if (!state || !status().requiresIntervention) return false;
    const fingerprint = interventionFingerprint(state);
    if (state.lastInterventionFingerprint === fingerprint) return false;
    state.lastInterventionFingerprint = fingerprint;
    try {
      persist();
    } catch (error) {
      state.cacheFailures.push(String(error?.message || error).slice(0, 500));
    }
    return true;
  }

  function status() {
    if (!state) {
      return {
        turnId: null,
        pendingCount: 0,
        pendingChars: 0,
        pendingCoverageCount: 0,
        pendingCoverageChars: 0,
        pendingInputs: [],
        blockedReadCount: 0,
        readLease: null,
        materializerCalls: 0,
        totalInputChars: 0,
        materializedChars: 0,
        materializationRatio: 0,
        progressAnomaly: false,
        cacheFailureCount: 0,
        completionClaimWithPending: false,
        requiresIntervention: false,
        artifactPaths: [],
        artifactEvidence: [],
      };
    }
    const pending = pendingInputs(state);
    const pendingView = pending.map((entry) => ({
      contextId: entry.contextId,
      resourceId: entry.resourceId || null,
      source: entry.source,
      chars: entry.chars,
      materializedChars: entry.materializedChars || 0,
      coveredChars: entry.coveredChars || 0,
      coverage: entry.coverage ?? "source",
      state: entry.state,
    }));
    const activeInputs = state.inputs.filter((entry) => !["invalid", "discarded"].includes(entry.state));
    const coverageInputs = activeInputs.filter((entry) => (entry.coverage ?? "source") !== "metadata");
    const pendingCoverageInputs = pending.filter((entry) => (entry.coverage ?? "source") !== "metadata");
    const totalInputChars = coverageInputs.reduce((sum, entry) => sum + Math.max(0, Number(entry.chars) || 0), 0);
    const materializedChars = coverageInputs.reduce((sum, entry) => sum + Math.max(0, Number(entry.materializedChars) || 0), 0);
    const materializationRatio = totalInputChars > 0 ? materializedChars / totalInputChars : 0;
    const progressAnomaly = state.requiresArtifact
      && state.requiresCompleteCoverage
      && pendingCoverageInputs.length > 0
      && state.stalledMaterializerCalls > 0;
    const requiresIntervention = state.cacheFailures.length > 0
      || state.blockedReadCount >= 2
      || progressAnomaly
      || (state.requiresArtifact && state.finalWithPending && pendingCoverageInputs.length > 0);
    return {
      transactionId: state.transactionId,
      turnId: state.turnId,
      requiresArtifact: state.requiresArtifact,
      requiresCompleteCoverage: state.requiresCompleteCoverage,
      pendingCount: pending.length,
      pendingChars: pending.reduce((sum, entry) => sum + entry.chars, 0),
      pendingCoverageCount: pendingCoverageInputs.length,
      pendingCoverageChars: pendingCoverageInputs.reduce((sum, entry) => sum + entry.chars, 0),
      backpressureChars: pending
        .filter((entry) => entry.source.startsWith("tool:"))
        .reduce((sum, entry) => sum + entry.chars, 0),
      pendingInputs: pendingView,
      blockedReadCount: state.blockedReadCount,
      readLease: state.readLease,
      materializerCalls: state.materializerCalls,
      totalInputChars,
      materializedChars,
      materializationRatio,
      progressAnomaly,
      cacheFailureCount: state.cacheFailures.length,
      cacheFailures: [...state.cacheFailures],
      finalWithPending: state.finalWithPending,
      completionClaimWithPending: state.completionClaimWithPending,
      requiresIntervention,
      interventionChoice: state.interventionChoice,
      interventionFingerprint: state.lastInterventionFingerprint,
      recoveryReadAllowance: state.recoveryReadAllowance,
      artifactPaths: [...state.artifactPaths],
      artifactEvidence: state.artifactEvidence.map((entry) => ({ ...entry, paths: [...entry.paths] })),
    };
  }

  function memo() {
    const current = status();
    if (current.pendingCount === 0 && current.cacheFailureCount === 0) return "";
    const refs = current.pendingInputs.map((entry) => `${entry.contextId} (${entry.chars} chars, ${entry.state})`).join(", ");
    const lease = current.readLease
      ? `Current segment lease: ${current.readLease.contextId} offset ${current.readLease.offset}-${current.readLease.nextOffset}.`
      : "No segment lease is active.";
    const progress = current.totalInputChars > 0
      ? `Observed input ${current.totalInputChars} chars; materialized ${current.materializedChars} chars.`
      : "No large input has been recorded yet.";
    return `[Context input transaction]\nSource input is cached outside conversation history. Pending: ${refs || "cache write failed"}. ${lease} ${progress} Use read_context_input to recover one bounded segment, materialize it before requesting the next segment, and verify source coverage separately.`;
  }

  return {
    beginTurn,
    captureInput,
    invalidateInput,
    readInput,
    status,
    beforeToolCall,
    beforeCompaction,
    memo,
    noteToolResult,
    noteResourceRead,
    noteArtifactEvidence,
    noteAssistantFinal,
    claimIntervention,
    resolveIntervention,
  };
}
