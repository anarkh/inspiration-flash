# @ranarkh/agent

`@ranarkh/agent` is a local, CLI-first Personal Agent for workspace tasks. It is also a learning project: planning, tools, permissions, memory, checkpoints, skills, reports, and evaluation stay visible instead of being hidden behind an agent framework.

The current release is an MVP baseline. It handles local workspace tasks and persistent terminal chat, but networking, embedding retrieval, and executable Skill Pack scripts remain roadmap work.

## Requirements

- Node.js 22 or newer.
- npm.
- A DeepSeek credential for real model responses. Without one, the CLI uses a deterministic Bootstrap provider for local testing.

## Install From This Checkout

```bash
cd personal-agent
npm install
cp .env.example .env
npm run build
npm link
```

Set `DEEPSEEK_API_KEY` in the ignored `.env` file, then verify the global command:

```bash
a-agent --help
```

Because `.env` is ignored by Git, each worktree needs its own copy. Chat prints the selected provider and model before the first reply so an accidental Bootstrap fallback is visible.

## Try It

Run one workspace task:

```bash
a-agent run "帮我总结当前目录"
```

Add one or more objective Success Checks when the outcome is machine-verifiable:

```bash
a-agent run --check '{"type":"report_contains","value":"package.json"}' "总结当前目录"
a-agent run --check '{"type":"file_exists","path":"summary.md"}' "创建 summary.md"
```

Select a Skill Pack explicitly when you know which guidance should be used:

```bash
a-agent run --skill docs-helper "总结当前目录"
a-agent run --skill user:docs-helper "总结当前目录"
a-agent run --skill configured:1:docs-helper "总结当前目录"
```

`--skill` is repeatable up to four times and also accepts a displayed skill directory or `SKILL.md` path. A plain name uses normal source precedence; a source-qualified selector can deliberately choose a shadowed variant.

Start a persistent terminal chat and enter `exit` or `quit` when finished:

```bash
a-agent chat
```

Inspect recent Task Runs:

```bash
a-agent history
```

Run a Skill Pack evaluation:

```bash
a-agent eval skill-pack <name-or-path>
```

Share Skill Packs from another checkout by adding its repository root or direct skills directory to the current workspace's `.personal-agent/config.json`:

```json
{
  "skillRoots": [
    "/path/to/agent-ability-checkout"
  ]
}
```

Discovery order is workspace, `~/.agents/skills`, package, then configured roots. Same-name variants, explicit selectors, optional versions, and loaded-guidance digests are recorded in Task Export. The selected `SKILL.md` body is loaded into model context, while the Skill audit event stores only its digest and byte count. External eval manifests run without copying the Skill Pack into the workspace.

Local Tools are registered through a provider-neutral typed registry. The same declared schemas validate model input, validate tool output, and generate the model-visible catalog; malformed calls become durable `tool_error` observations so the model and evaluator can see why execution did not occur.

Run the deterministic core-workflow regression suite without calling a remote model:

```bash
a-agent eval golden
```

Record an audited Owner verdict when artifact review disagrees with the deterministic evaluator:

```bash
a-agent eval override --verdict pass --reason "Owner verified the generated artifact."
a-agent eval override <run-id> --verdict partial --reason "One edge case remains unresolved."
```

## Main Commands

| Command | Purpose |
| --- | --- |
| `a-agent run [--learn] [--review] [--skill <selector>]... [--check '<json>']... "<task>"` | Run one task with optional Skill selection and objective Success Checks. |
| `a-agent start [--learn] [--review] [--skill <selector>]...` | Read multiple independent tasks using one explicit Skill selection. |
| `a-agent chat [--learn] [--review] [--skill <selector>]...` | Keep multiple Owner messages and one Skill selection in one chat Task Run. |
| `a-agent resume [--learn] [--review]` | Resume the latest active Task Run checkpoint. |
| `a-agent history` | List recent Task Runs and evaluation status. |
| `a-agent export [run-id]` | Export an inspectable Markdown run report. |
| `a-agent memory` | Read or update Project Memory. |
| `a-agent eval golden` | Run repeatable read, malformed-tool, write, chat, memory, resume, and Skill Pack fixtures. |
| `a-agent eval override [run-id] --verdict <verdict> --reason "<reason>"` | Record an audited Owner verdict without replacing deterministic evidence. |
| `a-agent eval skill-pack <name-or-path>` | Execute a Skill Pack eval manifest. |

## Runtime Artifacts

Every workspace gets an ignored `.personal-agent/` directory containing:

```text
.personal-agent/
  config.json
  memory.md
  evals/golden-task-runs/<eval-id>/
    report.md
    results.json
    workspaces/<case-id>/
  runs/<run-id>/
    run.json
    events.jsonl
    checkpoints/
    report.md
    evaluation.json
```

These files are intentionally inspectable. They are the source of truth for history, resume, export, and learning.
Evaluation V2 separates execution integrity from task correctness and records the artifact evidence used by each verdict.
Its deterministic `verdict` remains immutable; an Owner override changes `effectiveVerdict` and appends a reasoned record to `humanOverrides`.
The golden suite keeps each deterministic fixture in an isolated workspace and reports both the expected and actual verdict. A fixture passes only when those verdicts match; the chat fixture deliberately expects `partial` until chat gains an objective Success Check.

## Development Checks

```bash
npm test
npm run typecheck
npm run build
```

## Project Documents

- [Completed MVP plan](./PLAN.md)
- [Ordered post-MVP roadmap](./ROADMAP.md)
- [Unprioritized capability backlog](./TODO.md)
- [Bilingual learning knowledge base](./knowledge/README.md)

The core runtime remains first-party for now. Framework adoption is reconsidered only when durable graph orchestration, handoffs, or retrieval become the dominant source of complexity.
