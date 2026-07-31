/**
 * Small, provider-agnostic guards for non-document model tasks.
 *
 * The launcher owns model selection and capability resolution.  This module
 * deliberately accepts a client and a resolved capability object so it can be
 * tested without starting the launcher or making a network request.
 */

const JSON_RETRY_LIMIT = 2;
const INCOMPLETE_FINISH_REASONS = new Set(["length", "content_filter"]);

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export function capModelOutputTokens(requested, capabilities = {}) {
  const requestedTokens = positiveInteger(requested);
  const capacity = positiveInteger(capabilities?.maxOutputTokens);
  if (!requestedTokens) return capacity ?? undefined;
  return capacity ? Math.min(requestedTokens, capacity) : requestedTokens;
}

export function modelFinishReason(response) {
  const direct = response?.finishReason;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const raw = response?.raw?.choices?.[0]?.finish_reason;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function responseFormatUnsupported(error) {
  return /response[_ ]?format|json_object/i.test(String(error?.message || error || ""));
}

export function assertUsableModelResponse(response, { label = "model task", allowEmpty = false } = {}) {
  const finishReason = modelFinishReason(response);
  if (finishReason && INCOMPLETE_FINISH_REASONS.has(finishReason)) {
    throw new Error(`${label} returned incomplete output (finish reason: ${finishReason})`);
  }
  const content = typeof response?.content === "string" ? response.content : "";
  if (!allowEmpty && !content.trim()) {
    throw new Error(`${label} returned empty response`);
  }
  return content;
}

export function assertModelProbeMarker(response, marker, { label = "model probe" } = {}) {
  const expected = String(marker || "").trim();
  if (!expected) throw new TypeError("model probe marker is required");
  let normalized = assertUsableModelResponse(response, { label }).trim();
  const fenced = /^```(?:text|txt)?\s*\n?([\s\S]*?)\n?```$/i.exec(normalized);
  if (fenced) normalized = fenced[1].trim();
  if (/^"[\s\S]*"$/.test(normalized)) {
    try {
      const parsed = JSON.parse(normalized);
      if (typeof parsed === "string") normalized = parsed.trim();
    } catch {
      // A malformed quoted response is handled by the exact comparison below.
    }
  }
  if (normalized !== expected) throw new Error(`${label} did not exactly echo ${expected}`);
  return expected;
}

function parseModelJson(content, label) {
  const raw = String(content || "").trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${label} returned invalid JSON: ${error.message}`);
  }
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new DOMException("model task cancelled", "AbortError");
  }
}

/**
 * Request a JSON response while respecting the model's declared capabilities.
 * A provider that falsely declares JSON support may still reject
 * response_format; in that case we retry once without the optional hint.
 */
export async function requestModelJson({
  client,
  capabilities = {},
  label = "model JSON task",
  messages,
  model,
  maxTokens,
  temperature = 0,
  requestPurpose,
  signal,
  preferStructuredOutput = true,
}) {
  if (!client || typeof client.chat !== "function") throw new Error(`${label} has no model client`);
  const boundedMaxTokens = capModelOutputTokens(maxTokens, capabilities);
  let structuredOutput = preferStructuredOutput !== false && capabilities?.structuredOutput === true;
  let parseFailures = 0;
  let retryMessages = messages;

  while (parseFailures < JSON_RETRY_LIMIT) {
    throwIfAborted(signal);
    let response;
    try {
      response = await client.chat({
        model,
        messages: retryMessages,
        temperature,
        maxTokens: boundedMaxTokens,
        requestPurpose,
        responseFormat: structuredOutput ? { type: "json_object" } : undefined,
        signal,
      });
    } catch (error) {
      if (structuredOutput && responseFormatUnsupported(error)) {
        structuredOutput = false;
        continue;
      }
      throw error;
    }

    const content = assertUsableModelResponse(response, { label });
    try {
      return parseModelJson(content, label);
    } catch (error) {
      parseFailures++;
      if (parseFailures >= JSON_RETRY_LIMIT) throw error;
      retryMessages = [
        ...messages,
        {
          role: "system",
          content: "The previous response was invalid or incomplete JSON. Return the requested compact JSON value again, preserving the original object-or-array schema, escaping string control characters, and using no Markdown.",
        },
      ];
    }
  }
  throw new Error(`${label} did not return valid JSON`);
}

/** Request a text artifact and reject empty/truncated provider responses. */
export async function requestModelText({
  client,
  capabilities = {},
  label = "model text task",
  messages,
  model,
  maxTokens,
  temperature,
  requestPurpose,
  useConfiguredRequestDefaults = false,
  signal,
  allowEmpty = false,
}) {
  if (!client || typeof client.chat !== "function") throw new Error(`${label} has no model client`);
  const resolvedTemperature = useConfiguredRequestDefaults ? temperature : temperature ?? 0;
  const resolvedMaxTokens = useConfiguredRequestDefaults && maxTokens === undefined
    ? undefined
    : capModelOutputTokens(maxTokens, capabilities);
  const response = await client.chat({
    model,
    messages,
    temperature: resolvedTemperature,
    maxTokens: resolvedMaxTokens,
    requestPurpose,
    signal,
  });
  return assertUsableModelResponse(response, { label, allowEmpty });
}
