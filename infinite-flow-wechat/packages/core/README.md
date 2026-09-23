# Infinite Flow platform-neutral core snapshot

This directory snapshots the runtime TypeScript domain, content, and rule modules from
`infinite-flow/src` at source commit
`2645f0232542684d27de1abc321bb26913320420` (2026-08-07).

## Snapshot scope

- Copied: 64 non-test runtime modules, including every `src/level-data/*.ts` module.
- Excluded: `src/main.ts`, `src/balance-sim.ts`, `src/action-input-guard.ts`, every
  `src/**/*.test.ts`, and non-TypeScript browser assets such as `src/styles.css`.
- `action-input-guard.ts` is browser input policy and is imported only by `main.ts` and
  its own test in the source project.

Source-level relative imports are preserved. The emit build appends `.js` only in
`dist/` so the package is valid Node/Cocos ESM. Public subpaths used by downstream
workspaces are listed explicitly in `package.json`; Creator 3.8.8 does not resolve
the Node-style `"./*"` export pattern. `src/index.ts`, this README, `tsconfig.json`,
and the verification scripts are snapshot-local additions.

## Intentional core-only divergence

The copied `src/game.ts` does not call `Math.random()`. Callers entering a mode that
needs a generated seed must provide `DungeonEntryOptions.seedSource`; explicit
`hiddenTaskSeed` and `infernoMapSeed` values continue to take precedence. The source
web project is unchanged.

The two `Array.prototype.at()` reads in copied `src/dungeon-laws.ts` use equivalent
length-indexed access so the same rules compile against the WeChat/Cocos ES2020
library surface. This changes neither ordering nor fallback behavior.

The compiler configuration intentionally omits DOM libraries and ambient type
packages. From `infinite-flow-wechat/`, validate with its pinned workspace tools:

```sh
npm run build -w @infinite-flow/core
npm run typecheck -w @infinite-flow/core
npm test -w @infinite-flow/core
```
