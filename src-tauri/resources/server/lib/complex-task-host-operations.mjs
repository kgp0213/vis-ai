import { parseArtifactReference } from "./complex-task-artifact-reference.mjs";

const MAX_SOURCE_CHARS = 200_000;
const MAX_ARTIFACT_CHARS = 200_000;

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function boundedLimit(value, fallback, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(max, Math.floor(parsed)) : fallback;
}

function invalid(message) {
  return message;
}

function leaseMatches(task, context) {
  return task?.lifecycle === "running"
    && task?.lease
    && text(context?.leaseId) === text(task.lease.leaseId)
    && Number(context?.epochId) === Number(task.lease.epoch)
    && Number(task.lease.expiresAt) > Date.now();
}

function unitPlanFor(task, unitId) {
  return (Array.isArray(task?.unitPlans) ? task.unitPlans : []).find((plan) => String(plan?.unitId) === String(unitId)) ?? null;
}

function documentUnitFor(task, coverageId) {
  const units = task?.metadata?.documentUnits;
  return units && typeof units === "object" ? units[coverageId] ?? null : null;
}

function sourceUnitAuthorized(task, unitPlan, sourceId, coverageId) {
  const unit = documentUnitFor(task, coverageId);
  if (!unit) return false;
  if (text(unit.sourceId) && text(unit.sourceId) !== sourceId) return false;
  if ((unitPlan.primaryCoverage ?? []).map(String).includes(String(coverageId))) return true;
  return (Array.isArray(unitPlan.contextRefs) ? unitPlan.contextRefs : []).some((ref) => (
    text(ref?.sourceId) === sourceId && (String(ref.range) === String(coverageId) || String(ref.range) === String(unit.location))
  ));
}

async function currentTask(store, context) {
  const taskId = text(context?.taskId);
  if (!taskId) throw Object.assign(new Error("task context is required"), { code: "TOOL_NOT_AUTHORIZED" });
  const task = await store.read(taskId);
  if (!leaseMatches(task, context)) throw Object.assign(new Error("task lease is no longer active"), { code: "TOOL_NOT_AUTHORIZED" });
  return task;
}

function resultArtifactRefs(task) {
  return Object.values(task?.unitResults ?? {}).flatMap((result) => Array.isArray(result?.artifactRefs) ? result.artifactRefs.map(String) : []);
}

export function createComplexTaskHostToolAccess({ store, artifactStore } = {}) {
  if (!store || typeof store.read !== "function") throw new TypeError("complex task host access requires a task store");
  if (!artifactStore || typeof artifactStore.read !== "function") throw new TypeError("complex task host access requires an artifact store");

  const operations = {
    read_source: {
      validate: (args) => text(args?.sourceId) && text(args?.coverageId) ? true : invalid("sourceId and coverageId are required"),
      execute: async (args, context) => {
        const task = await currentTask(store, context);
        if (task.contract?.permissions?.readSources !== true) throw new Error("task does not grant source read permission");
        const sourceId = text(args.sourceId);
        const coverageId = text(args.coverageId);
        const source = (task.contract?.sources ?? []).find((item) => text(item?.sourceId) === sourceId);
        if (!source) throw new Error(`source is not part of task: ${sourceId}`);
        const plan = unitPlanFor(task, context.unitId);
        if (!plan || !sourceUnitAuthorized(task, plan, sourceId, coverageId)) throw new Error(`source range is not authorized for unit ${context.unitId}`);
        const unit = documentUnitFor(task, coverageId);
        const limit = boundedLimit(args.maxChars, 50_000, MAX_SOURCE_CHARS);
        const textValue = String(unit.text ?? "");
        return {
          sourceId,
          coverageId,
          location: String(unit.location ?? coverageId),
          text: textValue.slice(0, limit),
          truncated: textValue.length > limit,
        };
      },
    },
    read_artifact: {
      validate: (args) => {
        const parsed = parseArtifactReference(args?.artifactRef);
        return parsed.exact ? true : invalid("an exact artifactRef (artifactId@rN#sha256) is required");
      },
      execute: async (args, context) => {
        const task = await currentTask(store, context);
        const reference = parseArtifactReference(args.artifactRef);
        if (!resultArtifactRefs(task).includes(reference.raw)) throw new Error("artifact is not a checkpoint owned by this task");
        const artifact = await artifactStore.read(reference.raw);
        const owner = artifact?.manifest?.owner;
        if (!owner || owner.taskId !== task.id) throw new Error(`artifact ${reference.artifactId} does not belong to task ${task.id}`);
        const limit = boundedLimit(args.maxChars, 50_000, MAX_ARTIFACT_CHARS);
        const content = Buffer.isBuffer(artifact.content) ? artifact.content.toString("utf8") : String(artifact.content ?? "");
        return {
          artifactRef: reference.raw,
          manifest: clone(artifact.manifest),
          text: content.slice(0, limit),
          truncated: content.length > limit,
        };
      },
    },
  };

  const authorize = async (name, _args, context) => {
    try {
      const task = await currentTask(store, context);
      if (!unitPlanFor(task, context.unitId)) return `unit is not part of task: ${context.unitId}`;
      if (name === "read_source" && task.contract?.permissions?.readSources !== true) return "task source-read permission is not granted";
      return true;
    } catch (error) {
      return error?.message || String(error);
    }
  };

  return { operations, authorize };
}
