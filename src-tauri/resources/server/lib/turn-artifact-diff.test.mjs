import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import {
  createTurnDirectoryScan,
  diffDirectoryEntries,
  directoryCandidatesFromCommand,
  directoryCandidatesFromToolEvent,
  snapshotDirectoryEntries,
} from "./turn-artifact-diff.mjs";

function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "turn-artifact-diff-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function changedNames(changed) {
  return changed.map((entry) => basename(entry.path)).sort();
}

test("regression: run_command deliverables in an args-referenced directory are discovered without path hints", () => {
  withTempDir((root) => {
    const target = join(root, "mipi");
    mkdirSync(target);
    writeFileSync(join(target, "keep.md"), "old content");
    const script = join(root, "batch_convert_pdfs.py");
    writeFileSync(script, "print('convert')");

    const scan = createTurnDirectoryScan({ workspaceDir: root });
    // Mirrors the observed session: the command string references the script
    // and the target directory, but none of the produced .md paths.
    scan.noteToolEvent({
      toolName: "run_command",
      args: JSON.stringify({ command: `python "${script}" "${target}"` }),
    });
    // The command output only mentions bare file names, useless for paths.
    scan.noteToolEvent({
      toolName: "run_command",
      args: JSON.stringify({ command: `python "${script}" "${target}"` }),
      result: "✓ Saved: a.md\n✓ Saved: b.md\n[exit 0]",
    });

    writeFileSync(join(target, "a.md"), "# A");
    writeFileSync(join(target, "b.md"), "# B");
    mkdirSync(join(target, "sub"));
    writeFileSync(join(target, "sub", "c.md"), "# C");

    const { changed } = scan.scanChanged();
    assert.deepEqual(changedNames(changed), ["a.md", "b.md", "c.md"]);
  });
});

test("untouched directories and out-of-depth files are not collected", () => {
  withTempDir((root) => {
    const tracked = join(root, "tracked");
    const other = join(root, "other");
    mkdirSync(tracked);
    mkdirSync(other);
    const scan = createTurnDirectoryScan({ workspaceDir: root });
    scan.noteDirectory(tracked);

    writeFileSync(join(other, "stray.md"), "not part of the turn");
    const deep = join(tracked, "d1", "d2", "d3");
    mkdirSync(deep, { recursive: true });
    writeFileSync(join(deep, "deep.md"), "beyond max depth");
    writeFileSync(join(tracked, "d1", "shallow.md"), "within depth");

    const { changed } = scan.scanChanged();
    assert.deepEqual(changedNames(changed), ["shallow.md"]);
  });
});

test("directory count bound skips extra directories with a diagnostic", () => {
  withTempDir((root) => {
    const dirs = ["d1", "d2", "d3"].map((name) => join(root, name));
    for (const dir of dirs) mkdirSync(dir);
    const scan = createTurnDirectoryScan({ workspaceDir: root, limits: { maxDirectories: 2 } });
    assert.equal(scan.noteDirectory(dirs[0]), true);
    assert.equal(scan.noteDirectory(dirs[1]), true);
    assert.equal(scan.noteDirectory(dirs[2]), false);
    writeFileSync(join(dirs[2], "missed.md"), "x");
    const { changed } = scan.scanChanged();
    assert.deepEqual(changed, []);
    const diagnostics = scan.drainDiagnostics();
    assert.equal(diagnostics.some((entry) => entry.kind === "directory-limit" && entry.dir === dirs[2]), true);
    assert.deepEqual(scan.drainDiagnostics(), []);
  });
});

test("entry count bound skips the whole directory with a diagnostic", () => {
  withTempDir((root) => {
    const crowded = join(root, "crowded");
    mkdirSync(crowded);
    writeFileSync(join(crowded, "a.md"), "1");
    writeFileSync(join(crowded, "b.md"), "2");
    writeFileSync(join(crowded, "c.md"), "3");
    const scan = createTurnDirectoryScan({ workspaceDir: root, limits: { maxEntriesPerDirectory: 2 } });
    assert.equal(scan.noteDirectory(crowded), false);
    assert.equal(scan.trackedDirectories().length, 0);
    const diagnostics = scan.drainDiagnostics();
    assert.equal(diagnostics.some((entry) => entry.kind === "entry-limit" && entry.dir === crowded), true);
  });
});

test("snapshot and diff only report new or changed non-temporary files", () => {
  withTempDir((root) => {
    writeFileSync(join(root, "same.md"), "stable");
    writeFileSync(join(root, "grown.md"), "short");
    const baseline = snapshotDirectoryEntries(root);
    writeFileSync(join(root, "grown.md"), "much longer content");
    writeFileSync(join(root, "new.md"), "new");
    writeFileSync(join(root, "scratch.tmp"), "temp");
    writeFileSync(join(root, "empty.md"), "");
    mkdirSync(join(root, "node_modules"));
    writeFileSync(join(root, "node_modules", "dep.md"), "vendored");

    const current = snapshotDirectoryEntries(root);
    const changed = diffDirectoryEntries(baseline.entries, current.entries);
    assert.deepEqual(changedNames(changed), ["grown.md", "new.md"]);
  });
});

test("directory candidates come from tool args, command strings, and document results", () => {
  withTempDir((root) => {
    const target = join(root, "mipi");
    mkdirSync(target);
    const script = join(root, "convert.py");
    writeFileSync(script, "print()");

    assert.deepEqual(
      directoryCandidatesFromCommand(`python "${script}" "${target}"`, { workspaceDir: root }),
      [root, target],
    );
    assert.deepEqual(directoryCandidatesFromCommand("echo hello", { workspaceDir: root }), []);
    assert.deepEqual(directoryCandidatesFromCommand("curl https://example.com/x.md", { workspaceDir: root }), []);

    assert.deepEqual(
      directoryCandidatesFromToolEvent({ toolName: "read_file", args: { path: join(target, "a.md") } }, { workspaceDir: root }),
      [target],
    );
    assert.deepEqual(
      directoryCandidatesFromToolEvent({ toolName: "list_directory", args: { path: target } }, { workspaceDir: root }),
      [target],
    );
    assert.deepEqual(
      directoryCandidatesFromToolEvent(
        { toolName: "prepare_local_document", args: {}, result: JSON.stringify({ ok: true, readableDirectory: target }) },
        { workspaceDir: root },
      ),
      [target],
    );
  });
});

test("a directory noted at tool_start diffs against its pre-execution state", () => {
  withTempDir((root) => {
    const target = join(root, "out");
    mkdirSync(target);
    writeFileSync(join(target, "before.md"), "old");
    const scan = createTurnDirectoryScan({ workspaceDir: root });
    // Baseline is captured when the tool starts, before it writes anything.
    scan.noteToolEvent({ toolName: "run_command", args: { command: `python convert.py "${target}"` } });
    writeFileSync(join(target, "during.md"), "created by the tool");
    const { changed } = scan.scanChanged();
    assert.deepEqual(changedNames(changed), ["during.md"]);
    // Re-scanning is stable: no phantom changes once nothing moved.
    assert.deepEqual(scan.scanChanged().changed.map((entry) => basename(entry.path)), ["during.md"]);
  });
});

test("launcher wires the turn directory diff into artifact tracking before completion checks", () => {
  const launcher = readFileSync(new URL("../launcher.mjs", import.meta.url), "utf8");
  assert.match(launcher, /createTurnDirectoryScan/);
  assert.match(launcher, /turnDirectoryScan\.noteToolEvent/);
  assert.match(launcher, /turnDirectoryScan\.scanChanged\(\)/);
  assert.match(launcher, /producer: "filesystem-scan"/);
  assert.match(launcher, /reason: "turn-touched directory diff"/);
  assert.match(launcher, /turnReadFilePaths/);
  assert.match(launcher, /turnObservedArtifactPaths/);
  assert.doesNotMatch(launcher, /turnDirectoryScan\.noteDirectory\(workspaceDir\);/);
  // Scanned paths already known to the turn must not be registered twice.
  assert.match(launcher, /turnArtifactPaths\.has\(key\)\s*\|\|\s*turnObservedArtifactPaths\.has\(key\)\)\s*continue;/);
  // The scan registration must run before the artifact-retry / incomplete
  // decision that keys off turnArtifactPaths.size.
  const scanIndex = launcher.indexOf('reason: "turn-touched directory diff"');
  const retryIndex = launcher.indexOf("artifactContinuationAttempts < MAX_ARTIFACT_AUTO_CONTINUATIONS");
  assert.ok(scanIndex > 0 && retryIndex > 0 && scanIndex < retryIndex, "directory diff must be registered before the artifact completion decision");
});
