import { describe, expect, it } from 'vitest';
import { getBossDefinition } from './boss-system';
import { getEquipmentAttunementOptions } from './equipment-system';
import { discoverHiddenRouteContract } from './route-contracts';
import {
  DUNGEONS,
  EQUIPMENT,
  buyEquipment,
  collectReward,
  createInitialState,
  enterDungeon,
  getEquipmentRecipePurchaseStatus,
  getPlayerPower,
  getRunEconomyPreview,
  handleTrap,
  performCombatAction,
  resolveEquipmentLoot,
  resolveExit,
  resolveRetreat,
  selectNode,
  usePortal,
  type GameState
} from './game';

describe('simplified dungeon entry flow', () => {
  function atNode(state: GameState, nodeId: string): GameState {
    if (!state.run) throw new Error('Expected an active dungeon run');
    return {
      ...state,
      phase: 'explore',
      combat: undefined,
      run: { ...state.run, currentNodeId: nodeId }
    };
  }

  function readyForExit(state: GameState): GameState {
    if (!state.run) throw new Error('Expected an active dungeon run');
    const exitNode = DUNGEONS[state.run.dungeonId].nodes.find((node) => node.type === 'exit');
    if (!exitNode) throw new Error('Expected an exit node');
    return {
      ...atNode(state, exitNode.id),
      run: {
        ...state.run,
        currentNodeId: exitNode.id,
        clearedNodeIds: [getBossDefinition(state.run.dungeonId).nodeId]
      }
    };
  }

  it('uses ordinary, hard, and inferno as difficulty only and grants 1/2/3 chapter materials', () => {
    const completedHub: GameState = {
      ...createInitialState(),
      completedDungeonIds: ['demon_tower_1']
    };

    for (const [protocolId, expectedAmount] of [
      ['standard', 1],
      ['imprint', 2],
      ['deep', 3]
    ] as const) {
      const entered = enterDungeon(
        completedHub,
        'demon_tower_1',
        protocolId,
        undefined,
        { flowVersion: 2, hiddenTaskSeed: 17 }
      );
      const settled = resolveExit(readyForExit(entered));

      expect(entered.phase).toBe('explore');
      expect(entered.inventory.cycle_imprint).toBe(0);
      expect(entered.run).toMatchObject({
        entryFlowVersion: 2,
        explorationRewardVersion: 1,
        hiddenTaskSeed: 17
      });
      expect(settled.inventory.demon_bone - entered.inventory.demon_bone).toBe(expectedAmount);
    }
  });

  it('unlocks chapter equipment after clear and exchanges it for that chapter material only', () => {
    const locked: GameState = {
      ...createInitialState(),
      inventory: { ...createInitialState().inventory, demon_bone: 2 }
    };
    const lockedStatus = getEquipmentRecipePurchaseStatus(
      locked,
      'demon_tower_1',
      'armor_piercing_sword'
    );
    const rejected = buyEquipment(locked, 'armor_piercing_sword', 'demon_tower_1');

    expect(lockedStatus).toMatchObject({ unlocked: false, affordable: false });
    expect(rejected.ownedEquipment).not.toContain('armor_piercing_sword');

    const unlocked: GameState = {
      ...locked,
      completedDungeonIds: ['demon_tower_1']
    };
    const status = getEquipmentRecipePurchaseStatus(
      unlocked,
      'demon_tower_1',
      'armor_piercing_sword'
    );
    const purchased = buyEquipment(unlocked, 'armor_piercing_sword', 'demon_tower_1');

    expect(status).toMatchObject({
      unlocked: true,
      affordable: true,
      cost: { items: { demon_bone: 1 } }
    });
    expect(purchased.ownedEquipment).toContain('armor_piercing_sword');
    expect(purchased.inventory.demon_bone).toBe(1);
    expect(purchased.rewardPoints).toBe(unlocked.rewardPoints);
    expect(purchased.lingyun).toBe(unlocked.lingyun);
  });

  it('turns the first elite victory into visible materials and a permanent equipment upgrade', () => {
    const entered = enterDungeon(
      createInitialState(),
      'demon_tower_1',
      'standard',
      undefined,
      { flowVersion: 2, hiddenTaskSeed: 23 }
    );
    const started = selectNode(atNode(entered, 'butcher_turn'), 'butcher_turn');
    const defeated = performCombatAction(
      {
        ...started,
        combat: started.combat ? { ...started.combat, monsterHp: 1 } : started.combat
      },
      'attack'
    );

    expect(defeated.phase).toBe('explore');
    expect(defeated.run?.pendingEquipmentOffer?.equipmentIds).toHaveLength(3);
    expect(defeated.run?.lootOffersMade).toBe(1);
    expect(defeated.run?.lootBag.items.demon_bone).toBe(2);
    expect(defeated.log.some((line) => line.includes('妖骨 x2'))).toBe(true);

    const selectedEquipmentId = defeated.run?.pendingEquipmentOffer?.equipmentIds[0];
    if (!selectedEquipmentId) throw new Error('Expected an equipment candidate');
    const powerBefore = getPlayerPower(defeated);
    const selected = resolveEquipmentLoot(defeated, selectedEquipmentId);
    const settled = resolveExit(readyForExit(selected));

    expect(selected.run?.lootBag.equipmentIds).toContain(selectedEquipmentId);
    expect(settled.ownedEquipment).toContain(selectedEquipmentId);
    expect(settled.equipped[EQUIPMENT[selectedEquipmentId].slot]).toBe(selectedEquipmentId);
    expect(settled.run?.lastAutoEquippedEquipmentIds).toContain(selectedEquipmentId);
    expect(getPlayerPower(settled)).toBeGreaterThan(powerBefore);
    expect(settled.inventory.demon_bone).toBeGreaterThanOrEqual(3);
  });

  it('guarantees modern exploration income and a supply every third first-clear', () => {
    const entered = enterDungeon(
      createInitialState(),
      'demon_tower_1',
      'standard',
      undefined,
      { flowVersion: 2, hiddenTaskSeed: 27 }
    );
    const startingPills = entered.inventory.healing_pill;
    let explored = handleTrap(atNode(entered, 'blood_rune_trap'), 'risk');
    explored = handleTrap(atNode(explored, 'loose_tile_trap'), 'risk');
    explored = handleTrap(atNode(explored, 'left_watch_trap'), 'risk');

    expect(explored.run?.lootBag.rewardPoints).toBe(90);
    expect(explored.run?.lootBag.items.healing_pill).toBe(1);
    expect(explored.inventory.healing_pill).toBe(startingPills + 1);
    expect(explored.log.some((line) => line.includes('探索结算追加'))).toBe(true);
  });

  it('does not let an uncommitted opening kill mint repeatable retreat income', () => {
    const initial = createInitialState();
    const entered = enterDungeon(
      initial,
      'demon_tower_1',
      'standard',
      undefined,
      { flowVersion: 2, hiddenTaskSeed: 28 }
    );
    const started = selectNode(atNode(entered, 'fog_lesser_demon'), 'fog_lesser_demon');
    const defeated = performCombatAction(
      {
        ...started,
        combat: started.combat ? { ...started.combat, monsterHp: 1 } : started.combat
      },
      'attack'
    );
    const preview = getRunEconomyPreview(defeated, 'retreated');
    const retreated = resolveRetreat(defeated);

    expect(defeated.run?.clearedNodeIds).toEqual(['fog_lesser_demon']);
    expect(defeated.run?.lootBag.rewardPoints).toBeGreaterThan(0);
    expect(preview?.rewardPoints).toBe(0);
    expect(retreated.run?.lastLootSettlement?.retained.rewardPoints).toBe(0);
    expect(retreated.run?.lastLootSettlement?.lost.rewardPoints)
      .toBe(defeated.run?.lootBag.rewardPoints);
    expect(retreated.rewardPoints).toBe(initial.rewardPoints);
    expect(retreated.log.some((line) => line.includes('未清理满 3 个非出口节点'))).toBe(true);
  });

  it('unlocks proportional retreat recovery at the three-node exploration milestone without a bonus payout', () => {
    const initial = createInitialState();
    let explored = enterDungeon(
      initial,
      'demon_tower_1',
      'standard',
      undefined,
      { flowVersion: 2, hiddenTaskSeed: 30 }
    );
    explored = handleTrap(atNode(explored, 'blood_rune_trap'), 'risk');
    explored = handleTrap(atNode(explored, 'loose_tile_trap'), 'risk');
    explored = handleTrap(atNode(explored, 'left_watch_trap'), 'risk');
    const bagPoints = explored.run?.lootBag.rewardPoints ?? 0;
    const retreated = resolveRetreat(explored);

    expect(bagPoints).toBe(90);
    expect(retreated.run?.lastLootSettlement?.retained.rewardPoints).toBe(45);
    expect(retreated.run?.lastLootSettlement?.lost.rewardPoints).toBe(45);
    expect(retreated.rewardPoints - initial.rewardPoints).toBe(45);
    expect(retreated.log.some((line) => line.includes('不叠加额外撤退或濒死奖励'))).toBe(true);
  });

  it('preserves the original retreat settlement for a pre-version modern save', () => {
    const initial = createInitialState();
    const entered = enterDungeon(
      initial,
      'demon_tower_1',
      'standard',
      undefined,
      { flowVersion: 2, hiddenTaskSeed: 31 }
    );
    if (!entered.run) throw new Error('Expected an active dungeon run');
    const {
      explorationRewardVersion: _discardedRewardVersion,
      ...preVersionRun
    } = entered.run;
    const preVersionSave: GameState = {
      ...entered,
      rewardPoints: entered.rewardPoints + 100,
      run: {
        ...preVersionRun,
        clearedNodeIds: ['fog_lesser_demon'],
        lootBag: {
          ...entered.run.lootBag,
          rewardPoints: 100
        }
      }
    };
    const preview = getRunEconomyPreview(preVersionSave, 'retreated');
    const retreated = resolveRetreat(preVersionSave);

    expect(preVersionSave.run?.explorationRewardVersion).toBeUndefined();
    expect(preview?.rewardPoints).toBeGreaterThan(0);
    expect(retreated.run?.lastLootSettlement?.retained.rewardPoints).toBe(50);
    expect(retreated.run?.lastLootSettlement?.lost.rewardPoints).toBe(50);
    expect(retreated.rewardPoints).toBe(
      initial.rewardPoints + 50 + (preview?.rewardPoints ?? 0)
    );
    expect(retreated.log.join('\n')).not.toContain('未清理满 3 个非出口节点');
    expect(retreated.log.join('\n')).not.toContain('不叠加额外撤退或濒死奖励');
  });

  it('keeps the simplified rules after crossing into another dungeon', () => {
    const entered = enterDungeon(
      {
        ...createInitialState(),
        completedDungeonIds: ['demon_tower_1'],
        claimedTaskIds: ['mainline_clear_demon_tower_1']
      },
      'demon_tower_1',
      'standard',
      undefined,
      { flowVersion: 2, hiddenTaskSeed: 29 }
    );
    const transported = usePortal(
      {
        ...atNode(entered, 'side_gate_portal'),
        player: { ...entered.player, hp: 1_000, maxHp: 1_000 }
      },
      'force'
    );

    expect(transported.run).toMatchObject({
      dungeonId: 'metro_abyss',
      entryFlowVersion: 2,
      explorationRewardVersion: 1,
      hiddenTaskSeed: 29
    });
  });

  it('discovers a hidden task during exploration instead of selecting one before entry', () => {
    const path = ['broken_sigil_reward', 'mist_herb_cache'];
    let triggeringSeed: number | undefined;
    for (let seed = 1; seed <= 10_000; seed += 1) {
      if (discoverHiddenRouteContract({
        dungeonId: 'demon_tower_1',
        seed,
        clearedNodeIds: path
      })) {
        triggeringSeed = seed;
        break;
      }
    }
    if (!triggeringSeed) throw new Error('Expected a deterministic hidden-task seed');

    let state = enterDungeon(
      createInitialState(),
      'demon_tower_1',
      'standard',
      undefined,
      { flowVersion: 2, hiddenTaskSeed: triggeringSeed }
    );
    expect(state.run?.routeContractState).toBeUndefined();
    state = collectReward(atNode(state, path[0]));
    expect(state.run?.routeContractState).toBeUndefined();
    state = collectReward(atNode(state, path[1]));

    expect(state.run?.routeContractState).toMatchObject({ status: 'active' });
    expect(state.log.some((line) => line.includes('发现隐藏任务'))).toBe(true);
  });

  it('records an eligible equipped item memory automatically after a modern clear', () => {
    const equipmentId = 'armor_piercing_sword' as const;
    const equipment = EQUIPMENT[equipmentId];
    const attunement = getEquipmentAttunementOptions(equipmentId)[0];
    if (!attunement) throw new Error('Expected an equipment attunement');
    const hub: GameState = {
      ...createInitialState(),
      completedDungeonIds: ['demon_tower_1'],
      ownedEquipment: [...createInitialState().ownedEquipment, equipmentId],
      equipmentLevels: {
        ...createInitialState().equipmentLevels,
        [equipmentId]: equipment.maxLevel
      },
      equipmentAttunements: { [equipmentId]: attunement.id },
      equipmentTemperRanks: { [equipmentId]: 2 },
      equipped: { ...createInitialState().equipped, weapon: equipmentId }
    };
    const entered = enterDungeon(
      hub,
      'demon_tower_1',
      'standard',
      undefined,
      { flowVersion: 2, hiddenTaskSeed: 31 }
    );
    const settled = resolveExit(readyForExit(entered));

    expect(settled.equipmentMemories?.[equipmentId]).toEqual({
      unlockedIds: ['equipment_memory_demon_tower_1'],
      activeId: 'equipment_memory_demon_tower_1'
    });
  });
});
