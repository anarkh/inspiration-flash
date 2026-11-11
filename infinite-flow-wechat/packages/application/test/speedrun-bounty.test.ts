import {
  createInitialState, DUNGEON_ORDER, DUNGEONS, getCurrentSpeedrun, getRunEconomyPreview, getSpeedrunBounty, type GameState
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

// Every chapter has a speedrun line well short of its 30 rooms; the bounty is 50% of the run's reward points, half
// the exit's lingyun (rounded up) and one cycle imprint: chapter 1's exit pays 1 lingyun -> 1, chapter 19's 15 -> 8.
assert(DUNGEON_ORDER.every((dungeonId) => DUNGEONS[dungeonId].speedrunRoomLimit >= 4 && DUNGEONS[dungeonId].speedrunRoomLimit <= 12),
  'every chapter sets a speedrun line between 4 and 12 rooms');
const first = getSpeedrunBounty('demon_tower_1');
const last = getSpeedrunBounty('panopticon_city');
assert(first.roomLimit === 5 && first.rewardPointPercent === 50 && first.lingyun === 1 && first.cycleImprints === 1,
  'chapter 1: 5 rooms, +50% reward points, 1 lingyun, 1 imprint');
assert(last.lingyun === 8 && last.cycleImprints === 1, 'chapter 19: 15 exit lingyun -> 8');

// Standing at the exit of the demon tower with the boss down and 1000 reward points in the bag, having cleared `rooms` rooms.
function atExit(rooms: number, protocolId: 'standard' | 'imprint' = 'standard'): GameState {
  const entered = apply({ ...createInitialState(), completedDungeonIds: ['demon_tower_1'] }, {
    type: 'run/enter', dungeonId: 'demon_tower_1', protocolId, seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_abcd }
  });
  return {
    ...entered,
    run: {
      ...entered.run!,
      currentNodeId: 'tower_exit',
      clearedNodeIds: ['fog_lesser_demon', 'blood_rune_trap', 'broken_sigil_reward', 'bone_lane_monster'],
      lootBag: { ...entered.run!.lootBag, rewardPoints: 1000 },
      pressureState: { ...entered.run!.pressureState!, clearedNodeCount: rooms }
    }
  };
}

const onPace = atExit(5);
assert(getCurrentSpeedrun(onPace)?.onPace === true && getCurrentSpeedrun(atExit(6))?.onPace === false, 'the line itself counts; one room more does not');
const fast = apply(onPace, { type: 'run/resolve-exit' });
const slow = apply(atExit(6), { type: 'run/resolve-exit' });
assert(fast.lingyun - slow.lingyun === 1 && fast.inventory.cycle_imprint - slow.inventory.cycle_imprint === 1,
  'a clear within the line adds 1 lingyun and 1 cycle imprint over the same clear one room past it');
// The whole-run base is the exit share plus the bag. Five rooms is still the stable tier (+15%), six is hunted (+5%);
// the bounty adds 50% of the same base. Bag points were credited on pickup, so only the bonuses differ.
const base = getRunEconomyPreview(onPace, 'cleared', true)!.rewardPoints + 1000;
const bonus = Math.floor((base * 50) / 100);
assert(fast.rewardPoints - slow.rewardPoints === Math.floor((base * 15) / 100) - Math.floor((base * 5) / 100) + bonus,
  'within the line the run also earns 50% of its reward points');
assert(fast.run!.lastPressureSettlement!.speedrunBounty?.roomLimit === 5 && fast.run!.lastPressureSettlement!.speedrunBounty.rewardPoints === bonus
  && slow.run!.lastPressureSettlement!.speedrunBounty === undefined,
  'the settlement records the bounty, reward points included, only when it is paid');
assert(fast.log.some((line) => line.includes(`速通悬赏：清理 5/5 间，整局奖励点 +50%（+${bonus}），追加灵蕴 x1、轮回刻印 x1`)),
  'the settlement log names the bounty');
assert(!slow.log.some((line) => line.includes('速通悬赏')), 'no bounty, no line');

// Hard runs keep the map and the line; inferno redraws the map and has none.
assert(apply(atExit(5, 'imprint'), { type: 'run/resolve-exit' }).run!.lastPressureSettlement!.speedrunBounty?.lingyun === 1, 'a hard clear earns it too');
const inferno = apply({ ...createInitialState(), completedDungeonIds: ['demon_tower_1'] }, {
  type: 'run/enter', dungeonId: 'demon_tower_1', protocolId: 'deep', infernoTier: 1,
  seeds: { rulesVersion: 1, hiddenTaskSeed: 7, infernoMapSeed: 9 }
});
assert(getCurrentSpeedrun(inferno) === undefined, 'inferno runs carry no speedrun line');
