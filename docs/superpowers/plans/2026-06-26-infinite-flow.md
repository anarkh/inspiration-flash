# Infinite Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new standalone `infinite-flow/` browser prototype where main-god-space upgrades unlock better outcomes in the next dungeon run.

**Architecture:** Create a new top-level Vite + TypeScript app. Keep game rules in a pure `src/game.ts` model with Vitest coverage, and keep DOM rendering in `src/main.ts` so UI work cannot corrupt the core loop. The existing `game/` Cocos project is not touched.

**Tech Stack:** TypeScript, Vite, Vitest, browser DOM, CSS.

---

## File Structure

- Create `infinite-flow/package.json`: app scripts and dev dependencies.
- Create `infinite-flow/tsconfig.json`: strict TypeScript config.
- Create `infinite-flow/index.html`: Vite entry shell.
- Create `infinite-flow/src/game.ts`: pure game state, actions, choices, and outcomes.
- Create `infinite-flow/src/game.test.ts`: Vitest tests for the core loop.
- Create `infinite-flow/src/main.ts`: DOM renderer and click handlers.
- Create `infinite-flow/src/styles.css`: vertical mobile UI styling.
- Create `infinite-flow/README.md`: how to run and what the slice proves.

## Task 1: Scaffold The Standalone App

**Files:**
- Create: `infinite-flow/package.json`
- Create: `infinite-flow/tsconfig.json`
- Create: `infinite-flow/index.html`
- Create: `infinite-flow/src/`

- [ ] **Step 1: Create the project directories**

Run:

```bash
mkdir -p infinite-flow/src
```

Expected: `infinite-flow/src` exists and `game/` is unchanged.

- [ ] **Step 2: Create `infinite-flow/package.json`**

Write:

```json
{
  "name": "infinite-flow",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc --noEmit && vite build",
    "typecheck": "tsc --noEmit",
    "test": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.8.3",
    "vite": "^5.4.0",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 3: Create `infinite-flow/tsconfig.json`**

Write:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create `infinite-flow/index.html`**

Write:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>主神空间 · 无限流原型</title>
  </head>
  <body>
    <main id="app"></main>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Install dependencies**

Run:

```bash
cd infinite-flow && npm install
```

Expected: `package-lock.json` is created and install exits successfully.

- [ ] **Step 6: Commit scaffold**

Run:

```bash
git add infinite-flow/package.json infinite-flow/package-lock.json infinite-flow/tsconfig.json infinite-flow/index.html
git commit -m "feat: scaffold infinite flow prototype"
```

Expected: one commit containing only the new standalone project scaffold.

## Task 2: Build The Core Game Model With Tests

**Files:**
- Create: `infinite-flow/src/game.test.ts`
- Create: `infinite-flow/src/game.ts`

- [ ] **Step 1: Write the failing model tests**

Create `infinite-flow/src/game.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buyItem,
  createInitialState,
  enterDungeon,
  getAvailableDungeonChoices,
  learnMethod,
  returnToHub,
  resolveDungeonChoice
} from './game';

describe('infinite-flow core loop', () => {
  it('starts in the main-god space with enough points to make a meaningful first purchase', () => {
    const state = createInitialState();

    expect(state.phase).toBe('hub');
    expect(state.rewardPoints).toBe(850);
    expect(state.inventory).toEqual([]);
    expect(state.learnedMethods).toEqual([]);
    expect(state.log[0]).toContain('白光');
  });

  it('hides upgrade-gated dungeon options before the player buys or learns the requirement', () => {
    const state = enterDungeon(createInitialState(), 'demon_tower_1');

    expect(getAvailableDungeonChoices(state).map((choice) => choice.id)).toEqual(['force_through']);
  });

  it('lets a failed first run return to the hub, buy a talisman, and unlock a better branch', () => {
    const failedRun = resolveDungeonChoice(
      enterDungeon(createInitialState(), 'demon_tower_1'),
      'force_through'
    );

    expect(failedRun.phase).toBe('result');
    expect(failedRun.lastOutcome?.tone).toBe('failure');
    expect(failedRun.lastOutcome?.rewardPointsDelta).toBe(80);

    const upgraded = buyItem(returnToHub(failedRun), 'thunder_talisman');
    const secondRun = enterDungeon(upgraded, 'demon_tower_1');

    expect(getAvailableDungeonChoices(secondRun).map((choice) => choice.id)).toEqual([
      'force_through',
      'use_thunder_talisman'
    ]);

    const cleared = resolveDungeonChoice(secondRun, 'use_thunder_talisman');

    expect(cleared.phase).toBe('result');
    expect(cleared.lastOutcome?.tone).toBe('success');
    expect(cleared.inventory).toContain('demon_bone');
    expect(cleared.rewardPoints).toBe(730);
  });

  it('lets a learned cultivation method reveal a hidden option without consuming an item', () => {
    const trained = learnMethod(createInitialState(), 'breathing_method');
    const run = enterDungeon(trained, 'demon_tower_1');

    expect(getAvailableDungeonChoices(run).map((choice) => choice.id)).toEqual([
      'force_through',
      'steady_breathing'
    ]);

    const cleared = resolveDungeonChoice(run, 'steady_breathing');

    expect(cleared.lastOutcome?.tone).toBe('discovery');
    expect(cleared.learnedMethods).toContain('breathing_method');
    expect(cleared.inventory).toContain('hidden_stone');
  });
});
```

- [ ] **Step 2: Run tests and verify they fail because implementation is missing**

Run:

```bash
cd infinite-flow && npm test -- --run
```

Expected: FAIL with an import error for `./game`.

- [ ] **Step 3: Implement the minimal core model**

Create `infinite-flow/src/game.ts`:

```ts
export type Phase = 'hub' | 'dungeon' | 'result';
export type DungeonId = 'demon_tower_1';
export type ItemId = 'thunder_talisman' | 'healing_pill' | 'demon_bone' | 'hidden_stone';
export type MethodId = 'breathing_method';
export type EquipmentId = 'armor_piercing_sword';
export type OutcomeTone = 'failure' | 'success' | 'discovery';

export type PlayerStats = {
  body: number;
  spirit: number;
  luck: number;
};

export type DungeonChoice = {
  id: 'force_through' | 'use_thunder_talisman' | 'steady_breathing';
  label: string;
  requirement?: string;
  preview: string;
};

export type Outcome = {
  title: string;
  body: string;
  tone: OutcomeTone;
  rewardPointsDelta: number;
};

export type GameState = {
  phase: Phase;
  rewardPoints: number;
  essence: number;
  inventory: ItemId[];
  learnedMethods: MethodId[];
  equipment: EquipmentId[];
  stats: PlayerStats;
  currentDungeon?: DungeonId;
  lastOutcome?: Outcome;
  log: string[];
};

const ITEM_COSTS: Record<Extract<ItemId, 'thunder_talisman' | 'healing_pill'>, number> = {
  thunder_talisman: 400,
  healing_pill: 180
};

const METHOD_COSTS: Record<MethodId, number> = {
  breathing_method: 300
};

function appendLog(state: GameState, line: string): GameState {
  return {
    ...state,
    log: [line, ...state.log].slice(0, 8)
  };
}

function hasItem(state: GameState, item: ItemId): boolean {
  return state.inventory.includes(item);
}

function hasMethod(state: GameState, method: MethodId): boolean {
  return state.learnedMethods.includes(method);
}

export function createInitialState(): GameState {
  return {
    phase: 'hub',
    rewardPoints: 850,
    essence: 0,
    inventory: [],
    learnedMethods: [],
    equipment: [],
    stats: {
      body: 3,
      spirit: 2,
      luck: 1
    },
    log: ['白光散去，你站在主神空间。主神提示：下一场试炼将在三分钟后开启。']
  };
}

export function buyItem(state: GameState, item: Extract<ItemId, 'thunder_talisman' | 'healing_pill'>): GameState {
  const cost = ITEM_COSTS[item];

  if (state.rewardPoints < cost) {
    return appendLog(state, `奖励点不足，无法兑换${item === 'thunder_talisman' ? '雷火符' : '止血丹'}。`);
  }

  const itemLabel = item === 'thunder_talisman' ? '雷火符' : '止血丹';

  return appendLog(
    {
      ...state,
      rewardPoints: state.rewardPoints - cost,
      inventory: [...state.inventory, item]
    },
    `主神扣除 ${cost} 点，${itemLabel}落入你的掌心。`
  );
}

export function learnMethod(state: GameState, method: MethodId): GameState {
  if (hasMethod(state, method)) {
    return appendLog(state, '你已经学会吐纳诀，重复学习没有收益。');
  }

  const cost = METHOD_COSTS[method];

  if (state.rewardPoints < cost) {
    return appendLog(state, '奖励点不足，无法学习吐纳诀。');
  }

  return appendLog(
    {
      ...state,
      rewardPoints: state.rewardPoints - cost,
      learnedMethods: [...state.learnedMethods, method],
      stats: {
        ...state.stats,
        spirit: state.stats.spirit + 1
      }
    },
    '吐纳诀灌入识海。你终于能在妖雾里稳住心神。'
  );
}

export function enterDungeon(state: GameState, dungeon: DungeonId): GameState {
  return appendLog(
    {
      ...state,
      phase: 'dungeon',
      currentDungeon: dungeon,
      lastOutcome: undefined
    },
    '副本开启：妖塔一层。雾中传来刮骨般的低笑。'
  );
}

export function getAvailableDungeonChoices(state: GameState): DungeonChoice[] {
  const choices: DungeonChoice[] = [
    {
      id: 'force_through',
      label: '硬闯妖雾',
      preview: '无需求。高风险，可能只能带伤撤离。'
    }
  ];

  if (hasItem(state, 'thunder_talisman')) {
    choices.push({
      id: 'use_thunder_talisman',
      label: '使用雷火符破雾',
      requirement: '需要雷火符',
      preview: '消耗雷火符，安全破开妖雾并取得妖骨。'
    });
  }

  if (hasMethod(state, 'breathing_method')) {
    choices.push({
      id: 'steady_breathing',
      label: '运转吐纳诀稳住心神',
      requirement: '需要吐纳诀',
      preview: '不消耗道具，发现雾后的隐藏石门。'
    });
  }

  return choices;
}

export function resolveDungeonChoice(state: GameState, choiceId: DungeonChoice['id']): GameState {
  if (state.phase !== 'dungeon') {
    return appendLog(state, '你还没有进入副本。');
  }

  if (choiceId === 'use_thunder_talisman' && !hasItem(state, 'thunder_talisman')) {
    return appendLog(state, '你没有雷火符，无法选择这条路线。');
  }

  if (choiceId === 'steady_breathing' && !hasMethod(state, 'breathing_method')) {
    return appendLog(state, '你还没学会吐纳诀，无法在妖雾里稳住心神。');
  }

  if (choiceId === 'force_through') {
    const outcome: Outcome = {
      title: '重伤撤离',
      body: '你硬闯妖雾，被雾中妖鬼撕开肩背。主神把你拖回白光里，只给了最低生还奖励。',
      tone: 'failure',
      rewardPointsDelta: 80
    };

    return appendLog(
      {
        ...state,
        phase: 'result',
        rewardPoints: state.rewardPoints + outcome.rewardPointsDelta,
        lastOutcome: outcome
      },
      '副本失败，但你活着回到了主神空间。'
    );
  }

  if (choiceId === 'use_thunder_talisman') {
    const outcome: Outcome = {
      title: '雷火破雾',
      body: '雷火符炸开雾墙，妖鬼现形。你趁它哀嚎时斩下妖骨，第一次真正赢下副本事件。',
      tone: 'success',
      rewardPointsDelta: 280
    };

    return appendLog(
      {
        ...state,
        phase: 'result',
        rewardPoints: state.rewardPoints + outcome.rewardPointsDelta,
        inventory: [...state.inventory.filter((item) => item !== 'thunder_talisman'), 'demon_bone'],
        lastOutcome: outcome
      },
      '兑换改变了命运：雷火符让同一个事件出现了胜利结算。'
    );
  }

  const outcome: Outcome = {
    title: '雾后石门',
    body: '你按吐纳诀压住心跳，发现妖雾并不是墙，而是遮掩石门的阵法。',
    tone: 'discovery',
    rewardPointsDelta: 160
  };

  return appendLog(
    {
      ...state,
      phase: 'result',
      rewardPoints: state.rewardPoints + outcome.rewardPointsDelta,
      inventory: [...state.inventory, 'hidden_stone'],
      lastOutcome: outcome
    },
    '功法改变了观察方式：你找到一条隐藏路线。'
  );
}

export function returnToHub(state: GameState): GameState {
  return appendLog(
    {
      ...state,
      phase: 'hub',
      currentDungeon: undefined
    },
    '你回到主神空间。兑换列表冷冷亮起。'
  );
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run:

```bash
cd infinite-flow && npm test -- --run
```

Expected: PASS for 4 tests.

- [ ] **Step 5: Commit the tested model**

Run:

```bash
git add infinite-flow/src/game.ts infinite-flow/src/game.test.ts
git commit -m "feat: add infinite flow game model"
```

Expected: one commit containing the pure model and tests.

## Task 3: Build The Browser UI

**Files:**
- Create: `infinite-flow/src/main.ts`
- Create: `infinite-flow/src/styles.css`

- [ ] **Step 1: Create `infinite-flow/src/styles.css`**

Write:

```css
:root {
  color: #f6f3ea;
  background: #101015;
  font-family: Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background:
    radial-gradient(circle at 50% 0%, rgba(205, 181, 122, 0.22), transparent 34rem),
    linear-gradient(180deg, #17151d 0%, #0c0d12 100%);
}

button {
  font: inherit;
}

.app {
  width: min(100vw, 480px);
  min-height: 100vh;
  margin: 0 auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel {
  border: 1px solid rgba(236, 216, 162, 0.25);
  background: rgba(20, 20, 28, 0.88);
  border-radius: 8px;
  padding: 14px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.28);
}

.topline,
.meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.label {
  color: #b7ad95;
  font-size: 12px;
  letter-spacing: 0;
}

.value {
  color: #fff2bd;
  font-size: 18px;
  font-weight: 700;
}

.title {
  margin: 0 0 8px;
  color: #ffe7a1;
  font-size: 24px;
  line-height: 1.2;
}

.body {
  margin: 0;
  color: #ded8c6;
  font-size: 15px;
  line-height: 1.55;
}

.actions {
  display: grid;
  gap: 8px;
}

.action {
  width: 100%;
  min-height: 52px;
  border: 1px solid rgba(255, 231, 161, 0.35);
  border-radius: 8px;
  color: #f7f0d8;
  background: rgba(70, 58, 33, 0.62);
  text-align: left;
  padding: 10px 12px;
}

.action:disabled {
  color: #8d8794;
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
}

.action strong {
  display: block;
  margin-bottom: 4px;
}

.log {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.log li {
  color: #c8c1af;
  font-size: 13px;
  line-height: 1.4;
}

.tone-success {
  border-color: rgba(100, 220, 166, 0.45);
}

.tone-failure {
  border-color: rgba(244, 107, 107, 0.45);
}

.tone-discovery {
  border-color: rgba(117, 179, 255, 0.45);
}
```

- [ ] **Step 2: Create `infinite-flow/src/main.ts`**

Write:

```ts
import './styles.css';
import {
  buyItem,
  createInitialState,
  enterDungeon,
  getAvailableDungeonChoices,
  learnMethod,
  returnToHub,
  resolveDungeonChoice,
  type DungeonChoice,
  type GameState
} from './game';

let state = createInitialState();

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Missing #app root');
}

function hasInventory(item: string): boolean {
  return state.inventory.includes(item as never);
}

function hasMethod(method: string): boolean {
  return state.learnedMethods.includes(method as never);
}

function button(label: string, description: string, onClick: () => void, disabled = false): string {
  const disabledAttr = disabled ? ' disabled' : '';
  return `<button class="action"${disabledAttr} data-action="${label}">
    <strong>${label}</strong>
    <span>${description}</span>
  </button>`;
}

function renderHubActions(): string {
  return [
    button('兑换雷火符', '400 点。下次妖雾事件解锁「使用雷火符破雾」。', () => {
      state = buyItem(state, 'thunder_talisman');
      render();
    }, state.rewardPoints < 400),
    button('学习吐纳诀', '300 点。下次妖雾事件解锁「运转吐纳诀稳住心神」。', () => {
      state = learnMethod(state, 'breathing_method');
      render();
    }, state.rewardPoints < 300 || hasMethod('breathing_method')),
    button('进入妖塔一层', '进入副本，验证刚才的兑换是否改写命运。', () => {
      state = enterDungeon(state, 'demon_tower_1');
      render();
    })
  ].join('');
}

function renderDungeonActions(): string {
  return getAvailableDungeonChoices(state)
    .map((choice: DungeonChoice) =>
      button(choice.label, choice.preview, () => {
        state = resolveDungeonChoice(state, choice.id);
        render();
      })
    )
    .join('');
}

function renderResultActions(): string {
  return button('返回主神空间', '带着结算结果回到兑换大厅。', () => {
    state = returnToHub(state);
    render();
  });
}

function renderActions(): string {
  if (state.phase === 'hub') {
    return renderHubActions();
  }

  if (state.phase === 'dungeon') {
    return renderDungeonActions();
  }

  return renderResultActions();
}

function renderSceneTitle(): string {
  if (state.phase === 'hub') {
    return '主神空间';
  }

  if (state.phase === 'dungeon') {
    return '妖塔一层 · 雾中妖鬼';
  }

  return state.lastOutcome?.title ?? '副本结算';
}

function renderSceneBody(): string {
  if (state.phase === 'hub') {
    const owned = [
      hasInventory('thunder_talisman') ? '雷火符' : '',
      hasMethod('breathing_method') ? '吐纳诀' : ''
    ].filter(Boolean);

    return owned.length > 0
      ? `你已经准备好：${owned.join('、')}。同一个副本事件会出现新的选择。`
      : '白光大厅安静得像审判室。主神只给你一个问题：你准备用什么换下一次活命？';
  }

  if (state.phase === 'dungeon') {
    return '妖雾封住石阶，雾里有东西贴着地面爬行。第一次硬闯会很惨，但兑换能改变这里。';
  }

  return state.lastOutcome?.body ?? '结算完成。';
}

function renderMeta(): string {
  return `<section class="panel meta-grid">
    <div>
      <div class="label">奖励点</div>
      <div class="value">${state.rewardPoints}</div>
    </div>
    <div>
      <div class="label">精魄</div>
      <div class="value">${state.essence}</div>
    </div>
    <div>
      <div class="label">背包</div>
      <div class="value">${state.inventory.length ? state.inventory.join(' / ') : '空'}</div>
    </div>
    <div>
      <div class="label">功法</div>
      <div class="value">${state.learnedMethods.length ? state.learnedMethods.join(' / ') : '未学'}</div>
    </div>
  </section>`;
}

function attachHandlers(): void {
  const actions = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-action]'));
  const handlers = new Map<string, () => void>();

  handlers.set('兑换雷火符', () => {
    state = buyItem(state, 'thunder_talisman');
    render();
  });
  handlers.set('学习吐纳诀', () => {
    state = learnMethod(state, 'breathing_method');
    render();
  });
  handlers.set('进入妖塔一层', () => {
    state = enterDungeon(state, 'demon_tower_1');
    render();
  });
  handlers.set('返回主神空间', () => {
    state = returnToHub(state);
    render();
  });

  for (const choice of getAvailableDungeonChoices(state)) {
    handlers.set(choice.label, () => {
      state = resolveDungeonChoice(state, choice.id);
      render();
    });
  }

  for (const action of actions) {
    action.addEventListener('click', () => {
      handlers.get(action.dataset.action ?? '')?.();
    });
  }
}

function render(): void {
  const toneClass = state.lastOutcome ? ` tone-${state.lastOutcome.tone}` : '';

  app.innerHTML = `<div class="app">
    <section class="panel">
      <div class="label">无限流原型 · 兑换改变命运</div>
      <h1 class="title">${renderSceneTitle()}</h1>
      <p class="body">${renderSceneBody()}</p>
    </section>
    ${renderMeta()}
    <section class="panel${toneClass}">
      <div class="label">可执行选择</div>
      <div class="actions">${renderActions()}</div>
    </section>
    <section class="panel">
      <div class="label">主神记录</div>
      <ul class="log">${state.log.map((line) => `<li>${line}</li>`).join('')}</ul>
    </section>
  </div>`;

  attachHandlers();
}

render();
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
cd infinite-flow && npm run typecheck
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 4: Run tests**

Run:

```bash
cd infinite-flow && npm test -- --run
```

Expected: PASS for 4 tests.

- [ ] **Step 5: Run build**

Run:

```bash
cd infinite-flow && npm run build
```

Expected: Vite build succeeds and creates `dist/`.

- [ ] **Step 6: Commit the browser UI**

Run:

```bash
git add infinite-flow/index.html infinite-flow/src/main.ts infinite-flow/src/styles.css
git commit -m "feat: add infinite flow browser UI"
```

Expected: one commit containing only UI files and any index changes.

## Task 4: Add Project README And Final Verification

**Files:**
- Create: `infinite-flow/README.md`

- [ ] **Step 1: Create `infinite-flow/README.md`**

Write:

```markdown
# Infinite Flow Prototype

Standalone browser prototype for an original infinite-flow game.

## What This Proves

The first slice proves one loop:

1. Stand in the main-god space.
2. Enter `妖塔一层`.
3. Fail or suffer when forcing through the fog demon event.
4. Return to the main-god space.
5. Buy `雷火符` or learn `吐纳诀`.
6. Re-enter the same dungeon event and see a new outcome.

The existing top-level `game/` Cocos project is intentionally untouched.

## Commands

```bash
npm install
npm run dev
npm test -- --run
npm run typecheck
npm run build
```

## First Slice Scope

- Browser-first TypeScript app.
- No backend.
- No payment.
- No account persistence.
- No engine migration.
- Event choices stand in for combat.
```

- [ ] **Step 2: Run all verification commands**

Run:

```bash
cd infinite-flow && npm test -- --run && npm run typecheck && npm run build
```

Expected: tests, typecheck, and build all pass.

- [ ] **Step 3: Confirm `game/` was not modified**

Run:

```bash
git diff --name-only -- game
```

Expected: no output.

- [ ] **Step 4: Commit README and verification cleanup**

Run:

```bash
git add infinite-flow/README.md
git commit -m "docs: document infinite flow prototype"
```

Expected: one commit containing the README only.

## Self-Review

Spec coverage:
- New standalone folder: Task 1 creates `infinite-flow/`.
- Main-god Hub and dungeon loop: Task 2 model and Task 3 UI implement it.
- Upgrade changes fate: Task 2 tests `thunder_talisman` and `breathing_method` branch unlocks.
- Existing `game/` untouched: Task 4 checks `git diff --name-only -- game`.
- Local verification: Tasks 2-4 run tests, typecheck, and build.

Placeholder scan:
- No task depends on hidden future work.
- No `game/` file is modified.
- All code-bearing steps include full file contents.

Type consistency:
- `DungeonChoice['id']` is the source type for dungeon choice IDs.
- UI action labels match handler keys exactly.
- Model item and method IDs are stable across tests and UI.
