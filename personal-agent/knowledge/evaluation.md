# Task Evaluation

## Purpose

Every completed Task Run should receive a Task Evaluation. The goal is not to grade the model abstractly; it is to decide whether this concrete Task Run met the Owner's goal safely and left enough evidence to learn from it.

## Evaluation Output

Store a post-run evaluation with the Task Run:

```json
{
  "schemaVersion": 2,
  "verdict": "pass | partial | fail | blocked",
  "effectiveVerdict": "pass | partial | fail | blocked",
  "humanOverrides": [
    {
      "previousVerdict": "fail",
      "verdict": "pass",
      "reason": "Owner verified the generated artifact.",
      "createdAt": "..."
    }
  ],
  "executionIntegrity": {
    "verdict": "pass | partial | fail",
    "evidence": [{ "source": "event", "reference": "events.jsonl", "detail": "..." }],
    "checks": []
  },
  "taskCorrectness": {
    "verdict": "pass | fail | unavailable",
    "evidence": [{ "source": "report", "reference": "report.md", "detail": "..." }],
    "checks": []
  },
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

`src/agent/evaluation.ts` implements Evaluation V2 for `runTask` and `resumeLatestTask`. It reads visible artifacts: structured Success Checks, the final Task Report, provider-neutral events, workspace files, and generated Memory Suggestions.

Current behavior:
- `executionIntegrity` combines confirmation resolution, trace completeness, and report presence. Every check records the event or report artifact used by its verdict.
- `taskCorrectness` runs declared structured Success Checks. It is `unavailable` when the run has only a human-readable Success Check, because a non-empty report is not proof of correctness.
- `report_contains` checks normalized, case-folded Task Report text.
- `file_exists` verifies that a relative workspace path exists as a file.
- `file_contains` verifies normalized file content and rejects traversal or symlink escapes.
- `tool_succeeded` requires a successful matching `tool_result` event; rejected, denied, unresolved, non-zero command results, and unknown output shapes fail closed.
- `gateSafety` fails only if a confirmation-required tool result remains unresolved in the durable event trace.
- `traceQuality` is `pass` when the run contains both a plan and a finish step, `partial` when it finishes without a plan, and `fail` when no finish step is present.
- `reportQuality` passes when the final report has usable text.
- Memory Suggestions create a `Project Memory suggestion` learning signal and a `Review Memory Suggestions` follow-up.

The top-level `verdict` is deterministic: failed execution integrity or task correctness produces `fail`; unavailable task correctness or partial execution integrity produces `partial`; otherwise the run is `pass`. `effectiveVerdict` initially equals that result and changes only through an audited Owner override. The old scalar fields remain as compatibility summaries for history and existing integrations.

## Structured Success Checks

The `run` command accepts repeatable JSON checks:

```bash
a-agent run --check '{"id":"report","type":"report_contains","value":"package.json"}' "summarize this workspace"
a-agent run --check '{"id":"file","type":"file_exists","path":"summary.md"}' "create summary.md"
a-agent run --check '{"type":"file_contains","path":"summary.md","value":"Verification"}' "write the verified summary"
a-agent run --check '{"type":"tool_succeeded","tool":"write_file"}' "write summary.md"
```

`id` is optional; the CLI assigns `check-1`, `check-2`, and so on. Unknown fields, unsupported types, empty values, and duplicate ids are rejected before a Task Run starts. Checks are stored in `run.json`, and their results and evidence are stored in `evaluation.json`. Direct `run` and completed `resume` commands return a non-zero exit code when the objective verdict is `fail` or `blocked`.

`report_contains` is intentionally a weak content grader: a model can repeat expected text without solving the task. Prefer file and tool evidence for side-effecting tasks, and later combine deterministic checks with calibrated model judges for semantic quality.

## Golden Task Run Suite

`src/evals/golden-task-runs.ts` implements a repeatable regression suite for the six core workflows. Run it with:

```bash
a-agent eval golden
```

The command does not call DeepSeek or another remote model. Each case uses a fixed local `ModelProvider`, but still passes through the real runner, Local Tools, Confirmation Gate, checkpoints, state files, Task Evaluation, and Skill Pack eval code. Every suite run creates isolated case workspaces under `.personal-agent/evals/golden-task-runs/<eval-id>/workspaces/`, then writes a human-readable `report.md`, machine-readable `results.json`, and a `latest` pointer.

The golden contract is:

| Workflow | Evaluation source | Expected verdict | Evidence exercised |
| --- | --- | --- | --- |
| read | Task Evaluation | `pass` | `read_file`, report text, tool result |
| write | Task Evaluation | `pass` | approved `write_file`, file content, tool result |
| chat | Task Evaluation | `partial` | two Owner turns, two replies, unavailable objective correctness |
| memory | Task Evaluation | `pass` | reflection, Memory Suggestion, learning signal |
| resume | Task Evaluation | `pass` | saved plan, checkpoint replay, final report |
| Skill Pack | Skill Pack eval | `pass` | discovery, guidance injection, manifest grader |

A golden case passes only when its actual verdict equals the declared expected verdict and its workflow-specific artifact assertions hold. This distinction matters for chat: `partial` remains visible and is the expected baseline, while the golden *case* passes because the runtime reproduced that honest result. Skill Pack grading is also kept separate from the underlying Task Evaluation, which remains `partial` when no structured Success Check was declared.

Compared with alternatives:

- Snapshot tests compare serialized output cheaply, but fail on harmless timestamp and path changes and can miss behavioral errors. Golden cases compare semantic verdicts and inspect selected artifacts instead.
- Replaying production traces gives more realistic coverage, but introduces private data, provider drift, and nondeterministic model output. These fixtures are synthetic and secret-free.
- Hosted eval platforms add experiment tracking and cross-model statistics, but require network access and more infrastructure. The local suite is fast, inspectable, and works offline.

The advantage is stable end-to-end coverage of stateful agent workflows with direct failure artifacts. The limitations are equally important: fixed providers do not measure real-model quality, six fixtures do not represent the full task distribution, and expected verdict changes require an intentional fixture update. Real-provider and production-derived evals should be added later as separate layers, not mixed into this deterministic gate.

## Alternatives And Tradeoffs

Common agent systems use several evaluation approaches:

- Natural-language self-evaluation is easy to add but can reward confident, polished reports. Evaluation V2 never lets self-review replace deterministic evidence.
- Model judges, as used by many hosted eval platforms, handle semantic quality but add cost, latency, and nondeterminism. This project keeps them optional and auditable.
- Full evaluation frameworks provide datasets, dashboards, and experiment tracking. They are valuable at scale, but would hide too much machinery for this local learning stage.
- Deterministic artifact checks are cheap, repeatable, and explainable, but cover only outcomes that can be expressed as text, files, or tool events.

The local structured approach therefore favors inspectability and stable regression checks. Its disadvantages are a small check vocabulary, possible grader gaming for text checks, and no statistical comparison across models yet.

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

## Human Verdict Override

The Owner can record a reviewed verdict for the latest or a named Task Run:

```bash
a-agent eval override --verdict pass --reason "Owner verified the generated artifact."
a-agent eval override <run-id> --verdict partial --reason "One edge case remains unresolved."
```

`src/state/evaluations.ts` reads the existing `evaluation.json`, validates its deterministic verdict and audit history, then appends:

```json
{
  "previousVerdict": "fail",
  "verdict": "pass",
  "reason": "Owner verified the generated artifact.",
  "createdAt": "2026-07-23T..."
}
```

The original `verdict`, dimensions, checks, and evidence are never replaced. Only `effectiveVerdict` changes, and every later override appends another record whose `previousVerdict` points to the earlier effective result. `a-agent history` displays the effective verdict with its deterministic baseline; Task Export includes the full audit history. A non-empty reason is mandatory, and active runs without `evaluation.json` cannot be overridden.

This is deliberately different from model-assisted review. A model review is advisory and cannot override deterministic evidence. The local Owner is the final authority and may change the effective conclusion, but the stored reason makes that judgment inspectable rather than silently authoritative.

Alternatives and tradeoffs:

- Replacing `verdict` in place is simpler, but destroys the distinction between machine evidence and human judgment and loses earlier decisions.
- A separate override sidecar file keeps evaluation immutable, but every history, export, and integration reader must join two artifacts and handle divergence.
- A database-backed event ledger offers stronger transactions and concurrent editing, but is premature while Task Runs are single-process local files.

The chosen append-only field is compact, backward-compatible with older evaluations that contain only `verdict`, and easy to export. Its limitations are that file writes are not yet concurrency-safe and a human can intentionally mark a deterministic safety failure as effectively passing. The UI therefore always exposes the deterministic baseline rather than presenting the override as machine proof.

Verification covers initial field creation, two consecutive overrides, reason trimming, legacy evaluation compatibility, missing-run and missing-evaluation behavior, history display, Task Export, and invalid CLI arguments.

## Automated vs Human Evaluation

Current version:
- Run deterministic checks over the Task Run files.
- Run the six deterministic Golden Task Run fixtures with `a-agent eval golden`.
- Run Skill Pack eval manifests locally with `a-agent eval skill-pack <name-or-path>`.
- Optionally ask the selected real Model Provider for a structured self-review with `--review`.
- Let the Owner record an audited effective verdict with `a-agent eval override`.

Later versions:
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
