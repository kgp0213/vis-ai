#!/usr/bin/env node

// src/tokenizer.ts
import { existsSync, readFileSync } from "fs";
import { createRequire } from "module";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { gunzipSync } from "zlib";
function buildByteToChar() {
  const result = new Array(256);
  const bs = [];
  for (let b = 33; b <= 126; b++) bs.push(b);
  for (let b = 161; b <= 172; b++) bs.push(b);
  for (let b = 174; b <= 255; b++) bs.push(b);
  const cs = bs.slice();
  let n = 0;
  for (let b = 0; b < 256; b++) {
    if (!bs.includes(b)) {
      bs.push(b);
      cs.push(256 + n);
      n++;
    }
  }
  for (let i = 0; i < bs.length; i++) {
    result[bs[i]] = String.fromCodePoint(cs[i]);
  }
  return result;
}
var cached = null;
function resolveDataPath() {
  if (process.env.REASONIX_TOKENIZER_PATH) return process.env.REASONIX_TOKENIZER_PATH;
  const candidates = [];
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    candidates.push(join(here, "..", "data", "deepseek-tokenizer.json.gz"));
    candidates.push(join(here, "..", "..", "data", "deepseek-tokenizer.json.gz"));
  } catch {
  }
  try {
    const req = createRequire(import.meta.url);
    candidates.push(
      join(dirname(req.resolve("reasonix/package.json")), "data", "deepseek-tokenizer.json.gz")
    );
  } catch {
  }
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return candidates[0] ?? join(process.cwd(), "data", "deepseek-tokenizer.json.gz");
}
function loadTokenizer() {
  if (cached) return cached;
  const buf = readFileSync(resolveDataPath());
  const json = gunzipSync(buf).toString("utf8");
  const data = JSON.parse(json);
  const mergeRank = /* @__PURE__ */ new Map();
  for (let i = 0; i < data.model.merges.length; i++) {
    mergeRank.set(data.model.merges[i], i);
  }
  const splitRegexes = [];
  for (const p of data.pre_tokenizer.pretokenizers) {
    if (p.type === "Split") {
      splitRegexes.push(new RegExp(p.pattern.Regex, "gu"));
    }
  }
  const addedMap = /* @__PURE__ */ new Map();
  const addedContents = [];
  for (const t of data.added_tokens) {
    if (!t.special) {
      addedMap.set(t.content, t.id);
      addedContents.push(t.content);
    }
  }
  addedContents.sort((a, b) => b.length - a.length);
  const addedPattern = addedContents.length ? new RegExp(addedContents.map(escapeRegex).join("|"), "g") : null;
  cached = {
    vocab: data.model.vocab,
    mergeRank,
    splitRegexes,
    byteToChar: buildByteToChar(),
    addedPattern,
    addedMap
  };
  return cached;
}
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function applySplit(chunks, re) {
  const out = [];
  for (const chunk of chunks) {
    if (!chunk) continue;
    re.lastIndex = 0;
    let last = 0;
    for (const m of chunk.matchAll(re)) {
      const idx = m.index ?? 0;
      if (idx > last) out.push(chunk.slice(last, idx));
      if (m[0].length > 0) out.push(m[0]);
      last = idx + m[0].length;
    }
    if (last < chunk.length) out.push(chunk.slice(last));
  }
  return out;
}
function byteLevelEncode(s, byteToChar) {
  const bytes = new TextEncoder().encode(s);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += byteToChar[bytes[i]];
  return out;
}
function bpeEncode(piece, mergeRank) {
  if (piece.length <= 1) return piece ? [piece] : [];
  let word = Array.from(piece);
  while (true) {
    let bestIdx = -1;
    let bestRank = Number.POSITIVE_INFINITY;
    for (let i = 0; i < word.length - 1; i++) {
      const pair = `${word[i]} ${word[i + 1]}`;
      const rank = mergeRank.get(pair);
      if (rank !== void 0 && rank < bestRank) {
        bestRank = rank;
        bestIdx = i;
        if (rank === 0) break;
      }
    }
    if (bestIdx < 0) break;
    word = [
      ...word.slice(0, bestIdx),
      word[bestIdx] + word[bestIdx + 1],
      ...word.slice(bestIdx + 2)
    ];
    if (word.length === 1) break;
  }
  return word;
}
function encode(text) {
  if (!text) return [];
  const t = loadTokenizer();
  const ids = [];
  const process2 = (segment) => {
    if (!segment) return;
    let chunks = [segment];
    for (const re of t.splitRegexes) chunks = applySplit(chunks, re);
    for (const chunk of chunks) {
      if (!chunk) continue;
      const byteLevel = byteLevelEncode(chunk, t.byteToChar);
      const pieces = bpeEncode(byteLevel, t.mergeRank);
      for (const p of pieces) {
        const id = t.vocab[p];
        if (id !== void 0) ids.push(id);
      }
    }
  };
  if (t.addedPattern) {
    t.addedPattern.lastIndex = 0;
    let last = 0;
    for (const m of text.matchAll(t.addedPattern)) {
      const idx = m.index ?? 0;
      if (idx > last) process2(text.slice(last, idx));
      const id = t.addedMap.get(m[0]);
      if (id !== void 0) ids.push(id);
      last = idx + m[0].length;
    }
    if (last < text.length) process2(text.slice(last));
  } else {
    process2(text);
  }
  return ids;
}
function countTokens(text) {
  return encode(text).length;
}
function estimateConversationTokens(messages) {
  let total = 0;
  for (const m of messages) {
    if (typeof m.content === "string" && m.content) {
      total += countTokens(m.content);
    }
    if (m.tool_calls && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
      total += countTokens(JSON.stringify(m.tool_calls));
    }
  }
  return total;
}
function estimateRequestTokens(messages, toolSpecs) {
  let total = estimateConversationTokens(messages);
  if (toolSpecs && toolSpecs.length > 0) {
    total += countTokens(JSON.stringify(toolSpecs));
  }
  return total;
}

export {
  resolveDataPath,
  countTokens,
  estimateConversationTokens,
  estimateRequestTokens
};
//# sourceMappingURL=chunk-DAEAAVDF.js.map