# Task Evaluation

## 目的

每个完成的 Task Run 都应该生成一次 Task Evaluation。目标不是抽象地给模型打分，而是判断这一次具体 Task Run 是否安全地达成了 Owner 的目标，并留下足够证据供学习和复盘。

## 评测输出

评测结果随 Task Run 保存：

```json
{
  "verdict": "pass | partial | fail | blocked",
  "successCheck": "pass | fail | unavailable",
  "gateSafety": "pass | fail",
  "traceQuality": "pass | partial | fail",
  "reportQuality": "pass | partial | fail",
  "modelReview": {
    "verdict": "pass | partial | fail | blocked | unavailable | invalid",
    "reason": "..."
  },
  "learningSignals": ["..."],
  "followUps": ["..."]
}
```

## 必要检查

**Success Check**：
Task Run 是否满足显式 Success Check？如果没有客观检查方式，就标记为 unavailable，并在 Task Report 中说明。

**Gate Safety**：
Personal Agent 是否遵守 Confirmation Gate 和 Clarification Gate？任何未确认的高影响动作都算失败。

**Decision Trace Quality**：
Owner 是否能看出 Task Plan、Skill Pack、Local Tool 和 Recovery Attempt 为什么被选择？

**Task Report Quality**：
最终报告是否说明 outcome、changed resources、verification、unresolved questions 和 proposed Reflection Notes？

**Learning Signals**：
Task Run 是否暴露了 Project Memory 更新、Knowledge Base 更新、Skill Pack 改进或 Capability Backlog 项？

## 确定性 Evaluator

`src/agent/evaluation.ts` 实现了 `runTask` 和 `resumeLatestTask` 使用的第一版任务后评测器。它只读取可见 artifact：声明的 Success Check、最终 Task Report、provider-neutral events，以及生成的 Memory Suggestions。

当前行为：

- 当非空 Success Check 对应一个非空 report 时，`successCheck` 为 `pass`；report 为空时为 `fail`；没有声明 Success Check 时为 `unavailable`。
- 如果 durable event trace 中还残留未处理的 confirmation-required tool result，`gateSafety` 才会失败。
- run 同时包含 plan 和 finish step 时，`traceQuality` 为 `pass`；没有 plan 但完成了 finish 时为 `partial`；没有 finish 时为 `fail`。
- 最终 report 有可用文本时，`reportQuality` 为 `pass`。
- Memory Suggestions 会生成 `Project Memory suggestion` learning signal，以及 `Review Memory Suggestions` follow-up。

顶层 `verdict` 是确定性的：安全失败、Success Check 失败或 report quality 失败会得到 `fail`；Success Check 不可用或 trace quality 只有 partial 会得到 `partial`；其余情况为 `pass`。

## 模型辅助自评

`a-agent run --review "<task>"`、`a-agent start --review` 和 `a-agent resume --review` 会在 `evaluation.json` 中增加可选的模型辅助自评。

模型自评存放在 `modelReview` 下，不会覆盖确定性的 `verdict`。这是有意设计：模型自评可以补充语义反馈，但不能掩盖失败命令、缺失确认或空报告。

当选中的 provider 是 `bootstrap` 时，自评会记录为：

```json
{
  "verdict": "unavailable",
  "reason": "Model-assisted review requires a real Model Provider."
}
```

当存在真实 provider 时，runner 会把完成后的 Task Report、可见 events 和确定性 evaluation 发给 provider，并期待 provider 返回一个 `finish` step，其中 report 是如下 JSON：

```json
{
  "verdict": "pass | partial | fail | blocked",
  "reason": "..."
}
```

如果模型自评输出格式错误，会记录为 `invalid`，而不是让已经完成的 Task Run 失败。

## 自动评测与人工评测

当前版本：

- 对 Task Run 文件运行确定性检查。
- 使用 `a-agent eval skill-pack <name-or-path>` 在本地运行 Skill Pack eval manifest。
- 可以通过 `--review` 请求当前真实 Model Provider 做结构化自评。

后续版本：

- 允许 Owner 覆盖 verdict。

- 增加 golden Task Runs 作为可重复回归测试。
- 对重要 Task Run 通过 Agent Bridge 做 External Review。
- 使用真实 Skill Pack eval 积累出的 golden examples 校准模型辅助 grader。
- Complex Embedding Retrieval 实现后增加检索专项评测。

## Skill Pack Eval Runner

`src/skills/evals.ts` 实现了第一条可执行 eval 路径。它会读取 `.agents/skills/<skill>/evals/evals.json`，把每个 case 当作普通 Task Run 执行，然后写入：

- `.personal-agent/evals/<skill>/<eval-run-id>/report.md` 下的 Markdown 报告。
- 同目录下的机器可读 JSON 结果。
- 每个 case 对应的底层 Task Run 文件，仍然放在 `.personal-agent/runs` 下。

Manifest 契约记录在 `schemas/skill-evals.schema.json`。它是 Personal Agent 的可选质量层，不是 Anthropic Skill runtime 契约的一部分。schema 要求非空 `skill_name` 和 `evals` 数组；每个 eval case 要求非空 `id`、`prompt` 和 `expected_output`。`files` 和 `grader` 保持可选，这样简单 case 不需要写太多样板字段。当 `files` 出现时，它必须是字符串路径数组；无效条目会被拒绝，而不是被静默过滤掉。

运行期 parser 使用一个小型字段白名单，模拟 schema 里的 `additionalProperties: false` 规则。未知的顶层 manifest 字段、eval case 字段和 grader 字段都会在任何 Task Run 开始前被拒绝。静态 Skill Pack inventory 也使用同类检查，所以普通 Task Run 会展示 `eval manifest: invalid (...)`，而不是默默把草稿 metadata 当成正式契约的一部分。当多个 eval case 都无效时，两条路径会把 case 错误聚合成一条消息；只有单个错误时仍保持简洁文案。

第一版 graders 故意保持确定性。默认使用 `contains`：最终 Task Report 在 Unicode 归一化和大小写折叠后包含 `expected_output` 字符串，就算通过。case 也可以声明 `grader: { "type": "regex", "pattern": "..." }`，用于期望证据更适合用模式表达的场景。Regex grader 会在任何 Task Run 开始前校验 `pattern` 是非空字符串，这样 manifest 错误更容易修。case 还可以声明 `grader: { "type": "tool_trace", "tool": "read_file" }`，只有 Task Run 事件日志里出现该 Local Tool 时才通过。`tool_trace` 还支持 `input_contains`，例如 `grader: { "type": "tool_trace", "tool": "read_file", "input_contains": "notes.md" }`，用于检查匹配 tool call event 的序列化输入。它也支持 `input_matches`，例如 `grader: { "type": "tool_trace", "tool": "read_file", "input_matches": { "path": "notes.md" } }`，用于把部分 JSON 对象和 tool call input 做结构化匹配。`input_schema` 会把一个 compact JSON Schema-style matcher 应用到工具调用输入上，例如 `grader: { "type": "tool_trace", "tool": "read_file", "input_schema": { "type": "object", "required": ["path"], "properties": { "path": { "type": "string" } } } }`。`output_contains` 会检查匹配 `tool_result` event 的序列化输出，例如 `grader: { "type": "tool_trace", "tool": "read_file", "output_contains": "alpha marker" }`。`output_matches` 会把部分 JSON 对象和 `tool_result.output` 做匹配，例如 `grader: { "type": "tool_trace", "tool": "run_command", "output_matches": { "exitCode": 0 } }`。`output_type` 会检查顶层 JSON 风格输出类型，例如 `object`、`array` 或 `string`。`output_schema` 会把同一个 compact schema matcher 应用到 `tool_result.output`，例如要求 `run_command` 返回一个带数字 `exitCode` 和字符串 `stdout` 的对象。这个 compact schema 子集支持 `type`、`required`、`properties`、`items`、`const`、`enum` 和 `additionalProperties: false`。它不是完整 JSON Schema 2020-12 实现；它是为 eval fixture 准备的小型确定性 validator，后续如果真实 Skill Pack 需要更多 schema 特性，可以替换为 Ajv 或其他完整 validator。

`model_judge` 是第一版语义 grader。case 可以声明 `grader: { "type": "model_judge", "rubric": "Pass only if ..." }`。普通 Task Run 完成后，eval runner 会把 prompt、expected output note、rubric 和最终 Task Report 发给当前配置的 `ModelProvider`。provider 必须返回一个 `finish` step，并且 report 中包含 `{ "verdict": "pass" | "fail", "reason": "..." }` 形状的 JSON。这样 eval 就能检查那些很难用确定性文本、轨迹或 schema 表达的质量要求。

`model_judge` 还支持重复评审：`judge_runs` 控制调用 judge 的次数，`pass_threshold` 控制需要多少个 `pass` verdict 才算通过。两者都是可选的 1 到 5 整数。默认值是 `judge_runs: 1`，以及 `pass_threshold: judge_runs`。例如 `judge_runs: 3` 加 `pass_threshold: 2` 表示三次 judge 里至少两次返回 `pass` 才通过。这可以降低单次判断的偶然性，但会增加成本和延迟。

每个 `model_judge` case 现在都会在 `results.json` 里记录一个 `judge` 对象，包含 `runs`、`passThreshold`、`passedCount` 和每次 judge 的 verdict 列表。Markdown 报告也会写入聚合 judge 计数和每一次 judge run。如果 judge 返回坏 JSON、不支持的 verdict、非字符串 reason，或返回的不是 `finish` step，这一次会被记录为带 reason 的 `invalid`，而不是混进总的 pass/fail 结果里消失。结果仍然会受 judge 模型、prompt wording 和模型可用性影响，所以在有真实 golden examples 之前，更适合作为语义质量检查，而不是安全关键 gate。

## 不要做什么

- 不要把漂亮的最终回答直接当作 pass。
- 不要让自评覆盖失败命令或缺失确认。
- 不要隐藏不可验证状态；要明确标记 unavailable。

## 参考

OpenAI 的评测资料强调为具体任务创建 grader，并用 evals 衡量 agent 行为。对本项目来说，第一版先保持本地、文件化评测路径；只有当外部评测服务适配工作流时再集成。

- [OpenAI eval skills guide](https://developers.openai.com/blog/eval-skills)
- [OpenAI Evals API docs](https://platform.openai.com/docs/guides/evals)
