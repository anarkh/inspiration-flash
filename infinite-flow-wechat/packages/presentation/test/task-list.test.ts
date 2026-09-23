import { reduceGameCommand } from '@infinite-flow/application';
import { DUNGEONS, DUNGEON_ORDER, createInitialState, type DungeonId, type GameState } from '@infinite-flow/core';
import { evaluateVisibleTasks, MAIN_GOD_TASKS, MAINLINE_TASKS } from '@infinite-flow/core/task-system';
import { buildGameViewModel, type TaskViewModel } from '../src/index.js';

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function task(state: GameState, id: string): TaskViewModel {
  const found = buildGameViewModel(state).tasks.find((candidate) => candidate.id === id);
  assert(found, `current task missing: ${id}`);
  return found;
}

function enter(state: GameState, dungeonId: DungeonId): GameState {
  const result = reduceGameCommand(state, {
    type: 'run/enter', dungeonId, protocolId: 'standard',
    seeds: { rulesVersion: 1, hiddenTaskSeed: 12345 }
  });
  assert(result.status === 'committed', `could not enter ${dungeonId}`);
  return result.state;
}

const initial = createInitialState();
const initialSnapshot = JSON.stringify(initial);
const initialTasks = buildGameViewModel(initial).tasks;
assert(initialTasks.length === 4, 'fresh players see exactly four automatically active tasks');
assert(initialTasks.map(({ id }) => id).join(',') === [
  'mainline_clear_demon_tower_1', 'side_enter_demon_tower_1',
  'side_directive_demon_tower_1', 'side_unlock_first_bloodline'
].join(','), 'locked chapters and cultivation gates must not appear as accepted tasks');
assert(initialTasks[0]!.objectives.join() === '通关妖塔一层 0/1', 'mainline states the actual dungeon-clear objective');
assert(initialTasks[1]!.objectives.join() === '进入妖塔一层 0/1', 'scouting states the actual entry objective');
const trial = initialTasks[2]!;
assert(trial.objectives.join('|') === '清理妖塔一层节点 0/3|捕获雾爪幼兽 0/1|掌握吐纳诀 0/1|首通妖塔一层 0/1',
  'the directive exposes understandable actions instead of an opaque settlement counter');
assert(trial.detailObjectives?.some((line) => line.includes('承伤不超过 20') && line.includes('承伤 0/20')),
  'the persistent damage limit remains in details');
assert(trial.detailObjectives?.includes('首通妖塔一层 0/1'), 'details retain first-clear settlement requirements');
assert(initialTasks[3]!.objectives.join() === '觉醒任意血统 0/1', 'bloodline task has an actionable count');
assert(initialTasks.every(({ description, hint, rewardText }) => description && hint && rewardText), 'details retain the domain explanations and rewards');
assert(Object.isFrozen(initialTasks) && Object.isFrozen(trial.objectives), 'task projections are deeply immutable');
assert(JSON.stringify(initial) === initialSnapshot, 'reading current tasks must not accept tasks or mutate the game');

const entered = enter(initial, 'demon_tower_1');
assert(task(entered, 'side_enter_demon_tower_1').status === 'completed', 'entry progress updates during exploration before returning to the hub');
assert(task(entered, 'mainline_clear_demon_tower_1').status === 'active', 'entry does not falsely finish a mainline task');
const partial: GameState = {
  ...entered,
  learnedMethods: ['mist_breathing'],
  ownedPets: ['mist_kitten'],
  run: { ...entered.run!, clearedNodeIds: [DUNGEONS.demon_tower_1.nodes[0]!.id], damageTaken: 21 }
};
for (const phase of ['explore', 'combat', 'result'] as const) {
  const current = task({ ...partial, phase }, 'side_directive_demon_tower_1');
  assert(current.objectives.includes('清理妖塔一层节点 1/3'), `${phase} retains live run counts`);
  assert(!current.objectives.some((line) => line.startsWith('捕获') || line.startsWith('掌握')), `${phase} emphasizes unfinished actions`);
  assert(current.objectives.includes('本轮未满足：承伤不超过 20'), `${phase} exposes an already-failed persistent condition`);
  assert(current.detailObjectives?.some((line) => line.includes('捕获雾爪幼兽') && line.includes('已永久拥有')),
    `${phase} retains completed sub-objectives in details`);
}
const readyToExit: GameState = {
  ...partial,
  run: { ...partial.run!, clearedNodeIds: DUNGEONS.demon_tower_1.nodes.slice(0, 3).map(({ id }) => id), damageTaken: 10 }
};
assert(task(readyToExit, 'side_directive_demon_tower_1').objectives.join() === '从出口完成妖塔一层首通结算 0/1',
  'finished sub-objectives still explain that the first-clear exit is required');

const settled: GameState = {
  ...initial, completedDungeonIds: ['demon_tower_1'], claimedDirectiveIds: ['directive_demon_tower_1']
};
assert(task(settled, 'mainline_clear_demon_tower_1').status === 'completed', 'completed unclaimed mainline remains visible');
assert(task(settled, 'side_directive_demon_tower_1').detailObjectives?.some((line) => line.includes('承伤不超过 20') && line.includes('首通时已满足')),
  'settled tasks show historical satisfied conditions without inventing current-run counters');
const claimed = reduceGameCommand(settled, { type: 'hub/claim-task', taskId: 'mainline_clear_demon_tower_1' });
assert(claimed.status === 'committed', 'real mainline claim commits');
const claimedTasks = buildGameViewModel(claimed.state).tasks;
assert(!claimedTasks.some(({ id }) => id === 'mainline_clear_demon_tower_1'), 'claimed tasks disappear from the current list');
assert(claimedTasks.some(({ id }) => id === 'mainline_clear_metro_abyss'), 'claiming the previous mainline automatically exposes the new chapter');
assert(!buildGameViewModel({ ...settled, claimedTaskIds: ['clear_demon_tower'] }).tasks.some(({ id }) => id === 'mainline_clear_demon_tower_1'),
  'legacy reward claims cannot reappear as current tasks');

const advanced: GameState = {
  ...initial, completedDungeonIds: [...DUNGEON_ORDER],
  claimedTaskIds: MAINLINE_TASKS.slice(0, -1).map(({ id }) => id),
  ownedCompanions: ['qin_che'], companionRanks: { qin_che: 2 },
  learnedMethods: ['mist_breathing'], methodRanks: { mist_breathing: 2 },
  bloodlineRanks: { titan_marrow: 1 }
};
assert(task(advanced, 'side_train_companion_rank_2').objectives[0] === '训练任意同伴至位阶 2 2/2', 'companion progress follows the domain rank');
assert(task(advanced, 'side_master_first_method_rank_3').objectives[0] === '精研任意功法至 R3 2/3', 'method progress retains the incomplete rank target');
assert(task(advanced, 'side_master_first_bloodline_rank_3').objectives[0] === '觉醒任意血统至 R3 1/3', 'bloodline rank progress is explicit');
assert(task(advanced, 'side_directive_combat_replay_stage').objectives.every((line) => line.endsWith('1/1')),
  'recording-stage tasks retain both fulfilled conditions after a completed run is gone');

const seen = new Set<string>();
for (let index = 0; index < DUNGEON_ORDER.length; index += 1) {
  const state: GameState = { ...advanced, completedDungeonIds: DUNGEON_ORDER.slice(0, index), claimedTaskIds: MAINLINE_TASKS.slice(0, index).map(({ id }) => id) };
  const projected = buildGameViewModel(state).tasks;
  const expected = evaluateVisibleTasks(state).filter(({ status }) => status === 'active' || status === 'completed');
  assert(projected.map(({ id }) => id).join() === expected.map(({ taskId }) => taskId).join(), 'every chapter uses the domain visibility and reward state');
  projected.forEach(({ id, objectives }) => {
    seen.add(id);
    assert(objectives.length > 0 && objectives.every((line) => !/undefined|NaN/.test(line)), `${id} has valid readable objectives`);
  });
}
assert(MAIN_GOD_TASKS.every(({ id }) => seen.has(id)), 'coverage includes every mainline, chapter side task, and cultivation task');

const panopticon = enter({ ...advanced, completedDungeonIds: DUNGEON_ORDER.slice(0, -1) }, 'panopticon_city');
const panLaw = panopticon.run!.lawState!;
assert(panLaw.law.kind === 'panopticon_city', 'panopticon fixture has real chapter law');
const routed: GameState = {
  ...panopticon,
  run: { ...panopticon.run!, lawState: { ...panLaw, law: {
    ...panLaw.law, route: 'shadow', relays: { north_blind_relay: true, central_blind_relay: false, south_blind_relay: false }
  } } }
};
assert(task(routed, 'side_enter_panopticon_city').objectives[0] === '完成盲区中继 1/3', 'chapter-specific relay progress is not confused with generic entry');
assert(task(routed, 'side_directive_panopticon_city').objectives.join('|') === '选择逃逸路线 1/1|冻结首领快照 0/1',
  'a multi-condition task retains the independent route and boss snapshot progress');
