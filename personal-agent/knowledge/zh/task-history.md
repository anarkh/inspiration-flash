# Task History

## 我们实现了什么

CLI 现在支持：

```text
a-agent history [--status active|completed] [--limit count] [--offset count]
```

它会列出当前 workspace 中最近的 Task Runs，包括 run id、status、mode、可选 evaluation verdict、可选 report path、可选 latest checkpoint id、turn 和创建时间、更新时间和 goal。
可选的 `--status` filter 可以只显示 active 或 completed runs。
可选的 `--limit` 会在过滤后限制最终输出的行数。
可选的 `--offset` 会在过滤后跳过指定行数，用来翻看更长的 history。

## 在本项目中如何工作

每个 Task Run 已经会把元数据写入：

```text
.personal-agent/runs/<run-id>/run.json
```

`listTaskRuns(workspace, limit)` 会扫描 run directories，读取其中的 `run.json` metadata，再读取可选的 `evaluation.json` verdict，探测可选的 `report.md` 路径，在存在 checkpoint 时读取最新 checkpoint id、保存的 turn 和创建时间，按 `updatedAt` 倒序排序，并返回最近的 runs。

CLI 会先读取可用 metadata，再应用 `--status`、`--limit` 和 `--offset`。这样 `history --status completed --limit 1 --offset 1` 表示“第 2 新的 completed run”，而不是先对未过滤列表分页后再找 completed。

CLI 会打印紧凑文本列表。如果当前还没有 run，会输出：

```text
No Task Runs found.
```

`history --status active` 适合在 `resume` 前查看未完成任务；`history --status completed` 适合找需要 export 或复盘的 run。
`history --limit 5` 适合 workspace 里有很多旧实验，但 Owner 只想看很短的最近列表。
`history --limit 5 --offset 5` 适合翻看过滤后的下一页 5 条记录。
每个非空页面都会包含 `Showing <first>-<last> of <filtered-count>` 摘要。如果存在相邻页面，history 会打印可直接复制的 `Previous page: a-agent history ...` 和 `Next page: a-agent history ...` 命令。
如果某个 run 已经有 `report.md`，history 会包含 `report: <path>`，Owner 可以不执行 export 就直接打开报告。
如果某个 run 已经有 checkpoint，history 会包含 `checkpoint: <id> (turn <n>, created <iso>)`，Owner 可以看到这个 run 已经有可恢复的持久点、它保存的是哪一轮 provider turn，以及保存时间。

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
- 可以按 active/completed 过滤，不需要手工扫描文件。
- 可以用 `--limit` 控制 CLI 输出长度，用 `--offset` 翻页，同时保持 status filtering 语义正确。
- 可以展示过滤后的总数、当前页条目位置，并在长历史中给出上一页/下一页命令。
- 当 `report.md` 存在时，可以直接从 history 跳到 Task Report。
- 在调用 `resume` 前，可以看到 run 是否有最新 checkpoint、它保存的 turn 和 checkpoint timestamp。

## 劣势

- 对大量历史记录来说，文件扫描不如 indexed storage 高效。
- 当前输出是紧凑文本，不是交互表格。
- 暂时不展示 tool count。

## 评测

当前测试验证：

- 空 workspace 会打印友好提示。
- completed run 会出现在 CLI history 中。
- history 可以按 `active` 或 `completed` status 过滤。
- history 可以在 status 过滤后用 `--limit` 限制输出数量。
- history 可以在 status 过滤后用 `--offset` 跳过输出数量。
- 当存在上一页或下一页时，history 会展示过滤后总数、当前条目位置和相邻页面命令。
- 存在 `evaluation.json` 时，history 会展示 Task Evaluation verdict。
- 存在 `report.md` 时，history 会展示 Task Report path。
- 存在 checkpoint 时，history 会展示 latest checkpoint id、保存的 turn 和创建时间。
- state listing 会从本地文件返回 run metadata。

后续评测应增加：

- 更丰富的 page metadata，例如当前 page number。
- 和 `resume` 的更丰富集成，例如展示相对 checkpoint age。
