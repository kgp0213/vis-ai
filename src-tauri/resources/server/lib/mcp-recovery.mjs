export function isMcpToolTimeout(error) {
  return /MCP request tools\/call \(id=\d+\) timed out after \d+ms/i.test(String(error?.message ?? error ?? ""));
}

export function mcpRecoveryError(serverName) {
  return `${serverName} MCP request timed out and the service was restarted. The previous write may have completed. Inspect the current file before retrying, then continue from the first missing item without duplicating successful edits.`;
}
