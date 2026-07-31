import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { createKnowledgeDocumentCatalog } from "./knowledge-document-catalog.mjs";

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const workspace = mkdtempSync(join(tmpdir(), "visionox-knowledge-catalog-"));
  roots.push(workspace);
  let id = 0;
  const knowledgeRuntime = {
    paths(root) {
      const knowledgeRoot = resolve(root, "knowledge");
      return { projectRoot: resolve(root), root: knowledgeRoot };
    },
  };
  const catalog = createKnowledgeDocumentCatalog({
    knowledgeRuntime,
    createId: () => `document-${++id}`,
    now: () => new Date("2026-07-29T00:00:00.000Z"),
  });
  return { workspace, catalog };
}

describe("knowledge document catalog recovery", () => {
  test("migrates legacy markdown and links one exact raw source without moving files", () => {
    const { workspace, catalog } = fixture();
    const uploads = join(workspace, "knowledge", "uploads");
    mkdirSync(join(uploads, "_raw"), { recursive: true });
    writeFileSync(join(uploads, "legacy.md"), "legacy text", "utf8");
    writeFileSync(join(uploads, "_raw", "legacy.txt"), "legacy text", "utf8");
    const state = catalog.read(workspace);
    assert.equal(state.documents.length, 1);
    assert.equal(state.documents[0].documentId, "document-1");
    assert.equal(state.documents[0].rawPath, "knowledge/uploads/_raw/legacy.txt");
    assert.equal(state.contentRevision, 1);
    assert.ok(existsSync(join(uploads, ".documents.json")));
  });

  test("discovers markdown added after the catalog was initialized", () => {
    const { workspace, catalog } = fixture();
    catalog.read(workspace);
    const target = join(workspace, "knowledge", "uploads", "added.md");
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, "added later", "utf8");
    const state = catalog.read(workspace);
    assert.equal(state.documents.length, 1);
    assert.equal(state.documents[0].displayName, "added.md");
    assert.equal(state.contentRevision, 1);
  });

  test("turns an externally removed managed document into a tombstone", () => {
    const { workspace, catalog } = fixture();
    const target = join(workspace, "knowledge", "uploads", "removed.md");
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, "remove me", "utf8");
    const initial = catalog.read(workspace);
    unlinkSync(target);
    const state = catalog.read(workspace);
    assert.equal(state.documents.length, 0);
    assert.equal(state.tombstones.length, 1);
    assert.equal(state.tombstones[0].documentId, initial.documents[0].documentId);
    assert.ok(state.contentRevision > initial.contentRevision);
  });

  test("backs up a corrupt catalog and rebuilds from disk", () => {
    const { workspace, catalog } = fixture();
    const uploads = join(workspace, "knowledge", "uploads");
    mkdirSync(uploads, { recursive: true });
    writeFileSync(join(uploads, "recover.md"), "recover", "utf8");
    writeFileSync(join(uploads, ".documents.json"), "{ broken", "utf8");
    const state = catalog.read(workspace);
    assert.equal(state.documents[0].displayName, "recover.md");
    assert.ok(state.warnings.some((item) => item.includes("rebuilt after corruption")));
    assert.ok(readdirSync(uploads).some((name) => name.startsWith(".documents.json.corrupt-")));
  });

  test("backs up a structurally valid catalog containing escaped managed paths", () => {
    const { workspace, catalog } = fixture();
    const uploads = join(workspace, "knowledge", "uploads");
    mkdirSync(uploads, { recursive: true });
    writeFileSync(join(uploads, "recover.md"), "recover", "utf8");
    const state = catalog.read(workspace);
    catalog.write(workspace, {
      ...state,
      documents: [{ ...state.documents[0], markdownPath: "../outside.md" }],
    });
    const recovered = catalog.read(workspace);
    assert.equal(recovered.documents.length, 1);
    assert.equal(recovered.documents[0].markdownPath, "knowledge/uploads/recover.md");
    assert.ok(recovered.warnings.some((item) => item.includes("rebuilt after corruption")));
    assert.ok(readdirSync(uploads).some((name) => name.startsWith(".documents.json.corrupt-")));
  });

  test("marks a persisted active job interrupted without scheduling a rebuild", () => {
    const { workspace, catalog } = fixture();
    const state = catalog.read(workspace);
    catalog.write(workspace, {
      ...state,
      activeJob: {
        jobId: "job-1",
        workspaceFingerprint: state.workspaceFingerprint,
        requestedRevision: 1,
        status: "running",
        startedAt: "2026-07-28T23:59:00.000Z",
      },
    });
    const recovered = catalog.recoverInterrupted(workspace);
    assert.equal(recovered.activeJob, null);
    assert.equal(recovered.lastJob.status, "interrupted");
  });

  test("refuses to recover through a raw directory junction outside the workspace", () => {
    const { workspace, catalog } = fixture();
    const uploads = join(workspace, "knowledge", "uploads");
    const outside = mkdtempSync(join(tmpdir(), "visionox-knowledge-catalog-outside-"));
    roots.push(outside);
    mkdirSync(uploads, { recursive: true });
    writeFileSync(join(uploads, "safe.md"), "safe", "utf8");
    symlinkSync(outside, join(uploads, "_raw"), process.platform === "win32" ? "junction" : "dir");
    assert.throws(() => catalog.read(workspace), /resolves outside the bound workspace/);
  });
});
