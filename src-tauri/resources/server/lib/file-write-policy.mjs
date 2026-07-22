export function validateFileWriteArgs(name, args) {
  if (!/^(?:write_file|append_file)$/i.test(String(name ?? ""))) return null;
  if (typeof args?.content !== "string") {
    return {
      error: `${name} requires content to be a string; do not pass an object.`,
      retryable: true,
      guidance: "Retry with one complete string value. If the provider reports truncated tool arguments, split it into smaller complete sections.",
    };
  }
  return null;
}
