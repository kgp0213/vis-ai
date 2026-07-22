import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

const launcher = await readFile(new URL("../launcher.mjs", import.meta.url), "utf8");
const activeLibFiles = await readdir(new URL("../lib/", import.meta.url));

test("all user prompts enter the ordinary CacheFirstLoop without foreground task supervision", () => {
  assert.match(launcher, /new CacheFirstLoop\(/);
  assert.match(launcher, /for await \(const ev of loop\.step\(loopInput\)\)/);
  assert.doesNotMatch(launcher, /foreground-task-supervisor/);
  assert.doesNotMatch(launcher, /activeForegroundTask/);
  assert.doesNotMatch(launcher, /assessTaskComplexity/);
  assert.doesNotMatch(launcher, /createComplexTaskRuntimeService/);
  assert.doesNotMatch(launcher, /createComplexTaskConversationDelivery/);
  assert.doesNotMatch(launcher, /documentMarkdownManager|documentHandoffCoordinator/);
  assert.deepEqual(activeLibFiles.filter((name) => /^complex-task-.*\.mjs$/i.test(name)), []);
});
