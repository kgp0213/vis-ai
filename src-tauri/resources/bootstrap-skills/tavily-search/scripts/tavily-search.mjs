#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const FORMAT_CHOICES = ["json", "brave", "md"];

export function loadTavilyApiKey(environment = process.env, homeDir = homedir()) {
  const direct = String(environment.TAVILY_API_KEY ?? "").trim();
  if (direct) return direct;
  const envFile = join(homeDir, ".visionox", ".env");
  if (!existsSync(envFile)) return "";
  for (const rawLine of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^TAVILY_API_KEY\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    return match[1].trim().replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2");
  }
  return "";
}

export function parseArguments(argv) {
  const options = { query: "", maxResults: 5, includeAnswer: false, format: "json" };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") return { ...options, help: true };
    if (arg === "--include-answer") { options.includeAnswer = true; continue; }
    const value = argv[++index];
    if (value === undefined) throw new Error(`${arg} requires a value`);
    if (arg === "--query") options.query = value.trim();
    else if (arg === "--max-results") options.maxResults = Number(value);
    else if (arg === "--format") options.format = value;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!options.query) throw new Error("--query is required");
  if (!Number.isInteger(options.maxResults) || options.maxResults < 1 || options.maxResults > 10) throw new Error("--max-results must be an integer from 1 to 10");
  if (!FORMAT_CHOICES.includes(options.format)) throw new Error(`--format must be one of: ${FORMAT_CHOICES.join(", ")}`);
  return options;
}

export function formatBrave(data) {
  const result = {
    query: data.query ?? "",
    results: (data.results ?? []).map((item) => ({ title: item.title ?? "", url: item.url ?? "", snippet: item.content ?? "" })),
  };
  if (data.answer) result.answer = data.answer;
  return result;
}

export function formatMarkdown(data) {
  const lines = [`# Search: ${data.query ?? ""}`];
  if (data.answer) lines.push(`\n**Answer:** ${data.answer}`);
  for (const [index, item] of (data.results ?? []).entries()) {
    lines.push(`\n### ${index + 1}. [${item.title || "Untitled"}](${item.url || ""})`);
    if (item.content) lines.push(`   ${String(item.content).slice(0, 200)}`);
  }
  return lines.join("\n");
}

export async function searchTavily(options, apiKey, fetchImpl = fetch) {
  const response = await fetchImpl("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, query: options.query, max_results: options.maxResults, include_answer: options.includeAnswer }),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Tavily HTTP ${response.status}: ${text.slice(0, 500)}`);
  try { return JSON.parse(text); } catch { throw new Error("Tavily returned invalid JSON"); }
}

function help() {
  return "Usage: tavily-search --query <text> [--max-results 1..10] [--include-answer] [--format json|brave|md]";
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  if (options.help) { console.log(help()); return; }
  const apiKey = loadTavilyApiKey();
  if (!apiKey) throw new Error("TAVILY_API_KEY is not configured. Use @tavily-search in Visionox to enter it locally.");
  const data = await searchTavily(options, apiKey);
  if (options.format === "md") console.log(formatMarkdown(data));
  else console.log(JSON.stringify(options.format === "brave" ? formatBrave(data) : data, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(`ERROR: ${error.message}`); process.exitCode = 1; });
}
