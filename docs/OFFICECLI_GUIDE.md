# OfficeCLI 办公指南

> OfficeCLI 1.0.135 已集成到 Visionox，办公模式下自动可用。

---

## 一、简介

OfficeCLI 是专为 AI Agent 设计的 Office 文档 CLI 工具，支持：

- **Word (.docx)**：创建文档、读写内容、设置格式
- **Excel (.xlsx)**：创建表格、读写数据、公式计算
- **PowerPoint (.pptx)**：创建演示文稿、编辑幻灯片

办公模式下，Visionox 默认通过 MCP stdio 协议接入 OfficeCLI，直接操作 Office 文档。

内置二进制来自公开上游 [iOfficeAI/OfficeCLI](https://github.com/iOfficeAI/OfficeCLI)，版本、大小、
SHA-256 和许可证记录在运行时资源清单中。普通启动和构建不会联网下载 OfficeCLI。

---

## 二、使用方式

### 2.1 自动模式（默认）

安装 Visionox 后，办公模式下自动可用。在对话中直接描述需求即可：

- "帮我创建一个 Excel 表格，汇总本月的销售数据"
- "把这个 Word 文档中的表格数据提取出来"
- "生成一份项目周报的 PPT"

### 2.2 手动配置

如需指定自定义 OfficeCLI 路径，编辑 `%USERPROFILE%\.visionox\config.json`：

```json
{
  "mcp": ["officecli=你的路径/officecli.exe mcp"]
}
```

重启 Visionox 后生效。Dashboard 的 MCP 面板会显示 `officecli` server 和工具列表。

---

## 三、与旧 Office 技能的区别

| 方面 | OfficeCLI MCP | 旧 Office 技能 |
|------|---------------|---------------|
| 实现方式 | 单个 C# 二进制，MCP 协议 | 6 个独立 Python/Node.js 脚本 |
| 覆盖格式 | Word + Excel + PPT | 各技能独立，格式分散 |
| 安装 | 内置，无需配置 | 需安装 Python 依赖 |
| 稳定性 | 单一二进制，无依赖冲突 | 多脚本多依赖，兼容性复杂 |

办公模式已默认使用 OfficeCLI 替换以下旧技能：`docx`、`xlsx`、`pptx`、`pptx-generator`、`visionox-excel-pro`、`minimax-xlsx`。

---

## 四、PDF 相关功能

PDF 相关技能在办公模式中继续保留：

| 技能 | 用途 |
|------|------|
| 内部 PDF.js Adapter | 为受管任务提供 PDF 格式解码和页范围证据，不作为模型任务入口 |
| `pdf` | PDF 创建、编辑、合并、拆分、表单与校验 |
| `md-to-pdf-cjk` | Markdown 转 PDF（支持中文） |

OfficeCLI 不处理 PDF。`prepare_local_document` 为本地文档生成稳定引用，跨工具切换时复用同一 documentRef；
长输出由宿主通过 `context-input-transaction` 分段回收。`md-to-pdf-cjk` 是单向生成工具，不能作为现有 PDF 读取失败后的备用解析器。

需要把现有 PDF、Word、Excel、PowerPoint、HTML 或文本保存为 Markdown 时，先用 `prepare_local_document`
取得 documentRef，再用对应格式读取器或 Skill 提取内容，最后用 `write_file`/`append_file` 写入目标。
OfficeCLI、PDF.js、`read_file`、`write_file` 和 `append_file` 都只是当前步骤的工具，不形成独立任务循环。

---

## 五、建议工作流

复杂 Office 操作优先让 Agent 先检查当前文档状态，再进行小批量修改：使用 `get`/`view` 确认对象，
用 batch 合并同一阶段操作，随后检查 issues、执行 validate，最后 save 并 close。这样能更早发现选择器、
公式或结构问题，也能减少重复启动和往返调用。

OfficeCLI MCP 会在 Dashboard 服务可用后后台初始化，不阻塞应用首屏。刚启动时 MCP 面板可能短暂显示
初始化中。

---

## 六、故障排查

**Q：MCP 面板没有显示 officecli？**

1. 检查 `resources/server/officecli.exe` 是否存在
2. 检查 `%USERPROFILE%\.visionox\logs\visionox-server-stderr.log` 查看启动日志
3. 如手动配置了路径，检查路径是否正确、是否含空格（需引号包裹）

**Q：OfficeCLI 操作报错？**

1. 确认目标文件未被其他程序（如 Word/Excel）占用
2. 检查文件路径是否可访问
3. 在对话中要求 AI 重试或换一种方式操作
