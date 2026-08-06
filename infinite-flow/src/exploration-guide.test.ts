import { describe, expect, it } from 'vitest';
import {
  DUNGEONS,
  createInitialState,
  enterDungeon,
  selectNode,
  type GameState
} from './game';
import { DUNGEON_LAW_LANDMARKS } from './dungeon-laws';
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

  it('avoids locating an action that is predicted to force recovery', () => {
    const entered = enterStartingDungeon();
    const combat = selectNode(entered, entered.run!.currentNodeId);
    const doomed: GameState = {
      ...combat,
      player: { ...combat.player, hp: 1 }
    };

    expect(getExplorationGuide(doomed)).toMatchObject({
      instruction: '优先选择可存活的本回合行动',
      targetActionId: 'combat-guard'
    });
  });

  it('locates an available capture before a lethal combat action', () => {
    const initial = createInitialState();
    const entered = enterDungeon(
      {
        ...initial,
        inventory: { ...initial.inventory, capture_net: 1 },
        preparedItemIds: ['capture_net']
      },
      'demon_tower_1'
    );
    const combat = selectNode(entered, entered.run!.currentNodeId);
    const readyToCapture: GameState = {
      ...combat,
      combat: combat.combat
        ? {
            ...combat.combat,
            monsterHp: 6
          }
        : undefined
    };

    expect(getExplorationGuide(readyToCapture)).toMatchObject({
      instruction: '捕获当前虚弱目标',
      targetActionId: 'capture-mist_kitten'
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
      instruction: '选择相邻可探索区域'
    });
    expect(guide?.targetActionId).toMatch(/^grid-/);
  });

  it('routes an exhausted high-pressure clear through the already explored exit-side boss path', () => {
    const entered = enterStartingDungeon();
    const unclearedNodeIds = new Set(['bone_lane_monster', 'cracked_portal', 'tower_exit']);
    const clearedNodeIds = DUNGEONS.demon_tower_1.nodes
      .map((node) => node.id)
      .filter((nodeId) => !unclearedNodeIds.has(nodeId));
    const state: GameState = {
      ...entered,
      phase: 'explore',
      run: {
        ...entered.run!,
        currentNodeId: 'sealed_cache',
        clearedNodeIds,
        lawState: {
          ...entered.run!.lawState!,
          clearedNodeIds,
          resolvedEventIds: [...DUNGEON_LAW_LANDMARKS.demon_tower_1.reliefEventIds],
          law: { kind: 'demon_tower', fogPressure: 3 }
        }
      }
    };

    expect(getExplorationGuide(state)).toMatchObject({
      kind: 'move',
      instruction: '沿已探索路线继续推进',
      targetActionId: 'grid-tower_exit'
    });

    const atExit: GameState = {
      ...state,
      run: { ...state.run!, currentNodeId: 'tower_exit' }
    };
    expect(getExplorationGuide(atExit)).toMatchObject({
      eyebrow: '出口封印',
      instruction: '先击败雾塔剔骨监斩官',
      targetActionId: 'grid-bone_lane_monster'
    });
  });

  it('does not treat a mainline-locked portal as actionable progress', () => {
    const entered = enterStartingDungeon();
    const state: GameState = {
      ...entered,
      phase: 'explore',
      run: {
        ...entered.run!,
        currentNodeId: 'cracked_portal',
        discoveredNodeIds: DUNGEONS.demon_tower_1.nodes.map((node) => node.id)
      }
    };

    const guide = getExplorationGuide(state);
    expect(guide).toMatchObject({
      kind: 'move',
      eyebrow: '传送门封闭',
      instruction: '继续探索当前副本'
    });
    expect(guide?.detail).toContain('主线');
    expect(guide?.targetActionId).not.toMatch(/^portal-/);
  });

  it('locates a safe carried trap counter before the risky fallback', () => {
    const initial = createInitialState();
    const entered = enterDungeon(
      {
        ...initial,
        inventory: { ...initial.inventory, dispel_talisman: 1 },
        preparedItemIds: ['dispel_talisman']
      },
      'demon_tower_1'
    );
    const state: GameState = {
      ...entered,
      run: entered.run
        ? {
            ...entered.run,
            currentNodeId: 'blood_rune_trap',
            clearedNodeIds: [entered.run.currentNodeId]
          }
        : undefined
    };

    expect(getExplorationGuide(state)).toMatchObject({
      instruction: '处理当前陷阱',
      targetActionId: 'trap-counter-blood_rune_trap'
    });
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
