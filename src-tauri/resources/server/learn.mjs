#!/usr/bin/env node
/**
 * Visionox /learn command implementation.
 *
 * Entry points:
 *   parseLearnCommand(text)  -> { cmd, args, raw } | null
 *   executeLearnCommand(ctx, parsed, opts) -> { ok, message, detail? }
 *   getLearnStatus(opts)     -> string
 *
 * This module lives entirely inside the Visionox launcher; it does not depend
 * on upstream reasonix internals beyond the public ToolRegistry / DeepSeekClient
 * surface already used by launcher.mjs.
 */

import { resolve, basename, extname, relative, join, dirname } from "node:path";
import { isInsideWorkspace } from "./learn-sandbox-impl.mjs";
import { existsSync, mkdirSync, statSync, readdirSync, readFileSync, writeFileSync, rmSync, cpSync, renameSync } from "node:fs";
import { readdir, readFile, stat, writeFile, cp, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { getConceptManager } from "./learn-track.mjs";
import { requestModelJson, requestModelText } from "./lib/model-task-request.mjs";
import { atomicWriteFileSync } from "./lib/atomic-file.mjs";

// ── Constants ───────────────────────────────────────────────────
const LEARN_COMMANDS = ["skill", "project", "index", "ask", "tutor", "track", "status", "help"];

const LEARN_HELP = `🧠 Visionox /learn — 把项目知识转化为 AI 可复用的长期能力

━━━ 命令列表 ━━━

  /learn skill <目录> [名称]
      把目录提炼为 SKILL.md 并安装为可复用技能
      示例: /learn skill ./src/utils 字符串工具

  /learn project [名称]
      扫描当前 workspace 并更新项目记忆
      示例: /learn project

  /learn index <目录>
      为目录构建语义索引（需先在设置→语义搜索中配置嵌入模型）
      示例: /learn index ./src

  /learn ask <问题>
      基于已索引内容进行语义问答
      示例: /learn ask 认证逻辑在哪里实现？

  /learn tutor [socratic|hint|pair|off]
      开启/关闭导师模式（修改系统提示词，/new 后清除）
      示例: /learn tutor socratic

  /learn track [on|senior|off|stats|add|due]
      开启/关闭学习追踪，管理概念库
      示例: /learn track on
      示例: /learn track add "闭包" --due 3d

  /learn status
      显示学习系统当前状态

  /learn help
      显示本帮助

━━━ 说明 ━━━

  • skill/project 结果写入 ~/.visionox/skills/ 或项目记忆，/new 后生效
  • index/ask 依赖嵌入模型（Ollama 或 OpenAI-compatible）
  • tutor/track 修改当前会话提示词，/new 后清除
  • 概念库存储在 ~/.visionox/learn-track.json`;

const TEXT_EXTS = new Set([
  ".md", ".txt", ".rst", ".adoc",
  ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx",
  ".py", ".pyi", ".rs", ".go", ".java", ".kt", ".swift",
  ".c", ".cpp", ".cc", ".h", ".hpp",
  ".json", ".yaml", ".yml", ".toml", ".ini", ".cfg",
  ".sh", ".ps1", ".bat", ".cmd", ".fish",
  ".html", ".css", ".scss", ".less", ".vue", ".svelte",
]);

const IGNORE_DIRS = new Set([
  "node_modules", ".git", ".svn", ".hg", "target", "dist", "build", "out",
  ".next", ".nuxt", ".svelte-kit", ".cache", ".temp", "tmp",
]);

const IGNORE_FILES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "Cargo.lock",
  ".DS_Store", "Thumbs.db", ".env", ".env.local", ".env.production",
]);

const LEARN_LIMITS = {
  MAX_TOTAL_BYTES: 256 * 1024,      // 256 KB of text max per extraction
  MAX_FILE_BYTES: 48 * 1024,        // skip files larger than 48 KB
  MAX_FILES: 80,                    // read at most 80 files
  MAX_SKILL_NAME_LEN: 32,
};

// ── Concept extraction helpers ──────────────────────────────────
async function extractConceptsFromText(client, model, text, source, signal, capabilities = {}) {
  if (!client || !text?.trim()) return [];
  const system = `You are a learning-track assistant. Extract the key concepts a developer would need to learn to understand the content below.

Return ONLY a JSON array. Each item must have:
- "name": a short, lowercase-hyphen or English concept name (max 4 words)
- "level": 1 (recognize) to 5 (architect)
- "tags": an array of zero or more short tags

Example: [{"name":"Tauri-invoke","level":3,"tags":["rust","tauri"]}]
Do not wrap in markdown code fences. Keep names concise and avoid duplicates.`;

  const parsed = await requestModelJson({
    client,
    capabilities,
    label: "learn concept extraction",
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: text.slice(0, 12000) },
    ],
    signal,
    temperature: 0.2,
    maxTokens: 1024,
    requestPurpose: "learn",
    preferStructuredOutput: false,
  });
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((item) => item && typeof item.name === "string" && item.name.trim())
    .map((item) => ({
      name: item.name.trim(),
      level: Math.max(1, Math.min(5, Number(item.level) || 1)),
      source,
      tags: Array.isArray(item.tags) ? item.tags.filter((t) => typeof t === "string") : [],
    }));
}

function recordExtractedConcepts(concepts, sourcePrefix) {
  const mgr = getConceptManager();
  let added = 0;
  let existed = 0;
  for (const c of concepts) {
    const existing = mgr.getConcept(c.name);
    if (existing) {
      existed += 1;
    } else {
      mgr.addConcept({
        name: c.name,
        level: c.level,
        source: `${sourcePrefix}:${c.source ?? "auto"}`,
        tags: c.tags,
      });
      added += 1;
    }
  }
  return { added, existed };
}

// ── Command parsing ─────────────────────────────────────────────
export function parseLearnCommand(text) {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!/^\/learn(?:\s|$)/i.test(trimmed)) return null;
  const tail = trimmed.slice("/learn".length).trim();
  const parts = tail.split(/\s+/).filter(Boolean);
  const cmd = parts[0]?.toLowerCase() ?? "help";
  return {
    raw: trimmed,
    cmd: LEARN_COMMANDS.includes(cmd) ? cmd : "help",
    args: parts.slice(1),
    tail: parts.slice(1).join(" "),
  };
}

export function isLearnCommand(text) {
  return parseLearnCommand(text) !== null;
}

// ── Status ──────────────────────────────────────────────────────
export async function getLearnStatus(opts = {}) {
  const { workspaceDir, skillsRoot, hasSemanticSearch, getTutorMode, getLearningMode } = opts;
  const lines = ["Visionox /learn 状态"];

  // Skill count
  let skillCount = 0;
  try {
    if (existsSync(skillsRoot)) {
      skillCount = (await readdir(skillsRoot, { withFileTypes: true }))
        .filter((e) => e.isDirectory() && existsSync(join(skillsRoot, e.name, "SKILL.md")))
        .length;
    }
  } catch (error) {
    console.error(`[learn status] skill inventory unavailable: ${error.message}`);
  }
  lines.push(`- 已安装 Skill: ${skillCount}`);

  // Workspace / project memory
  if (workspaceDir) {
    lines.push(`- 当前 Workspace: ${workspaceDir}`);
    const projectFiles = PROJECT_MEMORY_CANDIDATES;
    const found = projectFiles.find((f) => existsSync(join(workspaceDir, f)));
    lines.push(`- 项目记忆文件: ${found ?? "未创建"}`);
  } else {
    lines.push("- 当前 Workspace: 未设置");
  }

  // Semantic search
  lines.push(`- 语义搜索: ${hasSemanticSearch ? "可用" : "未配置"}`);

  // Tutor mode
  const tutor = getTutorMode?.();
  if (tutor?.enabled) {
    lines.push(`- 导师模式: 开启 (${tutor.style})`);
  } else {
    lines.push("- 导师模式: 关闭");
  }

  // Learning-track mode
  const learning = getLearningMode?.();
  if (learning?.enabled) {
    lines.push(`- 学习追踪: 开启 (${learning.style === "senior" ? "资深工程师" : "主动学习"})`);
  } else {
    lines.push("- 学习追踪: 关闭");
  }

  // Concept library stats
  try {
    const mgr = getConceptManager();
    const stats = mgr.getStats();
    lines.push(`- 概念库: ${stats.total} 个概念，今日到期 ${stats.due} 个`);
  } catch {
    lines.push("- 概念库: 读取失败");
  }

  return lines.join("\n");
}

// ── Help ────────────────────────────────────────────────────────
function formatHelp() {
  return LEARN_HELP;
}

// ── Skill extraction ────────────────────────────────────────────

function isTextFile(name) {
  const ext = extname(name).toLowerCase();
  if (!ext) return false;
  return TEXT_EXTS.has(ext);
}

async function collectSourceFiles(dirPath, opts = {}) {
  const root = resolve(dirPath);
  const files = [];
  let totalBytes = 0;

  async function visit(dir) {
    if (files.length >= LEARN_LIMITS.MAX_FILES) return;
    if (totalBytes >= LEARN_LIMITS.MAX_TOTAL_BYTES) return;

    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    // Stable order: directories first, then files; alphabetical within each.
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (files.length >= LEARN_LIMITS.MAX_FILES) break;
      if (totalBytes >= LEARN_LIMITS.MAX_TOTAL_BYTES) break;
      if (entry.name.startsWith(".") && !entry.name.startsWith("..")) continue;
      if (IGNORE_DIRS.has(entry.name)) continue;

      const absPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await visit(absPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (IGNORE_FILES.has(entry.name)) continue;
      if (!isTextFile(entry.name)) continue;

      let st;
      try {
        st = await stat(absPath);
      } catch {
        continue;
      }
      if (!st.isFile()) continue;
      if (st.size > LEARN_LIMITS.MAX_FILE_BYTES) continue;

      let content;
      try {
        content = await readFile(absPath, "utf8");
      } catch {
        continue;
      }
      // Basic binary check: bail on null bytes.
      if (content.includes("\0")) continue;

      const rel = relative(root, absPath).replace(/\\/g, "/");
      const snippet = content;
      totalBytes += snippet.length;
      files.push({ path: rel, content: snippet });
    }
  }

  await visit(root);
  return { files, totalBytes };
}

function sanitizeSkillName(name) {
  const raw = String(name ?? "").trim().toLowerCase();
  if (!raw) return null;
  // Allow lowercase, digits, hyphens; collapse multiple hyphens.
  const cleaned = raw.replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!cleaned || !/^[a-z0-9]/.test(cleaned)) return null;
  if (cleaned.length > LEARN_LIMITS.MAX_SKILL_NAME_LEN) return cleaned.slice(0, LEARN_LIMITS.MAX_SKILL_NAME_LEN).replace(/-$/, "");
  return cleaned;
}

function deriveSkillName(dirPath, explicitName) {
  const explicit = sanitizeSkillName(explicitName);
  if (explicit) return explicit;
  return sanitizeSkillName(basename(resolve(dirPath))) ?? "learned-skill";
}

function validateSkillMarkdown(contents) {
  const trimmed = String(contents ?? "").trimStart();
  const match = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/.exec(trimmed);
  if (!match) {
    return { ok: false, error: "SKILL.md must start with YAML frontmatter delimited by ---." };
  }
  const frontmatter = match[1];
  const nameMatch = /^name:\s*["']?([a-z0-9][a-z0-9-]*[a-z0-9]|[a-z0-9])["']?\s*$/m.exec(frontmatter);
  if (!nameMatch) {
    return { ok: false, error: "SKILL.md frontmatter must include a valid lowercase-hyphen name." };
  }
  return { ok: true, name: nameMatch[1], frontmatter };
}

function markdownBody(contents) {
  const trimmed = String(contents ?? "").trim();
  return trimmed.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n|$)/, "").trim();
}

function markdownHeadingCount(contents) {
  return (String(contents ?? "").match(/^#{2,6}\s+\S.+$/gm) || []).length;
}

export function validateGeneratedSkillMarkdown(contents) {
  const base = validateSkillMarkdown(contents);
  if (!base.ok) return base;
  const body = markdownBody(contents);
  if (body.length < 180 || markdownHeadingCount(body) < 3) {
    return { ok: false, error: "generated SKILL.md body is too short or lacks the required workflow sections" };
  }
  return { ...base, bodyChars: body.length };
}

async function callLlmForSkill(client, model, files, skillName, signal, capabilities = {}) {
  const fileBlocks = files
    .map((f) => `### File: ${f.path}\n\n\`\`\`\n${f.content}\n\`\`\``)
    .join("\n\n");

  const system = `You are a technical documentation writer. Your task is to convert a collection of source files and notes into a Visionox SKILL.md file.

Output rules:
- MUST begin with YAML frontmatter: ---\nname: <lowercase-hyphen-name>\ndescription: "short English description"\ndescription_zh: "short Chinese description"\nversion: 1.0.0\n---
- The name in frontmatter MUST be exactly "${skillName}".
- After frontmatter, write concise markdown sections: Purpose, When to use, Core rules, Common workflow, Examples, Safety / Error handling, Limitations.
- Do not invent files or APIs that are not in the provided context.
- Keep total output under 4000 Chinese characters or 6000 English characters.
- Respond ONLY with the SKILL.md content, no extra explanation.`;

  const user = `Please create a SKILL.md for the skill named "${skillName}" based on the following files:\n\n${fileBlocks}`;

  return requestModelText({
    client,
    capabilities,
    label: "learn skill generation",
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    signal,
    temperature: 0.2,
    maxTokens: 4096,
    requestPurpose: "learn",
  });
}

function installSkillDirectoryAtomic(name, srcDir, { overwrite = false, skillsRoot } = {}) {
  const skillDir = resolve(skillsRoot, name);
  if (existsSync(skillDir) && !overwrite) {
    return {
      error: `skill already exists: ${skillDir}`,
      hint: "Pass overwrite: true only when replacing this skill is intentional.",
    };
  }

  const skillMd = resolve(srcDir, "SKILL.md");
  if (!existsSync(skillMd)) {
    return { error: `skill directory must contain SKILL.md at its root: ${srcDir}` };
  }
  const validation = validateSkillMarkdown(readFileSync(skillMd, "utf8"));
  if (!validation.ok) return { error: validation.error };
  if (validation.name !== name) {
    return { error: `SKILL.md name "${validation.name}" does not match install name "${name}".` };
  }

  if (!existsSync(skillsRoot)) mkdirSync(skillsRoot, { recursive: true });
  const stagingDir = resolve(skillsRoot, `.${name}-stage-${randomUUID()}`);
  let backup = null;
  try {
    cpSync(srcDir, stagingDir, { recursive: true });
    const stagedValidation = validateSkillMarkdown(readFileSync(resolve(stagingDir, "SKILL.md"), "utf8"));
    if (!stagedValidation.ok) return { error: stagedValidation.error };

    if (existsSync(skillDir)) {
      backup = `${skillDir}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
      cpSync(skillDir, backup, { recursive: true });
      rmSync(skillDir, { recursive: true, force: true });
    }
    renameSync(stagingDir, skillDir);
    return { installed: true, name, path: skillDir, backup };
  } catch (err) {
    try { rmSync(stagingDir, { recursive: true, force: true }); } catch {}
    return { error: `install failed: ${err.message}` };
  }
}

async function runLearnSkill(args, opts) {
  const { client, model, workspaceDir, skillsRoot, allowAllPaths, capabilities } = opts;

  if (!client) {
    return { ok: false, message: "尚未配置 API Key，无法使用 /learn skill。请先在 设置 → 模型服务 中配置。" };
  }

  const rawPath = args[0];
  if (!rawPath) {
    return { ok: false, message: "用法: /learn skill <目录> [名称]\n例如: /learn skill ./docs/api api-design-guide" };
  }

  let dirPath;
  if (rawPath.startsWith("~")) {
    dirPath = resolve(rawPath.replace(/^~/, process.env.HOME ?? process.env.USERPROFILE ?? "."));
  } else if (rawPath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(rawPath)) {
    dirPath = resolve(rawPath);
  } else {
    // Relative paths resolve against workspaceDir, not process.cwd().
    dirPath = resolve(workspaceDir ?? process.cwd(), rawPath);
  }
  if (!existsSync(dirPath)) {
    return { ok: false, message: `目录不存在: ${dirPath}` };
  }
  if (!statSync(dirPath).isDirectory()) {
    return { ok: false, message: `路径不是目录: ${dirPath}` };
  }

  // Path sandbox: unless admin/yolo, target must be inside workspaceDir.
  if (!allowAllPaths?.()) {
    if (!isInsideWorkspace(dirPath, workspaceDir)) {
      return { ok: false, message: `出于安全考虑，/learn skill 只能处理 workspace 或其子目录。当前 workspace: ${workspaceDir ?? "未设置"}` };
    }
  }

  const skillName = deriveSkillName(dirPath, args[1]);
  if (!skillName) {
    return { ok: false, message: "无法生成有效的 Skill 名称，请显式提供一个英文小写+连字符的名称。" };
  }

  const { files, totalBytes } = await collectSourceFiles(dirPath);
  if (files.length === 0) {
    return { ok: false, message: `未在 ${dirPath} 中找到可读取的文本文件。支持的扩展名: ${[...TEXT_EXTS].join(", ")}` };
  }

  let generated;
  try {
    generated = await callLlmForSkill(client, model, files, skillName, opts.signal, capabilities);
  } catch (err) {
    return { ok: false, message: `调用 LLM 生成 SKILL.md 失败: ${err.message}` };
  }

  const validation = validateGeneratedSkillMarkdown(generated);
  if (!validation.ok) {
    return {
      ok: false,
      message: `LLM 生成的 SKILL.md 格式校验失败: ${validation.error}。你可以重试，或手动编辑后通过 install_skill 安装。`,
      detail: generated,
    };
  }
  if (validation.name !== skillName) {
    return {
      ok: false,
      message: `LLM 生成的 SKILL.md 名称 "${validation.name}" 与期望名称 "${skillName}" 不一致。`,
      detail: generated,
    };
  }

  const tempDir = resolve(skillsRoot, `.${skillName}-learn-${randomUUID()}`);
  try {
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(resolve(tempDir, "SKILL.md"), generated, "utf8");

    const installed = installSkillDirectoryAtomic(skillName, tempDir, { overwrite: false, skillsRoot });
    if (installed.error) {
      return { ok: false, message: `安装 Skill 失败: ${installed.error}` };
    }

    let conceptNote = "";
    try {
      const concepts = await extractConceptsFromText(client, model, generated, `skill:${skillName}`, opts.signal, capabilities);
      if (concepts.length > 0) {
        const { added, existed } = recordExtractedConcepts(concepts, "skill");
        conceptNote = `\n\n同时已提取 ${concepts.length} 个核心概念到学习追踪库（新增 ${added}，已存在 ${existed}）。`;
      }
    } catch (err) {
      console.error(`[learn skill] concept extraction failed: ${err.message}`);
    }

    return {
      ok: true,
      message: `✅ 已从 ${files.length} 个文件（共 ${totalBytes} 字符）萃取出 Skill "${skillName}" 并安装到:\n${installed.path}${conceptNote}\n\n提示：输入 /new 或重启对话后即可使用此 Skill。`,
    };
  } finally {
    try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
}

// ── Project onboarding ──────────────────────────────────────────
function resolveProjectMemoryWritePath(rootDir) {
  return join(rootDir, "visionox.md");
}

export function validateProjectMemoryMarkdown(contents) {
  const text = String(contents ?? "").trim();
  if (text.length < 180 || markdownHeadingCount(text) < 3) {
    return { ok: false, error: "generated project memory is too short or lacks enough structured sections" };
  }
  const sectionGroups = [
    /tech\s*stack|技术栈|技术选型/i,
    /project\s*structure|项目结构|目录结构/i,
    /build|test|构建|测试|命令/i,
    /convention|约定|规范/i,
    /common\s*tasks|常见任务|工作流/i,
    /important\s*notes|注意事项|重要说明/i,
  ];
  const matchedSections = sectionGroups.filter((pattern) => pattern.test(text)).length;
  if (matchedSections < 3) {
    return { ok: false, error: "generated project memory is missing the required project sections" };
  }
  return { ok: true, chars: text.length, sections: matchedSections };
}

async function collectProjectFiles(rootDir) {
  const files = [];
  let totalBytes = 0;

  // Priority files we always try to read first.
  const priority = ["README.md", "README.zh-CN.md", "package.json", "Cargo.toml", "tauri.conf.json", "pyproject.toml", "setup.py"];
  for (const name of priority) {
    const path = join(rootDir, name);
    if (!existsSync(path)) continue;
    try {
      const st = statSync(path);
      if (!st.isFile() || st.size > LEARN_LIMITS.MAX_FILE_BYTES) continue;
      const content = readFileSync(path, "utf8");
      if (content.includes("\0")) continue;
      totalBytes += content.length;
      files.push({ path: name, content });
    } catch (error) {
      console.error(`[learn project] skipped ${name}: ${error.message}`);
    }
  }

  // Then a shallow tree scan for a few more text files.
  try {
    const entries = readdirSync(rootDir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (files.length >= LEARN_LIMITS.MAX_FILES) break;
      if (totalBytes >= LEARN_LIMITS.MAX_TOTAL_BYTES) break;
      if (entry.name.startsWith(".")) continue;
      if (IGNORE_DIRS.has(entry.name)) continue;
      if (!entry.isFile()) continue;
      if (IGNORE_FILES.has(entry.name)) continue;
      if (priority.includes(entry.name)) continue; // already handled
      if (!isTextFile(entry.name)) continue;

      try {
        const st = statSync(join(rootDir, entry.name));
        if (st.size > LEARN_LIMITS.MAX_FILE_BYTES) continue;
        const content = readFileSync(join(rootDir, entry.name), "utf8");
        if (content.includes("\0")) continue;
        totalBytes += content.length;
        files.push({ path: entry.name, content });
      } catch (error) {
        console.error(`[learn project] skipped ${entry.name}: ${error.message}`);
      }
    }
  } catch (error) {
    throw new Error(`project directory could not be scanned: ${error.message}`);
  }

  return { files, totalBytes };
}

async function callLlmForProjectMemory(client, model, files, projectName, signal, capabilities = {}) {
  const fileBlocks = files
    .map((f) => `### ${f.path}\n\n\`\`\`\n${f.content}\n\`\`\``)
    .join("\n\n");

  const system = `You are a technical onboarding assistant. Write a concise project memory file for an AI coding agent.

Output rules:
- Format: markdown, no YAML frontmatter.
- Start with a one-line project summary.
- Include sections: Tech stack, Project structure, Build / test commands, Key conventions, Common tasks, Important notes.
- Do not invent information not present in the files.
- Keep under 3000 Chinese characters or 4500 English characters.
- Respond ONLY with the markdown content.`;

  const user = `Project name: ${projectName}\n\nCreate a project memory file based on these files:\n\n${fileBlocks}`;

  return requestModelText({
    client,
    capabilities,
    label: "learn project memory generation",
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    signal,
    temperature: 0.2,
    maxTokens: 3072,
    requestPurpose: "learn",
  });
}

async function runLearnProject(args, opts) {
  const { client, model, workspaceDir, capabilities } = opts;

  if (!client) {
    return { ok: false, message: "尚未配置 API Key，无法使用 /learn project。请先在 设置 → 模型服务 中配置。" };
  }
  if (!workspaceDir || !existsSync(workspaceDir)) {
    return { ok: false, message: "当前 Workspace 未设置或不存在，请先配置 workspace。" };
  }

  const projectName = sanitizeSkillName(args[0]) ?? sanitizeSkillName(basename(workspaceDir)) ?? "current-project";
  const { files, totalBytes } = await collectProjectFiles(workspaceDir);
  if (files.length === 0) {
    return { ok: false, message: "未在 workspace 中找到可读取的项目文件。" };
  }

  let generated;
  try {
    generated = await callLlmForProjectMemory(client, model, files, projectName, opts.signal, capabilities);
  } catch (err) {
    return { ok: false, message: `调用 LLM 生成项目记忆失败: ${err.message}` };
  }

  const validation = validateProjectMemoryMarkdown(generated);
  if (!validation.ok) {
    return {
      ok: false,
      message: `LLM 生成的项目记忆未通过完整性校验: ${validation.error}。原有 visionox.md 未修改，请重试或手动编辑。`,
      detail: generated,
    };
  }

  const targetPath = resolveProjectMemoryWritePath(workspaceDir);
  try {
    mkdirSync(dirname(targetPath), { recursive: true });
    const header = `# ${basename(workspaceDir)} — Project Memory\n\n> Auto-generated by /learn project. Edit freely.\n\n`;
    atomicWriteFileSync(targetPath, header + generated.trim() + "\n", "utf8");

    let conceptNote = "";
    try {
      const concepts = await extractConceptsFromText(client, model, generated, `project:${projectName}`, opts.signal, capabilities);
      if (concepts.length > 0) {
        const { added, existed } = recordExtractedConcepts(concepts, "project");
        conceptNote = `\n\n同时已提取 ${concepts.length} 个核心概念到学习追踪库（新增 ${added}，已存在 ${existed}）。`;
      }
    } catch (err) {
      console.error(`[learn project] concept extraction failed: ${err.message}`);
    }

    return {
      ok: true,
      message: `✅ 已根据 ${files.length} 个文件（共 ${totalBytes} 字符）生成/更新项目记忆:\n${targetPath}${conceptNote}\n\n提示：项目记忆会在新对话中自动注入。`,
    };
  } catch (err) {
    return { ok: false, message: `写入项目记忆失败: ${err.message}` };
  }
}

// ── Knowledge base indexing & Q&A ───────────────────────────────
function isSemanticConfigured(configPath, loadSemanticEmbeddingUserConfig) {
  try {
    const cfg = loadSemanticEmbeddingUserConfig?.(configPath);
    if (!cfg) return false;
    if (cfg.provider === "openai-compat") {
      return Boolean(cfg.openaiCompat?.baseUrl?.trim() && cfg.openaiCompat?.apiKey?.trim() && cfg.openaiCompat?.model?.trim());
    }
    // ollama defaults are acceptable
    return true;
  } catch {
    return false;
  }
}

async function runLearnIndex(args, opts) {
  const { workspaceDir, configPath, allowAllPaths, buildIndex, indexExists, loadSemanticEmbeddingUserConfig } = opts;

  if (!buildIndex || !indexExists) {
    return { ok: false, message: "语义搜索模块未加载，无法使用 /learn index。" };
  }

  const rawPath = args[0];
  if (!rawPath) {
    return { ok: false, message: "用法: /learn index <目录>\n例如: /learn index ./src" };
  }

  let dirPath;
  if (rawPath.startsWith("~")) {
    dirPath = resolve(rawPath.replace(/^~/, process.env.HOME ?? process.env.USERPROFILE ?? "."));
  } else if (rawPath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(rawPath)) {
    dirPath = resolve(rawPath);
  } else {
    dirPath = resolve(workspaceDir ?? process.cwd(), rawPath);
  }
  if (!existsSync(dirPath)) {
    return { ok: false, message: `目录不存在: ${dirPath}` };
  }
  if (!statSync(dirPath).isDirectory()) {
    return { ok: false, message: `路径不是目录: ${dirPath}` };
  }

  // Path sandbox: unless admin/yolo, target must be inside workspaceDir.
  if (!allowAllPaths?.()) {
    if (!isInsideWorkspace(dirPath, workspaceDir)) {
      return { ok: false, message: `出于安全考虑，/learn index 只能处理 workspace 或其子目录。当前 workspace: ${workspaceDir ?? "未设置"}` };
    }
  }

  const configured = isSemanticConfigured(configPath, loadSemanticEmbeddingUserConfig);
  if (!configured) {
    return {
      ok: false,
      message: "语义搜索尚未配置。请在 Dashboard → 设置 → 语义搜索 中配置 Ollama 或 OpenAI-compatible 嵌入模型，然后重试。",
    };
  }

  const existedBefore = await indexExists(dirPath).catch(() => false);
  let lastPhase = "setup";
  let progressInfo = "";

  try {
    const result = await buildIndex(dirPath, {
      configPath,
      rebuild: false,
      signal: opts.signal,
      onProgress: (p) => {
        lastPhase = p.phase;
        if (p.filesScanned !== undefined) {
          progressInfo = `已扫描 ${p.filesScanned ?? 0} 个文件${p.chunksDone !== undefined ? `，已嵌入 ${p.chunksDone ?? 0}/${p.chunksTotal ?? 0} 个片段` : ""}`;
        }
      },
    });
    return {
      ok: true,
      message: `✅ 语义索引${existedBefore ? "更新" : "构建"}完成\n\n目录: ${dirPath}\n阶段: ${lastPhase}\n扫描文件: ${result.filesScanned}\n变更文件: ${result.filesChanged}\n新增片段: ${result.chunksAdded}\n跳过片段: ${result.chunksSkipped}\n耗时: ${result.durationMs}ms\n\n提示：索引存储在全局位置，现在可以使用 /learn ask <问题> 基于这些内容提问。`,
    };
  } catch (err) {
    return {
      ok: false,
      message: `索引构建失败（阶段: ${lastPhase}${progressInfo ? "，" + progressInfo : ""}）: ${err.message}\n\n请检查:\n1. 嵌入模型是否可访问（Ollama 是否运行 / OpenAI-compatible URL 是否有效）\n2. 模型名称是否正确\n3. 网络或 API Key 是否正常`,
    };
  }
}

async function runLearnAsk(args, opts) {
  const { client, model, workspaceDir, configPath, querySemantic, indexExists, loadSemanticEmbeddingUserConfig, capabilities } = opts;

  if (!querySemantic || !indexExists) {
    return { ok: false, message: "语义搜索模块未加载，无法使用 /learn ask。" };
  }

  const question = opts.tail?.trim();
  if (!question) {
    return { ok: false, message: "用法: /learn ask <问题>\n例如: /learn ask 这个项目怎么构建？" };
  }

  const configured = isSemanticConfigured(configPath, loadSemanticEmbeddingUserConfig);
  if (!configured) {
    return {
      ok: false,
      message: "语义搜索尚未配置。请在 Dashboard → 设置 → 语义搜索 中配置嵌入模型，然后先用 /learn index <目录> 建立索引。",
    };
  }

  const root = workspaceDir ?? process.cwd();
  const exists = await indexExists(root).catch(() => false);
  if (!exists) {
    return {
      ok: false,
      message: "尚未建立语义索引。请先使用 /learn index <目录> 索引至少一个目录。",
    };
  }

  let hits;
  try {
    hits = await querySemantic(root, question, { configPath, topK: 8, minScore: 0.3, signal: opts.signal });
  } catch (err) {
    return { ok: false, message: `语义搜索失败: ${err.message}` };
  }

  if (!Array.isArray(hits) || hits.length === 0) {
    return { ok: true, message: `未找到与 "${question}" 相关的内容。\n\n建议：\n1. 用更宽泛或更具体的描述重试\n2. 先用 /learn index <目录> 索引更多文件\n3. 降低相似度阈值（当前 0.3）` };
  }

  // Format snippets for answer synthesis.
  const context = hits
    .map((h, i) => `--- 来源 ${i + 1}: ${h.entry?.path ?? "unknown"} ---\n${h.entry?.text ?? ""}`)
    .join("\n\n");

  if (!client) {
    // Return raw snippets if no LLM client.
    return {
      ok: true,
      message: `找到 ${hits.length} 条相关内容（未配置 LLM，仅返回片段）:\n\n${context}`,
    };
  }

  const system = `You are a helpful assistant. Answer the user's question based ONLY on the provided source snippets.

Rules:
- If the snippets do not contain enough information, say so clearly.
- Cite sources using [来源 N] format.
- Keep the answer concise and in the same language as the question.
- Do not invent facts not present in the snippets.`;

  const user = `Question: ${question}\n\nSource snippets:\n${context}\n\nPlease answer the question.`;

  try {
    const answer = (await requestModelText({
      client,
      capabilities,
      label: "learn indexed answer",
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      signal: opts.signal,
      temperature: 0.2,
      maxTokens: 2048,
      requestPurpose: "learn",
    })).trim();
    return {
      ok: true,
      message: `${answer}\n\n---\n基于 ${hits.length} 条索引片段回答。如需查看原始片段，请说“显示来源”。`,
    };
  } catch (err) {
    return {
      ok: true,
      message: `找到 ${hits.length} 条相关内容，但 LLM 合成回答失败: ${err.message}\n\n原始片段:\n\n${context}`,
    };
  }
}

// ── Track / spaced-repetition mode ──────────────────────────────
function runLearnTrack(args, opts) {
  const { setLearningMode, getLearningMode, rebuildLoop } = opts;
  if (!setLearningMode || !getLearningMode) {
    return { ok: false, message: "学习追踪状态未初始化，无法使用 /learn track。" };
  }

  const mgr = getConceptManager();
  const requested = (args[0] ?? "").trim().toLowerCase();

  // /learn track on|senior|off
  const validStyles = ["on", "senior"];
  if (!requested || requested === "off") {
    const had = getLearningMode()?.enabled;
    setLearningMode(null);
    rebuildLoop?.();
    return {
      ok: true,
      message: had
        ? "✅ 学习追踪模式已关闭。当前会话恢复为默认助手行为。"
        : "学习追踪模式当前未开启。",
    };
  }

  if (validStyles.includes(requested)) {
    const previous = getLearningMode();
    setLearningMode(requested);
    rebuildLoop?.();
    if (previous?.enabled && previous.style === requested) {
      return { ok: true, message: `学习追踪模式已经是 ${requested === "on" ? "主动学习" : "资深工程师"}，无需切换。` };
    }
    const label = requested === "on" ? "主动学习模式" : "资深工程师学习模式";
    return {
      ok: true,
      message: `✅ 已开启 ${label}。\n\nAI 会在后续回复中围绕概念库进行追问和串联。输入 "/learn track off" 关闭，或 "/new" 清除会话后自动关闭。`,
    };
  }

  // /learn track stats
  if (requested === "stats") {
    const stats = mgr.getStats();
    const levelBars = [1, 2, 3, 4, 5]
      .map((lvl) => `  L${lvl}: ${stats.levels[lvl] ?? 0}`)
      .join("\n");
    const dueList = mgr.getDueConcepts().slice(0, 10);
    const dueBlock = dueList.length
      ? dueList.map((c) => `• ${c.name} (L${c.level}, 间隔 ${c.interval} 天)`).join("\n")
      : "暂无到期概念。";
    return {
      ok: true,
      message: `📊 学习追踪统计\n\n总概念数: ${stats.total}\n今日到期: ${stats.due}\n已复习过: ${stats.reviewed}\n平均难度系数: ${stats.avgEase}\n\n掌握层级:\n${levelBars}\n\n今日到期:\n${dueBlock}\n\n概念库: ~/.visionox/learn-track.json`,
    };
  }

  // /learn track due [N]
  if (requested === "due") {
    const due = mgr.getDueConcepts();
    if (due.length === 0) {
      return { ok: true, message: "🎉 当前没有到期的概念。继续保持！" };
    }
    const list = due
      .map((c, i) => `${i + 1}. ${c.name} (L${c.level}, 间隔 ${c.interval} 天, ease ${c.ease.toFixed(2)})`)
      .join("\n");
    return {
      ok: true,
      message: `📝 今日到期概念 (${due.length} 个):\n\n${list}\n\n你可以直接聊相关代码，让 AI 围绕这些概念提问；或用 "/learn track review <概念名> <again|hard|good|easy>" 记录复习结果。`,
    };
  }

  // /learn track add <name> [level=L1] [source=...]
  if (requested === "add") {
    const name = args.slice(1).find((a) => !a.startsWith("level=") && !a.startsWith("source="));
    if (!name) {
      return {
        ok: false,
        message: '用法: /learn track add <概念名> [level=1-5] [source=user]\n示例: /learn track add Tauri-invoke level=3 source=project',
      };
    }
    const levelArg = args.slice(1).find((a) => a.startsWith("level="));
    const sourceArg = args.slice(1).find((a) => a.startsWith("source="));
    const level = levelArg ? Number(levelArg.slice(6)) : 1;
    const source = sourceArg ? sourceArg.slice(7) : "user";
    try {
      const c = mgr.addConcept({ name, level, source });
      return {
        ok: true,
        message: `✅ 已添加概念 "${c.name}" (ID: ${c.id}, L${c.level}, 来源: ${c.source})。`,
      };
    } catch (err) {
      return { ok: false, message: `添加概念失败: ${err.message}` };
    }
  }

  // /learn track review <name/id> <again|hard|good|easy>
  if (requested === "review") {
    const quality = args[args.length - 1]?.toLowerCase();
    const qualityKeywords = ["again", "hard", "good", "easy"];
    if (args.length < 3 || !qualityKeywords.includes(quality)) {
      return {
        ok: false,
        message: '用法: /learn track review <概念名或ID> <again|hard|good|easy>\n示例: /learn track review Tauri-invoke good',
      };
    }
    const nameOrId = args[1];
    const updated = mgr.review(nameOrId, quality);
    if (!updated) {
      return { ok: false, message: `未找到概念 "${nameOrId}"。先用 "/learn track due" 查看或 "/learn track add" 添加。` };
    }
    return {
      ok: true,
      message: `✅ 已记录 "${updated.name}" 的复习结果为 "${quality}"。\n下次复习: ${updated.nextReview}（间隔 ${updated.interval} 天，ease ${updated.ease.toFixed(2)}）。`,
    };
  }

  return {
    ok: false,
    message: `不支持的 /learn track 子命令: "${requested}"。\n用法: /learn track [on|senior|off|stats|due|add <概念名> [level=1-5] [source=...]|review <概念名> <again|hard|good|easy>]`,
  };
}

// ── Tutor mode ──────────────────────────────────────────────────
function runLearnTutor(args, opts) {
  const { setTutorMode, getTutorMode, rebuildLoop } = opts;
  if (!setTutorMode || !getTutorMode) {
    return { ok: false, message: "导师模式状态未初始化，无法使用 /learn tutor。" };
  }

  const requested = (args[0] ?? "").trim().toLowerCase();
  const validStyles = ["socratic", "hint", "pair"];

  if (!requested || requested === "off") {
    const hadTutor = getTutorMode()?.enabled;
    setTutorMode(null);
    rebuildLoop?.();
    return {
      ok: true,
      message: hadTutor
        ? "✅ 导师模式已关闭。当前会话恢复为默认助手行为。"
        : "导师模式当前未开启。",
    };
  }

  if (!validStyles.includes(requested)) {
    return {
      ok: false,
      message: `不支持的导师风格: "${requested}"。可用风格: socratic（苏格拉底式）、hint（提示式）、pair（结对编程）。\n用法: /learn tutor [socratic|hint|pair|off]`,
    };
  }

  const previous = getTutorMode();
  setTutorMode(requested);
  rebuildLoop?.();

  const styleLabels = {
    socratic: "苏格拉底式",
    hint: "提示式",
    pair: "结对编程",
  };

  if (previous?.enabled && previous.style === requested) {
    return { ok: true, message: `导师模式已经是 ${styleLabels[requested]}，无需切换。` };
  }

  return {
    ok: true,
    message: `✅ 已开启 ${styleLabels[requested]} 导师模式。\n\n系统提示词已更新，后续回复将按导师风格进行。输入 "/learn tutor off" 关闭，或 "/new" 清除会话后自动关闭。`,
  };
}

// ── Dispatch ────────────────────────────────────────────────────
export async function executeLearnCommand(parsed, opts) {
  const { cmd, args } = parsed;

  switch (cmd) {
    case "help":
      return { ok: true, message: formatHelp() };
    case "status":
      return { ok: true, message: await getLearnStatus(opts) };
    case "skill":
      return runLearnSkill(args, opts);
    case "project":
      return runLearnProject(args, opts);
    case "index":
      return runLearnIndex(args, opts);
    case "ask":
      return runLearnAsk(args, opts);
    case "tutor":
      return runLearnTutor(args, opts);
    case "track":
      return runLearnTrack(args, opts);
    default:
      return { ok: false, message: formatHelp() };
  }
}
