import test from "node:test";
import assert from "node:assert/strict";
import { resolveLocalRuntimeCapability } from "./runtime-local-capability.mjs";

test("local Python resolver skips incompatible 3.14 and reuses healthy 3.12 packages", async () => {
  const registry = { listTools: () => [
    { id: "python-3-14", kind: "python", version: "3.14.0", executable: "C:\\Python314\\python.exe", status: "healthy" },
    { id: "python-3-12", kind: "python", version: "3.12.12", executable: "C:\\Python312\\python.exe", status: "healthy" },
  ] };
  const result = await resolveLocalRuntimeCapability({ id: "pdf", kind: "python", versionRange: ">=3.10,<3.14", packages: [{ name: "pdfplumber", version: "0.11.9", importName: "pdfplumber" }] }, { registry, probePython: async (tool, pkg) => tool.id === "python-3-12" && pkg.name === "pdfplumber" });
  assert.equal(result.baseToolId, "python-3-12");
  assert.equal(result.status, "healthy");
  assert.equal(result.bindings.VISIONOX_PYTHON, "C:\\Python312\\python.exe");
});

test("local Node resolver reuses packaged node_modules only when every package is present", async () => {
  const registry = { listTools: () => [
    { id: "node-runtime", kind: "node", version: "v25.2.1", executable: "C:\\Visionox\\node.exe", status: "healthy" },
    { id: "pdfjs-dist", kind: "node-module", version: "5.4.296", root: "C:\\Visionox\\node_modules\\pdfjs-dist", status: "healthy", metadata: { moduleRoot: "C:\\Visionox\\node_modules" } },
  ] };
  const result = await resolveLocalRuntimeCapability({ id: "pdf-node", kind: "node", packages: [{ name: "pdfjs-dist", version: "5.4.296" }] }, { registry });
  assert.equal(result.status, "healthy");
  assert.equal(result.bindings.NODE_PATH, "C:\\Visionox\\node_modules");
  assert.equal(result.bindings.VISIONOX_NODE, "C:\\Visionox\\node.exe");
});
