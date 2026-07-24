import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, test } from "node:test";

const root = new URL("../../../../", import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1");
const dashboard = join(root, "src-tauri", "resources", "server", "visionox-pkg", "dashboard");
const buildScript = join(root, "scripts", "build-dashboard.js");

describe("Dashboard source build", () => {
  test("keeps the rebuildable TypeScript source tree and one canonical entry point", () => {
    for (const relative of [
      "tsconfig.json",
      "src/app.ts",
      "src/app.css",
      "src/lib/api.ts",
      "src/components/chat-internals.ts",
      "src/panels/chat.ts",
    ]) {
      assert.equal(existsSync(join(dashboard, relative)), true, `missing Dashboard source: ${relative}`);
    }
    assert.equal(existsSync(buildScript), true, "missing governed Dashboard build script");
  });

  test("rebuilds committed Dashboard assets byte-for-byte without network access", () => {
    const output = mkdtempSync(join(tmpdir(), "visionox-dashboard-build-"));
    try {
      const result = spawnSync(process.execPath, [buildScript, "--outdir", output, "--check"], {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          npm_config_offline: "true",
        },
        windowsHide: true,
      });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      for (const relative of ["dist/app.js", "app.css"]) {
        assert.deepEqual(
          readFileSync(join(output, relative)),
          readFileSync(join(dashboard, relative)),
          `${relative} differs from its source build`,
        );
      }
    } finally {
      rmSync(output, { recursive: true, force: true });
    }
  });
});
