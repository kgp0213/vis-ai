#!/usr/bin/env node
/**
 * Guardrail for the vendored reasonix dashboard/API bundles.
 *
 * These files are currently treated as patched source in this repository. A
 * restore from the upstream package can silently remove local fixes, so this
 * script checks the markers that must exist before release builds.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const required = [
  {
    file: "src-tauri/resources/server/launcher.mjs",
    markers: [
      "HIGH_PRIORITY_MEMORY_BLOCK_MAX_CHARS",
      "rememberGeneratedArtifactPath",
      "artifact-created",
      "getGeneratedArtifactPaths",
    ],
  },
  {
    file: "src-tauri/resources/server/lib/system-prompt.mjs",
    markers: [
      "PROJECT_MEMORY_CANDIDATES",
      "\"visionox.md\"",
      "\"CLAUDE.md\"",
    ],
    forbidden: [
      "\".claude/CLAUDE.md\"",
    ],
  },
  {
    file: "src-tauri/resources/server/visionox-pkg/dist/cli/chunk-2K65GZBT.js",
    markers: [
      "\"REASONIX.md\", \"visionox.md\", \"CLAUDE.md\", \"AGENTS.md\", \"AGENT.md\"",
    ],
    forbidden: [
      "\".claude/CLAUDE.md\"",
    ],
  },
  {
    file: "src-tauri/resources/server/visionox-pkg/dist/cli/server-XGDBRWMB.js",
    markers: [
      "function handleArtifacts",
      "ctx.getGeneratedArtifactPaths",
      "collectRecentArtifacts",
      "action === \"recent\"",
      "pick-markdown-file",
      "register-opened-document",
      "function handleClipboardFiles",
    ],
  },
  {
    file: "src-tauri/resources/server/visionox-pkg/dashboard/dist/app.js",
    markers: [
      "function FileArtifactsCard",
      "artifact-created",
      "fileArtifactCandidatesForAssistant",
      "selectedForArtifacts",
      "function FilesPanel",
      "app.tabFiles",
      "data-preview-code-copy",
      "const canOpen = !canPreview",
      "openMarkdownDocumentFromArgs",
      "openMarkdownDocumentByPicker",
      "top-action-md",
    ],
  },
  {
    file: "src-tauri/resources/server/visionox-pkg/dashboard/app.css",
    markers: [
      ".file-artifact-card",
      ".files-panel",
      ".chat-msg-actions",
      "position: static",
      ".top-action",
    ],
  },
];

const failures = [];

for (const check of required) {
  const abs = join(root, check.file);
  if (!existsSync(abs)) {
    failures.push(`${check.file}: missing file`);
    continue;
  }
  const text = readFileSync(abs, "utf8");
  for (const marker of check.markers ?? []) {
    if (!text.includes(marker)) failures.push(`${check.file}: missing marker ${JSON.stringify(marker)}`);
  }
  for (const marker of check.forbidden ?? []) {
    if (text.includes(marker)) failures.push(`${check.file}: forbidden marker ${JSON.stringify(marker)}`);
  }
}

if (failures.length > 0) {
  console.error("[bundle-patches] local bundle patch check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  console.error("");
  console.error("Do not run restore-visionox-pkg.js for normal builds. If the upstream package was restored intentionally, re-apply local patches and run this check again.");
  process.exit(1);
}

console.log("[bundle-patches] ok");
