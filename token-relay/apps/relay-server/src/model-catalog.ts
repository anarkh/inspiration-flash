export function modelCatalogHtml(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <meta name="color-scheme" content="light">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; object-src 'none'; frame-src 'none'; manifest-src 'none'">
  <title>Token Relay · 模型接入</title>
  <style>
    :root {
      color-scheme: light;
      --page: #f2f6f4;
      --surface: #ffffff;
      --surface-soft: #f7faf8;
      --ink: #10241c;
      --muted: #53675e;
      --border: #cdd9d3;
      --brand: #087a4e;
      --brand-dark: #055f3c;
      --brand-soft: #dff5e9;
      --focus: #d86d00;
      --danger: #a02c27;
      --danger-soft: #ffebe9;
      --warning: #724900;
      --warning-soft: #fff2cf;
      --neutral-soft: #edf1ef;
      --shadow: 0 16px 42px rgba(20, 52, 39, 0.09);
      --radius: 16px;
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
        radial-gradient(circle at 12% -8%, rgba(8, 122, 78, 0.14), transparent 25rem),
        radial-gradient(circle at 96% 8%, rgba(246, 177, 64, 0.11), transparent 22rem),
        var(--page);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 16px;
      line-height: 1.5;
    }

    button,
    input,
    select,
    textarea {
      min-height: 44px;
      font: inherit;
    }

    button,
    .button,
    .nav-link {
      display: inline-flex;
      min-height: 44px;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
      font-weight: 750;
      text-decoration: none;
    }

    button {
      padding: 0 1rem;
      border: 1px solid transparent;
      cursor: pointer;
    }

    button:disabled,
    input:disabled,
    select:disabled,
    textarea:disabled {
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

    .skip-link {
      position: fixed;
      z-index: 100;
      top: 0.75rem;
      left: 0.75rem;
      padding: 0.7rem 1rem;
      border-radius: 9px;
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
      background: #0d2c21;
      color: #ffffff;
    }

    .topbar-inner {
      display: flex;
      width: min(1180px, calc(100% - 2rem));
      min-height: 72px;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin: 0 auto;
    }

    .brand {
      display: flex;
      min-width: 0;
      align-items: center;
      gap: 0.75rem;
      color: #ffffff;
      text-decoration: none;
    }

    .brand-mark {
      display: grid;
      width: 40px;
      height: 40px;
      flex: 0 0 40px;
      place-items: center;
      border: 1px solid rgba(255, 255, 255, 0.38);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.1);
      font-weight: 850;
      letter-spacing: -0.06em;
    }

    .brand-copy {
      display: grid;
      min-width: 0;
      gap: 0.05rem;
    }

    .brand-title {
      overflow: hidden;
      font-size: 1.02rem;
      font-weight: 800;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .brand-subtitle {
      color: #c4ded3;
      font-size: 0.78rem;
    }

    .top-actions,
    .nav {
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }

    .nav-link {
      padding: 0 0.8rem;
      color: #d9e9e2;
      white-space: nowrap;
    }

    .nav-link:hover,
    .nav-link[aria-current="page"] {
      background: rgba(255, 255, 255, 0.12);
      color: #ffffff;
    }

    .session-link {
      border: 1px solid rgba(255, 255, 255, 0.36);
      color: #ffffff;
    }

    main {
      width: min(1180px, calc(100% - 2rem));
      margin: 0 auto;
      padding: 2rem 0 4rem;
    }

    h1,
    h2,
    p {
      margin-top: 0;
    }

    h1 {
      max-width: 18ch;
      margin-bottom: 0.6rem;
      font-size: clamp(2rem, 5vw, 3.35rem);
      line-height: 1.08;
      letter-spacing: -0.04em;
    }

    h2 {
      margin-bottom: 0.35rem;
      font-size: 1.2rem;
      line-height: 1.3;
    }

    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(270px, 0.42fr);
      gap: 1.2rem;
      align-items: end;
      margin-bottom: 1rem;
      padding: clamp(1.35rem, 4vw, 2.3rem);
      border-radius: 22px;
      background:
        radial-gradient(circle at 8% 0%, rgba(80, 220, 150, 0.18), transparent 19rem),
        linear-gradient(135deg, #123d2f, #09271d);
      color: #ffffff;
      box-shadow: var(--shadow);
    }

    .eyebrow {
      margin-bottom: 0.65rem;
      color: #8ce4b7;
      font-size: 0.78rem;
      font-weight: 850;
      letter-spacing: 0.09em;
      text-transform: uppercase;
    }

    .hero-summary {
      max-width: 47rem;
      margin-bottom: 0;
      color: #d7e8e1;
      font-size: 1.02rem;
    }

    .hero-note {
      padding: 1rem;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.08);
    }

    .hero-note strong,
    .hero-note span {
      display: block;
    }

    .hero-note span {
      margin-top: 0.25rem;
      color: #d7e8e1;
      font-size: 0.84rem;
    }

    .notice {
      margin-bottom: 1rem;
      padding: 0.85rem 1rem;
      border: 1px solid var(--border);
      border-radius: 11px;
      background: var(--surface);
      color: var(--muted);
    }

    .notice.is-error {
      border-color: #edb8b3;
      background: var(--danger-soft);
      color: var(--danger);
    }

    .notice-link {
      display: inline-flex;
      min-height: 44px;
      align-items: center;
      margin-top: 0.5rem;
      color: var(--brand-dark);
      font-weight: 800;
      text-underline-offset: 0.2rem;
    }

    .filters {
      display: grid;
      gap: 0.85rem;
      margin-bottom: 1rem;
      padding: 1rem;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      box-shadow: 0 7px 22px rgba(20, 52, 39, 0.05);
    }

    .search-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 0.75rem;
      align-items: end;
    }

    .field {
      display: grid;
      min-width: 0;
      gap: 0.35rem;
    }

    label {
      font-size: 0.88rem;
      font-weight: 750;
    }

    input,
    select,
    textarea {
      width: 100%;
      padding: 0.62rem 0.72rem;
      border: 1px solid #aebdb6;
      border-radius: 9px;
      background: #ffffff;
      color: var(--ink);
    }

    .filter-reset,
    .secondary {
      border-color: #aebdb6;
      background: var(--surface);
      color: var(--ink);
    }

    .filter-reset:hover,
    .secondary:hover:not(:disabled) {
      background: var(--surface-soft);
    }

    .family-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .family-filter {
      min-height: 44px;
      padding: 0 0.85rem;
      border-color: #b9c8c0;
      background: var(--surface-soft);
      color: var(--ink);
    }

    .family-filter[aria-pressed="true"] {
      border-color: var(--brand);
      background: var(--brand-soft);
      color: var(--brand-dark);
    }

    .results-heading {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 1rem;
      margin: 1.15rem 0 0.75rem;
    }

    .results-heading p {
      margin-bottom: 0;
      color: var(--muted);
    }

    .catalog-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.9rem;
    }

    .model-card {
      display: flex;
      min-width: 0;
      flex-direction: column;
      padding: 1.05rem;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      box-shadow: 0 7px 22px rgba(20, 52, 39, 0.05);
    }

    .card-top,
    .status-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.7rem;
    }

    .family-chip,
    .badge {
      display: inline-flex;
      min-height: 1.65rem;
      align-items: center;
      padding: 0.15rem 0.55rem;
      border-radius: 999px;
      background: var(--neutral-soft);
      color: #43534c;
      font-size: 0.74rem;
      font-weight: 800;
      white-space: nowrap;
    }

    .badge.success {
      background: var(--brand-soft);
      color: var(--brand-dark);
    }

    .badge.warning {
      background: var(--warning-soft);
      color: var(--warning);
    }

    .badge.danger {
      background: var(--danger-soft);
      color: var(--danger);
    }

    .model-name {
      margin: 0.8rem 0 0.3rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 1.04rem;
      overflow-wrap: anywhere;
    }

    .provider-name {
      margin-bottom: 0.9rem;
      color: var(--muted);
      font-size: 0.88rem;
      overflow-wrap: anywhere;
    }

    .status-row {
      justify-content: flex-start;
      flex-wrap: wrap;
      margin-bottom: 0.65rem;
    }

    .availability-note {
      min-height: 2.7rem;
      margin-bottom: 1rem;
      color: var(--muted);
      font-size: 0.82rem;
    }

    .card-action {
      width: 100%;
      margin-top: auto;
    }

    .primary {
      border-color: var(--brand);
      background: var(--brand);
      color: #ffffff;
    }

    .primary:hover:not(:disabled) {
      border-color: var(--brand-dark);
      background: var(--brand-dark);
    }

    .state-card {
      padding: 2rem 1rem;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      text-align: center;
    }

    .state-card p {
      margin-bottom: 0;
      color: var(--muted);
    }

    .spinner {
      display: inline-block;
      width: 1.35rem;
      height: 1.35rem;
      margin-bottom: 0.7rem;
      border: 3px solid #bad8ca;
      border-top-color: var(--brand);
      border-radius: 999px;
      animation: spin 0.85s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    dialog {
      width: min(calc(100% - 2rem), 620px);
      max-height: calc(100vh - 2rem);
      padding: 0;
      border: 1px solid var(--border);
      border-radius: 18px;
      background: var(--surface);
      color: var(--ink);
      box-shadow: 0 24px 70px rgba(9, 36, 25, 0.28);
      overflow: auto;
    }

    dialog::backdrop {
      background: rgba(7, 28, 20, 0.62);
      backdrop-filter: blur(2px);
    }

    .dialog-header {
      padding: 1.15rem 1.25rem 0.85rem;
      border-bottom: 1px solid #e2e9e5;
    }

    .dialog-header p {
      margin-bottom: 0;
      color: var(--muted);
      overflow-wrap: anywhere;
    }

    .dialog-body {
      padding: 1.05rem 1.25rem 1.25rem;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.85rem;
    }

    .field.full {
      grid-column: 1 / -1;
    }

    .field-hint,
    .form-status {
      margin: 0;
      color: var(--muted);
      font-size: 0.78rem;
    }

    .form-status {
      min-height: 1.3rem;
      margin-top: 0.75rem;
    }

    .form-status.is-error {
      color: var(--danger);
    }

    .dialog-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 0.65rem;
      margin-top: 1rem;
    }

    .secret-warning {
      padding: 0.72rem 0.85rem;
      border-radius: 9px;
      background: var(--warning-soft);
      color: var(--warning);
      font-size: 0.84rem;
      font-weight: 700;
    }

    .secret-value {
      min-height: 7rem;
      resize: none;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.82rem;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }

    @media (max-width: 900px) {
      .hero {
        grid-template-columns: 1fr;
      }

      .catalog-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 650px) {
      .topbar-inner,
      main {
        width: min(100% - 1.2rem, 1180px);
      }

      .topbar-inner {
        display: grid;
        min-height: auto;
        padding: 0.65rem 0;
      }

      .top-actions {
        width: 100%;
        justify-content: space-between;
        gap: 0.25rem;
        overflow-x: auto;
      }

      .nav-link {
        padding-inline: 0.6rem;
        font-size: 0.88rem;
      }

      .brand-subtitle {
        display: none;
      }

      main {
        padding-top: 1.2rem;
      }

      .search-row,
      .catalog-grid,
      .form-grid {
        grid-template-columns: 1fr;
      }

      .field.full {
        grid-column: auto;
      }

      .filter-reset {
        width: 100%;
      }
    }

    @media (max-width: 430px) {
      .hero {
        border-radius: 16px;
      }

      .dialog-actions {
        display: grid;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        scroll-behavior: auto !important;
      }

      .spinner {
        animation: none;
      }
    }
  </style>
</head>
<body>
  <a class="skip-link" href="#main-content">跳到主要内容</a>
  <header class="topbar">
    <div class="topbar-inner">
      <a class="brand" href="/" aria-label="Token Relay 首页">
        <span class="brand-mark" aria-hidden="true">TR</span>
        <span class="brand-copy">
          <span class="brand-title">Token Relay</span>
          <span class="brand-subtitle">模型额度中转</span>
        </span>
      </a>
      <div class="top-actions">
        <nav class="nav" aria-label="主导航">
          <a class="nav-link" href="/">首页</a>
          <a class="nav-link" href="/models" aria-current="page">模型接入</a>
          <a class="nav-link" href="/admin">管理台</a>
        </nav>
        <a id="session-action" class="nav-link session-link" href="/?auth=login&amp;return_to=%2Fmodels">登录 / 注册</a>
      </div>
    </div>
  </header>

  <main id="main-content" tabindex="-1">
    <div id="global-status" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>
    <section class="hero" aria-labelledby="page-title">
      <div>
        <p class="eyebrow">Model access</p>
        <h1 id="page-title">选择一个模型，创建专属访问凭据</h1>
        <p class="hero-summary">无需登录即可浏览已开放的模型。登录后选择可接入模型，设置 Token 额度与并发限制，完整 API Key 只会展示一次。</p>
      </div>
      <aside class="hero-note" aria-label="安全说明">
        <strong>明确绑定，不会静默改派</strong>
        <span>每个 Consumer 固定绑定一个 Provider 与模型，调用仍受实时在线状态、额度和并发约束。</span>
      </aside>
    </section>

    <div id="page-notice" class="notice" role="status" aria-live="polite" aria-atomic="true" hidden></div>

    <section class="filters" aria-labelledby="filters-title">
      <h2 id="filters-title" class="sr-only">筛选模型</h2>
      <div class="search-row">
        <div class="field">
          <label for="model-search">搜索模型或 Provider</label>
          <input id="model-search" type="search" autocomplete="off" placeholder="例如：GPT、Claude、Qwen">
        </div>
        <button id="reset-filters" class="filter-reset" type="button">清除筛选</button>
      </div>
      <div id="family-filters" class="family-filters" aria-label="按模型家族筛选">
        <button class="family-filter" type="button" data-family="all" aria-pressed="true">全部</button>
        <button class="family-filter" type="button" data-family="gpt" aria-pressed="false">GPT</button>
        <button class="family-filter" type="button" data-family="claude" aria-pressed="false">Claude</button>
        <button class="family-filter" type="button" data-family="gemini" aria-pressed="false">Gemini</button>
        <button class="family-filter" type="button" data-family="deepseek" aria-pressed="false">DeepSeek</button>
        <button class="family-filter" type="button" data-family="qwen" aria-pressed="false">Qwen</button>
        <button class="family-filter" type="button" data-family="doubao" aria-pressed="false">Doubao</button>
        <button class="family-filter" type="button" data-family="other" aria-pressed="false">Other</button>
      </div>
    </section>

    <div class="results-heading">
      <div>
        <h2>可接入模型</h2>
        <p id="results-count" role="status" aria-live="polite">正在加载模型…</p>
      </div>
    </div>

    <div id="loading-state" class="state-card" role="status">
      <span class="spinner" aria-hidden="true"></span>
      <p>正在加载模型目录…</p>
    </div>
    <div id="error-state" class="state-card" hidden>
      <h2>暂时无法加载模型目录</h2>
      <p id="error-detail"></p>
      <button id="retry-button" class="primary" type="button">重新加载</button>
    </div>
    <div id="empty-state" class="state-card" hidden>
      <h2>没有符合条件的模型</h2>
      <p>尝试清除搜索词或切换模型家族。</p>
    </div>
    <section id="catalog-grid" class="catalog-grid" aria-label="模型目录" hidden></section>
  </main>

  <dialog id="access-dialog" aria-labelledby="access-title" aria-describedby="access-description">
    <div class="dialog-header">
      <h2 id="access-title">创建 Consumer</h2>
      <p id="access-description"></p>
    </div>
    <div class="dialog-body">
      <form id="access-form">
        <div class="form-grid">
          <div class="field full">
            <label for="consumer-name">凭据名称</label>
            <input id="consumer-name" name="name" type="text" required maxlength="128" autocomplete="off" aria-describedby="consumer-name-hint">
            <p id="consumer-name-hint" class="field-hint">用于区分调用环境，不会影响模型输出。</p>
          </div>
          <div class="field">
            <label for="consumer-token-limit">Token 总额度</label>
            <input id="consumer-token-limit" name="tokenLimit" type="number" required min="1" max="1000000000000" step="1" inputmode="numeric" value="100000">
          </div>
          <div class="field">
            <label for="consumer-max-concurrent">最大并发</label>
            <input id="consumer-max-concurrent" name="maxConcurrent" type="number" required min="1" max="1024" step="1" inputmode="numeric" value="1">
          </div>
        </div>
        <p id="access-form-status" class="form-status" role="status" aria-live="polite" aria-atomic="true"></p>
        <div class="dialog-actions">
          <button id="cancel-access-button" class="secondary" type="button">取消</button>
          <button id="create-access-button" class="primary" type="submit">创建并生成 API Key</button>
        </div>
      </form>
    </div>
  </dialog>

  <dialog id="secret-dialog" aria-labelledby="secret-title" aria-describedby="secret-description">
    <div class="dialog-header">
      <h2 id="secret-title">Consumer API Key</h2>
      <p id="secret-description">完整凭据只显示这一次。</p>
    </div>
    <div class="dialog-body">
      <p class="secret-warning">请现在复制并安全保存。关闭后无法再次查看完整 API Key。</p>
      <label for="secret-value">一次性 API Key</label>
      <textarea id="secret-value" class="secret-value" readonly spellcheck="false" autocomplete="off"></textarea>
      <p id="copy-status" class="form-status" role="status" aria-live="polite" aria-atomic="true"></p>
      <div class="dialog-actions">
        <button id="copy-secret-button" class="primary" type="button">复制 API Key</button>
        <button id="close-secret-button" class="secondary" type="button">我已保存，关闭</button>
      </div>
    </div>
  </dialog>

  <noscript>
    <div class="state-card">
      <h2>模型目录需要启用 JavaScript</h2>
      <p>加载实时模型状态和创建访问凭据需要 JavaScript。</p>
    </div>
  </noscript>

  <script>
    "use strict";

    (function () {
      var LOGIN_PATH = "/?auth=login&return_to=%2Fmodels";
      var state = {
        models: [],
        session: { authenticated: false },
        family: "all",
        selectedModel: null,
        returnFocus: null,
        secretPending: false,
        accessBusy: false
      };

      var elements = {
        sessionAction: document.getElementById("session-action"),
        pageNotice: document.getElementById("page-notice"),
        globalStatus: document.getElementById("global-status"),
        modelSearch: document.getElementById("model-search"),
        resetFilters: document.getElementById("reset-filters"),
        familyFilters: document.getElementById("family-filters"),
        resultsCount: document.getElementById("results-count"),
        loadingState: document.getElementById("loading-state"),
        errorState: document.getElementById("error-state"),
        errorDetail: document.getElementById("error-detail"),
        retryButton: document.getElementById("retry-button"),
        emptyState: document.getElementById("empty-state"),
        catalogGrid: document.getElementById("catalog-grid"),
        accessDialog: document.getElementById("access-dialog"),
        accessDescription: document.getElementById("access-description"),
        accessForm: document.getElementById("access-form"),
        consumerName: document.getElementById("consumer-name"),
        consumerTokenLimit: document.getElementById("consumer-token-limit"),
        consumerMaxConcurrent: document.getElementById("consumer-max-concurrent"),
        accessFormStatus: document.getElementById("access-form-status"),
        cancelAccessButton: document.getElementById("cancel-access-button"),
        createAccessButton: document.getElementById("create-access-button"),
        secretDialog: document.getElementById("secret-dialog"),
        secretValue: document.getElementById("secret-value"),
        copyStatus: document.getElementById("copy-status"),
        copySecretButton: document.getElementById("copy-secret-button"),
        closeSecretButton: document.getElementById("close-secret-button")
      };

      elements.modelSearch.addEventListener("input", renderCatalog);
      elements.resetFilters.addEventListener("click", resetFilters);
      elements.familyFilters.addEventListener("click", selectFamily);
      elements.retryButton.addEventListener("click", loadPage);
      elements.accessForm.addEventListener("submit", createConsumer);
      elements.cancelAccessButton.addEventListener("click", function () {
        if (!state.accessBusy) {
          elements.accessDialog.close();
        }
      });
      elements.accessDialog.addEventListener("cancel", function (event) {
        if (state.accessBusy) {
          event.preventDefault();
        }
      });
      elements.copySecretButton.addEventListener("click", copySecret);
      elements.closeSecretButton.addEventListener("click", function () {
        elements.secretDialog.close();
      });
      elements.secretDialog.addEventListener("close", clearSecret);
      elements.secretDialog.addEventListener("cancel", function (event) {
        if (elements.secretValue.value) {
          event.preventDefault();
          elements.copyStatus.textContent = "请先保存 API Key，再使用下方按钮关闭。";
        }
      });
      elements.accessDialog.addEventListener("close", function () {
        state.selectedModel = null;
        elements.accessFormStatus.textContent = "";
        elements.accessFormStatus.classList.remove("is-error");
        if (!state.secretPending) {
          restoreFocus();
        }
      });

      loadPage();

      async function loadPage() {
        elements.loadingState.hidden = false;
        elements.errorState.hidden = true;
        elements.emptyState.hidden = true;
        elements.catalogGrid.hidden = true;
        elements.resultsCount.textContent = "正在加载模型…";
        hideNotice();

        var results = await Promise.allSettled([
          requestJson("/catalog/v1/models"),
          requestJson("/auth/v1/session")
        ]);

        if (results[1].status === "fulfilled" && isObject(results[1].value)) {
          state.session = results[1].value;
        } else {
          state.session = { authenticated: false };
        }
        renderSession();

        if (results[0].status === "rejected") {
          elements.loadingState.hidden = true;
          elements.errorState.hidden = false;
          elements.errorDetail.textContent = describeError(
            results[0].reason,
            "请稍后重试。"
          );
          elements.resultsCount.textContent = "模型目录加载失败";
          announce("模型目录加载失败。");
          return;
        }

        var payload = isObject(results[0].value) ? results[0].value : {};
        state.models = Array.isArray(payload.models)
          ? payload.models.filter(validModel)
          : [];
        elements.loadingState.hidden = true;
        renderCatalog();
        announce("模型目录已加载。");
      }

      function renderSession() {
        if (state.session.authenticated === true) {
          var user = isObject(state.session.user) ? state.session.user : {};
          elements.sessionAction.href = "/";
          elements.sessionAction.textContent = firstString(user, ["displayName", "username"])
            || "我的账户";
          return;
        }
        elements.sessionAction.href = LOGIN_PATH;
        elements.sessionAction.textContent = "登录 / 注册";
        elements.sessionAction.removeAttribute("aria-disabled");
      }

      function selectFamily(event) {
        var button = event.target.closest("button[data-family]");
        if (!button || !elements.familyFilters.contains(button)) {
          return;
        }
        state.family = button.dataset.family || "all";
        elements.familyFilters.querySelectorAll("button[data-family]").forEach(
          function (item) {
            item.setAttribute(
              "aria-pressed",
              item === button ? "true" : "false"
            );
          }
        );
        renderCatalog();
      }

      function resetFilters() {
        elements.modelSearch.value = "";
        state.family = "all";
        elements.familyFilters.querySelectorAll("button[data-family]").forEach(
          function (button) {
            button.setAttribute(
              "aria-pressed",
              button.dataset.family === "all" ? "true" : "false"
            );
          }
        );
        renderCatalog();
        elements.modelSearch.focus();
      }

      function renderCatalog() {
        var query = elements.modelSearch.value.trim().toLocaleLowerCase("zh-CN");
        var filtered = state.models.filter(function (model) {
          var family = normalizedFamily(model.family, model.id);
          var matchesFamily = state.family === "all" || family === state.family;
          var haystack = [
            firstString(model, ["id"]),
            firstString(model, ["providerName"]),
            firstString(model, ["family"])
          ].join(" ").toLocaleLowerCase("zh-CN");
          return matchesFamily && (!query || haystack.includes(query));
        });

        elements.catalogGrid.replaceChildren();
        filtered.forEach(function (model) {
          elements.catalogGrid.appendChild(modelCard(model));
        });
        elements.resultsCount.textContent = "共 " + formatNumber(filtered.length)
          + " 个模型"
          + (filtered.length !== state.models.length
            ? "，目录总计 " + formatNumber(state.models.length) + " 个"
            : "");
        elements.emptyState.hidden = filtered.length > 0;
        elements.catalogGrid.hidden = filtered.length === 0;
      }

      function modelCard(model) {
        var article = document.createElement("article");
        article.className = "model-card";

        var top = document.createElement("div");
        top.className = "card-top";
        var family = document.createElement("span");
        family.className = "family-chip";
        family.textContent = familyLabel(normalizedFamily(model.family, model.id));
        top.appendChild(family);
        if (model.ownedByCurrentUser === true) {
          top.appendChild(badge("我的 Provider", "success"));
        }
        article.appendChild(top);

        var title = document.createElement("h2");
        title.className = "model-name";
        title.textContent = firstString(model, ["id"]) || "未命名模型";
        article.appendChild(title);

        var provider = document.createElement("p");
        provider.className = "provider-name";
        provider.textContent = "Provider · "
          + (firstString(model, ["providerName"]) || "未命名");
        article.appendChild(provider);

        var statuses = document.createElement("div");
        statuses.className = "status-row";
        statuses.appendChild(model.online === true
          ? badge("在线", "success")
          : badge("离线", "warning"));
        statuses.appendChild(model.available === true
          ? badge("当前可调用", "success")
          : badge("暂不可调用", "warning"));
        article.appendChild(statuses);

        var note = document.createElement("p");
        note.className = "availability-note";
        note.textContent = availabilityText(model);
        article.appendChild(note);

        var action = document.createElement("button");
        action.className = "primary card-action";
        action.type = "button";
        action.textContent = actionLabel(model);
        action.disabled = model.bindable !== true;
        if (!action.disabled) {
          action.addEventListener("click", function () {
            beginAccess(model, action);
          });
        }
        article.appendChild(action);
        return article;
      }

      function beginAccess(model, trigger) {
        if (state.session.authenticated !== true) {
          window.location.assign(LOGIN_PATH);
          return;
        }
        state.selectedModel = model;
        state.returnFocus = trigger;
        var modelName = firstString(model, ["id"]);
        var providerName = firstString(model, ["providerName"]) || "Provider";
        elements.accessDescription.textContent = modelName + " · " + providerName;
        elements.accessForm.reset();
        elements.consumerName.value = clippedName(providerName + " · " + modelName);
        elements.accessFormStatus.textContent = "";
        elements.accessFormStatus.classList.remove("is-error");
        elements.accessDialog.showModal();
        window.setTimeout(function () {
          elements.consumerName.focus();
          elements.consumerName.select();
        }, 0);
      }

      async function createConsumer(event) {
        event.preventDefault();
        if (!state.selectedModel || !elements.accessForm.reportValidity()) {
          return;
        }
        var body = {
          name: elements.consumerName.value.trim(),
          providerId: firstString(state.selectedModel, ["providerId"]),
          model: firstString(state.selectedModel, ["id"]),
          tokenLimit: positiveInteger(elements.consumerTokenLimit.value),
          maxConcurrent: positiveInteger(elements.consumerMaxConcurrent.value)
        };
        if (!body.name || !body.providerId || !body.model
          || body.tokenLimit === null || body.maxConcurrent === null) {
          setFormStatus("请填写有效的名称、额度和并发数。", true);
          return;
        }

        setCreateBusy(true);
        setFormStatus("正在创建 Consumer…", false);
        try {
          var response = await requestJson("/account/v1/consumers", {
            method: "POST",
            body: JSON.stringify(body)
          });
          var apiKey = isObject(response) ? firstString(response, ["apiKey"]) : "";
          if (!apiKey) {
            throw new Error("Consumer 已创建，但服务端未返回一次性 API Key。");
          }
          state.secretPending = true;
          elements.accessDialog.close();
          elements.secretValue.value = apiKey;
          elements.copyStatus.textContent = "";
          elements.secretDialog.showModal();
          window.setTimeout(function () {
            elements.secretValue.focus();
            elements.secretValue.select();
          }, 0);
          showNotice("Consumer 已创建。请立即保存一次性 API Key。", false);
        } catch (error) {
          if (error && error.status === 401) {
            state.session.authenticated = false;
            setCreateBusy(false);
            renderSession();
            renderCatalog();
            state.returnFocus = elements.sessionAction;
            showLoginNotice("登录已过期，请重新登录后创建访问凭据。");
            elements.accessDialog.close();
            announce("登录已过期，请重新登录。");
          } else {
            setFormStatus(describeError(error, "创建 Consumer 失败。"), true);
          }
        } finally {
          setCreateBusy(false);
        }
      }

      function setCreateBusy(busy) {
        state.accessBusy = busy;
        elements.createAccessButton.disabled = busy;
        elements.cancelAccessButton.disabled = busy;
        elements.consumerName.disabled = busy;
        elements.consumerTokenLimit.disabled = busy;
        elements.consumerMaxConcurrent.disabled = busy;
        elements.accessDialog.setAttribute("aria-busy", busy ? "true" : "false");
        elements.createAccessButton.setAttribute("aria-busy", busy ? "true" : "false");
        elements.createAccessButton.textContent = busy
          ? "正在创建…"
          : "创建并生成 API Key";
      }

      function setFormStatus(message, isError) {
        elements.accessFormStatus.textContent = message;
        elements.accessFormStatus.classList.toggle("is-error", isError);
        elements.accessFormStatus.setAttribute("role", isError ? "alert" : "status");
      }

      async function copySecret() {
        var secret = elements.secretValue.value;
        if (!secret) {
          return;
        }
        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(secret);
          } else {
            elements.secretValue.focus();
            elements.secretValue.select();
            if (!document.execCommand("copy")) {
              throw new Error("copy unavailable");
            }
          }
          elements.copyStatus.textContent = "已复制到剪贴板。";
          elements.copySecretButton.textContent = "已复制";
        } catch (_error) {
          elements.copyStatus.textContent = "无法自动复制，请选中上方凭据并手动复制。";
          elements.secretValue.focus();
          elements.secretValue.select();
        }
      }

      function clearSecret() {
        elements.secretValue.value = "";
        elements.copyStatus.textContent = "";
        elements.copySecretButton.textContent = "复制 API Key";
        state.secretPending = false;
        restoreFocus();
      }

      function restoreFocus() {
        var target = state.returnFocus;
        state.returnFocus = null;
        if (target && document.contains(target) && !target.disabled) {
          target.focus();
        }
      }

      function actionLabel(model) {
        if (model.bindable !== true) {
          return "暂不可接入";
        }
        return state.session.authenticated === true
          ? "创建访问凭据"
          : "登录后接入";
      }

      function availabilityText(model) {
        if (model.available === true) {
          return model.bindable === true
            ? "Provider 已就绪，可创建凭据并开始调用。"
            : "Provider 当前在线，但尚未向你开放接入。";
        }
        var reason = firstString(model, ["unavailableReason"]);
        var labels = {
          provider_offline: "Provider 当前离线；已有绑定会在其恢复后继续生效。",
          no_models: "Provider 尚未上报可调用模型。",
          model_unavailable: "此模型当前未由 Provider 实时上报。",
          provider_at_capacity: "Provider 当前并发已满；创建的凭据可稍后使用。",
          provider_quota_exhausted: "Provider Token 额度已用尽。",
          quota_exhausted: "Provider Token 额度已用尽。",
          at_capacity: "Provider 当前并发已满；创建的凭据可稍后使用。"
        };
        return labels[reason] || "当前运行条件尚未满足，请稍后重试。";
      }

      function normalizedFamily(value, modelId) {
        var explicit = String(value || "").trim().toLowerCase();
        var text = (explicit + " " + String(modelId || "")).toLowerCase();
        if (text.includes("gpt") || text.includes("openai") || text.includes("codex")) {
          return "gpt";
        }
        if (text.includes("claude") || text.includes("anthropic")) {
          return "claude";
        }
        if (text.includes("gemini")) {
          return "gemini";
        }
        if (text.includes("deepseek")) {
          return "deepseek";
        }
        if (text.includes("qwen") || text.includes("通义")) {
          return "qwen";
        }
        if (text.includes("doubao") || text.includes("豆包")) {
          return "doubao";
        }
        return "other";
      }

      function familyLabel(family) {
        var labels = {
          gpt: "GPT",
          claude: "Claude",
          gemini: "Gemini",
          deepseek: "DeepSeek",
          qwen: "Qwen",
          doubao: "Doubao",
          other: "Other"
        };
        return labels[family] || "Other";
      }

      function badge(label, kind) {
        var element = document.createElement("span");
        element.className = "badge" + (kind ? " " + kind : "");
        element.textContent = label;
        return element;
      }

      function validModel(value) {
        return isObject(value)
          && Boolean(firstString(value, ["key"]))
          && Boolean(firstString(value, ["providerId"]))
          && Boolean(firstString(value, ["id"]));
      }

      function clippedName(value) {
        var text = String(value || "").trim();
        return text.length > 128 ? text.slice(0, 128) : text;
      }

      function positiveInteger(value) {
        var parsed = Number(value);
        return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
      }

      function showNotice(message, isError) {
        elements.pageNotice.hidden = false;
        elements.pageNotice.classList.toggle("is-error", isError);
        elements.pageNotice.setAttribute("role", isError ? "alert" : "status");
        elements.pageNotice.textContent = message;
      }

      function showLoginNotice(message) {
        elements.pageNotice.hidden = false;
        elements.pageNotice.classList.add("is-error");
        elements.pageNotice.setAttribute("role", "alert");
        var text = document.createElement("span");
        text.textContent = message;
        var link = document.createElement("a");
        link.className = "notice-link";
        link.href = LOGIN_PATH;
        link.textContent = "登录 / 注册";
        elements.pageNotice.replaceChildren(text, document.createElement("br"), link);
      }

      function hideNotice() {
        elements.pageNotice.hidden = true;
        elements.pageNotice.classList.remove("is-error");
        elements.pageNotice.textContent = "";
      }

      function announce(message) {
        elements.globalStatus.textContent = "";
        window.setTimeout(function () {
          elements.globalStatus.textContent = message;
        }, 20);
      }

      async function requestJson(path, options) {
        var requestOptions = options || {};
        var headers = { "Accept": "application/json" };
        if (requestOptions.body !== undefined) {
          headers["Content-Type"] = "application/json";
        }
        var response = await fetch(path, {
          method: requestOptions.method || "GET",
          credentials: "same-origin",
          headers: headers,
          body: requestOptions.body
        });
        var payload = null;
        var text = await response.text();
        if (text) {
          try {
            payload = JSON.parse(text);
          } catch (_error) {
            payload = null;
          }
        }
        if (!response.ok) {
          var requestError = new Error(
            errorMessage(payload) || "请求失败（HTTP " + response.status + "）。"
          );
          requestError.status = response.status;
          throw requestError;
        }
        return payload || {};
      }

      function errorMessage(payload) {
        if (!isObject(payload)) {
          return "";
        }
        if (typeof payload.message === "string" && payload.message.trim()) {
          return payload.message.trim();
        }
        if (typeof payload.error === "string" && payload.error.trim()) {
          return payload.error.trim();
        }
        if (isObject(payload.error)
          && typeof payload.error.message === "string"
          && payload.error.message.trim()) {
          return payload.error.message.trim();
        }
        return "";
      }

      function describeError(error, fallback) {
        return error && typeof error.message === "string" && error.message.trim()
          ? error.message.trim()
          : fallback;
      }

      function isObject(value) {
        return value !== null && typeof value === "object" && !Array.isArray(value);
      }

      function firstString(object, keys) {
        if (!isObject(object)) {
          return "";
        }
        for (var index = 0; index < keys.length; index += 1) {
          var value = object[keys[index]];
          if (typeof value === "string" && value.trim()) {
            return value.trim();
          }
        }
        return "";
      }

      function formatNumber(value) {
        return new Intl.NumberFormat("zh-CN", {
          maximumFractionDigits: 0
        }).format(Math.max(0, Number(value) || 0));
      }
    }());
  </script>
</body>
</html>`;
}
