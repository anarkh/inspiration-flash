# Memory Prompt Injection

## 我们实现了什么

每次 Task Run 现在都会把相关 Project Memory 注入到 `ModelProviderInput.projectMemory`。

runner 会读取当前 workspace 的 Project Memory，根据当前 goal 和 Success Check 筛选相关 notes，再把筛选后的 Markdown 发送给 Model Provider。OpenAI-compatible provider 会把这个字段放进发送给模型的 JSON payload，所以真实 provider 可以在规划和执行时看到长期偏好与项目约定。

## 在本项目中如何工作

`continueTaskRun` 会在模型 loop 开始前读取：

```text
.personal-agent/memory.md
```

`selectRelevantProjectMemory` 会解析已知 memory 分区下的 Markdown bullet notes，根据 note 与 goal、Success Check 的轻量关键词重合度打分，然后把命中的 notes 重新格式化成 Markdown。

如果没有任何 note 命中，runner 会 fallback 到完整 memory 文件。这样在 memory 很少时仍保留“模型能看到 memory”的早期行为；当存在明显相关 note 时，则减少不相关上下文。

这是关键词过滤，不是语义检索。它不会创建 embedding、索引，也不会增加额外模型调用。

在本文档和实现中，`term` 指的是由我们自己的规则抽取出来的关键词式检索项。它不是大模型用于上下文长度或计费的 token。

## 相关 Memory 筛选算法

`selectRelevantProjectMemory` 使用一条小而可解释的流程：

1. 解析 Markdown memory 文件。
   它会扫描 `##` 分区标题和 `-` bullet notes。每条解析出的 note 都会保留所属 section、文本内容和原始顺序。

2. 从当前任务生成查询 terms。
   查询文本是 `goal + successCheck`。英文类文本会统一转成小写词，并移除常见停用词，比如 `the`、`and`、`project`、`task`。

3. 增加适合中文的 terms。
   中文通常没有空格，所以 term extractor 还会加入汉字单字和相邻双字 terms。例如 `知识库` 可以贡献 `知`、`识`、`库`、`知识`、`识库`。

4. 给每条 memory note 打分。
   note 每和任务查询共享一个唯一 term，就加 1 分。同一个 term 重复出现不会重复加分。

5. 保留命中的 notes。
   分数为 `0` 的 notes 会被移除。命中的 notes 先按分数从高到低排序，分数相同则按 memory 原始顺序排序。默认最多保留 12 条。

6. 把选中的 notes 重新格式化为 Markdown。
   选中的 notes 会按原 Project Memory section 分组，并作为可见的 `projectMemory` 发送给 Model Provider。

Fallback 行为是刻意设计的：

- 如果 memory 文件中没有解析出 bullet notes，返回完整 memory 文件。
- 如果当前任务没有生成可用查询 terms，返回完整 memory 文件。
- 如果没有任何 note 命中，返回完整 memory 文件。

这个 fallback 让早期 memory 很少时的行为更宽容。代价是：没有字面匹配的任务仍可能收到不相关 memory。MVP 阶段可以接受，但 memory 变大前需要专门评测。

## 其他常见方案

**Full prompt injection**：
每次模型调用都发送全部 memory 文本。实现简单且透明，但 memory 增长后会浪费上下文。

**关键词过滤**：
解析 memory notes，只保留有字面重合的 notes。它便宜、可检查，但会漏掉同义改写。

**语义检索**：
把 memory notes 做 embedding，只检索相关条目。扩展性更好，但会增加索引、模型成本，也更难调试为什么命中或没命中。

**结构化 profile fields**：
把偏好和约定存成类型化字段。控制更干净，但不如学习优先的 Markdown memory 文件自然。

## 为什么选择当前方案

项目目前仍是本地、学习导向。关键词过滤可以先学习最基础的 retrieval 概念，同时不引入向量数据库和 embedding 成本。完整 memory fallback 也让早期 memory 很少时的行为更宽容。

## 优势

- 仍然简单、本地化。
- 容易检查和测试。
- fresh run 和 resumed run 都可用。
- Project Memory 仍是唯一事实来源。
- 不需要 embedding、数据库或额外模型调用。
- 当任务有匹配 memory 时，可以减少明显不相关的 notes。

## 劣势

- 关键词重合会漏掉语义相关但用词不同的 notes。
- 如果没有 note 命中，仍会 fallback 注入完整 memory。
- 暂时没有 secret redaction。
- 模型仍可能忽略 memory；注入只是上下文，不是硬性规则。

## 评测

当前测试验证：

- `runTask` 会把 Project Memory 传给 Model Provider。
- `runTask` 会在有相关 note 命中时过滤掉不相关 notes。
- `resumeLatestTask` 也会传入 Project Memory。
- OpenAI-compatible provider 会把 Project Memory 放进 request payload。

后续评测应增加：

- prompt 大小限制。
- 注入前的 secret scan。
- 关键词匹配的 precision 和 recall 检查。
- 当 memory 超过小型 Markdown 文件后引入 embedding retrieval。
