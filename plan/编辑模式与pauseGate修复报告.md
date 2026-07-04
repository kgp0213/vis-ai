# 编辑模式优化、pauseGate 修复与弹窗位置调整报告

> 日期：2026-07-04
> 范围：编辑模式合并、审计日志、安全增强、pauseGate 桥接、弹窗位置优化、learn-sandbox-impl.mjs 修复
> 涉及文件：launcher.mjs、server-XGDBRWMB.js、chunk-XPDVG52A.js、chunk-45U62RI3.js、chunk-2R4QCDOZ.js、app.js、app.css、tauri.conf.json、lib.rs

---

## 一、编辑模式优化

### 1.1 review 合并到 auto

桌面版未注册 pauseGate 监听器，review 和 auto 行为完全相同（非白名单命令均报错）。合并后保留三模式体系：

| 模式 | 文件编辑 | Shell 命令 | 文件系统 | 切换确认 |
|---|---|---|---|---|
| auto | 自动应用 | 白名单内执行，其他需确认 | 沙箱隔离 | 无 |
| yolo | 自动应用 | 全部自动执行 | 沙箱隔离 | 切换时确认 |
| admin | 自动应用 | 全部自动执行 | 无限制 | 切换时确认 |

改动文件：app.js（模式按钮 4→3）、server-XGDBRWMB.js（默认值+错误消息）、chunk-XPDVG52A.js（loadEditMode 回退值）、launcher.mjs（setEditMode 别名处理）

### 1.2 审计日志激活

ctx.audit 之前从未定义，30+ 处审计调用全部静默跳过。实现为追加写入 ~/.visionox/audit.jsonl。

### 1.3 安全增强

- yolo/admin 切换添加 confirm() 确认对话框
- admin 警告卡片（accent-err 红色，比 yolo 的 accent-warn 更醒目）
- yolo 沙箱行为统一：/learn 的 allowAllPaths 改为 admin 专属，移除 yolo 的 path_access 自动批准
- contextCapTokens 校验不超过模型 maxContextLength

### 1.4 其他

- appliesAt 指示器更新：contextCapTokens/preset/model 从 "next-session"/"next-turn" 改为 "live"
- UI 文本 "重启或 /new 后生效" 改为 "即时生效"
- 清理死代码：移除 flip-to-auto 按钮和 editReviewTitle i18n
- 大上下文模型双阈值：1M 窗口在 200K 开始折叠（原 500K），tail 预算限制在 40K（原 200K）

---

## 二、pauseGate 修复

### 2.1 问题

桌面版未注册 pauseGate 监听器，所有 gate.ask() 调用抛出 "no confirmation listener registered"，导致 auto 模式下非白名单命令直接报错而非弹窗确认。

### 2.2 修复（仅 launcher.mjs，约 120 行）

在 launcher.mjs 中添加：

1. 导入 pauseGate（chunk-O52OLQL3.js）和 autoResolveVerdict（chunk-45U62RI3.js）
2. 注册 pauseGate.on(listener) 监听器，映射 7 种请求类型：
   - plan_checkpoint → autoResolveVerdict 自动继续
   - path_access → 自动拒绝+警告（HTTP dashboard 无此弹窗类型）
   - run_command/run_background → shell 弹窗
   - choice → choice 弹窗
   - plan_proposed → plan 弹窗
   - plan_checkpoint（未自动解决）→ checkpoint 弹窗
   - plan_revision → revision 弹窗
3. 实现 getActiveModal() + 5 个 resolve 回调（shell/choice/plan/checkpoint/revision）
4. abortTurn 和 rebuildLoop 中调用 pauseGate.cancelAll()
5. pauseGate.setAuditListener 接入审计日志

### 2.3 修复前后对比

| 场景 | 修复前 | 修复后 |
|---|---|---|
| auto 模式非白名单命令 | 报错 | 弹出 ShellModal 确认 |
| auto 模式访问沙箱外路径 | 报错 | 警告+自动拒绝 |
| plan_checkpoint | 报错 | 自动继续 |
| Esc 中断 | 未清理 | cancelAll 清理 |

---

## 三、弹窗位置优化

### 3.1 问题

授权弹窗渲染在 chat-body 上方（工具栏和消息列表之间），远离聊天输入框。

### 3.2 修复

- app.js：将 ${modal} 表达式从 chat-body 上方移到 ChatFeed 和 chat-input-area 之间
- app.css：恢复缺失的 .modal-card 系列样式（约 160 行），使用新 token，添加 flex-shrink:0 和 box-shadow

### 3.3 效果

弹窗紧贴输入框上方，ChatFeed 自动收缩让出空间。

---

## 四、learn-sandbox-impl.mjs 修复

### 4.1 问题

日志显示 30 次 "failed to load learn.mjs: Cannot find module learn-sandbox-impl.mjs"。learn.mjs 顶部静态导入此文件，缺失导致整个 /learn 模块加载失败。

### 4.2 根因

两个配置都遗漏了此文件：
- tauri.conf.json 的 resources 数组
- lib.rs 的 ensure_server_resources NEEDED 数组

### 4.3 修复

- tauri.conf.json：添加 "resources/server/learn-sandbox-impl.mjs"
- lib.rs：NEEDED 数组添加 "learn-sandbox-impl.mjs"

### 4.4 日志问题核实

| 问题 | 状态 |
|---|---|
| learn-sandbox-impl.mjs 缺失 | 已修复 |
| MCP officecli 路径解析 | 旧版已修复（quoteMcpCommand） |
| MCP officecli 超时 | 旧版已修复（同上） |
| SyntaxError: Unexpected token '=' | 旧版已修复（打包 bug） |
| ReferenceError: DEFAULT_MODES | 旧版已修复（TDZ 顺序） |

---

## 五、修改文件汇总

| 文件 | 改动项 |
|---|---|
| launcher.mjs | pauseGate 监听器+5 回调+cancelAll+audit+setEditMode 别名+/learn allowAllPaths+summaryModel 更新+syncProvider 广播+refreshContextCap |
| server-XGDBRWMB.js | appliesAt 更新+cap 校验+默认 editMode+错误消息+contextCapTokens refresh |
| chunk-XPDVG52A.js | loadEditMode 回退值改 auto |
| chunk-45U62RI3.js | 移除 yolo path_access 自动批准 |
| chunk-2R4QCDOZ.js | 双阈值常量+decideAfterUsage+decidePreflight+fold+预检二次检查 |
| chunk-RE4RAVFF.js | preflightStillOver 翻译键 |
| app.js | 模式按钮+确认对话框+admin 警告卡片+flip-to-auto 移除+i18n+下拉框+config-changed handler+弹窗位置+setSetting 刷新 |
| app.css | .modal-card 系列样式恢复 |
| tauri.conf.json | 添加 learn-sandbox-impl.mjs |
| lib.rs | NEEDED 数组添加 learn-sandbox-impl.mjs |
