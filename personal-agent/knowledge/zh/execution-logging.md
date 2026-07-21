# 执行日志

## 我们实现了什么

CLI 现在会在模型 provider 每次返回 Agent Step 时打印一条简短的控制台日志。

示例形态：

```text
[agent] turn 1 plan - Inspect the workspace | steps: List files
[agent] turn 2 tool - list_files {}
[agent] turn 3 finish - Workspace summarized.
```

## 在本项目中如何工作

`runTask` 接收一个可选的 `logStep(message)` 回调。provider 返回结果并通过 `parseAgentStep` 校验之后，runner 会把 step 格式化成一行紧凑日志，然后调用 `logStep`。

CLI 传入的回调会把每一行写到 `stderr`。这样进度日志仍会出现在终端里，同时 `stdout` 可以继续保留给 `Completed Task Run ...` 这类命令结果。

Learning Lens 在开启 `--learn` 时也会复用这个回调，但它输出的是独立的 `[learn]` 行。默认执行日志仍然只聚焦 `[agent]` 进度行。

## 其他常见方案

**静默 agent loop**：
只把事件写入文件。这样命令输出很干净，但 live run 会显得不透明。

**Verbose structured JSON logs**：
把每个事件都按 JSON 打印。机器解析很方便，但人在学习和观察执行过程时不够易读。

**Trace UI**：
在 Web UI 中渲染实时 timeline。长期体验更好，但对当前 CLI-first MVP 来说太重。

## 为什么选择当前方案

这个项目是学习型 agent。Owner 应该能在执行过程中看到 loop 的推进：plan、tool call、message、reflection 和 finish。小型文本日志可以提供即时反馈，同时不引入 UI 框架。

## 优势

- 每个模型步骤在执行时都可见。
- 不改变 durable event log。
- 把命令结果输出和进度日志分开。
- logging 通过依赖注入进入 runner，保持可测试。

## 劣势

- 当前日志比较简洁，不是完整 debugger。
- 很长的 report 仍可能让单行日志变吵。
- 暂时没有 log level 或 quiet mode。

## 评测

当前测试验证：

- 当传入 logger 时，`runTask` 会为每个模型 step 输出一条日志。
- CLI `run` 会把 bootstrap 的 plan 和 finish 步骤写到 `stderr`。
- CLI `run --learn` 会增加显式 opt-in 的 `[learn]` 说明，同时不改变默认输出。

后续评测应增加：

- quiet flag。
- 长报告的多行格式化。
- structured trace export。
- 工具执行完成后的 observation 日志。
