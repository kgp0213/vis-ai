import { readFile, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep, extname } from "node:path";

import { mediaFailure } from "./media-errors.mjs";

const DEFAULT_MAX_FILE_BYTES = 50 * 1024 * 1024;
const DEFAULT_MAX_DECODED_BYTES = 100 * 1024 * 1024;
const DEFAULT_MAX_PIXELS = 40_000_000;
const DEFAULT_MAX_LONG_EDGE = 2000;
const DEFAULT_MAX_SEND_BYTES = 10 * 1024 * 1024;
const IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp", "image/tiff"]);
const DATA_URL_RE = /^data:([^;,\s]+)(?:;[^,]*)?;base64,([A-Za-z0-9+/=\r\n]+)$/i;

function text(value, fallback = "") {
  const result = String(value ?? "").trim();
  return result || fallback;
}

function isInside(root, candidate) {
  const relativePath = relative(resolve(root), resolve(candidate));
  return relativePath === "" || (relativePath !== ".." && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath));
}

function sniffImageMime(bytes) {
  if (!Buffer.isBuffer(bytes)) return null;
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes.length >= 3 && bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return "image/jpeg";
  if (bytes.length >= 6 && /^(?:GIF87a|GIF89a)$/.test(bytes.subarray(0, 6).toString("ascii"))) return "image/gif";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (bytes.length >= 2 && bytes.subarray(0, 2).equals(Buffer.from([66, 77]))) return "image/bmp";
  if (bytes.length >= 4 && (bytes.subarray(0, 4).equals(Buffer.from([73, 73, 42, 0])) || bytes.subarray(0, 4).equals(Buffer.from([77, 77, 0, 42])))) return "image/tiff";
  return null;
}

function dimensionsFromHeader(bytes, mimeType) {
  try {
    if (mimeType === "image/png" && bytes.length >= 24) {
      return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    }
    if (mimeType === "image/gif" && bytes.length >= 10) {
      return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
    }
    if (mimeType === "image/bmp" && bytes.length >= 26) {
      return { width: Math.abs(bytes.readInt32LE(18)), height: Math.abs(bytes.readInt32LE(22)) };
    }
  } catch {}
  return null;
}

function normalizeRegion(region) {
  if (region == null) return null;
  if (!region || typeof region !== "object") throw new Error("region must be an object with x, y, width and height");
  const values = [region.x, region.y, region.width, region.height].map((value) => Number(value));
  if (values.some((value) => !Number.isFinite(value) || value < 0)) throw new Error("region coordinates must be non-negative numbers");
  const [x, y, width, height] = values.map((value) => Math.floor(value));
  if (width < 1 || height < 1) throw new Error("region width and height must be positive");
  return { x, y, width, height };
}

function errorResult(code, message, retryable = false, extra = {}) {
  return { ok: false, error: mediaFailure(code, message, { retryable, ...extra }) };
}

function contextError(context, code, message, retryable = false, extra = {}) {
  return errorResult(code, message, retryable, {
    operationId: context?.operationId ?? null,
    toolCallId: context?.toolCallId ?? null,
    ...extra,
  });
}

function bytesFromImageDataUrl(value, maxBytes) {
  const match = DATA_URL_RE.exec(String(value ?? "").trim());
  if (!match) throw new Error("图片不是有效的 Base64 Data URL");
  const base64 = match[2].replace(/\s+/g, "");
  const maxBase64Chars = Math.ceil(maxBytes / 3) * 4 + 4;
  if (base64.length > maxBase64Chars) throw new Error(`图片超过 ${Math.floor(maxBytes / 1024 / 1024)} MB 安全限制`);
  if (base64.length % 4 === 1 || !/^[A-Za-z0-9+/=]+$/.test(base64)) throw new Error("图片 Base64 内容无效");
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0) throw new Error("图片内容为空");
  if (bytes.length > maxBytes) throw new Error(`图片超过 ${Math.floor(maxBytes / 1024 / 1024)} MB 安全限制`);
  return bytes;
}

/**
 * Server-side media boundary. It validates bytes before they enter the model
 * loop and delegates optional decoding/derivation to an injected adapter.
 */
export function createMediaRuntime({
  attachmentRuntime,
  workspaceRoot,
  readFileImpl = readFile,
  statImpl = stat,
  decodeImage = null,
  maxFileBytes = DEFAULT_MAX_FILE_BYTES,
  maxDecodedBytes = DEFAULT_MAX_DECODED_BYTES,
  maxPixels = DEFAULT_MAX_PIXELS,
  maxLongEdge = DEFAULT_MAX_LONG_EDGE,
  maxSendBytes = DEFAULT_MAX_SEND_BYTES,
} = {}) {
  if (!attachmentRuntime || typeof attachmentRuntime.ingestBytes !== "function") throw new TypeError("media runtime attachmentRuntime is required");
  if (!workspaceRoot) throw new TypeError("media runtime workspaceRoot is required");

  async function processImageBytes(bytes, args = {}, context = {}) {
    const inputPath = text(args.path, text(args.name, "image"));
    const fail = (code, message, retryable = false, extra = {}) => errorResult(code, message, retryable, {
      operationId: context.operationId ?? null,
      toolCallId: context.toolCallId ?? null,
      ...extra,
    });
    if (!Buffer.isBuffer(bytes) || bytes.length === 0) return fail("media_decode_failed", "图片内容为空。", false, { path: inputPath });
    if (bytes.length > maxDecodedBytes) return fail("media_too_large", `图片解码输入超过 ${Math.floor(maxDecodedBytes / 1024 / 1024)} MB 安全限制。`, false, { size: bytes.length, path: inputPath });

    const mimeType = sniffImageMime(bytes);
    if (!mimeType || !IMAGE_MIME_TYPES.has(mimeType)) {
      return fail("media_format_unsupported", "文件内容不是受支持的图片格式；扩展名不能代替实际格式校验。", false, { path: inputPath, extension: extname(inputPath).toLowerCase() });
    }
    const headerDimensions = dimensionsFromHeader(bytes, mimeType);
    let dimensions = headerDimensions;
    let decoded = null;
    if (typeof decodeImage === "function") {
      try {
        decoded = await decodeImage(bytes, mimeType);
        if (decoded?.width && decoded?.height) dimensions = { width: decoded.width, height: decoded.height };
      } catch (error) {
        return fail("media_decode_failed", `图片解码失败：${error?.message || error}`, false, { path: inputPath, mimeType });
      }
    }
    if (!dimensions) {
      return fail("media_decode_failed", "当前运行环境无法确认图片尺寸，已拒绝将未经像素预算校验的图片发送给模型。", true, { path: inputPath, mimeType });
    }
    const decodedBytes = dimensions.width * dimensions.height * 4;
    if (dimensions.width * dimensions.height > maxPixels || decodedBytes > maxDecodedBytes) {
      return fail("media_too_large", "图片解码后的像素或内存占用超过安全限制。", false, { width: dimensions.width, height: dimensions.height, decodedBytes, maxPixels, maxDecodedBytes, path: inputPath });
    }

    const originalDimensions = { ...dimensions };

    const region = normalizeRegion(args.region);
    if (region && dimensions && (region.x + region.width > dimensions.width || region.y + region.height > dimensions.height)) {
      return fail("media_region_invalid", "region 超出了图片边界。", false, { width: dimensions.width, height: dimensions.height, region });
    }
    const fullResolution = args.full_resolution === true;
    if (fullResolution && bytes.length > maxSendBytes) {
      return fail("media_too_large", `原图超过 ${Math.floor(maxSendBytes / 1024 / 1024)} MB 发送预算；请关闭 full_resolution 或使用 region。`, false, { size: bytes.length, maxSendBytes, path: inputPath });
    }
    let derivedBytes = bytes;
    let derivedMime = mimeType;
    let qualityLoss = false;
    const requiresDerivation = mimeType === "image/gif"
      || (!fullResolution && (bytes.length > maxSendBytes || region || (dimensions && Math.max(dimensions.width, dimensions.height) > maxLongEdge)));
    if (requiresDerivation) {
      if (!decoded?.derive) {
        return fail("media_decode_failed", "当前运行环境缺少可用的图片派生解码器，无法安全完成压缩或区域裁剪。", true, { path: inputPath });
      }
      try {
        const deriveLongEdge = fullResolution && dimensions ? Math.max(dimensions.width, dimensions.height) : maxLongEdge;
        const derived = await decoded.derive({ region, maxLongEdge: deriveLongEdge, maxBytes: maxSendBytes, mimeType });
        if (derived?.bytes?.length > 0) {
          derivedBytes = Buffer.from(derived.bytes);
          derivedMime = text(derived.mimeType, mimeType);
          qualityLoss = true;
          if (derived.width && derived.height) dimensions = { width: derived.width, height: derived.height };
        }
      } catch (error) {
        return fail("media_decode_failed", `图片派生版本生成失败：${error?.message || error}`, true, { path: inputPath });
      }
      if (derivedBytes.length > maxSendBytes) {
        return fail("media_too_large", `图片发送版本仍超过 ${Math.floor(maxSendBytes / 1024 / 1024)} MB 预算，请使用更小的图片或 region。`, false, { size: derivedBytes.length, maxSendBytes, path: inputPath });
      }
    }

    const attachment = context.existingAttachment && context.rebind !== true ? context.existingAttachment : await attachmentRuntime.ingestBytes(bytes, {
      kind: "image",
      mimeType,
      name: text(args.name, inputPath.split(/[\\/]/).pop() || "image"),
      operationId: context.operationId,
      sessionId: context.sessionId,
      workspace: context.workspace ?? workspaceRoot,
    });
    const dataUrl = `data:${derivedMime};base64,${derivedBytes.toString("base64")}`;
    return {
      ok: true,
      attachment,
      dataUrl,
      media: {
        mimeType: derivedMime,
        originalMimeType: mimeType,
        originalSize: bytes.length,
        sendSize: derivedBytes.length,
        originalWidth: originalDimensions.width,
        originalHeight: originalDimensions.height,
        sendWidth: dimensions.width,
        sendHeight: dimensions.height,
        width: dimensions.width,
        height: dimensions.height,
        region,
        fullResolution,
        qualityLoss,
      },
    };
  }

  async function readMedia(args = {}, context = {}) {
    const inputPath = text(args.path);
    if (!inputPath) return contextError(context, "media_not_found", "未提供图片路径。", false);
    const candidate = isAbsolute(inputPath) ? resolve(inputPath) : resolve(workspaceRoot, inputPath);
    const trustedPaths = Array.isArray(context.trustedPaths) ? context.trustedPaths.map((value) => resolve(value)) : [];
    if (!isInside(workspaceRoot, candidate) && !trustedPaths.includes(candidate)) {
      return contextError(context, "media_not_found", "图片路径不在当前工作区内，无法读取。", false, { path: inputPath });
    }
    if (context.signal?.aborted) return contextError(context, "media_read_cancelled", "图片读取已取消。", true);

    let info;
    let bytes;
    try {
      info = await statImpl(candidate);
      if (!info.isFile()) return contextError(context, "media_not_found", "指定路径不是文件。", false, { path: inputPath });
      if (info.size > maxFileBytes) return contextError(context, "media_too_large", `图片文件超过 ${Math.floor(maxFileBytes / 1024 / 1024)} MB 安全限制。`, false, { size: info.size, path: inputPath });
      bytes = await readFileImpl(candidate);
    } catch (error) {
      return contextError(context, "media_not_found", `图片读取失败：${error?.message || error}`, true, { path: inputPath });
    }
    return processImageBytes(bytes, { ...args, path: candidate }, context);
  }

  async function readAttachment(args = {}, context = {}) {
    const attachmentId = text(args.attachmentId ?? args.attachment_id);
    if (!attachmentId) return contextError(context, "media_not_found", "未提供 attachmentId。", false);
    const attachment = await attachmentRuntime.get(attachmentId);
    if (!attachment) return contextError(context, "media_not_found", `附件 ${attachmentId} 不存在。`, false, { attachmentId });
    if (attachment.missing) return contextError(context, "media_blob_missing", `附件 ${attachmentId} 的 Blob 不存在。`, false, { attachmentId });
    if (attachment.kind !== "image") return contextError(context, "media_format_unsupported", `附件 ${attachmentId} 不是图片。`, false, { attachmentId });
    if (attachment.sessionId && context.sessionId && attachment.sessionId !== context.sessionId) {
      return contextError(context, "media_not_found", "附件不属于当前会话，已拒绝跨会话读取。", false, { attachmentId });
    }
    if (attachment.workspace && context.workspace && resolve(attachment.workspace) !== resolve(context.workspace)) {
      return contextError(context, "media_not_found", "附件不属于当前工作区，已拒绝跨工作区读取。", false, { attachmentId });
    }
    if (context.signal?.aborted) return contextError(context, "media_read_cancelled", "图片读取已取消。", true, { attachmentId });
    const bytes = await attachmentRuntime.readBytes(attachmentId);
    if (!bytes) return contextError(context, "media_blob_missing", `附件 ${attachmentId} 的 Blob 无法读取。`, true, { attachmentId });
    return processImageBytes(bytes, { ...args, path: attachment.name }, { ...context, existingAttachment: attachment });
  }

  async function readImageData(args = {}, context = {}) {
    const base64 = text(args.data).replace(/\s+/g, "");
    if (!base64) return contextError(context, "media_decode_failed", "MCP 图片内容为空。", false);
    const maxBase64Chars = Math.ceil(maxFileBytes / 3) * 4 + 4;
    if (base64.length > maxBase64Chars) {
      return contextError(context, "media_too_large", `MCP 图片超过 ${Math.floor(maxFileBytes / 1024 / 1024)} MB 安全限制。`, false);
    }
    if (base64.length % 4 === 1 || !/^[A-Za-z0-9+/=]+$/.test(base64)) {
      return contextError(context, "media_decode_failed", "MCP 图片 Base64 内容无效。", false);
    }
    const bytes = Buffer.from(base64, "base64");
    if (bytes.length > maxFileBytes) {
      return contextError(context, "media_too_large", `MCP 图片超过 ${Math.floor(maxFileBytes / 1024 / 1024)} MB 安全限制。`, false, { size: bytes.length });
    }
    return processImageBytes(bytes, { ...args, path: text(args.name, "mcp-image") }, context);
  }

  async function prepareInputDataUrls(dataUrls, context = {}) {
    const attachments = [];
    const modelImages = [];
    const media = [];
    const errors = [];
    for (const [index, dataUrl] of (Array.isArray(dataUrls) ? dataUrls : []).entries()) {
      try {
        const bytes = bytesFromImageDataUrl(dataUrl, maxFileBytes);
        const result = await processImageBytes(bytes, {
          name: text(context.names?.[index], `image-${index + 1}`),
        }, context);
        if (!result.ok) {
          errors.push({ index, error: result.error });
          continue;
        }
        attachments.push(result.attachment);
        modelImages.push(result.dataUrl);
        media.push(result.media);
      } catch (error) {
        errors.push({ index, error: mediaFailure("media_decode_failed", error?.message || error, { operationId: context.operationId ?? null, toolCallId: context.toolCallId ?? null }) });
      }
    }
    return { attachments, modelImages, media, errors };
  }

  return { prepareInputDataUrls, readAttachment, readImageData, readMedia };
}

export {
  DEFAULT_MAX_FILE_BYTES,
  DEFAULT_MAX_DECODED_BYTES,
  DEFAULT_MAX_PIXELS,
  DEFAULT_MAX_LONG_EDGE,
  DEFAULT_MAX_SEND_BYTES,
  dimensionsFromHeader,
  isInside,
  sniffImageMime,
  bytesFromImageDataUrl,
};
