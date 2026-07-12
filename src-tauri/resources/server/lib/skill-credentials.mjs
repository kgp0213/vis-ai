import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { atomicWriteFileSync } from "./atomic-file.mjs";

const SKILL_CREDENTIALS = Object.freeze({
  "tavily-search": Object.freeze({
    envName: "TAVILY_API_KEY",
    label: "Tavily API Key",
    helpUrl: "https://app.tavily.com/home",
  }),
});

function credentialSpec(skillName) {
  return SKILL_CREDENTIALS[String(skillName ?? "").trim()] ?? null;
}
function envFileForHome(homeDir) {
  return join(homeDir, ".visionox", ".env");
}

function readStoredValue(path, envName) {
  if (!existsSync(path)) return "";
  const prefix = `${envName}=`;
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith(prefix)) continue;
    return line.slice(prefix.length).trim().replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2");
  }
  return "";
}

export function getSkillCredentialStatus(skillName, options = {}) {
  const spec = credentialSpec(skillName);
  if (!spec) return null;
  const homeDir = options.homeDir ?? homedir();
  const environment = options.environment ?? process.env;
  const configured = Boolean(String(environment[spec.envName] ?? "").trim() || readStoredValue(envFileForHome(homeDir), spec.envName));
  return {
    skill: skillName,
    required: true,
    configured,
    label: spec.label,
    helpUrl: spec.helpUrl,
  };
}

export function saveSkillCredential(skillName, rawValue, options = {}) {
  const spec = credentialSpec(skillName);
  if (!spec) throw new Error(`skill does not support managed credentials: ${skillName}`);
  const value = typeof rawValue === "string" ? rawValue.trim() : "";
  if (value.length < 8 || value.length > 512 || /[\r\n\0]/.test(value)) {
    throw new Error("API key must be 8-512 characters on one line");
  }

  const homeDir = options.homeDir ?? homedir();
  const environment = options.environment ?? process.env;
  const envDir = join(homeDir, ".visionox");
  const envFile = envFileForHome(homeDir);
  mkdirSync(envDir, { recursive: true });
  const lines = existsSync(envFile) ? readFileSync(envFile, "utf8").split(/\r?\n/) : [];
  const prefix = `${spec.envName}=`;
  let replaced = false;
  const next = [];
  for (const line of lines) {
    if (line.trimStart().startsWith(prefix)) {
      if (!replaced) next.push(`${prefix}${value}`);
      replaced = true;
    } else {
      next.push(line);
    }
  }
  if (!replaced) next.push(`${prefix}${value}`);
  while (next.length > 0 && next[next.length - 1] === "") next.pop();
  atomicWriteFileSync(envFile, `${next.join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
  environment[spec.envName] = value;
  return getSkillCredentialStatus(skillName, { homeDir, environment });
}
