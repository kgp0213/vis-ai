import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const SUPPORTED_BROWSERS = new Set(["default", "edge"]);

export function normalizeExternalUrl(value) {
  const url = new URL(String(value ?? "").trim());
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("only HTTP and HTTPS links can be opened");
  return url.toString();
}

function edgeCandidates(env) {
  return [env.PROGRAMFILES, env["PROGRAMFILES(X86)"], env.LOCALAPPDATA]
    .filter(Boolean)
    .map((root) => join(root, "Microsoft", "Edge", "Application", "msedge.exe"));
}

function launch(spawnProcess, command, args) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawnProcess(command, args, { detached: true, stdio: "ignore", windowsHide: true });
    } catch (error) {
      reject(error);
      return;
    }
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref?.();
      resolve();
    });
  });
}

export function createExternalUrlOpener(options = {}) {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const fileExists = options.fileExists ?? existsSync;
  const spawnProcess = options.spawnProcess ?? spawn;

  return async function openExternalUrl(rawUrl, openOptions = {}) {
    const url = normalizeExternalUrl(rawUrl);
    const browser = String(openOptions.browser ?? "default").trim().toLowerCase();
    if (!SUPPORTED_BROWSERS.has(browser)) throw new Error(`unsupported browser: ${browser}`);

    if (browser === "edge") {
      if (platform !== "win32") throw new Error("Microsoft Edge fallback is available only on Windows");
      const executable = edgeCandidates(env).find(fileExists);
      if (!executable) throw new Error("Microsoft Edge was not found");
      await launch(spawnProcess, executable, [url]);
      return { opened: true, browser };
    }

    if (platform === "win32") await launch(spawnProcess, "rundll32.exe", ["url.dll,FileProtocolHandler", url]);
    else if (platform === "darwin") await launch(spawnProcess, "open", [url]);
    else await launch(spawnProcess, "xdg-open", [url]);
    return { opened: true, browser };
  };
}
