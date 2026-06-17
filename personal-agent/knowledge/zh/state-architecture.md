# 状态架构

## 我们实现了什么

我们把原来臃肿的 `src/state/store.ts` 拆成了按职责分类的状态模块：

- `src/state/workspace.ts`：初始化 workspace 状态目录和默认文件。
- `src/state/project-memory.ts`：读取 Project Memory、规范化分区名称、追加 memory。
- `src/state/task-runs.ts`：Task Run 元数据、latest 指针、history 列表和状态更新。
- `src/state/run-events.ts`：append-only JSONL 事件流。
- `src/state/checkpoints.ts`：Checkpoint 写入、读取和 latest checkpoint 查询。
- `src/state/task-artifacts.ts`：report、evaluation、export 和 Memory Suggestions 文件。
- `src/state/shared.ts`：状态模块共享的小型文件系统 helper。

`src/state/store.ts` 现在保留为兼容出口，只负责重新导出这些分类模块。已有调用方仍然可以从 `state/store.ts` 导入，但实现代码已经更容易阅读和维护。

## 在本项目中如何工作

状态层仍然使用 `.personal-agent/` 下的本地文件。这次重构只改变代码组织，不改变存储格式：

- Task Run 元数据仍然保存在 `run.json`。
- 事件仍然保存在 `events.jsonl`。
- Checkpoint 仍然保存在 `checkpoints/*.json`。
- Project Memory 仍然保存在 `.personal-agent/memory.md`。
- Export、report、evaluation 和 memory suggestions 仍然保存在每个 run 目录里。

模块依赖保持单向：

- `workspace.ts` 只依赖共享 helper。
- `project-memory.ts` 依赖 workspace 初始化。
- `task-runs.ts` 依赖 workspace 初始化和共享 helper。
- `run-events.ts` 独立。
- `checkpoints.ts` 只依赖共享 helper。
- `task-artifacts.ts` 组合 task runs、events、memory 解析和共享 helper。

这样可以避免状态层出现循环 import。

## 其他常见方案

**单文件 store**：
把所有状态函数都放在一个模块里。MVP 初期很快，但当 Task Run、memory、event、checkpoint、export 一起增长时，会越来越难扫描。

**Repository classes**：
创建 `TaskRunRepository`、`MemoryRepository` 这类 class。它适合依赖注入或多后端场景，但在当前阶段会引入我们暂时不需要的仪式感。

**按 feature 就近存储**：
把状态代码放到各 feature 附近，比如 `agent/task-runs.ts` 和 `memory/store.ts`。这样 feature 局部性更强，但共享的文件系统约定会更分散。

**数据库层**：
使用 SQLite、Prisma 或 ORM。查询和事务会更强，但会削弱当前项目“打开文件就能学习和检查”的优势。

## 为什么选择当前方案

本项目仍然是学习导向、文件优先的 agent 练手项目。按职责拆分模块可以降低理解成本，同时不改变运行行为、公共导入路径和磁盘数据格式。兼容出口让我们现在先重构内部结构，未来如果需要，再逐步把调用方迁移到更细的直接导入。

## 优势

- 更容易定位某个状态能力对应的代码。
- 风险低于存储重写，因为文件格式没有变化。
- 已有调用方和测试仍然使用相同导入路径。
- 模块边界让后续替换事件、memory 或 artifact 存储更局部。
- 依赖关系足够简单，适合学习 agent 持久化设计。

## 劣势

- `state/store.ts` 仍然导出很多名称，所以公共 API 的宽度还没有收窄。
- 文件状态仍然没有数据库事务和复杂查询能力。
- artifact 模块会组合多个状态模块，后续要避免它变成新的大文件。

## 评测

这次重构通过对比拆分前后的行为来评测：

- 跑状态层测试，验证 Workspace State、Task Run、Project Memory、event、checkpoint、export 和 Memory Suggestions。
- 跑 typecheck，检查导出、导入和潜在循环依赖问题。
- 在收尾前跑完整测试和 build。

最重要的回归信号是：存储路径和生成文件保持兼容，同时源码结构变得更容易导航。
