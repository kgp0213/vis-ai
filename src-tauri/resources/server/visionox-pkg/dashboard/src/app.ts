// Recovered from the product bundle; types are tightened incrementally without changing behavior.
// @ts-nocheck
import htm_module_default from "htm";
import { h as k, render as R } from "preact";
import { useCallback as q2, useEffect as y2, useRef as A2, useState as d2 } from "preact/hooks";
import { TOKEN, api, writeClipboardText } from "./lib/api.js";
import { ToastStack, appBus } from "./lib/bus.js";
import { ErrorBoundary, ErrorOverlay } from "./lib/error-boundary.js";
import { initLangFromServer, t as t4, useLang } from "./i18n/index.js";
import { ChatPanel, FilesPanel, openMarkdownDocumentByPicker } from "./panels/chat.js";
import { ChangesPanel } from "./panels/changes.js";
import { HooksPanel } from "./panels/hooks.js";
import { McpPanel } from "./panels/mcp.js";
import { MemoryPanel } from "./panels/memory.js";
import { OverviewPanel } from "./panels/overview.js";
import { PermissionsPanel } from "./panels/permissions.js";
import { PlansPanel } from "./panels/plans.js";
import { ReportsPanel } from "./panels/reports.js";
import { SemanticPanel } from "./panels/semantic.js";
import { SessionsPanel } from "./panels/sessions.js";
import { SettingsPanel } from "./panels/settings.js";
import { SkillsPanel } from "./panels/skills.js";
import { SystemPanel } from "./panels/system.js";
import { ScheduledTasksPanel } from "./panels/tasks.js";
import { ToolsPanel } from "./panels/tools.js";
import { UsagePanel } from "./panels/usage.js";
import { subscribeSse, usePoll } from "./lib/use-poll.js";
import { CmdPalette, Select } from "./ui/index.js";

var html7 = htm_module_default.bind(k);
function tabSections(userAvatar = null, workspaceRoot = null) {
  return [
    {
      label: t4("app.sectionWorkspace"),
      tabs: [
        { id: "chat", name: t4("app.tabChat"), glyph: "\u25C6", panel: () => html7`<${ChatPanel} userAvatar=${userAvatar} />` },
        { id: "sessions", name: t4("app.tabSessions"), glyph: "\u203A", panel: () => html7`<${SessionsPanel} userAvatar=${userAvatar} />` },
        { id: "files", name: t4("app.tabFiles"), glyph: "F", panel: () => html7`<${FilesPanel} />` },
        { id: "tasks", name: t4("app.tabTasks"), glyph: "T", panel: () => html7`<${ScheduledTasksPanel} />` },
        { id: "overview", name: t4("app.tabOverview"), glyph: "\u25C8", panel: () => html7`<${OverviewPanel} />` }
      ]
    },
    {
      label: t4("app.sectionConfigure"),
      tabs: [
        // ChangesPanel is hidden because it duplicates the main chat, exposes developer-only Git/checkpoint restore actions, and its session diff source is not implemented.
        // Keep the panel and APIs for now; a future replacement should be a read-only "session changes" summary with file-level explanations and previews.
        { id: "memory", name: t4("app.tabMemory"), glyph: "\xB7", panel: () => html7`<${MemoryPanel} />`, breakBefore: true },
        { id: "skills", name: t4("app.tabSkills"), glyph: "S", panel: () => html7`<${SkillsPanel} />` },
        { id: "tools", name: t4("app.tabTools"), glyph: "\u25A3", panel: () => html7`<${ToolsPanel} />` },
        { id: "mcp", name: t4("app.tabMcp"), glyph: "M", panel: () => html7`<${McpPanel} />`, breakBefore: true },
        { id: "semantic", name: t4("app.tabSemantic"), glyph: "\u2248", panel: () => html7`<${SemanticPanel} key=${workspaceRoot ?? "detached"} />` },
        { id: "hooks", name: t4("app.tabHooks"), glyph: "H", panel: () => html7`<${HooksPanel} />` },
        { id: "permissions", name: t4("app.tabPermissions"), glyph: "\u258E", panel: () => html7`<${PermissionsPanel} />`, breakBefore: true },
        // SystemPanel is retained for diagnostics, but its standalone navigation is hidden because Overview now presents the high-value health summary.
        { id: "settings", name: t4("app.tabSettings"), glyph: "\u2318", panel: () => html7`<${SettingsPanel} />` }
      ]
    }
  ];
}
function formatVHomeCountdown(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
function vhomeLoginFailureMessage(login) {
  if (login?.message) return login.message;
  const messages = {
    "dws-not-found": t4("appPanel.loginDwsNotFound"),
    "login-start-failed": t4("appPanel.loginStartFailed"),
    "login-network-failed": t4("appPanel.loginNetworkFailed"),
    "login-tls-failed": t4("appPanel.loginTlsFailed"),
    "login-permission-denied": t4("appPanel.loginPermissionDenied"),
    "login-command-unsupported": t4("appPanel.loginCommandUnsupported"),
    "login-timeout": t4("appPanel.loginTimeout"),
    "login-link-unavailable": t4("appPanel.loginLinkUnavailable"),
    "authentication-required": t4("appPanel.loginAuthRequired"),
    "identity-unavailable": t4("appPanel.loginIdentityUnavailable"),
    "communication-failed": t4("appPanel.loginCommunicationFailed")
  };
  return messages[login?.reason] ?? t4("appPanel.loginIncomplete");
}
function App() {
  useLang();
  y2(() => {
    initLangFromServer();
  }, []);
  const { data: vhomeStatus, refresh: refreshVHome, replaceData: replaceVHomeStatus } = usePoll("/vhome/status", 3e5);
  const [vhomeMenuOpen, setVhomeMenuOpen] = d2(false);
  const [vhomeBusy, setVhomeBusy] = d2(false);
  const [vhomeError, setVhomeError] = d2(null);
  const [vhomeOpenFallback, setVhomeOpenFallback] = d2(false);
  const [vhomeCopyStatus, setVhomeCopyStatus] = d2(null);
  const [vhomeRemainingSeconds, setVhomeRemainingSeconds] = d2(null);
  const [wsRoot, setWsRoot] = d2(null);
  const [buildDate2, setBuildDate] = d2(null);
  const vhomeControlRef = A2(null);
  const [activeId, setActiveId] = d2(() => {
    try {
      return localStorage.getItem("rx.activeTab") ?? "chat";
    } catch {
      return "chat";
    }
  });
  const [sidebarCollapsed, setSidebarCollapsed] = d2(() => {
    try {
      return localStorage.getItem("rx.sidebarCollapsed") === "1";
    } catch {
      return false;
    }
  });
  y2(() => {
    try {
      localStorage.setItem("rx.sidebarCollapsed", sidebarCollapsed ? "1" : "0");
    } catch {
    }
  }, [sidebarCollapsed]);
  y2(() => {
    try {
      localStorage.setItem("rx.activeTab", activeId);
    } catch {
    }
  }, [activeId]);
  const vhomeAvatarUrl = vhomeStatus?.connected === true
    ? `/api/vhome/avatar?token=${encodeURIComponent(TOKEN)}&v=${encodeURIComponent(vhomeStatus.checkedAt ?? "")}`
    : null;
  const TAB_SECTIONS = tabSections(vhomeAvatarUrl, wsRoot);
  const [openSections, setOpenSections] = d2(() => {
    let stored = [0];
    try {
      const parsed = JSON.parse(localStorage.getItem("rx.openSections") ?? "[0]");
      if (Array.isArray(parsed)) stored = parsed.filter((index) => Number.isInteger(index) && index >= 0 && index < TAB_SECTIONS.length);
    } catch {
    }
    const activeSection = TAB_SECTIONS.findIndex((section) => section.tabs.some((tab) => tab.id === activeId));
    if (activeSection >= 0 && !stored.includes(activeSection)) stored.push(activeSection);
    return new Set(stored);
  });
  y2(() => {
    try {
      localStorage.setItem("rx.openSections", JSON.stringify([...openSections]));
    } catch {
    }
  }, [openSections]);
  y2(() => {
    const activeSection = tabSections().findIndex((section) => section.tabs.some((tab) => tab.id === activeId));
    if (activeSection < 0) return;
    setOpenSections((current) => current.has(activeSection) ? current : new Set([...current, activeSection]));
  }, [activeId]);
  const toggleSection = q2((idx) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);
  y2(() => {
    const unsub = subscribeSse("health", (ev) => {
      setWsRoot(ev.cwd ?? null);
      setBuildDate(ev.buildDate ?? null);
    });
    return unsub;
  }, []);
  const ALL_TABS = TAB_SECTIONS.flatMap((s3) => s3.tabs);
  const active = ALL_TABS.find((t5) => t5.id === activeId) ?? ALL_TABS[0];
  const vhomeConnected = vhomeStatus?.connected === true && Boolean(vhomeStatus.userName);
  const vhomeLoginState = vhomeStatus?.login?.state ?? "idle";
  const vhomeLoginActive = ["starting", "awaiting-user", "completing"].includes(vhomeLoginState);
  const vhomeLoginUrl = vhomeStatus?.login?.loginUrl ?? null;
  const vhomeLoginFailure = vhomeLoginState === "failed" ? vhomeLoginFailureMessage(vhomeStatus?.login) : null;
  const vhomeLoginDetail = vhomeLoginState === "failed" ? vhomeStatus?.login?.detail ?? null : null;
  const vhomeAuthorizationReady = Boolean(vhomeLoginUrl || vhomeStatus?.login?.userCode);
  const vhomeLoginPreparing = vhomeLoginState === "starting" && !vhomeAuthorizationReady;
  const sidebarIdentity = vhomeConnected ? vhomeStatus.userName : "127.0.0.1";
  const sidebarIdentityTitle = vhomeConnected ? `${vhomeStatus.userName}${vhomeStatus.corpName ? ` · ${vhomeStatus.corpName}` : ""}` : t4("appPanel.localIdentity");
  const vhomeControlText = vhomeConnected ? t4("appPanel.vhomeConnected") : vhomeLoginPreparing ? t4("appPanel.vhomePreparing") : vhomeLoginActive ? t4("appPanel.vhomeWaiting") : t4("appPanel.vhomeLogin");
  const vhomeLoginExpiresAt = vhomeStatus?.login?.expiresAt ?? null;
  const vhomeLoginExpired = vhomeRemainingSeconds === 0;
  y2(() => {
    if (!vhomeLoginExpiresAt) {
      setVhomeRemainingSeconds(null);
      return;
    }
    const update = () => setVhomeRemainingSeconds(Math.max(0, Math.ceil((Date.parse(vhomeLoginExpiresAt) - Date.now()) / 1e3)));
    update();
    const timer = setInterval(update, 1e3);
    return () => clearInterval(timer);
  }, [vhomeLoginExpiresAt]);
  const finishVHomeLogin = q2((nextStatus) => {
    const nextLoginState = nextStatus?.login?.state ?? "idle";
    if (nextStatus?.connected === true || nextStatus?.connected === false && nextLoginState === "idle") {
      setVhomeMenuOpen(false);
    }
  }, []);
  y2(() => {
    finishVHomeLogin(vhomeStatus);
  }, [vhomeStatus, finishVHomeLogin]);
  y2(() => {
    if (!vhomeLoginActive) return;
    const timer = setInterval(() => {
      void refreshVHome().then(finishVHomeLogin);
    }, 1e3);
    return () => clearInterval(timer);
  }, [vhomeLoginActive, refreshVHome, finishVHomeLogin]);
  const startVHomeLogin = q2(async () => {
    setVhomeBusy(true);
    setVhomeError(null);
    setVhomeOpenFallback(false);
    setVhomeCopyStatus(null);
    setVhomeMenuOpen(true);
    try {
      const nextStatus = await api("/vhome/login", { method: "POST", body: {} });
      replaceVHomeStatus(nextStatus);
      setVhomeMenuOpen(true);
      finishVHomeLogin(nextStatus);
    } catch (error) {
      setVhomeError(error.message || t4("appPanel.errLoginStart"));
    } finally {
      setVhomeBusy(false);
    }
  }, [replaceVHomeStatus, finishVHomeLogin]);
  const restartVHomeLogin = q2(async () => {
    setVhomeBusy(true);
    setVhomeError(null);
    setVhomeOpenFallback(false);
    setVhomeCopyStatus(null);
    try {
      await api("/vhome/login", { method: "DELETE", body: {} });
      const nextStatus = await api("/vhome/login", { method: "POST", body: {} });
      replaceVHomeStatus(nextStatus);
      setVhomeMenuOpen(true);
    } catch (error) {
      setVhomeError(error.message || t4("appPanel.errRegenLink"));
    } finally {
      setVhomeBusy(false);
    }
  }, [replaceVHomeStatus]);
  const cancelVHomeLogin = q2(async () => {
    setVhomeBusy(true);
    setVhomeError(null);
    try {
      const nextStatus = await api("/vhome/login", { method: "DELETE", body: {} });
      replaceVHomeStatus(nextStatus);
      setVhomeMenuOpen(false);
    } catch (error) {
      setVhomeError(error.message || t4("appPanel.errCancelLogin"));
    } finally {
      setVhomeBusy(false);
    }
  }, [replaceVHomeStatus]);
  const logoutVHome = q2(async () => {
    if (!window.confirm(t4("appPanel.logoutConfirm"))) return;
    setVhomeBusy(true);
    setVhomeError(null);
    try {
      const nextStatus = await api("/vhome/logout", { method: "POST", body: {} });
      replaceVHomeStatus(nextStatus);
      setVhomeMenuOpen(false);
    } catch (error) {
      await refreshVHome();
      setVhomeError(error.message || t4("appPanel.errLogout"));
    } finally {
      setVhomeBusy(false);
    }
  }, [refreshVHome, replaceVHomeStatus]);
  const refreshVHomeNow = q2(async () => {
    setVhomeBusy(true);
    setVhomeError(null);
    try {
      const nextStatus = await api("/vhome/refresh", { method: "POST", body: {} });
      finishVHomeLogin(replaceVHomeStatus(nextStatus));
    } catch (error) {
      setVhomeError(error.message || t4("appPanel.errRefresh"));
    } finally {
      setVhomeBusy(false);
    }
  }, [replaceVHomeStatus, finishVHomeLogin]);
  const openVHomeAuthorization = q2(async (browser = "default") => {
    if (!vhomeLoginUrl) return;
    setVhomeError(null);
    try {
      await api("/open-url", { method: "POST", body: { url: vhomeLoginUrl, browser } });
    } catch (error) {
      setVhomeError(browser === "edge" ? t4("appPanel.errEdgeFailed") : t4("appPanel.errBrowserFailed"));
    } finally {
      if (browser === "default") setVhomeOpenFallback(true);
    }
  }, [vhomeLoginUrl]);
  const copyVHomeValue = q2(async (value, label) => {
    try {
      await writeClipboardText(value);
      setVhomeCopyStatus(`${label}${t4("appPanel.copiedSuffix")}`);
      setTimeout(() => setVhomeCopyStatus(null), 2e3);
    } catch (error) {
      setVhomeError(error.message || `${label}${t4("appPanel.copyFailedSuffix")}`);
    }
  }, []);
  const toggleVHomeControl = q2(() => {
    if (!vhomeConnected && !vhomeLoginActive) {
      void startVHomeLogin();
      return;
    }
    setVhomeMenuOpen((open) => !open);
  }, [vhomeConnected, vhomeLoginActive, startVHomeLogin]);
  const dismissVHomePopover = q2(() => {
    setVhomeMenuOpen(false);
    setVhomeCopyStatus(null);
  }, []);
  y2(() => {
    if (!vhomeMenuOpen) return;
    const closeOnOutside = (event) => {
      if (vhomeControlRef.current?.contains(event.target)) return;
      dismissVHomePopover();
    };
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      dismissVHomePopover();
    };
    document.addEventListener("pointerdown", closeOnOutside, true);
    document.addEventListener("keydown", closeOnEscape, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside, true);
      document.removeEventListener("keydown", closeOnEscape, true);
    };
  }, [vhomeMenuOpen, dismissVHomePopover]);
  y2(() => {
    if (active.id !== activeId) setActiveId(active.id);
  }, [active.id, activeId]);
  y2(() => {
    const onNav = (ev) => {
      const id = ev.detail?.tabId;
      if (id) setActiveId(id);
    };
    appBus.addEventListener("navigate-tab", onNav);
    return () => appBus.removeEventListener("navigate-tab", onNav);
  }, []);
  const pickTab = q2((id) => setActiveId(id), []);
  const THEMES = [
    ["indigo-night", t4("appPanel.themeIndigoNight")], ["light", t4("appPanel.themeLight")], ["dark", t4("appPanel.themeDark")],
    ["warm-sand", t4("appPanel.themeWarmSand")], ["cool-ash", t4("appPanel.themeCoolAsh")], ["soft-sage", t4("appPanel.themeSoftSage")],
    ["espresso", t4("appPanel.themeEspresso")], ["midnight-ink", t4("appPanel.themeMidnightInk")], ["deep-charcoal", t4("appPanel.themeDeepCharcoal")]
  ];
  const openMarkdown = q2(() => {
    openMarkdownDocumentByPicker();
  }, []);
  const applyTheme = q2((v) => {
    document.documentElement.setAttribute("data-theme", v);
    try { localStorage.setItem("visionox-theme", v); } catch {}
    try { document.cookie = "visionox-theme=" + encodeURIComponent(v) + ";path=/;max-age=31536000"; } catch {}
    try { if (window.parent && window.parent !== window) { window.parent.postMessage({ type: 'vis_theme_changed', theme: v }, '*'); } } catch {}
  }, []);
  const [cmdOpen, setCmdOpen] = d2(false);
  const currentTheme = (typeof document !== 'undefined' && document.documentElement.getAttribute("data-theme")) || "light";
  const cmdItems = [
    ...TAB_SECTIONS.flatMap((section) => section.tabs.map((tab) => ({
      id: `tab:${tab.id}`,
      name: tab.name,
      desc: section.label,
      glyph: tab.glyph,
      section: t4("appPanel.cmdSectionNav"),
      run: () => pickTab(tab.id)
    }))),
    ...THEMES.map(([value, label]) => ({
      id: `theme:${value}`,
      name: `${t4("appPanel.cmdThemePrefix")}${label}`,
      desc: value === currentTheme ? t4("appPanel.cmdThemeCurrent") : null,
      glyph: "◐",
      section: t4("appPanel.cmdSectionAction"),
      run: () => applyTheme(value)
    })),
    {
      id: "action:open-md",
      name: t4("appPanel.openMd"),
      desc: t4("appPanel.openMdDesc"),
      glyph: "MD",
      section: t4("appPanel.cmdSectionAction"),
      run: openMarkdown
    }
  ];
  // 全局快捷键：Cmd/Ctrl+K 切换命令面板（输入框聚焦时也生效，与主流产品一致）。
  y2(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setCmdOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return html7`
    <div class=${`app ${sidebarCollapsed ? "collapsed" : ""}`}>
      <aside class="app-side">
        <div class="brand">
          <span class="glyph">◈</span>
          <img src="/assets/v3.png" alt="" height="13" style="flex-shrink:0" />
        </div>
        <div class="side-tabs">
          ${TAB_SECTIONS.map(
    (section, i) => {
      const isOpen = openSections.has(i);
      return html7`
              <button type="button" class="side-section side-section-toggle" aria-expanded=${isOpen} onClick=${() => toggleSection(i)}>
                <span>${section.label}</span>
                <span class="side-section-chev">${isOpen ? "\u25BC" : "\u25B6"}</span>
              </button>
              ${isOpen ? html7`
                  ${section.tabs.map(
        (tab) => html7`
                      ${tab.breakBefore ? html7`<div class="side-divider"></div>` : null}
                      <button type="button"
                        class=${`side-tab ${tab.id === active.id ? "active" : ""}`}
                        onClick=${() => pickTab(tab.id)}
                        title=${tab.name}
                        aria-current=${tab.id === active.id ? "page" : null}
                      >
                        <span class="g">${tab.glyph}</span>
                        <span class="label">${tab.name}</span>
                      </button>
                    `
      )}
                  ${i === 0 ? html7`
                      <button type="button" class="side-tab" onClick=${() => api("/open-url", { method: "POST", body: { url: "https://oa.visionox.com:8086/gvo/mainPortal/index.html" } }).catch(() => {})} title="\u529E\u516C OA"><span class="g">O</span><span class="label">OA</span></button>
                      <div class="side-divider"></div>
                    ` : null}
                  ${section.label === t4("app.sectionConfigure") ? html7`
                      <button type="button" class="side-tab" onClick=${() => api("/open-url", { method: "POST", body: { url: "https://cloud.siliconflow.cn/i/1vfZWEo7" } }).catch(() => {})} title="SiliconFlow API"><span class="g">A</span><span class="label">API</span></button>
                    ` : null}
                ` : null}
            `;
    }
  )}
        </div>
        <div style="padding:6px 16px;display:flex;justify-content:flex-start">
          <${Select}
            value=${currentTheme}
            onChange=${(v) => applyTheme(v)}
            ariaLabel=${t4("appPanel.themeAria")}
            searchable
            width="100%"
            options=${THEMES.map(([value, label]) => ({ value, label }))}
          />
        </div>
        <div class="vhome-control" ref=${vhomeControlRef}>
          <button type="button"
            class=${`vhome-control-button ${vhomeConnected ? "connected" : vhomeLoginActive ? "authorizing" : ""}`}
            title=${vhomeConnected ? `${vhomeControlText} · ${vhomeStatus.corpName ?? ""}` : vhomeControlText}
            aria-expanded=${vhomeMenuOpen}
            aria-controls="vhome-connection-popover"
            disabled=${vhomeBusy}
            onClick=${toggleVHomeControl}
          >
            <span class="vhome-status-dot"></span>
            <span class="vhome-control-label">${vhomeControlText}</span>
          </button>
          ${vhomeMenuOpen ? html7`
            <div id="vhome-connection-popover" class="vhome-popover" role="dialog" aria-label=${t4("appPanel.vhomePopoverAria")}>
              <div class="vhome-popover-head">
                <div class="vhome-popover-title">${vhomeConnected ? t4("appPanel.vhomeConnected") : t4("appPanel.vhomeLogin")}</div>
                <button type="button" class="vhome-popover-close" onClick=${dismissVHomePopover} title=${t4("appPanel.closeTitle")} aria-label=${t4("appPanel.closeAria")}>×</button>
              </div>
              ${vhomeConnected ? html7`
                <div class="vhome-popover-meta">${vhomeStatus.userName}${vhomeStatus.corpName ? ` · ${vhomeStatus.corpName}` : ""}</div>
                <div class="vhome-popover-actions vhome-popover-actions-connected">
                  <button type="button" disabled=${vhomeBusy} onClick=${refreshVHomeNow}>${t4("appPanel.refreshStatus")}</button>
                  <button type="button" class="danger" disabled=${vhomeBusy} onClick=${logoutVHome}>${t4("appPanel.logoutOrg")}</button>
                </div>
              ` : html7`
                <div class="vhome-popover-meta">${vhomeLoginPreparing ? t4("appPanel.metaPreparing") : vhomeLoginState === "completing" ? t4("appPanel.metaCompleting") : vhomeLoginActive ? t4("appPanel.metaActive") : vhomeLoginFailure ?? t4("appPanel.metaDefault")}</div>
                ${vhomeStatus?.login?.userCode ? html7`
                  <div class="vhome-code-row"><span>${t4("appPanel.authCode")}</span><code>${vhomeStatus.login.userCode}</code><button type="button" onClick=${() => copyVHomeValue(vhomeStatus.login.userCode, t4("appPanel.authCode"))}>${t4("appPanel.copyBtn")}</button></div>
                ` : null}
                ${vhomeLoginUrl ? html7`
                  <div class="vhome-login-link" title=${vhomeLoginUrl}>
                    <span>login.dingtalk.com</span>
                    <button type="button" onClick=${() => copyVHomeValue(vhomeLoginUrl, t4("appPanel.authLink"))}>${t4("appPanel.copyLink")}</button>
                  </div>
                  <div class=${`vhome-popover-meta ${vhomeLoginExpired ? "vhome-popover-error" : ""}`}>
                    ${vhomeLoginExpired ? t4("appPanel.linkExpired") : vhomeRemainingSeconds === null ? t4("appPanel.browserNotOpen") : t4("appPanel.linkRemaining", { time: formatVHomeCountdown(vhomeRemainingSeconds) })}
                  </div>
                ` : null}
                ${vhomeCopyStatus ? html7`<div class="vhome-copy-status" role="status">${vhomeCopyStatus}</div>` : null}
                ${vhomeLoginDetail ? html7`<div class="vhome-popover-error" role="alert">${t4("appPanel.dwsDiag")}${vhomeLoginDetail}</div>` : null}
                <div class="vhome-popover-actions">
                  ${vhomeLoginUrl && !vhomeLoginExpired ? html7`<button type="button" class="primary" disabled=${vhomeBusy} onClick=${() => openVHomeAuthorization("default")}>${t4("appPanel.openBrowser")}</button>` : null}
                  ${vhomeLoginUrl && vhomeOpenFallback && !vhomeLoginExpired ? html7`<button type="button" disabled=${vhomeBusy} onClick=${() => openVHomeAuthorization("edge")}>${t4("appPanel.openWithEdge")}</button>` : null}
                  ${vhomeAuthorizationReady && vhomeLoginActive && !vhomeLoginExpired ? html7`<button type="button" disabled=${vhomeBusy} onClick=${refreshVHomeNow}>${t4("appPanel.authDone")}</button>` : null}
                  ${vhomeLoginExpired || vhomeLoginState === "failed" ? html7`<button type="button" class="primary" disabled=${vhomeBusy} onClick=${restartVHomeLogin}>${t4("appPanel.regenLink")}</button>` : null}
                  ${vhomeLoginActive ? html7`<button type="button" disabled=${vhomeBusy} onClick=${cancelVHomeLogin}>${t4("appPanel.cancelBtn")}</button>` : vhomeLoginState === "failed" ? null : html7`<button type="button" class="primary" disabled=${vhomeBusy} onClick=${startVHomeLogin}>${vhomeBusy ? t4("appPanel.starting") : t4("appPanel.relogin")}</button>`}
                </div>
              `}
              ${vhomeError ? html7`<div class="vhome-popover-error">${vhomeError}</div>` : null}
            </div>
          ` : null}
        </div>
        <div class="side-foot">
          <span class="label" title=${sidebarIdentityTitle}>${sidebarIdentity}</span>
          <button type="button"
            class="toggle"
            title=${sidebarCollapsed ? "\u5C55\u5F00\u5BFC\u822A\u680F" : "\u6536\u8D77\u5BFC\u822A\u680F"}
            aria-label=${sidebarCollapsed ? "\u5C55\u5F00\u5BFC\u822A\u680F" : "\u6536\u8D77\u5BFC\u822A\u680F"}
            onClick=${() => setSidebarCollapsed((c3) => !c3)}
          >${sidebarCollapsed ? "\xBB" : "\xAB"}</button>
        </div>
      </aside>
      <header class="app-top">
        <span class="ws">
          <span class="path">Visionox-Whale</span>
          <span class="sep">·</span>
          <span class="session">${t4("appPanel.oaPlatform")}</span>
        </span>
        <span class="grow"></span>
        <button type="button" class="top-action top-action-md" onClick=${openMarkdown} title=${t4("appPanel.openMdDesc")}>
          <span class="top-action-g">MD</span>
          <span class="top-action-label">${t4("appPanel.openMd")}</span>
        </button>
        <span class="meter">
          ${wsRoot ? html7`<span class="v">${wsRoot}</span>` : null}
          <span class="sep">·</span>
          <span class="lbl">@${buildDate2 && !buildDate2.startsWith("__") ? buildDate2 : (() => { const now = new Date(); return `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}`; })()}</span>
        </span>
      </header>
      <div class="app-body">
        <${ErrorBoundary}>${active.panel()}<//>
      </div>
      <footer class="app-status">
        <span class="grow"></span>
        <span class="item">${t4("app.footer")}</span>
      </footer>
    </div>
    <${CmdPalette} open=${cmdOpen} onClose=${() => setCmdOpen(false)} items=${cmdItems} />
    <${ToastStack} />
    <${ErrorOverlay} />
  `;
}
R(html7`<${App} />`, document.getElementById("root"));
if (window.parent && window.parent !== window) {
  setTimeout(() => window.parent.postMessage({ type: "vis_dashboard_ready" }, "*"), 0);
}
