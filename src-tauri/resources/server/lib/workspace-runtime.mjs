import { resolve } from "node:path";

function requiredFunction(value, name) {
  if (typeof value !== "function") throw new TypeError(`workspace runtime ${name} dependency is required`);
  return value;
}

/**
 * Owns workspace selection and the ordered workspace switch lifecycle.
 * Tool registration, MCP wiring and loop rebuilding are injected adapters;
 * this module never creates a model execution loop of its own.
 */
export function createWorkspaceRuntime({
  homeDir,
  readConfig,
  writeConfig,
  getCurrentWorkspace,
  setCurrentWorkspace,
  normalizeWorkspacePath,
  isWorkspaceDirectory,
  addRecentWorkspace,
  removeRecentWorkspace,
  normalizeWorkspaceHistory,
  sameWorkspacePath,
  ensureWorkspaceDirectory,
  clearPreparedDocuments = async () => {},
  removeMcpServers = async () => {},
  removeWorkspaceTools = async () => {},
  registerWorkspaceTools,
  rebuildLoop = async () => {},
  deploySkillGuide = async () => {},
  reloadMcp = async () => {},
  onLog = () => {},
} = {}) {
  if (!homeDir) throw new TypeError("workspace runtime homeDir is required");
  const read = requiredFunction(readConfig, "readConfig");
  const write = requiredFunction(writeConfig, "writeConfig");
  const current = requiredFunction(getCurrentWorkspace, "getCurrentWorkspace");
  const setCurrent = requiredFunction(setCurrentWorkspace, "setCurrentWorkspace");
  const normalize = requiredFunction(normalizeWorkspacePath, "normalizeWorkspacePath");
  const isDirectory = requiredFunction(isWorkspaceDirectory, "isWorkspaceDirectory");
  const addRecent = requiredFunction(addRecentWorkspace, "addRecentWorkspace");
  const removeRecent = requiredFunction(removeRecentWorkspace, "removeRecentWorkspace");
  const normalizeHistory = requiredFunction(normalizeWorkspaceHistory, "normalizeWorkspaceHistory");
  const same = requiredFunction(sameWorkspacePath, "sameWorkspacePath");
  const ensure = requiredFunction(ensureWorkspaceDirectory, "ensureWorkspaceDirectory");
  const register = requiredFunction(registerWorkspaceTools, "registerWorkspaceTools");

  function configuredWorkspace(cfg = read()) {
    return normalize(cfg.workspaceDir ?? "visionox-workspace", { homeDir });
  }

  function getState() {
    const cfg = read();
    const configured = configuredWorkspace(cfg);
    const stored = Array.isArray(cfg.recentWorkspaces) ? cfg.recentWorkspaces : [];
    const currentWorkspace = current();
    return {
      current: currentWorkspace,
      configured,
      pending: !same(currentWorkspace, configured),
      recentWorkspaces: normalizeHistory([configured, currentWorkspace, ...stored], { homeDir }),
    };
  }

  function select(directory) {
    const target = normalize(directory, { homeDir });
    if (!isDirectory(target)) throw new Error(`workspace directory does not exist: ${target}`);
    const cfg = read();
    const stored = Array.isArray(cfg.recentWorkspaces) ? cfg.recentWorkspaces : [];
    cfg.workspaceDir = target;
    cfg.recentWorkspaces = addRecent(target, [current(), ...stored], { homeDir });
    write(cfg);
    onLog(`[workspace-runtime] workspaceDir saved to config: ${target} (takes effect next /new)`);
    return getState();
  }

  function removeHistory(directory) {
    const target = normalize(directory, { homeDir });
    const state = getState();
    if (same(target, state.current) || same(target, state.configured)) {
      throw new Error("the current or pending workspace cannot be removed from history");
    }
    const cfg = read();
    cfg.recentWorkspaces = removeRecent(target, cfg.recentWorkspaces, { homeDir });
    write(cfg);
    return getState();
  }

  async function apply({ applyPending = true, registerOptions = {} } = {}) {
    const configured = configuredWorkspace(read());
    const previous = current();
    if (same(configured, previous)) return { changed: false, current: previous, configured };
    if (!applyPending) return { pending: true, current: previous, configured };

    onLog(`[workspace-runtime] workspace switch: ${previous} -> ${configured}`);
    await clearPreparedDocuments(previous, configured);
    await removeMcpServers(previous, configured);
    await removeWorkspaceTools(previous, configured);
    await ensure(configured);

    const result = await register(configured, registerOptions);
    setCurrent(configured);
    await rebuildLoop(configured, previous);
    await deploySkillGuide(configured);
    await reloadMcp(configured, previous);
    onLog(`[workspace-runtime] workspace synced: ${configured}`);
    return { changed: true, previous, current: configured, configured, ...result };
  }

  return {
    apply,
    getState,
    removeHistory,
    select,
  };
}
