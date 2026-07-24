function safeText(value) {
  return String(value ?? "").trim();
}

function decodeBase64(value) {
  const base64 = safeText(value).replace(/\s+/g, "");
  if (base64.length > Math.ceil(50 * 1024 * 1024 / 3) * 4 + 4) return null;
  if (!base64 || base64.length % 4 === 1 || !/^[A-Za-z0-9+/=]+$/.test(base64)) return null;
  const bytes = Buffer.from(base64, "base64");
  return bytes.length > 0 ? bytes : null;
}

function mediaKind(mimeType) {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  return "file";
}

/** Convert a raw MCP content list without placing Base64 into model text. */
export async function adaptMcpMediaResult(result, {
  attachmentRuntime,
  mediaRuntime,
  supportsImages = false,
  operationId = null,
  sessionId = null,
  workspace = null,
  toolName = "mcp-tool",
  toolCallId = null,
  signal = null,
} = {}) {
  const content = Array.isArray(result?.content) ? result.content : [];
  const textParts = [];
  const attachments = [];
  const modelImages = [];
  const warnings = [];

  for (let index = 0; index < content.length; index++) {
    const block = content[index];
    if (block?.type === "text") {
      const text = safeText(block.text);
      if (text) textParts.push(text);
      continue;
    }
    const mimeType = safeText(block?.mimeType || block?.mime_type).toLowerCase();
    const kind = mediaKind(mimeType);
    if (!["image", "audio", "video"].includes(kind)) {
      warnings.push(`MCP 返回了无法识别的内容块 #${index + 1}。`);
      continue;
    }
    if (signal?.aborted) {
      warnings.push(`MCP ${kind} 附件处理已取消。`);
      continue;
    }

    if (kind === "image") {
      const prepared = await mediaRuntime.readImageData({
        data: block.data,
        mimeType,
        name: `${toolName}-${index + 1}`,
      }, { operationId, sessionId, toolCallId, workspace, signal });
      if (!prepared.ok) {
        warnings.push(prepared.error?.message || "MCP 图片处理失败。");
        continue;
      }
      attachments.push({
        ...prepared.attachment,
        mcp: { toolName, toolCallId, blockIndex: index },
      });
      if (supportsImages) modelImages.push(prepared.dataUrl);
      else warnings.push(`图片附件 ${prepared.attachment.id} 已保存，但当前模型不支持图片输入，模型未查看该图片。`);
      continue;
    }

    const bytes = decodeBase64(block.data);
    if (!bytes) {
      warnings.push(`MCP ${kind} 内容 #${index + 1} 的 Base64 无效。`);
      continue;
    }
    try {
      const attachment = await attachmentRuntime.ingestBytes(bytes, {
        kind,
        mimeType: mimeType || "application/octet-stream",
        name: `${toolName}-${index + 1}`,
        operationId,
        sessionId,
        workspace,
      });
      attachments.push({ ...attachment, mcp: { toolName, toolCallId, blockIndex: index } });
      warnings.push(`${kind === "video" ? "视频" : "音频"}附件 ${attachment.id} 已保存；当前版本不会把它发送给模型。`);
    } catch (error) {
      warnings.push(`MCP ${kind} 附件保存失败：${error?.message || error}`);
    }
  }

  const summary = [
    ...textParts,
    ...attachments.map((attachment) => `[attachment:${attachment.id}] ${attachment.kind} ${attachment.mimeType} ${attachment.size} bytes`),
    ...warnings.map((warning) => `[media warning] ${warning}`),
  ].filter(Boolean).join("\n").trim();
  return {
    text: result?.isError ? `ERROR: ${summary || "(no error message from server)"}` : summary,
    attachments,
    modelImages,
    warnings,
  };
}
