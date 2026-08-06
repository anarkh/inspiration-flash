import assert from "node:assert/strict";
import test from "node:test";
import { dashboardHtml } from "../apps/relay-server/dist/dashboard.js";
import { modelCatalogHtml } from "../apps/relay-server/dist/model-catalog.js";
import { userDashboardHtml } from "../apps/relay-server/dist/user-dashboard.js";

function assertUniqueDomIds(html, surface) {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(
    new Set(ids).size,
    ids.length,
    `${surface} should not contain duplicate DOM ids`
  );
}

test("admin dashboard is self-contained and its inline script parses", () => {
  const html = dashboardHtml();
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /Content-Security-Policy/);
  assert.doesNotMatch(html, /<script[^>]+src=/i);
  assert.doesNotMatch(html, /<link[^>]+href=["']https?:/i);
  assert.doesNotMatch(html, /\.innerHTML\s*=/);
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, "dashboard should contain one inline application script");
  assert.doesNotThrow(() => new Function(script));
});

test("user dashboard is self-contained and uses only cookie-scoped account APIs", () => {
  const html = userDashboardHtml();
  const topbar = html.match(/<header class="topbar">([\s\S]*?)<\/header>/)?.[0];
  const authDialog = html.match(
    /<dialog id="auth-dialog"[\s\S]*?<\/dialog>/
  )?.[0];

  assert.ok(topbar, "user dashboard should contain a topbar");
  assert.match(
    topbar,
    /<div id="top-auth-actions" class="top-auth-actions" hidden>/
  );
  assert.match(
    topbar,
    /<button id="open-login-button"[^>]+type="button"[^>]+aria-haspopup="dialog"[^>]+aria-controls="auth-dialog"[^>]*>登录<\/button>/
  );
  assert.match(
    topbar,
    /<button id="open-register-button"[^>]+type="button"[^>]+aria-haspopup="dialog"[^>]+aria-controls="auth-dialog"[^>]*>注册<\/button>/
  );
  assert.match(
    html,
    /<section id="public-home" class="public-home" aria-labelledby="public-title">/
  );
  assert.match(html, /公开功能概览 · 无需登录/);
  assert.match(html, /使用者 · Consumer/);
  assert.match(html, /中转服务 · Relay/);
  assert.match(html, /提供者 · Provider/);
  assert.match(html, /GET \/v1\/models/);
  assert.match(html, /POST \/v1\/chat\/completions/);
  assert.match(html, /POST \/v1\/messages/);
  assert.match(html, /WS \/provider\/v1\/connect/);
  assert.match(html, /OpenAI-compatible 非流式文本对话子集/);
  assert.match(html, /Consumer 可以绑定本人 Provider/);
  assert.match(html, /由所有者主动公开的 Provider/);
  assert.match(html, /href="\/models"/);
  assert.match(html, /id="provider-listed"/);
  assert.match(
    html,
    /<section id="provider-guide" class="panel provider-guide" aria-labelledby="provider-guide-title">/
  );
  assert.match(html, /id="provider-guide-title" tabindex="-1">创建 Provider 后，按这 4 步真正上线/);
  assert.match(html, /Node\.js 22\.13\+/);
  assert.match(html, /id="provider-install-example"/);
  assert.match(html, /id="provider-config-example"/);
  assert.match(html, /id="provider-start-example"/);
  assert.match(html, /id="provider-guide-copy-status"[^>]+aria-live="polite"/);
  assert.match(
    html,
    /id="provider-secret-next" class="provider-secret-next"[^>]+hidden/
  );
  assert.match(
    html,
    /id="show-provider-guide-button"[^>]+hidden>我已保存，查看接入文档/
  );
  assert.ok(
    html.indexOf('id="provider-guide"') < html.indexOf('id="secret-dialog"'),
    "persistent Provider guide should live outside the one-time secret dialog"
  );
  assert.match(html, /npm install -g @anarkhli\/provider-sdk/);
  assert.match(html, /id="summary-points"/);
  assert.match(html, /id="summary-provided-tokens"/);
  assert.match(html, /id="ledger-body"/);
  assert.match(html, /id="account-state" aria-labelledby="account-title" hidden/);
  assert.ok(authDialog, "authentication forms should be inside a native dialog");
  assert.match(
    authDialog,
    /aria-labelledby="auth-dialog-title" aria-describedby="auth-dialog-description"/
  );
  assert.match(authDialog, /id="auth-dialog-title">登录或注册账户<\/h2>/);
  assert.match(
    authDialog,
    /<button id="close-auth-button"[^>]+aria-label="关闭账户弹窗"/
  );
  assert.match(
    authDialog,
    /id="account-access" class="auth-tabs" role="tablist"/
  );
  assert.match(
    authDialog,
    /id="login-tab"[^>]+role="tab"[^>]+aria-controls="login-panel"/
  );
  assert.match(
    authDialog,
    /id="register-tab"[^>]+role="tab"[^>]+aria-controls="register-panel"/
  );
  assert.match(
    authDialog,
    /id="login-panel"[^>]+role="tabpanel"[^>]+aria-labelledby="login-tab"/
  );
  assert.match(
    authDialog,
    /id="register-panel"[^>]+role="tabpanel"[^>]+aria-labelledby="register-tab"/
  );
  assert.match(authDialog, /id="login-form"/);
  assert.match(authDialog, /id="login-username"/);
  assert.match(authDialog, /id="login-password"/);
  assert.match(authDialog, /id="register-form"/);
  assert.match(authDialog, /id="register-display-name"/);
  assert.match(authDialog, /id="register-username"/);
  assert.match(authDialog, /id="register-password"/);
  assert.match(authDialog, /id="register-password-confirm"/);
  assert.doesNotMatch(html, /\bauth-stage\b/);
  assert.doesNotMatch(html, /html\s*\{[^}]*min-width:\s*320px/);
  assert.doesNotMatch(html, /id="(?:loading|logged-out|error)-state"/);
  assert.match(
    html,
    /\.session-indicator\s*\{\s*order:\s*3;[\s\S]{0,300}\.top-auth-actions\s*\{\s*order:\s*0;[\s\S]{0,200}\.top-link\s*\{\s*order:\s*1;/
  );
  assert.match(html, /\/auth\/v1\/session/);
  assert.match(html, /\/auth\/v1\/login/);
  assert.match(html, /\/auth\/v1\/register/);
  assert.match(html, /\/auth\/v1\/logout/);
  assert.match(html, /\/account\/v1\/overview/);
  assert.match(html, /credentials:\s*"same-origin"/);
  assert.doesNotMatch(html, /admin-token/);
  assert.doesNotMatch(html, /\/admin\/v1\//);
  assert.doesNotMatch(html, /Authorization/i);
  assert.doesNotMatch(html, /(?:localStorage|sessionStorage)/);
  assert.doesNotMatch(html, /<script[^>]+src=/i);
  assert.doesNotMatch(html, /<link[^>]+href=["']https?:/i);
  assert.doesNotMatch(html, /\.innerHTML\s*=/);
  assert.doesNotMatch(html, /wechat|微信|扫码|OAuth/i);
  assertUniqueDomIds(html, "user dashboard");
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, "user dashboard should contain one inline application script");
  assert.match(script, /elements\.publicHome\.hidden = name === "account"/);
  assert.match(script, /elements\.authDialog\.showModal\(\)/);
  assert.match(script, /elements\.authDialog\.close\(\)/);
  assert.match(
    script,
    /elements\.authDialog\.addEventListener\("cancel", function \(event\)/
  );
  assert.match(
    script,
    /elements\.authDialog\.addEventListener\("close", handleAuthDialogClosed\)/
  );
  assert.match(script, /state\.authReturnFocus = trigger/);
  assert.match(script, /returnFocus\.focus\(\{\s*preventScroll:\s*true\s*\}\)/);
  assert.match(script, /searchParams\.get\("auth"\)/);
  assert.match(script, /searchParams\.get\("return_to"\)/);
  assert.match(script, /openAuthDialog\(requestedAuthMode, null\)/);
  assert.match(
    script,
    /var authenticatedReturnPath = readRequestedAuthMode\(\)[\s\S]{0,100}\? readSafeReturnPath\(\)[\s\S]{0,100}: "\/";[\s\S]{0,200}window\.location\.replace\(authenticatedReturnPath\)/
  );
  assert.match(script, /window\.location\.assign\(returnPath\)/);
  assert.match(
    script,
    /function handleAuthDialogClosed\(\) \{[\s\S]{0,150}resetAuthSensitiveState\(\)/
  );
  assert.match(script, /elements\.loginPassword\.value = ""/);
  assert.match(script, /elements\.registerPassword\.value = ""/);
  assert.match(script, /elements\.registerPasswordConfirm\.value = ""/);
  assert.match(script, /elements\.loginFormStatus\.textContent = ""/);
  assert.match(script, /elements\.registerFormStatus\.textContent = ""/);
  assert.match(script, /npm install -g @anarkhli\/provider-sdk/);
  assert.match(script, /token-relay-provider doctor --config provider\.config\.json/);
  assert.match(script, /token-relay-provider start --config provider\.config\.json/);
  assert.doesNotMatch(script, /npm run build/);
  assert.doesNotMatch(script, /packages\/provider-sdk\/dist\/cli\.js/);
  assert.match(script, /providerToken: "\$" \+ "\{TOKEN_RELAY_PROVIDER_TOKEN\}"/);
  assert.match(script, /"gpt-5\.6-sol"/);
  assert.match(
    script,
    /url\.protocol = url\.protocol === "https:" \? "wss:" : "ws:"/
  );
  assert.match(script, /url\.pathname = "\/provider\/v1\/connect"/);
  assert.match(
    script,
    /showSecret\(\s*"provider",[\s\S]{0,260}elements\.providerGuideTitle/
  );
  assert.match(
    script,
    /showSecret\(\s*"consumer",[\s\S]{0,260}elements\.createConsumerButton/
  );
  assert.match(
    script,
    /function clearSecret\(\) \{[\s\S]{0,500}elements\.secretValue\.value = ""[\s\S]{0,500}elements\.providerSecretNext\.hidden = true[\s\S]{0,300}elements\.showProviderGuideButton\.hidden = true/
  );
  assert.match(
    html,
    /#secret-dialog \.dialog-body\s*\{[\s\S]{0,180}overflow-y:\s*auto;/
  );
  assert.doesNotThrow(() => new Function(script));
});

test("model catalog is self-contained, filterable, and uses cookie account APIs", () => {
  const html = modelCatalogHtml();
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /data-family="gpt"/);
  assert.match(html, /data-family="claude"/);
  assert.match(html, /data-family="gemini"/);
  assert.match(html, /data-family="deepseek"/);
  assert.match(html, /data-family="qwen"/);
  assert.match(html, /data-family="doubao"/);
  assert.match(html, /data-family="other"/);
  assert.match(html, /\/catalog\/v1\/models/);
  assert.match(html, /\/auth\/v1\/session/);
  assert.match(html, /\/account\/v1\/consumers/);
  assert.match(
    html,
    /<a id="session-action"[^>]+href="\/\?auth=login&amp;return_to=%2Fmodels">登录 \/ 注册<\/a>/
  );
  assert.match(html, /credentials:\s*"same-origin"/);
  assert.doesNotMatch(html, /\/admin\/v1\//);
  assert.doesNotMatch(html, /Authorization/i);
  assert.doesNotMatch(html, /<script[^>]+src=/i);
  assert.doesNotMatch(html, /<link[^>]+href=["']https?:/i);
  assert.doesNotMatch(html, /\.innerHTML\s*=/);
  assert.doesNotMatch(html, /wechat|微信|扫码|OAuth/i);
  assertUniqueDomIds(html, "model catalog");
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, "model catalog should contain one inline application script");
  assert.match(
    script,
    /var LOGIN_PATH = "\/\?auth=login&return_to=%2Fmodels"/
  );
  assert.match(script, /window\.location\.assign\(LOGIN_PATH\)/);
  assert.match(
    script,
    /elements\.accessDialog\.addEventListener\("cancel", function \(event\) \{\s*if \(state\.accessBusy\) \{\s*event\.preventDefault\(\)/
  );
  assert.match(script, /state\.accessBusy = busy/);
  assert.match(
    script,
    /if \(error && error\.status === 401\) \{[\s\S]{0,500}renderSession\(\);[\s\S]{0,100}renderCatalog\(\);[\s\S]{0,300}elements\.accessDialog\.close\(\)/
  );
  assert.match(
    script,
    /state\.session\.authenticated === true\s*\? "创建访问凭据"\s*:\s*"登录后接入"/
  );
  assert.doesNotThrow(() => new Function(script));
});
