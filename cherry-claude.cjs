const path = require('path');
const fs = require('fs');

let failCount = 0;

const serverDir = path.join(__dirname, 'src-tauri', 'resources', 'server', 'visionox-pkg', 'dist', 'cli');

// ============================================================
// 5a. chunk-2K65GZBT.js — update PROJECT_MEMORY_FILES
// ============================================================
let file = path.join(serverDir, 'chunk-2K65GZBT.js');
let content = fs.readFileSync(file, 'utf8');

const oldArr = 'var PROJECT_MEMORY_FILES = ["REASONIX.md", "AGENTS.md", "AGENT.md"];';
const newArr = 'var PROJECT_MEMORY_FILES = ["REASONIX.md", "visionox.md", ".claude/CLAUDE.md", "CLAUDE.md", "AGENTS.md", "AGENT.md"];';

if (content.includes(oldArr)) {
  content = content.replace(oldArr, newArr);
  fs.writeFileSync(file, content, 'utf8');
  console.log('OK: chunk-2K65GZBT.js — PROJECT_MEMORY_FILES updated');
} else {
  console.log('FAIL: chunk-2K65GZBT.js — PROJECT_MEMORY_FILES not found');
  failCount++;
}

// ============================================================
// 5b. chunk-5JJRUIPA.js — add readGlobalClaudeMemory + applyGlobalClaudeMemory
// ============================================================
file = path.join(serverDir, 'chunk-5JJRUIPA.js');
content = fs.readFileSync(file, 'utf8');

// Insert readGlobalClaudeMemory after readGlobalReasonixMemory
const readGlobalReasonixEnd = `	return { path, content, originalChars, truncated };
}`;
const readClaudeFn = `
function readGlobalClaudeMemory(homeDir = join(homedir(), ".claude")) {
  const path = join(homeDir, "CLAUDE.md");
  if (!existsSync(path)) return null;
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const originalChars = trimmed.length;
  const truncated = originalChars > 8e3;
  const content = truncated ? \`\${trimmed.slice(0, 8e3)}
… (truncated \${originalChars - 8e3} chars)\` : trimmed;
  return { path, content, originalChars, truncated };
}`;

if (content.includes(readGlobalReasonixEnd) && !content.includes('readGlobalClaudeMemory')) {
  content = content.replace(readGlobalReasonixEnd, readGlobalReasonixEnd + readClaudeFn);
  console.log('OK: chunk-5JJRUIPA.js — readGlobalClaudeMemory added');
} else {
  console.log('SKIP: chunk-5JJRUIPA.js — readGlobalClaudeMemory already exists or anchor not found');
}

// Insert applyGlobalClaudeMemory after applyGlobalReasonixMemory
const applyGlobalReasonixEnd = `  ].join("\\n");
}`;
const applyClaudeFn = `
function applyGlobalClaudeMemory(basePrompt2) {
  if (!memoryEnabled()) return basePrompt2;
  const mem = readGlobalClaudeMemory();
  if (!mem) return basePrompt2;
  return [
    basePrompt2,
    "",
    "# Global memory (~/.claude/CLAUDE.md)",
    "",
    "Cross-project notes from your Claude Code configuration. Treat as authoritative — same level of trust as project memory.",
    "",
    "\`\`\`",
    mem.content,
    "\`\`\`"
  ].join("\\n");
}`;

if (content.includes(applyGlobalReasonixEnd) && !content.includes('applyGlobalClaudeMemory')) {
  content = content.replace(applyGlobalReasonixEnd, applyGlobalReasonixEnd + applyClaudeFn);
  console.log('OK: chunk-5JJRUIPA.js — applyGlobalClaudeMemory added');
} else {
  console.log('SKIP: chunk-5JJRUIPA.js — applyGlobalClaudeMemory already exists or anchor not found');
}

// Update applyMemoryStack to call applyGlobalClaudeMemory
const oldStack = `function applyMemoryStack(basePrompt, rootDir) {
  const withProject = applyProjectMemory(basePrompt, rootDir);
  const withGlobal = applyGlobalReasonixMemory(withProject);
  const withMemory = applyUserMemory(withGlobal, { projectRoot: rootDir });
  return applySkillsIndex(withMemory, { projectRoot: rootDir });
}`;

const newStack = `function applyMemoryStack(basePrompt, rootDir) {
  const withProject = applyProjectMemory(basePrompt, rootDir);
  const withGlobal = applyGlobalReasonixMemory(withProject);
  const withGlobalClaude = applyGlobalClaudeMemory(withGlobal);
  const withMemory = applyUserMemory(withGlobalClaude, { projectRoot: rootDir });
  return applySkillsIndex(withMemory, { projectRoot: rootDir });
}`;

if (content.includes(oldStack)) {
  content = content.replace(oldStack, newStack);
  console.log('OK: chunk-5JJRUIPA.js — applyMemoryStack updated');
} else {
  console.log('FAIL: chunk-5JJRUIPA.js — applyMemoryStack not matched');
  failCount++;
}

fs.writeFileSync(file, content, 'utf8');
if (failCount > 0) {
  console.log(`DONE: CLAUDE.md import cherry-pick complete (${failCount} FAIL)`);
  process.exit(1);
}
console.log('DONE: CLAUDE.md import cherry-pick complete');
