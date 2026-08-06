export function userDashboardHtml(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <meta name="color-scheme" content="light">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; object-src 'none'; frame-src 'none'; manifest-src 'none'">
  <title>Token Relay · 模型额度中转</title>
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
      --warning: #7a4d00;
      --warning-soft: #fff2cf;
      --neutral-soft: #edf1ef;
      --shadow: 0 16px 42px rgba(20, 52, 39, 0.09);
      --radius: 16px;
    }

    * {
      box-sizing: border-box;
    }

    html {
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
    .top-link {
      display: inline-flex;
      min-height: 44px;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
      font-weight: 750;
      text-decoration: none;
    }

    button {
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

    .top-actions {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    .top-auth-actions {
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }

    .session-indicator {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      color: #d9e9e2;
      font-size: 0.85rem;
      white-space: nowrap;
    }

    .session-dot {
      width: 0.62rem;
      height: 0.62rem;
      border-radius: 999px;
      background: #8ba198;
      box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.08);
    }

    .session-dot.is-ready {
      background: #50dc96;
    }

    .session-dot.is-warning {
      background: #ffc65c;
    }

    .top-link {
      padding: 0 0.85rem;
      border: 1px solid rgba(255, 255, 255, 0.32);
      color: #ffffff;
    }

    .top-link:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .top-auth-button {
      min-width: 4rem;
      padding: 0 0.9rem;
      border-color: rgba(255, 255, 255, 0.42);
      background: transparent;
      color: #ffffff;
      white-space: nowrap;
    }

    .top-auth-button:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.12);
    }

    .top-auth-button.is-primary {
      border-color: #ffffff;
      background: #ffffff;
      color: #0d2c21;
    }

    .top-auth-button.is-primary:hover:not(:disabled) {
      border-color: #dff5e9;
      background: #dff5e9;
    }

    main {
      width: min(1180px, calc(100% - 2rem));
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
      margin-bottom: 0.45rem;
      font-size: clamp(1.7rem, 4vw, 2.35rem);
      line-height: 1.16;
      letter-spacing: -0.03em;
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

    .public-home {
      display: grid;
      gap: 1.15rem;
    }

    .public-hero {
      display: block;
      padding: clamp(1.4rem, 4vw, 2.8rem);
      border: 1px solid rgba(255, 255, 255, 0.13);
      border-radius: 24px;
      background:
        radial-gradient(circle at 8% 0%, rgba(80, 220, 150, 0.18), transparent 19rem),
        linear-gradient(135deg, #123d2f, #09271d);
      color: #ffffff;
      box-shadow: var(--shadow);
    }

    .hero-copy {
      max-width: 54rem;
      padding: 0.4rem 0;
    }

    .hero-kicker {
      margin-bottom: 0.8rem;
      color: #8ce4b7;
      font-size: 0.78rem;
      font-weight: 850;
      letter-spacing: 0.09em;
      text-transform: uppercase;
    }

    .hero-title {
      max-width: 17ch;
      margin-bottom: 0.85rem;
      font-size: clamp(2rem, 5.5vw, 3.65rem);
      line-height: 1.05;
      letter-spacing: -0.045em;
    }

    .hero-summary {
      max-width: 43rem;
      margin-bottom: 1.25rem;
      color: #d7e8e1;
      font-size: clamp(1rem, 2vw, 1.12rem);
    }

    .hero-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .hero-badge {
      padding: 0.36rem 0.68rem;
      border: 1px solid rgba(255, 255, 255, 0.22);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
      color: #edf8f3;
      font-size: 0.78rem;
      font-weight: 720;
    }

    .hero-link {
      display: inline-flex;
      min-height: 44px;
      align-items: center;
      margin-top: 1.3rem;
      color: #ffffff;
      font-weight: 780;
      text-underline-offset: 0.24rem;
    }

    .hero-link:hover {
      color: #a6edc8;
    }

    .public-section {
      padding: clamp(1.25rem, 3vw, 1.8rem);
      border: 1px solid var(--border);
      border-radius: 20px;
      background: var(--surface);
      box-shadow: 0 7px 22px rgba(20, 52, 39, 0.05);
    }

    .section-heading {
      display: grid;
      max-width: 50rem;
      gap: 0.25rem;
      margin-bottom: 1.15rem;
    }

    .section-eyebrow {
      margin-bottom: 0.15rem;
      color: var(--brand-dark);
      font-size: 0.75rem;
      font-weight: 850;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .section-heading p:last-child {
      margin-bottom: 0;
      color: var(--muted);
    }

    .role-grid,
    .capability-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.85rem;
    }

    .role-card,
    .capability-card {
      min-width: 0;
      padding: 1.05rem;
      border: 1px solid #dbe5e0;
      border-radius: 14px;
      background: var(--surface-soft);
    }

    .role-heading {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      margin-bottom: 0.65rem;
    }

    .role-index {
      display: grid;
      width: 2rem;
      height: 2rem;
      flex: 0 0 2rem;
      place-items: center;
      border-radius: 9px;
      background: var(--brand-soft);
      color: var(--brand-dark);
      font-size: 0.78rem;
      font-weight: 850;
    }

    .role-heading h3,
    .capability-card h3 {
      margin: 0;
    }

    .role-card p,
    .capability-card p {
      margin-bottom: 0;
      color: var(--muted);
      font-size: 0.9rem;
    }

    .capability-card {
      background: #ffffff;
    }

    .capability-card h3 {
      margin-bottom: 0.38rem;
    }

    .integration-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.65fr);
      gap: 1rem;
      align-items: stretch;
    }

    .endpoint-list {
      display: grid;
      gap: 0.65rem;
      margin: 0;
    }

    .endpoint-row {
      display: grid;
      grid-template-columns: minmax(13rem, 0.7fr) minmax(0, 1fr);
      gap: 1rem;
      align-items: center;
      padding: 0.78rem 0.9rem;
      border: 1px solid #dbe5e0;
      border-radius: 12px;
      background: var(--surface-soft);
    }

    .endpoint-row dt,
    .endpoint-row dd {
      margin: 0;
    }

    .endpoint-row code {
      color: var(--brand-dark);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.78rem;
      font-weight: 760;
      overflow-wrap: anywhere;
    }

    .endpoint-row dd {
      color: var(--muted);
      font-size: 0.86rem;
    }

    .boundary-note {
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 1.1rem;
      border-radius: 14px;
      background: #0d2c21;
      color: #ffffff;
    }

    .boundary-note h3 {
      margin-bottom: 0.45rem;
    }

    .boundary-note p {
      margin-bottom: 0;
      color: #cfe1d9;
      font-size: 0.88rem;
    }

    .state-shell {
      display: grid;
      min-height: calc(100vh - 190px);
      place-items: center;
      padding: 1rem 0 3rem;
    }

    .state-card {
      width: min(100%, 560px);
      padding: clamp(1.4rem, 5vw, 2.25rem);
      border: 1px solid var(--border);
      border-radius: 20px;
      background: var(--surface);
      box-shadow: var(--shadow);
    }

    .state-card .eyebrow {
      margin-bottom: 0.7rem;
      color: var(--brand-dark);
      font-size: 0.78rem;
      font-weight: 850;
      letter-spacing: 0.09em;
      text-transform: uppercase;
    }

    .state-card p {
      color: var(--muted);
    }

    .state-card .detail {
      padding: 0.85rem 1rem;
      border-radius: 10px;
      background: var(--neutral-soft);
      color: var(--ink);
      overflow-wrap: anywhere;
    }

    .state-card .detail.is-error {
      background: var(--danger-soft);
      color: var(--danger);
    }

    .state-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.7rem;
      margin-top: 1.25rem;
    }

    .auth-tabs {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.35rem;
      margin: 1.1rem 0 1.2rem;
      padding: 0.3rem;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--surface-soft);
    }

    .auth-tab {
      width: 100%;
      border-color: transparent;
      background: transparent;
      color: var(--muted);
    }

    .auth-tab[aria-selected="true"] {
      border-color: var(--border);
      background: var(--surface);
      color: var(--brand-dark);
      box-shadow: 0 3px 10px rgba(20, 52, 39, 0.08);
    }

    .auth-panel {
      min-width: 0;
    }

    .auth-form {
      display: grid;
      gap: 0.9rem;
    }

    .auth-form .form-actions {
      margin-top: 0.1rem;
    }

    .auth-form .form-actions button {
      width: 100%;
    }

    .auth-form-status {
      min-height: 1.4rem;
      margin: -0.1rem 0 0;
    }

    .auth-hint {
      margin: 0;
      color: var(--muted);
      font-size: 0.76rem;
    }

    .button,
    button {
      padding: 0 1rem;
      border: 1px solid transparent;
    }

    .button-primary,
    button.primary {
      border-color: var(--brand);
      background: var(--brand);
      color: #ffffff;
    }

    .button-primary:hover,
    button.primary:hover:not(:disabled) {
      border-color: var(--brand-dark);
      background: var(--brand-dark);
    }

    .button-secondary,
    button.secondary {
      border-color: #aebdb6;
      background: var(--surface);
      color: var(--ink);
    }

    .button-secondary:hover,
    button.secondary:hover:not(:disabled) {
      background: var(--surface-soft);
    }

    .loading-row {
      display: flex;
      align-items: center;
      gap: 0.8rem;
    }

    .spinner {
      width: 1.35rem;
      height: 1.35rem;
      flex: 0 0 auto;
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

    @media (prefers-reduced-motion: reduce) {
      .spinner {
        animation: none;
      }
    }

    .account-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1.5rem;
      margin-bottom: 1.4rem;
    }

    .account-header p {
      margin-bottom: 0;
    }

    .account-actions {
      display: flex;
      flex: 0 0 auto;
      align-items: center;
      gap: 0.65rem;
    }

    .expiry {
      color: var(--muted);
      font-size: 0.82rem;
      text-align: right;
    }

    .notice {
      margin-bottom: 1.2rem;
      padding: 0.8rem 1rem;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--surface);
      color: var(--muted);
    }

    .notice.is-error {
      border-color: #edb8b3;
      background: var(--danger-soft);
      color: var(--danger);
    }

    .public-account-notice {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin: 0;
    }

    .public-account-notice strong,
    .public-account-notice span {
      display: block;
    }

    .public-account-notice span {
      margin-top: 0.18rem;
    }

    .public-notice-actions {
      display: flex;
      flex: 0 0 auto;
      flex-wrap: wrap;
      gap: 0.55rem;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.9rem;
      margin-bottom: 1.15rem;
    }

    .summary-card {
      min-width: 0;
      padding: 1rem;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: var(--surface);
      box-shadow: 0 7px 22px rgba(20, 52, 39, 0.05);
    }

    .summary-label {
      margin-bottom: 0.4rem;
      color: var(--muted);
      font-size: 0.82rem;
      font-weight: 700;
    }

    .summary-value {
      margin: 0;
      overflow: hidden;
      font-size: clamp(1.35rem, 3vw, 1.8rem);
      font-weight: 850;
      letter-spacing: -0.03em;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .summary-detail {
      margin: 0.2rem 0 0;
      color: var(--muted);
      font-size: 0.78rem;
    }

    .create-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
      margin-bottom: 1.15rem;
    }

    .panel {
      min-width: 0;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      box-shadow: 0 7px 22px rgba(20, 52, 39, 0.05);
    }

    .panel-header {
      padding: 1rem 1.1rem 0.85rem;
      border-bottom: 1px solid #e2e9e5;
    }

    .panel-header p {
      margin-bottom: 0;
      color: var(--muted);
      font-size: 0.86rem;
    }

    .panel-body {
      padding: 1.05rem 1.1rem 1.15rem;
    }

    .provider-guide {
      margin-bottom: 1.15rem;
      overflow: hidden;
    }

    .provider-guide-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1.25rem;
      padding: clamp(1.1rem, 3vw, 1.55rem);
      background:
        radial-gradient(circle at 96% 0%, rgba(80, 220, 150, 0.18), transparent 18rem),
        linear-gradient(135deg, #123d2f, #0a2d21);
      color: #ffffff;
    }

    .provider-guide-header h2 {
      max-width: 28ch;
      margin-bottom: 0.45rem;
      font-size: clamp(1.35rem, 3vw, 1.85rem);
      line-height: 1.2;
      letter-spacing: -0.025em;
    }

    .provider-guide-header p {
      max-width: 52rem;
      margin-bottom: 0;
      color: #d7e8e1;
    }

    .guide-eyebrow {
      margin-bottom: 0.45rem !important;
      color: #8ce4b7 !important;
      font-size: 0.75rem;
      font-weight: 850;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .guide-ready-check {
      display: grid;
      flex: 0 0 auto;
      gap: 0.35rem;
      padding: 0.8rem 0.9rem;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.08);
      color: #e6f6ef;
      font-size: 0.82rem;
      font-weight: 750;
      white-space: nowrap;
    }

    .provider-guide-body {
      display: grid;
      gap: 1rem;
      padding: 1.1rem;
    }

    .guide-steps {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.75rem;
      padding: 0;
      margin: 0;
      list-style: none;
    }

    .guide-step {
      min-width: 0;
      padding: 0.9rem;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--surface-soft);
    }

    .guide-step-number {
      display: grid;
      width: 1.75rem;
      height: 1.75rem;
      margin-bottom: 0.55rem;
      place-items: center;
      border-radius: 999px;
      background: var(--brand-soft);
      color: var(--brand-dark);
      font-size: 0.78rem;
      font-weight: 900;
    }

    .guide-step strong,
    .guide-step span {
      display: block;
    }

    .guide-step span:last-child {
      margin-top: 0.22rem;
      color: var(--muted);
      font-size: 0.8rem;
    }

    .guide-code-grid {
      display: grid;
      grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
      gap: 0.85rem;
    }

    .guide-code-card {
      min-width: 0;
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--surface);
    }

    .guide-code-card.is-wide {
      grid-column: 1 / -1;
    }

    .guide-code-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.7rem 0.8rem;
      border-bottom: 1px solid var(--border);
      background: var(--surface-soft);
    }

    .guide-code-header h3 {
      margin: 0;
      font-size: 0.9rem;
    }

    .guide-copy-button {
      min-height: 36px;
      padding: 0 0.7rem;
      font-size: 0.78rem;
    }

    .guide-code {
      max-width: 100%;
      margin: 0;
      padding: 0.9rem;
      overflow-x: auto;
      background: #0d2c21;
      color: #e8f5ef;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.78rem;
      line-height: 1.55;
      tab-size: 2;
      white-space: pre;
      -webkit-overflow-scrolling: touch;
    }

    .guide-meta {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.85rem 0.95rem;
      border-radius: 11px;
      background: var(--brand-soft);
      color: var(--brand-dark);
    }

    .guide-meta p {
      margin: 0;
      font-size: 0.83rem;
    }

    .guide-copy-status {
      min-height: 1.3rem;
      margin: 0;
      color: var(--brand-dark);
      font-size: 0.8rem;
      text-align: right;
    }

    .guide-details {
      border-top: 1px solid var(--border);
      padding-top: 0.9rem;
    }

    .guide-details summary {
      min-height: 44px;
      cursor: pointer;
      color: var(--brand-dark);
      font-weight: 800;
    }

    .guide-details p {
      margin: 0.45rem 0 0;
      color: var(--muted);
      font-size: 0.83rem;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.9rem;
    }

    .field {
      display: grid;
      min-width: 0;
      gap: 0.35rem;
    }

    .field.full {
      grid-column: 1 / -1;
    }

    .checkbox-row {
      display: flex;
      min-height: 44px;
      align-items: flex-start;
      gap: 0.7rem;
      padding: 0.75rem;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--surface-soft);
    }

    .checkbox-row input {
      width: 1.15rem;
      min-height: 1.15rem;
      margin: 0.15rem 0 0;
      accent-color: var(--brand);
    }

    .checkbox-copy {
      display: grid;
      gap: 0.15rem;
    }

    .checkbox-copy small {
      color: var(--muted);
      font-weight: 500;
    }

    label {
      font-size: 0.88rem;
      font-weight: 750;
    }

    .field-hint {
      margin: 0;
      color: var(--muted);
      font-size: 0.76rem;
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

    input:invalid:not(:placeholder-shown) {
      border-color: var(--danger);
    }

    input[aria-invalid="true"] {
      border-color: var(--danger);
      box-shadow: 0 0 0 2px rgba(160, 44, 39, 0.1);
    }

    .form-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-top: 1rem;
    }

    .form-status {
      min-height: 1.3rem;
      margin: 0.7rem 0 0;
      color: var(--muted);
      font-size: 0.82rem;
    }

    .form-status.is-error {
      color: var(--danger);
    }

    .resource-stack {
      display: grid;
      gap: 1rem;
    }

    .table-wrap {
      width: 100%;
      overflow-x: auto;
      border-radius: 0 0 var(--radius) var(--radius);
      outline: none;
      -webkit-overflow-scrolling: touch;
    }

    table {
      width: 100%;
      min-width: 760px;
      border-collapse: collapse;
      font-size: 0.86rem;
    }

    th,
    td {
      padding: 0.78rem 1rem;
      border-bottom: 1px solid #e3eae6;
      text-align: left;
      vertical-align: top;
    }

    td {
      overflow-wrap: anywhere;
    }

    th {
      background: var(--surface-soft);
      color: var(--muted);
      font-size: 0.75rem;
      font-weight: 850;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    tbody tr:last-child td {
      border-bottom: 0;
    }

    tbody tr:hover {
      background: #fbfdfc;
    }

    .cell-main {
      display: block;
      color: var(--ink);
      font-weight: 720;
    }

    .cell-sub {
      display: block;
      max-width: 26rem;
      margin-top: 0.18rem;
      color: var(--muted);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.74rem;
      overflow-wrap: anywhere;
    }

    .badge {
      display: inline-flex;
      min-height: 1.65rem;
      align-items: center;
      padding: 0.15rem 0.55rem;
      border-radius: 999px;
      background: var(--neutral-soft);
      color: #43534c;
      font-size: 0.75rem;
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

    .empty {
      padding: 1.45rem 1.1rem;
      text-align: center;
    }

    .empty strong {
      display: block;
      margin-bottom: 0.25rem;
    }

    .empty p {
      margin: 0;
      color: var(--muted);
      font-size: 0.86rem;
    }

    dialog {
      width: min(calc(100% - 2rem), 620px);
      max-height: calc(100dvh - 2rem);
      padding: 0;
      border: 1px solid var(--border);
      border-radius: 18px;
      background: var(--surface);
      color: var(--ink);
      box-shadow: 0 24px 70px rgba(9, 36, 25, 0.28);
    }

    dialog::backdrop {
      background: rgba(7, 28, 20, 0.62);
      backdrop-filter: blur(2px);
    }

    .dialog-header {
      padding: 1.2rem 1.25rem 0.85rem;
      border-bottom: 1px solid #e2e9e5;
    }

    .dialog-title-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
    }

    .dialog-title-row h2 {
      margin: 0;
      font-size: 1.35rem;
    }

    .dialog-close {
      width: 44px;
      min-width: 44px;
      height: 44px;
      min-height: 44px;
      padding: 0;
      border-color: var(--border);
      border-radius: 999px;
      background: var(--surface-soft);
      color: var(--ink);
      font-size: 1.4rem;
      line-height: 1;
    }

    .dialog-close:hover:not(:disabled) {
      border-color: #aebdb6;
      background: var(--neutral-soft);
    }

    .dialog-header p {
      margin-bottom: 0;
      color: var(--muted);
    }

    .dialog-body {
      padding: 1.1rem 1.25rem 1.25rem;
    }

    #auth-dialog {
      width: min(calc(100% - 2rem), 520px);
      overflow: hidden;
    }

    #auth-dialog .dialog-body {
      max-height: calc(100dvh - 10.5rem);
      overflow-y: auto;
      overscroll-behavior: contain;
    }

    #auth-dialog .auth-tabs {
      margin-top: 0;
    }

    .secret-warning {
      margin-bottom: 0.8rem;
      padding: 0.7rem 0.85rem;
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

    #secret-dialog .dialog-body {
      max-height: calc(100dvh - 9.5rem);
      overflow-y: auto;
      overscroll-behavior: contain;
    }

    #secret-dialog.is-provider-secret {
      width: min(calc(100% - 2rem), 700px);
    }

    .provider-secret-next {
      margin-top: 0.9rem;
      padding: 0.9rem;
      border: 1px solid #bad8ca;
      border-radius: 11px;
      background: var(--brand-soft);
    }

    .provider-secret-next h3 {
      margin: 0 0 0.5rem;
      color: var(--brand-dark);
      font-size: 1rem;
    }

    .provider-secret-next ol {
      display: grid;
      gap: 0.32rem;
      padding-left: 1.3rem;
      margin: 0;
      color: var(--ink);
      font-size: 0.82rem;
    }

    .provider-secret-next p {
      margin: 0.65rem 0 0;
      color: var(--brand-dark);
      font-size: 0.8rem;
      font-weight: 720;
    }

    .dialog-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 0.7rem;
      margin-top: 0.9rem;
    }

    @media (max-width: 900px) {
      .public-hero,
      .integration-grid {
        grid-template-columns: 1fr;
      }

      .role-grid,
      .capability-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .role-card:last-child {
        grid-column: 1 / -1;
      }

      .summary-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .create-grid {
        grid-template-columns: 1fr;
      }

      .guide-steps {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .guide-code-grid {
        grid-template-columns: 1fr;
      }

      .guide-code-card.is-wide {
        grid-column: auto;
      }
    }

    @media (max-width: 650px) {
      .topbar-inner,
      main {
        width: min(100% - 1.2rem, 1180px);
      }

      .topbar-inner {
        display: grid;
        min-height: 64px;
        gap: 0.45rem;
        padding: 0.55rem 0 0.7rem;
      }

      .brand-subtitle {
        display: none;
      }

      .top-actions {
        grid-column: 1 / -1;
        width: 100%;
        gap: 0.4rem;
        flex-wrap: wrap;
      }

      .session-indicator {
        order: 3;
        margin-left: auto;
      }

      .top-auth-actions {
        order: 0;
      }

      .top-link {
        order: 1;
      }

      main {
        padding-top: 1.2rem;
      }

      .public-home {
        gap: 0.8rem;
      }

      .public-hero,
      .public-section {
        border-radius: 16px;
      }

      .role-grid,
      .capability-grid {
        grid-template-columns: 1fr;
      }

      .role-card:last-child {
        grid-column: auto;
      }

      .endpoint-row {
        grid-template-columns: 1fr;
        gap: 0.25rem;
      }

      .account-header {
        display: grid;
        gap: 1rem;
      }

      .public-account-notice {
        align-items: stretch;
        flex-direction: column;
      }

      .account-actions {
        width: 100%;
        justify-content: space-between;
      }

      .expiry {
        text-align: left;
      }

      .form-grid {
        grid-template-columns: 1fr;
      }

      .field.full {
        grid-column: auto;
      }

      .provider-guide-header,
      .guide-meta {
        align-items: stretch;
        flex-direction: column;
      }

      .guide-ready-check {
        white-space: normal;
      }

      .guide-copy-status {
        text-align: left;
      }
    }

    @media (max-width: 430px) {
      .summary-grid {
        grid-template-columns: 1fr;
      }

      .state-actions,
      .state-actions .button,
      .form-actions,
      .form-actions button {
        width: 100%;
      }

      .dialog-actions {
        display: grid;
      }

      .guide-steps {
        grid-template-columns: 1fr;
      }

      .guide-code-header {
        align-items: stretch;
        flex-direction: column;
      }

      .guide-copy-button {
        width: 100%;
        min-height: 44px;
      }

      dialog {
        width: min(calc(100% - 1rem), 620px);
        max-height: calc(100dvh - 1rem);
        border-radius: 14px;
      }

      #auth-dialog {
        width: min(calc(100% - 1rem), 520px);
      }

      #auth-dialog .dialog-body {
        max-height: calc(100dvh - 9.5rem);
      }
    }
  </style>
</head>
<body>
  <a class="skip-link" href="#main-content">跳到主要内容</a>
  <header class="topbar">
    <div class="topbar-inner">
      <div class="brand" aria-label="Token Relay 用户中心">
        <span class="brand-mark" aria-hidden="true">TR</span>
        <span class="brand-copy">
          <span class="brand-title">Token Relay</span>
          <span class="brand-subtitle">用户中心</span>
        </span>
      </div>
      <div class="top-actions">
        <span class="session-indicator" role="status" aria-live="polite" aria-atomic="true">
          <span id="session-dot" class="session-dot" aria-hidden="true"></span>
          <span id="session-label">正在检查登录状态</span>
        </span>
        <div id="top-auth-actions" class="top-auth-actions" hidden>
          <button id="open-login-button" class="top-auth-button" type="button" aria-haspopup="dialog" aria-controls="auth-dialog">登录</button>
          <button id="open-register-button" class="top-auth-button is-primary" type="button" aria-haspopup="dialog" aria-controls="auth-dialog">注册</button>
        </div>
        <a class="top-link" href="/models">模型接入</a>
        <a class="top-link" href="/admin">管理台</a>
      </div>
    </div>
  </header>

  <main id="main-content" tabindex="-1">
    <div id="global-status" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>

    <section id="public-home" class="public-home" aria-labelledby="public-title">
      <section class="public-hero">
        <div class="hero-copy">
          <p class="hero-kicker">公开功能概览 · 无需登录</p>
          <h1 id="public-title" class="hero-title">把闲置模型额度，安全地路由给指定使用者</h1>
          <p class="hero-summary">Token Relay 连接模型提供者与使用者。提供者通过 SDK 接入自己的模型 CLI，使用者通过兼容 OpenAI 或 Anthropic 的文本接口调用；Relay 负责身份校验、定向转发、额度和并发控制。</p>
          <ul class="hero-badges" aria-label="兼容能力">
            <li class="hero-badge">OpenAI 文本接口</li>
            <li class="hero-badge">Claude Code 文本请求</li>
            <li class="hero-badge">Provider SDK</li>
          </ul>
          <a class="hero-link" href="/models">浏览可接入模型</a>
        </div>
      </section>

      <div id="public-account-notice" class="notice is-error public-account-notice" role="alert" hidden>
        <div>
          <strong>账户服务暂不可用</strong>
          <span id="public-account-notice-detail">公开内容仍可正常浏览。</span>
        </div>
        <div class="public-notice-actions">
          <button id="retry-account-button" class="primary" type="button">重新加载账户</button>
          <button id="public-logout-button" class="secondary" type="button">退出当前会话</button>
        </div>
      </div>

      <section id="how-it-works" class="public-section" aria-labelledby="how-it-works-title">
        <div class="section-heading">
          <p class="section-eyebrow">一次请求，三个角色</p>
          <h2 id="how-it-works-title">中转如何工作</h2>
          <p>资源创建需要登录，下面的角色分工与接入方式对所有访客公开。</p>
        </div>
        <div class="role-grid">
          <article class="role-card">
            <div class="role-heading">
              <span class="role-index" aria-hidden="true">01</span>
              <h3>使用者 · Consumer</h3>
            </div>
            <p>获得 API Key、模型名称和 Relay 地址，通过熟悉的客户端发起请求，无需接触提供者的订阅凭据。</p>
          </article>
          <article class="role-card">
            <div class="role-heading">
              <span class="role-index" aria-hidden="true">02</span>
              <h3>中转服务 · Relay</h3>
            </div>
            <p>验证调用身份与额度，把请求定向发送给已分配的 Provider，并记录脱敏状态、用量和失败原因。</p>
          </article>
          <article class="role-card">
            <div class="role-heading">
              <span class="role-index" aria-hidden="true">03</span>
              <h3>提供者 · Provider</h3>
            </div>
            <p>安装 Provider SDK，连接 Relay 并注册可用模型；SDK 在本机启动对应模型 CLI 处理指定请求。</p>
          </article>
        </div>
      </section>

      <section class="public-section" aria-labelledby="capabilities-title">
        <div class="section-heading">
          <p class="section-eyebrow">基本能力</p>
          <h2 id="capabilities-title">登录前即可确认服务是否适合你</h2>
        </div>
        <div class="capability-grid">
          <article class="capability-card">
            <h3>定向模型路由</h3>
            <p>Consumer 明确绑定 Provider 与模型，避免请求随机落到未授权的订阅账户。</p>
          </article>
          <article class="capability-card">
            <h3>额度与并发保护</h3>
            <p>按 Consumer 控制 token 上限、并发数、超时与取消，减少共享额度被意外耗尽。</p>
          </article>
          <article class="capability-card">
            <h3>运行状态可见</h3>
            <p>登录后查看 Provider 在线状态、可用模型、近期请求和脱敏错误，不暴露完整凭据。</p>
          </article>
        </div>
      </section>

      <section class="public-section" aria-labelledby="integration-title">
        <div class="section-heading">
          <p class="section-eyebrow">兼容入口</p>
          <h2 id="integration-title">保留现有工具的调用方式</h2>
        </div>
        <div class="integration-grid">
          <dl class="endpoint-list">
            <div class="endpoint-row">
              <dt><code>GET /v1/models</code></dt>
              <dd>查询当前 Consumer 可调用的模型</dd>
            </div>
            <div class="endpoint-row">
              <dt><code>POST /v1/chat/completions</code></dt>
              <dd>OpenAI-compatible 非流式文本对话子集</dd>
            </div>
            <div class="endpoint-row">
              <dt><code>POST /v1/messages</code></dt>
              <dd>Anthropic Messages 与 Claude Code 文本请求子集</dd>
            </div>
            <div class="endpoint-row">
              <dt><code>WS /provider/v1/connect</code></dt>
              <dd>Provider SDK 的长连接通道</dd>
            </div>
          </dl>
          <aside class="boundary-note" aria-labelledby="boundary-title">
            <h3 id="boundary-title">登录与安全边界</h3>
            <p>功能说明和模型目录无需登录。创建资源、查看请求和轮换凭据需要用户会话；管理全局资源仍使用独立管理台。Consumer 可以绑定本人 Provider，或由所有者主动公开的 Provider；请求内容会发送到所绑定的提供者设备。</p>
          </aside>
        </div>
      </section>
    </section>

    <section id="account-state" aria-labelledby="account-title" hidden>
      <div class="account-header">
        <div>
          <p class="muted">Consumer 与 Provider 双角色工作台</p>
          <h1 id="account-title" tabindex="-1">你好，<span id="user-name">用户</span></h1>
          <p class="muted">同一账户可以使用模型完成工作，也可以提供模型获得积分；两种角色无需切换。</p>
        </div>
        <div class="account-actions">
          <span id="session-expiry" class="expiry"></span>
          <button id="logout-button" class="secondary" type="button">退出登录</button>
        </div>
      </div>

      <div id="account-notice" class="notice" role="status" aria-live="polite" aria-atomic="true" hidden></div>

      <div class="summary-grid" aria-label="账户汇总">
        <article class="summary-card">
          <p class="summary-label">我的 Provider</p>
          <p id="summary-providers" class="summary-value">0</p>
          <p id="summary-providers-detail" class="summary-detail">0 个在线</p>
        </article>
        <article class="summary-card">
          <p class="summary-label">我的 Consumer</p>
          <p id="summary-consumers" class="summary-value">0</p>
          <p id="summary-consumers-detail" class="summary-detail">已分配的调用凭据</p>
        </article>
        <article class="summary-card">
          <p class="summary-label">近期请求</p>
          <p id="summary-requests" class="summary-value">0</p>
          <p id="summary-requests-detail" class="summary-detail">0 个成功</p>
        </article>
        <article class="summary-card">
          <p class="summary-label">可用积分</p>
          <p id="summary-points" class="summary-value">0</p>
          <p id="summary-points-detail" class="summary-detail">余额 0 · 预留 0</p>
        </article>
        <article class="summary-card">
          <p class="summary-label">Consumer Token</p>
          <p id="summary-tokens" class="summary-value">0</p>
          <p id="summary-tokens-detail" class="summary-detail">累计消费 Token</p>
        </article>
        <article class="summary-card">
          <p class="summary-label">Provider Token</p>
          <p id="summary-provided-tokens" class="summary-value">0</p>
          <p id="summary-provided-detail" class="summary-detail">累计提供 Token</p>
        </article>
      </div>

      <div class="create-grid">
        <section class="panel" aria-labelledby="create-provider-title">
          <div class="panel-header">
            <h2 id="create-provider-title">创建 Provider</h2>
            <p>生成一次性连接令牌；创建后还需按下方指南在模型设备启动 SDK。</p>
          </div>
          <div class="panel-body">
            <form id="provider-form">
              <div class="form-grid">
                <div class="field full">
                  <label for="provider-name">名称</label>
                  <input id="provider-name" name="name" type="text" required maxlength="100" autocomplete="off" placeholder="例如：家用 Mac">
                </div>
                <div class="field">
                  <label for="provider-token-limit">Token 总额度</label>
                  <input id="provider-token-limit" name="tokenLimit" type="number" required min="1" max="1000000000000" step="1" value="100000">
                </div>
                <div class="field">
                  <label for="provider-max-concurrent">最大并发</label>
                  <input id="provider-max-concurrent" name="maxConcurrent" type="number" required min="1" max="1024" step="1" value="1">
                </div>
                <div class="field full">
                  <label class="checkbox-row" for="provider-listed">
                    <input id="provider-listed" name="listed" type="checkbox" checked>
                    <span class="checkbox-copy">
                      <span>上架到公开模型目录</span>
                      <small>其他登录用户可在 Provider 在线并上报模型后创建访问凭据；可以随时关闭上架。</small>
                    </span>
                  </label>
                </div>
              </div>
              <div class="form-actions">
                <button id="create-provider-button" class="primary" type="submit">创建并生成令牌</button>
              </div>
              <p class="field-hint">创建记录或勾选“上架”不会自动提供模型；SDK 在线并上报模型后才可接收请求。</p>
              <p id="provider-form-status" class="form-status" role="status" aria-live="polite" aria-atomic="true"></p>
            </form>
          </div>
        </section>

        <section class="panel" aria-labelledby="create-consumer-title">
          <div class="panel-header">
            <h2 id="create-consumer-title">创建 Consumer</h2>
            <p>推荐先从模型目录挑选 Provider；下方保留高级手动配置。</p>
            <div class="form-actions">
              <a class="button button-primary" href="/models">打开模型目录</a>
            </div>
          </div>
          <div class="panel-body">
            <form id="consumer-form">
              <div class="form-grid">
                <div class="field full">
                  <label for="consumer-name">名称</label>
                  <input id="consumer-name" name="name" type="text" required maxlength="100" autocomplete="off" placeholder="例如：个人开发环境">
                </div>
                <div class="field">
                  <label for="consumer-provider">Provider</label>
                  <select id="consumer-provider" name="providerId" required>
                    <option value="">正在加载…</option>
                  </select>
                </div>
                <div class="field">
                  <label for="consumer-model">模型</label>
                  <select id="consumer-model" name="model" required disabled>
                    <option value="">先选择 Provider</option>
                  </select>
                </div>
                <div class="field">
                  <label for="consumer-token-limit">Token 总额度</label>
                  <input id="consumer-token-limit" name="tokenLimit" type="number" required min="1" max="1000000000000" step="1" value="100000">
                </div>
                <div class="field">
                  <label for="consumer-max-concurrent">最大并发</label>
                  <input id="consumer-max-concurrent" name="maxConcurrent" type="number" required min="1" max="1024" step="1" value="1">
                </div>
              </div>
              <p class="field-hint">列表包含本人 Provider，以及其他用户主动上架且当前在线的模型。</p>
              <div class="form-actions">
                <button id="create-consumer-button" class="primary" type="submit">创建并生成 API Key</button>
              </div>
              <p id="consumer-form-status" class="form-status" role="status" aria-live="polite" aria-atomic="true"></p>
            </form>
          </div>
        </section>
      </div>

      <section id="provider-guide" class="panel provider-guide" aria-labelledby="provider-guide-title">
        <div class="provider-guide-header">
          <div>
            <p class="guide-eyebrow">Provider Quick Start</p>
            <h2 id="provider-guide-title" tabindex="-1">创建 Provider 后，按这 4 步真正上线</h2>
            <p>Provider Token 只用于连接身份认证。模型设备必须保持 SDK 运行，并成功向 Relay 上报模型，使用者的请求才能被转发过来。</p>
          </div>
          <div class="guide-ready-check" aria-label="Provider 上线完成标准">
            <span>完成标准 1 · 状态显示“在线”</span>
            <span>完成标准 2 · 模型不再“等待设备上报”</span>
          </div>
        </div>
        <div class="provider-guide-body">
          <ol class="guide-steps" aria-label="Provider 接入步骤">
            <li class="guide-step">
              <span class="guide-step-number" aria-hidden="true">1</span>
              <strong>准备模型设备</strong>
              <span>安装 Node.js 22.13+，并确认 Codex CLI 已安装且完成登录。</span>
            </li>
            <li class="guide-step">
              <span class="guide-step-number" aria-hidden="true">2</span>
              <strong>保存一次性令牌</strong>
              <span>只放入环境变量，不写入仓库、配置文件、URL 或日志。</span>
            </li>
            <li class="guide-step">
              <span class="guide-step-number" aria-hidden="true">3</span>
              <strong>声明可提供模型</strong>
              <span>创建 provider.config.json；模型对象键就是 Relay 对外模型名。</span>
            </li>
            <li class="guide-step">
              <span class="guide-step-number" aria-hidden="true">4</span>
              <strong>检查并保持运行</strong>
              <span>先 doctor，再 start；终端需持续运行，回到本页确认在线与模型。</span>
            </li>
          </ol>

          <div class="guide-code-grid">
            <section class="guide-code-card" aria-labelledby="provider-install-title">
              <div class="guide-code-header">
                <h3 id="provider-install-title">A. 安装正式 Provider SDK</h3>
                <button id="copy-provider-install-button" class="secondary guide-copy-button" type="button">复制安装命令</button>
              </div>
              <pre class="guide-code"><code id="provider-install-example"></code></pre>
            </section>

            <section class="guide-code-card" aria-labelledby="provider-config-title">
              <div class="guide-code-header">
                <h3 id="provider-config-title">B. 保存为 provider.config.json</h3>
                <button id="copy-provider-config-button" class="secondary guide-copy-button" type="button">复制配置</button>
              </div>
              <pre class="guide-code"><code id="provider-config-example"></code></pre>
            </section>

            <section class="guide-code-card is-wide" aria-labelledby="provider-start-title">
              <div class="guide-code-header">
                <h3 id="provider-start-title">C. 设置令牌、检查并启动</h3>
                <button id="copy-provider-start-button" class="secondary guide-copy-button" type="button">复制启动命令</button>
              </div>
              <pre class="guide-code"><code id="provider-start-example"></code></pre>
            </section>
          </div>

          <div class="guide-meta">
            <p><strong>如何判断成功：</strong>终端出现 Provider ready 提示，本页 Provider 状态变为“在线”，模型列显示 <code>gpt-5.6-sol</code>。上架仅控制其他用户能否发现和新建绑定，不代表设备已经在线。</p>
            <p id="provider-guide-copy-status" class="guide-copy-status" role="status" aria-live="polite" aria-atomic="true"></p>
          </div>

          <details class="guide-details">
            <summary>换成 Claude、Aiden、自定义命令，或部署到另一台设备</summary>
            <p><code>adapter</code> 支持 <code>codex</code>、<code>claude</code>、<code>aiden</code> 与 <code>custom</code>。替换模型对象键和 <code>cliModel</code> 时，Consumer 使用的模型名必须与对象键完全一致。另一台设备只需安装 <code>@anarkhli/provider-sdk</code>、准备配置并登录对应模型 CLI；公网 Relay 地址必须使用 WSS。</p>
          </details>
        </div>
      </section>

      <div class="resource-stack">
        <section class="panel" aria-labelledby="providers-title">
          <div class="panel-header">
            <h2 id="providers-title">我的 Provider</h2>
            <p>连接状态、模型能力、额度和并发使用情况。</p>
          </div>
          <div id="providers-empty" class="empty" hidden>
            <strong>尚未创建 Provider</strong>
            <p>使用上方表单创建后，保存一次性令牌并按接入指南启动 SDK。</p>
          </div>
          <div id="providers-table-wrap" class="table-wrap" tabindex="0" role="region" aria-label="Provider 表格">
            <table>
              <caption class="sr-only">当前账户的 Provider 列表</caption>
              <thead>
                <tr>
                  <th scope="col">Provider</th>
                  <th scope="col">状态</th>
                  <th scope="col">模型</th>
                  <th scope="col">Token 额度</th>
                  <th scope="col">并发</th>
                  <th scope="col">模型目录</th>
                  <th scope="col">令牌标识</th>
                </tr>
              </thead>
              <tbody id="providers-body"></tbody>
            </table>
          </div>
        </section>

        <section class="panel" aria-labelledby="consumers-title">
          <div class="panel-header">
            <h2 id="consumers-title">我的 Consumer</h2>
            <p>API Key 状态、Provider 绑定、模型和使用额度。</p>
          </div>
          <div id="consumers-empty" class="empty" hidden>
            <strong>尚未创建 Consumer</strong>
            <p>有可用 Provider 后，可以从上方表单分配调用凭据。</p>
          </div>
          <div id="consumers-table-wrap" class="table-wrap" tabindex="0" role="region" aria-label="Consumer 表格">
            <table>
              <caption class="sr-only">当前账户的 Consumer 列表</caption>
              <thead>
                <tr>
                  <th scope="col">Consumer</th>
                  <th scope="col">状态</th>
                  <th scope="col">Provider / 模型</th>
                  <th scope="col">Token 额度</th>
                  <th scope="col">并发</th>
                  <th scope="col">Key 标识</th>
                </tr>
              </thead>
              <tbody id="consumers-body"></tbody>
            </table>
          </div>
        </section>

        <section class="panel" aria-labelledby="requests-title">
          <div class="panel-header">
            <h2 id="requests-title">近期请求</h2>
            <p>仅展示当前账户 Consumer 发起的请求与脱敏运行信息。</p>
          </div>
          <div id="requests-empty" class="empty" hidden>
            <strong>暂无请求记录</strong>
            <p>Consumer 完成首次调用后，请求状态会显示在这里。</p>
          </div>
          <div id="requests-table-wrap" class="table-wrap" tabindex="0" role="region" aria-label="近期请求表格">
            <table>
              <caption class="sr-only">当前账户的近期请求列表</caption>
              <thead>
                <tr>
                  <th scope="col">时间 / 请求</th>
                  <th scope="col">状态</th>
                  <th scope="col">Consumer / Provider</th>
                  <th scope="col">模型</th>
                  <th scope="col">Token</th>
                  <th scope="col">耗时</th>
                </tr>
              </thead>
              <tbody id="requests-body"></tbody>
            </table>
          </div>
        </section>

        <section class="panel" aria-labelledby="ledger-title">
          <div class="panel-header">
            <h2 id="ledger-title">积分流水</h2>
            <p>消费模型扣除积分，提供模型获得积分；本人调用本人时两笔相抵。</p>
          </div>
          <div id="ledger-empty" class="empty" hidden>
            <strong>暂无积分流水</strong>
            <p>新用户初始积分或首次结算后，记录会显示在这里。</p>
          </div>
          <div id="ledger-table-wrap" class="table-wrap" tabindex="0" role="region" aria-label="积分流水表格">
            <table>
              <caption class="sr-only">当前账户的近期积分流水</caption>
              <thead>
                <tr>
                  <th scope="col">时间</th>
                  <th scope="col">类型</th>
                  <th scope="col">积分变化</th>
                  <th scope="col">关联请求</th>
                </tr>
              </thead>
              <tbody id="ledger-body"></tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  </main>

  <dialog id="auth-dialog" aria-labelledby="auth-dialog-title" aria-describedby="auth-dialog-description">
    <div class="dialog-header">
      <div class="dialog-title-row">
        <h2 id="auth-dialog-title">登录或注册账户</h2>
        <button id="close-auth-button" class="dialog-close" type="button" aria-label="关闭账户弹窗">×</button>
      </div>
      <p id="auth-dialog-description">登录后管理 Provider、Consumer、积分与近期请求。</p>
    </div>
    <div class="dialog-body">
      <div id="account-access" class="auth-tabs" role="tablist" aria-label="账户操作">
        <button id="login-tab" class="auth-tab" type="button" role="tab" aria-selected="true" aria-controls="login-panel">登录</button>
        <button id="register-tab" class="auth-tab" type="button" role="tab" aria-selected="false" aria-controls="register-panel" tabindex="-1">注册</button>
      </div>

      <section id="login-panel" class="auth-panel" role="tabpanel" aria-labelledby="login-tab">
        <form id="login-form" class="auth-form">
          <div class="field">
            <label for="login-username">用户名</label>
            <input id="login-username" name="username" type="text" required minlength="3" maxlength="64" pattern="[A-Za-z0-9._-]{3,64}" title="请输入 3–64 位字母、数字、点、下划线或连字符" autocomplete="username" autocapitalize="none" spellcheck="false" aria-describedby="login-username-hint login-form-status">
            <p id="login-username-hint" class="auth-hint">3–64 位，可使用字母、数字、点、下划线和连字符。</p>
          </div>
          <div class="field">
            <label for="login-password">密码</label>
            <input id="login-password" name="password" type="password" required minlength="12" maxlength="128" autocomplete="current-password" aria-describedby="login-form-status">
          </div>
          <p id="login-form-status" class="form-status auth-form-status" role="status" aria-live="polite" aria-atomic="true"></p>
          <div class="form-actions">
            <button id="login-button" class="primary" type="submit">登录账户</button>
          </div>
        </form>
      </section>

      <section id="register-panel" class="auth-panel" role="tabpanel" aria-labelledby="register-tab" hidden>
        <form id="register-form" class="auth-form">
          <div class="field">
            <label for="register-display-name">显示名称 <span class="muted">（可选）</span></label>
            <input id="register-display-name" name="displayName" type="text" maxlength="64" autocomplete="name" aria-describedby="register-form-status">
          </div>
          <div class="field">
            <label for="register-username">用户名</label>
            <input id="register-username" name="username" type="text" required minlength="3" maxlength="64" pattern="[A-Za-z0-9._-]{3,64}" title="请输入 3–64 位字母、数字、点、下划线或连字符" autocomplete="username" autocapitalize="none" spellcheck="false" aria-describedby="register-username-hint register-form-status">
            <p id="register-username-hint" class="auth-hint">注册后使用此用户名登录；3–64 位，可使用字母、数字、点、下划线和连字符。</p>
          </div>
          <div class="field">
            <label for="register-password">密码</label>
            <input id="register-password" name="password" type="password" required minlength="12" maxlength="128" autocomplete="new-password" aria-describedby="register-password-hint register-form-status">
            <p id="register-password-hint" class="auth-hint">至少 12 位，建议使用只在本站使用的长密码。</p>
          </div>
          <div class="field">
            <label for="register-password-confirm">再次输入密码</label>
            <input id="register-password-confirm" name="passwordConfirm" type="password" required minlength="12" maxlength="128" autocomplete="new-password" aria-describedby="register-form-status">
          </div>
          <p id="register-form-status" class="form-status auth-form-status" role="status" aria-live="polite" aria-atomic="true"></p>
          <div class="form-actions">
            <button id="register-button" class="primary" type="submit">注册并进入工作台</button>
          </div>
        </form>
      </section>
    </div>
  </dialog>

  <dialog id="secret-dialog" aria-labelledby="secret-title" aria-describedby="secret-description">
    <div class="dialog-header">
      <h2 id="secret-title">一次性凭据</h2>
      <p id="secret-description"></p>
    </div>
    <div class="dialog-body">
      <p class="secret-warning">请现在复制并妥善保存。关闭窗口后，完整凭据将不会再次显示。</p>
      <label for="secret-value">完整凭据</label>
      <textarea id="secret-value" class="secret-value" readonly spellcheck="false" autocomplete="off"></textarea>
      <p id="copy-status" class="form-status" role="status" aria-live="polite" aria-atomic="true"></p>
      <section id="provider-secret-next" class="provider-secret-next" aria-labelledby="provider-secret-next-title" hidden>
        <h3 id="provider-secret-next-title">保存令牌后，Provider 还不会自动上线</h3>
        <ol>
          <li>在提供模型的设备安装 <code>@anarkhli/provider-sdk</code>，并确认本地模型 CLI 已登录。</li>
          <li>创建 <code>provider.config.json</code>，令牌位置使用环境变量占位符。</li>
          <li>运行 <code>doctor</code> 后再运行 <code>start</code>，并保持进程在线。</li>
          <li>回到工作台确认状态为“在线”，且模型列已经显示上报模型。</li>
        </ol>
        <p>“已上架”只代表允许其他用户发现；只有在线并上报模型后才能真正接收请求。</p>
      </section>
      <div class="dialog-actions">
        <button id="copy-secret-button" class="primary" type="button">复制凭据</button>
        <button id="show-provider-guide-button" class="secondary" type="button" hidden>我已保存，查看接入文档</button>
        <button id="close-secret-button" class="secondary" type="button">我已保存，关闭</button>
      </div>
    </div>
  </dialog>

  <noscript>
    <div class="state-shell">
      <div class="state-card">
        <h2>账户功能需要启用 JavaScript</h2>
        <p>公开功能说明可以直接阅读；登录状态检查和资源管理需要 JavaScript。</p>
      </div>
    </div>
  </noscript>

  <script>
    "use strict";

    (function () {
      var state = {
        session: null,
        overview: null,
        availableProviders: [],
        secretReturnFocus: null,
        secretCopyLabel: "复制凭据",
        authReturnFocus: null,
        authBusy: false
      };

      var elements = {
        publicHome: document.getElementById("public-home"),
        accountState: document.getElementById("account-state"),
        sessionDot: document.getElementById("session-dot"),
        sessionLabel: document.getElementById("session-label"),
        globalStatus: document.getElementById("global-status"),
        topAuthActions: document.getElementById("top-auth-actions"),
        openLoginButton: document.getElementById("open-login-button"),
        openRegisterButton: document.getElementById("open-register-button"),
        authDialog: document.getElementById("auth-dialog"),
        closeAuthButton: document.getElementById("close-auth-button"),
        publicAccountNotice: document.getElementById("public-account-notice"),
        publicAccountNoticeDetail: document.getElementById("public-account-notice-detail"),
        retryAccountButton: document.getElementById("retry-account-button"),
        publicLogoutButton: document.getElementById("public-logout-button"),
        loginTab: document.getElementById("login-tab"),
        registerTab: document.getElementById("register-tab"),
        loginPanel: document.getElementById("login-panel"),
        registerPanel: document.getElementById("register-panel"),
        loginForm: document.getElementById("login-form"),
        loginUsername: document.getElementById("login-username"),
        loginPassword: document.getElementById("login-password"),
        loginFormStatus: document.getElementById("login-form-status"),
        loginButton: document.getElementById("login-button"),
        registerForm: document.getElementById("register-form"),
        registerDisplayName: document.getElementById("register-display-name"),
        registerUsername: document.getElementById("register-username"),
        registerPassword: document.getElementById("register-password"),
        registerPasswordConfirm: document.getElementById("register-password-confirm"),
        registerFormStatus: document.getElementById("register-form-status"),
        registerButton: document.getElementById("register-button"),
        userName: document.getElementById("user-name"),
        sessionExpiry: document.getElementById("session-expiry"),
        logoutButton: document.getElementById("logout-button"),
        accountNotice: document.getElementById("account-notice"),
        summaryProviders: document.getElementById("summary-providers"),
        summaryProvidersDetail: document.getElementById("summary-providers-detail"),
        summaryConsumers: document.getElementById("summary-consumers"),
        summaryConsumersDetail: document.getElementById("summary-consumers-detail"),
        summaryRequests: document.getElementById("summary-requests"),
        summaryRequestsDetail: document.getElementById("summary-requests-detail"),
        summaryPoints: document.getElementById("summary-points"),
        summaryPointsDetail: document.getElementById("summary-points-detail"),
        summaryTokens: document.getElementById("summary-tokens"),
        summaryTokensDetail: document.getElementById("summary-tokens-detail"),
        summaryProvidedTokens: document.getElementById("summary-provided-tokens"),
        summaryProvidedDetail: document.getElementById("summary-provided-detail"),
        providerForm: document.getElementById("provider-form"),
        providerName: document.getElementById("provider-name"),
        providerTokenLimit: document.getElementById("provider-token-limit"),
        providerMaxConcurrent: document.getElementById("provider-max-concurrent"),
        providerListed: document.getElementById("provider-listed"),
        createProviderButton: document.getElementById("create-provider-button"),
        providerFormStatus: document.getElementById("provider-form-status"),
        providerGuide: document.getElementById("provider-guide"),
        providerGuideTitle: document.getElementById("provider-guide-title"),
        providerInstallExample: document.getElementById("provider-install-example"),
        providerConfigExample: document.getElementById("provider-config-example"),
        providerStartExample: document.getElementById("provider-start-example"),
        providerGuideCopyStatus: document.getElementById("provider-guide-copy-status"),
        copyProviderInstallButton: document.getElementById("copy-provider-install-button"),
        copyProviderConfigButton: document.getElementById("copy-provider-config-button"),
        copyProviderStartButton: document.getElementById("copy-provider-start-button"),
        consumerForm: document.getElementById("consumer-form"),
        consumerName: document.getElementById("consumer-name"),
        consumerProvider: document.getElementById("consumer-provider"),
        consumerModel: document.getElementById("consumer-model"),
        consumerTokenLimit: document.getElementById("consumer-token-limit"),
        consumerMaxConcurrent: document.getElementById("consumer-max-concurrent"),
        createConsumerButton: document.getElementById("create-consumer-button"),
        consumerFormStatus: document.getElementById("consumer-form-status"),
        providersEmpty: document.getElementById("providers-empty"),
        providersTableWrap: document.getElementById("providers-table-wrap"),
        providersBody: document.getElementById("providers-body"),
        consumersEmpty: document.getElementById("consumers-empty"),
        consumersTableWrap: document.getElementById("consumers-table-wrap"),
        consumersBody: document.getElementById("consumers-body"),
        requestsEmpty: document.getElementById("requests-empty"),
        requestsTableWrap: document.getElementById("requests-table-wrap"),
        requestsBody: document.getElementById("requests-body"),
        ledgerEmpty: document.getElementById("ledger-empty"),
        ledgerTableWrap: document.getElementById("ledger-table-wrap"),
        ledgerBody: document.getElementById("ledger-body"),
        secretDialog: document.getElementById("secret-dialog"),
        secretTitle: document.getElementById("secret-title"),
        secretDescription: document.getElementById("secret-description"),
        secretValue: document.getElementById("secret-value"),
        copyStatus: document.getElementById("copy-status"),
        providerSecretNext: document.getElementById("provider-secret-next"),
        copySecretButton: document.getElementById("copy-secret-button"),
        showProviderGuideButton: document.getElementById("show-provider-guide-button"),
        closeSecretButton: document.getElementById("close-secret-button")
      };

      elements.openLoginButton.addEventListener("click", function () {
        openAuthDialog("login", elements.openLoginButton);
      });
      elements.openRegisterButton.addEventListener("click", function () {
        openAuthDialog("register", elements.openRegisterButton);
      });
      elements.closeAuthButton.addEventListener("click", function () {
        closeAuthDialog(false, true);
      });
      elements.authDialog.addEventListener("cancel", function (event) {
        if (state.authBusy) {
          event.preventDefault();
        }
      });
      elements.authDialog.addEventListener("close", handleAuthDialogClosed);
      elements.retryAccountButton.addEventListener("click", retryAccountLoading);
      elements.publicLogoutButton.addEventListener("click", logoutFromPublic);
      elements.loginTab.addEventListener("click", function () {
        setAuthMode("login", false);
      });
      elements.registerTab.addEventListener("click", function () {
        setAuthMode("register", false);
      });
      elements.loginTab.addEventListener("keydown", handleAuthTabKeydown);
      elements.registerTab.addEventListener("keydown", handleAuthTabKeydown);
      elements.loginForm.addEventListener("submit", login);
      elements.registerForm.addEventListener("submit", register);
      [
        elements.loginUsername,
        elements.loginPassword,
        elements.registerDisplayName,
        elements.registerUsername,
        elements.registerPassword,
        elements.registerPasswordConfirm
      ].forEach(function (input) {
        input.addEventListener("input", function () {
          input.removeAttribute("aria-invalid");
        });
      });
      elements.registerPasswordConfirm.addEventListener("input", function () {
        elements.registerPasswordConfirm.setCustomValidity("");
      });
      elements.logoutButton.addEventListener("click", logout);
      elements.providerForm.addEventListener("submit", createProvider);
      elements.consumerForm.addEventListener("submit", createConsumer);
      elements.consumerProvider.addEventListener("change", renderModelOptions);
      elements.copyProviderInstallButton.addEventListener("click", function () {
        copyProviderGuideBlock(
          elements.providerInstallExample,
          elements.copyProviderInstallButton,
          "安装命令"
        );
      });
      elements.copyProviderConfigButton.addEventListener("click", function () {
        copyProviderGuideBlock(
          elements.providerConfigExample,
          elements.copyProviderConfigButton,
          "Provider 配置"
        );
      });
      elements.copyProviderStartButton.addEventListener("click", function () {
        copyProviderGuideBlock(
          elements.providerStartExample,
          elements.copyProviderStartButton,
          "启动命令"
        );
      });
      elements.copySecretButton.addEventListener("click", copySecret);
      elements.showProviderGuideButton.addEventListener("click", closeSecretAndShowProviderGuide);
      elements.closeSecretButton.addEventListener("click", closeSecret);
      elements.secretDialog.addEventListener("close", clearSecret);
      elements.secretDialog.addEventListener("cancel", function (event) {
        event.preventDefault();
        elements.copyStatus.textContent = "请先保存凭据，再使用“我已保存，关闭”。";
      });

      renderProviderGuideExamples();
      initialize();

      async function initialize() {
        showView("public");
        setTopAuthVisibility(false);
        setSessionIndicator("loading", "正在检查登录状态");
        setGlobalStatus("正在检查登录状态。");
        hideAccountNotice();
        hidePublicAccountNotice();

        try {
          var session = await requestJson("/auth/v1/session");
          state.session = isObject(session) ? session : {};

          if (state.session.authenticated === true) {
            var authenticatedReturnPath = readRequestedAuthMode()
              ? readSafeReturnPath()
              : "/";
            if (authenticatedReturnPath !== "/") {
              window.location.replace(authenticatedReturnPath);
              return;
            }
            setTopAuthVisibility(false);
            closeAuthDialog(true, false);
            setSessionIndicator("ready", authenticatedSessionLabel());
            await loadOverview(true);
            return;
          }

          state.overview = null;
          state.availableProviders = [];

          setSessionIndicator("idle", "未登录");
          setTopAuthVisibility(true);
          showView("public");
          hidePublicAccountNotice();
          var requestedAuthMode = readRequestedAuthMode();
          setAuthMode(requestedAuthMode || "login", false);
          setGlobalStatus("尚未登录，可以登录或注册账户。");
          if (requestedAuthMode) {
            openAuthDialog(requestedAuthMode, null);
          }
        } catch (error) {
          state.session = {
            authenticated: false
          };
          setTopAuthVisibility(true);
          showView("public");
          setSessionIndicator("warning", "账户状态暂不可用");
          showPublicAccountNotice(
            describeError(error, "检查登录状态失败，请稍后重试。"),
            false
          );
          setGlobalStatus(describeError(error, "检查登录状态失败，公开内容仍可正常浏览。"));
          var fallbackAuthMode = readRequestedAuthMode();
          if (fallbackAuthMode) {
            openAuthDialog(fallbackAuthMode, null);
          }
        }
      }

      async function loadOverview(focusHeading) {
        setGlobalStatus("正在加载账户资源。");

        try {
          var overview = await requestJson("/account/v1/overview");
          state.overview = isObject(overview) ? overview : {};
          state.availableProviders = arrayValue(state.overview.availableProviders);
          renderAccount();
          showView("account");
          hidePublicAccountNotice();
          setTopAuthVisibility(false);
          setSessionIndicator("ready", authenticatedSessionLabel());
          setGlobalStatus("账户资源已加载。");
          if (focusHeading) {
            focusViewHeading(elements.accountState);
          }
        } catch (error) {
          if (error && error.status === 401) {
            state.session = {
              authenticated: false
            };
            setSessionIndicator("idle", "登录已过期");
            setTopAuthVisibility(true);
            showView("public");
            hidePublicAccountNotice();
            setAuthMode("login", false);
            setGlobalStatus("登录已过期，请重新登录。");
            openAuthDialog("login", elements.openLoginButton);
            return;
          }
          showView("public");
          setTopAuthVisibility(!(state.session && state.session.authenticated === true));
          setSessionIndicator("warning", "账户加载失败");
          showPublicAccountNotice(
            describeError(error, "加载账户信息失败，请稍后重试。"),
            true
          );
          setGlobalStatus(describeError(error, "加载账户信息失败，公开内容仍可正常浏览。"));
        }
      }

      function showView(name) {
        elements.publicHome.hidden = name === "account";
        elements.accountState.hidden = name !== "account";
      }

      function setTopAuthVisibility(visible) {
        elements.topAuthActions.hidden = !visible;
      }

      function focusViewHeading(container) {
        if (container.contains(document.activeElement)) {
          return;
        }
        var heading = container.querySelector("h1, h2");
        if (heading) {
          heading.focus({ preventScroll: true });
        }
      }

      function setSessionIndicator(kind, label) {
        elements.sessionLabel.textContent = label;
        elements.sessionDot.classList.toggle("is-ready", kind === "ready");
        elements.sessionDot.classList.toggle("is-warning", kind === "warning");
      }

      function setGlobalStatus(message) {
        elements.globalStatus.textContent = "";
        window.setTimeout(function () {
          elements.globalStatus.textContent = message;
        }, 20);
      }

      function showPublicAccountNotice(message, allowLogout) {
        elements.publicAccountNoticeDetail.textContent = message
          + " 公开内容仍可正常浏览。";
        elements.publicLogoutButton.hidden = !allowLogout;
        elements.publicAccountNotice.hidden = false;
      }

      function hidePublicAccountNotice() {
        elements.publicAccountNotice.hidden = true;
        elements.publicAccountNoticeDetail.textContent = "";
        elements.publicLogoutButton.hidden = false;
      }

      async function retryAccountLoading() {
        setButtonBusy(elements.retryAccountButton, true, "正在重新加载…");
        try {
          if (state.session && state.session.authenticated === true) {
            await loadOverview(true);
          } else {
            await initialize();
          }
        } finally {
          setButtonBusy(elements.retryAccountButton, false, "重新加载账户");
        }
      }

      async function logoutFromPublic() {
        setButtonBusy(elements.publicLogoutButton, true, "正在退出…");
        try {
          await requestJson("/auth/v1/logout", {
            method: "POST",
            body: JSON.stringify({})
          });
          state.session = null;
          state.overview = null;
          state.availableProviders = [];
          hidePublicAccountNotice();
          setTopAuthVisibility(true);
          setSessionIndicator("idle", "未登录");
          setGlobalStatus("已安全退出登录。");
          elements.openLoginButton.focus();
        } catch (error) {
          showPublicAccountNotice(
            describeError(error, "退出当前会话失败，请稍后重试。"),
            true
          );
        } finally {
          setButtonBusy(elements.publicLogoutButton, false, "退出当前会话");
        }
      }

      function authenticatedSessionLabel() {
        var user = isObject(state.session && state.session.user)
          ? state.session.user
          : {};
        var name = firstString(user, ["displayName", "username"]);
        return name ? "已登录 · " + name : "已登录";
      }

      function readRequestedAuthMode() {
        var mode = new URL(window.location.href).searchParams.get("auth");
        return mode === "login" || mode === "register" ? mode : "";
      }

      function readSafeReturnPath() {
        var candidate = new URL(window.location.href).searchParams.get("return_to");
        if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
          return "/";
        }
        try {
          var parsed = new URL(candidate, window.location.origin);
          if (parsed.origin !== window.location.origin
            || parsed.username
            || parsed.password) {
            return "/";
          }
          return parsed.pathname + parsed.search + parsed.hash;
        } catch (_error) {
          return "/";
        }
      }

      function openAuthDialog(mode, trigger) {
        if (state.session && state.session.authenticated === true) {
          return;
        }
        if (trigger) {
          state.authReturnFocus = trigger;
        } else if (!elements.authDialog.open
          && document.activeElement
          && document.activeElement !== document.body) {
          state.authReturnFocus = document.activeElement;
        } else if (!elements.authDialog.open) {
          state.authReturnFocus = mode === "register"
            ? elements.openRegisterButton
            : elements.openLoginButton;
        }
        setAuthMode(mode, false);
        if (!elements.authDialog.open) {
          elements.authDialog.showModal();
        }
        window.requestAnimationFrame(function () {
          var target = mode === "register"
            ? elements.registerDisplayName
            : elements.loginUsername;
          target.focus({ preventScroll: true });
        });
      }

      function closeAuthDialog(force, restoreFocus) {
        if (state.authBusy && !force) {
          return;
        }
        if (restoreFocus === false) {
          state.authReturnFocus = null;
        }
        if (elements.authDialog.open) {
          elements.authDialog.close();
          return;
        }
        clearAuthQuery();
      }

      function handleAuthDialogClosed() {
        clearAuthQuery();
        resetAuthSensitiveState();
        var returnFocus = state.authReturnFocus;
        state.authReturnFocus = null;
        if (returnFocus
          && document.contains(returnFocus)
          && !returnFocus.disabled
          && !returnFocus.closest("[hidden]")) {
          window.requestAnimationFrame(function () {
            returnFocus.focus({ preventScroll: true });
          });
        }
      }

      function resetAuthSensitiveState() {
        elements.loginPassword.value = "";
        elements.registerPassword.value = "";
        elements.registerPasswordConfirm.value = "";
        elements.registerPasswordConfirm.setCustomValidity("");
        elements.loginFormStatus.textContent = "";
        elements.registerFormStatus.textContent = "";
        [
          elements.loginUsername,
          elements.loginPassword,
          elements.registerUsername,
          elements.registerPassword,
          elements.registerPasswordConfirm
        ].forEach(function (input) {
          input.removeAttribute("aria-invalid");
        });
      }

      function clearAuthQuery() {
        var url = new URL(window.location.href);
        if (!url.searchParams.has("auth") && !url.searchParams.has("return_to")) {
          return;
        }
        url.searchParams.delete("auth");
        url.searchParams.delete("return_to");
        if (url.hash === "#account-access") {
          url.hash = "";
        }
        window.history.replaceState({}, "", url.pathname + url.search + url.hash);
      }

      function setAuthMode(mode, focusTab) {
        var registerMode = mode === "register";
        elements.loginTab.setAttribute("aria-selected", registerMode ? "false" : "true");
        elements.loginTab.tabIndex = registerMode ? -1 : 0;
        elements.registerTab.setAttribute("aria-selected", registerMode ? "true" : "false");
        elements.registerTab.tabIndex = registerMode ? 0 : -1;
        elements.loginPanel.hidden = registerMode;
        elements.registerPanel.hidden = !registerMode;
        if (focusTab) {
          (registerMode ? elements.registerTab : elements.loginTab).focus();
        }
      }

      function handleAuthTabKeydown(event) {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
          return;
        }
        event.preventDefault();
        var tabs = [elements.loginTab, elements.registerTab];
        var currentIndex = tabs.indexOf(event.currentTarget);
        var nextIndex = event.key === "Home"
          ? 0
          : event.key === "End"
            ? tabs.length - 1
            : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length)
              % tabs.length;
        setAuthMode(nextIndex === 1 ? "register" : "login", true);
      }

      async function login(event) {
        event.preventDefault();
        elements.loginUsername.removeAttribute("aria-invalid");
        elements.loginPassword.removeAttribute("aria-invalid");
        if (!elements.loginForm.reportValidity()) {
          return;
        }
        var body = {
          username: elements.loginUsername.value.trim(),
          password: elements.loginPassword.value
        };
        if (!body.username || !body.password) {
          setFormStatus(elements.loginFormStatus, "请填写用户名和密码。", true);
          return;
        }

        setAuthBusy("login", true);
        setFormStatus(elements.loginFormStatus, "正在验证账户…", false);
        try {
          await requestJson("/auth/v1/login", {
            method: "POST",
            body: JSON.stringify(body)
          });
          setFormStatus(elements.loginFormStatus, "登录成功，正在进入工作台…", false);
          await completeAuthentication();
        } catch (error) {
          var message = error && error.status === 429
            ? "尝试次数过多，请稍后再登录。"
            : error && error.status >= 400 && error.status < 500
              ? "用户名或密码错误。"
              : describeError(error, "登录失败，请稍后重试。");
          setFormStatus(elements.loginFormStatus, message, true);
          if (error && error.status >= 400 && error.status < 500
            && error.status !== 429) {
            elements.loginUsername.setAttribute("aria-invalid", "true");
            elements.loginPassword.setAttribute("aria-invalid", "true");
          }
          elements.loginPassword.focus();
          elements.loginPassword.select();
        } finally {
          setAuthBusy("login", false);
        }
      }

      async function register(event) {
        event.preventDefault();
        elements.registerUsername.removeAttribute("aria-invalid");
        elements.registerPasswordConfirm.removeAttribute("aria-invalid");
        elements.registerPasswordConfirm.setCustomValidity("");
        if (elements.registerPassword.value !== elements.registerPasswordConfirm.value) {
          elements.registerPasswordConfirm.setCustomValidity("两次输入的密码不一致。");
          elements.registerPasswordConfirm.setAttribute("aria-invalid", "true");
        }
        if (!elements.registerForm.reportValidity()) {
          return;
        }

        var body = {
          username: elements.registerUsername.value.trim(),
          password: elements.registerPassword.value
        };
        var displayName = elements.registerDisplayName.value.trim();
        if (displayName) {
          body.displayName = displayName;
        }

        setAuthBusy("register", true);
        setFormStatus(elements.registerFormStatus, "正在创建账户…", false);
        try {
          await requestJson("/auth/v1/register", {
            method: "POST",
            body: JSON.stringify(body)
          });
          setFormStatus(elements.registerFormStatus, "注册成功，正在进入工作台…", false);
          await completeAuthentication();
        } catch (error) {
          var message = error && error.status === 409
            ? "该用户名已被使用，请更换一个用户名。"
            : describeError(error, "注册失败，请稍后重试。");
          setFormStatus(elements.registerFormStatus, message, true);
          if (error && error.status === 409) {
            elements.registerUsername.setAttribute("aria-invalid", "true");
            elements.registerUsername.focus();
            elements.registerUsername.select();
          }
        } finally {
          setAuthBusy("register", false);
        }
      }

      async function completeAuthentication() {
        var session = await requestJson("/auth/v1/session");
        if (!isObject(session) || session.authenticated !== true) {
          throw new Error("账户已验证，但未能建立登录会话，请重试。");
        }
        state.session = session;
        setTopAuthVisibility(false);
        setSessionIndicator("ready", authenticatedSessionLabel());
        setGlobalStatus("账户验证成功。");

        var returnPath = readSafeReturnPath();
        if (returnPath !== "/") {
          window.location.assign(returnPath);
          return;
        }
        closeAuthDialog(true, false);
        await loadOverview(true);
      }

      function setAuthBusy(mode, busy) {
        var loginMode = mode === "login";
        var form = loginMode ? elements.loginForm : elements.registerForm;
        var button = loginMode ? elements.loginButton : elements.registerButton;
        Array.from(form.elements).forEach(function (control) {
          control.disabled = busy;
        });
        elements.loginTab.disabled = busy;
        elements.registerTab.disabled = busy;
        elements.closeAuthButton.disabled = busy;
        state.authBusy = busy;
        elements.authDialog.setAttribute("aria-busy", busy ? "true" : "false");
        form.setAttribute("aria-busy", busy ? "true" : "false");
        button.setAttribute("aria-busy", busy ? "true" : "false");
        button.textContent = busy
          ? (loginMode ? "正在登录…" : "正在注册…")
          : (loginMode ? "登录账户" : "注册并进入工作台");
      }

      async function logout() {
        setButtonBusy(elements.logoutButton, true, "正在退出…");
        showAccountNotice("正在退出当前账户…", false);

        try {
          await requestJson("/auth/v1/logout", {
            method: "POST",
            body: JSON.stringify({})
          });
          state.session = null;
          state.overview = null;
          state.availableProviders = [];
          setSessionIndicator("idle", "未登录");
          setTopAuthVisibility(true);
          showView("public");
          hidePublicAccountNotice();
          setAuthMode("login", false);
          hideAccountNotice();
          setGlobalStatus("已安全退出登录。");
          elements.openLoginButton.focus();
        } catch (error) {
          showAccountNotice(describeError(error, "退出登录失败，请重试。"), true);
        } finally {
          setButtonBusy(elements.logoutButton, false, "退出登录");
        }
      }

      function renderAccount() {
        var overview = state.overview || {};
        var sessionUser = isObject(state.session && state.session.user)
          ? state.session.user
          : {};
        var overviewUser = isObject(overview.user) ? overview.user : {};
        var user = Object.keys(overviewUser).length > 0 ? overviewUser : sessionUser;
        var providers = arrayValue(overview.providers);
        var consumers = arrayValue(overview.consumers);
        var requests = arrayValue(overview.requests);
        var pointLedger = arrayValue(overview.pointLedger);

        elements.userName.textContent = firstString(user, ["displayName", "username", "name", "nickname"])
          || "Token Relay 用户";
        renderExpiry();
        renderSummary(providers, consumers, requests, overview.summary);
        renderProviderOptions();
        renderProviders(providers);
        renderConsumers(consumers);
        renderRequests(requests);
        renderPointLedger(pointLedger);
      }

      function renderExpiry() {
        var expiresAt = state.session && state.session.expiresAt;
        if (!expiresAt) {
          elements.sessionExpiry.textContent = "";
          return;
        }
        var formatted = formatDateTime(expiresAt);
        elements.sessionExpiry.textContent = formatted ? "会话有效至 " + formatted : "";
      }

      function renderSummary(providers, consumers, requests, rawSummary) {
        var summary = isObject(rawSummary) ? rawSummary : {};
        var providerCount = firstNumber(summary, ["providers", "providerCount", "providersTotal", "totalProviders"]);
        var consumerCount = firstNumber(summary, ["consumers", "consumerCount", "consumersTotal", "totalConsumers"]);
        var requestCount = firstNumber(summary, ["requests", "requestCount", "requestsTotal", "totalRequests"]);
        var tokenCount = firstNumber(summary, [
          "consumerTokensUsed",
          "totalTokens",
          "tokensUsed",
          "usedTokens",
          "tokenUsage"
        ]);
        var providedTokens = firstNumber(summary, ["providerTokensServed"]);
        var pointBalance = firstNumber(summary, ["pointBalance"]);
        var pointsReserved = firstNumber(summary, ["pointsReserved"]);
        var availablePoints = firstNumber(summary, ["availablePoints"]);
        var pointsSpent = firstNumber(summary, ["pointsSpent"]);
        var pointsEarned = firstNumber(summary, ["pointsEarned"]);
        var onlineCount = firstNumber(summary, ["onlineProviderCount", "providersOnline", "onlineProviders"]);
        var successCount = firstNumber(summary, ["successfulRequestCount", "requestsSucceeded", "successRequests"]);

        if (providerCount === null) {
          providerCount = providers.length;
        }
        if (consumerCount === null) {
          consumerCount = consumers.length;
        }
        if (requestCount === null) {
          requestCount = requests.length;
        }
        if (onlineCount === null) {
          onlineCount = providers.filter(providerOnline).length;
        }
        if (successCount === null) {
          successCount = requests.filter(function (request) {
            var status = firstString(request, ["status", "state"]).toLowerCase();
            return status === "completed" || status === "succeeded" || status === "success";
          }).length;
        }
        if (tokenCount === null) {
          tokenCount = requests.reduce(function (total, request) {
            return total + requestTokens(request);
          }, 0);
        }
        providedTokens = providedTokens === null ? 0 : providedTokens;
        pointBalance = pointBalance === null ? 0 : pointBalance;
        pointsReserved = pointsReserved === null ? 0 : pointsReserved;
        availablePoints = availablePoints === null
          ? pointBalance - pointsReserved
          : availablePoints;
        pointsSpent = pointsSpent === null ? 0 : pointsSpent;
        pointsEarned = pointsEarned === null ? 0 : pointsEarned;

        elements.summaryProviders.textContent = formatNumber(providerCount);
        elements.summaryProvidersDetail.textContent = formatNumber(onlineCount) + " 个在线";
        elements.summaryConsumers.textContent = formatNumber(consumerCount);
        elements.summaryConsumersDetail.textContent = consumerCount > 0
          ? "已分配的调用凭据"
          : "尚未分配调用凭据";
        elements.summaryRequests.textContent = formatNumber(requestCount);
        elements.summaryRequestsDetail.textContent = formatNumber(successCount) + " 个成功";
        elements.summaryPoints.textContent = formatCompactNumber(availablePoints);
        elements.summaryPoints.title = formatNumber(availablePoints);
        elements.summaryPointsDetail.textContent = "余额 "
          + formatNumber(pointBalance)
          + " · 预留 "
          + formatNumber(pointsReserved);
        elements.summaryTokens.textContent = formatCompactNumber(tokenCount);
        elements.summaryTokens.title = formatNumber(tokenCount);
        elements.summaryTokensDetail.textContent = "累计消费 · 扣除 "
          + formatNumber(pointsSpent)
          + " 积分";
        elements.summaryProvidedTokens.textContent = formatCompactNumber(providedTokens);
        elements.summaryProvidedTokens.title = formatNumber(providedTokens);
        elements.summaryProvidedDetail.textContent = "累计提供 · 获得 "
          + formatNumber(pointsEarned)
          + " 积分";
      }

      function renderProviderOptions() {
        var previous = elements.consumerProvider.value;
        elements.consumerProvider.replaceChildren();

        var placeholder = document.createElement("option");
        var selectableCount = state.availableProviders.filter(providerSelectable).length;
        placeholder.value = "";
        placeholder.textContent = selectableCount > 0
          ? "选择 Provider"
          : "暂无当前可用 Provider";
        elements.consumerProvider.appendChild(placeholder);

        state.availableProviders.forEach(function (provider) {
          if (!isObject(provider)) {
            return;
          }
          var id = firstString(provider, ["id", "providerId"]);
          if (!id) {
            return;
          }
          var option = document.createElement("option");
          option.value = id;
          option.textContent = firstString(provider, ["displayName", "name"])
            || "未命名 Provider";
          if (!providerSelectable(provider)) {
            option.disabled = true;
            option.textContent += providerOnline(provider) === false && hasOnlineSignal(provider)
              ? "（离线）"
              : "（当前不可用）";
          }
          elements.consumerProvider.appendChild(option);
        });

        var canRestore = state.availableProviders.some(function (provider) {
          return isObject(provider)
            && firstString(provider, ["id", "providerId"]) === previous
            && providerSelectable(provider);
        });
        if (canRestore) {
          elements.consumerProvider.value = previous;
        }
        elements.consumerProvider.disabled = selectableCount === 0;
        renderModelOptions();
      }

      function renderModelOptions() {
        var selectedId = elements.consumerProvider.value;
        var selectedProvider = state.availableProviders.find(function (provider) {
          return isObject(provider)
            && firstString(provider, ["id", "providerId"]) === selectedId;
        });
        var previous = elements.consumerModel.value;
        var models = providerModels(selectedProvider);

        elements.consumerModel.replaceChildren();
        var placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = selectedProvider
          ? (models.length > 0 ? "选择模型" : "此 Provider 暂无模型")
          : "先选择 Provider";
        elements.consumerModel.appendChild(placeholder);

        models.forEach(function (model) {
          var option = document.createElement("option");
          option.value = model;
          option.textContent = model;
          elements.consumerModel.appendChild(option);
        });

        if (models.indexOf(previous) >= 0) {
          elements.consumerModel.value = previous;
        }
        elements.consumerModel.disabled = !selectedProvider
          || !providerSelectable(selectedProvider)
          || models.length === 0;
        elements.createConsumerButton.disabled = !selectedProvider
          || !providerSelectable(selectedProvider)
          || models.length === 0;
      }

      function renderProviders(providers) {
        elements.providersBody.replaceChildren();
        elements.providersEmpty.hidden = providers.length > 0;
        elements.providersTableWrap.hidden = providers.length === 0;

        providers.forEach(function (provider) {
          if (!isObject(provider)) {
            return;
          }
          var row = document.createElement("tr");
          var nameCell = document.createElement("td");
          appendTextBlock(
            nameCell,
            firstString(provider, ["displayName", "name"]) || "未命名 Provider",
            firstString(provider, ["id", "providerId"])
          );

          var statusCell = document.createElement("td");
          statusCell.appendChild(providerStatusBadge(provider));

          var modelsCell = document.createElement("td");
          var models = providerModels(provider);
          modelsCell.textContent = models.length > 0 ? models.join("、") : "等待设备上报";

          var quotaCell = document.createElement("td");
          quotaCell.textContent = formatQuota(provider);

          var concurrencyCell = document.createElement("td");
          concurrencyCell.textContent = formatConcurrency(provider);

          var listingCell = document.createElement("td");
          var listingButton = document.createElement("button");
          var isListed = provider.listed === true;
          listingButton.type = "button";
          listingButton.className = "secondary";
          listingButton.textContent = isListed ? "已上架 · 下架" : "未上架 · 上架";
          listingButton.setAttribute("aria-pressed", isListed ? "true" : "false");
          listingButton.setAttribute(
            "aria-label",
            (isListed ? "从模型目录下架 " : "上架到模型目录 ")
              + (firstString(provider, ["displayName", "name"]) || "Provider")
          );
          listingButton.addEventListener("click", function () {
            toggleProviderListing(provider, listingButton);
          });
          listingCell.appendChild(listingButton);

          var secretCell = document.createElement("td");
          secretCell.textContent = firstString(provider, [
            "providerTokenPrefix",
            "tokenPrefix",
            "credentialPrefix"
          ]) || "—";

          row.append(
            nameCell,
            statusCell,
            modelsCell,
            quotaCell,
            concurrencyCell,
            listingCell,
            secretCell
          );
          elements.providersBody.appendChild(row);
        });
      }

      async function toggleProviderListing(provider, button) {
        var providerId = firstString(provider, ["id", "providerId"]);
        if (!providerId) {
          return;
        }
        var nextListed = provider.listed !== true;
        setButtonBusy(button, true, nextListed ? "正在上架…" : "正在下架…");
        try {
          await requestJson(
            "/account/v1/providers/" + encodeURIComponent(providerId),
            {
              method: "PATCH",
              body: JSON.stringify({ listed: nextListed })
            }
          );
          showAccountNotice(
            nextListed
              ? "Provider 已上架；在线并上报模型后会出现在公开目录。"
              : "Provider 已下架；已有 Consumer 仍可继续使用。",
            false
          );
          await refreshOverviewAfterCreate();
        } catch (error) {
          showAccountNotice(
            describeError(error, nextListed ? "上架 Provider 失败。" : "下架 Provider 失败。"),
            true
          );
          setButtonBusy(
            button,
            false,
            provider.listed === true ? "已上架 · 下架" : "未上架 · 上架"
          );
        }
      }

      function renderConsumers(consumers) {
        elements.consumersBody.replaceChildren();
        elements.consumersEmpty.hidden = consumers.length > 0;
        elements.consumersTableWrap.hidden = consumers.length === 0;

        consumers.forEach(function (consumer) {
          if (!isObject(consumer)) {
            return;
          }
          var row = document.createElement("tr");
          var nameCell = document.createElement("td");
          appendTextBlock(
            nameCell,
            firstString(consumer, ["displayName", "name"]) || "未命名 Consumer",
            firstString(consumer, ["id", "consumerId"])
          );

          var statusCell = document.createElement("td");
          statusCell.appendChild(enabledStatusBadge(consumer));

          var routeCell = document.createElement("td");
          var providerName = firstString(consumer, ["providerName", "providerDisplayName", "providerId"])
            || "未知 Provider";
          appendTextBlock(routeCell, providerName, firstString(consumer, ["model", "modelName"]));

          var quotaCell = document.createElement("td");
          quotaCell.textContent = formatQuota(consumer);

          var concurrencyCell = document.createElement("td");
          concurrencyCell.textContent = formatConcurrency(consumer);

          var secretCell = document.createElement("td");
          secretCell.textContent = firstString(consumer, [
            "apiKeyPrefix",
            "consumerKeyPrefix",
            "keyPrefix",
            "credentialPrefix"
          ]) || "—";

          row.append(nameCell, statusCell, routeCell, quotaCell, concurrencyCell, secretCell);
          elements.consumersBody.appendChild(row);
        });
      }

      function renderRequests(requests) {
        elements.requestsBody.replaceChildren();
        elements.requestsEmpty.hidden = requests.length > 0;
        elements.requestsTableWrap.hidden = requests.length === 0;

        requests.forEach(function (request) {
          if (!isObject(request)) {
            return;
          }
          var row = document.createElement("tr");
          var timeCell = document.createElement("td");
          appendTextBlock(
            timeCell,
            formatDateTime(firstValue(request, ["createdAt", "startedAt", "requestedAt"])) || "时间未知",
            firstString(request, ["id", "requestId"])
          );

          var statusCell = document.createElement("td");
          statusCell.appendChild(requestStatusBadge(request));

          var routeCell = document.createElement("td");
          var consumerName = firstString(request, ["consumerName", "consumerId"]) || "未知 Consumer";
          var providerName = firstString(request, ["providerName", "providerId"]) || "未知 Provider";
          appendTextBlock(routeCell, consumerName, providerName);

          var modelCell = document.createElement("td");
          modelCell.textContent = firstString(request, ["model", "modelName"]) || "—";

          var tokenCell = document.createElement("td");
          tokenCell.textContent = formatNumber(requestTokens(request));

          var durationCell = document.createElement("td");
          durationCell.textContent = formatDuration(request);

          row.append(timeCell, statusCell, routeCell, modelCell, tokenCell, durationCell);
          elements.requestsBody.appendChild(row);
        });
      }

      function renderPointLedger(entries) {
        elements.ledgerBody.replaceChildren();
        elements.ledgerEmpty.hidden = entries.length > 0;
        elements.ledgerTableWrap.hidden = entries.length === 0;

        entries.forEach(function (entry) {
          if (!isObject(entry)) {
            return;
          }
          var row = document.createElement("tr");
          var timeCell = document.createElement("td");
          timeCell.textContent = formatDateTime(firstValue(entry, ["createdAt"]))
            || "时间未知";

          var kindCell = document.createElement("td");
          var kind = firstString(entry, ["kind"]);
          var labels = {
            initial_grant: "初始积分",
            consumer_spend: "Consumer 消费",
            provider_earn: "Provider 收益"
          };
          kindCell.textContent = labels[kind] || kind || "未知";

          var deltaCell = document.createElement("td");
          var delta = firstNumber(entry, ["delta"]);
          delta = delta === null ? 0 : delta;
          deltaCell.textContent = (delta > 0 ? "+" : "") + formatNumber(delta);

          var requestCell = document.createElement("td");
          requestCell.textContent = firstString(entry, ["requestId"]) || "—";

          row.append(timeCell, kindCell, deltaCell, requestCell);
          elements.ledgerBody.appendChild(row);
        });
      }

      function renderProviderGuideExamples() {
        elements.providerInstallExample.textContent = [
          "npm install -g @anarkhli/provider-sdk",
          "token-relay-provider version"
        ].join("\\n");

        var config = {
          relayUrl: providerWebSocketUrl(),
          providerToken: "$" + "{TOKEN_RELAY_PROVIDER_TOKEN}",
          concurrency: 1,
          jobTimeoutMs: 300000,
          maxOutputBytes: 2097152,
          models: {
            "gpt-5.6-sol": {
              adapter: "codex",
              command: "codex",
              cliModel: "gpt-5.6-sol"
            }
          }
        };
        elements.providerConfigExample.textContent = JSON.stringify(config, null, 2);
        elements.providerStartExample.textContent = [
          "export TOKEN_RELAY_PROVIDER_TOKEN='粘贴创建时显示的令牌'",
          "token-relay-provider doctor --config provider.config.json",
          "token-relay-provider start --config provider.config.json"
        ].join("\\n");
      }

      function providerWebSocketUrl() {
        var url = new URL(window.location.href);
        url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
        url.pathname = "/provider/v1/connect";
        url.search = "";
        url.hash = "";
        return url.toString();
      }

      async function copyProviderGuideBlock(source, button, label) {
        var value = String(source.textContent || "").trim();
        if (!value) {
          return;
        }
        resetProviderGuideCopyButtons();
        try {
          await copyPlainText(value);
          button.textContent = "已复制";
          elements.providerGuideCopyStatus.textContent = label + "已复制到剪贴板。";
        } catch (error) {
          elements.providerGuideCopyStatus.textContent = "自动复制失败，请选中代码手动复制。";
        }
      }

      async function copyPlainText(value) {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(value);
          return;
        }
        var helper = document.createElement("textarea");
        helper.value = value;
        helper.readOnly = true;
        helper.setAttribute("aria-hidden", "true");
        helper.style.position = "fixed";
        helper.style.left = "-10000px";
        helper.style.top = "0";
        document.body.appendChild(helper);
        helper.focus();
        helper.select();
        var copied = document.execCommand("copy");
        helper.remove();
        if (!copied) {
          throw new Error("copy unavailable");
        }
      }

      function resetProviderGuideCopyButtons() {
        elements.copyProviderInstallButton.textContent = "复制安装命令";
        elements.copyProviderConfigButton.textContent = "复制配置";
        elements.copyProviderStartButton.textContent = "复制启动命令";
      }

      async function createProvider(event) {
        event.preventDefault();
        setFormStatus(elements.providerFormStatus, "", false);
        if (!elements.providerForm.reportValidity()) {
          return;
        }

        var body = {
          name: elements.providerName.value.trim(),
          listed: elements.providerListed.checked,
          tokenLimit: positiveInteger(elements.providerTokenLimit.value),
          maxConcurrent: positiveInteger(elements.providerMaxConcurrent.value)
        };
        if (!body.name || body.tokenLimit === null || body.maxConcurrent === null) {
          setFormStatus(elements.providerFormStatus, "请填写有效的名称、额度和并发数。", true);
          return;
        }

        setButtonBusy(elements.createProviderButton, true, "正在创建…");
        setFormStatus(elements.providerFormStatus, "正在创建 Provider…", false);

        try {
          var response = await requestJson("/account/v1/providers", {
            method: "POST",
            body: JSON.stringify(body)
          });
          var token = isObject(response)
            ? firstString(response, ["providerToken"])
            : "";
          if (!token) {
            throw new Error("Provider 已创建，但服务端未返回一次性连接令牌。");
          }
          elements.providerForm.reset();
          setFormStatus(elements.providerFormStatus, "Provider 已创建。", false);
          showSecret(
            "provider",
            "Provider 连接令牌",
            "先复制并保存令牌，再按下方步骤启动 Provider SDK。完整令牌只显示这一次。",
            token,
            elements.providerGuideTitle
          );
          await refreshOverviewAfterCreate();
        } catch (error) {
          setFormStatus(
            elements.providerFormStatus,
            describeError(error, "创建 Provider 失败。"),
            true
          );
        } finally {
          setButtonBusy(elements.createProviderButton, false, "创建并生成令牌");
        }
      }

      async function createConsumer(event) {
        event.preventDefault();
        setFormStatus(elements.consumerFormStatus, "", false);
        if (!elements.consumerForm.reportValidity()) {
          return;
        }

        var body = {
          name: elements.consumerName.value.trim(),
          providerId: elements.consumerProvider.value,
          model: elements.consumerModel.value,
          tokenLimit: positiveInteger(elements.consumerTokenLimit.value),
          maxConcurrent: positiveInteger(elements.consumerMaxConcurrent.value)
        };
        if (!body.name
          || !body.providerId
          || !body.model
          || body.tokenLimit === null
          || body.maxConcurrent === null) {
          setFormStatus(elements.consumerFormStatus, "请填写有效的 Consumer 配置。", true);
          return;
        }

        setButtonBusy(elements.createConsumerButton, true, "正在创建…");
        setFormStatus(elements.consumerFormStatus, "正在创建 Consumer…", false);

        try {
          var response = await requestJson("/account/v1/consumers", {
            method: "POST",
            body: JSON.stringify(body)
          });
          var apiKey = isObject(response)
            ? firstString(response, ["apiKey"])
            : "";
          if (!apiKey) {
            throw new Error("Consumer 已创建，但服务端未返回一次性 API Key。");
          }
          elements.consumerForm.reset();
          setFormStatus(elements.consumerFormStatus, "Consumer 已创建。", false);
          showSecret(
            "consumer",
            "Consumer API Key",
            "请将此 API Key 保存到 Consumer 的安全配置中。完整 Key 只显示这一次。",
            apiKey,
            elements.createConsumerButton
          );
          await refreshOverviewAfterCreate();
        } catch (error) {
          setFormStatus(
            elements.consumerFormStatus,
            describeError(error, "创建 Consumer 失败。"),
            true
          );
        } finally {
          setButtonBusy(elements.createConsumerButton, false, "创建并生成 API Key");
          renderModelOptions();
        }
      }

      async function refreshOverviewAfterCreate() {
        try {
          var overview = await requestJson("/account/v1/overview");
          state.overview = isObject(overview) ? overview : {};
          state.availableProviders = arrayValue(state.overview.availableProviders);
          renderAccount();
          hideAccountNotice();
        } catch (error) {
          showAccountNotice(
            describeError(error, "资源已创建，但列表刷新失败。请稍后重新加载页面。"),
            true
          );
        }
      }

      function showSecret(kind, title, description, secret, returnFocus) {
        var providerMode = kind === "provider";
        state.secretReturnFocus = returnFocus;
        state.secretCopyLabel = providerMode ? "复制 Provider Token" : "复制 API Key";
        elements.secretTitle.textContent = title;
        elements.secretDescription.textContent = description;
        elements.secretValue.value = secret;
        elements.copyStatus.textContent = "";
        elements.copySecretButton.textContent = state.secretCopyLabel;
        elements.providerSecretNext.hidden = !providerMode;
        elements.showProviderGuideButton.hidden = !providerMode;
        elements.secretDialog.classList.toggle("is-provider-secret", providerMode);
        elements.secretDialog.showModal();
        window.setTimeout(function () {
          elements.secretValue.focus();
          elements.secretValue.select();
        }, 0);
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
        } catch (error) {
          elements.copyStatus.textContent = "无法自动复制，请选中上方凭据并手动复制。";
          elements.secretValue.focus();
          elements.secretValue.select();
        }
      }

      function closeSecret() {
        elements.secretDialog.close();
      }

      function closeSecretAndShowProviderGuide() {
        state.secretReturnFocus = elements.providerGuideTitle;
        elements.secretDialog.close();
        window.requestAnimationFrame(function () {
          elements.providerGuide.scrollIntoView({ block: "start" });
        });
      }

      function clearSecret() {
        elements.secretValue.value = "";
        elements.copyStatus.textContent = "";
        elements.copySecretButton.textContent = "复制凭据";
        elements.providerSecretNext.hidden = true;
        elements.showProviderGuideButton.hidden = true;
        elements.secretDialog.classList.remove("is-provider-secret");
        state.secretCopyLabel = "复制凭据";
        var target = state.secretReturnFocus;
        state.secretReturnFocus = null;
        if (target && document.contains(target) && !target.disabled) {
          target.focus();
        }
      }

      function showAccountNotice(message, isError) {
        elements.accountNotice.hidden = false;
        elements.accountNotice.classList.toggle("is-error", isError);
        elements.accountNotice.setAttribute("role", isError ? "alert" : "status");
        elements.accountNotice.textContent = message;
      }

      function hideAccountNotice() {
        elements.accountNotice.hidden = true;
        elements.accountNotice.classList.remove("is-error");
        elements.accountNotice.textContent = "";
      }

      function setFormStatus(element, message, isError) {
        element.textContent = message;
        element.classList.toggle("is-error", isError);
        element.setAttribute("role", isError ? "alert" : "status");
      }

      function setButtonBusy(button, busy, busyLabel) {
        button.disabled = busy;
        button.setAttribute("aria-busy", busy ? "true" : "false");
        button.textContent = busyLabel;
      }

      async function requestJson(path, options) {
        var requestOptions = options || {};
        var headers = {
          "Accept": "application/json"
        };
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
          } catch (error) {
            payload = null;
          }
        }

        if (!response.ok) {
          var requestError = new Error(errorMessage(payload)
            || "请求失败（HTTP " + response.status + "）。");
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
        if (error && typeof error.message === "string" && error.message.trim()) {
          return error.message.trim();
        }
        return fallback;
      }

      function isObject(value) {
        return value !== null && typeof value === "object" && !Array.isArray(value);
      }

      function arrayValue(value) {
        return Array.isArray(value) ? value : [];
      }

      function firstValue(object, keys) {
        if (!isObject(object)) {
          return null;
        }
        for (var index = 0; index < keys.length; index += 1) {
          var value = object[keys[index]];
          if (value !== undefined && value !== null) {
            return value;
          }
        }
        return null;
      }

      function firstString(object, keys) {
        var value = firstValue(object, keys);
        return typeof value === "string" ? value.trim() : "";
      }

      function firstNumber(object, keys) {
        if (!isObject(object)) {
          return null;
        }
        for (var index = 0; index < keys.length; index += 1) {
          var value = object[keys[index]];
          if (typeof value === "number" && Number.isFinite(value)) {
            return value;
          }
        }
        return null;
      }

      function positiveInteger(value) {
        var parsed = Number(value);
        return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
      }

      function providerModels(provider) {
        if (!isObject(provider)) {
          return [];
        }
        var rawModels = provider.models;
        if (Array.isArray(rawModels)) {
          return rawModels.map(function (model) {
            if (typeof model === "string") {
              return model.trim();
            }
            if (isObject(model)) {
              return firstString(model, ["name", "model", "id"]);
            }
            return "";
          }).filter(Boolean);
        }
        if (isObject(rawModels)) {
          return Object.keys(rawModels);
        }
        var singleModel = firstString(provider, ["model", "modelName"]);
        return singleModel ? [singleModel] : [];
      }

      function hasOnlineSignal(provider) {
        return isObject(provider)
          && (typeof provider.online === "boolean"
            || typeof provider.connected === "boolean"
            || typeof provider.status === "string"
            || typeof provider.state === "string");
      }

      function providerOnline(provider) {
        if (!isObject(provider)) {
          return false;
        }
        if (typeof provider.online === "boolean") {
          return provider.online;
        }
        if (typeof provider.connected === "boolean") {
          return provider.connected;
        }
        var status = firstString(provider, ["status", "state"]).toLowerCase();
        return status === "online" || status === "ready" || status === "connected";
      }

      function providerSelectable(provider) {
        if (!isObject(provider) || provider.enabled === false) {
          return false;
        }
        if (typeof provider.bindable === "boolean") {
          return provider.bindable;
        }
        return provider.available !== false;
      }

      function providerStatusBadge(provider) {
        if (provider.enabled === false) {
          return createBadge("已停用", "danger");
        }
        if (providerOnline(provider)) {
          return createBadge("在线", "success");
        }
        return createBadge("离线", "warning");
      }

      function enabledStatusBadge(resource) {
        if (resource.enabled === false || resource.active === false) {
          return createBadge("已停用", "danger");
        }
        return createBadge("可用", "success");
      }

      function requestStatusBadge(request) {
        var status = firstString(request, ["status", "state"]).toLowerCase();
        var labels = {
          completed: "已完成",
          succeeded: "已完成",
          success: "已完成",
          reserved: "已预留",
          pending: "等待中",
          queued: "等待中",
          running: "执行中",
          dispatched: "执行中",
          failed: "失败",
          error: "失败",
          cancelled: "已取消",
          canceled: "已取消",
          timed_out: "已超时",
          timeout: "已超时",
          interrupted: "已中断"
        };
        var kind = status === "completed" || status === "succeeded" || status === "success"
          ? "success"
          : (status === "failed"
            || status === "error"
            || status === "timed_out"
            || status === "timeout"
              ? "danger"
              : "warning");
        return createBadge(labels[status] || status || "未知", kind);
      }

      function createBadge(label, kind) {
        var badge = document.createElement("span");
        badge.className = "badge" + (kind ? " " + kind : "");
        badge.textContent = label;
        return badge;
      }

      function appendTextBlock(cell, main, sub) {
        var mainElement = document.createElement("span");
        mainElement.className = "cell-main";
        mainElement.textContent = main || "—";
        cell.appendChild(mainElement);
        if (sub) {
          var subElement = document.createElement("span");
          subElement.className = "cell-sub";
          subElement.textContent = sub;
          cell.appendChild(subElement);
        }
      }

      function formatQuota(resource) {
        var used = firstNumber(resource, ["usedTokens", "tokenUsed", "tokensUsed", "consumedTokens"]);
        var reserved = firstNumber(resource, ["reservedTokens", "tokenReserved", "tokensReserved"]);
        var limit = firstNumber(resource, ["tokenLimit", "limitTokens", "totalTokenLimit"]);
        used = used === null ? 0 : used;
        reserved = reserved === null ? 0 : reserved;
        if (limit === null) {
          return formatNumber(used + reserved) + " 已使用";
        }
        return formatNumber(used + reserved) + " / " + formatNumber(limit);
      }

      function formatConcurrency(resource) {
        var active = firstNumber(resource, ["activeRequests", "activeConcurrent", "concurrent"]);
        var limit = firstNumber(resource, ["maxConcurrent", "concurrencyLimit"]);
        active = active === null ? 0 : active;
        return limit === null
          ? formatNumber(active) + " 个进行中"
          : formatNumber(active) + " / " + formatNumber(limit);
      }

      function requestTokens(request) {
        var direct = firstNumber(request, [
          "totalTokens",
          "tokens",
          "tokenCount",
          "usedTokens"
        ]);
        if (direct !== null) {
          return direct;
        }
        var usage = isObject(request.usage) ? request.usage : {};
        var total = firstNumber(usage, ["totalTokens", "total_tokens"]);
        if (total !== null) {
          return total;
        }
        var prompt = firstNumber(usage, ["promptTokens", "inputTokens", "prompt_tokens", "input_tokens"]);
        var completion = firstNumber(usage, [
          "completionTokens",
          "outputTokens",
          "completion_tokens",
          "output_tokens"
        ]);
        return (prompt || 0) + (completion || 0);
      }

      function formatDuration(request) {
        var duration = firstNumber(request, ["durationMs", "latencyMs", "elapsedMs"]);
        if (duration === null) {
          var started = Date.parse(firstValue(request, ["startedAt", "createdAt"]) || "");
          var finished = Date.parse(firstValue(request, ["completedAt", "finishedAt", "updatedAt"]) || "");
          if (Number.isFinite(started) && Number.isFinite(finished) && finished >= started) {
            duration = finished - started;
          }
        }
        if (duration === null) {
          return "—";
        }
        if (duration < 1000) {
          return Math.round(duration) + " ms";
        }
        return (duration / 1000).toFixed(duration < 10000 ? 1 : 0) + " s";
      }

      function formatDateTime(value) {
        if (value === null || value === undefined || value === "") {
          return "";
        }
        var date = new Date(value);
        if (!Number.isFinite(date.getTime())) {
          return "";
        }
        return new Intl.DateTimeFormat("zh-CN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false
        }).format(date);
      }

      function formatNumber(value) {
        var number = typeof value === "number" && Number.isFinite(value) ? value : 0;
        return new Intl.NumberFormat("zh-CN", {
          maximumFractionDigits: 0
        }).format(number);
      }

      function formatCompactNumber(value) {
        var number = typeof value === "number" && Number.isFinite(value) ? value : 0;
        return new Intl.NumberFormat("zh-CN", {
          notation: "compact",
          maximumFractionDigits: 1
        }).format(number);
      }
    }());
  </script>
</body>
</html>`;
}
