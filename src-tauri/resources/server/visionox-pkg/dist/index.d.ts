import { SpawnOptions } from 'node:child_process';
import { WriteStream } from 'node:fs';

/** No retry on aborts or mid-stream body errors — re-billing the user for desynced output is worse than failing. */
interface RetryOptions {
    /** Maximum total attempts (including the first). Default 4. */
    maxAttempts?: number;
    /** Initial backoff in ms. Doubles each retry, with jitter. Default 500. */
    initialBackoffMs?: number;
    /** Upper bound on any single backoff delay. Default 10000 (10s). */
    maxBackoffMs?: number;
    /** HTTP statuses to treat as retryable. Default [408, 429, 500, 502, 503, 504]. */
    retryableStatuses?: readonly number[];
    /** Abort signal; we do NOT retry once aborted. */
    signal?: AbortSignal;
    /** Telemetry hook — called before each wait. */
    onRetry?: (info: RetryInfo) => void;
}
interface RetryInfo {
    attempt: number;
    reason: string;
    waitMs: number;
}
declare function fetchWithRetry(fetchFn: typeof fetch, url: string, init: RequestInit, opts?: RetryOptions): Promise<Response>;

interface JSONSchema {
    type?: string;
    properties?: Record<string, JSONSchema>;
    items?: JSONSchema;
    required?: string[];
    description?: string;
    enum?: unknown[];
    [k: string]: unknown;
}
interface ToolFunctionSpec {
    name: string;
    description: string;
    parameters: JSONSchema;
}
interface ToolSpec {
    type: "function";
    function: ToolFunctionSpec;
}
interface ToolCall {
    id?: string;
    type?: "function";
    function: {
        name: string;
        arguments: string;
    };
}
type Role = "system" | "user" | "assistant" | "tool";
interface ChatMessage {
    role: Role;
    content?: string | null;
    name?: string;
    tool_call_id?: string;
    tool_calls?: ToolCall[];
    /** Must round-trip in tool-loop continuations — thinking mode 400s without it. */
    reasoning_content?: string | null;
}
interface RawUsage {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    prompt_cache_hit_tokens?: number;
    prompt_cache_miss_tokens?: number;
}
interface ChatRequestOptions {
    model: string;
    messages: ChatMessage[];
    tools?: ToolSpec[];
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    signal?: AbortSignal;
    /** DeepSeek response_format — use { type: "json_object" } to force valid JSON. */
    responseFormat?: {
        type: "json_object" | "text";
    };
    thinking?: "enabled" | "disabled";
    reasoningEffort?: "high" | "max";
}

declare class Usage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    promptCacheHitTokens: number;
    promptCacheMissTokens: number;
    constructor(promptTokens?: number, completionTokens?: number, totalTokens?: number, promptCacheHitTokens?: number, promptCacheMissTokens?: number);
    get cacheHitRatio(): number;
    static fromApi(raw: RawUsage | undefined | null): Usage;
}
interface ChatResponse {
    content: string;
    reasoningContent: string | null;
    toolCalls: ToolCall[];
    usage: Usage;
    raw: unknown;
}
interface StreamChunk {
    contentDelta?: string;
    reasoningDelta?: string;
    toolCallDelta?: {
        index: number;
        id?: string;
        name?: string;
        argumentsDelta?: string;
    };
    usage?: Usage;
    finishReason?: string;
    raw: any;
}
interface BalanceInfo {
    currency: string;
    total_balance: string;
    granted_balance?: string;
    topped_up_balance?: string;
}
interface UserBalance {
    is_available: boolean;
    balance_infos: BalanceInfo[];
}
interface ModelInfo {
    id: string;
    object: "model";
    owned_by: string;
}
interface ModelList {
    object: "list";
    data: ModelInfo[];
}
interface DeepSeekClientOptions {
    apiKey?: string;
    baseUrl?: string;
    timeoutMs?: number;
    fetch?: typeof fetch;
    /** Retry configuration. Pass `{ maxAttempts: 1 }` to disable retries. */
    retry?: RetryOptions;
}
declare class DeepSeekClient {
    readonly apiKey: string;
    readonly baseUrl: string;
    readonly timeoutMs: number;
    readonly retry: RetryOptions;
    private readonly _fetch;
    constructor(opts?: DeepSeekClientOptions);
    private buildPayload;
    /** Returns null on failure so callers can degrade — session must keep working without balance UI. */
    getBalance(opts?: {
        signal?: AbortSignal;
    }): Promise<UserBalance | null>;
    /** Returns null on failure — callers fall back to a hardcoded model hint. */
    listModels(opts?: {
        signal?: AbortSignal;
    }): Promise<ModelList | null>;
    chat(opts: ChatRequestOptions): Promise<ChatResponse>;
    stream(opts: ChatRequestOptions): AsyncGenerator<StreamChunk>;
}

/** Generic pause gate — bridges tool functions and the App's modals via Promises. */
type ConfirmationChoice = {
    type: "deny";
    denyContext?: string;
} | {
    type: "run_once";
} | {
    type: "always_allow";
    prefix: string;
};
type PlanVerdict = {
    type: "approve";
    feedback?: string;
} | {
    type: "refine";
    feedback?: string;
} | {
    type: "cancel";
    feedback?: string;
};
type CheckpointVerdict = {
    type: "continue";
} | {
    type: "revise";
    feedback?: string;
} | {
    type: "stop";
};
type RevisionVerdict = {
    type: "accepted";
} | {
    type: "rejected";
} | {
    type: "cancelled";
};
type ChoiceVerdict = {
    type: "pick";
    optionId: string;
} | {
    type: "text";
    text: string;
} | {
    type: "cancel";
};
type ToolConfirmationAuditEvent = {
    type: "tool.confirm.allow";
    kind: "run_command" | "run_background";
    payload: {
        command: string;
    };
} | {
    type: "tool.confirm.deny";
    kind: "run_command" | "run_background";
    payload: {
        command: string;
    };
    denyContext?: string;
} | {
    type: "tool.confirm.always_allow";
    kind: "run_command" | "run_background";
    payload: {
        command: string;
    };
    prefix: string;
};
interface PauseResponseMap {
    run_command: ConfirmationChoice;
    run_background: ConfirmationChoice;
    path_access: ConfirmationChoice;
    plan_proposed: PlanVerdict;
    plan_checkpoint: CheckpointVerdict;
    plan_revision: RevisionVerdict;
    choice: ChoiceVerdict;
}
type PauseKind = keyof PauseResponseMap;
interface PausePayloadMap {
    run_command: {
        command: string;
        cwd?: string;
        timeoutSec?: number;
    };
    run_background: {
        command: string;
        cwd?: string;
        waitSec?: number;
    };
    path_access: {
        /** Absolute path the tool wants to touch. */
        path: string;
        /** Why we're being asked — read leaks content, write mutates files. */
        intent: "read" | "write";
        /** The filesystem tool calling in — surfaced so users can see what's about to happen. */
        toolName: string;
        /** Sandbox root the path is escaping — surfaced for context. */
        sandboxRoot: string;
        /** Directory prefix that would be persisted if the user picks "always allow". */
        allowPrefix: string;
    };
    plan_proposed: {
        plan: string;
        steps?: unknown[];
        summary?: string;
    };
    plan_checkpoint: {
        stepId: string;
        title?: string;
        result: string;
        notes?: string;
    };
    plan_revision: {
        reason: string;
        remainingSteps: unknown[];
        summary?: string;
    };
    choice: {
        question: string;
        options: unknown[];
        allowCustom: boolean;
    };
}
type PauseRequest = {
    id: number;
    kind: PauseKind;
    payload: unknown;
};
type GateListener = (request: PauseRequest) => void;
type AuditListener = (event: ToolConfirmationAuditEvent) => void;
/** Named options for PauseGate.ask() — makes it obvious which field is kind vs payload. */
interface PauseAskOpts<K extends PauseKind = PauseKind> {
    kind: K;
    payload: PausePayloadMap[K];
}
declare class PauseGate {
    private _nextId;
    private _pending;
    private _listeners;
    private _auditListener;
    /** Block until the user responds. Takes a named options object so the
     *  kind and payload fields don't get confused at the call site. */
    ask<K extends PauseKind>(opts: PauseAskOpts<K>): Promise<PauseResponseMap[K]>;
    /** Resolve a pending request. Called by the App's modal callback. */
    resolve(id: number, data: unknown): void;
    /** Safe-cancel every outstanding request — frees stranded tool fns on Esc / /new. */
    cancelAll(): void;
    /** Cancel one pending request — used by multi-tab hosts that need per-scope abort. */
    cancel(id: number): boolean;
    setAuditListener(fn: AuditListener | null): void;
    /** Subscribe to new pause requests. Returns an unsubscribe function. */
    on(fn: GateListener): () => void;
    /** Current pending request, if any (polling fallback). */
    get current(): PauseRequest | null;
    private emitAuditEvent;
}

/** Shell-command hooks; project scope first, then global. Exit 0=pass, 2=block on Pre*, other=warn. */
type HookEvent = "PreToolUse" | "PostToolUse" | "UserPromptSubmit" | "Stop";
/** All four events as a const array — drives slash listing + validation. */
declare const HOOK_EVENTS: readonly HookEvent[];
type HookScope = "project" | "global";
interface HookConfig {
    /** Anchored regex; `"*"` / omitted = every tool. Pre/PostToolUse only. */
    match?: string;
    /** Shell command to run. Spawned through the platform shell. */
    command: string;
    /** Optional human description — surfaced in `/hooks`. */
    description?: string;
    /** Per-hook timeout override in ms. */
    timeout?: number;
    /** Defaults: project scope → project root; global scope → process.cwd(). */
    cwd?: string;
}
/** Shape of `<scope>/.reasonix/settings.json` — only `hooks` for now. */
interface HookSettings {
    hooks?: Partial<Record<HookEvent, HookConfig[]>>;
}
/** A loaded hook with its origin scope baked in (used for ordering and `/hooks`). */
interface ResolvedHook extends HookConfig {
    event: HookEvent;
    scope: HookScope;
    /** Absolute path to the settings.json the hook came from. */
    source: string;
}
/** Outcome of a single hook invocation. */
interface HookOutcome {
    /** Which hook fired. */
    hook: ResolvedHook;
    /** pass=exit 0; block=exit 2 on blocking event; warn=other non-zero; timeout=killed; error=spawn failed. */
    decision: "pass" | "block" | "warn" | "timeout" | "error";
    exitCode: number | null;
    /** Captured stdout (trimmed). May be empty. */
    stdout: string;
    /** Captured stderr (trimmed). The block / warn message comes from here. */
    stderr: string;
    durationMs: number;
    /** Output crossed the per-stream byte cap; surfaced so user knows we kept less than the script wrote. */
    truncated?: boolean;
}
/** Aggregate report for `runHooks`. */
interface HookReport {
    event: HookEvent;
    outcomes: HookOutcome[];
    /** True iff at least one outcome was a `block` — only meaningful for blocking events. */
    blocked: boolean;
}
declare const HOOK_SETTINGS_FILENAME = "settings.json";
declare const HOOK_SETTINGS_DIRNAME = ".reasonix";
/** Where the global settings.json lives. Equivalent to `~/.reasonix/settings.json`. */
declare function globalSettingsPath(homeDirOverride?: string): string;
/** Where the project settings.json lives for a given root. */
declare function projectSettingsPath(projectRoot: string): string;
/** Project hooks fire before global; within a scope, array order. */
interface LoadHookSettingsOptions {
    /** Absolute project root, if any. Without it, only global hooks load. */
    projectRoot?: string;
    /** Override `~` for tests. */
    homeDir?: string;
}
declare function loadHooks(opts?: LoadHookSettingsOptions): ResolvedHook[];
/** Match field is an ANCHORED regex — `"file"` won't trigger on `read_file`; use `".*file"`. */
declare function matchesTool(hook: ResolvedHook, toolName: string): boolean;
/** Payload envelope passed to hook stdin. */
interface HookPayload {
    event: HookEvent;
    cwd: string;
    toolName?: string;
    toolArgs?: unknown;
    toolResult?: string;
    prompt?: string;
    lastAssistantText?: string;
    turn?: number;
}
/** Test seam — same shape as Node's spawn but returns a Promise of the raw outcome bits. */
interface HookSpawnInput {
    command: string;
    cwd: string;
    stdin: string;
    timeoutMs: number;
}
interface HookSpawnResult {
    exitCode: number | null;
    stdout: string;
    stderr: string;
    timedOut: boolean;
    /** True iff spawn() itself failed (ENOENT, EACCES, …). */
    spawnError?: Error;
    /** Output capped at byte limit — hook ran to completion but consumers see clipped view. */
    truncated?: boolean;
}
type HookSpawner = (input: HookSpawnInput) => Promise<HookSpawnResult>;
declare function formatHookOutcomeMessage(outcome: HookOutcome): string;
declare function decideOutcome(event: HookEvent, raw: HookSpawnResult): "pass" | "block" | "warn" | "timeout" | "error";
interface RunHooksOptions {
    payload: HookPayload;
    hooks: ResolvedHook[];
    /** Test seam — defaults to a real `spawn`. */
    spawner?: HookSpawner;
}
/** Stops at first `block` so a gating hook can prevent later hooks running against a phantom success. */
declare function runHooks(opts: RunHooksOptions): Promise<HookReport>;

/** Authoritative running-id set — cards derive `running` from `has(id)` instead of trusting end-event delivery. Loop adds on dispatch entry, deletes in `finally` so every exit path cleans up. */
type InflightSubscriber = () => void;
declare class InflightSet {
    private readonly _set;
    private readonly _listeners;
    add(id: string): void;
    delete(id: string): void;
    has(id: string): boolean;
    /** Snapshot for diagnostics / tests; live view, do not mutate. */
    get size(): number;
    /** Subscribe to add/delete; returns the unsubscribe function. */
    subscribe(fn: InflightSubscriber): () => void;
    /** Drop everything — only use at session reset. Notifies once. */
    clear(): void;
    private _notify;
}

interface DeepSeekProbeResult {
    reachable: boolean;
}
declare function formatLoopError(err: Error, probe?: DeepSeekProbeResult): string;

/** Drops both unpaired assistant.tool_calls and stray tool messages — DeepSeek 400s on either. */
declare function fixToolCallPairing(messages: ChatMessage[]): {
    messages: ChatMessage[];
    droppedAssistantCalls: number;
    droppedStrayTools: number;
};
declare function healLoadedMessages(messages: ChatMessage[], maxChars: number): {
    messages: ChatMessage[];
    healedCount: number;
    healedFrom: number;
};
/** Token-cap variant — char cap would let CJK slip past at 2× the intended token cost. */
declare function healLoadedMessagesByTokens(messages: ChatMessage[], maxTokens: number): {
    messages: ChatMessage[];
    healedCount: number;
    tokensSaved: number;
    charsSaved: number;
};

/** Strip hallucinated tool-call envelopes — `tools: undefined` doesn't always force prose. */
declare function stripHallucinatedToolMarkup(s: string): string;

/** Mutating calls clear prior read-only entries so a post-edit re-read isn't flagged as repeat. */
type IsMutating = (call: ToolCall) => boolean;
type IsStormExempt = (call: ToolCall) => boolean;
/** Tracks (name, args) repeats; mutating calls clear prior read-only entries while still counting amongst themselves. */
declare class StormBreaker {
    private readonly windowSize;
    private readonly threshold;
    private readonly isMutating;
    private readonly isStormExempt;
    private readonly recent;
    constructor(windowSize?: number, threshold?: number, isMutating?: IsMutating, isStormExempt?: IsStormExempt);
    inspect(call: ToolCall): {
        suppress: boolean;
        reason?: string;
    };
    reset(): void;
}

/** DeepSeek drops args on schemas >2 levels deep or >10 leaves; flatten to dot-paths and re-nest after dispatch. */

interface FlattenDecision {
    shouldFlatten: boolean;
    leafCount: number;
    maxDepth: number;
}
declare function analyzeSchema(schema: JSONSchema | undefined): FlattenDecision;
declare function flattenSchema(schema: JSONSchema): JSONSchema;
declare function nestArguments(flatArgs: Record<string, unknown>): Record<string, unknown>;

/** Local-only repair (balance braces, close strings, fill nulls); continuation calls belong to the loop, which owns budgets. */
interface TruncationRepairResult {
    repaired: string;
    changed: boolean;
    notes: string[];
}
declare function repairTruncatedJson(input: string): TruncationRepairResult;

/** R1 sometimes emits tool-call JSON inside reasoning_content and forgets `tool_calls`; recover those calls. */

interface ScavengeOptions {
    /** Names of tools the model may legitimately call. Other names are ignored. */
    allowedNames: ReadonlySet<string>;
    /** Maximum number of calls to scavenge per pass (defence against runaway). */
    maxCalls?: number;
}
interface ScavengeResult {
    calls: ToolCall[];
    notes: string[];
}
declare function scavengeToolCalls(reasoningContent: string | null | undefined, opts: ScavengeOptions): ScavengeResult;

/** Pass order: scavenge → truncation → storm. Schema flatten runs at loop construction, not per-turn. */

interface RepairReport {
    scavenged: number;
    truncationsFixed: number;
    stormsBroken: number;
    notes: string[];
}
interface ToolCallRepairOptions {
    allowedToolNames: ReadonlySet<string>;
    stormWindow?: number;
    stormThreshold?: number;
    maxScavenge?: number;
    /** Mutating calls clear the storm window so a post-edit verify-read isn't seen as a repeat. */
    isMutating?: IsMutating;
    /** Cheap state-inspection calls that should never trip repeat-loop suppression. */
    isStormExempt?: IsStormExempt;
}
declare class ToolCallRepair {
    private readonly storm;
    private readonly opts;
    constructor(opts: ToolCallRepairOptions);
    /** Called at start of every user turn — fresh intent shouldn't inherit old repetition state. */
    resetStorm(): void;
    process(declaredCalls: ToolCall[], reasoningContent: string | null, content?: string | null): {
        calls: ToolCall[];
        report: RepairReport;
    };
}

declare function costUsd(model: string, usage: Usage): number;
/** Input-side cost only (prompt, cache hit + miss). Used for the panel breakdown. */
declare function inputCostUsd(model: string, usage: Usage): number;
/** Output-side cost only (completion tokens). Used for the panel breakdown. */
declare function outputCostUsd(model: string, usage: Usage): number;
declare function claudeEquivalentCost(usage: Usage): number;
interface TurnStats {
    turn: number;
    model: string;
    usage: Usage;
    cost: number;
    cacheHitRatio: number;
}
interface SessionSummary {
    turns: number;
    totalCostUsd: number;
    totalInputCostUsd: number;
    /** Output-side (completion) cost aggregated across the session. */
    totalOutputCostUsd: number;
    /** @deprecated Claude reference; kept for benchmarks + replay compat, no longer surfaced in the TUI. */
    claudeEquivalentUsd: number;
    /** @deprecated. Same as claudeEquivalentUsd — synthetic ratio, not a real measurement. */
    savingsVsClaudePct: number;
    cacheHitRatio: number;
    /** Floor estimate for next call — actual cost = this + user delta + new tool outputs. */
    lastPromptTokens: number;
    lastTurnCostUsd: number;
}
declare class SessionStats {
    readonly turns: TurnStats[];
    /** Cost from prior runs of a resumed session, restored from session meta. */
    private _carryoverCost;
    /** Turn count from prior runs of a resumed session. */
    private _carryoverTurns;
    private _carryoverCacheHit;
    private _carryoverCacheMiss;
    /** Last turn's promptTokens before exit — surfaced via summary() until the next live turn lands. */
    private _carryoverLastPromptTokens;
    /** Seed totals from a resumed session's persisted meta — only call once at construction. */
    seedCarryover(opts: {
        totalCostUsd?: number;
        turnCount?: number;
        cacheHitTokens?: number;
        cacheMissTokens?: number;
        lastPromptTokens?: number;
    }): void;
    record(turn: number, model: string, usage: Usage): TurnStats;
    get totalCost(): number;
    get totalClaudeEquivalent(): number;
    get savingsVsClaude(): number;
    get totalInputCost(): number;
    get totalOutputCost(): number;
    get aggregateCacheHitRatio(): number;
    summary(): SessionSummary;
}

type EventRole = "assistant_delta" | "assistant_final"
/** Only liveness signal during a large-args tool call (no content/reasoning bytes). */
 | "tool_call_delta"
/** Pre-dispatch ping so the TUI can show a spinner during long tool awaits. */
 | "tool_start" | "tool" | "done" | "error" | "warning"
/** Transient indicator for silent phases; UI clears on next primary event. */
 | "status";
interface LoopEvent {
    turn: number;
    role: EventRole;
    content: string;
    reasoningDelta?: string;
    toolName?: string;
    /** Raw args JSON — needed by `reasonix diff` to explain why a tool was called. */
    toolArgs?: string;
    /** Cumulative arguments-string length for `role === "tool_call_delta"`. */
    toolCallArgsChars?: number;
    /** Zero-based index of the tool call this delta belongs to (multi-tool progress). */
    toolCallIndex?: number;
    /** Count of tool calls whose args have parsed as valid JSON (UI progress, not dispatch gate). */
    toolCallReadyCount?: number;
    /** Stable id for tool_start / tool pairs — also the inflight-set key. UI uses this as the card id so it can derive `running` from `loop.inflight.has(callId)` instead of trusting end-event delivery. */
    callId?: string;
    stats?: TurnStats;
    repair?: RepairReport;
    error?: string;
    /** Display-only — code-mode applier MUST skip SEARCH/REPLACE in forced-summary text. */
    forcedSummary?: boolean;
}

interface ImmutablePrefixOptions {
    system: string;
    toolSpecs?: readonly ToolSpec[];
    fewShots?: readonly ChatMessage[];
}
declare class ImmutablePrefix {
    /** Stable across turns; rebuilt only on /new when REASONIX.md changed on disk. */
    system: string;
    /** Each `addTool` costs one cache-miss turn — DeepSeek's prefix cache is keyed by full tool list. */
    private _toolSpecs;
    readonly fewShots: readonly ChatMessage[];
    /** Invalidated by addTool / removeTool / replaceSystem; bypassing any of those leaves cache stale → fingerprint diverges from sent prefix. */
    private _fingerprintCache;
    constructor(opts: ImmutablePrefixOptions);
    /** Replaces the system prompt; returns true iff the string actually changed. Caller must accept a cache miss on the next turn. */
    replaceSystem(s: string): boolean;
    get toolSpecs(): readonly ToolSpec[];
    toMessages(): ChatMessage[];
    tools(): ToolSpec[];
    addTool(spec: ToolSpec): boolean;
    /** Mirror of addTool for MCP hot-unbridge. Same cache-miss cost — prefix changes shape. */
    removeTool(name: string): boolean;
    get fingerprint(): string;
    /** Dev/test only — throws on cache drift, which always means a non-`addTool` mutation slipped in. */
    verifyFingerprint(): string;
    private computeFingerprint;
}
declare class AppendOnlyLog {
    private _entries;
    append(message: ChatMessage): void;
    extend(messages: ChatMessage[]): void;
    /** The one append-only-breaking path — reserved for `/compact` + recovery. Use `append()` otherwise. */
    compactInPlace(replacement: ChatMessage[]): void;
    get entries(): readonly ChatMessage[];
    toMessages(): ChatMessage[];
    get length(): number;
}
declare class VolatileScratch {
    reasoning: string | null;
    planState: Record<string, unknown> | null;
    notes: string[];
    reset(): void;
}

interface ToolCallContext {
    signal?: AbortSignal;
    /** Inject a mock PauseGate for tests. When absent, tools use the singleton. */
    confirmationGate?: PauseGate;
}
interface ToolDefinition<A = any, R = any> {
    name: string;
    description?: string;
    parameters?: JSONSchema;
    /** Safe in plan mode — registry refuses non-readonly calls when `planMode` is on. */
    readOnly?: boolean;
    /** Per-args check; takes precedence over `readOnly`. e.g. `run_command` + allowlisted argv. */
    readOnlyCheck?: (args: A) => boolean;
    /** Safe to dispatch concurrently with other parallel-safe calls in the same turn. Default false — opt-in only. */
    parallelSafe?: boolean;
    /** Excluded from repeat-loop storm accounting; use only for cheap, state-inspection tools. */
    stormExempt?: boolean;
    fn: (args: A, ctx?: ToolCallContext) => R | Promise<R>;
}
interface ToolRegistryOptions {
    /** Auto-flatten + re-nest at dispatch; default true. */
    autoFlatten?: boolean;
}
type ToolCallAuditEvent = {
    name: string;
    args: Record<string, unknown>;
};
type ToolCallAuditListener = (event: ToolCallAuditEvent) => void;
/** String return short-circuits dispatch; null/undefined falls through to the tool fn. */
type ToolInterceptor = (name: string, args: Record<string, unknown>) => string | null | undefined | Promise<string | null | undefined>;
/** Final-stage post-processor — runs on every dispatch return (success and error paths) so callers can append context like a remaining-budget hint. Whatever it returns becomes the dispatch result. */
type ToolResultAugmenter = (name: string, args: Record<string, unknown>, result: string) => string;
declare class ToolRegistry {
    private readonly _tools;
    private readonly _autoFlatten;
    private _planMode;
    private _interceptor;
    private _auditListener;
    private _resultAugmenter;
    /** Per-tool fingerprint of the last call that failed schema validation. Cleared by any successful validation for that tool. */
    private readonly _lastMalformed;
    constructor(opts?: ToolRegistryOptions);
    /** Enable / disable plan-mode enforcement at dispatch. */
    setPlanMode(on: boolean): void;
    /** True when the registry is currently refusing non-readonly calls. */
    get planMode(): boolean;
    /** At most one interceptor active; calling twice replaces. */
    setToolInterceptor(fn: ToolInterceptor | null): void;
    setAuditListener(fn: ToolCallAuditListener | null): void;
    /** Final-stage post-processor; replaces previous augmenter when called twice. Pass null to clear. */
    setResultAugmenter(fn: ToolResultAugmenter | null): void;
    /** True when an augmenter is already wired — lets late-installing callers skip clobbering an earlier one. */
    get hasResultAugmenter(): boolean;
    register<A, R>(def: ToolDefinition<A, R>): this;
    /** Drop a registered tool. Returns true if the name was present. Used by MCP hot-unbridge. */
    unregister(name: string): boolean;
    has(name: string): boolean;
    get(name: string): ToolDefinition | undefined;
    get size(): number;
    /** True if a registered tool's schema was flattened for the model. */
    wasFlattened(name: string): boolean;
    /** Unknown / unannotated tools default to false — third-party MCP tools must opt in. */
    isParallelSafe(name: string): boolean;
    specs(): ToolSpec[];
    dispatch(name: string, argumentsRaw: string | Record<string, unknown>, opts?: {
        signal?: AbortSignal;
        maxResultChars?: number;
        maxResultTokens?: number;
        /** Inject a mock PauseGate for tests. */
        confirmationGate?: PauseGate;
    }): Promise<string>;
    /** Records the failed call's fingerprint; on the 2nd consecutive identical malformed call to the same tool, returns a sharper error that tells the model to stop retrying. */
    private _noteMalformed;
}

interface CacheFirstLoopOptions {
    client: DeepSeekClient;
    prefix: ImmutablePrefix;
    tools?: ToolRegistry;
    model?: string;
    maxToolIters?: number;
    stream?: boolean;
    reasoningEffort?: "high" | "max";
    autoEscalate?: boolean;
    /** Soft USD cap — warns at 80%, refuses next turn at 100%. Opt-in (default no cap). */
    budgetUsd?: number;
    /** Per-turn repair/error signal count required to escalate flash→pro. Defaults to FAILURE_ESCALATION_THRESHOLD. Out-of-range values warn + fall back. */
    failureThreshold?: number;
    session?: string;
    /** PreToolUse + PostToolUse only — UserPromptSubmit / Stop live at the App boundary. */
    hooks?: ResolvedHook[];
    /** `cwd` reported to hooks; `reasonix code` sets this to the sandbox root, not shell home. */
    hookCwd?: string;
    /** PauseGate bridge — defaults to singleton, injectable for tests. */
    confirmationGate?: PauseGate;
    /** Re-runs the prompt builder (applyMemoryStack / codeSystemPrompt) on /new so REASONIX.md edits take effect without a restart. Accepting a cache miss is the price. */
    rebuildSystem?: () => string;
}
interface ReconfigurableOptions {
    model?: string;
    stream?: boolean;
    /** V4 thinking mode only; deepseek-chat ignores. */
    reasoningEffort?: "high" | "max";
    /** `false` pins to `model` — kills both NEEDS_PRO marker scavenge and failure-count threshold. */
    autoEscalate?: boolean;
}
declare class CacheFirstLoop {
    readonly client: DeepSeekClient;
    readonly prefix: ImmutablePrefix;
    readonly tools: ToolRegistry;
    readonly maxToolIters: number;
    readonly log: AppendOnlyLog;
    readonly scratch: VolatileScratch;
    readonly stats: SessionStats;
    readonly repair: ToolCallRepair;
    model: string;
    stream: boolean;
    reasoningEffort: "high" | "max";
    autoEscalate: boolean;
    budgetUsd: number | null;
    /** One-shot 80% warning latch — cleared by setBudget so a bump re-arms at the new boundary. */
    private _budgetWarned;
    sessionName: string | null;
    hooks: ResolvedHook[];
    hookCwd: string;
    /** PauseGate bridge — defaults to singleton, injectable for tests. */
    readonly confirmationGate: PauseGate;
    /** Number of messages that were pre-loaded from the session file. */
    readonly resumedMessageCount: number;
    private readonly _rebuildSystem;
    private _turn;
    private _streamPreference;
    /** Threaded through HTTP + every tool dispatch so Esc cancels in-flight work, not after. */
    private _turnAbort;
    /** Authoritative running-id set — UI cards consult this instead of trusting end-event delivery. Insert at dispatch entry, delete in finally. */
    private readonly _inflight;
    private _proArmedForNextTurn;
    private _escalateThisTurn;
    private readonly _turnFailures;
    private readonly _readOnlyLoop;
    private _turnSelfCorrected;
    private _foldedThisTurn;
    private _toolDispatchesThisStep;
    private context;
    /** Subscribe API so UI hooks can derive `running` from finally-guaranteed insertions. */
    get inflight(): InflightSet;
    get currentTurn(): number;
    constructor(opts: CacheFirstLoopOptions);
    /** Replace older turns with one summary message; keep tail within keepRecentTokens budget. */
    compactHistory(opts?: {
        keepRecentTokens?: number;
    }): Promise<{
        folded: boolean;
        beforeMessages: number;
        afterMessages: number;
        summaryChars: number;
    }>;
    appendAndPersist(message: ChatMessage): void;
    /** Swap the just-appended assistant entry — used by self-correction to restore the original tool_calls without dropping reasoning_content. */
    private replaceTailAssistantMessage;
    /** "New chat" — drops in-memory messages, archives the on-disk transcript so it survives in Sessions, keeps sessionName so the prefix cache stays warm. Re-runs the system-prompt builder if one was wired (issue #778: REASONIX.md edits otherwise need a restart). */
    clearLog(): {
        dropped: number;
        archived: string | null;
        systemRebuilt: boolean;
    };
    configure(opts: ReconfigurableOptions): void;
    /** `null` disables the cap; any change re-arms the 80% warning. */
    setBudget(usd: number | null): void;
    /** Single-turn upgrade consumed at next step() — distinct from `/preset max` (persistent). */
    armProForNextTurn(): void;
    /** Cancel `/pro` arming before the next turn starts. */
    disarmPro(): void;
    /** UI surface — true while `/pro` is queued but hasn't fired yet. */
    get proArmed(): boolean;
    /** UI surface — true while the current turn is running on pro (armed or auto-escalated). */
    get escalatedThisTurn(): boolean;
    /** UI surface — model id of the call about to run (or running) right now, including escalation. */
    get currentCallModel(): string;
    private modelForCurrentCall;
    /** Returns true ONLY on the tipping call — caller surfaces a one-shot warning. */
    private noteToolFailureSignal;
    /** Returns true ONLY on the call where the read-only streak crosses the threshold (#681). */
    private noteReadOnlyToolCall;
    /** A call counts as mutating when its definition reports `readOnly !== true` and any dynamic `readOnlyCheck` doesn't override that for these args. */
    private isMutating;
    private runOneToolCall;
    /** Stable per-call id used as the inflight key AND threaded into tool_start / tool events so the UI matches them up. */
    private inflightIdFor;
    private _inflightCounter;
    private buildMessages;
    abort(): void;
    /** Drop the last user message + everything after; caller re-sends. Persists to session file. */
    retryLastUser(): string | null;
    step(userInput: string): AsyncGenerator<LoopEvent>;
    private summaryContext;
    run(userInput: string, onEvent?: (ev: LoopEvent) => void): Promise<string>;
}

/** Expand `@path` mentions inline. Paths must resolve inside rootDir; escapes / oversize get a skip note, not content. */
/** Caps match tool-result dispatch truncation (0.5.2). */
declare const DEFAULT_AT_MENTION_MAX_BYTES: number;
/** Cap on entries returned for a `@<dir>` listing. ~200 paths × ~50 chars ≈ 10 KB — fits inside DEFAULT_AT_MENTION_MAX_BYTES with room for the rest of the prompt. */
declare const DEFAULT_AT_DIR_MAX_ENTRIES = 200;
/** Universally-uninteresting build / VCS dirs. Framework-specific dirs (Pods, target, …) live in .gitignore. */
declare const DEFAULT_PICKER_IGNORE_DIRS: readonly string[];
interface ListFilesOptions {
    /** Cap the walk once we've collected this many entries. Default 2000. */
    maxResults?: number;
    /** Directory names to skip entirely. Defaults to {@link DEFAULT_PICKER_IGNORE_DIRS}. */
    ignoreDirs?: readonly string[];
    /** Walk nested .gitignores (root + every subdir). Default true. */
    respectGitignore?: boolean;
}
/** Sync on purpose — fits the TUI's single-turn-per-tick model. Skips dot-DIRS but keeps dotfiles. */
declare function listFilesSync(root: string, opts?: ListFilesOptions): string[];
interface FileWithStats {
    /** Relative path with forward-slash separator. */
    path: string;
    /** Modification time (Date.getTime() / ms since epoch). 0 when stat failed. */
    mtimeMs: number;
}
/** Stat failures kept as `mtimeMs: 0` — entry still appears, sinks to bottom of recency sort. */
declare function listFilesWithStatsSync(root: string, opts?: ListFilesOptions): FileWithStats[];
/** Parallel stat per directory — Windows stat syscalls are 3-5× slower than Linux. */
declare function listFilesWithStatsAsync(root: string, opts?: ListFilesOptions): Promise<FileWithStats[]>;
interface StreamWalkOptions {
    ignoreDirs?: readonly string[];
    respectGitignore?: boolean;
    signal?: AbortSignal;
    /** Called per file entry. Return false to halt the walk. */
    onEntry: (entry: FileWithStats) => boolean | undefined;
    /** Called periodically with the running file-count. */
    onProgress?: (scanned: number) => void;
    /** Default 100ms — minimum gap between onProgress calls. */
    progressIntervalMs?: number;
}
/** Cancelable, streaming walker. Drives `listFilesWithStatsAsync` and the picker's search-mode walk. */
declare function walkFilesStream(root: string, opts: StreamWalkOptions): Promise<{
    scanned: number;
    cancelled: boolean;
}>;
interface DirEntry {
    name: string;
    /** Relative-to-root path (forward slashes). For dirs, no trailing slash. */
    path: string;
    isDir: boolean;
    /** 0 for directories (no stat), real mtime for files. */
    mtimeMs: number;
}
interface ListDirectoryOptions {
    ignoreDirs?: readonly string[];
    respectGitignore?: boolean;
}
/** One-level browse for the @-picker. Folders first then files, alpha within each group. Resolves outside-root to []. */
declare function listDirectory(root: string, relDir: string, opts?: ListDirectoryOptions): Promise<DirEntry[]>;
interface ParsedAtQuery {
    /** Directory portion (rel from root, no trailing slash). Empty = root. */
    dir: string;
    /** Filter portion — chars after the last slash. Empty if query ended in `/`. */
    filter: string;
    /** True if the query ended in `/` — caller knows to browse `dir`. */
    trailingSlash: boolean;
}
/** Split `src/auth/log` → `{dir: "src/auth", filter: "log"}`; trailing slash sets `trailingSlash` and clears filter. */
declare function parseAtQuery(query: string): ParsedAtQuery;
/** Trailing-token only, anchored at end-of-input — distinct from `AT_MENTION_PATTERN` which scans all. `\p{L}\p{N}` for CJK and other non-ASCII filenames. */
declare const AT_PICKER_PREFIX: RegExp;
declare function detectAtPicker(input: string): {
    query: string;
    atOffset: number;
} | null;
/** A candidate accepted by the picker ranker — either a bare path or a path with mtime. */
type PickerCandidate = string | FileWithStats;
interface RankPickerOptions {
    /** Upper bound on returned entries. Default 40. */
    limit?: number;
    recentlyUsed?: readonly string[];
}
declare function rankPickerCandidates(files: readonly PickerCandidate[], query: string, limitOrOpts?: number | RankPickerOptions): string[];
/** Word-boundary anchor rejects `@` embedded in emails / social handles; trailing `.` stripped before lookup. */
declare const AT_MENTION_PATTERN: RegExp;
interface AtMentionExpansion {
    /** The raw `@path` token as it appeared in the text. */
    token: string;
    /** The relative path, as resolved against rootDir. */
    path: string;
    /** True if the content was inlined. False = skipped (reason in `skip`). */
    ok: boolean;
    /** Bytes read (only for ok=true and isDirectory=false). */
    bytes?: number;
    /** True when the mention resolved to a directory (ok=true). Block uses `<directory>` instead of `<file>`. */
    isDirectory?: boolean;
    /** Number of files listed when isDirectory=true. */
    entries?: number;
    /** True iff the directory listing was clipped at maxDirEntries. */
    truncated?: boolean;
    /** Why the mention was skipped. Set when ok=false. */
    skip?: "missing" | "not-file" | "too-large" | "escape" | "read-error";
}
interface AtMentionOptions {
    /** Max file size in bytes before a mention is skipped. */
    maxBytes?: number;
    /** Cap on entries returned for a `@<dir>` listing. Default {@link DEFAULT_AT_DIR_MAX_ENTRIES}. */
    maxDirEntries?: number;
    fs?: {
        exists: (path: string) => boolean;
        isFile: (path: string) => boolean;
        /** Optional — when omitted, directories are skipped as `not-file`. */
        isDir?: (path: string) => boolean;
        /** Optional — receives the directory's absolute path and the project root, returns relative paths and a truncated flag. */
        listDir?: (dirAbs: string, root: string, max: number) => {
            files: string[];
            truncated: boolean;
        };
        size: (path: string) => number;
        read: (path: string) => string;
    };
}
declare function expandAtMentions(text: string, rootDir: string, opts?: AtMentionOptions): {
    text: string;
    expansions: AtMentionExpansion[];
};

/** Reads REASONIX.md → AGENTS.md → AGENT.md (first that exists); writes prefer the file already on disk. */
/** Default WRITE target — created when no candidate exists yet. */
declare const PROJECT_MEMORY_FILE = "REASONIX.md";
/** READ candidates, in priority order. AGENTS.md is the open spec at agents.md (Linux Foundation). */
declare const PROJECT_MEMORY_FILES: readonly ["REASONIX.md", "AGENTS.md", "AGENT.md"];
declare const PROJECT_MEMORY_MAX_CHARS = 8000;
/** Absolute path of the first PROJECT_MEMORY_FILES candidate that exists at rootDir, or null. */
declare function findProjectMemoryPath(rootDir: string): string | null;
/** Path callers should write to: an existing candidate wins, otherwise rootDir/REASONIX.md. */
declare function resolveProjectMemoryWritePath(rootDir: string): string;
interface ProjectMemory {
    /** Absolute path the memory was read from. */
    path: string;
    /** Post-truncation content (may include a "… (truncated N chars)" marker). */
    content: string;
    /** Original byte length before truncation. */
    originalChars: number;
    /** True iff `originalChars > PROJECT_MEMORY_MAX_CHARS`. */
    truncated: boolean;
}
/** Empty / whitespace-only files return null so they don't perturb the cache prefix. */
declare function readProjectMemory(rootDir: string): ProjectMemory | null;
declare function memoryEnabled(): boolean;
/** Deterministic — same memory file always yields the same prefix hash. */
declare function applyProjectMemory(basePrompt: string, rootDir: string): string;

type ThemeName = "default" | "dark" | "light" | "tokyo-night" | "github-dark" | "github-light" | "high-contrast";

type LanguageCode = "EN" | "zh-CN";

/** Shared exclude defaults + resolver — chunker, directory_tree, and dashboard read from here. */
interface IndexUserConfig {
    excludeDirs?: string[];
    excludeFiles?: string[];
    excludeExts?: string[];
    excludePatterns?: string[];
    respectGitignore?: boolean;
    maxFileBytes?: number;
}

/** Library reads only DEEPSEEK_API_KEY from env; the CLI bridges config.json → env var. */

/** Legacy `fast|smart|max` kept for back-compat with existing config.json files. */
type PresetName = "auto" | "flash" | "pro" | "fast" | "smart" | "max";
/** Single trust dial: review queues edits + gates shell; auto applies + gates shell; yolo skips both gates. */
type EditMode = "review" | "auto" | "yolo";
type ReasoningEffort = "high" | "max";
type EmbeddingProvider = "ollama" | "openai-compat";
interface OllamaEmbeddingUserConfig {
    baseUrl?: string;
    model?: string;
}
interface OpenAICompatEmbeddingUserConfig {
    baseUrl?: string;
    apiKey?: string;
    model?: string;
    extraBody?: Record<string, unknown>;
}
interface SemanticEmbeddingUserConfig {
    provider?: EmbeddingProvider;
    ollama?: OllamaEmbeddingUserConfig;
    openaiCompat?: OpenAICompatEmbeddingUserConfig;
}
interface ReasonixConfig {
    apiKey?: string;
    baseUrl?: string;
    lang?: LanguageCode;
    preset?: PresetName;
    editMode?: EditMode;
    editModeHintShown?: boolean;
    mouseClipboardHintShown?: boolean;
    reasoningEffort?: ReasoningEffort;
    /** Default workspace root for the desktop client. CLI uses cwd. */
    workspaceDir?: string;
    /** Last N workspace paths the desktop client has opened, most recent first. */
    recentWorkspaces?: string[];
    /** Desktop only — `openWith` value for clicking file links. Empty/undefined = OS default app. Examples: "code", "cursor", "C:\\path\\to\\editor.exe". */
    editor?: string;
    theme?: ThemeName | "auto";
    /** Stored as `--mcp`-format strings so one parser handles both flag and config. */
    mcp?: string[];
    /** Names of servers in `mcp` to skip on bridge — see `/mcp disable <name>`. */
    mcpDisabled?: string[];
    /** Env overlay per MCP server name (matches the `name=` prefix of the spec). Stdio transports merge this over process.env; SSE/HTTP ignore it. */
    mcpEnv?: Record<string, Record<string, string>>;
    session?: string | null;
    setupCompleted?: boolean;
    search?: boolean;
    /** Web search engine backend: "mojeek" (default, scrapes Mojeek) or "searxng" (self-hosted SearXNG). */
    webSearchEngine?: "mojeek" | "searxng";
    /** Base URL for SearXNG instance (default http://localhost:8080). */
    webSearchEndpoint?: string;
    dashboard?: {
        /** Pin the embedded dashboard to a fixed port — required for stable SSH tunnels. 0/absent → ephemeral. */
        port?: number;
    };
    escalation?: {
        /** Per-turn repair/error signal count required to escalate flash→pro. Defaults to 3. Out-of-range → default. */
        failureThreshold?: number;
    };
    /** Per-field visibility toggles for the bottom status row. All default to true (visible). */
    statusBar?: {
        showBalance?: boolean;
        showSessionCost?: boolean;
        showTurnCost?: boolean;
        showCacheHit?: boolean;
        showVersion?: boolean;
        showFeedbackHint?: boolean;
    };
    projects?: {
        [absoluteRootDir: string]: {
            shellAllowed?: string[];
            /** Absolute directory prefixes the user pre-approved for outside-sandbox file access (#684). */
            pathAllowed?: string[];
        };
    };
    index?: IndexUserConfig;
    semantic?: SemanticEmbeddingUserConfig;
    /** User-declared extensions to the built-in memory types (#709). Unknown types round-trip even without a declaration; declaring one lets you attach a default priority + lifecycle. */
    memory?: {
        customTypes?: CustomMemoryTypeConfig[];
    };
}
interface CustomMemoryTypeConfig {
    name: string;
    description?: string;
    priority?: "low" | "medium" | "high";
    expires?: "project_end";
}
declare function defaultConfigPath(): string;
declare function readConfig(path?: string): ReasonixConfig;
declare function writeConfig(cfg: ReasonixConfig, path?: string): void;
/** Resolve the API key from env var first, then the config file. */
declare function loadApiKey(path?: string): string | undefined;
/** env > config > undefined. Client falls back to api.deepseek.com when undefined. */
declare function loadBaseUrl(path?: string): string | undefined;
declare function saveBaseUrl(url: string, path?: string): void;
declare function saveApiKey(key: string, path?: string): void;
/** Self-hosted DeepSeek-compatible endpoints may issue any token shape, so we only typo-guard here — the real auth check is the first API call against `baseUrl`. */
declare function isPlausibleKey(key: string): boolean;
/** Mask a key for display: `sk-abcd...wxyz`. */
declare function redactKey(key: string): string;

/** User-private memory pinned into the immutable prefix; distinct from committable REASONIX.md. */

declare const USER_MEMORY_DIR = "memory";
declare const MEMORY_INDEX_FILE = "MEMORY.md";
/** Cap on the index file content loaded into the prefix, per scope. */
declare const MEMORY_INDEX_MAX_CHARS = 4000;
declare const BUILTIN_MEMORY_TYPES: readonly ["user", "feedback", "project", "reference"];
type BuiltinMemoryType = (typeof BUILTIN_MEMORY_TYPES)[number];
/** Built-ins plus any string declared in `config.memory.customTypes`. Unknown values are accepted (round-tripped verbatim). */
type MemoryType = BuiltinMemoryType | (string & {});
type MemoryScope = "global" | "project";
type MemoryPriority = "low" | "medium" | "high";
type MemoryExpires = "project_end";
interface MemoryEntry {
    name: string;
    type: MemoryType;
    scope: MemoryScope;
    description: string;
    body: string;
    /** ISO date string (YYYY-MM-DD). */
    createdAt: string;
    /** Explicit per-entry priority; absent → resolve from config default for `type`, else "medium". */
    priority?: MemoryPriority;
    /** Lifecycle hint. `project_end` → cleared by `/memory clear project`. */
    expires?: MemoryExpires;
}
interface MemoryStoreOptions {
    /** Override `~/.reasonix` — tests set this to a tmpdir. */
    homeDir?: string;
    /** Absolute sandbox root. Required to use `scope: "project"`. */
    projectRoot?: string;
}
interface WriteInput {
    name: string;
    type: MemoryType;
    scope: MemoryScope;
    description: string;
    body: string;
    priority?: MemoryPriority;
    expires?: MemoryExpires;
}
/** Throws on path-injection (../, /, leading dot). Allowed: 3-40 chars, alnum/_/-, interior `.`. */
declare function sanitizeMemoryName(raw: string): string;
/** Stable 16-hex-char hash of an absolute sandbox root path. */
declare function projectHash(rootDir: string): string;
declare class MemoryStore {
    private readonly homeDir;
    private readonly projectRoot;
    constructor(opts?: MemoryStoreOptions);
    /** Directory this store writes `scope` files into, creating it if needed. */
    dir(scope: MemoryScope): string;
    /** Absolute path to a memory file (no existence check). */
    pathFor(scope: MemoryScope, name: string): string;
    /** True iff this store is configured with a project scope available. */
    hasProjectScope(): boolean;
    loadIndex(scope: MemoryScope): {
        content: string;
        originalChars: number;
        truncated: boolean;
    } | null;
    /** Read one memory file's body (frontmatter stripped). Throws if missing. */
    read(scope: MemoryScope, name: string): MemoryEntry;
    /** Skips malformed files — index stays queryable even if one file is hand-edited into nonsense. */
    list(): MemoryEntry[];
    write(input: WriteInput): string;
    /** Delete one memory + its index line. No-op if the file is already gone. */
    delete(scope: MemoryScope, rawName: string): boolean;
    /** Sorted by name — same file set must produce byte-identical MEMORY.md for stable prefix hashing. */
    private regenerateIndex;
}
/** Empty index → omit the whole block (otherwise we'd add bytes to the prefix hash for nothing). */
declare function applyUserMemory(basePrompt: string, opts?: {
    homeDir?: string;
    projectRoot?: string;
    cfg?: ReasonixConfig;
}): string;
declare function applyMemoryStack(basePrompt: string, rootDir: string): string;

/** Native FS tools — sandbox enforced here, not delegated. `edit_file` takes a single SEARCH/REPLACE string. */

interface FilesystemToolsOptions {
    /** Absolute directory the tools may read/write. Paths outside this are refused. */
    rootDir: string;
    /** false → register only read-side tools. Default true. */
    allowWriting?: boolean;
    /** Per-read byte cap; floor against OOM on a multi-GB blob. */
    maxReadBytes?: number;
    /** Cap on total bytes from listing/grep tools — bounds tree-as-one-string accidents. */
    maxListBytes?: number;
}
declare function registerFilesystemTools(registry: ToolRegistry, opts: FilesystemToolsOptions): ToolRegistry;

/** Writes are eager but the prefix is NOT re-loaded mid-session — keeps prompt-cache stable. */

interface MemoryToolsOptions {
    /** Sandbox root for the `project` scope. Omit for chat mode. */
    projectRoot?: string;
    /** Override `~/.reasonix` (tests). */
    homeDir?: string;
}
declare function registerMemoryTools(registry: ToolRegistry, opts?: MemoryToolsOptions): ToolRegistry;

/** Branching primitive separate from submit_plan; throws ChoiceRequestedError so the TUI can mount a picker and the model stops. */

interface ChoiceOption {
    id: string;
    title: string;
    summary?: string;
}
declare class ChoiceRequestedError extends Error {
    readonly question: string;
    readonly options: ChoiceOption[];
    readonly allowCustom: boolean;
    constructor(question: string, options: ChoiceOption[], allowCustom: boolean);
    toToolResult(): {
        error: string;
        question: string;
        options: ChoiceOption[];
        allowCustom: boolean;
    };
}
interface ChoiceToolOptions {
    onChoiceRequested?: (question: string, options: ChoiceOption[]) => void;
}
declare function registerChoiceTool(registry: ToolRegistry, opts?: ChoiceToolOptions): ToolRegistry;

type PlanStepRisk = "low" | "med" | "high";
interface PlanStep {
    id: string;
    title: string;
    action: string;
    risk?: PlanStepRisk;
}
interface StepCompletion {
    kind: "step_completed";
    stepId: string;
    title?: string;
    result: string;
    notes?: string;
}

/** Plan-mode errors carry `toToolResult` so dispatch serializes structured payloads the TUI parses to mount pickers. */

declare class PlanProposedError extends Error {
    readonly plan: string;
    readonly steps?: PlanStep[];
    readonly summary?: string;
    constructor(plan: string, steps?: PlanStep[], summary?: string);
    toToolResult(): {
        error: string;
        plan: string;
        steps?: PlanStep[];
        summary?: string;
    };
}
/** Surgical replace of in-flight plan tail; submit_plan would reset done steps. */
declare class PlanRevisionProposedError extends Error {
    readonly reason: string;
    readonly remainingSteps: PlanStep[];
    readonly summary?: string;
    constructor(reason: string, remainingSteps: PlanStep[], summary?: string);
    toToolResult(): {
        error: string;
        reason: string;
        remainingSteps: PlanStep[];
        summary?: string;
    };
}

interface PlanToolOptions {
    onPlanSubmitted?: (plan: string, steps?: PlanStep[]) => void;
    onStepCompleted?: (update: StepCompletion) => void;
    onPlanRevisionProposed?: (reason: string, remainingSteps: PlanStep[], summary?: string) => void;
}
declare function registerPlanTool(registry: ToolRegistry, opts?: PlanToolOptions): ToolRegistry;

type TodoStatus = "pending" | "in_progress" | "completed";
interface TodoItem {
    content: string;
    status: TodoStatus;
    activeForm: string;
}
interface TodoToolOptions {
    onTodosUpdated?: (todos: TodoItem[]) => void;
}
declare function registerTodoTool(registry: ToolRegistry, opts?: TodoToolOptions): ToolRegistry;

/** Side-channel — subagents run inside a tool-dispatch frame, can't go through parent's `LoopEvent` stream. */
interface SubagentEvent {
    kind: "start" | "progress" | "end" | "inner" | "phase";
    /** Stable per-spawn id; lets the UI key parallel runs apart instead of overwriting one shared row. */
    runId: string;
    task: string;
    skillName?: string;
    model?: string;
    iter?: number;
    elapsedMs?: number;
    summary?: string;
    error?: string;
    turns?: number;
    costUsd?: number;
    usage?: Usage;
    /** When kind === "inner": the raw child loop event. Parent UI translates to a child summary. */
    inner?: LoopEvent;
    /** When kind === "phase": coarse status verb for the activity row. */
    phase?: "exploring" | "summarising";
}
interface SubagentSink {
    current: ((ev: SubagentEvent) => void) | null;
}
interface SubagentToolOptions {
    client: DeepSeekClient;
    defaultSystem?: string;
    projectRoot?: string;
    defaultModel?: string;
    maxToolIters?: number;
    maxResultChars?: number;
    sink?: SubagentSink;
}
/** Library surface only — `reasonix code` uses Skills `runAs: subagent` as the user-facing path. */
declare function registerSubagentTool(parentRegistry: ToolRegistry, opts: SubagentToolOptions): ToolRegistry;
/** Plan-mode state propagates — a subagent spawned under `/plan` MUST NOT escape it. */
declare function forkRegistryExcluding(parent: ToolRegistry, exclude: ReadonlySet<string>): ToolRegistry;

/** Background process registry for never-exiting commands; ready-signal detection short-circuits the startup wait. */
interface JobStartOptions {
    /** Absolute path to cwd for the spawned child. */
    cwd: string;
    /** Capped at 30; ready-signal match short-circuits. Default 3. */
    waitSec?: number;
    /** Signal plumbed through from the calling tool's AbortSignal. */
    signal?: AbortSignal;
    /** Total per-job output buffer cap (bytes). Default 64 KB. */
    maxBufferBytes?: number;
}
interface JobStartResult {
    jobId: number;
    pid: number | null;
    /** True iff the child was still running at the point we returned. */
    stillRunning: boolean;
    /** True iff a READY_SIGNALS pattern matched during the wait window. */
    readyMatched: boolean;
    /** Preview of combined stdout+stderr accumulated during the wait. */
    preview: string;
    /** If the child exited during the wait, its exit code; else null. */
    exitCode: number | null;
}
interface JobRecord {
    id: number;
    command: string;
    pid: number | null;
    startedAt: number;
    /** Exit code once the process terminates; null while running. */
    exitCode: number | null;
    /** Combined stdout+stderr, ring-trimmed. */
    output: string;
    /** Counts all bytes the child wrote, not just what's still buffered in `output`. */
    totalBytesWritten: number;
    /** True iff the child is still alive. */
    running: boolean;
    /** Error from spawn() itself (ENOENT, etc.) once surfaced. */
    spawnError?: string;
}
declare class JobRegistry {
    private readonly jobs;
    private nextId;
    /** Resolves on (a) ready signal, (b) early exit, or (c) waitSec deadline — child keeps running regardless. */
    start(command: string, opts: JobStartOptions): Promise<JobStartResult>;
    read(id: number, opts?: {
        since?: number;
        tailLines?: number;
    }): JobReadResult | null;
    waitForJob(id: number, opts?: {
        timeoutMs?: number;
        waitFor?: "exit" | "output-or-exit";
    }): Promise<JobWaitResult | null>;
    /** SIGTERM, wait graceMs, then SIGKILL. Idempotent on already-exited jobs. */
    stop(id: number, opts?: {
        graceMs?: number;
    }): Promise<JobRecord | null>;
    list(): JobRecord[];
    shutdown(deadlineMs?: number): Promise<void>;
    /** Count of still-running jobs — drives the TUI status-bar indicator. */
    runningCount(): number;
}
interface JobReadResult {
    output: string;
    /** Total bytes ever in the buffer (pre-slice). Caller passes back as `since`. */
    byteLength: number;
    running: boolean;
    exitCode: number | null;
    command: string;
    pid: number | null;
    spawnError?: string;
}
interface JobWaitResult {
    exited: boolean;
    exitCode: number | null;
    latestOutput: string;
}

interface RunCommandResult {
    exitCode: number | null;
    /** Combined stdout+stderr, truncated to `maxOutputChars` with a marker. */
    output: string;
    /** True when the process was killed for exceeding `timeoutSec`. */
    timedOut: boolean;
}
declare function runCommand(cmd: string, opts: {
    cwd: string;
    timeoutSec?: number;
    maxOutputChars?: number;
    signal?: AbortSignal;
}): Promise<RunCommandResult>;
interface ResolveExecutableOptions {
    platform?: NodeJS.Platform;
    env?: {
        PATH?: string;
        PATHEXT?: string;
    };
    isFile?: (path: string) => boolean;
    pathDelimiter?: string;
}
/** CreateProcess ignores PATHEXT — bare `npm` fails ENOENT under `shell:false` without this resolver. */
declare function resolveExecutable(cmd: string, opts?: ResolveExecutableOptions): string;
/** Windows workarounds: PATHEXT lookup + CVE-2024-27980 prohibition on direct `.cmd`/`.bat` spawn. */
declare function prepareSpawn(argv: readonly string[], opts?: ResolveExecutableOptions): {
    bin: string;
    args: string[];
    spawnOverrides: SpawnOptions;
};
/** Targets `-Command` only — PowerShell quoting is finicky enough that wrapping script-file mode could break it. */
declare function injectPowerShellUtf8(args: readonly string[]): string[] | null;
/** Single `&` (not `&&`) so the command still runs on Win7 where chcp can return non-zero. */
declare function withUtf8Codepage(cmdline: string): string;
/** Doubles embedded quotes per cmd.exe's `""` escape rule; bare alnum passes through unquoted. */
declare function quoteForCmdExe(arg: string): string;

/** No env / glob / backtick / `$(…)` expansion — prevents bypass of allowlist via concatenation. */
declare function tokenizeCommand(cmd: string): string[];
/** Up-front detection — without it, `dir | findstr foo` quotes `|` literal and pipe silently fails. */
declare function detectShellOperator(cmd: string): string | null;
/** Allowlist match on leading argv tokens; demoted by `RISKY_ARGS` when a destructive flag appears in the tail. */
declare function isAllowed(cmd: string, extra?: readonly string[]): boolean;

/** cwd pinned to root; non-allowlisted commands throw to a UI confirm gate; spawn is `shell: false`, tokenized argv only. */

interface ShellToolsOptions {
    /** Directory to run commands in. Must be an absolute path. */
    rootDir: string;
    /** Seconds before an individual command is killed. Default: 60. */
    timeoutSec?: number;
    maxOutputChars?: number;
    /** Getter form is load-bearing — newly-persisted "always allow" prefixes MUST take effect mid-session. */
    extraAllowed?: readonly string[] | (() => readonly string[]);
    /** Getter form lets `editMode === "yolo"` flip mid-session without re-registering tools. */
    allowAll?: boolean | (() => boolean);
    jobs?: JobRegistry;
}
/** Error thrown by `run_command` when the command isn't allowlisted. */
declare class NeedsConfirmationError extends Error {
    readonly command: string;
    constructor(command: string);
}
declare function registerShellTools(registry: ToolRegistry, opts: ShellToolsOptions): ToolRegistry;
declare function formatCommandResult(cmd: string, r: RunCommandResult): string;

/** web_search uses Mojeek (DDG returns anti-bot 202 to unauthenticated POSTs); web_fetch sniffs HTML to text. */

interface SearchResult {
    title: string;
    url: string;
    snippet: string;
}
interface PageContent {
    url: string;
    title?: string;
    text: string;
    /** True when the extracted text was clipped to fit the cap. */
    truncated: boolean;
}
interface WebFetchOptions {
    /** Max bytes of extracted text. Defaults to 32_000 to match tool-result cap. */
    maxChars?: number;
    /** Timeout in ms. Defaults to 15_000. */
    timeoutMs?: number;
    signal?: AbortSignal;
}
interface WebSearchOptions {
    topK?: number;
    signal?: AbortSignal;
    /** Backend engine: "mojeek" (scrapes Mojeek HTML) or "searxng" (self-hosted SearXNG JSON API). */
    engine?: "mojeek" | "searxng";
    /** Base URL for SearXNG. Default http://localhost:8080. */
    endpoint?: string;
}
/** Distinguishes "truly 0 results" from "layout changed / blocked" so callers can tell. */
declare function webSearch(query: string, opts?: WebSearchOptions): Promise<SearchResult[]>;
/** Parse SearXNG HTML search results using node-html-parser. */
declare function parseSearxngHtmlResults(html: string): SearchResult[];
/** Title-anchor + snippet-paragraph passes paired positionally — robust to attribute reorder. */
declare function parseMojeekResults(html: string): SearchResult[];
declare function webFetch(url: string, opts?: WebFetchOptions): Promise<PageContent>;
declare function htmlToText(html: string): string;
interface WebToolsOptions {
    /** Default top-K for `web_search` when the model doesn't specify. */
    defaultTopK?: number;
    /** Byte cap for `web_fetch` extracted text. */
    maxFetchChars?: number;
    /** Backend engine: "mojeek" (default, scrapes Mojeek) or "searxng" (self-hosted SearXNG). */
    webSearchEngine?: "mojeek" | "searxng";
    /** Base URL for SearXNG (default http://localhost:8080). */
    webSearchEndpoint?: string;
}
declare function registerWebTools(registry: ToolRegistry, opts?: WebToolsOptions): ToolRegistry;
declare function formatSearchResults(query: string, results: SearchResult[]): string;

/** JSONL append-only message log under `~/.reasonix/sessions/`; concurrent-write safe. */

interface SessionInfo {
    name: string;
    path: string;
    size: number;
    messageCount: number;
    mtime: Date;
    meta: SessionMeta;
}
interface SessionMeta {
    branch?: string;
    summary?: string;
    totalCostUsd?: number;
    turnCount?: number;
    /** Absolute path of the workspace root the session was created/used in. */
    workspace?: string;
    /** Wallet currency at last save — used to format `totalCostUsd` in the picker without re-fetching balance. */
    balanceCurrency?: string;
    /** Cumulative cache hit / miss tokens across the session — survives resume so /status cache% isn't 0 on a fresh boot. */
    cacheHitTokens?: number;
    cacheMissTokens?: number;
    /** Last turn's promptTokens — lets /status render the context bar before the next turn fires. */
    lastPromptTokens?: number;
}
declare function sessionsDir(): string;
declare function sessionPath(name: string): string;
declare function sanitizeName(name: string): string;
declare function loadSessionMessages(name: string): ChatMessage[];
declare function appendSessionMessage(name: string, message: ChatMessage): void;
declare function listSessions(): SessionInfo[];
declare function deleteSession(name: string): boolean;

declare function loadDotenv(path?: string): void;

/** Transcripts are receipts (cost/usage/prefix); sessions are memory (ChatMessages). Don't conflate. */

interface TranscriptRecord {
    /** ISO-8601 timestamp at emit time. */
    ts: string;
    /** 1-based turn number within the session. */
    turn: number;
    /** LoopEvent role — "assistant_delta" | "assistant_final" | "tool" | "done" | ... */
    role: string;
    /** For assistant events, the final (or delta) text; for tool events, the tool result. */
    content: string;
    /** Tool name (role === "tool"). */
    tool?: string;
    /** JSON-string args the model sent for a tool call (role === "tool"). Persisted so diff can explain *why* two runs made different calls. */
    args?: string;
    /** DeepSeek token-usage snapshot (role === "assistant_final"). */
    usage?: RawUsage;
    /** USD cost of this turn (role === "assistant_final"). */
    cost?: number;
    /** Model id that produced this turn. */
    model?: string;
    /** Lets diff attribute cache-hit delta to log stability vs prompt change. */
    prefixHash?: string;
    /** Optional error message (role === "error"). */
    error?: string;
}
interface TranscriptMeta {
    version: 1;
    source: string;
    model?: string;
    task?: string;
    mode?: string;
    repeat?: number;
    startedAt: string;
}
interface ReadTranscriptResult {
    meta: TranscriptMeta | null;
    records: TranscriptRecord[];
}
declare function recordFromLoopEvent(ev: LoopEvent, extra: {
    model: string;
    prefixHash: string;
}): TranscriptRecord;
/**
 * Append a record to an open write stream. Caller owns the stream lifecycle.
 */
declare function writeRecord(stream: WriteStream, record: TranscriptRecord): void;
/**
 * Write a _meta line to an open write stream. Call exactly once, at the top.
 */
declare function writeMeta(stream: WriteStream, meta: TranscriptMeta): void;
/**
 * Convenience: open a stream, write meta, return stream.
 */
declare function openTranscriptFile(path: string, meta: TranscriptMeta): WriteStream;
/** Tolerant: empty / malformed lines skipped, missing optionals OK — live chats may be mid-write. */
declare function readTranscript(path: string): ReadTranscriptResult;
declare function parseTranscript(raw: string): ReadTranscriptResult;

/** Reconstruct session economics from a transcript alone — offline audit, no API key. */

interface ReplayStats extends SessionSummary {
    /** Per-turn stats, in turn order. Only assistant_final records contribute. */
    perTurn: TurnStats[];
    /** Unique models that appeared in the transcript's assistant_final records. */
    models: string[];
    /** Unique prefix hashes that appeared. Length > 1 means the prefix churned (cache-hostile). */
    prefixHashes: string[];
    /** Count of user-role records (user turns issued). */
    userTurns: number;
    /** Count of tool-role records (tool calls executed). */
    toolCalls: number;
}
declare function replayFromFile(path: string): {
    parsed: ReadTranscriptResult;
    stats: ReplayStats;
};
declare function computeReplayStats(records: TranscriptRecord[]): ReplayStats;

/** Transcript diff — pairs assistant_final by turn number; unmatched extras become only_in_a / only_in_b. */

interface DiffSide {
    label: string;
    meta: ReadTranscriptResult["meta"];
    records: TranscriptRecord[];
    stats: ReplayStats;
}
interface TurnPair {
    turn: number;
    aAssistant?: TranscriptRecord;
    bAssistant?: TranscriptRecord;
    aTools: TranscriptRecord[];
    bTools: TranscriptRecord[];
    kind: "match" | "diverge" | "only_in_a" | "only_in_b";
    /** When kind === "diverge", a short one-liner pointing at what differs. */
    divergenceNote?: string;
}
interface DiffReport {
    a: DiffSide;
    b: DiffSide;
    pairs: TurnPair[];
    firstDivergenceTurn: number | null;
}
declare function diffTranscripts(a: {
    label: string;
    parsed: ReadTranscriptResult;
}, b: {
    label: string;
    parsed: ReadTranscriptResult;
}): DiffReport;
/** Falls back to token-overlap above 2000 chars to keep diff fast on chatty transcripts. */
declare function similarity(a: string, b: string): number;
interface RenderOptions {
    /** Monochrome output (for file redirection or piping). Defaults to true. */
    monochrome?: boolean;
}
declare function renderSummaryTable(report: DiffReport, _opts?: RenderOptions): string;
declare function renderMarkdown(report: DiffReport): string;

/** MCP types (spec 2024-11-05). Stdio wire format is NDJSON — one JSON-RPC message per line, no Content-Length framing. */
type JsonRpcId = string | number;
interface JsonRpcRequest<P = unknown> {
    jsonrpc: "2.0";
    id: JsonRpcId;
    method: string;
    params?: P;
}
interface JsonRpcNotification<P = unknown> {
    jsonrpc: "2.0";
    method: string;
    params?: P;
}
interface JsonRpcSuccess<R = unknown> {
    jsonrpc: "2.0";
    id: JsonRpcId;
    result: R;
}
interface JsonRpcError {
    jsonrpc: "2.0";
    id: JsonRpcId | null;
    error: {
        /** JSON-RPC standard codes: -32700 parse, -32600 invalid request, -32601 method not found, -32602 invalid params, -32603 internal. MCP also defines its own range. */
        code: number;
        message: string;
        data?: unknown;
    };
}
type JsonRpcResponse<R = unknown> = JsonRpcSuccess<R> | JsonRpcError;
type JsonRpcMessage = JsonRpcRequest | JsonRpcNotification | JsonRpcSuccess | JsonRpcError;
interface McpClientInfo {
    name: string;
    version: string;
}
interface InitializeResult {
    protocolVersion: string;
    serverInfo: {
        name: string;
        version: string;
    };
    capabilities: {
        tools?: {
            listChanged?: boolean;
        };
        resources?: unknown;
        prompts?: unknown;
    };
    instructions?: string;
}
interface McpToolSchema {
    /** JSON Schema — compatible with Reasonix's tools.ts JSONSchema shape. */
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
    [extra: string]: unknown;
}
interface McpTool {
    name: string;
    description?: string;
    /** MCP calls this `inputSchema`. Reasonix's `parameters` field is the same concept. */
    inputSchema: McpToolSchema;
}
interface ListToolsResult {
    tools: McpTool[];
    nextCursor?: string;
}
interface ProgressNotificationParams {
    progressToken: string | number;
    progress: number;
    total?: number;
    message?: string;
}
/** Values a `ProgressHandler` receives — `progressToken` is already matched away. */
interface McpProgressInfo {
    progress: number;
    total?: number;
    message?: string;
}
type McpProgressHandler = (info: McpProgressInfo) => void;
interface McpContentBlockText {
    type: "text";
    text: string;
}
interface McpContentBlockImage {
    type: "image";
    data: string;
    mimeType: string;
}
/** MCP result content is an array of typed blocks. Reasonix consumes only text for now — image blocks get stringified with a placeholder. */
type McpContentBlock = McpContentBlockText | McpContentBlockImage;
interface CallToolResult {
    content: McpContentBlock[];
    /** True = tool raised an error; the content describes it. */
    isError?: boolean;
}
interface McpResource {
    uri: string;
    name: string;
    description?: string;
    /** Hint for the content type (e.g. "text/markdown"). Purely informational. */
    mimeType?: string;
}
interface ListResourcesResult {
    resources: McpResource[];
    nextCursor?: string;
}
/** Server populates exactly one of `text` (UTF-8) or `blob` (base64) per entry. */
interface McpResourceContentsText {
    uri: string;
    mimeType?: string;
    text: string;
}
interface McpResourceContentsBlob {
    uri: string;
    mimeType?: string;
    blob: string;
}
type McpResourceContents = McpResourceContentsText | McpResourceContentsBlob;
interface ReadResourceResult {
    contents: McpResourceContents[];
}
interface McpPromptArgument {
    name: string;
    description?: string;
    required?: boolean;
}
interface McpPrompt {
    name: string;
    description?: string;
    arguments?: McpPromptArgument[];
}
interface ListPromptsResult {
    prompts: McpPrompt[];
    nextCursor?: string;
}
interface McpPromptMessage {
    role: "user" | "assistant";
    content: McpContentBlock | McpPromptResourceBlock;
}
interface McpPromptResourceBlock {
    type: "resource";
    resource: McpResourceContents;
}
interface GetPromptResult {
    description?: string;
    messages: McpPromptMessage[];
}
/** Current MCP protocol version Reasonix is coded against. */
declare const MCP_PROTOCOL_VERSION = "2024-11-05";
/** Type guard — success vs error response. */
declare function isJsonRpcError(msg: JsonRpcResponse): msg is JsonRpcError;

/** MCP stdio = newline-delimited JSON-RPC; transport iface lets tests fake it without spawning. */

interface McpTransport {
    /** Send one JSON-RPC message. Resolves when the bytes are accepted. */
    send(message: JsonRpcMessage): Promise<void>;
    /** Async iterator over incoming messages. Ends when the connection closes. */
    messages(): AsyncIterableIterator<JsonRpcMessage>;
    /** Close the underlying resource (kill child process, close streams). */
    close(): Promise<void>;
}
interface StdioTransportOptions {
    /** Argv to spawn. First element is the command. */
    command: string;
    args?: string[];
    /** Env overlay — merged over process.env unless replaceEnv=true. */
    env?: Record<string, string>;
    /** When true, only the env above is visible to the child. Default false. */
    replaceEnv?: boolean;
    /** CWD for the child. Default: process.cwd(). */
    cwd?: string;
    /** Default true on win32 to resolve `.cmd`/`.bat` wrappers (npx.cmd etc.). */
    shell?: boolean;
}
declare class StdioTransport implements McpTransport {
    private readonly child;
    private readonly queue;
    private readonly waiters;
    private closed;
    private stdoutBuffer;
    constructor(opts: StdioTransportOptions);
    send(message: JsonRpcMessage): Promise<void>;
    messages(): AsyncIterableIterator<JsonRpcMessage>;
    close(): Promise<void>;
    /** Parse incoming stdout chunks into NDJSON messages. */
    private onStdout;
    private onClose;
    private push;
}

interface McpClientOptions {
    transport: McpTransport;
    clientInfo?: McpClientInfo;
    /** Per-request timeout. Default 60s. */
    requestTimeoutMs?: number;
}
declare class McpClient {
    private readonly transport;
    private readonly clientInfo;
    private readonly requestTimeoutMs;
    private readonly pending;
    private nextId;
    private readerStarted;
    private initialized;
    private _serverCapabilities;
    private _serverInfo;
    private _protocolVersion;
    private _instructions;
    private readonly progressHandlers;
    private nextProgressToken;
    constructor(opts: McpClientOptions);
    /** Server's advertised capabilities, available after initialize(). */
    get serverCapabilities(): InitializeResult["capabilities"];
    /** Server's self-reported name + version, available after initialize(). */
    get serverInfo(): InitializeResult["serverInfo"];
    /** Protocol version the server agreed to during the handshake. */
    get protocolVersion(): string;
    /** Optional free-form instructions the server provides at handshake. */
    get serverInstructions(): string | undefined;
    /** Compliant servers reject other methods until this completes. */
    initialize(): Promise<InitializeResult>;
    /** List tools the server exposes. */
    listTools(): Promise<ListToolsResult>;
    /** Abort sends `notifications/cancelled` and rejects immediately; late server responses are dropped. */
    callTool(name: string, args?: Record<string, unknown>, opts?: {
        onProgress?: McpProgressHandler;
        signal?: AbortSignal;
    }): Promise<CallToolResult>;
    /** Throws on method-not-found; callers should gate on `serverCapabilities.resources` first. */
    listResources(cursor?: string): Promise<ListResourcesResult>;
    /** Read the contents of a resource by URI. */
    readResource(uri: string): Promise<ReadResourceResult>;
    /** List prompt templates the server exposes. */
    listPrompts(cursor?: string): Promise<ListPromptsResult>;
    getPrompt(name: string, args?: Record<string, string>): Promise<GetPromptResult>;
    /** Close the transport and reject any outstanding requests. */
    close(): Promise<void>;
    private assertInitialized;
    private request;
    private startReaderIfNeeded;
    private readLoop;
    private dispatch;
}

/** MCP HTTP+SSE transport (spec 2024-11-05) — POST endpoint URL arrives as the first `event: endpoint` SSE frame. */

interface SseTransportOptions {
    /** SSE endpoint URL, e.g. `https://mcp.example.com/sse`. */
    url: string;
    /** Extra headers sent on both the SSE GET and the JSON-RPC POSTs (e.g. `Authorization`). */
    headers?: Record<string, string>;
}
declare class SseTransport implements McpTransport {
    private readonly url;
    private readonly headers;
    private readonly queue;
    private readonly waiters;
    private readonly controller;
    private closed;
    private postUrl;
    private readonly endpointReady;
    private resolveEndpoint;
    private rejectEndpoint;
    constructor(opts: SseTransportOptions);
    send(message: JsonRpcMessage): Promise<void>;
    messages(): AsyncIterableIterator<JsonRpcMessage>;
    close(): Promise<void>;
    private runStream;
    private handleEvent;
    private failHandshake;
    private pushMessage;
    private pushError;
    private markClosed;
}

/** MCP Streamable HTTP transport (2025-03-26) — POST-only; no long-lived GET stream, no Last-Event-ID resume. */

interface StreamableHttpTransportOptions {
    /** Streamable HTTP endpoint URL, e.g. `https://mcp.example.com/mcp`. */
    url: string;
    /** Extra headers sent on every request (e.g. `Authorization`). */
    headers?: Record<string, string>;
}
declare class StreamableHttpTransport implements McpTransport {
    private readonly url;
    private readonly extraHeaders;
    private readonly queue;
    private readonly waiters;
    private readonly controller;
    /** Session id minted by server on (typically) the initialize response. */
    private sessionId;
    private closed;
    /** Background SSE read-loops kicked off by send(); awaited on close(). */
    private readonly streams;
    constructor(opts: StreamableHttpTransportOptions);
    send(message: JsonRpcMessage): Promise<void>;
    messages(): AsyncIterableIterator<JsonRpcMessage>;
    close(): Promise<void>;
    /** Visible for tests — confirm session header round-trip. */
    getSessionId(): string | null;
    private consumeStream;
    private pushMessage;
}

/** Per-server ring-buffered latency tracker; emits a "slow" event on threshold cross only. */
interface SlowEvent {
    serverName: string;
    p95Ms: number;
    sampleSize: number;
}
interface LatencyTrackerOptions {
    thresholdMs?: number;
    onSlow?: (ev: SlowEvent) => void;
}
declare class LatencyTracker {
    private readonly serverName;
    private samples;
    private wasOverThreshold;
    private readonly thresholdMs;
    private readonly onSlow?;
    constructor(serverName: string, opts?: LatencyTrackerOptions);
    record(elapsedMs: number): void;
}

interface BridgeOptions {
    /** Prefix for tool names — disambiguates collisions when bridging multiple servers. */
    namePrefix?: string;
    /** Registry to populate. Creates a fresh one if omitted. */
    registry?: ToolRegistry;
    /** Auto-flatten deep schemas (Pillar 3). Defaults to the registry's own default (true). */
    autoFlatten?: boolean;
    /** Cap on tool result chars; head+tail truncation. Floor against context-poisoning oversized reads. */
    maxResultChars?: number;
    /** Absent → no `_meta.progressToken` sent and server won't emit progress. */
    onProgress?: (info: {
        toolName: string;
        progress: number;
        total?: number;
        message?: string;
    }) => void;
    /** Server name used to tag latency samples + slow events. Falls through to namePrefix without trailing `_`. */
    serverName?: string;
    /** p95 cutoff in ms before a slow event fires — defaults to 4000. */
    slowThresholdMs?: number;
    /** Fired exactly when the per-server p95 transitions over `slowThresholdMs`. */
    onSlow?: (ev: SlowEvent) => void;
    /** Indirection so reconnect can swap the underlying client without re-registering tools. */
    host?: McpClientHost;
    /** Awaited before each `callTool` — resolves on `connected`, rejects on `failed`, caps via `readyTimeoutMs`. */
    ready?: Promise<void>;
    /** How long to wait on `ready` before failing the dispatch. Default 30_000ms. */
    readyTimeoutMs?: number;
}
/** Mutable holder so `/mcp reconnect` can swap the underlying client without re-bridging tools. */
interface McpClientHost {
    client: McpClient;
}
declare const DEFAULT_MAX_RESULT_CHARS = 32000;
/** ~6% of DeepSeek V3 context. Char cap alone fails on CJK (~1 char/token). */
declare const DEFAULT_MAX_RESULT_TOKENS = 8000;
interface BridgeResult {
    registry: ToolRegistry;
    /** Names actually registered (may differ from MCP names when a prefix is applied). */
    registeredNames: string[];
    /** Names the server listed but the bridge skipped (e.g. invalid schemas). */
    skipped: Array<{
        name: string;
        reason: string;
    }>;
}
/** Resolved bridge environment that `registerSingleMcpTool` needs. Stored on summaries so reconnect can append new tools later. */
interface BridgeEnv {
    registry: ToolRegistry;
    host: McpClientHost;
    prefix: string;
    maxResultChars: number;
    tracker: LatencyTracker | null;
    onProgress?: BridgeOptions["onProgress"];
    /** Optional readiness gate awaited before each `callTool` dispatch. */
    ready?: Promise<void>;
    /** Timeout for waiting on `ready` — milliseconds. Defaults to DEFAULT_READY_TIMEOUT_MS. */
    readyTimeoutMs?: number;
    /** Server name surfaced in timeout errors. Defaults to the prefix or "anon". */
    serverName?: string;
}
declare function bridgeMcpTools(client: McpClient, opts?: BridgeOptions): Promise<BridgeResult & {
    env: BridgeEnv;
}>;
interface FlattenOptions {
    /** Cap the flattened string at this many characters. Default: no cap. */
    maxChars?: number;
}
declare function flattenMcpResult(result: CallToolResult, opts?: FlattenOptions): string;
/** Head + 1KB tail so error messages at end of stack traces aren't lost. */
declare function truncateForModel(s: string, maxChars: number): string;
/** Never tokenizes full input — pathological repetitive text (`AAAA…`) costs 30s+ on the pure-TS BPE port. */
declare function truncateForModelByTokens(s: string, maxTokens: number): string;

/** Plain http:// stays HTTP+SSE for back-compat; Streamable HTTP is opt-in via the `streamable+` URL prefix. */
interface StdioMcpSpec {
    transport: "stdio";
    /** Namespace prefix applied to each registered tool, or null if anonymous. */
    name: string | null;
    /** Argv[0]. */
    command: string;
    /** Remaining argv. */
    args: string[];
}
interface SseMcpSpec {
    transport: "sse";
    name: string | null;
    /** Fully qualified SSE endpoint URL. */
    url: string;
}
interface StreamableHttpMcpSpec {
    transport: "streamable-http";
    name: string | null;
    /** Fully qualified Streamable HTTP endpoint URL (no `streamable+` prefix). */
    url: string;
}
type McpSpec = StdioMcpSpec | SseMcpSpec | StreamableHttpMcpSpec;
declare function parseMcpSpec(input: string): McpSpec;

/** Unsupported list methods surface as `{supported:false}` instead of throwing — minimal servers still get a clean report. */

interface InspectionReport {
    protocolVersion: string;
    serverInfo: {
        name: string;
        version: string;
    };
    capabilities: Record<string, unknown>;
    instructions?: string;
    tools: SectionResult<McpTool>;
    resources: SectionResult<McpResource>;
    prompts: SectionResult<McpPrompt>;
    /** Wall-clock for the three list calls combined; surfaced as the server's "p95-ish" latency in the browser. */
    elapsedMs: number;
}
type SectionResult<T> = {
    supported: true;
    items: T[];
} | {
    supported: false;
    reason: string;
};
/** Caller owns initialize() / close() — keeps this pure so tests can feed a FakeMcpTransport. */
declare function inspectMcpServer(client: McpClient): Promise<InspectionReport>;

/** SEARCH must match byte-for-byte; empty SEARCH = create new file. No fuzzy match — silent wrong edit beats a missing one. */
interface EditBlock {
    /** Path as written by the model — relative to rootDir, or absolute. */
    path: string;
    /** Literal text to match in the target file. Empty → create new file. */
    search: string;
    /** Replacement text to write in place of `search`. */
    replace: string;
    /** Char offset in the source message where this block started. */
    offset: number;
}
type ApplyStatus = 
/** Edit landed on disk. */
"applied"
/** New file created (SEARCH was empty and file didn't exist). */
 | "created"
/** File exists but SEARCH block wasn't found in its content. */
 | "not-found"
/** File doesn't exist and SEARCH was non-empty (can't create without content). */
 | "file-missing"
/** Path escapes rootDir — refused on safety grounds. */
 | "path-escape"
/** fs write / read threw. */
 | "error";
interface ApplyResult {
    path: string;
    status: ApplyStatus;
    /** Extra detail (e.g. error message) for logs. */
    message?: string;
}
declare function parseEditBlocks(text: string): EditBlock[];
declare function applyEditBlock(block: EditBlock, rootDir: string): ApplyResult;
declare function applyEditBlocks(blocks: EditBlock[], rootDir: string): ApplyResult[];
interface EditSnapshot {
    /** Path relative to rootDir, as the block named it. */
    path: string;
    /** `null` = file didn't exist; restore means delete. */
    prevContent: string | null;
}
/** De-duped by path — one "before" snapshot per file even with multiple blocks. */
declare function snapshotBeforeEdits(blocks: EditBlock[], rootDir: string): EditSnapshot[];
declare function restoreSnapshots(snapshots: EditSnapshot[], rootDir: string): ApplyResult[];

/** Backward-compat — public-API const, frozen at the historical flash phrasing. Internal callers use codeSystemPrompt(rootDir, { modelId }) so the contract names the real tier (#582). */
declare const CODE_SYSTEM_PROMPT: string;
interface CodeSystemPromptOptions {
    /** True when semantic_search is registered for this run. Adds an
     *  explicit routing fragment so the model picks it for intent-style
     *  queries instead of defaulting to grep. */
    hasSemanticSearch?: boolean;
    /** Inline string appended after the generated code system prompt.
     *  Preserves the default prompt — this is append-only, not a replacement. */
    systemAppend?: string;
    /** UTF-8 file contents appended after the generated code system prompt.
     *  Preserves the default prompt — this is append-only, not a replacement. */
    systemAppendFile?: string;
    /** Model the loop will run on — interpolated into the escalation contract so the model can name itself correctly when asked (#582). */
    modelId?: string;
}
declare function codeSystemPrompt(rootDir: string, opts?: CodeSystemPromptOptions): string;

/** VERSION sourced from package.json so it never drifts from npm; latest-check returns null on any failure. */
/** TTL for the on-disk cache entry. 24h keeps noise low; users who
 * want a fresh check can run `reasonix update` which passes
 * `force: true`. */
declare const LATEST_CACHE_TTL_MS: number;
/** Network timeout. Short — we never block the UI waiting on this. */
declare const LATEST_FETCH_TIMEOUT_MS = 2000;
declare const VERSION: string;
interface GetLatestVersionOptions {
    /** Ignore the cached entry and always fetch fresh. Used by `reasonix update`. */
    force?: boolean;
    /** Registry URL override (tests). */
    registryUrl?: string;
    /** Home-directory override (tests). */
    homeDir?: string;
    /** Fetch implementation override (tests). Defaults to `globalThis.fetch`. */
    fetchImpl?: typeof fetch;
    /** TTL override (tests). */
    ttlMs?: number;
    /** Network timeout override (tests). */
    timeoutMs?: number;
}
/** Returns null on failure; cache only writes on success so bad responses can't poison it. */
declare function getLatestVersion(opts?: GetLatestVersionOptions): Promise<string | null>;
/** Pre-release with same core sorts BELOW the bare version — matches npm `latest` dist-tag semantics. */
declare function compareVersions(a: string, b: string): number;
type InstallSource = "npm" | "bun" | "pnpm" | "yarn" | "npx" | "unknown";
/** Each manager owns a unique global path segment, so argv[1] tells us who installed us. */
declare function detectInstallSource(bin?: string): InstallSource;
/** Returns null when no path is given. Callers must check installSource first. */
declare function isNpxInstall(): boolean;
/** Pin npm to the install location via --prefix so `nvm use` doesn't redirect the install elsewhere. */
declare function detectNpmInstallPrefix(bin?: string): string | null;

/** Append-only JSONL of per-turn tokens + cost; best-effort writes, never blocks the turn. No prompts/completions logged. */

/** One turn's snapshot — serialized verbatim as a JSONL line. */
interface UsageRecord {
    /** Epoch millis when the record was written. */
    ts: number;
    /** Session name if the turn ran inside a persisted session, `null` for ephemeral. */
    session: string | null;
    /** Model id the turn ran against (drives the pricing lookup). */
    model: string;
    promptTokens: number;
    completionTokens: number;
    cacheHitTokens: number;
    cacheMissTokens: number;
    /** Total cost of the turn in USD. */
    costUsd: number;
    /** What the same turn would have cost at Claude Sonnet 4.6 rates. */
    claudeEquivUsd: number;
    /** Absent on legacy records — treat as "turn" when missing. */
    kind?: "turn" | "subagent";
    /** Present when `kind === "subagent"`. Attribution metadata for the /stats roll-up. */
    subagent?: {
        /** Skill that spawned it, when the spawn came from a `runAs: subagent` skill. */
        skillName?: string;
        /** First ~60 chars of the task prompt — enough context to recognize a run, never the full text. */
        taskPreview: string;
        /** Tool calls the child loop dispatched before returning. */
        toolIters: number;
        /** Wall-clock ms. */
        durationMs: number;
    };
}
/** Where the log lives. Tests override via `opts.path`. */
declare function defaultUsageLogPath(homeDirOverride?: string): string;
interface AppendUsageInput {
    session: string | null;
    model: string;
    usage: Usage;
    /** Override the timestamp (tests). */
    now?: number;
    /** Override the log path (tests). */
    path?: string;
    /** When appending a subagent summary row, set `kind: "subagent"` and populate `subagent`. */
    kind?: "turn" | "subagent";
    subagent?: UsageRecord["subagent"];
}
/** Returns the record so tests can assert cost fields without re-reading the log. */
declare function appendUsage(input: AppendUsageInput): UsageRecord;
declare function readUsageLog(path?: string): UsageRecord[];
/** One row of the `reasonix stats` dashboard — a rolled-up window. */
interface UsageBucket {
    label: string;
    /** Start of the window as epoch millis. `0` = unbounded (all-time). */
    since: number;
    turns: number;
    promptTokens: number;
    completionTokens: number;
    cacheHitTokens: number;
    cacheMissTokens: number;
    costUsd: number;
    claudeEquivUsd: number;
    /** Recomputed from current pricing each aggregate — intentionally NOT frozen with `costUsd`. */
    cacheSavingsUsd: number;
}
/** Cache hit ratio for a bucket — zero denominator returns 0. */
declare function bucketCacheHitRatio(b: UsageBucket): number;
/** Savings vs Claude as a fraction (0.94 = 94% savings). 0 if Claude cost is 0. */
declare function bucketSavingsFraction(b: UsageBucket): number;
interface AggregateOptions {
    /** Override `Date.now()` for deterministic tests. */
    now?: number;
}
interface UsageAggregate {
    /** Fixed-order rolling windows: today, week, month, all-time. */
    buckets: UsageBucket[];
    /** Model id → turn count. Sorted descending; top entry is the "most used." */
    byModel: Array<{
        model: string;
        turns: number;
    }>;
    /** Session name → turn count. Sorted descending. Null sessions are grouped under `"(ephemeral)"`. */
    bySession: Array<{
        session: string;
        turns: number;
    }>;
    /** Earliest record's ts, or `null` when the log is empty. Drives "saved $X since <date>". */
    firstSeen: number | null;
    /** Latest record's ts, or `null` when the log is empty. */
    lastSeen: number | null;
    /** Undefined when no subagent records exist; counts spawns, not internal child-loop turns. */
    subagents?: SubagentAggregate;
}
/** Rolled-up view of all `kind: "subagent"` records. */
interface SubagentAggregate {
    total: number;
    costUsd: number;
    totalDurationMs: number;
    /** Per-skill breakdown. Records without `skillName` (raw spawn_subagent calls) group under `"(adhoc)"`. */
    bySkill: Array<{
        skillName: string;
        count: number;
        costUsd: number;
        durationMs: number;
    }>;
}
/** Rolling 24h/7d/30d windows — avoids "it's 00:03, 'today' is empty" surprises. */
declare function aggregateUsage(records: UsageRecord[], opts?: AggregateOptions): UsageAggregate;
/** File-size helper for the stats header — "1.2 MB" etc. Returns "" if missing. */
declare function formatLogSize(path?: string): string;

export { AT_MENTION_PATTERN, AT_PICKER_PREFIX, type AggregateOptions, AppendOnlyLog, type AppendUsageInput, type ApplyResult, type ApplyStatus, type AtMentionExpansion, type AtMentionOptions, type BridgeOptions, type BridgeResult, CODE_SYSTEM_PROMPT, CacheFirstLoop, type CacheFirstLoopOptions, type CallToolResult, type ChatMessage, type ChatResponse, type ChoiceOption, ChoiceRequestedError, type ChoiceToolOptions, type CodeSystemPromptOptions, DEFAULT_AT_DIR_MAX_ENTRIES, DEFAULT_AT_MENTION_MAX_BYTES, DEFAULT_MAX_RESULT_CHARS, DEFAULT_MAX_RESULT_TOKENS, DEFAULT_PICKER_IGNORE_DIRS, DeepSeekClient, type DeepSeekClientOptions, type RenderOptions as DiffRenderOptions, type DiffReport, type DiffSide, type DirEntry, type EditBlock, type EditSnapshot, type EventRole, type FileWithStats, type FilesystemToolsOptions, type FlattenDecision, type FlattenOptions, type GetLatestVersionOptions, type GetPromptResult, HOOK_EVENTS, HOOK_SETTINGS_DIRNAME, HOOK_SETTINGS_FILENAME, type HookConfig, type HookEvent, type HookOutcome, type HookPayload, type HookReport, type HookScope, type HookSettings, type HookSpawnInput, type HookSpawnResult, type HookSpawner, ImmutablePrefix, type ImmutablePrefixOptions, type InitializeResult, type InspectionReport, type InstallSource, type JSONSchema, type JsonRpcMessage, type JsonRpcRequest, type JsonRpcResponse, LATEST_CACHE_TTL_MS, LATEST_FETCH_TIMEOUT_MS, type ListDirectoryOptions, type ListFilesOptions, type ListPromptsResult, type ListResourcesResult, type ListToolsResult, type LoadHookSettingsOptions, type LoopEvent, MCP_PROTOCOL_VERSION, MEMORY_INDEX_FILE, MEMORY_INDEX_MAX_CHARS, McpClient, type McpClientOptions, type McpContentBlock, type McpProgressHandler, type McpProgressInfo, type McpPrompt, type McpPromptArgument, type McpPromptMessage, type McpPromptResourceBlock, type McpResource, type McpResourceContents, type McpResourceContentsBlob, type McpResourceContentsText, type McpSpec, type McpTool, type McpToolSchema, type McpTransport, type MemoryEntry, type MemoryScope, MemoryStore, type MemoryStoreOptions, type MemoryToolsOptions, type MemoryType, type WriteInput as MemoryWriteInput, NeedsConfirmationError, PROJECT_MEMORY_FILE, PROJECT_MEMORY_FILES, PROJECT_MEMORY_MAX_CHARS, type PageContent, type ParsedAtQuery, type PickerCandidate, PlanProposedError, PlanRevisionProposedError, type PlanStep, type PlanStepRisk, type PlanToolOptions, type ProgressNotificationParams, type ProjectMemory, type RankPickerOptions, type ReadResourceResult, type ReadTranscriptResult, type ReasonixConfig, type ReconfigurableOptions, type RepairReport, type ReplayStats, type ResolvedHook, type RetryInfo, type RetryOptions, type Role, type RunCommandResult, type RunHooksOptions, type ScavengeOptions, type ScavengeResult, type SearchResult, type SectionResult, type SessionInfo, SessionStats, type SessionSummary, type ShellToolsOptions, type SseMcpSpec, SseTransport, type SseTransportOptions, type StdioMcpSpec, StdioTransport, type StdioTransportOptions, type StepCompletion, StormBreaker, type StreamChunk, type StreamWalkOptions, type StreamableHttpMcpSpec, StreamableHttpTransport, type StreamableHttpTransportOptions, type SubagentEvent, type SubagentSink, type SubagentToolOptions, type TodoItem, type TodoStatus, type TodoToolOptions, type ToolCall, type ToolCallContext, ToolCallRepair, type ToolCallRepairOptions, type ToolDefinition, type ToolFunctionSpec, ToolRegistry, type ToolSpec, type TranscriptMeta, type TranscriptRecord, type TruncationRepairResult, type TurnPair, type TurnStats, USER_MEMORY_DIR, Usage, type UsageAggregate, type UsageBucket, type UsageRecord, VERSION, VolatileScratch, type WebFetchOptions, type WebSearchOptions, type WebToolsOptions, aggregateUsage, analyzeSchema, appendSessionMessage, appendUsage, applyEditBlock, applyEditBlocks, applyMemoryStack, applyProjectMemory, applyUserMemory, bridgeMcpTools, bucketCacheHitRatio, bucketSavingsFraction, claudeEquivalentCost, codeSystemPrompt, compareVersions, computeReplayStats, costUsd, decideOutcome, defaultConfigPath, defaultUsageLogPath, deleteSession, detectAtPicker, detectInstallSource, detectNpmInstallPrefix, detectShellOperator, diffTranscripts, expandAtMentions, fetchWithRetry, findProjectMemoryPath, fixToolCallPairing, flattenMcpResult, flattenSchema, forkRegistryExcluding, formatCommandResult, formatHookOutcomeMessage, formatLogSize, formatLoopError, formatSearchResults, getLatestVersion, globalSettingsPath, healLoadedMessages, healLoadedMessagesByTokens, htmlToText, injectPowerShellUtf8, inputCostUsd, inspectMcpServer, isAllowed, isJsonRpcError, isNpxInstall, isPlausibleKey, listDirectory, listFilesSync, listFilesWithStatsAsync, listFilesWithStatsSync, listSessions, loadApiKey, loadBaseUrl, loadDotenv, loadHooks, loadSessionMessages, matchesTool, memoryEnabled, nestArguments, openTranscriptFile, outputCostUsd, parseAtQuery, parseEditBlocks, parseMcpSpec, parseMojeekResults, parseSearxngHtmlResults, parseTranscript, prepareSpawn, projectHash, projectSettingsPath, quoteForCmdExe, rankPickerCandidates, readConfig, readProjectMemory, readTranscript, readUsageLog, recordFromLoopEvent, redactKey, registerChoiceTool, registerFilesystemTools, registerMemoryTools, registerPlanTool, registerShellTools, registerSubagentTool, registerTodoTool, registerWebTools, renderMarkdown as renderDiffMarkdown, renderSummaryTable as renderDiffSummary, repairTruncatedJson, replayFromFile, resolveExecutable, resolveProjectMemoryWritePath, restoreSnapshots, runCommand, runHooks, sanitizeMemoryName, sanitizeName as sanitizeSessionName, saveApiKey, saveBaseUrl, scavengeToolCalls, sessionPath, sessionsDir, similarity, snapshotBeforeEdits, stripHallucinatedToolMarkup, tokenizeCommand, truncateForModel, truncateForModelByTokens, walkFilesStream, webFetch, webSearch, withUtf8Codepage, writeConfig, writeMeta, writeRecord };
