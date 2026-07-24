import { createHash } from "node:crypto";

function normalizedBaseUrl(value) {
  return String(value ?? "").trim().replace(/\/+$/, "");
}

function capabilityInputs(model) {
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
    ...capabilityInputs(model),
  };
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
