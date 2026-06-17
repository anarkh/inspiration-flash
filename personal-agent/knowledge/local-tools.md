# Local Tools

## What We Implemented

The Personal Agent has a small local filesystem tool catalog:

- `list_files` lists files under the current workspace.
- `read_file` reads one workspace-relative file.
- `search_text` searches workspace files for an exact text query.
- `write_file` proposes a workspace-relative file write and returns a confirmation request.
- `run_command` runs safe read-only commands and routes higher-risk commands through safety results.

The tool executor also accepts a small set of obvious model aliases, such as `list_directory` and `ls`, and maps them back to `list_files`.

## How It Works Here

The runner executes tool steps through `executeLocalTool(workspace, tool, input)`. Each tool receives the current workspace root and validates its own input before touching the filesystem.

Filesystem access is constrained by `resolveWorkspacePath`. A model-provided path must resolve inside the workspace. Absolute paths and `..` traversal that escape the workspace are rejected.

The model prompt lists the current local tool catalog and input shapes:

```text
list_files {}
read_file {path}
search_text {query}
write_file {path, content}
run_command {command}
```

The alias layer is deliberately small. It handles common natural names from real model output without making the public catalog bigger than necessary.

`write_file` does not write immediately. It validates that the target path stays inside the workspace, computes a small preview, and returns `confirmation_required`. The runner can now apply the proposed action after a Confirmation Gate approves it.

`run_command` uses the command policy:

- `safe-read` commands run in the workspace with `shell: false`.
- `workspace-write` commands return `confirmation_required`.
- `dangerous` commands return `rejected`.

## Other Common Approaches

**Provider-native tool calling**:
Define tools in the model provider's native function-calling schema. This gives stronger schema validation, but ties the loop to provider-specific formats.

**Shell command execution**:
Let the model run arbitrary shell commands. This is powerful, but it needs a much stronger policy layer and is unsafe as a first tool surface.

**External tool server**:
Expose tools through MCP or another tool server. This scales well for many tools, but adds setup and protocol complexity before the core loop is mature.

## Why This Approach

The first Local Tools are intentionally boring and auditable. They give the agent enough perception to summarize and inspect a workspace while keeping the safety boundary easy to understand.

## Advantages

- Simple enough to learn and debug.
- Workspace path checks protect files outside the task directory.
- File writes do not happen before an explicit confirmation path exists.
- Safe commands run without a shell, reducing shell-injection risk.
- The canonical tool names remain stable.
- A small alias layer makes real model output less brittle.
- Tests can exercise tools without network calls.

## Disadvantages

- Confirmed actions depend on the current CLI y/N prompt; there is no richer policy UI yet.
- Command parsing intentionally supports only simple command lines.
- Exact text search is not semantic retrieval.
- Alias handling is manual and only covers known model drift.
- Large workspaces can make recursive file listing expensive.

## Evaluation

Current tests verify:

- reading, listing, and exact text search inside a temporary workspace,
- `write_file` returning a confirmation request without changing the filesystem,
- `run_command` executing `safe-read` commands in the workspace,
- `run_command` returning `confirmation_required` for workspace-write commands,
- confirmed `write_file` actions writing the proposed content,
- confirmed `run_command` actions executing the proposed command,
- `run_command` returning `rejected` for dangerous commands,
- rejection of paths that escape the workspace,
- common model aliases such as `list_directory`.

The DeepSeek smoke test exposed the `list_directory` alias gap, which is now covered by a regression test.

Future evaluation should add:

- large workspace performance checks,
- hidden-file and ignore-pattern behavior,
- richer Confirmation Gate UX,
- richer tool schema validation,
- model-assisted tool error recovery.
