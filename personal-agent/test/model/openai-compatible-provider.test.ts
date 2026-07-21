import assert from "node:assert/strict";
import test from "node:test";

import { createConfiguredProvider } from "../../src/model/configured-provider.ts";
import { createDeepSeekProvider } from "../../src/model/deepseek-provider.ts";
import { createOpenAICompatibleProvider } from "../../src/model/openai-compatible-provider.ts";

test("OpenAI-compatible provider parses a JSON Agent Step response", async () => {
  const requests: Array<{ url: string; init: { headers: Record<string, string>; body: string } }> = [];
  const provider = createOpenAICompatibleProvider({
    apiKey: "test-key",
    baseUrl: "https://example.test/v1",
    model: "test-model",
    fetch: async (url, init) => {
      requests.push({ url, init });
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({ type: "message", content: "hello from model" })
                }
              }
            ]
          });
        }
      };
    }
  });

  const step = await provider.nextStep({
    goal: "say hello",
    mode: "advisory",
    interaction: "task",
    successCheck: "responds",
    turn: 1,
    events: [],
    projectMemory: "# Project Memory\n\n## Preferences\n\n- Owner prefers concise CLI output.\n",
    skillPacks: "# Relevant Skill Packs\n\n## docs-helper\n\n- path: .agents/skills/docs-helper/SKILL.md\n"
  });

  assert.deepEqual(step, { type: "message", content: "hello from model" });
  assert.equal(requests[0]?.url, "https://example.test/v1/chat/completions");
  assert.equal(requests[0]?.init.headers.authorization, "Bearer test-key");
  assert.match(requests[0]?.init.body ?? "", /test-model/);
  assert.match(requests[0]?.init.body ?? "", /Owner prefers concise CLI output/);
  assert.match(requests[0]?.init.body ?? "", /docs-helper/);
});

test("OpenAI-compatible provider normalizes common model plan fields", async () => {
  const provider = createOpenAICompatibleProvider({
    apiKey: "test-key",
    fetch: async () => ({
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  type: "plan",
                  title: "Summarize current directory",
                  description: "List files and create a summary.",
                  steps: ["List files", "Write summary"]
                })
              }
            }
          ]
        });
      }
    })
  });

  const step = await provider.nextStep({
    goal: "summarize",
    mode: "advisory",
    interaction: "task",
    successCheck: "returns a plan",
    turn: 1,
    events: []
  });

  assert.deepEqual(step, {
    type: "plan",
    summary: "Summarize current directory: List files and create a summary.",
    steps: ["List files", "Write summary"]
  });
});

test("configured provider falls back to bootstrap when no API key is available", () => {
  assert.equal(createConfiguredProvider({}).name, "bootstrap");
  assert.equal(createConfiguredProvider({ OPENAI_API_KEY: "test-key" }).name, "openai-compatible");
});

test("configured provider prefers DeepSeek when DEEPSEEK_API_KEY is available", () => {
  assert.equal(createConfiguredProvider({ DEEPSEEK_API_KEY: "test-key" }).name, "deepseek");
});

test("DeepSeek provider uses the documented base URL and default model", async () => {
  const requests: Array<{ url: string; init: { headers: Record<string, string>; body: string } }> = [];
  const provider = createDeepSeekProvider({
    apiKey: "test-key",
    fetch: async (url, init) => {
      requests.push({ url, init });
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({
            choices: [{ message: { content: JSON.stringify({ type: "finish", report: "ok" }) } }]
          });
        }
      };
    }
  });

  await provider.nextStep({
    goal: "finish",
    mode: "advisory",
    interaction: "task",
    successCheck: "returns finish",
    turn: 1,
    events: []
  });

  const body = JSON.parse(requests[0]?.init.body ?? "{}") as { model?: string };

  assert.equal(requests[0]?.url, "https://api.deepseek.com/chat/completions");
  assert.equal(requests[0]?.init.headers.authorization, "Bearer test-key");
  assert.equal(body.model, "deepseek-v4-flash");
});

test("OpenAI-compatible provider gives chat-specific lifecycle instructions", async () => {
  const requests: Array<{ init: { body: string } }> = [];
  const provider = createOpenAICompatibleProvider({
    apiKey: "test-key",
    fetch: async (_url, init) => {
      requests.push({ init });
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({
            choices: [{ message: { content: JSON.stringify({ type: "message", content: "你好" }) } }]
          });
        }
      };
    }
  });

  await provider.nextStep({
    goal: "Chat conversation: 你好",
    mode: "advisory",
    interaction: "chat",
    successCheck: "reply",
    turn: 1,
    events: [{ type: "owner_message", content: "你好" }]
  });

  const body = JSON.parse(requests[0]?.init.body ?? "{}") as {
    messages?: Array<{ role?: string; content?: string }>;
  };
  const systemPrompt = body.messages?.find((message) => message.role === "system")?.content ?? "";
  const userPayload = body.messages?.find((message) => message.role === "user")?.content ?? "";

  assert.match(systemPrompt, /Never return finish in chat interaction/);
  assert.match(systemPrompt, /Answer the latest owner_message/);
  assert.match(userPayload, /"interaction":"chat"/);
});
