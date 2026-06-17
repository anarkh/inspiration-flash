# Personal Agent Capability Backlog

This backlog keeps valuable future capabilities visible without expanding the first Personal Agent MVP.

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
- Guided Skill Use reads Skill Packs as instructions and may run declared scripts.
- A later runtime could expose Skill Packs as typed capabilities with manifests, permissions, tests, and versioning.

## Framework Revisit

Deferred from MVP.

Revisit after the first loop has real Task Runs:
- If durable graph execution becomes the hard part, compare LangGraph.
- If tracing and handoffs become the hard part, compare the OpenAI Agents SDK.
- If retrieval-heavy knowledge workflows dominate, compare LlamaIndex.TS.
