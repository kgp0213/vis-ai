import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Readable } from "node:stream";
import {
  WORKSPACE_HISTORY_LIMIT,
  addRecentWorkspace,
  normalizeWorkspaceHistory,
  normalizeWorkspacePath,
  removeRecentWorkspace,
} from "../lib/workspace-history.mjs";
import { decideScheduleAdmission, resolveScheduleRunWorkspace } from "../lib/schedule-execution.mjs";

const { SkillStore, applyProjectMemory } = await import(new URL("../visionox-pkg/dist/cli/chunk-2K65GZBT.js", import.meta.url));
const { semanticIndexDirForRoot } = await import(new URL("../visionox-pkg/dist/cli/chunk-XCGGEJTI.js", import.meta.url));

const { dispatch } = await import(new URL("../visionox-pkg/dist/cli/server-XGDBRWMB.js", import.meta.url));
const TOKEN = "workspace-switcher-test";

async function request(method, path, body, ctx) {
  const req = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []);
  req.method = method;
  req.url = path;
  req.headers = { "x-reasonix-token": TOKEN, "content-type": "application/json" };
  let status = null;
  let raw = "";
  const res = { writeHead(value) { status = value; }, end(value) { raw = value ?? ""; } };
  await dispatch(req, res, ctx, TOKEN);
  return { status, body: raw ? JSON.parse(raw) : null };
}

test("workspace history normalizes, de-duplicates and removes unavailable directories", () => {
  const home = mkdtempSync(join(tmpdir(), "workspace-history-"));
  try {
    const dirs = Array.from({ length: 12 }, (_, index) => {
      const path = join(home, `workspace-${index}`);
      mkdirSync(path);
      return path;
    });
    const history = normalizeWorkspaceHistory([
      "workspace-0",
      dirs[0].toUpperCase(),
      join(home, "missing"),
      ...dirs.slice(1),
    ], { homeDir: home, platform: "win32" });
    assert.equal(history.length, WORKSPACE_HISTORY_LIMIT);
    assert.equal(history[0], resolve(home, "workspace-0"));
    assert.equal(history.includes(join(home, "missing")), false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("workspace history records the newest directory and removes only the requested history item", () => {
  const home = mkdtempSync(join(tmpdir(), "workspace-history-mutation-"));
  try {
    const first = join(home, "first");
    const second = join(home, "second");
    mkdirSync(first);
    mkdirSync(second);
    assert.equal(normalizeWorkspacePath("first", { homeDir: home }), first);
    assert.deepEqual(addRecentWorkspace(second, [first, second], { homeDir: home }), [second, first]);
    assert.deepEqual(removeRecentWorkspace(first, [second, first], { homeDir: home }), [second]);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("workspace API lists, selects and removes history through the desktop context", async () => {
  const first = "C:\\workspace-one";
  const second = "C:\\workspace-two";
  let state = { current: first, configured: first, pending: false, recentWorkspaces: [first, second] };
  const ctx = {
    getWorkspaceState: () => state,
    selectWorkspace: (path) => state = { ...state, configured: path, pending: path !== state.current, recentWorkspaces: [path, ...state.recentWorkspaces.filter((item) => item !== path)] },
    removeWorkspaceHistory: (path) => state = { ...state, recentWorkspaces: state.recentWorkspaces.filter((item) => item !== path) },
  };
  const listed = await request("GET", "/api/workspaces", null, ctx);
  assert.equal(listed.status, 200);
  assert.equal(listed.body.current, first);

  const selected = await request("POST", "/api/workspaces", { path: second }, ctx);
  assert.equal(selected.status, 200);
  assert.equal(selected.body.configured, second);
  assert.equal(selected.body.pending, true);

  const removed = await request("DELETE", "/api/workspaces", { path: first }, ctx);
  assert.equal(removed.status, 200);
  assert.deepEqual(removed.body.recentWorkspaces, [second]);

  const invalid = await request("POST", "/api/workspaces", { path: "" }, ctx);
  assert.equal(invalid.status, 400);
});

test("a pending workspace is applied only for a new or explicitly resumed conversation", () => {
  const launcher = readFileSync(new URL("../launcher.mjs", import.meta.url), "utf8");
  assert.match(launcher, /syncWorkspace: async \(\{ applyPending = true \} = \{\}\)/);
  assert.match(launcher, /if \(!applyPending\) return \{ pending: true/);
  assert.match(launcher, /applyPending: text\.trim\(\)\.toLowerCase\(\) === "\/new" \|\| Boolean\(sessionName\)/);
});

test("desktop workspace picker uses the native bridge and server history instead of browser storage", () => {
  const dashboard = readFileSync(new URL("../visionox-pkg/dashboard/dist/app.js", import.meta.url), "utf8");
  const wrapper = readFileSync(new URL("../../../../src/index.html", import.meta.url), "utf8");
  const rust = readFileSync(new URL("../../../../src-tauri/src/lib.rs", import.meta.url), "utf8");
  assert.match(dashboard, /pickWorkspaceDirectoryFromBridge/);
  assert.match(dashboard, /api\("\/workspaces"/);
  assert.match(dashboard, /workspaceScopeCurrent/);
  assert.match(dashboard, /rebindWorkspace/);
  assert.match(dashboard, /cleanupWorkspaceHint/);
  assert.match(dashboard, /method: "DELETE", body: \{ path \}/);
  assert.doesNotMatch(dashboard, /visionox-workspaces/);
  assert.match(wrapper, /vis_pick_directory_result/);
  assert.match(rust, /async fn pick_directory/);
  assert.match(rust, /FolderBrowserDialog/);
});

test("two isolated workspaces keep memory, skills, index identity and task execution scoped correctly", () => {
  const root = mkdtempSync(join(tmpdir(), "workspace-switch-integration-"));
  try {
    const first = join(root, "first");
    const second = join(root, "second");
    mkdirSync(join(first, ".visionox", "skills", "first-only"), { recursive: true });
    mkdirSync(join(second, ".visionox", "skills", "second-only"), { recursive: true });
    writeFileSync(join(first, "AGENTS.md"), "FIRST_WORKSPACE_MEMORY", "utf8");
    writeFileSync(join(second, "AGENTS.md"), "SECOND_WORKSPACE_MEMORY", "utf8");
    writeFileSync(join(first, ".visionox", "skills", "first-only", "SKILL.md"), "---\nname: first-only\ndescription: first workspace skill\n---\nfirst", "utf8");
    writeFileSync(join(second, ".visionox", "skills", "second-only", "SKILL.md"), "---\nname: second-only\ndescription: second workspace skill\n---\nsecond", "utf8");

    const firstMemory = applyProjectMemory("base", first);
    const secondMemory = applyProjectMemory("base", second);
    assert.match(firstMemory, /FIRST_WORKSPACE_MEMORY/);
    assert.doesNotMatch(firstMemory, /SECOND_WORKSPACE_MEMORY/);
    assert.match(secondMemory, /SECOND_WORKSPACE_MEMORY/);
    assert.doesNotMatch(secondMemory, /FIRST_WORKSPACE_MEMORY/);

    const firstSkills = new SkillStore({ homeDir: root, projectRoot: first, disableBuiltins: true });
    const secondSkills = new SkillStore({ homeDir: root, projectRoot: second, disableBuiltins: true });
    assert.ok(firstSkills.read("first-only"));
    assert.equal(firstSkills.read("second-only"), null);
    assert.ok(secondSkills.read("second-only"));
    assert.equal(secondSkills.read("first-only"), null);
    assert.notEqual(semanticIndexDirForRoot(first), semanticIndexDirForRoot(second));

    const boundPrompt = { kind: "prompt", workspaceScope: "bound", workspaceDir: first };
    const currentPrompt = { kind: "prompt", workspaceScope: "current", workspaceDir: first };
    const cleanup = { kind: "session_cleanup", workspaceDir: first };
    assert.equal(decideScheduleAdmission({ task: boundPrompt, workspaceMatches: false }).kind, "skipped");
    assert.equal(decideScheduleAdmission({ task: currentPrompt, workspaceMatches: false }).kind, "start");
    assert.equal(resolveScheduleRunWorkspace(currentPrompt, second), second);
    assert.equal(decideScheduleAdmission({ task: cleanup, workspaceMatches: false }).kind, "start");
    assert.equal(resolveScheduleRunWorkspace(cleanup, second), first);
    assert.equal(decideScheduleAdmission({ task: { kind: "report" }, workspaceMatches: false }).kind, "start");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("workspace switch replaces old tools before rebuilding the loop and MCP tools", () => {
  const launcher = readFileSync(new URL("../launcher.mjs", import.meta.url), "utf8");
  const switchStart = launcher.indexOf("[launcher] workspace switch:");
  const unregisterWorkspace = launcher.indexOf("for (const name of wsToolNames)", switchStart);
  const registerWorkspace = launcher.indexOf("registerWorkspaceTools(tools, configuredDir", unregisterWorkspace);
  const assignWorkspace = launcher.indexOf("workspaceDir = configuredDir", registerWorkspace);
  const rebuildLoop = launcher.indexOf("rebuildLoopPreservingContext(client, workspaceDir)", assignWorkspace);
  const deployGuide = launcher.indexOf("await deploySkillGuide(workspaceDir)", rebuildLoop);
  const reloadMcp = launcher.indexOf("await reloadMcp()", deployGuide);
  assert.ok(switchStart >= 0);
  assert.ok(switchStart < unregisterWorkspace);
  assert.ok(unregisterWorkspace < registerWorkspace);
  assert.ok(registerWorkspace < assignWorkspace);
  assert.ok(assignWorkspace < rebuildLoop);
  assert.ok(rebuildLoop < deployGuide);
  assert.ok(deployGuide < reloadMcp);
  assert.match(launcher.slice(registerWorkspace, assignWorkspace), /hasSemanticSearch = result\.hasSemantic/);
});
