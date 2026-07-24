import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { TOKEN, type ApiError, api } from "./api.js";

export interface PollResult<T> {
  data: T | null;
  error: ApiError | Error | null;
  loading: boolean;
  refresh: () => Promise<T | undefined>;
  replaceData: (next: T) => T;
}

export function usePoll<T = unknown>(path: string, intervalMs = 2000, sseKind: string | null = null): PollResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const requestRevision = useRef(0);

  const refresh = useCallback(async () => {
    const revision = ++requestRevision.current;
    try {
      const next = await api<T>(path);
      if (revision === requestRevision.current) {
        setData(next);
        setError(null);
      }
      return next;
    } catch (err) {
      if (revision === requestRevision.current) setError(err as Error);
    } finally {
      if (revision === requestRevision.current) setLoading(false);
    }
  }, [path]);

  const replaceData = useCallback((next: T) => {
    requestRevision.current += 1;
    setData(next);
    setError(null);
    setLoading(false);
    return next;
  }, []);

  useEffect(() => {
    if (sseKind) {
      setLoading(false);
      const unsubscribe = subscribeSse(sseKind, (event) => {
        const { kind: _kind, ...rest } = event;
        requestRevision.current += 1;
        setData(rest as T);
        setError(null);
      });
      return () => {
        requestRevision.current += 1;
        unsubscribe();
      };
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      if (cancelled) return;
      await refresh();
      if (cancelled) return;
      timer = setTimeout(tick, intervalMs);
    };
    tick();
    return () => {
      cancelled = true;
      requestRevision.current += 1;
      if (timer) clearTimeout(timer);
    };
  }, [refresh, intervalMs, sseKind]);

  return { data, error, loading, refresh, replaceData };
}

type SseEvent = Record<string, unknown> & { kind?: string };
type SseHandler = (event: SseEvent) => void;
type SseStatusHandler = (status: { connected: boolean; reconnected: boolean }) => void;

let sseSource: EventSource | null = null;
const sseListeners = new Map<string, SseHandler[]>();
const sseStatusListeners: SseStatusHandler[] = [];
let sseChannelsKey = "";
let sseOpened = false;

function activeSseChannels(): string[] {
  const channels = new Set<string>();
  for (const [kind, listeners] of sseListeners) {
    if (!listeners.length) continue;
    if (["overview", "health", "logs"].includes(kind)) channels.add(kind);
    else channels.add("events");
  }
  return [...channels].sort();
}

function rebuildSharedSse(): void {
  const channels = activeSseChannels();
  const key = channels.join(",");
  if (key === sseChannelsKey && sseSource) return;
  sseSource?.close();
  sseSource = null;
  sseChannelsKey = key;
  if (!key) return;
  const url = new URL("/api/events", window.location.origin);
  url.searchParams.set("token", TOKEN);
  url.searchParams.set("channels", key);
  const source = new EventSource(url.toString());
  sseSource = source;
  source.onopen = () => {
    const reconnected = sseOpened;
    sseOpened = true;
    for (const handler of [...sseStatusListeners]) handler({ connected: true, reconnected });
  };
  source.onerror = () => {
    for (const handler of [...sseStatusListeners]) handler({ connected: false, reconnected: false });
  };
  source.onmessage = (event) => {
    try {
      const value = JSON.parse(event.data) as SseEvent;
      const handlers = [...(sseListeners.get(value.kind ?? "") ?? []), ...(sseListeners.get("*") ?? [])];
      for (const handler of handlers) handler(value);
    } catch {
      // Ignore malformed individual SSE records and keep the connection alive.
    }
  };
}

export function subscribeSse(kind: string, handler: SseHandler): () => void {
  if (!sseListeners.has(kind)) sseListeners.set(kind, []);
  sseListeners.get(kind)!.push(handler);
  rebuildSharedSse();
  return () => {
    const listeners = sseListeners.get(kind) ?? [];
    const index = listeners.indexOf(handler);
    if (index >= 0) listeners.splice(index, 1);
    if (listeners.length === 0) sseListeners.delete(kind);
    rebuildSharedSse();
  };
}

export function subscribeSseStatus(handler: SseStatusHandler): () => void {
  sseStatusListeners.push(handler);
  return () => {
    const index = sseStatusListeners.indexOf(handler);
    if (index >= 0) sseStatusListeners.splice(index, 1);
  };
}
