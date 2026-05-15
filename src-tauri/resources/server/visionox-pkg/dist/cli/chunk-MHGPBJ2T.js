#!/usr/bin/env node
import {
  loadLanguage,
  saveLanguage
} from "./chunk-65Q5HQ26.js";

// src/i18n/EN.ts
var EN = {
  common: {
    error: "Error",
    warning: "Warning",
    loading: "Loading...",
    done: "Done",
    cancel: "Cancel",
    confirm: "Confirm",
    back: "Back",
    next: "Next",
    tool: "tool",
    running: "running",
    noTurns: "(no turns yet)"
  },
  cli: {
    description: "DeepSeek-native agent framework \u2014 built for cache hits and cheap tokens.",
    continue: "Resume the most recently used chat session without showing the picker.",
    setup: "Interactive wizard \u2014 API key, preset, MCP servers. Re-run any time to reconfigure.",
    code: "Code-editing chat \u2014 filesystem tools rooted at <dir> (default: cwd), coding system prompt, v4-flash baseline.",
    chat: "Interactive Ink TUI with live cache/cost panel.",
    run: "Run a single task non-interactively, streaming output.",
    stats: "Show usage dashboard.",
    doctor: "One-command health check.",
    commit: "Draft a commit message from the staged diff.",
    sessions: "List saved chat sessions, or inspect one by name.",
    pruneSessions: "Delete saved sessions idle \u2265N days (default 90). Use --dry-run to preview.",
    events: "Pretty-print the kernel event-log sidecar.",
    replay: "Interactive Ink TUI to scrub through a transcript.",
    diff: "Compare two transcripts in a split-pane Ink TUI.",
    mcp: "Model Context Protocol helpers \u2014 discover servers, test your setup.",
    version: "Print Reasonix version.",
    update: "Check for a newer Reasonix and install it.",
    index: "Build (or incrementally refresh) a local semantic search index."
  },
  ui: {
    welcome: "Run `reasonix` any time to start chatting \u2014 your settings are remembered.",
    taglineChat: "DeepSeek-native agent",
    taglineCode: "DeepSeek-native coding agent",
    taglineSub: "cache-first \xB7 flash-first",
    startSessionHint: "type a message to start your session",
    inputPlaceholder: "Ask anything... (type / for commands, @ for files)",
    busy: "Thinking...",
    thinking: "\u25B8 thinking...",
    undo: "Undo",
    undoHint: "press u within 5s to undo",
    applied: "applied",
    rejected: "rejected",
    noDashboard: "Suppress the auto-launched embedded web dashboard.",
    dashboardPortHint: "Pin the dashboard to a fixed port (1\u201365535). Stable across restarts \u2014 required for SSH tunnels. Default: ephemeral.",
    dashboardPortInvalid: "\u25B2 ignoring --dashboard-port={value} (must be an integer 1\u201365535) \u2014 falling back to ephemeral",
    dashboardAutoStartFailed: "\u25B2 dashboard auto-start failed ({reason}) \u2014 try /dashboard, or pass --no-dashboard to silence",
    systemAppendHint: "Append instructions to the code system prompt. Does NOT replace the default prompt \u2014 adds after it.",
    systemAppendFileHint: "Append file contents to the code system prompt. Does NOT replace the default prompt. UTF-8, relative to cwd or absolute.",
    resumedSession: '\u25B8 resumed session "{name}" with {count} prior messages \xB7 /new to start fresh \xB7 /sessions to manage',
    newSession: '\u25B8 session "{name}" (new) \u2014 auto-saved as you chat \xB7 /sessions to rename or delete',
    ephemeralSession: "\u25B8 ephemeral chat (no session persistence) \u2014 drop --no-session to enable",
    restoredEdits: "\u25B8 restored {count} pending edit block(s) from an interrupted prior run \u2014 /apply to commit or /discard to drop.",
    resumedPlan: "Resumed plan \xB7 {when}{summary}",
    tipEditBindings: {
      topic: "edit-gate keybindings",
      sections: [
        {
          rows: [
            { key: "y / n", text: "accept or drop pending edits" },
            {
              key: "Shift+Tab",
              text: "switch review \u2194 AUTO (persisted; AUTO applies instantly)"
            },
            { key: "u", text: "undo the last auto-applied batch (within the 5s banner)" }
          ]
        }
      ],
      footer: "Current mode shown in the bottom status bar \xB7 /keys for the full reference"
    },
    tipMouseClipboard: {
      topic: "mouse + clipboard",
      sections: [
        {
          rows: [
            { key: "drag", text: "select text \u2014 terminal-native, no modifier needed" },
            {
              key: "right-click",
              text: "your terminal's native menu (paste / copy on Windows Terminal etc.)"
            },
            { key: "wheel", text: "scrolls chat history (works on web/cloud/SSH terminals too)" },
            {
              key: "\u2191 / \u2193",
              text: "scroll chat \xB7 use Ctrl+P / Ctrl+N for prompt history + multi-line cursor"
            }
          ]
        }
      ],
      footer: "Run /keys for the full keyboard + mouse reference"
    },
    keysReference: {
      topic: "Reasonix keys + mouse reference",
      sections: [
        {
          title: "keyboard",
          rows: [
            { key: "Enter", text: "submit the prompt" },
            { key: "Shift+Enter", text: "insert a newline in the prompt" },
            { key: "\u2191 / \u2193", text: "scroll chat history (mouse wheel routes here too)" },
            {
              key: "Ctrl+P / Ctrl+N",
              text: "previous / next prompt history \xB7 cursor up / down in a multi-line draft"
            },
            { key: "Ctrl+A / Ctrl+E", text: "jump to start / end of the current line" },
            { key: "Ctrl+W", text: "delete the word before the cursor" },
            { key: "Ctrl+U", text: "clear the entire prompt buffer" },
            { key: "Tab", text: "complete @-mention \xB7 drill folder \xB7 accept slash command" },
            { key: "Shift+Tab", text: "edit-gate: toggle review \u2194 AUTO mode" },
            { key: "Esc", text: "dismiss picker \xB7 abort the running model turn" },
            { key: "Ctrl+C", text: "abort the running model turn (NOT copy \u2014 see clipboard)" },
            { key: "PgUp / PgDn", text: "scroll chat history a page at a time" },
            { key: "End", text: "jump chat to the most recent line" }
          ]
        },
        {
          title: "mouse",
          rows: [
            { key: "wheel", text: "scrolls chat history (works on web/cloud/SSH terminals too)" },
            { key: "drag", text: "selects text natively \u2014 direct copy works, no modifier" },
            { key: "right-click", text: "terminal-native (paste menu on Windows Terminal etc.)" }
          ]
        },
        {
          title: "copy / paste",
          rows: [
            { key: "select text", text: "drag to select \u2014 terminal-native (no modifier needed)" },
            {
              key: "/copy",
              text: "vim/tmux-style copy mode \u2014 works in SSH/mosh/tmux where drag-select can't extend past the viewport"
            },
            {
              key: "copy",
              text: "Ctrl+Shift+C (Win/Linux) \xB7 Cmd+C (macOS) \u2014 or auto-copy-on-select if your terminal does it"
            },
            { key: "paste", text: "Ctrl+V or Ctrl+Shift+V (Win/Linux) \xB7 Cmd+V (macOS)" },
            {
              key: "bracketed paste",
              text: "multi-line pastes stay one block \u2014 no auto-submit on intermediate newlines"
            }
          ]
        },
        {
          title: "edit-gate (code mode)",
          rows: [
            { key: "y / n", text: "accept or drop pending edits in the review modal" },
            { key: "Shift+Tab", text: "toggle review \u2194 AUTO (persisted across sessions)" },
            { key: "u", text: "undo the last auto-applied batch (within the 5s banner)" }
          ]
        }
      ],
      footer: "Wheel\u2192\u2191/\u2193 via DECSET 1007 (alternate-scroll) \u2014 wheel scrolls chat on most terminals (web/cloud/SSH included) without disturbing native selection. Drag to select stays modifier-free. Pass --no-mouse to opt out."
    },
    tipShownOnce: "shown once",
    modelOverride: "override the default model",
    noSession: "disable session persistence for this run",
    resumeHint: "force-resume the named session (even if idle)",
    newHint: "force a fresh session (ignore --session / --continue)",
    transcriptHint: "path to write the JSONL transcript",
    budgetHint: "session USD cap \u2014 warns at 80%, refuses next turn at 100%",
    modelIdHint: "DeepSeek model id (e.g. deepseek-v4-flash)",
    systemPromptHint: "override the default system prompt",
    presetHint: "model bundle \u2014 auto|flash|pro",
    sessionNameHint: "session name (default: 'default')",
    ephemeralHint: "disable session persistence for this run",
    mcpSpecHint: "MCP server spec (repeatable)",
    mcpPrefixHint: "prefix MCP tool names with this string",
    noConfigHint: "ignore ~/.visionox/config.json for this run",
    presetHintShort: "model bundle \u2014 auto|flash|pro",
    budgetHintShort: "session USD cap",
    transcriptHintShort: "JSONL transcript path",
    mcpSpecHintShort: "MCP server spec (repeatable)",
    mcpPrefixHintShort: "MCP tool name prefix",
    dryRunHint: "show what would be installed without actually installing",
    rebuildHint: "rebuild the index from scratch",
    embedModelHint: "embedding model name",
    projectDirHint: "project root directory",
    ollamaUrlHint: "Ollama server URL",
    skipPromptsHint: "skip confirmation prompts",
    verboseHint: "show full session metadata",
    pruneDaysHint: "delete sessions idle this many days or more (default 90)",
    pruneDryRunHint: "list what would be deleted without removing anything",
    eventTypeHint: "filter by event type",
    eventSinceHint: "start from this event id",
    eventTailHint: "show only the last N events",
    jsonHint: "output as JSON",
    projectionHint: "show projected state at each event",
    printHint: "print to stdout instead of TUI",
    headHint: "show only the first N events",
    tailHint: "show only the last N events",
    mdReportHint: "write a markdown diff report to this path",
    printHintTable: "print a table to stdout",
    tuiHint: "open the interactive TUI",
    labelAHint: "label for the left pane",
    labelBHint: "label for the right pane",
    mcpListDescription: "browse the MCP registry (official \u2192 smithery \u2192 local fallback)",
    mcpInspectDescription: "inspect an MCP server spec (tools, resources, prompts)",
    mcpSearchDescription: "search the MCP registry for servers matching a query",
    mcpInstallDescription: "install an MCP server by name (writes its spec to your config)",
    mcpBrowseDescription: "interactive marketplace browser \u2014 type to filter, enter to install",
    mcpLocalHint: "show only the bundled offline catalog",
    mcpRefreshHint: "bypass the 24h cache and refetch",
    mcpLimitHint: "max entries to show",
    mcpPagesHint: "eagerly load this many pages (default 1)",
    mcpAllHint: "load every page (slow on first run)",
    mcpMaxPagesHint: "cap how many pages to walk while searching (default 20)",
    jsonHintCatalog: "output as JSON",
    jsonHintReport: "output the inspection report as JSON",
    modelOverrideFlash: "override the model (default: deepseek-v4-flash)",
    skipConfirmHint: "skip the confirmation prompt"
  },
  slash: {
    help: { description: "show the full command reference" },
    copy: {
      description: "open vim/tmux-style copy mode \u2014 j/k navigate, v select, y yank to clipboard"
    },
    status: { description: "current model, flags, context, session" },
    preset: {
      description: "model bundle \u2014 auto escalates flash \u2192 pro, flash/pro lock",
      argsHint: "<auto|flash|pro>"
    },
    model: { description: "switch DeepSeek model id", argsHint: "<id>" },
    models: { description: "list available models fetched from DeepSeek /models" },
    theme: {
      description: "show or persist the terminal theme preference. Bare opens picker.",
      argsHint: "[auto|default|dark|light|tokyo-night|github-dark|github-light|high-contrast]"
    },
    language: {
      description: "switch the runtime language",
      argsHint: "<EN|zh-CN>",
      success: "Language switched to English.",
      unsupported: "Unsupported language code: {code}. Supported: {supported}."
    },
    pro: {
      description: "arm v4-pro for the NEXT turn only (one-shot \xB7 auto-disarms after turn)",
      argsHint: "[off]"
    },
    budget: {
      description: "session USD cap \u2014 warns at 80%, refuses next turn at 100%. Off by default. /budget alone shows status",
      argsHint: "[usd|off]"
    },
    mcp: { description: "list MCP servers + tools attached to this session" },
    resource: {
      description: "browse + read MCP resources (no arg \u2192 list URIs; <uri> \u2192 fetch contents)",
      argsHint: "[uri]"
    },
    prompt: {
      description: "browse + fetch MCP prompts (no arg \u2192 list names; <name> \u2192 render prompt)",
      argsHint: "[name]"
    },
    memory: {
      description: "show / manage pinned memory (visionox.md + ~/.visionox/memory)",
      argsHint: "[list|show <name>|forget <name>|clear <scope> confirm]"
    },
    skill: {
      description: "list / run user skills (<project>/.visionox/skills + ~/.visionox/skills)",
      argsHint: "[list|show <name>|<name> [args]]"
    },
    hooks: {
      description: "list active hooks (settings.json under .visionox/) \xB7 reload re-reads from disk",
      argsHint: "[reload]"
    },
    permissions: {
      description: "show / edit shell allowlist (builtin read-only \xB7 per-project: ~/.visionox/config.json)",
      argsHint: "[list|add <prefix>|remove <prefix|N>|clear confirm]"
    },
    dashboard: {
      description: "launch the embedded web dashboard (127.0.0.1, token-gated)",
      argsHint: "[stop]"
    },
    update: { description: "show current vs latest version + the shell command to upgrade" },
    stats: {
      description: "cross-session cost dashboard (today / week / month / all-time \xB7 cache hit \xB7 vs Claude)"
    },
    cost: {
      description: "bare \u2192 last turn's spend (Usage card); with text \u2192 estimate cost of sending it next (worst-case + likely-cache)",
      argsHint: "[text]"
    },
    doctor: { description: "health check (api / config / api-reach / index / hooks / project)" },
    context: { description: "show context-window breakdown (system / tools / log / input)" },
    retry: { description: "truncate & resend your last message (fresh sample)" },
    compact: {
      description: "narrow oversized tool results + tool-call args in the log; cap at tokens, default 4000",
      argsHint: "[tokens]"
    },
    cwd: {
      description: "switch the workspace root mid-session \u2014 re-points fs / shell / memory tools, reloads project hooks, refreshes the at-mention walker",
      argsHint: "<path>"
    },
    stop: { description: "abort the current model turn (typed alternative to Esc)" },
    feedback: { description: "open a GitHub issue with diagnostic info copied to clipboard" },
    keys: { description: "keyboard + mouse + copy/paste reference" },
    plans: { description: "list this session's active + archived plans, newest first" },
    replay: {
      description: "load an archived plan as a read-only Time Travel snapshot (default: newest)",
      argsHint: "[N]"
    },
    sessions: { description: "list saved sessions (current marked with \u25B8)" },
    setup: { description: "reminds you to exit and run `reasonix setup`" },
    semantic: {
      description: "show semantic_search status \u2014 built? Ollama installed? how to enable"
    },
    clear: { description: "clear visible scrollback only (log/context kept)" },
    new: { description: "start a fresh conversation (clear context + scrollback)" },
    loop: {
      description: "auto-resubmit <prompt> every <interval> until you type something / Esc / /loop stop",
      argsHint: "<5s..6h> <prompt>  \xB7  stop  \xB7  (no args = status)"
    },
    exit: { description: "quit the TUI" },
    init: {
      description: "scan the project and synthesize a baseline visionox.md (model writes; review with /apply). `force` overwrites an existing file.",
      argsHint: "[force]"
    },
    apply: {
      description: "commit pending edit blocks to disk (no arg \u2192 all; `1`, `1,3`, or `1-4` \u2192 that subset, rest stay pending)",
      argsHint: "[N|N,M|N-M]"
    },
    discard: {
      description: "drop pending edit blocks without writing (no arg \u2192 all; indices \u2192 that subset)",
      argsHint: "[N|N,M|N-M]"
    },
    walk: {
      description: "step through pending edits one block at a time (git-add-p style: y/n per block, a apply rest, A flip AUTO)"
    },
    undo: { description: "roll back the last applied edit batch" },
    history: { description: "list every edit batch this session (ids for /show, undone markers)" },
    show: {
      description: "dump a stored edit diff (omit id for newest non-undone)",
      argsHint: "[id]"
    },
    commit: { description: "git add -A && git commit -m ...", argsHint: '"msg"' },
    checkpoint: {
      description: "snapshot every file the session has touched (Cursor-style internal store, not git). /checkpoint alone lists.",
      argsHint: "[name|list|forget <id>]"
    },
    restore: {
      description: "roll back files to a named checkpoint (see /checkpoint list)",
      argsHint: "<name|id>"
    },
    plan: {
      description: "toggle read-only plan mode (writes bounced until submit_plan + approval)",
      argsHint: "[on|off]"
    },
    mode: {
      description: "edit-gate: review (queue) \xB7 auto (apply+undo) \xB7 yolo (apply+auto-shell). Shift+Tab cycles.",
      argsHint: "[review|auto|yolo]"
    },
    jobs: { description: "list background jobs started by run_background" },
    kill: {
      description: "stop a background job by id (SIGTERM \u2192 SIGKILL after grace)",
      argsHint: "<id>"
    },
    logs: {
      description: "tail a background job's output (default last 80 lines)",
      argsHint: "<id> [lines]"
    }
  },
  wizard: {
    languageTitle: "Choose your language",
    languageSubtitle: "Detected from your system locale. Switch later via /language.",
    welcomeTitle: "Welcome to Reasonix.",
    apiKeyPrompt: "Paste your DeepSeek API key to get started.",
    apiKeyGetOne: "Get one at: https://platform.deepseek.com/api_keys",
    apiKeySavedLocally: "Saved locally to {path}",
    apiKeyInputLabel: "key \u203A ",
    apiKeyInvalid: "Key looks too short \u2014 paste the full token (16+ chars, no spaces).",
    apiKeyChecking: "Checking API key\u2026",
    apiKeyRejected: "DeepSeek rejected this API key. Paste a valid key, or press Esc to cancel setup.",
    apiKeyCheckFailed: "Could not verify this API key right now ({message}). Check your network or try again.",
    apiKeyPreview: "preview: {redacted}",
    themeTitle: "Choose a theme",
    themeSubtitle: "Preview updates live as you navigate. Change later with /theme.",
    themeSampleHeading: "Sample",
    themeFooter: "[\u2191\u2193] navigate \xB7 [Enter] confirm \xB7 [Esc] cancel",
    themeCaption: {
      default: "GitHub dark (default)",
      dark: "Cool dark tones",
      light: "Clean light mode",
      "tokyo-night": "Tokyo Night palette",
      "github-dark": "GitHub dark",
      "github-light": "GitHub light",
      "high-contrast": "Accessibility"
    },
    reviewLabelTheme: "Theme",
    presetTitle: "Pick a preset",
    mcpTitle: "Which MCP servers should Reasonix wire up for you?",
    mcpUserArgsHint: "(you'll provide {arg})",
    mcpFooterMulti: "[\u2191\u2193] navigate  \xB7  [Space] toggle  \xB7  [Enter] confirm  \xB7  [Esc] cancel  \xB7  empty = skip",
    mcpArgsTitle: "Configure {name}",
    mcpArgsDirMissing: "Directory {path} doesn't exist.",
    mcpArgsDirCreateHint: "[Y/Enter] create it (mkdir -p) \xB7 [N/Esc] enter a different path",
    mcpArgsDirCreateFailed: "Couldn't create {path}: {message}",
    mcpArgsRequiredParam: "Required parameter: ",
    mcpArgsEmpty: "{name} needs a value \u2014 got an empty string.",
    mcpArgsNotADir: "{path} exists but is not a directory.",
    reviewTitle: "Ready to save",
    reviewLabelApiKey: "API key",
    reviewLabelLanguage: "Language",
    reviewLabelPreset: "Preset",
    reviewLabelMcp: "MCP",
    reviewMcpNone: "(none)",
    reviewMcpServers: "{count} server(s)",
    reviewSavesTo: "Saves to {path}",
    reviewSaveError: "Could not save config: {message}",
    reviewFooter: "[Enter] save \xB7 [Esc] cancel",
    savedTitle: "\u25B8 Saved.",
    savedFooter: "[Enter] to exit",
    selectFooter: "[\u2191\u2193] navigate \xB7 [Enter] confirm \xB7 [Esc] cancel",
    stepCounter: "Step {step}/{total} \xB7 ",
    exitHint: "/exit to abort",
    apiKeyPlaceholder: "sk-...",
    themeSampleReasoning: "Reasoning"
  },
  themePicker: {
    header: "Theme",
    footer: "\u2191\u2193 pick \xB7 \u23CE confirm \xB7 esc cancel",
    currentPref: "current preference",
    activeNow: "active now",
    autoDesc: "use REASONIX_THEME or default"
  },
  planFlow: {
    approveCardTitle: "Approve plan",
    approveCardMetaRight: "awaiting",
    openQuestionsBanner: "\u25B2 the plan flags open questions or risks \u2014 pick {refine} to write concrete answers before the model moves on.",
    openQuestionsHeader: "Open questions / risks",
    truncatedBodyMore: "\u2026 {n} more line above in scrollback",
    truncatedBodyMorePlural: "\u2026 {n} more lines above in scrollback",
    picker: {
      accept: "accept",
      acceptHint: "run it now, in order",
      refine: "refine",
      refineHint: "give the agent more guidance, draft a new plan",
      revise: "revise",
      reviseHint: "edit the plan inline before running (skip / reorder steps)",
      reject: "reject",
      rejectHint: "discard, agent will retry from scratch"
    },
    refineFooter: "\u23CE send  \xB7  esc return to picker",
    refineQuestionsHeading: "Answer these or describe the change you want:",
    modes: {
      approve: {
        title: "approving \u2014 any last instructions?",
        hint: "Answer questions the plan raised, add constraints, or just press Enter to approve as-is.",
        blankHint: " (Enter with blank = approve without extra instructions.)"
      },
      refine: {
        title: "refining \u2014 what should the model change?",
        hint: "Describe what's wrong or missing, or answer questions the plan raised.",
        blankHint: " (Enter with blank = let the model pick safe defaults for any open questions.)"
      },
      reject: {
        title: "rejecting \u2014 tell the model why (optional)",
        hint: "Say what the model got wrong about your goal, or what you actually want instead.",
        blankHint: " (Enter with blank = cancel without explanation; the model will ask what you want.)"
      },
      "checkpoint-revise": {
        title: "revising \u2014 what should change before the next step?",
        hint: "Scope change, skip steps, alternative approach \u2014 the model adjusts the remaining plan.",
        blankHint: " (Enter with blank = continue with the current plan.)"
      },
      "choice-custom": {
        title: "custom answer \u2014 type whatever fits",
        hint: "Free-form reply. The model reads it verbatim and proceeds \u2014 no need to match the listed options.",
        blankHint: " (Enter with blank = ask the model what you actually want.)"
      }
    },
    checkpoint: {
      title: "Checkpoint \u2014 step done",
      continue: "Continue \u2014 run the next step",
      continueHint: "Model resumes with the next step.",
      revise: "Revise \u2014 give feedback before the next step",
      reviseHint: "Stay paused, type guidance; model adjusts the remaining plan.",
      stop: "Stop \u2014 end the plan here",
      stopHint: "Model summarizes what was done and ends."
    },
    stepList: {
      counter: "{total} steps",
      counterSingular: "{total} step",
      counterDone: "{done}/{total} done ({pct}%) \xB7 {total} steps",
      counterDoneSingular: "{done}/{total} done ({pct}%) \xB7 {total} step"
    },
    noPlanSummary: "No plan body submitted yet.",
    detailCollapsedHint: "Ctrl+P expands full plan details.",
    detailExpandedHint: "Ctrl+P collapses details.",
    detailHeader: "Plan details",
    detailWindow: "showing lines {start}-{end} of {total}",
    detailScrollHint: "PgUp/PgDn scroll details \xB7 Home/End jump",
    reviseTitle: "Revise plan",
    reviseSteps: "{count} steps",
    reviseFooter: "\u2191\u2193 focus  \xB7  space toggle skip  \xB7  k/j move  \xB7  \u23CE accept  \xB7  esc cancel",
    riskMed: " med",
    riskHigh: " high",
    completeMsg: "\u25B8 plan complete \u2014 all {total} step{s} done \xB7 archived"
  },
  app: {
    walkCancelledRemaining: "\u25B8 walk cancelled \u2014 {count} block(s) still pending.",
    walkCancelled: "\u25B8 walk cancelled.",
    editModeYolo: "\u25B8 edit mode: YOLO \u2014 edits AND shell commands auto-run. /undo still rolls back edits. Use carefully.",
    editModeAuto: "\u25B8 edit mode: AUTO \u2014 edits apply immediately; press u within 5s to undo (space pauses the timer). Shell commands still ask.",
    editModeReview: "\u25B8 edit mode: review \u2014 edits queue for /apply (or y) / /discard (or n)",
    rejectedEdit: "\u25B8 rejected edit to {path}{context}",
    autoApprovingRest: "\u25B8 auto-approving remaining edits for this turn",
    flippedAutoSession: "\u25B8 flipped to AUTO mode for the rest of the session (persisted)",
    flippedAutoWalk: "\u25B8 flipped to AUTO mode \u2014 future edits will apply immediately. Walk exited.",
    dashboardStopped: "\u25B8 dashboard stopped.",
    notedMemory: "\u25B8 noted ({scope}) \u2014 {verb} {path}",
    notedScopeProject: "project",
    notedScopeGlobal: "global",
    notedVerbCreated: "created",
    notedVerbAppended: "appended to",
    memoryWriteFailed: "# memory write failed",
    commandFailed: "! command failed",
    btwUsage: "\u25B8 /btw <question> \u2014 ask a side question without polluting the conversation context.",
    btwHeader: "\u226B btw",
    btwFailed: "/btw failed",
    restoreCodeOnly: "\u25B8 /restore is code-mode only",
    hookUserPromptSubmit: "UserPromptSubmit hook",
    hookStop: "Stop hook",
    atMentions: "\u25B8 @mentions: {parts}",
    atUrl: "\u25B8 @url: {parts}",
    atUrlFailed: "@url expansion failed",
    denied: "\u25B8 denied: {cmd}{context}",
    alwaysAllowed: '\u25B8 always allowed "{prefix}" for {dir}',
    runningCommand: "\u25B8 running: {cmd}",
    startingBackground: "\u25B8 starting (background): {cmd}",
    checkpointSaved: "\u26C1 checkpoint saved \xB7 {id} \xB7 {count} file{s} \xB7 /restore {id} to roll back this step",
    continuingAfter: "\u25B8 continuing after {label}{counter}",
    planStoppedAt: "\u25B8 plan stopped at {label}{counter}",
    revisingAfter: "\u25B8 revising after {label} \u2014 {feedback}"
  },
  hooks: {
    head: "hook {tag} `{cmd}` {decision}{truncTag}",
    headWithDetail: "hook {tag} `{cmd}` {decision}{truncTag}: {detail}",
    truncated: " (output truncated at 256KB)",
    decisionBlock: "block",
    decisionWarn: "warn",
    decisionTimeout: "timeout",
    decisionError: "error"
  },
  summary: {
    status: "summarizing what was gathered\u2026",
    hallucinatedFallback: "(model emitted fake tool-call markup instead of a prose summary \u2014 try /retry with a narrower question, or /think to inspect R1's reasoning)",
    failedAfterReason: "{label} and the fallback summary call failed: {message}. Run /clear and retry with a narrower question, or raise --max-tool-iters."
  },
  loop: {
    budgetExhausted: "session budget exhausted \u2014 spent ${spent} \u2265 cap ${cap}. Bump the cap with /budget <usd>, clear it with /budget off, or end the session.",
    budget80Pct: "\u25B2 budget 80% used \u2014 ${spent} of ${cap}. Next turn or two likely trips the cap.",
    proArmed: "\u21E7 /pro armed \u2014 this turn runs on deepseek-v4-pro (one-shot \xB7 disarms after turn)",
    abortedAtIter: "aborted at iter {iter}/{cap} \u2014 stopped without producing a summary (press \u2191 + Enter or /retry to resume)",
    toolUploadStatus: "tool result uploaded \xB7 model thinking before next response\u2026",
    toolBudgetWarning: "{iter}/{cap} tool calls used \u2014 approaching budget. Press Esc to force a summary now.",
    preflightFoldStatus: "preflight: context near full, attempting fold\u2026",
    preflightFolded: "preflight: request ~{estimate}/{ctxMax} tokens ({pct}%) \u2014 folded {beforeMessages} messages \u2192 {afterMessages} (summary {summaryChars} chars). Sending.",
    preflightNoFold: "preflight: request ~{estimate}/{ctxMax} tokens ({pct}%) and nothing left to fold \u2014 DeepSeek will likely 400. Run /clear or /new to start fresh.",
    flashEscalation: "\u21E7 flash requested escalation \u2014 retrying this turn on {model}{reasonSuffix}",
    harvestStatus: "extracting plan state from reasoning\u2026",
    autoEscalation: "\u21E7 auto-escalating to {model} for the rest of this turn \u2014 flash hit {breakdown}. Next turn falls back to {fallback} unless /pro is armed.",
    readOnlyLoopEscalation: "\u21E7 auto-escalating to {model} \u2014 flash made {n} consecutive read-only calls without producing an edit or final answer. Next turn falls back to {fallback} unless /pro is armed.",
    repeatToolCallWarning: "Caught a repeated tool call \u2014 let the model see the issue and retry with a different approach.",
    stormStuck: "Stopped a stuck retry loop \u2014 the model kept calling the same tool with identical args after a self-correction nudge. Try /retry, rephrase, or rule out the underlying blocker.",
    stormSuppressed: "Suppressed {count} repeated tool call(s) \u2014 same name + args fired 3+ times.",
    compactingHistoryStatus: "compacting history{aggressiveTag}\u2026",
    aggressiveTag: " (aggressive)",
    foldedHistory: "context {before}/{ctxMax} ({pct}%) \u2014 folded {beforeMessages} messages \u2192 {afterMessages} (summary {summaryChars} chars). Continuing.",
    aggressivelyFoldedHistory: "context {before}/{ctxMax} ({pct}%) \u2014 aggressively folded {beforeMessages} messages \u2192 {afterMessages} (summary {summaryChars} chars). Continuing.",
    forcingSummary: "context {before}/{ctxMax} ({pct}%) \u2014 forcing summary from what was gathered. Run /compact, /clear, or /new to reset."
  },
  errors: {
    contextOverflow: "Context overflow (DeepSeek 400): session history is {requested}, past the model's prompt limit (V4: 1M tokens; legacy chat/reasoner: 131k). Usually a single tool result grew too big. Reasonix caps new tool results at 8k tokens and auto-heals oversized history on session load \u2014 a restart often clears it. If it still overflows, run /new to start fresh, or open /sessions and press [d] to delete this session.",
    contextOverflowTooMany: "too many tokens",
    auth401: "Authentication failed (DeepSeek 401): {inner}. Your API key is rejected. Fix with `reasonix setup` or `export DEEPSEEK_API_KEY=sk-...`. Get one at https://platform.deepseek.com/api_keys.",
    balance402: "Out of balance (DeepSeek 402): {inner}. Top up at https://platform.deepseek.com/top_up \u2014 the panel header shows your balance once it's non-zero.",
    badparam422: "Invalid parameter (DeepSeek 422): {inner}",
    badrequest400: "Bad request (DeepSeek 400): {inner}",
    deepseek5xxHead: "DeepSeek service unavailable ({status}) \u2014 this is a DeepSeek-side problem, not Reasonix. Already retried 4\xD7 with backoff.",
    deepseek5xxReachable: " DeepSeek's main API answered our health check, but /chat/completions is failing \u2014 partial outage on their side.",
    deepseek5xxUnreachable: " DeepSeek API is unreachable from your network \u2014 could be a wider DS outage or a local network issue.",
    deepseek5xxActionNetwork: " Try: (1) check your network, (2) wait 30s and retry, (3) status page: https://status.deepseek.com.",
    deepseek5xxActionRetry: " Try: (1) wait 30s and retry, (2) /preset to switch model, (3) status page: https://status.deepseek.com.",
    innerNoMessage: "(no message)",
    reasonAborted: "[aborted by user (Esc) \u2014 summarizing what I found so far]",
    reasonContextGuard: "[context budget running low \u2014 summarizing before the next call would overflow]",
    reasonStuck: "[stuck on a repeated tool call \u2014 explaining what was tried and what's blocking progress]",
    reasonBudget: "[tool-call budget ({iterCap}) reached \u2014 forcing summary from what I found]",
    labelAborted: "aborted by user",
    labelContextGuard: "context-guard triggered (prompt > 80% of window)",
    labelStuck: "stuck (repeated tool call suppressed by storm-breaker)",
    labelBudget: "tool-call budget ({iterCap}) reached"
  },
  handlers: {
    basic: {
      newInfo: "\u25B8 new conversation \u2014 dropped {count} message(s) from context. Same session, fresh slate.",
      newInfoArchived: '\u25B8 new conversation \u2014 dropped {count} message(s) from context. Prior transcript archived as "{archived}" (visible under Sessions).',
      newInfoSystemReloaded: " \xB7 visionox.md / project memory reloaded (next turn pays one cache miss)",
      helpTitle: "Commands:",
      helpShellTitle: "Shell shortcut:",
      helpShell: "  !<cmd>                   run <cmd> in the sandbox root; output goes into",
      helpShellDetail: "                             the conversation so the model sees it next turn.",
      helpShellConsent: "                             No allowlist gate \u2014 user-typed = explicit consent.",
      helpShellExample: "                             Example: !git status   !ls src/   !npm test",
      helpMemoryTitle: "Quick memory:",
      helpMemoryPin: "  #<note>                  append <note> to <project>/visionox.md (committable).",
      helpMemoryPinEx: "                             Example: #findByEmail must be case-insensitive",
      helpMemoryGlobal: "  #g <note>                append <note> to ~/.visionox/visionox.md (global, never committed).",
      helpMemoryGlobalEx: "                             Example: #g always run pnpm not npm",
      helpMemoryPinBoth: "                             Both pin into every future session's prefix. Faster than /memory.",
      helpMemoryEscape: "                             Use `\\#text` to send a literal `#text` to the model.",
      helpFileTitle: "File references (code mode):",
      helpFile: "  @path/to/file            inline file content under [Referenced files] on send.",
      helpFilePicker: "                             Type `@` to open the picker (\u2191\u2193 navigate, Tab/Enter pick).",
      helpUrlTitle: "URL references:",
      helpUrl: "  @https://example.com     fetch the URL, strip HTML, inline under [Referenced URLs].",
      helpUrlCache: "                             Same URL twice in one session fetches once (in-mem cache).",
      helpUrlPunct: "                             Trailing sentence punctuation (./,/)) is stripped automatically.",
      helpPresetsTitle: "Presets (branch + harvest are NEVER auto-enabled \u2014 opt-in only):",
      helpPresetAuto: "  auto   v4-flash \u2192 v4-pro on hard turns  \u2190 default \xB7 cheap when easy, smart when hard",
      helpPresetFlash: "  flash  v4-flash always                  cheapest \xB7 predictable per-turn cost",
      helpPresetPro: "  pro    v4-pro   always                  ~3\xD7 flash (5/31) \xB7 hard multi-turn work",
      helpSessionsTitle: "Sessions (auto-enabled by default, named 'default'):",
      helpSessionCustom: "  reasonix chat --session <name>   use a different named session",
      helpSessionNone: "  reasonix chat --no-session       disable persistence for this run",
      retryNone: "nothing to retry \u2014 no prior user message in this session's log.",
      retryInfo: '\u25B8 retrying: "{preview}"',
      loopTuiOnly: "/loop is only available in the interactive TUI (not in run/replay).",
      loopStopped: "\u25B8 loop stopped.",
      loopNoActive: "no active loop to stop.",
      loopNoActiveHint: "no active loop. Start one with `/loop <interval> <prompt>` (e.g. /loop 30s npm test).\nCancels on: /loop stop \xB7 Esc \xB7 /clear /new \xB7 any user-typed prompt.",
      loopStarted: '\u25B8 loop started \u2014 re-submitting "{prompt}" every {duration}. Type anything (or /loop stop) to cancel.',
      keysNeedsTui: "/keys needs a TUI context (postKeys wired).",
      unknownCommand: "unknown command: /{cmd} \u2014 did you mean {list}?",
      unknownCommandShort: "unknown command: /{cmd}  (try /help)"
    },
    admin: {
      doctorNeedsTui: "/doctor needs a TUI context (postDoctor wired).",
      doctorRunning: "\u2695 Doctor \u2014 running health checks\u2026",
      hooksReloadUnavailable: "/hooks reload is not available in this context (no reload callback wired).",
      hooksReloaded: "\u25B8 reloaded hooks \xB7 {count} active",
      hooksUsage: "usage: /hooks            list active hooks\n       /hooks reload     re-read settings.json files",
      hooksNone: "no hooks configured.",
      hooksDropHint: "drop a settings.json with a `hooks` key into either of:",
      hooksProject: "  \xB7 {path} (project)",
      hooksProjectFallback: "  \xB7 <project>/.visionox/settings.json (project)",
      hooksGlobal: "  \xB7 {path} (global)",
      hooksEvents: "events: PreToolUse, PostToolUse, UserPromptSubmit, Stop",
      hooksExitCodes: "exit 0 = pass \xB7 exit 2 = block (Pre*) \xB7 other = warn",
      hooksLoaded: "\u25B8 {count} hook(s) loaded",
      hooksSources: "sources: project={project} \xB7 global={global}",
      updateCurrent: "current: reasonix {version}",
      updateLatestPending: "latest:  (not yet resolved \u2014 background check in flight or offline)",
      updateRetryHint: "triggered a fresh registry fetch \u2014 retry `/update` in a few seconds,",
      updateRetryHint2: "or run `reasonix update` in another terminal to force it synchronously.",
      updateLatest: "latest:  reasonix {version}",
      updateUpToDate: "you're on the latest. nothing to do.",
      updateNpxHint: "you're running via npx \u2014 the next `npx reasonix ...` launch will auto-fetch.",
      updateNpxForce: "to force a refresh sooner: `npm cache clean --force`.",
      updateUpgradeHint: "to upgrade, exit this session and run:",
      updateUpgradeCmd1: "  reasonix update           (interactive, dry-run supported via --dry-run)",
      updateUpgradeCmd2: "  {command}   (direct)",
      updateInSessionDisabled: "in-session install is deliberately disabled \u2014 the install spawn would",
      updateInSessionDisabled2: "corrupt this TUI's rendering and Windows can lock the running binary.",
      statsNoData: "no usage data yet.",
      statsEveryTurn: "every turn you run here appends one record \u2014 this session's turns",
      statsWillAppear: "will show up in the dashboard once you send a message."
    },
    edits: {
      undoCodeOnly: "/undo is only available inside `reasonix code` \u2014 chat mode doesn't apply edits.",
      historyCodeOnly: "/history is only available inside `reasonix code`.",
      showCodeOnly: "/show is only available inside `reasonix code`.",
      applyCodeOnly: "/apply is only available inside `reasonix code` (nothing to apply here).",
      discardCodeOnly: "/discard is only available inside `reasonix code`.",
      planCodeOnly: "/plan is only available inside `reasonix code` \u2014 chat mode doesn't gate tool writes.",
      planOn: "\u25B8 plan mode ON \u2014 write tools are gated; the model MUST call `submit_plan` before anything executes. (The model can also call submit_plan on its own for big tasks even when plan mode is off \u2014 this toggle is the stronger, explicit constraint.) Type /plan off to leave.",
      planOff: "\u25B8 plan mode OFF \u2014 write tools are live again. Model can still propose plans autonomously for large tasks.",
      modeCodeOnly: "/mode is only available inside `reasonix code`.",
      modeUsage: "usage: /mode <review|auto|yolo>   (Shift+Tab also cycles)",
      modeYolo: "\u25B8 edit mode: YOLO \u2014 edits AND shell commands auto-run with no prompt. /undo still rolls back edits. Use carefully.",
      modeAuto: "\u25B8 edit mode: AUTO \u2014 edits apply immediately; press u within 5s to undo, or /undo later. Shell commands still ask.",
      modeReview: "\u25B8 edit mode: review \u2014 edits queue for /apply (or y) / /discard (or n)",
      commitCodeOnly: "/commit is only available inside `reasonix code` (needs a rooted git repo).",
      commitUsage: 'usage: /commit "your commit message"  \u2014 runs `git add -A && git commit -m "\u2026"` in {root}',
      walkCodeOnly: "/walk is only available inside `reasonix code`.",
      checkpointCodeOnly: "/checkpoint is only available inside `reasonix code` \u2014 chat mode doesn't apply edits.",
      checkpointNone: "no checkpoints yet \u2014 `/checkpoint <name>` snapshots every file the session has touched. Restore later with `/restore <name>`.",
      checkpointHeader: "\u25C8 checkpoints \xB7 {count} stored",
      checkpointRestoreHint: "  /restore <name|id> \xB7 /checkpoint forget <id> \xB7 /checkpoint <name> to add",
      checkpointForgetUsage: "usage: /checkpoint forget <id|name>",
      checkpointNoMatch: '\u25B8 no checkpoint matching "{name}" \u2014 see /checkpoint list',
      checkpointDeleted: "\u25B8 deleted checkpoint {id} ({name})",
      checkpointDeleteFailed: "\u25B8 failed to delete {id} (already gone?)",
      checkpointSaveUsage: "usage: /checkpoint <name>   (or /checkpoint list to see existing)",
      checkpointSavedEmpty: `\u25B8 checkpoint "{name}" saved ({id}) \u2014 but no files have been touched yet, so it's an empty baseline. Edits made after this point will be revertable.`,
      checkpointSaved: '\u25B8 checkpoint "{name}" saved ({id}) \u2014 {files} file{s}, {size} KB. Restore: /restore {name}',
      restoreCodeOnly: "/restore is only available inside `reasonix code`.",
      restoreUsage: "usage: /restore <name|id>   (see /checkpoint list for ids)",
      restoreNoMatch: '\u25B8 no checkpoint matching "{target}" \u2014 try /checkpoint list',
      restoreInfo: '\u25B8 restored "{name}" ({id}) from {when}',
      restoreWrote: "  \xB7 wrote back {count} file{s}",
      restoreRemoved: "  \xB7 removed {count} file{s} (didn't exist at checkpoint time)",
      restoreSkipped: "  \u2717 {count} file{s} skipped:",
      cwdCodeOnly: "/cwd is only available inside `reasonix code`.",
      cwdUsage: "usage: /cwd <path>   (current root: {current}). Re-points filesystem / shell / memory tools to <path>.",
      cwdUsageNoCurrent: "usage: /cwd <path>   re-points the workspace root to <path>."
    },
    model: {
      modelHint: "try deepseek-v4-flash or deepseek-v4-pro \u2014 run /models to fetch the live list",
      modelUsage: "usage: /model <id>   ({hint})",
      modelNotInCatalog: "model \u2192 {id}   (\u26A0 not in the fetched catalog: {list}. If this is wrong the next call will 400 \u2014 run /models to refresh.)",
      modelSet: "model \u2192 {id}",
      presetAuto: "preset \u2192 auto  (v4-flash \u2192 v4-pro on hard turns \xB7 default)",
      presetFlash: "preset \u2192 flash  (v4-flash always \xB7 cheapest \xB7 /pro still bumps one turn)",
      presetPro: "preset \u2192 pro  (v4-pro always \xB7 ~3\xD7 flash \xB7 for hard multi-turn work)",
      presetUsage: "usage: /preset <auto|flash|pro>",
      proNothingArmed: "nothing armed \u2014 /pro with no args will arm pro for your next turn",
      proDisarmed: "\u25B8 /pro disarmed \u2014 next turn falls back to the current preset",
      proUsage: "usage: /pro       arm pro for the next turn (one-shot, auto-disarms after)\n       /pro off  cancel armed state before the next turn",
      proArmed: "\u25B8 /pro armed \u2014 your NEXT message runs on {model} regardless of preset. Auto-disarms after one turn. Use /preset max for a persistent switch.",
      budgetNoCap: "no session budget set \u2014 Reasonix will keep going until you stop it. Set one with: /budget <usd>   (e.g. /budget 5)",
      budgetStatus: "budget: ${spent} of ${cap} ({pct}%) \xB7 /budget off to clear, /budget <usd> to change",
      budgetOff: "budget \u2192 off (no cap)",
      budgetUsage: 'usage: /budget <usd>   (got "{arg}" \u2014 must be a positive number, e.g. /budget 5 or /budget 12.50)',
      budgetExhausted: "\u25B2 budget \u2192 ${cap} but already spent ${spent}. Next turn will be refused \u2014 bump the cap higher to keep going, or end the session.",
      budgetSet: "budget \u2192 ${cap}  (so far: ${spent} \xB7 warns at 80%, refuses next turn at 100% \xB7 /budget off to clear)"
    },
    permissions: {
      mutateCodeOnly: "/permissions add / remove / clear are only available inside `reasonix code` \u2014 they edit the project-scoped allowlist (`~/.visionox/config.json` projects[<root>].shellAllowed).",
      addUsage: 'usage: /permissions add <prefix>   (multi-token OK: /permissions add "git push origin")',
      addAlready: "\u25B8 already allowed: {prefix}",
      addBuiltin: "\u25B8 `{prefix}` is already in the builtin allowlist \u2014 no per-project entry needed. (Builtin entries are always on.)",
      addInfo: "\u25B8 added: {prefix}\n  \u2192 next `{prefix}` invocation runs without prompting in this project.",
      removeUsage: "usage: /permissions remove <prefix-or-index>   (e.g. /permissions remove 3, or /permissions remove npm)",
      removeEmpty: "\u25B8 no project allowlist entries to remove.",
      removeIndexOob: "\u25B8 index out of range: {idx} (project list has {count} entries)",
      removeNothing: "\u25B8 nothing to remove.",
      removeBuiltin: "\u25B8 `{prefix}` is in the builtin allowlist (read-only). Builtin entries can't be removed at runtime \u2014 they're baked into the binary.",
      removeInfo: "\u25B8 removed: {prefix}",
      removeNotFound: "\u25B8 no such project entry: {prefix}   (try /permissions list to see what's stored)",
      clearAlready: "\u25B8 project allowlist is already empty.",
      clearConfirm: "about to drop {count} project allowlist entr{plural} for {root}. Re-run with the word 'confirm' to proceed: /permissions clear confirm",
      clearedNone: "\u25B8 project allowlist was already empty \u2014 nothing changed.",
      cleared: "\u25B8 cleared {count} project allowlist entr{plural}.",
      usage: 'usage: /permissions [list]                   show current state\n       /permissions add <prefix>            persist (e.g. "npm run build")\n       /permissions remove <prefix-or-N>    drop one entry\n       /permissions clear confirm           wipe every project entry',
      modeYolo: "\u25B8 edit mode: YOLO  \u2014 every shell command auto-runs, allowlist is bypassed. /mode review to re-enable prompts.",
      modeAuto: "\u25B8 edit mode: auto  \u2014 edits auto-apply, shell still gated by allowlist (or ShellConfirm prompt for non-allowlisted).",
      modeReview: "\u25B8 edit mode: review \u2014 both edits and non-allowlisted shell commands ask before running.",
      projectHeader: "Project allowlist ({count}) \u2014 {root}",
      projectNone1: '  (none \u2014 pick "always allow" on a ShellConfirm prompt to add one,',
      projectNone2: "   or `/permissions add <prefix>` directly.)",
      projectNoRoot: "Project allowlist \u2014 (no project root; chat mode shows builtin entries only)",
      builtinHeader: "Builtin allowlist ({count}) \u2014 read-only, baked in",
      subcommands: "Subcommands: /permissions add <prefix> \xB7 /permissions remove <prefix-or-N> \xB7 /permissions clear confirm"
    },
    dashboard: {
      notAvailable: "/dashboard is not available in this context (no startDashboard callback wired).",
      stopNoCallback: "/dashboard stop: no stop callback wired.",
      notRunning: "\u25B8 dashboard is not running.",
      stopping: "\u25B8 dashboard stopping\u2026",
      alreadyRunning: "\u25B8 dashboard is already running:",
      alreadyRunningHint: "Open it in any browser. Type `/dashboard stop` to tear it down.",
      ready: "\u25B8 dashboard ready:",
      readyHint: "127.0.0.1 only \xB7 token-gated. Type `/dashboard stop` to shut down.",
      failed: "\u25B8 dashboard failed to start: {reason}",
      starting: "\u25B8 starting dashboard server\u2026"
    },
    observability: {
      contextInfo: "context: ~{total} of {max} ({pct}%) \xB7 system {sys} \xB7 tools {tools} \xB7 log {log}",
      compactStarting: "\u25B8 folding older turns into a summary\u2026",
      compactNoop: "\u25B8 nothing to fold \u2014 log already small or recent turns alone exceed the budget.",
      compactDone: "\u25B8 folded {before} messages \u2192 {after} (summary {chars} chars). Continuing.",
      compactFailed: "\u25B8 fold failed: {reason}",
      costNoTurn: "no turn yet \u2014 `/cost` shows the most recent turn's token + spend breakdown.",
      costNeedsTui: "/cost needs a TUI context (postUsage wired).",
      costNoPricing: '\u25B8 /cost: no pricing table for model "{model}". Add one to telemetry/stats.ts.',
      costEstimate: "\u25B8 /cost estimate \xB7 {model} \xB7 {prompt} prompt tokens (sys {sys} + tools {tools} + log {log} + msg {msg})",
      costWorstCase: "  worst case (full miss): {input} input + ~{output} output ({avg} avg) \u2248 {total}",
      costLikely: "  likely ({pct}% session cache hit): {input} input + ~{output} output \u2248 {total}",
      costLikelyCold: "  likely: matches worst case until cache fills (no completed turns yet)",
      statusModel: "  model   {model}",
      statusFlags: "  flags   stream={stream} \xB7 effort={effort}",
      statusCtx: "  ctx     {bar} {used}/{max} ({pct}%)",
      statusCtxNone: "  ctx     no turns yet",
      statusCost: "  cost    ${cost} \xB7 cache {bar} {pct}% \xB7 turns {turns}",
      statusCostCold: "  cost    ${cost} \xB7 turns {turns} (cache warming up)",
      statusBudget: "  budget  ${spent} / ${cap} ({pct}%){tag}",
      statusSession: '  session "{name}" \xB7 {count} messages in log (resumed {resumed})',
      statusSessionEphemeral: "  session (ephemeral \u2014 no persistence)",
      statusWorkspace: "  workspace {path} \xB7 pinned at launch (relaunch with --dir <path> to switch)",
      statusMcp: "  mcp     {servers} server(s), {tools} tool(s) in registry",
      statusEdits: "  edits   {count} pending (/apply to commit, /discard to drop)",
      statusPlan: "  plan    ON \u2014 writes gated (submit_plan + approval)",
      statusModeYolo: "  mode    YOLO \u2014 edits + shell auto-run with no prompt (/undo still rolls back \xB7 Shift+Tab to flip)",
      statusModeAuto: "  mode    AUTO \u2014 edits apply immediately (u to undo within 5s \xB7 Shift+Tab to flip)",
      statusModeReview: "  mode    review \u2014 edits queue for /apply or y  (Shift+Tab to flip)",
      statusDash: "  dash    {url} (open in browser \xB7 /dashboard stop)"
    },
    plans: {
      noSession: "no session attached \u2014 `/plans` is per-session. Run `reasonix code` in a project to get a session.",
      activePlan: "\u25B8 active plan{label} \u2014 {done}/{total} step{s} done \xB7 last touched {when}",
      activeNone: "\u25B8 active plan: (none)",
      noArchives: "no archived plans yet for this session \u2014 they auto-archive when every step is done",
      archivedHeader: "Archived ({count}):",
      replayNoSession: "no session attached \u2014 `/replay` is per-session. Run `reasonix code` in a project to get a session.",
      replayNoArchives: "no archived plans yet for this session \u2014 `/replay` lights up once a plan completes (auto-archives when every step is done).",
      replayInvalidIndex: "invalid index \u2014 `/replay` takes 1..{max} (newest = 1). Use `/plans` to see the list.",
      archivedRow: "  \u2713 {when}  {total} step{s} \xB7 {completion}  {label}",
      completionComplete: "complete",
      stopAborted: "\u25B8 plan stopped \u2014 model aborted; type a follow-up to continue or start a new task.",
      doneUsage: "usage: /plans done <stepId>  \xB7  /plans done all \u2014 manual override when the model forgot to call mark_step_complete",
      doneUnavailable: "/plans done is only available inside an active session.",
      doneNoPlan: "no active plan \u2014 nothing to mark done.",
      doneNotInPlan: "step `{id}` is not in the active plan. Run /plans to see the step ids.",
      doneAlready: "step `{id}` was already marked done.",
      doneOk: "\u25B8 marked step `{id}` done.",
      doneAllNoop: "every step is already done.",
      doneAllOk: "\u25B8 marked {count} step(s) done."
    },
    jobs: {
      codeOnly: "/jobs is only available inside `reasonix code`.",
      killCodeOnly: "/kill is only available inside `reasonix code`.",
      logsCodeOnly: "/logs is only available inside `reasonix code`.",
      empty: "\u25C8 jobs \xB7 0 running \xB7 0 total\n  (run_background spawns one \u2014 dev servers, watchers, long-running scripts)",
      header: "\u25C8 jobs \xB7 {running} running \xB7 {total} total",
      footer: "  /logs <id> tail \xB7 /kill <id> SIGTERM \u2192 SIGKILL",
      killUsage: "usage: /kill <id>   (see /jobs for ids)",
      killNotFound: "job {id}: not found",
      killAlreadyExited: "job {id} already exited ({code})",
      killStopping: "\u25B8 stopping job {id} (tree kill: SIGTERM \u2192 SIGKILL after 2s grace; Windows: taskkill /T /F)",
      killStatus: "\u25B8 job {id} {status}",
      killStillAlive: "still alive after SIGKILL (!) \u2014 report this as a bug",
      logsUsage: "usage: /logs <id> [lines]   (default last 80 lines)",
      logsNotFound: "job {id}: not found",
      logsStatus: "[job {id} \xB7 {status}]\n$ {command}",
      logsRunning: "running \xB7 pid {pid}",
      logsExited: "exited {code}",
      logsFailed: "failed ({reason})",
      logsStopped: "stopped"
    },
    memory: {
      disabled: "memory is disabled (REASONIX_MEMORY=off in env). Unset the var to re-enable \u2014 no visionox.md or ~/.visionox/memory content will be pinned in the meantime.",
      noRoot: "no working directory on this session \u2014 `/memory` needs a root to resolve visionox.md from. (Running in a test harness?)",
      listEmpty: "no user memories yet. The model can call `remember` to save one, or you can create files by hand in ~/.visionox/memory/global/ or the per-project subdir.",
      listHeader: "User memories ({count}):",
      listFooter: "View body: /memory show <name>   Delete: /memory forget <name>",
      showUsage: "usage: /memory show <name>  or  /memory show <scope>/<name>",
      showNotFound: "no memory found: {target}",
      showFailed: "show failed: {reason}",
      forgetUsage: "usage: /memory forget <name>  or  /memory forget <scope>/<name>",
      forgetNotFound: "no memory found: {target}",
      forgetInfo: "\u25B8 forgot {scope}/{name}. Next /new or launch won't see it.",
      forgetFailed: "could not forget {scope}/{name} (already gone?)",
      forgetError: "forget failed: {reason}",
      clearUsage: "usage: /memory clear <global|project> confirm",
      clearConfirm: "about to delete every memory in scope={scope}. Re-run with the word 'confirm' to proceed: /memory clear {scope} confirm",
      cleared: "\u25B8 cleared scope={scope} \u2014 deleted {count} memory file(s).",
      noMemory: "no memory pinned in {root}.",
      layers: "Three layers are available:",
      layerProject: "  1. {file} \u2014 committable team memory (in the repo).",
      layerGlobal: "  2. ~/.visionox/memory/global/ \u2014 your cross-project private memory.",
      layerProjectHash: "  3. ~/.visionox/memory/<project-hash>/ \u2014 this project's private memory.",
      askModel: "Ask the model to `remember` something, or hand-edit files directly.",
      changesNote: "Changes take effect on next /new or launch \u2014 the system prompt is hashed once per session to keep the prefix cache warm.",
      subcommands: "Subcommands: /memory list | /memory show <name> | /memory forget <name> | /memory clear <scope> confirm",
      changesNoteShort: "Changes take effect on next /new or launch. Subcommands: /memory list | show | forget | clear"
    },
    mcp: {
      noServers: 'no MCP servers attached. Run `reasonix setup` to pick some, or launch with --mcp "<spec>". `reasonix mcp list` shows the catalog.',
      toolsLabel: "  tools     {count}",
      resourcesHint: "`/resource` to browse+read",
      promptsHint: "`/prompt` to browse+fetch",
      awarenessOnly: "Chat mode consumes tools today; resources+prompts are surfaced here for awareness.",
      catalogHint: "Full catalog: `reasonix mcp list` \xB7 deeper diagnosis: `reasonix mcp inspect <spec>`.",
      fallbackServers: "MCP servers ({count}):",
      fallbackTools: "Tools in registry ({count}):",
      fallbackChange: "To change this set, exit and run `reasonix setup`.",
      usageDisableEnable: "usage: /mcp {action} <name>  \xB7  pick a name shown in /mcp (anonymous servers can't be named-toggled).",
      usageReconnect: "usage: /mcp reconnect <name>  \xB7  pick a name shown in /mcp.",
      unknownServer: 'unknown MCP server "{name}". Known: {list}.',
      noneList: "(none)",
      reconnectNoTui: "/mcp reconnect requires the interactive TUI (postInfo not wired).",
      liveTab: "Live",
      marketplaceTab: "Marketplace",
      tabHint: "tab to switch"
    },
    init: {
      codeOnly: "/init only works in code mode (it needs filesystem tools).\nRun `reasonix code [path]` to start a session rooted at the\nproject you want to initialize, then run /init.",
      exists: "\u25B8 visionox.md already exists at {path}",
      existsForce: "  /init force   regenerate from scratch (overwrites)",
      existsEdit: "  Or edit it by hand \u2014 it's just markdown. The current file is",
      existsPinned: "  pinned into the system prompt every launch as-is.",
      info: "\u25B8 /init \u2014 model will scan the project and synthesize visionox.md.\n  The result lands as a pending edit; review with /apply or /walk."
    },
    webSearchEngine: {
      currentEngine: "Current web search engine: {engine}",
      endpoint: "SearXNG endpoint: {url}",
      usageHeader: "Usage:",
      usageMojeek: "  /search-engine mojeek            use Mojeek (default, no external deps)",
      usageSearxng: "  /search-engine searxng            use SearXNG at default endpoint",
      usageSearxngUrl: "  /search-engine searxng <url>      use SearXNG at custom endpoint",
      alias: "Alias: /se",
      searxngInfo: "SearXNG is a self-hosted metasearch engine (https://github.com/searxng/searxng).",
      searxngInstall: "Install it with:  docker run -d -p 8080:8080 searxng/searxng",
      switched: 'Switched web search engine to "{engine}".{note}',
      switchedSearxngNote: " Make sure SearXNG is running at {endpoint}.",
      confirmed: '\u2713 Web search engine set to "{engine}"{detail}. Next assistant turn will pick up the change.',
      confirmedDetail: " ({endpoint})"
    },
    skill: {
      listEmpty: "no skills found. Reasonix reads skills from:",
      listProjectScope: "  \xB7 <project>/.visionox/skills/<name>/SKILL.md  (or <name>.md)  \u2014 project scope",
      listGlobalScope: "  \xB7 ~/.visionox/skills/<name>/SKILL.md  (or <name>.md)  \u2014 global scope",
      listProjectOnly: "  (project scope is only active in `reasonix code`)",
      listFrontmatter: "Each file's frontmatter needs at least `name` and `description`.",
      listInvoke: "Invoke a skill with `/skill <name> [args]` or by asking the model to call `run_skill`.",
      listHeader: "User skills ({count}):",
      listFooter: "View: /skill show <name>   Run: /skill <name> [args]   New: /skill new <name>",
      listEmptyNewHint: "Scaffold one with: /skill new <name>  (project scope) \u2014 there's no remote registry yet; you author skills directly.",
      showUsage: "usage: /skill show <name>",
      showNotFound: "no skill found: {name}",
      runNotFound: "no skill found: {name}  (try /skill list)",
      runInfo: "\u25B8 running skill: {name}{args}",
      newUsage: "usage: /skill new <name> [--global]",
      newCreated: "\u25B8 created skill: {name}\n  {path}\n  edit it, then `/skill {name}` to invoke",
      newError: "\u25B2 /skill new failed: {reason}"
    }
  },
  statusBar: {
    turn: "turn",
    cache: "cache",
    spent: "spent",
    left: " left",
    slow: "slow",
    disconnect: "disconnect",
    reconnecting: "reconnecting\u2026",
    approvingIn: "approving in ",
    escToInterrupt: "s \xB7 esc to interrupt",
    recordingGlyph: "\u25CFREC",
    mb: " MB",
    evt: " evt",
    editsLabel: "edits:",
    mcpLoading: "MCP"
  },
  editMode: {
    plan: "PLAN MODE",
    yolo: "YOLO",
    auto: "AUTO",
    review: "REVIEW",
    writesGated: "   writes gated \xB7 /plan off to leave",
    editsShellAuto: "edits + shell auto \xB7 /undo to roll back",
    editsLandNow: "edits land now \xB7 u to undo",
    queuedApplyDiscard: "{count} queued \xB7 y apply \xB7 n discard",
    editsQueued: "edits queued \xB7 y apply \xB7 n discard",
    shiftTabFlip: "   {mid} \xB7 Shift+Tab to flip",
    queuedDots: "queued\u2026"
  },
  composer: {
    placeholder: "ask anything  \xB7  slash for commands  \xB7  at-sign for files",
    waitingForResponse: "\u2026waiting for response\u2026",
    hintSend: "send",
    hintNewline: "newline",
    hintClear: "clear",
    hintScroll: "scroll",
    hintHistory: "history",
    hintAbort: "abort",
    hintQuit: "quit",
    abortedHint: "turn aborted by user \xB7 esc again to clear \xB7 \u23CE to ask a follow-up",
    editorNoRawMode: "external editor unavailable \u2014 stdin doesn't support raw-mode toggling on this terminal",
    editorFailed: "external editor:",
    editorMissing: "no $EDITOR / $VISUAL / $GIT_EDITOR set \u2014 export one (e.g. `export EDITOR=nano`) and retry",
    editorExited: "editor exited with code {code}"
  },
  pathConfirm: {
    title: "Outside-sandbox path",
    subtitleRead: "{tool} wants to READ a file outside the project sandbox",
    subtitleWrite: "{tool} wants to WRITE a file outside the project sandbox",
    awaiting: "awaiting",
    denyTitle: "Deny \u2014 provide context",
    optional: "optional",
    denyFooter: "type context  \xB7  \u23CE submit with reason  \xB7  esc skip (deny without reason)",
    pickFooter: "\u2191\u2193 pick  \xB7  \u23CE confirm  \xB7  Tab add context  \xB7  esc cancel",
    allowOnce: "allow once",
    allowOnceDesc: "permit this access; remember the directory for the rest of this session",
    allowAlways: "allow always",
    allowAlwaysDesc: "remember `{prefix}` for this project (persisted in ~/.visionox/config.json)",
    deny: "deny",
    denyDesc: "press Tab to add context telling the model why",
    pathLabel: "path",
    sandboxLabel: "sandbox",
    allowPrefixLabel: "prefix"
  },
  shellConfirm: {
    title: "Shell command",
    bgTitle: "Background process",
    subtitle: "model wants to run a shell command",
    bgSubtitle: "long-running process \u2014 keeps running after approval, /kill to stop",
    denyTitle: "Deny \u2014 provide context",
    optional: "optional",
    denyFooter: "type context  \xB7  \u23CE submit with reason  \xB7  esc skip (deny without reason)",
    awaiting: "awaiting",
    pickFooter: "\u2191\u2193 pick  \xB7  \u23CE confirm  \xB7  Tab add context  \xB7  esc cancel",
    allowOnce: "allow once",
    allowOnceDesc: "run this command, ask again next time",
    allowAlways: "allow always",
    allowAlwaysDesc: "remember `{prefix}` for this project",
    deny: "deny",
    denyDesc: "press Tab to add context telling the model why",
    cwdLabel: "cwd",
    timeoutLabel: "timeout",
    waitLabel: "wait",
    previewMore: "\u2026 {n} more line hidden \u2014 press esc, ask the model to split it",
    previewMorePlural: "\u2026 {n} more lines hidden \u2014 press esc, ask the model to split it"
  },
  editConfirm: {
    footer: "[y/Enter] apply  \xB7  [n] reject with reason  \xB7  [a] apply rest  \xB7  [A] flip AUTO  \xB7  [\u2191\u2193/Space] scroll  \xB7  [Esc] abort",
    newTag: "NEW",
    editTag: "EDIT",
    linesCount: "-{removed} +{added} lines",
    viewingRange: "viewing {start}-{end}/{total}",
    denyFooter: "\u23CE submit  \xB7  esc skip (deny without reason)",
    oldLabel: "  - old",
    newLabel: "  + new",
    sideBySide: "   side-by-side \xB7 removed lines on the left, added on the right \xB7 paired by offset",
    linesAbove: "  \u2191 {count} line above  (\u2191/k or PgUp)",
    linesAbovePlural: "  \u2191 {count} lines above  (\u2191/k or PgUp)",
    linesBelow: "  \u2193 {count} line below  (\u2193/j or Space/PgDn)",
    linesBelowPlural: "  \u2193 {count} lines below  (\u2193/j or Space/PgDn)"
  },
  sessionPicker: {
    header: " \u25C8 REASONIX \xB7 pick a session ",
    title: "pick a session \u2014 {workspace}",
    messages: "{count} message",
    messagesPlural: "{count} messages",
    turns: "{count} turns",
    pickerHint: "\u2191\u2193 pick \xB7 \u23CE open \xB7 [n] new \xB7 [d] delete \xB7 [r] rename \xB7 esc quit",
    empty: "  no saved sessions in this workspace yet \u2014 press ",
    emptyNew: " to start a new one",
    renamePrompt: '  rename "{from}" \u2192 ',
    renameHint: "  \u23CE confirm rename  \xB7  esc cancel",
    emptyHint: "  \u23CE new session  \xB7  esc quit",
    justNow: "just now",
    minAgo: "{count} min ago",
    yesterday: "yesterday",
    hoursAgo: "{count}h ago",
    daysAgo: "{count} days ago"
  },
  modelPicker: {
    header: " \u25C8 REASONIX \xB7 pick a setup ",
    loading: "  \xB7  loading catalog\u2026",
    catalogEmpty: "  \xB7  catalog empty \u2014 using known fallbacks",
    modelsAvailable: "  \xB7  {count} models available",
    presetsHeader: "    PRESETS  \xB7  recommended \u2014 model + effort + auto-escalate",
    modelsHeader: "    MODELS  \xB7  raw pick \u2014 auto-escalate stays as-is",
    pickerFooter: "  \u2191\u2193 pick  \xB7  \u23CE confirm  \xB7  [r] refresh  \xB7  esc cancel",
    currentLabel: "  \xB7 current"
  },
  slashSuggestions: {
    noMatch: "no slash command matches that prefix",
    backspaceHint: " \u2014 Backspace to edit, or /help for the full list",
    commandCount: "{count} command",
    commandCountPlural: "{count} commands",
    aboveLabel: "   \u2191 {count} above",
    belowLabel: "   \u2193 {count} below",
    advancedHint: "  + {count} advanced  \xB7  type a letter to search",
    footerHint: "  \u2191\u2193 navigate \xB7 Tab / \u23CE pick \xB7 esc cancel",
    groupChat: "CHAT",
    groupSetup: "SETUP",
    groupInfo: "INFO",
    groupSession: "SESSION",
    groupExtend: "EXTEND",
    groupCode: "CODE",
    groupJobs: "JOBS",
    groupAdvanced: "ADVANCED",
    groupDetailSetup: "model + cost",
    groupDetailInfo: "current state",
    groupDetailChat: "daily turn ops",
    groupDetailExtend: "MCP, memory, skills",
    groupDetailSession: "saved sessions",
    groupDetailCode: "edits + plans (code mode)",
    groupDetailJobs: "background processes (code mode)",
    groupDetailAdvanced: "rare or set-and-forget"
  },
  atMentions: {
    loading: "loading\u2026",
    entrySingular: "{count} entry",
    entryPlural: "{count} entries",
    searching: "searching\u2026",
    scanned: "scanned",
    match: "match",
    matches: "matches",
    forFilter: 'for "{filter}"',
    noMatch: 'no files match "{filter}"',
    emptyDir: "empty directory",
    scanning: "scanning the tree\u2026",
    footerBrowse: "\u2191\u2193 navigate \xB7 Tab drill into folder \xB7 \u23CE insert \xB7 esc cancel",
    footerBrowseSearch: "\u2191\u2193 navigate \xB7 Tab / \u23CE insert as @path \xB7 esc cancel",
    footerInsert: "\u2191\u2193 navigate \xB7 Tab / \u23CE insert as @path \xB7 esc cancel"
  },
  statsPanel: {
    modePlan: "PLAN",
    modeYolo: "yolo",
    modeAuto: "auto",
    modeReview: "review",
    pro: "\u21E7 pro",
    budget: "  budget  "
  },
  welcomeBanner: {
    workspace: "\u25B8 workspace",
    relaunchHint: "  (relaunch with --dir <path> to switch)",
    dashboard: "\u25B8 web"
  },
  ctxBreakdown: {
    title: "\u25A3 context",
    compactHint: "  /compact folds (auto at 50%) \xB7 /new wipes log",
    topTools: "  top tool results by cost ({count}):",
    msg: "msg",
    turnLabel: "turn"
  },
  startup: {
    codeRooted: '\u25B8 reasonix code: rooted at {rootDir}, session "{session}" \xB7 {tools} native tool(s){semantic}',
    ephemeral: "(ephemeral)",
    semanticOn: " \xB7 semantic_search on"
  },
  doctorErrors: {
    unreadable: "{path} unreadable \u2014 {message}",
    cannotList: "cannot list \u2014 {message}",
    parseFailed: "couldn't parse settings.json \u2014 {message}",
    probeFailed: "probe failed \u2014 {message}"
  },
  webErrors: {
    status: "web_search {status} \u2014 try: the search backend returned an error; rephrase the query, or switch engine with /search-engine mojeek|searxng",
    rateLimit429: "web_search 429 \u2014 try: wait 10s before retrying, or rephrase the query; the search backend is rate-limiting this client",
    forbidden403: "web_search 403 \u2014 try: the search backend is blocking this client; switch engine with /search-engine mojeek|searxng, or wait and retry later",
    serverError5xx: "web_search {status} \u2014 try: open the search URL in a browser; if it loads this is transient and a retry in 30s may help",
    mojeekBlocked: "web_search: Mojeek anti-bot page \u2014 rate-limited or blocked \u2014 try: wait 30s and retry, or switch engine with /search-engine searxng",
    mojeekNoResults: "web_search: 0 results but response doesn't look like a real empty page ({chars} chars, first 120: {preview}) \u2014 try: rephrase the query with simpler terms, or switch engine with /search-engine searxng",
    invalidEndpoint: 'web_search: invalid SearXNG endpoint "{endpoint}" \u2014 try: set a valid URL with /search-endpoint http://host:port',
    endpointMustBeHttp: "web_search: SearXNG endpoint must be http(s), got {protocol} \u2014 try: set a valid URL with /search-endpoint http://host:port",
    cannotReach: "web_search: Cannot reach SearXNG server at {endpoint} \u2014 try: install and start SearXNG (https://github.com/searxng/searxng, e.g. `docker run -d -p 8080:8080 searxng/searxng`), or switch to the default engine with /search-engine mojeek",
    searxngNoResults: "web_search: 0 results but SearXNG response doesn't look like an empty results page ({chars} chars) \u2014 try: rephrase the query with simpler terms, or switch engine with /search-engine mojeek",
    fetchStatus: "web_fetch {status} for {url} \u2014 try: confirm the URL resolves in a browser; status suggests the host returned an error page",
    fetchRateLimit429: "web_fetch 429 for {url} \u2014 try: wait 10s before retrying; the host is rate-limiting this client",
    fetchForbidden403: "web_fetch 403 for {url} \u2014 try: the host is blocking this client; the page may require login or block bots \u2014 use web_search snippets instead",
    fetchServerError5xx: "web_fetch {status} for {url} \u2014 try: open the URL in a browser; if it loads this is transient and a retry in 30s may help",
    fetchTimeout: "web_fetch: timed out after {ms}ms for {url} \u2014 try: a shorter URL or smaller content; this may be a slow CDN, or retry once",
    fetchTooLarge: "web_fetch refused: content-length {len} bytes exceeds {cap}-byte cap ({url}) \u2014 try: a different URL with smaller content; this page is too large to fetch",
    fetchBodyTooLarge: "web_fetch refused: response body exceeded {cap}-byte cap ({seen} bytes seen) \u2014 try: a different URL with smaller content; this page streamed past the size cap",
    fetchInvalidUrl: "web_fetch: url must start with http:// or https:// \u2014 try: pass an absolute http(s) URL (the URL is malformed or uses an unsupported scheme)"
  },
  choiceConfirm: {
    customLabel: "Let me type my own answer",
    customDesc: "None of the above fits \u2014 type a free-form reply. The model reads it verbatim.",
    cancelLabel: "Cancel \u2014 drop the question",
    cancelDesc: "Model stops and asks what you want instead."
  },
  cardTitles: {
    usage: "usage",
    context: "context",
    search: "search",
    subagent: "subagent",
    reply: "reply",
    reasoning: "reasoning",
    reasoningAborted: "reasoning (aborted)",
    reasoningEllipsis: "reasoning\u2026",
    error: "error",
    doctor: "doctor",
    you: "you",
    task: "task"
  },
  cardLabels: {
    prompt: "prompt",
    reason: "reason",
    output: "output",
    cache: "cache",
    session: "session",
    balance: "balance",
    turn: "turn",
    system: "system",
    tools: "tools",
    log: "log",
    input: "input",
    topTools: "top tools",
    logMsgs: "log msgs",
    hitSingular: "{count} hit \xB7 {files} file",
    hitsPlural: "{count} hits \xB7 {files} files",
    moreHitSingular: "\u22EE +{count} more hit",
    moreHitsPlural: "\u22EE +{count} more hits",
    earlierLine: "\u22EE {count} earlier line (use /tool to read full)",
    earlierLines: "\u22EE {count} earlier lines (use /tool to read full)",
    earlierStackLine: "\u22EE {count} earlier stack line hidden",
    earlierStackLines: "\u22EE {count} earlier stack lines hidden",
    agent: "agent \xB7 {name}",
    response: "response",
    writing: "writing \u2026",
    tok: "tok",
    pilcrow: "\xB6",
    aborted: "aborted",
    truncatedByEsc: "[truncated by esc]",
    rejected: "rejected",
    exit: "exit {code}",
    bytesIn: "{bytes} in",
    elapsedSec: "{secs}s",
    stackTrace: "stack trace",
    retries: "retries",
    reasoningLabel: "reasoning \xB7 {count} \xB6",
    runningLabel: "running",
    workingLabel: "working",
    defaultFooter: "\u2191\u2193 pick  \xB7  \u23CE confirm  \xB7  esc cancel",
    applyAction: "[a] apply",
    skipAction: "[s] skip",
    rejectAction: "[r] reject",
    levelOk: "OK",
    levelWarn: "warn",
    levelFail: "FAIL",
    checksLabel: "checks",
    passed: "passed",
    warnTag: "warn",
    failTag: "fail",
    stepLabel: "step",
    done: "done",
    inProgress: "\u2190 in progress",
    upcoming: "upcoming",
    resumed: "resumed \xB7 ",
    archive: "\u23EA archive \xB7 ",
    more: "\u22EE +{count} more",
    categoryUser: "user",
    categoryFeedback: "feedback",
    categoryProject: "project",
    categoryReference: "reference"
  },
  copyMode: {
    title: "\u2500\u2500 COPY MODE \u2500\u2500",
    help: "j/k or \u2191/\u2193 move \xB7 v select \xB7 y yank \xB7 g/G top/bottom \xB7 q quit",
    statusBar: "line {cur}/{total} \xB7 selection: {sel}",
    statusYanked: "yanked {size} chars (osc52={osc52})",
    statusEmpty: "nothing selected",
    empty: "(no chat content yet \u2014 say something to the model first)",
    labelUser: "you",
    labelAssistant: "assistant",
    labelReasoning: "reasoning",
    yankedToast: "\u25B8 copied {size} chars to clipboard (osc52)",
    yankedToastFile: "\u25B8 copied {size} chars \xB7 file: {path}"
  },
  mcpHealth: {
    noData: "no inspect data",
    healthy: "healthy \xB7 {ms}ms",
    slow: "slow \xB7 {ms}ms",
    verySlow: "very slow \xB7 {ms}ms",
    slowToast: "\u26A0 MCP `{name}` slow \xB7 {seconds}s p95 over the last {sampleSize} calls",
    emptyHint: "\u2139 no MCP servers configured \u2014 try: `reasonix setup` to re-pick, or `reasonix mcp install filesystem`"
  },
  denyContextInput: {
    description: "Tell the agent why you denied this. The next attempt will see your reason as additional context."
  },
  cardStream: {
    scrollAbove: " \u2191 {scroll} / {max} row above",
    scrollAbovePlural: " \u2191 {scroll} / {max} rows above",
    scrollMore: " \u2014 {remaining} more",
    scrollPgUp: " \xB7 PgUp / wheel / \u2191"
  },
  slashArgPicker: {
    noMatch: 'no match for "{partial}"',
    keepTyping: " \u2014 keep typing, or Backspace to edit",
    above: "   \u2191 {hidden} above",
    below: "   \u2193 {hidden} below",
    footer: "  \u2191\u2193 navigate \xB7 Tab / \u23CE pick \xB7 esc cancel"
  },
  mcpMarketplace: {
    title: "MCP marketplace",
    filter: "filter: ",
    filterPlaceholder: "(type to filter)",
    matchSingular: "{n} match",
    matchPlural: "{n} matches",
    loading: "loading\u2026",
    noEntries: "no entries",
    opening: "opening registry\u2026",
    cached: "\xB7 cached",
    exhausted: "\xB7 exhausted",
    loadingMore: "loading more\u2026",
    allLoaded: "all pages loaded",
    fetchingDetail: "fetching smithery detail\u2026",
    noInstallInfo: "no install info for {name} - try `npx -y @smithery/cli install {name}`",
    alreadyInstalled: "already installed: {spec}",
    installed: "installed \u2192 {spec}",
    uninstalled: "uninstalled {name}",
    installFailed: "install failed: {message}",
    notInstalled: "not installed: {name}",
    bridged: "\u2713 installed {name} - bridged",
    bridgeFailed: "\u25B2 installed {name} - bridge failed: {reason}",
    bridgeReloadFailed: "\u2713 installed {name} - restart `reasonix code` to bridge (reload failed: {message})",
    restartBridge: "\u2713 installed {name} - restart `reasonix code` to bridge",
    needsEnv: "  \xB7  needs env: {env}",
    badgeOfficial: "[off]",
    badgeSmithery: "[smt]",
    badgeLocal: "[loc]",
    footerHint: "type filter \xB7 \u2191\u2193 pick \xB7 \u23CE install/toggle \xB7 PgDn load more \xB7 esc close",
    specLine: "spec: {runtime} {id} \xB7 {transport}",
    smitheryDetail: "(smithery listing \u2014 install detail fetched on Enter)",
    statusError: "error: {message}"
  },
  mcpBrowser: {
    title: "\u25C8 MCP browser",
    empty: "No MCP servers attached. Run `reasonix setup` to pick some, or launch with --mcp.",
    serverCount: "{count} server{s}",
    footer: "\u2191\u2193 pick \xB7 [r] reconnect \xB7 [d] disable \xB7 esc quit"
  },
  mcpLifecycle: {
    handshake: "handshake\u2026",
    connected: "connected",
    failed: "failed",
    disabled: "disabled",
    reconnect: "reconnect\u2026",
    initDetail: "initialise \u2192 tools/list \u2192 resources/list",
    reconnectDetail: "tearing down \xB7 re-handshake \xB7 listing tools",
    disabledDetail: "via /mcp disable {name}"
  },
  checkpointPicker: {
    title: "restore a checkpoint \u2014 {workspace}",
    header: " \u25C8 REASONIX \xB7 pick a checkpoint ",
    empty: "  no checkpoints in this workspace yet - see /checkpoint to make one",
    more: "     \u2026 {hidden} more",
    footer: "  \u2191\u2193 pick  \xB7  \u23CE restore  \xB7  [d] forget  \xB7  esc quit",
    footerEmpty: "  esc quit"
  },
  planReviseConfirm: {
    title: "plan revision proposed",
    metaRight: "\u2212{removed}  +{added}  \xB7  {kept} kept",
    updatedSummary: "updated summary: {summary}",
    acceptLabel: "Accept revision - apply the new step list",
    acceptHint: "Replaces the remaining plan with the proposed steps. Done steps are untouched.",
    rejectLabel: "Reject - keep the original plan",
    rejectHint: "Drops the proposal. Model continues with the original remaining steps."
  },
  diffApp: {
    title: "reasonix diff",
    turnLabel: "turn {turn} ({current}/{total})",
    turnsAligned: "{count} turns aligned",
    paneEmpty: "(no records on this side for this turn)",
    kindMatch: "\u2713 match",
    kindDiverge: "\u2605 diverge",
    kindOnlyInA: "\u2190 only in A",
    kindOnlyInB: "\u2192 only in B"
  },
  recordView: {
    userPrefix: "you \u203A ",
    assistant: "assistant",
    toolPrefix: "tool<",
    argsLabel: "  args: ",
    resultArrow: "  \u2192 ",
    error: "error ",
    cache: "  \xB7 cache ",
    toolCallOnly: "(tool-call response only)",
    truncateExtra: "(+{extra} chars)"
  },
  replayApp: {
    emptyTranscript: "empty transcript",
    turnProgress: "turn {current}/{total}",
    noRecords: "no records",
    untracked: "(untracked)",
    churned: "(churned \xD7{count})"
  }
};

// src/i18n/zh-CN.ts
var zhCN = {
  common: {
    error: "\u9519\u8BEF",
    warning: "\u8B66\u544A",
    loading: "\u52A0\u8F7D\u4E2D...",
    done: "\u5B8C\u6210",
    cancel: "\u53D6\u6D88",
    confirm: "\u786E\u8BA4",
    back: "\u8FD4\u56DE",
    next: "\u4E0B\u4E00\u6B65",
    tool: "\u5DE5\u5177",
    running: "\u8FD0\u884C\u4E2D",
    noTurns: "(\u6682\u65E0\u5BF9\u8BDD)"
  },
  cli: {
    description: "DeepSeek \u539F\u751F\u667A\u80FD\u4F53\u6846\u67B6 \u2014 \u4E13\u4E3A\u7F13\u5B58\u547D\u4E2D\u548C\u4F4E\u6210\u672C\u4EE4\u724C\u6784\u5EFA\u3002",
    continue: "\u6062\u590D\u6700\u8FD1\u4F7F\u7528\u7684\u804A\u5929\u4F1A\u8BDD\uFF0C\u4E0D\u663E\u793A\u9009\u62E9\u5668\u3002",
    setup: "\u4EA4\u4E92\u5F0F\u5411\u5BFC \u2014 API \u5BC6\u94A5\u3001\u9884\u8BBE\u3001MCP \u670D\u52A1\u5668\u3002\u968F\u65F6\u91CD\u65B0\u8FD0\u884C\u4EE5\u91CD\u65B0\u914D\u7F6E\u3002",
    code: "\u4EE3\u7801\u7F16\u8F91\u804A\u5929 \u2014 \u4EE5 <dir>\uFF08\u9ED8\u8BA4\uFF1Acwd\uFF09\u4E3A\u6839\u7684\u6587\u4EF6\u7CFB\u7EDF\u5DE5\u5177\uFF0C\u7F16\u7801\u7CFB\u7EDF\u63D0\u793A\u8BCD\uFF0Cv4-flash \u57FA\u7EBF\u3002",
    chat: "\u5177\u6709\u5B9E\u65F6\u7F13\u5B58/\u6210\u672C\u9762\u677F\u7684\u4EA4\u4E92\u5F0F Ink TUI\u3002",
    run: "\u4EE5\u975E\u4EA4\u4E92\u65B9\u5F0F\u8FD0\u884C\u5355\u4E2A\u4EFB\u52A1\uFF0C\u6D41\u5F0F\u8F93\u51FA\u3002",
    stats: "\u663E\u793A\u4F7F\u7528\u60C5\u51B5\u4EEA\u8868\u677F\u3002",
    doctor: "\u4E00\u952E\u5065\u5EB7\u68C0\u67E5\u3002",
    commit: "\u4ECE\u6682\u5B58\u7684\u5DEE\u5F02\u4E2D\u8D77\u8349\u63D0\u4EA4\u6D88\u606F\u3002",
    sessions: "\u5217\u51FA\u4FDD\u5B58\u7684\u804A\u5929\u4F1A\u8BDD\uFF0C\u6216\u6309\u540D\u79F0\u68C0\u67E5\u3002",
    pruneSessions: "\u5220\u9664\u7A7A\u95F2 \u2265N \u5929\u7684\u5DF2\u4FDD\u5B58\u4F1A\u8BDD\uFF08\u9ED8\u8BA4 90\uFF09\u3002\u4F7F\u7528 --dry-run \u9884\u89C8\u3002",
    events: "\u7F8E\u5316\u6253\u5370\u5185\u6838\u4E8B\u4EF6\u65E5\u5FD7\u4FA7\u8FB9\u6587\u4EF6\u3002",
    replay: "\u4EA4\u4E92\u5F0F Ink TUI\uFF0C\u7528\u4E8E\u6D4F\u89C8\u8F6C\u5F55\u7A3F\u3002",
    diff: "\u5728\u5206\u680F Ink TUI \u4E2D\u6BD4\u8F83\u4E24\u4E2A\u8F6C\u5F55\u7A3F\u3002",
    mcp: "\u6A21\u578B\u4E0A\u4E0B\u6587\u534F\u8BAE (MCP) \u52A9\u624B \u2014 \u53D1\u73B0\u670D\u52A1\u5668\uFF0C\u6D4B\u8BD5\u60A8\u7684\u8BBE\u7F6E\u3002",
    version: "\u6253\u5370 Reasonix \u7248\u672C\u3002",
    update: "\u68C0\u67E5\u8F83\u65B0\u7248\u672C\u7684 Reasonix \u5E76\u5B89\u88C5\u3002",
    index: "\u6784\u5EFA\uFF08\u6216\u589E\u91CF\u5237\u65B0\uFF09\u672C\u5730\u8BED\u4E49\u641C\u7D22\u7D22\u5F15\u3002"
  },
  ui: {
    welcome: "\u968F\u65F6\u8FD0\u884C `reasonix` \u5F00\u59CB\u804A\u5929 \u2014 \u60A8\u7684\u8BBE\u7F6E\u5C06\u88AB\u8BB0\u4F4F\u3002",
    taglineChat: "DeepSeek \u539F\u751F\u667A\u80FD\u4F53",
    taglineCode: "DeepSeek \u539F\u751F\u4EE3\u7801\u667A\u80FD\u4F53",
    taglineSub: "\u7F13\u5B58\u4F18\u5148 \xB7 Flash \u4F18\u5148",
    startSessionHint: "\u8F93\u5165\u6D88\u606F\u4EE5\u5F00\u59CB\u60A8\u7684\u4F1A\u8BDD",
    inputPlaceholder: "\u8F93\u5165\u4EFB\u4F55\u5185\u5BB9... (\u8F93\u5165 / \u4F7F\u7528\u547D\u4EE4, @ \u5F15\u7528\u6587\u4EF6)",
    busy: "\u601D\u8003\u4E2D...",
    thinking: "\u25B8 \u601D\u8003\u4E2D...",
    undo: "\u64A4\u6D88",
    undoHint: "\u5728 5 \u79D2\u5185\u6309 u \u64A4\u6D88",
    applied: "\u5DF2\u5E94\u7528",
    rejected: "\u5DF2\u62D2\u7EDD",
    noDashboard: "\u7981\u6B62\u81EA\u52A8\u542F\u52A8\u5D4C\u5165\u5F0F Web \u4EEA\u8868\u677F\u3002",
    dashboardPortHint: "\u5C06\u4EEA\u8868\u677F\u7ED1\u5B9A\u5230\u56FA\u5B9A\u7AEF\u53E3 (1\u201365535)\u3002\u91CD\u542F\u540E\u4FDD\u6301\u7A33\u5B9A \u2014 SSH \u96A7\u9053\u8BBF\u95EE\u5FC5\u9700\u3002\u9ED8\u8BA4\u4E3A\u4E34\u65F6\u7AEF\u53E3\u3002",
    dashboardPortInvalid: "\u25B2 \u5FFD\u7565 --dashboard-port={value} (\u5FC5\u987B\u4E3A 1\u201365535 \u4E4B\u95F4\u7684\u6574\u6570) \u2014 \u56DE\u9000\u5230\u4E34\u65F6\u7AEF\u53E3",
    dashboardAutoStartFailed: "\u25B2 \u4EEA\u8868\u677F\u81EA\u52A8\u542F\u52A8\u5931\u8D25 ({reason}) \u2014 \u5C1D\u8BD5 /dashboard\uFF0C\u6216\u4F20\u9012 --no-dashboard \u4EE5\u9759\u9ED8",
    systemAppendHint: "\u8FFD\u52A0\u6307\u4EE4\u5230\u4EE3\u7801\u7CFB\u7EDF\u63D0\u793A\u8BCD\u3002\u4E0D\u66FF\u6362\u9ED8\u8BA4\u63D0\u793A\u8BCD \u2014 \u5728\u5176\u540E\u6DFB\u52A0\u3002",
    systemAppendFileHint: "\u8FFD\u52A0\u6587\u4EF6\u5185\u5BB9\u5230\u4EE3\u7801\u7CFB\u7EDF\u63D0\u793A\u8BCD\u3002\u4E0D\u66FF\u6362\u9ED8\u8BA4\u63D0\u793A\u8BCD\u3002UTF-8\uFF0C\u76F8\u5BF9\u4E8E cwd \u6216\u7EDD\u5BF9\u8DEF\u5F84\u3002",
    resumedSession: '\u25B8 \u5DF2\u6062\u590D\u4F1A\u8BDD "{name}"\uFF0C\u5305\u542B {count} \u6761\u5386\u53F2\u6D88\u606F \xB7 /new \u91CD\u65B0\u5F00\u59CB \xB7 /sessions \u7BA1\u7406',
    newSession: '\u25B8 \u4F1A\u8BDD "{name}" (\u65B0) \u2014 \u968F\u804A\u968F\u5B58 \xB7 /sessions \u91CD\u547D\u540D\u6216\u5220\u9664',
    ephemeralSession: "\u25B8 \u4E34\u65F6\u804A\u5929 (\u4E0D\u4FDD\u5B58\u4F1A\u8BDD) \u2014 \u53BB\u6389 --no-session \u4EE5\u542F\u7528\u4FDD\u5B58",
    restoredEdits: "\u25B8 \u4ECE\u4E2D\u65AD\u7684\u8FD0\u884C\u4E2D\u6062\u590D\u4E86 {count} \u4E2A\u5F85\u5904\u7406\u7684\u7F16\u8F91\u5757 \u2014 /apply \u63D0\u4EA4\u6216 /discard \u653E\u5F03\u3002",
    resumedPlan: "\u5DF2\u6062\u590D\u8BA1\u5212 \xB7 {when}{summary}",
    tipEditBindings: {
      topic: "\u7F16\u8F91\u95E8\u63A7\u5FEB\u6377\u952E",
      sections: [
        {
          rows: [
            { key: "y / n", text: "\u63A5\u53D7\u6216\u653E\u5F03\u5F85\u5904\u7406\u7684\u7F16\u8F91" },
            { key: "Shift+Tab", text: "\u5207\u6362 \u9884\u89C8 \u2194 \u81EA\u52A8\uFF08\u6301\u4E45\u5316\uFF1B\u81EA\u52A8\u6A21\u5F0F\u7ACB\u5373\u5E94\u7528\uFF09" },
            { key: "u", text: "\u64A4\u9500\u4E0A\u6B21\u81EA\u52A8\u5E94\u7528\u7684\u6279\u5904\u7406\uFF085 \u79D2\u6A2A\u5E45\u5185\uFF09" }
          ]
        }
      ],
      footer: "\u5F53\u524D\u6A21\u5F0F\u663E\u793A\u5728\u5E95\u90E8\u72B6\u6001\u680F \xB7 /keys \u67E5\u770B\u5B8C\u6574\u5FEB\u6377\u952E\u53C2\u8003"
    },
    tipMouseClipboard: {
      topic: "\u9F20\u6807 + \u526A\u8D34\u677F",
      sections: [
        {
          rows: [
            { key: "\u62D6\u52A8", text: "\u76F4\u63A5\u9009\u4E2D\u6587\u672C \u2014 \u7EC8\u7AEF\u539F\u751F\uFF0C\u4E0D\u9700\u8981\u6309 Shift" },
            {
              key: "\u53F3\u952E",
              text: "\u7EC8\u7AEF\u539F\u751F\u83DC\u5355\uFF08Windows Terminal \u7B49\u7684\u590D\u5236 / \u7C98\u8D34\uFF09"
            },
            { key: "\u6EDA\u8F6E", text: "\u6EDA\u52A8\u804A\u5929\u8BB0\u5F55\uFF08Web / \u4E91\u7AEF / SSH \u7EC8\u7AEF\u4E5F\u80FD\u7528\uFF09" },
            {
              key: "\u2191 / \u2193",
              text: "\u6EDA\u52A8\u804A\u5929 \xB7 \u8F93\u5165\u6846\u5386\u53F2 + \u591A\u884C\u5149\u6807\u7528 Ctrl+P / Ctrl+N"
            }
          ]
        }
      ],
      footer: "\u8FD0\u884C /keys \u67E5\u770B\u5B8C\u6574\u952E\u76D8 + \u9F20\u6807\u53C2\u8003"
    },
    keysReference: {
      topic: "Reasonix \u952E\u76D8 + \u9F20\u6807\u53C2\u8003",
      sections: [
        {
          title: "\u952E\u76D8",
          rows: [
            { key: "Enter", text: "\u63D0\u4EA4\u8F93\u5165" },
            { key: "Shift+Enter", text: "\u5728\u8F93\u5165\u6846\u4E2D\u63D2\u5165\u6362\u884C" },
            { key: "\u2191 / \u2193", text: "\u6EDA\u52A8\u804A\u5929\u8BB0\u5F55\uFF08\u9F20\u6807\u6EDA\u8F6E\u4E5F\u8D70\u8FD9\u6761\u8DEF\u5F84\uFF09" },
            {
              key: "Ctrl+P / Ctrl+N",
              text: "\u4E0A\u4E00\u6761 / \u4E0B\u4E00\u6761\u8F93\u5165\u5386\u53F2 \xB7 \u591A\u884C\u8349\u7A3F\u4E2D\u6309\u884C\u79FB\u52A8\u5149\u6807"
            },
            { key: "Ctrl+A / Ctrl+E", text: "\u8DF3\u5230\u5F53\u524D\u884C\u7684\u5F00\u5934 / \u7ED3\u5C3E" },
            { key: "Ctrl+W", text: "\u5220\u9664\u5149\u6807\u524D\u7684\u4E00\u4E2A\u8BCD" },
            { key: "Ctrl+U", text: "\u6E05\u7A7A\u6574\u4E2A\u8F93\u5165\u7F13\u51B2\u533A" },
            { key: "Tab", text: "\u8865\u5168 @-mention \xB7 \u8FDB\u5165\u6587\u4EF6\u5939 \xB7 \u63A5\u53D7 slash \u547D\u4EE4" },
            { key: "Shift+Tab", text: "\u7F16\u8F91\u95E8\u63A7\uFF1A\u5207\u6362 \u9884\u89C8 \u2194 \u81EA\u52A8 \u6A21\u5F0F" },
            { key: "Esc", text: "\u5173\u95ED\u5F39\u51FA\u9009\u62E9\u5668 \xB7 \u4E2D\u6B62\u5F53\u524D\u6A21\u578B\u56DE\u5408" },
            { key: "Ctrl+C", text: "\u4E2D\u6B62\u5F53\u524D\u6A21\u578B\u56DE\u5408\uFF08\u4E0D\u662F\u590D\u5236 \u2014 \u89C1\u526A\u8D34\u677F\u6BB5\uFF09" },
            { key: "PgUp / PgDn", text: "\u6574\u9875\u6EDA\u52A8\u804A\u5929\u8BB0\u5F55" },
            { key: "End", text: "\u8DF3\u5230\u804A\u5929\u7684\u6700\u65B0\u4E00\u884C" }
          ]
        },
        {
          title: "\u9F20\u6807",
          rows: [
            { key: "\u6EDA\u8F6E", text: "\u6EDA\u52A8\u804A\u5929\u8BB0\u5F55\uFF08Web / \u4E91\u7AEF / SSH \u7EC8\u7AEF\u4E5F\u80FD\u7528\uFF09" },
            { key: "\u62D6\u52A8", text: "\u539F\u751F\u9009\u4E2D\u6587\u672C \u2014 \u76F4\u63A5\u590D\u5236\uFF0C\u4E0D\u9700\u8981\u4FEE\u9970\u952E" },
            { key: "\u53F3\u952E", text: "\u7EC8\u7AEF\u539F\u751F\uFF08Windows Terminal \u7B49\u7684\u7C98\u8D34\u83DC\u5355\uFF09" }
          ]
        },
        {
          title: "\u590D\u5236 / \u7C98\u8D34",
          rows: [
            { key: "\u9009\u4E2D\u6587\u5B57", text: "\u76F4\u63A5\u62D6\u52A8 \u2014 \u7EC8\u7AEF\u539F\u751F\uFF08\u4E0D\u9700\u8981\u4EFB\u4F55\u4FEE\u9970\u952E\uFF09" },
            {
              key: "/copy",
              text: "vim/tmux \u98CE\u683C\u590D\u5236\u6A21\u5F0F \u2014 SSH / mosh / tmux \u4E0B\u62D6\u9009\u8D8A\u8FC7\u53EF\u89C6\u533A\u65E0\u6548\u65F6\u7528\u8FD9\u4E2A"
            },
            {
              key: "\u590D\u5236",
              text: "Ctrl+Shift+C\uFF08Win/Linux\uFF09\xB7 Cmd+C\uFF08macOS\uFF09\u2014 \u6216\u9009\u4E2D\u5373\u590D\u5236\uFF08\u770B\u7EC8\u7AEF\u8BBE\u7F6E\uFF09"
            },
            { key: "\u7C98\u8D34", text: "Ctrl+V \u6216 Ctrl+Shift+V\uFF08Win/Linux\uFF09\xB7 Cmd+V\uFF08macOS\uFF09" },
            {
              key: "bracketed paste",
              text: "\u591A\u884C\u7C98\u8D34\u6574\u4F53\u8FDB\u5165 \u2014 \u4E2D\u95F4\u6362\u884C\u4E0D\u4F1A\u89E6\u53D1\u63D0\u4EA4"
            }
          ]
        },
        {
          title: "\u7F16\u8F91\u95E8\u63A7\uFF08\u4EC5 code \u6A21\u5F0F\uFF09",
          rows: [
            { key: "y / n", text: "\u5728\u9884\u89C8\u6A21\u6001\u4E2D\u63A5\u53D7\u6216\u653E\u5F03\u5F85\u5904\u7406\u7684\u7F16\u8F91" },
            { key: "Shift+Tab", text: "\u5207\u6362 \u9884\u89C8 \u2194 \u81EA\u52A8\uFF08\u6301\u4E45\u5316\uFF09" },
            { key: "u", text: "\u64A4\u9500\u4E0A\u6B21\u81EA\u52A8\u5E94\u7528\u7684\u6279\u5904\u7406\uFF085 \u79D2\u6A2A\u5E45\u5185\uFF09" }
          ]
        }
      ],
      footer: "\u901A\u8FC7 DECSET 1007\uFF08alternate-scroll\uFF09\uFF0C\u7EC8\u7AEF\u628A\u6EDA\u8F6E\u7FFB\u8BD1\u6210 \u2191/\u2193 \u53D1\u7ED9\u5E94\u7528 \u2014 \u5927\u591A\u6570\u7EC8\u7AEF\uFF08\u542B Web / \u4E91\u7AEF / SSH\uFF09\u90FD\u80FD\u6EDA\uFF0C\u4E14\u4E0D\u5F71\u54CD\u7EC8\u7AEF\u539F\u751F\u9009\u533A\u3002\u76F4\u63A5\u62D6\u52A8\u9009\u4E2D\u6587\u672C\u65E0\u9700 Shift\u3002\u4F20\u5165 --no-mouse \u53EF\u5173\u95ED\u3002"
    },
    tipShownOnce: "\u4EC5\u663E\u793A\u4E00\u6B21",
    modelOverride: "\u8986\u76D6\u9ED8\u8BA4\u6A21\u578B",
    noSession: "\u7981\u7528\u672C\u6B21\u8FD0\u884C\u7684\u4F1A\u8BDD\u6301\u4E45\u5316",
    resumeHint: "\u5F3A\u5236\u6062\u590D\u6307\u5B9A\u4F1A\u8BDD\uFF08\u5373\u4F7F\u7A7A\u95F2\uFF09",
    newHint: "\u5F3A\u5236\u521B\u5EFA\u65B0\u4F1A\u8BDD\uFF08\u5FFD\u7565 --session / --continue\uFF09",
    transcriptHint: "JSONL \u8F6C\u5F55\u7A3F\u7684\u5199\u5165\u8DEF\u5F84",
    budgetHint: "\u4F1A\u8BDD\u7F8E\u5143\u4E0A\u9650 \u2014 80% \u65F6\u8B66\u544A\uFF0C100% \u65F6\u62D2\u7EDD\u4E0B\u4E00\u8F6E",
    modelIdHint: "DeepSeek \u6A21\u578B ID\uFF08\u4F8B\u5982 deepseek-v4-flash\uFF09",
    systemPromptHint: "\u8986\u76D6\u9ED8\u8BA4\u7CFB\u7EDF\u63D0\u793A\u8BCD",
    presetHint: "\u6A21\u578B\u7EC4\u5408 \u2014 auto|flash|pro",
    sessionNameHint: "\u4F1A\u8BDD\u540D\u79F0\uFF08\u9ED8\u8BA4\uFF1A'default'\uFF09",
    ephemeralHint: "\u7981\u7528\u672C\u6B21\u8FD0\u884C\u7684\u4F1A\u8BDD\u6301\u4E45\u5316",
    mcpSpecHint: "MCP \u670D\u52A1\u5668\u89C4\u683C\uFF08\u53EF\u91CD\u590D\uFF09",
    mcpPrefixHint: "\u7528\u6B64\u5B57\u7B26\u4E32\u4E3A MCP \u5DE5\u5177\u540D\u6DFB\u52A0\u524D\u7F00",
    noConfigHint: "\u672C\u6B21\u8FD0\u884C\u5FFD\u7565 ~/.visionox/config.json",
    presetHintShort: "\u6A21\u578B\u7EC4\u5408 \u2014 auto|flash|pro",
    budgetHintShort: "\u4F1A\u8BDD\u7F8E\u5143\u4E0A\u9650",
    transcriptHintShort: "JSONL \u8F6C\u5F55\u7A3F\u8DEF\u5F84",
    mcpSpecHintShort: "MCP \u670D\u52A1\u5668\u89C4\u683C\uFF08\u53EF\u91CD\u590D\uFF09",
    mcpPrefixHintShort: "MCP \u5DE5\u5177\u540D\u524D\u7F00",
    dryRunHint: "\u663E\u793A\u5C06\u8981\u5B89\u88C5\u7684\u5185\u5BB9\u4F46\u4E0D\u5B9E\u9645\u5B89\u88C5",
    rebuildHint: "\u4ECE\u5934\u91CD\u5EFA\u7D22\u5F15",
    embedModelHint: "\u5D4C\u5165\u6A21\u578B\u540D\u79F0",
    projectDirHint: "\u9879\u76EE\u6839\u76EE\u5F55",
    ollamaUrlHint: "Ollama \u670D\u52A1\u5668 URL",
    skipPromptsHint: "\u8DF3\u8FC7\u786E\u8BA4\u63D0\u793A",
    verboseHint: "\u663E\u793A\u5B8C\u6574\u7684\u4F1A\u8BDD\u5143\u6570\u636E",
    pruneDaysHint: "\u5220\u9664\u7A7A\u95F2\u6B64\u5929\u6570\u6216\u66F4\u591A\u7684\u4F1A\u8BDD\uFF08\u9ED8\u8BA4 90\uFF09",
    pruneDryRunHint: "\u5217\u51FA\u5C06\u8981\u5220\u9664\u7684\u5185\u5BB9\u4F46\u4E0D\u5B9E\u9645\u5220\u9664",
    eventTypeHint: "\u6309\u4E8B\u4EF6\u7C7B\u578B\u8FC7\u6EE4",
    eventSinceHint: "\u4ECE\u6B64\u4E8B\u4EF6 ID \u5F00\u59CB",
    eventTailHint: "\u4EC5\u663E\u793A\u6700\u540E N \u4E2A\u4E8B\u4EF6",
    jsonHint: "\u4EE5 JSON \u683C\u5F0F\u8F93\u51FA",
    projectionHint: "\u663E\u793A\u6BCF\u4E2A\u4E8B\u4EF6\u7684\u6295\u5F71\u72B6\u6001",
    printHint: "\u6253\u5370\u5230\u6807\u51C6\u8F93\u51FA\u800C\u975E TUI",
    headHint: "\u4EC5\u663E\u793A\u524D N \u4E2A\u4E8B\u4EF6",
    tailHint: "\u4EC5\u663E\u793A\u6700\u540E N \u4E2A\u4E8B\u4EF6",
    mdReportHint: "\u5C06 markdown \u5DEE\u5F02\u62A5\u544A\u5199\u5165\u6B64\u8DEF\u5F84",
    printHintTable: "\u6253\u5370\u8868\u683C\u5230\u6807\u51C6\u8F93\u51FA",
    tuiHint: "\u6253\u5F00\u4EA4\u4E92\u5F0F TUI",
    labelAHint: "\u5DE6\u4FA7\u9762\u677F\u7684\u6807\u7B7E",
    labelBHint: "\u53F3\u4FA7\u9762\u677F\u7684\u6807\u7B7E",
    mcpListDescription: "\u6D4F\u89C8 MCP \u6CE8\u518C\u8868\uFF08\u5B98\u65B9 \u2192 smithery \u2192 \u672C\u5730 fallback\uFF09",
    mcpInspectDescription: "\u68C0\u67E5 MCP \u670D\u52A1\u5668\u89C4\u683C\uFF08\u5DE5\u5177\u3001\u8D44\u6E90\u3001\u63D0\u793A\uFF09",
    mcpSearchDescription: "\u5728 MCP \u6CE8\u518C\u8868\u4E2D\u641C\u7D22\u5339\u914D\u7684\u670D\u52A1\u5668",
    mcpInstallDescription: "\u6309\u540D\u79F0\u5B89\u88C5 MCP \u670D\u52A1\u5668\uFF08\u5C06\u5176\u89C4\u683C\u5199\u5165\u914D\u7F6E\uFF09",
    mcpBrowseDescription: "\u4EA4\u4E92\u5F0F\u5E02\u573A\u6D4F\u89C8\u5668 \u2014 \u8F93\u5165\u8FC7\u6EE4\u3001\u56DE\u8F66\u5B89\u88C5",
    mcpLocalHint: "\u53EA\u663E\u793A\u5185\u7F6E\u7684\u79BB\u7EBF\u76EE\u5F55",
    mcpRefreshHint: "\u5FFD\u7565 24 \u5C0F\u65F6\u7F13\u5B58\uFF0C\u5F3A\u5236\u5237\u65B0",
    mcpLimitHint: "\u6700\u591A\u663E\u793A\u591A\u5C11\u6761",
    mcpPagesHint: "\u4E00\u6B21\u6027\u9884\u52A0\u8F7D\u591A\u5C11\u9875\uFF08\u9ED8\u8BA4 1\uFF09",
    mcpAllHint: "\u52A0\u8F7D\u5168\u90E8\u9875\uFF08\u9996\u6B21\u8F83\u6162\uFF09",
    mcpMaxPagesHint: "\u641C\u7D22\u65F6\u6700\u591A\u8D70\u591A\u5C11\u9875\uFF08\u9ED8\u8BA4 20\uFF09",
    jsonHintCatalog: "\u4EE5 JSON \u683C\u5F0F\u8F93\u51FA",
    jsonHintReport: "\u4EE5 JSON \u683C\u5F0F\u8F93\u51FA\u68C0\u67E5\u62A5\u544A",
    modelOverrideFlash: "\u8986\u76D6\u6A21\u578B\uFF08\u9ED8\u8BA4\uFF1Adeepseek-v4-flash\uFF09",
    skipConfirmHint: "\u8DF3\u8FC7\u786E\u8BA4\u63D0\u793A"
  },
  slash: {
    help: { description: "\u663E\u793A\u5B8C\u6574\u547D\u4EE4\u53C2\u8003" },
    copy: {
      description: "\u8FDB\u5165 vim/tmux \u98CE\u683C\u590D\u5236\u6A21\u5F0F \u2014 j/k \u79FB\u52A8\u3001v \u8D77\u9009\u533A\u3001y \u590D\u5236\u5230\u526A\u8D34\u677F"
    },
    status: { description: "\u5F53\u524D\u6A21\u578B\u3001\u6807\u5FD7\u3001\u4E0A\u4E0B\u6587\u3001\u4F1A\u8BDD" },
    preset: {
      description: "\u6A21\u578B\u7EC4\u5408 \u2014 \u81EA\u52A8\u5728 flash \u2192 pro \u4E4B\u95F4\u5207\u6362\uFF0C\u6216\u9501\u5B9A flash/pro",
      argsHint: "<auto|flash|pro>"
    },
    model: { description: "\u5207\u6362 DeepSeek \u6A21\u578B ID", argsHint: "<id>" },
    models: { description: "\u5217\u51FA\u4ECE DeepSeek /models \u83B7\u53D6\u7684\u53EF\u7528\u6A21\u578B" },
    theme: {
      description: "\u663E\u793A\u6216\u6301\u4E45\u5316\u7EC8\u7AEF\u4E3B\u9898\u504F\u597D\u3002\u65E0\u53C2\u6570\u65F6\u6253\u5F00\u9009\u62E9\u5668\u3002",
      argsHint: "[auto|default|dark|light|tokyo-night|github-dark|github-light|high-contrast]"
    },
    language: {
      description: "\u5207\u6362\u8FD0\u884C\u65F6\u8BED\u8A00",
      argsHint: "<en|zh-CN>",
      success: "\u8BED\u8A00\u5DF2\u5207\u6362\u4E3A\u7B80\u4F53\u4E2D\u6587\u3002",
      unsupported: "\u4E0D\u652F\u6301\u7684\u8BED\u8A00\u4EE3\u7801\uFF1A{code}\u3002\u652F\u6301\u7684\u8BED\u8A00\uFF1A{supported}\u3002"
    },
    pro: {
      description: "\u4EC5\u4E3A\u4E0B\u4E00\u8F6E\u542F\u7528 v4-pro\uFF08\u4E00\u6B21\u6027 \xB7 \u81EA\u52A8\u89E3\u9664\uFF09",
      argsHint: "[off]"
    },
    budget: {
      description: "\u4F1A\u8BDD\u7F8E\u5143\u4E0A\u9650 \u2014 80% \u65F6\u8B66\u544A\uFF0C100% \u65F6\u62D2\u7EDD\u4E0B\u4E00\u8F6E\u3002\u9ED8\u8BA4\u5173\u95ED\u3002\u5355\u72EC /budget \u663E\u793A\u72B6\u6001",
      argsHint: "[usd|off]"
    },
    mcp: { description: "\u5217\u51FA\u9644\u52A0\u5230\u6B64\u4F1A\u8BDD\u7684 MCP \u670D\u52A1\u5668 + \u5DE5\u5177" },
    resource: {
      description: "\u6D4F\u89C8 + \u8BFB\u53D6 MCP \u8D44\u6E90\uFF08\u65E0\u53C2\u6570 \u2192 \u5217\u51FA URI\uFF1B<uri> \u2192 \u83B7\u53D6\u5185\u5BB9\uFF09",
      argsHint: "[uri]"
    },
    prompt: {
      description: "\u6D4F\u89C8 + \u83B7\u53D6 MCP \u63D0\u793A\uFF08\u65E0\u53C2\u6570 \u2192 \u5217\u51FA\u540D\u79F0\uFF1B<name> \u2192 \u6E32\u67D3\u63D0\u793A\uFF09",
      argsHint: "[name]"
    },
    memory: {
      description: "\u663E\u793A / \u7BA1\u7406\u56FA\u5B9A\u8BB0\u5FC6\uFF08visionox.md + ~/.visionox/memory\uFF09",
      argsHint: "[list|show <name>|forget <name>|clear <scope> confirm]"
    },
    skill: {
      description: "\u5217\u51FA / \u8FD0\u884C\u7528\u6237\u6280\u80FD\uFF08<project>/.visionox/skills + ~/.visionox/skills\uFF09",
      argsHint: "[list|show <name>|<name> [args]]"
    },
    hooks: {
      description: "\u5217\u51FA\u6D3B\u8DC3\u7684 hooks\uFF08.visionox/ \u4E0B\u7684 settings.json\uFF09\xB7 reload \u4ECE\u78C1\u76D8\u91CD\u65B0\u8BFB\u53D6",
      argsHint: "[reload]"
    },
    permissions: {
      description: "\u663E\u793A / \u7F16\u8F91 shell \u5141\u8BB8\u5217\u8868\uFF08\u5185\u7F6E\u53EA\u8BFB \xB7 \u9879\u76EE\u7EA7\uFF1A~/.visionox/config.json\uFF09",
      argsHint: "[list|add <prefix>|remove <prefix|N>|clear confirm]"
    },
    dashboard: {
      description: "\u542F\u52A8\u5D4C\u5165\u5F0F Web \u4EEA\u8868\u677F\uFF08127.0.0.1\uFF0Ctoken \u4FDD\u62A4\uFF09",
      argsHint: "[stop]"
    },
    update: { description: "\u663E\u793A\u5F53\u524D\u7248\u672C\u4E0E\u6700\u65B0\u7248\u672C\u53CA\u5347\u7EA7\u547D\u4EE4" },
    stats: {
      description: "\u8DE8\u4F1A\u8BDD\u6210\u672C\u4EEA\u8868\u677F\uFF08\u4ECA\u65E5 / \u672C\u5468 / \u672C\u6708 / \u5168\u90E8 \xB7 \u7F13\u5B58\u547D\u4E2D \xB7 \u4E0E Claude \u5BF9\u6BD4\uFF09"
    },
    cost: {
      description: "\u7A7A \u2192 \u4E0A\u4E00\u8F6E\u82B1\u8D39\uFF08\u4F7F\u7528\u5361\u7247\uFF09\uFF1B\u5E26\u6587\u672C \u2192 \u4F30\u7B97\u53D1\u9001\u6210\u672C\uFF08\u6700\u574F\u60C5\u51B5 + \u53EF\u80FD\u7F13\u5B58\u547D\u4E2D\uFF09",
      argsHint: "[text]"
    },
    doctor: {
      description: "\u5065\u5EB7\u68C0\u67E5\uFF08api / config / api-reach / index / hooks / project\uFF09"
    },
    context: { description: "\u663E\u793A\u4E0A\u4E0B\u6587\u7A97\u53E3\u5206\u89E3\uFF08\u7CFB\u7EDF / \u5DE5\u5177 / \u65E5\u5FD7 / \u8F93\u5165\uFF09" },
    retry: { description: "\u622A\u65AD\u5E76\u91CD\u53D1\u60A8\u7684\u6700\u540E\u4E00\u6761\u6D88\u606F\uFF08\u91CD\u65B0\u91C7\u6837\uFF09" },
    compact: {
      description: "\u7F29\u5C0F\u65E5\u5FD7\u4E2D\u8FC7\u5927\u7684\u5DE5\u5177\u7ED3\u679C\u548C\u5DE5\u5177\u8C03\u7528\u53C2\u6570\uFF1B\u4E0A\u9650\u4E3A tokens\uFF0C\u9ED8\u8BA4 4000",
      argsHint: "[tokens]"
    },
    keys: { description: "\u952E\u76D8 + \u9F20\u6807 + \u590D\u5236\u7C98\u8D34\u53C2\u8003" },
    cwd: {
      description: "\u5207\u6362\u5DE5\u4F5C\u533A\u6839\u76EE\u5F55 \u2014 \u91CD\u65B0\u6307\u5411\u6587\u4EF6/Shell/\u8BB0\u5FC6\u5DE5\u5177\uFF0C\u91CD\u8F7D\u9879\u76EE hooks\uFF0C\u5237\u65B0 @ \u5F15\u7528\u904D\u5386\u5668",
      argsHint: "<path>"
    },
    stop: { description: "\u4E2D\u6B62\u5F53\u524D\u6A21\u578B\u56DE\u5408\uFF08\u6309 Esc \u7684\u66FF\u4EE3\u65B9\u5F0F\uFF09" },
    feedback: { description: "\u6253\u5F00 GitHub Issue\uFF0C\u8BCA\u65AD\u4FE1\u606F\u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F" },
    plans: { description: "\u5217\u51FA\u6B64\u4F1A\u8BDD\u7684\u6D3B\u8DC3 + \u5F52\u6863\u8BA1\u5212\uFF08\u6700\u65B0\u5728\u524D\uFF09" },
    replay: {
      description: "\u52A0\u8F7D\u5F52\u6863\u8BA1\u5212\u4E3A\u53EA\u8BFB\u7684\u65F6\u95F4\u65C5\u884C\u5FEB\u7167\uFF08\u9ED8\u8BA4\uFF1A\u6700\u65B0\uFF09",
      argsHint: "[N]"
    },
    sessions: { description: "\u5217\u51FA\u5DF2\u4FDD\u5B58\u7684\u4F1A\u8BDD\uFF08\u5F53\u524D\u6807\u8BB0\u4E3A \u25B8\uFF09" },
    setup: { description: "\u63D0\u9192\u60A8\u9000\u51FA\u5E76\u8FD0\u884C `reasonix setup`" },
    semantic: {
      description: "\u663E\u793A semantic_search \u72B6\u6001 \u2014 \u5DF2\u6784\u5EFA\uFF1FOllama \u5DF2\u5B89\u88C5\uFF1F\u5982\u4F55\u542F\u7528"
    },
    clear: { description: "\u4EC5\u6E05\u9664\u53EF\u89C1\u7684\u6EDA\u52A8\u56DE\u653E\uFF08\u65E5\u5FD7/\u4E0A\u4E0B\u6587\u4FDD\u7559\uFF09" },
    new: { description: "\u5F00\u59CB\u5168\u65B0\u5BF9\u8BDD\uFF08\u6E05\u9664\u4E0A\u4E0B\u6587 + \u6EDA\u52A8\u56DE\u653E\uFF09" },
    loop: {
      description: "\u6BCF <interval> \u81EA\u52A8\u91CD\u65B0\u63D0\u4EA4 <prompt>\uFF0C\u76F4\u5230\u60A8\u8F93\u5165 / Esc / /loop stop",
      argsHint: "<5s..6h> <prompt>  \xB7  stop  \xB7  \uFF08\u65E0\u53C2\u6570 = \u72B6\u6001\uFF09"
    },
    exit: { description: "\u9000\u51FA TUI" },
    init: {
      description: "\u626B\u63CF\u9879\u76EE\u5E76\u5408\u6210\u57FA\u7EBF visionox.md\uFF08\u6A21\u578B\u5199\u5165\uFF1B\u4F7F\u7528 /apply \u5BA1\u67E5\uFF09\u3002`force` \u8986\u76D6\u5DF2\u6709\u6587\u4EF6\u3002",
      argsHint: "[force]"
    },
    apply: {
      description: "\u5C06\u5F85\u5904\u7406\u7684\u7F16\u8F91\u5757\u63D0\u4EA4\u5230\u78C1\u76D8\uFF08\u65E0\u53C2\u6570 \u2192 \u5168\u90E8\uFF1B`1`\u3001`1,3` \u6216 `1-4` \u2192 \u8BE5\u5B50\u96C6\uFF0C\u5176\u4F59\u4FDD\u6301\u5F85\u5904\u7406\uFF09",
      argsHint: "[N|N,M|N-M]"
    },
    discard: {
      description: "\u4E22\u5F03\u5F85\u5904\u7406\u7684\u7F16\u8F91\u5757\u800C\u4E0D\u5199\u5165\uFF08\u65E0\u53C2\u6570 \u2192 \u5168\u90E8\uFF1B\u7D22\u5F15 \u2192 \u8BE5\u5B50\u96C6\uFF09",
      argsHint: "[N|N,M|N-M]"
    },
    walk: {
      description: "\u9010\u5757\u9010\u6B65\u5904\u7406\u5F85\u5904\u7406\u7684\u7F16\u8F91\uFF08git-add-p \u98CE\u683C\uFF1A\u6BCF\u5757 y/n\uFF0Ca \u5E94\u7528\u5269\u4F59\uFF0CA \u5207\u6362 AUTO\uFF09"
    },
    undo: { description: "\u56DE\u6EDA\u6700\u540E\u5E94\u7528\u7684\u7F16\u8F91\u6279\u5904\u7406" },
    history: {
      description: "\u5217\u51FA\u6B64\u4F1A\u8BDD\u7684\u6BCF\u4E2A\u7F16\u8F91\u6279\u5904\u7406\uFF08\u7528\u4E8E /show \u7684 ID\uFF0C\u64A4\u6D88\u6807\u8BB0\uFF09"
    },
    show: {
      description: "\u8F6C\u50A8\u5B58\u50A8\u7684\u7F16\u8F91\u5DEE\u5F02\uFF08\u7701\u7565 id \u65F6\u4E3A\u6700\u65B0\u672A\u64A4\u6D88\u7684\uFF09",
      argsHint: "[id]"
    },
    commit: { description: "git add -A && git commit -m ...", argsHint: '"msg"' },
    checkpoint: {
      description: "\u5FEB\u7167\u4F1A\u8BDD\u6D89\u53CA\u7684\u6BCF\u4E2A\u6587\u4EF6\uFF08Cursor \u98CE\u683C\u5185\u90E8\u5B58\u50A8\uFF0C\u975E git\uFF09\u3002\u5355\u72EC /checkpoint \u5217\u51FA\u3002",
      argsHint: "[name|list|forget <id>]"
    },
    restore: {
      description: "\u5C06\u6587\u4EF6\u56DE\u6EDA\u5230\u547D\u540D\u7684\u68C0\u67E5\u70B9\uFF08\u89C1 /checkpoint list\uFF09",
      argsHint: "<name|id>"
    },
    plan: {
      description: "\u5207\u6362\u53EA\u8BFB\u8BA1\u5212\u6A21\u5F0F\uFF08\u5199\u5165\u88AB\u5F39\u56DE\u76F4\u5230 submit_plan + \u5BA1\u6279\uFF09",
      argsHint: "[on|off]"
    },
    mode: {
      description: "\u7F16\u8F91\u95E8\u63A7\uFF1Areview\uFF08\u6392\u961F\uFF09\xB7 auto\uFF08\u5E94\u7528+\u64A4\u6D88\uFF09\xB7 yolo\uFF08\u5E94\u7528+\u81EA\u52A8 shell\uFF09\u3002Shift+Tab \u5FAA\u73AF\u3002",
      argsHint: "[review|auto|yolo]"
    },
    jobs: { description: "\u5217\u51FA run_background \u542F\u52A8\u7684\u540E\u53F0\u4F5C\u4E1A" },
    kill: {
      description: "\u6309 ID \u505C\u6B62\u540E\u53F0\u4F5C\u4E1A\uFF08SIGTERM \u2192 \u5BBD\u9650\u671F\u540E SIGKILL\uFF09",
      argsHint: "<id>"
    },
    logs: {
      description: "\u8DDF\u8E2A\u540E\u53F0\u4F5C\u4E1A\u7684\u8F93\u51FA\uFF08\u9ED8\u8BA4\u6700\u540E 80 \u884C\uFF09",
      argsHint: "<id> [lines]"
    }
  },
  wizard: {
    languageTitle: "\u9009\u62E9\u8BED\u8A00",
    languageSubtitle: "\u5DF2\u6839\u636E\u7CFB\u7EDF\u8BED\u8A00\u81EA\u52A8\u9009\u4E2D\u3002\u4E4B\u540E\u53EF\u7528 /language \u5207\u6362\u3002",
    welcomeTitle: "\u6B22\u8FCE\u4F7F\u7528 Reasonix\u3002",
    apiKeyPrompt: "\u7C98\u8D34\u4F60\u7684 DeepSeek API key \u5F00\u59CB\u4F7F\u7528\u3002",
    apiKeyGetOne: "\u5728\u6B64\u83B7\u53D6\uFF1Ahttps://platform.deepseek.com/api_keys",
    apiKeySavedLocally: "\u4FDD\u5B58\u5728\u672C\u5730\uFF1A{path}",
    apiKeyInputLabel: "key \u203A ",
    apiKeyInvalid: "key \u957F\u5EA6\u4E0D\u8DB3\u2014\u2014\u8BF7\u7C98\u8D34\u5B8C\u6574 token\uFF0816+ \u5B57\u7B26\uFF0C\u4E0D\u542B\u7A7A\u683C\uFF09\u3002",
    apiKeyChecking: "\u6B63\u5728\u68C0\u67E5 API key\u2026",
    apiKeyRejected: "DeepSeek \u62D2\u7EDD\u4E86\u8FD9\u4E2A API key\u3002\u8BF7\u7C98\u8D34\u6709\u6548 key\uFF0C\u6216\u6309 Esc \u53D6\u6D88\u8BBE\u7F6E\u3002",
    apiKeyCheckFailed: "\u6682\u65F6\u65E0\u6CD5\u9A8C\u8BC1 API key\uFF08{message}\uFF09\u3002\u8BF7\u68C0\u67E5\u7F51\u7EDC\u540E\u91CD\u8BD5\u3002",
    apiKeyPreview: "\u9884\u89C8\uFF1A{redacted}",
    themeTitle: "\u9009\u62E9\u4E3B\u9898",
    themeSubtitle: "\u65B9\u5411\u952E\u5207\u6362\u65F6\u5373\u65F6\u9884\u89C8\u6548\u679C\uFF0C\u4E4B\u540E\u53EF\u7528 /theme \u66F4\u6539\u3002",
    themeSampleHeading: "\u793A\u4F8B",
    themeFooter: "[\u2191\u2193] \u79FB\u52A8 \xB7 [Enter] \u786E\u8BA4 \xB7 [Esc] \u53D6\u6D88",
    themeCaption: {
      default: "GitHub \u6DF1\u8272\uFF08\u9ED8\u8BA4\uFF09",
      dark: "\u6DF1\u8272\u8C03",
      light: "\u6E05\u723D\u6D45\u8272",
      "tokyo-night": "\u4E1C\u4EAC\u591C\u8272",
      "github-dark": "GitHub \u6DF1\u8272",
      "github-light": "GitHub \u6D45\u8272",
      "high-contrast": "\u9AD8\u5BF9\u6BD4\u5EA6\uFF08\u65E0\u969C\u788D\uFF09"
    },
    reviewLabelTheme: "\u4E3B\u9898",
    presetTitle: "\u9009\u62E9\u9884\u8BBE",
    mcpTitle: "Reasonix \u8981\u4E3A\u4F60\u63A5\u5165\u54EA\u4E9B MCP \u670D\u52A1\u5668\uFF1F",
    mcpUserArgsHint: "\uFF08\u9700\u8981\u4F60\u63D0\u4F9B {arg}\uFF09",
    mcpFooterMulti: "[\u2191\u2193] \u79FB\u52A8  \xB7  [\u7A7A\u683C] \u9009\u62E9  \xB7  [Enter] \u786E\u8BA4  \xB7  [Esc] \u53D6\u6D88  \xB7  \u5168\u4E0D\u9009 = \u8DF3\u8FC7",
    mcpArgsTitle: "\u914D\u7F6E {name}",
    mcpArgsDirMissing: "\u76EE\u5F55 {path} \u4E0D\u5B58\u5728\u3002",
    mcpArgsDirCreateHint: "[Y/Enter] \u521B\u5EFA\uFF08mkdir -p\uFF09\xB7 [N/Esc] \u8F93\u5165\u5176\u4ED6\u8DEF\u5F84",
    mcpArgsDirCreateFailed: "\u65E0\u6CD5\u521B\u5EFA {path}\uFF1A{message}",
    mcpArgsRequiredParam: "\u5FC5\u586B\u53C2\u6570\uFF1A",
    mcpArgsEmpty: "{name} \u9700\u8981\u4E00\u4E2A\u503C \u2014 \u4E0D\u80FD\u4E3A\u7A7A\u3002",
    mcpArgsNotADir: "{path} \u5B58\u5728\u4F46\u4E0D\u662F\u76EE\u5F55\u3002",
    reviewTitle: "\u786E\u8BA4\u4FDD\u5B58",
    reviewLabelApiKey: "API key",
    reviewLabelLanguage: "\u8BED\u8A00",
    reviewLabelPreset: "\u9884\u8BBE",
    reviewLabelMcp: "MCP",
    reviewMcpNone: "\uFF08\u65E0\uFF09",
    reviewMcpServers: "{count} \u4E2A\u670D\u52A1\u5668",
    reviewSavesTo: "\u4FDD\u5B58\u5230 {path}",
    reviewSaveError: "\u4FDD\u5B58\u914D\u7F6E\u5931\u8D25\uFF1A{message}",
    reviewFooter: "[Enter] \u4FDD\u5B58 \xB7 [Esc] \u53D6\u6D88",
    savedTitle: "\u25B8 \u5DF2\u4FDD\u5B58\u3002",
    savedFooter: "[Enter] \u9000\u51FA",
    selectFooter: "[\u2191\u2193] \u79FB\u52A8 \xB7 [Enter] \u786E\u8BA4 \xB7 [Esc] \u53D6\u6D88",
    stepCounter: "\u6B65\u9AA4 {step}/{total} \xB7 ",
    exitHint: "/exit \u4E2D\u6B62",
    apiKeyPlaceholder: "sk-...",
    themeSampleReasoning: "\u63A8\u7406\u4E2D"
  },
  themePicker: {
    header: "\u4E3B\u9898",
    footer: "\u2191\u2193 \u9009\u62E9 \xB7 \u23CE \u786E\u8BA4 \xB7 Esc \u53D6\u6D88",
    currentPref: "\u5F53\u524D\u504F\u597D",
    activeNow: "\u5F53\u524D\u751F\u6548",
    autoDesc: "\u4F7F\u7528 REASONIX_THEME \u6216\u9ED8\u8BA4\u4E3B\u9898"
  },
  planFlow: {
    approveCardTitle: "\u786E\u8BA4\u8BA1\u5212",
    approveCardMetaRight: "\u7B49\u5F85\u4E2D",
    openQuestionsBanner: "\u25B2 \u8BA1\u5212\u4E2D\u6807\u8BB0\u4E86\u5F85\u786E\u8BA4\u7684\u95EE\u9898\u6216\u98CE\u9669 \u2014\u2014 \u8BF7\u9009 {refine} \u7ED9\u51FA\u660E\u786E\u7B54\u6848\uFF0C\u518D\u8BA9\u6A21\u578B\u7EE7\u7EED\u3002",
    openQuestionsHeader: "\u5F85\u786E\u8BA4 / \u98CE\u9669",
    truncatedBodyMore: "\u2026 \u8FD8\u6709 {n} \u884C\u5728\u4E0A\u65B9\u6EDA\u52A8\u5386\u53F2\u4E2D",
    truncatedBodyMorePlural: "\u2026 \u8FD8\u6709 {n} \u884C\u5728\u4E0A\u65B9\u6EDA\u52A8\u5386\u53F2\u4E2D",
    picker: {
      accept: "\u91C7\u7EB3",
      acceptHint: "\u7ACB\u5373\u6309\u987A\u5E8F\u6267\u884C",
      refine: "\u7EC6\u5316",
      refineHint: "\u7ED9\u6A21\u578B\u66F4\u591A\u6307\u5F15\uFF0C\u91CD\u65B0\u51FA\u4E00\u7248\u8BA1\u5212",
      revise: "\u6539\u5199",
      reviseHint: "\u5728\u6267\u884C\u524D\u5C31\u5730\u7F16\u8F91\u8BA1\u5212\uFF08\u8DF3\u8FC7 / \u91CD\u6392\u6B65\u9AA4\uFF09",
      reject: "\u9A73\u56DE",
      rejectHint: "\u4E22\u5F03\uFF0C\u8BA9\u6A21\u578B\u4ECE\u5934\u518D\u6765"
    },
    refineFooter: "\u23CE \u53D1\u9001  \xB7  esc \u8FD4\u56DE\u9009\u9879",
    refineQuestionsHeading: "\u56DE\u7B54\u4EE5\u4E0B\u95EE\u9898\uFF0C\u6216\u76F4\u63A5\u8BF4\u660E\u4F60\u60F3\u8981\u7684\u4FEE\u6539\uFF1A",
    modes: {
      approve: {
        title: "\u91C7\u7EB3 \u2014\u2014 \u8FD8\u6709\u8865\u5145\u6307\u793A\u5417\uFF1F",
        hint: "\u56DE\u7B54\u8BA1\u5212\u4E2D\u7684\u95EE\u9898\u3001\u8865\u5145\u7EA6\u675F\uFF0C\u6216\u76F4\u63A5\u56DE\u8F66\u6309\u73B0\u72B6\u91C7\u7EB3\u3002",
        blankHint: "\uFF08\u7559\u7A7A\u56DE\u8F66 = \u4E0D\u9644\u52A0\u6307\u793A\u76F4\u63A5\u91C7\u7EB3\u3002\uFF09"
      },
      refine: {
        title: "\u7EC6\u5316 \u2014\u2014 \u6A21\u578B\u5E94\u8BE5\u6539\u4EC0\u4E48\uFF1F",
        hint: "\u8BF4\u660E\u95EE\u9898\u5728\u54EA\u3001\u7F3A\u4EC0\u4E48\uFF0C\u6216\u8005\u56DE\u7B54\u8BA1\u5212\u63D0\u51FA\u7684\u7591\u95EE\u3002",
        blankHint: "\uFF08\u7559\u7A7A\u56DE\u8F66 = \u8BA9\u6A21\u578B\u5BF9\u6240\u6709\u5F85\u786E\u8BA4\u95EE\u9898\u9009\u7528\u5B89\u5168\u9ED8\u8BA4\u3002\uFF09"
      },
      reject: {
        title: "\u9A73\u56DE \u2014\u2014 \u544A\u8BC9\u6A21\u578B\u539F\u56E0\uFF08\u53EF\u9009\uFF09",
        hint: "\u8BF4\u660E\u6A21\u578B\u5BF9\u4F60\u7684\u76EE\u6807\u7406\u89E3\u9519\u5728\u54EA\u91CC\uFF0C\u6216\u4F60\u771F\u6B63\u60F3\u8981\u4EC0\u4E48\u3002",
        blankHint: "\uFF08\u7559\u7A7A\u56DE\u8F66 = \u4E0D\u89E3\u91CA\u76F4\u63A5\u53D6\u6D88\uFF1B\u6A21\u578B\u4F1A\u53CD\u8FC7\u6765\u95EE\u4F60\u60F3\u8981\u4EC0\u4E48\u3002\uFF09"
      },
      "checkpoint-revise": {
        title: "\u6539\u5199 \u2014\u2014 \u4E0B\u4E00\u6B65\u524D\u8981\u8C03\u6574\u4EC0\u4E48\uFF1F",
        hint: "\u8303\u56F4\u8C03\u6574\u3001\u8DF3\u8FC7\u6B65\u9AA4\u3001\u6362\u4E2A\u601D\u8DEF \u2014\u2014 \u6A21\u578B\u4F1A\u636E\u6B64\u4FEE\u6539\u5269\u4F59\u6B65\u9AA4\u3002",
        blankHint: "\uFF08\u7559\u7A7A\u56DE\u8F66 = \u6309\u5F53\u524D\u8BA1\u5212\u7EE7\u7EED\u3002\uFF09"
      },
      "choice-custom": {
        title: "\u81EA\u5B9A\u4E49\u56DE\u7B54 \u2014\u2014 \u60F3\u8BF4\u4EC0\u4E48\u90FD\u884C",
        hint: "\u81EA\u7531\u6587\u672C\u3002\u6A21\u578B\u4F1A\u539F\u6837\u8BFB\u53D6\u5E76\u7EE7\u7EED \u2014\u2014 \u4E0D\u5FC5\u5339\u914D\u5019\u9009\u9879\u3002",
        blankHint: "\uFF08\u7559\u7A7A\u56DE\u8F66 = \u8BA9\u6A21\u578B\u53CD\u8FC7\u6765\u95EE\u4F60\u60F3\u8981\u4EC0\u4E48\u3002\uFF09"
      }
    },
    checkpoint: {
      title: "\u68C0\u67E5\u70B9 \u2014\u2014 \u5F53\u524D\u6B65\u9AA4\u5DF2\u5B8C\u6210",
      continue: "\u7EE7\u7EED \u2014\u2014 \u6267\u884C\u4E0B\u4E00\u6B65",
      continueHint: "\u6A21\u578B\u4ECE\u4E0B\u4E00\u6B65\u7EE7\u7EED\u3002",
      revise: "\u8C03\u6574 \u2014\u2014 \u5728\u4E0B\u4E00\u6B65\u524D\u7ED9\u53CD\u9988",
      reviseHint: "\u5148\u6682\u505C\uFF0C\u8F93\u5165\u6307\u5F15\uFF1B\u6A21\u578B\u4F1A\u8C03\u6574\u5269\u4F59\u8BA1\u5212\u3002",
      stop: "\u505C\u6B62 \u2014\u2014 \u5728\u6B64\u7ED3\u675F\u8BA1\u5212",
      stopHint: "\u6A21\u578B\u603B\u7ED3\u5DF2\u5B8C\u6210\u7684\u5DE5\u4F5C\u5E76\u7ED3\u675F\u3002"
    },
    stepList: {
      counter: "{total} \u4E2A\u6B65\u9AA4",
      counterSingular: "{total} \u4E2A\u6B65\u9AA4",
      counterDone: "{done}/{total} \u5DF2\u5B8C\u6210\uFF08{pct}%\uFF09 \xB7 \u5171 {total} \u6B65",
      counterDoneSingular: "{done}/{total} \u5DF2\u5B8C\u6210\uFF08{pct}%\uFF09 \xB7 \u5171 {total} \u6B65"
    },
    noPlanSummary: "\u5C1A\u672A\u63D0\u4EA4\u8BA1\u5212\u5185\u5BB9\u3002",
    detailCollapsedHint: "Ctrl+P \u5C55\u5F00\u5B8C\u6574\u8BA1\u5212\u8BE6\u60C5\u3002",
    detailExpandedHint: "Ctrl+P \u6536\u8D77\u8BE6\u60C5\u3002",
    detailHeader: "\u8BA1\u5212\u8BE6\u60C5",
    detailWindow: "\u663E\u793A\u7B2C {start}-{end} \u884C\uFF0C\u5171 {total} \u884C",
    detailScrollHint: "PgUp/PgDn \u6EDA\u52A8\u8BE6\u60C5 \xB7 Home/End \u8DF3\u8F6C",
    reviseTitle: "\u4FEE\u6539\u8BA1\u5212",
    reviseSteps: "{count} \u4E2A\u6B65\u9AA4",
    reviseFooter: "\u2191\u2193 \u7126\u70B9  \xB7  \u7A7A\u683C\u5207\u6362\u8DF3\u8FC7  \xB7  k/j \u79FB\u52A8  \xB7  \u23CE \u786E\u8BA4  \xB7  Esc \u53D6\u6D88",
    riskMed: " \u4E2D",
    riskHigh: " \u9AD8",
    completeMsg: "\u25B8 \u8BA1\u5212\u5B8C\u6210 \u2014 \u5168\u90E8 {total} \u4E2A\u6B65\u9AA4\u5DF2\u5B8C\u6210 \xB7 \u5DF2\u5F52\u6863"
  },
  app: {
    walkCancelledRemaining: "\u25B8 \u6D4F\u89C8\u5DF2\u53D6\u6D88 \u2014 \u8FD8\u6709 {count} \u4E2A\u5F85\u5904\u7406\u7F16\u8F91\u5757\u3002",
    walkCancelled: "\u25B8 \u6D4F\u89C8\u5DF2\u53D6\u6D88\u3002",
    editModeYolo: "\u25B8 \u7F16\u8F91\u6A21\u5F0F\uFF1AYOLO \u2014 \u7F16\u8F91\u548C shell \u547D\u4EE4\u90FD\u81EA\u52A8\u6267\u884C\u3002/undo \u4ECD\u53EF\u64A4\u9500\u7F16\u8F91\u3002\u8BF7\u8C28\u614E\u4F7F\u7528\u3002",
    editModeAuto: "\u25B8 \u7F16\u8F91\u6A21\u5F0F\uFF1AAUTO \u2014 \u7F16\u8F91\u7ACB\u5373\u5E94\u7528\uFF1B5 \u79D2\u5185\u6309 u \u64A4\u9500\uFF08\u7A7A\u683C\u6682\u505C\u8BA1\u65F6\uFF09\u3002shell \u547D\u4EE4\u4ECD\u4F1A\u8BE2\u95EE\u3002",
    editModeReview: "\u25B8 \u7F16\u8F91\u6A21\u5F0F\uFF1Areview \u2014 \u7F16\u8F91\u5165\u961F\u5F85 /apply\uFF08\u6216 y\uFF09/ /discard\uFF08\u6216 n\uFF09",
    rejectedEdit: "\u25B8 \u62D2\u7EDD\u4E86\u5BF9 {path} \u7684\u7F16\u8F91{context}",
    autoApprovingRest: "\u25B8 \u672C\u8F6E\u5269\u4F59\u7F16\u8F91\u81EA\u52A8\u6279\u51C6",
    flippedAutoSession: "\u25B8 \u5DF2\u5207\u6362\u5230 AUTO \u6A21\u5F0F\uFF08\u672C\u4F1A\u8BDD\u5269\u4F59\u751F\u6548\uFF0C\u5DF2\u6301\u4E45\u5316\uFF09",
    flippedAutoWalk: "\u25B8 \u5DF2\u5207\u6362\u5230 AUTO \u6A21\u5F0F \u2014 \u540E\u7EED\u7F16\u8F91\u7ACB\u5373\u5E94\u7528\u3002\u6D4F\u89C8\u6A21\u5F0F\u9000\u51FA\u3002",
    dashboardStopped: "\u25B8 \u4EEA\u8868\u677F\u5DF2\u505C\u6B62\u3002",
    notedMemory: "\u25B8 \u5DF2\u8BB0\u5F55\uFF08{scope}\uFF09\u2014 {verb} {path}",
    notedScopeProject: "\u9879\u76EE",
    notedScopeGlobal: "\u5168\u5C40",
    notedVerbCreated: "\u521B\u5EFA",
    notedVerbAppended: "\u8FFD\u52A0\u5230",
    memoryWriteFailed: "# \u8BB0\u5FC6\u5199\u5165\u5931\u8D25",
    commandFailed: "! \u547D\u4EE4\u5931\u8D25",
    btwUsage: "\u25B8 /btw <\u95EE\u9898> \u2014 \u987A\u4FBF\u95EE\u4E2A\u9898\u5916\u8BDD\uFF0C\u4E0D\u4F1A\u5199\u5165\u5F53\u524D\u4F1A\u8BDD\u4E0A\u4E0B\u6587\u3002",
    btwHeader: "\u226B btw",
    btwFailed: "/btw \u8C03\u7528\u5931\u8D25",
    restoreCodeOnly: "\u25B8 /restore \u4EC5\u5728\u4EE3\u7801\u6A21\u5F0F\u53EF\u7528",
    hookUserPromptSubmit: "UserPromptSubmit \u94A9\u5B50",
    hookStop: "Stop \u94A9\u5B50",
    atMentions: "\u25B8 @mentions\uFF1A{parts}",
    atUrl: "\u25B8 @url\uFF1A{parts}",
    atUrlFailed: "@url \u5C55\u5F00\u5931\u8D25",
    denied: "\u25B8 \u5DF2\u62D2\u7EDD\uFF1A{cmd}{context}",
    alwaysAllowed: '\u25B8 \u5DF2\u5BF9 {dir} \u6C38\u4E45\u5141\u8BB8 "{prefix}"',
    runningCommand: "\u25B8 \u6B63\u5728\u6267\u884C\uFF1A{cmd}",
    startingBackground: "\u25B8 \u540E\u53F0\u542F\u52A8\uFF1A{cmd}",
    checkpointSaved: "\u26C1 \u5DF2\u4FDD\u5B58\u68C0\u67E5\u70B9 \xB7 {id} \xB7 {count} \u4E2A\u6587\u4EF6 \xB7 /restore {id} \u53EF\u56DE\u6EDA\u6B64\u6B65",
    continuingAfter: "\u25B8 \u5728 {label}{counter} \u4E4B\u540E\u7EE7\u7EED",
    planStoppedAt: "\u25B8 \u8BA1\u5212\u5728 {label}{counter} \u5904\u505C\u6B62",
    revisingAfter: "\u25B8 \u5728 {label} \u4E4B\u540E\u4FEE\u8BA2 \u2014 {feedback}"
  },
  hooks: {
    head: "\u94A9\u5B50 {tag} `{cmd}` {decision}{truncTag}",
    headWithDetail: "\u94A9\u5B50 {tag} `{cmd}` {decision}{truncTag}\uFF1A{detail}",
    truncated: "\uFF08\u8F93\u51FA\u5728 256KB \u5904\u622A\u65AD\uFF09",
    decisionBlock: "\u62E6\u622A",
    decisionWarn: "\u544A\u8B66",
    decisionTimeout: "\u8D85\u65F6",
    decisionError: "\u9519\u8BEF"
  },
  summary: {
    status: "\u6B63\u5728\u603B\u7ED3\u5DF2\u6536\u96C6\u7684\u5185\u5BB9\u2026",
    hallucinatedFallback: "\uFF08\u6A21\u578B\u751F\u6210\u4E86\u4F2A\u9020\u7684\u5DE5\u5177\u8C03\u7528\u6807\u8BB0\u800C\u975E\u7EAF\u6587\u672C\u603B\u7ED3 \u2014 \u8BD5\u8BD5 /retry \u6362\u4E2A\u66F4\u7A84\u7684\u95EE\u9898\uFF0C\u6216 /think \u67E5\u770B R1 \u7684\u63A8\u7406\uFF09",
    failedAfterReason: "{label}\uFF0C\u4E14\u56DE\u9000\u7684\u603B\u7ED3\u8C03\u7528\u4E5F\u5931\u8D25\uFF1A{message}\u3002\u8BF7\u8FD0\u884C /clear \u540E\u7528\u66F4\u7A84\u7684\u95EE\u9898\u91CD\u8BD5\uFF0C\u6216\u63D0\u9AD8 --max-tool-iters\u3002"
  },
  loop: {
    budgetExhausted: "\u4F1A\u8BDD\u9884\u7B97\u5DF2\u7528\u5B8C \u2014 \u5DF2\u82B1\u8D39 ${spent} \u2265 \u4E0A\u9650 ${cap}\u3002\u7528 /budget <usd> \u63D0\u9AD8\u4E0A\u9650\uFF0C/budget off \u6E05\u9664\u4E0A\u9650\uFF0C\u6216\u7ED3\u675F\u4F1A\u8BDD\u3002",
    budget80Pct: "\u25B2 \u9884\u7B97\u5DF2\u7528 80% \u2014 ${spent} / ${cap}\u3002\u4E0B\u4E00\u4E24\u8F6E\u53EF\u80FD\u5C31\u89E6\u9876\u3002",
    proArmed: "\u21E7 /pro \u5DF2\u88C5\u5907 \u2014 \u672C\u8F6E\u4F7F\u7528 deepseek-v4-pro\uFF08\u4E00\u6B21\u6027 \xB7 \u672C\u8F6E\u540E\u81EA\u52A8\u89E3\u9664\uFF09",
    abortedAtIter: "\u5728\u7B2C {iter}/{cap} \u6B21\u5DE5\u5177\u8C03\u7528\u5904\u4E2D\u65AD \u2014 \u672A\u751F\u6210\u603B\u7ED3\u5373\u505C\u6B62\uFF08\u6309 \u2191 + Enter \u6216 /retry \u6062\u590D\uFF09",
    toolUploadStatus: "\u5DE5\u5177\u7ED3\u679C\u5DF2\u4E0A\u4F20 \xB7 \u6A21\u578B\u5728\u751F\u6210\u4E0B\u4E00\u6761\u54CD\u5E94\u524D\u601D\u8003\u4E2D\u2026",
    toolBudgetWarning: "\u5DF2\u7528 {iter}/{cap} \u6B21\u5DE5\u5177\u8C03\u7528 \u2014 \u63A5\u8FD1\u4E0A\u9650\u3002\u6309 Esc \u7ACB\u5373\u5F3A\u5236\u603B\u7ED3\u3002",
    preflightFoldStatus: "\u9884\u68C0\uFF1A\u4E0A\u4E0B\u6587\u63A5\u8FD1\u4E0A\u9650\uFF0C\u5C1D\u8BD5\u6298\u53E0\u2026",
    preflightFolded: "\u9884\u68C0\uFF1A\u8BF7\u6C42\u7EA6 {estimate}/{ctxMax} tokens\uFF08{pct}%\uFF09\u2014 \u5DF2\u6298\u53E0 {beforeMessages} \u6761\u6D88\u606F \u2192 {afterMessages}\uFF08\u603B\u7ED3 {summaryChars} \u5B57\uFF09\u3002\u53D1\u9001\u4E2D\u3002",
    preflightNoFold: "\u9884\u68C0\uFF1A\u8BF7\u6C42\u7EA6 {estimate}/{ctxMax} tokens\uFF08{pct}%\uFF09\u4E14\u6CA1\u6709\u53EF\u6298\u53E0\u7684\u5185\u5BB9 \u2014 DeepSeek \u5927\u6982\u7387\u4F1A\u8FD4\u56DE 400\u3002\u8BF7\u8FD0\u884C /clear \u6216 /new \u91CD\u65B0\u5F00\u59CB\u3002",
    flashEscalation: "\u21E7 flash \u8BF7\u6C42\u5347\u7EA7 \u2014 \u672C\u8F6E\u6539\u7528 {model}{reasonSuffix}",
    harvestStatus: "\u6B63\u5728\u4ECE\u63A8\u7406\u8FC7\u7A0B\u63D0\u53D6\u8BA1\u5212\u72B6\u6001\u2026",
    autoEscalation: "\u21E7 \u672C\u8F6E\u5269\u4F59\u8C03\u7528\u81EA\u52A8\u5347\u7EA7\u5230 {model} \u2014 flash \u547D\u4E2D {breakdown}\u3002\u4E0B\u4E00\u8F6E\u56DE\u9000\u5230 {fallback}\uFF0C\u9664\u975E\u5DF2\u88C5\u5907 /pro\u3002",
    readOnlyLoopEscalation: "\u21E7 \u81EA\u52A8\u5347\u7EA7\u5230 {model} \u2014 flash \u8FDE\u7EED {n} \u6B21\u53EA\u8BFB\u8C03\u7528\uFF0C\u672A\u4EA7\u51FA\u4FEE\u6539\u6216\u6700\u7EC8\u7B54\u6848\u3002\u4E0B\u4E00\u8F6E\u56DE\u9000\u5230 {fallback}\uFF0C\u9664\u975E\u5DF2\u88C5\u5907 /pro\u3002",
    repeatToolCallWarning: "\u62E6\u622A\u5230\u91CD\u590D\u5DE5\u5177\u8C03\u7528 \u2014 \u8BA9\u6A21\u578B\u5BDF\u89C9\u95EE\u9898\u5E76\u6362\u79CD\u65B9\u5F0F\u91CD\u8BD5\u3002",
    stormStuck: "\u5DF2\u505C\u6B62\u5361\u6B7B\u7684\u91CD\u8BD5\u5FAA\u73AF \u2014 \u6A21\u578B\u5728\u81EA\u7EA0\u63D0\u793A\u540E\u4ECD\u4EE5\u76F8\u540C\u53C2\u6570\u91CD\u590D\u8C03\u7528\u540C\u4E00\u5DE5\u5177\u3002\u8BF7\u5C1D\u8BD5 /retry\u3001\u6362\u79CD\u8BF4\u6CD5\uFF0C\u6216\u6392\u67E5\u5E95\u5C42\u963B\u585E\u3002",
    stormSuppressed: "\u5DF2\u6291\u5236 {count} \u6B21\u91CD\u590D\u5DE5\u5177\u8C03\u7528 \u2014 \u540C\u4E00\u540D\u79F0 + \u53C2\u6570\u89E6\u53D1 3 \u6B21\u4EE5\u4E0A\u3002",
    compactingHistoryStatus: "\u6B63\u5728\u538B\u7F29\u5386\u53F2{aggressiveTag}\u2026",
    aggressiveTag: "\uFF08\u6FC0\u8FDB\uFF09",
    foldedHistory: "\u4E0A\u4E0B\u6587 {before}/{ctxMax}\uFF08{pct}%\uFF09\u2014 \u5DF2\u6298\u53E0 {beforeMessages} \u6761\u6D88\u606F \u2192 {afterMessages}\uFF08\u603B\u7ED3 {summaryChars} \u5B57\uFF09\u3002\u7EE7\u7EED\u3002",
    aggressivelyFoldedHistory: "\u4E0A\u4E0B\u6587 {before}/{ctxMax}\uFF08{pct}%\uFF09\u2014 \u5DF2\u6FC0\u8FDB\u6298\u53E0 {beforeMessages} \u6761\u6D88\u606F \u2192 {afterMessages}\uFF08\u603B\u7ED3 {summaryChars} \u5B57\uFF09\u3002\u7EE7\u7EED\u3002",
    forcingSummary: "\u4E0A\u4E0B\u6587 {before}/{ctxMax}\uFF08{pct}%\uFF09\u2014 \u57FA\u4E8E\u5DF2\u6536\u96C6\u5230\u7684\u5185\u5BB9\u5F3A\u5236\u603B\u7ED3\u3002\u8BF7\u8FD0\u884C /compact\u3001/clear \u6216 /new \u91CD\u7F6E\u3002"
  },
  errors: {
    contextOverflow: "\u4E0A\u4E0B\u6587\u6EA2\u51FA\uFF08DeepSeek 400\uFF09\uFF1A\u4F1A\u8BDD\u5386\u53F2\u5DF2\u8FBE {requested}\uFF0C\u8D85\u51FA\u6A21\u578B prompt \u4E0A\u9650\uFF08V4\uFF1A1M tokens\uFF1B\u65E7\u7248 chat/reasoner\uFF1A131k\uFF09\u3002\u901A\u5E38\u662F\u5355\u4E2A\u5DE5\u5177\u7ED3\u679C\u592A\u5927\u3002Reasonix \u9ED8\u8BA4\u5C06\u65B0\u5DE5\u5177\u7ED3\u679C\u9650\u5236\u5728 8k tokens\uFF0C\u5E76\u5728\u4F1A\u8BDD\u52A0\u8F7D\u65F6\u81EA\u52A8\u4FEE\u590D\u8D85\u5927\u5386\u53F2 \u2014 \u91CD\u542F\u5E38\u80FD\u6E05\u6389\u3002\u5982\u679C\u4ECD\u7136\u6EA2\u51FA\uFF0C\u8FD0\u884C /new \u91CD\u65B0\u5F00\u59CB\uFF0C\u6216\u6253\u5F00 /sessions \u9009\u4E2D\u540E\u6309 [d] \u5220\u9664\u8BE5\u4F1A\u8BDD\u3002",
    contextOverflowTooMany: "tokens \u6570\u91CF\u8FC7\u591A",
    auth401: "\u8BA4\u8BC1\u5931\u8D25\uFF08DeepSeek 401\uFF09\uFF1A{inner}\u3002\u4F60\u7684 API key \u88AB\u62D2\u7EDD\u3002\u8FD0\u884C `reasonix setup` \u6216 `export DEEPSEEK_API_KEY=sk-...` \u4FEE\u590D\u3002\u5728 https://platform.deepseek.com/api_keys \u83B7\u53D6 key\u3002",
    balance402: "\u4F59\u989D\u4E0D\u8DB3\uFF08DeepSeek 402\uFF09\uFF1A{inner}\u3002\u5728 https://platform.deepseek.com/top_up \u5145\u503C \u2014 \u4F59\u989D\u975E\u96F6\u65F6\u9762\u677F\u9876\u680F\u4F1A\u663E\u793A\u3002",
    badparam422: "\u53C2\u6570\u9519\u8BEF\uFF08DeepSeek 422\uFF09\uFF1A{inner}",
    badrequest400: "\u8BF7\u6C42\u9519\u8BEF\uFF08DeepSeek 400\uFF09\uFF1A{inner}",
    deepseek5xxHead: "DeepSeek \u670D\u52A1\u4E0D\u53EF\u7528\uFF08{status}\uFF09 \u2014 \u8FD9\u662F DeepSeek \u670D\u52A1\u7AEF\u95EE\u9898\uFF0C\u4E0D\u662F Reasonix \u6545\u969C\u3002\u5DF2\u6309\u6307\u6570\u9000\u907F\u91CD\u8BD5 4 \u6B21\u3002",
    deepseek5xxReachable: " DeepSeek \u4E3B API \u5065\u5EB7\u68C0\u67E5\u901A\u8FC7\uFF0C\u4F46 /chat/completions \u5728\u6302 \u2014 \u4ED6\u4EEC\u90A3\u8FB9\u90E8\u5206\u670D\u52A1\u5F02\u5E38\u3002",
    deepseek5xxUnreachable: " \u65E0\u6CD5\u4ECE\u4F60\u7684\u7F51\u7EDC\u8BBF\u95EE DeepSeek API \u2014 \u53EF\u80FD\u662F DS \u6574\u4F53\u6545\u969C\uFF0C\u4E5F\u53EF\u80FD\u662F\u672C\u5730\u7F51\u7EDC\u95EE\u9898\u3002",
    deepseek5xxActionNetwork: " \u5EFA\u8BAE\uFF1A(1) \u68C0\u67E5\u7F51\u7EDC\uFF0C(2) \u7B49 30 \u79D2\u540E\u91CD\u8BD5\uFF0C(3) \u67E5\u770B\u72B6\u6001\u9875 https://status.deepseek.com\u3002",
    deepseek5xxActionRetry: " \u5EFA\u8BAE\uFF1A(1) \u7B49 30 \u79D2\u540E\u91CD\u8BD5\uFF0C(2) \u7528 /preset \u5207\u6362\u6A21\u578B\uFF0C(3) \u67E5\u770B\u72B6\u6001\u9875 https://status.deepseek.com\u3002",
    innerNoMessage: "\uFF08\u65E0\u9519\u8BEF\u4FE1\u606F\uFF09",
    reasonAborted: "[\u7528\u6237\u5DF2\u4E2D\u65AD\uFF08Esc\uFF09 \u2014 \u6B63\u5728\u603B\u7ED3\u5230\u76EE\u524D\u4E3A\u6B62\u7684\u53D1\u73B0]",
    reasonContextGuard: "[\u4E0A\u4E0B\u6587\u989D\u5EA6\u5373\u5C06\u8017\u5C3D \u2014 \u5728\u4E0B\u4E00\u6B21\u8C03\u7528\u6EA2\u51FA\u4E4B\u524D\u5148\u603B\u7ED3]",
    reasonStuck: "[\u5361\u5728\u91CD\u590D\u7684\u5DE5\u5177\u8C03\u7528\u4E0A \u2014 \u8BF4\u660E\u5DF2\u5C1D\u8BD5\u7684\u65B9\u6CD5\u4EE5\u53CA\u963B\u585E\u70B9]",
    reasonBudget: "[\u5DE5\u5177\u8C03\u7528\u914D\u989D\uFF08{iterCap}\uFF09\u5DF2\u7528\u5C3D \u2014 \u57FA\u4E8E\u5DF2\u53D1\u73B0\u7684\u5185\u5BB9\u5F3A\u5236\u603B\u7ED3]",
    labelAborted: "\u7528\u6237\u4E2D\u65AD",
    labelContextGuard: "\u89E6\u53D1\u4E0A\u4E0B\u6587\u4FDD\u62A4\uFF08prompt > 80% \u7A97\u53E3\uFF09",
    labelStuck: "\u5361\u6B7B\uFF08\u91CD\u590D\u5DE5\u5177\u8C03\u7528\u88AB\u53CD\u98CE\u66B4\u673A\u5236\u6291\u5236\uFF09",
    labelBudget: "\u5DE5\u5177\u8C03\u7528\u914D\u989D\uFF08{iterCap}\uFF09\u5DF2\u7528\u5C3D"
  },
  handlers: {
    basic: {
      newInfo: "\u25B8 \u65B0\u5BF9\u8BDD \u2014 \u5DF2\u4ECE\u4E0A\u4E0B\u6587\u4E2D\u4E22\u5F03 {count} \u6761\u6D88\u606F\u3002\u540C\u4E00\u4F1A\u8BDD\uFF0C\u5168\u65B0\u5F00\u59CB\u3002",
      newInfoArchived: "\u25B8 \u65B0\u5BF9\u8BDD \u2014 \u5DF2\u4ECE\u4E0A\u4E0B\u6587\u4E2D\u4E22\u5F03 {count} \u6761\u6D88\u606F\u3002\u539F\u5BF9\u8BDD\u5DF2\u5F52\u6863\u4E3A\u300C{archived}\u300D\uFF0C\u53EF\u5728 Sessions \u9762\u677F\u67E5\u770B\u3002",
      newInfoSystemReloaded: " \xB7 visionox.md / \u9879\u76EE\u8BB0\u5FC6\u5DF2\u91CD\u65B0\u52A0\u8F7D\uFF08\u4E0B\u4E00\u8F6E\u4E00\u6B21\u6027 cache miss\uFF09",
      helpTitle: "\u547D\u4EE4\uFF1A",
      helpShellTitle: "Shell \u5FEB\u6377\u65B9\u5F0F\uFF1A",
      helpShell: "  !<cmd>                   \u5728\u6C99\u7BB1\u6839\u76EE\u5F55\u8FD0\u884C <cmd>\uFF1B\u8F93\u51FA\u8FDB\u5165\u5BF9\u8BDD",
      helpShellDetail: "                             \u4EE5\u4FBF\u6A21\u578B\u5728\u4E0B\u4E00\u8F6E\u770B\u5230\u3002\u65E0\u5141\u8BB8\u5217\u8868\u9650\u5236\u3002",
      helpShellConsent: "                             \u7528\u6237\u8F93\u5165 = \u660E\u786E\u540C\u610F\u3002",
      helpShellExample: "                             \u793A\u4F8B\uFF1A!git status   !ls src/   !npm test",
      helpMemoryTitle: "\u5FEB\u901F\u8BB0\u5FC6\uFF1A",
      helpMemoryPin: "  #<note>                  \u5C06 <note> \u8FFD\u52A0\u5230 <project>/visionox.md\uFF08\u53EF\u63D0\u4EA4\uFF09\u3002",
      helpMemoryPinEx: "                             \u793A\u4F8B\uFF1A#findByEmail \u5FC5\u987B\u533A\u5206\u5927\u5C0F\u5199",
      helpMemoryGlobal: "  #g <note>                \u5C06 <note> \u8FFD\u52A0\u5230 ~/.visionox/visionox.md\uFF08\u5168\u5C40\uFF0C\u4E0D\u63D0\u4EA4\uFF09\u3002",
      helpMemoryGlobalEx: "                             \u793A\u4F8B\uFF1A#g \u59CB\u7EC8\u4F7F\u7528 pnpm \u800C\u975E npm",
      helpMemoryPinBoth: "                             \u4E24\u8005\u90FD\u56FA\u5B9A\u5230\u6BCF\u4E2A\u672A\u6765\u4F1A\u8BDD\u7684\u524D\u7F00\u4E2D\u3002\u6BD4 /memory \u66F4\u5FEB\u3002",
      helpMemoryEscape: "                             \u4F7F\u7528 `\\#text` \u53D1\u9001\u5B57\u9762\u91CF `#text` \u7ED9\u6A21\u578B\u3002",
      helpFileTitle: "\u6587\u4EF6\u5F15\u7528\uFF08\u4EE3\u7801\u6A21\u5F0F\uFF09\uFF1A",
      helpFile: "  @path/to/file            \u53D1\u9001\u65F6\u5C06\u6587\u4EF6\u5185\u5BB9\u5185\u8054\u5230 [Referenced files] \u4E0B\u3002",
      helpFilePicker: "                             \u8F93\u5165 `@` \u6253\u5F00\u9009\u62E9\u5668\uFF08\u2191\u2193 \u5BFC\u822A\uFF0CTab/Enter \u9009\u62E9\uFF09\u3002",
      helpUrlTitle: "URL \u5F15\u7528\uFF1A",
      helpUrl: "  @https://example.com     \u83B7\u53D6 URL\uFF0C\u5265\u79BB HTML\uFF0C\u5185\u8054\u5230 [Referenced URLs] \u4E0B\u3002",
      helpUrlCache: "                             \u540C\u4E00\u4F1A\u8BDD\u4E2D\u76F8\u540C URL \u53EA\u83B7\u53D6\u4E00\u6B21\uFF08\u5185\u5B58\u7F13\u5B58\uFF09\u3002",
      helpUrlPunct: "                             \u81EA\u52A8\u5265\u79BB\u5C3E\u90E8\u6807\u70B9\u7B26\u53F7\uFF08./,/\uFF09\uFF09\u3002",
      helpPresetsTitle: "\u9884\u8BBE\uFF08branch + harvest \u6C38\u8FDC\u4E0D\u4F1A\u81EA\u52A8\u542F\u7528 \u2014 \u4EC5\u624B\u52A8\u9009\u62E9\uFF09\uFF1A",
      helpPresetAuto: "  auto   v4-flash \u2192 v4-pro \u5728\u56F0\u96BE\u8F6E\u6B21\u5207\u6362  \u2190 \u9ED8\u8BA4 \xB7 \u7B80\u5355\u65F6\u4FBF\u5B9C\uFF0C\u56F0\u96BE\u65F6\u667A\u80FD",
      helpPresetFlash: "  flash  \u59CB\u7EC8\u4F7F\u7528 v4-flash                  \u6700\u4FBF\u5B9C \xB7 \u6BCF\u8F6E\u6210\u672C\u53EF\u9884\u6D4B",
      helpPresetPro: "  pro    \u59CB\u7EC8\u4F7F\u7528 v4-pro                     \u7EA6 3 \u500D flash \xB7 \u7528\u4E8E\u56F0\u96BE\u7684\u591A\u8F6E\u5DE5\u4F5C",
      helpSessionsTitle: "\u4F1A\u8BDD\uFF08\u9ED8\u8BA4\u81EA\u52A8\u542F\u7528\uFF0C\u547D\u540D\u4E3A 'default'\uFF09\uFF1A",
      helpSessionCustom: "  reasonix chat --session <name>   \u4F7F\u7528\u4E0D\u540C\u7684\u547D\u540D\u4F1A\u8BDD",
      helpSessionNone: "  reasonix chat --no-session       \u7981\u7528\u672C\u6B21\u8FD0\u884C\u7684\u6301\u4E45\u5316",
      retryNone: "\u6CA1\u6709\u53EF\u91CD\u8BD5\u7684\u5185\u5BB9 \u2014 \u6B64\u4F1A\u8BDD\u65E5\u5FD7\u4E2D\u6CA1\u6709\u5148\u524D\u7684\u7528\u6237\u6D88\u606F\u3002",
      retryInfo: '\u25B8 \u91CD\u8BD5\u4E2D\uFF1A"{preview}"',
      loopTuiOnly: "/loop \u4EC5\u5728\u4EA4\u4E92\u5F0F TUI \u4E2D\u53EF\u7528\uFF08\u4E0D\u5728 run/replay \u4E2D\uFF09\u3002",
      loopStopped: "\u25B8 \u5FAA\u73AF\u5DF2\u505C\u6B62\u3002",
      loopNoActive: "\u6CA1\u6709\u6D3B\u52A8\u7684\u5FAA\u73AF\u53EF\u505C\u6B62\u3002",
      loopNoActiveHint: "\u6CA1\u6709\u6D3B\u52A8\u7684\u5FAA\u73AF\u3002\u4F7F\u7528 `/loop <interval> <prompt>` \u542F\u52A8\u4E00\u4E2A\uFF08\u4F8B\u5982 /loop 30s npm test\uFF09\u3002\n\u53D6\u6D88\u65B9\u5F0F\uFF1A/loop stop \xB7 Esc \xB7 /clear /new \xB7 \u4EFB\u4F55\u7528\u6237\u8F93\u5165\u7684\u63D0\u793A\u3002",
      loopStarted: '\u25B8 \u5FAA\u73AF\u5DF2\u542F\u52A8 \u2014 \u6BCF {duration} \u91CD\u65B0\u63D0\u4EA4 "{prompt}"\u3002\u8F93\u5165\u4EFB\u4F55\u5185\u5BB9\uFF08\u6216 /loop stop\uFF09\u53D6\u6D88\u3002',
      keysNeedsTui: "/keys \u9700\u8981 TUI \u4E0A\u4E0B\u6587\uFF08postKeys \u5DF2\u8FDE\u63A5\uFF09\u3002",
      unknownCommand: "\u672A\u77E5\u547D\u4EE4\uFF1A/{cmd} \u2014 \u4F60\u662F\u4E0D\u662F\u60F3\u7528 {list}\uFF1F",
      unknownCommandShort: "\u672A\u77E5\u547D\u4EE4\uFF1A/{cmd}  \uFF08\u8BD5\u8BD5 /help\uFF09"
    },
    admin: {
      doctorNeedsTui: "/doctor \u9700\u8981 TUI \u4E0A\u4E0B\u6587\uFF08postDoctor \u5DF2\u8FDE\u63A5\uFF09\u3002",
      doctorRunning: "\u2695 \u5065\u5EB7\u68C0\u67E5 \u2014 \u6B63\u5728\u8FD0\u884C\u2026",
      hooksReloadUnavailable: "/hooks reload \u5728\u6B64\u4E0A\u4E0B\u6587\u4E2D\u4E0D\u53EF\u7528\uFF08\u65E0\u91CD\u8F7D\u56DE\u8C03\uFF09\u3002",
      hooksReloaded: "\u25B8 \u5DF2\u91CD\u8F7D hooks \xB7 {count} \u4E2A\u6D3B\u8DC3",
      hooksUsage: "\u7528\u6CD5\uFF1A/hooks            \u5217\u51FA\u6D3B\u8DC3\u7684 hooks\n       /hooks reload     \u91CD\u65B0\u8BFB\u53D6 settings.json \u6587\u4EF6",
      hooksNone: "\u672A\u914D\u7F6E hooks\u3002",
      hooksDropHint: "\u5C06\u5305\u542B `hooks` \u952E\u7684 settings.json \u653E\u5165\u4EE5\u4E0B\u4EFB\u4E00\u4F4D\u7F6E\uFF1A",
      hooksProject: "  \xB7 {path}\uFF08\u9879\u76EE\uFF09",
      hooksProjectFallback: "  \xB7 <project>/.visionox/settings.json\uFF08\u9879\u76EE\uFF09",
      hooksGlobal: "  \xB7 {path}\uFF08\u5168\u5C40\uFF09",
      hooksEvents: "\u4E8B\u4EF6\uFF1APreToolUse, PostToolUse, UserPromptSubmit, Stop",
      hooksExitCodes: "exit 0 = \u901A\u8FC7 \xB7 exit 2 = \u963B\u6B62\uFF08Pre*\uFF09\xB7 \u5176\u4ED6 = \u8B66\u544A",
      hooksLoaded: "\u25B8 \u5DF2\u52A0\u8F7D {count} \u4E2A hook",
      hooksSources: "\u6765\u6E90\uFF1Aproject={project} \xB7 global={global}",
      updateCurrent: "\u5F53\u524D\uFF1Areasonix {version}",
      updateLatestPending: "\u6700\u65B0\uFF1A\uFF08\u5C1A\u672A\u89E3\u6790 \u2014 \u540E\u53F0\u68C0\u67E5\u8FDB\u884C\u4E2D\u6216\u79BB\u7EBF\uFF09",
      updateRetryHint: "\u5DF2\u89E6\u53D1\u65B0\u7684\u6CE8\u518C\u8868\u83B7\u53D6 \u2014 \u51E0\u79D2\u540E\u91CD\u8BD5 `/update`\uFF0C",
      updateRetryHint2: "\u6216\u5728\u53E6\u4E00\u4E2A\u7EC8\u7AEF\u8FD0\u884C `reasonix update` \u5F3A\u5236\u540C\u6B65\u6267\u884C\u3002",
      updateLatest: "\u6700\u65B0\uFF1Areasonix {version}",
      updateUpToDate: "\u60A8\u5DF2\u662F\u6700\u65B0\u7248\u672C\u3002\u65E0\u9700\u64CD\u4F5C\u3002",
      updateNpxHint: "\u60A8\u6B63\u5728\u901A\u8FC7 npx \u8FD0\u884C \u2014 \u4E0B\u6B21 `npx reasonix ...` \u542F\u52A8\u65F6\u5C06\u81EA\u52A8\u83B7\u53D6\u3002",
      updateNpxForce: "\u8981\u5F3A\u5236\u5237\u65B0\uFF1A`npm cache clean --force`\u3002",
      updateUpgradeHint: "\u8981\u5347\u7EA7\uFF0C\u8BF7\u9000\u51FA\u6B64\u4F1A\u8BDD\u5E76\u8FD0\u884C\uFF1A",
      updateUpgradeCmd1: "  reasonix update           \uFF08\u4EA4\u4E92\u5F0F\uFF0C\u652F\u6301 --dry-run \u9884\u89C8\uFF09",
      updateUpgradeCmd2: "  {command}   \uFF08\u76F4\u63A5\u5B89\u88C5\uFF09",
      updateInSessionDisabled: "\u4F1A\u8BDD\u5185\u5B89\u88C5\u88AB\u523B\u610F\u7981\u7528 \u2014 \u5B89\u88C5\u547D\u4EE4\u4F1A",
      updateInSessionDisabled2: "\u7834\u574F\u6B64 TUI \u7684\u6E32\u67D3\uFF0C\u4E14 Windows \u53EF\u80FD\u9501\u5B9A\u8FD0\u884C\u4E2D\u7684\u4E8C\u8FDB\u5236\u6587\u4EF6\u3002",
      statsNoData: "\u5C1A\u65E0\u4F7F\u7528\u6570\u636E\u3002",
      statsEveryTurn: "\u60A8\u5728\u6B64\u8FD0\u884C\u7684\u6BCF\u4E00\u8F6E\u90FD\u4F1A\u8FFD\u52A0\u4E00\u6761\u8BB0\u5F55 \u2014 \u6B64\u4F1A\u8BDD\u7684\u8F6E\u6B21",
      statsWillAppear: "\u5C06\u5728\u60A8\u53D1\u9001\u6D88\u606F\u540E\u663E\u793A\u5728\u4EEA\u8868\u677F\u4E2D\u3002"
    },
    edits: {
      undoCodeOnly: "/undo \u4EC5\u5728 `reasonix code` \u4E2D\u53EF\u7528 \u2014 \u804A\u5929\u6A21\u5F0F\u4E0D\u5E94\u7528\u7F16\u8F91\u3002",
      historyCodeOnly: "/history \u4EC5\u5728 `reasonix code` \u4E2D\u53EF\u7528\u3002",
      showCodeOnly: "/show \u4EC5\u5728 `reasonix code` \u4E2D\u53EF\u7528\u3002",
      applyCodeOnly: "/apply \u4EC5\u5728 `reasonix code` \u4E2D\u53EF\u7528\uFF08\u6B64\u5904\u65E0\u5185\u5BB9\u53EF\u5E94\u7528\uFF09\u3002",
      discardCodeOnly: "/discard \u4EC5\u5728 `reasonix code` \u4E2D\u53EF\u7528\u3002",
      planCodeOnly: "/plan \u4EC5\u5728 `reasonix code` \u4E2D\u53EF\u7528 \u2014 \u804A\u5929\u6A21\u5F0F\u4E0D\u9650\u5236\u5DE5\u5177\u5199\u5165\u3002",
      planOn: "\u25B8 \u8BA1\u5212\u6A21\u5F0F\u5F00\u542F \u2014 \u5199\u5165\u5DE5\u5177\u88AB\u9650\u5236\uFF1B\u6A21\u578B\u5FC5\u987B\u5148\u8C03\u7528 `submit_plan` \u624D\u80FD\u6267\u884C\u4EFB\u4F55\u64CD\u4F5C\u3002\uFF08\u6A21\u578B\u4E5F\u53EF\u4EE5\u5728\u8BA1\u5212\u6A21\u5F0F\u5173\u95ED\u65F6\u81EA\u4E3B\u8C03\u7528 submit_plan \u5904\u7406\u5927\u578B\u4EFB\u52A1 \u2014 \u6B64\u5F00\u5173\u662F\u66F4\u5F3A\u7684\u663E\u5F0F\u7EA6\u675F\u3002\uFF09\u8F93\u5165 /plan off \u9000\u51FA\u3002",
      planOff: "\u25B8 \u8BA1\u5212\u6A21\u5F0F\u5173\u95ED \u2014 \u5199\u5165\u5DE5\u5177\u518D\u6B21\u53EF\u7528\u3002\u6A21\u578B\u4ECD\u53EF\u4E3A\u5927\u578B\u4EFB\u52A1\u81EA\u4E3B\u63D0\u51FA\u8BA1\u5212\u3002",
      modeCodeOnly: "/mode \u4EC5\u5728 `reasonix code` \u4E2D\u53EF\u7528\u3002",
      modeUsage: "\u7528\u6CD5\uFF1A/mode <review|auto|yolo>   \uFF08Shift+Tab \u4E5F\u53EF\u5FAA\u73AF\uFF09",
      modeYolo: "\u25B8 \u7F16\u8F91\u6A21\u5F0F\uFF1AYOLO \u2014 \u7F16\u8F91\u548C Shell \u547D\u4EE4\u81EA\u52A8\u8FD0\u884C\uFF0C\u65E0\u63D0\u793A\u3002/undo \u4ECD\u53EF\u56DE\u6EDA\u7F16\u8F91\u3002\u8BF7\u8C28\u614E\u4F7F\u7528\u3002",
      modeAuto: "\u25B8 \u7F16\u8F91\u6A21\u5F0F\uFF1AAUTO \u2014 \u7F16\u8F91\u7ACB\u5373\u5E94\u7528\uFF1B\u5728 5 \u79D2\u5185\u6309 u \u64A4\u6D88\uFF0C\u6216\u7A0D\u540E\u4F7F\u7528 /undo\u3002Shell \u547D\u4EE4\u4ECD\u4F1A\u8BE2\u95EE\u3002",
      modeReview: "\u25B8 \u7F16\u8F91\u6A21\u5F0F\uFF1Areview \u2014 \u7F16\u8F91\u6392\u961F\u7B49\u5F85 /apply\uFF08\u6216 y\uFF09/ /discard\uFF08\u6216 n\uFF09",
      commitCodeOnly: "/commit \u4EC5\u5728 `reasonix code` \u4E2D\u53EF\u7528\uFF08\u9700\u8981\u6709\u6839\u7684 git \u4ED3\u5E93\uFF09\u3002",
      commitUsage: '\u7528\u6CD5\uFF1A/commit "\u63D0\u4EA4\u6D88\u606F"  \u2014 \u5728 {root} \u4E2D\u8FD0\u884C `git add -A && git commit -m "\u2026"`',
      walkCodeOnly: "/walk \u4EC5\u5728 `reasonix code` \u4E2D\u53EF\u7528\u3002",
      checkpointCodeOnly: "/checkpoint \u4EC5\u5728 `reasonix code` \u4E2D\u53EF\u7528 \u2014 \u804A\u5929\u6A21\u5F0F\u4E0D\u5E94\u7528\u7F16\u8F91\u3002",
      checkpointNone: "\u5C1A\u65E0\u68C0\u67E5\u70B9 \u2014 `/checkpoint <name>` \u5FEB\u7167\u4F1A\u8BDD\u6D89\u53CA\u7684\u6BCF\u4E2A\u6587\u4EF6\u3002\u7A0D\u540E\u4F7F\u7528 `/restore <name>` \u6062\u590D\u3002",
      checkpointHeader: "\u25C8 \u68C0\u67E5\u70B9 \xB7 \u5DF2\u5B58\u50A8 {count} \u4E2A",
      checkpointRestoreHint: "  /restore <name|id> \xB7 /checkpoint forget <id> \xB7 /checkpoint <name> \u6DFB\u52A0",
      checkpointForgetUsage: "\u7528\u6CD5\uFF1A/checkpoint forget <id|name>",
      checkpointNoMatch: '\u25B8 \u672A\u627E\u5230\u5339\u914D "{name}" \u7684\u68C0\u67E5\u70B9 \u2014 \u89C1 /checkpoint list',
      checkpointDeleted: "\u25B8 \u5DF2\u5220\u9664\u68C0\u67E5\u70B9 {id}\uFF08{name}\uFF09",
      checkpointDeleteFailed: "\u25B8 \u5220\u9664 {id} \u5931\u8D25\uFF08\u5DF2\u6D88\u5931\uFF1F\uFF09",
      checkpointSaveUsage: "\u7528\u6CD5\uFF1A/checkpoint <name>   \uFF08\u6216 /checkpoint list \u67E5\u770B\u73B0\u6709\uFF09",
      checkpointSavedEmpty: '\u25B8 \u68C0\u67E5\u70B9 "{name}" \u5DF2\u4FDD\u5B58\uFF08{id}\uFF09\u2014 \u4F46\u5C1A\u672A\u6D89\u53CA\u4EFB\u4F55\u6587\u4EF6\uFF0C\u56E0\u6B64\u662F\u7A7A\u57FA\u7EBF\u3002\u6B64\u540E\u7684\u7F16\u8F91\u5C06\u53EF\u64A4\u6D88\u3002',
      checkpointSaved: '\u25B8 \u68C0\u67E5\u70B9 "{name}" \u5DF2\u4FDD\u5B58\uFF08{id}\uFF09\u2014 {files} \u4E2A\u6587\u4EF6\uFF0C{size} KB\u3002\u6062\u590D\uFF1A/restore {name}',
      restoreCodeOnly: "/restore \u4EC5\u5728 `reasonix code` \u4E2D\u53EF\u7528\u3002",
      restoreUsage: "\u7528\u6CD5\uFF1A/restore <name|id>   \uFF08\u89C1 /checkpoint list \u83B7\u53D6 ID\uFF09",
      restoreNoMatch: '\u25B8 \u672A\u627E\u5230\u5339\u914D "{target}" \u7684\u68C0\u67E5\u70B9 \u2014 \u5C1D\u8BD5 /checkpoint list',
      restoreInfo: '\u25B8 \u5DF2\u6062\u590D "{name}"\uFF08{id}\uFF09\uFF0C\u6765\u81EA {when}',
      restoreWrote: "  \xB7 \u5199\u56DE\u4E86 {count} \u4E2A\u6587\u4EF6",
      restoreRemoved: "  \xB7 \u79FB\u9664\u4E86 {count} \u4E2A\u6587\u4EF6\uFF08\u68C0\u67E5\u70B9\u65F6\u4E0D\u5B58\u5728\uFF09",
      restoreSkipped: "  \u2717 \u8DF3\u8FC7\u4E86 {count} \u4E2A\u6587\u4EF6\uFF1A",
      cwdCodeOnly: "/cwd \u4EC5\u5728 `reasonix code` \u4E2D\u53EF\u7528\u3002",
      cwdUsage: "\u7528\u6CD5\uFF1A/cwd <path>   \uFF08\u5F53\u524D\u6839\u76EE\u5F55\uFF1A{current}\uFF09\u3002\u91CD\u65B0\u6307\u5411 filesystem / shell / memory \u5DE5\u5177\u5230 <path>\u3002",
      cwdUsageNoCurrent: "\u7528\u6CD5\uFF1A/cwd <path>   \u5C06\u5DE5\u4F5C\u533A\u6839\u76EE\u5F55\u5207\u6362\u5230 <path>\u3002"
    },
    model: {
      modelHint: "\u5C1D\u8BD5 deepseek-v4-flash \u6216 deepseek-v4-pro \u2014 \u8FD0\u884C /models \u83B7\u53D6\u5B9E\u65F6\u5217\u8868",
      modelUsage: "\u7528\u6CD5\uFF1A/model <id>   \uFF08{hint}\uFF09",
      modelNotInCatalog: "model \u2192 {id}   \uFF08\u26A0 \u4E0D\u5728\u83B7\u53D6\u7684\u76EE\u5F55\u4E2D\uFF1A{list}\u3002\u5982\u679C\u8FD9\u662F\u9519\u8BEF\u7684\uFF0C\u4E0B\u6B21\u8C03\u7528\u5C06\u8FD4\u56DE 400 \u2014 \u8FD0\u884C /models \u5237\u65B0\u3002\uFF09",
      modelSet: "model \u2192 {id}",
      presetAuto: "preset \u2192 auto  \uFF08v4-flash \u2192 v4-pro \u5728\u56F0\u96BE\u8F6E\u6B21\u5207\u6362 \xB7 \u9ED8\u8BA4\uFF09",
      presetFlash: "preset \u2192 flash  \uFF08\u59CB\u7EC8\u4F7F\u7528 v4-flash \xB7 \u6700\u4FBF\u5B9C \xB7 /pro \u4ECD\u53EF\u4E34\u65F6\u63D0\u5347\u4E00\u8F6E\uFF09",
      presetPro: "preset \u2192 pro  \uFF08\u59CB\u7EC8\u4F7F\u7528 v4-pro \xB7 \u7EA6 3 \u500D flash \xB7 \u7528\u4E8E\u56F0\u96BE\u7684\u591A\u8F6E\u5DE5\u4F5C\uFF09",
      presetUsage: "\u7528\u6CD5\uFF1A/preset <auto|flash|pro>",
      proNothingArmed: "\u672A\u542F\u7528 \u2014 /pro \u4E0D\u5E26\u53C2\u6570\u5C06\u4E3A\u4E0B\u4E00\u8F6E\u542F\u7528 pro",
      proDisarmed: "\u25B8 /pro \u5DF2\u89E3\u9664 \u2014 \u4E0B\u4E00\u8F6E\u56DE\u9000\u5230\u5F53\u524D\u9884\u8BBE",
      proUsage: "\u7528\u6CD5\uFF1A/pro       \u4E3A\u4E0B\u4E00\u8F6E\u542F\u7528 pro\uFF08\u4E00\u6B21\u6027\uFF0C\u81EA\u52A8\u89E3\u9664\uFF09\n       /pro off  \u5728\u4E0B\u4E00\u8F6E\u524D\u53D6\u6D88\u542F\u7528\u72B6\u6001",
      proArmed: "\u25B8 /pro \u5DF2\u542F\u7528 \u2014 \u60A8\u7684\u4E0B\u4E00\u6761\u6D88\u606F\u5C06\u5728 {model} \u4E0A\u8FD0\u884C\uFF0C\u65E0\u8BBA\u9884\u8BBE\u5982\u4F55\u3002\u4E00\u8F6E\u540E\u81EA\u52A8\u89E3\u9664\u3002\u4F7F\u7528 /preset max \u8FDB\u884C\u6301\u4E45\u5207\u6362\u3002",
      budgetNoCap: "\u672A\u8BBE\u7F6E\u4F1A\u8BDD\u9884\u7B97 \u2014 Reasonix \u5C06\u6301\u7EED\u8FD0\u884C\u76F4\u5230\u60A8\u505C\u6B62\u3002\u4F7F\u7528\u4EE5\u4E0B\u65B9\u5F0F\u8BBE\u7F6E\uFF1A/budget <usd>   \uFF08\u4F8B\u5982 /budget 5\uFF09",
      budgetStatus: "\u9884\u7B97\uFF1A${spent} / ${cap}\uFF08{pct}%\uFF09\xB7 /budget off \u6E05\u9664\uFF0C/budget <usd> \u66F4\u6539",
      budgetOff: "budget \u2192 \u5173\u95ED\uFF08\u65E0\u4E0A\u9650\uFF09",
      budgetUsage: '\u7528\u6CD5\uFF1A/budget <usd>   \uFF08\u6536\u5230 "{arg}" \u2014 \u5FC5\u987B\u662F\u6B63\u6570\uFF0C\u4F8B\u5982 /budget 5 \u6216 /budget 12.50\uFF09',
      budgetExhausted: "\u25B2 budget \u2192 ${cap} \u4F46\u5DF2\u82B1\u8D39 ${spent}\u3002\u4E0B\u4E00\u8F6E\u5C06\u88AB\u62D2\u7EDD \u2014 \u63D0\u9AD8\u4E0A\u9650\u4EE5\u7EE7\u7EED\uFF0C\u6216\u7ED3\u675F\u4F1A\u8BDD\u3002",
      budgetSet: "budget \u2192 ${cap}  \uFF08\u8FC4\u4ECA\uFF1A${spent} \xB7 80% \u65F6\u8B66\u544A\uFF0C100% \u65F6\u62D2\u7EDD\u4E0B\u4E00\u8F6E \xB7 /budget off \u6E05\u9664\uFF09"
    },
    permissions: {
      mutateCodeOnly: "/permissions add / remove / clear \u4EC5\u5728 `reasonix code` \u4E2D\u53EF\u7528 \u2014 \u5B83\u4EEC\u7F16\u8F91\u9879\u76EE\u8303\u56F4\u7684\u5141\u8BB8\u5217\u8868\uFF08`~/.visionox/config.json` projects[<root>].shellAllowed\uFF09\u3002",
      addUsage: '\u7528\u6CD5\uFF1A/permissions add <prefix>   \uFF08\u591A token \u53EF\u7528\uFF1A/permissions add "git push origin"\uFF09',
      addAlready: "\u25B8 \u5DF2\u5141\u8BB8\uFF1A{prefix}",
      addBuiltin: "\u25B8 `{prefix}` \u5DF2\u5728\u5185\u7F6E\u5141\u8BB8\u5217\u8868\u4E2D \u2014 \u65E0\u9700\u9879\u76EE\u6761\u76EE\u3002\uFF08\u5185\u7F6E\u6761\u76EE\u59CB\u7EC8\u5F00\u542F\u3002\uFF09",
      addInfo: "\u25B8 \u5DF2\u6DFB\u52A0\uFF1A{prefix}\n  \u2192 \u5728\u6B64\u9879\u76EE\u4E2D\uFF0C\u4E0B\u6B21 `{prefix}` \u8C03\u7528\u5C06\u65E0\u9700\u63D0\u793A\u3002",
      removeUsage: "\u7528\u6CD5\uFF1A/permissions remove <prefix-or-index>   \uFF08\u4F8B\u5982 /permissions remove 3\uFF0C\u6216 /permissions remove npm\uFF09",
      removeEmpty: "\u25B8 \u6CA1\u6709\u9879\u76EE\u5141\u8BB8\u5217\u8868\u6761\u76EE\u53EF\u79FB\u9664\u3002",
      removeIndexOob: "\u25B8 \u7D22\u5F15\u8D85\u51FA\u8303\u56F4\uFF1A{idx}\uFF08\u9879\u76EE\u5217\u8868\u6709 {count} \u4E2A\u6761\u76EE\uFF09",
      removeNothing: "\u25B8 \u65E0\u5185\u5BB9\u53EF\u79FB\u9664\u3002",
      removeBuiltin: "\u25B8 `{prefix}` \u5728\u5185\u7F6E\u5141\u8BB8\u5217\u8868\u4E2D\uFF08\u53EA\u8BFB\uFF09\u3002\u5185\u7F6E\u6761\u76EE\u65E0\u6CD5\u5728\u8FD0\u884C\u65F6\u79FB\u9664 \u2014 \u5B83\u4EEC\u5DF2\u7F16\u8BD1\u5230\u4E8C\u8FDB\u5236\u6587\u4EF6\u4E2D\u3002",
      removeInfo: "\u25B8 \u5DF2\u79FB\u9664\uFF1A{prefix}",
      removeNotFound: "\u25B8 \u65E0\u6B64\u9879\u76EE\u6761\u76EE\uFF1A{prefix}   \uFF08\u5C1D\u8BD5 /permissions list \u67E5\u770B\u5DF2\u5B58\u50A8\u7684\u5185\u5BB9\uFF09",
      clearAlready: "\u25B8 \u9879\u76EE\u5141\u8BB8\u5217\u8868\u5DF2\u4E3A\u7A7A\u3002",
      clearConfirm: "\u5373\u5C06\u4E22\u5F03 {root} \u7684 {count} \u4E2A\u9879\u76EE\u5141\u8BB8\u5217\u8868\u6761\u76EE\u3002\u91CD\u65B0\u8FD0\u884C\u5E76\u9644\u5E26 'confirm' \u4E00\u8BCD\u4EE5\u7EE7\u7EED\uFF1A/permissions clear confirm",
      clearedNone: "\u25B8 \u9879\u76EE\u5141\u8BB8\u5217\u8868\u5DF2\u4E3A\u7A7A \u2014 \u65E0\u53D8\u5316\u3002",
      cleared: "\u25B8 \u5DF2\u6E05\u9664 {count} \u4E2A\u9879\u76EE\u5141\u8BB8\u5217\u8868\u6761\u76EE\u3002",
      usage: '\u7528\u6CD5\uFF1A/permissions [list]                   \u663E\u793A\u5F53\u524D\u72B6\u6001\n       /permissions add <prefix>            \u6301\u4E45\u5316\uFF08\u4F8B\u5982 "npm run build"\uFF09\n       /permissions remove <prefix-or-N>    \u5220\u9664\u4E00\u4E2A\u6761\u76EE\n       /permissions clear confirm           \u6E05\u9664\u6240\u6709\u9879\u76EE\u6761\u76EE',
      modeYolo: "\u25B8 \u7F16\u8F91\u6A21\u5F0F\uFF1AYOLO  \u2014 \u6BCF\u4E2A shell \u547D\u4EE4\u81EA\u52A8\u8FD0\u884C\uFF0C\u5141\u8BB8\u5217\u8868\u88AB\u7ED5\u8FC7\u3002/mode review \u91CD\u65B0\u542F\u7528\u63D0\u793A\u3002",
      modeAuto: "\u25B8 \u7F16\u8F91\u6A21\u5F0F\uFF1Aauto  \u2014 \u7F16\u8F91\u81EA\u52A8\u5E94\u7528\uFF0Cshell \u4ECD\u53D7\u5141\u8BB8\u5217\u8868\u9650\u5236\uFF08\u6216\u975E\u5141\u8BB8\u5217\u8868\u7684 ShellConfirm \u63D0\u793A\uFF09\u3002",
      modeReview: "\u25B8 \u7F16\u8F91\u6A21\u5F0F\uFF1Areview \u2014 \u7F16\u8F91\u548C\u975E\u5141\u8BB8\u5217\u8868\u7684 shell \u547D\u4EE4\u5728\u8FD0\u884C\u524D\u90FD\u4F1A\u8BE2\u95EE\u3002",
      projectHeader: "\u9879\u76EE\u5141\u8BB8\u5217\u8868\uFF08{count}\uFF09\u2014 {root}",
      projectNone1: '  \uFF08\u65E0 \u2014 \u5728 ShellConfirm \u63D0\u793A\u4E2D\u9009\u62E9 "always allow" \u6DFB\u52A0\u4E00\u4E2A\uFF0C',
      projectNone2: "   \u6216\u76F4\u63A5 `/permissions add <prefix>`\u3002\uFF09",
      projectNoRoot: "\u9879\u76EE\u5141\u8BB8\u5217\u8868 \u2014 \uFF08\u65E0\u9879\u76EE\u6839\u76EE\u5F55\uFF1B\u804A\u5929\u6A21\u5F0F\u4EC5\u663E\u793A\u5185\u7F6E\u6761\u76EE\uFF09",
      builtinHeader: "\u5185\u7F6E\u5141\u8BB8\u5217\u8868\uFF08{count}\uFF09\u2014 \u53EA\u8BFB\uFF0C\u5DF2\u7F16\u8BD1",
      subcommands: "\u5B50\u547D\u4EE4\uFF1A/permissions add <prefix> \xB7 /permissions remove <prefix-or-N> \xB7 /permissions clear confirm"
    },
    dashboard: {
      notAvailable: "/dashboard \u5728\u6B64\u4E0A\u4E0B\u6587\u4E2D\u4E0D\u53EF\u7528\uFF08\u65E0 startDashboard \u56DE\u8C03\uFF09\u3002",
      stopNoCallback: "/dashboard stop\uFF1A\u65E0\u505C\u6B62\u56DE\u8C03\u3002",
      notRunning: "\u25B8 \u4EEA\u8868\u677F\u672A\u8FD0\u884C\u3002",
      stopping: "\u25B8 \u4EEA\u8868\u677F\u6B63\u5728\u505C\u6B62\u2026",
      alreadyRunning: "\u25B8 \u4EEA\u8868\u677F\u5DF2\u5728\u8FD0\u884C\uFF1A",
      alreadyRunningHint: "\u5728\u4EFB\u4F55\u6D4F\u89C8\u5668\u4E2D\u6253\u5F00\u5B83\u3002\u8F93\u5165 `/dashboard stop` \u5173\u95ED\u3002",
      ready: "\u25B8 \u4EEA\u8868\u677F\u5C31\u7EEA\uFF1A",
      readyHint: "\u4EC5 127.0.0.1 \xB7 token \u4FDD\u62A4\u3002\u8F93\u5165 `/dashboard stop` \u5173\u95ED\u3002",
      failed: "\u25B8 \u4EEA\u8868\u677F\u542F\u52A8\u5931\u8D25\uFF1A{reason}",
      starting: "\u25B8 \u6B63\u5728\u542F\u52A8\u4EEA\u8868\u677F\u670D\u52A1\u5668\u2026"
    },
    observability: {
      contextInfo: "\u4E0A\u4E0B\u6587\uFF1A~{total} / {max}\uFF08{pct}%\uFF09\xB7 \u7CFB\u7EDF {sys} \xB7 \u5DE5\u5177 {tools} \xB7 \u65E5\u5FD7 {log}",
      compactStarting: "\u25B8 \u6B63\u5728\u6298\u53E0\u65E7\u8F6E\u6B21\u4E3A\u6458\u8981\u2026",
      compactNoop: "\u25B8 \u65E0\u9700\u6298\u53E0 \u2014 \u65E5\u5FD7\u5DF2\u8DB3\u591F\u5C0F\uFF0C\u6216\u6700\u8FD1\u8F6E\u6B21\u672C\u8EAB\u5DF2\u8D85\u8FC7\u9884\u7B97\u3002",
      compactDone: "\u25B8 \u5DF2\u6298\u53E0 {before} \u6761\u6D88\u606F \u2192 {after}\uFF08\u6458\u8981 {chars} \u5B57\u7B26\uFF09\u3002\u7EE7\u7EED\u3002",
      compactFailed: "\u25B8 \u6298\u53E0\u5931\u8D25\uFF1A{reason}",
      costNoTurn: "\u5C1A\u65E0\u8F6E\u6B21 \u2014 `/cost` \u663E\u793A\u6700\u8FD1\u4E00\u8F6E\u7684 token + \u82B1\u8D39\u660E\u7EC6\u3002",
      costNeedsTui: "/cost \u9700\u8981 TUI \u4E0A\u4E0B\u6587\uFF08postUsage \u5DF2\u8FDE\u63A5\uFF09\u3002",
      costNoPricing: '\u25B8 /cost\uFF1A\u6A21\u578B "{model}" \u65E0\u5B9A\u4EF7\u8868\u3002\u8BF7\u5728 telemetry/stats.ts \u4E2D\u6DFB\u52A0\u3002',
      costEstimate: "\u25B8 /cost \u4F30\u7B97 \xB7 {model} \xB7 {prompt} prompt tokens\uFF08\u7CFB\u7EDF {sys} + \u5DE5\u5177 {tools} + \u65E5\u5FD7 {log} + \u6D88\u606F {msg}\uFF09",
      costWorstCase: "  \u6700\u574F\u60C5\u51B5\uFF08\u5B8C\u5168\u672A\u547D\u4E2D\uFF09\uFF1A{input} \u8F93\u5165 + ~{output} \u8F93\u51FA\uFF08{avg} \u5E73\u5747\uFF09\u2248 {total}",
      costLikely: "  \u53EF\u80FD\uFF08{pct}% \u4F1A\u8BDD\u7F13\u5B58\u547D\u4E2D\uFF09\uFF1A{input} \u8F93\u5165 + ~{output} \u8F93\u51FA \u2248 {total}",
      costLikelyCold: "  \u53EF\u80FD\uFF1A\u5728\u7F13\u5B58\u586B\u5145\u524D\u4E0E\u6700\u574F\u60C5\u51B5\u76F8\u540C\uFF08\u65E0\u5DF2\u5B8C\u6210\u7684\u8F6E\u6B21\uFF09",
      statusModel: "  \u6A21\u578B    {model}",
      statusFlags: "  \u6807\u5FD7    stream={stream} \xB7 effort={effort}",
      statusCtx: "  \u4E0A\u4E0B\u6587  {bar} {used}/{max}\uFF08{pct}%\uFF09",
      statusCtxNone: "  \u4E0A\u4E0B\u6587  \u5C1A\u65E0\u8F6E\u6B21",
      statusCost: "  \u6210\u672C    ${cost} \xB7 \u7F13\u5B58 {bar} {pct}% \xB7 \u8F6E\u6B21 {turns}",
      statusCostCold: "  \u6210\u672C    ${cost} \xB7 \u8F6E\u6B21 {turns}\uFF08\u7F13\u5B58\u9884\u70ED\u4E2D\uFF09",
      statusBudget: "  \u9884\u7B97    ${spent} / ${cap}\uFF08{pct}%\uFF09{tag}",
      statusSession: '  \u4F1A\u8BDD    "{name}" \xB7 \u65E5\u5FD7\u4E2D {count} \u6761\u6D88\u606F\uFF08\u6062\u590D\u4E86 {resumed} \u6761\uFF09',
      statusSessionEphemeral: "  \u4F1A\u8BDD    \uFF08\u4E34\u65F6 \u2014 \u65E0\u6301\u4E45\u5316\uFF09",
      statusWorkspace: "  \u5DE5\u4F5C\u533A  {path} \xB7 \u542F\u52A8\u65F6\u9501\u5B9A\uFF08\u7528 --dir <path> \u91CD\u65B0\u542F\u52A8\u4EE5\u5207\u6362\uFF09",
      statusMcp: "  MCP     {servers} \u4E2A\u670D\u52A1\u5668\uFF0C\u6CE8\u518C\u8868\u4E2D {tools} \u4E2A\u5DE5\u5177",
      statusEdits: "  \u7F16\u8F91    {count} \u4E2A\u5F85\u5904\u7406\uFF08/apply \u63D0\u4EA4\uFF0C/discard \u4E22\u5F03\uFF09",
      statusPlan: "  \u8BA1\u5212    \u5F00\u542F \u2014 \u5199\u5165\u53D7\u9650\uFF08submit_plan + \u5BA1\u6279\uFF09",
      statusModeYolo: "  \u6A21\u5F0F    YOLO \u2014 \u7F16\u8F91 + shell \u81EA\u52A8\u8FD0\u884C\uFF0C\u65E0\u63D0\u793A\uFF08/undo \u4ECD\u53EF\u56DE\u6EDA \xB7 Shift+Tab \u5207\u6362\uFF09",
      statusModeAuto: "  \u6A21\u5F0F    AUTO \u2014 \u7F16\u8F91\u7ACB\u5373\u5E94\u7528\uFF085 \u79D2\u5185\u6309 u \u64A4\u6D88 \xB7 Shift+Tab \u5207\u6362\uFF09",
      statusModeReview: "  \u6A21\u5F0F    review \u2014 \u7F16\u8F91\u6392\u961F\u7B49\u5F85 /apply \u6216 y\uFF08Shift+Tab \u5207\u6362\uFF09",
      statusDash: "  \u4EEA\u8868\u677F  {url}\uFF08\u5728\u6D4F\u89C8\u5668\u4E2D\u6253\u5F00 \xB7 /dashboard stop\uFF09"
    },
    plans: {
      noSession: "\u672A\u9644\u52A0\u4F1A\u8BDD \u2014 `/plans` \u662F\u6309\u4F1A\u8BDD\u7684\u3002\u5728\u9879\u76EE\u4E2D\u8FD0\u884C `reasonix code` \u4EE5\u83B7\u53D6\u4F1A\u8BDD\u3002",
      activePlan: "\u25B8 \u6D3B\u8DC3\u8BA1\u5212{label} \u2014 {done}/{total} \u6B65\u9AA4\u5DF2\u5B8C\u6210 \xB7 \u6700\u540E\u89E6\u53CA {when}",
      activeNone: "\u25B8 \u6D3B\u8DC3\u8BA1\u5212\uFF1A\uFF08\u65E0\uFF09",
      noArchives: "\u6B64\u4F1A\u8BDD\u5C1A\u65E0\u5F52\u6863\u8BA1\u5212 \u2014 \u5F53\u6BCF\u4E2A\u6B65\u9AA4\u5B8C\u6210\u65F6\u81EA\u52A8\u5F52\u6863",
      archivedHeader: "\u5DF2\u5F52\u6863\uFF08{count}\uFF09\uFF1A",
      replayNoSession: "\u672A\u9644\u52A0\u4F1A\u8BDD \u2014 `/replay` \u662F\u6309\u4F1A\u8BDD\u7684\u3002\u5728\u9879\u76EE\u4E2D\u8FD0\u884C `reasonix code` \u4EE5\u83B7\u53D6\u4F1A\u8BDD\u3002",
      replayNoArchives: "\u6B64\u4F1A\u8BDD\u5C1A\u65E0\u5F52\u6863\u8BA1\u5212 \u2014 `/replay` \u5728\u8BA1\u5212\u5B8C\u6210\u540E\u542F\u7528\uFF08\u6BCF\u4E2A\u6B65\u9AA4\u5B8C\u6210\u65F6\u81EA\u52A8\u5F52\u6863\uFF09\u3002",
      replayInvalidIndex: "\u65E0\u6548\u7D22\u5F15 \u2014 `/replay` \u63A5\u53D7 1..{max}\uFF08\u6700\u65B0 = 1\uFF09\u3002\u4F7F\u7528 `/plans` \u67E5\u770B\u5217\u8868\u3002",
      archivedRow: "  \u2713 {when}  {total}\u6B65 \xB7 {completion}  {label}",
      completionComplete: "\u5DF2\u5B8C\u6210",
      stopAborted: "\u25B8 \u8BA1\u5212\u5DF2\u505C\u6B62 \u2014 \u6A21\u578B\u5DF2\u4E2D\u6B62\uFF1B\u8F93\u5165\u540E\u7EED\u5185\u5BB9\u7EE7\u7EED\uFF0C\u6216\u5F00\u59CB\u65B0\u4EFB\u52A1\u3002",
      doneUsage: "\u7528\u6CD5\uFF1A/plans done <stepId>  \xB7  /plans done all \u2014 \u6A21\u578B\u5FD8\u8BB0\u8C03\u7528 mark_step_complete \u65F6\u7684\u624B\u52A8\u515C\u5E95",
      doneUnavailable: "/plans done \u4EC5\u5728\u6D3B\u8DC3\u4F1A\u8BDD\u5185\u53EF\u7528\u3002",
      doneNoPlan: "\u5F53\u524D\u65E0\u6D3B\u8DC3\u8BA1\u5212 \u2014 \u6CA1\u6709\u53EF\u6807\u8BB0\u7684\u5185\u5BB9\u3002",
      doneNotInPlan: "\u6B65\u9AA4 `{id}` \u4E0D\u5728\u5F53\u524D\u8BA1\u5212\u4E2D\u3002\u8FD0\u884C /plans \u67E5\u770B\u6B65\u9AA4 id\u3002",
      doneAlready: "\u6B65\u9AA4 `{id}` \u5DF2\u88AB\u6807\u8BB0\u4E3A\u5B8C\u6210\u3002",
      doneOk: "\u25B8 \u5DF2\u5C06\u6B65\u9AA4 `{id}` \u6807\u8BB0\u4E3A\u5B8C\u6210\u3002",
      doneAllNoop: "\u6240\u6709\u6B65\u9AA4\u5747\u5DF2\u5B8C\u6210\u3002",
      doneAllOk: "\u25B8 \u5DF2\u6807\u8BB0 {count} \u4E2A\u6B65\u9AA4\u4E3A\u5B8C\u6210\u3002"
    },
    jobs: {
      codeOnly: "/jobs \u4EC5\u5728 `reasonix code` \u4E2D\u53EF\u7528\u3002",
      killCodeOnly: "/kill \u4EC5\u5728 `reasonix code` \u4E2D\u53EF\u7528\u3002",
      logsCodeOnly: "/logs \u4EC5\u5728 `reasonix code` \u4E2D\u53EF\u7528\u3002",
      empty: "\u25C8 \u4F5C\u4E1A \xB7 0 \u8FD0\u884C\u4E2D \xB7 \u5171 0 \u4E2A\n  \uFF08run_background \u751F\u6210\u4E00\u4E2A \u2014 \u5F00\u53D1\u670D\u52A1\u5668\u3001\u76D1\u89C6\u5668\u3001\u957F\u65F6\u95F4\u8FD0\u884C\u7684\u811A\u672C\uFF09",
      header: "\u25C8 \u4F5C\u4E1A \xB7 {running} \u8FD0\u884C\u4E2D \xB7 \u5171 {total} \u4E2A",
      footer: "  /logs <id> \u8DDF\u8E2A \xB7 /kill <id> SIGTERM \u2192 SIGKILL",
      killUsage: "\u7528\u6CD5\uFF1A/kill <id>   \uFF08\u89C1 /jobs \u83B7\u53D6 ID\uFF09",
      killNotFound: "\u4F5C\u4E1A {id}\uFF1A\u672A\u627E\u5230",
      killAlreadyExited: "\u4F5C\u4E1A {id} \u5DF2\u9000\u51FA\uFF08{code}\uFF09",
      killStopping: "\u25B8 \u6B63\u5728\u505C\u6B62\u4F5C\u4E1A {id}\uFF08\u6811\u7EC8\u6B62\uFF1ASIGTERM \u2192 2 \u79D2\u5BBD\u9650\u671F\u540E SIGKILL\uFF1BWindows\uFF1Ataskkill /T /F\uFF09",
      killStatus: "\u25B8 \u4F5C\u4E1A {id} {status}",
      killStillAlive: "SIGKILL \u540E\u4ECD\u5B58\u6D3B (!) \u2014 \u8BF7\u5C06\u6B64\u4F5C\u4E3A bug \u62A5\u544A",
      logsUsage: "\u7528\u6CD5\uFF1A/logs <id> [lines]   \uFF08\u9ED8\u8BA4\u6700\u540E 80 \u884C\uFF09",
      logsNotFound: "\u4F5C\u4E1A {id}\uFF1A\u672A\u627E\u5230",
      logsStatus: "[\u4F5C\u4E1A {id} \xB7 {status}]\n$ {command}",
      logsRunning: "\u8FD0\u884C\u4E2D \xB7 pid {pid}",
      logsExited: "\u5DF2\u9000\u51FA {code}",
      logsFailed: "\u5931\u8D25\uFF08{reason}\uFF09",
      logsStopped: "\u5DF2\u505C\u6B62"
    },
    memory: {
      disabled: "\u8BB0\u5FC6\u5DF2\u7981\u7528\uFF08\u73AF\u5883\u53D8\u91CF REASONIX_MEMORY=off\uFF09\u3002\u53D6\u6D88\u8BBE\u7F6E\u8BE5\u53D8\u91CF\u4EE5\u91CD\u65B0\u542F\u7528 \u2014 \u6B64\u671F\u95F4\u4E0D\u4F1A\u56FA\u5B9A\u4EFB\u4F55 visionox.md \u6216 ~/.visionox/memory \u5185\u5BB9\u3002",
      noRoot: "\u6B64\u4F1A\u8BDD\u65E0\u5DE5\u4F5C\u76EE\u5F55 \u2014 `/memory` \u9700\u8981\u4E00\u4E2A\u6839\u76EE\u5F55\u6765\u89E3\u6790 visionox.md\u3002\uFF08\u5728\u6D4B\u8BD5\u73AF\u5883\u4E2D\u8FD0\u884C\uFF1F\uFF09",
      listEmpty: "\u5C1A\u65E0\u7528\u6237\u8BB0\u5FC6\u3002\u6A21\u578B\u53EF\u4EE5\u8C03\u7528 `remember` \u4FDD\u5B58\u4E00\u4E2A\uFF0C\u6216\u60A8\u53EF\u4EE5\u5728 ~/.visionox/memory/global/ \u6216\u9879\u76EE\u5B50\u76EE\u5F55\u4E2D\u624B\u52A8\u521B\u5EFA\u6587\u4EF6\u3002",
      listHeader: "\u7528\u6237\u8BB0\u5FC6\uFF08{count}\uFF09\uFF1A",
      listFooter: "\u67E5\u770B\u6B63\u6587\uFF1A/memory show <name>   \u5220\u9664\uFF1A/memory forget <name>",
      showUsage: "\u7528\u6CD5\uFF1A/memory show <name>  \u6216  /memory show <scope>/<name>",
      showNotFound: "\u672A\u627E\u5230\u8BB0\u5FC6\uFF1A{target}",
      showFailed: "\u663E\u793A\u5931\u8D25\uFF1A{reason}",
      forgetUsage: "\u7528\u6CD5\uFF1A/memory forget <name>  \u6216  /memory forget <scope>/<name>",
      forgetNotFound: "\u672A\u627E\u5230\u8BB0\u5FC6\uFF1A{target}",
      forgetInfo: "\u25B8 \u5DF2\u9057\u5FD8 {scope}/{name}\u3002\u4E0B\u6B21 /new \u6216\u542F\u52A8\u65F6\u5C06\u4E0D\u53EF\u89C1\u3002",
      forgetFailed: "\u65E0\u6CD5\u9057\u5FD8 {scope}/{name}\uFF08\u5DF2\u6D88\u5931\uFF1F\uFF09",
      forgetError: "\u9057\u5FD8\u5931\u8D25\uFF1A{reason}",
      clearUsage: "\u7528\u6CD5\uFF1A/memory clear <global|project> confirm",
      clearConfirm: "\u5373\u5C06\u5220\u9664 scope={scope} \u4E2D\u7684\u6BCF\u4E2A\u8BB0\u5FC6\u3002\u91CD\u65B0\u8FD0\u884C\u5E76\u9644\u5E26 'confirm' \u4E00\u8BCD\u4EE5\u7EE7\u7EED\uFF1A/memory clear {scope} confirm",
      cleared: "\u25B8 \u5DF2\u6E05\u9664 scope={scope} \u2014 \u5220\u9664\u4E86 {count} \u4E2A\u8BB0\u5FC6\u6587\u4EF6\u3002",
      noMemory: "\u5728 {root} \u4E2D\u672A\u56FA\u5B9A\u8BB0\u5FC6\u3002",
      layers: "\u53EF\u7528\u7684\u4E09\u4E2A\u5C42\u7EA7\uFF1A",
      layerProject: "  1. {file} \u2014 \u53EF\u63D0\u4EA4\u7684\u56E2\u961F\u8BB0\u5FC6\uFF08\u5728\u4ED3\u5E93\u4E2D\uFF09\u3002",
      layerGlobal: "  2. ~/.visionox/memory/global/ \u2014 \u60A8\u7684\u8DE8\u9879\u76EE\u79C1\u6709\u8BB0\u5FC6\u3002",
      layerProjectHash: "  3. ~/.visionox/memory/<project-hash>/ \u2014 \u6B64\u9879\u76EE\u7684\u79C1\u6709\u8BB0\u5FC6\u3002",
      askModel: "\u8BA9\u6A21\u578B `remember` \u67D0\u4E9B\u5185\u5BB9\uFF0C\u6216\u76F4\u63A5\u624B\u7F16\u8F91\u6587\u4EF6\u3002",
      changesNote: "\u66F4\u6539\u5728\u4E0B\u6B21 /new \u6216\u542F\u52A8\u65F6\u751F\u6548 \u2014 \u7CFB\u7EDF\u63D0\u793A\u8BCD\u6BCF\u4F1A\u8BDD\u54C8\u5E0C\u4E00\u6B21\u4EE5\u4FDD\u6301\u524D\u7F00\u7F13\u5B58\u70ED\u5EA6\u3002",
      subcommands: "\u5B50\u547D\u4EE4\uFF1A/memory list | /memory show <name> | /memory forget <name> | /memory clear <scope> confirm",
      changesNoteShort: "\u66F4\u6539\u5728\u4E0B\u6B21 /new \u6216\u542F\u52A8\u65F6\u751F\u6548\u3002\u5B50\u547D\u4EE4\uFF1A/memory list | show | forget | clear"
    },
    mcp: {
      noServers: '\u672A\u9644\u52A0 MCP \u670D\u52A1\u5668\u3002\u8FD0\u884C `reasonix setup` \u9009\u62E9\u4E00\u4E9B\uFF0C\u6216\u4F7F\u7528 --mcp "<spec>" \u542F\u52A8\u3002`reasonix mcp list` \u663E\u793A\u76EE\u5F55\u3002',
      toolsLabel: "  \u5DE5\u5177     {count}",
      resourcesHint: "`/resource` \u6D4F\u89C8+\u8BFB\u53D6",
      promptsHint: "`/prompt` \u6D4F\u89C8+\u83B7\u53D6",
      awarenessOnly: "\u804A\u5929\u6A21\u5F0F\u76EE\u524D\u6D88\u8017\u5DE5\u5177\uFF1B\u8D44\u6E90+\u63D0\u793A\u5728\u6B64\u5C55\u793A\u4F9B\u4E86\u89E3\u3002",
      catalogHint: "\u5B8C\u6574\u76EE\u5F55\uFF1A`reasonix mcp list` \xB7 \u6DF1\u5EA6\u8BCA\u65AD\uFF1A`reasonix mcp inspect <spec>`\u3002",
      fallbackServers: "MCP \u670D\u52A1\u5668\uFF08{count}\uFF09\uFF1A",
      fallbackTools: "\u6CE8\u518C\u8868\u4E2D\u7684\u5DE5\u5177\uFF08{count}\uFF09\uFF1A",
      fallbackChange: "\u8981\u66F4\u6539\u6B64\u8BBE\u7F6E\uFF0C\u8BF7\u9000\u51FA\u5E76\u8FD0\u884C `reasonix setup`\u3002",
      usageDisableEnable: "\u7528\u6CD5\uFF1A/mcp {action} <name>  \xB7  \u4ECE /mcp \u5217\u8868\u4E2D\u6311\u4E00\u4E2A\u540D\u5B57\uFF08\u533F\u540D\u670D\u52A1\u5668\u65E0\u6CD5\u6309\u540D\u5207\u6362\uFF09\u3002",
      usageReconnect: "\u7528\u6CD5\uFF1A/mcp reconnect <name>  \xB7  \u4ECE /mcp \u5217\u8868\u4E2D\u6311\u4E00\u4E2A\u540D\u5B57\u3002",
      unknownServer: '\u672A\u77E5 MCP \u670D\u52A1\u5668 "{name}"\u3002\u5DF2\u77E5\uFF1A{list}\u3002',
      noneList: "\uFF08\u65E0\uFF09",
      reconnectNoTui: "/mcp reconnect \u9700\u8981\u4EA4\u4E92\u5F0F TUI\uFF08postInfo \u672A\u8FDE\u63A5\uFF09\u3002",
      liveTab: "\u5DF2\u8FDE\u63A5",
      marketplaceTab: "\u5E02\u573A",
      tabHint: "\u6309 tab \u5207\u6362"
    },
    init: {
      codeOnly: "/init \u4EC5\u5728\u4EE3\u7801\u6A21\u5F0F\u4E0B\u5DE5\u4F5C\uFF08\u9700\u8981\u6587\u4EF6\u7CFB\u7EDF\u5DE5\u5177\uFF09\u3002\n\u8FD0\u884C `reasonix code [path]` \u542F\u52A8\u4E00\u4E2A\u4EE5\u60A8\u8981\u521D\u59CB\u5316\u7684\u9879\u76EE\u4E3A\u6839\u7684\u4F1A\u8BDD\uFF0C\n\u7136\u540E\u8FD0\u884C /init\u3002",
      exists: "\u25B8 visionox.md \u5DF2\u5B58\u5728\u4E8E {path}",
      existsForce: "  /init force   \u4ECE\u5934\u91CD\u65B0\u751F\u6210\uFF08\u8986\u76D6\uFF09",
      existsEdit: "  \u6216\u624B\u52A8\u7F16\u8F91 \u2014 \u5B83\u53EA\u662F markdown\u3002\u5F53\u524D\u6587\u4EF6\u5DF2",
      existsPinned: "  \u56FA\u5B9A\u5230\u6BCF\u6B21\u542F\u52A8\u7684\u7CFB\u7EDF\u63D0\u793A\u8BCD\u4E2D\u3002",
      info: "\u25B8 /init \u2014 \u6A21\u578B\u5C06\u626B\u63CF\u9879\u76EE\u5E76\u5408\u6210 visionox.md\u3002\n  \u7ED3\u679C\u5C06\u4F5C\u4E3A\u5F85\u5904\u7406\u7684\u7F16\u8F91\uFF1B\u4F7F\u7528 /apply \u6216 /walk \u5BA1\u67E5\u3002"
    },
    webSearchEngine: {
      currentEngine: "\u5F53\u524D\u7F51\u9875\u641C\u7D22\u5F15\u64CE\uFF1A{engine}",
      endpoint: "SearXNG \u7AEF\u70B9\uFF1A{url}",
      usageHeader: "\u7528\u6CD5\uFF1A",
      usageMojeek: "  /search-engine mojeek            \u4F7F\u7528 Mojeek\uFF08\u9ED8\u8BA4\uFF0C\u65E0\u5916\u90E8\u4F9D\u8D56\uFF09",
      usageSearxng: "  /search-engine searxng            \u4F7F\u7528 SearXNG \u9ED8\u8BA4\u7AEF\u70B9",
      usageSearxngUrl: "  /search-engine searxng <url>      \u4F7F\u7528 SearXNG \u81EA\u5B9A\u4E49\u7AEF\u70B9",
      alias: "\u522B\u540D\uFF1A/se",
      searxngInfo: "SearXNG \u662F\u4E00\u4E2A\u81EA\u6258\u7BA1\u7684\u5143\u641C\u7D22\u5F15\u64CE\uFF08https://github.com/searxng/searxng\uFF09\u3002",
      searxngInstall: "\u5B89\u88C5\u547D\u4EE4\uFF1A  docker run -d -p 8080:8080 searxng/searxng",
      switched: '\u5DF2\u5207\u6362\u7F51\u9875\u641C\u7D22\u5F15\u64CE\u4E3A "{engine}"\u3002{note}',
      switchedSearxngNote: " \u8BF7\u786E\u4FDD SearXNG \u5728 {endpoint} \u8FD0\u884C\u3002",
      confirmed: '\u2713 \u7F51\u9875\u641C\u7D22\u5F15\u64CE\u5DF2\u8BBE\u4E3A "{engine}"{detail}\u3002\u4E0B\u4E00\u8F6E\u6A21\u578B\u8C03\u7528\u5C06\u751F\u6548\u3002',
      confirmedDetail: "\uFF08{endpoint}\uFF09"
    },
    skill: {
      listEmpty: "\u672A\u627E\u5230\u6280\u80FD\u3002Reasonix \u4ECE\u4EE5\u4E0B\u4F4D\u7F6E\u8BFB\u53D6\u6280\u80FD\uFF1A",
      listProjectScope: "  \xB7 <project>/.visionox/skills/<name>/SKILL.md  \uFF08\u6216 <name>.md\uFF09 \u2014 \u9879\u76EE\u8303\u56F4",
      listGlobalScope: "  \xB7 ~/.visionox/skills/<name>/SKILL.md  \uFF08\u6216 <name>.md\uFF09 \u2014 \u5168\u5C40\u8303\u56F4",
      listProjectOnly: "  \uFF08\u9879\u76EE\u8303\u56F4\u4EC5\u5728 `reasonix code` \u4E2D\u6D3B\u8DC3\uFF09",
      listFrontmatter: "\u6BCF\u4E2A\u6587\u4EF6\u7684 frontmatter \u81F3\u5C11\u9700\u8981 `name` \u548C `description`\u3002",
      listInvoke: "\u4F7F\u7528 `/skill <name> [args]` \u8C03\u7528\u6280\u80FD\uFF0C\u6216\u8BA9\u6A21\u578B\u8C03\u7528 `run_skill`\u3002",
      listHeader: "\u7528\u6237\u6280\u80FD\uFF08{count}\uFF09\uFF1A",
      listFooter: "\u67E5\u770B\uFF1A/skill show <name>   \u8FD0\u884C\uFF1A/skill <name> [args]   \u65B0\u5EFA\uFF1A/skill new <name>",
      listEmptyNewHint: "\u7528 `/skill new <name>` \u5728\u9879\u76EE\u8303\u56F4\u4E0B\u751F\u6210\u4E00\u4E2A\u7A7A\u767D\u6A21\u677F \u2014 \u6682\u65E0\u5728\u7EBF\u5E02\u573A\uFF0C\u6280\u80FD\u9700\u8981\u81EA\u5DF1\u5199\u3002",
      showUsage: "\u7528\u6CD5\uFF1A/skill show <name>",
      showNotFound: "\u672A\u627E\u5230\u6280\u80FD\uFF1A{name}",
      runNotFound: "\u672A\u627E\u5230\u6280\u80FD\uFF1A{name}  \uFF08\u5C1D\u8BD5 /skill list\uFF09",
      runInfo: "\u25B8 \u6B63\u5728\u8FD0\u884C\u6280\u80FD\uFF1A{name}{args}",
      newUsage: "\u7528\u6CD5\uFF1A/skill new <name> [--global]",
      newCreated: "\u25B8 \u5DF2\u521B\u5EFA\u6280\u80FD\uFF1A{name}\n  {path}\n  \u7F16\u8F91\u540E\u7528 `/skill {name}` \u8C03\u7528",
      newError: "\u25B2 /skill new \u5931\u8D25\uFF1A{reason}"
    }
  },
  statusBar: {
    turn: "\u8F6E",
    cache: "\u7F13\u5B58",
    spent: "\u5DF2\u82B1\u8D39",
    left: " \u5269\u4F59",
    slow: "\u6162\u901F",
    disconnect: "\u65AD\u5F00",
    reconnecting: "\u91CD\u8FDE\u4E2D\u2026",
    approvingIn: "\u5373\u5C06\u6279\u51C6\uFF0C",
    escToInterrupt: "\u79D2 \xB7 Esc \u4E2D\u65AD",
    recordingGlyph: "\u25CFREC",
    mb: " MB",
    evt: " \u4E8B\u4EF6",
    editsLabel: "\u7F16\u8F91:",
    mcpLoading: "MCP"
  },
  editMode: {
    plan: "\u8BA1\u5212",
    yolo: "\u81EA\u7531",
    auto: "\u81EA\u52A8",
    review: "\u5BA1\u67E5",
    writesGated: "   \u5DF2\u9650\u5236\u5199\u5165 \xB7 /plan off \u89E3\u9664",
    editsShellAuto: "\u7F16\u8F91 + Shell \u81EA\u52A8 \xB7 /undo \u53EF\u56DE\u6EDA",
    editsLandNow: "\u7F16\u8F91\u5DF2\u751F\u6548 \xB7 \u6309 u \u64A4\u6D88",
    queuedApplyDiscard: "{count} \u4E2A\u5F85\u5904\u7406 \xB7 y \u5E94\u7528 \xB7 n \u4E22\u5F03",
    editsQueued: "\u7F16\u8F91\u5DF2\u6392\u961F \xB7 y \u5E94\u7528 \xB7 n \u4E22\u5F03",
    shiftTabFlip: "   {mid} \xB7 Shift+Tab \u5207\u6362",
    queuedDots: "\u6392\u961F\u4E2D\u2026"
  },
  composer: {
    placeholder: "\u8F93\u5165\u4EFB\u4F55\u5185\u5BB9  \xB7  / \u4F7F\u7528\u547D\u4EE4  \xB7  @ \u5F15\u7528\u6587\u4EF6",
    waitingForResponse: "\u2026\u7B49\u5F85\u54CD\u5E94\u2026",
    hintSend: "\u53D1\u9001",
    hintNewline: "\u6362\u884C",
    hintClear: "\u6E05\u7A7A",
    hintScroll: "\u6EDA\u52A8",
    hintHistory: "\u5386\u53F2",
    hintAbort: "\u4E2D\u6B62",
    hintQuit: "\u9000\u51FA",
    abortedHint: "\u7528\u6237\u5DF2\u4E2D\u6B62\u672C\u8F6E \xB7 \u518D\u6309 Esc \u6E05\u9664 \xB7 \u23CE \u7EE7\u7EED\u63D0\u95EE",
    editorNoRawMode: "\u5916\u90E8\u7F16\u8F91\u5668\u4E0D\u53EF\u7528 \u2014 \u5F53\u524D\u7EC8\u7AEF\u4E0D\u652F\u6301 raw-mode \u5207\u6362",
    editorFailed: "\u5916\u90E8\u7F16\u8F91\u5668\uFF1A",
    editorMissing: "\u672A\u8BBE\u7F6E $EDITOR / $VISUAL / $GIT_EDITOR \u2014 \u8BF7\u5BFC\u51FA\u73AF\u5883\u53D8\u91CF\uFF08\u4F8B\u5982 `export EDITOR=nano`\uFF09\u540E\u91CD\u8BD5",
    editorExited: "\u7F16\u8F91\u5668\u5F02\u5E38\u9000\u51FA\uFF0C\u8FD4\u56DE\u7801 {code}"
  },
  pathConfirm: {
    title: "\u6C99\u7BB1\u5916\u8DEF\u5F84",
    subtitleRead: "{tool} \u60F3\u8981\u8BFB\u53D6\u6C99\u7BB1\u5916\u7684\u6587\u4EF6",
    subtitleWrite: "{tool} \u60F3\u8981\u5199\u5165\u6C99\u7BB1\u5916\u7684\u6587\u4EF6",
    awaiting: "\u7B49\u5F85\u4E2D",
    denyTitle: "\u62D2\u7EDD \u2014 \u63D0\u4F9B\u539F\u56E0",
    optional: "\u53EF\u9009",
    denyFooter: "\u8F93\u5165\u539F\u56E0 \xB7 \u23CE \u63D0\u4EA4 \xB7 Esc \u8DF3\u8FC7\uFF08\u76F4\u63A5\u62D2\u7EDD\uFF09",
    pickFooter: "\u2191\u2193 \u9009\u62E9 \xB7 \u23CE \u786E\u8BA4 \xB7 Tab \u6DFB\u52A0\u8BF4\u660E \xB7 Esc \u53D6\u6D88",
    allowOnce: "\u5141\u8BB8\u4E00\u6B21",
    allowOnceDesc: "\u672C\u6B21\u5141\u8BB8\uFF0C\u672C\u4F1A\u8BDD\u5185\u6B64\u76EE\u5F55\u4E0D\u518D\u8BE2\u95EE",
    allowAlways: "\u59CB\u7EC8\u5141\u8BB8",
    allowAlwaysDesc: "\u8BB0\u4F4F `{prefix}`\uFF0C\u672C\u9879\u76EE\u6C38\u4E45\u5141\u8BB8\uFF08\u5199\u5165 ~/.visionox/config.json\uFF09",
    deny: "\u62D2\u7EDD",
    denyDesc: "\u6309 Tab \u6DFB\u52A0\u8BF4\u660E\uFF0C\u544A\u8BC9\u6A21\u578B\u539F\u56E0",
    pathLabel: "\u8DEF\u5F84",
    sandboxLabel: "\u6C99\u7BB1",
    allowPrefixLabel: "\u524D\u7F00"
  },
  shellConfirm: {
    title: "Shell \u547D\u4EE4",
    bgTitle: "\u540E\u53F0\u8FDB\u7A0B",
    subtitle: "\u6A21\u578B\u8BF7\u6C42\u6267\u884C Shell \u547D\u4EE4",
    bgSubtitle: "\u957F\u65F6\u95F4\u8FD0\u884C \u2014 \u6279\u51C6\u540E\u6301\u7EED\u8FD0\u884C\uFF0C/kill \u53EF\u505C\u6B62",
    denyTitle: "\u62D2\u7EDD \u2014 \u63D0\u4F9B\u539F\u56E0",
    optional: "\u53EF\u9009",
    denyFooter: "\u8F93\u5165\u539F\u56E0 \xB7 \u23CE \u63D0\u4EA4 \xB7 Esc \u8DF3\u8FC7\uFF08\u76F4\u63A5\u62D2\u7EDD\uFF09",
    awaiting: "\u7B49\u5F85\u4E2D",
    pickFooter: "\u2191\u2193 \u9009\u62E9 \xB7 \u23CE \u786E\u8BA4 \xB7 Tab \u6DFB\u52A0\u8BF4\u660E \xB7 Esc \u53D6\u6D88",
    allowOnce: "\u5141\u8BB8\u4E00\u6B21",
    allowOnceDesc: "\u6267\u884C\u6B64\u547D\u4EE4\uFF0C\u4E0B\u6B21\u518D\u95EE",
    allowAlways: "\u59CB\u7EC8\u5141\u8BB8",
    allowAlwaysDesc: "\u8BB0\u4F4F `{prefix}`\uFF0C\u672C\u9879\u76EE\u5185\u4E0D\u518D\u8BE2\u95EE",
    deny: "\u62D2\u7EDD",
    denyDesc: "\u6309 Tab \u6DFB\u52A0\u8BF4\u660E\uFF0C\u544A\u8BC9\u6A21\u578B\u539F\u56E0",
    cwdLabel: "\u5DE5\u4F5C\u76EE\u5F55",
    timeoutLabel: "\u8D85\u65F6",
    waitLabel: "\u7B49\u5F85",
    previewMore: "\u2026 \u8FD8\u6709 {n} \u884C\u672A\u663E\u793A \u2014 \u6309 esc \u53D6\u6D88\uFF0C\u8BA9\u6A21\u578B\u62C6\u5206\u540E\u518D\u8BD5",
    previewMorePlural: "\u2026 \u8FD8\u6709 {n} \u884C\u672A\u663E\u793A \u2014 \u6309 esc \u53D6\u6D88\uFF0C\u8BA9\u6A21\u578B\u62C6\u5206\u540E\u518D\u8BD5"
  },
  editConfirm: {
    footer: "[y/Enter] \u5E94\u7528 \xB7 [n] \u62D2\u7EDD\u5E76\u8BF4\u660E \xB7 [a] \u5E94\u7528\u5269\u4F59 \xB7 [A] \u5207\u6362 AUTO \xB7 [\u2191\u2193/Space] \u6EDA\u52A8 \xB7 [Esc] \u4E2D\u6B62",
    newTag: "\u65B0\u589E",
    editTag: "\u7F16\u8F91",
    linesCount: "-{removed} +{added} \u884C",
    viewingRange: "\u6B63\u5728\u67E5\u770B {start}-{end}/{total}",
    denyFooter: "\u23CE \u63D0\u4EA4 \xB7 Esc \u8DF3\u8FC7\uFF08\u76F4\u63A5\u62D2\u7EDD\uFF09",
    oldLabel: "  \u65E7\u5185\u5BB9",
    newLabel: "  \u65B0\u5185\u5BB9",
    sideBySide: "  \u5DE6\u53F3\u5BF9\u6BD4 \xB7 \u5DE6\u4FA7\u5220\u9664\uFF0C\u53F3\u4FA7\u65B0\u589E \xB7 \u6309\u504F\u79FB\u914D\u5BF9",
    linesAbove: "  \u2191 \u4E0A\u65B9 {count} \u884C\uFF08\u2191/k \u6216 PgUp\uFF09",
    linesAbovePlural: "  \u2191 \u4E0A\u65B9 {count} \u884C\uFF08\u2191/k \u6216 PgUp\uFF09",
    linesBelow: "  \u2193 \u4E0B\u65B9 {count} \u884C\uFF08\u2193/j \u6216 Space/PgDn\uFF09",
    linesBelowPlural: "  \u2193 \u4E0B\u65B9 {count} \u884C\uFF08\u2193/j \u6216 Space/PgDn\uFF09"
  },
  sessionPicker: {
    header: " \u25C8 REASONIX \xB7 \u9009\u62E9\u4F1A\u8BDD ",
    title: "\u9009\u62E9\u4F1A\u8BDD \u2014 {workspace}",
    messages: "{count} \u6761\u6D88\u606F",
    messagesPlural: "{count} \u6761\u6D88\u606F",
    turns: "{count} \u8F6E",
    pickerHint: "\u2191\u2193 \u9009\u62E9 \xB7 \u23CE \u6253\u5F00 \xB7 [n] \u65B0\u5EFA \xB7 [d] \u5220\u9664 \xB7 [r] \u91CD\u547D\u540D \xB7 Esc \u9000\u51FA",
    empty: "  \u6B64\u5DE5\u4F5C\u533A\u6682\u65E0\u5DF2\u4FDD\u5B58\u7684\u4F1A\u8BDD \u2014 \u6309 ",
    emptyNew: " \u5F00\u59CB\u65B0\u4F1A\u8BDD",
    renamePrompt: '  \u91CD\u547D\u540D "{from}" \u2192 ',
    renameHint: "  \u23CE \u786E\u8BA4\u91CD\u547D\u540D \xB7 Esc \u53D6\u6D88",
    emptyHint: "  \u23CE \u65B0\u5EFA\u4F1A\u8BDD \xB7 Esc \u9000\u51FA",
    justNow: "\u521A\u521A",
    minAgo: "{count} \u5206\u949F\u524D",
    yesterday: "\u6628\u5929",
    hoursAgo: "{count} \u5C0F\u65F6\u524D",
    daysAgo: "{count} \u5929\u524D"
  },
  modelPicker: {
    header: " \u25C8 REASONIX \xB7 \u9009\u62E9\u914D\u7F6E ",
    loading: "  \xB7  \u52A0\u8F7D\u76EE\u5F55\u2026",
    catalogEmpty: "  \xB7  \u76EE\u5F55\u4E3A\u7A7A \u2014 \u4F7F\u7528\u5DF2\u77E5\u5907\u9009",
    modelsAvailable: "  \xB7  {count} \u4E2A\u6A21\u578B\u53EF\u7528",
    presetsHeader: "    \u9884\u8BBE  \xB7  \u63A8\u8350 \u2014 \u6A21\u578B + \u5F3A\u5EA6 + \u81EA\u52A8\u5347\u7EA7",
    modelsHeader: "    \u6A21\u578B  \xB7  \u76F4\u63A5\u9009\u62E9 \u2014 \u81EA\u52A8\u5347\u7EA7\u4FDD\u6301\u4E0D\u53D8",
    pickerFooter: "  \u2191\u2193 \u9009\u62E9 \xB7 \u23CE \u786E\u8BA4 \xB7 [r] \u5237\u65B0 \xB7 Esc \u53D6\u6D88",
    currentLabel: "  \xB7 \u5F53\u524D"
  },
  slashSuggestions: {
    noMatch: "\u6CA1\u6709\u5339\u914D\u6B64\u524D\u7F00\u7684\u659C\u6760\u547D\u4EE4",
    backspaceHint: " \u2014 \u6309 Backspace \u4FEE\u6539\uFF0C\u6216 /help \u67E5\u770B\u5B8C\u6574\u5217\u8868",
    commandCount: "{count} \u4E2A\u547D\u4EE4",
    commandCountPlural: "{count} \u4E2A\u547D\u4EE4",
    aboveLabel: "   \u2191 {count} \u4E2A\u4EE5\u4E0A",
    belowLabel: "   \u2193 {count} \u4E2A\u4EE5\u4E0B",
    advancedHint: "  + {count} \u4E2A\u9AD8\u7EA7\u547D\u4EE4 \xB7  \u8F93\u5165\u5B57\u6BCD\u641C\u7D22",
    footerHint: "  \u2191\u2193 \u5BFC\u822A \xB7 Tab / \u23CE \u9009\u62E9 \xB7 Esc \u53D6\u6D88",
    groupChat: "\u804A\u5929",
    groupSetup: "\u8BBE\u7F6E",
    groupInfo: "\u4FE1\u606F",
    groupSession: "\u4F1A\u8BDD",
    groupExtend: "\u6269\u5C55",
    groupCode: "\u4EE3\u7801",
    groupJobs: "\u4EFB\u52A1",
    groupAdvanced: "\u9AD8\u7EA7",
    groupDetailSetup: "\u6A21\u578B + \u6210\u672C",
    groupDetailInfo: "\u5F53\u524D\u72B6\u6001",
    groupDetailChat: "\u65E5\u5E38\u804A\u5929\u64CD\u4F5C",
    groupDetailExtend: "MCP, \u8BB0\u5FC6, \u6280\u80FD",
    groupDetailSession: "\u5DF2\u4FDD\u5B58\u7684\u4F1A\u8BDD",
    groupDetailCode: "\u7F16\u8F91 + \u8BA1\u5212 (\u4EE3\u7801\u6A21\u5F0F)",
    groupDetailJobs: "\u540E\u53F0\u8FDB\u7A0B (\u4EE3\u7801\u6A21\u5F0F)",
    groupDetailAdvanced: "\u9AD8\u7EA7\u6216\u4E00\u6B21\u6027\u8BBE\u7F6E"
  },
  atMentions: {
    loading: "\u52A0\u8F7D\u4E2D\u2026",
    entrySingular: "{count} \u6761",
    entryPlural: "{count} \u6761",
    searching: "\u641C\u7D22\u4E2D\u2026",
    scanned: "\u5DF2\u626B\u63CF",
    match: "\u4E2A\u5339\u914D",
    matches: "\u4E2A\u5339\u914D",
    forFilter: '\u5339\u914D "{filter}"',
    noMatch: '\u6CA1\u6709\u5339\u914D "{filter}" \u7684\u6587\u4EF6',
    emptyDir: "\u7A7A\u76EE\u5F55",
    scanning: "\u6B63\u5728\u626B\u63CF\u76EE\u5F55\u6811\u2026",
    footerBrowse: "\u2191\u2193 \u5BFC\u822A \xB7 Tab \u8FDB\u5165\u6587\u4EF6\u5939 \xB7 \u23CE \u63D2\u5165 \xB7 Esc \u53D6\u6D88",
    footerBrowseSearch: "\u2191\u2193 \u5BFC\u822A \xB7 Tab / \u23CE \u4EE5 @path \u63D2\u5165 \xB7 Esc \u53D6\u6D88",
    footerInsert: "\u2191\u2193 \u5BFC\u822A \xB7 Tab / \u23CE \u4EE5 @path \u63D2\u5165 \xB7 Esc \u53D6\u6D88"
  },
  statsPanel: {
    modePlan: "\u8BA1\u5212",
    modeYolo: "\u81EA\u7531",
    modeAuto: "\u81EA\u52A8",
    modeReview: "\u5BA1\u67E5",
    pro: "\u21E7 \u4E13\u4E1A",
    budget: "  \u9884\u7B97  "
  },
  welcomeBanner: {
    workspace: "\u25B8 \u5DE5\u4F5C\u533A",
    relaunchHint: "\uFF08\u91CD\u542F\u65F6\u7528 --dir <path> \u5207\u6362\uFF09",
    dashboard: "\u25B8 \u7F51\u9875"
  },
  ctxBreakdown: {
    title: "\u25A3 \u4E0A\u4E0B\u6587",
    compactHint: "  /compact \u6298\u53E0\uFF08\u8D85\u8FC7 50% \u81EA\u52A8\u89E6\u53D1\uFF09\xB7 /new \u6E05\u7A7A\u65E5\u5FD7",
    topTools: "  \u5E38\u7528\u5DE5\u5177\uFF08\u6309\u6210\u672C\u6392\u5E8F\uFF0C{count} \u4E2A\uFF09\uFF1A",
    msg: "\u6761",
    turnLabel: "\u8F6E"
  },
  startup: {
    codeRooted: '\u25B8 reasonix code\uFF1A\u6839\u76EE\u5F55 {rootDir}\uFF0C\u4F1A\u8BDD "{session}" \xB7 {tools} \u4E2A\u539F\u751F\u5DE5\u5177{semantic}',
    ephemeral: "\uFF08\u4E34\u65F6\uFF09",
    semanticOn: " \xB7 \u8BED\u4E49\u641C\u7D22\u5DF2\u5F00\u542F"
  },
  doctorErrors: {
    unreadable: "{path} \u65E0\u6CD5\u8BFB\u53D6 \u2014 {message}",
    cannotList: "\u65E0\u6CD5\u5217\u51FA \u2014 {message}",
    parseFailed: "\u65E0\u6CD5\u89E3\u6790 settings.json \u2014 {message}",
    probeFailed: "\u63A2\u6D4B\u5931\u8D25 \u2014 {message}"
  },
  webErrors: {
    status: "web_search {status} \u2014 try: \u641C\u7D22\u540E\u7AEF\u8FD4\u56DE\u9519\u8BEF\uFF1B\u8BF7\u6539\u5199\u67E5\u8BE2\uFF0C\u6216\u4F7F\u7528 /search-engine mojeek|searxng \u5207\u6362\u5F15\u64CE",
    rateLimit429: "web_search 429 \u2014 try: \u7B49\u5F85 10 \u79D2\u540E\u91CD\u8BD5\uFF0C\u6216\u6539\u5199\u67E5\u8BE2\uFF1B\u641C\u7D22\u540E\u7AEF\u6B63\u5728\u5BF9\u8BE5\u5BA2\u6237\u7AEF\u8FDB\u884C\u9650\u6D41",
    forbidden403: "web_search 403 \u2014 try: \u641C\u7D22\u540E\u7AEF\u62D2\u7EDD\u8BE5\u5BA2\u6237\u7AEF\u8BBF\u95EE\uFF1B\u4F7F\u7528 /search-engine mojeek|searxng \u5207\u6362\u5F15\u64CE\uFF0C\u6216\u7A0D\u540E\u91CD\u8BD5",
    serverError5xx: "web_search {status} \u2014 try: \u5728\u6D4F\u89C8\u5668\u4E2D\u6253\u5F00\u641C\u7D22 URL\uFF1B\u82E5\u80FD\u52A0\u8F7D\u5219\u5C5E\u4E34\u65F6\u6545\u969C\uFF0C\u7B49 30 \u79D2\u91CD\u8BD5\u5373\u53EF",
    mojeekBlocked: "web_search: Mojeek \u53CD\u722C\u9875\u9762 \u2014 \u9891\u7387\u9650\u5236\u6216\u88AB\u5C4F\u853D \u2014 try: \u7B49\u5F85 30 \u79D2\u540E\u91CD\u8BD5\uFF0C\u6216\u4F7F\u7528 /search-engine searxng \u5207\u6362\u5F15\u64CE",
    mojeekNoResults: "web_search: \u8FD4\u56DE 0 \u6761\u7ED3\u679C\u4F46\u54CD\u5E94\u770B\u8D77\u6765\u4E0D\u662F\u6B63\u5E38\u7A7A\u7ED3\u679C\u9875\uFF08{chars} \u5B57\u7B26\uFF0C\u524D 120 \u5B57\u7B26\uFF1A{preview}\uFF09\u2014 try: \u4F7F\u7528\u66F4\u7B80\u5355\u7684\u5173\u952E\u8BCD\u6539\u5199\u67E5\u8BE2\uFF0C\u6216\u4F7F\u7528 /search-engine searxng \u5207\u6362\u5F15\u64CE",
    invalidEndpoint: 'web_search: \u65E0\u6548\u7684 SearXNG \u7AEF\u70B9 "{endpoint}" \u2014 try: \u4F7F\u7528 /search-endpoint http://host:port \u8BBE\u7F6E\u6709\u6548\u7684 URL',
    endpointMustBeHttp: "web_search: SearXNG \u7AEF\u70B9\u5FC5\u987B\u662F http(s) \u534F\u8BAE\uFF0C\u5F53\u524D\u4E3A {protocol} \u2014 try: \u4F7F\u7528 /search-endpoint http://host:port \u8BBE\u7F6E\u6709\u6548\u7684 URL",
    cannotReach: "web_search: \u65E0\u6CD5\u8BBF\u95EE SearXNG \u670D\u52A1\u5668 {endpoint} \u2014 try: \u5B89\u88C5\u5E76\u542F\u52A8 SearXNG\uFF08https://github.com/searxng/searxng\uFF0C\u4F8B\u5982 `docker run -d -p 8080:8080 searxng/searxng`\uFF09\uFF0C\u6216\u4F7F\u7528 /search-engine mojeek \u5207\u6362\u5230\u9ED8\u8BA4\u5F15\u64CE",
    searxngNoResults: "web_search: \u8FD4\u56DE 0 \u6761\u7ED3\u679C\u4F46 SearXNG \u54CD\u5E94\u770B\u8D77\u6765\u4E0D\u662F\u6B63\u5E38\u7A7A\u7ED3\u679C\u9875\uFF08{chars} \u5B57\u7B26\uFF09\u2014 try: \u4F7F\u7528\u66F4\u7B80\u5355\u7684\u5173\u952E\u8BCD\u6539\u5199\u67E5\u8BE2\uFF0C\u6216\u4F7F\u7528 /search-engine mojeek \u5207\u6362\u5F15\u64CE",
    fetchStatus: "web_fetch {status} for {url} \u2014 try: \u5728\u6D4F\u89C8\u5668\u4E2D\u786E\u8BA4\u8BE5 URL \u80FD\u5426\u8BBF\u95EE\uFF1B\u8BE5\u72B6\u6001\u7801\u8868\u660E\u76EE\u6807\u4E3B\u673A\u8FD4\u56DE\u4E86\u9519\u8BEF\u9875\u9762",
    fetchRateLimit429: "web_fetch 429 for {url} \u2014 try: \u7B49\u5F85 10 \u79D2\u540E\u91CD\u8BD5\uFF1B\u76EE\u6807\u4E3B\u673A\u6B63\u5728\u5BF9\u8BE5\u5BA2\u6237\u7AEF\u8FDB\u884C\u9650\u6D41",
    fetchForbidden403: "web_fetch 403 for {url} \u2014 try: \u76EE\u6807\u4E3B\u673A\u62D2\u7EDD\u8BE5\u5BA2\u6237\u7AEF\u8BBF\u95EE\uFF1B\u8BE5\u9875\u9762\u53EF\u80FD\u9700\u8981\u767B\u5F55\u6216\u5C4F\u853D\u722C\u866B \u2014 \u6539\u7528 web_search \u6458\u8981",
    fetchServerError5xx: "web_fetch {status} for {url} \u2014 try: \u5728\u6D4F\u89C8\u5668\u4E2D\u6253\u5F00\u8BE5 URL\uFF1B\u82E5\u80FD\u52A0\u8F7D\u5219\u5C5E\u4E34\u65F6\u6545\u969C\uFF0C\u7B49 30 \u79D2\u91CD\u8BD5\u5373\u53EF",
    fetchTimeout: "web_fetch: timed out after {ms}ms for {url} \u2014 try: \u66F4\u77ED\u7684 URL \u6216\u66F4\u5C0F\u7684\u5185\u5BB9\uFF1B\u53EF\u80FD\u662F CDN \u8F83\u6162\uFF0C\u6216\u91CD\u8BD5\u4E00\u6B21",
    fetchTooLarge: "web_fetch \u62D2\u7EDD\uFF1Acontent-length {len} \u5B57\u8282\u8D85\u8FC7\u4E0A\u9650 {cap} \u5B57\u8282\uFF08{url}\uFF09\u2014 try: \u6539\u6362\u5176\u4ED6 URL \u83B7\u53D6\u8F83\u5C0F\u7684\u5185\u5BB9\uFF1B\u8BE5\u9875\u9762\u8FC7\u5927\u65E0\u6CD5\u83B7\u53D6",
    fetchBodyTooLarge: "web_fetch \u62D2\u7EDD\uFF1A\u54CD\u5E94\u4F53\u8D85\u8FC7 {cap} \u5B57\u8282\u4E0A\u9650\uFF08\u5DF2\u63A5\u6536 {seen} \u5B57\u8282\uFF09\u2014 try: \u6539\u6362\u5176\u4ED6 URL \u83B7\u53D6\u8F83\u5C0F\u7684\u5185\u5BB9\uFF1B\u8BE5\u9875\u9762\u6D41\u5F0F\u4F20\u8F93\u8D85\u51FA\u5927\u5C0F\u4E0A\u9650",
    fetchInvalidUrl: "web_fetch: URL \u5FC5\u987B\u4EE5 http:// \u6216 https:// \u5F00\u5934 \u2014 try: \u4F20\u5165\u7EDD\u5BF9\u7684 http(s) URL\uFF08\u8BE5 URL \u683C\u5F0F\u9519\u8BEF\u6216\u4F7F\u7528\u4E86\u4E0D\u652F\u6301\u7684\u534F\u8BAE\uFF09"
  },
  choiceConfirm: {
    customLabel: "\u81EA\u5B9A\u4E49\u56DE\u7B54",
    customDesc: "\u4EE5\u4E0A\u9009\u9879\u90FD\u4E0D\u5408\u9002 \u2014 \u8F93\u5165\u81EA\u7531\u683C\u5F0F\u56DE\u590D\uFF0C\u6A21\u578B\u4F1A\u539F\u6837\u8BFB\u53D6",
    cancelLabel: "\u53D6\u6D88 \u2014 \u653E\u5F03\u95EE\u9898",
    cancelDesc: "\u6A21\u578B\u505C\u6B62\u5E76\u8BE2\u95EE\u4F60\u771F\u6B63\u7684\u9700\u6C42"
  },
  cardTitles: {
    usage: "\u7528\u91CF",
    context: "\u4E0A\u4E0B\u6587",
    search: "\u641C\u7D22",
    subagent: "\u5B50\u4EE3\u7406",
    reply: "\u56DE\u590D",
    reasoning: "\u63A8\u7406\u4E2D",
    reasoningAborted: "\u63A8\u7406\uFF08\u5DF2\u4E2D\u6B62\uFF09",
    reasoningEllipsis: "\u63A8\u7406\u4E2D\u2026",
    error: "\u9519\u8BEF",
    doctor: "\u73AF\u5883\u8BCA\u65AD",
    you: "\u4F60",
    task: "\u4EFB\u52A1"
  },
  cardLabels: {
    prompt: "\u63D0\u793A",
    reason: "\u63A8\u7406",
    output: "\u8F93\u51FA",
    cache: "\u7F13\u5B58",
    session: "\u4F1A\u8BDD",
    balance: "\u4F59\u989D",
    turn: "\u8F6E",
    system: "\u7CFB\u7EDF",
    tools: "\u5DE5\u5177",
    log: "\u65E5\u5FD7",
    input: "\u8F93\u5165",
    topTools: "\u5E38\u7528\u5DE5\u5177",
    logMsgs: "\u65E5\u5FD7\u6D88\u606F",
    hitSingular: "{count} \u6761\u7ED3\u679C \xB7 {files} \u4E2A\u6587\u4EF6",
    hitsPlural: "{count} \u6761\u7ED3\u679C \xB7 {files} \u4E2A\u6587\u4EF6",
    moreHitSingular: "\u22EE +{count} \u6761\u7ED3\u679C",
    moreHitsPlural: "\u22EE +{count} \u6761\u7ED3\u679C",
    earlierLine: "\u22EE \u524D {count} \u884C\uFF08\u4F7F\u7528 /tool \u9605\u8BFB\u5168\u6587\uFF09",
    earlierLines: "\u22EE \u524D {count} \u884C\uFF08\u4F7F\u7528 /tool \u9605\u8BFB\u5168\u6587\uFF09",
    earlierStackLine: "\u22EE \u524D {count} \u884C\u5806\u6808\u5DF2\u9690\u85CF",
    earlierStackLines: "\u22EE \u524D {count} \u884C\u5806\u6808\u5DF2\u9690\u85CF",
    agent: "\u4EE3\u7406 \xB7 {name}",
    response: "\u56DE\u590D",
    writing: "\u8F93\u51FA\u4E2D \u2026",
    tok: "tok",
    pilcrow: "\xB6",
    aborted: "\u5DF2\u4E2D\u6B62",
    truncatedByEsc: "[\u5DF2\u88AB Esc \u622A\u65AD]",
    rejected: "\u5DF2\u62D2\u7EDD",
    exit: "\u9000\u51FA\u7801 {code}",
    bytesIn: "{bytes} \u8F93\u5165",
    elapsedSec: "{secs}\u79D2",
    stackTrace: "\u5806\u6808\u8DDF\u8E2A",
    retries: "\u6B21\u91CD\u8BD5",
    reasoningLabel: "\u63A8\u7406 \xB7 {count} \xB6",
    runningLabel: "\u8FD0\u884C\u4E2D",
    workingLabel: "\u5904\u7406\u4E2D",
    defaultFooter: "\u2191\u2193 \u9009\u62E9 \xB7 \u23CE \u786E\u8BA4 \xB7 Esc \u53D6\u6D88",
    applyAction: "[a] \u5E94\u7528",
    skipAction: "[s] \u8DF3\u8FC7",
    rejectAction: "[r] \u62D2\u7EDD",
    levelOk: "\u6B63\u5E38",
    levelWarn: "\u8B66\u544A",
    levelFail: "\u5931\u8D25",
    checksLabel: "\u68C0\u67E5\u9879",
    passed: "\u901A\u8FC7",
    warnTag: "\u8B66\u544A",
    failTag: "\u5931\u8D25",
    stepLabel: "\u6B65\u9AA4",
    done: "\u5DF2\u5B8C\u6210",
    inProgress: "\u2190 \u8FDB\u884C\u4E2D",
    upcoming: "\u5F85\u5904\u7406",
    resumed: "\u5DF2\u6062\u590D \xB7 ",
    archive: "\u23EA \u5F52\u6863 \xB7 ",
    more: "\u22EE +{count} \u66F4\u591A",
    categoryUser: "\u7528\u6237",
    categoryFeedback: "\u53CD\u9988",
    categoryProject: "\u9879\u76EE",
    categoryReference: "\u53C2\u8003"
  },
  copyMode: {
    title: "\u2500\u2500 \u590D\u5236\u6A21\u5F0F \u2500\u2500",
    help: "j/k \u6216 \u2191/\u2193 \u79FB\u52A8 \xB7 v \u8D77\u9009\u533A \xB7 y \u590D\u5236 \xB7 g/G \u9876/\u5E95 \xB7 q \u9000\u51FA",
    statusBar: "\u7B2C {cur}/{total} \u884C \xB7 \u9009\u533A\uFF1A{sel}",
    statusYanked: "\u5DF2\u590D\u5236 {size} \u5B57\u7B26\uFF08osc52={osc52}\uFF09",
    statusEmpty: "\u672A\u9009\u4E2D\u5185\u5BB9",
    empty: "\uFF08\u8FD8\u6CA1\u6709\u804A\u5929\u5185\u5BB9 \u2014 \u5148\u548C\u6A21\u578B\u8BF4\u70B9\u4EC0\u4E48\uFF09",
    labelUser: "\u4F60",
    labelAssistant: "\u52A9\u624B",
    labelReasoning: "\u63A8\u7406",
    yankedToast: "\u25B8 \u5DF2\u590D\u5236 {size} \u5B57\u7B26\u5230\u526A\u8D34\u677F (osc52)",
    yankedToastFile: "\u25B8 \u5DF2\u590D\u5236 {size} \u5B57\u7B26 \xB7 \u6587\u4EF6\uFF1A{path}"
  },
  mcpHealth: {
    noData: "\u65E0\u68C0\u67E5\u6570\u636E",
    healthy: "\u6B63\u5E38 \xB7 {ms}ms",
    slow: "\u7F13\u6162 \xB7 {ms}ms",
    verySlow: "\u975E\u5E38\u6162 \xB7 {ms}ms",
    slowToast: "\u26A0 MCP `{name}` \u54CD\u5E94\u7F13\u6162 \xB7 P95 {seconds}s \xB7 \u6700\u8FD1 {sampleSize} \u6B21\u8C03\u7528",
    emptyHint: "\u2139 \u672A\u914D\u7F6E MCP \u670D\u52A1\u5668 \u2014\u2014 \u53EF\u5C1D\u8BD5\uFF1A`reasonix setup` \u91CD\u65B0\u9009\u62E9\uFF0C\u6216 `reasonix mcp install filesystem`"
  },
  denyContextInput: {
    description: "\u544A\u8BC9\u6A21\u578B\u4F60\u4E3A\u4EC0\u4E48\u62D2\u7EDD\u4E86\u3002\u6A21\u578B\u4E0B\u6B21\u4F1A\u770B\u5230\u4F60\u7684\u7406\u7531\u4F5C\u4E3A\u989D\u5916\u7684\u4E0A\u4E0B\u6587\u3002"
  },
  cardStream: {
    scrollAbove: " \u2191 {scroll}/{max} \u884C",
    scrollAbovePlural: " \u2191 {scroll}/{max} \u884C",
    scrollMore: " \u2014 \u8FD8\u6709 {remaining} \u884C",
    scrollPgUp: " \xB7 PgUp/\u6EDA\u8F6E/\u2191"
  },
  slashArgPicker: {
    noMatch: '\u6CA1\u6709\u5339\u914D "{partial}"',
    keepTyping: " \u2014 \u7EE7\u7EED\u8F93\u5165\uFF0C\u6216 Backspace \u4FEE\u6539",
    above: "   \u2191 \u8FD8\u6709 {hidden} \u4E2A",
    below: "   \u2193 \u8FD8\u6709 {hidden} \u4E2A",
    footer: "  \u2191\u2193 \u5BFC\u822A \xB7 Tab/\u23CE \u9009\u62E9 \xB7 Esc \u53D6\u6D88"
  },
  mcpMarketplace: {
    title: "MCP \u5E02\u573A",
    filter: "\u7B5B\u9009\uFF1A",
    filterPlaceholder: "\uFF08\u8F93\u5165\u7B5B\u9009\uFF09",
    matchSingular: "{n} \u6761\u5339\u914D",
    matchPlural: "{n} \u6761\u5339\u914D",
    loading: "\u52A0\u8F7D\u4E2D\u2026",
    noEntries: "\u65E0\u6761\u76EE",
    opening: "\u6B63\u5728\u6253\u5F00\u6CE8\u518C\u8868\u2026",
    cached: " \xB7 \u5DF2\u7F13\u5B58",
    exhausted: " \xB7 \u5DF2\u8017\u5C3D",
    loadingMore: "\u52A0\u8F7D\u66F4\u591A\u2026",
    allLoaded: "\u6240\u6709\u9875\u9762\u5DF2\u52A0\u8F7D",
    fetchingDetail: "\u6B63\u5728\u83B7\u53D6 smithery \u8BE6\u60C5\u2026",
    noInstallInfo: "\u6CA1\u6709 {name} \u7684\u5B89\u88C5\u4FE1\u606F \u2014 \u8BD5\u8BD5 `npx -y @smithery/cli install {name}`",
    alreadyInstalled: "\u5DF2\u5B89\u88C5\uFF1A{spec}",
    installed: "\u5DF2\u5B89\u88C5 \u2192 {spec}",
    uninstalled: "\u5DF2\u5378\u8F7D {name}",
    installFailed: "\u5B89\u88C5\u5931\u8D25\uFF1A{message}",
    notInstalled: "\u672A\u5B89\u88C5\uFF1A{name}",
    bridged: "\u2713 \u5DF2\u5B89\u88C5 {name} \u2014 \u5DF2\u6865\u63A5",
    bridgeFailed: "\u25B2 \u5DF2\u5B89\u88C5 {name} \u2014 \u6865\u63A5\u5931\u8D25\uFF1A{reason}",
    bridgeReloadFailed: "\u2713 \u5DF2\u5B89\u88C5 {name} \u2014 \u91CD\u542F `reasonix code` \u4EE5\u6865\u63A5\uFF08\u91CD\u8F7D\u5931\u8D25\uFF1A{message}\uFF09",
    restartBridge: "\u2713 \u5DF2\u5B89\u88C5 {name} \u2014 \u91CD\u542F `reasonix code` \u4EE5\u6865\u63A5",
    needsEnv: "  \xB7  \u9700\u8981\u73AF\u5883\u53D8\u91CF\uFF1A{env}",
    badgeOfficial: "[\u5B98\u65B9]",
    badgeSmithery: "[\u4E09\u65B9]",
    badgeLocal: "[\u672C\u5730]",
    footerHint: "\u8F93\u5165\u7B5B\u9009 \xB7 \u2191\u2193 \u9009\u62E9 \xB7 \u23CE \u5B89\u88C5/\u5207\u6362 \xB7 PgDn \u52A0\u8F7D\u66F4\u591A \xB7 Esc \u5173\u95ED",
    specLine: "\u914D\u7F6E\uFF1A{runtime} {id} \xB7 {transport}",
    smitheryDetail: "\uFF08smithery \u5217\u8868 \u2014 \u6309 Enter \u83B7\u53D6\u5B89\u88C5\u8BE6\u60C5\uFF09",
    statusError: "\u9519\u8BEF\uFF1A{message}"
  },
  mcpBrowser: {
    title: "\u25C8 MCP \u6D4F\u89C8\u5668",
    empty: "\u6CA1\u6709\u6302\u8F7D MCP \u670D\u52A1\u5668\u3002\u8FD0\u884C `reasonix setup` \u9009\u62E9\u4E00\u4E9B\uFF0C\u6216\u4F7F\u7528 --mcp \u542F\u52A8\u3002",
    serverCount: "{count} \u4E2A\u670D\u52A1\u5668",
    footer: "\u2191\u2193 \u9009\u62E9 \xB7 [r] \u91CD\u8FDE \xB7 [d] \u7981\u7528 \xB7 Esc \u9000\u51FA"
  },
  mcpLifecycle: {
    handshake: "\u63E1\u624B\u4E2D\u2026",
    connected: "\u5DF2\u8FDE\u63A5",
    failed: "\u5931\u8D25",
    disabled: "\u5DF2\u7981\u7528",
    reconnect: "\u91CD\u8FDE\u4E2D\u2026",
    initDetail: "\u521D\u59CB\u5316 \u2192 tools/list \u2192 resources/list",
    reconnectDetail: "\u65AD\u5F00\u65E7\u8FDE\u63A5 \xB7 \u91CD\u65B0\u63E1\u624B \xB7 \u5217\u51FA\u5DE5\u5177",
    disabledDetail: "\u901A\u8FC7 /mcp disable {name}"
  },
  checkpointPicker: {
    title: "\u6062\u590D\u68C0\u67E5\u70B9 \u2014 {workspace}",
    header: " \u25C8 REASONIX \xB7 \u9009\u62E9\u68C0\u67E5\u70B9 ",
    empty: "  \u6B64\u5DE5\u4F5C\u533A\u6682\u65E0\u68C0\u67E5\u70B9 \u2014 \u53C2\u89C1 /checkpoint \u521B\u5EFA",
    more: "     \u2026 \u8FD8\u6709 {hidden} \u4E2A",
    footer: "  \u2191\u2193 \u9009\u62E9  \xB7  \u23CE \u6062\u590D  \xB7  [d] \u5220\u9664  \xB7  Esc \u9000\u51FA",
    footerEmpty: "  Esc \u9000\u51FA"
  },
  planReviseConfirm: {
    title: "\u8BA1\u5212\u4FEE\u6539\u5DF2\u63D0\u4EA4",
    metaRight: "\u2212{removed}  +{added}  \xB7  {kept} \u4E2A\u4FDD\u7559",
    updatedSummary: "\u66F4\u65B0\u6458\u8981\uFF1A{summary}",
    acceptLabel: "\u63A5\u53D7\u4FEE\u6539 \u2014 \u5E94\u7528\u65B0\u7684\u6B65\u9AA4\u5217\u8868",
    acceptHint: "\u7528\u65B0\u6B65\u9AA4\u66FF\u6362\u5269\u4F59\u8BA1\u5212\u3002\u5DF2\u5B8C\u6210\u7684\u6B65\u9AA4\u4E0D\u53D8\u3002",
    rejectLabel: "\u62D2\u7EDD \u2014 \u4FDD\u7559\u539F\u8BA1\u5212",
    rejectHint: "\u653E\u5F03\u4FEE\u6539\u3002\u6A21\u578B\u7EE7\u7EED\u6309\u539F\u6B65\u9AA4\u6267\u884C\u3002"
  },
  diffApp: {
    title: "reasonix diff",
    turnLabel: "\u7B2C {turn} \u8F6E\uFF08{current}/{total}\uFF09",
    turnsAligned: "{count} \u8F6E\u5DF2\u5BF9\u9F50",
    paneEmpty: "\uFF08\u6B64\u8F6E\u8BE5\u4FA7\u65E0\u8BB0\u5F55\uFF09",
    kindMatch: "\u2713 \u4E00\u81F4",
    kindDiverge: "\u2605 \u5206\u6B67",
    kindOnlyInA: "\u2190 \u4EC5 A \u6709",
    kindOnlyInB: "\u2192 \u4EC5 B \u6709"
  },
  recordView: {
    userPrefix: "\u4F60 \u203A ",
    assistant: "\u52A9\u624B",
    toolPrefix: "tool<",
    argsLabel: "  \u53C2\u6570\uFF1A",
    resultArrow: "  \u2192 ",
    error: "\u9519\u8BEF ",
    cache: "  \xB7 \u7F13\u5B58 ",
    toolCallOnly: "\uFF08\u4EC5\u5DE5\u5177\u8C03\u7528\u54CD\u5E94\uFF09",
    truncateExtra: "\uFF08+{extra} \u5B57\u7B26\uFF09"
  },
  replayApp: {
    emptyTranscript: "\u7A7A\u8BB0\u5F55",
    turnProgress: "\u7B2C {current}/{total} \u8F6E",
    noRecords: "\u65E0\u8BB0\u5F55",
    untracked: "\uFF08\u672A\u8FFD\u8E2A\uFF09",
    churned: "\uFF08\u5DF2\u53D8\u66F4 \xD7{count}\uFF09"
  }
};

// src/i18n/index.ts
var translations = {
  EN,
  "zh-CN": zhCN
};
function detectSystemLanguage(locale = Intl.DateTimeFormat().resolvedOptions().locale) {
  if (locale.startsWith("zh")) return "zh-CN";
  if (locale.startsWith("en")) return "EN";
  return null;
}
var currentLang = loadLanguage() ?? detectSystemLanguage() ?? "EN";
var listeners = [];
function onLanguageChange(cb) {
  listeners.push(cb);
  return () => {
    const i = listeners.indexOf(cb);
    if (i >= 0) listeners.splice(i, 1);
  };
}
function notifyLanguageChange() {
  for (const cb of listeners) cb();
}
function setLanguage(lang) {
  if (translations[lang]) {
    currentLang = lang;
    saveLanguage(lang);
  }
}
function getLanguage() {
  return currentLang;
}
function getSupportedLanguages() {
  return Object.keys(translations);
}
function tObj(path) {
  const parts = path.split(".");
  let val = translations[currentLang] || translations.EN;
  for (const part of parts) {
    val = val?.[part];
    if (val === void 0) break;
  }
  if (val === void 0 && currentLang !== "EN") {
    val = translations.EN;
    for (const part of parts) {
      val = val?.[part];
      if (val === void 0) break;
    }
  }
  return val;
}
function t(path, params) {
  const parts = path.split(".");
  let val = translations[currentLang] || translations.EN;
  for (const part of parts) {
    val = val?.[part];
    if (val === void 0) break;
  }
  if (val === void 0 && currentLang !== "EN") {
    val = translations.EN;
    for (const part of parts) {
      val = val?.[part];
      if (val === void 0) break;
    }
  }
  if (typeof val !== "string") {
    return path;
  }
  if (params) {
    let result = val;
    for (const [k, v] of Object.entries(params)) {
      result = result.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
    return result;
  }
  return val;
}

export {
  detectSystemLanguage,
  onLanguageChange,
  notifyLanguageChange,
  setLanguage,
  getLanguage,
  getSupportedLanguages,
  tObj,
  t
};
//# sourceMappingURL=chunk-MHGPBJ2T.js.map