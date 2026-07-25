import { createHash, randomUUID } from "node:crypto";
import { appendFile, mkdir, open as openFile, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const INDEX_VERSION = 1;
const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
const DEFAULT_UPLOAD_TTL_MS = 10 * 60 * 1000;
const DEFAULT_ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;
const DATA_URL_RE = /^data:([^;,\s]+)(?:;[^,]*)?;base64,([A-Za-z0-9+/=\r\n]+)$/i;
const IMAGE_MIME_RE = /^image\/[A-Za-z0-9.+-]+$/i;

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function safeString(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function attachmentId() {
  return `att_${randomUUID()}`;
}

function uploadId() {
  return `upload_${randomUUID()}`;
}

function hashBytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizeMime(value) {
  const mime = safeString(value, "application/octet-stream").toLowerCase();
  return /^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/.test(mime)
    ? mime
    : "application/octet-stream";
}

function sniffImageMime(bytes) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes.length >= 3 && bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return "image/jpeg";
  if (bytes.length >= 6 && (bytes.subarray(0, 6).toString("ascii") === "GIF87a" || bytes.subarray(0, 6).toString("ascii") === "GIF89a")) return "image/gif";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (bytes.length >= 2 && bytes.subarray(0, 2).equals(Buffer.from([66, 77]))) return "image/bmp";
  if (bytes.length >= 4 && (bytes.subarray(0, 4).equals(Buffer.from([73, 73, 42, 0])) || bytes.subarray(0, 4).equals(Buffer.from([77, 77, 0, 42])))) return "image/tiff";
  return null;
}

function sniffVideoMime(bytes) {
  if (bytes.length >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp") {
    return bytes.subarray(8, 12).toString("ascii") === "qt  " ? "video/quicktime" : "video/mp4";
  }
  if (bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
    return "video/webm";
  }
  return null;
}

function parseDataUrl(value, maxBytes) {
  const match = DATA_URL_RE.exec(String(value ?? "").trim());
  if (!match) throw new Error("附件不是有效的 Base64 Data URL");
  const declaredMime = normalizeMime(match[1]);
  if (!IMAGE_MIME_RE.test(declaredMime)) throw new Error(`暂不支持的附件类型: ${declaredMime}`);
  const base64 = match[2].replace(/\s+/g, "");
  const maxBase64Chars = Math.ceil(maxBytes / 3) * 4 + 4;
  if (base64.length > maxBase64Chars) throw new Error(`附件超过 ${Math.floor(maxBytes / 1024 / 1024)} MB 限制`);
  if (base64.length % 4 === 1) throw new Error("附件 Base64 内容无效");
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0) throw new Error("附件内容为空");
  if (bytes.length > maxBytes) throw new Error(`附件超过 ${Math.floor(maxBytes / 1024 / 1024)} MB 限制`);
  const detectedMime = sniffImageMime(bytes);
  if (!detectedMime) throw new Error("附件实际格式不是受支持的图片");
  return { bytes, mimeType: detectedMime };
}

function normalizeContext(context = {}) {
  return {
    operationId: safeString(context.operationId) || null,
    sessionId: safeString(context.sessionId) || null,
    workspace: safeString(context.workspace) || null,
  };
}

function recordForPublic(record) {
  const { refs: _refs, ...publicRecord } = record;
  return clone(publicRecord);
}

function recordForStorage(record) {
  return clone(record);
}

function normalizeRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const id = safeString(value.id);
  const hash = safeString(value.sha256).toLowerCase();
  const mimeType = normalizeMime(value.mimeType);
  const source = value.source && typeof value.source === "object" ? value.source : null;
  if (!/^att_[0-9a-f-]{20,}$/i.test(id) || !/^[a-f0-9]{64}$/i.test(hash)) return null;
  if (!source || source.kind !== "blob" || typeof source.ref !== "string") return null;
  if (!Number.isSafeInteger(value.size) || value.size < 1 || value.size > MAX_ATTACHMENT_BYTES) return null;
  return {
    version: 1,
    id,
    kind: safeString(value.kind, mimeType.startsWith("image/") ? "image" : "file"),
    mimeType,
    name: safeString(value.name, `${id}.${mimeType.split("/")[1] || "bin"}`),
    size: value.size,
    sha256: hash,
    source: { kind: "blob", ref: source.ref },
    createdAt: safeString(value.createdAt, new Date(0).toISOString()),
    operationId: safeString(value.operationId) || null,
    sessionId: safeString(value.sessionId) || null,
    workspace: safeString(value.workspace) || null,
    refs: Array.isArray(value.refs) ? value.refs.filter((ref) => ref && typeof ref === "object").map((ref) => ({
      sessionId: safeString(ref.sessionId) || null,
      operationId: safeString(ref.operationId) || null,
    })) : [],
  };
}

/**
 * Owns user media outside conversation JSONL. The model loop only receives
 * materialized data URLs at request time; sessions persist attachment refs.
 */
export function createAttachmentRuntime({
  rootDir,
  atomicWriteFile,
  now = () => new Date(),
  maxBytes = MAX_ATTACHMENT_BYTES,
  uploadTtlMs = DEFAULT_UPLOAD_TTL_MS,
} = {}) {
  if (!rootDir) throw new TypeError("attachment runtime rootDir is required");
  if (typeof atomicWriteFile !== "function") throw new TypeError("attachment runtime atomicWriteFile is required");

  const root = resolve(rootDir);
  const blobDir = resolve(root, "blobs");
  const metadataDir = resolve(root, "metadata");
  const uploadDir = resolve(root, "uploads");
  const indexPath = resolve(root, "index.json");
  const records = new Map();
  const byHash = new Map();
  const uploads = new Map();
  const effectiveUploadTtlMs = Number.isFinite(uploadTtlMs) && uploadTtlMs > 0
    ? Math.floor(uploadTtlMs)
    : DEFAULT_UPLOAD_TTL_MS;
  let loaded = false;
  let loading = null;
  let persistTail = Promise.resolve();

  function registerRecord(record) {
    records.set(record.id, record);
    const ids = byHash.get(record.sha256) ?? new Set();
    ids.add(record.id);
    byHash.set(record.sha256, ids);
  }

  function metadataPath(id) {
    if (!/^att_[0-9a-f-]{20,}$/i.test(id)) throw new Error("invalid attachment id");
    return resolve(metadataDir, `${id}.json`);
  }

  function indexSnapshot(snapshotRecords = [...records.values()]) {
    return `${JSON.stringify({ version: INDEX_VERSION, attachments: snapshotRecords.map(recordForStorage) }, null, 2)}\n`;
  }

  async function ensureLoaded() {
    if (loaded) return;
    if (loading) return loading;
    loading = (async () => {
      await mkdir(blobDir, { recursive: true });
      await mkdir(metadataDir, { recursive: true });
      await rm(uploadDir, { recursive: true, force: true });
      await mkdir(uploadDir, { recursive: true });
      let validIndex = false;
      try {
        const parsed = JSON.parse(await readFile(indexPath, "utf8"));
        if (parsed?.version === INDEX_VERSION && Array.isArray(parsed.attachments)) {
          const normalized = parsed.attachments.map(normalizeRecord);
          if (normalized.every(Boolean)) {
            validIndex = true;
            for (const record of normalized) registerRecord(record);
          }
        }
      } catch {
        // A missing or corrupt index is recoverable; blobs are content-addressed.
      }
      if (!validIndex) {
        const entries = await readdir(metadataDir, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
          if (!entry.isFile() || !/^att_[0-9a-f-]{20,}\.json$/i.test(entry.name)) continue;
          try {
            const parsed = JSON.parse(await readFile(resolve(metadataDir, entry.name), "utf8"));
            const record = normalizeRecord(parsed?.attachment ?? parsed);
            if (record) registerRecord(record);
          } catch {}
        }
        if (records.size > 0) await atomicWriteFile(indexPath, indexSnapshot(), "utf8");
      }
      loaded = true;
    })().finally(() => { loading = null; });
    return loading;
  }

  function persist() {
    const snapshotRecords = [...records.values()].map(recordForStorage);
    const snapshotIds = new Set(snapshotRecords.map((record) => record.id));
    const snapshot = indexSnapshot(snapshotRecords);
    const write = persistTail.then(async () => {
      await mkdir(metadataDir, { recursive: true });
      for (const record of snapshotRecords) {
        await atomicWriteFile(metadataPath(record.id), `${JSON.stringify({ version: 1, attachment: record }, null, 2)}\n`, "utf8");
      }
      await atomicWriteFile(indexPath, snapshot, "utf8");
      const entries = await readdir(metadataDir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        const match = /^(att_[0-9a-f-]{20,})\.json$/i.exec(entry.name);
        if (entry.isFile() && match && !snapshotIds.has(match[1])) {
          await rm(resolve(metadataDir, entry.name), { force: true }).catch(() => {});
        }
      }
    });
    persistTail = write.catch(() => {});
    return write;
  }

  function blobPath(hash) {
    if (!/^[a-f0-9]{64}$/i.test(hash)) throw new Error("invalid attachment hash");
    return resolve(blobDir, hash.toLowerCase());
  }

  function clearUploadExpiry(upload) {
    if (!upload?.expiryTimer) return;
    clearTimeout(upload.expiryTimer);
    upload.expiryTimer = null;
  }

  async function discardUpload(upload) {
    if (!upload) return;
    clearUploadExpiry(upload);
    if (uploads.get(upload.id) === upload) uploads.delete(upload.id);
    await rm(upload.path, { force: true }).catch(() => {});
  }

  function armUploadExpiry(upload) {
    clearUploadExpiry(upload);
    upload.expiryTimer = setTimeout(() => {
      upload.cancelled = true;
      if (!upload.busy) void discardUpload(upload);
    }, effectiveUploadTtlMs);
    upload.expiryTimer.unref?.();
  }

  async function ingestDataUrls(dataUrls, context = {}) {
    await ensureLoaded();
    const output = [];
    const errors = [];
    for (const [index, dataUrl] of (Array.isArray(dataUrls) ? dataUrls : []).entries()) {
      try {
        const parsed = parseDataUrl(dataUrl, maxBytes);
        const record = await ingestBytes(parsed.bytes, {
          ...context,
          kind: "image",
          mimeType: parsed.mimeType,
          name: safeString(context.names?.[index]),
        });
        output.push(record);
      } catch (error) {
        errors.push({ index, error: String(error?.message || error) });
      }
    }
    await persist();
    return { attachments: output, errors };
  }

  async function ingestBytes(bytes, context = {}) {
    await ensureLoaded();
    const payload = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes ?? []);
    if (payload.length === 0) throw new Error("附件内容为空");
    if (payload.length > maxBytes) throw new Error(`附件超过 ${Math.floor(maxBytes / 1024 / 1024)} MB 限制`);
    const mimeType = normalizeMime(context.mimeType);
    const hash = hashBytes(payload);
    const normalizedContext = normalizeContext(context);
    const existingIds = byHash.get(hash) ?? new Set();
    let record = [...existingIds]
      .map((id) => records.get(id))
      .find((candidate) => candidate?.refs.some((ref) => ref.sessionId === normalizedContext.sessionId && ref.operationId === normalizedContext.operationId));
    if (!record) {
      const id = attachmentId();
      const path = blobPath(hash);
      try { await stat(path); } catch {
        await writeFile(path, payload, { flag: "wx" }).catch((error) => {
          if (error.code !== "EEXIST") throw error;
        });
      }
      record = {
        version: 1,
        id,
        kind: safeString(context.kind, mimeType.startsWith("image/") ? "image" : "file"),
        mimeType,
        name: safeString(context.name, `${id}.${mimeType.split("/")[1] || "bin"}`),
        size: payload.length,
        sha256: hash,
        source: { kind: "blob", ref: `blobref:${mimeType};${hash}` },
        createdAt: now().toISOString(),
        ...normalizedContext,
        refs: [],
      };
      records.set(id, record);
      existingIds.add(id);
      byHash.set(hash, existingIds);
    }
    const ref = { sessionId: normalizedContext.sessionId, operationId: normalizedContext.operationId };
    if (!record.refs.some((item) => item.sessionId === ref.sessionId && item.operationId === ref.operationId)) record.refs.push(ref);
    await persist();
    return recordForPublic(record);
  }

  async function get(id) {
    await ensureLoaded();
    const record = records.get(safeString(id));
    if (!record) return null;
    try {
      await stat(blobPath(record.sha256));
    } catch {
      return { ...recordForPublic(record), missing: true };
    }
    return recordForPublic(record);
  }

  async function readDataUrl(id) {
    const record = await get(id);
    if (!record || record.missing) return null;
    try {
      const bytes = await readFile(blobPath(record.sha256));
      return `data:${record.mimeType};base64,${bytes.toString("base64")}`;
    } catch {
      return null;
    }
  }

  async function readBytes(id) {
    const record = await get(id);
    if (!record || record.missing) return null;
    try {
      return await readFile(blobPath(record.sha256));
    } catch {
      return null;
    }
  }

  async function getContentDescriptor(id, context = {}) {
    await ensureLoaded();
    const record = records.get(safeString(id));
    if (!record) return null;
    const normalizedContext = normalizeContext(context);
    if (normalizedContext.sessionId) {
      const allowed = record.sessionId === normalizedContext.sessionId
        || record.refs.some((ref) => ref.sessionId === normalizedContext.sessionId);
      if (!allowed) return null;
    }
    if (normalizedContext.workspace && record.workspace) {
      const left = resolve(normalizedContext.workspace);
      const right = resolve(record.workspace);
      if ((process.platform === "win32" ? left.toLowerCase() !== right.toLowerCase() : left !== right)) return null;
    }
    const path = blobPath(record.sha256);
    try {
      const info = await stat(path);
      if (!info.isFile() || info.size !== record.size) return null;
    } catch {
      return null;
    }
    return {
      id: record.id,
      path,
      size: record.size,
      mimeType: record.mimeType,
      etag: `"${record.sha256}"`,
      name: record.name,
    };
  }

  /**
   * Add a session reference without copying the content-addressed blob. This
   * is used when a session is forked: the source session keeps its reference
   * and the fork receives an additional, independently scoped reference.
   */
  async function addSessionReference(id, {
    sourceSessionId = null,
    targetSessionId,
    operationId = null,
    workspace = null,
  } = {}) {
    await ensureLoaded();
    const target = safeString(targetSessionId);
    if (!target) return { ok: false, code: "SESSION_ID_REQUIRED", reason: "target session id is required" };
    const record = records.get(safeString(id));
    if (!record) return { ok: false, code: "ATTACHMENT_NOT_FOUND", reason: `attachment ${safeString(id)} was not found` };
    const source = safeString(sourceSessionId);
    if (source && record.sessionId !== source && !record.refs.some((ref) => ref.sessionId === source)) {
      return { ok: false, code: "ATTACHMENT_SOURCE_MISMATCH", reason: `attachment ${record.id} is not owned by source session` };
    }
    if (workspace && record.workspace) {
      const left = resolve(workspace);
      const right = resolve(record.workspace);
      if (process.platform === "win32" ? left.toLowerCase() !== right.toLowerCase() : left !== right) {
        return { ok: false, code: "ATTACHMENT_WORKSPACE_MISMATCH", reason: `attachment ${record.id} belongs to another workspace` };
      }
    }
    const ref = { sessionId: target, operationId: safeString(operationId) || null };
    if (!record.refs.some((item) => item.sessionId === ref.sessionId && item.operationId === ref.operationId)) {
      record.refs.push(ref);
      await persist();
    }
    return { ok: true, attachment: recordForPublic(record), reference: ref };
  }

  async function readRange(id, start, end, context = {}, signal = null) {
    if (signal?.aborted) throw new DOMException("attachment read aborted", "AbortError");
    const descriptor = await getContentDescriptor(id, context);
    if (!descriptor) return null;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end >= descriptor.size) {
      throw new RangeError("invalid attachment byte range");
    }
    const length = end - start + 1;
    const bytes = Buffer.allocUnsafe(length);
    const file = await openFile(descriptor.path, "r");
    try {
      let offset = 0;
      while (offset < length) {
        if (signal?.aborted) throw new DOMException("attachment read aborted", "AbortError");
        const result = await file.read(bytes, offset, length - offset, start + offset);
        if (result.bytesRead === 0) throw new Error("attachment ended before the requested range");
        offset += result.bytesRead;
      }
      if (signal?.aborted) throw new DOMException("attachment read aborted", "AbortError");
      return bytes;
    } finally {
      await file.close();
    }
  }

  async function sweepOrphans({
    referencedAttachmentIds = [],
    graceMs = DEFAULT_ORPHAN_GRACE_MS,
  } = {}) {
    await ensureLoaded();
    const referenced = new Set((Array.isArray(referencedAttachmentIds) ? referencedAttachmentIds : [])
      .map(safeString)
      .filter((id) => /^att_[0-9a-f-]{20,}$/i.test(id)));
    const grace = Number.isFinite(graceMs) && graceMs >= 0 ? Math.floor(graceMs) : DEFAULT_ORPHAN_GRACE_MS;
    const cutoff = now().getTime() - grace;
    let removedRecords = 0;
    let removedBlobs = 0;
    const orphanedHashes = new Set();
    for (const [id, record] of records) {
      const createdAt = Date.parse(record.createdAt);
      if (referenced.has(id) || !Number.isFinite(createdAt) || createdAt > cutoff) continue;
      records.delete(id);
      const ids = byHash.get(record.sha256);
      ids?.delete(id);
      if (!ids || ids.size === 0) {
        byHash.delete(record.sha256);
        orphanedHashes.add(record.sha256.toLowerCase());
      }
      removedRecords++;
    }
    if (removedRecords > 0) await persist();
    for (const hash of orphanedHashes) {
      await rm(blobPath(hash), { force: true }).catch(() => {});
      removedBlobs++;
    }
    const blobEntries = await readdir(blobDir, { withFileTypes: true }).catch(() => []);
    for (const entry of blobEntries) {
      if (!entry.isFile() || !/^[a-f0-9]{64}$/i.test(entry.name) || byHash.has(entry.name.toLowerCase())) continue;
      const path = resolve(blobDir, entry.name);
      const info = await stat(path).catch(() => null);
      if (!info || info.mtimeMs > cutoff) continue;
      await rm(path, { force: true }).catch(() => {});
      removedBlobs++;
    }
    return { removedRecords, removedBlobs, retainedRecords: records.size };
  }

  async function materialize(attachments) {
    const result = [];
    const warnings = [];
    for (const attachment of Array.isArray(attachments) ? attachments : []) {
      const id = typeof attachment === "string" ? attachment : attachment?.id;
      const dataUrl = await readDataUrl(id);
      if (dataUrl) result.push(dataUrl);
      else if (id) warnings.push(`附件 ${id} 不可用，原始媒体可能已被清理或损坏。`);
    }
    return { images: result, warnings };
  }

  async function migrateLegacySessionEntries(entries, context = {}) {
    const next = clone(Array.isArray(entries) ? entries : []);
    let migrated = 0;
    const errors = [];
    for (let index = 0; index < next.length; index++) {
      const entry = next[index];
      if (entry?.role !== "user" || entry.attachments?.length) continue;
      const legacyImages = [];
      const names = [];
      for (const image of Array.isArray(entry.images) ? entry.images : []) {
        const dataUrl = typeof image === "string" ? image : image?.dataUrl;
        if (typeof dataUrl === "string" && dataUrl.startsWith("data:image/")) {
          legacyImages.push(dataUrl);
          names.push(safeString(image?.name));
        }
      }
      if (Array.isArray(entry.content)) {
        for (const part of entry.content) {
          const dataUrl = part?.type === "image_url"
            ? part.image_url?.url
            : part?.type === "image" && part.source?.type === "base64"
              ? `data:${normalizeMime(part.source.media_type)};base64,${part.source.data || ""}`
              : null;
          if (typeof dataUrl === "string" && dataUrl.startsWith("data:image/")) {
            legacyImages.push(dataUrl);
            names.push("");
          }
        }
      }
      if (legacyImages.length === 0) continue;
      const ingested = await ingestDataUrls(legacyImages, { ...context, names });
      errors.push(...ingested.errors.map((error) => ({ entry: index, ...error })));
      if (ingested.attachments.length === 0) continue;
      entry.attachments = [...new Map(ingested.attachments.map((attachment) => [attachment.id, attachment])).values()];
      delete entry.images;
      if (Array.isArray(entry.content)) {
        const textParts = entry.content.filter((part) => part?.type === "text" && typeof part.text === "string");
        entry.content = textParts.map((part) => part.text).join("\n");
      }
      migrated++;
    }
    return { entries: next, migrated, errors };
  }

  async function releaseSession(sessionId) {
    await ensureLoaded();
    const target = safeString(sessionId);
    if (!target) return 0;
    let removed = 0;
    let changed = false;
    for (const [id, record] of records) {
      const previousRefs = record.refs.length;
      const previousOwner = record.sessionId;
      record.refs = record.refs.filter((ref) => ref.sessionId !== target);
      if (record.sessionId === target) record.sessionId = record.refs[0]?.sessionId || null;
      if (previousRefs !== record.refs.length || previousOwner !== record.sessionId) changed = true;
      if (record.refs.length > 0) continue;
      records.delete(id);
      const ids = byHash.get(record.sha256);
      ids?.delete(id);
      if (!ids || ids.size === 0) {
        byHash.delete(record.sha256);
        await rm(blobPath(record.sha256), { force: true }).catch(() => {});
      }
      removed++;
    }
    if (changed || removed > 0) await persist();
    return removed;
  }

  async function releaseAttachments(ids, context = {}) {
    await ensureLoaded();
    const requested = new Set((Array.isArray(ids) ? ids : [ids]).map(safeString).filter(Boolean));
    let removed = 0;
    for (const id of requested) {
      const record = records.get(id);
      if (!record) continue;
      const sessionId = safeString(context.sessionId);
      if (sessionId) {
        const ownsReference = record.sessionId === sessionId || record.refs.some((ref) => ref.sessionId === sessionId);
        if (!ownsReference) continue;
      } else if (record.refs.length > 1) {
        // Without a session scope, never delete a record that is shared by
        // multiple sessions. Callers with an explicit scope remove only
        // their own reference below.
        continue;
      }
      if (context.workspace && record.workspace && resolve(context.workspace) !== resolve(record.workspace)) continue;
      if (sessionId) {
        const before = record.refs.length;
        record.refs = record.refs.filter((ref) => ref.sessionId !== sessionId);
        if (record.sessionId === sessionId) record.sessionId = record.refs[0]?.sessionId || null;
        if (record.refs.length > 0 || record.sessionId) {
          if (before !== record.refs.length || record.sessionId === sessionId) removed++;
          continue;
        }
      }
      records.delete(id);
      const hashIds = byHash.get(record.sha256);
      hashIds?.delete(id);
      if (!hashIds || hashIds.size === 0) {
        byHash.delete(record.sha256);
        await rm(blobPath(record.sha256), { force: true }).catch(() => {});
      }
      removed++;
    }
    if (removed > 0) await persist();
    return removed;
  }

  async function releasePendingUploads(items) {
    await ensureLoaded();
    let removed = 0;
    for (const item of Array.isArray(items) ? items : []) {
      const id = safeString(item?.id);
      const sessionId = safeString(item?.sessionId);
      const workspace = safeString(item?.workspace);
      if (!id || !sessionId || !workspace) continue;
      const record = records.get(id);
      if (!record || !safeString(record.operationId).startsWith("upload:")) continue;
      if (record.sessionId !== sessionId || !record.workspace || resolve(record.workspace) !== resolve(workspace)) continue;
      records.delete(id);
      const hashIds = byHash.get(record.sha256);
      hashIds?.delete(id);
      if (!hashIds || hashIds.size === 0) {
        byHash.delete(record.sha256);
        await rm(blobPath(record.sha256), { force: true }).catch(() => {});
      }
      removed++;
    }
    if (removed > 0) await persist();
    return removed;
  }

  async function beginUpload(context = {}) {
    await ensureLoaded();
    const size = Number(context.size);
    if (!Number.isSafeInteger(size) || size < 1 || size > maxBytes) {
      throw new Error(`附件大小必须介于 1 字节和 ${Math.floor(maxBytes / 1024 / 1024)} MB 之间`);
    }
    const id = uploadId();
    const path = resolve(uploadDir, id);
    const normalizedContext = normalizeContext(context);
    if (!normalizedContext.operationId) normalizedContext.operationId = `upload:${id}`;
    await writeFile(path, Buffer.alloc(0), { flag: "wx" });
    const upload = {
      id,
      path,
      size,
      received: 0,
      name: safeString(context.name, "image"),
      mimeType: normalizeMime(context.mimeType),
      ...normalizedContext,
      busy: false,
      cancelled: false,
      expiryTimer: null,
    };
    uploads.set(id, upload);
    armUploadExpiry(upload);
    return {
      uploadId: id,
      chunkBytes: 512 * 1024,
      size,
      sessionId: normalizedContext.sessionId,
      workspace: normalizedContext.workspace,
    };
  }

  async function appendUpload(id, bytes, offset) {
    await ensureLoaded();
    const upload = uploads.get(safeString(id));
    if (!upload) throw new Error("附件上传不存在或已过期");
    if (upload.cancelled) throw new Error("附件上传已取消");
    if (upload.busy) throw new Error("附件上传正在处理上一分块");
    const payload = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes ?? []);
    if (payload.length === 0) throw new Error("附件上传分块为空");
    if (Number(offset) !== upload.received) throw new Error(`附件上传偏移不匹配，期望 ${upload.received}`);
    if (upload.received + payload.length > upload.size) throw new Error("附件上传内容超过声明大小");
    clearUploadExpiry(upload);
    upload.busy = true;
    try {
      await appendFile(upload.path, payload);
      upload.received += payload.length;
      if (upload.cancelled) throw new Error("附件上传已取消");
      return { uploadId: upload.id, received: upload.received, size: upload.size, complete: upload.received === upload.size };
    } finally {
      upload.busy = false;
      if (upload.cancelled) await discardUpload(upload);
      else if (uploads.get(upload.id) === upload) armUploadExpiry(upload);
    }
  }

  async function finishUpload(id) {
    await ensureLoaded();
    const upload = uploads.get(safeString(id));
    if (!upload) throw new Error("附件上传不存在或已过期");
    if (upload.cancelled) throw new Error("附件上传已取消");
    if (upload.busy) throw new Error("附件上传仍在写入");
    if (upload.received !== upload.size) throw new Error(`附件上传不完整：${upload.received}/${upload.size} 字节`);
    clearUploadExpiry(upload);
    upload.busy = true;
    try {
      const bytes = await readFile(upload.path);
      const detectedMime = sniffImageMime(bytes) ?? sniffVideoMime(bytes);
      if (!detectedMime) throw new Error("上传内容不是受支持的图片或视频格式");
      const attachment = await ingestBytes(bytes, {
        kind: detectedMime.startsWith("video/") ? "video" : "image",
        mimeType: detectedMime,
        name: upload.name,
        operationId: upload.operationId,
        sessionId: upload.sessionId,
        workspace: upload.workspace,
      });
      if (upload.cancelled) {
        await releaseAttachments([attachment.id], {
          sessionId: upload.sessionId,
          workspace: upload.workspace,
        });
        throw new Error("附件上传已取消");
      }
      return attachment;
    } finally {
      upload.busy = false;
      await discardUpload(upload);
    }
  }

  async function cancelUpload(id, context = {}) {
    await ensureLoaded();
    const target = safeString(id);
    const upload = uploads.get(target);
    if (upload) {
      upload.cancelled = true;
      clearUploadExpiry(upload);
      if (!upload.busy) await discardUpload(upload);
      return true;
    }
    const sessionId = safeString(context.sessionId);
    const workspace = safeString(context.workspace);
    if (!target || !sessionId || !workspace) return false;
    const record = [...records.values()].find((candidate) => candidate.operationId === `upload:${target}`);
    if (!record) return false;
    return await releasePendingUploads([{ id: record.id, sessionId, workspace }]) > 0;
  }

  return {
    ensureLoaded,
    ingestDataUrls,
    ingestBytes,
    get,
    readDataUrl,
    readBytes,
    getContentDescriptor,
    addSessionReference,
    readRange,
    materialize,
    migrateLegacySessionEntries,
    beginUpload,
    appendUpload,
    finishUpload,
    cancelUpload,
    releasePendingUploads,
    releaseAttachments,
    releaseSession,
    sweepOrphans,
    list: async () => { await ensureLoaded(); return [...records.values()].map(recordForPublic); },
  };
}

export { DEFAULT_ORPHAN_GRACE_MS, MAX_ATTACHMENT_BYTES };
