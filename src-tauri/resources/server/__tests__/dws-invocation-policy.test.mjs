import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { validateDwsInvocation } from "../lib/dws-invocation-policy.mjs";

const bundledExecutable = "C:\\Program Files\\Visionox-Whale\\resources\\server\\dws.exe";

describe("DWS shell invocation policy", () => {
  test("rejects a DWS executable outside the packaged resource tree", () => {
    const issue = validateDwsInvocation("run_command", {
      command: '"D:\\V-ABC\\V-ABC\\DWS-OpenEdition-Portable\\dws.exe" chat message list --group test --limit 100',
    }, { bundledExecutable });
    assert.equal(issue?.code, "dws-external-executable");
    assert.match(issue?.suggestion ?? "", /dws_read/);
  });

  test("rejects direct shell reads even through the bundled executable", () => {
    const issue = validateDwsInvocation("run_command", {
      command: `"${bundledExecutable}" chat message list --group test --limit 100`,
    }, { bundledExecutable });
    assert.equal(issue?.code, "dws-read-use-tool");
    assert.equal(validateDwsInvocation("run_command", {
      command: "dws chat message search --query test --start 2026-07-13T00:00:00+08:00 --end 2026-07-14T00:00:00+08:00 --limit 100",
    }, { bundledExecutable })?.code, "dws-read-use-tool");
  });

  test("routes help, supported writes, and unknown future commands away from shell", () => {
    assert.equal(validateDwsInvocation("run_command", { command: `"${bundledExecutable}" chat --help` }, { bundledExecutable })?.code, "dws-help-use-tool");
    assert.equal(validateDwsInvocation("run_command", { command: "dws chat message send --group test --text hello" }, { bundledExecutable })?.code, "dws-write-use-tool");
    assert.equal(validateDwsInvocation("run_command", { command: "dws future-product record create --name test" }, { bundledExecutable })?.code, "dws-exec-use-tool");
    assert.equal(validateDwsInvocation("run_command", { command: "git status --short" }, { bundledExecutable }), null);
    assert.equal(validateDwsInvocation("read_file", { path: "dws.exe" }, { bundledExecutable }), null);
  });
});
