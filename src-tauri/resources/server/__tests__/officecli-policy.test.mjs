import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { validateOfficecliInvocation } from "../lib/officecli-policy.mjs";

describe("OfficeCLI command policy", () => {
  test("拒绝会等待 stdin 的空 batch", () => {
    const issue = validateOfficecliInvocation("officecli", { command: "batch C:\\tmp\\deck.pptx" });
    assert.equal(issue?.code, "officecli-batch-input-required");
  });

  test("拒绝在普通调用中用换行拼接多条命令", () => {
    const issue = validateOfficecliInvocation("officecli", {
      command: "add deck.pptx / --type slide\n\nadd deck.pptx /slide[1] --type shape",
    });
    assert.equal(issue?.code, "officecli-multiple-commands");
  });

  test("接受带 JSON 命令的 batch 和普通单条命令", () => {
    assert.equal(validateOfficecliInvocation("officecli", {
      command: "batch deck.pptx --commands '[{\"command\":\"add\"}]' --json",
    }), null);
    assert.equal(validateOfficecliInvocation("officecli", {
      command: "add deck.pptx / --type slide",
    }), null);
  });
});
