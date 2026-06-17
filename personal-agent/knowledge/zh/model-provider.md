# Model Provider

## 我们实现了什么

Personal Agent 现在有了 Model Provider 边界，并包含三个实现：

- `bootstrap`：没有模型 API key 时使用的确定性本地 provider。
- `deepseek`：默认真实 provider，使用 DeepSeek 的 OpenAI-compatible API。
- `openai-compatible`：面向 OpenAI-compatible chat completion API 的 HTTP provider。

CLI 会先用 `dotenv` 加载 `personal-agent/.env`，然后再选择 provider。`.env` 已被 git 忽略，用来保存 `DEEPSEEK_API_KEY` 这类本地密钥。

随后 provider selection 会读取环境变量。如果存在 `DEEPSEEK_API_KEY`，就默认使用 `deepseek` 和 `deepseek-v4-flash`。如果只有 `OPENAI_API_KEY`，就使用 `openai-compatible`。如果没有任何模型 key，就回退到 `bootstrap`。

## 在本项目中如何工作

runner 会向 `ModelProvider` 请求下一个 Agent Step。provider 返回普通数据，核心 loop 再用 `parseAgentStep` 校验。

runner 也会通过 `ModelProviderInput.projectMemory` 传入当前 Project Memory。这样长期偏好和项目约定会对每一轮模型调用可见，同时不会把 runner 绑定到某个 provider-native memory 功能。

`deepseek` 会向以下地址发送 chat completion 请求：

```text
${DEEPSEEK_BASE_URL || "https://api.deepseek.com"}/chat/completions
```

DeepSeek 配置项：

- `DEEPSEEK_API_KEY`：DeepSeek 调用所需的 secret API key。
- `DEEPSEEK_BASE_URL`：可选 base URL，默认 `https://api.deepseek.com`。
- `DEEPSEEK_MODEL`：可选模型名，默认 `deepseek-v4-flash`。

OpenAI-compatible fallback 配置项：

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`

provider 会要求模型只返回一个 JSON Agent Step，并在 API 支持时请求 JSON object 输出。

OpenAI-compatible adapter 也会在把返回对象交给 runner 之前做校验和归一化。例如，一次真实 DeepSeek smoke test 返回的 plan 使用了 `title` 加 `description`，而不是本项目内部协议要求的 `summary` 字段。adapter 现在会把这种常见形态转换成 `{ type: "plan", summary, steps }`，然后再执行和 core loop 相同的 `parseAgentStep` 校验。

## 其他常见方案

**Provider SDK first**：
直接在 runner 中使用官方 provider SDK。这能减少 HTTP 样板代码，但也容易把 provider-specific 抽象泄漏到 agent loop。

**Native tool calling**：
让 provider 的 tool-call 格式驱动 loop。这能获得更强的 provider 集成，但会降低 Personal Agent 的可迁移性，也不利于学习 provider-neutral agent 机制。

**Framework runtime**：
让 agent 框架接管模型 loop。这能更快获得更多功能，但会把 Model Provider 边界隐藏在框架概念后面。

## 为什么选择当前方案

当前设计把 provider 细节放在一个小接口后面。Personal Agent 学习和记录的是 Agent Step，而不是 provider-native tool call。

## 优势

- DeepSeek 已经是默认真实模型路径。
- 本地凭据可以放在被忽略的 `.env` 文件里，而不是写进源码。
- 没有凭据时 CLI 仍可通过 `bootstrap` 工作。
- 真实模型集成可以通过 fetch injection 测试。
- provider-native 细节不会进入 runner。
- OpenAI-compatible endpoint 可以通过环境变量切换。
- 常见模型输出漂移会在 provider 边界被修复，不会泄漏进 runner。
- Project Memory 会通过 provider-neutral input contract 对模型可见。

## 劣势

- provider 目前只实现了最小 chat completions 形态。
- 错误处理还比较基础。
- 暂不支持 streaming。
- 输出修复目前只覆盖一个已知的 plan 字段漂移。
- 暂无模型辅助输出修复能力。

## 评测

当前测试验证：

- `dotenv` 会从本地 env 文件加载 `DEEPSEEK_API_KEY`，且不会覆盖显式 shell 环境变量。
- fake OpenAI-compatible 响应会变成 Agent Step。
- OpenAI-compatible request 会在 user payload 中包含 Project Memory。
- 使用常见 `title`/`description` 字段的 plan 响应会被归一化成内部 `summary` schema。
- HTTP 请求使用了配置的 base URL、model 和 bearer token。
- DeepSeek 默认使用 `https://api.deepseek.com` 和 `deepseek-v4-flash`。
- provider selection 在存在 `DEEPSEEK_API_KEY` 时优先选择 DeepSeek。
- 没有 key 时 provider selection 会回退到 `bootstrap`。
- CLI 在没有网络凭据时仍能完成 bootstrap Task Run。
- 当 `.env` 中存在有效 key 时，真实 DeepSeek smoke test 可以完成一个本地 Task Run。

后续评测应增加：

- 由真实凭据控制的 smoke test，
- invalid JSON recovery 测试，
- provider error classification，
- model output repair 行为。

## 已查看资料

- [DeepSeek pricing and quick start](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)
