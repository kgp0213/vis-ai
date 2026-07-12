import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";

import { atomicWriteFileSync } from "./atomic-file.mjs";

const PLAN_VERSION = 1;

function safeSessionName(value) {
  const name = String(value || "desktop").replace(/[\\/:*?"<>|]/g, "_").trim();
  return name || "desktop";
}

function normalizePlan(parsed, path = null) {
  if (!parsed || parsed.version !== PLAN_VERSION) throw new Error("unsupported plan schema");
  if (!Array.isArray(parsed.steps) || !Array.isArray(parsed.completedStepIds)) throw new Error("invalid plan structure");
  const steps = parsed.steps.filter((step) => step && typeof step.id === "string" && step.id && typeof step.title === "string" && step.title && typeof step.action === "string" && step.action)
    .map((step) => ({ id: step.id, title: step.title, action: step.action, ...(new Set(["low", "med", "high"]).has(step.risk) ? { risk: step.risk } : {}) }));
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
        });
      } catch (error) {
        logger.warn?.(`[plan-store] invalid archive ${name}: ${error.message}`);
      }
    }
    return out.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  }

  return { loadPlanState, savePlanState, clearPlanState, archivePlanState, listAllPlanArchives };
}
