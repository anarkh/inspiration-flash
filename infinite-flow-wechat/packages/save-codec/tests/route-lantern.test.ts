import { describe, expect, it } from 'vitest';

import { createInitialState, type GameState } from '@infinite-flow/core';
import { decodeWebV1 } from '../src/index.js';

function exploringRun(runPatch: Record<string, unknown>): GameState {
  const initial = createInitialState();
  return {
    ...initial,
    phase: 'explore',
    run: {
      dungeonId: 'demon_tower_1',
      currentNodeId: 'blood_rune_trap',
      clearedNodeIds: ['fog_lesser_demon'],
      captures: 0,
      capturedPetIds: [],
      usedItems: [],
      damageTaken: 0,
      resolvedEventIds: [],
      eventLog: [],
      pressureState: { rulesVersion: 1, clearedNodeCount: 1 },
      ...runPatch
    } as GameState['run']
  };
}

function decodeRun(state: GameState): Record<string, unknown> {
  const result = decodeWebV1({
    kind: 'web-local-storage-text',
    text: JSON.stringify({ version: 1, state })
  });
  expect(result.status).toBe('decoded');
  if (result.status !== 'decoded') throw new Error(result.reason.message);
  return result.state.run as unknown as Record<string, unknown>;
}

describe('lantern runs', () => {
  it('keeps a valid lamp and a forced breach', () => {
    const run = decodeRun(exploringRun({
      lanternState: { rulesVersion: 1, dungeonId: 'demon_tower_1', oil: 0 },
      pressureState: { rulesVersion: 1, clearedNodeCount: 1, breachForced: true }
    }));
    expect(run.lanternState).toEqual({ rulesVersion: 1, dungeonId: 'demon_tower_1', oil: 0 });
    expect(run.pressureState).toEqual({ rulesVersion: 1, clearedNodeCount: 1, breachForced: true });
  });

  it('keeps a lamp topped up by every supply room', () => {
    expect(decodeRun(exploringRun({ lanternState: { rulesVersion: 1, dungeonId: 'demon_tower_1', oil: 28 } })).lanternState)
      .toEqual({ rulesVersion: 1, dungeonId: 'demon_tower_1', oil: 28 });
  });

  it('drops malformed, oversized or foreign lamps instead of rejecting the save', () => {
    for (const lanternState of [
      { rulesVersion: 1, dungeonId: 'demon_tower_1', oil: -1 },
      { rulesVersion: 1, dungeonId: 'demon_tower_1', oil: 29 },
      { rulesVersion: 1, dungeonId: 'demon_tower_1', oil: 1_000_000 },
      { rulesVersion: 1, dungeonId: 'demon_tower_1', oil: Number.MAX_SAFE_INTEGER },
      { rulesVersion: 1, dungeonId: 'demon_tower_1', oil: 3, extra: true },
      { rulesVersion: 2, dungeonId: 'demon_tower_1', oil: 3 },
      { rulesVersion: 1, dungeonId: 'metro_abyss', oil: 3 }
    ]) {
      expect(decodeRun(exploringRun({ lanternState }))).not.toHaveProperty('lanternState');
    }
  });

  it('accepts a breach settlement forced before twelve clears', () => {
    const settlement = {
      state: { rulesVersion: 1, clearedNodeCount: 4, breachForced: true },
      tier: 'breach',
      rewardPointBonus: 0
    };
    expect(decodeRun(exploringRun({ lastPressureSettlement: settlement })).lastPressureSettlement).toEqual(settlement);
    const unforced = { ...settlement, state: { rulesVersion: 1, clearedNodeCount: 4 } };
    expect(decodeRun(exploringRun({ lastPressureSettlement: unforced })).lastPressureSettlement).toBeUndefined();
  });
});
