import {
  createInitialState, enterDungeon, getCurrentMethodTechniqueStatus, getDerivedStats, getEquippedMethods, getMethodStats,
  type GameState, type MethodId
} from '@infinite-flow/core';
import { reduceGameCommand, type GameCommand } from '../src/index.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function apply(state: GameState, command: GameCommand): GameState {
  const result = reduceGameCommand(state, command);
  assert(result.status === 'committed', `${JSON.stringify(command)} must commit`);
  return result.state;
}

function rich(): GameState {
  const state = createInitialState();
  for (const itemId of Object.keys(state.inventory) as (keyof GameState['inventory'])[]) state.inventory[itemId] = 50;
  return { ...state, rewardPoints: 100_000, lingyun: 100 };
}

const learn = (state: GameState, methodId: MethodId) => apply(state, { type: 'hub/learn-method', methodId });
const equipped = (state: GameState) => getEquippedMethods(state).join(',');

// The first method learned is the 主修, the second fills the 辅修, later ones wait to be chosen.
let state = learn(rich(), 'mist_breathing');
assert(state.activeMethod === 'mist_breathing' && state.supportMethod === undefined, 'the first method becomes the 主修');
state = learn(state, 'iron_body');
assert(equipped(state) === 'mist_breathing,iron_body', 'the second method fills the empty 辅修');
state = learn(state, 'gate_sense');
assert(equipped(state) === 'mist_breathing,iron_body' && state.learnedMethods.includes('gate_sense'),
  'a third method is learned but idle until chosen');

// Only the 主修 and 辅修 add their stats.
const stats = JSON.stringify(getDerivedStats(state));
assert(stats === JSON.stringify(getDerivedStats(learn(learn(rich(), 'mist_breathing'), 'iron_body'))),
  'an idle learned method adds nothing');
assert(JSON.stringify(getDerivedStats(apply(state, { type: 'hub/assign-support-method', methodId: 'gate_sense' }))) !== stats,
  'choosing another 辅修 changes the stats it adds');

// A method's stats grow with its rank, and only while it is the 主修 or 辅修 (定门法 is 灵识 +2 per rank, 4 术强 each).
assert(getMethodStats('gate_sense', 3).spirit === 6, 'R3 triples the per-rank stats');
const gateMain = apply(state, { type: 'hub/activate-method', methodId: 'gate_sense' });
const ranked = (rank: 1 | 3, from: GameState) => getDerivedStats({ ...from, methodRanks: { ...from.methodRanks, gate_sense: rank } });
assert(ranked(3, gateMain).artPower - ranked(1, gateMain).artPower === 16, 'an equipped method adds its rank-scaled stats');
assert(ranked(3, state).artPower === ranked(1, state).artPower, 'an idle method adds nothing at any rank');

// Choosing: another method replaces the 主修; raising the 辅修 swaps the two.
const promoted = apply(state, { type: 'hub/activate-method', methodId: 'gate_sense' });
assert(equipped(promoted) === 'gate_sense,iron_body', 'an idle method replaces the 主修 and the 辅修 stays');
const swapped = apply(state, { type: 'hub/activate-method', methodId: 'iron_body' });
assert(equipped(swapped) === 'iron_body,mist_breathing', 'raising the 辅修 swaps it with the 主修');
const demoted = apply(state, { type: 'hub/assign-support-method', methodId: 'mist_breathing' });
assert(equipped(demoted) === 'iron_body,mist_breathing', 'moving the 主修 down swaps it with the 辅修');
const replaced = apply(state, { type: 'hub/assign-support-method', methodId: 'gate_sense' });
assert(equipped(replaced) === 'mist_breathing,gate_sense', 'an idle method replaces the 辅修');
assert(reduceGameCommand(state, { type: 'hub/assign-support-method', methodId: 'iron_body' }).status === 'rejected',
  'the current 辅修 cannot be chosen again');
const alone = learn(rich(), 'mist_breathing');
assert(reduceGameCommand(alone, { type: 'hub/assign-support-method', methodId: 'mist_breathing' }).status === 'rejected',
  'the only method stays the 主修');
assert(reduceGameCommand(state, { type: 'hub/assign-support-method', methodId: 'void_heart' }).status === 'rejected',
  'an unlearned method cannot be chosen');

// Saves from before the loadout: no chosen 主修 or 辅修 means the first two learned methods.
const legacy: GameState = { ...rich(), learnedMethods: ['cloud_step', 'iron_body', 'mist_breathing'], methodRanks: { cloud_step: 2, iron_body: 1, mist_breathing: 3 } };
assert(equipped(legacy) === 'cloud_step,iron_body', 'an old save keeps its first two learned methods until it chooses');
assert(equipped({ ...legacy, activeMethod: 'iron_body' }) === 'iron_body,cloud_step', 'an old common method stays the 主修 with the next learned as 辅修');

// Entry freezes only the 主修's technique; the 辅修 has none in the run.
const run = enterDungeon(state, 'demon_tower_1', 'standard', undefined, { flowVersion: 2, hiddenTaskSeed: 7 });
assert(run.run?.methodSnapshots?.map(({ methodId }) => methodId).join(',') === 'mist_breathing', 'only the 主修 technique enters the run');
assert(getCurrentMethodTechniqueStatus(run, 'iron_body').reason === 'not_in_run', 'the 辅修 has no technique in the run');
