import { createInitialState, ECHO_COIN_MIN_REWARD, getEchoCoinReward, type GameState } from '@infinite-flow/core';
import { reduceGameCommand, type GameCommand } from '../src/index.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function apply(state: GameState, command: GameCommand): GameState {
  const result = reduceGameCommand(state, command);
  assert(result.status === 'committed', `${JSON.stringify(command)} must commit`);
  return result.state;
}

// Standing on the demon tower's cracked portal, carrying echo coins, with a bag of unsettled points.
function atPortal(bagRewardPoints: number, coins: number): GameState {
  const base = createInitialState();
  const entered = apply({
    ...base,
    completedDungeonIds: ['demon_tower_1', 'metro_abyss'],
    inventory: { ...base.inventory, echo_coin: coins },
    preparedItemIds: ['echo_coin']
  }, { type: 'run/enter', dungeonId: 'demon_tower_1', protocolId: 'standard', seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_abcd } });
  return {
    ...entered,
    phase: 'explore',
    run: { ...entered.run!, currentNodeId: 'cracked_portal', lootBag: { ...entered.run!.lootBag, rewardPoints: bagRewardPoints } }
  };
}

function crossingGain(bagRewardPoints: number, coins: number): { gain: number; coinsLeft: number } {
  const before = atPortal(bagRewardPoints, coins);
  const after = apply(before, { type: 'node/use-portal', choice: 'auto' });
  return { gain: after.run!.lootBag.rewardPoints - before.run!.lootBag.rewardPoints, coinsLeft: after.inventory.echo_coin };
}

assert(getEchoCoinReward(1000) === 100 && getEchoCoinReward(0) === ECHO_COIN_MIN_REWARD && getEchoCoinReward(55) === ECHO_COIN_MIN_REWARD,
  'a coin pays a tenth of the bag, never less than the old flat amount');
const withCoin = crossingGain(1000, 2);
const withoutCoin = crossingGain(1000, 0);
// The coin breaks after the room's own reward lands, so it counts that reward too.
assert(withCoin.gain - withoutCoin.gain === getEchoCoinReward(1000 + withoutCoin.gain) && withCoin.coinsLeft === 1,
  'crossing a portal breaks one carried coin for a tenth of the bag');
const emptyBag = crossingGain(0, 1);
assert(emptyBag.gain - crossingGain(0, 0).gain === ECHO_COIN_MIN_REWARD && emptyBag.coinsLeft === 0,
  'an empty bag still returns the minimum');

// Portal logs name the pursuer's state in words, never by its internal id.
const forced = apply(atPortal(0, 0), { type: 'node/use-portal', choice: 'auto' });
const pursuitLine = forced.log.find(line => line.includes('破界追兵'));
assert(pursuitLine?.includes('尚未激活') && !/dormant|stalking|repelled/.test(forced.log.join('\n')),
  `portal log describes the pursuer state for players: ${pursuitLine}`);
