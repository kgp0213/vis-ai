# Qwen 思考与推理能力边界

> 适用对象：公司内部部署的 Qwen3.5-397B-A17B-FP8（vLLM 0.21.0）
> 验证日期：2026-07-13，共 3 轮、23+ 次请求
> 本文只记录当前部署已经验证的能力、证据边界和 Visionox-Whale 配置方法。

## 已确认能力

思考参数位于 `extra_body.chat_template_kwargs`：

| 参数 | 当前部署行为 |
|---|---|
| `enable_thinking` | 有效。`true` 启用隐藏思考，`false` 不启用隐藏思考 |
| `thinking_budget` | 有效。控制隐藏思考的最大 token 预算，对复杂任务可能明显影响结果 |
| `reasoning_effort` | 无效。接口接受该字段但测试中没有观察到作用 |

当前接口不返回可见思考过程：非流式响应的 `reasoning` 为 `null`，流式响应没有
`reasoning_content`。因此客户端只能使用最终答案，不能展示或审计隐藏思考。

`thinking_budget` 是上限，不代表每次都会消耗满。当前推荐固定传入 `8192`；程序不会按问题难度
自动改值，简单问题通常由模型自行提前结束。

## 测试结论与边界

| 任务难度 | 观测结果 |
|---|---|
| 简单事实题 | `0 / 1024 / 4096 / 8192` 均正确，差异不明显 |
| 中等计算题 | 各档均正确，输出长度接近，没有可靠的质量梯度 |
| 困难逻辑题 | 各档均正确；`8192` 的答案更长，包含更多自纠和验证 |
| 极难路径题 | `0` 输出截断，`4096` 一次请求 120 秒无响应，`8192` 正确完成；关闭思考也正确完成 |

这些结果足以确认 `thinking_budget` 会影响复杂任务，但不能证明每个档位都单调提升：

- 极难题的 `1024` 未测试。
- `4096` 的一次超时可能来自模型或服务状态，不能证明该档位必然超时。
- 测试温度为 `0.6`，模型输出存在随机性；答案更长也不等于质量必然更高。
- `thinking_budget=0` 不等于关闭思考。需要关闭时应使用 `enable_thinking=false`。

基于当前证据，正式配置建议采用 `8192`，优先保证复杂任务的推理空间。简单任务没有观察到明显收益，
但也没有证据表明设置较大的预算会强制消耗满额 token。

## Visionox-Whale 如何使用

公司模型的 Provider 必须设置 `requestPolicy: "json"`。程序按以下规则处理：

1. 正式聊天读取模型的 `requestDefaults`。
2. `requestDefaults` 中的 Qwen 原生字段按原有层级传入 OpenAI 兼容的 `/chat/completions` 请求。
3. `model`、`messages`、`stream` 和 `tools` 由程序维护，JSON 不允许覆盖。
4. JSON 策略不会额外注入界面中的 DeepSeek `reasoning_effort` 或思考参数。
5. 模型通信检测会将 `verificationRequestDefaults` 递归覆盖到正式参数，只影响检测请求。

当前检测配置关闭 Qwen 思考，因此 10 秒通信检测只验证接口、API Key 和模型 ID，不会使用正式聊天的
`thinking_budget: 8192`。检测通过或失败不会改变正式请求参数。

只要公司模型继续兼容 OpenAI `/chat/completions`，以后调整 Base URL、API Key、模型 ID、上下文容量、
思考参数或其他原生字段都可以通过 JSON 完成，不需要修改或重新构建程序。只有接口协议发生变化时才需要
适配程序。

## JSON 配置

实际导入 JSON 中的 Qwen 模型建议保持以下关键结构：

```json
{
  "key": "company-qwen-primary",
  "id": "qwen3.5-397b-a17b",
  "name": "Qwen3.5-397B",
  "presets": ["flash"],
  "multimodal": true,
  "maxContextLength": 262144,
  "requestDefaults": {
    "temperature": 0.6,
    "max_tokens": 8192,
    "top_p": 0.95,
    "top_k": 20,
    "extra_body": {
      "chat_template_kwargs": {
        "enable_thinking": true,
        "thinking_budget": 8192
      }
    }
  },
  "verificationRequestDefaults": {
    "temperature": 0,
    "extra_body": {
      "chat_template_kwargs": {
        "enable_thinking": false
      }
    }
  },
  "agentPolicy": {
    "documentWorkflow": "guided",
    "maxToolIterations": 24,
    "maxToolContinuationWindows": 1,
    "sameFailureClassLimit": 2,
    "toolResultBudget": {
      "defaultTokens": 16000,
      "documentTokens": 32000,
      "absoluteMaxTokens": 32768
    },
    "documentPolicy": {
      "batchInputTokens": 3000,
      "batchOutputTokens": 8192,
      "maxUnitsPerBatch": 8,
      "maxRetries": 2,
      "autoFallback": true,
      "semanticBatching": true,
      "contextOverlapTokens": 1000,
      "maxModelCallsPerJob": 1000,
      "jobTimeoutMs": 21600000
    }
  }
}
```

配置含义：

- `thinking_budget: 8192`：每次正式对话允许的最大隐藏思考预算。
- `max_tokens: 8192`：可见回答的单次输出上限，与隐藏思考预算是两个不同参数；更长的 Markdown 需要普通模型工具循环分步读取和保存，不依赖一次生成全文。
- `agentPolicy.toolResultBudget`：控制普通工具结果预算。较大的工具输出由 `context-input-transaction` 缓存和物化，不存在 PDF 专用自动续读协议。
- `agentPolicy.documentWorkflow`：`guided` 只向普通模型循环注入文档访问提示，不启动独立执行流程。
- `agentPolicy.documentPolicy`、`maxModelCallsPerJob` 与 `jobTimeoutMs`：旧文档工作流兼容字段。当前 Launcher 不用它们创建后台任务、检查点或“继续”窗口。
- `requestProfiles.toolContinuation`：只在通用工具循环延续调用时覆盖正式请求参数，不应配置成后台文档草稿专用策略。
- `verificationRequestDefaults`：仅用于模型检测，不会覆盖磁盘中的正式配置。
- 不配置 `efforts`、`thinkingMode` 或 `reasoning_effort`：这些字段不能控制当前 JSON 策略下的 Qwen 推理。

## 升级检查

公司模型或 vLLM 升级后，应重新确认：

1. `enable_thinking` 和 `thinking_budget` 的字段层级是否变化。
2. `reasoning_effort` 是否开始生效，以及它与 `thinking_budget` 的优先级。
3. 思考过程是否通过 `reasoning_content` 返回。
4. 当前 `8192` 预算在代表性简单、复杂任务上的质量和延迟。
5. 模型通信检测在关闭思考后能否于 10 秒内完成。

未确认新行为前，只调整 JSON 中已经验证的字段，不在程序中硬编码 Qwen 档位映射。
