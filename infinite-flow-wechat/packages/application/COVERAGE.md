# Application command coverage

This package translates serializable client intent into the copied core's immutable state
transitions. It is intentionally independent of DOM APIs, persistence, clocks, random sources,
and runtime session machinery. A runtime `GameSession` may attach its own `commandId`; validation
accepts serializable transport metadata while the application reducer only interprets the
documented command fields.

## Covered domain actions

- New save, hub recovery, tactical carry configuration, relic frame/archive-seed preparation,
  equipment hunts and memory hunts.
- Item/equipment purchase, equip, upgrade, attune, temper, pet purchase/upgrade/activation,
  method learning/rank/activation, bloodline unlock/rank/activation, companion
  recruit/rank/activation, task claims, and equipment commission start/recall.
- Versioned simplified entry for normal, hard, and inferno protocols, including an optional route
  contract. Every entry carries a persisted `hiddenTaskSeed`; inferno entry additionally carries a
  persisted `infernoMapSeed` and explicit tier. The reducer never asks core for a fallback seed.
- Grid-adjacent movement, current-node selection, traps, portals, reward nodes, events, field
  surveys, equipment offers, relic drafts, soul skills, and soul-recharge choices.
- Ordinary combat actions (including capture, weapon skill and tactical items), method technique,
  companion assist, bloodline surge, retreat, boss phase transitions, exit settlement, relic
  archive/skip, and return to hub.
- Shared chapter-law choices currently exposed by core: causal ledger, entropy heading, mirror
  phase, redaction clause, auction lot, genesis splice, broadcast relay, escort checkpoint,
  testimony verdict, combat-replay route, and panopticon route. Route-contract selection is part
  of `run/enter`.

The automated reducer test exercises the first chapter's major phases from entry through the
start encounter, trap, rewards, two-stage boss, exit, optional relic-archive gate, and hub return.
It injects selected player/monster HP and relic-candidate state to keep the reducer fixture
deterministic; it is not a natural balance route, an end-to-end `GameSession` trace, or Creator UI
evidence.

## Deliberately not mapped from Web `ViewAction`

The following are presentation or platform responsibilities, not game commands:

- Opening/closing panels and dialogs, tab/filter/search selection, disclosure state, scroll/focus
  restoration, keyboard/pointer activation guards, and disabled placeholder buttons.
- Protocol-modal draft edits (mode selection, route selection and tier increment/decrement) before
  confirmation. Cocos should keep this ephemeral UI state locally and dispatch one `run/enter`.
- Equipment-commission checkbox/material draft selection before the final start command.
- Hub directory/codex filters, first-route hint dismissal, restored-run notice dismissal, combat
  detail/history toggles, and character-sheet rendering controls.
- Save/export/clear/recovery operations, auto-save after action binding, save rejection UI, and
  the Web restart side effect that deletes durable storage. These belong to runtime storage and
  lifecycle ports. `game/new` only creates a new domain state.
- Audio, animation, toast, responsive layout, ARIA/focus management, asset loading, and all other
  browser composition in `main.ts`.

## Known domain gaps

- Internal automatic transitions such as monster retaliation, forced failure recovery, pursuit
  progression, loot rolling, law signals, and boss awakening remain core-owned effects of one
  public command; they are not separately dispatchable commands.
- There is no arbitrary state patch, debug/cheat, or direct "force failure" command.
- Legacy non-simplified entry is intentionally omitted. The command contract targets the WeChat
  v2 flow and therefore cannot request core's old implicit entry mode.
- Command validation guarantees a plain finite JSON shape and validates critical scalar fields,
  but catalog membership and resource affordability remain authoritative core validation. A core
  refusal is surfaced as `domain-rejected` with the original state retained.
