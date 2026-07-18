import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  copySkillDirectoryControlled,
  runIsolatedSkillDirectoryCopy,
} from "./skill-directory-copy.mjs";

function withTempRoot(prefix, fn) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  try {
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function makeSkill(root) {
  const source = join(root, "source-skill");
  mkdirSync(join(source, "scripts"), { recursive: true });
  writeFileSync(join(source, "SKILL.md"), "---\nname: source-skill\ndescription: test\n---\n\n# Test\n", "utf8");
  writeFileSync(join(source, "scripts", "run.mjs"), "console.log('ok');\n", "utf8");
  return source;
}

test("controlled Skill copy installs regular files without fs.cp recursion", () => {
  withTempRoot("skill-copy-", (root) => {
    const source = makeSkill(root);
    const target = join(root, "target", "source-skill");
    const result = copySkillDirectoryControlled(source, target);
    assert.deepEqual(result, {
      ok: true,
      files: 2,
      bytes: Buffer.byteLength(readFileSync(join(source, "SKILL.md"))) + Buffer.byteLength(readFileSync(join(source, "scripts", "run.mjs"))),
    });
    assert.match(readFileSync(join(target, "SKILL.md"), "utf8"), /name: source-skill/);
    assert.equal(readFileSync(join(target, "scripts", "run.mjs"), "utf8"), "console.log('ok');\n");
  });
  const implementation = readFileSync(new URL("./skill-directory-copy.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(implementation, /\bcpSync\b|\bcp\s*\(/);
});

test("isolated Skill copy returns worker results and preserves the host on worker failure", () => {
  withTempRoot("skill-worker-", (root) => {
    const source = makeSkill(root);
    const target = join(root, "installed", "source-skill");
    const copied = runIsolatedSkillDirectoryCopy(source, target);
    assert.equal(copied.ok, true);
    assert.equal(copied.exitCode, 0);
    assert.equal(copied.files, 2);
    assert.equal(existsSync(join(target, "SKILL.md")), true);

    const failingWorker = join(root, "failing-worker.mjs");
    writeFileSync(failingWorker, "process.stderr.write('blocked by endpoint security\\n'); process.exit(17);\n", "utf8");
    const failed = runIsolatedSkillDirectoryCopy(source, join(root, "never-installed"), { workerPath: failingWorker });
    assert.equal(failed.ok, false);
    assert.equal(failed.exitCode, 17);
    assert.match(failed.error, /blocked by endpoint security/);
  });
});

test("controlled Skill copy rejects unsafe topology and bounded-resource violations", () => {
  withTempRoot("skill-copy-limits-", (root) => {
    const source = makeSkill(root);
    assert.throws(
      () => copySkillDirectoryControlled(source, join(source, "nested-target")),
      /target must not be inside/,
    );
    assert.throws(
      () => copySkillDirectoryControlled(source, join(root, "too-many"), { maxFiles: 1 }),
      /more than 1 files/,
    );
    assert.equal(existsSync(join(root, "too-many")), false);
    assert.throws(
      () => copySkillDirectoryControlled(source, join(root, "too-large"), { maxBytes: 1 }),
      /exceeds 1 bytes/,
    );
    assert.equal(existsSync(join(root, "too-large")), false);
  });
});
