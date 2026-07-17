import { resolve } from "node:path";

const ARTIFACT_EXTENSION_RE = /\.(?:md|markdown|html?|txt|pdf|docx?|pptx?|xlsx?|csv|json|xml|ya?ml)(?:\s|$|["'`，。；;、)）（\]])/i;
const ARTIFACT_TARGET_RE = /(?:文件|文档|报告|markdown|html|pdf|word|excel|ppt)/i;
const ARTIFACT_WRITE_RE = /(?:保存|另存|写入|导出|生成|创建|制作|落盘)/i;
const PREVIOUS_RESPONSE_RE = /(?:刚才|上一条|上面|前面|此前|先前|这份|这个).{0,18}(?:回答|回复|内容|总结|报告|文档)/i;
const DISCUSSION_RE = /(?:如何|怎么|怎样|是否|能否|可否|评估|分析|讨论|建议|方案|为什么)/i;
const DIRECT_REQUEST_RE = /(?:请|帮我|把|将|直接|现在|立即)/i;
const DOCUMENT_JOB_ID_RE = /^(?:document:)?[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
const DOCUMENT_WRITER_NAMES = new Set([
  "append_file",
  "edit",
  "multi_edit",
  "organize_document_to_markdown",
  "organize_pdf_to_markdown",
  "save_file",
  "save_last_assistant_response",
  "write_file",
]);
const PENDING_DOCUMENT_STATUSES = new Set([
  "accepted",
  "interrupted",
  "paused",
  "pausing",
  "preparing",
  "queued",
  "running",
  "waiting_foreground",
]);

function parseMaybeObject(value) {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function publicDocumentJobId(value) {
  const raw = String(value ?? "").trim().replace(/^document:/i, "");
  return raw ? `document:${raw}` : "";
}

function comparablePath(value) {
  const raw = String(value ?? "").trim();
  if (!raw || /^visionox-document:/i.test(raw)) return "";
  try {
    const absolute = resolve(raw);
    return process.platform === "win32" ? absolute.toLowerCase() : absolute;
  } catch {
    return process.platform === "win32" ? raw.toLowerCase() : raw;
  }
}

function collectPathValues(value, paths = [], depth = 0) {
  if (!value || typeof value !== "object" || depth > 3) return paths;
  for (const [key, nested] of Object.entries(value)) {
    if (["file", "filePath", "file_path", "filename", "output", "outputPath", "path", "reportPath"].includes(key) && typeof nested === "string") {
      paths.push(nested);
    } else if (nested && typeof nested === "object") {
      collectPathValues(nested, paths, depth + 1);
    }
  }
  return paths;
}

export function latestAssistantResponse(messages) {
  if (!Array.isArray(messages)) return null;
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message?.role !== "assistant") continue;
    const text = typeof message.text === "string"
      ? message.text.trim()
      : typeof message.content === "string"
        ? message.content.trim()
        : "";
    if (!text) continue;
    return { id: message.id ?? null, text };
  }
  return null;
}

export function registerSaveLastAssistantResponseTool(tools, options = {}) {
  tools.register({
    name: "save_last_assistant_response",
    description: "Save the previous stable assistant response to a file. Use this when the user asks to save, export, or turn the answer just shown in chat into a Markdown/text document. Only the output path is required; do not resend the prior response as content.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Output path, relative to the workspace or an approved absolute path." },
      },
      required: ["path"],
    },
    fn: async (args, toolContext) => {
      const previous = options.getLastAssistantResponse?.();
      if (!previous?.text) {
        return JSON.stringify({ ok: false, error: "no previous stable assistant response is available" });
      }
      const result = await tools.dispatch("write_file", {
        path: args?.path,
        content: previous.text,
      }, toolContext);
      if (!toolResultSucceeded(result)) {
        return JSON.stringify({ ok: false, error: "write_file did not create the requested artifact", writeResult: result });
      }
      return JSON.stringify({
        ok: true,
        path: args?.path,
        sourceMessageId: previous.id ?? null,
        chars: previous.text.length,
        writeResult: result,
      });
    },
  });
}

export function detectArtifactRequest(value) {
  const text = String(value ?? "").trim();
  if (!text || !ARTIFACT_WRITE_RE.test(text)) {
    return { required: false, savePreviousResponse: false };
  }
  const hasTarget = ARTIFACT_TARGET_RE.test(text) || ARTIFACT_EXTENSION_RE.test(text);
  if (!hasTarget) return { required: false, savePreviousResponse: false };

  const direct = DIRECT_REQUEST_RE.test(text) || ARTIFACT_EXTENSION_RE.test(text);
  if (!direct && DISCUSSION_RE.test(text)) {
    return { required: false, savePreviousResponse: false };
  }
  return {
    required: true,
    savePreviousResponse: PREVIOUS_RESPONSE_RE.test(text),
  };
}

export function artifactDeliveryRetryPrompt(request, originalText) {
  const lines = [
    "[系统文件交付校验]",
    "用户明确要求生成实际文件，但上一轮没有检测到成功写入的产物。",
  ];
  if (request?.savePreviousResponse) {
    lines.push("立即调用 save_last_assistant_response；只需提供输出路径，不要重新发送上一条回答作为 content。");
  } else {
    lines.push("立即使用 write_file 创建文件；长文档先写第一部分，再用 append_file 追加其余部分。");
  }
  lines.push(
    "不要只在聊天中展示内容，也不要在文件真实存在前声称已经完成。",
    `原始任务：${String(originalText ?? "").slice(0, 2000)}`,
  );
  return lines.join("\n");
}

export function artifactMissingNotice() {
  return "\n\n> 文件交付未完成：系统没有检测到实际生成的文件，本次结果不能标记为完成。";
}

export function pendingDocumentArtifactFromToolEvent(toolName, toolArgs, toolResult) {
  if (String(toolName ?? "").toLowerCase() !== "organize_document_to_markdown") return null;
  const result = parseMaybeObject(toolResult);
  if (result?.ok !== true || result?.accepted !== true || result?.artifactStatus !== "pending") return null;
  const args = parseMaybeObject(toolArgs) ?? {};
  const jobId = publicDocumentJobId(result.backgroundJobId ?? result.id ?? result.documentJobId);
  if (!jobId) return null;
  return {
    state: "pending",
    jobId,
    documentJobId: String(result.documentJobId ?? jobId.replace(/^document:/, "")),
    outputPath: String(result.outputPath ?? args.outputPath ?? "").trim(),
    sourcePath: String(result.sourcePath ?? args.input ?? "").trim(),
  };
}

export function documentArtifactStateFromJob(job) {
  const status = String(job?.status ?? "").toLowerCase();
  if (status === "completed" || status === "completed_with_warnings") return "created";
  if (status === "failed" || status === "cancelled") return "failed";
  return "pending";
}

export function pendingDocumentWriteConflict(toolName, toolArgs, jobs) {
  const name = String(toolName ?? "").toLowerCase();
  if (!DOCUMENT_WRITER_NAMES.has(name)) return null;
  const args = parseMaybeObject(toolArgs) ?? {};
  const requestedPaths = collectPathValues(args).map(comparablePath).filter(Boolean);
  if (requestedPaths.length === 0) return null;
  const pending = (Array.isArray(jobs) ? jobs : []).find((job) => {
    const status = String(job?.status ?? "").toLowerCase();
    const outputPath = comparablePath(job?.outputPath);
    return PENDING_DOCUMENT_STATUSES.has(status) && outputPath && requestedPaths.includes(outputPath);
  });
  if (!pending) return null;
  return {
    ok: false,
    error: `${name}: the target file belongs to a pending background document job; wait for completion or cancel that job before writing the same path`,
    code: "artifact-pending",
    artifactStatus: "pending",
    backgroundJobId: publicDocumentJobId(pending.id ?? pending.documentJobId),
    outputPath: pending.outputPath,
    useTool: "get_document_job_status",
  };
}

export function documentJobToolMismatch(toolName, toolArgs) {
  const name = String(toolName ?? "").toLowerCase();
  if (!["job_output", "stop_job", "wait_for_job"].includes(name)) return null;
  const args = parseMaybeObject(toolArgs) ?? {};
  const jobId = String(args.jobId ?? "").trim();
  if (!DOCUMENT_JOB_ID_RE.test(jobId)) return null;
  return {
    ok: false,
    error: `${name} only handles process jobs created by run_background; use get_document_job_status for document jobs`,
    code: "wrong-job-system",
    backgroundJobId: publicDocumentJobId(jobId),
    useTool: "get_document_job_status",
  };
}

export function toolResultSucceeded(value) {
  const text = String(value ?? "").trim();
  if (!text) return false;
  if (/^(?:error|failed|failure)\s*:/i.test(text)) return false;
  if (!text.startsWith("{")) return true;
  try {
    const parsed = JSON.parse(text);
    return parsed?.ok !== false && typeof parsed?.error !== "string";
  } catch {
    return true;
  }
}
