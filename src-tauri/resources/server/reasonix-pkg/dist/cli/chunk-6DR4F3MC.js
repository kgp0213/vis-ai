#!/usr/bin/env node

// src/memory/project.ts
import { existsSync, readFileSync, statSync } from "fs";
import { basename, join } from "path";
var PROJECT_MEMORY_FILE = "REASONIX.md";
var PROJECT_MEMORY_FILES = ["REASONIX.md", "AGENTS.md", "AGENT.md"];
var PROJECT_MEMORY_MAX_CHARS = 8e3;
var FOREIGN_PLATFORM_FILE_MARKERS = ["SOUL.md", "PERSONA.md"];
function detectForeignAgentPlatform(rootDir) {
  const hits = [];
  for (const name of FOREIGN_PLATFORM_FILE_MARKERS) {
    if (existsSync(join(rootDir, name))) hits.push(name);
  }
  if (isDir(join(rootDir, "skills")) && isDir(join(rootDir, "memories"))) {
    hits.push("skills/ + memories/");
  }
  return hits.length > 0 ? hits : null;
}
function isDir(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
function findProjectMemoryPath(rootDir) {
  for (const name of PROJECT_MEMORY_FILES) {
    const path = join(rootDir, name);
    if (existsSync(path)) return path;
  }
  return null;
}
function resolveProjectMemoryWritePath(rootDir) {
  return findProjectMemoryPath(rootDir) ?? join(rootDir, PROJECT_MEMORY_FILE);
}
function readProjectMemory(rootDir) {
  const path = findProjectMemoryPath(rootDir);
  if (!path) return null;
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const originalChars = trimmed.length;
  const truncated = originalChars > PROJECT_MEMORY_MAX_CHARS;
  const content = truncated ? `${trimmed.slice(0, PROJECT_MEMORY_MAX_CHARS)}
\u2026 (truncated ${originalChars - PROJECT_MEMORY_MAX_CHARS} chars)` : trimmed;
  return { path, content, originalChars, truncated };
}
function memoryEnabled() {
  const env = process.env.REASONIX_MEMORY;
  if (env === "off" || env === "false" || env === "0") return false;
  return true;
}
function applyProjectMemory(basePrompt, rootDir) {
  if (!memoryEnabled()) return basePrompt;
  const mem = readProjectMemory(rootDir);
  if (!mem) return basePrompt;
  const filename = basename(mem.path);
  return `${basePrompt}

# Project memory (${filename})

The user pinned these notes about this project \u2014 treat them as authoritative context for every turn:

\`\`\`
${mem.content}
\`\`\`
`;
}

// src/prompt-fragments.ts
var TUI_FORMATTING_RULES = `Formatting (rendered in a TUI with a real markdown renderer):
- Tabular data \u2192 GitHub-Flavored Markdown tables with ASCII pipes (\`| col | col |\` header + \`| --- | --- |\` separator). Never use Unicode box-drawing characters (\u2502 \u2500 \u253C \u250C \u2510 \u2514 \u2518 \u251C \u2524) \u2014 they look intentional but break terminal word-wrap and render as garbled columns at narrow widths.
- Keep table cells short (one phrase each). If a cell needs a paragraph, use bullets below the table instead.
- Code, file paths with line ranges, and shell commands \u2192 fenced code blocks (\`\`\`).
- Do NOT draw decorative frames around content with \`\u250C\u2500\u2500\u2510 \u2502 \u2514\u2500\u2500\u2518\` characters. The renderer adds its own borders; extra ASCII art adds noise and shatters at narrow widths.
- For flow charts and diagrams: a plain bullet list with \`\u2192\` or \`\u2193\` between steps. Don't try to draw boxes-and-arrows in ASCII; it never survives word-wrap.`;
function escalationContract(modelId) {
  if (modelId === "deepseek-v4-pro") {
    return `Cost-aware escalation note: you are running on \`${modelId}\` \u2014 the escalation tier. There is no higher tier to escalate to, so the \`<<<NEEDS_PRO>>>\` marker is a no-op for you; deliver the strongest answer you can directly. If asked which model you are, answer \`${modelId}\`.`;
  }
  return `Cost-aware escalation (you are running on \`${modelId}\`):

If a task CLEARLY exceeds what this tier can do well \u2014 complex cross-file architecture refactors, subtle concurrency / security / correctness invariants you can't resolve with confidence, or a design trade-off you'd be guessing at \u2014 output the marker as the FIRST line of your response (nothing before it, not even whitespace on a separate line). This aborts the current call and retries this turn on deepseek-v4-pro, one shot.

Two accepted forms:
- \`<<<NEEDS_PRO>>>\` \u2014 bare marker, no rationale.
- \`<<<NEEDS_PRO: <one-sentence reason>>>>\` \u2014 preferred. The reason text appears in the user-visible warning ("\u21E7 flash requested escalation \u2014 <your reason>"), so they understand WHY a more expensive call is happening. Keep it under ~150 chars, no newlines, no nested \`>\` characters. Examples: \`<<<NEEDS_PRO: cross-file refactor across 6 modules with circular imports>>>\` or \`<<<NEEDS_PRO: subtle session-token race; flash would likely miss the locking invariant>>>\`.

Do NOT emit any other content in the same response when you request escalation. Use this sparingly: normal tasks \u2014 reading files, small edits, clear bug fixes, straightforward feature additions \u2014 stay on this tier. Request escalation ONLY when you would otherwise produce a guess or a visibly-mediocre answer. If in doubt, attempt the task here first; the system also escalates automatically if you hit 3+ repair / SEARCH-mismatch errors in a single turn (the user sees a typed breakdown). If asked which model you are, answer \`${modelId}\`.`;
}
var ESCALATION_CONTRACT = escalationContract("deepseek-v4-flash");
var NEGATIVE_CLAIM_RULE = `Negative claims ("X is missing", "Y isn't implemented", "there's no Z") are the #1 hallucination shape. They feel safe to write because no citation seems possible \u2014 but that's exactly why you must NOT write them on instinct.

If you have a search tool (\`search_content\`, \`grep\`, web search), call it FIRST before asserting absence:
- Returns matches \u2192 you were wrong; correct yourself and cite the matches.
- Returns nothing \u2192 state the absence WITH the search query as evidence: \`No callers of \\\`foo()\\\` found (search_content "foo").\`

If you have no search tool, qualify hard: "I haven't verified \u2014 this is a guess." Never assert absence with fake authority.`;

// src/skills.ts
import { existsSync as existsSync2, mkdirSync, readFileSync as readFileSync2, readdirSync, statSync as statSync2, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname, join as join2, resolve } from "path";
var SKILLS_DIRNAME = "skills";
var SKILL_FILE = "SKILL.md";
var SKILLS_INDEX_MAX_CHARS = 4e3;
var VALID_SKILL_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
function validateSkillFrontmatter(raw) {
  const { data } = parseFrontmatter(raw);
  const desc = (data.description ?? "").trim();
  if (!desc) {
    return {
      error: `skill frontmatter is missing a non-empty "description:" line \u2014 without it the skill will not appear in the model's skills index`
    };
  }
  return { ok: true };
}
function parseFrontmatter(raw) {
  const lines = raw.split(/\r?\n/);
  if (lines[0] !== "---") return { data: {}, body: raw };
  const end = lines.indexOf("---", 1);
  if (end < 0) return { data: {}, body: raw };
  const data = {};
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    if (!line) continue;
    const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_-]*):\s*(.*)$/);
    if (m?.[1]) data[m[1]] = (m[2] ?? "").trim();
  }
  return {
    data,
    body: lines.slice(end + 1).join("\n").replace(/^\n+/, "")
  };
}
function isValidSkillName(name) {
  return VALID_SKILL_NAME.test(name);
}
function parseAllowedTools(raw) {
  if (raw === void 0) return void 0;
  const names = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return names.length > 0 ? Object.freeze(names) : void 0;
}
var SkillStore = class {
  homeDir;
  projectRoot;
  disableBuiltins;
  constructor(opts = {}) {
    this.homeDir = opts.homeDir ?? homedir();
    this.projectRoot = opts.projectRoot ? resolve(opts.projectRoot) : void 0;
    this.disableBuiltins = opts.disableBuiltins === true;
  }
  /** True iff this store was configured with a project root. */
  hasProjectScope() {
    return this.projectRoot !== void 0;
  }
  /** Project scope first so per-repo skill overrides a global with the same name. */
  roots() {
    const out = [];
    if (this.projectRoot) {
      out.push({
        dir: join2(this.projectRoot, ".reasonix", SKILLS_DIRNAME),
        scope: "project"
      });
    }
    out.push({ dir: join2(this.homeDir, ".reasonix", SKILLS_DIRNAME), scope: "global" });
    return out;
  }
  /** Higher-priority root wins on collision (project > global > builtin); sorted for stable prefix hash. */
  list() {
    const byName = /* @__PURE__ */ new Map();
    for (const { dir, scope } of this.roots()) {
      if (!existsSync2(dir)) continue;
      let entries;
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        const skill = this.readEntry(dir, scope, entry);
        if (!skill) continue;
        if (!byName.has(skill.name)) byName.set(skill.name, skill);
      }
    }
    if (!this.disableBuiltins) {
      for (const skill of BUILTIN_SKILLS) {
        if (!byName.has(skill.name)) byName.set(skill.name, skill);
      }
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  /** Scaffold a new skill stub at the chosen scope. Refuses to overwrite. */
  create(name, scope) {
    return this.createWithContent(name, scope, skillStubBody(name));
  }
  /** Like `create` but writes caller-supplied file contents instead of the stub — used by the scaffold tool. */
  createWithContent(name, scope, content) {
    if (!isValidSkillName(name)) {
      return { error: `invalid skill name: "${name}" \u2014 use letters, digits, _, -, .` };
    }
    if (scope === "project" && !this.projectRoot) {
      return { error: "project scope requires a workspace \u2014 run from `reasonix code`" };
    }
    const root = scope === "project" ? join2(this.projectRoot ?? "", ".reasonix", SKILLS_DIRNAME) : join2(this.homeDir, ".reasonix", SKILLS_DIRNAME);
    const flat = join2(root, `${name}.md`);
    const folder = join2(root, name, SKILL_FILE);
    if (existsSync2(folder)) {
      return { error: `skill "${name}" already exists at ${folder}` };
    }
    mkdirSync(dirname(flat), { recursive: true });
    try {
      writeFileSync(flat, content, { encoding: "utf8", flag: "wx" });
    } catch (err) {
      if (err.code === "EEXIST") {
        return { error: `skill "${name}" already exists at ${flat}` };
      }
      throw err;
    }
    return { path: flat };
  }
  /** Resolve one skill by name. Returns `null` if not found or malformed. */
  read(name) {
    if (!isValidSkillName(name)) return null;
    for (const { dir, scope } of this.roots()) {
      if (!existsSync2(dir)) continue;
      const dirCandidate = join2(dir, name, SKILL_FILE);
      if (existsSync2(dirCandidate) && statSync2(dirCandidate).isFile()) {
        return this.parse(dirCandidate, name, scope);
      }
      const flatCandidate = join2(dir, `${name}.md`);
      if (existsSync2(flatCandidate) && statSync2(flatCandidate).isFile()) {
        return this.parse(flatCandidate, name, scope);
      }
    }
    if (!this.disableBuiltins) {
      for (const skill of BUILTIN_SKILLS) {
        if (skill.name === name) return skill;
      }
    }
    return null;
  }
  readEntry(dir, scope, entry) {
    if (entry.isDirectory()) {
      if (!isValidSkillName(entry.name)) return null;
      const file = join2(dir, entry.name, SKILL_FILE);
      if (!existsSync2(file)) return null;
      return this.parse(file, entry.name, scope);
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      const stem = entry.name.slice(0, -3);
      if (!isValidSkillName(stem)) return null;
      return this.parse(join2(dir, entry.name), stem, scope);
    }
    return null;
  }
  parse(path, stem, scope) {
    let raw;
    try {
      raw = readFileSync2(path, "utf8");
    } catch {
      return null;
    }
    const { data, body } = parseFrontmatter(raw);
    const name = data.name && isValidSkillName(data.name) ? data.name : stem;
    return {
      name,
      description: (data.description ?? "").trim(),
      body: body.trim(),
      scope,
      path,
      allowedTools: parseAllowedTools(data["allowed-tools"]),
      runAs: parseRunAs(data.runAs),
      model: data.model?.startsWith("deepseek-") ? data.model : void 0
    };
  }
};
function parseRunAs(raw) {
  return raw?.trim() === "subagent" ? "subagent" : "inline";
}
function skillStubBody(name) {
  return `---
name: ${name}
description: One-liner \u2014 what does this skill do?
---

# ${name}

Replace this body with the playbook the model should follow when this skill is invoked.

Tips:
- Reference tools by name (run_command, edit_file, search_content, ...)
- Add \`runAs: subagent\` to frontmatter to spawn an isolated subagent loop
- Add \`allowed-tools: read_file, search_content\` to scope a subagent's tools
`;
}
function skillIndexLine(s) {
  const safeDesc = s.description.replace(/\n/g, " ").trim();
  const tag = s.runAs === "subagent" ? " [\u{1F9EC} subagent]" : "";
  const max = 130 - s.name.length - tag.length;
  const clipped = safeDesc.length > max ? `${safeDesc.slice(0, Math.max(1, max - 1))}\u2026` : safeDesc;
  return clipped ? `- ${s.name}${tag} \u2014 ${clipped}` : `- ${s.name}${tag}`;
}
var MISSING_DESCRIPTION_PLACEHOLDER = '(no description \u2014 frontmatter is missing a "description:" line; tell the user to add one)';
function applySkillsIndex(basePrompt, opts = {}) {
  const store = new SkillStore(opts);
  const skills = store.list();
  if (skills.length === 0) return basePrompt;
  const lines = skills.map(
    (s) => skillIndexLine(s.description ? s : { ...s, description: MISSING_DESCRIPTION_PLACEHOLDER })
  );
  const joined = lines.join("\n");
  const truncated = joined.length > SKILLS_INDEX_MAX_CHARS ? `${joined.slice(0, SKILLS_INDEX_MAX_CHARS)}
\u2026 (truncated ${joined.length - SKILLS_INDEX_MAX_CHARS} chars)` : joined;
  return [
    basePrompt,
    "",
    "# Skills \u2014 playbooks you can invoke",
    "",
    'One-liner index. Each entry is either a built-in or a user-authored playbook. Call `run_skill({ name: "<skill-name>", arguments: "<task>" })` \u2014 the `name` is JUST the skill identifier (e.g. `"explore"`), NOT the `[\u{1F9EC} subagent]` tag that appears after it. Entries tagged `[\u{1F9EC} subagent]` spawn an **isolated subagent** \u2014 its tool calls and reasoning never enter your context, only its final answer does. Use subagent skills for tasks that would otherwise flood your context (deep exploration, multi-step research, anything where you only need the conclusion). Plain skills are inlined: their body becomes a tool result you read and act on directly. The user can also invoke a skill via `/skill <name>`.',
    "",
    "```",
    truncated,
    "```"
  ].join("\n");
}
var BUILTIN_EXPLORE_BODY = `You are running as an exploration subagent. Your job is to investigate the codebase the parent agent pointed you at, then return one focused, distilled answer.

How to operate:
- Use read_file, search_files, search_content, directory_tree, list_directory, get_file_info as your primary tools. Stay read-only.
- For "find all places that call / reference / use X" questions, use \`search_content\` (content grep) \u2014 NOT \`search_files\` (which only matches file names). This is the most common subagent mistake; using the wrong tool gives empty results and you waste your iter budget chasing a phantom.
- Cast a wide net first (search_content for symbol references, directory_tree for structure) to map the territory; then read the 3-10 most relevant files in full.
- Don't read every file \u2014 be selective. Aim for breadth on the first pass, depth only where the question demands it.
- Stop exploring as soon as you can answer the question. The parent doesn't see your tool calls, so over-exploration is pure waste.

Your final answer:
- One paragraph (or a few short bullets). Lead with the conclusion.
- Cite specific file paths + line ranges when they support the answer.
- If the question can't be answered from what you found, say so plainly and suggest where to look next.
- No follow-up offers, no "let me know if you need more." The parent will ask again if they need more.

${NEGATIVE_CLAIM_RULE}

${TUI_FORMATTING_RULES}

The 'task' the parent gave you is the question you must answer. Treat any other reading of it as scope creep.`;
var BUILTIN_RESEARCH_BODY = `You are running as a research subagent. Your job is to gather information from code AND the web, synthesize it, and return one focused conclusion.

How to operate:
- Combine code reading (read_file, search_files) with web tools (web_search, web_fetch) as appropriate to the question.
- For "how does X work" / "is Y supported" questions: web first to find the canonical reference, then verify against the local code.
- For "what's our policy on Z" / "where do we use Q": local code first, web only if you need to compare against external standards.
- Cap yourself at ~10 tool calls. If you can't converge in 10, return what you have plus a note about what's missing.

Your final answer:
- One paragraph (or short bullets). Lead with the conclusion.
- Cite both code (file:line) AND web sources (URL) when they back the answer.
- Distinguish "I verified this in code" from "I read this on a docs page" \u2014 the parent will trust the former more.
- If the answer is uncertain, say so. Don't invent confidence.

${NEGATIVE_CLAIM_RULE}

${TUI_FORMATTING_RULES}

The 'task' the parent gave you is the research question. Stay on it.`;
var BUILTIN_REVIEW_BODY = `You are running as a code-review subagent. Your job is to inspect the changes the user is about to ship \u2014 usually the current git branch vs its upstream \u2014 and produce a focused review the parent can hand back to the user.

How to operate:
- Default scope: the current branch's diff vs the default branch. If the user's task names a specific commit range or files, honor that instead.
- Discover scope first: \`run_command git status\`, \`git diff --stat\`, \`git log --oneline\` to see what changed. Then \`git diff\` (or \`git diff <base>...HEAD\`) for the actual hunks.
- Read the touched files (\`read_file\`) when the diff alone doesn't carry enough context \u2014 function signatures, surrounding invariants, callers.
- For "any callers depending on this?" questions: \`search_content\` against the symbol BEFORE asserting impact.
- Stay read-only. Never \`run_command git commit\`, never write files, never propose SEARCH/REPLACE blocks. The parent decides whether to act on your findings.
- Cap yourself at ~12 tool calls. If the diff is too big to review in one pass, pick the riskiest 2-3 files and say so explicitly.

What to look for, in priority order:
1. **Correctness bugs** \u2014 off-by-one, null/undefined handling, race conditions, wrong sign / wrong operator, edge cases the code doesn't handle.
2. **Security** \u2014 injection (SQL, shell, path traversal), secrets in code, missing authz checks, unsafe deserialization.
3. **Behavior changes the diff hides** \u2014 renames that miss callers, removed branches that were load-bearing, error-handling that now swallows what used to surface.
4. **Tests** \u2014 does the change have tests for the new behavior? Are existing tests still meaningful, or did the change make them tautological?
5. **Style + consistency** \u2014 only flag deviations that matter (unsafe \`any\`, missing types in TypeScript, inconsistent error shape). Don't pile on cosmetic nits if the substance is clean.

Your final answer:
- Lead with a one-sentence verdict: "ship as-is" / "minor nits, OK to ship after" / "blocking issues, do not ship".
- Then a short bulleted list of issues, each with: file:line citation + the problem in one sentence + what to change.
- Group by severity if you have more than 4 items: **Blocking**, **Should-fix**, **Nits**.
- If everything looks clean, say so plainly. Don't manufacture concerns.

${NEGATIVE_CLAIM_RULE}

${TUI_FORMATTING_RULES}

The 'task' the parent gave you describes WHAT to review (a branch, a file set, or "the pending changes"). Stay on it; don't redesign the feature.`;
var BUILTIN_SECURITY_REVIEW_BODY = `You are running as a security-review subagent. Your job is to inspect the changes the user is about to ship \u2014 usually the current git branch vs its upstream \u2014 through a security lens specifically, and report exploitable issues.

How to operate:
- Default scope: the current branch's diff vs the default branch. If the user names a different range or a directory, honor that.
- Discover scope first: \`git status\`, \`git diff --stat\`, \`git diff <base>...HEAD\`. Read touched files (\`read_file\`) when the diff alone doesn't carry security context \u2014 auth checks, input validation, the actual handler that calls into the changed function.
- Use \`search_content\` to verify "is this user-controlled input ever sanitized later?" / "are there other call sites that depend on this validation?" before asserting impact.
- Stay read-only. Never write, never run destructive commands, never propose SEARCH/REPLACE blocks. The parent decides what to act on.
- Cap yourself at ~12 tool calls. If the diff is too big, focus on the riskiest 2-3 files and say so explicitly.

Threat model \u2014 flag with severity:

**CRITICAL** (do-not-ship):
- SQL / NoSQL / shell / template injection \u2014 user input concatenated into a query, command, or template without parameterization.
- Path traversal \u2014 user-controlled filenames touching the filesystem without canonicalization + sandbox check.
- Authentication / authorization missing \u2014 endpoints / actions that should require a session check but don't.
- Hardcoded secrets \u2014 API keys, passwords, signing tokens visible in the diff.
- Deserialization of untrusted input \u2014 \`pickle.loads\`, \`yaml.load\` (non-safe), \`eval\`, \`Function()\`, \`unserialize()\`.
- Cryptographic mistakes \u2014 homemade crypto, weak hashes (MD5/SHA-1) for passwords, missing IVs, ECB mode, predictable nonces.

**HIGH**:
- XSS \u2014 user input rendered into HTML without escaping (or wrong escaping context).
- SSRF \u2014 fetching URLs from user input without an allowlist.
- Race conditions in security-relevant code \u2014 TOCTOU on auth/file checks.
- Open redirects \u2014 user-controlled URL passed to a redirect helper.
- Insufficient logging on security events (login failure, permission denial) \u2014 only flag if the codebase clearly DOES log elsewhere.

**MEDIUM**:
- Verbose error messages leaking internal paths / stack traces / SQL.
- Missing rate limiting on a credential / token endpoint.
- Cross-origin / cookie-flag issues (missing \`Secure\` / \`HttpOnly\` / \`SameSite\`).

Things to NOT pile on (out of scope here \u2014 the regular /review covers them):
- Style, formatting, naming.
- Performance, refactor opportunities, test coverage gaps that aren't security-relevant.
- "Should be a constant" / "extract this helper" \u2014 irrelevant to ship-blocking.

Your final answer:
- Lead with a one-sentence verdict: "no security issues found", "minor concerns", or "blocking issues".
- Then a list grouped by severity. Each item: file:line + 1-sentence threat + 1-sentence fix direction (no full SEARCH/REPLACE \u2014 the user / parent agent will write that).
- If clean, say so plainly. Don't manufacture findings.

${NEGATIVE_CLAIM_RULE}

${TUI_FORMATTING_RULES}

The 'task' the parent gave you names what to review. Stay on it; don't redesign the feature.`;
var BUILTIN_TEST_BODY = `You are running as the parent agent \u2014 this skill is INLINED, not a subagent. The user invoked /test (or asked you to "run the tests and fix failures"). Your job: run the project's test suite, diagnose any failure, propose fixes as SEARCH/REPLACE edit blocks, then re-run. Repeat until green or you hit a wall you should escalate.

How to operate:

1. **Detect the test command**.
   - Look for \`package.json\` \u2192 \`scripts.test\` first (most common: \`npm test\`, \`pnpm test\`, \`yarn test\`).
   - If no package.json or no test script: try \`pytest\`, \`go test ./...\`, \`cargo test\` based on what files exist (pyproject.toml/requirements.txt \u2192 pytest; go.mod \u2192 go test; Cargo.toml \u2192 cargo test).
   - If you can't tell, ASK the user for the command \u2014 don't guess. One question, one tool call to confirm.

2. **Run it via run_command** (typical timeout 120s, bigger if the suite is large). Capture stdout + stderr.

3. **Read the failures**. Pull out: which test names failed, the actual error/traceback, the file + line that threw. Don't just paraphrase \u2014 locate the exact assertion or stack frame.

4. **Propose fixes**. For each distinct failure:
   - If the failure is in PRODUCTION code (test catches a real bug) \u2192 propose a SEARCH/REPLACE that fixes the production code.
   - If the failure is in TEST code (test is wrong, codebase is right) \u2192 propose a SEARCH/REPLACE that updates the test, AND say so explicitly: "This is a test bug, not a production bug \u2014 updating the assertion."
   - If the failure is environmental (missing dep, wrong node version, missing fixture file) \u2192 say so and stop. Don't try to install packages or change config without checking with the user.

5. **Apply + re-run**. After the user accepts the edit blocks, run the test command again. Iterate.

6. **Stop conditions**:
   - All tests pass \u2192 report green, summarize what changed.
   - Same test still failing after 2 fix attempts on the same line \u2192 STOP. Tell the user "I've tried twice, it's still failing \u2014 here's what I think is happening, want me to try a different angle?". Don't loop indefinitely.
   - 3+ unrelated failures \u2192 fix one at a time, smallest first, so each pass narrows the surface.

Don't:
- Run \`npm install\` / \`pip install\` / \`cargo update\` without asking \u2014 those mutate lockfiles and have global effects.
- Disable, skip, or delete failing tests to "make it green". If a test seems wrong, update its assertion with a one-sentence explanation, but never add \`.skip\` / \`it.skip\` / \`@pytest.mark.skip\`.
- Modify the test runner config (vitest.config, jest.config, etc.) to silence failures.

Lead each turn with a one-line status: "\u25B8 running \`npm test\` ..." \u2192 "\u25B8 2 failures in tests/foo.test.ts \u2014 first is \u2026" \u2192 so the user always knows where you are without scrolling tool output.`;
var BUILTIN_SKILLS = Object.freeze([
  Object.freeze({
    name: "explore",
    description: "Explore the codebase in an isolated subagent \u2014 wide-net read-only investigation that returns one distilled answer. Best for: 'find all places that...', 'how does X work across the project', 'survey the code for Y'.",
    body: BUILTIN_EXPLORE_BODY,
    scope: "builtin",
    path: "(builtin)",
    runAs: "subagent"
  }),
  Object.freeze({
    name: "research",
    description: "Research a question by combining web search + code reading in an isolated subagent. Best for: 'is X feature supported by lib Y', 'what's the canonical way to do Z', 'compare our impl against the spec'.",
    body: BUILTIN_RESEARCH_BODY,
    scope: "builtin",
    path: "(builtin)",
    runAs: "subagent"
  }),
  Object.freeze({
    name: "review",
    description: "Review the pending changes (current branch diff by default) in an isolated subagent \u2014 flags correctness, security, missing tests, hidden behavior changes; reports verdict + per-issue file:line. Read-only; the parent decides what to act on.",
    body: BUILTIN_REVIEW_BODY,
    scope: "builtin",
    path: "(builtin)",
    runAs: "subagent"
  }),
  Object.freeze({
    name: "security-review",
    description: "Security-focused review of the current branch diff in an isolated subagent \u2014 flags injection/authz/secrets/deserialization/path-traversal/crypto issues, severity-tagged. Read-only. Use when shipping changes that touch auth, input parsing, file IO, or external requests.",
    body: BUILTIN_SECURITY_REVIEW_BODY,
    scope: "builtin",
    path: "(builtin)",
    runAs: "subagent"
  }),
  Object.freeze({
    name: "test",
    description: "Run the project's test suite, diagnose failures, propose SEARCH/REPLACE fixes, re-run until green (or stop after 2 fix attempts on the same failure). Inlined \u2014 runs in the parent loop so you see the edit blocks and can /apply them. Detects npm/pnpm/yarn/pytest/go/cargo.",
    body: BUILTIN_TEST_BODY,
    scope: "builtin",
    path: "(builtin)",
    runAs: "inline"
  })
]);

export {
  PROJECT_MEMORY_FILE,
  detectForeignAgentPlatform,
  findProjectMemoryPath,
  resolveProjectMemoryWritePath,
  readProjectMemory,
  memoryEnabled,
  applyProjectMemory,
  TUI_FORMATTING_RULES,
  escalationContract,
  NEGATIVE_CLAIM_RULE,
  SKILLS_DIRNAME,
  SKILL_FILE,
  validateSkillFrontmatter,
  SkillStore,
  applySkillsIndex
};
//# sourceMappingURL=chunk-6DR4F3MC.js.map