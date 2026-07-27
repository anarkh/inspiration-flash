# MVP 骨架

## 我们实现了什么

第一片实现创建了 TypeScript CLI 项目，并为以下能力建立了带测试的基础：

- CLI help 输出。
- package name `@ranarkh/agent` 和 CLI 命令 `a-agent`。
- `a-agent start` 运行最小的逐行 Task Conversation。
- `a-agent chat [--learn] [--review]` 运行一个包含多条 Owner 消息的持久 chat Task Run。
- `a-agent run --learn`、`a-agent start --learn` 和 `a-agent resume --learn` 展示显式开启的 Learning Lens 说明。
- `a-agent run --review`、`a-agent start --review` 和 `a-agent resume --review` 会把可选模型辅助自评写入 Task Evaluation。
- `a-agent run "<task>"` 创建 Task Run。
- `a-agent run "<task>"` 会在明显模糊的任务创建 Task Run 前拒绝执行。
- `a-agent history` 列出最近 Task Runs。
- `a-agent resume` 继续最新 active Task Run。
- `a-agent memory` 查看 Project Memory。
- `a-agent memory append "<note>"` 追加简单 memory notes。
- `a-agent memory append --section <section> "<note>"` 把 notes 插入指定 memory 分区。
- `a-agent memory apply-suggestions [--yes] [run-id]` 应用 review 后的 Memory Suggestions。
- `a-agent export [run-id]` 写入 Markdown Task Run export。
- bootstrap Model Provider 驱动最小 Task Run loop。
- Task Report 和 Task Evaluation 文件。
- Task Run Markdown 导出。
- 来自 `reflect` steps 的模型建议 Memory Suggestions。
- Workspace State 初始化。
- Project Memory 文件创建。
- Project Memory 读取和追加命令。
- 显式 Project Memory 分区插入。
- 带确认的 Memory Suggestions apply flow。
- 按职责分类的状态模块，以及兼容旧导入路径的 `state/store.ts` 出口。
- Project Memory 注入 Model Provider input。
- Task Run 元数据。
- append-only 事件日志。
- Checkpoint 写入和读取。
- provider-neutral Agent Step 校验。
- provider 输出无法通过 Agent Step 校验时的有界恢复重试。
- 对 `plan`、`message`、`tool` 和 `finish` 的 provider-neutral Agent Step 执行。
- 用于读取、列出和文本搜索的 Local Tool primitives。
- Local Tool observation 会以 `tool_result` event 形式回传给 Model Provider。
- `run_command` 的命令风险分类。

## 在本项目中如何工作

CLI 目前故意保持很薄。`start` 会逐行读取任务，直到 `exit`、`quit` 或 EOF，并对明显模糊的请求应用同一个小型 Clarification Gate，然后为每条任务复用与 `run "<task>"` 相同的执行路径。`chat` 会创建一个持久 Task Run，把每一行用户输入追加成 `owner_message` event，并在每条输入后等待模型返回 `message`。模型不能结束 chat；输入 `exit`、`quit` 或遇到 EOF 后，由 runner 写入最终 report 和 evaluation。`run "<task>"` 也会先应用这个 Clarification Gate，然后调用 bootstrap Model Provider，在 `.personal-agent/` 下创建 Workspace State，把可见 Agent Step 和 observation 记录为事件，写入 Checkpoint，并最终生成本地 Task Report 和 Task Evaluation。

实现拆成几个小模块：

- `src/cli/index.ts`：命令入口。
- `src/agent/runner.ts`：最小 Task Run loop。
- `src/model/provider.ts`：Model Provider 边界。
- `src/model/bootstrap-provider.ts`：没有真实模型 key 时使用的确定性 fallback provider。
- `src/state/store.ts`：状态模块的兼容出口。
- `src/state/workspace.ts`：Workspace State 初始化和默认文件。
- `src/state/project-memory.ts`：Project Memory 分区和追加逻辑。
- `src/state/task-runs.ts`：Task Run 元数据、latest 指针和 history。
- `src/state/run-events.ts`：append-only 事件日志。
- `src/state/checkpoints.ts`：Checkpoint 写入和恢复 helper。
- `src/state/task-artifacts.ts`：report、evaluation、export 和 Memory Suggestions。
- `src/core/agent-step.ts`：provider-neutral Agent Step schema 校验。
- `src/tools/local-tools.ts`：绑定 workspace 的文件检查工具。
- `src/tools/command-policy.ts`：命令风险分类。

## 其他常见方案

**Framework-first**：
使用 LangGraph、LangChain、LlamaIndex 或 agent SDK 提供 orchestration 和 tool 抽象。当运行时形状已经很明确时，这种方式更快，但会隐藏学习路径。

**Database-first**：
一开始就用 SQLite 或 hosted database 保存 run state。这能更早获得查询能力，但不如文件系统直观。

**Provider-native tool calling**：
直接绑定某个模型 provider 的 function calling。这能减少 schema 处理，但会降低 agent loop 的可迁移性和显式程度。

## 为什么选择当前方案

第一版偏向小型 first-party loop，因为 Owner 想在使用工具时学习 agent 的工作方式。文件、显式 Agent Step 和小模块能让每个概念都可见。

## 优势

- 打开 `.personal-agent/` 就能检查状态。
- 测试从一开始就描述预期 API。
- Agent Step 校验独立于任何 provider。
- runner 已经能处理 `tool` step，并把 observation 回传给下一轮 provider。
- Local Tools 简单，并绑定 workspace。
- Checkpoint 是普通 JSON 文件。

## 劣势

- 真实模型行为依赖有效 provider 凭据；否则 CLI 会回退到 bootstrap。
- Task Evaluation 仍以确定性 verdict 为准；模型辅助自评是可选的 advisory 信息。
- JSON 文件透明，但查询能力弱于数据库。
- command policy 目前保守且基于模式匹配。

## 评测

当前验证命令：

- `npm test`
- `npm run typecheck`
- `npm run build`

当前测试覆盖：

- CLI help 和 Task Run 创建。
- CLI 交互式 `start` 创建任务和连续执行任务。
- CLI 会为明显模糊的 `run` 和 `start` 任务触发 Clarification Gate。
- CLI Learning Lens 会展示 planning、checkpointing 和 evaluation 学习说明。
- CLI model review flag 在只有 bootstrap 时会记录 `unavailable`。
- CLI debug recovery 开关可以显式验证 recovery attempts。
- CLI Skill Pack eval 执行。
- CLI Task Run history。
- CLI Task Run history 会在可用时展示 Task Evaluation verdict。
- CLI Task Run history 可以按 active/completed 过滤。
- CLI Task Run history 可以用 `--limit` 限制输出数量。
- CLI Task Run history 可以用 `--offset` 翻页。
- CLI Task Run history 会展示过滤后总数和 previous/next page hints。
- CLI Task Run history 会在可用时展示 Task Report path。
- CLI Task Run history 会在可用时展示 latest Checkpoint id、保存的 turn 和创建时间。
- CLI Task Run resume。
- CLI Project Memory 查看、追加和分区插入。
- CLI Memory Suggestions apply flow。
- CLI Task Run export。
- CLI 通过 bootstrap Task Run 跑到 completed。
- Workspace State 默认值。
- event 和 Checkpoint 持久化。
- Agent Step 校验。
- runner 会对格式错误的 provider 输出执行恢复重试。
- runner 会限制持续错误 provider 输出的恢复次数。
- runner 执行 provider steps。
- runner 执行 Local Tool observation。
- runner 会为 trace quality、report quality、gate safety 和 Memory Suggestion learning signals 生成确定性 Task Evaluation。
- runner 支持可选模型辅助自评，并且不会覆盖确定性 Task Evaluation verdict。
- runner 从 `reflect` steps 收集 Memory Suggestions，并由 CLI 应用。
- runner 支持在同一个 Task Run 内保存多条 Owner 消息的持久 chat。
- CLI 持久 chat 会把两条 piped inputs 记录为两个 `owner_message` events。
- chat provider 错误返回 `finish` 时会触发 recovery，而不是结束对话。
- 输入关闭后由 runner 完成 chat，并生成 evaluation。
- runner 会把 Project Memory 注入 fresh run 和 resumed run。
- runner 会在存在相关 note 命中时过滤掉不相关的 Project Memory notes。
- runner 会发现已选 Skill Pack，并注入完整 `SKILL.md`。
- Owner 显式点名的 Skill Pack 会优先于关键词分数更高的普通匹配。
- 支持可重复的普通名称、来源限定和精确 path `--skill` 选择。
- runner 会在加载任何自动推断 Skill Pack 前请求确认。
- runner 支持对已确认的 Skill Pack 候选做子集选择。
- Skill guidance 使用严格 UTF-8 和大小上限加载，event 只持久化摘要。
- resume 会保留精确来源，并拒绝 guidance 摘要漂移。
- 终端会解析编号形式的 Skill Pack 子集选择。
- Skill Pack provider context 会包含 agent-ability 风格 references、scripts 和 eval resources。
- Skill Pack provider context 和 Task Export 会把 scripts 标记为 inventory-only，而不是自动可执行能力。
- Skill Pack 会展示 eval manifest 有效性和 eval count 摘要。
- Skill Pack eval runner 会执行 eval，并生成本地 Markdown 和 JSON 报告。
- Skill Pack eval runner 支持 `contains`、`regex`、`model_judge`、`model_judge.judge_runs`、`model_judge.pass_threshold`、`tool_trace`、`tool_trace.input_contains`、`tool_trace.input_matches`、`tool_trace.input_schema`、`tool_trace.output_contains`、`tool_trace.output_matches`、`tool_trace.output_type` 和 `tool_trace.output_schema` graders。
- Skill Pack eval manifest 现在有 JSON Schema，并会拒绝缺少 `skill_name`、包含未知字段、包含坏 `files`、包含空必填字符串、regex pattern 无效的 manifest，同时支持多错误报告。
- OpenAI-compatible provider 会把 Skill Pack context 放进 prompt payload。
- Task Run export 会展示已选 Skill Packs。
- Task Run export 会展示显式 selector、优先级覆盖和 guidance 摘要 metadata。
- Task Run export 会展示已选 Skill Pack 的 resource inventory。
- Task Run export 的 Decision Trace 会总结 Skill Pack confirmation 决策。
- Task Run export 会展示 Decision Trace、Local Tools Used 和 Changed Resources 摘要。
- Task Run export 会对常见环境变量、JSON、URL query、bearer、GitHub 和 `sk-...` secret 模式做脱敏。
- Memory Suggestion 写入 Project Memory 前会经过质量门。
- Memory Suggestion 写入 Project Memory 前会经过精确重复和简单近似重复检查。
- Memory Suggestion 写入 Project Memory 前会经过简单同主题冲突检查。
- Memory Suggestion 写入 Project Memory 前会经过中英文“直接实现 vs 只给方案/先确认”的偏好冲突检查。
- Memory Suggestion 写入 Project Memory 前会经过简单同主题否定检查。
- Memory Suggestion 写入 Project Memory 前会经过简单同主题禁止和避免型检查。
- Memory Suggestion 写入 Project Memory 前会经过简单中文偏好冲突检查。
- Memory Suggestion 写入 Project Memory 前会经过泛泛不可执行 note 检查。
- 命令风险分类。
- 文件读取、列出和搜索行为。

下一个评测目标：

Skill Pack evals 现在已经有本地 runner、确定性的 `contains`、`regex`、`tool_trace`、`tool_trace.input_contains`、`tool_trace.input_matches`、`tool_trace.input_schema`、`tool_trace.output_contains`、`tool_trace.output_matches`、`tool_trace.output_type`、`tool_trace.output_schema` graders，以及支持重复评审阈值和逐次 judge 诊断的第一版语义型 `model_judge` grader。可选质量层 schema 已文档化并会拒绝未知字段、无效 `files`、空必填字符串、无效 regex pattern、无效 compact schema、无效 model judge 声明且支持多错误报告。后续评测应基于真实 Skill Pack run 积累 golden examples，用来校准 model judge。
