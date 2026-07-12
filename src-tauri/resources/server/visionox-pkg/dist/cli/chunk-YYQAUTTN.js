#!/usr/bin/env node
import { createRequire as __cr } from 'node:module'; if (typeof globalThis.require === 'undefined') { globalThis.require = __cr(import.meta.url); }
import {
  indexCompatible,
  querySemanticGroups
} from "./chunk-XCGGEJTI.js";

// src/index/semantic/tool.ts
async function registerSemanticSearchTool(registry, opts) {
  if (!await indexCompatible(opts.root, opts))
    return false;
  const defaultTopK = opts.defaultTopK ?? 8;
  const defaultMinScore = opts.defaultMinScore ?? 0.3;
  registry.register({
    name: "semantic_search",
    description: "FIRST CHOICE for project knowledge and descriptive queries. Use this to recall past decisions, prior solutions, established workflows, validation evidence, and to find code or files by meaning. Returns ranked snippets from [knowledge] and [workspace] sources. Cite useful path:line ranges in the final answer. Use search_content instead for exact identifiers, regex patterns, or counting a known token.",
    readOnly: true,
    parallelSafe: true,
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural-language question or noun phrase, for example: 'why did we choose this build process?', 'previous validation findings', 'where do we validate the session cookie?', or 'retry backoff logic'. Do not pass exact identifiers; those are search_content's job."
        },
        topK: {
          type: "integer",
          description: `Number of snippets to return (1..16). Default ${defaultTopK}.`
        },
        minScore: {
          type: "number",
          description: `Drop snippets with cosine score below this (0..1). Default ${defaultMinScore}. Raise for stricter matches; lower if the index is small.`
        }
      },
      required: ["query"]
    },
    fn: async (args, ctx) => {
      const requestedTopK = Math.max(1, Math.min(16, args.topK ?? defaultTopK));
      const groups = await querySemanticGroups(opts.root, args.query, {
        knowledgeTopK: requestedTopK,
        workspaceTopK: requestedTopK,
        minScore: args.minScore ?? defaultMinScore,
        provider: opts.provider,
        baseUrl: opts.baseUrl,
        apiKey: opts.apiKey,
        model: opts.model,
        extraBody: opts.extraBody,
        signal: ctx?.signal
      });
      if (groups === null) {
        return "No semantic index found for this project. Run `visionox index` to build one.";
      }
      const hits = selectGroupedHits(groups, requestedTopK);
      if (hits.length === 0) {
        return `query: ${args.query}

no matches above the score threshold (${args.minScore ?? defaultMinScore}).`;
      }
      return formatHits(args.query, hits);
    }
  });
  return true;
}
function selectGroupedHits(groups, topK) {
  const combined = [...groups.knowledge, ...groups.workspace].sort((a, b) => b.score - a.score);
  if (groups.knowledge.length === 0 || groups.workspace.length === 0) return combined.slice(0, topK);
  const sourceLimit = Math.max(1, Math.ceil(topK * 0.75));
  const selected = [];
  const deferred = [];
  const counts = { knowledge: 0, workspace: 0 };
  for (const hit of combined) {
    const source = String(hit.entry.path || "").startsWith("knowledge/") ? "knowledge" : "workspace";
    if (counts[source] >= sourceLimit) deferred.push(hit);
    else {
      selected.push(hit);
      counts[source]++;
    }
    if (selected.length >= topK) break;
  }
  if (selected.length < topK) selected.push(...deferred.slice(0, topK - selected.length));
  return selected.sort((a, b) => b.score - a.score);
}
function formatHits(query, hits) {
  const lines = [`query: ${query}`, `
results (${hits.length}):`];
  hits.forEach((h, i) => {
    const { entry, score } = h;
    const sourceType = String(entry.path || "").startsWith("knowledge/") ? "knowledge" : "workspace";
    lines.push(
      `
${i + 1}. [${sourceType}] ${entry.path}:${entry.startLine}-${entry.endLine}  (score ${score.toFixed(3)})`
    );
    const preview = entry.text.split("\n").slice(0, 8).join("\n");
    lines.push(indentBlock(preview, "   "));
    if (entry.text.split("\n").length > 8) {
      lines.push(
        `   \u2026(${entry.text.split("\n").length - 8} more lines \u2014 read_file ${entry.path}:${entry.startLine} for the full chunk)`
      );
    }
  });
  return lines.join("\n");
}
function indentBlock(text, prefix) {
  return text.split("\n").map((l) => prefix + l).join("\n");
}
async function bootstrapSemanticSearchInCodeMode(registry, rootDir, opts = {}) {
  if (await indexCompatible(rootDir, opts)) {
    await registerSemanticSearchTool(registry, { ...opts, root: rootDir });
    return { enabled: true };
  }
  return { enabled: false };
}

export {
  registerSemanticSearchTool,
  bootstrapSemanticSearchInCodeMode
};
//# sourceMappingURL=chunk-YYQAUTTN.js.map
