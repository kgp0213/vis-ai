# OfficeCLI 集成到 Visionox 说明文档

> **结论：已通过 MCP stdio 协议完成软集成（办公模式默认优先 OfficeCLI）。也支持进一步打包 OfficeCLI 二进制到安装包（硬集成），让用户开箱即用无需单独下载。**
>
> 最后更新：2026-06-27（1.10.0：officecli.exe 已纳入 tauri.conf.json bundle.resources，启动时自动注入 MCP）

---

## 1. 背景

### 1.1 Visionox Desktop（本仓库）

- 基于上游 DeepSeek 推理框架的 Tauri v2 Windows 桌面 AI 编程代理
- 技术栈：Rust（桌面壳）+ TypeScript/Node.js（AI Agent 运行时）+ WebView2（Dashboard SPA）
- 已具备完整的 **MCP 客户端基础设施**，支持 stdio / SSE / Streamable HTTP 三种传输
- 现有 4 种工作模式：通用 / 编程 / 办公 / 设计
- 办公模式原有 6 个基于 Python/Node.js 的 Office 技能：`docx`、`xlsx`、`pptx`、`pptx-generator`、`visionox-excel-pro`、`minimax-xlsx`

### 1.2 本仓库落地策略

- 办公模式已改为默认优先使用 OfficeCLI MCP 处理 Word / Excel / PowerPoint
- 启动时自动发现内置 `resources/server/officecli.exe`；未内置二进制时不自动执行 Windows `PATH` 中的 `officecli`，需用户手动配置 MCP
- 自动注入运行时 MCP spec，不强制写入 `config.mcp`，避免用户配置出现过期路径或未安装环境启动失败
- 办公模式默认用 `officecli` 替换 `docx`、`xlsx`、`pptx`、`pptx-generator`、`visionox-excel-pro`、`minimax-xlsx` 六个旧 Office 技能；保留 PDF 相关技能

### 1.3 OfficeCLI（已集成）

- 仓库：[github.com/iOfficeAI/OfficeCLI](https://github.com/iOfficeAI/OfficeCLI)
- 定位：为 AI Agent 设计的 Office 文档 CLI 工具
- 技术栈：C# (.NET)，编译为单二进制文件，无依赖
- 覆盖格式：Word (.docx)、Excel (.xlsx)、PowerPoint (.pptx)
- 内置 **MCP Server**（`officecli mcp`），暴露 ~20 个工具
- 许可证：Apache 2.0

---

## 2. 集成方案对比

| 方案 | 改动量 | 原理 | 推荐度 |
|------|--------|------|--------|
| **A. MCP stdio 协议** | 一行 JSON 配置 | Visionox 通过 stdio 启动 `officecli mcp`，MCP 工具自动桥接至 Agent 工具列表 | ⭐⭐⭐ **强烈推荐** |
| B. 安装为 Skill | 下载 SKILL.md + 配置 mode | Agent 通过 shell 工具间接调用 `officecli` 命令 | ⭐⭐ 备选 |
| C. 直接 CLI 调用 | 无需配置 | 聊天中直接让 Agent 执行 `officecli` 命令 | ⭐ 临时使用 |

---

## 3. 方案 A：MCP stdio（推荐）

### 3.1 架构

```
Visionox 启动
  │
  ├─ config.mcp[] 读取 "officecli=officecli mcp"
  │
  ├─ parseMcpSpec() → 识别为 stdio 传输
  ├─ buildTransportFromSpec() → 建立子进程通信
  ├─ McpClient.initialize() → MCP 握手
  ├─ inspectMcpServer() → 获取工具清单
  │     │
  │     ├─ create
  │     ├─ view
  │     ├─ get / query
  │     ├─ set / add / remove / move / swap
  │     ├─ validate
  │     ├─ batch / dump / merge
  │     ├─ watch
  │     ├─ raw / raw-set
  │     ├─ open / close
  │     └─ ...
  │
  └─ bridgeMcpTools() → 桥接到统一 ToolRegistry
        │
        ▼
  AI Agent 直接调用 OfficeCLI 工具（JSON-RPC，无 shell 开销）
```

### 3.2 操作步骤

#### 第 1 步：安装 OfficeCLI 二进制

```powershell
# Windows (PowerShell)
# 推荐从 OfficeCLI Release 页面下载固定版本安装包，并核对发布页提供的校验信息后安装。
# 如需使用官方脚本，先下载到本地审阅内容，再执行。
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/iOfficeAI/OfficeCLI/main/install.ps1" -OutFile "$env:TEMP\officecli-install.ps1"
notepad "$env:TEMP\officecli-install.ps1"
powershell -ExecutionPolicy Bypass -File "$env:TEMP\officecli-install.ps1"

# 验证安装
officecli --version
```

#### 第 2 步：修改 Visionox 配置

编辑 `%USERPROFILE%\.visionox\config.json`，添加 `mcp` 字段：

```json
{
  "mcp": [
    "officecli=officecli mcp"
  ]
}
```

如果需要传递环境变量：

```json
{
  "mcp": [
    "officecli=officecli mcp"
  ],
  "mcpEnv": {
    "officecli": {
      "OFFICECLI_SKIP_UPDATE": "0"
    }
  }
}
```

#### 第 3 步：更新办公模式 skills 配置（可选）

将 `modes.office.skills` 中的 Office 相关 Python 技能替换为 `officecli`（MCP 工具已自动注入，此步骤为可选优化，让 Agent 明确知道优先使用 OfficeCLI）：

```json
{
  "modes": {
    "office": {
      "skills": [
        "officecli",
        "pdf",
        "pdf-extract",
        "md-to-pdf-cjk"
      ],
      "prompt": "你处于办公模式。OfficeCLI（Word/Excel/PPT）已通过 MCP 工具注入，可直接使用 create/view/get/query/set/add/remove/move/validate/batch/merge/watch 等工具操作 Office 文档。输出前先 validate 检查质量，通过 view issues 定位问题并自修复。PDF 仍使用 pdf/pdf-extract 等专项技能。"
    }
  }
}
```

#### 第 4 步：重启 Visionox

重启后 Dashboard 的 MCP 面板将显示 `officecli` 服务器及其工具列表。Agent 在办公模式下可直接调用 OfficeCLI 工具。

---

## 4. 方案 B：Skill 方式（备选）

如果暂时不想配置 MCP，可以手动安装 SKILL.md 为 Visionox skill：

```powershell
mkdir -p "$env:USERPROFILE\.visionox\skills\officecli"
Invoke-WebRequest -Uri "https://officecli.ai/SKILL.md" `
  -OutFile "$env:USERPROFILE\.visionox\skills\officecli\SKILL.md"
```

然后在 `config.json` 的 `modes.office.skills` 中添加 `"officecli"`。

**局限**：Agent 通过 shell 工具间接调用，每次调用需启动子进程，且需解析文本输出（`--json` 标志可缓解）。

---

## 5. 能力对比：OfficeCLI vs 现有 Python 技能

| 功能 | 现有技能 | OfficeCLI | 优势说明 |
|------|---------|-----------|----------|
| Word 读取/编辑 | python-docx + pandoc | ✅ | 路径寻址 `/body/p[1]`，CSS 式查询，Track Changes |
| Excel 读取/编辑 | openpyxl | ✅ | 150+ 公式引擎自动求值，数据透视表，排序/筛选 |
| PPT 读取/编辑 | python-pptx | ✅ | 动画/过渡/3D 模型/SmartArt/图表 |
| 模板合并 `{{key}}` | ❌ 无 | ✅ `merge` | JSON 数据驱动批量生成 |
| 文档渲染预览 | ❌ 无 | ✅ `view html/screenshot` | Agent 可视化检查输出 |
| 公式引擎 | ❌ 无 | ✅ 内置 150+ 函数 | 写入即求值，无需 Excel |
| 文档验证 | ❌ 无 | ✅ `validate` + `view issues` | 自动检测格式问题 + 建议修复 |
| 结构化错误 | ❌ 无 | ✅ `not_found`/`invalid_value` 等 | Agent 自主纠错 |
| MCP 原生支持 | ❌ 无 | ✅ `officecli mcp` | JSON-RPC 工具，零 shell 开销 |
| 跨平台单二进制 | ❌ 需 Python + pip | ✅ .NET 自包含 | 无依赖部署 |
| CSV 导入 | ✅ pandas | ✅ `--prop csv=` | 原生支持 |
| 批量操作 | ❌ 逐文件处理 | ✅ `batch` 一次打开/保存 | 多操作原子提交 |
| 常驻模式 | ❌ 无 | ✅ `open`/`close` | 多步操作内存驻留，命名管道通信 |

**建议**：用 OfficeCLI 替换 `docx`、`xlsx`、`pptx`、`pptx-generator`、`visionox-excel-pro`、`minimax-xlsx` 六个 Python 技能；保留 `pdf`、`pdf-extract`、`pdfkit-py`、`md-to-pdf-cjk`（OfficeCLI 不处理 PDF）。

---

## 6. MCP 工具清单

集成后，以下工具将出现在 Agent 的工具列表中：

| 工具名 | 功能 | 示例 |
|--------|------|------|
| `create` | 创建空白 Office 文件 | `create deck.pptx` |
| `view` | 查看文档内容/结构/问题/渲染 | `view report.docx outline` |
| `get` | 获取元素及其子元素（支持 `--depth N`, `--json`） | `get deck.pptx /slide[1] --json` |
| `query` | CSS 式查询元素 | `query report.docx "run:contains(TODO)"` |
| `set` | 修改元素属性 | `set deck.pptx /slide[1]/shape[1] --prop text="Hello"` |
| `add` | 添加元素 | `add deck.pptx / --type slide --prop title="Q4"` |
| `remove` | 删除元素 | `remove report.docx /body/p[5]` |
| `move` | 移动元素 | `move report.docx /body/p[5] --to /body --index 1` |
| `swap` | 交换两个元素 | — |
| `validate` | OpenXML 模式验证 | `validate report.docx` |
| `batch` | 批量操作（单次打开/保存） | `batch deck.pptx --commands '[...]'` |
| `dump` | 序列化文档为可重放 JSON | `dump existing.docx -o blueprint.json` |
| `merge` | 模板合并 `{{key}}` 占位符 | `merge template.docx out.docx data.json` |
| `watch` | 实时 HTML 预览 + 自动刷新 | `watch deck.pptx` |
| `raw` | 查看原始 XML | `raw deck.pptx /slide[1]` |
| `raw-set` | XPath 原始 XML 修改 | — |
| `open` / `close` | 常驻模式（文档驻留内存） | `open report.docx` |
| `mcp` | MCP 注册与管理 | `mcp list` |

---

## 7. 打包内置方案（已落地）

> 当前状态：已将 OfficeCLI 二进制纳入运行资源，并在启动时自动注入 OfficeCLI MCP；用户仍可通过 `config.mcp` 手动覆盖为自装版本。

### 7.1 内置自动注入 vs 手动覆盖

| 维度 | 内置自动注入 | 手动覆盖 |
|------|---------------|----------|
| 用户体验 | 开箱即用，零配置 | 需用户配置 `config.mcp` |
| 安装包体积 | +50~80 MB（.NET 自包含二进制） | 无额外体积 |
| 维护成本 | Visionox 发版时跟进 OfficeCLI 版本 | 用户自行更新 |
| 版本锁定 | Visionox 打包时固定版本 | 用户自选 |
| 离线可用 | ✅ 完全离线可用 | 首次需用户自行准备二进制 |
| MCP 配置 | 启动时自动注入，不写回配置 | 用户手动写 `config.json` |
| 许可证合规 | 需附带 NOTICE / THIRD-PARTY-NOTICES.txt | 不分发 OfficeCLI |

### 7.2 实施步骤

#### 第 1 步：下载 OfficeCLI 二进制到 resources

```powershell
$url = "https://github.com/iOfficeAI/OfficeCLI/releases/latest/download/officecli-win-x64.exe"
$dest = "src-tauri/resources/server/officecli.exe"
Invoke-WebRequest -Uri $url -OutFile $dest
```

> Apache 2.0 许可允许再分发。同时应从 OfficeCLI 仓库复制 `NOTICE` 和 `THIRD-PARTY-NOTICES.txt` 到 `src-tauri/resources/`。

#### 第 2 步：更新 tauri.conf.json

在 `bundle.resources` 数组中添加（约第 22–27 行）：

```json
"resources/server/officecli.exe"
```

同时添加许可证文件（可选但推荐）：

```json
"resources/NOTICE",
"resources/THIRD-PARTY-NOTICES.txt"
```

#### 第 3 步：launcher.mjs 添加 auto-MCP 注入逻辑

在配置初始化阶段（`config.mcp` 读取之后），检测打包的 OfficeCLI 二进制并生成运行时 MCP spec；自动发现结果只参与本次启动，不写回用户配置：

```js
function effectiveMcpSpecs(config) {
  const manualSpecs = (config.mcp ?? []).map((spec) => String(spec).trim()).filter(Boolean);
  if (manualSpecs.some((spec) => spec.toLowerCase().includes("officecli"))) return manualSpecs;

  const officecliExe = resolveBundledOfficecli();
  if (officecliExe) return [...manualSpecs, `officecli=${JSON.stringify(officecliExe)} mcp`];
  return manualSpecs;
}
```

> 打包态优先读取 `process.resourcesPath/server/officecli.exe`，开发态回退到源码 `src-tauri/resources/server/officecli.exe`；用户手动配置 `officecli` MCP 时自动注入会跳过，避免重复 server。未内置二进制时不自动执行 `PATH` 中的 `officecli`，需要用户在 `config.mcp` 中显式配置。

#### 第 4 步：（可选）添加 bootstrap skill 兜底

在 `src-tauri/resources/bootstrap-skills/officecli/` 创建 `SKILL.md`，内容精简自 `https://officecli.ai/SKILL.md`，当 MCP 无法启动时 Agent 仍知如何通过 shell 调用 `officecli`。

`tauri.conf.json` 已有 `"resources/bootstrap-skills/**/*"` 通配，新增目录自动包含。

### 7.3 开发态与打包态兼容

| 运行模式 | officecli.exe 来源 | 自动注入 |
|----------|-------------------|---------|
| `npm run tauri:dev` | 需手动放入 `src-tauri/resources/server/` | `process.resourcesPath` 为空 → fallback 到源码路径 |
| `npm run tauri:build` 安装后 | NSIS 安装器释放到安装目录 | `process.resourcesPath` 指向安装目录 → 自动注入 |
| 开发时单独测 launcher.mjs | 同上源码路径检测 | 同上 |

### 7.4 推荐策略

**混合方案**（兼顾离线体验与灵活性）：

1. **打包阶段**：执行第 1–2 步，将 officecli.exe 装入安装包
2. **运行时**：执行第 3 步 auto-MCP 逻辑启动时自动注入
3. **兜底**：执行第 4 步 bootstrap skill，MCP 失败时任可用 shell
4. **保留手动覆盖**：用户若在 `config.mcp` 手动配置了其他 `officecli` 路径（如自己安装的新版），auto-MCP 跳过不覆盖

---

## 8. 风险与注意事项

| 风险 | 级别 | 说明 | 应对 |
|------|------|------|------|
| OfficeCLI 进程崩溃 | 低 | 独立子进程，崩溃不影响 Visionox 主进程 | Visionox 的 `reloadMcp()` 可重新连接 |
| 未内置 OfficeCLI | 中 | 未内置且未手动配置 `mcp` 时，MCP 面板不会显示 `officecli` | 优先检查内置 `resources/server/officecli.exe`；如需使用 PATH 或自定义路径，在 `config.mcp` 中显式配置并验证 `officecli --version` |
| 自动注入不写配置 | 低 | 自动发现只影响当前运行时，不会改写用户 `config.mcp` | Dashboard MCP 面板和启动日志用于验证；需要固定自定义路径时手动配置 `mcp` |
| 版本兼容性 | 低 | OfficeCLI MCP 协议稳定 | 锁定版本，升级前测试 |
| 性能开销 | 极低 | stdio JSON-RPC，延迟 < 50ms（不含文件 I/O） | 可忽略 |
| 许可证冲突 | 无 | MIT（Visionox） + Apache 2.0（OfficeCLI）兼容 | 若后续打包二进制，再补充 Apache 2.0 NOTICE |
| 大文件处理 | 中 | 极大型文档可能耗时长 | Agent 已知晓 OfficeCLI 限制，可自主分步处理 |
| 旧技能替换 | 低 | 默认办公模式不再加载 6 个旧 Office 技能 | 用户自定义 mode 会按现有迁移策略保留/备份，PDF 技能继续保留 |

---

## 9. 验证清单

集成后验证以下场景：

- [ ] 内置 `resources/server/officecli.exe` 存在，或用户已在 `config.mcp` 中显式配置可用的 OfficeCLI MCP spec
- [ ] 未手动配置 `mcp` 时，Visionox 启动日志显示自动注入 `officecli` MCP，且不会改写 `%USERPROFILE%\.visionox\config.json`
- [ ] 如需手动覆盖路径，`%USERPROFILE%\.visionox\config.json` 可配置 `"officecli=officecli mcp"`，且不会重复注入第二个 `officecli` server
- [ ] 办公模式下 Agent 能创建 `.pptx` 文件：`"帮我创建一个标题为'测试报告'的PPT"`
- [ ] Agent 能读取现有 `.docx` 内容
- [ ] Agent 能修改 `.xlsx` 并验证公式
- [ ] Agent 能使用 `validate` + `view issues` 自检并修复问题
- [ ] OfficeCLI 进程异常退出后 Visionox 正常运行（不崩溃）
- [ ] `reloadMcp()` 能重新连接 OfficeCLI

---

## 10. 相关文件路径参考

| 文件 | 路径 |
|------|------|
| Visionox 配置 | `%USERPROFILE%\.visionox\config.json` |
| Visionox 环境变量 | `%USERPROFILE%\.visionox\.env` |
| Launcher 入口 | `src-tauri/resources/server/launcher.mjs` |
| MCP 代码（工具桥接） | `src-tauri/resources/server/visionox-pkg/dist/cli/*.js` |
| OfficeCLI 安装目录 | `%USERPROFILE%\.officecli\` |
| OfficeCLI 配置 | `%USERPROFILE%\.officecli\config.json` |
| OfficeCLI SKILL.md | `https://officecli.ai/SKILL.md` |
| OfficeCLI 仓库 | `https://github.com/iOfficeAI/OfficeCLI` |

---

## 11. 参考

- OfficeCLI 官方文档：[officecli.ai](https://officecli.ai)
- OfficeCLI Wiki：按格式分类详细指南（Word / Excel / PowerPoint）
- MCP 协议规范：[modelcontextprotocol.io](https://modelcontextprotocol.io)
- Visionox 架构文档：`docs/` 目录下各文档

---

> **总结：一行配置 `"officecli=officecli mcp"` 即可完成集成。OfficeCLI 替代 6 个 Python Office 技能，提供更强的能力、更好的 Agent 自愈性、更少的依赖。**
