import { resolve } from "node:path";

import { mediaFailure } from "./media-errors.mjs";

function sameWorkspace(left, right) {
  if (!left || !right) return true;
  const normalize = (value) => {
    const path = resolve(String(value));
    return process.platform === "win32" ? path.toLowerCase() : path;
  };
  return normalize(left) === normalize(right);
}

function scopedToContext(attachment, context) {
  if (attachment?.sessionId && context?.sessionId && attachment.sessionId !== context.sessionId) return false;
  return sameWorkspace(attachment?.workspace, context?.workspace);
}

function failure(code, message, attachment, context, details = {}) {
  return mediaFailure(code, message, {
    attachmentId: attachment?.id ?? null,
    operationId: context?.operationId ?? null,
    ...details,
  });
}

/** Prepares submitted attachment references for the one ordinary model loop. */
export async function prepareSubmittedMedia({
  attachmentRuntime,
  mediaRuntime,
  mediaProviderAdapter,
  attachmentIds = [],
  inlineImages = [],
  provider,
  model,
  capabilities = {},
  context = {},
} = {}) {
  if (!attachmentRuntime || typeof attachmentRuntime.get !== "function") throw new TypeError("attachmentRuntime is required");
  const attachments = [];
  const modelImages = [];
  const mediaParts = [];
  const errors = [];
  const pendingUploads = [];
  let imageCount = 0;
  const maxImages = Math.max(0, Number(capabilities.maxImagesPerRequest) || 0);

  for (const id of [...new Set(Array.isArray(attachmentIds) ? attachmentIds : [])]) {
    const stored = await attachmentRuntime.get(id);
    if (!stored || stored.missing) {
      errors.push(failure("media_blob_missing", `附件 ${id} 不存在或 Blob 已损坏。`, stored ?? { id }, context));
      continue;
    }
    if (!scopedToContext(stored, context)) {
      errors.push(failure("media_not_found", `附件 ${id} 不属于当前会话或工作区。`, stored, context));
      continue;
    }
    if (String(stored.operationId ?? "").startsWith("upload:") && stored.sessionId && stored.workspace) {
      pendingUploads.push({ id: stored.id, sessionId: stored.sessionId, workspace: stored.workspace });
    }
    if (stored.kind === "image") {
      if (!capabilities.inputModalities?.includes("image")) {
        errors.push(failure("media_provider_unsupported", "当前模型不支持图片输入。", stored, context));
        continue;
      }
      if (imageCount >= maxImages) {
        errors.push(failure("media_too_large", `当前模型单次最多接收 ${maxImages} 张图片。`, stored, context));
        continue;
      }
      imageCount++;
      if (!mediaRuntime || typeof mediaRuntime.readAttachment !== "function") {
        errors.push(failure("media_decode_failed", "图片处理运行时不可用。", stored, context));
        continue;
      }
      const result = await mediaRuntime.readAttachment({ attachmentId: id }, { ...context, rebind: true });
      if (!result.ok) {
        errors.push(result.error ?? failure("media_decode_failed", `附件 ${id} 无法处理。`, stored, context));
        continue;
      }
      attachments.push(result.attachment);
      modelImages.push(result.dataUrl);
      continue;
    }
    if (stored.kind === "video") {
      if (!capabilities.inputModalities?.includes("video")) {
        errors.push(failure("media_provider_unsupported", "当前模型未声明视频输入能力。", stored, context));
        continue;
      }
      const maxMediaBytes = Number(capabilities.maxMediaBytes) || 50 * 1024 * 1024;
      if (stored.size > Math.min(maxMediaBytes, 50 * 1024 * 1024)) {
        errors.push(failure("media_too_large", "视频超过当前模型或宿主的 50 MB 上传限制。", stored, context));
        continue;
      }
      const bytes = await attachmentRuntime.readBytes(id);
      if (!bytes) {
        errors.push(failure("media_blob_missing", `视频附件 ${id} 的 Blob 不存在。`, stored, context));
        continue;
      }
      const rebound = await attachmentRuntime.ingestBytes(bytes, {
        kind: "video",
        mimeType: stored.mimeType,
        name: stored.name,
        operationId: context.operationId,
        sessionId: context.sessionId,
        workspace: context.workspace,
      });
      const resolved = await mediaProviderAdapter.resolveMedia(
        [{ attachment: rebound }],
        model,
        { id: context.operationId, provider },
        context.signal,
      );
      if (resolved.warnings.length > 0 || resolved.parts.length === 0) {
        errors.push(...resolved.warnings);
        await attachmentRuntime.releaseAttachments([rebound.id], context).catch(() => {});
        continue;
      }
      attachments.push(rebound);
      mediaParts.push(...resolved.parts);
      continue;
    }
    errors.push(failure("media_format_unsupported", `暂不支持附件类型 ${stored.kind || stored.mimeType || "unknown"}。`, stored, context));
  }

  if (inlineImages.length > 0) {
    if (!capabilities.inputModalities?.includes("image")) {
      errors.push(failure("media_provider_unsupported", "当前模型不支持图片输入。", null, context));
    } else if (mediaRuntime && typeof mediaRuntime.prepareInputDataUrls === "function") {
      const available = Math.max(0, maxImages - imageCount);
      const acceptedImages = inlineImages.slice(0, available);
      if (acceptedImages.length < inlineImages.length) {
        errors.push(failure("media_too_large", `当前模型单次最多接收 ${maxImages} 张图片。`, null, context));
      }
      const prepared = await mediaRuntime.prepareInputDataUrls(acceptedImages, context);
      attachments.push(...prepared.attachments);
      modelImages.push(...prepared.modelImages);
      errors.push(...prepared.errors.map((item) => item.error ?? item));
    }
  }
  if (errors.length > 0) {
    const originalIds = new Set(attachmentIds);
    const createdIds = attachments.map((attachment) => attachment?.id).filter((id) => id && !originalIds.has(id));
    if (createdIds.length > 0) await attachmentRuntime.releaseAttachments(createdIds, context).catch(() => {});
    return { attachments: [], modelImages: [], mediaParts: [], errors };
  }
  const originalIds = new Set(attachmentIds);
  const rollbackAttachmentIds = attachments
    .map((attachment) => attachment?.id)
    .filter((id) => id && !originalIds.has(id));
  return {
    attachments,
    modelImages,
    mediaParts,
    errors,
    pendingUploads: [...new Map(pendingUploads.map((item) => [item.id, item])).values()],
    rollbackAttachmentIds: [...new Set(rollbackAttachmentIds)],
  };
}
