import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const typescript = require("../visionox-pkg/node_modules/typescript/lib/typescript.js");

async function loadSafety() {
  const source = await readFile(new URL("../visionox-pkg/dashboard/src/lib/chat-display-safety.ts", import.meta.url), "utf8");
  const output = typescript.transpileModule(source, {
    compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 },
    fileName: "chat-display-safety.ts",
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output, "utf8").toString("base64")}`);
}

test("redacts credentials while preserving useful failure context", async () => {
  const { redactSensitiveDisplayText, redactTechnicalMessages, safeTechnicalDisplayText } = await loadSafety();
  const value = redactSensitiveDisplayText("HTTP 401 Authorization: Bearer super-secret-token; apiKey=ark-12345678901234567890; retryable=true");
  assert.match(value, /HTTP 401/);
  assert.match(value, /retryable=true/);
  assert.doesNotMatch(value, /super-secret-token/);
  assert.doesNotMatch(value, /ark-12345678901234567890/);

  const messages = redactTechnicalMessages([
    "first api_key=secret-one",
    "second",
    "third",
    "fourth",
    "fifth",
    "sixth",
    "seventh",
    "eighth",
    "ninth",
  ], { maxItems: 8 });
  assert.equal(messages.length, 8);
  assert.match(messages[0], /\[redacted\]/i);

  const json = redactSensitiveDisplayText('{"password":"hunter2","apiKey":"short-key","ok":true}');
  assert.doesNotMatch(json, /hunter2|short-key/);
  assert.match(json, /"password":"\[redacted\]"/);
  assert.match(json, /"apiKey":"\[redacted\]"/);

  const structured = safeTechnicalDisplayText({ error: 'Authorization: Bearer still-secret', detail: 'retryable' });
  assert.doesNotMatch(structured, /still-secret/);
  assert.match(structured, /retryable/);
});
