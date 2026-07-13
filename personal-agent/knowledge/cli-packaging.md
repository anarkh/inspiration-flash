# CLI Packaging

## What We Implemented

The npm package is now named:

```text
@ranarkh/agent
```

The installed CLI command is now:

```text
a-agent
```

`package.json` and `package-lock.json` both expose the same package name and binary mapping:

```json
{
  "name": "@ranarkh/agent",
  "bin": {
    "a-agent": "dist/cli/index.js"
  }
}
```

## How It Works Here

`src/cli/index.ts` keeps the user-facing command name in one `cliCommandName` constant. Help output, history page hints, and CLI diagnostics use that constant, so future command-name changes are not spread across unrelated code.

The workspace state directory remains `.personal-agent/`. That directory stores run state and is intentionally separate from the package name and executable name. Keeping it stable avoids breaking existing local Task Runs.

## Other Common Approaches

**Rename everything**:
Change the package name, executable, state directory, docs, and project folder together. This is visually consistent, but it risks breaking existing workspace state and creates a larger migration.

**Keep old binary aliases**:
Expose both `personal-agent` and `a-agent`. This helps compatibility, but it weakens the command rename and leaves two public entrypoints to document.

**Command wrapper only**:
Keep the npm package name unchanged and add an `a-agent` wrapper. This is minimal, but package consumers would still install the old package identity.

## Why This Approach

The Owner asked for the package name and trigger command to change. Updating package metadata and user-facing CLI text satisfies that request while leaving durable workspace state untouched.

## Advantages

- The package identity is shorter: `@ranarkh/agent`.
- The command is shorter: `a-agent`.
- Help text, errors, and pagination hints now match the installed binary.
- Existing `.personal-agent/` workspaces remain readable.

## Disadvantages

- Old docs or shell history that call `personal-agent` need to be updated.
- There is no compatibility alias for the old binary.
- The project folder is still named `personal-agent/`, so package identity and repository folder are not identical.

## Evaluation

Current tests verify:

- `package.json` uses `@ranarkh/agent`,
- `package.json` exposes only the `a-agent` binary,
- CLI help prints `a-agent`,
- history pagination hints use `a-agent`.

Future evaluation should add:

- an install-style smoke test that runs the built `a-agent` binary from `dist/`,
- a migration note if the state directory ever changes.
