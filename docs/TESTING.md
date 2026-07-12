# 测试结构

`npm run quality:check` 是统一提交门禁。新增功能应优先放入对应领域测试文件，不继续扩充两个遗留聚合文件：

- `api.test.mjs` 只保留跨端点集成流程和公共鉴权行为。
- `dashboard-regression.test.mjs` 只保留跨面板工作流和历史 bundle 补丁基线。
- 存储、策略、契约和单个面板的新行为使用独立 `*.test.mjs`。

`scripts/check-test-structure.js` 限制两个遗留文件继续增长。只有在迁出既有测试后才降低上限，禁止通过提高上限容纳新功能。

测试数据必须位于系统临时目录并在成功、失败时清理。浏览器交互统一通过 `scripts/ui-smoke.js` 使用隔离的 HOME/USERPROFILE，不能读取真实 `~/.visionox`。
