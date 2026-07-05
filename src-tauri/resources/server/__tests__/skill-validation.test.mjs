import { test, describe } from "node:test";
import assert from "node:assert/strict";

const chunkUrl = new URL("../visionox-pkg/dist/cli/chunk-2K65GZBT.js", import.meta.url);
const { validateSkillFrontmatter } = await import(chunkUrl.href);

describe("validateSkillFrontmatter", () => {
  test("有效 frontmatter + description → { ok: true }", () => {
    const raw = "---\nname: my-skill\ndescription: A helpful skill\n---\n\n# Body";
    const result = validateSkillFrontmatter(raw);
    assert.deepEqual(result, { ok: true });
  });

  test("缺少 description → { error: '...' }", () => {
    const raw = "---\nname: no-desc\n---\n\n# Body";
    const result = validateSkillFrontmatter(raw);
    assert.ok(result.error);
    assert.ok(result.error.includes("description"));
  });

  test("description 为空字符串 → { error: '...' }", () => {
    const raw = "---\nname: empty\ndescription: \"\"\n---\n\n# Body";
    const result = validateSkillFrontmatter(raw);
    assert.ok(result.error);
  });

  test("description 仅空白 → { error: '...' }", () => {
    const raw = "---\nname: whitespace\ndescription: \"   \"\n---\n\n# Body";
    const result = validateSkillFrontmatter(raw);
    assert.ok(result.error);
  });

  test("无 frontmatter 块（无 --- 分隔符）→ { error: '...' }", () => {
    const raw = "# Just a heading\n\nNo frontmatter here.";
    const result = validateSkillFrontmatter(raw);
    assert.ok(result.error);
  });

  test("有效 frontmatter + 额外字段 → { ok: true }", () => {
    const raw = "---\nname: full\ndescription: Complete skill\ntriggers: foo, bar\nrunAs: subagent\n---\n\n# Body";
    const result = validateSkillFrontmatter(raw);
    assert.deepEqual(result, { ok: true });
  });
});
