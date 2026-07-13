# Personal Agent MVP Plan

Status: completed MVP baseline. Ordered post-MVP work now lives in [ROADMAP.md](./ROADMAP.md); [TODO.md](./TODO.md) remains the unprioritized capability backlog.

## Goal

Build a CLI-first Personal Agent for one Owner to handle Workspace Tasks while learning agent concepts through visible planning, tool use, memory, checkpoints, reports, and evaluations.

## Assumptions

- The first version is a local TypeScript and Node.js CLI in `personal-agent/`.
- The core agent loop is first-party code, not LangChain, LangGraph, LlamaIndex, or OpenAI Agents SDK runtime code.
- The Model Provider is swappable, and DeepSeek is the default real provider for the first version.
- Workspace State is local to the active workspace.
- Skill Packs are discovered from `.agents/skills/` and used through Guided Skill Use.
- General networking and Complex Embedding Retrieval are deferred to `TODO.md`.

## Success Criteria

- The Owner can start a Task Conversation from the CLI.
- The Owner can start a persistent chat-style Task Run from the CLI.
- A non-simple Workspace Task creates or revises a Task Plan before execution.
- The Personal Agent can use the MVP Local Tools with permission checks.
- High-impact actions pass through Confirmation Gates.
- Ambiguous task boundaries pass through Clarification Gates.
- Each completed Task Run produces a Task Report and Task Evaluation.
- Task Runs can be inspected from local Workspace State.
- A stopped or interrupted Task Run can resume from a Checkpoint.
- Knowledge Base docs are updated when capabilities are added or changed.

## CLI Surface

- `a-agent start [--learn] [--review]`: enter an interactive Task Conversation.
- `a-agent chat [--learn] [--review]`: enter one persistent chat Task Run with repeated Owner messages.
- `a-agent run [--learn] [--review] "<task>"`: run one Workspace Task.
- `a-agent resume [--learn] [--review]`: continue from the latest Checkpoint.
- `a-agent memory`: view or edit Project Memory.
- `a-agent history`: list recent Task Runs.

## Workspace State

Default state directory:

```text
.personal-agent/
  config.json
  memory.md
  runs/
    latest
    <run-id>/
      run.json
      events.jsonl
      checkpoints/
        0001.json
      report.md
      evaluation.json
      export.md
```

`config.json` stores non-secret settings only. Model API keys stay in environment variables.
For local development, the CLI also loads `personal-agent/.env` with `dotenv`; that file is ignored by git and should hold secrets such as `DEEPSEEK_API_KEY`.

Default real provider environment:

- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL` defaults to `https://api.deepseek.com`
- `DEEPSEEK_MODEL` defaults to `deepseek-v4-flash`

## Agent Step Schema

The model is adapted into provider-neutral Agent Steps:

- `message`: speak to the Owner.
- `plan`: create or revise the Task Plan.
- `tool`: request a Local Tool call.
- `confirm`: request a Confirmation Gate.
- `reflect`: propose a Reflection Note.
- `finish`: produce the Task Report and end the Task Run.

Invalid or incomplete Agent Steps trigger bounded Recovery Attempts.

Chat mode also records `owner_message` events. These are not model-authored Agent Steps; they are visible Owner turns that the provider can read alongside plans, messages, tool observations, and recovery events. In chat interaction, model-authored `finish` is invalid because the CLI owns conversation lifetime.

## Local Tools

MVP tools:

- `read_file`
- `write_file`
- `list_files`
- `search_text`
- `run_command`

Permission rules:

- Read-only inspection may run without confirmation.
- File writes use proposed write, preview, Confirmation Gate, then write.
- Safe read commands can run directly.
- Workspace write commands require confirmation.
- Dangerous commands are rejected by default or require explicit second confirmation.

## Skill Pack Use

Discovery:

- Scan `.agents/skills/*/SKILL.md`.
- Use skill name, description, and keywords for first-pass matching.
- Do not use embeddings in the MVP.

Selection:

- The Owner may name a Skill Pack explicitly.
- The agent may recommend one based on task text.
- Multiple or risky matches trigger confirmation.

Execution:

- Skill Packs guide planning and tool choice.
- Declared scripts may run through Local Tools and normal permission rules.
- Skill Pack evals are development verification only, not normal Task Run flow.

## Task Run Loop

1. Receive Owner task or chat message.
2. Create or resume a Task Run.
3. Load Project Memory, relevant Skill Pack summaries, and current workspace context.
4. Determine Advisory Mode or Execution Mode.
5. Create a Success Check for non-simple tasks.
6. Ask a Clarification Gate if the task boundary or Success Check is unclear.
7. Ask the Model Provider for the next Agent Step.
8. Validate the Agent Step schema.
9. Execute the step:
   - message Owner
   - update Task Plan
   - run Local Tool
   - request Confirmation Gate
   - record Reflection Note
   - finish with Task Report
10. Record events and Checkpoints throughout the Task Run.
11. Run Task Evaluation after finish.
12. Offer Reflection Notes for Project Memory or Knowledge Base updates.

In `chat`, repeated Owner messages append to the same Task Run as `owner_message` events. A model `message` replies and waits for more Owner input. `exit`, `quit`, or closed stdin ends input, then the runner appends the final report step and evaluates the completed run. If a provider returns `finish` during an active chat turn, bounded recovery asks it to answer with `message` instead.

## Learning Lens

The CLI should include brief learning notes at useful moments:

- planning
- tool use
- observation
- confirmation
- checkpointing
- recovery
- evaluation

Learning Lens should be concise and should not obscure task execution.

## Task Evaluation

Every completed Task Run gets `evaluation.json`.

Minimum fields:

```json
{
  "verdict": "pass | partial | fail | blocked",
  "successCheck": "pass | fail | unavailable",
  "gateSafety": "pass | fail",
  "traceQuality": "pass | partial | fail",
  "reportQuality": "pass | partial | fail",
  "learningSignals": [],
  "followUps": []
}
```

The first implementation combines deterministic checks with optional model-assisted self-review through `--review`. The deterministic verdict remains authoritative. The Owner may override the verdict in a later workflow.

## Run Export

`export.md` summarizes:

- Owner goal
- mode
- Success Check
- final Task Plan
- Decision Trace
- Local Tools used
- Skill Packs used
- changed resources
- Task Report
- Task Evaluation
- unresolved questions

Run Export can be used for reflection or External Review through Agent Bridge.

## Implementation Milestones

### Milestone 1: Project Skeleton

- Create `personal-agent/package.json`.
- Add TypeScript config.
- Add CLI entrypoint.
- Add test runner.
- Add a minimal `a-agent --help` check.

Verification:

- `npm test`
- `npm run build`

### Milestone 2: Workspace State

- Create state directory helper.
- Read and write `.personal-agent/config.json`.
- Create default `.personal-agent/memory.md`.
- Create Task Run directories and event appenders.
- Write and read Checkpoints.

Verification:

- Unit tests for state paths, run creation, event append, and latest pointer.

### Milestone 3: Agent Step Types

- Define TypeScript types for Agent Steps.
- Add runtime validation for model output.
- Add Recovery Attempt behavior for invalid output.

Verification:

- Unit tests for valid steps, invalid steps, and repair limits.

### Milestone 4: Local Tools

- Implement `read_file`, `list_files`, `search_text`.
- Implement proposed `write_file`.
- Implement `run_command` with command permission classification.

Verification:

- Unit tests for tool outputs and permission classification.
- Integration test in a temp workspace.

### Milestone 5: Model Provider

- Define Model Provider interface.
- Implement DeepSeek as the default real provider using environment variable credentials.
- Keep OpenAI-compatible provider support as the reusable HTTP adapter.
- Keep provider-native details outside the agent loop.

Verification:

- Unit test a fake provider.
- Optional smoke test with real credentials when available.

### Milestone 6: Task Run Loop

- Implement `run "<task>"`.
- Support Task Plan creation.
- Support Confirmation Gate and Clarification Gate prompts.
- Record Decision Trace.
- Produce Task Report.

Verification:

- Fake-provider integration test for a read-only task.
- Fake-provider integration test for a confirmed write task.

### Milestone 7: Resume And History

- Implement `resume`.
- Implement `history`.
- Ensure Checkpoints restore enough state to continue.

Verification:

- Integration test that stops after a Checkpoint and resumes to finish.

### Milestone 8: Skill Pack Discovery

- Scan `.agents/skills/`.
- Parse `SKILL.md` frontmatter and description.
- Match explicit and recommended Skill Packs.
- Record Guided Skill Use in the Decision Trace.

Verification:

- Unit tests using fixture Skill Packs.
- Integration test that selects a named Skill Pack.

### Milestone 9: Memory And Reflection

- Implement `memory` command.
- Propose Reflection Notes after Task Report.
- Write to Project Memory only after confirmation.

Verification:

- Unit tests for Reflection Note acceptance and rejection.

### Milestone 10: Evaluation And Export

- Write `evaluation.json`.
- Generate `export.md`.
- Add deterministic evaluation checks.
- Add optional model-assisted self-review behind the Model Provider.

Verification:

- Integration test that completes a Task Run and verifies report, evaluation, and export files.

### Milestone 11: Persistent Chat

- Implement `a-agent chat`.
- Store repeated Owner turns as `owner_message` events inside one Task Run.
- Replay Owner turns to the Model Provider as visible context.
- Print selected provider and model before the first chat reply.
- Reserve chat completion for `exit`, `quit`, or closed stdin instead of model-authored `finish`.
- Generate the Task Report and Task Evaluation after chat input ends.

Verification:

- Runner test with two Owner messages in one run.
- CLI test with piped chat input and durable `owner_message` events.
- Recovery test for a provider-authored `finish` during chat.

## Non-Goals For MVP

- Multi-user accounts.
- Cloud sync.
- General browser or network tool.
- Complex Embedding Retrieval.
- Parallel Task Runs.
- Rich chat UI and active-chat resume.
- Strong Skill Pack plugin runtime.
- External services that require authentication, except the configured Model Provider.
