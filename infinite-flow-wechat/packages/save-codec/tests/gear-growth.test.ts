import { describe, expect, it } from 'vitest';

import { createInitialState, type GameState } from '@infinite-flow/core';
import { decodeWebV1 } from '../src/index.js';

function withRobe(level: number): GameState {
  const state = createInitialState();
  return {
    ...state,
    ownedEquipment: [...state.ownedEquipment, 'spirit_robe'],
    equipped: { ...state.equipped, armor: 'spirit_robe' },
    equipmentLevels: { ...state.equipmentLevels, spirit_robe: level },
    equipmentAttunements: { spirit_robe: 'mist_vanguard' },
    equipmentTemperRanks: { spirit_robe: 2 }
  };
}

function decode(state: GameState) {
  return decodeWebV1({ kind: 'web-local-storage-text', text: JSON.stringify({ version: 1, state }) });
}

describe('gear levels 4 and 5', () => {
  it('keep a save made at the old cap (level 3, inscribed and tempered) readable', () => {
    const result = decode(withRobe(3));
    expect(result.status).toBe('decoded');
    if (result.status !== 'decoded') throw new Error(result.reason.message);
    expect(result.state.equipmentAttunements).toEqual({ spirit_robe: 'mist_vanguard' });
    expect(result.state.equipmentTemperRanks).toEqual({ spirit_robe: 2 });
  });

  it('read an inscribed level-5 piece back and refuse a level above the cap', () => {
    const levelFive = decode(withRobe(5));
    expect(levelFive.status).toBe('decoded');
    if (levelFive.status !== 'decoded') throw new Error(levelFive.reason.message);
    expect(levelFive.state.equipmentLevels.spirit_robe).toBe(5);
    expect(decode(withRobe(6)).status).not.toBe('decoded');
  });

  it('refuse an inscription on a piece below level 3', () => {
    expect(decode(withRobe(2)).status).not.toBe('decoded');
  });
});
