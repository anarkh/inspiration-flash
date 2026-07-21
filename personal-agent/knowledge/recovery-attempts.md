# Recovery Attempts

## What We Implemented

The runner can now recover from malformed provider output. If the Model Provider returns data that fails `parseAgentStep`, the Task Run records a `recovery` event, sends that event back to the provider, and retries the same turn.

Recovery is bounded to two attempts. If the provider still cannot produce a valid Agent Step, the runner fails with an explicit error instead of looping forever.

## How It Works Here

`src/agent/runner.ts` requests a raw step from the provider, then validates it with `parseAgentStep`. Parse failures are treated as schema repair opportunities, not as completed turns.

The recovery flow is:

- call `ModelProvider.nextStep`;
- validate the raw value with `parseAgentStep`;
- on validation failure, append `{ type: "recovery", reason, attempt }` to `events.jsonl`;
- pass the same recovery event in `ModelProviderInput.events`;
- retry the same `turn` number;
- fail after `maxRecoveryAttempts`.

Recovery events are visible to the provider and durable in the event log, but they are not Agent Steps. `resume` replays them as provider context, while turn counting excludes them so a recovery attempt does not move the task forward.

For manual learning and demos, the CLI can force exactly one malformed provider response with `PERSONAL_AGENT_DEBUG_RECOVERY=1`. This switch is opt-in and development-only: normal runs do not inject invalid output, so a healthy bootstrap or real provider path will show only normal `plan` and `finish` steps.

## Other Common Approaches

**Hard fail**:
Stop immediately when model output does not match the schema. This is simple and safe, but weak for real model use because occasional schema drift is common.

**Provider-bound structured output**:
Use provider-native JSON schema or tool-calling enforcement. This is stronger when the provider supports it, but it can make the runner less portable across providers.

**Prompt-only repair**:
Ask the model in the system prompt to follow the schema and rely on the next turn to improve. This is easy, but it does not create durable diagnostics or explicit retry limits.

**External repair parser**:
Run a separate parser or model call to transform malformed output into the target schema. This can improve success rate, but adds complexity and can hide the original provider mistake.

## Why This Approach

The Personal Agent is still a learning-oriented first-party loop. A small recovery event makes schema repair explicit: the Owner can inspect the reason, the provider can correct itself, and the runner stays provider-neutral.

The bounded retry count protects the CLI from infinite loops while still handling normal model drift.

## Advantages

- Invalid Agent Steps no longer crash the first malformed response.
- Recovery reasons are visible in `events.jsonl`.
- The same event stream can be replayed during `resume`.
- The recovery path remains independent of DeepSeek, OpenAI-compatible APIs, or future providers.
- The retry limit keeps failure behavior predictable.

## Disadvantages

- Recovery currently handles parse failures only; provider transport errors still fail directly.
- The provider receives only the validation error, not a full schema explanation.
- The retry count is fixed in code instead of configurable.
- Repeated malformed output still fails the whole Task Run.
- The debug switch intentionally creates one bad provider response, so it should be used only for local verification.

## Evaluation

Current tests verify:

- a malformed `plan` step records a `recovery` event;
- the provider sees the recovery reason on the retry;
- the retry uses the same turn number;
- a valid repaired step continues the run to completion;
- repeated malformed output stops after two recovery attempts;
- only two recovery events are written for the bounded failure case.
- the CLI can display the recovery path when `PERSONAL_AGENT_DEBUG_RECOVERY=1` is set.

Useful manual inspection command:

```bash
tmpdir=$(mktemp -d /tmp/personal-agent-recovery-XXXXXX)
cd "$tmpdir"
env PERSONAL_AGENT_SKIP_DOTENV=1 DEEPSEEK_API_KEY= OPENAI_API_KEY= PERSONAL_AGENT_DEBUG_RECOVERY=1 a-agent run "帮我总结当前目录"
tail -n 20 .personal-agent/runs/$(cat .personal-agent/runs/latest)/events.jsonl
```
