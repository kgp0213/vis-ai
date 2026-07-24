function jsonError(status, code, title, message) {
  const body = JSON.stringify({
    error: message,
    code,
    title,
    message,
    retryable: false,
    action: "重新上传附件或恢复包含该附件的会话",
  });
  return {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-length": String(Buffer.byteLength(body)),
      "cache-control": "no-store",
    },
    body,
  };
}

export function parseSingleByteRange(header, size) {
  if (!Number.isSafeInteger(size) || size < 1) return null;
  if (header == null || String(header).trim() === "") return { start: 0, end: size - 1, partial: false };
  const match = /^bytes=(\d*)-(\d*)$/i.exec(String(header).trim());
  if (!match || (!match[1] && !match[2])) return null;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    return { start: Math.max(0, size - suffix), end: size - 1, partial: true };
  }
  const start = Number(match[1]);
  if (!Number.isSafeInteger(start) || start < 0 || start >= size) return null;
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(requestedEnd) || requestedEnd < start) return null;
  return { start, end: Math.min(requestedEnd, size - 1), partial: true };
}

export async function createAttachmentContentResponse(attachmentRuntime, {
  id,
  method = "GET",
  range = null,
  ifNoneMatch = null,
  context = {},
  signal = null,
} = {}) {
  if (!attachmentRuntime || typeof attachmentRuntime.getContentDescriptor !== "function"
    || typeof attachmentRuntime.readRange !== "function") {
    throw new TypeError("attachment content runtime is required");
  }
  const descriptor = await attachmentRuntime.getContentDescriptor(id, context);
  if (!descriptor) {
    return jsonError(404, "media_blob_missing", "附件不可用", "附件不存在、已损坏或不属于当前会话。");
  }
  const baseHeaders = {
    "content-type": descriptor.mimeType,
    "accept-ranges": "bytes",
    etag: descriptor.etag,
    "cache-control": "private, max-age=0, must-revalidate",
  };
  if (ifNoneMatch && String(ifNoneMatch).trim() === descriptor.etag) {
    return { status: 304, headers: baseHeaders, body: null };
  }
  const parsedRange = parseSingleByteRange(range, descriptor.size);
  if (!parsedRange) {
    return {
      status: 416,
      headers: { ...baseHeaders, "content-range": `bytes */${descriptor.size}`, "content-length": "0" },
      body: null,
    };
  }
  const length = parsedRange.end - parsedRange.start + 1;
  const headers = {
    ...baseHeaders,
    "content-length": String(length),
    ...(parsedRange.partial ? { "content-range": `bytes ${parsedRange.start}-${parsedRange.end}/${descriptor.size}` } : {}),
  };
  if (String(method).toUpperCase() === "HEAD") {
    return { status: parsedRange.partial ? 206 : 200, headers, body: null };
  }
  const body = await attachmentRuntime.readRange(id, parsedRange.start, parsedRange.end, context, signal);
  if (!body) return jsonError(404, "media_blob_missing", "附件不可用", "附件读取期间丢失或已损坏。");
  return { status: parsedRange.partial ? 206 : 200, headers, body };
}
