import { describe, expect, it } from 'vitest';

import { createInitialState, DUNGEON_ORDER, enterDungeon, selectNode, type GameState } from '@infinite-flow/core';
import { getBossDefinition } from '@infinite-flow/core/boss-system';
import { decodeWebV1 } from '../src/index.js';

function bossFight(dungeonId: 'temporal_observatory' | 'entropy_ark' | 'redaction_scriptorium' | 'legacy_auction_court' | 'panopticon_city'): GameState {
  let state: GameState = { ...createInitialState(), completedDungeonIds: [...DUNGEON_ORDER] };
  state = enterDungeon(state, dungeonId, 'standard', undefined, { flowVersion: 2, hiddenTaskSeed: 7 });
  if (dungeonId === 'panopticon_city') {
    // The warden only opens once the three relays and a route are done.
    const lawState = state.run!.lawState as { law: Record<string, unknown> };
    state = { ...state, run: { ...state.run!, lawState: { ...lawState, law: { ...lawState.law, ...{ relays: { north_blind_relay: true, central_blind_relay: true, south_blind_relay: true }, route: 'shadow' } } } } as GameState['run'] };
  }
  const nodeId = getBossDefinition(dungeonId).nodeId;
  return selectNode({ ...state, phase: 'explore', run: { ...state.run!, currentNodeId: nodeId } }, nodeId);
}

function decode(state: GameState) {
  return decodeWebV1({ kind: 'web-local-storage-text', text: JSON.stringify({ version: 1, state }) });
}

describe('saves made in the middle of a late boss mechanic', () => {
  it('keep the clock, heading, deletion, shield and exposure state of chapters 8, 10, 12, 13 and 19', () => {
    const effects = [
      ['temporal_observatory', { regentClock: 3 }],
      ['entropy_ark', { helmEntropy: 4 }],
      ['redaction_scriptorium', { redactAttackCount: 3, redactArtCount: 1, redactedKind: 'attack', redactedTurns: 2 }],
      ['legacy_auction_court', { bidShield: 42 }],
      ['panopticon_city', { exposure: 2 }]
    ] as const;
    for (const [dungeonId, state] of effects) {
      const fight = bossFight(dungeonId);
      const result = decode({ ...fight, combat: { ...fight.combat!, effects: { ...state } } });
      expect(result.status).toBe('decoded');
      if (result.status !== 'decoded') throw new Error(result.reason.message);
      expect(result.state.combat?.effects).toEqual(state);
    }
  });

  it('keeps the fight state of 追拍潜猎者, 连续性剪辑师 and 重拍替身, which used to fail to load', () => {
    const fight = bossFight('temporal_observatory');
    for (const effects of [{ cueStalkerLastAction: 'art' }, { continuityEditCount: 2 }, { retakeRecordedAction: 'guard' }]) {
      const result = decode({ ...fight, combat: { ...fight.combat!, effects } as never });
      expect(result.status).toBe('decoded');
      if (result.status !== 'decoded') throw new Error(result.reason.message);
      expect(result.state.combat?.effects).toEqual(effects);
    }
  });

  it('rejects out-of-range mechanic values instead of loading a broken fight', () => {
    const fight = bossFight('temporal_observatory');
    expect(decode({ ...fight, combat: { ...fight.combat!, effects: { regentClock: 9 } } }).status).toBe('rejected');
  });
});
