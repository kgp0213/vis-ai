# Visionox 功能详解

> 应用版本：1.10.0

---

## 一、8 层记忆系统

每次 `/new` 重建上下文时，按顺序加载：

| 层 | 来源 | 用途 |
|----|------|------|
| L0 Soul | `~/.visionox/soul.md` | AI 身份与行为准则 |
| L1 Project | `workspace/{REASONIX,visionox,CLAUDE,AGENTS}.md` | 项目专属信息（自动注入） |
| L2 Mode | `config.json` → `modes[mode].prompt` | 场景行为指令 |
| L3 Mode Memory | `~/.visionox/mode-memory/{mode}.json` | 当前工作场景的长期记忆、偏好与知识点摘要 |
| L4 ECC Rules | `~/.claude/rules/ecc/{lang}/` | 编码规范（mode 控制） |
| L5 Custom Rules | `~/.visionox/rules/*.md` | 用户自定义规则 |
| L6 Skills | `~/.visionox/skills/*/SKILL.md` | 领域技术能力索引（按模式 ⭐ 标注推荐） |
| L7 Persistent | `~/.visionox/memory/*/MEMORY.md` | 跨会话持久记忆 |
| L8 Session | `remember_session` 工具（内存） | 当前对话临时上下文（每条≤2000字符，总量≤6000字符） |

> 注：L1 项目记忆会自动扫描 `REASONIX.md`、`visionox.md`、`.claude/CLAUDE.md`、`CLAUDE.md`、`AGENTS.md`、`AGENT.md` 并注入。工作模式切换后立即重建 loop 生效，无需 `/new`。

### 记忆触发话术

| 目标 | 推荐说法 | 存储位置 |
|------|----------|----------|
| 跨项目长期事实 | `请长期记住：我的常用称呼是……` | `~/.visionox/memory/global/` |
| 当前项目专属知识 | `请长期记住到当前项目记忆：这个项目的发布流程是……` | `~/.visionox/memory/<project-hash>/` |
| 当前场景回答习惯 | `请在编程场景下长期记住：8K点屏指通过 USB ADB 连接 RK3588 平台……` | `~/.visionox/mode-memory/{mode}.json` |
| 临时上下文 | `请临时记住：本轮先按方案 B 处理。` | 进程内存 |

Mode Memory 按工作模式隔离存储，注入时最多选取 8 条高优先级条目并压缩为摘要，避免提示词臃肿。

### 记忆初始化策略

| 目标 | 首次启动 | 覆盖策略 |
|------|----------|----------|
| `soul.md` | 从安装资源释放默认身份文件 | 仅当文件不存在或为空时写入 |
| `mode-memory/` | 创建工作场景记忆目录 | 已有 `{mode}.json` 不覆盖 |
| 全局/项目记忆 | 不安装默认值 | 用户通过 `remember` 生成 |

---

## 二、4 种工作模式

主界面右上角水平排列，切换后**立即生效**（下一条消息即使用新模式的提示词、记忆、规则和技能目录）：

| 模式 | 规则集 | 适用场景 |
|------|--------|----------|
| 通用 | common + rust | 日常问答、轻量排查 |
| 编程 | common + rust + ts + python | 代码开发、测试、审查 |
| 办公 | common | 文档、表格、PDF、报告 |
| 设计 | common | UI/UX、前端布局 |

> 技能索引会按当前模式在技能名前标注 ⭐ 推荐标记，其余技能仍可跨模式调用。

---

## 三、`/learn` 学习命令

把项目知识转化为 AI 的长期能力：

```text
/learn skill <目录> [名称]        # 技能萃取：把目录提炼为 SKILL.md 并安装
/learn project [名称]              # 项目 onboarding：扫描 workspace 并更新项目记忆
/learn index <目录>                # 知识库索引：为目录构建语义索引
/learn ask <问题>                  # 知识库问答：基于已索引内容提问
/learn tutor [socratic|hint|pair|off]     # 主动教学：切换导师风格
/learn track [on|senior|off|stats|due|add|review]  # 学习追踪：间隔重复与概念库
/learn status                      # 查看学习系统状态
```

详细用法见 [用户使用指南](USER_GUIDE.md)。

---

## 四、ECC 编码规范集成

集成了 [ECC](https://github.com/affaan-m/ECC) v2.0.0-rc.1 的 Skills 和 Rules：

| 组件 | 数量 | 位置 |
|------|------|------|
| Skills | 34+ 个编码类 | `~/.visionox/skills/` |
| Rules | 26 个文件 | `~/.claude/rules/ecc/{common,rust,ts,python}/` |
| Hooks | preTool/postTool | `launcher.mjs` 内置 |

---

## 五、编辑模式

| 模式 | 行为 |
|------|------|
| **review** | 文件操作需用户审批（默认） |
| **auto** | 自动执行常规操作，高风险仍需审批 |
| **yolo** | 全自动执行，仅限工作空间内 |
| **admin** | 无限制，可操作任意路径 |

---

## 六、搜索引擎

| 引擎 | 方式 | 免费 | 国内可用 |
|------|------|------|----------|
| Bing 国内版（默认） | 抓取 cn.bing.com | ✅ | ✅ |
| Mojeek | 抓取 mojeek.com | ✅ | ❌ |
| SearXNG | API 调用 | ✅ | 自部署 |
| Bing API | Bing Search API v7 | 1000次/月 | ✅ |

设置页可热切换，无需重启。

---

## 七、对话报告生成

导航栏「报告」面板可基于历史会话记录生成日报/周报/年度报告：

- **标题格式**：「{日期} Visionox {日报/周报}」（如 `2026-07-03 Visionox 日报`）
- **数据来源**：仅基于历史会话记录，不主动读取工作区文件；信息缺失时如实说明而非编造
- **提示词分离**：默认提示词（随版本更新）+ 用户追加指令（跨升级保留），升级不会覆盖用户自定义
- **旧版迁移**：首次生成报告时自动将旧版自定义提示词迁移为追加指令（LLM 辅助提取差异）
- **导出**：支持导出为 Markdown 文件
- `/report daily|weekly|yearly [YYYY-MM-DD]` 斜杠命令也可触发报告生成

---

## 八、模型配置 JSON 导入

对话框底部「🤖 模型」面板中可选择 JSON 文件批量导入/更新 Provider 配置。同 `id` 的 Provider 仅覆盖显式字段，其余字段保留。适用于多设备间同步模型配置。
