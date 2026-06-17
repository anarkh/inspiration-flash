# Task History

## What We Implemented

The CLI now supports:

```text
personal-agent history
```

It lists recent Task Runs from the current workspace, including run id, status, mode, updated time, and goal.

## How It Works Here

Each Task Run already writes metadata to:

```text
.personal-agent/runs/<run-id>/run.json
```

`listTaskRuns(workspace, limit)` scans run directories, reads their `run.json` metadata, sorts by `updatedAt` descending, and returns the most recent runs.

The CLI prints a compact text list. If there are no runs yet, it prints:

```text
No Task Runs found.
```

## Other Common Approaches

**Database query**:
Store runs in SQLite or another database and query with indexes. This scales better, but hides the file layout while the MVP is still focused on learning.

**Event-log derived history**:
Build history entirely from `events.jsonl`. This can reconstruct more detail, but it is more expensive and unnecessary for a simple list view.

**External observability backend**:
Send traces to a hosted service. This is useful for teams, but too heavy for a local personal agent MVP.

## Why This Approach

The workspace already has durable `run.json` metadata. Reading those files keeps history simple, inspectable, and consistent with the file-first state design.

## Advantages

- No database or service dependency.
- Easy to inspect manually in `.personal-agent/runs/`.
- Useful immediately after local experiments.
- Works with `resume` and provides a foundation for Run Export commands.

## Disadvantages

- File scanning is less efficient than indexed storage for large histories.
- The output is compact text, not an interactive table.
- It does not yet show tool counts, report paths, or evaluation summaries.

## Evaluation

Current tests verify:

- empty workspaces print a friendly message,
- completed runs appear in CLI history,
- state listing returns run metadata from local files.

Future evaluation should add:

- limiting and pagination,
- filtering by status,
- report and evaluation summary columns,
- richer integration with `resume`, such as showing whether a run has checkpoints.
