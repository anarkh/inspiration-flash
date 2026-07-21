# Project Memory

## 我们实现了什么

CLI 现在支持：

```text
a-agent memory
a-agent memory append "<note>"
a-agent memory append --section <section> "<note>"
a-agent memory apply-suggestions [--yes] [run-id]
```

`memory` 会打印当前 workspace 的 `.personal-agent/memory.md`。`memory append` 会把 Owner 提供的短 note 追加到这个文件。`--section` 会把 note 插入到指定 memory 分区下。`apply-suggestions` 会把某次 Task Run 的候选 notes 应用到 Project Memory。

## 在本项目中如何工作

Workspace 初始化时已经会创建：

```text
.personal-agent/memory.md
```

`readProjectMemory(workspace)` 会确保 workspace state 存在，然后读取该文件。`appendProjectMemory(workspace, note, section?)` 会 trim note、拒绝空 note，并写入一个 Markdown bullet。没有 section 时，它保留简单 append-only 行为；有 section 时，它会把 note 插入到下一个二级标题之前。

第一版分类编辑能力仍然保持显式：由 Owner 选择目标 section。Task Run 也可以从 `reflect` steps 生成 Memory Suggestions，但这些建议会先保留为候选文件，直到 Owner 通过确认或显式 `--yes` 主动应用。

Task Run 执行时，runner 会先筛选 Project Memory，再注入到 Model Provider input。它会保留和当前 goal、Success Check 有关键词重合的 notes；如果没有任何 note 命中，则 fallback 到完整 memory 文件。这是轻量关键词检索，不是 embedding 语义检索。

## 分区含义

| 分区 | 含义 | 示例 |
| --- | --- | --- |
| Stable Facts | 长期稳定、变化概率低，并且未来任务经常有用的事实。 | `这个项目是一个本地 CLI personal agent。` |
| Preferences | Owner 的交互风格、输出习惯和实现偏好。 | `用户偏好中文沟通。` |
| Project Conventions | 当前仓库的工程规则和项目约定。 | `中文 Knowledge Base 放在 knowledge/zh/ 下。` |
| Open Threads | 后续要继续推进、调研、实现或验证的事项。 | `后续实现 embedding 检索。` |

CLI 中使用的 section 名称是：

```text
stable-facts
preferences
project-conventions
open-threads
```

## 其他常见方案

**Vector memory**：
把 notes 转成 embedding，并通过语义检索找相关记忆。它适合大规模 memory，但会增加模型成本、索引复杂度，也更难调试检索为什么命中。

**结构化 profile database**：
把 preferences 和 facts 存到 SQLite 或 JSON table。它支持类型化更新和去重，但早期学习阶段不如单个 Markdown 文件直观。

**从对话自动总结 memory**：
让模型在每次任务结束后自动总结并写入 memory。它能减少手工维护，但需要严格评测，避免保存错误事实或过度泛化的偏好。

## 为什么选择当前方案

在加入更自动化的 memory 写入前，Owner 需要一个可检查、可修改的持久偏好入口。本地 Markdown 文件方便阅读、编辑、diff 和测试。

## 优势

- 不依赖额外服务、模型调用或数据库。
- 可以手工检查和修复。
- 明确区分 Knowledge Base 和 Project Memory。
- 同时支持快速追加和显式分类写入。
- 可以配合 Memory Suggestions 使用，但不会自动保存未经 review 的事实。
- 让 fresh run 和 resumed run 都能看到已保存的 memory。
- Memory Suggestions 真正进入长期 memory 前会经过质量门。
- Memory Suggestions 真正进入长期 memory 前会跳过精确重复和简单近似重复 notes。
- Memory Suggestions 真正进入长期 memory 前会跳过简单同主题冲突 notes。
- Memory Suggestions 真正进入长期 memory 前会跳过中英文“直接实现 vs 只给方案/先确认”的冲突 notes。
- Memory Suggestions 真正进入长期 memory 前会跳过简单避免型 project convention 冲突 notes。
- Memory Suggestions 真正进入长期 memory 前会跳过泛泛不可执行的 notes。

## 劣势

- 分类仍然需要手动指定。
- 手工 append 还没有去重或冲突解决。
- 相关 memory 筛选是基于字面词重合的，可能漏掉用词不同但语义相关的 notes。
- 近似重复检测是确定性的别名规则，不是完整语义搜索。
- 冲突检测是确定性的词组和简单否定/禁止/避免规则，不是广义推理。
- 如果当前任务没有命中任何 memory note，runner 仍然会 fallback 注入完整 memory 文件。

## 评测

当前测试验证：

- `a-agent memory` 会初始化并打印 Project Memory。
- `a-agent memory append "<note>"` 会持久化 note。
- `a-agent memory append --section <section> "<note>"` 会把 note 插入指定分区。
- `a-agent memory apply-suggestions --yes [run-id]` 会把候选 notes 应用到对应分区。
- state helpers 可以直接读取和追加 memory。
- state helpers 可以把 memory note 插入命名分区。
- Task Run 会在至少有一条 memory note 命中当前任务时，过滤掉不相关的 Project Memory notes。
- 应用 Memory Suggestions 时会跳过 Project Memory 中已存在的精确重复和简单近似重复 notes。
- 应用 Memory Suggestions 时会跳过简单同主题冲突 notes。
- 应用 Memory Suggestions 时会跳过中英文“直接实现 vs 只给方案/先确认”的偏好冲突。
- 应用 Memory Suggestions 时会跳过简单同主题否定 stable facts。
- 应用 Memory Suggestions 时会跳过简单同主题禁止或避免型 project conventions。
- 应用 Memory Suggestions 时会跳过简单中文冲突 preferences。
- 应用 Memory Suggestions 时会跳过低质量、泛泛不可执行、临时性和疑似 secret 的 notes。

后续评测应增加：

- 超出轻量词组规则的冲突感知 memory 检查。
- 在加入 embedding 前，评测轻量 memory 筛选的 precision 和 recall。
