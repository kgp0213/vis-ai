import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
} from "node:fs";
import { basename, resolve, sep } from "node:path";

import {
  buildSemanticRetrievalCacheKey,
  buildRetrievalQuery,
  buildRetrievedModelInput,
  rerankRetrievalHits,
  selectRetrievalHits,
} from "./semantic-retrieval.mjs";
import { knowledgeEvaluationBackoff, reconcileKnowledgeTopics } from "./session-knowledge.mjs";
import {
  assertVersionedJsonWritable,
  readVersionedJsonFile,
  writeVersionedJsonFile,
} from "./versioned-json-file.mjs";

const KNOWLEDGE_MANIFEST_VERSION = 2;
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_CACHE_MAX = 100;

function requiredFunction(value, name) {
  if (typeof value !== "function") throw new TypeError(`knowledge runtime ${name} dependency is required`);
  return value;
}

function validateManifest(value) {
  return Array.isArray(value.topics)
    && Array.isArray(value.sources)
    && Array.isArray(value.processedSourceFingerprints)
    || "knowledge manifest arrays are invalid";
}

function semanticProviderConfig(semantic) {
  const provider = semantic?.provider === "openai-compat" ? "openai-compat" : "ollama";
  const config = provider === "openai-compat" ? semantic?.openaiCompat : semantic?.ollama;
  return { provider, config: config ?? {} };
}

/**
 * Owns knowledge persistence, semantic retrieval state and index lifecycle.
 * Model requests remain injected by the Launcher, so this runtime cannot
 * create a competing model or tool execution loop.
 */
export function createKnowledgeRuntime({
  configPath,
  loadSemanticEmbeddingUserConfig,
  registerSemanticSearchTool,
  querySemanticGroups,
  buildIndex,
  loadIndexConfig,
  readConfig,
  writeConfig,
  atomicWriteFile,
  getActiveWorkspace = () => null,
  sameWorkspacePath = (left, right) => resolve(left) === resolve(right),
  onPersistentIssue = () => {},
  onActiveIndexUpdated = async () => {},
  now = () => new Date(),
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
  cacheMax = DEFAULT_CACHE_MAX,
  getKnowledgeDocumentState = () => null,
} = {}) {
  if (!configPath) throw new TypeError("knowledge runtime configPath is required");
  const loadSemanticConfig = requiredFunction(loadSemanticEmbeddingUserConfig, "loadSemanticEmbeddingUserConfig");
  const registerSemanticTool = requiredFunction(registerSemanticSearchTool, "registerSemanticSearchTool");
  const queryGroups = requiredFunction(querySemanticGroups, "querySemanticGroups");
  const rebuildIndex = requiredFunction(buildIndex, "buildIndex");
  const loadIndex = requiredFunction(loadIndexConfig, "loadIndexConfig");
  const readUserConfig = requiredFunction(readConfig, "readConfig");
  const writeUserConfig = requiredFunction(writeConfig, "writeConfig");
  const writeAtomic = requiredFunction(atomicWriteFile, "atomicWriteFile");

  const retrievalCache = new Map();
  let semanticAvailable = false;
  let boundWorkspace = null;
  let registrationGeneration = 0;
  let loadKnowledgeDocumentState = typeof getKnowledgeDocumentState === "function" ? getKnowledgeDocumentState : () => null;

  function clearRetrievalCache() {
    retrievalCache.clear();
  }

  function paths(workspace) {
    const projectRoot = resolve(workspace);
    const root = resolve(projectRoot, "knowledge");
    const legacyRoot = resolve(projectRoot, ".visionox", "knowledge");
    if (!(root === projectRoot || root.startsWith(projectRoot + sep))) {
      throw new Error("knowledge directory escapes the bound workspace");
    }
    if (existsSync(projectRoot)) {
      const projectReal = realpathSync(projectRoot);
      if (existsSync(legacyRoot) && !existsSync(root)) {
        const legacyReal = realpathSync(legacyRoot);
        if (!(legacyReal === projectReal || legacyReal.startsWith(projectReal + sep))) {
          throw new Error("legacy knowledge directory resolves outside the bound workspace");
        }
        renameSync(legacyRoot, root);
      }
      for (const candidate of [root, resolve(root, "topics"), resolve(root, "rejected")]) {
        if (!existsSync(candidate)) continue;
        const candidateReal = realpathSync(candidate);
        if (!(candidateReal === projectReal || candidateReal.startsWith(projectReal + sep))) {
          throw new Error("knowledge directory resolves outside the bound workspace");
        }
      }
    }
    return {
      projectRoot,
      root,
      topicsDir: resolve(root, "topics"),
      rejectedDir: resolve(root, "rejected"),
      manifestPath: resolve(root, ".manifest.json"),
    };
  }

  function readManifest(workspace) {
    const knowledgePaths = paths(workspace);
    const stored = readVersionedJsonFile(knowledgePaths.manifestPath, {
      version: KNOWLEDGE_MANIFEST_VERSION,
      validate: validateManifest,
    });
    const parsed = stored.ok ? stored.value ?? {} : {};
    onPersistentIssue(`knowledge:${knowledgePaths.projectRoot}`, knowledgePaths.manifestPath, stored.error);
    try {
      const topicReadFailures = [];
      const diskPaths = new Set(existsSync(knowledgePaths.topicsDir)
        ? readdirSync(knowledgePaths.topicsDir)
          .filter((name) => name.toLowerCase().endsWith(".md"))
          .map((name) => `topics/${name}`)
        : []);
      const reconciled = reconcileKnowledgeTopics(parsed?.topics, diskPaths);
      const topics = reconciled.topics.map((topic) => {
        const target = resolve(knowledgePaths.root, topic.path);
        let contentHash = null;
        try {
          contentHash = createHash("sha256").update(readFileSync(target)).digest("hex").slice(0, 16);
        } catch (error) {
          topicReadFailures.push(`${topic.path}: ${error.message}`);
        }
        return {
          ...topic,
          contentHash: topic.contentHash || contentHash,
          manualEdited: topic.manualEdited === true
            || contentHash === null
            || Boolean(topic.contentHash && topic.contentHash !== contentHash),
        };
      });
      const trackedPaths = new Set(topics.map((topic) => topic.path));
      const discoveredPaths = [];
      for (const path of diskPaths) {
        if (trackedPaths.has(path)) continue;
        const target = resolve(knowledgePaths.root, path);
        try {
          const markdown = readFileSync(target, "utf8");
          const id = (/^topicId:\s*(.+)$/m.exec(markdown)?.[1] || basename(path, ".md")).trim();
          const title = (/^#\s+(.+)$/m.exec(markdown)?.[1] || id).trim();
          const qualityScore = Number(/^qualityScore:\s*(\d+(?:\.\d+)?)$/m.exec(markdown)?.[1] || 0);
          const contentHash = createHash("sha256").update(markdown).digest("hex").slice(0, 16);
          topics.push({
            id,
            title,
            path,
            sourceSessions: [],
            qualityScore,
            contentHash,
            manualEdited: true,
            discoveredAt: now().toISOString(),
          });
          discoveredPaths.push(path);
        } catch (error) {
          topicReadFailures.push(`${path}: ${error.message}`);
        }
      }
      onPersistentIssue(
        `knowledge-topics:${knowledgePaths.projectRoot}`,
        knowledgePaths.topicsDir,
        topicReadFailures.length ? `some knowledge topics could not be read: ${topicReadFailures.join("; ")}` : null,
        "warning",
      );
      return {
        version: KNOWLEDGE_MANIFEST_VERSION,
        topics,
        sources: Array.isArray(parsed?.sources)
          ? parsed.sources.filter((item) => item && typeof item.name === "string").slice(-5000)
          : [],
        processedSourceFingerprints: Array.isArray(parsed?.processedSourceFingerprints)
          ? parsed.processedSourceFingerprints.filter((item) => typeof item === "string").slice(-100)
          : [],
        indexDirty: parsed?.indexDirty === true || reconciled.removedIds.length > 0 || discoveredPaths.length > 0,
        reconciliation: { removedTopicIds: reconciled.removedIds, discoveredPaths },
        readOnlyError: stored.error,
      };
    } catch (error) {
      const readOnlyError = stored.error ?? `knowledge manifest reconciliation failed: ${error.message}`;
      onPersistentIssue(`knowledge:${knowledgePaths.projectRoot}`, knowledgePaths.manifestPath, readOnlyError);
      return {
        version: KNOWLEDGE_MANIFEST_VERSION,
        topics: [],
        sources: [],
        processedSourceFingerprints: [],
        indexDirty: false,
        reconciliation: { removedTopicIds: [], discoveredPaths: [] },
        readOnlyError,
      };
    }
  }

  function writeManifest(workspace, manifest) {
    if (manifest?.readOnlyError) {
      throw new Error(`knowledge manifest is read-only: ${manifest.readOnlyError}`);
    }
    const knowledgePaths = paths(workspace);
    assertVersionedJsonWritable(knowledgePaths.manifestPath, {
      version: KNOWLEDGE_MANIFEST_VERSION,
      validate: validateManifest,
    });
    const value = {
      version: KNOWLEDGE_MANIFEST_VERSION,
      updatedAt: now().toISOString(),
      topics: Array.isArray(manifest.topics) ? manifest.topics : [],
      sources: Array.isArray(manifest.sources) ? manifest.sources.slice(-5000) : [],
      processedSourceFingerprints: Array.isArray(manifest.processedSourceFingerprints)
        ? manifest.processedSourceFingerprints.slice(-100)
        : [],
      indexDirty: manifest.indexDirty === true,
    };
    writeVersionedJsonFile(knowledgePaths.manifestPath, value, { version: KNOWLEDGE_MANIFEST_VERSION });
    onPersistentIssue(`knowledge:${knowledgePaths.projectRoot}`, knowledgePaths.manifestPath, null);
    return value;
  }

  function writeKnowledgeFile(target, content) {
    writeAtomic(target, content);
  }

  function setIndexDirty(workspace, dirty) {
    const manifest = readManifest(workspace);
    if (manifest.readOnlyError) {
      throw new Error(`knowledge manifest is read-only: ${manifest.readOnlyError}`);
    }
    manifest.indexDirty = dirty === true;
    writeManifest(workspace, manifest);
  }

  function getCached(key) {
    const cached = retrievalCache.get(key);
    if (!cached) return null;
    if (Date.now() - cached.at >= cacheTtlMs) {
      retrievalCache.delete(key);
      return null;
    }
    retrievalCache.delete(key);
    retrievalCache.set(key, cached);
    return cached.hits;
  }

  function setCached(key, hits) {
    retrievalCache.set(key, { at: Date.now(), hits });
    while (retrievalCache.size > cacheMax) {
      retrievalCache.delete(retrievalCache.keys().next().value);
    }
  }

  async function registerSemanticSearch(tools, workspace, { addToolToPrefix = null } = {}) {
    const generation = ++registrationGeneration;
    const requestedWorkspace = resolve(workspace);
    semanticAvailable = false;
    boundWorkspace = null;
    clearRetrievalCache();
    const semantic = loadSemanticConfig(configPath);
    const { provider, config } = semanticProviderConfig(semantic);
    const registered = await registerSemanticTool(tools, {
      root: workspace,
      provider,
      model: config.model,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      extraBody: config.extraBody,
    });
    if (generation !== registrationGeneration) return registered === true;
    semanticAvailable = registered === true;
    boundWorkspace = semanticAvailable ? requestedWorkspace : null;
    if (semanticAvailable && typeof addToolToPrefix === "function") {
      const spec = tools.specs().find((item) => item.function?.name === "semantic_search");
      if (spec) addToolToPrefix(spec);
    }
    return semanticAvailable;
  }

  async function retrieve({ text, recentMessages, workspace, mode, signal } = {}) {
    const startedAt = Date.now();
    if (mode !== "auto") return { input: text, sources: [], status: "disabled", elapsedMs: 0 };
    if (!semanticAvailable) return { input: text, sources: [], status: "unavailable", elapsedMs: 0 };
    if (!boundWorkspace || !sameWorkspacePath(boundWorkspace, workspace)) {
      return { input: text, sources: [], status: "workspace-mismatch", elapsedMs: 0 };
    }
    const query = buildRetrievalQuery(text, recentMessages);
    if (!query) return { input: text, sources: [], status: "empty", elapsedMs: 0 };
    const semantic = loadSemanticConfig(configPath);
    const { provider, config } = semanticProviderConfig(semantic);
    const documentState = loadKnowledgeDocumentState(workspace);
    const cacheKey = buildSemanticRetrievalCacheKey({
      workspace,
      query,
      provider,
      model: config.model,
      baseUrl: config.baseUrl,
      extraBody: config.extraBody,
      apiKey: config.apiKey,
      knowledgeRevision: documentState
        ? `${Number(documentState.contentRevision) || 0}:${Number(documentState.indexedRevision) || 0}`
        : "",
    });
    const cached = getCached(cacheKey);
    if (cached) {
      return {
        ...buildRetrievedModelInput(text, cached),
        status: cached.length > 0 ? "completed" : "empty",
        cached: true,
        elapsedMs: Date.now() - startedAt,
      };
    }
    const timeoutSignal = AbortSignal.timeout(3000);
    const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
    try {
      const groups = await queryGroups(workspace, query, {
        knowledgeTopK: 24,
        workspaceTopK: 24,
        minScore: 0.3,
        provider,
        model: config.model,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        extraBody: config.extraBody,
        signal: combinedSignal,
      });
      if (!groups) return { input: text, sources: [], status: "unavailable", elapsedMs: Date.now() - startedAt };
      const tombstones = new Set((documentState?.tombstones || []).map((item) => String(item.markdownPath || "").replaceAll("\\", "/")));
      const documents = new Map((documentState?.documents || []).map((item) => [String(item.markdownPath || "").replaceAll("\\", "/"), item]));
      const knowledgeHits = (groups.knowledge || []).flatMap((hit) => {
        const path = String(hit?.entry?.path || "").replaceAll("\\", "/");
        if (!path.startsWith("knowledge/uploads/")) return [hit];
        if (tombstones.has(path)) return [];
        const document = documents.get(path);
        if (!document || document.status === "failed" || Number(document.indexedRevision || 0) <= 0) return [];
        if (Number(document.mtimeMs) !== Number(hit?.entry?.mtimeMs)) return [];
        return [{
          ...hit,
          entry: {
            ...hit.entry,
            knowledgeDocument: {
              documentId: document.documentId,
              sourceName: document.sourceName,
              sourceType: document.sourceType,
              contentHash: document.contentHash,
            },
          },
        }];
      });
      const selected = selectRetrievalHits(rerankRetrievalHits([...knowledgeHits, ...(groups.workspace || [])], query));
      setCached(cacheKey, selected);
      return {
        ...buildRetrievedModelInput(text, selected),
        status: selected.length > 0 ? "completed" : "empty",
        elapsedMs: Date.now() - startedAt,
      };
    } catch (error) {
      if (signal?.aborted) throw error;
      const timedOut = timeoutSignal.aborted || /timeout|timed out/i.test(String(error?.message || ""));
      return {
        input: text,
        sources: [],
        status: timedOut ? "timeout" : "error",
        error: String(error?.message || error).slice(0, 240),
        elapsedMs: Date.now() - startedAt,
      };
    }
  }

  async function updateSemanticIndex(task, signal) {
    if (!task.knowledgeAutoIndex) return { requested: false, status: "disabled" };
    const semantic = loadSemanticConfig(configPath);
    if (semantic.provider === "openai-compat" && !semantic.openaiCompat?.apiKey?.trim()) {
      return { requested: true, status: "skipped: embedding API key is not configured" };
    }
    const config = readUserConfig(configPath);
    config.index = { ...(config.index ?? {}), includeKnowledgeDocs: true };
    writeUserConfig(config, configPath);
    try {
      const result = await rebuildIndex(task.workspaceDir, {
        rebuild: task.knowledgeForceRebuild === true,
        configPath,
        signal,
        indexConfig: { ...loadIndex(configPath), includeKnowledgeDocs: true },
      });
      const activeWorkspace = getActiveWorkspace();
      if (activeWorkspace && sameWorkspacePath(task.workspaceDir, activeWorkspace)) {
        await onActiveIndexUpdated(task.workspaceDir);
      }
      if (result.committed === false || result.chunksSkipped > 0 || result.skipBuckets?.readError > 0) {
        setIndexDirty(task.workspaceDir, true);
        return {
          requested: true,
          status: `pending: ${result.chunksSkipped} embedding chunk(s) failed and the previous index was preserved`,
          result,
        };
      }
      if (task.deferDirtyFinalization !== true) setIndexDirty(task.workspaceDir, false);
      return { requested: true, status: "completed", result };
    } catch (error) {
      setIndexDirty(task.workspaceDir, true);
      if (signal?.aborted || error?.name === "AbortError") throw error;
      return {
        requested: true,
        status: `pending: ${error.message}`,
        error: { code: String(error?.code || "knowledge_index_failed"), message: String(error?.message || error) },
      };
    }
  }

  return {
    clearRetrievalCache,
    evaluationBackoff: knowledgeEvaluationBackoff,
    getBoundWorkspace: () => boundWorkspace,
    isSemanticAvailable: () => semanticAvailable,
    paths,
    readManifest,
    registerSemanticSearch,
    retrieve,
    setDocumentStateProvider: (provider) => {
      loadKnowledgeDocumentState = typeof provider === "function" ? provider : () => null;
      clearRetrievalCache();
    },
    setIndexDirty,
    updateSemanticIndex,
    writeKnowledgeFile,
    writeManifest,
  };
}
