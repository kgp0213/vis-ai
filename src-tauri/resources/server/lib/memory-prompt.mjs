function omittedSuffix(count) {
  return `… omitted ${count} complete ${count === 1 ? "entry" : "entries"}`;
}

export function buildBudgetedBlocks(entries, { header = "", maxChars }) {
  const blocks = entries.map((entry) => ({ key: entry.key, text: String(entry.text ?? "").trim() })).filter((entry) => entry.text);
  const selected = [];
  for (const block of blocks) {
    const candidate = [header, ...selected.map((entry) => entry.text), block.text].filter(Boolean).join("\n\n");
    if (candidate.length > maxChars) break;
    selected.push(block);
  }
  let omitted = blocks.slice(selected.length);
  while (omitted.length > 0 && selected.length > 0) {
    const candidate = [header, ...selected.map((entry) => entry.text), omittedSuffix(omitted.length)].filter(Boolean).join("\n\n");
    if (candidate.length <= maxChars) break;
    omitted = [selected.pop(), ...omitted];
  }
  const text = [header, ...selected.map((entry) => entry.text), ...(omitted.length ? [omittedSuffix(omitted.length)] : [])].filter(Boolean).join("\n\n");
  return {
    text: text.length <= maxChars ? text : text.slice(0, maxChars),
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

export function buildMemoryIndex(entries, { maxChars, excludedKeys = new Set() }) {
  const candidates = entries
    .filter((entry) => !excludedKeys.has(entry.key))
    .map((entry) => ({ key: entry.key, text: memoryIndexLine(entry) }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const selected = [];
  for (const candidate of candidates) {
    if ([...selected.map((entry) => entry.text), candidate.text].join("\n").length > maxChars) break;
    selected.push(candidate);
  }
  let omitted = candidates.slice(selected.length);
  while (omitted.length > 0 && selected.length > 0) {
    const text = [...selected.map((entry) => entry.text), omittedSuffix(omitted.length)].join("\n");
    if (text.length <= maxChars) break;
    omitted = [selected.pop(), ...omitted];
  }
  const text = [...selected.map((entry) => entry.text), ...(omitted.length ? [omittedSuffix(omitted.length)] : [])].join("\n");
  return {
    text: text.length <= maxChars ? text : text.slice(0, maxChars),
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
