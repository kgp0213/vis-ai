#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDashboard } from "./build-dashboard.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = join(root, "src-tauri", "resources", "server", "visionox-pkg");
const dashboardRoot = join(packageRoot, "dashboard");
const expectedVersions = {
  esbuild: "0.21.5",
  "highlight.js": "11.11.1",
  htm: "3.1.1",
  marked: "15.0.12",
  preact: "10.29.2",
  typescript: "5.9.3",
  uplot: "1.6.32",
};

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertOfflineDependencies() {
  for (const [name, expected] of Object.entries(expectedVersions)) {
    const manifest = join(packageRoot, "node_modules", ...name.split("/"), "package.json");
    if (!existsSync(manifest)) throw new Error(`offline Dashboard dependency is missing: ${name}`);
    const actual = JSON.parse(readFileSync(manifest, "utf8")).version;
    if (actual !== expected) throw new Error(`Dashboard dependency ${name} must be ${expected}, found ${actual}`);
  }
}

function assertPortableJavascript(value) {
  const text = value.toString("utf8");
  const forbidden = ["sourceMappingURL=", "AppData\\", "AppData/", root.replaceAll("\\", "/"), root];
  const leaked = forbidden.find((marker) => text.includes(marker));
  if (leaked) throw new Error(`generated Dashboard contains non-portable marker: ${leaked}`);
}

export async function checkDashboardBuild() {
  assertOfflineDependencies();
  const first = mkdtempSync(join(tmpdir(), "visionox-dashboard-check-a-"));
  const second = mkdtempSync(join(tmpdir(), "visionox-dashboard-check-b-"));
  try {
    const a = await buildDashboard({ outdir: first });
    const b = await buildDashboard({ outdir: second });
    for (const [name, valueA, valueB, canonical] of [
      ["dist/app.js", a.appJs, b.appJs, join(dashboardRoot, "dist", "app.js")],
      ["app.css", a.appCss, b.appCss, join(dashboardRoot, "app.css")],
    ]) {
      if (!valueA.equals(valueB)) throw new Error(`${name} is not deterministic`);
      const committed = readFileSync(canonical);
      if (!valueA.equals(committed)) {
        throw new Error(`${name} is stale: generated ${sha256(valueA)}, committed ${sha256(committed)}`);
      }
    }
    assertPortableJavascript(a.appJs);
    console.log(`[dashboard-build] verified ${sha256(a.appJs).slice(0, 12)} ${sha256(a.appCss).slice(0, 12)}`);
  } finally {
    rmSync(first, { recursive: true, force: true });
    rmSync(second, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await checkDashboardBuild();
}
