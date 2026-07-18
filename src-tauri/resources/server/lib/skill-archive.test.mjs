import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extractSkillArchive,
  SKILL_ARCHIVE_DESTINATION_ENV,
  SKILL_ARCHIVE_SOURCE_ENV,
} from "./skill-archive.mjs";

test("Windows Skill extraction passes paths through environment variables", () => {
  let invocation = null;
  const result = extractSkillArchive(
    "C:\\Users\\Test User\\技能包.skill",
    "C:\\Users\\Test User\\目标目录",
    {
      platform: "win32",
      env: { KEEP_ME: "yes" },
      spawnSync(command, args, options) {
        invocation = { command, args, options };
        return { status: 0, signal: null, stdout: "", stderr: "" };
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(invocation.command, "powershell.exe");
  assert.deepEqual(invocation.args.slice(0, 4), ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command"]);
  assert.match(invocation.args[4], new RegExp(`\\$env:${SKILL_ARCHIVE_SOURCE_ENV}`));
  assert.match(invocation.args[4], new RegExp(`\\$env:${SKILL_ARCHIVE_DESTINATION_ENV}`));
  assert.doesNotMatch(invocation.args[4], /\$args\[/);
  assert.equal(invocation.options.env[SKILL_ARCHIVE_SOURCE_ENV], "C:\\Users\\Test User\\技能包.skill");
  assert.equal(invocation.options.env[SKILL_ARCHIVE_DESTINATION_ENV], "C:\\Users\\Test User\\目标目录");
  assert.equal(invocation.options.env.KEEP_ME, "yes");
});

test("Skill extraction reports missing paths and child failures", () => {
  assert.match(extractSkillArchive("", "target").error, /paths are required/);
  const failed = extractSkillArchive("source.zip", "target", {
    platform: "win32",
    spawnSync() {
      return { status: 17, signal: null, stdout: "", stderr: "blocked by endpoint security" };
    },
  });
  assert.match(failed.error, /blocked by endpoint security/);
});
