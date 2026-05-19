#!/usr/bin/env node
import { createRequire as __cr } from 'node:module'; if (typeof globalThis.require === 'undefined') { globalThis.require = __cr(import.meta.url); }
import {
  detectProxyUrl
} from "./chunk-74EX7SUH.js";
import {
  resolveDataPath
} from "./chunk-PV55UMTO.js";
import {
  DeepSeekClient,
  pickPrimaryBalance
} from "./chunk-2KDUS647.js";
import {
  loadDotenv
} from "./chunk-2UQP6H6T.js";
import {
  checkOllamaStatus
} from "./chunk-DOYHN4KB.js";
import {
  indexExists
} from "./chunk-XCGGEJTI.js";
import {
  loadHooks
} from "./chunk-7O5ALB4C.js";
import {
  listSessions
} from "./chunk-6PBZN4VI.js";
import {
  t
} from "./chunk-RE4RAVFF.js";
import {
  defaultConfigPath,
  loadBaseUrl,
  readConfig,
  resolveSemanticEmbeddingConfig
} from "./chunk-XPDVG52A.js";
import {
  VERSION
} from "./chunk-XXC2BYTV.js";

// src/cli/commands/doctor.ts
import { existsSync, readFileSync, statSync } from "fs";
import { homedir } from "os";
import { join, resolve } from "path";
async function runDoctorChecks(projectRoot) {
  return Promise.all([
    checkApiKey(),
    checkConfig(),
    checkProxy(),
    checkApiReach(),
    checkTokenizer(),
    checkSessions(),
    checkHooks(projectRoot),
    checkOllama(projectRoot),
    checkProject(projectRoot)
  ]);
}
function checkProxy() {
  const url = detectProxyUrl();
  if (!url) {
    return {
      id: "proxy",
      label: "http proxy   ",
      level: "ok",
      detail: "no HTTPS_PROXY / HTTP_PROXY / ALL_PROXY set \u2014 direct connection"
    };
  }
  let redacted = url;
  try {
    const u = new URL(url);
    if (u.username || u.password) {
      u.username = "***";
      u.password = "";
      redacted = u.toString();
    }
  } catch {
  }
  return {
    id: "proxy",
    label: "http proxy   ",
    level: "ok",
    detail: `routing fetch through ${redacted}`
  };
}
var TTY = process.stdout.isTTY && process.env.TERM !== "dumb";
function color(text, code) {
  if (!TTY) return text;
  return `\x1B[${code}m${text}\x1B[0m`;
}
function badge(level) {
  if (level === "ok") return color("\u2713", "32");
  if (level === "warn") return color("\u26A0", "33");
  return color("\u2717", "31");
}
function tail4(s) {
  return s.length <= 4 ? s : `\u2026${s.slice(-4)}`;
}
function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
async function checkApiKey() {
  const fromEnv = process.env.DEEPSEEK_API_KEY;
  if (fromEnv) {
    return {
      id: "api-key",
      label: "api key      ",
      level: "ok",
      detail: `set via env DEEPSEEK_API_KEY (${tail4(fromEnv)})`
    };
  }
  try {
    const cfg = readConfig();
    if (cfg.apiKey) {
      return {
        id: "api-key",
        label: "api key      ",
        level: "ok",
        detail: `from ${defaultConfigPath()} (${tail4(cfg.apiKey)})`
      };
    }
  } catch {
  }
  return {
    id: "api-key",
    label: "api key      ",
    level: "fail",
    detail: "not set \u2014 `reasonix setup` to save one, or export DEEPSEEK_API_KEY. Get a key at https://platform.deepseek.com/api_keys"
  };
}
async function checkConfig() {
  const path = defaultConfigPath();
  if (!existsSync(path)) {
    return {
      id: "config",
      label: "config       ",
      level: "warn",
      detail: "missing \u2014 running with library defaults. `reasonix setup` writes one."
    };
  }
  try {
    const cfg = readConfig(path);
    const parts = [];
    if (cfg.preset) parts.push(`preset=${cfg.preset}`);
    if (cfg.editMode) parts.push(`editMode=${cfg.editMode}`);
    if (cfg.mcp && cfg.mcp.length > 0) parts.push(`mcp=${cfg.mcp.length}`);
    return {
      id: "config",
      label: "config       ",
      level: "ok",
      detail: `${path}${parts.length ? ` (${parts.join(", ")})` : ""}`
    };
  } catch (err) {
    return {
      id: "config",
      label: "config       ",
      level: "fail",
      detail: t("doctorErrors.unreadable", { path, message: err.message })
    };
  }
}
async function checkApiReach() {
  const key = process.env.DEEPSEEK_API_KEY ?? readConfig().apiKey;
  if (!key) {
    return {
      id: "api-reach",
      label: "api reach    ",
      level: "warn",
      detail: "skipped \u2014 no api key to test with"
    };
  }
  try {
    const client = new DeepSeekClient({ apiKey: key, baseUrl: loadBaseUrl() });
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8e3);
    let balance;
    try {
      balance = await client.getBalance({ signal: ctl.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!balance) {
      return {
        id: "api-reach",
        label: "api reach    ",
        level: "fail",
        detail: "/user/balance returned null \u2014 auth failed or network blocked"
      };
    }
    const summary = summarizeBalances(balance.balance_infos);
    if (!balance.is_available) {
      return {
        id: "api-reach",
        label: "api reach    ",
        level: "warn",
        detail: `account flagged not-available${summary ? ` (${summary})` : ""} \u2014 top up or check your dashboard`
      };
    }
    return {
      id: "api-reach",
      label: "api reach    ",
      level: "ok",
      detail: summary ? `/user/balance ok \u2014 ${summary}` : "/user/balance ok"
    };
  } catch (err) {
    return {
      id: "api-reach",
      label: "api reach    ",
      level: "fail",
      detail: `${err.message}`
    };
  }
}
function summarizeBalances(infos) {
  if (infos.length === 0) return "";
  const primary = pickPrimaryBalance(infos);
  if (infos.length === 1 || !primary)
    return primary ? `${primary.total_balance} ${primary.currency}` : "";
  const rest = infos.filter((i) => i !== primary).map((i) => `${i.total_balance} ${i.currency}`);
  return `${primary.total_balance} ${primary.currency} + ${rest.join(" + ")}`;
}
async function checkTokenizer() {
  const path = resolveDataPath();
  if (existsSync(path)) {
    try {
      const stat = statSync(path);
      return {
        id: "tokenizer",
        label: "tokenizer    ",
        level: "ok",
        detail: `${path} (${fmtBytes(stat.size)})`
      };
    } catch {
    }
  }
  return {
    id: "tokenizer",
    label: "tokenizer    ",
    level: "warn",
    detail: "data/deepseek-tokenizer.json.gz not found \u2014 token counts will fall back to char heuristics"
  };
}
async function checkSessions() {
  try {
    const list = listSessions();
    if (list.length === 0) {
      return {
        id: "sessions",
        label: "sessions     ",
        level: "ok",
        detail: "0 saved"
      };
    }
    const totalBytes = list.reduce((s, e) => s + e.size, 0);
    const oldest = list[list.length - 1];
    const ageDays = Math.floor((Date.now() - oldest.mtime.getTime()) / (24 * 60 * 60 * 1e3));
    const stale = list.filter(
      (e) => Date.now() - e.mtime.getTime() >= 90 * 24 * 60 * 60 * 1e3
    ).length;
    const detail = `${list.length} saved \xB7 ${fmtBytes(totalBytes)} \xB7 oldest ${ageDays}d`;
    if (stale > 0) {
      return {
        id: "sessions",
        label: "sessions     ",
        level: "warn",
        detail: `${detail} \xB7 ${stale} idle \u226590d (run \`reasonix prune-sessions\`)`
      };
    }
    return { id: "sessions", label: "sessions     ", level: "ok", detail };
  } catch (err) {
    return {
      id: "sessions",
      label: "sessions     ",
      level: "warn",
      detail: t("doctorErrors.cannotList", { message: err.message })
    };
  }
}
async function checkHooks(projectRoot) {
  try {
    const all = loadHooks({ projectRoot });
    const global = all.filter((h) => h.scope === "global").length;
    const project = all.filter((h) => h.scope === "project").length;
    return {
      id: "hooks",
      label: "hooks        ",
      level: "ok",
      detail: `${global} global, ${project} project`
    };
  } catch (err) {
    return {
      id: "hooks",
      label: "hooks        ",
      level: "warn",
      detail: t("doctorErrors.parseFailed", { message: err.message })
    };
  }
}
async function checkOllama(projectRoot) {
  let exists = false;
  try {
    exists = await indexExists(projectRoot);
  } catch {
  }
  if (!exists) {
    return {
      id: "semantic",
      label: "semantic     ",
      level: "ok",
      detail: "not in use (no semantic index built; `reasonix index` to enable)"
    };
  }
  const meta = readSemanticMeta(projectRoot);
  if (meta?.provider === "openai-compat") {
    const resolved = resolveSemanticEmbeddingConfig();
    if (resolved.provider !== "openai-compat") {
      return {
        id: "semantic",
        label: "semantic     ",
        level: "warn",
        detail: `index uses openai-compat/${meta.model} but current config resolves to ${resolved.provider}/${resolved.model} \u2014 rebuild before searching`
      };
    }
    return {
      id: "semantic",
      label: "semantic     ",
      level: "ok",
      detail: `openai-compat \xB7 ${resolved.baseUrl} \xB7 model ${resolved.model} \xB7 api key configured`
    };
  }
  try {
    const model = meta?.model || process.env.visionox_EMBED_MODEL || "nomic-embed-text";
    const status = await checkOllamaStatus(model);
    if (!status.binaryFound) {
      return {
        id: "semantic",
        label: "semantic     ",
        level: "warn",
        detail: "ollama binary not on PATH \u2014 semantic_search will fail; install from https://ollama.com"
      };
    }
    if (!status.daemonRunning) {
      return {
        id: "semantic",
        label: "semantic     ",
        level: "warn",
        detail: "ollama daemon not running \u2014 `ollama serve` (or call /semantic in TUI to auto-start)"
      };
    }
    if (!status.modelPulled) {
      return {
        id: "semantic",
        label: "semantic     ",
        level: "warn",
        detail: `model ${status.modelName} not pulled \u2014 \`ollama pull ${status.modelName}\``
      };
    }
    return {
      id: "semantic",
      label: "semantic     ",
      level: "ok",
      detail: `ollama daemon up \xB7 model ${status.modelName} ready`
    };
  } catch (err) {
    return {
      id: "semantic",
      label: "semantic     ",
      level: "warn",
      detail: t("doctorErrors.probeFailed", { message: err.message })
    };
  }
}
function readSemanticMeta(projectRoot) {
  try {
    const raw = readFileSync(join(projectRoot, ".visionox", "semantic", "index.meta.json"), "utf8");
    const parsed = JSON.parse(raw);
    return {
      provider: parsed.provider === "openai-compat" ? "openai-compat" : "ollama",
      model: typeof parsed.model === "string" ? parsed.model : ""
    };
  } catch {
    return null;
  }
}
async function checkProject(projectRoot) {
  const markers = [".git", "REASONIX.md", "package.json", "pyproject.toml", "Cargo.toml", "go.mod"];
  const found = markers.filter((m) => existsSync(join(projectRoot, m)));
  if (found.length === 0) {
    return {
      id: "project",
      label: "project      ",
      level: "warn",
      detail: `${projectRoot} has none of: ${markers.slice(0, 3).join(", ")} \u2026 \u2014 \`reasonix code\` will still run, but @-mentions and project memory have nothing to anchor`
    };
  }
  return {
    id: "project",
    label: "project      ",
    level: "ok",
    detail: `${projectRoot} (${found.join(", ")})`
  };
}
function formatDoctorJson(checks, version) {
  const ok = checks.filter((c) => c.level === "ok").length;
  const warn = checks.filter((c) => c.level === "warn").length;
  const fail = checks.filter((c) => c.level === "fail").length;
  return JSON.stringify({
    version,
    summary: { ok, warn, fail },
    checks: checks.map((c) => ({ id: c.id, status: c.level, message: c.detail }))
  });
}
async function doctorCommand(opts = {}) {
  loadDotenv();
  const projectRoot = resolve(process.cwd());
  const json = !!opts.json;
  if (!json) {
    console.log(`${color(`reasonix ${VERSION}  \xB7  doctor`, "1")}  (cwd: ${projectRoot})`);
    console.log(`  home: ${homedir()}`);
    console.log("");
  }
  const checks = await runDoctorChecks(projectRoot);
  const ok = checks.filter((c) => c.level === "ok").length;
  const warn = checks.filter((c) => c.level === "warn").length;
  const fail = checks.filter((c) => c.level === "fail").length;
  if (json) {
    console.log(formatDoctorJson(checks, VERSION));
    if (fail > 0) process.exit(1);
    return;
  }
  for (const c of checks) {
    console.log(`  ${badge(c.level)}  ${c.label}  ${c.detail}`);
  }
  console.log("");
  const summary = `${ok} ok \xB7 ${warn} warn \xB7 ${fail} fail`;
  if (fail > 0) {
    console.log(color(summary, "31"));
    process.exit(1);
  } else if (warn > 0) {
    console.log(color(summary, "33"));
  } else {
    console.log(color(summary, "32"));
  }
}

export {
  runDoctorChecks,
  formatDoctorJson,
  doctorCommand
};
//# sourceMappingURL=chunk-VK5HG73G.js.map