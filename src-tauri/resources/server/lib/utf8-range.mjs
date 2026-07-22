export function utf8SafePrefixLength(buffer, requestedBytes) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer ?? "");
  if (bytes.length === 0) return 0;
  const limit = Math.max(1, Math.min(bytes.length, Number(requestedBytes) || bytes.length));
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const isValid = (end) => {
    try {
      decoder.decode(bytes.subarray(0, end));
      return true;
    } catch {
      return false;
    }
  };

  // Prefer the requested limit. If it ends inside a multi-byte character,
  // extend by at most three bytes so a caller never receives a split sequence.
  if (isValid(limit)) return limit;
  const extensionLimit = Math.min(bytes.length, limit + 3);
  for (let end = limit + 1; end <= extensionLimit; end += 1) {
    if (isValid(end)) return end;
  }

  // Invalid or non-UTF-8 output still needs to make progress. Retain the
  // requested prefix; the normal decoder will replace malformed bytes.
  return limit;
}
