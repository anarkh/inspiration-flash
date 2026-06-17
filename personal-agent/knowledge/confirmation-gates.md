# Confirmation Gates

## What We Implemented

The runner now handles `confirmation_required` tool results. When a tool proposes a gated action, the runner asks a confirmation callback before applying it.

The CLI implementation prints the tool, reason, preview, and action to the terminal, then asks:

```text
Approve this action? (y/N)
```

Only `y` and `yes` approve the action. Non-interactive stdin denies by default so scripts and CI cannot hang.

## How It Works Here

Local Tools return `confirmation_required` for file writes and workspace-writing commands. The runner detects that shape with `isConfirmationRequired`.

If the Owner approves:

- `write_file` creates parent directories if needed and writes the proposed content.
- `run_command` rechecks the command policy, rejects dangerous commands, and executes approved non-dangerous commands without a shell.

If the Owner denies or no confirmation callback exists, the runner records a `confirmation_denied` tool result and continues the model loop.

## Other Common Approaches

**Always auto-apply**:
Fast and convenient, but unsafe for a personal agent that can change files or run commands.

**Static allowlist only**:
Avoids prompts for known actions, but it can hide important context from the Owner and is brittle while the tool catalog is still changing.

**Policy engine**:
A formal policy layer can express richer rules, roles, and scopes. It is useful later, but heavier than the current MVP needs.

## Why This Approach

The project is CLI-first and learning-oriented. The Owner should see the proposed action before it changes the workspace. A simple y/N gate teaches the agent safety pattern without introducing a full policy runtime too early.

## Advantages

- High-impact tool actions require explicit Owner approval.
- Denied actions are visible to the model as observations.
- Non-interactive runs fail closed instead of hanging.
- Confirmed commands are still run with `shell: false`.

## Disadvantages

- The prompt is coarse-grained: approve or deny only.
- There is no edit-before-approve flow yet.
- There is no persistent trust policy for repeated commands.
- Long action payloads can be noisy in the terminal.

## Evaluation

Current tests verify:

- confirmed `write_file` actions are applied,
- denied confirmations are recorded and not applied,
- confirmed workspace-write commands execute,
- terminal prompt formatting includes reason, preview, and action,
- approval parsing accepts only `y` and `yes`.

Future evaluation should add:

- CLI end-to-end tests with a pseudo-terminal,
- edit-before-approve workflows,
- persistent policy profiles,
- audit summaries in Run Export.
