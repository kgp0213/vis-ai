import { randomUUID } from "node:crypto";
import { access, readFile, rm, writeFile } from "node:fs/promises";

import { parseActiveSessionJsonl, serializeActiveSession } from "./active-session.mjs";

function text(value) { return String(value ?? "").trim(); }

function comparableWorkspacePath(value) {
  return text(value)
    .replace(/[\\/]+/gu, "/")
    .replace(/\/+$/u, "")
    .toLowerCase();
}

export function normalizeWorkspaceSnapshot(value) {
  if (!value || (typeof value !== "object" && typeof value !== "string")) return null;
  const path = typeof value === "string" ? text(value) : text(value.path ?? value.workspace ?? value.root);
  if (!path) return null;
  return { path, fingerprint: typeof value === "object" ? text(value.fingerprint) || null : null, capturedAt: typeof value === "object" ? text(value.capturedAt) || null : null };
}

export function validateSessionWorkspace(stored, current) {
  const expected = normalizeWorkspaceSnapshot(stored);
  const actual = normalizeWorkspaceSnapshot(current);
  if (!expected || !actual) return { ok: false, reason: "workspace_snapshot_missing" };
  if (comparableWorkspacePath(expected.path) !== comparableWorkspacePath(actual.path)) return { ok: false, reason: "workspace_changed", expected, actual };
  if (expected.fingerprint && actual.fingerprint && expected.fingerprint !== actual.fingerprint) return { ok: false, reason: "workspace_fingerprint_changed", expected, actual };
  return { ok: true, expected, actual };
}

function clone(value) {
  try { return structuredClone(value); } catch { return value; }
}

/** Copies facts into a new session while removing pending side-effect claims. */
export function forkSessionEntries(entries, { sourceSessionId = null, targetSessionId = null, workspace = null } = {}) {
  const warnings = [];
  const copied = (Array.isArray(entries) ? entries : []).map((entry) => {
    const next = clone(entry);
    if (!next || typeof next !== "object") return next;
    if (next.receipt?.intervention?.active) {
      next.receipt = { ...next.receipt, intervention: { ...next.receipt.intervention, active: false, choice: null } };
      warnings.push("pending intervention was cleared in the fork");
    }
    if (next.role === "tool" && String(next.toolStatus ?? "").trim() && !["succeeded", "failed", "cancelled", "unknown"].includes(String(next.toolStatus))) {
      next.toolStatus = "unknown";
      next.recoveryWarning = "tool execution state was unknown at fork time; inspect before retrying";
      warnings.push(`tool ${next.toolCallId ?? "unknown"} was marked unknown`);
    }
    return next;
  });
  return {
    sourceSessionId: text(sourceSessionId) || null,
    targetSessionId: text(targetSessionId) || null,
    workspace: text(workspace) || null,
    entries: copied,
    warnings: [...new Set(warnings)],
  };
}

function attachmentIdsFromEntries(entries) {
  return [...new Set((Array.isArray(entries) ? entries : []).flatMap((entry) => (
    Array.isArray(entry?.attachments) ? entry.attachments : []
  ).map((attachment) => typeof attachment === "string" ? attachment : attachment?.id)
    .map(text)
    .filter(Boolean)))];
}

/**
 * Owns the non-executing part of session resume/fork. The launcher remains
 * responsible for stopping the active operation and adopting the returned
 * history into the single model loop.
 */
export function createSessionRecoveryRuntime({
  sessionPath,
  sessionMetaPath = null,
  isValidSessionName,
  readMeta = () => ({}),
  writeMeta = async () => {},
  atomicWriteFile = writeFile,
  currentWorkspace = () => null,
  rebindAttachments = async () => ({ attached: 0, warnings: [] }),
  idFactory = randomUUID,
  now = () => new Date().toISOString(),
} = {}) {
  if (typeof sessionPath !== "function" || typeof isValidSessionName !== "function") {
    throw new TypeError("sessionPath and isValidSessionName are required");
  }

  function validateName(value, label) {
    const name = text(value);
    if (!name || !isValidSessionName(name)) throw new Error(`${label} is invalid`);
    return name;
  }

  async function readSnapshot(name) {
    const safeName = validateName(name, "session name");
    const path = sessionPath(safeName);
    const raw = await readFile(path, "utf8");
    const parsed = parseActiveSessionJsonl(raw);
    if (parsed.entries.length === 0) throw new Error("session is empty or unreadable");
    const meta = readMeta(safeName) || {};
    const workspaceCheck = validateSessionWorkspace(meta.workspace, currentWorkspace());
    return {
      name: safeName,
      path,
      raw,
      entries: parsed.entries,
      errors: parsed.errors,
      meta,
      metadataWarning: meta?.readOnlyError ? `session metadata could not be trusted: ${meta.readOnlyError}` : null,
      invalidRecords: parsed.errors.length,
      invalidLines: parsed.errors.slice(0, 20).map((entry) => entry.line),
      workspaceCheck,
    };
  }

  async function resume(name, { allowWorkspaceMismatch = false } = {}) {
    const snapshot = await readSnapshot(name);
    const missingWorkspaceSnapshot = snapshot.workspaceCheck.reason === "workspace_snapshot_missing";
    if (!snapshot.workspaceCheck.ok && !missingWorkspaceSnapshot && !allowWorkspaceMismatch) {
      return {
        ok: false,
        code: "SESSION_WORKSPACE_CHANGED",
        reason: "session workspace does not match the current workspace",
        ...snapshot,
      };
    }
    return {
      ok: true,
      ...snapshot,
      warnings: [
        ...(snapshot.invalidRecords > 0 ? [`${snapshot.invalidRecords} session record(s) could not be parsed`] : []),
        ...(snapshot.metadataWarning ? [snapshot.metadataWarning] : []),
        ...(missingWorkspaceSnapshot ? ["session has no workspace snapshot; current workspace was retained"] : []),
        ...(!snapshot.workspaceCheck.ok && !missingWorkspaceSnapshot ? ["session resumed with an explicit workspace mismatch override"] : []),
      ],
    };
  }

  async function fork(sourceName, targetName, { allowWorkspaceMismatch = false } = {}) {
    const source = await readSnapshot(sourceName);
    const target = validateName(targetName, "target session name");
    if (source.name === target) throw new Error("target session must differ from source session");
    const missingWorkspaceSnapshot = source.workspaceCheck.reason === "workspace_snapshot_missing";
    if (!source.workspaceCheck.ok && !missingWorkspaceSnapshot && !allowWorkspaceMismatch) {
      return {
        ok: false,
        code: "SESSION_WORKSPACE_CHANGED",
        reason: "session workspace does not match the current workspace",
        source,
      };
    }
    const targetPath = sessionPath(target);
    const targetMetadataPath = typeof sessionMetaPath === "function" ? sessionMetaPath(target) : null;
    try {
      await access(targetPath);
      return { ok: false, code: "SESSION_EXISTS", reason: "target session already exists", source };
    } catch {
      // Missing target is the expected path. Other filesystem errors are
      // handled by the atomic write below and returned to the caller.
    }
    if (targetMetadataPath) {
      try {
        await access(targetMetadataPath);
        return { ok: false, code: "SESSION_EXISTS", reason: "target session metadata already exists", source };
      } catch {
        // A missing metadata file is the expected path.
      }
    }

    const forked = forkSessionEntries(source.entries, {
      sourceSessionId: source.name,
      targetSessionId: target,
      workspace: currentWorkspace(),
    });
    const conversationId = String(idFactory());
    const attachmentIds = attachmentIdsFromEntries(forked.entries);
    const sourceConversationId = text(source.meta?.conversationId) || null;
    const attachmentWarnings = attachmentIds.length > 0 && !sourceConversationId
      ? ["fork attachments could not be rebound because the source session identity is unavailable"]
      : [];
    const targetMeta = {
      ...source.meta,
      version: 1,
      conversationId,
      sourceSessionId: source.name,
      forkedFrom: source.name,
      forkedAt: now(),
      messageCount: forked.entries.length,
      workspace: currentWorkspace(),
      interactions: [],
      preparedDocuments: [],
      contextRecoveryHandle: null,
      warnings: [...new Set([...(Array.isArray(source.meta.warnings) ? source.meta.warnings : []), ...forked.warnings, ...attachmentWarnings])],
    };
    await atomicWriteFile(targetPath, serializeActiveSession(forked.entries), "utf8");
    try {
      const metadataResult = await writeMeta(target, targetMeta);
      if (metadataResult === false || metadataResult?.ok === false) throw new Error("target session metadata was not saved");
    } catch (error) {
      await rm(targetPath, { force: true }).catch(() => {});
      if (targetMetadataPath) await rm(targetMetadataPath, { force: true }).catch(() => {});
      throw error;
    }
    if (attachmentIds.length > 0 && sourceConversationId) {
      let attachmentBinding = { attached: 0, warnings: [] };
      try {
        attachmentBinding = await rebindAttachments(attachmentIds, {
          sourceSessionId: sourceConversationId,
          targetSessionId: conversationId,
          operationId: null,
          workspace: currentWorkspace(),
        }) || attachmentBinding;
      } catch (error) {
        attachmentBinding = { attached: 0, warnings: [`fork attachment references could not be rebound: ${error.message}`] };
      }
      const reboundWarnings = Array.isArray(attachmentBinding.warnings) ? attachmentBinding.warnings : [];
      if (reboundWarnings.length > 0) {
        attachmentWarnings.push(...reboundWarnings);
        try {
          await writeMeta(target, {
            warnings: [...new Set([...(Array.isArray(targetMeta.warnings) ? targetMeta.warnings : []), ...reboundWarnings])],
          });
        } catch {
          // The fork remains valid; the returned warning still exposes the
          // fact that metadata could not record the binding failure.
        }
      }
    }
    return {
      ok: true,
      sourceSessionId: source.name,
      targetSessionId: target,
      targetPath,
      conversationId,
      entries: forked.entries,
      warnings: [...new Set([...forked.warnings, ...attachmentWarnings, ...(source.metadataWarning ? [source.metadataWarning] : []), ...(source.invalidRecords > 0 ? [`${source.invalidRecords} source record(s) could not be parsed`] : [])])],
    };
  }

  return { fork, readSnapshot, resume };
}
