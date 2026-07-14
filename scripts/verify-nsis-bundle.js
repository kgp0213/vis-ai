#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { writeReleaseManifest } from "./release-manifest.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const productName = JSON.parse(readFileSync(join(root, "src-tauri", "tauri.conf.json"), "utf8")).productName;
const binaryName = "visionox-whale.exe";
const installer = join(
  root,
  "src-tauri",
  "target",
  "release",
  "bundle",
  "nsis",
  `${productName}_${version}_x64-setup.exe`,
);
const releaseExe = join(root, "src-tauri", "target", "release", binaryName);
const releaseResources = join(root, "src-tauri", "target", "release", "resources");

function fail(message) {
  console.error(`[verify-nsis] ${message}`);
  process.exit(1);
}

function digest(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function collectFiles(base) {
  const files = new Map();
  function walk(path) {
    for (const name of readdirSync(path).sort()) {
      const child = join(path, name);
      if (statSync(child).isDirectory()) walk(child);
      else files.set(relative(base, child).replaceAll("\\", "/"), child);
    }
  }
  walk(base);
  return files;
}

function find7zip() {
  const candidates = [
    process.env.SEVEN_ZIP,
    "7z",
    process.platform === "win32" ? "C:\\Program Files\\7-Zip\\7z.exe" : null,
    process.platform === "win32" ? "C:\\Program Files (x86)\\7-Zip\\7z.exe" : null,
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.includes("\\") && !existsSync(candidate)) continue;
    const probe = spawnSync(candidate, ["i"], { stdio: "ignore", windowsHide: true });
    if (!probe.error && probe.status === 0) return candidate;
  }
  fail("7-Zip was not found; install it or set SEVEN_ZIP to 7z.exe");
}

function replaceBundleMarker(packed, release) {
  const unknown = Buffer.from("__TAURI_BUNDLE_TYPE_VAR_UNK");
  const nsis = Buffer.from("__TAURI_BUNDLE_TYPE_VAR_NSS");
  const releaseIndex = release.indexOf(unknown);
  if (
    releaseIndex < 0
    || !packed.subarray(releaseIndex, releaseIndex + nsis.length).equals(nsis)
  ) {
    fail("desktop executable does not contain the expected Tauri UNK -> NSS bundle marker");
  }
  if (release.indexOf(unknown, releaseIndex + 1) >= 0) {
    fail("release desktop executable contains duplicate Tauri UNK bundle markers");
  }
  const normalized = Buffer.from(packed);
  unknown.copy(normalized, releaseIndex);
  return normalized;
}

for (const path of [installer, releaseExe, releaseResources]) {
  if (!existsSync(path)) fail(`missing build input: ${path}`);
}

const sevenZip = find7zip();
const temp = mkdtempSync(join(tmpdir(), "visionox-nsis-verify-"));

try {
  const extracted = spawnSync(
    sevenZip,
    ["x", "-y", `-o${temp}`, installer],
    { encoding: "utf8", windowsHide: true },
  );
  if (extracted.status !== 0) {
    fail(`7-Zip extraction failed: ${(extracted.stderr || extracted.stdout || "unknown error").trim()}`);
  }

  const packedResources = join(temp, "resources");
  if (!existsSync(packedResources)) fail("installer is missing the resources directory");
  const expectedFiles = collectFiles(releaseResources);
  const packedFiles = collectFiles(packedResources);
  const failures = [];
  const criticalDwsResources = [
    "server/dws.exe",
    "DWS_LICENSE.txt",
    "DWS_NOTICE.txt",
    "bootstrap-skills/dws/SKILL.md",
    "bootstrap-skills/dws/integration.json",
    "bootstrap-skills/dws/scripts/dws-json.mjs",
    "bootstrap-skills/dws/references/upstream/README.md",
    "bootstrap-skills/dws/references/upstream/products/chat.md",
  ];
  for (const path of criticalDwsResources) {
    if (!packedFiles.has(path)) failures.push(`missing critical DWS resource: ${path}`);
  }
  for (const [path, expected] of expectedFiles) {
    const packed = packedFiles.get(path);
    if (!packed) {
      failures.push(`missing resource: ${path}`);
      continue;
    }
    if (digest(readFileSync(packed)) !== digest(readFileSync(expected))) {
      failures.push(`resource hash mismatch: ${path}`);
    }
  }
  for (const path of packedFiles.keys()) {
    if (!expectedFiles.has(path)) failures.push(`unexpected resource: ${path}`);
    if (/(?:^|\/)\.dws(?:\/|$)|(?:^|\/)(?:identity\.json|app\.json|dws\.log)$/i.test(path)) failures.push(`forbidden DWS user state: ${path}`);
    if (/^bootstrap-skills\/dws\/.*\.(?:exe|bat|py)$/i.test(path)) failures.push(`forbidden portable DWS file: ${path}`);
    if (/^(?:bootstrap-skills\/dws\/|server\/lib\/dws-|server\/launcher\.mjs)/i.test(path)) {
      const content = readFileSync(packedFiles.get(path), "utf8");
      if (/D:\\V-ABC|C:\\Users\\Lenovo/i.test(content)) failures.push(`development-machine path leaked into installer: ${path}`);
    }
  }
  if (failures.length > 0) {
    for (const failure of failures) console.error(`[verify-nsis] ${failure}`);
    fail(`installer resource tree differs from release (${failures.length} failures)`);
  }
  console.log(`[verify-nsis] ok resources: ${expectedFiles.size} files match release SHA256`);

  const packedExe = readFileSync(join(temp, binaryName));
  const release = readFileSync(releaseExe);
  const normalizedExe = replaceBundleMarker(packedExe, release);
  if (!normalizedExe.equals(release)) {
    fail("installer desktop executable differs from the release executable beyond the Tauri NSS bundle marker");
  }
  console.log(`[verify-nsis] ok ${binaryName}: expected Tauri UNK -> NSS marker only`);
  console.log(`[verify-nsis] verified ${installer}`);
  writeReleaseManifest({ root, releaseVerified: true, includeNsis: true, nsisVerified: true });
} finally {
  rmSync(temp, { recursive: true, force: true });
}
