import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import {
  createPreparedDocumentRegistry,
  DlpDecryptError,
  getDlpConfig,
  latestPreparedDocumentRef,
  prepareLocalDocument,
  prepareLocalDocuments,
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

async function createRegeneratingDlpScript(dir, decryptedPath) {
  const scriptPath = join(dir, "regenerating-visionox-file.mjs");
  await writeFile(scriptPath, [
    'import { writeFileSync } from "node:fs";',
    "const src = process.argv[2];",
    `const dst = ${JSON.stringify(decryptedPath)};`,
    "const name = src.split(/[\\\\/]/).pop();",
    "writeFileSync(dst, Buffer.from('%PDF-1.7 regenerated'));",
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

test("latestPreparedDocumentRef returns the newest prepared document of the requested kind", () => {
  const registry = createPreparedDocumentRegistry();
  registry.register({ sourcePath: "C:\\old.txt", readablePath: "C:\\old.txt", documentKind: "text", updatedAt: "2026-01-01T00:00:00.000Z" });
  registry.register({ sourcePath: "C:\\new.pdf", readablePath: "C:\\new.pdf", documentKind: "pdf", updatedAt: "2026-01-02T00:00:00.000Z" });
  assert.match(latestPreparedDocumentRef(registry, "pdf"), /^visionox-document:doc_/);
  assert.equal(latestPreparedDocumentRef(registry, "spreadsheet"), null);
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

test("resolveDlpScriptPath prefers the bundled script over a stale user skill copy", async () => {
  await withTempDir(async (dir) => {
    const homeDir = join(dir, "home");
    const serverDir = join(dir, "server");
    const userScript = join(homeDir, ".visionox", "skills", "visionox-file", "visionox_file.py");
    const bundledScript = join(serverDir, "visionox-file", "visionox_file.py");
    mkdirSync(resolve(userScript, ".."), { recursive: true });
    mkdirSync(resolve(bundledScript, ".."), { recursive: true });
    writeFileSync(userScript, "print('stale')", "utf8");
    writeFileSync(bundledScript, "print('bundled')", "utf8");

    assert.equal(resolve(resolveDlpScriptPath({}, { homeDir, serverDir })), resolve(bundledScript));
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

test("prepareLocalDocuments prepares a deduplicated source collection without changing single-document behavior", async () => {
  await withTempDir(async (dir) => {
    const first = join(dir, "first.md");
    const second = join(dir, "second.html");
    await writeFile(first, "# First\n", "utf8");
    await writeFile(second, "<h1>Second</h1>", "utf8");
    const options = {
      cfg: { dlp: { mode: "off" } },
      env: { homeDir: dir, projectRoot: dir, rootDir: dir },
      logger: null,
      registry: createPreparedDocumentRegistry(),
    };

    const collection = await prepareLocalDocuments([first, second, first], options);
    assert.equal(collection.ok, true);
    assert.equal(collection.documentKind, "collection");
    assert.equal(collection.sourceCount, 2);
    assert.deepEqual(collection.sourcePaths.map((path) => resolve(path)), [resolve(first), resolve(second)]);
    assert.equal(collection.sources.length, 2);
    assert.ok(collection.sources.every((source) => typeof source.documentKind === "string" && source.documentKind.length > 0));

    const single = await prepareLocalDocuments([first], options);
    assert.notEqual(single.documentKind, "collection");
    assert.equal(single.sources, undefined);
  });
});

test("managed documents recover a missing readable copy across tools and registry restore", async () => {
  if (process.platform !== "win32") return;
  await withTempDir(async (dir) => {
    const source = join(dir, "（20260714）加密 说明书.pdf");
    const readable = join(dir, "prepared copy.pdf");
    await writeFile(source, Buffer.from([0, 0, 0, 0, 1, 2, 3, 4]));
    const scriptPath = await createRegeneratingDlpScript(dir, readable);
    const registry = createPreparedDocumentRegistry();
    const options = {
      cfg: { dlp: { mode: "on", pythonPath: process.execPath, scriptPath } },
      env: { homeDir: dir, projectRoot: dir, rootDir: dir },
      logger: null,
      registry,
    };

    const prepared = await prepareLocalDocument(source, options);
    assert.match(prepared.documentId, /^doc_[a-f0-9]{20}$/);
    assert.equal(prepared.documentRef, `visionox-document:${prepared.documentId}`);
    assert.equal(resolve(prepared.readablePath), resolve(readable));
    assert.equal(registry.snapshot().length, 1);

    await rm(readable, { force: true });
    let receivedArgs = null;
    const { defs, tools } = createToolRegistry([["run_command", {
      name: "run_command",
      fn: async (args) => {
        receivedArgs = args;
        return "ok";
      },
    }]]);
    wrapToolsPathArgsWithDlp(tools, ["run_command"], {
      readConfig: () => options.cfg,
      env: options.env,
      logger: null,
      registry,
    });

    assert.equal(await defs.get("run_command").fn({ command: `python extract.py "${prepared.readablePath}"` }), "ok");
    assert.equal(receivedArgs.command, `python extract.py "${readable}"`);
    assert.equal(existsSync(readable), true);

    const restored = createPreparedDocumentRegistry();
    restored.restore(registry.snapshot());
    await rm(readable, { force: true });
    const resumed = await prepareLocalDocument(prepared.documentRef, { ...options, registry: restored });
    assert.equal(resumed.documentId, prepared.documentId);
    assert.equal(resolve(resumed.sourcePath), resolve(source));
    assert.equal(resolve(resumed.readablePath), resolve(readable));
    assert.equal(existsSync(readable), true);
  });
});

test("launcher shares managed document references without exposing the retired PDF organizer", () => {
  const launcher = readFileSync(new URL("../launcher.mjs", import.meta.url), "utf8");
  const pdfText = readFileSync(new URL("../lib/pdf-text.mjs", import.meta.url), "utf8");
  const dlp = readFileSync(new URL("../lib/dlp-file.mjs", import.meta.url), "utf8");
  const bundledLoop = readFileSync(new URL("../visionox-pkg/dist/cli/chunk-2R4QCDOZ.js", import.meta.url), "utf8");
  const bundledIndex = readFileSync(new URL("../visionox-pkg/dist/index.js", import.meta.url), "utf8");
  assert.match(launcher, /createPreparedDocumentRegistry\(\{[\s\S]*?writeActiveSessionMeta\(\{ preparedDocuments \}\)/);
  assert.match(launcher, /preparedDocumentRegistry\.restore\(meta\.preparedDocuments/);
  assert.match(launcher, /preparedDocumentRegistry\.restore\(sessionMeta\.preparedDocuments/);
  assert.doesNotMatch(launcher, /name:\s*"extract_pdf_text"/);
  assert.doesNotMatch(launcher, /MAX_DOCUMENT_AUTO_CONTINUATIONS|parsePdfDeliveryResult|updatePdfContinuationState|documentAutoContinuationPrompt|pdfContinuationStates/);
  assert.match(pdfText, /export async function extractPdfText\(/);
  assert.doesNotMatch(dlp, /extract_pdf_text/);
  assert.doesNotMatch(bundledLoop, /extract_pdf_text/);
  assert.doesNotMatch(bundledIndex, /extract_pdf_text/);
  assert.doesNotMatch(launcher, /registerPdfMarkdownWorkflowTool\(tools/);
  assert.doesNotMatch(launcher, /name:\s*"organize_pdf_to_markdown"/);
  assert.match(launcher, /name: "read_context_input"[\s\S]*?contextInputTransactions\.readInput/);
  assert.match(launcher, /kind: "document-progress"/);
  assert.match(launcher, /wrapReadFileToolWithDlp[\s\S]*?registry: preparedDocumentRegistry/);
  assert.match(launcher, /wrapToolsPathArgsWithDlp\(tools, registeredNames[\s\S]*?registry: preparedDocumentRegistry/);
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

test("wrapToolsPathArgsWithDlp pre-splits a managed OfficeCLI path containing spaces and parentheses", async () => {
  await withTempDir(async (dir) => {
    const source = join(dir, "NT71880 技术认证计划 (1).pptx");
    await writeFile(source, Buffer.from("PK\x03\x04"));
    const registry = createPreparedDocumentRegistry();
    registry.register({ sourcePath: source, readablePath: source, encrypted: false });

    let receivedArgs = null;
    const { defs, tools } = createToolRegistry([["officecli", {
      name: "officecli",
      fn: async (args) => {
        receivedArgs = args;
        return "ok";
      },
    }]]);
    wrapToolsPathArgsWithDlp(tools, ["officecli"], {
      readConfig: () => ({ dlp: { mode: "on" } }),
      env: { homeDir: dir, projectRoot: dir, rootDir: dir },
      logger: null,
      registry,
    });

    assert.equal(await defs.get("officecli").fn({ command: `view "${source}" text` }), "ok");
    assert.deepEqual(receivedArgs, { command: ["view", source, "text"] });

    receivedArgs = null;
    assert.equal(await defs.get("officecli").fn({ command: `view ${source} text` }), "ok");
    assert.deepEqual(receivedArgs, { command: ["view", source, "text"] });
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
