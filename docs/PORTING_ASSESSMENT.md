# Visionox vis-ai ← upstream reasonix 功能移植评估报告

> **评估日期**：2026-05-30  
> **当前基线**：reasonix v0.47.1 (2026-05-26)  
> **目标基线**：reasonix v0.53.2 (latest)  
> **版本跨度**：v0.47.1 → v0.53.2（约 6 个小版本）

---

## 1. 架构概览

```
vis-ai (本地项目)                         upstream reasonix (npm)
┌──────────────────────────────┐         ┌──────────────────────────┐
│  Tauri v2 桌面壳 (Rust)       │         │  CLI + TUI (Ink/React)   │
│  src-tauri/                   │         │  src/cli/                │
│  ├─ main.rs (窗口管理)        │         │  ├─ commands/            │
│  ├─ lib.rs  (sidecar 通信)    │         │  ├─ ui/                  │
│  └─ resources/server/         │         │  │  ├─ layout/           │
│       ├─ launcher.mjs (桥接)  │  ←──→  │  │  ├─ PlanConfirm.tsx   │
│       ├─ node.exe             │  基线   │  │  ├─ StatsPanel.tsx    │
│       └─ visionox-pkg/        │  v0.47.1│  │  └─ ...               │
│            ├─ dist/cli/*.js   │  ====== │  ├─ acp/                 │
│            ├─ dashboard/      │  npm包  │  ├─ mcp/                 │
│            │  ├─ index.html   │         │  ├─ telemetry/           │
│            │  ├─ app.css      │         │  ├─ server/              │
│            │  └─ dist/app.js  │         │  └─ ...                  │
│            └─ package.json    │         │                          │
└──────────────────────────────┘         └──────────────────────────┘
```

### 关键机制

1. **基线来源**：`visionox-pkg/` 通过 `npm pack reasonix@版本号` 解压得到，是 reasonix npm 发行包的完整拷贝
2. **定制方式**：Visionox 修改以 SEARCH/REPLACE 方式直接打在编译后的 JS chunk 文件（`.bak` 文件为原始备份）
3. **升级脚本**：`scripts/restore-visionox-pkg.js` 用于下载/切换基线版本
4. **补丁脚本**：`cherry-claude.cjs` 用于重新应用所有 Visionox 定制补丁
5. **launcher.mjs**：Tauri sidecar 与 Node.js server 之间的桥接层，独立于上游代码

---

## 2. 各功能点详细评估

### 2.1 ⭐ Cache 诊断 UI（高价值 · 低难度）

#### 功能描述

- `/cache-miss-report` 斜杠命令：分析最近 N 轮的 cache 命中/未命中情况
- `doctor --cache`：一键诊断 cache 效率
- Dashboard StatsPanel 显示 cache 命中率百分比（hover 展示详情）
- Prefix hash 证据收集，用于排查为什么 cache 未命中

#### 现状对比

| 维度 | vis-ai v0.47.1 | upstream v0.53.2 |
|------|:---:|:---:|
| 用量记录 (usage.jsonl) | ✅ | ✅ 增强 |
| cache hit/miss 字段 | ✅ | ✅ 字段更完善 |
| `/cache-miss-report` 命令 | ❌ | ✅ |
| `doctor --cache` 参数 | ❌ | ✅ |
| StatsPanel 显示 % | ❌ | ✅ |
| Prefix hash 证据 | ❌ | ✅ |

#### 涉及文件

| 上游源文件 | 目标文件 | 变更类型 |
|-----------|---------|---------|
| `src/telemetry/usage.ts` | `dist/cli/chunk-*.js` | 新增 `bucketCacheHitRatio()` 等函数 |
| `src/telemetry/stats.ts` | `dist/cli/chunk-*.js` | 新增 `cacheSavingsUsd()` |
| `src/cli/ui/StatsPanel.tsx` | `dashboard/dist/app.js` | 新增 cache 命中率图表行 |
| `src/server/api/usage.ts` | `dist/cli/server-*.js` | 新增 `/cache-miss-report` API |
| `src/cli/commands/doctor.ts` | `dist/cli/doctor-*.js` | 新增 `--cache` 诊断参数 |

#### 移植难度：★★☆☆☆（低-中）

- **原因**：变更集中在 telemetry 和 stats 模块，改动范围可控
- **风险点**：`dashboard/dist/app.js` 中的 StatsPanel Web UI 需要与上游 Ink TUI 对应——如果上游的 dashboard 已同步更新则零风险，否则需要手动适配

---

### 2.2 ⭐ Session 持久化增强（高价值 · 低难度）

#### 功能描述

- Keep sessions alive when closing window（关闭窗口时不杀会话）
- `/session-persist` toggle：切换自动恢复开关
- Server API 全异步化：消除同步 I/O 阻塞

#### 现状对比

| 维度 | vis-ai v0.47.1 | upstream v0.53.2 |
|------|:---:|:---:|
| 基础 session 管理 | ✅ | ✅ |
| keep-alive on close | ❌ | ✅ |
| `/session-persist` 开关 | ❌ | ✅ |
| async fs I/O | ❌ | ✅ |
| prompt history persist | ❌ | ✅ |

#### 涉及文件

| 上游源文件 | 目标文件 | 变更类型 |
|-----------|---------|---------|
| `src/server/api/sessions.ts` | `dist/cli/server-*.js` | API 层 keep-alive 逻辑 |
| `src/memory/session.ts` | `dist/cli/chunk-*.js` | 持久化开关 |
| `src/cli/commands/desktop.ts` | `dist/cli/desktop-*.js` | 窗口生命周期 |
| `src/cli/ui/layout/SessionIntro.tsx` | `dashboard/dist/app.js` | 恢复提示 UI |

#### 移植难度：★★☆☆☆（低-中）

- **原因**：session 相关的变更在 server 层，vis-ai 的 `launcher.mjs` 可能需要微调以兼容新的 keep-alive 行为
- **风险点**：`launcher.mjs` 中 session 关闭逻辑可能与上游新的 keep-alive 默认行为冲突

---

### 2.3 ⭐ Plan 面板增强（高价值 · 中难度）

#### 功能描述

- Markdown 渲染：计划正文和内存正文支持 Markdown 格式
- 风险 rails 建议：高风险任务自动建议使用 plan 模式
- Plan-first 意图检测：识别用户"先计划再执行"的显式意图
- 反馈文本输入：cancel/refine 操作时支持输入文本反馈
- PlanRefineEditor：交互式编辑计划内容

#### 现状对比

| 维度 | vis-ai v0.47.1 | upstream v0.53.2 |
|------|:---:|:---:|
| Plan 确认对话框 | ✅ | ✅ 增强 |
| PlanStepList | ✅ | ✅ 增强 |
| Markdown 渲染 | ❌ | ✅ |
| 风险 rails 建议 | ❌ | ✅ |
| Plan-first 检测 | ❌ | ✅ |
| 反馈文本输入 | ❌ | ✅ |
| PlanRefineEditor | ❌ | ✅ |
| PlanReviseEditor | ❌ | ✅ |
| plan-open-questions 提取 | ❌ | ✅ |

#### 涉及文件

| 上游源文件 | 目标文件 | 变更类型 |
|-----------|---------|---------|
| `src/cli/ui/PlanConfirm.tsx` | `dashboard/dist/app.js` | Markdown + 反馈输入 |
| `src/cli/ui/PlanStepList.tsx` | `dashboard/dist/app.js` | 步骤列表增强 |
| `src/cli/ui/PlanRefineInput.tsx` | `dashboard/dist/app.js` | **新组件** |
| `src/cli/ui/PlanReviseEditor.tsx` | `dashboard/dist/app.js` | **新组件** |
| `src/cli/ui/PlanReviseConfirm.tsx` | `dashboard/dist/app.js` | **新组件** |
| `src/cli/ui/plan-open-questions.ts` | `dashboard/dist/app.js` | **新工具函数** |
| `src/tools/plan.ts` | `dist/cli/chunk-*.js` | rails 建议逻辑 |
| `src/core/pause-policy.ts` | `dist/cli/chunk-*.js` | plan-first 检测 |

#### 移植难度：★★★☆☆（中）

- **原因**：Plan UI 在上游是 Ink/React TUI 组件，而 vis-ai 的 dashboard 是 Web React。需要验证上游 dashboard 是否已包含对应的 Web UI 实现。
- **⚠️ 关键难点**：如果上游 dashboard 未包含 Plan 增强的 Web UI（而只存在于 TUI 中），则需要手动在 `dashboard/dist/app.js` 中实现对应组件。这需要理解上游 Ink 组件的逻辑并映射到 Web React。
- **风险点**：手动实现 3 个新组件（RefineInput、ReviseEditor、ReviseConfirm）工作量较大

---

### 2.4 ⭐ 性能优化（高价值 · 中难度）

#### 功能描述

- 消息列表虚拟化（Virtuoso）：只渲染可见消息
- 窗口化日志（AppendOnlyLog 200条）+ 懒文件回退
- 向后索引替换：替代 `messages.map` 全量遍历
- Tokenizer + prompt builder 热路径优化
- Agent loop 全异步化：消除同步 I/O
- 跳过愈合管道：log unchanged 时跳过 token count + healing

#### 现状对比

| 维度 | vis-ai v0.47.1 | upstream v0.53.2 |
|------|:---:|:---:|
| 消息渲染方式 | 全量 map | ✅ 虚拟化 Virtuoso |
| 日志记录方式 | 全量 append | ✅ 窗口化 200条 |
| 索引更新方式 | map 遍历 | ✅ backwards-walk |
| Tokenizer 热路径 | 标准 | ✅ 优化 |
| Agent loop I/O | 同步 | ✅ 全异步 |
| Healing 跳过 | ❌ | ✅ |

#### 涉及文件

| 上游源文件 | 目标文件 | 变更类型 |
|-----------|---------|---------|
| `src/cli/ui/layout/CardStream.tsx` | `dashboard/dist/app.js` | 虚拟化渲染 |
| `src/cli/ui/layout/LiveRows.tsx` | `dashboard/dist/app.js` | 窗口化逻辑 |
| `src/core/loop.ts` | `dist/cli/chunk-*.js` | 全异步化 |
| `src/tokenizer.ts` | `dist/cli/chunk-*.js` | 热路径优化 |
| `src/prompt-fragments.ts` | `dist/cli/chunk-*.js` | 缓存优化 |

#### 移植难度：★★★☆☆（中）

- **原因**：性能优化贯穿 core/loop、tokenizer、UI 渲染等多个模块
- **优势**：这些优化大部分在核心逻辑层，对 dashboard Web UI 影响较小。升级基线即可自动获得大部分优化
- **风险点**：vis-ai 的 `launcher.mjs` 中有对 loop 行为的自定义（admin 模式），需确认兼容性

---

### 2.5 ~~ACP (Agent Client Protocol)~~ ✅ 已存在

| 功能 | 状态 |
|------|:---:|
| ACP 协议基础 (stdio NDJSON-RPC) | ✅ `acp-DAGPCVFZ.js` |
| `--yolo` 参数 | ✅ 已内建 |
| `--mcp-prefix` | ✅ 已内建 |
| `--transcript` | ✅ 已内建 |
| session/request_permission | ✅ 已内建 |
| ACP gates 权限桥接 | ✅ 已内建 |
| dispatchKernelEvent | ✅ 已内建 |

**结论**：vis-ai v0.47.1 的 ACP 实现已完整，无需移植。后续版本仅有小修复。

---

### 2.6 ~~MCP 注册表浏览~~ ✅ 已存在

| 功能 | 状态 |
|------|:---:|
| `mcp browse` 命令 | ✅ `mcp-browse-RR7R4XET.js` |
| registry.modelcontextprotocol.io | ✅ |
| Smithery 回退 | ✅ |
| 内置 MCP_CATALOG | ✅ |
| 分页加载 | ✅ |
| 搜索过滤 | ✅ |

**结论**：vis-ai v0.47.1 的 MCP 注册表浏览已完整，无需移植。后续版本主要增加 i18n overlay 支持。

---

### 2.7 ~~--yolo / --mcp-prefix headless 参数~~ ✅ 已存在

vis-ai v0.47.1 的 `acp-DAGPCVFZ.js` 中已包含完整的 `--yolo`, `--mcp-prefix`, `--transcript` 参数处理。

---

## 3. 推荐移植策略

### 3.1 总体策略：基线升级（Rebase）

vis-ai 的架构天然支持基线升级：

```
步骤 1: npm pack reasonix@0.53.2 → 解压到 visionox-pkg/
步骤 2: 运行 cherry-claude.cjs 重新应用 Visionox 定制补丁
步骤 3: 处理补丁冲突（SEARCH 文本不匹配）
步骤 4: 验证 dashboard Web UI 兼容性
步骤 5: 验证 + cargo build
```

### 3.2 分阶段执行

#### 第一阶段：基线升级（核心变更）

- 升级 `visionox-pkg/` 到 reasonix v0.53.2
- 重新应用所有 Visionox 定制补丁
- 解决 SEARCH/REPLACE 冲突
- 获得第 2.1、2.2、2.4 节的大部分功能

#### 第二阶段：Plan UI 适配

- 检查上游 dashboard 是否已包含 Plan 增强的 Web UI
- 如果已包含：零额外工作
- 如果未包含：在 `dashboard/dist/app.js` 中手动实现 PlanRefineInput、PlanReviseEditor 等组件

#### 第三阶段：测试验证

- 编译 `cargo build --release`
- 功能测试矩阵
- 回归测试（admin 模式、session 恢复等）

### 3.3 估计工时

| 阶段 | 工时 | 说明 |
|------|------|------|
| 基线升级 + 补丁冲突 | 4-8h | 取决于上游 chunk 拆分变化幅度 |
| Plan UI 适配 | 8-16h | 最不确定的部分 |
| 测试验证 | 4-8h | 含回归测试 |
| **总计** | **16-32h** | 约 2-4 个工作日 |

---

## 4. 风险与注意事项

### 4.1 高风险项

1. **补丁冲突**：上游 chunk 文件可能被重新拆分/合并，导致 SEARCH 文本完全找不到匹配。需逐个检查每个 `.bak` 文件对应的补丁。
2. **launcher.mjs 兼容性**：session keep-alive 行为变更可能影响 vis-ai 的窗口生命周期管理。
3. **Admin 模式**：8 处 admin 补丁是 vis-ai 的核心差异化功能，升级后必须全部通过测试。

### 4.2 中风险项

4. **Plan UI 适配**：如果上游 dashboard 未同步 Plan TUI 的增强，需要手动开发且无上游参考。
5. **品牌化替换**：`.reasonix` → `.visionox` 的全局替换需要覆盖新增 chunk 中的所有路径引用。
6. **CHANGELOG 维护**：需更新 `CHANGELOG.md` 记录升级变更。

### 4.3 低风险项

7. **主题 CSS**：新版本可能有新增 CSS 变量/类名，需检查 `app.css` 兼容性。
8. **ACP/MCP 已存在**：这两个模块无需额外处理，但需验证升级后无回归。

---

## 5. 补丁清单

### 5.1 现有补丁（需重新应用）

| # | 文件 | 功能 | 优先级 |
|---|------|------|--------|
| 1 | `chunk-XPDVG52A.js` | `loadEditMode` 接受 `"admin"` | 🔴 高 |
| 2 | `chunk-45U62RI3.js` | `shouldAutoResolveCheckpoint` 含 admin | 🔴 高 |
| 3 | `chunk-YFGF5NKA.js` | `buildCodeToolset` 传 `allowAllPaths` | 🔴 高 |
| 4 | `chunk-YFGF5NKA.js` | `allowAll` 含 admin | 🔴 高 |
| 5 | `chunk-2R4QCDOZ.js` | `allowAllPaths` 短路机制 | 🔴 高 |
| 6 | `server-XGDBRWMB.js` | VALID Set + 错误消息含 admin | 🔴 高 |
| 7 | `dashboard/dist/app.js` | Dashboard admin 按钮 + i18n | 🔴 高 |
| 8 | `dashboard/app.css` | admin/yolo 按钮样式 | 🟡 中 |
| 9 | 全部 `dist/cli/*.js` | `.reasonix` → `.visionox` 替换 | 🟡 中 |
| 10 | `chunk-OSZC7C6F.js` | 删除历史会话功能 | 🟡 中 |
| 11 | `chunk-5JJRUIPA.js` | `CODE_SYSTEM_TEMPLATE` 压缩 + 品牌化 | 🟡 中 |
| 12 | `chunk-2R4QCDOZ.js` | 6 个工具描述压缩 | 🟢 低 |
| 13 | `chunk-2K65GZBT.js` → `launcher.mjs` | login-shell PATH 增强 | 🟡 中 |
| 14 | `chunk-2R4QCDOZ.js` → `launcher.mjs` | multi_edit 回滚 | 🟢 低 |

### 5.2 可能新增的补丁

| 功能 | 文件 | 新增原因 |
|------|------|---------|
| Plan 面板 Web UI 实现 | `dashboard/dist/app.js` | 如果上游未提供 |
| Cache 命中率 i18n | `dashboard/dist/app.js` | 中文本地化 |
| Session keep-alive 中文提示 | `dashboard/dist/app.js` | 中文本地化 |

---

## 6. 验证清单

- [ ] `npm pack reasonix@0.53.2` 成功
- [ ] Visionox 补丁全部重新应用成功（无 SEARCH 找不到的情况）
- [ ] `.reasonix` → `.visionox` 全局替换覆盖所有文件
- [ ] Admin 模式全部 8 处补丁通过功能测试
- [ ] Session 管理（删除/恢复/keep-alive）正常
- [ ] 搜索引擎选择器正常（4 引擎）
- [ ] 主题切换正常（7 套配色）
- [ ] 聊天头像正常（ROLE_AVATAR）
- [ ] 输入框布局正常
- [ ] `CODE_SYSTEM_TEMPLATE` 压缩版本正常
- [ ] 工具描述压缩版本正常
- [ ] login-shell PATH 正常
- [ ] `cargo build --release` 编译通过
- [ ] `visionox-desktop.exe` 启动正常
- [ ] Dashboard 可访问，无 JS 错误
- [ ] Cache 命中率显示正常（新功能）
- [ ] Plan 面板 Markdown 渲染正常（新功能）
- [ ] Plan Refine/Revise 输入正常（新功能）
- [ ] ACP `--yolo` / `--mcp-prefix` / `--transcript` 正常（回归）

---

## 7. 附录：GitHub 仓库参考

| 资源 | 地址 |
|------|------|
| 上游仓库 | https://github.com/kgp0213/DeepSeek-Reasonix |
| 上游 npm | `reasonix` (v0.53.2 latest) |
| vis-ai 项目 | `C:\Users\Lenovo\Documents\vis-ai` |
| CHANGELOG | `CHANGELOG.md` |
| 恢复脚本 | `scripts/restore-visionox-pkg.js` |
| 补丁脚本 | `cherry-claude.cjs` |
