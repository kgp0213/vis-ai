# Visionox-Whale 通用 AI 智能体平台 — 开发任务拆分

> 项目代号：vis-ai（Visionox-Whale）
> 平台类型：基于 Tauri 2 + Node.js + WebView2 的桌面 AI 智能体平台
> 文档版本：v1.0 | 2026-07-14

---

## 一、团队组成与参与度

| 序号 | 姓名 | 角色 | 参与度 | 定位 |
|------|------|------|--------|------|
| 1 | 胡凤章 | 项目负责人 | 40% | 主架构 + 核心运行时 + 发布 |
| 2 | 孙家龙 | 核心开发 | 20% | AI 模型与会话子系统 |
| 3 | 王晓杰 | 核心开发 | 20% | 记忆 / 计划 / 定时任务子系统 |
| 4 | 刘可 | 前端开发 | 10% | Dashboard 前端 + 基础工具 |
| 5 | 鉏文权 | 集成开发 | 10% | 外部集成 + 文档维护 |

---

## 二、项目模块全景

```
vis-ai/
├── 桌面壳层 (Rust/Tauri)          2,025 行   — 胡凤章
├── Agent 运行时核心                8,167 行   — 胡凤章
│   └── launcher.mjs
├── lib/ 运行时模块                  5,844 行   — 拆分到孙/王/鉏
│   ├── Provider / 模型 / 会话     ────────→  孙家龙
│   ├── 记忆 / 计划 / 定时任务     ────────→  王晓杰
│   └── 外部集成 / 备份 / 配置     ────────→  鉏文权
├── Dashboard 前端                  ~42,000 行 — 刘可 (维护) + 胡凤章 (架构)
│   ├── app.js (主 bundle)
│   ├── app.css (设计系统)
│   └── 支持脚本 (katex/backup/overview)
├── Skills 系统                     20 个      — 刘可 (维护) + 鉏文权 (集成)
├── ECC 规则集                      277 个     — 鉏文权 (维护)
├── DWS 钉钉互通                    便携版     — 鉏文权 (集成)
├── 构建与质量门禁                  18 脚本    — 胡凤章 (主) + 鉏文权 (辅)
├── 测试套件                        40+ 测试   — 各负责人对应模块
├── 文档系统                        15+ 文档   — 鉏文权 (主) + 各负责人
└── API 契约                        1 文件     — 胡凤章
```

---

## 三、任务拆分详情

### 1. 胡凤章（40%）— 主架构与核心运行时

#### 1.1 桌面壳层（Rust/Tauri）
- **负责文件**：`src-tauri/src/lib.rs` (2,025 行)、`src-tauri/src/main.rs`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`
- **任务清单**：
  - [ ] WebView2 窗口创建与生命周期管理
  - [ ] Node.js 子进程 spawn 与崩溃监控（JobObject KILL_ON_JOB_CLOSE）
  - [ ] TCP 健康检查（15×200ms 重试机制）
  - [ ] 系统托盘（最小化 / 退出 / 右键菜单）
  - [ ] 加载页 iframe 恢复与三层刷新恢复机制
  - [ ] 剪贴板 HDROP 文件拖入处理
  - [ ] 日志轮转（10MB）与敏感信息脱敏
  - [ ] `cargo fmt` 与 `unsafe` 块安全审计

#### 1.2 Agent 运行时核心
- **负责文件**：`src-tauri/resources/server/launcher.mjs` (8,167 行)
- **任务清单**：
  - [ ] DeepSeekClient + CacheFirstLoop 主循环
  - [ ] 40+ 工具注册（文件 / Shell / Web / Memory / MCP / Skill / Plan）
  - [ ] Dashboard HTTP Server 启动（127.0.0.1 + token）
  - [ ] MCP 生命周期管理与连接恢复
  - [ ] SSE 流式响应与中断处理
  - [ ] 系统提示词装配与上下文预算控制
  - [ ] 会话归档 / 长会话分页恢复协调

#### 1.3 发布与质量门禁
- **负责文件**：`scripts/quality-check.js`、`scripts/run-tauri-build.js`、`scripts/release-check.js`、`docs/RELEASE_CHECKLIST.md`、`contracts/api-responses.schema.json`
- **任务清单**：
  - [ ] 唯一 release 构建入口维护
  - [ ] 资源树 SHA-256 逐文件校验
  - [ ] NSIS 安装包解包验证
  - [ ] bundle 补丁合规检查
  - [ ] Edge Dashboard 真实渲染冒烟测试
  - [ ] API 响应契约 schema 维护

#### 1.4 visionox-pkg 补丁管理
- **负责目录**：`src-tauri/resources/server/visionox-pkg/`
- **任务清单**：
  - [ ] 上游 bundle 与本地补丁边界管理
  - [ ] Dashboard bundle marker 与 source map 删除策略
  - [ ] 补丁迁移到上游新版本时的协调

#### 1.5 跨模块协调
- [ ] 模块拆分路线图（launcher → lib/ 迁移决策）
- [ ] 代码评审与合并
- [ ] 技术债管理

---

### 2. 孙家龙（20%）— AI 模型与会话子系统

#### 2.1 Provider 与模型管理
- **负责文件**：
  - `lib/provider.mjs`
  - `lib/provider-configuration.mjs`
  - `lib/model-request-policy.mjs`
  - `lib/message-send-policy.mjs`
- **任务清单**：
  - [ ] OpenAI-compatible Provider 配置与导入
  - [ ] 多模型切换与会话绑定
  - [ ] 全模型通信检测与状态提示
  - [ ] 模型请求策略（限速 / 重试 / 降级）
  - [ ] 消息发送策略与队列管理
  - [ ] 模型切换回归测试（`model-switch.test.mjs`）

#### 2.2 上下文与会话管理
- **负责文件**：
  - `lib/context-cap.mjs`
  - `lib/active-session.mjs`
  - `lib/active-session-meta.mjs`
  - `lib/session-knowledge.mjs`
  - `lib/session-trash.mjs`
- **任务清单**：
  - [ ] 上下文容量预算与裁剪
  - [ ] 活动会话解析与 pending fallback
  - [ ] 会话元数据管理
  - [ ] 会话级知识检索（自动召回 / 按需 / 不使用三模式）
  - [ ] 会话批量回收 / 预览 / 恢复 / 自动过期清理
  - [ ] 长会话分页恢复
  - [ ] 对应测试：`active-session*.test.mjs`、`context-cap.test.mjs`

#### 2.3 工作模式与执行权限
- **任务清单**：
  - [ ] 通用 / 编程 / 办公 / 设计 四种工作模式
  - [ ] `auto / yolo / admin` 执行权限切换
  - [ ] 工作模式与系统提示词联动
  - [ ] `edit-mode.test.mjs` 维护

---

### 3. 王晓杰（20%）— 记忆 / 计划 / 定时任务子系统

#### 3.1 记忆系统
- **负责文件**：
  - `lib/system-prompt.mjs`
  - `lib/memory-prompt.mjs`
  - `lib/semantic-retrieval.mjs`
- **任务清单**：
  - [ ] Soul / 长期 / 项目 / 工作场景 / 会话 五级记忆统一管理
  - [ ] 记忆预算与提示词装配
  - [ ] 工作区 `knowledge/` 语义索引
  - [ ] 自动 embedding 更新与召回
  - [ ] 同主题知识合并与 AI 质量评估
  - [ ] 定时会话整理触发整理流程
  - [ ] 对应测试：`memory-correctness.test.mjs`、`memory-prompt.test.mjs`、`memory-trash.test.mjs`

#### 3.2 计划系统
- **负责文件**：
  - `lib/plan-store.mjs`
  - `lib/plan-state-policy.mjs`
  - `lib/plan-continuation.mjs`
- **任务清单**：
  - [ ] 活动计划存储与状态机
  - [ ] 计划延续策略与上下文续接
  - [ ] 计划任务运行时
  - [ ] 对应测试：`plan-*.test.mjs`

#### 3.3 定时任务系统
- **负责文件**：
  - `lib/schedule-store.mjs`
  - `lib/schedule-policy.mjs`
  - `lib/schedule-execution.mjs`
  - `lib/schedule-report-store.mjs`
  - `lib/scheduled-knowledge-store.mjs`
- **任务清单**：
  - [ ] 定时任务 CRUD 与时间策略（RRULE）
  - [ ] 任务执行引擎与重试机制
  - [ ] 执行记录与报告生成
  - [ ] 普通 / Skill 提供的只读 AI 整理模板
  - [ ] 整理结果预览与质量审核归档
  - [ ] 对应测试：`schedule-*.test.mjs`（如有）

#### 3.4 数据安全
- **负责文件**：`lib/dlp-file.mjs`
- **任务清单**：
  - [ ] 敏感文件 DLP 检测
  - [ ] 输出过滤与脱敏
  - [ ] 对应测试：`dlp-file.test.mjs`

---

### 4. 刘可（10%）— Dashboard 前端与基础工具

#### 4.1 Dashboard 前端维护
- **负责文件**：
  - `visionox-pkg/dashboard/dist/app.js` (35,941 行，受补丁管理约束)
  - `visionox-pkg/dashboard/app.css` (6,381 行)
  - `visionox-pkg/dashboard/index.html`
  - `visionox-pkg/dashboard/design-preview.html`
- **任务清单**：
  - [ ] Dashboard UI 组件维护与 Bug 修复
  - [ ] app.css 设计系统优化（已有 6 套配色方案：warm-sand / cool-ash / soft-sage / deep-charcoal / midnight-ink / espresso）
  - [ ] 深浅色主题切换机制
  - [ ] KaTeX 公式渲染支持
  - [ ] Dashboard 回归测试：`dashboard-regression.test.mjs`、`dashboard-ux.test.mjs`、`katex-support.test.mjs`

#### 4.2 加载页
- **负责文件**：`src/index.html`
- **任务清单**：
  - [ ] 加载页 UI 优化
  - [ ] iframe 恢复逻辑
  - [ ] 三层刷新恢复机制

#### 4.3 基础工具模块
- **负责文件**：
  - `lib/atomic-file.mjs`
  - `lib/versioned-json-file.mjs`
  - `lib/transactional-path.mjs`
- **任务清单**：
  - [ ] 原子文件写入（防损坏）
  - [ ] 版本化 JSON 文件（配置迁移基础）
  - [ ] 事务性路径操作
  - [ ] 对应测试：`atomic-file.test.mjs`、`config-io.test.mjs`

#### 4.4 Dashboard 支持脚本
- **负责文件**：
  - `dashboard/backup-support.js`
  - `dashboard/index-mode-support.js`
  - `dashboard/overview-alerts-support.js`
- **任务清单**：
  - [ ] 概览页备份恢复支持脚本
  - [ ] 索引模式切换支持
  - [ ] 概览页告警展示
  - [ ] 对应测试：`backup-support.test.mjs`、`overview-alerts-support.test.mjs`、`index-mode-support.test.mjs`

#### 4.5 部分 Skills 维护
- **负责目录**：`skills/skills/`（按 UI / 文档相关优先）
- **建议分配**：
  - `docx`、`pptx`、`md-to-pdf-cjk`、`minimax-xlsx`、`visionox-excel-pro`、`visionox-file*`、`writing-plans`

---

### 5. 鉏文权（10%）— 外部集成与文档

#### 5.1 OfficeCLI 集成
- **负责文件**：`lib/officecli-policy.mjs`、`docs/OFFICECLI_GUIDE.md`
- **任务清单**：
  - [ ] OfficeCLI 调用策略与权限控制
  - [ ] Word / Excel / PowerPoint MCP 接入
  - [ ] 办公模式自动调用
  - [ ] 对应测试：`officecli-policy.test.mjs`

#### 5.2 DWS / V来家集成
- **负责文件**：`lib/dws-invocation-policy.mjs`、`DWS/`、`docs/V来家操作指南.md`
- **任务清单**：
  - [ ] 钉钉 OAuth 互通
  - [ ] 通讯录 / 消息 / 日程 / 待办 / 审批 / 协作文档读取
  - [ ] 智能确认发送
  - [ ] V来家定时整理与归档到 `knowledge/vhome/`
  - [ ] V来家 Skill 卡片定制与原子安装
  - [ ] 对应测试：`dws-invocation-policy.test.mjs`、`dws-json.test.mjs`

#### 5.3 Skill 系统集成
- **负责文件**：
  - `lib/skill-credentials.mjs`
  - `lib/skill-integration.mjs`
  - `lib/skill-routing.mjs`
  - `lib/bootstrap-skill-cleanup.mjs`
- **任务清单**：
  - [ ] Skill 凭证管理与隔离
  - [ ] Skill 安装 / 路由 / 卸载
  - [ ] Bootstrap skills 清理
  - [ ] ECC 规则集（277 个）维护与同步
  - [ ] 对应测试：`skill-integration.test.mjs`、`ecc-rules.test.mjs`

#### 5.4 备份与配置迁移
- **负责文件**：
  - `lib/user-data-backup.mjs`
  - `lib/config-migrations.mjs`
  - `lib/prompt-queue-store.mjs`
  - `lib/runtime-issues.mjs`
  - `lib/external-url.mjs`
  - `lib/mcp-recovery.mjs`
  - `lib/pause-gate-modal.mjs`
- **任务清单**：
  - [ ] 用户数据完整快照（配置 / 会话 / 任务 / Soul / 记忆 / knowledge）
  - [ ] SHA-256 校验与冲突安全恢复
  - [ ] 配置文件版本迁移（configSchemaVersion）
  - [ ] 提示队列 TTL / 容量 / 幂等 / 事务回滚
  - [ ] 运行时问题汇总与上报
  - [ ] 外部 URL 安全跳转
  - [ ] MCP 连接恢复
  - [ ] auto 模式暂停门控弹窗
  - [ ] 对应测试：`config-migrations.test.mjs`、`prompt-queue-store.test.mjs`、`mcp-recovery.test.mjs`、`pause-gate-modal.test.mjs`、`external-url.test.mjs`、`launcher-storage-policy.test.mjs`

#### 5.5 文档系统维护
- **负责目录**：`docs/`、`README.md`、`AGENTS.md`、`RULES.md`、`UI_DESIGN_SYSTEM.md`、`UI_MIGRATION_PLAN.md`、`skill-creation-guide.md`
- **任务清单**：
  - [ ] 用户指南维护（USER_GUIDE.md）
  - [ ] 架构说明同步（ARCHITECTURE.md）
  - [ ] 开发指南维护（DEVELOPMENT.md）
  - [ ] 质量门禁文档（QUALITY.md）
  - [ ] API Key 维护指南
  - [ ] Provider 配置文档
  - [ ] CHANGELOG 维护

#### 5.6 构建辅助
- **任务清单**：
  - [ ] 构建脚本辅助维护（scripts/check-third-party-resources.js、check-repository-hygiene.js）
  - [ ] 第三方资源清单（THIRD_PARTY_NOTICES.md、third-party-resources.json）
  - [ ] API 契约测试辅助（`api-contracts.test.mjs`、`api.test.mjs`、`build-contract.test.mjs`）

---

## 四、协作矩阵（交叉职责）

| 模块 | 主负责 | 协作 |
|------|--------|------|
| Dashboard app.js 业务逻辑 | 刘可（UI） | 孙家龙（会话） / 王晓杰（记忆/任务） / 鉏文权（集成） |
| launcher.mjs 工具注册 | 胡凤章 | 各工具模块负责人提供 API |
| 系统提示词装配 | 胡凤章 | 王晓杰（记忆预算） / 孙家龙（模型策略） |
| Provider 配置 UI | 刘可 | 孙家龙（后端） |
| 备份恢复 UI | 刘可 | 鉏文权（后端） |
| 定时任务 UI | 刘可 | 王晓杰（后端） |
| MCP 管理 UI | 刘可 | 胡凤章（launcher） / 鉏文权（mcp-recovery） |
| 发布构建 | 胡凤章 | 各负责人提供 release notes |

---

## 五、里程碑建议

| 阶段 | 周期 | 目标 | 主要参与人 |
|------|------|------|-----------|
| M1 | 第 1-2 周 | 任务交接与代码阅读 | 全员 |
| M2 | 第 3-4 周 | 各负责人模块独立修复 + 测试补充 | 全员 |
| M3 | 第 5-6 周 | 跨模块联调（会话 ↔ 记忆 ↔ 模型） | 孙 / 王 / 胡 |
| M4 | 第 7-8 周 | 前端 UI 优化 + 集成验证 | 刘 / 鉏 |
| M5 | 第 9-10 周 | 质量门禁 + 发布验证 | 胡 + 全员 |

---

## 六、责任边界与冲突处理

1. **修改他人模块**：必须先创建 issue / 通知原负责人，避免冲突
2. **跨模块 API 变更**：必须更新 `contracts/api-responses.schema.json` 并同步所有调用方
3. **bundle 补丁修改**：必须先经胡凤章确认，登记到 `scripts/check-bundle-patches.js` 已知补丁列表
4. **新增依赖**：必须经胡凤章批准（项目强制离线构建）
5. **测试缺失**：模块负责人对自己负责的 `lib/*.mjs` 必须维持核心覆盖率（lines ≥ 90%）

---

*文档维护：胡凤章 | 协作更新：全员*
