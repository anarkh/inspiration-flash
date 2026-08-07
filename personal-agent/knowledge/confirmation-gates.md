# Confirmation Gates

## What We Implemented

The runner now handles `confirmation_required` tool results. When a tool proposes a gated action, the runner asks a confirmation callback before applying it.

The CLI implementation prints the tool, reason, preview, and action to the terminal, then asks:

```text
Approve this action? (y/N)
```

Only `y` and `yes` approve ordinary actions. For Skill Pack confirmations, the CLI can also accept numbered subset answers such as `1,3`. Non-interactive stdin denies by default so scripts and CI cannot hang.

## How It Works Here

Local Tools return `confirmation_required` for file writes and workspace-writing commands. The runner detects that shape with `isConfirmationRequired`.

If the Owner approves:

- `write_file` creates parent directories if needed and writes the proposed content.
- `run_command` rechecks the command policy, rejects dangerous commands, and executes approved non-dangerous commands without a shell.

If the Owner denies or no confirmation callback exists, the runner records a `confirmation_denied` tool result and continues the model loop.

Skill Pack confirmation uses the same callback shape but can return a richer decision:

```ts
{ approved: true, selected: [".agents/skills/readme-helper/SKILL.md"] }
```

The runner then injects only those selected guidance blocks.

Because a selected Skill now contributes its complete `SKILL.md`, every automatically inferred match requires confirmation, including a single match. A Skill explicitly named in task text or selected with `--skill` is treated as an Owner choice and skips this inference confirmation.

## Other Common Approaches

**Always auto-apply**:
Fast and convenient, but unsafe for a personal agent that can change files or run commands.

**Static allowlist only**:
Avoids prompts for known actions, but it can hide important context from the Owner and is brittle while the tool catalog is still changing.

**Policy engine**:
A formal policy layer can express richer rules, roles, and scopes. It is useful later, but heavier than the current MVP needs.

## Why This Approach

The project is CLI-first and learning-oriented. The Owner should see the proposed action before it changes the workspace. A simple confirmation gate teaches the agent safety pattern without introducing a full policy runtime too early, and selected ids handle the first non-binary approval case without changing the Local Tool contract.

## Advantages

- High-impact tool actions require explicit Owner approval.
- Denied actions are visible to the model as observations.
- Non-interactive runs fail closed instead of hanging.
- Confirmed commands are still run with `shell: false`.
- Skill Pack confirmations can choose a subset instead of forcing all-or-nothing guidance injection.
- Automatically inferred Skill instructions cannot enter model context silently.

## Disadvantages

- Most tool prompts are still coarse-grained: approve or deny only.
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
- Skill Pack confirmation parsing accepts numbered subset choices.
- one and several automatically inferred Skill Packs require confirmation.

Future evaluation should add:

- CLI end-to-end tests with a pseudo-terminal,
- edit-before-approve workflows,
- persistent policy profiles,
- audit summaries in Run Export.
