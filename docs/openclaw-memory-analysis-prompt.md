# 分析任务书：OpenClaw 与 vis-ai（Visionox-Whale）记忆文件管理机制对比及借鉴

> 本文档为「可直接下发的执行规格」。执行者需**基于真实源码**产出报告，不得凭印象或通用知识推断；所有结论必须标注文件路径与关键函数名，并明确区分「已实现 / 未实现」。

## 0. 背景与目标
对比两个 AI 代理项目在「记忆（memory）与记忆文件管理」上的设计哲学与工程实现，并给出对 `C:\Users\Lenovo\Documents\vis-ai\plan` 项目（复杂任务执行框架）的可落地借鉴建议。

## 1. 范围与关键定义（务必先对齐，避免混淆）
「vis-ai 的记忆」实际包含**两套互不相干的机制**，分析时必须分开论述：
- **(A) 代理元记忆（agent meta-memory）**：由宿主运行时（WorkBuddy/CodeBuddy）写入，落地于 `vis-ai/.workbuddy/memory/`（含 `MEMORY.md` 与 `YYYY-MM-DD.md` 每日日志）。其「云端记忆档案 + conversation_search + 用户级 `~/.workbuddy/MEMORY.md` + 工作区 `.workbuddy/memory/`」分层模型属于**宿主运行时**，**不在 vis-ai 仓库源码中实现**。
- **(B) 产品运行时记忆（product runtime memory）**：Visionox-Whale 交付给最终用户的能力，实现在 `src-tauri/resources/server/`（Node 服务）+ `visionox-pkg/dashboard/`（Preact 前端）。包含长期记忆面板、会话知识抽取、语义 RAG、`/learn` 命令等。

OpenClaw 侧仅需分析其单一内置记忆系统（位于 `D:\openclaw`）。

## 2. 输入来源（执行者请从这些路径取证）
**OpenClaw（`D:\openclaw`）：**
- 概念文档：`docs/concepts/memory*.md`、`docs/concepts/dreaming.md`、`docs/concepts/active-memory.md`、`docs/reference/memory-config.md`
- 存储/索引：`packages/memory-host-sdk/src/host/memory-schema*.ts`、`internal.ts`、`embeddings.ts`、`src/memory/root-memory-files.ts`
- 写入/冲刷：`src/hooks/bundled/session-memory/handler.ts`、`src/auto-reply/reply/memory-flush.ts`、`src/auto-reply/reply/agent-runner-memory.ts`
- 巩固/梦境：`extensions/memory-core/src/dreaming-consolidation.ts`、`short-term-promotion-memory-write.ts`、`src/memory-host-sdk/dreaming.ts`
- 检索/排名：`extensions/memory-core/src/memory/hybrid.ts`、`temporal-decay.ts`、`importance.ts`、`extensions/active-memory/{escalation,trigger-recall}.ts`

**vis-ai（`C:\Users\Lenovo\Documents\vis-ai`）：**
- 代理元记忆落地：`vis-ai/.workbuddy/memory/`（只读其结构，实现归宿主运行时）
- 产品记忆前端：`src-tauri/resources/server/visionox-pkg/dashboard/src/panels/memory.ts`
- 产品记忆服务端：`src-tauri/resources/server/lib/memory-prompt.mjs`、`launcher.mjs`（搜索 `/api/memory`）
- 会话知识抽取：`src-tauri/resources/server/lib/session-knowledge.mjs`
- 语义 RAG：`src-tauri/resources/server/lib/semantic-retrieval.mjs`、`lib/knowledge-runtime.mjs`
- 学习/知识 CLI：`src-tauri/resources/server/learn.mjs`、`lib/learn-track.mjs`
- 语义配置默认值：`src-tauri/resources/server/lib/semantic-config-defaults.mjs`

## 3. 需回答的具体问题
### 3.1 OpenClaw 记忆核心机制
1. **存储结构**：记忆文件目录布局（MEMORY.md / USER.md / `memory/YYYY-MM-DD.md` / DREAMS.md / `memory/.dreams/` 等）、Markdown 约定（是否用 frontmatter？注释载体格式？）、每 agent 的 SQLite 索引表结构（chunks / FTS5 / 向量 / 来源 provenance / recall 元数据）。
2. **读写流程**：谁写记忆（agent 直写 / 压缩前 flush / 会话 hook / dreaming 巩固 / 用户模型）；会话开始如何把 MEMORY.md/USER.md 注入上下文（预算、每轮刷新、截断策略）；如何召回（`memory_search` / `memory_get` / `intent`）。
3. **生命周期**：压缩、摘要/巩固（仅 dreaming deep）、轮换、归档/分级、过期/TTL、去重、冲突处理（乐观并发 + 原子 rename + 前镜像备份）、蒸馏旧日志、导入导出。
4. **检索**：hybrid（向量 + BM25 + 路径 FTS）合并公式、provider（openai/gemini/ollama/local GGUF 等）、确定性排序（relevance×recency×importance）、时间衰减、触发注入阈值、失败回退（fail-closed）。
5. **架构模式**：五层分级（Instructions/Curated/Episodic/Prospective/Review）、热/暖/冷对应、双召回通道（Lane1 确定性 + Lane2 升级）、写入即安全边界（provenance）、项目级记忆键。

### 3.2 vis-ai 现有记忆功能（A、B 分别梳理）
- **(A) 代理元记忆**：`.workbuddy/memory/` 的设计、写入/读取方式、可见的生命周期规则；明确「分层模型属宿主运行时、不在本仓库」。
- **(B) 产品运行时记忆**：按子系统说明——长期记忆面板的作用域（global/project/mode/session/soul/trash）、frontmatter 格式、注入预算（pinned/recallable + dedup）；会话知识抽取流水线（session-knowledge 的 map-reduce + 价值打分 + 质量门 + 不可信输入防护）；语义 RAG（semantic-retrieval + knowledge-runtime 的向量检索、重排、版本化缓存、超时降级、凭据哈希）；`/learn` 命令（project/index/ask/track/skill）。
- 归纳设计原则、实现方式、实际应用场景。

### 3.3 四维对比（核心分析）
从以下维度深入对比两者差异，给出**机制级**而非表面差异：
- **架构设计**：分层依据（按生命周期/角色 vs 按作用域）、写入者分离、注入策略、安全边界（provenance/taint vs 不可信输入脱敏）。
- **存储策略**：Markdown+SQLite 索引（OpenClaw 自包含）vs Markdown+外部向量服务（vis-ai 服务依赖）；frontmatter vs HTML 注释载体；索引重建/缓存机制。
- **检索效率**：内置 hybrid + 本地可离线（OpenClaw）vs 依赖外部嵌入端点（vis-ai）；是否含 importance 评分、触发召回、MMR 多样性、确定性合并。
- **上下文维护**：自动巩固/蒸馏流水线（OpenClaw dreaming）vs 预算+去重+质量门（vis-ai）；压缩前 flush、前镜像备份、standing intents 等机制的有无。

### 3.4 对 plan 项目的借鉴建议
结合 `C:\Users\Lenovo\Documents\vis-ai\plan`（复杂任务执行框架；历史设计稿含 TaskContract/WorkPlan/Coverage Ledger/Orchestrator/Supervisor/Outbox，用例含「知识构建」）的具体目标与技术栈（Tauri+Rust、Node 服务、Preact/htm、Qwen3-Embedding），明确指出：
- OpenClaw 哪些机制**值得借鉴**（逐条列出）；
- 每条的**可行性**（高/中/低，依据 vis-ai 现有基础设施判断）；
- 在 plan 框架中的**具体应用方向**（落地到哪个模块/流程）。

## 4. 输出格式
报告按以下章节组织：
1. 执行摘要（≤1 页）
2. OpenClaw 记忆核心机制（对应 3.1）
3. vis-ai 现有记忆功能（A、B 分述，对应 3.2）
4. 四维对比（对应 3.3，建议用表格 + 文字）
5. 对 plan 项目的借鉴建议（对应 3.4，逐条：机制 / 可行性 / 应用方向）
6. 附录：关键源文件索引（相对路径 + 关键函数）

## 5. 成功标准
- [ ] 每个结论都有真实源码引用（路径 + 函数名/行号区间）。
- [ ] 明确区分 OpenClaw 的「已实现」与「文档提及但未在核心树实现」（如 Honcho/LanceDB/QMD 为外部插件）。
- [ ] 清晰分离 vis-ai 的 (A) 与 (B)，不把宿主运行时机制误归为仓库实现。
- [ ] 对比落在机制层面，而非罗列功能。
- [ ] plan 建议具体、可执行，且标注可行性。

## 6. 约束
- 禁止凭印象描述；读不到的代码标注「未实现/未找到」。
- 不修改任何源码；纯分析产出文档。
- 若 plan 目录当前为空，基于其 git 历史设计稿（复杂任务执行框架）分析，并注明该前提。
