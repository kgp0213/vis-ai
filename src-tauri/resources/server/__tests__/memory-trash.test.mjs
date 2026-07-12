import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

const { dispatch } = await import(new URL("../visionox-pkg/dist/cli/server-XGDBRWMB.js", import.meta.url).href);
const TOKEN = "memory-trash-test";

function response() {
  let status = null;
  let raw = "";
  return {
    writeHead(value) { status = value; },
    end(value) { raw = value ?? ""; },
    get status() { return status; },
    get json() { return raw ? JSON.parse(raw) : null; },
  };
}

async function request(method, path, body, ctx = {}) {
  const req = body === undefined ? {} : Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = method;
  req.url = path;
  req.headers = { "x-reasonix-token": TOKEN, "content-type": "application/json" };
  const res = response();
  await dispatch(req, res, ctx, TOKEN);
  return res;
}

function memoryBody(name, text = "Reusable memory") {
  return `---\nname: ${name}\ndescription: ${name}\ntype: user\n---\n\n${text}\n`;
}

test("memory trash supports permanent deletion and confirmed purge", async () => {
  const root = mkdtempSync(join(tmpdir(), "memory-trash-delete-"));
  const memoryHomeDir = join(root, "home");
  const ctx = { memoryHomeDir, getCurrentCwd: () => root };
  try {
    for (const name of ["one", "two"]) {
      assert.equal((await request("POST", `/api/memory/global/${name}`, { body: memoryBody(name) }, ctx)).status, 200);
      assert.equal((await request("DELETE", `/api/memory/global/${name}`, {}, ctx)).status, 200);
    }
    writeFileSync(join(memoryHomeDir, "memory-trash", "broken.json"), "{not-json");
    const listed = await request("GET", "/api/memory/trash", undefined, ctx);
    assert.equal(listed.json.items.length, 2);
    assert.equal(listed.json.total, 3);
    assert.equal(listed.json.invalidCount, 1);
    assert.equal(listed.json.retentionDays, 30);
    assert.ok(listed.json.items.every((item) => Date.parse(item.expiresAt) > Date.parse(item.deletedAt)));

    assert.equal((await request("DELETE", `/api/memory/trash/${listed.json.items[0].id}`, {}, ctx)).status, 200);
    assert.equal((await request("DELETE", "/api/memory/trash", { confirm: false }, ctx)).status, 400);
    const purged = await request("DELETE", "/api/memory/trash", { confirm: true }, ctx);
    assert.equal(purged.status, 200);
    assert.equal(purged.json.deleted, 2);
    assert.equal((await request("GET", "/api/memory/trash", undefined, ctx)).json.items.length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("memory trash prunes expired entries and does not hide entries after 100", async () => {
  const root = mkdtempSync(join(tmpdir(), "memory-trash-list-"));
  const memoryHomeDir = join(root, "home");
  const trashDir = join(memoryHomeDir, "memory-trash");
  mkdirSync(trashDir, { recursive: true });
  try {
    const now = Date.now();
    for (let index = 0; index < 105; index += 1) {
      const id = `current-${index}`;
      writeFileSync(join(trashDir, `${id}.json`), JSON.stringify({ id, kind: "persistent", scope: "global", name: id, raw: "ok", deletedAt: new Date(now - index * 1000).toISOString() }));
    }
    writeFileSync(join(trashDir, "expired.json"), JSON.stringify({ id: "expired", kind: "persistent", scope: "global", name: "expired", raw: "old", deletedAt: new Date(now - 31 * 86400000).toISOString() }));

    const listed = await request("GET", "/api/memory/trash", undefined, { memoryHomeDir, getCurrentCwd: () => root });
    assert.equal(listed.json.items.length, 105);
    assert.equal(existsSync(join(trashDir, "expired.json")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("restore trusts the requested trash id and preserves project ownership", async () => {
  const root = mkdtempSync(join(tmpdir(), "memory-trash-restore-"));
  const memoryHomeDir = join(root, "home");
  const trashDir = join(memoryHomeDir, "memory-trash");
  const projectA = join(root, "project-a");
  const projectB = join(root, "project-b");
  mkdirSync(trashDir, { recursive: true });
  mkdirSync(projectA);
  mkdirSync(projectB);
  const victim = join(root, "victim.json");
  writeFileSync(victim, "keep");
  writeFileSync(join(trashDir, "safe.json"), JSON.stringify({ id: "../../victim", kind: "persistent", scope: "global", name: "safe", raw: memoryBody("safe"), deletedAt: new Date().toISOString() }));
  try {
    assert.equal((await request("POST", "/api/memory/trash/safe/restore", {}, { memoryHomeDir, getCurrentCwd: () => projectA })).status, 200);
    assert.equal(existsSync(victim), true);
    assert.equal(existsSync(join(trashDir, "safe.json")), false);

    const ctxA = { memoryHomeDir, getCurrentCwd: () => projectA };
    assert.equal((await request("POST", "/api/memory/project-mem/project-note", { body: memoryBody("project-note") }, ctxA)).status, 200);
    const removed = await request("DELETE", "/api/memory/project-mem/project-note", {}, ctxA);
    assert.equal(removed.status, 200);
    const wrongProjectList = await request("GET", "/api/memory/trash", undefined, { memoryHomeDir, getCurrentCwd: () => projectB });
    assert.equal(wrongProjectList.json.items[0].canRestore, false);
    assert.match(wrongProjectList.json.items[0].restoreHint, /original project/i);
    const wrongProject = await request("POST", `/api/memory/trash/${removed.json.trashId}/restore`, {}, { memoryHomeDir, getCurrentCwd: () => projectB });
    assert.equal(wrongProject.status, 409);
    assert.match(wrongProject.json.error, /original project/i);

    writeFileSync(join(trashDir, "legacy-project.json"), JSON.stringify({ id: "legacy-project", kind: "persistent", scope: "project", name: "legacy", raw: memoryBody("legacy"), deletedAt: new Date().toISOString() }));
    const legacyList = await request("GET", "/api/memory/trash", undefined, { memoryHomeDir, getCurrentCwd: () => projectA });
    assert.equal(legacyList.json.items.find((item) => item.id === "legacy-project").canRestore, false);
    const legacyRestore = await request("POST", "/api/memory/trash/legacy-project/restore", {}, { memoryHomeDir, getCurrentCwd: () => projectA });
    assert.equal(legacyRestore.status, 409);
    assert.match(legacyRestore.json.error, /legacy project ownership/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("dashboard exposes preview-safe restore, permanent delete and empty-trash controls", () => {
  const dashboard = readFileSync(new URL("../visionox-pkg/dashboard/dist/app.js", import.meta.url), "utf8");
  const launcher = readFileSync(new URL("../launcher.mjs", import.meta.url), "utf8");
  assert.match(dashboard, /清空回收站中的/);
  assert.match(dashboard, /记忆已永久删除/);
  assert.match(dashboard, /draft\.canRestore === false/);
  assert.match(dashboard, /item\.raw, item\.item\?\.text/);
  assert.match(launcher, /pruneMemoryTrash\(visionoxDataDir\)/);
});
