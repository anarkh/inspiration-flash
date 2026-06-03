# Agent Bridge

Agent Bridge connects one AI coding agent to another so work produced by one agent can be inspected by a different agent.

## Language

**Producer Agent**:
The agent whose session is currently doing the work and whose hook starts a bridge run.
_Avoid_: Source agent, caller

**Consumer Agent**:
The agent that receives bridge context from a producer agent and returns an independent result.
_Avoid_: Reviewer, target agent

**Bridge Run**:
A single handoff from one producer agent event to one or more consumer agents.
_Avoid_: Review job, task

**Bounded Gate**:
A bridge run that can delay the producer agent only within a defined waiting window; after that window, the producer agent should be allowed to continue while the consumer agent remains observable.
_Avoid_: Hard block, infinite review

**Late Consumer Result**:
A consumer agent result that arrives after a bounded gate has already released the producer agent. It is recorded and shown in bridge status, but it does not automatically interrupt or resume the producer agent's current session.
_Avoid_: Recall, retroactive block

**Timed-Out Bridge Run**:
A bridge run whose bounded gate released the producer agent before all consumer agents returned. It is not considered a pass; it remains visible as an incomplete or late-resolving bridge run.
_Avoid_: Passed review, successful review

**Fail-Open Release**:
A producer release caused by bridge infrastructure being unavailable rather than by a consumer agent passing the work. It should be visible to the user as a skipped bridge check, not as a successful bridge run.
_Avoid_: Silent pass, successful review

**Fail-Fast Bridge Run**:
A bridge run with multiple consumer agents where the first in-window failing consumer result is enough to return control to the producer agent with that failure. Remaining consumer agents may still finish later as late consumer results.
_Avoid_: Full consensus review, wait-for-all review

**Producer Progress Hint**:
A concise message shown in the producer agent session to explain that a bridge run has started, which consumer agents are being contacted, and where to inspect details. It is not a live log stream.
_Avoid_: Verbose progress log, hidden background work

**Consumer Terminal Session**:
A tmux-backed terminal owned by one consumer agent run. It is the runtime surface for the consumer CLI and the source of truth for dashboard xterm attach/input.
_Avoid_: Log preview, fake terminal

**Stop Hook**:
A producer hook event that fires when the producer agent is finishing its turn and the work is ready to be checked as a whole.
_Avoid_: Completion hook

**PostToolUse Hook**:
A producer hook event that fires after an individual tool action while the producer agent's turn may still be in progress. In Agent Bridge language, this is partial-work observation, not a completion boundary.
_Avoid_: Edit hook, file hook

## Example Dialogue

Developer: "Codex should be the producer agent and Claude Code should be the consumer agent."

Domain expert: "So each Codex stop hook creates a bridge run, and Claude Code receives the context as the consumer agent."

Developer: "Should edits trigger the bridge too?"

Domain expert: "No. A PostToolUse hook sees partial work. Use the Stop Hook as the completion boundary."
