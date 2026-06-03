import test from "node:test";
import assert from "node:assert/strict";
import { dashboardHtml } from "../../src/dashboard/page.ts";

test("dashboard page includes runs API and xterm shell", () => {
  const html = dashboardHtml();
  assert.match(html, /Agent Bridge/);
  assert.match(html, /Now Running/);
  assert.match(html, /Run History/);
  assert.match(html, /id="tab-current"/);
  assert.match(html, /id="tab-history"/);
  assert.match(html, /id="run-list"/);
  assert.match(html, /Configured Routes/);
  assert.match(html, /renderRouteRow/);
  assert.match(html, /badge\(enabled \? "ready" : "disabled"\)/);
  assert.match(html, /id="terminal-pane"/);
  assert.match(html, /@xterm\/xterm/);
  assert.match(html, /fetch\("\/api\/runs"\)/);
  assert.match(html, /buildSessions/);
  assert.match(html, /WebSocket/);
  assert.match(html, /\/ws/);
});
