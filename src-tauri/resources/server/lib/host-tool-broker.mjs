import { createHash, randomUUID } from "node:crypto";

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

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function memoryEffectStore() {
  const values = new Map();
  return {
    async get(id) { return clone(values.get(id) ?? null); },
    async put(value) { values.set(value.effectId, clone(value)); return clone(value); },
  };
}

export function createHostToolBroker(options = {}) {
  const operations = options.operations && typeof options.operations === "object" ? options.operations : {};
  const effectStore = options.effectStore ?? memoryEffectStore();
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
    const previous = await effectStore.get(identity.effectId);
    if (previous && previous.argsHash !== argsHash) throw idempotencyConflictError(previous, argsHash);
    if (previous?.state === "confirmed") return clone(previous.result);
    if (["dispatched", "unknown"].includes(previous?.state)) throw unknownEffectError({ ...previous, state: "unknown" });
    if (inflightEffects.has(identity.effectId)) return inflightEffects.get(identity.effectId);

    const execution = (async () => {
      const base = {
        effectId: identity.effectId,
        taskId: context?.taskId ?? null,
        unitId: context?.unitId ?? null,
        operation: name,
        idempotencyKey: identity.idempotencyKey,
        argsHash,
        preparedAt: previous?.preparedAt ?? new Date().toISOString(),
      };
      await effectStore.put({ ...base, state: "prepared" });
      await effectStore.put({ ...base, state: "dispatched", dispatchedAt: new Date().toISOString() });
      try {
        const result = await operation.execute(args, { ...context, idempotencyKey: identity.idempotencyKey, effectId: identity.effectId });
        await effectStore.put({ ...base, state: "confirmed", dispatchedAt: new Date().toISOString(), confirmedAt: new Date().toISOString(), result: clone(result) });
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
    inflightEffects.set(identity.effectId, execution);
    try {
      return await execution;
    } finally {
      if (inflightEffects.get(identity.effectId) === execution) inflightEffects.delete(identity.effectId);
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
      const authorization = await options.authorize(name, args, context, operation);
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
