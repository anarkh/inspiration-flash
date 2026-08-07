import { describe, expect, it } from 'vitest';
import { getBossDefinition } from './boss-system';
import { createDungeonLawState } from './dungeon-laws';
import {
  compareEquipmentRolls,
  createEquipmentRoll,
  type EquipmentRoll
} from './equipment-rolls';
import {
  getInfernoConnectionIds,
  scaleInfernoRewardPoints
} from './inferno-system';
import {
  getRouteContractById,
  isOrderedRouteContractReachable
} from './route-contracts';
import {
  DUNGEONS,
  EQUIPMENT,
  MONSTERS,
  capturePet,
  collectReward,
  configureTacticalLoadout,
  createInitialState,
  enterDungeon,
  evaluateEquipmentRollCandidate,
  getCurrentDungeonDefinition,
  getCurrentLegalAdjacentTargetIds,
  getCurrentRouteBlockReason,
  getDerivedStats,
  getInfernoUnlockedTier,
  getPlayerPower,
  handleTrap,
  moveToNode,
  performCombatAction,
  resolveEquipmentLoot,
  resolveExit,
  selectNode,
  type GameState,
  usePortal
} from './game';
import { addRunLoot } from './run-economy';

function infernoHub(unlockedTier = 1): GameState {
  return {
    ...createInitialState(),
    completedDungeonIds: ['demon_tower_1'],
    infernoProgress: { demon_tower_1: unlockedTier }
  };
}

function enterInferno(tier: number, seed: number, unlockedTier = tier): GameState {
  return enterDungeon(
    infernoHub(unlockedTier),
    'demon_tower_1',
    'deep',
    undefined,
    {
      flowVersion: 2,
      hiddenTaskSeed: 7,
      infernoTier: tier,
      infernoMapSeed: seed
    }
  );
}

function crossDungeonInfernoHub(
  sourceUnlockedTier: number,
  targetUnlockedTier: number
): GameState {
  return {
    ...createInitialState(),
    completedDungeonIds: ['demon_tower_1', 'metro_abyss'],
    claimedTaskIds: ['mainline_clear_demon_tower_1'],
    infernoProgress: {
      demon_tower_1: sourceUnlockedTier,
      metro_abyss: targetUnlockedTier
    }
  };
}

function atNode(state: GameState, nodeId: string): GameState {
  if (!state.run) throw new Error('Expected active run');
  return {
    ...state,
    phase: 'explore',
    combat: undefined,
    run: { ...state.run, currentNodeId: nodeId }
  };
}

function readyForExit(state: GameState): GameState {
  if (!state.run) throw new Error('Expected active run');
  const exitNode = DUNGEONS[state.run.dungeonId].nodes.find((node) => node.type === 'exit');
  if (!exitNode) throw new Error('Expected exit');
  return {
    ...atNode(state, exitNode.id),
    run: {
      ...state.run,
      currentNodeId: exitNode.id,
      clearedNodeIds: [getBossDefinition(state.run.dungeonId).nodeId]
    }
  };
}

describe('layered inferno gameplay', () => {
  it('blocks illegal cross-dungeon tiers before side effects and preserves legal lower tiers', () => {
    const enterSource = (
      sourceTier: number,
      sourceUnlockedTier: number,
      targetUnlockedTier: number
    ) => enterDungeon(
      crossDungeonInfernoHub(sourceUnlockedTier, targetUnlockedTier),
      'demon_tower_1',
      'deep',
      undefined,
      {
        flowVersion: 2,
        hiddenTaskSeed: 7,
        infernoTier: sourceTier,
        infernoMapSeed: 31
      }
    );

    const uncompletedTargetSource = atNode(
      enterDungeon(
        {
          ...infernoHub(1),
          claimedTaskIds: ['mainline_clear_demon_tower_1']
        },
        'demon_tower_1',
        'deep',
        undefined,
        {
          flowVersion: 2,
          hiddenTaskSeed: 7,
          infernoTier: 1,
          infernoMapSeed: 30
        }
      ),
      'cracked_portal'
    );
    const uncompletedTargetBlocked = usePortal(uncompletedTargetSource, 'force');
    expect(uncompletedTargetBlocked.run?.dungeonId).toBe('demon_tower_1');
    expect(uncompletedTargetBlocked.player.hp).toBe(uncompletedTargetSource.player.hp);
    expect(uncompletedTargetBlocked.log[0]).toMatch(/炼狱难度尚未.*解锁/);

    const blockedSource = atNode(enterSource(2, 2, 1), 'cracked_portal');
    const blocked = usePortal(blockedSource, 'force');
    expect(blocked.run?.dungeonId).toBe('demon_tower_1');
    expect(blocked.run?.clearedNodeIds).not.toContain('cracked_portal');
    expect(blocked.run?.pressureState).toEqual(blockedSource.run?.pressureState);
    expect(blocked.player.hp).toBe(blockedSource.player.hp);
    expect(blocked.inventory).toEqual(blockedSource.inventory);
    expect(blocked.enteredDungeonIds).toEqual(['demon_tower_1']);
    expect(blocked.log[0]).toMatch(/最高只解锁炼狱第 1 层.*不能携带第 2 层/);

    const legalSource = atNode(enterSource(1, 2, 2), 'cracked_portal');
    const transported = usePortal(legalSource, 'force');
    expect(transported.run?.dungeonId).toBe('metro_abyss');
    expect(transported.run?.protocol).toEqual({
      id: 'deep',
      rulesVersion: 1,
      infernoTier: 1
    });
    expect(transported.run?.infernoMap).toBeDefined();
    expect(transported.run?.infernoMap?.nodes[0]?.nodeId).toBe(
      transported.run?.currentNodeId
    );
    expect(transported.enteredDungeonIds).toEqual(['demon_tower_1', 'metro_abyss']);
  });

  it('keeps exact boss gates and adds an aggregate guard for legacy procedural edges', () => {
    const entered = enterInferno(1, 4);
    if (!entered.run?.infernoMap) throw new Error('Expected inferno map');
    const bossNodeId = getBossDefinition('demon_tower_1').nodeId;
    const canonicalSourceNodeId = 'mist_herb_cache';
    const legacySourceNodeId = 'fog_lesser_demon';
    const closedLawState = {
      ...createDungeonLawState('demon_tower_1'),
      law: { kind: 'demon_tower' as const, fogPressure: 2 }
    };
    const openLawState = {
      ...closedLawState,
      law: { kind: 'demon_tower' as const, fogPressure: 0 }
    };
    const atCanonicalGate: GameState = {
      ...entered,
      run: {
        ...entered.run,
        currentNodeId: canonicalSourceNodeId,
        clearedNodeIds: [canonicalSourceNodeId],
        lawState: closedLawState
      }
    };

    expect(getCurrentRouteBlockReason(atCanonicalGate, bossNodeId)).toBeDefined();
    expect(getCurrentLegalAdjacentTargetIds(atCanonicalGate)).not.toContain(bossNodeId);
    expect(moveToNode(atCanonicalGate, bossNodeId).run?.currentNodeId).toBe(
      canonicalSourceNodeId
    );

    const unsafeLegacyMap = {
      ...entered.run.infernoMap,
      nodes: entered.run.infernoMap.nodes.map((node) =>
        node.nodeId === legacySourceNodeId
          ? {
              ...node,
              connectionIds: [...new Set([...node.connectionIds, bossNodeId])].sort()
            }
          : node.nodeId === bossNodeId
            ? {
                ...node,
                connectionIds: [...new Set([...node.connectionIds, legacySourceNodeId])].sort()
              }
            : node
      )
    };
    const atLegacyEdge = (
      lawState: NonNullable<GameState['run']>['lawState']
    ): GameState => ({
      ...entered,
      run: {
        ...entered.run!,
        currentNodeId: legacySourceNodeId,
        clearedNodeIds: [legacySourceNodeId],
        infernoMap: unsafeLegacyMap,
        lawState
      }
    });
    const closedLegacyEdge = atLegacyEdge(closedLawState);
    const openLegacyEdge = atLegacyEdge(openLawState);

    expect(getCurrentRouteBlockReason(closedLegacyEdge, bossNodeId)).toBeDefined();
    expect(getCurrentLegalAdjacentTargetIds(closedLegacyEdge)).not.toContain(bossNodeId);
    expect(moveToNode(closedLegacyEdge, bossNodeId).run?.currentNodeId).toBe(
      legacySourceNodeId
    );
    expect(getCurrentRouteBlockReason(openLegacyEdge, bossNodeId)).toBeUndefined();
    expect(moveToNode(openLegacyEdge, bossNodeId).run?.currentNodeId).toBe(bossNodeId);
  });

  it('guards a restored player already standing on a sealed procedural boss', () => {
    const entered = enterInferno(1, 1);
    if (!entered.run) throw new Error('Expected active run');
    const bossNodeId = getBossDefinition('demon_tower_1').nodeId;
    const sealed: GameState = {
      ...entered,
      run: {
        ...entered.run,
        currentNodeId: bossNodeId,
        lawState: {
          ...createDungeonLawState('demon_tower_1'),
          law: { kind: 'demon_tower', fogPressure: 2 }
        }
      }
    };
    const blocked = selectNode(sealed, bossNodeId);
    const opened = selectNode(
      {
        ...sealed,
        run: {
          ...sealed.run!,
          lawState: {
            ...createDungeonLawState('demon_tower_1'),
            law: { kind: 'demon_tower', fogPressure: 0 }
          }
        }
      },
      bossNodeId
    );

    expect(blocked.phase).toBe('explore');
    expect(blocked.combat).toBeUndefined();
    expect(blocked.log[0]).toContain('首领区域尚未开放');
    expect(opened.phase).toBe('combat');
    expect(opened.combat?.nodeId).toBe(bossNodeId);
  });

  it('discovers only an ordered-reachable hidden task through the real clear flow', () => {
    const entered = enterDungeon(
      infernoHub(1),
      'demon_tower_1',
      'deep',
      undefined,
      {
        flowVersion: 2,
        hiddenTaskSeed: 15,
        infernoTier: 1,
        infernoMapSeed: 6
      }
    );
    if (!entered.run?.infernoMap) throw new Error('Expected inferno map');
    const secondTargetNodeId = 'butcher_turn';
    const firstTargetNodeId = 'ash_pit_trap';
    const constrainedMap = {
      ...entered.run.infernoMap,
      nodes: entered.run.infernoMap.nodes.map((node) => {
        if (node.nodeId === firstTargetNodeId) {
          return { ...node, connectionIds: [secondTargetNodeId] };
        }
        const withoutFirst = node.connectionIds.filter(
          (connectionId) => connectionId !== firstTargetNodeId
        );
        return node.nodeId === secondTargetNodeId
          ? {
              ...node,
              connectionIds: [...new Set([...withoutFirst, firstTargetNodeId])].sort()
            }
          : { ...node, connectionIds: withoutFirst };
      })
    };
    const firstCombat = selectNode(
      {
        ...entered,
        run: {
          ...entered.run,
          currentNodeId: 'fog_lesser_demon',
          infernoMap: constrainedMap
        }
      },
      'fog_lesser_demon'
    );
    const firstCleared = performCombatAction(
      {
        ...firstCombat,
        combat: firstCombat.combat
          ? { ...firstCombat.combat, monsterHp: 1 }
          : undefined
      },
      'attack'
    );
    const discovered = collectReward(
      {
        ...firstCleared,
        run: {
          ...firstCleared.run!,
          currentNodeId: 'broken_sigil_reward'
        }
      }
    );
    const contractState = discovered.run?.routeContractState;
    const definition = contractState
      ? getRouteContractById(contractState.contractId, 'demon_tower_1')
      : undefined;
    const connections = getInfernoConnectionIds(discovered.run?.infernoMap);

    expect(contractState).toBeDefined();
    expect(contractState?.contractId).not.toBe('tower_ash_blade');
    expect(definition).toBeDefined();
    expect(connections).toBeDefined();
    expect(isOrderedRouteContractReachable(
      connections!,
      'broken_sigil_reward',
      definition!.targetNodeIds
    )).toBe(true);
  });

  it('rejects skipped layers and unlocks exactly the next layer after a clear', () => {
    const rejected = enterDungeon(
      infernoHub(2),
      'demon_tower_1',
      'deep',
      undefined,
      { flowVersion: 2, infernoTier: 3, infernoMapSeed: 1 }
    );
    expect(rejected.run).toBeUndefined();
    expect(rejected.log[0]).toContain('必须逐层通关');

    const cleared = resolveExit(readyForExit(enterInferno(2, 2)));
    expect(getInfernoUnlockedTier(cleared, 'demon_tower_1')).toBe(3);
    expect(cleared.run?.lastProtocolSettlement).toMatchObject({
      infernoTier: 2,
      unlockedInfernoTier: 3,
      status: 'succeeded'
    });

    const replayEntry = enterDungeon(
      cleared,
      'demon_tower_1',
      'deep',
      undefined,
      { flowVersion: 2, infernoTier: 1, infernoMapSeed: 3 }
    );
    expect(replayEntry.log[0]).toContain('低层复刷不推进层级');
    expect(replayEntry.log[0]).toContain('通关第 3 层后解锁第 4 层');
    expect(replayEntry.log[0]).not.toContain('通关后解锁下一层');

    const replayed = resolveExit(readyForExit(replayEntry));
    expect(getInfernoUnlockedTier(replayed, 'demon_tower_1')).toBe(3);
    expect(replayed.run?.lastProtocolSettlement).toMatchObject({
      infernoTier: 1,
      unlockedInfernoTier: 3,
      status: 'succeeded'
    });
  });

  it('restores one seed exactly, changes the next entry, and moves along explicit links', () => {
    const first = enterInferno(1, 100);
    const restored = enterInferno(1, 100);
    const rerolled = enterInferno(1, 101);
    expect(first.run?.infernoMap).toEqual(restored.run?.infernoMap);
    expect(first.run?.infernoMap?.nodes).not.toEqual(rerolled.run?.infernoMap?.nodes);

    const dungeon = getCurrentDungeonDefinition(first);
    const startNodeId = first.run?.currentNodeId;
    const targetNodeId = first.run?.infernoMap?.nodes
      .find((node) => node.nodeId === startNodeId)
      ?.connectionIds[0];
    expect(dungeon?.nodes.find((node) => node.id === targetNodeId)).toBeTruthy();
    const movable = first.run
      ? {
          ...first,
          run: {
            ...first.run,
            clearedNodeIds: [first.run.currentNodeId]
          }
        }
      : first;
    const moved = moveToNode(movable, targetNodeId!);
    expect(moved.run?.currentNodeId).toBe(targetNodeId);
  });

  it('raises encounter stats by layer and offers deterministic rolled equipment to modern inferno runs', () => {
    const tierOne = selectNode(atNode(enterInferno(1, 55), 'butcher_turn'), 'butcher_turn');
    const tierTwo = selectNode(atNode(enterInferno(2, 55), 'butcher_turn'), 'butcher_turn');
    expect(tierTwo.combat?.monsterHp).toBeGreaterThan(tierOne.combat?.monsterHp ?? 0);

    const defeated = performCombatAction(
      {
        ...tierTwo,
        combat: tierTwo.combat ? { ...tierTwo.combat, monsterHp: 1 } : undefined
      },
      'attack'
    );
    const offer = defeated.run?.pendingEquipmentOffer;
    expect(offer?.equipmentIds).toHaveLength(3);
    const equipmentId = offer?.equipmentIds[0];
    expect(equipmentId).toBeTruthy();
    expect(offer?.equipmentRolls?.[equipmentId!]).toMatchObject({
      rulesVersion: 1,
      sourceTier: 2
    });

    const selected = resolveEquipmentLoot(defeated, equipmentId);
    const cleared = resolveExit(readyForExit(selected));
    expect(cleared.ownedEquipment).toContain(equipmentId);
    expect(cleared.equipmentRolls?.[equipmentId!]?.sourceTier).toBe(2);
    expect(cleared.run?.lastEquipmentRollSettlement?.outcome).toBe('acquired');
  });

  it('keeps a stronger duplicate and converts the weaker candidate into reward points', () => {
    const equipmentId = 'armor_piercing_sword' as const;
    const equipment = EQUIPMENT[equipmentId];
    const stronger = createEquipmentRoll({
      equipmentId,
      slot: equipment.slot,
      base: equipment.base,
      sourceTier: 4,
      seed: 4
    });
    const weaker = Array.from({ length: 128 }, (_, index) =>
      createEquipmentRoll({
        equipmentId,
        slot: equipment.slot,
        base: equipment.base,
        sourceTier: 2,
        seed: index + 1
      })
    ).find((candidate) => compareEquipmentRolls(candidate, stronger) < 0);
    if (!weaker) throw new Error('Expected a weaker deterministic duplicate');
    const entered = enterInferno(2, 77, 4);
    if (!entered.run) throw new Error('Expected active run');
    const prepared: GameState = {
      ...entered,
      ownedEquipment: [...entered.ownedEquipment, equipmentId],
      equipmentLevels: { ...entered.equipmentLevels, [equipmentId]: 1 },
      equipmentRolls: { ...entered.equipmentRolls, [equipmentId]: stronger },
      run: {
        ...entered.run,
        lootBag: addRunLoot(entered.run.lootBag, { equipmentIds: [equipmentId] }),
        carriedEquipmentRolls: { [equipmentId]: weaker }
      }
    };
    const rewardPointsBefore = prepared.rewardPoints;
    const cleared = resolveExit(readyForExit(prepared));

    expect(cleared.equipmentRolls?.[equipmentId]).toEqual(stronger);
    expect(cleared.run?.lastEquipmentRollSettlement).toMatchObject({
      outcome: 'salvaged',
      salvageRewardPoints: 120
    });
    expect(cleared.rewardPoints).toBeGreaterThan(rewardPointsBefore);
  });

  it('compares an owned unequipped fixed base through the same temporary slot before settlement', () => {
    const equipmentId = 'spirit_robe' as const;
    const weakerThanFixed: EquipmentRoll = {
      rulesVersion: 1,
      seed: 148,
      sourceTier: 1,
      itemPower: 1_100,
      quality: 'rare',
      affixes: [
        { stat: 'maxHp', value: 17, minimum: 16, maximum: 20, greater: false },
        { stat: 'defense', value: 3, minimum: 2, maximum: 4, greater: false },
        { stat: 'artPower', value: 2, minimum: 1, maximum: 3, greater: false }
      ]
    };
    const entered = enterInferno(1, 148);
    if (!entered.run) throw new Error('Expected active run');
    const prepared: GameState = {
      ...entered,
      ownedEquipment: [...entered.ownedEquipment, equipmentId],
      equipmentLevels: { ...entered.equipmentLevels, [equipmentId]: 1 },
      run: {
        ...entered.run,
        lootBag: addRunLoot(entered.run.lootBag, { equipmentIds: [equipmentId] }),
        carriedEquipmentRolls: { [equipmentId]: weakerThanFixed }
      }
    };
    const evaluation = evaluateEquipmentRollCandidate(
      prepared,
      equipmentId,
      weakerThanFixed
    );
    const cleared = resolveExit(readyForExit(prepared));

    expect(prepared.equipped.armor).not.toBe(equipmentId);
    expect(evaluation.currentRoll).toBeUndefined();
    expect(evaluation.currentPower).toBeGreaterThan(evaluation.candidatePower ?? 0);
    expect(evaluation.comparison).toBeLessThan(0);
    expect(cleared.equipmentRolls?.[equipmentId]).toBeUndefined();
    expect(cleared.run?.lastEquipmentRollSettlement?.outcome).toBe('salvaged');
  });

  it('settles a full-health lethal inferno trap instead of leaving a zero-health run active', () => {
    const entered = enterInferno(25, 25);
    const trapped = atNode(entered, 'blood_rune_trap');
    const failed = handleTrap(trapped, 'risk');

    expect(trapped.player.hp).toBe(trapped.player.maxHp);
    expect(failed.player.hp).toBe(0);
    expect(failed.phase).toBe('result');
    expect(failed.run?.clearedNodeIds).toContain('blood_rune_trap');
    expect(failed.run?.lastLootSettlement).toBeDefined();
  });

  it('applies the inferno reward-point multiplier to capture rewards exactly once', () => {
    const baseHub = infernoHub(2);
    const captureHub = configureTacticalLoadout(
      {
        ...baseHub,
        inventory: { ...baseHub.inventory, capture_net: 1 }
      },
      ['capture_net']
    );
    const entered = enterDungeon(
      captureHub,
      'demon_tower_1',
      'deep',
      undefined,
      {
        flowVersion: 2,
        hiddenTaskSeed: 7,
        infernoTier: 2,
        infernoMapSeed: 66
      }
    );
    const started = selectNode(atNode(entered, 'fog_lesser_demon'), 'fog_lesser_demon');
    const weakened: GameState = {
      ...started,
      combat: started.combat ? { ...started.combat, monsterHp: 1 } : started.combat
    };
    const beforeRewardPoints = weakened.run?.lootBag.rewardPoints ?? 0;
    const captured = capturePet(weakened, 'mist_kitten');
    const expectedCaptureRewardPoints = scaleInfernoRewardPoints(
      Math.floor(MONSTERS.fog_lesser_demon.rewardPoints * 0.35),
      2
    );

    expect(captured.phase).toBe('explore');
    expect((captured.run?.lootBag.rewardPoints ?? 0) - beforeRewardPoints)
      .toBe(expectedCaptureRewardPoints);
    expect(captured.log[0]).toContain(`${expectedCaptureRewardPoints} 点奖励`);
  });

  it('rejects a weaker higher-layer roll without lowering power or leaving health above its cap', () => {
    const equipmentId = 'guardian_plate' as const;
    const strongerLowerLayer: EquipmentRoll = {
      rulesVersion: 1,
      seed: 1,
      sourceTier: 1,
      itemPower: 1_120,
      quality: 'rare',
      affixes: [
        { stat: 'maxHp', value: 29, minimum: 20, maximum: 30, greater: false },
        { stat: 'defense', value: 9, minimum: 4, maximum: 10, greater: false }
      ]
    };
    const weakerHigherLayer: EquipmentRoll = {
      rulesVersion: 1,
      seed: 2,
      sourceTier: 2,
      itemPower: 2_105,
      quality: 'rare',
      affixes: [
        { stat: 'maxHp', value: 28, minimum: 21, maximum: 31, greater: false },
        { stat: 'defense', value: 8, minimum: 5, maximum: 11, greater: false }
      ]
    };
    const entered = enterInferno(2, 91, 2);
    if (!entered.run) throw new Error('Expected active run');
    const equipped: GameState = {
      ...entered,
      ownedEquipment: [...entered.ownedEquipment, equipmentId],
      equipmentLevels: { ...entered.equipmentLevels, [equipmentId]: 1 },
      equipmentRolls: {
        ...entered.equipmentRolls,
        [equipmentId]: strongerLowerLayer
      },
      equipped: { ...entered.equipped, armor: equipmentId }
    };
    const maxHp = getDerivedStats(equipped).maxHp;
    const prepared: GameState = {
      ...equipped,
      player: { ...equipped.player, hp: maxHp, maxHp },
      run: {
        ...entered.run,
        lootBag: addRunLoot(entered.run.lootBag, { equipmentIds: [equipmentId] }),
        carriedEquipmentRolls: { [equipmentId]: weakerHigherLayer }
      }
    };
    const powerBefore = getPlayerPower(prepared);
    const cleared = resolveExit(readyForExit(prepared));

    expect(cleared.equipmentRolls?.[equipmentId]).toEqual(strongerLowerLayer);
    expect(cleared.run?.lastEquipmentRollSettlement?.outcome).toBe('salvaged');
    expect(cleared.run?.lastAutoEquippedEquipmentIds).toEqual([]);
    expect(getPlayerPower(cleared)).toBe(powerBefore);
    expect(cleared.player.maxHp).toBe(getDerivedStats(cleared).maxHp);
    expect(cleared.player.hp).toBeLessThanOrEqual(cleared.player.maxHp);
  });
});
