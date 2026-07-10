import http from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { isAbsolute, resolve } from "node:path";
import { StringDecoder } from "node:string_decoder";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config/store.ts";
import { PID_FILE, PORT_FILE, STATE_DIR, PRODUCER_LABELS, bridgeGateTimeoutMs } from "../core/constants.ts";
import type { AppConfig, BridgeRunRecord, ConsumerRunRecord, RawDirectEnvelope, RawHookEnvelope, BridgeResponse } from "../core/types.ts";
import { dashboardHtml } from "../dashboard/page.ts";
import { runBridge, runDirectBridge } from "../bridge/runner.ts";
import { loadBridgeRuns, markInterruptedBridgeRuns } from "../bridge/run-state.ts";
import { streamTerminalLogSnapshot, subscribeTerminalLog, tailTerminalLog, terminalLogPath } from "../terminal/logs.ts";
import { handleTerminalWebSocket, type TerminalSocketTarget } from "../terminal/websocket.ts";
import { ensureDir, pathExists, readJson, readText, writeJson, writeText } from "../utils/fs.ts";

export async function runServiceForeground(): Promise<void> {
  const config = await loadConfig();
  await ensureDir(STATE_DIR);
  const server = http.createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/health") {
        sendJson(response, 200, { ok: true, pid: process.pid });
        return;
      }
      if (request.method === "GET" && (request.url === "/" || request.url === "/dashboard")) {
        sendHtml(response, 200, dashboardHtml());
        return;
      }
      if (request.method === "GET" && request.url === "/api/runs") {
        const [status, config, runs] = await Promise.all([
          serviceStatus(),
          loadConfig(),
          loadBridgeRuns()
        ]);
        sendJson(response, 200, {
          service: status,
          routes: config.routes.map((route) => ({
            ...route,
            producerLabel: PRODUCER_LABELS[route.producer],
            consumerLabels: route.consumers.map((consumer) => PRODUCER_LABELS[consumer])
          })),
          agents: config.agents,
          runs
        });
        return;
      }
      const terminalRoute = parseTerminalRoute(request.url);
      if (request.method === "GET" && terminalRoute?.mode === "log") {
        const target = await terminalTarget(terminalRoute.runId, terminalRoute.kind, terminalRoute.mode);
        const text = target ? ((await readText(target.logPath)) ?? "") : "";
        sendText(response, 200, text, "text/plain; charset=utf-8");
        return;
      }
      if (request.method === "GET" && terminalRoute?.mode === "stream") {
        const target = await terminalTarget(terminalRoute.runId, terminalRoute.kind, terminalRoute.mode);
        if (!target) {
          sendJson(response, 404, { error: "terminal not found" });
          return;
        }
        await streamTerminalLog(response, target);
        return;
      }
      if (request.method === "POST" && request.url === "/bridge") {
        const envelope = await readRequestJson<RawHookEnvelope>(request);
        const result = await runBridge(envelope);
        sendJson(response, 200, result);
        return;
      }
      if (request.method === "POST" && request.url === "/send") {
        const envelope = await readRequestJson<RawDirectEnvelope>(request);
        const result = await runDirectBridge(envelope);
        sendJson(response, 200, result);
        return;
      }
      sendJson(response, 404, { error: "not found" });
    } catch (error) {
      sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });
  server.on("upgrade", (request, socket, head) => {
    const terminalRoute = parseTerminalRoute(request.url);
    if (request.method === "GET" && terminalRoute?.mode === "ws") {
      void terminalTarget(terminalRoute.runId, terminalRoute.kind, terminalRoute.mode)
        .then((target) => {
          if (!target) {
            socket.destroy();
            return undefined;
          }
          return handleTerminalWebSocket(request, socket, head, target);
        })
        .catch(() => socket.destroy());
      return;
    }
    socket.destroy();
  });

  server.listen(config.port, "127.0.0.1");
  await once(server, "listening");
  await markInterruptedBridgeRuns();
  await writeText(PID_FILE, `${process.pid}\n`);
  await writeJson(PORT_FILE, { port: config.port, pid: process.pid });
  console.log(`Agent Bridge listening on 127.0.0.1:${config.port}`);
}

export async function startService(options: { silent?: boolean } = {}): Promise<void> {
  const status = await serviceStatus();
  if (status.running) {
    if (!options.silent) {
      console.log(`Service is already running on port ${status.port}.`);
    }
    return;
  }
  const child = spawn(process.execPath, [entrypoint(), "serve"], {
    detached: true,
    stdio: "ignore",
    env: process.env
  });
  if (!child.pid) {
    throw new Error("Service process did not start.");
  }
  child.unref();
  const config = await loadConfig();
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const health = await readHealth(config.port);
    if (health.ok && health.pid === child.pid) {
      if (!options.silent) {
        console.log(`Service started on port ${config.port}.`);
      }
      return;
    }
    await delay(200);
  }
  throw new Error("Service did not become healthy in time.");
}

export async function stopService(): Promise<void> {
  const status = await serviceStatus();
  if (!status.running || !status.pid) {
    console.log("Service is not running.");
    return;
  }
  await stopRunningService(status.port, status.pid);
}

export async function restartService(): Promise<void> {
  const status = await serviceStatus();
  if (status.running && status.pid) {
    await stopRunningService(status.port, status.pid);
  } else {
    console.log("Service is not running.");
  }
  await startService();
}

export async function printServiceStatus(): Promise<void> {
  const [status, config, runs] = await Promise.all([
    serviceStatus(),
    loadConfig(),
    loadBridgeRuns()
  ]);
  if (status.running) {
    console.log(`Service: running on 127.0.0.1:${status.port}, pid ${status.pid}.`);
  } else {
    console.log("Service: not running.");
  }
  printRoutes(config);
  printRuns(runs);
}

export async function printDashboardUrl(): Promise<void> {
  await startService();
  const status = await serviceStatus();
  console.log(`Dashboard: http://127.0.0.1:${status.port}/dashboard`);
}

export async function submitBridge(envelope: RawHookEnvelope): Promise<BridgeResponse | null> {
  const config = await loadConfig();
  let status = await serviceStatus();
  if (status.running) {
    const response = await postBridge(status.port, envelope).catch(() => null);
    if (response) {
      return response;
    }
  }
  await startService({ silent: true }).catch(() => undefined);
  status = await serviceStatus();
  return postBridge(status.running ? status.port : config.port, envelope).catch(() => null);
}

export async function submitDirectBridge(envelope: RawDirectEnvelope): Promise<BridgeResponse | null> {
  const config = await loadConfig();
  let status = await serviceStatus();
  if (status.running) {
    const response = await postDirectBridge(status.port, envelope).catch(() => null);
    if (response) {
      return response;
    }
  }
  await startService({ silent: true }).catch(() => undefined);
  status = await serviceStatus();
  return postDirectBridge(status.running ? status.port : config.port, envelope).catch(() => null);
}

async function serviceStatus(): Promise<{ running: boolean; port: number; pid: number | null }> {
  const config = await loadConfig();
  const state = await readJson<{ port?: number; pid?: number }>(PORT_FILE, {});
  const statePort = integerOrNull(state.port);
  const statePid = integerOrNull(state.pid);
  const port = statePort ?? config.port;
  const pid = await readPid() ?? statePid;
  const hasServiceRecord = statePort !== null || pid !== null;
  const health = hasServiceRecord ? await readHealth(port) : { ok: false, pid: null };
  const running = health.ok && (pid === null || health.pid === pid);
  return { running, port, pid };
}

function integerOrNull(value: unknown): number | null {
  return Number.isInteger(value) ? value as number : null;
}

async function readPid(): Promise<number | null> {
  if (!await pathExists(PID_FILE)) {
    return null;
  }
  const text = await readText(PID_FILE);
  const pid = Number.parseInt((text ?? "").trim(), 10);
  return Number.isInteger(pid) ? pid : null;
}

async function readHealth(port: number): Promise<{ ok: boolean; pid: number | null }> {
  return new Promise((resolve) => {
    const request = http.request({
      host: "127.0.0.1",
      port,
      path: "/health",
      method: "GET",
      timeout: 500
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        const body = parseJsonObject(text);
        resolve({
          ok: response.statusCode === 200 && body?.ok === true,
          pid: integerOrNull(body?.pid)
        });
      });
    });
    request.on("timeout", () => {
      request.destroy();
      resolve({ ok: false, pid: null });
    });
    request.on("error", () => resolve({ ok: false, pid: null }));
    request.end();
  });
}

async function stopRunningService(port: number, pid: number): Promise<void> {
  process.kill(pid, "SIGTERM");
  console.log(`Stopped service pid ${pid}.`);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const health = await readHealth(port);
    if (!health.ok || health.pid !== pid) {
      return;
    }
    await delay(200);
  }
  throw new Error("Service did not stop in time.");
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(text) as unknown;
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

async function postBridge(port: number, envelope: RawHookEnvelope): Promise<BridgeResponse> {
  return postJson(port, "/bridge", envelope);
}

async function postDirectBridge(port: number, envelope: RawDirectEnvelope): Promise<BridgeResponse> {
  return postJson(port, "/send", envelope);
}

async function postJson(port: number, path: string, envelope: unknown): Promise<BridgeResponse> {
  const body = JSON.stringify(envelope);
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: "127.0.0.1",
      port,
      path,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body)
      },
      timeout: bridgeGateTimeoutMs() + 30_000
    }, async (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        if ((response.statusCode ?? 500) >= 400) {
          reject(new Error(text));
          return;
        }
        resolve(JSON.parse(text) as BridgeResponse);
      });
    });
    request.on("timeout", () => {
      request.destroy(new Error("bridge request timed out"));
    });
    request.on("error", reject);
    request.end(body);
  });
}

async function readRequestJson<T>(request: http.IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

function sendJson(response: http.ServerResponse, statusCode: number, body: unknown): void {
  const text = JSON.stringify(body);
  response.writeHead(statusCode, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(text)
  });
  response.end(text);
}

function sendHtml(response: http.ServerResponse, statusCode: number, body: string): void {
  sendText(response, statusCode, body, "text/html; charset=utf-8");
}

function sendText(response: http.ServerResponse, statusCode: number, body: string, contentType: string): void {
  response.writeHead(statusCode, {
    "content-type": contentType,
    "content-length": Buffer.byteLength(body)
  });
  response.end(body);
}

export async function streamTerminalLog(response: http.ServerResponse, target: TerminalSocketTarget): Promise<void> {
  response.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive"
  });
  const releases: Array<() => void> = [];
  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) {
      return;
    }
    cleanedUp = true;
    for (const release of releases.splice(0)) {
      release();
    }
  };
  const addRelease = (release: () => void) => {
    if (cleanedUp) {
      release();
    } else {
      releases.push(release);
    }
  };
  response.on("close", cleanup);
  response.on("error", cleanup);
  const decoder = new StringDecoder("utf8");
  if (!await writeResponseChunk(response, 'data: {"type":"snapshot","data":"')) {
    return;
  }
  const snapshotOffset = await streamTerminalLogSnapshot(target.logPath, async (chunk) => {
    const data = decoder.write(chunk);
    return data ? writeResponseChunk(response, jsonStringContent(data)) : true;
  });
  if (cleanedUp || response.destroyed) {
    return;
  }
  if (!target.tail) {
    const remainder = decoder.end();
    if (remainder && !await writeResponseChunk(response, jsonStringContent(remainder))) {
      return;
    }
  }
  if (!await writeResponseChunk(response, '"}\n\n')) {
    return;
  }
  const send = (event: unknown) => writeResponseChunk(response, `data: ${JSON.stringify(event)}\n\n`);
  addRelease(subscribeTerminalLog(target.terminalId, (event) => {
    void send(event);
  }));
  if (target.tail) {
    addRelease(tailTerminalLog(target.logPath, snapshotOffset, async (data) => {
      await send({ type: "stdout", data });
    }, decoder));
  }
}

async function writeResponseChunk(response: http.ServerResponse, chunk: string): Promise<boolean> {
  if (response.destroyed || response.writableEnded) {
    return false;
  }
  if (response.write(chunk)) {
    return true;
  }
  await new Promise<void>((resolve) => {
    const done = () => {
      response.off("drain", done);
      response.off("close", done);
      response.off("error", done);
      resolve();
    };
    response.once("drain", done);
    response.once("close", done);
    response.once("error", done);
  });
  return !response.destroyed && !response.writableEnded;
}

function jsonStringContent(value: string): string {
  return JSON.stringify(value).slice(1, -1);
}

function parseTerminalRoute(url: string | undefined): { runId: string; kind: string; mode: "log" | "stream" | "ws" } | null {
  if (!url) {
    return null;
  }
  const { pathname } = new URL(url, "http://127.0.0.1");
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length !== 6 || parts[0] !== "api" || parts[1] !== "runs" || parts[3] !== "consumers") {
    return null;
  }
  const mode = parts[5] === "log"
    ? "log"
    : parts[5] === "stream"
      ? "stream"
      : parts[5] === "ws"
        ? "ws"
        : null;
  if (!mode) {
    return null;
  }
  return {
    runId: decodeURIComponent(parts[2]),
    kind: decodeURIComponent(parts[4]),
    mode
  };
}

export async function terminalTarget(runId: string, kind: string, mode: "log" | "stream" | "ws"): Promise<TerminalSocketTarget | null> {
  const runs = await loadBridgeRuns();
  const run = runs.find((item) => item.id === runId);
  if (!run) {
    return null;
  }
  const consumer = run.consumers.find((item) => item.kind === kind);
  if (!consumer) {
    return null;
  }
  const runTerminalId = `${runId}:${kind}`;
  const workerTarget = mode !== "log"
    && consumer.workerLogPath
    && await pathExists(consumer.workerLogPath);
  return {
    terminalId: workerTarget ? consumer.terminalId ?? runTerminalId : runTerminalId,
    logPath: workerTarget ? consumer.workerLogPath! : consumer.logPath ?? terminalLogPath(runId, kind),
    tail: mode !== "log"
  };
}

function entrypoint(): string {
  if (process.argv[1]) {
    return isAbsolute(process.argv[1]) ? process.argv[1] : resolve(process.cwd(), process.argv[1]);
  }
  return fileURLToPath(new URL("../cli/index.ts", import.meta.url));
}

function printRoutes(config: AppConfig): void {
  if (config.routes.length === 0) {
    console.log("Routes: none configured.");
    return;
  }
  console.log("Routes:");
  for (const route of config.routes) {
    const consumers = route.consumers.map((consumer) => PRODUCER_LABELS[consumer]).join(", ");
    console.log(`- ${route.enabled ? "enabled" : "disabled"} ${PRODUCER_LABELS[route.producer]} -> ${consumers}`);
  }
}

function printRuns(runs: BridgeRunRecord[]): void {
  const active = runs.filter(isActiveRun);
  if (active.length === 0) {
    console.log("Active bridge runs: none.");
  } else {
    console.log("Active bridge runs:");
    for (const run of active) {
      printRun(run);
    }
  }

  const recent = runs.filter((run) => !isActiveRun(run)).slice(0, 5);
  if (recent.length === 0) {
    console.log("Recent bridge runs: none.");
    return;
  }
  console.log("Recent bridge runs:");
  for (const run of recent) {
    printRun(run);
  }
}

function printRun(run: BridgeRunRecord): void {
  const elapsed = formatDuration((run.completedAt ? Date.parse(run.completedAt) : Date.now()) - Date.parse(run.startedAt));
  const summary = run.summary ? ` - ${singleLine(run.summary, 100)}` : run.error ? ` - ${singleLine(run.error, 100)}` : "";
  const preview = run.source === "direct" && run.directMessagePreview ? ` "${singleLine(run.directMessagePreview, 80)}"` : "";
  console.log(`- ${run.id} ${formatRunSubject(run)} ${formatRunStatus(run.status)} ${elapsed} ${run.cwd}${preview}${summary}`);
  for (const consumer of run.consumers) {
    console.log(`  ${formatConsumer(consumer)}`);
  }
}

function formatRunSubject(run: BridgeRunRecord): string {
  if (run.source === "direct") {
    const consumer = run.consumers[0];
    const mode = run.outputMode ? ` ${run.outputMode}` : "";
    return `direct${mode} -> ${consumer?.label ?? consumer?.kind ?? "consumer"}`;
  }
  return `${PRODUCER_LABELS[run.producer]} ${run.event}`;
}

function formatConsumer(consumer: ConsumerRunRecord): string {
  const elapsed = consumer.startedAt
    ? ` ${formatDuration((consumer.completedAt ? Date.parse(consumer.completedAt) : Date.now()) - Date.parse(consumer.startedAt))}`
    : "";
  const summary = consumer.summary ? ` - ${singleLine(consumer.summary, 100)}` : consumer.error ? ` - ${singleLine(consumer.error, 100)}` : "";
  const late = consumer.late ? " late" : "";
  const worker = consumer.workerId ? ` worker=${consumer.workerId}` : "";
  return `${consumer.label}: ${formatConsumerStatus(consumer.status)}${late}${elapsed}${worker} (${consumer.command})${summary}`;
}

function formatDuration(ms: number): string {
  const safeMs = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const seconds = Math.floor(safeMs / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m${rest}s`;
}

function singleLine(value: string, maxChars: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 1)}...`;
}

function isActiveRun(run: BridgeRunRecord): boolean {
  return run.status === "running"
    || run.consumers.some((consumer) => consumer.status === "pending" || consumer.status === "running");
}

function formatRunStatus(status: BridgeRunRecord["status"]): string {
  const label = status === "timed_out"
    ? "timed_out (producer released)"
    : status === "late_fail"
      ? "late_fail (!)"
      : status;
  return colorStatus(label, status);
}

function formatConsumerStatus(status: ConsumerRunRecord["status"]): string {
  return colorStatus(status, status);
}

function colorStatus(status: string, rawStatus: string): string {
  const shouldHighlight = rawStatus === "fail" || rawStatus === "late_fail" || rawStatus === "error";
  return shouldHighlight && process.stdout.isTTY ? `\x1b[31m${status}\x1b[0m` : status;
}
