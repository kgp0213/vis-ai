export const TOKEN: string =
  document.querySelector('meta[name="reasonix-token"]')?.getAttribute("content") ?? "";

export const MODE: "standalone" | "attached" =
  (document.querySelector('meta[name="reasonix-mode"]')?.getAttribute("content") as
    | "standalone"
    | "attached"
    | null) ?? "standalone";

export interface ApiOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface ApiError extends Error {
  status: number;
  body: unknown;
}

export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const method = opts.method ?? "GET";
  const url = `/api${path}${path.includes("?") ? "&" : "?"}token=${TOKEN}`;
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  headers["X-Reasonix-Token"] = TOKEN;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const timeoutMs = opts.timeoutMs === 0
    ? 0
    : Math.max(1000, Number(opts.timeoutMs ?? (method === "GET" ? 15_000 : 120_000)));
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort();
  opts.signal?.addEventListener?.("abort", abortFromCaller, { once: true });
  const timeout = timeoutMs > 0 ? setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs) : null;
  let res: Response;
  let text: string;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
    text = await res.text();
  } catch (error) {
    if (timedOut) throw new Error(`请求超时（${Math.round(timeoutMs / 1000)} 秒）：${path}`);
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
    opts.signal?.removeEventListener?.("abort", abortFromCaller);
  }
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { error: text };
  }
  if (!res.ok) {
    const errMsg =
      (parsed as { error?: string } | null)?.error ?? `${res.status} ${res.statusText}`;
    const err = new Error(errMsg) as ApiError;
    err.status = res.status;
    err.body = parsed;
    throw err;
  }
  return parsed as T;
}

export async function writeClipboardText(text: unknown): Promise<void> {
  const value = String(text ?? "");
  let primaryError: unknown = null;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch (error) {
      primaryError = error;
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  Object.assign(textarea.style, {
    position: "fixed",
    left: "-9999px",
    top: "0",
    width: "1px",
    height: "1px",
    opacity: "0",
  });
  document.body.appendChild(textarea);
  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, value.length);
    if (document.execCommand("copy")) return;
    throw primaryError || new Error("copy command failed");
  } finally {
    textarea.remove();
  }
}
