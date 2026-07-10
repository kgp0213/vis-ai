const OFFICECLI_VERBS = "create|open|close|save|view|get|query|set|add|remove|move|swap|validate|batch|dump|merge|watch";
const NEXT_COMMAND_RE = new RegExp(`(?:\\r?\\n)+\\s*(?:${OFFICECLI_VERBS})(?:\\s|$)`, "i");

export function validateOfficecliInvocation(toolName, args) {
  if (String(toolName).toLowerCase() !== "officecli") return null;
  const command = String(args?.command ?? "").trim();
  if (!command) return null;

  if (NEXT_COMMAND_RE.test(command)) {
    return {
      code: "officecli-multiple-commands",
      error: "officecli accepts one CLI command per tool call. Do not join add/set commands with newlines.",
      suggestion: "Use batch <file> --commands '<JSON array>' --json, preferably one batch per slide or logical section.",
    };
  }

  if (/^batch(?:\s|$)/i.test(command) && !/(?:^|\s)--(?:commands|input)(?:\s|=)/i.test(command)) {
    return {
      code: "officecli-batch-input-required",
      error: "officecli batch requires --commands or --input. Without one it waits for stdin and can block the MCP service.",
      suggestion: "Use batch <file> --commands '[{\"command\":\"add\",\"parent\":\"/slide[1]\",\"type\":\"shape\",\"props\":{...}}]' --json.",
    };
  }

  return null;
}
