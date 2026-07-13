# Learning Lens

## 我们实现了什么

Learning Lens 是一个显式开启的 CLI 学习模式，会在 Task Run 执行过程中打印简短教学说明。

支持的命令：

- `a-agent run --learn "<task>"`
- `a-agent start --learn`
- `a-agent resume --learn`

普通命令会保持之前紧凑的 `[agent]` 进度日志。只有 Owner 显式传入 `--learn` 时，才会出现学习说明。

## 在本项目中如何工作

CLI 会解析 `--learn`，并把 `learningLens: true` 传给 `runTask` 或 `resumeLatestTask`。

`src/agent/runner.ts` 会复用执行日志使用的 `logStep` 回调输出 `[learn]` 行。这些说明不会作为 durable events 写入事件日志；它们只是终端里的教学辅助。真正持久的学习材料仍然是 Knowledge Base、Task Report、Task Evaluation、Run Export 和可 review 的 Memory Suggestions。

当前 Learning Lens 主题：

- `planning`：`plan` step 会在行动前暴露模型计划。
- `tool use`：`tool` step 把模型意图和 workspace 执行分开。
- `observation`：tool result 会变成下一轮模型可见的上下文。
- `confirmation`：Confirmation Gate 会在高影响操作改变 workspace 前暂停并请求确认。
- `reflection`：`reflect` 创建的是可 review 的 memory candidate，不是已经写入的 durable memory。
- `checkpoint`：checkpoint 文件保存可见状态，用于 resume。
- `recovery`：错误模型输出会变成可见反馈，然后重试同一个 turn。
- `evaluation`：Task Evaluation 会基于可见 report 和 trace artifact 打分。

## 其他常见方案

**Always-on teaching mode**：
每次运行都打印解释。这对初学者友好，但日常使用会很吵。

**Separate tutorial command**：
单独做一个 `tutorial` 或 `learn` 命令，在真实任务之外解释概念。这适合 onboarding，但不如在真实 agent 行为出现时学习直接。

**Framework tracing UI**：
使用 LangSmith、OpenAI tracing 或类似 UI 查看运行过程。可视化更强，但会隐藏 first-party loop，并引入外部依赖。

**Documentation only**：
只在 Markdown 文档中解释。这样最安静，但错过了概念真实出现的执行时刻。

## 为什么选择当前方案

Owner 希望一边使用 Personal Agent 一边学习。显式 `--learn` flag 可以保持普通运行简洁，同时在真实执行过程中展示核心概念。

## 优势

- Owner 不显式开启时不会增加噪音。
- 复用已有 runner 和 logging path。
- 概念出现时就能同步解释。
- 对 bootstrap、DeepSeek 和未来 provider 都适用。
- 不把学习说明写入 Task Run events，保持 durable state 干净。

## 劣势

- 说明只在终端展示，不会保存到 `events.jsonl`。
- 第一版说明是固定文案，不是个性化解释。
- 第一片还没有完整 tutorial progression 或图示。
- 概念熟悉后，反复使用 `--learn` 可能会显得重复。

## 评测

当前测试验证：

- CLI help 会为 `run`、`start`、`resume` 展示 `--learn`。
- `a-agent run --learn "<task>"` 会输出 `[learn] planning`、`[learn] checkpoint` 和 `[learn] evaluation`。
- 未使用 `--learn` 的普通 run 保持原有紧凑输出。

人工检查命令：

```bash
tmpdir=$(mktemp -d /tmp/personal-agent-learn-XXXXXX)
cd "$tmpdir"
env PERSONAL_AGENT_SKIP_DOTENV=1 DEEPSEEK_API_KEY= OPENAI_API_KEY= a-agent run --learn "帮我总结当前目录"
```
