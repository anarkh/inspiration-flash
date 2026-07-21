# Task Evaluation

## Purpose

Every completed Task Run should receive a Task Evaluation. The goal is not to grade the model abstractly; it is to decide whether this concrete Task Run met the Owner's goal safely and left enough evidence to learn from it.

## Evaluation Output

Store a post-run evaluation with the Task Run:

```json
{
  "verdict": "pass | partial | fail | blocked",
  "successCheck": "pass | fail | unavailable",
  "gateSafety": "pass | fail",
  "traceQuality": "pass | partial | fail",
  "reportQuality": "pass | partial | fail",
  "modelReview": {
    "verdict": "pass | partial | fail | blocked | unavailable | invalid",
    "reason": "..."
  },
  "learningSignals": ["..."],
  "followUps": ["..."]
}
```

## Required Checks

**Success Check**:
Did the Task Run meet the explicit Success Check? If no objective check exists, mark it unavailable and explain that in the Task Report.

**Gate Safety**:
Did the Personal Agent respect Confirmation Gates and Clarification Gates? Any unconfirmed high-impact action is a failure.

**Decision Trace Quality**:
Can the Owner see why the Task Plan, Skill Packs, Local Tools, and Recovery Attempts were chosen?

**Task Report Quality**:
Does the final report state the outcome, changed resources, verification, unresolved questions, and proposed Reflection Notes?

**Learning Signals**:
Did the Task Run reveal a Project Memory update, Knowledge Base update, Skill Pack improvement, or Capability Backlog item?

## Deterministic Evaluator

`src/agent/evaluation.ts` implements the first post-run evaluator used by `runTask` and `resumeLatestTask`. It only reads visible artifacts: the declared Success Check, final Task Report, provider-neutral events, and generated Memory Suggestions.

Current behavior:
- `successCheck` is `pass` when a non-empty Success Check has a non-empty report, `fail` when the report is empty, and `unavailable` when no Success Check was declared.
- `gateSafety` fails only if a confirmation-required tool result remains unresolved in the durable event trace.
- `traceQuality` is `pass` when the run contains both a plan and a finish step, `partial` when it finishes without a plan, and `fail` when no finish step is present.
- `reportQuality` passes when the final report has usable text.
- Memory Suggestions create a `Project Memory suggestion` learning signal and a `Review Memory Suggestions` follow-up.

The top-level `verdict` is deterministic: failed safety, failed Success Check, or failed report quality produces `fail`; unavailable Success Check or partial trace quality produces `partial`; otherwise the run is `pass`.

## Model-Assisted Review

`a-agent run --review "<task>"`, `a-agent start --review`, and `a-agent resume --review` add an optional model-assisted review to `evaluation.json`.

The model review is stored under `modelReview` and does not override the deterministic `verdict`. This is intentional: a model self-review can add semantic feedback, but it must not hide failed commands, missing confirmations, or empty reports.

When the selected provider is `bootstrap`, the review is recorded as:

```json
{
  "verdict": "unavailable",
  "reason": "Model-assisted review requires a real Model Provider."
}
```

When a real provider is available, the runner sends the completed Task Report, visible events, and deterministic evaluation to the provider and expects a `finish` step whose report is JSON shaped like:

```json
{
  "verdict": "pass | partial | fail | blocked",
  "reason": "..."
}
```

Malformed review output is recorded as `invalid` instead of failing the completed Task Run.

## Automated vs Human Evaluation

Current version:
- Run deterministic checks over the Task Run files.
- Run Skill Pack eval manifests locally with `a-agent eval skill-pack <name-or-path>`.
- Optionally ask the selected real Model Provider for a structured self-review with `--review`.

Later versions:
- Let the Owner override the verdict.
- Add golden Task Runs for repeatable regression testing.
- Use External Review through Agent Bridge for important Task Runs.
- Calibrate model-assisted graders with golden examples collected from real Skill Pack evals.
- Add retrieval-specific evals when Complex Embedding Retrieval is implemented.

## Skill Pack Eval Runner

`src/skills/evals.ts` implements the first executable eval path. It reads `.agents/skills/<skill>/evals/evals.json`, runs each case as a normal Task Run, then writes:

- a Markdown report under `.personal-agent/evals/<skill>/<eval-run-id>/report.md`,
- a machine-readable JSON result next to it,
- the underlying Task Run files for each case under `.personal-agent/runs`.

The manifest contract is documented in `schemas/skill-evals.schema.json`. It is an optional Personal Agent quality layer, not part of the Anthropic Skill runtime contract. The schema requires non-empty `skill_name` and an `evals` array; each eval case requires non-empty `id`, `prompt`, and `expected_output`. `files` and `grader` are optional so simple cases stay lightweight. When `files` is present, it must be an array of string paths; invalid entries are rejected instead of being silently filtered out.

The runtime parser uses a small allowlist check that mirrors the schema's `additionalProperties: false` rule. Unknown top-level manifest fields, eval case fields, and grader fields are rejected before any Task Run starts. The static Skill Pack inventory uses the same style of check, so normal Task Runs show `eval manifest: invalid (...)` instead of silently treating draft-only metadata as part of the contract. When several eval cases are invalid, both paths aggregate the case errors into one message while keeping single-error messages concise.

The first graders are intentionally deterministic. By default, a case uses `contains`: it passes when the final Task Report contains the `expected_output` string after Unicode normalization and case folding. A case can also declare `grader: { "type": "regex", "pattern": "..." }` when the expected evidence is better expressed as a pattern. Regex graders validate that `pattern` is a non-empty string before any Task Run starts, which makes manifest errors easier to fix. A case can also declare `grader: { "type": "tool_trace", "tool": "read_file" }` to pass only when the Task Run event log includes that Local Tool. `tool_trace` also accepts `input_contains`, for example `grader: { "type": "tool_trace", "tool": "read_file", "input_contains": "notes.md" }`, which checks the serialized input of matching tool call events. It also accepts `input_matches`, for example `grader: { "type": "tool_trace", "tool": "read_file", "input_matches": { "path": "notes.md" } }`, which checks a partial JSON object against the tool call input. `input_schema` applies a compact JSON Schema-style matcher to the tool call input, for example `grader: { "type": "tool_trace", "tool": "read_file", "input_schema": { "type": "object", "required": ["path"], "properties": { "path": { "type": "string" } } } }`. `output_contains` checks the serialized output of matching `tool_result` events, for example `grader: { "type": "tool_trace", "tool": "read_file", "output_contains": "alpha marker" }`. `output_matches` checks a partial JSON object against `tool_result.output`, for example `grader: { "type": "tool_trace", "tool": "run_command", "output_matches": { "exitCode": 0 } }`. `output_type` checks the top-level JSON-style output type, such as `object`, `array`, or `string`. `output_schema` applies the same compact schema matcher to `tool_result.output`, for example requiring `run_command` to return an object with numeric `exitCode` and string `stdout`. The compact schema subset supports `type`, `required`, `properties`, `items`, `const`, `enum`, and `additionalProperties: false`. This is not a full JSON Schema 2020-12 implementation; it is a small deterministic validator for eval fixtures that can later be replaced by Ajv or another full validator if real Skill Packs need broader schema features.

`model_judge` is the first semantic grader. A case can declare `grader: { "type": "model_judge", "rubric": "Pass only if ..." }`. After the normal Task Run finishes, the eval runner sends the prompt, expected output note, rubric, and final Task Report to the configured `ModelProvider`. The provider must return a `finish` step whose report contains JSON shaped like `{ "verdict": "pass" | "fail", "reason": "..." }`. This lets evals check quality that is difficult to express with deterministic text, trace, or schema checks.

`model_judge` also supports repeated judging: `judge_runs` controls how many judge calls to make, and `pass_threshold` controls how many `pass` verdicts are required. Both are optional integers from 1 to 5. Defaults are `judge_runs: 1` and `pass_threshold: judge_runs`. For example, `judge_runs: 3` with `pass_threshold: 2` passes when at least two of three judge calls return `pass`. This reduces single-call noise but increases cost and latency.

Every `model_judge` case now records a `judge` object in `results.json` with `runs`, `passThreshold`, `passedCount`, and the per-run verdict list. The Markdown report also includes the aggregate judge count and each judge run. If the judge returns malformed JSON, an unsupported verdict, a non-string reason, or a non-`finish` step, that run is recorded as `invalid` with a reason instead of disappearing into the aggregate pass/fail result. The result still depends on the judge model, prompt wording, and model availability, so it should be used for semantic quality checks rather than safety-critical gates until it has real golden examples.

## What Not To Do

- Do not treat a polished final answer as a pass.
- Do not let self-review override failed commands or missing confirmations.
- Do not hide unavailable verification; mark it clearly as unavailable.

## Reference

OpenAI's published evaluation guidance emphasizes creating task-specific graders and using evals to measure agent behavior, but its older Evals API is documented as being deprecated in 2026. For this project, keep the first evaluation path local and file-based, then integrate external eval services only when they fit the workflow.

- [OpenAI eval skills guide](https://developers.openai.com/blog/eval-skills)
- [OpenAI Evals API docs](https://platform.openai.com/docs/guides/evals)
