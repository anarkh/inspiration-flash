import { describe, expect, it } from 'vitest';

import {
  EQUIPMENT_RELIC_CONDUITS,
  getActiveEquipmentRelicConduits,
  getEquipmentRelicConduitByEquipmentId,
  getEquipmentRelicConduitFrameMatch,
  type RelicConduitEquipmentId
} from './equipment-relic-conduits';
import { EQUIPMENT, type EquipmentId, type EquipmentSlot } from './game';

const BASIC_EQUIPMENT = {
  weapon: 'training_blade',
  head: 'patched_headwrap',
  armor: 'patched_coat',
  hands: 'patched_gloves',
  feet: 'patched_boots',
  waist: 'patched_belt',
  charm: 'plain_charm'
} as const satisfies Record<EquipmentSlot, EquipmentId>;

const EXPECTED_CONDUITS = [
  {
    equipmentId: 'armor_piercing_sword',
    sourceSlot: 'weapon',
    frameId: 'assault',
    minimumLevel: 2
  },
  {
    equipmentId: 'starforged_edge',
    sourceSlot: 'weapon',
    frameId: 'assault',
    minimumLevel: 2
  },
  {
    equipmentId: 'spirit_robe',
    sourceSlot: 'armor',
    frameId: 'bulwark',
    minimumLevel: 2
  },
  {
    equipmentId: 'guardian_plate',
    sourceSlot: 'armor',
    frameId: 'bulwark',
    minimumLevel: 2
  },
  {
    equipmentId: 'cloudstep_boots',
    sourceSlot: 'feet',
    frameId: 'wayfinder',
    minimumLevel: 2
  },
  {
    equipmentId: 'void_lantern',
    sourceSlot: 'charm',
    frameId: 'wayfinder',
    minimumLevel: 2
  }
] as const;

describe('equipment relic conduits', () => {
  it('keeps the catalog complete, unique, slot-aligned, and immutable', () => {
    expect(EQUIPMENT_RELIC_CONDUITS).toEqual(EXPECTED_CONDUITS);
    expect(EQUIPMENT_RELIC_CONDUITS).toHaveLength(6);
    expect(new Set(EQUIPMENT_RELIC_CONDUITS.map(({ equipmentId }) => equipmentId)).size).toBe(6);
    expect(Object.isFrozen(EQUIPMENT_RELIC_CONDUITS)).toBe(true);

    for (const definition of EQUIPMENT_RELIC_CONDUITS) {
      expect(getEquipmentRelicConduitByEquipmentId(definition.equipmentId)).toBe(definition);
      expect(EQUIPMENT[definition.equipmentId].slot).toBe(definition.sourceSlot);
      expect(Object.isFrozen(definition)).toBe(true);
    }

    const catalogEquipmentIds = (Object.keys(EQUIPMENT) as EquipmentId[]).filter(
      (equipmentId) => getEquipmentRelicConduitByEquipmentId(equipmentId) !== undefined
    );
    expect(new Set(catalogEquipmentIds)).toEqual(
      new Set(EXPECTED_CONDUITS.map(({ equipmentId }) => equipmentId))
    );
    expect(getEquipmentRelicConduitByEquipmentId('training_blade')).toBeUndefined();
  });

  it('does not activate unequipped, missing-level, or level-one conduits', () => {
    const allConduitsAtLevelTwo = Object.fromEntries(
      EXPECTED_CONDUITS.map(({ equipmentId }) => [equipmentId, 2])
    ) as Partial<Record<EquipmentId, number>>;
    const equippedAtLevelOne = {
      ...BASIC_EQUIPMENT,
      weapon: 'armor_piercing_sword',
      armor: 'spirit_robe',
      feet: 'cloudstep_boots',
      charm: 'void_lantern'
    } as const satisfies Record<EquipmentSlot, EquipmentId>;

    expect(getActiveEquipmentRelicConduits(BASIC_EQUIPMENT, allConduitsAtLevelTwo)).toEqual([]);
    expect(getActiveEquipmentRelicConduits(equippedAtLevelOne)).toEqual([]);
    expect(
      getActiveEquipmentRelicConduits(equippedAtLevelOne, {
        armor_piercing_sword: 1,
        spirit_robe: 1,
        cloudstep_boots: 1,
        void_lantern: 1
      })
    ).toEqual([]);
  });

  it('activates only equipped conduits at level two or above', () => {
    const equipped = {
      ...BASIC_EQUIPMENT,
      weapon: 'armor_piercing_sword',
      armor: 'spirit_robe',
      feet: 'cloudstep_boots',
      charm: 'void_lantern'
    } as const satisfies Record<EquipmentSlot, EquipmentId>;
    const equipmentLevels = {
      armor_piercing_sword: 2,
      spirit_robe: 3,
      cloudstep_boots: 2,
      void_lantern: 2
    } as const satisfies Partial<Record<EquipmentId, number>>;

    expect(getActiveEquipmentRelicConduits(equipped, equipmentLevels).map(({ equipmentId }) => equipmentId)).toEqual([
      'armor_piercing_sword',
      'spirit_robe',
      'cloudstep_boots',
      'void_lantern'
    ]);
  });

  it('respects mutually exclusive slots and ignores conduit ids placed in the wrong slots', () => {
    const equipped = {
      ...BASIC_EQUIPMENT,
      weapon: 'starforged_edge',
      head: 'armor_piercing_sword',
      armor: 'guardian_plate',
      hands: 'spirit_robe'
    } as const satisfies Record<EquipmentSlot, EquipmentId>;
    const equipmentLevels = {
      armor_piercing_sword: 2,
      starforged_edge: 2,
      spirit_robe: 2,
      guardian_plate: 2
    } as const satisfies Partial<Record<EquipmentId, number>>;

    expect(getActiveEquipmentRelicConduits(equipped, equipmentLevels).map(({ equipmentId }) => equipmentId)).toEqual([
      'starforged_edge',
      'guardian_plate'
    ]);
  });

  it('deduplicates the frame bonus while retaining every matching source for the UI', () => {
    const equipped = {
      ...BASIC_EQUIPMENT,
      feet: 'cloudstep_boots',
      charm: 'void_lantern'
    } as const satisfies Record<EquipmentSlot, EquipmentId>;
    const activeConduits = getActiveEquipmentRelicConduits(equipped, {
      cloudstep_boots: 2,
      void_lantern: 2
    });

    expect(getEquipmentRelicConduitFrameMatch('wayfinder', activeConduits)).toEqual({
      frameId: 'wayfinder',
      matched: true,
      extraCandidateCount: 1,
      sourceEquipmentIds: ['cloudstep_boots', 'void_lantern']
    });
    expect(getEquipmentRelicConduitFrameMatch('assault', activeConduits)).toEqual({
      frameId: 'assault',
      matched: false,
      extraCandidateCount: 0,
      sourceEquipmentIds: []
    });
  });

  it('returns stable fresh results without mutating inputs or exposing catalog arrays', () => {
    const equipped = {
      ...BASIC_EQUIPMENT,
      weapon: 'armor_piercing_sword',
      armor: 'guardian_plate',
      feet: 'cloudstep_boots',
      charm: 'void_lantern'
    } as const satisfies Record<EquipmentSlot, EquipmentId>;
    const equipmentLevels = {
      void_lantern: 2,
      cloudstep_boots: 2,
      guardian_plate: 2,
      armor_piercing_sword: 2
    } as const satisfies Partial<Record<EquipmentId, number>>;
    const equippedSnapshot = { ...equipped };
    const levelsSnapshot = { ...equipmentLevels };

    const first = getActiveEquipmentRelicConduits(equipped, equipmentLevels);
    const second = getActiveEquipmentRelicConduits(equipped, equipmentLevels);
    expect(first).not.toBe(second);
    expect(first.map(({ equipmentId }) => equipmentId)).toEqual([
      'armor_piercing_sword',
      'guardian_plate',
      'cloudstep_boots',
      'void_lantern'
    ]);

    first.reverse();
    expect(getActiveEquipmentRelicConduits(equipped, equipmentLevels)).toEqual(second);
    const firstMatch = getEquipmentRelicConduitFrameMatch('wayfinder', [...second].reverse());
    const secondMatch = getEquipmentRelicConduitFrameMatch('wayfinder', second);
    expect(firstMatch.sourceEquipmentIds).toEqual(['cloudstep_boots', 'void_lantern']);
    expect(firstMatch.sourceEquipmentIds).not.toBe(secondMatch.sourceEquipmentIds);

    (firstMatch.sourceEquipmentIds as RelicConduitEquipmentId[]).reverse();
    expect(getEquipmentRelicConduitFrameMatch('wayfinder', second).sourceEquipmentIds).toEqual([
      'cloudstep_boots',
      'void_lantern'
    ]);
    expect(equipped).toEqual(equippedSnapshot);
    expect(equipmentLevels).toEqual(levelsSnapshot);
    expect(EQUIPMENT_RELIC_CONDUITS).toEqual(EXPECTED_CONDUITS);
  });
});
