const positiveCount = (value) => Number.isSafeInteger(value) && value > 0 ? value : 0;

/**
 * Convert an internal repair report into a short user-facing notice.
 * Never include repair notes or tool arguments: they can contain paths or secrets.
 */
export function formatToolRepairNotice(report) {
  if (!report || typeof report !== "object") return null;
  const truncationsFixed = positiveCount(report.truncationsFixed);
  const scavenged = positiveCount(report.scavenged);
  const parts = [];
  if (truncationsFixed > 0) parts.push(`自动修复了 ${truncationsFixed} 次工具参数格式`);
  if (scavenged > 0) parts.push(`恢复了 ${scavenged} 个未按协议返回的工具调用`);
  if (parts.length === 0) return null;
  return `模型返回的工具调用格式不完整；系统已${parts.join("，并")}，任务继续执行。`;
}
