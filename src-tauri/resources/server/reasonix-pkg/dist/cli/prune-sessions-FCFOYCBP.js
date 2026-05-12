#!/usr/bin/env node
import {
  listSessions,
  pruneStaleSessions
} from "./chunk-6CXT5JRM.js";

// src/cli/commands/prune-sessions.ts
function pruneSessionsCommand(opts) {
  const days = opts.days ?? 90;
  if (!Number.isFinite(days) || days < 1) {
    console.error(`--days must be a positive integer (got ${days}).`);
    process.exit(1);
  }
  if (opts.dryRun) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1e3;
    const stale = listSessions().filter((s) => s.mtime.getTime() < cutoff);
    if (stale.length === 0) {
      console.log(`no sessions idle \u2265${days} days. Nothing would be pruned.`);
      return;
    }
    console.log(`would prune ${stale.length} session(s) idle \u2265${days} days:`);
    for (const s of stale) {
      console.log(`  ${s.name}`);
    }
    console.log("");
    console.log("re-run without --dry-run to actually delete.");
    return;
  }
  const removed = pruneStaleSessions(days);
  if (removed.length === 0) {
    console.log(`no sessions idle \u2265${days} days. Nothing pruned.`);
    return;
  }
  console.log(`pruned ${removed.length} session(s) idle \u2265${days} days:`);
  for (const name of removed) {
    console.log(`  ${name}`);
  }
}
export {
  pruneSessionsCommand
};
//# sourceMappingURL=prune-sessions-FCFOYCBP.js.map