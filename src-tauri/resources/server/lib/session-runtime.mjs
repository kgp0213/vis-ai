import { createWriteStream } from "node:fs";
import { access, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { activeEntriesForDashboard, activeEntriesForModel, parseActiveSessionJsonl, recoverInterruptedToolCalls, serializeActiveSession, withPendingUserEntry } from "./active-session.mjs";
import { createLifecycleMachine } from "./lifecycle-transaction.mjs";

function entryText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.filter((part) => part?.type === "text" && typeof part.text === "string").map((part) => part.text).join("\n");
}

function belongsToPendingTurn(entries, index, pendingUser) {
  const pendingText = entryText(pendingUser?.text);
  if (!pendingText || !Array.isArray(entries) || index < 0 || index >= entries.length) return false;
  let latestUserIndex = -1;
  for (let cursor = 0; cursor < index; cursor++) {
    const entry = entries[cursor];
    if (entry?.role === "user" && entryText(entry.content) === pendingText) latestUserIndex = cursor;
  }
  if (latestUserIndex < 0) return false;
  return !entries.slice(latestUserIndex + 1, index).some((entry) => entry?.role === "user");
}

const FINALIZATION_RANK = Object.freeze({
  unknown: 1,
  incomplete: 2,
  needs_intervention: 2,
  awaiting_approval: 2,
  failed: 3,
  cancelled: 3,
  completed_with_warnings: 4,
  completed: 5,
});

function persistedTaskState(entry) {
  const value = entry?.taskState
    ?? entry?.executionState
    ?? entry?.state
    ?? entry?.receipt?.taskState
    ?? entry?.receipt?.completion?.taskState
    ?? null;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized) return normalized;
  // Older sessions persisted only completion.ok. Treat a positive completion
  // as a durable terminal fact so a late unknown callback cannot regress it.
  if (entry?.receipt?.completion?.ok === true) return "completed";
  if (entry?.receipt?.completion?.ok === false) return "unknown";
  return null;
}

function finalizationIdentityMatches(entry, { messageId = null, turnId = null, operationId = null } = {}) {
  // A Steering/user record can share the operation with its final assistant
  // turn. It is an input fact, never a terminal execution fact, so it must
  // not win the late-finalization lookup.
  if (!entry || typeof entry !== "object" || !["assistant", "execution"].includes(entry.role)) return false;
  return Boolean(
    (messageId && (entry.messageId === messageId || entry.id === messageId))
    || (turnId && entry.turnId === turnId)
    || (operationId && entry.operationId === operationId),
  );
}

function shouldIgnoreLateFinalization(entry, incomingState) {
  if (!entry) return false;
  const existing = persistedTaskState(entry);
  const existingRank = FINALIZATION_RANK[existing] ?? 0;
  const incomingRank = FINALIZATION_RANK[String(incomingState ?? "").trim().toLowerCase()] ?? 0;
  if (["completed", "completed_with_warnings", "failed", "cancelled"].includes(existing)) return true;
  // An indeterminate fact may be upgraded by a later verified completion, but
  // an already terminal result is write-once for this identity.
  return existingRank >= incomingRank;
}

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
  getSessionName = () => null,
  getWorkspace = () => null,
  getMode = () => "general",
  modeSummary = (mode) => ({ label: mode, description: "" }),
  getSessionMemories = () => [],
  getTodos = () => [],
  getGoals = () => [],
  getPrompts = () => [],
  getPromptInputs = () => [],
  getIndexRetrievalMode = () => "off",
  applyLoadedMetadata = () => {},
  onPersistentIssue = () => {},
  onEvent = () => {},
  onLog = () => {},
  hasUserMessage = () => false,
  writeSessionMeta = async () => {},
  materializeAttachments = async () => ({ images: [], warnings: [] }),
  migrateLegacyAttachments = null,
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
  let persistenceTail = Promise.resolve();
  const finalizationLifecycle = createLifecycleMachine("ready");

  function enqueuePersistence(task) {
    const run = persistenceTail.then(task, task);
    persistenceTail = run.catch(() => {});
    return run;
  }

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
        ...(message.id ? { id: String(message.id) } : {}),
        ...(message.turnId ? { turnId: String(message.turnId) } : {}),
        ...(message.operationId ? { operationId: String(message.operationId) } : {}),
        ...(Array.isArray(message.images) && message.images.length > 0 ? { images: message.images } : {}),
        ...(Array.isArray(message.attachments) && message.attachments.length > 0 ? { attachments: message.attachments } : {}),
        ...(message.reasoning ? { reasoning: message.reasoning } : {}),
        ...(message.toolName ? { toolName: message.toolName } : {}),
        ...(message.toolArgs !== undefined ? { toolArgs: message.toolArgs } : {}),
        ...(message.internal === true ? { internal: true } : {}),
        ...(message.modelVisible === true ? { modelVisible: true } : {}),
        ...(message.dashboardHidden === true ? { dashboardHidden: true } : {}),
        ...(message.source ? { source: String(message.source).slice(0, 120) } : {}),
        ...(message.notificationId ? { notificationId: String(message.notificationId).slice(0, 240) } : {}),
        ...(message.backgroundTaskNotification && typeof message.backgroundTaskNotification === "object"
          ? { backgroundTaskNotification: { ...message.backgroundTaskNotification } }
          : {}),
         ...(message.receipt && typeof message.receipt === "object" ? { receipt: message.receipt } : {}),
         ...(message.taskState ? { taskState: message.taskState } : {}),
         ...(message.executionState ? { executionState: String(message.executionState).slice(0, 80) } : {}),
         ...(message.goalState ? { goalState: String(message.goalState).slice(0, 80) } : {}),
         ...(message.taskContract && typeof message.taskContract === "object" ? { taskContract: message.taskContract } : {}),
         ...(Array.isArray(message.evidenceRefs) && message.evidenceRefs.length > 0 ? { evidenceRefs: message.evidenceRefs.slice(-64) } : {}),
        ...(message.artifactIncomplete === true ? { artifactIncomplete: true } : {}),
        ...(Array.isArray(message.artifactEvidence) && message.artifactEvidence.length > 0 ? { artifactEvidence: message.artifactEvidence } : {}),
        ...(message.interventionChoice ? { interventionChoice: message.interventionChoice } : {}),
        ...(Array.isArray(message.warnings) && message.warnings.length > 0 ? { warnings: message.warnings } : {}),
      };
      const line = `${JSON.stringify(record)}\n`;
      return enqueuePersistence(async () => {
        try {
          const target = stream();
          await new Promise((resolveWrite, rejectWrite) => {
            let settled = false;
            const finish = (error = null) => {
              if (settled) return;
              settled = true;
              target.removeListener("error", onError);
              if (error) rejectWrite(error instanceof Error ? error : new Error(String(error)));
              else resolveWrite();
            };
            const onError = (error) => finish(error);
            target.once("error", onError);
            try {
              target.write(line, "utf8", finish);
            } catch (error) {
              finish(error);
            }
          });
        } catch (error) {
          issue("active-session", `active session append failed: ${error.message}`);
          onLog(`[session-runtime] active session append failed: ${error.message}`);
          throw error;
        }
      });
    } catch (error) {
      issue("active-session", `active session append failed: ${error.message}`);
      onLog(`[session-runtime] active session append failed: ${error.message}`);
      return false;
    }
  }

  async function writeEntries(entries) {
    return enqueuePersistence(async () => {
      await closeStream();
      try {
        await atomicWriteFile(activeSessionFile, serializeActiveSession(entries));
        issue("active-session", null, "clear");
      } catch (error) {
        issue("active-session", `active session was not saved: ${error.message}`);
        throw error;
      }
    });
  }

  async function writeMetaNow(patch = {}) {
    try {
      // Metadata must observe the latest append, including todo updates that
      // arrive while the active JSONL stream is still open.
      await closeStream();
      const sessionStat = await stat(activeSessionFile);
      const mode = getMode() || "general";
      const modeInfo = modeSummary(mode);
      const currentTime = now().toISOString();
      metaStore.update((current) => ({
        ...current,
        ...patch,
        conversationId: patch.conversationId || current.conversationId || getConversationId(),
        sessionName: getSessionName(),
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
        todos: Array.isArray(getTodos()) ? getTodos().map((todo) => ({ ...todo })) : [],
        goals: Array.isArray(getGoals()) ? getGoals().map((goal) => ({ ...goal })) : [],
        prompts: Array.isArray(getPrompts()) ? getPrompts().map((prompt) => ({
          id: prompt.id,
          operationId: prompt.operationId ?? null,
          sessionId: prompt.sessionId ?? null,
          instructionLength: Number(prompt.instructionLength) || 0,
          status: prompt.status,
          createdAt: prompt.createdAt ?? null,
          resolution: prompt.resolution ?? null,
        })) : [],
        promptInputs: Array.isArray(getPromptInputs()) ? getPromptInputs().map((input) => ({ ...input })) : [],
        indexRetrievalMode: getIndexRetrievalMode(),
      }));
      return true;
    } catch (error) {
      onLog(`[session-runtime] active session metadata was not saved: ${error.message}`);
      return false;
    }
  }

  async function writeMeta(patch = {}) {
    return enqueuePersistence(() => writeMetaNow(patch));
  }

  async function syncFromLoop(pendingUser = null) {
    const loop = getLoop();
    if (!loop?.log?.toMessages) return;
    try {
      // appendMessage() writes through the persistence queue and the stream
      // itself is asynchronous. Drain both before taking the JSONL snapshot,
      // otherwise a stale read can overwrite a durable finalization.
      await persistenceTail;
      await closeStream();
      const nextEntries = withPendingUserEntry(loop.log.toMessages(), pendingUser);
      let existingEntries = [];
      try {
        existingEntries = parseActiveSessionJsonl(await readFile(activeSessionFile, "utf8")).entries;
      } catch {
        existingEntries = [];
      }
      const durableKeys = ["id", "messageId", "turnId", "operationId", "receipt", "taskState", "executionState", "goalState", "taskContract", "evidenceRefs", "artifactIncomplete", "artifactEvidence", "warnings", "interventionChoice"];
      const durableEntries = existingEntries.filter((entry) => (entry?.role === "assistant" || entry?.role === "execution") && durableKeys.some((key) => entry[key] !== undefined));
      const mergedEntries = [...nextEntries];
      for (const existing of durableEntries) {
        let target = -1;
        for (let index = mergedEntries.length - 1; index >= 0; index--) {
          const candidate = mergedEntries[index];
          if (candidate?.role !== existing.role) continue;
          const sameText = entryText(existing.content) && entryText(existing.content) === entryText(candidate.content);
          const uniqueTextMatch = sameText && !pendingUser
            && mergedEntries.filter((entry) => entry?.role === existing.role && entryText(entry.content) === entryText(existing.content)).length === 1;
          if ((existing.id && candidate.id === existing.id)
            || (existing.turnId && candidate.turnId === existing.turnId)
            || (sameText && (belongsToPendingTurn(mergedEntries, index, pendingUser) || uniqueTextMatch))) {
            target = index;
            break;
          }
        }
        if (target < 0) {
          // Hidden execution facts are not part of the model history, but
          // must survive later syncs just like assistant receipts do.
          if (existing.role === "execution") mergedEntries.push({ ...existing });
          continue;
        }
        const durable = Object.fromEntries(durableKeys.filter((key) => existing[key] !== undefined).map((key) => [key, existing[key]]));
        mergedEntries[target] = { ...mergedEntries[target], ...durable };
      }
      await writeEntries(mergedEntries);
      const entries = loop.log.toMessages();
      const hasPendingUser = Boolean(pendingUser?.text || pendingUser?.images?.length || pendingUser?.attachments?.length);
      await writeMeta({ messageCount: entries.length + (hasPendingUser ? 1 : 0) });
    } catch (error) {
      issue("active-session", `active session model sync failed: ${error.message}`);
      onLog(`[session-runtime] active session model sync failed: ${error.message}`);
    }
  }

  async function persistTurnFinalization({
    modelEntries = null,
    pendingUser = null,
    assistant = {},
    operationId = null,
    receipt = null,
    taskState = null,
    executionState = null,
    goalState = null,
    taskContract = null,
    evidenceRefs = [],
    artifactIncomplete = false,
    artifactEvidence = [],
    warnings = [],
    interventionChoice = null,
    allowWarningCorrection = false,
  } = {}) {
    return enqueuePersistence(async () => {
      try {
        const result = await finalizationLifecycle.transaction({
          operation: `finalize:${operationId || assistant.turnId || assistant.messageId || "turn"}`,
          from: "ready",
          enter: "finalizing",
          commit: "finalized",
          rollback: "failed",
        }, async (transaction) => {
          await closeStream();
          let entries = Array.isArray(modelEntries) ? modelEntries.map((entry) => ({ ...entry })) : null;
          if (!entries) {
            try {
              entries = parseActiveSessionJsonl(await readFile(activeSessionFile, "utf8")).entries;
            } catch {
              entries = [];
            }
          }
          entries = withPendingUserEntry(entries, pendingUser);
          const text = typeof assistant.text === "string" ? assistant.text : "";
          const messageId = assistant.messageId ? String(assistant.messageId) : null;
          const turnId = assistant.turnId ? String(assistant.turnId) : null;
           const incomingState = String(executionState ?? taskState ?? receipt?.executionState ?? receipt?.taskState ?? receipt?.completion?.executionState ?? receipt?.completion?.taskState ?? "unknown").trim().toLowerCase();
          let persistedEntries = [];
          try {
            persistedEntries = parseActiveSessionJsonl(await readFile(activeSessionFile, "utf8")).entries;
          } catch {
            persistedEntries = [];
          }
          const existingFinalization = [...persistedEntries]
            .reverse()
            .find((entry) => finalizationIdentityMatches(entry, { messageId, turnId, operationId }));
          if (shouldIgnoreLateFinalization(existingFinalization, incomingState)) {
            if (allowWarningCorrection && existingFinalization && warnings.length > 0) {
              const mergedWarnings = [...new Set([
                ...(Array.isArray(existingFinalization.warnings) ? existingFinalization.warnings : []),
                ...warnings,
              ])].slice(0, 16);
              let targetIndex = entries.findIndex((entry) => finalizationIdentityMatches(entry, { messageId, turnId, operationId }));
              if (targetIndex < 0 && persistedEntries.length > 0) {
                entries = persistedEntries.map((entry) => ({ ...entry }));
                targetIndex = entries.findIndex((entry) => finalizationIdentityMatches(entry, { messageId, turnId, operationId }));
              }
              if (targetIndex >= 0) {
                const current = entries[targetIndex];
                const nextReceipt = current.receipt && typeof current.receipt === "object"
                  ? { ...current.receipt, warnings: mergedWarnings }
                  : current.receipt;
                entries[targetIndex] = {
                  ...current,
                  warnings: mergedWarnings,
                  ...(nextReceipt ? { receipt: nextReceipt } : {}),
                };
                await atomicWriteFile(activeSessionFile, serializeActiveSession(entries));
                if (!await writeMetaNow({ messageCount: entries.length })) throw new Error("active session metadata could not be saved");
              }
            }
            transaction.commit("finalized");
            return true;
          }
          const durable = {
            ...(messageId ? { id: messageId } : {}),
            ...(messageId ? { messageId } : {}),
            ...(turnId ? { turnId } : {}),
            ...(operationId ? { operationId: String(operationId) } : {}),
             ...(receipt && typeof receipt === "object" ? { receipt } : {}),
             ...(typeof taskState === "string" && taskState ? { taskState } : {}),
             ...(typeof executionState === "string" && executionState ? { executionState } : {}),
             ...(typeof goalState === "string" && goalState ? { goalState } : {}),
             ...(taskContract && typeof taskContract === "object" ? { taskContract } : {}),
             ...(Array.isArray(evidenceRefs) ? { evidenceRefs: evidenceRefs.slice(-64) } : {}),
            artifactIncomplete: artifactIncomplete === true,
            artifactEvidence: Array.isArray(artifactEvidence) ? artifactEvidence : [],
            warnings: Array.isArray(warnings) ? warnings : [],
            interventionChoice: interventionChoice ? String(interventionChoice) : null,
          };
          let target = -1;
          for (let index = entries.length - 1; index >= 0; index--) {
            const entry = entries[index];
            if (entry?.role !== "assistant") continue;
            if (messageId && entry.id === messageId) {
              target = index;
              break;
            }
            if (turnId && entry.turnId === turnId) {
              target = index;
              break;
            }
            if (text && entryText(entry.content) === text && belongsToPendingTurn(entries, index, pendingUser)) {
              target = index;
              break;
            }
          }
          if (target >= 0) {
            entries[target] = { ...entries[target], ...(text ? { content: text } : {}), ...durable };
          } else if (text) {
            entries.push({ role: "assistant", content: text, ...durable });
          } else {
            // A failed/cancelled turn may have no assistant text. Persist its
            // execution facts without manufacturing an empty visible message.
            const executionId = `execution-${operationId || turnId || messageId || now().getTime()}`;
            entries.push({ role: "execution", content: "", id: executionId, ...durable });
          }
          await atomicWriteFile(activeSessionFile, serializeActiveSession(entries));
          const metaSaved = await writeMetaNow({ messageCount: entries.length });
          if (!metaSaved) throw new Error("active session metadata could not be saved");
          transaction.commit("finalized");
          return true;
        });
        finalizationLifecycle.switch({ operation: "reset-finalization", from: ["finalized", "failed"], to: "ready" });
        return result;
      } catch (error) {
        issue("active-session", `final turn persistence failed: ${error.message}`);
        onLog(`[session-runtime] final turn persistence failed: ${error.message}`);
        try {
          if (!finalizationLifecycle.is("ready")) {
            finalizationLifecycle.switch({ operation: "reset-finalization-after-error", from: ["finalized", "failed", "finalizing"], to: "ready" });
          }
        } catch (resetError) {
          onLog(`[session-runtime] finalization lifecycle reset failed: ${resetError.message}`);
        }
        return false;
      }
    });
  }

  async function finalize() {
    return enqueuePersistence(async () => {
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
    });
  }

  async function clear() {
    return enqueuePersistence(async () => {
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
    });
  }

  async function seed(raw, patch = {}) {
    return enqueuePersistence(async () => {
      await closeStream();
      await writeFile(activeSessionFile, raw, "utf8");
      await writeMetaNow(patch);
    });
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
      let entries = parsed.entries;
      if (entries.length === 0) {
        await clear();
        return false;
      }
      const interrupted = recoverInterruptedToolCalls(entries, { now });
      if (interrupted.changed) {
        entries = interrupted.entries;
        try {
          await writeEntries(entries);
          for (const warning of interrupted.warnings) issue("active-session-recovery", warning, "warning");
          onLog(`[session-runtime] recovered ${interrupted.warnings.length} interrupted tool call(s) as unknown`);
        } catch (error) {
          issue("active-session-recovery", `interrupted tool recovery could not be saved: ${error.message}`, "warning");
        }
      }
      if (typeof migrateLegacyAttachments === "function") {
        try {
          const migration = await migrateLegacyAttachments(entries, {
            sessionId: getConversationId(),
            workspace: getWorkspace(),
          });
          if (migration?.migrated > 0) {
            entries = migration.entries;
            await writeEntries(entries);
            onLog(`[session-runtime] migrated ${migration.migrated} legacy inline image record(s) to attachments`);
          }
          if (migration?.errors?.length > 0) {
            issue("active-session-attachments", `${migration.errors.length} legacy image(s) could not be migrated`, "warning");
          }
        } catch (error) {
          issue("active-session-attachments", `legacy image migration failed: ${error.message}`, "warning");
        }
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
        if (Array.isArray(entry.attachments) && entry.attachments.length > 0) {
          try {
            const materialized = await materializeAttachments(entry.attachments);
            if (Array.isArray(materialized?.images) && materialized.images.length > 0) entry.images = materialized.images;
            if (Array.isArray(materialized?.warnings) && materialized.warnings.length > 0) {
              entry.warnings = [...new Set([...(entry.warnings ?? []), ...materialized.warnings])];
              issue("active-session-attachments", materialized.warnings.join("; "), "warning");
            }
          } catch (error) {
            const warning = `会话附件无法恢复：${error.message}`;
            entry.warnings = [...new Set([...(entry.warnings ?? []), warning])];
            issue("active-session-attachments", warning, "warning");
          }
        }
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
    close: () => enqueuePersistence(closeStream),
    finalize,
    load,
    persistConversationIdentity: async () => {
      return enqueuePersistence(async () => {
        await closeStream();
        return writeMetaNow({ conversationId: getConversationId() });
      });
    },
    seed,
    syncFromLoop,
    persistTurnFinalization,
    writeEntries,
    writeMeta,
  };
}
