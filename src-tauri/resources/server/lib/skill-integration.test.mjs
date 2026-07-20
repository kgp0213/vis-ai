import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  compareVersions,
  loadSkillIntegrations,
  renderSkillScheduleTask,
  resolveSkillScheduleTemplate,
  validateSkillIntegration,
} from "./skill-integration.mjs";

const manifest = {
  schemaVersion: 1,
  id: "dws",
  displayName: "V来家",
  version: "1.0.52",
  integrationApiVersion: 1,
  runtimeRequirements: { dws: { minVersion: "1.0.51" } },
  capabilities: ["messages", "calendar"],
};

const templates = {
  schemaVersion: 1,
  integration: "dws",
  templates: [{
    id: "unread-digest",
    title: "未读消息摘要",
    description: "读取未读消息并生成摘要。",
    task: "汇总 {lastRunAt} 之后的未读消息，当前日期 {date}。",
    risk: "read",
    scheduleAllowed: true,
    requiresConnection: "vhome",
  }],
};

test("skill integration validates versions, templates and safe variables", () => {
  const parsed = validateSkillIntegration(manifest, templates, { expectedId: "dws" });
  assert.equal(parsed.templates[0].risk, "read");
  assert.equal(compareVersions("v1.0.51", "1.0.51"), 0);
  assert.equal(compareVersions("1.0.50", "1.0.51"), -1);
  assert.throws(() => validateSkillIntegration(manifest, {
    ...templates,
    templates: [{ ...templates.templates[0], task: "读取 {workspace}" }],
  }, { expectedId: "dws" }), /unsupported variable/);
  assert.throws(() => validateSkillIntegration(manifest, {
    ...templates,
    templates: [{ ...templates.templates[0], risk: "confirm" }],
  }, { expectedId: "dws" }), /unsupported risk/);
});

test("installed integration templates are version-gated and resolved at run time", () => {
  const root = mkdtempSync(join(tmpdir(), "skill-integration-"));
  const skillDir = join(root, "dws");
  mkdirSync(skillDir, { recursive: true });
  try {
    writeFileSync(join(skillDir, "integration.json"), `${JSON.stringify(manifest)}\n`);
    writeFileSync(join(skillDir, "schedule-templates.json"), `${JSON.stringify(templates)}\n`);
    const incompatible = loadSkillIntegrations(root, { runtimeVersions: { dws: "1.0.50" } });
    assert.equal(incompatible[0].compatible, false);
    const resolved = resolveSkillScheduleTemplate(root, "dws", "unread-digest", { runtimeVersions: { dws: "1.0.51" } });
    assert.equal(resolved.integration.version, "1.0.52");
    assert.equal(renderSkillScheduleTask(resolved.template, { date: "2026-07-13", lastRunAt: "09:00" }, "仅列重要事项"), "汇总 09:00 之后的未读消息，当前日期 2026-07-13。\n\n用户补充要求：\n仅列重要事项");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("skill integrations do not expose task recipes as separate execution entry points", () => {
  const root = mkdtempSync(join(tmpdir(), "skill-task-recipe-"));
  const skillDir = join(root, "document-organizer");
  const recipeFile = {
    schemaVersion: 1,
    integration: "document-organizer",
    recipes: [{
      id: "multi-document-report",
      title: "跨文档报告",
      description: "合并多个来源并保留追溯。",
      version: 1,
      tool: "organize_documents_to_report",
      inputCardinality: "multiple",
      formats: ["pdf", "word"],
      phases: ["prepare", "extract", "review", "commit"],
      permissions: ["read-source", "write-output"],
      completionContract: "complete-with-summary-and-source-list",
      hostManaged: true,
      resumable: true,
    }],
  };
  const recipeManifest = {
    schemaVersion: 1,
    id: "document-organizer",
    displayName: "文档整理",
    version: "1.1.0",
    integrationApiVersion: 1,
    runtimeRequirements: {},
  };
  try {
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "integration.json"), `${JSON.stringify(recipeManifest)}\n`);
    writeFileSync(join(skillDir, "schedule-templates.json"), `${JSON.stringify({ schemaVersion: 1, integration: "document-organizer", templates: [] })}\n`);
    writeFileSync(join(skillDir, "task-recipes.json"), `${JSON.stringify(recipeFile)}\n`);
    const loaded = loadSkillIntegrations(root);
    assert.equal(Object.hasOwn(loaded[0], "recipes"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
