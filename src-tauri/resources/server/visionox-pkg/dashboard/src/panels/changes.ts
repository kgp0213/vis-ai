// Recovered from the product bundle; types are tightened incrementally without changing behavior.
// @ts-nocheck
import htm_module_default from "htm";
import hljs from "highlight.js/lib/common";
import { h as k } from "preact";
import { useCallback as q2, useEffect as y2, useRef as A2, useState as d2 } from "preact/hooks";
import { ChatMessage, ToolCard } from "../components/chat-internals.js";
import { TodoBar } from "./chat.js";
import { TOKEN, api } from "../lib/api.js";
import { showToast } from "../lib/bus.js";
import { parseHunks } from "../lib/diff-parser.js";
import { getFileIcon, useFileTreeState, useProjectTree } from "../lib/file-tree.js";
import { primaryBalance } from "../lib/format.js";
import { useLineComments } from "../lib/line-comments.js";
import { useReviewDiffs } from "../lib/review-diffs.js";
import { subscribeSse, subscribeSseStatus } from "../lib/use-poll.js";
import { applyDashboardEvent as reduceDashboardEvent, createDashboardReducerState, createDashboardReducerStateFromSnapshot, mergeCanonicalMessagePage } from "../lib/event-reducer.js";
import { mergeSnapshotToolsIntoMessages } from "../lib/chat-turn-rendering.js";
import { t as t4, useLang } from "../i18n/index.js";
import { Select } from "../ui/index.js";

var html6 = htm_module_default.bind(k);
function escapeAttr(s3) {
  return s3.replace(/["&<>]/g, (c3) => ({ '"': "&quot;", "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c3]);
}
function lineDiff2(a3, b2) {
  const m3 = a3.length, n3 = b2.length;
  const dp = Array.from({ length: m3 + 1 }, () => new Array(n3 + 1).fill(0));
  for (let i4 = 1; i4 <= m3; i4++) for (let j5 = 1; j5 <= n3; j5++)
    dp[i4][j5] = a3[i4 - 1] === b2[j5 - 1] ? dp[i4 - 1][j5 - 1] + 1 : Math.max(dp[i4 - 1][j5], dp[i4][j5 - 1]);
  const out = [];
  let i3 = m3, j4 = n3;
  while (i3 > 0 || j4 > 0) {
    if (i3 > 0 && j4 > 0 && a3[i3 - 1] === b2[j4 - 1]) {
      out.push({ kind: "context", text: a3[i3 - 1] });
      i3--;
      j4--;
    } else if (j4 > 0 && (i3 === 0 || dp[i3][j4 - 1] >= dp[i3 - 1][j4])) {
      out.push({ kind: "ins", text: b2[j4 - 1] });
      j4--;
    } else {
      out.push({ kind: "del", text: a3[i3 - 1] });
      i3--;
    }
  }
  return out.reverse();
}
function pairDiffRows2(diff) {
  const rows = [];
  let k3 = 0;
  while (k3 < diff.length) {
    const e3 = diff[k3];
    if (e3.kind === "context") {
      rows.push({ left: e3.text, right: e3.text, kind: "context" });
      k3++;
      continue;
    }
    const d3 = [], ins = [];
    while (k3 < diff.length && diff[k3].kind === "del") d3.push(diff[k3].text), k3++;
    while (k3 < diff.length && diff[k3].kind === "ins") ins.push(diff[k3].text), k3++;
    const p3 = Math.max(d3.length, ins.length);
    for (let i3 = 0; i3 < p3; i3++) rows.push({ left: d3[i3] ?? null, right: ins[i3] ?? null, kind: d3[i3] != null && ins[i3] != null ? "change" : d3[i3] != null ? "del" : "ins" });
  }
  return rows;
}
function hE(s3) {
  return s3.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function renderDiffHtml(patch, style) {
  const hunks = parseHunks(patch);
  if (hunks.length === 0) return "";
  if (style === "unified") {
    let html9 = "";
    for (const hunk of hunks) {
      html9 += `<div class="diff-hunk-header">@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@</div>`;
      for (const line of hunk.lines) {
        const cls = line.type === "add" ? "diff-add" : line.type === "del" ? "diff-del" : "";
        const prefix = line.type === "add" ? "+" : line.type === "del" ? "-" : " ";
        html9 += `<div class="diff-line ${cls}"><span class="diff-ln-old">${line.oldLineNum ?? ""}</span><span class="diff-ln-new">${line.newLineNum ?? ""}</span><span class="diff-prefix">${prefix}</span><span class="diff-content">${hE(line.content)}</span></div>`;
      }
    }
    return html9;
  }
  const oldLines = [], newLines = [];
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.type === "ctx") {
        oldLines.push(line.content);
        newLines.push(line.content);
      } else if (line.type === "del") oldLines.push(line.content);
      else newLines.push(line.content);
    }
  }
  const diff = lineDiff2(oldLines, newLines);
  const rows = pairDiffRows2(diff);
  let oldNum = 1, newNum = 1;
  let html8 = `<div class="edit-diff-head"><div class="edit-diff-side edit-diff-side-old"><span class="edit-diff-marker">\u2212</span> Before</div><div class="edit-diff-side edit-diff-side-new"><span class="edit-diff-marker">+</span> After</div></div><div class="edit-diff-body">`;
  for (const row of rows) {
    html8 += `<div class="edit-diff-row edit-diff-row-${row.kind}">`;
    html8 += `<div class="edit-diff-cell edit-diff-cell-old">`;
    if (row.left != null) {
      html8 += `<span class="edit-diff-ln">${oldNum}</span><span class="edit-diff-marker">${row.kind === "del" || row.kind === "change" ? "\u2212" : " "}</span>${hE(row.left)}`;
      oldNum++;
    }
    html8 += `</div>`;
    html8 += `<div class="edit-diff-cell edit-diff-cell-new">`;
    if (row.right != null) {
      html8 += `<span class="edit-diff-ln">${newNum}</span><span class="edit-diff-marker">${row.kind === "ins" || row.kind === "change" ? "+" : " "}</span>${hE(row.right)}`;
      newNum++;
    }
    html8 += `</div></div>`;
  }
  html8 += `</div>`;
  return html8;
}
function ChangesPanel() {
  useLang();
  const { tree, loading } = useProjectTree();
  const { expanded, openFiles, activeFilePath, activeFile, toggleExpand, openFile, closeFile, setActiveFilePath } = useFileTreeState(tree);
  const { comments, draft, startDraft, cancelDraft, setDraftContent, submitDraft, commentsForFile, deleteComment, editComment } = useLineComments();
  const { diffs, modifiedFiles, modifiedCount, reload } = useReviewDiffs();
  const [diffSource, setDiffSource] = d2("git");
  const [checkpointList, setCheckpointList] = d2([]);
  const [selectedCheckpointId, setSelectedCheckpointId] = d2(null);
  const [createName, setCreateName] = d2("");
  const [leftPct, setLeftPct] = d2(30);
  const [rightPct, setRightPct] = d2(30);
  const [showOnlyModified, setShowOnlyModified] = d2(false);
  const [reviewMode, setReviewMode] = d2(true);
  const [diffStyle, setDiffStyle] = d2("unified");
  const [reviewHtml, setReviewHtml] = d2("");
  const openingFile = A2(false);
  y2(() => {
    if (openFiles.length === 0 && !openingFile.current) setReviewMode(true);
  }, [openFiles]);
  const diffEndpoint = diffSource === "checkpoint" ? selectedCheckpointId ? `/checkpoint-diffs?id=${selectedCheckpointId}` : null : diffSource === "git" ? "/git-diffs" : "/review-diffs";
  y2(() => {
    if (diffSource === "checkpoint") {
      api("/checkpoints").then((list2) => setCheckpointList(list2)).catch(() => setCheckpointList([]));
    }
  }, [diffSource]);
  y2(() => {
    if (diffEndpoint) {
      reload(diffEndpoint);
    } else {
      setReviewHtml(`<div class="review-empty">${t4("changes.reviewEmpty") || "Select a checkpoint to compare"}</div>`);
    }
    void diffEndpoint;
  }, [diffEndpoint, reload]);
  y2(() => {
    if (diffs.length === 0) {
      const emptyMsg = t4("changes.reviewEmpty") || "No changes to review";
      setReviewHtml(`<div class="review-empty">${emptyMsg}</div>`);
      return;
    }
    setReviewHtml(
      diffs.map((diff) => {
        const file = hE(diff.file);
        const chev = '<span class="chev">\u25B8</span>';
        const stat = `<span class="stat"><span class="add">+${diff.additions}</span><span class="rem"> -${diff.deletions}</span></span>`;
        const body = diff.patch ? `<div class="review-file-body" style="display:none">${renderDiffHtml(diff.patch, diffStyle)}</div>` : "";
        return `<div class="review-file-item" data-file="${escapeAttr(file)}"><div class="review-file-header">${chev}<span class="filename">${escapeAttr(file)}</span>${stat}</div>${body}</div>`;
      }).join("")
    );
  }, [diffs, diffStyle, t4]);
  const expandAll = q2(() => {
    document.querySelectorAll(".review-file-body").forEach((el) => {
      el.style.display = "";
    });
    document.querySelectorAll(".review-file-header .chev").forEach((el) => {
      el.textContent = "\u25BE";
    });
  }, []);
  const collapseAll = q2(() => {
    document.querySelectorAll(".review-file-body").forEach((el) => {
      el.style.display = "none";
    });
    document.querySelectorAll(".review-file-header .chev").forEach((el) => {
      el.textContent = "\u25B8";
    });
  }, []);
  const handleLeftResize = q2((delta) => {
    setLeftPct((prev) => {
      const containerWidth = window.innerWidth;
      const deltaPct = delta / containerWidth * 100;
      return Math.max(15, Math.min(50, prev + deltaPct));
    });
  }, []);
  const handleRightResize = q2((delta) => {
    setRightPct((prev) => {
      const containerWidth = window.innerWidth;
      const deltaPct = delta / containerWidth * 100;
      return Math.max(15, Math.min(50, prev - deltaPct));
    });
  }, []);
  const toggleModifiedFilter = q2(() => {
    setShowOnlyModified((prev) => !prev);
  }, []);
  const toggleReviewMode = q2(() => {
    setReviewMode((prev) => !prev);
  }, []);
  const openReviewWithFilePicker = q2(() => {
    setReviewMode(true);
  }, []);
  const handleOpenFile = q2(
    async (filePath) => {
      const findInTree = (nodes, path) => {
        for (const n3 of nodes) {
          if (n3.path === path) return n3;
          if (n3.children) {
            const found = findInTree(n3.children, path);
            if (found) return found;
          }
        }
        return null;
      };
      let node = findInTree(tree, filePath);
      if (!node) {
        const parts = filePath.split("/");
        const name = parts[parts.length - 1] || filePath;
        node = { path: filePath, name, isDir: false };
      }
      await openFile(node);
    },
    [tree, openFile]
  );
  y2(() => {
    const handler = (e3) => {
      const header = e3.target.closest(".review-file-header");
      if (!header) return;
      const item = header.closest(".review-file-item");
      if (!item) return;
      const filePath = item.getAttribute("data-file");
      if (!filePath) return;
      const body = item.querySelector(".review-file-body");
      if (body) {
        const isOpen = body.style.display !== "none";
        body.style.display = isOpen ? "none" : "";
        const chev = header.querySelector(".chev");
        if (chev) chev.textContent = isOpen ? "\u25B8" : "\u25BE";
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);
  const activeFileComments = activeFile ? commentsForFile(activeFile.path) : [];
  return html6`
    <div class="changes-layout">
      <div class="changes-panel changes-panel-left" style=${{ width: `${leftPct}%` }}>
        <div class="changes-panel-header">
          <span class="glyph">◆</span>
          <span>${t4("changes.chatPanelTitle")}</span>
        </div>
        <div class="changes-panel-body">
          <${ChatPane}
            comments=${comments}
            deleteComment=${deleteComment}
          />
        </div>
      </div>

      <${ResizeHandle} onResize=${handleLeftResize} direction="horizontal" />

      <div class="changes-panel changes-panel-center">
        ${reviewMode ? html6`
              <${TabBar}
                reviewTab=${html6`<${ReviewTab} count=${modifiedCount()} active=${true} onClick=${toggleReviewMode} />`}
                fileList=${diffs.map((d3) => d3.file)}
                onOpenFile=${(f3) => {
    handleOpenFile(f3);
    setReviewMode(false);
  }}
                onToggleReview=${toggleReviewMode}
                files=${openFiles}
                activePath=${activeFilePath}
                onSelect=${(path) => {
    setActiveFilePath(path);
    setReviewMode(false);
  }}
                onClose=${closeFile}
              />
              <div class="review-controls" style=${{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", borderBottom: "1px solid var(--bd)", fontSize: "12px" }}>
                <${Select} value=${diffSource} width="150px" ariaLabel=${t4("changes.diffSource")} onChange=${(v3) => {
    setDiffSource(v3);
    if (v3 !== "checkpoint") setSelectedCheckpointId(null);
  }} options=${[
                  { value: "git", label: t4("changes.diffSourceGit") },
                  { value: "session", label: t4("changes.diffSourceSession") },
                  { value: "checkpoint", label: t4("changes.diffSourceCheckpoint") }
                ]} />
                ${diffSource !== "checkpoint" || selectedCheckpointId ? html6`
                <span style=${{ color: "var(--fg-3)" }}>${modifiedCount()}</span>
                <div style=${{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "4px" }}>
                  <button class=${`toggle-btn ${diffStyle === "unified" ? "active" : ""}`} onClick=${() => setDiffStyle("unified")} style=${{ fontSize: "11px", padding: "2px 6px" }}>${t4("changes.diffStyleUnified")}</button>
                  <button class=${`toggle-btn ${diffStyle === "split" ? "active" : ""}`} onClick=${() => setDiffStyle("split")} style=${{ fontSize: "11px", padding: "2px 6px" }}>${t4("changes.diffStyleSplit")}</button>
                  <button class="toggle-btn" onClick=${expandAll} style=${{ fontSize: "11px", padding: "2px 6px" }}>${t4("changes.expandAll")}</button>
                  <button class="toggle-btn" onClick=${collapseAll} style=${{ fontSize: "11px", padding: "2px 6px" }}>${t4("changes.collapseAll")}</button>
                </div>
                ` : null}
              </div>
              ${diffSource === "checkpoint" && selectedCheckpointId ? html6`
                <div style=${{ padding: "4px 12px", fontSize: "11px", color: "var(--fg-3)", borderBottom: "1px solid var(--bd)", cursor: "pointer" }}>
                  <span onClick=${() => setSelectedCheckpointId(null)} style=${{ color: "var(--c-brand)", cursor: "pointer" }}>← ${t4("changes.backToList")}</span>
                </div>
              ` : null}
              ${diffSource === "checkpoint" && !selectedCheckpointId ? html6`
                <div class="checkpoint-picker" style=${{ flex: "1", overflowY: "auto", padding: "8px 12px" }}>
                  <div style=${{ display: "flex", gap: "6px", marginBottom: "8px" }}>
                    <input
                      value=${createName}
                      onInput=${(e3) => setCreateName(e3.target.value)}
                      placeholder=${t4("changes.createPlaceholder")}
                      style=${{ flex: 1, fontSize: "12px", padding: "4px 8px", background: "var(--bg-input)", border: "1px solid var(--bd)", borderRadius: "3px", color: "var(--fg-0)" }}
                    />
                    <button
                      class="primary"
                      onClick=${async () => {
    const name = createName.trim();
    if (!name) return;
    try {
      await api("/checkpoint-create", { method: "POST", body: { name } });
      setCreateName("");
      const list2 = await api("/checkpoints");
      setCheckpointList(list2);
    } catch {
      alert("create failed");
    }
  }}
                      disabled=${!createName.trim()}
                      style=${{ padding: "5px 12px" }}
                    >${t4("changes.createBtn")}</button>
                  </div>
                  ${checkpointList.length === 0 ? html6`
                    <div class="empty" style=${{ textAlign: "center", margin: "12px" }}>${t4("changes.checkpointEmpty")}</div>
                  ` : checkpointList.map((c3) => html6`
                    <div
                      key=${c3.id}
                      class="checkpoint-item"
                      style=${{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", cursor: "pointer", borderRadius: "4px", borderBottom: "1px solid var(--bd)" }}
                      onMouseEnter=${(e3) => {
    e3.currentTarget.style.background = "var(--bg-hover)";
  }}
                      onMouseLeave=${(e3) => {
    e3.currentTarget.style.background = "transparent";
  }}
                    >
                      <div
                        onClick=${() => {
    setSelectedCheckpointId(c3.id);
  }}
                        style=${{ display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}
                      >
                        <span style=${{ fontSize: "13px", fontWeight: 500 }}>${c3.name}</span>
                        <span style=${{ fontSize: "11px", color: "var(--fg-3)" }}>${c3.id.slice(0, 7)} · ${c3.fileCount} file${c3.fileCount === 1 ? "" : "s"}</span>
                      </div>
                      <div style=${{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style=${{ fontSize: "11px", color: "var(--fg-4)" }}>${c3.ago}</span>
                        <button
                          onClick=${async (e3) => {
    e3.stopPropagation();
    if (confirm(t4("changes.restoreConfirm").replace("{name}", c3.name))) {
      try {
        await api("/checkpoint-restore", { method: "POST", body: { id: c3.id } });
        setSelectedCheckpointId(null);
        setDiffSource("git");
      } catch {
        alert("restore failed");
      }
    }
  }}
                          style=${{ fontSize: "11px", padding: "2px 6px", background: "var(--c-brand)", color: "#fff", border: "none", borderRadius: "3px", cursor: "pointer" }}
                        >${t4("changes.restoreBtn")}</button>
                        <button
                          onClick=${async (e3) => {
    e3.stopPropagation();
    if (confirm(t4("changes.deleteConfirm").replace("{name}", c3.name))) {
      try {
        await api("/checkpoint-delete", { method: "POST", body: { id: c3.id } });
        setCheckpointList((prev) => prev.filter((x3) => x3.id !== c3.id));
      } catch {
        alert("delete failed");
      }
    }
  }}
                          style=${{ fontSize: "11px", padding: "2px 6px", color: "var(--fg-3)", border: "1px solid var(--bd)", borderRadius: "3px", cursor: "pointer", background: "transparent" }}
                        >${t4("changes.deleteBtn")}</button>
                      </div>
                    </div>
                  `)}
                </div>
              ` : null}
              <div class="review-diff-view" style=${{ flex: "1", overflowY: "auto" }}>
                <div class="review-diff-list" style=${{ padding: "0 12px" }} key=${diffStyle} dangerouslySetInnerHTML=${{ __html: reviewHtml }}></div>
              </div>
            ` : html6`
              <${TabBar}
                reviewTab=${html6`<${ReviewTab} count=${modifiedCount()} active=${false} onClick=${toggleReviewMode} />`}
                fileList=${diffs.map((d3) => d3.file)}
                onOpenFile=${handleOpenFile}
                files=${openFiles}
                activePath=${activeFilePath}
                onSelect=${setActiveFilePath}
                onClose=${closeFile}
              />
              <${CodeViewer}
                key=${activeFile?.path ?? "empty"}
                file=${activeFile}
                comments=${activeFileComments}
                draft=${draft && draft.file === activeFilePath ? draft : null}
                onStartComment=${startDraft}
                onEditComment=${editComment}
                onCancelComment=${cancelDraft}
                onCommentChange=${setDraftContent}
                onSubmitComment=${submitDraft}
                onDeleteComment=${deleteComment}
              />
            `}
      </div>

      <${ResizeHandle} onResize=${handleRightResize} direction="horizontal" />

      <div class="changes-panel changes-panel-right" style=${{ width: `${rightPct}%` }}>
        <div class="changes-panel-header">
          <span class="glyph">▼</span>
          <span>${t4("changes.fileTreeTitle")}</span>
        </div>
        <${FileTreeToggle}
          showOnlyModified=${showOnlyModified}
          modifiedCount=${modifiedCount()}
          onToggle=${toggleModifiedFilter}
        />
        <div class="changes-panel-body">
          ${loading ? html6`<div class="empty" style=${{ margin: "12px", textAlign: "center" }}>${t4("changes.loadingFiles")}</div>` : html6`<${FileTree}
                nodes=${tree}
                expanded=${expanded}
                onToggle=${toggleExpand}
                onSelect=${(node) => {
    setReviewMode(false);
    openFile(node);
  }}
                modifiedFiles=${modifiedFiles()}
                showOnlyModified=${showOnlyModified}
              />`}
        </div>
      </div>
    </div>
  `;
}
function fmtCost2(usd, currency) {
  if (currency === "CNY" || currency === "\xA5") {
    return `\xA5${(usd * 7.2).toFixed(4)}`;
  }
  return `$${usd.toFixed(4)}`;
}
function ChatStatusBar3({ stats, model }) {
  useLang();
  if (!stats) {
    return html6`
      <div class="chat-statusbar">
        <span class="muted">—</span>
      </div>
    `;
  }
  const currentContextTokens = stats.estimatedContextTokens ?? stats.lastPromptTokens;
  const ctxPct = stats.contextCapTokens > 0 ? currentContextTokens / stats.contextCapTokens * 100 : 0;
  const contextMarks = [
    { tokens: stats.contextFoldTokens, label: t4("chat.foldNormal") },
    { tokens: stats.contextAggressiveTokens, label: t4("chat.foldAggressive") },
    { tokens: stats.contextForceSummaryTokens, label: t4("chat.foldForceSummary") },
  ].filter((mark) => Number.isFinite(mark.tokens) && mark.tokens > 0 && stats.contextCapTokens > 0)
    .map((mark) => ({ ...mark, pct: Math.min(100, mark.tokens / stats.contextCapTokens * 100) }));
  const balance = primaryBalance(stats);
  return html6`
    <div class="chat-statusbar">
      <span class="status-item">
        <span class="status-label">${t4("chat.statusModel")}</span>
        <code>${model ?? "\u2014"}</code>
      </span>
      <span class="status-item">
        <span class="status-label">${t4("chat.statusCtx")}</span>
        <span class="status-bar-mini">
          <span class="status-bar-mini-fill" style=${`width: ${Math.min(100, ctxPct).toFixed(1)}%;`}></span>
          ${contextMarks.map((mark) => html6`<span class="fold-mark" style=${`left:${mark.pct.toFixed(2)}%`} title=${`${mark.label} ${(mark.tokens / 1e3).toFixed(0)}K`}></span>`)}
        </span>
        <span class="muted">${currentContextTokens.toLocaleString()} / ${(stats.contextCapTokens / 1e3).toFixed(0)}K</span>
      </span>
      <span class="status-item">
        <span class="status-label">${t4("chat.statusCache")}</span>
        <span class=${stats.cacheHitRatio >= 0.9 ? "status-ok" : stats.cacheHitRatio >= 0.6 ? "status-warn" : "status-err"}>
          ${(stats.cacheHitRatio * 100).toFixed(1)}%
        </span>
      </span>
      <span class="status-item">
        <span class="status-label">${t4("chat.statusTurn")}</span>
        <code>${fmtCost2(stats.lastTurnCostUsd, balance?.currency)}</code>
      </span>
      <span class="status-item">
        <span class="status-label">${t4("chat.statusSession")}</span>
        <code>${fmtCost2(stats.totalCostUsd, balance?.currency)}</code>
        <span class="muted" style="font-size: 10px;">
          ${t4("chat.statusTurns", { count: stats.turns, s: stats.turns === 1 ? "" : "s" })}
        </span>
      </span>
      ${balance ? html6`
          <span class="status-item">
            <span class="status-label">${t4("chat.statusBalance")}</span>
            <code>${balance.total_balance ?? balance.total} ${balance.currency}</code>
          </span>
        ` : null}
    </div>
  `;
}
function CommentCard(props) {
  return html6`
    <div class="comment-card">
      <span class="comment-card-icon">⬥</span>
      <span class="comment-card-file">${props.fileName}:${props.lineNumber}</span>
      <span class="comment-card-content">${props.content}</span>
      <span class="comment-card-remove" onClick=${props.onRemove}>×</span>
    </div>
  `;
}
function filterModifiedNodes(nodes, modifiedFiles) {
  return nodes.map((node) => {
    if (node.isDir && node.children) {
      const filteredChildren = filterModifiedNodes(node.children, modifiedFiles);
      if (filteredChildren.length === 0) return null;
      return { ...node, children: filteredChildren };
    }
    if (modifiedFiles.has(node.path)) return node;
    return null;
  }).filter((n3) => n3 !== null);
}
function renderTree(props) {
  const { nodes, expanded, onToggle, onSelect, indent = 0, modifiedFiles = /* @__PURE__ */ new Set(), showOnlyModified = false } = props;
  const displayNodes = showOnlyModified ? filterModifiedNodes(nodes, modifiedFiles) : nodes;
  return displayNodes.map((node) => {
    const isExpanded = expanded.has(node.path);
    const indentEls = [];
    for (let i3 = 0; i3 < indent; i3++) {
      indentEls.push(html6`<span class="indent" key=${`indent-${i3}`} />`);
    }
    if (node.isDir) {
      const cls2 = isExpanded ? "tree-node open" : "tree-node";
      return html6`
        <div key=${node.path}>
          <div class=${cls2} onClick=${() => onToggle(node.path)}>
            ${indentEls}
            <span class="arrow">${isExpanded ? "\u25BE" : "\u25B8"}</span>
            <span class="icon dir">▼</span>
            <span class="name">${node.name}</span>
          </div>
          ${isExpanded && node.children && node.children.length > 0 ? renderTree({ nodes: node.children, expanded, onToggle, onSelect, indent: indent + 1, modifiedFiles, showOnlyModified }) : null}
          ${isExpanded && (!node.children || node.children.length === 0) ? html6`<div class="tree-node" style=${{ paddingLeft: `${(indent + 1) * 14 + 8}px` }}>
                <span class="name muted">${t4("changes.treeEmpty")}</span>
              </div>` : null}
        </div>
      `;
    }
    const { icon, cls } = getFileIcon(node.name);
    const isModified = modifiedFiles.has(node.path);
    return html6`
      <div
        key=${node.path}
        class="tree-node"
        onClick=${() => onSelect(node)}
        style=${{ paddingLeft: `${indent * 14 + 8}px` }}
      >
        <span class=${`icon ${cls}`}>${icon}</span>
        <span class="name">${node.name}</span>
        ${isModified ? html6`<span class="mod-indicator" />` : null}
      </div>
    `;
  });
}
function FileTree(props) {
  return html6`
    <div class="tree">
      ${renderTree(props)}
    </div>
  `;
}
function FileTreeToggle(props) {
  return html6`
    <div class="file-tree-toggle">
      <button
        class=${`toggle-btn ${props.showOnlyModified ? "active" : ""}`}
        onClick=${props.onToggle}
      >
        ${props.modifiedCount} ${t4("changes.changes")}
      </button>
      <button
        class=${`toggle-btn ${!props.showOnlyModified ? "active" : ""}`}
        onClick=${props.onToggle}
      >
        ${t4("changes.allFiles")}
      </button>
    </div>
  `;
}
function ReviewTab(props) {
  return html6`
    <div
      class=${`editor-tab review-tab${props.active ? " active" : ""}`}
      onClick=${props.onClick}
      style=${{ display: "flex", alignItems: "center", gap: "3px", padding: "4px 6px", cursor: props.onClick ? "pointer" : "default" }}
    >
      <span class="review-icon">◑</span>
      <span>${t4("changes.review")}</span>
      <span style=${{ color: "var(--fg-3)", fontSize: "10.5px" }}>${props.count}</span>
    </div>
  `;
}
function ResizeHandle(props) {
  const { onResize, direction } = props;
  const dragging = A2(false);
  const startX = A2(0);
  const onMouseDown = q2((e3) => {
    e3.preventDefault();
    dragging.current = true;
    startX.current = direction === "horizontal" ? e3.clientX : e3.clientY;
    document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
  }, [direction]);
  y2(() => {
    const onMouseMove = (e3) => {
      if (!dragging.current) return;
      const current = direction === "horizontal" ? e3.clientX : e3.clientY;
      const delta = current - startX.current;
      startX.current = current;
      onResize(delta);
    };
    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [onResize, direction]);
  const isH = direction === "horizontal";
  return html6`
    <div
      onMouseDown=${onMouseDown}
      style=${{
    width: isH ? "4px" : "100%",
    height: isH ? "100%" : "4px",
    cursor: isH ? "col-resize" : "row-resize",
    background: "var(--bd)",
    flexShrink: 0,
    transition: "background 0.15s"
  }}
      onMouseEnter=${(e3) => {
    e3.target.style.background = "var(--c-brand)";
  }}
      onMouseLeave=${(e3) => {
    e3.target.style.background = "var(--bd)";
  }}
    />
  `;
}
function TabBar(props) {
  const { files, activePath, onSelect, onClose, reviewTab, fileList, onOpenFile } = props;
  const popupRef = A2(null);
  const btnRef = A2(null);
  y2(() => {
    const btn = btnRef.current;
    if (!btn || !fileList || fileList.length === 0) return;
    const toggle = (e3) => {
      e3.stopPropagation();
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
        return;
      }
      const allFiles = fileList;
      const popup = document.createElement("div");
      popupRef.current = popup;
      popup.style.cssText = "position:fixed;top:20%;left:50%;transform:translateX(-50%);background:var(--bg-elev-2);border:1px solid var(--bd);border-radius:6px;max-height:400px;display:flex;flex-direction:column;z-index:1000;min-width:380px;max-width:600px;box-shadow:0 8px 24px rgba(0,0,0,.4)";
      const input = document.createElement("input");
      input.placeholder = "\u641C\u7D22\u6587\u4EF6...";
      input.style.cssText = "margin:6px 8px;padding:5px 8px;font-size:12px;background:var(--bg);color:var(--fg-0);border:1px solid var(--bd);border-radius:4px;outline:none;flex-shrink:0";
      input.onclick = (ev) => ev.stopPropagation();
      popup.appendChild(input);
      const listWrap = document.createElement("div");
      listWrap.style.cssText = "overflow-y:auto;flex:1;padding:0 4px 4px";
      popup.appendChild(listWrap);
      function renderList(filter) {
        listWrap.innerHTML = "";
        const q4 = filter.toLowerCase();
        for (const f3 of allFiles) {
          if (q4 && !f3.toLowerCase().includes(q4)) continue;
          const row = document.createElement("div");
          row.textContent = f3;
          row.style.cssText = "padding:3px 8px;font-size:11px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:var(--font-mono);border-radius:3px";
          row.onmouseenter = () => row.style.background = "var(--bg-hover)";
          row.onmouseleave = () => row.style.background = "transparent";
          row.onclick = (ev) => {
            ev.stopPropagation();
            onOpenFile?.(f3);
            popup.remove();
            popupRef.current = null;
          };
          listWrap.appendChild(row);
        }
      }
      renderList("");
      input.oninput = () => renderList(input.value);
      setTimeout(() => input.focus(), 50);
      document.body.appendChild(popup);
      const close = (ev) => {
        if (popupRef.current && !popup.contains(ev.target) && ev.target !== btn) {
          popup.remove();
          popupRef.current = null;
          document.removeEventListener("mousedown", close, true);
          document.removeEventListener("keydown", closeOnEsc, true);
        }
      };
      const closeOnEsc = (ev) => {
        if (popupRef.current && ev.key === "Escape") {
          ev.stopPropagation();
          popup.remove();
          popupRef.current = null;
          document.removeEventListener("mousedown", close, true);
          document.removeEventListener("keydown", closeOnEsc, true);
        }
      };
      document.addEventListener("mousedown", close, true);
      document.addEventListener("keydown", closeOnEsc, true);
    };
    btn.addEventListener("click", toggle);
    return () => {
      btn.removeEventListener("click", toggle);
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
    };
  }, [fileList, onOpenFile]);
  return html6`
    <div class="editor-tabs">
      ${reviewTab || null}
      ${fileList ? html6`
        <span
          ref=${btnRef}
          style=${{
    fontSize: "14px",
    padding: "4px 3px",
    cursor: "pointer",
    color: "var(--fg-3)",
    userSelect: "none",
    lineHeight: "1",
    fontFamily: "var(--font-mono)"
  }}
          title="Open file"
        >+</span>
      ` : null}
      ${files.map((f3) => html6`
        <div
          key=${f3.path}
          class=${`editor-tab ${f3.path === activePath ? "active" : ""}`}
          onClick=${() => onSelect(f3.path)}
          title=${f3.path}
        >
          <span>${f3.name}</span>
          <span
            class="x"
            onClick=${(e3) => {
    e3.stopPropagation();
    onClose(f3.path);
  }}
            title=${t4("changes.tabClose")}
          >×</span>
        </div>
      `)}
    </div>
  `;
}
function CodeViewer(props) {
  const { file, comments = [], draft, onStartComment, onEditComment, onCancelComment, onCommentChange, onSubmitComment, onDeleteComment } = props;
  const codeRef = A2(null);
  const [hoveredLine, setHoveredLine] = d2(null);
  y2(() => {
    if (!file) return;
    const el = codeRef.current;
    if (!el) return;
    el.innerHTML = "";
    const lines = file.content.split("\n");
    const commentsByLine = /* @__PURE__ */ new Map();
    comments.forEach((c3) => {
      const existing = commentsByLine.get(c3.lineNumber) || [];
      existing.push(c3);
      commentsByLine.set(c3.lineNumber, existing);
    });
    lines.forEach((line, i3) => {
      const lineNumber = i3 + 1;
      const lineComments = commentsByLine.get(lineNumber) || [];
      const hasComments = lineComments.length > 0;
      const lineDiv = document.createElement("div");
      lineDiv.className = "editor-line";
      lineDiv.dataset.lineNumber = String(lineNumber);
      lineDiv.style.position = "relative";
      lineDiv.addEventListener("mouseenter", () => setHoveredLine(lineNumber));
      lineDiv.addEventListener("mouseleave", () => setHoveredLine(null));
      const gutter = document.createElement("div");
      gutter.className = "lineno";
      gutter.textContent = String(lineNumber);
      gutter.style.position = "relative";
      gutter.style.display = "flex";
      gutter.style.alignItems = "center";
      gutter.style.justifyContent = "center";
      gutter.style.gap = "4px";
      if (onStartComment) {
        const isVisible = hoveredLine === lineNumber && (!draft || draft.file !== file.path || draft.lineNumber !== lineNumber);
        const anchorBtn = document.createElement("span");
        anchorBtn.className = `line-comment-anchor ${isVisible ? "visible" : ""}`;
        anchorBtn.style.cssText = "width:16px;height:16px;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;cursor:pointer;transition:opacity 0.15s ease;flex-shrink:0;";
        if (isVisible) {
          anchorBtn.style.opacity = "1";
          anchorBtn.style.pointerEvents = "auto";
        }
        if (hasComments) {
          anchorBtn.innerHTML = `<span class="comment-count" style="background:rgba(121,192,255,0.12);border-radius:2px;padding:0 3px;font-size:10px;color:#79c0ff;font-family:monospace;">${lineComments.length}</span>`;
        } else {
          anchorBtn.innerHTML = `<span class="plus-icon" style="font-family:monospace;font-size:14px;color:#6e7681;line-height:1;">+</span>`;
        }
        anchorBtn.addEventListener("mouseenter", () => {
          anchorBtn.style.opacity = "1";
        });
        anchorBtn.addEventListener("click", (e3) => {
          e3.stopPropagation();
          onStartComment(file.path, lineNumber);
        });
        gutter.appendChild(anchorBtn);
      }
      const content = document.createElement("span");
      content.className = "ln-content";
      content.textContent = line || " ";
      lineDiv.appendChild(gutter);
      lineDiv.appendChild(content);
      el.appendChild(lineDiv);
      if (draft && draft.file === file.path && draft.lineNumber === lineNumber) {
        const editorContainer = document.createElement("div");
        editorContainer.className = "line-comment-editor";
        const labelDiv = document.createElement("div");
        labelDiv.className = "line-comment-label";
        labelDiv.textContent = `${t4("changes.commentLabel")} ${lineNumber}`;
        const textarea = document.createElement("textarea");
        textarea.className = "line-comment-textarea";
        textarea.placeholder = t4("changes.commentPlaceholder");
        textarea.rows = 2;
        textarea.value = draft.content;
        let isComposing = false;
        textarea.addEventListener("compositionstart", () => {
          isComposing = true;
        });
        textarea.addEventListener("compositionend", (e3) => {
          isComposing = false;
          if (onCommentChange) onCommentChange(e3.target.value);
        });
        textarea.addEventListener("input", (e3) => {
          if (!isComposing && onCommentChange) onCommentChange(e3.target.value);
        });
        textarea.addEventListener("keydown", (e3) => {
          if (e3.key === "Escape" && onCancelComment) {
            e3.preventDefault();
            onCancelComment();
          } else if (e3.key === "Enter" && e3.ctrlKey && onSubmitComment) {
            e3.preventDefault();
            onSubmitComment();
          }
        });
        const actionsDiv = document.createElement("div");
        actionsDiv.className = "line-comment-actions";
        actionsDiv.style.cssText = "display:flex;gap:4px;justify-content:flex-end;";
        const cancelBtn = document.createElement("button");
        cancelBtn.className = "btn ghost";
        cancelBtn.textContent = t4("changes.commentCancel");
        cancelBtn.style.cssText = "background:transparent;border:none;color:#6e7681;padding:3px 8px;font-size:11px;cursor:pointer;";
        cancelBtn.addEventListener("click", () => {
          if (onCancelComment) onCancelComment();
        });
        const submitBtn = document.createElement("button");
        submitBtn.className = "btn primary";
        submitBtn.textContent = t4("changes.commentSubmit");
        submitBtn.style.cssText = "background:#79c0ff;color:#0a0c10;border:none;padding:3px 8px;font-size:11px;cursor:pointer;border-radius:2px;font-weight:600;";
        submitBtn.disabled = !draft.content.trim();
        submitBtn.addEventListener("click", () => {
          if (onSubmitComment) onSubmitComment();
        });
        actionsDiv.appendChild(cancelBtn);
        actionsDiv.appendChild(submitBtn);
        editorContainer.appendChild(labelDiv);
        editorContainer.appendChild(textarea);
        editorContainer.appendChild(actionsDiv);
        el.appendChild(editorContainer);
        setTimeout(() => textarea.focus(), 0);
      }
      if (hasComments) {
        lineComments.forEach((comment) => {
          if (el.querySelector(`.line-comment-bubble[data-id="${comment.id}"]`)) return;
          const isEditing = draft && draft.editingId === comment.id;
          if (isEditing) return;
          const bubbleDiv = document.createElement("div");
          bubbleDiv.className = "line-comment-bubble";
          bubbleDiv.dataset.id = comment.id;
          const contentDiv = document.createElement("div");
          contentDiv.className = "bubble-content";
          contentDiv.textContent = comment.content;
          const footerDiv = document.createElement("div");
          footerDiv.className = "bubble-footer";
          const lineSpan = document.createElement("span");
          lineSpan.className = "bubble-line";
          lineSpan.textContent = `\u8BC4\u8BBA\u7B2C ${comment.lineNumber} \u884C`;
          const actionsDiv = document.createElement("div");
          actionsDiv.className = "bubble-actions";
          actionsDiv.style.display = "flex";
          actionsDiv.style.gap = "4px";
          if (onEditComment) {
            const editBtn = document.createElement("button");
            editBtn.className = "bubble-btn";
            editBtn.textContent = "\u7F16\u8F91";
            editBtn.style.cssText = "background:transparent;border:none;color:#6e7681;padding:3px 8px;font-size:11px;cursor:pointer;border-radius:2px;";
            editBtn.addEventListener("click", (e3) => {
              e3.stopPropagation();
              onEditComment(comment.id, comment.content);
            });
            actionsDiv.appendChild(editBtn);
          }
          if (onDeleteComment) {
            const deleteBtn = document.createElement("button");
            deleteBtn.className = "bubble-btn danger";
            deleteBtn.textContent = "\u5220\u9664";
            deleteBtn.style.cssText = "background:transparent;border:none;color:#6e7681;padding:3px 8px;font-size:11px;cursor:pointer;border-radius:2px;";
            deleteBtn.addEventListener("click", (e3) => {
              e3.stopPropagation();
              onDeleteComment(comment.id);
            });
            actionsDiv.appendChild(deleteBtn);
          }
          footerDiv.appendChild(lineSpan);
          footerDiv.appendChild(actionsDiv);
          bubbleDiv.appendChild(contentDiv);
          bubbleDiv.appendChild(footerDiv);
          el.appendChild(bubbleDiv);
        });
      }
    });
    if (hljs) {
      const codeEl = codeRef.current;
      if (codeEl) {
        codeEl.querySelectorAll(".ln-content").forEach((span) => {
          const text = span.textContent ?? "";
          try {
            const result = hljs.highlight(text, { language: file.language, ignoreIllegals: true });
            span.innerHTML = result.value;
          } catch {
            span.textContent = text;
          }
        });
      }
    }
  }, [file, comments, draft]);
  y2(() => {
    if (!codeRef.current || !file) return;
    const anchors = codeRef.current.querySelectorAll(".line-comment-anchor");
    anchors.forEach((anchor) => {
      const lineDiv = anchor.closest(".editor-line");
      if (!lineDiv) return;
      const lineNumber = parseInt(lineDiv.dataset.lineNumber || "0", 10);
      const isVisible = hoveredLine === lineNumber && (!draft || draft.file !== file.path || draft.lineNumber !== lineNumber);
      anchor.style.opacity = isVisible ? "1" : "0";
      anchor.style.pointerEvents = isVisible ? "auto" : "none";
    });
  }, [hoveredLine, draft, file]);
  if (!file) {
    return html6`
      <div class="editor-area" style=${{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div class="empty">${t4("changes.viewerPlaceholder")}</div>
      </div>
    `;
  }
  return html6`
    <div class="editor-area" ref=${codeRef} />
    <div class="editor-status">
      <span class="glyph">◆</span>
      <span class="v">${file.name}</span>
      <span class="grow"></span>
      <span>${file.language}</span>
      <span class="v">${String(file.content.split("\n").length)} lines</span>
    </div>
  `;
}
function ChatPane(props) {
  useLang();
  const [messages, setMessages] = d2([]);
  const [streaming, setStreaming] = d2(null);
  const [activeTool, setActiveTool] = d2(null);
  const [busy, setBusy] = d2(false);
  const [input, setInput] = d2("");
  const [error, setError] = d2(null);
  const [statusLine, setStatusLine] = d2(null);
  const [stats, setStats] = d2(null);
  const [model, setModel] = d2(null);
  const [todos, setTodos] = d2([]);
  const [todoExpanded, setTodoExpanded] = d2(false);
  const executionStateRef = A2(null);
  if (executionStateRef.current === null) executionStateRef.current = createDashboardReducerState();
  const activeSessionIdRef = A2(null);
  const resyncingRef = A2(false);
  const shouldAutoScroll = A2(true);
  const feedRef = A2(null);
  const streamBufRef = A2(null);
  const streamRafRef = A2(null);
  const autoScrollInFlight = A2(false);
  const [slashCommands, setSlashCommands] = d2([]);
  const [popoverKind, setPopoverKind] = d2(null);
  const [popoverItems, setPopoverItems] = d2([]);
  const [popoverSel, setPopoverSel] = d2(0);
  y2(() => {
    let cancelled = false;
    (async () => {
      try {
        const r3 = await api("/slash");
        if (!cancelled) setSlashCommands(r3.commands);
      } catch {
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  y2(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api("/messages");
        if (!cancelled) {
          const snapshotState = data.snapshot
            ? createDashboardReducerStateFromSnapshot(data.snapshot)
            : createDashboardReducerState();
          activeSessionIdRef.current = String(data.snapshot?.sessionId ?? "").trim() || null;
          executionStateRef.current = snapshotState;
          setMessages(data.snapshot
            ? mergeSnapshotToolsIntoMessages(
              mergeCanonicalMessagePage(data.messages, snapshotState.messages),
              Object.values(snapshotState.tools),
            )
            : data.messages ?? []);
          setBusy(data.snapshot ? snapshotState.busy : Boolean(data.busy));
          setTodos(Object.values(snapshotState.todos));
        }
      } catch {
        if (!cancelled) setMessages([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  y2(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const data = await api("/overview");
        if (cancelled) return;
        setStats(data.stats ?? null);
        setModel(data.model ?? null);
      } catch {
      }
    };
    tick();
    const unsubscribe = subscribeSse("overview", (data) => {
      if (cancelled) return;
      setStats(data.stats ?? null);
      setModel(data.model ?? null);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);
  const flushStreaming = q2(() => {
    streamRafRef.current = null;
    if (streamBufRef.current) setStreaming(streamBufRef.current);
  }, []);
  const cancelStreamingRaf = q2(() => {
    if (streamRafRef.current !== null) {
      clearTimeout(streamRafRef.current);
      streamRafRef.current = null;
    }
    streamBufRef.current = null;
  }, []);
  const refetchCanonicalState = q2(async () => {
    try {
      const data = await api("/messages");
      const snapshotState = data.snapshot
        ? createDashboardReducerStateFromSnapshot(data.snapshot)
        : createDashboardReducerState();
      activeSessionIdRef.current = String(data.snapshot?.sessionId ?? "").trim() || null;
      setMessages(data.snapshot
        ? mergeSnapshotToolsIntoMessages(
          mergeCanonicalMessagePage(data.messages, snapshotState.messages),
          Object.values(snapshotState.tools),
        )
        : data.messages ?? []);
      setBusy(data.snapshot ? snapshotState.busy : Boolean(data.busy));
      setTodos(Object.values(snapshotState.todos));
      cancelStreamingRaf();
      setStreaming(null);
      setActiveTool(null);
      executionStateRef.current = snapshotState;
    } catch {
    }
  }, [cancelStreamingRaf]);
  y2(() => {
    const requestResync = () => {
      if (resyncingRef.current) return;
      resyncingRef.current = true;
      void refetchCanonicalState().finally(() => {
        resyncingRef.current = false;
      });
    };
    const onDash = (dash) => {
      if (dash.kind === "ping") return;
      const dashSessionId = String(dash.sessionId ?? "").trim();
      const activeSessionId = activeSessionIdRef.current;
      if (dashSessionId && activeSessionId && dashSessionId !== activeSessionId) return;
      if (dash.kind === "resync-required") {
        requestResync();
        return;
      }
      const reduced = reduceDashboardEvent(executionStateRef.current, dash);
      executionStateRef.current = reduced.state;
      if (reduced.duplicate) return;
      if (reduced.resyncRequired) {
        requestResync();
        return;
      }
      if (dash.kind === "todo-update") setTodos(Object.values(reduced.state.todos));
      if (dash.kind === "busy-change") {
        setBusy(reduced.state.busy);
        return;
      }
      if (dash.kind === "user") {
        const projectedMessage = reduced.state.messages[String(dash.id ?? dash.messageId ?? "")];
        if (!projectedMessage) return;
        setMessages((prev) => prev.some((item) => String(item?.id ?? "") === String(projectedMessage.id)) ? prev : [...prev, projectedMessage]);
        return;
      }
      if (dash.kind === "assistant_delta") {
        if (dash.streamReset === true) {
          cancelStreamingRaf();
          streamBufRef.current = null;
        }
        const cur = streamBufRef.current;
        const baseId = cur?.id === dash.id ? cur : null;
        streamBufRef.current = {
          id: dash.id,
          text: (baseId?.text ?? "") + (dash.contentDelta ?? ""),
          reasoning: (baseId?.reasoning ?? "") + (dash.reasoningDelta ?? "")
        };
        if (streamRafRef.current === null) {
          streamRafRef.current = setTimeout(flushStreaming, 75);
        }
        return;
      }
      if (dash.kind === "assistant_content_final" || dash.kind === "assistant_final" || dash.kind === "turn_finalized") {
        const projectedMessage = reduced.state.messages[String(dash.id ?? dash.messageId ?? "")];
        if (!projectedMessage) return;
        cancelStreamingRaf();
        setStreaming(null);
        const nextMessage = projectedMessage;
        setMessages((prev) => {
          const index = prev.findIndex((item) => String(item?.id ?? "") === String(projectedMessage.id ?? ""));
          if (index < 0) return [...prev, nextMessage];
          const copy = [...prev];
          copy[index] = { ...copy[index], ...nextMessage };
          return copy;
        });
        return;
      }
      if (dash.kind === "tool_start") {
        const projectedTool = Object.values(reduced.state.tools).find((tool) => String(tool.toolCallId ?? tool.id ?? "") === String(dash.toolCallId ?? dash.id ?? "") && String(tool.turnId ?? "") === String(dash.turnId ?? "") && String(tool.stepId ?? "") === String(dash.stepId ?? ""));
        if (!projectedTool) return;
        setActiveTool(projectedTool);
        return;
      }
      if (dash.kind === "tool") {
        const projectedTool = Object.values(reduced.state.tools).find((tool) => String(tool.toolCallId ?? tool.id ?? "") === String(dash.toolCallId ?? dash.id ?? "") && String(tool.turnId ?? "") === String(dash.turnId ?? "") && String(tool.stepId ?? "") === String(dash.stepId ?? ""));
        if (!projectedTool) return;
        setActiveTool((cur) => cur && String(cur.id ?? "") === String(projectedTool.id ?? "") ? null : cur);
        const nextTool = { ...projectedTool, role: "tool", text: projectedTool.content ?? "", toolArgs: projectedTool.args, toolStatus: projectedTool.status ?? projectedTool.state };
        setMessages((prev) => {
          const index = prev.findIndex((item) => String(item?.id ?? "") === String(projectedTool.id ?? ""));
          if (index < 0) return [...prev, nextTool];
          const copy = [...prev];
          copy[index] = { ...copy[index], ...nextTool };
          return copy;
        });
        return;
      }
      if (dash.kind === "warning" || dash.kind === "error" || dash.kind === "info") {
        if (dash.kind === "error") setActiveTool(null);
        setMessages((prev) => [...prev, { id: dash.id, role: dash.kind, text: dash.text }]);
        return;
      }
      if (dash.kind === "status") {
        setStatusLine(dash.text);
        setTimeout(() => setStatusLine((cur) => cur === dash.text ? null : cur), 5e3);
        return;
      }
      if (dash.kind === "config-changed") {
        api("/overview").then((data) => {
          setStats(data.stats ?? null);
          setModel(data.model ?? null);
        }).catch(() => {});
        return;
      }
      if (dash.kind === "todo-update") {
        return;
      }
    };
    const unsubscribe = subscribeSse("*", onDash);
    const unsubscribeStatus = subscribeSseStatus(({ connected, reconnected }) => {
      if (connected && reconnected) void refetchCanonicalState();
      if (!connected) {
        setError(t4("chat.eventStreamError"));
        setTimeout(() => setError(null), 3e3);
      }
    });
    return () => {
      unsubscribe();
      unsubscribeStatus();
      cancelStreamingRaf();
    };
  }, [refetchCanonicalState, cancelStreamingRaf]);
  y2(() => {
    if (!shouldAutoScroll.current) return;
    const el = feedRef.current;
    if (!el) return;
    autoScrollInFlight.current = true;
    el.scrollTop = el.scrollHeight;
    setTimeout(() => {
      autoScrollInFlight.current = false;
    }, 0);
  }, [messages, streaming]);
  y2(() => {
    const el = feedRef.current;
    if (!el) return;
    const onScroll = () => {
      if (autoScrollInFlight.current) return;
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      shouldAutoScroll.current = distFromBottom < 80;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);
  const updatePopover = q2(
    async (text) => {
      const slashMatch = /^\/([A-Za-z0-9_-]*)$/.exec(text);
      if (slashMatch) {
        const prefix = slashMatch[1].toLowerCase();
        const items = slashCommands.filter((c3) => c3.cmd.startsWith(prefix)).slice(0, 12).map((c3) => ({
          label: `/${c3.cmd}`,
          meta: (() => { const k = "chat.slashHints." + c3.cmd; const v = t4(k); return v === k ? c3.summary : v; })(),
          insert: `/${c3.cmd}${c3.argsHint ? " " : ""}`
        })).sort((a, b) => a.label === "/help" ? -1 : b.label === "/help" ? 1 : a.label.localeCompare(b.label));
        setPopoverKind("slash");
        setPopoverItems(items);
        setPopoverSel(0);
        return;
      }
      setPopoverKind(null);
    },
    [slashCommands]
  );
  const applyPopover = q2((idx) => {
    const item = popoverItems[idx ?? popoverSel];
    if (!item) return false;
    setInput(item.insert);
    setPopoverKind(null);
    return true;
  }, [popoverItems, popoverSel, popoverKind, input]);
  const onInput = q2(
    (e3) => {
      const v3 = e3.target.value;
      setInput(v3);
      updatePopover(v3);
    },
    [updatePopover]
  );
  const send = q2(async () => {
    const text = input.trim();
    if (busy) return;
    if (!text && props.comments.length === 0) return;
    setError(null);
    let prompt = text;
    if (props.comments.length > 0) {
      const commentRefs = props.comments.map((c3) => `\u{1F4DD} ${c3.file}:${c3.lineNumber} ${c3.content}`).join("\n");
      prompt = text ? `${text}

${commentRefs}` : commentRefs;
    }
    try {
      const res = await api("/submit", {
        method: "POST",
        body: { prompt }
      });
      if (!res.accepted) {
        setError(res.reason ?? "rejected");
        return;
      }
      setInput("");
      props.comments.forEach((c3) => props.deleteComment(c3.id));
    } catch (err) {
      setError(err.message);
    }
  }, [input, busy, props.comments]);
  const abort = q2(async () => {
    try {
      await api("/abort", { method: "POST" });
    } catch {
    }
  }, []);
  const newConversation = q2(async () => {
    if (busy) {
      if (!confirm(t4("changes.newConfirmBusy"))) return;
    } else if (messages.length > 0 && !confirm(t4("changes.newConfirm"))) {
      return;
    }
    try {
      await api("/submit", { method: "POST", body: { prompt: "/new" } });
      setMessages([]);
      setStreaming(null);
      setActiveTool(null);
      showToast(t4("changes.newToast"), "info");
      setTimeout(async () => {
        try {
          const r3 = await api("/messages");
          setMessages(r3.messages ?? []);
        } catch {
        }
      }, 200);
    } catch (err) {
      setError(t4("changes.newFailed", { error: err.message }));
    }
  }, [busy, messages.length]);
  const clearScrollback = q2(async () => {
    try {
      await api("/submit", { method: "POST", body: { prompt: "/clear" } });
      setMessages([]);
      setStreaming(null);
      setActiveTool(null);
      showToast(t4("changes.clearToast"), "info");
      setTimeout(async () => {
        try {
          const r3 = await api("/messages");
          setMessages(r3.messages ?? []);
        } catch {
        }
      }, 200);
    } catch (err) {
      setError(t4("changes.clearFailed", { error: err.message }));
    }
  }, []);
  const onKeyDown = q2((e3) => {
    if (popoverKind && popoverItems.length > 0) {
      if (e3.key === "ArrowDown") {
        e3.preventDefault();
        setPopoverSel((i3) => (i3 + 1) % popoverItems.length);
        return;
      }
      if (e3.key === "ArrowUp") {
        e3.preventDefault();
        setPopoverSel((i3) => (i3 - 1 + popoverItems.length) % popoverItems.length);
        return;
      }
      if (e3.key === "Tab" || e3.key === "Enter" && !e3.shiftKey) {
        e3.preventDefault();
        if (applyPopover() && e3.key === "Enter" && popoverKind === "slash") send();
        return;
      }
      if (e3.key === "Escape") {
        e3.preventDefault();
        setPopoverKind(null);
        return;
      }
    }
    if (e3.key === "Escape" && busy) {
      e3.preventDefault();
      abort();
      return;
    }
    if (e3.key === "Enter" && !e3.shiftKey) {
      e3.preventDefault();
      send();
    }
  }, [send, abort, busy, popoverKind, popoverItems, applyPopover]);
  const allMessages = streaming ? [...messages, { id: streaming.id, role: "assistant", text: streaming.text, reasoning: streaming.reasoning }] : messages;
  return html6`
    <div style=${{ display: "flex", flexDirection: "column", height: "100%" }}>
      ${statusLine ? html6`<div class="changes-panel-header"><span>${statusLine}</span></div>` : null}
      <div class="chat-feed" style=${{ flex: 1, overflowY: "auto", padding: "8px" }} ref=${feedRef}>
        ${allMessages.length === 0 && !streaming ? html6`<div class="empty" style=${{ margin: "12px", textAlign: "center" }}>${t4("changes.chatWelcome")}</div>` : null}
        ${allMessages.map((msg) => {
    const isStreaming = streaming && msg.id === streaming.id;
    if (msg.role === "tool") {
      return html6`
              <div class="chat-msg tool" key=${msg.id}>
                <div class="glyph">▣</div>
                <${ToolCard} msg=${msg} />
              </div>
            `;
    }
    return html6`
            <${ChatMessage}
              key=${msg.id}
              msg=${{ id: msg.id, role: msg.role, text: msg.text, reasoning: msg.reasoning, toolName: msg.toolName, toolArgs: msg.toolArgs }}
              streaming=${Boolean(isStreaming)}
            />
          `;
  })}
      </div>
      ${error ? html6`<div class="notice err" style=${{ margin: "0 8px 4px" }}>${error}</div>` : null}
      ${todos.length > 0 ? html6`<${TodoBar} todos=${todos} expanded=${todoExpanded} onToggle=${() => setTodoExpanded(!todoExpanded)} />` : null}
      <div style=${{ padding: "8px", borderTop: "1px solid var(--bd)", flexShrink: 0 }}>
        ${props.comments.length > 0 ? html6`
          <div class="comment-cards-container" style=${{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
            ${props.comments.map((comment) => html6`
              <${CommentCard}
                key=${comment.id}
                fileName=${comment.file}
                lineNumber=${comment.lineNumber}
                content=${comment.content}
                onRemove=${() => props.deleteComment(comment.id)}
              />
            `)}
          </div>
        ` : null}
        <div style=${{ display: "flex", gap: "8px", alignItems: "flex-end", position: "relative" }}>
          <div style=${{ flex: 1, position: "relative" }}>
            ${popoverKind && popoverItems.length > 0 ? html6`
                  <div class="popover" style="position:absolute;bottom:calc(100% + 6px);left:0;width:380px;max-height:280px;overflow-y:auto;z-index:10">
                    <div class="popover-h">${t4("chat.slashCommands")}</div>
                    ${popoverItems.map(
    (it, i3) => html6`
                        <div
                          class=${`popover-row ${i3 === popoverSel ? "sel" : ""}`}
                          onMouseDown=${(e3) => {
      e3.preventDefault();
      setPopoverSel(i3);
      applyPopover(i3);
    }}
                        >
                          <span class="g">/</span>
                          <span class="name">${it.label}</span>
                          ${it.meta ? html6`<span class="meta">${it.meta}</span>` : null}
                        </div>
                      `
  )}
                  </div>
                ` : null}
            <textarea
              class="input"
              style=${{ width: "100%", resize: "none", minHeight: "36px", fontFamily: "inherit", fontSize: "13px", padding: "8px 10px", lineHeight: "1.4", background: "var(--bg-input)", border: "1px solid var(--bd)", borderRadius: "4px", color: "var(--fg-0)" }}
              placeholder=${props.comments.length > 0 ? "\u603B\u7ED3\u8BC4\u8BBA..." : t4("changes.chatPlaceholder")}
              value=${input}
              onInput=${onInput}
              onKeyDown=${onKeyDown}
              onBlur=${() => setTimeout(() => setPopoverKind(null), 150)}
              rows="2"
            />
          </div>
          <div style=${{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
            <button class="primary" onClick=${send} disabled=${busy || !input.trim() && props.comments.length === 0} style=${{ padding: "8px 12px", borderRadius: "4px" }}>${t4("changes.chatSend")}</button>
            <div style=${{ display: "flex", gap: "6px" }}>
              <button onClick=${newConversation} title=${t4("changes.newTitle")}>${t4("changes.newConversation")}</button>
              <button onClick=${clearScrollback} title=${t4("changes.clearTitle")}>${t4("changes.clearConversation")}</button>
            </div>
          </div>
        </div>
      </div>
      <${ChatStatusBar3} stats=${stats} model=${model} />
    </div>
  `;
}

// dashboard/app.js

export { ChangesPanel };
