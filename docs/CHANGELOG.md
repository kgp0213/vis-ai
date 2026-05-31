# Visionox 二开变更记录

> **版本说明**：本文档按上游 Reasonix 基线版本组织（v0.43.0 → v0.47.1）。
> Visionox Desktop 应用自身版本：**1.0.0**（定义于 `src-tauri/Cargo.toml` + `src-tauri/tauri.conf.json`）。
> `package.json` 版本号 `0.1.0` 仅为 npm workspace 占位（不随应用分发）。

## v0.47.1（2026-05-26 至今）

> 基础版本：reasonix 0.47.1
> 上一版本：reasonix 0.43.0 (2026-05-15)

| 变更 | 说明 |
|------|------|
| 架构升级 | Tauri v2 + custom-protocol → `generate_context!()` + `WebviewUrl::App`，不再使用 `document.write()` |
| 启动流程优化 | 移除冗余 init_script，`background_color` 匹配加载页消除白屏闪烁 |
| 加载页修复 | spinner 居中问题解决，不再跑偏到左上角 |
| 文档整理 | 2026-06-03 合并精简开发文档 12→6，删除重复/过时内容 |
| Karpathy 审查 | 2026-06-03 基于 Karpathy Guidelines 方法论完成源码审查 |
| 文档交叉验证 | 2026-06-07 逐行核对代码与文档，修复配色方案计数(5→7)、版本号说明、目录结构等 |

---

## v0.43.0（2026-05-17）

> 基础版本：reasonix 0.43.0 (2026-05-15)
> 上一版本：reasonix 0.39.1 (2026-05-11)

---

## 一、上游 0.43.0 结构变化

| 变化 | 0.39.1 | 0.43.0 |
|------|--------|--------|
| Server 入口 | `server-DRFPXXSH.js` + `server-2FXGNQ4F.js`（一死一活） | 仅 `server-XGDBRWMB.js` |
| Code 入口 | `code-TTOCA52N.js`（死）+ `code-X3M6ENTQ.js`（活） | 仅 `code-SMKEW6CD.js` |
| CSS 位置 | `dashboard/dist/app.css` | `dashboard/app.css` |
| PR #786 (yolo path_access) | 不存在 | 已内建 `autoResolveVerdict` |
| 子代理循环上限 | 32 | 256（支持 pause/resume） |

---

## 二、Admin 模式补丁（8 处）

| # | 文件 | 行号 | 修改内容 |
|---|------|------|---------|
| 1 | `chunk-XPDVG52A.js` | 2376 | `loadEditMode` 接受 `"admin"` |
| 2 | `chunk-45U62RI3.js` | 320 | `shouldAutoResolveCheckpoint` 含 admin |
| 3 | `chunk-YFGF5NKA.js` | 323 | `buildCodeToolset` 传 `allowAllPaths` |
| 4 | `chunk-YFGF5NKA.js` | 327 | `allowAll` 含 admin |
| 5 | `chunk-2R4QCDOZ.js` | ~9997/10002 | `allowAllPaths` 短路机制 |
| 6 | `server-XGDBRWMB.js` | 447/464 | VALID Set + 错误消息含 admin |
| 7 | `app.js` | 24151-24157 | Dashboard admin 按钮 + i18n |
| 8 | `app.css` | 1810-1816 | admin/yolo 按钮样式 |

---

## 三、Bug 修复

### Fix 1: 编辑模式切换失败

- **文件**：`resources/server/launcher.mjs:528-533`
- **根因**：`setEditMode` 没有返回值，导致 server 的 `handleEditMode` 收到 `undefined`，响应 body 为 `{}`
- **修复**：在 `setEditMode` 末尾添加 `return m;`

### Fix 2: 系统路径显示不一致

- **问题**：会话/记忆/语义显示 `.reasonix`，用量显示 `.visionox`
- **根因**：`/health` API 及其他 16 个 CLI chunk 文件硬编码了 `.reasonix`
- **修复**：对 16 个 `dist/cli/*.js` 文件做 `.reasonix` → `.visionox` 全局替换
- **安全保护**：HTTP headers（`X-Reasonix-Token`、`reasonix-token`、`reasonix-mode`）和 GitHub URL（`esengine/reasonix`）使用占位符保护后还原
- **结果**：JS 文件中 0 处 `.reasonix` 残留，64 处 `.visionox`

### Fix 3: 主题切换按钮不可点击

- **文件**：`dashboard/app.css`
- **根因**：缺少 `.theme-btn` 样式和 `[data-theme="light"]` 浅色主题 CSS 变量
- **修复**：追加 `.theme-btn`（26x26px 圆形按钮 + cursor:pointer）和完整浅色主题变量

### Fix 4: 数据迁移

- **问题**：历史会话/记忆/用量数据在 `.reasonix/` 下，升级后代码读写 `.visionox/` 导致历史数据不可见
- **修复**：将 `.reasonix/` 下的 sessions、memory、usage.jsonl、slash-usage.json、version-cache.json 迁移到 `.visionox/`
- **配置合并**：以旧 config.json 为基础，合并新版本字段（`search: true`）

---

## 四、Gitee 自定义内容（Visionox 品牌化）

### dashboard/index.html
- 标题改为 `<title>Visionox</title>`
- 品牌 CSS：侧边栏 `.glyph` 使用 `/assets/v3.png`
- CSS link：`<link rel="stylesheet" href="/assets/app.css">`
- Theme cookie 脚本：读写 `visionox-theme` cookie 用于主题持久化
- Monitor 侧边栏折叠脚本：默认折叠，点击切换展开/折叠

### dashboard/app.css
- `--font-sans`：优先 `'Segoe UI Variable', 'Segoe UI', 'Microsoft YaHei'`
- `--font-mono`：优先 `'Cascadia Code', 'JetBrains Mono', 'Consolas'`
- 侧边栏 `.brand`、`.side-section`、`.side-foot`、`.side-tab` 改用 `var(--font-sans)`
- `.chat-input-area` padding-top: `12px` → `6px`
- 新增 `.theme-btn` 和 `[data-theme="light"]` 浅色主题变量

### dashboard/dist/app.js（~40+ 处字符串替换）
- `[reasonix dashboard]` → `[visionox dashboard]`
- `` `- Reasonix: ${MODE}` `` → `` `- Visionox: ${MODE}` ``
- 英文 i18n 中 Reasonix → Visionox（UI 文本）
- 中文 i18n 对应翻译
- `~/.reasonix/` → `~/.visionox/`
- `REASONIX.md` → `visionox.md`
- 品牌区域改为 `<img src="/assets/v3.png">`
- 添加主题切换按钮（cookie `visionox-theme`）
- **保留不变**：HTTP headers（`X-Reasonix-Token`、`reasonix-token`、`reasonix-mode`）、GitHub URL（`esengine/reasonix`）

### 自定义图片（从 backup 复制）
| 文件 | 用途 |
|------|------|
| `128x128.png` | 用户头像 |
| `ai-avatar.png` | AI 助手头像 |
| `v1.png` | 品牌图标（旧版） |
| `v3.png` | 品牌图标（当前） |

---

## 五、未迁移的上游原生改动

| 项目 | 说明 |
|------|------|
| ROLE_AVATAR → ROLE_GLYPH | 0.43.0 用 unicode 符号（◇/◆）替代了自定义头像图片系统 |
| reasonix-workspaces → rx.* | localStorage key 重构，上游改动 |
| 工具描述 `desc` i18n | 0.43.0 新增 40+ 工具的中英文描述 |

---

## 六、验证清单

- [x] `cargo build --release` 编译通过
- [ ] 编辑模式按钮可点击切换（review/auto/yolo/admin）
- [ ] 系统信息面板所有路径均显示 `.visionox`
- [x] 历史会话数据可见（数据迁移）
- [ ] 主题切换按钮可点击，浅色模式正常
- [ ] API Key 等旧配置生效
- [ ] 品牌图片 v3.png 正常显示
- [ ] 中文字体正常渲染

---

## 七、目录结构

```
src-tauri/resources/server/
├── launcher.mjs              # Tauri 桥接层（setEditMode 已修复）
├── visionox-pkg/             # 0.43.0 vendored CLI（当前版本）
│   ├── dashboard/
│   │   ├── index.html        # 品牌化 + theme cookie + monitor 折叠
│   │   ├── app.css           # 字体 + theme-btn + 浅色主题
│   │   └── dist/
│   │       ├── app.js        # ~40+ 处品牌化替换
│   │       ├── 128x128.png   # 用户头像
│   │       ├── ai-avatar.png # AI 头像
│   │       ├── v1.png        # 品牌图标
│   │       └── v3.png        # 品牌图标
│   └── dist/cli/             # 16 个 JS 文件已完成路径替换
├── visionox-pkg-0.39.1-backup/  # 原始 0.39.1 备份
└── visionox-pkg-0.43.0-pre-pathfix/  # 路径修复前的 0.43.0 备份
```

---

## 八、回滚方法

```powershell
# 恢复 0.39.1
rm -r -force src-tauri/resources/server/visionox-pkg
mv visionox-pkg-0.39.1-backup src-tauri/resources/server/visionox-pkg
robocopy src-tauri/resources/server/visionox-pkg src-tauri/target/release/resources/server/visionox-pkg /MIR /NFL /NDL
cargo build --release

# 数据回滚（如需要）
rm -r -force ~/.visionox
mv ~/.reasonix ~/.visionox.bak  # 或其他恢复方式
```

---

## 九、会话管理增强（2026-05-16）

### 删除历史会话

| # | 文件 | 行号 | 修改内容 |
|---|------|------|---------|
| 1 | `server-XGDBRWMB.js` | 63-67 | import 增加 `deleteSession` |
| 2 | `server-XGDBRWMB.js` | 2669-2672 | `handleSessions` 增加 DELETE 分支（调用 `deleteSession`） |
| 3 | `app.js` | ~26751 | SessionsPanel 增加 `deleting` state |
| 4 | `app.js` | ~26765 | 新增 `remove` 函数（`DELETE /api/sessions/<name>` + confirm 确认） |
| 5 | `app.js` | ~26842 | 会话详情头部增加删除按钮（`.btn.ghost.danger`） |

### 从 GUI 继续历史会话

| # | 文件 | 行号 | 修改内容 |
|---|------|------|---------|
| 1 | `server-XGDBRWMB.js` | 3104-3108 | `handleSubmit` 透传 `session` 参数到 `ctx.submitPrompt` |
| 2 | `launcher.mjs` | 565-594 | `submitPrompt` 增加 `sessionName` 参数，加载 JSONL → `loop.log.compactInPlace()` → 广播 `messages-reset` SSE 事件 |
| 3 | `app.js` | ~26752 | SessionsPanel 增加 `resuming` state + `doResume` 函数（POST `/api/submit` + `appBus` 切换 tab） |
| 4 | `app.js` | ~26850 | "Resume in TUI" 静态卡片替换为"加载并继续会话"可点击按钮 |
| 5 | `app.js` | ~23851 | ChatPanel SSE `onmessage` 增加 `messages-reset` handler（`setMessages` 批量替换） |

**流程**: 用户点击"加载并继续会话" → POST `/api/submit` (`{prompt:"", session:name}`) → launcher 读取 JSONL → `loop.log.compactInPlace(entries)` 恢复 AI 上下文 → `messages` 数组重填 → 广播 `messages-reset` → ChatPanel 替换消息列表 → `appBus` 切换到聊天 tab

---

## 十、Gitee 样式恢复（2026-05-16）

### 聊天头像：ROLE_GLYPH → ROLE_AVATAR

| # | 文件 | 行号 | 修改内容 |
|---|------|------|---------|
| 1 | `app.js` | ~23004 | 删除 `ROLE_GLYPH`（Unicode 符号 ◇◆），替换为 `ROLE_AVATAR`（`{user:"/assets/128x128.png", assistant:"/assets/ai-avatar.png"}`） |
| 2 | `app.js` | ~23112 | `ChatMessage` 组件：user/assistant 渲染 `<img class="avatar" src=...>`，tool 渲染 `<div class="glyph">▣</div>` |
| 3 | `app.css` | ~1388 | 新增 `.chat-msg .avatar` 样式：28x28px 圆形，`object-fit:cover` |

### 输入区布局

| # | 文件 | 行号 | 修改内容 |
|---|------|------|---------|
| 1 | `app.js` | ~24241-24291 | `chat-input-area` 嵌套结构改为 0.39.1 布局：外层 `flex:1` wrapper → 内层 `display:flex;gap:6px;align-items:flex-end` wrapper（textarea 与按钮并排） |
| 2 | `app.js` | ~24250-24251 | textarea `rows="2"` → `rows="4"`，新增 `style="flex:1"` |

### Composer Chip 样式

| # | 文件 | 行号 | 修改内容 |
|---|------|------|---------|
| 1 | `app.css` | ~3065 | 末尾新增 `.composer-chip` 覆盖样式（胶囊形 `border-radius:12px`、`padding:2px 10px`、`font-family:var(--font-sans)`、hover 态） |
| 2 | `app.js` | ~24265/24278 | 两颗 chip 增加 `style="font-size:11px;padding:2px 10px"` |
| 3 | `app.js` | ~24264 | chip 容器 `margin:4px 0 0 0;gap:8px` → `margin:0;gap:12px` |

---

## 十一、验证清单（更新）

- [x] `cargo build --release` 编译通过（等待应用关闭后验证）
- [ ] 编辑模式按钮可点击切换（review/auto/yolo/admin）
- [ ] 系统信息面板所有路径均显示 `.visionox`
- [x] 历史会话数据可见（数据迁移）
- [ ] 主题切换按钮可点击，浅色模式正常
- [ ] API Key 等旧配置生效
- [ ] 品牌图片 v3.png 正常显示
- [ ] 中文字体正常渲染
- [ ] 会话删除按钮可点击，确认后删除成功
- [ ] "加载并继续会话"按钮可点击，切换到聊天 tab 并显示历史消息
- [ ] 聊天头像显示为图片（非 Unicode 符号）
- [ ] Composer chip 胶囊形样式正确，hover 变色
- [ ] 输入区 textarea 与按钮并排，4 行高度
- [ ] 索引构建时 embedding API 分批请求正常（不再 413）

---

## 十二、图片资源加载修复（2026-05-16）

### 问题

聊天头像（128x128.png、ai-avatar.png）和品牌 logo（v3.png）在 Dashboard 中不显示。

### 根因（两层）

**第一层**：`serveAsset()` 函数缺少 `.png` 文件 handler。0.43.0 上游移除了该 handler。

**第二层（根因）**：`/assets/` 路由对所有请求执行 `checkAuth()`。浏览器 `<img>` 标签和 CSS `url()` 不携带 auth token，导致 PNG 请求返回 401。0.39.1 有特殊处理跳过 PNG 的 auth 检查，0.43.0 删除了此逻辑。

### 修复

| # | 文件 | 修改内容 |
|---|------|---------|
| 1 | `server-XGDBRWMB.js` | `serveAsset()` 恢复 `.png` handler：读取文件返回 `{body, contentType:"image/png"}` |
| 2 | `server-XGDBRWMB.js` | `/assets/` 路由：`assetName.endsWith(".png")` 时跳过 `checkAuth()` |

**关键教训**：两层修复缺一不可。只加 serveAsset handler 不加 auth skip，请求在到达 serveAsset 之前就被 401 拦截。

---

## 十三、Embedding API 分批修复（2026-05-16）

### 问题

构建索引时报错：
```
OpenAI-compatible API returned 413: {"code":20042,"message":"input batch size 67 > maximum allowed batch size 64"}
```

### 根因

`chunk-XCGGEJTI.js` 中的 `embedAllOpenAICompat` 函数将一个文件的所有 chunks 一次性发送给 API，无分批逻辑。当文件超过 64 个 chunks 时超过 API 限制。

### 修复

| # | 文件 | 修改内容 |
|---|------|---------|
| 1 | `chunk-XCGGEJTI.js` | `embedAllOpenAICompat` 增加分批逻辑：定义 `OPENAI_COMPAT_MAX_BATCH = 64`，将输入按最多 64 个一组拆分，分批发送 API 请求后合并结果。`onProgress` 改为增量上报（每批完成后更新进度）。 |

---

## 十四、install_skill 增强：source_dir 目录安装（2026-05-17）

### 问题

`install_skill` 原有两种模式（`body` / `source`）都无法优雅处理完整 skill 目录：

| 模式 | 行为 | 局限 |
|------|------|------|
| `body` | 只写 SKILL.md | 丢失 scripts/、references/、templates/ 等辅助文件 |
| `source` | 解压 .skill ZIP | 需要先手动打包 |

### 修复

| # | 文件 | 修改内容 |
|---|------|---------|
| 1 | `launcher.mjs` | import 增加 `cpSync`、`statSync`；新增 `source_dir` 参数和安装逻辑 |
| 2 | `skill-creation-guide.md` | 第 5 步重写为三种安装方式（source_dir / .skill / body）；第 7 步增加开发工作流说明 |

**source_dir 校验**：路径存在 → 是目录 → 包含 SKILL.md → `cpSync` 递归复制。

---

## 十五、install_skill 异步化：修复 SSE 中断 + 启动崩溃（2026-05-17）

### 问题 1：工具执行期间 SSE 断开

在对话中输入"安装某目录下的技能"，模型调用 `install_skill` 后页面显示"事件流中断 — 正在重连…"。

**根因**：`cpSync` 和 `execSync` 是同步阻塞调用，完全卡住 Node.js 单线程事件循环。SSE 25 秒心跳定时器无法触发，浏览器 EventSource 检测到连接中断。

### 问题 2：修复引入 ERR_CONNECTION_REFUSED

将同步调用替换为异步时，使用了 `import { exec } from "node:child_process/promises"`，但该路径并非有效的 Node.js ESM 导出。服务器启动时 import 崩溃，Node 进程未启动。

### 最终修复

| # | 文件 | 修改内容 |
|---|------|---------|
| 1 | `launcher.mjs` | `cpSync` → `await cp`（`node:fs/promises`） |
| 2 | `launcher.mjs` | `execSync` → `await exec`（`util.promisify` 包装 `node:child_process` 回调版） |
| 3 | `launcher.mjs` | 新增 `import { promisify } from "node:util"` |

**教训**：`node:child_process/promises` 不是有效的 ESM 导入路径，正确方式是 `promisify(execCb)`。

---

## 十六、验证清单（最终更新）

- [x] `cargo build --release` 编译通过
- [ ] 编辑模式按钮可点击切换（review/auto/yolo/admin）
- [ ] 系统信息面板所有路径均显示 `.visionox`
- [x] 历史会话数据可见（数据迁移）
- [ ] 主题切换按钮可点击，浅色模式正常
- [ ] API Key 等旧配置生效
- [ ] 品牌图片 v3.png 正常显示
- [ ] 中文字体正常渲染
- [ ] 会话删除按钮可点击，确认后删除成功
- [ ] "加载并继续会话"按钮可点击，切换到聊天 tab 并显示历史消息
- [ ] 聊天头像显示为图片（非 Unicode 符号）
- [ ] Composer chip 胶囊形样式正确，hover 变色
- [ ] 输入区 textarea 与按钮并排，4 行高度
- [ ] 索引构建时 embedding API 分批请求正常（不再 413）
- [ ] `install_skill` source_dir 模式正常工作，所有辅助文件被复制
- [ ] `install_skill` 执行期间 SSE 连接不中断
- [x] 应用启动无 ERR_CONNECTION_REFUSED
- [ ] 修改工作空间后新建对话生效
- [ ] 默认沙箱按钮恢复 ~/visionox-workspace/
- [ ] 浅色主题字体清晰可读
- [ ] 导航栏：chat → sessions → plans
- [ ] "配置"section 点击展开/折叠
- [ ] 标题栏显示 Visionox + 工作空间路径

---

## 十七、浅色主题文字偏浅/模糊修复（2026-05-17）

### 问题

启用浅色主题后文字发虚、模糊、偏浅，不易阅读。

### 根因（两层）

1. **对比度不足**：上游 #1021 浅色主题的文字颜色对比度过低。`--fg-1: #606266` 在白色背景上仅 5.2:1（勉强 AA），`--fg-2: #909399` 仅 3:1（不达标），`--fg-3/4` 更差
2. **字体渲染**：全局 `-webkit-font-smoothing: antialiased` 在浅色背景下禁用子像素渲染，导致文字显细、模糊（暗色背景下反而不明显）

### 修复

| # | 文件 | 修改内容 |
|---|------|---------|
| 1 | `app.css` | `[data-theme="light"]` 文字颜色整体加深 ~20%，采用 GitHub 浅色配色：`--fg-0: #1f2328`、`--fg-1: #34393f`、`--fg-2: #59636e`、`--fg-3: #7c8490`、`--fg-4: #9ca3af` |
| 2 | `app.css` | 浅色主题新增 `body { -webkit-font-smoothing: subpixel-antialiased; font-weight: 425 }` 恢复子像素渲染 |

**教训**：暗色主题和浅色主题对字体渲染策略的要求相反——暗底白字适合 grayscale 抗锯齿，白底黑字必须 subpixel 渲染。

---

## 十八、导航栏优化（2026-05-17）

### 18A. 会话/计划位置交换

| # | 文件 | 修改内容 |
|---|------|---------|
| 1 | `app.js` | `tabSections()` workspace tabs 数组：`chat → plans → sessions` → `chat → sessions → plans` |

### 18B. "配置"子项折叠

**问题**：配置下 7 个子项（tools/permissions/mcp/skills/memory/hooks/settings）始终展开，占用大量侧边栏空间。

**方案**：参考"监控"section 的折叠机制，将"配置"也设为默认折叠。

| # | 文件 | 修改内容 |
|---|------|---------|
| 1 | `index.html` | 扩展 `setupMonitorToggle()` → `setupSectionToggles()`，用 `sectionState` 字典统一管理 `监控` + `配置` 两个折叠 section。每个 section 独立标记 `_toggled` 防重复初始化 |

**实现细节**：`{ '监控': true, '配置': true }` 记录每个 section 的折叠状态。点击 `▶ 配置` 展开 7 个子项，`▼ 配置` 折叠。

---

## 十九、工作空间目录热切换（2026-05-17）

### 问题

通过仪表盘"工作空间"按钮修改沙箱目录后，AI 始终认为沙箱在旧路径（如 `D:\ai-dsn`），新对话也不生效。

### 根因（三层，逐一发现）

**第一层**：`server-XGDBRWMB.js` 的 `handleSettings` POST 处理器完全忽略了 `workspaceDir` 字段。仪表盘发送 `{ workspaceDir: "xxx" }` 被静默丢弃，config 从未更新。

**第二层**：修复第一层后，`launcher.mjs` 中 `workspaceDir` 是 `const`，且 `ctx.setWorkspaceDir` 只写 config 不更新内存变量。工具注册、system prompt、loop prefix 都绑定了启动时的旧路径。

**第三层**：修复第二层后，`setWorkspaceDir` 在写 config 的同时也更新了内存变量 `workspaceDir`。这导致 `syncWorkspace` 发现 `configuredDir === workspaceDir`（已被 setWorkspaceDir 改过），直接 return 跳出，loop 和工具从未重建。

### 修复

| # | 文件 | 修改内容 |
|---|------|---------|
| 1 | `server-XGDBRWMB.js` | `handleSettings` POST 新增 `workspaceDir` 处理：校验非空 → 写入 `cfg.workspaceDir` → 调 `ctx.setWorkspaceDir` |
| 2 | `launcher.mjs` | `const workspaceDir` → `let workspaceDir`（允许运行时修改） |
| 3 | `launcher.mjs` | 提取 `deploySkillGuide(rootDir)` 函数 |
| 4 | `launcher.mjs` | 提取 `buildSystemPrompt(rootDir, hasSemantic)` 函数 |
| 5 | `launcher.mjs` | 提取 `buildLoop(client, rootDir)` 函数 |
| 6 | `launcher.mjs` | 提取 `registerWorkspaceTools(tools, rootDir, opts)` 函数（统管 21 个 workspace 工具注册） |
| 7 | `launcher.mjs` | 定义 `WORKSPACE_TOOL_NAMES_BASE`（21 个工具名）+ `wsToolNames` 可变数组 + `hasSemanticSearch` 变量 |
| 8 | `launcher.mjs` | 新增 `ctx.syncWorkspace()`：读 config → 比较 configureDir vs workspaceDir → 不同则 unregister 旧工具 → `registerWorkspaceTools` 重注册 → `buildLoop` 重建 loop（system prompt + prefix + toolSpecs 全部更新）→ 部署 skill guide |
| 9 | `launcher.mjs` | `ctx.setWorkspaceDir` 简化为只写 config（不更新内存变量，留给 syncWorkspace 处理） |
| 10 | `launcher.mjs` | `ctx.submitPrompt` 改为 async，开头调 `await ctx.syncWorkspace()` |
| 11 | `server-XGDBRWMB.js` | `ctx.submitPrompt(...)` 调用处加 `await` |
| 12 | `app.js` | "默认沙箱"按钮传递 `"visionox-workspace"` 字符串（之前传当前 state 值，等于原地踏步） |
| 13 | `app.js` | Toast 文字："重启后生效" → "新对话后生效" |

### Workspace 依赖的工具（21 个）

| 类别 | 工具名 |
|------|--------|
| Filesystem | `read_file`, `list_directory`, `search_files`, `get_file_info`, `write_file`, `create_directory`, `move_file`, `delete_file`, `delete_directory`, `copy_file` |
| Shell | `run_command`, `run_background`, `job_output`, `wait_for_job`, `stop_job`, `list_jobs` |
| Memory | `remember`, `forget`, `recall_memory` |
| Semantic | `semantic_search` |
| Skill | `run_skill` |

非 workspace 依赖（不受影响）：`install_skill`, `submit_plan`, `mark_step_complete`, `revise_plan`, `todo_write`, `ask_choice`, `web_search`, `web_fetch`, MCP tools。

### 修复过程中发现的额外 bug

| # | 文件 | 问题 | 修复 |
|---|------|------|------|
| 1 | `launcher.mjs` | import 缺少 `readFileSync`（会话恢复功能遗漏） | 补充 `readFileSync` 到 `node:fs` import |

### 执行流程

```
用户点击按钮切换工作空间
  → POST /settings { workspaceDir: "new-path" }
  → handleSettings 写 config + 调 setWorkspaceDir（仅写 config）
  → Toast: "新对话后生效"

用户开启新对话（/new 或发送消息）
  → submitPrompt → await syncWorkspace()
  → 读 config → 发现 configureDir ≠ workspaceDir
  → unregister 21 个旧工具
  → registerWorkspaceTools 注册新工具（新 rootDir）
  → buildLoop 重建 system prompt + prefix（含新路径）
  → AI 识别新沙箱路径
```

---

## 二十、标题栏增强（2026-05-17）

### 问题

标题栏仅显示 `dashboard · desktop`，无品牌标识和工作空间信息。上游 CSS 中有 `.session` 和 `.meter` 样式但从未被使用。

### 修复

| # | 文件 | 修改内容 |
|---|------|---------|
| 1 | `app.js` | App 组件新增 `wsRoot` state，挂载时请求 `/health` 获取 cwd |
| 2 | `app.js` | 标题栏：`dashboard` → `Visionox`，中间插入工作空间路径（使用 `.session` class），最终显示 `Visionox · D:\path · desktop` |

---

## 二十一、后续工作

- [ ] 验证工作空间热切换端到端流程
- [ ] 验证浅色主题在所有界面的可读性
- [ ] 验证"配置"折叠 + 回话/计划交换后的导航体验

---

## 二十二、SideRail 删除：聊天区域全宽化（2026-05-17）

### 问题

聊天界面右侧的 SideRail 组件（280px 卡片）展示的 KPI（轮次/tokens/费用/缓存命中）与输入框底部的 ChatStatusBar 完全重复。ChatStatusBar 信息更全（额外包含模型名、上下文用量、余额），SideRail 占用 280px 横向空间但无独特价值。

### 修复

| # | 文件 | 修改内容 |
|---|------|---------|
| 1 | `app.js` | ChatPanel 删除 `<SideRail>` 渲染（~24304 行） |
| 2 | `app.css` | `.chat-grid` 和 `.chat-shell` 的 `grid-template-columns` 去掉 `280px` 右列 |

聊天消息区域扩展到全宽，体验更好，无信息损失。

---

## 二十三、标题栏布局重构（2026-05-17）

### 问题

标题栏内容与 Gitee 版本不一致，缺少品牌副标题、年份、编译日期。

### 修复

| # | 文件 | 修改内容 |
|---|------|---------|
| 1 | `app.js` | 标题栏布局：左侧 `Visionox · 维信诺协同办公平台`，右侧 `wsRoot · @年份 · v版本-编译日期` |
| 2 | `app.js` | `维信诺协同办公平台` 样式：深蓝色 `#1a3a5c`、微软雅黑、font-size 15px |
| 3 | `app.js` | 新增 `buildDate2` state，从 `/health` 获取编译日期 |
| 4 | `server-XGDBRWMB.js` | `/health` 响应新增 `cwd`（工作空间路径）和 `buildDate`（编译日期）字段 |
| 5 | `app.js` | 删除 `<MODE>`（desktop）显示，删除 `<span class="ver">${MODE}</span>` |

### 最终效果

```
Visionox · 维信诺协同办公平台 ·                    D:\ai-dsn · @2026 · v0.43.0-0517
```

- `@2026` 取 `new Date().getFullYear()` 动态年份
- `-0517` 为编译日期（当前硬编码在 `/health` 响应）

---

## 二十四、导航栏宽度 + 图标缩小（2026-05-17）

### 修复

| # | 文件 | 修改内容 |
|---|------|---------|
| 1 | `app.css` | `.app` 侧边栏宽度 `220px` → `110px` |
| 2 | `app.js` | 品牌 v3.png 高度 `26px` → `13px` |
| 3 | `app.css` | `.brand .glyph` font-size `16px` → `8px` |
| 4 | `index.html` | 内联 glyph 尺寸 `32x52px` → `16x26px` |

---

## 二十五、验证清单（最终更新）

- [x] `cargo build --release` 编译通过
- [ ] 编辑模式按钮可点击切换（review/auto/yolo/admin）
- [ ] 系统信息面板所有路径均显示 `.visionox`
- [x] 历史会话数据可见（数据迁移）
- [ ] 主题切换按钮可点击，浅色模式正常
- [ ] API Key 等旧配置生效
- [ ] 品牌图片 v3.png 正常显示
- [ ] 中文字体正常渲染
- [ ] 会话删除按钮可点击，确认后删除成功
- [ ] "加载并继续会话"按钮可点击，切换到聊天 tab 并显示历史消息
- [ ] 聊天头像显示为图片（非 Unicode 符号）
- [ ] Composer chip 胶囊形样式正确，hover 变色
- [ ] 输入区 textarea 与按钮并排，4 行高度
- [ ] 索引构建时 embedding API 分批请求正常（不再 413）
- [ ] `install_skill` source_dir 模式正常工作，所有辅助文件被复制
- [ ] `install_skill` 执行期间 SSE 连接不中断
- [x] 应用启动无 ERR_CONNECTION_REFUSED
- [ ] 修改工作空间后新建对话生效
- [ ] 默认沙箱按钮恢复 ~/visionox-workspace/
- [ ] 浅色主题字体清晰可读
- [ ] 导航栏：chat → sessions → plans
- [ ] "配置"section 点击展开/折叠
- [ ] 标题栏显示 Visionox + 维信诺协同办公平台 + 工作空间 + 年份 + 版本号
- [ ] 导航栏宽度缩小一半，图标缩小一半
- [ ] 聊天区域全宽（无右侧 SideRail）
- [ ] ChatStatusBar 各项数据正常显示

---

## 二十六、开发者模式（已实施 ✅）

### 背景

Gitee 版 Settings 页面底部有"开发者模式"开关，打开后显示后台启动/运行日志。`launcher.mjs` 已有日志缓冲基础设施（`logBuffer` + `getLogs()`），只需补齐 API 端点和前端 UI。

### 需求清单

| # | 位置 | 需求 | 说明 |
|---|------|------|------|
| 1 | `server-XGDBRWMB.js` | 新增 `GET /api/logs` API 端点 | GET → `ctx.getLogs?.()` → 返回 `{ logs: [{ts, msg}, ...] }` |
| 2 | `app.js` i18n | 新增中英文翻译字符串 | `sectionDev`、`devMode`、`devModeNote` (en + zh-CN) |
| 3 | `app.js` SettingsPanel | Settings 面板底部新增"开发者模式"开关 | Toggle 按钮，标签跟随语言切换 |
| 4 | `app.js` SettingsPanel | 新增日志显示面板 | 开关 ON 时显示，每 2s 轮询 `/api/logs`，渲染带时间戳的日志行，自动滚底 |

### 实现方法

#### 1. `server-XGDBRWMB.js` — 新增 `/api/logs` API 端点

**文件路径**: `src-tauri/resources/server/visionox-pkg/dist/cli/server-XGDBRWMB.js`

**改动点**:

a) 在 `handleApi()` 函数的 switch 中新增 case：
```js
case "logs":
  return await handleLogs(method, rest, body, ctx);
```
插入位置：`case "health"` 之后。

b) 新增 `handleLogs` 函数（位于 `handleHealth` 定义之后）：
```js
// src/server/api/logs.ts
async function handleLogs(method, _rest, _body, ctx) {
  if (method !== "GET") {
    return { status: 405, body: { error: "GET only" } };
  }
  const logs = ctx.getLogs?.() ?? [];
  return { status: 200, body: { logs } };
}
```

**依赖链**: `GET /api/logs` → `handleLogs()` → `ctx.getLogs()` → `launcher.mjs:595` → `logBuffer.slice()`

`ctx.getLogs` 在 `launcher.mjs:595` 注入：`getLogs: () => logBuffer.slice()`

#### 2. `app.js` i18n — 新增翻译字符串

**文件路径**: `src-tauri/resources/server/visionox-pkg/dashboard/dist/app.js`

**改动点**:

a) 英文（`en`）settings 对象末尾新增：
```js
sectionDev: "Developer",
devMode: "Developer Mode",
devModeNote: "Show background server startup and runtime logs"
```

b) 中文（`zh-CN`）settings 对象末尾新增：
```js
sectionDev: "开发者",
devMode: "开发者模式",
devModeNote: "显示后台服务器启动和运行时日志"
```

插入位置均在 `langZhCn` 之后、`chat:` 之前。

#### 3. `app.js` SettingsPanel — 状态与逻辑

**改动点**:

a) 新增 2 个 state 变量（位于 `setNow` 之后）：
```js
const [showDevLog, setShowDevLog] = d2(false);  // 开发者模式开关
const [devLogs, setDevLogs] = d2([]);            // 日志数据
```

b) 新增 `refreshLogs` 回调（位于 `stopLoop` 之后）：
```js
const refreshLogs = q2(async () => {
  try {
    const r3 = await api("/logs");
    setDevLogs(r3.logs ?? []);
  } catch {
  }
}, []);
```

c) 新增轮询 effect（位于 `refreshLogs` 之后）：
```js
y2(() => {
  if (!showDevLog) return;
  refreshLogs();
  const id = setInterval(refreshLogs, 2e3);
  return () => clearInterval(id);
}, [showDevLog, refreshLogs]);
```
开关 ON 时立即拉取一次，之后每 2 秒轮询；开关 OFF 时清除定时器。

d) 新增自动滚底 effect（位于轮询 effect 之后）：
```js
y2(() => {
  const el = document.getElementById("dev-log-panel");
  if (el) el.scrollTop = el.scrollHeight;
}, [devLogs]);
```
每次 `devLogs` 更新后自动将日志面板滚动到最底部。

#### 4. `app.js` SettingsPanel — UI 渲染

**改动点**:

在 SettingsPanel return 的 Runtime 卡片 `</div>` 之后、父 `</div>` 之前插入：

```jsx
${sectionH3(t4("settings.sectionDev"))}
<div class="card">
  ${fieldRow(
    t4("settings.devMode"),
    html4`<button
      class=${`btn ${showDevLog ? "primary" : ""}`}
      onClick=${() => setShowDevLog(!showDevLog)}
    >${showDevLog ? t4("common.on") : t4("common.off")}</button>`,
    t4("settings.devModeNote")
  )}
  ${showDevLog ? html4`
    <div style="margin-top:10px;max-height:320px;overflow-y:auto;background:var(--bg-0);border:1px solid var(--border-1);border-radius:6px;padding:8px;font-family:var(--font-mono);font-size:11px;line-height:1.6" id="dev-log-panel">
      ${devLogs.length === 0 ? html4`<span style="color:var(--fg-3)">...</span>` : devLogs.map((e) => html4`
        <div style="display:flex;gap:8px">
          <span style="color:var(--fg-3);flex-shrink:0">${new Date(e.ts).toLocaleTimeString()}</span>
          <span style="color:var(--fg-2);word-break:break-all">${e.msg}</span>
        </div>
      `)}
    </div>
  ` : null}
</div>
```

**UI 结构说明**:
- section header: `sectionH3(t4("settings.sectionDev"))` → 显示 "开发者 / Developer"
- Toggle 按钮复用 `fieldRow` 布局，按钮高亮色（`primary`）跟随开关状态
- 日志面板: `max-height: 320px` 限制高度，超出滚动；`font-mono` 等宽字体；每行 `[时间戳] 消息` 双列布局
- 空状态显示 `...`

### 已有基础设施（未改动）

`launcher.mjs` 中的日志缓冲已在先前的提交中实现 (commit `a34eaf6`)：

```js
// launcher.mjs:26-42
const LOG_MAX = 500;
const logBuffer = [];
console.error = (...args) => {
  const msg = args.join(" ");
  logBuffer.push({ ts: Date.now(), msg });
  if (logBuffer.length > LOG_MAX) logBuffer.shift();
  _origError.apply(console, args);
};
console.log = (...args) => {
  const msg = args.join(" ");
  logBuffer.push({ ts: Date.now(), msg });
  if (logBuffer.length > LOG_MAX) logBuffer.shift();
  _origLog.apply(console, args);
};

// launcher.mjs:595
getLogs: () => logBuffer.slice(),
```

### 交互流程

```
Settings 底部开关 OFF → ON
  → 日志面板在 Settings 底部展开
  → 立即拉取 GET /api/logs
  → 每 2s 轮询
  → 渲染: [HH:MM:SS] message
  → 自动滚动到最新日志
  → 开关 ON → OFF: 日志面板收起，清除定时器
```

---

## 二十七、启动闪屏修复（2026-05-17 ✅ 已修复）

### 问题

GUI 启动时窗口先白屏 ~2s，然后短暂闪过"无法连接"错误页面，最后才进入 dashboard。理想效果：窗口打开 → 旋转动画 + "Visionox" + "Starting server…" 持续可见 → 服务器就绪后平滑进入 dashboard。

### 根因（两层）

**第一层 — 跳转时机过早**：`lib.rs` 中 `spawn_server_blocking()` 解析到 stdout URL 后立即 `window.location.href` 跳转。虽然 `launcher.mjs` 中 `startDashboardServer()` await 后才输出 JSON，但 Rust 侧无验证，直接跳转可能导致 WebView 在 HTTP 服务器 event loop 就绪前发起请求 → 连接拒绝。

**第二层 — 加载页未嵌入二进制**：`frontendDist: "../src"` 中的 `index.html` 未被 Tauri 的 `generate_context!()` 宏正确嵌入到 release 二进制中。`WebviewUrl::App("index.html")` 加载失败时 WebView 降级为 `about:blank`（白屏），加载页的 spinner 从未显示。

### 最终架构

```
窗口创建 (WebviewUrl::App + initialization_script)
  ├── Tauri 加载 frontendDist 中的 index.html（精简外壳：仅 body 背景色）
  ├── initialization_script 检查页面状态，若缺失 .wrap 则注入完整加载页 HTML
  │     └── URL 守卫：仅当非 http://127.0.0.1 时才注入，避免覆盖 dashboard
  │
  ├── spinner + "Visionox" + "Starting server…" 始终可见
  │
  ├── Rust 后台 spawn Node → 读到 stdout URL → TCP 直连 /api/health 轮询
  │     └── 200ms×15 次（最长 3s）
  │
  ├── 健康检查通过 → eval 注入 window.__DASHBOARD_URL__
  │
  └── 加载页 JS 检测到 URL → "Server ready…"（绿色）→ 200ms 后 self-navigate
       → 进入 dashboard，全程无错误闪现
```

### 关键设计决策

**Rust 不执行跳转**：旧方案 `eval("window.location.href=url")` 在页面未渲染完成时可能失败，且跳转过程中 WebView 协议切换（`tauri://` → `http://`）会产生错误闪现。新方案 Rust 只负责注入全局变量 `window.__DASHBOARD_URL__`，加载页 JS 自己决定跳转时机。

**TCP 健康检查而非 fetch**：JS 端 `fetch(url, {mode:'no-cors'})` 在 Tauri WebView 中行为不可靠（可能虚报）。Rust 侧 `TcpStream` 发送原始 `GET /api/health?token=TOKEN HTTP/1.1` 并检查响应状态行是否含 `200`，零歧义。

**初始化脚本双保险**：`initialization_script` 确保即使 `frontendDist` 的 `index.html` 无法加载（Tauri 前端嵌入机制的已知问题），加载页 HTML 仍能通过内联注入显示。同时通过 `window.location.href.startsWith('http://127.0.0.1')` 守卫避免在导航到 dashboard 后重复注入。

### 修改清单

| # | 文件 | 修改内容 |
|---|------|---------|
| 1 | `src/index.html` | 从 1179 字节精简为 112 字节极简外壳（仅 `<style>body{background:#f3f4f6}</style>`），加快 WebView 初始加载 |
| 2 | `src-tauri/src/lib.rs` | 新增 `LOADING_HTML` const（`concat!` 内联完整加载页 HTML + JS） |
| 3 | `src-tauri/src/lib.rs` | 新增 `check_health(port, token)` — TCP 直连健康检查 |
| 4 | `src-tauri/src/lib.rs` | `spawn_server_blocking` 返回值扩展为 `(Child, String, u16, String)`，同时解析 port/token |
| 5 | `src-tauri/src/lib.rs` | 线程 spawn 中：800ms 盲等 → 健康检查轮询（15×200ms），通过后才 eval 注入 URL |
| 6 | `src-tauri/src/lib.rs` | 窗口创建添加 `initialization_script`（URL 守卫 + document.write 注入） |
| 7 | `src-tauri/src/lib.rs` | 移除 `window.location.href` 跳转，Rust 仅注入 `window.__DASHBOARD_URL__` |
| 8 | `src-tauri/build.rs` | 新增 `println!("cargo:rerun-if-changed=../src")` |
| 9 | `src-tauri/tauri.conf.json` | `devUrl` 从 `localhost` 改为 `127.0.0.1`（避免 DNS 解析延迟） |
| 10 | `src-tauri/Cargo.toml` | 无新增依赖 |

---

## 二十八、网页搜索引擎选择器 + Bing 引擎支持（2026-05-17 ✅ 已实施）

### 问题

1. Dashboard Settings 中 Web Search 仅有关闭/开启开关，无法切换搜索引擎
2. 默认 Mojeek 国内返回 403
3. SearXNG 公共实例国内大多被墙
4. 切换搜索引擎需重启应用

### 最终方案

4 个搜索引擎可选，默认 Bing 国内版（`cn.bing.com` 抓取，免费无需 API Key），**热切换无需重启**。

### 引擎列表

| 引擎 | 引擎值 | 方式 | 免费 | 国内可用 |
|------|--------|------|------|----------|
| **Bing 国内版** | `bing-scrape` | 抓取 cn.bing.com HTML | ✅ | ✅ |
| Mojeek | `mojeek` | 抓取 mojeek.com HTML | ✅ | ❌ |
| SearXNG | `searxng` | 调用 SearXNG API | ✅ | 自部署 |
| Bing API | `bing` | Bing Search API v7 | 1000次/月 | ✅ |

### 修改清单

| # | 文件 | 修改内容 |
|---|------|---------|
| 1 | `chunk-2R4QCDOZ.js` | import 增加 `loadBingApiKey` |
| 2 | `chunk-2R4QCDOZ.js` | `registerWebTools` 工具 `fn` 改为每次调用实时读 config（`webSearchEngine()` / `webSearchEndpoint()` / `loadBingApiKey()`），不再从 startup opts 取 |
| 3 | `chunk-2R4QCDOZ.js` | 新增 `searchBing(query, opts)`：Bing API v7 JSON 解析 |
| 4 | `chunk-2R4QCDOZ.js` | 新增 `searchBingScrape(query, opts)`：抓取 cn.bing.com HTML 解析 |
| 5 | `chunk-2R4QCDOZ.js` | `webSearch()` 增加 `bing` / `bing-scrape` 分支 |
| 6 | `chunk-XPDVG52A.js` | `webSearchEngine()` 识别全部 4 种引擎（之前只认 searxng，其余全返回 mojeek） |
| 7 | `chunk-XPDVG52A.js` | 默认引擎改为 `"bing-scrape"` |
| 8 | `chunk-XPDVG52A.js` | 新增 `loadBingApiKey(path)` 函数 + 导出 |
| 9 | `server-XGDBRWMB.js` | `handleSettings` GET 返回 `webSearchEngine`/`webSearchEndpoint`/`bingApiKeySet`，默认 `"bing-scrape"` |
| 10 | `server-XGDBRWMB.js` | `handleSettings` POST 校验 4 种引擎值 |
| 11 | `app.js` | Settings UI：搜索引擎下拉框 4 选项 + SearXNG 地址输入（修复保存按钮 bug）+ Bing API Key 输入 |
| 12 | `launcher.mjs` | 移除 startup 传参（引擎热切换后不再需要） |

### Dashboard Settings UI

```
Web Search:  [ON] [OFF]

▼ 当开启时显示：
搜索引擎:  [Bing 国内版 (免费，无需API) ▼]
           [Mojeek (免费)]
           [SearXNG (自部署/公共实例)]
           [Bing API (需 API Key)]

  → 选 SearXNG 时：SearXNG 地址 [________________] [保存]
  → 选 Bing API 时：Bing API Key [________________]
```

### 热切换机制

`webSearchEngine()` / `webSearchEndpoint()` / `loadBingApiKey()` 每次调用都实时 `readConfig()` 读磁盘文件，不再依赖启动时的一次性传参。Settings 保存 → 下一次 `web_search` 立刻生效。

---

## 二十九、Bug 修复汇总（2026-05-17）

### 29.1 yolo/admin 模式工作空间路径解析错误

**问题**：editMode 为 yolo 时，`list_directory` 显示 `C:\` 根目录文件而非工作空间内容。

**根因**：`safePath()` 在 `allowAllPaths()` 为 true 时调用 `resolve(raw)`，`.` 被解析为 Node.js 进程 CWD（`C:\`）而非 `rootDir`。

**修复**：`chunk-2R4QCDOZ.js:10067` → `pathMod4.resolve(rootDir, raw)`

| # | 文件 | 修改内容 |
|---|------|---------|
| 1 | `chunk-2R4QCDOZ.js` | `pathMod4.resolve(raw)` → `pathMod4.resolve(rootDir, raw)` |

### 29.2 list_directory 显示隐藏目录

**问题**：`list_directory` 工具零过滤，输出 `.visionox/`、`.git/`、`.cache/` 等应用内部目录。

**根因**：`list_directory` 的 `fn` 无隐藏目录过滤逻辑（`directory_tree` 和 `listDirectory` 均有过滤）。

**修复**：`chunk-2R4QCDOZ.js:10201` → 添加 `if (e.isDirectory() && e.name.startsWith(".")) continue;`

| # | 文件 | 修改内容 |
|---|------|---------|
| 1 | `chunk-2R4QCDOZ.js` | `list_directory` fn 增加 `.` 开头目录过滤 |

### 29.3 标题栏工作空间切换后不更新

**问题**：Dashboard 切换工作空间后，标题栏仍显示旧路径。

**根因**：标题栏 `wsRoot` 来自 `/health` 接口，仅组件挂载时拉取一次（空依赖 `[]`），无轮询。

**修复**：`app.js:29962-29971` → `/health` 改为每 8 秒轮询

| # | 文件 | 修改内容 |
|---|------|---------|
| 1 | `app.js` | `/health` 从一次性 fetch 改为 `setInterval(tick, 8e3)` |

### 29.4 SearXNG 地址保存按钮 bug

**问题**：SearXNG 地址输入框保存按钮读取的是旧值 `v3.webSearchEndpoint` 而非输入框内容。

**修复**：`app.js:27469` → `onClick` 改为 `document.getElementById("searxng-endpoint").value`

| # | 文件 | 修改内容 |
|---|------|---------|
| 1 | `app.js` | SearXNG 保存按钮改为读取 input 当前值 |

### 29.5 H3 标题暗色主题下不可见

**问题**：`### 中等变化（节点重分配）` 等 H3 标题在暗色主题下几乎看不到。

**根因**：H3 使用 `var(--grad-8)` 作为背景色但该 CSS 变量未定义，文字硬编码 `#0a0e14`（近黑）与暗色页面背景 `#0a0c10` 融为一体。

**修复**：
- 定义 `--grad-8: #f0abfc`（暗色）/ `#c084d6`（浅色）
- H3 文字色从 `#0a0e14` 改为 `var(--bg)`（主题适配）

| # | 文件 | 修改内容 |
|---|------|---------|
| 1 | `app.css` | 新增 `--grad-8` 变量 + H3 文字色主题适配 |

### 29.6 浅色主题代码块/工具参数对比度不足

**问题**：浅色主题下 inline code 琥珀色文字（`#e6a23c`）在灰底（`#f0f2f5`）上仅 3.65:1，低于 WCAG AA 4.5:1。

**修复**：
- 新增 `--c-code: #b87a14`（深琥珀色，对比度 ~7:1）
- `.md code` / `.md pre` / `.tool-args` 浅色主题文字色 + 背景色修正

| # | 文件 | 修改内容 |
|---|------|---------|
| 1 | `app.css` | 新增 `--c-code` + 3 处浅色主题代码块样式覆盖 |

### 29.7 模型预设切换后状态栏不更新

**问题**：对话框上方选择 auto/flash/pro 后，输入框下方的模型名始终显示 `deepseek-v4-flash`，不随预设变化。

**根因**：`launcher.mjs` 中 `applyPresetLive` 为空实现（只打 log），未调用 `loop?.configure()` 实时切换模型。

**修复**：`applyPresetLive` 根据 preset 值调用 `loop?.configure({ model, autoEscalate })`。

| # | 文件 | 修改内容 |
|---|------|---------|
| 1 | `launcher.mjs` | `applyPresetLive` 从空实现改为实时配置 loop 模型 |

### 29.8 导航栏重复 v3.png 图标

**问题**：导航栏 brand 区域出现两个 v3.png 图标，一大一小重叠。

**根因**：`index.html` 中 CSS `.glyph { background: url(/assets/v3.png) }` 和 `app.js` 中 `<img src="/assets/v3.png">` 同时渲染。

**修复**：删除 `index.html` 中多余的 `.glyph` CSS 规则。

| # | 文件 | 修改内容 |
|---|------|---------|
| 1 | `dashboard/index.html` | 移除 `.app-side .brand .glyph` CSS 背景图 |

---

## 三十、导航栏宽度缩减（2026-05-17）

**内容**：导航栏从 240px → 144px（缩减 40%），折叠态 64px → 40px。

| # | 文件 | 修改内容 |
|---|------|---------|
| 1 | `app.css` | `.app` grid-template-columns 240px→144px, `.collapsed` 64px→40px |

---

## 三十一、会话恢复 prompt 校验修复（2026-05-17）

**问题**：点击"加载并继续会话"报 `prompt (non-empty string) required`。

**根因**：`handleSubmit` 强制要求 prompt 非空，但 `doResume` 为恢复会话发送空 prompt。

**修复**：`server-XGDBRWMB.js:3168` → 当请求携带 `session` 参数时，允许 prompt 为空。

| # | 文件 | 修改内容 |
|---|------|---------|
| 1 | `server-XGDBRWMB.js` | prompt 校验：`!prompt.trim()` → `(!prompt.trim() && !session)` |

---

## 三十二、多配色方案（2026-05-18 ✅ 已实施）

### 内容

新增 4 套配色方案 + 保留原有浅色，右下角下拉框切换，实时生效无需刷新。

| 方案 | data-theme 值 | 特征 |
|------|--------------|------|
| 浅色 | `light` | 原有浅色主题（默认） |
| 深色 | `dark` | 暗底 + 琥珀强调 |
| 暖沙 | `warm-sand` | 暖黄底 + 古铜强调 |
| 冷灰 | `cool-ash` | 冷灰白底 + 灰蓝强调 |
| 柔绿 | `soft-sage` | 柔绿底 + 鼠尾草绿强调 |

### 修改清单

| # | 文件 | 修改内容 |
|---|------|---------|
| 1 | `theme/dark.css` | 新建 — 深色显式选择器 |
| 2 | `theme/warm-sand.css` | 修正 — 去 `:root`，选择器改为 `[data-theme="warm-sand"]` |
| 3 | `theme/cool-ash.css` | 同上 |
| 4 | `theme/soft-sage.css` | 同上 |
| 5 | `theme/COLOR_SCHEME_GUIDE.md` | 重写 — 4 套方案说明 + token 表 |
| 6 | `app.css` | 合并 4 个 `[data-theme="xxx"]` 块 |
| 7 | `app.js` | 左下角 `<span class="theme-btn">` 替换为 5 选项 `<select>` |

---

## 三十三、导航栏 OA/API 快捷链接（2026-05-18 ✅ 已实施）

### 内容

导航栏"计划"下方新增 OA 和 API 两个快捷链接。

| 按钮 | 目标 URL |
|------|----------|
| OA | `https://oa.visionox.com:8086/gvo/mainPortal/index.html` |
| API | `https://cloud.siliconflow.cn/i/1vfZWEo7` |

### 技术方案

点击通过 `POST /api/open-url` 调用 Node 服务端，使用 `start ""` (Windows) / `open` (macOS) / `xdg-open` (Linux) 在系统默认浏览器打开。不依赖 WebView 导航。

### 修改清单

| # | 文件 | 修改内容 |
|---|------|---------|
| 1 | `server-XGDBRWMB.js` | 新增 `handleOpenUrl` + 路由 |
| 2 | `app.js` | 导航栏注入 OA/API 两个 `<div class="side-tab">` |
| 3 | `app.css` | 补回 `.composer-chip` 样式（cursor:pointer 等） |

---

## 三十四、项目目录清理（2026-05-18）

- 删除 `src-tauri/target/`（构建产物，1562 MB）
- 删除 `node_modules/`（45 MB）
- 删除 `visionox-pkg-*-backup/`、`visionox-pkg-*-pre-pathfix/`（备份目录，72 MB）
- 删除 `esengine-DeepSeek-Reasonix-*/`（上游参考，9 MB）
- 项目从 1680 MB 缩减到 269 MB

---

## 三十五、mode-btn 选中态样式修复（2026-05-18）

**问题**：effort (high/max) 和 preset (auto/flash/pro) 按钮点击后无视觉反馈。app.css 重写时丢失了 `.mode-btn.active.accent` 样式。

**修复**：补回 `.mode-btn.active.accent { background: var(--accent-primary); color: #0c0d10; }`

| # | 文件 | 修改内容 |
|---|------|---------|
| 1 | `app.css` | 新增 `.mode-btn.active.accent` |

---

## 三十六、构建注意事项（2026-05-18）

**问题**：修改 `lib.rs`（含 `LOADING_HTML` 常量）或 `src/index.html` 后，Cargo 增量编译可能缓存旧版产物，导致加载页布局异常或启动逻辑未更新。

**解决**：修改这两个文件后执行 `cargo clean && cargo build --release` 确保全量重编。

**影响范围**：
- `src/index.html` → `tauri::generate_context!()` 宏嵌入
- `lib.rs` `LOADING_HTML` → `concat!()` 宏展开
- 两者都可能被增量缓存复用旧版本

---

## 三十七、上游 Cherry-Pick 合入（2026-05-19）

从 esengine/reasonix 上游合入 4 个补丁，版本对齐至 0.47.1。

### P0-1: login-shell PATH 发现（upstream e7fb669 → c181f67）

**问题**：macOS/Linux 上 GUI 启动的 Node 进程 PATH 不包含 Homebrew/用户安装的工具路径。

**修复**：`launcher.mjs` 新增 `augmentProcessPath()` — 使用 `$SHELL -ilc 'echo $PATH'` 探测真实 login shell PATH，拼接到 `process.env.PATH` 前端。Windows 下为 no-op。

| # | 文件 | 修改内容 |
|---|------|---------|
| 1 | `launcher.mjs` | 新增 `augmentProcessPath()` 函数 + 启动时调用 |

### P0-2: multi_edit 写入失败回滚（upstream c181f67 → 6e5fa83）

**问题**：`multi_edit` 工具批量写入文件时，部分写入失败已成功的修改未回滚，导致文件处于不一致状态。

**修复**：`applyMultiEdit` 的 write 循环改为 try-catch 包裹。写入失败时按逆序将已修改文件恢复为 `before` 内容。若恢复也失败，将恢复失败信息报告到错误消息中。

| # | 文件 | 修改内容 |
|---|------|---------|
| 1 | `chunk-O52OLQL3.js` | `applyMultiEdit` write 循环 → try-catch + 逆序回滚 |
| 2 | `chunk-2R4QCDOZ.js` | `multi_edit` 工具描述增加回滚说明 |

### P1-1: CODE_SYSTEM_TEMPLATE 压缩 -58%（upstream 6e5fa83 → e7fb669）

**问题**：系统提示词约 22,774 字符，每次 API 请求均发送，显著增加 token 费用。

**修复**：压缩 `CODE_SYSTEM_TEMPLATE` 至约 9,592 字符（-58%）。精简冗余句式，合并重复表述，保留完整功能语义。同时完成品牌化替换（Reasonix → Visionox）。

| # | 文件 | 修改内容 |
|---|------|---------|
| 1 | `chunk-5JJRUIPA.js` | `CODE_SYSTEM_TEMPLATE` 重写压缩 + 品牌化 + 反引号转义修复 |

**品牌化变更**：
- "You are Reasonix Code, a coding assistant" → "You are Visionox Code, a coding assistant"
- "You are Reasonix Code, a standalone coding assistant" → "You are a standalone coding assistant"
- "Reasonix VALIDATES citations" → "the tool validates citations"
- "critique Reasonix itself" → "critique the tool itself"

**踩坑**：模板文本内的反引号（`` `config.yaml` ``、`` `reasonix.md` ``）在压缩后的 JS 模板字面量中必须转义为 `` \` ``，否则破坏 JS 解析。曾导致应用启动时报 SyntaxError。

### P1-2: 工具描述压缩 -28%（upstream e7fb669 → 6e5fa83）

**问题**：工具描述冗长，每次请求随 tool_specs 发送，增加 token 费用。

**修复**：压缩 6 个工具描述（ask_choice、search_content、glob、todo_write、read_file、multi_edit 描述字段），总计节省约 2,500+ 字符（-28%）。保持功能完整性，仅精简措辞。

| # | 文件 | 修改内容 |
|---|------|---------|
| 1 | `chunk-2R4QCDOZ.js` | 6 个工具描述精简 |

### 合入后编译

`cargo build --release` 编译通过（34s），无新增 warning。产物 `visionox-desktop.exe` 启动正常，dashboard 可访问。

---

## 三十八、验证清单（最终更新）

- [x] `cargo build --release` 编译通过
- [x] P0-1 login-shell PATH 合入
- [x] P0-2 multi_edit 回滚合入
- [x] P1-1 系统提示词压缩 -58% 合入
- [x] P1-2 工具描述压缩 -28% 合入
- [x] 品牌化替换完成
- [x] 版本号：上游基线 0.47.1，应用版本 1.0.0（Cargo.toml / tauri.conf.json），npm workspace 0.1.0（package.json）
