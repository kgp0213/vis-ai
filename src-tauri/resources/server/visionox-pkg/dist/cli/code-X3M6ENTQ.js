#!/usr/bin/env node
import {
  buildCodeToolset
} from "./chunk-AT6GGIBV.js";
import "./chunk-RAUPWSYA.js";
import {
  chatCommand
} from "./chunk-F2AV2QDK.js";
import "./chunk-LN27AKV3.js";
import "./chunk-Y5XNV3NX.js";
import "./chunk-SXLJBFIV.js";
import "./chunk-A7VHMMDE.js";
import "./chunk-LTXADNCO.js";
import "./chunk-BOFL3T45.js";
import {
  markPhase
} from "./chunk-CPOV2O73.js";
import "./chunk-IEA6JOIP.js";
import "./chunk-VFG4GIT3.js";
import "./chunk-7SPOFTMT.js";
import "./chunk-CFY2XLY6.js";
import "./chunk-ARF3N2SY.js";
import "./chunk-4W2CICFQ.js";
import "./chunk-UV7XJUJH.js";
import "./chunk-E46ECXJD.js";
import "./chunk-KZYLMMU5.js";
import "./chunk-AFFZF3MW.js";
import "./chunk-DAEAAVDF.js";
import "./chunk-H4OLWRSX.js";
import {
  loadDotenv
} from "./chunk-3Q3C4W66.js";
import "./chunk-4DCHFFEY.js";
import "./chunk-WJ3YX4PZ.js";
import "./chunk-A3LL4XDV.js";
import "./chunk-SOZE7V7V.js";
import "./chunk-7VFNPMKG.js";
import "./chunk-BYZGO3BX.js";
import {
  detectForeignAgentPlatform
} from "./chunk-CD4SCQL4.js";
import "./chunk-FM57FNPJ.js";
import "./chunk-2CXPDAWX.js";
import "./chunk-4H3ZRJ2U.js";
import "./chunk-WE3YZULK.js";
import "./chunk-5X7LZJDE.js";
import {
  sanitizeName
} from "./chunk-YJFKFTAL.js";
import {
  t
} from "./chunk-MHGPBJ2T.js";
import {
  loadApiKey,
  readConfig
} from "./chunk-65Q5HQ26.js";
import "./chunk-ZTLZO42A.js";
import "./chunk-ORM6PK57.js";
import "./chunk-CRPQUBP6.js";

// src/cli/commands/code.tsx
import { readFileSync } from "fs";
import { basename, resolve } from "path";
async function codeCommand(opts = {}) {
  markPhase("code_command_enter");
  loadDotenv();
  const cfgKey = loadApiKey();
  if (cfgKey && !process.env.DEEPSEEK_API_KEY) {
    process.env.DEEPSEEK_API_KEY = cfgKey;
  }
  const { codeSystemPrompt } = await import("./prompt-RSIHN62V.js");
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
    process.stderr.write(
      `\u26A0 workspace contains another agent platform's files (${foreign.join(", ")}). Reasonix Code may read them as project content; relaunch with --dir <your-project> if that's not what you want.
`
    );
  }
  process.once("exit", () => {
    void jobs.shutdown();
  });
  let systemAppendFileContents;
  if (opts.systemAppend !== void 0 && opts.systemAppend.trim().length === 0) {
    process.stderr.write("--system-append is empty \u2014 no prompt text will be appended\n");
  }
  if (opts.systemAppendFile) {
    const filePath = resolve(opts.systemAppendFile);
    try {
      systemAppendFileContents = readFileSync(filePath, "utf8");
    } catch (err) {
      const e = err;
      process.stderr.write(
        `Error: cannot read --system-append-file "${filePath}": ${e.code ? `[${e.code}] ` : ""}${e.message}
`
      );
      process.exit(1);
    }
  }
  const codeRebuildSystem = () => codeSystemPrompt(rootDir, {
    hasSemanticSearch: semantic.enabled,
    systemAppend: opts.systemAppend,
    systemAppendFile: systemAppendFileContents,
    modelId: opts.model ?? "deepseek-v4-flash"
  });
  await chatCommand({
    model: opts.model ?? "deepseek-v4-flash",
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
    dashboardPort: opts.dashboardPort,
    altScreen: opts.altScreen,
    mouse: opts.mouse
  });
}
export {
  codeCommand
};
//# sourceMappingURL=code-X3M6ENTQ.js.map