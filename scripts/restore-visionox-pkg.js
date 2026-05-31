// restore-visionox-pkg.js
// Downloads the reasonix npm package and extracts it to the bundled resources
// directory. Run this when setting up a fresh clone or updating the reasonix version.
//
// Usage: node scripts/restore-visionox-pkg.js [version]
//   version — reasonix version (default: "260530")

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, cpSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const target = join(root, "src-tauri", "resources", "server", "visionox-pkg");
const version = process.argv[2] || "260530";
const pkgName = "reasonix";

// Check if dist/ already exists — if so, skip unless --force
if (existsSync(join(target, "dist")) && !process.argv.includes("--force")) {
  console.log(`[restore] visionox-pkg/dist already exists. Use --force to overwrite.`);
  process.exit(0);
}

console.log(`[restore] Downloading ${pkgName}@${version}...`);

const tmpDir = join(root, "node_modules", ".tmp-visionox-pkg");
rmSync(tmpDir, { recursive: true, force: true });
mkdirSync(tmpDir, { recursive: true });

try {
  execSync(`npm pack ${pkgName}@${version} --pack-destination "${tmpDir}"`, {
    cwd: root,
    stdio: "inherit",
  });

  // Find the tarball
  const tarball = join(tmpDir, `${pkgName}-${version}.tgz`);
  if (!existsSync(tarball)) {
    console.error(`[restore] ERROR: tarball not found at ${tarball}`);
    process.exit(1);
  }

  // Extract — Windows 10 1803+ has tar.exe built-in
  execSync(`tar -xzf "${tarball}" -C "${tmpDir}"`, { stdio: "inherit" });

  const extracted = join(tmpDir, "package");
  if (!existsSync(extracted)) {
    console.error("[restore] ERROR: extracted package/ not found");
    process.exit(1);
  }

  // Remove old visionox-pkg
  rmSync(target, { recursive: true, force: true });
  mkdirSync(dirname(target), { recursive: true });

  // Copy extracted package to target
  cpSync(extracted, target, { recursive: true });

  // Install production dependencies
  console.log("[restore] Installing production dependencies...");
  execSync("npm install --production --no-audit --no-fund", {
    cwd: target,
    stdio: "inherit",
  });

  console.log(`[restore] Done — ${pkgName}@${version} restored to ${target}`);
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
