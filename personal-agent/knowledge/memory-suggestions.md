# Memory Suggestions

## What We Implemented

Task Runs can now produce candidate Project Memory notes from model `reflect` steps.

When a model emits:

```json
{
  "type": "reflect",
  "section": "preferences",
  "note": "Owner prefers concise CLI output."
}
```

the runner writes a candidate entry to:

```text
.personal-agent/runs/<run-id>/memory-suggestions.json
```

The suggestion is also included in `a-agent export [run-id]` under `Memory Suggestions`.

Reviewed suggestions can be applied with:

```text
a-agent memory apply-suggestions [run-id]
a-agent memory apply-suggestions --yes [run-id]
```

## How It Works Here

`reflect` is still a provider-neutral Agent Step, but it can now carry an optional `section`.

Supported sections match Project Memory:

- `stable-facts`
- `preferences`
- `project-conventions`
- `open-threads`

The runner collects `reflect` events when the Task Run finishes, normalizes the section, and stores each item as:

```json
{
  "section": "preferences",
  "note": "Owner prefers concise CLI output.",
  "reason": "Model reflection during the Task Run",
  "source": "model_reflect"
}
```

These are candidates only. They are not automatically written to `.personal-agent/memory.md`.

`memory apply-suggestions` reads the candidate file and applies approved notes into the matching Project Memory section. Before asking for approval or writing, the CLI runs a deterministic quality gate, checks for conflicts, and checks whether the suggested note already exists anywhere in Project Memory. Existing, near-duplicate, conflicting, or low-quality notes are skipped so repeated, unsafe, or weak suggestions do not become durable memory.

In an interactive terminal, the CLI asks before each non-skipped note. In non-interactive scripts, `--yes` is required and means "apply every non-skipped suggestion from this run."

Duplicate detection is intentionally narrow and explainable. It first trims the note, collapses repeated whitespace, and compares case-insensitively. If that exact check misses, it also compares canonical term overlap with a small alias table for common wording such as `brief`/`concise`, `command line`/`CLI`, and `likes`/`prefers`.

This catches simple paraphrases like `Owner likes brief command line output.` when `Owner prefers concise CLI output.` already exists. It is not embedding search and does not understand arbitrary semantics.

Conflict detection is also deliberately narrow. Today it detects simple same-topic oppositions such as `Owner prefers concise CLI output.` versus `Owner prefers verbose CLI output.`, direct-implementation versus proposal-only preferences such as `Owner prefers the agent to implement changes directly.` versus `Owner prefers the agent to only propose changes.`, Chinese autonomy conflicts such as `用户偏好 agent 直接修改代码。` versus `用户偏好 agent 先确认再执行。`, Chinese preference conflicts such as `用户偏好精简输出。` versus `用户偏好详细输出。`, same-topic negation conflicts such as `Project uses LangChain.` versus `Project does not use LangChain.`, and simple prohibition or avoidance conflicts such as `Generated code must include necessary comments.` versus `Generated code should avoid comments.`. The CLI reports the existing note and skips the candidate instead of applying it under `--yes`.

The quality gate currently rejects:

- very short notes that are unlikely to be useful as durable memory; compact Chinese notes can pass through a Han-character threshold,
- notes containing common secret patterns such as API keys, bearer tokens, or `sk-...` keys,
- temporary notes with words such as `today`, `tomorrow`, `this task`, `for now`, `今天`, or `暂时`,
- generic notes that do not guide future decisions, such as `The project is important.` or `Owner wants good results.`

This quality gate is deliberately conservative and deterministic. It catches obvious bad candidates before they enter `.personal-agent/memory.md`, but it does not judge truth or subtle usefulness.

## Definition of Done

Memory Suggestions has two separate tracks:

- **v1 capability**, which is complete enough to use in the agent loop,
- **robustness backlog**, which keeps expanding fixtures and edge-case checks over time.

The v1 capability is considered complete because the project can now:

- collect candidate memory notes from provider-neutral `reflect` steps,
- store candidates as `memory-suggestions.json` inside a Task Run,
- show candidates in Task Export,
- apply reviewed candidates through `a-agent memory apply-suggestions`,
- require explicit approval or `--yes` before writing durable Project Memory,
- run quality gates before approval,
- skip exact and simple near-duplicate notes,
- skip known simple conflicts,
- preserve an audit path from model reflection to candidate note to durable memory,
- verify the flow with automated tests and bilingual Knowledge Base docs.

The robustness backlog is intentionally not a blocker for later stages. It is a long-running evaluation track because natural-language memory quality has no fixed endpoint. New fixtures should be added whenever a real or plausible bad memory pattern appears.

## Robustness Backlog

Keep improving Memory Suggestions with:

- more English and Chinese conflict phrasings,
- more project convention variants,
- false, unsupported, or overconfident fact filtering,
- unstable fact filtering beyond simple temporary words,
- better section selection checks,
- broader near-duplicate detection,
- future embedding-backed semantic duplicate checks,
- benchmark-style fixture sets with expected accept/skip decisions.

Entering the Skill Pack stage does not mean this backlog is finished. It means Memory Suggestions v1 has a usable, tested safety baseline, so broader agent capabilities can continue while memory robustness improves in parallel.

## Other Common Approaches

**Automatic memory writes**:
Some agents write memories immediately after a conversation. This is convenient, but risky because false or temporary facts can become durable.

**Embedding-only memory**:
Some systems store every summary in a vector database. This can help retrieval later, but it makes review, deletion, and correction harder in a learning-first local agent.

**Human-only memory maintenance**:
The Owner manually writes every memory note. This is safest, but easy to forget after long or repetitive runs.

**Batch approval**:
Some systems apply every suggested memory in one action. This is efficient, but the approval surface can become too broad. This project supports batch approval only through the explicit `--yes` flag.

## Why This Approach

The project needs a bridge between model reflection and durable memory. Candidate files preserve the model's suggestion while keeping the Owner in control of what becomes long-term Project Memory.

## Advantages

- Keeps memory writes reviewable.
- Uses the existing Agent Step loop instead of adding another model call.
- Makes suggested memories visible in Task Export.
- Preserves a clear audit trail from reflection to candidate note.
- Supports interactive per-note approval and explicit batch approval.
- Skips exact and simple near-duplicate notes before they are written to Project Memory.
- Skips simple same-topic conflicting notes before they are written to Project Memory.
- Skips English and Chinese direct-implementation versus proposal-only preference conflicts before they are written to Project Memory.
- Skips simple project convention conflicts that use avoidance wording before they are written to Project Memory.
- Rejects obviously low-quality, generic, temporary, or secret-looking suggestions before approval.

## Disadvantages

- The current runner only collects explicit `reflect` steps.
- Near-duplicate detection is lexical plus a small alias table, so it can still miss broader paraphrases.
- Conflict detection is lexical and only covers known opposing term groups plus simple negation/prohibition/avoidance terms.
- Quality checks are heuristic and can miss subtle bad memories, including generic wording not covered by the current patterns.
- The Chinese-friendly length rule is still a simple character-count heuristic.
- Manual `memory append` can still create duplicates because deduplication currently applies only to Memory Suggestions.
- Invalid sections fall back to `open-threads`, which is safe but not always ideal.

## Evaluation

Current tests verify:

- `reflect` steps can carry a memory section,
- the runner writes `memory-suggestions.json`,
- exported Task Run Markdown includes Memory Suggestions when present.
- state helpers can read Memory Suggestions,
- CLI `memory apply-suggestions --yes [run-id]` writes suggestions into Project Memory.
- CLI `memory apply-suggestions --yes [run-id]` skips suggestions that already exist in Project Memory.
- CLI `memory apply-suggestions --yes [run-id]` skips simple near-duplicate paraphrases.
- CLI `memory apply-suggestions --yes [run-id]` skips simple same-topic conflicting preferences.
- CLI `memory apply-suggestions --yes [run-id]` skips English and Chinese direct-implementation versus proposal-only preference conflicts.
- CLI `memory apply-suggestions --yes [run-id]` skips simple Chinese conflicting preferences.
- CLI `memory apply-suggestions --yes [run-id]` skips simple same-topic negated stable facts.
- CLI `memory apply-suggestions --yes [run-id]` skips simple same-topic prohibited or avoided project conventions.
- CLI `memory apply-suggestions --yes [run-id]` skips short, temporary, secret-looking, and generic unactionable suggestions.

Future evaluation should add:

- embedding-backed duplicate checks for broader paraphrased notes,
- broader conflict fixtures for more project convention shapes and more stable fact shapes,
- richer quality checks for false, unsupported, or unstable memory notes.
