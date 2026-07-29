export type PromptOptimizationStatus = "idle" | "requesting" | "preview" | "applying" | "cancelled" | "failed";

export interface PromptOptimizationScope {
  requestId: string;
  draftRevision: number;
  original: string;
  sessionId: string;
  workspace: string;
  mode: string;
}

type SlashCommand = { cmd?: string; name?: string; aliases?: string[] };

function slashNames(commands: SlashCommand[] = []): Set<string> {
  const names = new Set<string>();
  for (const command of commands) {
    for (const value of [command.cmd, command.name, ...(command.aliases ?? [])]) {
      const normalized = String(value ?? "").trim().replace(/^\//u, "").toLowerCase();
      if (normalized) names.add(normalized);
    }
  }
  return names;
}

export function classifyPromptOptimizationDraft(draft: unknown, commands: SlashCommand[] = []):
  | { kind: "empty"; body: "" }
  | { kind: "command"; body: string }
  | { kind: "empty_skill"; prefix: string; body: "" }
  | { kind: "skill"; prefix: string; body: string }
  | { kind: "prompt"; body: string } {
  const source = String(draft ?? "");
  const trimmed = source.trim();
  if (!trimmed) return { kind: "empty", body: "" };
  const slash = /^\/(\S+)(?=\s|$)/u.exec(trimmed);
  if (slash && slashNames(commands).has(slash[1].toLowerCase())) {
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
  response: { requestId?: unknown; draftRevision?: unknown } | null | undefined,
  scope: PromptOptimizationScope,
  current: Omit<PromptOptimizationScope, "requestId">,
): boolean {
  return String(response?.requestId ?? "") === scope.requestId
    && Number(response?.draftRevision) === scope.draftRevision
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
}): boolean {
  if (input.busy === true || input.inFlight === true) return true;
  return ["empty", "command", "empty_skill"].includes(
    classifyPromptOptimizationDraft(input.draft, input.slashCommands).kind,
  );
}
