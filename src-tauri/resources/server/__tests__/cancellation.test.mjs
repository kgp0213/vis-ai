import test from "node:test";
import assert from "node:assert/strict";

const shellUrl = new URL("../visionox-pkg/dist/cli/chunk-O52OLQL3.js", import.meta.url);
const hooksUrl = new URL("../visionox-pkg/dist/cli/chunk-7O5ALB4C.js", import.meta.url);
const { JobRegistry, runCommand } = await import(shellUrl.href);
const { runHooks } = await import(hooksUrl.href);

function nodeCommand(source) {
  const exe = `"${process.execPath.replaceAll('"', '\\"')}"`;
  const code = source.replaceAll('"', '\\"');
  return `${exe} -e "${code}"`;
}

test("waitForJob responds to AbortSignal without waiting for its timeout", async () => {
  const jobs = new JobRegistry();
  const started = await jobs.start(nodeCommand("setTimeout(()=>{},10000)"), {
    cwd: process.cwd(),
    waitSec: 0,
    lifecycle: "service",
  });
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 40);
  const before = Date.now();
  try {
    await assert.rejects(
      jobs.waitForJob(started.jobId, { timeoutMs: 10000, signal: controller.signal }),
      (err) => err?.name === "AbortError",
    );
    assert.ok(Date.now() - before < 1000);
  } finally {
    await jobs.stop(started.jobId, { graceMs: 0 });
  }
});

test("a task background job stops when its owner signal is aborted", async () => {
  const jobs = new JobRegistry();
  const controller = new AbortController();
  const started = await jobs.start(nodeCommand("setTimeout(()=>{},10000)"), {
    cwd: process.cwd(),
    waitSec: 0,
    signal: controller.signal,
    ownerId: "turn-1",
    lifecycle: "task",
  });
  controller.abort();
  const result = await jobs.waitForJob(started.jobId, { timeoutMs: 3000 });
  assert.equal(result.exited, true);
  assert.equal(jobs.list()[0].ownerId, "turn-1");
  assert.equal(jobs.list()[0].lifecycle, "task");
});

test("a runtime child error does not manufacture an exited job", async () => {
  const jobs = new JobRegistry();
  const started = await jobs.start(nodeCommand("setTimeout(()=>{},10000)"), {
    cwd: process.cwd(),
    waitSec: 0,
    lifecycle: "task",
  });
  try {
    const job = jobs.jobs.get(started.jobId);
    job.child.emit("error", new Error("simulated runtime process error"));
    const snapshot = jobs.list()[0];
    assert.equal(snapshot.running, true);
    assert.equal(snapshot.terminationPending, true);
    assert.match(snapshot.spawnError, /simulated runtime process error/);
    assert.doesNotThrow(() => process.kill(started.pid, 0));
  } finally {
    await jobs.stop(started.jobId, { graceMs: 0 });
  }
});

test("background job metadata omits buffered output", async () => {
  const jobs = new JobRegistry();
  const started = await jobs.start(nodeCommand("console.log('large-output')"), {
    cwd: process.cwd(),
    waitSec: 0,
    lifecycle: "task",
  });
  await jobs.waitForJob(started.jobId, { timeoutMs: 3000 });
  const metadata = jobs.listMetadata();
  assert.equal(metadata.length, 1);
  assert.equal(Object.hasOwn(metadata[0], "output"), false);
  assert.equal(jobs.read(started.jobId).output.includes("large-output"), true);
});

test("pre-aborted command chains do not spawn commands", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    runCommand(`${nodeCommand("process.exit(0)")} ; ${nodeCommand("process.exit(0)")}`, {
      cwd: process.cwd(),
      signal: controller.signal,
      timeoutSec: 5,
      maxOutputChars: 1000,
    }),
    (err) => err?.name === "AbortError",
  );
});

test("long command output keeps both the beginning and the diagnostic tail", async () => {
  const result = await runCommand(
    nodeCommand("process.stdout.write('HEAD-' + 'x'.repeat(5000) + '-TAIL')"),
    {
      cwd: process.cwd(),
      timeoutSec: 5,
      maxOutputChars: 500,
    },
  );

  assert.equal(result.exitCode, 0);
  assert.ok(result.output.startsWith("HEAD-"));
  assert.ok(result.output.endsWith("-TAIL"));
  assert.match(result.output, /showing beginning and end/);
  assert.ok(result.output.length <= 500);
});

test("long UTF-8 command output keeps readable beginning and tail", async () => {
  const result = await runCommand(
    nodeCommand("process.stdout.write('\\u5f00\\u5934-' + '\\u4e2d'.repeat(5000) + '-\\u7ed3\\u5c3e')"),
    {
      cwd: process.cwd(),
      timeoutSec: 5,
      maxOutputChars: 500,
    },
  );

  assert.equal(result.exitCode, 0);
  assert.ok(result.output.startsWith("开头-"));
  assert.ok(result.output.endsWith("-结尾"));
  assert.match(result.output, /showing beginning and end/);
  assert.doesNotMatch(result.output, /�/);
});

test("hooks stop promptly when their signal is aborted", async () => {
  const controller = new AbortController();
  const pending = runHooks({
    hooks: [{ event: "PreToolUse", match: "*", command: nodeCommand("setTimeout(()=>{},10000)"), timeout: 10000, scope: "test" }],
    payload: { event: "PreToolUse", cwd: process.cwd(), toolName: "read_file", toolArgs: {} },
    signal: controller.signal,
  });
  setTimeout(() => controller.abort(), 40);
  const before = Date.now();
  const result = await pending;
  assert.ok(Date.now() - before < 1000);
  assert.equal(result.outcomes.length, 0);
});
