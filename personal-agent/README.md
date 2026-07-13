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

## Main Commands

| Command | Purpose |
| --- | --- |
| `a-agent run [--learn] [--review] "<task>"` | Run one workspace task. |
| `a-agent start [--learn] [--review]` | Read multiple independent tasks from the terminal. |
| `a-agent chat [--learn] [--review]` | Keep multiple Owner messages in one chat Task Run. |
| `a-agent resume [--learn] [--review]` | Resume the latest active Task Run checkpoint. |
| `a-agent history` | List recent Task Runs and evaluation status. |
| `a-agent export [run-id]` | Export an inspectable Markdown run report. |
| `a-agent memory` | Read or update Project Memory. |
| `a-agent eval skill-pack <name-or-path>` | Execute a Skill Pack eval manifest. |

## Runtime Artifacts

Every workspace gets an ignored `.personal-agent/` directory containing:

```text
.personal-agent/
  config.json
  memory.md
  runs/<run-id>/
    run.json
    events.jsonl
    checkpoints/
    report.md
    evaluation.json
```

These files are intentionally inspectable. They are the source of truth for history, resume, export, and learning.

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
