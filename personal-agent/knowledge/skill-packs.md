# Skill Packs

## What We Implemented

The Personal Agent now supports the first layer of Guided Skill Use.

During a Task Run, the runner scans an ordered set of Skill Pack catalogs beginning with:

```text
.agents/skills/<skill-name>/SKILL.md
```

Workspace, user, package, and configured catalogs now share one deterministic precedence contract. See [Skill Sources And Precedence](./skill-sources.md) for source configuration, same-name conflict behavior, and the `codex/agent-ability` portability boundary.

It selects skills whose name or description overlaps with the current goal and Success Check, or accepts repeatable explicit `--skill` selectors. After confirmation when required, it loads the complete selected `SKILL.md` and passes it to the Model Provider as visible context.

This is not a strong plugin runtime yet. Skill scripts are not executed directly by the Skill Pack layer. Eval manifests can now be executed through the normal Task Run loop, but that still does not grant Skill Pack scripts automatic execution rights. `evals/` is a Personal Agent QA layer; it is not required by Anthropic-style Skill discovery.

## How It Works Here

`src/skills/skill-packs.ts` owns discovery and context formatting. `src/skills/skill-selection.ts` resolves CLI selectors. `src/skills/skill-guidance.ts` loads bounded instruction files and creates event-safe digest summaries. `src/skills/evals.ts` owns the local Skill Pack eval runner.

The MVP flow is:

1. Resolve ordered workspace, user, package, and configured skill catalogs.
2. For each catalog, read child directories in deterministic name order and load `SKILL.md` when present.
3. Parse a small frontmatter subset:

```yaml
---
name: docs-helper
description: Helps summarize workspace documentation and README files.
---
```

4. Parse optional `version` metadata and preserve source label, source root, and precedence.
5. Resolve same-name variants while retaining lower-priority conflicts for audit.
6. Collect an agent-ability style resource inventory from optional `references/`, `scripts/`, and `evals/` directories.
7. Read `evals/evals.json` when present and summarize whether it follows `schemas/skill-evals.schema.json`.
8. Extract lightweight keyword terms from the task goal, Success Check, skill name, and skill description.
9. Detect explicit Owner mentions such as `use docs-helper skill`.
10. When `--skill` is present, resolve its plain-name, source-qualified, or exact-path selectors instead of lexical matches.
11. Ask for confirmation before loading any automatically inferred Skill that was not explicitly named by the Owner.
12. Load each selected `SKILL.md` as strict UTF-8, enforcing 64 KiB per file and 128 KiB combined.
13. Format metadata, resource inventory, digest, and the complete instruction body as:

```markdown
# Relevant Skill Packs

## docs-helper

- path: .agents/skills/docs-helper/SKILL.md
- source: workspace (priority 1)
- source root: /path/to/workspace/.agents/skills
- description: Helps summarize workspace documentation and README files.
- resource inventory:
  - references: .agents/skills/docs-helper/references/guide.md
  - scripts are inventory only and are not auto-executed by the Skill Pack layer
  - scripts: .agents/skills/docs-helper/scripts/search_index.py
  - evals: .agents/skills/docs-helper/evals/evals.json
  - eval manifest: valid (1 eval)
- guidance: full SKILL.md (412 bytes, sha256 ...)

### Full SKILL.md Guidance

--- BEGIN SKILL PACK GUIDANCE ... ---
...complete selected SKILL.md...
--- END SKILL PACK GUIDANCE ... ---
```

The runner passes this context through `ModelProviderInput.skillPacks`. The OpenAI-compatible provider includes that field in the JSON prompt payload, so the default DeepSeek path receives the same Skill Pack context.

When a fresh Task Run selects Skill Packs, the runner records a `skill_packs` event containing selected names, paths, source metadata, versions, alternatives, resource inventory, explicit selector metadata, and guidance byte count plus SHA-256. The full instruction body is deliberately omitted. Task Export reads that event and renders a `Skill Packs Used` section.

When a fresh Task Run finds any automatically inferred match, the runner creates a `skill_packs` confirmation request through the same path used by Local Tools. The Owner can approve all, deny all, or return selected paths; the CLI accepts numbered choices such as `1,3`. A Skill explicitly named in task text or selected through `--skill` skips this inference confirmation. Selector resolution happens before Task Run creation, so invalid CLI selection cannot create orphan state.

Explicit selection examples:

```bash
a-agent run --skill docs-helper "summarize docs"
a-agent run --skill user:docs-helper "summarize docs"
a-agent run --skill configured:1:docs-helper "summarize docs"
```

A plain name uses normal source precedence. A source qualifier or displayed path can choose a shadowed variant. Selection is capped at four Skills and cannot include two source variants of the same normalized name. Resume reloads the recorded exact path and compares its SHA-256; changed guidance blocks the run before another provider call.

The Model Provider can use it to plan and choose tools, but the runner still executes only normal Agent Steps and Local Tools. Resource inventory paths are hints, not automatic execution permissions. When a Skill Pack exposes `scripts/`, the provider context and Task Export both add an explicit line that scripts are inventory only and are not auto-executed by the Skill Pack layer.

The eval runner adds a separate command:

```bash
a-agent eval skill-pack docs-helper
```

The command now resolves Skill Packs from every ordered source and can read an external eval manifest without copying the Skill Pack into the active workspace. Eval artifacts still belong to the active workspace.

Each eval Task Run receives the already resolved exact `SKILL.md` path as its explicit selector. This prevents a second lexical match from evaluating different guidance when other catalogs contain related Skills.

It resolves the Skill Pack by frontmatter name, directory name, skill directory path, or `SKILL.md` path. Then it reads `evals/evals.json`, turns each eval case into a normal Task Run that explicitly names the Skill Pack, and writes a report under `.personal-agent/evals/<skill>/<eval-run-id>/`. The manifest schema requires non-empty `skill_name` and `evals`; each case requires non-empty `id`, `prompt`, and `expected_output`. Unknown fields are rejected at the manifest, eval case, and grader levels, matching the schema's closed-object contract. Optional `files` entries must be strings when present, so fixture declarations stay explicit instead of being partially accepted. The first graders are deterministic: the default `contains` grader checks `expected_output`, an optional `regex` grader checks a declared non-empty pattern, and an optional `tool_trace` grader checks whether a named Local Tool appears in the Task Run event log. `tool_trace` can also require an `input_contains` substring, an `input_matches` partial JSON object, or an `input_schema` compact JSON Schema-style matcher so a case can verify the tool was called with the expected fixture path, argument fields, or typed input shape. `output_contains` verifies that a matching `tool_result` output contains expected evidence, `output_matches` verifies structured fields in `tool_result.output`, `output_type` verifies the result's top-level JSON-style type, and `output_schema` verifies a compact typed result shape. The compact schema matcher supports `type`, `required`, `properties`, `items`, `const`, `enum`, and `additionalProperties: false`. `model_judge` adds a semantic grader that sends the final Task Report and rubric to the configured `ModelProvider` and expects a JSON `pass` or `fail` verdict. Optional `judge_runs` and `pass_threshold` let the same case run up to five judge calls and require a configurable number of pass verdicts. Each model-judged case writes per-run judge details to both JSON and Markdown artifacts, including malformed judge output as `invalid`. This catches cases where the tool trace is structurally valid but the final report still fails the human intent, while preserving evidence for later calibration.

## Other Common Approaches

**Strong plugin runtime**:
Skills become typed capabilities with manifests, permissions, schemas, scripts, and versioning. This is powerful, but it creates more executable surface area.

**Embedding-backed skill retrieval**:
Skill selection uses vector search over full skill bodies. This handles broader wording, but it needs retrieval evaluation to avoid injecting irrelevant instructions.

**Manual skill selection only**:
The Owner names the skill explicitly. This is safe and predictable, but less helpful when the agent should recommend obvious guidance.

**Framework-native tools**:
Frameworks often expose skills as tool calls or sub-agents. That can be productive later, but it would bind this MVP to framework-specific contracts too early.

**Eval platforms and model graders**:
External eval platforms can run large suites with custom graders, datasets, and dashboards. They are useful after a capability has enough examples, but the first step here stays local so the Owner can inspect every Task Run and artifact.

## Why This Approach

The project needs a bridge between no Skill Pack support and the future `codex/agent-ability` runtime. A small discovery-and-context layer teaches how skills enter an agent loop while keeping execution behind existing Local Tools and Confirmation Gates.

## Advantages

- Keeps Skill Pack use visible and inspectable.
- Adds no new executable permission surface.
- Preserves a clean boundary for future `codex/agent-ability` integration.
- Uses deterministic keyword matching that is easy to test and explain.
- Lets the Owner override weak keyword matching by naming a Skill Pack explicitly.
- Lets the Owner use `--skill` to choose a precedence winner or a specific source variant.
- Loads the complete selected instruction file while keeping event and export artifacts compact.
- Binds resumed runs to the original guidance digest and source path.
- Lets the Model Provider receive relevant skill guidance without coupling Agent Steps to a skill runtime.
- Records selected Skill Packs in Task Export so later review can see which guidance influenced the run.
- Records selected Skill Pack resource inventory in Task Export so later review can see which paths were exposed.
- Labels Skill Pack scripts as inventory-only in provider context and Task Export, preserving the execution boundary for future runtimes.
- Reuses Confirmation Gates before any inferred Skill instructions are injected silently.
- Supports subset selection when several automatic matches are useful but not all should enter the model context.
- Recognizes agent-ability style `references/`, `scripts/`, and `evals/` resources without turning them into executable capabilities yet.
- Summarizes `evals/evals.json` validity and eval count in regular Task Runs.
- Runs declared Skill Pack eval cases on demand through the same Task Run loop used by normal agent work.
- Documents the optional eval manifest contract in `schemas/skill-evals.schema.json`.
- Rejects unknown eval manifest fields before running cases, keeping the file format explicit and teachable.
- Rejects invalid `files` arrays before running cases, matching the documented schema instead of dropping bad entries.
- Rejects empty required eval case strings before running cases, matching the schema's `minLength` rule.
- Reports multiple invalid eval cases together, reducing the edit-run loop when fixing a manifest.
- Reports empty regex grader patterns with a field-specific error instead of a generic unsupported-grader message.
- Supports `model_judge` graders when an eval needs rubric-based semantic report review.
- Supports `model_judge.judge_runs` and `model_judge.pass_threshold` when semantic judging should be repeated before accepting a pass.
- Records each `model_judge` verdict, reason, invalid output, and threshold aggregate in the eval artifacts.
- Supports `tool_trace` graders for deterministic checks over Local Tool usage.
- Supports `tool_trace.input_contains` when an eval must verify a specific tool argument fragment.
- Supports `tool_trace.input_matches` when an eval must verify structured tool argument fields.
- Supports `tool_trace.input_schema` when an eval must verify typed tool argument shape.
- Supports `tool_trace.output_contains` when an eval must verify evidence returned by a Local Tool.
- Supports `tool_trace.output_matches` when an eval must verify structured Local Tool result fields.
- Supports `tool_trace.output_type` when an eval must verify the top-level type of a Local Tool result.
- Supports `tool_trace.output_schema` when an eval must verify typed Local Tool result shape.

## Disadvantages

- Matching is lexical, so it can miss related skills with different wording.
- Only frontmatter name and description are used for matching.
- Resource inventory only lists paths; it does not load reference contents.
- Static eval manifest validation checks the local schema contract, including unknown fields and compact schema declarations, but does not use an external JSON Schema validator yet.
- Runtime eval grading supports `contains`, `regex`, `tool_trace`, and `model_judge`, but model-assisted grading is non-deterministic and depends on the configured provider.
- `tool_trace.input_contains` is substring-based, so it is easier to inspect than a schema matcher but less precise than typed argument validation.
- `tool_trace.input_matches` is a partial-object matcher, not a full JSON Schema validator.
- `tool_trace.input_schema` supports a compact schema subset, not every JSON Schema 2020-12 keyword.
- `tool_trace.output_contains` is substring-based and does not validate the full output shape.
- `tool_trace.output_matches` is a partial-object matcher, not a typed result schema.
- `tool_trace.output_type` checks only the top-level JSON-style value type.
- `tool_trace.output_schema` supports a compact schema subset, not every JSON Schema 2020-12 keyword.
- `model_judge` can catch semantic issues, but it adds model cost, latency, provider availability risk, and judge drift.
- Repeated `model_judge` runs reduce single-call noise but multiply model cost and still do not prove correctness.
- Model judge diagnostics make failures easier to audit, but they do not remove the need for real golden examples.
- Lexical explicit naming only checks that the Skill Pack name appears in task text; `--skill` is the stronger deterministic choice.
- Subset selection is path-based and terminal-oriented; there is no richer interactive picker yet.
- Skill scripts are not run by this layer; they must still be invoked through normal Local Tools.
- Full Skill instructions are untrusted model input, so choosing configured roots remains a supply-chain decision.
- Editing selected guidance intentionally blocks resume because silently changing instructions would make the run irreproducible.
- File and combined byte limits can reject unusually large Skills.

## Evaluation

Current tests verify:

- runner discovers `.agents/skills/<name>/SKILL.md`,
- runner discovers ordered workspace, user, package, and configured catalogs,
- same-name source precedence and optional versions are deterministic and preserved,
- Task Export and Decision Trace expose source conflicts,
- runner filters Skill Packs by task relevance,
- explicit Owner-named Skill Packs are prioritized over higher-scoring keyword matches,
- runner passes the complete selected `SKILL.md` to the Model Provider,
- runner records selected Skill Packs for Task Export,
- runner asks for confirmation before loading one or several automatically inferred Skill Packs,
- runner injects only the selected Skill Pack subset when confirmation returns selected paths,
- plain, source-qualified, and exact-path `--skill` selectors resolve deterministic variants,
- an explicit selector can choose a normally shadowed configured source,
- unknown selectors fail before Task Run state is created,
- guidance loading enforces UTF-8 and byte limits,
- events retain digest and byte count without retaining the full guidance body,
- resume retains the exact source and rejects changed guidance,
- terminal confirmation parsing maps numbered Skill Pack choices to selected paths,
- agent-ability style resource inventories are included in Skill Pack provider context,
- runner preserves resource inventory when passing selected Skill Packs to the Model Provider,
- `evals/evals.json` manifests are summarized as valid with an eval count when they match the schema contract,
- eval manifests without `skill_name` are rejected before cases run,
- eval manifests with unknown top-level, case, or grader fields are rejected before cases run,
- eval manifests with non-string `files` entries are rejected before cases run,
- eval manifests with empty required case strings are rejected before cases run,
- eval manifests with several invalid cases report all tested case errors together,
- eval manifests with empty regex grader patterns report a specific pattern error,
- the eval manifest JSON Schema documents the optional quality-layer contract,
- Skill Pack eval manifests can be executed from the CLI,
- configured external Skill Pack evals run without copying the Skill Pack into the target workspace,
- eval runner reports passing and failing cases with local Markdown and JSON artifacts,
- eval runner supports `contains`, `regex`, `model_judge`, `model_judge.judge_runs`, `model_judge.pass_threshold`, `tool_trace`, `tool_trace.input_contains`, `tool_trace.input_matches`, `tool_trace.input_schema`, `tool_trace.output_contains`, `tool_trace.output_matches`, `tool_trace.output_type`, and `tool_trace.output_schema` graders,
- eval runner records per-run `model_judge` details, including invalid judge output, in local artifacts,
- invalid eval grader declarations are rejected before cases run,
- OpenAI-compatible provider includes Skill Pack context in the model prompt payload,
- irrelevant Skill Packs are not injected for the tested task.

Future evaluation should add:

- invalid subset input fixtures and CLI pseudo-terminal coverage,
- golden-example calibration tests for `model_judge` after real Skill Pack evals produce enough examples,
- optional replacement of the compact `tool_trace` schema matcher with a full JSON Schema validator such as Ajv if real Skill Packs need broader schema features.
