# Clarification Gates

## 我们实现了什么

CLI 现在为 `a-agent run "<task>"` 和 `a-agent start` 增加了第一版 Clarification Gate。

当任务明显模糊，例如 `处理一下` 或 `do it` 时，CLI 会在创建 Task Run 状态前停下来，并要求提供具体 outcome。非交互 `run` 调用无法回答问题，因此命令会以状态码 `1` 退出，而不是让 agent 猜测。在逐行 `start` REPL 中，下一条非空输入会作为澄清回答。

## 在本项目中如何工作

`src/cli/index.ts` 会在 `run` 调用 `runCliTask(task)` 前先执行 `clarifyRunTaskIfNeeded(task)`。`start` REPL 使用同一个模糊检测器，并在 Owner 输入澄清行前保存 pending ambiguous task。

第一版 detector 故意保持保守：

- 使用 Unicode NFKC 规范化任务文本，
- 只匹配一小组中英文模糊短语，
- 不阻断 `ls`、`build`、`run tests` 这类短但具体的命令。

当任务需要澄清时，CLI 会打印：

```text
[agent] clarification required
reason: task boundary is ambiguous
question: What concrete outcome should this task produce?
```

交互式终端可以回答 prompt。非交互 `run` 调用无法回答，所以会在创建 `.personal-agent/runs/` 状态前失败。管道式 `start` 调用可以回答，因为下一行输入会被视为 clarification。

## 其他常见方案

**模型主导澄清**：
把每个任务都交给模型，让模型决定是否提问。这很灵活，但仍然会创建 run，而且模型可能在边界不清晰时先猜测。

**Schema-first intake forms**：
每个任务都要求填写 objective、constraints 和 success criteria 等结构化字段。这更严谨，但对 CLI-first agent 来说太重。

**宽泛启发式评分**：
用长度、动词、宾语和置信度等特征判断任务是否模糊。它能覆盖更多情况，但也更容易阻断有效的短命令。

## 为什么选择当前方案

MVP 需要一个可见的 Clarification Gate，但不应该把任务入口变成大型自然语言分类器。小型短语列表可以覆盖最明确的模糊请求，并把误判率控制得更低。

## 优势

- 防止 agent 为没有明确对象或 outcome 的任务创建持久状态。
- gate 会清晰显示在 stderr。
- 不依赖模型 provider。
- 让 `run` 和 `start` 的任务入口行为保持一致。
- 避免用宽泛规则阻断简短但有效的任务。

## 劣势

- 只能捕获已知模糊短语。
- 当前 clarified answer 会追加到任务文本里，还没有作为独立结构化字段保存。

## 评测

当前测试验证：

- `a-agent run "处理一下"` 会以状态码 `1` 退出，
- CLI 会打印 clarification-required message，
- 模糊任务不会输出 completed Task Run。
- `a-agent start` 在 REPL task 模糊时会要求澄清，
- 澄清后的 REPL task 只会创建一个 Task Run，并且 goal 会包含原始模糊请求和澄清内容。

后续评测应增加：

- 交互式澄清回答流程，
- `start` pending clarification 时遇到 EOF 的行为，
- 更多中英文模糊表达 fixtures，
- 把原始任务和澄清后的 outcome 分别存储为结构化字段。
