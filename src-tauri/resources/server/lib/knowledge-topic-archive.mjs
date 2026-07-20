import { existsSync, mkdirSync, realpathSync, renameSync } from "node:fs";
import { basename, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";

function safeTopicId(value) {
  return String(value || "topic").replace(/[^A-Za-z0-9\u4e00-\u9fa5._-]+/g, "-").slice(0, 80) || "topic";
}

/** Move a rejected topic out of the active topics tree without losing it. */
export function archiveRejectedKnowledgeTopic({ target, knowledgeRoot, rejectedDir, topicId, now = new Date(), uniqueId = randomUUID() } = {}) {
  const source = resolve(String(target || ""));
  const root = realpathSync(resolve(String(knowledgeRoot || "")));
  if (!source || !source.startsWith(root + sep) || !existsSync(source)) throw new Error("knowledge topic is not a readable workspace file");
  mkdirSync(rejectedDir, { recursive: true });
  const archiveRoot = realpathSync(rejectedDir);
  if (!(archiveRoot === root || archiveRoot.startsWith(root + sep))) throw new Error("knowledge rejected archive escapes the workspace");
  const stamp = new Date(now).toISOString().replace(/[:.]/g, "-");
  const suffix = String(uniqueId || randomUUID()).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 16) || randomUUID().slice(0, 8);
  const original = safeTopicId(topicId || basename(source, ".md"));
  const destination = resolve(archiveRoot, `${stamp}-${original}-${suffix}.md.txt`);
  if (!destination.startsWith(archiveRoot + sep)) throw new Error("knowledge rejected archive path escapes the archive directory");
  renameSync(source, destination);
  return destination;
}
