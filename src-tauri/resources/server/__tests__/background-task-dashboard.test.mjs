import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dashboardAppUrl = new URL("../visionox-pkg/dashboard/dist/app.js", import.meta.url);
const dashboardChatSourceUrl = new URL("../visionox-pkg/dashboard/src/panels/chat.ts", import.meta.url);
const launcherSourceUrl = new URL("../launcher.mjs", import.meta.url);

test("实时后台输出持久化失败时不会用旧记录覆盖当前快照", async () => {
  const launcher = await readFile(launcherSourceUrl, "utf8");
  assert.match(launcher, /const persistedSnapshot = await persistBackgroundJob\(\{\s*\.\.\.live,\s*id: reference\.jobId,\s*\}\);/u);
  assert.match(launcher, /const durableLive = persistedSnapshot\s*\? await findPersistedTask\(reference, scope\)\s*:\s*null;/u);
  assert.match(launcher, /if \(persistedSnapshot && durableLive\) \{/u);
});

test("后台工作台兼容通用任务投影并在恢复可见性时重新同步", async () => {
  const source = await readFile(dashboardAppUrl, "utf8");
  const chatSource = await readFile(dashboardChatSourceUrl, "utf8");
  const workbench = source.slice(source.indexOf("function backgroundJobNeedsAttention"), source.indexOf("function pickWorkspaceDirectoryFromBridge"));
  const chatPanel = source.slice(source.indexOf("function ChatPanel("), source.indexOf("var ChatFeed ="));

  assert.match(workbench, /function backgroundJobGroup\(job\)/);
  assert.match(workbench, /function backgroundJobGroups\(jobs\)/);
  assert.match(workbench, /key: "active"[\s\S]*?label: t4\("chat\.groupActive"\)/);
  assert.match(workbench, /key: "attention"[\s\S]*?label: t4\("chat\.groupAttention"\)/);
  assert.match(workbench, /key: "completed"[\s\S]*?label: t4\("chat\.groupCompleted"\)/);
  assert.match(workbench, /String\(job\?\.id \?\? ""\)\.startsWith\("task:"\)/);
  assert.match(workbench, /genericTaskLifecycleLabel\(selected\.lifecycle\)/);
  assert.match(workbench, /genericTaskOutcomeLabel\(selected\.outcome\)/);
  assert.match(workbench, /genericTaskQualityLabel\(selected\.quality\)/);
  assert.match(workbench, /Array\.isArray\(selected\?\.allowedActions\)/);
  for (const action of ["pause", "resume", "retry", "retry_delivery", "cancel", "resolve_user_input", "retarget_output", "ack_outcome", "delete_record"]) {
    assert.match(chatSource, new RegExp(`const GENERIC_TASK_ACTION_LABELS = new Set\\(\\[[\\s\\S]*?"${action}"`));
  }
  assert.match(workbench, /Array\.isArray\(selected\?\.artifactRefs\)/);
  assert.match(workbench, /onPreview\(selected, artifact\)/);
  assert.match(workbench, /selected\?\.outcomeSummary/);
  assert.match(workbench, /selected\?\.blockingReason/);
  assert.match(workbench, /t4\("chat\.outcomeSummaryTitle"\)/);
  assert.match(workbench, /t4\("chat\.blockingReasonTitle"\)/);
  assert.match(workbench, /const genericUserInputRequestId = genericUserAction\?\.requestId \|\| selected\?\.userInputRequest\?\.requestId/);
  assert.match(workbench, /requestId: genericUserInputRequestId/);
  assert.match(workbench, /genericUserAction\?\.question/);
  assert.match(workbench, /Array\.isArray\(genericUserAction\?\.choices\)/);
  assert.match(workbench, /consumer: selectedDelivery\?\.target/);
  assert.match(workbench, /retry_delivery/);
  assert.match(workbench, /selectedDeliveries\.find\(\(delivery\) => delivery\?\.target === "conversation"\)/);
  assert.match(workbench, /t4\("chat\.confirmRedelivery"\)/);
  assert.match(workbench, /deliveryState\.lastError \|\| deliveryState\.reason \|\| deliveryState\.code/);
  assert.match(chatSource, /options\.find\(\(option/);
  assert.match(chatSource, /choiceId/);
  assert.match(chatPanel, /pendingDeliveries/);
  assert.match(chatPanel, /setPendingDeliveries\(Array\.isArray\(result\.pendingDeliveries\)/);
  assert.match(chatPanel, /expectedRevision: current\?\.revision/);
  assert.match(chatPanel, /requestId: backgroundActionRequestId\(\)/);
  assert.match(chatPanel, /dash\.kind === "background-job-change"[\s\S]*?refreshBackgroundJobs\(\)/);
  assert.match(chatPanel, /connected && reconnected[\s\S]*?resyncDashboardEvents\(\)/);
  assert.match(chatPanel, /Promise\.all\(\[refetchCanonicalState\(\), refreshBackgroundJobs\(\)\]\)/);
  assert.match(chatPanel, /window\.addEventListener\("focus", refreshOnFocus\)/);
  assert.match(chatPanel, /document\.addEventListener\("visibilitychange", refreshOnVisibility\)/);
});

test("崩溃恢复的 lost 通知在启动时进入 Session inbox 并保留 operation 审计", async () => {
  const launcher = await readFile(launcherSourceUrl, "utf8");
  // 模型边界恢复点：统一经 notificationEnqueueScope 决定绑定（lost+process_restarted 改挂 live operation）
  assert.match(launcher, /backgroundTaskNotifications\.enqueue\(persisted, notificationEnqueueScope\(persisted, scope\)\);/u);
  assert.match(launcher, /const restored = backgroundTaskNotifications\.snapshot\(\);[\s\S]{0,160}restored\.pending[\s\S]{0,80}restored\.overflowed/u);
  // 启动和后续 Session 激活复用同一 durable outbox 恢复点；旧 operation
  // 仅作审计，交付由当前 Session/workspace 领取。
  assert.match(launcher, /async function wakePendingBackgroundTaskNotifications\(scope\) \{[\s\S]{0,400}await wakeAgentForBackgroundNotification\(notification, scope\)/u);
  assert.match(launcher, /backgroundTaskNotifications\.restoreDelivered\([\s\S]{0,200}await wakePendingBackgroundTaskNotifications\(\{[\s\S]{0,160}sessionId:\s*activeConversationId[\s\S]{0,160}workspace:\s*workspaceDir/u);
  assert.match(launcher, /formatBackgroundTaskNotification, notificationEnqueueScope \} = await importEarly\("\.\/lib\/background-task-notification\.mjs"\)/u);
});
