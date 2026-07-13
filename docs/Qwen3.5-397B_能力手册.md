# Qwen3.5-397B 配置与验证手册

> 适用范围：Visionox-Whale 1.28.0 及以上版本
> 文档定位：公司 Qwen 服务的 JSON 配置、更新和验证说明，不作为模型跑分或服务端永久能力承诺
> 最近复核：2026-07-13

公司可能更换模型、网关、API ID、上下文上限或请求参数。Visionox-Whale 不猜测这些能力，也不在源码中写死公司模型参数；实际请求以管理员或 AI 生成并由用户确认导入的 JSON 为准。

---

## 一、先区分三类事实

| 证据等级 | 能说明什么 | 不能说明什么 |
|---|---|---|
| Visionox 源码与测试 | JSON 字段如何校验、合并并发送 | 公司端点当前是否支持该参数 |
| 通信检测通过 | 地址、Key、模型 ID 和请求体能完成一次请求 | 参数一定影响推理质量；完整上下文一定可用 |
| 受控对比测试 | 某个参数在指定端点和模型版本下产生了可重复差异 | 公司升级后仍保持相同行为 |
| 公司服务端说明 | 当前部署的模型、上限和参数契约 | 未来升级后的能力 |

HTTP 200、输出更长或返回了模型名称，都不能单独证明某个参数真正改变了推理过程。

## 二、Visionox 可以保证的请求行为

### 2.1 JSON 固定参数策略

公司模型使用：

```json
"requestPolicy": "json"
```

该策略下：

- 模型级 `requestDefaults` 会加入对应模型的请求。
- Visionox 不会自行追加 DeepSeek 专用的 `thinkingMode` 或 `reasoning_effort`。
- `model`、`messages`、`stream` 和 `tools` 是运行协议字段，不能由 `requestDefaults` 覆盖。
- 任务运行时明确传入的动态字段优先。例如通信检测会把本次 `max_tokens` 限制为 8，避免生成长回答。
- JSON 只能包含普通 JSON 值、有限数字和安全对象字段，过深、过大或包含原型污染字段的配置会被拒绝。

Visionox 负责准确传递配置，不负责判断 `enable_thinking`、`top_k` 或其他厂商字段在当前公司网关中代表什么。

### 2.2 上下文长度

`maxContextLength` 表示当前服务部署允许 Visionox 使用的模型容量，应填写公司服务端确认的上限，而不是模型宣传页中的理论最大值。

历史配置曾使用 `262144`。这只是当时部署信息，不是永久硬限制。公司调整服务端后，应同步更新 JSON，并重新完成通信和长上下文验证。

### 2.3 稳定模型 key

```json
{
  "key": "company-qwen-primary",
  "id": "qwen3.5-397b-a17b",
  "name": "公司 Qwen"
}
```

- `key` 是用户电脑中的稳定身份，升级时尽量保持不变。
- `id` 是实际发送给 API 的模型 ID，可以随公司服务升级而改变。
- `name` 只是界面显示名称，可以独立调整。
- 旧配置没有 `key` 时，Visionox 暂时使用 `id` 兼容；后续维护配置应补上稳定 `key`。

这样修改 API ID 或显示名称时，软件能识别为同一个模型的升级，不会产生重复模型。

---

## 三、新电脑使用完整配置

新电脑首次配置使用 schema v2。下面是结构示例，其中地址、Key、模型 ID、上下文长度和请求参数必须根据公司当前信息填写。

```json
{
  "schemaVersion": 2,
  "importMode": "replace",
  "providers": [
    {
      "id": "local-qwen",
      "name": "公司 Qwen",
      "baseUrl": "http://公司当前地址/v1",
      "apiKey": "<由管理员提供>",
      "requestPolicy": "json",
      "models": [
        {
          "key": "company-qwen-primary",
          "id": "公司当前模型 ID",
          "name": "公司 Qwen",
          "presets": ["flash"],
          "maxContextLength": 262144,
          "requestDefaults": {
            "temperature": 0.6,
            "max_tokens": 4096,
            "top_p": 0.95,
            "top_k": 20,
            "extra_body": {
              "chat_template_kwargs": {
                "enable_thinking": true
              }
            }
          }
        }
      ],
      "defaultPreset": "flash",
      "autoEscalate": false
    }
  ],
  "activeProviderId": "local-qwen"
}
```

示例中的参数仅展示 JSON 结构，不代表所有公司 Qwen 端点都支持这些值。生成真实配置时，应以公司当前接口说明为准。

`importMode: "replace"` 表示：如果用户电脑已经存在同 ID Provider，新 JSON 会完整替换该 Provider，避免旧模型和旧参数残留；其他未出现在本次 JSON 中的 Provider 不会被删除。

导入步骤：

1. 在主界面打开“模型”。
2. 选择完整 JSON 文件。
3. 核对后端生成的实际变更预览。
4. 确认导入。
5. 点击“检测全部模型”；只有通信成功的模型名称后会显示对号。

仓库不会提交带真实凭据的个人配置。用户本地如有完整配置，应保持在 Git 忽略范围内。

---

## 四、公司模型升级与下架

日常维护使用 schema v3，不需要重新导入所有服务商。

### 4.1 修改模型 API ID 或名称

保留稳定 `modelKey`，只修改发生变化的字段：

```json
{
  "schemaVersion": 3,
  "operations": [
    {
      "op": "updateModel",
      "providerId": "local-qwen",
      "modelKey": "company-qwen-primary",
      "changes": {
        "id": "公司新的模型 ID",
        "name": "公司 Qwen 新版",
        "maxContextLength": 262144
      }
    }
  ]
}
```

如果请求参数也变化，应把管理员确认的完整 `requestDefaults` 一并更新，避免新模型继续沿用不合适的旧参数。

### 4.2 新增单个模型

使用 `upsertModel`。新模型必须提供稳定 `key`、API `id`、正整数 `maxContextLength`，以及该 Provider 策略要求的完整模型配置。

### 4.3 按公司最新清单整理模型

使用 `syncModels` 提供某个 Provider 当前全部有效模型。清单中的模型会新增或完整更新；未出现在清单中的旧模型会自动停用，不会永久删除。

这是批量清理过期模型的推荐方式，因为配置仍可恢复，也不会让已下架模型继续参与模型选择、摘要或通信检测。

### 4.4 停用或永久删除

- `disableModel`：停用一个模型但保留配置。单模型 Provider 不能停用唯一模型。
- `removeModel`：永久删除一个模型，导入界面会要求额外确认。
- `removeProvider`：永久删除整个非活动 Provider。当前正在使用的 Provider 不能删除，必须先切换。

维护 JSON 的详细示例见 [API Key 维护与更新指南](API-Key维护与更新指南.html)。

---

## 五、API Key 与 Base URL 轮换

定期更换凭据不需要重新生成整份模型 JSON：

1. 打开“高级 → 设置 → 当前模型服务凭据”。
2. 明确选择要维护的服务商。
3. 填写新 API Key 或 Base URL。
4. 点击“检测 API”。
5. 只有检测通过后，“保存凭据”按钮才可用。
6. 保存后回到模型菜单，再执行“检测全部模型”。

检测 API 使用临时配置。检测失败不会覆盖旧 Key 或旧地址；检测通过后如果再次改动任何字段，必须重新检测。

---

## 六、如何验证参数是否真的生效

### 6.1 通信验证

“检测全部模型”会使用同一份 `requestDefaults`，但临时覆盖 `max_tokens` 为 8。它用于确认请求格式和通信，不用于评价推理质量。

### 6.2 参数效果验证

要判断 `enable_thinking`、`reasoning_effort`、采样参数或多模态是否真正生效，应由管理员执行受控测试：

1. 固定模型 ID、提示词、输入上下文和除目标参数外的所有字段。
2. 每个配置重复运行多次，避免把随机波动当成参数效果。
3. 同时比较正确率、稳定性、耗时、输出结构和 token 使用，不只比较回答长度。
4. 记录端点、网关、模型版本和测试日期。
5. 公司模型升级后重新验证，不沿用旧结论。

### 6.3 上下文容量验证

通信检测不会覆盖完整上下文上限。`maxContextLength` 应优先来自服务端配置；必要时再用逐步增加输入长度的方式验证，并保留服务端返回的明确错误作为证据。

---

## 七、历史观察及其边界

2026-07 的旧测试记录曾出现以下现象：

- 某个公司端点接受了 `extra_body.chat_template_kwargs.enable_thinking`。
- 返回消息中没有观察到独立的 `message.reasoning` 内容。
- 不同 `reasoning_effort` 值的输出长度接近。
- 当时使用的配置容量为 262,144 tokens。
- 多模态能力没有完成验证。

这些记录只能说明当时特定端点的表现：

- “参数被接受”不等于“参数影响推理”。
- 输出长度接近不能证明 `reasoning_effort` 无效。
- 输出更长不能证明质量更高。
- 当时的上下文配置不能代表后续部署。
- 未验证的多模态能力不应在配置中默认为已支持。

原手册中关于固定 vLLM 版本、TP 数量、推理质量百分比、模型主观能力评级、固定输出上限和永久参数结论均已删除，因为现有证据不足以支持这些长期断言。

---

## 八、维护检查表

- Provider `id` 是否保持稳定。
- 模型 `key` 是否保持稳定且唯一。
- API 模型 `id` 和显示 `name` 是否来自当前公司通知。
- `maxContextLength` 是否来自当前服务部署，而不是理论宣传值。
- `requestDefaults` 是否只包含公司端点确认的字段。
- JSON 预览中的新增、更新、停用和永久删除是否符合预期。
- 导入或更换凭据后是否重新执行了“检测全部模型”。
- 参数效果结论是否记录了端点、模型版本和测试日期。
