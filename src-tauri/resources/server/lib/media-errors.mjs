const MEDIA_ERROR_CATALOG = Object.freeze({
  media_not_found: { title: "媒体文件不可用", retryable: true, action: "检查文件路径或重新选择附件", affectsCompleteness: true },
  media_format_unsupported: { title: "媒体格式不支持", retryable: false, action: "转换为受支持格式后重试", affectsCompleteness: true },
  media_too_large: { title: "媒体超过安全预算", retryable: false, action: "压缩媒体或选择局部区域", affectsCompleteness: true },
  media_decode_failed: { title: "媒体解码失败", retryable: false, action: "检查文件是否损坏或更换格式", affectsCompleteness: true },
  media_provider_unsupported: { title: "当前模型不支持该媒体", retryable: false, action: "切换支持该媒体的模型", affectsCompleteness: true },
  media_provider_auth_failed: { title: "媒体 Provider 鉴权失败", retryable: false, action: "检查 API Key 和 Provider 权限", affectsCompleteness: true },
  media_upload_failed: { title: "媒体上传失败", retryable: true, action: "检查网络后重试", affectsCompleteness: true },
  media_blob_missing: { title: "附件数据缺失", retryable: false, action: "重新上传原始附件", affectsCompleteness: true },
  media_region_invalid: { title: "图片区域无效", retryable: false, action: "调整裁剪坐标后重试", affectsCompleteness: true },
  media_read_cancelled: { title: "媒体读取已取消", retryable: true, action: "需要时重新读取", affectsCompleteness: false },
});

export function mediaFailure(code, message, details = {}) {
  const definition = MEDIA_ERROR_CATALOG[code] ?? {
    title: "媒体处理失败",
    retryable: false,
    action: "查看日志并重新选择附件",
    affectsCompleteness: true,
  };
  return {
    code,
    title: definition.title,
    message: String(message ?? definition.title),
    retryable: details.retryable ?? definition.retryable,
    recommendedAction: details.recommendedAction ?? definition.action,
    affectsCompleteness: details.affectsCompleteness ?? definition.affectsCompleteness,
    attachmentId: details.attachmentId ?? null,
    operationId: details.operationId ?? null,
    toolCallId: details.toolCallId ?? null,
    ...Object.fromEntries(Object.entries(details).filter(([key]) => !["retryable", "recommendedAction", "affectsCompleteness"].includes(key))),
  };
}

export { MEDIA_ERROR_CATALOG };
