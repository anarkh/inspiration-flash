import { describe, expect, it } from 'vitest';
import {
  advanceRunPressureOnNodeClear,
  calculateRunPressureBonus,
  createRunPressureState,
  getRunPressureStatus,
  isRunPressureState,
  normalizeRunPressureState,
  scaleMonsterForRunPressure,
  scaleTrapForRunPressure,
  type RunPressureState
} from './run-pressure';

function stateAt(clearedNodeCount: number): RunPressureState {
  return { rulesVersion: 1, clearedNodeCount };
}

describe('run pressure', () => {
  it('creates and idempotently normalizes a versioned state', () => {
    const input = { rulesVersion: 1, clearedNodeCount: 6, futureField: 'ignored' };
    const normalized = normalizeRunPressureState(input);

    expect(createRunPressureState()).toEqual({ rulesVersion: 1, clearedNodeCount: 0 });
    expect(normalized).toEqual({ rulesVersion: 1, clearedNodeCount: 6 });
    expect(normalizeRunPressureState(normalized)).toEqual(normalized);
    expect(input).toEqual({ rulesVersion: 1, clearedNodeCount: 6, futureField: 'ignored' });
    expect(isRunPressureState(input)).toBe(true);
  });

  it.each([
    undefined,
    null,
    [],
    {},
    { rulesVersion: 2, clearedNodeCount: 0 },
    { rulesVersion: 1, clearedNodeCount: -1 },
    { rulesVersion: 1, clearedNodeCount: 1.5 },
    { rulesVersion: 1, clearedNodeCount: Number.NaN },
    { rulesVersion: 1, clearedNodeCount: Number.POSITIVE_INFINITY },
    { rulesVersion: 1, clearedNodeCount: Number.MAX_SAFE_INTEGER + 1 },
    { rulesVersion: 1, clearedNodeCount: '6' }
  ])('rejects an invalid pressure snapshot: %o', (snapshot) => {
    expect(normalizeRunPressureState(snapshot)).toBeUndefined();
    expect(isRunPressureState(snapshot)).toBe(false);
  });

  it.each([
    [5, 'stable', '稳定', 0, 15, 6],
    [6, 'hunted', '追猎', 10, 5, 12],
    [11, 'hunted', '追猎', 10, 5, 12],
    [12, 'breach', '破界', 20, 0, null]
  ] as const)(
    'maps the boundary at %i cleared nodes to %s',
    (clearedNodeCount, tier, label, pressurePercent, rewardBonusPercent, nextTierAt) => {
      const state = stateAt(clearedNodeCount);

      expect(getRunPressureStatus(state)).toEqual({
        state,
        tier,
        label,
        pressurePercent,
        rewardBonusPercent,
        nextTierAt
      });
    }
  );

  it('advances immutably across tiers while leaving legacy runs disabled', () => {
    const stable = stateAt(5);
    const hunted = advanceRunPressureOnNodeClear(stable);
    const breach = advanceRunPressureOnNodeClear(stateAt(11));

    expect(hunted).toEqual(stateAt(6));
    expect(hunted).not.toBe(stable);
    expect(stable).toEqual(stateAt(5));
    expect(breach).toEqual(stateAt(12));
    expect(getRunPressureStatus(undefined)).toBeUndefined();
    expect(advanceRunPressureOnNodeClear(undefined)).toBeUndefined();
    expect(advanceRunPressureOnNodeClear(stateAt(Number.MAX_SAFE_INTEGER))).toEqual(
      stateAt(Number.MAX_SAFE_INTEGER)
    );
  });

  it('scales monster combat stats upward without mutating or replacing unrelated fields', () => {
    const monster = {
      id: 'pressure_target',
      maxHp: 100,
      attack: 10,
      artPower: 0,
      defense: 20,
      speed: 9,
      rewardPoints: 17,
      drop: { shard: 1 }
    };
    const snapshot = structuredClone(monster);

    expect(scaleMonsterForRunPressure(monster, undefined)).toBe(monster);
    expect(scaleMonsterForRunPressure(monster, stateAt(5))).toBe(monster);

    const hunted = scaleMonsterForRunPressure(monster, stateAt(6));
    const breach = scaleMonsterForRunPressure(monster, stateAt(12));

    expect(hunted).toMatchObject({
      id: 'pressure_target',
      maxHp: 110,
      attack: 11,
      artPower: 0,
      defense: 22,
      speed: 10,
      rewardPoints: 17
    });
    expect(breach).toMatchObject({ maxHp: 120, attack: 12, artPower: 0, defense: 24, speed: 11 });
    expect(hunted.drop).toBe(monster.drop);
    expect(monster).toEqual(snapshot);

    for (const stat of ['maxHp', 'attack', 'artPower', 'defense', 'speed'] as const) {
      expect(hunted[stat]).toBeGreaterThanOrEqual(monster[stat]);
      expect(breach[stat]).toBeGreaterThanOrEqual(monster[stat]);
    }
  });

  it('scales trap damage and DC upward while preserving the original trap', () => {
    const trap = { damage: 10, dc: 13, counterItem: 'armor_patch' };
    const snapshot = { ...trap };

    expect(scaleTrapForRunPressure(trap, undefined)).toBe(trap);
    expect(scaleTrapForRunPressure(trap, stateAt(5))).toBe(trap);
    expect(scaleTrapForRunPressure(trap, stateAt(6))).toEqual({
      damage: 11,
      dc: 15,
      counterItem: 'armor_patch'
    });
    expect(scaleTrapForRunPressure(trap, stateAt(12))).toEqual({
      damage: 12,
      dc: 16,
      counterItem: 'armor_patch'
    });
    expect(trap).toEqual(snapshot);
  });

  it('floors only the exit bonus and gives legacy or breach runs no bonus', () => {
    expect(calculateRunPressureBonus(101, stateAt(5))).toBe(15);
    expect(calculateRunPressureBonus(101, stateAt(6))).toBe(5);
    expect(calculateRunPressureBonus(101, stateAt(12))).toBe(0);
    expect(calculateRunPressureBonus(101, undefined)).toBe(0);
    expect(calculateRunPressureBonus(-10, stateAt(5))).toBe(0);
    expect(calculateRunPressureBonus(Number.NaN, stateAt(5))).toBe(0);
  });
});
