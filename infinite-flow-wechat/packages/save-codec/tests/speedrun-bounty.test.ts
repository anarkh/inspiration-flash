import { describe, expect, it } from 'vitest';

import { createInitialState, enterDungeon, type GameState } from '@infinite-flow/core';
import { decodeWebV1 } from '../src/index.js';

// A result-phase save whose last pressure settlement paid (or claims to have paid) the speedrun bounty.
function settled(clearedNodeCount: number, speedrunBounty: unknown): GameState {
  const entered = enterDungeon({ ...createInitialState(), completedDungeonIds: ['demon_tower_1'] }, 'demon_tower_1', 'standard', undefined,
    { flowVersion: 2, hiddenTaskSeed: 7 });
  const state = { rulesVersion: 1 as const, clearedNodeCount };
  return {
    ...entered,
    run: {
      ...entered.run!,
      pressureState: state,
      lastPressureSettlement: { state, tier: clearedNodeCount >= 6 ? 'hunted' : 'stable', rewardPointBonus: 0, speedrunBounty } as never
    }
  };
}

function decode(state: GameState) {
  return decodeWebV1({ kind: 'web-local-storage-text', text: JSON.stringify({ version: 1, state }) });
}

describe('speedrun bounty in a saved settlement', () => {
  it('reads a paid bounty back', () => {
    const result = decode(settled(5, { roomLimit: 5, lingyun: 1, cycleImprints: 1 }));
    expect(result.status).toBe('decoded');
    if (result.status !== 'decoded') throw new Error(result.reason.message);
    expect(result.state.run?.lastPressureSettlement?.speedrunBounty).toEqual({ roomLimit: 5, lingyun: 1, cycleImprints: 1 });
  });

  it('drops a settlement whose bounty is malformed or was paid past its own line', () => {
    for (const broken of [settled(5, { roomLimit: 5, lingyun: -1, cycleImprints: 1 }), settled(6, { roomLimit: 5, lingyun: 1, cycleImprints: 1 })]) {
      const result = decode(broken);
      expect(result.status).toBe('decoded');
      if (result.status !== 'decoded') throw new Error(result.reason.message);
      expect(result.state.run?.lastPressureSettlement).toBeUndefined();
    }
  });
});
