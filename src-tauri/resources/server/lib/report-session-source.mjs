import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

const DEFAULT_MAX_MESSAGE_CHARS = 6_000;

function issue(source, filePath, type, line, reason) {
  return {
    source: String(source || "unknown"),
    path: filePath,
    type,
    ...(Number.isInteger(line) ? { line } : {}),
    reason: String(reason || "读取会话来源失败").replace(/[\r\n]+/g, " ").slice(0, 300),
  };
}

/**
 * Stream one archived/active session JSONL file while retaining the newest
 * messages that fit in the caller's collection budget. Invalid records are
 * reported instead of being silently discarded; valid records remain usable
 * so callers can display a useful diagnostic before retrying.
 */
export async function scanReportJsonlMessages(
  filePath,
  retainChars = 0,
  { source = filePath, maxMessageChars = DEFAULT_MAX_MESSAGE_CHARS } = {},
) {
  const messages = [];
  const issues = [];
  let retainedChars = 0;
  let retainedOriginalChars = 0;
  let totalChars = 0;
  let totalMessages = 0;

  try {
    const input = createReadStream(filePath, { encoding: "utf8" });
    const lines = createInterface({ input, crlfDelay: Infinity });
    let lineNumber = 0;
    try {
      for await (const line of lines) {
        lineNumber++;
        if (!line.trim()) continue;
        let parsed;
        try {
          parsed = JSON.parse(line);
        } catch (error) {
          issues.push(issue(source, filePath, "invalid-json", lineNumber, error?.message || "JSON 无效"));
          continue;
        }
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          issues.push(issue(source, filePath, "invalid-record", lineNumber, "记录必须是 JSON 对象"));
          continue;
        }
        const hasContent = Object.prototype.hasOwnProperty.call(parsed, "content")
          || Object.prototype.hasOwnProperty.call(parsed, "text");
        if (!hasContent) {
          issues.push(issue(source, filePath, "invalid-record", lineNumber, "记录缺少 content/text 字段"));
          continue;
        }
        totalMessages++;
        const originalContent = String(parsed.content ?? parsed.text ?? "");
        totalChars += originalContent.length;
        if (retainChars <= 0) continue;
        const content = Number.isFinite(maxMessageChars) && originalContent.length > maxMessageChars
          ? `${originalContent.slice(0, maxMessageChars)}\n\n… (truncated)`
          : originalContent;
        const message = {
          role: typeof parsed.role === "string" ? parsed.role : "unknown",
          content,
        };
        const chars = message.content.length + message.role.length + 16;
        while (messages.length > 0 && retainedChars + chars > retainChars) {
          const removed = messages.shift();
          retainedChars -= removed.__chars;
          retainedOriginalChars -= removed.__originalChars;
        }
        if (chars <= retainChars) {
          Object.defineProperty(message, "__chars", { value: chars, enumerable: false });
          Object.defineProperty(message, "__originalChars", { value: originalContent.length, enumerable: false });
          messages.push(message);
          retainedChars += chars;
          retainedOriginalChars += originalContent.length;
        }
      }
    } finally {
      lines.close();
    }
  } catch (error) {
    issues.push(issue(source, filePath, "read-failed", null, error?.message || "无法读取会话文件"));
  }

  return {
    messages,
    issues,
    totalMessages,
    retainedMessages: messages.length,
    retainedChars,
    retainedOriginalChars,
    totalChars,
    omittedMessages: Math.max(0, totalMessages - messages.length),
    omittedChars: Math.max(0, totalChars - retainedOriginalChars),
  };
}

export function reportSourceIntegrityError(issues) {
  const list = Array.isArray(issues) ? issues.filter(Boolean) : [];
  if (list.length === 0) return null;
  const examples = list.slice(0, 3).map((item) => {
    const line = Number.isInteger(item.line) ? ` 第 ${item.line} 行` : "";
    return `${item.source || "会话文件"}${line}：${item.reason || "读取失败"}`;
  });
  const suffix = list.length > examples.length ? `；另有 ${list.length - examples.length} 个问题` : "";
  const error = new Error(`会话报告未生成：会话记录读取不完整（${list.length} 个问题）。${examples.join("；")}${suffix}。请修复或删除损坏的会话文件后重试。`);
  error.name = "ReportSourceIntegrityError";
  error.code = "REPORT_SOURCE_INCOMPLETE";
  error.issues = list;
  return error;
}

export function assertReportSourceIntegrity(issues) {
  const error = reportSourceIntegrityError(issues);
  if (error) throw error;
}
