export type PromptOptimizationStatus =
  | "idle"
  | "requesting"
  | "preview"
  | "applying"
  | "cleanup"
  | "cleanup_failed"
  | "cancelled"
  | "failed";

export interface PromptOptimizationScope {
  requestId: string;
  draftRevision: number;
  original: string;
  sessionId: string;
  workspace: string;
  mode: string;
}

type SlashCommand = { cmd?: string; name?: string; aliases?: string[] };

export interface PromptOptimizationFailureDescription {
  messageKey: string | null;
  shouldCleanup: boolean;
  cancelled: boolean;
}

export function describePromptOptimizationFailure(error: {
  name?: unknown;
  code?: unknown;
  status?: unknown;
  transport?: unknown;
} | null | undefined): PromptOptimizationFailureDescription {
  const name = String(error?.name ?? "");
  const code = String(error?.code ?? "");
  const status = Number(error?.status);
  const transport = String(error?.transport ?? "");
  if (name === "AbortError" || code === "prompt_optimization_cancelled") {
    return { messageKey: null, shouldCleanup: false, cancelled: true };
  }
  if (code === "prompt_optimization_auth_failed" || status === 401 || status === 403) {
    return { messageKey: "chat.optimizeAuthFailed", shouldCleanup: false, cancelled: false };
  }
  if (code === "prompt_optimization_rate_limited" || status === 429) {
    return { messageKey: "chat.optimizeRateLimited", shouldCleanup: false, cancelled: false };
  }
  if (code === "prompt_optimization_provider_failed") {
    return { messageKey: "chat.optimizeProviderFailed", shouldCleanup: false, cancelled: false };
  }
  if (transport === "timeout" || code === "api_request_timeout" || code === "prompt_optimization_timeout") {
    return { messageKey: "chat.optimizeTimedOut", shouldCleanup: true, cancelled: false };
  }
  if (transport === "network" || code === "api_network_error" || code === "prompt_optimization_network_failed") {
    return { messageKey: "chat.optimizeNetworkFailed", shouldCleanup: true, cancelled: false };
  }
  if ([
    "prompt_optimization_language_mismatch",
    "prompt_optimization_side_effect_mismatch",
    "prompt_optimization_fact_mismatch",
  ].includes(code)) {
    return { messageKey: "chat.optimizeSemanticMismatch", shouldCleanup: false, cancelled: false };
  }
  if (code === "prompt_optimization_idempotency_conflict") {
    return { messageKey: "chat.optimizeConflict", shouldCleanup: false, cancelled: false };
  }
  if (code === "prompt_optimization_busy" || code === "prompt_optimization_request_busy") {
    return { messageKey: "chat.optimizeBusy", shouldCleanup: false, cancelled: false };
  }
  if (code === "prompt_optimization_truncated" || code === "prompt_optimization_empty_response") {
    return { messageKey: "chat.optimizeIncomplete", shouldCleanup: false, cancelled: false };
  }
  return { messageKey: null, shouldCleanup: false, cancelled: false };
}

export function classifyPromptOptimizationDraft(draft: unknown, _commands: SlashCommand[] = []):
  | { kind: "empty"; body: "" }
  | { kind: "command"; body: string }
  | { kind: "empty_skill"; prefix: string; body: "" }
  | { kind: "skill"; prefix: string; body: string }
  | { kind: "prompt"; body: string } {
  const source = String(draft ?? "");
  const trimmed = source.trim();
  if (!trimmed) return { kind: "empty", body: "" };
  const slash = /^\/(\S+)(?=\s|$)/u.exec(trimmed);
  if (slash) {
    return { kind: "command", body: trimmed };
  }
  const skill = /^(\s*@[A-Za-z0-9][A-Za-z0-9._-]{0,63}[ \t]+)([\s\S]*)$/u.exec(source);
  if (skill) {
    const body = skill[2].trim();
    return body
      ? { kind: "skill", prefix: skill[1], body }
      : { kind: "empty_skill", prefix: skill[1], body: "" };
  }
  if (/^\s*@[A-Za-z0-9][A-Za-z0-9._-]{0,63}\s*$/u.test(source)) {
    return { kind: "empty_skill", prefix: source, body: "" };
  }
  return { kind: "prompt", body: trimmed };
}

export function createPromptOptimizationScope(input: PromptOptimizationScope): PromptOptimizationScope {
  return Object.freeze({
    requestId: String(input.requestId),
    draftRevision: Number(input.draftRevision),
    original: String(input.original),
    sessionId: String(input.sessionId ?? ""),
    workspace: String(input.workspace ?? ""),
    mode: String(input.mode ?? ""),
  });
}

export function promptOptimizationResponseIsCurrent(
  response: { requestId?: unknown; draftRevision?: unknown; original?: unknown } | null | undefined,
  scope: PromptOptimizationScope,
  current: Omit<PromptOptimizationScope, "requestId">,
): boolean {
  return String(response?.requestId ?? "") === scope.requestId
    && Number(response?.draftRevision) === scope.draftRevision
    && String(response?.original ?? "") === scope.original
    && Number(current.draftRevision) === scope.draftRevision
    && String(current.original) === scope.original
    && String(current.sessionId ?? "") === scope.sessionId
    && String(current.workspace ?? "") === scope.workspace
    && String(current.mode ?? "") === scope.mode;
}

export function promptOptimizationButtonDisabled(input: {
  busy?: boolean;
  inFlight?: boolean;
  draft?: unknown;
  slashCommands?: SlashCommand[];
  classificationKind?: ReturnType<typeof classifyPromptOptimizationDraft>["kind"];
}): boolean {
  if (input.busy === true || input.inFlight === true) return true;
  const kind = input.classificationKind
    ?? classifyPromptOptimizationDraft(input.draft, input.slashCommands).kind;
  return ["empty", "command", "empty_skill"].includes(
    kind,
  );
}
