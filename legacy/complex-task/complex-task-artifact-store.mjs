import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

import { atomicWriteFile } from "./atomic-file.mjs";
import { validateArtifactManifest } from "./complex-task-contracts.mjs";
import { parseArtifactReference } from "./complex-task-artifact-reference.mjs";

const ARTIFACT_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function normalizeContent(value) {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") return Buffer.from(value, "utf8");
  throw new TypeError("artifact content must be a string, Buffer, or Uint8Array");
}

function artifactId(value) {
  const id = String(value ?? "").trim();
  if (!ARTIFACT_ID_RE.test(id)) throw new TypeError(`invalid artifact id: ${id}`);
  return id;
}

function revision(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new TypeError("artifact revision must be a positive integer");
  return number;
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function immutableMetadata(manifest) {
  const { createdAt: _createdAt, path: _path, sha256: _sha256, ...metadata } = manifest ?? {};
  return stableJson(metadata);
}

function invalidManifest(errors) {
  const error = new TypeError(`invalid artifact manifest: ${errors.join("; ")}`);
  error.code = "INVALID_ARTIFACT_MANIFEST";
  error.errors = errors;
  return error;
}

export function createComplexTaskArtifactStore(rootDir, options = {}) {
  const root = resolve(String(rootDir));
  const atomicWrite = options.atomicWrite ?? atomicWriteFile;

  function paths(id, version) {
    const key = artifactId(id);
    const rev = revision(version);
    const artifactDir = join(root, encodeURIComponent(key));
    const revisionDir = join(artifactDir, `r${rev}`);
    return {
      artifactDir,
      revisionDir,
      contentPath: join(revisionDir, "content.bin"),
      manifestPath: join(revisionDir, "manifest.json"),
    };
  }

  async function readManifest(path, expectedId) {
    try {
      const parsed = JSON.parse(await readFile(path, "utf8"));
      if (!parsed || parsed.artifactId !== expectedId) return null;
      const result = validateArtifactManifest(parsed);
      if (!result.ok) {
        const error = invalidManifest(result.errors);
        error.code = "ARTIFACT_MANIFEST_CORRUPT";
        throw error;
      }
      return result.value;
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      if (error?.code === "ARTIFACT_MANIFEST_CORRUPT") throw error;
      if (error instanceof SyntaxError) {
        const wrapped = new Error(`artifact manifest is corrupt: ${expectedId}`);
        wrapped.code = "ARTIFACT_MANIFEST_CORRUPT";
        throw wrapped;
      }
      throw error;
    }
  }

  async function put({ manifest: draft, content } = {}) {
    const input = draft && typeof draft === "object" && !Array.isArray(draft) ? clone(draft) : {};
    const id = artifactId(input.artifactId);
    const rev = revision(input.revision);
    const body = normalizeContent(content);
    const computedHash = sha256(body);
    if (input.sha256 && String(input.sha256).toLowerCase() !== computedHash) {
      const error = new Error("artifact content does not match manifest sha256");
      error.code = "ARTIFACT_HASH_MISMATCH";
      throw error;
    }
    const manifest = {
      ...input,
      schemaVersion: 1,
      artifactId: id,
      revision: rev,
      path: `${encodeURIComponent(id)}/r${rev}/content.bin`,
      sha256: computedHash,
      createdAt: typeof input.createdAt === "string" && input.createdAt.trim() ? input.createdAt : new Date().toISOString(),
    };
    const validation = validateArtifactManifest(manifest);
    if (!validation.ok) throw invalidManifest(validation.errors);
    const target = paths(id, rev);
    const existing = await readManifest(target.manifestPath, id);
    if (existing) {
      if (existing.sha256 === manifest.sha256 && immutableMetadata(existing) === immutableMetadata(manifest)) {
        return { ok: true, created: false, manifest: clone(existing) };
      }
      return { ok: false, reason: "immutable-conflict", manifest: clone(existing) };
    }
    await mkdir(target.revisionDir, { recursive: true });
    try {
      await atomicWrite(target.contentPath, body);
      await atomicWrite(target.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    } catch (error) {
      await rm(target.revisionDir, { recursive: true, force: true }).catch(() => {});
      throw error;
    }
    return { ok: true, created: true, manifest: clone(manifest) };
  }

  async function revisionsFor(id) {
    const key = artifactId(id);
    const artifactDir = join(root, encodeURIComponent(key));
    try {
      const entries = await readdir(artifactDir, { withFileTypes: true });
      return entries.map((entry) => /^r(\d+)$/.exec(entry.name)?.[1]).filter(Boolean).map(Number).sort((a, b) => b - a);
    } catch (error) {
      if (error?.code === "ENOENT") return [];
      throw error;
    }
  }

  async function read(id, requestedRevision) {
    const reference = parseArtifactReference(id);
    const key = artifactId(reference.artifactId);
    if (reference.exact && requestedRevision !== undefined && Number(requestedRevision) !== reference.revision) {
      const error = new Error(`artifact reference revision mismatch: ${reference.raw}`);
      error.code = "ARTIFACT_REFERENCE_MISMATCH";
      throw error;
    }
    const pinnedRevision = requestedRevision === undefined ? reference.revision : requestedRevision;
    const rev = pinnedRevision === null || pinnedRevision === undefined ? (await revisionsFor(key))[0] : revision(pinnedRevision);
    if (!rev) {
      const error = new Error(`artifact not found: ${key}`);
      error.code = "ARTIFACT_NOT_FOUND";
      throw error;
    }
    const target = paths(key, rev);
    const manifest = await readManifest(target.manifestPath, key);
    if (!manifest || !existsSync(target.contentPath)) {
      const error = new Error(`artifact revision not found: ${key}@${rev}`);
      error.code = "ARTIFACT_NOT_FOUND";
      throw error;
    }
    const body = await readFile(target.contentPath);
    if (sha256(body) !== manifest.sha256) {
      const error = new Error(`artifact hash mismatch: ${key}@${rev}`);
      error.code = "ARTIFACT_HASH_MISMATCH";
      throw error;
    }
    if (reference.exact && manifest.sha256 !== reference.sha256) {
      const error = new Error(`artifact reference hash mismatch: ${reference.raw}`);
      error.code = "ARTIFACT_REFERENCE_HASH_MISMATCH";
      throw error;
    }
    return { manifest: clone(manifest), content: body };
  }

  async function list(id) {
    if (id !== undefined) {
      const key = artifactId(id);
      const entries = [];
      for (const rev of await revisionsFor(key)) {
        const manifest = await readManifest(paths(key, rev).manifestPath, key);
        if (manifest) entries.push(clone(manifest));
      }
      return entries;
    }
    if (!existsSync(root)) return [];
    const entries = await readdir(root, { withFileTypes: true });
    const manifests = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      let key;
      try { key = decodeURIComponent(entry.name); artifactId(key); } catch { continue; }
      manifests.push(...await list(key));
    }
    return manifests.sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)) || Number(right.revision) - Number(left.revision));
  }

  return { root, list, paths, put, read };
}
