import { describe, expect, it } from 'vitest';
import {
  addRunLoot,
  calculateRunEconomy,
  consumeRunLootItem,
  createEmptyRunLootBag,
  getRunLootItemCount,
  settleRunLoot,
  type RunEconomyInput,
  type RunLootBag
} from './run-economy';

const baseRun: Omit<RunEconomyInput, 'exitStatus'> = {
  baseRewardPoints: 1000,
  clearedNodes: 6,
  totalNodes: 6,
  damageTaken: 0,
  captures: 0,
  readiness: 'ready',
  dungeonTier: 3
};

function economy(overrides: Partial<RunEconomyInput> = {}) {
  return calculateRunEconomy({ ...baseRun, exitStatus: 'cleared', ...overrides });
}

describe('run economy', () => {
  it('classifies clean clears, normal clears, retreats, and recovered failures', () => {
    expect(economy({ exitStatus: 'cleared' }).outcome).toBe('clean_clear');
    expect(economy({ damageTaken: 26, exitStatus: 'cleared' }).outcome).toBe('normal_clear');
    expect(economy({ clearedNodes: 3, exitStatus: 'retreated' }).outcome).toBe('retreat');
    expect(economy({ clearedNodes: 3, exitStatus: 'failed' }).outcome).toBe('failed_recovered');
  });

  it('raises reward multipliers for more cleared nodes and higher-risk dungeon attempts', () => {
    const shallowRoute = economy({ clearedNodes: 2, damageTaken: 18, dungeonTier: 2, readiness: 'ready' });
    const deeperRoute = economy({ clearedNodes: 5, damageTaken: 18, dungeonTier: 2, readiness: 'ready' });
    const safeDungeon = economy({ clearedNodes: 4, damageTaken: 18, dungeonTier: 2, readiness: 'ready' });
    const riskyDungeon = economy({ clearedNodes: 4, damageTaken: 18, dungeonTier: 6, readiness: 'deadly' });

    expect(deeperRoute.rewardMultiplier).toBeGreaterThan(shallowRoute.rewardMultiplier);
    expect(deeperRoute.rewardPoints).toBeGreaterThan(shallowRoute.rewardPoints);
    expect(riskyDungeon.rewardMultiplier).toBeGreaterThan(safeDungeon.rewardMultiplier);
  });

  it('keeps recovered failures below normal clears while preserving a recovery floor', () => {
    const failed = economy({ clearedNodes: 0, damageTaken: 90, dungeonTier: 7, readiness: 'deadly', exitStatus: 'failed' });
    const normal = economy({ clearedNodes: 6, damageTaken: 90, dungeonTier: 7, readiness: 'deadly', exitStatus: 'cleared' });

    expect(failed.rewardMultiplier).toBeGreaterThanOrEqual(0.12);
    expect(failed.rewardPoints).toBeGreaterThan(0);
    expect(failed.rewardMultiplier).toBeLessThan(normal.rewardMultiplier);
    expect(failed.rewardPoints).toBeLessThan(normal.rewardPoints);
  });

  it('lets retreat keep partial earnings without beating a normal clear', () => {
    const failed = economy({ clearedNodes: 3, damageTaken: 42, exitStatus: 'failed' });
    const retreat = economy({ clearedNodes: 3, damageTaken: 42, exitStatus: 'retreated' });
    const normal = economy({ clearedNodes: 6, damageTaken: 42, exitStatus: 'cleared' });

    expect(retreat.rewardPoints).toBeGreaterThan(failed.rewardPoints);
    expect(retreat.rewardPoints).toBeGreaterThan(0);
    expect(retreat.rewardMultiplier).toBeLessThan(normal.rewardMultiplier);
  });

  it('adds capture score but caps capture-driven reward growth', () => {
    const noCapture = economy({ captures: 0, damageTaken: 20 });
    const oneCapture = economy({ captures: 1, damageTaken: 20 });
    const cappedCaptures = economy({ captures: 3, damageTaken: 20 });
    const excessiveCaptures = economy({ captures: 12, damageTaken: 20 });

    expect(oneCapture.score).toBeGreaterThan(noCapture.score);
    expect(cappedCaptures.score).toBeGreaterThan(oneCapture.score);
    expect(excessiveCaptures.rewardMultiplier).toBe(cappedCaptures.rewardMultiplier);
    expect(excessiveCaptures.rewardPoints).toBe(cappedCaptures.rewardPoints);
  });
});

type TestItemId = 'shard' | 'herb' | 'dust';
type TestEquipmentId = 'sword' | 'shield' | 'ring';

describe('run loot bag', () => {
  it('creates an empty bag and accumulates normalized rewards without mutating inputs', () => {
    const bagItems = { shard: 2.9 };
    const bagEquipment: TestEquipmentId[] = ['sword', 'sword'];
    const bag: RunLootBag<TestItemId, TestEquipmentId> = {
      rewardPoints: 10.8,
      lingyun: 1.9,
      items: bagItems,
      equipmentIds: bagEquipment
    };
    const additionItems = { shard: 3.7, herb: 2.2, dust: Number.POSITIVE_INFINITY };
    const additionEquipment: TestEquipmentId[] = ['shield', 'sword', 'ring', 'shield'];

    expect(createEmptyRunLootBag<TestItemId, TestEquipmentId>()).toEqual({
      rewardPoints: 0,
      lingyun: 0,
      items: {},
      equipmentIds: []
    });

    const result = addRunLoot(bag, {
      rewardPoints: 5.9,
      lingyun: -3,
      items: additionItems,
      equipmentIds: additionEquipment
    });

    expect(result).toEqual({
      rewardPoints: 15,
      lingyun: 1,
      items: { shard: 5, herb: 2 },
      equipmentIds: ['sword', 'shield', 'ring']
    });
    expect(bag).toEqual({ rewardPoints: 10.8, lingyun: 1.9, items: { shard: 2.9 }, equipmentIds: ['sword', 'sword'] });
    expect(additionItems).toEqual({ shard: 3.7, herb: 2.2, dust: Number.POSITIVE_INFINITY });
    expect(additionEquipment).toEqual(['shield', 'sword', 'ring', 'shield']);
    expect(result.items).not.toBe(bag.items);
    expect(result.equipmentIds).not.toBe(bag.equipmentIds);
  });

  it('ignores negative and non-finite loot and floors every quantity', () => {
    const result = addRunLoot(createEmptyRunLootBag<TestItemId, TestEquipmentId>(), {
      rewardPoints: Number.NaN,
      lingyun: Number.NEGATIVE_INFINITY,
      items: { shard: -2, herb: 3.99, dust: Number.NaN }
    });

    expect(result).toEqual({ rewardPoints: 0, lingyun: 0, items: { herb: 3 }, equipmentIds: [] });
    expect(getRunLootItemCount(result, 'herb')).toBe(3);
    expect(getRunLootItemCount(result, 'shard')).toBe(0);
  });

  it('consumes bag items first and reports the unmet remainder without mutating the bag', () => {
    const bag: RunLootBag<TestItemId, TestEquipmentId> = {
      rewardPoints: 12,
      lingyun: 2,
      items: { herb: 3.8, shard: 1 },
      equipmentIds: ['sword']
    };

    const partial = consumeRunLootItem(bag, 'herb', 2.9);
    const exhausted = consumeRunLootItem(bag, 'herb', 5.7);
    const invalid = consumeRunLootItem(bag, 'herb', Number.POSITIVE_INFINITY);

    expect(partial).toEqual({
      bag: { rewardPoints: 12, lingyun: 2, items: { herb: 1, shard: 1 }, equipmentIds: ['sword'] },
      consumed: 2,
      remaining: 0
    });
    expect(exhausted).toEqual({
      bag: { rewardPoints: 12, lingyun: 2, items: { shard: 1 }, equipmentIds: ['sword'] },
      consumed: 3,
      remaining: 2
    });
    expect(invalid.consumed).toBe(0);
    expect(invalid.remaining).toBe(0);
    expect(bag.items).toEqual({ herb: 3.8, shard: 1 });
  });

  it.each([
    {
      exitStatus: 'cleared' as const,
      retained: {
        rewardPoints: 101,
        lingyun: 5,
        items: { shard: 5, herb: 2 },
        equipmentIds: ['sword', 'shield']
      },
      lost: { rewardPoints: 0, lingyun: 0, items: {}, equipmentIds: [] }
    },
    {
      exitStatus: 'retreated' as const,
      retained: { rewardPoints: 50, lingyun: 2, items: { shard: 2, herb: 1 }, equipmentIds: [] },
      lost: {
        rewardPoints: 51,
        lingyun: 3,
        items: { shard: 3, herb: 1 },
        equipmentIds: ['sword', 'shield']
      }
    },
    {
      exitStatus: 'failed' as const,
      retained: { rewardPoints: 20, lingyun: 0, items: {}, equipmentIds: [] },
      lost: {
        rewardPoints: 81,
        lingyun: 5,
        items: { shard: 5, herb: 2 },
        equipmentIds: ['sword', 'shield']
      }
    }
  ])('settles $exitStatus runs into retained and lost loot', ({ exitStatus, retained, lost }) => {
    const bag: RunLootBag<TestItemId, TestEquipmentId> = {
      rewardPoints: 101.9,
      lingyun: 5.8,
      items: { shard: 5.9, herb: 2.2, dust: -1 },
      equipmentIds: ['sword', 'sword', 'shield']
    };

    expect(settleRunLoot(bag, exitStatus)).toEqual({ retained, lost });
    expect(bag).toEqual({
      rewardPoints: 101.9,
      lingyun: 5.8,
      items: { shard: 5.9, herb: 2.2, dust: -1 },
      equipmentIds: ['sword', 'sword', 'shield']
    });
  });
});
