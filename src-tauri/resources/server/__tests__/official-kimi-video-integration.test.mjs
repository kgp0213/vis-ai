import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const launcherUrl = new URL("../launcher.mjs", import.meta.url);
const dashboardUrl = new URL("../visionox-pkg/dashboard/src/panels/chat.ts", import.meta.url);
const apiServerUrl = new URL("../visionox-pkg/dist/cli/server-XGDBRWMB.js", import.meta.url);

test("launcher connects official Kimi video preparation to the existing ordinary loop", async () => {
  const source = await readFile(launcherUrl, "utf8");
  assert.match(source, /createOfficialKimiVideoUploader/);
  assert.match(source, /createMediaProviderAdapter/);
  assert.match(source, /prepareSubmittedMedia/);
  assert.match(source, /loop\.setPendingMediaParts\(materializedMediaParts\)/);
  assert.doesNotMatch(source, /provider\.id.*kimi|model.*includes\(["']kimi/i);
  const persistedUser = source.indexOf('appendActiveMessage({ role: "user"');
  const queuedVideo = source.lastIndexOf("loop.setPendingMediaParts(materializedMediaParts)");
  assert.ok(persistedUser > 0 && queuedVideo > persistedUser, "media must not enter loop state before prompt startup is durably prepared");
  const localCommandGuard = source.indexOf("本地命令不能同时提交附件");
  const mediaPreparation = source.indexOf("const preparedMedia = await prepareSubmittedMedia");
  assert.ok(localCommandGuard > 0 && localCommandGuard < mediaPreparation, "local slash commands must reject attachments before provider upload");
});

test("Dashboard exposes video upload only for an explicit official Kimi video model", async () => {
  const [source, apiServerSource] = await Promise.all([
    readFile(dashboardUrl, "utf8"),
    readFile(apiServerUrl, "utf8"),
  ]);
  assert.match(source, /activeProvider\?\.providerType === "kimi"/);
  assert.match(source, /canUploadVideos/);
  assert.match(source, /video\/mp4,video\/quicktime,video\/webm/);
  assert.match(source, /uploadMediaAttachment/);
  assert.doesNotMatch(source, /uploadImageAttachment\(/);
  assert.match(source, /uploadScopeRef/);
  assert.match(source, /activeConversationId/);
  assert.match(source, /signal: scope\?\.controller\.signal/);
  assert.match(source, /action: "release-upload"/);
  assert.match(apiServerSource, /conversationId: ctx\.getConversationId\?\.\(\) \?\? null/);
});
