const ARTIFACT_EXTENSION_RE = /\.(?:md|markdown|html?|txt|pdf|docx?|pptx?|xlsx?|csv|json|xml|ya?ml)(?:\s|$|["'`，。；;、)）（\]])/i;
const ARTIFACT_PATH_RE = /(?:[A-Za-z]:[\\/]|\\\\|\/(?!\/)|(?:\.{1,2}[\\/])|(?:[\p{L}\p{N}_-]+[\\/]))[^"'`<>\r\n]+?\.(?:md|markdown|html?|txt|pdf|docx?|pptx?|xlsx?|csv|json|xml|ya?ml)(?=$|[\s"'“”‘’),;，。；、）\]}：:])/giu;
const BARE_ARTIFACT_PATH_RE = /(?<![\p{L}\p{N}_./\\-])([\p{L}\p{N}_-]+\.(?:md|markdown|html?|txt|pdf|docx?|pptx?|xlsx?|csv|json|xml|ya?ml))(?=$|[\s"'“”‘’),;，。；、）\]}：:])/giu;
const ARTIFACT_TARGET_RE = /(?:文件|文档|报告|markdown|html|pdf|word|excel|ppt)/i;
const ARTIFACT_WRITE_RE = /(?:保存|另存|写入|导出|生成|创建|制作|落盘)/i;
const PREVIOUS_RESPONSE_RE = /(?:刚才|上一条|上面|前面|此前|先前|这份|这个).{0,18}(?:回答|回复|内容|总结|报告|文档)/i;
const DISCUSSION_RE = /(?:如何|怎么|怎样|是否|能否|可否|评估|分析|讨论|建议|方案|为什么)/i;
const DIRECT_REQUEST_RE = /(?:请|帮我|把|将|直接|现在|立即)/i;
const PLAN_ONLY_REQUEST_RE = /(?:先|首先).{0,32}(?:计划|方案).{0,36}(?:确认|审批|同意).{0,20}(?:后|再).{0,24}(?:执行|开始|落地|生成|写入|保存|导出|创建|制作|处理)|(?:制定|给出|提供|生成|给我|给).{0,24}(?:计划|方案).{0,40}(?:等|待|确认|审批|同意).{0,20}(?:后|再).{0,24}(?:执行|开始|落地|生成|写入|保存|导出|创建|制作|处理)|(?:plan|proposal).{0,48}(?:confirm|approve).{0,24}(?:before|then).{0,24}(?:execute|start|generate|write|save|export)/iu;
const ARTIFACT_OUTPUT_MARKER_RE = /(?:wrote|written|saved|created|generated|exported|moved|copied|output(?:\s+file)?|artifact|destination|target|输出|写入|保存|生成|创建|导出|目标文件)/iu;
const ARTIFACT_OUTPUT_CONTEXT_RE = /(?:保存|另存|写入|导出|生成|创建|落盘|save|write|export|output|target|destination)/iu;
import { normalizeToolOutcome } from "./tool-progress.mjs";
function isUrlLikePath(value) {
  return String(value ?? "").includes("://");
}
export function requestedArtifactPaths(value) {
  const text = String(value ?? "");
  if (!text) return [];
  const paths = [];
  for (const match of text.matchAll(ARTIFACT_PATH_RE)) {
    const path = String(match[0] ?? "").trim();
    if (path && !isUrlLikePath(path)) paths.push(path);
  }
  for (const match of text.matchAll(BARE_ARTIFACT_PATH_RE)) {
    const path = String(match[1] ?? "").trim();
    if (path && !isUrlLikePath(path)) paths.push(path);
  }
  return Array.from(new Set(paths));
}

export function requestedOutputArtifactPaths(value) {
  const text = String(value ?? "");
  const paths = [];
  for (const match of text.matchAll(ARTIFACT_PATH_RE)) {
    const prefix = text.slice(Math.max(0, match.index ?? 0) - 96, match.index ?? 0);
    if (!ARTIFACT_OUTPUT_CONTEXT_RE.test(prefix)) continue;
    const path = String(match[0] ?? "").trim();
    if (path && !isUrlLikePath(path) && !paths.includes(path)) paths.push(path);
  }
  for (const match of text.matchAll(BARE_ARTIFACT_PATH_RE)) {
    const prefix = text.slice(Math.max(0, match.index ?? 0) - 96, match.index ?? 0);
    if (!ARTIFACT_OUTPUT_CONTEXT_RE.test(prefix)) continue;
    const path = String(match[1] ?? "").trim();
    if (path && !isUrlLikePath(path) && !paths.includes(path)) paths.push(path);
  }
  return paths;
}

/**
 * Recover artifact paths reported by a command itself, such as
 * "Wrote Markdown to: C:\\work\\report.md". The caller still verifies that
 * the path exists and was changed during the current turn before accepting it.
 */
export function artifactPathsFromToolOutput(value) {
  const paths = [];
  for (const line of String(value ?? "").split(/\r?\n/u)) {
    if (!ARTIFACT_OUTPUT_MARKER_RE.test(line)) continue;
    for (const match of line.matchAll(ARTIFACT_PATH_RE)) {
      const path = String(match[0] ?? "").trim().replace(/[.,;:：，。；、)）\]}]+$/u, "");
      if (path && !isUrlLikePath(path) && !paths.includes(path)) paths.push(path);
    }
    for (const match of line.matchAll(BARE_ARTIFACT_PATH_RE)) {
      const path = String(match[1] ?? "").trim();
      if (path && !isUrlLikePath(path) && !paths.includes(path)) paths.push(path);
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

export function isPlanOnlyRequest(value) {
  return PLAN_ONLY_REQUEST_RE.test(String(value ?? "").trim());
}

export function shouldEnforceArtifactDelivery({ required = false, planningOnly = false, executionStarted = false, planApproved = false } = {}) {
  return required && (!planningOnly || executionStarted || planApproved);
}

export function artifactDeliveryRetryPrompt(request, originalText) {
  const lines = [
    "[系统文件交付校验]",
    "用户明确要求生成实际文件，但上一轮没有检测到成功写入的产物。",
  ];
  if (request?.savePreviousResponse) {
    lines.push("立即调用 save_last_assistant_response；只需提供输出路径，不要重新发送上一条回答作为 content。");
  } else {
    lines.push("先检查原始任务中指定的目标路径是否已经存在；若已存在，先验证并保留它，不要用当前上下文的截断预览覆盖长文档。仅在目标不存在时，才使用 write_file 创建文件；长文档先写第一部分，再用 append_file 追加其余部分。");
  }
  lines.push(
    "不要只在聊天中展示内容，也不要在文件真实存在前声称已经完成。",
    `原始任务：${String(originalText ?? "").slice(0, 2000)}`,
  );
  return lines.join("\n");
}

export function artifactMissingNotice() {
  return "\n\n> 文件交付未确认：当前轮没有获得目标文件的可验证证据，因此暂不能确认交付完成。文件可能已经生成但未被当前工具结果识别，请检查目标路径或重新执行文件校验。";
}

export function toolResultSucceeded(value, { status = null } = {}) {
  return normalizeToolOutcome(value, { status }).ok === true;
}
