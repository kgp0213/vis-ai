#!/usr/bin/env node
import { createRequire as __cr } from 'node:module'; if (typeof globalThis.require === 'undefined') { globalThis.require = __cr(import.meta.url); }
import {
  chatCommand
} from "./chunk-P7EKE5ZQ.js";
import "./chunk-2Z35JOA4.js";
import "./chunk-JMBMLOBP.js";
import "./chunk-3Z6IBU3D.js";
import {
  buildCodeToolset
} from "./chunk-YFGF5NKA.js";
import "./chunk-45U62RI3.js";
import "./chunk-H6PS7IUE.js";
import "./chunk-PQXPXJBJ.js";
import {
  markPhase
} from "./chunk-ZZM6QJ4W.js";
import "./chunk-2R4QCDOZ.js";
import "./chunk-F3PXYSNN.js";
import "./chunk-FHOGSSCH.js";
import "./chunk-6AK4EY3D.js";
import "./chunk-5JJRUIPA.js";
import "./chunk-6PZ3CXBP.js";
import "./chunk-TJX6BFZZ.js";
import "./chunk-6G3CUUFG.js";
import {
  resolvePreset
} from "./chunk-2425HK6U.js";
import "./chunk-VK5HG73G.js";
import "./chunk-74EX7SUH.js";
import "./chunk-PV55UMTO.js";
import "./chunk-2KDUS647.js";
import "./chunk-25T6CVUP.js";
import {
  loadDotenv
} from "./chunk-2UQP6H6T.js";
import "./chunk-OSZC7C6F.js";
import "./chunk-SZ5XES2N.js";
import "./chunk-3BXRZFWS.js";
import "./chunk-4QUNBQQ2.js";
import "./chunk-XJXDHAES.js";
import "./chunk-YYQAUTTN.js";
import "./chunk-O52OLQL3.js";
import {
  detectForeignAgentPlatform
} from "./chunk-2K65GZBT.js";
import "./chunk-PLHAZOLZ.js";
import "./chunk-DOYHN4KB.js";
import "./chunk-XCGGEJTI.js";
import "./chunk-7O5ALB4C.js";
import "./chunk-S4XVGLRW.js";
import {
  sanitizeName
} from "./chunk-6PBZN4VI.js";
import {
  t
} from "./chunk-RE4RAVFF.js";
import {
  loadApiKey,
  loadPreset,
  readConfig
} from "./chunk-XPDVG52A.js";
import "./chunk-HFEAY5DT.js";
import "./chunk-YQ6NTIIE.js";
import "./chunk-XXC2BYTV.js";
import "./chunk-TUK7OWJA.js";

// src/cli/commands/code.tsx
import { readFileSync } from "fs";
import { basename, resolve } from "path";
async function codeCommand(opts = {}) {
  markPhase("code_command_enter");
  const resolvedModel = opts.model ?? resolvePreset(loadPreset()).model;
  loadDotenv();
  const cfgKey = loadApiKey();
  if (cfgKey && !process.env.DEEPSEEK_API_KEY) {
    process.env.DEEPSEEK_API_KEY = cfgKey;
  }
  const { codeSystemPrompt } = await import("./prompt-UW6EFLVR.js");
  const rootDir = resolve(opts.dir ?? process.cwd());
  const session = opts.noSession ? void 0 : `code-${sanitizeName(basename(rootDir))}`;
  markPhase("semantic_bootstrap_start");
  const { tools, jobs, registerRooted, reBootstrapSemantic, semantic } = await buildCodeToolset({
    rootDir
  });
  markPhase(
    semantic.enabled ? "semantic_bootstrap_done_enabled" : "semantic_bootstrap_done_skipped"
  );
  process.stderr.write(
    `${t("startup.codeRooted", {
      rootDir,
      session: session ?? t("startup.ephemeral"),
      tools: tools.size,
      semantic: semantic.enabled ? t("startup.semanticOn") : ""
    })}
`
  );
  const foreign = detectForeignAgentPlatform(rootDir);
  if (foreign) {
    process.stderr.write(t("code.workspaceConflict", { platforms: foreign.join(", ") }));
  }
  process.once("exit", () => {
    void jobs.shutdown();
  });
  let systemAppendFileContents;
  if (opts.systemAppend !== void 0 && opts.systemAppend.trim().length === 0) {
    process.stderr.write(t("code.systemAppendEmpty"));
  }
  if (opts.systemAppendFile) {
    const filePath = resolve(opts.systemAppendFile);
    try {
      systemAppendFileContents = readFileSync(filePath, "utf8");
    } catch (err) {
      const e = err;
      const errorDetails = e.code ? `[${e.code}] ${e.message}` : e.message;
      process.stderr.write(t("code.systemAppendFileReadError", { filePath, errorDetails }));
      process.exit(1);
    }
  }
  const codeRebuildSystem = () => codeSystemPrompt(rootDir, {
    hasSemanticSearch: semantic.enabled,
    systemAppend: opts.systemAppend,
    systemAppendFile: systemAppendFileContents,
    modelId: resolvedModel
  });
  await chatCommand({
    model: resolvedModel,
    budgetUsd: opts.budgetUsd,
    failureThreshold: opts.failureThreshold,
    system: codeRebuildSystem(),
    rebuildSystem: codeRebuildSystem,
    transcript: opts.transcript,
    session,
    seedTools: tools,
    codeMode: {
      rootDir,
      jobs,
      reregisterTools: registerRooted,
      reBootstrapSemantic
    },
    mcp: readConfig().mcp,
    forceResume: opts.forceResume,
    forceNew: opts.forceNew,
    noDashboard: opts.noDashboard,
    openDashboard: opts.openDashboard,
    dashboardPort: opts.dashboardPort,
    altScreen: opts.altScreen,
    mouse: opts.mouse
  });
}
export {
  codeCommand
};
//# sourceMappingURL=code-SMKEW6CD.js.map