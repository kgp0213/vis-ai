import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  composeToolActivationPolicy,
  explainToolActivation,
  filterToolSpecsByActivation,
  isToolActive,
  publicToolActivationPolicy,
  resolveToolActivationPolicy,
} from "./tool-activation-policy.mjs";

test("composes profile, global, and session layers without changing the default", () => {
  const policy = composeToolActivationPolicy({
    knownTools: ["read_file", "write_file", "mcp__calendar__list"],
    mcpTools: ["mcp__calendar__list"],
  });
  assert.equal(isToolActive(policy, "read_file"), true);
  assert.equal(isToolActive(policy, "write_file"), true);
});

test("profile allowlist and global denylist are intersected", () => {
  const policy = resolveToolActivationPolicy({
    config: { toolPolicy: { disabled: ["write_file"] } },
    mode: { tools: ["read_file", "write_file", "mcp__calendar__*"] },
    knownTools: ["read_file", "write_file", "mcp__calendar__list"],
    mcpTools: ["mcp__calendar__list"],
  });
  assert.equal(isToolActive(policy, "read_file"), true);
  assert.equal(isToolActive(policy, "write_file"), false);
  assert.equal(isToolActive(policy, "mcp__calendar__list"), true);
});

test("global empty enabled list remains unconstrained, while profile empty list is explicit", () => {
  const global = resolveToolActivationPolicy({
    config: { toolPolicy: { enabled: [] } },
    knownTools: ["read_file"],
  });
  assert.equal(isToolActive(global, "read_file"), true);
  const profile = resolveToolActivationPolicy({ mode: { tools: [] }, knownTools: ["read_file"] });
  assert.equal(isToolActive(profile, "read_file"), false);
});

test("MCP patterns support globs but built-in tools remain exact", () => {
  const policy = composeToolActivationPolicy({
    profile: { tools: ["mcp__calendar__*"] },
    knownTools: ["mcp__calendar__list", "read_file"],
    mcpTools: ["mcp__calendar__list"],
  });
  assert.equal(isToolActive(policy, "mcp__calendar__list"), true);
  assert.equal(isToolActive(policy, "read_file"), false);
  assert.equal(isToolActive(policy, "mcp__calendar__list", "builtin"), false);
});

test("diagnostics identify dead patterns without disabling legacy defaults", () => {
  const policy = composeToolActivationPolicy({
    profile: { tools: ["read_flie", "*", "mcp__calendar"] },
    knownTools: ["read_file", "mcp__calendar__list"],
    mcpTools: ["mcp__calendar__list"],
  });
  assert.deepEqual(policy.diagnostics.map((item) => item.kind), ["unknown-tool", "wildcard-not-mcp", "incomplete-mcp-name"]);
});

test("filtering and explanations provide a stable diagnostic boundary", () => {
  const policy = composeToolActivationPolicy({
    global: { disabled: ["write_file"] },
    knownTools: ["read_file", "write_file"],
  });
  const specs = [
    { function: { name: "read_file" } },
    { function: { name: "write_file" } },
  ];
  assert.deepEqual(filterToolSpecsByActivation(specs, policy).map((item) => item.function.name), ["read_file"]);
  assert.deepEqual(explainToolActivation(policy, "write_file"), {
    active: false,
    layer: "global",
    reason: "global_denylist",
    matchedPattern: "write_file",
    name: "write_file",
    source: "builtin",
  });
  assert.deepEqual(publicToolActivationPolicy(policy).global.disabled, ["write_file"]);
});

test("Launcher uses the same policy for presentation, progressive loading, and dispatch", () => {
  const launcher = readFileSync(fileURLToPath(new URL("../launcher.mjs", import.meta.url)), "utf8");
  assert.match(launcher, /filterToolSpecsByActivation\(specs, currentToolActivationPolicy\(\)\)/u);
  assert.match(launcher, /getToolSpecs: \(\) => filterToolSpecsByActivation\(tools\.specs\(\), currentToolActivationPolicy\(\)\)/u);
  assert.match(launcher, /TOOL_DISABLED_BY_POLICY/u);
});
