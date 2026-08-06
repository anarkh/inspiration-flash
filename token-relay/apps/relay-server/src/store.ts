import { randomUUID } from "node:crypto";
import { chmodSync, mkdirSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync, type StatementResultingChanges } from "node:sqlite";
import type { TokenUsage } from "@anarkhli/protocol";
import { HttpError, ReservationError } from "./errors.ts";
import {
  createSecret,
  displaySecretPrefix,
  hashSecret
} from "./secrets.ts";

export interface ProviderRecord {
  id: string;
  ownerUserId: string | null;
  name: string;
  providerTokenPrefix: string;
  enabled: boolean;
  listed: boolean;
  advertisedModels: string[];
  advertisedModelsUpdatedAt: string | null;
  tokenLimit: number;
  tokensUsed: number;
  tokensReserved: number;
  remainingTokens: number;
  overageTokens: number;
  maxConcurrent: number;
  activeRequests: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConsumerRecord {
  id: string;
  ownerUserId: string | null;
  name: string;
  apiKeyPrefix: string;
  providerId: string;
  model: string;
  enabled: boolean;
  tokenLimit: number;
  tokensUsed: number;
  tokensReserved: number;
  remainingTokens: number;
  overageTokens: number;
  maxConcurrent: number;
  activeRequests: number;
  createdAt: string;
  updatedAt: string;
}

export type RequestStatus =
  | "reserved"
  | "dispatched"
  | "completed"
  | "failed"
  | "timed_out"
  | "cancelled"
  | "interrupted";

export interface RequestRecord {
  id: string;
  consumerId: string;
  consumerName?: string;
  providerId: string;
  providerName?: string;
  model: string;
  status: RequestStatus;
  reservedTokens: number;
  promptTokensEstimated: number;
  maxOutputTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  usageEstimated: boolean;
  pointPayerUserId: string | null;
  pointPayeeUserId: string | null;
  pointsReserved: number;
  pointsCharged: number;
  pointsEarned: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  dispatchedAt: string | null;
  completedAt: string | null;
  deadlineAt: string;
  durationMs: number | null;
}

export interface ProviderCreateInput {
  name: string;
  tokenLimit: number;
  maxConcurrent: number;
  ownerUserId?: string;
  listed?: boolean;
}

export interface ConsumerCreateInput {
  name: string;
  providerId: string;
  model: string;
  tokenLimit: number;
  maxConcurrent: number;
  ownerUserId?: string;
}

export interface UserRecord {
  id: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  disabled: boolean;
  pointBalance: number;
  pointsReserved: number;
  availablePoints: number;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
}

export interface PasswordUserInput {
  username: string;
  normalizedUsername: string;
  passwordHash: string;
  displayName: string;
}

export interface PasswordUserRecord {
  user: UserRecord;
  passwordHash: string;
}

export interface UserSessionRecord {
  user: UserRecord;
  expiresAt: string;
}

interface ResourcePatch {
  name?: string;
  enabled?: boolean;
  tokenLimit?: number;
  maxConcurrent?: number;
}

export interface ProviderPatch extends ResourcePatch {
  listed?: boolean;
}

export interface ConsumerPatch extends ResourcePatch {
  providerId?: string;
  model?: string;
}

export interface ReservationInput {
  id: string;
  consumerId: string;
  providerId: string;
  model: string;
  reservedTokens: number;
  promptTokensEstimated: number;
  maxOutputTokens: number;
  createdAt: string;
  deadlineAt: string;
}

export interface Reservation {
  request: RequestRecord;
  consumer: ConsumerRecord;
  provider: ProviderRecord;
}

export interface RequestSettlement {
  status: Exclude<RequestStatus, "reserved" | "dispatched">;
  usage: TokenUsage;
  errorCode?: string;
  errorMessage?: string;
  completedAt?: string;
}

export interface StoreSummary {
  providers: number;
  providersEnabled: number;
  consumers: number;
  consumersEnabled: number;
  requests: number;
  activeRequests: number;
  completedRequests: number;
  failedRequests: number;
  tokensUsed: number;
  tokensReserved: number;
}

export interface UserUsageStats {
  consumerRequests: number;
  consumerActiveRequests: number;
  consumerTokensUsed: number;
  consumerTokensReserved: number;
  providerRequests: number;
  providerActiveRequests: number;
  providerTokensServed: number;
  providerTokensReserved: number;
  pointsSpent: number;
  pointsEarned: number;
}

export type PointLedgerKind =
  | "initial_grant"
  | "consumer_spend"
  | "provider_earn";

export interface PointLedgerRecord {
  id: string;
  userId: string;
  requestId: string | null;
  kind: PointLedgerKind;
  delta: number;
  createdAt: string;
}

export interface RelayStoreOptions {
  initialUserPoints?: number;
}

interface SqlRow {
  [key: string]: unknown;
}

const ACTIVE_STATUSES = new Set<RequestStatus>(["reserved", "dispatched"]);
const DEFAULT_INITIAL_USER_POINTS = 100_000;

function requirePrivateDataDirectory(path: string): void {
  if (process.platform === "win32") {
    return;
  }
  const stats = statSync(path);
  if (!stats.isDirectory()) {
    throw new Error(`SQLite data path is not a directory: ${path}`);
  }
  if ((stats.mode & 0o077) !== 0) {
    throw new Error(
      `SQLite data directory must be accessible only to the service account (chmod 700): ${path}`
    );
  }
}

function restrictDatabaseFile(path: string, allowMissing = false): void {
  if (process.platform === "win32") {
    return;
  }
  try {
    chmodSync(path, 0o600);
  } catch (error) {
    if (allowMissing
      && typeof error === "object"
      && error !== null
      && "code" in error
      && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

export class RelayStore {
  readonly databasePath: string;
  private readonly database: DatabaseSync;
  private readonly initialUserPoints: number;
  private closed = false;

  constructor(databasePath: string, options: RelayStoreOptions = {}) {
    this.databasePath = databasePath;
    this.initialUserPoints = nonNegativeSafeInteger(
      options.initialUserPoints ?? DEFAULT_INITIAL_USER_POINTS,
      "initialUserPoints"
    );
    const fileBacked = databasePath !== ":memory:";
    const previousUmask = fileBacked ? process.umask(0o077) : null;
    try {
      if (fileBacked) {
        const dataDirectory = dirname(databasePath);
        mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
        requirePrivateDataDirectory(dataDirectory);
      }
      this.database = new DatabaseSync(databasePath);
      if (fileBacked) {
        restrictDatabaseFile(databasePath);
      }
      this.database.exec("PRAGMA foreign_keys = ON");
      this.database.exec("PRAGMA busy_timeout = 5000");
      if (fileBacked) {
        this.database.exec("PRAGMA journal_mode = WAL");
        this.database.exec("PRAGMA synchronous = NORMAL");
      }
      this.migrate();
      this.recoverInterruptedRequests();
      if (fileBacked) {
        restrictDatabaseFile(databasePath);
        restrictDatabaseFile(`${databasePath}-wal`, true);
        restrictDatabaseFile(`${databasePath}-shm`, true);
      }
    } finally {
      if (previousUmask !== null) {
        process.umask(previousUmask);
      }
    }
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.database.close();
  }

  healthCheck(): boolean {
    const row = this.database.prepare("SELECT 1 AS ok").get() as SqlRow | undefined;
    return row?.ok === 1;
  }

  createProvider(input: ProviderCreateInput): {
    provider: ProviderRecord;
    providerToken: string;
  } {
    if (input.ownerUserId) {
      this.requireUser(input.ownerUserId);
    }
    const id = entityId("provider");
    const providerToken = createSecret("provider");
    const now = new Date().toISOString();
    this.database.prepare(`
      INSERT INTO providers (
        id, owner_user_id, name, provider_token_hash, provider_token_prefix,
        enabled, listed, advertised_models, advertised_models_updated_at,
        token_limit, tokens_used, tokens_reserved, max_concurrent,
        active_requests, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, ?, '[]', NULL, ?, 0, 0, ?, 0, ?, ?)
    `).run(
      id,
      input.ownerUserId ?? null,
      input.name,
      hashSecret(providerToken),
      displaySecretPrefix(providerToken),
      input.listed ? 1 : 0,
      input.tokenLimit,
      input.maxConcurrent,
      now,
      now
    );
    return {
      provider: this.requireProvider(id),
      providerToken
    };
  }

  createConsumer(input: ConsumerCreateInput): {
    consumer: ConsumerRecord;
    apiKey: string;
  } {
    this.requireProvider(input.providerId);
    if (input.ownerUserId) {
      this.requireUser(input.ownerUserId);
    }
    const id = entityId("consumer");
    const apiKey = createSecret("consumer");
    const now = new Date().toISOString();
    this.database.prepare(`
      INSERT INTO consumers (
        id, owner_user_id, name, api_key_hash, api_key_prefix, provider_id, model, enabled,
        token_limit, tokens_used, tokens_reserved, max_concurrent,
        active_requests, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 0, 0, ?, 0, ?, ?)
    `).run(
      id,
      input.ownerUserId ?? null,
      input.name,
      hashSecret(apiKey),
      displaySecretPrefix(apiKey),
      input.providerId,
      input.model,
      input.tokenLimit,
      input.maxConcurrent,
      now,
      now
    );
    return {
      consumer: this.requireConsumer(id),
      apiKey
    };
  }

  createPasswordUser(input: PasswordUserInput): UserRecord {
    return this.transaction(() => {
      const existing = this.database.prepare(`
        SELECT 1
        FROM password_identities
        WHERE username_normalized = ?
      `).get(input.normalizedUsername);
      if (existing) {
        throw new HttpError(
          409,
          "username_unavailable",
          "Username is unavailable.",
          "authentication_error"
        );
      }
      const userId = entityId("user");
      const now = new Date().toISOString();
      this.database.prepare(`
        INSERT INTO users (
          id, display_name, avatar_url, disabled, point_balance, points_reserved,
          created_at, updated_at, last_login_at
        ) VALUES (?, ?, NULL, 0, ?, 0, ?, ?, ?)
      `).run(
        userId,
        input.displayName,
        this.initialUserPoints,
        now,
        now,
        now
      );
      this.database.prepare(`
        INSERT INTO password_identities (
          user_id, username, username_normalized, password_hash,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        input.username,
        input.normalizedUsername,
        input.passwordHash,
        now,
        now
      );
      if (this.initialUserPoints > 0) {
        this.insertPointLedgerEntry(
          userId,
          null,
          "initial_grant",
          this.initialUserPoints,
          now
        );
      }
      return this.requireUser(userId);
    });
  }

  findPasswordUser(normalizedUsername: string): PasswordUserRecord | null {
    const row = this.database.prepare(`
      SELECT
        users.*,
        password_identities.username_normalized AS username,
        password_identities.password_hash AS password_hash
      FROM password_identities
      JOIN users ON users.id = password_identities.user_id
      WHERE password_identities.username_normalized = ?
    `).get(normalizedUsername) as SqlRow | undefined;
    return row
      ? {
          user: userFromRow(row),
          passwordHash: stringColumn(row, "password_hash")
        }
      : null;
  }

  recordUserLogin(userId: string): UserRecord {
    const now = new Date().toISOString();
    this.database.prepare(`
      UPDATE users
      SET last_login_at = ?, updated_at = ?
      WHERE id = ?
    `).run(now, now, userId);
    return this.requireUser(userId);
  }

  createUserSession(
    userId: string,
    sessionToken: string,
    expiresAt: string
  ): UserSessionRecord {
    const user = this.requireUser(userId);
    const now = new Date().toISOString();
    this.transaction(() => {
      this.database.prepare(
        "DELETE FROM user_sessions WHERE expires_at <= ?"
      ).run(now);
      this.database.prepare(`
        DELETE FROM user_sessions
        WHERE user_id = ?
          AND id NOT IN (
            SELECT id
            FROM user_sessions
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 9
          )
      `).run(userId, userId);
      this.database.prepare(`
        INSERT INTO user_sessions (
          id, user_id, token_hash, created_at, last_seen_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        entityId("session"),
        userId,
        hashSecret(sessionToken),
        now,
        now,
        expiresAt
      );
    });
    return { user, expiresAt };
  }

  authenticateUserSession(sessionToken: string): UserSessionRecord | null {
    const row = this.database.prepare(`
      SELECT
        user_sessions.expires_at AS session_expires_at,
        users.id AS user_id,
        password_identities.username_normalized AS user_username,
        users.display_name AS user_display_name,
        users.avatar_url AS user_avatar_url,
        users.disabled AS user_disabled,
        users.point_balance AS user_point_balance,
        users.points_reserved AS user_points_reserved,
        users.created_at AS user_created_at,
        users.updated_at AS user_updated_at,
        users.last_login_at AS user_last_login_at
      FROM user_sessions
      JOIN users ON users.id = user_sessions.user_id
      JOIN password_identities
        ON password_identities.user_id = users.id
      WHERE user_sessions.token_hash = ?
    `).get(hashSecret(sessionToken)) as SqlRow | undefined;
    if (!row) {
      return null;
    }
    const expiresAt = stringColumn(row, "session_expires_at");
    if (Date.parse(expiresAt) <= Date.now()) {
      this.revokeUserSession(sessionToken);
      return null;
    }
    if (booleanColumn(row, "user_disabled")) {
      return null;
    }
    this.database.prepare(`
      UPDATE user_sessions
      SET last_seen_at = ?
      WHERE token_hash = ?
    `).run(new Date().toISOString(), hashSecret(sessionToken));
    return {
      user: userFromAliasedRow(row),
      expiresAt
    };
  }

  revokeUserSession(sessionToken: string): void {
    this.database.prepare(
      "DELETE FROM user_sessions WHERE token_hash = ?"
    ).run(hashSecret(sessionToken));
  }

  getOwnedProvider(id: string, userId: string): ProviderRecord | null {
    const row = this.database.prepare(`
      SELECT *
      FROM providers
      WHERE id = ? AND owner_user_id = ?
    `).get(id, userId) as SqlRow | undefined;
    return row ? providerFromRow(row) : null;
  }

  getOwnedConsumer(id: string, userId: string): ConsumerRecord | null {
    const row = this.database.prepare(`
      SELECT *
      FROM consumers
      WHERE id = ? AND owner_user_id = ?
    `).get(id, userId) as SqlRow | undefined;
    return row ? consumerFromRow(row) : null;
  }

  listProvidersForUser(userId: string): ProviderRecord[] {
    return (this.database.prepare(`
      SELECT *
      FROM providers
      WHERE owner_user_id = ?
      ORDER BY created_at DESC
    `).all(userId) as SqlRow[]).map(providerFromRow);
  }

  getSelectableProviderForUser(
    id: string,
    userId: string
  ): ProviderRecord | null {
    const row = this.database.prepare(`
      SELECT *
      FROM providers
      WHERE id = ?
        AND enabled = 1
        AND owner_user_id IS NOT NULL
        AND (owner_user_id = ? OR listed = 1)
    `).get(id, userId) as SqlRow | undefined;
    return row ? providerFromRow(row) : null;
  }

  listProviderCatalogForUser(userId: string): ProviderRecord[] {
    return (this.database.prepare(`
      SELECT *
      FROM providers
      WHERE enabled = 1
        AND owner_user_id IS NOT NULL
        AND (owner_user_id = ? OR listed = 1)
      ORDER BY
        CASE WHEN owner_user_id = ? THEN 0 ELSE 1 END,
        created_at DESC
    `).all(userId, userId) as SqlRow[]).map(providerFromRow);
  }

  updateProviderAdvertisement(
    id: string,
    models: readonly string[],
    advertisedAt = new Date().toISOString()
  ): ProviderRecord {
    const result = this.database.prepare(`
      UPDATE providers
      SET advertised_models = ?,
          advertised_models_updated_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify(normalizedAdvertisedModels(models)),
      advertisedAt,
      id
    );
    if (changes(result) !== 1) {
      throw new HttpError(404, "provider_not_found", "Provider not found.");
    }
    return this.requireProvider(id);
  }

  listConsumersForUser(
    userId: string
  ): Array<ConsumerRecord & { providerName: string }> {
    return (this.database.prepare(`
      SELECT consumers.*, providers.name AS provider_name
      FROM consumers
      JOIN providers ON providers.id = consumers.provider_id
      WHERE consumers.owner_user_id = ?
      ORDER BY consumers.created_at DESC
    `).all(userId) as SqlRow[]).map((row) => ({
      ...consumerFromRow(row),
      providerName: stringColumn(row, "provider_name")
    }));
  }

  listRequestsForUser(userId: string, limit = 100): RequestRecord[] {
    return (this.database.prepare(`
      SELECT
        requests.*,
        consumers.name AS consumer_name,
        providers.name AS provider_name
      FROM requests
      JOIN consumers ON consumers.id = requests.consumer_id
      JOIN providers ON providers.id = requests.provider_id
      WHERE consumers.owner_user_id = ?
      ORDER BY requests.created_at DESC
      LIMIT ?
    `).all(userId, limit) as SqlRow[]).map(requestFromRow);
  }

  listProviderRequestsForUser(
    userId: string,
    limit = 100
  ): RequestRecord[] {
    return (this.database.prepare(`
      SELECT
        requests.*,
        consumers.name AS consumer_name,
        providers.name AS provider_name
      FROM requests
      JOIN consumers ON consumers.id = requests.consumer_id
      JOIN providers ON providers.id = requests.provider_id
      WHERE providers.owner_user_id = ?
      ORDER BY requests.created_at DESC
      LIMIT ?
    `).all(userId, limit) as SqlRow[]).map(requestFromRow);
  }

  usageStatsForUser(userId: string): UserUsageStats {
    const row = this.database.prepare(`
      SELECT
        (
          SELECT COUNT(*)
          FROM requests
          JOIN consumers ON consumers.id = requests.consumer_id
          WHERE consumers.owner_user_id = ?
        ) AS consumer_requests,
        (
          SELECT COUNT(*)
          FROM requests
          JOIN consumers ON consumers.id = requests.consumer_id
          WHERE consumers.owner_user_id = ?
            AND requests.status IN ('reserved', 'dispatched')
        ) AS consumer_active_requests,
        (
          SELECT COALESCE(SUM(requests.total_tokens), 0)
          FROM requests
          JOIN consumers ON consumers.id = requests.consumer_id
          WHERE consumers.owner_user_id = ?
        ) AS consumer_tokens_used,
        (
          SELECT COALESCE(SUM(requests.reserved_tokens), 0)
          FROM requests
          JOIN consumers ON consumers.id = requests.consumer_id
          WHERE consumers.owner_user_id = ?
            AND requests.status IN ('reserved', 'dispatched')
        ) AS consumer_tokens_reserved,
        (
          SELECT COUNT(*)
          FROM requests
          JOIN providers ON providers.id = requests.provider_id
          WHERE providers.owner_user_id = ?
        ) AS provider_requests,
        (
          SELECT COUNT(*)
          FROM requests
          JOIN providers ON providers.id = requests.provider_id
          WHERE providers.owner_user_id = ?
            AND requests.status IN ('reserved', 'dispatched')
        ) AS provider_active_requests,
        (
          SELECT COALESCE(SUM(requests.total_tokens), 0)
          FROM requests
          JOIN providers ON providers.id = requests.provider_id
          WHERE providers.owner_user_id = ?
        ) AS provider_tokens_served,
        (
          SELECT COALESCE(SUM(requests.reserved_tokens), 0)
          FROM requests
          JOIN providers ON providers.id = requests.provider_id
          WHERE providers.owner_user_id = ?
            AND requests.status IN ('reserved', 'dispatched')
        ) AS provider_tokens_reserved,
        (
          SELECT COALESCE(-SUM(delta), 0)
          FROM point_ledger
          WHERE user_id = ? AND kind = 'consumer_spend'
        ) AS points_spent,
        (
          SELECT COALESCE(SUM(delta), 0)
          FROM point_ledger
          WHERE user_id = ? AND kind = 'provider_earn'
        ) AS points_earned
    `).get(
      userId,
      userId,
      userId,
      userId,
      userId,
      userId,
      userId,
      userId,
      userId,
      userId
    ) as SqlRow;
    return {
      consumerRequests: integerColumn(row, "consumer_requests"),
      consumerActiveRequests: integerColumn(row, "consumer_active_requests"),
      consumerTokensUsed: integerColumn(row, "consumer_tokens_used"),
      consumerTokensReserved: integerColumn(row, "consumer_tokens_reserved"),
      providerRequests: integerColumn(row, "provider_requests"),
      providerActiveRequests: integerColumn(row, "provider_active_requests"),
      providerTokensServed: integerColumn(row, "provider_tokens_served"),
      providerTokensReserved: integerColumn(row, "provider_tokens_reserved"),
      pointsSpent: integerColumn(row, "points_spent"),
      pointsEarned: integerColumn(row, "points_earned")
    };
  }

  listPointLedgerForUser(
    userId: string,
    limit = 100
  ): PointLedgerRecord[] {
    return (this.database.prepare(`
      SELECT *
      FROM point_ledger
      WHERE user_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `).all(userId, limit) as SqlRow[]).map(pointLedgerFromRow);
  }

  rotateProviderToken(id: string): {
    provider: ProviderRecord;
    providerToken: string;
  } {
    this.requireProvider(id);
    const providerToken = createSecret("provider");
    const now = new Date().toISOString();
    this.database.prepare(`
      UPDATE providers
      SET provider_token_hash = ?, provider_token_prefix = ?, updated_at = ?
      WHERE id = ?
    `).run(
      hashSecret(providerToken),
      displaySecretPrefix(providerToken),
      now,
      id
    );
    return { provider: this.requireProvider(id), providerToken };
  }

  rotateConsumerKey(id: string): {
    consumer: ConsumerRecord;
    apiKey: string;
  } {
    this.requireConsumer(id);
    const apiKey = createSecret("consumer");
    const now = new Date().toISOString();
    this.database.prepare(`
      UPDATE consumers
      SET api_key_hash = ?, api_key_prefix = ?, updated_at = ?
      WHERE id = ?
    `).run(hashSecret(apiKey), displaySecretPrefix(apiKey), now, id);
    return { consumer: this.requireConsumer(id), apiKey };
  }

  authenticateProvider(providerToken: string): ProviderRecord | null {
    const row = this.database.prepare(`
      SELECT * FROM providers WHERE provider_token_hash = ?
    `).get(hashSecret(providerToken)) as SqlRow | undefined;
    return row ? providerFromRow(row) : null;
  }

  authenticateConsumer(apiKey: string): ConsumerRecord | null {
    const row = this.database.prepare(`
      SELECT * FROM consumers WHERE api_key_hash = ?
    `).get(hashSecret(apiKey)) as SqlRow | undefined;
    return row ? consumerFromRow(row) : null;
  }

  getProvider(id: string): ProviderRecord | null {
    const row = this.database.prepare(
      "SELECT * FROM providers WHERE id = ?"
    ).get(id) as SqlRow | undefined;
    return row ? providerFromRow(row) : null;
  }

  getConsumer(id: string): ConsumerRecord | null {
    const row = this.database.prepare(
      "SELECT * FROM consumers WHERE id = ?"
    ).get(id) as SqlRow | undefined;
    return row ? consumerFromRow(row) : null;
  }

  getUser(id: string): UserRecord | null {
    const row = this.database.prepare(`
      SELECT
        users.*,
        password_identities.username_normalized AS username
      FROM users
      LEFT JOIN password_identities
        ON password_identities.user_id = users.id
      WHERE users.id = ?
    `).get(id) as SqlRow | undefined;
    return row ? userFromRow(row) : null;
  }

  listProviders(): ProviderRecord[] {
    return (this.database.prepare(`
      SELECT * FROM providers ORDER BY created_at DESC
    `).all() as SqlRow[]).map(providerFromRow);
  }

  listConsumers(): Array<ConsumerRecord & { providerName: string }> {
    return (this.database.prepare(`
      SELECT consumers.*, providers.name AS provider_name
      FROM consumers
      JOIN providers ON providers.id = consumers.provider_id
      ORDER BY consumers.created_at DESC
    `).all() as SqlRow[]).map((row) => ({
      ...consumerFromRow(row),
      providerName: stringColumn(row, "provider_name")
    }));
  }

  listRequests(limit = 100): RequestRecord[] {
    return (this.database.prepare(`
      SELECT
        requests.*,
        consumers.name AS consumer_name,
        providers.name AS provider_name
      FROM requests
      JOIN consumers ON consumers.id = requests.consumer_id
      JOIN providers ON providers.id = requests.provider_id
      ORDER BY requests.created_at DESC
      LIMIT ?
    `).all(limit) as SqlRow[]).map(requestFromRow);
  }

  summary(): StoreSummary {
    const row = this.database.prepare(`
      SELECT
        (SELECT COUNT(*) FROM providers) AS providers,
        (SELECT COUNT(*) FROM providers WHERE enabled = 1) AS providers_enabled,
        (SELECT COUNT(*) FROM consumers) AS consumers,
        (SELECT COUNT(*) FROM consumers WHERE enabled = 1) AS consumers_enabled,
        (SELECT COUNT(*) FROM requests) AS requests,
        (SELECT COUNT(*) FROM requests WHERE status IN ('reserved', 'dispatched')) AS active_requests,
        (SELECT COUNT(*) FROM requests WHERE status = 'completed') AS completed_requests,
        (SELECT COUNT(*) FROM requests WHERE status IN ('failed', 'timed_out', 'cancelled', 'interrupted')) AS failed_requests,
        (SELECT COALESCE(SUM(total_tokens), 0) FROM requests) AS tokens_used,
        (SELECT COALESCE(SUM(reserved_tokens), 0) FROM requests WHERE status IN ('reserved', 'dispatched')) AS tokens_reserved
    `).get() as SqlRow;
    return {
      providers: integerColumn(row, "providers"),
      providersEnabled: integerColumn(row, "providers_enabled"),
      consumers: integerColumn(row, "consumers"),
      consumersEnabled: integerColumn(row, "consumers_enabled"),
      requests: integerColumn(row, "requests"),
      activeRequests: integerColumn(row, "active_requests"),
      completedRequests: integerColumn(row, "completed_requests"),
      failedRequests: integerColumn(row, "failed_requests"),
      tokensUsed: integerColumn(row, "tokens_used"),
      tokensReserved: integerColumn(row, "tokens_reserved")
    };
  }

  patchProvider(id: string, patch: ProviderPatch): ProviderRecord {
    const current = this.requireProvider(id);
    if (patch.tokenLimit !== undefined
      && patch.tokenLimit < current.tokensUsed + current.tokensReserved) {
      throw new HttpError(
        409,
        "token_limit_below_usage",
        "tokenLimit cannot be lower than tokens already used or reserved."
      );
    }
    if (patch.maxConcurrent !== undefined
      && patch.maxConcurrent < current.activeRequests) {
      throw new HttpError(
        409,
        "concurrency_below_active",
        "maxConcurrent cannot be lower than active requests."
      );
    }
    const updates: string[] = [];
    const values: Array<string | number> = [];
    addPatch(updates, values, "name", patch.name);
    addPatch(updates, values, "enabled", booleanSqlValue(patch.enabled));
    addPatch(updates, values, "listed", booleanSqlValue(patch.listed));
    addPatch(updates, values, "token_limit", patch.tokenLimit);
    addPatch(updates, values, "max_concurrent", patch.maxConcurrent);
    if (updates.length === 0) {
      return current;
    }
    updates.push("updated_at = ?");
    values.push(new Date().toISOString(), id);
    this.database.prepare(
      `UPDATE providers SET ${updates.join(", ")} WHERE id = ?`
    ).run(...values);
    return this.requireProvider(id);
  }

  patchConsumer(id: string, patch: ConsumerPatch): ConsumerRecord {
    const current = this.requireConsumer(id);
    if (patch.tokenLimit !== undefined
      && patch.tokenLimit < current.tokensUsed + current.tokensReserved) {
      throw new HttpError(
        409,
        "token_limit_below_usage",
        "tokenLimit cannot be lower than tokens already used or reserved."
      );
    }
    if (patch.maxConcurrent !== undefined
      && patch.maxConcurrent < current.activeRequests) {
      throw new HttpError(
        409,
        "concurrency_below_active",
        "maxConcurrent cannot be lower than active requests."
      );
    }
    if ((patch.providerId !== undefined || patch.model !== undefined)
      && current.activeRequests > 0) {
      throw new HttpError(
        409,
        "route_change_while_active",
        "The provider or model cannot change while requests are active."
      );
    }
    if (patch.providerId !== undefined) {
      this.requireProvider(patch.providerId);
    }
    const updates: string[] = [];
    const values: Array<string | number> = [];
    addPatch(updates, values, "name", patch.name);
    addPatch(updates, values, "enabled", booleanSqlValue(patch.enabled));
    addPatch(updates, values, "token_limit", patch.tokenLimit);
    addPatch(updates, values, "max_concurrent", patch.maxConcurrent);
    addPatch(updates, values, "provider_id", patch.providerId);
    addPatch(updates, values, "model", patch.model);
    if (updates.length === 0) {
      return current;
    }
    updates.push("updated_at = ?");
    values.push(new Date().toISOString(), id);
    this.database.prepare(
      `UPDATE consumers SET ${updates.join(", ")} WHERE id = ?`
    ).run(...values);
    return this.requireConsumer(id);
  }

  reserveRequest(input: ReservationInput): Reservation {
    return this.transaction(() => {
      const consumer = this.getConsumer(input.consumerId);
      if (!consumer) {
        throw new ReservationError("consumer_not_found", "Consumer not found.");
      }
      if (!consumer.enabled) {
        throw new ReservationError("consumer_disabled", "Consumer is disabled.");
      }
      if (consumer.providerId !== input.providerId || consumer.model !== input.model) {
        throw new ReservationError(
          "model_not_allowed",
          "This API key is not configured for the requested provider and model."
        );
      }
      const provider = this.getProvider(input.providerId);
      if (!provider) {
        throw new ReservationError("provider_not_found", "Provider not found.");
      }
      if (!provider.enabled) {
        throw new ReservationError("provider_disabled", "Provider is disabled.");
      }
      if (consumer.tokensUsed + consumer.tokensReserved + input.reservedTokens
        > consumer.tokenLimit) {
        throw new ReservationError(
          "consumer_quota_exceeded",
          "Consumer token quota is exhausted."
        );
      }
      if (provider.tokensUsed + provider.tokensReserved + input.reservedTokens
        > provider.tokenLimit) {
        throw new ReservationError(
          "provider_quota_exceeded",
          "Provider token quota is exhausted."
        );
      }
      if (consumer.activeRequests >= consumer.maxConcurrent) {
        throw new ReservationError(
          "consumer_concurrency_exceeded",
          "Consumer concurrent request limit is reached."
        );
      }
      if (provider.activeRequests >= provider.maxConcurrent) {
        throw new ReservationError(
          "provider_concurrency_exceeded",
          "Provider concurrent request limit is reached."
        );
      }

      const pointPayerUserId = consumer.ownerUserId;
      const pointPayeeUserId = provider.ownerUserId;
      const pointMetered = pointPayerUserId !== null && pointPayeeUserId !== null;
      let pointsReserved = 0;
      if (pointMetered && pointPayerUserId !== pointPayeeUserId) {
        const payer = this.requireUser(pointPayerUserId);
        if (payer.pointBalance < 0) {
          throw new ReservationError(
            "insufficient_points",
            "The user point balance is negative."
          );
        }
        const hold = this.database.prepare(`
          UPDATE users
          SET points_reserved = points_reserved + ?,
              updated_at = ?
          WHERE id = ?
            AND point_balance - points_reserved >= ?
        `).run(
          input.reservedTokens,
          input.createdAt,
          pointPayerUserId,
          input.reservedTokens
        );
        if (changes(hold) !== 1) {
          throw new ReservationError(
            "insufficient_points",
            "The user does not have enough available points."
          );
        }
        pointsReserved = input.reservedTokens;
      }

      this.database.prepare(`
        UPDATE consumers
        SET tokens_reserved = tokens_reserved + ?,
            active_requests = active_requests + 1,
            updated_at = ?
        WHERE id = ?
      `).run(input.reservedTokens, input.createdAt, consumer.id);
      this.database.prepare(`
        UPDATE providers
        SET tokens_reserved = tokens_reserved + ?,
            active_requests = active_requests + 1,
            updated_at = ?
        WHERE id = ?
      `).run(input.reservedTokens, input.createdAt, provider.id);
      this.database.prepare(`
        INSERT INTO requests (
          id, consumer_id, provider_id, model, status, reserved_tokens,
          prompt_tokens_estimated, max_output_tokens, prompt_tokens,
          completion_tokens, total_tokens, usage_estimated,
          point_payer_user_id, point_payee_user_id, points_reserved,
          points_charged, points_earned, error_code,
          error_message, created_at, dispatched_at, completed_at, deadline_at
        ) VALUES (
          ?, ?, ?, ?, 'reserved', ?, ?, ?, 0, 0, 0, 1,
          ?, ?, ?, 0, 0, NULL, NULL, ?, NULL, NULL, ?
        )
      `).run(
        input.id,
        consumer.id,
        provider.id,
        input.model,
        input.reservedTokens,
        input.promptTokensEstimated,
        input.maxOutputTokens,
        pointPayerUserId,
        pointPayeeUserId,
        pointsReserved,
        input.createdAt,
        input.deadlineAt
      );

      return {
        request: this.requireRequest(input.id),
        consumer: this.requireConsumer(consumer.id),
        provider: this.requireProvider(provider.id)
      };
    });
  }

  markRequestDispatched(id: string, dispatchedAt = new Date().toISOString()): void {
    const result = this.database.prepare(`
      UPDATE requests
      SET status = 'dispatched', dispatched_at = ?
      WHERE id = ? AND status = 'reserved'
    `).run(dispatchedAt, id);
    if (changes(result) !== 1) {
      throw new Error(`Request ${id} is not reservable for dispatch.`);
    }
  }

  settleRequest(id: string, settlement: RequestSettlement): boolean {
    return this.transaction(() => {
      const row = this.database.prepare(
        "SELECT * FROM requests WHERE id = ?"
      ).get(id) as SqlRow | undefined;
      if (!row) {
        return false;
      }
      const request = requestFromRow(row);
      if (!ACTIVE_STATUSES.has(request.status)) {
        return false;
      }
      const completedAt = settlement.completedAt ?? new Date().toISOString();
      const usage = settlement.usage;
      const pointMetered = request.pointPayerUserId !== null
        && request.pointPayeeUserId !== null;
      const pointsCharged = pointMetered ? usage.totalTokens : 0;
      const pointsEarned = pointMetered ? usage.totalTokens : 0;

      this.database.prepare(`
        UPDATE consumers
        SET tokens_reserved = MAX(0, tokens_reserved - ?),
            tokens_used = tokens_used + ?,
            active_requests = MAX(0, active_requests - 1),
            updated_at = ?
        WHERE id = ?
      `).run(
        request.reservedTokens,
        usage.totalTokens,
        completedAt,
        request.consumerId
      );
      this.database.prepare(`
        UPDATE providers
        SET tokens_reserved = MAX(0, tokens_reserved - ?),
            tokens_used = tokens_used + ?,
            active_requests = MAX(0, active_requests - 1),
            updated_at = ?
        WHERE id = ?
      `).run(
        request.reservedTokens,
        usage.totalTokens,
        completedAt,
        request.providerId
      );
      if (pointMetered) {
        const pointPayerUserId = request.pointPayerUserId!;
        const pointPayeeUserId = request.pointPayeeUserId!;
        if (request.pointsReserved > 0) {
          const released = this.database.prepare(`
            UPDATE users
            SET points_reserved = points_reserved - ?,
                updated_at = ?
            WHERE id = ? AND points_reserved >= ?
          `).run(
            request.pointsReserved,
            completedAt,
            pointPayerUserId,
            request.pointsReserved
          );
          if (changes(released) !== 1) {
            throw new Error(
              `Point reservation invariant failed for request ${request.id}.`
            );
          }
        }
        if (usage.totalTokens === 0) {
          // Releasing the hold is sufficient when no accountable usage settled.
        } else if (pointPayerUserId === pointPayeeUserId) {
          this.insertPointLedgerEntry(
            pointPayerUserId,
            request.id,
            "consumer_spend",
            -usage.totalTokens,
            completedAt
          );
          this.insertPointLedgerEntry(
            pointPayeeUserId,
            request.id,
            "provider_earn",
            usage.totalTokens,
            completedAt
          );
        } else {
          const charged = this.database.prepare(`
            UPDATE users
            SET point_balance = point_balance - ?,
                updated_at = ?
            WHERE id = ?
          `).run(usage.totalTokens, completedAt, pointPayerUserId);
          const earned = this.database.prepare(`
            UPDATE users
            SET point_balance = point_balance + ?,
                updated_at = ?
            WHERE id = ?
          `).run(usage.totalTokens, completedAt, pointPayeeUserId);
          if (changes(charged) !== 1 || changes(earned) !== 1) {
            throw new Error(
              `Point account invariant failed for request ${request.id}.`
            );
          }
          this.insertPointLedgerEntry(
            pointPayerUserId,
            request.id,
            "consumer_spend",
            -usage.totalTokens,
            completedAt
          );
          this.insertPointLedgerEntry(
            pointPayeeUserId,
            request.id,
            "provider_earn",
            usage.totalTokens,
            completedAt
          );
        }
      }
      const settled = this.database.prepare(`
        UPDATE requests
        SET status = ?,
            prompt_tokens = ?,
            completion_tokens = ?,
            total_tokens = ?,
            usage_estimated = ?,
            points_charged = ?,
            points_earned = ?,
            error_code = ?,
            error_message = ?,
            completed_at = ?
        WHERE id = ? AND status IN ('reserved', 'dispatched')
      `).run(
        settlement.status,
        usage.promptTokens,
        usage.completionTokens,
        usage.totalTokens,
        usage.estimated ? 1 : 0,
        pointsCharged,
        pointsEarned,
        settlement.errorCode ?? null,
        settlement.errorMessage ?? null,
        completedAt,
        id
      );
      if (changes(settled) !== 1) {
        throw new Error(`Request ${id} changed while it was being settled.`);
      }
      return true;
    });
  }

  private insertPointLedgerEntry(
    userId: string,
    requestId: string | null,
    kind: PointLedgerKind,
    delta: number,
    createdAt: string
  ): void {
    nonNegativeSafeInteger(Math.abs(delta), "point ledger delta");
    this.database.prepare(`
      INSERT INTO point_ledger (
        id, user_id, request_id, kind, delta, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      entityId("point_entry"),
      userId,
      requestId,
      kind,
      delta,
      createdAt
    );
  }

  private requireProvider(id: string): ProviderRecord {
    const provider = this.getProvider(id);
    if (!provider) {
      throw new HttpError(404, "provider_not_found", "Provider not found.");
    }
    return provider;
  }

  private requireConsumer(id: string): ConsumerRecord {
    const consumer = this.getConsumer(id);
    if (!consumer) {
      throw new HttpError(404, "consumer_not_found", "Consumer not found.");
    }
    return consumer;
  }

  private requireUser(id: string): UserRecord {
    const user = this.getUser(id);
    if (!user) {
      throw new HttpError(404, "user_not_found", "User not found.");
    }
    return user;
  }

  private requireRequest(id: string): RequestRecord {
    const row = this.database.prepare(
      "SELECT * FROM requests WHERE id = ?"
    ).get(id) as SqlRow | undefined;
    if (!row) {
      throw new Error(`Request ${id} was not persisted.`);
    }
    return requestFromRow(row);
  }

  private transaction<T>(operation: () => T): T {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  private migrate(): void {
    this.transaction(() => {
      this.database.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        avatar_url TEXT,
        disabled INTEGER NOT NULL DEFAULT 0 CHECK (disabled IN (0, 1)),
        point_balance INTEGER NOT NULL DEFAULT 0,
        points_reserved INTEGER NOT NULL DEFAULT 0 CHECK (points_reserved >= 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_login_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS password_identities (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        username TEXT NOT NULL,
        username_normalized TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS providers (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
        name TEXT NOT NULL,
        provider_token_hash TEXT NOT NULL UNIQUE,
        provider_token_prefix TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
        listed INTEGER NOT NULL DEFAULT 0 CHECK (listed IN (0, 1)),
        advertised_models TEXT NOT NULL DEFAULT '[]',
        advertised_models_updated_at TEXT,
        token_limit INTEGER NOT NULL CHECK (token_limit > 0),
        tokens_used INTEGER NOT NULL DEFAULT 0 CHECK (tokens_used >= 0),
        tokens_reserved INTEGER NOT NULL DEFAULT 0 CHECK (tokens_reserved >= 0),
        max_concurrent INTEGER NOT NULL DEFAULT 1 CHECK (max_concurrent > 0),
        active_requests INTEGER NOT NULL DEFAULT 0 CHECK (active_requests >= 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS consumers (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
        name TEXT NOT NULL,
        api_key_hash TEXT NOT NULL UNIQUE,
        api_key_prefix TEXT NOT NULL,
        provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,
        model TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
        token_limit INTEGER NOT NULL CHECK (token_limit > 0),
        tokens_used INTEGER NOT NULL DEFAULT 0 CHECK (tokens_used >= 0),
        tokens_reserved INTEGER NOT NULL DEFAULT 0 CHECK (tokens_reserved >= 0),
        max_concurrent INTEGER NOT NULL DEFAULT 1 CHECK (max_concurrent > 0),
        active_requests INTEGER NOT NULL DEFAULT 0 CHECK (active_requests >= 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS requests (
        id TEXT PRIMARY KEY,
        consumer_id TEXT NOT NULL REFERENCES consumers(id) ON DELETE RESTRICT,
        provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,
        model TEXT NOT NULL,
        status TEXT NOT NULL CHECK (
          status IN (
            'reserved', 'dispatched', 'completed', 'failed',
            'timed_out', 'cancelled', 'interrupted'
          )
        ),
        reserved_tokens INTEGER NOT NULL CHECK (reserved_tokens > 0),
        prompt_tokens_estimated INTEGER NOT NULL CHECK (prompt_tokens_estimated >= 0),
        max_output_tokens INTEGER NOT NULL CHECK (max_output_tokens > 0),
        prompt_tokens INTEGER NOT NULL DEFAULT 0 CHECK (prompt_tokens >= 0),
        completion_tokens INTEGER NOT NULL DEFAULT 0 CHECK (completion_tokens >= 0),
        total_tokens INTEGER NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
        usage_estimated INTEGER NOT NULL DEFAULT 1 CHECK (usage_estimated IN (0, 1)),
        point_payer_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
        point_payee_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
        points_reserved INTEGER NOT NULL DEFAULT 0 CHECK (points_reserved >= 0),
        points_charged INTEGER NOT NULL DEFAULT 0 CHECK (points_charged >= 0),
        points_earned INTEGER NOT NULL DEFAULT 0 CHECK (points_earned >= 0),
        error_code TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        dispatched_at TEXT,
        completed_at TEXT,
        deadline_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS point_ledger (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        request_id TEXT REFERENCES requests(id) ON DELETE RESTRICT,
        kind TEXT NOT NULL CHECK (
          kind IN ('initial_grant', 'consumer_spend', 'provider_earn')
        ),
        delta INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS consumers_provider_idx
      ON consumers(provider_id);
      CREATE INDEX IF NOT EXISTS requests_consumer_created_idx
      ON requests(consumer_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS requests_provider_status_idx
      ON requests(provider_id, status);
    `);
      this.addColumnIfMissing(
        "providers",
        "owner_user_id",
        "TEXT REFERENCES users(id) ON DELETE RESTRICT"
      );
      this.addColumnIfMissing(
        "consumers",
        "owner_user_id",
        "TEXT REFERENCES users(id) ON DELETE RESTRICT"
      );
      const pointBalanceAdded = this.addColumnIfMissing(
        "users",
        "point_balance",
        "INTEGER NOT NULL DEFAULT 0"
      );
      this.addColumnIfMissing(
        "users",
        "points_reserved",
        "INTEGER NOT NULL DEFAULT 0 CHECK (points_reserved >= 0)"
      );
      this.addColumnIfMissing(
        "providers",
        "listed",
        "INTEGER NOT NULL DEFAULT 0 CHECK (listed IN (0, 1))"
      );
      this.addColumnIfMissing(
        "providers",
        "advertised_models",
        "TEXT NOT NULL DEFAULT '[]'"
      );
      this.addColumnIfMissing(
        "providers",
        "advertised_models_updated_at",
        "TEXT"
      );
      this.addColumnIfMissing(
        "requests",
        "point_payer_user_id",
        "TEXT REFERENCES users(id) ON DELETE RESTRICT"
      );
      this.addColumnIfMissing(
        "requests",
        "point_payee_user_id",
        "TEXT REFERENCES users(id) ON DELETE RESTRICT"
      );
      this.addColumnIfMissing(
        "requests",
        "points_reserved",
        "INTEGER NOT NULL DEFAULT 0 CHECK (points_reserved >= 0)"
      );
      this.addColumnIfMissing(
        "requests",
        "points_charged",
        "INTEGER NOT NULL DEFAULT 0 CHECK (points_charged >= 0)"
      );
      this.addColumnIfMissing(
        "requests",
        "points_earned",
        "INTEGER NOT NULL DEFAULT 0 CHECK (points_earned >= 0)"
      );
      if (pointBalanceAdded) {
        this.database.prepare(
          "UPDATE users SET point_balance = ?"
        ).run(this.initialUserPoints);
      }
      this.database.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS password_identities_username_idx
      ON password_identities(username_normalized);
      CREATE INDEX IF NOT EXISTS user_sessions_user_created_idx
      ON user_sessions(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS user_sessions_expires_idx
      ON user_sessions(expires_at);
      CREATE INDEX IF NOT EXISTS providers_owner_created_idx
      ON providers(owner_user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS consumers_owner_created_idx
      ON consumers(owner_user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS providers_catalog_idx
      ON providers(enabled, listed, owner_user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS point_ledger_user_created_idx
      ON point_ledger(user_id, created_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS point_ledger_request_kind_idx
      ON point_ledger(request_id, kind)
      WHERE request_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS point_ledger_initial_grant_idx
      ON point_ledger(user_id, kind)
      WHERE kind = 'initial_grant';
    `);
      const usersWithoutOpeningEntry = this.database.prepare(`
        SELECT users.id, users.point_balance
        FROM users
        WHERE NOT EXISTS (
          SELECT 1
          FROM point_ledger
          WHERE point_ledger.user_id = users.id
            AND point_ledger.kind = 'initial_grant'
        )
      `).all() as SqlRow[];
      const now = new Date().toISOString();
      for (const row of usersWithoutOpeningEntry) {
        const openingBalance = integerColumn(row, "point_balance");
        if (openingBalance !== 0) {
          this.insertPointLedgerEntry(
            stringColumn(row, "id"),
            null,
            "initial_grant",
            openingBalance,
            now
          );
        }
      }
    });
  }

  private addColumnIfMissing(
    table: "users" | "providers" | "consumers" | "requests",
    column: string,
    definition: string
  ): boolean {
    const columns = this.database.prepare(
      `PRAGMA table_info(${table})`
    ).all() as SqlRow[];
    if (columns.some((row) => row.name === column)) {
      return false;
    }
    this.database.exec(
      `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`
    );
    return true;
  }

  private recoverInterruptedRequests(): void {
    this.transaction(() => {
      const now = new Date().toISOString();
      this.database.prepare(`
        UPDATE requests
        SET status = 'interrupted',
            error_code = 'server_restarted',
            error_message = 'Relay server restarted before the provider completed the request.',
            completed_at = ?,
            usage_estimated = 1
        WHERE status IN ('reserved', 'dispatched')
      `).run(now);
      this.database.exec(`
        UPDATE users
        SET points_reserved = 0;
        UPDATE consumers
        SET tokens_reserved = 0, active_requests = 0;
        UPDATE providers
        SET tokens_reserved = 0, active_requests = 0;
      `);
    });
  }
}

function providerFromRow(row: SqlRow): ProviderRecord {
  const tokenLimit = integerColumn(row, "token_limit");
  const tokensUsed = integerColumn(row, "tokens_used");
  const tokensReserved = integerColumn(row, "tokens_reserved");
  return {
    id: stringColumn(row, "id"),
    ownerUserId: nullableStringColumn(row, "owner_user_id"),
    name: stringColumn(row, "name"),
    providerTokenPrefix: stringColumn(row, "provider_token_prefix"),
    enabled: booleanColumn(row, "enabled"),
    listed: booleanColumn(row, "listed"),
    advertisedModels: advertisedModelsColumn(row, "advertised_models"),
    advertisedModelsUpdatedAt: nullableStringColumn(
      row,
      "advertised_models_updated_at"
    ),
    tokenLimit,
    tokensUsed,
    tokensReserved,
    remainingTokens: Math.max(0, tokenLimit - tokensUsed - tokensReserved),
    overageTokens: Math.max(0, tokensUsed - tokenLimit),
    maxConcurrent: integerColumn(row, "max_concurrent"),
    activeRequests: integerColumn(row, "active_requests"),
    createdAt: stringColumn(row, "created_at"),
    updatedAt: stringColumn(row, "updated_at")
  };
}

function consumerFromRow(row: SqlRow): ConsumerRecord {
  const tokenLimit = integerColumn(row, "token_limit");
  const tokensUsed = integerColumn(row, "tokens_used");
  const tokensReserved = integerColumn(row, "tokens_reserved");
  return {
    id: stringColumn(row, "id"),
    ownerUserId: nullableStringColumn(row, "owner_user_id"),
    name: stringColumn(row, "name"),
    apiKeyPrefix: stringColumn(row, "api_key_prefix"),
    providerId: stringColumn(row, "provider_id"),
    model: stringColumn(row, "model"),
    enabled: booleanColumn(row, "enabled"),
    tokenLimit,
    tokensUsed,
    tokensReserved,
    remainingTokens: Math.max(0, tokenLimit - tokensUsed - tokensReserved),
    overageTokens: Math.max(0, tokensUsed - tokenLimit),
    maxConcurrent: integerColumn(row, "max_concurrent"),
    activeRequests: integerColumn(row, "active_requests"),
    createdAt: stringColumn(row, "created_at"),
    updatedAt: stringColumn(row, "updated_at")
  };
}

function requestFromRow(row: SqlRow): RequestRecord {
  const createdAt = stringColumn(row, "created_at");
  const completedAt = nullableStringColumn(row, "completed_at");
  return {
    id: stringColumn(row, "id"),
    consumerId: stringColumn(row, "consumer_id"),
    consumerName: nullableStringColumn(row, "consumer_name") ?? undefined,
    providerId: stringColumn(row, "provider_id"),
    providerName: nullableStringColumn(row, "provider_name") ?? undefined,
    model: stringColumn(row, "model"),
    status: stringColumn(row, "status") as RequestStatus,
    reservedTokens: integerColumn(row, "reserved_tokens"),
    promptTokensEstimated: integerColumn(row, "prompt_tokens_estimated"),
    maxOutputTokens: integerColumn(row, "max_output_tokens"),
    promptTokens: integerColumn(row, "prompt_tokens"),
    completionTokens: integerColumn(row, "completion_tokens"),
    totalTokens: integerColumn(row, "total_tokens"),
    usageEstimated: booleanColumn(row, "usage_estimated"),
    pointPayerUserId: nullableStringColumn(row, "point_payer_user_id"),
    pointPayeeUserId: nullableStringColumn(row, "point_payee_user_id"),
    pointsReserved: integerColumn(row, "points_reserved"),
    pointsCharged: integerColumn(row, "points_charged"),
    pointsEarned: integerColumn(row, "points_earned"),
    errorCode: nullableStringColumn(row, "error_code"),
    errorMessage: nullableStringColumn(row, "error_message"),
    createdAt,
    dispatchedAt: nullableStringColumn(row, "dispatched_at"),
    completedAt,
    deadlineAt: stringColumn(row, "deadline_at"),
    durationMs: completedAt
      ? Math.max(0, Date.parse(completedAt) - Date.parse(createdAt))
      : null
  };
}

function userFromRow(row: SqlRow): UserRecord {
  const pointBalance = integerColumn(row, "point_balance");
  const pointsReserved = integerColumn(row, "points_reserved");
  return {
    id: stringColumn(row, "id"),
    username: nullableStringColumn(row, "username"),
    displayName: stringColumn(row, "display_name"),
    avatarUrl: nullableStringColumn(row, "avatar_url"),
    disabled: booleanColumn(row, "disabled"),
    pointBalance,
    pointsReserved,
    availablePoints: pointBalance - pointsReserved,
    createdAt: stringColumn(row, "created_at"),
    updatedAt: stringColumn(row, "updated_at"),
    lastLoginAt: stringColumn(row, "last_login_at")
  };
}

function userFromAliasedRow(row: SqlRow): UserRecord {
  const pointBalance = integerColumn(row, "user_point_balance");
  const pointsReserved = integerColumn(row, "user_points_reserved");
  return {
    id: stringColumn(row, "user_id"),
    username: nullableStringColumn(row, "user_username"),
    displayName: stringColumn(row, "user_display_name"),
    avatarUrl: nullableStringColumn(row, "user_avatar_url"),
    disabled: booleanColumn(row, "user_disabled"),
    pointBalance,
    pointsReserved,
    availablePoints: pointBalance - pointsReserved,
    createdAt: stringColumn(row, "user_created_at"),
    updatedAt: stringColumn(row, "user_updated_at"),
    lastLoginAt: stringColumn(row, "user_last_login_at")
  };
}

function pointLedgerFromRow(row: SqlRow): PointLedgerRecord {
  return {
    id: stringColumn(row, "id"),
    userId: stringColumn(row, "user_id"),
    requestId: nullableStringColumn(row, "request_id"),
    kind: stringColumn(row, "kind") as PointLedgerKind,
    delta: integerColumn(row, "delta"),
    createdAt: stringColumn(row, "created_at")
  };
}

function entityId(
  kind:
    | "provider"
    | "consumer"
    | "user"
    | "session"
    | "point_entry"
): string {
  return `${kind}_${randomUUID().replaceAll("-", "")}`;
}

function addPatch(
  updates: string[],
  values: Array<string | number>,
  column: string,
  value: string | number | undefined
): void {
  if (value === undefined) {
    return;
  }
  updates.push(`${column} = ?`);
  values.push(value);
}

function booleanSqlValue(value: boolean | undefined): number | undefined {
  return value === undefined ? undefined : value ? 1 : 0;
}

function changes(result: StatementResultingChanges): number {
  return Number(result.changes);
}

function stringColumn(row: SqlRow, key: string): string {
  const value = row[key];
  if (typeof value !== "string") {
    throw new Error(`SQLite column ${key} is not a string.`);
  }
  return value;
}

function nullableStringColumn(row: SqlRow, key: string): string | null {
  const value = row[key];
  return value === null || value === undefined ? null : String(value);
}

function integerColumn(row: SqlRow, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(`SQLite column ${key} is not a safe integer.`);
  }
  return value;
}

function booleanColumn(row: SqlRow, key: string): boolean {
  return integerColumn(row, key) === 1;
}

function advertisedModelsColumn(row: SqlRow, key: string): string[] {
  const value = row[key];
  if (typeof value !== "string") {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? normalizedAdvertisedModels(
          parsed.filter((item): item is string => typeof item === "string")
        )
      : [];
  } catch {
    return [];
  }
}

function normalizedAdvertisedModels(models: readonly string[]): string[] {
  return [...new Set(
    models
      .map((model) => model.trim())
      .filter(Boolean)
      .map((model) => model.slice(0, 256))
      .slice(0, 256)
  )].sort();
}

function nonNegativeSafeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer.`);
  }
  return value;
}
