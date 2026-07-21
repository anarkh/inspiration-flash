# Task Conversation

## What We Implemented

The CLI now supports:

```text
a-agent start
a-agent chat [--learn] [--review]
```

`start` runs a minimal line-based Task Conversation. Each non-empty input line becomes one separate Task Run. The session exits when the Owner enters `exit` or `quit`, or when stdin closes.

`chat` runs a persistent chat-style Task Run. Multiple Owner messages are recorded inside the same run as `owner_message` events, and the Model Provider sees the visible conversation history before producing each reply.

## How It Works Here

`src/cli/index.ts` keeps both entries thin:

1. `runInteractiveTaskConversation()` opens a readline interface and prints `Task> ` on stderr.
2. Each line is trimmed.
3. Empty lines are ignored.
4. `exit` and `quit` end the session.
5. Non-empty task lines go to `runCliTask(task)`.
6. `runCliTask(task)` uses the configured provider, progress logging, and terminal confirmation gates already used by `run`.

The prompt writes to stderr so stdout remains easy to parse by scripts. The completed run message stays on stdout, matching the existing `run` command.

`chat` uses a separate runner entry, `runChatTask()`:

1. The first non-empty Owner message creates one Task Run with a `Chat conversation: ...` goal.
2. Every Owner line is appended to `events.jsonl` as `owner_message`.
3. `owner_message`, Agent Steps, tool observations, and recovery events are replayed to the provider as visible context.
4. A `message` step is printed as the conversational reply and then the CLI waits for the next Owner line.
5. A model `finish` is rejected in chat mode and becomes a visible recovery instruction; the provider must answer with `message` instead.
6. `exit`, `quit`, or closed stdin ends input. The runner then appends its own `finish`, writes the report and evaluation, and marks the run completed.

The CLI prints the selected provider and model before chat starts. This makes an accidental fallback visible, for example `[agent] provider bootstrap (deterministic-bootstrap)` versus `[agent] provider deepseek (deepseek-v4-flash)`.

The bootstrap provider returns a warning `message` for every Owner turn and never pretends to be a real conversational model. That keeps the loop testable without credentials while making it clear that `DEEPSEEK_API_KEY` is required for real answers.

Task Evaluation treats chat traces as complete when the visible events include Owner turns, model replies, and a finish report. This keeps chat evaluation from requiring a task-style plan before every conversational reply.

## Other Common Approaches

**Full REPL**:
Keep a process open and add commands for cancellation, history, context carry-over, and session configuration. This is more complete, but it would expand the CLI contract before the basic agent loop is stable.

**Chat-style UI**:
Use a web or terminal UI with persistent message bubbles. This can feel richer, but it would distract from the current CLI-first learning path.

**Framework conversation manager**:
Use a framework-provided conversation abstraction. This may reduce boilerplate later, but it would hide the file-backed Task Run flow we are trying to learn.

**Thread database**:
Store chat messages in SQLite or a hosted database and map each UI thread to a row set. That is stronger for search and pagination, but less transparent than append-only local files at this stage.

## Why This Approach

The project already has a tested Task Run loop. Reusing it keeps `start` as an input mode, not a second agent runtime. `chat` is separate because it has different semantics: several Owner messages belong to one run and must be visible to the provider together. Both paths still share reports, evaluations, checkpoints, confirmations, Skill Pack context, Project Memory injection, and Local Tool handling.

## Advantages

- Uses the same Task Run semantics as `run`.
- Keeps stdout script-friendly while showing prompts and progress on stderr.
- Works in tests with piped stdin, which keeps the interactive entrypoint reproducible.
- Supports repeated tasks without restarting the CLI.
- Avoids a duplicate loop that could drift from the main runner.
- Adds true persistent conversation without changing `run` or `start` semantics.
- Stores user turns as explicit `owner_message` events, so the durable trace is auditable.
- Lets scripts test chat with piped input such as `printf 'hello\nfollow-up\n' | a-agent chat`.
- Keeps model reply semantics separate from runtime lifecycle: models answer; the CLI ends the conversation.

## Disadvantages

- It is line-based; it does not yet support editing a multi-line task before submission.
- Its Clarification Gate handles only known vague phrases.
- It does not maintain separate session-level state across several tasks beyond normal Workspace State.
- A finished terminal chat cannot yet be reopened as a new process with its prior transcript attached.
- The terminal UI is minimal; it does not show rich message bubbles or command history.
- Very long chats will eventually need summarization or retrieval so provider prompts do not grow without bound.

## Evaluation

Current tests verify:

- `a-agent start` reads one task from stdin,
- `a-agent start` runs multiple tasks until `exit`,
- empty interactive lines are ignored and prompt again,
- ambiguous interactive tasks ask for one clarification line before running,
- `runChatTask()` keeps multiple Owner messages inside one Task Run,
- `a-agent chat` keeps multiple piped inputs in one persistent Task Run,
- `a-agent chat` records two `owner_message` events for two Owner inputs,
- chat rejects a provider-authored `finish`, records recovery, and obtains a `message`,
- provider and model identity are visible before the first reply,
- EOF finalizes the run and writes `evaluation.json`,
- it prints the interactive prompt,
- it emits normal agent progress logs,
- it creates a completed Task Run with the prompted goal,
- the generated report includes the prompted goal.

Future evaluation should add:

- EOF before any task behavior,
- EOF during a pending clarification,
- explicit `quit` behavior,
- broader ambiguous task fixtures,
- reopening a prior chat with additional Owner messages,
- long-chat summarization or retrieval behavior.
