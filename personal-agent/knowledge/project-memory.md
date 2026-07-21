# Project Memory

## What We Implemented

The CLI now supports:

```text
a-agent memory
a-agent memory append "<note>"
a-agent memory append --section <section> "<note>"
a-agent memory apply-suggestions [--yes] [run-id]
```

`memory` prints the current workspace's `.personal-agent/memory.md`. `memory append` adds a short Owner-provided note to that file. `--section` inserts the note under a named memory section. `apply-suggestions` applies reviewed candidate notes from a Task Run.

## How It Works Here

Workspace initialization already creates:

```text
.personal-agent/memory.md
```

`readProjectMemory(workspace)` ensures the workspace state exists and reads the file. `appendProjectMemory(workspace, note, section?)` trims the note, rejects empty notes, and writes a Markdown bullet. Without a section it preserves the simple append-only behavior. With a section it inserts the note before the next second-level heading.

The first categorized editor remains explicit: the Owner chooses the target section. Task Runs can also produce Memory Suggestions from `reflect` steps, but those suggestions remain candidate files until the Owner applies them with confirmation or explicit `--yes`.

During Task Runs, the runner filters Project Memory before injecting it into the Model Provider input. It keeps notes with keyword overlap against the current goal and Success Check, and falls back to the full memory file when nothing matches. This is lightweight keyword retrieval, not semantic embedding retrieval.

## Section Meanings

| Section | Meaning | Example |
| --- | --- | --- |
| Stable Facts | Long-lived facts that are unlikely to change and useful across future tasks. | `This project is a local CLI personal agent.` |
| Preferences | The Owner's interaction, output, and implementation preferences. | `Prefer Chinese for conversation.` |
| Project Conventions | Engineering rules for this repository. | `Chinese Knowledge Base articles live under knowledge/zh/.` |
| Open Threads | Follow-up items, unresolved questions, or future learning topics. | `Implement embedding retrieval later.` |

The CLI section names are:

```text
stable-facts
preferences
project-conventions
open-threads
```

## Other Common Approaches

**Vector memory**:
Store notes as embeddings and retrieve relevant memories by semantic search. This is powerful for large memory stores, but adds model cost, indexing complexity, and harder-to-debug retrieval behavior.

**Structured profile database**:
Store preferences and facts in SQLite or JSON tables. This supports typed updates and deduplication, but makes early learning less transparent than a single Markdown file.

**Conversation-derived memory**:
Ask the model to summarize completed conversations into memory automatically. This can reduce manual work, but needs careful evaluation to avoid saving incorrect or overly broad facts.

## Why This Approach

The Owner needs an inspectable checkpoint for durable preferences before adding more autonomous memory writes. A local Markdown file is easy to read, edit, diff, and test.

## Advantages

- No extra service, model call, or database dependency.
- Easy to inspect and repair by hand.
- Keeps the distinction between Knowledge Base and Project Memory clear.
- Supports both quick append and explicit categorized writes.
- Works with Memory Suggestions without automatically saving unreviewed facts.
- Makes stored memory visible to fresh and resumed Task Runs.
- Applies quality gates to Memory Suggestions before they become durable memory.
- Skips exact and simple near-duplicate Memory Suggestions before they become durable memory.
- Skips simple same-topic conflicting Memory Suggestions before they become durable memory.
- Skips English and Chinese direct-implementation versus proposal-only Memory Suggestion conflicts before they become durable memory.
- Skips simple avoidance-worded project convention conflicts before they become durable memory.
- Skips generic unactionable Memory Suggestions before they become durable memory.

## Disadvantages

- Categorization is still manual.
- Manual append has no deduplication or conflict resolution.
- Relevant-memory filtering is lexical, so it can miss related notes that use different wording.
- Near-duplicate detection is deterministic and alias-based, not full semantic search.
- Conflict detection is deterministic and based on term groups plus simple negation/prohibition/avoidance, not broad reasoning.
- If no memory notes match the current task, the runner still falls back to the full memory file.

## Evaluation

Current tests verify:

- `a-agent memory` initializes and prints Project Memory.
- `a-agent memory append "<note>"` persists a note.
- `a-agent memory append --section <section> "<note>"` inserts a note under the chosen section.
- `a-agent memory apply-suggestions --yes [run-id]` applies candidate notes into the correct sections.
- state helpers can read and append memory directly.
- state helpers can insert memory notes inside named sections.
- Task Runs filter out irrelevant Project Memory notes when at least one note matches the current task.
- Memory Suggestions application skips exact and simple near-duplicate notes that already exist in Project Memory.
- Memory Suggestions application skips simple same-topic conflicting notes.
- Memory Suggestions application skips English and Chinese direct-implementation versus proposal-only preference conflicts.
- Memory Suggestions application skips simple same-topic negated stable facts.
- Memory Suggestions application skips simple same-topic prohibited or avoided project conventions.
- Memory Suggestions application skips simple Chinese conflicting preferences.
- Memory Suggestions application skips low-quality, generic, temporary, and secret-looking notes.

Future evaluation should verify:

- broader conflict-aware memory checks beyond the lightweight term groups.
- precision and recall of lightweight memory filtering before adding embeddings.
