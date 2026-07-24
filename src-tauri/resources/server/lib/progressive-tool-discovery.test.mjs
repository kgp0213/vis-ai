import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { createProgressiveToolDiscovery, shouldUseProgressiveToolDiscovery } from "./progressive-tool-discovery.mjs";

function spec(name, description = name) {
  return { type: "function", function: { name, description, parameters: { type: "object", properties: {} } } };
}

describe("progressive tool discovery", () => {
  test("is explicitly enabled only above the MCP threshold", () => {
    const names = Array.from({ length: 25 }, (_, index) => `mcp_${index}`);
    assert.equal(shouldUseProgressiveToolDiscovery({}, names), false);
    assert.equal(shouldUseProgressiveToolDiscovery({ progressiveToolDiscovery: false }, names), false);
    assert.equal(shouldUseProgressiveToolDiscovery({ progressiveToolDiscovery: true }, names.slice(0, 24)), false);
    assert.equal(shouldUseProgressiveToolDiscovery({ progressiveToolDiscovery: true }, names), true);
  });

  test("keeps core tools visible and loads at most eight matching MCP tools", async () => {
    const allSpecs = [spec("read_file", "read a file")];
    const mcpNames = [];
    for (let index = 0; index < 30; index++) {
      const name = `calendar_tool_${index}`;
      mcpNames.push(name);
      allSpecs.push(spec(name, `calendar operation ${index}`));
    }
    const prefixNames = [];
    const runtime = createProgressiveToolDiscovery({
      getCapabilities: () => ({ progressiveToolDiscovery: true }),
      getMcpToolNames: () => mcpNames,
      getToolSpecs: () => allSpecs,
      addToolToPrefix: (toolSpec) => { prefixNames.push(toolSpec.function.name); return true; },
    });

    const initial = runtime.presentInitialSpecs(allSpecs);
    assert.deepEqual(initial.map((item) => item.function.name), ["read_file", "discover_tools"]);
    const result = JSON.parse(await runtime.toolDefinition.fn({ query: "calendar", limit: 99 }));
    assert.equal(result.loaded.length, 8);
    assert.deepEqual(prefixNames, result.loaded);
    assert.equal(result.remaining, 22);
  });

  test("leaves all MCP tools visible for models without the capability", () => {
    const allSpecs = [spec("read_file"), ...Array.from({ length: 30 }, (_, index) => spec(`mcp_${index}`))];
    const runtime = createProgressiveToolDiscovery({
      getCapabilities: () => ({}),
      getMcpToolNames: () => allSpecs.slice(1).map((item) => item.function.name),
      getToolSpecs: () => allSpecs,
      addToolToPrefix: () => true,
    });
    assert.deepEqual(runtime.presentInitialSpecs(allSpecs).map((item) => item.function.name), allSpecs.map((item) => item.function.name));
  });
});
