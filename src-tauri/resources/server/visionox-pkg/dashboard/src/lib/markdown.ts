// Recovered from the product bundle; types are tightened incrementally without changing behavior.
// @ts-nocheck
import hljs from "highlight.js/lib/common";
import { marked } from "marked";
import { TOKEN, api, writeClipboardText } from "./api.js";
import { showToast } from "./bus.js";
import { t as t4 } from "../i18n/index.js";

function escapeHtml(s3) {
  if (s3 == null) return "";
  return String(s3).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
var SEARCH_REPLACE_RE = /<{7}\s*SEARCH\s*\n([\s\S]*?)\n={7}\s*\n([\s\S]*?)\n>{7}\s*REPLACE/;
function renderSearchReplace(search, replace, file) {
  const safeSearch = typeof search === "string" ? search : String(search ?? "");
  const safeReplace = typeof replace === "string" ? replace : String(replace ?? "");
  const oldLines = safeSearch.split("\n").map((l3) => `<span class="diff-line del">- ${escapeHtml(l3)}</span>`).join("\n");
  const newLines = safeReplace.split("\n").map((l3) => `<span class="diff-line ins">+ ${escapeHtml(l3)}</span>`).join("\n");
  const header = file ? `<span class="diff-line hunk">\u25B8 edit ${escapeHtml(file)}</span>
` : "";
  return `<pre class="diff-block">${header}${oldLines}
${newLines}</pre>`;
}
function renderUnifiedDiff(text) {
  const safe = typeof text === "string" ? text : String(text ?? "");
  const lines = safe.split("\n").map((l3) => {
    if (l3.startsWith("+++") || l3.startsWith("---")) {
      return `<span class="diff-line meta">${escapeHtml(l3)}</span>`;
    }
    if (l3.startsWith("+")) return `<span class="diff-line ins">${escapeHtml(l3)}</span>`;
    if (l3.startsWith("-")) return `<span class="diff-line del">${escapeHtml(l3)}</span>`;
    if (l3.startsWith("@@")) return `<span class="diff-line hunk">${escapeHtml(l3)}</span>`;
    return escapeHtml(l3);
  }).join("\n");
  return `<pre class="diff-block">${lines}</pre>`;
}
var renderer = new marked.Renderer();
renderer.html = ({ text }) => escapeHtml(text);
var ARTIFACT_EXT_BY_LANG = {
  markdown: "md",
  md: "md",
  html: "html",
  htm: "html",
  python: "py",
  py: "py",
  javascript: "js",
  js: "js",
  typescript: "ts",
  ts: "ts",
  tsx: "tsx",
  jsx: "jsx",
  css: "css",
  json: "json",
  xml: "xml",
  yaml: "yaml",
  yml: "yml",
  sql: "sql",
  powershell: "ps1",
  ps1: "ps1",
  bat: "bat",
  batch: "bat",
  cmd: "cmd",
  bash: "sh",
  sh: "sh",
  shell: "sh",
  ini: "ini",
  toml: "toml",
  csv: "csv",
  text: "txt",
  txt: "txt"
};
var ARTIFACT_PREVIEW_LANGS = /* @__PURE__ */ new Set(["markdown", "md", "html", "htm"]);
// Markdown artifacts are preview-only; external opening is reserved for an explicit file action.
var ARTIFACT_OPEN_EXTS = /* @__PURE__ */ new Set(["html", "htm", "txt", "json", "xml", "yaml", "yml", "csv", "css", "sql", "ini", "toml"]);
function normalizeArtifactLang(raw) {
  return String(raw || "").trim().split(/\s+/)[0].replace(/^language-/, "").toLowerCase();
}
function knownHighlightLanguage(raw) {
  const lang = String(raw || "").trim();
  if (!lang) return null;
  try {
    return typeof hljs?.getLanguage === "function" && hljs.getLanguage(lang) ? lang : null;
  } catch {
    return null;
  }
}
function artifactDisplayName(content, lang, ext, seq) {
  const text = String(content || "");
  if (lang === "html" || lang === "htm") {
    const title = /<title[^>]*>([^<]{1,80})<\/title>/i.exec(text)?.[1]?.trim();
    if (title) return `${artifactSlug(title)}.${ext}`;
    return `page-${seq}.${ext}`;
  }
  if (lang === "markdown" || lang === "md") {
    const heading = /^#\s+(.{1,80})\s*$/m.exec(text)?.[1]?.trim();
    if (heading) return `${artifactSlug(heading)}.${ext}`;
    return `document-${seq}.${ext}`;
  }
  if (lang === "python" || lang === "py") return `script-${seq}.${ext}`;
  if (lang === "javascript" || lang === "js" || lang === "typescript" || lang === "ts") return `code-${seq}.${ext}`;
  if (lang === "json") return `data-${seq}.${ext}`;
  if (lang === "csv") return `table-${seq}.${ext}`;
  return `artifact-${seq}.${ext}`;
}
function artifactSlug(value) {
  const cleaned = String(value || "").replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "-").replace(/[\x00-\x1f]/g, "").slice(0, 48).replace(/^-+|-+$/g, "");
  return cleaned || "artifact";
}
function registerChatArtifact(content, rawLang) {
  const lang = normalizeArtifactLang(rawLang);
  const ext = ARTIFACT_EXT_BY_LANG[lang];
  if (!ext || !content) return null;
  try {
    window.__visionoxArtifactSeq = (window.__visionoxArtifactSeq || 0) + 1;
    window.__visionoxArtifacts = window.__visionoxArtifacts || {};
    const seq = window.__visionoxArtifactSeq;
    const id = `artifact-${Date.now().toString(36)}-${seq}`;
    const label = ext.toUpperCase();
    const filename = artifactDisplayName(content, lang, ext, seq);
    window.__visionoxArtifacts[id] = {
      id,
      lang,
      ext,
      label,
      filename,
      content,
      previewable: ARTIFACT_PREVIEW_LANGS.has(lang),
      openable: ARTIFACT_OPEN_EXTS.has(ext)
    };
    return window.__visionoxArtifacts[id];
  } catch {
    return null;
  }
}
function renderArtifactFrame(artifact, codeHtml) {
  if (!artifact) return codeHtml;
  const previewBtn = artifact.previewable ? `<button type="button" class="chat-artifact-btn" data-artifact-action="preview">${t4("mdArt.preview")}</button>` : "";
  const openBtn = artifact.openable ? `<button type="button" class="chat-artifact-btn" data-artifact-action="open-file">${t4("mdArt.open")}</button>` : "";
  return `<div class="chat-artifact" data-artifact-id="${escapeHtml(artifact.id)}">
    <div class="chat-artifact-head">
      <div class="chat-artifact-title">
        <span class="chat-artifact-type">${escapeHtml(artifact.label)}</span>
        <span class="chat-artifact-name" title="${escapeHtml(artifact.filename)}">${escapeHtml(artifact.filename)}</span>
        <span class="chat-artifact-status" data-artifact-status>${t4("mdArt.artifactStatus")}</span>
      </div>
      <div class="chat-artifact-actions">
        ${previewBtn}
        ${openBtn}
        <button type="button" class="chat-artifact-btn" data-artifact-action="copy">${t4("mdArt.copy")}</button>
        <button type="button" class="chat-artifact-btn" data-artifact-action="save">${t4("mdArt.saveAs")}</button>
        <button type="button" class="chat-artifact-btn" data-artifact-action="open-folder" disabled>${t4("mdArt.openFolder")}</button>
      </div>
    </div>
    ${codeHtml}
  </div>`;
}
function renderPreviewCodeBlock(content, rawLang) {
  const lang = normalizeArtifactLang(rawLang);
  const hlLang = lang === "html" || lang === "htm" ? "xml" : lang;
  const safeLang = knownHighlightLanguage(hlLang);
  let codeHtml = escapeHtml(content);
  try {
    if (safeLang) {
      codeHtml = hljs.highlight(content, { language: safeLang, ignoreIllegals: true }).value;
    } else if (typeof hljs?.highlightAuto === "function") {
      codeHtml = hljs.highlightAuto(content).value;
    }
  } catch {
    codeHtml = escapeHtml(content);
  }
  const langLabel = lang ? escapeHtml(lang) : t4("mdArt.code");
  const codeClass = safeLang ? ` class="hljs language-${escapeHtml(safeLang)}"` : ' class="hljs"';
  return `<div class="artifact-preview-code">
    <div class="artifact-preview-code-head">
      <span>${langLabel}</span>
      <button type="button" data-preview-code-copy>${t4("mdArt.copy")}</button>
    </div>
    <pre><code${codeClass}>${codeHtml}</code></pre>
  </div>`;
}
renderer.code = function reasonixCode(arg1, arg2) {
  let text;
  let lang;
  if (arg1 && typeof arg1 === "object" && !Array.isArray(arg1)) {
    text = arg1.text;
    lang = arg1.lang;
  } else {
    text = arg1;
    lang = arg2;
  }
  if (text == null) text = "";
  const codeText = typeof text === "string" ? text : String(text);
  if (globalThis.__visionoxMarkdownPreviewMode) return renderPreviewCodeBlock(codeText, lang);
  const sr = SEARCH_REPLACE_RE.exec(codeText);
  if (sr) {
    const [, search = "", replace = ""] = sr;
    const file = typeof lang === "string" && lang.startsWith("edit:") ? lang.slice(5) : "";
    return renderSearchReplace(search, replace, file);
  }
  if (lang === "diff") return renderUnifiedDiff(codeText);
  const artifact = registerChatArtifact(codeText, lang);
  const safeRequestedLang = knownHighlightLanguage(lang);
  if (safeRequestedLang) {
    try {
      const h3 = hljs.highlight(codeText, { language: safeRequestedLang, ignoreIllegals: true }).value;
      return renderArtifactFrame(artifact, `<pre><code class="hljs language-${safeRequestedLang}">${h3}</code></pre>`);
    } catch {
    }
  }
  if (artifact) {
    const hlLang = artifact.lang === "html" || artifact.lang === "htm" ? "xml" : artifact.lang;
    const safeArtifactLang = knownHighlightLanguage(hlLang);
    if (safeArtifactLang) {
      try {
        const h3 = hljs.highlight(codeText, { language: safeArtifactLang, ignoreIllegals: true }).value;
        return renderArtifactFrame(artifact, `<pre><code class="hljs language-${safeArtifactLang}">${h3}</code></pre>`);
      } catch {
      }
    }
    return renderArtifactFrame(artifact, `<pre><code>${escapeHtml(codeText)}</code></pre>`);
  }
  try {
    const auto = hljs.highlightAuto(codeText);
    return `<pre><code class="hljs">${auto.value}</code></pre>`;
  } catch {
    return `<pre><code>${escapeHtml(codeText)}</code></pre>`;
  }
};
var mathExtensions = globalThis.VisionoxKatex ? globalThis.VisionoxKatex.markedExtensions() : [];
marked.use({ renderer, extensions: mathExtensions, gfm: true, breaks: false, pedantic: false });
function renderMarkdownToString(text) {
  return marked.parse(text);
}
function protectWindowsPathBackslashesForMarkdown(text) {
  const src = String(text ?? "");
  const pathStart = /[A-Za-z]:\\/g;
  let out = "";
  let cursor = 0;
  let match;
  while ((match = pathStart.exec(src)) !== null) {
    const start = match.index;
    if (start < cursor) continue;
    let end = src.indexOf("\n", start);
    if (end < 0) end = src.length;
    out += src.slice(cursor, start);
    out += src.slice(start, end).replace(/\\(?=[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, "\\\\");
    cursor = end;
    pathStart.lastIndex = end;
  }
  out += src.slice(cursor);
  return out;
}
function renderMarkdownPreviewToString(text) {
  const previous = globalThis.__visionoxMarkdownPreviewMode;
  globalThis.__visionoxMarkdownPreviewMode = true;
  try {
    return marked.parse(text);
  } finally {
    if (previous === void 0) delete globalThis.__visionoxMarkdownPreviewMode;
    else globalThis.__visionoxMarkdownPreviewMode = previous;
  }
}
function artifactPreviewDoc(artifact) {
  if (artifact.lang === "html" || artifact.lang === "htm") {
    return String(artifact.content || "");
  }
  const rendered = renderMarkdownPreviewToString(artifact.content);
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><link rel="stylesheet" href="/assets/vendor/katex/katex.min.css?token=${encodeURIComponent(TOKEN)}"><style>
body{margin:0;padding:22px 26px 34px;background:#fff;color:#1f2937;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.65;font-size:14px}
h1,h2,h3{line-height:1.25;margin:1.2em 0 .55em;color:#111827}
h1{font-size:26px}h2{font-size:21px}h3{font-size:17px}
p,ul,ol,blockquote,pre,table{margin:.8em 0}
code,pre{font-family:ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",monospace}
code{background:#f3f4f6;border-radius:4px;padding:.12em .32em}
pre{background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:12px;overflow:auto}
pre code{background:transparent;padding:0}
.artifact-preview-code{margin:.9em 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;background:#f8fafc}
.artifact-preview-code-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 10px;border-bottom:1px solid #e5e7eb;background:#f9fafb;color:#64748b;font-size:12px}
.artifact-preview-code-head button{height:24px;display:inline-flex;align-items:center;justify-content:center;padding:0 9px;border:1px solid #d1d5db;border-radius:6px;background:#fff;color:#334155;font-size:12px;line-height:1;cursor:pointer}
.artifact-preview-code pre{margin:0;border:0;border-radius:0;background:#f8fafc}
blockquote{border-left:4px solid #d1d5db;padding-left:12px;color:#4b5563}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #e5e7eb;padding:6px 8px}th{background:#f9fafb}
a{color:#2563eb}
.visionox-math-block{margin:.9em 0;overflow-x:auto;overflow-y:hidden;text-align:center}
.visionox-math-inline{white-space:nowrap}
</style></head><body>${rendered}</body></html>`;
}
function closeArtifactPreview() {
  document.querySelector(".artifact-preview-backdrop")?.remove();
  document.body.classList.remove("artifact-preview-open");
}
function showArtifactPreview(artifact) {
  closeArtifactPreview();
  const backdrop = document.createElement("div");
  backdrop.className = "artifact-preview-backdrop";
  const dialog = document.createElement("div");
  dialog.className = "artifact-preview-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", t4("mdArt.previewAria", { name: artifact.filename }));
  const title = document.createElement("div");
  title.className = "artifact-preview-head";
  const canShowSource = artifact.lang !== "html" && artifact.lang !== "htm";
  title.innerHTML = `<span class="artifact-preview-name" title="${escapeHtml(artifact.path || artifact.filename)}">${escapeHtml(artifact.filename)}</span>
    <span class="artifact-preview-actions">
      ${canShowSource ? `<button type="button" class="artifact-preview-btn" data-artifact-preview-action="source">${t4("mdArt.source")}</button>` : ""}
      ${artifact.path ? `<button type="button" class="artifact-preview-btn" data-artifact-preview-action="copy-path">${t4("mdArt.copyPath")}</button>` : ""}
      ${artifact.path ? `<button type="button" class="artifact-preview-btn" data-artifact-preview-action="folder">${t4("mdArt.folder")}</button>` : ""}
      <button type="button" class="artifact-preview-close" data-artifact-preview-action="close" aria-label="${t4("mdArt.backToChat")}">${t4("mdArt.backToChat")}</button>
    </span>`;
  const body = document.createElement("div");
  body.className = "artifact-preview-body";
  let showingSource = false;
  const renderPreview = () => {
    body.replaceChildren();
    const iframe = document.createElement("iframe");
    iframe.className = "artifact-preview-frame";
    const isRawHtml = artifact.lang === "html" || artifact.lang === "htm";
    iframe.setAttribute("sandbox", isRawHtml ? "" : "allow-same-origin");
    if (!isRawHtml) {
      iframe.addEventListener("load", () => wireArtifactPreviewCodeCopy(iframe));
    }
    iframe.srcdoc = artifactPreviewDoc(artifact);
    body.appendChild(iframe);
  };
  const openLogs = () => {
    try {
      if (window.parent && window.parent !== window) window.parent.postMessage({ type: "vis_open_log_dir" }, "*");
    } catch {
    }
  };
  const renderSource = () => {
    body.replaceChildren();
    const pre = document.createElement("pre");
    pre.className = "artifact-preview-source";
    pre.textContent = artifact.content || "";
    body.appendChild(pre);
  };
  renderPreview();
  dialog.appendChild(title);
  dialog.appendChild(body);
  backdrop.appendChild(dialog);
  document.body.appendChild(backdrop);
  document.body.classList.add("artifact-preview-open");
  backdrop.addEventListener("click", (ev) => {
    if (ev.target === backdrop) closeArtifactPreview();
  });
  title.addEventListener("click", async (ev) => {
    const btn = ev.target?.closest?.("[data-artifact-preview-action]");
    if (!btn) return;
    const action = btn.dataset.artifactPreviewAction;
    if (action === "close") {
      closeArtifactPreview();
      return;
    }
    if (action === "source") {
      showingSource = !showingSource;
      btn.textContent = showingSource ? t4("mdArt.preview") : t4("mdArt.source");
      if (showingSource) renderSource();
      else renderPreview();
      return;
    }
    try {
      if (action === "copy-path") {
        await writeClipboardText(artifact.path || "");
        showToast(t4("mdArt.pathCopied"), "info");
      } else if (action === "folder") {
        if (!await confirmExternalArtifactOpen(artifact)) return;
        await api("/artifacts/open-folder", { method: "POST", body: { path: artifact.path } });
        showToast(t4("mdArt.folderOpened"), "info");
      }
    } catch (err) {
      showToast(err.message || t4("mdArt.fileOpFailed"), "error", 5e3);
    }
  });
}
function confirmExternalArtifactOpen(artifact) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "artifact-open-confirmation";
    const dialog = document.createElement("div");
    dialog.className = "artifact-open-confirmation-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", t4("mdArt.confirmOpenAria"));
    dialog.innerHTML = `<div class="artifact-open-confirmation-title">${t4("mdArt.confirmOpenTitle")}</div>
      <div class="artifact-open-confirmation-text">${t4("mdArt.confirmOpenText", { name: escapeHtml(artifact.filename || artifact.path || t4("mdArt.thisFile")) })}</div>
      <div class="artifact-open-confirmation-actions">
        <button type="button" class="artifact-preview-btn" data-artifact-open-action="cancel">${t4("mdArt.stayInChat")}</button>
        <button type="button" class="artifact-preview-btn primary" data-artifact-open-action="open">${t4("mdArt.openWithSystem")}</button>
      </div>`;
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
    const finish = (approved) => {
      document.removeEventListener("keydown", onKeyDown);
      backdrop.remove();
      resolve(approved);
    };
    const onKeyDown = (ev) => {
      if (ev.key === "Escape") finish(false);
    };
    document.addEventListener("keydown", onKeyDown);
    backdrop.addEventListener("click", (ev) => {
      if (ev.target === backdrop) finish(false);
      const action = ev.target?.closest?.("[data-artifact-open-action]")?.dataset?.artifactOpenAction;
      if (action === "open") finish(true);
      else if (action === "cancel") finish(false);
    });
    dialog.querySelector('[data-artifact-open-action="cancel"]')?.focus();
  });
}
function wireArtifactPreviewCodeCopy(iframe) {
  let doc;
  try {
    doc = iframe.contentDocument;
  } catch {
    return;
  }
  if (!doc || doc.__visionoxPreviewCodeCopyBound) return;
  doc.__visionoxPreviewCodeCopyBound = true;
  doc.addEventListener("click", async (ev) => {
    const btn = ev.target?.closest?.("[data-preview-code-copy]");
    if (!btn) return;
    ev.preventDefault();
    const wrap = btn.closest(".artifact-preview-code");
    const text = wrap?.querySelector?.("pre code")?.textContent || "";
    const original = btn.textContent || t4("mdArt.copy");
    try {
      await writeClipboardText(text);
      btn.textContent = t4("mdArt.copied");
      setTimeout(() => {
        btn.textContent = original;
      }, 1200);
    } catch (err) {
      btn.textContent = t4("mdArt.copyFailed");
      showToast(err.message || t4("mdArt.copyFailed"), "error", 4e3);
      setTimeout(() => {
        btn.textContent = original;
      }, 1500);
    }
  });
}
async function saveArtifact(artifact, wrap) {
  if (artifact.path && artifact.dir) return artifact;
  const res = await api("/artifacts/save", {
    method: "POST",
    body: { filename: artifact.filename, content: artifact.content, lang: artifact.lang }
  });
  artifact.path = res.path;
  artifact.dir = res.dir;
  artifact.filename = res.filename || artifact.filename;
  const openFolderBtn = wrap?.querySelector?.('[data-artifact-action="open-folder"]');
  if (openFolderBtn) openFolderBtn.disabled = false;
  const nameEl = wrap?.querySelector?.(".chat-artifact-name");
  if (nameEl) {
    nameEl.textContent = artifact.filename;
    nameEl.setAttribute("title", artifact.path || artifact.filename);
  }
  const statusEl = wrap?.querySelector?.("[data-artifact-status]");
  if (statusEl) statusEl.textContent = t4("mdArt.saved");
  return artifact;
}
async function handleArtifactAction(ev) {
  const btn = ev.target?.closest?.("[data-artifact-action]");
  if (!btn) return;
  const wrap = btn.closest(".chat-artifact");
  const id = wrap?.dataset?.artifactId;
  const artifact = id ? window.__visionoxArtifacts?.[id] : null;
  if (!artifact) return;
  ev.preventDefault();
  ev.stopPropagation();
  const action = btn.dataset.artifactAction;
  try {
    if (action === "copy") {
      await writeClipboardText(artifact.content);
      showToast(t4("mdArt.contentCopied"), "info");
    } else if (action === "preview") {
      showArtifactPreview(artifact);
    } else if (action === "save") {
      btn.disabled = true;
      await saveArtifact(artifact, wrap);
      showToast(t4("mdArt.savedTo", { name: artifact.filename }), "info");
    } else if (action === "open-file") {
      if (!await confirmExternalArtifactOpen(artifact)) return;
      btn.disabled = true;
      await saveArtifact(artifact, wrap);
      await api("/artifacts/open-file", { method: "POST", body: { path: artifact.path } });
    } else if (action === "open-folder") {
      if (!await confirmExternalArtifactOpen(artifact)) return;
      if (!artifact.dir) await saveArtifact(artifact, wrap);
      await api("/artifacts/open-folder", { method: "POST", body: { dir: artifact.dir } });
    }
  } catch (err) {
    showToast(err.message || t4("mdArt.opFailed"), "error", 5e3);
  } finally {
    if (action === "save" || action === "open-file") btn.disabled = false;
  }
}
document.addEventListener("click", handleArtifactAction);
document.addEventListener("click", (ev) => {
  if (ev.target?.classList?.contains("artifact-preview-close")) {
    closeArtifactPreview();
  }
});
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") closeArtifactPreview();
});
var LANG_BY_EXT = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  rs: "rust",
  go: "go",
  java: "java",
  kt: "kotlin",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  hpp: "cpp",
  cs: "csharp",
  swift: "swift",
  rb: "ruby",
  php: "php",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  fish: "bash",
  ps1: "powershell",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "ini",
  xml: "xml",
  html: "xml",
  svg: "xml",
  css: "css",
  scss: "scss",
  less: "less",
  md: "markdown",
  sql: "sql",
  vue: "xml",
  svelte: "xml",
  tex: "latex",
  proto: "protobuf",
  dockerfile: "dockerfile"
};
function langFromPath(path) {
  if (!path) return null;
  const lower = path.toLowerCase();
  if (lower.endsWith("dockerfile")) return "dockerfile";
  const dot = lower.lastIndexOf(".");
  if (dot < 0) return null;
  const ext = lower.slice(dot + 1);
  return LANG_BY_EXT[ext] ?? null;
}
function renderHighlightedBlock(text, lang) {
  if (!text) return "";
  const safeLang = knownHighlightLanguage(lang);
  try {
    const out = safeLang
      ? hljs.highlight(text, { language: safeLang, ignoreIllegals: true })
      : typeof hljs?.highlightAuto === "function" ? hljs.highlightAuto(text) : null;
    if (!out) return `<pre><code>${escapeHtml(text)}</code></pre>`;
    return `<pre class="md"><code class="hljs ${safeLang ? `language-${safeLang}` : ""}">${out.value}</code></pre>`;
  } catch {
    return `<pre><code>${escapeHtml(text)}</code></pre>`;
  }
}
function hlLine(text, lang) {
  if (text == null) return "";
  if (text === "") return "";
  try {
    const safeLang = knownHighlightLanguage(lang);
    if (safeLang) {
      return hljs.highlight(text, { language: safeLang, ignoreIllegals: true }).value;
    }
    if (typeof hljs?.highlightAuto === "function") return hljs.highlightAuto(text).value;
    return escapeHtml(text);
  } catch {
    return escapeHtml(text);
  }
}

export {
  artifactDisplayName,
  closeArtifactPreview,
  confirmExternalArtifactOpen,
  escapeHtml,
  hlLine,
  langFromPath,
  protectWindowsPathBackslashesForMarkdown,
  registerChatArtifact,
  renderHighlightedBlock,
  renderMarkdownPreviewToString,
  renderMarkdownToString,
  renderSearchReplace,
  renderUnifiedDiff,
  showArtifactPreview,
};
