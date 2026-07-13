# 未来能力

Capability Backlog 位于 [../../TODO.md](../../TODO.md)。本文解释哪些延后能力在进入 MVP 前应该如何学习和评测。

## Complex Embedding Retrieval

不要因为文件数量增长就立刻加入 embedding retrieval。只有当关键词匹配和显式 Skill Pack 选择不再够用时再引入。

实现前应准备：

- 代表性问题
- 预期命中的源文档
- stale context 示例
- precision 和 recall 检查
- 在 Decision Trace 中展示检索来源的规则

主要风险：
糟糕的检索会让 Personal Agent 自信地使用无关上下文。

## Network Tool

在 request intent、outbound data、citation、cache 和 prompt-injection handling 设计清楚前，不要添加通用 Network Tool。

实现前应准备：

- 允许的请求类型
- 发送 workspace 内容时的确认规则
- citation 要求
- source-quality 规则
- URL 和 response summary 的日志格式

主要风险：
联网能力可能泄露私有 workspace 内容，也可能引入恶意指令。

## Strong Skill Pack Runtime

MVP 现在已有轻量 Guided Skill Use 层：它会发现相关 `SKILL.md` 文件，并把摘要注入 provider context。

在这层 Guided Skill Use 明显不够用前，不要把 Skill Pack 变成插件运行时。

实现前应准备：

- manifest 格式
- permission declarations
- input/output schema
- eval conventions
- versioning 和 compatibility rules

主要风险：
运行时会增强能力，但也会把每个 Skill Pack 都变成可执行攻击面。
