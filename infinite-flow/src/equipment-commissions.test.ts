import { describe, expect, it } from 'vitest';

import {
  EQUIPMENT_COMMISSION_COST,
  EQUIPMENT_COMMISSION_MATERIAL_REWARD,
  EQUIPMENT_COMMISSION_REQUIRED_DUNGEONS,
  advanceEquipmentCommission,
  createEquipmentCommission,
  isEquipmentCommissionSealed,
  normalizeEquipmentCommission,
  type EquipmentCommissionState,
  type EquipmentCommissionValidators
} from './equipment-commissions';
import {
  DUNGEONS,
  EQUIPMENT,
  ITEMS,
  type DungeonId as GameDungeonId,
  type EquipmentId as GameEquipmentId,
  type ItemId as GameItemId
} from './game';

type EquipmentId = 'blade' | 'robe' | 'boots';
type ItemId = 'star_iron' | 'rift_dust';
type DungeonId = 'tower' | 'mine' | 'vault' | 'archive';

const validators: EquipmentCommissionValidators<EquipmentId, ItemId, DungeonId> = {
  isEquipmentId: (value): value is EquipmentId =>
    value === 'blade' || value === 'robe' || value === 'boots',
  isItemId: (value): value is ItemId => value === 'star_iron' || value === 'rift_dust',
  isDungeonId: (value): value is DungeonId =>
    value === 'tower' || value === 'mine' || value === 'vault' || value === 'archive'
};

function createCommission(): EquipmentCommissionState<EquipmentId, ItemId, DungeonId> {
  return createEquipmentCommission<EquipmentId, ItemId, DungeonId>(
    ['blade', 'robe'],
    'star_iron'
  );
}

function requireCommission(
  commission: EquipmentCommissionState<EquipmentId, ItemId, DungeonId> | undefined
): EquipmentCommissionState<EquipmentId, ItemId, DungeonId> {
  expect(commission).toBeDefined();
  if (commission === undefined) throw new Error('Expected an active equipment commission.');
  return commission;
}

describe('equipment commissions', () => {
  it('exports the fixed cost, progress requirement, and material reward', () => {
    expect(EQUIPMENT_COMMISSION_COST).toEqual({ rewardPoints: 300, lingyun: 1 });
    expect(EQUIPMENT_COMMISSION_REQUIRED_DUNGEONS).toBe(3);
    expect(EQUIPMENT_COMMISSION_MATERIAL_REWARD).toBe(2);
  });

  it('creates a canonical commission from copied equipment IDs', () => {
    const equipmentIds: [EquipmentId, EquipmentId] = ['blade', 'robe'];
    const commission = createEquipmentCommission<EquipmentId, ItemId, DungeonId>(
      equipmentIds,
      'star_iron'
    );

    expect(commission).toEqual({
      rulesVersion: 1,
      equipmentIds: ['blade', 'robe'],
      targetMaterialId: 'star_iron',
      completedDungeonIds: []
    });
    expect(commission.equipmentIds).not.toBe(equipmentIds);
    equipmentIds[0] = 'boots';
    expect(commission.equipmentIds).toEqual(['blade', 'robe']);
    expect(() =>
      createEquipmentCommission<EquipmentId, ItemId, DungeonId>(
        ['blade', 'blade'],
        'star_iron'
      )
    ).toThrow(TypeError);
  });

  it('reports only the two active sealed equipment IDs', () => {
    const commission = createCommission();

    expect(isEquipmentCommissionSealed(commission, 'blade')).toBe(true);
    expect(isEquipmentCommissionSealed(commission, 'robe')).toBe(true);
    expect(isEquipmentCommissionSealed(commission, 'boots')).toBe(false);
    expect(isEquipmentCommissionSealed(undefined, 'blade')).toBe(false);
  });

  it('advances distinct dungeons without mutating earlier states', () => {
    const initial = createCommission();
    const first = advanceEquipmentCommission(initial, 'tower');
    const firstCommission = requireCommission(first.commission);
    expect(first).toEqual({
      commission: {
        ...initial,
        equipmentIds: ['blade', 'robe'],
        completedDungeonIds: ['tower']
      },
      completedDungeonIds: ['tower'],
      advanced: true,
      completed: false
    });
    expect(initial.completedDungeonIds).toEqual([]);

    const second = advanceEquipmentCommission(firstCommission, 'mine');
    const secondCommission = requireCommission(second.commission);
    expect(second.completedDungeonIds).toEqual(['tower', 'mine']);
    expect(second.advanced).toBe(true);
    expect(second.completed).toBe(false);
    expect(firstCommission.completedDungeonIds).toEqual(['tower']);

    const third = advanceEquipmentCommission(secondCommission, 'vault');
    expect(third).toEqual({
      completedDungeonIds: ['tower', 'mine', 'vault'],
      advanced: true,
      completed: true
    });
    expect('commission' in third).toBe(false);
    expect(secondCommission.completedDungeonIds).toEqual(['tower', 'mine']);
  });

  it('keeps duplicate dungeon progress as an identity-preserving no-op', () => {
    const first = advanceEquipmentCommission(createCommission(), 'tower');
    const commission = requireCommission(first.commission);
    const duplicate = advanceEquipmentCommission(commission, 'tower');

    expect(duplicate).toEqual({
      commission,
      completedDungeonIds: ['tower'],
      advanced: false,
      completed: false
    });
    expect(duplicate.commission).toBe(commission);
    expect(duplicate.completedDungeonIds).toBe(commission.completedDungeonIds);
  });

  it('normalizes valid saves into copied canonical state', () => {
    const input = {
      rulesVersion: 1,
      equipmentIds: ['blade', 'robe'],
      targetMaterialId: 'star_iron',
      completedDungeonIds: ['tower', 'mine'],
      ignoredLegacyField: true
    };
    const snapshot = structuredClone(input);
    const normalized = normalizeEquipmentCommission(input, validators);

    expect(normalized).toEqual({
      rulesVersion: 1,
      equipmentIds: ['blade', 'robe'],
      targetMaterialId: 'star_iron',
      completedDungeonIds: ['tower', 'mine']
    });
    expect(normalized).not.toBe(input);
    expect(normalized?.equipmentIds).not.toBe(input.equipmentIds);
    expect(normalized?.completedDungeonIds).not.toBe(input.completedDungeonIds);
    expect(input).toEqual(snapshot);
  });

  it('rejects malformed and unsupported active saves', () => {
    const valid = {
      rulesVersion: 1,
      equipmentIds: ['blade', 'robe'],
      targetMaterialId: 'star_iron',
      completedDungeonIds: ['tower']
    };
    const malformedValues: unknown[] = [
      undefined,
      null,
      [],
      {},
      { ...valid, rulesVersion: 2 },
      { ...valid, equipmentIds: 'blade,robe' },
      { ...valid, equipmentIds: ['blade'] },
      { ...valid, equipmentIds: ['blade', 'robe', 'boots'] },
      { ...valid, equipmentIds: ['blade', 'blade'] },
      { ...valid, equipmentIds: ['blade', 'unknown'] },
      { ...valid, targetMaterialId: 'unknown' },
      { ...valid, completedDungeonIds: 'tower' },
      { ...valid, completedDungeonIds: ['unknown'] },
      { ...valid, completedDungeonIds: ['tower', 'tower'] },
      { ...valid, completedDungeonIds: ['tower', 'mine', 'vault'] },
      { ...valid, completedDungeonIds: ['tower', 'mine', 'vault', 'archive'] }
    ];

    for (const malformed of malformedValues) {
      expect(normalizeEquipmentCommission(malformed, validators)).toBeUndefined();
    }
  });

  it('accepts Tier-19 equipment and observation shards through the shared commission contract', () => {
    const gameValidators: EquipmentCommissionValidators<
      GameEquipmentId,
      GameItemId,
      GameDungeonId
    > = {
      isEquipmentId: (value): value is GameEquipmentId =>
        typeof value === 'string' && Object.prototype.hasOwnProperty.call(EQUIPMENT, value),
      isItemId: (value): value is GameItemId =>
        typeof value === 'string' && Object.prototype.hasOwnProperty.call(ITEMS, value),
      isDungeonId: (value): value is GameDungeonId =>
        typeof value === 'string' && Object.prototype.hasOwnProperty.call(DUNGEONS, value)
    };
    const commission = createEquipmentCommission<GameEquipmentId, GameItemId, GameDungeonId>(
      ['blindline_cutter', 'predictive_visor'],
      'observation_shard'
    );

    expect(normalizeEquipmentCommission(commission, gameValidators)).toEqual(commission);
    expect(isEquipmentCommissionSealed(commission, 'blindline_cutter')).toBe(true);
    expect(isEquipmentCommissionSealed(commission, 'predictive_visor')).toBe(true);
    expect(isEquipmentCommissionSealed(commission, 'matte_shell')).toBe(false);

    const first = advanceEquipmentCommission(commission, 'panopticon_city');
    if (!first.commission) throw new Error('Expected the Tier-19 commission to remain active.');
    const second = advanceEquipmentCommission(first.commission, 'combat_replay_stage');
    if (!second.commission) throw new Error('Expected the Tier-19 commission to remain active.');
    const third = advanceEquipmentCommission(second.commission, 'false_testimony_court');
    expect(third).toMatchObject({
      completedDungeonIds: ['panopticon_city', 'combat_replay_stage', 'false_testimony_court'],
      advanced: true,
      completed: true
    });
  });
});
