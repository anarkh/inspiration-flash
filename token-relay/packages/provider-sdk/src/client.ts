import {
  isRelayServerMessage,
  TOKEN_RELAY_PROTOCOL_VERSION,
  type ProviderClientMessage,
  type RelayJob,
  type RelayServerMessage
} from "@anarkhli/protocol";
import WebSocket, { type RawData } from "ws";
import { resolveProviderConfig } from "./config.ts";
import { CliModelExecutor, toProviderFailure } from "./executor.ts";
import { consoleProviderLogger } from "./logger.ts";
import type {
  ModelExecutor,
  ProviderClientOptions,
  ProviderClientStatus,
  ProviderConfig,
  ProviderConnectionState,
  ProviderLogger,
  ResolvedProviderConfig
} from "./types.ts";
import { PROVIDER_SDK_VERSION } from "./version.ts";

interface ActiveJob {
  job: RelayJob;
  controller: AbortController;
  deadlineTimer: NodeJS.Timeout;
  task: Promise<void>;
  abortCode: "CANCELLED" | "DEADLINE_EXCEEDED" | "STOPPED" | null;
}

interface PendingMessage {
  message: Extract<ProviderClientMessage, { type: "result" | "failure" }>;
  createdAt: number;
}

const MAX_OUTBOX_MESSAGES = 1_000;

export class ProviderClient {
  readonly #config: ResolvedProviderConfig;
  readonly #executor: ModelExecutor;
  readonly #logger: ProviderLogger;
  readonly #activeJobs = new Map<string, ActiveJob>();
  readonly #outbox = new Map<string, PendingMessage>();

  #socket: WebSocket | null = null;
  #running = false;
  #ready = false;
  #providerId: string | null = null;
  #state: ProviderConnectionState = "idle";
  #heartbeatTimer: NodeJS.Timeout | null = null;
  #reconnectTimer: NodeJS.Timeout | null = null;
  #connectTimeoutTimer: NodeJS.Timeout | null = null;
  #reconnectDelayMs: number;
  #startPromise: Promise<void> | null = null;
  #resolveStart: (() => void) | null = null;
  #rejectStart: ((error: Error) => void) | null = null;

  constructor(
    config: ProviderConfig | ResolvedProviderConfig,
    options: ProviderClientOptions = {}
  ) {
    this.#config = resolveProviderConfig(config);
    this.#logger = options.logger ?? consoleProviderLogger;
    this.#executor = options.executor ?? new CliModelExecutor({
      defaultTimeoutMs: this.#config.jobTimeoutMs,
      defaultMaxOutputBytes: this.#config.maxOutputBytes,
      killGraceMs: this.#config.killGraceMs,
      logger: this.#logger
    });
    this.#reconnectDelayMs = this.#config.reconnectInitialMs;
  }

  start(): Promise<void> {
    if (this.#running && this.#startPromise) {
      return this.#startPromise;
    }
    this.#running = true;
    this.#state = "connecting";
    this.#startPromise = new Promise<void>((resolve, reject) => {
      this.#resolveStart = resolve;
      this.#rejectStart = reject;
    });
    this.#connectTimeoutTimer = setTimeout(() => {
      if (!this.#ready) {
        const error = new Error(
          `Provider did not become ready within ${this.#config.connectTimeoutMs} ms.`
        );
        this.#rejectStart?.(error);
        this.#rejectStart = null;
        this.#resolveStart = null;
        void this.stop();
      }
    }, this.#config.connectTimeoutMs);
    this.#connect();
    return this.#startPromise;
  }

  async stop(): Promise<void> {
    if (!this.#running && this.#state === "stopped") {
      return;
    }
    this.#running = false;
    this.#ready = false;
    this.#state = "stopping";
    this.#clearConnectionTimers();
    const socket = this.#socket;
    this.#socket = null;
    if (socket) {
      socket.removeAllListeners();
      // ws emits an error when a CONNECTING socket is terminated. Keep a
      // no-op handler while shutting down so that event cannot become an
      // unhandled EventEmitter error.
      socket.on("error", () => undefined);
      if (
        socket.readyState === WebSocket.OPEN
        || socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close(1000, "provider stopping");
        setTimeout(() => {
          if (socket.readyState !== WebSocket.CLOSED) {
            socket.terminate();
          }
        }, this.#config.killGraceMs).unref?.();
      }
    }

    const tasks = [...this.#activeJobs.values()].map((active) => {
      active.abortCode = "STOPPED";
      active.controller.abort(new Error("Provider client stopped."));
      return active.task;
    });
    await Promise.allSettled(tasks);
    this.#activeJobs.clear();
    this.#outbox.clear();
    this.#providerId = null;
    this.#state = "stopped";
    if (this.#rejectStart) {
      this.#rejectStart(new Error("Provider client stopped before becoming ready."));
    }
    this.#resolveStart = null;
    this.#rejectStart = null;
    this.#startPromise = null;
  }

  getStatus(): ProviderClientStatus {
    return {
      state: this.#state,
      providerId: this.#providerId,
      activeJobs: this.#activeJobs.size,
      pendingResults: this.#outbox.size,
      models: this.#modelNames(),
      concurrency: this.#config.concurrency
    };
  }

  #connect(): void {
    if (!this.#running) {
      return;
    }
    if (
      this.#socket
      && (
        this.#socket.readyState === WebSocket.OPEN
        || this.#socket.readyState === WebSocket.CONNECTING
      )
    ) {
      return;
    }
    this.#state = this.#providerId ? "reconnecting" : "connecting";
    const socket = new WebSocket(this.#config.relayUrl, {
      headers: {
        authorization: `Bearer ${this.#config.providerToken}`,
        "user-agent": `token-relay-provider/${PROVIDER_SDK_VERSION}`
      },
      handshakeTimeout: this.#config.connectTimeoutMs,
      maxPayload: this.#config.maxWebSocketPayloadBytes,
      perMessageDeflate: false
    });
    this.#socket = socket;

    socket.once("open", () => {
      if (!this.#running || socket !== this.#socket) {
        socket.close();
        return;
      }
      this.#logger.info("Connected to relay; waiting for ready.", {
        relayUrl: redactRelayUrl(this.#config.relayUrl)
      });
      this.#sendControl({
        type: "hello",
        protocolVersion: TOKEN_RELAY_PROTOCOL_VERSION,
        sdkVersion: PROVIDER_SDK_VERSION,
        models: this.#modelNames(),
        concurrency: this.#config.concurrency
      });
    });
    socket.on("message", (data) => this.#handleRawMessage(data));
    socket.once("close", (code, reason) => {
      if (socket !== this.#socket) {
        return;
      }
      this.#socket = null;
      this.#ready = false;
      this.#clearHeartbeat();
      this.#abortJobsAfterDisconnect();
      this.#logger.warn("Relay connection closed.", {
        code,
        reason: reason.toString("utf8").slice(0, 200)
      });
      if (this.#running) {
        this.#scheduleReconnect();
      }
    });
    socket.on("error", (error) => {
      this.#logger.warn("Relay WebSocket error.", {
        message: error.message
      });
    });
  }

  #handleRawMessage(data: RawData): void {
    let value: unknown;
    try {
      value = JSON.parse(rawDataToString(data)) as unknown;
    } catch {
      this.#logger.error("Relay sent invalid JSON.");
      this.#socket?.close(1002, "invalid JSON");
      return;
    }
    if (!isRelayServerMessage(value)) {
      this.#logger.error("Relay sent a message that does not match protocol.");
      this.#socket?.close(1002, "invalid protocol message");
      return;
    }
    this.#handleMessage(value);
  }

  #handleMessage(message: RelayServerMessage): void {
    switch (message.type) {
      case "ready":
        this.#handleReady(message);
        break;
      case "job":
        this.#acceptJob(message.job);
        break;
      case "cancel":
        this.#cancelJob(message.jobId, message.reason);
        break;
      case "ack":
        this.#outbox.delete(message.jobId);
        break;
      case "error":
        this.#logger.warn("Relay reported an error.", {
          code: message.code,
          message: message.message,
          ...(message.jobId ? { jobId: message.jobId } : {})
        });
        if (message.jobId) {
          this.#outbox.delete(message.jobId);
        }
        break;
    }
  }

  #handleReady(
    message: Extract<RelayServerMessage, { type: "ready" }>
  ): void {
    this.#ready = true;
    this.#providerId = message.providerId;
    this.#state = "ready";
    this.#reconnectDelayMs = this.#config.reconnectInitialMs;
    if (this.#connectTimeoutTimer) {
      clearTimeout(this.#connectTimeoutTimer);
      this.#connectTimeoutTimer = null;
    }
    this.#startHeartbeat(message.heartbeatIntervalMs);
    this.#flushOutbox();
    this.#logger.info("Provider is ready.", {
      providerId: message.providerId,
      models: this.#modelNames(),
      concurrency: this.#config.concurrency
    });
    this.#resolveStart?.();
    this.#resolveStart = null;
    this.#rejectStart = null;
  }

  #acceptJob(job: RelayJob): void {
    if (!this.#ready) {
      return;
    }
    const pending = this.#outbox.get(job.id);
    if (pending && pending.message.leaseToken === job.leaseToken) {
      this.#sendControl(pending.message);
      return;
    }
    const activeDuplicate = this.#activeJobs.get(job.id);
    if (activeDuplicate) {
      if (activeDuplicate.job.leaseToken !== job.leaseToken) {
        this.#logger.warn("Ignoring duplicate job with a different lease.", {
          jobId: job.id
        });
      }
      return;
    }
    const target = this.#config.models[job.model];
    if (!target) {
      this.#queueTerminalMessage({
        type: "failure",
        jobId: job.id,
        leaseToken: job.leaseToken,
        error: {
          code: "MODEL_NOT_AVAILABLE",
          message: `Model ${job.model} is not offered by this provider.`,
          retryable: false
        }
      });
      return;
    }
    if (this.#activeJobs.size >= this.#config.concurrency) {
      this.#queueTerminalMessage({
        type: "failure",
        jobId: job.id,
        leaseToken: job.leaseToken,
        error: {
          code: "PROVIDER_BUSY",
          message: "Provider concurrency is currently exhausted.",
          retryable: true
        }
      });
      return;
    }

    const controller = new AbortController();
    const deadlineAt = Date.parse(job.deadlineAt);
    const deadlineDelay = Number.isFinite(deadlineAt)
      ? Math.min(2_147_000_000, Math.max(1, deadlineAt - Date.now()))
      : 1;
    const active = {} as ActiveJob;
    active.job = job;
    active.controller = controller;
    active.abortCode = null;
    active.deadlineTimer = setTimeout(() => {
      active.abortCode = "DEADLINE_EXCEEDED";
      controller.abort(new Error("Relay job deadline exceeded."));
    }, deadlineDelay);
    active.deadlineTimer.unref?.();
    // Put the job in the active map before invoking an injected executor. An
    // executor is expected to return a Promise, but this also handles one that
    // throws synchronously without leaving a stale active record.
    active.task = Promise.resolve();
    this.#activeJobs.set(job.id, active);
    active.task = Promise.resolve().then(() => this.#executeJob(active, target));
    this.#logger.info("Accepted relay job.", {
      jobId: job.id,
      model: job.model,
      activeJobs: this.#activeJobs.size
    });
    this.#sendHeartbeat();
  }

  async #executeJob(
    active: ActiveJob,
    target: ResolvedProviderConfig["models"][string]
  ): Promise<void> {
    try {
      const result = await this.#executor.execute(
        active.job,
        target,
        active.controller.signal
      );
      if (this.#running && active.abortCode === null) {
        this.#queueTerminalMessage({
          type: "result",
          jobId: active.job.id,
          leaseToken: active.job.leaseToken,
          result
        });
      }
    } catch (error) {
      // A relay cancel already releases the lease, so it only requires local
      // termination. Sending a failure afterward would be a stale response.
      if (
        this.#running
        && active.abortCode !== "STOPPED"
        && active.abortCode !== "CANCELLED"
      ) {
        const failure = active.abortCode === "DEADLINE_EXCEEDED"
          ? {
              code: "DEADLINE_EXCEEDED",
              message: "The relay job deadline elapsed during local execution.",
              retryable: true
            }
          : toProviderFailure(error);
        this.#queueTerminalMessage({
          type: "failure",
          jobId: active.job.id,
          leaseToken: active.job.leaseToken,
          error: failure
        });
      }
    } finally {
      clearTimeout(active.deadlineTimer);
      this.#activeJobs.delete(active.job.id);
      this.#logger.info("Relay job finished locally.", {
        jobId: active.job.id,
        activeJobs: this.#activeJobs.size
      });
      this.#sendHeartbeat();
    }
  }

  #cancelJob(jobId: string, reason: string): void {
    const active = this.#activeJobs.get(jobId);
    if (!active) {
      return;
    }
    active.abortCode = "CANCELLED";
    active.controller.abort(new Error(reason || "Relay cancelled the job."));
  }

  #queueTerminalMessage(
    message: Extract<ProviderClientMessage, { type: "result" | "failure" }>
  ): void {
    if (this.#outbox.size >= MAX_OUTBOX_MESSAGES) {
      const oldest = [...this.#outbox.entries()]
        .sort((left, right) => left[1].createdAt - right[1].createdAt)[0];
      if (oldest) {
        this.#outbox.delete(oldest[0]);
      }
    }
    this.#outbox.set(message.jobId, {
      message,
      createdAt: Date.now()
    });
    this.#sendControl(message);
  }

  #flushOutbox(): void {
    for (const pending of this.#outbox.values()) {
      this.#sendControl(pending.message);
    }
  }

  #sendHeartbeat(): void {
    if (!this.#ready) {
      return;
    }
    this.#sendControl({
      type: "heartbeat",
      models: this.#modelNames(),
      concurrency: this.#config.concurrency
    });
  }

  #startHeartbeat(intervalMs: number): void {
    this.#clearHeartbeat();
    this.#heartbeatTimer = setInterval(
      () => this.#sendHeartbeat(),
      Math.max(100, intervalMs)
    );
  }

  #sendControl(message: ProviderClientMessage): boolean {
    const socket = this.#socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    if (message.type !== "hello" && !this.#ready) {
      return false;
    }
    socket.send(JSON.stringify(message), (error) => {
      if (error) {
        this.#logger.warn("Unable to send relay message.", {
          type: message.type,
          message: error.message
        });
      }
    });
    return true;
  }

  #scheduleReconnect(): void {
    if (this.#reconnectTimer || !this.#running) {
      return;
    }
    this.#state = "reconnecting";
    const jitter = Math.floor(Math.random() * Math.max(1, this.#reconnectDelayMs / 4));
    const delayMs = this.#reconnectDelayMs + jitter;
    this.#logger.info("Scheduling relay reconnect.", { delayMs });
    this.#reconnectTimer = setTimeout(() => {
      this.#reconnectTimer = null;
      this.#connect();
    }, delayMs);
    this.#reconnectDelayMs = Math.min(
      this.#config.reconnectMaxMs,
      this.#reconnectDelayMs * 2
    );
  }

  #abortJobsAfterDisconnect(): void {
    // A lease is bound to one provider connection. The relay immediately
    // fails its pending jobs when that connection closes, so continuing local
    // commands would only consume the provider's subscription and any result
    // would be stale. Pending terminal messages are stale for the same reason.
    const pendingResults = this.#outbox.size;
    this.#outbox.clear();
    for (const active of this.#activeJobs.values()) {
      active.abortCode = "STOPPED";
      active.controller.abort(new Error("Relay connection closed."));
    }
    if (this.#activeJobs.size > 0 || pendingResults > 0) {
      this.#logger.warn("Cancelled work from the closed relay connection.", {
        activeJobs: this.#activeJobs.size,
        discardedPendingResults: pendingResults
      });
    }
  }

  #clearConnectionTimers(): void {
    this.#clearHeartbeat();
    if (this.#reconnectTimer) {
      clearTimeout(this.#reconnectTimer);
      this.#reconnectTimer = null;
    }
    if (this.#connectTimeoutTimer) {
      clearTimeout(this.#connectTimeoutTimer);
      this.#connectTimeoutTimer = null;
    }
  }

  #clearHeartbeat(): void {
    if (this.#heartbeatTimer) {
      clearInterval(this.#heartbeatTimer);
      this.#heartbeatTimer = null;
    }
  }

  #modelNames(): string[] {
    return Object.keys(this.#config.models).sort();
  }
}

function rawDataToString(data: RawData): string {
  if (typeof data === "string") {
    return data;
  }
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString("utf8");
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString("utf8");
  }
  return Buffer.from(data).toString("utf8");
}

function redactRelayUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/token|key|secret|auth/i.test(key)) {
        url.searchParams.set(key, "[redacted]");
      }
    }
    return url.toString();
  } catch {
    return "[invalid relay URL]";
  }
}
