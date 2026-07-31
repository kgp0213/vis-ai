/**
 * Keep technical diagnostics useful to a user without echoing credentials
 * that may have been included in a provider or tool error.
 */
export function redactSensitiveDisplayText(value: any): string {
  let text = String(value ?? "");
  text = text.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]");
  text = text.replace(
    /(["']?(?:api[_-]?key|apikey|access[_-]?token|refresh[_-]?token|password|secret|credential|authorization)["']?\s*[:=]\s*)(?:"([^"]*)"|'([^']*)'|([^\s,;}\]]+))/gi,
    (_match, prefix, doubleQuoted, singleQuoted) => `${prefix}${doubleQuoted !== undefined ? '"[redacted]"' : singleQuoted !== undefined ? "'[redacted]'" : "[redacted]"}`,
  );
  text = text.replace(/([?&](?:token|api[_-]?key|apikey|access[_-]?token|secret)=)[^&#\s]+/gi, "$1[redacted]");
  text = text.replace(/\b(?:sk|ark)-[A-Za-z0-9_-]{12,}\b/gi, "[redacted-key]");
  return text;
}

/** Convert structured diagnostics to a bounded, credential-safe display string. */
export function safeTechnicalDisplayText(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return redactSensitiveDisplayText(value);
  try {
    return redactSensitiveDisplayText(JSON.stringify(value));
  } catch {
    return redactSensitiveDisplayText(String(value));
  }
}

export function redactTechnicalMessages(values: any, options: { maxItems?: number; maxChars?: number } = {}): string[] {
  const maxItems = Number.isSafeInteger(options.maxItems) && options.maxItems! > 0 ? options.maxItems! : 8;
  const maxChars = Number.isSafeInteger(options.maxChars) && options.maxChars! > 0 ? options.maxChars! : 1600;
  return (Array.isArray(values) ? values : [values])
    .filter((value) => value !== null && value !== undefined && String(value).trim())
    .slice(0, maxItems)
    .map((value) => {
      const text = safeTechnicalDisplayText(value).trim();
      return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
    });
}
