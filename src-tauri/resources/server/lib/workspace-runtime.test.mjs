import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { createWorkspaceRuntime } from "./workspace-runtime.mjs";

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "visionox-workspace-runtime-"));
  roots.push(root);
  const first = join(root, "first");
  const second = join(root, "second");
  mkdirSync(first, { recursive: true });
  mkdirSync(second, { recursive: true });
  let current = first;
  let config = { workspaceDir: first, recentWorkspaces: [] };
  const events = [];
  const runtime = createWorkspaceRuntime({
    homeDir: root,
    readConfig: () => config,
    writeConfig: (next) => { config = next; },
    getCurrentWorkspace: () => current,
    setCurrentWorkspace: (next) => { current = next; events.push(`set:${next}`); },
    normalizeWorkspacePath: (value) => resolve(value),
    isWorkspaceDirectory: (value) => value === first || value === second,
    addRecentWorkspace: (value, values) => [value, ...values.filter((item) => item !== value)],
    removeRecentWorkspace: (value, values) => values.filter((item) => item !== value),
    normalizeWorkspaceHistory: (values) => [...new Set(values)],
    sameWorkspacePath: (left, right) => resolve(left) === resolve(right),
    ensureWorkspaceDirectory: async (value) => { mkdirSync(value, { recursive: true }); events.push(`ensure:${value}`); },
    clearPreparedDocuments: async () => { events.push("clear-prepared"); },
    removeMcpServers: async () => { events.push("remove-mcp"); },
    removeWorkspaceTools: async () => { events.push("remove-tools"); },
    registerWorkspaceTools: async (value) => { events.push(`register:${value}`); return { toolNames: ["read_file"], hasSemantic: true }; },
    rebuildLoop: async (value) => { events.push(`rebuild:${value}`); },
    deploySkillGuide: async (value) => { events.push(`guide:${value}`); },
    reloadMcp: async (value) => { events.push(`reload-mcp:${value}`); },
    onLog: (message) => events.push(message),
  });
  return { root, first, second, runtime, events, get current() { return current; }, get config() { return config; } };
}

describe("workspace runtime", () => {
  test("uses no-op lifecycle adapters when optional workspace hooks are omitted", async () => {
    const root = mkdtempSync(join(tmpdir(), "visionox-workspace-runtime-defaults-"));
    const first = join(root, "first");
    const second = join(root, "second");
    mkdirSync(first, { recursive: true });
    mkdirSync(second, { recursive: true });
    let current = first;
    let config = { workspaceDir: second, recentWorkspaces: [] };
    try {
      const runtime = createWorkspaceRuntime({
        homeDir: root,
        readConfig: () => config,
        writeConfig: (next) => { config = next; },
        getCurrentWorkspace: () => current,
        setCurrentWorkspace: (next) => { current = next; },
        normalizeWorkspacePath: (value) => resolve(value),
        isWorkspaceDirectory: () => true,
        addRecentWorkspace: (value, values) => [value, ...values],
        removeRecentWorkspace: (value, values) => values.filter((item) => item !== value),
        normalizeWorkspaceHistory: (values) => [...new Set(values)],
        sameWorkspacePath: (left, right) => resolve(left) === resolve(right),
        ensureWorkspaceDirectory: async () => {},
        registerWorkspaceTools: async () => ({}),
      });
      const result = await runtime.apply();
      assert.equal(result.changed, true);
      assert.equal(current, resolve(second));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("returns current state without rebuilding when the configured workspace is active", async () => {
    const value = fixture();
    const result = await value.runtime.apply();
    assert.deepEqual(result, {
      changed: false,
      current: resolve(value.first),
      configured: resolve(value.first),
    });
    assert.deepEqual(value.events, []);
  });

  test("persists a selected workspace and maintains recent history", () => {
    const value = fixture();
    const state = value.runtime.select(value.second);
    assert.equal(value.config.workspaceDir, resolve(value.second));
    assert.equal(state.configured, resolve(value.second));
    assert.deepEqual(value.config.recentWorkspaces, [resolve(value.second), resolve(value.first)]);
  });

  test("rejects invalid selections and removes inactive history entries", () => {
    const value = fixture();
    assert.throws(() => value.runtime.select(join(value.first, "missing")), /does not exist/);
    value.config.recentWorkspaces = [resolve(value.second), join(value.root, "stale")];
    const state = value.runtime.removeHistory(value.second);
    assert.deepEqual(state.recentWorkspaces, [resolve(value.first), join(value.root, "stale")]);
    assert.throws(() => value.runtime.removeHistory(value.first), /cannot be removed/);
  });

  test("does not apply a pending selection until the caller allows it", async () => {
    const value = fixture();
    value.config.workspaceDir = value.second;
    const result = await value.runtime.apply({ applyPending: false });
    assert.equal(result.pending, true);
    assert.equal(value.current, resolve(value.first));
    assert.deepEqual(value.events, []);
  });

  test("switches workspace in a fixed order and reloads all workspace-bound tools", async () => {
    const value = fixture();
    value.config.workspaceDir = value.second;
    const result = await value.runtime.apply();
    assert.equal(result.changed, true);
    assert.equal(value.current, resolve(value.second));
    assert.deepEqual(value.events.slice(1), [
      "clear-prepared",
      "remove-mcp",
      "remove-tools",
      `ensure:${resolve(value.second)}`,
      `register:${resolve(value.second)}`,
      `set:${resolve(value.second)}`,
      `rebuild:${resolve(value.second)}`,
      `guide:${resolve(value.second)}`,
      `reload-mcp:${resolve(value.second)}`,
      `[workspace-runtime] workspace synced: ${resolve(value.second)}`,
    ]);
  });
});
