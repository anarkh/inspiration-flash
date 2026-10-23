# Infinite Flow platform-neutral core snapshot

This directory snapshots the runtime TypeScript domain, content, and rule modules from
`infinite-flow/src` at source commit
`2645f0232542684d27de1abc321bb26913320420` (2026-08-07).

## Snapshot scope

- Copied: 64 non-test runtime modules, including every `src/level-data/*.ts` module.
  `src/run-lantern.ts` is a snapshot-local addition (see below).
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

Completed encounters restore the player's HP to the final derived maximum after
victory, capture, successful escape, defeat, or retreat during combat. Damage
history, rewards, and defeat settlement remain intact; an unsuccessful escape
that leaves combat active does not heal. This recovery is independent of ordinary
healing modifiers and is an intentional rule change from the source web project.

Elite and boss encounters telegraph a `heavy-blow` intent on turns 2, 5, 8, ...
whenever no monster-specific intent applies: the counter deals 50% more, a guard keeps
only a quarter of it, and `performCombatAction(..., { timing: 'perfect' })` on that guard
halves the remainder and adds 1 focus. Ordinary encounters and every other turn keep the
source rules; the timing option is ignored wherever a perfect parry is impossible. This is
an intentional rule change from the source web project.

Weapons without a signature skill (the starter `training_blade` and eight others) no longer
leave full focus unusable: `getWeaponSkillStatus` falls back to the generic `charged_strike`
(蓄势斩), a physical hit for 1.8x the basic-attack formula that spends focus like any weapon
skill. Signature skills are unchanged. This is an intentional rule change from the source
web project.

Runs entered through the stage-2 flow on any chapter (standard or imprint protocol) carry
a `lanternState` from the new `src/run-lantern.ts`: 12 drops of lamp oil, one burnt per
`moveToNode` into a room the lamp has not lit yet (lit and cleared rooms are free), four more
when one of the chapter's four supply rooms is cleared, and two more lost on a pursuer contact.
Such runs meet a dormant pursuer even on a first clear. A lamp never holds more than its start plus every supply refill (28 drops);
a snapshot above that is malformed. The burn that empties the lamp sets `breachForced` on the run's pressure
state, which `getRunPressureStatus` reads as breach whatever the cleared count, and wakes a
dormant pursuer at once. A pursuer now also makes contact when the player walks into its
room, even on its resting step. `getRouteForecasts` previews every adjacent room (kind,
a three-step risk read from the basic-attack exchange or the trap roll, reward bonus, oil,
boss fusion, the pursuer's approach and the containment room) without changing state. It
reads bonus, fusion and risk from the state that very step would leave, through the same
move effects `moveToNode` applies (burnt drop, forced breach, woken or colliding pursuer). Runs without a
lamp (older saves and deep runs) keep the source movement rules. These are intentional
rule changes from the source web project.

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
