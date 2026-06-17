# Task History

## 我们实现了什么

CLI 现在支持：

```text
personal-agent history
```

它会列出当前 workspace 中最近的 Task Runs，包括 run id、status、mode、更新时间和 goal。

## 在本项目中如何工作

每个 Task Run 已经会把元数据写入：

```text
.personal-agent/runs/<run-id>/run.json
```

`listTaskRuns(workspace, limit)` 会扫描 run directories，读取其中的 `run.json` metadata，按 `updatedAt` 倒序排序，并返回最近的 runs。

CLI 会打印紧凑文本列表。如果当前还没有 run，会输出：

```text
No Task Runs found.
```

## 其他常见方案

**Database query**：
把 runs 存到 SQLite 或其他数据库里，再通过 index 查询。扩展性更好，但在 MVP 仍以学习为主时，会隐藏文件布局。

**Event-log derived history**：
完全从 `events.jsonl` 构建 history。这能还原更多细节，但成本更高；对简单列表视图来说暂时没必要。

**External observability backend**：
把 trace 发到 hosted service。团队协作时有价值，但对本地 personal agent MVP 太重。

## 为什么选择当前方案

workspace 已经有持久化的 `run.json` metadata。直接读取这些文件，可以保持 history 简单、可检查，并和 file-first state design 保持一致。

## 优势

- 不依赖数据库或外部服务。
- 可以直接打开 `.personal-agent/runs/` 手工检查。
- 本地实验后马上有用。
- 已能配合 `resume` 使用，并为 Run Export 命令打基础。

## 劣势

- 对大量历史记录来说，文件扫描不如 indexed storage 高效。
- 当前输出是紧凑文本，不是交互表格。
- 暂时不展示 tool count、report path 或 evaluation summary。

## 评测

当前测试验证：

- 空 workspace 会打印友好提示。
- completed run 会出现在 CLI history 中。
- state listing 会从本地文件返回 run metadata。

后续评测应增加：

- limit 和 pagination。
- 按 status 过滤。
- report 和 evaluation summary columns。
- 和 `resume` 的更丰富集成，例如展示 run 是否有 checkpoints。
