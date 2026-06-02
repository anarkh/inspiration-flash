# Agent Bridge

Local bridge for connecting Codex, Claude Code, and Aiden agents.

It wires producer CLI hooks to a local service, sends task context to configured consumer agent CLIs, and returns the consumer agent output to the producer. The first version supports Codex, Claude Code, and Aiden.

## Quick Start

After publishing or installing globally:

```bash
npm install -g @ranarkh/agent-bridge
agent-bridge setup
```

From this repository:

```bash
cd agent-bridge
npm install
npm run build
node ./dist/cli/index.js setup
```

`setup` is interactive. It first asks which producer CLI should trigger bridge hooks, then asks which consumer agent CLI(s) each producer should call. Codex, Claude Code, and Aiden are selectable on both sides, and local CLI paths are auto-detected.

## Commands

```bash
agent-bridge setup
agent-bridge list
agent-bridge remove --producer codex --scope project
agent-bridge remove --all --scope both
agent-bridge hooks clear
agent-bridge start
agent-bridge status
agent-bridge dashboard
agent-bridge stop
agent-bridge run --file <payload.json>
```

Generated hooks call:

```bash
agent-bridge hook --producer codex --event stop
agent-bridge hook --producer aiden --event stop
```

`agent-bridge serve` is an internal foreground service entrypoint used by `agent-bridge start`.

## Project Layout

```text
src/
  agents/         per-agent adapters and the adapter registry
  cli/            interactive command entrypoints
  config/         persisted user configuration
  core/           shared constants and TypeScript contracts
  hooks/          producer hook config, payloads, response mapping
  integrations/   non-agent integrations such as git
  bridge/         bridge orchestration, prompts, result parsing
  dashboard/      local web console
  service/        local daemon and HTTP transport
  terminal/       tmux-backed consumer CLI sessions and xterm transport
  utils/          filesystem helpers
test/
  agents/
  hooks/
  integrations/
  bridge/
```

## Behavior

- `Stop` is the only hook configured by setup.
- `setup` configures explicit producer-to-consumer routes, so each hook has its own target agent list.
- `list` prints configured producer-to-consumer routes and the consumer CLI command each route calls.
- `status` shows service health, configured routes, active bridge runs, and recent consumer agent results.
- `dashboard` starts the local service if needed and opens a console with consumer agents, their CLI runs, and a WebSocket-connected xterm view.
- `remove` deletes one route or all Agent Bridge config, then clears the matching producer hooks in the selected scope.
- `hooks clear` removes only Agent Bridge managed hook commands for the selected producer and scope.
- Hook commands print a short progress hint to stderr so the producer session is not silent while the consumer agent is running.
- Stop hooks wait up to five minutes for consumer agents; timed-out consumers continue in the service process and late results are shown by `agent-bridge status`.
- Consumer CLIs run in real tmux-backed terminal sessions when `tmux` is available. The dashboard can attach to the session, stream terminal output, resize the pane, and send keyboard input back to the CLI. Set `AGENT_BRIDGE_TERMINAL_BACKEND=capture` to force the legacy pipe capture fallback.
- Passing bridge results let the producer finish.
- Failing bridge results are sent back so the producer can continue with the consumer agent feedback.
- `uncertain` bridge results default to continuing, because ambiguous agent output should be inspected.

## Storage

- Agent config: `~/.config/agent-bridge/config.json`
- Runtime state: `~/.local/state/agent-bridge/`
- Agent CLI terminal logs and tmux command state: `~/.local/state/agent-bridge/terminals/`
- Project Codex hooks: `.codex/hooks.json` and `.codex/config.toml`
- Project Claude Code hooks: `.claude/settings.local.json`
- Project Aiden hooks: `.aiden/settings.json`

## Aiden Notes

Aiden is detected as the `aiden` executable. With the tmux terminal backend, the consumer adapter starts Aiden in an interactive terminal and pastes the bridge request into that session:

```bash
aiden --permission-mode readOnly --model-reasoning-effort low --workspace <cwd> --add-dir <tmp>
```

When tmux is unavailable or `AGENT_BRIDGE_TERMINAL_BACKEND=capture` is set, it falls back to non-interactive print mode:

```bash
aiden --print --no-streaming --permission-mode readOnly --model-reasoning-effort low --workspace <cwd> --add-dir <tmp> --max-turns 2 <prompt>
```

The bridge writes large review context to a temporary file and points Aiden at that file, avoiding command-line length limits while keeping the repository untouched.

## Development

This project intentionally uses only Node built-ins. On Node 24+, tests can run directly from TypeScript:

```bash
node --run test
npm run build
```

## Publishing

```bash
npm login
npm publish --access public
```

The package is scoped as `@ranarkh/agent-bridge`, so the npm account must have publish access to the `ranarkh` organization.
