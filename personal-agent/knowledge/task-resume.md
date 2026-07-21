# Task Resume

## What We Implemented

The CLI now supports:

```text
a-agent resume
```

It continues the latest active Task Run instead of creating a new run. If there is no run, it prints a friendly message. If the latest run is already completed, it reports that state without re-running it.

## How It Works Here

Task Runs already persist three pieces of resume state:

- `run.json` for goal, mode, success check, status, and timestamps,
- `events.jsonl` for durable Agent Steps and tool observations,
- `checkpoints/*.json` for the last visible turn and event count.

`resumeLatestTask` reads the latest run pointer, skips completed runs, restores the latest checkpoint, rebuilds provider-visible events from `events.jsonl`, and continues the runner loop from `checkpoint.turn + 1`.

The resumed loop appends new events, writes new checkpoints, and finishes by writing the report, evaluation, and completed status into the same run directory.

`a-agent history --status active` now shows `checkpoint: <id> (turn <n>, created <iso>)` when an active run has a durable resume point, which makes the resume state, saved turn, and checkpoint timestamp visible before running `resume`.

## Other Common Approaches

**Graph runtime checkpointing**:
Frameworks such as LangGraph can checkpoint graph state automatically. This is powerful, but hides the checkpoint format from the learning path.

**Database-backed resume**:
Store all runs, events, and checkpoints in a database. This improves querying and concurrency, but reduces the transparency of the local file layout.

**Provider conversation replay only**:
Send all previous messages back to the model and rely on it to continue. This is simple, but does not preserve local tool observations or deterministic state boundaries as clearly.

## Why This Approach

The project is file-first. Resuming from visible files teaches the core agent concept: durable state is what lets an agent survive interruption.

## Advantages

- Resumes the same Task Run id and directory.
- Uses existing checkpoints and event logs.
- Keeps provider-visible context separate from local audit-only events.
- Tests can simulate interrupted runs without a real model.

## Disadvantages

- Only the latest run can be resumed from the CLI today.
- Completed runs are not reopened.
- Checkpoint state is still minimal.
- There is no conflict handling for multiple concurrent resumes.

## Evaluation

Current tests verify:

- state helpers restore latest run metadata, events, and checkpoint,
- runner resumes an active run from checkpoint events,
- runner reports `not_found` when no run exists,
- history shows the latest checkpoint id, saved turn, and created time for runs that can be resumed from a checkpoint,
- CLI `resume` handles empty and active workspaces.

Future evaluation should add:

- explicit run-id resume,
- active-run filtering,
- corrupted checkpoint recovery,
- richer resume summaries in Run Export.
