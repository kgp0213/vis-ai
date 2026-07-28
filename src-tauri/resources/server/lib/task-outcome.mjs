const LIMITATION_RE = /(?:能力缺口|(?:当前|本次)(?:环境|模型|系统).{0,16}(?:不具备|无法|不支持)|(?:无法|不能|不支持|未能|尚未).{0,28}(?:理解|识别|验证|执行|生成|解析|保证)|需要(?:人工|后续|额外).{0,20}(?:处理|复核|确认))/iu;

export function detectTaskWarnings(text) {
  const value = String(text ?? "").trim();
  if (!value || !LIMITATION_RE.test(value)) return [];
  const sentences = value.split(/(?<=[。！？.!?])\s*/u).filter(Boolean);
  const matches = sentences.filter((sentence) => LIMITATION_RE.test(sentence));
  return (matches.length > 0 ? matches : [value]).slice(0, 3).map((sentence) => sentence.slice(0, 300));
}

export function deriveTaskState({
  planningOnly = false,
  executionStarted = false,
  interventionPaused = false,
  continuationNeeded = false,
  artifactIncomplete = false,
  warnings = [],
  artifactRequired = false,
  artifactVerified = false,
  executionFacts = false,
  terminalFact = true,
  resultUnknown = false,
} = {}) {
  if (interventionPaused) return "needs_intervention";
  if (artifactIncomplete) return "incomplete";
  if (continuationNeeded) return "incomplete";
  if (planningOnly && !executionStarted) return "awaiting_approval";
  if (resultUnknown || (executionFacts && !terminalFact)) return "unknown";
  // A warning-only completion is valid only after required artifacts have
  // passed the same host-side verification used by the final receipt.
  if (Array.isArray(warnings) && warnings.length > 0 && (!artifactRequired || artifactVerified)) return "completed_with_warnings";
  if (artifactRequired && !artifactVerified) return "unknown";
  return "completed";
}
