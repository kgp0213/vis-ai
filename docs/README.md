# Visionox-Whale 文档

> 适用版本：1.28.0。这里仅保留当前仍有独立维护价值的文档，避免按单个功能重复建立说明。

## 用户与运维

| 文档 | 唯一职责 |
|---|---|
| [用户指南](USER_GUIDE.md) | 产品入口、记忆、模式、会话、搜索和常用操作 |
| [OfficeCLI 指南](OFFICECLI_GUIDE.md) | 内置 OfficeCLI 的使用、工作流与排障 |
| [更新日志](CHANGELOG.md) | 按版本记录已经交付的变更 |

## 工程与交付

| 文档 | 唯一职责 |
|---|---|
| [架构说明](ARCHITECTURE.md) | 系统边界、运行资源、数据保护、长期决策、技术债和 Windows 专项集成 |
| [开发指南](DEVELOPMENT.md) | 环境、调试、编码、样式和规范构建入口 |
| [质量门禁](QUALITY.md) | 完成标准、测试组织、提交门禁和 release 门禁 |
| [发布验收清单](RELEASE_CHECKLIST.md) | exe/NSIS 每次交付时填写的操作清单与哈希记录 |
| [Dashboard 功能基线](DASHBOARD_PARITY.md) | 当前 bundle 功能基线与迁移到可重建源码的验收条件 |
| [Skill 创建指南](skill-creation-guide.md) | 自定义 Skill 的开发与分发流程 |

## 维护规则

- 功能使用说明进入 `USER_GUIDE.md`，不要新建重复的功能清单。
- 系统边界和长期技术决定进入 `ARCHITECTURE.md`，评审报告不作为长期独立文档保留。
- 测试规则进入 `QUALITY.md`，构建步骤进入 `DEVELOPMENT.md`，交付操作进入 `RELEASE_CHECKLIST.md`。
- 源码、CSS 变量、提交数量、源码行号和外部价格不复制到文档；引用其规范来源。
- 版本号以 `Cargo.toml`、`package.json` 和 `tauri.conf.json` 三处一致为准。
- 新增文档前先确认现有文档无法承载该内容；一次性问题分析应留在提交或 Issue 中。

## 待办审查

| 文档 | 说明 |
|------|------|
| [技能可用性审查报告](技能可用性审查报告.md) | 全部 40 个 bootstrap 技能的部署、调用、依赖和平台兼容性审查（27 WORKS / 12 PARTIAL / 1 BROKEN） |
