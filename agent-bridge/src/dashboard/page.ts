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
      --bg: #0d1117;
      --panel: #151b23;
      --panel-2: #1b232d;
      --panel-3: #202a35;
      --border: #303a46;
      --text: #e7edf4;
      --muted: #91a0b1;
      --accent: #56c8b6;
      --accent-2: #7aa7ff;
      --bad: #ff6b6b;
      --warn: #f4c95d;
      --ok: #66dda0;
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font: 13px/1.45 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
    }
    button {
      font: inherit;
      color: var(--text);
      background: var(--panel-2);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 6px 9px;
      cursor: pointer;
    }
    button:hover:not(:disabled) { border-color: var(--accent); }
    button:disabled { cursor: not-allowed; opacity: .45; }
    .app {
      display: grid;
      grid-template-columns: 380px minmax(0, 1fr);
      min-height: 100vh;
    }
    .runs, .terminal {
      min-width: 0;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
    .runs { background: var(--panel); border-right: 1px solid var(--border); }
    .bar {
      min-height: 56px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .bar-main { min-width: 0; }
    .title { font-weight: 750; font-size: 14px; }
    .meta {
      color: var(--muted);
      font-size: 12px;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      margin-top: 2px;
    }
    .list {
      overflow: auto;
      padding: 8px;
      display: grid;
      align-content: start;
      gap: 6px;
    }
    .tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      padding: 8px;
      border-bottom: 1px solid var(--border);
      background: var(--panel);
    }
    .tab {
      background: transparent;
      border-color: transparent;
      color: var(--muted);
      font-weight: 700;
    }
    .tab.active {
      background: var(--panel-3);
      border-color: var(--accent);
      color: var(--text);
    }
    .run-row {
      width: 100%;
      text-align: left;
      display: grid;
      gap: 6px;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 7px;
      padding: 9px;
    }
    .run-row:hover { background: var(--panel-2); border-color: var(--border); }
    .run-row.selected { background: var(--panel-3); border-color: var(--accent); }
    .route-row {
      display: grid;
      gap: 6px;
      border: 1px solid var(--border);
      border-radius: 7px;
      padding: 9px;
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
    .run-id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--accent-2); }
    .path, .command {
      color: var(--muted);
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
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
      border-radius: 7px;
      background: rgba(255,255,255,.02);
    }
    .terminal { background: #05070a; }
    .terminal-bar {
      min-height: 56px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      padding: 9px 12px;
      align-items: center;
      border-bottom: 1px solid var(--border);
      background: var(--panel);
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
    .traffic { display: inline-flex; gap: 6px; margin-right: 8px; vertical-align: -1px; }
    .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .red { background: #ff5f57; } .yellow { background: #febc2e; } .green { background: #28c840; }
    #terminal-wrap {
      min-height: 0;
      flex: 1;
      padding: 8px;
      background: #05070a;
    }
    #terminal-pane {
      width: 100%;
      height: 100%;
      min-height: 360px;
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
      background: #05070a;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .xterm { height: 100%; }
    .xterm-viewport { overflow-y: auto !important; }
    @media (max-width: 1100px) {
      .app { grid-template-columns: 340px minmax(0, 1fr); }
    }
    @media (max-width: 820px) {
      .app { grid-template-columns: 1fr; }
      .runs { max-height: 38vh; border-right: 0; border-bottom: 1px solid var(--border); }
      .terminal { min-height: 58vh; }
    }
  </style>
</head>
<body>
  <div class="app">
    <section class="runs">
      <div class="bar">
        <div class="bar-main">
          <div class="title">Agent Bridge</div>
          <div class="meta" id="service-state">loading</div>
          <div class="meta" id="route-summary"></div>
        </div>
        <button id="refresh">Refresh</button>
      </div>
      <div class="tabs">
        <button class="tab active" id="tab-current">Now Running</button>
        <button class="tab" id="tab-history">Run History</button>
      </div>
      <div class="list" id="run-list"></div>
    </section>

    <section class="terminal">
      <div class="terminal-bar">
        <div class="bar-main">
          <div class="terminal-title" id="terminal-title"><span class="traffic"><span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span></span>No terminal selected</div>
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
      logText: ""
    };

    const els = {
      service: document.getElementById("service-state"),
      list: document.getElementById("run-list"),
      tabCurrent: document.getElementById("tab-current"),
      tabHistory: document.getElementById("tab-history"),
      routeSummary: document.getElementById("route-summary"),
      terminalTitle: document.getElementById("terminal-title"),
      terminalMeta: document.getElementById("terminal-meta"),
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
      const response = await fetch("/api/runs");
      const data = await response.json();
      state.data = data;
      const sessions = buildSessions(data);
      state.activeSessions = sessions.active;
      state.historySessions = sessions.history;
      els.service.textContent = data.service.running ? "service :" + data.service.port + " pid " + data.service.pid : "service stopped";
      els.routeSummary.textContent = routeSummary(data);
      preserveOrSelectSession();
      renderTabs();
      renderRunList();
      preserveSelectedTerminal();
    }

    function renderTabs() {
      els.tabCurrent.className = "tab" + (state.activeTab === "current" ? " active" : "");
      els.tabHistory.className = "tab" + (state.activeTab === "history" ? " active" : "");
      els.tabCurrent.textContent = "Now Running (" + state.activeSessions.length + ")";
      els.tabHistory.textContent = "Run History (" + state.historySessions.length + ")";
    }

    function renderRunList() {
      const sessions = visibleSessions();
      els.list.innerHTML = "";
      if (state.activeTab === "current") {
        renderCurrentList(sessions);
        return;
      }
      if (sessions.length === 0) {
        els.list.innerHTML = '<div class="empty">No completed runs yet.</div>';
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
      row.className = "run-row" + (selected ? " selected" : "");
      row.disabled = !session.consumer.terminalId && !session.consumer.logPath;
      row.innerHTML = '<div class="line"><span class="run-id"></span><span class=""></span></div><div class="path"></div><div class="meta"></div>';
      row.querySelector(".run-id").textContent = session.consumer.label + " / " + session.run.id;
      const status = row.querySelector(".line span:last-child");
      status.className = badge(session.consumer.status);
      status.textContent = session.consumer.status;
      row.querySelector(".path").textContent = session.run.cwd;
      row.querySelector(".meta").textContent = runSubject(session.run, session.consumer) + directPreview(session.run) + workerSuffix(session.consumer) + " | " + elapsed(session.consumer.startedAt || session.run.startedAt, session.consumer.completedAt);
      row.onclick = () => openTerminal(session.run, session.consumer, true);
      return row;
    }

    function preserveOrSelectSession() {
      if (state.selectedSession && visibleSessions().some(selectedMatches)) {
        return;
      }
      const selectedAnywhere = state.selectedSession ? allSessions().find(selectedMatches) : null;
      if (selectedAnywhere && state.activeTab === "current" && !sessionActive(selectedAnywhere)) {
        state.activeTab = "history";
        preserveOrSelectSession();
        return;
      }
      const firstOpenable = visibleSessions().find((session) => session.consumer.terminalId || session.consumer.logPath);
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

    function allSessions() {
      return [...state.activeSessions, ...state.historySessions];
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
      els.terminalTitle.innerHTML = '<span class="traffic"><span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span></span>' + escapeHtml(consumer.label) + " / " + escapeHtml(run.id);
      const backend = consumer.terminalBackend === "tmux" ? "tmux" : "capture";
      els.terminalMeta.textContent = backend + (consumer.tmuxSession ? " " + consumer.tmuxSession : "") + (consumer.workerId ? " | worker " + consumer.workerId : "") + (consumer.pid ? " | pid " + consumer.pid : "") + " | " + run.cwd;
      els.copy.disabled = state.logText.length === 0;
    }

    function runSubject(run, consumer) {
      return run.source === "direct" ? "direct -> " + consumer.label : run.producer + " " + run.event;
    }

    function directPreview(run) {
      return run.source === "direct" && run.directMessagePreview ? " | " + run.directMessagePreview : "";
    }

    function workerSuffix(consumer) {
      return consumer.workerId ? " | worker " + consumer.workerId : "";
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
      if (rerender) {
        renderRunList();
      }
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const url = protocol + "//" + location.host + "/api/runs/" + encodeURIComponent(run.id) + "/consumers/" + encodeURIComponent(consumer.kind) + "/ws";
      const socket = new WebSocket(url);
      state.socket = socket;
      socket.onopen = () => fitTerminal();
      socket.onmessage = async (message) => {
        const text = typeof message.data === "string" ? message.data : await message.data.text();
        if (text) writeTerminal(text);
        els.copy.disabled = state.logText.length === 0;
      };
      socket.onclose = () => {
        if (state.socket !== socket) return;
        writeTerminal("\\r\\n\\x1b[31m# terminal stream disconnected\\x1b[0m\\r\\n");
      };
      socket.onerror = () => {
        if (state.socket !== socket) return;
        writeTerminal("\\r\\n\\x1b[31m# terminal websocket error\\x1b[0m\\r\\n");
      };
    }

    function closeTerminal() {
      if (state.socket) {
        state.socket.close();
        state.socket = null;
      }
      els.terminalTitle.innerHTML = '<span class="traffic"><span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span></span>No terminal selected';
      els.terminalMeta.textContent = "";
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
    document.getElementById("clear-terminal").onclick = resetTerminal;
    els.copy.onclick = async () => {
      await navigator.clipboard.writeText(stripAnsi(state.logText));
    };
    setInterval(() => refresh().catch(() => undefined), 5000);
    refresh().catch(showError);

    function showError(error) {
      els.list.innerHTML = '<div class="empty">' + escapeHtml(error.message) + '</div>';
    }
  </script>
</body>
</html>`;
}
