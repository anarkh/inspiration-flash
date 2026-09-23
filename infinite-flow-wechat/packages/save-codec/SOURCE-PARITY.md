# Web v1 source parity

Oracle commit: `2645f0232542684d27de1abc321bb26913320420`.

Authoritative sources:

- `infinite-flow/src/main.ts`
- `infinite-flow/docs/knowledge-base/02-domain-state-and-save.md`
- `infinite-flow/docs/knowledge-base/05-mini-game-migration-plan.md`
- `infinite-flow/docs/knowledge-base/06-migration-acceptance-checklist.md`

`src/web-v1-parity.ts` mechanically carries the save-only function block from
`main.ts` (`isRecord` through `discardInvalidSavedRun`) and reconnects it to the
platform-neutral core snapshot through `@infinite-flow/core` package/subpath
exports. `RawSavePayload` is imported and re-exported from the shared
`@infinite-flow/runtime` port contract. The extraction includes:

| Web implementation | Extracted behavior |
| --- | --- |
| `isSavedGameState` | Aggregate/catalog/progression validation |
| `isSavedDungeonRun` | Node, loot, protocol, snapshot and subsystem validation |
| `isSavedCombatState` | Encounter identity, combat counters/effects and snapshot validation |
| `sanitizeSaved*` chain | Relic, pressure, hunt, commission, companion, method, bloodline, memory, chapter and replay repair |
| `migrateSavedReplacedCombatEncounter` | `mimic_survivor → rogue_sentry` and `sweep_sentinel → phase_hunter_drone` |
| `normalizeSavedState` | New material defaults, starter slots, derived HP, run/combat normalization and inferno topology repair |
| `discardInvalidSavedRun` | Temporary loot rollback and safe hub recovery |
| `loadSavedState` recovery branches | Illegal inferno discard and zero-HP `resolveRunFailure` settlement |

Deliberate differences are narrow and observable:

1. Browser `localStorage` read/write/remove and rejected-backup functions are not
   copied. Raw is an input/output value and persistence is a host responsibility.
2. The exact sanitizer nesting is exposed as `sanitizeWebV1State`.
3. Normalization/recovery returns structured repairs and warnings instead of setting
   UI globals or immediately rewriting the source key.
4. Strict external byte decoding is new; Web localStorage supplied a JavaScript
   string and therefore had no byte-decoding boundary.
5. Future version rejection is explicit so the host cannot downgrade and overwrite
   an unknown envelope.

Any future change to Web `Saved*`, `sanitizeSaved*`, `isSaved*`,
`normalizeSavedState`, the encounter migration table, or recovery ordering requires
updating this table, fixtures, and the oracle commit together.
