# OpenClaw 与 vis-ai（Visionox-Whale）记忆文件管理机制对比及借鉴分析

> 全部结论基于真实源码取证。OpenClaw 源码位于 `D:\openclaw`；vis-ai 源码位于 `C:\Users\Lenovo\Documents\vis-ai`。
> 取证范围：OpenClaw `docs/concepts/memory*.md`、`packages/memory-host-sdk/`、`extensions/memory-core/`、`extensions/active-memory/`、`src/memory/`、`src/auto-reply/reply/`；vis-ai `src-tauri/resources/server/lib/{memory-prompt,session-knowledge,semantic-retrieval,knowledge-runtime}.mjs`、`learn.mjs`、`visionox-pkg/dashboard/src/panels/memory.ts`、`.workbuddy/memory/`。

---

## 1. 执行摘要

- **OpenClaw** 的记忆系统是**单一内聚、自包含**的设计：以 workspace 内人类可读 Markdown（`MEMORY.md`/`USER.md`/`memory/YYYY-MM-DD.md`/`DREAMS.md`）为真相源，配**每 agent 一个本地 SQLite 索引**（分块 + FTS5 + 向量 + provenance + recall 元数据）；写入由「 dreaming 巩固」单一主写入者以原子重命名提交；检索为**向量+BM25+路径 FTS 的 hybrid**，确定性排序（relevance×recency×importance），双召回通道；架构上按**生命周期/角色分五层**，且**写入即安全边界**（来源 provenance 落入 SQLite 列，文本无法伪造来源）。
- **vis-ai** 的记忆实际是**两套互不相干的系统**：
  - **(A) 代理元记忆** `.workbuddy/memory/`（`MEMORY.md` + 每日日志）——由**宿主运行时**写入，仓库**不实现**其分层模型。
  - **(B) 产品运行时记忆**——功能完备且真实存在：长期记忆面板（global/project/mode/session/soul/trash，frontmatter Markdown）、会话知识抽取（`session-knowledge.mjs` map-reduce + 价值门）、语义 RAG（`semantic-retrieval` + `knowledge-runtime`，依赖外部 Qwen3-Embedding）、`/learn` 命令。其架构按**作用域分层**，强项在**不可信输入防护**（脱敏 + untrusted 包裹）与**预算/去重注入**。
- **核心差异**：OpenClaw 胜在「自包含索引 + 自动巩固流水线 + provenance 安全边界 + 内置 hybrid 检索」；vis-ai 胜在「作用域清晰 + 不可信输入治理 + 外部向量服务的解耦」但**缺自动 episodic→curated 蒸馏**与**本地可离线索引**。
- **plan 项目**（复杂任务执行框架）当前磁盘为空，历史设计稿（`complex-task-execution-framework.md`）用例含「知识构建」。其最值得借鉴 OpenClaw 的①自动巩固（dreaming 式蒸馏）②写入即 provenance 边界 ③压缩前 flush ④prospective/standing-intents ④本地可离线嵌入——均可在 vis-ai 现有基础设施上**高可行性**落地。

---

## 2. OpenClaw 记忆核心机制

### 2.1 存储结构
| 文件 / 目录 | 作用 | 注入上下文 |
|---|---|---|
| `MEMORY.md` | 策展型长期记忆（curated core），会话开始预算内注入 | 是 |
| `USER.md` | 用户模型层（祈使句偏好） | 是 |
| `memory/YYYY-MM-DD.md` | 每日笔记 / 工作层 | 否，仅可搜索 |
| `DREAMS.md` | 梦境日记 / 巩固摘要（人工审阅） | 否 |
| `memory/.dreams/` | 短期回忆、阶段信号、摄取锁 | 否（机器态） |
| `memory/imports/{codex,claude-code,hermes}/` | 从他者导入的记忆（隔离，不并入 `MEMORY.md`） | 仅可搜索 |
| `AGENTS.md` 等 | Instructions 层（人类编写） | 是 |

- **Markdown 约定**：**无 YAML frontmatter**；检索元数据用内联 HTML 注释载体：
  ```md
  - Keep the gateway on loopback. <!-- trigger: gateway setup, network safety --> <!-- importance: 9 -->
  - Use the release helper. <!-- project: github.com/openclaw/openclaw -->
  ```
  `importance` 为 1–10；`trigger` 逗号/分号分隔；`project` 来自规范化 git `origin`。**来源 provenance 不写在 Markdown，而落 SQLite 列**——文本无法伪造来源分类。
- **SQLite 索引**（每 agent：`~/.openclaw/agents/<id>/openclaw-agent.sqlite`），建表于 `packages/memory-host-sdk/src/host/memory-schema*.ts`：
  - `memory_index_sources`（path,source,hash,mtime,size）
  - `memory_index_chunks`（start_line,end_line,hash,model,text,embedding）
  - `memory_index_chunks_fts`（FTS5 正文，`unicode61` 或 `trigram` 支持 CJK）
  - `memory_index_paths_fts`（FTS5 路径）
  - `memory_index_chunk_provenance`（`origin_class` owner/agent/untrusted/system、`session_kind`、`observed_at`、`supersedes_key`）
  - `memory_index_chunk_recall_metadata`（`importance`、`triggers`、`project_key`）
  - `memory_index_chunks_vec`（sqlite-vec 向量，缺失回退进程内 cosine）
  - `memory_embedding_cache`（块级 embedding 缓存）
  - 分块：`MEMORY_CHUNKING_VERSION=2`，默认 400 token / 80 token 重叠。

### 2.2 读写流程
- **写入者（四类 + 单一主写入者）**：
  1. Agent 直写当日 `memory/YYYY-MM-DD.md`（`src/agents/agent-tools.read.ts` 带 workspace 防护）。
  2. 压缩前**静默 flush**（`memory-flush.ts` 的 `shouldRunMemoryFlush()`，基于 token 阈值 + 每 compaction 仅一次）→ `agent-runner-memory.ts` 执行，把未存上下文落盘。
  3. 会话 hook（`session-memory/handler.ts`）在 `/new`、`/reset` 写 `memory/YYYY-MM-DD-<slug>.md`。
  4. **dreaming 巩固为唯一主写入者**：`dreaming-consolidation.ts` 调子代理重写 `MEMORY.md` → `short-term-promotion-memory-write.ts` 的 `writeMemoryContent()` **原子重命名提交**。`USER.md` 偏好「就地取代」不追加矛盾。
- **加载到上下文**：`MEMORY.md`/`USER.md` 会话开始预算注入、**每轮刷新**（`root-memory-files.ts` 解析真实文件）；超预算时**磁盘完整、注入副本被截断**（`/context list` 可见原始 vs 注入大小）。每日笔记**绝不**自动注入，仅可搜索。
- **召回**：`memory_search`（hybrid）、`memory_get`（读文件/行）、`intent`（前瞻意图）；`hybrid.ts` 的 `mergeHybridResults()` 合并，`active-memory/trigger-recall.ts` 触发注入。

### 2.3 生命周期管理
- **压缩 / 冲刷**：压缩前 memory flush（§2.2-2）。
- **摘要 / 巩固**：仅 dreaming deep 阶段。
- **轮换**：每日一个 `YYYY-MM-DD.md`，同日多次加 `-<n>`/`-<slug>`（`resolveAvailableMemoryFilename`）。
- **归档 / 分级**：`DREAMS.md` 保存人类可读巩固史；导入记忆隔离 `memory/imports/`；**前镜像备份** `storeMemoryPreimage()` 保留最近 8 份（`CONSOLIDATION_BACKUP_LIMIT=8`）可恢复。
- **过期 / TTL**：记忆文件本身**无 TTL**（curated evergreen，每日笔记仅排名衰减）。仅 standing-intents 有生命周期（冷却 24h、预算 3 次、90 天过期）。来源层用 `supersedes_key`「取代」旧事实不累积。
- **去重**：light 阶段 `DEFAULT_MEMORY_LIGHT_DREAMING_DEDUPE_SIMILARITY=0.9`；consolidation 合并重复项。
- **冲突处理**（乐观并发）：
  ```ts
  const trackedRename = async (source, destination) => {
    if (params.expectedHash &&
        hashMemoryContent(await readMemoryContent(params.memoryWritePath)) !== params.expectedHash)
      throw new MemoryWriteConflictError();   // 写入前重检 SHA-256
    await fs.rename(source, destination);      // 原子重命名
  };
  ```
  配合可恢复前镜像；consolidation 校验/预算失败则回退 append-only 升级。
- **蒸馏旧日志**：`openclaw memory rem-backfill` / `session-backfill`（支持 `--rollback`）。
- **导入 / 导出 / 备份**：`memory status|search|index --force|promote`；UI `memory-import` 从 Codex/Claude Code/Hermes 导入（仅复制 Markdown，源不动）。

### 2.4 记忆搜索 / 检索
- **hybrid 合并**（`hybrid.ts`）：向量（余弦）+ BM25（FTS5，`buildFtsQuery`）+ 路径 FTS（精确>基名>词干>部分）；`contentScore = vectorWeight*vector + textWeight*keyword`。
- **Provider**：默认 `builtin`（SQLite 同时支持 FTS5+向量）；embedding provider：`openai`(默认 text-embedding-3-small)/`gemini`/`voyage`/`mistral`/`bedrock`/`deepinfra`(BAAI/bge-m3)/`ollama`/`lmstudio`/`local`(GGUF)/`github-copilot`/`openai-compatible`。
- **确定性排序**：importance（写入时一次性 1–10 打分）× recency（每日笔记固定 30 天半衰期，curated evergreen）× relevance；MMR 多样性；触发注入阈值 **0.72**，每轮最多 3 条，仅 curated 层。
- **失败回退**：`provider:"none"/auto` → 纯关键词；显式命名 provider 不可用 → **返回「不可用」而非静默降级**（fail-closed）；sqlite-vec 缺失 → 进程内 cosine。

### 2.5 架构模式
- **五层分级**：
  | 层 | 表面 | 写入者 | 注入 |
  |---|---|---|---|
  | Instructions | AGENTS.md 等 | 仅人类 | 总是 |
  | Curated core | MEMORY.md, USER.md | dreaming / 用户 | 总是（预算内） |
  | Episodic | memory/*.md | agent/flush/转录 | 仅按需搜索 |
  | Prospective | Standing intents / cron | intent 工具 | 仅触发时 |
  | Review | DREAMS.md | dreaming | 否（人工） |
- **无隐藏状态**：模型只「记得」写进 workspace 文件的内容。
- **写入即安全边界**：provenance 写入时强制分类（SQLite 列），untrusted/system 结构性排除出 curated core 与自动注入（taint gating，不靠内容检测）。
- **双召回通道**：Lane1 确定性（bootstrap+混合排序+触发）；Lane2 升级（`shouldEscalateRecall`：Lane1 无强命中且消息有回忆意图时调子代理）。
- **确定性门 + 模型判断在内**：评分/阈值/资格/生命周期是确定性代码；LLM 仅用于合并/摘要。
- **项目级记忆键**：git `origin` 规范化成项目键，每会话最多 4 活跃仓库键（MRU），影响排名但不分区文件。

---

## 3. vis-ai 现有记忆功能

> ⚠️ 必须先区分 (A) 代理元记忆 与 (B) 产品运行时记忆——二者落地位置、使用者、实现方完全不同。

### 3.1 (A) 代理元记忆 `vis-ai/.workbuddy/memory/`
- **实际文件**：`MEMORY.md`（策展型跨会话事实，如网络约束「github.com 直连被 reset、仅 gitclone.com 可用」标注「跨会话有效」）+ 每日日志 `2026-07-26.md`~`2026-07-30.md`（追加型工作笔记）。**仅这两类，无子目录、无索引文件、无自动压缩脚本**。
- **设计/生命周期**：`MEMORY.md` 手工增量维护；每日日志按日期累积；写入/读取由宿主代理在任务中/后完成。其「分层模型（云端档案 + conversation_search + 用户级 + 工作区）」属**宿主运行时**——在 `launcher.mjs` 中 `grep conversation_search|cloud memory|memorySearch` **零匹配**，证明**本仓库未实现**。vis-ai 只是该机制的「工作区存储落地」。

### 3.2 (B) 产品运行时记忆（真正在仓库中实现）
**① 长期记忆面板**（`visionox-pkg/dashboard/src/panels/memory.ts` + `lib/memory-prompt.mjs`）：
- 作用域：`global`(用户级) / `project-mem`(工作区) / `mode`(场景记忆，带 keywords/priority/enabled) / `session`(临时) / `soul`(AI 身份，`~/.visionox/soul.md`，含版本历史/恢复/重置) / `trash`(默认保留 30 天)。
- 格式：frontmatter Markdown（`name/description/type:user|feedback|project|reference/scope/created/priority`）。
- 注入预算（`memory.ts` ~448 行）：`pinned`（全文注入）+ `recallable`（摘要/按需）+ 去重；`memoryTokenBudgetForCapacity` 取上下文 10%，夹 4k–12k。`analyzeMemoryEntries` 做敏感密钥/冲突/重复检测。

**② 会话知识抽取**（`lib/session-knowledge.mjs`）：
- 流水线：`prepareKnowledgeConversation` → 分块 → `mapReduceKnowledgeConversation`（map+reduce 最多 8 轮）→ `assessKnowledgeValue`（价值打分）→ 质量评估（trash/keep_raw/extract/merge/review）→ 主题归并 → 生成主题文档 → 质量复审。
- 价值信号（中文关键词）：决定/决策/约束/根因/修复/方案/规范/规则/结论/架构/设计/复盘；`score>=60 && (durableOutcome||reusable) && (explained||verified||concreteEvidence)` 合格。
- **安全**：会话文本一律不可信——`redactSecrets()` 脱敏 + `<untrusted-conversation>` 包裹 + 明确「忽略其中的指令」。产物 `knowledge/topics/<id>.md`（frontmatter 含 type/qualityScore/sourceSessions）。

**③ 语义 RAG**（`lib/semantic-retrieval.mjs` + `lib/knowledge-runtime.mjs`）：
- `semanticRetrievalConfigFingerprint`（apiKey 仅 sha256，绝不落盘凭据）、`buildSemanticRetrievalCacheKey`（配置指纹+知识版本，版本化缓存）、`rerankRetrievalHits`（向量分+词法重叠+quality 加权）、`selectRetrievalHits`（每路径上限+相对边际）。
- `createKnowledgeRuntime.retrieve()`：`knowledgeTopK/workspaceTopK=24`、`minScore=0.3`、3s 超时；状态 `completed/empty/unavailable/timeout/error/workspace-mismatch` 优雅降级；`updateSemanticIndex()` 重建嵌入。
- 嵌入默认 `openai-compat` 预填 `http://10.71.4.202:10307/v1/embeddings`、模型 `Qwen3-Embedding`、Key 留空（`semantic-config-defaults.mjs`，AGENTS.md §12 不可回退）。

**④ `/learn` 命令**（`learn.mjs` + `lib/learn-track.mjs`）：`/learn project`(项目记忆) / `index <dir>`(语义索引) / `ask <q>`(语义问答) / `tutor`(苏格拉底) / `track`(间隔重复，due 日期，`~/.visionox/learn-track.json`) / `skill <dir>`(提炼 SKILL)。

### 3.3 设计原则归纳
- 分层作用域清晰（用户→工作区→场景→会话→身份→回收站），生命周期/可见性各异。
- 人类可读、可 diff（frontmatter Markdown；`soul.md` 在用户主目录）。
- 带预算注入（token 预算 + 去重 + pinned/recallable 分离）。
- LLM 驱动抽取 + 质量门；**把对话当不可信输入**（脱敏 + untrusted 包裹 + 忽略内部指令），防提示注入。
- 语义 RAG：向量 + 词法/质量重排 + 版本化缓存 + 超时降级；凭据只哈希不落盘。

---

## 4. 四维对比（机制级）

### 4.1 架构设计
| 维度 | OpenClaw | vis-ai (B) |
|---|---|---|
| 分层依据 | **按生命周期/角色**五层（Instructions/Curated/Episodic/Prospective/Review），每层有专属写入者与注入策略 | **按作用域**六类（global/project/mode/session/soul/trash）+ 知识库 |
| 写入者分离 | Curated core 仅 dreaming 单一主写入者；episodic 由 agent/flush；prospective 由 intent | memory 可由用户 + 系统（session-knowledge 抽取）写入；soul 有版本历史 |
| 注入策略 | bootstrap 预算注入 + 每轮刷新 + 超预算截断副本；仅 curated 常驻 | pinned/recallable 分离 + 预算(4k–12k) + 去重；项目规则 full/truncated/omitted |
| 安全边界 | **provenance 落 SQLite 列**（taint gating，文本无法伪造来源），untrusted 结构性排除 | **不可信输入治理**（脱敏 + untrusted 包裹 + 忽略内部指令）作用于会话抽取 |
| 双通道 | Lane1 确定性 + Lane2 升级子代理 | 无显式双通道；RAG 直接检索 |

**差异本质**：OpenClaw 以「生命周期阶段」划分并配专属写入者/注入策略，强在**自动蒸馏与来源可信**；vis-ai 以「作用域/可见性」划分，强在**多租户式隔离与人类可读作用域**，但对「对话→长期记忆」的自动蒸馏弱于 OpenClaw。

### 4.2 存储策略
| 维度 | OpenClaw | vis-ai (B) |
|---|---|---|
| 真相源 | workspace 内 Markdown | frontmatter Markdown（记忆/知识主题）+ JSON（learn-track） |
| 索引 | **每 agent 本地 SQLite**（chunks+FTS5+向量+provenance），自包含、可离线 | **无本地索引**；向量依赖外部 Qwen3-Embedding 服务；RAG 命中后重排 |
| 元数据载体 | HTML 注释 + SQLite 列（无 frontmatter） | frontmatter YAML |
| 索引维护 | 文件变更 debounced 1.5s 重建；embedding 配置变更需 `--force`；WAL 检查点 | 外部嵌入服务维护向量；版本化缓存键 |
| 凭据 | 不落盘（provider 凭证走运行时） | apiKey 仅 sha256 指纹，不落盘 |

**差异本质**：OpenClaw 把「检索索引」与「真相源」一起**自包含本地化**（SQLite），可离线、可控；vis-ai 把向量索引**外包给外部服务**，解耦但引入网络依赖与单点。

### 4.3 检索效率
| 维度 | OpenClaw | vis-ai (B) |
|---|---|---|
| 检索方式 | 内置 **hybrid**（向量+BM25+路径 FTS） | 外部向量检索 + 词法/quality 重排（`rerankRetrievalHits`） |
| 离线能力 | **可离线**（local GGUF 嵌入 + FTS5） | 依赖外部端点（ollama 可替代但非默认） |
| 排序信号 | relevance × recency(半衰期) × **importance(1–10)** | 向量分 + 词法重叠 + **qualityScore** 加权 |
| 触发召回 | **trigger-recall 阈值 0.72**，每轮≤3 条 curated | 无触发召回；RAG 按需 |
| 多样性 | MMR 去近重复 | 每路径上限 + 相对边际 |
| 失败处理 | 显式 provider 不可用 → **fail-closed 报不可用** | 多状态优雅降级（unavailable/timeout/error） |

**差异本质**：OpenClaw 检索**内建、确定性、可离线**，且带 importance 与触发召回实现「主动记忆」；vis-ai 检索**依赖外部服务**，以 quality 加权与优雅降级见长，但缺 importance 评分与 proactive recall。

### 4.4 上下文维护
| 维度 | OpenClaw | vis-ai (B) |
|---|---|---|
| 自动巩固 | **dreaming 流水线**：episodic→curated 蒸馏，前镜像备份+冲突处理 | **无自动 episodic→curated 蒸馏**；知识主题从会话抽取但不并回 `MEMORY.md` |
| 压缩前 flush | 有（memory flush 静默轮） | 无显式对应；会话记忆为临时 |
| 冲突/备份 | 乐观并发(hash 重检)+原子 rename+前镜像(8 份) | soul 版本历史/恢复；trash 30 天 |
| 前瞻记忆 | **standing intents**（冷却/预算/过期） | cron/定时任务（产品层），非记忆层 |
| 预算/去重 | bootstrap 预算 + 截断可见 | token 预算 + pinned/recallable + dedup |

**差异本质**：OpenClaw 有**端到端自动生命周期**（写入→flush→dreaming 蒸馏→备份→冲突处理）；vis-ai 在「预算/去重/不可信防护」上成熟，但**缺把散落 episode 自动沉淀为 curated core 的流水线**——这正是 plan 框架最需补的能力。

---

## 5. 对 plan 项目（复杂任务执行框架）的借鉴建议

**前提**：`plan/` 当前磁盘为空；历史设计稿为「复杂任务执行框架」（`complex-task-execution-framework.md`），含 TaskContract / WorkPlan / Coverage Ledger / Orchestrator / Supervisor / Outbox / 副作用治理，用例含「知识构建」。技术栈为 Tauri+Rust、Node 服务、Preact/htm、Qwen3-Embedding。以下建议基于该框架目标，并考量 vis-ai 现有基础设施的**可行性**。

| # | 借鉴机制（来自 OpenClaw） | 可行性 | 在 plan 框架的具体应用方向 |
|---|---|---|---|
| 1 | **自动巩固 / dreaming 式蒸馏**（episodic→curated，前镜像备份+原子 rename） | **高** | 将 plan 的「每任务 episode 日志」经 `session-knowledge` 式 map-reduce 蒸馏为 curated 核心，供 Orchestrator 跨步/跨会话恢复上下文；复用 `short-term-promotion-memory-write.ts` 的乐观并发+前镜像模式保护 Coverage Ledger 状态不被并发写坏。 |
| 2 | **写入即 provenance 边界**（来源分类落结构化列，taint gating） | **高** | plan 的 Outbox/副作用治理需审计：给每条任务生成记忆打 `origin_class`(agent/user/system/tool)，确保工具/子代理输出不污染 curated 核心，呼应 AGENTS.md §8 的副作用授权边界。 |
| 3 | **压缩前 memory flush**（静默轮落盘关键上下文） | **高** | 在 Supervisor 做任务压缩/摘要前，先 flush 未落盘的契约状态/覆盖账本，避免长任务 summarization 丢失关键事实（对应 memory-flush 的 token 阈值门控）。 |
| 4 | **prospective / standing-intents**（前瞻记忆，冷却/预算/过期） | **高** | plan 已有调度语义；映射为「前瞻性记忆层」：把待办/周期检查建模为带冷却(24h)、预算(3)、过期(90d)的 intent，由 Supervisor 在合适时机触发，而非无脑轮询。 |
| 5 | **hybrid 检索 + importance 评分 + 触发召回** | **中** | 给 plan 知识构建用例（RAG）补 **importance(1–10)** 字段与 trigger-recall(0.72) 阈值，使 Orchestrator 在任务执行中**主动召回**相关历史决策，而非纯被动检索；复用 `knowledge-runtime` 的版本化缓存与重排。 |
| 6 | **本地可离线嵌入（GGUF）** | **中** | 对内网/离线部署，除默认 Qwen3-Embedding 外支持 local GGUF provider（`embeddings.ts` 的 `createLocalEmbeddingProvider`），降低对 `10.71.4.202` 端点的硬依赖，契合 AGENTS.md §6 的离线优先。 |
| 7 | **确定性门 + LLM 仅用于合并/摘要** | **高** | 沿用 OpenClaw 模式：把评分/阈值/资格/生命周期放确定性代码，LLM 只在边界内做合并与摘要，保证 plan 框架可预测、可测试（呼应 AGENTS.md §1 的单一模型内核原则）。 |
| 8 | **时间衰减 + 项目级记忆键** | **中** | 给 plan 的任务记忆加 30 天半衰期衰减 + 项目键（git origin 规范化），让长期任务的旧 episode 自然降权，避免上下文被陈旧覆盖账本淹没。 |

**优先级建议**：①→④（高可行、直接补 plan 最缺的「自动蒸馏 + 来源可信 + 压缩前 flush + 前瞻记忆」）应作为 plan 框架记忆子系统的**第一梯队**；⑤⑥⑧ 为增强项；⑦ 是贯穿性的工程纪律。

**落地路径（复用 vis-ai 已有资产，避免重复造轮子）**：
- 复用 `lib/session-knowledge.mjs` 的 map-reduce + 价值门作为 #1 的蒸馏内核；
- 复用 `lib/knowledge-runtime.mjs` 的 retrieve/缓存/降级作为 #5 检索底座；
- 复用 `lib/memory-prompt.mjs` 的预算/去重作为 #4 注入控制；
- 新增「provenance 列 + 乐观并发写」是 #2/#1 唯一需新建的薄层（参考 OpenClaw `memory-schema-provenance.ts` 与 `short-term-promotion-memory-write.ts`）。

---

## 6. 附录：关键源文件索引

**OpenClaw（`D:\openclaw`）**
- 存储/索引：`packages/memory-host-sdk/src/host/memory-schema*.ts`、`internal.ts`、`embeddings.ts`
- 文件解析：`src/memory/root-memory-files.ts`
- 写入/冲刷：`src/hooks/bundled/session-memory/handler.ts`、`src/auto-reply/reply/memory-flush.ts`、`src/auto-reply/reply/agent-runner-memory.ts`
- 巩固：`extensions/memory-core/src/dreaming-consolidation.ts`、`short-term-promotion-memory-write.ts`、`src/memory-host-sdk/dreaming.ts`
- 检索：`extensions/memory-core/src/memory/hybrid.ts`、`temporal-decay.ts`、`importance.ts`、`extensions/active-memory/{escalation,trigger-recall}.ts`
- 文档：`docs/concepts/memory*.md`、`docs/concepts/dreaming.md`、`docs/reference/memory-config.md`

**vis-ai（`C:\Users\Lenovo\Documents\vis-ai`）**
- 代理元记忆：`vis-ai/.workbuddy/memory/`（实现归宿主运行时）
- 产品记忆前端：`src-tauri/resources/server/visionox-pkg/dashboard/src/panels/memory.ts`
- 记忆服务端：`src-tauri/resources/server/lib/memory-prompt.mjs`、`launcher.mjs`（`/api/memory`）
- 会话知识：`src-tauri/resources/server/lib/session-knowledge.mjs`
- 语义 RAG：`src-tauri/resources/server/lib/semantic-retrieval.mjs`、`lib/knowledge-runtime.mjs`
- 学习 CLI：`src-tauri/resources/server/learn.mjs`、`lib/learn-track.mjs`
- 语义配置：`src-tauri/resources/server/lib/semantic-config-defaults.mjs`

**明确「未实现 / 文档提及但不在核心树」**
- OpenClaw：Honcho / LanceDB / memory-wiki / QMD 为**外部插件**（`extensions/` 仅含 memory-core 与 active-memory）；`MEMORY.md` 无多 writer 全局锁（靠乐观并发）；记忆文件无自动 TTL。
- vis-ai：(A) 代理元记忆的分层模型**不在仓库**；(B) 无自动 episodic→curated 蒸馏流水线；产品无 local GGUF 嵌入（仅 ollama 可选）。
