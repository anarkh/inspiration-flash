import { describe, expect, it } from 'vitest';

import {
  createInitialState,
  promoteRunEquipmentOwnership,
  type GameState
} from '@infinite-flow/core';
import type { EquipmentRoll } from '@infinite-flow/core/equipment-rolls';
import { decodeWebV1 } from '../src/index.js';

function attackRoll(seed: number, attack: number, sourceTier = 1): EquipmentRoll {
  return {
    rulesVersion: 1,
    seed,
    sourceTier,
    itemPower: sourceTier * 1_000 + attack,
    quality: 'rare',
    affixes: [
      {
        stat: 'attack',
        value: attack,
        minimum: attack,
        maximum: attack,
        greater: false
      }
    ]
  };
}

function legacyRunState(withCarriedRolls = false): GameState {
  const initial = createInitialState();
  return {
    ...initial,
    phase: 'explore',
    ownedEquipment: [...initial.ownedEquipment, 'bone_spear'],
    equipmentLevels: { ...initial.equipmentLevels, bone_spear: 3 },
    equipmentRolls: withCarriedRolls
      ? {
          training_blade: attackRoll(11, 40),
          bone_spear: attackRoll(12, 10)
        }
      : {},
    run: {
      dungeonId: 'demon_tower_1',
      currentNodeId: 'fog_lesser_demon',
      clearedNodeIds: ['watch_post_cache'],
      discoveredNodeIds: ['fog_lesser_demon', 'watch_post_cache'],
      captures: 0,
      capturedPetIds: [],
      usedItems: ['healing_pill'],
      damageTaken: 7,
      resolvedEventIds: ['old-run-event'],
      eventLog: ['旧本局已领取三件装备。'],
      lootBag: {
        rewardPoints: 70,
        lingyun: 1,
        items: { demon_bone: 2 },
        equipmentIds: ['armor_piercing_sword', 'bone_spear', 'training_blade']
      },
      lootOffersMade: 3,
      ...(withCarriedRolls
        ? {
            carriedEquipmentRolls: {
              armor_piercing_sword: attackRoll(21, 80),
              bone_spear: attackRoll(22, 50),
              training_blade: attackRoll(23, 10, 3)
            }
          }
        : {})
    }
  };
}

function decodeState(state: GameState): GameState {
  const result = decodeWebV1({
    kind: 'web-local-storage-text',
    text: JSON.stringify({ version: 1, state })
  });
  expect(result.status).toBe('decoded');
  if (result.status !== 'decoded') throw new Error(result.reason.message);
  return result.state;
}

function expectRunRecordsPreserved(actual: GameState, legacy: GameState): void {
  expect(actual.run?.carriedEquipmentRolls).toEqual(legacy.run?.carriedEquipmentRolls);
  expect(actual.run?.lootBag.equipmentIds).toEqual(legacy.run?.lootBag.equipmentIds);
  expect(actual.run?.lootBag.items).toEqual(legacy.run?.lootBag.items);
  expect(actual.run?.lootBag.lingyun).toBe(legacy.run?.lootBag.lingyun);
  expect(actual.run?.lootOffersMade).toBe(legacy.run?.lootOffersMade);
  expect(actual.run?.currentNodeId).toBe(legacy.run?.currentNodeId);
  expect(actual.run?.clearedNodeIds).toEqual(legacy.run?.clearedNodeIds);
  expect(actual.run?.usedItems).toEqual(legacy.run?.usedItems);
  expect(actual.run?.damageTaken).toBe(legacy.run?.damageTaken);
  expect(actual.run?.resolvedEventIds).toEqual(legacy.run?.resolvedEventIds);
  expect(actual.run?.eventLog).toEqual(legacy.run?.eventLog);
  expect(actual.equipped).toEqual(legacy.equipped);
}

describe('permanent equipment ownership for legacy run loot', () => {
  it('promotes unmarked loot-bag equipment at Lv1 without equipping or clearing run records', () => {
    const legacy = legacyRunState();
    const before = JSON.stringify(legacy);

    const promoted = promoteRunEquipmentOwnership(legacy);

    expect(promoted.ownedEquipment).toEqual([
      ...legacy.ownedEquipment,
      'armor_piercing_sword'
    ]);
    expect(promoted.equipmentLevels.armor_piercing_sword).toBe(1);
    expect(promoted.equipmentLevels.bone_spear).toBe(3);
    expect(promoted.run?.permanentlyOwnedEquipmentIds).toEqual(
      legacy.run?.lootBag.equipmentIds
    );
    expect(promoted.run?.lootBag).toEqual(legacy.run?.lootBag);
    expect(promoted.rewardPoints).toBe(legacy.rewardPoints);
    expectRunRecordsPreserved(promoted, legacy);
    expect(JSON.stringify(legacy)).toBe(before);
    expect(promoteRunEquipmentOwnership(promoted)).toEqual(promoted);
  });

  it('keeps stronger carried rolls and salvages a weaker owned roll once', () => {
    const legacy = legacyRunState(true);
    const before = JSON.stringify(legacy);

    const promoted = promoteRunEquipmentOwnership(legacy);

    expect(promoted.ownedEquipment).toEqual([
      ...legacy.ownedEquipment,
      'armor_piercing_sword'
    ]);
    expect(promoted.equipmentLevels.armor_piercing_sword).toBe(1);
    expect(promoted.equipmentLevels.bone_spear).toBe(3);
    expect(promoted.equipmentRolls?.armor_piercing_sword).toEqual(
      legacy.run?.carriedEquipmentRolls?.armor_piercing_sword
    );
    expect(promoted.equipmentRolls?.bone_spear).toEqual(
      legacy.run?.carriedEquipmentRolls?.bone_spear
    );
    expect(promoted.equipmentRolls?.training_blade).toEqual(
      legacy.equipmentRolls?.training_blade
    );
    // A tier-3 duplicate is worth 80 + 3 * 20 reward points.
    expect(promoted.rewardPoints).toBe(legacy.rewardPoints + 140);
    expect(promoted.run?.lootBag.rewardPoints).toBe(210);
    expect(promoted.run?.permanentlyOwnedEquipmentIds).toEqual(
      legacy.run?.lootBag.equipmentIds
    );
    expectRunRecordsPreserved(promoted, legacy);
    expect(JSON.stringify(legacy)).toBe(before);
    expect(promoteRunEquipmentOwnership(promoted)).toEqual(promoted);
  });

  it('does not process already marked loot-bag entries again', () => {
    const legacy = legacyRunState(true);
    if (!legacy.run) throw new Error('Expected a synthetic active run.');
    const marked: GameState = {
      ...legacy,
      run: {
        ...legacy.run,
        permanentlyOwnedEquipmentIds: ['bone_spear', 'training_blade']
      }
    };

    const promoted = promoteRunEquipmentOwnership(marked);

    expect(promoted.ownedEquipment).toContain('armor_piercing_sword');
    expect(promoted.equipmentRolls?.armor_piercing_sword).toEqual(
      legacy.run.carriedEquipmentRolls?.armor_piercing_sword
    );
    expect(promoted.equipmentRolls?.bone_spear).toEqual(legacy.equipmentRolls?.bone_spear);
    expect(promoted.equipmentRolls?.training_blade).toEqual(
      legacy.equipmentRolls?.training_blade
    );
    expect(promoted.rewardPoints).toBe(legacy.rewardPoints);
    expect(promoted.run?.lootBag.rewardPoints).toBe(70);
    expect(promoted.run?.permanentlyOwnedEquipmentIds).toEqual(
      expect.arrayContaining(legacy.run.lootBag.equipmentIds)
    );
    expect(promoteRunEquipmentOwnership(promoted)).toEqual(promoted);
  });

  it.each([false, true])(
    'restores old run ownership through Web v1 decode and survives a second restore (carried rolls: %s)',
    (withCarriedRolls) => {
      const legacy = legacyRunState(withCarriedRolls);

      const restored = decodeState(legacy);

      expect(restored.ownedEquipment).toEqual([
        ...legacy.ownedEquipment,
        'armor_piercing_sword'
      ]);
      expect(restored.equipmentLevels.armor_piercing_sword).toBe(1);
      expect(restored.equipmentLevels.bone_spear).toBe(3);
      expect(restored.run?.permanentlyOwnedEquipmentIds).toEqual(
        legacy.run?.lootBag.equipmentIds
      );
      expect(restored.rewardPoints).toBe(legacy.rewardPoints + (withCarriedRolls ? 140 : 0));
      expect(restored.run?.lootBag.rewardPoints).toBe(withCarriedRolls ? 210 : 70);
      if (withCarriedRolls) {
        expect(restored.equipmentRolls?.armor_piercing_sword).toEqual(
          legacy.run?.carriedEquipmentRolls?.armor_piercing_sword
        );
        expect(restored.equipmentRolls?.bone_spear).toEqual(
          legacy.run?.carriedEquipmentRolls?.bone_spear
        );
        expect(restored.equipmentRolls?.training_blade).toEqual(
          legacy.equipmentRolls?.training_blade
        );
      }
      expectRunRecordsPreserved(restored, legacy);

      const restoredAgain = decodeState(restored);

      expect(restoredAgain).toEqual(restored);
      expect(restoredAgain.ownedEquipment.filter((id) => id === 'armor_piercing_sword')).toHaveLength(1);
      expectRunRecordsPreserved(restoredAgain, legacy);
    }
  );
});
