# Expand Dungeon Maps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand every `infinite-flow` dungeon to at least 30 reachable tactical nodes and add more encounter variety per layer.

**Architecture:** Keep `infinite-flow/src/level-content.ts` as the public export surface for `MONSTERS`, `DUNGEON_ORDER`, and `DUNGEONS`. Move each dungeon definition into its own `infinite-flow/src/level-data/<dungeon>.ts` file so one worker can own one layer without editing shared files. Reuse the existing `MonsterId` set for this pass, but vary monster, trap, reward, portal, and exit placements inside each expanded map.

**Tech Stack:** TypeScript, Vitest, Vite, existing `DungeonDefinition`/`DungeonNode` game types.

---

### Task 1: Red Test For 30-Node Dungeons

**Files:**
- Modify: `infinite-flow/src/level-content.test.ts`

- [x] **Step 1: Write the failing test**

Require each dungeon to have at least 30 nodes, a grid area of at least 30, at least 6 monster nodes, 5 trap nodes, 8 reward nodes, 2 portal nodes, and 1 exit node.

- [x] **Step 2: Run the test to verify it fails**

Run:

```bash
cd infinite-flow
npm test -- --run src/level-content.test.ts
```

Expected: FAIL because current dungeons have 5-7 nodes and 12 grid cells.

### Task 2: Per-Layer Content Files

**Files:**
- Create: `infinite-flow/src/level-data/demon-tower.ts`
- Create: `infinite-flow/src/level-data/metro-abyss.ts`
- Create: `infinite-flow/src/level-data/starfall-mine.ts`
- Create: `infinite-flow/src/level-data/rust-hospital.ts`
- Create: `infinite-flow/src/level-data/ash-arena.ts`
- Create: `infinite-flow/src/level-data/dream-archive.ts`
- Create: `infinite-flow/src/level-data/void-citadel.ts`
- Modify: `infinite-flow/src/level-content.ts`

- [ ] **Step 1: Dispatch one worker per dungeon file**

Each worker owns exactly one `level-data/*.ts` file and exports one `DungeonDefinition`.

- [ ] **Step 2: Integrate exports**

Import the seven dungeon definitions into `level-content.ts` and construct `DUNGEONS` from those constants. Keep `MONSTERS` and `DUNGEON_ORDER` public API unchanged.

### Task 3: Verification

**Files:**
- Test: `infinite-flow/src/level-content.test.ts`
- Test: `infinite-flow/src/game.test.ts`
- Test: `infinite-flow/scripts/smoke-ui.mjs`

- [ ] **Step 1: Run focused content tests**

```bash
cd infinite-flow
npm test -- --run src/level-content.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full unit suite**

```bash
cd infinite-flow
npm test -- --run
```

Expected: PASS.

- [ ] **Step 3: Run build and UI smoke**

```bash
cd infinite-flow
npm run build
npm run smoke:ui
```

Expected: both PASS, with the first dungeon route still playable through grid movement.
