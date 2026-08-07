import { describe, expect, it } from 'vitest';
import {
  compareEquipmentRolls,
  createEquipmentRoll,
  getEquipmentRollPowerBounds,
  getEquipmentRollScore,
  getEquipmentRolledBaseStats,
  isEquipmentRoll,
  sanitizeEquipmentRollMap
} from './equipment-rolls';

describe('equipment rolls', () => {
  it('creates a deterministic, serializable roll from the run seed', () => {
    const input = {
      equipmentId: 'armor_piercing_sword' as const,
      slot: 'weapon' as const,
      base: { attack: 9, speed: 1 },
      sourceTier: 7,
      seed: 20260728
    };
    const first = createEquipmentRoll(input);
    const second = createEquipmentRoll(input);

    expect(first).toEqual(second);
    expect(isEquipmentRoll(JSON.parse(JSON.stringify(first)))).toBe(true);
    expect(first.affixes.map((affix) => affix.stat)).toEqual(['attack', 'speed']);
  });

  it('keeps increasing the roll floor without imposing a maximum inferno layer', () => {
    expect(getEquipmentRollPowerBounds(2).minimumPercent)
      .toBeGreaterThan(getEquipmentRollPowerBounds(1).minimumPercent);
    expect(getEquipmentRollPowerBounds(10_000).minimumPercent)
      .toBeGreaterThan(getEquipmentRollPowerBounds(1_000).minimumPercent);
  });

  it('compares actual rolled value before using source layer as a tiebreaker', () => {
    const lower = createEquipmentRoll({
      equipmentId: 'guardian_plate',
      slot: 'armor',
      base: { maxHp: 24, defense: 5 },
      sourceTier: 2,
      seed: 11
    });
    const higher = createEquipmentRoll({
      equipmentId: 'guardian_plate',
      slot: 'armor',
      base: { maxHp: 24, defense: 5 },
      sourceTier: 3,
      seed: 12
    });

    expect(compareEquipmentRolls(higher, lower))
      .toBe(getEquipmentRollScore(higher) - getEquipmentRollScore(lower));
    expect(getEquipmentRolledBaseStats({ maxHp: 24, defense: 5 }, higher)).toMatchObject({
      maxHp: higher.affixes.find(({ stat }) => stat === 'maxHp')?.value,
      defense: higher.affixes.find(({ stat }) => stat === 'defense')?.value
    });
  });

  it('keeps a stronger lower-layer roll instead of blindly replacing it by source tier', () => {
    const strongerLowerLayer = {
      rulesVersion: 1,
      seed: 1,
      sourceTier: 1,
      itemPower: 1_120,
      quality: 'rare',
      affixes: [
        { stat: 'maxHp', value: 29, minimum: 20, maximum: 30, greater: false },
        { stat: 'defense', value: 9, minimum: 4, maximum: 10, greater: false }
      ]
    } as const;
    const weakerHigherLayer = {
      rulesVersion: 1,
      seed: 2,
      sourceTier: 2,
      itemPower: 2_105,
      quality: 'rare',
      affixes: [
        { stat: 'maxHp', value: 28, minimum: 21, maximum: 31, greater: false },
        { stat: 'defense', value: 8, minimum: 5, maximum: 11, greater: false }
      ]
    } as const;

    expect(strongerLowerLayer.affixes.map(({ value }) => value)).toEqual([29, 9]);
    expect(weakerHigherLayer.affixes.map(({ value }) => value)).toEqual([28, 8]);
    expect(compareEquipmentRolls(weakerHigherLayer, strongerLowerLayer)).toBeLessThan(0);
  });

  it('drops malformed saved entries while retaining valid rolls', () => {
    const roll = createEquipmentRoll({
      equipmentId: 'plain_charm',
      slot: 'charm',
      base: { artPower: 1 },
      sourceTier: 1,
      seed: 9
    });

    expect(sanitizeEquipmentRollMap({
      plain_charm: roll,
      bad: { ...roll, sourceTier: 0 }
    })).toEqual({ plain_charm: roll });
  });
});
