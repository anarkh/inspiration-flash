# Task Conversation

## 我们实现了什么

CLI 现在支持：

```text
a-agent start
a-agent chat [--learn] [--review]
```

`start` 会运行一个最小的逐行 Task Conversation。每一行非空输入都会变成一个独立 Task Run。Owner 输入 `exit` 或 `quit`，或 stdin 关闭时，会退出会话。

`chat` 会运行一个持久 chat-style Task Run。多条 Owner 消息会作为 `owner_message` events 记录在同一个 run 内，Model Provider 每次回复前都能看到可见的对话历史。

## 在本项目中如何工作

`src/cli/index.ts` 让两个入口都保持很薄：

1. `runInteractiveTaskConversation()` 打开 readline interface，并在 stderr 上显示 `Task> `。
2. 每一行输入都会先 trim。
3. 空行会被忽略。
4. `exit` 和 `quit` 会结束会话。
5. 非空任务行会传给 `runCliTask(task)`。
6. `runCliTask(task)` 使用与 `run` 相同的配置 provider、执行日志和终端 Confirmation Gates。

prompt 写到 stderr，这样 stdout 仍然方便脚本解析。完成后的 run message 继续写到 stdout，与已有 `run` 命令保持一致。

`chat` 使用单独的 runner 入口 `runChatTask()`：

1. 第一条非空 Owner 消息会创建一个 goal 为 `Chat conversation: ...` 的 Task Run。
2. 每一行 Owner 输入都会作为 `owner_message` 追加到 `events.jsonl`。
3. `owner_message`、Agent Steps、tool observations 和 recovery events 会作为可见上下文回放给 provider。
4. `message` step 会作为对话回复打印，然后 CLI 等待下一行 Owner 输入。
5. 模型在 chat 模式返回的 `finish` 会被拒绝并转成可见 recovery 指令；provider 必须改用 `message` 回答。
6. 输入 `exit`、`quit` 或关闭 stdin 后，runner 会追加自己的 `finish`，写入 report 和 evaluation，并把 run 标记为 completed。

CLI 会在 chat 开始前打印选中的 provider 和 model。这样意外 fallback 会立刻可见，例如 `[agent] provider bootstrap (deterministic-bootstrap)` 与 `[agent] provider deepseek (deepseek-v4-flash)`。

bootstrap provider 会为每条 Owner 输入返回一条警告 `message`，而不会假装自己是真实对话模型。这样无凭据时仍可测试 loop，同时明确提示真实回答需要 `DEEPSEEK_API_KEY`。

Task Evaluation 会在可见事件同时包含 Owner turns、模型回复和 finish report 时，把 chat trace 视为完整。这样 chat 评测不需要在每次对话回复前强制出现 task-style plan。

## 其他常见方案

**完整 REPL**：
进程一直打开，并提供取消、历史、上下文继承和 session 配置等命令。这更完整，但会在基础 agent loop 稳定前扩大 CLI 契约。

**Chat-style UI**：
用 Web 或终端 UI 展示持久消息气泡。体验可以更丰富，但会偏离当前 CLI-first 的学习路径。

**框架 conversation manager**：
使用框架内置的 conversation 抽象。后续可能减少样板代码，但会隐藏我们现在想学习的文件式 Task Run flow。

**Thread database**：
把 chat messages 存在 SQLite 或 hosted database 中，并把每个 UI thread 映射成一组 rows。这更适合搜索和分页，但当前阶段不如 append-only 本地文件透明。

## 为什么选择当前方案

项目已经有带测试的 Task Run loop。复用它可以让 `start` 只是输入模式，而不是第二套 agent runtime。`chat` 单独实现，是因为它的语义不同：多条 Owner 消息属于同一个 run，并且需要一起暴露给 provider。两条路径仍然共享 report、evaluation、checkpoint、confirmation、Skill Pack context、Project Memory injection 和 Local Tool handling。

## 优势

- 与 `run` 使用相同的 Task Run 语义。
- prompt 和进度日志写 stderr，stdout 仍然适合脚本读取。
- 测试中可以用 piped stdin 验证交互入口，结果可复现。
- 支持连续提交多条任务，不需要反复重启 CLI。
- 避免复制一套可能与主 runner 漂移的 loop。
- 增加了真正的持久对话能力，同时不改变 `run` 或 `start` 的语义。
- 用户消息以显式 `owner_message` events 存储，durable trace 可审计。
- 可以用 `printf 'hello\nfollow-up\n' | a-agent chat` 这类 piped input 做脚本化测试。
- 模型回复与运行时生命周期相互独立：模型负责回答，CLI 负责结束会话。

## 劣势

- 当前是逐行输入，还不支持在提交前编辑多行任务。
- Clarification Gate 目前只处理已知模糊短语。
- 多条任务之间除了正常 Workspace State 外，还没有单独的 session-level state。
- 已结束的终端 chat 还不能在新进程中携带原 transcript 重新打开。
- 终端 UI 仍然很小，没有 rich message bubbles 或命令历史。
- 很长的 chat 后续需要摘要或检索，否则 provider prompt 会持续增长。

## 评测

当前测试验证：

- `a-agent start` 会从 stdin 读取一条任务，
- `a-agent start` 会连续执行多条任务，直到输入 `exit`，
- 空交互行会被忽略，并重新显示 prompt，
- 模糊交互任务会先要求输入一行 clarification 再执行，
- `runChatTask()` 会把多条 Owner 消息保存在同一个 Task Run 内，
- `a-agent chat` 会把多条 piped inputs 保存在一个持久 Task Run 中，
- `a-agent chat` 会为两条 Owner 输入记录两个 `owner_message` events，
- chat 会拒绝 provider 生成的 `finish`，记录 recovery，并取得一条 `message`，
- 第一条回复前会显示 provider 和 model 身份，
- EOF 会完成 run 并写入 `evaluation.json`，
- 它会打印交互 prompt，
- 它会输出正常 agent 进度日志，
- 它会用 prompt 中的 goal 创建 completed Task Run，
- 生成的 report 会包含 prompt 中的 goal。

后续评测应增加：

- 还没有任何任务时遇到 EOF 的行为，
- pending clarification 时遇到 EOF 的行为，
- 显式 `quit` 行为，
- 更广泛的模糊任务 fixtures，
- 携带已有 transcript 重新打开 chat 的能力，
- 长对话摘要或检索行为。
