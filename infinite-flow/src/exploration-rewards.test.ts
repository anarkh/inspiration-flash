import { describe, expect, it } from 'vitest';
import {
  EXPLORATION_REWARD_VERSION,
  EXPLORATION_SUPPLY_INTERVAL,
  EXPLORATION_SUPPLY_ROTATION,
  getExplorationClearReward,
  usesCurrentExplorationRewardRules
} from './exploration-rewards';

const dungeon = {
  tier: 1,
  nodes: [
    { id: 'monster', type: 'monster' },
    { id: 'reward', type: 'reward' },
    { id: 'trap', type: 'trap' },
    { id: 'portal', type: 'portal' },
    { id: 'exit', type: 'exit' }
  ]
} as const;

describe('modern exploration rewards', () => {
  const currentRun = (
    clearedNodeIds: readonly string[] = []
  ) => ({
    entryFlowVersion: 2 as const,
    explorationRewardVersion: EXPLORATION_REWARD_VERSION,
    clearedNodeIds
  });

  it('keeps the deterministic reward contract versioned and migration-friendly', () => {
    expect(EXPLORATION_REWARD_VERSION).toBe(1);
    expect(EXPLORATION_SUPPLY_INTERVAL).toBe(3);
    expect(EXPLORATION_SUPPLY_ROTATION).toEqual([
      'healing_pill',
      'armor_patch',
      'focus_incense'
    ]);
    expect(usesCurrentExplorationRewardRules(currentRun())).toBe(true);
    expect(usesCurrentExplorationRewardRules({
      entryFlowVersion: 2,
      explorationRewardVersion: undefined
    })).toBe(false);
  });

  it('pays cleared hazards while ordinary monsters and reward nodes keep their native rewards', () => {
    const run = currentRun();

    expect(getExplorationClearReward(run, dungeon, 'trap')).toMatchObject({
      rewardPoints: 30,
      items: {}
    });
    expect(getExplorationClearReward(run, dungeon, 'portal')).toMatchObject({
      rewardPoints: 20,
      items: {}
    });
    expect(getExplorationClearReward(run, dungeon, 'monster').rewardPoints).toBe(0);
    expect(getExplorationClearReward(run, dungeon, 'reward').rewardPoints).toBe(0);
  });

  it('grants a visible supply every third first-clear without replaying a node', () => {
    expect(getExplorationClearReward(
      currentRun(['monster', 'reward']),
      dungeon,
      'trap'
    )).toMatchObject({
      items: { healing_pill: 1 },
      clearedNodeCount: 3,
      supplyMilestone: 1,
      supplyItemId: 'healing_pill'
    });

    expect(getExplorationClearReward(
      currentRun(['monster', 'reward', 'trap']),
      dungeon,
      'trap'
    )).toMatchObject({
      rewardPoints: 0,
      items: {},
      clearedNodeCount: 0,
      supplyMilestone: 0
    });
  });

  it('does not retrofit rewards into legacy or pre-versioned modern runs and never rewards exits', () => {
    expect(getExplorationClearReward(
      { clearedNodeIds: ['monster', 'reward'] },
      dungeon,
      'trap'
    ).rewardPoints).toBe(0);
    expect(getExplorationClearReward(
      { entryFlowVersion: 2, clearedNodeIds: ['monster', 'reward'] },
      dungeon,
      'trap'
    )).toMatchObject({
      rewardPoints: 0,
      items: {}
    });
    expect(getExplorationClearReward(
      currentRun(['monster', 'reward']),
      dungeon,
      'exit'
    ).items).toEqual({});
  });
});
