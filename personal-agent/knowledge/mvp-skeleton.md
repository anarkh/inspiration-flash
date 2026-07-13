# MVP Skeleton

## What We Implemented

The first implementation slice creates the TypeScript CLI project and a tested foundation for:

- CLI help output.
- package name `@ranarkh/agent` and CLI command `a-agent`.
- `a-agent start` running a minimal line-based Task Conversation.
- `a-agent chat [--learn] [--review]` running one persistent chat Task Run with repeated Owner messages.
- `a-agent run --learn`, `a-agent start --learn`, and `a-agent resume --learn` showing opt-in Learning Lens notes.
- `a-agent run --review`, `a-agent start --review`, and `a-agent resume --review` writing optional model-assisted review into Task Evaluation.
- `a-agent run "<task>"` creating a Task Run.
- `a-agent run "<task>"` refusing clearly ambiguous tasks before creating a Task Run.
- `a-agent history` listing recent Task Runs.
- `a-agent resume` continuing the latest active Task Run.
- `a-agent memory` viewing Project Memory.
- `a-agent memory append "<note>"` appending simple memory notes.
- `a-agent memory append --section <section> "<note>"` inserting notes into named memory sections.
- `a-agent memory apply-suggestions [--yes] [run-id]` applying reviewed Memory Suggestions.
- `a-agent export [run-id]` writing a Markdown Task Run export.
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
- bounded recovery attempts when provider output fails Agent Step validation.
- provider-neutral Agent Step execution for `plan`, `message`, `tool`, `reflect`, and `finish`.
- Local Tool primitives for reading, listing, and text search.
- Local Tool observations returned to the Model Provider as `tool_result` events.
- command risk classification for `run_command`.

## How It Works Here

The CLI is intentionally thin. `start` reads repeated line-based tasks until `exit`, `quit`, or EOF, applies the same small Clarification Gate for clearly ambiguous requests, then reuses the same execution path as `run "<task>"` for each task. `chat` creates one persistent Task Run, appends each user line as an `owner_message` event, and waits for a model `message` after every input. A model cannot finish chat; `exit`, `quit`, or EOF lets the runner write the final report and evaluation. `run "<task>"` first applies that Clarification Gate, then invokes a bootstrap Model Provider, creates Workspace State under `.personal-agent/`, records visible Agent Steps and observations as events, writes Checkpoints, and finishes with a local Task Report and Task Evaluation.

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
- Task Evaluation keeps deterministic verdicts authoritative; model-assisted review is optional and advisory.
- JSON files are transparent but weaker than a database for queries.
- Command policy is conservative and pattern-based.

## Evaluation

Current verification:

- `npm test`
- `npm run typecheck`
- `npm run build`

The current tests cover:

- CLI help and Task Run creation.
- CLI interactive `start` task creation and repeated task execution.
- CLI Clarification Gate for clearly ambiguous `run` and `start` tasks.
- CLI Learning Lens notes for planning, checkpointing, and evaluation.
- CLI model review flag records `unavailable` when only bootstrap is configured.
- CLI debug recovery switch for visibly exercising recovery attempts.
- CLI Skill Pack eval execution.
- CLI Task Run history.
- CLI Task Run history displays the Task Evaluation verdict when available.
- CLI Task Run history can filter active versus completed runs.
- CLI Task Run history can cap output with `--limit`.
- CLI Task Run history can page output with `--offset`.
- CLI Task Run history displays filtered totals plus previous/next page hints.
- CLI Task Run history displays the Task Report path when available.
- CLI Task Run history displays the latest Checkpoint id, saved turn, and created time when available.
- CLI Task Run resume.
- CLI Project Memory view, append, and section insertion.
- CLI Memory Suggestions apply flow.
- CLI Task Run export.
- bootstrap Task Run completion through the CLI.
- Workspace State defaults.
- event and Checkpoint durability.
- Agent Step validation.
- runner recovery attempts for malformed provider output.
- runner recovery limit for repeated malformed provider output.
- runner execution of provider steps.
- runner execution of Local Tool observations.
- runner deterministic Task Evaluation for trace quality, report quality, gate safety, and Memory Suggestion learning signals.
- runner optional model-assisted review without overriding deterministic Task Evaluation verdicts.
- runner collection and CLI application of Memory Suggestions from `reflect` steps.
- runner persistent chat with multiple Owner messages in one Task Run.
- CLI persistent chat with two piped inputs recorded as two `owner_message` events.
- chat recovery when a provider tries to return `finish` instead of answering.
- runner-authored chat completion and evaluation after input closes.
- runner injection of Project Memory into fresh and resumed Task Runs.
- runner filtering of irrelevant Project Memory notes when relevant notes match the task.
- runner discovery and injection of relevant Skill Pack summaries.
- explicit Owner-named Skill Pack priority over higher-scoring keyword matches.
- runner confirmation before injecting multiple automatically matched Skill Packs.
- runner subset selection for confirmed Skill Pack candidates.
- terminal parsing of numbered Skill Pack subset choices.
- Skill Pack provider context for agent-ability style references, scripts, and eval resources.
- Skill Pack provider context and Task Export mark scripts as inventory-only rather than auto-executable.
- Skill Pack eval manifest validity and eval count summaries.
- Skill Pack eval runner execution with local Markdown and JSON reports.
- Skill Pack eval runner `contains`, `regex`, `model_judge`, `model_judge.judge_runs`, `model_judge.pass_threshold`, `tool_trace`, `tool_trace.input_contains`, `tool_trace.input_matches`, `tool_trace.input_schema`, `tool_trace.output_contains`, `tool_trace.output_matches`, `tool_trace.output_type`, and `tool_trace.output_schema` graders.
- Skill Pack eval manifest JSON Schema plus missing `skill_name`, unknown-field, bad `files`, empty required string, multi-error, and regex pattern validation.
- OpenAI-compatible provider inclusion of Skill Pack context in prompt payload.
- Task Run export listing of selected Skill Packs.
- Task Run export listing of selected Skill Pack resource inventory.
- Task Run export Decision Trace summaries for Skill Pack confirmation decisions.
- Task Run export summaries for Decision Trace, Local Tools Used, and Changed Resources.
- Task Run export redaction for common environment, JSON, URL query, bearer, GitHub, and `sk-...` secret patterns.
- Memory Suggestion quality gates before applying notes to Project Memory.
- Memory Suggestion exact and simple near-duplicate checks before applying notes to Project Memory.
- Memory Suggestion simple same-topic conflict checks before applying notes to Project Memory.
- Memory Suggestion English and Chinese direct-implementation versus proposal-only preference conflict checks before applying notes to Project Memory.
- Memory Suggestion simple same-topic negation checks before applying notes to Project Memory.
- Memory Suggestion simple same-topic prohibition and avoidance checks before applying notes to Project Memory.
- Memory Suggestion simple Chinese preference conflict checks before applying notes to Project Memory.
- Memory Suggestion generic unactionable note checks before applying notes to Project Memory.
- command risk classification.
- file read, list, and search behavior.

Next evaluation target:

Skill Pack evals now have a local runner, deterministic `contains`, `regex`, `tool_trace`, `tool_trace.input_contains`, `tool_trace.input_matches`, `tool_trace.input_schema`, `tool_trace.output_contains`, `tool_trace.output_matches`, `tool_trace.output_type`, `tool_trace.output_schema` graders, and the first semantic `model_judge` grader with repeated-run thresholds and per-run judge diagnostics. The optional quality-layer schema documents unknown-field, invalid `files`, empty required string, multi-error, regex pattern, compact schema, and model judge validation. Future evaluation should use real Skill Pack runs to build golden examples for model judge calibration.
