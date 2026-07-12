import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

const launcherUrl = new URL("../launcher.mjs", import.meta.url);
const dashboardUrl = new URL("../visionox-pkg/dashboard/dist/app.js", import.meta.url);
const patchGuardUrl = new URL("../../../../scripts/check-bundle-patches.js", import.meta.url);
const rulesUrl = new URL("../../ecc-rules/", import.meta.url);
const serverUrl = new URL("../visionox-pkg/dist/cli/server-XGDBRWMB.js", import.meta.url);
const { dispatch } = await import(serverUrl.href);
const TOKEN = "ecc-test-token";

async function postSettings(configPath, body, overrides) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.url = "/api/settings";
  req.method = "POST";
  req.headers = { "x-reasonix-token": TOKEN, "content-type": "application/json" };
  let status = null;
  let raw = "";
  const res = {
    writeHead(value) { status = value; },
    end(value) { raw = value ?? ""; },
  };
  await dispatch(req, res, {
    configPath,
    mode: "desktop",
    loop: { model: "test-model" },
    getModes: () => ({ current: "coding", list: [{ id: "coding" }], active: { id: "coding" } }),
    getEccRules: () => ({ available: ["common", "golang", "rust"], enabled: ["common", "rust"], status: [] }),
    ...overrides,
  }, TOKEN);
  return { status, body: JSON.parse(raw) };
}

test("ECC 设置 API 去重合法规则并拒绝未知规则", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ecc-settings-"));
  const configPath = join(dir, "config.json");
  writeFileSync(configPath, JSON.stringify({ mode: "coding", modes: { coding: { eccRules: ["common", "rust"] } } }), "utf8");
  let applied = null;
  try {
    const overrides = { setEccRules: (rules) => { applied = rules; return true; } };
    const saved = await postSettings(configPath, { eccRules: ["common", "golang", "golang"] }, overrides);
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.body.changed, ["eccRules"]);
    assert.deepEqual(applied, ["common", "golang"]);

    applied = null;
    const rejected = await postSettings(configPath, { eccRules: ["common", "unknown"] }, overrides);
    assert.equal(rejected.status, 400);
    assert.match(rejected.body.error, /unknown/);
    assert.equal(applied, null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ECC 配置按当前工作场景持久化并立即刷新运行上下文", () => {
  const launcher = readFileSync(launcherUrl, "utf8");
  assert.match(launcher, /cfg\.modes\[cfg\.mode\]\.eccRules = normalized/);
  assert.match(launcher, /syncRuntimeConfig\(cfg\)/);
  assert.match(launcher, /rebuildLoopPreservingContext\(client, workspaceDir\)/);
  assert.match(launcher, /kind: "config-changed"/);
  assert.doesNotMatch(launcher, /cfg\.eccRules = rules/);
});

test("ECC 文件内容编辑会使系统提示词缓存失效", () => {
  const launcher = readFileSync(launcherUrl, "utf8");
  assert.match(launcher, /rule:\$\{name\}=\$\{dir \? flatMdMtimeFingerprint\(dir\) : "0"\}/);
});

test("ECC 命令、状态和 Dashboard 管理入口保持可达", () => {
  const launcher = readFileSync(launcherUrl, "utf8");
  const dashboard = readFileSync(dashboardUrl, "utf8");
  assert.match(launcher, /name: "\/ecc"/);
  assert.match(launcher, /availableEccRuleNames\(\)/);
  assert.match(launcher, /ECC 规则：/);
  assert.match(dashboard, /save\(\{ eccRules: next \}\)/);
  assert.match(dashboard, /ECC 编码规范/);
});

test("构建门禁覆盖 ECC 资源和部署入口", () => {
  const patchGuard = readFileSync(patchGuardUrl, "utf8");
  assert.match(patchGuard, /src-tauri\/resources\/ecc-rules\/common\/coding-style\.md/);
  assert.match(patchGuard, /deployEccRules/);
  assert.match(patchGuard, /loadRules/);
});

test("内置 ECC 语言包完整，资源缺失会显式终止启动", () => {
  const launcher = readFileSync(launcherUrl, "utf8");
  const packs = readdirSync(rulesUrl, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  assert.equal(packs.length, 22);
  assert.ok(packs.includes("common"));
  assert.ok(existsSync(new URL("common/coding-style.md", rulesUrl)));
  assert.match(launcher, /ECC rules resource is missing/);
  assert.match(launcher, /failed to deploy ECC rules[\s\S]*?throw err/);
});
