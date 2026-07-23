# 模型配置 JSON 参数说明

> 适用版本：Visionox-Whale 1.28.0。本文面向维护人员和辅助编写配置的 AI，用于新增、更新、停用或删除模型。普通用户只需通过“导入模型配置 → 检测全部模型 → 可选删除检测失败模型”完成操作；涉及永久删除的配置会额外确认一次。

## 1. 先确定更新类型

| 需求 | 推荐格式 | 原因 |
|---|---|---|
| 新电脑完整配置、增加一个全新服务商 | Schema v2 | 可以一次提供服务商、凭据和完整模型数组 |
| 在已有服务商中增加一个模型 | Schema v3 `upsertModel` | 只修改目标模型，不覆盖同服务商的其他模型 |
| 修改模型 ID、名称、参数或能力 | Schema v3 `updateModel` | 使用稳定 `modelKey` 精确更新 |
| 模型临时下架 | Schema v3 `disableModel` | 可恢复，优先于永久删除 |
| 同步服务商当前完整模型清单 | Schema v3 `syncModels` | 清单外模型自动停用，不永久删除 |
| 永久删除模型或服务商 | Schema v3 `removeModel` / `removeProvider` | 导入前会要求破坏性操作确认 |

本文示例中的 URL、Key 和模型 ID 都是不可直接导入的占位值。真实配置文件必须写入实际值，不能把 `<...>` 占位符留在准备导入的 JSON 中。

## 2. Schema v2：完整服务商配置

```json
{
  "schemaVersion": 2,
  "importMode": "merge",
  "providers": [
    {
      "id": "company-provider",
      "name": "公司模型",
      "baseUrl": "https://api.example.com/v1",
      "apiKey": "replace-with-real-key",
      "requestPolicy": "json",
      "models": [
        {
          "key": "company-model-primary",
          "id": "model-api-id",
          "name": "模型显示名称",
          "presets": ["flash"],
          "multimodal": false,
          "maxContextLength": 262144,
          "capabilities": {
            "protocol": "openai-chat-completions",
            "inputModalities": ["text"],
            "streaming": true,
            "structuredOutput": false,
            "maxContextTokens": 262144,
            "maxOutputTokens": 8192,
            "roles": ["chat", "document-draft", "document-review", "summary"]
          },
          "requestDefaults": {
            "temperature": 0.2,
            "max_tokens": 8192
          },
          "verificationRequestDefaults": {
            "temperature": 0,
            "max_tokens": 8
          }
        }
      ],
      "defaultPreset": "flash",
      "autoEscalate": false
    }
  ],
  "activeProviderId": "company-provider"
}
```

### v2 顶层字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `schemaVersion` | 推荐 | 固定为 `2`；省略时也按 v2 处理 |
| `importMode` | 推荐 | `merge`：新增服务商或浅合并同 ID 服务商；`replace`：完整替换 JSON 中同 ID 的服务商 |
| `providers` | 是 | 非空服务商数组 |
| `removeProviderIds` | 否 | 明确永久删除的服务商 ID；不能同时导入和删除同一个 ID |
| `activeProviderId` | 否 | 导入后默认启用的服务商，必须指向导入后确实存在的服务商 |

注意：v2 的 `merge` 是服务商级浅合并。只要传入 `models`，就会用传入的整个模型数组替换该服务商原数组。给已有服务商增加单个模型时不要使用 v2 `merge`，应使用 v3 `upsertModel`。

### 服务商与模型分组展示

同一个模型平台下配置多个独立 provider 时，可以使用 provider 的 `ui` 字段控制模型选择器分组。展示字段不参与请求、路由、检测指纹或回退判断。

```json
{
  "id": "volcengine-ark-kimi-k3",
  "name": "Kimi K3（火山云）",
  "ui": {
    "groupId": "volcengine-ark",
    "groupName": "火山方舟 Ark",
    "family": "通用与推理",
    "modelLabel": "Kimi K3",
    "order": 130,
    "recommendedFor": ["chat", "vision", "long-context"]
  }
}
```

| 字段 | 说明 |
|---|---|
| `groupId` | 稳定分组 ID；相同 ID 的 provider 在模型选择器中显示在同一个一级分组下 |
| `groupName` | 面向用户的一级分组名称，例如“火山方舟 Ark” |
| `family` | 模型类别，例如“通用与推理”“代码”“轻量”，用于搜索和后续筛选 |
| `modelLabel` | provider 在模型列表中的简洁名称；具体模型仍显示 `models[].name` |
| `order` | 分组内排序，范围 `-10000` 到 `10000` |
| `recommendedFor` | 展示与推荐标签，最多 20 项；不能代替 `capabilities.roles` 等运行时能力声明 |

禁止根据相同 API Key 或 `baseUrl` 自动合并 provider。不同账号、权限、请求参数和限流策略可能共用同一 URL，只有显式相同的 `groupId` 才能归为一组。旧配置省略 `ui` 时继续按独立服务商展示。

## 3. Schema v3：新增单个模型

```json
{
  "schemaVersion": 3,
  "operations": [
    {
      "op": "upsertModel",
      "providerId": "company-provider",
      "model": {
        "key": "company-model-2026",
        "id": "new-model-api-id",
        "name": "新模型",
        "presets": ["flash"],
        "multimodal": false,
        "maxContextLength": 262144,
        "capabilities": {
          "protocol": "openai-chat-completions",
          "inputModalities": ["text"],
          "streaming": true,
          "structuredOutput": false,
          "maxContextTokens": 262144,
          "maxOutputTokens": 8192,
          "roles": ["chat", "document-draft", "document-review", "summary"]
        },
        "requestDefaults": {
          "temperature": 0.2,
          "max_tokens": 8192
        },
        "verificationRequestDefaults": {
          "temperature": 0,
          "max_tokens": 8
        }
      }
    }
  ]
}
```

`upsertModel` 必须提供稳定的 `model.key`。同一个 `key` 已存在时执行更新，不存在时新增。模型 API ID 或显示名称以后变化时，仍保留原 `key`，这样维护 JSON 才能找到同一个逻辑模型。

### v3 支持的操作

| `op` | 必要参数 | 行为 |
|---|---|---|
| `updateProvider` | `providerId`, `changes` | 更新名称、URL、Key、请求策略或默认模型策略 |
| `upsertModel` | `providerId`, `model` | 按稳定 `model.key` 新增或更新模型 |
| `updateModel` | `providerId`, `modelKey`, `changes` | 精确修改已有模型 |
| `disableModel` | `providerId`, `modelKey` | 保留配置但停止选择该模型 |
| `removeModel` | `providerId`, `modelKey` | 永久删除模型，需要确认 |
| `syncModels` | `providerId`, `models` | 同步完整清单，清单外模型自动停用 |
| `removeProvider` | `providerId` | 永久删除非当前服务商，需要确认 |

## 4. 服务商字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | 是 | 服务商稳定 ID。导入、更新、回退路由都依赖它，不要随显示名称变化 |
| `name` | 推荐 | UI 显示名称 |
| `baseUrl` | 运行必需 | OpenAI 兼容服务地址，通常以 `/v1` 结束，按服务商实际说明填写 |
| `apiKey` | 运行必需 | 真实凭据。日常只轮换 Key 时优先使用设置页“检测 API → 保存凭据” |
| `requestPolicy` | 推荐 | `json`：请求参数以 JSON 为准；`legacy` 或省略：使用兼容旧逻辑 |
| `models` | 是 | 至少包含一个未停用模型 |
| `defaultPreset` | 推荐 | 服务商默认档位，必须能在某个模型的 `presets` 中找到 |
| `defaultEffort` | 否 | 默认推理强度，仅对实际支持该参数的兼容模型有意义 |
| `autoEscalate` | 否 | 是否允许从默认模型自动升级到 `escalationModel` |
| `escalationModel` | 否 | 自动升级目标的模型 API ID，必须属于当前服务商且未停用 |

## 5. 模型字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `key` | v3 必填 | 本地稳定标识。模型改名、换 API ID 后也不应改变 |
| `id` | 是 | 请求发送给服务商的真实模型 ID |
| `name` | 推荐 | UI 显示名称，可写成“模型名（仅文本）”等明确能力说明 |
| `presets` | 推荐 | 模型可响应的 UI 档位，例如 `flash`、`pro`、`auto` |
| `efforts` | 否 | 可显示的推理强度选项；不要给不支持推理强度的模型填写 |
| `effortParams` | JSON 策略可选 | `efforts` 中每个选项对应的原生请求参数；用户选择后递归合并到 `requestDefaults` |
| `thinkingMode` | 否 | 通用兼容模式可用 `enabled` / `disabled`；厂商专用思考参数应放入 `requestDefaults` |
| `multimodal` | 推荐 | 只有接口经过图片请求实测成功时才设为 `true`；`false` 表示绝不发送 `image_url` |
| `maxContextLength` | 旧版兼容 | 正整数，表示模型上下文上限。旧版程序依赖此字段；新版若已提供合法的 `capabilities.maxContextTokens`，可以不重复填写 |
| `capabilities` | 推荐 | 显式能力契约，供新版程序做协议适配、角色路由和保守限流；真实配置文件仍建议保留旧字段以兼容旧版程序 |
| `requestDefaults` | JSON 策略必填 | 正式请求原生参数；按服务商规定的字段和层级透传 |
| `verificationRequestDefaults` | 否 | 仅在模型/API 检测时递归覆盖正式参数，常用于关闭耗时思考 |
| `agentPolicy` | 否 | 普通模型工具循环的轮次、延续窗口、工具结果预算，以及历史文档配置兼容字段 |
| `visionPolicy` | 图片模型可选 | 图片数量、清晰度和上下文预留；文本模型不要配置 |
| `disabled` | 否 | `true` 时保留配置但不参与选择、检测或回退 |

### 图片能力必须按接口实测

- `multimodal: true` 会让程序向该模型发送图片内容；错误声明会直接造成 `image_url` 请求失败。
- DeepSeek Flash 和 DeepSeek Pro 当前均应配置为 `multimodal: false`，不配置 `visionPolicy`。
- 模型名称含 `Pro`、`Vision` 或 `VL` 不能代替接口实测。
- 同一模型在不同服务商代理接口上的能力可能不同，以当前 `baseUrl` 的实际请求结果为准。

## 6. 能力契约与运行时解析

`capabilities` 是程序使用的模型能力元数据，不会原样发送给服务商。推荐配置如下：

```json
{
  "protocol": "openai-chat-completions",
  "inputModalities": ["text", "image"],
  "streaming": true,
  "structuredOutput": false,
  "maxContextTokens": 262144,
  "maxOutputTokens": 8192,
  "maxImagesPerRequest": 5,
  "roles": [
    "chat",
    "document-draft",
    "document-review",
    "vision-review",
    "summary"
  ]
}
```

| 字段 | 说明 |
|---|---|
| `protocol` | 当前支持 `openai-chat-completions`，表示使用 OpenAI 兼容的 Chat Completions 协议 |
| `inputModalities` | 输入模态；纯文本模型填 `["text"]`，图片接口实测成功后才可增加 `"image"` |
| `streaming` | 当前接口是否经过流式响应实测；省略表示未知，不应因为模型名称推断为支持 |
| `toolCalling` | 是否实测支持 API 原生工具调用；省略表示未知，普通对话可用不代表工具调用可用 |
| `structuredOutput` | 是否实测支持 API 原生结构化输出约束；提示模型返回 JSON 不等于原生结构化输出 |
| `maxContextTokens` | 当前接口声明或实测的完整上下文上限，包括输入、图片估算和输出预留 |
| `maxOutputTokens` | 当前接口声明的单次输出安全上限，不是每次请求都必须生成的长度 |
| `maxImagesPerRequest` | 单次请求的图片安全上限；纯文本模型省略 |
| `roles` | 模型允许承担的程序角色，不能根据模型 ID 或显示名称猜测 |

支持的角色如下：

| 角色 | 用途 |
|---|---|
| `chat` | 普通对话 |
| `document-draft` | 文档正文整理和草稿生成 |
| `document-review` | 基于文字和已有草稿的质量检查、修复 |
| `vision-review` | 查看图片、扫描页、图表或版面并生成视觉补丁 |
| `summary` | 摘要、报告收敛和跨批次总结 |

DeepSeek 当前只声明文本输入，不包含 `vision-review`。Qwen 和 Kimi 只有在当前接口的图片请求已经验证可用时，才同时声明 `"image"`、`maxImagesPerRequest` 和 `vision-review`。

### 6.1 向后兼容规则

- 为兼容旧版程序，真实配置文件应继续保留 `multimodal` 和 `maxContextLength`，并使其与 `capabilities` 保持一致；仅供新版程序使用的增量 JSON 可以只写 `capabilities`。
- 模型必须至少在旧字段 `maxContextLength` 或新字段 `capabilities.maxContextTokens` 中声明一个合法的正整数上下文上限；两者都缺失时，导入预览应拒绝该模型。
- 新版程序优先采用合法的显式 `capabilities` 字段；字段缺失时，才回退到 `multimodal`、`maxContextLength` 和 `visionPolicy`。
- 类型、枚举或结构非法（例如 `maxOutputTokens` 写成字符串、`roles` 包含未知值）应在导入预览阶段给出明确错误并拒绝写入。历史磁盘配置中的非法字段则由运行时忽略并回退，不能因此崩溃。
- 新旧字段数值冲突，或数值语法合法但与真实模型能力不一致，不应让普通模型工具循环无限重试。运行时采用可解析的保守值，并在检测结果或任务诊断中提示维护人员修正配置。
- `capabilities` 没有声明的能力按“未知”处理，不能因为模型名称包含 `Vision`、`Pro` 或特定厂商名称就自动开启。

### 6.2 declared、observed 与 effective

程序按三层解释模型能力：

| 层次 | 来源 | 含义 |
|---|---|---|
| `declared` | 导入 JSON 的 `capabilities` | 维护者对当前模型、URL 和接口协议的保守声明，不等同于自动验证事实 |
| `observed` | 当前配置指纹下的模型检测和任务运行结果 | 记录连通、流式、图片、长度截断、参数拒绝等实际表现；URL、Key、模型 ID 或请求参数改变后旧结果失效 |
| `effective` | 程序运行时解析结果 | 在程序协议支持、声明能力和有效实测结果之间取保守交集，作为本次路由和批次规划依据 |

JSON 配置不准确时，程序应有界降级：减小输入批次、降低图片数、移除不支持的可选参数、切换满足角色要求的健康模型，或保留确定性提取的原文。不得以完全相同的参数无限重试，也不得因为视觉模型不可用而丢弃已经完成的纯文字结果。

本项目示例中的 `maxOutputTokens: 8192` 是当前维护配置声明的保守安全值，不是程序自动探测出的模型极限。以后确认接口支持更大输出时可以只更新 JSON；如果服务商实际能力低于声明，运行时仍应根据长度截断或参数错误缩小批次，而不是卡死任务。

### 6.3 协议边界

只要新模型继续兼容当前声明的 `openai-chat-completions` 协议，通常可以通过 JSON 调整模型 ID、URL、Key、模态、容量和角色，无需为具体模型名称修改程序。若服务商改用 Responses API、专用图片协议或其他不兼容协议，则必须先增加对应协议适配器，再在 JSON 中声明该协议；普通参数配置不能代替协议实现。

## 7. 请求参数

当服务商使用 `requestPolicy: "json"` 时，程序把 `requestDefaults` 合并到 OpenAI 兼容的 `/chat/completions` 请求。

常见字段示例：

```json
{
  "temperature": 0.2,
  "max_tokens": 8192,
  "top_p": 0.95,
  "extra_body": {
    "chat_template_kwargs": {
      "enable_thinking": true,
      "thinking_budget": 4096
    }
  }
}
```

- `model`、`messages`、`stream`、`tools` 由程序维护，禁止放入 `requestDefaults`。
- 其他字段是否有效由服务商接口决定；程序负责保持 JSON 层级并透传，不替模型猜参数。
- `requestDefaults` 最大 32 KB、最大嵌套深度 8，只能包含标准 JSON 值。
- 单次可见输出使用服务商实际支持的 `max_tokens`。较长任务由普通模型工具循环按步骤读取和保存，不应假设一次回答可以容纳全部结果。
- `capabilities.maxOutputTokens` 是能力元数据，不会作为请求参数发送；`requestDefaults.max_tokens` 是正式请求值。用途 profile 只在对应调用明确选用时覆盖它，当前主对话不会启动独立文档 Worker。
- 不要在 `requestDefaults` 中使用程序或服务商未读取的自造字段。模型能力声明只能放在 `capabilities`，厂商原生请求参数只能按其接口文档放在 `requestDefaults`。
- `thinking_budget` 控制厂商思考预算，不等于最终可见输出上限，也不能代替 `max_tokens` 或 `capabilities.maxOutputTokens`。

### 推理强度

`effortParams` 的键必须与 `efforts` 完全对应，值使用服务商实际接收的原生 JSON。程序不会根据模型名称转换参数。当前模型检测仍使用 `verificationRequestDefaults`，不会叠加用户选择的正式推理强度。

DeepSeek 的 `thinking` 和 `reasoning_effort` 都是 HTTP 请求顶层字段：

```json
{
  "requestDefaults": {
    "thinking": { "type": "enabled" },
    "max_tokens": 8192
  },
  "efforts": ["high", "max"],
  "effortParams": {
    "high": { "reasoning_effort": "high" },
    "max": { "reasoning_effort": "max" }
  }
}
```

Kimi K3 始终推理，当前只支持顶层 `reasoning_effort: "max"`，因此配置单个固定档位。后续官方开放新值时，只需扩充 `efforts` 和 `effortParams`。Kimi 工具调用和多轮对话还必须保留并回传完整 assistant message，包括 `reasoning_content` 和 `tool_calls`。

本地 Qwen3.5 使用本机接口已经验证的 `thinking_budget`。ModelScope 只声明 Qwen3.5 默认思考和 `enable_thinking`，未把 `thinking_budget` 定义为通用标准，因此不要添加未经当前接口验证的预算档位。

## 8. Agent 策略

`agentPolicy` 调整同一个普通模型工具循环，不会创建第二套文档执行流程。

| 字段 | 范围 | 当前作用 |
|---|---|---|
| `documentWorkflow` | 仅 `guided` | 增加本地文档访问提示 |
| `maxToolIterations` | 4–64 | 单轮最多工具迭代数 |
| `maxToolContinuationWindows` | 0–2 | 工具轮次到顶后的延续窗口数 |
| `sameFailureClassLimit` | 2–10 | 同类失败的熔断阈值；修正后的不同参数仍允许执行 |
| `toolResultBudget` | 三个字段均为 1024–32768 | 普通、文档工具结果预算和绝对上限；前两者不能超过绝对上限 |
| `requestProfiles` | JSON 对象 | 按 `toolContinuation`、`finalAnswer`、`summary`、`report`、`knowledge`、`learn`、`sessionReview`、`messageRisk` 或 `documentReview` 覆盖请求参数 |
| `documentPolicy` | 兼容对象 | 保留旧 JSON 校验；其中 `batchOutputTokens` 仍可限制报告等文档用途的输出预算，但不会启动后台 Worker、检查点或备用模型接管 |

`requestProfiles` 只适用于 `requestPolicy: "json"`，且只在程序明确选择对应用途时覆盖 `requestDefaults`。
通信检测始终使用独立的 `verificationRequestDefaults`。长任务实际还受模型上下文与输出能力、工具结果预算和
`context-input-transaction` 约束；不要通过旧 `documentPolicy` 猜测任务已经完成。

## 9. 图片策略

只有 `multimodal: true` 的模型才应设置 `visionPolicy`：

```json
{
  "maxImages": 3,
  "detail": "high",
  "estimatedTokensPerImage": 4096,
  "contextReserveTokens": 16000
}
```

| 字段 | 范围 | 说明 |
|---|---|---|
| `maxImages` | 1–5 | 单次请求最多图片数 |
| `detail` | `auto` / `low` / `high` | 图片清晰度提示 |
| `estimatedTokensPerImage` | 256–32768 | 每张图片的上下文预算估算 |
| `contextReserveTokens` | 0–65536 | 为回复、工具和协议预留的上下文 |

`visionPolicy.maxImages` 是任务侧图片批次建议，不能超过 `capabilities.maxImagesPerRequest`；两者不一致时采用更小值。图片模型不可用时只跳过视觉修复，不应阻断纯文字提取和宿主组装。

## 10. 更新已有模型示例

下面的示例只修改模型 ID、显示名、容量和请求参数，不改变稳定 `modelKey`：

```json
{
  "schemaVersion": 3,
  "operations": [
    {
      "op": "updateModel",
      "providerId": "company-provider",
      "modelKey": "company-model-primary",
      "changes": {
        "id": "new-api-model-id",
        "name": "新模型名称",
        "maxContextLength": 524288,
        "multimodal": false,
        "capabilities": {
          "protocol": "openai-chat-completions",
          "inputModalities": ["text"],
          "streaming": true,
          "structuredOutput": false,
          "maxContextTokens": 524288,
          "maxOutputTokens": 16384,
          "roles": ["chat", "document-draft", "document-review", "summary"]
        },
        "requestDefaults": {
          "temperature": 0.2,
          "max_tokens": 16384
        }
      }
    }
  ]
}
```

如果只更换 API Key 或 Base URL，不必生成模型 JSON，直接在设置页选择服务商，执行“检测 API → 保存凭据”。

## 11. 导入前检查清单

1. `provider.id` 和 `model.key` 是否沿用已有稳定值。
2. `model.id` 是否与服务商控制台提供的真实 API ID 完全一致。
3. `maxContextLength`、`capabilities.maxContextTokens` 和 `max_tokens` 是否来自当前接口说明或实测，而不是宣传页猜测。
4. 图片请求未实测成功时，`multimodal` 必须为 `false`，`inputModalities` 只能包含 `text`，并删除 `visionPolicy` 和 `vision-review`。
5. JSON 策略下每个模型是否提供合法的 `requestDefaults`。
6. 维护配置是否只修改目标服务商/模型；永久删除是否确实必要。
7. 如果导入触发永久删除确认，确认删除范围是否符合预期。
8. 导入后是否执行“检测全部模型”；“未检测”和“不可用”是不同状态。
9. 只有本轮检测结果仍有效时才能删除失败模型；网络波动时应先重新检测。
10. 历史 `documentPolicy` 字段不会创建后台文档任务；长任务应在当前会话中核对实际模型、工具进度和最终文件，不能只根据 JSON 声明判断已经完成。
11. `protocol` 是否与当前服务商接口兼容；模型名称和宣传能力不能代替协议与模态实测。
