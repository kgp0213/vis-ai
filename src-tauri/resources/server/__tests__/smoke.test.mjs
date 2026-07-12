import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const launcherPath = resolve(__dirname, "..", "launcher.mjs");

// Find a free port by binding to :0 then releasing
function findFreePort() {
  return new Promise((resolve, reject) => {
    const net = import("node:net").then(m => m);
    net.then(({ createServer }) => {
      const srv = createServer();
      srv.listen(0, "127.0.0.1", () => {
        const port = srv.address().port;
        srv.close(() => resolve(port));
      });
      srv.on("error", reject);
    });
  });
}

// Wait for a URL to respond with status 200, polling every 200ms
async function waitForHealth(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.status === 200) return true;
    } catch {
      // server not ready yet
    }
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}

describe("冒烟测试：服务器启动", { timeout: 30000 }, () => {
  let proc;
  let tempHome;

  after(() => {
    if (proc?.pid && proc.exitCode === null) {
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/PID", String(proc.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
      } else {
        proc.kill("SIGTERM");
      }
    }
    if (tempHome && resolve(tempHome).toLowerCase().startsWith(`${resolve(tmpdir())}${sep}`.toLowerCase())) {
      rmSync(tempHome, { recursive: true, force: true });
    }
  });

  test("launcher.mjs 启动 → /api/health 返回 200", async () => {
    const port = await findFreePort();
    const token = "smoke-test-token";
    const healthUrl = `http://127.0.0.1:${port}/api/health?token=${token}`;
    tempHome = mkdtempSync(resolve(tmpdir(), "visionox-server-smoke-"));

    proc = spawn(process.execPath, [launcherPath, "--port", String(port), "--token", token], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, HOME: tempHome, USERPROFILE: tempHome },
    });

    // Capture stderr for diagnostics if startup fails
    let stderrBuf = "";
    proc.stderr.on("data", (chunk) => { stderrBuf += chunk.toString(); });

    // If process exits prematurely, fail fast
    const exitPromise = new Promise((resolve) => {
      proc.on("exit", (code) => resolve(code));
    });

    const healthy = await waitForHealth(healthUrl, 15000);

    if (!healthy) {
      // Check if process died
      const exitCode = await Promise.race([
        exitPromise,
        new Promise(r => setTimeout(() => r(null), 500)),
      ]);
      if (exitCode !== null) {
        assert.fail(`server exited with code ${exitCode} before becoming healthy.\nstderr:\n${stderrBuf.slice(-2000)}`);
      }
      assert.fail(`server did not become healthy within 15s.\nstderr:\n${stderrBuf.slice(-2000)}`);
    }

    assert.ok(healthy, "server should respond with 200 on /api/health");
  });
});
