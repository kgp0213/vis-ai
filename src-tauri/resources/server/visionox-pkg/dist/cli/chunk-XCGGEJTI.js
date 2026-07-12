#!/usr/bin/env node
import { createRequire as __cr } from 'node:module'; if (typeof globalThis.require === 'undefined') { globalThis.require = __cr(import.meta.url); }
import {
  ignoredByLayers,
  loadGitignoreAt
} from "./chunk-S4XVGLRW.js";
import {
  compileFilters,
  defaultIndexConfig,
  resolveSemanticEmbeddingConfig
} from "./chunk-XPDVG52A.js";

// src/index/semantic/builder.ts
import { promises as fs3 } from "fs";
import path3 from "path";
import { homedir, tmpdir } from "node:os";
import { createHash, randomUUID } from "node:crypto";

// src/index/semantic/chunker.ts
import { promises as fs } from "fs";
import path from "path";
var DEFAULT_MAX_CHUNK_CHARS = 4e3;
function chunkText(text, filePath, windowLines, overlap, maxChunkChars = DEFAULT_MAX_CHUNK_CHARS) {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0 || lines.length === 1 && lines[0] === "") return [];
  const stride = Math.max(1, windowLines - overlap);
  const chunks = [];
  for (let start = 0; start < lines.length; start += stride) {
    const end = Math.min(lines.length, start + windowLines);
    const slice = lines.slice(start, end).join("\n").trim();
    if (slice.length === 0) {
      if (end >= lines.length) break;
      continue;
    }
    const window = {
      path: filePath,
      startLine: start + 1,
      endLine: end,
      text: slice
    };
    for (const sub of safeSplit(window, maxChunkChars)) chunks.push(sub);
    if (end >= lines.length) break;
  }
  return chunks;
}
function safeSplit(chunk, maxChars) {
  if (chunk.text.length <= maxChars) return [chunk];
  const lines = chunk.text.split("\n");
  const out = [];
  let bufLines = [];
  let bufStart = chunk.startLine;
  let bufLen = 0;
  const flush = (untilLineNo) => {
    if (bufLines.length === 0) return;
    out.push({
      path: chunk.path,
      startLine: bufStart,
      endLine: untilLineNo,
      text: bufLines.join("\n")
    });
    bufLines = [];
    bufLen = 0;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const lineLen = line.length + 1;
    if (lineLen > maxChars) {
      flush(chunk.startLine + i - 1);
      out.push({
        path: chunk.path,
        startLine: chunk.startLine + i,
        endLine: chunk.startLine + i,
        text: line.slice(0, maxChars)
      });
      bufStart = chunk.startLine + i + 1;
      continue;
    }
    if (bufLen + lineLen > maxChars && bufLines.length > 0) {
      flush(chunk.startLine + i - 1);
      bufStart = chunk.startLine + i;
    }
    bufLines.push(line);
    bufLen += lineLen;
  }
  flush(chunk.endLine);
  return out;
}
function toForwardRel(root, abs) {
  return path.relative(root, abs).split(path.sep).join("/");
}
async function* walkChunks(root, opts = {}) {
  const windowLines = opts.windowLines ?? 60;
  const overlap = Math.min(opts.overlap ?? 12, Math.max(0, windowLines - 1));
  const maxChunkChars = opts.maxChunkChars ?? DEFAULT_MAX_CHUNK_CHARS;
  const filters = compileFilters(opts.config ?? defaultIndexConfig());
  const onSkip = opts.onSkip ?? (() => {
  });
  const initial = [];
  if (filters.respectGitignore) {
    const rootIg = await loadGitignoreAt(root);
    if (rootIg) initial.push({ dirAbs: root, ig: rootIg });
  }
  const stack = [{ dir: root, layers: initial }];
  while (stack.length > 0) {
    const frame = stack.pop();
    if (!frame) break;
    const { dir, layers } = frame;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (error) {
      opts.onTraversalError?.(toForwardRel(root, dir), error);
      continue;
    }
    for (const entry of entries) {
      const name = entry.name;
      const abs = path.join(dir, name);
      const rel = toForwardRel(root, abs);
      if (entry.isDirectory()) {
        const enterKnowledgeRoot = dir === root && name === "knowledge" && filters.includeKnowledgeDocs;
        if (filters.dirSet.has(name) && !enterKnowledgeRoot) {
          onSkip(rel, "defaultDir");
          continue;
        }
        if (filters.respectGitignore && !enterKnowledgeRoot && !frame.knowledgeTree && ignoredByLayers(layers, abs, true)) {
          onSkip(rel, "gitignore");
          continue;
        }
        if (filters.patternMatch(`${rel}/`) || filters.patternMatch(rel)) {
          onSkip(rel, "pattern");
          continue;
        }
        const childLayers = filters.respectGitignore ? await extendLayers(layers, abs) : layers;
        stack.push({
          dir: abs,
          layers: childLayers,
          knowledgeTree: frame.knowledgeTree || enterKnowledgeRoot
        });
        continue;
      }
      if (!entry.isFile()) continue;
      if (frame.knowledgeTree && path.extname(name).toLowerCase() !== ".md") continue;
      if (filters.fileSet.has(name)) {
        onSkip(rel, "defaultFile");
        continue;
      }
      const ext = path.extname(name).toLowerCase();
      if (filters.extSet.has(ext)) {
        onSkip(rel, "binaryExt");
        continue;
      }
      if (filters.respectGitignore && !frame.knowledgeTree && ignoredByLayers(layers, abs, false)) {
        onSkip(rel, "gitignore");
        continue;
      }
      if (filters.patternMatch(rel)) {
        onSkip(rel, "pattern");
        continue;
      }
      const result = await readSizeBoundedFile(abs, filters.maxFileBytes);
      if (result.kind === "skip") {
        onSkip(rel, result.reason);
        continue;
      }
      opts.onFile?.(rel);
      const text = result.text;
      if (text.indexOf("\0") !== -1) {
        onSkip(rel, "binaryContent");
        continue;
      }
      for (const chunk of chunkText(text, rel, windowLines, overlap, maxChunkChars)) {
        yield chunk;
      }
    }
  }
}
async function extendLayers(layers, dirAbs) {
  const ig = await loadGitignoreAt(dirAbs);
  return ig ? [...layers, { dirAbs, ig }] : layers;
}
async function readSizeBoundedFile(abs, maxBytes) {
  try {
    const fh = await fs.open(abs, "r");
    try {
      const stat = await fh.stat();
      if (stat.size > maxBytes) return { kind: "skip", reason: "tooLarge" };
      return { kind: "ok", text: await fh.readFile("utf8") };
    } finally {
      await fh.close();
    }
  } catch {
    return { kind: "skip", reason: "readError" };
  }
}

// src/index/semantic/embedding.ts
var DEFAULT_OLLAMA_URL = "http://localhost:11434";
var DEFAULT_EMBED_MODEL = "nomic-embed-text";
var DEFAULT_TIMEOUT_MS = 3e4;
var EmbeddingError = class extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "EmbeddingError";
  }
  cause;
};
async function embed(text, opts = {}) {
  if (opts.provider === "openai-compat") return await embedOpenAICompat(text, opts);
  return await embedOllama(text, opts);
}
async function embedAll(texts, opts = {}) {
  if (opts.provider === "openai-compat") return await embedAllOpenAICompat(texts, opts);
  const out = [];
  for (let i = 0; i < texts.length; i++) {
    if (opts.signal?.aborted) throw new EmbeddingError("embedding aborted");
    const text = texts[i];
    if (text === void 0) continue;
    try {
      out.push(await embed(text, opts));
    } catch (err) {
      if (isAbortError(err) || opts.signal?.aborted) {
        throw new EmbeddingError("embedding aborted", err);
      }
      opts.onError?.(i, err);
      out.push(null);
    }
    opts.onProgress?.(i + 1, texts.length);
  }
  return out;
}
async function probeOllama(opts = {}) {
  const baseUrl = opts.baseUrl ?? process.env.OLLAMA_URL ?? DEFAULT_OLLAMA_URL;
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: opts.signal });
    if (!res.ok) return { ok: false, error: `Ollama returned ${res.status}` };
    const json = await res.json();
    const models = (json.models ?? []).map((m) => m.name).filter((n) => typeof n === "string");
    return { ok: true, models };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
async function embedOllama(text, opts) {
  const baseUrl = opts.baseUrl ?? process.env.OLLAMA_URL ?? DEFAULT_OLLAMA_URL;
  const model = opts.model ?? process.env.visionox_EMBED_MODEL ?? DEFAULT_EMBED_MODEL;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const { controller, cleanup } = composeAbort(opts.signal, timeoutMs, "embedding timeout");
  let res;
  try {
    res = await fetch(`${baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, prompt: text }),
      signal: controller.signal
    });
  } catch (err) {
    cleanup();
    const msg = err instanceof Error ? err.message : String(err);
    if (/ECONNREFUSED|connect ECONNREFUSED|fetch failed/i.test(msg)) {
      throw new EmbeddingError(
        `Cannot reach Ollama at ${baseUrl}. Install from https://ollama.com, then run \`ollama pull ${model}\` and \`ollama serve\`. Override the URL via OLLAMA_URL.`,
        err
      );
    }
    throw new EmbeddingError(`embedding request failed: ${msg}`, err);
  } finally {
    cleanup();
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 404 && /model.*not found/i.test(body)) {
      throw new EmbeddingError(
        `Embedding model "${model}" not pulled. Run \`ollama pull ${model}\` once, then retry.`
      );
    }
    throw new EmbeddingError(`Ollama returned ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  if (!json.embedding || !Array.isArray(json.embedding)) {
    throw new EmbeddingError("Ollama response missing 'embedding' array");
  }
  return toFloat32Array(json.embedding, "embedding");
}
async function embedOpenAICompat(text, opts) {
  const vectors = await requestOpenAICompatEmbeddings(text, opts);
  const v = vectors[0];
  if (!v) {
    throw new EmbeddingError(
      `Embedding provider returned no vector for the input (model ${opts.model})`
    );
  }
  return v;
}
async function embedAllOpenAICompat(texts, opts) {
  if (texts.length === 0) return [];
  if (opts.signal?.aborted) throw new EmbeddingError("embedding aborted");
  const OPENAI_COMPAT_MAX_BATCH = 64;
  const allVectors = new Array(texts.length);
  const chunks = [];
  for (let i = 0; i < texts.length; i += OPENAI_COMPAT_MAX_BATCH) {
    chunks.push({ start: i, batch: texts.slice(i, i + OPENAI_COMPAT_MAX_BATCH) });
  }
  for (const { start, batch } of chunks) {
    if (opts.signal?.aborted) throw new EmbeddingError("embedding aborted");
    const vectors = await requestOpenAICompatEmbeddings(batch, opts);
    for (let j = 0; j < vectors.length; j++) {
      allVectors[start + j] = vectors[j];
      if (vectors[j] === null) {
        opts.onError?.(
          start + j,
          new EmbeddingError(`provider dropped input ${start + j} from the batch (model ${opts.model} returned no embedding for it)`)
        );
      }
    }
    opts.onProgress?.(start + vectors.length, texts.length);
  }
  return allVectors;
}
async function requestOpenAICompatEmbeddings(input, opts) {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const { controller, cleanup } = composeAbort(opts.signal, timeoutMs, "embedding timeout");
  const url = opts.baseUrl.trim();
  const body = {
    ...opts.extraBody ?? {},
    model: opts.model,
    input,
    encoding_format: "float"
  };
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${opts.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (err) {
    cleanup();
    if (isAbortError(err) || opts.signal?.aborted) {
      throw new EmbeddingError("embedding aborted", err);
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new EmbeddingError(`Cannot reach OpenAI-compatible embeddings at ${url}: ${msg}`, err);
  } finally {
    cleanup();
  }
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    const bodyText = raw.slice(0, 300);
    if (res.status === 401 || res.status === 403) {
      throw new EmbeddingError(
        `OpenAI-compatible API rejected the API key for ${url}. Response ${res.status}: ${bodyText}`
      );
    }
    if (res.status === 404) {
      throw new EmbeddingError(
        `Embeddings endpoint not found at ${url}. Check the configured API URL. Response ${res.status}: ${bodyText}`
      );
    }
    if (res.status === 400) {
      throw new EmbeddingError(
        `Embedding provider returned 400: ${bodyText}. Check model and custom request body fields.`
      );
    }
    throw new EmbeddingError(`OpenAI-compatible API returned ${res.status}: ${bodyText}`);
  }
  const json = await res.json();
  if (!Array.isArray(json.data)) {
    throw new EmbeddingError("OpenAI-compatible response missing 'data' array");
  }
  const size = Array.isArray(input) ? input.length : 1;
  const out = new Array(size).fill(null);
  for (const row of json.data) {
    const rawIndex = row.index;
    if (typeof rawIndex !== "number" || !Number.isInteger(rawIndex) || rawIndex < 0 || rawIndex >= size) {
      throw new EmbeddingError("OpenAI-compatible response returned an invalid embedding index");
    }
    const index = rawIndex;
    if (!Array.isArray(row.embedding)) {
      throw new EmbeddingError(`OpenAI-compatible response missing embedding for index ${index}`);
    }
    out[index] = toFloat32Array(row.embedding, `data[${index}].embedding`);
  }
  return out;
}
function toFloat32Array(values, label) {
  const out = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new EmbeddingError(`${label}[${i}] is not a finite number`);
    }
    out[i] = value;
  }
  return out;
}
function composeAbort(signal, timeoutMs, reason) {
  const controller = new AbortController();
  const onCallerAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener("abort", onCallerAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(new Error(reason)), timeoutMs);
  return {
    controller,
    cleanup: () => {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onCallerAbort);
    }
  };
}
function isAbortError(err) {
  if (err instanceof Error) {
    if (err.name === "AbortError") return true;
    if (/aborted/i.test(err.message)) return true;
  }
  return false;
}

// src/index/semantic/store.ts
import { promises as fs2 } from "fs";
import path2 from "path";
var STORE_VERSION = 1;
var META_FILE = "index.meta.json";
var DATA_FILE = "index.jsonl";
var STORE_CACHE_MAX = 4;
var storeCache = /* @__PURE__ */ new Map();
function storeCacheKey(indexDir, identity) {
  return `${indexDir}\n${identity.provider}\n${identity.model}\n${identity.configFingerprint || "legacy"}`;
}
function rememberStore(store, updatedAt = "") {
  const key = storeCacheKey(store.indexDir, store.identity);
  storeCache.delete(key);
  storeCache.set(key, { store, updatedAt });
  while (storeCache.size > STORE_CACHE_MAX) storeCache.delete(storeCache.keys().next().value);
}
async function readIndexMeta(indexDir) {
  try {
    const raw = await fs2.readFile(path2.join(indexDir, META_FILE), "utf8");
    return normalizeMeta(JSON.parse(raw));
  } catch {
    return null;
  }
}
function compareIndexIdentity(meta, identity) {
  if (meta.provider !== identity.provider) return "provider";
  if (meta.model !== identity.model) return "model";
  if (meta.configFingerprint && identity.configFingerprint && meta.configFingerprint !== identity.configFingerprint) return "config";
  return null;
}
async function wipeStoreFiles(indexDir) {
  await fs2.rm(path2.join(indexDir, DATA_FILE), { force: true });
  await fs2.rm(path2.join(indexDir, META_FILE), { force: true });
}
var SemanticStore = class {
  constructor(indexDir, identity) {
    this.indexDir = indexDir;
    this.identity = identity;
  }
  indexDir;
  identity;
  entries = [];
  byPath = /* @__PURE__ */ new Map();
  dim = 0;
  get provider() {
    return this.identity.provider;
  }
  get model() {
    return this.identity.model;
  }
  get empty() {
    return this.entries.length === 0;
  }
  get size() {
    return this.entries.length;
  }
  get all() {
    return this.entries;
  }
  fileMtimes() {
    const out = /* @__PURE__ */ new Map();
    for (const [p, group] of this.byPath) {
      const first = group[0];
      if (first) out.set(p, first.mtimeMs);
    }
    return out;
  }
  async add(entries) {
    if (entries.length === 0) return;
    const expectedDim = this.dim || entries[0].embedding.length;
    for (const e of entries) {
      if (e.embedding.length !== expectedDim) {
        throw new Error(
          `embedding dim mismatch: expected ${expectedDim}, got ${e.embedding.length} for ${e.path}:${e.startLine}`
        );
      }
    }
    const nextEntries = [...this.entries, ...entries];
    const updatedAt = await this.commitSnapshot(nextEntries, expectedDim);
    this.applyEntries(nextEntries, expectedDim);
    rememberStore(this, updatedAt);
  }
  async remove(paths) {
    return paths.length > 0 ? this.replacePathsAtomically([], paths) : 0;
  }
  async replacePathsAtomically(entries, paths) {
    const drop = new Set(paths);
    const before = this.entries.length;
    const retained = this.entries.filter((entry) => !drop.has(entry.path));
    const expectedDim = retained[0]?.embedding.length ?? entries[0]?.embedding.length ?? this.dim;
    for (const entry of entries) {
      if (expectedDim && entry.embedding.length !== expectedDim) {
        throw new Error(`embedding dim mismatch: expected ${expectedDim}, got ${entry.embedding.length} for ${entry.path}:${entry.startLine}`);
      }
    }
    const nextEntries = [...retained, ...entries];
    const updatedAt = await this.commitSnapshot(nextEntries, expectedDim || 0);
    this.applyEntries(nextEntries, expectedDim || 0);
    rememberStore(this, updatedAt);
    return before - retained.length;
  }
  applyEntries(entries, dim) {
    this.entries = entries;
    this.byPath.clear();
    for (const entry of this.entries) {
      const list = this.byPath.get(entry.path);
      if (list) list.push(entry);
      else this.byPath.set(entry.path, [entry]);
    }
    this.dim = dim;
  }
  async commitSnapshot(entries, dim) {
    await fs2.mkdir(this.indexDir, { recursive: true });
    const nonce = randomUUID();
    const finalData = path2.join(this.indexDir, DATA_FILE);
    const finalMeta = path2.join(this.indexDir, META_FILE);
    const commitData = `${finalData}.commit-${nonce}`;
    const commitMeta = `${finalMeta}.commit-${nonce}`;
    const tempData = path2.join(tmpdir(), `visionox-index-data-${nonce}.tmp`);
    const tempMeta = path2.join(tmpdir(), `visionox-index-meta-${nonce}.tmp`);
    const backupData = path2.join(tmpdir(), `visionox-index-data-${nonce}.backup`);
    const backupMeta = path2.join(tmpdir(), `visionox-index-meta-${nonce}.backup`);
    const updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    const meta = {
      version: STORE_VERSION,
      provider: this.provider,
      model: this.model,
      configFingerprint: this.identity.configFingerprint || null,
      dim,
      updatedAt
    };
    const lines = entries.map(serializeEntry).join("\n");
    let hadData = false;
    let hadMeta = false;
    let dataCommitted = false;
    let metaCommitted = false;
    try {
      await fs2.writeFile(tempData, lines.length > 0 ? `${lines}\n` : "", "utf8");
      await fs2.writeFile(tempMeta, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
      try { await fs2.copyFile(finalData, backupData); hadData = true; } catch {}
      try { await fs2.copyFile(finalMeta, backupMeta); hadMeta = true; } catch {}
      await fs2.copyFile(tempData, commitData);
      await fs2.copyFile(tempMeta, commitMeta);
      await fs2.rename(commitData, finalData);
      dataCommitted = true;
      await fs2.rename(commitMeta, finalMeta);
      metaCommitted = true;
      return updatedAt;
    } catch (error) {
      storeCache.delete(storeCacheKey(this.indexDir, this.identity));
      if (dataCommitted) {
        if (hadData) await fs2.copyFile(backupData, finalData).catch(() => {});
        else await fs2.rm(finalData, { force: true }).catch(() => {});
      }
      if (metaCommitted) {
        if (hadMeta) await fs2.copyFile(backupMeta, finalMeta).catch(() => {});
        else await fs2.rm(finalMeta, { force: true }).catch(() => {});
      }
      throw error;
    } finally {
      await Promise.all([tempData, tempMeta, backupData, backupMeta, commitData, commitMeta].map((file) => fs2.rm(file, { force: true }).catch(() => {})));
    }
  }
  search(query, topK = 8, minScore = 0, filter = null) {
    if (this.entries.length === 0) return [];
    if (query.length !== this.dim && this.dim !== 0) {
      throw new Error(`query dim ${query.length} \u2260 index dim ${this.dim}`);
    }
    const heap = [];
    for (const entry of this.entries) {
      if (filter && !filter(entry)) continue;
      const score = dot(query, entry.embedding);
      if (score < minScore) continue;
      if (heap.length < topK) {
        heap.push({ entry, score });
        if (heap.length === topK) heap.sort((a, b) => a.score - b.score);
      } else if (score > heap[0].score) {
        heap[0] = { entry, score };
        for (let i = 0; i < heap.length - 1; i++) {
          if (heap[i].score > heap[i + 1].score) {
            const tmp = heap[i];
            heap[i] = heap[i + 1];
            heap[i + 1] = tmp;
          }
        }
      }
    }
    return heap.sort((a, b) => b.score - a.score);
  }
  async flush() {
    const updatedAt = await this.commitSnapshot(this.entries, this.dim);
    rememberStore(this, updatedAt);
  }
  async writeMeta() {
    const updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    const meta = {
      version: STORE_VERSION,
      provider: this.provider,
      model: this.model,
      configFingerprint: this.identity.configFingerprint || null,
      dim: this.dim,
      updatedAt
    };
    await fs2.writeFile(
      path2.join(this.indexDir, META_FILE),
      `${JSON.stringify(meta, null, 2)}
`,
      "utf8"
    );
    rememberStore(this, updatedAt);
  }
  async wipe() {
    this.entries = [];
    this.byPath.clear();
    this.dim = 0;
    await wipeStoreFiles(this.indexDir);
  }
};
async function openStore(indexDir, identity) {
  const dataPath = path2.join(indexDir, DATA_FILE);
  const meta = await readIndexMeta(indexDir);
  if (meta) {
    if (meta.version !== STORE_VERSION) {
      throw new Error(
        `Index format version ${meta.version} does not match current ${STORE_VERSION}. Run \`visionox index --rebuild\`.`
      );
    }
    const mismatch = compareIndexIdentity(meta, identity);
    if (mismatch !== null) {
      throw new Error(
        `Index was built with provider "${meta.provider}" model "${meta.model}" but current config is provider "${identity.provider}" model "${identity.model}". Run \`visionox index --rebuild\`.`
      );
    }
  }
  const cacheKey = storeCacheKey(indexDir, identity);
  const cached = storeCache.get(cacheKey);
  if (cached && cached.updatedAt === (meta?.updatedAt || "")) {
    storeCache.delete(cacheKey);
    storeCache.set(cacheKey, cached);
    return cached.store;
  }
  const store = new SemanticStore(indexDir, identity);
  let raw;
  try {
    raw = await fs2.readFile(dataPath, "utf8");
  } catch {
    rememberStore(store, meta?.updatedAt || "");
    return store;
  }
  for (const line of raw.split("\n")) {
    if (line.length === 0) continue;
    try {
      const entry = deserializeEntry(line);
      store.dim = entry.embedding.length;
      store.entries.push(entry);
      const map = store.byPath;
      const list = map.get(entry.path);
      if (list) list.push(entry);
      else map.set(entry.path, [entry]);
    } catch {
    }
  }
  rememberStore(store, meta?.updatedAt || "");
  return store;
}
function normalize(v) {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  const inv = sum > 0 ? 1 / Math.sqrt(sum) : 0;
  for (let i = 0; i < v.length; i++) v[i] = v[i] * inv;
  return v;
}
function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
function serializeEntry(e) {
  const buf = Buffer.from(e.embedding.buffer, e.embedding.byteOffset, e.embedding.byteLength);
  return JSON.stringify({
    p: e.path,
    s: e.startLine,
    e: e.endLine,
    m: e.mtimeMs,
    t: e.text,
    v: buf.toString("base64")
  });
}
function deserializeEntry(line) {
  const parsed = JSON.parse(line);
  const buf = Buffer.from(parsed.v, "base64");
  const embedding = new Float32Array(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  );
  return {
    path: parsed.p,
    startLine: parsed.s,
    endLine: parsed.e,
    mtimeMs: parsed.m,
    text: parsed.t,
    embedding: new Float32Array(embedding)
  };
}
function normalizeMeta(meta) {
  return {
    version: typeof meta.version === "number" ? meta.version : STORE_VERSION,
    provider: meta.provider === "openai-compat" ? "openai-compat" : "ollama",
    model: typeof meta.model === "string" ? meta.model : "",
    configFingerprint: typeof meta.configFingerprint === "string" ? meta.configFingerprint : null,
    dim: typeof meta.dim === "number" ? meta.dim : 0,
    updatedAt: typeof meta.updatedAt === "string" ? meta.updatedAt : (/* @__PURE__ */ new Date(0)).toISOString()
  };
}

// src/index/semantic/builder.ts
var INDEX_DIR_NAME = path3.join(homedir(), ".visionox", "semantic");
var indexBuildLocks = /* @__PURE__ */ new Map();
function semanticIndexDirForRoot(root) {
  const resolved = path3.resolve(root);
  const identity = process.platform === "win32" ? resolved.toLowerCase() : resolved;
  const projectHash = createHash("sha256").update(identity).digest("hex");
  return path3.join(INDEX_DIR_NAME, "projects", projectHash);
}
function emptyBuckets() {
  return {
    defaultDir: 0,
    defaultFile: 0,
    binaryExt: 0,
    binaryContent: 0,
    tooLarge: 0,
    gitignore: 0,
    pattern: 0,
    readError: 0
  };
}
async function buildIndex(root, opts = {}) {
  const indexDir = opts.testHooks?.indexDir ?? semanticIndexDirForRoot(root);
  const previous = indexBuildLocks.get(indexDir) ?? Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  const tail = previous.catch(() => {}).then(() => current);
  indexBuildLocks.set(indexDir, tail);
  await previous.catch(() => {});
  try {
    throwIfAborted(opts.signal);
    return await buildIndexUnlocked(root, opts);
  } finally {
    release();
    if (indexBuildLocks.get(indexDir) === tail) indexBuildLocks.delete(indexDir);
  }
}
async function buildIndexUnlocked(root, opts = {}) {
  const t0 = Date.now();
  const indexDir = opts.testHooks?.indexDir ?? semanticIndexDirForRoot(root);
  const resolved = resolveBuildEmbeddingConfig(opts);
  opts.onProgress?.({ phase: "setup" });
  throwIfAborted(opts.signal);
  await (opts.testHooks?.probeEmbeddingProvider ?? probeEmbeddingProvider)(resolved, opts.signal);
  throwIfAborted(opts.signal);
  const store = await openStore(indexDir, resolveIndexIdentity(resolved));
  const lastMtimes = store.fileMtimes();
  const seenPaths = /* @__PURE__ */ new Set();
  const unreadablePaths = /* @__PURE__ */ new Set();
  const unreadablePrefixes = /* @__PURE__ */ new Set();
  const unchangedPaths = /* @__PURE__ */ new Set();
  const fileChunks = /* @__PURE__ */ new Map();
  let filesScanned = 0;
  let filesSkipped = 0;
  const skipBuckets = emptyBuckets();
  const chunkWalker = opts.testHooks?.walkChunks ?? walkChunks;
  for await (const chunk of chunkWalker(root, {
    windowLines: opts.windowLines,
    overlap: opts.overlap,
    config: opts.indexConfig ?? defaultIndexConfig(),
    onFile: (path) => seenPaths.add(path),
    onTraversalError: (path) => unreadablePrefixes.add(path ? `${path.replace(/\/$/, "")}/` : ""),
    onSkip: (path, reason) => {
      skipBuckets[reason]++;
      if (reason === "readError") unreadablePaths.add(path);
    }
  })) {
    throwIfAborted(opts.signal);
    if (unchangedPaths.has(chunk.path)) continue;
    let bucket = fileChunks.get(chunk.path);
    if (!bucket) {
      filesScanned++;
      const abs = path3.join(root, chunk.path);
      let mtimeMs = 0;
      try {
        const stat = await fs3.stat(abs);
        mtimeMs = stat.mtimeMs;
      } catch {
        unreadablePaths.add(chunk.path);
        continue;
      }
      const last = lastMtimes.get(chunk.path);
      if (last !== void 0 && last === mtimeMs && !opts.rebuild) {
        filesSkipped++;
        unchangedPaths.add(chunk.path);
        continue;
      }
      bucket = { chunks: [], mtimeMs };
      fileChunks.set(chunk.path, bucket);
    }
    bucket.chunks.push(chunk);
    opts.onProgress?.({ phase: "scan", filesScanned });
  }
  throwIfAborted(opts.signal);
  const deletedPaths = [];
  for (const oldPath of lastMtimes.keys()) {
    const belowUnreadableDirectory = [...unreadablePrefixes].some((prefix) => prefix === "" || oldPath.startsWith(prefix));
    const removedOrNowEmpty = !seenPaths.has(oldPath) || !unchangedPaths.has(oldPath) && !fileChunks.has(oldPath);
    if (removedOrNowEmpty && !unreadablePaths.has(oldPath) && !belowUnreadableDirectory) deletedPaths.push(oldPath);
  }
  throwIfAborted(opts.signal);
  let removed = 0;
  const replacementEntries = [];
  const successfulPaths = [];
  let chunksAdded = 0;
  let chunksSkipped = 0;
  const filesChanged = fileChunks.size;
  let chunksTotal = 0;
  for (const { chunks } of fileChunks.values()) chunksTotal += chunks.length;
  let chunksDone = 0;
  for (const [, bucket] of fileChunks) {
    throwIfAborted(opts.signal);
    if (bucket.chunks.length === 0) continue;
    const texts = bucket.chunks.map((c) => c.text);
    const vectors = await (opts.testHooks?.embedAll ?? embedAll)(texts, {
      ...resolved,
      signal: opts.signal,
      onProgress: (done, total) => {
        opts.onProgress?.({
          phase: "embed",
          filesScanned,
          filesChanged,
          chunksTotal,
          chunksDone: chunksDone + done
        });
        if (done === total) chunksDone += total;
      },
      onError: (idx, err) => {
        chunksSkipped++;
        const c = bucket.chunks[idx];
        const where = c ? `${c.path}:${c.startLine}-${c.endLine}` : `chunk #${idx}`;
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`
  ! skipped ${where}: ${msg}
`);
      }
    });
    throwIfAborted(opts.signal);
    const entries = [];
    for (let i = 0; i < bucket.chunks.length; i++) {
      const vec = vectors[i];
      if (!vec) continue;
      const c = bucket.chunks[i];
      if (!c) continue;
      normalize(vec);
      entries.push({
        path: c.path,
        startLine: c.startLine,
        endLine: c.endLine,
        text: c.text,
        embedding: vec,
        mtimeMs: bucket.mtimeMs
      });
    }
    throwIfAborted(opts.signal);
    if (entries.length !== bucket.chunks.length) continue;
    replacementEntries.push(...entries);
    successfulPaths.push(bucket.chunks[0].path);
    chunksAdded += entries.length;
  }
  throwIfAborted(opts.signal);
  const incomplete = chunksSkipped > 0 || unreadablePaths.size > 0 || unreadablePrefixes.size > 0;
  const preservePrevious = opts.rebuild === true && incomplete;
  if (!preservePrevious && (replacementEntries.length > 0 || deletedPaths.length > 0)) {
    removed = await store.replacePathsAtomically(replacementEntries, [...deletedPaths, ...successfulPaths]);
  }
  if (preservePrevious) chunksAdded = 0;
  opts.onProgress?.({
    phase: "done",
    filesScanned,
    filesSkipped,
    filesChanged,
    chunksTotal,
    chunksDone,
    skipBuckets
  });
  return {
    filesScanned,
    filesChanged,
    chunksAdded,
    chunksRemoved: removed,
    chunksSkipped,
    committed: !preservePrevious,
    preservedPrevious: preservePrevious,
    skipBuckets,
    durationMs: Date.now() - t0
  };
}
async function querySemantic(root, query, opts = {}) {
  const indexDir = semanticIndexDirForRoot(root);
  const resolved = resolveQueryEmbeddingConfig(opts);
  const store = await openStore(indexDir, resolveIndexIdentity(resolved));
  if (store.empty) return null;
  const qvec = await embed(query, { ...resolved, signal: opts.signal });
  normalize(qvec);
  return store.search(qvec, opts.topK ?? 8, opts.minScore ?? 0.3);
}
async function querySemanticGroups(root, query, opts = {}) {
  const indexDir = semanticIndexDirForRoot(root);
  const resolved = resolveQueryEmbeddingConfig(opts);
  const store = await openStore(indexDir, resolveIndexIdentity(resolved));
  if (store.empty) return null;
  const qvec = await embed(query, { ...resolved, signal: opts.signal });
  normalize(qvec);
  const minScore = opts.minScore ?? 0.3;
  return {
    knowledge: store.search(qvec, opts.knowledgeTopK ?? 24, minScore, (entry) => entry.path.startsWith("knowledge/")),
    workspace: store.search(qvec, opts.workspaceTopK ?? 24, minScore, (entry) => !entry.path.startsWith("knowledge/"))
  };
}
async function indexExists(root) {
  const meta = path3.join(semanticIndexDirForRoot(root), "index.meta.json");
  try {
    await fs3.access(meta);
    return true;
  } catch {
    return false;
  }
}
async function indexCompatible(root, opts = {}) {
  const meta = await readIndexMeta(semanticIndexDirForRoot(root));
  if (!meta) return false;
  return compareIndexIdentity(meta, resolveIndexIdentity(opts)) === null;
}
function resolveBuildEmbeddingConfig(opts) {
  if (opts.provider === "openai-compat") {
    if (!opts.baseUrl || !opts.apiKey || !opts.model) {
      throw new Error(
        "OpenAI-compatible embeddings require baseUrl, apiKey, and model when passed directly."
      );
    }
    return {
      provider: "openai-compat",
      baseUrl: opts.baseUrl,
      apiKey: opts.apiKey,
      model: opts.model,
      extraBody: opts.extraBody ?? {},
      timeoutMs: opts.timeoutMs ?? 3e4
    };
  }
  if (opts.baseUrl || opts.model) {
    return {
      provider: "ollama",
      baseUrl: opts.baseUrl ?? process.env.OLLAMA_URL ?? "http://localhost:11434",
      model: opts.model ?? process.env.visionox_EMBED_MODEL ?? "nomic-embed-text",
      timeoutMs: opts.timeoutMs ?? 3e4
    };
  }
  return resolveSemanticEmbeddingConfig(opts.configPath);
}
function resolveIndexIdentity(opts) {
  const resolved = opts.provider && opts.model ? opts : resolveSemanticEmbeddingConfig(opts.configPath);
  const rawBaseUrl = String(resolved.baseUrl || "").trim().replace(/\/+$/, "");
  let normalizedBaseUrl = rawBaseUrl;
  try {
    const parsed = new URL(rawBaseUrl);
    normalizedBaseUrl = parsed.toString().replace(/\/+$/, "");
  } catch {
  }
  const stable = (value) => {
    if (Array.isArray(value)) return value.map(stable);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  };
  const configFingerprint = createHash("sha256").update(JSON.stringify({
    baseUrl: normalizedBaseUrl,
    extraBody: stable(resolved.extraBody ?? {})
  })).digest("hex");
  return { provider: resolved.provider, model: resolved.model, configFingerprint };
}
function resolveQueryEmbeddingConfig(opts) {
  return resolveBuildEmbeddingConfig(opts);
}
async function probeEmbeddingProvider(config, signal) {
  if (config.provider === "openai-compat") return;
  const probe = await probeOllama({ baseUrl: config.baseUrl, signal });
  if (!probe.ok) {
    throw new Error(
      `Ollama is not reachable: ${probe.error}. Install from https://ollama.com, then \`ollama serve\` and \`ollama pull ${config.model}\`.`
    );
  }
}
function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw new Error("semantic indexing aborted");
  }
}

export {
  SemanticStore,
  walkChunks,
  probeOllama,
  readIndexMeta,
  compareIndexIdentity,
  INDEX_DIR_NAME,
  semanticIndexDirForRoot,
  resolveIndexIdentity,
  buildIndex,
  querySemantic,
  querySemanticGroups,
  indexExists,
  indexCompatible
};
//# sourceMappingURL=chunk-XCGGEJTI.js.map
