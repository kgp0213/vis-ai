import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createComplexTaskArtifactStore } from "./complex-task-artifact-store.mjs";
import { createComplexTaskArtifactCommitter } from "./complex-task-artifact-committer.mjs";

const TASK_ID = "task:12345678-abcd-4abc-8abc-123456789012";

function task(outputPath) {
  return {
    id: TASK_ID,
    epoch: 3,
    contract: {
      taskId: TASK_ID,
      taskType: "generic.test",
      goal: "produce a durable result",
      workspace: outputPath,
      output: { format: "markdown", requestedPath: outputPath, conflictPolicy: "ask" },
      completion: { requiredCoverage: ["step-1"], requiredArtifacts: ["final-result"] },
      pinned: {
        adapterVersion: "generic-v1",
        skillHash: "sha256:skill",
        toolSchemaVersion: "1",
        initialModelConfigFingerprints: ["model-config-1"],
      },
    },
  };
}

function assembled(content = "# Result\n") {
  return {
    ok: true,
    status: "complete",
    content,
    report: { complete: true, required: ["step-1"], covered: ["step-1"], missing: [], conflicts: [], invalid: [] },
    selectedArtifacts: [],
  };
}

test("commits a final immutable artifact before atomically writing the requested output", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-task-committer-"));
  try {
    const outputPath = join(root, "result.md");
    const artifactStore = createComplexTaskArtifactStore(join(root, "artifacts"));
    const events = [];
    const committer = createComplexTaskArtifactCommitter({
      artifactStore,
      reserveOutput: async ({ taskId, requestedPath }) => {
        events.push(["reserve", taskId, requestedPath]);
        return { ok: true, reservationId: "reservation-1", outputPath: requestedPath };
      },
      writeOutput: async ({ outputPath: path, content }) => {
        events.push(["write", path]);
        await writeFile(path, content, "utf8");
      },
      releaseOutput: async ({ reservationId, committed }) => events.push(["release", reservationId, committed]),
    });

    const result = await committer.commit({ task: task(outputPath), assembled: assembled("# Complete\n") });

    assert.equal(result.ok, true);
    assert.equal(result.outputPath, outputPath);
    assert.equal(result.finalArtifact.manifest.producer.modelConfigFingerprint, "model-config-1");
    assert.deepEqual(result.finalArtifact.manifest.primaryCoverage, ["step-1"]);
    assert.equal(await readFile(outputPath, "utf8"), "# Complete\n");
    assert.deepEqual(events.map((event) => event[0]), ["reserve", "write", "release"]);
    assert.equal(events.at(-1)[2], true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("turns output reservation and late write conflicts into a durable user-input request", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-task-conflict-"));
  try {
    const outputPath = join(root, "occupied.md");
    const artifactStore = createComplexTaskArtifactStore(join(root, "artifacts"));
    let writes = 0;
    const choice = { id: "new-file", label: "使用新文件名" };
    const reserveConflict = createComplexTaskArtifactCommitter({
      artifactStore,
      reserveOutput: async () => ({
        ok: false,
        requiresUserChoice: true,
        code: "output-path-conflict",
        error: "output exists",
        decision: { id: "output-path-conflict", question: "选择新的输出路径", choices: [choice] },
      }),
      writeOutput: async () => { writes += 1; },
    });
    const reserved = await reserveConflict.commit({ task: task(outputPath), assembled: assembled() });
    assert.equal(reserved.waitingUser, true);
    assert.equal(reserved.userInputRequest.reason, "output-path-conflict");
    assert.deepEqual(reserved.userInputRequest.choices, [choice]);
    assert.equal(writes, 0);

    const lateConflict = createComplexTaskArtifactCommitter({
      artifactStore,
      reserveOutput: async () => ({ ok: true, reservationId: "reservation-2", outputPath }),
      writeOutput: async () => {
        const error = new Error("file appeared after reservation");
        error.code = "DOCUMENT_OUTPUT_CONFLICT";
        throw error;
      },
    });
    const late = await lateConflict.commit({ task: task(outputPath), assembled: assembled() });
    assert.equal(late.waitingUser, true);
    assert.match(late.userInputRequest.question, /输出路径/);
    assert.equal(late.finalArtifact.manifest.sha256.length, 64);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("does not create a final artifact when deterministic assembly is incomplete", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-task-partial-"));
  try {
    const artifactStore = createComplexTaskArtifactStore(join(root, "artifacts"));
    const committer = createComplexTaskArtifactCommitter({ artifactStore });
    const result = await committer.commit({
      task: task(join(root, "result.md")),
      assembled: { ...assembled("partial"), ok: false, status: "partial", report: { complete: false, missing: ["step-1"] } },
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, "partial");
    assert.equal((await artifactStore.list()).length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("does not write output when the final immutable artifact revision conflicts", async () => {
  const root = await mkdtemp(join(tmpdir(), "visionox-task-artifact-conflict-"));
  try {
    const outputPath = join(root, "result.md");
    const artifactStore = createComplexTaskArtifactStore(join(root, "artifacts"));
    const committer = createComplexTaskArtifactCommitter({
      artifactStore,
      writeOutput: async ({ content }) => writeFile(outputPath, content),
    });
    const first = await committer.commit({ task: task(outputPath), assembled: assembled("FIRST") });
    assert.equal(first.ok, true);
    const conflict = await committer.commit({ task: task(outputPath), assembled: assembled("SECOND") });
    assert.equal(conflict.ok, false);
    assert.equal(conflict.status, "blocked");
    assert.equal(conflict.reason, "final-artifact-conflict");
    assert.equal(await readFile(outputPath, "utf8"), "FIRST");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
