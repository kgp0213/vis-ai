# Dashboard 功能基线与迁移验收

当前 Dashboard 运行代码位于 `src-tauri/resources/server/visionox-pkg/dashboard/dist/app.js`，并包含大量 Visionox-Whale 本地功能。旧 source map 不对应当前代码，不能作为恢复或重建依据。本清单记录迁移到可读源码前必须保留的行为基线。

当前已抽取三个可读、独立测试的纯策略模块：`backup-support.js` 负责备份保留与恢复按钮判定，
`index-mode-support.js` 负责索引模式归一化和三种模式提示，`overview-alerts-support.js` 负责概览告警判定、
严重级别和稳定顺序。运行入口仍只有当前 Dashboard bundle；这些脚本
是渐进迁移边界，不是第二套 Dashboard。

## 功能基线

| 领域 | 必须保留的行为 | 当前自动化证据 |
|---|---|---|
| 长会话 | 服务端分页、默认只渲染最近 30 条、继续加载历史、输入不随会话长度退化 | API 千条会话测试、Dashboard 长会话回归、真实 Edge 1200 条输入延迟门禁 |
| 会话管理 | 搜索、批量移入回收站、预览、改名恢复、永久删除、保留期清理 | `session-trash.test.mjs`、Dashboard 会话回归 |
| 记忆与 Soul | 全局/项目/场景/会话分层、容量边界、冲突提示、Soul 编辑与历史恢复、压缩后重新注入 | `memory-correctness.test.mjs`、`memory-prompt.test.mjs`、Dashboard 记忆回归 |
| 本地索引 | 工作区与 `knowledge/` 隔离索引、自动召回/按需搜索/不使用、模式跨场景和新会话持久化、来源展示 | 语义索引与召回测试、API 模式测试、真实 Edge 交互门禁 |
| 会话知识整理 | AI 质量评估、低价值过滤、跨会话主题合并、知识文档质量复核、可选自动 embedding | `session-knowledge.test.mjs`、Dashboard 定时任务回归 |
| 模型管理 | Provider JSON 校验导入、全部模型 10 秒通信检测、仅通过项显示标记、首个通过模型自动启用、内外部模式分支 | Provider/API/模型切换测试、Dashboard 模型回归、真实 Edge 菜单检查 |
| 文件与 Markdown | 最近文件、产物追踪、受控预览/另存、系统打开 Markdown、六处 KaTeX 一致渲染 | 文件 API 回归、`katex-support.test.mjs`、Dashboard KaTeX 回归 |
| 交互与计划 | choice/command/plan/checkpoint/revision gate、防重复提交、未完成计划续跑 | pause gate、计划状态、计划续跑和 Dashboard 卡片回归 |
| 输入队列与后台任务 | 稳定 requestId、持久队列、暂停/恢复、任务单独停止、刷新不重复提交 | API 队列/后台任务测试、Dashboard 队列回归 |
| 概览与设置 | 高价值运行状态、用户数据路径、设置凭据显式保存、开发者日志阅读位置不被刷新打断 | Dashboard 概览、设置与日志回归 |

## 迁移顺序

1. 先建立受 Git 跟踪的 Dashboard 源码目录、锁文件和完全离线的确定性构建命令。
2. 先迁移聊天壳、长会话和索引控制，因为它们覆盖最高频主流程。
3. 再迁移会话、记忆、任务、Provider 和文件中心，每迁移一个领域立即运行对应测试。
4. 最后迁移概览、设置和低频页面；全部领域通过后才允许生成物替代当前 bundle。

迁移期间禁止同时维护两套可运行 Dashboard。每个领域只有在新源码行为通过本表对应证据后才标记完成；最终切换必须一次性更新运行入口和 bundle 守卫。

## 切换条件

- 可读源码、依赖锁文件和构建脚本均已纳入 Git。
- 构建全程离线，不读取旧安装、AppData、source map 或历史生成物。
- `npm run quality:check` 全部通过，真实 Edge 长会话与关键交互通过。
- `npm run release:check` 生成唯一的 `src-tauri/target/release/visionox-whale.exe`，资源校验通过。
- 本清单全部领域均有自动化证据；未覆盖行为必须先补测试，不能依靠人工记忆签收。
