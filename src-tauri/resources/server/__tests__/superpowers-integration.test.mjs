import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const resourcesUrl = new URL("../../", import.meta.url);
const launcherUrl = new URL("../launcher.mjs", import.meta.url);
const serverUrl = new URL("../visionox-pkg/dist/cli/server-XGDBRWMB.js", import.meta.url);
const dashboardUrl = new URL("../visionox-pkg/dashboard/dist/app.js", import.meta.url);
const { dispatch } = await import(serverUrl.href);
const TOKEN = "superpowers-test-token";
const LAUNCHER_SLASH_COMMANDS = [
  "help", "new", "status", "compact", "retry", "cost", "context",
  "skill", "ecc", "btw", "report", "learn",
];

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`server did not become ready: ${url}`);
}

async function request(method, url, ctx) {
  const req = method === "GET" ? {} : Readable.from([]);
  req.method = method;
  req.url = url;
  req.headers = { "x-reasonix-token": TOKEN };
  let status = null;
  let raw = "";
  const res = { writeHead(value) { status = value; }, end(value) { raw = value ?? ""; } };
  await dispatch(req, res, ctx, TOKEN);
  return { status, body: raw ? JSON.parse(raw) : null };
}

test("斜杠菜单公开 launcher 命令，/skill 支持列出、查看和带任务调用", async () => {
  const launcher = readFileSync(launcherUrl, "utf8");
  const listed = await request("GET", "/api/slash", {
    getCurrentCwd: () => null,
    getSlashCommands: () => [
      { name: "/skill", aliases: [], desc: "调用技能", usage: "/skill <name>", group: "system" },
      { name: "/ecc", aliases: [], desc: "ECC", usage: "/ecc", group: "system" },
    ],
  });
  assert.equal(listed.status, 200);
  assert.deepEqual(listed.body.commands.map((command) => command.cmd), ["skill", "ecc"]);
  assert.equal(listed.body.commands.some((command) => command.cmd === "exit"), false);
  assert.match(launcher, /name: "\/skill"/);
  assert.match(launcher, /new SkillStore\(\{ homeDir: home, projectRoot: workspaceDir \}\)/);
  assert.match(launcher, /manualSkillInput = await tools\.dispatch\("run_skill"/);
});

test("真实 launcher 可执行 /skill list", { timeout: 30000 }, async () => {
  const home = mkdtempSync(join(tmpdir(), "superpowers-launcher-"));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const proc = spawn(process.execPath, [fileURLToPath(launcherUrl), "--port", String(port), "--token", TOKEN], {
    stdio: ["ignore", "ignore", "pipe"],
    env: { ...process.env, HOME: home, USERPROFILE: home },
  });
  let stderr = "";
  proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  const headers = { "x-reasonix-token": TOKEN };
  try {
    await waitForServer(`${base}/api/health?token=${TOKEN}`);
    const slash = await (await fetch(`${base}/api/slash`, { headers })).json();
    assert.deepEqual(slash.commands.map((command) => command.cmd), LAUNCHER_SLASH_COMMANDS);

    const submitted = await fetch(`${base}/api/submit`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ prompt: "/skill list" }),
    });
    assert.equal(submitted.status, 202, stderr.slice(-2000));
    const messages = await (await fetch(`${base}/api/messages?limit=20`, { headers })).json();
    assert.ok(messages.messages.some((message) => /可用技能/.test(message.text ?? "")));

    const reset = await fetch(`${base}/api/submit`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ prompt: "/new" }),
    });
    assert.equal(reset.status, 202, stderr.slice(-2000));
    assert.equal((await reset.json()).accepted, true);
  } finally {
    if (proc.exitCode === null) {
      if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(proc.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
      else proc.kill("SIGTERM");
    }
    rmSync(home, { recursive: true, force: true });
  }
});

test("删除受管 bootstrap skill 会持久停用，修复操作可以恢复", async () => {
  const root = mkdtempSync(join(tmpdir(), "superpowers-delete-"));
  const skillDir = join(root, "brainstorming");
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, "SKILL.md"), "---\nname: brainstorming\ndescription: test\n---\n\nbody", "utf8");
  writeFileSync(join(skillDir, "_visionox_builtin.json"), JSON.stringify({ owner: "visionox-bootstrap", name: "brainstorming" }), "utf8");
  let disabled = null;
  try {
    const result = await request("DELETE", "/api/skills/global/brainstorming", {
      skillsRoot: root,
      getCurrentCwd: () => null,
      disableBootstrapSkill(name) { disabled = name; },
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.disabledBuiltin, true);
    assert.equal(disabled, "brainstorming");
    assert.equal(existsSync(skillDir), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }

  const launcher = readFileSync(launcherUrl, "utf8");
  const server = readFileSync(serverUrl, "utf8");
  const dashboard = readFileSync(dashboardUrl, "utf8");
  assert.match(launcher, /BOOTSTRAP_SKILLS_DISABLED_DIR/);
  assert.match(launcher, /already up to date \(fast path\)/);
  assert.match(launcher, /marker\.sourceFingerprint === sourceFingerprint/);
  assert.match(launcher, /async function sourceSkillFingerprint/);
  assert.match(launcher, /durationMs=\$\{Date\.now\(\) - startedAt\}/);
  assert.match(launcher, /isBootstrapSkillDisabled/);
  assert.match(launcher, /restoreDisabled: true/);
  assert.match(server, /if \(disabledBuiltin\) ctx\.enableBootstrapSkill\?\.\(name\)/);
  assert.match(dashboard, /disabledBuiltin/);
});

test("Superpowers 技能文本只引用 Visionox 可用机制", () => {
  const requesting = readFileSync(new URL("bootstrap-skills/requesting-code-review/SKILL.md", resourcesUrl), "utf8");
  const using = readFileSync(new URL("bootstrap-skills/using-superpowers/SKILL.md", resourcesUrl), "utf8");
  assert.doesNotMatch(requesting, /superpowers:code-reviewer|Use Task tool/);
  assert.match(requesting, /independent review/i);
  assert.doesNotMatch(using, /Claude Code|Skill tool|Read tool|TodoWrite/);
  assert.match(using, /run_skill/);
});

test("Superpowers 的上游来源和 MIT 许可证随资源分发", () => {
  const provenance = JSON.parse(readFileSync(new URL("bootstrap-skills-provenance.json", resourcesUrl), "utf8"));
  const group = provenance.groups.find((entry) => entry.skills?.includes("using-superpowers"));
  assert.equal(group.status, "verified");
  assert.equal(group.source, "https://github.com/obra/superpowers");
  assert.equal(group.license, "MIT");
  assert.ok(group.licenseFile);
  assert.ok(existsSync(new URL(group.licenseFile, resourcesUrl)));
  const notices = readFileSync(new URL("THIRD_PARTY_NOTICES.md", resourcesUrl), "utf8");
  assert.match(notices, /obra\/superpowers/);
  assert.match(notices, /Jesse Vincent/);
});
