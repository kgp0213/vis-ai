# Dashboard 功能基线与迁移验收

Dashboard 的事实源码位于 `src-tauri/resources/server/visionox-pkg/dashboard/src/`，由
`npm run dashboard:build` 离线生成唯一运行产物 `dashboard/dist/app.js` 和 `dashboard/app.css`。
旧 source map 只用于一次性核对上游模块边界，不参与构建、测试或交付，也不能覆盖当前源码。

`backup-support.js`、`index-mode-support.js` 和 `overview-alerts-support.js` 仍作为可独立测试的浏览器策略脚本保留。
运行入口始终只有已生成的 Dashboard bundle，不存在第二套可运行 Dashboard。

## 功能基线

| 领域 | 必须保留的行为 | 当前自动化证据 |
|---|---|---|
| 长会话 | 服务端分页、默认只渲染最近 30 条、继续加载历史、输入不随会话长度退化 | API 千条会话测试、Dashboard 长会话回归、真实 Edge 1200 条输入延迟门禁 |
| 会话管理 | 搜索、批量移入回收站、预览、改名恢复、永久删除、保留期清理 | `session-trash.test.mjs`、Dashboard 会话回归 |
| 记忆与 Soul | 全局/项目/场景/会话分层、容量边界、冲突提示、Soul 编辑与历史恢复、压缩后重新注入 | `memory-correctness.test.mjs`、`memory-prompt.test.mjs`、Dashboard 记忆回归 |
| 本地索引 | 工作区与 `knowledge/` 隔离索引、自动召回/按需搜索/不使用、模式跨场景和新会话持久化、来源展示 | 语义索引与召回测试、API 模式测试、真实 Edge 交互门禁 |
| 会话知识整理 | AI 质量评估、低价值过滤、跨会话主题合并、知识文档质量复核、可选自动 embedding | `session-knowledge.test.mjs`、Dashboard 定时任务回归 |
| 模型管理 | Provider JSON 校验导入、全部模型 10 秒通信检测、仅通过项显示标记、首个通过模型自动启用、内外部模式分支 | Provider/API/模型切换测试、Dashboard 模型回归、真实 Edge 菜单检查 |
| 文件与 Markdown | 最近文件、产物追踪、受控预览/另存、Markdown 应用内预览、外部打开确认、六处 KaTeX 一致渲染 | 文件 API 回归、`katex-support.test.mjs`、Dashboard KaTeX 回归 |
| 交互与计划 | choice/command/plan/checkpoint/revision gate、防重复提交、未完成计划续跑 | pause gate、计划状态、计划续跑和 Dashboard 卡片回归 |
| 输入队列与后台任务 | 稳定 requestId、持久队列、暂停/恢复、任务单独停止、刷新不重复提交 | API 队列/后台任务测试、Dashboard 队列回归 |
| 概览与设置 | 高价值运行状态、用户数据路径、设置凭据显式保存、开发者日志阅读位置不被刷新打断 | Dashboard 概览、设置与日志回归 |

## 已完成的迁移

1. 已建立受 Git 跟踪的 Preact、HTM、TypeScript 源码树，并复用仓库锁定的离线依赖。
2. 聊天、长会话、索引、会话、记忆、任务、Provider、文件、概览和设置已迁入源码模块。
3. `npm run dashboard:check` 会在两个系统临时目录重复构建，验证确定性、可移植性和提交产物一致性。
4. `tauri:dev`、规范 release 构建和 `quality:check` 均在使用产物前执行 Dashboard 源码校验。

后续修改必须编辑 `dashboard/src/` 并重新生成产物，禁止直接修改 `dist/app.js` 或 `app.css`。

## 切换条件

- `npm run dashboard:typecheck`、`npm run dashboard:check` 和相关领域测试必须通过。
- 构建全程离线，不读取旧安装、AppData、source map 或历史生成物。
- `npm run quality:check` 必须通过真实 Edge 渲染和关键交互检查。
- `npm run release:check` 必须生成唯一的 `src-tauri/target/release/visionox-whale.exe` 并通过资源校验。
- 新增或修改行为必须先补源码级契约或交互测试，不能依靠编译变量名和人工记忆签收。
