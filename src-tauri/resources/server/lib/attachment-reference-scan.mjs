import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const ATTACHMENT_ID_RE = /^att_[0-9a-f-]{20,}$/i;

function addAttachmentItems(value, ids) {
  for (const item of Array.isArray(value) ? value : []) {
    const id = typeof item === "string" ? item : item?.id;
    if (ATTACHMENT_ID_RE.test(String(id ?? ""))) ids.add(String(id));
  }
}

function collectAttachmentFields(value, ids) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectAttachmentFields(item, ids);
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (key === "attachments") addAttachmentItems(item, ids);
    else collectAttachmentFields(item, ids);
  }
}

async function scanJsonLines(path, ids, warnings) {
  let raw;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") warnings.push(`${path}: ${error.message}`);
    return false;
  }
  let malformed = false;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      collectAttachmentFields(JSON.parse(line), ids);
    } catch {
      malformed = true;
    }
  }
  if (malformed) warnings.push(`${path}: one or more JSONL records are invalid`);
  return true;
}

async function scanPromptQueue(path, ids, warnings) {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    collectAttachmentFields(parsed?.queues, ids);
    return true;
  } catch (error) {
    if (error?.code !== "ENOENT") warnings.push(`${path}: ${error.message}`);
    return error?.code !== "ENOENT";
  }
}

export async function collectAttachmentReferences({ activeSessionFile, sessionsDir, promptQueueFile } = {}) {
  const ids = new Set();
  const warnings = [];
  let scannedFiles = 0;
  if (activeSessionFile && await scanJsonLines(resolve(activeSessionFile), ids, warnings)) scannedFiles++;
  if (sessionsDir) {
    const root = resolve(sessionsDir);
    const entries = await readdir(root, { withFileTypes: true }).catch((error) => {
      if (error?.code !== "ENOENT") warnings.push(`${root}: ${error.message}`);
      return [];
    });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".jsonl")) continue;
      if (await scanJsonLines(resolve(root, entry.name), ids, warnings)) scannedFiles++;
    }
  }
  if (promptQueueFile && await scanPromptQueue(resolve(promptQueueFile), ids, warnings)) scannedFiles++;
  return { ids: [...ids].sort(), warnings, scannedFiles, complete: warnings.length === 0 };
}
