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
    file: "src-tauri/resources/server/lib/provider-configuration.mjs",
    markers: ["previewProviderImport", "stableModelKey", "syncModels", "removeProviderIds", "removeProvider", "confirmDestructive", "validateRequestDefaults"],
  },
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
      '"dashboard/backup-support.js"',
      '"dashboard/index-mode-support.js"',
      '"dashboard/overview-alerts-support.js"',
      'copyDirectory(join("dashboard", "vendor", "katex"))',
      'buildStampPlaceholder = "__VISIONOX_BUILD_STAMP__"',
      "runtime server build stamp placeholder is missing",
    ],
  },
  {
    file: "scripts/run-tauri-build.js",
    markers: ["CARGO_NET_OFFLINE", "CARGO_TARGET_DIR", "npm_config_offline", "mkdtempSync", "visionox-release-", "resourceOverride", "release-manifest.json", "verify-runtime-manifest.js", "verify-release-resources.js", "release-manifest.js"],
  },
  {
    file: "scripts/verify-release-resources.js",
    markers: ["visionox-whale.exe", "dws.exe", "DWS_LICENSE.txt", "criticalDwsResources", "forbidden DWS user state", "development-machine path leaked", "runtime-manifest.json", "third-party-resources.json", "bootstrap-skills-provenance.json", "THIRD_PARTY_NOTICES.md", "unexpected legacy executable", "content mismatch", "unexpected:", "verified ${expected.size} files"],
  },
  {
    file: "scripts/check-build-entrypoints.js",
    markers: ["validateBuildEntrypoints", "tauri:dev must prepare the runtime package first", "bypasses the governed build entrypoints"],
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
    file: "scripts/check-third-party-resources.js",
    markers: ["third-party-resources.json", "bootstrap-skills-provenance.json", '"dws"', "requiredDwsFiles", "reasonixPackage", "reasonix package version differs", "pdfjsPackage", "PDF.js package version differs", "canvasPackage", "@napi-rs/canvas version differs", "portable user-state directory is forbidden", "development-machine path leaked", "bootstrap skill is missing provenance", "missing skill license file", "missing notice file", "version or SHA-256 differs"],
  },
  {
    file: "scripts/fetch-binaries.js",
    markers: ["runtime-manifest.json", "https://d.officecli.ai/releases/download/", "failed runtime manifest verification", "visionox-officecli-"],
  },
  {
    file: "scripts/verify-runtime-manifest.js",
    markers: ["runtime-manifest.json", "SHA-256 mismatch", "size mismatch", "verified ${manifest.artifacts.length} artifacts"],
  },
  {
    file: "scripts/release-check.js",
    markers: ["visionox-rust-runtime-", "prepare-runtime-package.js", "VISIONOX_RUNTIME_PACKAGE", "TAURI_CONFIG", "rmSync(stagingRoot", "checkReleaseBuildStamp", "valid YYMMDD HH build stamp"],
  },
  {
    file: "src-tauri/resources/runtime-manifest.json",
    markers: ["server/node.exe", "server/officecli.exe", "server/dws.exe", "cdab71518a3107ebcf1430d704dfd063b104285a4b5f4402dd8eb5c0e6c09797"],
  },
  {
    file: "scripts/verify-nsis-bundle.js",
    markers: ["collectFiles", "criticalDwsResources", "forbidden DWS user state", "development-machine path leaked", "unexpected resource", "expectedFiles.size", "replaceBundleMarker", "writeReleaseManifest"],
  },
  {
    file: "scripts/release-manifest.js",
    markers: ["release-manifest.json", "runtime-manifest.json", "readBuildStamp", "readGitState", "releaseResources", "nsisBundle", "nsisVerified requires includeNsis"],
  },
  {
    file: "src-tauri/resources/server/launcher.mjs",
    markers: [
      "HIGH_PRIORITY_MEMORY_BLOCK_MAX_CHARS",
      "withPendingUserEntry",
      'trackPersistentStorageIssue("active-session"',
      "rememberGeneratedArtifactPath",
      "artifact-created",
      "getGeneratedArtifactPaths",
      "parseActiveSessionJsonl",
      "rebuildLoopPreservingContext",
      "promptQueueFile",
      "acceptedPromptRequest",
      "pendingModelSwitch",
      "requestModelSwitch",
      "createConfiguredModelClient",
      "resolveProviderModelRequest",
      "rebuildProviderContextCaps",
      "contextCapacitySource",
      "beginActiveOperation",
      "preparedDocumentRegistry",
      "extract_pdf_text",
      "jobs.stopOwned",
      "scheduleRunRegistry",
      "createScheduleTriggerQueue",
      "queueScheduleTrigger",
      "writeManagedScheduledReport",
      "reportExportPath",
      "workspaceScope",
      "REPORT_COLLECTION_MAX_CHARS",
      "appendAuditEntry",
      "pendingPlanRevision",
      "const queuedModals = []",
      "marker.version === sourceVersion",
      "activeGateId !== gateId",
      "decidePlanContinuation",
      "MAX_PLAN_AUTO_CONTINUATIONS = 2",
      'kind: "plan-continuation-needed"',
      "activatePendingPlan",
      "validateOfficecliInvocation",
      "validateDwsInvocation",
      "wrapMcpToolsWithRecovery",
      "OFFICECLI_MCP_REQUEST_TIMEOUT_MS",
      "mcpRequestTimeoutMs",
      "getMemoryRuntimeStatus",
      "moveModeMemory",
      "batchModeMemory",
      "restoreModeMemoryTrash",
      "migrateConfigFile",
      "deployEccRules",
      "loadRules",
      "setActiveModeEccRules",
      "flatMdMtimeFingerprint(dir)",
      "BOOTSTRAP_SKILLS_DISABLED_DIR",
      "pruneMemoryTrash(visionoxDataDir)",
      "const explicitSkillInvocation = opts.skillInvocation",
      "routeAutomaticSkill(text)",
      "disableBootstrapSkill",
      "enableBootstrapSkill",
      "manualSkillInput = await tools.dispatch",
      "getWorkspaceState",
      "selectWorkspace: selectWorkspaceDir",
      "removeWorkspaceHistory",
    ],
  },
  {
    file: "src-tauri/resources/ecc-rules/common/coding-style.md",
    markers: ["# Coding Style", "## Immutability (CRITICAL)", "### KISS (Keep It Simple)"],
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
      "function prune(maxCount)",
      "function estimate()",
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
    file: "src-tauri/resources/server/lib/runtime-issues.mjs",
    markers: ["createRuntimeIssueRegistry", "ACTIONABLE_LEVELS", "fatal"],
  },
  {
    file: "src-tauri/resources/server/lib/active-session-meta.mjs",
    markers: ["createActiveSessionMetaStore", "assertVersionedJsonWritable", "metadata update requires a builder"],
  },
  {
    file: "src-tauri/resources/server/lib/schedule-execution.mjs",
    markers: ["createScheduleRunRegistry", "createScheduleTriggerQueue", "orderMissedSchedules", "decideScheduleAdmission", "decideRejectedScheduleSubmission", "repairInterruptedSchedule", "markScheduleCancellationRequested", "requiresBoundWorkspace"],
  },
  {
    file: "src-tauri/resources/server/lib/schedule-report-store.mjs",
    markers: ["createScheduleReportStore", "atomicWriteFileSync", "isManagedPath", "removeTask"],
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
      "function handleWorkspaces",
      'case "workspaces"',
      "function handlePromptQueue",
      "external URL opener unavailable",
      "ctx.openExternalUrl(url, { browser })",
      "SKILL_INVOCATION_NAME_RE",
      "skillInvocation: parsedSkillInvocation",
      "managed skill credentials are unavailable",
      "scheduled Skill knowledge archive is not wired",
      'action: "schedule-archive"',
      "acceptedOrQueued",
      "saveSkillCredential(name, fields.apiKey, options)",
      "requestId: typeof requestId",
      "modelSwitch",
      "credentialVerificationTokens",
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
      "MEMORY_TRASH_RETENTION_DAYS",
      "memoryTrashState",
      "purgeMemoryTrash",
      "open the original project before restoring this memory",
      "expectedRevision",
      "function handleBackups",
      "ctx.userDataBackups",
      "getPersistentStorageIssues",
      'case "backups"',
      "overview-alerts-support.js",
      "eccRulesPending",
      "unknown ECC rule pack(s)",
      "disabledBuiltin",
      "ctx.enableBootstrapSkill?.(name)",
      "ctx.getSlashCommands",
      "__VISIONOX_BUILD_STAMP__",
      "resolveProviderModelRequest",
      "validateRequestDefaults",
      'purpose: "verification"',
      'case "vhome"',
      "handleVHome",
      "startVHomeLogin",
      "cancelVHomeLogin",
      "refreshVHomeStatus",
      "logoutVHome",
      'previewProviderImport',
      'credentials" && rest[1] === "test"',
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
      "const skillInvocation = { name: selected.skill.name, task }",
      "body.skillInvocation = resolved.skillInvocation",
      "skillCredentialSetup",
      "chat.skillCredentialHint",
      "pickWorkspaceDirectoryFromBridge",
      'api("/workspaces"',
      "workspaceSelection?.pending",
      "persistQueuedPrompt",
      "requestId",
      "将在当前回答结束后切换",
      "ECC 编码规范",
      "save({ eccRules: next })",
      "skills.disabledBuiltin",
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
      "permanentlyDeleteMemoryTrash",
      "emptyMemoryTrash",
      "清空回收站",
      'api("/mode-memory/batch"',
      'usePoll("/backups", 15e3)',
      "overview.dataProtection",
      "VisionoxBackupPolicy.restoreActions(backupPreview.counts)",
      "actions.canOverwriteConflicts",
      "VisionoxIndexModePolicy.normalize",
      "VisionoxIndexModePolicy.hint",
      "VisionoxOverviewAlertPolicy.evaluate",
      "overview.backupRetention",
      "overview.deleteBackup",
      "overview.storageIssues",
      "tasks.reportStored",
      "tasks.runQueued",
      "skillArchiveWorkspaceDir",
      "归档到知识库",
      "高质量结果自动归档",
      "workspaceScopeCurrent",
      "rebindWorkspace",
      "buildDate2 && !buildDate2.startsWith",
      "JSON \\u56FA\\u5B9A\\u53C2\\u6570",
      "requestPolicy === \"json\"",
      'usePoll("/vhome/status", 3e5)',
      "sidebarIdentity",
      'api("/vhome/login"',
      'api("/vhome/refresh"',
      'api("/vhome/logout"',
      "finishVHomeLogin(vhomeStatus)",
      "copyVHomeValue(vhomeLoginUrl, \"授权链接\")",
      'openVHomeAuthorization("edge")',
      "vhomeAuthorizationReady",
      "正在获取授权链接，请稍候",
      "vhomeLoginFailureMessage",
      "DWS 诊断：",
      "我已完成授权",
      'class="vhome-control"',
      "user data issues need attention",
      "vis_dashboard_ready",
    ],
    forbidden: ['<span class="v">Ver${version2}</span>'],
  },
  {
    file: "src-tauri/resources/server/visionox-pkg/dist/cli/chunk-2KDUS647.js",
    markers: ["requestConfigForModel", "requestDefaults", 'requestConfig.policy === "json"', "!jsonPolicy && opts.reasoningEffort"],
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
      "If the user is supposed to choose, call this tool instead of listing A/B/C",
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
      ".memory-trash-blocked",
      ".side-foot .label",
      "text-overflow: ellipsis",
      ".vhome-control-button",
      ".vhome-popover",
    ],
  },
  {
    file: "src-tauri/resources/server/lib/workspace-history.mjs",
    markers: ["WORKSPACE_HISTORY_LIMIT = 10", "normalizeWorkspaceHistory", "addRecentWorkspace", "removeRecentWorkspace"],
  },
  {
    file: "src-tauri/resources/server/lib/vhome-integration.mjs",
    markers: ["createVHomeIntegration", "contact", "get-self", "authentication-required", "communication-failed", "startLogin", "cancelLogin", "logout", "--device", "login process closed", "login-network-failed", "safePublicLoginDetail"],
  },
  {
    file: "src-tauri/resources/server/lib/skill-routing.mjs",
    markers: ["routeAutomaticSkill", "TECHNICAL_DISCUSSION", "VHOME_TOPIC", "VHOME_SPECIFIC_TOPIC", "MARKDOWN_TO_PDF", 'name: "pdf"', 'name: "md-to-pdf-cjk"', 'name: "dws"', 'name: "weather"'],
  },
  {
    file: "src-tauri/src/lib.rs",
    markers: ["pick_directory", "FolderBrowserDialog", "validated_directory_result", ".env(\"PATH\", runtime_path)", "shutting_down", "child process exited during application shutdown", "f.dataset.ready=''"],
  },
  {
    file: "src/index.html",
    markers: ["vis_pick_directory", "vis_pick_directory_result", "pick_directory", "getTauriInvoke", "api.core.invoke", "armDashboardReadyGuard", "vis_dashboard_ready", "界面加载超时"],
  },
  {
    file: "src-tauri/resources/bootstrap-skills/requesting-code-review/SKILL.md",
    markers: ["Request an independent review", "separate AI review session", "Independent reviewer returns"],
    forbidden: ["superpowers:code-reviewer", "Use Task tool"],
  },
  {
    file: "src-tauri/resources/bootstrap-skills/using-superpowers/SKILL.md",
    markers: ["Call `run_skill`", "Call run_skill", "Create task checklist"],
    forbidden: ["Claude Code", "Skill tool", "Read tool", "TodoWrite"],
  },
  {
    file: "src-tauri/resources/server/visionox-pkg/dist/cli/chunk-2K65GZBT.js",
    markers: ["## Complete skill names", "## Detailed catalog (current-mode recommendations first)", "details omitted for", "bMode - aMode", "Before generic web search or ad-hoc commands"],
    forbidden: ["joined.slice(0, SKILLS_INDEX_MAX_CHARS)"],
  },
  {
    file: "src-tauri/resources/server/visionox-pkg/dist/cli/chunk-45U62RI3.js",
    markers: ["explicitly names a skill", "not listed in the detailed catalog", "reads the current skill store directly", "baseDir:", "replaceAll(\"{baseDir}\", dirname(skill.path))"],
  },
  {
    file: "src-tauri/resources/bootstrap-skills/tavily-search/SKILL.md",
    markers: ["license: MIT", "node \"{baseDir}/scripts/tavily-search.mjs\"", "TAVILY_API_KEY"],
    forbidden: ["tavily_search.py"],
  },
  {
    file: "src-tauri/resources/bootstrap-skills/tavily-search/scripts/tavily-search.mjs",
    markers: ["FORMAT_CHOICES", "loadTavilyApiKey", "https://api.tavily.com/search", "AbortSignal.timeout(30_000)"],
  },
  {
    file: "src-tauri/resources/bootstrap-skills/pdf/SKILL.md",
    markers: ["path from the run_skill result header", "$env:PDF_SKILL_DIR", "Do not run `setup.sh` directly on Windows"],
  },
  {
    file: "src-tauri/resources/bootstrap-skills/subagent-driven-development/SKILL.md",
    markers: ["## Availability Preflight", "does not guarantee that capability", "`todo_write` task checklist"],
    forbidden: ["TodoWrite", "Task tool"],
  },
  {
    file: "src-tauri/resources/bootstrap-skills/systematic-debugging/find-polluter.ps1",
    markers: ["PollutionCheck", "TestPattern", "Polluter found"],
  },
  {
    file: "src-tauri/resources/server/lib/bootstrap-skill-cleanup.mjs",
    markers: ["pruneLegacyBootstrapSkillBackups", "visionox-bootstrap", "Invalid or unreadable markers"],
  },
  {
    file: "src-tauri/resources/server/visionox-pkg/dashboard/katex-support.js",
    markers: ["visionoxBlockMath", "visionoxInlineMath", "renderToString", 'trust: false'],
    forbidden: ["mermaid"],
  },
  {
    file: "src-tauri/resources/server/visionox-pkg/dashboard/backup-support.js",
    markers: ["VisionoxBackupPolicy", "normalizeRetentionCount", "canOverwriteConflicts"],
  },
  {
    file: "src-tauri/resources/server/visionox-pkg/dashboard/index-mode-support.js",
    markers: ["VisionoxIndexModePolicy", "normalize", "每次发送消息前自动搜索"],
  },
  {
    file: "src-tauri/resources/server/visionox-pkg/dashboard/overview-alerts-support.js",
    markers: ["VisionoxOverviewAlertPolicy", "model_retest", "missing_index", "budgetPct"],
  },
  {
    file: "src-tauri/resources/server/visionox-pkg/dashboard/index.html",
    markers: ["vendor/katex/katex.min.css", "vendor/katex/katex.min.js", "katex-support.js", "backup-support.js", "index-mode-support.js", "overview-alerts-support.js"],
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
    file: "src-tauri/resources/bootstrap-skills/dws/SKILL.md",
    markers: ["name: dws", "DWS is not read-only", "without a Visionox command allowlist", "dws_help", "dws_docs_search", "dws_exec", "call the `dws_read` tool directly", "request ceiling of 200", "Individual DWS services can impose a lower page size", "仍然发送", "idempotency UUID", "Never place a DWS executable path", "External Side Effects", "references/upstream/products/"],
  },
  {
    file: "src-tauri/resources/bootstrap-skills/dws/integration.json",
    markers: ['"version": "1.0.51.10"', '"license": "Apache-2.0"', '"integrationApiVersion": 1'],
  },
  {
    file: "src-tauri/resources/bootstrap-skills/dws/schedule-templates.json",
    markers: ["daily-work-briefing", "conversation-topic-digest", "meeting-action-digest", "weekly-work-summary", "topic-investigation", "report-consistency-review", '"risk": "read"'],
  },
  {
    file: "src-tauri/resources/bootstrap-skills/dws/scripts/dws-json.mjs",
    markers: ["validateDwsReadArgs", "validateDwsWriteArgs", "validateDwsExecArgs", "runDwsHelp", "runDwsExec", "DWS_READ_LIMIT = 200", "normalizeDwsResponse", "VISIONOX_DWS_EXECUTABLE", "shell: false"],
  },
  {
    file: "src-tauri/resources/server/lib/dws-invocation-policy.mjs",
    markers: ["dws-external-executable", "dws-help-use-tool", "dws-read-use-tool", "dws-write-use-tool", "dws-exec-use-tool", "bundledExecutable", "isDwsReadCommand", "isDwsWriteCommand"],
  },
  {
    file: "src-tauri/resources/server/lib/scheduled-knowledge-store.mjs",
    markers: ["createScheduledKnowledgeStore", "normalizeScheduledKnowledgeReview", "sourceFingerprint", "original file was not modified"],
  },
  {
    file: "src-tauri/resources/server/lib/skill-integration.mjs",
    markers: ["validateSkillIntegration", "loadSkillIntegrations", "resolveSkillScheduleTemplate", "renderSkillScheduleTask"],
  },
  {
    file: "src-tauri/resources/server/lib/vhome-skill-drafts.mjs",
    markers: ["VHOME_SKILL_DRAFT_TTL_MS", "draft revision is required for updates", "renderVHomeSkillFiles", "requiresConnection: \"vhome\""],
  },
  {
    file: "src-tauri/resources/server/lib/vhome-skill-tools.mjs",
    markers: ["name: \"dws_help\"", "name: \"dws_docs_search\"", "name: \"dws_read\"", "name: \"dws_write\"", "name: \"dws_exec\"", "prepareDwsWrite", "仍然发送", "prepare_vhome_skill_draft", "test_vhome_skill_draft", "install_vhome_skill_draft", "visionox-vhome-skill-install-"],
  },
  {
    file: "src-tauri/resources/bootstrap-skills/vhome-skill-builder/SKILL.md",
    markers: ["name: vhome-skill-builder", "Start with `ask_choice`", "prepare_vhome_skill_draft", "Generated Skills must use `dws_read`"],
  },
  {
    file: "src-tauri/resources/server/lib/dlp-file.mjs",
    markers: [
      "createPreparedDocumentRegistry",
      "visionox-document:",
      "document preparation cancelled",
      "signal: ctx?.signal",
    ],
  },
  {
    file: "src-tauri/resources/server/lib/pdf-text.mjs",
    markers: ["pdfjs-dist/legacy/build/pdf.mjs", "extractPdfText", "likelyScanned", "PDF extraction cancelled"],
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
  "/src-tauri/resources/server/dws.exe",
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
