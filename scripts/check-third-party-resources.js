#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const resourcesDir = join(root, "src-tauri", "resources");
const manifest = JSON.parse(readFileSync(join(resourcesDir, "runtime-manifest.json"), "utf8"));
const inventory = JSON.parse(readFileSync(join(resourcesDir, "third-party-resources.json"), "utf8"));
const failures = [];
const requiredIds = new Set(["node-runtime", "officecli", "reasonix", "katex", "bootstrap-skills"]);
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
  if (resource.provenanceFile && !existsSync(join(resourcesDir, resource.provenanceFile))) failures.push(`${resource.id}: missing provenance file ${resource.provenanceFile}`);
}
for (const id of requiredIds) failures.push(`required inventory entry is missing: ${id}`);
for (const binary of manifest.artifacts) {
  if (!(inventory.resources ?? []).some((resource) => resource.path === binary.path && resource.sha256 === binary.sha256)) failures.push(`${binary.path}: missing third-party inventory entry`);
}
if (!existsSync(join(resourcesDir, "THIRD_PARTY_NOTICES.md"))) failures.push("THIRD_PARTY_NOTICES.md is missing");

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
if (failures.length) {
  console.error("[third-party] failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`[third-party] ok: ${inventory.resources.length} resources; bootstrap skills ${verifiedSkills} verified, ${partialSkills} partial`);
