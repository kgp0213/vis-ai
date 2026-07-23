---
name: skill-creation-guide
description: 新建 Skill 的完整操作流程、目录结构、命名规范、调试方法和打包方式
type: reference
scope: global
---

# Skill 创建指南

基于实际 Skill 开发经验总结，涵盖从零创建到打包分发的完整流程。

---

## 一、命名规范（硬约束）

| 规则 | 示例 |
|------|------|
| 目录名只用 **英文小写 + 连字符** | ✅ `my-skill-name` ❌ `My Skill 名称` |
| 路径禁止空格、中文、大写字母 | ✅ `data-processor` ❌ `Data Processor` |
| 文件名同上 | ✅ `run-tool.js` ❌ `Run工具.py` |

> 空格和中文在 CLI 中需要引号包裹、跨平台路径可能乱码、Skill Hub 解析器不兼容。

---

## 二、Skill 目录结构

```
~/.visionox/skills/<skill-name>/
├── SKILL.md               # 【必需】Skill 描述（YAML front-matter + markdown）
├── README.md              # 【推荐】用户安装使用说明
├── _skillhub_meta.json    # 【推荐】Skill Hub 元数据
├── scripts/               # 核心脚本
│   └── <tool>.js / .py / .sh / .ps1
├── references/            # 参考文档
│   └── guide.md
└── templates/             # 模板文件（可选）
```

---

## 三、SKILL.md 文件规范

使用 YAML front-matter + Markdown：

```yaml
---
name: <skill-name>
description: "一句话英文描述"
version: 1.0.0
license: MIT
---
```

> **字段说明**：`name` 是唯一硬性必填字段（小写字母+数字+连字符，如 `my-skill`），运行时仅校验此项。
> `description`、`version`、`license` 等为可选元数据，当前运行时不解析但建议填写以便维护。
> 不要使用 `allowed-tools`、`description_zh`、`metadata` 等 Claude/Codex 专用字段--Visionox 的工具限制由工具注册层控制，不通过 frontmatter。

> **注意**：`---` 只包裹 YAML 头部，正文不要再用 `---` 做分隔线（某些解析器会误判）。

---

## 四、核心开发流程

### 第 1 步：选择技术栈

| 场景 | 推荐语言 | 原因 |
|------|---------|------|
| 文件格式转换 / JSON 处理 | Node.js | npm 生态丰富，无需运行时依赖 |
| 数据分析 / 表格处理 | Python | pandas / numpy 生态成熟 |
| 系统操作 / 批量文件处理 | Shell / PowerShell | 系统级调用，无依赖 |
| Web 交互 / 截图 | Node.js (puppeteer) | 浏览器自动化生态 |
| PDF 处理 | Python | PyMuPDF / reportlab 生态 |

> 优先选已知在当前环境可运行的语言。不确定时先用 `--version` 探测。

### 第 2 步：决定能力边界

- ✅ 明确声明「支持什么」
- ✅ 明确声明「不支持什么」（写在 SKILL.md 的 Limitations 节）
- ✅ 核心功能做到 90%，边缘情况留手动 fallback 或 `--force` 参数

### 第 3 步：脚本骨架模板

```javascript
#!/usr/bin/env node
/**
 * <skill-name> — 一句话描述
 *
 * 用法:
 *   node <tool>.js <input>          → 默认输出
 *   node <tool>.js <input> --out    → 指定输出目录
 *   node <tool>.js <input> --json   → JSON 格式
 *   node <tool>.js <input> --detect → 探测结构
 */
const fs = require('fs');
const path = require('path');

function main() {
  const args = process.argv.slice(2);
  const filePath = args[0];
  if (!filePath) { console.error('用法: ...'); process.exit(1); }
  // ... 核心逻辑
}

main();
```

### 第 4 步：测试流程

```
① 手动测试: node <tool>.js sample.file --detect
② 对比验证: 与已知正确的输出 diff
③ 边界测试: 空文件 / 大文件 / 特殊字符文件
```

**关键 checkpoints**：
- 输入不存在时给友好错误提示
- 输出路径不存在时自动创建
- 不带参数时显示 usage 信息并退出（非 0 退出码）

---

## 五、打包分发

### 方式一：source_dir 目录直接安装（开发/调试推荐）

直接告诉 AI：

```
请用 source_dir 安装 ~/my-skill/ 到 visionox
```

AI 会调用 `install_skill({ name: "my-skill", source_dir: "/path/to/my-skill/" })` 递归复制所有文件到 `~/.visionox/skills/<name>/`。无需打包，修改即时生效。

> **限制**：`source_dir` 必须指向当前工作区或其子目录；`/learn skill <目录>` 同样受此限制。如果用户消息中同时包含 `.skill`/`.zip` 压缩包路径和 `source_dir`，系统会拒绝 `source_dir` 并提示改用 `source`（压缩包方式）。

### 方式二：.skill 文件分发（跨机器部署）

```powershell
# 压缩
Compress-Archive -Path 'skill-dir\*' -DestinationPath 'skill-dir.zip' -Force
# 改名 .skill（本质是 ZIP）
ren skill-dir.zip skill-name.skill
```

用户安装：将 `.skill` 改回 `.zip`，解压到 `~/.visionox/skills/<skill-name>/`。

### 方式三：body 直接写入（仅单一 SKILL.md）

```
install_skill({ name: "my-skill", body: "---\nname: ...\n---\n..." })
```

仅创建 `SKILL.md` 文件，不会安装 `scripts/`、`references/` 等辅助文件。

### 方式四：用 `/learn skill <目录>` 自动萃取

在对话中输入：

```
/learn skill ./docs api-design-guide
```

Visionox 会扫描目录文本文件 → LLM 提炼规则 → 生成 `SKILL.md` 并安装。适用于把项目文档快速转为可复用 Skill。

---

## 六、脚本质量规范

### CLI 接口规范

```
node <tool>.js <input> [options]

选项:
  --out <dir>    指定输出目录（默认: 输入文件同目录）
  --json         输出 JSON 格式
  --detect       探测/预览模式（不写文件）
  --help         显示帮助
```

- 无参数时显示 usage（不要直接执行）
- 文件不存在时显示 `❌ 文件不存在: <path>` 并 exit 1
- 成功时输出 `✅ 生成: <path>` 并 exit 0

### 报错处理

```javascript
try {
  // 核心逻辑
} catch (err) {
  console.error('❌', err.message);
  process.exit(1);
}
```

### 安全原则

- 不要修改源文件（只读）
- 临时文件放在系统 temp 目录
- 不要硬编码 API Key / Token

---

## 七、常见陷阱

| 场景 | 问题 | 解决 |
|------|------|------|
| 文件名含空格 | 脚本参数被截断 | 用户传参用引号包裹；脚本内 `path.resolve()` |
| Windows 反斜杠 | `\n` 被解释为换行 | 路径用 `\\` 或 `/` |
| 中文路径 | CLI 编码不一致 | `cmd /c "dir 中文目录"` 而不是直接传 |
| 跨平台换行符 | `\n` vs `\r\n` | 输出统一用 `\n`；读取时 `.replace(/\r/g,'')` |
| 跨平台路径分隔符 | `\` vs `/` | 用 `path.join()` / `path.resolve()` |

---

## 八、快速创建模板

```bash
# 1. 创建目录结构
mkdir -p ~/.visionox/skills/<name>/{scripts,references,templates}

# 2. 创建 SKILL.md
cat > ~/.visionox/skills/<name>/SKILL.md << 'EOF'
---
name: <name>
description: "简短英文描述"
version: 1.0.0
---
EOF

# 3. 安装依赖
cd ~/.visionox/skills/<name>
npm install <pkg>
```

> **推荐工作流**：开发/调试时直接操作 `~/.visionox/skills/<name>/` 目录；分发时打包为 `.skill` 文件或使用 `source_dir` 安装。
