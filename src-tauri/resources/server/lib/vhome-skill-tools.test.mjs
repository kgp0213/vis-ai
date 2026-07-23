import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { consumeSendAuthorization, createSendAuthorization } from "./message-send-policy.mjs";
import { createVHomeSkillDraftStore } from "./vhome-skill-drafts.mjs";
import { registerVHomeSkillTools } from "./vhome-skill-tools.mjs";

const input = {
  name: "weekly-vhome-digest",
  displayName: "每周 V来家摘要",
  description: "整理每周 V来家消息。",
  instructions: "读取消息并按主题总结。",
  capabilities: ["messages"],
  triggerExamples: ["整理本周 V来家消息"],
};

function setup(options = {}) {
  const root = mkdtempSync(join(tmpdir(), "vhome-tools-"));
  const specs = new Map();
  const store = createVHomeSkillDraftStore(join(root, "drafts.json"), { idFactory: () => "draft-1" });
  const installed = [];
  const writes = [];
  const executions = [];
  const docsRoot = join(root, "dws-docs");
  const sendContext = { source: "chat", userPrompt: "给测试联系人发：请查收", ...(options.sendContext ?? {}) };
  mkdirSync(join(docsRoot, "references", "upstream", "products"), { recursive: true });
  writeFileSync(join(docsRoot, "references", "upstream", "products", "future.md"), "# Future Product\n\nUse future-product record create to create a record.\n", "utf8");
  registerVHomeSkillTools({ register(spec) { specs.set(spec.name, spec); } }, {
    draftStore: store,
    dwsExecutable: "dws-test",
    dwsDocsRoot: docsRoot,
    runDwsRead: async (args) => args.includes("send")
      ? { ok: false, error: "write rejected", data: null, meta: {} }
      : { ok: true, data: [], error: null, meta: { mock: args.includes("--mock") } },
    runDwsWrite: async (args) => { writes.push(args); return { ok: true, data: { messageId: "msg-1" }, error: null, meta: {} }; },
    runDwsHelp: async (args) => ({ ok: true, text: `Usage: dws ${args.join(" ")} [options]`, error: null, meta: { status: 0 } }),
    runDwsExec: async (args) => { executions.push(args); return { ok: true, data: { created: true }, text: null, error: null, meta: { status: 0 } }; },
    validateSkillDir: () => ({ ok: true }),
    installSkillDir: (name, dir, options) => { installed.push({ name, dir, options }); return { installed: true, name }; },
    skillExists: () => false,
    getSendContext: () => ({ ...sendContext }),
    consumeSendAuthorization: options.consumeSendAuthorization ?? ((authorization, request) => consumeSendAuthorization(authorization, request)),
    reviewMessageRisk: options.reviewMessageRisk ?? (async () => ({ level: "safe", confidence: 0.99, categories: ["routine"], reason: "普通工作消息" })),
  });
  return { root, specs, store, installed, writes, executions, sendContext };
}

test("dws_read forwards only through the injected read adapter", async () => {
  const state = setup();
  try {
    const output = JSON.parse(await state.specs.get("dws_read").fn({ args: ["chat", "message", "list-unread-conversations"] }, {}));
    assert.equal(output.ok, true);
    assert.equal(state.specs.get("dws_read").readOnly, true);
  } finally { rmSync(state.root, { recursive: true, force: true }); }
});

test("dws_write sends safe explicit messages directly but confirms harmful content", async () => {
  const state = setup();
  try {
    const tool = state.specs.get("dws_write");
    assert.equal(tool.readOnly, false);
    const safeInput = { action: "send_message", targetType: "user", targetId: "user-1", targetLabel: "测试联系人", text: "请查收" };
    const direct = JSON.parse(await tool.fn(safeInput, {}));
    assert.equal(direct.sent, true);
    assert.equal(direct.confirmation, "not-required");
    assert.equal(state.writes.length, 1);

    state.sendContext.userPrompt = "直接发送，不用交互卡片确认";
    const harmfulInput = { ...safeInput, text: "你这个废物，马上滚蛋" };
    const unavailable = JSON.parse(await tool.fn(harmfulInput, {}));
    assert.match(unavailable.error, /confirmation/);
    assert.equal(unavailable.risk.level, "harmful");
    assert.equal(state.writes.length, 1);

    const cancelled = JSON.parse(await tool.fn(harmfulInput, { confirmationGate: { ask: async () => ({ type: "pick", optionId: "C" }) } }));
    assert.equal(cancelled.cancelled, true);
    assert.equal(state.writes.length, 1);

    const revision = JSON.parse(await tool.fn(harmfulInput, { confirmationGate: { ask: async () => ({ type: "pick", optionId: "B" }) } }));
    assert.equal(revision.needsRevision, true);
    assert.equal(state.writes.length, 1);

    let card;
    const sent = JSON.parse(await tool.fn(harmfulInput, { confirmationGate: { ask: async (request) => { card = request; return { type: "pick", optionId: "A" }; } } }));
    assert.equal(sent.sent, true);
    assert.equal(sent.confirmation, "confirmed");
    assert.equal(state.writes.length, 2);
    assert.deepEqual(state.writes[1].slice(0, 7), ["chat", "message", "send", "--user", "user-1", "--text", "你这个废物，马上滚蛋"]);
    assert.ok(state.writes[1].includes("--uuid"));
    assert.equal(card.kind, "choice");
    assert.match(card.payload.question, /测试联系人/);
    assert.match(card.payload.question, /有害/);
    assert.deepEqual(card.payload.options.map((option) => option.title), ["仍然发送", "修改内容", "取消发送"]);
  } finally { rmSync(state.root, { recursive: true, force: true }); }
});

test("dws_write honors explicit authorization for important content but not implicit sends", async () => {
  const state = setup({
    sendContext: { userPrompt: "给测试联系人发送正式承诺" },
    reviewMessageRisk: async () => ({ level: "important", confidence: 0.98, categories: ["commitment"], reason: "包含正式承诺" }),
  });
  const tool = state.specs.get("dws_write");
  const input = { action: "send_message", targetType: "user", targetId: "user-1", targetLabel: "测试联系人", text: "我承诺周五完成" };
  try {
    const explicit = JSON.parse(await tool.fn(input, {}));
    assert.equal(explicit.sent, true);
    assert.equal(explicit.confirmation, "not-required");
    state.sendContext.userPrompt = "直接发送这条承诺，不用确认";
    const direct = JSON.parse(await tool.fn(input, {}));
    assert.equal(direct.sent, true);
    assert.equal(direct.confirmation, "not-required");

    state.sendContext.userPrompt = "查看测试联系人的资料";
    const implicit = JSON.parse(await tool.fn({ ...input, text: "普通工作更新" }, {}));
    assert.equal(implicit.pendingConfirmation, true);

    state.sendContext.userPrompt = "把这个文件直接发送给测试联系人";
    const attachmentPath = join(state.root, "attachment.txt");
    writeFileSync(attachmentPath, "attachment", "utf8");
    const attachment = JSON.parse(await tool.fn({
      action: "send_message", targetType: "user", targetId: "user-1", targetLabel: "测试联系人",
      messageType: "file", filePath: attachmentPath,
    }, {}));
    assert.equal(attachment.sent, true);
    assert.equal(attachment.confirmation, "not-required");
  } finally { rmSync(state.root, { recursive: true, force: true }); }
});

test("dws_write consumes structured authorization and refuses a changed target after the first send", async () => {
  const authorization = createSendAuthorization({ operationId: "operation-structured", source: "chat", userPrompt: "给测试联系人发送通知和附件" });
  const state = setup({ sendContext: { operationId: "operation-structured", sendAuthorization: authorization, userPrompt: "不需要重复确认" } });
  try {
    const tool = state.specs.get("dws_write");
    const input = { action: "send_message", targetType: "user", targetId: "user-1", targetLabel: "测试联系人", text: "通知一" };
    const first = JSON.parse(await tool.fn(input, {}));
    assert.equal(first.sent, true);
    assert.equal(authorization.sendsUsed, 1);
    const changedTarget = JSON.parse(await tool.fn({ ...input, targetId: "user-2", targetLabel: "另一个联系人", text: "通知二" }, {}));
    assert.equal(changedTarget.pendingConfirmation, true);
    assert.equal(state.writes.length, 1);
  } finally { rmSync(state.root, { recursive: true, force: true }); }
});

test("dws_write stops after structured authorization send limit", async () => {
  const authorization = createSendAuthorization({ operationId: "operation-limited", source: "chat", userPrompt: "给测试联系人发送通知", maxSends: 1 });
  const state = setup({ sendContext: { operationId: "operation-limited", sendAuthorization: authorization, userPrompt: "明确发送" } });
  try {
    const tool = state.specs.get("dws_write");
    const input = { action: "send_message", targetType: "user", targetId: "user-1", targetLabel: "测试联系人", text: "通知一" };
    assert.equal(JSON.parse(await tool.fn(input, {})).sent, true);
    const second = JSON.parse(await tool.fn({ ...input, text: "通知二" }, {}));
    assert.equal(second.pendingConfirmation, true);
    assert.equal(state.writes.length, 1);
  } finally { rmSync(state.root, { recursive: true, force: true }); }
});

test("dws_write refuses a cancelled operation before calling DWS", async () => {
  const controller = new AbortController();
  controller.abort();
  const authorization = createSendAuthorization({ operationId: "operation-cancelled", source: "chat", userPrompt: "给测试联系人发送通知" });
  const state = setup({ sendContext: { operationId: "operation-cancelled", sendAuthorization: authorization, signal: controller.signal } });
  try {
    const result = JSON.parse(await state.specs.get("dws_write").fn({
      action: "send_message", targetType: "user", targetId: "user-1", targetLabel: "测试联系人", text: "通知",
    }, {}));
    assert.equal(result.cancelled, true);
    assert.equal(state.writes.length, 0);
    assert.equal(authorization.sendsUsed, 0);
  } finally { rmSync(state.root, { recursive: true, force: true }); }
});

test("dws_write validates message target and content before confirmation", async () => {
  const state = setup();
  try {
    const tool = state.specs.get("dws_write");
    await assert.rejects(() => tool.fn({ action: "send_message", targetType: "user", targetId: "", text: "hello" }, { confirmationGate: { ask: async () => ({ type: "pick", optionId: "A" }) } }), /targetId/);
    await assert.rejects(() => tool.fn({ action: "send_message", targetType: "user", targetId: "u", text: "" }, { confirmationGate: { ask: async () => ({ type: "pick", optionId: "A" }) } }), /text/);
    assert.equal(state.writes.length, 0);
  } finally { rmSync(state.root, { recursive: true, force: true }); }
});

test("dws_help and dws_docs_search discover bundled capabilities lazily", async () => {
  const state = setup();
  try {
    const help = JSON.parse(await state.specs.get("dws_help").fn({ args: ["future-product", "record", "create"] }, {}));
    assert.equal(help.ok, true);
    assert.match(help.text, /future-product record create/);
    assert.equal(state.specs.get("dws_help").readOnly, true);

    const docs = JSON.parse(await state.specs.get("dws_docs_search").fn({ query: "future-product create" }, {}));
    assert.equal(docs.ok, true);
    assert.equal(docs.matches.length, 1);
    assert.match(docs.matches[0].excerpt, /create a record/);
    assert.equal(state.specs.get("dws_docs_search").readOnly, true);
  } finally { rmSync(state.root, { recursive: true, force: true }); }
});

test("dws_exec exposes unknown future commands and can reuse task-scoped authorization", async () => {
  const state = setup();
  try {
    const tool = state.specs.get("dws_exec");
    const input = {
      args: ["future-product", "record", "create", "--name", "测试记录"],
      purpose: "创建测试记录",
      impact: "将在 V来家创建一条记录",
    };
    const unavailable = JSON.parse(await tool.fn(input, {}));
    assert.match(unavailable.error, /confirmation/);
    assert.equal(state.executions.length, 0);

    const cancelled = JSON.parse(await tool.fn(input, { confirmationGate: { ask: async () => ({ type: "pick", optionId: "B" }) } }));
    assert.equal(cancelled.cancelled, true);
    assert.equal(state.executions.length, 0);

    let card;
    const completed = JSON.parse(await tool.fn(input, { confirmationGate: { ask: async (request) => { card = request; return { type: "pick", optionId: "A" }; } } }));
    assert.equal(completed.ok, true);
    assert.deepEqual(state.executions[0], input.args);
    assert.match(card.payload.question, /创建测试记录/);
    assert.match(card.payload.options[0].summary, /future-product record create/);

    state.sendContext.operationId = "operation-1";
    let confirmations = 0;
    const gate = { ask: async () => { confirmations += 1; return { type: "pick", optionId: "S" }; } };
    await tool.fn(input, { confirmationGate: gate });
    await tool.fn({ ...input, args: [...input.args, "--description", "第二次调用"] }, { confirmationGate: gate });
    assert.equal(confirmations, 1);
    assert.equal(state.executions.length, 3);
  } finally { rmSync(state.root, { recursive: true, force: true }); }
});

test("cancelled installation retains the draft and creates no installed skill", async () => {
  const state = setup();
  try {
    const draft = state.store.prepare(input);
    const result = JSON.parse(await state.specs.get("install_vhome_skill_draft").fn({ id: draft.id }, {
      confirmationGate: { ask: async () => ({ type: "pick", optionId: "B" }) },
    }));
    assert.equal(result.cancelled, true);
    assert.equal(state.installed.length, 0);
    assert.ok(state.store.get(draft.id));
  } finally { rmSync(state.root, { recursive: true, force: true }); }
});

test("confirmed installation is atomic through the host installer and removes the draft", async () => {
  const state = setup();
  try {
    const draft = state.store.prepare(input);
    const result = JSON.parse(await state.specs.get("install_vhome_skill_draft").fn({ id: draft.id }, {
      confirmationGate: { ask: async () => ({ type: "pick", optionId: "A" }) },
    }));
    assert.equal(result.installed, true);
    assert.equal(state.installed.length, 1);
    assert.equal(state.installed[0].name, input.name);
    assert.equal(state.store.get(draft.id), null);
  } finally { rmSync(state.root, { recursive: true, force: true }); }
});

test("built-in names cannot be overwritten", async () => {
  const root = mkdtempSync(join(tmpdir(), "vhome-tools-built-in-"));
  const specs = new Map();
  const fakeDraft = { id: "x", name: "officecli", displayName: "x" };
  try {
    registerVHomeSkillTools({ register(spec) { specs.set(spec.name, spec); } }, {
      draftStore: { get: () => fakeDraft }, runDwsRead: async () => ({ ok: true }), dwsExecutable: "dws",
      validateSkillDir: () => ({ ok: true }), installSkillDir: () => ({ installed: true }), isBootstrapSkill: () => true,
    });
    const result = JSON.parse(await specs.get("install_vhome_skill_draft").fn({ id: "x" }, {}));
    assert.match(result.error, /built-in/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
