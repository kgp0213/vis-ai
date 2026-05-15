#!/usr/bin/env node

// src/net/proxy.ts
import { ProxyAgent, setGlobalDispatcher } from "undici";
var PROXY_ENV_KEYS = [
  "HTTPS_PROXY",
  "https_proxy",
  "HTTP_PROXY",
  "http_proxy",
  "ALL_PROXY",
  "all_proxy"
];
function detectProxyUrl(env = process.env) {
  for (const key of PROXY_ENV_KEYS) {
    const raw = env[key];
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (trimmed) return trimmed;
  }
  return null;
}
var installed = false;
function installProxyIfConfigured(env = process.env) {
  const url = detectProxyUrl(env);
  if (!url) return null;
  const reinstalled = installed;
  setGlobalDispatcher(new ProxyAgent(url));
  installed = true;
  return { url, reinstalled };
}

export {
  detectProxyUrl,
  installProxyIfConfigured
};
//# sourceMappingURL=chunk-AFFZF3MW.js.map