# Infinite Flow Art Source

This folder preserves the production context behind runtime game art. Runtime UI files live under
`public/assets/`; uncropped generation atlases stay here so App and mini-program clients can rebuild
their own resolutions without reverse-engineering the Web DOM.

## Direction

- Original dark Chinese infinite-flow survival RPG; no franchise characters or supplied copyrighted references.
- Grounded dark fantasy plus restrained retro science fiction.
- Charcoal and neutral black base, oxidized cyan rim light, old-gold key light, restrained warning red.
- Realistic worn materials and crisp silhouettes. Avoid chibi, glossy gacha framing, purple gradients, text, logos,
  watermarks, bokeh, and decorative UI inside the artwork.
- Portraits use `2:3`; inventory icons use `4:5`; dungeon banners use `4:1`; the hub scene uses `16:9`.

## Generated Sources

Generated sources were created with the built-in ImageGen path. Runtime revisions are immutable
(`-v1`, `-v2`, and later); future replacements should create revision siblings and update
`src/game-assets.ts`.

| Source | Grid | Row-major content |
| --- | --- | --- |
| `generated/reincarnator-v1.png` | single | canonical reincarnator player |
| `generated/npc-atlas-v1.png` | 3 x 2 | pet keeper, supply trader, equipment quartermaster, forge smith, method master, Main God projection |
| `generated/pet-atlas-v1.png` | 3 x 2 | contract sprite, mist kitten, ash hound, mirror moth, starling drone, void whelp |
| `generated/monster-atlas-early-v1.png` | 4 x 3 | first twelve `MONSTERS` entries, from fog lesser demon through furnace judge |
| `generated/equipment-atlas-core-v1.png` | 5 x 4 | first twenty runtime equipment assets, from training blade through void lantern |
| `generated/item-atlas-core-v1.png` | 5 x 4 | first twenty runtime item assets, from healing pill through entropy crystal |
| `generated/item-atlas-late-v1.png` | 5 x 2 | cycle imprint, phase glass, redaction ink, legacy scrip, genesis serum; silence core, rescue badge, truth fragment, combat reel, observation shard |
| `generated/dungeon-atlas-early-v1.png` | 2 x 5 | demon tower 1 / metro abyss; starfall mine / rust hospital; ash arena / dream archive; void citadel / temporal observatory; causal clearinghouse / entropy ark |
| `generated/monster-atlas-mid-v1.png` | 4 x 3 | paper librarian through dissipation navigator in the order recorded by `prompts/monster-atlas-mid-v1.md` |
| `generated/equipment-atlas-mid-v1.png` | 5 x 4 | chronal edge through helix cleaver in the order recorded by `prompts/equipment-atlas-mid-v1.md` |
| `generated/monster-atlas-late-1-v1.png` | 4 x 3 | last helmsman through mutation guardian; see `prompts/monster-atlas-late-1-v1.md` |
| `generated/monster-atlas-late-2-v1.png` | 4 x 3 | primal curator through perjury hound; see `prompts/monster-atlas-late-2-v1.md` |
| `generated/monster-atlas-late-3-v1.png` | 3 x 3 | false testimony judge through all-sight warden; see `prompts/monster-atlas-late-3-v1.md` |
| `generated/equipment-atlas-late-v1.png` | 5 x 4 | symbiote cowl through blindline cutter; see `prompts/equipment-atlas-late-v1.md` |
| `generated/equipment-atlas-final-v1.png` | 3 x 1 | predictive visor, matte shell, inverse prism; see `prompts/equipment-atlas-final-v1.md` |

The Tier 12–19 `-v2` dungeon banners and the standalone modern/future equipment
and monster additions were generated independently on 2026-07-30. Their exact
briefs, crop intent, and runtime mappings are preserved in
`prompts/dungeon-banners-late-v2.md` and
`prompts/modern-future-content-v1.md`.

The complete generation briefs live in `art-source/prompts/`. They preserve exact cell order, visual intent, and
negative constraints instead of relying on the current Web layout as undocumented production memory.

## Reproduction Prompt

Use the direction above, then specify an exact regular grid, row-major subject list, one centered subject per cell,
consistent apparent scale, generous safe padding, near-black backdrop, no gutters or frames, and no overlap across
cells. Characters and monsters are hand-painted 2D concept art; equipment and items are hand-painted three-quarter
inventory icons. Keep every subject readable at its runtime size and prohibit text, labels, logos, and watermarks.

Crop atlases by normalized grid boundaries so non-divisible source dimensions do not drift: for column `c`, use
`round(c * sourceWidth / columns)` through `round((c + 1) * sourceWidth / columns)`, and apply the same rule to rows.
Inventory icons are resized with `contain` onto `#090b0d`; monster portraits use the same `contain` rule; dungeon
banners use centered `cover`. Current runtime targets are item/equipment `160 x 200`, monster `288 x 384`, and
dungeon `720 x 180`.

`dungeon-atlas-early-v1.png` is the documented exception: ImageGen rendered visibly unequal row heights. For its
`1983 x 793` source, use x boundaries `[0, 991, 1983]` and y boundaries `[0, 194, 367, 535, 687, 793]` before the
centered `cover` resize. Equal fifths mix adjacent environments and must not be used for this revision.

The canonical player prompt adds: adult East Asian reincarnator, practical black field coat over repaired light
armor, subtle talisman strips, worn utility belt, hand near a sheathed short blade, calm focused expression, waist-up
square framing, abstract obsidian Main God space backdrop.

## Runtime Contract

`src/game-assets.ts` is authoritative for stable keys, paths, alt text, dimensions, fit mode, provenance, and revision.
UI code consumes keys such as `monster:fog_lesser_demon`; it must not infer filenames from display names.
