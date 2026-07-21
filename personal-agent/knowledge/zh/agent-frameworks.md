# Agent 框架决策

## 决策

第一版 Personal Agent 不把 LangChain、LangGraph、LlamaIndex 或 OpenAI Agents SDK 作为核心运行时。它会先实现一个小型本地循环，围绕 Agent Step、Local Tool、Confirmation Gate、Clarification Gate、Task Run、Checkpoint 和 Task Report 运转。

这并不意味着永远不用这些 SDK。它们仍然是重要参考，后续当真实约束出现时，可以再引入。

## 为什么

Owner 的目标是在构建 Personal Agent 的同时学习 agent 的工作方式。小型自研循环能直接暴露关键概念：

- 规划
- 工具选择
- 观察
- 状态
- 确认
- 恢复
- 评测

如果太早使用框架，这些机制会被框架抽象隐藏起来，而本项目自己的语言体系还没有稳定。

## 方案对比

**LangGraph / LangChain**：
LangGraph 更像一个可控、有状态 agent 的底层编排框架，适合 durable graph execution、持久化和 human-in-the-loop 成为核心问题时使用。它与未来需求有重叠，但对 MVP 来说结构偏重。

**OpenAI Agents SDK**：
Agents SDK 提供 agent、tool、handoff、guardrail、session 和 tracing 等轻量 primitives。如果项目想快速获得 provider-native tracing 和 handoff，它很有吸引力；但如果作为核心运行时，会削弱 Agent Step 的独立性。

**LlamaIndex.TS**：
LlamaIndex 更适合数据连接、检索、workflow 和 agent 结合的场景。当 Complex Embedding Retrieval 进入 MVP 时，它会更有参考价值。

**自研第一方循环**：
第一方循环功能更少，但每个移动部件都可见、可测试，并且与 Personal Agent glossary 对齐。

## 当前建议

MVP 核心不使用 agent 框架。

允许：

- 在 Model Provider 边界后使用普通 HTTP client 或轻量模型 SDK。
- 把框架文档作为学习参考。
- 等多个真实 Task Run 暴露痛点后再重新评估框架。

避免：

- 把 Agent Step schema 绑定到某个 provider-native tool calling。
- 让 Skill Pack 依赖框架专属运行时。
- 在 Single Active Task Run 被证明不够用之前引入 graph orchestration。

## 参考资料

- [LangGraph overview](https://docs.langchain.com/oss/javascript/langgraph/overview)
- [OpenAI Agents SDK TypeScript docs](https://openai.github.io/openai-agents-js/)
- [LlamaIndex TypeScript docs](https://developers.llamaindex.ai/typescript/framework/)
