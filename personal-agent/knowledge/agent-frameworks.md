# Agent Framework Decision

## Decision

The first Personal Agent should not use LangChain, LangGraph, LlamaIndex, or the OpenAI Agents SDK as its core runtime. It should implement a small local loop around Agent Steps, Local Tools, Confirmation Gates, Clarification Gates, Task Runs, Checkpoints, and Task Reports.

This does not ban SDKs forever. These projects are useful references, and a later version can adopt one when a real constraint appears.

## Why

The Owner's goal is to build a Personal Agent while learning how agents work. A small first-party loop exposes the important concepts directly:
- planning
- tool selection
- observation
- state
- confirmation
- recovery
- evaluation

Using a framework too early can hide those mechanics behind framework abstractions before the project's own vocabulary has stabilized.

## Comparison

**LangGraph / LangChain**:
LangGraph is positioned as a low-level orchestration framework for controllable, stateful agents and is useful when durable graph execution, persistence, and human-in-the-loop flows become central. That overlaps with future needs, but it is more structure than the first MVP needs.

**OpenAI Agents SDK**:
The Agents SDK provides lightweight primitives for agents, tools, handoffs, guardrails, sessions, and tracing. It is attractive if the project wants provider-native tracing and handoffs quickly, but using it as the core runtime would make Agent Steps less independent.

**LlamaIndex.TS**:
LlamaIndex is strongest when the hard problem is connecting data, retrieval, workflows, and agents. It becomes more relevant when Complex Embedding Retrieval enters the MVP.

**First-party loop**:
The first-party loop is less feature-rich, but every moving part is visible, testable, and aligned with the Personal Agent glossary.

## Current Recommendation

Use no agent framework for the core MVP.

Allowed:
- Use a normal HTTP client or small model SDK behind the Model Provider boundary.
- Read framework docs as learning references.
- Revisit frameworks after several real Task Runs reveal the painful parts.

Avoid:
- Binding the Agent Step schema to provider-native tool calls.
- Making Skill Packs depend on a framework-specific runtime.
- Adding graph orchestration before Single Active Task Run is proven insufficient.

## Sources Checked

- [LangGraph overview](https://docs.langchain.com/oss/javascript/langgraph/overview)
- [OpenAI Agents SDK TypeScript docs](https://openai.github.io/openai-agents-js/)
- [LlamaIndex TypeScript docs](https://developers.llamaindex.ai/typescript/framework/)
