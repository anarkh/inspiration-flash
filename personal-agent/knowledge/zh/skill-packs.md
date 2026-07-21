# Skill Packs

## 我们实现了什么

Personal Agent 现在支持第一层 Guided Skill Use。

Task Run 过程中，runner 会扫描当前 workspace 下的本地技能：

```text
.agents/skills/<skill-name>/SKILL.md
```

它会根据当前 goal 和 Success Check，与 skill 的 name、description 做轻量关键词匹配，同时优先选择 Owner 显式点名的 skill，然后把命中的 skill 摘要作为可见上下文传给 Model Provider。

这还不是强插件运行时。Skill Pack 层不会直接执行 skill scripts。Eval manifest 现在可以通过普通 Task Run loop 执行，但这仍然不代表 Skill Pack scripts 获得了自动执行权限。`evals/` 是 Personal Agent 的 QA 层；Anthropic 风格的 Skill discovery 不要求它存在。

## 在本项目中如何工作

`src/skills/skill-packs.ts` 负责 Skill Pack discovery 和 context 边界。`src/skills/evals.ts` 负责本地 Skill Pack eval runner。

MVP 流程是：

1. 读取 `.agents/skills`。
2. 遍历每个子目录，存在 `SKILL.md` 时读取它。
3. 解析很小一部分 frontmatter：

```yaml
---
name: docs-helper
description: Helps summarize workspace documentation and README files.
---
```

4. 从可选的 `references/`、`scripts/`、`evals/` 目录收集 agent-ability 风格 resource inventory。
5. 存在 `evals/evals.json` 时读取它，并总结它是否符合 `schemas/skill-evals.schema.json`。
6. 从 task goal、Success Check、skill name 和 skill description 中提取轻量关键词。
7. 识别 `use docs-helper skill` 这类 Owner 显式点名。
8. 保留命中的 skills，把显式点名的 skill 排在前面，并格式化成：
9. 当选中的多个 Skill Pack 并非都由 Owner 显式点名时，先请求确认，再决定注入哪些 guidance。

```markdown
# Relevant Skill Packs

## docs-helper

- path: .agents/skills/docs-helper/SKILL.md
- description: Helps summarize workspace documentation and README files.
- resource inventory:
  - references: .agents/skills/docs-helper/references/guide.md
  - scripts are inventory only and are not auto-executed by the Skill Pack layer
  - scripts: .agents/skills/docs-helper/scripts/search_index.py
  - evals: .agents/skills/docs-helper/evals/evals.json
  - eval manifest: valid (1 eval)
```

runner 会通过 `ModelProviderInput.skillPacks` 传入这段上下文。OpenAI-compatible provider 会把该字段放进 JSON prompt payload，因此默认 DeepSeek 路径也会收到同样的 Skill Pack context。

当一次 fresh Task Run 命中 Skill Packs 时，runner 还会记录一个 `skill_packs` event，里面包含已选 skill 的 name、path 和 resource inventory。Task Export 会读取这个 event，并渲染 `Skill Packs Used` 分区，让运行结束后的复盘也能看到哪些 guidance 和资源路径影响了本次任务，同时不会把这类记账 event 回传给模型对话。

当 fresh Task Run 发现多个非显式命中的 Skill Packs 时，runner 会通过与 Local Tools 相同的确认路径创建一个 `skill_packs` confirmation request。Owner 可以批准全部、拒绝全部，也可以返回选中的 Skill Pack paths。CLI 在这个场景下接受 `1,3` 这类编号选择。如果 Owner 拒绝，或当前没有 confirmation handler，这些有歧义的 Skill Packs 就不会被注入 Model Provider。确认结果和选中的子集会记录为 `skill_packs_confirmation` event，方便后续复盘。

Model Provider 可以用它辅助规划和选择工具，但 runner 仍然只执行普通 Agent Steps 和 Local Tools。Resource inventory path 只是提示，不代表自动执行权限。当 Skill Pack 暴露 `scripts/` 时，provider context 和 Task Export 都会额外写明 scripts 只是 inventory，不会被 Skill Pack 层自动执行。

eval runner 新增了独立命令：

```bash
a-agent eval skill-pack docs-helper
```

它可以通过 frontmatter name、目录名、skill 目录路径或 `SKILL.md` 路径定位 Skill Pack。然后读取 `evals/evals.json`，把每个 eval case 转成一个显式点名该 Skill Pack 的普通 Task Run，并把报告写到 `.personal-agent/evals/<skill>/<eval-run-id>/`。manifest schema 要求非空 `skill_name` 和 `evals`；每个 case 要求非空 `id`、`prompt` 和 `expected_output`。manifest、eval case 和 grader 级别的未知字段都会被拒绝，与 schema 的闭合对象契约保持一致。可选 `files` 字段一旦出现，里面的条目必须都是字符串，因此 fixture 声明会保持明确，而不会被部分接受。第一版 graders 是确定性的：默认 `contains` grader 检查 `expected_output`，可选 `regex` grader 检查声明的非空 pattern，可选 `tool_trace` grader 检查指定 Local Tool 是否出现在 Task Run 事件日志中。`tool_trace` 还可以要求 `input_contains` 子串、`input_matches` 部分 JSON 对象，或 `input_schema` compact JSON Schema-style matcher，让 case 校验工具是否带着预期 fixture 路径、参数字段或 typed input shape 被调用。`output_contains` 会验证匹配 `tool_result` 的输出是否包含预期证据，`output_matches` 会验证 `tool_result.output` 里的结构化字段，`output_type` 会验证结果的顶层 JSON 风格类型，`output_schema` 会验证 compact typed result shape。compact schema matcher 支持 `type`、`required`、`properties`、`items`、`const`、`enum` 和 `additionalProperties: false`。`model_judge` 增加了语义 grader：它会把最终 Task Report 和 rubric 发给当前配置的 `ModelProvider`，并期待返回 JSON `pass` 或 `fail` verdict。可选的 `judge_runs` 和 `pass_threshold` 允许同一个 case 最多发起五次 judge 调用，并要求达到指定 pass 数才算通过。每个 model-judged case 都会把逐次 judge 明细写入 JSON 和 Markdown artifact，包括把格式错误的 judge 输出记录为 `invalid`。这样可以发现“工具轨迹结构正确，但最终报告仍然没有满足人的意图”的情况，同时保留后续校准需要的证据。

## 其他常见方案

**强插件运行时**：
把 skills 变成带 manifest、permissions、schemas、scripts 和 versioning 的 typed capabilities。能力更强，但可执行攻击面也更大。

**基于 embedding 的 skill 检索**：
对完整 skill 内容做向量检索。它能处理更宽泛的表达，但需要 retrieval 评测，否则可能注入无关指令。

**只允许人工选择 skill**：
Owner 显式指定 skill。安全、可预测，但当 agent 应该推荐明显相关的 guidance 时帮助较小。

**框架原生 tools**：
一些框架会把 skills 暴露为 tool calls 或 sub-agents。后续可能有用，但现在会过早绑定框架特定契约。

**Eval 平台和模型 grader**：
外部 eval 平台可以运行大型套件，并支持自定义 grader、数据集和 dashboard。等能力积累足够样例后会很有价值，但第一步先留在本地，这样 Owner 可以检查每个 Task Run 和 artifact。

## 为什么选择当前方案

项目需要在“完全没有 Skill Pack 支持”和未来 `codex/agent-ability` runtime 之间搭一座桥。小型 discovery-and-context 层可以让我们学习 skill 如何进入 agent loop，同时把执行能力继续放在现有 Local Tools 和 Confirmation Gates 后面。

## 优势

- Skill Pack 使用过程可见、可检查。
- 不增加新的可执行权限面。
- 为未来接入 `codex/agent-ability` 保留清晰边界。
- 使用确定性的关键词匹配，容易测试和解释。
- Owner 可以通过显式点名 Skill Pack 覆盖较弱的关键词匹配。
- Model Provider 能拿到相关 skill guidance，但 Agent Steps 不会绑定到某个 skill runtime。
- Task Export 会记录已选 Skill Packs，便于后续复盘本次任务受到了哪些 guidance 影响。
- Task Export 会记录已选 Skill Pack 的 resource inventory，便于后续复盘哪些路径曾暴露给模型。
- Provider context 和 Task Export 会把 Skill Pack scripts 标记为 inventory-only，为未来 runtime 保留执行边界。
- 多个自动选择的 Skill Packs 会复用 Confirmation Gates，避免静默注入一组可能有歧义的 guidance。
- 当多个自动命中都有一定价值但不应全部进入上下文时，支持只选择其中一部分。
- 能识别 agent-ability 风格的 `references/`、`scripts/` 和 `evals/` 资源，但暂时不把它们升级成可执行能力。
- 会在普通 Task Run 中总结 `evals/evals.json` 的有效性和 eval 数量。
- 可以按需通过同一个 Task Run loop 执行声明好的 Skill Pack eval cases。
- 在 `schemas/skill-evals.schema.json` 中记录可选 eval manifest 契约。
- 在运行 case 前拒绝未知 eval manifest 字段，让文件格式保持明确、可学习。
- 在运行 case 前拒绝无效 `files` 数组，与已文档化 schema 保持一致，而不是丢掉坏条目。
- 在运行 case 前拒绝空的必填 eval case 字符串，与 schema 的 `minLength` 规则保持一致。
- 会把多个无效 eval case 一次性报告出来，减少修 manifest 时的编辑-运行往返。
- 空 regex grader pattern 会报告字段级错误，而不是泛化成 unsupported grader。
- 当 eval 需要基于 rubric 做语义型报告审查时，支持 `model_judge` grader。
- 当语义判断需要重复评审后才接受 pass 时，支持 `model_judge.judge_runs` 和 `model_judge.pass_threshold`。
- 会在 eval artifacts 中记录每次 `model_judge` 的 verdict、reason、无效输出和阈值聚合结果。
- 支持 `tool_trace` grader，用确定性方式检查 Local Tool 使用轨迹。
- 当 eval 需要验证某个具体工具参数片段时，支持 `tool_trace.input_contains`。
- 当 eval 需要验证结构化工具参数字段时，支持 `tool_trace.input_matches`。
- 当 eval 需要验证 typed tool argument shape 时，支持 `tool_trace.input_schema`。
- 当 eval 需要验证 Local Tool 返回的证据时，支持 `tool_trace.output_contains`。
- 当 eval 需要验证 Local Tool 结果的结构化字段时，支持 `tool_trace.output_matches`。
- 当 eval 需要验证 Local Tool 结果的顶层类型时，支持 `tool_trace.output_type`。
- 当 eval 需要验证 typed Local Tool result shape 时，支持 `tool_trace.output_schema`。

## 劣势

- 匹配是词法级别，可能漏掉用词不同但相关的 skill。
- 当前只使用 frontmatter 的 name 和 description 做匹配。
- Resource inventory 只列出路径；不会加载 reference 内容。
- 静态 eval manifest 校验会检查本地 schema 契约，包括未知字段和 compact schema 声明，但还没有接入外部 JSON Schema validator。
- 运行期 eval grading 支持 `contains`、`regex`、`tool_trace` 和 `model_judge`，但模型辅助 grading 是非确定性的，并依赖当前配置的 provider。
- `tool_trace.input_contains` 是子串检查，比 schema matcher 更容易检查和学习，但不如 typed argument validation 精确。
- `tool_trace.input_matches` 是部分对象 matcher，不是完整 JSON Schema validator。
- `tool_trace.input_schema` 支持 compact schema 子集，不支持所有 JSON Schema 2020-12 关键字。
- `tool_trace.output_contains` 是子串检查，不会验证完整输出结构。
- `tool_trace.output_matches` 是部分对象 matcher，不是 typed result schema。
- `tool_trace.output_type` 只检查顶层 JSON 风格 value type。
- `tool_trace.output_schema` 支持 compact schema 子集，不支持所有 JSON Schema 2020-12 关键字。
- `model_judge` 可以捕捉语义问题，但会增加模型成本、延迟、provider 可用性风险和 judge drift。
- 重复 `model_judge` 可以降低单次调用噪声，但会成倍增加模型成本，并且仍然不能证明正确性。
- Model judge 诊断让失败更容易审计，但仍然需要真实 golden examples 才能持续校准。
- CLI 还没有专门的 `--skill` 参数。
- 显式选择仍然是文本级判断；它只确认任务文本中出现了 Skill Pack 名称，不会进一步验证 Owner 意图。
- 子集选择目前基于 path 和终端编号输入；还没有更丰富的交互式 picker。
- Skill scripts 不由这一层执行，仍然必须通过普通 Local Tools 调用。

## 评测

当前测试验证：

- runner 会发现 `.agents/skills/<name>/SKILL.md`。
- runner 会按任务相关性过滤 Skill Packs。
- Owner 显式点名的 Skill Pack 会优先于关键词分数更高的普通匹配。
- runner 会把相关 Skill Pack 摘要传给 Model Provider。
- runner 会把已选 Skill Packs 记录到 Task Export。
- runner 会在注入多个自动命中的 Skill Packs 前请求确认。
- confirmation 返回 selected paths 时，runner 只注入选中的 Skill Pack 子集。
- 终端 confirmation parsing 会把编号 Skill Pack 选择映射为 selected paths。
- agent-ability 风格 resource inventory 会进入 Skill Pack provider context。
- runner 会在把已选 Skill Packs 传给 Model Provider 时保留 resource inventory。
- `evals/evals.json` 符合 schema 约束时，会展示 valid 和 eval count 摘要。
- 缺少 `skill_name` 的 eval manifest 会在 case 执行前被拒绝。
- 包含未知顶层字段、case 字段或 grader 字段的 eval manifest 会在 case 执行前被拒绝。
- 包含非字符串 `files` 条目的 eval manifest 会在 case 执行前被拒绝。
- 包含空必填 case 字符串的 eval manifest 会在 case 执行前被拒绝。
- 包含多个无效 case 的 eval manifest 会把已测试到的 case 错误一起报告出来。
- 包含空 regex grader pattern 的 eval manifest 会报告具体 pattern 错误。
- eval manifest JSON Schema 会记录这个可选质量层契约。
- CLI 可以执行 Skill Pack eval manifest。
- eval runner 会用本地 Markdown 和 JSON artifact 报告通过和失败 case。
- eval runner 支持 `contains`、`regex`、`model_judge`、`model_judge.judge_runs`、`model_judge.pass_threshold`、`tool_trace`、`tool_trace.input_contains`、`tool_trace.input_matches`、`tool_trace.input_schema`、`tool_trace.output_contains`、`tool_trace.output_matches`、`tool_trace.output_type` 和 `tool_trace.output_schema` graders。
- eval runner 会在本地 artifacts 中记录逐次 `model_judge` 明细，包括无效 judge 输出。
- 无效 eval grader 声明会在 case 执行前被拒绝。
- OpenAI-compatible provider 会把 Skill Pack context 放进模型 prompt payload。
- 测试任务中不相关的 Skill Pack 不会被注入。

后续评测应增加：

- 无效子集输入 fixture 和 CLI pseudo-terminal 覆盖。
- 真实 Skill Pack eval 积累足够样例后，为 `model_judge` 增加 golden-example 校准测试。
- 如果真实 Skill Pack 需要更完整的 schema 特性，可以把 compact `tool_trace` schema matcher 替换为 Ajv 等完整 JSON Schema validator。
