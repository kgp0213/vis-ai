import { createHash } from "node:crypto";

import { mediaFailure } from "./media-errors.mjs";

function modalities(model) {
  const values = model?.capabilities?.inputModalities;
  return Array.isArray(values) ? values : model?.multimodal === true ? ["text", "image"] : ["text"];
}

function providerKey(provider, model, attachment) {
  const credential = createHash("sha256").update(String(provider?.apiKey ?? "")).digest("hex").slice(0, 16);
  return [
    provider?.id || provider?.name || "provider",
    provider?.providerType || "openai-compatible",
    String(provider?.baseUrl ?? "").trim(),
    credential,
    model?.id || "model",
    attachment?.sha256 || attachment?.id || "attachment",
  ].join("\n");
}

function statusFromError(error) {
  const direct = Number(error?.status || error?.statusCode);
  if (Number.isInteger(direct)) return direct;
  const match = String(error?.message ?? error ?? "").match(/(?:API|HTTP)\s+(\d{3})/i);
  return match ? Number(match[1]) : null;
}

/** Provider request boundary; it never creates or invokes a model loop. */
export function createMediaProviderAdapter({ attachmentRuntime, videoUploaders = {} } = {}) {
  if (!attachmentRuntime || typeof attachmentRuntime.readDataUrl !== "function") throw new TypeError("media provider adapter attachmentRuntime is required");
  const videoCache = new Map();

  async function uploadVideo(input, model, operation = {}, signal = null) {
    const provider = operation.provider ?? input.provider;
    const attachment = input.attachment ?? input;
    if (signal?.aborted) {
      return { ok: false, error: mediaFailure("media_read_cancelled", "视频上传已取消。", { retryable: true, affectsCompleteness: false, attachmentId: attachment?.id, operationId: operation?.id }) };
    }
    if (!modalities(model).includes("video")) {
      return { ok: false, error: mediaFailure("media_provider_unsupported", `模型 ${model?.id || "unknown"} 未声明视频输入能力。`, { attachmentId: attachment?.id, operationId: operation?.id }) };
    }
    if (provider?.providerType !== "kimi") {
      return { ok: false, error: mediaFailure("media_provider_unsupported", "只有显式配置为官方 Kimi 的 Provider 才能使用视频上传。", { attachmentId: attachment?.id, operationId: operation?.id }) };
    }
    const uploader = videoUploaders.kimi;
    if (typeof uploader !== "function") {
      return { ok: false, error: mediaFailure("media_provider_unsupported", "当前 Provider 没有经过验证的视频上传适配器。", { attachmentId: attachment?.id, operationId: operation?.id }) };
    }
    const key = providerKey(provider, model, attachment);
    if (videoCache.has(key)) return { ok: true, reference: videoCache.get(key), cached: true };
    try {
      const reference = await uploader({ attachment, model, provider, operation, signal });
      if (signal?.aborted) {
        return { ok: false, error: mediaFailure("media_read_cancelled", "视频上传已取消。", { retryable: true, affectsCompleteness: false, attachmentId: attachment?.id, operationId: operation?.id }) };
      }
      if (!reference?.type || !reference?.video_url?.url) throw new Error("provider returned an invalid video reference");
      videoCache.set(key, reference);
      return { ok: true, reference, cached: false };
    } catch (error) {
      const status = statusFromError(error);
      if (status === 401 || status === 403) {
        return { ok: false, error: mediaFailure("media_provider_auth_failed", error?.message || "视频上传鉴权失败。", { attachmentId: attachment?.id, operationId: operation?.id }) };
      }
      if (error?.name === "AbortError" || signal?.aborted) {
        return { ok: false, error: mediaFailure("media_read_cancelled", "视频上传已取消。", { retryable: true, affectsCompleteness: false, attachmentId: attachment?.id, operationId: operation?.id }) };
      }
      return { ok: false, error: mediaFailure("media_upload_failed", error?.message || "视频上传失败。", { retryable: true, affectsCompleteness: error?.name === "AbortError" ? false : undefined, attachmentId: attachment?.id, operationId: operation?.id }) };
    }
  }

  async function resolveMedia(parts, model, operation = {}, signal = null) {
    const ready = [];
    const warnings = [];
    const inputModalities = modalities(model);
    for (const part of Array.isArray(parts) ? parts : []) {
      if (!part?.attachment) {
        ready.push(part);
        continue;
      }
      const attachment = part.attachment;
      if (attachment.kind === "image") {
        if (!inputModalities.includes("image") || model?.capabilities?.protocol && model.capabilities.protocol !== "openai-chat-completions") {
          warnings.push(mediaFailure("media_provider_unsupported", "当前模型请求协议不支持该图片。", { attachmentId: attachment.id, operationId: operation?.id }));
          continue;
        }
        const dataUrl = await attachmentRuntime.readDataUrl(attachment.id);
        if (!dataUrl) {
          warnings.push(mediaFailure("media_blob_missing", "图片附件 Blob 不存在。", { attachmentId: attachment.id, operationId: operation?.id }));
          continue;
        }
        ready.push({ type: "image_url", image_url: { url: dataUrl } });
        continue;
      }
      if (attachment.kind === "video") {
        const uploaded = await uploadVideo({ attachment, provider: operation.provider }, model, operation, signal);
        if (uploaded.ok) ready.push(uploaded.reference);
        else warnings.push(uploaded.error);
        continue;
      }
      warnings.push(mediaFailure("media_provider_unsupported", `当前版本不发送 ${attachment.kind || "未知"} 媒体。`, { attachmentId: attachment.id, operationId: operation?.id }));
    }
    return { parts: ready, warnings };
  }

  return { resolveMedia, uploadVideo, clearVideoCache: () => videoCache.clear() };
}
