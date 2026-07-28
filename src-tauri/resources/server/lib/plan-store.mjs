import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";

import { atomicWriteFileSync } from "./atomic-file.mjs";

const PLAN_VERSION = 2;

const PLAN_STEP_STATES = new Set(["pending", "in_progress", "completed", "blocked"]);

function safeSessionName(value) {
  const name = String(value || "desktop").replace(/[\\/:*?"<>|]/g, "_").trim();
  return name || "desktop";
}

function normalizePlan(parsed, path = null) {
  if (!parsed || ![1, PLAN_VERSION].includes(parsed.version)) throw new Error("unsupported plan schema");
  if (!Array.isArray(parsed.steps) || !Array.isArray(parsed.completedStepIds)) throw new Error("invalid plan structure");
  const steps = parsed.steps.filter((step) => step && typeof step.id === "string" && step.id && typeof step.title === "string" && step.title && typeof step.action === "string" && step.action)
    .map((step) => ({
      id: step.id,
      title: step.title,
      action: step.action,
      ...(new Set(["low", "med", "high"]).has(step.risk) ? { risk: step.risk } : {}),
      status: PLAN_STEP_STATES.has(step.status) ? step.status : (parsed.completedStepIds.includes(step.id) ? "completed" : "pending"),
      ...(Array.isArray(step.acceptanceCriteria) ? { acceptanceCriteria: step.acceptanceCriteria.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim().slice(0, 600)).slice(0, 16) } : {}),
      ...(Array.isArray(step.evidenceRefs) ? { evidenceRefs: step.evidenceRefs.filter((item) => item && typeof item === "object").slice(0, 32).map((item) => ({ ...item })) } : {}),
      ...(typeof step.blockedReason === "string" && step.blockedReason.trim() ? { blockedReason: step.blockedReason.trim().slice(0, 1000) } : {}),
    }));
  if (steps.length === 0) throw new Error("plan has no valid steps");
  const completedStepIds = parsed.completedStepIds.filter((id) => typeof id === "string" && id);
  const updatedAt = typeof parsed.updatedAt === "string" && !Number.isNaN(Date.parse(parsed.updatedAt))
    ? parsed.updatedAt
    : path ? statSync(path).mtime.toISOString() : new Date(0).toISOString();
  return {
    version: PLAN_VERSION,
    steps,
    completedStepIds,
    updatedAt,
    ...(typeof parsed.body === "string" && parsed.body ? { body: parsed.body } : {}),
    ...(typeof parsed.summary === "string" && parsed.summary ? { summary: parsed.summary } : {}),
    ...(typeof parsed.planId === "string" && parsed.planId.trim() ? { planId: parsed.planId.trim().slice(0, 160) } : {}),
    ...(typeof parsed.requestId === "string" && parsed.requestId.trim() ? { requestId: parsed.requestId.trim().slice(0, 160) } : {}),
  };
}

export function createPlanStore(sessionsDir, { logger = console } = {}) {
  const activePath = (session) => resolve(sessionsDir, `${safeSessionName(session)}.plan.json`);

  function loadPlanState(session) {
    const path = activePath(session);
    if (!existsSync(path)) return null;
    try {
      return normalizePlan(JSON.parse(readFileSync(path, "utf8")), path);
    } catch (error) {
      throw new Error(`active plan is invalid and was not modified: ${error.message}`);
    }
  }

  function savePlanState(session, steps, completedStepIds, extras = {}) {
    mkdirSync(sessionsDir, { recursive: true });
    const state = normalizePlan({
      version: PLAN_VERSION,
      steps,
      completedStepIds: [...completedStepIds],
      updatedAt: new Date().toISOString(),
      body: extras.body,
      summary: extras.summary,
      planId: extras.planId,
      requestId: extras.requestId,
    });
    atomicWriteFileSync(activePath(session), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  }

  function clearPlanState(session) {
    rmSync(activePath(session), { force: true });
  }

  function archivePlanState(session) {
    const active = activePath(session);
    if (!existsSync(active)) return null;
    loadPlanState(session);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const archive = resolve(sessionsDir, `${safeSessionName(session)}.plan.${stamp}-${Math.random().toString(36).slice(2, 6)}.done.json`);
    renameSync(active, archive);
    return archive;
  }

  function migrationMarkerPath(legacySession) {
    return resolve(sessionsDir, `${safeSessionName(legacySession)}.plan.migration.json`);
  }

  /**
   * Migrate the historical fixed desktop plan exactly once. The original is
   * copied to a timestamped legacy archive before the active file is removed,
   * so an interrupted migration never destroys the only copy.
   */
  function migrateLegacyPlan(legacySession, targetSession) {
    const legacy = activePath(legacySession);
    const target = activePath(targetSession);
    const marker = migrationMarkerPath(legacySession);
    if (existsSync(marker) || legacySession === targetSession || !existsSync(legacy)) return { migrated: false, reason: "not-needed" };
    mkdirSync(sessionsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backup = resolve(sessionsDir, `${safeSessionName(legacySession)}.plan.${stamp}-legacy.json`);
    try {
      const state = loadPlanState(legacySession);
      copyFileSync(legacy, backup);
      if (existsSync(target)) {
        // A real target plan wins. Keep the old plan in the archive for an
        // explicit user recovery instead of overwriting active work.
        rmSync(legacy, { force: true });
        atomicWriteFileSync(marker, `${JSON.stringify({ version: 1, status: "archived", targetSession, backup, migratedAt: new Date().toISOString() }, null, 2)}\n`);
        return { migrated: false, archived: true, backup };
      }
      savePlanState(targetSession, state.steps, state.completedStepIds, state);
      rmSync(legacy, { force: true });
      atomicWriteFileSync(marker, `${JSON.stringify({ version: 1, status: "migrated", targetSession, backup, migratedAt: new Date().toISOString() }, null, 2)}\n`);
      return { migrated: true, targetSession, backup };
    } catch (error) {
      logger.warn?.(`[plan-store] legacy plan migration skipped: ${error.message}`);
      return { migrated: false, reason: "invalid", error: error.message, backup: existsSync(backup) ? backup : null };
    }
  }

  function listAllPlanArchives() {
    if (!existsSync(sessionsDir)) return [];
    const out = [];
    for (const name of readdirSync(sessionsDir)) {
      if (!name.endsWith(".done.json") || !name.includes(".plan.")) continue;
      const path = resolve(sessionsDir, name);
      try {
        const plan = normalizePlan(JSON.parse(readFileSync(path, "utf8")), path);
        out.push({
          sessionName: basename(name).slice(0, name.indexOf(".plan.")),
          path,
          completedAt: plan.updatedAt,
          steps: plan.steps,
          completedStepIds: plan.completedStepIds,
          ...(plan.body ? { body: plan.body } : {}),
          ...(plan.summary ? { summary: plan.summary } : {}),
          ...(plan.planId ? { planId: plan.planId } : {}),
          ...(plan.requestId ? { requestId: plan.requestId } : {}),
        });
      } catch (error) {
        logger.warn?.(`[plan-store] invalid archive ${name}: ${error.message}`);
      }
    }
    return out.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  }

  return { loadPlanState, savePlanState, clearPlanState, archivePlanState, listAllPlanArchives, migrateLegacyPlan };
}
