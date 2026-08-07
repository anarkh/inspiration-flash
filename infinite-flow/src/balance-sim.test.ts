import { describe, expect, it } from 'vitest';
import {
  analyzeCampaignBalance,
  createSevenDungeonEquipmentHuntFixture,
  createSevenDungeonFieldSurveyFixture,
  getBalanceVerdictFromWarnings,
  simulateLostShelterPortalRing,
  simulateBroadcastSpecializationRoutes,
  simulateCampaignBalance,
  simulateCombatReplayStageBalanceScenario,
  simulateCompanionAssistBalance,
  simulateEightDungeonEquipmentMemoryHunts,
  simulateEightDungeonRunPursuits,
  simulateEightDungeonRouteContracts,
  simulateEquipmentCommissionRoute,
  simulateEquipmentTempering,
  simulateFalseTestimonySpecializationRoutes,
  simulateGenesisSpecializationRoute,
  simulateLegacyAuctionCourtLawScenario,
  simulateLostShelterSpecializationRoutes,
  simulateMethodTechniqueRanks,
  simulateMirrorCycleCityLawScenario,
  simulatePanopticonCityBalanceScenario,
  simulateRedactionScriptoriumLawRoute,
  simulateSevenDungeonDeepRoute,
  simulateSevenDungeonEquipmentHuntRoute,
  simulateSevenDungeonImprintRoute,
  simulateSevenDungeonLawRoute,
  simulateSevenDungeonPressureRoute,
  simulateSevenDungeonRunRelicRoute,
  simulateSevenDungeonFieldSurveyRoute,
  simulateSevenDungeonSoulRoute,
  simulateSevenDungeonVictoryRoute
} from './balance-sim';
import type { CampaignRewardPlan, SevenDungeonLawRouteSummary } from './balance-sim';
import { getBossDefinition } from './boss-system';
import {
  DUNGEON_ELITE_MONSTERS,
  DUNGEON_EQUIPMENT_POOLS,
  getDungeonLootOffer
} from './dungeon-loot';
import { EQUIPMENT_HUNT_DEFINITIONS } from './equipment-hunts';
import {
  EQUIPMENT_MEMORY_CATALOG,
  EQUIPMENT_MEMORY_EQUIPMENT_CATALOG
} from './equipment-memory-hunts';
import { getEquipmentRelicConduitByEquipmentId } from './equipment-relic-conduits';
import { getDungeonRouteGates } from './dungeon-routes';
import { FIELD_SURVEY_CATALOG } from './field-surveys';
import {
  DUNGEONS,
  DUNGEON_ORDER,
  RUN_PURSUIT_CATALOG,
  createInitialState,
  enterDungeon,
  listRouteContracts
} from './game';
import { getImprintRunProtocolDefinitions, getRunProtocolDefinition } from './run-protocols';
import { RUN_RELIC_IDS } from './run-relics';
import { calculateRunPressureBonus, getRunPressureStatus } from './run-pressure';
import { getWeaponSkillDefinition } from './weapon-skills';
import { METHOD_TECHNIQUE_CATALOG } from './method-cultivation';
import { MAIN_GOD_TASKS, MAINLINE_TASKS } from './task-system';

let cachedRunPursuitSimulation: ReturnType<typeof simulateEightDungeonRunPursuits> | undefined;
let cachedMethodTechniqueSimulation: ReturnType<typeof simulateMethodTechniqueRanks> | undefined;
let cachedRedactionSimulation: ReturnType<typeof simulateRedactionScriptoriumLawRoute> | undefined;
let cachedBroadcastSpecializations: ReturnType<typeof simulateBroadcastSpecializationRoutes> | undefined;
let cachedLostShelterSpecializations: ReturnType<typeof simulateLostShelterSpecializationRoutes> | undefined;
let cachedFalseTestimonySpecializations: ReturnType<typeof simulateFalseTestimonySpecializationRoutes> | undefined;
let cachedPanopticonScenario: ReturnType<typeof simulatePanopticonCityBalanceScenario> | undefined;

function getRunPursuitSimulation(): ReturnType<typeof simulateEightDungeonRunPursuits> {
  cachedRunPursuitSimulation ??= simulateEightDungeonRunPursuits();
  return cachedRunPursuitSimulation;
}

function getMethodTechniqueSimulation(): ReturnType<typeof simulateMethodTechniqueRanks> {
  cachedMethodTechniqueSimulation ??= simulateMethodTechniqueRanks();
  return cachedMethodTechniqueSimulation;
}

function getRedactionSimulation(): ReturnType<typeof simulateRedactionScriptoriumLawRoute> {
  cachedRedactionSimulation ??= simulateRedactionScriptoriumLawRoute();
  return cachedRedactionSimulation;
}

function getBroadcastSpecializations(): ReturnType<typeof simulateBroadcastSpecializationRoutes> {
  cachedBroadcastSpecializations ??= simulateBroadcastSpecializationRoutes();
  return cachedBroadcastSpecializations;
}

function getLostShelterSpecializations(): ReturnType<typeof simulateLostShelterSpecializationRoutes> {
  cachedLostShelterSpecializations ??= simulateLostShelterSpecializationRoutes();
  return cachedLostShelterSpecializations;
}

function getFalseTestimonySpecializations(): ReturnType<typeof simulateFalseTestimonySpecializationRoutes> {
  cachedFalseTestimonySpecializations ??= simulateFalseTestimonySpecializationRoutes();
  return cachedFalseTestimonySpecializations;
}

function getPanopticonScenario(): ReturnType<typeof simulatePanopticonCityBalanceScenario> {
  cachedPanopticonScenario ??= simulatePanopticonCityBalanceScenario();
  return cachedPanopticonScenario;
}

function getRunPursuitDeterminismProjection(
  result: ReturnType<typeof simulateEightDungeonRunPursuits>
) {
  return {
    completedDungeonIds: result.baseState.completedDungeonIds,
    summaries: result.summaries.map((summary) => ({
      dungeonId: summary.dungeonId,
      entryStatus: summary.entryStatus,
      firstNonExitClearNodeIds: summary.firstNonExitClearNodeIds,
      spawnNodeIdObserved: summary.spawnNodeIdObserved,
      lureMovements: summary.lureMovements,
      containmentNodeCleared: summary.containmentNodeCleared,
      bossNodeCleared: summary.bossNodeCleared,
      exitNodeCleared: summary.exitNodeCleared,
      pursuitMaterialDelta: summary.pursuitMaterialDelta,
      settlement: summary.settlement,
      duplicateExitMaterialDelta: summary.duplicateExitMaterialDelta,
      coexistence: summary.coexistence
    })),
    controls: result.controls
  };
}

describe('full campaign catalog invariants', () => {
  it('keeps the Tier 19 chapter and task totals exact', () => {
    expect(DUNGEON_ORDER).toHaveLength(19);
    expect(DUNGEON_ORDER.at(-1)).toBe('panopticon_city');
    expect(DUNGEONS.panopticon_city).toMatchObject({
      name: '天幕监察城',
      tier: 19,
      recommendedPower: 1350
    });
    expect(DUNGEONS.combat_replay_stage).toMatchObject({
      name: '战痕复演场',
      tier: 18,
      recommendedPower: 1240
    });
    expect(DUNGEONS.false_testimony_court).toMatchObject({ tier: 17, recommendedPower: 1140 });
    expect(DUNGEONS.false_testimony_court.nodes).toHaveLength(30);
    expect(DUNGEONS.false_testimony_court.grid).toMatchObject({ width: 6, height: 5 });
    expect(EQUIPMENT_MEMORY_EQUIPMENT_CATALOG).toHaveLength(58);
    expect(EQUIPMENT_MEMORY_CATALOG).toHaveLength(19);
    expect(EQUIPMENT_MEMORY_EQUIPMENT_CATALOG.length * EQUIPMENT_MEMORY_CATALOG.length).toBe(1102);
    expect(DUNGEON_ORDER.flatMap((dungeonId) => listRouteContracts(dungeonId))).toHaveLength(57);
    const testimonyContracts = listRouteContracts('false_testimony_court');
    expect(testimonyContracts.map((contract) => ({
      targetNodeIds: contract.targetNodeIds,
      rewardPoints: contract.rewardPoints
    }))).toEqual([
      { targetNodeIds: ['hostile_witness_north', 'soul_recharge_verdict'], rewardPoints: 760 },
      { targetNodeIds: ['voice_filter_trap', 'judgment_lock'], rewardPoints: 760 },
      { targetNodeIds: ['perjury_hound_omega', 'testimony_hall'], rewardPoints: 760 }
    ]);
    const testimonyPositions = new Map(
      DUNGEONS.false_testimony_court.nodes.map((node) => [node.id, node.position])
    );
    expect(testimonyContracts.map((contract) => {
      const [from, to] = contract.targetNodeIds.map((nodeId) => testimonyPositions.get(nodeId));
      return from && to ? Math.abs(from.x - to.x) + Math.abs(from.y - to.y) : -1;
    })).toEqual([4, 4, 3]);
    expect(MAINLINE_TASKS).toHaveLength(19);
    expect(MAIN_GOD_TASKS).toHaveLength(63);
    expect(MAIN_GOD_TASKS.filter((task) => task.kind === 'side')).toHaveLength(44);
    const taskRewardPointTotal = MAIN_GOD_TASKS.reduce(
      (total, task) => total + (task.reward.rewardPoints ?? 0),
      0
    );
    expect(taskRewardPointTotal).toBe(5560);
  });
});

describe('panopticon city balance scenario', () => {
  it('clears an ordinary encounter and the boss on the conservative terminal build', () => {
    const result = getPanopticonScenario();
    const shadow = result.routes.shadow;

    expect(result).toMatchObject({
      dungeonId: 'panopticon_city',
      recommendedPower: 1350,
      externalStatePreserved: true,
      conservativeBuild: {
        readiness: expect.not.stringMatching('deadly'),
        equippedEquipmentIds: [
          'blindline_cutter',
          'predictive_visor',
          'matte_shell',
          'inverse_prism'
        ]
      }
    });
    expect(result.conservativeBuild.playerPower).toBeGreaterThanOrEqual(1350);
    expect(shadow).toMatchObject({
      route: 'shadow',
      pursuitIsolated: true,
      completedRelayCount: 3,
      playerSurvived: true,
      completed: true,
      ordinary: {
        nodeId: 'exposure_double',
        monsterId: 'exposure_double',
        cleared: true
      },
      boss: {
        nodeId: 'all_sight_warden',
        monsterId: 'all_sight_warden',
        cleared: true,
        snapshot: { route: 'shadow' }
      }
    });
    expect(shadow.routeEvidence.movements.every((movement) => movement.legal)).toBe(true);
  });

  it('keeps the low build dangerous through a real ordinary combat attempt', () => {
    const low = getPanopticonScenario().lowBuild;

    expect(low).toMatchObject({
      readiness: 'deadly',
      pursuitIsolated: true,
      ordinaryNodeId: 'exposure_double_patrol',
      ordinaryMonsterId: 'exposure_double',
      dangerous: true
    });
    expect(low.turnsAttempted).toBeGreaterThan(0);
    expect(low.playerPower).toBeLessThan(1350);
    expect(low.cleared && low.survived && low.hpAfterCombat >= low.hpBeforeCombat / 2).toBe(false);
  });

  it('keeps shadow safe while decoy and refraction expose their authored risk-reward', () => {
    const { shadow, decoy, refraction } = getPanopticonScenario().routes;

    for (const route of [shadow, decoy, refraction]) {
      expect(route).toMatchObject({
        completedRelayCount: 3,
        playerSurvived: true,
        completed: true,
        ordinary: { cleared: true },
        boss: { cleared: true, snapshot: { route: route.route } }
      });
      expect(route.routeEvidence.movements.every((movement) => movement.legal)).toBe(true);
    }
    expect(decoy.exposureCount).toBeGreaterThan(shadow.exposureCount);
    expect(decoy.decoyRewardsGranted).toBe(3);
    expect(decoy.routeRewardPoints).toBeGreaterThan(shadow.routeRewardPoints);
    expect(refraction.exposureCount).toBeGreaterThan(shadow.exposureCount);
    expect(refraction.refractionCharges).toBe(3);
    expect(refraction.boss.snapshot?.refractionCharges).toBe(3);
  });

  it('keeps protocol scaling monotonic and the isolated Tier 18 control green', () => {
    const result = getPanopticonScenario();

    expect(result.protocols.map((row) => row.protocolId)).toEqual(['standard', 'imprint', 'deep']);
    expect(result.protocols.map((row) => row.enemyStatMultiplierPercent)).toEqual([100, 162, 198]);
    for (const metric of ['observedMaxHp', 'observedAttack', 'observedArtPower'] as const) {
      expect(result.protocols[1][metric]).toBeGreaterThan(result.protocols[0][metric]);
      expect(result.protocols[2][metric]).toBeGreaterThan(result.protocols[1][metric]);
    }
    expect(result.legacyTier18).toEqual({
      ordinaryCleared: true,
      bossCleared: true,
      playerSurvived: true,
      pursuitIsolated: true
    });
  });
});

describe('campaign run pursuit simulation', () => {
  it('contains and banks every authored pursuit through real chapter routes', () => {
    const result = getRunPursuitSimulation();

    expect(result.baseState.completedDungeonIds).toEqual(DUNGEON_ORDER);
    expect(result.summaries.map((summary) => summary.dungeonId)).toEqual(DUNGEON_ORDER);
    for (const summary of result.summaries) {
      const checkpoint = summary.dungeonId;
      expect(summary.entryStatus, checkpoint).toBe('dormant');
      expect(summary.spawnedAfterClearCount, checkpoint).toBe(6);
      expect(summary.firstNonExitClearNodeIds, checkpoint).toHaveLength(6);
      expect(
        summary.firstNonExitClearNodeIds.every(
          (nodeId) => DUNGEONS[summary.dungeonId].nodes.find((node) => node.id === nodeId)?.type !== 'exit'
        ),
        checkpoint
      ).toBe(true);
      expect(summary.spawnNodeIdObserved, checkpoint).toBe(summary.definition.spawnNodeId);
      expect(summary.repeatedClearPreserved, checkpoint).toBe(true);
      expect(summary.containmentNodeCleared, checkpoint).toBe(true);
      expect(summary.contained, checkpoint).toBe(true);
      expect(summary.lureMovements.length, checkpoint).toBeGreaterThan(0);
      expect(
        summary.lureMovements.every(
          (movement) =>
            movement.predictionMatched &&
            movement.sideSystemsUnchanged &&
            movement.clearedNodeIdsUnchanged &&
            movement.clueStateUnchanged &&
            movement.eventStateUnchanged &&
            movement.offerStateUnchanged &&
            movement.pursuitGridStepDistance <= 1
        ),
        checkpoint
      ).toBe(true);
      expect(summary.bossNodeCleared, checkpoint).toBe(true);
      expect(summary.exitNodeCleared, checkpoint).toBe(true);
      expect(summary.completed, checkpoint).toBe(true);
      expect(summary.pursuitMaterialDelta, checkpoint).toBe(1);
      expect(summary.settlement, checkpoint).toMatchObject({
        reason: 'successful_exit',
        materialId: summary.materialId,
        rewarded: true,
        state: { dungeonId: summary.dungeonId, status: 'contained' }
      });
      expect(summary.duplicateExitMaterialDelta, checkpoint).toBe(0);
      expect(summary.coexistence, checkpoint).toMatchObject({
        routeContractActiveAtEntry: true,
        protocolId: 'imprint',
        protocolActiveAtEntry: true,
        pressureActiveAtEntry: true,
        movementIsolationPreserved: true
      });
      expect(summary.routeEvidence.movements.every((movement) => movement.legal), checkpoint).toBe(true);
      if (summary.dungeonId === 'combat_replay_stage') {
        expect(
          summary.routeEvidence.tacticalLoadoutTrace.some((trace) =>
            trace.preparedItemIds.includes('healing_pill')
          )
        ).toBe(true);
      }
    }
  });

  it('keeps first clears, legacy saves, and malformed saves explicitly safe', () => {
    const { entry } = getRunPursuitSimulation().controls;

    expect(entry.firstClearEntries.map((control) => control.dungeonId)).toEqual(DUNGEON_ORDER);
    expect(
      entry.firstClearEntries.every(
        (control) => control.status === 'disabled' && control.legacyDisabled === false
      )
    ).toBe(true);
    expect(entry.legacy).toEqual({
      fieldAbsentBefore: true,
      fieldAbsentAfter: true,
      legacyDisabledBefore: true,
      legacyDisabledAfter: true,
      successfulPlayerMove: true,
      pursuitLogDelta: 0
    });
    expect(entry.malformed).toEqual({
      snapshotBefore: '{"status":"stalking"}',
      snapshotAfter: '{"status":"stalking"}',
      legacyDisabledBefore: true,
      legacyDisabledAfter: true,
      successfulPlayerMove: true,
      pursuitLogDelta: 0
    });
  });

  it('advances one grid step only on successful moves and obeys every movement lock', () => {
    const { movement } = getRunPursuitSimulation().controls;

    expect(movement.successfulMove).toMatchObject({
      moved: true,
      contact: false,
      pursuitGridStepDistance: 1,
      predictionMatched: true,
      clearedNodeIdsUnchanged: true,
      clueStateUnchanged: true,
      eventStateUnchanged: true,
      offerStateUnchanged: true,
      sideSystemsUnchanged: true
    });
    expect(movement.repeatedClearPreserved).toBe(true);
    expect(movement.playerLawBlock).toMatchObject({
      playerPositionPreserved: true,
      pursuitPreserved: true
    });
    expect(movement.playerLawBlock.blockReason.length).toBeGreaterThan(0);
    expect(movement.pursuitLawMove).toMatchObject({
      moved: true,
      lawChangedPursuitStep: true,
      predictionMatched: true,
      sideSystemsUnchanged: true
    });
    expect(movement.pursuitLawMove.lawBlockedEdgeCount).toBeGreaterThan(0);
    expect(movement.combatMove).toMatchObject({
      combatRemainedActive: true,
      playerPositionPreserved: true,
      pursuitPreserved: true
    });
  });

  it('applies exact contact damage, spawn reset, and one consumed grace move', () => {
    const { contact } = getRunPursuitSimulation().controls;

    expect(contact.hpBefore - contact.hpAfter).toBe(contact.expectedDamage);
    expect(contact.runDamageAfter - contact.runDamageBefore).toBe(contact.expectedDamage);
    expect(contact.contactsAfter).toBe(contact.contactsBefore + 1);
    expect(contact.resetSpawnNodeId).toBe(RUN_PURSUIT_CATALOG[contact.dungeonId].spawnNodeId);
    expect(contact.contactMove).toMatchObject({
      moved: true,
      contact: true,
      contactsBefore: contact.contactsBefore,
      contactsAfter: contact.contactsAfter,
      graceMovesAfter: 1,
      pursuitGridStepDistance: 1
    });
    expect(contact.graceMove).toMatchObject({
      moved: false,
      contact: false,
      graceMovesBefore: 1,
      graceMovesAfter: 0,
      pursuitGridStepDistance: 0
    });
    expect(contact.graceMove.pursuitToNodeId).toBe(contact.graceMove.pursuitFromNodeId);
    expect(contact.resumedMove).toMatchObject({
      moved: true,
      contact: false,
      graceMovesBefore: 0,
      pursuitGridStepDistance: 1
    });
  });

  it('adds fusion last at exactly fifteen percent and never grants its material', () => {
    const fusion = getRunPursuitSimulation().controls.bossFusion;

    expect(fusion.protocolId).toBe('imprint');
    expect(fusion.pressureClearedNodeCount).toBeGreaterThanOrEqual(6);
    expect(fusion.preFusionLayersMatched).toBe(true);
    expect(fusion.finalFifteenPercentMatched).toBe(true);
    for (const statId of ['maxHp', 'attack', 'artPower', 'defense', 'speed'] as const) {
      expect(fusion.fusedStats[statId], statId).toBe(Math.ceil(fusion.baselineStats[statId] * 1.15));
    }
    expect(fusion.fusionDescriptionCount).toBe(1);
    expect(fusion.pursuitStatusAtBoss).toBe('fused');
    expect(fusion.pursuitMaterialDelta).toBe(0);
    expect(fusion.settlement).toMatchObject({
      reason: 'successful_exit',
      rewarded: false,
      state: { dungeonId: fusion.dungeonId, status: 'fused' }
    });
  });

  it('covers stable, forced, and contained cross-portal terminal outcomes', () => {
    const portals = getRunPursuitSimulation().controls.portals;

    expect(portals.stable).toMatchObject({
      targetStatus: 'disabled',
      materialDelta: 0,
      settlement: {
        reason: 'stable_portal',
        rewarded: false,
        state: { dungeonId: portals.sourceDungeonId, status: 'repelled' }
      }
    });
    expect(portals.forced).toMatchObject({
      targetStatus: 'stalking',
      targetSpawnNodeId: RUN_PURSUIT_CATALOG[portals.targetDungeonId].spawnNodeId,
      contactsAfter: portals.forced.contactsBefore,
      graceMovesAfter: 1,
      materialDelta: 0,
      settlement: {
        reason: 'forced_portal',
        rewarded: false,
        state: { dungeonId: portals.sourceDungeonId, status: 'stalking' }
      },
      graceMove: { moved: false, graceMovesBefore: 1, graceMovesAfter: 0 }
    });
    expect(portals.contained.map((control) => control.choice)).toEqual(['stabilize', 'force']);
    for (const control of portals.contained) {
      expect(control).toMatchObject({
        crossedStatus: 'disabled',
        originDungeonId: portals.sourceDungeonId,
        portalSettlement: {
          reason: control.choice === 'stabilize' ? 'stable_portal' : 'forced_portal',
          rewarded: false,
          state: { dungeonId: portals.sourceDungeonId, status: 'contained' }
        }
      });
      expect(control.outcomes.map((outcome) => outcome.reason)).toEqual([
        'successful_exit',
        'retreat',
        'failure'
      ]);
      expect(control.outcomes.map((outcome) => outcome.materialDelta)).toEqual([1, 0, 0]);
      expect(control.outcomes.map((outcome) => outcome.settlement.rewarded)).toEqual([true, false, false]);
      expect(
        control.outcomes.every(
          (outcome) =>
            outcome.settlement.state.dungeonId === portals.sourceDungeonId &&
            outcome.settlement.state.status === 'contained'
        )
      ).toBe(true);
    }
  });

  it('coexists without movement pollution and repeats a key projection exactly', () => {
    const first = getRunPursuitSimulation();
    const featureKinds = new Set(first.summaries.map((summary) => summary.coexistence.featureKind));

    expect(featureKinds).toEqual(new Set(['equipment_hunt', 'equipment_memory_hunt']));
    expect(
      first.summaries.every(
        (summary) =>
          summary.coexistence.routeContractActiveAtEntry &&
          summary.coexistence.protocolActiveAtEntry &&
          summary.coexistence.pressureActiveAtEntry &&
          summary.lureMovements.every((movement) => movement.sideSystemsUnchanged)
      )
    ).toBe(true);
    const repeated = simulateEightDungeonRunPursuits();
    expect(getRunPursuitDeterminismProjection(repeated)).toEqual(
      getRunPursuitDeterminismProjection(first)
    );
  });
});

describe('campaign route contract simulation', () => {
  it('banks every first catalog contract in order and rejects a real target2-first control', () => {
    const result = simulateEightDungeonRouteContracts();

    expect(result.baseState.completedDungeonIds).toEqual(DUNGEON_ORDER);
    expect(result.summaries).toHaveLength(DUNGEON_ORDER.length);
    expect(result.summaries.map((summary) => summary.dungeonId)).toEqual(DUNGEON_ORDER);
    expect(DUNGEON_ORDER).toHaveLength(19);
    expect(DUNGEON_ORDER.flatMap((dungeonId) => listRouteContracts(dungeonId))).toHaveLength(57);

    for (const summary of result.summaries) {
      const expectedContract = listRouteContracts(summary.dungeonId)[0];
      const expectedRewardPoints = summary.dungeonId === 'legacy_auction_court'
        ? 560
        : summary.dungeonId === 'genesis_vault'
          ? 600
          : summary.dungeonId === 'silent_broadcast_tower'
            ? 650
            : summary.dungeonId === 'lost_shelter'
              ? 700
              : summary.dungeonId === 'false_testimony_court'
                ? 760
              : summary.dungeonId === 'combat_replay_stage'
                ? 820
              : summary.dungeonId === 'panopticon_city'
                ? 880
            : 100 + summary.tier * 35;
      const route = summary.orderedRoute;
      const clearedNodeIds = route.finalState.run?.clearedNodeIds ?? [];
      const clearedNodeTypes = clearedNodeIds.map(
        (nodeId) => DUNGEONS[summary.dungeonId].nodes.find((node) => node.id === nodeId)?.type
      );

      expect(summary.contract).toBe(expectedContract);
      expect(summary.expectedRewardPoints).toBe(expectedRewardPoints);
      expect(summary.contract.rewardPoints).toBe(expectedRewardPoints);
      expect(route.targetClearOrder).toEqual([...summary.contract.targetNodeIds]);
      expect(route.target2ClearedBeforeTarget1).toBe(false);
      expect(route.contractStateBeforeExit).toMatchObject({
        contractId: summary.contract.id,
        status: 'secured',
        completedTargetCount: 2
      });
      expect(route.settlement).toMatchObject({
        state: {
          contractId: summary.contract.id,
          status: 'banked',
          completedTargetCount: 2
        },
        rewardPoints: expectedRewardPoints,
        rewarded: true
      });
      expect(route.observedContractRewardPoints).toBe(expectedRewardPoints);
      expect(route.lootBagBeforeExit).toEqual(route.retainedLootAfterExit);
      expect(route.lootBagUnchangedByContractSettlement).toBe(true);
      expect(route.finalState.run?.lootBag.rewardPoints).toBe(0);
      expect(route.finalState.run?.routeContractState?.status).toBe('banked');
      expect(clearedNodeTypes).toContain('monster');
      expect(clearedNodeTypes).toContain('trap');
      expect(clearedNodeTypes).toContain('reward');
      expect(route.bossNodeCleared).toBe(true);
      expect(route.bossSealCleared).toBe(true);
      expect(route.exitNodeCleared).toBe(true);
      expect(route.completed).toBe(true);
      expect(route.routeEvidence.movements.every((movement) => movement.legal)).toBe(true);
    }

    const { contract, route } = result.outOfOrderControl;
    expect(contract).toBe(listRouteContracts(contract.dungeonId)[2]);
    expect(route.targetClearOrder[0]).toBe(contract.targetNodeIds[1]);
    expect(route.target2ClearedBeforeTarget1).toBe(true);
    expect(route.contractStateBeforeExit).toMatchObject({
      status: 'failed',
      reason: 'out_of_order',
      completedTargetCount: 0
    });
    expect(route.settlement).toMatchObject({
      state: { status: 'failed', reason: 'out_of_order', completedTargetCount: 0 },
      rewardPoints: 0,
      rewarded: false
    });
    expect(route.observedContractRewardPoints).toBe(0);
    expect(route.finalState.run?.routeContractState).toMatchObject({
      status: 'failed',
      reason: 'out_of_order'
    });
    expect(route.bossNodeCleared).toBe(true);
    expect(route.exitNodeCleared).toBe(true);
    expect(route.completed).toBe(true);

    const repeated = simulateEightDungeonRouteContracts();
    expect(
      repeated.summaries.map((summary) => ({
        contractId: summary.contract.id,
        targetClearOrder: summary.orderedRoute.targetClearOrder,
        movements: summary.orderedRoute.routeEvidence.movements,
        contractReward: summary.orderedRoute.observedContractRewardPoints
      }))
    ).toEqual(
      result.summaries.map((summary) => ({
        contractId: summary.contract.id,
        targetClearOrder: summary.orderedRoute.targetClearOrder,
        movements: summary.orderedRoute.routeEvidence.movements,
        contractReward: summary.orderedRoute.observedContractRewardPoints
      }))
    );
    expect(repeated.outOfOrderControl.route.targetClearOrder).toEqual(route.targetClearOrder);
    expect(repeated.outOfOrderControl.route.settlement).toEqual(route.settlement);
  });
});

describe('companion assist balance simulation', () => {
  it('proves every companion rank through the frozen run snapshot and real assist API', () => {
    const result = simulateCompanionAssistBalance();

    expect(result.matrix).toHaveLength(9);
    expect(
      result.matrix.map(({ companionId, rank, snapshot, effect }) => ({
        companionId,
        rank,
        snapshot,
        effect
      }))
    ).toEqual([
      { companionId: 'qin_che', rank: 1, snapshot: { rulesVersion: 1, companionId: 'qin_che', rank: 1 }, effect: { guarding: true, focusGain: 0, healPercent: 0 } },
      { companionId: 'qin_che', rank: 2, snapshot: { rulesVersion: 1, companionId: 'qin_che', rank: 2 }, effect: { guarding: true, focusGain: 1, healPercent: 0 } },
      { companionId: 'qin_che', rank: 3, snapshot: { rulesVersion: 1, companionId: 'qin_che', rank: 3 }, effect: { guarding: true, focusGain: 1, healPercent: 8 } },
      { companionId: 'zhou_yingxue', rank: 1, snapshot: { rulesVersion: 1, companionId: 'zhou_yingxue', rank: 1 }, effect: { guarding: false, focusGain: 1, healPercent: 0 } },
      { companionId: 'zhou_yingxue', rank: 2, snapshot: { rulesVersion: 1, companionId: 'zhou_yingxue', rank: 2 }, effect: { guarding: false, focusGain: 2, healPercent: 0 } },
      { companionId: 'zhou_yingxue', rank: 3, snapshot: { rulesVersion: 1, companionId: 'zhou_yingxue', rank: 3 }, effect: { guarding: false, focusGain: 3, healPercent: 0 } },
      { companionId: 'lu_guanlan', rank: 1, snapshot: { rulesVersion: 1, companionId: 'lu_guanlan', rank: 1 }, effect: { guarding: false, focusGain: 0, healPercent: 12 } },
      { companionId: 'lu_guanlan', rank: 2, snapshot: { rulesVersion: 1, companionId: 'lu_guanlan', rank: 2 }, effect: { guarding: false, focusGain: 0, healPercent: 18 } },
      { companionId: 'lu_guanlan', rank: 3, snapshot: { rulesVersion: 1, companionId: 'lu_guanlan', rank: 3 }, effect: { guarding: false, focusGain: 0, healPercent: 25 } }
    ]);

    for (const evidence of result.matrix) {
      const checkpoint = `${evidence.companionId}:R${evidence.rank}`;
      expect(evidence.after.guarding, checkpoint).toBe(evidence.effect.guarding);
      expect(evidence.after.focus - evidence.before.focus, checkpoint).toBe(evidence.effect.focusGain);
      expect(evidence.after.hp - evidence.before.hp, checkpoint).toBe(
        Math.ceil((createInitialState().player.maxHp * evidence.effect.healPercent) / 100)
      );
      expect(evidence.after.used, checkpoint).toBe(true);
      expect(evidence.secondUseReason, checkpoint).toBe('already_used');
      expect(evidence.secondUsePreserved, checkpoint).toBe(true);
      expect(evidence.saturated.hpAfter, checkpoint).toBe(evidence.saturated.hpBefore);
      expect(evidence.saturated.focusAfter, checkpoint).toBe(evidence.saturated.focusBefore);
      expect(evidence.saturated.focusAfter, checkpoint).toBe(3);
      expect(evidence.saturated.available, checkpoint).toBe(evidence.companionId === 'qin_che');
      expect(evidence.saturated.reason, checkpoint).toBe(
        evidence.companionId === 'qin_che' ? undefined : 'no_benefit'
      );
    }
  });

  it('keeps no-companion campaign balance unchanged and assist explicitly disabled', () => {
    const initial = createInitialState();
    const campaignBefore = simulateCampaignBalance();
    const result = simulateCompanionAssistBalance();

    expect(initial.ownedCompanions).toEqual([]);
    expect(initial.companionRanks).toEqual({});
    expect(initial.activeCompanion).toBeUndefined();
    expect(result.noCompanion).toEqual({
      snapshotAbsent: true,
      legacyDisabled: true,
      usePreserved: true
    });
    expect(simulateCampaignBalance()).toEqual(campaignBefore);
  });
});

describe('method technique rank simulation', () => {
  it('proves all 21 selected-method rank effects through real cultivation and combat APIs', () => {
    const result = getMethodTechniqueSimulation();
    const expectedRows = METHOD_TECHNIQUE_CATALOG.flatMap((definition) =>
      ([1, 2, 3] as const).map((rank) => ({
        methodId: definition.methodId,
        rank,
        effect: definition.effects[rank]
      }))
    );

    expect(result.matrix).toHaveLength(21);
    expect(result.matrix.map(({ methodId, rank, expectedEffect }) => ({
      methodId,
      rank,
      effect: expectedEffect
    }))).toEqual(expectedRows);

    for (const evidence of result.matrix) {
      const checkpoint = `${evidence.methodId}:R${evidence.rank}`;
      const effect = evidence.expectedEffect;
      const maxHp = evidence.saturatedBefore.hp;
      const breathCap = evidence.methodId === 'star_core_method'
        ? 3
        : evidence.methodId === 'mist_breathing' ? 2 : undefined;

      expect(evidence.activeAfterLearning, checkpoint).toBe(evidence.methodId);
      expect(evidence.activeBeforeEntry, checkpoint).toBe(evidence.methodId);
      expect(evidence.activeAfterTechnique, checkpoint).toBe(evidence.methodId);
      expect(evidence.rankBeforeEntry, checkpoint).toBe(evidence.rank);
      expect(evidence.rankAfterTechnique, checkpoint).toBe(evidence.rank);
      expect(evidence.snapshot, checkpoint).toEqual({
        rulesVersion: 1,
        methodId: evidence.methodId,
        rank: evidence.rank
      });
      expect(evidence.pursuitStatus, checkpoint).toBe('disabled');
      if (evidence.methodId === 'star_core_method') {
        expect(evidence.learnedMethods, checkpoint).toEqual(
          expect.arrayContaining(['star_core_method', 'mist_breathing'])
        );
      }
      expect(evidence.observedUpgradeCosts, checkpoint).toEqual(evidence.expectedUpgradeCosts);
      expect(evidence.expectedUpgradeCosts, checkpoint).toEqual(
        evidence.rank === 1
          ? []
          : evidence.rank === 2
            ? [{ targetRank: 2, rewardPoints: 420, lingyun: 1, methodPages: 1 }]
            : [
                { targetRank: 2, rewardPoints: 420, lingyun: 1, methodPages: 1 },
                { targetRank: 3, rewardPoints: 760, lingyun: 2, methodPages: 2 }
              ]
      );

      expect(evidence.after.hp, checkpoint).toBe(
        Math.min(maxHp, evidence.before.hp + Math.ceil((maxHp * effect.healPercent) / 100))
      );
      expect(evidence.after.focus, checkpoint).toBe(Math.min(3, evidence.before.focus + effect.focusGain));
      expect(evidence.after.guarding, checkpoint).toBe(evidence.before.guarding || effect.guarding);
      expect(evidence.after.rustPoisonStacks, checkpoint).toBe(
        effect.clearsRustPoison ? 0 : evidence.before.rustPoisonStacks
      );
      expect(evidence.after.mirrorSlowStacks, checkpoint).toBe(
        effect.clearsMirrorSlow ? 0 : evidence.before.mirrorSlowStacks
      );
      expect(evidence.after.breathStacks, checkpoint).toBe(
        breathCap === undefined
          ? evidence.before.breathStacks
          : Math.min(breathCap, evidence.before.breathStacks + effect.breathGain)
      );
      expect(evidence.after.used, checkpoint).toBe(true);
      expect(evidence.invariantAfter, checkpoint).toEqual(evidence.invariantBefore);
      expect(evidence.secondUsePreserved, checkpoint).toBe(true);

      expect(evidence.saturatedAfter.hp, checkpoint).toBe(maxHp);
      expect(evidence.saturatedAfter.focus, checkpoint).toBe(
        Math.min(3, evidence.saturatedBefore.focus + effect.focusGain)
      );
      expect(evidence.saturatedAfter.breathStacks, checkpoint).toBe(
        breathCap === undefined
          ? evidence.saturatedBefore.breathStacks
          : Math.min(breathCap, evidence.saturatedBefore.breathStacks + effect.breathGain)
      );
      expect(evidence.petRequirement, checkpoint).toEqual(
        evidence.methodId === 'beast_taming'
          ? { rejectedWithoutActivePet: true, usedWithoutActivePet: false }
          : undefined
      );
    }
  });

  it('keeps the default campaign balanced with ranks isolated and no active method', () => {
    const result = getMethodTechniqueSimulation();

    expect(result.defaultCampaign).toEqual({
      verdict: 'balanced',
      warnings: [],
      activeMethod: undefined,
      ranks: Object.fromEntries(
        METHOD_TECHNIQUE_CATALOG
          .filter((definition) => definition.methodId !== 'star_core_method')
          .map((definition) => [definition.methodId, definition.methodId === 'mist_breathing' ? 3 : 1])
      )
    });
  });

  it('repeats the complete matrix deterministically', () => {
    expect(simulateMethodTechniqueRanks()).toEqual(getMethodTechniqueSimulation());
  });
});

describe('campaign balance simulation', () => {
  it('proves a planned route can clear the full dungeon order from a fresh state', () => {
    const result = simulateSevenDungeonVictoryRoute();

    expect(result.summaries).toHaveLength(DUNGEON_ORDER.length);
    expect(result.finalState.completedDungeonIds).toHaveLength(DUNGEON_ORDER.length);
    expect(result.summaries.map((summary) => summary.completedDungeonCountAfter)).toEqual(
      DUNGEON_ORDER.map((_, index) => index + 1)
    );
    expect(result.summaries.every((summary) => summary.gateBeforeEntry === 'open')).toBe(true);
    expect(result.summaries.every((summary) => summary.growthSignals.some((signal) => signal !== 'campaign-clear'))).toBe(true);
    expect(result.coverage.boughtEquipment).toBe(true);
    expect(result.coverage.upgradedEquipment).toBe(true);
    expect(result.coverage.learnedMethod).toBe(true);
    expect(result.coverage.gainedPet).toBe(true);
  });

  it('clears Tier 15 through live relay noise, a silent branch, the boss, and the exit', () => {
    const summary = simulateSevenDungeonVictoryRoute().summaries.find(
      ({ dungeonId }) => dungeonId === 'silent_broadcast_tower'
    );

    expect(summary).toMatchObject({
      tier: 15,
      dungeonId: 'silent_broadcast_tower',
      bossNodeId: 'last_broadcaster',
      bossNodeCleared: true,
      bossSealCleared: true,
      exitNodeCleared: true,
      playerSurvived: true,
      broadcastRoute: {
        muteCount: 2,
        broadcastCount: 1,
        allRelaysResolved: true,
        silentArchiveReached: true,
        balancedSwitchboardReached: false
      }
    });
    expect(summary?.broadcastRoute?.noise).toBeGreaterThanOrEqual(0);
    expect(summary?.broadcastRoute?.noise).toBeLessThanOrEqual(6);
    expect(summary?.broadcastRoute?.bossNoiseSnapshot).toBeLessThanOrEqual(1);
    expect(summary?.clearedNodeIds).toEqual(expect.arrayContaining([
      'acoustic_tripwire',
      'silent_archive',
      'last_broadcaster',
      'broadcast_exit'
    ]));
    expect(summary?.routeEvidence.broadcastRelayChoiceTrace.map(({ nodeId, choice }) => ({ nodeId, choice }))).toEqual([
      { nodeId: 'south_relay_console', choice: 'mute' },
      { nodeId: 'north_relay_console', choice: 'broadcast' },
      { nodeId: 'central_relay_console', choice: 'mute' }
    ]);
    expect(summary?.routeEvidence.broadcastRelayChoiceTrace.every(
      (choice) => choice.noiseAfter === choice.noiseBefore + choice.noiseDelta
    )).toBe(true);
    expect(summary?.routeEvidence.broadcastEntryPassives).toEqual({
      hushblade: false,
      deadAirHeadset: false,
      anechoicMantle: false,
      lastChannelBeacon: false
    });
    expect(summary?.routeEvidence.movements.some((movement) => movement.toNodeId === 'silent_archive')).toBe(true);
  });

  it('reaches all three Tier 15 specializations repeatably through real relay and combat APIs', () => {
    const result = getBroadcastSpecializations();
    const expectedEquipment = [
      'hushblade',
      'dead_air_headset',
      'anechoic_mantle',
      'last_channel_beacon'
    ];

    expect(result.equippedEquipmentIds).toEqual(expect.arrayContaining(expectedEquipment));
    for (const branch of [result.silent, result.resonance, result.balanced]) {
      expect(branch.entryPassives).toEqual({
        hushblade: true,
        deadAirHeadset: true,
        anechoicMantle: true,
        lastChannelBeacon: true
      });
      expect(branch.reachedBranch, branch.branchNodeId).toBe(true);
      expect(branch.bossNodeCleared, branch.branchNodeId).toBe(true);
      expect(branch.exitNodeCleared, branch.branchNodeId).toBe(true);
      expect(branch.completed, branch.branchNodeId).toBe(true);
      expect(branch.playerSurvived, branch.branchNodeId).toBe(true);
      expect(branch.routeEvidence.broadcastRelayChoiceTrace).toHaveLength(3);
      expect(branch.routeEvidence.movements.every((movement) => movement.legal)).toBe(true);
    }
    expect(result.silent).toMatchObject({
      branchNodeId: 'silent_archive',
      muteCount: 3,
      noiseAtBranch: 0
    });
    expect(result.silent.noiseAtBranch).toBeLessThanOrEqual(1);
    expect(result.resonance).toMatchObject({
      branchNodeId: 'resonance_vault',
      broadcastCount: 3
    });
    expect(result.resonance.noiseAtBranch).toBeGreaterThanOrEqual(4);
    expect(result.balanced).toMatchObject({
      branchNodeId: 'balanced_switchboard',
      muteCount: 2,
      broadcastCount: 1
    });
    expect(result.balanced.noiseAtBranch).toBeGreaterThanOrEqual(2);
    expect(result.balanced.noiseAtBranch).toBeLessThanOrEqual(3);
    expect(simulateBroadcastSpecializationRoutes()).toEqual(result);
  });

  it('clears Tier 16 through three live checkpoints with a surviving escort, boss, and exit', () => {
    const summary = simulateSevenDungeonVictoryRoute().summaries.find(
      ({ dungeonId }) => dungeonId === 'lost_shelter'
    );

    expect(summary).toMatchObject({
      tier: 16,
      dungeonId: 'lost_shelter',
      bossNodeId: 'shelter_overseer',
      bossNodeCleared: true,
      bossSealCleared: true,
      exitNodeCleared: true,
      playerSurvived: true,
      escortRoute: {
        allCheckpointsResolved: true,
        treatCount: 1,
        pushCount: 2
      }
    });
    expect(summary?.escortRoute?.survivorHp).toBeGreaterThan(0);
    expect(summary?.escortRoute?.bossSurvivorSnapshot).toBeGreaterThan(0);
    expect(summary?.routeEvidence.escortCheckpointChoiceTrace).toHaveLength(3);
    expect(summary?.routeEvidence.escortCheckpointChoiceTrace.some(
      (choice) => choice.choice === 'treat' &&
        choice.healingPillCost === 0 &&
        choice.entryCompanion.id === 'lu_guanlan' &&
        choice.entryCompanion.rank >= 2 &&
        choice.inventoryPillsBefore === choice.inventoryPillsAfter &&
        choice.runPillsBefore === choice.runPillsAfter
    )).toBe(true);
    expect(summary?.clearedNodeIds).toEqual(expect.arrayContaining([
      'collapsed_hall_trap',
      'shelter_enforcer_north',
      'evacuation_horror_omega',
      'shelter_overseer',
      'shelter_exit'
    ]));
  });

  it('reaches all three Tier 16 HP specializations repeatably after real material farming and gear preparation', () => {
    const result = getLostShelterSpecializations();
    const expectedEquipment = [
      'rescue_carbine',
      'triage_visor',
      'evacuation_plate',
      'blackbox_beacon'
    ] as const;

    expect(result.materialFarmRuns).toBeGreaterThanOrEqual(1);
    expect(result.rescueBadgesAfterFarm).toBeGreaterThan(result.rescueBadgesBeforeFarm);
    expect(result.equippedEquipmentIds).toEqual(expectedEquipment);
    expect(expectedEquipment.every((equipmentId) => result.equipmentLevels[equipmentId] === 3)).toBe(true);
    expect(expectedEquipment.every((equipmentId) => result.equipmentTemperRanks[equipmentId] === 2)).toBe(true);
    expect(expectedEquipment.every((equipmentId) => result.equipmentAttunements[equipmentId] !== undefined)).toBe(true);

    for (const branch of [result.evacuation, result.desperate, result.balanced]) {
      expect(branch.reachedBranch, branch.branchNodeId).toBe(true);
      expect(branch.entryGear, branch.branchNodeId).toEqual({
        rescueCarbine: true,
        triageVisor: true,
        evacuationPlate: true,
        blackboxBeacon: true
      });
      expect(branch.entryCompanion).toEqual({ id: 'qin_che', rank: 2 });
      expect(branch.companionRole).toContain('首次险情护卫');
      expect(branch.firstHazardGuardUsed).toBe(true);
      expect(branch.bossNodeCleared).toBe(true);
      expect(branch.exitNodeCleared).toBe(true);
      expect(branch.completed).toBe(true);
      expect(branch.playerSurvived).toBe(true);
      expect(branch.survivorAlive).toBe(true);
      expect(branch.bossSurvivorSnapshot).toBe(Math.min(100, branch.survivorHpAtBranch + 10));
      expect(branch.routeEvidence.movements.every((movement) => movement.legal)).toBe(true);
      expect(branch.routeEvidence.escortCheckpointChoiceTrace).toHaveLength(3);
    }
    expect(result.evacuation).toMatchObject({ branchNodeId: 'evacuation_cache' });
    expect(result.evacuation.survivorHpAtBranch).toBeGreaterThanOrEqual(75);
    expect(result.desperate).toMatchObject({ branchNodeId: 'desperate_armory' });
    expect(result.desperate.survivorHpAtBranch).toBeLessThanOrEqual(40);
    expect(result.desperate.survivorHpAtBranch).toBeGreaterThan(0);
    expect(result.balanced).toMatchObject({ branchNodeId: 'balanced_medbay' });
    expect(result.balanced.survivorHpAtBranch).toBeGreaterThanOrEqual(41);
    expect(result.balanced.survivorHpAtBranch).toBeLessThanOrEqual(74);
    expect(simulateLostShelterSpecializationRoutes()).toEqual(result);
  });

  it('clears Tier 17 through three clean evidence pairs, the frozen verdict, boss, and exit', () => {
    const result = simulateSevenDungeonVictoryRoute();
    const summary = result.summaries.find(({ dungeonId }) => dungeonId === 'false_testimony_court');

    expect(summary).toMatchObject({
      tier: 17,
      dungeonId: 'false_testimony_court',
      bossNodeId: 'false_testimony_judge',
      bossNodeCleared: true,
      bossSealCleared: true,
      exitNodeCleared: true,
      playerSurvived: true,
      falseTestimonyRoute: {
        revealedEvidenceIds: ['voice_evidence', 'timeline_evidence', 'residue_evidence'],
        contaminatedEvidenceIds: [],
        currentTrustedCount: 3,
        accusationCorrect: true,
        accusationTrustedCount: 3,
        appealUsed: false,
        truthArchiveReached: true,
        bossVerdictSnapshot: {
          suspect: 'route_surveyor',
          correct: true,
          trustedCount: 3,
          appealed: false
        }
      }
    });
    expect(summary?.routeEvidence.trapChoiceTrace.filter(
      ({ nodeId }) => [
        'voice_filter_trap',
        'timeline_checksum_trap',
        'residue_sterility_trap'
      ].includes(nodeId)
    )).toEqual(expect.arrayContaining([
      expect.objectContaining({ nodeId: 'voice_filter_trap', choice: 'counter', damage: 0, cleared: true }),
      expect.objectContaining({ nodeId: 'timeline_checksum_trap', choice: 'counter', damage: 0, cleared: true }),
      expect.objectContaining({ nodeId: 'residue_sterility_trap', choice: 'counter', damage: 0, cleared: true })
    ]));
    expect(summary?.routeEvidence.falseTestimonyAccusationTrace).toEqual([
      expect.objectContaining({
        nodeId: 'verdict_chamber',
        suspect: 'route_surveyor',
        currentTrustedCountBefore: 3,
        accusationTrustedCountAfter: 3,
        correct: true,
        appealed: false
      })
    ]);
    expect(result.finalState).toMatchObject({
      activeMethod: 'iron_body',
      activePet: 'starling_drone',
      activeCompanion: 'lu_guanlan',
      activeBloodline: 'bastion_chitin'
    });
    expect(result.finalState.completedDungeonIds).toEqual(DUNGEON_ORDER);
  });

  it('isolates Tier 18 while conservatively clearing an ordinary encounter and the boss', () => {
    const initial = createInitialState();
    const prepared = {
      ...initial,
      rewardPoints: 100_000,
      lingyun: 32,
      player: {
        ...initial.player,
        base: { body: 69, spirit: 5, agility: 25, luck: 12 }
      },
      completedDungeonIds: DUNGEON_ORDER.slice(0, 17),
      claimedTaskIds: DUNGEON_ORDER.slice(0, 17).map((dungeonId) => `mainline_clear_${dungeonId}`)
    };
    const externalState = enterDungeon(prepared, 'false_testimony_court');
    const externalBefore = structuredClone(externalState);
    const result = simulateCombatReplayStageBalanceScenario(externalState);

    expect(result).toMatchObject({
      dungeonId: 'combat_replay_stage',
      recommendedPower: 1240,
      externalRunPreserved: true,
      externalProgressPreserved: true,
      pursuitIsolated: true,
      playerSurvived: true,
      completedTakeCount: 3,
      routeSelected: true,
      route: 'burst',
      bossSnapshotFrozen: true,
      ordinary: { cleared: true },
      boss: {
        nodeId: 'final_cut_director',
        monsterId: 'final_cut_director',
        cleared: true
      }
    });
    expect(result.readiness).not.toBe('deadly');
    expect(result.playerPower).toBeLessThanOrEqual(Math.floor(result.recommendedPower * 1.35));
    expect(externalState).toEqual(externalBefore);
  });

  it('freezes Tier 17 specialization and reward routing at the original accusation count', () => {
    const result = getFalseTestimonySpecializations();
    const equipmentIds = [
      'cross_examiner_sabre',
      'forensic_visor',
      'custody_shell',
      'appeal_seal'
    ] as const;

    expect(result.materialFarmRuns).toBeGreaterThanOrEqual(1);
    expect(result.truthFragmentsAfterFarm).toBeGreaterThan(result.truthFragmentsBeforeFarm);
    expect(result.equippedEquipmentIds).toEqual(equipmentIds);
    expect(equipmentIds.every((equipmentId) => result.equipmentLevels[equipmentId] === 3)).toBe(true);
    expect(equipmentIds.every((equipmentId) => result.equipmentTemperRanks[equipmentId] === 2)).toBe(true);
    expect(equipmentIds.every((equipmentId) => result.equipmentAttunements[equipmentId] !== undefined)).toBe(true);

    for (const branch of [result.truth, result.swift, result.swiftOneEvidence, result.falseVerdict]) {
      expect(branch.reachedBranch, branch.branchNodeId).toBe(true);
      expect(branch.entryGear, branch.branchNodeId).toEqual({
        crossExaminerSabre: true,
        forensicVisor: true,
        custodyShell: true,
        appealSeal: true
      });
      expect(branch.bossNodeCleared, branch.branchNodeId).toBe(true);
      expect(branch.exitNodeCleared, branch.branchNodeId).toBe(true);
      expect(branch.completed, branch.branchNodeId).toBe(true);
      expect(branch.playerSurvived, branch.branchNodeId).toBe(true);
      expect(branch.routeEvidence.movements.every((movement) => movement.legal)).toBe(true);
    }
    expect(result.truth).toMatchObject({
      branchNodeId: 'truth_archive',
      currentTrustedCount: 3,
      accusationCorrect: true,
      accusationTrustedCount: 3,
      appealUsed: false,
      accusationRewardPoints: 280,
      projectedAccusationRewardPoints: 280
    });
    expect(result.swift).toMatchObject({
      branchNodeId: 'swift_judgment_armory',
      currentTrustedCount: 3,
      accusationCorrect: true,
      accusationTrustedCount: 2,
      appealUsed: false,
      accusationRewardPoints: 440,
      projectedAccusationRewardPoints: 440
    });
    expect(result.swift.routeEvidence.falseTestimonyAccusationTrace).toEqual([
      expect.objectContaining({
        currentTrustedCountBefore: 2,
        accusationTrustedCountAfter: 2,
        projectedRewardPointsBefore: 440,
        rewardPointsDelta: 440
      })
    ]);
    expect(result.swiftOneEvidence).toMatchObject({
      branchNodeId: 'swift_judgment_armory',
      currentTrustedCount: 3,
      accusationCorrect: true,
      accusationTrustedCount: 1,
      appealUsed: false
    });
    expect(result.swiftOneEvidence.accusationRewardPoints).toBe(
      result.swiftOneEvidence.projectedAccusationRewardPoints
    );
    expect(result.swiftOneEvidence.accusationRewardPoints).not.toBe(result.swift.accusationRewardPoints);
    expect(result.swiftOneEvidence.routeEvidence.falseTestimonyAccusationTrace).toEqual([
      expect.objectContaining({
        currentTrustedCountBefore: 1,
        accusationTrustedCountAfter: 1,
        rewardPointsDelta: result.swiftOneEvidence.accusationRewardPoints
      })
    ]);
    expect(result.falseVerdict).toMatchObject({
      branchNodeId: 'false_verdict_vault',
      accusationCorrect: false,
      accusationTrustedCount: 2,
      accusationRewardPoints: 0,
      projectedAccusationRewardPoints: 0
    });
    expect(result.appeal).toEqual({
      wrongAccusationTrustedCount: 2,
      correctAfterAppeal: true,
      appealUsed: true,
      falseVaultClearedBeforeAppeal: false,
      rewardPointsAfterAppeal: 0,
      completed: true
    });
    expect(result.falseVaultFirst).toEqual({
      falseVaultCleared: true,
      appealEligibleAfterVault: false,
      appealResolvedAfterVault: false
    });
    expect(simulateFalseTestimonySpecializationRoutes()).toEqual(result);
  });

  it('crosses all three Tier 16 portals through Tiers 17, 18, and 19 without changing campaign progress', () => {
    const ring = simulateLostShelterPortalRing();

    expect(ring.map((hop) => ({
      source: hop.shelterPortalNodeId,
      tier17: hop.testimonyLandingNodeId,
      tier17Portal: hop.testimonyPortalNodeId,
      tier18: hop.replayLandingNodeId,
      tier18Portal: hop.replayPortalNodeId,
      tier19: hop.panopticonLandingNodeId,
      tier19Portal: hop.panopticonPortalNodeId,
      tier1: hop.tierOneLandingNodeId
    }))).toEqual([
      {
        source: 'upper_return_portal',
        tier17: 'north_entry',
        tier17Portal: 'upper_return_portal',
        tier18: 'upper_entry',
        tier18Portal: 'upper_return_portal',
        tier19: 'upper_entry',
        tier19Portal: 'upper_return_portal',
        tier1: 'sealed_cache'
      },
      {
        source: 'lower_return_portal',
        tier17: 'lower_entry',
        tier17Portal: 'lower_return_portal',
        tier18: 'lower_entry',
        tier18Portal: 'lower_return_portal',
        tier19: 'lower_entry',
        tier19Portal: 'lower_return_portal',
        tier1: 'fog_lesser_demon'
      },
      {
        source: 'return_shelter_portal',
        tier17: 'verdict_gate',
        tier17Portal: 'return_testimony_portal',
        tier18: 'stage_gate',
        tier18Portal: 'return_rehearsal_portal',
        tier19: 'panopticon_gate',
        tier19Portal: 'refraction_return_portal',
        tier1: 'quiet_prayer_reward'
      }
    ]);
    expect(ring.every((hop) => hop.completedDungeonIdsUnchanged)).toBe(true);
    expect(ring.every((hop) => hop.mainlineClaimsUnchanged)).toBe(true);
    expect(ring.every(
      (hop) => hop.dungeonIds.join('>') ===
        'lost_shelter>false_testimony_court>combat_replay_stage>panopticon_city>demon_tower_1'
    )).toBe(true);
    expect(ring.every((hop) => hop.routeEvidence.portalChoiceTrace.length === 4)).toBe(true);
  });

  it('completes the temporal summary through both calibration anchors and the terminal supply', () => {
    const result = simulateSevenDungeonVictoryRoute();
    const summary = result.summaries.find(({ dungeonId }) => dungeonId === 'temporal_observatory');

    expect(summary).toMatchObject({
      tier: 8,
      dungeonId: 'temporal_observatory',
      dungeonName: '时序观测庭',
      bossNodeId: 'zero_hour_regent',
      bossNodeCleared: true,
      bossSealCleared: true,
      completedDungeonCountAfter: DUNGEON_ORDER.indexOf('temporal_observatory') + 1
    });
    expect(DUNGEONS.temporal_observatory.recommendedPower).toBe(435);
    expect(summary?.clearedNodeIds).toEqual(
      expect.arrayContaining([
        'past_calibration_anchor',
        'future_calibration_anchor',
        'future_supply',
        'zero_hour_regent',
        'observatory_exit'
      ])
    );
    expect(
      summary?.routeEvidence.movements.every(
        (movement) => movement.legal && movement.blockReason === undefined
      )
    ).toBe(true);
    expect(summary?.settledEquipmentLootIds).toHaveLength(1);
    expect(DUNGEON_EQUIPMENT_POOLS.temporal_observatory).toContain(
      summary?.settledEquipmentLootIds[0]
    );
  });

  it('walks the victory route through tactical grid moves before settling the final exit', () => {
    const result = simulateSevenDungeonVictoryRoute();
    const movementLogs = result.finalState.log.filter((line) => line.startsWith('你移动到'));
    const finalDungeonId = DUNGEON_ORDER.at(-1);
    const finalSummary = result.summaries.at(-1);
    const finalExit = finalDungeonId === undefined
      ? undefined
      : DUNGEONS[finalDungeonId].nodes.find((node) => node.type === 'exit');

    expect(finalSummary?.routeEvidence.movements.length).toBeGreaterThanOrEqual(2);
    expect(finalExit).toBeDefined();
    expect(movementLogs).toContain(`你移动到${finalExit?.title}。`);
  });

  it('clears a real dangerous node before settling and claiming each chapter', () => {
    const result = simulateSevenDungeonVictoryRoute();

    for (const summary of result.summaries) {
      const dangerousNodeIds = new Set(
        DUNGEONS[summary.dungeonId].nodes
          .filter((node) => node.type === 'monster' || node.type === 'trap')
          .map((node) => node.id)
      );

      expect(
        summary.clearedNodeIds.some((nodeId) => dangerousNodeIds.has(nodeId)),
        `${summary.dungeonId} settled after sweeping only reward and exit nodes.`
      ).toBe(true);
      expect(summary.completedDungeonIdsAfter).toContain(summary.dungeonId);
      expect(summary.claimedTaskIdsAfter).toContain(`mainline_clear_${summary.dungeonId}`);
    }
  });

  it('uses equipped advanced weapon skills through real monster-node combat', () => {
    const result = simulateSevenDungeonVictoryRoute();
    const repeated = simulateSevenDungeonVictoryRoute();
    const summariesWithSkillUse = result.summaries.filter((summary) => summary.weaponSkillUseCount > 0);

    expect(summariesWithSkillUse.length).toBeGreaterThan(0);
    expect(
      result.summaries.some((summary) =>
        summary.plannedPurchases.some((equipmentId) => Boolean(getWeaponSkillDefinition(equipmentId)))
      )
    ).toBe(true);

    for (const summary of result.summaries) {
      const monsterNodeIds = new Set(
        DUNGEONS[summary.dungeonId].nodes.filter((node) => node.type === 'monster').map((node) => node.id)
      );
      const skillSpends = summary.focusTrace.filter((trace) => trace.skillSpent);

      expect(summary.weaponSkillUseCount).toBe(skillSpends.length);
      expect(summary.usedWeaponSkillNodeIds).toEqual(skillSpends.map((trace) => trace.nodeId));
      expect(summary.usedWeaponSkillNodeIds.every((nodeId) => monsterNodeIds.has(nodeId))).toBe(true);
      expect(summary.usedWeaponSkillNodeIds.every((nodeId) => summary.clearedNodeIds.includes(nodeId))).toBe(true);
    }

    expect(repeated.summaries.map((summary) => summary.usedWeaponSkillNodeIds)).toEqual(
      result.summaries.map((summary) => summary.usedWeaponSkillNodeIds)
    );
  });

  it('earns, spends, and recharges focus without attempting a turn-one skill', () => {
    const summaries = simulateSevenDungeonVictoryRoute().summaries;
    const traces = summaries.flatMap((summary) => summary.focusTrace);
    const firstActions = summaries.flatMap((summary) => {
      const seenNodeIds = new Set<string>();
      return summary.focusTrace.filter((trace) => {
        if (seenNodeIds.has(trace.nodeId)) return false;
        seenNodeIds.add(trace.nodeId);
        return true;
      });
    });
    const skillSpends = traces.filter((trace) => trace.skillSpent);

    expect(firstActions.length).toBeGreaterThan(0);
    expect(
      firstActions.every((trace) => trace.beforeFocus === 0),
      JSON.stringify({
        invalid: firstActions.filter((trace) => trace.beforeFocus !== 0),
        shelterRelics: summaries.find((summary) => summary.dungeonId === 'lost_shelter')
          ?.routeEvidence.relicDraftTrace
      })
    ).toBe(true);
    expect(traces.some((trace) => trace.afterFocus === 3)).toBe(true);
    expect(skillSpends.length).toBeGreaterThan(0);
    expect(skillSpends.every((trace) => trace.beforeFocus === 3 && trace.afterFocus === 0)).toBe(true);
    expect(traces.filter((trace) => trace.action === 'weapon_skill').every((trace) => trace.beforeFocus === 3)).toBe(true);
    expect(skillSpends.every((trace) => trace.beforeTurn > 1)).toBe(true);
    expect(
      summaries.some((summary) =>
        summary.focusTrace.some(
          (trace, index, focusTrace) =>
            trace.skillSpent &&
            focusTrace.slice(index + 1).some((later) => later.nodeId === trace.nodeId && later.afterFocus > 0)
        )
      )
    ).toBe(true);
  });

  it('records only legal route movement while closed gates detour and open gates traverse', () => {
    const standard = simulateSevenDungeonVictoryRoute();
    const imprint = simulateSevenDungeonImprintRoute(standard.finalState);
    const lawAware = simulateSevenDungeonLawRoute(standard.finalState);
    const routeGroups = [
      { name: 'standard', summaries: standard.summaries },
      { name: 'imprint', summaries: imprint.summaries },
      { name: 'law-aware', summaries: lawAware.summaries }
    ];

    for (const group of routeGroups) {
      expect(group.summaries, `${group.name} route did not retain the full campaign.`).toHaveLength(
        DUNGEON_ORDER.length
      );
      for (const summary of group.summaries) {
        const movements = summary.routeEvidence.movements;
        const bossNodeId = getBossDefinition(summary.dungeonId).nodeId;
        const exitNodeId = DUNGEONS[summary.dungeonId].nodes.find((node) => node.type === 'exit')?.id;

        expect(movements.length, `${group.name}:${summary.dungeonId} recorded no route movement.`).toBeGreaterThan(0);
        expect(
          movements.every((movement) => movement.legal && movement.blockReason === undefined),
          `${group.name}:${summary.dungeonId} recorded illegal movement.`
        ).toBe(true);
        expect(movements.some((movement) => movement.toNodeId === bossNodeId)).toBe(true);
        expect(movements.some((movement) => movement.toNodeId === exitNodeId)).toBe(true);
        expect(
          summary.routeEvidence.gateChecks.every(
            (gate) => gate.status === 'open' || (gate.status === 'closed' && Boolean(gate.blockReason))
          )
        ).toBe(true);

        if ('requiredNodeId' in summary) {
          expect(movements.some((movement) => movement.toNodeId === summary.requiredNodeId)).toBe(true);
        }
      }
    }

    const gateChecks = routeGroups.flatMap((group) =>
      group.summaries.flatMap((summary) => summary.routeEvidence.gateChecks)
    );
    expect(gateChecks.some((gate) => gate.status === 'closed' && Boolean(gate.blockReason))).toBe(true);
    expect(gateChecks.some((gate) => gate.status === 'open' && gate.traversed)).toBe(true);
  });

  it('enters every simulated route with a valid immutable snapshot of at most three tools', () => {
    const standard = simulateSevenDungeonVictoryRoute();
    const routeGroups = [
      standard.summaries,
      simulateSevenDungeonLawRoute(standard.finalState).summaries,
      simulateSevenDungeonImprintRoute(standard.finalState).summaries
    ];

    for (const summaries of routeGroups) {
      for (const summary of summaries) {
        expect(summary.routeEvidence.tacticalLoadoutTrace.length, summary.dungeonId).toBeGreaterThan(0);
        for (const trace of summary.routeEvidence.tacticalLoadoutTrace) {
          expect(trace.valid, trace.dungeonId).toBe(true);
          expect(trace.preparedItemIds.length, trace.dungeonId).toBeLessThanOrEqual(3);
          expect(trace.entrySnapshot.itemIds).toEqual(trace.preparedItemIds);
          expect(trace.generalSlotItemIds.length + trace.specializedSlotAssignments.length).toBe(
            trace.preparedItemIds.length
          );
        }
      }
    }
  });

  it('prepares and consumes a non-default route tool through the real trap API', () => {
    const summaries = simulateSevenDungeonLawRoute().summaries;
    const defaultItems = new Set(['healing_pill', 'dispel_talisman', 'gate_sigil']);
    const proof = summaries.flatMap((summary) =>
      summary.routeEvidence.trapChoiceTrace.map((choice) => ({ summary, choice }))
    ).find(({ summary, choice }) =>
      choice.choice === 'counter' &&
      Boolean(choice.counterItem) &&
      !defaultItems.has(choice.counterItem!) &&
      summary.routeEvidence.tacticalLoadoutTrace.some((trace) =>
        trace.preparedItemIds.includes(choice.counterItem as 'focus_incense' | 'armor_patch')
      )
    );

    expect(proof).toBeDefined();
    if (!proof) throw new Error('Missing non-default tactical tool consumption evidence.');
    expect(proof.choice.inventoryBefore - proof.choice.inventoryAfter).toBe(1);
    expect(proof.choice.damage).toBe(0);
  });

  it('records deterministic risk and counter choices for the same real trap', () => {
    const standard = simulateSevenDungeonVictoryRoute();
    const law = simulateSevenDungeonLawRoute(standard.finalState);
    const standardChoice = standard.summaries
      .find((summary) => summary.dungeonId === 'demon_tower_1')
      ?.routeEvidence.trapChoiceTrace.find((choice) => choice.nodeId === 'blood_rune_trap');
    const lawChoice = law.summaries
      .find((summary) => summary.dungeonId === 'demon_tower_1')
      ?.routeEvidence.trapChoiceTrace.find((choice) => choice.nodeId === 'blood_rune_trap');

    expect(standardChoice).toMatchObject({ choice: 'risk', cleared: true });
    expect(lawChoice).toMatchObject({ choice: 'counter', cleared: true, damage: 0 });
    expect(simulateSevenDungeonLawRoute(standard.finalState).summaries[0].routeEvidence.trapChoiceTrace).toEqual(
      law.summaries[0].routeEvidence.trapChoiceTrace
    );
  });

  it('proves every law route detours around a closed sector and later opens it', () => {
    const summaries = simulateSevenDungeonLawRoute().summaries;

    for (const summary of summaries) {
      const trace = summary.routeEvidence.routeSectorTrace;
      const entryGateCount = trace
        .filter((sector) => sector.checkpoint === 'entry')
        .reduce((count, sector) => count + sector.gateCount, 0);
      const detour = trace.find((sector) => sector.detourTargetNodeId && sector.status !== 'open');
      const reopened = detour && trace.find(
        (sector) => sector.sectorId === detour.sectorId && sector.status === 'open'
      );

      expect(entryGateCount, `${summary.dungeonId}: sector gate coverage`).toBe(
        getDungeonRouteGates(summary.dungeonId).length
      );
      expect(detour, `${summary.dungeonId}: closed-sector detour`).toBeDefined();
      if (summary.dungeonId === 'genesis_vault') {
        const genes = summary.routeEvidence.genesisSpliceChoiceTrace.map((choice) => choice.gene);
        expect(genes).toHaveLength(3);
        expect(new Set(genes).size).toBe(3);
        expect(summary.routeEvidence.gateChecks).toEqual(expect.arrayContaining([
          expect.objectContaining({
            gateId: 'genesis_mosaic_corridor_vault',
            status: 'open',
            traversed: true
          })
        ]));
        const specialization = simulateGenesisSpecializationRoute();
        const paidRepeat = specialization.spliceChoiceTrace.find(
          (choice) => choice.gene === specialization.gene && choice.serumCost === 1
        );
        expect(specialization).toMatchObject({
          gene: 'renewal',
          geneCount: 2,
          vaultNodeId: 'renewal_gene_vault',
          reachedVault: true
        });
        expect(paidRepeat).toMatchObject({ serumCost: 1 });
        expect((paidRepeat?.serumBefore ?? 0) - (paidRepeat?.serumAfter ?? 0)).toBe(1);
        expect((paidRepeat?.runSerumBefore ?? 0) - (paidRepeat?.runSerumAfter ?? 0)).toBe(1);
        expect(specialization.routeEvidence.gateChecks).toEqual(expect.arrayContaining([
          expect.objectContaining({
            gateId: 'genesis_renewal_portal_vault',
            status: 'open',
            traversed: true
          })
        ]));
      } else if (summary.dungeonId === 'entropy_ark') {
        expect(summary.routeEvidence.headingChoiceTrace.map((choice) => choice.nodeId)).toEqual([
          'bow_heading_console',
          'midship_heading_console',
          'stern_heading_console'
        ]);
        expect(summary.routeEvidence.headingChoiceTrace.map((choice) => choice.choice)).toContain('steady');
        expect(summary.routeEvidence.headingChoiceTrace.map((choice) => choice.choice)).toContain('rush');
        expect(summary.routeEvidence.gateChecks).toEqual(expect.arrayContaining([
          expect.objectContaining({ gateId: 'ark_bow_dissipation_lane', status: 'open', traversed: true }),
          expect.objectContaining({ gateId: 'ark_midship_starboard_relic_lane', status: 'open', traversed: true })
        ]));
      } else if (summary.dungeonId === 'lost_shelter') {
        expect(summary.routeEvidence.gateChecks).toEqual(expect.arrayContaining([
          expect.objectContaining({
            gateId: 'shelter_balanced_medbay_north_in',
            status: 'open',
            traversed: true
          }),
          expect.objectContaining({
            gateId: 'shelter_memory_boss_gate',
            status: 'open',
            traversed: false
          })
        ]));
      } else {
        expect(reopened, `${summary.dungeonId}: sector never reopened`).toBeDefined();
      }
    }
  });

  it('clears each configured boss node and records the released exit seal', () => {
    const result = simulateSevenDungeonVictoryRoute();

    for (const summary of result.summaries) {
      const bossDefinition = getBossDefinition(summary.dungeonId);

      expect(summary.bossNodeId).toBe(bossDefinition.nodeId);
      expect(summary.bossNodeCleared, `${summary.dungeonId} did not clear its configured boss.`).toBe(true);
      expect(summary.bossSealCleared, `${summary.dungeonId} left its exit seal locked.`).toBe(true);
      expect(summary.clearedNodeIds).toContain(bossDefinition.nodeId);
    }
  });

  it('selects the first legal boss equipment offer and keeps the summary consistent', () => {
    const result = simulateSevenDungeonVictoryRoute();
    const ashArenaIndex = result.summaries.findIndex((summary) => summary.dungeonId === 'ash_arena');
    const ownedBeforeAshArena = result.summaries[ashArenaIndex - 1]?.ownedEquipmentIdsAfter ?? [];
    const ashArena = result.summaries.find((summary) => summary.dungeonId === 'ash_arena');
    const ownedBeforeBoss = new Set([...ownedBeforeAshArena, ...(ashArena?.plannedPurchases ?? [])]);
    const bossDefinition = getBossDefinition('ash_arena');
    const expectedOffer = getDungeonLootOffer({
      dungeonId: 'ash_arena',
      monsterId: bossDefinition.monsterId,
      nodeId: bossDefinition.nodeId,
      ownedEquipmentIds: [...ownedBeforeBoss],
      carriedEquipmentIds: [],
      offersMade: 0
    });
    const clearedEliteNode = DUNGEONS.ash_arena.nodes.find(
      (node) => node.id === bossDefinition.nodeId && ashArena?.clearedNodeIds.includes(node.id)
    );

    expect(clearedEliteNode).toBeDefined();
    if (!expectedOffer || !('equipmentIds' in expectedOffer)) {
      throw new Error('Ash arena boss should produce a deterministic equipment offer for this route.');
    }
    const expectedEquipmentId = expectedOffer.equipmentIds[0];
    expect(ashArena?.settledEquipmentLootIds).toEqual([expectedEquipmentId]);
    expect(ashArena?.ownedEquipmentIdsAfter).toContain(expectedEquipmentId);
    expect(result.finalState.ownedEquipment).toContain(expectedEquipmentId);
  });

  it('fails clearly when the bounded combat route cannot defeat its first monster', () => {
    const initialState = createInitialState();
    const underpoweredState = {
      ...initialState,
      rewardPoints: 0,
      player: {
        ...initialState.player,
        hp: 1
      }
    };

    expect(() => simulateSevenDungeonVictoryRoute(underpoweredState)).toThrow(
      /Balance simulation failed in demon_tower_1 at fog_lesser_demon: combat ended without victory after 1 actions/
    );
  });

  it('bases the default balance analysis on the same tactical route clears', () => {
    const analysis = analyzeCampaignBalance();
    const route = simulateSevenDungeonVictoryRoute();

    expect(analysis.stages.map((stage) => stage.afterPower)).toEqual(route.summaries.map((summary) => summary.afterPower));
    expect(analysis.stages.slice(0, -1).map((stage) => stage.nextPreparedPower)).toEqual(
      route.summaries.slice(1).map((summary) => summary.beforePower)
    );
    expect(analysis.stages.map((stage) => stage.growthSignals)).toEqual(
      route.summaries.map((summary) => summary.growthSignals)
    );
    expect(analysis.stages.map((stage) => stage.plannedMethods)).toEqual(route.summaries.map((summary) => summary.plannedMethods));
  });

  it('records every claimable mainline and entry-side reward after each chapter clear', () => {
    const result = simulateSevenDungeonVictoryRoute();
    const expectedGlobalTaskIds = [
      'side_recruit_first_companion',
      'side_train_companion_rank_2',
      'side_refine_first_method_rank_2',
      'side_master_first_method_rank_3',
      'side_unlock_first_bloodline'
    ];
    const expectedAfterEachChapter: string[][] = [];
    const expectedClaimedTaskIds: string[] = [];
    for (const summary of result.summaries) {
      if (summary.dungeonId === 'genesis_vault') expectedClaimedTaskIds.push(...expectedGlobalTaskIds);
      expectedClaimedTaskIds.push(
        `mainline_clear_${summary.dungeonId}`,
        `side_enter_${summary.dungeonId}`
      );
      if (
        summary.dungeonId === 'false_testimony_court' ||
        summary.dungeonId === 'combat_replay_stage' ||
        summary.dungeonId === 'panopticon_city'
      ) {
        expectedClaimedTaskIds.push(`side_directive_${summary.dungeonId}`);
      }
      expectedAfterEachChapter.push([...expectedClaimedTaskIds]);
    }

    result.summaries.forEach((summary, index) => {
      expect(summary.claimedTaskIdsAfter, summary.dungeonId).toEqual(expectedAfterEachChapter[index]);
    });
    expect(result.finalState.claimedTaskIds).toEqual(expectedClaimedTaskIds);
  });

  it('simulates every configured dungeon tier without deadly recommendations', () => {
    const result = simulateCampaignBalance();

    expect(result.stages).toHaveLength(DUNGEON_ORDER.length);
    expect(result.stages.map((stage) => stage.tier)).toEqual(
      DUNGEON_ORDER.map((dungeonId) => DUNGEONS[dungeonId].tier)
    );
    expect(result.stages.map((stage) => stage.readiness)).not.toContain('deadly');
  });

  it('grows the normal player on most stages and reaches the observatory by endgame', () => {
    const result = simulateCampaignBalance();
    const growthStages = result.stages.filter(
      (stage) => stage.beforePower < Math.max(stage.afterPower, stage.nextPreparedPower ?? stage.afterPower)
    );
    const finalStage = result.stages.at(-1);

    expect(growthStages.length).toBeGreaterThanOrEqual(4);
    expect(finalStage?.dungeonId).toBe(DUNGEON_ORDER.at(-1));
    expect(finalStage?.readiness).toMatch(/^(ready|hard)$/);
  });

  it('records planned investments for equipment, methods, and pets', () => {
    const result = simulateCampaignBalance();

    expect(result.stages.flatMap((stage) => stage.plannedPurchases)).toContain('armor_piercing_sword');
    expect(result.stages.flatMap((stage) => stage.plannedUpgrades).length).toBeGreaterThan(0);
    expect(result.stages.flatMap((stage) => stage.plannedMethods)).toContain('mist_breathing');
    expect(result.stages.flatMap((stage) => stage.plannedPets)).toContain('contract_sprite');
  });

  it('summarizes the default campaign as balanced without stomp or cliff warnings', () => {
    const result = analyzeCampaignBalance();

    expect(result.verdict).toBe('balanced');
    expect(result.warnings).toEqual([]);
  });

  it('warns when a custom reward plan creates a mid-campaign cliff', () => {
    const cliffRewards = Object.fromEntries(
      DUNGEON_ORDER.map((dungeonId) => [dungeonId, { rewardPoints: 0 }])
    ) as CampaignRewardPlan;

    const result = analyzeCampaignBalance({ rewards: cliffRewards });

    expect(result.verdict).toBe('needs-adjustment');
    expect(result.warnings.some((warning) => warning.includes('deadly'))).toBe(true);
  });

  it('treats a no-growth progression warning as a blocking balance verdict', () => {
    expect(getBalanceVerdictFromWarnings([
      'demon_tower_1 grants neither effective power nor bankable growth before the next entry.'
    ])).toBe('needs-adjustment');
    expect(getBalanceVerdictFromWarnings([
      'demon_tower_1 may be an early stomp at 181% recommended power.'
    ])).toBe('balanced');
  });

  it('keeps custom reward analysis behind real campaign gates', () => {
    const inconsistentState = {
      ...createInitialState(),
      completedDungeonIds: ['demon_tower_1' as const],
      claimedTaskIds: []
    };
    const result = analyzeCampaignBalance({
      initialState: inconsistentState,
      rewards: { demon_tower_1: { rewardPoints: 9999 } }
    });

    expect(result.stages).toHaveLength(1);
    expect(result.warnings[0]).toContain('gate is completed');
  });
});

describe('campaign imprint route simulation', () => {
  it('clears every real anchor before its boss and settles exactly one imprint per independent run', () => {
    const base = simulateSevenDungeonVictoryRoute().finalState;
    const result = simulateSevenDungeonImprintRoute(base);
    const definitions = getImprintRunProtocolDefinitions();

    expect(result.summaries).toHaveLength(DUNGEON_ORDER.length);
    expect(result.summaries.map((summary) => summary.dungeonId)).toEqual(DUNGEON_ORDER);

    result.summaries.forEach((summary, index) => {
      const definition = definitions[index];

      expect(summary.definition).toEqual(definition);
      expect(summary.requiredNodeId).toBe(definition.requiredNodeId);
      expect(summary.anchorClearIndex).toBeGreaterThanOrEqual(0);
      expect(summary.anchorClearIndex).toBeLessThan(summary.bossClearIndex);
      expect(summary.clearedNodeIds[summary.anchorClearIndex]).toBe(definition.requiredNodeId);
      expect(summary.clearedNodeIds[summary.bossClearIndex]).toBe(summary.bossNodeId);
      expect(summary.settlement).toMatchObject({
        status: 'succeeded',
        bossDefeated: true,
        anchorCompletedBeforeBoss: true,
        cycleImprintGranted: true
      });
      expect(summary.rewardPointBonus).toBeGreaterThan(0);
      expect(summary.settlement.protocolRewardPoints).toBe(
        Math.ceil(
          (summary.settlement.baseRewardPoints * definition.modifiers.clearRewardPointMultiplierPercent) / 100
        )
      );
      expect(summary.rewardPointBonus).toBe(
        summary.settlement.protocolRewardPoints - summary.settlement.baseRewardPoints
      );
      const routeCycleImprints = summary.clearedNodeIds.reduce((count, nodeId) => {
        const node = DUNGEONS[summary.dungeonId].nodes.find((candidate) => candidate.id === nodeId);
        return count + (node?.reward?.items?.cycle_imprint ?? 0);
      }, 0);
      expect(summary.cycleImprintDelta).toBe(1 + routeCycleImprints);
      expect(summary.cycleImprintsAfter).toBe(summary.cycleImprintsBefore + summary.cycleImprintDelta);
      if (summary.dungeonId === 'temporal_observatory') {
        expect(summary.finalState.equipped).toMatchObject({
          weapon: 'chronal_edge',
          armor: 'chronal_aegis'
        });
      } else if (
        summary.dungeonId !== 'entropy_ark' &&
        summary.dungeonId !== 'legacy_auction_court' &&
        summary.dungeonId !== 'genesis_vault' &&
        summary.dungeonId !== 'silent_broadcast_tower' &&
        summary.dungeonId !== 'lost_shelter' &&
        summary.dungeonId !== 'combat_replay_stage'
      ) {
        expect(summary.cycleImprintsBefore).toBe(base.inventory.cycle_imprint);
      } else if (
        summary.dungeonId === 'legacy_auction_court' ||
        summary.dungeonId === 'genesis_vault' ||
        summary.dungeonId === 'silent_broadcast_tower' ||
        summary.dungeonId === 'lost_shelter' ||
        summary.dungeonId === 'combat_replay_stage'
      ) {
        expect(summary.cycleImprintsBefore).toBeGreaterThan(0);
        expect(
          summary.cycleImprintsBefore,
          `${summary.dungeonId}:${summary.cycleImprintsBefore}`
        ).toBeLessThanOrEqual(base.inventory.cycle_imprint);
      }
      expect(summary.bossBreachAvoided).toBe(true);
      expect(summary.finalState.phase).toBe('result');
      expect(summary.finalState.run?.dungeonId).toBe(summary.dungeonId);
      expect(summary.finalState.run?.protocol).toEqual({ id: 'imprint', rulesVersion: 1 });
      expect(summary.finalState.run?.lawState).toMatchObject({
        dungeonId: summary.dungeonId,
        clearedNodeIds: expect.arrayContaining([summary.requiredNodeId, summary.bossNodeId])
      });
    });
  });

  it('records real focus spends and is deterministic without mutating its base state', () => {
    const base = simulateSevenDungeonVictoryRoute().finalState;
    const snapshot = structuredClone(base);
    const first = simulateSevenDungeonImprintRoute(base);
    const repeated = simulateSevenDungeonImprintRoute(base);

    expect(base).toEqual(snapshot);
    expect(repeated).toEqual(first);
    expect(first.summaries.some((summary) => summary.weaponSkillUseCount > 0)).toBe(true);

    for (const summary of first.summaries) {
      const monsterNodeIds = new Set(
        DUNGEONS[summary.dungeonId].nodes.filter((node) => node.type === 'monster').map((node) => node.id)
      );
      const skillSpends = summary.focusTrace.filter((trace) => trace.skillSpent);

      expect(summary.weaponSkillUseCount).toBe(skillSpends.length);
      expect(summary.usedWeaponSkillNodeIds).toEqual(skillSpends.map((trace) => trace.nodeId));
      expect(summary.usedWeaponSkillNodeIds.every((nodeId) => monsterNodeIds.has(nodeId))).toBe(true);
      expect(summary.usedWeaponSkillNodeIds.every((nodeId) => summary.clearedNodeIds.includes(nodeId))).toBe(true);
    }

    expect(simulateSevenDungeonVictoryRoute().summaries).toHaveLength(DUNGEON_ORDER.length);
  });
});

describe('campaign deep route simulation', () => {
  it('covers the full deep matrix with exact entry, success, failure, and duplicate-exit deltas', () => {
    const result = simulateSevenDungeonDeepRoute();
    const expectedRows = DUNGEON_ORDER.map((dungeonId) => {
      const definition = getRunProtocolDefinition(dungeonId, 'deep');
      if (!definition || definition.id !== 'deep') throw new Error(`Missing deep definition for ${dungeonId}.`);
      return [
        DUNGEONS[dungeonId].tier,
        dungeonId,
        [...definition.requiredNodeIds],
        definition.modifiers.enemyStatMultiplierPercent,
        definition.modifiers.clearRewardPointMultiplierPercent,
        definition.materialReward.itemId,
        definition.materialReward.amount
      ];
    });

    expect(result.baseState.completedDungeonIds).toEqual(DUNGEON_ORDER);
    expect(result.baseState.inventory.cycle_imprint).toBeGreaterThanOrEqual(1);
    expect(
      result.summaries.map((summary) => [
        summary.tier,
        summary.dungeonId,
        summary.requiredNodeIds,
        summary.enemyStatMultiplierPercent,
        summary.clearRewardPointMultiplierPercent,
        summary.definition.materialReward.itemId,
        summary.definition.materialReward.amount
      ])
    ).toEqual(expectedRows);

    result.summaries.forEach((summary, index) => {
      const previous = result.summaries[index - 1];
      if (previous) {
        expect(summary.enemyStatMultiplierPercent).toBeGreaterThan(previous.enemyStatMultiplierPercent);
        expect(summary.clearRewardPointMultiplierPercent).toBeGreaterThan(
          previous.clearRewardPointMultiplierPercent
        );
      }

      expect(summary.success.entryProtocolId).toBe('deep');
      expect(summary.success.cycleImprintsBeforeEntry).toBe(summary.missingAnchor.cycleImprintsBeforeEntry);
      expect(summary.success.cycleImprintsAfterEntry).toBe(summary.success.cycleImprintsBeforeEntry - 1);
      expect(summary.success.entryCycleImprintDelta).toBe(-1);
      expect(summary.success.anchorClearIndices).toHaveLength(2);
      expect(
        summary.success.anchorClearIndices.every(
          (anchorIndex) => anchorIndex >= 0 && anchorIndex < summary.success.bossClearIndex
        )
      ).toBe(true);
      expect(summary.success.settlement).toMatchObject({
        protocol: { id: 'deep', rulesVersion: 1 },
        status: 'succeeded',
        bossDefeated: true,
        anchorCompletedBeforeBoss: true,
        cycleImprintGranted: false,
        materialReward: summary.definition.materialReward
      });
      expect(summary.success.settlement.rewardPointBonus).toBeGreaterThan(0);
      expect(summary.success.settlement.protocolRewardPoints).toBe(
        Math.ceil(
          (summary.success.settlement.baseRewardPoints * summary.clearRewardPointMultiplierPercent) / 100
        )
      );
      expect(summary.success.settlement.rewardPointBonus).toBe(
        summary.success.settlement.protocolRewardPoints - summary.success.settlement.baseRewardPoints
      );
      expect(summary.success.exitResourceDeltas.cycleImprint).toBe(
        Number(
          summary.dungeonId === 'mirror_cycle_city' ||
          summary.dungeonId === 'redaction_scriptorium' ||
          summary.dungeonId === 'legacy_auction_court' ||
          summary.dungeonId === 'genesis_vault' ||
          summary.dungeonId === 'silent_broadcast_tower' ||
          summary.dungeonId === 'lost_shelter' ||
          summary.dungeonId === 'false_testimony_court' ||
          summary.dungeonId === 'combat_replay_stage' ||
          summary.dungeonId === 'panopticon_city'
        )
      );

      expect(summary.missingAnchor.entryProtocolId).toBe('deep');
      expect(summary.missingAnchor.entryCycleImprintDelta).toBe(-1);
      expect(summary.missingAnchor.cycleImprintsAfterEntry).toBe(
        summary.missingAnchor.cycleImprintsBeforeEntry - 1
      );
      const omittedAnchorIndex = summary.requiredNodeIds.indexOf(summary.missingAnchor.omittedNodeId);
      const includedAnchorIndex = omittedAnchorIndex === 0 ? 1 : 0;
      expect(omittedAnchorIndex).toBeGreaterThanOrEqual(0);
      expect(summary.missingAnchor.anchorClearIndices[includedAnchorIndex]).toBeGreaterThanOrEqual(0);
      if (summary.missingAnchor.bossClearIndex >= 0) {
        expect(summary.missingAnchor.anchorClearIndices[includedAnchorIndex]).toBeLessThan(
          summary.missingAnchor.bossClearIndex
        );
      } else {
        expect(['entropy_ark', 'silent_broadcast_tower', 'lost_shelter', 'false_testimony_court']).toContain(
          summary.dungeonId
        );
      }
      expect(summary.missingAnchor.anchorClearIndices[omittedAnchorIndex]).toBe(-1);
      expect(summary.missingAnchor.settlement).toMatchObject({
        protocol: { id: 'deep', rulesVersion: 1 },
        status: 'failed',
        bossDefeated:
          summary.dungeonId === 'silent_broadcast_tower' ||
          summary.dungeonId === 'lost_shelter' ||
          summary.dungeonId === 'false_testimony_court' ||
          summary.missingAnchor.bossClearIndex >= 0,
        anchorCompletedBeforeBoss: false,
        rewardPointBonus: 0,
        cycleImprintGranted: false
      });
      expect(summary.missingAnchor.settlement.materialReward).toBeUndefined();
      expect(summary.missingAnchor.exitResourceDeltas.cycleImprint).toBe(
        Number(
          summary.dungeonId === 'mirror_cycle_city' ||
          summary.dungeonId === 'redaction_scriptorium' ||
          summary.dungeonId === 'legacy_auction_court' ||
          summary.dungeonId === 'genesis_vault' ||
          summary.dungeonId === 'combat_replay_stage' ||
          summary.dungeonId === 'panopticon_city'
        )
      );

      expect(summary.protocolMaterialInventoryDelta).toBe(2);
      expect(summary.routeMaterialInventoryDelta).toBe(
        summary.dungeonId === 'silent_broadcast_tower' ||
        summary.dungeonId === 'lost_shelter' ||
        summary.dungeonId === 'false_testimony_court'
          ? 6
          : summary.dungeonId === 'legacy_auction_court'
            ? 3
            : 2
      );
      expect(summary.nonProtocolMaterialInventoryDelta).toBe(
        summary.dungeonId === 'silent_broadcast_tower' ||
        summary.dungeonId === 'lost_shelter' ||
        summary.dungeonId === 'false_testimony_court'
          ? 4
          : summary.dungeonId === 'legacy_auction_court'
            ? 1
            : 0
      );
      expect(summary.success.exitResourceDeltas.material).toBe(
        summary.missingAnchor.exitResourceDeltas.material + summary.routeMaterialInventoryDelta
      );
      expect(summary.duplicateExitResourceDeltas).toEqual({
        rewardPoints: 0,
        lingyun: 0,
        cycleImprint: 0,
        material: 0
      });
    });

    const redaction = result.summaries.find((summary) => summary.dungeonId === 'redaction_scriptorium');
    expect(redaction?.definition.materialReward).toEqual({ itemId: 'redaction_ink', amount: 2 });
    expect(redaction?.protocolMaterialInventoryDelta).toBe(redaction?.definition.materialReward.amount);
    expect(
      (redaction?.success.exitResourceDeltas.material ?? 0) -
      (redaction?.missingAnchor.exitResourceDeltas.material ?? 0)
    ).toBe(redaction?.definition.materialReward.amount);

    const auction = result.summaries.find((summary) => summary.dungeonId === 'legacy_auction_court');
    expect(auction?.legacyAuction).toMatchObject({
      choices: {
        force_lot_dais: 'bid',
        guard_lot_dais: 'burn',
        art_lot_dais: 'fold',
        return_lot_dais: 'bid'
      },
      optionalBidVaultNodeIds: ['force_claim_vault', 'return_claim_vault'],
      bossNodeCleared: true,
      exitNodeCleared: true,
      successfulExit: true
    });
    expect(auction?.legacyAuction?.choiceTrace).toHaveLength(4);
    expect(new Set(auction?.legacyAuction?.choiceTrace.map(({ choice }) => choice))).toEqual(
      new Set(['bid', 'burn', 'fold'])
    );
    for (const trace of auction?.legacyAuction?.choiceTrace ?? []) {
      expect(trace.scripBefore - trace.scripCost).toBe(trace.scripAfter);
    }
    expect(auction?.legacyAuction?.scripConsumed).toBe(
      auction?.legacyAuction?.choiceTrace.reduce((total, trace) => total + trace.scripCost, 0)
    );
    expect(auction?.legacyAuction?.scripCollected).toBe(
      (auction?.legacyAuction?.scripConsumed ?? 0) +
      (auction?.legacyAuction?.scripRemainingBeforeExit ?? 0)
    );
    expect(auction?.legacyAuction?.bossSnapshot).toEqual(auction?.legacyAuction?.choices);
    expect(auction?.legacyAuction?.bossModifiers.sealed).not.toEqual(
      auction?.legacyAuction?.bossModifiers.awakened
    );
    expect(auction?.legacyAuction?.frozenSoulSkillIds).toContain('gauntlet_breakbeat');
  });

  it('repeats the full deep route matrix deterministically', () => {
    expect(simulateSevenDungeonDeepRoute()).toEqual(simulateSevenDungeonDeepRoute());
  });
});

describe('campaign law-aware route simulation', () => {
  function summaryFor(
    summaries: SevenDungeonLawRouteSummary[],
    dungeonId: SevenDungeonLawRouteSummary['dungeonId']
  ): SevenDungeonLawRouteSummary {
    const summary = summaries.find((candidate) => candidate.dungeonId === dungeonId);
    if (!summary) throw new Error(`Missing law route summary for ${dungeonId}.`);
    return summary;
  }

  it('completes every real route with repeated law transitions and structured evidence', () => {
    const result = simulateSevenDungeonLawRoute();

    expect(result.summaries.map((summary) => summary.dungeonId)).toEqual(DUNGEON_ORDER);
    expect(result.summaries.filter((summary) => summary.completed)).toHaveLength(DUNGEON_ORDER.length);

    for (const summary of result.summaries) {
      const transitionCount = summary.lawStatuses.reduce(
        (count, status, index, statuses) => count + (index > 0 && status.status !== statuses[index - 1].status ? 1 : 0),
        0
      );

      expect(summary.visitedNodeIds.length, `${summary.dungeonId} did not move through the real grid.`).toBeGreaterThan(1);
      expect(transitionCount, `${summary.dungeonId} recorded fewer than two law transitions.`).toBeGreaterThanOrEqual(2);
      expect(summary.modifierEvidence.length, `${summary.dungeonId} has no modifier evidence.`).toBeGreaterThan(0);
      expect(
        summary.modifierEvidence.some((evidence) => evidence.before !== evidence.after),
        `${summary.dungeonId} did not record a real numeric or capability difference.`
      ).toBe(true);
    }
  });

  it('raises and relieves demon fog, calibrates metro tide, and proves both mine gravity modes', () => {
    const summaries = simulateSevenDungeonLawRoute().summaries;
    const demon = summaryFor(summaries, 'demon_tower_1');
    const metro = summaryFor(summaries, 'metro_abyss');
    const mine = summaryFor(summaries, 'starfall_mine');

    expect(demon.visitedNodeIds).toContain('sealed_cache');
    expect(demon.lawStatuses.find((status) => status.checkpoint === 'first-fog-rise')?.law).toMatchObject({ fogPressure: 1 });
    expect(demon.lawStatuses.find((status) => status.checkpoint === 'second-fog-rise')?.law).toMatchObject({ fogPressure: 2 });
    expect(demon.lawStatuses.find((status) => status.checkpoint === 'relief-event')?.law).toMatchObject({ fogPressure: 0 });
    expect(demon.lawStatuses.find((status) => status.checkpoint === 'combat:bone_lane_monster')?.law).toMatchObject({ fogPressure: 0 });
    expect(demon.modifierEvidence).toContainEqual(expect.objectContaining({
      metric: 'encounter.allStatsPercent',
      before: 10,
      after: 0
    }));

    expect(metro.visitedNodeIds).toContain('signal_cache');
    expect(metro.lawStatuses.find((status) => status.checkpoint === 'flood-tide')?.law).toMatchObject({ tide: 'flood' });
    expect(metro.lawStatuses.find((status) => status.checkpoint === 'mirror-tide')?.law).toMatchObject({ tide: 'mirror' });
    expect(metro.lawStatuses.find((status) => status.checkpoint === 'signal-calibrated')?.law).toMatchObject({ tide: 'ebb' });
    expect(metro.lawStatuses.find((status) => status.checkpoint === 'combat:mirror_thread_spider')?.law).toMatchObject({ tide: 'ebb' });
    expect(metro.modifierEvidence).toContainEqual(expect.objectContaining({
      metric: 'trap.damagePercent',
      before: 20,
      after: 0
    }));

    expect(mine.visitedNodeIds).toEqual(expect.arrayContaining(['tilted_gravity_switch', 'backup_gravity_well']));
    expect(mine.lawStatuses.some((status) => status.law.kind === 'starfall_mine' && status.law.gravity === 'upward')).toBe(true);
    expect(mine.lawStatuses.some((status) => status.law.kind === 'starfall_mine' && status.law.gravity === 'downward')).toBe(true);
    expect(mine.modifierEvidence).toContainEqual(expect.objectContaining({
      metric: 'trap.damagePercent',
      before: -20,
      after: 20
    }));
    const defenseEvidence = mine.modifierEvidence.find((evidence) => evidence.metric === 'encounter.defense');
    expect(Number(defenseEvidence?.before)).toBeGreaterThan(Number(defenseEvidence?.after));
    expect(mine.modifierEvidence).toContainEqual(expect.objectContaining({
      metric: 'backupGravityWell.transferTarget',
      before: 'starfall_mine',
      after: 'rust_hospital'
    }));
  });

  it('calibrates past then future before legally traversing the observatory bridge', () => {
    const temporal = summaryFor(
      simulateSevenDungeonLawRoute().summaries,
      'temporal_observatory'
    );

    expect(temporal.visitedNodeIds).toEqual(
      expect.arrayContaining([
        'past_calibration_anchor',
        'future_calibration_anchor',
        'calibration_bridge',
        'zero_hour_regent'
      ])
    );
    expect(temporal.lawStatuses.find((status) => status.checkpoint === 'entry')?.law).toEqual({
      kind: 'temporal_observatory',
      pastCalibrated: false,
      futureCalibrated: false
    });
    expect(
      temporal.lawStatuses.find((status) => status.checkpoint === 'past-calibrated')?.law
    ).toEqual({
      kind: 'temporal_observatory',
      pastCalibrated: true,
      futureCalibrated: false
    });
    expect(
      temporal.lawStatuses.find((status) => status.checkpoint === 'dual-calibrated')
    ).toMatchObject({
      targetReached: true,
      law: {
        kind: 'temporal_observatory',
        pastCalibrated: true,
        futureCalibrated: true
      }
    });
    expect(temporal.routeEvidence.gateChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ gateId: 'temporal_calibration_bridge', status: 'closed' }),
        expect.objectContaining({
          gateId: 'temporal_calibration_bridge',
          status: 'open',
          traversed: true
        })
      ])
    );
    expect(
      temporal.routeEvidence.movements.every(
        (movement) => movement.legal && movement.blockReason === undefined
      )
    ).toBe(true);
  });

  it('resolves all ark headings, changes entropy, and locks collapse evidence at the helmsman', () => {
    const entropy = summaryFor(simulateSevenDungeonLawRoute().summaries, 'entropy_ark');
    const headingTrace = entropy.routeEvidence.headingChoiceTrace;
    const bossLock = entropy.lawStatuses.find(
      (status) => status.checkpoint === 'combat:last_helmsman'
    );

    expect(headingTrace.map((choice) => choice.nodeId)).toEqual([
      'bow_heading_console',
      'midship_heading_console',
      'stern_heading_console'
    ]);
    expect(headingTrace.every((choice) => choice.entropyBefore !== choice.entropyAfter)).toBe(true);
    expect(new Set(headingTrace.map((choice) => choice.choice))).toEqual(new Set(['steady', 'rush']));
    expect(bossLock?.law).toMatchObject({
      kind: 'entropy_ark',
      pendingHeadingNodeId: null,
      bossEntropyLocked: true,
      collapseLayers: expect.any(Number)
    });
    expect(entropy.modifierEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ metric: 'bossEntropyLocked', before: false, after: true }),
      expect.objectContaining({ metric: 'collapseLayers', after: expect.any(Number) })
    ]));
  });

  it('resolves all broadcast relays, enters the balanced switchboard, and freezes boss noise', () => {
    const broadcast = summaryFor(
      simulateSevenDungeonLawRoute().summaries,
      'silent_broadcast_tower'
    );
    const relayTrace = broadcast.routeEvidence.broadcastRelayChoiceTrace;
    const bossLock = broadcast.lawStatuses.find(
      (status) => status.checkpoint === 'combat:last_broadcaster'
    );

    expect(relayTrace.map(({ nodeId, choice }) => ({ nodeId, choice }))).toEqual([
      { nodeId: 'south_relay_console', choice: 'mute' },
      { nodeId: 'north_relay_console', choice: 'broadcast' },
      { nodeId: 'central_relay_console', choice: 'mute' }
    ]);
    expect(relayTrace.every((choice) => choice.noiseAfter === choice.noiseBefore + choice.noiseDelta)).toBe(true);
    expect(broadcast.visitedNodeIds).toEqual(expect.arrayContaining([
      'acoustic_tripwire',
      'soul_recharge_broadcast',
      'balanced_switchboard',
      'last_broadcaster',
      'broadcast_exit'
    ]));
    expect(broadcast.routeEvidence.gateChecks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        gateId: 'broadcast_balanced_switchboard_gate',
        status: 'open',
        traversed: true
      }),
      expect.objectContaining({
        gateId: 'broadcast_memory_boss_gate',
        status: 'open',
        traversed: true
      })
    ]));
    expect(bossLock?.law).toMatchObject({
      kind: 'silent_broadcast_tower',
      bossNoiseSnapshot: expect.any(Number)
    });
    expect(broadcast.modifierEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ metric: 'resolvedRelayCount', before: 0, after: 3 })
    ]));
  });

  it('proves the deterministic mirror law matrix through real phase, anchor, boss, and portal APIs', () => {
    const result = simulateMirrorCycleCityLawScenario();

    expect(result.transitionCosts.map(({ damagePercent }) => damagePercent)).toEqual([10, 5]);
    for (const transition of result.transitionCosts) {
      expect(transition.hpBefore - transition.hpAfter).toBe(
        Math.floor((transition.hpBefore * transition.damagePercent) / 100)
      );
    }
    expect(result.outgoingModifiers).toEqual({
      plainReal: { forcePercent: 12, artPercent: -6 },
      plainMirror: { forcePercent: -6, artPercent: 12 },
      visorReal: { forcePercent: 12, artPercent: 0 },
      visorMirror: { forcePercent: 0, artPercent: 12 }
    });

    expect(result.anchorShellMatrix.map((entry) => entry.anchors)).toEqual([
      { real: true, mirror: true },
      { real: true, mirror: false },
      { real: false, mirror: false },
      { real: true, mirror: false }
    ]);
    expect(result.anchorShellMatrix.map((entry) => entry.totalShells)).toEqual([0, 1, 2, 0]);
    expect(result.anchorShellMatrix.map((entry) => entry.prismCredit)).toEqual([0, 0, 0, 1]);
    expect(result.anchorShellMatrix.at(-1)?.entryPassives.homecomingPrism).toBe(true);
    expect(result.shellConsumption).toEqual({
      remainingShells: [2, 1, 0],
      brokenMirrorShells: [0, 1, 2]
    });

    expect(result.completedRoute.phaseChoices.map((choice) => choice.nodeId)).toEqual([
      'first_phase_mirror',
      'second_phase_mirror',
      'third_phase_mirror'
    ]);
    expect(result.completedRoute.phaseChoices.map((choice) => choice.phase)).toEqual([
      'real',
      'mirror',
      'mirror'
    ]);
    expect(new Set(result.completedRoute.phaseChoices.map((choice) => choice.phase))).toEqual(
      new Set(['real', 'mirror'])
    );
    expect(result.completedRoute).toMatchObject({
      bossNodeCleared: true,
      exitNodeCleared: true,
      completed: true
    });
    expect(result.completedRoute.routeEvidence.movements.every((movement) => movement.legal)).toBe(true);

    expect(result.portalRing.map(({ nodeId, targetDungeonId, targetNodeId, choice }) => ({
      nodeId,
      targetDungeonId,
      targetNodeId,
      choice
    }))).toEqual([
      {
        nodeId: 'upper_return_portal',
        targetDungeonId: 'redaction_scriptorium',
        targetNodeId: 'folio_gate',
        choice: 'stabilize'
      },
      {
        nodeId: 'lower_return_portal',
        targetDungeonId: 'redaction_scriptorium',
        targetNodeId: 'lower_supply_margin',
        choice: 'stabilize'
      }
    ]);
  });

  it('keeps the dedicated mirror scenario deterministic and isolated from older campaign simulations', () => {
    const base = simulateSevenDungeonVictoryRoute().finalState;
    const snapshot = structuredClone(base);
    const olderBefore = simulateSevenDungeonLawRoute(base);
    const first = simulateMirrorCycleCityLawScenario(base);
    const repeated = simulateMirrorCycleCityLawScenario(base);
    const olderAfter = simulateSevenDungeonLawRoute(base);

    expect(base).toEqual(snapshot);
    expect(repeated).toEqual(first);
    expect(olderAfter).toEqual(olderBefore);
  });

  it('resolves the standard redaction clauses in order with exact cost and authored gates', () => {
    const result = getRedactionSimulation();

    expect(result.standardPath.clauseChoices).toEqual({
      body_clause_desk: 'certify',
      memory_clause_desk: 'certify',
      return_clause_desk: 'redact'
    });
    expect(result.standardPath.redactCost).toMatchObject({
      nodeId: 'return_clause_desk',
      costPercent: 8
    });
    expect(result.standardPath.redactCost.damage).toBe(
      Math.floor(result.standardPath.redactCost.maxHp * 0.08)
    );
    expect(result.standardPath.redactCost.hpAfter).toBe(
      result.standardPath.redactCost.hpBefore - result.standardPath.redactCost.damage
    );
    expect(result.standardPath.gates).toEqual({
      certifiedBodyAreaOpen: true,
      certifiedMemoryAreaOpen: true,
      redactedReturnAreaOpen: false,
      bossApproachOpen: true
    });
    expect(result.standardPath.bossSnapshot).toEqual(result.standardPath.clauseChoices);
  });

  it('freezes all-certify and all-redact boss modifiers and halves only matching entry passives', () => {
    const result = getRedactionSimulation();
    const zeroEffect = {
      defensePercent: 0,
      artPowerPercent: 0,
      healingPercent: 0,
      guardEffectPercent: 0
    };

    expect(result.bossComparison.allCertify).toEqual({
      sealed: {
        defensePercent: 10,
        artPowerPercent: 10,
        healingPercent: -10,
        guardEffectPercent: -10
      },
      awakened: {
        defensePercent: 20,
        artPowerPercent: 20,
        healingPercent: -20,
        guardEffectPercent: -20
      }
    });
    expect(result.bossComparison.allRedact).toEqual({ sealed: zeroEffect, awakened: zeroEffect });

    const passiveByEquipment = {
      redline_edge: 'redlineEdge',
      palimpsest_mantle: 'palimpsestMantle',
      final_proof_seal: 'finalProofSeal'
    } as const;
    for (const row of result.equipmentMatrix) {
      const enabledPassives = Object.entries(row.entryPassives)
        .filter(([, enabled]) => enabled)
        .map(([passive]) => passive);
      expect(enabledPassives).toEqual([passiveByEquipment[row.equipmentId]]);
      expect(row.frozenAfterMutation).toBe(true);
      expect(row.projectedAfterMutation).toEqual(row.projectedAtBoss);
      for (const phase of ['sealed', 'awakened'] as const) {
        const baseline = result.bossComparison.allCertify[phase];
        for (const metric of Object.keys(baseline) as Array<keyof typeof baseline>) {
          expect(row.projectedAtBoss[phase][metric]).toBe(
            row.matchingMetrics.includes(metric) ? baseline[metric] / 2 : baseline[metric]
          );
        }
      }
    }
  });

  it('crosses redaction through Tier 19 to demon without leaking prior law state', () => {
    const first = getRedactionSimulation();
    const repeated = simulateRedactionScriptoriumLawRoute(first.baseState);

    expect(first.portalRing).toEqual({
      dungeonIds: ['redaction_scriptorium', 'legacy_auction_court', 'genesis_vault', 'silent_broadcast_tower', 'lost_shelter', 'false_testimony_court', 'combat_replay_stage', 'panopticon_city', 'demon_tower_1'],
      lawKinds: ['redaction_scriptorium', 'legacy_auction_court', 'genesis_vault', 'silent_broadcast_tower', 'lost_shelter', 'false_testimony_court', 'combat_replay_stage', 'panopticon_city', 'demon_tower'],
      noPriorLawLeakage: true
    });
    expect(repeated).toEqual(first);
  });

  it('resolves all 81 auction choice tuples through real run-loot and freezes deterministic boss projections', () => {
    const first = simulateLegacyAuctionCourtLawScenario();
    const repeated = simulateLegacyAuctionCourtLawScenario(first.baseState);

    expect(first.rows).toHaveLength(81);
    expect(new Set(first.rows.map(({ choiceKey }) => choiceKey)).size).toBe(81);
    for (const nodeId of [
      'force_lot_dais',
      'guard_lot_dais',
      'art_lot_dais',
      'return_lot_dais'
    ] as const) {
      for (const choice of ['bid', 'burn', 'fold'] as const) {
        expect(first.rows.filter((row) => row.choices[nodeId] === choice)).toHaveLength(27);
      }
    }
    for (const row of first.rows) {
      expect(row.choiceTrace).toHaveLength(4);
      expect(row.bossSnapshot).toEqual(row.choices);
      expect(row.frozenBossSnapshot).toBe(true);
      expect(row.scripCollected).toBe(row.scripConsumed + row.scripRemaining);
      expect(row.routeEvidence.movements.every(({ legal }) => legal)).toBe(true);
      for (const trace of row.choiceTrace) {
        expect(trace.scripBefore - trace.scripCost).toBe(trace.scripAfter);
        expect(trace.resolvedLotChoices[trace.nodeId]).toBe(trace.choice);
      }
    }
    expect(first.rows.some((row) =>
      JSON.stringify(row.bossModifiers.sealed) !== JSON.stringify(row.bossModifiers.awakened)
    )).toBe(true);
    expect(repeated.rows.map((row) => ({
      choiceKey: row.choiceKey,
      choiceTrace: row.choiceTrace,
      scripCollected: row.scripCollected,
      scripConsumed: row.scripConsumed,
      scripRemaining: row.scripRemaining,
      bossSnapshot: row.bossSnapshot,
      bossModifiers: row.bossModifiers
    }))).toEqual(first.rows.map((row) => ({
      choiceKey: row.choiceKey,
      choiceTrace: row.choiceTrace,
      scripCollected: row.scripCollected,
      scripConsumed: row.scripConsumed,
      scripRemaining: row.scripRemaining,
      bossSnapshot: row.bossSnapshot,
      bossModifiers: row.bossModifiers
    })));
  });

  it('relieves hospital pollution and enters both verdict bosses with the required live law state', () => {
    const summaries = simulateSevenDungeonLawRoute().summaries;
    const hospital = summaryFor(summaries, 'rust_hospital');
    const arena = summaryFor(summaries, 'ash_arena');
    const citadel = summaryFor(summaries, 'void_citadel');

    expect(hospital.visitedNodeIds).toEqual(expect.arrayContaining(['pharmacy_reward', 'triage_reward']));
    expect(hospital.lawStatuses.find((status) => status.checkpoint === 'pollution-high')?.law).toMatchObject({ pollution: 3 });
    expect(hospital.lawStatuses.find((status) => status.checkpoint === 'triage-relief')?.law).toMatchObject({ pollution: 1 });
    expect(hospital.lawStatuses.find((status) => status.checkpoint === 'combat:chief_pulse_doctor')?.law).toMatchObject({ pollution: 1 });
    expect(hospital.modifierEvidence).toContainEqual(expect.objectContaining({
      metric: 'healingPercent',
      before: -10,
      after: 0
    }));

    expect(arena.openingDistribution).toEqual({ force: 1, art: 1, guard: 1 });
    expect(arena.lawStatuses.find((status) => status.checkpoint === 'guard-victory')).toMatchObject({
      status: '三式齐全，裁决改判',
      targetReached: true
    });
    expect(arena.lawStatuses.find((status) => status.checkpoint === 'combat:furnace_judge')?.targetReached).toBe(true);
    expect(arena.modifierEvidence).toContainEqual(expect.objectContaining({
      metric: 'outgoingDamage.forcePercent',
      before: 0,
      after: 10
    }));

    expect(citadel.openingDistribution).toEqual({ force: 1, art: 1, guard: 1 });
    expect(citadel.lawStatuses.find((status) => status.checkpoint === 'combat:main_god_echo')).toMatchObject({
      status: '分布均衡，克制关闭',
      targetReached: true,
      law: { bossAssessmentLocked: true, bossCounter: null }
    });
    expect(citadel.modifierEvidence).toContainEqual(expect.objectContaining({
      metric: 'bossAssessmentLocked',
      before: false,
      after: true
    }));
  });

  it('seals archive features in order, keeps basic actions live, and restores through the real index', () => {
    const archive = summaryFor(simulateSevenDungeonLawRoute().summaries, 'dream_archive');

    expect(archive.lawStatuses.find((status) => status.checkpoint === 'consumable-sealed')?.law).toMatchObject({
      sealedFeatures: ['consumable']
    });
    expect(archive.lawStatuses.find((status) => status.checkpoint === 'method-sealed')?.law).toMatchObject({
      sealedFeatures: ['consumable', 'method']
    });
    expect(archive.lawStatuses.find((status) => status.checkpoint === 'pet-sealed')?.law).toMatchObject({
      sealedFeatures: ['consumable', 'method', 'pet']
    });
    expect(archive.modifierEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ metric: 'consumableAvailable', before: false, after: true }),
      expect.objectContaining({ metric: 'methodAvailable', before: false, after: true }),
      expect.objectContaining({ metric: 'basicAttackAndGuardProgressed', before: true, after: true })
    ]));
    expect(archive.lawStatuses.find((status) => status.checkpoint === 'index-restored')?.law).toMatchObject({
      sealedFeatures: []
    });
    expect(archive.lawStatuses.find((status) => status.checkpoint === 'combat:dream_jailer_second')?.law).toMatchObject({
      sealedFeatures: []
    });
  });

  it('is deeply deterministic and leaves its supplied campaign state untouched', () => {
    const base = simulateSevenDungeonVictoryRoute().finalState;
    const snapshot = structuredClone(base);
    const first = simulateSevenDungeonLawRoute(base);
    const repeated = simulateSevenDungeonLawRoute(base);

    expect(base).toEqual(snapshot);
    expect(repeated).toEqual(first);
    expect(simulateSevenDungeonVictoryRoute().summaries).toHaveLength(DUNGEON_ORDER.length);
    expect(simulateSevenDungeonImprintRoute(base).summaries).toHaveLength(DUNGEON_ORDER.length);
  });
});

describe('campaign run relic route simulation', () => {
  let cachedResult: ReturnType<typeof simulateSevenDungeonRunRelicRoute> | undefined;
  const getResult = (): ReturnType<typeof simulateSevenDungeonRunRelicRoute> => {
    cachedResult ??= simulateSevenDungeonRunRelicRoute();
    return cachedResult;
  };

  it('resolves every unique draft node and completes every boss and exit without a route lock', () => {
    const result = getResult();
    const expectedDraftIds = DUNGEON_ORDER.flatMap((dungeonId) =>
      DUNGEONS[dungeonId].nodes.flatMap((node) => node.relicDraftId ?? [])
    ).sort();

    expect(result.summaries.map((summary) => summary.dungeonId)).toEqual(DUNGEON_ORDER);
    expect(result.draftEvidence).toHaveLength(expectedDraftIds.length);
    expect(new Set(result.draftEvidence.map((draft) => draft.relicDraftId)).size).toBe(expectedDraftIds.length);
    expect(result.draftEvidence.map((draft) => draft.relicDraftId).sort()).toEqual(expectedDraftIds);
    expect(result.finalState.phase).toBe('hub');
    expect(result.finalState.run).toBeUndefined();

    for (const summary of result.summaries) {
      expect(summary.relicDraftIds).toHaveLength(2);
      expect(summary.routeEvidence.relicDraftTrace).toHaveLength(2);
      expect(summary.routeEvidence.tacticalLoadoutTrace).toHaveLength(1);
      expect(summary.bossNodeCleared).toBe(true);
      expect(summary.exitNodeCleared).toBe(true);
      expect(summary.completed).toBe(true);
      expect(summary.pendingDraftCleared).toBe(true);
      expect(summary.archiveStatus).toBe('archived');
      expect(summary.returnedToHub).toBe(true);
      expect(summary.routeEvidence.relicDraftTrace.every((draft) => draft.frame === summary.frame)).toBe(true);
      expect(summary.routeEvidence.movements.every((movement) => movement.legal && !movement.blockReason)).toBe(true);
    }
  });

  it('proves ordinary two-candidate and equipped level-2 matching-conduit three-candidate drafts', () => {
    const result = getResult();
    const ordinarySummary = result.summaries.find((summary) => summary.candidateMode === 'ordinary');
    const threeCandidateDraft = result.draftEvidence.find((draft) => draft.candidateCount === 3);

    expect(result.coveredFrames).toEqual(['assault', 'bulwark', 'wayfinder']);
    expect(ordinarySummary?.conduitSourceEquipmentIds).toEqual([]);
    expect(ordinarySummary?.routeEvidence.relicDraftTrace.map((draft) => draft.candidateCount)).toEqual([2, 2]);
    expect(threeCandidateDraft).toBeDefined();
    expect(threeCandidateDraft?.conduitSourceEquipmentIds.length).toBeGreaterThan(0);

    for (const equipmentId of threeCandidateDraft?.conduitSourceEquipmentIds ?? []) {
      expect(threeCandidateDraft?.conduitSourceLevels[equipmentId]).toBeGreaterThanOrEqual(2);
      expect(getEquipmentRelicConduitByEquipmentId(equipmentId)?.frameId).toBe(threeCandidateDraft?.frame);
    }
  });

  it('covers every relic effect while only changing run-scoped stats and a real reward result', () => {
    const result = getResult();
    const draftFor = (relicId: (typeof RUN_RELIC_IDS)[number]) => {
      const draft = result.draftEvidence.find((candidate) => candidate.chosenRelicId === relicId);
      if (!draft) throw new Error(`Missing draft evidence for ${relicId}.`);
      return draft;
    };

    expect(result.coveredRelicIds).toEqual(RUN_RELIC_IDS);
    for (const draft of result.draftEvidence) {
      expect(draft.powerAfter).toBe(draft.powerBefore);
      expect(draft.readinessAfter).toBe(draft.readinessBefore);
      expect(draft.effectsAfter).not.toEqual(draft.effectsBefore);
    }

    expect(draftFor('mist_edge').effectsAfter.statBonuses.attack - draftFor('mist_edge').effectsBefore.statBonuses.attack).toBe(6);
    expect(draftFor('mist_edge').effectsAfter.statBonuses.artPower - draftFor('mist_edge').effectsBefore.statBonuses.artPower).toBe(4);
    expect(draftFor('focus_prism').effectsAfter.combatStartFocusBonus - draftFor('focus_prism').effectsBefore.combatStartFocusBonus).toBe(1);
    expect(draftFor('hunter_clock').effectsAfter.combatRewardPointsBonusPercent - draftFor('hunter_clock').effectsBefore.combatRewardPointsBonusPercent).toBe(20);
    expect(draftFor('bone_shell').effectsAfter.statBonuses.defense - draftFor('bone_shell').effectsBefore.statBonuses.defense).toBe(4);
    expect(draftFor('mending_thread').effectsAfter.rewardNodeHealing - draftFor('mending_thread').effectsBefore.rewardNodeHealing).toBe(12);
    expect(draftFor('iron_echo').effectsAfter.trapDamageReductionPercent - draftFor('iron_echo').effectsBefore.trapDamageReductionPercent).toBe(25);
    expect(draftFor('rift_step').effectsAfter.statBonuses.speed - draftFor('rift_step').effectsBefore.statBonuses.speed).toBe(4);
    expect(draftFor('rift_step').effectsAfter.statBonuses.trapCheck - draftFor('rift_step').effectsBefore.statBonuses.trapCheck).toBe(4);
    expect(draftFor('gate_anchor').effectsAfter.forcedPortalBacklashReductionPercent - draftFor('gate_anchor').effectsBefore.forcedPortalBacklashReductionPercent).toBe(35);
    expect(draftFor('lucky_map').effectsAfter.rewardNodeRewardPointsBonusPercent - draftFor('lucky_map').effectsBefore.rewardNodeRewardPointsBonusPercent).toBe(20);

    const boostedReward = result.rewardEvidence.find(
      (reward) => reward.effects.rewardNodeRewardPointsBonusPercent === 20 && reward.rewardPointsGained > reward.baseRewardPoints
    );
    expect(boostedReward).toBeDefined();
    expect(boostedReward?.rewardPointsGained).toBe(Math.ceil((boostedReward?.baseRewardPoints ?? 0) * 1.2));
  });

  it('archives through the real settlement API, seeds the next matching frame, and is deterministic', () => {
    const result = getResult();
    const sourceSummary = result.summaries.find(
      (summary) => summary.dungeonId === result.archiveSeedEvidence.sourceDungeonId
    );
    const seededSummary = result.summaries.find(
      (summary) => summary.dungeonId === result.archiveSeedEvidence.seededDungeonId
    );
    const seededDraft = seededSummary?.routeEvidence.relicDraftTrace[0];

    expect(result.archiveSeedEvidence).toMatchObject({
      archiveStatus: 'archived',
      returnedToHub: true,
      seedWasFirstCandidate: true
    });
    expect(sourceSummary?.chosenRelicIds).toContain(result.archiveSeedEvidence.archivedRelicId);
    expect(sourceSummary?.archivedRelicIdsAfter).toContain(result.archiveSeedEvidence.archivedRelicId);
    expect(seededSummary?.seedRelicIdAtEntry).toBe(result.archiveSeedEvidence.archivedRelicId);
    expect(seededDraft?.candidateIds[0]).toBe(result.archiveSeedEvidence.archivedRelicId);

    const baseSnapshot = structuredClone(result.baseState);
    const repeated = simulateSevenDungeonRunRelicRoute(result.baseState);
    expect(result.baseState).toEqual(baseSnapshot);
    expect(repeated).toEqual(result);
  });
});

describe('campaign equipment soul route simulation', () => {
  let cachedResult: ReturnType<typeof simulateSevenDungeonSoulRoute> | undefined;
  const getResult = (): ReturnType<typeof simulateSevenDungeonSoulRoute> => {
    cachedResult ??= simulateSevenDungeonSoulRoute();
    return cachedResult;
  };
  const expectedSkillIds = [
    'mist_fixed_point',
    'spirit_grounding',
    'gauntlet_breakbeat',
    'cloudstep_retrace',
    'rift_misalignment',
    'rift_seal'
  ];
  const expectedStations = DUNGEON_ORDER.map((dungeonId) => {
    const node = DUNGEONS[dungeonId].nodes.find((candidate) => candidate.soulRechargeId !== undefined);
    if (!node?.soulRechargeId) throw new Error(`Missing soul recharge station for ${dungeonId}.`);
    return [dungeonId, node.id, node.soulRechargeId];
  });

  it('freezes six equipped level-3 tempered skills and keeps the run snapshot after swapping gear', () => {
    const result = getResult();

    expect(result.sourceEquipment.map((source) => source.skillId)).toEqual(expectedSkillIds);
    expect(result.sourceEquipment.every((source) => source.level === 3)).toBe(true);
    expect(result.sourceEquipment.every((source) => source.temperRank === 1 || source.temperRank === 2)).toBe(true);
    expect(result.sourceEquipment.every((source) => source.equippedAtEntry)).toBe(true);
    expect(result.equipmentSnapshot).toMatchObject({
      dungeonId: 'demon_tower_1',
      frozenSkillIdsAtEntry: expectedSkillIds,
      readySkillIdsAtEntry: expectedSkillIds,
      chargesAtEntry: 2,
      equippedSkillCountAfterSwap: 0,
      snapshotStableAfterSwap: true
    });
  });

  it('clears every configured host and exercises each recharge station through real pending choices', () => {
    const result = getResult();

    expect(result.summaries.map((summary) => [summary.dungeonId, summary.hostNodeId, summary.rechargeId])).toEqual(
      expectedStations
    );
    expect(result.coveredRechargeIds).toEqual(expectedStations.map(([, , rechargeId]) => rechargeId));
    expect(new Set(result.coveredRechargeIds).size).toBe(DUNGEON_ORDER.length);

    for (const summary of result.summaries) {
      expect(summary.entryFrozenSkillIds, summary.dungeonId).toEqual(expectedSkillIds);
      expect(summary.entryReadySkillIds, summary.dungeonId).toEqual(expectedSkillIds);
      expect(summary.entryCharges, summary.dungeonId).toBe(2);
      expect(summary.preRechargeSkillUse).toMatchObject({
        skillId: 'cloudstep_retrace',
        succeeded: true,
        chargeDelta: -1,
        nodeClearedAfter: false
      });
      expect(summary.hostCleared, summary.dungeonId).toBe(true);
      expect(summary.clearedNodeIds, summary.dungeonId).toContain(summary.hostNodeId);
      expect(summary.uniqueClearedNodeCount, summary.dungeonId).toBe(summary.clearedNodeIds.length);
      expect(summary.duplicateNodeSettlementPrevented, summary.dungeonId).toBe(true);
      expect(summary.terminalReached, summary.dungeonId).toBe(true);
      expect(summary.permanentRouteLock, summary.dungeonId).toBe(false);
      expect(summary.routeEvidence.movements.every((movement) => movement.legal && !movement.blockReason)).toBe(true);

      expect(summary.recharge).toMatchObject({
        dungeonId: summary.dungeonId,
        hostNodeId: summary.hostNodeId,
        rechargeId: summary.rechargeId,
        availableBeforeHostClear: false,
        availableAfterHostClear: true,
        pendingAfterActivate: true,
        retreatAllowedWhilePending: true,
        cancelledWithoutUse: true,
        availableAfterCancel: true,
        reopenedAfterCancel: true,
        restoredSkillId: 'cloudstep_retrace',
        chargeDelta: 1,
        restoredSkillReady: true,
        rechargeMarkedUsed: true,
        duplicateUsePrevented: true
      });
      expect(summary.recharge.spentSkillIdsBefore).toContain('cloudstep_retrace');
      expect(summary.recharge.locks.map((lock) => lock.api)).toEqual(['move', 'portal', 'exit']);
      expect(summary.recharge.locks.every((lock) => lock.blockKind === 'soul_recharge_pending')).toBe(true);
      expect(summary.recharge.locks.every((lock) => lock.blocked && lock.resourcesUnchanged)).toBe(true);
    }

    expect(result.summaries.find((summary) => summary.dungeonId === 'demon_tower_1')?.restoredSkillReused).toBe(true);
  });

  it('records concrete trap, cleanse, intent-skip, and backstep effects without free combat actions', () => {
    const uses = getResult().skillUses;
    const mist = uses.find((use) => use.scenarioId === 'mist-natural-failure-pass');
    const cleanses = uses.filter((use) => use.skillId === 'spirit_grounding');
    const breakbeat = uses.find((use) => use.scenarioId === 'gauntlet-skip-danger-intent');
    const cloudstep = uses.find((use) => use.scenarioId === 'cloudstep-back-to-cleared-node');

    expect(mist).toMatchObject({
      dungeonId: 'demon_tower_1',
      nodeId: 'blood_rune_trap',
      skillId: 'mist_fixed_point',
      naturalTrapFailure: true,
      succeeded: true,
      chargeDelta: -1,
      nodeClearedAfter: true
    });
    expect(mist?.passDamage).toBeGreaterThan(0);
    expect(mist?.passDamage).toBeLessThan(24);

    expect(cleanses).toHaveLength(3);
    expect(new Set(cleanses.flatMap((use) => use.cleansableEffectKeysBefore))).toEqual(
      new Set(['rustPoisonStacks', 'mirrorSlowStacks', 'lastPlayerAction'])
    );
    for (const cleanse of cleanses) {
      expect(cleanse.cleansableEffectKeysAfter).toEqual([]);
      expect(cleanse).toMatchObject({
        succeeded: true,
        chargeDelta: -1,
        hpDelta: 0,
        focusDelta: 0,
        turnDelta: 0
      });
    }

    expect(breakbeat).toMatchObject({
      dungeonId: 'demon_tower_1',
      nodeId: 'fog_lesser_demon',
      skillId: 'gauntlet_breakbeat',
      intentId: 'fog-armor-rend',
      succeeded: true,
      chargeDelta: -1,
      hpDelta: 0,
      focusDelta: 0,
      turnDelta: 1
    });
    expect(cloudstep).toMatchObject({
      dungeonId: 'demon_tower_1',
      nodeId: 'blood_rune_trap',
      skillId: 'cloudstep_retrace',
      targetNodeId: 'fog_lesser_demon',
      succeeded: true,
      chargeDelta: -1,
      currentNodeIdAfter: 'fog_lesser_demon',
      nodeClearedAfter: false
    });
  });

  it('keeps stable and force portal costs while preserving the consumed soul snapshot across offset travel', () => {
    const result = getResult();
    const stable = result.portalOffsets.find((portal) => portal.portalChoice === 'stabilize');
    const force = result.portalOffsets.find((portal) => portal.portalChoice === 'force');

    expect(stable).toMatchObject({
      sourceDungeonId: 'demon_tower_1',
      sourceNodeId: 'cracked_portal',
      targetDungeonId: 'metro_abyss',
      defaultTargetNodeId: 'platform_arrival',
      stableItemId: 'gate_sigil',
      stableItemDelta: -1,
      hpDelta: 0,
      reachedOffsetTarget: true,
      soulStatePreservedAcrossPortal: true
    });
    expect(stable?.offsetTargetNodeId).not.toBe(stable?.defaultTargetNodeId);
    expect(force).toMatchObject({
      sourceDungeonId: 'demon_tower_1',
      sourceNodeId: 'cracked_portal',
      targetDungeonId: 'metro_abyss',
      defaultTargetNodeId: 'platform_arrival',
      stableItemDelta: 0,
      reachedOffsetTarget: true,
      soulStatePreservedAcrossPortal: true
    });
    expect(force?.hpDelta).toBeLessThan(0);
    expect(force?.offsetTargetNodeId).not.toBe(force?.defaultTargetNodeId);

    const portalUses = result.skillUses.filter((use) => use.skillId === 'rift_misalignment');
    expect(portalUses).toHaveLength(2);
    expect(portalUses.every((use) => use.succeeded && use.chargeDelta === -1)).toBe(true);
  });

  it('seals a real reward item without changing total payout or suppressing the relic draft', () => {
    const reward = getResult().rewardSeal;

    expect(reward).toMatchObject({
      dungeonId: 'demon_tower_1',
      nodeId: 'watch_post_cache',
      itemId: 'medicine_ash',
      rewardQuantity: 1,
      sealedRunLootDeltaComparedWithNormal: -1,
      sealedBankedInventoryDeltaComparedWithNormal: 1,
      totalInventoryDeltaComparedWithNormal: 0,
      rewardPointDeltaMatchesNormal: true,
      relicDraftId: 'demon_tower_1:echo:1',
      relicDraftPreserved: true,
      retainedAfterRetreat: true,
      retainedAfterFailure: true
    });
    expect(reward.inventoryAfterSeal - reward.inventoryBeforeSeal).toBe(1);
    expect(reward.inventoryAfterRetreat).toBe(reward.inventoryAfterSeal);
    expect(reward.inventoryAfterFailure).toBe(reward.inventoryAfterSeal);
    expect(reward.relicDraftCandidateIds.length).toBeGreaterThanOrEqual(2);
    expect(reward.normalRelicDraftCandidateIds).toEqual(reward.relicDraftCandidateIds);
  });

  it('rejects a third ready skill at zero charge, then restores and reuses a spent skill', () => {
    const gate = getResult().chargeGate;
    const rejected = getResult().skillUses.find((use) => use.scenarioId === 'charge-gate-third-rejected');

    expect(gate).toEqual({
      dungeonId: 'demon_tower_1',
      firstSkillId: 'gauntlet_breakbeat',
      secondSkillId: 'cloudstep_retrace',
      rejectedSkillId: 'mist_fixed_point',
      chargesAfterFirstUse: 1,
      chargesAfterSecondUse: 0,
      rejectedAvailability: 'no_charges',
      rejectedWithoutMutation: true,
      rechargeId: 'soul_node_demon_mist_watch',
      restoredSkillId: 'cloudstep_retrace',
      chargesAfterRecharge: 1,
      reusedAfterRecharge: true
    });
    expect(rejected).toMatchObject({
      skillId: 'mist_fixed_point',
      succeeded: false,
      chargesBefore: 0,
      chargesAfter: 0,
      chargeDelta: 0,
      readyBefore: true,
      readyAfter: true,
      gameplayStateUnchangedOnReject: true
    });
  });

  it('covers all six skill ids deterministically without mutating the supplied fixture', () => {
    const result = getResult();
    const snapshot = structuredClone(result.baseState);
    const repeated = simulateSevenDungeonSoulRoute(result.baseState);

    expect(result.coveredSkillIds).toEqual(expectedSkillIds);
    expect(result.baseState).toEqual(snapshot);
    expect(repeated).toEqual(result);
  });
});

describe('equipment tempering simulation', () => {
  it('uses real costs to reach rank II with positive score and power growth', () => {
    const summary = simulateEquipmentTempering();

    expect(summary.ranks).toEqual({
      initial: 0,
      afterRankOne: 1,
      afterAttunement: 1,
      final: 2
    });
    expect(summary.resourceDeltas).toEqual({
      rewardPoints: -1_280,
      lingyun: -2,
      items: {
        star_iron: -3,
        cycle_imprint: -1
      }
    });
    expect(summary.attunement).toBe('forge_overdrive');
    expect(summary.scoreDeltas.rankOne).toBeGreaterThan(0);
    expect(summary.scoreDeltas.attunement).toBeGreaterThan(0);
    expect(summary.scoreDeltas.rankTwo).toBeGreaterThan(0);
    expect(summary.scoreDeltas.total).toBeGreaterThan(0);
    expect(summary.powerDeltas.rankOne).toBeGreaterThan(0);
    expect(summary.powerDeltas.attunement).toBeGreaterThan(0);
    expect(summary.powerDeltas.rankTwo).toBeGreaterThan(0);
    expect(summary.powerDeltas.total).toBeGreaterThan(0);
    expect(summary.completed).toBe(true);
  });
});

describe('equipment commission real-route simulation', () => {
  let cachedResult: ReturnType<typeof simulateEquipmentCommissionRoute> | undefined;
  const getResult = (): ReturnType<typeof simulateEquipmentCommissionRoute> => {
    cachedResult ??= simulateEquipmentCommissionRoute();
    return cachedResult;
  };

  it('starts through the public API, pays the exact cost, and seals two eligible idle items', () => {
    const result = getResult();

    expect(result.equipmentIds).toEqual(['cloudstep_boots', 'cloudstep_charm']);
    expect(result.targetMaterialId).toBe('mirror_shell');
    expect(result.requiredDungeonCount).toBe(3);
    expect(result.materialReward).toBe(2);
    expect(result.start.quotedCost).toEqual({ rewardPoints: 300, lingyun: 1 });
    expect(result.start.paidCost).toEqual({ rewardPoints: 300, lingyun: 1 });
    expect(result.start.candidateEquipmentIdsBefore).toEqual(
      expect.arrayContaining([...result.equipmentIds])
    );
    expect(result.start.progressAfter).toEqual({
      active: true,
      completedDungeonIds: [],
      completedDungeonCount: 0
    });
    expect(result.start.equipmentBefore).toEqual([
      {
        equipmentId: 'cloudstep_boots',
        level: 3,
        attunement: 'mist_vanguard',
        temperRank: 2,
        sealed: false
      },
      {
        equipmentId: 'cloudstep_charm',
        level: 3,
        attunement: 'mist_veilguard',
        temperRank: 1,
        sealed: false
      }
    ]);
    expect(result.start.equipmentAfter).toEqual(
      result.start.equipmentBefore.map((equipment) => ({ ...equipment, sealed: true }))
    );
  });

  it('settles three distinct real boss-to-exit routes while a repeated exit adds no progress', () => {
    const result = getResult();
    const expectedDungeonIds = DUNGEON_ORDER.slice(0, 3);

    expect(result.distinctExits.map((exit) => exit.dungeonId)).toEqual(expectedDungeonIds);
    expect(result.distinctExits.map((exit) => exit.progressAfter.completedDungeonIds)).toEqual([
      ['demon_tower_1'],
      ['demon_tower_1', 'metro_abyss'],
      ['demon_tower_1', 'metro_abyss', 'starfall_mine']
    ]);
    expect(result.distinctExits.map((exit) => exit.settlement?.status)).toEqual([
      'advanced',
      'advanced',
      'completed'
    ]);

    for (const exit of result.distinctExits) {
      expect(exit.successful, exit.dungeonId).toBe(true);
      expect(exit.phaseAfter, exit.dungeonId).toBe('result');
      expect(exit.bossNodeCleared, exit.dungeonId).toBe(true);
      expect(exit.exitNodeCleared, exit.dungeonId).toBe(true);
      expect(exit.routeEvidence.movements.length, exit.dungeonId).toBeGreaterThan(0);
      expect(
        exit.routeEvidence.movements.every(
          (movement) => movement.legal && movement.blockReason === undefined
        ),
        exit.dungeonId
      ).toBe(true);
      expect(
        exit.routeEvidence.movements.some((movement) => movement.toNodeId === exit.bossNodeId),
        exit.dungeonId
      ).toBe(true);
      expect(
        exit.routeEvidence.movements.some((movement) => movement.toNodeId === exit.exitNodeId),
        exit.dungeonId
      ).toBe(true);
    }

    expect(result.repeatedExit).toMatchObject({
      kind: 'repeat',
      dungeonId: 'demon_tower_1',
      successful: true,
      bossNodeCleared: true,
      exitNodeCleared: true,
      settlement: undefined
    });
    expect(result.repeatedExit.progressBefore).toEqual({
      active: true,
      completedDungeonIds: ['demon_tower_1'],
      completedDungeonCount: 1
    });
    expect(result.repeatedExit.progressAfter).toEqual(result.repeatedExit.progressBefore);
  });

  it('keeps commission progress unchanged after real-combat retreat and explicit failure', () => {
    const result = getResult();

    for (const interruption of [result.retreat, result.failure]) {
      expect(interruption.dungeonId).toBe('metro_abyss');
      expect(interruption.phaseAfter).toBe('result');
      expect(interruption.dangerNodeCleared).toBe(true);
      expect(interruption.routeEvidence.movements.length).toBeGreaterThan(0);
      expect(interruption.progressBefore).toEqual({
        active: true,
        completedDungeonIds: ['demon_tower_1'],
        completedDungeonCount: 1
      });
      expect(interruption.progressAfter).toEqual(interruption.progressBefore);
      expect(interruption.settlement).toBeUndefined();
    }
  });

  it('completes on the third distinct exit, grants exactly two materials, and restores both items intact', () => {
    const result = getResult();
    const completedSettlement = result.distinctExits[2].settlement;
    const progression = (equipment: (typeof result.start.equipmentBefore)[number]) => ({
      equipmentId: equipment.equipmentId,
      level: equipment.level,
      attunement: equipment.attunement,
      temperRank: equipment.temperRank
    });

    expect(completedSettlement).toEqual({
      status: 'completed',
      dungeonId: 'starfall_mine',
      equipmentIds: result.equipmentIds,
      targetMaterialId: 'mirror_shell',
      completedDungeonIds: ['demon_tower_1', 'metro_abyss', 'starfall_mine'],
      rewardAmount: 2
    });
    expect(result.completion.materialCountAfterFinalRoute).toBe(
      result.completion.materialCountBeforeFinalRoute + 2
    );
    expect(result.completion.materialDelta).toBe(2);
    expect(result.completion.progressAfter).toEqual({
      active: false,
      completedDungeonIds: ['demon_tower_1', 'metro_abyss', 'starfall_mine'],
      completedDungeonCount: 3
    });
    expect(result.finalState.equipmentCommission).toBeUndefined();
    expect(result.completion.equipmentAfter.every((equipment) => !equipment.sealed)).toBe(true);
    expect(result.completion.equipmentAfter.map(progression)).toEqual(
      result.start.equipmentBefore.map(progression)
    );
    expect(result.completion.progressionPreserved).toBe(true);
  });
});

describe('campaign field-survey simulation', () => {
  it('exercises every real host and option through the frozen field-survey API', () => {
    const result = simulateSevenDungeonFieldSurveyRoute();
    const fixtureSnapshot = structuredClone(result.fixture);
    const repeated = simulateSevenDungeonFieldSurveyRoute();

    const expectedOptionCount = FIELD_SURVEY_CATALOG.reduce(
      (count, survey) => count + survey.options.length,
      0
    );
    expect(result.resolutions).toHaveLength(expectedOptionCount);
    expect(result.coveredSurveyIds).toEqual(FIELD_SURVEY_CATALOG.map((survey) => survey.id));
    expect(result.coveredOptionIds).toHaveLength(expectedOptionCount);
    expect(result.coveredBranches).toEqual([
      'mist_vanguard',
      'forge_overdrive',
      'rift_resonance',
      'rift_anchor',
      'forge_channeling',
      'mist_veilguard',
      'chronal_acceleration',
      'chronal_stasis'
    ]);
    expect(result.fixture.expectedFrozenSources).toEqual([
      { equipmentId: 'armor_piercing_sword', attunementId: 'forge_overdrive' },
      { equipmentId: 'guardian_gauntlets', attunementId: 'forge_channeling' },
      { equipmentId: 'mist_hood', attunementId: 'mist_vanguard' },
      { equipmentId: 'spirit_robe', attunementId: 'mist_veilguard' },
      { equipmentId: 'carapace_harness', attunementId: 'rift_anchor' },
      { equipmentId: 'rift_charm', attunementId: 'rift_resonance' },
      { equipmentId: 'chronal_edge', attunementId: 'chronal_acceleration' },
      { equipmentId: 'chronal_aegis', attunementId: 'chronal_stasis' }
    ]);
    expect(result.fixture.state.player).toMatchObject({ hp: 160, maxHp: 160 });
    expect(result.fixture.state.inventory.combat_reel).toBe(1);
    expect(result.fixture.state.preparedItemIds).toEqual(['echo_coin', 'dispel_talisman', 'gate_sigil']);
    expect(createSevenDungeonFieldSurveyFixture()).toEqual(fixtureSnapshot);
    expect(repeated).toEqual(result);

    expect(
      result.resolutions.map((resolution) => ({
        optionId: resolution.optionId,
        rewardPointDelta: resolution.rewardPointDelta,
        lingyunDelta: resolution.lingyunDelta,
        hpDelta: resolution.hpDelta,
        itemDelta: resolution.itemDelta,
        costDelta: resolution.costDelta
      }))
    ).toEqual([
      { optionId: 'mist_vanguard_fast_search', rewardPointDelta: 66, lingyunDelta: 0, hpDelta: 0, itemDelta: { focus_incense: 1, demon_bone: 1 }, costDelta: {} },
      { optionId: 'forge_overdrive_crush_bone', rewardPointDelta: 118, lingyunDelta: 0, hpDelta: -19, itemDelta: { demon_bone: 2 }, costDelta: {} },
      { optionId: 'rift_resonance_mirror_recast', rewardPointDelta: 90, lingyunDelta: 0, hpDelta: -16, itemDelta: { mirror_shell: 2 }, costDelta: {} },
      { optionId: 'rift_anchor_lost_property', rewardPointDelta: 48, lingyunDelta: 0, hpDelta: 3, itemDelta: { gate_sigil: 1, echo_coin: -1, mirror_shell: 1 }, costDelta: { echo_coin: -1 } },
      { optionId: 'forge_overdrive_overload_vein', rewardPointDelta: 169, lingyunDelta: 0, hpDelta: -28, itemDelta: { cracked_core: 2 }, costDelta: {} },
      { optionId: 'forge_channeling_heat_refine', rewardPointDelta: 91, lingyunDelta: 3, hpDelta: 0, itemDelta: {}, costDelta: {} },
      { optionId: 'mist_veilguard_isolation_pack', rewardPointDelta: 80, lingyunDelta: 0, hpDelta: 0, itemDelta: { healing_pill: 1, medicine_ash: 1 }, costDelta: {} },
      { optionId: 'rift_anchor_ward_anchor', rewardPointDelta: 76, lingyunDelta: 0, hpDelta: 0, itemDelta: { healing_pill: 1, dispel_talisman: -1, gate_sigil: 1, medicine_ash: 2 }, costDelta: { dispel_talisman: -1 } },
      { optionId: 'forge_overdrive_core_break', rewardPointDelta: 140, lingyunDelta: 0, hpDelta: -32, itemDelta: { cracked_core: 2 }, costDelta: {} },
      { optionId: 'mist_vanguard_odds_quick_take', rewardPointDelta: 75, lingyunDelta: 0, hpDelta: 0, itemDelta: { armor_patch: 1, focus_incense: 1, cracked_core: 1 }, costDelta: {} },
      { optionId: 'forge_channeling_fragment_infusion', rewardPointDelta: 98, lingyunDelta: 2, hpDelta: 0, itemDelta: { method_page: 1 }, costDelta: {} },
      { optionId: 'rift_resonance_void_recast', rewardPointDelta: 217, lingyunDelta: 0, hpDelta: -16, itemDelta: { rift_dust: 2 }, costDelta: {} },
      { optionId: 'mist_veilguard_final_guard', rewardPointDelta: 144, lingyunDelta: 0, hpDelta: 6, itemDelta: { star_iron: 1, cracked_core: 1 }, costDelta: {} },
      { optionId: 'forge_channeling_core_calculation', rewardPointDelta: 110, lingyunDelta: 5, hpDelta: 0, itemDelta: {}, costDelta: {} },
      { optionId: 'chronal_acceleration_future_refraction', rewardPointDelta: 289, lingyunDelta: 0, hpDelta: -35, itemDelta: { chronal_glass: 2 }, costDelta: {} },
      { optionId: 'chronal_stasis_past_calibration', rewardPointDelta: 136, lingyunDelta: 4, hpDelta: 6, itemDelta: { gate_sigil: -1, chronal_glass: 1 }, costDelta: { gate_sigil: -1 } },
      { optionId: 'chronal_acceleration_causal_projection', rewardPointDelta: 360, lingyunDelta: 0, hpDelta: -38, itemDelta: { causal_seal: 2 }, costDelta: {} },
      { optionId: 'rift_anchor_evidence_recovery', rewardPointDelta: 170, lingyunDelta: 4, hpDelta: 12, itemDelta: { causal_seal: 1 }, costDelta: {} },
      { optionId: 'chronal_acceleration_entropy_forecast', rewardPointDelta: 437, lingyunDelta: 0, hpDelta: -41, itemDelta: { entropy_crystal: 2 }, costDelta: {} },
      { optionId: 'forge_channeling_ballast_recovery', rewardPointDelta: 207, lingyunDelta: 5, hpDelta: 32, itemDelta: { entropy_crystal: 1 }, costDelta: {} },
      { optionId: 'rift_resonance_parallax_refraction', rewardPointDelta: 520, lingyunDelta: 0, hpDelta: -44, itemDelta: { phase_glass: 2 }, costDelta: {} },
      { optionId: 'chronal_stasis_mirror_alignment', rewardPointDelta: 247, lingyunDelta: 6, hpDelta: 24, itemDelta: { gate_sigil: -1, phase_glass: 1 }, costDelta: { gate_sigil: -1 } },
      { optionId: 'chronal_stasis_restore_deleted_line', rewardPointDelta: 300, lingyunDelta: 7, hpDelta: 53, itemDelta: { gate_sigil: -1, redaction_ink: 1 }, costDelta: { gate_sigil: -1 } },
      { optionId: 'rift_resonance_extract_redaction_ink', rewardPointDelta: 630, lingyunDelta: 0, hpDelta: -48, itemDelta: { redaction_ink: 3 }, costDelta: {} },
      { optionId: 'chronal_stasis_verify_hammer_chain', rewardPointDelta: 336, lingyunDelta: 8, hpDelta: 0, itemDelta: { legacy_scrip: -1 }, costDelta: { legacy_scrip: -1 } },
      { optionId: 'forge_resonance_melt_counterfeit_lot', rewardPointDelta: 704, lingyunDelta: 0, hpDelta: -51, itemDelta: {}, costDelta: {} },
      { optionId: 'forge_overdrive_helix_source_sample', rewardPointDelta: 828, lingyunDelta: 0, hpDelta: -54, itemDelta: { genesis_serum: 3 }, costDelta: {} },
      { optionId: 'mist_veilguard_symbiote_archive', rewardPointDelta: 414, lingyunDelta: 9, hpDelta: 0, itemDelta: { genesis_serum: 1, method_page: 1 }, costDelta: {} },
      { optionId: 'rift_anchor_carapace_safe_sample', rewardPointDelta: 396, lingyunDelta: 0, hpDelta: 0, itemDelta: { rift_dust: 1 }, costDelta: { genesis_serum: -1 } },
      { optionId: 'chronal_stasis_rebirth_snapshot', rewardPointDelta: 388, lingyunDelta: 5, hpDelta: 0, itemDelta: { chronal_glass: 1 }, costDelta: { genesis_serum: -1 } },
      { optionId: 'forge_overdrive_hushblade_frequency_cut', rewardPointDelta: 936, lingyunDelta: 0, hpDelta: -57, itemDelta: { silence_core: 3 }, costDelta: {} },
      { optionId: 'mist_veilguard_dead_air_listening', rewardPointDelta: 475, lingyunDelta: 10, hpDelta: 0, itemDelta: { silence_core: 1, method_page: 1 }, costDelta: {} },
      { optionId: 'rift_anchor_anechoic_pressure_sample', rewardPointDelta: 460, lingyunDelta: 0, hpDelta: 0, itemDelta: { rift_dust: 1 }, costDelta: { silence_core: -1 } },
      { optionId: 'chronal_stasis_last_channel_snapshot', rewardPointDelta: 452, lingyunDelta: 6, hpDelta: 0, itemDelta: { chronal_glass: 1 }, costDelta: { silence_core: -1 } },
      { optionId: 'forge_overdrive_rescue_carbine_breach', rewardPointDelta: 1075, lingyunDelta: 0, hpDelta: -60, itemDelta: { rescue_badge: 3 }, costDelta: {} },
      { optionId: 'mist_veilguard_triage_roster', rewardPointDelta: 550, lingyunDelta: 11, hpDelta: 0, itemDelta: { rescue_badge: 1, method_page: 1 }, costDelta: {} },
      { optionId: 'rift_anchor_evacuation_plate_recovery', rewardPointDelta: 533, lingyunDelta: 0, hpDelta: 0, itemDelta: { rift_dust: 1 }, costDelta: { rescue_badge: -1 } },
      { optionId: 'chronal_stasis_blackbox_snapshot', rewardPointDelta: 524, lingyunDelta: 7, hpDelta: 0, itemDelta: { chronal_glass: 1 }, costDelta: { rescue_badge: -1 } },
      { optionId: 'forge_overdrive_cross_examiner_chain', rewardPointDelta: 1222, lingyunDelta: 0, hpDelta: -64, itemDelta: { truth_fragment: 3 }, costDelta: {} },
      { optionId: 'mist_veilguard_forensic_review', rewardPointDelta: 629, lingyunDelta: 12, hpDelta: 0, itemDelta: { truth_fragment: 1, method_page: 1 }, costDelta: {} },
      { optionId: 'rift_anchor_custody_bank_sample', rewardPointDelta: 611, lingyunDelta: 0, hpDelta: 0, itemDelta: { rift_dust: 1 }, costDelta: { truth_fragment: -1 } },
      { optionId: 'chronal_stasis_appeal_snapshot', rewardPointDelta: 601, lingyunDelta: 8, hpDelta: 0, itemDelta: { chronal_glass: 1 }, costDelta: { truth_fragment: -1 } },
      { optionId: 'forge_overdrive_frame_engraver_cut', rewardPointDelta: 1377, lingyunDelta: 0, hpDelta: -67, itemDelta: { combat_reel: 3 }, costDelta: {} },
      { optionId: 'mist_veilguard_cue_visor_review', rewardPointDelta: 714, lingyunDelta: 13, hpDelta: 0, itemDelta: { combat_reel: 1, method_page: 1 }, costDelta: {} },
      { optionId: 'rift_anchor_buffer_plate_sample', rewardPointDelta: 693, lingyunDelta: 0, hpDelta: 0, itemDelta: { rift_dust: 1 }, costDelta: { combat_reel: -1 } },
      { optionId: 'chronal_stasis_thaw_metronome_snapshot', rewardPointDelta: 683, lingyunDelta: 9, hpDelta: 0, itemDelta: { chronal_glass: 1 }, costDelta: { combat_reel: -1 } },
      { optionId: 'forge_overdrive_blindline_cutter_test', rewardPointDelta: 1540, lingyunDelta: 2, hpDelta: -70, itemDelta: { observation_shard: 3, phase_glass: 1 }, costDelta: {} },
      { optionId: 'mist_veilguard_predictive_visor_audit', rewardPointDelta: 803, lingyunDelta: 16, hpDelta: 0, itemDelta: { observation_shard: 1, phase_glass: 1, method_page: 1 }, costDelta: {} },
      { optionId: 'rift_anchor_matte_prism_refraction', rewardPointDelta: 781, lingyunDelta: 12, hpDelta: 0, itemDelta: { rift_dust: 1, chronal_glass: 1, phase_glass: 1 }, costDelta: { observation_shard: -1 } }
    ]);
    expect(
      result.resolutions.every(
        (resolution) =>
          resolution.routeLegal &&
          resolution.routeEvidence.movements.length > 0 &&
          resolution.routeEvidence.movements.every((movement) => movement.legal && movement.blockReason === undefined) &&
          resolution.sourceEquipmentIds.length === 1 &&
          resolution.nodeCleared &&
          resolution.resolutionRecorded
      )
    ).toBe(true);
    expect(result.guards).toEqual({
      missingCostRejected: true,
      wrongOptionRejected: true,
      unfrozenBranchRejected: true,
      repeatedResolutionRejected: true,
      legacyDisabled: true,
      malformedDisabled: true,
      legacyNormalCollectWorks: true,
      malformedNormalCollectWorks: true,
      portalCrossedToTargetDungeon: true,
      portalPreservesFrozenSources: true,
      portalPreservesResolution: true,
      retreatRetainedRewardPoints: 113,
      retreatLostRewardPoints: 113,
      explicitFailureRetainedRewardPoints: 45,
      explicitFailureLostRewardPoints: 181,
      lowHpDamageTriggeredFailure: true,
      lowHpDamageTaken: 1,
      lowHpFailureRetainedRewardPoints: 196,
      lowHpFailureLostRewardPoints: 784
    });
  });
});

describe('campaign equipment-hunt simulation', () => {
  let cachedResult: ReturnType<typeof simulateSevenDungeonEquipmentHuntRoute> | undefined;
  const getResult = (): ReturnType<typeof simulateSevenDungeonEquipmentHuntRoute> => {
    cachedResult ??= simulateSevenDungeonEquipmentHuntRoute();
    return cachedResult;
  };

  it('settles one alternating real hunt in every dungeon without mutating the fixture', () => {
    const result = getResult();
    const fixtureSnapshot = structuredClone(result.fixture);

    expect(result.coverage).toEqual({
      dungeonIds: DUNGEON_ORDER,
      dungeonCount: DUNGEON_ORDER.length,
      definedClueCount: DUNGEON_ORDER.length * 2,
      validatedClueRouteCount: DUNGEON_ORDER.length * 2,
      settledHuntCount: DUNGEON_ORDER.length,
      usedClueIndexes: [0, 1],
      usedClueNodeIds: DUNGEON_ORDER.map(
        (dungeonId, index) => EQUIPMENT_HUNT_DEFINITIONS[dungeonId].clueNodeIds[index % 2]
      )
    });
    expect(Object.keys(result.targets)).toEqual(DUNGEON_ORDER);
    expect(result.fixture.targets).toEqual(result.targets);
    expect(
      DUNGEON_ORDER.every((dungeonId) =>
        DUNGEON_EQUIPMENT_POOLS[dungeonId].some(
          (equipmentId) => equipmentId === result.targets[dungeonId]
        ) &&
        !result.fixture.state.ownedEquipment.includes(result.targets[dungeonId])
      )
    ).toBe(true);
    expect(createSevenDungeonEquipmentHuntFixture()).toEqual(fixtureSnapshot);
  });

  it('proves every reward clue reaches a first eligible elite before any offer', () => {
    const result = getResult();
    const expectedClueNodeIds = DUNGEON_ORDER.flatMap(
      (dungeonId) => [...EQUIPMENT_HUNT_DEFINITIONS[dungeonId].clueNodeIds]
    );

    expect(result.clueRoutes).toHaveLength(expectedClueNodeIds.length);
    expect(result.clueRoutes.map((route) => route.clueNodeId)).toEqual(expectedClueNodeIds);
    for (const route of result.clueRoutes) {
      const dungeon = DUNGEONS[route.dungeonId];
      const host = dungeon.nodes.find((node) => node.id === route.clueNodeId);
      const elite = dungeon.nodes.find((node) => node.id === route.eliteNodeId);

      expect(route.startNodeId, route.clueNodeId).toBe(dungeon.grid.startNodeId);
      expect(route.rewardHostExists, route.clueNodeId).toBe(true);
      expect(route.clueDefinitionMatchesHost, route.clueNodeId).toBe(true);
      expect(host?.type, route.clueNodeId).toBe('reward');
      expect(host?.reward, route.clueNodeId).toBeDefined();
      expect(host?.equipmentHuntClueId, route.clueNodeId).toBe(
        EQUIPMENT_HUNT_DEFINITIONS[route.dungeonId].id
      );
      expect(route.clueCollected, route.clueNodeId).toBe(true);
      expect(route.qualifiedBeforeElite, route.clueNodeId).toBe(true);
      expect(route.lootOffersBeforeElite, route.clueNodeId).toBe(0);
      expect(route.eliteMatchesDungeonDefinition, route.clueNodeId).toBe(true);
      expect(elite?.monsterId, route.clueNodeId).toBe(DUNGEON_ELITE_MONSTERS[route.dungeonId]);
      expect(route.startToClueMovementCount, route.clueNodeId).toBeGreaterThan(0);
      expect(route.clueToEliteMovementCount, route.clueNodeId).toBeGreaterThan(0);
      expect(
        route.startToClueMovementCount + route.clueToEliteMovementCount,
        route.clueNodeId
      ).toBe(route.routeEvidence.movements.length);
      expect(
        route.routeEvidence.movements.every(
          (movement) => movement.legal && movement.blockReason === undefined
        ),
        route.clueNodeId
      ).toBe(true);
      expect(route.clueRewardPointsGained, route.clueNodeId).toBe(host?.reward?.rewardPoints ?? 0);
      expect(route.clueLingyunGained, route.clueNodeId).toBe(host?.reward?.lingyun ?? 0);
      expect(route.clueItemDelta, route.clueNodeId).toEqual(host?.reward?.items ?? {});
      expect(route.offer.guaranteedEquipmentId, route.clueNodeId).toBe(route.targetEquipmentId);
      expect(route.offer.equipmentIds[0], route.clueNodeId).toBe(route.targetEquipmentId);
      expect(route.offer.targetFirst, route.clueNodeId).toBe(true);
      expect(route.offer.targetOccurrenceCount, route.clueNodeId).toBe(1);
      expect(route.offer.lootOffersMade, route.clueNodeId).toBe(1);
      expect(route.focusTrace.length, route.clueNodeId).toBeGreaterThan(0);
    }

    const gatedArenaRoute = result.clueRoutes.find(
      (route) => route.clueNodeId === 'side_bench_supplies'
    );
    expect(
      gatedArenaRoute?.focusTrace.find((trace) => trace.nodeId === 'ember_pit_duelist')?.action
    ).toBe('art');
  });

  it('keeps the chosen target in the run bag until boss and exit clear, then shelves it at level one', () => {
    const result = getResult();

    expect(result.summaries.map((summary) => summary.dungeonId)).toEqual(DUNGEON_ORDER);
    for (const summary of result.summaries) {
      expect(summary.targetOwnedBeforeSelection, summary.dungeonId).toBe(false);
      expect(summary.targetOwnedAfterSelection, summary.dungeonId).toBe(false);
      expect(summary.targetOwnedBeforeExit, summary.dungeonId).toBe(false);
      expect(summary.targetLevelBeforeExit, summary.dungeonId).toBeUndefined();
      expect(summary.targetInLootBagBeforeExit, summary.dungeonId).toBe(true);
      expect(summary.lootBagBeforeExit.equipmentIds, summary.dungeonId).toEqual([
        summary.targetEquipmentId
      ]);
      expect(summary.lootBagBeforeExit.rewardPoints, summary.dungeonId).toBeGreaterThan(0);
      expect(summary.bossClearedBeforeExit, summary.dungeonId).toBe(true);
      expect(summary.retainedSettlement, summary.dungeonId).toEqual(summary.lootBagBeforeExit);
      expect(summary.lostSettlement, summary.dungeonId).toEqual({
        rewardPoints: 0,
        lingyun: 0,
        items: {},
        equipmentIds: []
      });
      expect(summary.lootBagAfterExit, summary.dungeonId).toEqual({
        rewardPoints: 0,
        lingyun: 0,
        items: {},
        equipmentIds: []
      });
      expect(summary.targetOwnedAfterExit, summary.dungeonId).toBe(true);
      expect(summary.targetLevelAfterExit, summary.dungeonId).toBe(1);
      expect(summary.exitCleared, summary.dungeonId).toBe(true);
      expect(summary.settled, summary.dungeonId).toBe(true);
      expect(
        summary.routeEvidence.movements.some((movement) => movement.toNodeId === summary.bossNodeId),
        summary.dungeonId
      ).toBe(true);
      expect(
        summary.routeEvidence.movements.some((movement) => movement.toNodeId === summary.exitNodeId),
        summary.dungeonId
      ).toBe(true);
    }
  });

  it('returns exact prep, ordering, crossing, collection, loss, and mutation guards', () => {
    expect(getResult().guards).toEqual({
      ordinaryOfferMatchesRealApi: true,
      ordinaryOfferHasNoGuarantee: true,
      eliteBeforeClueHasNoGuarantee: true,
      clueAfterEliteDoesNotBackfill: true,
      portalCrossingInvalidatesHunt: true,
      uncollectedClueDoesNotQualify: true,
      retreatLosesSelectedTarget: true,
      failureLosesSelectedTarget: true,
      fixtureUnchanged: true
    });
  });
});

describe('campaign equipment-memory-hunt simulation', () => {
  let cachedResult: ReturnType<typeof simulateEightDungeonEquipmentMemoryHunts> | undefined;
  const getResult = (): ReturnType<typeof simulateEightDungeonEquipmentMemoryHunts> => {
    cachedResult ??= simulateEightDungeonEquipmentMemoryHunts();
    return cachedResult;
  };

  it('builds one legal mature target and banks all memories in both signal orders', () => {
    const result = getResult();

    expect(result.baseline).toMatchObject({
      targetEquipmentId: 'guardian_plate',
      owned: true,
      equipped: true,
      level: result.baseline.maxLevel,
      attunementId: 'forge_overdrive',
      temperRank: 2,
      sealed: false,
      completedDungeonIds: DUNGEON_ORDER,
      eligibleDungeonIds: DUNGEON_ORDER
    });
    expect(DUNGEON_ORDER).toHaveLength(19);
    expect(EQUIPMENT_MEMORY_EQUIPMENT_CATALOG).toHaveLength(58);
    expect(EQUIPMENT_MEMORY_CATALOG).toHaveLength(19);
    expect(EQUIPMENT_MEMORY_EQUIPMENT_CATALOG.length * EQUIPMENT_MEMORY_CATALOG.length).toBe(1102);
    expect(result.coverage).toEqual({
      dungeonIds: DUNGEON_ORDER,
      dungeonCount: DUNGEON_ORDER.length,
      bankedCount: DUNGEON_ORDER.length,
      signalOrders: ['event-first', 'clear-first'],
      finalUnlockedMemoryIds: EQUIPMENT_MEMORY_CATALOG.map((memory) => memory.id),
      finalActiveMemoryId: EQUIPMENT_MEMORY_CATALOG.at(-1)?.id,
      deterministic: true
    });

    for (const [index, summary] of result.summaries.entries()) {
      const definition = EQUIPMENT_MEMORY_CATALOG[index];
      expect(summary.dungeonId).toBe(definition.dungeonId);
      expect(summary.memoryId).toBe(definition.id);
      expect(summary.eventId).toBe(definition.eventId);
      expect(summary.nodeId).toBe(definition.nodeId);
      expect(summary.signalOrder).toBe(
        summary.dungeonId === 'dream_archive' || index % 2 === 0 ? 'event-first' : 'clear-first'
      );
      expect(summary.eventOptionId.length).toBeGreaterThan(0);
      expect(summary.statusAfterFirstSignal).toBe('active');
      expect(summary.statusBeforeExit).toBe('secured');
      expect(summary.statusAfterExit).toBe('banked');
      expect(summary.nodeCleared).toBe(true);
      expect(summary.eventSucceeded).toBe(true);
      expect(summary.settlement).toMatchObject({
        granted: true,
        state: {
          equipmentId: 'guardian_plate',
          memoryId: definition.id,
          status: 'banked'
        }
      });
      expect(summary.unlockedMemoryIdsAfter).toEqual(
        EQUIPMENT_MEMORY_CATALOG.slice(0, index + 1).map((memory) => memory.id)
      );
      expect(summary.activeMemoryIdAfter).toBe(definition.id);
      expect(summary.bossNodeCleared).toBe(true);
      expect(summary.exitNodeCleared).toBe(true);
      expect(summary.economy.matchesControl).toBe(true);
      expect(summary.economy.hunt).toEqual(summary.economy.control);
      expect(summary.deterministicRoute).toBe(true);
      expect(summary.routeEvidence.movements.length).toBeGreaterThan(0);
      expect(summary.routeEvidence.movements.every((movement) => movement.legal)).toBe(true);
    }
  });

  it('returns exact event failure, incomplete exit, portal, conflict, and contract controls', () => {
    const guards = getResult().guards;

    expect(guards.eventFailure).toMatchObject({
      dungeonId: 'demon_tower_1',
      status: 'failed',
      reason: 'event_failure',
      permanentAfterNodeClear: true
    });
    expect(guards.eventFailure.eventOptionId.length).toBeGreaterThan(0);
    expect(guards.incompleteExit).toEqual({
      dungeonId: 'metro_abyss',
      nodeCleared: true,
      eventSucceeded: false,
      status: 'failed',
      reason: 'incomplete_exit',
      granted: false
    });
    expect(guards.crossDungeonPortal).toEqual({
      sourceDungeonId: 'starfall_mine',
      targetDungeonId: 'rust_hospital',
      status: 'lost',
      reason: 'cross_dungeon',
      granted: false
    });
    expect(guards.preparationConflict).toEqual({
      ordinaryBlocksMemory: true,
      memoryBlocksOrdinary: true,
      issueCode: 'equipment_hunt_conflict'
    });
    expect(guards.routeContractParallel).toMatchObject({
      dungeonId: 'rust_hospital',
      memoryHuntActive: true,
      routeContractActive: true
    });
    expect(guards.routeContractParallel.contractId.length).toBeGreaterThan(0);
  });

  it('covers overflow, one nonlethal restore, once-per-combat, mismatch, and non-stacking', () => {
    const combat = getResult().guards.combat;

    expect(combat.regularOverflow).toMatchObject({
      dungeonId: 'temporal_observatory',
      beforeFocus: 3,
      afterFocus: 3,
      matchingEquipmentIds: ['guardian_plate'],
      overflowStoredBefore: false,
      overflowStoredAfter: true,
      restoredBefore: false,
      restoredAfter: false,
      combatContinued: true
    });
    expect(combat.recommendedOverflow).toMatchObject({
      afterFocus: 3,
      matchingEquipmentIds: ['guardian_plate'],
      overflowStoredBefore: false,
      overflowStoredAfter: true,
      restoredBefore: false,
      restoredAfter: false,
      combatContinued: true
    });
    expect(DUNGEON_ORDER).toContain(combat.recommendedOverflow.dungeonId);
    expect(combat.recommendedOverflow.beforeFocus).toBeGreaterThanOrEqual(2);
    expect(combat.nonLethalWeaponSkillRestore).toMatchObject({
      dungeonId: 'temporal_observatory',
      action: 'weapon_skill',
      afterFocus: 1,
      matchingEquipmentIds: ['guardian_plate'],
      overflowStoredAfter: false,
      restoredAfter: true,
      combatContinued: true
    });
    expect(combat.oncePerCombat).toEqual({
      secondOverflowStored: false,
      restoredStillMarked: true
    });
    expect(combat.nonMatching).toEqual({
      dungeonId: 'demon_tower_1',
      matchingEquipmentIds: [],
      memoryEnabled: false,
      focusAfterWeaponSkill: 0,
      restored: false
    });
    expect(combat.multipleMatching).toEqual({
      dungeonId: 'temporal_observatory',
      matchingEquipmentIds: ['guardian_plate', 'guardian_gauntlets'],
      overflowStored: true,
      focusAfterWeaponSkill: 1,
      restored: true
    });
  });

  it('exposes a stable structured projection without changing the balance report APIs', () => {
    const result = getResult();
    const project = (simulation: ReturnType<typeof simulateEightDungeonEquipmentMemoryHunts>) =>
      simulation.summaries.map((summary) => ({
      dungeonId: summary.dungeonId,
      memoryId: summary.memoryId,
      signalOrder: summary.signalOrder,
      eventOptionId: summary.eventOptionId,
      movementIds: summary.routeEvidence.movements.map((movement) => movement.toNodeId),
      economyMatches: summary.economy.matchesControl
      }));
    expect(project(simulateEightDungeonEquipmentMemoryHunts())).toEqual(project(result));
    expect(project(result)).toEqual(EQUIPMENT_MEMORY_CATALOG.map((definition, index) => expect.objectContaining({
      dungeonId: definition.dungeonId,
      memoryId: definition.id,
      signalOrder: definition.dungeonId === 'dream_archive' || index % 2 === 0
        ? 'event-first'
        : 'clear-first',
      eventOptionId: expect.any(String),
      movementIds: expect.any(Array),
      economyMatches: true
    })));
    expect(simulateCampaignBalance()).toHaveProperty('verdict');
    expect(analyzeCampaignBalance({ initialState: createInitialState() })).toHaveProperty('verdict');
  });
});

describe('campaign run pressure simulation', () => {
  let cachedResult: ReturnType<typeof simulateSevenDungeonPressureRoute> | undefined;
  const getResult = (): ReturnType<typeof simulateSevenDungeonPressureRoute> => {
    cachedResult ??= simulateSevenDungeonPressureRoute();
    return cachedResult;
  };

  it('locks pressure tiers to 0-5, 6-11, and 12+ first clears', () => {
    expect([0, 5].map((clearedNodeCount) =>
      getRunPressureStatus({ rulesVersion: 1, clearedNodeCount }).tier
    )).toEqual(['stable', 'stable']);
    expect([6, 11].map((clearedNodeCount) =>
      getRunPressureStatus({ rulesVersion: 1, clearedNodeCount }).tier
    )).toEqual(['hunted', 'hunted']);
    expect([12, 99].map((clearedNodeCount) =>
      getRunPressureStatus({ rulesVersion: 1, clearedNodeCount }).tier
    )).toEqual(['breach', 'breach']);
  });

  it('completes a boss-to-exit fast route and a real sweep route in every dungeon', () => {
    const result = getResult();

    expect(result.summaries.map((summary) => summary.dungeonId)).toEqual(DUNGEON_ORDER);
    for (const summary of result.summaries) {
      const dungeon = DUNGEONS[summary.dungeonId];
      const closedAuctionVaultIds = summary.dungeonId === 'legacy_auction_court'
        ? new Set(['guard_claim_vault', 'art_claim_vault'])
        : new Set<string>();
      const excludedGenesisVaultIds = summary.dungeonId === 'genesis_vault'
        ? new Set(['force_gene_vault', 'art_gene_vault', 'guard_gene_vault', 'renewal_gene_vault'])
        : new Set<string>();
      const excludedBroadcastBranchIds = summary.dungeonId === 'silent_broadcast_tower'
        ? new Set(['silent_archive', 'resonance_vault'])
        : new Set<string>();
      const excludedShelterBranchIds = summary.dungeonId === 'lost_shelter'
        ? new Set(['evacuation_cache', 'desperate_armory', 'balanced_medbay'])
        : new Set<string>();
      const excludedFalseTestimonyBranchIds = summary.dungeonId === 'false_testimony_court'
        ? new Set([
            'truth_archive',
            'swift_judgment_armory',
            'false_verdict_vault',
            'appeal_desk',
            'voice_evidence',
            'timeline_evidence',
            'residue_evidence'
          ])
        : new Set<string>();
      const excludedCombatReplayBranchIds = summary.dungeonId === 'combat_replay_stage'
        ? new Set(['afterbeat_route', 'burst_route'])
        : new Set<string>();
      const excludedPanopticonBranchIds = summary.dungeonId === 'panopticon_city'
        ? new Set(['decoy_route', 'refraction_route'])
        : new Set<string>();
      const economicNodeIds = dungeon.nodes
        .filter((node) => node.type === 'monster' || node.type === 'reward')
        .filter((node) => !closedAuctionVaultIds.has(node.id))
        .filter((node) => !excludedGenesisVaultIds.has(node.id))
        .filter((node) => !excludedBroadcastBranchIds.has(node.id))
        .filter((node) => !excludedShelterBranchIds.has(node.id))
        .filter((node) => !excludedFalseTestimonyBranchIds.has(node.id))
        .filter((node) => !excludedCombatReplayBranchIds.has(node.id))
        .filter((node) => !excludedPanopticonBranchIds.has(node.id))
        .map((node) => node.id);

      expect(summary.fastRoute.plannedTargetNodeIds, summary.dungeonId).toEqual([
        ...(summary.dungeonId === 'entropy_ark'
          ? [
              'bow_heading_console',
              'dissipation_navigator_alpha',
              'midship_heading_console',
              'starboard_relic_hold',
              'stern_heading_console',
              'ark_manifest'
            ]
          : []),
        ...(summary.dungeonId === 'silent_broadcast_tower'
          ? ['north_relay_console', 'central_relay_console', 'south_relay_console']
          : []),
        summary.fastRoute.bossNodeId,
        summary.fastRoute.exitNodeId
      ]);
      expect(summary.sweepRoute.plannedTargetNodeIds, summary.dungeonId).toContain(
        summary.sweepRoute.bossNodeId
      );
      expect(summary.sweepRoute.plannedTargetNodeIds.at(-1), summary.dungeonId).toBe(
        summary.sweepRoute.exitNodeId
      );
      expect(summary.sweepRoute.clearedNodeIdsBeforeExit, summary.dungeonId).toEqual(
        expect.arrayContaining(economicNodeIds)
      );
      expect(
        summary.sweepRoute.firstClearedNonExitNodeIds.length,
        summary.dungeonId
      ).toBeGreaterThanOrEqual(economicNodeIds.length);
      expect(
        summary.sweepRoute.clearedNodeIdsBeforeExit.filter((nodeId) => closedAuctionVaultIds.has(nodeId)),
        summary.dungeonId
      ).toEqual([]);
      expect(summary.sweepRoute.routeExcludedNodeIds, summary.dungeonId).toEqual(
        summary.dungeonId === 'genesis_vault' ? [...excludedGenesisVaultIds] : []
      );

      for (const route of [summary.fastRoute, summary.sweepRoute]) {
        expect(route.completed, `${summary.dungeonId}/${route.routeKind}`).toBe(true);
        expect(route.bossNodeCleared, `${summary.dungeonId}/${route.routeKind}`).toBe(true);
        expect(route.bossSealCleared, `${summary.dungeonId}/${route.routeKind}`).toBe(true);
        expect(route.exitNodeCleared, `${summary.dungeonId}/${route.routeKind}`).toBe(true);
        expect(route.clearedNodeIdsBeforeExit, `${summary.dungeonId}/${route.routeKind}`).toContain(
          route.bossNodeId
        );
        expect(route.clearedNodeIdsAfterExit, `${summary.dungeonId}/${route.routeKind}`).toContain(
          route.exitNodeId
        );
      }
    }
  });

  it('matches pressure counts to observed first non-exit clears and keeps fast tiers no higher', () => {
    const summaries = getResult().summaries;
    const tierRank = { stable: 0, hunted: 1, breach: 2 } as const;

    for (const summary of summaries) {
      for (const route of [summary.fastRoute, summary.sweepRoute]) {
        const firstClears = route.firstClearedNonExitNodeIds;
        const firstClearSet = new Set(firstClears);

        expect(firstClearSet.size, `${summary.dungeonId}/${route.routeKind}`).toBe(firstClears.length);
        expect(firstClears, `${summary.dungeonId}/${route.routeKind}`).not.toContain(route.exitNodeId);
        expect(route.pressureStateBeforeExit.clearedNodeCount, `${summary.dungeonId}/${route.routeKind}`).toBe(
          firstClears.length
        );
        expect(route.pressureStateAfterExit, `${summary.dungeonId}/${route.routeKind}`).toEqual(
          route.pressureStateBeforeExit
        );
        expect(route.pressureSettlement.state, `${summary.dungeonId}/${route.routeKind}`).toEqual(
          route.pressureStateBeforeExit
        );
        expect(route.pressureTier, `${summary.dungeonId}/${route.routeKind}`).toBe(
          getRunPressureStatus(route.pressureStateBeforeExit).tier
        );
      }

      expect(tierRank[summary.fastRoute.pressureTier], summary.dungeonId).toBeLessThanOrEqual(
        tierRank[summary.sweepRoute.pressureTier]
      );
    }

    expect(
      summaries.some(
        (summary) => tierRank[summary.fastRoute.pressureTier] < tierRank[summary.sweepRoute.pressureTier]
      )
    ).toBe(true);
  });

  it('uses real economy, pressure, movement, gate, boss, and exit evidence', () => {
    for (const summary of getResult().summaries) {
      for (const route of [summary.fastRoute, summary.sweepRoute]) {
        const checkpoint = `${summary.dungeonId}/${route.routeKind}`;

        expect(route.expectedPressureBonus, checkpoint).toBe(
          calculateRunPressureBonus(route.baseEconomy.rewardPoints, route.pressureStateBeforeExit)
        );
        expect(route.actualPressureBonus, checkpoint).toBe(route.expectedPressureBonus);
        expect(route.pressureSettlement.rewardPointBonus, checkpoint).toBe(route.actualPressureBonus);
        expect(route.pressureSettlement.tier, checkpoint).toBe(route.pressureTier);
        expect(route.observedSettlementRewardPoints, checkpoint).toBe(
          route.baseEconomy.rewardPoints + route.actualPressureBonus
        );
        expect(route.rewardPointsAfterSettlement - route.rewardPointsBeforeSettlement, checkpoint).toBe(
          route.observedSettlementRewardPoints
        );
        expect(route.baseEconomyInput.clearedNodes, checkpoint).toBe(
          route.clearedNodeIdsBeforeExit.length + 1
        );

        expect(route.routeEvidence.movements.length, checkpoint).toBeGreaterThan(0);
        expect(
          route.routeEvidence.movements.every(
            (movement) => movement.legal && movement.blockReason === undefined
          ),
          checkpoint
        ).toBe(true);
        expect(
          route.routeEvidence.movements.some((movement) => movement.toNodeId === route.bossNodeId),
          checkpoint
        ).toBe(true);
        expect(
          route.routeEvidence.movements.some((movement) => movement.toNodeId === route.exitNodeId),
          checkpoint
        ).toBe(true);
        expect(
          route.routeEvidence.gateChecks.every(
            (gate) => gate.status === 'open' || (gate.status === 'closed' && Boolean(gate.blockReason))
          ),
          checkpoint
        ).toBe(true);
      }
    }
  });
});
