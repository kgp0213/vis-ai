/**
 * Merge a replayable text chunk without silently rewriting divergent local
 * state.  Chunks may overlap the local tail because a transport retry can
 * replay bytes that were already reduced.
 */
export function mergeTextAtOffset(localValue, offsetValue, chunkValue) {
  const local = String(localValue ?? "");
  const chunk = String(chunkValue ?? "");
  const offset = Number(offsetValue);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > local.length) {
    return { text: local, changed: false, gap: { expected: local.length, got: offset } };
  }
  if (!chunk) return { text: local, changed: false, duplicate: true };

  // A fully present replay is idempotent.  This also covers chunks shorter
  // than the current tail, which are valid when a provider retries a prefix.
  if (local.slice(offset, offset + chunk.length) === chunk) {
    return { text: local, changed: false, duplicate: true };
  }

  const overlap = local.length - offset;
  if (overlap > 0 && local.slice(offset) !== chunk.slice(0, overlap)) {
    return { text: local, changed: false, gap: { expected: local.length, got: offset } };
  }

  const novel = overlap > 0 ? chunk.slice(overlap) : chunk;
  if (!novel) return { text: local, changed: false, duplicate: true };
  return { text: local.slice(0, offset) + chunk, changed: true };
}
