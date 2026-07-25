/**
 * Dependency installation is a host lifecycle action, not a model shell action.
 * Keeping this classifier in the shared policy means admin/yolo cannot bypass it.
 */
export function shellRuntimeInstallIntent(command) {
  const value = String(command ?? "").trim();
  if (!value) return { blocked: false, code: null, family: null };
  const normalized = value.replace(/["']/g, "").replace(/\\/g, "/");
  const unwrapped = normalized
    .replace(/^\s*&\s*/u, "")
    .replace(/^\s*(?:cmd(?:\.exe)?\s+\/c|powershell(?:\.exe)?\s+-Command|pwsh(?:\.exe)?\s+-Command)\s+/iu, "")
    .trim();
  if (/(?:^|[;&|]\s*)(?:npm(?:\.cmd)?|pnpm|yarn)\b[\s\S]{0,240}\b(?:install|i|add|ci|remove|rm|uninstall|update|upgrade)\b/i.test(unwrapped)) {
    return { blocked: true, code: "RUNTIME_INSTALL_MANAGED_BY_HOST", family: "node-package", action: "use runtime capability manager" };
  }
  if (/(?:python(?:\d+(?:\.\d+)?)?|py)(?:\.exe)?\s+-m\s+pip\b[\s\S]{0,120}\b(?:install|download|uninstall|remove|wheel|add|sync|update|upgrade)\b|(?:^|\s)(?:pip(?:\.exe)?|pipx|uv\s+pip|conda|mamba|poetry)\s+[\s\S]{0,120}\b(?:install|download|uninstall|remove|wheel|add|sync|update|upgrade|create)\b/i.test(unwrapped)) {
    return { blocked: true, code: "RUNTIME_INSTALL_MANAGED_BY_HOST", family: "python-package", action: "use runtime capability manager" };
  }
  if (/(?:python(?:\d+(?:\.\d+)?)?|py)(?:\.exe)?\s+-m\s+venv\b/i.test(unwrapped)
    || /(?:^|[;&|]\s*)(?:virtualenv|uv\s+venv|conda\s+create|mamba\s+create)\b/i.test(unwrapped)) {
    return { blocked: true, code: "RUNTIME_INSTALL_MANAGED_BY_HOST", family: "python-environment", action: "use runtime capability manager" };
  }
  if (/(?:^|[;&|]\s*)(?:curl|wget|bitsadmin|invoke-webrequest|iwr)\b[\s\S]*https?:\/\/[^\s]+(?:\.(?:exe|msi|zip|whl|tar\.gz|py|sh)|python|node)\b/i.test(unwrapped)) {
    return { blocked: true, code: "RUNTIME_DOWNLOAD_MANAGED_BY_HOST", family: "runtime-download", action: "use runtime capability manager" };
  }
  return { blocked: false, code: null, family: null };
}

export function shellCommandHasSideEffects(command) {
  const value = String(command ?? "").trim();
  if (!value) return false;
  if (shellRuntimeInstallIntent(value).blocked) return true;
  if (/(?:^|\s)(?:\d*>>?|&>)\s*(?:"[^"]+"|'[^']+'|[^\s]+)/u.test(value)) return true;
  if (/(?:^|\s)(?:del|erase|rm|rmdir|move|mv|copy|cp|mkdir|md|touch|set-content|add-content)\b/i.test(value)) return true;
  if (/(?:python|python3|py|node|deno)(?:\.exe)?\b[\s\S]*?(?:open\s*\([^)]*(?:['\"](?:w|a|x|wb|ab)|mode\s*=\s*['\"](?:w|a|x|wb|ab))|write(?:File|Text|Bytes)?(?:Sync)?\s*\(|appendFile(?:Sync)?\s*\()/i.test(value)) return true;
  if (/^\s*pdftotext\b/i.test(value) && !/\s-\s*$/.test(value)) return true;
  return false;
}

export function shellCommandArtifactPaths(command) {
  const value = String(command ?? "");
  const paths = [];
  const add = (candidate) => {
    const path = String(candidate ?? "").trim();
    if (path && !paths.includes(path)) paths.push(path);
  };
  for (const match of value.matchAll(/(?:^|\s)(?:\d*>>?|&>)\s*(?:"([^"]+)"|'([^']+)'|([^\s]+))/gu)) {
    add(match[1] ?? match[2] ?? match[3]);
  }
  for (const match of value.matchAll(/\b(?:out|output|target|dest(?:ination)?)\s*=\s*r?["']([^"']+)["']/giu)) add(match[1]);
  for (const match of value.matchAll(/(?:open|writeFile(?:Sync)?|appendFile(?:Sync)?)\s*\(\s*r?["']([^"']+)["']/giu)) add(match[1]);
  if (/^\s*pdftotext\b/i.test(value) && !/\s-\s*$/.test(value)) {
    const quoted = [...value.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
    if (quoted.length >= 2) add(quoted.at(-1));
  }
  return paths;
}
