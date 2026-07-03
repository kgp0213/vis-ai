# Visionox 问题清单

> 按严重程度分级（P0–P3），记录当前代码库中已知未修复的问题、影响和建议修复方向。
> 本清单应随修复进度持续更新；修复后请将 **状态** 改为 ✅ 并补充 PR/提交信息。

---

## 严重程度说明

| 等级 | 含义 | 修复优先级 |
|------|------|-----------|
| **P0** | 阻塞核心功能或引入严重安全风险 | 立即 |
| **P1** | 显著影响可靠性、性能或可维护性 | 当前迭代 |
| **P2** | 影响边缘场景 UX 或增加技术债 | 排期处理 |
| **P3** | 清理、 polish、命名一致性问题 | 抽空处理 |

---

## P0 — 严重（立即修复）

| ID | 问题 | 位置 | 影响 | 状态 | 建议修复 |
|----|------|------|------|:----:|----------|
| P0-1 | Tauri 自定义命令 capability 未授权 | `src-tauri/capabilities/default.json` | `ping`、`get_clipboard_files` 命令已注册但 capability 只有 `core:default`，调用会超时/被拒绝，导致文件粘贴功能无法获取完整路径。 | ⏳ | 在 capability 中添加 `"allow-default"` 或为每个命令显式授权。 |
| P0-2 | Dashboard 存在 XSS 风险 | `src-tauri/resources/server/visionox-pkg/dashboard/dist/app.js` 多处使用 `dangerouslySetInnerHTML` | AI 返回的 markdown/HTML 直接注入 DOM，恶意脚本可执行。 | ⏳ | 引入 `DOMPurify` 清洗；配置 `marked` 禁用原始 HTML；为链接加 `rel="noopener noreferrer"`。 |
| P0-3 | `/api/open-url` 命令注入 | `src-tauri/resources/server/visionox-pkg/dist/cli/server-XGDBRWMB.js:3555-3578` | 用户/AI 提供的 URL 直接拼入 `start`/`open`/`xdg-open` 字符串，可注入 shell 命令。 | ⏳ | 校验 URL 协议白名单；使用 `spawn` 数组参数或 `opener` 库，避免 shell 解释。 |
| P0-4 | CSP 过于宽松 | `src-tauri/tauri.conf.json:15` | `default-src` 包含 `'unsafe-eval'`、`'unsafe-inline'` 和 `http://127.0.0.1:*` 通配，严重削弱 WebView 沙箱。 | ⏳ | 收紧 CSP：移除 `'unsafe-eval'`（除非必需），用具体端口替代 `*`；dashboard 页面加 `<meta>` CSP。 |
| P0-5 | MCP / Hook 执行任意命令 | `launcher.mjs` MCP/hook 配置、`src-tauri/resources/server/visionox-pkg/dist/cli/chunk-6AK4EY3D.js` | MCP 和 hook 运行配置中指定的任意二进制，配合 `shell: true` 可注入命令。 | ⏳ | 对用户配置的 MCP 命令做白名单/校验；Windows 上避免 `shell: true`；转义所有参数。 |

---

## P1 — 高（当前迭代）

| ID | 问题 | 位置 | 影响 | 状态 | 建议修复 |
|----|------|------|------|:----:|----------|
| P1-1 | 剪贴板读取未使用 OLE/COM | `src-tauri/src/lib.rs:612-707` | 仍用 `OpenClipboard(NULL)` + `GetClipboardData(CF_HDROP)`，在 WebView2 异步调用中不稳定，常返回空。 | ⏳ | 改用 `OleGetClipboard` 获取 `IDataObject`，枚举格式并读取 `CF_HDROP`/`FileNameW`。 |
| P1-2 | `src-tauri/src/lib.rs` 单体文件 | `src-tauri/src/lib.rs`（786 行） | 窗口管理、子进程、JobObject、健康检查、剪贴板、托盘、测试全部耦合。 | ⏳ | 拆分为 `window.rs`、`server.rs`、`clipboard.rs`、`tray.rs`、`diag.rs` 等模块。 |
| P1-3 | 启动时同步阻塞 IO | `launcher.mjs:436-438, 442, 709, 852` | `cpSync`/`copyFileSync`/`readFileSync` 阻塞 Node 事件循环。 | ⏳ | 启动流程改用异步流式读写。 |
| P1-4 | 子进程崩溃后无自动重启 | `src-tauri/src/lib.rs:417-444` | monitor 线程只在 UI 显示错误，不尝试重启 Node 服务。 | ✅ | 增加指数退避重试机制（最多 N 次），多次失败后提示用户。已实现 `CHILD_MAX_RESTART_ATTEMPTS` 崩溃重启 + eval 重新注入 URL（1.0.2）。 |
| P1-5 | 发行包包含调试产物 | `src-tauri/resources/server/visionox-pkg/dist/cli/*.map`、`.bak`、`node_modules` 中 dev 依赖 | 安装包体积大、暴露源码、攻击面增加。 | ⏳ | 构建脚本删除 `.map`、`.bak`、测试文件；`npm prune --production` 瘦身。 |
| P1-6 | `stderr` 日志逐行重新打开文件 | `src-tauri/src/lib.rs:199-222` | 每行都 `OpenOptions::open`，IO 开销大。 | ⏳ | 保持文件句柄或使用 `BufWriter` 批量写入。 |
| P1-7 | dashboard `tabSections()` 面板反复 remount | `src-tauri/resources/server/visionox-pkg/dashboard/dist/app.js:30412` | 每次渲染返回新的 panel 函数组件，Preact 会卸载/重挂当前面板，丢失滚动位置和输入状态。 | ⏳ | 将 panel 组件定义提到 render 外部，或用 `useMemo` 固定引用。 |

---

## P2 — 中（排期处理）

| ID | 问题 | 位置 | 影响 | 状态 | 建议修复 |
|----|------|------|------|:----:|----------|
| P2-1 | Token 通过 URL 查询字符串传递 | `src-tauri/src/lib.rs:288-291`、`dashboard/dist/app.js:18902` | Token 出现在浏览器历史、代理日志、Referer 中。 | ⏳ | 静态资源以外的请求改用 `X-Visionox-Token` Header。 |
| P2-2 | SSE 缺乏重连/退避与取消 | `dashboard/dist/app.js:23794-23895` | EventSource 错误仅弹 toast；轮询请求未取消，可能重叠。 | ⏳ | 增加重连退避；使用 `AbortController` 取消过期请求。 |
| P2-3 | 日志无滚动/大小限制 | `src-tauri/src/lib.rs:40-54`、`launcher.mjs` | `launcher-diag.log`、stderr 日志无限追加。 | ⏳ | 增加文件大小上限和滚动策略（如保留最近 5 个 10MB 文件）。 |
| P2-4 | 静默 `catch {}` 过多 | `launcher.mjs` 多处、`dashboard/dist/app.js:19148, 23756, 24322` | 错误被吞，排查困难。 | ⏳ | 至少通过 `console.error` 或 `log_diag` 记录错误详情。 |
| P2-5 | `validate_dashboard_url` 校验较弱 | `src-tauri/src/lib.rs:273-275` | 仅检查前缀，未校验 scheme/host。 | ⏳ | 使用 `url` crate 解析并校验 scheme 为 `http`、host 为 `127.0.0.1`。 |
| P2-6 | `get_clipboard_files` FileNameW 回退裸指针遍历 | `src-tauri/src/lib.rs:686-692` | 通过 `while *ptr.add(len) != 0` 找终止符，若 handle 异常可能越界。 | ⏳ | 改用 `OleGetClipboard` + `IDataObject` 统一读取，不再裸读。 |
| P2-7 | `index.html` 恢复 dashboard 时信任 sessionStorage | `src/index.html:104-121` | 从 `sessionStorage` 读取 URL 后直接设给 iframe，仅有正则校验。 | ✅ | 增加 scheme/host/port 白名单校验，确保只加载本地 dashboard。已改为 localStorage 后备 + Rust `get_dashboard_url` 兜底 + iframe 失败回退三层机制（1.0.2）。 |

---

## P3 — 低（抽空处理）

| ID | 问题 | 位置 | 影响 | 状态 | 建议修复 |
|----|------|------|------|:----:|----------|
| P3-1 | 命名不一致 | 仓库各处 | `Visionox`、`vis-ai`、`visionox-desktop`、`vnx` 混用。 | ⏳ | 统一品牌名和目录/包名；清理旧命名兼容代码。 |
| P3-2 | 遗留 `tep/desktop/` 代码 | `tep/desktop/src-tauri/` | 包含未使用的旧 Tauri 实现，可能误导。 | ✅ | 删除或明确标记为 deprecated/归档。已移至 `archive/tep-desktop/` 并标注说明（1.0.2）。 |
| P3-3 | 硬编码魔法值 | `src-tauri/src/lib.rs`、`launcher.mjs` | 超时、轮询间隔、大小限制等分散且硬编码。 | ⏳ | 提取到配置文件或常量模块。 |
| P3-4 | `single_instance` 插件丢弃启动参数 | `src-tauri/src/lib.rs:325` | 第二实例的参数被忽略，无法从 shell 打开文件/项目。 | ⏳ | 在回调中处理 `_args` 并传给主窗口。 |
| P3-5 | 托盘 tooltip 写死中文 | `src-tauri/src/lib.rs:549-551` | 不考虑多语言环境。 | ⏳ | 根据系统 locale 动态设置或仅保留英文。 |
| P3-6 | 构建 rerun 触发路径可能错误 | `src-tauri/build.rs:3` | `cargo:rerun-if-changed=../src` 相对路径可能不被 Cargo 正确解析。 | ⏳ | 使用绝对路径或验证相对路径行为。 |

---

## 最近已修复（参考）

| ID | 问题 | 修复位置 | 修复时间 |
|----|------|----------|----------|
| FIXED-6 | WebView2 刷新卡死（iframe + sessionStorage 断链） | `src/index.html`、`src-tauri/src/lib.rs` | 2026-06-25 |
| FIXED-7 | eval 中 sessionStorage 裸调用未 try-catch | `src-tauri/src/lib.rs`（两处 eval 统一 try） | 2026-06-25 |
| FIXED-8 | iframe 加载失败无回退（localStorage 残留旧端口） | `src/index.html`（error + 6s 超时 → fallbackToRust） | 2026-06-25 |
| FIXED-9 | effort 切换无运行日志 | `launcher.mjs`、`chunk-P7EKE5ZQ.js` | 2026-06-24 |
| FIXED-1 | docs 目录记忆存储路径漂移 | `docs/memory-work-modes-guide.md/html` | 2026-06-23 |
| FIXED-2 | README 断链 `docs/ECC_INTEGRATION.md` | `README.md` | 2026-06-23 |
| FIXED-3 | `DEVELOPMENT_RULES.md` / `UI_DESIGN_SYSTEM.md` 主题持久化描述过时 | `docs/DEVELOPMENT_RULES.md`、`docs/UI_DESIGN_SYSTEM.md` | 2026-06-23 |
| FIXED-4 | `CHANGELOG.md` 混合换行符 | `docs/CHANGELOG.md` | 2026-06-23 |
| FIXED-5 | 文档版本号 1.0.0 未更新 | `docs/DEVELOPMENT_RULES.md`、`docs/ECC_GAP_ANALYSIS.md` | 2026-06-23 |

---

## 更新规则

1. 新增问题：按严重程度插入对应表格，ID 连续编号。
2. 修复完成：将状态 `⏳` 改为 `✅`，在 **建议修复** 列补充修复提交或 PR 链接。
3. 问题降级/升级：移动整行到对应等级表格，并更新 ID（建议保留历史 ID 注释）。
4. 每轮发布前复核一次本清单，确保与代码状态一致。
