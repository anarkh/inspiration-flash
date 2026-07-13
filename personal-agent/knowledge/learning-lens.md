# Learning Lens

## What We Implemented

Learning Lens is an opt-in CLI mode that prints short teaching notes while a Task Run executes.

Supported commands:

- `a-agent run --learn "<task>"`
- `a-agent start --learn`
- `a-agent resume --learn`

Normal commands keep the previous compact `[agent]` progress logs. Learning notes appear only when the Owner explicitly passes `--learn`.

## How It Works Here

The CLI parses `--learn` and passes `learningLens: true` into `runTask` or `resumeLatestTask`.

`src/agent/runner.ts` then emits `[learn]` lines through the same `logStep` callback used by execution logging. The notes are not written as durable events; they are terminal teaching aids. Durable learning artifacts remain the Knowledge Base, Task Reports, Task Evaluations, Run Exports, and reviewable Memory Suggestions.

Current Learning Lens topics:

- `planning`: a `plan` step makes the model's intended path visible before action.
- `tool use`: a `tool` step separates model intent from workspace execution.
- `observation`: a tool result becomes context for the next model turn.
- `confirmation`: Confirmation Gates pause high-impact actions before workspace changes.
- `reflection`: `reflect` creates a reviewable memory candidate, not durable memory yet.
- `checkpoint`: checkpoint files save visible state for resume.
- `recovery`: invalid model output becomes visible feedback before retry.
- `evaluation`: Task Evaluation scores visible report and trace artifacts.

## Other Common Approaches

**Always-on teaching mode**:
Print explanations during every run. This helps beginners, but becomes noisy for routine usage.

**Separate tutorial command**:
Build a `tutorial` or `learn` command that explains concepts outside real tasks. This is cleaner for onboarding, but weaker for learning from actual agent behavior.

**Framework tracing UI**:
Use LangSmith, OpenAI tracing, or a similar UI to inspect runs. This gives richer visualization, but hides the first-party loop and adds external dependencies.

**Documentation only**:
Keep explanations only in Markdown. This stays quiet, but misses the moment when the concept appears during execution.

## Why This Approach

The Owner wants to learn while using the Personal Agent. An explicit `--learn` flag keeps normal runs concise while making concepts visible during real execution.

## Advantages

- No noise unless the Owner opts in.
- Uses the existing runner and logging path.
- Teaches concepts exactly when they appear.
- Works with bootstrap, DeepSeek, and future providers.
- Keeps durable state clean because learning notes are not Task Run events.

## Disadvantages

- The notes are terminal-only and are not preserved in `events.jsonl`.
- The first messages are fixed strings, not personalized explanations.
- The first slice does not include a rich tutorial progression or diagrams.
- Repeated `--learn` runs may become repetitive once the concepts are familiar.

## Evaluation

Current tests verify:

- CLI help advertises `--learn` for `run`, `start`, and `resume`.
- `a-agent run --learn "<task>"` emits `[learn] planning`, `[learn] checkpoint`, and `[learn] evaluation` notes.
- Existing runs without `--learn` keep the previous compact output.

Manual check:

```bash
tmpdir=$(mktemp -d /tmp/personal-agent-learn-XXXXXX)
cd "$tmpdir"
env PERSONAL_AGENT_SKIP_DOTENV=1 DEEPSEEK_API_KEY= OPENAI_API_KEY= a-agent run --learn "帮我总结当前目录"
```
