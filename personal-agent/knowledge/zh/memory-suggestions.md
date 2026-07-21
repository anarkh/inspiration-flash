# Memory Suggestions

## 我们实现了什么

Task Run 现在可以从模型的 `reflect` step 生成候选 Project Memory notes。

当模型输出：

```json
{
  "type": "reflect",
  "section": "preferences",
  "note": "Owner prefers concise CLI output."
}
```

runner 会把候选项写入：

```text
.personal-agent/runs/<run-id>/memory-suggestions.json
```

该建议也会出现在 `a-agent export [run-id]` 的 `Memory Suggestions` 分区中。

review 后的建议可以通过以下命令应用：

```text
a-agent memory apply-suggestions [run-id]
a-agent memory apply-suggestions --yes [run-id]
```

## 在本项目中如何工作

`reflect` 仍然是 provider-neutral Agent Step，但现在可以带一个可选的 `section`。

支持的 section 和 Project Memory 一致：

- `stable-facts`
- `preferences`
- `project-conventions`
- `open-threads`

Task Run 完成时，runner 会收集 `reflect` events，规范化 section，并把每条建议保存为：

```json
{
  "section": "preferences",
  "note": "Owner prefers concise CLI output.",
  "reason": "Model reflection during the Task Run",
  "source": "model_reflect"
}
```

这些只是候选项，不会自动写入 `.personal-agent/memory.md`。

`memory apply-suggestions` 会读取候选文件，并把被批准的 notes 写入对应 Project Memory section。在询问确认或写入之前，CLI 会先运行确定性的质量门、冲突检查，并检查建议 note 是否已经存在于 Project Memory 的任意分区中。已经存在、近似重复、存在冲突或质量较低的 notes 会被跳过，避免重复、不安全或薄弱的建议进入长期 memory。

在交互式终端中，CLI 会逐条询问每条未被跳过的 note；在非交互脚本中，必须显式传入 `--yes`，表示“应用这次 run 的全部未被跳过的建议”。

重复检测刻意保持窄范围和可解释。它会先 trim note、合并重复空白，并忽略大小写比较。如果精确检查没有命中，它还会用规范化 term overlap 加一张很小的同义词表继续比较，例如 `brief`/`concise`、`command line`/`CLI`、`likes`/`prefers`。

这可以挡住 `Owner likes brief command line output.` 这类对 `Owner prefers concise CLI output.` 的简单改写。它不是 embedding 检索，也不理解任意语义。

冲突检测也刻意保持窄范围。当前它能识别 `Owner prefers concise CLI output.` 与 `Owner prefers verbose CLI output.` 这类同主题相反偏好，也能识别 `Owner prefers the agent to implement changes directly.` 与 `Owner prefers the agent to only propose changes.` 这类英文“直接实现 vs 只给方案”的 agent 自主性偏好冲突，以及 `用户偏好 agent 直接修改代码。` 与 `用户偏好 agent 先确认再执行。` 这类中文自主性偏好冲突；还能识别 `用户偏好精简输出。` 与 `用户偏好详细输出。` 这类中文偏好冲突、`Project uses LangChain.` 与 `Project does not use LangChain.` 这类同主题否定冲突，以及 `Generated code must include necessary comments.` 与 `Generated code should avoid comments.` 这类简单禁止或避免型 project convention 冲突。CLI 会报告已有 note，并跳过候选项，即使传了 `--yes` 也不会直接写入。

当前质量门会拒绝：

- 过短、很难成为有用长期记忆的 notes；紧凑中文 note 可以通过汉字数量阈值。
- 包含常见 secret 模式的 notes，例如 API key、bearer token 或 `sk-...` key。
- 带有临时表达的 notes，例如 `today`、`tomorrow`、`this task`、`for now`、`今天` 或 `暂时`。
- 不能指导后续决策的泛泛 notes，例如 `The project is important.` 或 `Owner wants good results.`。

这个质量门刻意保持保守和确定性。它能在写入 `.personal-agent/memory.md` 前挡住明显不合适的候选，但不会判断事实真假或更细微的有用性。

## 完成定义

Memory Suggestions 分成两条独立轨道：

- **v1 能力**：已经足够进入 agent loop 使用。
- **鲁棒性 backlog**：持续扩展 fixture 和边界检查。

v1 能力可以视为已完成，因为项目现在已经可以：

- 从 provider-neutral `reflect` step 收集候选 memory notes。
- 把候选项保存为 Task Run 内的 `memory-suggestions.json`。
- 在 Task Export 中展示候选项。
- 通过 `a-agent memory apply-suggestions` 应用 review 后的候选项。
- 在写入长期 Project Memory 前要求显式批准或 `--yes`。
- 在批准前运行质量门。
- 跳过精确重复和简单近似重复 notes。
- 跳过已知的简单冲突。
- 保留从 model reflection 到 candidate note 再到 durable memory 的审计路径。
- 用自动化测试和中英文 Knowledge Base 文档验证这条链路。

鲁棒性 backlog 不是后续阶段的阻塞条件。它是一条长期评测轨道，因为自然语言 memory 质量没有固定终点。每当出现真实或合理的坏 memory 模式，都应该继续增加 fixture。

## 鲁棒性 Backlog

后续继续增强：

- 更多英文和中文冲突表达。
- 更多 project convention 变体。
- 错误、缺少依据或过度自信的事实过滤。
- 超出简单临时词的 unstable fact 过滤。
- 更好的 section selection 检查。
- 更宽泛的近似重复检测。
- 未来基于 embedding 的语义重复检测。
- 带 expected accept/skip 结果的 benchmark-style fixture 集。

进入 Skill Pack 阶段并不表示这条 backlog 已经完成。它表示 Memory Suggestions v1 已经具备可用、可测试的安全基线，所以更大的 agent 能力可以继续推进，同时 memory 鲁棒性并行增强。

## 其他常见方案

**自动写入 memory**：
一些 agent 会在对话结束后立刻写长期记忆。这很方便，但风险较高，因为错误事实或临时偏好可能被持久化。

**Embedding-only memory**：
有些系统会把每次摘要都存进 vector database。它有利于后续检索，但不方便 review、删除和修正，不太适合当前学习优先的本地 agent。

**纯人工维护 memory**：
Owner 手工写入每条 memory note。最安全，但长任务或重复任务结束后很容易忘记沉淀。

**批量批准**：
有些系统会一次性应用所有建议。效率更高，但批准面容易变得太宽。本项目只通过显式 `--yes` 支持批量批准。

## 为什么选择当前方案

项目需要在模型反思和长期记忆之间加一层桥。候选文件能保留模型建议，同时让 Owner 控制哪些内容真正进入长期 Project Memory。

## 优势

- memory 写入保持可 review。
- 复用现有 Agent Step loop，不额外增加一次模型调用。
- 建议会出现在 Task Export 中，方便复盘。
- 从 reflection 到 candidate note 有清晰审计路径。
- 支持交互式逐条批准，也支持显式批量批准。
- 写入 Project Memory 前会跳过精确重复和简单近似重复 notes。
- 写入 Project Memory 前会跳过简单同主题冲突 notes。
- 写入 Project Memory 前会跳过中英文“直接实现 vs 只给方案/先确认”的 agent 自主性偏好冲突。
- 写入 Project Memory 前会跳过使用 avoidance 表达的简单 project convention 冲突。
- 批准前会拒绝明显低质量、过度泛化、临时性或疑似 secret 的建议。

## 劣势

- 当前 runner 只收集显式 `reflect` step。
- 近似重复检测是字面 term 加小型同义词表，不是完整语义级别，所以仍可能漏掉更宽泛的改写。
- 冲突检测是词法级别，并且只覆盖已知的相反词组和简单否定/禁止/避免词。
- 质量检查是启发式的，可能漏掉隐蔽的坏 memory，也可能漏掉当前 pattern 未覆盖的过度泛化表达。
- 中文友好的长度规则仍然只是简单字符数启发式。
- 手工 `memory append` 仍然可以写入重复内容，因为当前去重只应用于 Memory Suggestions。
- 无效 section 会回退到 `open-threads`，安全但不一定最准确。

## 评测

当前测试验证：

- `reflect` step 可以携带 memory section。
- runner 会写入 `memory-suggestions.json`。
- Task Run Markdown export 在存在建议时会包含 Memory Suggestions。
- state helpers 可以读取 Memory Suggestions。
- CLI `memory apply-suggestions --yes [run-id]` 会把建议写入 Project Memory。
- CLI `memory apply-suggestions --yes [run-id]` 会跳过 Project Memory 中已存在的建议。
- CLI `memory apply-suggestions --yes [run-id]` 会跳过简单同义改写形成的近似重复建议。
- CLI `memory apply-suggestions --yes [run-id]` 会跳过简单同主题冲突偏好。
- CLI `memory apply-suggestions --yes [run-id]` 会跳过中英文“直接实现 vs 只给方案/先确认”的 agent 自主性偏好冲突。
- CLI `memory apply-suggestions --yes [run-id]` 会跳过简单中文冲突偏好。
- CLI `memory apply-suggestions --yes [run-id]` 会跳过简单同主题否定 stable facts。
- CLI `memory apply-suggestions --yes [run-id]` 会跳过简单同主题禁止或避免型 project conventions。
- CLI `memory apply-suggestions --yes [run-id]` 会跳过过短、临时性、疑似 secret 和泛泛不可执行的建议。

后续评测应增加：

- 对更宽泛同义改写 notes 的 embedding 支持。
- 为更多 project convention 形态和更多 stable fact 形态增加更宽的冲突 fixture。
- 对错误、缺少依据或不稳定 memory notes 的更丰富质量检查。
