# Visionox 更新日志

> 本文档记录 Visionox Desktop 各版本面向用户的功能变更。

---

## v1.11.0（开发中）

### 报告生成优化

- 报告标题格式改为「{日期} Visionox {日报/周报}」（如 `2026-07-03 Visionox 日报`）
- 报告提示词拆分为**默认提示词**（随版本更新）+ **用户追加指令**（跨升级保留），解决升级覆盖问题
- 首次生成报告时自动迁移旧版自定义提示词为追加指令（LLM 辅助提取差异）
- 报告严格基于历史会话记录生成，不主动读取工作区文件；信息缺失时如实说明而非编造
- 前端「报告提示词」编辑器拆分为只读默认区 + 可编辑追加区
- 报告生成排除 `.events.jsonl` 噪声文件，预览→生成增加 30s 缓存消除双读
- `/report` 斜杠命令改为调用异步报告引擎，不再阻塞事件循环

### 8 层记忆系统修复

- **L1 项目记忆注入修复**：`buildLoop` 现在正确调用 `applyProjectMemory`，`REASONIX.md`/`visionox.md`/`CLAUDE.md`/`AGENTS.md` 等项目记忆文件在新对话中自动注入（此前因未导入该函数而缺失）
- **L6/L7 注入顺序统一**：技能索引（L6）现在在持久记忆（L7）之前注入，与文档描述一致
- README 8 层描述补充 L8 会话记忆

### 工作模式即时切换

- Dashboard 切换工作模式后**立即重建 loop**，下一条消息即生效（此前需 `/new` 才刷新，且 `/status` 会谎报新模式）
- 技能索引按当前模式标注 ⭐ 推荐技能，消除「Relevant skills」提示与技能目录的矛盾信号
- Work mode 块增加护栏声明：模式提示与 soul 身份冲突时以 soul 为准

### 性能优化（第一梯队）

- **config 读取缓存**：`readConfig` 增加 mtime 缓存，消除每次工具调用权限检查的同步读盘（`loadEditMode`/`loadProjectShellAllowed` 等），单 turn 减少 10+ 次 `readFileSync`+`JSON.parse`
- **buildLoop 前缀记忆化**：系统提示词静态前缀按源文件 mtime 指纹缓存，`/new`、切模式、旁路问句等 11 个调用点命中缓存时跳过 `loadRules`/`applySkillsIndex`/`loadSoul` 等全部磁盘读取
- **bootstrap 技能 hash 优化**：启动时通过 marker 中的 `sourceMtime` 跳过未变更技能源目录的全量 hash，稳态启动零文件读取（此前每次启动读 58 个文件）
- **active-session 持久流**：会话自动保存改用持久 `WriteStream` 替代每条消息 `appendFile`（open/write/close 三连），user 消息不再被磁盘 I/O 阻塞

### 性能优化（第二梯队）

- **升级首字延迟优化**：`autoEscalate` 的标记检测缓冲从 256 字符改为首行检测（检测到换行即 flush），常见路径首字延迟从「最多 256 字符」降到「最多一行」，检测语义不变
- `NEEDS_PRO_BUFFER_CHARS` 支持环境变量 `visionox_NEEDS_PRO_BUFFER_CHARS` 覆盖
- 升级时被丢弃的 flash 请求 token 成本现在计入统计（此前 `usage=null` 完全隐藏）
- **session memory 子预算**：每条 body 上限 2000 字符，集体块上限 6000 字符（超限丢最旧整条），防止模型写入的临时记忆膨胀提示词
- **rules 子预算**：编码规则集体上限 12000 字符（超限从 custom 起尾弃整条），防止 coding 模式加载 ~100KB 规则

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
