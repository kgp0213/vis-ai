function omittedSuffix(count) {
  return `… omitted ${count} complete ${count === 1 ? "entry" : "entries"}`;
}

function withinBudget(text, { maxChars = Infinity, maxTokens = Infinity, countTokens = null }) {
  if (text.length > maxChars) return false;
  return !countTokens || countTokens(text) <= maxTokens;
}

export function memoryTokenBudgetForCapacity(contextTokens) {
  const capacity = Number.isFinite(contextTokens) && contextTokens > 0 ? contextTokens : 131072;
  return Math.min(12000, Math.max(4000, Math.floor(capacity * 0.1)));
}

export function buildBudgetedBlocks(entries, { header = "", maxChars = Infinity, maxTokens = Infinity, countTokens = null }) {
  const blocks = entries.map((entry) => ({ key: entry.key, text: String(entry.text ?? "").trim() })).filter((entry) => entry.text);
  const selected = [];
  for (const block of blocks) {
    const candidate = [header, ...selected.map((entry) => entry.text), block.text].filter(Boolean).join("\n\n");
    if (!withinBudget(candidate, { maxChars, maxTokens, countTokens })) break;
    selected.push(block);
  }
  let omitted = blocks.slice(selected.length);
  while (omitted.length > 0 && selected.length > 0) {
    const candidate = [header, ...selected.map((entry) => entry.text), omittedSuffix(omitted.length)].filter(Boolean).join("\n\n");
    if (withinBudget(candidate, { maxChars, maxTokens, countTokens })) break;
    omitted = [selected.pop(), ...omitted];
  }
  const text = [header, ...selected.map((entry) => entry.text), ...(omitted.length ? [omittedSuffix(omitted.length)] : [])].filter(Boolean).join("\n\n");
  return {
    text: withinBudget(text, { maxChars, maxTokens, countTokens }) ? text : "",
    selectedKeys: selected.map((entry) => entry.key),
    omittedKeys: omitted.map((entry) => entry.key),
  };
}

function memoryIndexLine(entry) {
  const name = String(entry.name ?? "").trim();
  const description = String(entry.description ?? "").replace(/\s+/g, " ").trim();
  const maxDescription = Math.max(1, 130 - name.length);
  const clipped = description.length > maxDescription ? `${description.slice(0, maxDescription - 1)}…` : description;
  return `- [${name}](${name}.md) — ${clipped}`;
}

export function buildMemoryIndex(entries, { maxChars = Infinity, maxTokens = Infinity, countTokens = null, excludedKeys = new Set() }) {
  const candidates = entries
    .filter((entry) => !excludedKeys.has(entry.key))
    .map((entry) => ({ key: entry.key, text: memoryIndexLine(entry) }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const selected = [];
  for (const candidate of candidates) {
    const text = [...selected.map((entry) => entry.text), candidate.text].join("\n");
    if (!withinBudget(text, { maxChars, maxTokens, countTokens })) break;
    selected.push(candidate);
  }
  let omitted = candidates.slice(selected.length);
  while (omitted.length > 0 && selected.length > 0) {
    const text = [...selected.map((entry) => entry.text), omittedSuffix(omitted.length)].join("\n");
    if (withinBudget(text, { maxChars, maxTokens, countTokens })) break;
    omitted = [selected.pop(), ...omitted];
  }
  const text = [...selected.map((entry) => entry.text), ...(omitted.length ? [omittedSuffix(omitted.length)] : [])].join("\n");
  return {
    text: withinBudget(text, { maxChars, maxTokens, countTokens }) ? text : "",
    selectedKeys: selected.map((entry) => entry.key),
    omittedKeys: omitted.map((entry) => entry.key),
  };
}

function normalizedMemoryText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function analyzeMemoryEntries(entries) {
  const bodyGroups = new Map();
  const descriptionGroups = new Map();
  const sensitiveKeys = [];
  for (const entry of entries) {
    const key = String(entry.key ?? "");
    const body = normalizedMemoryText(entry.body);
    const description = normalizedMemoryText(entry.description);
    if (body) bodyGroups.set(body, [...bodyGroups.get(body) ?? [], key]);
    if (description) descriptionGroups.set(description, [...descriptionGroups.get(description) ?? [], { key, body }]);
    if (/\b(?:sk-[a-z0-9_-]{16,}|api[_-]?key\s*[:=]\s*\S+|password\s*[:=]\s*\S+|token\s*[:=]\s*\S+)/i.test(String(entry.body ?? ""))) {
      sensitiveKeys.push(key);
    }
  }
  const duplicates = [...bodyGroups.values()].filter((keys) => keys.length > 1).map((keys) => keys.sort());
  const conflicts = [...descriptionGroups.values()]
    .filter((group) => group.length > 1 && new Set(group.map((entry) => entry.body)).size > 1)
    .map((group) => group.map((entry) => entry.key).sort());
  return { duplicates, conflicts, sensitiveKeys: sensitiveKeys.sort() };
}
