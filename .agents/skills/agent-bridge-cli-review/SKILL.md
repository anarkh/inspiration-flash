---
name: agent-bridge-cli-review
description: Use this skill whenever the user asks to use a supported Agent Bridge consumer CLI to review the current conversation, technical plan, or generated code, or to send a non-review/chat message through Agent Bridge. Trigger on phrases like “aiden review”, “codex review”, “claude review”, “claude code review”, “用 aiden/codex/claude code 评审”, “让 aiden/codex 看一下”, “调用我们的 cli send 做 review”, “非 review 模式”, “chat 模式”, or “agent-bridge send --mode chat”. It summarizes the current conversation and code changes for review mode, or builds a concise direct question for chat mode, then runs `agent-bridge send` to the requested CLI using the current workspace and session when available.
metadata:
  requires:
    bins: ["agent-bridge"]
---

# Agent Bridge CLI Review

Use this skill to ask another supported CLI agent to review the current work through Agent Bridge direct send, or to send a plain non-review chat message to that CLI.

## Trigger Parsing

Map the requested reviewer to `agent-bridge send --to`:

- `aiden`, `艾登`, `艾扥` -> `aiden`
- `codex` -> `codex`
- `claude`, `claude code` -> `claude`

If the user names multiple reviewers, run them one at a time and compare results. If no reviewer is named, default to `aiden`.

Classify the requested mode before writing the message:

- **Review mode**: use the default `agent-bridge send` behavior when the user asks for code review, plan review, risk checking, validation, or another explicit assessment.
- **Chat mode**: add `--mode chat` when the user asks for a normal answer, brainstorming, explanation, or direct CLI collaboration without a verdict/review. Use this for explicit phrases such as `非 review 模式`, `non-review`, `chat mode`, or `--mode chat`.

## Defaults

- **Workspace**: use the current conversation workspace. Prefer the active `environment_context.cwd`; if inside a git repo, use `git rev-parse --show-toplevel` only when that better represents the user's project root.
- **Session id**: use the current conversation/session id when it is visible in the conversation or environment. Do not invent one. If it is unavailable, omit `--session-id` and mention that it was not observable.
- **Producer**: default to `codex` unless the current producer is explicitly known to be another supported CLI.
- **Mode**: default to review mode. Pass `--mode chat` only for non-review/chat requests. Do not pass invalid or empty `--mode`; the CLI rejects anything except `review` or `chat`.
- **Raw output**: do not pass `--raw-output` unless debugging parser/terminal behavior.

## Build The Review Message

Use this section only for review mode.

Create a concise review request for the target CLI. Include only relevant context:

1. User's original goal and latest instruction.
2. Technical plan or architecture decisions discussed in this conversation.
3. Code generated or changed in this conversation:
   - important files and functions,
   - behavior changes,
   - known assumptions.
4. Current verification:
   - tests/build commands run and results,
   - errors or warnings still open.
5. Git context when useful:
   - `git status --short`,
   - focused `git diff --stat`,
   - focused diffs for changed files caused by this conversation.

Do not dump unrelated dirty worktree changes. If the worktree includes changes that were present before the current task, label them as pre-existing or omit them.

Use this message shape:

```text
Please review the current conversation's technical plan and generated code.

Reviewer target: <aiden|codex|claude>
Workspace: <workspace>
Session: <session id or "unavailable">

User goal:
<summary>

Implemented plan / current proposal:
<summary>

Changed code from this conversation:
<files and concise details>

Verification:
<commands and results>

Known assumptions or open risks:
<items or "none known">

Please identify concrete bugs, missing validation, unsafe behavior, or design issues.
```

Agent Bridge's direct prompt already asks the consumer to return strict JSON; do not add conflicting output-format instructions.

## Build The Chat Message

Use this section only for chat mode.

Create a compact direct message that asks the target CLI for the user's requested help. Include only context needed to answer:

1. The user's direct question or instruction.
2. Relevant workspace/session context.
3. Any focused file paths, command output, or constraints needed for the answer.
4. Whether the target CLI should avoid edits or may suggest commands only.

Do not ask the target CLI to return verdict JSON in chat mode. Agent Bridge will still print a `BridgeResponse` JSON wrapper; the plain answer is in `result.summary`, and `result.verdict` should normally be `pass` unless the CLI hit an error.

## Run Agent Bridge

Prefer a PATH-installed command. For review mode:

```bash
agent-bridge send --to <target> --message "$REVIEW_MESSAGE" --workspace "$WORKSPACE" --session-id "$SESSION_ID"
```

For chat mode:

```bash
agent-bridge send --to <target> --mode chat --message "$CHAT_MESSAGE" --workspace "$WORKSPACE" --session-id "$SESSION_ID"
```

If `agent-bridge` is not on PATH, use this repository's built CLI when present:

```bash
node /Users/bytedance/git/inspiration-flash/agent-bridge/dist/cli/index.js send --to <target> --message "$REVIEW_MESSAGE" --workspace "$WORKSPACE" --session-id "$SESSION_ID"
node /Users/bytedance/git/inspiration-flash/agent-bridge/dist/cli/index.js send --to <target> --mode chat --message "$CHAT_MESSAGE" --workspace "$WORKSPACE" --session-id "$SESSION_ID"
```

When `SESSION_ID` is unavailable, omit the `--session-id "$SESSION_ID"` pair. For long messages, write the review or chat request to a temp file and use `--file <path>` instead of `--message`.

## Consume The Result

After the command returns:

1. Parse the `BridgeResponse` JSON.
2. In review mode, treat `result.verdict` as the review signal:
   - `pass`: report the pass and any useful notes.
   - `fail`: show the findings, then decide whether to implement fixes or ask the user.
   - `uncertain`: explain what was insufficient and decide whether to gather more context or rerun.
3. In chat mode, report `result.summary` as the target CLI's plain answer. If `result.verdict` is `uncertain`, explain the error or missing context instead of treating it as a successful chat answer.
4. Bring returned review findings or chat answers into the current model's own reasoning. Do not blindly accept the external CLI's answer when it conflicts with local evidence.
5. If the command times out, check `agent-bridge status`; if a late result is available, use it.

## Safety

- Running this skill is usually read-only. Do not modify files unless the user asked for fixes or the returned review/chat response requires a clear correction and the task context permits implementation.
- Never send secrets, private tokens, or unrelated personal data in the review message.
- Keep the summary compact enough for a direct CLI message; include paths and focused diffs rather than enormous raw logs.
