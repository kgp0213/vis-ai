import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function makeTempHome() {
  const dir = mkdtempSync(join(tmpdir(), "vis-ai-learn-track-"));
  return dir;
}

async function importFresh() {
  // Use a cache-busting query so Node re-evaluates the module with the new HOME.
  const url = new URL("./learn-track.mjs", import.meta.url);
  url.searchParams.set("t", String(Date.now()));
  return import(url.href);
}

test("getConceptManager returns the same instance on repeated calls", async () => {
  const home = makeTempHome();
  const oldUser = process.env.USERPROFILE;
  const oldHome = process.env.HOME;
  process.env.USERPROFILE = home;
  process.env.HOME = home;
  try {
    const { getConceptManager } = await importFresh();
    const a = getConceptManager();
    const b = getConceptManager();
    assert.equal(a, b, "singleton must return the same instance");
  } finally {
    process.env.USERPROFILE = oldUser;
    process.env.HOME = oldHome;
    rmSync(home, { recursive: true, force: true });
  }
});

test("50 sequential addConcept calls persist all 50 concepts with no .tmp residue", async () => {
  const home = makeTempHome();
  const oldUser = process.env.USERPROFILE;
  const oldHome = process.env.HOME;
  process.env.USERPROFILE = home;
  process.env.HOME = home;
  try {
    const { getConceptManager } = await importFresh();
    const mgr = getConceptManager();
    for (let i = 0; i < 50; i++) {
      mgr.addConcept({ name: `concept-${i}`, level: 1, source: "test" });
    }
    // Verify in-memory state.
    assert.equal(mgr.listAll().length, 50, "in-memory count must be 50");
    // Verify persisted state on disk.
    const trackFile = join(home, ".visionox", "learn-track.json");
    assert.ok(existsSync(trackFile), "track file must exist");
    const persisted = JSON.parse(readFileSync(trackFile, "utf8"));
    assert.equal(persisted.concepts.length, 50, "persisted count must be 50");
    // Verify no .tmp residue.
    const dirEntries = readdirSync(join(home, ".visionox"));
    const tmps = dirEntries.filter((n) => n.endsWith(".tmp"));
    assert.deepEqual(tmps, [], "no .tmp files should remain after writes settle");
  } finally {
    process.env.USERPROFILE = oldUser;
    process.env.HOME = oldHome;
    rmSync(home, { recursive: true, force: true });
  }
});

test("singleton prevents multi-instance data loss", async () => {
  // Simulates the OLD buggy pattern: two `new LearningConceptManager()`
  // instances each load, mutate, and save independently → the second save
  // overwrites the first, losing data.
  // With the singleton, both callers share the same in-memory state, so no loss.
  const home = makeTempHome();
  const oldUser = process.env.USERPROFILE;
  const oldHome = process.env.HOME;
  process.env.USERPROFILE = home;
  process.env.HOME = home;
  try {
    const { getConceptManager } = await importFresh();
    const a = getConceptManager();
    const b = getConceptManager();
    a.addConcept({ name: "from-a", source: "test" });
    b.addConcept({ name: "from-b", source: "test" });
    assert.equal(a.listAll().length, 2, "a sees both");
    assert.equal(b.listAll().length, 2, "b sees both (shared state)");
    const trackFile = join(home, ".visionox", "learn-track.json");
    const persisted = JSON.parse(readFileSync(trackFile, "utf8"));
    assert.equal(persisted.concepts.length, 2, "both concepts persisted");
  } finally {
    process.env.USERPROFILE = oldUser;
    process.env.HOME = oldHome;
    rmSync(home, { recursive: true, force: true });
  }
});

test("sm2Update: successful review increases interval and repetitions", async () => {
  const home = makeTempHome();
  const oldUser = process.env.USERPROFILE;
  const oldHome = process.env.HOME;
  process.env.USERPROFILE = home;
  process.env.HOME = home;
  try {
    const { getConceptManager } = await importFresh();
    const mgr = getConceptManager();
    const c = mgr.addConcept({ name: "sm2-test", source: "test" });
    assert.equal(c.interval, 1, "initial interval is 1");
    assert.equal(c.repetitions, 0, "initial repetitions is 0");
    const reviewed = mgr.review(c.name, "good");
    assert.equal(reviewed.repetitions, 1, "repetitions increments to 1");
    assert.equal(reviewed.interval, 1, "first-success interval is 1 day");
    const reviewed2 = mgr.review(c.name, "good");
    assert.equal(reviewed2.repetitions, 2, "repetitions increments to 2");
    assert.equal(reviewed2.interval, 6, "second-success interval is 6 days");
  } finally {
    process.env.USERPROFILE = oldUser;
    process.env.HOME = oldHome;
    rmSync(home, { recursive: true, force: true });
  }
});
