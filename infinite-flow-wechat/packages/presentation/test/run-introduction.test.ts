import { reduceGameCommand } from '@infinite-flow/application';
import { createInitialState, type DungeonId, type GameState } from '@infinite-flow/core';
import { buildGameViewModel } from '../src/index.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function enter(dungeonId: DungeonId, completedDungeonIds: DungeonId[]): GameState {
  const result = reduceGameCommand({
    ...createInitialState(),
    completedDungeonIds,
    claimedTaskIds: completedDungeonIds.map(id => `mainline_clear_${id}`)
  }, {
    type: 'run/enter', dungeonId, protocolId: 'standard',
    seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_5678 }
  });
  assert(result.status === 'committed' && result.state.run, `${dungeonId}: entry commits`);
  return result.state;
}

function explore(state: GameState) {
  const detail = buildGameViewModel(state, {}).sections[1].detail;
  assert(detail.kind === 'explore', 'the introduction is an explore projection');
  return detail;
}

// The opening chapter's first clear has no lamp, so nothing to introduce.
const opening = explore(enter('demon_tower_1', []));
assert(opening.lantern === undefined && opening.runIntroduction === undefined, 'the opening first clear has no lamp and no introduction');
assert(opening.chapterDecision?.pursuit.status === 'disabled', 'the opening first clear leaves the pursuer out');

// The first lamp runs after it open with the lamp and the pursuer.
const second = enter('metro_abyss', ['demon_tower_1']);
const intro = explore(second).runIntroduction;
assert(intro?.title === '灯油与破界追兵' && intro.line.includes('灯油') && intro.line.includes('苏醒'),
  'a lamp run while only the opening chapter is cleared introduces both rules');
assert(explore(enter('demon_tower_1', ['demon_tower_1'])).runIntroduction !== undefined, 'replaying the opening chapter also introduces them');

// The introduction belongs to the opening room only, and stops once a second chapter is cleared.
const moved: GameState = { ...second, run: { ...second.run!, clearedNodeIds: [second.run!.currentNodeId] } };
assert(explore(moved).runIntroduction === undefined, 'a cleared opening room no longer introduces the rules');
assert(explore(enter('metro_abyss', ['demon_tower_1', 'metro_abyss'])).runIntroduction === undefined,
  'once a second chapter is cleared the rules need no introduction');
