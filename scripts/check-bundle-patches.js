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
    file: "scripts/prepare-runtime-package.js",
    markers: [
      "function pruneRuntimeFiles(path)",
      "npm prune --offline",
      "VISIONOX_RUNTIME_PACKAGE",
      "system temporary directory",
      'for (const dir of ["dist", "data", "node_modules"])',
      "forbiddenRuntimeFile",
      '"dashboard/katex-support.js"',
      'copyDirectory(join("dashboard", "vendor", "katex"))',
    ],
  },
  {
    file: "scripts/run-tauri-build.js",
    markers: ["CARGO_NET_OFFLINE", "CARGO_TARGET_DIR", "npm_config_offline", "mkdtempSync", "visionox-release-", "resourceOverride", "verify-runtime-manifest.js", "verify-release-resources.js"],
  },
  {
    file: "scripts/verify-release-resources.js",
    markers: ["visionox-whale.exe", "runtime-manifest.json", "unexpected legacy executable", "content mismatch", "unexpected:", "verified ${expected.size} files"],
  },
  {
    file: "scripts/check-build-entrypoints.js",
    markers: ["validateBuildEntrypoints", "generic tauri entrypoint must be disabled", "bypasses the canonical release wrapper"],
  },
  {
    file: "scripts/check-api-contracts.js",
    markers: ["assertApiContract", "validateSchema", "unknown API contract"],
  },
  {
    file: "scripts/check-test-structure.js",
    markers: ["move new coverage to a domain test file", "requiredDomainTests", "dashboard-regression.test.mjs"],
  },
  {
    file: "scripts/verify-runtime-manifest.js",
    markers: ["runtime-manifest.json", "SHA-256 mismatch", "size mismatch", "verified ${manifest.artifacts.length} artifacts"],
  },
  {
    file: "scripts/verify-nsis-bundle.js",
    markers: ["collectFiles", "unexpected resource", "expectedFiles.size", "replaceBundleMarker"],
  },
  {
    file: "src-tauri/resources/server/launcher.mjs",
    markers: [
      "HIGH_PRIORITY_MEMORY_BLOCK_MAX_CHARS",
      "rememberGeneratedArtifactPath",
      "artifact-created",
      "getGeneratedArtifactPaths",
      "parseActiveSessionJsonl",
      "rebuildLoopPreservingContext",
      "promptQueueFile",
      "acceptedPromptRequest",
      "pendingModelSwitch",
      "requestModelSwitch",
      "rebuildProviderContextCaps",
      "contextCapacitySource",
      "beginActiveOperation",
      "jobs.stopOwned",
      "scheduleRunControllers",
      "REPORT_COLLECTION_MAX_CHARS",
      "appendAuditEntry",
      "pendingPlanRevision",
      "const queuedModals = []",
      "activeGateId !== gateId",
      "decidePlanContinuation",
      "MAX_PLAN_AUTO_CONTINUATIONS = 2",
      'kind: "plan-continuation-needed"',
      "activatePendingPlan",
      "validateOfficecliInvocation",
      "wrapMcpToolsWithRecovery",
      "getMemoryRuntimeStatus",
      "moveModeMemory",
      "batchModeMemory",
      "restoreModeMemoryTrash",
      "migrateConfigFile",
    ],
  },
  {
    file: "src-tauri/resources/server/lib/config-migrations.mjs",
    markers: [
      "CURRENT_CONFIG_SCHEMA_VERSION",
      "writeOnceAtomic",
      "configSchemaMigratedAt",
      'status: "backup-error"',
      'status: "newer-version"',
    ],
  },
  {
    file: "src-tauri/resources/server/lib/session-trash.mjs",
    markers: [
      "createSessionTrashStore",
      "invalid restored session path",
      "session file already exists",
      "expired session trash removed",
      "retentionDays must be between 1 and 365",
    ],
  },
  {
    file: "src-tauri/resources/server/lib/user-data-backup.mjs",
    markers: [
      "createUserDataBackupStore",
      "unsupported backup manifest",
      "backup integrity check failed",
      "backupDir inside dataDir must be the backups/snapshots directory",
      "healthCache",
    ],
  },
  {
    file: "src-tauri/resources/server/lib/versioned-json-file.mjs",
    markers: ["readVersionedJsonFile", "assertVersionedJsonWritable", "unsupported schema version", "original file was not modified"],
  },
  {
    file: "src-tauri/resources/server/lib/prompt-queue-store.mjs",
    markers: ["createPromptQueueStore", "original prompt queue was not modified", "acceptedRequest", "rememberAccepted"],
  },
  {
    file: "src-tauri/resources/server/lib/plan-store.mjs",
    markers: [
      "createPlanStore",
      "atomicWriteFileSync",
      "active plan is invalid and was not modified",
      "archivePlanState",
      "listAllPlanArchives",
    ],
  },
  {
    file: "src-tauri/resources/server/lib/schedule-store.mjs",
    markers: ["readScheduleStore", "writeScheduleStore", "commitScheduleMutation", "unsupported schedule schema version"],
  },
  {
    file: "src-tauri/resources/server/lib/schedule-policy.mjs",
    markers: ["computeNextScheduleRun", "isScheduleAllowedAt", "isValidRunWindow", "MAX_SCHEDULE_INTERVAL_MS"],
  },
  {
    file: "src-tauri/resources/server/lib/system-prompt.mjs",
    markers: [
      "PROJECT_MEMORY_CANDIDATES",
      '"AGENTS.md"',
      "\"visionox.md\"",
      "\"CLAUDE.md\"",
      "in any work mode",
    ],
    forbidden: [
      "\".claude/CLAUDE.md\"",
      "\"REASONIX.md\"",
    ],
  },
  {
    file: "src-tauri/resources/server/learn.mjs",
    markers: ['return join(rootDir, "visionox.md")'],
    forbidden: ['join(rootDir, "REASONIX.md")'],
  },
  {
    file: "src-tauri/resources/server/visionox-pkg/dist/cli/chunk-2K65GZBT.js",
    markers: [
      '"AGENTS.md", "AGENT.md", "agent.md", "CLAUDE.md", "claude.md", "visionox.md"',
      "function listProjectMemoryPaths",
      "function readProjectMemories",
      "PROJECT_MEMORY_TOTAL_MAX_CHARS",
    ],
    forbidden: [
      "\".claude/CLAUDE.md\"",
      "\"REASONIX.md\"",
    ],
  },
  {
    file: "src-tauri/resources/server/visionox-pkg/dist/cli/chunk-XPDVG52A.js",
    markers: [
      "_configCache.ctimeMs === fileStat.ctimeMs",
      "size: fileStat.size, parsed: cfg",
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
      "function handlePromptQueue",
      "requestId: typeof requestId",
      "modelSwitch",
      "must declare a positive integer maxContextLength",
      "function handleBackgroundJobs",
      "readTranscriptPage",
      "writeTranscriptMarkdown",
      "healthFilesystemSnapshot",
      "query.get(\"channels\")",
      "modal gateId must be a non-negative integer",
      "modal is no longer active",
      "KATEX_ASSET_RE",
      "KATEX_FONT_ASSET_RE",
      "atomicWriteMemoryFile",
      "listProjectMemoryPaths",
      "SOUL_MAX_CHARS",
      "stripSoulNameBlocks",
      "listSoulHistory",
      "writeMemoryTrash",
      "expectedRevision",
      "function handleBackups",
      "ctx.userDataBackups",
      "getPersistentStorageIssues",
      'case "backups"',
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
      "CHAT_INITIAL_RENDER_COUNT",
      "inputValueRef",
      "setChatInput",
      "defaultValue=${inputValueRef.current}",
      "persistQueuedPrompt",
      "requestId",
      "将在当前回答结束后切换",
      "queuePaused || busy",
      "background-jobs",
      "stoppingBtn",
      "subscribeSseStatus",
      "setTimeout(flushStreaming, 75)",
      "请求超时",
      "modalResolving",
      "renderer.html = ({ text }) => escapeHtml(text)",
      "planContinuation",
      "plan-continuation-bar",
      'dash.kind === "plan-activated"',
      "VisionoxKatex.markedExtensions()",
      "extensions: mathExtensions",
      "vendor/katex/katex.min.css?token=",
      "copyModeMemory",
      "batchModeMemories",
      "Soul 不提供删除",
      "当前上下文仍在使用旧记忆",
      "预览最终注入",
      'api("/mode-memory/batch"',
      'usePoll("/backups", 15e3)',
      "overview.dataProtection",
      "backupPreview.counts.conflict",
      "overview.storageIssues",
    ],
  },
  {
    file: "src-tauri/resources/server/visionox-pkg/dist/cli/chunk-2R4QCDOZ.js",
    markers: [
      "fallbackSummaryForFold",
      "const decision = this.context.decideAfterUsage",
      "if (repairedCalls.length === 0)",
      "normalizeHistoryForModel",
      "contextThresholdsForCapacity",
      "_contextRecheckRequired",
      "onPlanSubmitted?.(plan, steps, summary)",
      "never repeat or translate the title",
      "forcedSummaryReason: opts.reason",
      "OfficeCLI efficiency guard",
      "overwrite: args.replace === true",
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
      ".chat-queue-paused",
      ".modal-resolving",
      "minmax(28px, max-content) minmax(0, 1fr)",
      "overflow-wrap: anywhere",
      ".modal-step-risk-med",
      ".plan-continuation-bar",
      ".visionox-math-block",
      ".memory-mode-tabs",
      ".memory-batch-bar",
      ".memory-soul-note",
      ".memory-runtime-pending",
      ".memory-soul-history",
    ],
  },
  {
    file: "src-tauri/resources/server/visionox-pkg/dashboard/katex-support.js",
    markers: ["visionoxBlockMath", "visionoxInlineMath", "renderToString", 'trust: false'],
    forbidden: ["mermaid"],
  },
  {
    file: "src-tauri/resources/server/visionox-pkg/dashboard/index.html",
    markers: ["vendor/katex/katex.min.css", "vendor/katex/katex.min.js", "katex-support.js"],
  },
  {
    file: "src-tauri/resources/server/lib/plan-continuation.mjs",
    markers: [
      "decidePlanContinuation",
      "const resumable",
      'action: "pause"',
      "incompleteFinal",
    ],
  },
  {
    file: "src-tauri/resources/server/lib/plan-state-policy.mjs",
    markers: ["normalizeCompletedStepIds", "isKnownPlanStep", "isPlanComplete"],
  },
  {
    file: "src-tauri/resources/server/lib/active-session.mjs",
    markers: ["activeEntriesForDashboard", 'entry.role === "tool") continue', "系统自动续跑"],
    forbidden: ["reasoning: entry.reasoning ?? entry.reasoning_content"],
  },
  {
    file: "src-tauri/resources/server/lib/officecli-policy.mjs",
    markers: ["officecli-multiple-commands", "officecli-batch-input-required"],
  },
  {
    file: "src-tauri/resources/server/lib/mcp-recovery.mjs",
    markers: ["isMcpToolTimeout", "mcpRecoveryError"],
  },
  {
    file: "src-tauri/resources/bootstrap-skills/officecli/SKILL.md",
    markers: ["## Efficient generation", '"command":"add"'],
    forbidden: ['"op":"add"'],
  },
  {
    file: "src-tauri/resources/server/lib/dlp-file.mjs",
    markers: [
      "document preparation cancelled",
      "signal: ctx?.signal",
    ],
  },
  {
    file: "src-tauri/resources/server/visionox-pkg/dist/cli/chunk-O52OLQL3.js",
    markers: [
      "background job wait cancelled",
      "async stopOwned",
      "lifecycle: opts.lifecycle",
      "listMetadata()",
      "completedRetention = 50",
    ],
  },
  {
    file: "src-tauri/resources/server/visionox-pkg/dist/cli/chunk-7O5ALB4C.js",
    markers: [
      "hook cancelled",
      "signal: opts.signal",
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

const rustSource = readFileSync(join(root, "src-tauri", "src", "lib.rs"), "utf8");
const rustRuntimeSource = rustSource.split("#[cfg(test)]", 1)[0];
for (const marker of ["CARGO_MANIFEST_DIR", "ensure_server_resources"]) {
  if (rustRuntimeSource.includes(marker)) {
    failures.push(`src-tauri/src/lib.rs: runtime source must not reference ${JSON.stringify(marker)}`);
  }
}

const desktopPackage = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const tauriConfig = JSON.parse(readFileSync(join(root, "src-tauri", "tauri.conf.json"), "utf8"));
const cargoManifest = readFileSync(join(root, "src-tauri", "Cargo.toml"), "utf8");
const rustMain = readFileSync(join(root, "src-tauri", "src", "main.rs"), "utf8");
const agentRules = readFileSync(join(root, "AGENTS.md"), "utf8");
const gitignoreLines = readFileSync(join(root, ".gitignore"), "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));
if (existsSync(join(root, "src-tauri", "runtime"))) failures.push("src-tauri/runtime: repository-local runtime staging is forbidden");
if (desktopPackage.name !== "visionox-whale") failures.push("package.json: expected name visionox-whale");
if (tauriConfig.productName !== "Visionox-Whale") failures.push("tauri.conf.json: expected productName Visionox-Whale");
if (!/^name = "visionox-whale"$/m.test(cargoManifest)) failures.push("Cargo.toml: expected package name visionox-whale");
if (!rustMain.includes("visionox_whale::run()")) failures.push("main.rs: expected visionox_whale crate entry");
if (!agentRules.includes("src-tauri/target/release/visionox-whale.exe")) failures.push("AGENTS.md: canonical executable is not visionox-whale.exe");

for (const unsafePattern of ["*.bak", "*.map", "*.zip", "icons/", "src-tauri/resources/server/visionox-pkg/dist/"]) {
  if (gitignoreLines.includes(unsafePattern)) {
    failures.push(`.gitignore: overly broad pattern is forbidden: ${unsafePattern}`);
  }
}
for (const requiredPattern of [
  "/src-tauri/target/",
  "/src-tauri/resources/server/visionox-pkg/**/*.map",
  "/src-tauri/resources/server/node.exe",
  "/src-tauri/resources/server/officecli.exe",
]) {
  if (!gitignoreLines.includes(requiredPattern)) {
    failures.push(`.gitignore: required scoped pattern is missing: ${requiredPattern}`);
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
