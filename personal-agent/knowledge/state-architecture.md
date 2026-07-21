# State Architecture

## What We Implemented

We split the original monolithic `src/state/store.ts` into focused state modules:

- `src/state/workspace.ts`: workspace state directory initialization and default files.
- `src/state/project-memory.ts`: Project Memory reading, section normalization, and append behavior.
- `src/state/task-runs.ts`: Task Run metadata, latest-run pointer, history listing, and status updates.
- `src/state/run-events.ts`: append-only JSONL event streams.
- `src/state/checkpoints.ts`: checkpoint write, read, and latest-checkpoint lookup.
- `src/state/task-artifacts.ts`: reports, evaluations, exports, and Memory Suggestions files.
- `src/state/shared.ts`: small filesystem helpers shared by state modules.

`src/state/store.ts` now stays as a compatibility barrel that re-exports the categorized modules. Existing callers can keep importing from `state/store.ts` while the implementation is easier to navigate.

## How It Works Here

The state layer still uses local files under `.personal-agent/`. The refactor changes code organization, not the storage format:

- Task Run metadata still lives in `run.json`.
- Events still live in `events.jsonl`.
- Checkpoints still live under `checkpoints/*.json`.
- Project Memory still lives in `.personal-agent/memory.md`.
- Exports, reports, evaluations, and memory suggestions still live inside each run directory.

The module dependencies are intentionally one-way:

- `workspace.ts` depends only on shared helpers.
- `project-memory.ts` depends on workspace initialization.
- `task-runs.ts` depends on workspace initialization and shared helpers.
- `run-events.ts` is independent.
- `checkpoints.ts` depends only on shared helpers.
- `task-artifacts.ts` composes task runs, events, memory parsing, and shared helpers.

This keeps circular imports out of the state layer.

## Other Common Approaches

**Single file store**:
Keep every state function in one module. This is fast for the first MVP, but it becomes harder to scan once Task Runs, memory, events, checkpoints, and exports all grow together.

**Repository classes**:
Create classes like `TaskRunRepository` and `MemoryRepository`. This can be useful with dependency injection or multiple backends, but it adds ceremony before we need runtime polymorphism.

**Feature-local stores**:
Move state code next to each feature, such as `agent/task-runs.ts` and `memory/store.ts`. This improves feature locality, but can make shared filesystem conventions harder to see.

**Database layer**:
Use SQLite, Prisma, or an ORM. This improves querying and transactions, but reduces the file-first inspectability that is valuable for learning.

## Why This Approach

This project is still learning-oriented and file-first. Categorized modules reduce cognitive load without changing runtime behavior, public imports, or on-disk data. The compatibility barrel lets us refactor internals now and migrate callers to direct module imports later if that becomes useful.

## Advantages

- Easier to find the code for one state capability.
- Lower risk than a storage rewrite because file formats stay unchanged.
- Existing callers and tests keep the same import path.
- Module boundaries make future changes, such as replacing events or memory storage, more localized.
- The dependency shape is simple enough to understand while learning agent persistence.

## Disadvantages

- `state/store.ts` still exports many names, so public API breadth has not changed yet.
- File-based state still lacks database transactions and rich queries.
- Some artifact code composes several modules, so it needs care to avoid becoming a new oversized module.

## Evaluation

This refactor is evaluated by checking behavior before and after the split:

- Run the state tests to verify Workspace State, Task Runs, Project Memory, events, checkpoints, exports, and Memory Suggestions.
- Run type checking to catch broken exports and import cycles.
- Run the full test/build suite before considering the refactor complete.

The useful regression signal is that storage paths and generated files remain compatible while the source code becomes easier to navigate.
