export function dashboardHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Agent Bridge Dashboard</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@xterm/xterm/css/xterm.css">
  <style>
    :root {
      color-scheme: dark;
      --bg: #0a0e13;
      --panel: #111821;
      --panel-2: #151f2a;
      --panel-3: #1a2531;
      --terminal: #05080c;
      --border: #283443;
      --border-strong: #3a495a;
      --text: #edf3f8;
      --muted: #8c9aaa;
      --muted-2: #647385;
      --accent: #62c7b8;
      --bad: #ff7676;
      --warn: #f0c766;
      --ok: #70d99a;
      --shadow: 0 16px 40px rgba(0,0,0,.28);
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0;
      background:
        linear-gradient(180deg, rgba(98,199,184,.06), transparent 260px),
        var(--bg);
      color: var(--text);
      font: 13px/1.45 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
    }
    button {
      font: inherit;
      color: var(--text);
      background: var(--panel-2);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 7px 10px;
      cursor: pointer;
      transition: background .16s ease, border-color .16s ease, transform .16s ease;
    }
    button:hover:not(:disabled) { background: var(--panel-3); border-color: var(--border-strong); }
    button:active:not(:disabled) { transform: translateY(1px); }
    button:focus-visible, input:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent), transparent 35%); outline-offset: 2px; }
    button:disabled { cursor: not-allowed; opacity: .45; }
    input {
      width: 100%;
      min-width: 0;
      color: var(--text);
      background: #0c1219;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 8px 10px;
      font: inherit;
    }
    input::placeholder { color: var(--muted-2); }
    .app {
      display: grid;
      grid-template-columns: minmax(360px, 420px) minmax(0, 1fr);
      height: 100dvh;
      min-height: 560px;
    }
    .runs, .terminal {
      min-width: 0;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
    .runs { background: var(--panel); border-right: 1px solid var(--border); }
    .bar {
      min-height: 72px;
      padding: 12px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
    }
    .bar-main { min-width: 0; }
    .title-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .title { font-weight: 760; font-size: 15px; letter-spacing: .01em; }
    .meta {
      color: var(--muted);
      font-size: 12px;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      margin-top: 2px;
    }
    .service-pill, .stream-state {
      flex: none;
      color: var(--muted);
      background: #0c1219;
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 3px 8px;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.2;
    }
    .service-pill.running, .stream-state.streaming { color: var(--ok); border-color: color-mix(in srgb, var(--ok), transparent 50%); }
    .service-pill.stopped, .stream-state.error { color: var(--bad); border-color: color-mix(in srgb, var(--bad), transparent 50%); }
    .stream-state.connecting, .stream-state.closed { color: var(--warn); border-color: color-mix(in srgb, var(--warn), transparent 50%); }
    .summary {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 1px;
      border-bottom: 1px solid var(--border);
      background: var(--border);
    }
    .metric {
      min-width: 0;
      padding: 10px 12px;
      background: #0f151d;
    }
    .metric span {
      display: block;
      color: var(--muted);
      font-size: 11px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .metric strong {
      display: block;
      margin-top: 2px;
      color: var(--text);
      font: 700 18px/1.1 ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .metric.attention strong { color: var(--warn); }
    .filters {
      display: grid;
      gap: 8px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
      background: var(--panel);
    }
    .list {
      overflow: auto;
      padding: 8px 8px 12px;
      display: grid;
      align-content: start;
      gap: 6px;
    }
    .tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      padding: 8px 12px 10px;
      border-bottom: 1px solid var(--border);
      background: var(--panel);
    }
    .tab {
      background: transparent;
      border-color: transparent;
      color: var(--muted);
      font-weight: 700;
      padding: 7px 8px;
    }
    .tab.active {
      background: #0c1219;
      border-color: var(--border-strong);
      color: var(--text);
    }
    .run-row {
      position: relative;
      width: 100%;
      text-align: left;
      display: grid;
      gap: 6px;
      background: rgba(255,255,255,.015);
      border: 1px solid transparent;
      border-radius: 8px;
      padding: 10px 10px 10px 12px;
      box-shadow: none;
    }
    .run-row::before {
      content: "";
      position: absolute;
      inset: 10px auto 10px 0;
      width: 3px;
      border-radius: 0 3px 3px 0;
      background: var(--muted-2);
    }
    .run-row.status-running::before, .run-row.status-pending::before { background: var(--accent); }
    .run-row.status-pass::before, .run-row.status-late_pass::before { background: var(--ok); }
    .run-row.status-fail::before, .run-row.status-late_fail::before, .run-row.status-error::before { background: var(--bad); }
    .run-row.status-uncertain::before, .run-row.status-late_uncertain::before, .run-row.status-timed_out::before, .run-row.status-interrupted::before { background: var(--warn); }
    .run-row:hover { background: var(--panel-2); border-color: var(--border); }
    .run-row.selected {
      background: var(--panel-3);
      border-color: color-mix(in srgb, var(--accent), transparent 45%);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent), transparent 70%);
    }
    .route-row {
      display: grid;
      gap: 6px;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px;
      background: rgba(255,255,255,.02);
    }
    .section-label {
      color: var(--muted);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .04em;
      text-transform: uppercase;
      margin: 8px 2px 2px;
    }
    .line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-width: 0;
    }
    .name, .run-id {
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      font-weight: 700;
    }
    .run-id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--text); }
    .path, .command, .preview {
      color: var(--muted);
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
    }
    .preview { color: #aab5c2; font-family: inherit; }
    .row-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      overflow: hidden;
      color: var(--muted);
      font-size: 12px;
    }
    .row-meta span {
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .row-meta span:not(:last-child) {
      flex: none;
      color: var(--muted-2);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .badge {
      flex: none;
      text-transform: uppercase;
      font-size: 10px;
      line-height: 1;
      padding: 4px 6px;
      border-radius: 999px;
      border: 1px solid var(--border);
      color: var(--muted);
      background: #111821;
    }
    .badge.running, .badge.pending { color: var(--accent); border-color: color-mix(in srgb, var(--accent), transparent 45%); }
    .badge.ready { color: var(--accent); border-color: color-mix(in srgb, var(--accent), transparent 45%); }
    .badge.disabled { color: var(--muted); border-color: var(--border); }
    .badge.pass, .badge.late_pass { color: var(--ok); border-color: color-mix(in srgb, var(--ok), transparent 45%); }
    .badge.fail, .badge.late_fail, .badge.error { color: var(--bad); border-color: color-mix(in srgb, var(--bad), transparent 45%); }
    .badge.uncertain, .badge.late_uncertain, .badge.timed_out, .badge.interrupted { color: var(--warn); border-color: color-mix(in srgb, var(--warn), transparent 45%); }
    .empty {
      color: var(--muted);
      padding: 14px;
      border: 1px dashed var(--border);
      border-radius: 8px;
      background: rgba(255,255,255,.02);
    }
    .skeleton {
      height: 74px;
      border-radius: 8px;
      background: linear-gradient(90deg, rgba(255,255,255,.03), rgba(255,255,255,.07), rgba(255,255,255,.03));
      background-size: 200% 100%;
    }
    .terminal { background: var(--terminal); }
    .terminal-bar {
      min-height: 64px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      padding: 10px 12px;
      align-items: center;
      border-bottom: 1px solid var(--border);
      background: var(--panel);
    }
    .terminal-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .terminal-title {
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-weight: 650;
    }
    .terminal-actions { display: flex; gap: 8px; align-items: center; }
    #terminal-wrap {
      min-height: 0;
      flex: 1;
      padding: 10px;
      background: var(--terminal);
    }
    #terminal-pane {
      width: 100%;
      height: 100%;
      min-height: 360px;
      border: 1px solid #111923;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: var(--shadow);
    }
    #fallback {
      display: none;
      height: 100%;
      min-height: 360px;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
      margin: 0;
      padding: 10px;
      color: #d7dde5;
      background: var(--terminal);
      border: 1px solid #111923;
      border-radius: 8px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .xterm { height: 100%; }
    .xterm-viewport { overflow-y: auto !important; }
    @media (prefers-reduced-motion: no-preference) {
      .skeleton { animation: sweep 1.2s ease-in-out infinite; }
      @keyframes sweep { from { background-position: 100% 0; } to { background-position: -100% 0; } }
    }
    @media (max-width: 1100px) {
      .app { grid-template-columns: minmax(320px, 370px) minmax(0, 1fr); }
      .summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 820px) {
      .app { grid-template-columns: 1fr; height: auto; min-height: 100dvh; }
      .runs { max-height: 38vh; border-right: 0; border-bottom: 1px solid var(--border); }
      .terminal { min-height: 62vh; }
      .terminal-bar { grid-template-columns: 1fr; align-items: stretch; }
      .terminal-actions { justify-content: flex-start; }
    }
  </style>
</head>
<body>
  <div class="app">
    <section class="runs">
      <div class="bar">
        <div class="bar-main">
          <div class="title-row">
            <div class="title">Agent Bridge</div>
            <span class="service-pill" id="service-pill">Loading</span>
          </div>
          <div class="meta" id="service-state">Loading service state</div>
          <div class="meta" id="route-summary"></div>
        </div>
        <button id="refresh">Refresh</button>
      </div>
      <div class="summary" id="run-summary">
        <div class="metric"><span>Running</span><strong id="metric-running">0</strong></div>
        <div class="metric attention"><span>Attention</span><strong id="metric-attention">0</strong></div>
        <div class="metric"><span>Routes</span><strong id="metric-routes">0</strong></div>
        <div class="metric"><span>History</span><strong id="metric-history">0</strong></div>
      </div>
      <div class="filters">
        <input id="run-filter" type="search" autocomplete="off" spellcheck="false" placeholder="Filter runs, cwd, command">
      </div>
      <div class="tabs">
        <button class="tab active" id="tab-current">Now Running</button>
        <button class="tab" id="tab-history">Run History</button>
      </div>
      <div class="list" id="run-list">
        <div class="skeleton"></div>
        <div class="skeleton"></div>
        <div class="skeleton"></div>
      </div>
    </section>

    <section class="terminal">
      <div class="terminal-bar">
        <div class="bar-main">
          <div class="terminal-title-row">
            <div class="terminal-title" id="terminal-title">No terminal selected</div>
            <span class="stream-state" id="stream-state">Idle</span>
          </div>
          <div class="meta" id="terminal-meta"></div>
        </div>
        <div class="terminal-actions">
          <button id="copy-log" disabled>Copy</button>
          <button id="clear-terminal">Clear</button>
        </div>
      </div>
      <div id="terminal-wrap">
        <div id="terminal-pane"></div>
        <pre id="fallback"></pre>
      </div>
    </section>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/@xterm/xterm/lib/xterm.js"></script>
  <script>
    const state = {
      data: null,
      activeSessions: [],
      historySessions: [],
      activeTab: "current",
      selectedSession: null,
      socket: null,
      term: null,
      fallback: "",
      logText: "",
      filter: "",
      loading: false
    };

    const els = {
      service: document.getElementById("service-state"),
      servicePill: document.getElementById("service-pill"),
      list: document.getElementById("run-list"),
      tabCurrent: document.getElementById("tab-current"),
      tabHistory: document.getElementById("tab-history"),
      routeSummary: document.getElementById("route-summary"),
      filter: document.getElementById("run-filter"),
      refresh: document.getElementById("refresh"),
      metricRunning: document.getElementById("metric-running"),
      metricAttention: document.getElementById("metric-attention"),
      metricRoutes: document.getElementById("metric-routes"),
      metricHistory: document.getElementById("metric-history"),
      terminalTitle: document.getElementById("terminal-title"),
      terminalMeta: document.getElementById("terminal-meta"),
      streamState: document.getElementById("stream-state"),
      terminalPane: document.getElementById("terminal-pane"),
      fallback: document.getElementById("fallback"),
      copy: document.getElementById("copy-log")
    };

    function ensureTerminal() {
      if (state.term) return state.term;
      const terminalGlobal = window.Terminal;
      if (!terminalGlobal) {
        els.terminalPane.style.display = "none";
        els.fallback.style.display = "block";
        return null;
      }
      const TerminalCtor = terminalGlobal.Terminal || terminalGlobal;
      state.term = new TerminalCtor({
        convertEol: true,
        cursorBlink: false,
        scrollback: 30000,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 13,
        lineHeight: 1.25,
        theme: {
          background: "#05070a",
          foreground: "#e7edf4",
          cursor: "#56c8b6",
          selectionBackground: "#29485f"
        }
      });
      state.term.open(els.terminalPane);
      state.term.onData((data) => {
        if (state.socket && state.socket.readyState === WebSocket.OPEN) {
          state.socket.send(data);
        }
      });
      fitTerminal();
      window.addEventListener("resize", fitTerminal);
      return state.term;
    }

    function fitTerminal() {
      if (!state.term) return;
      const rect = els.terminalPane.getBoundingClientRect();
      const cols = Math.max(40, Math.floor(rect.width / 8));
      const rows = Math.max(12, Math.floor(rect.height / 17));
      state.term.resize(cols, rows);
      sendResize(cols, rows);
    }

    function sendResize(cols, rows) {
      if (!state.socket || state.socket.readyState !== WebSocket.OPEN) return;
      state.socket.send("\\x1b]agent-bridge;" + JSON.stringify({ type: "resize", cols, rows }));
    }

    function resetTerminal() {
      state.fallback = "";
      state.logText = "";
      els.fallback.textContent = "";
      const term = ensureTerminal();
      if (term) term.clear();
    }

    function writeTerminal(text) {
      state.logText += text;
      const term = ensureTerminal();
      if (term) {
        term.write(text);
        return;
      }
      state.fallback += stripAnsi(text);
      els.fallback.textContent = state.fallback;
      els.fallback.scrollTop = els.fallback.scrollHeight;
    }

    function stripAnsi(text) {
      return text.replace(/\\x1b\\[[0-9;?]*[ -/]*[@-~]/g, "");
    }

    function badge(status) {
      return "badge " + String(status || "idle").replace(/[^a-z_]/g, "");
    }

    function isRunning(status) {
      return status === "running" || status === "pending";
    }

    function runActive(run) {
      return run.status === "running" || run.consumers.some((consumer) => isRunning(consumer.status));
    }

    function elapsed(start, end) {
      if (!start) return "";
      const ms = Math.max(0, (end ? Date.parse(end) : Date.now()) - Date.parse(start));
      const seconds = Math.floor(ms / 1000);
      if (seconds < 60) return seconds + "s";
      const minutes = Math.floor(seconds / 60);
      return minutes + "m" + String(seconds % 60).padStart(2, "0") + "s";
    }

    function buildSessions(data) {
      const active = [];
      const history = [];
      for (const run of data.runs || []) {
        for (const consumer of run.consumers || []) {
          const session = { run, consumer };
          if (sessionActive(session)) {
            active.push(session);
          } else {
            history.push(session);
          }
        }
      }
      active.sort((left, right) => Date.parse(right.run.startedAt) - Date.parse(left.run.startedAt));
      history.sort((left, right) => Date.parse(right.run.startedAt) - Date.parse(left.run.startedAt));
      return { active, history };
    }

    async function refresh() {
      setLoading(true);
      try {
        const response = await fetch("/api/runs");
        if (!response.ok) {
          throw new Error("Unable to load dashboard data.");
        }
        const data = await response.json();
        state.data = data;
        const sessions = buildSessions(data);
        state.activeSessions = sessions.active;
        state.historySessions = sessions.history;
        renderService(data);
        renderSummary(data);
        preserveOrSelectSession();
        renderTabs();
        renderRunList();
        preserveSelectedTerminal();
      } finally {
        setLoading(false);
      }
    }

    function renderTabs() {
      els.tabCurrent.className = "tab" + (state.activeTab === "current" ? " active" : "");
      els.tabHistory.className = "tab" + (state.activeTab === "history" ? " active" : "");
      els.tabCurrent.textContent = "Now Running (" + state.activeSessions.length + ")";
      els.tabHistory.textContent = "Run History (" + state.historySessions.length + ")";
    }

    function setLoading(loading) {
      state.loading = loading;
      els.refresh.disabled = loading;
      els.refresh.textContent = loading ? "Refreshing" : "Refresh";
    }

    function renderService(data) {
      const running = Boolean(data.service.running);
      els.servicePill.className = "service-pill " + (running ? "running" : "stopped");
      els.servicePill.textContent = running ? "Running" : "Stopped";
      els.service.textContent = running ? "127.0.0.1:" + data.service.port + " pid " + data.service.pid : "service stopped";
      els.routeSummary.textContent = routeSummary(data);
    }

    function renderSummary(data) {
      const routes = data.routes || [];
      const enabledRoutes = routes.filter((route) => route.enabled !== false).length;
      els.metricRunning.textContent = String(state.activeSessions.length);
      els.metricAttention.textContent = String(attentionCount(state.historySessions));
      els.metricRoutes.textContent = String(enabledRoutes) + "/" + String(routes.length);
      els.metricHistory.textContent = String(state.historySessions.length);
    }

    function renderRunList() {
      const sessions = filteredSessions();
      els.list.innerHTML = "";
      if (state.activeTab === "current") {
        renderCurrentList(sessions);
        return;
      }
      if (sessions.length === 0) {
        els.list.innerHTML = '<div class="empty">' + (state.filter ? "No matching runs." : "No completed runs yet.") + '</div>';
        return;
      }
      for (const session of sessions) {
        els.list.appendChild(renderSessionRow(session));
      }
    }

    function renderCurrentList(sessions) {
      const routes = state.data?.routes || [];
      if (routes.length > 0) {
        appendSectionLabel("Configured Routes");
        for (const route of routes) {
          els.list.appendChild(renderRouteRow(route));
        }
      }
      if (sessions.length > 0) {
        appendSectionLabel("Live Consumers");
        for (const session of sessions) {
          els.list.appendChild(renderSessionRow(session));
        }
        return;
      }
      if (state.filter) {
        const empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent = "No matching live runs.";
        els.list.appendChild(empty);
        return;
      }
      if (routes.length === 0) {
        els.list.innerHTML = '<div class="empty">No producer routes configured.</div>';
        return;
      }
      const waiting = document.createElement("div");
      waiting.className = "empty";
      waiting.textContent = "No consumer CLI is running right now.";
      els.list.appendChild(waiting);
    }

    function appendSectionLabel(text) {
      const label = document.createElement("div");
      label.className = "section-label";
      label.textContent = text;
      els.list.appendChild(label);
    }

    function renderRouteRow(route) {
      const row = document.createElement("div");
      const enabled = route.enabled !== false;
      const consumers = route.consumerLabels || route.consumers || [];
      row.className = "route-row";
      row.innerHTML = '<div class="line"><span class="name"></span><span></span></div><div class="command"></div><div class="meta"></div>';
      row.querySelector(".name").textContent = (route.producerLabel || route.producer) + " -> " + consumers.join(", ");
      const status = row.querySelector(".line span:last-child");
      status.className = badge(enabled ? "ready" : "disabled");
      status.textContent = enabled ? "ready" : "disabled";
      row.querySelector(".command").textContent = route.consumers.map((kind) => {
        const agent = agentForKind(kind);
        return agent ? agent.command : kind;
      }).join(" | ");
      row.querySelector(".meta").textContent = enabled ? "standby" : "disabled";
      return row;
    }

    function renderSessionRow(session) {
      const row = document.createElement("button");
      const selected = selectedMatches(session);
      const statusClass = String(session.consumer.status || "idle").replace(/[^a-z_]/g, "");
      row.className = "run-row status-" + statusClass + (selected ? " selected" : "");
      row.disabled = !session.consumer.terminalId && !session.consumer.logPath;
      row.innerHTML = '<div class="line"><span class="run-id"></span><span class=""></span></div><div class="path"></div><div class="preview"></div><div class="row-meta"><span></span><span></span><span></span></div>';
      row.querySelector(".run-id").textContent = session.consumer.label + " / " + session.run.id;
      const status = row.querySelector(".line span:last-child");
      status.className = badge(session.consumer.status);
      status.textContent = session.consumer.status;
      row.querySelector(".path").textContent = session.run.cwd;
      row.querySelector(".preview").textContent = directPreview(session.run) || runSubject(session.run, session.consumer);
      const meta = row.querySelectorAll(".row-meta span");
      const backend = session.consumer.terminalBackend === "tmux" ? "tmux" : "capture";
      meta[0].textContent = elapsed(session.consumer.startedAt || session.run.startedAt, session.consumer.completedAt);
      meta[1].textContent = [directModeLabel(session.run), backend].filter(Boolean).join(" / ");
      meta[2].textContent = (session.consumer.commandLine || session.consumer.command || workerSuffix(session.consumer) || runSubject(session.run, session.consumer));
      row.onclick = () => openTerminal(session.run, session.consumer, true);
      return row;
    }

    function preserveOrSelectSession() {
      if (state.selectedSession && filteredSessions().some(selectedMatches)) {
        return;
      }
      const selectedAnywhere = state.selectedSession ? allSessions().find(selectedMatches) : null;
      if (selectedAnywhere && state.activeTab === "current" && !sessionActive(selectedAnywhere)) {
        state.activeTab = "history";
        preserveOrSelectSession();
        return;
      }
      const firstOpenable = filteredSessions().find((session) => session.consumer.terminalId || session.consumer.logPath);
      if (!firstOpenable) {
        state.selectedSession = null;
        closeTerminal();
        return;
      }
      state.selectedSession = { runId: firstOpenable.run.id, kind: firstOpenable.consumer.kind };
      openTerminal(firstOpenable.run, firstOpenable.consumer, false);
    }

    function visibleSessions() {
      return state.activeTab === "current" ? state.activeSessions : state.historySessions;
    }

    function filteredSessions() {
      const sessions = visibleSessions();
      const query = state.filter.trim().toLowerCase();
      if (!query) return sessions;
      return sessions.filter((session) => sessionSearchText(session).includes(query));
    }

    function allSessions() {
      return [...state.activeSessions, ...state.historySessions];
    }

    function attentionCount(sessions) {
      return sessions.filter((session) => {
        const status = session.consumer.status || session.run.status;
        return ["fail", "late_fail", "error", "uncertain", "late_uncertain", "timed_out", "interrupted"].includes(status);
      }).length;
    }

    function sessionSearchText(session) {
      return [
        session.run.id,
        session.run.status,
        session.run.cwd,
        session.run.directMessagePreview,
        session.run.outputMode,
        directModeLabel(session.run),
        session.consumer.kind,
        session.consumer.label,
        session.consumer.status,
        session.consumer.command,
        session.consumer.commandLine,
        session.consumer.tmuxSession,
        session.consumer.workerId
      ].filter(Boolean).join(" ").toLowerCase();
    }

    function agentForKind(kind) {
      return (state.data?.agents || []).find((agent) => agent.kind === kind);
    }

    function selectedMatches(session) {
      return Boolean(state.selectedSession)
        && state.selectedSession.runId === session.run.id
        && state.selectedSession.kind === session.consumer.kind;
    }

    function sessionActive(session) {
      return isRunning(session.consumer.status) || (runActive(session.run) && !session.consumer.completedAt);
    }

    function routeSummary(data) {
      const routes = data.routes || [];
      if (routes.length === 0) {
        return "no producer routes configured";
      }
      return routes.map((route) => (route.producerLabel || route.producer) + " -> " + (route.consumerLabels || route.consumers || []).join(", ")).join(" | ");
    }

    function preserveSelectedTerminal() {
      if (!state.selectedSession) return;
      const match = allSessions().find(selectedMatches);
      if (match) {
        renderTerminalHeader(match.run, match.consumer);
      }
    }

    function renderTerminalHeader(run, consumer) {
      els.terminalTitle.textContent = consumer.label + " / " + run.id;
      const backend = consumer.terminalBackend === "tmux" ? "tmux" : "capture";
      els.terminalMeta.textContent = backend + (consumer.tmuxSession ? " " + consumer.tmuxSession : "") + (consumer.workerId ? " | worker " + consumer.workerId : "") + (consumer.pid ? " | pid " + consumer.pid : "") + " | " + run.cwd;
      els.copy.disabled = state.logText.length === 0;
    }

    function setStreamState(kind, label) {
      els.streamState.className = "stream-state " + kind;
      els.streamState.textContent = label;
    }

    function runSubject(run, consumer) {
      return run.source === "direct" ? "direct -> " + consumer.label : run.producer + " " + run.event;
    }

    function directPreview(run) {
      return run.source === "direct" && run.directMessagePreview ? run.directMessagePreview : "";
    }

    function directModeLabel(run) {
      if (run.source !== "direct") return "";
      return run.outputMode || "unknown mode";
    }

    function workerSuffix(consumer) {
      return consumer.workerId ? "worker " + consumer.workerId : "";
    }

    function openTerminal(run, consumer, rerender) {
      if (!consumer.terminalId && !consumer.logPath) return;
      if (state.socket) {
        state.socket.close();
        state.socket = null;
      }
      state.selectedSession = { runId: run.id, kind: consumer.kind };
      renderTerminalHeader(run, consumer);
      resetTerminal();
      setStreamState("connecting", "Connecting");
      if (rerender) {
        renderRunList();
      }
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const url = protocol + "//" + location.host + "/api/runs/" + encodeURIComponent(run.id) + "/consumers/" + encodeURIComponent(consumer.kind) + "/ws";
      const socket = new WebSocket(url);
      state.socket = socket;
      socket.onopen = () => {
        setStreamState("streaming", "Streaming");
        fitTerminal();
      };
      socket.onmessage = async (message) => {
        const text = typeof message.data === "string" ? message.data : await message.data.text();
        if (text) writeTerminal(text);
        els.copy.disabled = state.logText.length === 0;
      };
      socket.onclose = () => {
        if (state.socket !== socket) return;
        setStreamState("closed", "Closed");
        writeTerminal("\\r\\n\\x1b[31m# terminal stream disconnected\\x1b[0m\\r\\n");
      };
      socket.onerror = () => {
        if (state.socket !== socket) return;
        setStreamState("error", "Error");
        writeTerminal("\\r\\n\\x1b[31m# terminal websocket error\\x1b[0m\\r\\n");
      };
    }

    function closeTerminal() {
      if (state.socket) {
        state.socket.close();
        state.socket = null;
      }
      els.terminalTitle.textContent = "No terminal selected";
      els.terminalMeta.textContent = "";
      setStreamState("", "Idle");
      resetTerminal();
    }

    function selectTab(tab) {
      if (state.activeTab === tab) return;
      state.activeTab = tab;
      state.selectedSession = null;
      preserveOrSelectSession();
      renderTabs();
      renderRunList();
      preserveSelectedTerminal();
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[char]));
    }

    document.getElementById("refresh").onclick = () => refresh().catch(showError);
    els.tabCurrent.onclick = () => selectTab("current");
    els.tabHistory.onclick = () => selectTab("history");
    els.filter.oninput = () => {
      state.filter = els.filter.value;
      preserveOrSelectSession();
      renderRunList();
      preserveSelectedTerminal();
    };
    document.getElementById("clear-terminal").onclick = resetTerminal;
    els.copy.onclick = async () => {
      await navigator.clipboard.writeText(stripAnsi(state.logText));
      els.copy.textContent = "Copied";
      setTimeout(() => {
        els.copy.textContent = "Copy";
      }, 1200);
    };
    setInterval(() => refresh().catch(() => undefined), 5000);
    refresh().catch(showError);

    function showError(error) {
      setLoading(false);
      els.servicePill.className = "service-pill stopped";
      els.servicePill.textContent = "Error";
      els.service.textContent = "dashboard data unavailable";
      els.list.innerHTML = '<div class="empty">' + escapeHtml(error.message) + '</div>';
    }
  </script>
</body>
</html>`;
}
