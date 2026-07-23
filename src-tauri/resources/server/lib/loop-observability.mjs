export function createLoopTelemetry({ startedAt = Date.now(), now = Date.now } = {}) {
  const startMs = Number.isFinite(startedAt) ? Number(startedAt) : now();
  const state = {
    modelTurn: 0,
    toolDispatches: 0,
    toolResults: 0,
    contextCompactions: 0,
    warnings: 0,
    lastToolName: null,
    lastActivityAt: startMs,
  };

  function observe(event) {
    const currentMs = now();
    state.lastActivityAt = currentMs;
    if (Number.isInteger(event?.turn)) state.modelTurn = event.turn;
    if (event?.role === "tool_start") {
      state.toolDispatches++;
      state.lastToolName = event.toolName || null;
    } else if (event?.role === "tool") {
      state.toolResults++;
    } else if (event?.role === "context_compacted") {
      state.contextCompactions++;
    } else if (event?.role === "warning") {
      state.warnings++;
    }
    return snapshot();
  }

  function snapshot() {
    return {
      ...state,
      elapsedMs: Math.max(0, now() - startMs),
    };
  }

  return { observe, snapshot };
}
