# Visionox 更新日志

> 本文档记录 Visionox Desktop 各版本面向用户的功能变更。

---

## v1.11.0（开发中）

### `/learn` 学习命令

新增统一学习命令，在对话中把项目知识转化为 AI 可复用的长期能力：

| 命令 | 说明 |
|------|------|
| `/learn skill <目录>` | 扫描目录，调用 LLM 生成 SKILL.md 并安装 |
| `/learn project` | 扫描 workspace，更新项目记忆文件 |
| `/learn index <目录>` | 为目录构建语义索引 |
| `/learn ask <问题>` | 基于语义索引问答 |
| `/learn tutor` | 导师模式（苏格拉底/提示/结对/关闭） |
| `/learn track` | 概念库 + SM-2 间隔重复学习追踪 |

---

## v1.10.0（2026-06-26）

### 模型配置 JSON 导入

对话框底部「🤖 模型」面板支持 JSON 文件批量导入/更新 Provider 配置，方便多设备间同步。

### 剪贴板粘贴增强

- `Ctrl+V` 粘贴图片/截图自动添加为附件
- `Ctrl+V` 粘贴文件/文件夹自动贴入完整本地路径
- 支持更多 Windows 剪贴板格式，OneDrive/Outlook/远程桌面等复杂场景成功率更高

### Superpowers 技能包内置

安装包自带 14 个 Superpowers 工作流技能（需求梳理、方案规划、TDD、系统调试等），安装后自动可用。

### WebView2 刷新修复

修复 iframe 方案下 F5/右键刷新卡死问题，三层恢复机制确保刷新后自动重建 dashboard。

### OfficeCLI 正式内置

`officecli.exe` 纳入安装包，启动时自动注入 MCP，办公模式开箱即用。

---

## v1.0.2（2026-06-25）

### WebView2 刷新卡死修复

修复 F5 刷新后页面永久停在 "Starting server..." 的问题。通过 localStorage 后备 + Rust 兜底 + iframe 失败回退三层恢复。

### effort 推理强度日志

切换 high/max 推理强度时，运行日志面板输出对应信息。

---

## v1.0.1（2026-06-23）

### OfficeCLI 集成

- 内置 `officecli.exe` v1.0.117，支持 Word/Excel/PPT 原生操作
- 办公模式默认使用 OfficeCLI 替代 6 个旧 Office 技能
- MCP stdio 桥接约 20 个工具到 Agent

### 办公室模式重构

办公模式 skills 精简为 4 个（officecli + 3 个 PDF 技能），prompt 更新引导 Agent 优先使用 MCP。

---

## v1.0.0（2026-06-22）

### 首个正式版本

- 基于上游 v0.47.1 构建
- Tauri v2 + WebView2 桌面壳
- 33+ 内置工具（文件/Shell/Web/Memory/MCP）
- 4 种工作模式（通用/编程/办公/设计）
- 8 层记忆系统
- 8 套配色方案
- 4 引擎搜索热切换
- 会话管理（保存/删除/继续）
- 品牌化 UI（Visionox 标识 + 中文字体优化）
- Windows NSIS 安装器

### 架构升级

从 Tauri v1 升级到 v2，采用 `generate_context!()` + `WebviewUrl::App` 架构。
