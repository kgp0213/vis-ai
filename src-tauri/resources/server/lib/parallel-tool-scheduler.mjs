const READ_ONLY_TOOLS = new Set(["read_file", "read_media", "list_directory", "get_file_info", "search_files", "read_tool_output"]);

function text(value) { return String(value ?? "").trim(); }

function parseCallArgs(call = {}) {
  if (call.args && typeof call.args === "object") return call.args;
  if (call.toolArgs && typeof call.toolArgs === "object") return call.toolArgs;
  const raw = call.function?.arguments;
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function pathsFor(args = {}) {
  const values = [args.path, args.filePath, args.directory, ...(Array.isArray(args.paths) ? args.paths : [])];
  return [...new Set(values.map((value) => text(value).replace(/\\/g, "/").replace(/\/+$/u, "").toLowerCase()).filter(Boolean))];
}

export function toolResourceClaims(call = {}) {
  const name = text(call.name ?? call.toolName ?? call.function?.name).toLowerCase();
  const args = parseCallArgs(call);
  const paths = pathsFor(args);
  const recipients = [args.to, args.recipient, args.chatId, args.conversationId].map(text).filter(Boolean);
  const attachments = (Array.isArray(args.attachments) ? args.attachments : []).map((item) => text(item?.sha256 ?? item?.id ?? item)).filter(Boolean);
  const readOnly = READ_ONLY_TOOLS.has(name) && call.effect !== true && call.write !== true;
  return { name, paths, recipients, attachments, readOnly, declared: paths.length > 0 || recipients.length > 0 || attachments.length > 0 };
}

function pathOverlaps(left, right) {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

export function toolClaimsConflict(left, right) {
  const a = toolResourceClaims(left);
  const b = toolResourceClaims(right);
  if (!a.declared || !b.declared) return true;
  if (!a.readOnly || !b.readOnly) return true;
  if (a.paths.some((path) => b.paths.some((other) => pathOverlaps(path, other)))) return true;
  if (a.recipients.some((recipient) => b.recipients.includes(recipient))) return true;
  if (a.attachments.some((item) => b.attachments.includes(item))) return true;
  return false;
}

/** Returns model-order batches. The caller still executes through the existing loop. */
export function planToolCallBatches(calls = [], { maxParallel = 3 } = {}) {
  const list = Array.isArray(calls) ? calls : [];
  const limit = Math.max(1, Math.min(16, Math.floor(Number(maxParallel) || 3)));
  const batches = [];
  for (const call of list) {
    // Batches must remain contiguous input prefixes. The loop consumer
    // advances by batch length; filling an earlier batch with a later call
    // would otherwise skip or repeat an intervening conflicting call.
    let target = batches.at(-1);
    if (!target || target.length >= limit || target.some((existing) => toolClaimsConflict(existing, call))) {
      target = [];
      batches.push(target);
    }
    target.push(call);
  }
  return { batches, parallelEnabled: batches.some((batch) => batch.length > 1), reason: batches.some((batch) => batch.length > 1) ? "disjoint-read-only" : "serial-or-undeclared" };
}
