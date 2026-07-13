# Execution Logging

## What We Implemented

The CLI now prints a short console log every time the model provider returns an Agent Step.

Example shape:

```text
[agent] turn 1 plan - Inspect the workspace | steps: List files
[agent] turn 2 tool - list_files {}
[agent] turn 3 finish - Workspace summarized.
```

## How It Works Here

`runTask` receives an optional `logStep(message)` callback. After the provider returns and the step is validated with `parseAgentStep`, the runner formats the step as a compact line and calls `logStep`.

The CLI passes a callback that writes each line to `stderr`. This keeps progress logs visible in the terminal while leaving `stdout` available for command results such as `Completed Task Run ...`.

Learning Lens reuses this same callback when `--learn` is enabled, but it emits separate `[learn]` lines. Default execution logging stays focused on `[agent]` progress lines.

## Other Common Approaches

**Silent agent loop**:
Only write events to files. This keeps command output clean, but makes live runs feel opaque.

**Verbose structured JSON logs**:
Print every event as JSON. This is easy for machines to parse, but harder for a human to scan during learning.

**Trace UI**:
Render a live timeline in a web UI. This is friendlier for long-term use, but it is too heavy for the current CLI-first MVP.

## Why This Approach

The project is a learning agent. The Owner should be able to see the loop as it happens: plan, tool call, message, reflection, and finish. A small text log gives immediate feedback without adding a UI framework.

## Advantages

- Makes each model step visible during a run.
- Keeps the durable event log unchanged.
- Keeps command-result output separate from progress logs.
- The runner remains testable because logging is injected.

## Disadvantages

- Logs are concise and not a full debugger.
- Long reports can still make one line noisy.
- There is no log level or quiet mode yet.

## Evaluation

Current tests verify:

- `runTask` emits one log line for each model step when a logger is supplied.
- CLI `run` writes bootstrap plan and finish steps to `stderr`.
- CLI `run --learn` adds opt-in `[learn]` notes without changing default output.

Future evaluation should add:

- a quiet flag,
- multiline formatting for long reports,
- structured trace export,
- log entries for tool observations after execution.
