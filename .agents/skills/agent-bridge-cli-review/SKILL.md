---
name: agent-bridge-cli-review
description: Use this skill whenever the user asks to use a supported Agent Bridge consumer CLI to review the current conversation, technical plan, or generated code, including phrases like “aiden review”, “codex review”, “claude review”, “claude code review”, “用 aiden/codex/claude code 评审”, “让 aiden/codex 看一下”, or “调用我们的 cli send 做 review”. It summarizes the current conversation and code changes, then runs `agent-bridge send` to the requested CLI using the current workspace and session when available.
metadata:
  requires:
    bins: ["agent-bridge"]
---

# Agent Bridge CLI Review

Use this skill to ask another supported CLI agent to review the current work through Agent Bridge direct send, then bring the returned JSON back into the current model's review loop.

## Trigger Parsing

Map the requested reviewer to `agent-bridge send --to`:

- `aiden`, `艾登`, `艾扥` -> `aiden`
- `codex` -> `codex`
- `claude`, `claude code` -> `claude`

If the user names multiple reviewers, run them one at a time and compare results. If no reviewer is named, default to `aiden`.

## Defaults

- **Workspace**: use the current conversation workspace. Prefer the active `environment_context.cwd`; if inside a git repo, use `git rev-parse --show-toplevel` only when that better represents the user's project root.
- **Session id**: use the current conversation/session id when it is visible in the conversation or environment. Do not invent one. If it is unavailable, omit `--session-id` and mention that it was not observable.
- **Producer**: default to `codex` unless the current producer is explicitly known to be another supported CLI.
- **Raw output**: do not pass `--raw-output` unless debugging parser/terminal behavior.

## Build The Review Message

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

## Run Agent Bridge

Prefer a PATH-installed command:

```bash
agent-bridge send --to <target> --message "$REVIEW_MESSAGE" --workspace "$WORKSPACE" --session-id "$SESSION_ID"
```

If `agent-bridge` is not on PATH, use this repository's built CLI when present:

```bash
node /Users/bytedance/git/inspiration-flash/agent-bridge/dist/cli/index.js send --to <target> --message "$REVIEW_MESSAGE" --workspace "$WORKSPACE" --session-id "$SESSION_ID"
```

When `SESSION_ID` is unavailable, omit the `--session-id "$SESSION_ID"` pair. For long messages, write the review request to a temp file and use `--file <path>` instead of `--message`.

## Consume The Result

After the command returns:

1. Parse the `BridgeResponse` JSON.
2. Treat `result.verdict` as the review signal:
   - `pass`: report the pass and any useful notes.
   - `fail`: show the findings, then decide whether to implement fixes or ask the user.
   - `uncertain`: explain what was insufficient and decide whether to gather more context or rerun.
3. Bring the returned findings into the current model's own review. Do not blindly accept the external CLI's answer when it conflicts with local evidence.
4. If the command times out, check `agent-bridge status`; if a late result is available, use it.

## Safety

- Running this skill is a review action. Do not modify files unless the user asked for fixes or the returned review requires a clear correction and the task context permits implementation.
- Never send secrets, private tokens, or unrelated personal data in the review message.
- Keep the summary compact enough for a direct CLI message; include paths and focused diffs rather than enormous raw logs.
