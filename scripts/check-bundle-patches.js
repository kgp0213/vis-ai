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
    file: "scripts/bundle-source-ownership.json",
    markers: ["schemaVersion", "sourceOfTruth", "scripts/check-bundle-patches.js", "scripts/ui-smoke.js"],
  },
  {
    file: "src-tauri/resources/server/lib/provider-configuration.mjs",
    markers: ["previewProviderImport", "stableModelKey", "syncModels", "removeProviderIds", "removeProvider", "confirmDestructive", "validateRequestDefaults", "validateEffortParams", "effortParams", "validateProviderUi", '"groupId"', '"recommendedFor"'],
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
    markers: ["CARGO_NET_OFFLINE", "CARGO_TARGET_DIR", "npm_config_offline", "mkdtempSync", "visionox-release-", "prepareRuntimeLibResources", '"resources/server/lib/": null', '"server-lib"', "resourceOverride", "release-manifest.json", "verify-runtime-manifest.js", "verify-release-resources.js", "release-manifest.js"],
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
    markers: ["visionox-rust-runtime-", "prepare-runtime-package.js", "VISIONOX_RUNTIME_PACKAGE", "TAURI_CONFIG", "removeTempPath(stagingRoot", "checkReleaseBuildStamp", "valid YYMMDD HH build stamp"],
  },
  {
    file: "src-tauri/resources/runtime-manifest.json",
    markers: ["server/node.exe", "server/officecli.exe", "server/dws.exe", "70e3cd3874e5416f575738ed77c6f3cc4c249a16b100d58ef466f9d81607b2a1"],
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
      "PROMPT_RECEIPT_UNCERTAIN",
      "pendingModelSwitch",
      "requestModelSwitch",
      "createConfiguredModelClient",
      "resolveProviderModelRequest",
      "buildSemanticRetrievalCacheKey",
      "modelcfg=",
      "rebuildProviderContextCaps",
      "contextCapacitySource",
      "beginActiveOperation",
      "requestOperationStop",
      "preparedDocumentRegistry",
      "append_file",
      "save_last_assistant_response",
      "contextInputTransactions",
      'name: "read_context_input"',
      'name: "read_tool_output"',
      "toolOutputResourceRoot",
      "claimIntervention",
      "utf8SafePrefixLength",
      "pauseGate.ask(intervention)",
      "isKnownLegacyBootstrapSkill",
      "MAX_ARTIFACT_AUTO_CONTINUATIONS",
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
      "marker.sourceFingerprint === sourceFingerprint",
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
      "getVHomeAvatar: () => vhomeIntegration.getAvatar()",
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
    markers: ["createPromptQueueStore", "original prompt queue was not modified", "acceptedRequest", "rememberAccepted", "promptRequestReceiptDecision", "isDurableReceiptId", "pruneAccepted"],
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
    file: "src-tauri/resources/server/lib/context-input-transaction.mjs",
    markers: ["createContextInputTransactionStore", "atomicWriteFileSync", "CONTEXT_INPUT_PENDING", "read_context_input", "decideContextInputIntervention", "accept-partial"],
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
      "if (baseUrl && apiKey && model)",
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
      "function handleOptimizePrompt",
      'case "optimize-prompt"',
      "managed skill credentials are unavailable",
      "scheduled Skill knowledge archive is not wired",
      'action: "schedule-archive"',
      "acceptedOrQueued",
      "saveSkillCredential(name, fields.apiKey, options)",
      "requestId: parsedRequestId",
      "reserved internal handoff namespace",
      'result.code === "LOOP_BUSY"',
      "prompt was not accepted",
      "modelSwitch",
      "credentialVerificationTokens",
      "requestedModelId",
      "activeModelId",
      "activationPresetForModel(requestedModel)",
      'rest[0] === "cleanup-failed"',
      "cleanup-failed-provider-models",
      "function handleBackgroundJobs",
      "pendingDeliveries",
      "request.expectedRevision",
      "request.requestId",
      "request.payload",
      "generic background jobs require an explicit POST action",
      'method === "DELETE" && rest.length === 1',
      "background-job-stop",
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
      "resolveModelEffort",
      "not supported by active model",
      "assertModelProbeMarker",
      'purpose: "verification"',
      'case "vhome"',
      "handleVHome",
      "path === \"/api/vhome/avatar\"",
      "ctx.getVHomeAvatar",
      "V来家头像暂不可用",
      "private, max-age=60",
      "startVHomeLogin",
      "cancelVHomeLogin",
      "refreshVHomeStatus",
      "logoutVHome",
      'previewProviderImport',
      "capabilities?.maxContextTokens",
      'credentials" && rest[1] === "test"',
      "语义搜索配置不完整",
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
      "Markdown artifacts are preview-only",
      "confirmExternalArtifactOpen",
      "reasoning-live-tail",
      "reasoningExpanded",
      "reasoning-details",
      "visionox-reasoning-display",
      "const canOpen = !canPreview",
      "openMarkdownDocumentFromArgs",
      "openMarkdownDocumentByPicker",
      "top-action-md",
      "CHAT_INITIAL_RENDER_COUNT",
      "inputValueRef",
      "setChatInput",
      "optimizeCurrentPrompt",
      "prompt-optimize-chip",
      "defaultValue=${inputValueRef.current}",
      "const skillInvocation = { name: selected.skill.name, task }",
      "body.skillInvocation = resolved.skillInvocation",
      "skillCredentialSetup",
      "renderExecutionReceipt",
      "execution-receipt",
      "chat.skillCredentialHint",
      "pickWorkspaceDirectoryFromBridge",
      'api("/workspaces"',
      "workspaceSelection?.pending",
      "persistQueuedPrompt",
      "requestId",
      "requiresUserRetry: err.body?.requiresUserRetry === true",
      "const retryRequestId = `prompt-",
      "将在当前回答结束后切换",
      "ECC 编码规范",
      "save({ eccRules: next })",
      "skills.disabledBuiltin",
      "queuePaused || busy",
      "background-jobs",
      "documentJobStatusLabel",
      "providerDisplayGroups",
      "providerDisplayLabel",
      "providerModelCapabilityLabels",
      "reasoningEffortLabel",
      "activeModelEfforts",
      "selectProviderModel",
      "openModelGroupId",
      "model-provider-trigger",
      "model-cascade-submenu",
      "https://your-embedding-host.example/v1/embeddings",
      '"enter API key"',
      "provider-import-file",
      "confirmProviderImport",
      "scheduleModelGroupClose",
      "testAllProviders",
      "cleanupFailedModels",
      "模型管理",
      "testManagedProviders",
      "backgroundJobNeedsAttention",
      "backgroundJobGroups",
      "genericTaskLifecycleLabel",
      "GENERIC_TASK_ACTION_LABELS",
      "retry_delivery",
      "确认后重新交付",
      "consumer: selectedDelivery?.target",
      "deliveryState.lastError",
      "artifactRefs",
      "pendingDeliveries",
      "backgroundActionRequestId",
      "refreshOnFocus",
      "documentHandoffNotice",
      '"job-timeout": "本次执行总时限已到"',
      '"job-call-budget": "本次执行调用预算已用尽"',
      "已完成，需复核",
      "documentRetryLabel",
      "modelIssues",
      "需要复核的原因",
      "background-jobs-workbench",
      "background-jobs-layout",
      "background-jobs-list",
      "background-jobs-detail",
      "background-jobs-header",
      "background-jobs-close",
      "closeBackgroundWorkbench",
      "controlDocumentJob",
      "backgroundJobDetailRequestRef",
      "Keep the original control error visible when the detail refresh also fails.",
      "另存后台草稿",
      "previewDocumentJob",
      "重试失败部分",
      "备用候选",
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
      "requestPolicy === \"json\"",
      'usePoll("/vhome/status", 3e5)',
      "sidebarIdentity",
      'api("/vhome/login"',
      'api("/vhome/refresh"',
      'api("/vhome/logout"',
      "/api/vhome/avatar?token=",
      "userAvatar = null",
      "onAvatarError",
      "class=\"avatar\"",
      "loading=\"lazy\"",
      "finishVHomeLogin(vhomeStatus)",
      "copyVHomeValue(vhomeLoginUrl, \"授权链接\")",
      'openVHomeAuthorization("edge")',
      "vhomeAuthorizationReady",
      "vhomeControlRef",
      "dismissVHomePopover",
      "vhome-popover-actions-connected",
      "正在获取授权链接，请稍候",
      "vhomeLoginFailureMessage",
      "DWS 诊断：",
      "我已完成授权",
      'class="vhome-control"',
      "user data issues need attention",
      "vis_dashboard_ready",
      'value="indigo-night"',
    ],
    forbidden: ['<span class="v">Ver${version2}</span>'],
  },
  {
    file: "src-tauri/resources/server/visionox-pkg/dist/cli/chunk-2KDUS647.js",
    markers: ["requestConfigForModel", "requestDefaults", 'requestConfig.policy === "json"', "!jsonPolicy && opts.reasoningEffort", "opts.requestPurpose", "streamOptionsSupport", "stream_options", "include_usage", "(resp.status === 400 || resp.status === 422)", "API ${resp.status}", "max_completion_tokens", "ev.event === \"error\"", "ModelStreamProtocolError", "ModelStreamIncompleteError", "ModelProviderStreamError", "ModelRequestTimeoutError", "MODEL_REQUEST_TIMEOUT", "AbortSignal.any", "streamComplete", "finishReason: data.choices?.[0]?.finish_reason", "isPermanentRateLimitResponse"],
  },
  {
    file: "src-tauri/resources/server/visionox-pkg/dist/cli/chunk-PV55UMTO.js",
    markers: ["imageTokensPerImage", "imageContextReserveTokens", 'part?.type === "image_url"'],
  },
  {
    file: "src-tauri/resources/server/visionox-pkg/dist/cli/chunk-RE4RAVFF.js",
    markers: ["tool rounds completed", "configured tool-result budget", "hard tool-round limit", "Authentication failed (API 401)", "Model API unavailable"],
  },
  {
    file: "src-tauri/resources/server/visionox-pkg/dist/cli/chunk-2R4QCDOZ.js",
    markers: [
      "fallbackSummaryForFold",
      "CONTEXT_EXIT_STATUS_RECORDED",
      "const decision = this.context.decideAfterUsage",
      "if (repairedCalls.length === 0)",
      "normalizeHistoryForModel",
      "contextThresholdsForCapacity",
      "CONTEXT_FIXED_GUARD_TOKENS",
      "decideDynamicContextAction",
      "recordContextFoldOutcome",
      "output_recovery_required",
      "_contextRecheckRequired",
      "onPlanSubmitted?.(plan, steps, summary)",
      "If the user is supposed to choose, call this tool instead of listing A/B/C",
      "never repeat or translate the title",
      "forcedSummaryReason: opts.reason",
      "OfficeCLI efficiency guard",
      "same failure class guard",
      "REPEATED_TOOL_FAILURE_BLOCKED",
      "failureArgsSignature",
      "displayRel(startAbs, full)",
      "normalizeToolResultBudget",
      "tool-round checkpoint",
      "maxToolContinuationWindows",
      "escalationModel",
      "TOOL_CALL_REPAIR_META",
      "droppedContent",
      "TRUNCATED_TOOL_ARGUMENTS",
      "finishTurnOnResult",
      "A path-only call cannot create document content",
      'requestPurpose: iter === 0 ? "initial" : "toolContinuation"',
      "overwrite: args.replace === true",
      "maxResultTokens: opts.maxResultTokens",
      'name: "append_file"',
      '"organize_documents_to_report"',
      "ModelOutputTruncatedError",
      "assertModelResponseComplete",
      "Do not use this for PDF or Office binary content",
      "contextInputGuard",
      "context_input_flush_required",
      "onRawResult",
      "contextMaterializer",
      "contextResourceReader",
      "noteResourceRead",
      "contextInputMemo.trim() && msgs[0]?.role === \"system\"",
      "/^API (\\d{3}):",
      "/deepseek\\.com/i.test",
    ],
  },
  {
    file: "src-tauri/resources/server/visionox-pkg/dist/cli/acp-DAGPCVFZ.js",
    markers: ['"append_file"'],
  },
  {
    file: "src-tauri/resources/server/visionox-pkg/dist/cli/chunk-P7EKE5ZQ.js",
    markers: ['name !== "edit_file" && name !== "write_file" && name !== "append_file"', 'name === "append_file"'],
  },
  {
    file: "src-tauri/resources/server/visionox-pkg/dist/index.js",
    markers: ["maxResultTokens: opts.maxResultTokens", 'name: "append_file"', '"organize_documents_to_report"', "escalationModel", "finishTurnOnResult", "A path-only call cannot create document content", "Do not use this for PDF or Office binary content", "outputResourceDir", "TOOL_OUTPUT_RESOURCE", "outputResource()", "truncateCommandOutput", "decodeTruncatedOutputPart", "showing beginning and end", "requestConfigForModel", "requestDefaults", 'requestConfig.policy === "json"', "streamOptionsSupport", "stream_options", "include_usage", "(resp.status === 400 || resp.status === 422)", "API ${resp.status}", "max_completion_tokens", "ev.event === \"error\"", "!jsonPolicy && opts.reasoningEffort", "opts.requestPurpose", "ModelStreamProtocolError", "ModelStreamIncompleteError", "ModelProviderStreamError", "ModelRequestTimeoutError", "MODEL_REQUEST_TIMEOUT", "AbortSignal.any", "ModelOutputTruncatedError", "TOOL_CALL_REPAIR_META", "droppedContent", "TRUNCATED_TOOL_ARGUMENTS", "isPermanentRateLimitResponse", "displayRel2(startAbs, full)"],
  },
  {
    file: "src-tauri/resources/server/visionox-pkg/dashboard/app.css",
    markers: [
      ".file-artifact-card",
      ".files-panel",
      ".chat-msg-actions",
      ".chat-msg .avatar",
      ".reasoning-live-tail",
      ".reasoning-details",
      ".reasoning-summary",
      ".artifact-open-confirmation",
      ".chat-msg.user .avatar",
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
      ".execution-receipt",
      ".memory-trash-blocked",
      ".side-foot .label",
      "text-overflow: ellipsis",
      ".vhome-control-button",
      ".vhome-popover",
      ".background-jobs-layout",
      ".background-jobs-list",
      ".background-jobs-detail",
      ".background-jobs-header",
      ".background-jobs-close",
      ".background-job-group-title",
      ".background-job-list-item",
      ".background-task-actions",
      ".background-task-artifacts",
      "scrollbar-gutter: stable",
      ".vhome-popover-head",
      ".vhome-popover-close",
      ".vhome-popover-actions-connected",
      ".model-picker-browser",
      ".model-cascade-menu",
      ".model-provider-trigger",
      ".model-cascade-submenu",
      ".model-test-link",
      ".model-cleanup-link",
      ".model-management-card",
      "visionox-ui-refinement-2026",
      "visionox-theme-indigo-night",
      "柔和色调徽章",
    ],
  },
  {
    file: "src-tauri/resources/server/lib/workspace-history.mjs",
    markers: ["WORKSPACE_HISTORY_LIMIT = 10", "normalizeWorkspaceHistory", "addRecentWorkspace", "removeRecentWorkspace"],
  },
  {
    file: "src-tauri/resources/server/lib/vhome-integration.mjs",
    markers: ["createVHomeIntegration", "contact", "get-self", "authentication-required", "communication-failed", "startLogin", "cancelLogin", "logout", "--device", "login process closed", "login-network-failed", "safePublicLoginDetail", "authorAvatar", "downloadDwsAvatar", "MAX_AVATAR_BYTES", "getAvatar"],
  },
  {
    file: "src-tauri/resources/server/lib/skill-routing.mjs",
    markers: ["routeAutomaticSkill", "TECHNICAL_DISCUSSION", "VHOME_TOPIC", "VHOME_SPECIFIC_TOPIC", "MARKDOWN_TO_PDF", "DOCUMENT_PATH", 'name: "document-organizer"', 'name: "pdf"', 'name: "md-to-pdf-cjk"', 'name: "dws"', 'name: "weather"'],
  },
  {
    file: "src-tauri/src/lib.rs",
    markers: ["pick_directory", "FolderBrowserDialog", "validated_directory_result", ".env(\"PATH\", runtime_path)", "shutting_down", "child process exited during application shutdown", "f.dataset.ready=''", "indigo-night"],
  },
  {
    file: "src/index.html",
    markers: ["vis_pick_directory", "vis_pick_directory_result", "pick_directory", "getTauriInvoke", "api.core.invoke", "armDashboardReadyGuard", "vis_dashboard_ready", "界面加载超时", "indigo-night"],
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
    markers: ["PDF Workbench Router", "path from the run_skill result header", "$env:PDF_SKILL_DIR", "Do not run `setup.sh` directly on Windows", "format operations only", "references/large-document.md"],
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
    markers: ["vendor/katex/katex.min.css", "vendor/katex/katex.min.js", "katex-support.js", "backup-support.js", "index-mode-support.js", "overview-alerts-support.js", "indigo-night"],
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
    markers: ['"version": "1.0.52.1"', '"license": "Apache-2.0"', '"integrationApiVersion": 1'],
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
      "latestPreparedDocumentRef",
      "prepareLocalDocuments",
      "visionox-document:",
      "document preparation cancelled",
      "signal: ctx?.signal",
    ],
  },
  {
    file: "src-tauri/resources/server/lib/artifact-delivery.mjs",
    markers: ["registerSaveLastAssistantResponseTool", "detectArtifactRequest", "artifactDeliveryRetryPrompt", "artifactMissingNotice", "requestedArtifactPaths", "toolResultSucceeded"],
  },
  {
    file: "src-tauri/resources/bootstrap-skills/pdf/references/large-document.md",
    markers: ["pages.chunk", "PDF format operation", "general task", "manifest.json"],
  },
  {
    file: "src-tauri/resources/bootstrap-skills/document-organizer/SKILL.md",
    markers: ["name: document-organizer", "ordinary foreground tool loop", "stable step", "document worker", "prepare_local_document", "read_context_input", "recommended option"],
  },
  {
    file: "src-tauri/resources/bootstrap-skills/document-organizer/integration.json",
    markers: ['"id": "document-organizer"', '"version": "1.1.0"', '"resumable-jobs"'],
  },
  {
    file: "src-tauri/resources/server/lib/tool-repair-notice.mjs",
    markers: ["formatToolRepairNotice", "Never include repair notes or tool arguments", "系统已", "truncationsFixed", "scavenged"],
  },
  {
    file: "src-tauri/resources/server/lib/bootstrap-skill-ownership.mjs",
    markers: ["LEGACY_BOOTSTRAP_DIRECTORY_HASHES", "isKnownLegacyBootstrapSkill", "d587374b670b85430785212e4fa19304949ce510e253208d0014763d2fb3e681"],
  },
  {
    file: "src-tauri/resources/server/lib/document-intelligence.mjs",
    markers: ["buildDocumentContract", "document-collection", "normalizeDocumentPolicy", "maxModelCallsPerJob", "jobTimeoutMs", "chunkDocumentUnits", "evaluateDocumentQuality", "resolvedVisualUnitIds", "renderDocumentSourceFallback", "buildDocumentReviewMessages"],
  },
  {
    file: "src-tauri/resources/server/lib/document-extractors.mjs",
    markers: ["processDocumentSourceBatches", "sourceSummaries", "prefixCollectionUnit", "runOfficeCliJson", "htmlDocumentUnits", "officeElementsToUnits", "visionox-office-visual-", "captureVisuals", "visualDataUrl"],
  },
  {
    file: "src-tauri/resources/server/lib/document-job-store.mjs",
    markers: ["createDocumentJobStore", "retentionDays", "repairInterrupted", "pruneExpired", "failedBatches", "allowOutsideWorkspace", "writeBatchCheckpoint", "manifest-snapshots", "events.jsonl", "restart-recovery"],
  },
  {
    file: "src-tauri/resources/server/lib/document-markdown-workflow.mjs",
    markers: ["createDocumentMarkdownManager", "renderCollectionSources", "messagesWithBatchVisuals", "generateHierarchicalSummary", "recoverSavedBatch", "orphan-section", "onPersistenceError", "policy-selected", "completed_with_warnings", "classifyDocumentModelError", "modelDiagnostics", "buildDocumentQualityWarnings", "waiting_foreground", "waiting_provider", "candidate-transient-circuit-opened", "DOCUMENT_JOB_CALL_BUDGET_EXCEEDED", "DOCUMENT_JOB_TIMEOUT", "document-summary-fallback", "isProviderBusy", "retryFailed", 'action === "abandon"', 'action === "delete"', "completions.delete"],
  },
  {
    file: "src-tauri/resources/server/lib/atomic-file.mjs",
    markers: ["replaceFileWithRetry", "REPLACE_RETRY_CODES", '"EACCES", "EBUSY", "EPERM"'],
  },
  {
    file: "src-tauri/resources/server/visionox-pkg/dist/cli/chunk-O52OLQL3.js",
    markers: [
      "background job wait cancelled",
      "async stopOwned",
      "lifecycle: opts.lifecycle",
      "listMetadata()",
      "completedRetention = 50",
      "outputResourceDir",
      "TOOL_OUTPUT_RESOURCE",
      "outputResource()",
      "truncateCommandOutput",
      "decodeTruncatedOutputPart",
      "showing beginning and end",
      "const getEnvironment =",
      "signal: ctx?.signal",
      "env: environment",
      "...(opts.env ?? {})",
      "Optional stable documentRef from prepare_local_document",
    ],
  },
  {
    file: "src-tauri/resources/server/launcher.mjs",
    markers: ["formatToolRepairNotice", "agent-repair", "ev.repair"],
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

const ownershipManifest = JSON.parse(readFileSync(join(root, "scripts", "bundle-source-ownership.json"), "utf8"));
if (ownershipManifest.schemaVersion !== 1 || !Array.isArray(ownershipManifest.entries)) {
  failures.push("scripts/bundle-source-ownership.json: invalid ownership manifest");
}
for (const entry of ownershipManifest.entries ?? []) {
  if (!entry?.path || entry.sourceOfTruth !== "bundle" || !entry.owner || !entry.verification) {
    failures.push(`scripts/bundle-source-ownership.json: incomplete entry ${JSON.stringify(entry)}`);
  }
  if (entry?.path && !existsSync(join(root, entry.path))) {
    failures.push(`scripts/bundle-source-ownership.json: missing owned bundle ${entry.path}`);
  }
}

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
