# Presentation coverage

`@infinite-flow/presentation` converts the application/core state into a detached, deeply
frozen JSON snapshot. It imports no Cocos, DOM, WeChat, storage, clock, or random API.

## Covered

- Hub, explore, combat, and result view models always use this order: objective, status,
  actions, risks/disabled reasons, help, logs.
- Each healthy phase exposes one core-validated visual asset key: the hub uses
  `scene:main_god_space`, explore/result use the active `dungeon:<id>`, and combat uses
  the encounter `monster:<id>`. Corrupt snapshots omit the key instead of inventing an asset.
- Hub entry is a single local `entry/request-enter` event. It deliberately contains no seed
  or command ID. The client owns seed generation and durable recording, then creates exactly
  one `run/enter` command with the explicit seed bundle. Route choice uses the stable local
  `entry/select-route-contract` event (`routeContractId: string | null`); the host removes the
  draft field on `null` and clears it whenever the dungeon changes.
- Hub presentation uses eight stable local panels (`entry`, `supplies`, `equipment`, `pets`,
  `methods`, `bloodlines`, `companions`, and `tasks`). Only panel navigation plus the current
  catalog entry's operations are projected, so the Cocos action deck does not flatten the
  entire game catalog into one pagination queue. Every non-entry panel has an explicit return
  to entry.
- Hub catalog panels use core names, descriptions, levels/ranks, quantities, active/equipped
  state, and task evaluations. The pure application reducer preflights every domain command;
  rejected commands expose the real reason with no event, while committed before/after state
  produces the displayed resource-cost delta. Unowned equipment is exchanged only through an
  unlocked chapter recipe selected by the core purchase-status selector: first payable, else
  first unlocked. The command always carries `sourceDungeonId`; there is no ordinary-price
  fallback. Source chapter, exact material cost, held count, and gap stay visible.
- Supplies supports item purchase, per-item tactical-loadout toggle without replacing other
  selections, recovery, current-loadout confirmation, and the verified three-item first-chapter
  shortcut. Equipment supports purchase/equip/upgrade/attune/temper plus the core-defined
  equipment-sealing commission. Its normalized local draft selects zero, one, or two distinct
  selector candidates and one selector-derived target material through a complete replacement
  event. Start and recall use reducer-preflighted commands; idle/draft/active detail exposes the
  exact 300 reward-point + 1 lingyun cost, held amount and gap, three-distinct-dungeon progress,
  remaining progress, and recall's no-refund loss. Pets, methods, bloodlines, and companions
  support their purchase/unlock/recruit, growth, and active-slot commands; tasks support claim.
  The focused equipment also exposes the core memory selector's supported/owned/equipped,
  unlocked, and active state. One stable cycle slot activates the next unlocked memory through
  reducer preflight, so even commission + memory + hub navigation remains below 20 actions;
  unlocked memories are never flattened into an action list.
  Entry retains the unique host-seeded confirmation boundary, dungeon/protocol/
  inferno selection, and relic frames. Its detail lists “no contract” plus the current chapter's
  three core route contracts with ordered targets, independent reward, selected state, and lock
  reason; a wrong-chapter draft fails closed. Relic detail lists only legal archived seeds in the
  selected frame and shows the core conduit-derived `2 → 3` candidate expansion. Seed choice uses
  `entry/select-relic-seed` with `frame` and `seedRelicId: RunRelicId | null`; the host converts
  that single local event to one `hub/configure-relic` command without consuming an entry seed.
- Exploration exposes current/adjacent/scouted/cleared/fogged map states with label, symbol,
  and pattern tokens. Fogged cells do not expose node identity or type. Only physically
  adjacent, domain-legal targets emit `run/move`. Modern flow-version-2 runs without a memory
  hunt project no invented task. A valid current or imported legacy hunt preserves the core
  display state, exact node/event IDs, two independent signals, frozen attunement, next target,
  and failure reason; malformed evidence is shown only as fail-closed diagnostic detail.
- Equipment offers, relic drafts, soul-recharge activation and resolution, dungeon events,
  field survey, ordinary node actions, exit seal, and retreat are mapped. Optional dungeon
  events preserve the current
  node's executable base/risk resolution and any context-valid node soul skill; the global
  retreat remains an explicit escape hatch. Exclusive pending choices continue to block
  ordinary node actions. Shared route gates use core legality selectors.
- Generic law choices cover causal ledger, entropy heading, mirror phase, redaction, auction,
  genesis splice, broadcast relay, escort, false-testimony verdict, combat-replay route, and
  panopticon route. The remaining chapter laws use their shared state/display/route APIs.
- Explore detail carries a read-only `chapterDecision` projection for every healthy run, never
  gated by a pending choice. It exposes the chapter law card (title, status, severity, optional
  meter, target flag, and encounter/trap/healing/outgoing/guard modifiers), the main-god
  directive (status, progress text, reward preview, and every optional objective with kind,
  completion, and progress text), ordered route-contract progress (0/2, 1/2, 2/2, secured,
  failed, and lost states with ordered targets, next target, potential and banked reward), run
  pressure (legacy flag, tier, percent, reward bonus, next-tier threshold), and the run pursuit
  (legacy flag, name, status, contact/fusion modifiers, reward, and progress including active
  node, contacts, grace moves, and clears remaining). All five cards are detached, deeply
  frozen JSON snapshots built only from the public core selectors; they add no commands or
  actions and never copy domain rules.
- Combat detail carries a read-only `chapterContext` projection for every healthy combat run.
  It exposes the chapter law (title, status, severity, optional meter, and the combat-relevant
  modifier percentages: enemy all-stats/defense/art-power, outgoing force/art, healing, and guard)
  and the run pursuit (name, status, contact-damage percent, and boss-fusion percent when present).
  Both cards are detached, deeply frozen JSON snapshots built only from the public core selectors
  (`getCurrentDungeonLaw`, `getCurrentRunPursuit`); they add no commands or actions and never copy
  domain rules. A dangerous law (severity `danger`) and a stalking/fused pursuit append risk items
  to the existing combat risks section. Corrupt law snapshots fail closed through the core
  normalizer to the chapter default law, never inventing titles or percentages. The Cocos combat
  status panel renders a compact law line plus a pursuit line (when active) beside the HP bars,
  intent, and boss readout; the full law/pursuit semantics stay in the existing help deck.
- Combat exposes both HP tracks, intent and consequence, recommendations, explicit high-risk
  reasons, damage previews, capture, weapon skill, every frozen method technique, companion
  assist, bloodline surge, combat-capable soul skills, ordinary escape, and whole-run retreat.
  A valid equipment-memory combat selector projects the active name, matching frozen equipment,
  and overflow-focus empty/stored/restored state. Imported combat without an entry snapshot and
  malformed snapshot/combat state are fail-closed and expose no active source or effect.
- Boss sealed/awakened stages have textual and symbolic state, not color-only state.
- Result maps a Chinese outcome readout (perfect/normal clear, retreat, failure-recovered),
  pending relic archive/skip, prevents return while pending, and exposes only
  `result/return-hub` after settlement. It never exposes a repeat exit-settlement action.
  The seven settlement cards (loot, equipment roll, protocol, directive, route contract,
  pressure, pursuit) are strict `valid | invalid` unions with stable card identity; corrupt
  evidence fails closed to a Chinese diagnostic instead of leaking raw tokens. See the
  deliberate-gaps entry for the full fail-closed contract and the four real-flow tests.
  Equipment-commission result detail preserves advanced/completed state, the newly completed
  dungeon, distinct-dungeon progress, sealed pair, target material, and the completed material
  x2 permanent-bag receipt. A normalized legacy memory-hunt settlement preserves exact
  granted/status/reason and its no-side-reward readout. Modern results use only the current
  chapter definition plus current memory-library state to say “chapter recorded/active” or
  “not recorded”; because core has no newly-unlocked marker, they never claim a new acquisition.
- All 23 core help IDs plus the presentation-local `equipmentCommission` help preserve `title`,
  `summary`, `mechanic`, `guidance`, `readout`, and `keywords`, with stable local open/close
  events. Commission help covers eligibility and sealing restrictions, cost, distinct successful
  exits, repeats/retreat/failure, recall loss, and permanent-bag completion. The core
  `equipmentMemory` ID is presentation-overridden with modern semantics: mature equipped gear
  auto-records the chapter memory after successful exit, the equipment panel switches recorded
  memories, modern entry has no hunt selection, and imported legacy dual-signal runs remain
  inspectable.

## Deliberate gaps

- Equipment-hunt preparation and legacy equipment-memory-hunt preparation remain deliberately
  hidden, matching the modern Web surface. Imported legacy hunt progress and settlement are
  compatibility projections, not a restored modern preparation entry point.
- `chapterDecision` projects law, directive, route-contract, pressure, and pursuit state for
  every healthy run. Pursuit animation, hidden-task panels, and specialized route diagrams
  remain future presentation work; only actionable shared law choices are projected as actions.
- Result projects a Chinese outcome readout (perfect/normal clear, retreat, or
  failure-recovered), currencies, relic archive state, equipment-commission settlement,
  equipment-memory state/legacy settlement, and seven strict settlement cards: loot
  (retained/lost), equipment roll, protocol, directive, route contract, pressure, and
  pursuit. Each card is a mutually exclusive `valid | invalid` union; the invalid variant
  carries only a stable `card` identity plus a Chinese diagnostic. Builders are
  fail-closed: NaN/Infinity, negatives, missing nested snapshots, unknown item/equipment/
  protocol/route/dungeon/material IDs, unknown status/reason enums, and count or semantic
  inconsistencies (e.g. a paid reward on an unrewarded contract, salvage points on a
  non-salvage roll, a pursuit reward outside a successful exit) all produce `invalid`
  rather than degrading to an "unknown X" valid card. Visible text uses catalog Chinese
  names and labels only; raw IDs/enums/status/reason tokens and the `outcome=…` domain
  string never reach the view model. Validation reuses core public APIs
  (`isEquipmentRoll`, `normalizeRunPressureState`, `normalizeRunPursuitState`,
  `normalizeRouteContractRunState`, `getRunProtocolDefinition`, `getRunPursuitDefinition`,
  `getRouteContractById`, `getDirectiveEvaluation`) and never re-derives settlement rules.
  The four real flows (normal exit, secured retreat after ≥3 non-exit clears, unsecured
  retreat after <3, and natural guard-loop death) are driven from `createInitialState`
  through serializable `reduceGameCommand` transitions with fixed seeds only in the
  `run/enter` payload; they assert the seven-card contract, the loot solidification
  differential (full retain / half retain / total loss), Chinese readouts, and no raw
  tokens. Dedicated malformed-clone and deterministic fuzz tests cover the invalid union
  for every card. Historical runs without a settlement snapshot omit that card; missing
  data is never invented. Result settlement paging and advanced layout remain future
  Cocos work.
- Cocos node construction, safe-area measurement, localization, animation, focus navigation,
  audio, and physical-input deduplication live outside this package. The client is the single
  command-submit boundary.

## Token contract

The design space is 750x1334 design pixels. Touch minimums are specified in physical
viewport pixels and mirrored as 85 design pixels at width 390 and 104 design pixels at width
320. Safe-area fallback insets are viewport pixels and must be converted with
`design-px = viewport-px * 750 / viewport-width`. Regular text targets contrast 4.5:1;
large text and non-text UI target 3:1. Every map/action state includes label and symbol/pattern
encoding in addition to color.
