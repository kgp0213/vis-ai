(function attachVisionoxIndexModePolicy(root) {
  const modes = new Set(["auto", "tool", "off"]);
  const hints = Object.freeze({
    auto: "自动召回：每次发送消息前自动搜索本地索引，并把最相关内容加入本轮上下文。",
    tool: "按需搜索：不会主动搜索；模型判断有必要时，可以调用语义搜索工具。",
    off: "不使用：本轮对话不自动召回，也不向模型提供本地索引搜索工具。",
  });

  function normalize(mode, fallback = "tool") {
    return modes.has(mode) ? mode : modes.has(fallback) ? fallback : "tool";
  }

  function hint(mode) {
    return hints[normalize(mode)];
  }

  root.VisionoxIndexModePolicy = Object.freeze({ normalize, hint });
})(globalThis);
