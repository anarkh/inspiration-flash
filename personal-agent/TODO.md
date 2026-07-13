# Personal Agent Capability Backlog

This backlog keeps valuable future capabilities visible without expanding the first Personal Agent MVP.

This file is intentionally unordered. [ROADMAP.md](./ROADMAP.md) defines implementation order, dependencies, and completion gates; ideas stay here until they are promoted into a roadmap phase.

## Memory Suggestions Robustness

Memory Suggestions v1 is complete enough for the agent loop, but robustness remains a long-running fixture and evaluation track.

Why it matters:
- Durable memory affects future Task Runs, so bad memory can compound over time.
- Natural-language memory quality has no fixed endpoint.
- New real-world tasks will reveal conflict, duplication, and quality patterns that the current deterministic checks do not cover.

Why it does not block the Skill Pack stage:
- The v1 flow is implemented, reviewable, gated, tested, and documented.
- Existing checks already skip obvious low-quality, duplicate, conflicting, temporary, and secret-looking candidates.
- Additional fixtures are incremental hardening, not missing core plumbing.

Future learning tasks:
- Add broader English and Chinese conflict phrasings.
- Add more project convention variants.
- Add false, unsupported, overconfident, and unstable fact fixtures.
- Define a benchmark-style accept/skip fixture set.
- Revisit semantic duplicate detection after Complex Embedding Retrieval exists.

## Complex Embedding Retrieval

Deferred from MVP.

Why it matters:
- Search Project Memory, Task Runs, Run Exports, and Skill Packs by meaning instead of keywords.
- Support larger Knowledge Base and long-running projects.
- Teach retrieval concepts: chunking, embeddings, indexing, metadata filters, freshness, and evaluation.

Why it is deferred:
- The first version can use small Markdown files, explicit Skill Pack descriptions, and text search.
- Poor retrieval can silently add stale or irrelevant context.
- It needs its own evaluation set before it should influence agent decisions.

Future learning tasks:
- Compare local vector stores, SQLite vector extensions, and hosted vector databases.
- Define chunking rules for Project Memory, Task Reports, and Skill Pack references.
- Add retrieval quality checks with known questions and expected source documents.
- Decide how retrieved context appears in the Decision Trace.

## Network Tool

Deferred from MVP.

Why it matters:
- Fetch current docs, prices, APIs, and public pages.
- Enable research-style Workspace Tasks.
- Teach network permissions, source citation, caching, and failure handling.

Why it is deferred:
- Network access increases privacy and prompt-injection risk.
- Authenticated services need credential handling and stricter Confirmation Gates.
- Browser automation and HTTP fetching have different safety models.

Future learning tasks:
- Design a Network Tool boundary separate from Local Tools.
- Require Confirmation Gates for external requests that send workspace content.
- Record requested URLs, request intent, response summaries, and citations in Task Runs.
- Add source-quality checks and prompt-injection defenses.

## Strong Skill Pack Runtime

Deferred from MVP.

Future direction:
- Guided Skill Use already reads Skill Packs as instructions and resource inventory.
- Guided Skill Use now summarizes static eval manifests and can execute declared eval cases through the normal Task Run loop.
- Skill Pack eval is complete enough for MVP use: deterministic graders, tool trace checks, compact schema checks, semantic `model_judge`, repeated judging, and judge-output diagnostics are implemented.
- Future eval work should calibrate `model_judge` with golden examples once real Skill Pack evals expose noisy semantic judgments.
- Future `tool_trace` work can replace the compact input/output schema matcher with a full JSON Schema validator such as Ajv if real Skill Packs need broader schema features.
- A future step may run declared scripts behind typed permissions and Confirmation Gates.
- A later runtime could expose Skill Packs as typed capabilities with manifests, permissions, tests, and versioning.

## Persistent Chat Hardening

Chat mode is implemented for one local process and one persistent Task Run, but richer conversation management remains future work.

Future learning tasks:
- Add a command that reopens a prior completed chat and appends new `owner_message` events in a linked run.
- Add long-chat summarization or retrieval before provider context grows too large.
- Add transcript export formatting that separates Owner messages from model messages.
- Decide whether chat needs cancellation, slash commands, or multi-line input.

## Framework Revisit

Deferred from MVP.

Revisit after the first loop has real Task Runs:
- If durable graph execution becomes the hard part, compare LangGraph.
- If tracing and handoffs become the hard part, compare the OpenAI Agents SDK.
- If retrieval-heavy knowledge workflows dominate, compare LlamaIndex.TS.
