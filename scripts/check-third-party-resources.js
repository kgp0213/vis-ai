#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const resourcesDir = join(root, "src-tauri", "resources");
const manifest = JSON.parse(readFileSync(join(resourcesDir, "runtime-manifest.json"), "utf8"));
const inventory = JSON.parse(readFileSync(join(resourcesDir, "third-party-resources.json"), "utf8"));
const reasonixPackage = JSON.parse(readFileSync(join(resourcesDir, "server", "visionox-pkg", "package.json"), "utf8"));
const pdfjsPackage = JSON.parse(readFileSync(join(resourcesDir, "server", "visionox-pkg", "node_modules", "pdfjs-dist", "package.json"), "utf8"));
const canvasPackage = JSON.parse(readFileSync(join(resourcesDir, "server", "visionox-pkg", "node_modules", "@napi-rs", "canvas", "package.json"), "utf8"));
const failures = [];
const requiredIds = new Set(["node-runtime", "officecli", "dws", "reasonix", "katex", "bootstrap-skills"]);
const binaryByPath = new Map(manifest.artifacts.map((item) => [item.path, item]));
for (const resource of inventory.resources ?? []) {
  if (!resource.id || !resource.path || !resource.version || !resource.source || !resource.license) failures.push(`incomplete inventory entry: ${resource.id || "unknown"}`);
  else requiredIds.delete(resource.id);
  if (resource.path && !existsSync(join(resourcesDir, resource.path))) failures.push(`${resource.id}: resource path is missing: ${resource.path}`);
  if (resource.sha256) {
    const binary = binaryByPath.get(resource.path);
    if (!binary) failures.push(`${resource.id}: binary is missing from runtime-manifest.json`);
    else if (binary.version !== resource.version || binary.sha256 !== resource.sha256) failures.push(`${resource.id}: version or SHA-256 differs from runtime manifest`);
  }
  if (resource.licenseFile && !existsSync(join(resourcesDir, resource.licenseFile))) failures.push(`${resource.id}: missing license file ${resource.licenseFile}`);
  if (resource.noticeFile && !existsSync(join(resourcesDir, resource.noticeFile))) failures.push(`${resource.id}: missing notice file ${resource.noticeFile}`);
  if (resource.provenanceFile && !existsSync(join(resourcesDir, resource.provenanceFile))) failures.push(`${resource.id}: missing provenance file ${resource.provenanceFile}`);
}
for (const id of requiredIds) failures.push(`required inventory entry is missing: ${id}`);
const reasonixResource = (inventory.resources ?? []).find((resource) => resource.id === "reasonix");
if (reasonixResource?.version !== reasonixPackage.version) failures.push("reasonix package version differs from the third-party inventory");
const pdfjsResource = (inventory.resources ?? []).find((resource) => resource.id === "pdfjs-dist");
if (pdfjsResource?.version !== pdfjsPackage.version || reasonixPackage.dependencies?.["pdfjs-dist"] !== pdfjsPackage.version) failures.push("PDF.js package version differs from the third-party inventory or runtime dependency");
const canvasResource = (inventory.resources ?? []).find((resource) => resource.id === "napi-rs-canvas");
if (canvasResource?.version !== canvasPackage.version || reasonixPackage.dependencies?.["@napi-rs/canvas"] !== canvasPackage.version) failures.push("@napi-rs/canvas version differs from the third-party inventory or runtime dependency");
for (const binary of manifest.artifacts) {
  if (!(inventory.resources ?? []).some((resource) => resource.path === binary.path && resource.sha256 === binary.sha256)) failures.push(`${binary.path}: missing third-party inventory entry`);
}
const noticesPath = join(resourcesDir, "THIRD_PARTY_NOTICES.md");
if (!existsSync(noticesPath)) failures.push("THIRD_PARTY_NOTICES.md is missing");
else if (!readFileSync(noticesPath, "utf8").includes(`Version: ${reasonixPackage.version}`)) failures.push("reasonix package version differs from THIRD_PARTY_NOTICES.md");

const skillRoot = join(resourcesDir, "bootstrap-skills");
const skillProvenance = JSON.parse(readFileSync(join(resourcesDir, "bootstrap-skills-provenance.json"), "utf8"));
const actualSkills = new Set(readdirSync(skillRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name));
const declaredSkills = new Set();
let verifiedSkills = 0;
let partialSkills = 0;
for (const group of skillProvenance.groups ?? []) {
  if (!group.id || !group.source || !group.license || !["verified", "partial"].includes(group.status) || !Array.isArray(group.skills) || group.skills.length === 0) {
    failures.push(`invalid bootstrap skill provenance group: ${group.id || "unknown"}`);
    continue;
  }
  if (group.licenseFile && !existsSync(join(resourcesDir, group.licenseFile))) failures.push(`${group.id}: missing skill license file ${group.licenseFile}`);
  for (const skill of group.skills) {
    if (declaredSkills.has(skill)) failures.push(`bootstrap skill has duplicate provenance: ${skill}`);
    declaredSkills.add(skill);
    if (!actualSkills.has(skill)) failures.push(`bootstrap skill provenance references a missing directory: ${skill}`);
    if (group.status === "verified") verifiedSkills++;
    else partialSkills++;
  }
}
for (const skill of actualSkills) if (!declaredSkills.has(skill)) failures.push(`bootstrap skill is missing provenance: ${skill}`);

const dwsSkillRoot = join(skillRoot, "dws");
const requiredDwsFiles = [
  "SKILL.md",
  "integration.json",
  "scripts/dws-json.mjs",
  "references/upstream/README.md",
  "references/upstream/global-reference.md",
  "references/upstream/products/chat.md",
  "references/upstream/products/contact.md",
  "references/upstream/products/calendar.md",
  "references/upstream/products/todo.md",
  "references/upstream/products/oa.md",
  "references/upstream/products/report.md",
  "references/upstream/products/minutes.md",
];
for (const path of requiredDwsFiles) {
  if (!existsSync(join(dwsSkillRoot, path))) failures.push(`dws: missing packaged Skill resource ${path}`);
}

function checkDwsTree(path, relative = "") {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
    const child = join(path, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.toLowerCase() === ".dws") failures.push(`dws: portable user-state directory is forbidden: ${childRelative}`);
      checkDwsTree(child, childRelative);
      continue;
    }
    if (/^(?:identity\.json|app\.json|dws\.log)$/i.test(entry.name) || /\.(?:exe|bat|py)$/i.test(entry.name)) {
      failures.push(`dws: portable runtime/user file is forbidden in the Skill: ${childRelative}`);
    }
    if (/\.(?:md|mjs|json)$/i.test(entry.name)) {
      const content = readFileSync(child, "utf8");
      if (/D:\\V-ABC|C:\\Users\\Lenovo/i.test(content)) failures.push(`dws: development-machine path leaked into ${childRelative}`);
    }
  }
}
if (existsSync(dwsSkillRoot)) checkDwsTree(dwsSkillRoot);
if (failures.length) {
  console.error("[third-party] failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`[third-party] ok: ${inventory.resources.length} resources; bootstrap skills ${verifiedSkills} verified, ${partialSkills} partial`);
