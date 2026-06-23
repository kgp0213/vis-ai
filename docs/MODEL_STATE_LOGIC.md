# 模型状态逻辑

本文档用于防止界面再次出现 `pro` / `flash` 显示不一致的问题。

## 核心字段

- `config.preset`: 用户选择的模型预设。当前界面使用 `auto`、`flash`、`pro`。
- `config.model`: 基础模型配置，只作为 `auto` 或自定义模型场景的基线，不代表锁定预设下的实际模型。
- `effectiveModel`: 根据 `preset` 计算出的预设承诺模型。
  - `flash` -> `deepseek-v4-flash`
  - `pro` -> `deepseek-v4-pro`
  - `auto` -> `config.model`，默认 `deepseek-v4-flash`，并允许自动升级
- `runtimeModel`: 当前 `CacheFirstLoop` 正在持有的模型，也就是本轮运行时实际会使用的模型。
- `displayModel`: 界面主标签显示的模型。优先使用 `runtimeModel`，没有运行中 loop 时回退到 `effectiveModel`。
- `modelDrift`: 锁定预设下，`runtimeModel` 与 `effectiveModel` 不一致时为 `true`，表示需要新建对话或重启应用重新对齐。

## 启动与运行链路

1. 程序启动读取配置文件。
2. `launcher.mjs` 通过 `effectiveModelConfig()` 解析 `preset + model`。
3. 创建 `CacheFirstLoop` 时使用 `effectiveModelConfig().model` 和 `autoEscalate`。
4. 设置页切换 `preset` 时，`applyPresetLive()` 重新解析有效模型并 live configure 到当前 loop。
5. 设置页修改 `model` 时，只修改基础模型；如果当前是 `pro/flash` 锁定预设，实际运行模型仍由预设决定。
6. `/api/overview`、`/api/settings`、`/api/models` 同时返回 configured/effective/runtime/display 字段，前端不要直接把 `config.model` 当作当前模型显示。

## 兼容旧预设

历史配置可能包含旧预设名：

- `fast` 等价于 `flash`
- `smart` 等价于 `auto`
- `max` 等价于 `pro`

后端会统一映射为当前三种预设，避免旧配置造成界面分裂。
