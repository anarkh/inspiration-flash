# Build the core loop without an agent framework first

The first Personal Agent implements its own Task Run loop, Agent Step schema, Local Tool boundary, gates, and Workspace State instead of adopting LangGraph, LangChain agents, LlamaIndex workflows, or the OpenAI Agents SDK as the core runtime. These frameworks remain useful references and possible future integrations, but building the small loop directly keeps the learning path transparent and avoids adapting the MVP to another framework's abstractions before the Personal Agent's own vocabulary has stabilized.
