export {};

declare global {
  interface Window {
    __TAURI__?: {
      core?: { invoke?: (command: string, args?: unknown) => Promise<unknown> };
      event?: { listen?: (event: string, handler: (event: unknown) => void) => Promise<() => void> };
    };
    __visionoxLastOpenedDocumentArgs?: unknown;
    __visionoxPendingChatJump?: { messageId: string; ts: number };
  }
}
