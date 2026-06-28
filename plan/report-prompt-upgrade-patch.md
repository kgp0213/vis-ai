# 报告提示词升级补丁记录

本次修改涉及对 `visionox-pkg`（reasonix 包，独立 git 仓库）bundled 产物的就地修改。
当 reasonix 升级（替换 `visionox-pkg/dist/` 和 `visionox-pkg/dashboard/dist/`）后，
以下改动会被覆盖，需要重新应用。

## 修改清单

### 1. `src-tauri/resources/server/launcher.mjs`（源码形式，非 bundled）

随 vis-ai 主仓库提交，不会因 reasonix 升级丢失。改动：

- `DEFAULT_REPORT_PROMPT_TEMPLATE`（约 2389 行起）：新增第 8 条约束
  "报告应总结'对话中发生了什么'——不要把对话记录里 assistant 提到的文件路径、
  代码片段、命令输出复述进报告……"
- 新增 `migrateReportPromptAddendum()` 函数（约 2424 行起）：
  - 检查 `cfg.reportPromptTemplate` 是否存在
  - 与当前默认相等 → 直接删除
  - 不同 → 调用 `client.chat` 让 LLM 总结出 addendum
  - LLM 失败/无 client → fallback：旧模板整体作为 addendum + 顶部注释
  - 写回 config，删除旧 `reportPromptTemplate` 字段
- `generateReport()` 开头调用 `await migrateReportPromptAddendum()`（约 2494 行）
- `ctx.getReportPromptTemplate` 改为返回 `{ default, addendum }`
- `ctx.setReportPromptTemplate` 改名为 `setReportPromptAddendum`，接受 addendum 字符串

### 2. `src-tauri/resources/server/visionox-pkg/dist/cli/server-XGDBRWMB.js`（bundled）

`/report/prompt` 路由（搜索 `if (_rest[0] === "prompt")`，约 3016 行）：

- GET 返回 `{ default, addendum }` 而非 `{ template }`
- POST body 改为 `{ addendum }`，调用 `ctx.setReportPromptAddendum`
- DELETE 调用 `ctx.setReportPromptAddendum(null)`

### 3. `src-tauri/resources/server/visionox-pkg/dashboard/dist/app.js`（bundled）

报告面板提示词编辑器（搜索 `showPromptEditor`，约 28521 行）：

- state 拆成 `promptDefault`（只读）+ `promptAddendum`（可编辑）
- `openPromptEditor` 从 `res.default` / `res.addendum` 分别 set
- `savePromptTemplate` POST `{ addendum: promptAddendum }`
- `resetPromptTemplate` DELETE 清空 addendum
- UI 上方新增 `<div class="reports-prompt-default"><pre>${promptDefault}</pre></div>`
- 下方 textarea 绑定 `promptAddendum`

### 4. `src-tauri/resources/server/visionox-pkg/dashboard/app.css`

新增 `.reports-prompt-default` / `.reports-prompt-default-label` / `.reports-prompt-default pre` 样式
（约 4224 行后）。

## 升级后重新应用步骤

1. 拉取新版 reasonix → 覆盖 `visionox-pkg/dist/` 和 `visionox-pkg/dashboard/dist/`
2. 重新应用 #2：改 `server-XGDBRWMB.js` 的 `/report/prompt` 路由
3. 重新应用 #3：改 `app.js` 的提示词编辑器
4. 重新应用 #4：改 `app.css`（如未被覆盖）
5. `launcher.mjs` 不需要重做（在主仓库）
6. `node --check` 三个文件确认语法通过

## 迁移触发时机

- 懒触发：用户第一次点"生成报告"时执行 `migrateReportPromptAddendum()`
- 触发后 `cfg.reportPromptTemplate` 被删除，`cfg.reportPromptAddendum` 被写入
- 后续生成报告不再触发迁移（无 `reportPromptTemplate` 字段）

## 迁移用 LLM prompt

- model: `effectiveModelConfig().model`（当前 provider 的当前模型）
- temperature: 0.2, maxTokens: 600
- system: "你是提示词迁移助手……"
- user: 新默认模板 + 用户旧模板 → 输出 addendum 或空字符串
- 失败 fallback：旧模板整体作为 addendum + 顶部注释"（从旧版本迁移的用户自定义提示词，建议清理后重新编辑）"
