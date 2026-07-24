# Linear Mainline Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `infinite-flow` tasks so the mainline is a single linear recommendation path, each dungeon chapter has side tasks, and dungeon unlocks depend on mainline task progress.

**Architecture:** Keep the task rules in `src/task-system.ts`; expose mainline/side-task evaluators and dungeon unlock helpers from there. Keep reward claiming in `game.ts` so it continues using the existing `applyReward` and log path. Keep `campaign-progress.ts` as a gate presenter, but feed it task-system unlock state from `game.ts` instead of allowing completion-only or high-power sequence breaks to open later dungeons.

**Tech Stack:** TypeScript, Vite, Vitest, existing CDP smoke script.

---

## File Structure

- Modify `infinite-flow/src/task-system.ts`: replace the flat milestone list with typed mainline and side task definitions, evaluators, and mainline unlock helpers.
- Modify `infinite-flow/src/task-system.test.ts`: cover linear mainline ordering, side task coverage for every dungeon, reward limits, completion, and claimed-state behavior.
- Modify `infinite-flow/src/campaign-progress.ts`: accept task-system unlock input and remove high-power sequence-break unlock as a normal gate path.
- Modify `infinite-flow/src/campaign-progress.test.ts`: prove later dungeons stay locked until the previous mainline task is claimed.
- Modify `infinite-flow/src/game.ts`: pass task unlock state into campaign gates; keep `claimTaskReward` generic over all task ids.
- Modify `infinite-flow/src/game.test.ts`: prove a completed dungeon alone does not unlock the next chapter until its mainline task is claimed.
- Modify `infinite-flow/src/main.ts`: render a distinct mainline recommendation section and chapter side-task groups.
- Modify `infinite-flow/src/styles.css`: style mainline and side-task sections without touching the character modal behavior.
- Modify `infinite-flow/scripts/smoke-ui.mjs`: verify mainline recommendation, side-task visibility, claim-to-unlock behavior, and old character-modal checks.

Do not modify top-level `game/`. Do not commit unless the user explicitly asks.

---

### Task 1: Task Model And Evaluation

**Files:**
- Modify: `infinite-flow/src/task-system.ts`
- Test: `infinite-flow/src/task-system.test.ts`

- [ ] **Step 1: Write failing tests for the new model**

Add tests that expect:

```ts
expect(taskSystem.MAINLINE_TASKS.map((task) => task.chapterDungeonId)).toEqual(DUNGEON_ORDER);
expect(taskSystem.MAINLINE_TASKS.every((task, index) => task.kind === 'mainline' && task.mainlineIndex === index)).toBe(true);
expect(taskSystem.SIDE_TASKS.every((task) => task.kind === 'side' && task.chapterDungeonId)).toBe(true);
for (const dungeonId of DUNGEON_ORDER) {
  expect(taskSystem.SIDE_TASKS.filter((task) => task.chapterDungeonId === dungeonId).length).toBeGreaterThanOrEqual(2);
}
```

Also assert initial evaluation:

```ts
const initial = createInitialState();
expect(taskSystem.getNextMainlineTaskEvaluation(initial)?.task.chapterDungeonId).toBe('demon_tower_1');
expect(taskSystem.getUnlockedDungeonIdsFromMainline(initial)).toEqual(['demon_tower_1']);
expect(taskSystem.evaluateVisibleSideTasks(initial).every((evaluation) => evaluation.task.chapterDungeonId === 'demon_tower_1')).toBe(true);
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
npm test -- --run src/task-system.test.ts
```

Expected: fail because `MAINLINE_TASKS`, `SIDE_TASKS`, `getNextMainlineTaskEvaluation`, `evaluateVisibleSideTasks`, and `getUnlockedDungeonIdsFromMainline` do not exist or still reflect the flat task model.

- [ ] **Step 3: Implement minimal model**

In `task-system.ts`, introduce:

```ts
export type MainGodTaskKind = 'mainline' | 'side';

export type MainGodTask = {
  id: string;
  kind: MainGodTaskKind;
  chapterDungeonId: DungeonId;
  mainlineIndex?: number;
  title: string;
  description: string;
  hint: string;
  reward: RewardBundle;
  isVisible?: (state: GameState) => boolean;
  isComplete: (state: GameState) => boolean;
  getProgressText: (state: GameState) => string;
};
```

Define one mainline task per dungeon:

```ts
export const MAINLINE_TASKS: MainGodTask[] = DUNGEON_ORDER.map((dungeonId, index) => ({
  id: `mainline_clear_${dungeonId}`,
  kind: 'mainline',
  chapterDungeonId: dungeonId,
  mainlineIndex: index,
  title: `${DUNGEONS[dungeonId].name}主线`,
  description: `完成${DUNGEONS[dungeonId].name}首通，并在主神空间确认章节推进。`,
  hint: `首通${DUNGEONS[dungeonId].name}。`,
  reward: { rewardPoints: 90 + index * 10, lingyun: index % 2 === 0 ? 1 : 0 },
  isComplete: (state) => state.completedDungeonIds.includes(dungeonId),
  getProgressText: (state) => (state.completedDungeonIds.includes(dungeonId) ? '1/1 首通完成' : '0/1 尚未首通')
}));
```

Define at least two side tasks per dungeon:

```ts
export const SIDE_TASKS: MainGodTask[] = DUNGEON_ORDER.flatMap((dungeonId) => [
  {
    id: `side_enter_${dungeonId}`,
    kind: 'side',
    chapterDungeonId: dungeonId,
    title: `${DUNGEONS[dungeonId].name}侦察`,
    description: `记录${DUNGEONS[dungeonId].name}的入口情报。`,
    hint: `进入或首通${DUNGEONS[dungeonId].name}。`,
    reward: { rewardPoints: 45 },
    isComplete: (state) => state.run?.dungeonId === dungeonId || state.completedDungeonIds.includes(dungeonId),
    getProgressText: (state) => (state.run?.dungeonId === dungeonId || state.completedDungeonIds.includes(dungeonId) ? '1/1 已进入' : '0/1 尚未进入')
  },
  {
    id: `side_directive_${dungeonId}`,
    kind: 'side',
    chapterDungeonId: dungeonId,
    title: `${DUNGEONS[dungeonId].name}支线指令`,
    description: `完成本章主神指令的额外目标。`,
    hint: `首通时完成${DUNGEONS[dungeonId].name}的主神指令。`,
    reward: { rewardPoints: 70 },
    isComplete: (state) => state.claimedDirectiveIds.includes(`directive_${dungeonId}`),
    getProgressText: (state) => (state.claimedDirectiveIds.includes(`directive_${dungeonId}`) ? '1/1 指令完成' : '0/1 指令未完成')
  }
]);
```

Export `MAIN_GOD_TASKS = [...MAINLINE_TASKS, ...SIDE_TASKS]`, `getNextMainlineTaskEvaluation`, `evaluateVisibleSideTasks`, `getUnlockedDungeonIdsFromMainline`, and `getMainlineRequirementText`.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
npm test -- --run src/task-system.test.ts
```

Expected: tests pass.

---

### Task 2: Campaign Gates Depend On Mainline Progress

**Files:**
- Modify: `infinite-flow/src/campaign-progress.ts`
- Modify: `infinite-flow/src/game.ts`
- Test: `infinite-flow/src/campaign-progress.test.ts`
- Test: `infinite-flow/src/game.test.ts`

- [ ] **Step 1: Write failing gate tests**

In `campaign-progress.test.ts`, replace the high-power sequence-break expectation with:

```ts
it('does not unlock later dungeons from power alone when mainline progress is missing', () => {
  const progress = getCampaignProgress({
    completedDungeonIds: [],
    playerPower: 999,
    unlockedDungeonIds: ['demon_tower_1'],
    mainlineRequirementText: { metro_abyss: '需要先推进主线任务「妖塔一层主线」' }
  });

  expect(progress[1]).toMatchObject({
    dungeonId: 'metro_abyss',
    status: 'locked',
    isNextRecommended: false
  });
  expect(progress[1].requirementText).toContain('主线任务');
});
```

In `game.test.ts`, add:

```ts
it('unlocks the next dungeon only after claiming the previous mainline task', () => {
  const initial = createInitialState();
  const cleared = returnToHub(resolveExit(selectNode(enterDungeon(initial, 'demon_tower_1'), 'tower_exit')));
  const beforeClaim = getCampaignGates(cleared).find((gate) => gate.dungeonId === 'metro_abyss');
  const afterClaim = getCampaignGates(claimTaskReward(cleared, 'mainline_clear_demon_tower_1')).find((gate) => gate.dungeonId === 'metro_abyss');

  expect(beforeClaim?.status).toBe('locked');
  expect(beforeClaim?.requirementText).toContain('主线任务');
  expect(afterClaim?.status).toBe('available');
  expect(afterClaim?.isNextRecommended).toBe(true);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
npm test -- --run src/campaign-progress.test.ts src/game.test.ts
```

Expected: fail because current gates still use completion and power sequence-break rules.

- [ ] **Step 3: Implement gate input**

Extend `CampaignProgressInput`:

```ts
unlockedDungeonIds?: DungeonId[];
mainlineRequirementText?: Partial<Record<DungeonId, string>>;
```

In `getCampaignProgress`, treat a dungeon as normally available only when it is in `unlockedDungeonIds` or it is already completed. Remove sequence-break availability from normal status calculation. Use `mainlineRequirementText[dungeonId]` when locked by mainline.

In `game.ts`, import and use:

```ts
getMainlineRequirementText,
getUnlockedDungeonIdsFromMainline
```

Pass them into `getCampaignProgress` from `getCampaignGates(state)`.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
npm test -- --run src/campaign-progress.test.ts src/game.test.ts
```

Expected: tests pass.

---

### Task 3: UI Shows One Mainline Recommendation Plus Chapter Side Tasks

**Files:**
- Modify: `infinite-flow/src/main.ts`
- Modify: `infinite-flow/src/styles.css`
- Modify: `infinite-flow/scripts/smoke-ui.mjs`

- [ ] **Step 1: Write failing smoke assertions**

Update first-screen smoke expectations to require:

```js
document.querySelector('.mainline-task-panel')?.textContent.includes('主线任务') &&
document.querySelector('.mainline-task-panel')?.textContent.includes('妖塔一层') &&
document.querySelector('.chapter-side-task-panel')?.textContent.includes('章节支线') &&
document.querySelectorAll('.side-task-card').length >= 2
```

Update the first-clear smoke path to assert that after clearing `demon_tower_1` but before claiming `mainline_clear_demon_tower_1`, `metro_abyss` still renders locked; after claiming that mainline task, it becomes the next recommended available chapter.

- [ ] **Step 2: Run smoke and verify RED**

Run:

```bash
npm run smoke:ui
```

Expected: fail because the current UI has only the flat `.main-god-task-panel` and unlocks on completion.

- [ ] **Step 3: Implement UI split**

Replace `renderMainGodTasks` with two renderers:

```ts
function renderMainlineTask(actions: ViewAction[]): string
function renderChapterSideTasks(actions: ViewAction[]): string
```

Use `getNextMainlineTaskEvaluation(state)` for the mainline panel and `evaluateVisibleSideTasks(state)` grouped by `chapterDungeonId` for side tasks. Use the same `claimTaskReward` action path for both mainline and side tasks.

- [ ] **Step 4: Style without disturbing character modal**

Add styles for `.mainline-task-panel`, `.chapter-side-task-panel`, `.side-task-card`, and status variants. Do not remove or weaken existing `.character-modal`, `.character-sheet`, `.character-trigger`, `body.modal-open`, or smoke-covered modal behavior.

- [ ] **Step 5: Run smoke and verify GREEN**

Run:

```bash
npm run smoke:ui
```

Expected: smoke passes and includes logs for mainline panel, side-task panel, and claim-to-unlock behavior.

---

### Task 4: Final Verification

**Files:**
- All changed files under `infinite-flow/`

- [ ] **Step 1: Run focused task and gate tests**

```bash
npm test -- --run src/task-system.test.ts src/campaign-progress.test.ts src/game.test.ts
```

Expected: pass.

- [ ] **Step 2: Run all tests**

```bash
npm test -- --run
```

Expected: pass.

- [ ] **Step 3: Run typecheck and build**

```bash
npm run typecheck
npm run build
```

Expected: both pass.

- [ ] **Step 4: Run UI smoke**

```bash
npm run smoke:ui
```

Expected: pass.

- [ ] **Step 5: Scope check**

From repository root:

```bash
git diff --name-only -- game
git status --short infinite-flow docs/superpowers/plans
```

Expected: no `game/` diff; changes limited to the plan and `infinite-flow/` task/gate/UI/test files.

---

## Self-Review

- Spec coverage: mainline linear recommendation is Task 1 and Task 3; per-chapter side tasks are Task 1 and Task 3; dungeon unlock depending on mainline progress is Task 2; verification is Task 4.
- Placeholder scan: no TBD/TODO/fill-later items.
- Type consistency: `MainGodTask.kind`, `chapterDungeonId`, `mainlineIndex`, `MAINLINE_TASKS`, `SIDE_TASKS`, `getNextMainlineTaskEvaluation`, `evaluateVisibleSideTasks`, `getUnlockedDungeonIdsFromMainline`, and `getMainlineRequirementText` are introduced in Task 1 and reused consistently later.
