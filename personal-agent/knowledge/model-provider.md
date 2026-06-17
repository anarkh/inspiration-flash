# Model Provider

## What We Implemented

The Personal Agent now has a Model Provider boundary with three implementations:

- `bootstrap`: deterministic local provider used when no model API key is configured.
- `deepseek`: default real provider, using the DeepSeek OpenAI-compatible API.
- `openai-compatible`: HTTP provider for OpenAI-compatible chat completion APIs.

The CLI loads `personal-agent/.env` with `dotenv` before selecting a provider. The `.env` file is ignored by git and is the local place to keep secrets such as `DEEPSEEK_API_KEY`.

Provider selection then uses environment variables. If `DEEPSEEK_API_KEY` is present, it uses `deepseek` with `deepseek-v4-flash` by default. If only `OPENAI_API_KEY` is present, it uses `openai-compatible`. If no model key is available, it falls back to `bootstrap`.

## How It Works Here

The runner asks a `ModelProvider` for the next Agent Step. The provider returns plain data, and the core loop validates it with `parseAgentStep`.

The runner also passes the current Project Memory through `ModelProviderInput.projectMemory`. This makes durable preferences and project conventions visible to every model turn without coupling the runner to one provider's native memory feature.

`deepseek` sends a chat completion request to:

```text
${DEEPSEEK_BASE_URL || "https://api.deepseek.com"}/chat/completions
```

DeepSeek configuration:

- `DEEPSEEK_API_KEY`: secret API key, required for DeepSeek calls.
- `DEEPSEEK_BASE_URL`: optional base URL, defaulting to `https://api.deepseek.com`.
- `DEEPSEEK_MODEL`: optional model name, defaulting to `deepseek-v4-flash`.

OpenAI-compatible fallback configuration:

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`

The provider asks the model to return exactly one JSON Agent Step and requests JSON object output when the API supports it.

The OpenAI-compatible adapter also validates and normalizes the returned object before handing it to the runner. For example, a real DeepSeek smoke test returned a plan as `title` plus `description` instead of the project-owned `summary` field. The adapter now converts that common shape into `{ type: "plan", summary, steps }` and then runs the same `parseAgentStep` validation used by the core loop.

## Other Common Approaches

**Provider SDK first**:
Use the official provider SDK directly in the runner. This can reduce HTTP boilerplate, but it can also leak provider-specific abstractions into the agent loop.

**Native tool calling**:
Let the provider's tool-call format drive the loop. This gives stronger provider integration, but makes the Personal Agent less portable and less useful for learning provider-neutral agent mechanics.

**Framework runtime**:
Let an agent framework own the model loop. This gives more features sooner, but hides the Model Provider boundary behind framework concepts.

## Why This Approach

The current design keeps provider details behind a small interface. The Personal Agent learns and records Agent Steps, not provider-native tool calls.

## Advantages

- DeepSeek is available as the default real model path.
- Local credentials can live in ignored `.env` files instead of source code.
- The CLI still works without credentials through `bootstrap`.
- Real model integration can be tested with fetch injection.
- Provider-native details stay outside the runner.
- OpenAI-compatible endpoints can be swapped through environment variables.
- Common model output drift is repaired at the provider boundary instead of leaking into the runner.
- Project Memory is visible through the provider-neutral input contract.

## Disadvantages

- The provider currently uses a minimal chat completions shape.
- Error handling is basic.
- There is no streaming support yet.
- Output repair currently covers only a small known plan-field drift.
- There is no model-assisted output repair yet.

## Evaluation

Current tests verify:

- `dotenv` loads `DEEPSEEK_API_KEY` from a local env file without overriding an explicit shell value.
- A fake OpenAI-compatible response becomes an Agent Step.
- OpenAI-compatible requests include Project Memory in the user payload.
- Plan responses using common `title`/`description` fields are normalized into the internal `summary` schema.
- The HTTP request uses the configured base URL, model, and bearer token.
- DeepSeek defaults to `https://api.deepseek.com` and `deepseek-v4-flash`.
- Provider selection prefers `DEEPSEEK_API_KEY` when it is present.
- Provider selection falls back to `bootstrap` when no key exists.
- The CLI still completes a bootstrap Task Run without network credentials.
- A real DeepSeek smoke test can complete a local Task Run when `.env` contains a valid key.

Future evaluation should add:

- a smoke test gated by real credentials,
- invalid JSON recovery tests,
- provider error classification,
- model output repair behavior.

## Source Checked

- [DeepSeek pricing and quick start](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)
