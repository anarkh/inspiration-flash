import type http from "node:http";
import type { Duplex } from "node:stream";
import {
  TOKEN_RELAY_PROTOCOL_VERSION,
  isProviderClientMessage,
  type ProviderClientMessage,
  type ProviderResult,
  type RelayJob,
  type RelayServerMessage
} from "@anarkhli/protocol";
import WebSocket, {
  WebSocketServer,
  type RawData
} from "ws";
import type { ResolvedRelayServerOptions } from "./config.ts";
import { ProviderJobError } from "./errors.ts";
import { bearerToken } from "./secrets.ts";
import type { ProviderRecord, RelayStore } from "./store.ts";

interface ProviderSession {
  providerId: string;
  socket: WebSocket;
  sdkVersion: string;
  models: Set<string>;
  advertisedConcurrency: number;
  connectedAt: string;
  lastHeartbeatAt: string;
  lastHeartbeatMs: number;
  lastSeenMs: number;
  inFlight: Map<string, PendingJob>;
}

interface PendingJob {
  providerId: string;
  job: RelayJob;
  resolve(result: ProviderResult): void;
  reject(error: ProviderJobError): void;
  timer: NodeJS.Timeout;
}

export interface ProviderPresence {
  online: boolean;
  sdkVersion: string | null;
  models: string[];
  advertisedConcurrency: number;
  connectedAt: string | null;
  lastHeartbeatAt: string | null;
  inFlight: number;
}

export class ProviderHub {
  private readonly webSocketServer: WebSocketServer;
  private readonly sessions = new Map<string, ProviderSession>();
  private readonly pendingJobs = new Map<string, PendingJob>();
  private readonly heartbeatIntervalMs: number;
  private readonly watchdog: NodeJS.Timeout;
  private closing = false;

  constructor(
    private readonly store: RelayStore,
    private readonly options: ResolvedRelayServerOptions
  ) {
    this.webSocketServer = new WebSocketServer({
      noServer: true,
      maxPayload: Math.max(options.bodyLimitBytes, 4 * 1024 * 1024),
      perMessageDeflate: false
    });
    this.heartbeatIntervalMs = Math.max(
      100,
      Math.min(15_000, Math.floor(options.providerOnlineMs / 3))
    );
    this.watchdog = setInterval(
      () => this.checkSessions(),
      Math.max(100, Math.min(1_000, this.heartbeatIntervalMs))
    );
    this.watchdog.unref();
  }

  handleUpgrade(
    request: http.IncomingMessage,
    socket: Duplex,
    head: Buffer
  ): void {
    if (this.closing) {
      rejectUpgrade(socket, 503, "server_closing", "Relay server is closing.");
      return;
    }
    const token = bearerToken(request.headers.authorization);
    const provider = token ? this.store.authenticateProvider(token) : null;
    if (!provider) {
      rejectUpgrade(
        socket,
        401,
        "invalid_provider_token",
        "A valid provider bearer token is required."
      );
      return;
    }
    if (!provider.enabled) {
      rejectUpgrade(socket, 403, "provider_disabled", "Provider is disabled.");
      return;
    }
    this.webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      this.acceptConnection(webSocket, provider);
    });
  }

  presence(providerId: string): ProviderPresence {
    const session = this.sessions.get(providerId);
    if (!session || !isSessionOnline(session, this.options.providerOnlineMs)) {
      return offlinePresence();
    }
    return {
      online: true,
      sdkVersion: session.sdkVersion,
      models: [...session.models].sort(),
      advertisedConcurrency: session.advertisedConcurrency,
      connectedAt: session.connectedAt,
      lastHeartbeatAt: session.lastHeartbeatAt,
      inFlight: session.inFlight.size
    };
  }

  onlineCount(): number {
    return [...this.sessions.values()].filter(
      (session) => isSessionOnline(session, this.options.providerOnlineMs)
    ).length;
  }

  isAvailable(providerId: string, model: string): boolean {
    const provider = this.store.getProvider(providerId);
    const session = this.sessions.get(providerId);
    if (!provider?.enabled
      || !session
      || !isSessionOnline(session, this.options.providerOnlineMs)
      || session.socket.readyState !== WebSocket.OPEN
      || !session.models.has(model)) {
      return false;
    }
    const connectionLimit = Math.min(
      provider.maxConcurrent,
      session.advertisedConcurrency
    );
    return session.inFlight.size < connectionLimit;
  }

  dispatch(providerId: string, job: RelayJob): Promise<ProviderResult> {
    const provider = this.store.getProvider(providerId);
    const session = this.sessions.get(providerId);
    if (!provider?.enabled || !session || !isSessionOnline(
      session,
      this.options.providerOnlineMs
    )) {
      throw new ProviderJobError(
        "provider_offline",
        "The configured provider SDK is offline.",
        true
      );
    }
    if (!session.models.has(job.model)) {
      throw new ProviderJobError(
        "model_unavailable",
        `The provider did not advertise model ${job.model}.`,
        true
      );
    }
    const connectionLimit = Math.min(
      provider.maxConcurrent,
      session.advertisedConcurrency
    );
    if (session.inFlight.size >= connectionLimit) {
      throw new ProviderJobError(
        "provider_concurrency_exceeded",
        "The provider connection is at its concurrent job limit.",
        true
      );
    }
    if (this.pendingJobs.has(job.id)) {
      throw new ProviderJobError(
        "duplicate_job",
        "A job with this id is already pending.",
        false
      );
    }

    return new Promise<ProviderResult>((resolve, reject) => {
      const timeoutMs = Math.max(1, Date.parse(job.deadlineAt) - Date.now());
      const pending: PendingJob = {
        providerId,
        job,
        resolve,
        reject,
        timer: setTimeout(() => {
          this.failPending(
            pending,
            new ProviderJobError(
              "request_timeout",
              "The provider did not complete the request before its lease expired.",
              true
            ),
            true
          );
        }, timeoutMs)
      };
      pending.timer.unref();
      this.pendingJobs.set(job.id, pending);
      session.inFlight.set(job.id, pending);
      this.send(session.socket, { type: "job", job }, (error) => {
        if (error) {
          this.failPending(
            pending,
            new ProviderJobError(
              "dispatch_failed",
              `Unable to send the job to the provider: ${error.message}`,
              true
            ),
            false
          );
        }
      });
    });
  }

  cancel(jobId: string, reason: string): boolean {
    const pending = this.pendingJobs.get(jobId);
    if (!pending) {
      return false;
    }
    this.failPending(
      pending,
      new ProviderJobError("request_cancelled", reason, false),
      true
    );
    return true;
  }

  disconnectProvider(providerId: string, reason: string): void {
    const session = this.sessions.get(providerId);
    if (!session) {
      return;
    }
    this.removeSession(session, reason);
    session.socket.close(4003, truncateCloseReason(reason));
    setTimeout(() => session.socket.terminate(), 250).unref();
  }

  async close(): Promise<void> {
    if (this.closing) {
      return;
    }
    this.closing = true;
    clearInterval(this.watchdog);
    for (const session of [...this.sessions.values()]) {
      for (const pending of [...session.inFlight.values()]) {
        this.failPending(
          pending,
          new ProviderJobError(
            "server_closing",
            "Relay server closed before the provider completed the request.",
            true
          ),
          true
        );
      }
      session.socket.close(1001, "server closing");
      session.socket.terminate();
    }
    this.sessions.clear();
    await new Promise<void>((resolve) => {
      this.webSocketServer.close(() => resolve());
    });
  }

  private acceptConnection(socket: WebSocket, provider: ProviderRecord): void {
    let session: ProviderSession | null = null;
    const helloTimer = setTimeout(() => {
      if (!session) {
        this.send(socket, {
          type: "error",
          code: "hello_timeout",
          message: "Provider must send a hello message after connecting."
        });
        socket.close(4000, "hello timeout");
      }
    }, Math.min(10_000, this.options.providerOnlineMs));
    helloTimer.unref();

    socket.on("pong", () => {
      if (session) {
        session.lastSeenMs = Date.now();
      }
    });
    socket.on("message", (data) => {
      const message = parseClientMessage(data);
      if (!message) {
        this.send(socket, {
          type: "error",
          code: "invalid_message",
          message: "Provider message does not match the Token Relay protocol."
        });
        if (!session) {
          clearTimeout(helloTimer);
          socket.close(4002, "invalid provider hello");
        }
        return;
      }
      if (!session) {
        if (message.type !== "hello") {
          this.send(socket, {
            type: "error",
            code: "hello_required",
            message: "The first provider message must be hello."
          });
          socket.close(4000, "hello required");
          return;
        }
        clearTimeout(helloTimer);
        session = this.registerSession(provider, socket, message);
        return;
      }
      this.handleSessionMessage(session, message);
    });
    socket.on("close", () => {
      clearTimeout(helloTimer);
      if (session) {
        this.removeSession(session, "Provider WebSocket disconnected.");
      }
    });
    socket.on("error", () => {
      if (session) {
        session.lastSeenMs = 0;
      }
    });
  }

  private registerSession(
    provider: ProviderRecord,
    socket: WebSocket,
    hello: Extract<ProviderClientMessage, { type: "hello" }>
  ): ProviderSession {
    const existing = this.sessions.get(provider.id);
    if (existing) {
      existing.socket.close(4001, "replaced by a new provider connection");
      this.removeSession(existing, "Provider connection was replaced.");
    }
    const now = new Date().toISOString();
    const session: ProviderSession = {
      providerId: provider.id,
      socket,
      sdkVersion: hello.sdkVersion.slice(0, 128),
      models: normalizedModels(hello.models),
      advertisedConcurrency: boundedConcurrency(hello.concurrency),
      connectedAt: now,
      lastHeartbeatAt: now,
      lastHeartbeatMs: Date.now(),
      lastSeenMs: Date.now(),
      inFlight: new Map()
    };
    this.sessions.set(provider.id, session);
    this.store.updateProviderAdvertisement(
      provider.id,
      [...session.models],
      now
    );
    this.send(socket, {
      type: "ready",
      protocolVersion: TOKEN_RELAY_PROTOCOL_VERSION,
      providerId: provider.id,
      heartbeatIntervalMs: this.heartbeatIntervalMs
    });
    return session;
  }

  private handleSessionMessage(
    session: ProviderSession,
    message: ProviderClientMessage
  ): void {
    session.lastSeenMs = Date.now();
    if (message.type === "hello") {
      this.send(session.socket, {
        type: "error",
        code: "duplicate_hello",
        message: "Provider hello was already accepted."
      });
      return;
    }
    if (message.type === "heartbeat") {
      session.models = normalizedModels(message.models);
      session.advertisedConcurrency = boundedConcurrency(message.concurrency);
      session.lastHeartbeatAt = new Date().toISOString();
      session.lastHeartbeatMs = Date.now();
      this.store.updateProviderAdvertisement(
        session.providerId,
        [...session.models],
        session.lastHeartbeatAt
      );
      return;
    }

    const pending = this.pendingJobs.get(message.jobId);
    if (!pending || pending.providerId !== session.providerId) {
      this.send(session.socket, {
        type: "error",
        code: "job_not_found",
        message: "This job is no longer leased to the provider.",
        jobId: message.jobId
      });
      return;
    }
    if (message.leaseToken !== pending.job.leaseToken) {
      this.send(session.socket, {
        type: "error",
        code: "invalid_lease",
        message: "The job lease token is invalid.",
        jobId: message.jobId
      });
      return;
    }

    this.completePending(pending);
    this.send(session.socket, { type: "ack", jobId: message.jobId });
    if (message.type === "result") {
      pending.resolve(message.result);
      return;
    }
    pending.reject(new ProviderJobError(
      message.error.code,
      message.error.message,
      message.error.retryable,
      message.error.usage
    ));
  }

  private checkSessions(): void {
    const now = Date.now();
    for (const session of [...this.sessions.values()]) {
      const provider = this.store.getProvider(session.providerId);
      if (!provider?.enabled) {
        this.disconnectProvider(session.providerId, "Provider was disabled.");
        continue;
      }
      if (now - session.lastSeenMs > this.options.providerOnlineMs
        || now - session.lastHeartbeatMs > this.options.providerOnlineMs) {
        this.removeSession(session, "Provider heartbeat expired.");
        session.socket.terminate();
        continue;
      }
      if (session.socket.readyState === WebSocket.OPEN) {
        session.socket.ping();
      }
    }
  }

  private removeSession(session: ProviderSession, reason: string): void {
    if (this.sessions.get(session.providerId) === session) {
      this.sessions.delete(session.providerId);
    }
    for (const pending of [...session.inFlight.values()]) {
      this.failPending(
        pending,
        new ProviderJobError("provider_disconnected", reason, true),
        false
      );
    }
  }

  private failPending(
    pending: PendingJob,
    error: ProviderJobError,
    sendCancel: boolean
  ): void {
    const session = this.sessions.get(pending.providerId);
    if (sendCancel && session?.socket.readyState === WebSocket.OPEN) {
      this.send(session.socket, {
        type: "cancel",
        jobId: pending.job.id,
        reason: error.message
      });
    }
    this.completePending(pending);
    pending.reject(error);
  }

  private completePending(pending: PendingJob): void {
    clearTimeout(pending.timer);
    this.pendingJobs.delete(pending.job.id);
    this.sessions.get(pending.providerId)?.inFlight.delete(pending.job.id);
  }

  private send(
    socket: WebSocket,
    message: RelayServerMessage,
    callback?: (error?: Error) => void
  ): void {
    if (socket.readyState !== WebSocket.OPEN) {
      callback?.(new Error("Provider WebSocket is not open."));
      return;
    }
    socket.send(JSON.stringify(message), callback);
  }
}

function parseClientMessage(data: RawData): ProviderClientMessage | null {
  try {
    const text = Array.isArray(data)
      ? Buffer.concat(data).toString("utf8")
      : Buffer.isBuffer(data)
        ? data.toString("utf8")
        : data instanceof ArrayBuffer
          ? Buffer.from(data).toString("utf8")
          : Buffer.from(data).toString("utf8");
    const value: unknown = JSON.parse(text);
    return isProviderClientMessage(value) ? value : null;
  } catch {
    return null;
  }
}

function normalizedModels(models: string[]): Set<string> {
  return new Set(
    models.map((model) => model.trim()).filter(Boolean).slice(0, 256)
  );
}

function boundedConcurrency(value: number): number {
  return Math.max(1, Math.min(1_024, value));
}

function isSessionOnline(session: ProviderSession, onlineMs: number): boolean {
  return session.socket.readyState === WebSocket.OPEN
    && Date.now() - session.lastSeenMs <= onlineMs
    && Date.now() - session.lastHeartbeatMs <= onlineMs;
}

function offlinePresence(): ProviderPresence {
  return {
    online: false,
    sdkVersion: null,
    models: [],
    advertisedConcurrency: 0,
    connectedAt: null,
    lastHeartbeatAt: null,
    inFlight: 0
  };
}

function rejectUpgrade(
  socket: Duplex,
  status: number,
  code: string,
  message: string
): void {
  const body = JSON.stringify({ error: { code, message } });
  const statusText = status === 401
    ? "Unauthorized"
    : status === 403
      ? "Forbidden"
      : "Service Unavailable";
  socket.write([
    `HTTP/1.1 ${status} ${statusText}`,
    "Content-Type: application/json; charset=utf-8",
    `Content-Length: ${Buffer.byteLength(body)}`,
    "Connection: close",
    "",
    body
  ].join("\r\n"));
  socket.end();
}

function truncateCloseReason(reason: string): string {
  return Buffer.from(reason, "utf8").subarray(0, 120).toString("utf8");
}
