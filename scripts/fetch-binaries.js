#!/usr/bin/env node
/**
 * Fetch platform-appropriate runtime binaries that are excluded from git
 * via .gitignore (too large for the repo):
 *
 *   - node.exe / node          (Node.js runtime for the launcher)
 *   - officecli.exe            (Windows-only Office MCP tool)
 *
 * Usage:
 *   node scripts/fetch-binaries.js           # auto-detect platform
 *   node scripts/fetch-binaries.js --force   # re-download even if present
 *
 * After cloning the repo on a fresh machine, run this once before
 * `npx tauri dev` / `npx tauri build` so the bundled server can start.
 *
 * On Linux, node is expected from the system (apt/pacman/nvm); this script
 * only fetches officecli.exe on Windows. See README "Ubuntu 构建" section.
 */
import { createWriteStream, existsSync, statSync, renameSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { arch, platform } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = resolve(__dirname, "..", "src-tauri", "resources", "server");
const FORCE = process.argv.includes("--force");

// ── Node.js ──────────────────────────────────────────────────────
// The bundled node.exe is v25.2.1 (as of 2026-07). We pin to a known-good
// LTS-adjacent version; adjust NODE_VERSION when upgrading.
const NODE_VERSION = "v25.2.1";

function nodeAssetName() {
  const p = platform();
  const a = arch();
  // Map process.arch to Node's download naming
  const archMap = { x64: "x64", arm64: "arm64" };
  const nodeArch = archMap[a] || "x64";
  if (p === "win32") return `node-${NODE_VERSION}-win-${nodeArch}`;
  if (p === "darwin") return `node-${NODE_VERSION}-darwin-${nodeArch}`;
  if (p === "linux") return `node-${NODE_VERSION}-linux-${nodeArch}`;
  return null; // unsupported — rely on system node
}

async function downloadFile(url, dest) {
  // Use fetch (Node 18+) to stream the download to a temp file, then rename.
  const tmp = `${dest}.tmp`;
  console.log(`  ↓ ${url}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  const writer = createWriteStream(tmp);
  const reader = res.body.getReader();
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    writer.write(value);
    total += value.length;
    if (total % (10 * 1024 * 1024) < value.length) {
      process.stdout.write(`\r  ${(total / 1e6).toFixed(1)} MB`);
    }
  }
  writer.end();
  await new Promise((r) => writer.on("finish", r));
  renameSync(tmp, dest);
  console.log(`\r  ✓ ${(total / 1e6).toFixed(1)} MB → ${dest}`);
}

async function fetchNode() {
  // On Linux, rely on system node (lib.rs falls back to PATH "node").
  if (platform() === "linux") {
    const r = spawnSync("node", ["--version"], { encoding: "utf8" });
    if (r.status === 0) {
      console.log(`✓ node: using system ${r.stdout.trim()} (Linux)`);
      return;
    }
    console.error("✗ node not found in PATH. Install Node.js ≥ 22 (e.g. `sudo apt install nodejs`).");
    process.exit(1);
  }

  const asset = nodeAssetName();
  if (!asset) {
    console.error(`✗ Unsupported platform: ${platform()}/${arch()}`);
    process.exit(1);
  }

  const ext = platform() === "win32" ? "zip" : "tar.gz";
  const url = `https://nodejs.org/dist/${NODE_VERSION}/${asset}.${ext}`;
  // For Windows we extract node.exe from the zip; for simplicity we download
  // the archive and extract just the node binary.
  const nodeExeName = platform() === "win32" ? "node.exe" : "node";
  const destPath = join(SERVER_DIR, nodeExeName);

  if (existsSync(destPath) && !FORCE) {
    const size = (statSync(destPath).size / 1e6).toFixed(1);
    console.log(`✓ ${nodeExeName} already present (${size} MB) — use --force to re-fetch`);
    return;
  }

  console.log(`Fetching Node.js ${NODE_VERSION} for ${asset}...`);
  const archivePath = join(SERVER_DIR, `${asset}.${ext}`);
  await downloadFile(url, archivePath);

  // Extract the node binary from the archive.
  if (platform() === "win32") {
    // PowerShell Expand-Archive, then copy node.exe out
    const extractDir = join(SERVER_DIR, asset);
    spawnSync("powershell.exe", [
      "-NoProfile", "-Command",
      `Expand-Archive -Force -Path '${archivePath}' -DestinationPath '${extractDir}'`,
    ], { stdio: "inherit" });
    const extracted = join(extractDir, nodeExeName);
    if (existsSync(extracted)) {
      renameSync(extracted, destPath);
    }
    // Cleanup archive + extracted dir
    const { rmSync } = await import("node:fs");
    rmSync(archivePath, { force: true });
    rmSync(extractDir, { recursive: true, force: true });
  } else {
    // tar -xzf, extract bin/node
    spawnSync("tar", ["-xzf", archivePath, "-C", SERVER_DIR]);
    const extracted = join(SERVER_DIR, asset, "bin", "node");
    if (existsSync(extracted)) {
      renameSync(extracted, destPath);
    }
    const { rmSync } = await import("node:fs");
    rmSync(archivePath, { force: true });
    rmSync(join(SERVER_DIR, asset), { recursive: true, force: true });
  }

  if (existsSync(destPath)) {
    const size = (statSync(destPath).size / 1e6).toFixed(1);
    console.log(`✓ ${nodeExeName} ${NODE_VERSION} installed (${size} MB)`);
  } else {
    console.error(`✗ Failed to extract ${nodeExeName} from archive`);
    process.exit(1);
  }
}

// ── officecli.exe (Windows only) ─────────────────────────────────
async function fetchOfficecli() {
  if (platform() !== "win32") {
    console.log("✓ officecli.exe: skipped (Windows-only, not needed on this platform)");
    return;
  }

  const destPath = join(SERVER_DIR, "officecli.exe");
  if (existsSync(destPath) && !FORCE) {
    const size = (statSync(destPath).size / 1e6).toFixed(1);
    console.log(`✓ officecli.exe already present (${size} MB) — use --force to re-fetch`);
    return;
  }

  // officecli.exe is a vendored binary with no public download URL.
  // If you have it from a previous install, copy it manually:
  //   copy "%LOCALAPPDATA%\Visionox\resources\server\officecli.exe" src-tauri\resources\server\
  console.error("⚠ officecli.exe is a vendored binary with no public download source.");
  console.error("  To obtain it, either:");
  console.error("  1. Copy from an existing Visionox install:");
  console.error('     copy "%LOCALAPPDATA%\\Visionox\\resources\\server\\officecli.exe" src-tauri\\resources\\server\\');
  console.error("  2. Download from your internal release artifacts.");
  console.error("  The app will run without it — Office document features will be disabled.");
}

// ── Main ─────────────────────────────────────────────────────────
console.log(`fetch-binaries: platform=${platform()}/${arch()}, force=${FORCE}\n`);
try {
  await fetchNode();
  await fetchOfficecli();
  console.log("\n✓ All binaries ready. You can now run `npx tauri dev` or `npx tauri build`.");
} catch (err) {
  console.error(`\n✗ ${err.message}`);
  process.exit(1);
}
