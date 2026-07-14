import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { classifyVHomeSkillAuthoringIntent, routeAutomaticSkill } from "../lib/skill-routing.mjs";

describe("V-home Skill authoring intent", () => {
  const positives = [
    "帮我创建一个每周整理钉钉听记的技能",
    "我想定制一个V来家周报skill",
    "把刚才的DWS整理流程保存成技能",
    "创建一个钉钉听记总结工作流",
    "我想做一个每周整理钉钉消息的自动化",
    "create a reusable DingTalk weekly summary skill",
  ];
  for (const text of positives) {
    test(`routes explicit authoring request: ${text}`, () => {
      const classified = classifyVHomeSkillAuthoringIntent(text);
      assert.equal(classified.matched, true);
      assert.ok(classified.score >= classified.threshold);
      assert.deepEqual(routeAutomaticSkill(text), { name: "vhome-skill-builder", task: text, source: "automatic" });
    });
  }

  const negatives = [
    "查询今天的钉钉消息",
    "检查 DWS Skill 的源码",
    "为什么技能创建卡片没有出现",
    "评估钉钉技能创建功能如何实现",
    "修改钉钉技能创建逻辑",
    "阅读 DWS Skill 文档",
    "测试钉钉技能安装流程",
    "介绍一下 Skill 是什么",
  ];
  for (const text of negatives) {
    test(`does not interrupt technical or ordinary discussion: ${text}`, () => {
      assert.equal(classifyVHomeSkillAuthoringIntent(text).matched, false);
      assert.notDeepEqual(routeAutomaticSkill(text)?.name, "vhome-skill-builder");
    });
  }

  test("explicit mentions and slash commands remain authoritative", () => {
    assert.equal(routeAutomaticSkill("@vhome-skill-builder 创建钉钉技能"), null);
    assert.equal(routeAutomaticSkill("/skill vhome-skill-builder 创建钉钉技能"), null);
  });
});

test("builder Skill requires interactive cards and controlled draft tools", () => {
  const skillPath = fileURLToPath(new URL("../../bootstrap-skills/vhome-skill-builder/SKILL.md", import.meta.url));
  assert.equal(existsSync(skillPath), true);
  const body = readFileSync(skillPath, "utf8");
  assert.match(body, /Start with `ask_choice`/);
  assert.match(body, /Never list a prose menu/);
  assert.match(body, /prepare_vhome_skill_draft/);
  assert.match(body, /test_vhome_skill_draft/);
  assert.match(body, /install_vhome_skill_draft/);
  assert.match(body, /Generated Skills must use `dws_read`/);
  assert.match(body, /Never invoke a direct DWS executable/);
});
