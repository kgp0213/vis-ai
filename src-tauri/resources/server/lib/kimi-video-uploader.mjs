function filesEndpoint(baseUrl) {
  const url = new URL(String(baseUrl ?? "").trim());
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  const path = url.pathname.replace(/\/+$/, "");
  url.pathname = /\/chat\/completions$/i.test(path)
    ? path.replace(/\/chat\/completions$/i, "/files")
    : /\/files$/i.test(path) ? path : `${path}/files`;
  return url.toString();
}

function httpError(statusCode, message) {
  const error = new Error(String(message || `Kimi Files API HTTP ${statusCode}`));
  error.statusCode = statusCode;
  return error;
}

async function responseMessage(response) {
  const text = await response.text().catch(() => "");
  if (!text) return `Kimi Files API HTTP ${response.status}`;
  try {
    const parsed = JSON.parse(text);
    return String(parsed?.error?.message || parsed?.message || `Kimi Files API HTTP ${response.status}`);
  } catch {
    return `Kimi Files API HTTP ${response.status}`;
  }
}

/** Official Moonshot Files API adapter. It only uploads an already-bound attachment. */
export function createOfficialKimiVideoUploader({ attachmentRuntime, fetchImpl = globalThis.fetch } = {}) {
  if (!attachmentRuntime || typeof attachmentRuntime.readBytes !== "function") {
    throw new TypeError("Kimi video uploader attachmentRuntime is required");
  }
  if (typeof fetchImpl !== "function") throw new TypeError("Kimi video uploader fetch implementation is required");

  return async function uploadOfficialKimiVideo({ attachment, provider, signal } = {}) {
    if (signal?.aborted) throw new DOMException("video upload aborted", "AbortError");
    const apiKey = String(provider?.apiKey ?? "").trim();
    if (!apiKey) throw httpError(401, "官方 Kimi API Key 未配置");
    const bytes = await attachmentRuntime.readBytes(attachment?.id);
    if (!bytes) throw new Error(`视频附件 ${attachment?.id || "unknown"} 的 Blob 不存在`);

    const body = new FormData();
    body.append("purpose", "video");
    body.append("file", new File([bytes], attachment?.name || "video.mp4", {
      type: attachment?.mimeType || "application/octet-stream",
    }));
    const response = await fetchImpl(filesEndpoint(provider?.baseUrl), {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body,
      signal,
    });
    if (!response.ok) throw httpError(response.status, await responseMessage(response));
    const payload = await response.json().catch(() => null);
    const fileId = String(payload?.id ?? "").trim();
    if (!fileId) throw new Error("Kimi Files API 未返回文件 ID");
    return { type: "video_url", video_url: { url: `ms://${fileId}` } };
  };
}

export { filesEndpoint as resolveKimiFilesEndpoint };
