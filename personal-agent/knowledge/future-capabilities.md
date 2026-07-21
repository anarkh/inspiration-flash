# Future Capabilities

The Capability Backlog lives in [../TODO.md](../TODO.md). This article explains how deferred capabilities should be learned and evaluated before entering the MVP.

## Complex Embedding Retrieval

Do not add embedding retrieval just because the files grow. Add it when keyword matching and explicit Skill Pack selection are no longer enough.

Before implementation, prepare:
- representative questions
- expected source documents
- stale-context examples
- precision and recall checks
- a rule for showing retrieved sources in the Decision Trace

Main risk:
Bad retrieval makes the Personal Agent confidently use irrelevant context.

## Network Tool

Do not add a generic network tool until request intent, outbound data, citations, caching, and prompt-injection handling are designed.

Before implementation, prepare:
- allowed request types
- confirmation rules for sending workspace content
- citation requirements
- source-quality rules
- logging format for URLs and response summaries

Main risk:
Network access can leak private workspace content or import hostile instructions.

## Strong Skill Pack Runtime

The MVP now has a lightweight Guided Skill Use layer that discovers relevant `SKILL.md` files and injects summaries into provider context.

Do not turn Skill Packs into a plugin runtime until that Guided Skill Use layer feels limiting.

Before implementation, prepare:
- a manifest format
- permission declarations
- input and output schemas
- eval conventions
- versioning and compatibility rules

Main risk:
A runtime adds power but also turns every Skill Pack into executable surface area.
