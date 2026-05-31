# Visionox × ECC 集成文档

> 创建日期：2026-05-31 · 最后更新：2026-05-31  
> 来源：[ECC](https://github.com/affaan-m/ECC) — harness-native operator system for agentic work  
> 版本：ECC v2.0.0-rc.1

---

## 一、ECC 简介

ECC (Everything Claude Code) 是一个跨 harness 的 AI agent 工作流系统，提供：

| 组件 | 数量 | 说明 |
|------|------|------|
| Skills | 181 个 | 领域专项指导（language-specific patterns、testing、verification 等） |
| Rules | 20+ 套 | 编程规范（coding-style、security、testing、hooks、patterns） |
| Agents | 47 个 | 专业化子代理（code-reviewer、planner、tdd-guide 等） |
| Commands | 79 个 | Slash 命令模板 |
| Hooks | 20+ 个 | Pre/Post tool 钩子（format、typecheck、quality-gate 等） |
| MCP Configs | 多套 | MCP 服务器配置 |

**核心理念**：Skills/Rules 作为静态资源在 AI 会话启动时注入到 system prompt，不参与运行时调用。行为定义在 `skills/` 中，适配层在每个 harness 边缘。

---

## 二、记忆系统架构

### 层级定义

```
每次新对话 (/new) 时，按以下顺序加载到 system prompt：

┌──────────────────────────────────────────────────────────────┐
│  L0  SOUL（灵魂）         ~/.visionox/soul.md               │
│       核心人格、行为准则、沟通风格                              │
│       → 最先注入，优先级最高的身份指令                          │
├──────────────────────────────────────────────────────────────┤
│  L1  PROJECT MEMORY      workspace/{visionox,REASONIX,...}.md │
│       项目专属信息：工具、路径、可用 Skills                      │
│       → findProjectMemoryPath() 按 PROJECT_MEMORY_FILES 查找  │
├──────────────────────────────────────────────────────────────┤
│  L2  MODE PROMPT          config.json modes[mode].prompt      │
│       当前工作模式的行为指令，随模式切换而变化                    │
├──────────────────────────────────────────────────────────────┤
│  L3  MODE ECC RULES       config.json modes[mode].eccRules    │
│       该模式所需的编码规范，从 ~/.claude/rules/ecc/ 读取        │
├──────────────────────────────────────────────────────────────┤
│  L4  CUSTOM RULES         ~/.visionox/rules/*.md             │
│       用户自定义规则（始终加载，不受模式影响）                    │
├──────────────────────────────────────────────────────────────┤
│  L5  SKILLS               ~/.visionox/skills/*/SKILL.md      │
│       可用的技术能力（YAML frontmatter 注入，body 按需读取）      │
├──────────────────────────────────────────────────────────────┤
│  L6  PERSISTENT MEMORY    ~/.visionox/memory/*/MEMORY.md     │
│       持久用户记忆（remember 工具，scope: global / project）     │
├──────────────────────────────────────────────────────────────┤
│  L7  SESSION MEMORY       (内存，不持久化)                     │
│       当前对话临时记忆（remember_session 工具，/new 清除）       │
└──────────────────────────────────────────────────────────────┘
```

### 文件职责分离

| 文件 | 用途 | 位置 |
|------|------|------|
| `soul.md` | AI 身份 + 行为准则（WHO I am） | `~/.visionox/soul.md` |
| `visionox.md` | 项目信息（WHAT this workspace is） | `workspace/visionox.md` |
| ECC rules | 编码规范（HOW to code） | `~/.claude/rules/ecc/{lang}/` |
| Skills | 技术能力（WHAT techniques available） | `~/.visionox/skills/*/` |
| MEMORY.md (global) | 全局持久记忆索引 | `~/.visionox/memory/global/MEMORY.md` |
| MEMORY.md (project) | 项目持久记忆索引 | `~/.visionox/memory/<sha1>/MEMORY.md` |

### 短期记忆 vs 长期记忆

| 类型 | 工具 | 存储 | 生命周期 |
|------|------|------|----------|
| 长期记忆 | `remember` (scope: global / project) | `~/.visionox/memory/` 磁盘文件 | 跨会话持久 |
| 短期记忆 | `remember_session` (scope: session) | launcher 内存 | `/new` 或重启后清除 |

### PROJECT_MEMORY_FILES 搜索顺序

```
1. workspace/REASONIX.md
2. workspace/visionox.md        ← Visionox 品牌化添加
3. workspace/.claude/CLAUDE.md   ← ECC 兼容
4. workspace/CLAUDE.md           ← ECC 兼容
5. workspace/AGENTS.md
6. workspace/AGENT.md
```

由 `cherry-claude.cjs` 补丁写入 `chunk-2K65GZBT.js`。

### MEMORY.md 过滤

Dashboard "配置 → 记忆" 页面的 `listMemoryFiles()` 已过滤 `MEMORY.md` 索引文件，只显示用户创建的记忆。

---

## 三、工作模式系统 (Mode System)

### 设计理念

**单一 AI 身份 (soul.md) + 可切换的专业背景 (mode)**。切换模式相当于换一套"专业知识和规则"，但 AI 的核心人格不变。模式切换写入 config.json，下一次 `/new` 时生效——**不会在对话中途改变提示词**。

### config.json 结构

```json
{
  "mode": "general",
  "modes": {
    "general": {
      "label": "通用",
      "eccRules": ["common", "rust"],
      "prompt": ""
    },
    "coding": {
      "label": "编程",
      "eccRules": ["common", "rust", "typescript", "python"],
      "prompt": "你处于编程模式。遵循严格编码规范，代码优先英文注释，修改前阅读上下文。可用技能: coding-standards, tdd-workflow, rust-patterns, python-patterns, api-design, verification-loop, error-handling。"
    },
    "office": {
      "label": "办公",
      "eccRules": ["common"],
      "prompt": "你处于办公模式。专注于文档处理、数据分析、报告生成。可用技能: docx, xlsx, pdf, pdf-extract, pptx, pptx-generator, visionox-excel-pro, md-to-pdf-cjk。"
    },
    "design": {
      "label": "设计",
      "eccRules": ["common"],
      "prompt": "你处于设计模式。专注于 UI/UX 设计、前端布局、视觉方案。可用技能: frontend-patterns, e2e-testing。如需更多设计技能可通过 install_skill 安装。"
    }
  }
}
```

**默认值**（首次运行自动写入）：`general` 模式，加载 common + rust 规则。

**验证**：所有 prompt 中引用的 skills 名称均经核实在 `~/.visionox/skills/` 中存在。

### 各模式 token 占用

| 模式 | ECC Rules | 规则文件数 | 提示词总量 | 上下文占比 |
|------|-----------|-----------|-----------|-----------|
| **编程** | common + rust + ts + python | 26 个, 45 KB | ~15,300 token | 23% |
| **通用** | common + rust | 15 个, 33 KB | ~9,500 token | 14% |
| **办公** | common only | 10 个, 16 KB | ~5,500 token | 8% |
| **设计** | common only | 10 个, 16 KB | ~5,500 token | 8% |

> 基数: soul.md (555 B) + visionox.md (570 B) + system prompt (~3,000 B) + skills frontmatter (36 个, ~13 KB) ≈ 17,000 B / 4,250 token

### Dashboard UI

主界面右上角，effort 选择器（high/max）左侧，水平排列四个模式按钮：

```
[通用] [编程] [办公] [设计]  [high] [max]  [auto] [flash] [pro]  [review] ...
 ← mode selector (新增) →   ← effort →     ← preset →              ← edit mode →
```

**API 端点变更**：

| 端点 | 新增字段 | 说明 |
|------|----------|------|
| `GET /api/overview` | `workMode`, `modes` | SPA 读取当前模式和可选模式列表 |
| `GET /api/settings` | `mode`, `modes` | Settings 页读取 |
| `POST /api/settings` | `fields.mode` | 用户点击按钮后写入 config.json |

**代码位置**：
- `launcher.mjs:320-326` — `DEFAULT_MODES` 定义
- `launcher.mjs:645-660` — `initModesConfig()`, `getModeConfig()`
- `launcher.mjs:894-899` — `ctx.getModes()`
- `launcher.mjs:945-951` — `ctx.setMode()`
- `server-XGDBRWMB.js:1985-1986` — overview response
- `server-XGDBRWMB.js:2790+` — settings POST handler
- `app.js:23673-23674` — SPA state variables
- `app.js:769488` — SPA mode picker UI insertion

---

## 四、已集成的 ECC Rules

### 规则集定义

```javascript
// launcher.mjs
const ALL_ECC_RULES = {
  common:     "~/.claude/rules/ecc/common/",       // 10 files, 16 KB
  rust:       "~/.claude/rules/ecc/rust/",         //  5 files, 17 KB
  typescript: "~/.claude/rules/ecc/typescript/",   //  5 files,  7 KB
  python:     "~/.claude/rules/ecc/python/",       //  6 files,  5 KB
  custom:     "~/.visionox/rules/",               // user-defined
};
```

### 各规则集详情

#### common（10 个文件，16,190 B / ~4,000 token）

| 文件 | 大小 | 说明 |
|------|------|------|
| `agents.md` | 1,626 B | 子代理使用规范 |
| `code-review.md` | 3,502 B | 代码审查标准 |
| `coding-style.md` | 2,537 B | 通用编码风格 |
| `development-workflow.md` | 2,252 B | 开发工作流 |
| `git-workflow.md` | 622 B | Git 工作流 |
| `hooks.md` | 768 B | Hook 使用规范 |
| `patterns.md` | 1,022 B | 通用设计模式 |
| `performance.md` | 1,599 B | 性能优化 |
| `security.md` | 862 B | 安全规范 |
| `testing.md` | 1,400 B | 测试规范 |

#### rust（5 个文件，16,909 B / ~4,200 token）

| 文件 | 大小 | 说明 |
|------|------|------|
| `coding-style.md` | 4,175 B | Rust 编码风格 |
| `hooks.md` | 406 B | Rust 项目钩子 |
| `patterns.md` | 4,003 B | Rust 设计模式 |
| `security.md` | 4,400 B | Rust 安全规范 |
| `testing.md` | 3,925 B | Rust 测试规范 |

#### typescript（5 个文件，6,805 B / ~1,700 token）

| 文件 | 大小 | 说明 |
|------|------|------|
| `coding-style.md` | 4,291 B | TypeScript 编码风格 |
| `hooks.md` | 561 B | TypeScript 项目钩子 |
| `patterns.md` | 1,030 B | TypeScript 设计模式 |
| `security.md` | 548 B | TypeScript 安全规范 |
| `testing.md` | 375 B | TypeScript 测试规范 |

#### python（6 个文件，4,799 B / ~1,200 token）

| 文件 | 大小 | 说明 |
|------|------|------|
| `coding-style.md` | 711 B | Python 编码风格 |
| `fastapi.md` | 1,736 B | FastAPI 规范 |
| `hooks.md` | 424 B | Python 项目钩子 |
| `patterns.md` | 823 B | Python 设计模式 |
| `security.md` | 524 B | Python 安全规范 |
| `testing.md` | 581 B | Python 测试规范 |

---

## 五、已安装的 ECC Skills

从 `~/.claude/skills/ecc/` 复制到 `~/.visionox/skills/` 的 36 个 skill（含原有 18 个 domain skill）：

**ECC 编码类**（18 个）：coding-standards, rust-patterns, rust-testing, python-patterns, python-testing, cpp-coding-standards, cpp-testing, tdd-workflow, verification-loop, api-design, frontend-patterns, backend-patterns, production-audit, strategic-compact, error-handling, ai-regression-testing, e2e-testing, code-tour

**ECC 工具类**（未复制，保留在 `~/.claude/skills/ecc/` 供 OpenCode 使用）：agent-sort, configure-ecc, skill-scout, skill-stocktake, council, dmux-workflows, hookify-rules, iterative-retrieval, mcp-server-patterns, plankton-code-quality, eval-harness, continuous-learning-v2, motion-ui, make-interfaces-feel-better, frontend-design-direction, frontend-slides, ui-to-vue

**用户 Domain 类**（原有 18 个）：agent-browser, cadence-netlist-compare, docx, github, karpathy-guidelines, md-to-pdf-cjk, minimax-xlsx, pdf, pdf-extract, pdfkit-py, pptx, pptx-generator, self-improvement, self-improving, tavily-search, visionox-excel-pro, weather, xlsx

**Skills 存储格式**：每个 skill 是一个目录，包含 `SKILL.md`（YAML frontmatter + Markdown body）。`applySkillsIndex()` 仅注入 frontmatter（~13 KB / 36 个），body 在 AI 使用 `run_skill` 工具时按需读取。

---

## 六、Hook 系统

### 架构

```javascript
const hooks = {
  preTool:  [],    // 工具执行前
  postTool: [],    // 工具执行后
  onStart:  [],    // 会话启动
  onStop:   [],    // 会话停止
};

registerHook(event, pattern, handler)
// event: "preTool" | "postTool" | "onStart" | "onStop"
// pattern: RegExp | string (匹配工具名)
// handler: (ctx) => void

runHooks(event, ctx)
// ctx: { name: toolName, args: toolArgs, result?: toolResult }
```

### 已注册钩子

| 钩子 | 触发时机 | 功能 |
|------|----------|------|
| `postTool` + `write_file\|edit` | 文件写入后 | 日志记录被编辑的文件路径 |

### Dashboard API

| 方法 | 说明 |
|------|------|
| `ctx.getHooks()` | 返回当前注册的所有 hooks |
| `ctx.registerHook(event, pattern, handler)` | 注册新 hook |

---

## 七、Session Memory（短期记忆）

### 工具: `remember_session`

```javascript
// 参数: { name: string, body: string }
// 返回: { remembered: true, name, chars, hint: "此记忆在当前对话中生效，/new 后清除" }
```

- 存储在 launcher 内存中（`sessionMemories` 数组）
- 上限 50 条
- `/new` 或重启后自动清除
- 注入到 system prompt 的 `# Session memory` 段落

### 代码位置

- `launcher.mjs:662-670` — `sessionMemories`, `addSessionMemory()`, `clearSessionMemories()`, `getSessionMemoryBlock()`
- `launcher.mjs:1126-1136` — `/new` 处理中清除 session memory
- `launcher.mjs:760` — `buildLoop()` 中注入 session memory block

---

## 八、Dashboard 记忆页面修复

### 问题

1. `MEMORY.md` 系统索引文件被当作用户记忆显示
2. 项目文件显示硬编码的 `visionox.md` 而非实际文件名
3. 完整绝对路径暴露用户目录结构

### 修复

| # | 文件 | 变更 |
|---|------|------|
| 1 | `server-XGDBRWMB.js:1451` | `listMemoryFiles()` 过滤 `f !== "MEMORY.md"` |
| 2 | `app.js:25262` | 硬编码 `visionox.md` → `${tree.project.file}` |
| 3 | `app.js:25265` | 完整路径 → 仅文件名 |
| 4 | `app.js:19632,20296` | locale 字符串更新（移除 `visionox.md` 品牌引用） |

---

## 九、文件变更清单

### 修改的文件

| 文件 | 变更摘要 |
|------|----------|
| `launcher.mjs` | 新增 `loadSoul()`, `DEFAULT_MODES`, `initModesConfig()`, `getModeConfig()`, `loadRules()`(重写), `sessionMemories`, `remember_session` tool, `ctx.getModes()`, `ctx.setMode()`, `ctx.getHooks()`, `ctx.registerHook()`；修改 `buildLoop()` 注入 L0-L7 全部层级；`/new` 时重建 loop + 清除 session memory |
| `lib.rs` | `ServerState` 添加 SAFETY 注释（RAII guard）；stderr reader 修复非 UTF-8 处理 |
| `cherry-claude.cjs` | FAIL 计数 + 非零退出码；`newArr` 加入 `"visionox.md"` |
| `server-XGDBRWMB.js` | `listMemoryFiles()` 过滤 MEMORY.md；`/overview` 新增 `workMode` + `modes`；`/settings` POST 新增 mode 处理 |
| `app.js` | 新增 mode selector UI（effort 左侧）；修复项目文件动态名 + 截断路径；新增 `mode`/`modes` state + fetch |
| `chunk-2K65GZBT.js` | PROJECT_MEMORY_FILES 加入 `"visionox.md"` |
| `.gitignore` | 新增 `ECC/` 目录忽略 |

### 新增的文件

| 文件 | 说明 |
|------|------|
| `docs/ECC_INTEGRATION.md` | 本文档 |
| `docs/OPTIMIZATION_PLAN.md` | Karpathy 风格优化建议（8 项） |
| `~/.visionox/soul.md` | AI 身份文件（555 B） |
| `~/.visionox/skills/{18 个 ECC skills}/` | 从 `~/.claude/skills/ecc/` 复制 |

### 未修改

| 文件 | 原因 |
|------|------|
| `~/.visionox/config.json` | 首次启动自动写入 `mode` + `modes` 默认值 |

---

## 十、已知问题与教训

### ESM TDZ 陷阱

**问题**：`launcher.mjs` 中 `const DEFAULT_MODES` 声明的 `const` 在 ESM 中受 Temporal Dead Zone 约束——在声明前引用会抛出 `ReferenceError`。`initModesConfig()` 调用位于 line 321，而 `DEFAULT_MODES` 声明位于 line ~638，导致启动崩溃（"failed to discover dashboard URL"）。

**修复**：将 `DEFAULT_MODES` 移到 `initModesConfig()` 调用之前（line 320），并添加注释 `// ESM TDZ: DEFAULT_MODES must be declared before initModesConfig() call`。

**教训**：ESM 中 `const`/`let` 的 TDZ 不同于 `var` 的 hoisting。修改启动顺序依赖的常量时，必须确保声明在调用之前。触发此类 bug 的唯一线索是启动时静默崩溃，diag 日志无帮助——因为进程在输出 URL 之前就已终止。

### RAII Guard 误删

**问题**：`ServerState.job` 字段看似"从未被显式读取"，实际通过 `Arc::drop` 维持 `JobObject` 生命周期。移除后 `KILL_ON_JOB_CLOSE` 在 `setup()` 返回时立即杀死 Node 子进程。

**教训**：通过 `Drop` trait 副作用工作的字段不能仅凭"无显式读取"判定为死代码。已添加 SAFETY 注释说明。

### 编译 SPA 修改技巧

**问题**：对编译后的单文件 `app.js` 做字符串替换时，多行模板匹配极易因缩进/换行符差异静默失败。

**可靠方法**：使用 `String.IndexOf()` 定位唯一锚点，在锚点后直接拼接插入 HTML 片段。需注意 Windows CRLF (`\r\n`) 换行符。

---

## 十一、验证记录

```
node --check launcher.mjs          ✅ 通过
node --check cherry-claude.cjs      ✅ 通过
cargo check                         ✅ 通过
cargo test                          ✅ 5/5 通过
cargo build --release               ✅ 通过
node launcher.mjs --port 28992      ✅ 启动正常，URL 输出正确
SPA syntax (new Function)           ✅ 通过
server overview workMode + modes    ✅ 字段存在
server settings POST mode handler   ✅ 处理正确
```

---

## 十二、与上游 ECC 的关系

| 方面 | ECC（上游） | Visionox 集成方式 |
|------|------------|------------------|
| Skills | 181 个，全部在仓库中 | 精选 18 个编码类复制到 `~/.visionox/skills/`；18 个 domain 类原有 |
| Rules | 20+ 套语言规则 | 5 套可用（common/rust/ts/python/custom），mode 系统按模式选择 |
| Mode | 无内置模式概念 | 自研 4 模式系统（通用/编程/办公/设计），UI + API + config 完整 |
| Soul | SOUL.md 定义核心身份 | `~/.visionox/soul.md` 同一概念，中文适配 |
| Agents | 47 个专业化子代理 | 未集成（Visionox 无子代理体系） |
| Commands | 79 个 slash 命令 | 未集成 |
| Hooks | 完整的 harness-hook 系统 | 轻量级实现（preTool/postTool）+ `ctx` API |
| Memory | 无 session scope | 新增 `remember_session` 工具（短期记忆） |
| Dashboard | Memory 页显示所有 .md | 已过滤 MEMORY.md 索引文件 |

**设计原则**：不引入运行时依赖，ECC 作为静态知识库在 AI 提示词层面生效。模式系统为自研扩展，非 ECC 原生概念。
