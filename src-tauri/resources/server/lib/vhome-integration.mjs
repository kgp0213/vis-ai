import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_CACHE_TTL_MS = 60_000;
const DEFAULT_LOGIN_TIMEOUT_MS = 15 * 60_000;
const DEFAULT_LOGIN_HINT_TIMEOUT_MS = 30_000;
const DEFAULT_LOGIN_CONFIRM_ATTEMPTS = 30;
const DEFAULT_LOGIN_CONFIRM_INTERVAL_MS = 1_000;
const MAX_OUTPUT_BYTES = 1024 * 1024;
const MAX_LOGIN_OUTPUT_CHARS = 64 * 1024;
const MAX_PUBLIC_LOGIN_DETAIL_CHARS = 240;

function parseJsonObject(output) {
  const text = String(output ?? "").replace(/^\uFEFF/, "").trim();
  if (!text) throw new Error("empty JSON output");
  const value = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("expected a JSON object");
  return value;
}

function safeLabel(value, maxLength = 80) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function stripAnsi(value) {
  return String(value ?? "").replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "");
}

function appendOutputTail(current, chunk) {
  return `${current}${String(chunk ?? "")}`.slice(-MAX_LOGIN_OUTPUT_CHARS);
}

function safePublicLoginDetail(output, error) {
  const text = stripAnsi(`${output ?? ""}\n${error?.message ?? ""}`)
    .replace(/https?:\/\/\S+/gi, "[授权链接已隐藏]")
    .replace(/([?&](?:user_?code|device_?code)=)[^&\s]+/gi, "$1[已隐藏]")
    .replace(/\b((?:access|refresh|id)[_-]?token)\s*[:=]\s*\S+/gi, "$1=[已隐藏]")
    .replace(/\b(?:bearer\s+)?[A-Za-z0-9_+/=-]{48,}\b/gi, "[敏感内容已隐藏]");
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/(?:authorization|verification|device|user)[_\s-]*code\s*[:=：]/i.test(line));
  const errorLines = lines.filter((line) => /error|fail|exception|timeout|timed out|refused|denied|unauthor|forbidden|network|proxy|certificate|tls|ssl|错误|失败|超时|拒绝|网络|代理|证书|权限|无法/u.test(line));
  const selected = (errorLines.length > 0 ? errorLines : lines).slice(-2).join(" | ");
  return safeLabel(selected, MAX_PUBLIC_LOGIN_DETAIL_CHARS) || null;
}

function describeLoginFailure(fallbackReason, output = "", error = null) {
  const diagnostic = stripAnsi(`${output}\n${error?.message ?? ""}\n${error?.code ?? ""}`);
  let reason = fallbackReason;
  if (error?.code === "ENOENT") {
    reason = "dws-not-found";
  } else if (/x509|certificate|cert(?:ificate)? chain|unable to verify|self[- ]signed|\bTLS\b|\bSSL\b|证书/u.test(diagnostic)) {
    reason = "login-tls-failed";
  } else if (/ECONNREFUSED|ECONNRESET|ENETUNREACH|EHOSTUNREACH|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|proxyconnect|proxy authentication|socket hang up|no such host|name or service not known|fetch failed|network (?:is )?unreachable|dial tcp|无法连接|连接失败|网络|代理/u.test(diagnostic)) {
    reason = "login-network-failed";
  } else if (/access denied|permission denied|unauthorized|forbidden|status\s*[:=]?\s*(?:401|403)\b|拒绝访问|无权限|权限不足|未授权/u.test(diagnostic)) {
    reason = "login-permission-denied";
  } else if (/unknown (?:command|option)|unrecognized (?:command|argument|option)|invalid (?:command|option)|not supported|unsupported|未知命令|无法识别|不支持/u.test(diagnostic)) {
    reason = "login-command-unsupported";
  }
  const messages = {
    "dws-not-found": "未找到 V来家登录组件，请重新安装或修复 Visionox-Whale。",
    "login-start-failed": "无法启动 V来家登录组件，请重启软件后再试。",
    "login-network-failed": "无法连接 V来家授权服务，请检查网络、代理或防火墙后重试。",
    "login-tls-failed": "V来家授权服务的安全连接失败，请检查系统时间、证书或网络代理。",
    "login-permission-denied": "V来家授权服务拒绝了当前请求，请确认账号权限或联系管理员。",
    "login-command-unsupported": "当前 DWS 登录命令不受支持，请更新或重新安装 Visionox-Whale。",
    "login-timeout": "登录等待已超时，请确认网络正常后重新获取授权链接。",
    "login-link-unavailable": "DWS 已启动，但没有返回授权链接。请检查网络或代理后重试。",
    "authentication-required": "尚未检测到授权完成，请确认浏览器中的授权已成功后重试。",
    "identity-unavailable": "授权可能已完成，但暂时无法获取当前用户信息，请稍后刷新。",
    "communication-failed": "授权进程已结束，但无法确认 V来家连接状态，请检查网络后重试。",
    "login-failed": "V来家登录组件执行失败，请根据下方诊断信息重试。",
  };
  return {
    reason,
    message: messages[reason] ?? messages["login-failed"],
    detail: safePublicLoginDetail(output, error),
  };
}

function normalizeUserCode(value) {
  return safeLabel(value, 64).match(/[A-Z0-9][A-Z0-9-]{3,63}/i)?.[0] ?? null;
}

function cleanLoginUrl(value) {
  return String(value ?? "").replace(/[\])}>.,;，。；、）】》]+$/u, "").slice(0, 1024);
}

function userCodeFromUrl(value) {
  try {
    const parsed = new URL(value);
    for (const [key, candidate] of parsed.searchParams) {
      if (key.toLowerCase().replace(/[\s-]+/g, "_") === "user_code") return normalizeUserCode(candidate);
    }
  } catch {
    return null;
  }
  return null;
}

function loginHints(output, timestamp) {
  const text = stripAnsi(output);
  const urls = (text.match(/https:\/\/login\.dingtalk\.com\/[^\s│<>"']+/gi) ?? []).map(cleanLoginUrl).filter(Boolean);
  let loginUrl = urls.find((url) => userCodeFromUrl(url)) ?? urls[0] ?? null;
  const codeMatch = text.match(/(?:authorization\s+code|verification\s+code|device\s+code|user[_\s-]*code|授权码|用户(?:代码|码)|设备码)\s*[:=：]\s*([A-Z0-9][A-Z0-9-]{3,63})/iu);
  const userCode = normalizeUserCode(codeMatch?.[1]) ?? userCodeFromUrl(loginUrl);
  if (!loginUrl && userCode) {
    loginUrl = `https://login.dingtalk.com/oauth2/device/verify.htm?user_code=${encodeURIComponent(userCode)}`;
  } else if (loginUrl && userCode && !userCodeFromUrl(loginUrl)) {
    const parsed = new URL(loginUrl);
    parsed.searchParams.set("user_code", userCode);
    loginUrl = parsed.toString();
  }
  const expiresMatch = text.match(/expires?\s+in\s+(\d{1,5})\s+seconds?/i);
  const localizedExpiresMatch = text.match(/(\d{1,5})\s*秒(?:钟)?(?:后)?(?:过期|失效)/u);
  const expiresInSeconds = Number(expiresMatch?.[1] ?? localizedExpiresMatch?.[1]);
  return {
    loginUrl,
    userCode,
    expiresAt: Number.isFinite(expiresInSeconds) && expiresInSeconds > 0 ? new Date(timestamp + expiresInSeconds * 1000).toISOString() : null,
  };
}

async function executeDws(executable, args, timeoutMs) {
  const result = await execFileAsync(executable, args, {
    encoding: "utf8",
    windowsHide: true,
    timeout: timeoutMs,
    maxBuffer: MAX_OUTPUT_BYTES,
    env: process.env,
  });
  return result.stdout;
}

function unavailable(reason, checkedAt, available = false, authenticated = false) {
  return { available, connected: false, authenticated, userName: null, corpName: null, reason, checkedAt };
}

function initialLoginState() {
  return { state: "idle", loginUrl: null, userCode: null, expiresAt: null, reason: null };
}

export function createVHomeIntegration(options = {}) {
  const executable = options.executable;
  const execute = options.execute ?? executeDws;
  const spawnProcess = options.spawnProcess ?? spawn;
  const executableExists = options.executableExists ?? existsSync;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const loginTimeoutMs = options.loginTimeoutMs ?? DEFAULT_LOGIN_TIMEOUT_MS;
  const loginHintTimeoutMs = options.loginHintTimeoutMs ?? DEFAULT_LOGIN_HINT_TIMEOUT_MS;
  const loginConfirmAttempts = options.loginConfirmAttempts ?? DEFAULT_LOGIN_CONFIRM_ATTEMPTS;
  const loginConfirmIntervalMs = options.loginConfirmIntervalMs ?? DEFAULT_LOGIN_CONFIRM_INTERVAL_MS;
  const sleep = options.sleep ?? ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
  const now = options.now ?? Date.now;
  const setTimer = options.setTimer ?? setTimeout;
  const clearTimer = options.clearTimer ?? clearTimeout;
  const logger = options.logger ?? null;
  let cached = null;
  let expiresAt = 0;
  let inFlight = null;
  let lastProbeFailure = null;
  let currentProfileId = null;
  let loginState = initialLoginState();
  let loginProcess = null;
  let loginTimer = null;
  let loginHintTimer = null;
  let loginOutput = "";
  let loginStdout = "";
  let loginStderr = "";
  let loginRevision = 0;

  function log(message) {
    logger?.error?.(`[vhome] ${message}`);
  }

  function loginOutputSnapshot() {
    return { combined: loginOutput, stdout: loginStdout, stderr: loginStderr };
  }

  function logRawLoginOutput(snapshot, context) {
    if (snapshot.stdout) log(`${context} stdout (raw, tail):\n${snapshot.stdout}`);
    if (snapshot.stderr) log(`${context} stderr (raw, tail):\n${snapshot.stderr}`);
    if (!snapshot.stdout && !snapshot.stderr) log(`${context} output (raw): <empty>`);
  }

  function publicStatus(status) {
    return { ...status, login: { ...loginState } };
  }

  function setLoginState(next) {
    loginState = { ...initialLoginState(), ...next };
  }

  function invalidateStatus() {
    cached = null;
    expiresAt = 0;
  }

  async function probe() {
    const checkedAt = new Date(now()).toISOString();
    lastProbeFailure = null;
    if (!executable || !executableExists(executable)) return unavailable("dws-not-found", checkedAt);
    try {
      const auth = parseJsonObject(await execute(executable, ["auth", "status", "--format", "json"], timeoutMs));
      const renewable = auth.token_valid === true || auth.refresh_token_valid === true;
      if (auth.success !== true || auth.authenticated !== true || !renewable) {
        currentProfileId = null;
        return unavailable("authentication-required", checkedAt, true, false);
      }

      currentProfileId = safeLabel(auth.corp_id, 128) || null;
      const self = parseJsonObject(await execute(executable, ["contact", "user", "get-self", "--format", "json"], timeoutMs));
      const employee = Array.isArray(self.result) ? self.result[0]?.orgEmployeeModel : null;
      const userName = safeLabel(employee?.orgUserName ?? auth.user_name);
      const corpName = safeLabel(employee?.orgName ?? auth.corp_name);
      if (self.success !== true || !userName) return unavailable("identity-unavailable", checkedAt, true, true);
      return { available: true, connected: true, authenticated: true, userName, corpName: corpName || null, reason: null, checkedAt };
    } catch (error) {
      const reason = error?.killed || error?.signal ? "timeout" : error?.code === "ENOENT" ? "dws-not-found" : "communication-failed";
      log(`status probe failed: reason=${reason}, executable=${JSON.stringify(executable)}, error=${JSON.stringify(error?.message ?? String(error))}`);
      const stdout = String(error?.stdout ?? "");
      const stderr = String(error?.stderr ?? "");
      lastProbeFailure = { output: `${stdout}\n${stderr}`.trim(), error };
      if (stdout) log(`status probe stdout (raw, tail):\n${stdout.slice(-MAX_LOGIN_OUTPUT_CHARS)}`);
      if (stderr) log(`status probe stderr (raw, tail):\n${stderr.slice(-MAX_LOGIN_OUTPUT_CHARS)}`);
      return unavailable(reason, checkedAt, reason !== "dws-not-found", false);
    }
  }

  async function getCoreStatus({ force = false } = {}) {
    const timestamp = now();
    if (!force && cached && timestamp < expiresAt) return cached;
    if (inFlight) return inFlight;
    inFlight = probe().then((status) => {
      cached = Object.freeze(status);
      expiresAt = now() + cacheTtlMs;
      return cached;
    }).finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  async function getStatus(options = {}) {
    return publicStatus(await getCoreStatus(options));
  }

  function updateLoginHints(source, chunk) {
    const value = String(chunk ?? "");
    loginOutput = appendOutputTail(loginOutput, value);
    if (source === "stdout") loginStdout = appendOutputTail(loginStdout, value);
    else loginStderr = appendOutputTail(loginStderr, value);
    const hints = loginHints(loginOutput, now());
    if (!hints.loginUrl && !hints.userCode) return;
    if (loginHintTimer) clearTimer(loginHintTimer);
    loginHintTimer = null;
    setLoginState({
      state: "awaiting-user",
      loginUrl: hints.loginUrl ?? loginState.loginUrl,
      userCode: hints.userCode ?? loginState.userCode,
      expiresAt: hints.expiresAt ?? loginState.expiresAt,
    });
  }

  function clearLoginProcess(child) {
    if (loginProcess !== child) return false;
    loginProcess = null;
    if (loginTimer) clearTimer(loginTimer);
    loginTimer = null;
    if (loginHintTimer) clearTimer(loginHintTimer);
    loginHintTimer = null;
    loginOutput = "";
    loginStdout = "";
    loginStderr = "";
    return true;
  }

  function failLogin(fallbackReason, snapshot = loginOutputSnapshot(), error = null) {
    const failure = describeLoginFailure(fallbackReason, snapshot.combined, error);
    log(`login failed: reason=${failure.reason}, fallbackReason=${fallbackReason}, detail=${JSON.stringify(failure.detail)}, error=${JSON.stringify(error?.message ?? null)}`);
    logRawLoginOutput(snapshot, "login failure");
    setLoginState({ state: "failed", ...failure });
  }

  async function confirmLogin(revision, processOutput = "") {
    let lastStatus = null;
    for (let attempt = 0; attempt < loginConfirmAttempts; attempt++) {
      if (revision !== loginRevision) return;
      invalidateStatus();
      lastStatus = await getCoreStatus({ force: true });
      if (revision !== loginRevision) return;
      if (lastStatus.connected) {
        setLoginState({ state: "idle" });
        return;
      }
      if (attempt + 1 < loginConfirmAttempts) await sleep(loginConfirmIntervalMs);
    }
    if (revision === loginRevision) {
      const probeOutput = lastProbeFailure?.output ?? "";
      const combined = [processOutput, probeOutput].filter(Boolean).join("\n");
      failLogin(lastStatus?.reason ?? "identity-unavailable", { combined, stdout: "", stderr: probeOutput }, lastProbeFailure?.error ?? null);
    }
  }

  async function startLogin() {
    log(`login requested: executable=${JSON.stringify(executable ?? null)}`);
    const status = await getCoreStatus({ force: true });
    if (status.connected || loginProcess) return publicStatus(status);
    if (!executable || !executableExists(executable)) {
      failLogin("dws-not-found", { combined: "", stdout: "", stderr: "" });
      return publicStatus(status);
    }

    const revision = ++loginRevision;
    setLoginState({ state: "starting" });
    let child;
    try {
      log(`login process starting: executable=${JSON.stringify(executable)}, args=${JSON.stringify(["auth", "login", "--device", "--recommend"])}`);
      child = spawnProcess(executable, ["auth", "login", "--device", "--recommend"], {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      });
    } catch (error) {
      failLogin("login-start-failed", { combined: "", stdout: "", stderr: "" }, error);
      return publicStatus(status);
    }

    loginProcess = child;
    loginOutput = "";
    loginStdout = "";
    loginStderr = "";
    child.stdout?.on?.("data", (chunk) => updateLoginHints("stdout", chunk));
    child.stderr?.on?.("data", (chunk) => updateLoginHints("stderr", chunk));
    child.once?.("error", (error) => {
      const snapshot = loginOutputSnapshot();
      if (!clearLoginProcess(child)) return;
      if (revision !== loginRevision) return;
      failLogin("login-start-failed", snapshot, error);
    });
    child.once?.("close", (code, signal) => {
      const snapshot = loginOutputSnapshot();
      log(`login process closed: exitCode=${code ?? "null"}, signal=${signal ?? "none"}, loginOutputChars=${snapshot.combined.length}`);
      log(`login process loginOutput (raw, tail):\n${snapshot.combined || "<empty>"}`);
      if (!clearLoginProcess(child)) return;
      if (revision !== loginRevision) return;
      if (loginState.state === "cancelled") return;
      if (code !== 0) {
        failLogin("login-failed", snapshot);
        return;
      }
      setLoginState({ state: "completing" });
      void confirmLogin(revision, snapshot.combined);
    });
    loginTimer = setTimer(() => {
      if (loginProcess !== child) return;
      const snapshot = loginOutputSnapshot();
      loginRevision++;
      clearLoginProcess(child);
      failLogin("login-timeout", snapshot);
      child.kill?.();
    }, loginTimeoutMs);
    loginTimer?.unref?.();
    loginHintTimer = setTimer(() => {
      if (loginProcess !== child || revision !== loginRevision || loginState.state !== "starting") return;
      const snapshot = loginOutputSnapshot();
      loginRevision++;
      clearLoginProcess(child);
      failLogin("login-link-unavailable", snapshot);
      child.kill?.();
    }, loginHintTimeoutMs);
    loginHintTimer?.unref?.();
    return publicStatus(status);
  }

  async function cancelLogin() {
    loginRevision++;
    const child = loginProcess;
    if (child) {
      log("login cancelled by user");
      setLoginState({ state: "cancelled" });
      clearLoginProcess(child);
      child.kill?.();
    } else {
      setLoginState({ state: "idle" });
    }
    return getStatus();
  }

  async function logout() {
    await cancelLogin();
    const status = await getCoreStatus({ force: true });
    if (!status.authenticated) return publicStatus(status);
    const args = ["auth", "logout"];
    if (currentProfileId) args.push("--profile", currentProfileId);
    args.push("--yes", "--format", "json");
    parseJsonObject(await execute(executable, args, timeoutMs));
    currentProfileId = null;
    setLoginState({ state: "idle" });
    invalidateStatus();
    return getStatus({ force: true });
  }

  return { getStatus, startLogin, cancelLogin, logout };
}
