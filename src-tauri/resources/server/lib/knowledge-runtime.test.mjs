import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { createKnowledgeRuntime } from "./knowledge-runtime.mjs";

const fixtureRoots = [];
afterEach(() => {
  for (const root of fixtureRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function createFixture({ apiKey = "", querySemanticGroups = null, getKnowledgeDocumentState = null, buildIndex = null } = {}) {
  const root = mkdtempSync(join(tmpdir(), "visionox-knowledge-runtime-"));
  fixtureRoots.push(root);
  const configPath = join(root, "config.json");
  let config = {
    semantic: {
      provider: "openai-compat",
      openaiCompat: { baseUrl: "http://embedding.test/v1/embeddings", model: "test-embedding", apiKey },
    },
  };
  let queryCount = 0;
  let indexResult = { committed: true, chunksSkipped: 0, skipBuckets: {} };
  const runtime = createKnowledgeRuntime({
    configPath,
    loadSemanticEmbeddingUserConfig: () => config.semantic,
    registerSemanticSearchTool: async () => true,
    querySemanticGroups: querySemanticGroups ?? (async () => {
      queryCount++;
      return { knowledge: [{ score: 0.9, entry: { path: "knowledge/topic.md", startLine: 1, endLine: 2, text: "durable project fact" } }], workspace: [] };
    }),
    buildIndex: buildIndex ?? (async () => indexResult),
    loadIndexConfig: () => ({}),
    readConfig: () => config,
    writeConfig: (next) => { config = next; },
    atomicWriteFile: (target, content) => {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content, "utf8");
    },
    getActiveWorkspace: () => root,
    getKnowledgeDocumentState: getKnowledgeDocumentState ?? (() => null),
  });
  return {
    root,
    configPath,
    runtime,
    get queryCount() { return queryCount; },
    set indexResult(value) { indexResult = value; },
    get config() { return config; },
  };
}

describe("knowledge runtime", () => {
  test("reconciles topic files and keeps writes bound to the workspace", () => {
    const fixture = createFixture();
    const topicPath = join(fixture.root, "knowledge", "topics", "manual.md");
    mkdirSync(dirname(topicPath), { recursive: true });
    writeFileSync(topicPath, "---\ntopicId: manual\nqualityScore: 80\n---\n# Manual topic\n", "utf8");

    const manifest = fixture.runtime.readManifest(fixture.root);
    assert.deepEqual(manifest.reconciliation.discoveredPaths, ["topics/manual.md"]);
    assert.equal(manifest.topics[0].manualEdited, true);
    fixture.runtime.writeManifest(fixture.root, { ...manifest, indexDirty: true });
    const stored = JSON.parse(readFileSync(join(fixture.root, "knowledge", ".manifest.json"), "utf8"));
    assert.equal(stored.version, 2);
    assert.equal(stored.indexDirty, true);
  });

  test("binds semantic retrieval to the registered workspace and caches by query", async () => {
    const fixture = createFixture();
    let added = 0;
    const tools = { specs: () => [{ function: { name: "semantic_search" } }] };
    assert.equal(await fixture.runtime.registerSemanticSearch(tools, fixture.root, { addToolToPrefix: () => { added++; } }), true);
    const first = await fixture.runtime.retrieve({ text: "where is the project fact?", recentMessages: [], workspace: fixture.root, mode: "auto" });
    const second = await fixture.runtime.retrieve({ text: "where is the project fact?", recentMessages: [], workspace: fixture.root, mode: "auto" });
    const mismatch = await fixture.runtime.retrieve({ text: "where is the project fact?", recentMessages: [], workspace: join(fixture.root, "other"), mode: "auto" });
    assert.equal(first.status, "completed");
    assert.equal(second.cached, true);
    assert.equal(fixture.queryCount, 1);
    assert.equal(mismatch.status, "workspace-mismatch");
    assert.equal(added, 1);
  });

  test("filters deleted and stale upload hits before they enter model context", async () => {
    let revision = 2;
    let queries = 0;
    const fixture = createFixture({
      querySemanticGroups: async () => {
        queries += 1;
        return {
          knowledge: [
            { score: 0.95, entry: { path: "knowledge/uploads/deleted.md", mtimeMs: 10, text: "deleted secret" } },
            { score: 0.9, entry: { path: "knowledge/uploads/current.md", mtimeMs: 20, text: "current fact" } },
            { score: 0.8, entry: { path: "knowledge/topics/decision.md", mtimeMs: 1, text: "curated decision" } },
          ],
          workspace: [],
        };
      },
      getKnowledgeDocumentState: () => ({
        contentRevision: revision,
        indexedRevision: 1,
        documents: [{
          documentId: "current-id",
          sourceName: "current.pdf",
          sourceType: "pdf",
          contentHash: "current-hash",
          markdownPath: "knowledge/uploads/current.md",
          mtimeMs: 20,
          status: "indexed",
          indexedRevision: 1,
        }],
        tombstones: [{ markdownPath: "knowledge/uploads/deleted.md" }],
      }),
    });
    await fixture.runtime.registerSemanticSearch({ specs: () => [] }, fixture.root);
    const first = await fixture.runtime.retrieve({ text: "find current", recentMessages: [], workspace: fixture.root, mode: "auto" });
    assert.doesNotMatch(first.input, /deleted secret/);
    assert.match(first.input, /current fact/);
    assert.equal(first.sources.find((source) => source.path.endsWith("current.md")).documentId, "current-id");
    revision = 3;
    await fixture.runtime.retrieve({ text: "find current", recentMessages: [], workspace: fixture.root, mode: "auto" });
    assert.equal(queries, 2, "catalog revision must invalidate semantic retrieval cache keys");
  });

  test("preserves a dirty manifest when index chunks fail", async () => {
    const fixture = createFixture({ apiKey: "configured" });
    fixture.indexResult = { committed: false, chunksSkipped: 2, skipBuckets: { readError: 1 } };
    const result = await fixture.runtime.updateSemanticIndex({ knowledgeAutoIndex: true, workspaceDir: fixture.root });
    assert.match(result.status, /^pending:/);
    assert.equal(fixture.runtime.readManifest(fixture.root).indexDirty, true);
    assert.equal(fixture.config.index.includeKnowledgeDocs, true);
  });

  test("does not attempt an embedding request without an API key", async () => {
    const fixture = createFixture();
    const result = await fixture.runtime.updateSemanticIndex({ knowledgeAutoIndex: true, workspaceDir: fixture.root });
    assert.equal(result.status, "skipped: embedding API key is not configured");
  });

  test("propagates cancellation and forwards a forced rebuild request", async () => {
    let observedOptions = null;
    const fixture = createFixture({
      apiKey: "configured",
      buildIndex: async (_workspace, options) => {
        observedOptions = options;
        await new Promise((resolvePromise) => options.signal.addEventListener("abort", resolvePromise, { once: true }));
        throw Object.assign(new Error("cancelled"), { name: "AbortError" });
      },
    });
    const controller = new AbortController();
    const pending = fixture.runtime.updateSemanticIndex({
      knowledgeAutoIndex: true,
      knowledgeForceRebuild: true,
      workspaceDir: fixture.root,
    }, controller.signal);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
    controller.abort();
    await assert.rejects(pending, { name: "AbortError" });
    assert.equal(observedOptions.rebuild, true);
    assert.equal(fixture.runtime.readManifest(fixture.root).indexDirty, true);
  });

  test("keeps the newest workspace binding when registrations complete out of order", async () => {
    const fixture = createFixture();
    const second = join(fixture.root, "second");
    mkdirSync(second, { recursive: true });
    const pending = new Map();
    const runtime = createKnowledgeRuntime({
      configPath: fixture.configPath,
      loadSemanticEmbeddingUserConfig: () => fixture.config.semantic,
      registerSemanticSearchTool: async (_tools, options) => new Promise((resolve) => pending.set(options.root, resolve)),
      querySemanticGroups: async () => ({ knowledge: [], workspace: [] }),
      buildIndex: async () => ({ committed: true, chunksSkipped: 0, skipBuckets: {} }),
      loadIndexConfig: () => ({}),
      readConfig: () => fixture.config,
      writeConfig: () => {},
      atomicWriteFile: (target, content) => {
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, content, "utf8");
      },
    });
    const firstRegistration = runtime.registerSemanticSearch({}, fixture.root);
    const secondRegistration = runtime.registerSemanticSearch({}, second);
    pending.get(second)(true);
    pending.get(fixture.root)(true);
    await Promise.all([firstRegistration, secondRegistration]);
    assert.equal(runtime.isSemanticAvailable(), true);
    assert.equal(runtime.getBoundWorkspace(), resolve(second));
  });

  test("refuses to dirty an invalid manifest instead of overwriting it", () => {
    const fixture = createFixture();
    const manifestPath = join(fixture.root, "knowledge", ".manifest.json");
    mkdirSync(dirname(manifestPath), { recursive: true });
    writeFileSync(manifestPath, JSON.stringify({ version: 2, topics: "corrupt" }), "utf8");
    assert.throws(() => fixture.runtime.setIndexDirty(fixture.root, true), /knowledge manifest is read-only/);
    assert.deepEqual(JSON.parse(readFileSync(manifestPath, "utf8")), { version: 2, topics: "corrupt" });
  });
});
