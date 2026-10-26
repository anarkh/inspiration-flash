import {
  createInitialState, EQUIPMENT, getEquipmentSourceChapter, LINGYUN_EXCHANGE_BASE_PRICE, LINGYUN_EXCHANGE_PRICE_STEP,
  type EquipmentId, type GameState
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

function owning(equipmentId: EquipmentId, level: number): GameState {
  const state = rich();
  return { ...state, ownedEquipment: [...state.ownedEquipment, equipmentId], equipmentLevels: { ...state.equipmentLevels, [equipmentId]: level } };
}

function spent(before: GameState, after: GameState) {
  return { rewardPoints: before.rewardPoints - after.rewardPoints, lingyun: before.lingyun - after.lingyun };
}

// Gear prices grow 15% per chapter of the gear's first source; lingyun and materials stay the same.
const upgradable = (Object.keys(EQUIPMENT) as EquipmentId[]).filter(id => EQUIPMENT[id].maxLevel === 3);
const first = upgradable.find(id => getEquipmentSourceChapter(id) === 1)!;
const last = upgradable.find(id => getEquipmentSourceChapter(id) === 19)!;
assert(first && last, 'fixtures need gear first offered in chapters 1 and 19');
const upgradeCost = (id: EquipmentId, level: number) => {
  const before = owning(id, level);
  return spent(before, apply(before, { type: 'hub/upgrade-equipment', equipmentId: id }));
};
assert(upgradeCost(first, 1).rewardPoints === 220 && upgradeCost(first, 2).rewardPoints === 360, 'chapter 1 gear keeps its old prices');
assert(upgradeCost(last, 1).rewardPoints === 820 && upgradeCost(last, 2).rewardPoints === 1340,
  'chapter 19 gear costs 3.7 times as many points, rounded up to 10');
assert(upgradeCost(last, 2).lingyun === 1, 'the lingyun part of a price does not scale');

// Lingyun exchange: 1500 points, then 100 more for every later exchange, never capped.
let state = rich();
state = apply(state, { type: 'hub/exchange-lingyun' });
assert(state.rewardPoints === 100_000 - LINGYUN_EXCHANGE_BASE_PRICE && state.lingyun === 101 && state.lingyunExchangeCount === 1,
  'the first exchange costs the base price for 1 lingyun');
const second = apply(state, { type: 'hub/exchange-lingyun' });
assert(state.rewardPoints - second.rewardPoints === LINGYUN_EXCHANGE_BASE_PRICE + LINGYUN_EXCHANGE_PRICE_STEP && second.lingyunExchangeCount === 2,
  'each exchange raises the next price');
const poor = reduceGameCommand({ ...createInitialState(), rewardPoints: 1499 }, { type: 'hub/exchange-lingyun' });
assert(poor.status === 'rejected' && poor.reason.message.includes(String(LINGYUN_EXCHANGE_BASE_PRICE)), 'a short balance is refused with the price');
const malformed = apply({ ...rich(), lingyunExchangeCount: 'x' as unknown as number }, { type: 'hub/exchange-lingyun' });
assert(malformed.lingyunExchangeCount === 1 && rich().rewardPoints - malformed.rewardPoints === LINGYUN_EXCHANGE_BASE_PRICE,
  'a missing or malformed exchange count reads as 0');

// Material reforge: 5 of one chapter material become 1 cracked core or 1 cycle imprint; cores never melt.
const stocked: GameState = { ...rich(), inventory: { ...rich().inventory, entropy_crystal: 9, cracked_core: 0, cycle_imprint: 0 } };
const core = apply(stocked, { type: 'hub/reforge-material', materialId: 'entropy_crystal', targetId: 'cracked_core' });
assert(core.inventory.entropy_crystal === 4 && core.inventory.cracked_core === 1, 'five crystals melt into one cracked core');
const imprint = apply(stocked, { type: 'hub/reforge-material', materialId: 'entropy_crystal', targetId: 'cycle_imprint' });
assert(imprint.inventory.cycle_imprint === 1, 'the same batch can become a cycle imprint instead');
for (const [command, why] of [
  [{ type: 'hub/reforge-material', materialId: 'entropy_crystal', targetId: 'cracked_core' }, 'four left is not a batch'],
  [{ type: 'hub/reforge-material', materialId: 'cracked_core', targetId: 'cycle_imprint' }, 'a cracked core is a result, not an input'],
  [{ type: 'hub/reforge-material', materialId: 'healing_pill', targetId: 'cracked_core' }, 'supplies are not chapter materials'],
  [{ type: 'hub/reforge-material', materialId: 'entropy_crystal', targetId: 'healing_pill' }, 'only the two gear materials can be made']
] as const) {
  const from = why === 'four left is not a batch' ? core : stocked;
  assert(reduceGameCommand(from, command).status === 'rejected', why);
}
