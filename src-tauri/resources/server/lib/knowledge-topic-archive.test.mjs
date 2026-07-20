import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { archiveRejectedKnowledgeTopic } from "./knowledge-topic-archive.mjs";

test("rejected knowledge is recoverable but no longer has a Markdown extension", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-knowledge-rejected-"));
  try {
    const topicsDir = join(root, "topics");
    const rejectedDir = join(root, "rejected");
    const target = join(topicsDir, "topic-a.md");
    await mkdir(topicsDir, { recursive: true });
    await writeFile(target, "# Original knowledge\n\nRecover me.\n", "utf8");

    const archived = archiveRejectedKnowledgeTopic({
      target,
      knowledgeRoot: root,
      rejectedDir,
      topicId: "topic-a",
      now: new Date("2026-07-18T10:20:30.000Z"),
      uniqueId: "12345678-abcd",
    });

    assert.equal(existsSync(target), false);
    assert.equal(archived.startsWith(`${rejectedDir}\\`) || archived.startsWith(`${rejectedDir}/`), true);
    assert.match(archived, /topic-a-12345678-abcd\.md\.txt$/);
    assert.equal(await readFile(archived, "utf8"), "# Original knowledge\n\nRecover me.\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
