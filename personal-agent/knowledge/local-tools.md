# Local Tools

## What We Implemented

The Personal Agent has a small local filesystem tool catalog backed by a typed Tool Registry:

- `list_files` lists files under the current workspace.
- `read_file` reads one workspace-relative file.
- `search_text` searches workspace files for an exact text query.
- `write_file` proposes a workspace-relative file write and returns a confirmation request.
- `run_command` runs safe read-only commands and routes higher-risk commands through safety results.

Each definition declares a canonical name, aliases, description, input schema, output schema, typed implementation, and optional confirmed-action handler. The executor accepts a small set of obvious model aliases, such as `list_directory` and `ls`, and resolves them through the same registry entry as `list_files`.

Malformed names, inputs, outputs, and confirmed actions are represented by phase-aware runtime errors. The runner turns those exceptions into durable `tool_error` observations instead of losing the Task Run.

## How It Works Here

The runner still calls `executeLocalTool(workspace, tool, input)`, but that function no longer contains a hard-coded dispatch switch. `createToolRegistry` validates every definition and rejects malformed schemas or name/alias collisions during module startup. At call time it resolves the name, validates input, executes the typed implementation, and validates output.

The implementation is split by responsibility: `tool-registry.ts` owns the provider-neutral runtime contract, `local-tool-catalog.ts` owns built-in definitions and schemas, `local-tool-implementations.ts` owns filesystem and process behavior, and `local-tools.ts` remains the small facade consumed by the runner and provider. This keeps catalog growth from turning one file into a second monolithic runtime.

The shared compact JSON Schema implementation now lives under `core/` because both Skill evals and the Tool Registry use it. Tool schemas use closed objects, `minLength` for required strings, and `anyOf` for discriminated result unions such as `command_result`, `confirmation_required`, and `rejected`.

Filesystem access is constrained by `resolveWorkspacePath`. A model-provided path must resolve inside the workspace. Absolute paths and `..` traversal that escape the workspace are rejected.

The model prompt derives the current local tool catalog from registry descriptors rather than maintaining a second hard-coded list. Conceptually it exposes:

```text
list_files {}
read_file {path}
search_text {query}
write_file {path, content}
run_command {command}
```

Aliases remain runtime compatibility names and are not advertised as separate tools. This keeps the public catalog small while still handling common natural names from real model output.

`write_file` does not write immediately. It validates that the target path stays inside the workspace, computes a small preview, and returns `confirmation_required`. After approval, the registry routes the action back to the same tool definition, validates the action schema again, applies it, and validates the confirmed output.

`run_command` uses the command policy:

- `safe-read` commands run in the workspace with `shell: false`.
- `workspace-write` commands return `confirmation_required`.
- `dangerous` commands return `rejected`.

When registry resolution, schema validation, or implementation execution fails, the durable result has this shape:

```json
{
  "type": "tool_error",
  "tool": "read_file",
  "phase": "input_validation",
  "reason": "Local Tool read_file input failed schema validation: $.path is required"
}
```

The model receives this observation on the next turn and can repair its call. Deterministic evaluation treats `tool_error` as unsuccessful.

## Other Common Approaches

**Provider-native tool calling**:
Define tools in the model provider's native function-calling schema. This gives stronger schema validation, but ties the loop to provider-specific formats.

**Zod, TypeBox, or Ajv registry**:
Use a mature schema library and infer or generate TypeScript types. This gives broader JSON Schema coverage and better ecosystem tooling, but adds a dependency and hides some validation mechanics that this learning project currently wants to expose.

**Hard-coded dispatch switch**:
Branch on the tool name and let every implementation parse its own input. This is initially small, but catalog metadata, prompt documentation, confirmation routing, and validation drift into separate sources of truth. This was the previous implementation.

**Shell command execution**:
Let the model run arbitrary shell commands. This is powerful, but it needs a much stronger policy layer and is unsafe as a first tool surface.

**External tool server**:
Expose tools through MCP or another tool server. This scales well for many tools, but adds setup and protocol complexity before the core loop is mature.

## Why This Approach

The first Local Tools remain intentionally boring and auditable. A small first-party registry makes the execution contract visible while establishing the adapter boundary needed by future `codex/agent-ability` tools. Skill guidance still cannot register or execute code by itself.

## Advantages

- Simple enough to learn and debug.
- Workspace path checks protect files outside the task directory.
- File writes do not happen before an explicit confirmation path exists.
- Safe commands run without a shell, reducing shell-injection risk.
- The canonical tool names remain stable.
- A small alias layer makes real model output less brittle.
- Input, normal output, confirmed action, and confirmed output are validated at one boundary.
- Provider prompt schemas come from the same descriptors used for execution.
- Invalid calls become inspectable events and can be repaired on the next model turn.
- Tests can exercise tools without network calls.

## Disadvantages

- Confirmed actions depend on the current CLI y/N prompt; there is no richer policy UI yet.
- Command parsing intentionally supports only simple command lines.
- Exact text search is not semantic retrieval.
- Alias handling is manual and only covers known model drift.
- Large workspaces can make recursive file listing expensive.
- The compact schema validator is not full JSON Schema 2020-12.
- TypeScript interfaces and their JSON-style schemas are paired explicitly; the compiler cannot prove they are identical.
- Per-tool permissions, cancellation, configurable timeouts, output limits, and redaction are not implemented by this increment.
- Skill Pack scripts remain inventory only and cannot enter the registry yet.

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
- common model aliases such as `list_directory`,
- registry startup rejection for invalid schemas and alias collisions,
- input validation before implementation execution,
- normal and confirmed output validation,
- schema-derived provider catalog output,
- durable `tool_error` observations for malformed model calls,
- a Golden Task Run fixture whose expected Task Evaluation verdict is `fail` for malformed input,
- compact schema `minLength` and `anyOf` behavior.

The DeepSeek smoke test exposed the `list_directory` alias gap, which is now covered by a regression test.

Future evaluation should add:

- large workspace performance checks,
- hidden-file and ignore-pattern behavior,
- richer Confirmation Gate UX,
- permission, timeout, cancellation, output-limit, and redaction failure injection,
- approved Skill Pack script registration and execution,
- model-assisted tool error recovery.
