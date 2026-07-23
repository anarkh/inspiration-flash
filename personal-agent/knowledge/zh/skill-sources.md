# Skill 来源与优先级

## 我们实现了什么

Personal Agent 现在不再只能从当前 workspace 发现 Skill Pack。它会按顺序合并以下目录：

1. workspace skills：`<workspace>/.agents/skills`，
2. user skills：`~/.agents/skills`，
3. package skills：`<installed-package>/.agents/skills`，
4. `<workspace>/.personal-agent/config.json` 中声明的目录。

排在前面的来源优先级更高。某个目录不存在时按空目录处理；相同的物理路径字符串在 discovery 前会去重。
共享 catalog 可以通过 symbolic link 暴露 Skill Pack 目录；discovery 会沿着该链接读取 `SKILL.md`。

每个 Skill Pack 都会记录 source label、source root、优先级编号，以及可选的顶层 `version` frontmatter。多个变体归一化后得到同一个 skill name 时，最高优先级版本胜出，其他低优先级变体不会消失，而是作为 `conflicts` 审计元数据保留。

## 在本项目中如何工作

`src/skills/skill-sources.ts` 负责解析 catalogs。`src/skills/skill-packs.ts` 读取各目录，在每个目录内按名称排序，解析 metadata，并解决同名冲突。

新 workspace 会得到下面的配置字段：

```json
{
  "modelProvider": "deepseek",
  "model": "deepseek-v4-flash",
  "learningLens": false,
  "skillRoots": []
}
```

已有 workspace 可以手动增加 `skillRoots`。每个条目既可以是：

- 包含 `.agents/skills` 的仓库根目录，
- 也可以是直接包含多个 Skill Pack 目录的 skills 目录。

相对路径以 workspace 为基准解析，同时支持绝对路径和 `~/...`。

例如，可以直接共享未来 ability package 的独立 checkout，而不用复制：

```json
{
  "skillRoots": [
    "/path/to/agent-ability-checkout"
  ]
}
```

优先级契约固定如下：

| 优先级 | 来源 | 默认目录 |
| --- | --- | --- |
| 1 | workspace | `<workspace>/.agents/skills` |
| 2 | user | `~/.agents/skills` |
| 3 | package | `<installed-package>/.agents/skills` |
| 4+ | configured | 按 `skillRoots` 顺序 |

隔离测试或单独安装时，可以用 `A_AGENT_USER_SKILLS_ROOT` 替换默认 user catalog。

同名判断会执行 Unicode NFKC 归一化、转小写和忽略标点的比较。`version` 只用于审计，resolver 不做语义化版本协商。假如 workspace 的 `docs-helper` 覆盖了 user 的 `docs-helper`，provider context、`skill_packs` event、Task Export 和 Decision Trace 都会显示这次冲突。

Workspace Skill Pack 继续使用 workspace-relative path。外部 Skill Pack 和 resource 使用绝对路径，这样后续 eval 可以读取真实来源，而不会假装它属于当前 task workspace。

Skill Pack eval runner 现在也使用同一个 catalog。`a-agent eval skill-pack <name-or-path>` 可以定位并读取外部 `evals/evals.json`；生成的 Task Runs 和 eval reports 仍然保存在当前 workspace 的 `.personal-agent/` state 目录。

## `codex/agent-ability` 兼容边界

当前支持的可移植目录形态是：

```text
.agents/skills/<name>/
  SKILL.md
  references/       可选 inventory
  scripts/          可选 inventory
  evals/evals.json  可选 Personal Agent QA manifest
```

`SKILL.md` parser 支持扁平的 `name`、`description` 和可选 `version` frontmatter。没有 `version` 的已有技能仍然有效。源文件中的嵌套 metadata 会被保留，但这一层不会解释它。

`references/`、`scripts/` 和 `evals/` 只作为 resource inventory 被发现。Scripts 不会因此获得执行权限。外部 eval manifest 可以通过现有 eval runner 运行，但它不会自动执行其中的 scripts。

这仍然属于 Guided Skill Use，不是最终 ability runtime。自动匹配目前注入的是 metadata 和 resource inventory，还不是完整的 `SKILL.md` 指令正文。显式 CLI 选择和完整 guidance 加载契约仍属于 Phase 3 的后续工作。

## 其他常见方案

**单目录 discovery**：
只扫描当前仓库。简单、隔离，但每个 workspace 都必须复制共享 skills。

**无序合并**：
加载所有目录，并接受文件系统最先返回的结果。实现容易，但目录顺序和安装状态可能悄悄改变最终胜出的技能，不可复现。

**语义化版本 solver**：
像依赖包一样根据版本约束选择 skills。对于可执行插件很有价值，但当前版本只用于 guidance 审计，此时引入会过重。

**中心 registry**：
通过不可变 registry id 和 lockfile 安装 skills。供应链控制更强，但在本地兼容契约尚未稳定时，会提前增加发布和同步机制。

**只允许手动选来源**：
每次都要求 Owner 指定 path。可预测，但共享 skill 使用繁琐，自动相关性匹配也无法提供帮助。

## 为什么选择当前方案

有序的本地 catalogs 可以先解决可移植性，而不需要引入插件安装器或第二套 Agent 框架。把所有失败候选保留为审计数据，可以解释优先级结果，也让后续显式选择有足够信息展示其他变体。

Workspace 仍然是状态所有者：外部 Skill Pack 从原始来源读取，而 Task Run、confirmation、evaluation 和 report 都留在正在操作的 workspace。

## 优势

- 共享 skills 不需要复制到每个目标 workspace。
- 来源选择确定、可见。
- `version` 可选，因此已有 Skill Pack 继续兼容。
- 可以直接配置 `codex/agent-ability` 风格仓库根目录。
- 外部 eval 复用已有 Task Run 和 grader pipeline。
- 缺失的可选来源不会破坏普通任务。
- 无效 `skillRoots` 会给出聚焦错误，不会被部分接受。

## 劣势与风险

- 高优先级 workspace skill 可以覆盖可信的 user 或 package skill。
- 来源优先级不会比较语义化版本。
- user-root discovery 可能带来更多词法匹配和确认提示。
- 绝对外部路径会让本地审计产物依赖当前机器。
- 字符串路径去重还不会合并 symlink alias。
- 完整外部 Skill 指令和 references 还没有加载到 provider context。
- 还没有专门的 CLI 参数选择特定来源变体。
- Configured roots 属于本地信任决策；这一层不校验签名或 provenance。

## 评测

Focused tests 会验证：

- `workspace > user > package > configured` 优先级，
- 单个来源内的确定性目录顺序，
- 共享 catalog 中链接形式的 Skill Pack 目录，
- 可选 version 保留，
- 所有被覆盖的同名变体仍然可见，
- configured repository root 能通过 `.agents/skills` 解析，
- configured Skill metadata 会进入 provider context，
- Task Export 包含 source、version 和 conflict 明细，
- Decision Trace 会报告已解决的同名冲突，
- 一个无关临时 workspace 无需复制 Skill Pack，就能运行外部 configured Skill Pack eval，
- 已有 workspace-only Skill Pack 行为和 graders 继续通过。

Phase 3 下一步应增加显式 CLI Skill Pack 选择，包括主动选择被覆盖来源变体的能力。
