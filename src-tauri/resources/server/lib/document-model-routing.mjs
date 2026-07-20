import { createHash } from "node:crypto";

const DEFAULT_VERIFICATION_TTL_MS = 15 * 60_000;
const TEXT_ROLES = new Set(["chat", "document-draft", "document-review", "summary"]);

function normalizedBaseUrl(value) {
  return String(value ?? "").trim().replace(/\/+$/, "");
}

function capabilitiesForFingerprint(model) {
  return {
    capabilities: model?.capabilities ?? null,
    multimodal: model?.multimodal === true,
    maxContextLength: Number.isSafeInteger(model?.maxContextLength) ? model.maxContextLength : null,
    requestDefaults: model?.requestDefaults ?? null,
    verificationRequestDefaults: model?.verificationRequestDefaults ?? null,
    visionPolicy: model?.visionPolicy ?? null,
    agentPolicy: model?.agentPolicy ?? null,
    disabled: model?.disabled === true,
  };
}

export function modelConfigFingerprint(provider, model, requestConfig = {}) {
  const value = {
    providerId: String(provider?.id ?? ""),
    baseUrl: normalizedBaseUrl(provider?.baseUrl),
    apiKey: String(provider?.apiKey ?? ""),
    modelId: String(model?.id ?? ""),
    requestConfig: requestConfig ?? {},
    ...capabilitiesForFingerprint(model),
  };
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function legacyModelVerificationFingerprint(provider, model, requestConfig = {}) {
  return createHash("sha256").update(JSON.stringify({
    providerId: String(provider?.id ?? ""),
    baseUrl: normalizedBaseUrl(provider?.baseUrl),
    apiKey: String(provider?.apiKey ?? ""),
    modelId: String(model?.id ?? ""),
    requestConfig: requestConfig ?? {},
  })).digest("hex");
}

export function getModelVerificationState(provider, model, options = {}) {
  const now = Number(options.now) || Date.now();
  const ttlMs = Math.max(1_000, Number(options.ttlMs) || DEFAULT_VERIFICATION_TTL_MS);
  const requestConfig = options.requestConfig ?? {};
  const currentFingerprint = modelConfigFingerprint(provider, model, requestConfig);
  const acceptedFingerprints = new Set([
    currentFingerprint,
    legacyModelVerificationFingerprint(provider, model, requestConfig),
    ...(Array.isArray(options.acceptedFingerprints) ? options.acceptedFingerprints : []),
  ]);
  const verification = model?.verification;
  if (!verification || !acceptedFingerprints.has(String(verification.fingerprint ?? ""))) {
    return {
      status: "untested",
      automaticEligible: true,
      requiresProbe: true,
      reason: verification ? "configuration-changed" : "not-tested",
      fingerprint: currentFingerprint,
      checkedAt: null,
      error: null,
    };
  }

  const checkedAtMs = Date.parse(String(verification.checkedAt ?? ""));
  if (!Number.isFinite(checkedAtMs) || now - checkedAtMs > ttlMs) {
    return {
      status: "stale",
      automaticEligible: true,
      requiresProbe: true,
      reason: "verification-expired",
      fingerprint: currentFingerprint,
      checkedAt: verification.checkedAt ?? null,
      error: verification.error ?? null,
    };
  }

  if (verification.ok === true) {
    return {
      status: "passed",
      automaticEligible: true,
      requiresProbe: false,
      reason: "recent-verification-success",
      fingerprint: currentFingerprint,
      checkedAt: verification.checkedAt,
      error: null,
    };
  }

  return {
    status: "failed",
    automaticEligible: false,
    requiresProbe: false,
    reason: "recent-verification-failure",
    fingerprint: currentFingerprint,
    checkedAt: verification.checkedAt,
    error: verification.error ?? "model test failed",
  };
}

export function modelSupportsRole(model, role) {
  const requested = String(role ?? "").trim();
  if (!requested) return false;
  const roles = Array.isArray(model?.capabilities?.roles) ? model.capabilities.roles : [];
  if (roles.length > 0) return roles.includes(requested);
  if (requested === "vision-review") {
    return model?.multimodal === true || model?.capabilities?.inputModalities?.includes("image") === true;
  }
  return TEXT_ROLES.has(requested);
}

export function modelInputModalities(model) {
  const declared = Array.isArray(model?.capabilities?.inputModalities)
    ? model.capabilities.inputModalities.filter((value) => ["text", "image"].includes(value))
    : [];
  if (declared.length > 0) return [...new Set(declared)];
  return model?.multimodal === true ? ["text", "image"] : ["text"];
}

/**
 * Choose a candidate for one document unit using capability evidence first,
 * then a bounded live probe for candidates whose persisted verification is
 * missing or stale.  A vision requirement is fail-closed: a text-only model
 * is never an acceptable fallback for visual work.
 */
export async function selectUsableDocumentModel(candidates, {
  requiredCapabilities = [],
  attempt = 1,
  probe,
  signal,
} = {}) {
  const list = Array.isArray(candidates) ? candidates.filter((candidate) => candidate && candidate.disabled !== true) : [];
  const needsVision = (Array.isArray(requiredCapabilities) ? requiredCapabilities : []).some((capability) => String(capability).trim().toLowerCase() === "vision");
  const capable = list.filter((candidate) => !needsVision || candidate.multimodal === true);
  if (needsVision && capable.length === 0) {
    return { ok: false, reason: "capability-unavailable", failures: [] };
  }
  const eligible = capable.filter((candidate) => candidate.verificationStatus !== "failed");
  if (eligible.length === 0) {
    return { ok: false, reason: "verification-failed", failures: [] };
  }
  const offset = Math.max(0, (Math.max(1, Number(attempt) || 1) - 1) % eligible.length);
  const ordered = [...eligible.slice(offset), ...eligible.slice(0, offset)];
  const failures = [];
  for (const candidate of ordered) {
    if (candidate.verificationStatus === "passed" && candidate.requiresProbe !== true) {
      return { ok: true, candidate, verification: { ok: true, source: "persisted-verification" }, failures };
    }
    if (typeof probe !== "function") {
      failures.push({ candidate: candidate.modelId, reason: "probe-unavailable" });
      continue;
    }
    let result;
    try {
      result = await probe(candidate, signal);
    } catch (error) {
      result = { ok: false, error: String(error?.message || error) };
    }
    if (result?.ok === true) return { ok: true, candidate, verification: result, failures };
    failures.push({ candidate: candidate.modelId, reason: result?.error || "probe-failed" });
  }
  return { ok: false, reason: "probe-failed", failures };
}
