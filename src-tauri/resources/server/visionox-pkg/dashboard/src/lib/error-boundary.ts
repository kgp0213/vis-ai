import htm from "htm";
import { Component, type ComponentChildren, h } from "preact";
import { useEffect, useState } from "preact/hooks";
import { MODE, writeClipboardText } from "./api.js";
import { type ErrorReport, appBus, reportAppError } from "./bus.js";
import { t as t4 } from "../i18n/index.js";

const html = htm.bind(h);

function buildIssueBody({ error, source, info }: ErrorReport): string {
  const ua = typeof navigator === "object" ? navigator.userAgent : "(unknown)";
  const errMsg = (error as Error)?.message ?? String(error);
  const stack = (error as Error)?.stack ?? "(no stack)";
  return [
    "**What happened**",
    "(describe what you were doing — typing, switching tabs, clicking a tool path, etc.)",
    "",
    "**Error**",
    "```",
    `${source}: ${errMsg}`,
    info ? `info: ${info}` : null,
    "",
    stack,
    "```",
    "",
    "**Environment**",
    `- Visionox-Whale: ${MODE}`,
    `- Browser: ${ua}`,
    `- URL: ${location.pathname} (token redacted)`,
    "",
    "_Reported from the local dashboard's error overlay._",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

export function ErrorOverlay() {
  const [err, setErr] = useState<ErrorReport | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onError = (ev: Event) => {
      setErr((ev as CustomEvent).detail as ErrorReport);
      setCopied(false);
    };
    appBus.addEventListener("error", onError);
    return () => appBus.removeEventListener("error", onError);
  }, []);

  useEffect(() => {
    if (!err) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setErr(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [err]);

  if (!err) return null;
  const error = err.error as Error | undefined;
  const errMsg = error?.message ?? String(error);
  const stack = error?.stack ?? "(no stack)";

  const copyDetails = async () => {
    try {
      await writeClipboardText(buildIssueBody(err));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The runtime log still contains the same error when clipboard access is blocked.
    }
  };

  const openLogs = () => {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "vis_open_log_dir" }, "*");
      }
    } catch {
      // The host bridge may be unavailable in standalone browser mode.
    }
  };

  return html`
    <div class="error-overlay">
      <div class="error-overlay-card">
        <div class="error-overlay-head">
          <span class="error-overlay-icon">✦</span>
          <div>
            <div class="error-overlay-title">${t4("errOverlay.title")}</div>
            <div class="error-overlay-subtitle">${err.source} · ${errMsg}</div>
          </div>
        </div>

        <pre class="error-overlay-trace">${stack}</pre>

        ${
          err.info
            ? html`<div class="error-overlay-info"><strong>info:</strong> ${err.info}</div>`
            : null
        }

        <div class="error-overlay-help">
          ${t4("errOverlay.help")}
        </div>

        <div class="error-overlay-actions">
          <button class="primary" onClick=${copyDetails}>
            ${copied ? t4("errOverlay.copied") : t4("errOverlay.copyDetails")}
          </button>
          <button onClick=${openLogs}>${t4("errOverlay.openLogs")}</button>
          <button onClick=${() => setErr(null)} style="margin-left: auto;">${t4("errOverlay.closeEsc")}</button>
        </div>
      </div>
    </div>
  `;
}

interface ErrorBoundaryProps {
  children: ComponentChildren;
}

interface ErrorBoundaryState {
  caught: boolean;
  lastErr: Error | null;
  attempts: number;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { caught: false, lastErr: null, attempts: 0 };
  }
  static override getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { caught: true, lastErr: error };
  }
  override componentDidCatch(error: Error, info: { componentStack?: string }) {
    reportAppError(error, "render", info?.componentStack ?? "");
    const attempts = (this.state.attempts ?? 0) + 1;
    if (attempts >= 3) {
      this.setState({ attempts });
      return;
    }
    setTimeout(() => this.setState({ caught: false, attempts }), 100);
  }
  override render() {
    if (this.state.caught) {
      if ((this.state.attempts ?? 0) >= 3) {
        return html`
          <div class="boot" style="flex-direction: column; gap: 12px;">
            <div>${t4("errOverlay.recoverFailed")}</div>
            <button onClick=${() => this.setState({ caught: false, attempts: 0 })}>
              ${t4("errOverlay.retry")}
            </button>
          </div>
        `;
      }
      return html`<div class="boot">${t4("errOverlay.recovering")}</div>`;
    }
    return this.props.children;
  }
}
