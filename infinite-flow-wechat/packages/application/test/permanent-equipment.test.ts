import {
  createInitialState,
  evaluateEquipmentRollCandidate,
  getDerivedStats,
  getRunLootSecurityStatus,
  resolveEquipmentLoot,
  resolveExit,
  resolveRetreat,
  resolveRunFailure,
  type EquipmentId,
  type GameState
} from '@infinite-flow/core';
import type { EquipmentRoll } from '@infinite-flow/core/equipment-rolls';
import { getInfernoTierModifiers } from '@infinite-flow/core/inferno-system';
import { settleRunLoot } from '@infinite-flow/core/run-economy';
import { reduceGameCommand, type GameCommand } from '../src/index.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function committed(state: GameState, command: GameCommand): GameState {
  const before = JSON.stringify(state);
  const result = reduceGameCommand(state, command);
  assert(result.status === 'committed', `${command.type}: fixture must commit`);
  assert(JSON.stringify(state) === before, `${command.type}: preserve the input state`);
  return result.state;
}

function exploring(): GameState {
  return committed(createInitialState(), {
    type: 'run/enter', dungeonId: 'demon_tower_1', protocolId: 'standard',
    seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_abcd }
  });
}

function pending(state: GameState, equipmentId: EquipmentId, roll?: EquipmentRoll): GameState {
  assert(state.run, 'loot fixture must have an active run');
  return {
    ...state,
    run: {
      ...state.run,
      pendingEquipmentOffer: {
        offerId: `test-${state.run.lootOffersMade}-${equipmentId}`,
        equipmentIds: [equipmentId],
        ...(roll === undefined ? {} : { equipmentRolls: { [equipmentId]: roll } })
      }
    }
  };
}

function claim(state: GameState, equipmentId: EquipmentId): GameState {
  return committed(state, { type: 'node/resolve-equipment-loot', equipmentId });
}

function armorRoll(maxHp: number, defense: number, seed: number): EquipmentRoll {
  return {
    rulesVersion: 1, sourceTier: 3, seed, itemPower: 3_000 + maxHp,
    quality: 'rare',
    affixes: [
      { stat: 'maxHp', value: maxHp, minimum: 1, maximum: maxHp, greater: false },
      { stat: 'defense', value: defense, minimum: 1, maximum: defense, greater: false }
    ]
  };
}

function atExit(state: GameState): GameState {
  assert(state.run, 'exit fixture must have a run');
  return {
    ...state,
    phase: 'explore',
    combat: undefined,
    run: {
      ...state.run,
      currentNodeId: 'tower_exit',
      clearedNodeIds: ['fog_lesser_demon', 'bone_lane_monster']
    }
  };
}

const entered = exploring();
assert(entered.run, 'entry fixture has a run');
const beforeClaim: GameState = {
  ...entered,
  player: { ...entered.player, hp: 13 },
  run: {
    ...entered.run,
    lootBag: { rewardPoints: 37, lingyun: 0, items: { demon_bone: 2 }, equipmentIds: [] },
    damageTaken: 19,
    usedItems: ['healing_pill'],
    eventLog: ['test-run-event']
  }
};
const offered = pending(beforeClaim, 'spirit_robe');
const acquired = claim(offered, 'spirit_robe');
assert(acquired.run, 'claimed equipment keeps the active run');
assert(acquired.ownedEquipment.includes('spirit_robe') && acquired.equipmentLevels.spirit_robe === 1,
  'claim grants permanent ownership at level one immediately');
assert(acquired.run?.permanentlyOwnedEquipmentIds?.includes('spirit_robe'),
  'claim records that this carried equipment was already made permanent');
assert(acquired.run.lootBag.equipmentIds.includes('spirit_robe') && !acquired.run.pendingEquipmentOffer,
  'claim retains the run equipment record and clears its pending offer');
assert(acquired.run.lootBag.rewardPoints === 37 && acquired.run.lootBag.items.demon_bone === 2,
  'claim preserves the other carried rewards');
assert(acquired.run.damageTaken === 19 && acquired.run.usedItems[0] === 'healing_pill'
  && acquired.run.eventLog[0] === 'test-run-event', 'claim preserves the run history');
assert(JSON.stringify(acquired.equipped) === JSON.stringify(offered.equipped) && acquired.player.hp === 13,
  'claim does not equip or heal the player');

const duplicateClaim = reduceGameCommand(acquired, { type: 'node/resolve-equipment-loot', equipmentId: 'spirit_robe' });
assert(duplicateClaim.status === 'rejected' && duplicateClaim.state === acquired
  && duplicateClaim.events.length === 0, 'repeating a resolved offer cannot acquire or reward again');

// Manual equipping is available in the hub and exploration, and cannot manufacture HP.
const explorationEquipped = committed(acquired, { type: 'hub/equip-equipment', equipmentId: 'spirit_robe' });
assert(explorationEquipped.equipped.armor === 'spirit_robe'
  && explorationEquipped.player.maxHp === getDerivedStats(explorationEquipped).maxHp,
  'exploration can equip a just-acquired permanent item with its actual maximum HP');
assert(explorationEquipped.player.maxHp > acquired.player.maxHp && explorationEquipped.player.hp === 13,
  'a larger maximum HP keeps current HP unchanged');
const fullLargerArmor: GameState = {
  ...explorationEquipped,
  player: { ...explorationEquipped.player, hp: explorationEquipped.player.maxHp }
};
const smallerArmor = committed(fullLargerArmor, { type: 'hub/equip-equipment', equipmentId: 'patched_coat' });
assert(smallerArmor.player.maxHp < fullLargerArmor.player.maxHp
  && smallerArmor.player.hp === smallerArmor.player.maxHp, 'a smaller maximum HP clamps excess current HP');
const largerAgain = committed(smallerArmor, { type: 'hub/equip-equipment', equipmentId: 'spirit_robe' });
assert(largerAgain.player.hp === smallerArmor.player.hp
  && largerAgain.player.hp < largerAgain.player.maxHp, 'switching back to larger armor cannot restore lost HP');
const hubEquipped = committed({ ...acquired, phase: 'hub', run: undefined },
  { type: 'hub/equip-equipment', equipmentId: 'spirit_robe' });
assert(hubEquipped.equipped.armor === 'spirit_robe' && hubEquipped.player.hp === 13,
  'hub equipping also preserves current HP');
for (const phase of ['combat', 'result'] as const) {
  const unavailable: GameState = { ...acquired, phase };
  const result = reduceGameCommand(unavailable, { type: 'hub/equip-equipment', equipmentId: 'spirit_robe' });
  assert(result.status === 'rejected' && result.reason.code === 'invalid-phase'
    && result.state === unavailable && result.events.length === 0, `${phase} rejects equipment switching without mutation`);
}

// Permanent equipment survives every result even when the carried rewards are lost.
assert(getRunLootSecurityStatus(explorationEquipped).enabled
  && !getRunLootSecurityStatus(explorationEquipped).secured,
  'the interruption fixture uses modern rewards before its carried rewards are secured');
const exitCases = [
  ['retreat', resolveRetreat(explorationEquipped)],
  ['failure', resolveRunFailure(explorationEquipped)],
  ['clear', committed(atExit(explorationEquipped), { type: 'run/resolve-exit' })]
] as const;
for (const [label, settled] of exitCases) {
  assert(settled.phase === 'result' && settled.run?.lastLootSettlement, `${label} performs ordinary run settlement`);
  assert(settled.ownedEquipment.includes('spirit_robe') && settled.equipmentLevels.spirit_robe === 1,
    `${label} retains the permanently owned level-one equipment`);
  assert(settled.run.lastLootSettlement.retained.equipmentIds.includes('spirit_robe')
    && !settled.run.lastLootSettlement.lost.equipmentIds.includes('spirit_robe'),
    `${label} reports permanent equipment as retained, never lost`);
  assert(JSON.stringify(settled.equipped) === JSON.stringify(explorationEquipped.equipped),
    `${label} preserves the equipment manually selected during exploration`);
  if (label !== 'clear') {
    assert(settled.run.lastLootSettlement.retained.rewardPoints === 0
      && settled.run.lastLootSettlement.lost.rewardPoints === 37,
      `${label} still loses unsecured modern reward points while retaining equipment`);
  }
}

const ordinaryBag = { rewardPoints: 100, lingyun: 2, items: { demon_bone: 2 }, equipmentIds: ['spirit_robe'] };
const ordinaryRetreat = settleRunLoot(ordinaryBag, 'retreated');
assert(ordinaryRetreat.retained.rewardPoints === 50 && ordinaryRetreat.lost.rewardPoints === 50
  && ordinaryRetreat.retained.lingyun === 1 && ordinaryRetreat.lost.lingyun === 1
  && ordinaryRetreat.retained.items.demon_bone === 1 && ordinaryRetreat.lost.items.demon_bone === 1,
  'ordinary retreat still retains half of reward points and stackable supplies');
const ordinaryFailure = settleRunLoot(ordinaryBag, 'failed');
assert(ordinaryFailure.retained.rewardPoints === 20 && ordinaryFailure.lost.rewardPoints === 80
  && ordinaryFailure.retained.lingyun === 0 && ordinaryFailure.lost.lingyun === 2
  && ordinaryFailure.retained.items.demon_bone === undefined && ordinaryFailure.lost.items.demon_bone === 2,
  'ordinary failure still retains twenty percent of points and none of its stackable supplies');
for (const settlement of [ordinaryRetreat, ordinaryFailure]) {
  assert(settlement.retained.equipmentIds.includes('spirit_robe') && settlement.lost.equipmentIds.length === 0,
    'ordinary interruption retains permanent equipment independently of reward and supply ratios');
}

// New offers of the same material still compare their rolls after the run marker is set.
const weaker = armorRoll(20, 3, 31);
const stronger = armorRoll(80, 12, 32);
const firstRolled = claim(pending(exploring(), 'spirit_robe', weaker), 'spirit_robe');
assert(firstRolled.ownedEquipment.includes('spirit_robe') && firstRolled.equipmentLevels.spirit_robe === 1
  && firstRolled.equipmentRolls?.spirit_robe === weaker, 'a new inferno item owns its selected roll immediately');
assert(firstRolled.run?.carriedEquipmentRolls?.spirit_robe === weaker,
  'a new inferno item retains the carried roll for its run record');
const leveled: GameState = { ...firstRolled, equipmentLevels: { ...firstRolled.equipmentLevels, spirit_robe: 2 } };
assert(evaluateEquipmentRollCandidate(leveled, 'spirit_robe', stronger).comparison > 0,
  'the stronger-roll fixture must improve real equipment power');
const upgraded = claim(pending(leveled, 'spirit_robe', stronger), 'spirit_robe');
assert(upgraded.equipmentRolls?.spirit_robe === stronger && upgraded.equipmentLevels.spirit_robe === 2,
  'a stronger same-material offer updates permanent rolls immediately without resetting levels');
assert(upgraded.run?.carriedEquipmentRolls?.spirit_robe === stronger
  && upgraded.run.lastEquipmentRollSettlement?.outcome === 'upgraded', 'stronger rolls retain their run record and decision');
assert(evaluateEquipmentRollCandidate(upgraded, 'spirit_robe', weaker).comparison < 0,
  'the weaker-roll fixture must lose the real equipment power comparison');
const beforeSalvagePoints = upgraded.rewardPoints;
const beforeSalvageBagPoints = upgraded.run.lootBag.rewardPoints;
const salvaged = claim(pending(upgraded, 'spirit_robe', weaker), 'spirit_robe');
const salvagePoints = getInfernoTierModifiers(weaker.sourceTier).duplicateSalvageRewardPoints;
assert(salvaged.equipmentRolls?.spirit_robe === stronger && salvaged.equipmentLevels.spirit_robe === 2,
  'a weaker same-material roll preserves the permanent stronger roll and level');
assert(salvaged.rewardPoints === beforeSalvagePoints + salvagePoints
  && salvaged.run?.lootBag.rewardPoints === beforeSalvageBagPoints + salvagePoints,
  'weaker rolls immediately add their salvage points to the balance and the unsettled bag');
assert(salvaged.run.lastEquipmentRollSettlement?.outcome === 'salvaged'
  && salvaged.run.carriedEquipmentRolls?.spirit_robe === weaker
  && salvaged.run.lootBag.equipmentIds.filter(id => id === 'spirit_robe').length === 1,
  'weaker rolls preserve the latest run roll and a single equipment record');
assert(JSON.stringify(salvaged.equipped) === JSON.stringify(firstRolled.equipped),
  'inferno acquisition and roll replacement never auto-equip');
const repeatedSalvage = reduceGameCommand(salvaged, { type: 'node/resolve-equipment-loot', equipmentId: 'spirit_robe' });
assert(repeatedSalvage.status === 'rejected' && repeatedSalvage.state === salvaged,
  'repeating the same weaker-roll claim does not issue another salvage reward');
const directRepeated = resolveEquipmentLoot(salvaged, 'spirit_robe');
assert(directRepeated.rewardPoints === salvaged.rewardPoints
  && JSON.stringify(directRepeated.run?.lootBag) === JSON.stringify(salvaged.run.lootBag),
  'direct core repetition also preserves all rewards');

const oldBag = exploring();
assert(oldBag.run, 'legacy same-material fixture has an active run');
const oldStrongRoll: GameState = {
  ...oldBag,
  run: {
    ...oldBag.run,
    lootBag: { ...oldBag.run.lootBag, equipmentIds: ['spirit_robe'] },
    carriedEquipmentRolls: { spirit_robe: stronger },
    permanentlyOwnedEquipmentIds: undefined
  }
};
const newOfferOverOldBag = claim(pending(oldStrongRoll, 'spirit_robe', weaker), 'spirit_robe');
assert(newOfferOverOldBag.equipmentRolls?.spirit_robe === stronger
  && newOfferOverOldBag.run?.carriedEquipmentRolls?.spirit_robe === weaker,
  'claim promotes an old same-material carried roll before replacing its run record');
assert(newOfferOverOldBag.rewardPoints === oldStrongRoll.rewardPoints + salvagePoints,
  'the new weaker roll is salvaged once against the old promoted roll');

// A carried roll was already decided at claim time; settlement must not compare or salvage it again.
assert(salvaged.run, 'rolled fixture retains its run');
const rolledEquipped = committed(salvaged, { type: 'hub/equip-equipment', equipmentId: 'spirit_robe' });
assert(rolledEquipped.run, 'manual rolled equipment keeps the active run');
const noCarriedRoll: GameState = { ...rolledEquipped, run: { ...rolledEquipped.run, carriedEquipmentRolls: {} } };
const rollSettlementCases = [
  ['retreat', resolveRetreat(rolledEquipped), resolveRetreat(noCarriedRoll)],
  ['failure', resolveRunFailure(rolledEquipped), resolveRunFailure(noCarriedRoll)],
  ['clear', resolveExit(atExit(rolledEquipped)), resolveExit(atExit(noCarriedRoll))]
] as const;
for (const [label, settled, control] of rollSettlementCases) {
  assert(settled.phase === 'result' && settled.rewardPoints === control.rewardPoints,
    `${label} adds no second salvage reward for the carried roll`);
  assert(settled.equipmentRolls?.spirit_robe === stronger && settled.equipmentLevels.spirit_robe === 2,
    `${label} preserves the roll chosen before settlement`);
  assert(JSON.stringify(settled.equipped) === JSON.stringify(rolledEquipped.equipped),
    `${label} keeps the manually selected loadout`);
}
