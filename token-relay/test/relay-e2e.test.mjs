import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import WebSocket from "ws";
import { createRelayServer } from "../apps/relay-server/dist/index.js";
import {
  estimateRelayPromptTokens,
  estimateTextTokens
} from "../packages/protocol/dist/index.js";
import { ProviderClient } from "../packages/provider-sdk/dist/index.js";

const ADMIN_TOKEN = "test-admin-token-with-24-characters";
const silentLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {}
};

test("consumer key and model route only to the assigned provider and enforce quota", {
  timeout: 15_000
}, async () => {
  const fixture = await createFixture();
  let providerOne;
  let providerTwo;
  let consumerKey = "";
  let providerOneToken = "";
  let providerTwoToken = "";
  let providerOneJobs = 0;
  let providerTwoJobs = 0;
  try {
    const invalidAdmin = await jsonRequest(
      fixture.baseUrl,
      "GET",
      "/admin/v1/overview",
      "wrong-admin-token"
    );
    assert.equal(invalidAdmin.status, 401);
    assert.equal(invalidAdmin.body.error.code, "invalid_admin_token");

    const providerOneCreated = await fixture.admin(
      "POST",
      "/admin/v1/providers",
      { name: "Provider One", tokenLimit: 1_000, maxConcurrent: 1 }
    );
    const providerTwoCreated = await fixture.admin(
      "POST",
      "/admin/v1/providers",
      { name: "Provider Two", tokenLimit: 1_000, maxConcurrent: 1 }
    );
    assert.equal(providerOneCreated.status, 201);
    assert.equal(providerTwoCreated.status, 201);
    providerOneToken = providerOneCreated.body.providerToken;
    providerTwoToken = providerTwoCreated.body.providerToken;

    const promptReservation = estimateRelayPromptTokens({
      model: "shared-model",
      messages: [{ role: "user", content: "hi" }],
      maxOutputTokens: 4
    });
    const providerOneCompletionTokens = estimateTextTokens("provider-one:hi");
    const consumerCreated = await fixture.admin(
      "POST",
      "/admin/v1/consumers",
      {
        name: "Consumer One",
        providerId: providerOneCreated.body.provider.id,
        model: "shared-model",
        tokenLimit: promptReservation + 4,
        maxConcurrent: 1
      }
    );
    assert.equal(consumerCreated.status, 201);
    consumerKey = consumerCreated.body.apiKey;
    const initialOverview = await fixture.admin("GET", "/admin/v1/overview");
    const serializedOverview = JSON.stringify(initialOverview.body);
    assert.equal(serializedOverview.includes(consumerKey), false);
    assert.equal(serializedOverview.includes(providerOneToken), false);
    assert.equal(serializedOverview.includes(providerTwoToken), false);

    providerOne = createFakeProvider(
      fixture.webSocketUrl,
      providerOneToken,
      async (job) => {
        providerOneJobs += 1;
        return {
          content: `provider-one:${job.messages.at(-1)?.content}`,
          finishReason: "stop",
          usage: {
            promptTokens: promptReservation,
            completionTokens: providerOneCompletionTokens,
            totalTokens: promptReservation + providerOneCompletionTokens,
            estimated: false
          }
        };
      }
    );
    providerTwo = createFakeProvider(
      fixture.webSocketUrl,
      providerTwoToken,
      async () => {
        providerTwoJobs += 1;
        return {
          content: "wrong-provider",
          finishReason: "stop",
          usage: {
            promptTokens: 1,
            completionTokens: 1,
            totalTokens: 2,
            estimated: false
          }
        };
      }
    );
    await Promise.all([providerOne.start(), providerTwo.start()]);

    const completion = await jsonRequest(
      fixture.baseUrl,
      "POST",
      "/v1/chat/completions",
      consumerKey,
      {
        model: "shared-model",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 4
      }
    );
    assert.equal(completion.status, 200);
    assert.equal(
      completion.body.choices[0].message.content,
      "provider-one:hi"
    );
    assert.deepEqual(completion.body.usage, {
      prompt_tokens: promptReservation,
      completion_tokens: providerOneCompletionTokens,
      total_tokens: promptReservation + providerOneCompletionTokens
    });
    assert.equal(providerOneJobs, 1);
    assert.equal(providerTwoJobs, 0);

    const wrongModel = await jsonRequest(
      fixture.baseUrl,
      "POST",
      "/v1/chat/completions",
      consumerKey,
      {
        model: "not-assigned",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 4
      }
    );
    assert.equal(wrongModel.status, 403);
    assert.equal(wrongModel.body.error.code, "model_not_allowed");

    const wrongKey = await jsonRequest(
      fixture.baseUrl,
      "POST",
      "/v1/chat/completions",
      "tr_consumer_invalid",
      {
        model: "shared-model",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 4
      }
    );
    assert.equal(wrongKey.status, 401);
    assert.equal(wrongKey.body.error.code, "invalid_api_key");

    const exhausted = await jsonRequest(
      fixture.baseUrl,
      "POST",
      "/v1/chat/completions",
      consumerKey,
      {
        model: "shared-model",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 4
      }
    );
    assert.equal(exhausted.status, 429);
    assert.equal(exhausted.body.error.code, "consumer_quota_exceeded");
    assert.equal(providerOneJobs, 1);

    const overview = await fixture.admin("GET", "/admin/v1/overview");
    assert.equal(overview.status, 200);
    assert.equal(overview.body.summary.providersOnline, 2);
    const consumer = overview.body.consumers.find(
      (item) => item.id === consumerCreated.body.consumer.id
    );
    assert.equal(
      consumer.tokensUsed,
      promptReservation + providerOneCompletionTokens
    );
    assert.equal(consumer.tokensReserved, 0);
    assert.equal(consumer.activeRequests, 0);
    assert.equal(overview.body.requests[0].status, "completed");

    if (process.platform !== "win32") {
      assert.equal((await stat(dirname(fixture.databasePath))).mode & 0o777, 0o700);
      for (const path of [
        fixture.databasePath,
        `${fixture.databasePath}-wal`,
        `${fixture.databasePath}-shm`
      ]) {
        if (await exists(path)) {
          assert.equal((await stat(path)).mode & 0o777, 0o600);
        }
      }
    }

    const rotated = await fixture.admin(
      "POST",
      `/admin/v1/consumers/${consumer.id}/rotate-key`
    );
    assert.equal(rotated.status, 200);
    const oldKeyModels = await jsonRequest(
      fixture.baseUrl,
      "GET",
      "/v1/models",
      consumerKey
    );
    assert.equal(oldKeyModels.status, 401);
    const newKeyModels = await jsonRequest(
      fixture.baseUrl,
      "GET",
      "/v1/models",
      rotated.body.apiKey
    );
    assert.equal(newKeyModels.status, 200);
    assert.equal(newKeyModels.body.data[0].id, "shared-model");

    await providerOne.stop();
    providerOne = null;
    await waitFor(() => fixture.admin("GET", "/admin/v1/overview").then(
      (result) => result.body.summary.providersOnline === 1
    ));
    const offlineConsumer = await fixture.admin(
      "POST",
      "/admin/v1/consumers",
      {
        name: "Offline Consumer",
        providerId: providerOneCreated.body.provider.id,
        model: "shared-model",
        tokenLimit: 100,
        maxConcurrent: 1
      }
    );
    const offline = await jsonRequest(
      fixture.baseUrl,
      "POST",
      "/v1/chat/completions",
      offlineConsumer.body.apiKey,
      {
        model: "shared-model",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 4
      }
    );
    assert.equal(offline.status, 503);
    assert.equal(offline.body.error.code, "provider_offline");
    assert.equal(providerTwoJobs, 0);
  } finally {
    await providerOne?.stop();
    await providerTwo?.stop();
    await fixture.close();
  }

  const persistedFiles = [
    fixture.databasePath,
    `${fixture.databasePath}-wal`
  ];
  for (const path of persistedFiles) {
    if (!await exists(path)) {
      continue;
    }
    const bytes = await readFile(path);
    assert.equal(bytes.includes(Buffer.from(consumerKey)), false);
    assert.equal(bytes.includes(Buffer.from(providerOneToken)), false);
    assert.equal(bytes.includes(Buffer.from(providerTwoToken)), false);
  }
  await fixture.cleanup();
});

test("Anthropic Messages compatibility flattens text blocks and emits Claude SSE", {
  timeout: 15_000
}, async () => {
  const fixture = await createFixture();
  let provider;
  let observedJob;
  let providerJobs = 0;
  try {
    const providerCreated = await fixture.admin(
      "POST",
      "/admin/v1/providers",
      { name: "Anthropic Provider", tokenLimit: 100_000, maxConcurrent: 1 }
    );
    const consumerCreated = await fixture.admin(
      "POST",
      "/admin/v1/consumers",
      {
        name: "Claude Code Consumer",
        providerId: providerCreated.body.provider.id,
        model: "shared-model",
        tokenLimit: 100_000,
        maxConcurrent: 1
      }
    );
    provider = createFakeProvider(
      fixture.webSocketUrl,
      providerCreated.body.providerToken,
      async (job) => {
        providerJobs += 1;
        observedJob = job;
        const content = "streamed relay response";
        const promptTokens = estimateRelayPromptTokens(job);
        const completionTokens = estimateTextTokens(content);
        return {
          content,
          finishReason: "stop",
          usage: {
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
            estimated: false
          }
        };
      }
    );
    await provider.start();

    const response = await fetch(`${fixture.baseUrl}/v1/messages?beta=true`, {
      method: "POST",
      headers: {
        accept: "text/event-stream",
        authorization: `Bearer ${consumerCreated.body.apiKey}`,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "claude-code-20250219",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "shared-model",
        max_tokens: 512,
        messages: [{
          role: "user",
          content: [{
            type: "text",
            text: "first ",
            cache_control: { type: "ephemeral" }
          }, {
            type: "text",
            text: "second"
          }]
        }],
        metadata: { user_id: "ignored" },
        output_config: { effort: "high" },
        stream: true,
        system: [{
          type: "text",
          text: "System one.\n",
          cache_control: { type: "ephemeral" }
        }, {
          type: "text",
          text: "System two."
        }],
        thinking: { type: "adaptive" },
        tools: []
      })
    });
    assert.equal(response.status, 200);
    assert.match(
      response.headers.get("content-type"),
      /^text\/event-stream/
    );
    assert.match(response.headers.get("request-id"), /^req_[a-f0-9]{32}$/);
    const events = parseServerSentEvents(await response.text());
    assert.deepEqual(events.map((event) => event.event), [
      "message_start",
      "content_block_start",
      "content_block_delta",
      "content_block_stop",
      "message_delta",
      "message_stop"
    ]);
    assert.deepEqual(events.map((event) => event.data.type), [
      "message_start",
      "content_block_start",
      "content_block_delta",
      "content_block_stop",
      "message_delta",
      "message_stop"
    ]);
    assert.equal(
      events[2].data.delta.text,
      "streamed relay response"
    );
    assert.equal(events[4].data.delta.stop_reason, "end_turn");
    assert.equal(events[5].data.type, "message_stop");
    assert.equal(providerJobs, 1);
    assert.deepEqual(observedJob.messages, [{
      role: "system",
      content: "System one.\nSystem two."
    }, {
      role: "user",
      content: "first second"
    }]);
    assert.equal(observedJob.maxOutputTokens, 512);

    const overview = await fixture.admin("GET", "/admin/v1/overview");
    assert.equal(overview.body.requests[0].status, "completed");
    assert.equal(
      events[0].data.message.usage.input_tokens,
      overview.body.requests[0].promptTokens
    );
    assert.equal(
      events[4].data.usage.output_tokens,
      overview.body.requests[0].completionTokens
    );
    assert.equal(overview.body.requests[0].tokensReserved, undefined);
    assert.equal(
      overview.body.requests[0].reservedTokens,
      observedJob.maxOutputTokens
        + estimateRelayPromptTokens(observedJob)
    );
  } finally {
    await provider?.stop();
    await fixture.close();
    await fixture.cleanup();
  }
});

test("Anthropic Messages supports x-api-key JSON and rejects non-text features", {
  timeout: 15_000
}, async () => {
  const fixture = await createFixture();
  let provider;
  let providerJobs = 0;
  try {
    const providerCreated = await fixture.admin(
      "POST",
      "/admin/v1/providers",
      { name: "Anthropic JSON Provider", tokenLimit: 10_000, maxConcurrent: 1 }
    );
    const consumerCreated = await fixture.admin(
      "POST",
      "/admin/v1/consumers",
      {
        name: "Anthropic JSON Consumer",
        providerId: providerCreated.body.provider.id,
        model: "shared-model",
        tokenLimit: 10_000,
        maxConcurrent: 1
      }
    );
    provider = createFakeProvider(
      fixture.webSocketUrl,
      providerCreated.body.providerToken,
      async (job) => {
        providerJobs += 1;
        const promptTokens = estimateRelayPromptTokens(job);
        return {
          content: "bounded",
          finishReason: "length",
          usage: {
            promptTokens,
            completionTokens: 2,
            totalTokens: promptTokens + 2,
            estimated: false
          }
        };
      }
    );
    await provider.start();

    const successResponse = await fetch(`${fixture.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-api-key": consumerCreated.body.apiKey
      },
      body: JSON.stringify({
        model: "shared-model",
        max_tokens: 32,
        system: "Answer briefly.",
        messages: [{ role: "user", content: "hello" }],
        stream: false
      })
    });
    const successBody = await successResponse.json();
    assert.equal(successResponse.status, 200);
    assert.equal(successBody.type, "message");
    assert.equal(successBody.role, "assistant");
    assert.deepEqual(successBody.content, [{
      type: "text",
      text: "bounded"
    }]);
    assert.equal(successBody.stop_reason, "max_tokens");
    assert.equal(successBody.stop_sequence, null);
    assert.ok(successBody.usage.input_tokens > 0);
    assert.equal(successBody.usage.output_tokens, 2);

    const tools = await anthropicJsonRequest(
      fixture.baseUrl,
      consumerCreated.body.apiKey,
      {
        model: "shared-model",
        max_tokens: 32,
        messages: [{ role: "user", content: "hello" }],
        tools: [{ name: "shell", input_schema: { type: "object" } }]
      }
    );
    assert.equal(tools.status, 400);
    assert.equal(tools.body.type, "error");
    assert.equal(tools.body.error.type, "invalid_request_error");
    assert.match(tools.body.error.message, /Tool definitions/);
    assert.match(tools.body.request_id, /^req_[a-f0-9]{32}$/);

    const image = await anthropicJsonRequest(
      fixture.baseUrl,
      consumerCreated.body.apiKey,
      {
        model: "shared-model",
        max_tokens: 32,
        messages: [{
          role: "user",
          content: [{
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: "AA=="
            }
          }]
        }]
      }
    );
    assert.equal(image.status, 400);
    assert.equal(image.body.type, "error");
    assert.equal(image.body.error.type, "invalid_request_error");
    assert.match(image.body.error.message, /only text blocks are supported/);

    const invalidKey = await anthropicJsonRequest(
      fixture.baseUrl,
      "tr_consumer_invalid",
      {
        model: "shared-model",
        max_tokens: 32,
        messages: [{ role: "user", content: "hello" }]
      }
    );
    assert.equal(invalidKey.status, 401);
    assert.equal(invalidKey.body.type, "error");
    assert.equal(invalidKey.body.error.type, "authentication_error");

    const quotaConsumer = await fixture.admin(
      "POST",
      "/admin/v1/consumers",
      {
        name: "Anthropic Quota Consumer",
        providerId: providerCreated.body.provider.id,
        model: "shared-model",
        tokenLimit: 1,
        maxConcurrent: 1
      }
    );
    const quota = await anthropicJsonRequest(
      fixture.baseUrl,
      quotaConsumer.body.apiKey,
      {
        model: "shared-model",
        max_tokens: 32,
        messages: [{ role: "user", content: "hello" }]
      }
    );
    assert.equal(quota.status, 429);
    assert.equal(quota.body.type, "error");
    assert.equal(quota.body.error.type, "rate_limit_error");
    assert.equal(providerJobs, 1);
  } finally {
    await provider?.stop();
    await fixture.close();
    await fixture.cleanup();
  }
});

test("relay timeout cancels provider work and releases the reservation", {
  timeout: 10_000
}, async () => {
  const fixture = await createFixture({
    requestTimeoutMs: 150,
    leaseMs: 150,
    providerOnlineMs: 2_000
  });
  let provider;
  let observedAbort = false;
  try {
    const providerCreated = await fixture.admin(
      "POST",
      "/admin/v1/providers",
      { name: "Slow Provider", tokenLimit: 1_000, maxConcurrent: 1 }
    );
    const timeoutPromptTokens = estimateRelayPromptTokens({
      model: "slow-model",
      messages: [{ role: "user", content: "wait" }],
      maxOutputTokens: 4
    });
    const consumerCreated = await fixture.admin(
      "POST",
      "/admin/v1/consumers",
      {
        name: "Timeout Consumer",
        providerId: providerCreated.body.provider.id,
        model: "slow-model",
        tokenLimit: 1_000,
        maxConcurrent: 1
      }
    );
    provider = createFakeProvider(
      fixture.webSocketUrl,
      providerCreated.body.providerToken,
      (_job, _target, signal) => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          observedAbort = true;
          reject(signal.reason);
        }, { once: true });
      })
    );
    await provider.start();

    const response = await jsonRequest(
      fixture.baseUrl,
      "POST",
      "/v1/chat/completions",
      consumerCreated.body.apiKey,
      {
        model: "slow-model",
        messages: [{ role: "user", content: "wait" }],
        max_tokens: 4
      }
    );
    assert.equal(response.status, 504);
    assert.equal(response.body.error.code, "request_timeout");
    await waitFor(() => Promise.resolve(observedAbort));

    const overview = await fixture.admin("GET", "/admin/v1/overview");
    const consumer = overview.body.consumers.find(
      (item) => item.id === consumerCreated.body.consumer.id
    );
    assert.equal(consumer.tokensReserved, 0);
    assert.equal(consumer.activeRequests, 0);
    assert.equal(consumer.tokensUsed, timeoutPromptTokens);
    assert.equal(overview.body.requests[0].status, "timed_out");
  } finally {
    await provider?.stop();
    await fixture.close();
    await fixture.cleanup();
  }
});

test("provider protocol mismatch closes the connection immediately", {
  timeout: 5_000
}, async () => {
  const fixture = await createFixture();
  let socket;
  try {
    const providerCreated = await fixture.admin(
      "POST",
      "/admin/v1/providers",
      { name: "Version Mismatch Provider", tokenLimit: 100, maxConcurrent: 1 }
    );
    assert.equal(providerCreated.status, 201);
    socket = new WebSocket(
      `${fixture.webSocketUrl}/provider/v1/connect`,
      {
        headers: {
          authorization: `Bearer ${providerCreated.body.providerToken}`
        }
      }
    );
    const startedAt = Date.now();
    const closed = await new Promise((resolve, reject) => {
      socket.once("open", () => {
        socket.send(JSON.stringify({
          type: "hello",
          protocolVersion: 2,
          sdkVersion: "0.1.0",
          models: ["shared-model"],
          concurrency: 1
        }));
      });
      socket.once("close", (code, reason) => {
        resolve({ code, reason: reason.toString("utf8") });
      });
      socket.once("error", reject);
    });
    assert.equal(closed.code, 4002);
    assert.equal(closed.reason, "invalid provider hello");
    assert.ok(Date.now() - startedAt < 1_000);
  } finally {
    socket?.terminate();
    await fixture.close();
    await fixture.cleanup();
  }
});

test("a second request cannot race past the configured concurrency limit", {
  timeout: 10_000
}, async () => {
  const fixture = await createFixture();
  let provider;
  let releaseExecution;
  let markStarted;
  const started = new Promise((resolve) => {
    markStarted = resolve;
  });
  const executionGate = new Promise((resolve) => {
    releaseExecution = resolve;
  });
  try {
    const providerCreated = await fixture.admin(
      "POST",
      "/admin/v1/providers",
      { name: "Serial Provider", tokenLimit: 10_000, maxConcurrent: 1 }
    );
    const consumerCreated = await fixture.admin(
      "POST",
      "/admin/v1/consumers",
      {
        name: "Serial Consumer",
        providerId: providerCreated.body.provider.id,
        model: "shared-model",
        tokenLimit: 10_000,
        maxConcurrent: 1
      }
    );
    provider = createFakeProvider(
      fixture.webSocketUrl,
      providerCreated.body.providerToken,
      async (job) => {
        markStarted();
        await executionGate;
        const promptTokens = estimateRelayPromptTokens(job);
        return {
          content: "done",
          finishReason: "stop",
          usage: {
            promptTokens,
            completionTokens: 1,
            totalTokens: promptTokens + 1,
            estimated: true
          }
        };
      }
    );
    await provider.start();
    const requestBody = {
      model: "shared-model",
      messages: [{ role: "user", content: "hold" }],
      max_tokens: 4
    };
    const firstRequest = jsonRequest(
      fixture.baseUrl,
      "POST",
      "/v1/chat/completions",
      consumerCreated.body.apiKey,
      requestBody
    );
    await started;

    const secondRequest = await jsonRequest(
      fixture.baseUrl,
      "POST",
      "/v1/chat/completions",
      consumerCreated.body.apiKey,
      requestBody
    );
    assert.equal(secondRequest.status, 429);
    assert.equal(
      secondRequest.body.error.code,
      "provider_concurrency_exceeded"
    );

    releaseExecution();
    const firstResponse = await firstRequest;
    assert.equal(firstResponse.status, 200);
    const overview = await fixture.admin("GET", "/admin/v1/overview");
    const consumer = overview.body.consumers.find(
      (item) => item.id === consumerCreated.body.consumer.id
    );
    assert.equal(consumer.activeRequests, 0);
    assert.equal(consumer.tokensReserved, 0);
    assert.equal(overview.body.requests.length, 1);
  } finally {
    releaseExecution?.();
    await provider?.stop();
    await fixture.close();
    await fixture.cleanup();
  }
});

test("provider SDK launches a configured local CLI for a relayed model", {
  timeout: 10_000
}, async () => {
  const fixture = await createFixture();
  let provider;
  try {
    const providerCreated = await fixture.admin(
      "POST",
      "/admin/v1/providers",
      { name: "CLI Provider", tokenLimit: 10_000, maxConcurrent: 1 }
    );
    const consumerCreated = await fixture.admin(
      "POST",
      "/admin/v1/consumers",
      {
        name: "CLI Consumer",
        providerId: providerCreated.body.provider.id,
        model: "custom-cli-model",
        tokenLimit: 10_000,
        maxConcurrent: 1
      }
    );
    const childScript = [
      "let input = '';",
      "process.stdin.setEncoding('utf8');",
      "process.stdin.on('data', (chunk) => { input += chunk; });",
      "process.stdin.on('end', () => {",
      "if (!input.includes('<message role=\"user\">')) process.exit(7);",
      "process.stdout.write('custom-cli-ok');",
      "});"
    ].join("");
    provider = new ProviderClient({
      relayUrl: `${fixture.webSocketUrl}/provider/v1/connect`,
      providerToken: providerCreated.body.providerToken,
      concurrency: 1,
      connectTimeoutMs: 2_000,
      models: {
        "custom-cli-model": {
          adapter: "custom",
          command: process.execPath,
          args: ["-e", childScript],
          outputFormat: "text"
        }
      }
    }, { logger: silentLogger });
    await provider.start();

    const response = await jsonRequest(
      fixture.baseUrl,
      "POST",
      "/v1/chat/completions",
      consumerCreated.body.apiKey,
      {
        model: "custom-cli-model",
        messages: [{ role: "user", content: "run the local CLI" }],
        max_tokens: 32
      }
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.choices[0].message.content, "custom-cli-ok");
    assert.ok(response.body.usage.prompt_tokens > 0);
    assert.ok(response.body.usage.completion_tokens > 0);
  } finally {
    await provider?.stop();
    await fixture.close();
    await fixture.cleanup();
  }
});

async function createFixture(overrides = {}) {
  const directory = await mkdtemp(join(tmpdir(), "token-relay-e2e-"));
  const databasePath = join(directory, "relay.db");
  const app = await createRelayServer({
    host: "127.0.0.1",
    port: 0,
    databasePath,
    adminToken: ADMIN_TOKEN,
    requestTimeoutMs: 2_000,
    leaseMs: 2_000,
    providerOnlineMs: 2_000,
    ...overrides
  });
  await app.listen();
  return {
    app,
    databasePath,
    baseUrl: app.url,
    webSocketUrl: app.url.replace(/^http/, "ws"),
    admin(method, path, body) {
      return jsonRequest(app.url, method, path, ADMIN_TOKEN, body);
    },
    async close() {
      await app.close();
    },
    async cleanup() {
      await rm(directory, { recursive: true, force: true });
    }
  };
}

function createFakeProvider(relayBaseUrl, providerToken, execute) {
  return new ProviderClient({
    relayUrl: `${relayBaseUrl}/provider/v1/connect`,
    providerToken,
    concurrency: 1,
    connectTimeoutMs: 2_000,
    reconnectInitialMs: 100,
    reconnectMaxMs: 500,
    models: {
      "shared-model": {
        adapter: "custom",
        command: process.execPath
      },
      "slow-model": {
        adapter: "custom",
        command: process.execPath
      }
    }
  }, {
    executor: { execute },
    logger: silentLogger
  });
}

async function jsonRequest(baseUrl, method, path, token, body) {
  const headers = {
    accept: "application/json",
    authorization: `Bearer ${token}`
  };
  if (body !== undefined) {
    headers["content-type"] = "application/json";
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    body: text ? JSON.parse(text) : null
  };
}

async function anthropicJsonRequest(baseUrl, token, body) {
  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    body: text ? JSON.parse(text) : null
  };
}

function parseServerSentEvents(value) {
  return value.trim().split("\n\n").map((frame) => {
    const lines = frame.split("\n");
    const event = lines.find((line) => line.startsWith("event: "))?.slice(7);
    const data = lines.find((line) => line.startsWith("data: "))?.slice(6);
    assert.ok(event, `SSE frame is missing an event: ${frame}`);
    assert.ok(data, `SSE frame is missing data: ${frame}`);
    return {
      event,
      data: JSON.parse(data)
    };
  });
}

async function waitFor(check, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(`Condition was not met within ${timeoutMs} ms.`);
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
