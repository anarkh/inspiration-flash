import {
  createInitialState, DUNGEON_ORDER, EQUIPMENT, getDerivedStats, getEquipmentSystemStatus, getLuckRewardPercent, GROWTH_TIER_UNLOCK_CHAPTERS,
  LUCK_REWARD_PERCENT_CAP, type GameState
} from '@infinite-flow/core';
import { getInfernoTierModifiers } from '@infinite-flow/core/inferno-system';
import { getRunProtocolDefinition } from '@infinite-flow/core/run-protocols';
import { reduceGameCommand, type GameCommand } from '../src/index.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const base = createInitialState();
function richAfter(chapters: number): GameState {
  return {
    ...base,
    rewardPoints: 100_000,
    lingyun: 100,
    inventory: Object.fromEntries(Object.keys(base.inventory).map((itemId) => [itemId, 50])) as GameState['inventory'],
    completedDungeonIds: DUNGEON_ORDER.slice(0, chapters)
  };
}
function apply(state: GameState, command: GameCommand): GameState {
  const result = reduceGameCommand(state, command);
  assert(result.status === 'committed', `${JSON.stringify(command)} must commit: ${result.status === 'rejected' ? result.reason.message : ''}`);
  return result.state;
}

// Tiers 2 and 3 open after the first clears of chapters 6 and 12, for methods, companions, bloodlines and pets alike.
assert(GROWTH_TIER_UNLOCK_CHAPTERS[2] === 6 && GROWTH_TIER_UNLOCK_CHAPTERS[3] === 12, 'tier 2 after chapter 6, tier 3 after chapter 12');
const learned = (chapters: number) => apply(richAfter(chapters), { type: 'hub/learn-method', methodId: 'iron_body' });
const early = reduceGameCommand(learned(5), { type: 'hub/upgrade-method', methodId: 'iron_body' });
assert(early.status === 'rejected' && early.reason.message.includes('第 6 章首次通关后'), 'before chapter 6 a method cannot reach R2, and says why');
const tierTwo = apply(learned(6), { type: 'hub/upgrade-method', methodId: 'iron_body' });
assert(tierTwo.methodRanks.iron_body === 2, 'after chapter 6 it reaches R2');
const stuck = reduceGameCommand(tierTwo, { type: 'hub/upgrade-method', methodId: 'iron_body' });
assert(stuck.status === 'rejected' && stuck.reason.message.includes('第 12 章首次通关后'), 'R3 waits for chapter 12');
const companion = apply(richAfter(5), { type: 'hub/recruit-companion', companionId: 'qin_che' });
const companionEarly = reduceGameCommand(companion, { type: 'hub/upgrade-companion', companionId: 'qin_che' });
assert(companionEarly.status === 'rejected' && companionEarly.reason.message.includes('第 6 章首次通关后'), 'companions wait for chapter 6');
const pet = apply(richAfter(5), { type: 'hub/buy-pet', petId: 'contract_sprite' });
const petEarly = reduceGameCommand(pet, { type: 'hub/upgrade-pet', petId: 'contract_sprite' });
assert(petEarly.status === 'rejected' && petEarly.reason.message.includes('第 6 章首次通关后'), 'pets wait for chapter 6');
const bloodline = apply(richAfter(5), { type: 'hub/unlock-bloodline', bloodlineId: 'titan_marrow' });
const bloodlineEarly = reduceGameCommand(bloodline, { type: 'hub/upgrade-bloodline', bloodlineId: 'titan_marrow' });
assert(bloodlineEarly.status === 'rejected' && bloodlineEarly.reason.message.includes('第 6 章首次通关后'), 'bloodlines wait for chapter 6');

// 气运 comes off exploration gear's trap sense, which it still counts toward: the hood's trap sense is unchanged.
const hood: GameState = { ...base, ownedEquipment: [...base.ownedEquipment, 'mist_hood'], equipped: { ...base.equipped, head: 'mist_hood' }, equipmentLevels: { ...base.equipmentLevels, mist_hood: 5 } };
assert(EQUIPMENT.mist_hood.base.luck === 1 && EQUIPMENT.mist_hood.perLevel.luck === 1, 'the hood carries 1 luck and 1 more per level');
assert(getDerivedStats(hood).luck === getDerivedStats(base).luck + 5, 'a level-5 hood adds 5 luck');
// Against the bare starting headwrap: old hood = trap 3 + 2 x 4 + 心神 1 x 2 = 13; now luck 5 + trap 2 + 1 x 4 + 心神 2 = 13.
// Its fixed affix 雾听预兆 adds the same trap sense either way.
const affix = getEquipmentSystemStatus(hood).bonus.trapCheck ?? 0;
assert(affix > 0 && getDerivedStats(hood).trapCheck - getDerivedStats(base).trapCheck === 13 + affix, 'its trap sense is what it was before');
// Each point of 气运 adds 1% of a successful run's reward points, up to 30%.
assert(getLuckRewardPercent(base) === 1 && getLuckRewardPercent(hood) === 6, 'a new save has 1%, the level-5 hood brings it to 6%');
assert(getLuckRewardPercent({ ...base, player: { ...base.player, base: { ...base.player.base, luck: 99 } } }) === LUCK_REWARD_PERCENT_CAP,
  'the luck bonus is capped');

// Hard and inferno enemy multipliers are calibrated per chapter (balance:calibrate-protocols): hard is always
// above standard, inferno above hard, and every inferno tier past the first adds 15% to all enemy stats.
for (const dungeonId of DUNGEON_ORDER) {
  const hard = getRunProtocolDefinition(dungeonId, 'imprint')!.modifiers.enemyStatMultiplierPercent;
  const inferno = getRunProtocolDefinition(dungeonId, 'deep')!.modifiers.enemyStatMultiplierPercent;
  assert(hard > 100 && inferno > hard, `${dungeonId}: standard < hard (${hard}) < inferno (${inferno})`);
}
assert([1, 2, 5].map((tier) => getInfernoTierModifiers(tier).enemyStatMultiplierPercent).join(',') === '100,115,160',
  'inferno tiers 1, 2 and 5 scale enemies by 100%, 115% and 160%');
