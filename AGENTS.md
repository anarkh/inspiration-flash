# Repository Instructions

## Repository Shape

- Default branch: `main`.
- Main publishable package: `agent-bridge/`, published as `@ranarkh/agent-bridge`.
- Other top-level apps, such as `game/` and `cyber-live-room/`, should be treated as separate project surfaces unless the user explicitly asks for cross-project work.
- Keep edits scoped to the requested package or app. Do not refactor sibling projects while working on Agent Bridge.

## Agent Bridge Development

- Work from `agent-bridge/` for package commands.
- Useful checks:
  - `npm test`
  - `npm run build`
  - `npm run typecheck`
- For focused dashboard changes, at minimum run `npm test -- --test-name-pattern dashboard`, plus `npm run build` and `npm run typecheck`.
- Prefer repo-built code when validating unreleased Agent Bridge changes. Do not assume the globally installed `agent-bridge` contains local fixes.
- Agent Bridge should prefer the same consumer CLI that the user's interactive terminal resolves, especially for CLIs such as `claude`, `codex`, and `aiden`.
- tmux-backed non-interactive CLI runs should feed prompt input through file-backed stdin rather than pasting into a live shell after the command starts.

## Dashboard Guidance

- The dashboard is an operational debugging surface, not a marketing page.
- Keep it dense, readable, and low-noise: prioritize service state, run status, CLI command/path, terminal logs, and failure evidence.
- Avoid adding frontend dependencies unless the existing single-file dashboard cannot reasonably support the requested behavior.
- Preserve the current HTTP and WebSocket API contracts unless the user explicitly asks for an API change.

## Release Discipline

- Every MR/PR created for this repository must include a package version bump.
- For Agent Bridge changes, bump both `agent-bridge/package.json` and `agent-bridge/package-lock.json`.
- The Agent Bridge publish workflow runs on pushes to `main` that touch `agent-bridge/**`.
- The workflow publishes only when the package version is not already present on npm. If the version was already published, the workflow intentionally skips `npm publish`.
- Use the next patch version for ordinary fixes and UI improvements unless the user requests a different semver level.

## GitHub and MR Notes

- Default MR/PR target is `main`.
- Do not claim a PR was created unless the GitHub API, connector, or `gh` command actually returns a PR URL.
- If GitHub auth blocks PR creation, push the branch and provide the user with the compare URL and a ready-to-use title/body.
