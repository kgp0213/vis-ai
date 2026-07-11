#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tauri = join(root, "src-tauri");
const releaseDir = join(tauri, "target", "release");
const sourceResources = join(tauri, "resources");
const releaseResources = join(releaseDir, "resources");
const runtimePackage = resolve(process.env.VISIONOX_RUNTIME_PACKAGE || "");
const tempRelative = relative(resolve(tmpdir()), runtimePackage);
if (!process.env.VISIONOX_RUNTIME_PACKAGE || !tempRelative || tempRelative.startsWith("..") || isAbsolute(tempRelative)) {
  throw new Error("VISIONOX_RUNTIME_PACKAGE must point to a child of the system temporary directory");
}
const expected = new Map();

function normalize(path) {
  return path.replaceAll("\\", "/");
}

function addFile(source, destination) {
  if (!existsSync(source) || !statSync(source).isFile()) {
    throw new Error(`missing source resource: ${source}`);
  }
  expected.set(normalize(destination), source);
}

function addDirectory(source, destination) {
  if (!existsSync(source) || !statSync(source).isDirectory()) {
    throw new Error(`missing source resource directory: ${source}`);
  }
  for (const name of readdirSync(source).sort()) {
    const child = join(source, name);
    const target = join(destination, name);
    if (statSync(child).isDirectory()) addDirectory(child, target);
    else addFile(child, target);
  }
}

function sha256(path) {
  const hash = createHash("sha256");
  if (!existsSync(path) || !statSync(path).isFile()) throw new Error(`missing release resource: ${path}`);
  hash.update(readFileSync(path));
  return hash.digest("hex");
}

addDirectory(runtimePackage, "server/visionox-pkg");
addFile(join(sourceResources, "server", "launcher.mjs"), "server/launcher.mjs");
addDirectory(join(sourceResources, "server", "lib"), "server/lib");
for (const name of ["learn.mjs", "learn-track.mjs", "learn-sandbox-impl.mjs", "node.exe", "officecli.exe"]) {
  addFile(join(sourceResources, "server", name), `server/${name}`);
}
addDirectory(join(sourceResources, "server", "visionox-file"), "server/visionox-file");
addFile(join(sourceResources, "default-soul.md"), "default-soul.md");
addDirectory(join(sourceResources, "ecc-rules"), "ecc-rules");
addFile(join(sourceResources, "skill-creation-guide.md"), "skill-creation-guide.md");
addDirectory(join(sourceResources, "bootstrap-skills"), "bootstrap-skills");

const actual = new Set();
function collectRelease(path) {
  if (!existsSync(path)) throw new Error(`release resource directory is missing: ${path}`);
  for (const name of readdirSync(path).sort()) {
    const child = join(path, name);
    if (statSync(child).isDirectory()) collectRelease(child);
    else actual.add(normalize(relative(releaseResources, child)));
  }
}
collectRelease(releaseResources);

const failures = [];
if (!existsSync(join(releaseDir, "visionox-whale.exe"))) failures.push("missing: visionox-whale.exe");
if (existsSync(join(releaseDir, "visionox-desktop.exe"))) failures.push("unexpected legacy executable: visionox-desktop.exe");
for (const [destination, source] of expected) {
  const release = join(releaseResources, destination);
  if (!actual.has(destination)) {
    failures.push(`missing: ${destination}`);
    continue;
  }
  if (sha256(source) !== sha256(release)) failures.push(`content mismatch: ${destination}`);
}
for (const path of actual) {
  if (!expected.has(path)) failures.push(`unexpected: ${path}`);
}

if (failures.length > 0) {
  console.error("[release-resources] verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`[release-resources] verified ${expected.size} files against staged/source resources`);
