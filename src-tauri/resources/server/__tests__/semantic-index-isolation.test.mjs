import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { promises as fsPromises, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const semanticChunkUrl = new URL("../visionox-pkg/dist/cli/chunk-XCGGEJTI.js", import.meta.url);
const { INDEX_DIR_NAME, SemanticStore, buildIndex, resolveIndexIdentity, semanticIndexDirForRoot, walkChunks } = await import(semanticChunkUrl.href);

const embeddingOptions = { provider: "openai-compat", baseUrl: "https://embedding.test/v1", apiKey: "test", model: "test-model", extraBody: {} };
const entry = (path, text, vector = [1, 0]) => ({ path, text, startLine: 1, endLine: 1, mtimeMs: 1, embedding: new Float32Array(vector) });

describe("semantic index project isolation", () => {
  test("each project receives a stable directory below the semantic root", () => {
    const first = semanticIndexDirForRoot("C:/work/project-a");
    const same = semanticIndexDirForRoot("C:/work/project-a");
    const second = semanticIndexDirForRoot("C:/work/project-b");

    assert.equal(first, same);
    assert.notEqual(first, second);
    assert.notEqual(first, INDEX_DIR_NAME);
    assert.equal(first.startsWith(join(INDEX_DIR_NAME, "projects")), true);
    assert.match(first.slice(join(INDEX_DIR_NAME, "projects").length), /[\\/]?[a-f0-9]{64}$/);
  });

  test("index identity covers endpoint and request shape but excludes the API key", () => {
    const first = resolveIndexIdentity({ ...embeddingOptions, apiKey: "first", extraBody: { z: 1, nested: { b: 2, a: 1 } } });
    const reordered = resolveIndexIdentity({ ...embeddingOptions, apiKey: "second", extraBody: { nested: { a: 1, b: 2 }, z: 1 } });
    const differentPath = resolveIndexIdentity({ ...embeddingOptions, baseUrl: "https://embedding.test/V1", extraBody: { nested: { a: 1, b: 2 }, z: 1 } });
    assert.equal(first.configFingerprint, reordered.configFingerprint);
    assert.notEqual(first.configFingerprint, differentPath.configFingerprint);
  });

  test("build, query, existence and compatibility checks all use the project directory", () => {
    const source = readFileSync(semanticChunkUrl, "utf8");
    assert.match(source, /buildIndex[\s\S]*?const indexDir = semanticIndexDirForRoot\(root\)/);
    assert.match(source, /querySemantic[\s\S]*?const indexDir = semanticIndexDirForRoot\(root\)/);
    assert.match(source, /indexExists[\s\S]*?semanticIndexDirForRoot\(root\)/);
    assert.match(source, /indexCompatible[\s\S]*?semanticIndexDirForRoot\(root\)/);
    assert.match(source, /replacePathsAtomically/);
    assert.match(source, /entries\.length !== bucket\.chunks\.length/);
    assert.match(source, /STORE_CACHE_MAX = 4/);
    assert.match(source, /querySemanticGroups/);
  });

  test("knowledge indexing admits only Markdown below the workspace knowledge directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "visionox-semantic-knowledge-"));
    try {
      await mkdir(join(root, "knowledge", "topics"), { recursive: true });
      await mkdir(join(root, ".visionox", "knowledge", "topics"), { recursive: true });
      await mkdir(join(root, ".visionox", "skills", "private"), { recursive: true });
      await writeFile(join(root, "README.md"), "workspace readme", "utf8");
      await writeFile(join(root, "knowledge", "topics", "auth.md"), "authentication decision", "utf8");
      await writeFile(join(root, "knowledge", "topics", "state.json"), "{}", "utf8");
      await writeFile(join(root, ".visionox", "knowledge", "topics", "legacy.md"), "legacy knowledge must stay excluded", "utf8");
      await writeFile(join(root, ".visionox", "skills", "private", "SKILL.md"), "must stay excluded", "utf8");

      const chunks = [];
      for await (const chunk of walkChunks(root, {
        config: {
          excludeDirs: [".visionox", "knowledge"],
          excludeFiles: [],
          excludeExts: [],
          excludePatterns: [],
          respectGitignore: false,
          includeKnowledgeDocs: true,
          maxFileBytes: 262144,
        },
      })) chunks.push(chunk.path);

      assert.ok(chunks.includes("README.md"));
      assert.ok(chunks.includes("knowledge/topics/auth.md"));
      assert.equal(chunks.some((path) => path.includes("legacy.md")), false);
      assert.equal(chunks.some((path) => path.includes("state.json")), false);
      assert.equal(chunks.some((path) => path.includes("skills/private")), false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("file replacement validates all new vectors before removing the old file", async () => {
    const indexDir = await mkdtemp(join(tmpdir(), "visionox-semantic-store-"));
    const store = new SemanticStore(indexDir, { provider: "openai-compat", model: "test-model" });
    try {
      await store.add([
        entry("changed.md", "old", [1, 0]),
        entry("stable.md", "stable", [0, 1]),
      ]);
      await assert.rejects(
        store.replacePathsAtomically([entry("changed.md", "invalid", [1, 0, 0])], ["changed.md"]),
        /embedding dim mismatch/,
      );
      assert.equal(store.all.find((item) => item.path === "changed.md")?.text, "old");

      await store.replacePathsAtomically([entry("changed.md", "new", [0.5, 0.5])], ["changed.md"]);
      assert.equal(store.all.find((item) => item.path === "changed.md")?.text, "new");
      assert.equal(store.all.find((item) => item.path === "stable.md")?.text, "stable");
    } finally {
      await rm(indexDir, { recursive: true, force: true });
    }
  });

  test("serializes concurrent builds for the same project", async () => {
    const root = await mkdtemp(join(tmpdir(), "visionox-semantic-lock-root-"));
    const indexDir = await mkdtemp(join(tmpdir(), "visionox-semantic-lock-index-"));
    let active = 0;
    let peak = 0;
    const probeEmbeddingProvider = async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 20));
      active--;
    };
    async function* noChunks() {}
    try {
      await Promise.all([1, 2, 3].map(() => buildIndex(root, {
        ...embeddingOptions,
        testHooks: { indexDir, probeEmbeddingProvider, walkChunks: noChunks },
      })));
      assert.equal(peak, 1);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(indexDir, { recursive: true, force: true });
    }
  });

  test("a failed rebuild preserves the previous index", async () => {
    const root = await mkdtemp(join(tmpdir(), "visionox-semantic-rebuild-root-"));
    const indexDir = await mkdtemp(join(tmpdir(), "visionox-semantic-rebuild-index-"));
    const store = new SemanticStore(indexDir, resolveIndexIdentity(embeddingOptions));
    async function* changedFile(_root, opts) {
      opts.onFile?.("changed.md");
      yield { path: "changed.md", text: "new", startLine: 1, endLine: 1 };
    }
    try {
      await writeFile(join(root, "changed.md"), "new", "utf8");
      await store.add([entry("changed.md", "old")]);
      const before = await readFile(join(indexDir, "index.jsonl"), "utf8");
      const result = await buildIndex(root, {
        ...embeddingOptions,
        rebuild: true,
        testHooks: {
          indexDir,
          probeEmbeddingProvider: async () => {},
          walkChunks: changedFile,
          embedAll: async (_texts, opts) => { opts.onError?.(0, new Error("injected")); return [null]; },
        },
      });
      assert.equal(result.committed, false);
      assert.equal(result.preservedPrevious, true);
      assert.equal(result.chunksAdded, 0);
      assert.equal(await readFile(join(indexDir, "index.jsonl"), "utf8"), before);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(indexDir, { recursive: true, force: true });
    }
  });

  test("a traversal failure does not delete old entries below that directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "visionox-semantic-read-root-"));
    const indexDir = await mkdtemp(join(tmpdir(), "visionox-semantic-read-index-"));
    const store = new SemanticStore(indexDir, resolveIndexIdentity(embeddingOptions));
    async function* unreadableDirectory(_root, opts) { opts.onTraversalError?.("locked", new Error("injected")); }
    try {
      await store.add([entry("locked/keep.md", "keep")]);
      const before = await readFile(join(indexDir, "index.jsonl"), "utf8");
      await buildIndex(root, {
        ...embeddingOptions,
        testHooks: { indexDir, probeEmbeddingProvider: async () => {}, walkChunks: unreadableDirectory },
      });
      assert.equal(await readFile(join(indexDir, "index.jsonl"), "utf8"), before);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(indexDir, { recursive: true, force: true });
    }
  });

  test("a readable file that became empty removes its stale vectors", async () => {
    const root = await mkdtemp(join(tmpdir(), "visionox-semantic-empty-root-"));
    const indexDir = await mkdtemp(join(tmpdir(), "visionox-semantic-empty-index-"));
    const store = new SemanticStore(indexDir, resolveIndexIdentity(embeddingOptions));
    async function* emptyFile(_root, opts) { opts.onFile?.("empty.md"); }
    try {
      await store.add([entry("empty.md", "old")]);
      const result = await buildIndex(root, {
        ...embeddingOptions,
        testHooks: { indexDir, probeEmbeddingProvider: async () => {}, walkChunks: emptyFile },
      });
      assert.ok(result.chunksRemoved > 0);
      assert.equal((await readFile(join(indexDir, "index.jsonl"), "utf8")).trim(), "");
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(indexDir, { recursive: true, force: true });
    }
  });

  test("rolls back both store files when the metadata commit fails", async () => {
    const indexDir = await mkdtemp(join(tmpdir(), "visionox-semantic-rollback-"));
    const store = new SemanticStore(indexDir, resolveIndexIdentity(embeddingOptions));
    const originalRename = fsPromises.rename;
    try {
      await store.add([entry("stable.md", "old")]);
      const oldData = await readFile(join(indexDir, "index.jsonl"), "utf8");
      const oldMeta = await readFile(join(indexDir, "index.meta.json"), "utf8");
      fsPromises.rename = async (source, destination) => {
        if (String(destination).endsWith("index.meta.json")) throw new Error("injected metadata commit failure");
        return originalRename.call(fsPromises, source, destination);
      };
      await assert.rejects(store.replacePathsAtomically([entry("stable.md", "new")], ["stable.md"]), /injected metadata/);
      assert.equal(store.all[0].text, "old");
      assert.equal(await readFile(join(indexDir, "index.jsonl"), "utf8"), oldData);
      assert.equal(await readFile(join(indexDir, "index.meta.json"), "utf8"), oldMeta);
    } finally {
      fsPromises.rename = originalRename;
      await rm(indexDir, { recursive: true, force: true });
    }
  });
});
