import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import {
  DlpDecryptError,
  getDlpConfig,
  prepareLocalDocument,
  resolveDlpScriptPath,
  resolveReadablePathForDlp,
  wrapToolsPathArgsWithDlp,
} from "../lib/dlp-file.mjs";

async function withTempDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), "visionox-dlp-test-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function createToolRegistry(defs) {
  const map = new Map(defs);
  return {
    defs: map,
    tools: {
      get: (name) => map.get(name),
      unregister: (name) => map.delete(name),
      register: (def) => {
        map.set(def.name, def);
        return this;
      },
    },
  };
}

async function createFakeDlpScript(dir, decryptedPath) {
  const scriptPath = join(dir, "fake-visionox-file.mjs");
  await writeFile(scriptPath, [
    "const src = process.argv[2];",
    `const dst = ${JSON.stringify(decryptedPath)};`,
    "const name = src.split(/[\\\\/]/).pop();",
    "console.log(JSON.stringify({ ok: true, files: [{ status: 'ok', src, dst, name }] }));",
  ].join("\n"), "utf8");
  return scriptPath;
}

test("getDlpConfig defaults to auto mode and discovers installed script candidates", async () => {
  await withTempDir(async (dir) => {
    const scriptDir = join(dir, ".visionox", "skills", "visionox-file");
    mkdirSync(scriptDir, { recursive: true });
    const scriptPath = join(scriptDir, "visionox_file.py");
    writeFileSync(scriptPath, "print('ok')", "utf8");

    const cfg = getDlpConfig({}, { homeDir: dir });
    assert.equal(cfg.mode, "auto");
    assert.equal(resolve(cfg.scriptPath), resolve(scriptPath));
  });
});

test("resolveDlpScriptPath returns null when configured script does not exist", () => {
  const script = resolveDlpScriptPath(
    { dlp: { scriptPath: "Z:\\missing\\visionox_file.py" } },
    { homeDir: "Z:\\missing-home" },
  );
  assert.equal(script, null);
});

test("resolveDlpScriptPath discovers bundled server skill candidate", async () => {
  await withTempDir(async (dir) => {
    const scriptDir = join(dir, "visionox-file");
    mkdirSync(scriptDir, { recursive: true });
    const scriptPath = join(scriptDir, "visionox_file.py");
    writeFileSync(scriptPath, "print('ok')", "utf8");

    const script = resolveDlpScriptPath({}, { homeDir: join(dir, "home"), serverDir: dir });
    assert.equal(resolve(script), resolve(scriptPath));
  });
});

test("resolveReadablePathForDlp leaves plaintext files unchanged", async () => {
  await withTempDir(async (dir) => {
    const file = join(dir, "plain.txt");
    await writeFile(file, "hello\n", "utf8");
    const result = await resolveReadablePathForDlp(file, {
      cfg: { dlp: { mode: "on" } },
      env: { homeDir: dir, projectRoot: dir },
      logger: null,
    });
    assert.equal(resolve(result.path), resolve(file));
    assert.equal(result.encrypted, false);
  });
});

test("resolveReadablePathForDlp resolves relative paths from workspace root", async () => {
  await withTempDir(async (dir) => {
    const file = join(dir, "relative.txt");
    await writeFile(file, "hello\n", "utf8");
    const result = await resolveReadablePathForDlp("relative.txt", {
      cfg: { dlp: { mode: "on" } },
      env: { homeDir: dir, projectRoot: dir, rootDir: dir },
      logger: null,
    });
    assert.equal(resolve(result.path), resolve(file));
    assert.equal(result.encrypted, false);
  });
});

test("prepareLocalDocument extracts a malformed Windows drive path from a full prompt", async () => {
  if (process.platform !== "win32") return;
  await withTempDir(async (dir) => {
    const folder = join(dir, "tets");
    mkdirSync(folder, { recursive: true });
    const encrypted = join(folder, "（20260703）OP Manual规范模板_A5.3_量产_M673_SV3-4_拐点45nit.pdf");
    const decrypted = join(dir, "op-manual.decrypted.pdf");
    await writeFile(encrypted, Buffer.from([0, 0, 0, 0, 1, 2, 3, 4]));
    await writeFile(decrypted, Buffer.from("%PDF-1.7"));
    const scriptPath = await createFakeDlpScript(dir, decrypted);

    const brokenPath = encrypted.replace(/^([A-Za-z]):\\/, "$1:");
    const prompt = `尝试读取${brokenPath} 测试能否读取其片段内容`;
    const result = await prepareLocalDocument(prompt, {
      cfg: { dlp: { mode: "on", pythonPath: process.execPath, scriptPath } },
      env: { homeDir: dir, projectRoot: dir, rootDir: dir },
      logger: null,
    });

    assert.equal(result.ok, true);
    assert.equal(resolve(result.sourcePath), resolve(encrypted));
    assert.equal(resolve(result.readablePath), resolve(decrypted));
    assert.equal(result.documentKind, "pdf");
    assert.equal(result.usedCompatibilityAdapter, true);
  });
});

test("resolveReadablePathForDlp skips code-like extensions in auto mode", async () => {
  await withTempDir(async (dir) => {
    const file = join(dir, "script.py");
    await writeFile(file, Buffer.from([0, 0, 0, 0, 1, 2, 3, 4]));
    const result = await resolveReadablePathForDlp(file, {
      cfg: {},
      env: { homeDir: dir, projectRoot: dir },
      logger: null,
    });
    assert.equal(resolve(result.path), resolve(file));
    if (process.platform === "win32") {
      assert.equal(result.skipped, "extension");
    }
  });
});

test("resolveReadablePathForDlp reports encrypted-file failure when script is missing", async () => {
  await withTempDir(async (dir) => {
    const file = join(dir, "report.pdf");
    await writeFile(file, Buffer.from([0, 0, 0, 0, 1, 2, 3, 4]));

    if (process.platform !== "win32") {
      const result = await resolveReadablePathForDlp(file, {
        cfg: { dlp: { mode: "on" } },
        env: { homeDir: dir, projectRoot: dir },
        logger: null,
      });
      assert.equal(result.skipped, "non-windows");
      return;
    }

    await assert.rejects(
      () => resolveReadablePathForDlp(file, {
        cfg: { dlp: { mode: "on" } },
        env: { homeDir: dir, projectRoot: dir },
        logger: null,
      }),
      (err) => {
        assert.ok(err instanceof DlpDecryptError);
        assert.match(err.message, /文件暂时无法读取/);
        assert.match(err.message, /内部文件读取组件/);
        assert.doesNotMatch(err.message, /DLP|加密|解密|visionox-file|visionox_file/i);
        return true;
      },
    );
  });
});

test("resolveReadablePathForDlp aborts a running compatibility process promptly", async () => {
  if (process.platform !== "win32") return;
  await withTempDir(async (dir) => {
    const file = join(dir, "slow-report.pdf");
    const scriptPath = join(dir, "slow-visionox-file.mjs");
    await writeFile(file, Buffer.from([0, 0, 0, 0, 1, 2, 3, 4]));
    await writeFile(scriptPath, "setTimeout(() => {}, 30000);", "utf8");
    const controller = new AbortController();
    const started = Date.now();
    const pending = resolveReadablePathForDlp(file, {
      cfg: { dlp: { mode: "on", pythonPath: process.execPath, scriptPath, timeoutMs: 30000 } },
      env: { homeDir: dir, projectRoot: dir },
      logger: null,
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 50);
    await assert.rejects(pending, (err) => err?.name === "AbortError");
    assert.ok(Date.now() - started < 1500);
  });
});

test("wrapToolsPathArgsWithDlp keeps plaintext MCP path arguments unchanged", async () => {
  await withTempDir(async (dir) => {
    await writeFile(join(dir, "plain.txt"), "hello\n", "utf8");
    let receivedArgs = null;
    const { defs, tools } = createToolRegistry([
      ["officecli", {
        name: "officecli",
        fn: async (args) => {
          receivedArgs = args;
          return "ok";
        },
      }],
    ]);
    const wrapped = wrapToolsPathArgsWithDlp(tools, ["officecli"], {
      readConfig: () => ({ dlp: { mode: "on" } }),
      env: { homeDir: dir, projectRoot: dir, rootDir: dir },
      logger: null,
    });
    assert.equal(wrapped, 1);
    assert.equal(await defs.get("officecli").fn({ path: "plain.txt" }), "ok");
    assert.deepEqual(receivedArgs, { path: "plain.txt" });
  });
});

test("wrapToolsPathArgsWithDlp rewrites encrypted officecli command string paths", async () => {
  if (process.platform !== "win32") return;
  await withTempDir(async (dir) => {
    const encrypted = join(dir, "secret deck.pptx");
    const decrypted = join(dir, "secret deck.decrypted.pptx");
    await writeFile(encrypted, Buffer.from([0, 0, 0, 0, 1, 2, 3, 4]));
    await writeFile(decrypted, Buffer.from("PK\x03\x04"));
    const scriptPath = await createFakeDlpScript(dir, decrypted);

    let receivedArgs = null;
    const { defs, tools } = createToolRegistry([
      ["officecli", {
        name: "officecli",
        fn: async (args) => {
          receivedArgs = args;
          return "ok";
        },
      }],
    ]);
    wrapToolsPathArgsWithDlp(tools, ["officecli"], {
      readConfig: () => ({ dlp: { mode: "on", pythonPath: process.execPath, scriptPath } }),
      env: { homeDir: dir, projectRoot: dir, rootDir: dir },
      logger: null,
    });

    assert.equal(await defs.get("officecli").fn({ command: `view "${encrypted}" text` }), "ok");
    assert.deepEqual(receivedArgs, { command: ["view", decrypted, "text"] });
  });
});

test("wrapToolsPathArgsWithDlp rewrites unquoted officecli command paths containing spaces", async () => {
  if (process.platform !== "win32") return;
  await withTempDir(async (dir) => {
    const folder = join(dir, "archive folder");
    mkdirSync(folder, { recursive: true });
    const encrypted = join(folder, "technical plan.pptx");
    const decrypted = join(dir, "technical plan.decrypted.pptx");
    await writeFile(encrypted, Buffer.from([0, 0, 0, 0, 1, 2, 3, 4]));
    await writeFile(decrypted, Buffer.from("PK\x03\x04"));
    const scriptPath = await createFakeDlpScript(dir, decrypted);

    let receivedArgs = null;
    const { defs, tools } = createToolRegistry([
      ["officecli", {
        name: "officecli",
        fn: async (args) => {
          receivedArgs = args;
          return "ok";
        },
      }],
    ]);
    wrapToolsPathArgsWithDlp(tools, ["officecli"], {
      readConfig: () => ({ dlp: { mode: "on", pythonPath: process.execPath, scriptPath } }),
      env: { homeDir: dir, projectRoot: dir, rootDir: dir },
      logger: null,
    });

    assert.equal(await defs.get("officecli").fn({ command: `view ${encrypted} text` }), "ok");
    assert.deepEqual(receivedArgs, { command: ["view", decrypted, "text"] });
  });
});

test("wrapToolsPathArgsWithDlp rewrites single-match wildcard officecli command paths", async () => {
  if (process.platform !== "win32") return;
  await withTempDir(async (dir) => {
    const folder = join(dir, "archive folder");
    mkdirSync(folder, { recursive: true });
    const encrypted = join(folder, "NT71880技术认证计划(1).pptx");
    const decrypted = join(dir, "technical plan.decrypted.pptx");
    await writeFile(encrypted, Buffer.from([0, 0, 0, 0, 1, 2, 3, 4]));
    await writeFile(decrypted, Buffer.from("PK\x03\x04"));
    const scriptPath = await createFakeDlpScript(dir, decrypted);

    let receivedArgs = null;
    const { defs, tools } = createToolRegistry([
      ["officecli", {
        name: "officecli",
        fn: async (args) => {
          receivedArgs = args;
          return "ok";
        },
      }],
    ]);
    wrapToolsPathArgsWithDlp(tools, ["officecli"], {
      readConfig: () => ({ dlp: { mode: "on", pythonPath: process.execPath, scriptPath } }),
      env: { homeDir: dir, projectRoot: dir, rootDir: dir },
      logger: null,
    });

    const wildcard = join(folder, "*技术认证计划*.pptx");
    assert.equal(await defs.get("officecli").fn({ command: `view ${wildcard} text` }), "ok");
    assert.deepEqual(receivedArgs, { command: ["view", decrypted, "text"] });
  });
});

test("wrapToolsPathArgsWithDlp rewrites document paths inside shell read commands", async () => {
  if (process.platform !== "win32") return;
  await withTempDir(async (dir) => {
    const folder = join(dir, "archive folder");
    mkdirSync(folder, { recursive: true });
    const encrypted = join(folder, "manual 拐点45nit.pdf");
    const decrypted = join(dir, "manual.decrypted.pdf");
    await writeFile(encrypted, Buffer.from([0, 0, 0, 0, 1, 2, 3, 4]));
    await writeFile(decrypted, Buffer.from("%PDF-1.7"));
    const scriptPath = await createFakeDlpScript(dir, decrypted);

    let receivedArgs = null;
    const { defs, tools } = createToolRegistry([
      ["run_command", {
        name: "run_command",
        fn: async (args) => {
          receivedArgs = args;
          return "ok";
        },
      }],
    ]);
    wrapToolsPathArgsWithDlp(tools, ["run_command"], {
      readConfig: () => ({ dlp: { mode: "on", pythonPath: process.execPath, scriptPath } }),
      env: { homeDir: dir, projectRoot: dir, rootDir: dir },
      logger: null,
    });

    const brokenPath = encrypted.replace(/^([A-Za-z]):\\/, "$1:");
    assert.equal(await defs.get("run_command").fn({ command: `py extract_pdf.py "${brokenPath}"` }), "ok");
    assert.equal(receivedArgs.command, `py extract_pdf.py "${decrypted}"`);
  });
});

test("wrapToolsPathArgsWithDlp rewrites encrypted officecli command array paths", async () => {
  if (process.platform !== "win32") return;
  await withTempDir(async (dir) => {
    const encrypted = join(dir, "deck.pptx");
    const decrypted = join(dir, "deck.decrypted.pptx");
    await writeFile(encrypted, Buffer.from([0, 0, 0, 0, 1, 2, 3, 4]));
    await writeFile(decrypted, Buffer.from("PK\x03\x04"));
    const scriptPath = await createFakeDlpScript(dir, decrypted);

    let receivedArgs = null;
    const { defs, tools } = createToolRegistry([
      ["officecli", {
        name: "officecli",
        fn: async (args) => {
          receivedArgs = args;
          return "ok";
        },
      }],
    ]);
    wrapToolsPathArgsWithDlp(tools, ["officecli"], {
      readConfig: () => ({ dlp: { mode: "on", pythonPath: process.execPath, scriptPath } }),
      env: { homeDir: dir, projectRoot: dir, rootDir: dir },
      logger: null,
    });

    assert.equal(await defs.get("officecli").fn({ command: ["view", encrypted, "text"] }), "ok");
    assert.deepEqual(receivedArgs, { command: ["view", decrypted, "text"] });
  });
});
