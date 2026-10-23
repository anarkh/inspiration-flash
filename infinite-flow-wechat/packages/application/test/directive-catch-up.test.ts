import { createInitialState, type GameState } from '@infinite-flow/core';
import { reduceGameCommand, type GameCommand } from '../src/index.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function apply(state: GameState, command: GameCommand): GameState {
  const result = reduceGameCommand(state, command);
  assert(result.status === 'committed', `${JSON.stringify(command)} must commit`);
  return result.state;
}

// A chapter cleared before without its directive: the pet and method objectives are met, damage stays under 20.
const veteran: GameState = {
  ...createInitialState(),
  completedDungeonIds: ['demon_tower_1'],
  learnedMethods: ['mist_breathing'],
  ownedPets: ['mist_kitten']
};
const entered = apply(veteran, {
  type: 'run/enter', dungeonId: 'demon_tower_1', protocolId: 'standard',
  seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_abcd }
});
const atExit: GameState = {
  ...entered,
  run: {
    ...entered.run!,
    currentNodeId: 'tower_exit',
    clearedNodeIds: ['fog_lesser_demon', 'blood_rune_trap', 'broken_sigil_reward', 'bone_lane_monster'],
    damageTaken: 10
  }
};

// A repeat clear that meets the directive pays the missed directive reward, once.
const caughtUp = apply(atExit, { type: 'run/resolve-exit' });
const alreadyPaid = apply({ ...atExit, claimedDirectiveIds: ['directive_demon_tower_1'] }, { type: 'run/resolve-exit' });
assert(caughtUp.phase === 'result' && caughtUp.claimedDirectiveIds.includes('directive_demon_tower_1'),
  'a repeat clear settles a directive the first clear missed');
assert(caughtUp.rewardPoints - alreadyPaid.rewardPoints === 260 && caughtUp.inventory.hidden_stone === alreadyPaid.inventory.hidden_stone + 1,
  'the caught-up clear adds exactly the directive reward');
assert(alreadyPaid.claimedDirectiveIds.join() === 'directive_demon_tower_1', 'a directive already paid is never paid again');
