# Visionox UI 优化计划

本文按收益、风险和投入产出比排列 Dashboard UI 与相关功能代码的优化项。

## S 级：优先做

| 项目 | 收益 | 风险 | 投入 | 说明 |
|------|------|------|------|------|
| 恢复源码级 UI 结构 | 极高 | 中 | 中高 | 长期停止手改 `dist/app.js`，恢复 `src/panels/*`、`src/components/*` 后再构建产物。 |
| 统一 CSS 变量体系 | 高 | 低 | 低 | 新 token 与旧变量混用，先补兼容 alias，降低局部样式失效风险。 |
| Memory 页面增加新增长期记忆入口 | 高 | 低 | 中 | 降低“如何让 AI 长期记住”的使用门槛。 |

## A 级：下一轮做

| 项目 | 收益 | 风险 | 投入 | 说明 |
|------|------|------|------|------|
| 重构 Chat 顶部控制区 | 高 | 中 | 中 | 将工作模式摘要、effort、preset、edit mode 拆成更清晰的上下文区和控制区。 |
| 清理 Chat composer inline style | 中高 | 低中 | 中 | 技能、工作空间、popover 抽成组件，提升稳定性。 |
| 增强 mode-memory API 校验 | 中高 | 低 | 低 | 未知 mode 返回 400，避免偏好静默写入 `general`。 |

## B 级：体验改善

| 项目 | 收益 | 风险 | 投入 | 说明 |
|------|------|------|------|------|
| clickable span 改为 button | 中 | 低 | 中 | 补键盘操作、焦点态和 `aria-label`。 |
| 原生 confirm/prompt 改应用内 Modal | 中 | 低中 | 中 | 删除、切换、路径输入体验更统一。 |
| `.card:hover` 改为 `.card.interactive:hover` | 中 | 低 | 低 | 避免非点击卡片产生可点击错觉。 |

## C 级：长期整理

| 项目 | 收益 | 风险 | 投入 | 说明 |
|------|------|------|------|------|
| Settings 分组 Tab 或二级导航 | 中 | 中 | 中高 | Settings 功能继续增长后再整理。 |
| 统一 loading/error/empty 组件 | 中 | 低 | 中 | 减少各面板重复样式。 |
| 优化主题色板 | 低中 | 低 | 中 | 视觉精修，优先级低于结构和记忆入口。 |

## 当前执行批次

本批次先处理：

1. CSS 变量兼容层。
2. mode-memory API mode 校验。
3. 精准化 `.card:hover`。
4. Memory 页面增加长期记忆/项目记忆新增入口，并确保保存后更新 `MEMORY.md` 索引。

## 长期记忆中心扩展

“配置 → 记忆”页面应作为统一的长期记忆中心，展示并管理：

- `~/.visionox/soul.md`：AI 身份、人格、名称和长期风格，优先级最高。
- `~/.visionox/memory/global/*.md`：跨项目长期记忆。
- `~/.visionox/memory/<project-hash>/*.md`：当前项目长期记忆。
- `~/.visionox/mode-memory/{mode}.json`：按工作模式隔离的场景记忆、偏好和常用知识点。
- workspace 项目说明记忆：`visionox.md` / `REASONIX.md` / `CLAUDE.md` / `AGENTS.md` 等。

AI name 不单独存入配置项，而是写入 `soul.md` 受控区块：

```md
<!-- visionox:soul:name:start -->
你的名字是 Visionox。
<!-- visionox:soul:name:end -->
```

这样身份信息与 soul 层保持一致，不会分散到普通 memory、mode prompt 或独立 config 字段。
