import { createInitialState, getRunEconomyPreview, type GameState } from '@infinite-flow/core';
import { scaleRunProtocolRewardPoints, type RunProtocolId } from '@infinite-flow/core/run-protocols';
import { reduceGameCommand, type GameCommand } from '../src/index.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function apply(state: GameState, command: GameCommand): GameState {
  const result = reduceGameCommand(state, command);
  assert(result.status === 'committed', `${JSON.stringify(command)} must commit`);
  return result.state;
}

// Standing at the exit of a cleared-boss run in the stable pressure tier, carrying a bag of reward points.
function atExit(protocolId: RunProtocolId, bagRewardPoints: number): GameState {
  const entered = apply({ ...createInitialState(), completedDungeonIds: ['demon_tower_1'] }, {
    type: 'run/enter', dungeonId: 'demon_tower_1', protocolId,
    seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_abcd }
  });
  return {
    ...entered,
    run: {
      ...entered.run!,
      currentNodeId: 'tower_exit',
      clearedNodeIds: ['fog_lesser_demon', 'blood_rune_trap', 'broken_sigil_reward', 'bone_lane_monster'],
      damageTaken: 10,
      lootBag: { ...entered.run!.lootBag, rewardPoints: bagRewardPoints }
    }
  };
}

const light = atExit('standard', 0);
const heavy = atExit('standard', 1000);
const exitShare = getRunEconomyPreview(heavy, 'cleared', true)!.rewardPoints;
assert(exitShare === getRunEconomyPreview(light, 'cleared', true)!.rewardPoints,
  'the performance multiplier still scales the exit share alone');

const lightClear = apply(light, { type: 'run/resolve-exit' });
const heavyClear = apply(heavy, { type: 'run/resolve-exit' });
const lightPressure = lightClear.run!.lastPressureSettlement!;
const heavyPressure = heavyClear.run!.lastPressureSettlement!;
assert(heavyPressure.tier === 'stable', 'the fixture exits in the stable tier');
assert(lightPressure.rewardPointBonus === Math.floor((exitShare * 15) / 100),
  'an empty bag leaves only the exit share for the pressure bonus');
assert(heavyPressure.rewardPointBonus === Math.floor(((exitShare + 1000) * 15) / 100),
  'the stable-tier bonus scales the bag plus the exit share');
// Bag points are credited on pickup (a failure claws back the lost share), so the clear only adds the bonus.
assert(heavyClear.rewardPoints - lightClear.rewardPoints === heavyPressure.rewardPointBonus - lightPressure.rewardPointBonus,
  'the larger bag only changes the clear payout through its bonus');
assert(heavyClear.log.some(line => line.includes(`整局奖励点加成 +${heavyPressure.rewardPointBonus}`)),
  'the settlement log names the whole-run bonus');

const hard = apply(atExit('imprint', 1000), { type: 'run/resolve-exit' });
const protocol = hard.run!.lastProtocolSettlement!;
const hardExitShare = getRunEconomyPreview(atExit('imprint', 1000), 'cleared', true)!.rewardPoints;
const hardBase = hardExitShare + 1000;
assert(protocol.status === 'succeeded' && protocol.baseRewardPoints === hardBase,
  'the difficulty multiplier starts from the bag plus the exit share');
assert(protocol.rewardPointBonus === scaleRunProtocolRewardPoints(hardBase, 'demon_tower_1', 'imprint') - hardBase
  && protocol.rewardPointBonus > 300,
  'the hard difficulty bonus scales the whole run, not just the exit share');
