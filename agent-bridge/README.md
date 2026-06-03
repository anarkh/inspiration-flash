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
agent-bridge send --to aiden --message "hello" --workspace /path/to/repo --session-id demo
agent-bridge send --to aiden --message "hello" --workspace /path/to/repo --session-id demo --raw-output
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
  agents/         adapter registry, shared CLI adapter helpers, and concrete CLI integrations
    clis/         Aiden, Codex, Claude Code, and future consumer CLI implementations
    shared/       reusable detection, process, parser, terminal-input, and adapter factory helpers
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
- `send` sends a direct validation message to one consumer CLI without installing hooks or configuring producer-to-consumer routes. It starts/reuses the local service and prints the `BridgeResponse` JSON to stdout, omitting `result.rawOutput` by default. Use `--raw-output` or `--full` when debugging terminal parser output.
- `remove` deletes one route or all Agent Bridge config, then clears the matching producer hooks in the selected scope.
- `hooks clear` removes only Agent Bridge managed hook commands for the selected producer and scope.
- Hook commands print a short progress hint to stderr so the producer session is not silent while the consumer agent is running.
- Stop hooks wait up to five minutes for consumer agents; timed-out consumers continue in the service process and late results are shown by `agent-bridge status`.
- Consumer CLIs run in real tmux-backed terminal sessions when `tmux` is available. Worker-mode agents reuse one CLI session per producer, workspace, producer session, and consumer agent, so repeated hooks continue the same terminal conversation. The dashboard can attach to the session, stream terminal output, resize the pane, and send keyboard input back to the CLI. Set `AGENT_BRIDGE_TERMINAL_BACKEND=capture` to force the legacy pipe capture fallback.
- Passing bridge results let the producer finish.
- Failing bridge results are sent back so the producer can continue with the consumer agent feedback.
- `uncertain` bridge results default to continuing, because ambiguous agent output should be inspected.

## Storage

- Agent config: `~/.config/agent-bridge/config.json`
- Runtime state: `~/.local/state/agent-bridge/`
- Agent CLI terminal logs, worker context files, and tmux command state: `~/.local/state/agent-bridge/terminals/`
- Project Codex hooks: `.codex/hooks.json` and `.codex/config.toml`
- Project Claude Code hooks: `.claude/settings.local.json`
- Project Aiden hooks: `.aiden/settings.json`

## Aiden Notes

Aiden is detected as the `aiden` executable. With the tmux terminal backend, the consumer adapter starts Aiden in an interactive worker terminal and sends an Agent Bridge XML message into that session. The worker is keyed by producer, hook workspace, producer session id, and the Aiden consumer, matching the current CLI conversation instead of creating a new process for every hook. The terminal is started in the hook workspace, and the Aiden adapter uses the same terminal-input path as Agent Bridge dashboard sessions:

```bash
aiden --permission-mode readOnly
```

When tmux is unavailable or `AGENT_BRIDGE_TERMINAL_BACKEND=capture` is set, it falls back to non-interactive print mode:

```bash
aiden --print --no-streaming --permission-mode readOnly --model-reasoning-effort low --workspace <cwd> --add-dir <context-dir> --max-turns 2 <prompt>
```

Interactive worker runs write the full bridge context directly into the Aiden terminal as `<user_message>`, `<sender>`, `<session_id>`, and `<agent_bridge_reminder>` blocks, then paste the whole block into the ready TUI and submit it after a short delay. Non-interactive fallback runs still write the review context to a temporary file and point Aiden at that file to avoid command-line length limits.

## Development

This project intentionally uses only Node built-ins. On Node 24+, tests can run directly from TypeScript:

```bash
node --run test
npm run build
```

## Publishing

Agent Bridge is published from GitHub Actions with npm trusted publishing (OIDC). The publish workflow runs on pushes to `main` that touch `agent-bridge/**`, then publishes the package from the `agent-bridge` directory when the current package version is not already on npm.

Before merging a release version, configure the package on npmjs.com:

- Provider: GitHub Actions
- Organization or user: `anarkh`
- Repository: `inspiration-flash`
- Workflow filename: `agent-bridge-publish.yml`
- Environment name: leave blank
- Allowed actions: `npm publish`

The workflow does not use `NPM_TOKEN`. It requires GitHub Actions OIDC permission (`id-token: write`) and npm CLI trusted publishing support. Version bumps still happen in `agent-bridge/package.json`; if the same version is already published, the workflow skips `npm publish`.

For first-time setup, npm may require the workflow file to already exist on the repository's default branch before the trusted publisher can be saved. If the first merge that adds this workflow runs before npm is configured, configure the trusted publisher afterward and rerun the failed `Publish Agent Bridge` workflow.

Manual fallback is still possible from a maintainer account:

```bash
npm login --registry https://registry.npmjs.org
npm publish --access public
```
