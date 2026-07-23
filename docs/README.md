# Visionox-Whale 文档

> 适用版本：1.28.0。产品行为以当前源码和自动化测试为准，文档不保留已经退役的流程副本。

## 用户文档

| 文档 | 适用对象与职责 |
|---|---|
| [快速上手](快速上手.md) | 新用户完成安装、模型导入、检测和第一次对话 |
| [用户指南](USER_GUIDE.md) | 当前界面入口、两种工作模式、记忆、文档、任务、模型和排障 |
| [V来家操作指南](V来家操作指南.md) | V来家登录、只读查询、确认写入、定时整理和 Skill 定制 |
| [模型配置 JSON 参数说明](模型配置JSON参数说明.md) | 维护人员新增、更新、停用模型以及配置推理参数 |
| [Skill 创建指南](skill-creation-guide.md) | 自定义 Skill 的开发、校验和分发 |
| [更新日志](CHANGELOG.md) | 按版本记录已经交付的变化；历史行为不代表当前仍启用 |

OfficeCLI、API Key 更新和模型导入已并入[用户指南](USER_GUIDE.md)，不再维护重复的独立手册。

## 工程文档

| 文档 | 唯一职责 |
|---|---|
| [架构说明](ARCHITECTURE.md) | 当前运行边界、唯一模型循环、资源与数据保护 |
| [开发指南](DEVELOPMENT.md) | 开发环境、脚本、调试和编码约束 |
| [质量门禁](QUALITY.md) | 测试组织、完成标准和提交门禁 |
| [发布验收清单](RELEASE_CHECKLIST.md) | release exe 与 NSIS 的人工交付检查 |
| [Dashboard 功能基线](DASHBOARD_PARITY.md) | 维护当前 bundle 或迁移可读源码时必须保留的行为 |

Launcher 的长期模块边界已经写入[架构说明](ARCHITECTURE.md#launcher-模块边界)。旧的按行号拆分路线图不再单独维护。

## 维护规则

- 用户入口和常见排障进入 `USER_GUIDE.md`；只有 V来家、模型 JSON、Skill 这类独立受众才单独成文。
- 当前系统边界进入 `ARCHITECTURE.md`，测试规则进入 `QUALITY.md`，构建命令进入 `DEVELOPMENT.md`。
- 一次性问题分析、过期路线图和导出的 HTML 副本不进入长期文档。
- `package.json`、运行时源码、API 契约和构建脚本是事实来源；易变化的文件数、哈希和源码行号不手工复制。
- 本地 Provider JSON 可能含凭据，已由 Git 忽略，不属于项目文档。
