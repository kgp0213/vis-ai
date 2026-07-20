import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

import {
  artifactDeliveryRetryPrompt,
  artifactMissingNotice,
  detectArtifactRequest,
  documentArtifactStateFromJob,
  documentJobToolMismatch,
  latestAssistantResponse,
  pendingDocumentArtifactFromToolEvent,
  pendingDocumentWriteConflict,
  registerSaveLastAssistantResponseTool,
  toolResultSucceeded,
} from "./artifact-delivery.mjs";

test("latestAssistantResponse returns the previous stable assistant text", () => {
  assert.deepEqual(latestAssistantResponse([
    { id: "1", role: "assistant", text: "first" },
    { id: "2", role: "user", text: "save it" },
  ]), { id: "1", text: "first" });
  assert.equal(latestAssistantResponse([{ role: "assistant", text: "  " }]), null);
});

test("artifact intent distinguishes commands from design discussions", () => {
  assert.deepEqual(detectArtifactRequest("把刚才的总结内容生成总结文档"), {
    required: true,
    savePreviousResponse: true,
  });
  assert.equal(detectArtifactRequest("请保存为 reports/manual.md").required, true);
  assert.equal(detectArtifactRequest("我们讨论一下如何生成大型 PDF 报告").required, false);
  assert.equal(detectArtifactRequest("总结一下这段内容").required, false);
});

test("artifact retry guidance selects the deterministic previous-response tool", () => {
  const prompt = artifactDeliveryRetryPrompt({ savePreviousResponse: true }, "把刚才内容保存成文档");
  assert.match(prompt, /save_last_assistant_response/);
  assert.match(prompt, /不要重新发送上一条回答作为 content/);
  assert.match(artifactMissingNotice(), /不能标记为完成/);
});

test("save-last tool forwards the stable response through the existing write boundary", async () => {
  const definitions = new Map();
  const calls = [];
  const tools = {
    register(definition) { definitions.set(definition.name, definition); },
    async dispatch(name, args, context) {
      calls.push({ name, args, context });
      return "wrote file";
    },
  };
  registerSaveLastAssistantResponseTool(tools, {
    getLastAssistantResponse: () => ({ id: "assistant-7", text: "# Complete report" }),
  });

  const context = { signal: new AbortController().signal };
  const result = JSON.parse(await definitions.get("save_last_assistant_response").fn({ path: "report.md" }, context));
  assert.equal(result.ok, true);
  assert.equal(result.sourceMessageId, "assistant-7");
  assert.deepEqual(calls, [{
    name: "write_file",
    args: { path: "report.md", content: "# Complete report" },
    context,
  }]);
});

test("save-last tool propagates a failed nested write", async () => {
  let definition;
  const tools = {
    register(value) { definition = value; },
    async dispatch() { return '{"error":"permission denied"}'; },
  };
  registerSaveLastAssistantResponseTool(tools, {
    getLastAssistantResponse: () => ({ id: "assistant-8", text: "report" }),
  });
  const result = JSON.parse(await definition.fn({ path: "report.md" }, {}));
  assert.equal(result.ok, false);
  assert.match(result.error, /did not create/);
});

test("launcher retries explicit file delivery and fails completion when no artifact exists", () => {
  const launcher = readFileSync(new URL("../launcher.mjs", import.meta.url), "utf8");
  assert.match(launcher, /registerSaveLastAssistantResponseTool/);
  assert.match(launcher, /pendingDocumentArtifactFromToolEvent/);
  assert.match(launcher, /!pendingDocumentArtifact/);
  assert.match(launcher, /if \(pendingDocumentArtifact\) break/);
  assert.match(launcher, /name: "get_document_job_status"/);
  assert.match(launcher, /finishTurnOnResult/);
  assert.match(launcher, /artifactContinuationAttempts < MAX_ARTIFACT_AUTO_CONTINUATIONS/);
  assert.match(launcher, /if \(!info \|\| info\.size <= 0 \|\| info\.mtimeMs < turnStartedAt/);
  assert.match(launcher, /toolResultSucceeded\(ev\.content\)/);
  assert.match(launcher, /artifactIncomplete \? "requested artifact was not created"/);
});

test("artifact completion rejects failed tool results", () => {
  assert.equal(toolResultSucceeded('{"ok":false,"error":"write failed"}'), false);
  assert.equal(toolResultSucceeded('{"error":"missing content"}'), false);
  assert.equal(toolResultSucceeded("Error: denied"), false);
  assert.equal(toolResultSucceeded("wrote 10 chars to report.md"), true);
  assert.equal(toolResultSucceeded('{"ok":true,"outputPath":"report.md"}'), true);
});

test("accepted document jobs are pending artifacts rather than missing files", () => {
  const artifact = pendingDocumentArtifactFromToolEvent(
    "organize_document_to_markdown",
    { input: "manual.pdf", outputPath: "manual.md" },
    JSON.stringify({
      ok: true,
      accepted: true,
      artifactStatus: "pending",
      backgroundJobId: "document:12345678-abcd-abcd-abcd-123456789012",
      documentJobId: "12345678-abcd-abcd-abcd-123456789012",
      outputPath: "manual.md",
    }),
  );
  assert.deepEqual(artifact, {
    state: "pending",
    jobId: "document:12345678-abcd-abcd-abcd-123456789012",
    documentJobId: "12345678-abcd-abcd-abcd-123456789012",
    outputPath: "manual.md",
    sourcePath: "manual.pdf",
  });
  assert.equal(documentArtifactStateFromJob({ status: "waiting_foreground" }), "pending");
  assert.equal(documentArtifactStateFromJob({ status: "completed_with_warnings" }), "created");
  assert.equal(documentArtifactStateFromJob({ status: "failed" }), "failed");
});

test("legacy PDF document jobs are also tracked as pending artifacts", () => {
  const artifact = pendingDocumentArtifactFromToolEvent(
    "organize_pdf_to_markdown",
    { input: "manual.pdf", outputPath: "manual.md" },
    JSON.stringify({
      ok: true,
      accepted: true,
      artifactStatus: "pending",
      backgroundJobId: "document:12345678-abcd-abcd-abcd-123456789012",
      documentJobId: "12345678-abcd-abcd-abcd-123456789012",
      outputPath: "manual.md",
    }),
  );
  assert.equal(artifact?.jobId, "document:12345678-abcd-abcd-abcd-123456789012");
  assert.equal(artifact?.sourcePath, "manual.pdf");
});

test("pending document outputs reject competing writers but allow unrelated files", () => {
  const jobs = [{
    id: "document:12345678-abcd-abcd-abcd-123456789012",
    status: "waiting_foreground",
    outputPath: "reports/manual.md",
  }];
  const conflict = pendingDocumentWriteConflict("write_file", {
    path: "reports/manual.md",
    content: "replacement",
  }, jobs);
  assert.equal(conflict?.code, "artifact-pending");
  assert.equal(conflict?.backgroundJobId, jobs[0].id);
  assert.equal(pendingDocumentWriteConflict("edit_file", { path: "reports/manual.md", search: "old", replace: "new" }, jobs)?.code, "artifact-pending");
  assert.equal(pendingDocumentWriteConflict("delete_file", { path: "reports/manual.md" }, jobs)?.code, "artifact-pending");
  assert.equal(pendingDocumentWriteConflict("move_file", { source: "reports/manual.md", destination: "reports/archive.md" }, jobs)?.code, "artifact-pending");
  assert.equal(pendingDocumentWriteConflict("append_file", { path: "reports/other.md", content: "ok" }, jobs), null);
  assert.equal(pendingDocumentWriteConflict("read_file", { path: "reports/manual.md" }, jobs), null);
});

test("relative edit and delete paths are resolved from the active workspace", () => {
  const workspaceRoot = resolve(process.cwd(), "artifact-delivery-workspace");
  const jobs = [{
    id: "document:12345678-abcd-abcd-abcd-123456789012",
    status: "running",
    outputPath: resolve(workspaceRoot, "reports/manual.md"),
  }];
  const options = { workspaceRoot };

  assert.equal(
    pendingDocumentWriteConflict("edit_file", { path: "reports/manual.md", search: "old", replace: "new" }, jobs, options)?.code,
    "artifact-pending",
  );
  assert.equal(
    pendingDocumentWriteConflict("delete_file", { path: "reports/manual.md" }, jobs, options)?.code,
    "artifact-pending",
  );
  assert.equal(
    pendingDocumentWriteConflict("delete_file", { path: "reports/other.md" }, jobs, options),
    null,
  );
});

test("failed or awaiting-output jobs keep their output protected until handoff is finished", () => {
  for (const status of ["failed", "awaiting_output", "needs_review"]) {
    const conflict = pendingDocumentWriteConflict("delete_file", { path: "reports/manual.md" }, [{
      id: "document:12345678-abcd-abcd-abcd-123456789012",
      status,
      outputPath: "reports/manual.md",
    }]);
    assert.equal(conflict?.code, "artifact-pending", status);
  }
  const handoffConflict = pendingDocumentWriteConflict("write_file", { path: "reports/manual.md", content: "replacement" }, [{
    id: "document:12345678-abcd-abcd-abcd-123456789012",
    status: "completed_with_warnings",
    outputPath: "reports/manual.md",
    handoff: { state: "running" },
  }]);
  assert.equal(handoffConflict?.code, "artifact-pending");
  assert.equal(pendingDocumentWriteConflict("delete_file", { path: "reports/manual.md" }, [{
    id: "document:12345678-abcd-abcd-abcd-123456789012",
    status: "completed_with_warnings",
    outputPath: "reports/manual.md",
    handoff: { state: "delivered" },
  }]), null);
});

test("shell commands and helper scripts cannot bypass a pending document output lock", () => {
  const workspaceRoot = resolve(process.cwd(), "artifact-shell-guard");
  const outputPath = resolve(workspaceRoot, "reports", "manual.md");
  const jobs = [{
    id: "document:12345678-abcd-abcd-abcd-123456789012",
    status: "completed_with_warnings",
    outputPath,
    handoff: { state: "running" },
  }];
  const options = { workspaceRoot };

  assert.equal(pendingDocumentWriteConflict("run_command", {
    command: `Set-Content -LiteralPath '${outputPath}' -Value 'replacement'`,
  }, jobs, options)?.code, "artifact-pending");
  assert.equal(pendingDocumentWriteConflict("run_background", {
    command: `node cleanup.js "${outputPath}"`,
  }, jobs, options)?.code, "artifact-pending");
  assert.equal(pendingDocumentWriteConflict("write_file", {
    path: "fix-output.ps1",
    content: `$target = '${outputPath}'\nRemove-Item -LiteralPath $target`,
  }, jobs, options)?.code, "artifact-pending");
  assert.equal(pendingDocumentWriteConflict("run_command", {
    command: "Get-ChildItem reports",
  }, jobs, options), null);
});

test("process job tools redirect document UUIDs to the non-blocking status tool", () => {
  const mismatch = documentJobToolMismatch("wait_for_job", {
    jobId: "12345678-abcd-abcd-abcd-123456789012",
  });
  assert.equal(mismatch?.code, "wrong-job-system");
  assert.equal(mismatch?.useTool, "get_document_job_status");
  assert.equal(documentJobToolMismatch("wait_for_job", { jobId: 7 }), null);
});
