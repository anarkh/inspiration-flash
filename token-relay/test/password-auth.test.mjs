import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { createRelayServer } from "../apps/relay-server/dist/index.js";
import {
  normalizeDisplayName,
  normalizeUsername,
  validatePassword
} from "../apps/relay-server/dist/password-auth.js";
import { ProviderClient } from "../packages/provider-sdk/dist/index.js";

const ADMIN_TOKEN = "password-test-admin-token-24-characters";
const PUBLIC_URL = "https://relay.example.test";
const FIRST_PASSWORD = "First account password 2026!";
const SECOND_PASSWORD = "Second account password 2026!";
const silentLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {}
};

test("account registration and password login create isolated sessions and owned relay resources", {
  timeout: 20_000
}, async () => {
  const app = await createRelayServer({
    host: "127.0.0.1",
    port: 0,
    databasePath: ":memory:",
    adminToken: ADMIN_TOKEN,
    publicUrl: PUBLIC_URL,
    requestTimeoutMs: 2_000,
    leaseMs: 2_000,
    providerOnlineMs: 2_000
  });
  await app.listen();
  let provider;
  try {
    const anonymous = await jsonFetch(`${app.url}/auth/v1/session`);
    assert.equal(anonymous.status, 200);
    assert.deepEqual(anonymous.body, { authenticated: false });
    assert.match(anonymous.headers.get("cache-control") ?? "", /no-store/);

    const registered = await authJson(app.url, "register", {
      username: "  Alice.User  ",
      password: FIRST_PASSWORD,
      displayName: "账户用户一"
    });
    assert.equal(registered.status, 201);
    assert.equal(registered.body.authenticated, true);
    assert.equal(registered.body.user.username, "alice.user");
    assert.equal(registered.body.user.displayName, "账户用户一");
    assert.ok(registered.body.expiresAt);
    assert.equal("password" in registered.body.user, false);
    assert.equal("passwordHash" in registered.body.user, false);
    const firstCookie = requireSessionCookie(
      registered.headers,
      "__Host-token-relay-session"
    );
    assert.match(firstCookie, /; Secure/);
    assert.match(firstCookie, /; HttpOnly/);
    assert.match(firstCookie, /; SameSite=Lax/);
    assert.match(firstCookie, /; Path=\//);
    assert.match(firstCookie, /; Max-Age=\d+/);

    const duplicate = await authJson(app.url, "register", {
      username: "ALICE.USER",
      password: "Another safe password 2026!"
    });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error.code, "username_unavailable");

    const unknownLogin = await authJson(app.url, "login", {
      username: "not-a-user",
      password: FIRST_PASSWORD
    });
    assert.equal(unknownLogin.status, 401);
    assert.equal(unknownLogin.body.error.code, "invalid_credentials");

    const wrongPassword = await authJson(app.url, "login", {
      username: "alice.user",
      password: SECOND_PASSWORD
    });
    assert.equal(wrongPassword.status, 401);
    assert.equal(wrongPassword.body.error.code, "invalid_credentials");
    assert.equal(
      wrongPassword.body.error.message,
      unknownLogin.body.error.message,
      "unknown usernames and wrong passwords must use the same public error"
    );

    const loggedIn = await authJson(app.url, "login", {
      username: "ALICE.USER",
      password: FIRST_PASSWORD
    });
    assert.equal(loggedIn.status, 200);
    assert.equal(loggedIn.body.user.id, registered.body.user.id);
    assert.equal(loggedIn.body.user.username, "alice.user");
    const loginCookie = requireSessionCookie(
      loggedIn.headers,
      "__Host-token-relay-session"
    );

    const firstSession = await jsonFetch(`${app.url}/auth/v1/session`, {
      headers: { cookie: cookiePair(loginCookie) }
    });
    assert.equal(firstSession.status, 200);
    assert.equal(firstSession.body.authenticated, true);
    assert.equal(firstSession.body.user.username, "alice.user");
    assert.equal(firstSession.body.user.displayName, "账户用户一");
    assert.equal(JSON.stringify(firstSession.body).includes(FIRST_PASSWORD), false);

    const userCannotUseAdmin = await jsonFetch(
      `${app.url}/admin/v1/overview`,
      { headers: { cookie: cookiePair(loginCookie) } }
    );
    assert.equal(userCannotUseAdmin.status, 401);
    assert.equal(userCannotUseAdmin.body.error.code, "invalid_admin_token");

    const adminCannotImpersonateUser = await jsonFetch(
      `${app.url}/account/v1/overview`,
      { headers: { authorization: `Bearer ${ADMIN_TOKEN}` } }
    );
    assert.equal(adminCannotImpersonateUser.status, 401);
    assert.equal(
      adminCannotImpersonateUser.body.error.code,
      "authentication_required"
    );

    const providerCreated = await accountJson(
      app.url,
      loginCookie,
      "POST",
      "/account/v1/providers",
      {
        name: "账号 Provider",
        listed: false,
        tokenLimit: 10_000,
        maxConcurrent: 1
      }
    );
    assert.equal(providerCreated.status, 201);
    assert.equal(
      providerCreated.body.provider.ownerUserId,
      registered.body.user.id
    );
    assert.match(providerCreated.body.providerToken, /^tr_provider_/);

    provider = new ProviderClient({
      relayUrl: `${app.url.replace(/^http/, "ws")}/provider/v1/connect`,
      providerToken: providerCreated.body.providerToken,
      concurrency: 1,
      connectTimeoutMs: 2_000,
      reconnectInitialMs: 100,
      reconnectMaxMs: 500,
      models: {
        "password-model": {
          adapter: "custom",
          command: process.execPath
        }
      }
    }, {
      executor: {
        async execute(job) {
          return {
            content: `password-user-ok:${job.messages.at(-1)?.content}`,
            finishReason: "stop",
            usage: {
              promptTokens: 20,
              completionTokens: 5,
              totalTokens: 25,
              estimated: false
            }
          };
        }
      },
      logger: silentLogger
    });
    await provider.start();

    const consumerCreated = await accountJson(
      app.url,
      loginCookie,
      "POST",
      "/account/v1/consumers",
      {
        name: "账号 Consumer",
        providerId: providerCreated.body.provider.id,
        model: "password-model",
        tokenLimit: 1_000,
        maxConcurrent: 1
      }
    );
    assert.equal(consumerCreated.status, 201);
    assert.equal(
      consumerCreated.body.consumer.ownerUserId,
      registered.body.user.id
    );

    const completion = await jsonFetch(
      `${app.url}/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${consumerCreated.body.apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: "password-model",
          messages: [{ role: "user", content: "hello" }],
          max_tokens: 16
        })
      }
    );
    assert.equal(completion.status, 200);
    assert.equal(
      completion.body.choices[0].message.content,
      "password-user-ok:hello"
    );
    const firstUsageTokens = completion.body.usage.total_tokens;

    const firstOverview = await accountJson(
      app.url,
      loginCookie,
      "GET",
      "/account/v1/overview"
    );
    assert.equal(firstOverview.status, 200);
    assert.equal(firstOverview.body.providers.length, 1);
    assert.equal(firstOverview.body.consumers.length, 1);
    assert.equal(firstOverview.body.requests.length, 1);
    assert.equal(firstOverview.body.user.pointBalance, 100_000);
    assert.equal(firstOverview.body.summary.consumerTokensUsed, firstUsageTokens);
    assert.equal(firstOverview.body.summary.providerTokensServed, firstUsageTokens);
    assert.equal(firstOverview.body.summary.pointsSpent, firstUsageTokens);
    assert.equal(firstOverview.body.summary.pointsEarned, firstUsageTokens);
    const serializedOverview = JSON.stringify(firstOverview.body);
    assert.equal(
      serializedOverview.includes(providerCreated.body.providerToken),
      false
    );
    assert.equal(serializedOverview.includes(consumerCreated.body.apiKey), false);
    assert.equal(serializedOverview.includes(FIRST_PASSWORD), false);

    const secondRegistered = await authJson(app.url, "register", {
      username: "bob-provider-user",
      password: SECOND_PASSWORD
    });
    assert.equal(secondRegistered.status, 201);
    assert.equal(secondRegistered.body.user.displayName, "bob-provider-user");
    const secondCookie = requireSessionCookie(
      secondRegistered.headers,
      "__Host-token-relay-session"
    );
    const secondOverview = await accountJson(
      app.url,
      secondCookie,
      "GET",
      "/account/v1/overview"
    );
    assert.equal(secondOverview.status, 200);
    assert.equal(secondOverview.body.providers.length, 0);
    assert.equal(secondOverview.body.consumers.length, 0);
    assert.equal(secondOverview.body.requests.length, 0);
    assert.deepEqual(secondOverview.body.availableProviders, []);

    const privateCrossUserBinding = await accountJson(
      app.url,
      secondCookie,
      "POST",
      "/account/v1/consumers",
      {
        name: "Unauthorized Consumer",
        providerId: providerCreated.body.provider.id,
        model: "password-model",
        tokenLimit: 100,
        maxConcurrent: 1
      }
    );
    assert.equal(privateCrossUserBinding.status, 404);
    assert.equal(
      privateCrossUserBinding.body.error.code,
      "provider_not_found"
    );

    const listed = await accountJson(
      app.url,
      loginCookie,
      "PATCH",
      `/account/v1/providers/${providerCreated.body.provider.id}`,
      { listed: true }
    );
    assert.equal(listed.status, 200);

    const sharedConsumer = await accountJson(
      app.url,
      secondCookie,
      "POST",
      "/account/v1/consumers",
      {
        name: "Shared Consumer",
        providerId: providerCreated.body.provider.id,
        model: "password-model",
        tokenLimit: 1_000,
        maxConcurrent: 1
      }
    );
    assert.equal(sharedConsumer.status, 201);

    const crossUserRotation = await accountJson(
      app.url,
      secondCookie,
      "POST",
      `/account/v1/consumers/${consumerCreated.body.consumer.id}/rotate-key`,
      {}
    );
    assert.equal(crossUserRotation.status, 404);
    assert.equal(crossUserRotation.body.error.code, "consumer_not_found");

    const logout = await fetch(`${app.url}/auth/v1/logout`, {
      method: "POST",
      headers: {
        cookie: cookiePair(loginCookie),
        origin: PUBLIC_URL,
        "content-type": "application/json"
      },
      body: "{}"
    });
    assert.equal(logout.status, 204);
    assert.match(
      logout.headers.getSetCookie().join("\n"),
      /__Host-token-relay-session=;.*Max-Age=0/
    );
    const afterLogout = await jsonFetch(`${app.url}/auth/v1/session`, {
      headers: { cookie: cookiePair(loginCookie) }
    });
    assert.deepEqual(afterLogout.body, { authenticated: false });
  } finally {
    await provider?.stop();
    await app.close();
  }
});

test("local loopback startup derives its own origin for registration and account mutations", async () => {
  const app = await createRelayServer({
    host: "127.0.0.1",
    port: 0,
    databasePath: ":memory:",
    adminToken: ADMIN_TOKEN
  });
  await app.listen();
  try {
    const registered = await authJson(app.url, "register", {
      username: "local-user",
      password: "Local password is long enough!"
    }, app.url);
    assert.equal(registered.status, 201);
    const cookie = requireSessionCookie(
      registered.headers,
      "token-relay-session"
    );
    assert.doesNotMatch(cookie, /; Secure/);
    assert.match(cookie, /; HttpOnly/);
    assert.match(cookie, /; SameSite=Lax/);

    const providerCreated = await accountJson(
      app.url,
      cookie,
      "POST",
      "/account/v1/providers",
      {
        name: "Local Provider",
        listed: false,
        tokenLimit: 100,
        maxConcurrent: 1
      },
      app.url
    );
    assert.equal(providerCreated.status, 201);

    const wrongOrigin = await accountJson(
      app.url,
      cookie,
      "PATCH",
      `/account/v1/providers/${providerCreated.body.provider.id}`,
      { name: "Must not change" },
      "http://127.0.0.1:9"
    );
    assert.equal(wrongOrigin.status, 403);
    assert.equal(wrongOrigin.body.error.code, "origin_not_allowed");
  } finally {
    await app.close();
  }
});

test("registration validates normalized usernames, passwords and display names", async () => {
  const app = await createRelayServer({
    host: "127.0.0.1",
    port: 0,
    databasePath: ":memory:",
    adminToken: ADMIN_TOKEN,
    publicUrl: PUBLIC_URL
  });
  await app.listen();
  try {
    for (const username of [
      "ab",
      "contains space",
      "中文账号"
    ]) {
      const response = await authJson(app.url, "register", {
        username,
        password: "Validation password 2026!"
      });
      assert.equal(response.status, 400, username);
      assert.equal(response.body.error.code, "invalid_username", username);
    }

    const password = "short";
    const invalidPassword = await authJson(app.url, "register", {
      username: "valid-short-password",
      password
    });
    assert.equal(invalidPassword.status, 400);
    assert.equal(invalidPassword.body.error.code, "invalid_password");
    assert.equal(JSON.stringify(invalidPassword.body).includes(password), false);

    const blankDisplayName = await authJson(app.url, "register", {
      username: "valid-display-user",
      password: "Validation password 2026!",
      displayName: "   "
    });
    assert.equal(blankDisplayName.status, 400);
    assert.equal(blankDisplayName.body.error.code, "invalid_display_name");

  } finally {
    await app.close();
  }

  assert.throws(
    () => normalizeUsername("a".repeat(65)),
    (error) => error?.code === "invalid_username"
  );
  assert.throws(
    () => validatePassword("密".repeat(129)),
    (error) => error?.code === "invalid_password"
  );
  assert.throws(
    () => normalizeDisplayName("显".repeat(65), "fallback"),
    (error) => error?.code === "invalid_display_name"
  );
});

test("registration and login attempts are rate limited per client", async () => {
  const app = await createRelayServer({
    host: "127.0.0.1",
    port: 0,
    databasePath: ":memory:",
    adminToken: ADMIN_TOKEN,
    publicUrl: PUBLIC_URL
  });
  await app.listen();
  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const login = await authJson(app.url, "login", {
        username: "missing-user",
        password: "Missing account password 2026!"
      });
      assert.equal(login.status, 401);
      assert.equal(login.body.error.code, "invalid_credentials");
    }
    const limitedLogin = await authJson(app.url, "login", {
      username: "missing-user",
      password: "Missing account password 2026!"
    });
    assert.equal(limitedLogin.status, 429);
    assert.equal(
      limitedLogin.body.error.code,
      "too_many_login_attempts"
    );
    assert.ok(Number(limitedLogin.headers.get("retry-after")) > 0);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const registration = await authJson(app.url, "register", {
        username: "x",
        password: "Registration password 2026!"
      });
      assert.equal(registration.status, 400);
      assert.equal(registration.body.error.code, "invalid_username");
    }
    const limitedRegistration = await authJson(app.url, "register", {
      username: "valid-but-limited",
      password: "Registration password 2026!"
    });
    assert.equal(limitedRegistration.status, 429);
    assert.equal(
      limitedRegistration.body.error.code,
      "too_many_login_attempts"
    );
    assert.ok(Number(limitedRegistration.headers.get("retry-after")) > 0);
  } finally {
    await app.close();
  }
});

test("password credentials are salted hashes and plaintext is never persisted", async () => {
  const directory = await mkdtemp(join(tmpdir(), "token-relay-password-db-"));
  await chmod(directory, 0o700);
  const databasePath = join(directory, "relay.db");
  const password = "Plaintext must never reach SQLite 2026!";
  const app = await createRelayServer({
    host: "127.0.0.1",
    port: 0,
    databasePath,
    adminToken: ADMIN_TOKEN,
    publicUrl: PUBLIC_URL
  });
  await app.listen();
  try {
    const registered = await authJson(app.url, "register", {
      username: "stored-user",
      password,
      displayName: "Stored User"
    });
    assert.equal(registered.status, 201);
    const second = await authJson(app.url, "register", {
      username: "stored-user-two",
      password,
      displayName: "Stored User Two"
    });
    assert.equal(second.status, 201);
  } finally {
    await app.close();
  }

  try {
    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      const identities = database.prepare(`
        SELECT username, username_normalized, password_hash
        FROM password_identities
        ORDER BY username_normalized
      `).all();
      assert.equal(identities.length, 2);
      assert.equal(identities[0].username_normalized, "stored-user");
      assert.equal(typeof identities[0].password_hash, "string");
      assert.notEqual(identities[0].password_hash, password);
      assert.equal(identities[0].password_hash.includes(password), false);
      assert.match(identities[0].password_hash, /^scrypt-v1\$/);
      assert.notEqual(
        identities[0].password_hash,
        identities[1].password_hash,
        "the same password must receive a distinct per-account random salt"
      );

      const columns = database.prepare(
        "PRAGMA table_info(password_identities)"
      ).all().map((column) => column.name);
      assert.equal(columns.includes("password"), false);
      assert.equal(columns.includes("password_hash"), true);

      const obsoleteTables = database.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name IN ('wechat_identities', 'oauth_states')
      `).all();
      assert.deepEqual(obsoleteTables, []);
    } finally {
      database.close();
    }

    const files = [
      databasePath,
      `${databasePath}-wal`,
      `${databasePath}-shm`
    ];
    for (const path of files) {
      const bytes = await readFile(path).catch(() => null);
      if (bytes) {
        assert.equal(bytes.includes(Buffer.from(password, "utf8")), false, path);
      }
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("non-loopback deployments require an explicit secure public origin", async () => {
  await assert.rejects(
    () => createRelayServer({
      host: "0.0.0.0",
      port: 0,
      databasePath: ":memory:",
      adminToken: ADMIN_TOKEN
    }),
    /TOKEN_RELAY_PUBLIC_URL/
  );
  await assert.rejects(
    () => createRelayServer({
      host: "0.0.0.0",
      port: 0,
      databasePath: ":memory:",
      adminToken: ADMIN_TOKEN,
      publicUrl: "http://relay.example.test"
    }),
    /HTTPS/
  );
});

test("existing relay databases migrate to password ownership without data loss", async () => {
  const directory = await mkdtemp(join(tmpdir(), "token-relay-legacy-"));
  await chmod(directory, 0o700);
  const databasePath = join(directory, "legacy.db");
  const legacy = new DatabaseSync(databasePath);
  legacy.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider_token_hash TEXT NOT NULL UNIQUE,
      provider_token_prefix TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
      token_limit INTEGER NOT NULL CHECK (token_limit > 0),
      tokens_used INTEGER NOT NULL DEFAULT 0 CHECK (tokens_used >= 0),
      tokens_reserved INTEGER NOT NULL DEFAULT 0 CHECK (tokens_reserved >= 0),
      max_concurrent INTEGER NOT NULL DEFAULT 1 CHECK (max_concurrent > 0),
      active_requests INTEGER NOT NULL DEFAULT 0 CHECK (active_requests >= 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE consumers (
      id TEXT PRIMARY KEY,
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
    CREATE TABLE requests (
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
      error_code TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      dispatched_at TEXT,
      completed_at TEXT,
      deadline_at TEXT NOT NULL
    );
  `);
  const timestamp = new Date().toISOString();
  legacy.prepare(`
    INSERT INTO providers (
      id, name, provider_token_hash, provider_token_prefix, enabled,
      token_limit, tokens_used, tokens_reserved, max_concurrent,
      active_requests, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 1, 1000, 0, 0, 1, 0, ?, ?)
  `).run(
    "provider_legacy",
    "Legacy Provider",
    "legacy-provider-hash",
    "tr_provider_legacy",
    timestamp,
    timestamp
  );
  legacy.prepare(`
    INSERT INTO consumers (
      id, name, api_key_hash, api_key_prefix, provider_id, model, enabled,
      token_limit, tokens_used, tokens_reserved, max_concurrent,
      active_requests, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, 1000, 0, 0, 1, 0, ?, ?)
  `).run(
    "consumer_legacy",
    "Legacy Consumer",
    "legacy-consumer-hash",
    "tr_consumer_legacy",
    "provider_legacy",
    "legacy-model",
    timestamp,
    timestamp
  );
  legacy.close();

  const app = await createRelayServer({
    host: "127.0.0.1",
    port: 0,
    databasePath,
    adminToken: ADMIN_TOKEN
  });
  await app.listen();
  try {
    const overview = await jsonFetch(`${app.url}/admin/v1/overview`, {
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` }
    });
    assert.equal(overview.status, 200);
    assert.equal(overview.body.providers[0].id, "provider_legacy");
    assert.equal(overview.body.providers[0].ownerUserId, null);
    assert.equal(overview.body.consumers[0].id, "consumer_legacy");
    assert.equal(overview.body.consumers[0].ownerUserId, null);
  } finally {
    await app.close();
  }

  const migrated = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const providerColumns = migrated.prepare(
      "PRAGMA table_info(providers)"
    ).all().map((column) => column.name);
    const consumerColumns = migrated.prepare(
      "PRAGMA table_info(consumers)"
    ).all().map((column) => column.name);
    assert.equal(providerColumns.includes("owner_user_id"), true);
    assert.equal(consumerColumns.includes("owner_user_id"), true);
    const authTables = migrated.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name IN ('users', 'password_identities', 'user_sessions')
      ORDER BY name
    `).all().map((row) => row.name);
    assert.deepEqual(authTables, [
      "password_identities",
      "user_sessions",
      "users"
    ]);
  } finally {
    migrated.close();
    await rm(directory, { recursive: true, force: true });
  }
});

async function authJson(baseUrl, action, body, origin = PUBLIC_URL) {
  return jsonFetch(`${baseUrl}/auth/v1/${action}`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      origin
    },
    body: JSON.stringify(body)
  });
}

async function accountJson(
  baseUrl,
  sessionCookie,
  method,
  path,
  body,
  origin = PUBLIC_URL
) {
  const headers = {
    accept: "application/json",
    cookie: cookiePair(sessionCookie)
  };
  if (method !== "GET") {
    headers.origin = origin;
    headers["content-type"] = "application/json";
  }
  return jsonFetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    body: text ? JSON.parse(text) : null
  };
}

function requireSessionCookie(headers, expectedName) {
  const cookie = headers.getSetCookie().find(
    (value) => value.startsWith(`${expectedName}=`)
  );
  assert.ok(cookie, `expected ${expectedName} Set-Cookie`);
  return cookie;
}

function cookiePair(setCookie) {
  return setCookie.split(";", 1)[0];
}
