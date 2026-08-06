import { randomUUID } from "node:crypto";
import http, {
  type IncomingMessage,
  type ServerResponse
} from "node:http";
import type { AddressInfo } from "node:net";
import {
  estimateRelayPromptTokens,
  estimateTextTokens,
  normalizeUsage,
  type AnthropicMessagesResponse,
  type AnthropicMessagesStreamEvent,
  type ChatMessage,
  type OpenAiChatCompletionResponse,
  type ProviderResult,
  type RelayJob,
  type TokenUsage
} from "@anarkhli/protocol";
import {
  resolveRelayServerOptions,
  type RelayServerOptions,
  type ResolvedRelayServerOptions
} from "./config.ts";
import { dashboardHtml } from "./dashboard.ts";
import {
  HttpError,
  ProviderJobError,
  ReservationError
} from "./errors.ts";
import { ProviderHub } from "./provider-hub.ts";
import {
  bearerToken,
  createSecret,
  secureStringEqual
} from "./secrets.ts";
import {
  CredentialValidationError,
  LoginAttemptLimiter,
  hashPassword,
  normalizeDisplayName,
  normalizeUsername,
  validatePassword,
  verifyPassword
} from "./password-auth.ts";
import {
  RelayStore,
  type ConsumerPatch,
  type ConsumerRecord,
  type ProviderPatch,
  type ProviderRecord,
  type RequestStatus,
  type UserSessionRecord
} from "./store.ts";
import { modelCatalogHtml } from "./model-catalog.ts";
import { userDashboardHtml } from "./user-dashboard.ts";

export interface RelayServerAddress {
  host: string;
  port: number;
  family: string;
}

export interface RelayServerApp {
  readonly options: Readonly<ResolvedRelayServerOptions>;
  readonly httpServer: http.Server;
  readonly url: string;
  readonly baseUrl: string;
  listen(): Promise<RelayServerAddress>;
  address(): RelayServerAddress | null;
  close(): Promise<void>;
}

interface JsonObject {
  [key: string]: unknown;
}

interface RelayCompletionInput {
  model: string;
  messages: ChatMessage[];
  maxOutputTokens: number;
  temperature?: number;
}

interface RelayCompletionResult {
  id: string;
  createdAt: string;
  result: ProviderResult;
  usage: TokenUsage;
}

const MODEL_FAMILIES = [
  { id: "gpt", label: "GPT" },
  { id: "claude", label: "Claude" },
  { id: "gemini", label: "Gemini" },
  { id: "deepseek", label: "DeepSeek" },
  { id: "qwen", label: "Qwen" },
  { id: "doubao", label: "Doubao" },
  { id: "other", label: "其他" }
] as const;

class RelayServerApplication implements RelayServerApp {
  readonly httpServer: http.Server;
  readonly store: RelayStore;
  readonly providerHub: ProviderHub;
  private readonly loginAccountLimiter = new LoginAttemptLimiter(5, 10 * 60_000);
  private readonly loginIpLimiter = new LoginAttemptLimiter(50, 10 * 60_000);
  private readonly registrationIpLimiter = new LoginAttemptLimiter(5, 60 * 60_000);
  private listening = false;
  private closed = false;

  constructor(readonly options: Readonly<ResolvedRelayServerOptions>) {
    this.store = new RelayStore(options.databasePath, {
      initialUserPoints: options.initialUserPoints
    });
    this.providerHub = new ProviderHub(this.store, options);
    this.httpServer = http.createServer((request, response) => {
      void this.handleRequest(request, response);
    });
    this.httpServer.headersTimeout = 30_000;
    this.httpServer.requestTimeout = Math.max(30_000, options.requestTimeoutMs + 5_000);
    this.httpServer.keepAliveTimeout = 5_000;
    this.httpServer.maxHeadersCount = 100;
    this.httpServer.on("upgrade", (request, socket, head) => {
      const pathname = safePathname(request.url);
      if (pathname !== "/provider/v1/connect") {
        socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
        return;
      }
      this.providerHub.handleUpgrade(request, socket, head);
    });
    this.httpServer.on("clientError", (_error, socket) => {
      if (socket.writable) {
        socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
      }
    });
  }

  get url(): string {
    const address = this.address();
    if (!address) {
      throw new Error("Relay server is not listening.");
    }
    const host = address.host.includes(":") && !address.host.startsWith("[")
      ? `[${address.host}]`
      : address.host;
    return `http://${host}:${address.port}`;
  }

  get baseUrl(): string {
    return this.url;
  }

  address(): RelayServerAddress | null {
    const address = this.httpServer.address();
    if (!address || typeof address === "string") {
      return null;
    }
    return {
      host: displayHost(address, this.options.host),
      port: address.port,
      family: address.family
    };
  }

  async listen(): Promise<RelayServerAddress> {
    if (this.closed) {
      throw new Error("Relay server has already closed.");
    }
    if (this.listening) {
      return this.address()!;
    }
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => {
        this.httpServer.off("listening", onListening);
        reject(error);
      };
      const onListening = () => {
        this.httpServer.off("error", onError);
        resolve();
      };
      this.httpServer.once("error", onError);
      this.httpServer.once("listening", onListening);
      this.httpServer.listen(this.options.port, this.options.host);
    });
    this.listening = true;
    return this.address()!;
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    await this.providerHub.close();
    if (this.httpServer.listening) {
      await new Promise<void>((resolve, reject) => {
        this.httpServer.close((error) => error ? reject(error) : resolve());
        this.httpServer.closeIdleConnections();
      });
    }
    this.listening = false;
    this.store.close();
  }

  private async handleRequest(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    const pathname = safePathname(request.url);
    const isAnthropicMessagesRoute = pathname === "/v1/messages";
    const anthropicRequestId = isAnthropicMessagesRoute
      ? `req_${randomUUID().replaceAll("-", "")}`
      : null;
    const requestId = request.headers["x-request-id"];
    if (typeof requestId === "string" && requestId.length <= 128) {
      response.setHeader("x-request-id", requestId);
    }
    if (anthropicRequestId) {
      response.setHeader("request-id", anthropicRequestId);
    }
    this.applyCors(request, response);
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    try {
      if (request.method === "GET"
        && (pathname === "/" || pathname === "/dashboard")) {
        sendHtml(response, 200, userDashboardHtml());
        return;
      }
      if (request.method === "GET" && pathname === "/models") {
        sendHtml(response, 200, modelCatalogHtml());
        return;
      }
      if (request.method === "GET" && pathname === "/admin") {
        sendHtml(response, 200, dashboardHtml());
        return;
      }
      if (request.method === "GET"
        && (pathname === "/health" || pathname === "/api/health")) {
        sendJson(response, 200, {
          ok: this.store.healthCheck(),
          database: "ok",
          providersOnline: this.providerHub.onlineCount(),
          uptimeSeconds: Math.floor(process.uptime())
        });
        return;
      }
      if (pathname.startsWith("/auth/v1/")) {
        await this.handleAuthRequest(request, response, pathname);
        return;
      }
      if (pathname.startsWith("/account/v1/")) {
        await this.handleAccountRequest(request, response, pathname);
        return;
      }
      if (request.method === "GET" && pathname === "/catalog/v1/models") {
        this.handleCatalogRequest(request, response);
        return;
      }
      if (pathname.startsWith("/admin/v1/")) {
        this.requireAllowedAdminOrigin(request);
        this.requireAdmin(request);
        await this.handleAdminRequest(request, response, pathname);
        return;
      }
      if (request.method === "GET" && pathname === "/v1/models") {
        this.handleModelsRequest(request, response);
        return;
      }
      if (request.method === "POST" && pathname === "/v1/chat/completions") {
        await this.handleChatCompletion(request, response);
        return;
      }
      if (request.method === "POST" && isAnthropicMessagesRoute) {
        await this.handleAnthropicMessages(request, response);
        return;
      }
      throw new HttpError(404, "not_found", "Route not found.");
    } catch (error) {
      if (response.writableEnded || response.destroyed) {
        return;
      }
      const httpError = toHttpError(error);
      if (anthropicRequestId) {
        sendAnthropicHttpError(response, httpError, anthropicRequestId);
      } else {
        sendHttpError(response, httpError);
      }
    }
  }

  private async handleAuthRequest(
    request: IncomingMessage,
    response: ServerResponse,
    pathname: string
  ): Promise<void> {
    if (request.method === "GET" && pathname === "/auth/v1/session") {
      const token = this.sessionTokenFromRequest(request);
      const session = token
        ? this.store.authenticateUserSession(token)
        : null;
      if (token && !session) {
        response.setHeader(
          "set-cookie",
          clearCookie(this.userSessionCookieName(), this.useSecureCookies())
        );
      }
      sendJson(response, 200, session
        ? {
            authenticated: true,
            user: publicUser(session),
            expiresAt: session.expiresAt
          }
        : {
            authenticated: false
          });
      return;
    }

    if (request.method === "POST" && pathname === "/auth/v1/register") {
      this.requireAllowedAccountOrigin(request);
      const registrationKey = request.socket.remoteAddress ?? "unknown";
      this.requireRateLimitAvailable(
        response,
        this.registrationIpLimiter,
        registrationKey
      );
      this.registrationIpLimiter.recordFailure(registrationKey);
      const body = await readJsonObject(request, this.options.bodyLimitBytes);
      const usernameInput = credentialString(body, "username");
      const password = credentialString(body, "password");
      const displayNameInput = optionalCredentialString(body, "displayName");
      let username: string;
      let displayName: string;
      try {
        username = normalizeUsername(usernameInput);
        validatePassword(password);
        displayName = normalizeDisplayName(displayNameInput, username);
      } catch (error) {
        throw credentialValidationHttpError(error);
      }
      const passwordHash = await hashPassword(password);
      const user = this.store.createPasswordUser({
        username,
        normalizedUsername: username,
        passwordHash,
        displayName
      });
      this.sendAuthenticatedSession(response, user.id, 201);
      return;
    }

    if (request.method === "POST" && pathname === "/auth/v1/login") {
      this.requireAllowedAccountOrigin(request);
      const remoteAddress = request.socket.remoteAddress ?? "unknown";
      this.requireRateLimitAvailable(
        response,
        this.loginIpLimiter,
        remoteAddress
      );
      const body = await readJsonObject(request, this.options.bodyLimitBytes);
      const usernameInput = credentialString(body, "username");
      const password = credentialString(body, "password");
      let username: string;
      let validPasswordShape = true;
      try {
        username = normalizeUsername(usernameInput);
      } catch {
        username = usernameInput.trim().normalize("NFKC").toLowerCase().slice(0, 64);
      }
      try {
        validatePassword(password);
      } catch {
        validPasswordShape = false;
      }
      const limiterKey = `${remoteAddress}\0${username}`;
      this.requireRateLimitAvailable(
        response,
        this.loginAccountLimiter,
        limiterKey
      );
      const identity = validPasswordShape && username
        ? this.store.findPasswordUser(username)
        : null;
      const passwordMatches = await verifyPassword(
        password,
        identity?.passwordHash ?? null
      );
      if (!identity || identity.user.disabled || !passwordMatches) {
        this.loginAccountLimiter.recordFailure(limiterKey);
        this.loginIpLimiter.recordFailure(remoteAddress);
        throw new HttpError(
          401,
          "invalid_credentials",
          "Invalid username or password.",
          "authentication_error"
        );
      }
      this.loginAccountLimiter.reset(limiterKey);
      const user = this.store.recordUserLogin(identity.user.id);
      this.sendAuthenticatedSession(response, user.id, 200);
      return;
    }

    if (request.method === "POST" && pathname === "/auth/v1/logout") {
      this.requireAllowedAccountOrigin(request);
      await readJsonObject(request, this.options.bodyLimitBytes);
      const token = this.sessionTokenFromRequest(request);
      if (token) {
        this.store.revokeUserSession(token);
      }
      response.setHeader(
        "set-cookie",
        clearCookie(this.userSessionCookieName(), this.useSecureCookies())
      );
      response.writeHead(204, {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff"
      });
      response.end();
      return;
    }

    throw new HttpError(404, "not_found", "Authentication route not found.");
  }

  private sendAuthenticatedSession(
    response: ServerResponse,
    userId: string,
    status: number
  ): void {
    const sessionToken = createSecret("session");
    const expiresAt = new Date(Date.now() + this.options.userSessionTtlMs);
    const session = this.store.createUserSession(
      userId,
      sessionToken,
      expiresAt.toISOString()
    );
    response.setHeader(
      "set-cookie",
      serializeCookie(
        this.userSessionCookieName(),
        sessionToken,
        {
          maxAgeSeconds: Math.floor(this.options.userSessionTtlMs / 1_000),
          secure: this.useSecureCookies()
        }
      )
    );
    sendJson(response, status, {
      authenticated: true,
      user: publicUser(session),
      expiresAt: session.expiresAt
    });
  }

  private requireRateLimitAvailable(
    response: ServerResponse,
    limiter: LoginAttemptLimiter,
    key: string
  ): void {
    const retryAfterSeconds = limiter.retryAfterSeconds(key);
    if (retryAfterSeconds === null) {
      return;
    }
    response.setHeader("retry-after", String(retryAfterSeconds));
    throw new HttpError(
      429,
      "too_many_login_attempts",
      "Too many authentication attempts. Try again later.",
      "authentication_error"
    );
  }

  private handleCatalogRequest(
    request: IncomingMessage,
    response: ServerResponse
  ): void {
    const token = this.sessionTokenFromRequest(request);
    const session = token
      ? this.store.authenticateUserSession(token)
      : null;
    const viewerUserId = session?.user.id ?? null;
    const providers = this.catalogProvidersForUser(viewerUserId);
    const models = providers.flatMap((provider) => provider.models.map(
      (model) => ({
        key: `${provider.id}:${model}`,
        id: model,
        family: modelFamily(model),
        providerId: provider.id,
        providerName: provider.name,
        ownedByCurrentUser: provider.ownedByCurrentUser,
        online: provider.online,
        bindable: provider.bindable
          && provider.liveModels.includes(model),
        available: provider.availableModels.includes(model),
        unavailableReason: unavailableModelReason(
          provider,
          model
        )
      })
    )).sort(compareCatalogModels);
    sendJson(response, 200, {
      viewer: {
        authenticated: Boolean(session)
      },
      families: MODEL_FAMILIES,
      providers: providers.map(({ liveModels, availableModels, ...provider }) => provider),
      models
    });
  }

  private catalogProvidersForUser(userId: string | null): Array<{
    id: string;
    name: string;
    listed: boolean;
    ownedByCurrentUser: boolean;
    online: boolean;
    models: string[];
    liveModels: string[];
    availableModels: string[];
    bindable: boolean;
    available: boolean;
    unavailableReason: string | null;
  }> {
    return this.store.listProviders()
      .filter((provider) => provider.enabled
        && provider.ownerUserId !== null
        && (provider.listed || provider.ownerUserId === userId))
      .map((provider) => this.catalogProvider(provider, userId))
      .sort((left, right) => left.name.localeCompare(right.name, "zh-CN")
        || left.id.localeCompare(right.id));
  }

  private catalogProvider(
    provider: ProviderRecord,
    userId: string | null
  ): {
    id: string;
    name: string;
    listed: boolean;
    ownedByCurrentUser: boolean;
    online: boolean;
    models: string[];
    liveModels: string[];
    availableModels: string[];
    bindable: boolean;
    available: boolean;
    unavailableReason: string | null;
  } {
    const presence = this.providerHub.presence(provider.id);
    const liveModels = presence.online ? presence.models : [];
    const models = (presence.online
      ? liveModels
      : provider.advertisedModels
    ).slice().sort();
    const bindable = presence.online && liveModels.length > 0;
    const availableModels = liveModels.filter(
      (model) => provider.remainingTokens > 0
        && this.providerHub.isAvailable(provider.id, model)
    );
    return {
      id: provider.id,
      name: provider.name,
      listed: provider.listed,
      ownedByCurrentUser: provider.ownerUserId === userId,
      online: presence.online,
      models,
      liveModels,
      availableModels,
      bindable,
      available: availableModels.length > 0,
      unavailableReason: !presence.online
        ? "provider_offline"
        : liveModels.length === 0
          ? "no_models"
          : provider.remainingTokens <= 0
            ? "quota_exhausted"
            : availableModels.length === 0
              ? "at_capacity"
              : null
    };
  }

  private async handleAccountRequest(
    request: IncomingMessage,
    response: ServerResponse,
    pathname: string
  ): Promise<void> {
    const session = this.requireUserSession(request);
    if (request.method !== "GET") {
      this.requireAllowedAccountOrigin(request);
    }

    if (request.method === "GET" && pathname === "/account/v1/overview") {
      const providers = this.store
        .listProvidersForUser(session.user.id)
        .map((provider) => ({
          ...provider,
          ...this.providerHub.presence(provider.id)
        }));
      const consumers = this.store.listConsumersForUser(session.user.id);
      const requests = this.store.listRequestsForUser(session.user.id);
      const usage = this.store.usageStatsForUser(session.user.id);
      const pointLedger = this.store.listPointLedgerForUser(session.user.id, 50);
      const availableProviders = this
        .catalogProvidersForUser(session.user.id)
        .map(({ liveModels, availableModels, ...provider }) => provider);
      const summary = {
        providers: providers.length,
        providersOnline: providers.filter(
          (provider) => provider.online
        ).length,
        consumers: consumers.length,
        consumersEnabled: consumers.filter(
          (consumer) => consumer.enabled
        ).length,
        requests: usage.consumerRequests,
        activeRequests: usage.consumerActiveRequests,
        tokensUsed: usage.consumerTokensUsed,
        consumerTokensUsed: usage.consumerTokensUsed,
        consumerTokensReserved: usage.consumerTokensReserved,
        providerRequests: usage.providerRequests,
        providerActiveRequests: usage.providerActiveRequests,
        providerTokensServed: usage.providerTokensServed,
        providerTokensReserved: usage.providerTokensReserved,
        pointsSpent: usage.pointsSpent,
        pointsEarned: usage.pointsEarned,
        pointBalance: session.user.pointBalance,
        pointsReserved: session.user.pointsReserved,
        availablePoints: session.user.availablePoints
      };
      sendJson(response, 200, {
        user: publicUser(session),
        providers,
        consumers,
        requests,
        pointLedger,
        availableProviders,
        summary
      });
      return;
    }

    if (request.method === "POST" && pathname === "/account/v1/providers") {
      const body = await readJsonObject(request, this.options.bodyLimitBytes);
      sendJson(response, 201, this.store.createProvider({
        ownerUserId: session.user.id,
        name: requiredString(body, "name", 128),
        listed: optionalBoolean(body, "listed") ?? true,
        tokenLimit: optionalPositiveInteger(
          body,
          "tokenLimit",
          1_000_000_000_000
        ) ?? this.options.defaultProviderTokenLimit,
        maxConcurrent: optionalPositiveInteger(
          body,
          "maxConcurrent",
          1_024
        ) ?? this.options.defaultProviderMaxConcurrent
      }));
      return;
    }

    if (request.method === "POST" && pathname === "/account/v1/consumers") {
      const body = await readJsonObject(request, this.options.bodyLimitBytes);
      const providerId = requiredString(body, "providerId", 128);
      const model = requiredString(body, "model", 256);
      this.requireSelectableProvider(
        providerId,
        model,
        session.user.id
      );
      sendJson(response, 201, this.store.createConsumer({
        ownerUserId: session.user.id,
        name: requiredString(body, "name", 128),
        providerId,
        model,
        tokenLimit: requiredPositiveInteger(
          body,
          "tokenLimit",
          1_000_000_000_000
        ),
        maxConcurrent: requiredPositiveInteger(
          body,
          "maxConcurrent",
          1_024
        )
      }));
      return;
    }

    const rotateProviderMatch =
      /^\/account\/v1\/providers\/([^/]+)\/rotate-token$/.exec(pathname);
    if (request.method === "POST" && rotateProviderMatch) {
      await readJsonObject(request, this.options.bodyLimitBytes);
      const id = decodePathPart(rotateProviderMatch[1]!);
      this.requireOwnedProvider(id, session.user.id);
      const result = this.store.rotateProviderToken(id);
      this.providerHub.disconnectProvider(
        id,
        "Provider token was rotated; reconnect with the new token."
      );
      sendJson(response, 200, result);
      return;
    }

    const rotateConsumerMatch =
      /^\/account\/v1\/consumers\/([^/]+)\/rotate-key$/.exec(pathname);
    if (request.method === "POST" && rotateConsumerMatch) {
      await readJsonObject(request, this.options.bodyLimitBytes);
      const id = decodePathPart(rotateConsumerMatch[1]!);
      this.requireOwnedConsumer(id, session.user.id);
      sendJson(response, 200, this.store.rotateConsumerKey(id));
      return;
    }

    const providerMatch = /^\/account\/v1\/providers\/([^/]+)$/.exec(pathname);
    if (request.method === "PATCH" && providerMatch) {
      const id = decodePathPart(providerMatch[1]!);
      this.requireOwnedProvider(id, session.user.id);
      const body = await readJsonObject(request, this.options.bodyLimitBytes);
      const patch = parseProviderPatch(body);
      const provider = this.store.patchProvider(id, patch);
      if (patch.enabled === false) {
        this.providerHub.disconnectProvider(
          id,
          "Provider was disabled by its owner."
        );
      }
      sendJson(response, 200, { provider });
      return;
    }

    const consumerMatch = /^\/account\/v1\/consumers\/([^/]+)$/.exec(pathname);
    if (request.method === "PATCH" && consumerMatch) {
      const id = decodePathPart(consumerMatch[1]!);
      const current = this.requireOwnedConsumer(id, session.user.id);
      const body = await readJsonObject(request, this.options.bodyLimitBytes);
      const patch = parseConsumerPatch(body);
      if (patch.providerId !== undefined || patch.model !== undefined) {
        this.requireSelectableProvider(
          patch.providerId ?? current.providerId,
          patch.model ?? current.model,
          session.user.id
        );
      }
      sendJson(response, 200, {
        consumer: this.store.patchConsumer(id, patch)
      });
      return;
    }

    throw new HttpError(404, "not_found", "Account route not found.");
  }

  private requireSelectableProvider(
    providerId: string,
    model: string,
    userId: string
  ): void {
    const provider = this.store.getProvider(providerId);
    const ownedByUser = provider?.ownerUserId === userId;
    const sharedWithCatalog = provider?.ownerUserId !== null
      && provider?.listed === true;
    if (!provider?.enabled || (!ownedByUser && !sharedWithCatalog)) {
      throw new HttpError(
        404,
        "provider_not_found",
        "Provider not found."
      );
    }
    const presence = this.providerHub.presence(providerId);
    if (!presence.online || !presence.models.includes(model)) {
      throw new HttpError(
        409,
        "model_not_available",
        "The selected model is not currently advertised by this Provider."
      );
    }
  }

  private requireOwnedProvider(id: string, userId: string) {
    const provider = this.store.getOwnedProvider(id, userId);
    if (!provider) {
      throw new HttpError(404, "provider_not_found", "Provider not found.");
    }
    return provider;
  }

  private requireOwnedConsumer(id: string, userId: string) {
    const consumer = this.store.getOwnedConsumer(id, userId);
    if (!consumer) {
      throw new HttpError(404, "consumer_not_found", "Consumer not found.");
    }
    return consumer;
  }

  private requireUserSession(request: IncomingMessage): UserSessionRecord {
    const token = this.sessionTokenFromRequest(request);
    const session = token
      ? this.store.authenticateUserSession(token)
      : null;
    if (!session) {
      throw new HttpError(
        401,
        "authentication_required",
        "A valid user session is required.",
        "authentication_error"
      );
    }
    return session;
  }

  private sessionTokenFromRequest(request: IncomingMessage): string | null {
    return cookieValue(
      request.headers.cookie,
      this.userSessionCookieName()
    );
  }

  private requireAllowedAccountOrigin(request: IncomingMessage): void {
    const fetchSite = request.headers["sec-fetch-site"];
    if (typeof fetchSite === "string" && fetchSite === "cross-site") {
      throw new HttpError(
        403,
        "origin_not_allowed",
        "Cross-site account requests are not allowed.",
        "authentication_error"
      );
    }
    const origin = request.headers.origin;
    const trustedOrigin = this.options.publicUrl
      ?? (isLoopbackHost(this.options.host) && this.address()
        ? this.url
        : null);
    if (!trustedOrigin || origin !== trustedOrigin) {
      throw new HttpError(
        403,
        "origin_not_allowed",
        "Account mutations require the configured same origin.",
        "authentication_error"
      );
    }
  }

  private useSecureCookies(): boolean {
    return this.options.publicUrl?.startsWith("https://") === true;
  }

  private userSessionCookieName(): string {
    return this.useSecureCookies()
      ? "__Host-token-relay-session"
      : "token-relay-session";
  }

  private async handleAdminRequest(
    request: IncomingMessage,
    response: ServerResponse,
    pathname: string
  ): Promise<void> {
    if (request.method === "GET" && pathname === "/admin/v1/overview") {
      const providers = this.store.listProviders().map((provider) => ({
        ...provider,
        ...this.providerHub.presence(provider.id)
      }));
      const consumers = this.store.listConsumers();
      const requests = this.store.listRequests();
      const summary = {
        ...this.store.summary(),
        providersOnline: this.providerHub.onlineCount()
      };
      sendJson(response, 200, { providers, consumers, requests, summary });
      return;
    }

    if (request.method === "POST" && pathname === "/admin/v1/providers") {
      const body = await readJsonObject(request, this.options.bodyLimitBytes);
      const name = requiredString(body, "name", 128);
      const tokenLimit = optionalPositiveInteger(body, "tokenLimit", 1_000_000_000_000)
        ?? this.options.defaultProviderTokenLimit;
      const maxConcurrent = optionalPositiveInteger(body, "maxConcurrent", 1_024)
        ?? this.options.defaultProviderMaxConcurrent;
      sendJson(response, 201, this.store.createProvider({
        name,
        tokenLimit,
        maxConcurrent
      }));
      return;
    }

    if (request.method === "POST" && pathname === "/admin/v1/consumers") {
      const body = await readJsonObject(request, this.options.bodyLimitBytes);
      const result = this.store.createConsumer({
        name: requiredString(body, "name", 128),
        providerId: requiredString(body, "providerId", 128),
        model: requiredString(body, "model", 256),
        tokenLimit: requiredPositiveInteger(body, "tokenLimit", 1_000_000_000_000),
        maxConcurrent: requiredPositiveInteger(body, "maxConcurrent", 1_024)
      });
      sendJson(response, 201, result);
      return;
    }

    const providerMatch = /^\/admin\/v1\/providers\/([^/]+)$/.exec(pathname);
    if (request.method === "PATCH" && providerMatch) {
      const id = decodePathPart(providerMatch[1]!);
      const body = await readJsonObject(request, this.options.bodyLimitBytes);
      const patch = parseProviderPatch(body);
      const provider = this.store.patchProvider(id, patch);
      if (patch.enabled === false) {
        this.providerHub.disconnectProvider(id, "Provider was disabled by an administrator.");
      }
      sendJson(response, 200, { provider });
      return;
    }

    const consumerMatch = /^\/admin\/v1\/consumers\/([^/]+)$/.exec(pathname);
    if (request.method === "PATCH" && consumerMatch) {
      const id = decodePathPart(consumerMatch[1]!);
      const body = await readJsonObject(request, this.options.bodyLimitBytes);
      sendJson(response, 200, {
        consumer: this.store.patchConsumer(id, parseConsumerPatch(body))
      });
      return;
    }

    const rotateProviderMatch =
      /^\/admin\/v1\/providers\/([^/]+)\/rotate-token$/.exec(pathname);
    if (request.method === "POST" && rotateProviderMatch) {
      const id = decodePathPart(rotateProviderMatch[1]!);
      const result = this.store.rotateProviderToken(id);
      this.providerHub.disconnectProvider(
        id,
        "Provider token was rotated; reconnect with the new token."
      );
      sendJson(response, 200, result);
      return;
    }

    const rotateConsumerMatch =
      /^\/admin\/v1\/consumers\/([^/]+)\/rotate-key$/.exec(pathname);
    if (request.method === "POST" && rotateConsumerMatch) {
      const id = decodePathPart(rotateConsumerMatch[1]!);
      sendJson(response, 200, this.store.rotateConsumerKey(id));
      return;
    }

    throw new HttpError(404, "not_found", "Admin route not found.");
  }

  private handleModelsRequest(
    request: IncomingMessage,
    response: ServerResponse
  ): void {
    const consumer = this.requireConsumer(request);
    if (!consumer.enabled) {
      throw new HttpError(403, "consumer_disabled", "Consumer is disabled.");
    }
    sendJson(response, 200, {
      object: "list",
      data: [{
        id: consumer.model,
        object: "model",
        created: Math.floor(Date.parse(consumer.createdAt) / 1000),
        owned_by: consumer.providerId
      }]
    });
  }

  private async handleChatCompletion(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    const authenticatedConsumer = this.requireConsumer(request);
    const body = await readJsonObject(request, this.options.bodyLimitBytes);
    const completion = parseChatCompletion(body);
    const executed = await this.executeRelayCompletion(
      request,
      response,
      authenticatedConsumer,
      completion,
      "chatcmpl_"
    );
    if (response.writableEnded || response.destroyed) {
      return;
    }

    const responseBody: OpenAiChatCompletionResponse = {
      id: executed.id,
      object: "chat.completion",
      created: Math.floor(Date.parse(executed.createdAt) / 1000),
      model: completion.model,
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: executed.result.content
        },
        finish_reason: executed.result.finishReason
      }],
      usage: {
        prompt_tokens: executed.usage.promptTokens,
        completion_tokens: executed.usage.completionTokens,
        total_tokens: executed.usage.totalTokens
      }
    };
    sendJson(response, 200, responseBody);
  }

  private async handleAnthropicMessages(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    const authenticatedConsumer = this.requireConsumer(request);
    const body = await readJsonObject(request, this.options.bodyLimitBytes);
    const parsed = parseAnthropicMessages(body);
    const executed = await this.executeRelayCompletion(
      request,
      response,
      authenticatedConsumer,
      parsed.completion,
      "msg_"
    );
    if (response.writableEnded || response.destroyed) {
      return;
    }

    const stopReason = executed.result.finishReason === "length"
      ? "max_tokens"
      : "end_turn";
    if (parsed.stream) {
      sendAnthropicEventStream(response, {
        id: executed.id,
        model: parsed.completion.model,
        content: executed.result.content,
        stopReason,
        usage: executed.usage
      });
      return;
    }
    const responseBody: AnthropicMessagesResponse = {
      id: executed.id,
      type: "message",
      role: "assistant",
      model: parsed.completion.model,
      content: [{
        type: "text",
        text: executed.result.content
      }],
      stop_reason: stopReason,
      stop_sequence: null,
      usage: {
        input_tokens: executed.usage.promptTokens,
        output_tokens: executed.usage.completionTokens
      }
    };
    sendJson(response, 200, responseBody);
  }

  private async executeRelayCompletion(
    request: IncomingMessage,
    response: ServerResponse,
    authenticatedConsumer: ConsumerRecord,
    completion: RelayCompletionInput,
    idPrefix: "chatcmpl_" | "msg_"
  ): Promise<RelayCompletionResult> {
    if (completion.model !== authenticatedConsumer.model) {
      throw new HttpError(
        403,
        "model_not_allowed",
        `This API key is configured only for model ${authenticatedConsumer.model}.`,
        "invalid_request_error",
        "model"
      );
    }
    assertProviderAvailable(
      this.store,
      this.providerHub,
      authenticatedConsumer,
      completion.model
    );
    const promptTokens = estimateRelayPromptTokens({
      model: completion.model,
      messages: completion.messages,
      maxOutputTokens: completion.maxOutputTokens
    });
    const reservedTokens = promptTokens + completion.maxOutputTokens;
    if (!Number.isSafeInteger(reservedTokens)) {
      throw new HttpError(
        400,
        "token_reservation_too_large",
        "The request is too large to reserve tokens safely."
      );
    }

    const id = `${idPrefix}${randomUUID().replaceAll("-", "")}`;
    const leaseToken = createSecret("lease");
    const createdAt = new Date().toISOString();
    const deadlineAt = new Date(
      Date.now() + Math.min(this.options.requestTimeoutMs, this.options.leaseMs)
    ).toISOString();
    try {
      this.store.reserveRequest({
        id,
        consumerId: authenticatedConsumer.id,
        providerId: authenticatedConsumer.providerId,
        model: completion.model,
        reservedTokens,
        promptTokensEstimated: promptTokens,
        maxOutputTokens: completion.maxOutputTokens,
        createdAt,
        deadlineAt
      });
    } catch (error) {
      if (error instanceof ReservationError) {
        throw reservationHttpError(error);
      }
      throw error;
    }

    const job: RelayJob = {
      id,
      leaseToken,
      model: completion.model,
      messages: completion.messages,
      maxOutputTokens: completion.maxOutputTokens,
      temperature: completion.temperature,
      createdAt,
      deadlineAt
    };
    const onResponseClose = () => {
      if (!response.writableEnded) {
        this.providerHub.cancel(
          id,
          "The consumer disconnected before the request completed."
        );
      }
    };
    response.on("close", onResponseClose);
    const throwProviderFailure = (error: unknown): never => {
      const providerError = providerJobError(error);
      this.store.settleRequest(id, {
        status: requestStatusForProviderError(providerError),
        usage: failureUsage(providerError, promptTokens),
        errorCode: providerError.code,
        errorMessage: providerError.message
      });
      throw providerHttpError(providerError);
    };

    try {
      let providerResultPromise: Promise<ProviderResult>;
      try {
        providerResultPromise = this.providerHub.dispatch(
          authenticatedConsumer.providerId,
          job
        );
      } catch (error) {
        return throwProviderFailure(error);
      }
      // If persistence fails before the await below, retain a rejection handler
      // so a later provider disconnect cannot become an unhandled rejection.
      void providerResultPromise.catch(() => undefined);
      this.store.markRequestDispatched(id);

      let result: ProviderResult;
      try {
        result = await providerResultPromise;
      } catch (error) {
        return throwProviderFailure(error);
      }

      let usage: TokenUsage;
      try {
        usage = accountableResultUsage(
          result.usage,
          promptTokens,
          estimateTextTokens(result.content),
          reservedTokens
        );
      } catch (error) {
        return throwProviderFailure(error);
      }

      if (!this.store.settleRequest(id, {
        status: "completed",
        usage
      })) {
        throw new Error(`Request ${id} could not be settled exactly once.`);
      }
      return { id, createdAt, result, usage };
    } finally {
      response.off("close", onResponseClose);
    }
  }

  private requireAdmin(request: IncomingMessage): void {
    const token = bearerToken(request.headers.authorization);
    if (!token || !secureStringEqual(token, this.options.adminToken)) {
      throw new HttpError(
        401,
        "invalid_admin_token",
        "A valid admin bearer token is required.",
        "authentication_error"
      );
    }
  }

  private requireAllowedAdminOrigin(request: IncomingMessage): void {
    const origin = request.headers.origin;
    if (!origin) {
      return;
    }
    if (origin === this.options.corsOrigin) {
      return;
    }
    try {
      const originUrl = new URL(origin);
      if (originUrl.host === request.headers.host) {
        return;
      }
    } catch {
      // Rejected below.
    }
    throw new HttpError(
      403,
      "origin_not_allowed",
      "Admin request origin is not allowed.",
      "authentication_error"
    );
  }

  private requireConsumer(request: IncomingMessage): ConsumerRecord {
    const bearer = bearerToken(request.headers.authorization);
    const apiKeyHeader = request.headers["x-api-key"];
    const apiKey = typeof apiKeyHeader === "string" && apiKeyHeader.trim()
      ? apiKeyHeader.trim()
      : null;
    const tokens = bearer === apiKey
      ? [bearer]
      : [bearer, apiKey];
    let consumer: ConsumerRecord | null = null;
    for (const token of tokens) {
      if (token) {
        consumer = this.store.authenticateConsumer(token);
      }
      if (consumer) {
        break;
      }
    }
    if (!consumer) {
      throw new HttpError(
        401,
        "invalid_api_key",
        "Incorrect API key provided.",
        "authentication_error"
      );
    }
    return consumer;
  }

  private applyCors(
    request: IncomingMessage,
    response: ServerResponse
  ): void {
    const configured = this.options.corsOrigin;
    if (!configured) {
      return;
    }
    const origin = request.headers.origin;
    if (configured !== "*" && origin !== configured) {
      return;
    }
    response.setHeader("access-control-allow-origin", configured === "*" ? "*" : origin!);
    response.setHeader(
      "access-control-allow-headers",
      "authorization, content-type, x-api-key, x-request-id, anthropic-version, anthropic-beta"
    );
    response.setHeader(
      "access-control-allow-methods",
      "GET, POST, PATCH, OPTIONS"
    );
    response.setHeader("access-control-max-age", "600");
    if (configured !== "*") {
      response.setHeader("vary", "Origin");
    }
  }
}

export async function createRelayServer(
  options: RelayServerOptions = {}
): Promise<RelayServerApp> {
  const resolved = resolveRelayServerOptions(options);
  return new RelayServerApplication(resolved);
}

function parseChatCompletion(body: JsonObject): {
  model: string;
  messages: ChatMessage[];
  maxOutputTokens: number;
  temperature?: number;
} {
  const model = requiredString(body, "model", 256);
  if (!Array.isArray(body.messages)
    || body.messages.length === 0
    || body.messages.length > 256) {
    throw new HttpError(
      400,
      "invalid_messages",
      "messages must be an array containing between 1 and 256 messages.",
      "invalid_request_error",
      "messages"
    );
  }
  const roles = new Set(["system", "developer", "user", "assistant"]);
  const messages = body.messages.map((value, index): ChatMessage => {
    if (!isObject(value)
      || typeof value.role !== "string"
      || !roles.has(value.role)
      || typeof value.content !== "string") {
      throw new HttpError(
        400,
        "invalid_message",
        `messages[${index}] must contain a supported role and string content.`,
        "invalid_request_error",
        `messages.${index}`
      );
    }
    if (value.content.length > 500_000) {
      throw new HttpError(
        400,
        "message_too_large",
        `messages[${index}].content is too large.`,
        "invalid_request_error",
        `messages.${index}.content`
      );
    }
    return {
      role: value.role as ChatMessage["role"],
      content: value.content
    };
  });
  if (body.stream !== undefined && body.stream !== false) {
    throw new HttpError(
      400,
      "streaming_not_supported",
      "stream=true is not supported by this relay.",
      "invalid_request_error",
      "stream"
    );
  }
  const maxCompletion = body.max_completion_tokens;
  const maxTokens = body.max_tokens;
  if (maxCompletion !== undefined && maxTokens !== undefined) {
    throw new HttpError(
      400,
      "conflicting_max_tokens",
      "Provide only one of max_tokens or max_completion_tokens.",
      "invalid_request_error",
      "max_completion_tokens"
    );
  }
  const maxOutputTokens = positiveIntegerValue(
    maxCompletion ?? maxTokens ?? 1_024,
    "max_completion_tokens",
    32_768
  );
  const temperature = body.temperature === undefined
    ? undefined
    : finiteNumber(body.temperature, "temperature", 0, 2);
  return { model, messages, maxOutputTokens, temperature };
}

function parseAnthropicMessages(body: JsonObject): {
  completion: RelayCompletionInput;
  stream: boolean;
} {
  const model = requiredString(body, "model", 256);
  if (!Array.isArray(body.messages)
    || body.messages.length === 0
    || body.messages.length > 256) {
    throw new HttpError(
      400,
      "invalid_messages",
      "messages must be an array containing between 1 and 256 messages.",
      "invalid_request_error",
      "messages"
    );
  }
  if (body.tools !== undefined) {
    if (!Array.isArray(body.tools)) {
      throw new HttpError(
        400,
        "invalid_tools",
        "tools must be an array when provided.",
        "invalid_request_error",
        "tools"
      );
    }
    if (body.tools.length > 0) {
      throw new HttpError(
        400,
        "tools_not_supported",
        "Tool definitions and tool use are not supported by this relay.",
        "invalid_request_error",
        "tools"
      );
    }
  }

  const messages: ChatMessage[] = [];
  if (body.system !== undefined) {
    messages.push({
      role: "system",
      content: flattenAnthropicTextContent(body.system, "system")
    });
  }
  for (const [index, value] of body.messages.entries()) {
    if (!isObject(value)
      || (value.role !== "user" && value.role !== "assistant")) {
      throw new HttpError(
        400,
        "invalid_message",
        `messages[${index}].role must be user or assistant.`,
        "invalid_request_error",
        `messages.${index}.role`
      );
    }
    messages.push({
      role: value.role,
      content: flattenAnthropicTextContent(
        value.content,
        `messages.${index}.content`
      )
    });
  }

  const maxOutputTokens = requiredPositiveInteger(body, "max_tokens", 32_768);
  const temperature = body.temperature === undefined
    ? undefined
    : finiteNumber(body.temperature, "temperature", 0, 1);
  if (body.stream !== undefined && typeof body.stream !== "boolean") {
    throw new HttpError(
      400,
      "invalid_stream",
      "stream must be a boolean when provided.",
      "invalid_request_error",
      "stream"
    );
  }
  return {
    completion: {
      model,
      messages,
      maxOutputTokens,
      temperature
    },
    stream: body.stream === true
  };
}

function flattenAnthropicTextContent(value: unknown, path: string): string {
  if (typeof value === "string") {
    assertMessageTextSize(value, path);
    return value;
  }
  if (!Array.isArray(value)) {
    throw new HttpError(
      400,
      "invalid_content",
      `${path} must be a string or an array of text blocks.`,
      "invalid_request_error",
      path
    );
  }
  if (value.length > 256) {
    throw new HttpError(
      400,
      "invalid_content",
      `${path} must contain no more than 256 content blocks.`,
      "invalid_request_error",
      path
    );
  }
  const textParts = value.map((block, index) => {
    const blockPath = `${path}.${index}`;
    if (!isObject(block) || block.type !== "text") {
      const blockType = isObject(block) && typeof block.type === "string"
        ? block.type
        : "unknown";
      throw new HttpError(
        400,
        "unsupported_content_block",
        `${blockPath} has unsupported content block type ${JSON.stringify(blockType)}; only text blocks are supported.`,
        "invalid_request_error",
        blockPath
      );
    }
    if (typeof block.text !== "string") {
      throw new HttpError(
        400,
        "invalid_text_block",
        `${blockPath}.text must be a string.`,
        "invalid_request_error",
        `${blockPath}.text`
      );
    }
    return block.text;
  });
  const text = textParts.join("");
  assertMessageTextSize(text, path);
  return text;
}

function assertMessageTextSize(text: string, path: string): void {
  if (text.length > 500_000) {
    throw new HttpError(
      400,
      "message_too_large",
      `${path} is too large.`,
      "invalid_request_error",
      path
    );
  }
}

function assertProviderAvailable(
  store: RelayStore,
  hub: ProviderHub,
  consumer: ConsumerRecord,
  model: string
): void {
  if (!consumer.enabled) {
    throw new HttpError(403, "consumer_disabled", "Consumer is disabled.");
  }
  const provider = store.getProvider(consumer.providerId);
  if (!provider?.enabled) {
    throw new HttpError(
      503,
      "provider_unavailable",
      "The configured provider is disabled or no longer exists.",
      "service_unavailable_error"
    );
  }
  const presence = hub.presence(provider.id);
  if (!presence.online) {
    throw new HttpError(
      503,
      "provider_offline",
      "The configured provider SDK is offline.",
      "service_unavailable_error"
    );
  }
  if (!presence.models.includes(model)) {
    throw new HttpError(
      503,
      "model_unavailable",
      `The configured provider did not advertise model ${model}.`,
      "service_unavailable_error",
      "model"
    );
  }
  if (!hub.isAvailable(provider.id, model)) {
    throw new HttpError(
      429,
      "provider_concurrency_exceeded",
      "The configured provider is currently at capacity.",
      "rate_limit_error"
    );
  }
}

function parseProviderPatch(body: JsonObject): ProviderPatch {
  return {
    name: optionalString(body, "name", 128),
    enabled: optionalBoolean(body, "enabled"),
    listed: optionalBoolean(body, "listed"),
    tokenLimit: optionalPositiveInteger(body, "tokenLimit", 1_000_000_000_000),
    maxConcurrent: optionalPositiveInteger(body, "maxConcurrent", 1_024)
  };
}

function parseConsumerPatch(body: JsonObject): ConsumerPatch {
  return {
    name: optionalString(body, "name", 128),
    enabled: optionalBoolean(body, "enabled"),
    tokenLimit: optionalPositiveInteger(body, "tokenLimit", 1_000_000_000_000),
    maxConcurrent: optionalPositiveInteger(body, "maxConcurrent", 1_024),
    providerId: optionalString(body, "providerId", 128),
    model: optionalString(body, "model", 256)
  };
}

async function readJsonObject(
  request: IncomingMessage,
  limit: number
): Promise<JsonObject> {
  const contentType = request.headers["content-type"];
  if (!contentType || !contentType.toLowerCase().startsWith("application/json")) {
    throw new HttpError(
      415,
      "unsupported_media_type",
      "Content-Type must be application/json."
    );
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) {
      throw new HttpError(
        413,
        "request_too_large",
        `JSON request body exceeds the ${limit} byte limit.`
      );
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) {
    return {};
  }
  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!isObject(value)) {
      throw new Error("JSON body is not an object.");
    }
    return value;
  } catch {
    throw new HttpError(400, "invalid_json", "Request body must be a JSON object.");
  }
}

function requiredString(body: JsonObject, key: string, maxLength: number): string {
  const value = body[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(
      400,
      "invalid_parameter",
      `${key} must be a non-empty string.`,
      "invalid_request_error",
      key
    );
  }
  const text = value.trim();
  if (text.length > maxLength) {
    throw new HttpError(
      400,
      "invalid_parameter",
      `${key} must contain at most ${maxLength} characters.`,
      "invalid_request_error",
      key
    );
  }
  return text;
}

function optionalString(
  body: JsonObject,
  key: string,
  maxLength: number
): string | undefined {
  return body[key] === undefined ? undefined : requiredString(body, key, maxLength);
}

function credentialString(body: JsonObject, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new HttpError(
      400,
      "invalid_parameter",
      `${key} must be a non-empty string.`,
      "invalid_request_error",
      key
    );
  }
  if (Buffer.byteLength(value, "utf8") > 512) {
    throw new HttpError(
      400,
      "invalid_parameter",
      `${key} is too long.`,
      "invalid_request_error",
      key
    );
  }
  return value;
}

function optionalCredentialString(
  body: JsonObject,
  key: string
): string | undefined {
  return body[key] === undefined ? undefined : credentialString(body, key);
}

function credentialValidationHttpError(error: unknown): HttpError {
  if (error instanceof CredentialValidationError) {
    return new HttpError(
      400,
      error.code,
      error.message,
      "invalid_request_error"
    );
  }
  throw error;
}

function optionalBoolean(body: JsonObject, key: string): boolean | undefined {
  const value = body[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new HttpError(
      400,
      "invalid_parameter",
      `${key} must be a boolean.`,
      "invalid_request_error",
      key
    );
  }
  return value;
}

function requiredPositiveInteger(
  body: JsonObject,
  key: string,
  maximum: number
): number {
  if (body[key] === undefined) {
    throw new HttpError(
      400,
      "invalid_parameter",
      `${key} is required.`,
      "invalid_request_error",
      key
    );
  }
  return positiveIntegerValue(body[key], key, maximum);
}

function optionalPositiveInteger(
  body: JsonObject,
  key: string,
  maximum: number
): number | undefined {
  return body[key] === undefined
    ? undefined
    : positiveIntegerValue(body[key], key, maximum);
}

function positiveIntegerValue(value: unknown, key: string, maximum: number): number {
  if (!Number.isSafeInteger(value)
    || (value as number) <= 0
    || (value as number) > maximum) {
    throw new HttpError(
      400,
      "invalid_parameter",
      `${key} must be a positive integer no greater than ${maximum}.`,
      "invalid_request_error",
      key
    );
  }
  return value as number;
}

function finiteNumber(
  value: unknown,
  key: string,
  minimum: number,
  maximum: number
): number {
  if (typeof value !== "number"
    || !Number.isFinite(value)
    || value < minimum
    || value > maximum) {
    throw new HttpError(
      400,
      "invalid_parameter",
      `${key} must be a number between ${minimum} and ${maximum}.`,
      "invalid_request_error",
      key
    );
  }
  return value;
}

function reservationHttpError(error: ReservationError): HttpError {
  if (error.reason === "consumer_quota_exceeded"
    || error.reason === "provider_quota_exceeded"
    || error.reason === "insufficient_points") {
    return new HttpError(429, error.reason, error.message, "insufficient_quota");
  }
  if (error.reason === "consumer_concurrency_exceeded"
    || error.reason === "provider_concurrency_exceeded") {
    return new HttpError(429, error.reason, error.message, "rate_limit_error");
  }
  if (error.reason === "consumer_disabled" || error.reason === "model_not_allowed") {
    return new HttpError(403, error.reason, error.message);
  }
  return new HttpError(503, error.reason, error.message, "service_unavailable_error");
}

function providerJobError(error: unknown): ProviderJobError {
  return error instanceof ProviderJobError
    ? error
    : new ProviderJobError(
      "provider_error",
      error instanceof Error ? error.message : String(error),
      false
    );
}

function providerHttpError(error: ProviderJobError): HttpError {
  if (isTimeoutCode(error.code)) {
    return new HttpError(504, error.code, error.message, "timeout_error");
  }
  if (error.code === "provider_concurrency_exceeded") {
    return new HttpError(429, error.code, error.message, "rate_limit_error");
  }
  if (error.code === "request_cancelled") {
    return new HttpError(499, error.code, error.message, "cancelled_error");
  }
  if (error.retryable
    || error.code === "provider_offline"
    || error.code === "provider_disconnected"
    || error.code === "server_closing") {
    return new HttpError(503, error.code, error.message, "service_unavailable_error");
  }
  return new HttpError(502, error.code, error.message, "provider_error");
}

function requestStatusForProviderError(
  error: ProviderJobError
): Exclude<RequestStatus, "reserved" | "dispatched" | "completed" | "interrupted"> {
  if (isTimeoutCode(error.code)) {
    return "timed_out";
  }
  if (error.code === "request_cancelled") {
    return "cancelled";
  }
  return "failed";
}

function failureUsage(error: ProviderJobError, promptTokens: number): TokenUsage {
  const definitelyNotAccepted = new Set([
    "dispatch_failed",
    "provider_offline",
    "model_unavailable",
    "provider_concurrency_exceeded",
    "duplicate_job",
    "server_closing"
  ]);
  const wasNotAccepted = definitelyNotAccepted.has(error.code);
  return normalizeUsage(
    error.usage,
    wasNotAccepted ? 0 : promptTokens,
    0
  );
}

function accountableResultUsage(
  reported: TokenUsage,
  promptFallback: number,
  completionFallback: number,
  reservedTokens: number
): TokenUsage {
  const normalized = normalizeUsage(reported, promptFallback, completionFallback);
  const promptTokens = Math.max(normalized.promptTokens, promptFallback);
  const completionTokens = Math.max(
    normalized.completionTokens,
    completionFallback
  );
  const usage: TokenUsage = {
    promptTokens,
    completionTokens,
    totalTokens: Math.max(
      normalized.totalTokens,
      promptTokens + completionTokens
    ),
    estimated: normalized.estimated
      || promptTokens !== normalized.promptTokens
      || completionTokens !== normalized.completionTokens
  };
  const relativeLimit = Math.max(
    reservedTokens * 8,
    reservedTokens + 100_000
  );
  const maximumAccountableTokens = Math.min(10_000_000, relativeLimit);
  if (usage.promptTokens > maximumAccountableTokens
    || usage.completionTokens > maximumAccountableTokens
    || usage.totalTokens > maximumAccountableTokens) {
    throw new ProviderJobError(
      "invalid_provider_usage",
      "Provider reported usage far above the authorized reservation.",
      false,
      {
        promptTokens: promptFallback,
        completionTokens: Math.max(0, reservedTokens - promptFallback),
        totalTokens: reservedTokens,
        estimated: true
      }
    );
  }
  return usage;
}

function isTimeoutCode(code: string): boolean {
  const normalized = code.toLowerCase();
  return normalized === "request_timeout"
    || normalized === "deadline_exceeded";
}

function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) {
    return error;
  }
  if (error instanceof SyntaxError) {
    return new HttpError(400, "invalid_request", error.message);
  }
  return new HttpError(
    500,
    "internal_error",
    "Internal server error.",
    "server_error"
  );
}

function sendHttpError(response: ServerResponse, error: HttpError): void {
  if (error.status === 401) {
    response.setHeader("www-authenticate", "Bearer");
  }
  sendJson(response, error.status, {
    error: {
      message: error.message,
      type: error.type,
      param: error.param,
      code: error.code
    }
  });
}

function sendAnthropicHttpError(
  response: ServerResponse,
  error: HttpError,
  requestId: string
): void {
  if (error.status === 401) {
    response.setHeader("www-authenticate", "Bearer");
  }
  sendJson(response, error.status, {
    type: "error",
    error: {
      type: anthropicErrorType(error.status),
      message: error.message
    },
    request_id: requestId
  });
}

function anthropicErrorType(status: number):
  | "invalid_request_error"
  | "authentication_error"
  | "permission_error"
  | "not_found_error"
  | "request_too_large"
  | "rate_limit_error"
  | "api_error"
  | "overloaded_error" {
  if (status === 401) {
    return "authentication_error";
  }
  if (status === 403) {
    return "permission_error";
  }
  if (status === 404) {
    return "not_found_error";
  }
  if (status === 413) {
    return "request_too_large";
  }
  if (status === 429) {
    return "rate_limit_error";
  }
  if (status === 503) {
    return "overloaded_error";
  }
  if (status >= 500) {
    return "api_error";
  }
  return "invalid_request_error";
}

function sendAnthropicEventStream(
  response: ServerResponse,
  input: {
    id: string;
    model: string;
    content: string;
    stopReason: AnthropicMessagesResponse["stop_reason"];
    usage: TokenUsage;
  }
): void {
  const events: AnthropicMessagesStreamEvent[] = [{
    type: "message_start",
    message: {
      id: input.id,
      type: "message",
      role: "assistant",
      model: input.model,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: input.usage.promptTokens,
        output_tokens: 0
      }
    }
  }, {
    type: "content_block_start",
    index: 0,
    content_block: {
      type: "text",
      text: ""
    }
  }, {
    type: "content_block_delta",
    index: 0,
    delta: {
      type: "text_delta",
      text: input.content
    }
  }, {
    type: "content_block_stop",
    index: 0
  }, {
    type: "message_delta",
    delta: {
      stop_reason: input.stopReason,
      stop_sequence: null
    },
    usage: {
      output_tokens: input.usage.completionTokens
    }
  }, {
    type: "message_stop"
  }];
  response.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-store",
    "connection": "keep-alive",
    "x-accel-buffering": "no",
    "x-content-type-options": "nosniff"
  });
  for (const event of events) {
    response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  }
  response.end();
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  response.end(body);
}

function sendHtml(response: ServerResponse, status: number, body: string): void {
  response.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-frame-options": "DENY",
    "content-security-policy": "default-src 'none'; connect-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
  });
  response.end(body);
}

function serializeCookie(
  name: string,
  value: string,
  options: {
    maxAgeSeconds: number;
    secure: boolean;
  }
): string {
  const attributes = [
    `${name}=${value}`,
    "Path=/",
    `Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`,
    "HttpOnly",
    "SameSite=Lax"
  ];
  if (options.secure) {
    attributes.push("Secure");
  }
  return attributes.join("; ");
}

function clearCookie(name: string, secure: boolean): string {
  const attributes = [
    `${name}=`,
    "Path=/",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "HttpOnly",
    "SameSite=Lax"
  ];
  if (secure) {
    attributes.push("Secure");
  }
  return attributes.join("; ");
}

function cookieValue(
  header: string | undefined,
  name: string
): string | null {
  if (!header) {
    return null;
  }
  const values: string[] = [];
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) {
      continue;
    }
    const value = part.slice(separator + 1).trim();
    if (value) {
      values.push(value);
    }
  }
  return values.length === 1 ? values[0]! : null;
}

function publicUser(session: UserSessionRecord): {
  id: string;
  username: string | null;
  displayName: string;
  pointBalance: number;
  pointsReserved: number;
  availablePoints: number;
} {
  return {
    id: session.user.id,
    username: session.user.username,
    displayName: session.user.displayName,
    pointBalance: session.user.pointBalance,
    pointsReserved: session.user.pointsReserved,
    availablePoints: session.user.availablePoints
  };
}

function modelFamily(model: string): string {
  const normalized = model.trim().toLowerCase();
  if (normalized.includes("deepseek")) {
    return "deepseek";
  }
  if (normalized.includes("claude")) {
    return "claude";
  }
  if (normalized.includes("gemini")) {
    return "gemini";
  }
  if (normalized.includes("doubao") || normalized.startsWith("seed-")) {
    return "doubao";
  }
  if (normalized.includes("qwen") || normalized.includes("qwq")) {
    return "qwen";
  }
  if (normalized.includes("gpt")
    || normalized.includes("openai")
    || /(^|[-_.])o[134]($|[-_.])/.test(normalized)) {
    return "gpt";
  }
  return "other";
}

function compareCatalogModels(
  left: { family: string; providerName: string; id: string; providerId: string },
  right: { family: string; providerName: string; id: string; providerId: string }
): number {
  const familyOrder = MODEL_FAMILIES.map((family) => family.id);
  return familyOrder.indexOf(left.family as typeof familyOrder[number])
    - familyOrder.indexOf(right.family as typeof familyOrder[number])
    || left.id.localeCompare(right.id)
    || left.providerName.localeCompare(right.providerName, "zh-CN")
    || left.providerId.localeCompare(right.providerId);
}

function unavailableModelReason(
  provider: {
    online: boolean;
    liveModels: string[];
    availableModels: string[];
    unavailableReason: string | null;
  },
  model: string
): string | null {
  if (!provider.online) {
    return "provider_offline";
  }
  if (!provider.liveModels.includes(model)) {
    return "model_unavailable";
  }
  if (!provider.availableModels.includes(model)) {
    return provider.unavailableReason ?? "at_capacity";
  }
  return null;
}

function safePathname(url: string | undefined): string {
  try {
    return new URL(url ?? "/", "http://token-relay.invalid").pathname;
  } catch {
    return "/";
  }
}

function decodePathPart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new HttpError(400, "invalid_path", "Path parameter is malformed.");
  }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function displayHost(address: AddressInfo, configuredHost: string): string {
  if (configuredHost === "0.0.0.0") {
    return "127.0.0.1";
  }
  if (configuredHost === "::") {
    return "::1";
  }
  return address.address;
}

function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === "127.0.0.1"
    || normalized === "localhost"
    || normalized === "::1"
    || normalized === "[::1]";
}
