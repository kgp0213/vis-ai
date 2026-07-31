import { createHash } from "node:crypto";

const DEFAULT_MAX_INPUT_CHARS = 20_000;
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_CACHE_SIZE = 64;
const DEFAULT_CACHE_TTL_MS = 5 * 60_000;
const DEFAULT_CANCELLED_CACHE_SIZE = 256;
const REQUEST_ID_RE = /^[A-Za-z0-9._:-]{1,160}$/u;
const SKILL_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;

function boundedInteger(value, fallback, min, max) {
  const number = Number(value);
  return Number.isSafeInteger(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function promptOptimizationError(code, message, options = {}) {
  const error = new Error(message, options.cause ? { cause: options.cause } : undefined);
  error.name = "PromptOptimizationError";
  error.code = code;
  error.status = Number(options.status) || 500;
  error.title = options.title ?? "提示词优化失败";
  error.retryable = options.retryable === true;
  error.action = options.action ?? null;
  error.details = options.details && typeof options.details === "object" ? options.details : {};
  return error;
}

export function classifyPromptOptimizationInput(prompt) {
  const original = String(prompt ?? "");
  const trimmed = original.trim();
  if (!trimmed) return { kind: "empty", original, body: "", prefix: "" };

  const slash = /^\/(\S+)(?=\s|$)/u.exec(trimmed);
  if (slash) {
    return { kind: "command", original, body: trimmed, prefix: "", command: slash[1].toLowerCase() };
  }

  const skill = /^(\s*@([A-Za-z0-9][A-Za-z0-9._-]{0,63})[ \t]+)([\s\S]*)$/u.exec(original);
  if (skill && SKILL_NAME_RE.test(skill[2])) {
    const body = skill[3].trim();
    return {
      kind: body ? "skill" : "empty_skill",
      original,
      prefix: skill[1],
      skillName: skill[2],
      body,
    };
  }

  const emptySkill = /^\s*@([A-Za-z0-9][A-Za-z0-9._-]{0,63})\s*$/u.exec(original);
  if (emptySkill) {
    return { kind: "empty_skill", original, prefix: original, skillName: emptySkill[1], body: "" };
  }
  return { kind: "prompt", original, prefix: "", body: trimmed };
}

function trimFactPunctuation(value) {
  return String(value).replace(/[),.;:!?，。；：！？）】》]+$/u, "");
}

function collectMatches(text, kind, expression, valueAt = 0) {
  const matches = [];
  for (const match of text.matchAll(expression)) {
    const value = trimFactPunctuation(match[valueAt]);
    if (value) matches.push({ kind, value });
  }
  return matches;
}

function extractPathFacts(source) {
  const windowsFile = /(?:[A-Za-z]:\\|\\\\|\.{1,2}\\)(?:[^<>"|?*\r\n,，。；;：！？）】》]*?)(?:\.[A-Za-z0-9][A-Za-z0-9._-]{0,15})(?=$|[\s,，。；;：！？）】》])/gu;
  const posixFile = /(?<![:/\p{L}\p{N}_])(?:\/|~\/|\.{1,2}\/)(?:[^<>"'|?*\r\n,，。；;：！？）】》]*?)(?:\.[A-Za-z0-9][A-Za-z0-9._-]{0,15})(?=$|[\s,，。；;：！？）】》])/gu;
  return [
    ...collectMatches(source, "path", windowsFile),
    ...collectMatches(source, "path", posixFile),
    ...collectMatches(source, "path", /(?:[A-Za-z]:\\|\\\\|\.{1,2}\\)[^\s<>"'|?*]+/gu),
    ...collectMatches(
      source,
      "path",
      /(?<![A-Za-z0-9_.\\/:~-])((?:[A-Za-z0-9_.-]+[\\/])+[A-Za-z0-9_.-]+\.[A-Za-z0-9][A-Za-z0-9._-]{0,15})(?![A-Za-z0-9_.\\/-])/gu,
      1,
    ).filter((fact) => !looksLikeProviderModelIdentifier(fact.value)),
    ...collectMatches(
      source,
      "path",
      /(?<![A-Za-z0-9_.\\/:~-])([A-Za-z0-9_-][A-Za-z0-9_.-]*\.[A-Za-z0-9][A-Za-z0-9._-]{0,15})(?![A-Za-z0-9_.\\/-])/gu,
      1,
    ),
  ];
}

function looksLikeProviderModelIdentifier(value) {
  return String(value).includes("/") && /[-\d]/u.test(value);
}

function extractIdentifierFacts(source) {
  return [
    ...collectMatches(
      source,
      "identifier",
      /(?<![A-Za-z0-9_.-])([A-Za-z0-9][A-Za-z0-9._-]{1,63}\/[A-Za-z0-9][A-Za-z0-9._-]{1,127})(?![A-Za-z0-9_.-])/gu,
      1,
    ).filter((fact) => looksLikeProviderModelIdentifier(fact.value)),
    ...collectMatches(
      source,
      "identifier",
      /(?<![A-Za-z0-9_./-])([A-Za-z][A-Za-z0-9._]*(?:-[A-Za-z0-9._]+){2,})(?![A-Za-z0-9_.-])/gu,
      1,
    ),
  ];
}

function extractProtocolFacts(source) {
  return collectMatches(
    source,
    "protocol",
    /(?<![A-Za-z0-9._-])(@[A-Za-z0-9][A-Za-z0-9._-]{0,63})(?![A-Za-z0-9._-])/gu,
    1,
  );
}

function extractRecipientFacts(source) {
  return [
    ...collectMatches(
      source,
      "recipient",
      /(?:发送给|发给|转发给|邮件给|通知给|通知|向)[ \t]*([^，。；;:：!！?？\r\n]+)/gu,
      1,
    ),
    ...collectMatches(
      source,
      "recipient",
      /\b(?:send(?:s|ing)?|sent|email(?:s|ed|ing)?|message(?:s|d|ing)?|forward(?:s|ed|ing)?)\b[^.;:!?\r\n]{0,160}?\bto[ \t]+([^,.;:!?\r\n]+)/giu,
      1,
    ),
    ...collectMatches(
      source,
      "recipient",
      /\b(?:notify|notifies|notified|notifying)[ \t]+([^,.;:!?\r\n]+)/giu,
      1,
    ),
  ];
}

function extractNumberFacts(source) {
  const matches = [];
  const expression = /(?<![\p{L}\p{N}_])[-+]?\d+(?:[.,]\d+)*(?:%|[A-Za-z]{1,8})?(?![\p{L}\p{N}_])/gu;
  for (const match of source.matchAll(expression)) {
    const lineStart = source.lastIndexOf("\n", match.index - 1) + 1;
    const linePrefix = source.slice(lineStart, match.index);
    const suffix = source.slice(match.index + match[0].length);
    if (/^\s*$/u.test(linePrefix) && /^[.)、][ \t]+/u.test(suffix)) continue;
    matches.push({ kind: "number", value: trimFactPunctuation(match[0]) });
  }
  return matches;
}

function extractProperNameFacts(source) {
  const matches = [];
  const seen = new Set();
  const collect = (expression, valueAt, accept = () => true) => {
    for (const match of source.matchAll(expression)) {
      const value = trimFactPunctuation(match[valueAt]);
      if (!value || !accept(value)) continue;
      const valueIndex = source.indexOf(value, match.index);
      const key = `${valueIndex}\0${value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({ kind: "proper_name", value });
    }
  };
  collect(/(?:保留|名为|叫作|名称(?:是|为)?|产品名(?:称)?(?:是|为)?|品牌名(?:称)?(?:是|为)?)[：:\s“"'「]*([A-Z][A-Za-z0-9]*(?:[ \t]+[A-Z][A-Za-z0-9]*)+)/gu, 1);
  collect(/([A-Z][A-Za-z0-9]*(?:[ \t]+[A-Z][A-Za-z0-9]*)+)(?=[ \t]*(?:产品|品牌|项目|软件)?名称)/gu, 1);
  collect(
    /\b(?:named|called|keep|preserve|product(?:\s+name)?|brand(?:\s+name)?)[ \t:]+["']?([A-Z][A-Za-z0-9]*(?:[ \t]+[A-Z][A-Za-z0-9]*)+)/giu,
    1,
    (value) => /^[A-Z][A-Za-z0-9]*(?:[ \t]+[A-Z][A-Za-z0-9]*)+$/u.test(value),
  );
  collect(/(?<![A-Za-z0-9_])((?:[A-Z]{2,}[A-Za-z0-9]*|[A-Z][a-z0-9]+[A-Z][A-Za-z0-9]*))(?![A-Za-z0-9_])/gu, 1);
  collect(/(?:使用|采用|基于|模型(?:是|为)?|Provider(?:是|为)?)[：:\s]*([A-Z][A-Za-z0-9._-]{1,63})/gu, 1);
  return matches;
}

export function extractProtectedPromptFacts(prompt) {
  const source = String(prompt ?? "");
  const found = [
    ...extractProtocolFacts(source),
    ...collectMatches(source, "url", /https?:\/\/[^\s<>"'，。；：！？）】》“”‘’]+/giu),
    ...extractPathFacts(source),
    ...extractIdentifierFacts(source),
    ...extractRecipientFacts(source),
    ...collectMatches(source, "date", /(?<!\d)\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}(?:日)?(?!\d)/gu),
    ...collectMatches(source, "quoted", /[“"]([^”"\r\n]+)[”"]/gu, 1),
    ...collectMatches(source, "quoted", /[‘']([^’'\r\n]+)[’']/gu, 1),
    ...collectMatches(source, "quoted", /「([^」\r\n]+)」/gu, 1),
    ...extractProperNameFacts(source),
    ...extractNumberFacts(source),
  ];
  const facts = new Map();
  for (const fact of found) {
    const key = `${fact.kind}\0${fact.value}`;
    const current = facts.get(key);
    facts.set(key, current ? { ...current, count: current.count + 1 } : { ...fact, count: 1 });
  }
  return [...facts.values()];
}

function dominantPromptLanguage(text) {
  const source = String(text ?? "");
  const cjkCount = source.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu)?.length ?? 0;
  const latinCount = source.match(/[A-Za-z]/gu)?.length ?? 0;
  if (cjkCount >= 4 && cjkCount * 2 >= latinCount) return "cjk";
  if (latinCount >= 12 && cjkCount === 0) return "latin";
  return null;
}

// Compare stable actions; category-only sets cannot detect swaps such as "modify, do not deploy".
const SIDE_EFFECT_ACTION_RULES = Object.freeze([
  { category: "execution", action: "run", pattern: /(?:执行(?!步骤|计划|流程|方式|方法|说明)|运行(?:测试|命令|脚本|程序|构建)?|启动)|\b(?:execute(?:s|d)?|executing|runs?|running(?=[ \t]+(?:the[ \t]+)?(?:tests?|commands?|scripts?|programs?|builds?|jobs?|tasks?|checks?|servers?|services?|applications?|apps?)\b)|start(?:s|ed|ing)?)\b/iu },
  { category: "execution", action: "build", pattern: /(?:构建|编译)|\b(?:build(?:s|ing)?|built|compile(?:s|d)?|compiling)\b/iu },
  { category: "execution", action: "modify", pattern: /(?:修改|修复|写入)|\b(?:modify|modifies|modified|modifying|fix(?:es|ed|ing)?|write|writes|wrote|written|writing)\b/iu },
  { category: "execution", action: "create", pattern: /(?:创建|生成)|\b(?:create(?:s|d)?|creating|generate(?:s|d)?|generating)\b/iu },
  { category: "execution", action: "process", pattern: /(?:处理|转换)|\b(?:process(?:es|ed|ing)?|convert(?:s|ed|ing)?)\b/iu },
  { category: "execution", action: "deploy", pattern: /(?:部署|实施)|\b(?:deploy(?:s|ed|ing)?|implement(?:s|ed|ing)?)\b/iu },
  { category: "external_send", action: "send", pattern: /(?:发送|发给|转发|邮件(?:给)?|通知(?:给)?)|\b(?:send(?:s|ing)?|sent|email(?:s|ed|ing)?|message(?:s|d)?|messaging|notify|notifies|notified|notifying|forward(?:s|ed|ing)?)\b/iu },
  { category: "external_send", action: "upload", pattern: /(?:上传)|\bupload(?:s|ed|ing)?\b/iu },
  { category: "external_send", action: "publish", pattern: /(?:发布|推送)|\b(?:publish(?:es|ed|ing)?|post(?:s|ed|ing)?)\b/iu },
  { category: "installation", action: "install", pattern: /(?:安装)|\b(?:install(?:s|ed|ing)?|installation)\b/iu },
  { category: "installation", action: "download", pattern: /(?:下载)|\bdownload(?:s|ed|ing)?\b/iu },
  { category: "installation", action: "dependency", pattern: /(?:新增依赖|更新依赖)|\b(?:add|update)(?:s|ed|ing)?\s+dependenc(?:y|ies)\b/iu },
  { category: "installation", action: "environment", pattern: /(?:配置环境)|\bconfigur(?:e|es|ed|ing)\s+(?:the\s+)?environment\b/iu },
  { category: "destructive", action: "delete", pattern: /(?:删除)|\b(?:delete(?:s|d)?|deleting|remove(?:s|d)?|removing)\b/iu },
  { category: "destructive", action: "clear", pattern: /(?:清空)|\bclear(?:s|ed|ing)?\s+(?:the\s+)?(?:files?|director(?:y|ies)|folders?|cache|data|contents?|output|history|records?|database|tables?|queue|state|storage)\b/iu },
  { category: "destructive", action: "overwrite", pattern: /(?:覆盖|替换原文件)|\boverwrite(?:s|written|writing)?\b/iu },
  { category: "destructive", action: "uninstall", pattern: /(?:卸载)|\buninstall(?:s|ed|ing)?\b/iu },
  { category: "destructive", action: "reset", pattern: /(?:重置)|\breset(?:s|ting)?\b/iu },
  { category: "destructive", action: "drop", pattern: /\b(?:drop(?:s|ped|ping)?|truncate(?:s|d)?|truncating)\b/iu },
]);

const SIDE_EFFECT_POLICY_MARKER_RE = /(?<prohibited>(?:不要|不得|禁止|请勿|不能|不可|不应|无需|无须|不需要|避免|严禁|不允许|切勿|并非要|不是要|不打算|不准备|未|不(?!仅|但|只))|\b(?:do\s+not|don't|must\s+not|should\s+not|cannot|can't|not|never|without|avoid|prohibit(?:ed)?|forbid(?:den)?)\b)|(?<authorized>(?:(?:不仅|不但|不只是)(?:要|需|应)?|(?:但|但是|而)(?:要|需|应|必须|可以)?|(?:必须|应当|应该|需要|允许|务必|请(?!勿)))|\b(?:but|must|should|please|need\s+to|allow(?:ed)?\s+to|may|can|will)\b)/giu;
const SIDE_EFFECT_CLAUSE_BOUNDARY_RE = /[,，。；;:：!！?？\r\n]/gu;
const SCOPE_MARKERS = Object.freeze([
  { value: "universal", pattern: /所有|全部|每个/u },
  { value: "bulk", pattern: /批量/u },
  { value: "any", pattern: /任意/u },
  { value: "universal", pattern: /\b(?:all|every|entire)\b/iu },
  { value: "any", pattern: /\bany\b/iu },
]);

function scopeMentions(source) {
  const mentions = [];
  for (const marker of SCOPE_MARKERS) {
    const flags = marker.pattern.flags.includes("g") ? marker.pattern.flags : `${marker.pattern.flags}g`;
    const expression = new RegExp(marker.pattern.source, flags);
    for (const match of source.matchAll(expression)) {
      mentions.push({ value: marker.value, index: match.index, end: match.index + match[0].length });
    }
  }
  return mentions.sort((left, right) => left.index - right.index);
}

function sideEffectClauseBounds(source, index) {
  let start = 0;
  let end = source.length;
  SIDE_EFFECT_CLAUSE_BOUNDARY_RE.lastIndex = 0;
  for (const boundary of source.matchAll(SIDE_EFFECT_CLAUSE_BOUNDARY_RE)) {
    if (boundary.index < index) {
      start = boundary.index + boundary[0].length;
      continue;
    }
    end = boundary.index;
    break;
  }
  return { start, end };
}

function distanceBetweenMentions(left, right) {
  if (left.end <= right.index) return right.index - left.end;
  if (right.end <= left.index) return left.index - right.end;
  return 0;
}

function sideEffectMentionPolicy(source, index) {
  let clauseStart = 0;
  SIDE_EFFECT_CLAUSE_BOUNDARY_RE.lastIndex = 0;
  for (const boundary of source.matchAll(SIDE_EFFECT_CLAUSE_BOUNDARY_RE)) {
    if (boundary.index >= index) break;
    clauseStart = boundary.index + boundary[0].length;
  }
  const prefix = source.slice(clauseStart, index);
  let policy = "authorized";
  SIDE_EFFECT_POLICY_MARKER_RE.lastIndex = 0;
  for (const marker of prefix.matchAll(SIDE_EFFECT_POLICY_MARKER_RE)) {
    policy = marker.groups?.prohibited ? "prohibited" : "authorized";
  }
  return policy;
}

function promptSideEffectPolicy(text) {
  const source = String(text ?? "");
  const authorized = new Set();
  const prohibited = new Set();
  const actions = [];
  for (const rule of SIDE_EFFECT_ACTION_RULES) {
    const flags = rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`;
    const expression = new RegExp(rule.pattern.source, flags);
    for (const match of source.matchAll(expression)) {
      const policy = sideEffectMentionPolicy(source, match.index);
      const key = `${rule.category}:${rule.action}`;
      const target = policy === "prohibited" ? prohibited : authorized;
      target.add(key);
      actions.push({ key, policy, index: match.index, end: match.index + match[0].length });
    }
  }
  actions.sort((left, right) => left.index - right.index);
  const scopes = scopeMentions(source);
  const scopeBindings = new Set();
  for (const scope of scopes) {
    const clause = sideEffectClauseBounds(source, scope.index);
    const candidates = actions.filter((action) => action.index >= clause.start && action.index < clause.end);
    const nearest = candidates.sort((left, right) => (
      distanceBetweenMentions(left, scope) - distanceBetweenMentions(right, scope)
      || Number(right.end <= scope.index) - Number(left.end <= scope.index)
      || left.index - right.index
    ))[0];
    if (nearest) scopeBindings.add(`${nearest.policy}:${nearest.key}:${scope.value}`);
  }
  return { authorized, prohibited, scopes: new Set(scopes.map((scope) => scope.value)), scopeBindings };
}

function compareSideEffectPolicies(original, candidate) {
  const before = promptSideEffectPolicy(original);
  const after = promptSideEffectPolicy(candidate);
  const introducedActions = [...after.authorized].filter((action) => !before.authorized.has(action));
  const removedActions = [...before.authorized].filter((action) => !after.authorized.has(action));
  const reversedActions = [...before.authorized].filter((action) => after.prohibited.has(action) && !after.authorized.has(action));
  const removedProhibitedActions = [...before.prohibited].filter((action) => !after.prohibited.has(action));
  const reversedProhibitedActions = [...before.prohibited].filter((action) => (
    !before.authorized.has(action)
    && after.authorized.has(action)
    && !after.prohibited.has(action)
  ));
  const introducedProhibitedActions = [...after.prohibited].filter((action) => !before.prohibited.has(action));
  const categories = (actions) => [...new Set(actions.map((action) => action.split(":", 1)[0]))];
  return {
    introducedCategories: categories(introducedActions),
    removedProhibitions: categories(removedProhibitedActions),
    reversedProhibitions: categories(reversedProhibitedActions),
    introducedActions,
    removedActions,
    reversedActions,
    removedProhibitedActions,
    reversedProhibitedActions,
    introducedProhibitedActions,
    introducedScope: [...after.scopes].filter((value) => !before.scopes.has(value)),
    removedScope: [...before.scopes].filter((value) => !after.scopes.has(value)),
    introducedScopeBindings: [...after.scopeBindings].filter((value) => !before.scopeBindings.has(value)),
    removedScopeBindings: [...before.scopeBindings].filter((value) => !after.scopeBindings.has(value)),
  };
}

function countCaseInsensitiveNameOccurrences(text, value) {
  const escaped = String(value).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const expression = new RegExp(`(?<![A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])`, "giu");
  return [...String(text ?? "").matchAll(expression)].length;
}

function isCaseOnlyProperNameMatch(fact, originalText, candidateText) {
  if (fact.kind !== "proper_name") return false;
  const originalCount = countCaseInsensitiveNameOccurrences(originalText, fact.value);
  const candidateCount = countCaseInsensitiveNameOccurrences(candidateText, fact.value);
  return originalCount > 0 && originalCount === candidateCount;
}

function compareProtectedFacts(required, candidate, originalText, candidateText) {
  const requiredMap = new Map(required.map((fact) => [`${fact.kind}\0${fact.value}`, fact.count]));
  const candidateMap = new Map(candidate.map((fact) => [`${fact.kind}\0${fact.value}`, fact.count]));
  return {
    missingFacts: required.filter((fact) => (
      (candidateMap.get(`${fact.kind}\0${fact.value}`) ?? 0) < fact.count
      && !isCaseOnlyProperNameMatch(fact, originalText, candidateText)
    )),
    addedFacts: candidate.filter((fact) => (
      (requiredMap.get(`${fact.kind}\0${fact.value}`) ?? 0) < fact.count
      && !isCaseOnlyProperNameMatch(fact, originalText, candidateText)
    )),
  };
}

function requestFingerprint(original, draftRevision) {
  return createHash("sha256").update(`${draftRevision}\0${original}`).digest("hex");
}

function stripResponseFence(value) {
  return String(value ?? "").trim()
    .replace(/^```(?:text|txt|markdown)?\s*/iu, "")
    .replace(/\s*```$/u, "")
    .trim();
}

function modeGuidance(mode) {
  if (mode === "coding") {
    return [
      "当前为编程模式。判断用户是在咨询、排查、修改、构建还是审查代码。",
      "在不改变原意的前提下，明确技术目标、影响范围、兼容性约束、验证方式和交付结果。",
      "不要把讨论或诊断请求擅自改成实施请求，也不要虚构技术栈、文件名或测试命令。",
    ].join("\n");
  }
  return [
    "当前为通用模式。仅根据本次提供的文字判断问答、办公、数据整理、研究或设计等场景。",
    "在原文已有事实范围内明确目标、对象、范围、期望交付物和成功标准。",
    "高影响条件无法确定时保留为待确认项，不要替用户编造答案。",
  ].join("\n");
}

function systemPrompt(mode) {
  return [
    "你是提示词编辑器，只改写用户的任务描述，不回答问题，也不执行任务。",
    "保持原文语言，保留原始意图、事实、文件路径、URL、数字、日期、专有名称、范围、限制条件和交付要求。",
    "可以补足有助于执行的目标边界和验收表述，但不得增加执行、发送、安装或其他用户未提出的副作用。",
    "原文已经清晰时只做最小修改。",
    modeGuidance(mode),
    "只输出优化后的提示词正文，不要解释，不要加引号、标题或代码围栏。",
  ].join("\n");
}

function normalizeProviderFailure(error, signal) {
  if (error?.name === "PromptOptimizationError") return error;
  if (signal?.aborted || error?.name === "AbortError") {
    const timeout = error?.code === "prompt_optimization_timeout" || signal?.reason?.code === "prompt_optimization_timeout";
    return timeout
      ? promptOptimizationError("prompt_optimization_timeout", "提示词优化请求超时。", {
          status: 504, retryable: true, action: "retry",
        })
      : promptOptimizationError("prompt_optimization_cancelled", "提示词优化已取消。", {
          status: 499, action: "keep_original",
        });
  }
  const rawStatus = Number(error?.statusCode ?? error?.status ?? error?.response?.status);
  const message = String(error?.message ?? error ?? "");
  if (rawStatus === 401 || rawStatus === 403) {
    return promptOptimizationError("prompt_optimization_auth_failed", "模型服务鉴权失败。", {
      status: rawStatus, action: "check_provider_credentials", cause: error,
    });
  }
  if (rawStatus === 429) {
    return promptOptimizationError("prompt_optimization_rate_limited", "模型服务当前请求过多。", {
      status: 429, retryable: true, action: "retry_later", cause: error,
    });
  }
  if (rawStatus === 408 || (!Number.isFinite(rawStatus) && /timed?\s*out|timeout/iu.test(message))) {
    return promptOptimizationError("prompt_optimization_timeout", "提示词优化请求超时。", {
      status: 504, retryable: true, action: "retry", cause: error,
    });
  }
  if (/incomplete output|finish reason:\s*(?:length|max_tokens)|truncat/iu.test(message)) {
    return promptOptimizationError("prompt_optimization_truncated", "模型返回的优化结果不完整。", {
      status: 502, retryable: true, action: "retry", cause: error,
    });
  }
  if (rawStatus >= 500) {
    return promptOptimizationError("prompt_optimization_provider_failed", "模型服务暂时无法完成提示词优化。", {
      status: rawStatus,
      retryable: true,
      action: "retry",
      cause: error,
    });
  }
  if (/network|fetch failed|econn|socket|dns/iu.test(message)) {
    return promptOptimizationError("prompt_optimization_network_failed", "模型服务网络请求失败。", {
      status: Number.isFinite(rawStatus) ? rawStatus : 502,
      retryable: true,
      action: "retry",
      cause: error,
    });
  }
  return promptOptimizationError("prompt_optimization_provider_failed", "模型服务未能完成提示词优化。", {
    status: Number.isFinite(rawStatus) ? rawStatus : 502,
    retryable: false,
    action: "keep_original",
    cause: error,
  });
}

export function createPromptOptimizationRuntime(options = {}) {
  if (typeof options.requestModelText !== "function") throw new TypeError("requestModelText is required");
  const getModelContext = typeof options.getModelContext === "function" ? options.getModelContext : () => ({});
  const isTaskBusy = typeof options.isTaskBusy === "function" ? options.isTaskBusy : () => false;
  const audit = typeof options.audit === "function" ? options.audit : () => {};
  const maxInputChars = boundedInteger(options.maxInputChars, DEFAULT_MAX_INPUT_CHARS, 1, 100_000);
  const timeoutMs = boundedInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS, 100, 600_000);
  const cacheSize = boundedInteger(options.cacheSize, DEFAULT_CACHE_SIZE, 1, 256);
  const cacheTtlMs = boundedInteger(options.cacheTtlMs, DEFAULT_CACHE_TTL_MS, 100, 60 * 60_000);
  const now = typeof options.now === "function" ? options.now : Date.now;
  const cache = new Map();
  const cancelled = new Map();
  let active = null;

  function rememberCancellation(requestId) {
    cancelled.delete(requestId);
    cancelled.set(requestId, now() + cacheTtlMs);
    while (cancelled.size > DEFAULT_CANCELLED_CACHE_SIZE) {
      cancelled.delete(cancelled.keys().next().value);
    }
  }

  function hasCancellation(requestId) {
    const expiresAt = cancelled.get(requestId);
    if (!Number.isFinite(expiresAt)) return false;
    if (expiresAt > now()) return true;
    cancelled.delete(requestId);
    return false;
  }

  function emitAudit(action, payload) {
    try { audit({ ts: Date.now(), action, payload }); } catch { /* Auditing cannot block the editor. */ }
  }

  function remember(requestId, fingerprint, promise) {
    const entry = { fingerprint, promise, expiresAt: null };
    cache.set(requestId, entry);
    while (cache.size > cacheSize) cache.delete(cache.keys().next().value);
    void promise.finally(() => {
      if (cache.get(requestId) === entry) entry.expiresAt = now() + cacheTtlMs;
    }).catch(() => {});
  }

  function cachedRequest(requestId) {
    const entry = cache.get(requestId);
    if (!entry) return null;
    if (entry.expiresAt === null || entry.expiresAt > now()) return entry;
    cache.delete(requestId);
    return null;
  }

  async function optimize(input = {}) {
    const requestId = String(input.requestId ?? "").trim();
    if (!REQUEST_ID_RE.test(requestId)) {
      throw promptOptimizationError("prompt_optimization_request_id_invalid", "requestId 无效。", { status: 400 });
    }
    const classified = classifyPromptOptimizationInput(input.prompt);
    const draftRevision = Number.isSafeInteger(input.draftRevision) && input.draftRevision >= 0 ? input.draftRevision : 0;
    const fingerprint = requestFingerprint(classified.original, draftRevision);
    const cached = cachedRequest(requestId);
    if (cached) {
      if (cached.fingerprint !== fingerprint) {
        throw promptOptimizationError("prompt_optimization_idempotency_conflict", "requestId 已用于其他提示词优化请求。", {
          status: 409,
          action: "new_request_id",
        });
      }
      return cached.promise;
    }
    if (hasCancellation(requestId)) {
      throw promptOptimizationError("prompt_optimization_cancelled", "提示词优化已取消。", {
        status: 499, action: "keep_original",
      });
    }
    if (isTaskBusy()) {
      throw promptOptimizationError("prompt_optimization_busy", "主任务运行期间不能优化提示词。", {
        status: 409, retryable: true, action: "wait_for_task",
      });
    }
    if (active) {
      throw promptOptimizationError("prompt_optimization_request_busy", "已有提示词优化请求正在运行。", {
        status: 409, retryable: true, action: "wait_or_cancel",
      });
    }

    const validationError = classified.kind === "empty"
      ? promptOptimizationError("prompt_optimization_empty", "prompt 不能为空。", { status: 400 })
      : classified.kind === "command"
        ? promptOptimizationError("prompt_optimization_command_unsupported", "斜杠命令不能进行提示词优化。", { status: 400 })
        : classified.kind === "empty_skill"
          ? promptOptimizationError("prompt_optimization_skill_body_required", "Skill 前缀后缺少任务正文。", { status: 400 })
          : classified.original.length > maxInputChars
            ? promptOptimizationError("prompt_optimization_too_long", `prompt 最多允许 ${maxInputChars} 个字符。`, {
                status: 400, details: { maxInputChars },
              })
            : null;
    if (validationError) {
      emitAudit("prompt-optimization-failed", {
        requestId,
        status: validationError.code,
        inputLength: classified.original.length,
        durationMs: 0,
        providerId: null,
        model: null,
      });
      throw validationError;
    }

    const context = getModelContext() ?? {};
    const mode = String(context.mode ?? "general");
    const providerId = typeof context.providerId === "string" ? context.providerId : null;
    const model = typeof context.model === "string" ? context.model : null;
    const protectedFacts = extractProtectedPromptFacts(classified.body);
    const controller = new AbortController();
    const startedAt = Date.now();
    const timeoutError = promptOptimizationError("prompt_optimization_timeout", "提示词优化请求超时。", {
      status: 504, retryable: true, action: "retry",
    });
    let timeoutHandle;
    let abortListener;
    const abortPromise = new Promise((resolve, reject) => {
      abortListener = () => reject(controller.signal.reason);
      controller.signal.addEventListener("abort", abortListener, { once: true });
    });
    const timeoutPromise = new Promise((resolve, reject) => {
      timeoutHandle = setTimeout(() => {
        controller.abort(timeoutError);
        reject(timeoutError);
      }, timeoutMs);
    });
    const task = (async () => {
      try {
        const desiredTokens = Math.min(4096, Math.max(1024, Math.ceil(classified.body.length * 1.5)));
        const declaredOutputCapacity = Number(
          context.providerCapabilities?.maxOutputTokens
          ?? context.providerCapabilities?.maxCompletionTokens,
        );
        const requestedTokens = Number.isSafeInteger(declaredOutputCapacity) && declaredOutputCapacity > 0
          ? Math.min(desiredTokens, declaredOutputCapacity)
          : desiredTokens;
        const requestDefaults = context.requestConfiguration?.requestDefaults;
        const hasConfiguredTemperature = Number.isFinite(requestDefaults?.temperature);
        const hasConfiguredOutputLimit = requestDefaults && (
          Object.hasOwn(requestDefaults, "max_tokens")
          || Object.hasOwn(requestDefaults, "max_completion_tokens")
        );
        const text = await Promise.race([
          options.requestModelText({
            label: "prompt optimization",
            model,
            messages: [
              { role: "system", content: systemPrompt(mode) },
              { role: "user", content: classified.body },
            ],
            temperature: hasConfiguredTemperature ? undefined : 0.2,
            maxTokens: hasConfiguredOutputLimit ? undefined : requestedTokens,
            signal: controller.signal,
            requestPurpose: "promptOptimization",
            useConfiguredRequestDefaults: true,
          }),
          abortPromise,
          timeoutPromise,
        ]);
        const optimizedBody = stripResponseFence(text);
        if (!optimizedBody) {
          throw promptOptimizationError("prompt_optimization_empty_response", "模型没有返回可用的优化结果。", {
            status: 502, retryable: true, action: "retry",
          });
        }
        const originalLanguage = dominantPromptLanguage(classified.body);
        const optimizedLanguage = dominantPromptLanguage(optimizedBody);
        if (originalLanguage && optimizedLanguage !== originalLanguage) {
          throw promptOptimizationError("prompt_optimization_language_mismatch", "优化结果改变了原文语言。", {
            status: 422,
            action: "keep_original",
            details: { expectedLanguage: originalLanguage, actualLanguage: optimizedLanguage },
          });
        }
        const sideEffectMismatch = compareSideEffectPolicies(classified.body, optimizedBody);
        if (sideEffectMismatch.introducedCategories.length > 0
          || sideEffectMismatch.removedActions.length > 0
          || sideEffectMismatch.removedProhibitions.length > 0
          || sideEffectMismatch.introducedProhibitedActions.length > 0
          || sideEffectMismatch.introducedScope.length > 0
          || sideEffectMismatch.removedScope.length > 0
          || sideEffectMismatch.introducedScopeBindings.length > 0
          || sideEffectMismatch.removedScopeBindings.length > 0) {
          throw promptOptimizationError("prompt_optimization_side_effect_mismatch", "优化结果改变了用户要求的动作、限制或范围。", {
            status: 422,
            action: "keep_original",
            details: sideEffectMismatch,
          });
        }
        const candidateFacts = extractProtectedPromptFacts(optimizedBody);
        const factMismatch = compareProtectedFacts(
          protectedFacts,
          candidateFacts,
          classified.body,
          optimizedBody,
        );
        const originalProtocols = extractProtocolFacts(classified.body).map((fact) => fact.value);
        const candidateProtocols = extractProtocolFacts(optimizedBody).map((fact) => fact.value);
        const protocolOrderMismatch = JSON.stringify(originalProtocols) !== JSON.stringify(candidateProtocols);
        if (factMismatch.missingFacts.length > 0 || factMismatch.addedFacts.length > 0 || protocolOrderMismatch) {
          throw promptOptimizationError("prompt_optimization_fact_mismatch", "优化结果增加、改变或删除了受保护事实。", {
            status: 422,
            action: "keep_original",
            details: { ...factMismatch, protocolOrderMismatch },
          });
        }
        const optimized = `${classified.prefix}${optimizedBody}`;
        const result = {
          requestId,
          draftRevision,
          original: classified.original,
          optimized,
          warnings: [],
          protectedFacts,
          unchanged: optimized === classified.original,
        };
        emitAudit("prompt-optimization", {
          requestId,
          status: "succeeded",
          durationMs: Date.now() - startedAt,
          providerId,
          model,
          inputLength: classified.original.length,
          outputLength: optimized.length,
        });
        return result;
      } catch (error) {
        const normalized = normalizeProviderFailure(error, controller.signal);
        emitAudit("prompt-optimization-failed", {
          requestId,
          status: normalized.code,
          durationMs: Date.now() - startedAt,
          providerId,
          model,
          inputLength: classified.original.length,
          outputLength: 0,
        });
        throw normalized;
      } finally {
        clearTimeout(timeoutHandle);
        controller.signal.removeEventListener("abort", abortListener);
        if (active?.requestId === requestId) active = null;
      }
    })();
    active = { requestId, controller, promise: task };
    remember(requestId, fingerprint, task);
    return task;
  }

  function cancel(requestId) {
    const id = String(requestId ?? "").trim();
    if (!REQUEST_ID_RE.test(id)) {
      return { requestId: id, cancelled: false };
    }
    rememberCancellation(id);
    if (active?.requestId === id) {
      active.controller.abort(promptOptimizationError("prompt_optimization_cancelled", "提示词优化已取消。", {
        status: 499, action: "keep_original",
      }));
    }
    return { requestId: id, cancelled: true };
  }

  return {
    optimize,
    cancel,
    snapshot: () => ({
      activeRequestId: active?.requestId ?? null,
      cached: [...cache.keys()].filter((requestId) => cachedRequest(requestId)).length,
    }),
  };
}
