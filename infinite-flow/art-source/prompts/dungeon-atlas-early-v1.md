# Dungeon Atlas Early V1

- Grid: `2 x 5`, row-major. Every cell is an independent ultra-wide `4:1` environment banner.
- Style: original grounded dark fantasy plus restrained retro science fiction in the shared project palette.
- Exclude: characters, monsters, text, signs with readable writing, logos, borders, gutters, UI, and cross-cell motifs.

## Exact Order And Brief

1. `demon_tower_1`: colossal black-stone tower interior, ribbed pillars, suspended ritual furnace, teal floor fog, sealed stair.
2. `metro_abyss`: flooded rail platform, broken train reflected in black tidewater, warped mirror tunnel, red signal lamp.
3. `starfall_mine`: cavern around fallen star-metal, silver-blue ore, worn cranes and carts, deep black shaft.
4. `rust_hospital`: corroded field hospital, quarantine curtains, teal medical pulses, sealed treatment wing.
5. `ash_arena`: circular ruined arena, charred tiers, iron dueling ring, drifting ash and restrained embers.
6. `dream_archive`: impossible stacks, suspended blank pages, teal memory glass, one aged-gold reading lamp.
7. `void_citadel`: monumental black corridor opening onto a geometric void, cyan spatial seams, defensive pylons.
8. `temporal_observatory`: nested brass rings and dark lenses around a frozen star map, with no numerals.
9. `causal_clearinghouse`: opposing machine lines feeding a central balancing engine beneath verdict light.
10. `entropy_ark`: decaying ark command deck above a black entropy sea, broken navigation rings and dissolving structure.

Give every scene clear foreground, midground, and background depth. Preserve the exact order and readability at
`720 x 180`; the generated source may be wider and is center-cropped to the runtime ratio.

## V1 Crop Boundaries

The generated `1983 x 793` source has unequal rendered row heights. Use x boundaries `[0, 991, 1983]` and y
boundaries `[0, 194, 367, 535, 687, 793]`, then resize each extracted cell to `720 x 180` with centered `cover`.
