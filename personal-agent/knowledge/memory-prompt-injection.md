# Memory Prompt Injection

## What We Implemented

Every Task Run now injects relevant Project Memory into `ModelProviderInput.projectMemory`.

The runner reads the current workspace Project Memory, selects notes that match the current goal and Success Check, and sends that filtered Markdown to the Model Provider. The OpenAI-compatible provider includes that field in the JSON payload sent to the model, so real providers can use durable preferences and project conventions during planning and execution.

## How It Works Here

`continueTaskRun` reads:

```text
.personal-agent/memory.md
```

once before the model loop starts. `selectRelevantProjectMemory` parses Markdown bullet notes under the known memory sections, scores notes by lightweight keyword overlap with the goal and Success Check, and formats the selected notes back into Markdown.

If no notes match, the runner falls back to the full memory file. This preserves the earlier "memory is visible" behavior for sparse memory files while reducing irrelevant context once matching notes exist.

This is keyword filtering, not semantic retrieval. It does not create embeddings, indexes, or extra model calls.

In this document and the implementation, `term` means a keyword-like retrieval item extracted by our own rules. It is not the same as a large language model token used for context length or billing.

## Relevant Memory Filtering Algorithm

`selectRelevantProjectMemory` uses a small, explainable pipeline:

1. Parse the Markdown memory file.
   It scans `##` section headings and `-` bullet notes. Each parsed note keeps its section, text, and original order.

2. Build query terms from the current task.
   The query text is `goal + successCheck`. English-like text is normalized to lowercase words, with common stop words such as `the`, `and`, `project`, and `task` removed.

3. Add Chinese-friendly terms.
   Chinese text often has no spaces, so the term extractor also adds Han characters and adjacent two-character terms. For example, `知识库` can contribute `知`, `识`, `库`, `知识`, and `识库`.

4. Score every memory note.
   A note gets 1 point for each unique term it shares with the task query. Repeated matches of the same term do not increase the score.

5. Keep matching notes.
   Notes with score `0` are removed. Matching notes are sorted by score descending, then by their original memory order. The default limit is 12 notes.

6. Format selected notes back into Markdown.
   The selected notes are grouped under their original Project Memory sections and sent to the Model Provider as visible `projectMemory`.

Fallback behavior is intentional:

- If the memory file has no parsed bullet notes, return the full memory file.
- If the task produces no useful query terms, return the full memory file.
- If no notes match, return the full memory file.

This fallback keeps early small-memory behavior forgiving. The tradeoff is that a task with no lexical match can still receive unrelated memory. That is acceptable for the MVP, but it should be evaluated before memory grows large.

## Other Common Approaches

**Full prompt injection**:
Send all memory text on every model call. This is simple and transparent, but can waste context when memory grows.

**Keyword filtering**:
Parse memory notes and keep notes with lexical overlap. This is cheap and inspectable, but misses paraphrases.

**Semantic retrieval**:
Embed memory notes and retrieve only relevant items. This scales better, but adds indexing, model cost, and harder-to-debug retrieval behavior.

**Structured profile fields**:
Store preferences and conventions as typed fields. This gives cleaner control, but is less natural for a learning-first Markdown memory file.

## Why This Approach

The project is still local and learning-oriented. Keyword filtering teaches the first retrieval concept without introducing vector databases or embedding costs. The full-memory fallback keeps early behavior forgiving while the memory file is still small.

## Advantages

- Still simple and local.
- Easy to inspect and test.
- Works for both fresh runs and resumed runs.
- Keeps Project Memory as the single source of truth.
- No embeddings, database, or extra model call required.
- Reduces obviously irrelevant notes when the task has matching memory.

## Disadvantages

- Keyword overlap can miss semantically related notes with different wording.
- If no notes match, full memory is still injected as a fallback.
- There is no secret redaction yet.
- The model can still ignore memory; injection is context, not a hard rule.

## Evaluation

Current tests verify:

- `runTask` passes Project Memory to the Model Provider,
- `runTask` filters out irrelevant notes when a relevant note matches the task,
- `resumeLatestTask` also passes Project Memory,
- the OpenAI-compatible provider includes Project Memory in the request payload.

Future evaluation should add:

- prompt-size limits,
- secret scanning before injection,
- precision and recall checks for keyword matching,
- embedding retrieval once memory grows beyond a small Markdown file.
