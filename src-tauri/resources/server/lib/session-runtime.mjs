import { createWriteStream } from "node:fs";
import { access, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { activeEntriesForDashboard, activeEntriesForModel, parseActiveSessionJsonl, serializeActiveSession, withPendingUserEntry } from "./active-session.mjs";

/**
 * Owns active-session persistence and recovery. The Launcher supplies the
 * application state adapters; this module never builds or schedules a model
 * loop and therefore cannot become a second execution engine.
 */
export function createSessionRuntime({
  activeSessionFile,
  activeSessionMetaFile,
  sessionsDir,
  metaStore,
  atomicWriteFile,
  getMessages,
  clearMessages,
  pushMessage,
  getNextMessageId,
  setNextMessageId,
  getLoop = () => null,
  getConversationId = () => null,
  getWorkspace = () => null,
  getMode = () => "general",
  modeSummary = (mode) => ({ label: mode, description: "" }),
  getSessionMemories = () => [],
  getIndexRetrievalMode = () => "off",
  applyLoadedMetadata = () => {},
  onPersistentIssue = () => {},
  onEvent = () => {},
  onLog = () => {},
  hasUserMessage = () => false,
  writeSessionMeta = async () => {},
  now = () => new Date(),
} = {}) {
  if (!activeSessionFile || !activeSessionMetaFile || !sessionsDir) {
    throw new TypeError("session runtime paths are required");
  }
  if (!metaStore || typeof metaStore.update !== "function" || typeof metaStore.read !== "function") {
    throw new TypeError("session runtime metadata store is required");
  }
  if (typeof atomicWriteFile !== "function") throw new TypeError("session runtime atomic writer is required");

  let appendStream = null;

  function issue(kind, message = null, level = "error") {
    onPersistentIssue(kind, message, level);
  }

  function closeStream() {
    if (!appendStream) return Promise.resolve();
    const stream = appendStream;
    appendStream = null;
    return new Promise((resolveClose) => stream.end(resolveClose));
  }

  function stream() {
    if (appendStream) return appendStream;
    const next = createWriteStream(activeSessionFile, { flags: "a" });
    appendStream = next;
    next.on("error", (error) => {
      if (appendStream === next) appendStream = null;
      issue("active-session", `active session append failed: ${error.message}`);
      onLog(`[session-runtime] active session stream error: ${error.message}`);
    });
    return next;
  }

  function appendMessage(message) {
    try {
      const record = {
        role: message.role,
        content: message.content !== undefined ? message.content : message.text ?? "",
        ...(Array.isArray(message.images) && message.images.length > 0 ? { images: message.images } : {}),
        ...(message.reasoning ? { reasoning: message.reasoning } : {}),
        ...(message.toolName ? { toolName: message.toolName } : {}),
        ...(message.toolArgs !== undefined ? { toolArgs: message.toolArgs } : {}),
        ...(message.receipt && typeof message.receipt === "object" ? { receipt: message.receipt } : {}),
        ...(message.taskState ? { taskState: message.taskState } : {}),
        ...(message.artifactIncomplete === true ? { artifactIncomplete: true } : {}),
        ...(message.interventionChoice ? { interventionChoice: message.interventionChoice } : {}),
        ...(Array.isArray(message.warnings) && message.warnings.length > 0 ? { warnings: message.warnings } : {}),
      };
      stream().write(`${JSON.stringify(record)}\n`);
    } catch (error) {
      issue("active-session", `active session append failed: ${error.message}`);
      onLog(`[session-runtime] active session append failed: ${error.message}`);
    }
  }

  async function writeEntries(entries) {
    await closeStream();
    try {
      await atomicWriteFile(activeSessionFile, serializeActiveSession(entries));
      issue("active-session", null, "clear");
    } catch (error) {
      issue("active-session", `active session was not saved: ${error.message}`);
      throw error;
    }
  }

  async function writeMeta(patch = {}) {
    try {
      const sessionStat = await stat(activeSessionFile);
      const mode = getMode() || "general";
      const modeInfo = modeSummary(mode);
      const currentTime = now().toISOString();
      metaStore.update((current) => ({
        ...current,
        ...patch,
        conversationId: patch.conversationId || current.conversationId || getConversationId(),
        mode,
        modeLabel: modeInfo.label,
        modeDescription: modeInfo.description,
        workspace: getWorkspace(),
        messageCount: Number.isFinite(patch.messageCount) ? Math.max(0, Math.floor(patch.messageCount)) : getMessages().length,
        messageCountFileSize: sessionStat.size,
        messageCountFileMtimeMs: sessionStat.mtimeMs,
        savedAt: patch.savedAt || current.savedAt || currentTime,
        updatedAt: currentTime,
        sessionMemories: getSessionMemories().map((memory) => ({ ...memory })),
        indexRetrievalMode: getIndexRetrievalMode(),
      }));
      return true;
    } catch (error) {
      onLog(`[session-runtime] active session metadata was not saved: ${error.message}`);
      return false;
    }
  }

  async function syncFromLoop(pendingUser = null) {
    const loop = getLoop();
    if (!loop?.log?.toMessages) return;
    try {
      await writeEntries(withPendingUserEntry(loop.log.toMessages(), pendingUser));
      const entries = loop.log.toMessages();
      await writeMeta({ messageCount: entries.length + (pendingUser?.text ? 1 : 0) });
    } catch (error) {
      issue("active-session", `active session model sync failed: ${error.message}`);
      onLog(`[session-runtime] active session model sync failed: ${error.message}`);
    }
  }

  async function finalize() {
    await closeStream();
    try {
      await access(activeSessionFile);
    } catch {
      issue("active-session", null, "clear");
      return null;
    }
    try {
      const sessionStat = await stat(activeSessionFile);
      if (sessionStat.size === 0 || !hasUserMessage()) {
        await rm(activeSessionFile, { force: true });
        await rm(activeSessionMetaFile, { force: true });
        issue("active-session", null, "clear");
        return null;
      }
      const name = now().toISOString().replace(/[:.]/g, "-");
      const destination = resolve(sessionsDir, `${name}.jsonl`);
      const destinationMeta = resolve(sessionsDir, `${name}.meta.json`);
      await rename(activeSessionFile, destination);
      try {
        await rename(activeSessionMetaFile, destinationMeta);
      } catch {
        try {
          const raw = await readFile(destination, "utf8");
          const messageCount = raw.split(/\r?\n/).filter((line) => line.trim()).length;
          await writeSessionMeta(name, { messageCount, conversationId: getConversationId() });
        } finally {
          await rm(activeSessionMetaFile, { force: true });
        }
      }
      onLog(`[session-runtime] active session finalized: ${destination}`);
      issue("active-session", null, "clear");
      onEvent({ kind: "sessions-changed", action: "finalize", name });
      return name;
    } catch (error) {
      issue("active-session", `active session could not be archived: ${error.message}`);
      onLog(`[session-runtime] failed to finalize active session: ${error.message}`);
      return null;
    }
  }

  async function clear() {
    await closeStream();
    try {
      await rm(activeSessionFile, { force: true });
      await rm(activeSessionMetaFile, { force: true });
      issue("active-session", null, "clear");
      issue("active-session-meta", null, "clear");
    } catch (error) {
      issue("active-session", `active session could not be cleared: ${error.message}`);
      onLog(`[session-runtime] failed to clear active session: ${error.message}`);
    }
  }

  async function seed(raw, patch = {}) {
    await closeStream();
    await writeFile(activeSessionFile, raw, "utf8");
    await writeMeta(patch);
  }

  async function load() {
    const startedAt = Date.now();
    try {
      await access(activeSessionFile);
    } catch {
      return false;
    }
    try {
      const raw = await readFile(activeSessionFile, "utf8");
      const parsed = parseActiveSessionJsonl(raw);
      const entries = parsed.entries;
      if (entries.length === 0) {
        await clear();
        return false;
      }
      if (parsed.errors.length > 0) {
        const backup = `${activeSessionFile}.corrupt-${now().toISOString().replace(/[:.]/g, "-")}`;
        try {
          await writeFile(backup, raw, "utf8");
          await writeEntries(entries);
          onLog(`[session-runtime] active session repaired: kept ${entries.length} records, skipped ${parsed.errors.length}; backup=${backup}`);
        } catch (error) {
          onLog(`[session-runtime] failed to repair active session: ${error.message}`);
        }
      }
      const loop = getLoop();
      const modelEntries = activeEntriesForModel(entries);
      if (loop && modelEntries.length > 0) loop.adoptHistory?.(modelEntries, loop.model) ?? loop.log.compactInPlace(modelEntries);
      clearMessages();
      setNextMessageId(1);
      for (const entry of activeEntriesForDashboard(entries)) {
        pushMessage(entry);
        setNextMessageId(getNextMessageId() + 1);
      }
      const storedMeta = metaStore.read();
      if (storedMeta.ok && storedMeta.value) applyLoadedMetadata(storedMeta.value);
      await writeMeta({ messageCount: entries.length });
      onLog(`[session-runtime] active session restored: ui=${getMessages().length}, model=${modelEntries.length}, durationMs=${Date.now() - startedAt}`);
      return true;
    } catch (error) {
      issue("active-session", `active session could not be loaded: ${error.message}`);
      onLog(`[session-runtime] failed to load active session: ${error.message}`);
      return false;
    }
  }

  return {
    appendMessage,
    clear,
    close: closeStream,
    finalize,
    load,
    persistConversationIdentity: async () => {
      await closeStream();
      return writeMeta({ conversationId: getConversationId() });
    },
    seed,
    syncFromLoop,
    writeEntries,
    writeMeta,
  };
}
