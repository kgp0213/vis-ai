const DEFAULT_THRESHOLD = 24;
const MAX_DISCOVERY_RESULTS = 8;

function uniqueNames(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function toolName(spec) {
  return String(spec?.function?.name ?? "").trim();
}

function discoverySpec(definition) {
  return {
    type: "function",
    function: {
      name: definition.name,
      description: definition.description,
      parameters: definition.parameters,
    },
  };
}

export function shouldUseProgressiveToolDiscovery(capabilities, mcpToolNames, threshold = DEFAULT_THRESHOLD) {
  return capabilities?.progressiveToolDiscovery === true && uniqueNames(mcpToolNames).length > threshold;
}

export function createProgressiveToolDiscovery({
  getCapabilities = () => ({}),
  getMcpToolNames = () => [],
  getToolSpecs = () => [],
  addToolToPrefix = () => false,
  removeToolFromPrefix = () => false,
  presentSpec = (spec) => spec,
  threshold = DEFAULT_THRESHOLD,
  maxPerRequest = MAX_DISCOVERY_RESULTS,
} = {}) {
  const loadedNames = new Set();
  const resultLimit = Math.max(1, Math.min(MAX_DISCOVERY_RESULTS, Number(maxPerRequest) || MAX_DISCOVERY_RESULTS));

  const toolDefinition = {
    name: "discover_tools",
    description: "Find and load MCP tools by capability. Use a short capability query; at most 8 matching tools are loaded per call.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Capability, service, or action to search for." },
        limit: { type: "integer", minimum: 1, maximum: MAX_DISCOVERY_RESULTS },
      },
      required: ["query"],
    },
    readOnly: true,
    contextControl: true,
    stormExempt: true,
    fn: async ({ query, limit } = {}) => {
      if (!enabled()) {
        return JSON.stringify({ ok: false, code: "progressive_tool_discovery_disabled", loaded: [], remaining: 0 });
      }
      const normalizedQuery = String(query ?? "").trim().toLowerCase();
      if (!normalizedQuery) return JSON.stringify({ ok: false, code: "tool_query_required", loaded: [], remaining: hiddenSpecs().length });
      const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
      const matches = hiddenSpecs().filter((spec) => {
        const haystack = `${toolName(spec)} ${spec?.function?.description ?? ""}`.toLowerCase();
        return tokens.every((token) => haystack.includes(token));
      });
      const boundedLimit = Math.max(1, Math.min(resultLimit, Number(limit) || resultLimit));
      const selected = matches.slice(0, boundedLimit);
      const loaded = [];
      for (const spec of selected) {
        const name = toolName(spec);
        if (!name) continue;
        const added = addToolToPrefix(spec);
        if (added !== false) {
          loadedNames.add(name);
          loaded.push(name);
        }
      }
      return JSON.stringify({
        ok: true,
        query: normalizedQuery,
        loaded,
        remaining: Math.max(0, hiddenSpecs().length),
        matches: selected.map((spec) => ({ name: toolName(spec), description: String(spec?.function?.description ?? "").slice(0, 240) })),
      });
    },
  };

  function mcpNames() {
    return new Set(uniqueNames(getMcpToolNames()));
  }

  function enabled() {
    return shouldUseProgressiveToolDiscovery(getCapabilities(), [...mcpNames()], threshold);
  }

  function hiddenSpecs() {
    const mcp = mcpNames();
    return getToolSpecs().filter((spec) => {
      const name = toolName(spec);
      return mcp.has(name) && !loadedNames.has(name);
    });
  }

  function presentInitialSpecs(specs) {
    const list = Array.isArray(specs) ? specs : [];
    if (!enabled()) return list.filter((spec) => toolName(spec) !== toolDefinition.name);
    const mcp = mcpNames();
    const visible = list.filter((spec) => {
      const name = toolName(spec);
      return name !== toolDefinition.name && (!mcp.has(name) || loadedNames.has(name));
    });
    visible.push(presentSpec(discoverySpec(toolDefinition)));
    return visible;
  }

  function shouldHideTool(name) {
    return enabled() && mcpNames().has(String(name ?? "")) && !loadedNames.has(String(name ?? ""));
  }

  function syncPrefix() {
    const specs = getToolSpecs();
    if (!enabled()) {
      removeToolFromPrefix(toolDefinition.name);
      for (const spec of specs) {
        if (mcpNames().has(toolName(spec))) addToolToPrefix(spec);
      }
      return { enabled: false, hidden: 0 };
    }
    for (const name of mcpNames()) {
      if (!loadedNames.has(name)) removeToolFromPrefix(name);
    }
    addToolToPrefix(discoverySpec(toolDefinition));
    return { enabled: true, hidden: hiddenSpecs().length };
  }

  return {
    enabled,
    loadedNames: () => [...loadedNames],
    presentInitialSpecs,
    reset: () => loadedNames.clear(),
    shouldHideTool,
    syncPrefix,
    toolDefinition,
  };
}
