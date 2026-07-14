# Visionox-Whale 文档

> 适用版本：1.28.0。这里仅保留当前仍有独立维护价值的文档，避免按单个功能重复建立说明。

## 用户与运维

| 文档 | 唯一职责 |
|---|---|
| [快速上手](快速上手.md) | 新用户从安装、模型检测到第一次对话的最短路径 |
| [用户指南](USER_GUIDE.md) | 产品入口、记忆、模式、会话、搜索和常用操作 |
| [V来家操作指南](V来家操作指南.md) | 面向新手的 V来家登录、查询、确认写入、定时整理与 Skill 定制操作 |
| [OfficeCLI 指南](OFFICECLI_GUIDE.md) | 内置 OfficeCLI 的使用、工作流与排障 |
| [更新日志](CHANGELOG.md) | 按版本记录已经交付的变更 |
| [Qwen 思考与推理能力边界](qwen-thinking-reasoning-能力边界.md) | 公司 Qwen 的实测参数、JSON 请求契约、检测配置与升级边界 |
| [API Key 维护与更新指南](API-Key维护与更新指南.html) | 面向普通用户的凭据轮换、新电脑 JSON 导入与排障操作单 |

## 工程与交付

| 文档 | 唯一职责 |
|---|---|
| [架构说明](ARCHITECTURE.md) | 系统边界、运行资源、数据保护、长期决策、技术债和 Windows 专项集成 |
| [开发指南](DEVELOPMENT.md) | 环境、调试、编码、样式和规范构建入口 |
| [质量门禁](QUALITY.md) | 完成标准、测试组织、提交门禁和 release 门禁 |
| [发布验收清单](RELEASE_CHECKLIST.md) | exe/NSIS 每次交付时使用的操作清单与自动产物清单说明 |
| [Dashboard 功能基线](DASHBOARD_PARITY.md) | 当前 bundle 功能基线与迁移到可重建源码的验收条件 |
| [Launcher 模块化计划](LAUNCHER_MODULARIZATION_PLAN.md) | 按行为契约逐段拆分 Launcher 的实施顺序、边界与验收条件 |
| [Skill 创建指南](skill-creation-guide.md) | 自定义 Skill 的开发与分发流程 |

## 待办审查

| 文档 | 唯一职责 |
|---|---|
| [v1.28.0 发布前审查](发布前审查_v1.28.0.md) | 发布前的版本配置、已知问题状态、安全审计、Git 状态检查与行动清单 |

## 维护规则

- 完整功能说明进入 `USER_GUIDE.md`；只有面向特定用户流程的独立操作手册才单独成文，并在本页登记职责。
- 系统边界和长期技术决定进入 `ARCHITECTURE.md`，评审报告不作为长期独立文档保留。
- 测试规则进入 `QUALITY.md`，构建步骤进入 `DEVELOPMENT.md`，交付操作进入 `RELEASE_CHECKLIST.md`。
- 源码、CSS 变量、提交数量、源码行号和外部价格不复制到文档；引用其规范来源。
- 版本号以 `Cargo.toml`、`package.json` 和 `tauri.conf.json` 三处一致为准。
- 新增文档前先确认现有文档无法承载该内容；一次性问题分析应留在提交或 Issue 中。
