# Visionox Desktop — 源码问题清单

> 审查日期：2026-06-07 · 源码行号均经 `findstr` 交叉验证 · 方法论：[andrej-karpathy-skills](https://github.com/kgp0213/andrej-karpathy-skills)

---

## P3 — 安全加固（9 项）

| 编号 | 文件:行号 | 问题 |
|------|----------|------|
| P3-1 | lib.rs:351,380,392,401,419 | **eval() JS 注入** — URL/错误信息仅 `replace('\'', "\\'")` 拼接，反斜杠/反引号未转义 |
| P3-2 | launcher.mjs:425 | **exec() 命令注入** — unzip 路径模板字符串拼接，`$(cmd)` 可在 bash 中执行 |
| P3-3 | launcher.mjs:420 | **PowerShell 命令注入** — 文件名含 `;` 可注入任意 PS 命令 |
| P3-4 | launcher.mjs:420-430 | **Zip Slip** — 解压后未验证条目在 skillDir 内，可写入 `../../../` 路径 |
| P3-5 | launcher.mjs:392-421 | **source_dir 无路径白名单** — 可构造符号链接外泄 `~/.ssh` |
| P3-6 | launcher.mjs:361,388,395,406,419 | **错误消息泄露绝对路径** |
| P3-7 | launcher.mjs:179,569 | **API Key 明文驻留进程内存**，无安全擦除 |
| P3-8 | launcher.mjs:88-99,649 | **logBuffer 暴露密钥** — 500 条日志全量给前端 |
| P3-9 | launcher.mjs:30-56 | **Login Shell 执行** — `spawnSync(shell, ["-ilc", ...])`（仅 macOS/Linux） |

---

## 🟢 极小（7 项，~20 分钟）

| 编号 | 文件:行号 | 问题 | 操作 |
|------|----------|------|------|
| VX-01 | lib.rs:175,193,308,359 | 4 处 `thread::spawn` 的 `JoinHandle` 未保存 | 各加 `let _handle =` |
| VX-02 | lib.rs:166 | `job.assign(child.id())?;` 失败后 child 脱离 JobObject → 孤儿进程 | `?` 前加 `let _ = child.kill();` |
| VX-05 | launcher.mjs:1065-1070 | API key 缺失时欢迎消息无提示，用户发消息才报错 | 欢迎消息加 `⚠️ 未配置 API Key` |
| VX-06 | launcher.mjs:76 | `augmentProcessPath()` 在 import 时同步执行（Windows 无影响） | 安全隐患由 P3-9 独立追踪 |
| VX-07 | theme/ | 3 个 CSS 文件存在但 dashboard 未引用 | 删除或接入 |
| VX-08 | launcher.mjs:112-118 | `--port=28980`（`=` 连接）不识别 | 加 `startsWith("--port=")` 分支 |
| VX-09 | restore-visionox-pkg.js:16 | 默认版本 `"0.39.1"` 与 README 的 260530 不一致 | 更新默认值 |

## 🟡 小（5 项，~3-4 小时）

| 编号 | 文件:行号 | 问题 | 操作 |
|------|----------|------|------|
| VX-10 | restore-visionox-pkg.js:53-54 | `nodeModulesBackup` + `hasNodeModules` 声明但从不读取（死代码 + 无效 I/O） | 删除 |
| VX-11 | launcher.mjs:218-232 | `WORKSPACE_TOOL_NAMES_BASE` 与 `registerWorkspaceTools()` 构成双真相源 | 让函数返回 `{toolNames, hasSemantic}` |
| VX-12 | lib.rs:582,597 | 2 个测试用 `sleep(50ms)` 同步线程，高负载下 flaky | 改用 `mpsc::channel` |
| VX-13 | lib.rs:480-493 | 关闭→托盘无提示，用户不知应用仍在运行 | 首次 `hide()` 设 tooltip |
| VX-14 | launcher.mjs:569-650 | `buildSystemPrompt()` 静态模板，MCP/skill 热加载工具不体现在策略指引中 | 追加 `tools.specs()` 摘要 |

## 🟠 中（3 项，~1-2 天）

| 编号 | 文件:行号 | 问题 | 操作 |
|------|----------|------|------|
| VX-15 | lib.rs + launcher.mjs | 缺失 E2E 集成测试 | 写 mock Node 脚本验证 spawn→health→URL |
| VX-16 | .github/ | 缺失 CI/CD | `check` + `clippy` + `test` + `node --check` |
| VX-17 | cherry-claude.cjs | anchor 变化时静默 SKIP，CLAUDE.md 功能无声失效 | 加校验和，不匹配时 `exit(1)` |

## 🔴 大（2 项，~3-5 天）

| 编号 | 文件 | 问题 | 操作 |
|------|------|------|------|
| VX-18 | launcher.mjs (1096行) | 单文件 6 种职责耦合 | 拆分为 tools / sessions / workspace 三模块 |
| VX-19 | launcher.mjs:141-182 | 12 个 chunk 文件名硬编码，上游升级 100% 断裂 | 推动上游提供 manifest；短期自动扫描生成 import map |

---

> 已修复项（P0-P2/P4 共 29 项）及证伪项（VX-03/04/14）详见修订记录。
> 审查依据：[Andrej Karpathy's LLM Coding Pitfalls](https://x.com/karpathy/status/2015883857489522876)
