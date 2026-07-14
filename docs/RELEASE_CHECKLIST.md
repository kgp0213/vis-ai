# Visionox-Whale 发布验收清单

> 仅在明确需要交付 exe 或安装包时使用。普通源码提交不构建 release，也不生成 NSIS。

> 易变化的构建时间、Git commit、文件数量、大小和 SHA-256 不再手工抄写。本地规范构建会自动生成 `src-tauri/target/release/release-manifest.json`；它是当前产物的唯一机器可读证据，并由 `target/` 忽略规则排除在 Git 之外。自动证据不能替代全新安装和覆盖升级的人工验收。

## 发布记录

| 项目 | 填写值 |
|---|---|
| 版本 | `1.28.0` |
| Git commit / 分支 / 脏状态 | 读取 `release-manifest.json` 的 `build.git` |
| 构建时间 / 构建标记 | 读取 `generatedAt` 和 `build.stamp` |
| 构建人员/环境 | `Windows x64 / 本机离线构建` |
| 交付状态 | `READY FOR USER TEST`；人工安装验收完成前不是正式发布 GO |

## 构建前

- [ ] 发布 commit 已完成代码评审，工作区只保留明确记录的非发布修改。
- [x] `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json` 版本一致。
- [x] 本地 `node.exe`、`officecli.exe`、`dws.exe` 与 `runtime-manifest.json` 的版本、大小和 SHA-256 一致。
- [x] 未使用网络下载、旧安装目录、`target/debug` 或自定义 Cargo target 目录补齐资源。
- [x] `npm run quality:check` 完整通过；具体测试数量以当次命令输出为准。

## Release Exe

- [x] 关闭正在运行的 Visionox-Whale 交付实例，构建后保持关闭以便安装测试。
- [ ] 执行 `npm run release:check`；其中构建步骤必须且只会调用 `npm run tauri:build -- --no-bundle`。
- [ ] 发布检查完整通过，且未在项目内留下临时目录或第二套资源。
- [x] 唯一验收目标为 `src-tauri/target/release/visionox-whale.exe` 及同级 `resources/`。
- [x] `resources/` 包含 Node、OfficeCLI、DWS、Dashboard、服务端 lib、bootstrap skills、ECC 规则和默认 Soul。
- [x] `release-manifest.json` 的 `verification.releaseResources` 为 `true`，且 `artifacts.executable`、`artifacts.resources`、`artifacts.runtimes` 均有实际值。

> 本轮未执行需要单独授权的 Rust 单元测试，因此 `npm run release:check` 未整套运行；Rust Release 编译和格式检查已通过。

## 功能抽查

- [ ] 启动页持续显示到 Dashboard 完成渲染；刷新和托盘恢复正常，退出后所属子进程全部结束。
- [ ] 可加载千条以上消息的会话，输入和滚动无明显卡顿。
- [ ] 纯文本 Windows 文件/目录路径可立即粘贴；资源管理器复制文件仍能取得完整路径，输入框不因 PowerShell 降级而卡顿。
- [ ] 模型导入、全模型检测、通过标识、外部/内部模型切换规则正常；JSON 模型的检测覆盖参数不影响正式对话参数。
- [ ] DWS 未登录时可从左侧启动/取消 Device Flow，等待期间普通 AI 正常；登录后显示用户名，可读取未读/指定会话消息；退出当前组织和 `127.0.0.1` 回退正常。
- [ ] 消息发送不把否定、询问、分析、演示或引用当成授权；安全聊天/定时消息可按用户原始请求直发，有害、不确定和附件内容仍需确认或阻断。
- [ ] OfficeCLI 长操作使用 180 秒超时，超时恢复后不会盲目重放已执行的写操作。
- [ ] 三种索引模式可切换并保持；工作区与 `knowledge/` 可构建和召回。
- [ ] 会话整理可过滤低价值内容、合并同主题知识，并按设置触发 embedding。
- [ ] 会话批量回收、预览、恢复和过期清理正常。
- [ ] 概览可创建快照、预览差异；默认恢复不覆盖冲突，强制覆盖前有确认。
- [ ] Soul、长期记忆、场景记忆和项目规则的保存与上下文应用状态一致。

## NSIS（仅明确要求时）

- [x] 仅执行 `npm run bundle:nsis`，未手动复制或替换 bundle 资源。
- [x] `verify:nsis` 确认安装包内 exe 与 release 只存在允许的 Tauri marker 差异。
- [x] 安装包 `resources/` 与 release 逐项 SHA-256 一致；文件数读取 `release-manifest.json` 的 `artifacts.resources.files`。
- [x] `release-manifest.json` 的 `verification.nsisBundle` 为 `true`，`artifacts.installer` 指向唯一规范命名安装包。
- [ ] 在用户自行安装后，确认启动的是安装版本，并重复长会话、模型和资源完整性抽查。

## 产物记录

规范命令会在所有自动验证通过后写入：

```text
src-tauri/target/release/release-manifest.json
```

重点核对以下字段：

- `build.git.dirty` 必须为 `false`，`build.git.commit` 必须是准备交付的源码 commit。
- `verification.releaseResources` 和 `verification.nsisBundle` 必须为 `true`。
- `artifacts.executable` 和 `artifacts.installer` 记录实际相对路径、字节数和 SHA-256。
- `artifacts.resources` 记录资源文件数和总字节数；`artifacts.runtimes` 记录 Node、OfficeCLI、DWS 的版本和 SHA-256。

需要独立复核时可使用 PowerShell，但不得把手工结果覆盖自动清单：

```powershell
Get-FileHash src-tauri\target\release\visionox-whale.exe -Algorithm SHA256
Get-FileHash src-tauri\target\release\bundle\nsis\Visionox-Whale_<版本>_x64-setup.exe -Algorithm SHA256
```

## 发布确认

- [x] 变更日志与实际功能一致，不包含未交付能力。
- [x] 版本、文件名、大小和 SHA-256 由自动清单记录并可独立复核。
- [x] 已记录已知限制和回退方式。
- [x] 不因生成候选安装包自动创建 tag、上传产物或宣布正式发布。
