# Task Export

## 我们实现了什么

CLI 现在支持：

```text
a-agent export [run-id]
```

它会把某次 Task Run 导出成 Markdown，并写入：

```text
.personal-agent/runs/<run-id>/export.md
```

如果省略 `run-id`，默认导出最新的 Task Run。

## 在本项目中如何工作

`exportTaskRun(workspace, id?)` 会定位指定 run 或 latest run，然后读取已有的 file-first run state：

- `run.json`：metadata。
- `report.md`：最终报告。
- `evaluation.json`：任务后评测。
- `memory-suggestions.json`：存在时保存候选 Project Memory notes。
- `events.jsonl`：可见任务轨迹。

导出文件按需重新生成。它不是新的事实来源，而是从持久化 run 文件组装出的可读快照。

Markdown 分区包括：

- Metadata
- Decision Trace
- Local Tools Used
- Skill Packs Used
- Changed Resources
- Report
- Evaluation
- Memory Suggestions，存在时展示
- Events

`Decision Trace` 是从 `events.jsonl` 生成的紧凑可读摘要。它会把 provider steps 和 observations 转成类似 `plan: ...`、`tool: write_file`、`tool_result: write_file -> file_written`、`skill_packs_confirmation: denied` 的行。

`Local Tools Used` 是从 `tool` 和 `tool_result` events 中提取出来的去重工具列表。

`Skill Packs Used` 是从 runner 记录的 `skill_packs` events 中提取出来的去重 Skill Pack name 和 path 列表。如果已选 Skill Pack 包含 agent-ability 风格 resource inventory，这个分区也会展示它的 `references`、`scripts`、`evals` paths，以及静态 eval manifest 摘要。如果存在 scripts，导出会写入和 provider context 一致的 inventory-only 提醒，避免读者把“发现了脚本路径”误解成“脚本已经执行”。这些 events 只作为审计 metadata，不会回传进 provider event stream。

`Changed Resources` 目前记录工具 observation 明确报告的文件变更，例如 `file_written`。它是保守的：只被提议但没有确认执行的写入，不算 changed resources。

写入 `export.md` 前，导出层会对生成的 Markdown 做常见 secret 脱敏：

- key 中包含 `API_KEY`、`TOKEN`、`SECRET` 或 `PASSWORD` 的 dotenv 风格赋值。
- key 中包含 `api_key`、`token`、`secret` 或 `password` 的 JSON 风格字段。
- `access_token`、`refresh_token`、`client_secret`、`api_key` 等 URL query 参数。
- bearer token。
- GitHub 风格的 `ghp_...`、`gho_...`、`ghu_...`、`ghs_...`、`ghr_...` token。
- OpenAI/DeepSeek 风格的 `sk-...` key。

脱敏只影响可分享的 Markdown export。原始 run artifacts 不会被修改，这样本地调试和审计历史仍然完整保留。

## 其他常见方案

**Database-backed export**：
把 Task Runs 存进 SQLite 或 Postgres，再通过查询生成导出。扩展性更好，但会隐藏 MVP 的文件结构，并增加运维成本。

**Observability trace viewer**：
把事件发送到 LangSmith、OpenTelemetry 或其他 trace backend。团队协作和分布式系统里很有价值，但对本地学习型 agent loop 偏重。

**Archive export**：
创建 zip 或 bundle，包含某次 run 的全部 artifact。它适合分享完整资料，但不如 Markdown 方便快速阅读和 diff。

## 为什么选择当前方案

Owner 正在学习 agent run 的工作方式。Markdown export 可以用普通编辑器阅读，同时保留原始文件用于进一步检查。

## 优势

- 方便阅读、diff 和分享。
- 不依赖数据库或 hosted tracing service。
- 把 report、evaluation 和 events 放到一个文件里。
- 在原始 event JSON 前提供可读摘要。
- 展示使用过哪些 Local Tools，以及哪些文件发生了变更。
- 展示本次 Task Run 命中了哪些 Skill Packs、暴露了哪些 resource inventory paths，以及是否识别到 eval manifest。
- 把 Skill Pack scripts 标记为 inventory-only，让导出保留和模型上下文一致的执行边界。
- 当 run 产生候选 Project Memory notes 时，也会一起展示。
- 生成 Markdown 时会脱敏常见环境变量、JSON、URL query、bearer、GitHub 和 `sk-...` secret 模式。
- 同时支持指定 `run-id` 导出和 latest-run 导出。

## 劣势

- 导出是快照；如果后续有新事件，需要重新运行命令。
- 大量 event log 会让 Markdown 文件变长。
- Changed Resources 只包含已知 tool result 形状明确报告的变更。
- 暂时不包含 checkpoint 内容或详细 tool statistics。
- 脱敏是基于模式匹配的，仍可能漏掉不常见 secret 格式或产生误报。
- 原始 run 文件不会被脱敏，所以仍应把它们当成本地私有 artifacts 对待。

## 评测

当前测试验证：

- state export 会写入 `export.md`。
- export output 包含 metadata、report、evaluation 和 events。
- export output 包含 Decision Trace、Local Tools Used、Skill Packs Used、Skill Pack resource inventory、eval manifest summary 和 Changed Resources。
- export output 会在 Decision Trace 中总结 Skill Pack confirmation 决策。
- export output 会脱敏常见 API key、bearer token、环境变量、JSON、URL query 和 GitHub token 模式。
- 存在 Memory Suggestions 时，export output 会包含它们。
- CLI `a-agent export` 会导出 latest run。
- CLI help 会展示该命令。

后续评测应增加：

- 通过 CLI 指定 run id 导出。
- empty-state 和 not-found 覆盖。
- 可选包含 checkpoint 内容。
- 为未来工具补充更丰富的 changed-resource 检测。
- 为未来 secret 格式补充脱敏误报和漏报 fixture。
