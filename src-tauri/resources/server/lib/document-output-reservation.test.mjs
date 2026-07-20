import test from "node:test";
import assert from "node:assert/strict";

import {
  LIVE_DOCUMENT_JOB_STATUSES,
  TERMINAL_DOCUMENT_JOB_STATUSES,
  canonicalDocumentOutputPath,
  collectLiveDocumentOutputPaths,
  createDocumentOutputReservation,
} from "./document-output-reservation.mjs";

test("canonicalDocumentOutputPath resolves relative paths from the workspace", () => {
  assert.equal(
    canonicalDocumentOutputPath("reports/result.md", "C:/visionox-workspace"),
    canonicalDocumentOutputPath("C:/visionox-workspace/reports/result.md", "C:/other-workspace"),
  );
});

test("collectLiveDocumentOutputPaths includes only active jobs and uses each job workspace", () => {
  const paths = collectLiveDocumentOutputPaths([
    { id: "queued", status: "queued", outputPath: "reports/result.md", workspaceRoot: "C:/workspace-a" },
    { id: "running", status: "running", outputPath: "C:/workspace-b/result.md", workspaceRoot: "C:/workspace-a" },
    { id: "draft", status: "awaiting_output", outputPath: "reports/draft.md", workspaceRoot: "C:/workspace-a" },
    { id: "done", status: "completed", outputPath: "reports/result.md", workspaceRoot: "C:/workspace-a" },
  ]);

  assert.deepEqual([...paths], [
    canonicalDocumentOutputPath("reports/result.md", "C:/workspace-a"),
    canonicalDocumentOutputPath("C:/workspace-b/result.md", "C:/workspace-a"),
    canonicalDocumentOutputPath("reports/draft.md", "C:/workspace-a"),
  ]);
  assert.ok(LIVE_DOCUMENT_JOB_STATUSES.has("waiting_provider"));
  assert.ok(TERMINAL_DOCUMENT_JOB_STATUSES.has("completed_with_warnings"));
  assert.ok(!LIVE_DOCUMENT_JOB_STATUSES.has("completed"));
});

test("concurrent default reservations receive different paths before jobs are persisted", async () => {
  const manager = createDocumentOutputReservation({
    workspaceRoot: "C:/workspace",
    pathExists: () => false,
    listJobs: async () => [],
  });

  const [first, second] = await Promise.all([
    manager.reserve({ sourceTitle: "manual" }),
    manager.reserve({ sourceTitle: "manual" }),
  ]);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.notEqual(first.outputPath, second.outputPath);
  assert.equal(second.outputPath, canonicalDocumentOutputPath("manual-整理 (2).md", "C:/workspace"));
});

test("concurrent reservations for the same semantic task share one path lease", async () => {
  const manager = createDocumentOutputReservation({
    workspaceRoot: "C:/workspace",
    pathExists: () => false,
    listJobs: async () => [],
  });

  const [first, second] = await Promise.all([
    manager.reserve({ sourceTitle: "manual", taskFingerprint: "same-task", coalesceSemanticTask: true }),
    manager.reserve({ sourceTitle: "manual", taskFingerprint: "same-task", coalesceSemanticTask: true }),
  ]);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.outputPath, first.outputPath);
  assert.equal(second.reservationId, first.reservationId);
  assert.equal(manager.release(second.reservationId).released, false, "one caller must not release the shared lease");
  assert.equal(manager.reservedPaths().size, 1);
  assert.equal(manager.release(first.reservationId).released, true);
  assert.equal(manager.reservedPaths().size, 0);
});

test("concurrent explicit reservations for the same semantic task do not report a local conflict", async () => {
  const manager = createDocumentOutputReservation({
    workspaceRoot: "C:/workspace",
    pathExists: () => false,
    listJobs: async () => [],
  });

  const first = await manager.reserve({
    outputPath: "manual.md",
    taskFingerprint: "same-task",
    coalesceSemanticTask: true,
  });
  const second = await manager.reserve({
    outputPath: "manual.md",
    taskFingerprint: "same-task",
    coalesceSemanticTask: true,
  });

  assert.equal(second.ok, true);
  assert.equal(second.reservationId, first.reservationId);
});

test("default naming skips files, live jobs, and paths already reserved locally", async () => {
  const disk = new Set([canonicalDocumentOutputPath("manual-整理.md", "C:/workspace")]);
  const manager = createDocumentOutputReservation({
    workspaceRoot: "C:/workspace",
    pathExists: (path) => disk.has(path),
    listJobs: async () => [{ id: "live-2", status: "running", outputPath: "manual-整理 (2).md", workspaceRoot: "C:/workspace" }],
  });

  const first = await manager.reserve({ sourceTitle: "manual" });
  assert.equal(first.outputPath, canonicalDocumentOutputPath("manual-整理 (3).md", "C:/workspace"));

  const second = await manager.reserve({ sourceTitle: "manual" });
  assert.equal(second.outputPath, canonicalDocumentOutputPath("manual-整理 (4).md", "C:/workspace"));
});

test("explicit path conflicts return a structured user-choice result before reservation", async () => {
  const outputPath = canonicalDocumentOutputPath("manual-整理.md", "C:/workspace");
  const manager = createDocumentOutputReservation({
    workspaceRoot: "C:/workspace",
    pathExists: (path) => path === outputPath,
    listJobs: async () => [{ id: "live-1", status: "running", outputPath: "other.md", workspaceRoot: "C:/workspace" }],
  });

  const result = await manager.reserve({ outputPath });
  assert.equal(result.ok, false);
  assert.equal(result.requiresUserChoice, true);
  assert.equal(result.code, "output-path-conflict");
  assert.equal(result.outputPath, outputPath);
  assert.ok(result.conflicts.some((entry) => entry.kind === "disk"));
  assert.ok(Array.isArray(result.decision?.choices));
  assert.equal(manager.reservedPaths().size, 0);
});

test("an explicit existing path may pass through only for a matching semantic task", async () => {
  const outputPath = canonicalDocumentOutputPath("manual-整理.md", "C:/workspace");
  const manager = createDocumentOutputReservation({
    workspaceRoot: "C:/workspace",
    pathExists: (path) => path === outputPath,
    listJobs: async () => [{
      id: "completed-1",
      status: "completed",
      taskFingerprint: "same-task",
      outputPath,
      workspaceRoot: "C:/workspace",
    }],
  });

  const result = await manager.reserve({
    outputPath,
    taskFingerprint: "same-task",
    allowExistingOutputForDuplicate: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.outputPath, outputPath);
  manager.release(result.reservationId);
});

test("an existing path is still rejected when the semantic task does not match", async () => {
  const outputPath = canonicalDocumentOutputPath("manual-整理.md", "C:/workspace");
  const manager = createDocumentOutputReservation({
    workspaceRoot: "C:/workspace",
    pathExists: (path) => path === outputPath,
    listJobs: async () => [{
      id: "completed-1",
      status: "completed",
      taskFingerprint: "different-task",
      outputPath,
      workspaceRoot: "C:/workspace",
    }],
  });

  const result = await manager.reserve({
    outputPath,
    taskFingerprint: "same-task",
    allowExistingOutputForDuplicate: true,
  });

  assert.equal(result.ok, false);
  assert.ok(result.conflicts.some((entry) => entry.kind === "disk"));
});

test("explicit path conflicts with a live job even when the file is not on disk", async () => {
  const manager = createDocumentOutputReservation({
    workspaceRoot: "C:/workspace",
    pathExists: () => false,
    listJobs: async () => [{ id: "live-1", status: "waiting_foreground", outputPath: "manual.md", workspaceRoot: "C:/workspace" }],
  });

  const result = await manager.reserve({ outputPath: "manual.md" });
  assert.equal(result.requiresUserChoice, true);
  assert.ok(result.conflicts.some((entry) => entry.kind === "live-job" && entry.jobId === "live-1"));
});

test("terminal release removes a reservation while disk existence remains authoritative", async () => {
  let fileExists = false;
  const manager = createDocumentOutputReservation({
    workspaceRoot: "C:/workspace",
    pathExists: (path) => fileExists && path.endsWith("manual.md"),
    listJobs: async () => [],
  });

  const reservation = await manager.reserve({ outputPath: "manual.md", reservationId: "job-1" });
  assert.equal(reservation.ok, true);
  await manager.releaseTerminal({ id: "job-1", status: "completed" });
  assert.equal(manager.reservedPaths().size, 0);

  fileExists = true;
  const conflict = await manager.reserve({ outputPath: "manual.md", reservationId: "job-2" });
  assert.equal(conflict.requiresUserChoice, true);
  assert.ok(!TERMINAL_DOCUMENT_JOB_STATUSES.has("failed"));
});

test("a reservation can bind to its persisted job and release by that job id", async () => {
  const manager = createDocumentOutputReservation({
    workspaceRoot: "C:/workspace",
    pathExists: () => false,
    listJobs: async () => ({ jobs: [{ id: "live-job", status: "running", outputPath: "live.md" }] }),
  });

  const reserved = await manager.reserve({ sourceTitle: "report", reservationId: "request-1" });
  assert.equal(manager.isReserved(reserved.outputPath), true);
  assert.equal(manager.getReservation("request-1")?.outputPath, reserved.outputPath);
  assert.equal(manager.bind("request-1", "document-job-1").jobId, "document-job-1");
  const resumed = await manager.reserve({ outputPath: reserved.outputPath, reservationId: "document-job-1" });
  assert.equal(resumed.ok, true);
  assert.equal(resumed.reservationId, "request-1");
  assert.equal(manager.reservedPaths().size, 1);
  assert.deepEqual([...await manager.liveOutputPaths()], [canonicalDocumentOutputPath("live.md", "C:/workspace")]);
  assert.deepEqual(manager.releaseTerminal("document-job-1", "running"), {
    ok: true,
    released: false,
    reason: "not-terminal",
    status: "running",
  });
  assert.equal(manager.release("document-job-1").released, true);
  assert.equal(manager.getReservation("request-1"), null);
  assert.equal(manager.bind("missing", "job").ok, false);
  assert.equal(manager.release("missing").released, false);

  const fallback = await manager.reserve({ outputPath: "fallback.md", reservationId: "request-2" });
  assert.equal(manager.releaseTerminal({ id: "unbound-job", reservationId: "request-2", status: "failed" }).released, false);
  assert.equal(manager.releaseTerminal({ id: "unbound-job", reservationId: "request-2", status: "abandoned" }).released, true);
  assert.equal(manager.getReservation(fallback.reservationId), null);
});

test("an explicit overwrite confirmation bypasses only a disk conflict", async () => {
  const manager = createDocumentOutputReservation({
    workspaceRoot: "C:/workspace",
    pathExists: () => true,
    listJobs: async () => [],
  });

  const first = await manager.reserve({ outputPath: "existing.md", reservationId: "first", allowOverwrite: true });
  assert.equal(first.ok, true);
  const localConflict = await manager.reserve({ outputPath: "existing.md", reservationId: "second", allowOverwrite: true });
  assert.equal(localConflict.requiresUserChoice, true);
  assert.equal(localConflict.conflicts[0].kind, "reservation");
});

test("one owner cannot silently move its reservation to another explicit path", async () => {
  const manager = createDocumentOutputReservation({
    workspaceRoot: "C:/workspace",
    pathExists: () => false,
    listJobs: async () => [],
  });

  const first = await manager.reserve({ outputPath: "first.md", reservationId: "same-owner" });
  const repeated = await manager.reserve({ reservationId: "same-owner" });
  assert.equal(repeated.outputPath, first.outputPath);
  const moved = await manager.reserve({ outputPath: "second.md", reservationId: "same-owner" });
  assert.equal(moved.requiresUserChoice, true);
  assert.equal(moved.conflicts[0].path, first.outputPath);
});

test("default naming sanitizes the title and reports finite candidate exhaustion", async () => {
  const custom = createDocumentOutputReservation({
    workspaceRoot: "C:/workspace",
    defaultExtension: "markdown",
    pathExists: () => false,
    listJobs: () => [],
  });
  const reserved = await custom.reserve({ sourceTitle: "folder\\unsafe:name. " });
  assert.equal(reserved.outputPath, canonicalDocumentOutputPath("unsafe-name-整理.markdown", "C:/workspace"));

  const exhausted = createDocumentOutputReservation({
    workspaceRoot: "C:/workspace",
    maxCandidates: 1,
    pathExists: () => true,
    listJobs: () => [],
  });
  await assert.rejects(() => exhausted.reserve({ sourceTitle: "manual" }), /after 1 candidates/);
});
