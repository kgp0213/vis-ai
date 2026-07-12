import { existsSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";

const LEGACY_BACKUP_RE = /^(.*)\.bak-[^.]+$/;

export function pruneLegacyBootstrapSkillBackups(skillsRoot) {
  if (!existsSync(skillsRoot)) return [];
  const removed = [];
  for (const entry of readdirSync(skillsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const match = LEGACY_BACKUP_RE.exec(entry.name);
    if (!match) continue;

    const skillName = match[1];
    const backupDir = resolve(skillsRoot, entry.name);
    const activeDir = resolve(skillsRoot, skillName);
    const markerPath = resolve(backupDir, "_visionox_builtin.json");
    if (!existsSync(activeDir) || !statSync(activeDir).isDirectory() || !existsSync(markerPath)) continue;

    try {
      const marker = JSON.parse(readFileSync(markerPath, "utf8"));
      if (marker?.owner !== "visionox-bootstrap" || marker?.name !== skillName) continue;
      rmSync(backupDir, { recursive: true, force: true });
      removed.push(backupDir);
    } catch {
      // Invalid or unreadable markers are not proof of Visionox ownership.
    }
  }
  return removed;
}
