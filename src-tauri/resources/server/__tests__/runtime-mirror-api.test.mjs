import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Readable } from "node:stream";

const { dispatch } = await import(new URL("../visionox-pkg/dist/cli/server-XGDBRWMB.js", import.meta.url).href);
const TOKEN = "test-token-runtime-mirror";

test("runtime mirror settings keep domestic priority and reject unsafe sources", async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), "runtime-mirror-api-"));
  const configPath = join(tmpDir, "config.json");
  const config = {
    editMode: "auto",
    preset: "auto",
    providers: [{ id: "test", name: "Test", baseUrl: "http://localhost:11434/v1", apiKey: "sk-test-key", models: [{ id: "test-model", maxContextLength: 131072 }], defaultPreset: "auto" }],
    activeProviderId: "test",
  };
  writeFileSync(configPath, JSON.stringify(config));
  const ctx = {
    configPath,
    mode: "desktop",
    getModes: () => ({ current: "general", list: [], active: null }),
    getEccRules: () => null,
    getSessionName: () => null,
    getCurrentCwd: () => tmpDir,
    loop: { model: "test-model" },
    syncProvider: async () => {},
    refreshContextCap: () => {},
  };
  const request = (method, path, body) => {
    const req = Readable.from([Buffer.from(JSON.stringify(body))]);
    req.url = path;
    req.method = method;
    req.headers = { "x-reasonix-token": TOKEN, "content-type": "application/json" };
    let status = null;
    let raw = "";
    const res = { writeHead: (value) => { status = value; }, end: (value) => { raw = value || ""; } };
    return dispatch(req, res, ctx, TOKEN).then(() => ({ status, json: raw ? JSON.parse(raw) : null }));
  };
  try {
    const saved = await request("POST", "/api/settings", { runtime: { packageSources: { python: ["https://pypi.tuna.tsinghua.edu.cn/simple"], node: ["https://registry.npmmirror.com"] }, domesticOnly: true, allowOfficialFallback: true } });
    assert.equal(saved.status, 200);
    const loaded = await request("GET", "/api/settings", {});
    assert.equal(loaded.json.runtime.domesticOnly, true);
    assert.equal(loaded.json.runtime.allowOfficialFallback, false);
    assert.deepEqual(loaded.json.runtime.packageSources.node, ["https://registry.npmmirror.com"]);
    assert.equal((await request("POST", "/api/settings", { runtime: { packageSources: { python: ["http://mirror.invalid/simple"], node: [] } } })).status, 400);
    assert.equal((await request("POST", "/api/settings", { runtime: { packageSources: { python: ["https://user:secret@mirror.invalid/simple"], node: [] } } })).status, 400);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});
