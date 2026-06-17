# Task Resume

## 我们实现了什么

CLI 现在支持：

```text
personal-agent resume
```

它会继续最新的 active Task Run，而不是创建新的 run。如果没有 run，会打印友好提示。如果最新 run 已经 completed，会报告这个状态，不会重新执行。

## 在本项目中如何工作

Task Run 已经持久化三类 resume state：

- `run.json`：保存 goal、mode、success check、status 和时间戳。
- `events.jsonl`：保存持久 Agent Steps 和 tool observations。
- `checkpoints/*.json`：保存最后一个可见 turn 和 event count。

`resumeLatestTask` 会读取 latest run pointer，跳过 completed run，恢复最新 checkpoint，从 `events.jsonl` 重建 provider-visible events，并从 `checkpoint.turn + 1` 继续 runner loop。

恢复后的 loop 会继续追加新事件，写入新 checkpoint，并最终在同一个 run directory 中写入 report、evaluation 和 completed status。

## 其他常见方案

**Graph runtime checkpointing**：
LangGraph 这类框架可以自动 checkpoint graph state。能力很强，但会隐藏 checkpoint 格式，不利于学习。

**Database-backed resume**：
把 runs、events 和 checkpoints 都存到数据库中。查询和并发更强，但本地文件布局不再那么透明。

**Provider conversation replay only**：
把之前消息全部重新发给模型，让模型自己接着做。这很简单，但不如显式状态边界清楚，也不利于保留 local tool observation。

## 为什么选择当前方案

本项目是 file-first。通过可见文件恢复 run，能教会一个核心 agent 概念：durable state 是 agent 能从中断中恢复的基础。

## 优势

- 恢复同一个 Task Run id 和目录。
- 使用已有 checkpoint 和 event log。
- 把 provider-visible context 和本地 audit-only events 分开。
- 测试可以在没有真实模型的情况下模拟 interrupted run。

## 劣势

- CLI 目前只能恢复 latest run。
- Completed run 不会被重新打开。
- Checkpoint state 仍然比较少。
- 暂无多个并发 resume 的冲突处理。

## 评测

当前测试验证：

- state helpers 能恢复 latest run metadata、events 和 checkpoint。
- runner 能从 checkpoint events 恢复 active run。
- 没有 run 时，runner 返回 `not_found`。
- CLI `resume` 能处理 empty workspace 和 active workspace。

后续评测应增加：

- 指定 run-id resume。
- active-run filtering。
- corrupted checkpoint recovery。
- Run Export 中更丰富的 resume summary。
