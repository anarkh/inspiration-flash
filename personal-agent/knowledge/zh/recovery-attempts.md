# 恢复重试

## 我们实现了什么

runner 现在可以从格式错误的 provider 输出中恢复。如果 Model Provider 返回的数据没有通过 `parseAgentStep`，Task Run 会记录一个 `recovery` 事件，把这个事件回传给 provider，并在同一个 turn 上重试。

恢复次数限制为两次。如果 provider 仍然无法生成合法 Agent Step，runner 会抛出明确错误，而不是无限循环。

## 在本项目中如何工作

`src/agent/runner.ts` 会先向 provider 请求 raw step，再用 `parseAgentStep` 校验它。校验失败会被视为一次 schema 修复机会，而不是一个已经完成的 turn。

恢复流程是：

- 调用 `ModelProvider.nextStep`；
- 用 `parseAgentStep` 校验 raw value；
- 校验失败时，把 `{ type: "recovery", reason, attempt }` 追加到 `events.jsonl`；
- 在 `ModelProviderInput.events` 中把同一个 recovery event 传给 provider；
- 使用相同 `turn` number 重试；
- 超过 `maxRecoveryAttempts` 后失败。

recovery event 对 provider 可见，也会持久化到事件日志，但它不是 Agent Step。`resume` 会把它作为 provider context 回放，同时 turn 计数会排除它，因此一次恢复尝试不会推动任务进入下一轮。

为了便于手动学习和演示，CLI 可以通过 `PERSONAL_AGENT_DEBUG_RECOVERY=1` 强制制造一次格式错误的 provider 响应。这个开关是显式 opt-in 的本地开发开关：正常 run 不会注入错误输出，所以健康的 bootstrap 或真实 provider 路径只会展示正常的 `plan` 和 `finish` steps。

## 其他常见方案

**Hard fail**：
模型输出不符合 schema 时立刻停止。这种方式简单、安全，但真实模型偶尔会发生 schema drift，容错性较弱。

**Provider-bound structured output**：
使用 provider-native JSON schema 或 tool-calling 约束。当 provider 支持时，这种方式更强，但会让 runner 更依赖特定 provider。

**Prompt-only repair**：
只在 system prompt 中要求模型遵守 schema，并希望下一轮表现更好。这很容易实现，但不会留下持久诊断，也没有显式重试上限。

**External repair parser**：
使用单独 parser 或额外模型调用，把错误输出转换成目标 schema。这可能提升成功率，但会增加复杂度，并可能隐藏原始 provider 错误。

## 为什么选择当前方案

Personal Agent 仍然是一个面向学习的 first-party loop。小型 recovery event 会让 schema 修复过程显式可见：Owner 能检查失败原因，provider 能据此自我修正，runner 也保持 provider-neutral。

固定的重试上限可以避免 CLI 无限循环，同时处理常见模型输出漂移。

## 优势

- 第一次 Agent Step 格式错误时不会直接崩溃。
- 恢复原因会写入 `events.jsonl`，方便检查。
- 同一个事件流可以在 `resume` 时回放。
- 恢复路径不依赖 DeepSeek、OpenAI-compatible API 或未来 provider。
- 重试上限让失败行为可预测。

## 劣势

- 当前只恢复 parse failure；provider 网络或 HTTP 错误仍会直接失败。
- provider 目前只收到校验错误，还没有收到完整 schema 说明。
- 重试次数目前写在代码里，不是配置项。
- 如果 provider 一直返回错误格式，整个 Task Run 仍会失败。
- debug 开关会故意制造一次坏 provider 响应，因此只应该用于本地验证。

## 评测

当前测试验证：

- 错误格式的 `plan` step 会记录 `recovery` event；
- provider 在重试时能看到恢复原因；
- 重试仍使用相同 turn number；
- 修复后的合法 step 可以继续执行到 completed；
- 持续错误输出会在两次恢复尝试后停止；
- 有界失败场景只会写入两个 recovery events。
- 设置 `PERSONAL_AGENT_DEBUG_RECOVERY=1` 时，CLI 可以展示 recovery 路径。

可用于人工检查的命令：

```bash
tmpdir=$(mktemp -d /tmp/personal-agent-recovery-XXXXXX)
cd "$tmpdir"
env PERSONAL_AGENT_SKIP_DOTENV=1 DEEPSEEK_API_KEY= OPENAI_API_KEY= PERSONAL_AGENT_DEBUG_RECOVERY=1 a-agent run "帮我总结当前目录"
tail -n 20 .personal-agent/runs/$(cat .personal-agent/runs/latest)/events.jsonl
```
