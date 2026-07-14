# Launcher 模块化实施计划

> 计划基线：`be5a9e4f`（v1.28.0 发布候选）
> 计划对象：`src-tauri/resources/server/launcher.mjs`
> 当前状态：仅制定实施方案，本轮不移动 Launcher 业务代码。

## 1. 目标与边界

目标不是把 Launcher 压缩到任意行数，而是降低修改一个功能时影响启动、会话、任务和工具系统的概率。规划时 Launcher 为 8,228 行，这个数字只用于识别当前风险，不作为完成指标。

完成后 Launcher 仍是唯一装配入口，负责：

- 解析启动参数和运行时路径。
- 加载配置及 vendored runtime。
- 创建模型循环、工具注册表和各领域服务。
- 组装 Dashboard context。
- 启动 HTTP/SSE 服务并处理退出信号。

本计划明确不做：

- 不改变 Dashboard HTTP API、SSE 事件名或 Rust 解析的 stdout 启动 JSON。
- 不改变 `config.json`、活动会话、会话元数据、计划、定时任务、报告或知识库文件格式。
- 不同时重构 Dashboard bundle、模型循环或 Provider 逻辑。
- 不引入依赖、服务容器、事件总线或为了复用而创建的通用抽象。
- 不在中间阶段构建安装包，也不顺手修复与当前迁移无关的问题。

## 2. 当前风险边界

| 边界 | 当前位置（规划基线） | 主要耦合 | 风险 |
|---|---:|---|---|
| MCP 生命周期 | 约 2292-2459 | 配置、工具注册表、loop、工作区、DLP、超时恢复 | 高 |
| 定时任务运行时 | 约 3851-5796 | 文件持久化、计时器、FIFO、报告、知识整理、模型循环、V来家状态 | 极高 |
| 活动会话生命周期 | 约 5962-6295 | JSONL 流、meta、loop、计划、记忆、文档注册表、Dashboard 事件 | 高 |
| 会话报告引擎 | 约 6297-6650 | 会话扫描、缓存、配置迁移、模型调用 | 中 |
| Dashboard context | 约 6821-8160 | 几乎所有顶级可变状态 | 极高 |

现有 `lib/` 已包含活动会话解析、定时任务策略/存储、会话知识、报告存储和 MCP 恢复等纯逻辑。本计划只迁移仍留在 Launcher 的所有权和编排，不重复实现这些模块。

## 3. 模块设计约束

每个新模块必须满足以下条件：

1. 通过一个明确的工厂函数接收依赖，不得反向导入 `launcher.mjs`。
2. 模块只拥有本领域可变状态；不得读取未注入的 Launcher 顶级变量或写入新的 `globalThis`。
3. 文件 I/O 路径、时钟、模型调用、事件通知和日志按测试需要注入；不建立全局 mock。
4. 对外方法使用当前 Launcher 已有的参数和返回值，调用方迁移时不同时修改协议。
5. 每次只迁移一个边界，并用独立提交保留可直接回退的节点。

拟议模块名是实施边界，不是必须一次创建的目录结构：

```text
lib/conversation-report.mjs
lib/mcp-manager.mjs
lib/active-session-store.mjs
lib/schedule-definition.mjs
lib/schedule-coordinator.mjs
lib/scheduled-report-runner.mjs
lib/scheduled-knowledge-runner.mjs
lib/dashboard-context.mjs
```

如果某个模块只剩一层无意义转发，应保留在 Launcher，不为行数强行拆分。

## 4. 分阶段实施

### 阶段 0：锁定行为契约

生产代码不移动，先补齐后续迁移所需的特征测试：

- 固定 Dashboard context 对外方法名和关键返回结构。
- 固定 stdout 只输出启动 JSON、诊断写入 stderr 的启动契约。
- 固定会话 JSONL/meta、定时任务和报告文件的读写往返结果。
- 固定工作区切换时工具重建、MCP reload 和模型上下文保留顺序。
- 把依赖 `launcher.slice()`/源码标记的相关测试改为行为测试；迁移前后必须覆盖同一风险，不能直接删除断言。

退出条件：只新增/改进测试，`npm run quality:check` 通过。

### 阶段 1：提取会话报告的数据边界

先处理风险较低、输入输出清晰的报告逻辑：

- 提取日期范围计算、JSONL 容错扫描、长度预算、来源预览和短时缓存。
- 报告服务通过依赖读取 sessions 目录和活动会话路径；不得自行寻找工作区或用户目录。
- 模型调用、Provider 选择和旧提示词迁移暂留 Launcher，待数据边界稳定后再决定是否纳入服务。
- 保持 `/report`、定时报告和 Dashboard 预览使用同一结果结构。

重点测试：损坏/截断 JSONL、跨日/周/年范围、自定义范围、内容截断、缓存失效、活动会话计入规则。

### 阶段 2：提取 MCP 生命周期

创建 `createMcpManager(deps)`，由它拥有 server 列表、启动 Promise 和 restart Promise。对外只暴露：

- `startInBackground()`
- `reload()`
- `invokeTool(serverName, toolName, args)`
- `servers()`（供 Dashboard 只读展示）

必须保持：

- Dashboard ready 后才后台启动 MCP，不能拖慢首屏。
- 内置 OfficeCLI 自动注入和手工配置优先级不变。
- OfficeCLI 请求为 180 秒，其他 MCP 保持默认超时。
- workspace 切换后重新应用 DLP 路径包装和 loop tool prefix。
- 超时恢复只重启连接，不自动重放可能已经执行的写操作。

重点测试：增删配置、重复 reload、并发 restart 去重、初始化失败降级、工具注销、OfficeCLI 恢复和非 OfficeCLI 超时行为。

### 阶段 3：提取活动会话存储

先提取 I/O 所有权，不把整个会话编排一次搬走：

- `active-session-store` 拥有 append stream、关闭/flush、原子全量写、meta 读写、归档和清理。
- Launcher 继续负责把 loop context 转换为 entries，以及恢复计划、模式记忆、临时记忆和已准备文档。
- Store 返回结构化错误，由现有 `trackPersistentStorageIssue` 和 Dashboard 通知策略处理，不能吞掉数据错误。
- 保持现有 JSONL 和 meta 字节结构，不增加迁移版本。

重点测试：并发 append 与 finalize、退出 flush、截断尾行恢复、损坏文件不覆盖、归档冲突、meta 写入失败和空会话清理。

只有上述存储边界稳定后，才评估把 `load/reset/finalize` 编排合并成生命周期服务；不能在同一提交完成两层迁移。

### 阶段 4：分段提取定时任务

禁止一次移动整个定时任务区。每个子阶段独立提交并完整回归。

#### 4A：任务定义和兼容归一化

- 把任务种类、时间范围、旧字段兼容和 public schedule 映射迁入 `schedule-definition`。
- 保持三类任务、现有 schema 和旧配置迁移结果不变。
- 用表驱动测试覆盖合法/非法输入和旧版本样例。

#### 4B：排队、准入和计时器

- `schedule-coordinator` 拥有 timers、单并发 registry、FIFO trigger queue 和 drain 状态。
- 具体任务通过注入的 executor 执行，coordinator 不读取会话或调用模型。
- 保持同任务触发去重、跨任务 FIFO、启动补跑、取消、失败重试、工作区绑定和 V来家未登录等待语义。

#### 4C：报告执行器

- 提取定时报告的范围解析、生成、托管存储、可选下载导出和运行统计。
- “未勾选导出”仍必须生成可预览的托管报告。
- 工作区切换后使用任务绑定/运行时解析出的工作区，不捕获创建时的旧全局路径。

#### 4D：会话整理和知识归档执行器

- 提取会话质量评估、主题合并、文档质量门禁、知识 manifest 更新和可选 embedding 触发编排。
- 复用现有 `session-knowledge` 与 `scheduled-knowledge-store`，不复制评分/归档算法。
- 保持低价值过滤、相关会话合并、手工编辑文档保护和 `workspace/knowledge` 目录约定。

### 阶段 5：收敛 Dashboard context

这是最后阶段，前置服务未稳定前不得开始。

- 使用已提取服务的方法组装现有扁平 context；HTTP API 属性名和返回结构完全不变。
- 先迁移 MCP、会话、任务、报告等已具备服务接口的字段，模型循环、模式、确认卡片等高风险闭包继续留在 Launcher。
- 最后才评估 `createDashboardContext(deps)`；若依赖仍然过多，则保留显式装配，不创建新的“万能 context manager”。
- Launcher 最终只保留启动顺序、服务装配、模型循环协调和进程生命周期。

重点测试：全部 API 契约、SSE 事件、主界面启动、模型切换、工作区切换、千条会话、MCP reload、定时任务排队和退出清理。

## 5. 每阶段质量门禁

每个阶段都按同一顺序验收：

1. 先提交能复现现状的测试，再迁移代码。
2. 运行新增模块的针对性测试。
3. 运行 `npm test`。
4. 运行 `npm run quality:check`。
5. 检查 Dashboard API/SSE schema 和所有用户数据文件格式未变化。
6. 一个阶段一个提交；出现行为差异时回退该阶段，不在差异上继续叠加迁移。

中间阶段不构建 release。全部阶段完成并再次评审后，先告知用户，再只执行：

```powershell
npm run tauri:build -- --no-bundle
```

除非用户另行明确要求，不生成 NSIS 安装包。

## 6. 完成标准

- Launcher 只承担装配和跨模块协调，没有迁移后遗留的双份状态或兼容分支。
- 新模块输入明确、无隐藏全局状态、具备行为测试。
- Dashboard API、SSE、启动 JSON 和用户数据格式保持兼容。
- MCP 不影响首屏速度，活动会话无数据丢失，定时任务 FIFO/重试/工作区语义保持一致。
- 完整质量门禁和最终 Release 验证通过。
- 架构文档同步为实际边界，不使用行数下降代替质量结论。
