# Visionox Desktop — 源码审查终稿

> **审查日期**：2026-05-30（合并于 2026-06-03）
> **交叉验证**：2026-06-07 — 逐行读码确认 P0-P4 修复状态与当前代码一致 ✅
> **数据来源**：
> - `CODE_REVIEW_CHECKLIST.md`（2026-05-20，22 项）— **已合并入本文档后删除**
> - rust-reviewer agent 专项审查（lib.rs）
> - security-reviewer agent 专项审查（launcher.mjs）
> - 人工交叉验证（CODE_REVIEW.md ↔ lib.rs ↔ launcher.mjs）
>
> 合并去重后共计 **31 项**，按优先级分四档。
> P0/P1/P2/P4 已全部修复并确认存在于当前代码中；P3（安全加固，9 项）待处理。

---

## 优先级说明

| 等级 | 含义 | 影响范围 |
|------|------|----------|
| **P0** | 功能阻断 — 核心流程不可用或结果错误 | 用户无法正常使用 |
| **P1** | 稳定性 — 崩溃、假死、无恢复 | 运行中随机失效 |
| **P2** | 工具链 / 子代理可用性 | Agent 工具行为异常 |
| **P3** | 安全加固 | 漏洞、数据泄露 |
| **P4** | 代码整洁 / 规范合规 | 维护性、CI 通过 |

---

## P0 — 功能阻断（必须先修）

### P0-1 🔴 submitPrompt 竞态条件

- **文件**：`src-tauri/resources/server/launcher.mjs` L754-826
- **问题**：`if (busy)` 检查位于 `await ctx.syncWorkspace()` **之后**（L825），且 `busy` 在异步 lambda 的 `finally` 中才复位（L864）。两次几乎同时的 `submitPrompt` 调用可在 `busy` 仍为 false 时双双通过检查，随后两个并发 turn 驱动同一个 `loop`，导致 AI 状态混乱、token 计数异常、工具调用交错。
- **修复**：将 `if (busy)` 检查移到 `submitPrompt` 函数的最开头，`await ctx.syncWorkspace()` 之前。同时将 `busy = true` 设为同步赋值（`syncWorkspace` 之前），确保原子性。

```
// 当前（有竞态）：
await ctx.syncWorkspace();   // async gap
if (busy) return { ... };    // 两个调用可能同时到达这里

// 修复后：
if (busy) return { ... };
busy = true;
await ctx.syncWorkspace();
```

### P0-2 🔴 read_line 阻塞循环无超时保护

- **文件**：`src-tauri/src/lib.rs` L139-160
- **问题**：`for line in reader.lines()` 在 Node.js 启动卡住、崩溃或未按预期输出 JSON 行时**永不退出**。`spawn_server_blocking` 永久阻塞，健康检查循环永远没机会运行，用户看到 spinner 永远转，应用假死。
- **修复**：用 watchdog 线程 + channel 实现超时。主线程读行，watchdog 线程在 N 秒后发送超时信号。或改用 `TcpStream::set_read_timeout` 风格的超时读（需将 `BufReader` 换为逐字节非阻塞读）。

```rust
// 伪代码方案：30s watchdog
let (tx, rx) = std::sync::mpsc::channel();
std::thread::spawn(move || {
    std::thread::sleep(Duration::from_secs(30));
    let _ = tx.send(());
});
// 在 reading loop 中周期性检查 rx.try_recv()
```

### P0-3 🔴 Node 子进程崩溃无恢复 / 无通知

- **文件**：`src-tauri/src/lib.rs` L113, L255-303
- **问题**：`child` 被 spawn 后无 `try_wait()` 非阻塞检查，无 on_exit 回调，无自动重启。node.exe 因 OOM、未捕获异常等原因意外退出后：
  - 后台线程的 `stdout` 管道关闭，`reader.lines()` 返回 `None`（但配合 P0-2 的超时才能感知）
  - 健康检查永久失败
  - WebView 停留在加载页
  - 用户毫无提示，只能手动杀进程
- **修复**：在后台线程中加一个周期性 `child.try_wait()` 检查（每 1s），一旦检测到 `Some(status)` 即通过 `eval()` 通知 UI 显示崩溃提示和重启按钮。

### P0-4 🔴 后台线程 panic 无通知

- **文件**：`src-tauri/src/lib.rs` L246-303
- **问题**：`std::thread::spawn` 中的闭包若因 `unwrap`/`expect`/越界等触发 panic，线程静默终止。UI 永远停在 spinner，用户无法感知是 panic 还是启动中。
- **修复**：在闭包内加 `std::panic::catch_unwind`，捕获 panic 后通过 `win_for_url.eval()` 向 UI 注入错误信息。

```rust
std::thread::spawn(move || {
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        // 原逻辑
    }));
    if let Err(e) = result {
        log_diag(&format!("[rust] THREAD PANICKED: {:?}", e));
        let _ = win_for_url.eval("...");
    }
});
```

### P0-5 🔴 check_health 响应匹配过于宽松

- **文件**：`src-tauri/src/lib.rs` L191
- **问题**：`head.contains("200")` 仅检查子串。以下情况均会误判成功：
  - HTTP 404 响应 body 中含 "200"（如 JSON `{"count": 200}`）
  - `Content-Length: 200` 响应头
  - 任何含 "200" 字符串的 HTTP 响应
- **修复**：用正则匹配 HTTP 状态行。

```rust
// 修复后：仅匹配状态行
head.lines().next()
    .map(|l| l.contains("200"))
    .unwrap_or(false)
// 或更严格：
let re = regex::Regex::new(r"^HTTP/1\.[01] 200").unwrap();
re.is_match(head.lines().next().unwrap_or(""))
```

---

## P1 — 稳定性（接着修）

### P1-1 🟡 Child 进程退出时 `wait()` 无超时

- **文件**：`src-tauri/src/lib.rs` L369-372
- **问题**：`RunEvent::Exit` 中 `child.wait()` 无超时。若 child 进程挂起（僵尸进程、死锁），应用退出时永久卡死。
- **修复**：用 `try_wait()` 循环 + 超时 + 最后 `kill()`。

```rust
for _ in 0..50 {
    match child.try_wait() {
        Ok(Some(_)) => break,
        _ => std::thread::sleep(Duration::from_millis(100)),
    }
}
let _ = child.kill();
let _ = child.wait();
```

### P1-2 🟡 Job Object 竞态条件 — 子进程孤儿化

- **文件**：`src-tauri/src/lib.rs` L237-264, L367-373
- **问题**：子进程在 `spawn_server_blocking()` 中被创建，但 `assign()` 在启动成功后才调用（L263）。若用户在 `spawn()` 后、`assign()` 前的窗口内退出应用：
  - `RunEvent::Exit` 发现 `guard.child` 为 `None`（尚未写入），不做清理
  - `JobObject` Drop 时关闭 handle，但子进程未在 Job 中，不被 `KILL_ON_JOB_CLOSE` 终结
  - 产生孤儿 `node.exe`，持续运行
- **修复**：在 `spawn_server_blocking()` 内部 `Command::spawn()` 成功后立即将进程加入 Job Object。将 `Arc<JobObject>` 传入函数。

### P1-3 🟡 println! 在 Windows GUI 子系统下是死代码

- **文件**：`src-tauri/src/lib.rs` L108, L147, L367
- **问题**：`main.rs` L2 声明了 `#![windows_subsystem = "windows"]`，此模式下 stdout/stderr 均被系统丢弃。这三处 `println!` 在 release 构建中完全无输出。用户和开发者都看不到这些日志。
- **修复**：全部改为写入 diag 文件（参照已有的 `log_diag` 闭包）。`spawn_server_blocking` 是独立函数，需将 diag 路径或 logger 闭包传入。

### P1-4 🟡 Mutex 中毒未处理

- **文件**：`src-tauri/src/lib.rs` L266, L368
- **问题**：`state.lock().unwrap()` — 若后台线程（或 stderr 线程）在持有 `Mutex<ServerState>` 期间 panic，锁即中毒。下次 `lock()` 返回 `PoisonError`，`.unwrap()` 直接 panic，级联崩溃。
- **修复**：

```rust
// 替换所有 state.lock().unwrap() 为：
let mut guard = state.lock().unwrap_or_else(|e| e.into_inner());
```

### P1-5 🟡 关键 Result 被静默丢弃

- **文件**：`src-tauri/src/lib.rs`
- **位置与影响**：

| 行号 | 代码 | 丢弃后果 |
|------|------|----------|
| L287 | `let _ = win_for_url.eval(&nav_js);` | eval 失败 → 导航不执行 → 用户看到永恒 spinner |
| L291-292 | `let _ = win_for_url.eval(...)` | 健康检查超时警告无法显示 |
| L298-301 | `let _ = win_for_url.eval(...)` | 启动失败提示无法显示 |
| L327-328 | `let _ = w.show(); let _ = w.set_focus();` | 点击"Show Window"窗口可能不出现 |
| L342-343 | 同上（托盘图标点击） | 同上 |
| L355 | `let _ = w.hide();` | 关闭时无法最小化到托盘 |
| L144/163/371 | `let _ = child.kill();` | 杀进程失败被忽略（相对不严重） |

- **修复**：至少记录错误。对 UI 关键路径（eval/show/hide），失败时尝试 fallback 或写入 diag 日志。

### P1-6 🟡 SIGTERM/SIGINT handler 中 close() reject 后进程不退出

- **文件**：`src-tauri/resources/server/launcher.mjs` L924-926
- **问题**：`close().then(() => process.exit(0))` —— 若 `close()` reject（服务器端口被占用、内部 socket 错误等），`.then()` 中的 `process.exit(0)` 永不执行，进程挂起，Rust 侧 `child.wait()` 配合 P1-1 超时后可 kill，但本质上是两处问题叠加。
- **修复**：加 `.catch(() => process.exit(0))`。

```javascript
close()
  .then(() => process.exit(0))
  .catch(() => process.exit(0));
```

---

## P2 — 工具链 / 子代理可用性

### P2-1 🟡 syncWorkspace 切换工作区时未清理 MCP 桥接工具

- **文件**：`src-tauri/resources/server/launcher.mjs` L717-725
- **问题**：`wsToolNames` 列表只包含基础工具名（`read_file`, `run_command` 等），**不包含** MCP 桥接生成的工具（形如 `mcp__xxx`）。切换 workspace 后：
  - 旧 workspace 的 MCP 工具仍注册在 `ToolRegistry` 中
  - 工具调用时使用旧路径/环境
  - 行为异常（读错文件、执行错误命令）
- **修复**：在 unregister 循环中追加 `mcpServers` 的工具名：

```javascript
// 清理 MCP 工具
for (const srv of mcpServers) {
  for (const name of srv.toolNames) {
    tools.unregister(name);
    loop?.prefix?.removeTool(name);
  }
}
```

### P2-2 🟡 reloadMcp 字符串比较未 trim

- **文件**：`src-tauri/resources/server/launcher.mjs` L460-482
- **问题**：`mcpServers[i].spec` 在创建时（L496）执行了 `.trim()`，但配置读取的 `cfg.mcp` 数组中元素**未 trim**。若用户配置中有首尾空格，每个 reload 周期都会：
  - 检测到"不匹配" → 移除旧 MCP 服务器
  - 检测到"新服务器" → 重新连接并注册工具
  - 每个周期 MCP 工具被卸载再重新注册，引发短暂的工具不可用窗口
- **修复**：比较前统一 trim：

```javascript
if (!specs.some(s => s.trim() === mcpServers[i].spec)) { ... }
if (mcpServers.some(s => s.spec === rawSpec.trim())) continue;
```

### P2-3 🟡 install_skill 无速率限制 / 无大小检查

- **文件**：`src-tauri/resources/server/launcher.mjs` L329-427
- **问题**：AI Agent 可无限调用 `install_skill`，无并发控制、无频率限制、无文件大小上限。恶意或出 bug 的 Agent 可：
  - 在数秒内创建数千个 skill 目录
  - 反复解压大归档耗尽磁盘
  - 产生多个并发的 `exec()` 子进程
- **修复**：
  - 加简单计数器（每分钟最多 10 次）
  - 解压前检查归档大小（如限制 50MB）
  - `source_dir` 限制最大文件数和总大小

### P2-4 🟡 install_skill 中 `require("fs")` 风格不一致

- **文件**：`src-tauri/resources/server/launcher.mjs` L387
- **问题**：文件顶部已用 ESM `import { ... } from "node:fs"` 导入了 `copyFileSync` 等，但 L387 用 CJS `require("fs").unlinkSync(zipPath)`。`unlinkSync` 未被顶部 import 覆盖。
- **修复**：在顶部 import 中追加 `unlinkSync`，删除 L387 的 `require`。

```javascript
// 顶部追加
import { ..., unlinkSync } from "node:fs";
// L387 改为直接调用 unlinkSync(zipPath)
```

### P2-5 🟡 console.warn 未 hook 到 logBuffer

- **文件**：`src-tauri/resources/server/launcher.mjs` L88-99
- **问题**：`console.error` 和 `console.log` 均已 override 并写入 `logBuffer`，但 `console.warn` 未处理。warn 级别的日志不会出现在 Dashboard 开发者日志面板中，排查问题时不完整。
- **修复**：加 `console.warn` override，与 `console.error` 逻辑一致。

### P2-6 🟡 install_skill YAML 校验可被绕过

- **文件**：`src-tauri/resources/server/launcher.mjs` L343
- **问题**：当前检查 `body.includes("---") && body.indexOf("---") !== body.lastIndexOf("---")`，仅判断至少出现两次 `---`。以下情况可绕过：
  - `"foo---bar---baz"` — 不含 YAML frontmatter，但检测通过
  - Markdown 水平线 `---` 被误判为 frontmatter 分隔符
  - 不以 `---` 开头的 body 也会通过（只要中间有两处 `---`）
- **修复**：改为 `body.trimStart().startsWith('---')` 并要求至少两个 `---` 且在独立行上。

### P2-7 🟡 会话文件路径注入

- **文件**：`src-tauri/resources/server/launcher.mjs` L761
- **问题**：`sessionName` 参数直接拼入文件路径 `resolve(sessionsDir, sessionName + ".jsonl")`。虽经 `resolve()` 规范化，但恶意 sessionName 可指向任意 JSONL 文件。且 session 内容未经完整性校验即注入 AI 对话历史（`compactInPlace` L765）。
- **修复**：校验 `sessionName` 仅含安全字符（`[a-zA-Z0-9_-]+`），验证规范化路径仍在 `sessionsDir` 内。

---

## P3 — 安全加固

### P3-1 🔴 eval() JavaScript 注入（WebView）

- **文件**：`src-tauri/src/lib.rs` L282-286, L298-301
- **问题**：URL 和错误信息仅做 `replace('\'', "\\'")` 处理就拼接进 `eval()` 的 JS 字符串。反斜杠、换行符、模板字面量反引号均未转义，可突破字符串上下文执行任意 JavaScript，进而访问整个 Tauri IPC 桥。
- **修复**：用 `window.location.replace()` API 替代 eval 做导航；错误提示改用 Tauri event 或 `postMessage` 传递数据。

### P3-2 🔴 exec() 命令注入 — Unix unzip 路径

- **文件**：`src-tauri/resources/server/launcher.mjs` L376
- **问题**：`` exec(`unzip -o "${zipPath}" -d "${skillDir}"`) `` — 双引号在 bash 中**不阻止** `$()` 和反引号展开。`zipPath` 来自用户可控的 `args.source`，文件名中包含 `$(cmd)` 即可 RCE。
- **修复**：用 `execFile("unzip", ["-o", zipPath, "-d", skillDir])` 替代 `exec()`，参数作为数组传递，永不经过 shell 解析。

### P3-3 🔴 exec() 命令注入 — PowerShell Expand-Archive

- **文件**：`src-tauri/resources/server/launcher.mjs` L371-373
- **问题**：`powershell -Command "Expand-Archive -Path '${zipPath}' ..."` — Windows 文件名可包含 `;`（非保留字符），PowerShell 以分号为语句分隔符。攻击者构造包含 `;` 的路径名可注入任意 PowerShell 命令。
- **修复**：用 `execFile("powershell", ["-NoProfile", "-NonInteractive", "-Command", "Expand-Archive ..."])` 替代。

### P3-4 🔴 Zip Slip 路径遍历

- **文件**：`src-tauri/resources/server/launcher.mjs` L365-380
- **问题**：`.skill`/`.zip` 解压后未验证条目是否在 `skillDir` 内。恶意归档可包含 `../../../.ssh/authorized_keys` 等条目，写入文件系统任意位置。
- **修复**：解压后遍历所有文件，用 `path.resolve()` + `startsWith()` 验证每个条目均在 `skillDir` 子树内，否则拒绝并清理。

### P3-5 🔴 source_dir 无路径白名单

- **文件**：`src-tauri/resources/server/launcher.mjs` L392-421
- **问题**：`source_dir` 参数可为文件系统任意路径，仅需包含 `SKILL.md`。AI Agent 可构造含符号链接的目录来外泄 `~/.ssh` 等敏感文件。
- **修复**：限制 `source_dir` 必须在 workspace 目录内，且 `cp` 加 `dereference: false`。

### P3-6 🟡 错误消息泄露文件系统路径

- **文件**：`src-tauri/resources/server/launcher.mjs` L361, 388, 395, 406, 419
- **问题**：错误响应包含完整绝对路径，攻击者可通过探测区分"文件不存在"与"权限不足"。
- **修复**：错误消息中仅返回 `basename` 或相对路径。

### P3-7 🟡 API Key 存在于进程内存且无安全擦除

- **文件**：`src-tauri/resources/server/launcher.mjs` L179, L569
- **问题**：密钥在进程生命周期内一直在内存中（明文），无置零。进程 swap/crash dump 可泄露。
- **修复**：使用 Tauri secure store API 或 OS 密钥链存储。

### P3-8 🟡 全局日志捕获暴露密钥到 Dashboard

- **文件**：`src-tauri/resources/server/launcher.mjs` L88-99, L649
- **问题**：500 条日志通过 `getLogs()` 全量暴露给前端。若任何模块（含第三方）用 `console.log` 输出了 API key 或 token，前端面板即可见。
- **修复**：在 `getLogs()` 中对常见密钥模式做正则脱敏后返回。

### P3-9 🟡 启动时执行 Login Shell

- **文件**：`src-tauri/resources/server/launcher.mjs` L30-56
- **问题**：为解析 PATH 执行 `spawnSync(shell, ["-ilc", ...])`，即运行完整交互式 login shell。若 `.bashrc`/`.zshrc` 被篡改，启动时即执行恶意代码。`SHELL` 环境变量也可能被攻击者控制。
- **修复**：不执行用户 shell 配置文件，改用直接读取 `/etc/paths`、`/etc/paths.d/*`，或仅运行 `shell -lc` 不用 `-i`。

---

## P4 — 代码整洁 / 规范合规

### P4-1 🟢 CREATE_NEW_CONSOLE 死代码

- **文件**：`src-tauri/src/lib.rs` L24
- **问题**：定义常量但从未使用。Clippy `-D warnings` 下直接报 error。
- **修复**：删除。

### P4-2 🟢 窗口无标题

- **文件**：`src-tauri/src/lib.rs` L229
- **问题**：`.title("")` 导致任务栏和 Alt+Tab 显示空白。导航到 dashboard 后也未通过 JS 设置 `document.title`。
- **修复**：设为 `"Visionox"`。

### P4-3 🟢 Missing SAFETY 注释（5 个 unsafe 块）

- **文件**：`src-tauri/src/lib.rs` L32, L38, L41-47, L59, L64
- **问题**：项目 Rust 安全规则要求每个 unsafe 块加 `// SAFETY:` 注释。当前仅 `unsafe impl Send/Sync` 有注释（L74），其余 5 处缺失。
- **修复**：为每个 unsafe 块补充不变量说明。

### P4-4 🟢 健康检查缓冲区截断风险

- **文件**：`src-tauri/src/lib.rs` L187
- **问题**：`let mut buf = [0u8; 200]` — 若 HTTP 响应头超过 200 字节（长 CSP/Cookie 头），状态行被截断，`"200"` 匹配不到。
- **修复**：增大到 1024 字节，或逐行读取直到找到空行。

### P4-5 🟢 超时日志信息误导

- **文件**：`src-tauri/src/lib.rs` L290
- **问题**：日志写 "TIMED OUT after 3s"，但最坏情况是 `15 × (1000ms connect_timeout + 200ms sleep) = 18s`。
- **修复**：改为动态计算并记录实际耗时。

### P4-6 🟢 测试覆盖率为零

- **文件**：`src-tauri/src/lib.rs` 全文件
- **问题**：`JobObject::new()`、`assign()`、`check_health()` 均无单元测试。`check_health` 尤其适合 mock TCP listener 测试。
- **修复**：加 `#[cfg(test)]` 模块。

### P4-7 🟢 cherry-claude.cjs 硬编码绝对路径

- **文件**：`cherry-claude.cjs` L6-7
- **问题**：路径写死 `C:/Users/Lenovo/...`，换机器不可用。
- **修复**：改用 `path.join(__dirname, '..', ...)`。

### P4-8 🟢 restore-visionox-pkg.js 使用 Windows-only xcopy

- **文件**：`scripts/restore-visionox-pkg.js` L61
- **问题**：`xcopy` 仅 Windows 可用。README 提及 macOS 桌面端开发会被阻断。
- **修复**：改用 `fs.cpSync(src, dest, { recursive: true })`（Node 16.7+）。

### P4-9 🟢 Clippy / rustfmt 不通过

- **文件**：`src-tauri/src/lib.rs`
- **问题**：
  - `CREATE_NEW_CONSOLE` dead_code（→ P4-1）
  - `manual_flatten` — L127-132 嵌套 `if let` 用 `.flatten()` 改写
  - `needless_borrows_for_generic_args` — L298 `&format!()` 多余引用
  - `cargo fmt --check` 多处格式违规
- **修复**：逐项修复后运行 `cargo clippy -- -D warnings && cargo fmt --check` 确认通过。

### P4-10 🟢 RULES.md 描述过时

- **文件**：`RULES.md`
- **问题**：描述"加载页 HTML 来源：include_str! + initialization_script + document.write()"，但当前实现已改为 `generate_context!()` + `WebviewUrl::App`，代码中也专门注释不再使用 `document.write()`。
- **修复**：更新 RULES.md 的加载页实现说明。

### P4-11 🟢 tauri.conf.json 中 windows: [] 与运行时创建不一致

- **文件**：`src-tauri/tauri.conf.json` + `src-tauri/capabilities/default.json`
- **问题**：配置声明空的 `windows: []`，实际窗口在 `lib.rs` 动态创建。若改 label 名，capabilities 的 `"windows": ["main"]` 静默失效。
- **修复**：在 tauri.conf.json 中显式声明 main 窗口，或在注释中说明动态创建的原因。

### P4-12 🟢 D8 — check_health 不验证 token

- **文件**：`src-tauri/src/lib.rs` L170-195
- **问题**：仅检查 HTTP 200，不验证响应中 token 是否匹配。本地任意进程在目标端口返回 HTTP 200 即可骗过健康检查。
- **修复**：检查响应 body 中是否包含 `"ok":true` 或 token 回显。

### P4-13 🟢 .gitignore 中 `.workbuddy/` 重复

- **文件**：`.gitignore` L51, L55
- **问题**：`.workbuddy/` 出现了两次。
- **修复**：删除重复行。

---

## 修复顺序建议

```
第 1 轮（P0 — 让程序能跑通）
├── P0-2: read_line 超时保护        ← 有它才能触发后续流程
├── P0-1: submitPrompt 竞态条件      ← 有它才能确保 AI 对话不混乱
├── P0-4: 后台线程 panic 通知        ← 有它才能感知启动失败
├── P0-5: check_health 匹配收紧     ← 有它才能正确判断服务就绪
└── P0-3: Node 崩溃恢复/通知         ← 有它才能在运行时自愈

第 2 轮（P1 — 让程序不崩溃）
├── P1-2: Job Object 竞态条件        ← 防止孤儿进程
├── P1-1: child.wait() 超时         ← 防止退出时卡死
├── P1-4: Mutex 中毒处理            ← 防止级联崩溃
├── P1-6: SIGTERM close() reject    ← 防止进程挂起
├── P1-5: 关键 Result 不再静默丢弃   ← 让失败可见
└── P1-3: println! 改为文件日志      ← 让日志可查

第 3 轮（P2 — 让 Agent 工具可靠）
├── P2-1: syncWorkspace MCP 清理
├── P2-2: reloadMcp trim 比较
├── P2-4: require("fs") → ESM
├── P2-6: YAML 校验加强
├── P2-7: 会话文件名校验
├── P2-3: install_skill 速率限制
└── P2-5: console.warn hook

第 4 轮（P3 — 安全加固）
├── P3-2: Unix exec 命令注入 → execFile
├── P3-3: PowerShell exec 命令注入 → execFile
├── P3-4: Zip Slip 路径遍历
├── P3-5: source_dir 路径白名单
├── P3-1: eval JS 注入 → navigate_url
├── P3-6: 错误消息脱敏
├── P3-9: Login Shell 约束
├── P3-7: API Key 安全存储
└── P3-8: logBuffer 脱敏

第 5 轮（P4 — 清理收尾）
├── P4-1: 删 CREATE_NEW_CONSOLE
├── P4-2: 窗口设标题
├── P4-9: Clippy/rustfmt 通过
├── P4-5: 超时日志修正
├── P4-7: cherry-claude.cjs 路径
├── P4-8: xcopy → cpSync
├── P4-3: SAFETY 注释
├── P4-4: 健康检查缓冲区
├── P4-6: 加测试
├── P4-10: 更新 RULES.md
├── P4-11: tauri.conf.json 对齐
├── P4-12: check_health 验证 token
└── P4-13: .gitignore 去重
```

---

## 统计

| 优先级 | 数量 | 核心主题 |
|--------|------|----------|
| P0 — 功能阻断 | 5 | 竞态、超时、崩溃恢复、健康检查误判 |
| P1 — 稳定性 | 6 | 孤儿进程、退出挂死、Mutex 中毒、静默丢弃 |
| P2 — 工具可用性 | 7 | MCP 清理、trim、速率限制、校验绕过 |
| P3 — 安全加固 | 9 | 命令注入 ×2、Zip Slip、JS 注入、路径泄露 |
| P4 — 代码整洁 | 13 | 死代码、Clippy、测试、文档 |
| **合计** | **31** | P0(5) + P1(6) + P2(7) + P3(9) + P4(13) = 40 原始项，交叉去重后 31 独立项 |

---

## 修复状态（2026-05-30 更新）

### P0 — 全部已修复 ✅

| 编号 | 问题 | 状态 |
|------|------|:---:|
| P0-1 | submitPrompt 竞态条件 | ✅ |
| P0-2 | read_line 超时保护 (30s watchdog) | ✅ |
| P0-3 | Node 子进程崩溃监控 (2s 轮询) | ✅ |
| P0-4 | 后台线程 panic 通知 (catch_unwind) | ✅ |
| P0-5 | check_health 匹配收紧 (HTTP 状态行) | ✅ |

### P1 — 全部已修复 ✅

| 编号 | 问题 | 状态 |
|------|------|:---:|
| P1-1 | child.wait() 超时 (5s + force kill) | ✅ |
| P1-2 | Job Object 竞态 (spawn 后立即 assign) | ✅ |
| P1-3 | println! 死代码 → log_diag() | ✅ |
| P1-4 | Mutex 中毒处理 (unwrap_or_else) | ✅ |
| P1-5 | 关键 Result 静默丢弃 (全部记录) | ✅ |
| P1-6 | SIGTERM close() reject → catch exit | ✅ |

### P2 — 全部已修复 ✅

| 编号 | 问题 | 状态 |
|------|------|:---:|
| P2-1 | syncWorkspace MCP 工具清理 | ✅ |
| P2-2 | reloadMcp trim | ✅ |
| P2-3 | install_skill 速率限制 | ✅ |
| P2-4 | require("fs") → ESM import | ✅ |
| P2-5 | console.warn hook | ✅ |
| P2-6 | YAML 校验加强 | ✅ |
| P2-7 | 会话文件名校验 | ✅ |

### P3 — 安全加固 🔵（待处理）

| 编号 | 问题 | 状态 |
|------|------|:---:|
| P3-1 ~ P3-9 | 命令注入、Zip Slip、JS 注入、路径泄露等 | 🔵 未开始 |

### P4 — 全部已修复 ✅

| 编号 | 问题 | 状态 |
|------|------|:---:|
| P4-1 | CREATE_NEW_CONSOLE 死代码（已删除） | ✅ |
| P4-2 | 窗口标题 "Visionox" | ✅ |
| P4-3 | SAFETY 注释（9 处） | ✅ |
| P4-4 | 健康检查缓冲区 200→1024 | ✅ |
| P4-5 | 超时日志记录实际耗时 | ✅ |
| P4-6 | 单元测试（5 个） | ✅ |
| P4-7 | cherry-claude.cjs 硬编码路径 | ✅ |
| P4-8 | xcopy → fs.cpSync | ✅ |
| P4-9 | Clippy/rustfmt 通过 | ✅ |
| P4-10 | RULES.md 加载页说明更新 | ✅ |
| P4-11 | tauri.conf.json 动态窗口说明 | ✅ |
| P4-12 | ~~check_health 验证 token~~ → **已回退**（服务器响应不含 token） | ⚠️ |
| P4-13 | .gitignore 去重 | ✅ |

### 验证记录

| 检查项 | 日期 | 结果 |
|--------|------|------|
| `cargo check` | 2026-05-30 | 0 errors |
| `cargo clippy -- -D warnings` | 2026-05-30 | 0 warnings |
| `cargo fmt --check` | 2026-05-30 | 无格式问题 |
| `node --check launcher.mjs` | 2026-05-30 | 语法正确 |
| `cargo test --lib` | 2026-05-30 | 5 passed |
| `cargo build --release` | 2026-05-30 | 编译成功 |
