import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createVHomeSkillDraftStore, renderVHomeSkillFiles, writeVHomeSkillDirectory } from "./vhome-skill-drafts.mjs";
import { validateSkillIntegration } from "./skill-integration.mjs";

const base = {
  name: "weekly-minutes-digest",
  displayName: "每周听记整理",
  description: "整理 V来家 AI 听记并形成周摘要。",
  instructions: "读取本周 AI 听记，按主题归纳结论、行动项和证据缺口。",
  capabilities: ["minutes", "calendar"],
  triggerExamples: ["整理本周钉钉听记", "生成每周会议摘要"],
};

test("draft store persists revisions, expires stale drafts and preserves corrupt files", () => {
  const root = mkdtempSync(join(tmpdir(), "vhome-drafts-"));
  const path = join(root, "drafts.json");
  let timestamp = Date.parse("2026-07-14T00:00:00.000Z");
  const store = createVHomeSkillDraftStore(path, { now: () => timestamp, idFactory: () => "draft-1" });
  try {
    const first = store.prepare(base);
    assert.equal(first.revision, 1);
    assert.throws(() => store.prepare({ ...base, id: first.id }), /revision is required/);
    const second = store.prepare({ ...base, id: first.id, expectedRevision: 1, description: "更新后的说明" });
    assert.equal(second.revision, 2);
    assert.throws(() => store.prepare({ ...base, id: first.id, expectedRevision: 1 }), /revision conflict/);
    timestamp += 8 * 24 * 60 * 60 * 1000;
    assert.deepEqual(store.list().drafts, []);

    writeFileSync(path, "{broken", "utf8");
    assert.throws(() => store.prepare(base), /original file was not modified/);
    assert.equal(readFileSync(path, "utf8"), "{broken");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("renderer is deterministic, read-only and emits scheduling files only when requested", () => {
  const draft = { ...base, id: "draft-1", revision: 1, createdAt: "2026-07-14T00:00:00.000Z", updatedAt: "2026-07-14T00:00:00.000Z", expiresAt: "2026-07-21T00:00:00.000Z" };
  const plain = renderVHomeSkillFiles(draft);
  assert.deepEqual([...plain.keys()], ["SKILL.md", "references/workflow.md"]);
  assert.match(plain.get("SKILL.md"), /only the `dws_read` tool/);
  assert.doesNotMatch(plain.get("SKILL.md"), /--yes|\.dws|dws\.exe/);
  assert.equal(plain.get("SKILL.md"), renderVHomeSkillFiles(draft).get("SKILL.md"));

  const scheduled = { ...draft, schedule: { enabled: true, title: "每周听记", description: "定期整理听记。", task: "整理 {lastRunAt} 至 {date} 的听记。" } };
  const files = renderVHomeSkillFiles(scheduled);
  const manifest = JSON.parse(files.get("integration.json"));
  const templates = JSON.parse(files.get("schedule-templates.json"));
  const validated = validateSkillIntegration(manifest, templates, { expectedId: draft.name });
  assert.equal(validated.templates[0].risk, "read");
  assert.equal(validated.templates[0].requiresConnection, "vhome");
});

test("renderer rejects reserved names and unsupported capabilities", () => {
  assert.throws(() => renderVHomeSkillFiles({ ...base, name: "dws" }), /reserved/);
  assert.throws(() => renderVHomeSkillFiles({ ...base, name: "invalid-" }), /lowercase/);
  assert.throws(() => renderVHomeSkillFiles({ ...base, capabilities: ["messages", "write-messages"] }), /unsupported/);
});

test("writer creates the expected complete skill directory", () => {
  const root = mkdtempSync(join(tmpdir(), "vhome-render-"));
  try {
    const files = writeVHomeSkillDirectory(root, base);
    assert.deepEqual(files, ["SKILL.md", "references/workflow.md"]);
    assert.ok(existsSync(join(root, "references", "workflow.md")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
