import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dashboardAppUrl = new URL("../visionox-pkg/dashboard/dist/app.js", import.meta.url);
const dashboardChatSourceUrl = new URL("../visionox-pkg/dashboard/src/panels/chat.ts", import.meta.url);

test("后台工作台兼容通用任务投影并在恢复可见性时重新同步", async () => {
  const source = await readFile(dashboardAppUrl, "utf8");
  const chatSource = await readFile(dashboardChatSourceUrl, "utf8");
  const workbench = source.slice(source.indexOf("function backgroundJobNeedsAttention"), source.indexOf("function pickWorkspaceDirectoryFromBridge"));
  const chatPanel = source.slice(source.indexOf("function ChatPanel("), source.indexOf("var ChatFeed ="));

  assert.match(workbench, /function backgroundJobGroup\(job\)/);
  assert.match(workbench, /function backgroundJobGroups\(jobs\)/);
  assert.match(workbench, /key: "active"[\s\S]*?label: "运行中"/);
  assert.match(workbench, /key: "attention"[\s\S]*?label: "需要处理"/);
  assert.match(workbench, /key: "completed"[\s\S]*?label: "已完成"/);
  assert.match(workbench, /String\(job\?\.id \?\? ""\)\.startsWith\("task:"\)/);
  assert.match(workbench, /genericTaskLifecycleLabel\(selected\.lifecycle\)/);
  assert.match(workbench, /genericTaskOutcomeLabel\(selected\.outcome\)/);
  assert.match(workbench, /genericTaskQualityLabel\(selected\.quality\)/);
  assert.match(workbench, /Array\.isArray\(selected\?\.allowedActions\)/);
  for (const action of ["pause", "resume", "retry", "retry_delivery", "cancel", "resolve_user_input", "retarget_output", "ack_outcome", "delete_record"]) {
    assert.match(workbench, new RegExp(`\\["${action}"`));
  }
  assert.match(workbench, /Array\.isArray\(selected\?\.artifactRefs\)/);
  assert.match(workbench, /onPreview\(selected, artifact\)/);
  assert.match(workbench, /selected\?\.outcomeSummary/);
  assert.match(workbench, /selected\?\.blockingReason/);
  assert.match(workbench, /结果摘要/);
  assert.match(workbench, /阻塞原因/);
  assert.match(workbench, /const genericUserInputRequestId = genericUserAction\?\.requestId \|\| selected\?\.userInputRequest\?\.requestId/);
  assert.match(workbench, /requestId: genericUserInputRequestId/);
  assert.match(workbench, /genericUserAction\?\.question/);
  assert.match(workbench, /Array\.isArray\(genericUserAction\?\.choices\)/);
  assert.match(workbench, /consumer: selectedDelivery\?\.target/);
  assert.match(workbench, /retry_delivery/);
  assert.match(workbench, /selectedDeliveries\.find\(\(delivery\) => delivery\?\.target === "conversation"\)/);
  assert.match(workbench, /上一次对话交付结果不确定，重新交付可能产生重复回复。是否确认继续？/);
  assert.match(workbench, /deliveryState\.lastError \|\| deliveryState\.reason \|\| deliveryState\.code/);
  assert.match(chatSource, /options\.find\(\(option/);
  assert.match(chatSource, /choiceId/);
  assert.match(chatPanel, /pendingDeliveries/);
  assert.match(chatPanel, /setPendingDeliveries\(Array\.isArray\(result\.pendingDeliveries\)/);
  assert.match(chatPanel, /expectedRevision: current\?\.revision/);
  assert.match(chatPanel, /requestId: backgroundActionRequestId\(\)/);
  assert.match(chatPanel, /dash\.kind === "background-job-change"[\s\S]*?refreshBackgroundJobs\(\)/);
  assert.match(chatPanel, /connected && reconnected[\s\S]*?refreshBackgroundJobs\(\)/);
  assert.match(chatPanel, /window\.addEventListener\("focus", refreshOnFocus\)/);
  assert.match(chatPanel, /document\.addEventListener\("visibilitychange", refreshOnVisibility\)/);
});
