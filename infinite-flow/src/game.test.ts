import { describe, expect, it } from 'vitest';
import {
  buyItem,
  createInitialState,
  enterDungeon,
  getAvailableDungeonChoices,
  learnMethod,
  returnToHub,
  resolveDungeonChoice
} from './game';

describe('infinite-flow core loop', () => {
  it('starts in the main-god space with enough points to make a meaningful first purchase', () => {
    const state = createInitialState();

    expect(state.phase).toBe('hub');
    expect(state.rewardPoints).toBe(850);
    expect(state.inventory).toEqual([]);
    expect(state.learnedMethods).toEqual([]);
    expect(state.log[0]).toContain('白光');
  });

  it('hides upgrade-gated dungeon options before the player buys or learns the requirement', () => {
    const state = enterDungeon(createInitialState(), 'demon_tower_1');

    expect(getAvailableDungeonChoices(state).map((choice) => choice.id)).toEqual(['force_through']);
  });

  it('lets a failed first run return to the hub, buy a talisman, and unlock a better branch', () => {
    const failedRun = resolveDungeonChoice(
      enterDungeon(createInitialState(), 'demon_tower_1'),
      'force_through'
    );

    expect(failedRun.phase).toBe('result');
    expect(failedRun.lastOutcome?.tone).toBe('failure');
    expect(failedRun.lastOutcome?.rewardPointsDelta).toBe(80);
    expect(failedRun.rewardPoints).toBe(930);

    const upgraded = buyItem(returnToHub(failedRun), 'thunder_talisman');
    const secondRun = enterDungeon(upgraded, 'demon_tower_1');

    expect(getAvailableDungeonChoices(secondRun).map((choice) => choice.id)).toEqual([
      'force_through',
      'use_thunder_talisman'
    ]);

    const cleared = resolveDungeonChoice(secondRun, 'use_thunder_talisman');

    expect(cleared.phase).toBe('result');
    expect(cleared.lastOutcome?.tone).toBe('success');
    expect(cleared.inventory).toContain('demon_bone');
    expect(cleared.rewardPoints).toBe(810);
  });

  it('lets a learned cultivation method reveal a hidden option without consuming an item', () => {
    const trained = learnMethod(createInitialState(), 'breathing_method');
    const run = enterDungeon(trained, 'demon_tower_1');

    expect(getAvailableDungeonChoices(run).map((choice) => choice.id)).toEqual([
      'force_through',
      'steady_breathing'
    ]);

    const cleared = resolveDungeonChoice(run, 'steady_breathing');

    expect(cleared.lastOutcome?.tone).toBe('discovery');
    expect(cleared.learnedMethods).toContain('breathing_method');
    expect(cleared.inventory).toContain('hidden_stone');
  });
});
