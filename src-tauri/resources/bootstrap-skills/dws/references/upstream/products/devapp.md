# devapp — 开放平台应用管理（快捷命令组）

> 来源：DWS v1.0.55 内置 `dingtalk-devapp` 技能。`devapp` 是 `dev app` 全形命令的快捷别名组（`+` 前缀）；命令可用性以当前二进制的 `dws devapp <cmd> --help` 为准。应用全生命周期与建联工作流见 `dev.md`。

`dws devapp` 管理钉钉开放平台企业内部应用：应用、成员、权限、机器人、版本、网页配置与事件订阅。所有命令通过 `--unified-app-id` 定位应用。

## 只读命令（可直接用 `dws_read`）

| 用户说 | 命令 |
|--------|------|
| "应用列表 / 我有哪些应用" | `devapp +list`（可选 `--name`、`--app-key`、`--creator`、`--app-group-id`、`--cursor`、`--page-size`） |
| "应用详情" | `devapp +get --unified-app-id <ID>` |
| "应用订阅了哪些事件" | `devapp +event-list --unified-app-id <ID>`（可选 `--keyword`、`--cursor`、`--page-size`） |
| "应用成员与角色" | `devapp +member-list --unified-app-id <ID>` |
| "应用权限列表 / 哪些权限未开通" | `devapp +permission-list --unified-app-id <ID>`（可选 `--keyword`、`--auth-status`、`--scope-type`、`--scope-value`） |
| "机器人配置" | `devapp +robot-get --unified-app-id <ID>` |
| "版本列表 / 版本详情 / 发布状态" | `devapp +version-list` / `+version-get` / `+version-status`（均需 `--unified-app-id`，后两者加 `--version-id`） |
| "网页应用配置" | `devapp +webapp-get --unified-app-id <ID>` |
| "版本发布审批预检" | `devapp +version-check-approval --unified-app-id <ID> --version-id <VID>` |

分页约定：返回 `hasMore=true` 时把 `nextCursor` 传给下一次调用的 `--cursor`；`--page-size` 默认 20，Visionox 上限 200。

## 写命令（走 `dws_exec` 确认卡）

`+create`、`+update`、`+delete`、`+enable`、`+disable`、`+member-add`、`+member-remove`、`+webapp-config` 以及事件订阅/退订（`dev app event subscribe/unsubscribe`，见 `dev.md` 与事件订阅参考）会修改企业开发者后台数据，一律先用 `dws_help` 核实参数，再交 `dws_exec` 呈现确认卡。灰度应用的订阅变更需走版本发布链路（version create → check-approval → publish）才生效。

## 示例

```json
{"args":["devapp","+list","--name","机器人","--page-size","20"]}
{"args":["devapp","+event-list","--unified-app-id","<ID>","--keyword","通讯录"]}
{"args":["devapp","+permission-list","--unified-app-id","<ID>","--auth-status","UNAUTHED"]}
{"args":["devapp","+version-status","--unified-app-id","<ID>","--version-id","<VID>"]}
```
