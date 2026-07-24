import htm from "htm";
import { h } from "preact";
import { useEffect, useState } from "preact/hooks";
import { isThirdPartyError } from "./bus-filter.js";

const html = htm.bind(h);

export const appBus = new EventTarget();
export const toastBus = new EventTarget();

export type ToastKind = "info" | "success" | "warn" | "error";

export function showToast(text: string, kind: ToastKind = "info", ttl = 3000): void {
  toastBus.dispatchEvent(new CustomEvent("toast", { detail: { text, kind, ttl } }));
}

export function requestChatMessageJump(messageId: string): void {
  if (!messageId) return;
  try {
    (window as Window & { __visionoxPendingChatJump?: { messageId: string; ts: number } })
      .__visionoxPendingChatJump = { messageId, ts: Date.now() };
  } catch {
    // The event bus remains available when the host blocks window properties.
  }
  appBus.dispatchEvent(new CustomEvent("navigate-tab", { detail: { tabId: "chat", messageId } }));
  setTimeout(() => {
    appBus.dispatchEvent(new CustomEvent("chat-jump-message", { detail: { messageId } }));
  }, 80);
}

export interface ErrorReport {
  error: unknown;
  source: string;
  info?: string;
  ts: number;
}

export function reportAppError(error: unknown, source: string, info?: string): void {
  console.error(`[visionox dashboard] ${source}:`, error, info);
  try {
    const value = error as { message?: string; stack?: string } | null;
    const message = `${source}: ${value?.message ?? String(error)}\n${value?.stack ?? ""}\n${info ?? ""}`
      .slice(0, 12_000);
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "vis_client_log", message }, "*");
    }
  } catch {
    // Error reporting must not recursively fail the Dashboard.
  }
  appBus.dispatchEvent(
    new CustomEvent("error", { detail: { error, source, info, ts: Date.now() } }),
  );
}

window.addEventListener("error", (ev) => {
  if (!ev.error) return;
  if (isThirdPartyError(ev.error, ev.filename)) return;
  reportAppError(ev.error, "window", ev.message);
});

window.addEventListener("unhandledrejection", (ev) => {
  if (isThirdPartyError(ev.reason)) return;
  reportAppError(ev.reason, "promise");
});

interface Toast {
  id: string;
  text: string;
  kind: ToastKind;
  ttl: number;
}

export function ToastStack() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    const onToast = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as Omit<Toast, "id">;
      const id = `${Date.now()}-${Math.random()}`;
      const t: Toast = { id, ...detail };
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), t.ttl);
    };
    toastBus.addEventListener("toast", onToast);
    return () => toastBus.removeEventListener("toast", onToast);
  }, []);
  if (toasts.length === 0) return null;
  return html`
    <div class="toast-stack">
      ${toasts.map((t) => html`<div key=${t.id} class="toast ${t.kind}">${t.text}</div>`)}
    </div>
  `;
}
