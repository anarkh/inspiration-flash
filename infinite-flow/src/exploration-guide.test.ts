import { describe, expect, it } from 'vitest';
import {
  createInitialState,
  enterDungeon,
  selectNode,
  type GameState
} from './game';
import { getExplorationGuide } from './exploration-guide';

function enterStartingDungeon(): GameState {
  return enterDungeon(createInitialState(), 'demon_tower_1');
}

describe('exploration guide', () => {
  it('does not render outside an active run', () => {
    expect(getExplorationGuide(createInitialState())).toBeUndefined();
  });

  it('guides the player to handle the starting monster', () => {
    const state = enterStartingDungeon();

    expect(getExplorationGuide(state)).toMatchObject({
      kind: 'node',
      tone: 'urgent',
      instruction: '迎战当前怪物',
      targetActionId: `fight-current-${state.run?.currentNodeId}`
    });
  });

  it('guides the player to choose a combat action', () => {
    const entered = enterStartingDungeon();
    const state = selectNode(entered, entered.run!.currentNodeId);

    expect(getExplorationGuide(state)).toMatchObject({
      kind: 'combat',
      instruction: '选择本回合行动',
      targetActionId: 'combat-attack'
    });
  });

  it('guides a cleared node toward an adjacent map target', () => {
    const entered = enterStartingDungeon();
    const state: GameState = {
      ...entered,
      run: entered.run
        ? {
            ...entered.run,
            clearedNodeIds: [entered.run.currentNodeId]
          }
        : undefined
    };

    const guide = getExplorationGuide(state);
    expect(guide).toMatchObject({
      kind: 'move',
      instruction: '探索相邻未知区域'
    });
    expect(guide?.targetActionId).toMatch(/^grid-/);
  });

  it('prioritizes an equipment offer and retains the exact block reason', () => {
    const entered = enterStartingDungeon();
    const state: GameState = {
      ...entered,
      run: entered.run
        ? {
            ...entered.run,
            pendingEquipmentOffer: {
              offerId: 'guide-test-offer',
              equipmentIds: [entered.equipped.weapon]
            }
          }
        : undefined
    };

    expect(getExplorationGuide(state)).toEqual({
      kind: 'blocker',
      tone: 'urgent',
      eyebrow: '待处理',
      instruction: '选择一件精英装备，或放弃本次掉落',
      detail: '先处理当前精英战利品，选择或放弃后才能离开。'
    });
  });
});
