function boundedText(value, max = 2400) {
  return String(value ?? "").slice(0, max);
}

/** Normalize the shared resource contract used by tools, context and UI. */
export function normalizeResourceReference({
  resourceId,
  kind = "tool-output",
  preview = "",
  totalBytes = 0,
  offsetBytes = 0,
  nextOffsetBytes = offsetBytes,
  complete = false,
  expiresAt = null,
  readAction = null,
} = {}) {
  const id = String(resourceId ?? "").trim();
  if (!id) return null;
  const total = Math.max(0, Number(totalBytes) || 0);
  const offset = Math.min(Math.max(0, Number(offsetBytes) || 0), total);
  const next = Math.max(offset, Number(nextOffsetBytes) || offset);
  // A page cursor must never advertise bytes beyond the known resource.
  const boundedNext = Math.min(Math.max(next, offset), total);
  return {
    resourceId: id,
    kind: String(kind || "tool-output").slice(0, 80),
    preview: boundedText(preview),
    totalBytes: total,
    offsetBytes: offset,
    nextOffsetBytes: boundedNext,
    // A zero total is also the default for an unknown length. It must not be
    // treated as EOF unless the producer explicitly marked the resource
    // complete (an actually empty resource can do so explicitly).
    complete: complete === true || (total > 0 && boundedNext >= total),
    expiresAt: expiresAt ? String(expiresAt).slice(0, 80) : null,
    readAction: readAction ? String(readAction).slice(0, 160) : null,
  };
}
