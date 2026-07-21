# Clarification Gates

## What We Implemented

The CLI now has a first Clarification Gate for `a-agent run "<task>"` and `a-agent start`.

When the task is obviously ambiguous, such as `处理一下` or `do it`, the CLI stops before creating Task Run state and asks for a concrete outcome. In non-interactive `run` calls, the command exits with status `1` instead of guessing. In the line-based `start` REPL, the next non-empty line becomes the clarification answer.

## How It Works Here

`src/cli/index.ts` applies `clarifyRunTaskIfNeeded(task)` before `run` calls `runCliTask(task)`. The `start` REPL uses the same ambiguity detector and stores a pending ambiguous task until the Owner enters a clarification line.

The first detector is intentionally conservative:

- it normalizes the task with Unicode NFKC,
- it matches a small allowlist of vague English and Chinese phrases,
- it does not block short but concrete commands such as `ls`, `build`, or `run tests`.

When a task needs clarification, the CLI prints:

```text
[agent] clarification required
reason: task boundary is ambiguous
question: What concrete outcome should this task produce?
```

Interactive terminals can answer the prompt. Non-interactive `run` invocations cannot answer, so they fail before `.personal-agent/runs/` state is created. Piped `start` invocations can answer because the next input line is treated as the clarification.

## Other Common Approaches

**Model-led clarification**:
Send every task to the model and let it decide whether to ask a question. This is flexible, but it still creates a run and may allow the model to guess before the boundary is clear.

**Schema-first intake forms**:
Require structured fields such as objective, constraints, and success criteria before every task. This is rigorous, but too heavy for a CLI-first agent.

**Broad heuristic scoring**:
Use length, verbs, objects, and confidence scores to classify ambiguous tasks. This catches more cases, but it risks blocking valid short commands.

## Why This Approach

The MVP needs a visible Clarification Gate without turning task intake into a large natural-language classifier. A small phrase list gives us a tested safety rail for the clearest ambiguous requests and keeps false positives low.

## Advantages

- Prevents the agent from creating durable state for a task with no clear object or outcome.
- Keeps the gate visible in stderr.
- Works without a model provider.
- Keeps `run` and `start` task intake behavior aligned.
- Avoids broad heuristics that would block concise valid tasks.

## Disadvantages

- It only catches known vague phrases.
- The clarified answer is currently appended to the task text instead of being stored as a separate structured field.

## Evaluation

Current tests verify:

- `a-agent run "处理一下"` exits with status `1`,
- the CLI prints a clarification-required message,
- no completed Task Run is reported for the ambiguous task.
- `a-agent start` asks for clarification when a REPL task is ambiguous,
- the clarified REPL task creates one Task Run whose goal includes the original ambiguous request and the clarification.

Future evaluation should add:

- interactive clarification answer flow,
- EOF during a pending `start` clarification,
- broader English and Chinese ambiguous phrasing fixtures,
- storage of the original task and clarified outcome as separate fields.
