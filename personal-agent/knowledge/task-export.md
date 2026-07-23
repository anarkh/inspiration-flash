# Task Export

## What We Implemented

The CLI now supports:

```text
a-agent export [run-id]
```

It writes a Markdown export for a Task Run to:

```text
.personal-agent/runs/<run-id>/export.md
```

If `run-id` is omitted, the latest Task Run is exported.

## How It Works Here

`exportTaskRun(workspace, id?)` resolves either the requested run or the latest run. It reads the existing file-first run state:

- `run.json` for metadata,
- `report.md` for the final report,
- `evaluation.json` for post-run evaluation,
- `memory-suggestions.json` for candidate Project Memory notes when present,
- `events.jsonl` for the visible task trace.

The export is regenerated on demand. It does not become a separate source of truth; it is a readable snapshot assembled from the durable run files.

The Markdown sections are:

- Metadata
- Decision Trace
- Local Tools Used
- Skill Packs Used
- Changed Resources
- Report
- Evaluation
- Memory Suggestions, when available
- Events

`Decision Trace` is a compact human-readable summary derived from `events.jsonl`. It turns provider steps and observations into lines such as `plan: ...`, `tool: write_file`, `tool_result: write_file -> file_written`, and `skill_packs_confirmation: denied`. A Skill Pack selection also reports the number of deterministic same-name source conflicts it resolved.

`Local Tools Used` is a de-duplicated list of tools seen in `tool` and `tool_result` events.

`Skill Packs Used` is a de-duplicated list of Skill Pack names and paths from `skill_packs` events recorded by the runner. It includes the winning source, priority, source root, optional version, and every shadowed same-name variant. When the selected Skill Pack includes an agent-ability style resource inventory, this section also shows its `references`, `scripts`, `evals` paths, and static eval manifest summary. If scripts are present, the export inserts the same inventory-only warning used in provider context, so the reader does not mistake script discovery for script execution. These events are audit metadata only; they are not fed back into the provider event stream.

`Changed Resources` currently records files reported by tool observations such as `file_written`. It is intentionally conservative: proposed writes that were not confirmed do not count as changed resources.

Before writing `export.md`, the export layer redacts common secret shapes from the generated Markdown:

- dotenv-style assignments whose key contains `API_KEY`, `TOKEN`, `SECRET`, or `PASSWORD`,
- JSON-style fields whose key contains `api_key`, `token`, `secret`, or `password`,
- URL query parameters such as `access_token`, `refresh_token`, `client_secret`, and `api_key`,
- bearer tokens,
- GitHub-style `ghp_...`, `gho_...`, `ghu_...`, `ghs_...`, and `ghr_...` tokens,
- OpenAI/DeepSeek-style `sk-...` keys.

Redaction only changes the shareable Markdown export. The original run artifacts remain unchanged so local debugging and audit history are preserved.

## Other Common Approaches

**Database-backed export**:
Store Task Runs in SQLite or Postgres and generate exports through queries. This scales better, but it hides the MVP's file layout and adds operational weight.

**Observability trace viewer**:
Send events to LangSmith, OpenTelemetry, or another trace backend. This is useful for teams and distributed systems, but heavier than a local learning loop.

**Archive export**:
Create a zip or bundle containing every run artifact. This is good for sharing, but less convenient for quick reading and diffing.

## Why This Approach

The Owner is learning how agent runs work. A Markdown export keeps the run understandable with a normal editor while preserving the raw files for deeper inspection.

## Advantages

- Easy to read, diff, and share.
- Works without a database or hosted tracing service.
- Makes report, evaluation, and events visible in one place.
- Adds readable summaries before the raw event JSON.
- Shows which Local Tools were used and which files were changed.
- Shows which Skill Packs were selected for the run, which resource inventory paths were exposed, and whether an eval manifest was recognized.
- Marks Skill Pack scripts as inventory-only so exports preserve the same execution boundary shown to the model.
- Includes candidate Project Memory notes when the run produced them.
- Redacts common environment, JSON, URL query, bearer, GitHub, and `sk-...` secret patterns from the generated Markdown.
- Supports both explicit `run-id` export and latest-run export.

## Disadvantages

- The export is a snapshot; re-run the command after new events.
- Large event logs can make the Markdown file long.
- Changed Resources only includes changes reported by known tool result shapes.
- It does not yet include checkpoint contents or detailed tool statistics.
- Redaction is pattern-based and can still miss uncommon secret formats or produce false positives.
- Raw run files are not redacted, so they should still be treated as local private artifacts.

## Evaluation

Current tests verify:

- state export writes `export.md`,
- export output includes metadata, report, evaluation, and events,
- export output includes Decision Trace, Local Tools Used, Skill Packs Used, Skill Pack resource inventory, eval manifest summary, and Changed Resources,
- export output summarizes Skill Pack confirmation decisions in Decision Trace,
- export output records Skill Pack source, version, precedence conflicts, and conflict counts,
- export output redacts common API key, bearer token, environment, JSON, URL query, and GitHub token patterns,
- export output includes Memory Suggestions when present,
- CLI `a-agent export` exports the latest run,
- CLI help exposes the command.

Future evaluation should add:

- export by explicit run id through the CLI,
- empty-state and not-found coverage,
- optional checkpoint inclusion,
- richer changed-resource detection for future tools,
- redaction false-positive and false-negative fixtures for future secret formats.
