import { createHash, randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function effectIdFor(name, context) {
  const idempotencyKey = String(
    context?.idempotencyKey
      ?? [context?.taskId, context?.unitId, context?.effectKey ?? name].filter(Boolean).join(":"),
  ).trim();
  if (!idempotencyKey) throw new Error(`effect operation ${name} requires a stable idempotency key`);
  const digest = createHash("sha256").update(`${name}\0${idempotencyKey}`).digest("hex");
  return { effectId: `effect:${digest}`, idempotencyKey };
}

function argsHashFor(args) {
  return createHash("sha256").update(stableJson(args ?? {})).digest("hex");
}

function keyHashFor(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function validationError(name, validation) {
  const detail = typeof validation === "string" && validation.trim() ? validation.trim() : "arguments are invalid";
  const error = new TypeError(`${name}: ${detail}`);
  error.code = "INVALID_TOOL_ARGUMENTS";
  return error;
}

function unknownEffectError(effect) {
  const error = new Error(`effect ${effect.effectId} may already have occurred; confirmation is required before retrying`);
  error.code = "EFFECT_CONFIRMATION_REQUIRED";
  error.effect = effect;
  return error;
}

function idempotencyConflictError(effect, argsHash) {
  const error = new Error(`effect ${effect.effectId} was reused with different arguments; choose a new effect key`);
  error.code = "EFFECT_IDEMPOTENCY_CONFLICT";
  error.effect = clone(effect);
  error.argsHash = argsHash;
  return error;
}

const MAX_PERSISTED_RESULT_BYTES = 16 * 1024;
const MAX_PERSISTED_RECORDS = 512;
const CONFIRMED_RECORD_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function boundedPersistedResult(value, budget = MAX_PERSISTED_RESULT_BYTES) {
  if (value === undefined) return undefined;
  const seen = new Set();
  let truncated = false;
  const walk = (input, depth = 0) => {
    if (depth > 6) {
      truncated = true;
      return "[truncated]";
    }
    if (input === null || typeof input === "string" || typeof input === "number" || typeof input === "boolean") {
      if (typeof input === "string" && input.length > 2_000) truncated = true;
      return typeof input === "string" ? input.slice(0, 2_000) : input;
    }
    if (typeof input !== "object") return String(input);
    if (seen.has(input)) return "[circular]";
    seen.add(input);
    let result;
    if (Array.isArray(input)) {
      if (input.length > 50) truncated = true;
      result = input.slice(0, 50).map((item) => walk(item, depth + 1));
    }
    else {
      result = {};
      const keys = Object.keys(input);
      if (keys.length > 80) truncated = true;
      for (const key of keys.slice(0, 80)) result[key.slice(0, 200)] = walk(input[key], depth + 1);
    }
    seen.delete(input);
    return result;
  };
  let result = walk(value);
  const serialized = () => {
    try {
      const text = JSON.stringify(result);
      return text === undefined ? String(result) : text;
    } catch {
      return String(result);
    }
  };
  if (!truncated && Buffer.byteLength(serialized(), "utf8") <= budget) return result;
  const source = serialized();
  const preserved = {};
  if (result && typeof result === "object" && !Array.isArray(result)) {
    const priorityKeys = ["ok", "messageId", "id", "status", "code", "error", "skipped", "requestId", "traceId"];
    for (const key of priorityKeys) {
      const value = result[key];
      if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") preserved[key] = value;
    }
  }
  const buildPayload = (preview) => ({ ...preserved, truncated: true, preview });
  const empty = JSON.stringify(buildPayload(""));
  if (Buffer.byteLength(empty, "utf8") > budget) return { truncated: true };
  let low = 0;
  let high = source.length;
  let preview = "";
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = source.slice(0, middle);
    const encoded = JSON.stringify(buildPayload(candidate));
    if (Buffer.byteLength(encoded, "utf8") <= budget) {
      preview = candidate;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return buildPayload(preview);
}

function sanitizePersistedRecord(value, timestamp) {
  const next = { ...value, updatedAt: value.updatedAt ?? timestamp };
  delete next.idempotencyKey;
  if (next.result !== undefined) next.result = boundedPersistedResult(next.result);
  if (next.error && typeof next.error === "object") {
    next.error = {
      code: String(next.error.code ?? "UNKNOWN").slice(0, 120),
      message: String(next.error.message ?? "").slice(0, 2_000),
    };
  }
  for (const key of ["effectId", "taskId", "unitId", "operation", "argsHash", "idempotencyKeyHash", "state", "preparedAt", "dispatchedAt", "confirmedAt", "failedAt", "abandonedAt", "updatedAt"]) {
    if (next[key] !== undefined && next[key] !== null) next[key] = String(next[key]).slice(0, 1_000);
  }
  return next;
}

function memoryEffectStore() {
  const values = new Map();
  return {
    async get(id) { return clone(values.get(id) ?? null); },
    async put(value) { values.set(value.effectId, clone(value)); return clone(value); },
  };
}

function classifyEffectResult(result) {
  if (!result || typeof result !== "object" || result.ok !== false) return null;
  const meta = result.meta && typeof result.meta === "object" ? result.meta : {};
  const retrySafe = result.retrySafe === true
    || result.effectUnknown === false
    || result.skipped === true
    || meta.testMode === true
    || meta.validation === true;
  return {
    state: retrySafe ? "prepared" : "unknown",
    code: String(result.code ?? (meta.timeout ? "EFFECT_TIMEOUT" : meta.cancelled ? "EFFECT_CANCELLED" : "EFFECT_FAILED")),
    message: String(result.error ?? result.message ?? "effect operation returned ok=false").slice(0, 2_000),
    result: boundedPersistedResult(result),
  };
}

/**
 * Durable effect ledger for host-side side effects. The ledger intentionally
 * stores hashes and bounded results only; raw command arguments, message text
 * and local paths stay out of the recovery file. A corrupt ledger is backed up
 * and treated as empty, so a previously dispatched effect can never be
 * silently replayed from a partially decoded record.
 */
export function createFileEffectStore({ path, atomicWriteFile, now = () => new Date().toISOString() } = {}) {
  if (!path) throw new TypeError("effect ledger path is required");
  let loaded = false;
  let loading = null;
  let loadError = null;
  let values = new Map();
  let tail = Promise.resolve();

  async function load() {
    if (loaded) return;
    if (loading) return loading;
    loading = (async () => {
      try {
        const raw = await readFile(path, "utf8");
        const parsed = JSON.parse(raw);
        const records = Array.isArray(parsed?.effects) ? parsed.effects : null;
        if (!records) throw new Error("effect ledger must contain an effects array");
        const timestamp = now();
        values = new Map(records
          .filter((entry) => entry && typeof entry.effectId === "string")
          .map((entry) => {
            const safe = sanitizePersistedRecord(entry, timestamp);
            return [safe.effectId, safe];
          }));
        prune();
      } catch (error) {
        if (error?.code !== "ENOENT") {
          try { await rename(path, `${path}.corrupt-${Date.now()}`); } catch {}
          loadError = Object.assign(new Error(`effect ledger is unavailable: ${error.message}`), {
            code: "EFFECT_LEDGER_UNAVAILABLE",
            cause: error,
          });
          values = new Map();
        }
      } finally {
        loaded = true;
        loading = null;
      }
    })();
    return loading;
  }

  function assertHealthy() {
    if (loadError) throw loadError;
  }

  function prune() {
    const nowMs = Date.parse(now()) || Date.now();
    for (const [id, value] of values) {
      const state = String(value?.state || "");
      const updated = Date.parse(value?.updatedAt || "") || nowMs;
      if (["confirmed", "abandoned"].includes(state) && nowMs - updated > CONFIRMED_RECORD_TTL_MS) values.delete(id);
    }
    if (values.size <= MAX_PERSISTED_RECORDS) return;
    const removable = [...values.entries()]
      .filter(([, value]) => ["confirmed", "abandoned"].includes(String(value?.state || "")))
      .sort((a, b) => String(a[1]?.updatedAt || "").localeCompare(String(b[1]?.updatedAt || "")));
    for (const [id] of removable) {
      if (values.size <= MAX_PERSISTED_RECORDS) break;
      values.delete(id);
    }
  }

  async function persist() {
    const payload = JSON.stringify({ version: 1, effects: [...values.values()] }, null, 2);
    if (typeof atomicWriteFile === "function") {
      await atomicWriteFile(path, payload, "utf8");
      return;
    }
    const staging = resolve(dirname(path), `.${path.split(/[\\/]/).at(-1)}-${randomUUID()}.tmp`);
    try {
      await writeFile(staging, payload, "utf8");
      await rename(staging, path);
    } finally {
      try { await import("node:fs/promises").then(({ rm }) => rm(staging, { force: true })); } catch {}
    }
  }

  async function put(value) {
    await load();
    assertHealthy();
    const next = clone(sanitizePersistedRecord(value, now()));
    const run = tail.then(async () => {
      const previous = values.get(next.effectId);
      values.set(next.effectId, next);
      prune();
      try {
        await persist();
      } catch (error) {
        if (previous) values.set(next.effectId, previous);
        else values.delete(next.effectId);
        throw error;
      }
      return clone(next);
    });
    tail = run.catch(() => {});
    return run;
  }

  return {
    async get(id) { await load(); assertHealthy(); return clone(values.get(id) ?? null); },
    put,
    async list() { await load(); assertHealthy(); return [...values.values()].map(clone); },
    flush: () => tail,
    status: () => ({ loaded, error: loadError?.message ?? null, code: loadError?.code ?? null }),
  };
}

export function createHostToolBroker(options = {}) {
  const operations = options.operations && typeof options.operations === "object" ? options.operations : {};
  const effectStore = options.effectStore ?? memoryEffectStore();
  const authorizationPolicy = options.operationPolicy ?? null;
  const inflightEffects = new Map();

  async function invokeInteraction(name, operation, args, context) {
    const request = await operation.execute(args, context);
    if (!request || typeof request !== "object") throw new Error(`${name}: interaction operation returned no request`);
    return {
      kind: "user_input_request",
      requestId: String(request.requestId || `request:${randomUUID()}`),
      taskId: String(context?.taskId ?? request.taskId ?? ""),
      unitId: String(context?.unitId ?? request.unitId ?? ""),
      reason: String(request.reason || "user-input-required"),
      question: String(request.question || "需要用户补充信息"),
      choices: Array.isArray(request.choices) ? clone(request.choices) : [],
      existingArtifactRefs: Array.isArray(request.existingArtifactRefs) ? clone(request.existingArtifactRefs) : [],
      resumeToken: String(request.resumeToken || randomUUID()),
      expiresAt: request.expiresAt ?? null,
    };
  }

  async function invokeEffect(name, operation, args, context) {
    const identity = effectIdFor(name, context);
    const argsHash = argsHashFor(args);
    const inflight = inflightEffects.get(identity.effectId);
    if (inflight) {
      if (inflight.argsHash !== argsHash) {
        throw idempotencyConflictError({ effectId: identity.effectId, argsHash: inflight.argsHash }, argsHash);
      }
      return inflight.promise;
    }

    const execution = (async () => {
      const previous = await effectStore.get(identity.effectId);
      if (previous && previous.argsHash !== argsHash) throw idempotencyConflictError(previous, argsHash);
      if (previous?.state === "confirmed") {
        const priorFailure = classifyEffectResult(previous.result);
        if (!priorFailure) return clone(previous.result);
        if (priorFailure.state === "unknown") throw unknownEffectError({ ...previous, state: "unknown" });
        await effectStore.put({
          ...previous,
          state: "prepared",
          failedAt: new Date().toISOString(),
          error: { code: priorFailure.code, message: priorFailure.message },
          result: priorFailure.result,
        });
      }
      if (["dispatched", "unknown"].includes(previous?.state)) throw unknownEffectError({ ...previous, state: "unknown" });
      const base = {
        effectId: identity.effectId,
        taskId: context?.taskId ?? null,
        unitId: context?.unitId ?? null,
        operation: name,
        idempotencyKeyHash: keyHashFor(identity.idempotencyKey),
        argsHash,
        preparedAt: previous?.preparedAt ?? new Date().toISOString(),
      };
      await effectStore.put({ ...base, state: "prepared" });
      await effectStore.put({ ...base, state: "dispatched", dispatchedAt: new Date().toISOString() });
      try {
        const result = await operation.execute(args, { ...context, idempotencyKey: identity.idempotencyKey, effectId: identity.effectId });
        const failedResult = classifyEffectResult(result);
        if (failedResult) {
          await effectStore.put({
            ...base,
            state: failedResult.state,
            dispatchedAt: new Date().toISOString(),
            failedAt: new Date().toISOString(),
            error: { code: failedResult.code, message: failedResult.message },
            result: failedResult.result,
          });
          return result;
        }
        await effectStore.put({ ...base, state: "confirmed", dispatchedAt: new Date().toISOString(), confirmedAt: new Date().toISOString(), result: boundedPersistedResult(result) });
        return result;
      } catch (error) {
        const retrySafe = error?.effectUnknown === false
          || error?.retrySafe === true
          || operation.retrySafeOnError === true;
        const state = retrySafe ? "prepared" : "unknown";
        await effectStore.put({
          ...base,
          state,
          failedAt: new Date().toISOString(),
          error: { code: String(error?.code || "UNKNOWN"), message: String(error?.message || error).slice(0, 2_000) },
        });
        throw error;
      }
    })();
    inflightEffects.set(identity.effectId, { argsHash, promise: execution });
    try {
      return await execution;
    } finally {
      if (inflightEffects.get(identity.effectId)?.promise === execution) inflightEffects.delete(identity.effectId);
    }
  }

  async function invoke(name, args = {}, context = {}) {
    const operation = operations[String(name)];
    if (!operation || typeof operation.execute !== "function") {
      const error = new Error(`host operation is not registered: ${name}`);
      error.code = "TOOL_NOT_ALLOWED";
      throw error;
    }
    if (typeof operation.validate === "function") {
      let validation;
      try { validation = await operation.validate(args, context); } catch (error) { validation = error?.message || String(error); }
      if (validation !== true) throw validationError(name, validation);
    }
    if (typeof options.authorize === "function") {
      const approvalRequest = {
        operationId: context?.operationId ?? context?.taskId ?? null,
        sessionId: context?.sessionId ?? null,
        workspace: context?.workspace ?? null,
        toolName: name,
        args,
        recipient: context?.recipient ?? args?.to ?? args?.recipient ?? null,
        attachments: context?.attachments ?? args?.attachments ?? [],
        requiresApproval: operation.requiresApproval === true || operation.effect === true || operation.interaction === true,
      };
      const cached = authorizationPolicy?.evaluate?.(approvalRequest);
      if (cached?.decision === "deny") {
        const error = new Error(`operation is not authorized: ${name}`);
        error.code = "TOOL_NOT_AUTHORIZED";
        throw error;
      }
      let authorization = cached?.decision === "allow" ? true : await options.authorize(name, args, context, operation);
      if (authorizationPolicy && cached?.decision === "ask") {
        authorizationPolicy.record(approvalRequest, authorization === true ? "allow" : "deny", { source: "host-tool-broker" });
      }
      if (authorization !== true) {
        const error = new Error(typeof authorization === "string" ? authorization : `operation is not authorized: ${name}`);
        error.code = "TOOL_NOT_AUTHORIZED";
        throw error;
      }
    }
    if (operation.interaction === true) return invokeInteraction(name, operation, args, context);
    if (operation.effect === true) return invokeEffect(name, operation, args, context);
    return operation.execute(args, context);
  }

  return {
    invoke,
    listOperations: () => Object.keys(operations),
    getEffect: (effectId) => effectStore.get(effectId),
    getEffectFor: (name, context = {}) => {
      try {
        return effectStore.get(effectIdFor(name, context).effectId);
      } catch {
        return Promise.resolve(null);
      }
    },
    resolveEffect: async (effectId, decision = {}) => {
      const id = String(effectId ?? "").trim();
      if (!id) throw new TypeError("effectId is required");
      const current = await effectStore.get(id);
      if (!current) {
        const error = new Error(`effect not found: ${id}`);
        error.code = "EFFECT_NOT_FOUND";
        throw error;
      }
      const action = String(decision.action ?? decision.choiceId ?? "").trim().toLowerCase();
      if (action === "confirmed" || action === "already_done" || action === "mark-confirmed") {
        return effectStore.put({
          ...current,
          state: "confirmed",
          confirmedAt: new Date().toISOString(),
          result: clone(decision.result ?? current.result ?? { confirmedByUser: true }),
        });
      }
      if (action === "retry" || action === "replay") {
        return effectStore.put({ ...current, state: "prepared", retryRequestedAt: new Date().toISOString() });
      }
      if (action === "abandon" || action === "cancel") {
        return effectStore.put({ ...current, state: "abandoned", abandonedAt: new Date().toISOString() });
      }
      const error = new Error(`unsupported effect resolution: ${action || "missing action"}`);
      error.code = "INVALID_EFFECT_RESOLUTION";
      throw error;
    },
  };
}
