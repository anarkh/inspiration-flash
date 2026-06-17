# MVP Skeleton

## What We Implemented

The first implementation slice creates the TypeScript CLI project and a tested foundation for:

- CLI help output.
- `personal-agent run "<task>"` creating a Task Run.
- `personal-agent history` listing recent Task Runs.
- `personal-agent resume` continuing the latest active Task Run.
- `personal-agent memory` viewing Project Memory.
- `personal-agent memory append "<note>"` appending simple memory notes.
- `personal-agent memory append --section <section> "<note>"` inserting notes into named memory sections.
- `personal-agent memory apply-suggestions [--yes] [run-id]` applying reviewed Memory Suggestions.
- `personal-agent export [run-id]` writing a Markdown Task Run export.
- a bootstrap Model Provider that drives a minimal Task Run loop.
- Task Report and Task Evaluation files.
- Task Run Markdown exports.
- model-suggested Memory Suggestions from `reflect` steps.
- Workspace State initialization.
- Project Memory file creation.
- Project Memory read and append commands.
- explicit Project Memory section insertion.
- confirmed Memory Suggestions apply flow.
- categorized state modules with a compatibility `state/store.ts` export.
- Project Memory prompt injection into Model Provider input.
- Task Run metadata.
- append-only event logging.
- Checkpoint write and read.
- provider-neutral Agent Step validation.
- provider-neutral Agent Step execution for `plan`, `message`, `tool`, `reflect`, and `finish`.
- Local Tool primitives for reading, listing, and text search.
- Local Tool observations returned to the Model Provider as `tool_result` events.
- command risk classification for `run_command`.

## How It Works Here

The CLI is intentionally thin. `run "<task>"` currently accepts the Owner's task, invokes a bootstrap Model Provider, creates Workspace State under `.personal-agent/`, records visible Agent Steps and observations as events, writes Checkpoints, and finishes with a local Task Report and Task Evaluation.

The implementation is split into small modules:

- `src/cli/index.ts`: command entrypoint.
- `src/agent/runner.ts`: minimal Task Run loop.
- `src/model/provider.ts`: Model Provider boundary.
- `src/model/bootstrap-provider.ts`: deterministic fallback provider used when no real model key is configured.
- `src/state/store.ts`: compatibility export for state modules.
- `src/state/workspace.ts`: Workspace State initialization and defaults.
- `src/state/project-memory.ts`: Project Memory sections and append behavior.
- `src/state/task-runs.ts`: Task Run metadata, latest-run pointer, and history.
- `src/state/run-events.ts`: append-only event logs.
- `src/state/checkpoints.ts`: Checkpoint write and restore helpers.
- `src/state/task-artifacts.ts`: reports, evaluations, exports, and Memory Suggestions.
- `src/core/agent-step.ts`: provider-neutral Agent Step schema validation.
- `src/tools/local-tools.ts`: workspace-bound file inspection tools.
- `src/tools/command-policy.ts`: command risk classification.

## Other Common Approaches

**Framework-first**:
Use LangGraph, LangChain, LlamaIndex, or an agent SDK to provide orchestration and tool abstractions. This is faster when the desired runtime shape is already known, but it hides the learning path.

**Database-first**:
Start with SQLite or a hosted database for run state. This improves querying early, but makes the first version less inspectable than files.

**Provider-native tool calling**:
Bind the loop directly to one model provider's function calling. This can reduce schema handling, but makes the agent loop less portable and less explicit.

## Why This Approach

The first version favors a small first-party loop because the Owner wants to learn how agents work while using the tool. Files, explicit Agent Steps, and small modules make each concept visible.

## Advantages

- Easy to inspect by opening `.personal-agent/`.
- Tests describe the intended API from the beginning.
- Agent Step validation is independent of any provider.
- The runner can process `tool` steps and feed observations back into the next provider turn.
- Local Tools are simple and workspace-bound.
- Checkpoints are ordinary JSON files.

## Disadvantages

- Real model behavior depends on valid provider credentials; otherwise the CLI falls back to bootstrap.
- Task Evaluation is still simple and deterministic.
- JSON files are transparent but weaker than a database for queries.
- Command policy is conservative and pattern-based.

## Evaluation

Current verification:

- `npm test`
- `npm run typecheck`
- `npm run build`

The current tests cover:

- CLI help and Task Run creation.
- CLI Task Run history.
- CLI Task Run resume.
- CLI Project Memory view, append, and section insertion.
- CLI Memory Suggestions apply flow.
- CLI Task Run export.
- bootstrap Task Run completion through the CLI.
- Workspace State defaults.
- event and Checkpoint durability.
- Agent Step validation.
- runner execution of provider steps.
- runner execution of Local Tool observations.
- runner collection and CLI application of Memory Suggestions from `reflect` steps.
- runner injection of Project Memory into fresh and resumed Task Runs.
- runner filtering of irrelevant Project Memory notes when relevant notes match the task.
- Task Run export summaries for Decision Trace, Local Tools Used, and Changed Resources.
- Task Run export redaction for common environment, JSON, URL query, bearer, GitHub, and `sk-...` secret patterns.
- Memory Suggestion quality gates before applying notes to Project Memory.
- Memory Suggestion exact and simple near-duplicate checks before applying notes to Project Memory.
- Memory Suggestion simple same-topic conflict checks before applying notes to Project Memory.
- Memory Suggestion direct-implementation versus proposal-only preference conflict checks before applying notes to Project Memory.
- Memory Suggestion simple same-topic negation checks before applying notes to Project Memory.
- Memory Suggestion simple same-topic prohibition checks before applying notes to Project Memory.
- Memory Suggestion simple Chinese preference conflict checks before applying notes to Project Memory.
- Memory Suggestion generic unactionable note checks before applying notes to Project Memory.
- command risk classification.
- file read, list, and search behavior.

Next evaluation target:

Add broader conflict-aware memory fixtures while keeping fake-provider tests as regression coverage for the agent loop.
