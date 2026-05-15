#!/usr/bin/env node
import {
  SseTransport,
  StdioTransport,
  StreamableHttpTransport
} from "./chunk-CFY2XLY6.js";

// src/mcp/transport-from-spec.ts
function buildTransportFromSpec(spec, opts = {}) {
  if (spec.transport === "sse") return new SseTransport({ url: spec.url });
  if (spec.transport === "streamable-http") return new StreamableHttpTransport({ url: spec.url });
  return new StdioTransport({ command: spec.command, args: spec.args, env: opts.env });
}

// src/mcp/preflight.ts
import { statSync } from "fs";
var FILESYSTEM_PKG = "@modelcontextprotocol/server-filesystem";
function preflightStdioSpec(spec) {
  const pkgIndex = spec.args.indexOf(FILESYSTEM_PKG);
  if (pkgIndex < 0) return;
  const positional = spec.args.slice(pkgIndex + 1).filter((a) => !a.startsWith("-"));
  for (const dir of positional) {
    let stat;
    try {
      stat = statSync(dir);
    } catch {
      throw new Error(
        `MCP filesystem sandbox '${dir}' does not exist \u2014 create it with: mkdir -p '${dir}'`
      );
    }
    if (!stat.isDirectory()) {
      throw new Error(`MCP filesystem sandbox '${dir}' exists but is not a directory`);
    }
  }
}

export {
  buildTransportFromSpec,
  preflightStdioSpec
};
//# sourceMappingURL=chunk-BOFL3T45.js.map