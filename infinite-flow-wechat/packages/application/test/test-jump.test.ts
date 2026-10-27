import { createInitialState, DUNGEON_ORDER, enterDungeon, getPlayerPower, type GameState } from '@infinite-flow/core';
import { reduceGameCommand, type GameCommand } from '../src/index.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// Hidden tester jump: from the hub, a fresh save at chapter N's level that can enter chapter N at once.
const hub = createInitialState();
for (const chapter of [1, 8, 19]) {
  const result = reduceGameCommand(hub, { type: 'test/jump-to-chapter', chapter } as GameCommand);
  assert(result.status === 'committed', `jumping to chapter ${chapter} commits`);
  const jumped: GameState = result.state;
  assert(jumped.completedDungeonIds.length === chapter - 1, `chapter ${chapter}: the chapters before it count as cleared`);
  const entered = enterDungeon(jumped, DUNGEON_ORDER[chapter - 1]!, 'standard', undefined, { flowVersion: 2, hiddenTaskSeed: 7 });
  assert(entered.phase === 'explore', `chapter ${chapter} opens right after the jump`);
  assert(jumped.player.hp === jumped.player.maxHp || jumped.player.hp > 0, 'the jumped character starts healthy');
  if (chapter > 1) assert(getPlayerPower(jumped) > getPlayerPower(hub), 'later chapters start stronger');
}
const inRun = enterDungeon(hub, DUNGEON_ORDER[0]!, 'standard', undefined, { flowVersion: 2, hiddenTaskSeed: 7 });
assert(reduceGameCommand(inRun, { type: 'test/jump-to-chapter', chapter: 5 } as GameCommand).status === 'rejected', 'a run in progress is never overwritten');
assert(reduceGameCommand(hub, { type: 'test/jump-to-chapter', chapter: 20 } as GameCommand).status === 'rejected', 'only chapters 1-19 exist');
