# Visionox-Whale 发布验收清单

> 仅在明确需要交付 exe 或安装包时使用。普通源码提交不构建 release，也不生成 NSIS。

## 发布记录

| 项目 | 填写值 |
|---|---|
| 版本 | `x.y.z` |
| Git commit | `<完整 commit SHA>` |
| 分支 | `<branch>` |
| 构建时间 | `<ISO 8601 + 时区>` |
| 构建人员/环境 | `<Windows 版本与主机>` |
| 交付类型 | `release exe / NSIS` |

## 构建前

- [ ] 发布 commit 已完成代码评审，工作区只保留明确记录的非发布修改。
- [ ] `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json` 版本一致。
- [ ] 本地 `node.exe`、`officecli.exe` 与 `runtime-manifest.json` 的版本、大小和 SHA-256 一致。
- [ ] 未使用网络下载、旧安装目录、`target/debug` 或自定义 Cargo target 目录补齐资源。
- [ ] `npm run quality:check` 完整通过。

## Release Exe

- [ ] 关闭正在运行的 Visionox-Whale、Node 和 OfficeCLI 进程。
- [ ] 执行 `npm run release:check`；其中构建步骤必须且只会调用 `npm run tauri:build -- --no-bundle`。
- [ ] 发布检查完整通过，且未在项目内留下临时目录或第二套资源。
- [ ] 唯一验收目标为 `src-tauri/target/release/visionox-whale.exe` 及同级 `resources/`。
- [ ] `resources/` 包含 Node、OfficeCLI、Dashboard、服务端 lib、bootstrap skills、ECC 规则和默认 Soul。

## 功能抽查

- [ ] 启动、刷新和退出正常，退出后所属子进程全部结束。
- [ ] 可加载千条以上消息的会话，输入和滚动无明显卡顿。
- [ ] 模型导入、全模型检测、通过标识、外部/内部模型切换规则正常；JSON 模型的检测覆盖参数不影响正式对话参数。
- [ ] 三种索引模式可切换并保持；工作区与 `knowledge/` 可构建和召回。
- [ ] 会话整理可过滤低价值内容、合并同主题知识，并按设置触发 embedding。
- [ ] 会话批量回收、预览、恢复和过期清理正常。
- [ ] 概览可创建快照、预览差异；默认恢复不覆盖冲突，强制覆盖前有确认。
- [ ] Soul、长期记忆、场景记忆和项目规则的保存与上下文应用状态一致。

## NSIS（仅明确要求时）

- [ ] 仅执行 `npm run bundle:nsis`，未手动复制或替换 bundle 资源。
- [ ] `verify:nsis` 确认安装包内 exe 与 release 只存在允许的 Tauri marker 差异。
- [ ] 安装包 `resources/` 文件集合、大小和 SHA-256 与 release 一致。
- [ ] 在用户自行安装后，确认启动的是安装版本，并重复长会话、模型和资源完整性抽查。

## SHA-256 记录

使用 PowerShell 读取实际产物，不手工填写哈希：

```powershell
Get-FileHash src-tauri\target\release\visionox-whale.exe -Algorithm SHA256
Get-FileHash src-tauri\target\release\bundle\nsis\Visionox-Whale_<版本>_x64-setup.exe -Algorithm SHA256
```

| 产物 | 大小（bytes） | SHA-256 |
|---|---:|---|
| `visionox-whale.exe` | `<size>` | `<sha256>` |
| `Visionox-Whale_<版本>_x64-setup.exe` | `<size 或 N/A>` | `<sha256 或 N/A>` |

## 发布确认

- [ ] 变更日志与实际功能一致，不包含未交付能力。
- [ ] 版本、commit、文件名、大小和 SHA-256 已复核。
- [ ] 已记录已知限制和回退方式。
- [ ] 获得明确授权后才执行 tag、推送、上传或发布。
