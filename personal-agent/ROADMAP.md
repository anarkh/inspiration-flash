# Personal Agent Roadmap

This is the ordered source of truth for post-MVP development. The completed first-version design remains in [PLAN.md](./PLAN.md), while unprioritized ideas remain in [TODO.md](./TODO.md).

## Product Direction

Build a local-first Personal Agent that is:

- useful for real workspace tasks,
- safe and inspectable before it becomes powerful,
- compatible with reusable Skill Packs and the future `codex/agent-ability` runtime,
- evaluated by task outcomes rather than plausible reports,
- educational enough that each capability teaches the underlying agent concept.

## Ordering Rule

Each phase must meet its completion gate before the next phase becomes the default workstream. Small bug fixes may still land, but later capabilities must not bypass missing safety or evaluation foundations.

## Phase 1: Freeze The MVP Baseline

Status: complete with the first `codex/personal-agent-mvp` baseline commit.

Deliverables:

- Track all MVP source, tests, schemas, and bilingual knowledge files.
- Add installation and usage documentation.
- Ignore workspace-local `.personal-agent/` runtime state.
- Preserve `PLAN.md` as completed MVP history and separate ordered work from backlog ideas.
- Verify tests, type checking, build, global-link execution, and a real-provider smoke path.

Completion gate:

- A fresh checkout can install, build, link, and run the CLI from documented commands.
- The working tree contains no accidentally untracked MVP implementation files.
- Runtime state and model credentials are not committed.

Learning focus: release baselines, reproducibility, and configuration boundaries.

## Phase 2: Task Evaluation V2

Status: in progress. Structured Success Checks, evidence-bearing execution/correctness dimensions, CLI failure exit codes, and Golden Task Run fixtures are implemented. Human verdict override remains.

Deliverables:

- Separate execution integrity from task correctness.
- Add executable or structured Success Checks for supported task classes.
- Build golden Task Run fixtures for read, write, chat, memory, resume, and Skill Pack workflows. (complete)
- Add human verdict override with an audit reason.
- Record evidence used by every evaluation dimension.

Completion gate:

- A deliberately wrong non-empty report fails at least one objective evaluator.
- Golden cases run repeatedly with stable expected verdicts.
- Evaluation output explains which visible artifact caused each verdict.

Learning focus: agent evaluation, deterministic graders, model judges, and human review.

## Phase 3: Ability Bridge And Skill Sources

Deliverables:

- Discover Skill Packs from ordered workspace, user, package, and configured roots.
- Preserve source and version metadata when several roots contain the same skill name.
- Add explicit Skill Pack selection to the CLI.
- Define the compatibility boundary for `codex/agent-ability` resources.
- Run existing Skill Pack evals without copying skills into every target workspace.

Completion gate:

- `a-agent` can use and evaluate a configured `codex/agent-ability` skill from an unrelated temporary workspace.
- Source precedence and conflicts are deterministic and visible in the Decision Trace.

Learning focus: capability discovery, precedence, portability, and compatibility contracts.

## Phase 4: Typed Tool And Skill Runtime

Deliverables:

- Replace the hard-coded tool switch with a typed tool registry.
- Validate tool inputs and outputs with declared schemas.
- Add per-tool permissions, timeout, cancellation, output limits, and redaction.
- Execute approved Skill Pack scripts through the same Confirmation Gate as Local Tools.
- Strengthen command parsing and risk classification without invoking a shell implicitly.

Completion gate:

- A Skill Pack script can execute only after schema validation and required approval.
- Unsafe, oversized, timed-out, and malformed tool calls produce durable, testable failures.

Learning focus: tool calling, capability security, schemas, and sandbox boundaries.

## Phase 5: Conversation And Context V2

Deliverables:

- Reopen a previous conversation in a linked Task Run.
- Export role-separated chat transcripts.
- Add deterministic context compaction before embedding retrieval exists.
- Support cancellation and practical multi-line terminal input.
- Track model-input and model-output token usage with unambiguous field names.

Completion gate:

- A new process can continue a prior conversation with enough visible context.
- A long-chat fixture stays within a configured context budget and preserves key facts.

Learning focus: sessions, context windows, summarization, and conversation memory.

## Phase 6: Safe Network Tool

Deliverables:

- Start with read-only public HTTP fetch and search boundaries.
- Require confirmation before sending workspace content outside the machine.
- Record URL, request purpose, response summary, cache status, and citations.
- Add source-quality and prompt-injection checks.
- Keep authenticated services outside the first network slice.

Completion gate:

- Research fixtures return inspectable citations.
- Tests prove private workspace text is not sent without explicit approval.

Learning focus: data egress, citations, hostile content, caching, and network permissions.

## Phase 7: Hybrid Retrieval

Deliverables:

- Define chunking and metadata for Project Memory, Task Runs, exports, knowledge, and Skill references.
- Establish a lexical baseline before enabling embeddings.
- Add a local embedding index and hybrid ranking only when the baseline is measurable.
- Expose retrieved sources and scores in the Decision Trace.
- Evaluate relevance, stale-context rejection, and source attribution.

Completion gate:

- A versioned retrieval fixture set measures expected-source recall and irrelevant-source rejection.
- Retrieval can be disabled without changing the rest of the agent loop.

Learning focus: chunking, embeddings, indexing, hybrid search, and retrieval evaluation.

## Phase 8: Reliability, Observability, And Framework Gate

Deliverables:

- Add provider retry, rate-limit handling, streaming, cost accounting, and error classes.
- Add state locking or transactional storage before parallel Task Runs.
- Support deterministic run replay and regression comparison.
- Define release compatibility and migration rules for stored Task Runs.
- Re-evaluate agent frameworks against measured runtime pain.

Completion gate:

- Failure-injection tests cover provider, tool, state, and interruption paths.
- A release candidate passes golden tasks and migration checks from the MVP baseline.
- Any framework adoption has a written ADR tied to a demonstrated problem.

Learning focus: production reliability, observability, concurrency, migrations, and architecture decisions.

## Framework Decision Gate

Keep the first-party Agent Step loop through Phases 2-7. Ordinary libraries may be used behind existing boundaries, but the core runtime should move only when evidence supports one of these conditions:

- durable graph execution and human-in-the-loop orchestration dominate complexity: evaluate LangGraph,
- tracing and multi-agent handoffs dominate complexity: evaluate the OpenAI Agents SDK,
- retrieval workflows dominate the product: evaluate LlamaIndex.TS.

Framework adoption is not a roadmap phase by itself. It is a response to measured complexity and requires an ADR plus migration evaluation.

## Definition Of Done For Every Phase

- Focused tests and end-to-end verification cover the changed behavior.
- Task Evaluation fixtures are added before the capability is trusted by default.
- English and Chinese knowledge articles explain implementation, alternatives, tradeoffs, and evaluation.
- Runtime artifacts remain inspectable and secret-safe.
- `npm test`, `npm run typecheck`, and `npm run build` pass.
