# Visionox-Whale

Visionox-Whale 是基于 Tauri 2、Node.js 和本地 Dashboard 的桌面 AI 助手。应用名称为 `Visionox-Whale`，Windows 可执行文件为 `visionox-whale.exe`。

## 当前能力

- 多模型与 OpenAI-compatible Provider 配置
- Provider JSON 导入、全模型通信检测和检测状态提示
- 文件、Shell、Web、Memory、MCP、Skill 和 Plan 工具
- 通用、编程、办公、设计四种工作模式
- 会话搜索、长会话分页恢复、批量回收、预览、恢复和自动过期清理
- 对话中连续输入与持久队列
- Soul、长期、项目、工作场景和会话记忆的统一管理
- 工作区与 `knowledge/` 知识文档语义索引，以及自动召回、按需搜索、不使用三种会话级模式
- 定时会话整理、AI 质量评估、同主题知识合并和可选的自动 embedding 更新
- `/learn` 学习功能
- 内置 Node.js、OfficeCLI、bootstrap skills 和 ECC 规则
- Markdown 打开、预览、文件关联和对话产物管理，统一支持 KaTeX 行内与块级公式
- 定时任务、执行记录和报告生成

## 数据兼容与安全

产品名称和 exe 已统一为 Visionox-Whale，但以下兼容标识保持不变，以继续读取已有数据：

- Tauri identifier：`com.visionox.desktop`
- 用户数据目录：`%USERPROFILE%\.visionox\`
- 会话目录：`%USERPROFILE%\.visionox\sessions\`
- 配置文件：`%USERPROFILE%\.visionox\config.json`

因此，新 exe 会继续读取已有会话、设置、记忆和任务数据。

配置文件使用 `configSchemaVersion` 管理格式。旧配置首次迁移前会在
`%USERPROFILE%\.visionox\backups\` 中保留一次恢复副本，然后通过原子写入更新。损坏 JSON、
不支持的更高版本或备份失败时，程序不会静默覆盖原配置。迁移日志不输出 API Key 或配置正文。

## 使用

启动 Visionox-Whale 后，在设置页配置 API Key 和模型 Provider。主要入口如下：

| 操作 | 入口 |
|---|---|
| 切换工作模式 | 聊天页面顶部的工作场景按钮 |
| 切换执行权限 | 聊天页面顶部的 `auto / yolo / admin` 按钮 |
| 导入、检测或切换模型 | 聊天输入区下方的“模型”菜单 |
| 控制本地索引 | 聊天输入区下方、后台任务之后的“索引”选择框 |
| 管理会话 | 左侧“会话”，支持批量移入回收站、预览和恢复 |
| 管理任务 | 左侧“任务”，包括会话整理、报告和自定义任务 |
| 查看运行概况 | 左侧“概览”，位于“任务”和 OA 之间 |
| 管理记忆 | 左侧“高级”中的记忆页面，可编辑和预览 Soul、恢复历史版本，并按工作场景新增、移动、复制、批量管理或从回收站恢复记忆 |
| 管理 MCP | 左侧“高级”中的 MCP 页面 |
| 打开 Markdown | 顶部“打开 MD”或系统文件关联 |
| 构建语义索引 | 左侧“高级”中的语义页面 |
| 查看学习命令 | 输入 `/learn help` |

## 唯一 Windows Release 构建

本项目的唯一交付测试目标是：

```text
src-tauri\target\release\visionox-whale.exe
src-tauri\target\release\resources\
```

不要使用 `target/debug`、安装目录副本或其他 Cargo target 目录作为测试基准。

### 本地前提

- Node.js 22+
- Rust 工具链
- Microsoft Edge（提交前真实浏览器渲染检查）和 WebView2 Runtime（桌面运行）
- 已安装项目根目录的 npm 依赖
- `src-tauri/resources/server/node.exe`
- `src-tauri/resources/server/officecli.exe`

规范构建强制 npm 与 Cargo 离线。缺少依赖或运行时资源时会直接失败，不会在构建过程中下载或从旧安装恢复。

### 构建 exe

```powershell
cd <项目目录>
taskkill /F /IM visionox-whale.exe 2>$null
npm run tauri:build -- --no-bundle
```

`npm run tauri:build` 执行以下步骤：

1. 从 `src-tauri/resources/` 在系统 `%TEMP%` 中准备裁剪后的临时运行时包。
2. 删除 source map、备份和临时文件等非运行资源。
3. 执行 bundle 补丁与构建身份守卫。
4. 使用 Tauri 编译 release exe，并直接生成规范的 `resources/`。
5. 对 release 资源树与源码/暂存树逐文件校验 SHA256。
6. 无论成功或失败都立即删除系统临时运行时包；仓库内不创建 `src-tauri/runtime/`。

不得手工复制资源到 release，也不得使用裸 `cargo build` 或 `npx tauri build` 生成交付测试产物。

### 提交前质量门禁

```powershell
npm run quality:check
```

该命令统一检查 Launcher、Dashboard 和服务端 bundle 语法、本地补丁、全部 Node 测试、
真实 Edge Dashboard 渲染、Rust 格式和 diff 空白。浏览器与服务器测试使用 `%TEMP%` 中的隔离
用户目录，结束后按测试进程 PID 清理，不读取或修改真实的 `~/.visionox` 数据。该门禁不构建
Rust，也不会创建项目内的 `target/debug`。

### 单项验证

Dashboard 回归测试：

```powershell
node --test src-tauri\resources\server\__tests__\dashboard-regression.test.mjs
```

构建守卫：

```powershell
npm run check:bundle-patches
```

### 发布验证

交付 exe 前先运行质量门禁，再运行发布检查：

```powershell
npm run quality:check
npm run release:check
```

发布检查还会验证 Unicode 运行路径、UI 日期版本，使用系统临时目录运行 Rust 测试，并通过
规范命令重新构建 release。Rust 测试产物完成后删除，不会生成项目内的 `target/debug`。

## NSIS 安装包

只在明确需要安装包时执行：

```powershell
taskkill /F /IM visionox-whale.exe 2>$null
npm run bundle:nsis
```

预期产物：

```text
src-tauri\target\release\bundle\nsis\Visionox-Whale_<版本>_x64-setup.exe
```

`bundle:nsis` 会完整解包安装程序，并验证：

- 安装包内主程序与 release exe 一致，仅允许 Tauri bundle marker 差异。
- 整个 `resources/` 文件集合与 release 完全一致。
- Node.js、OfficeCLI、Dashboard、服务端、bootstrap skills 和 ECC 规则均存在且 SHA256 一致。
- 安装包没有多余或缺失的运行资源。

构建或验证不会安装生成的 NSIS 文件。

## 运行时资源规则

程序只根据 `current_exe()` 定位同级 `resources/`：

```text
visionox-whale.exe
resources\
  server\
    launcher.mjs
    node.exe
    officecli.exe
    lib\
    visionox-file\
    visionox-pkg\
  bootstrap-skills\
  ecc-rules\
  default-soul.md
  skill-creation-guide.md
```

非测试运行代码不得读取源码目录、绝对项目路径或安装副本来修复缺失资源。资源不完整必须由构建流程发现并失败。

## 项目结构

```text
src/                         Tauri 加载页
src-tauri/src/               Rust 桌面壳与进程管理
src-tauri/resources/         运行资源源码
src-tauri/resources/server/lib/  本项目维护的运行时模块
src-tauri/resources/server/__tests__/  Node、API 与运行时测试
src-tauri/tauri.conf.json    Tauri 与 bundle 配置
scripts/                     构建、检查和安装包验证
.github/workflows/quality.yml  Windows CI 质量门禁
docs/                        使用、架构与开发文档
```

关键脚本：

| 脚本 | 用途 |
|---|---|
| `scripts/quality-check.js` | 本地与 CI 共用的提交前质量门禁 |
| `scripts/check-repository-hygiene.js` | 阻止临时 map、备份和冗余归档文件重新进入项目或 release |
| `scripts/ui-smoke.js` | 使用真实 Edge 验证 Dashboard 启动渲染，并隔离用户数据 |
| `scripts/run-tauri-build.js` | 唯一 release 构建入口 |
| `scripts/prepare-runtime-package.js` | 在系统临时目录准备裁剪后的生产运行时 |
| `scripts/check-bundle-patches.js` | 检查本地补丁、品牌和构建身份 |
| `scripts/verify-release-resources.js` | 校验 exe 名和完整 release 资源树 |
| `scripts/verify-nsis-bundle.js` | 解包并校验 NSIS 安装包 |
| `scripts/release-check.js` | 完整发布前检查 |

## 维护边界

- `src-tauri/resources/server/visionox-pkg/` 包含本项目直接维护的 Dashboard 和服务端补丁。
- `visionox-pkg` 下的 JavaScript bundle 必须纳入 Git；source map 不作为源码或交付资源保留，不能用于覆盖当前 bundle。
- 普通 `restore:pkg` 与 `fetch:binaries` 入口默认禁用。
- 上游包恢复或网络下载只能在明确授权后使用危险维护入口。
- 不从旧安装、AppData、历史 build、source map 或备份目录覆盖当前源码。

## 平台状态

当前交付与本机验证锚点是 Windows release。仓库保留 Linux 配置，但 Linux 构建依赖和验证流程应以 [开发指南](docs/DEVELOPMENT.md) 为准；本 README 不声明未经当前环境验证的 Linux 产物。

## 文档

- [用户指南](docs/USER_GUIDE.md)
- [功能说明](docs/FEATURES.md)
- [架构说明](docs/ARCHITECTURE.md)
- [开发指南](docs/DEVELOPMENT.md)
- [质量门禁](docs/QUALITY.md)
- [OfficeCLI 指南](docs/OFFICECLI_GUIDE.md)
- [更新日志](docs/CHANGELOG.md)

## License

MIT
