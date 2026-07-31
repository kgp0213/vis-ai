# hrbrain — 组织大脑（人才池 / 员工档案 / 人才搜索）

> 来源：DWS v1.0.55 内置 `dingtalk-hrbrain` 技能（实验版）。命令可用性以当前二进制的 `dws hrbrain <cmd> --help` 为准。

`dws hrbrain` 提供三大能力：**人才池管理**、**员工档案查询**、**人才搜索**。当前全部为只读命令。

## 意图表

| 用户说 | 命令 |
|--------|------|
| "人才池列表 / 储备干部池" | `hrbrain talent-pool list` |
| "人才池详情" | `hrbrain talent-pool detail --pool-code <POOL_CODE>` |
| "人才池里有哪些人" | `hrbrain talent-pool employees --pool-code <POOL_CODE>` |
| "员工档案元数据 / 档案结构" | `hrbrain profile metadata --work-no <WORK_NO>` |
| "查员工档案数据" | 先 `profile metadata` 确认字段编码，再 `hrbrain profile query --work-no <WORK_NO> --data-queries '[...]'` |
| "员工标签" | `hrbrain profile labels --staff-ids <WORK_NO1,WORK_NO2>` |
| "职业历程 / 内部履历" | `hrbrain profile career --work-no <WORK_NO>` |
| "绩效记录" | `hrbrain profile performance --work-no <WORK_NO>` |
| "搜人 / 按条件找人（简单）" | `hrbrain search employees --keyword <关键词>` |
| "搜人（复杂组合条件）" | 先 `hrbrain search fields` 获取字段，再 `hrbrain search employees-structured --origin-json '{...}' --fields '[...]'` |

## 参数要点

- `talent-pool list` 可选 `--keyword`、`--pool-type`、`--creator`、`--labels`（逗号分隔）、`--page`、`--page-size`。
- `profile query` 的 `--data-queries` 是 JSON 数组，每项含 `modelCode`、`fields`；先用 `profile metadata` 查可用模块与字段编码。
- `profile labels` 的 `--staff-ids` 是逗号分隔工号列表；`--all-label` 返回全部标签。
- `search employees` 可选 `--keyword`、`--dept-name`、`--job-level`、`--position-name`、`--pool-code`、`--page`、`--page-size`。
- `search employees-structured` 必填 `--origin-json`（搜索条件 JSON）与 `--fields`（返回列 JSON 数组），可选 `--order-by`（逗号分隔）。
- `--staff-ids`、`--labels`、`--order-by` 是逗号分隔字符串，不是 JSON；`--data-queries`、`--fields`、`--origin-json` 必须是合法 JSON 字符串。

## 权限与约束

- `talent-pool list` 需要账号单独开通"人才池查看权限"；返回 `errorCode=2002` 时提示用户联系管理员开通，不要重试或换 profile。
- 档案数据属敏感个人信息：只查询任务所需字段，汇总时注明数据来源与时间。

## 示例

```json
{"args":["hrbrain","talent-pool","list","--page","1","--page-size","20"]}
{"args":["hrbrain","talent-pool","employees","--pool-code","POOL_CODE","--page","1"]}
{"args":["hrbrain","profile","metadata","--work-no","WORK_NO"]}
{"args":["hrbrain","profile","query","--work-no","WORK_NO","--data-queries","[{\"modelCode\":\"basic\",\"fields\":[\"name\",\"dept\"]}]"]}
{"args":["hrbrain","profile","labels","--staff-ids","WORK_NO1,WORK_NO2"]}
{"args":["hrbrain","search","employees","--keyword","张三"]}
{"args":["hrbrain","search","fields"]}
```
