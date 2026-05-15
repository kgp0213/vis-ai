#!/usr/bin/env node
import {
  useColor
} from "./chunk-UV7XJUJH.js";

// src/cli/ui/keystroke-context.tsx
import { useInput } from "ink";
import React, { createContext, useContext, useEffect, useRef } from "react";

// src/cli/ui/stdin-reader.ts
import { stdin } from "process";
var ESC_TIMEOUT_MS = 250;
var PASTE_START = "\x1B[200~";
var PASTE_END = "\x1B[201~";
var PASTE_START_BARE = "[200~";
var PASTE_END_BARE = "[201~";
var CSI_TAIL_MAP = [
  { tail: "A", ev: { input: "", upArrow: true } },
  { tail: "B", ev: { input: "", downArrow: true } },
  { tail: "C", ev: { input: "", rightArrow: true } },
  { tail: "D", ev: { input: "", leftArrow: true } },
  { tail: "H", ev: { input: "", home: true } },
  { tail: "F", ev: { input: "", end: true } },
  { tail: "1~", ev: { input: "", home: true } },
  { tail: "4~", ev: { input: "", end: true } },
  { tail: "5~", ev: { input: "", pageUp: true } },
  { tail: "6~", ev: { input: "", pageDown: true } },
  { tail: "3~", ev: { input: "", delete: true } },
  { tail: "Z", ev: { input: "", shift: true, tab: true } },
  // Some Windows hosts (PowerShell 7.x conhost path) emit the
  // modifier-encoded back-tab `\x1b[1;2Z` instead of bare `\x1b[Z`.
  // Issue #373 — without this entry Shift+Tab is silently dropped.
  { tail: "1;2Z", ev: { input: "", shift: true, tab: true } },
  // modifyOtherKeys (xterm CSI > 4 ; 2 m) sequences for Enter / Tab
  // with modifiers. Only fired when App.tsx has enabled the mode at
  // startup; otherwise Shift+Enter stays indistinguishable from Enter.
  // Modifier encoding: 2=shift, 3=alt, 4=alt+shift, 5=ctrl,
  // 6=ctrl+shift, 7=ctrl+alt, 8=ctrl+alt+shift. Keycodes: 9=Tab, 13=Enter.
  { tail: "27;2;9~", ev: { input: "", tab: true, shift: true } },
  { tail: "27;2;13~", ev: { input: "", return: true, shift: true } },
  { tail: "27;5;13~", ev: { input: "", return: true, ctrl: true } },
  { tail: "27;6;13~", ev: { input: "", return: true, ctrl: true, shift: true } },
  // Kitty keyboard protocol — same idea, different envelope:
  // `\x1b[<keycode>;<mod>u`. Some terminals (kitty, recent Windows
  // Terminal previews) prefer this shape. Harmless to map here too.
  { tail: "9;2u", ev: { input: "", tab: true, shift: true } },
  { tail: "13;2u", ev: { input: "", return: true, shift: true } },
  { tail: "13;5u", ev: { input: "", return: true, ctrl: true } },
  { tail: "13;6u", ev: { input: "", return: true, ctrl: true, shift: true } }
];
var SS3_MAP = {
  A: { input: "", upArrow: true },
  B: { input: "", downArrow: true },
  C: { input: "", rightArrow: true },
  D: { input: "", leftArrow: true },
  H: { input: "", home: true },
  F: { input: "", end: true }
};
function tryEscapelessCsi(chunk, i) {
  if (chunk[i] !== "[") return null;
  for (const entry of CSI_TAIL_MAP) {
    const candidate = `[${entry.tail}`;
    if (chunk.slice(i, i + candidate.length) === candidate) {
      return { advance: candidate.length, ev: entry.ev };
    }
  }
  return null;
}
function isCsiFinal(ch) {
  const code = ch.charCodeAt(0);
  return code >= 64 && code <= 126;
}
function lookupCsi(tail) {
  for (const entry of CSI_TAIL_MAP) {
    if (entry.tail === tail) return entry.ev;
  }
  return null;
}
function decodeModifiedKey(cp, mod) {
  if (mod < 1 || mod > 8) return null;
  const bits = mod - 1;
  const shift = (bits & 1) !== 0;
  const alt = (bits & 2) !== 0;
  const ctrl = (bits & 4) !== 0;
  if (cp >= 32 && cp <= 126 && !ctrl && !alt) {
    const ev = { input: String.fromCharCode(cp) };
    if (shift) ev.shift = true;
    return ev;
  }
  if (cp >= 32 && cp <= 126 && alt && !ctrl) {
    const ev = { input: String.fromCharCode(cp), meta: true };
    if (shift) ev.shift = true;
    return ev;
  }
  if (cp >= 65 && cp <= 122 && ctrl && !alt) {
    const ev = { input: String.fromCharCode(cp).toLowerCase(), ctrl: true };
    if (shift) ev.shift = true;
    return ev;
  }
  return null;
}
function tryDecodeGenericCsi(seq) {
  let m = /^27;(\d+);(\d+)~$/.exec(seq);
  if (m) return decodeModifiedKey(Number.parseInt(m[2], 10), Number.parseInt(m[1], 10));
  m = /^(\d+);(\d+)u$/.exec(seq);
  if (m) return decodeModifiedKey(Number.parseInt(m[1], 10), Number.parseInt(m[2], 10));
  m = /^(\d+)u$/.exec(seq);
  if (m) return decodeModifiedKey(Number.parseInt(m[1], 10), 1);
  return null;
}
function looksLikeUnbracketedPaste(chunk) {
  if (chunk.length < 2) return false;
  if (chunk.includes(PASTE_START) || chunk.includes(PASTE_START_BARE)) return false;
  if (chunk.includes(PASTE_END) || chunk.includes(PASTE_END_BARE)) return false;
  if (chunk.includes("\x1B")) return false;
  const norm = chunk.replace(/\r\n/g, "\n");
  if (norm === "\r" || norm === "\n") return false;
  let breaks = 0;
  let firstBreakIdx = -1;
  for (let i = 0; i < norm.length; i++) {
    const c = norm[i];
    if (c === "\r" || c === "\n") {
      if (firstBreakIdx < 0) firstBreakIdx = i;
      breaks++;
    }
  }
  if (breaks >= 2) return true;
  if (breaks === 1) return firstBreakIdx > 0 && firstBreakIdx < norm.length - 1;
  return false;
}
var StdinReader = class {
  subscribers = /* @__PURE__ */ new Set();
  state = "idle";
  /** Buffer for partial sequences across chunks. */
  csiBuf = "";
  /** Buffer for paste content. */
  pasteBuf = "";
  escTimer = null;
  // Deferred-dispatch handle paired with `escTimer`. The timer
  // queues an Immediate that runs in the event loop's CHECK phase —
  // i.e. AFTER the POLL phase where stdin 'data' events fire — so
  // a multi-byte sequence whose chunks queued up while the loop was
  // blocked (heavy render, etc.) gets a chance to be processed
  // BEFORE we emit a bogus standalone-Esc. Fixes the "I didn't press
  // Esc but it aborted the turn" class of bug: previously the timer's
  // setTimeout callback ran in the timers phase ahead of poll, so a
  // split sequence like `\x1b` + `[A` would dispatch escape+upArrow
  // even though the user only pressed Up.
  escImmediate = null;
  started = false;
  /** The actual `data` listener — kept as a field so `stop()` can detach it. */
  listener = null;
  start() {
    if (this.started) return;
    try {
      stdin.setRawMode(true);
    } catch {
      return;
    }
    stdin.setEncoding("utf8");
    stdin.resume();
    this.listener = (chunk) => this.handleChunk(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
    stdin.on("data", this.listener);
    this.started = true;
  }
  stop() {
    if (!this.started) return;
    if (this.listener) {
      stdin.off("data", this.listener);
      this.listener = null;
    }
    try {
      stdin.setRawMode(false);
    } catch {
    }
    stdin.pause();
    this.cancelEscTimer();
    this.state = "idle";
    this.csiBuf = "";
    this.pasteBuf = "";
    this.started = false;
  }
  subscribe(fn) {
    this.subscribers.add(fn);
    return () => {
      this.subscribers.delete(fn);
    };
  }
  /** Test seam — drives the parser without a real TTY. */
  feed(chunk) {
    this.handleChunk(chunk);
  }
  dispatch(ev) {
    for (const sub of this.subscribers) sub(ev);
  }
  cancelEscTimer() {
    if (this.escTimer) {
      clearTimeout(this.escTimer);
      this.escTimer = null;
    }
    if (this.escImmediate) {
      clearImmediate(this.escImmediate);
      this.escImmediate = null;
    }
  }
  scheduleEscTimer() {
    this.cancelEscTimer();
    this.escTimer = setTimeout(() => {
      this.escTimer = null;
      this.escImmediate = setImmediate(() => {
        this.escImmediate = null;
        if (this.state === "esc") {
          this.state = "idle";
          this.dispatch({ input: "", escape: true });
        }
      });
    }, ESC_TIMEOUT_MS);
  }
  handleChunk(rawChunk) {
    this.cancelEscTimer();
    const chunk = this.state === "idle" && looksLikeUnbracketedPaste(rawChunk) ? PASTE_START + rawChunk + PASTE_END : rawChunk;
    let i = 0;
    while (i < chunk.length) {
      if (this.state === "paste") {
        const endA = chunk.indexOf(PASTE_END, i);
        const endB = chunk.indexOf(PASTE_END_BARE, i);
        let endIdx = -1;
        let endLen = 0;
        if (endA !== -1 && (endB === -1 || endA <= endB)) {
          endIdx = endA;
          endLen = PASTE_END.length;
        } else if (endB !== -1) {
          endIdx = endB;
          endLen = PASTE_END_BARE.length;
        }
        if (endIdx === -1) {
          this.pasteBuf += chunk.slice(i);
          i = chunk.length;
          break;
        }
        this.pasteBuf += chunk.slice(i, endIdx);
        this.dispatch({ input: this.pasteBuf, paste: true });
        this.pasteBuf = "";
        this.state = "idle";
        i = endIdx + endLen;
        continue;
      }
      if (this.state === "csi") {
        const ch2 = chunk[i];
        this.csiBuf += ch2;
        if (isCsiFinal(ch2)) {
          this.dispatchCsi(this.csiBuf);
          this.csiBuf = "";
          if (this.state === "csi") this.state = "idle";
        }
        i++;
        continue;
      }
      if (this.state === "ss3") {
        const ev = SS3_MAP[chunk[i]];
        if (ev) this.dispatch(ev);
        this.state = "idle";
        i++;
        continue;
      }
      if (this.state === "esc") {
        const ch2 = chunk[i];
        if (ch2 === "[") {
          this.state = "csi";
          this.csiBuf = "";
          i++;
          continue;
        }
        if (ch2 === "O") {
          this.state = "ss3";
          i++;
          continue;
        }
        if (ch2 === "\r" || ch2 === "\n") {
          this.dispatch({ input: "", return: true, meta: true });
          this.state = "idle";
          i++;
          continue;
        }
        this.dispatch({ input: ch2, meta: true });
        this.state = "idle";
        i++;
        continue;
      }
      const ch = chunk[i];
      if (ch === "\x1B") {
        this.state = "esc";
        i++;
        continue;
      }
      if (chunk.slice(i, i + PASTE_START_BARE.length) === PASTE_START_BARE) {
        this.state = "paste";
        this.pasteBuf = "";
        i += PASTE_START_BARE.length;
        continue;
      }
      const escapeless = tryEscapelessCsi(chunk, i);
      if (escapeless) {
        this.dispatch(escapeless.ev);
        i += escapeless.advance;
        continue;
      }
      if (ch === "\r") {
        this.dispatch({ input: "", return: true });
        i++;
        continue;
      }
      if (ch === "\n") {
        this.dispatch({ input: "j", ctrl: true });
        i++;
        continue;
      }
      if (ch === "	") {
        this.dispatch({ input: "", tab: true });
        i++;
        continue;
      }
      if (ch === "\x7F" || ch === "\b") {
        this.dispatch({ input: "", backspace: true });
        i++;
        continue;
      }
      if (ch === "") {
        this.dispatch({ input: "c", ctrl: true });
        i++;
        continue;
      }
      const code = ch.charCodeAt(0);
      if (code >= 1 && code <= 26) {
        const letter = String.fromCharCode(96 + code);
        this.dispatch({ input: letter, ctrl: true });
        i++;
        continue;
      }
      let end = i + 1;
      while (end < chunk.length) {
        const c = chunk[end];
        if (c === "\x1B" || c === "\r" || c === "\n" || c === "	") break;
        if (c === "\x7F" || c === "\b" || c === "") break;
        const cc = c.charCodeAt(0);
        if (cc >= 1 && cc <= 26) break;
        if (c === "[" && tryEscapelessCsi(chunk, end)) break;
        if (chunk.slice(end, end + PASTE_START_BARE.length) === PASTE_START_BARE) break;
        end++;
      }
      this.dispatch({ input: chunk.slice(i, end) });
      i = end;
    }
    if (this.state === "esc") {
      this.scheduleEscTimer();
    }
  }
  dispatchCsi(seq) {
    if (seq === "200~") {
      this.state = "paste";
      this.pasteBuf = "";
      return;
    }
    if (seq === "201~") {
      return;
    }
    if (seq.length > 1 && seq.charCodeAt(0) === 60) {
      const tail = seq[seq.length - 1];
      if (tail === "M" || tail === "m") {
        const body = seq.slice(1, -1);
        const parts = body.split(";");
        if (parts.length === 3) {
          const btn = Number.parseInt(parts[0], 10);
          const col = Number.parseInt(parts[1], 10);
          const row = Number.parseInt(parts[2], 10);
          if (Number.isFinite(btn) && Number.isFinite(col) && Number.isFinite(row)) {
            if (tail === "M" && btn === 64) {
              this.dispatch({ input: "", mouseScrollUp: true, mouseRow: row, mouseCol: col });
              return;
            }
            if (tail === "M" && btn === 65) {
              this.dispatch({ input: "", mouseScrollDown: true, mouseRow: row, mouseCol: col });
              return;
            }
            if (tail === "M" && btn === 0) {
              this.dispatch({ input: "", mouseClick: true, mouseRow: row, mouseCol: col });
              return;
            }
            if (tail === "M" && btn === 32) {
              this.dispatch({ input: "", mouseDrag: true, mouseRow: row, mouseCol: col });
              return;
            }
            if (tail === "m") {
              this.dispatch({ input: "", mouseRelease: true, mouseRow: row, mouseCol: col });
              return;
            }
            return;
          }
        }
      }
    }
    const ev = lookupCsi(seq);
    if (ev) {
      this.dispatch(ev);
      return;
    }
    const generic = tryDecodeGenericCsi(seq);
    if (generic) {
      this.dispatch(generic);
      return;
    }
  }
};
var singleton = null;
function getStdinReader() {
  if (!singleton) singleton = new StdinReader();
  return singleton;
}

// src/cli/ui/keystroke-context.tsx
var KeystrokeContext = createContext(null);
function KeystrokeProvider({
  children,
  reader: providedReader
}) {
  const handlersRef = useRef(/* @__PURE__ */ new Set());
  const busRef = useRef(null);
  if (busRef.current === null) {
    busRef.current = {
      subscribe(handler) {
        handlersRef.current.add(handler);
        return () => {
          handlersRef.current.delete(handler);
        };
      }
    };
  }
  useEffect(() => {
    const reader = providedReader ?? getStdinReader();
    reader.start();
    const unsubscribe = reader.subscribe((ev) => {
      for (const fn of [...handlersRef.current]) fn(ev);
    });
    return () => {
      unsubscribe();
    };
  }, [providedReader]);
  return /* @__PURE__ */ React.createElement(KeystrokeContext.Provider, { value: busRef.current }, children);
}
function useKeystroke(handler, isActive = true) {
  const bus = useContext(KeystrokeContext);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    if (!bus || !isActive) return void 0;
    return bus.subscribe((ev) => handlerRef.current(ev));
  }, [bus, isActive]);
  useInput(
    (input, key) => {
      if (bus) return;
      handlerRef.current({
        input,
        upArrow: key.upArrow,
        downArrow: key.downArrow,
        leftArrow: key.leftArrow,
        rightArrow: key.rightArrow,
        return: key.return,
        escape: key.escape,
        backspace: key.backspace,
        delete: key.delete,
        tab: key.tab,
        shift: key.shift,
        ctrl: key.ctrl,
        meta: key.meta,
        pageUp: key.pageUp,
        pageDown: key.pageDown
      });
    },
    { isActive: !bus && isActive }
  );
}

// src/cli/ui/Select.tsx
import { Box, Text } from "ink";
import React2, { useState } from "react";
function SingleSelect({
  items,
  initialValue,
  onSubmit,
  onTab,
  onCancel,
  footer,
  inlineHints = false,
  ignoreKey
}) {
  const color = useColor();
  const initialIndex = Math.max(
    0,
    items.findIndex((i) => i.value === initialValue && !i.disabled)
  );
  const [index, setIndex] = useState(initialIndex === -1 ? 0 : initialIndex);
  useKeystroke((ev) => {
    if (ev.paste || ignoreKey?.(ev)) return;
    if (ev.upArrow) {
      setIndex((i) => findNextEnabled(items, i, -1));
    } else if (ev.downArrow) {
      setIndex((i) => findNextEnabled(items, i, 1));
    } else if (ev.return) {
      const chosen = items[index];
      if (chosen && !chosen.disabled) onSubmit(chosen.value);
    } else if (ev.tab) {
      const chosen = items[index];
      if (chosen && !chosen.disabled) onTab?.(chosen.value);
    } else if (ev.escape && onCancel) {
      onCancel();
    }
  });
  return /* @__PURE__ */ React2.createElement(Box, { flexDirection: "column" }, items.map((item, i) => /* @__PURE__ */ React2.createElement(
    SelectRow,
    {
      key: item.value,
      item,
      active: i === index,
      marker: i === index ? "\u25B8" : " ",
      color,
      inlineHint: inlineHints
    }
  )), footer ? /* @__PURE__ */ React2.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React2.createElement(Text, { dimColor: true }, footer)) : null);
}
function MultiSelect({
  items,
  initialSelected = [],
  onSubmit,
  onCancel,
  footer,
  inlineHints = false,
  ignoreKey
}) {
  const color = useColor();
  const [index, setIndex] = useState(() => {
    const first = items.findIndex((i) => !i.disabled);
    return first === -1 ? 0 : first;
  });
  const [selected, setSelected] = useState(new Set(initialSelected));
  useKeystroke((ev) => {
    if (ev.paste || ignoreKey?.(ev)) return;
    if (ev.upArrow) {
      setIndex((i) => findNextEnabled(items, i, -1));
    } else if (ev.downArrow) {
      setIndex((i) => findNextEnabled(items, i, 1));
    } else if (ev.input === " ") {
      const item = items[index];
      if (!item || item.disabled) return;
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(item.value)) next.delete(item.value);
        else next.add(item.value);
        return next;
      });
    } else if (ev.return) {
      const ordered = items.filter((i) => selected.has(i.value)).map((i) => i.value);
      onSubmit(ordered);
    } else if (ev.escape && onCancel) {
      onCancel();
    }
  });
  return /* @__PURE__ */ React2.createElement(Box, { flexDirection: "column" }, items.map((item, i) => {
    const checked = selected.has(item.value);
    const marker = checked ? "[x]" : "[ ]";
    return /* @__PURE__ */ React2.createElement(
      SelectRow,
      {
        key: item.value,
        item,
        active: i === index,
        marker: `${i === index ? "\u25B8" : " "} ${marker}`,
        color,
        inlineHint: inlineHints
      }
    );
  }), footer ? /* @__PURE__ */ React2.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React2.createElement(Text, { dimColor: true }, footer)) : null);
}
function SelectRow({
  item,
  active,
  marker,
  color,
  inlineHint = false
}) {
  const rowColor = item.disabled ? color.info : active ? color.primary : void 0;
  const labelText = `${marker} ${item.label}`;
  if (inlineHint) {
    return /* @__PURE__ */ React2.createElement(Box, { flexDirection: "row", flexWrap: "nowrap", minHeight: 1 }, /* @__PURE__ */ React2.createElement(Text, { color: rowColor, bold: active, dimColor: item.disabled, wrap: "truncate" }, labelText), item.hint ? /* @__PURE__ */ React2.createElement(Text, { dimColor: true, wrap: "truncate" }, `  ${item.hint}`) : null);
  }
  return /* @__PURE__ */ React2.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React2.createElement(Box, null, /* @__PURE__ */ React2.createElement(Text, { color: rowColor, bold: active, dimColor: item.disabled }, labelText)), item.hint ? /* @__PURE__ */ React2.createElement(Box, { paddingLeft: marker.length + 1 }, /* @__PURE__ */ React2.createElement(Text, { dimColor: true }, item.hint)) : null);
}
function findNextEnabled(items, from, step) {
  if (items.length === 0) return 0;
  let i = from;
  for (let tries = 0; tries < items.length; tries++) {
    i = (i + step + items.length) % items.length;
    if (!items[i]?.disabled) return i;
  }
  return from;
}

export {
  KeystrokeProvider,
  useKeystroke,
  SingleSelect,
  MultiSelect
};
//# sourceMappingURL=chunk-4W2CICFQ.js.map