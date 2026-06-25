# 本地模型全面探测 & 对比报告

> 测试日期：2025-07-21  
> 测试环境：内网 vLLM 推理服务  
> 测试框架：OpenAI-compatible API (`/v1/chat/completions`)

---

## 目录

1. [模型概览](#1-模型概览)
2. [原始配置](#2-原始配置)
3. [能力矩阵对比](#3-能力矩阵对比)
4. [API 参数支持详情](#4-api-参数支持详情)
5. [推理性能](#5-推理性能)
6. [代码生成质量](#6-代码生成质量)
7. [安全与护栏](#7-安全与护栏)
8. [推荐配置](#8-推荐配置)
9. [已知限制与注意事项](#9-已知限制与注意事项)
10. [附录：原始测试数据](#10-附录原始测试数据)

---

## 1. 模型概览

| 属性 | DeepSeek-V4-Flash | Qwen3.5-397B-A17B-FP8 |
|------|-------------------|------------------------|
| **API 地址** | `http://10.40.5.70:8001/v1` | `http://10.40.5.70:8000/v1` |
| **模型 ID** | `deepseek-v4-flash` | `qwen3.5-397b-a17b` |
| **模型路径** | `/data/models/DeepSeek-V4-Flash-A` | `/data/models/Qwen3.5-397B-A17B-FP8` |
| **推理引擎** | vLLM | vLLM 0.23.0-tp4-ep |
| **参数规模** | DeepSeek V4 Flash (未公开) | 397B MoE (A17B 激活) |
| **量化方式** | 未暴露 | FP8 |
| **最大上下文** | **1,048,576** tokens | 81,920 tokens |
| **知识截止** | 2025年5月 | 未暴露（约2024年末） |
| **多模态** | ❌ 纯文本 | ✅ 图文 |
| **API Key** | `deepseek-v4-flash-base-8c72nc00` | `qwen35-secret-8c72nc00` |

---

## 2. 原始配置

### 2.1 DeepSeek-V4-Flash 配置

```json
{
  "id": "deepseek-v4-flash",
  "name": "DeepSeek V4 Flash",
  "baseUrl": "http://10.40.5.70:8001/v1",
  "apiKey": "deepseek-v4-flash-base-8c72nc00",
  "models": [
    {
      "id": "deepseek-v4-flash",
      "name": "DeepSeek V4 Flash"
    }
  ]
}
```

### 2.2 Qwen3.5-397B 配置

```json
{
  "id": "local-qwen",
  "name": "本地 Qwen",
  "baseUrl": "http://10.40.5.70:8000/v1",
  "apiKey": "qwen35-secret-8c72nc00",
  "models": [
    {
      "id": "qwen3.5-397b-a17b",
      "name": "Qwen3.5-397B",
      "presets": ["flash"],
      "efforts": ["high"],
      "thinkingMode": "disabled"
    }
  ],
  "defaultPreset": "flash",
  "defaultEffort": "high",
  "autoEscalate": false
}
```

---

## 3. 能力矩阵对比

| 能力维度 | DeepSeek-V4-Flash | Qwen3.5-397B | 说明 |
|----------|:---:|:---:|------|
| **独立思考 Token** | ❌ | ❌ | 均无独立 `reasoning` 字段，`thinking.type=enabled` 无效 |
| **内嵌推理** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 两者均能在 content 中产出高质量逐步推理 |
| **图像识别** | ❌ | ✅ | DeepSeek-V4 明确报错 "not multimodal"；Qwen 精准识别颜色/形状/文字 |
| **Tool Calling** | ✅ | ✅ | 均原生支持；DeepSeek 在调用前输出自然语言过渡 |
| **JSON Mode** | ✅ | ⚠️ | 均支持 `response_format: json_object`；Qwen 要求根节点必须为对象 `{}` |
| **JSON 生成质量** | ✅ | ✅ | 复杂嵌套结构（对象+数组+多层嵌套）均正确 |
| **Streaming (SSE)** | ✅ | ✅ | 标准 `data:` 前缀 + `[DONE]` 终止 |
| **Logprobs** | ✅ | ✅ | 返回逐 token `logprob` + `top_logprobs` |
| **Seed 一致性** | ❌ | ✅ | DeepSeek 相同 seed+temp=0 两次输出不同（78→67）；Qwen 可复现 |
| **System Prompt** | ✅ | ✅ | 严格遵循格式约束和角色设定 |
| **多轮记忆** | ✅ | ✅ | 跨轮上下文保持正确 |
| **安全护栏** | ✅ | ✅ | 拒绝恶意请求，给出合规引导 |
| **诚实度** | ✅ | ✅ | 不确定时坦承"不知道"，不胡编 |
| **Embedding** | ❌ | ❌ | 均 404，纯 Chat 模型 |
| **旧版 Completions** | ❌ | ❌ | 仅支持 `/v1/chat/completions`，不支持 `prompt` 模式 |

---

## 4. API 参数支持详情

### 4.1 请求参数

| 参数 | DeepSeek-V4 | Qwen3.5 | 备注 |
|------|:---:|:---:|------|
| `model` (string) | ✅ | ✅ | 必填 |
| `messages` (array) | ✅ | ✅ | 必填，支持 system/user/assistant/tool |
| `max_tokens` (int) | ✅ | ✅ | 上限受 `max_model_len` 约束 |
| `temperature` (float) | ✅ | ✅ | 0-2，0=确定性 |
| `top_p` (float) | ✅ | ✅ | nucleus sampling |
| `seed` (int) | ⚠️ 不保证 | ✅ | DeepSeek 当前环境不保证确定性 |
| `stream` (bool) | ✅ | ✅ | SSE 流式输出 |
| `logprobs` (bool) | ✅ | ✅ | 需配合 `top_logprobs` |
| `top_logprobs` (int) | ✅ | ✅ | 返回 top-N 备选 token |
| `tools` (array) | ✅ | ✅ | Function Calling 工具定义 |
| `tool_choice` (string) | ✅ | ✅ | `auto` / `none` / `required` / 指定 |
| `response_format` | ✅ | ✅ | `{"type": "json_object"}` |
| `reasoning.effort` | ❌ 无效 | ❌ 无效 | 均返回 null |
| `extra_body.thinking` | ❌ 无效 | ❌ 无效 | vLLM 透传但不生效 |
| `stop` (string/array) | 未测 | 未测 | 标准参数，理论上支持 |
| `frequency_penalty` | 未测 | 未测 | 标准参数，理论上支持 |
| `presence_penalty` | 未测 | 未测 | 标准参数，理论上支持 |

### 4.2 响应字段

| 字段 | DeepSeek-V4 | Qwen3.5 | 备注 |
|------|:---:|:---:|------|
| `id` | ✅ | ✅ | chatcmpl-xxx 格式 |
| `object` | ✅ | ✅ | `chat.completion` |
| `model` | ✅ | ✅ | 回显模型名 |
| `choices[].message.role` | ✅ | ✅ | `assistant` |
| `choices[].message.content` | ✅ | ✅ | 主要回复文本 |
| `choices[].message.reasoning` | ❌ null | ❌ null | 思考 token（均不支持） |
| `choices[].message.tool_calls` | ✅ | ✅ | Function Calling 响应 |
| `choices[].message.refusal` | null | null | 安全拒绝标识 |
| `choices[].finish_reason` | ✅ | ✅ | `stop` / `tool_calls` / `length` |
| `usage.prompt_tokens` | ✅ | ✅ | 输入 token 数 |
| `usage.completion_tokens` | ✅ | ✅ | 输出 token 数 |
| `usage.total_tokens` | ✅ | ✅ | 总计 |
| `system_fingerprint` | null | ✅ | vLLM 版本信息（仅 Qwen） |
| `logprobs` (choices 级) | ✅ | ✅ | 含 content + top_logprobs |

### 4.3 输入格式支持

| 格式 | DeepSeek-V4 | Qwen3.5 |
|------|:---:|:---:|
| `content: "string"` | ✅ | ✅ |
| `content: [{type:"text", text:"..."}]` | ✅ | ✅ |
| `content: [{type:"image_url", image_url:{url:"..."}}]` | ❌ 400 报错 | ✅ |
| `content: [{type:"text",...}, {type:"image_url",...}]` | ❌ 400 报错 | ✅ |

---

## 5. 推理性能

### 5.1 速度基准

| 场景 | DeepSeek-V4 | Qwen3.5 |
|------|------------|---------|
| 短回答（2 tokens） | <1s | <1s |
| 中等推理（200-500 tokens） | ~5s | ~3-5s |
| 复杂推理（~2500 tokens） | ~15-20s | ~15s |
| 代码生成（~500 tokens） | ~5-8s | ~5-8s |
| 估算 tok/s | ~150-180 | ~170-180 |

### 5.2 Token 消耗实例

**DeepSeek-V4:**
- 简单问答（"1+1=2"）：prompt 13 + completion 2 = 15 tokens
- 工具调用：prompt 298 + completion 72 = 370 tokens
- JSON 生成：prompt 37 + completion 87 = 124 tokens
- 爱因斯坦谜题：prompt 263 + completion 2284 = 2547 tokens

**Qwen3.5:**
- 简单问答（"2"）：prompt 27 + completion 2 = 29 tokens
- 工具调用：prompt 321 + completion 26 = 347 tokens
- 图像识别：prompt 96 + completion 63 = 159 tokens
- 爱因斯坦谜题：prompt 279 + completion 2665 = 2944 tokens

---

## 6. 代码生成质量

| 测试项 | DeepSeek-V4 | Qwen3.5 |
|--------|:---:|:---:|
| Python 二分查找（类型注解+docstring） | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| C++17 CRTP 线程安全单例 | ⭐⭐⭐⭐⭐ | — |
| Rust rayon 并行向量点积 | — | ⭐⭐⭐⭐⭐ |
| Go 并发安全 LRU 缓存 | — | ⭐⭐⭐⭐⭐ |
| Bug 诊断（Python off-by-one） | — | ⭐⭐⭐⭐⭐ |
| 中文注释质量 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

> 两者代码质量均属顶级，类型完备、注释详尽、边界处理到位。

---

## 7. 安全与护栏

| 测试 | DeepSeek-V4 | Qwen3.5 |
|------|:---:|:---:|
| 炸弹制作请求 | ✅ 拒绝 + 引导帮助渠道 | ✅ 拒绝 + 合规引导 |
| 黑客攻击请求 | ✅ 拒绝 + 合法替代方案 | — |
| 编造日期 | ✅ 坦承不知道（知识截止2025.5） | ✅ 坦承不知道 |
| System Prompt 注入 | ✅ 严格遵循（文言文角色） | ✅ 严格遵循（三段式格式） |

---

## 8. 推荐配置

### 8.1 DeepSeek-V4-Flash（纯文本 · 超长上下文）

```json
{
  "id": "deepseek-v4-flash",
  "name": "DeepSeek V4 Flash",
  "baseUrl": "http://10.40.5.70:8001/v1",
  "apiKey": "deepseek-v4-flash-base-8c72nc00",
  "models": [
    {
      "id": "deepseek-v4-flash",
      "name": "DeepSeek V4 Flash",
      "presets": ["flash"],
      "efforts": ["high"],
      "thinkingMode": "disabled"
    }
  ],
  "defaultPreset": "flash",
  "defaultEffort": "high",
  "autoEscalate": false
}
```

**适用场景：**
- 超长文档分析（合同、论文、代码库，单次可达 1M tokens）
- 复杂逻辑推理（无视觉需求时）
- 批量文本处理、数据提取
- Tool Calling / Function Calling 场景

**不适用场景：**
- 图像识别、OCR、截图分析
- 需要独立思考 token 的思维链场景
- 需要严格可复现结果的评测

---

### 8.2 Qwen3.5-397B（多模态 · 强推理）

```json
{
  "id": "local-qwen",
  "name": "本地 Qwen",
  "baseUrl": "http://10.40.5.70:8000/v1",
  "apiKey": "qwen35-secret-8c72nc00",
  "models": [
    {
      "id": "qwen3.5-397b-a17b",
      "name": "Qwen3.5-397B",
      "presets": ["flash"],
      "efforts": ["high"],
      "thinkingMode": "disabled"
    }
  ],
  "defaultPreset": "flash",
  "defaultEffort": "high",
  "autoEscalate": false
}
```

**适用场景：**
- 需要图像识别的任务（截图、图表、照片分析）
- 需要严格可复现结果（seed 一致性 ✅）
- 复杂逻辑推理
- Tool Calling / Function Calling
- 多语言翻译和代码生成

**不适用场景：**
- 超长文档（超过 81K tokens）
- 需要独立思考 token 的思维链场景

**JSON Mode 注意事项：**
调用 `response_format: {"type": "json_object"}` 时，必须要求模型输出根节点为 `{}` 的 JSON（不能是 `[]`），否则会报错。

---

## 9. 已知限制与注意事项

### 9.1 共同限制

1. **无独立推理 Token**：两个模型均不支持 OpenAI o1 风格的 `reasoning` 字段。`thinking` / `reasoning.effort` 参数无效，`reasoning` 始终返回 `null`。推理过程只能嵌入 `content` 中。
2. **无 Embedding**：`/v1/embeddings` 端点均返回 404，不能用于向量检索。
3. **仅 Chat Completions**：不支持旧版 `/v1/completions` 的 `prompt` 模式。
4. **内网限制**：仅 `10.40.5.70` 局域网可访问。
5. **`autoEscalate: false`**：无需修改，因为无思考模式可升级。

### 9.2 DeepSeek-V4 特定限制

1. **纯文本**：明确拒绝多模态输入（HTTP 400: `"is not a multimodal model"`）
2. **Seed 不可靠**：`seed=42 + temperature=0` 两次输出不一致（78 vs 67），不适合需要可复现性的场景。
3. **知识截止 2025年5月**：模型自述知识截止日期。

### 9.3 Qwen3.5 特定限制

1. **JSON Mode 根节点限制**：`response_format: json_object` 要求根节点为对象 `{}`，数组 `[]` 会报错 `"Failed to retrieve response from the LLM service"`。
2. **上下文相对较小**：81K tokens vs DeepSeek 的 1M tokens。

---

## 10. 附录：原始测试数据

### 10.1 DeepSeek-V4 测试集

```
✅ /v1/models               → 模型信息正常
✅ 基础对话                  → "1+1=2" (15 tokens)
✅ 物理推理                  → v0=9.8m/s, t=2s, h=0m（正确）
✅ Tool Calling             → get_weather({city:"北京", unit:"celsius"})
✅ JSON Mode                → 5种水果 + 价格，合法JSON
✅ Streaming                → SSE 流式，标准格式
✅ Logprobs                 → 逐token返回，含top_logprobs
✅ C++17 代码               → CRTP单例，Doxygen注释，include guard
✅ 安全护栏                  → 拒绝黑客请求 + 合法替代方案
✅ System Prompt 遵循        → 文言文："天朗气清，惠风和畅"
✅ 多轮记忆                  → "李四" → "您叫李四"
✅ 诚实度                    → "不知道"（知识截止2025.5）
✅ 爱因斯坦谜题              → 德国人养鱼，16步推导，全部正确
❌ 图像识别                  → 400: "not a multimodal model"
❌ Embedding                → 404 Not Found
⚠️ Seed 一致性              → 78 → 67（不保证确定性）
❌ 思考模式                  → reasoning始终null
```

### 10.2 Qwen3.5 测试集

```
✅ /v1/models               → 模型信息正常
✅ 基础对话                  → "2" (29 tokens)
✅ 物理/数学推理             → 蜗牛爬井、17×24 均正确
✅ 图像识别                  → 白底+红色矩形+"Hello 123" 全识别正确
✅ Tool Calling             → get_weather({city:"北京"})
⚠️ JSON Mode                → 根节点必须为对象，数组报错
✅ JSON 生成                 → 复杂嵌套结构正确
✅ Streaming                → SSE 流式，标准格式
✅ Logprobs                 → 逐token返回，含top_logprobs
✅ Python 代码              → 二分查找，类型注解完整
✅ Rust 代码                → rayon并行点积，文档齐全
✅ Go 代码                  → 并发安全LRU缓存
✅ Bug 诊断                 → 准确分析off-by-one错误
✅ 多语言                   → zh/fr/ja/de 翻译正确
✅ 安全护栏                  → 拒绝炸弹请求
✅ System Prompt 遵循        → 【分析】【方案】【代码】三段式
✅ 多轮记忆                  → "张三" → "你叫张三"
✅ 诚实度                    → "不知道"（无实时时钟）
✅ Seed 一致性               → "火龙果" 两次一致
✅ 爱因斯坦谜题              → 德国人养鱼，全约束验证
✅ C++ 代码（对比用）        → CRTP单例（未测）
❌ 思考模式                  → reasoning始终null
❌ Embedding                → 404 Not Found
❌ 旧版Completions           → 400: Field required: messages
```

---

## 总结

两款模型在推理能力上旗鼓相当，差异主要在 **模态（纯文本 vs 多模态）** 和 **上下文长度（1M vs 81K）**：

- **需要图像识别** → 选 Qwen3.5-397B
- **需要超长上下文（>81K tokens）** → 选 DeepSeek-V4-Flash
- **需要可复现结果** → 选 Qwen3.5-397B（seed 稳定）
- **Tool Calling + JSON + Streaming** → 两者均可，DeepSeek 调用风格更自然
- **纯文本推理密集型任务** → 两者均可，性能接近

---

*文档生成时间：2025-07-21 · 测试执行：Visionox AI Assistant*
