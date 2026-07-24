#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = join(root, "src-tauri", "resources", "server", "visionox-pkg");
const dashboardRoot = join(packageRoot, "dashboard");
const esbuildPath = join(packageRoot, "node_modules", "esbuild", "lib", "main.js");

function readOutdir(args) {
  const index = args.indexOf("--outdir");
  if (index === -1) return dashboardRoot;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error("--outdir requires a path");
  return resolve(value);
}

export async function buildDashboard({ outdir = dashboardRoot } = {}) {
  if (!existsSync(esbuildPath)) throw new Error(`offline esbuild is missing: ${esbuildPath}`);
  const module = await import(pathToFileURL(esbuildPath).href);
  const esbuild = module.default ?? module;
  const jsOutput = join(outdir, "dist", "app.js");
  const cssOutput = join(outdir, "app.css");
  mkdirSync(dirname(jsOutput), { recursive: true });
  mkdirSync(dirname(cssOutput), { recursive: true });

  await esbuild.build({
    absWorkingDir: packageRoot,
    entryPoints: ["dashboard/src/app.ts"],
    bundle: true,
    charset: "utf8",
    format: "esm",
    logLevel: "silent",
    outfile: jsOutput,
    platform: "browser",
    sourcemap: false,
    target: ["es2020"],
    treeShaking: false,
  });
  rmSync(`${jsOutput}.map`, { force: true });
  copyFileSync(join(dashboardRoot, "src", "app.css"), cssOutput);
  return {
    appJs: readFileSync(jsOutput),
    appCss: readFileSync(cssOutput),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildDashboard({ outdir: readOutdir(process.argv.slice(2)) });
}
