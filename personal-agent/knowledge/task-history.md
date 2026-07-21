# Task History

## What We Implemented

The CLI now supports:

```text
a-agent history [--status active|completed] [--limit count] [--offset count]
```

It lists recent Task Runs from the current workspace, including run id, status, mode, optional evaluation verdict, optional report path, optional latest checkpoint id, turn, and created time, updated time, and goal.
The optional `--status` filter narrows the list to active or completed runs.
The optional `--limit` value caps how many rows are printed after filtering.
The optional `--offset` value skips rows after filtering so the Owner can page through long history.

## How It Works Here

Each Task Run already writes metadata to:

```text
.personal-agent/runs/<run-id>/run.json
```

`listTaskRuns(workspace, limit)` scans run directories, reads their `run.json` metadata, reads the optional `evaluation.json` verdict, detects an optional `report.md` path, reads the latest checkpoint id, saved turn, and created time when present, sorts by `updatedAt` descending, and returns the most recent runs.

The CLI intentionally reads all available metadata before applying `--status`, `--limit`, and `--offset`. This keeps `history --status completed --limit 1 --offset 1` meaningful: it returns the second newest completed run instead of paging the unfiltered list first.

The CLI prints a compact text list. If there are no runs yet, it prints:

```text
No Task Runs found.
```

`history --status active` is useful before `resume`; `history --status completed` is useful when looking for a run to export or review.
`history --limit 5` is useful when the workspace has many old experiments and the Owner only wants a short recent view.
`history --limit 5 --offset 5` is useful for reading the next page after the first five filtered runs.
Each non-empty page includes a `Showing <first>-<last> of <filtered-count>` summary. When adjacent pages exist, history prints copy-pasteable `Previous page: a-agent history ...` and `Next page: a-agent history ...` commands.
When a run already has `report.md`, history includes `report: <path>` so the Owner can open the report without running export first.
When a run has checkpoints, history includes `checkpoint: <id> (turn <n>, created <iso>)` so the Owner can see that the run has a durable resume point, which provider turn it captured, and when it was saved.

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
- Can filter active versus completed runs without scanning files manually.
- Can keep CLI output short with `--limit` and page with `--offset` while preserving correct status filtering.
- Can show filtered totals, current page item positions, and previous/next page commands for long histories.
- Can jump directly from history to a Task Report when `report.md` exists.
- Can show whether a run has a latest checkpoint, saved turn, and checkpoint timestamp before the Owner calls `resume`.

## Disadvantages

- File scanning is less efficient than indexed storage for large histories.
- The output is compact text, not an interactive table.
- It does not yet show tool counts.

## Evaluation

Current tests verify:

- empty workspaces print a friendly message,
- completed runs appear in CLI history,
- history can filter by `active` or `completed` status,
- history can cap output with `--limit` after status filtering,
- history can skip output with `--offset` after status filtering,
- history shows filtered totals, current item positions, and adjacent page commands when previous or next pages exist,
- history shows the Task Evaluation verdict when `evaluation.json` is present,
- history shows the Task Report path when `report.md` is present,
- history shows the latest checkpoint id, saved turn, and created time when a checkpoint is present,
- state listing returns run metadata from local files.

Future evaluation should add:

- richer page metadata, such as current page number,
- richer integration with `resume`, such as showing relative checkpoint age.
