const THIRD_PARTY_ORIGIN_PREFIXES = [
  "chrome-extension://",
  "moz-extension://",
  "safari-web-extension://",
  "safari-extension://",
  "ms-browser-extension://",
];

export function isThirdPartyError(error: unknown, filename?: string): boolean {
  const stack = error && typeof error === "object" && "stack" in error
    ? String((error as { stack?: unknown }).stack ?? "")
    : "";
  const haystack = `${filename ?? ""}\n${stack}`;
  return THIRD_PARTY_ORIGIN_PREFIXES.some((prefix) => haystack.includes(prefix));
}
