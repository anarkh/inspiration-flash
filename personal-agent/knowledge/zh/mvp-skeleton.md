# MVP 骨架

## 我们实现了什么

第一片实现创建了 TypeScript CLI 项目，并为以下能力建立了带测试的基础：

- CLI help 输出。
- `personal-agent run "<task>"` 创建 Task Run。
- `personal-agent history` 列出最近 Task Runs。
- `personal-agent resume` 继续最新 active Task Run。
- `personal-agent memory` 查看 Project Memory。
- `personal-agent memory append "<note>"` 追加简单 memory notes。
- `personal-agent memory append --section <section> "<note>"` 把 notes 插入指定 memory 分区。
- `personal-agent memory apply-suggestions [--yes] [run-id]` 应用 review 后的 Memory Suggestions。
- `personal-agent export [run-id]` 写入 Markdown Task Run export。
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
- 对 `plan`、`message`、`tool` 和 `finish` 的 provider-neutral Agent Step 执行。
- 用于读取、列出和文本搜索的 Local Tool primitives。
- Local Tool observation 会以 `tool_result` event 形式回传给 Model Provider。
- `run_command` 的命令风险分类。

## 在本项目中如何工作

CLI 目前故意保持很薄。`run "<task>"` 会接收 Owner 的任务，调用 bootstrap Model Provider，在 `.personal-agent/` 下创建 Workspace State，把可见 Agent Step 和 observation 记录为事件，写入 Checkpoint，并最终生成本地 Task Report 和 Task Evaluation。

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
- Task Evaluation 仍然是简单确定性结果。
- JSON 文件透明，但查询能力弱于数据库。
- command policy 目前保守且基于模式匹配。

## 评测

当前验证命令：

- `npm test`
- `npm run typecheck`
- `npm run build`

当前测试覆盖：

- CLI help 和 Task Run 创建。
- CLI Task Run history。
- CLI Task Run resume。
- CLI Project Memory 查看、追加和分区插入。
- CLI Memory Suggestions apply flow。
- CLI Task Run export。
- CLI 通过 bootstrap Task Run 跑到 completed。
- Workspace State 默认值。
- event 和 Checkpoint 持久化。
- Agent Step 校验。
- runner 执行 provider steps。
- runner 执行 Local Tool observation。
- runner 从 `reflect` steps 收集 Memory Suggestions，并由 CLI 应用。
- runner 会把 Project Memory 注入 fresh run 和 resumed run。
- runner 会在存在相关 note 命中时过滤掉不相关的 Project Memory notes。
- Task Run export 会展示 Decision Trace、Local Tools Used 和 Changed Resources 摘要。
- Task Run export 会对常见环境变量、JSON、URL query、bearer、GitHub 和 `sk-...` secret 模式做脱敏。
- Memory Suggestion 写入 Project Memory 前会经过质量门。
- Memory Suggestion 写入 Project Memory 前会经过精确重复和简单近似重复检查。
- Memory Suggestion 写入 Project Memory 前会经过简单同主题冲突检查。
- Memory Suggestion 写入 Project Memory 前会经过“直接实现 vs 只给方案”的偏好冲突检查。
- Memory Suggestion 写入 Project Memory 前会经过简单同主题否定检查。
- Memory Suggestion 写入 Project Memory 前会经过简单同主题禁止检查。
- Memory Suggestion 写入 Project Memory 前会经过简单中文偏好冲突检查。
- Memory Suggestion 写入 Project Memory 前会经过泛泛不可执行 note 检查。
- 命令风险分类。
- 文件读取、列出和搜索行为。

下一个评测目标：

继续补更广泛的冲突感知 memory fixture，同时保留 fake-provider 测试作为 agent loop 的回归覆盖。
