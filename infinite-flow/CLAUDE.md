# CLAUDE.md — Infinite Flow

Guidance for working inside `infinite-flow/`. This file is scoped to this
subproject; repo-wide rules live in `../AGENTS.md`.

## What this is

Standalone, browser-first TypeScript prototype of an original 无限流
("infinite-flow") survival dungeon game — the "主神空间 · 无限流原型". A
reincarnator prepares in a hub ("主神空间"), enters one of 19 tiered dungeons,
navigates a tactical node map under a per-chapter "field law", and carries
rewards/materials back into the next upgrade cycle.

- No backend, no accounts. All state is client-side.
- The top-level `../game/` Cocos project is a separate surface and is
  intentionally untouched by this prototype.
- Chinese is the product language (UI copy, dungeon/mechanic names, most
  design docs). Keep player-facing strings in Chinese.

## Commands

Run from `infinite-flow/`.

```bash
npm install
npm run dev            # Vite dev server on 127.0.0.1
npm test -- --run      # Vitest once (CI-style); omit --run for watch
npm run typecheck      # tsc --noEmit (strict)
npm run build          # tsc --noEmit && vite build
npm run assets:audit   # report art coverage vs catalogs (vite-node)
SMOKE_SUITE=genesis npm run smoke:ui   # headless UI smoke; suites below
```

`SMOKE_SUITE` values (see `scripts/smoke-ui.mjs`): `hub`, `deep`, `entropy`,
`mirror`, `redaction`, `auction`, `genesis`, `broadcast`, `shelter`, `verdict`,
`replay`, `panopticon`, `causal`, `companion`, `method`. It drives a real dev
server + page against save key `infinite-flow:save:v1`.

Default validation after a change: `npm test -- --run` + `npm run typecheck`.
For build/asset-affecting changes also run `npm run build` and, when touching a
dungeon covered by a smoke suite, the matching `SMOKE_SUITE=... npm run smoke:ui`.

## Architecture

Three layers, strictly separated:

1. **Pure logic core** — `src/game.ts` plus ~40 subsystem modules
   (`combat-*`, `equipment-*`, `run-*`, `dungeon-*`, `method-cultivation`,
   `bloodline-system`, `companion-system`, `pet-system`, `progression`,
   `task-system`, `route-contracts`, `tactical-loadout`, `shop-advice`, …).
   No DOM, no `window`, no `localStorage`. `game.ts` re-exports the subsystem
   surface and owns `GameState` and the state transitions (`createInitialState`,
   `enterDungeon`, `collectReward`, `buyEquipment`, …). All transitions are
   pure functions over `GameState`.
2. **UI + persistence shell** — `src/main.ts` (the only DOM-aware file, entry
   from `index.html` → `#app`). It renders from `GameState`, wires events, and
   handles `localStorage` save/load + migration. Save key
   `infinite-flow:save:v${STORAGE_VERSION}`, currently **v1**.
3. **Static data tables** — `src/level-data/*.ts` (one `DungeonDefinition`
   per chapter, 19 files) assembled by `src/level-content.ts`, which also holds
   `MONSTERS`. Items/equipment/methods/pets catalogs live in their subsystem
   modules and are re-exported through `game.ts`.

`src/balance-sim.ts` (largest file) is a headless simulator that drives the
same pure core API to check campaign/economy/combat balance — it is the reason
the core must stay DOM-free. Treat it as an executable spec: mechanic changes
usually need a matching balance-sim update.

Art: `src/game-assets.ts` is the authoritative manifest (stable keys like
`monster:fog_lesser_demon` → path/alt/dims/fit). Runtime files live in
`public/assets/`; generation atlases + prompts live in `art-source/`. UI must
consume manifest keys, never infer filenames from display names. Revisions are
immutable `-v1`; add `-v2` siblings and update the manifest rather than editing
in place.

## Conventions & invariants

- **TypeScript strict**, plus `noUnusedLocals`/`noUnusedParameters`. Keep the
  tree clean or the build fails. ESM only (`"type": "module"`,
  `allowImportingTsExtensions`, `.ts` in relative imports where used).
- **Test-per-module**: every `foo.ts` has a `foo.test.ts` beside it (Vitest,
  42 suites). Add/extend the sibling test when changing logic.
- **Pure core discipline**: never import DOM/`localStorage` into core modules.
  New mechanics go in a subsystem module, are re-exported via `game.ts`, get a
  sibling test, and (if they affect balance) are reflected in `balance-sim.ts`.
- **Entry snapshots freeze on `enterDungeon`.** Preparation (tactical loadout,
  relic frame/seed/conduits, soul skills, methods, bloodline, companions, pets,
  equipment/memory hunts) is captured into the run at entry; editing the hub
  mid-run must not retroactively change the active run.
- **Save-migration safety (v1)**: missing legacy inventory keys normalize to 0;
  corrupt/absent per-run snapshots are isolated — they disable only that feature
  for that run and are **never** rebuilt from current hub equipment/preparation,
  and must not reset the rest of the save. Follow the existing
  `normalizeSavedState` patterns; don't guess fields. When adding persisted
  state, decide the legacy-default and migration rule explicitly.
- **Versioned mechanic help**: `src/dungeon-feature-help.ts` is the single
  versioned source of truth (`summary`/`mechanic`/`guidance`/`readout` +
  keywords) for cross-client migration. When a rule changes, keep the old
  rule's context alongside the new one (see `equipmentHunt`) instead of
  deleting it, so future clients don't reverse-engineer stale rules from UI.
- **Exact catalog totals matter.** README asserts precise counts (19 chapters,
  56 mature equipment, 19 memories, 1064 memory combos, 57 route contracts, 63
  tasks / 5560 reward points, etc.). Adding/removing content shifts these —
  update the README and any count-based tests/smoke assertions together.

## Adding content

- **New dungeon/chapter**: add `src/level-data/<name>.ts` exporting a
  `DungeonDefinition`, register it in `level-content.ts`, extend `DungeonId`
  and `DUNGEON_ORDER` in `game.ts`, add monsters to `MONSTERS`, add assets to
  `game-assets.ts` (+ files under `public/assets/`), and add a sibling test.
- **New field law / per-chapter mechanic**: implement in its own subsystem
  module with a sibling test, freeze its entry snapshot in the run, render via
  `main.ts`, register help copy in `dungeon-feature-help.ts`, and add
  balance-sim coverage.
- **New item/equipment/method/pet**: extend the relevant catalog + its id
  union, wire assets, update tests and the README totals.

## Scope guardrails

Keep edits within `infinite-flow/`. Don't refactor sibling projects
(`../game/`, `../agent-bridge/`, `../cyber-live-room/`, …). No backend, no
account persistence, no engine migration. Prefer minimal, in-scope changes that
match existing style; comment only non-obvious mechanics or invariants.
