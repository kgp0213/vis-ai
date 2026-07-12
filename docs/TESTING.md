# 测试结构

`npm run quality:check` 是统一提交门禁。新增功能应优先放入对应领域测试文件，不继续扩充两个遗留聚合文件：

- `api.test.mjs` 只保留跨端点集成流程和公共鉴权行为。
- `dashboard-regression.test.mjs` 只保留跨面板工作流和历史 bundle 补丁基线。
- 存储、策略、契约和单个面板的新行为使用独立 `*.test.mjs`。

`scripts/check-test-structure.js` 限制两个遗留文件继续增长。只有在迁出既有测试后才降低上限，禁止通过提高上限容纳新功能。

核心 HTTP 响应的最低字段由 `contracts/api-responses.schema.json` 管理。修改概览、健康、备份、定时任务或
Provider 响应时，需要同步契约并在 `api-contracts.test.mjs` 或对应 API 集成流程中验证真实响应，不能只测试 mock。

Dashboard 中可独立表达的策略应逐步迁入可读脚本并单测。例如 `dashboard/backup-support.js` 负责备份保留数
归一化与恢复操作启用条件；bundle 回归只负责确认 Dashboard 正确调用该策略，真实 Edge 冒烟负责验证端到端流程。

运行时失败使用 `lib/runtime-issues.mjs` 的四级语义：debug 可忽略，warning 表示可继续的功能降级，error
表示用户数据可能不完整，fatal 必须停止当前危险操作。只有带稳定问题键的 warning/error 可以进入
`/api/health.storageIssues`；新增错误路径需要测试“原文件未被覆盖”和“概览不会收到 debug 噪声”。

`active-session-meta.test.mjs` 使用真实临时文件验证损坏和高版本 active session metadata 不被覆盖。
`launcher-storage-policy.test.mjs` 只锁定 Soul/规则降级、模式记忆回滚、知识主题防覆盖和活动计划清理四个
关键边界，不对所有清理型 catch 做数量断言。Dashboard 索引模式的合法值与提示由
`index-mode-support.test.mjs` 独立验证，真实 Edge 冒烟继续负责状态保持和选择交互。

测试数据必须位于系统临时目录并在成功、失败时清理。浏览器交互统一通过 `scripts/ui-smoke.js` 使用隔离的 HOME/USERPROFILE，不能读取真实 `~/.visionox`。
