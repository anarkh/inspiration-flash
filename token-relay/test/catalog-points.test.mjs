import assert from "node:assert/strict";
import { chmod, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { createRelayServer } from "../apps/relay-server/dist/index.js";
import { hashPassword } from "../apps/relay-server/dist/password-auth.js";
import { RelayStore } from "../apps/relay-server/dist/store.js";
import { estimateRelayPromptTokens } from "../packages/protocol/dist/index.js";
import { ProviderClient } from "../packages/provider-sdk/dist/index.js";

const ADMIN_TOKEN = "test-only-admin-token-not-a-secret";
const PUBLIC_URL = "https://relay.test.invalid";
const silentLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {}
};

test("anonymous catalog is redacted and an opted-in cross-user route settles full usage", {
  timeout: 15_000
}, async () => {
  const fixture = await createAccountFixture({ initialUserPoints: 200 });
  let provider;
  let settledUsage;
  try {
    const created = await fixture.account(
      fixture.providerOwner,
      "POST",
      "/account/v1/providers",
      {
        name: "Public test provider",
        listed: false,
        tokenLimit: 10_000,
        maxConcurrent: 1
      }
    );
    assert.equal(created.status, 201);
    const providerId = created.body.provider.id;
    const providerToken = created.body.providerToken;

    provider = new ProviderClient({
      relayUrl: `${fixture.app.url.replace(/^http/, "ws")}/provider/v1/connect`,
      providerToken,
      concurrency: 1,
      connectTimeoutMs: 2_000,
      reconnectInitialMs: 100,
      reconnectMaxMs: 500,
      models: {
        "deepseek-qwen-hybrid": {
          adapter: "custom",
          command: process.execPath
        }
      }
    }, {
      executor: {
        async execute(job) {
          const promptTokens = estimateRelayPromptTokens(job);
          settledUsage = {
            promptTokens,
            completionTokens: job.maxOutputTokens + 11,
            totalTokens: promptTokens + job.maxOutputTokens + 11,
            estimated: false
          };
          return {
            content: "relay-ok",
            finishReason: "stop",
            usage: settledUsage
          };
        }
      },
      logger: silentLogger
    });
    await provider.start();

    const hidden = await fixture.json("GET", "/catalog/v1/models");
    assert.equal(hidden.status, 200);
    assert.equal(
      hidden.body.models.some((model) => model.providerId === providerId),
      false
    );

    const listed = await fixture.account(
      fixture.providerOwner,
      "PATCH",
      `/account/v1/providers/${providerId}`,
      { listed: true }
    );
    assert.equal(listed.status, 200);

    const catalog = await fixture.json("GET", "/catalog/v1/models");
    assert.equal(catalog.status, 200);
    const model = catalog.body.models.find(
      (item) => item.providerId === providerId
    );
    assert.ok(model);
    assert.equal(model.id, "deepseek-qwen-hybrid");
    assert.equal(model.family, "deepseek");
    assert.equal(model.online, true);
    assert.equal(model.available, true);
    const serializedCatalog = JSON.stringify(catalog.body);
    for (const privateValue of [
      providerToken,
      fixture.providerOwner.user.id,
      "providerTokenPrefix",
      "ownerUserId",
      "pointBalance",
      "tokenLimit"
    ]) {
      assert.equal(serializedCatalog.includes(privateValue), false);
    }

    const page = await fixture.text("GET", "/models");
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type"), /^text\/html/);
    assert.match(page.body, /\/catalog\/v1\/models/);
    assert.equal(page.body.includes(providerToken), false);

    const consumerCreated = await fixture.account(
      fixture.consumerOwner,
      "POST",
      "/account/v1/consumers",
      {
        name: "Cross-user consumer",
        providerId,
        model: model.id,
        tokenLimit: 10_000,
        maxConcurrent: 1
      }
    );
    assert.equal(consumerCreated.status, 201);

    await fixture.account(
      fixture.providerOwner,
      "PATCH",
      `/account/v1/providers/${providerId}`,
      { listed: false }
    );
    const completion = await fixture.json(
      "POST",
      "/v1/chat/completions",
      {
        authorization: `Bearer ${consumerCreated.body.apiKey}`
      },
      {
        model: model.id,
        messages: [{ role: "user", content: "hello" }],
        max_tokens: 4
      }
    );
    assert.equal(completion.status, 200);
    assert.ok(settledUsage);
    assert.equal(completion.body.usage.total_tokens, settledUsage.totalTokens);

    const [payer, payee] = await Promise.all([
      fixture.account(fixture.consumerOwner, "GET", "/account/v1/overview"),
      fixture.account(fixture.providerOwner, "GET", "/account/v1/overview")
    ]);
    assert.equal(
      payer.body.user.pointBalance,
      200 - settledUsage.totalTokens
    );
    assert.equal(
      payee.body.user.pointBalance,
      200 + settledUsage.totalTokens
    );
    assert.equal(payer.body.user.pointsReserved, 0);
    assert.equal(payer.body.summary.pointsSpent, settledUsage.totalTokens);
    assert.equal(payee.body.summary.pointsEarned, settledUsage.totalTokens);
    assert.equal(
      payer.body.pointLedger.filter(
        (entry) => entry.kind === "consumer_spend"
      ).length,
      1
    );
    assert.equal(
      payee.body.pointLedger.filter(
        (entry) => entry.kind === "provider_earn"
      ).length,
      1
    );

    assert.equal(
      fixture.app.store.settleRequest(completion.body.id, {
        status: "completed",
        usage: settledUsage
      }),
      false
    );
    assert.equal(
      fixture.app.store.getUser(fixture.consumerOwner.user.id).pointBalance,
      200 - settledUsage.totalTokens
    );
  } finally {
    await provider?.stop();
    await fixture.close();
  }
});

test("point reservations reject insufficient cross-user funds but allow same-owner net zero", async () => {
  const insufficientStore = new RelayStore(":memory:", { initialUserPoints: 4 });
  try {
    const payer = await createUser(insufficientStore, "payer");
    const payee = await createUser(insufficientStore, "payee");
    const provider = insufficientStore.createProvider({
      ownerUserId: payee.id,
      name: "Payee provider",
      tokenLimit: 100,
      maxConcurrent: 1
    }).provider;
    const consumer = insufficientStore.createConsumer({
      ownerUserId: payer.id,
      name: "Payer consumer",
      providerId: provider.id,
      model: "test-model",
      tokenLimit: 100,
      maxConcurrent: 1
    }).consumer;
    assert.throws(
      () => insufficientStore.reserveRequest(
        reservation("request_insufficient", consumer.id, provider.id, 5)
      ),
      (error) => error?.reason === "insufficient_points"
    );
    assert.equal(insufficientStore.getUser(payer.id).pointsReserved, 0);
    assert.equal(insufficientStore.listRequests().length, 0);
  } finally {
    insufficientStore.close();
  }

  const selfStore = new RelayStore(":memory:", { initialUserPoints: 0 });
  try {
    const owner = await createUser(selfStore, "self");
    const provider = selfStore.createProvider({
      ownerUserId: owner.id,
      name: "Self provider",
      tokenLimit: 100,
      maxConcurrent: 1
    }).provider;
    const consumer = selfStore.createConsumer({
      ownerUserId: owner.id,
      name: "Self consumer",
      providerId: provider.id,
      model: "self-model",
      tokenLimit: 100,
      maxConcurrent: 1
    }).consumer;
    const held = selfStore.reserveRequest(
      reservation("request_self", consumer.id, provider.id, 5, "self-model")
    );
    assert.equal(held.request.pointsReserved, 0);
    selfStore.markRequestDispatched("request_self");
    const usage = {
      promptTokens: 3,
      completionTokens: 4,
      totalTokens: 7,
      estimated: false
    };
    assert.equal(
      selfStore.settleRequest("request_self", {
        status: "completed",
        usage
      }),
      true
    );
    assert.equal(
      selfStore.settleRequest("request_self", {
        status: "completed",
        usage
      }),
      false
    );
    assert.equal(selfStore.getUser(owner.id).pointBalance, 0);
    assert.deepEqual(
      selfStore.listPointLedgerForUser(owner.id)
        .map(({ kind, delta }) => ({ kind, delta }))
        .sort((left, right) => left.kind.localeCompare(right.kind)),
      [
        { kind: "consumer_spend", delta: -7 },
        { kind: "provider_earn", delta: 7 }
      ]
    );
    const stats = selfStore.usageStatsForUser(owner.id);
    assert.equal(stats.consumerTokensUsed, 7);
    assert.equal(stats.providerTokensServed, 7);
  } finally {
    selfStore.close();
  }
});

test("legacy users receive one opening grant and legacy providers stay unlisted", async () => {
  const directory = await mkdtemp(join(tmpdir(), "token-relay-points-migration-"));
  await chmod(directory, 0o700);
  const databasePath = join(directory, "legacy.db");
  const timestamp = new Date().toISOString();
  const legacy = new DatabaseSync(databasePath);
  legacy.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      disabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login_at TEXT NOT NULL
    );
    CREATE TABLE providers (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT REFERENCES users(id),
      name TEXT NOT NULL,
      provider_token_hash TEXT NOT NULL UNIQUE,
      provider_token_prefix TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      token_limit INTEGER NOT NULL,
      tokens_used INTEGER NOT NULL DEFAULT 0,
      tokens_reserved INTEGER NOT NULL DEFAULT 0,
      max_concurrent INTEGER NOT NULL DEFAULT 1,
      active_requests INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  legacy.prepare(`
    INSERT INTO users (
      id, display_name, disabled, created_at, updated_at, last_login_at
    ) VALUES ('user_legacy', 'Legacy user', 0, ?, ?, ?)
  `).run(timestamp, timestamp, timestamp);
  legacy.prepare(`
    INSERT INTO providers (
      id, owner_user_id, name, provider_token_hash, provider_token_prefix,
      enabled, token_limit, max_concurrent, created_at, updated_at
    ) VALUES (
      'provider_legacy', 'user_legacy', 'Legacy provider',
      'test-legacy-hash', 'test-legacy-prefix', 1, 100, 1, ?, ?
    )
  `).run(timestamp, timestamp);
  legacy.close();

  try {
    const first = new RelayStore(databasePath, { initialUserPoints: 321 });
    assert.equal(first.getUser("user_legacy").pointBalance, 321);
    assert.equal(first.getProvider("provider_legacy").listed, false);
    assert.equal(first.listPointLedgerForUser("user_legacy").length, 1);
    first.close();

    const second = new RelayStore(databasePath, { initialUserPoints: 999 });
    assert.equal(second.getUser("user_legacy").pointBalance, 321);
    assert.equal(second.listPointLedgerForUser("user_legacy").length, 1);
    second.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

async function createAccountFixture({ initialUserPoints }) {
  const directory = await mkdtemp(join(tmpdir(), "token-relay-catalog-points-"));
  await chmod(directory, 0o700);
  const databasePath = join(directory, "relay.db");
  const seed = new RelayStore(databasePath, { initialUserPoints });
  const providerOwner = {
    user: await createUser(seed, "provider-owner"),
    sessionToken: "test-session-provider-owner"
  };
  const consumerOwner = {
    user: await createUser(seed, "consumer-owner"),
    sessionToken: "test-session-consumer-owner"
  };
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  seed.createUserSession(
    providerOwner.user.id,
    providerOwner.sessionToken,
    expiresAt
  );
  seed.createUserSession(
    consumerOwner.user.id,
    consumerOwner.sessionToken,
    expiresAt
  );
  seed.close();

  const app = await createRelayServer({
    host: "127.0.0.1",
    port: 0,
    databasePath,
    adminToken: ADMIN_TOKEN,
    publicUrl: PUBLIC_URL,
    initialUserPoints,
    requestTimeoutMs: 2_000,
    leaseMs: 2_000,
    providerOnlineMs: 2_000
  });
  await app.listen();

  const request = async (method, path, headers = {}, body, parseJson = true) => {
    const response = await fetch(`${app.url}${path}`, {
      method,
      headers: {
        accept: parseJson ? "application/json" : "text/html",
        ...headers,
        ...(body === undefined ? {} : { "content-type": "application/json" })
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    return {
      status: response.status,
      headers: response.headers,
      body: parseJson && text ? JSON.parse(text) : text
    };
  };

  return {
    app,
    providerOwner,
    consumerOwner,
    json(method, path, headers, body) {
      return request(method, path, headers, body, true);
    },
    text(method, path, headers) {
      return request(method, path, headers, undefined, false);
    },
    account(owner, method, path, body) {
      return request(method, path, {
        cookie: `__Host-token-relay-session=${owner.sessionToken}`,
        ...(method === "GET" ? {} : { origin: PUBLIC_URL })
      }, body, true);
    },
    async close() {
      await app.close();
      await rm(directory, { recursive: true, force: true });
    }
  };
}

async function createUser(store, suffix) {
  const username = `test-${suffix}`;
  return store.createPasswordUser({
    username,
    normalizedUsername: username,
    passwordHash: await hashPassword(`Test password for ${suffix} 2026!`),
    displayName: `Test user ${suffix}`,
  });
}

function reservation(id, consumerId, providerId, reservedTokens, model = "test-model") {
  const createdAt = new Date().toISOString();
  return {
    id,
    consumerId,
    providerId,
    model,
    reservedTokens,
    promptTokensEstimated: Math.max(0, reservedTokens - 2),
    maxOutputTokens: 2,
    createdAt,
    deadlineAt: new Date(Date.now() + 10_000).toISOString()
  };
}
