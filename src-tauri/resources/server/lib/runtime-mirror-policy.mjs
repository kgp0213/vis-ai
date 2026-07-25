export const DEFAULT_MIRROR_SOURCES = Object.freeze({
  node: ["https://registry.npmmirror.com"],
  python: ["https://pypi.tuna.tsinghua.edu.cn/simple", "https://mirrors.aliyun.com/pypi/simple/"],
});

const OFFICIAL_SOURCES = Object.freeze({
  node: "https://registry.npmjs.org",
  python: "https://pypi.org/simple",
});

const TRUSTED_HOSTS = Object.freeze({
  node: new Set(["registry.npmmirror.com", "registry.npmjs.org"]),
  python: new Set(["pypi.tuna.tsinghua.edu.cn", "mirrors.aliyun.com", "pypi.org"]),
});

function kindName(kind) {
  return String(kind ?? "").toLowerCase() === "node" ? "node" : "python";
}

export function validatePackageSource(source, kind, { allowUserConfigured = false } = {}) {
  try {
    const raw = String(source ?? "").trim();
    const url = new URL(raw);
    const normalizedKind = kindName(kind);
    if (url.protocol !== "https:") return { ok: false, reason: "package sources must use HTTPS" };
    const allowed = TRUSTED_HOSTS[normalizedKind].has(url.hostname.toLowerCase());
    if (!allowed && !allowUserConfigured) return { ok: false, reason: `package source host is not approved: ${url.hostname}` };
    const normalized = url.toString().replace(/\/$/u, "");
    return { ok: true, url: raw.endsWith("/") ? `${normalized}/` : normalized };
  } catch {
    return { ok: false, reason: "package source must be a valid HTTPS URL" };
  }
}

export function resolvePackageSources(kind, { configured = [], allowOfficialFallback = true, domesticOnly = false } = {}) {
  const normalizedKind = kindName(kind);
  const values = [];
  const add = (source, options = {}) => {
    const result = validatePackageSource(source, normalizedKind, options);
    if (result.ok && !values.includes(result.url)) values.push(result.url);
  };
  for (const source of Array.isArray(configured) ? configured : []) add(source, { allowUserConfigured: true });
  for (const source of DEFAULT_MIRROR_SOURCES[normalizedKind]) add(source);
  if (!domesticOnly && allowOfficialFallback) add(OFFICIAL_SOURCES[normalizedKind]);
  return values;
}

export function packageSourceName(source) {
  try { return new URL(String(source)).hostname.toLowerCase(); } catch { return null; }
}

export function officialPackageSource(kind) {
  return OFFICIAL_SOURCES[kindName(kind)];
}
