#!/usr/bin/env node

// src/cli/startup-profile.ts
import { performance } from "perf_hooks";
var marks = [];
var dumped = false;
function envFlag() {
  const v = process.env.REASONIX_PROFILE_STARTUP;
  return v === "1" || v === "true" || v === "yes";
}
function markPhase(name) {
  if (!envFlag()) return;
  marks.push({ name, t: performance.now() });
}
function dumpStartupProfile(stream = process.stderr) {
  if (!envFlag() || dumped || marks.length === 0) return;
  dumped = true;
  const totalMs = marks[marks.length - 1].t;
  const widest = String(Math.round(totalMs)).length;
  const lines = ["[startup-profile]"];
  let prev = 0;
  for (const m of marks) {
    const cum = Math.round(m.t).toString().padStart(widest);
    const delta = Math.round(m.t - prev);
    lines.push(`  ${cum}ms  ${m.name.padEnd(28)}  (+${delta})`);
    prev = m.t;
  }
  lines.push(
    `\u2500\u2500\u2500 ${Math.round(totalMs)}ms total \xB7 last phase ${marks[marks.length - 1].name} \xB7 set REASONIX_PROFILE_STARTUP=0 to silence`
  );
  stream.write(`${lines.join("\n")}
`);
}

export {
  markPhase,
  dumpStartupProfile
};
//# sourceMappingURL=chunk-CPOV2O73.js.map