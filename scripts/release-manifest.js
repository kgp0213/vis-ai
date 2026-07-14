#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const defaultRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const binaryName = "visionox-whale.exe";

function normalize(path) {
  return path.replaceAll("\\", "/");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function describeFile(root, path) {
  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new Error(`release artifact is missing: ${path}`);
  }
  return {
    path: normalize(relative(root, path)),
    bytes: statSync(path).size,
    sha256: sha256(path),
  };
}

function measureDirectory(path) {
  let files = 0;
  let bytes = 0;
  function walk(current) {
    for (const name of readdirSync(current).sort()) {
      const child = join(current, name);
      const stat = statSync(child);
      if (stat.isDirectory()) walk(child);
      else {
        files++;
        bytes += stat.size;
      }
    }
  }
  walk(path);
  return { files, bytes };
}

function readBuildStamp(releaseResources) {
  const cliDir = join(releaseResources, "server", "visionox-pkg", "dist", "cli");
  const candidates = readdirSync(cliDir)
    .filter((name) => /^server-.+\.js$/i.test(name))
    .sort();
  for (const name of candidates) {
    const source = readFileSync(join(cliDir, name), "utf8");
    const match = /buildDate:\s*"(\d{6} \d{2})"/.exec(source);
    if (match) return match[1];
  }
  throw new Error("release runtime is missing a valid YYMMDD HH build stamp");
}

function runGit(root, args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error || result.status !== 0) return null;
  return result.stdout.trim();
}

function readGitState(root) {
  const commit = runGit(root, ["rev-parse", "HEAD"]);
  if (!commit) {
    return { available: false, commit: null, branch: null, dirty: null };
  }
  return {
    available: true,
    commit,
    branch: runGit(root, ["branch", "--show-current"]) || "DETACHED",
    dirty: Boolean(runGit(root, ["status", "--porcelain=v1", "--untracked-files=normal"])),
  };
}

function readRuntimeArtifacts(root, releaseResources) {
  const manifest = readJson(join(releaseResources, "runtime-manifest.json"));
  return manifest.artifacts.map((artifact) => {
    const actual = describeFile(root, join(releaseResources, artifact.path));
    if (actual.bytes !== artifact.bytes || actual.sha256 !== artifact.sha256) {
      throw new Error(`release runtime differs from runtime-manifest.json: ${artifact.path}`);
    }
    return {
      path: normalize(artifact.path),
      version: artifact.version,
      bytes: actual.bytes,
      sha256: actual.sha256,
    };
  });
}

export function writeReleaseManifest(options = {}) {
  const root = resolve(options.root ?? defaultRoot);
  const releaseDir = join(root, "src-tauri", "target", "release");
  const releaseResources = join(releaseDir, "resources");
  const packageJson = readJson(join(root, "package.json"));
  const tauri = readJson(join(root, "src-tauri", "tauri.conf.json"));
  if (packageJson.version !== tauri.version) {
    throw new Error(`product version mismatch: package=${packageJson.version}, tauri=${tauri.version}`);
  }
  if (!existsSync(releaseResources) || !statSync(releaseResources).isDirectory()) {
    throw new Error(`release resource directory is missing: ${releaseResources}`);
  }
  if (options.nsisVerified && !options.includeNsis) {
    throw new Error("nsisVerified requires includeNsis");
  }

  const installerPath = join(
    releaseDir,
    "bundle",
    "nsis",
    `${tauri.productName}_${packageJson.version}_x64-setup.exe`,
  );
  const manifest = {
    schemaVersion: 1,
    product: {
      name: tauri.productName,
      version: packageJson.version,
      binaryName,
    },
    generatedAt: (options.now ?? new Date()).toISOString(),
    build: {
      stamp: readBuildStamp(releaseResources),
      platform: process.platform,
      arch: process.arch,
      git: readGitState(root),
    },
    verification: {
      releaseResources: Boolean(options.releaseVerified),
      nsisBundle: Boolean(options.nsisVerified),
    },
    artifacts: {
      executable: describeFile(root, join(releaseDir, binaryName)),
      resources: {
        path: normalize(relative(root, releaseResources)),
        ...measureDirectory(releaseResources),
      },
      runtimes: readRuntimeArtifacts(root, releaseResources),
      installer: options.includeNsis ? describeFile(root, installerPath) : null,
    },
  };

  mkdirSync(releaseDir, { recursive: true });
  const manifestPath = join(releaseDir, "release-manifest.json");
  const temporaryPath = `${manifestPath}.tmp`;
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    rmSync(manifestPath, { force: true });
    renameSync(temporaryPath, manifestPath);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
  console.log(`[release-manifest] wrote ${manifestPath}`);
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = new Set(process.argv.slice(2));
    writeReleaseManifest({
      releaseVerified: args.has("--release-verified"),
      includeNsis: args.has("--include-nsis"),
      nsisVerified: args.has("--nsis-verified"),
    });
  } catch (error) {
    process.exitCode = 1;
    console.error(`[release-manifest] ${error?.message || error}`);
  }
}
