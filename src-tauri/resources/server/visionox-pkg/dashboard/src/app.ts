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

var html7 = htm_module_default.bind(k);
function tabSections(userAvatar = null) {
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
        { id: "semantic", name: t4("app.tabSemantic"), glyph: "\u2248", panel: () => html7`<${SemanticPanel} />` },
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
    "communication-failed": "授权进程已结束，但无法确认 V来家连接状态，请检查网络后重试。"
  };
  return messages[login?.reason] ?? "V来家登录未完成，请根据诊断信息重试。";
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
  const TAB_SECTIONS = tabSections(vhomeAvatarUrl);
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
  const [wsRoot, setWsRoot] = d2(null);
  const [buildDate2, setBuildDate] = d2(null);
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
  const sidebarIdentityTitle = vhomeConnected ? `${vhomeStatus.userName}${vhomeStatus.corpName ? ` · ${vhomeStatus.corpName}` : ""}` : "127.0.0.1 · 本地服务";
  const vhomeControlText = vhomeConnected ? "V来家已连接" : vhomeLoginPreparing ? "正在获取授权链接" : vhomeLoginActive ? "等待 V来家授权" : "登录 V来家";
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
      setVhomeError(error.message || "登录启动失败");
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
      setVhomeError(error.message || "重新生成授权链接失败");
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
      setVhomeError(error.message || "取消登录失败");
    } finally {
      setVhomeBusy(false);
    }
  }, [replaceVHomeStatus]);
  const logoutVHome = q2(async () => {
    if (!window.confirm("确认退出当前 V来家组织？退出后不会影响 AI、文件、索引和其他本地功能。")) return;
    setVhomeBusy(true);
    setVhomeError(null);
    try {
      const nextStatus = await api("/vhome/logout", { method: "POST", body: {} });
      replaceVHomeStatus(nextStatus);
      setVhomeMenuOpen(false);
    } catch (error) {
      await refreshVHome();
      setVhomeError(error.message || "退出登录失败");
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
      setVhomeError(error.message || "刷新状态失败");
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
      setVhomeError(browser === "edge" ? "无法使用 Microsoft Edge 打开，请复制授权链接。" : "默认浏览器未能打开，请复制授权链接或尝试 Microsoft Edge。");
    } finally {
      if (browser === "default") setVhomeOpenFallback(true);
    }
  }, [vhomeLoginUrl]);
  const copyVHomeValue = q2(async (value, label) => {
    try {
      await writeClipboardText(value);
      setVhomeCopyStatus(`${label}已复制`);
      setTimeout(() => setVhomeCopyStatus(null), 2e3);
    } catch (error) {
      setVhomeError(error.message || `${label}复制失败`);
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
  const openMarkdown = q2(() => {
    openMarkdownDocumentByPicker();
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
          <select class="theme-select" style="width:100%;font-size:11px;padding:2px 4px;background:var(--surface-input);color:var(--text-primary);border:1px solid var(--border-default);border-radius:3px;cursor:pointer" onChange=${(e3) => { const v = e3.target.value; document.documentElement.setAttribute("data-theme", v); try { localStorage.setItem("visionox-theme", v); } catch {}; try { document.cookie = "visionox-theme=" + encodeURIComponent(v) + ";path=/;max-age=31536000"; } catch {}; try { if (window.parent && window.parent !== window) { window.parent.postMessage({ type: 'vis_theme_changed', theme: v }, '*'); } } catch {}; }} value=${(typeof document !== 'undefined' && document.documentElement.getAttribute("data-theme")) || "light"}>
            <option value="indigo-night">靛夜</option>
            <option value="light">\u6D45\u8272</option>
            <option value="dark">\u6DF1\u8272</option>
            <option value="warm-sand">\u6696\u6C99</option>
            <option value="cool-ash">\u51B7\u7070</option>
            <option value="soft-sage">\u67D4\u7EFF</option>
            <option value="espresso">\u6D53\u7F29\u5496\u5561</option>
            <option value="midnight-ink">\u5348\u591C\u58A8\u84DD</option>
            <option value="deep-charcoal">\u6DF1\u70AD\u7070</option>
          </select>
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
            <div id="vhome-connection-popover" class="vhome-popover" role="dialog" aria-label="V来家连接">
              <div class="vhome-popover-head">
                <div class="vhome-popover-title">${vhomeConnected ? "V来家已连接" : "登录 V来家"}</div>
                <button type="button" class="vhome-popover-close" onClick=${dismissVHomePopover} title="关闭" aria-label="关闭 V来家连接卡片">×</button>
              </div>
              ${vhomeConnected ? html7`
                <div class="vhome-popover-meta">${vhomeStatus.userName}${vhomeStatus.corpName ? ` · ${vhomeStatus.corpName}` : ""}</div>
                <div class="vhome-popover-actions vhome-popover-actions-connected">
                  <button type="button" disabled=${vhomeBusy} onClick=${refreshVHomeNow}>刷新状态</button>
                  <button type="button" class="danger" disabled=${vhomeBusy} onClick=${logoutVHome}>退出当前组织</button>
                </div>
              ` : html7`
                <div class="vhome-popover-meta">${vhomeLoginPreparing ? "正在获取授权链接，请稍候。此时可以继续使用 AI 和其他本地功能。" : vhomeLoginState === "completing" ? "正在确认授权结果，请稍候。" : vhomeLoginActive ? "授权等待期间可以继续使用 AI 和其他本地功能。" : vhomeLoginFailure ?? "使用浏览器和 V来家完成一次授权。"}</div>
                ${vhomeStatus?.login?.userCode ? html7`
                  <div class="vhome-code-row"><span>授权码</span><code>${vhomeStatus.login.userCode}</code><button type="button" onClick=${() => copyVHomeValue(vhomeStatus.login.userCode, "授权码")}>复制</button></div>
                ` : null}
                ${vhomeLoginUrl ? html7`
                  <div class="vhome-login-link" title=${vhomeLoginUrl}>
                    <span>login.dingtalk.com</span>
                    <button type="button" onClick=${() => copyVHomeValue(vhomeLoginUrl, "授权链接")}>复制链接</button>
                  </div>
                  <div class=${`vhome-popover-meta ${vhomeLoginExpired ? "vhome-popover-error" : ""}`}>
                    ${vhomeLoginExpired ? "授权链接已过期，请重新生成。" : vhomeRemainingSeconds === null ? "浏览器未打开？复制链接到任意可用浏览器。" : `剩余 ${formatVHomeCountdown(vhomeRemainingSeconds)} · 浏览器未打开可复制链接。`}
                  </div>
                ` : null}
                ${vhomeCopyStatus ? html7`<div class="vhome-copy-status" role="status">${vhomeCopyStatus}</div>` : null}
                ${vhomeLoginDetail ? html7`<div class="vhome-popover-error" role="alert">DWS 诊断：${vhomeLoginDetail}</div>` : null}
                <div class="vhome-popover-actions">
                  ${vhomeLoginUrl && !vhomeLoginExpired ? html7`<button type="button" class="primary" disabled=${vhomeBusy} onClick=${() => openVHomeAuthorization("default")}>打开浏览器</button>` : null}
                  ${vhomeLoginUrl && vhomeOpenFallback && !vhomeLoginExpired ? html7`<button type="button" disabled=${vhomeBusy} onClick=${() => openVHomeAuthorization("edge")}>使用 Edge 打开</button>` : null}
                  ${vhomeAuthorizationReady && vhomeLoginActive && !vhomeLoginExpired ? html7`<button type="button" disabled=${vhomeBusy} onClick=${refreshVHomeNow}>我已完成授权</button>` : null}
                  ${vhomeLoginExpired || vhomeLoginState === "failed" ? html7`<button type="button" class="primary" disabled=${vhomeBusy} onClick=${restartVHomeLogin}>重新生成链接</button>` : null}
                  ${vhomeLoginActive ? html7`<button type="button" disabled=${vhomeBusy} onClick=${cancelVHomeLogin}>取消</button>` : vhomeLoginState === "failed" ? null : html7`<button type="button" class="primary" disabled=${vhomeBusy} onClick=${startVHomeLogin}>${vhomeBusy ? "正在启动..." : "重新登录"}</button>`}
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
          <span class="session">维信诺协同办公平台</span>
        </span>
        <span class="grow"></span>
        <button type="button" class="top-action top-action-md" onClick=${openMarkdown} title="用 Visionox-Whale 打开 Markdown 文档">
          <span class="top-action-g">MD</span>
          <span class="top-action-label">打开 MD</span>
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
    <${ToastStack} />
    <${ErrorOverlay} />
  `;
}
R(html7`<${App} />`, document.getElementById("root"));
if (window.parent && window.parent !== window) {
  setTimeout(() => window.parent.postMessage({ type: "vis_dashboard_ready" }, "*"), 0);
}
