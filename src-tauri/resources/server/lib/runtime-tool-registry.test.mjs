import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createRuntimeToolRegistry,
  RUNTIME_REGISTRY_SCHEMA_VERSION,
} from "./runtime-tool-registry.mjs";

async function tempRoot() {
  return mkdtemp(join(tmpdir(), "visionox-runtime-registry-"));
}

test("registry atomically persists tools and environments and reopens them", async () => {
  const root = await tempRoot();
  const registry = createRuntimeToolRegistry({ rootDir: root });
  await registry.open();
  await registry.upsertTool({ id: "python-cpython-3.12-win64", kind: "python", executable: "C:\\Python312\\python.exe", status: "healthy" });
  await registry.upsertEnvironment({ id: "pyenv-pdf", kind: "python", baseToolId: "python-cpython-3.12-win64", status: "healthy", packages: [{ name: "pdfplumber", version: "0.11.9" }] });
  const reopened = createRuntimeToolRegistry({ rootDir: root });
  const snapshot = await reopened.open();
  assert.equal(snapshot.schemaVersion, RUNTIME_REGISTRY_SCHEMA_VERSION);
  assert.equal(reopened.getTool("python-cpython-3.12-win64").status, "healthy");
  assert.equal(reopened.getEnvironment("pyenv-pdf").packages[0].name, "pdfplumber");
  const raw = JSON.parse(await readFile(join(root, "tool-registry.json"), "utf8"));
  assert.equal(raw.schemaVersion, RUNTIME_REGISTRY_SCHEMA_VERSION);
});

test("corrupt registry is backed up and rebuilt instead of throwing", async () => {
  const root = await tempRoot();
  await writeFile(join(root, "tool-registry.json"), "{broken", "utf8");
  const registry = createRuntimeToolRegistry({ rootDir: root });
  const snapshot = await registry.open();
  assert.equal(snapshot.schemaVersion, RUNTIME_REGISTRY_SCHEMA_VERSION);
  assert.equal(snapshot.tools.length, 0);
  const files = await (await import("node:fs/promises")).readdir(root);
  assert.ok(files.some((name) => name.startsWith("tool-registry.json.corrupt-")));
});

test("registry can repair a moved executable without changing the tool identity", async () => {
  const root = await tempRoot();
  const registry = createRuntimeToolRegistry({ rootDir: root });
  await registry.open();
  await registry.upsertTool({ id: "node-runtime", kind: "node", executable: "C:\\old\\node.exe", fingerprint: "sha256:abc", status: "missing" });
  const repaired = await registry.repairToolPath("node-runtime", "C:\\new\\node.exe", { status: "healthy" });
  assert.equal(repaired.id, "node-runtime");
  assert.equal(repaired.executable, "C:\\new\\node.exe");
  assert.equal(repaired.status, "healthy");
});

test("registry marks an installation left in progress by a previous process as interrupted", async () => {
  const root = await tempRoot();
  await writeFile(join(root, "tool-registry.json"), JSON.stringify({ schemaVersion: 1, tools: [], environments: [{ id: "pyenv-half", kind: "python", status: "installing" }] }), "utf8");
  const registry = createRuntimeToolRegistry({ rootDir: root });
  await registry.open();
  assert.equal(registry.getEnvironment("pyenv-half").status, "interrupted");
});

test("concurrent registry updates are serialized without losing records", async () => {
  const root = await tempRoot();
  const registry = createRuntimeToolRegistry({ rootDir: root });
  await registry.open();
  await Promise.all(Array.from({ length: 8 }, (_, index) => registry.upsertTool({ id: `tool-${index}`, kind: "node-module", status: "healthy" })));
  assert.equal(registry.listTools().length, 8);
  assert.equal((await (await import("node:fs/promises")).readdir(join(root, "locks"))).length, 0);
});

test("stale process lock is self-repaired before the next registry write", async () => {
  const root = await tempRoot();
  const lock = join(root, "locks", "tool-registry.lock");
  await mkdir(lock, { recursive: true });
  await writeFile(join(lock, "owner.json"), JSON.stringify({ pid: 2147483647 }), "utf8");
  const registry = createRuntimeToolRegistry({ rootDir: root });
  await registry.open();
  await registry.upsertTool({ id: "node-runtime", kind: "node", status: "healthy" });
  const files = await (await import("node:fs/promises")).readdir(join(root, "locks"));
  assert.equal(files.includes("tool-registry.lock"), false);
});

test("registry queries and removes reusable environments without exposing mutable state", async () => {
  const root = await tempRoot();
  const registry = createRuntimeToolRegistry({ rootDir: root });
  await registry.open();
  await registry.upsertEnvironment({ id: "pyenv-pdf", kind: "python", status: "healthy", requirementsHash: "sha256:pdf", packages: [{ name: "pdfplumber", version: "0.11.9" }] });
  assert.equal(registry.findEnvironment({ kind: "python", requirementsHash: "sha256:pdf", packages: [{ name: "pdfplumber", version: "0.11.9" }] }).id, "pyenv-pdf");
  assert.equal(registry.findAnyEnvironment({ kind: "python" }).id, "pyenv-pdf");
  assert.equal(await registry.removeEnvironment("pyenv-pdf"), true);
  assert.equal(registry.getEnvironment("pyenv-pdf"), null);
  await assert.rejects(() => registry.repairToolPath("missing", "C:\\new\\tool.exe"), /not found/u);
});

test("corrupt central registry rebuilds managed environments from sidecars", async () => {
  const root = await tempRoot();
  const environmentRoot = join(root, "environments", "pyenv-pdf");
  await mkdir(environmentRoot, { recursive: true });
  await writeFile(join(environmentRoot, "runtime-environment.json"), JSON.stringify({
    id: "pyenv-pdf",
    kind: "python",
    root: environmentRoot,
    status: "healthy",
    requirementsHash: "sha256:pdf",
    packages: [{ name: "pdfplumber", version: "0.11.9" }],
  }), "utf8");
  await writeFile(join(root, "tool-registry.json"), "{broken", "utf8");
  const registry = createRuntimeToolRegistry({ rootDir: root });
  const snapshot = await registry.open();
  assert.equal(snapshot.environments[0].id, "pyenv-pdf");
  assert.equal(registry.findEnvironment({ requirementsHash: "sha256:pdf" }).status, "healthy");
  await registry.reload();
  assert.equal(registry.getEnvironment("pyenv-pdf").root, environmentRoot);
});
