export function dashboardHtml(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'self'; base-uri 'none'">
  <title>Token Relay 管理台</title>
  <style>
    :root {
      color-scheme: light;
      --page: #f3f6fb;
      --surface: #ffffff;
      --surface-alt: #edf3ff;
      --ink: #13213c;
      --muted: #526075;
      --border: #c8d2e1;
      --primary: #0759d1;
      --primary-dark: #06469f;
      --focus: #e27800;
      --success: #09623b;
      --success-bg: #ddf8e9;
      --warning: #744400;
      --warning-bg: #fff1c7;
      --danger: #a12622;
      --danger-bg: #ffebe9;
      --neutral-bg: #e9eef5;
      --shadow: 0 12px 30px rgba(22, 42, 76, 0.08);
      --radius: 14px;
    }

    * {
      box-sizing: border-box;
    }

    html {
      min-width: 320px;
      background: var(--page);
    }

    body {
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(circle at 8% -12%, rgba(74, 130, 224, 0.16), transparent 28rem),
        var(--page);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 16px;
      line-height: 1.5;
    }

    button,
    input,
    select {
      font: inherit;
    }

    button,
    input,
    select {
      min-height: 44px;
    }

    button {
      cursor: pointer;
    }

    button:disabled,
    input:disabled,
    select:disabled {
      cursor: not-allowed;
      opacity: 0.62;
    }

    :focus-visible {
      outline: 3px solid var(--focus);
      outline-offset: 3px;
    }

    [hidden] {
      display: none !important;
    }

    .skip-link {
      position: fixed;
      z-index: 100;
      top: 0.75rem;
      left: 0.75rem;
      padding: 0.7rem 1rem;
      border-radius: 8px;
      background: var(--surface);
      color: var(--ink);
      box-shadow: var(--shadow);
      transform: translateY(-160%);
    }

    .skip-link:focus {
      transform: translateY(0);
    }

    .topbar {
      border-bottom: 1px solid rgba(255, 255, 255, 0.14);
      background: #102240;
      color: #ffffff;
    }

    .topbar-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: min(1120px, calc(100% - 2rem));
      min-height: 72px;
      margin: 0 auto;
      gap: 1rem;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .brand-mark {
      display: grid;
      width: 38px;
      height: 38px;
      place-items: center;
      border: 1px solid rgba(255, 255, 255, 0.45);
      border-radius: 11px;
      background: rgba(255, 255, 255, 0.1);
      font-weight: 800;
      letter-spacing: -0.04em;
    }

    .brand-text {
      display: grid;
      gap: 0.05rem;
    }

    .brand-title {
      font-size: 1.05rem;
      font-weight: 750;
    }

    .brand-subtitle {
      color: #c8d7ee;
      font-size: 0.78rem;
    }

    .connection-label {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      color: #e4ecf8;
      font-size: 0.85rem;
    }

    .connection-dot {
      width: 0.6rem;
      height: 0.6rem;
      border-radius: 999px;
      background: #7e8ba0;
      box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.08);
    }

    .connection-dot.is-ready {
      background: #45d892;
    }

    main {
      width: min(1120px, calc(100% - 2rem));
      margin: 0 auto;
      padding: 2rem 0 4rem;
    }

    h1,
    h2,
    h3,
    p {
      margin-top: 0;
    }

    h1 {
      margin-bottom: 0.4rem;
      font-size: clamp(1.65rem, 3vw, 2.2rem);
      line-height: 1.2;
      letter-spacing: -0.025em;
    }

    h2 {
      margin-bottom: 0.35rem;
      font-size: 1.18rem;
      line-height: 1.3;
    }

    h3 {
      margin-bottom: 0.25rem;
      font-size: 1rem;
    }

    .muted {
      color: var(--muted);
    }

    .auth-shell {
      display: grid;
      min-height: calc(100vh - 190px);
      place-items: center;
      padding: 1rem 0 3rem;
    }

    .auth-card {
      width: min(100%, 480px);
      padding: clamp(1.4rem, 4vw, 2rem);
      border: 1px solid var(--border);
      border-radius: 18px;
      background: var(--surface);
      box-shadow: var(--shadow);
    }

    .auth-card .eyebrow {
      margin-bottom: 0.75rem;
      color: var(--primary-dark);
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.09em;
      text-transform: uppercase;
    }

    .form-stack {
      display: grid;
      gap: 1rem;
    }

    .field {
      display: grid;
      gap: 0.4rem;
    }

    .field label,
    .field-label {
      color: var(--ink);
      font-size: 0.91rem;
      font-weight: 700;
    }

    .field-hint {
      margin: 0;
      color: var(--muted);
      font-size: 0.79rem;
    }

    input,
    select {
      width: 100%;
      padding: 0.65rem 0.75rem;
      border: 1px solid #aebbcf;
      border-radius: 9px;
      background: #ffffff;
      color: var(--ink);
    }

    input::placeholder {
      color: #69768a;
      opacity: 1;
    }

    input:hover,
    select:hover {
      border-color: #75849b;
    }

    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0.65rem 1rem;
      border: 1px solid transparent;
      border-radius: 9px;
      font-weight: 750;
      text-decoration: none;
    }

    .button-primary {
      background: var(--primary);
      color: #ffffff;
    }

    .button-primary:hover:not(:disabled) {
      background: var(--primary-dark);
    }

    .button-secondary {
      border-color: #9eacc0;
      background: var(--surface);
      color: var(--ink);
    }

    .button-secondary:hover:not(:disabled) {
      background: var(--surface-alt);
    }

    .button-danger {
      border-color: #d7a5a3;
      background: #ffffff;
      color: var(--danger);
    }

    .button-danger:hover:not(:disabled) {
      background: var(--danger-bg);
    }

    .button-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.65rem;
    }

    .form-status {
      min-height: 1.4rem;
      margin: 0;
      color: var(--muted);
      font-size: 0.85rem;
    }

    .form-status.is-error {
      color: var(--danger);
      font-weight: 650;
    }

    .page-heading {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.3rem;
    }

    .page-heading p {
      margin-bottom: 0;
    }

    .alert {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1rem;
      padding: 0.9rem 1rem;
      border: 1px solid #dd9d99;
      border-radius: 10px;
      background: var(--danger-bg);
      color: #7e1a17;
    }

    .alert p {
      margin: 0;
    }

    .loading-panel {
      display: grid;
      min-height: 240px;
      place-items: center;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      color: var(--muted);
    }

    .loading-copy {
      display: grid;
      justify-items: center;
      gap: 0.7rem;
    }

    .spinner {
      width: 34px;
      height: 34px;
      border: 4px solid #cdd8e7;
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    .dashboard-content {
      display: grid;
      gap: 1rem;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.85rem;
    }

    .summary-card,
    .panel {
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      box-shadow: 0 5px 18px rgba(22, 42, 76, 0.04);
    }

    .summary-card {
      min-height: 125px;
      padding: 1rem;
    }

    .summary-card-label {
      margin-bottom: 0.5rem;
      color: var(--muted);
      font-size: 0.82rem;
      font-weight: 700;
    }

    .summary-card-value {
      margin-bottom: 0.25rem;
      font-size: clamp(1.55rem, 3vw, 2rem);
      font-weight: 800;
      letter-spacing: -0.035em;
      line-height: 1.1;
    }

    .summary-card-detail {
      margin: 0;
      color: var(--muted);
      font-size: 0.78rem;
    }

    .management-grid {
      display: grid;
      grid-template-columns: minmax(0, 0.78fr) minmax(0, 1.22fr);
      gap: 1rem;
    }

    .panel {
      min-width: 0;
      overflow: hidden;
    }

    .panel-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem 1.1rem;
      border-bottom: 1px solid var(--border);
      background: #fbfcfe;
    }

    .panel-header p {
      margin-bottom: 0;
      color: var(--muted);
      font-size: 0.82rem;
    }

    .panel-body {
      padding: 1.1rem;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.9rem;
    }

    .form-grid .span-2 {
      grid-column: 1 / -1;
    }

    .table-wrap {
      max-width: 100%;
      overflow-x: auto;
    }

    table {
      width: 100%;
      min-width: 760px;
      border-collapse: collapse;
      font-size: 0.88rem;
    }

    th,
    td {
      padding: 0.85rem 1rem;
      border-bottom: 1px solid #dde4ee;
      text-align: left;
      vertical-align: top;
    }

    th {
      background: #f8fafd;
      color: #3e4c60;
      font-size: 0.76rem;
      font-weight: 800;
      letter-spacing: 0.025em;
      text-transform: uppercase;
    }

    tbody tr:last-child td {
      border-bottom: 0;
    }

    tbody tr:hover {
      background: #f8faff;
    }

    .cell-title {
      display: block;
      color: var(--ink);
      font-weight: 750;
    }

    .cell-subtitle {
      display: block;
      margin-top: 0.14rem;
      color: var(--muted);
      font-size: 0.77rem;
      overflow-wrap: anywhere;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      min-height: 26px;
      padding: 0.2rem 0.55rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 800;
      white-space: nowrap;
    }

    .badge-success {
      background: var(--success-bg);
      color: var(--success);
    }

    .badge-warning {
      background: var(--warning-bg);
      color: var(--warning);
    }

    .badge-danger {
      background: var(--danger-bg);
      color: var(--danger);
    }

    .badge-neutral {
      background: var(--neutral-bg);
      color: #445269;
    }

    .chip-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      max-width: 320px;
    }

    .chip {
      display: inline-flex;
      padding: 0.18rem 0.48rem;
      border: 1px solid #c4d3ea;
      border-radius: 6px;
      background: #f0f5fd;
      color: #294664;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.72rem;
      overflow-wrap: anywhere;
    }

    .quota {
      display: grid;
      width: min(100%, 190px);
      gap: 0.32rem;
    }

    .quota-label {
      color: var(--muted);
      font-size: 0.76rem;
    }

    .progress-track {
      position: relative;
      height: 8px;
      overflow: hidden;
      border-radius: 999px;
      background: #dfe6f0;
    }

    .progress-value {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: var(--primary);
    }

    .progress-value.is-warning {
      background: #a86200;
    }

    .progress-value.is-danger {
      background: var(--danger);
    }

    .empty-state {
      display: grid;
      min-height: 150px;
      place-items: center;
      padding: 2rem 1rem;
      text-align: center;
    }

    .empty-state strong {
      display: block;
      margin-bottom: 0.25rem;
    }

    .empty-state p {
      max-width: 500px;
      margin-bottom: 0;
      color: var(--muted);
      font-size: 0.86rem;
    }

    .request-error {
      display: block;
      max-width: 260px;
      margin-top: 0.25rem;
      color: var(--danger);
      font-size: 0.76rem;
      overflow-wrap: anywhere;
    }

    dialog {
      width: min(calc(100% - 2rem), 620px);
      padding: 0;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: var(--surface);
      color: var(--ink);
      box-shadow: 0 24px 80px rgba(5, 21, 50, 0.3);
    }

    dialog::backdrop {
      background: rgba(8, 20, 42, 0.68);
    }

    .dialog-header,
    .dialog-body,
    .dialog-footer {
      padding: 1.1rem 1.25rem;
    }

    .dialog-header {
      border-bottom: 1px solid var(--border);
    }

    .dialog-header h2 {
      margin: 0;
    }

    .dialog-body {
      display: grid;
      gap: 0.85rem;
    }

    .dialog-body p {
      margin: 0;
    }

    .secret-warning {
      padding: 0.75rem 0.85rem;
      border: 1px solid #e1bd68;
      border-radius: 9px;
      background: var(--warning-bg);
      color: #664000;
      font-size: 0.85rem;
    }

    .secret-value {
      max-height: 180px;
      margin: 0;
      padding: 0.9rem;
      overflow: auto;
      border: 1px solid #aebbd0;
      border-radius: 9px;
      background: #f6f8fb;
      color: #172640;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.86rem;
      line-height: 1.6;
      overflow-wrap: anywhere;
      white-space: pre-wrap;
      user-select: all;
    }

    .dialog-footer {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 0.65rem;
      border-top: 1px solid var(--border);
      background: #fafbfd;
    }

    .toast {
      position: fixed;
      z-index: 90;
      right: 1rem;
      bottom: 1rem;
      max-width: min(420px, calc(100% - 2rem));
      padding: 0.8rem 1rem;
      border: 1px solid #9acbb4;
      border-radius: 10px;
      background: #effbf5;
      color: #075433;
      box-shadow: var(--shadow);
      font-weight: 650;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    @media (max-width: 840px) {
      .summary-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .management-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 600px) {
      .topbar-inner,
      main {
        width: min(100% - 1.1rem, 1120px);
      }

      main {
        padding-top: 1.25rem;
      }

      .topbar-inner,
      .page-heading {
        align-items: stretch;
        flex-direction: column;
      }

      .topbar-inner {
        justify-content: center;
        padding: 0.75rem 0;
      }

      .connection-label {
        padding-left: 3.15rem;
      }

      .page-heading .button-row .button {
        flex: 1;
      }

      .summary-grid,
      .form-grid {
        grid-template-columns: 1fr;
      }

      .form-grid .span-2 {
        grid-column: auto;
      }

      .summary-card {
        min-height: 108px;
      }

      .panel-header {
        padding: 0.9rem;
      }

      .panel-body {
        padding: 0.9rem;
      }

      .dialog-footer .button {
        flex: 1;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        scroll-behavior: auto !important;
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
  </style>
</head>
<body>
  <a class="skip-link" href="#main-content">跳到主要内容</a>
  <header class="topbar">
    <div class="topbar-inner">
      <div class="brand" aria-label="Token Relay">
        <span class="brand-mark" aria-hidden="true">TR</span>
        <span class="brand-text">
          <span class="brand-title">Token Relay</span>
          <span class="brand-subtitle">Provider → Consumer 安全中转</span>
        </span>
      </div>
      <div class="connection-label" aria-live="polite">
        <span id="connection-dot" class="connection-dot" aria-hidden="true"></span>
        <span id="connection-text">尚未连接</span>
      </div>
    </div>
  </header>

  <main id="main-content" tabindex="-1">
    <section id="auth-view" class="auth-shell" aria-labelledby="login-title">
      <div class="auth-card">
        <p class="eyebrow">Administration</p>
        <h1 id="login-title">登录管理台</h1>
        <p class="muted">输入服务端配置的 Admin token。凭据只保存在当前浏览器标签会话中。</p>
        <form id="login-form" class="form-stack" novalidate>
          <div class="field">
            <label for="admin-token">Admin token</label>
            <input id="admin-token" name="adminToken" type="password" required minlength="1" autocomplete="current-password" spellcheck="false" placeholder="粘贴管理令牌">
            <p class="field-hint">请求将通过同源 HTTPS 发送，并使用 Bearer 认证。</p>
          </div>
          <button id="login-button" class="button button-primary" type="submit">登录并加载</button>
          <p id="login-status" class="form-status" role="alert" aria-live="assertive"></p>
        </form>
      </div>
    </section>

    <section id="dashboard-view" aria-labelledby="dashboard-title" hidden>
      <div class="page-heading">
        <div>
          <h1 id="dashboard-title">中转服务概览</h1>
          <p id="last-updated" class="muted">正在读取运行状态…</p>
        </div>
        <div class="button-row">
          <button id="refresh-button" class="button button-secondary" type="button">刷新数据</button>
          <button id="logout-button" class="button button-danger" type="button">退出登录</button>
        </div>
      </div>

      <div id="global-alert" class="alert" role="alert" hidden>
        <p id="global-alert-message"></p>
        <button id="retry-button" class="button button-secondary" type="button">重试</button>
      </div>

      <div id="loading-panel" class="loading-panel" role="status" aria-live="polite">
        <div class="loading-copy">
          <span class="spinner" aria-hidden="true"></span>
          <span>正在加载 Provider、Consumer 和请求记录…</span>
        </div>
      </div>

      <div id="dashboard-content" class="dashboard-content" aria-busy="false" hidden>
        <section class="summary-grid" aria-label="关键指标">
          <article class="summary-card">
            <p class="summary-card-label">Provider</p>
            <div id="summary-providers" class="summary-card-value">0</div>
            <p id="summary-providers-detail" class="summary-card-detail">0 个在线</p>
          </article>
          <article class="summary-card">
            <p class="summary-card-label">Consumer</p>
            <div id="summary-consumers" class="summary-card-value">0</div>
            <p id="summary-consumers-detail" class="summary-card-detail">0 个可用</p>
          </article>
          <article class="summary-card">
            <p class="summary-card-label">最近请求</p>
            <div id="summary-requests" class="summary-card-value">0</div>
            <p id="summary-requests-detail" class="summary-card-detail">暂无完成请求</p>
          </article>
          <article class="summary-card">
            <p class="summary-card-label">累计 Token</p>
            <div id="summary-tokens" class="summary-card-value">0</div>
            <p id="summary-tokens-detail" class="summary-card-detail">按已记录请求统计</p>
          </article>
        </section>

        <section class="management-grid" aria-label="创建配置">
          <article class="panel">
            <div class="panel-header">
              <div>
                <h2 id="create-provider-title">创建 Provider</h2>
                <p>生成 Provider SDK 首次连接所需的一次性令牌。</p>
              </div>
            </div>
            <div class="panel-body">
              <form id="provider-form" class="form-stack" aria-labelledby="create-provider-title">
                <div class="field">
                  <label for="provider-name">名称</label>
                  <input id="provider-name" name="name" type="text" required maxlength="80" autocomplete="off" placeholder="例如：上海工作站">
                  <p class="field-hint">使用能识别设备或提供者的名称。</p>
                </div>
                <button id="create-provider-button" class="button button-primary" type="submit">创建并生成令牌</button>
                <p id="provider-form-status" class="form-status" role="status" aria-live="polite"></p>
              </form>
            </div>
          </article>

          <article class="panel">
            <div class="panel-header">
              <div>
                <h2 id="create-consumer-title">创建 Consumer</h2>
                <p>绑定 Provider、模型、Token 总额度和并发限制。</p>
              </div>
            </div>
            <div class="panel-body">
              <form id="consumer-form" class="form-stack" aria-labelledby="create-consumer-title">
                <div class="form-grid">
                  <div class="field">
                    <label for="consumer-name">名称</label>
                    <input id="consumer-name" name="name" type="text" required maxlength="80" autocomplete="off" placeholder="例如：设计团队">
                  </div>
                  <div class="field">
                    <label for="consumer-provider">绑定 Provider</label>
                    <select id="consumer-provider" name="providerId" required>
                      <option value="">先创建 Provider</option>
                    </select>
                  </div>
                  <div class="field span-2">
                    <label for="consumer-model">模型名称</label>
                    <input id="consumer-model" name="model" type="text" required maxlength="160" list="provider-models" autocomplete="off" spellcheck="false" placeholder="例如：codex">
                    <datalist id="provider-models"></datalist>
                    <p class="field-hint">名称必须与 Provider SDK 上报的模型完全一致。</p>
                  </div>
                  <div class="field">
                    <label for="consumer-token-limit">Token 总额度</label>
                    <input id="consumer-token-limit" name="tokenLimit" type="number" required min="1" max="1000000000000" step="1" inputmode="numeric" value="100000">
                  </div>
                  <div class="field">
                    <label for="consumer-max-concurrent">最大并发</label>
                    <input id="consumer-max-concurrent" name="maxConcurrent" type="number" required min="1" max="1000" step="1" inputmode="numeric" value="1">
                  </div>
                </div>
                <button id="create-consumer-button" class="button button-primary" type="submit">创建并生成 API key</button>
                <p id="consumer-form-status" class="form-status" role="status" aria-live="polite"></p>
              </form>
            </div>
          </article>
        </section>

        <section class="panel" aria-labelledby="providers-title">
          <div class="panel-header">
            <div>
              <h2 id="providers-title">Provider 状态</h2>
              <p>在线状态、SDK 上报模型与当前并发。</p>
            </div>
          </div>
          <div id="providers-empty" class="empty-state" hidden>
            <div>
              <strong>尚无 Provider</strong>
              <p>先使用上方表单创建 Provider，再在提供者设备上启动 SDK。</p>
            </div>
          </div>
          <div id="providers-table-wrap" class="table-wrap">
            <table>
              <caption class="sr-only">Provider 在线状态列表</caption>
              <thead>
                <tr>
                  <th scope="col">Provider</th>
                  <th scope="col">状态</th>
                  <th scope="col">模型</th>
                  <th scope="col">并发</th>
                  <th scope="col">最后活动</th>
                </tr>
              </thead>
              <tbody id="providers-body"></tbody>
            </table>
          </div>
        </section>

        <section class="panel" aria-labelledby="consumers-title">
          <div class="panel-header">
            <div>
              <h2 id="consumers-title">Consumer 配额</h2>
              <p>API key 状态、Provider 绑定、模型和使用额度。</p>
            </div>
          </div>
          <div id="consumers-empty" class="empty-state" hidden>
            <div>
              <strong>尚无 Consumer</strong>
              <p>Provider 创建后，可为使用者分配模型、总额度和最大并发。</p>
            </div>
          </div>
          <div id="consumers-table-wrap" class="table-wrap">
            <table>
              <caption class="sr-only">Consumer 配额与状态列表</caption>
              <thead>
                <tr>
                  <th scope="col">Consumer</th>
                  <th scope="col">状态</th>
                  <th scope="col">绑定</th>
                  <th scope="col">Token 配额</th>
                  <th scope="col">并发</th>
                </tr>
              </thead>
              <tbody id="consumers-body"></tbody>
            </table>
          </div>
        </section>

        <section class="panel" aria-labelledby="requests-title">
          <div class="panel-header">
            <div>
              <h2 id="requests-title">最近请求</h2>
              <p>用于定位路由、配额、Provider 和模型执行问题。</p>
            </div>
          </div>
          <div id="requests-empty" class="empty-state" hidden>
            <div>
              <strong>尚无请求记录</strong>
              <p>Consumer 使用生成的 API key 调用 OpenAI-compatible 接口后，请求会显示在这里。</p>
            </div>
          </div>
          <div id="requests-table-wrap" class="table-wrap">
            <table>
              <caption class="sr-only">最近中转请求列表</caption>
              <thead>
                <tr>
                  <th scope="col">请求</th>
                  <th scope="col">Consumer / Provider</th>
                  <th scope="col">模型</th>
                  <th scope="col">状态</th>
                  <th scope="col">Token</th>
                  <th scope="col">时间</th>
                </tr>
              </thead>
              <tbody id="requests-body"></tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  </main>

  <dialog id="secret-dialog" aria-labelledby="secret-title" aria-describedby="secret-description">
    <div class="dialog-header">
      <h2 id="secret-title">保存一次性密钥</h2>
    </div>
    <div class="dialog-body">
      <p id="secret-description"></p>
      <p class="secret-warning"><strong>现在复制并安全保存。</strong> 关闭后管理台不会再次展示完整密钥，也不要通过聊天或工单发送。</p>
      <pre id="secret-value" class="secret-value" tabindex="0"></pre>
      <p id="secret-copy-status" class="form-status" role="status" aria-live="polite"></p>
    </div>
    <div class="dialog-footer">
      <button id="copy-secret-button" class="button button-primary" type="button">复制密钥</button>
      <button id="close-secret-button" class="button button-secondary" type="button">我已保存，关闭</button>
    </div>
  </dialog>

  <div id="toast" class="toast" role="status" aria-live="polite" hidden></div>

  <script>
    (function () {
      "use strict";

      var STORAGE_KEY = "token-relay.admin-token";
      var state = {
        adminToken: "",
        providers: [],
        consumers: [],
        requests: [],
        summary: {},
        loading: false,
        toastTimer: null
      };

      var elements = {
        authView: document.getElementById("auth-view"),
        dashboardView: document.getElementById("dashboard-view"),
        loginForm: document.getElementById("login-form"),
        adminToken: document.getElementById("admin-token"),
        loginButton: document.getElementById("login-button"),
        loginStatus: document.getElementById("login-status"),
        connectionDot: document.getElementById("connection-dot"),
        connectionText: document.getElementById("connection-text"),
        refreshButton: document.getElementById("refresh-button"),
        logoutButton: document.getElementById("logout-button"),
        lastUpdated: document.getElementById("last-updated"),
        globalAlert: document.getElementById("global-alert"),
        globalAlertMessage: document.getElementById("global-alert-message"),
        retryButton: document.getElementById("retry-button"),
        loadingPanel: document.getElementById("loading-panel"),
        dashboardContent: document.getElementById("dashboard-content"),
        providerForm: document.getElementById("provider-form"),
        providerName: document.getElementById("provider-name"),
        createProviderButton: document.getElementById("create-provider-button"),
        providerFormStatus: document.getElementById("provider-form-status"),
        consumerForm: document.getElementById("consumer-form"),
        consumerName: document.getElementById("consumer-name"),
        consumerProvider: document.getElementById("consumer-provider"),
        consumerModel: document.getElementById("consumer-model"),
        providerModels: document.getElementById("provider-models"),
        consumerTokenLimit: document.getElementById("consumer-token-limit"),
        consumerMaxConcurrent: document.getElementById("consumer-max-concurrent"),
        createConsumerButton: document.getElementById("create-consumer-button"),
        consumerFormStatus: document.getElementById("consumer-form-status"),
        summaryProviders: document.getElementById("summary-providers"),
        summaryProvidersDetail: document.getElementById("summary-providers-detail"),
        summaryConsumers: document.getElementById("summary-consumers"),
        summaryConsumersDetail: document.getElementById("summary-consumers-detail"),
        summaryRequests: document.getElementById("summary-requests"),
        summaryRequestsDetail: document.getElementById("summary-requests-detail"),
        summaryTokens: document.getElementById("summary-tokens"),
        summaryTokensDetail: document.getElementById("summary-tokens-detail"),
        providersBody: document.getElementById("providers-body"),
        providersEmpty: document.getElementById("providers-empty"),
        providersTableWrap: document.getElementById("providers-table-wrap"),
        consumersBody: document.getElementById("consumers-body"),
        consumersEmpty: document.getElementById("consumers-empty"),
        consumersTableWrap: document.getElementById("consumers-table-wrap"),
        requestsBody: document.getElementById("requests-body"),
        requestsEmpty: document.getElementById("requests-empty"),
        requestsTableWrap: document.getElementById("requests-table-wrap"),
        secretDialog: document.getElementById("secret-dialog"),
        secretTitle: document.getElementById("secret-title"),
        secretDescription: document.getElementById("secret-description"),
        secretValue: document.getElementById("secret-value"),
        secretCopyStatus: document.getElementById("secret-copy-status"),
        copySecretButton: document.getElementById("copy-secret-button"),
        closeSecretButton: document.getElementById("close-secret-button"),
        toast: document.getElementById("toast")
      };

      var numberFormatter = new Intl.NumberFormat("zh-CN");
      var dateFormatter = new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });

      elements.loginForm.addEventListener("submit", handleLogin);
      elements.refreshButton.addEventListener("click", function () {
        loadOverview(false);
      });
      elements.retryButton.addEventListener("click", function () {
        loadOverview(state.providers.length === 0 && state.consumers.length === 0);
      });
      elements.logoutButton.addEventListener("click", logout);
      elements.providerForm.addEventListener("submit", createProvider);
      elements.consumerForm.addEventListener("submit", createConsumer);
      elements.consumerProvider.addEventListener("change", renderProviderModelOptions);
      elements.copySecretButton.addEventListener("click", copySecret);
      elements.closeSecretButton.addEventListener("click", function () {
        elements.secretDialog.close();
      });
      elements.secretDialog.addEventListener("close", function () {
        elements.secretValue.textContent = "";
        elements.secretCopyStatus.textContent = "";
      });

      initialize();

      function initialize() {
        try {
          state.adminToken = sessionStorage.getItem(STORAGE_KEY) || "";
        } catch (_error) {
          state.adminToken = "";
        }
        if (state.adminToken) {
          showDashboard();
          loadOverview(true);
        } else {
          showLogin();
        }
      }

      async function handleLogin(event) {
        event.preventDefault();
        var token = elements.adminToken.value.trim();
        if (!token) {
          setFormStatus(elements.loginStatus, "请输入 Admin token。", true);
          elements.adminToken.focus();
          return;
        }

        elements.loginButton.disabled = true;
        elements.adminToken.disabled = true;
        setFormStatus(elements.loginStatus, "正在验证令牌…", false);
        state.adminToken = token;
        try {
          await loadOverviewData();
          try {
            sessionStorage.setItem(STORAGE_KEY, token);
          } catch (_error) {
            // A restricted browser may disallow sessionStorage; the in-memory token still works.
          }
          elements.adminToken.value = "";
          setFormStatus(elements.loginStatus, "", false);
          showDashboard();
          renderOverview();
          setReady(true);
        } catch (error) {
          state.adminToken = "";
          setReady(false);
          setFormStatus(elements.loginStatus, describeError(error, "登录失败，请检查 Admin token 和服务状态。"), true);
          elements.adminToken.focus();
          elements.adminToken.select();
        } finally {
          elements.loginButton.disabled = false;
          elements.adminToken.disabled = false;
        }
      }

      function showLogin() {
        elements.dashboardView.hidden = true;
        elements.authView.hidden = false;
        setReady(false);
        window.setTimeout(function () {
          elements.adminToken.focus();
        }, 0);
      }

      function showDashboard() {
        elements.authView.hidden = true;
        elements.dashboardView.hidden = false;
      }

      function logout() {
        try {
          sessionStorage.removeItem(STORAGE_KEY);
        } catch (_error) {
          // Nothing else is required when sessionStorage is unavailable.
        }
        state.adminToken = "";
        state.providers = [];
        state.consumers = [];
        state.requests = [];
        state.summary = {};
        elements.adminToken.value = "";
        hideGlobalError();
        showLogin();
      }

      async function loadOverview(initial) {
        if (state.loading) {
          return;
        }
        state.loading = true;
        elements.refreshButton.disabled = true;
        elements.refreshButton.textContent = "正在刷新…";
        elements.dashboardContent.setAttribute("aria-busy", "true");
        hideGlobalError();
        if (initial) {
          elements.loadingPanel.hidden = false;
          elements.dashboardContent.hidden = true;
        }

        try {
          await loadOverviewData();
          renderOverview();
          setReady(true);
        } catch (error) {
          setReady(false);
          if (error && error.status === 401) {
            try {
              sessionStorage.removeItem(STORAGE_KEY);
            } catch (_storageError) {
              // Ignore restricted browser storage errors.
            }
            state.adminToken = "";
            showLogin();
            setFormStatus(elements.loginStatus, "Admin token 已失效，请重新登录。", true);
            return;
          }
          showGlobalError(describeError(error, "无法加载管理数据，请稍后重试。"));
        } finally {
          state.loading = false;
          elements.loadingPanel.hidden = true;
          if (state.providers.length > 0 || state.consumers.length > 0 || state.requests.length > 0) {
            elements.dashboardContent.hidden = false;
          } else if (!elements.globalAlert.hidden) {
            elements.dashboardContent.hidden = true;
          } else {
            elements.dashboardContent.hidden = false;
          }
          elements.dashboardContent.setAttribute("aria-busy", "false");
          elements.refreshButton.disabled = false;
          elements.refreshButton.textContent = "刷新数据";
        }
      }

      async function loadOverviewData() {
        var data = await apiRequest("/admin/v1/overview");
        state.providers = extractList(data, "providers");
        state.consumers = extractList(data, "consumers");
        state.requests = extractList(data, "requests", "recent");
        state.summary = isObject(data && data.summary) ? data.summary : {};
      }

      async function createProvider(event) {
        event.preventDefault();
        if (!elements.providerForm.reportValidity()) {
          return;
        }
        var name = elements.providerName.value.trim();
        if (!name) {
          setFormStatus(elements.providerFormStatus, "请输入 Provider 名称。", true);
          elements.providerName.focus();
          return;
        }

        setFormBusy("provider", true);
        setFormStatus(elements.providerFormStatus, "正在创建 Provider…", false);
        try {
          var response = await apiRequest("/admin/v1/providers", {
            method: "POST",
            body: { name: name }
          });
          var provider = isObject(response.provider) ? response.provider : response;
          var token = firstString(response, ["providerToken", "token", "secret"])
            || firstString(response.credentials, ["providerToken", "token", "secret"]);
          elements.providerForm.reset();
          setFormStatus(elements.providerFormStatus, "Provider 已创建。", false);
          if (token) {
            showSecret(
              "Provider 连接令牌",
              "Provider “" + displayName(provider, name) + "” 已创建。将此令牌配置到该设备的 Provider SDK。",
              token
            );
          } else {
            showToast("Provider 已创建，但响应未包含一次性令牌，请检查服务端日志。");
          }
          await loadOverview(false);
        } catch (error) {
          setFormStatus(elements.providerFormStatus, describeError(error, "创建 Provider 失败。"), true);
        } finally {
          setFormBusy("provider", false);
        }
      }

      async function createConsumer(event) {
        event.preventDefault();
        if (!elements.consumerForm.reportValidity()) {
          return;
        }
        var payload = {
          name: elements.consumerName.value.trim(),
          providerId: elements.consumerProvider.value,
          model: elements.consumerModel.value.trim(),
          tokenLimit: Number(elements.consumerTokenLimit.value),
          maxConcurrent: Number(elements.consumerMaxConcurrent.value)
        };
        if (!payload.name || !payload.providerId || !payload.model) {
          setFormStatus(elements.consumerFormStatus, "请填写全部必填字段。", true);
          return;
        }
        if (!Number.isSafeInteger(payload.tokenLimit) || payload.tokenLimit < 1) {
          setFormStatus(elements.consumerFormStatus, "Token 总额度必须是大于 0 的整数。", true);
          elements.consumerTokenLimit.focus();
          return;
        }
        if (!Number.isSafeInteger(payload.maxConcurrent) || payload.maxConcurrent < 1) {
          setFormStatus(elements.consumerFormStatus, "最大并发必须是大于 0 的整数。", true);
          elements.consumerMaxConcurrent.focus();
          return;
        }

        setFormBusy("consumer", true);
        setFormStatus(elements.consumerFormStatus, "正在创建 Consumer…", false);
        try {
          var response = await apiRequest("/admin/v1/consumers", {
            method: "POST",
            body: payload
          });
          var consumer = isObject(response.consumer) ? response.consumer : response;
          var apiKey = firstString(response, ["apiKey", "consumerApiKey", "key", "secret"])
            || firstString(response.credentials, ["apiKey", "consumerApiKey", "key", "secret"]);
          elements.consumerName.value = "";
          elements.consumerModel.value = "";
          elements.consumerTokenLimit.value = "100000";
          elements.consumerMaxConcurrent.value = "1";
          setFormStatus(elements.consumerFormStatus, "Consumer 已创建。", false);
          if (apiKey) {
            showSecret(
              "Consumer API key",
              "Consumer “" + displayName(consumer, payload.name) + "” 已创建。此 key 用于 OpenAI-compatible 请求。",
              apiKey
            );
          } else {
            showToast("Consumer 已创建，但响应未包含一次性 API key，请检查服务端日志。");
          }
          await loadOverview(false);
        } catch (error) {
          setFormStatus(elements.consumerFormStatus, describeError(error, "创建 Consumer 失败。"), true);
        } finally {
          setFormBusy("consumer", false);
        }
      }

      async function apiRequest(path, options) {
        var requestOptions = options || {};
        var headers = {
          "accept": "application/json",
          "authorization": "Bearer " + state.adminToken
        };
        var fetchOptions = {
          method: requestOptions.method || "GET",
          headers: headers,
          cache: "no-store",
          credentials: "same-origin"
        };
        if (requestOptions.body !== undefined) {
          headers["content-type"] = "application/json";
          fetchOptions.body = JSON.stringify(requestOptions.body);
        }

        var response;
        try {
          response = await fetch(path, fetchOptions);
        } catch (_error) {
          var networkError = new Error("无法连接 Token Relay 服务。");
          networkError.status = 0;
          throw networkError;
        }

        var text = await response.text();
        var data = {};
        if (text) {
          try {
            data = JSON.parse(text);
          } catch (_error) {
            data = { message: text };
          }
        }

        if (!response.ok) {
          var message = firstString(data, ["message", "error", "detail"])
            || (isObject(data.error) ? firstString(data.error, ["message", "detail"]) : "")
            || "请求失败（HTTP " + response.status + "）。";
          var apiError = new Error(message);
          apiError.status = response.status;
          throw apiError;
        }
        return data;
      }

      function renderOverview() {
        renderSummary();
        renderProviderSelect();
        renderProviders();
        renderConsumers();
        renderRequests();
        hideGlobalError();
        elements.loadingPanel.hidden = true;
        elements.dashboardContent.hidden = false;
        elements.lastUpdated.textContent = "最近更新：" + dateFormatter.format(new Date());
      }

      function renderSummary() {
        var onlineProviders = state.providers.filter(providerOnline).length;
        var usableConsumers = state.consumers.filter(consumerUsable).length;
        var successfulRequests = state.requests.filter(function (request) {
          return statusKind(requestStatus(request)) === "success";
        }).length;
        var totalTokens = state.requests.reduce(function (total, request) {
          return total + requestTokens(request);
        }, 0);

        var providerCount = summaryNumber(["providers", "providerCount", "providersTotal", "totalProviders"], state.providers.length);
        var providerOnlineCount = summaryNumber(["onlineProviderCount", "providersOnline", "onlineProviders"], onlineProviders);
        var consumerCount = summaryNumber(["consumers", "consumerCount", "consumersTotal", "totalConsumers"], state.consumers.length);
        var consumerUsableCount = summaryNumber(["usableConsumerCount", "activeConsumers", "consumersActive"], usableConsumers);
        var requestCount = summaryNumber(["requests", "requestCount", "requestsTotal", "totalRequests"], state.requests.length);
        var successCount = summaryNumber(["completedRequests", "successfulRequestCount", "requestsSucceeded", "successRequests"], successfulRequests);
        var tokenCount = summaryNumber(["totalTokens", "tokensUsed", "consumedTokens"], totalTokens);

        elements.summaryProviders.textContent = formatNumber(providerCount);
        elements.summaryProvidersDetail.textContent = formatNumber(providerOnlineCount) + " 个在线";
        elements.summaryConsumers.textContent = formatNumber(consumerCount);
        elements.summaryConsumersDetail.textContent = formatNumber(consumerUsableCount) + " 个可用";
        elements.summaryRequests.textContent = formatNumber(requestCount);
        elements.summaryRequestsDetail.textContent = requestCount > 0
          ? formatNumber(successCount) + " 个成功"
          : "暂无完成请求";
        elements.summaryTokens.textContent = compactNumber(tokenCount);
        elements.summaryTokensDetail.textContent = "按已记录请求统计";
      }

      function renderProviderSelect() {
        var previous = elements.consumerProvider.value;
        elements.consumerProvider.replaceChildren();
        var placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = state.providers.length > 0 ? "选择 Provider" : "先创建 Provider";
        elements.consumerProvider.appendChild(placeholder);

        state.providers.forEach(function (provider) {
          var option = document.createElement("option");
          option.value = stringValue(provider.id);
          option.textContent = displayName(provider, option.value || "未命名 Provider")
            + (providerOnline(provider) ? "（在线）" : "（离线）");
          elements.consumerProvider.appendChild(option);
        });
        if (state.providers.some(function (provider) { return stringValue(provider.id) === previous; })) {
          elements.consumerProvider.value = previous;
        }
        var disabled = state.providers.length === 0;
        elements.consumerProvider.disabled = disabled;
        elements.createConsumerButton.disabled = disabled;
        renderProviderModelOptions();
      }

      function renderProviderModelOptions() {
        elements.providerModels.replaceChildren();
        var selectedId = elements.consumerProvider.value;
        var provider = state.providers.find(function (item) {
          return stringValue(item.id) === selectedId;
        });
        providerModels(provider).forEach(function (model) {
          var option = document.createElement("option");
          option.value = model;
          elements.providerModels.appendChild(option);
        });
      }

      function renderProviders() {
        elements.providersBody.replaceChildren();
        var empty = state.providers.length === 0;
        elements.providersEmpty.hidden = !empty;
        elements.providersTableWrap.hidden = empty;
        if (empty) {
          return;
        }

        state.providers.forEach(function (provider) {
          var row = document.createElement("tr");
          var nameCell = document.createElement("td");
          appendTextBlock(nameCell, displayName(provider, "未命名 Provider"), stringValue(provider.id));
          row.appendChild(nameCell);

          var statusCell = document.createElement("td");
          statusCell.appendChild(makeBadge(providerOnline(provider) ? "在线" : "离线", providerOnline(provider) ? "success" : "neutral"));
          row.appendChild(statusCell);

          var modelsCell = document.createElement("td");
          var models = providerModels(provider);
          if (models.length === 0) {
            modelsCell.appendChild(makeMutedText("尚未上报模型"));
          } else {
            var chips = document.createElement("div");
            chips.className = "chip-list";
            models.forEach(function (model) {
              var chip = document.createElement("span");
              chip.className = "chip";
              chip.textContent = model;
              chips.appendChild(chip);
            });
            modelsCell.appendChild(chips);
          }
          row.appendChild(modelsCell);

          var concurrencyCell = document.createElement("td");
          var active = firstNumber(provider, ["activeRequests", "active", "inFlight"], 0);
          var concurrency = firstNumber(provider, ["concurrency", "maxConcurrent", "capacity"], 0);
          concurrencyCell.textContent = concurrency > 0
            ? formatNumber(active) + " / " + formatNumber(concurrency)
            : formatNumber(active) + " 活跃";
          row.appendChild(concurrencyCell);

          var seenCell = document.createElement("td");
          var lastSeen = firstValue(provider, ["lastHeartbeatAt", "lastSeenAt", "connectedAt"]);
          var hasPresenceFields = Object.prototype.hasOwnProperty.call(provider, "lastHeartbeatAt")
            || Object.prototype.hasOwnProperty.call(provider, "connectedAt");
          seenCell.textContent = lastSeen
            ? formatDate(lastSeen)
            : hasPresenceFields
              ? "从未连接"
              : formatDate(firstValue(provider, ["updatedAt"]));
          row.appendChild(seenCell);
          elements.providersBody.appendChild(row);
        });
      }

      function renderConsumers() {
        elements.consumersBody.replaceChildren();
        var empty = state.consumers.length === 0;
        elements.consumersEmpty.hidden = !empty;
        elements.consumersTableWrap.hidden = empty;
        if (empty) {
          return;
        }

        state.consumers.forEach(function (consumer) {
          var row = document.createElement("tr");
          var nameCell = document.createElement("td");
          appendTextBlock(nameCell, displayName(consumer, "未命名 Consumer"), stringValue(consumer.id));
          row.appendChild(nameCell);

          var status = consumerStatus(consumer);
          var statusCell = document.createElement("td");
          statusCell.appendChild(makeBadge(status.label, status.kind));
          row.appendChild(statusCell);

          var bindingCell = document.createElement("td");
          var provider = providerForConsumer(consumer);
          var providerName = firstString(consumer, ["providerName"])
            || (provider ? displayName(provider, "") : "")
            || firstString(consumer, ["providerId"])
            || "未绑定";
          appendTextBlock(bindingCell, providerName, firstString(consumer, ["model", "modelName"]) || "未配置模型");
          row.appendChild(bindingCell);

          var quotaCell = document.createElement("td");
          quotaCell.appendChild(makeQuota(consumer));
          row.appendChild(quotaCell);

          var concurrencyCell = document.createElement("td");
          var active = firstNumber(consumer, ["activeRequests", "active", "inFlight"], 0);
          var maxConcurrent = firstNumber(consumer, ["maxConcurrent", "concurrency"], 0);
          concurrencyCell.textContent = formatNumber(active) + " / " + formatNumber(maxConcurrent);
          row.appendChild(concurrencyCell);

          elements.consumersBody.appendChild(row);
        });
      }

      function renderRequests() {
        elements.requestsBody.replaceChildren();
        var empty = state.requests.length === 0;
        elements.requestsEmpty.hidden = !empty;
        elements.requestsTableWrap.hidden = empty;
        if (empty) {
          return;
        }

        state.requests.forEach(function (request) {
          var row = document.createElement("tr");
          var idCell = document.createElement("td");
          appendTextBlock(
            idCell,
            shortId(firstString(request, ["id", "requestId", "jobId"]) || "未知请求"),
            formatDuration(firstNumber(request, ["durationMs", "latencyMs"], -1))
          );
          row.appendChild(idCell);

          var routeCell = document.createElement("td");
          var consumerName = firstString(request, ["consumerName", "consumerId"]) || "未知 Consumer";
          var providerName = firstString(request, ["providerName", "providerId"]) || "未知 Provider";
          appendTextBlock(routeCell, consumerName, providerName);
          row.appendChild(routeCell);

          var modelCell = document.createElement("td");
          modelCell.textContent = firstString(request, ["model", "modelName"]) || "—";
          row.appendChild(modelCell);

          var rawStatus = requestStatus(request);
          var statusCell = document.createElement("td");
          statusCell.appendChild(makeBadge(statusLabel(rawStatus), statusKind(rawStatus)));
          var errorMessage = requestError(request);
          if (errorMessage) {
            var errorText = document.createElement("span");
            errorText.className = "request-error";
            errorText.textContent = errorMessage;
            statusCell.appendChild(errorText);
          }
          row.appendChild(statusCell);

          var tokensCell = document.createElement("td");
          var total = requestTokens(request);
          var prompt = firstNumber(request, ["promptTokens"], nestedNumber(request, "usage", "promptTokens", 0));
          if (prompt === 0) {
            prompt = firstNumber(request, ["promptTokensEstimated"], 0);
          }
          var completion = firstNumber(request, ["completionTokens"], nestedNumber(request, "usage", "completionTokens", 0));
          appendTextBlock(
            tokensCell,
            formatNumber(total),
            total > 0 ? "输入 " + formatNumber(prompt) + " · 输出 " + formatNumber(completion) : "尚未结算"
          );
          row.appendChild(tokensCell);

          var timeCell = document.createElement("td");
          timeCell.textContent = formatDate(firstValue(request, ["createdAt", "startedAt", "updatedAt"]));
          row.appendChild(timeCell);

          elements.requestsBody.appendChild(row);
        });
      }

      function makeQuota(consumer) {
        var container = document.createElement("div");
        container.className = "quota";
        var used = firstNumber(consumer, ["tokensUsed", "usedTokens", "consumedTokens"], nestedNumber(consumer, "usage", "totalTokens", 0));
        var reserved = firstNumber(consumer, ["tokensReserved", "reservedTokens"], 0);
        var limit = firstNumber(consumer, ["tokenLimit", "limitTokens"], 0);
        var accounted = used + reserved;
        var percentage = limit > 0 ? Math.min(100, Math.max(0, accounted / limit * 100)) : 0;

        var label = document.createElement("span");
        label.className = "quota-label";
        label.textContent = limit > 0
          ? formatNumber(used) + (reserved > 0 ? " + 预留 " + formatNumber(reserved) : "")
            + " / " + formatNumber(limit) + "（" + Math.round(percentage) + "%）"
          : formatNumber(used) + " / 未设置额度";
        container.appendChild(label);

        var track = document.createElement("span");
        track.className = "progress-track";
        track.setAttribute("role", "progressbar");
        track.setAttribute("aria-label", "Token 配额使用量");
        track.setAttribute("aria-valuemin", "0");
        track.setAttribute("aria-valuemax", String(limit > 0 ? limit : Math.max(used, 1)));
        track.setAttribute("aria-valuenow", String(Math.min(accounted, limit > 0 ? limit : accounted)));
        var value = document.createElement("span");
        value.className = "progress-value";
        if (percentage >= 100) {
          value.classList.add("is-danger");
        } else if (percentage >= 80) {
          value.classList.add("is-warning");
        }
        value.style.width = percentage + "%";
        track.appendChild(value);
        container.appendChild(track);
        return container;
      }

      function makeBadge(label, kind) {
        var badge = document.createElement("span");
        badge.className = "badge badge-" + (kind || "neutral");
        badge.textContent = label;
        return badge;
      }

      function appendTextBlock(cell, title, subtitle) {
        var titleElement = document.createElement("span");
        titleElement.className = "cell-title";
        titleElement.textContent = title || "—";
        cell.appendChild(titleElement);
        if (subtitle) {
          var subtitleElement = document.createElement("span");
          subtitleElement.className = "cell-subtitle";
          subtitleElement.textContent = subtitle;
          cell.appendChild(subtitleElement);
        }
      }

      function makeMutedText(text) {
        var element = document.createElement("span");
        element.className = "muted";
        element.textContent = text;
        return element;
      }

      function providerOnline(provider) {
        var status = firstString(provider, ["status", "connectionStatus"]).toLowerCase();
        if (status) {
          return status === "online" || status === "connected" || status === "ready";
        }
        return provider.online === true || provider.connected === true;
      }

      function providerModels(provider) {
        if (!provider) {
          return [];
        }
        var models = firstValue(provider, ["models", "modelNames", "availableModels"]);
        if (Array.isArray(models)) {
          return models.map(stringValue).filter(Boolean);
        }
        if (typeof models === "string") {
          return models.split(",").map(function (model) { return model.trim(); }).filter(Boolean);
        }
        return [];
      }

      function consumerUsable(consumer) {
        return consumerStatus(consumer).kind === "success";
      }

      function consumerStatus(consumer) {
        var explicit = firstString(consumer, ["status", "state"]).toLowerCase();
        if (explicit === "disabled" || consumer.enabled === false || consumer.active === false) {
          return { label: "已停用", kind: "neutral" };
        }
        var used = firstNumber(consumer, ["tokensUsed", "usedTokens", "consumedTokens"], nestedNumber(consumer, "usage", "totalTokens", 0));
        var limit = firstNumber(consumer, ["tokenLimit", "limitTokens"], 0);
        if (explicit === "exhausted" || (limit > 0 && used >= limit)) {
          return { label: "额度耗尽", kind: "danger" };
        }
        var provider = providerForConsumer(consumer);
        if (explicit === "offline" || (provider && !providerOnline(provider))) {
          return { label: "Provider 离线", kind: "warning" };
        }
        if (explicit === "error" || explicit === "blocked") {
          return { label: "不可用", kind: "danger" };
        }
        return { label: "可用", kind: "success" };
      }

      function providerForConsumer(consumer) {
        var providerId = firstString(consumer, ["providerId"]);
        return state.providers.find(function (provider) {
          return stringValue(provider.id) === providerId;
        });
      }

      function requestStatus(request) {
        return firstString(request, ["status", "state"]) || "unknown";
      }

      function statusKind(status) {
        var normalized = String(status || "").toLowerCase();
        if (normalized === "success" || normalized === "completed" || normalized === "succeeded" || normalized === "done") {
          return "success";
        }
        if (normalized === "failed" || normalized === "error" || normalized === "timed_out" || normalized === "timeout" || normalized === "cancelled" || normalized === "canceled") {
          return "danger";
        }
        if (normalized === "running" || normalized === "pending" || normalized === "queued" || normalized === "leased") {
          return "warning";
        }
        return "neutral";
      }

      function statusLabel(status) {
        var normalized = String(status || "").toLowerCase();
        var labels = {
          success: "成功",
          completed: "成功",
          succeeded: "成功",
          done: "成功",
          failed: "失败",
          error: "失败",
          timed_out: "超时",
          timeout: "超时",
          cancelled: "已取消",
          canceled: "已取消",
          running: "处理中",
          pending: "等待中",
          queued: "排队中",
          leased: "已分配",
          unknown: "未知"
        };
        return labels[normalized] || status || "未知";
      }

      function requestTokens(request) {
        return firstNumber(
          request,
          ["totalTokens", "tokens"],
          nestedNumber(request, "usage", "totalTokens", nestedNumber(request, "usage", "total_tokens", 0))
        );
      }

      function requestError(request) {
        var direct = firstString(request, ["errorMessage", "message"]);
        if (direct) {
          return direct;
        }
        if (typeof request.error === "string") {
          return request.error;
        }
        return isObject(request.error) ? firstString(request.error, ["message", "detail", "code"]) : "";
      }

      function setFormBusy(kind, busy) {
        if (kind === "provider") {
          elements.createProviderButton.disabled = busy;
          elements.createProviderButton.textContent = busy ? "正在创建…" : "创建并生成令牌";
          elements.providerName.disabled = busy;
        } else {
          elements.createConsumerButton.disabled = busy || state.providers.length === 0;
          elements.createConsumerButton.textContent = busy ? "正在创建…" : "创建并生成 API key";
          [
            elements.consumerName,
            elements.consumerProvider,
            elements.consumerModel,
            elements.consumerTokenLimit,
            elements.consumerMaxConcurrent
          ].forEach(function (element) {
            element.disabled = busy;
          });
        }
      }

      function showSecret(title, description, secret) {
        elements.secretTitle.textContent = title;
        elements.secretDescription.textContent = description;
        elements.secretValue.textContent = secret;
        elements.secretCopyStatus.textContent = "";
        if (typeof elements.secretDialog.showModal === "function") {
          elements.secretDialog.showModal();
          elements.copySecretButton.focus();
        } else {
          window.alert(title + "\\n\\n" + secret);
        }
      }

      async function copySecret() {
        var secret = elements.secretValue.textContent || "";
        if (!secret) {
          setFormStatus(elements.secretCopyStatus, "没有可复制的密钥。", true);
          return;
        }
        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(secret);
          } else {
            var selection = window.getSelection();
            var range = document.createRange();
            range.selectNodeContents(elements.secretValue);
            selection.removeAllRanges();
            selection.addRange(range);
            if (!document.execCommand("copy")) {
              throw new Error("copy unavailable");
            }
            selection.removeAllRanges();
          }
          setFormStatus(elements.secretCopyStatus, "已复制到剪贴板。", false);
          elements.copySecretButton.textContent = "已复制";
          window.setTimeout(function () {
            elements.copySecretButton.textContent = "复制密钥";
          }, 1600);
        } catch (_error) {
          setFormStatus(elements.secretCopyStatus, "自动复制失败，请选中密钥后手动复制。", true);
          elements.secretValue.focus();
        }
      }

      function showGlobalError(message) {
        elements.globalAlertMessage.textContent = message;
        elements.globalAlert.hidden = false;
      }

      function hideGlobalError() {
        elements.globalAlert.hidden = true;
        elements.globalAlertMessage.textContent = "";
      }

      function setReady(ready) {
        elements.connectionDot.classList.toggle("is-ready", ready);
        elements.connectionText.textContent = ready ? "管理 API 已连接" : "尚未连接";
      }

      function setFormStatus(element, message, error) {
        element.textContent = message;
        element.classList.toggle("is-error", Boolean(error));
      }

      function showToast(message) {
        elements.toast.textContent = message;
        elements.toast.hidden = false;
        if (state.toastTimer) {
          window.clearTimeout(state.toastTimer);
        }
        state.toastTimer = window.setTimeout(function () {
          elements.toast.hidden = true;
        }, 5000);
      }

      function describeError(error, fallback) {
        if (error && typeof error.message === "string" && error.message.trim()) {
          return error.message;
        }
        return fallback;
      }

      function extractList(data, key, nestedKey) {
        var value = data && data[key];
        if (Array.isArray(value)) {
          return value.filter(isObject);
        }
        if (nestedKey && isObject(value) && Array.isArray(value[nestedKey])) {
          return value[nestedKey].filter(isObject);
        }
        return [];
      }

      function summaryNumber(keys, fallback) {
        return firstNumber(state.summary, keys, fallback);
      }

      function firstValue(object, keys) {
        if (!isObject(object)) {
          return undefined;
        }
        for (var index = 0; index < keys.length; index += 1) {
          if (object[keys[index]] !== undefined && object[keys[index]] !== null) {
            return object[keys[index]];
          }
        }
        return undefined;
      }

      function firstString(object, keys) {
        var value = firstValue(object, keys);
        return typeof value === "string" ? value.trim() : "";
      }

      function firstNumber(object, keys, fallback) {
        var value = firstValue(object, keys);
        var number = Number(value);
        return Number.isFinite(number) && number >= 0 ? number : fallback;
      }

      function nestedNumber(object, parentKey, childKey, fallback) {
        if (!isObject(object) || !isObject(object[parentKey])) {
          return fallback;
        }
        return firstNumber(object[parentKey], [childKey], fallback);
      }

      function stringValue(value) {
        return typeof value === "string" ? value : value === undefined || value === null ? "" : String(value);
      }

      function displayName(object, fallback) {
        return firstString(object, ["name", "displayName", "label"]) || fallback;
      }

      function isObject(value) {
        return typeof value === "object" && value !== null && !Array.isArray(value);
      }

      function formatNumber(value) {
        return numberFormatter.format(Math.max(0, Number(value) || 0));
      }

      function compactNumber(value) {
        var number = Math.max(0, Number(value) || 0);
        if (number < 10000) {
          return formatNumber(number);
        }
        return new Intl.NumberFormat("zh-CN", {
          notation: "compact",
          maximumFractionDigits: 1
        }).format(number);
      }

      function formatDate(value) {
        if (!value) {
          return "—";
        }
        var date = new Date(value);
        return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
      }

      function formatDuration(value) {
        if (!Number.isFinite(value) || value < 0) {
          return "";
        }
        if (value < 1000) {
          return Math.round(value) + " ms";
        }
        return (value / 1000).toFixed(value < 10000 ? 1 : 0) + " s";
      }

      function shortId(value) {
        var text = stringValue(value);
        return text.length > 18 ? text.slice(0, 8) + "…" + text.slice(-6) : text;
      }
    }());
  </script>
</body>
</html>`;
}
