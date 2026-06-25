# ECC 上游未合入功能分析

> 分析日期：2026-06-01 | ECC 版本：v2.0.0-rc.1 | Visionox 版本：1.0.2  
> 上游仓库：[github.com/affaan-m/ECC](https://github.com/affaan-m/ECC)  
> 本地副本：`C:\Users\Lenovo\Documents\vis-ai\ECC\`

---

## 一、总览

| 组件 | ECC 上游 | Visionox 已集成 | 缺口 | 优先级 |
|------|:-------:|:---------------:|:----:|:------:|
| Skills | 249 + 33 + 56 = **338** | ~36 | **302** | 🔴 高 |
| Rules（语言规范） | **39** 文件（8 语言） | 15-20（4-5 套） | **~20** | 🔴 高 |
| GitHub CI/CD | **8** workflows | 0 | **8** | 🔴 高 |
| Agents（子代理） | **63** + 18 + 29 = **110** | 0 | **110** | 🟡 中 |
| Commands | **79** + 35 = **114** | 0 | **114** | 🟡 中 |
| Hooks | **17** + 11 = **28** | 轻量骨架 | **~24** | 🟡 中 |
| Kiro Steering 文档 | **16** | 0 | **16** | 🟡 中 |
| i18n（非中文） | 8 locales | 0 | 8 | 🟢 低 |
| Multi-harness 适配 | 8 harnesses | 0 | 8 | 🟢 低 |
| Enterprise/Evaluator 等 | 5 套 | 0 | 5 | 🟢 低 |

---

## 二、Skills（技能）

### 2.1 已集成（~36 个）

Visionox bootstrap 自带 4 个：
- `basic-skill-example` — 示例模板
- `coding-standards` — 编码规范
- `skill-creation-guide` — 创建指南
- `verification-loop` — 验证循环

运行时通过 launcher.mjs 从 `~/.visionox/skills/` 加载约 36 个（18 coding + 18 domain）。

### 2.2 未集成（~302 个）

上游 ECC 的 `skills/` 目录含 249 个子目录，每个是一个独立 skill。按场景分组如下：

#### 编程语言（完全缺失，~40 个）

```
cpp-coding-standards     cpp-testing           csharp-testing
dart-flutter-patterns    dotnet-patterns       fsharp-testing
golang-patterns          golang-testing        java-coding-standards
jpa-patterns             kotlin-coroutines-flows  kotlin-exposed-patterns
kotlin-ktor-patterns     kotlin-patterns       kotlin-testing
perl-patterns            perl-security         perl-testing
pytorch-patterns         swift-actor-persistence  swift-concurrency-6-2
swift-protocol-di-testing  swiftui-patterns
```

#### 框架/平台（完全缺失，~25 个）

```
android-clean-architecture   angular-developer
compose-multiplatform-patterns  django-celery
django-patterns              django-security
django-tdd                   django-verification
fastapi-patterns             flutter-dart-code-review
laravel-patterns             laravel-plugin-discovery
laravel-security             laravel-tdd
laravel-verification         nestjs-patterns
nextjs-turbopack             nuxt4-patterns
react-patterns               react-performance
react-testing                springboot-patterns
springboot-security          springboot-tdd
springboot-verification      vite-patterns
```

#### 数据库/基础设施（完全缺失，~10 个）

```
database-migrations    deployment-patterns    docker-patterns
mysql-patterns         postgres-patterns      prisma-patterns
redis-patterns         clickhouse-io
```

#### 开发流程/质量（完全缺失，~15 个）

```
error-handling           production-audit        search-first
code-tour                codebase-onboarding     cost-tracking
context-budget           git-workflow            parallel-execution-optimizer
benchmark                benchmark-optimization-loop
rules-distill            token-budget-advisor
prompt-optimizer
```

#### 架构（完全缺失，~8 个）

```
architecture-decision-records   hexagonal-architecture
api-connector-builder           design-system
blueprint                       frontend-design-direction
liquid-glass-design             make-interfaces-feel-better
```

#### 安全（完全缺失，~5 个）

```
security-bounty-hunter   gateguard   safety-guard
llm-trading-agent-security   defi-amm-security
```

#### 已有但可补充（~10 个）

```
ai-regression-testing   api-design（已有）   backend-patterns（已有）
e2e-testing（已有）      frontend-patterns（已有）  python-patterns（已有）
python-testing（已有）   rust-patterns（已有）     rust-testing（已有）
tdd-workflow（已有）     security-review（已有）
```

### 2.3 Agent-oriented Skills（33 个，全部缺失）

位于 `ECC/.agents/skills/`，专为子代理系统设计：
```
agent-introspection-debugging   agent-sort
everything-claude-code          eval-harness
dmux-workflows                  strategic-compact
content-engine                  crosspost
deep-research                   exa-search
fal-ai-media                    video-editing
investor-materials              investor-outreach
market-research                 mle-workflow
product-capability              brand-voice
article-writing                 frontend-slides
mcp-server-patterns             x-api
documentation-lookup            bun-runtime
nextjs-turbopack
```

---

## 三、Rules（规则集）

### 3.1 已集成

Visionox coding mode 加载：
```
coding:   ["common", "rust", "typescript", "python", "custom"]
general:  ["common"]
office:   ["common"]
design:   ["common"]
```

来源：`ECC/.cursor/rules/` + `ECC/.kiro/steering/`

### 3.2 未集成（~35 个规则文件）

ECC `.cursor/rules/` 目录下还有以下语言规则（每语言 5 文件 = coding-style + hooks + patterns + security + testing）：

| 语言 | 文件数 | 状态 |
|------|:------:|:----:|
| cpp | 5 | ❌ 未合入 |
| csharp | 5 | ❌ 未合入 |
| dart | 5 | ❌ 未合入 |
| fsharp | 5 | ❌ 未合入 |
| golang | 5 | ❌ 未合入 |
| java | 5 | ❌ 未合入 |
| kotlin | 5 | ❌ 未合入 |
| perl | 5 | ❌ 未合入 |
| php | 5 | ❌ 未合入 |
| swift | 5 | ❌ 未合入 |
| ruby | 5 | ❌ 未合入 |
| web | 5 | ❌ 未合入 |

Kiro steering 16 个文档全部缺失（开发流程/模式/安全指导）。

**合入方式**：修改 `launcher.mjs` 中 `DEFAULT_MODES.coding.eccRules` 配置即可，无需改代码。

---

## 四、Agents（子代理）

### 4.1 上游定义（63 个主 agent + 50 个变体）

ECC `agents/` 目录包含 63 个 agent 定义（每个是一个 `.md` 文件，含角色 prompt 和行为规范）。核心 agent：

| Agent | 用途 | 适用场景 |
|-------|------|---------|
| `code-reviewer.md` | 代码审查 | 每次修改后 |
| `planner.md` | 实现规划 | 复杂功能 |
| `tdd-guide.md` | 测试驱动开发 | 新功能/Bug修复 |
| `security-reviewer.md` | 安全审查 | 提交前 |
| `architect.md` | 系统设计 | 架构决策 |
| `build-error-resolver.md` | 构建错误修复 | 构建失败 |
| `e2e-runner.md` | E2E 测试 | 关键流程 |
| `doc-updater.md` | 文档更新 | 文档维护 |
| `refactor-cleaner.md` | 死代码清理 | 代码维护 |
| `loop-operator.md` | 循环操作 | 批量任务 |

语言专项 Reviewer：
```
cpp-reviewer  csharp-reviewer  django-reviewer  fastapi-reviewer
flutter-reviewer  fsharp-reviewer  go-reviewer  harmonyos-app-resolver
java-reviewer  kotlin-reviewer  mle-reviewer  python-reviewer
pytorch-reviewer  react-reviewer  rust-reviewer  typescript-reviewer
```

### 4.2 对 Visionox 的价值

Visionox 当前无子代理调度框架。ECC 的 agent prompt 可作为**结构化的审查清单**直接注入 system prompt，无需完整子代理系统。例如：
- 编程模式下，可在 system prompt 中注入 code-reviewer 的检查清单
- 安全敏感操作时注入 security-reviewer 的 prompt

### 4.3 合入障碍

需要实现 subagent 调度框架：
1. Agent 发现与注册（从 `agents/` 目录加载）
2. 隔离执行环境（独立上下文窗口）
3. 结果回传与汇总

---

## 五、Commands（Slash 命令）

### 5.1 上游定义（79 个主命令 + 35 个 OpenCode 命令）

ECC `commands/` 目录的核心命令：

```
开发流程:  /tdd  /plan  /code-review  /e2e  /build-fix  /verify
          /quality-gate  /refactor-clean  /feature-dev
          /cpp-build /cpp-review /cpp-test
          /go-build /go-review /go-test
          /kotlin-build /kotlin-review /kotlin-test
          /rust-build /rust-review /rust-test

项目管理:  /pr  /project-init  /sessions  /save-session  /resume-session
          /checkpoint  /cost-report  /jira

多代理:   /orchestrate  /multi-plan  /multi-execute
          /multi-backend  /multi-frontend  /multi-workflow

知识:     /learn  /learn-eval  /skill-create  /evolve  /ecc-guide
          /update-docs  /update-codemaps

安全:     /security-scan  /hookify  /instinct-export  /instinct-import
```

### 5.2 对 Visionox 的价值

Visionox 使用 Elo Page 的 tool 体系而非 slash command 体系。但命令中的**工作流逻辑**可以适配为 Visionox 的 system prompt 指令。

---

## 六、Hooks（钩子系统）

### 6.1 上游定义

| 来源 | 数量 | 说明 |
|------|:----:|------|
| `.cursor/hooks/` | 16 JS + 1 JSON | 完整的 hook 矩阵 |
| `.kiro/hooks/` | 11 `.kiro.hook` | Kiro 格式 |
| `.opencode/plugins/ecc-hooks.ts` | 1 套 | OpenCode 插件 |

核心 Hook：

| Hook | 触发时机 | 功能 |
|------|---------|------|
| `before-shell-execution` | Shell 执行前 | 拦截危险命令（rm -rf、force push） |
| `after-file-edit` | 文件编辑后 | 自动格式化 |
| `after-shell-execution` | Shell 执行后 | 记录变更文件 |
| `before-submit-prompt` | 提交 Prompt 前 | 注入 ECC 上下文 |
| `session-start` | 会话启动 | 初始化状态 |
| `session-end` | 会话结束 | 质量门检查、摘要生成 |
| `pre-compact` | 上下文压缩前 | 保存关键信息 |
| `stop` | 停止前 | 检查未提交/未推送 |
| `before-mcp-execution` | MCP 调用前 | 健康检查 |
| `after-mcp-execution` | MCP 调用后 | 结果验证 |
| `subagent-start/stop` | 子代理启停 | 上下文隔离 |

### 6.2 Visionox 现状

launcher.mjs 仅实现了 lightweight 的 preTool/postTool 骨架。合入需要扩展 hook runner。

---

## 七、其他组件

### 7.1 GitHub CI/CD（完全缺失）

ECC `.github/workflows/` 含 8 个 workflow：

| Workflow | 用途 |
|----------|------|
| `ci.yml` | 主 CI（lint + typecheck + test + build） |
| `release.yml` | 发布流程 |
| `reusable-release.yml` | 可复用发布模板 |
| `reusable-test.yml` | 可复用测试模板 |
| `reusable-validate.yml` | 可复用验证模板 |
| `maintenance.yml` | 定期维护任务 |
| `monthly-metrics.yml` | 月度指标收集 |
| `supply-chain-watch.yml` | 依赖供应链监控 |

**对 Visionox 的价值**：可直接适配 `reusable-test.yml` 和 `reusable-validate.yml` 作为项目 CI 基础。

### 7.2 i18n（8 个 locale 未合入）

ECC 支持 9 种语言：en, ja-JP, zh-CN, ko-KR, pt-BR, tr, ru, th, vi-VN, de-DE。

Visionox 仅适配了 zh-CN（中文 soul.md）。非中文 locale 对当前用户群无价值。

### 7.3 Multi-harness 适配层（8 个，无价值）

ECC 为 9 个 AI harness 提供适配器：

| Harness | 适配目录 |
|---------|---------|
| Claude Code | `.claude/` |
| Cursor | `.cursor/` |
| Kiro | `.kiro/` |
| OpenCode | `.opencode/` |
| Codex | `.codex/` |
| CodeBuddy | `.codebuddy/` |
| Gemini CLI | `.gemini/` |
| Qwen CLI | `.qwen/` |
| Trae | `.trae/` |
| Zed | `.zed/` |

Visionox 是独立 harness，不需要这些适配层。

### 7.4 其他（5 套，无价值）

| 组件 | 用途 | 对 Visionox 价值 |
|------|------|:---:|
| Enterprise controls | 企业团队治理/审计 | 无（个人工具） |
| Homunculus instincts | 行为本能系统 | 无（架构差异大） |
| Evaluator RAG | AI 质量评估原型 | 低（实验性） |
| Integrations/Aura | 威胁建模集成 | 无 |
| Team config | 团队共享配置 | 无（单用户） |

---

## 八、合入建议与执行计划

### 8.1 合入原则

Visionox 不按 ECC 缺口数量补齐，而按收益、风险和维护成本分级合入：

1. **默认少而稳**：默认注入内容必须短、通用、低冲突，避免提示词膨胀。
2. **按场景加载**：语言 rules、领域 skills、agent 清单优先按工作模式、项目结构或用户动作触发。
3. **安装不覆盖**：bootstrap skills、soul、mode-memory、global/project memory 都只能补齐缺失内容；已有用户内容不覆盖。
4. **先工作流，后框架**：先把 agent/command 的工作流价值转成清单、按钮或 skill，再评估是否做完整 subagent/slash-command 框架。
5. **可验证优先**：每批合入必须有 smoke check 或 CI 兜底。

### 8.2 第一批已合入

| 项目 | 状态 | 说明 |
|------|------|------|
| CI smoke workflow | ✅ 已合入 | `.github/workflows/validate.yml`：校验 Tauri config、launcher/dashboard JS 语法、Rust `cargo check --locked`、`git diff --check` |
| Bootstrap skills 扩展 | ✅ 已合入 | 从 ECC 复制 15 个高频 skills 到 `src-tauri/resources/bootstrap-skills/`，随安装资源打包，由 launcher 首次释放/修复 |
| Skill 环境修复入口 | ✅ 已有 | Dashboard Skills 页提供 repair action，launcher 只替换带 `_visionox_builtin.json` 标记的内置 skill；同名用户 skill 不覆盖 |
| 规则按需策略 | 🟡 计划中 | 暂不把所有语言 rules 塞进 coding mode，优先做项目结构/文件扩展名触发建议 |

第一批合入的 bootstrap skills：

```
api-design
codebase-onboarding
context-budget
database-migrations
docker-patterns
error-handling
fastapi-patterns
frontend-patterns
git-workflow
postgres-patterns
production-audit
react-patterns
search-first
security-review
tdd-workflow
```

### 8.3 下一批建议

### 第 1 批：立即可做（已启动）

| 操作 | 具体内容 | 预计耗时 |
|------|---------|:--------:|
| 扩展 coding mode Rules | 不直接全量加入；改为按项目语言启用/提示 | 0.5-1 天 |
| 复制高频 Skills | 已合入 15 个，后续按用户任务继续补充 | 已完成第一批 |
| 适配 GitHub CI | 已合入最小 validate workflow；后续补 release workflow | 已完成第一批 |

### 第 2 批：需要少量开发（1-3 天）

| 操作 | 具体内容 | 预计耗时 |
|------|---------|:--------:|
| Agent prompt 注入 | 将 top 10 agent 的审查清单注入 coding mode system prompt | 4 小时 |
| 核心 Hook 实现 | 实现 auto-format、dangerous-command-block、console-log-check | 1 天 |
| Subagent 框架 | 实现隔离执行 + 结果汇总（可选，价值中等） | 2-3 天 |

### 第 3 批：后续迭代

| 操作 | 说明 |
|------|------|
| 完整 Skills 目录 | 按需继续复制（用户反馈驱动） |
| 完整 Hooks 矩阵 | 补齐剩余 10+ hook |
| 命令工作流适配 | 将高频 slash command 逻辑转为 system prompt 指令 |

---

## 九、ECC 上游目录速查

```
ECC/
├── skills/                  ← 249 个共享 Skills（主要来源）
├── agents/                  ← 63 个 Agent 定义
├── commands/                ← 79 个 Slash 命令
├── .cursor/rules/           ← 39 个规则文件（8 语言 + common） ← 当前 Rules 来源
├── .cursor/hooks/           ← 16 个 JS Hook
├── .kiro/steering/          ← 16 个开发流程文档
├── .kiro/agents/            ← 18 个子代理（JSON+MD 对）
├── .kiro/skills/            ← 18 个 agent-oriented skills
├── .kiro/hooks/             ← 11 个 Kiro Hook
├── .agents/skills/          ← 33 个 agent-oriented skills
├── .opencode/commands/      ← 35 个 OpenCode 命令
├── .opencode/prompts/agents/← 26 个 agent prompt 模板
├── .opencode/plugins/       ← ECC Hook 插件（OpenCode 适配）
├── .github/workflows/       ← 8 个 CI/CD workflow
├── .claude/enterprise/      ← 企业管控
├── .claude/homunculus/      ← 行为本能
├── agent.yaml               ← 总清单（skills + commands + tags）
├── EVALUATION.md            ← 评估系统说明
├── integrations/aura/       ← Aura 威胁建模集成
├── ja-JP/ zh-CN/ ko-KR/ ... ← 多语言翻译（9 locales）
├── .codex/ .codebuddy/ .gemini/ .qwen/ .trae/ .zed/
│                             ← 其他 harness 适配器
└── .vscode/ .yarnrc.yml ... ← 开发工具配置
```

---

*文档版本：1.1 | 更新日期：2026-06-01 | 基于 ECC v2.0.0-rc.1 本地副本*
