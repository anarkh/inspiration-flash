import { describe, expect, it } from 'vitest';
import * as game from './game';
import { getBossCombatStats, getBossDefinition } from './boss-system';
import { getDungeonLootOffer } from './dungeon-loot';
import {
  createDungeonLawState,
  DUNGEON_LAW_LANDMARKS,
  getCombatOpeningDistribution,
  getMirrorCityShellStatus,
  signalFirstNodeClear,
  type CombatOpeningStyle,
  type DungeonLawState
} from './dungeon-laws';
import { DUNGEON_ROUTE_GATES, getRouteBlockReason } from './dungeon-routes';
import {
  evaluateRunProtocolReward,
  getRunProtocolDefinition,
  getRunProtocolRequiredNodeIds,
  scaleMonsterForRunProtocol,
  scaleTrapForRunProtocol,
  type DeepRunProtocolDefinition,
  type RunProtocolId
} from './run-protocols';
import {
  advanceRunPressureOnNodeClear,
  calculateRunPressureBonus,
  createRunPressureState,
  scaleMonsterForRunPressure,
  scaleTrapForRunPressure,
  type RunPressureState,
  type RunPressureTier
} from './run-pressure';
import {
  RUN_RELIC_DEFINITIONS,
  createRunRelicState,
  generateRunRelicDraft,
  type RunRelicFrame,
  type RunRelicId
} from './run-relics';
import {
  buyPet,
  buyEquipment,
  buyItem,
  capturePet,
  claimTaskReward,
  collectReward,
  createInitialState,
  DUNGEONS,
  DUNGEON_ORDER,
  enterDungeon,
  equipEquipment,
  EQUIPMENT,
  getDerivedStats,
  getCampaignGates,
  getDungeonReadiness,
  getPlayerPower,
  getWeaponSkillStatus,
  handleTrap,
  ITEMS,
  learnMethod,
  METHODS,
  performCombatAction,
  PETS,
  resolveEquipmentLoot,
  resolveExit,
  resolveRetreat,
  returnToHub,
  selectNode,
  type NodeType,
  usePortal,
  upgradeEquipment
} from './game';
import type { EquipmentId, GameState, PetId } from './game';
import {
  getEquipmentAttunementOptions,
  type EquipmentAttunementId
} from './equipment-system';
import type { EquipmentSoulSkillId } from './equipment-soul-skills';
import type { TacticalItemId } from './tactical-loadout';

type GridDungeonDefinition = game.DungeonDefinition & {
  grid?: {
    width: number;
    height: number;
    startNodeId: string;
  };
};
type MoveToNode = (state: GameState, nodeId: string) => GameState;

function dungeonWithGrid(dungeonId: game.DungeonId): GridDungeonDefinition {
  return DUNGEONS[dungeonId] as GridDungeonDefinition;
}

function getMoveToNode(): MoveToNode | undefined {
  return (game as typeof game & { moveToNode?: MoveToNode }).moveToNode;
}

function prepareTacticalItems(state: GameState, ...itemIds: TacticalItemId[]): GameState {
  return game.configureTacticalLoadout(state, itemIds);
}

function createPursuitReplayState(gateSigils = 0): GameState {
  const initial = createInitialState();
  return enterDungeon(
    {
      ...initial,
      inventory: {
        ...initial.inventory,
        gate_sigil: gateSigils
      },
      completedDungeonIds: ['demon_tower_1'],
      claimedTaskIds: ['mainline_clear_demon_tower_1']
    },
    'demon_tower_1'
  );
}

function patchPursuitRun(state: GameState, patch: Partial<game.DungeonRun>): GameState {
  if (!state.run) return state;
  return {
    ...state,
    phase: 'explore',
    combat: undefined,
    run: {
      ...state.run,
      ...patch
    }
  };
}

function stalkingPursuit(
  dungeonId: game.DungeonId = 'demon_tower_1',
  overrides: Partial<game.RunPursuitState> = {}
): game.RunPursuitState {
  return {
    ...game.activateRunPursuit(game.createRunPursuitState(dungeonId, true), 6),
    ...overrides
  };
}

function containedPursuit(dungeonId: game.DungeonId = 'demon_tower_1'): game.RunPursuitState {
  const definition = game.getRunPursuitDefinition(dungeonId);
  if (!definition) throw new Error(`Missing pursuit definition for ${dungeonId}`);
  return {
    ...stalkingPursuit(dungeonId),
    status: 'contained',
    nodeId: definition.containmentNodeId,
    graceMoves: 0,
    rewardGranted: true
  };
}

function atPursuitNode(
  state: GameState,
  currentNodeId: string,
  pursuitState: game.RunPursuitState,
  clearedNodeIds: string[] = []
): GameState {
  return patchPursuitRun(state, {
    currentNodeId,
    pursuitState,
    clearedNodeIds,
    damageTaken: 0
  });
}

function createCausalEntryState(
  equipmentIds: readonly EquipmentId[] = [],
  tacticalItemIds: readonly TacticalItemId[] = []
): GameState {
  const initial = createInitialState();
  const completedDungeonIds = DUNGEON_ORDER.filter((dungeonId) => dungeonId !== 'causal_clearinghouse');
  const equipped = { ...initial.equipped };
  const equipmentLevels = { ...initial.equipmentLevels };
  for (const equipmentId of equipmentIds) {
    equipped[EQUIPMENT[equipmentId].slot] = equipmentId;
    equipmentLevels[equipmentId] = 3;
  }
  const inventory = {
    ...initial.inventory,
    thunder_talisman: tacticalItemIds.includes('thunder_talisman') ? 2 : initial.inventory.thunder_talisman,
    healing_pill: tacticalItemIds.includes('healing_pill') ? 2 : initial.inventory.healing_pill
  };
  const prepared = game.configureTacticalLoadout(
    {
      ...initial,
      completedDungeonIds,
      claimedTaskIds: completedDungeonIds.map((dungeonId) => `mainline_clear_${dungeonId}`),
      ownedEquipment: [...new Set([...initial.ownedEquipment, ...equipmentIds])],
      equipmentLevels,
      equipped,
      inventory
    },
    tacticalItemIds
  );
  return enterDungeon(prepared, 'causal_clearinghouse');
}

function clearCausalMonster(state: GameState, nodeId: string): GameState {
  if (!state.run) throw new Error('Expected an active causal run');
  const atNode: GameState = {
    ...state,
    phase: 'explore',
    combat: undefined,
    run: { ...state.run, currentNodeId: nodeId }
  };
  const started = selectNode(atNode, nodeId);
  if (!started.combat) throw new Error(`Expected combat at ${nodeId}`);
  return performCombatAction(
    { ...started, combat: { ...started.combat, monsterHp: 1 } },
    'attack'
  );
}

function engageCausalBossWithDebt(state: GameState, debt: number): GameState {
  if (!state.run?.lawState || state.run.lawState.law.kind !== 'causal_clearinghouse') {
    throw new Error('Expected causal law state');
  }
  const atBoss: GameState = {
    ...state,
    phase: 'explore',
    combat: undefined,
    run: {
      ...state.run,
      currentNodeId: 'zero_sum_auditor',
      lawState: {
        ...state.run.lawState,
        law: {
          ...state.run.lawState.law,
          debt,
          pendingLedgerNodeId: null,
          bossDebtLocked: false,
          collectionSeals: 0
        }
      }
    }
  };
  return selectNode(atBoss, 'zero_sum_auditor');
}

function causalCollectionSeals(state: GameState): number | undefined {
  const law = state.run?.lawState?.law;
  return law?.kind === 'causal_clearinghouse' ? law.collectionSeals : undefined;
}

function createEntropyEntryState(equipmentIds: readonly EquipmentId[] = []): GameState {
  const initial = createInitialState();
  const completedDungeonIds = DUNGEON_ORDER.filter((dungeonId) => dungeonId !== 'entropy_ark');
  const equipped = { ...initial.equipped };
  const equipmentLevels = { ...initial.equipmentLevels };
  for (const equipmentId of equipmentIds) {
    equipped[EQUIPMENT[equipmentId].slot] = equipmentId;
    equipmentLevels[equipmentId] = 3;
  }
  return enterDungeon({
    ...initial,
    completedDungeonIds,
    claimedTaskIds: completedDungeonIds.map((dungeonId) => `mainline_clear_${dungeonId}`),
    ownedEquipment: [...new Set([...initial.ownedEquipment, ...equipmentIds])],
    equipmentLevels,
    equipped
  }, 'entropy_ark');
}

function atEntropyNode(state: GameState, nodeId: string): GameState {
  if (!state.run) throw new Error('Expected an active entropy run');
  return {
    ...state,
    phase: 'explore',
    combat: undefined,
    run: { ...state.run, currentNodeId: nodeId }
  };
}

function clearEntropyMonster(state: GameState, nodeId: string): GameState {
  const started = selectNode(atEntropyNode(state, nodeId), nodeId);
  if (!started.combat) throw new Error(`Expected combat at ${nodeId}`);
  return performCombatAction(
    {
      ...started,
      player: { ...started.player, hp: 1_000, maxHp: 1_000 },
      combat: { ...started.combat, monsterHp: 1 }
    },
    'attack'
  );
}

function withEntropy(state: GameState, entropy: number): GameState {
  if (!state.run?.lawState || state.run.lawState.law.kind !== 'entropy_ark') {
    throw new Error('Expected entropy law state');
  }
  return {
    ...state,
    run: {
      ...state.run,
      lawState: {
        ...state.run.lawState,
        law: { ...state.run.lawState.law, entropy }
      }
    }
  };
}

function createMirrorCityEntryState(
  equipmentIds: readonly EquipmentId[] = [],
  tacticalItemIds: readonly TacticalItemId[] = []
): GameState {
  const initial = createInitialState();
  const completedDungeonIds = DUNGEON_ORDER.filter((dungeonId) => dungeonId !== 'mirror_cycle_city');
  const equipped = { ...initial.equipped };
  const equipmentLevels = { ...initial.equipmentLevels };
  for (const equipmentId of equipmentIds) {
    equipped[EQUIPMENT[equipmentId].slot] = equipmentId;
    equipmentLevels[equipmentId] = EQUIPMENT[equipmentId].maxLevel;
  }
  const inventory = {
    ...initial.inventory,
    healing_pill: tacticalItemIds.includes('healing_pill') ? 2 : initial.inventory.healing_pill
  };
  const prepared = game.configureTacticalLoadout({
    ...initial,
    completedDungeonIds,
    claimedTaskIds: completedDungeonIds.map((dungeonId) => `mainline_clear_${dungeonId}`),
    ownedEquipment: [...new Set([...initial.ownedEquipment, ...equipmentIds])],
    equipmentLevels,
    equipped,
    inventory
  }, tacticalItemIds);
  return enterDungeon(prepared, 'mirror_cycle_city');
}

function createRedactionEntryState(equipmentIds: readonly EquipmentId[] = []): GameState {
  const initial = createInitialState();
  const completedDungeonIds = DUNGEON_ORDER.filter(
    (dungeonId) => dungeonId !== 'redaction_scriptorium'
  );
  const equipped = { ...initial.equipped };
  const equipmentLevels = { ...initial.equipmentLevels };
  for (const equipmentId of equipmentIds) {
    equipped[EQUIPMENT[equipmentId].slot] = equipmentId;
    equipmentLevels[equipmentId] = EQUIPMENT[equipmentId].maxLevel;
  }
  return enterDungeon({
    ...initial,
    completedDungeonIds,
    claimedTaskIds: completedDungeonIds.map((dungeonId) => `mainline_clear_${dungeonId}`),
    ownedEquipment: [...new Set([...initial.ownedEquipment, ...equipmentIds])],
    equipmentLevels,
    equipped
  }, 'redaction_scriptorium');
}

function atRedactionNode(state: GameState, nodeId: string): GameState {
  if (!state.run) throw new Error('Expected an active redaction run');
  return {
    ...state,
    phase: 'explore',
    combat: undefined,
    run: { ...state.run, currentNodeId: nodeId }
  };
}

function createAuctionEntryState(equipmentIds: readonly EquipmentId[] = []): GameState {
  const initial = createInitialState();
  const completedDungeonIds = DUNGEON_ORDER.filter(
    (dungeonId) => dungeonId !== 'legacy_auction_court'
  );
  const equipped = { ...initial.equipped };
  const equipmentLevels = { ...initial.equipmentLevels };
  for (const equipmentId of equipmentIds) {
    equipped[EQUIPMENT[equipmentId].slot] = equipmentId;
    equipmentLevels[equipmentId] = EQUIPMENT[equipmentId].maxLevel;
  }
  return enterDungeon({
    ...initial,
    completedDungeonIds,
    claimedTaskIds: completedDungeonIds.map((dungeonId) => `mainline_clear_${dungeonId}`),
    ownedEquipment: [...new Set([...initial.ownedEquipment, ...equipmentIds])],
    equipmentLevels,
    equipped
  }, 'legacy_auction_court');
}

function atAuctionNode(state: GameState, nodeId: string): GameState {
  if (!state.run) throw new Error('Expected an active auction run');
  return {
    ...state,
    phase: 'explore',
    combat: undefined,
    run: { ...state.run, currentNodeId: nodeId }
  };
}

function atMirrorCityNode(state: GameState, nodeId: string): GameState {
  if (!state.run) throw new Error('Expected an active mirror-city run');
  return {
    ...state,
    phase: 'explore',
    combat: undefined,
    run: { ...state.run, currentNodeId: nodeId }
  };
}

function resolveMirrorChoice(
  state: GameState,
  nodeId: 'first_phase_mirror' | 'second_phase_mirror' | 'third_phase_mirror',
  phase: game.MirrorCityPhase
): GameState {
  return game.resolveMirrorCityPhase(collectReward(atMirrorCityNode(state, nodeId)), phase);
}

function prepareMirrorBoss(
  equipmentIds: readonly EquipmentId[] = [],
  anchors: readonly game.MirrorCityPhase[] = [],
  tacticalItemIds: readonly TacticalItemId[] = []
): GameState {
  let state = createMirrorCityEntryState(equipmentIds, tacticalItemIds);
  state = resolveMirrorChoice(state, 'first_phase_mirror', 'real');
  if (anchors.includes('real')) state = collectReward(atMirrorCityNode(state, 'real_anchor'));
  state = resolveMirrorChoice(state, 'second_phase_mirror', 'mirror');
  if (anchors.includes('mirror')) state = collectReward(atMirrorCityNode(state, 'mirror_anchor'));
  state = resolveMirrorChoice(state, 'third_phase_mirror', 'mirror');

  const moved = game.moveToNode(state, 'nameless_reflection');
  if (moved.run?.currentNodeId !== 'nameless_reflection') {
    throw new Error(`Expected mirror boss route to open: ${moved.log[0]}`);
  }
  const started = selectNode(moved, 'nameless_reflection');
  if (!started.combat) throw new Error('Expected mirror-city boss combat');
  return started;
}

describe('causal clearinghouse game integration', () => {
  it('freezes all three equipment passives on entry instead of reading later loadout changes', () => {
    const entered = createCausalEntryState([
      'causal_visor',
      'echo_breaker_gauntlets',
      'return_anchor_belt'
    ]);
    const law = entered.run?.lawState?.law;

    expect(law?.kind).toBe('causal_clearinghouse');
    if (law?.kind !== 'causal_clearinghouse') throw new Error('Expected causal law');
    expect(law.entryPassives).toEqual({
      causalVisor: true,
      echoBreakerGauntlets: true,
      returnAnchorBelt: true
    });

    const changedAfterEntry: GameState = {
      ...entered,
      equipped: {
        ...entered.equipped,
        head: 'patched_headwrap',
        hands: 'patched_gloves',
        waist: 'patched_belt'
      }
    };
    expect(game.getCurrentCausalLedgerStatus(changedAfterEntry)?.repayDamagePercent).toBe(8);
  });

  it('opens one ledger on first clear, blocks movement, and balances without extra progression', () => {
    const cleared = clearCausalMonster(createCausalEntryState(), 'verdict_usher');
    const status = game.getCurrentCausalLedgerStatus(cleared);

    expect(status).toMatchObject({ pending: true, debt: 0, pendingLedgerNodeId: 'verdict_usher' });
    expect(game.getNodeDepartureBlock(cleared)?.kind).toBe('causal_ledger');
    const blocked = game.moveToNode(cleared, 'contradiction_line');
    expect(blocked.run?.currentNodeId).toBe('verdict_usher');

    const pressureBefore = cleared.run?.pressureState;
    const pursuitBefore = cleared.run?.pursuitState;
    const settled = game.resolveCausalLedger(cleared, 'balance');
    expect(game.getCurrentCausalLedgerStatus(settled)).toMatchObject({ pending: false, debt: 0 });
    expect(settled.run?.pressureState).toEqual(pressureBefore);
    expect(settled.run?.pursuitState).toEqual(pursuitBefore);
    expect(settled.run?.clearedNodeIds).toEqual(cleared.run?.clearedNodeIds);
    expect(game.moveToNode(settled, 'contradiction_line').run?.currentNodeId).toBe('contradiction_line');

    const mismatchedSavedRun: GameState = {
      ...cleared,
      run: cleared.run ? { ...cleared.run, currentNodeId: 'contradiction_line' } : cleared.run
    };
    expect(game.getNodeDepartureBlock(mismatchedSavedRun)?.kind).toBe('causal_ledger');
    expect(game.getCurrentCausalLedgerStatus(
      game.resolveCausalLedger(mismatchedSavedRun, 'balance')
    )?.pending).toBe(false);
  });

  it('settles overdraw and repayment exactly, including visor and anchor-belt passives', () => {
    const plainCleared = clearCausalMonster(createCausalEntryState(), 'verdict_usher');
    const plainLowHp = { ...plainCleared, player: { ...plainCleared.player, hp: 50 } };
    const plainRewardBefore = plainLowHp.rewardPoints;
    const overdrawn = game.resolveCausalLedger(plainLowHp, 'overdraw');
    expect(game.getCurrentCausalLedgerStatus(overdrawn)?.debt).toBe(1);
    expect(overdrawn.rewardPoints - plainRewardBefore).toBe(108);
    expect(overdrawn.player.hp).toBe(50 + Math.floor(overdrawn.player.maxHp * 0.1));
    expect(overdrawn.run?.lootBag.rewardPoints).toBeGreaterThanOrEqual(108);

    const visorFirst = game.resolveCausalLedger(
      clearCausalMonster(createCausalEntryState(['causal_visor']), 'verdict_usher'),
      'overdraw'
    );
    expect(game.getCurrentCausalLedgerStatus(visorFirst)?.debt).toBe(0);
    const visorSecondClear = clearCausalMonster(visorFirst, 'effect_bailiff');
    const visorSecond = game.resolveCausalLedger(visorSecondClear, 'overdraw');
    expect(game.getCurrentCausalLedgerStatus(visorSecond)?.debt).toBe(1);

    const beltOverdraw = game.resolveCausalLedger(
      clearCausalMonster(createCausalEntryState(['return_anchor_belt']), 'verdict_usher'),
      'overdraw'
    );
    const beltSecondClear = clearCausalMonster(beltOverdraw, 'effect_bailiff');
    const beltAtFullHp = {
      ...beltSecondClear,
      player: { ...beltSecondClear.player, hp: beltSecondClear.player.maxHp }
    };
    const repaid = game.resolveCausalLedger(beltAtFullHp, 'repay');
    expect(game.getCurrentCausalLedgerStatus(repaid)?.debt).toBe(0);
    expect(beltAtFullHp.player.hp - repaid.player.hp).toBe(
      Math.floor(beltAtFullHp.player.maxHp * 0.08)
    );
  });

  it('freezes Boss debt into seals, reduces the gauntlet snapshot, and consumes only on offense', () => {
    const plainBoss = engageCausalBossWithDebt(createCausalEntryState(), 3);
    const gauntletBoss = engageCausalBossWithDebt(
      createCausalEntryState(['echo_breaker_gauntlets']),
      3
    );
    expect(causalCollectionSeals(plainBoss)).toBe(3);
    expect(causalCollectionSeals(gauntletBoss)).toBe(2);

    const guarded = performCombatAction(gauntletBoss, 'guard');
    expect(causalCollectionSeals(guarded)).toBe(2);
    const attacked = performCombatAction(gauntletBoss, 'attack');
    expect(causalCollectionSeals(attacked)).toBe(1);
    expect(attacked.combat?.log.some((line) => line.includes('追缴印') && line.includes('减半'))).toBe(true);

    const artBoss = engageCausalBossWithDebt(createCausalEntryState(), 2);
    expect(causalCollectionSeals(performCombatAction(artBoss, 'art'))).toBe(1);

    const talismanBoss = engageCausalBossWithDebt(
      createCausalEntryState([], ['thunder_talisman']),
      2
    );
    expect(causalCollectionSeals(performCombatAction(talismanBoss, 'use_thunder_talisman'))).toBe(1);

    const weaponBoss = engageCausalBossWithDebt(createCausalEntryState(['chronal_edge']), 2);
    if (!weaponBoss.combat) throw new Error('Expected causal boss combat');
    const focusedWeaponBoss: GameState = {
      ...weaponBoss,
      combat: { ...weaponBoss.combat, weaponFocus: 3 }
    };
    expect(game.getWeaponSkillStatus(focusedWeaponBoss).available).toBe(true);
    expect(causalCollectionSeals(performCombatAction(focusedWeaponBoss, 'weapon_skill'))).toBe(1);
  });

  it('keeps overdraw rewards in the run loot settlement when the player retreats', () => {
    const cleared = clearCausalMonster(createCausalEntryState(), 'verdict_usher');
    const balancedRetreat = resolveRetreat(game.resolveCausalLedger(cleared, 'balance'));
    const overdrawRetreat = resolveRetreat(game.resolveCausalLedger(cleared, 'overdraw'));

    expect(overdrawRetreat.rewardPoints - balancedRetreat.rewardPoints).toBe(54);
    expect(overdrawRetreat.rewardPoints - balancedRetreat.rewardPoints).toBeLessThan(108);
    expect(overdrawRetreat.run?.lastLootSettlement?.retained.rewardPoints).toBe(
      (balancedRetreat.run?.lastLootSettlement?.retained.rewardPoints ?? 0) + 54
    );
  });
});

describe('panopticon city game integration', () => {
  function enterPanopticon(equipped: Partial<GameState['equipped']> = {}): GameState {
    const initial = createInitialState();
    const equipmentIds = Object.values(equipped) as EquipmentId[];
    const entered = enterDungeon({
      ...initial,
      completedDungeonIds: DUNGEON_ORDER.filter((id) => id !== 'panopticon_city'),
      claimedTaskIds: DUNGEON_ORDER.slice(0, 18).map((id) => `mainline_clear_${id}`),
      ownedEquipment: [...new Set([...initial.ownedEquipment, ...equipmentIds])],
      equipmentLevels: { ...initial.equipmentLevels, ...Object.fromEntries(equipmentIds.map((id) => [id, 1])) },
      equipped: { ...initial.equipped, ...equipped },
      player: {
        ...initial.player,
        hp: 5000,
        maxHp: 5000,
        base: { body: 80, spirit: 60, agility: 30, luck: 10 }
      }
    }, 'panopticon_city');
    if (!entered.run || entered.run.dungeonId !== 'panopticon_city') {
      throw new Error(`Expected panopticon entry: ${entered.log[0]}`);
    }
    return entered;
  }

  function atPanopticonNode(state: GameState, nodeId: string): GameState {
    if (!state.run) throw new Error('Expected active panopticon run');
    return {
      ...state,
      phase: 'explore',
      combat: undefined,
      run: { ...state.run, currentNodeId: nodeId }
    };
  }

  function completePanopticonRelays(state: GameState): GameState {
    let next = state;
    for (const nodeId of DUNGEON_LAW_LANDMARKS.panopticon_city.relayNodeIds) {
      next = collectReward(atPanopticonNode(next, nodeId));
    }
    return next;
  }

  it('registers the observation material and exact four-piece Tier-19 equipment costs', () => {
    expect(ITEMS.observation_shard).toMatchObject({
      id: 'observation_shard', name: '观测棱片', kind: 'material'
    });
    expect(ITEMS.observation_shard.cost).toBeUndefined();
    expect(createInitialState().inventory.observation_shard).toBe(0);
    expect(EQUIPMENT.blindline_cutter).toMatchObject({
      name: '断视切线刃', slot: 'weapon',
      cost: { rewardPoints: 2260, lingyun: 10, items: { observation_shard: 1, star_iron: 1 } }
    });
    expect(EQUIPMENT.predictive_visor).toMatchObject({
      name: '先见目镜', slot: 'head',
      cost: { rewardPoints: 2200, lingyun: 10, items: { observation_shard: 1, phase_glass: 1 } }
    });
    expect(EQUIPMENT.matte_shell).toMatchObject({
      name: '消光披甲', slot: 'armor',
      cost: { rewardPoints: 2280, lingyun: 10, items: { observation_shard: 1, rift_dust: 1 } }
    });
    expect(EQUIPMENT.inverse_prism).toMatchObject({
      name: '逆观棱镜', slot: 'charm',
      cost: { rewardPoints: 2240, lingyun: 10, items: { observation_shard: 1, chronal_glass: 1 } }
    });
  });

  it('applies movement-driven exposure damage, decoy RP, route departure blocking, and death recovery', () => {
    const entered = enterPanopticon();
    const prematureBoss = selectNode(atPanopticonNode(entered, 'all_sight_warden'), 'all_sight_warden');
    expect(prematureBoss.phase).toBe('explore');
    expect(prematureBoss.log[0]).toContain('先完成三座盲区中继并选择潜入路线');
    const exposed = game.moveToNode(entered, 'watchglass_cache');
    expect(exposed.player.hp).toBe(4600);
    expect(game.getCurrentDungeonLaw(exposed)?.display.panopticon).toMatchObject({
      scanPhase: 1, moveCount: 1, exposureCount: 1
    });

    const complete = completePanopticonRelays(entered);
    const blocked = game.moveToNode(complete, 'refraction_lab');
    expect(blocked.run?.currentNodeId).toBe('south_blind_relay');
    expect(blocked.log[0]).toContain('请先选择影路、诱饵或折光路线');

    const routed = game.selectPanopticonRoute(complete, 'decoy');
    const lootBefore = routed.run?.lootBag.rewardPoints ?? 0;
    const moved = game.moveToNode(routed, 'refraction_lab');
    expect(moved.run?.lootBag.rewardPoints).toBe(lootBefore + 120);
    expect(moved.player.hp).toBe(4600);

    const doomed = game.moveToNode({
      ...entered,
      player: { ...entered.player, hp: 1, maxHp: 100 }
    }, 'watchglass_cache');
    expect(doomed.phase).toBe('result');
    expect(doomed.player.hp).toBe(0);
    expect(doomed.lastOutcome).toContain('三相扫描完成曝光处决');
  });

  it('freezes all four entry passives, preserves them across reload, and snapshots the boss once', () => {
    const equipped = {
      weapon: 'blindline_cutter',
      head: 'predictive_visor',
      armor: 'matte_shell',
      charm: 'inverse_prism'
    } as const;
    const entered = enterPanopticon(equipped);
    const changed = { ...entered, equipped: createInitialState().equipped };
    expect(game.getCurrentDungeonLaw(JSON.parse(JSON.stringify(changed)) as GameState)?.display.panopticon?.entryGear)
      .toEqual({ blindlineCutter: true, predictiveVisor: true, matteShell: true, inversePrism: true });

    const malformed: GameState = {
      ...changed,
      run: changed.run ? {
        ...changed.run,
        lawState: {
          ...changed.run.lawState!,
          law: { kind: 'panopticon_city' } as never
        }
      } : undefined
    };
    expect(game.getCurrentDungeonLaw(malformed)?.display.panopticon?.entryGear)
      .toEqual({ blindlineCutter: false, predictiveVisor: false, matteShell: false, inversePrism: false });

    const routed = game.selectPanopticonRoute(completePanopticonRelays(entered), 'refraction');
    const charged = game.moveToNode(routed, 'refraction_lab');
    const boss = selectNode(atPanopticonNode(charged, 'all_sight_warden'), 'all_sight_warden');
    const snapshot = game.getCurrentDungeonLaw(boss)?.display.panopticon?.bossSnapshot;
    expect(snapshot).toEqual({ route: 'refraction', exposureCount: 0, refractionCharges: 2 });
    const afterAction = performCombatAction(boss, 'guard');
    expect(game.getCurrentDungeonLaw(afterAction)?.display.panopticon?.bossSnapshot).toEqual(snapshot);
  });
});

describe('false testimony equipment core integration', () => {
  const verdictEquipmentIds = [
    'cross_examiner_sabre',
    'forensic_visor',
    'custody_shell',
    'appeal_seal'
  ] as const satisfies readonly EquipmentId[];

  function fundedVerdictHub(): GameState {
    const initial = createInitialState();
    return {
      ...initial,
      rewardPoints: 100_000,
      lingyun: 100,
      inventory: {
        ...initial.inventory,
        truth_fragment: 4,
        star_iron: 1,
        phase_glass: 1,
        rift_dust: 1,
        chronal_glass: 1,
        cracked_core: 4
      }
    };
  }

  it('defines the four Lv3 verdict items with exact costs, stats, and frozen-law copy', () => {
    expect(EQUIPMENT.cross_examiner_sabre).toMatchObject({
      slot: 'weapon', maxLevel: 3,
      cost: { rewardPoints: 1960, lingyun: 8, items: { truth_fragment: 1, star_iron: 1 } },
      base: { attack: 34, artPower: 8 }, perLevel: { attack: 10, artPower: 2 }
    });
    expect(EQUIPMENT.forensic_visor).toMatchObject({
      slot: 'head', maxLevel: 3,
      cost: { rewardPoints: 1900, lingyun: 8, items: { truth_fragment: 1, phase_glass: 1 } },
      base: { spirit: 4, artPower: 24, speed: 5, trapCheck: 9 },
      perLevel: { artPower: 7, speed: 2, trapCheck: 2 }
    });
    expect(EQUIPMENT.custody_shell).toMatchObject({
      slot: 'armor', maxLevel: 3,
      cost: { rewardPoints: 1980, lingyun: 8, items: { truth_fragment: 1, rift_dust: 1 } },
      base: { maxHp: 78, defense: 20 }, perLevel: { maxHp: 24, defense: 6 }
    });
    expect(EQUIPMENT.appeal_seal).toMatchObject({
      slot: 'charm', maxLevel: 3,
      cost: { rewardPoints: 1940, lingyun: 8, items: { truth_fragment: 1, chronal_glass: 1 } },
      base: { spirit: 4, artPower: 29, defense: 7 }, perLevel: { artPower: 10, defense: 2 }
    });
    for (const equipmentId of verdictEquipmentIds) {
      expect(EQUIPMENT[equipmentId].description).toContain('入场时冻结裁定法则被动');
    }
    const funded = fundedVerdictHub();
    expect(game.getEquipmentSystemStatus({
      ...funded,
      ownedEquipment: [...funded.ownedEquipment, ...verdictEquipmentIds],
      equipmentLevels: {
        ...funded.equipmentLevels,
        cross_examiner_sabre: 3, forensic_visor: 3, custody_shell: 3, appeal_seal: 3
      },
      equipped: {
        ...funded.equipped,
        weapon: 'cross_examiner_sabre', head: 'forensic_visor',
        armor: 'custody_shell', charm: 'appeal_seal'
      }
    }).setCounts).toMatchObject({ forge: 1, mist: 1, rift: 1, chronal: 1 });
  });

  it('keeps truth fragments dungeon-only and treats missing legacy inventory as zero', () => {
    const fresh = createInitialState();
    expect(fresh.inventory.truth_fragment).toBe(0);
    const rejected = buyItem(fresh, 'truth_fragment');
    expect(rejected.inventory.truth_fragment).toBe(0);
    expect(rejected.log[0]).toContain('只能在副本中获得');

    const legacy = JSON.parse(JSON.stringify(fresh)) as GameState;
    delete (legacy.inventory as Partial<Record<game.ItemId, number>>).truth_fragment;
    const legacyRejected = buyEquipment({
      ...legacy,
      rewardPoints: 100_000,
      lingyun: 100,
      inventory: { ...legacy.inventory, star_iron: 1 }
    }, 'cross_examiner_sabre');
    expect(legacyRejected.ownedEquipment).not.toContain('cross_examiner_sabre');
    expect(legacyRejected.log[0]).toContain('资源不足');
  });

  it('buys, upgrades, and equips all four verdict items through the normal lifecycle', () => {
    let state = fundedVerdictHub();
    for (const equipmentId of verdictEquipmentIds) {
      state = buyEquipment(state, equipmentId);
      expect(state.ownedEquipment).toContain(equipmentId);
      expect(state.equipmentLevels[equipmentId]).toBe(1);
      state = upgradeEquipment(state, equipmentId);
      state = upgradeEquipment(state, equipmentId);
      state = equipEquipment(state, equipmentId);
      expect(state.equipmentLevels[equipmentId]).toBe(3);
      expect(state.equipped[EQUIPMENT[equipmentId].slot]).toBe(equipmentId);
    }
    expect(state.inventory.truth_fragment).toBe(0);
    expect(state.rewardPoints).toBe(100_000 - 7_780 - (220 + 360) * 4);
    expect(state.lingyun).toBe(100 - 32 - 4);
  });

  it('starts a fresh v1-compatible state without verdict run fields or owned verdict equipment', () => {
    const fresh = createInitialState();
    expect(fresh.run).toBeUndefined();
    expect(fresh.combat).toBeUndefined();
    expect(fresh.inventory.truth_fragment).toBe(0);
    expect(fresh.ownedEquipment).not.toEqual(expect.arrayContaining([...verdictEquipmentIds]));
  });
});

describe('Tier 14 bloodline and genesis game integration', () => {
  function fundedTier14Hub(): GameState {
    const initial = createInitialState();
    return {
      ...initial,
      rewardPoints: 20_000,
      lingyun: 50,
      inventory: { ...initial.inventory, genesis_serum: 20, gate_sigil: 5 },
      completedDungeonIds: [...DUNGEON_ORDER],
      claimedTaskIds: DUNGEON_ORDER.map((dungeonId) => `mainline_clear_${dungeonId}`)
    };
  }

  function bloodlineHub(
    bloodlineId: game.BloodlineId,
    rank: game.BloodlineRank
  ): GameState {
    return {
      ...fundedTier14Hub(),
      bloodlineRanks: { [bloodlineId]: rank },
      activeBloodline: bloodlineId
    };
  }

  function startBloodlineCombat(
    bloodlineId: game.BloodlineId,
    rank: game.BloodlineRank,
    nodeId = 'fog_lesser_demon'
  ): GameState {
    const entered = enterDungeon(bloodlineHub(bloodlineId, rank), 'demon_tower_1');
    if (!entered.run) throw new Error('Expected bloodline run');
    return selectNode({
      ...entered,
      phase: 'explore',
      combat: undefined,
      run: { ...entered.run, currentNodeId: nodeId }
    }, nodeId);
  }

  function genesisEntry(
    equipmentIds: readonly EquipmentId[] = [],
    bloodlineId?: game.BloodlineId,
    rank: game.BloodlineRank = 1
  ): GameState {
    const initial = bloodlineId ? bloodlineHub(bloodlineId, rank) : fundedTier14Hub();
    const equipped = { ...initial.equipped };
    const equipmentLevels = { ...initial.equipmentLevels };
    for (const equipmentId of equipmentIds) {
      equipped[EQUIPMENT[equipmentId].slot] = equipmentId;
      equipmentLevels[equipmentId] = EQUIPMENT[equipmentId].maxLevel;
    }
    return enterDungeon({
      ...initial,
      ownedEquipment: [...new Set([...initial.ownedEquipment, ...equipmentIds])],
      equipmentLevels,
      equipped
    }, 'genesis_vault');
  }

  function atGenesisNode(state: GameState, nodeId: string): GameState {
    if (!state.run) throw new Error('Expected genesis run');
    return {
      ...state,
      phase: 'explore',
      combat: undefined,
      run: { ...state.run, currentNodeId: nodeId }
    };
  }

  it('unlocks, upgrades, and activates bloodlines only in hub with exact atomic costs', () => {
    const funded = fundedTier14Hub();
    const poor = { ...funded, rewardPoints: 799 };
    expect(game.unlockBloodline(poor, 'titan_marrow')).toBe(poor);
    expect(game.unlockBloodline(funded, 'unknown' as game.BloodlineId)).toBe(funded);

    const titan = game.unlockBloodline(funded, 'titan_marrow');
    expect(game.getBloodlineProgress(titan)).toEqual({
      rulesVersion: 1, ranks: { titan_marrow: 1 }, active: 'titan_marrow'
    });
    expect(titan.rewardPoints).toBe(funded.rewardPoints - 800);
    expect(titan.lingyun).toBe(funded.lingyun - 2);
    expect(titan.inventory.genesis_serum).toBe(funded.inventory.genesis_serum);

    const voidUnlocked = game.unlockBloodline(titan, 'void_symbiote');
    expect(voidUnlocked.activeBloodline).toBe('titan_marrow');
    const voidRankTwo = game.upgradeBloodline(voidUnlocked, 'void_symbiote');
    expect(voidRankTwo.bloodlineRanks.void_symbiote).toBe(2);
    expect(voidRankTwo.rewardPoints).toBe(voidUnlocked.rewardPoints - 1200);
    expect(voidRankTwo.lingyun).toBe(voidUnlocked.lingyun - 3);
    expect(voidRankTwo.inventory.genesis_serum).toBe(voidUnlocked.inventory.genesis_serum - 1);

    const resourcesBefore = [voidRankTwo.rewardPoints, voidRankTwo.lingyun, voidRankTwo.inventory.genesis_serum];
    const activated = game.activateBloodline(voidRankTwo, 'void_symbiote');
    expect(activated.activeBloodline).toBe('void_symbiote');
    expect([activated.rewardPoints, activated.lingyun, activated.inventory.genesis_serum]).toEqual(resourcesBefore);
    expect(game.activateBloodline(activated, 'phoenix_ember')).toBe(activated);

    const inRun = enterDungeon(activated, 'demon_tower_1');
    expect(game.unlockBloodline(inRun, 'phoenix_ember')).toBe(inRun);
    expect(game.upgradeBloodline(inRun, 'void_symbiote')).toBe(inRun);
    expect(game.activateBloodline(inRun, 'titan_marrow')).toBe(inRun);
  });

  it('adds the active hub bloodline to permanent stats, health normalization, and player power', () => {
    const baseline = fundedTier14Hub();
    const baselineStats = getDerivedStats(baseline);
    const baselinePower = getPlayerPower(baseline);
    const cases = [
      ['titan_marrow', { attack: 6, maxHp: 12 }],
      ['void_symbiote', { spirit: 1, artPower: 12 }],
      ['bastion_chitin', { defense: 4, maxHp: 18 }],
      ['phoenix_ember', { speed: 2, maxHp: 12 }]
    ] as const;

    for (const [bloodlineId, expectedDelta] of cases) {
      const active = bloodlineHub(bloodlineId, 1);
      const stats = getDerivedStats(active);
      for (const [key, delta] of Object.entries(expectedDelta)) {
        expect(stats[key as keyof game.DerivedStats] - baselineStats[key as keyof game.DerivedStats]).toBe(delta);
      }
      expect(getPlayerPower(active)).toBeGreaterThan(baselinePower);
    }

    const unlocked = game.unlockBloodline({ ...baseline, player: { ...baseline.player, hp: baseline.player.maxHp } }, 'titan_marrow');
    expect(unlocked.player.maxHp).toBe(baseline.player.maxHp + 12);
    expect(unlocked.player.hp).toBe(unlocked.player.maxHp);
  });

  it('freezes the active bloodline on entry and preserves source fields through portals without hub fallback', () => {
    const entered = enterDungeon(bloodlineHub('titan_marrow', 2), 'demon_tower_1');
    const snapshot = entered.run?.bloodlineSnapshot;
    expect(snapshot).toEqual({ rulesVersion: 1, bloodlineId: 'titan_marrow', aspect: 'force', rank: 2 });
    const frozenStats = getDerivedStats(entered);
    const changedHubFields: GameState = {
      ...entered,
      bloodlineRanks: { titan_marrow: 3, void_symbiote: 3 },
      activeBloodline: 'void_symbiote'
    };
    expect(getDerivedStats(changedHubFields)).toEqual(frozenStats);

    const portalReady = atGenesisNode(genesisEntry([], 'titan_marrow', 2), 'upper_genesis_portal');
    const transported = usePortal(portalReady, 'stabilize');
    expect(transported.run?.bloodlineSnapshot).toBe(portalReady.run?.bloodlineSnapshot);

    if (!portalReady.run) throw new Error('Expected portal run');
    const malformedSnapshot = { rulesVersion: 1, bloodlineId: 'titan_marrow', aspect: 'art', rank: 3 };
    const malformed: GameState = {
      ...portalReady,
      activeBloodline: 'void_symbiote',
      bloodlineRanks: { void_symbiote: 3 },
      run: { ...portalReady.run, bloodlineSnapshot: malformedSnapshot as never }
    };
    const malformedTransported = usePortal(malformed, 'stabilize');
    expect(malformedTransported.run?.bloodlineSnapshot).toBe(malformedSnapshot);
    expect(game.getCurrentBloodlineSurgeStatus(malformedTransported).legacyDisabled).toBe(true);
  });

  it.each([
    ['titan_marrow', 1, 18, 0, 0], ['titan_marrow', 2, 30, 0, 0], ['titan_marrow', 3, 44, 0, 0],
    ['void_symbiote', 1, 20, 0, 0], ['void_symbiote', 2, 34, 0, 0], ['void_symbiote', 3, 50, 0, 0],
    ['bastion_chitin', 1, 0, 20, 0], ['bastion_chitin', 2, 0, 34, 0], ['bastion_chitin', 3, 0, 50, 0],
    ['phoenix_ember', 1, 0, 0, 12], ['phoenix_ember', 2, 0, 0, 18], ['phoenix_ember', 3, 0, 0, 25]
  ] as const)('applies %s R%s surge once as a free action', (bloodlineId, rank, damage, barrier, healPercent) => {
    const started = startBloodlineCombat(bloodlineId, rank);
    if (!started.combat || !started.run) throw new Error('Expected bloodline combat');
    const prepared: GameState = {
      ...started,
      player: { ...started.player, hp: Math.max(1, started.player.maxHp - 60) },
      combat: { ...started.combat, monsterHp: 1_000, weaponFocus: 2 }
    };
    const combatBefore = prepared.combat!;
    const runBefore = prepared.run;
    const used = game.useBloodlineSurge(prepared);
    const expectedHealing = Math.min(
      prepared.player.maxHp - prepared.player.hp,
      Math.ceil((prepared.player.maxHp * healPercent) / 100)
    );

    expect(used.combat?.monsterHp).toBe(1_000 - damage);
    expect(used.combat?.bloodlineBarrier).toBe(barrier);
    expect(used.player.hp).toBe(prepared.player.hp + expectedHealing);
    expect(used.combat).toMatchObject({ turn: combatBefore.turn, weaponFocus: 2, bloodlineSurgeUsed: true });
    expect(used.run).toBe(runBefore);
    expect(used.combat?.log[0]).toContain('血统爆发');
    expect(used.log[0]).toContain('血统爆发');
    expect(game.getCurrentBloodlineSurgeStatus(used).reason).toBe('already_used');
    expect(game.useBloodlineSurge(used)).toBe(used);
  });

  it('disables legacy and full-health phoenix surges and resets usage for the next real combat', () => {
    const started = startBloodlineCombat('phoenix_ember', 1);
    expect(game.getCurrentBloodlineSurgeStatus(started).reason).toBe('no_benefit');
    expect(game.useBloodlineSurge(started)).toBe(started);
    if (!started.run || !started.combat) throw new Error('Expected phoenix combat');

    const legacyRun = { ...started.run };
    delete legacyRun.bloodlineSnapshot;
    const legacy = { ...started, run: legacyRun };
    expect(game.getCurrentBloodlineSurgeStatus(legacy).reason).toBe('legacy_disabled');
    expect(game.useBloodlineSurge(legacy)).toBe(legacy);

    const injured = { ...started, player: { ...started.player, hp: started.player.hp - 1 } };
    const used = game.useBloodlineSurge(injured);
    const exploring: GameState = {
      ...used,
      phase: 'explore',
      combat: undefined,
      run: { ...started.run, currentNodeId: 'bone_lane_monster', clearedNodeIds: [started.combat.nodeId] }
    };
    const nextCombat = selectNode(exploring, 'bone_lane_monster');
    expect(nextCombat.combat?.bloodlineSurgeUsed).toBe(false);
    expect(nextCombat.combat?.bloodlineBarrier).toBe(0);
  });

  it('absorbs the complete final monster hit with the bloodline barrier and uses the real victory chain on surge kills', () => {
    const started = startBloodlineCombat('bastion_chitin', 3);
    if (!started.combat) throw new Error('Expected bastion combat');
    const durable = { ...started, combat: { ...started.combat, monsterHp: 1_000 } };
    const baseline = performCombatAction(durable, 'attack');
    const baselineDamage = durable.player.hp - baseline.player.hp;
    const shielded = performCombatAction(game.useBloodlineSurge(durable), 'attack');
    expect(shielded.player.hp).toBe(durable.player.hp);
    expect(shielded.combat?.bloodlineBarrier).toBe(50 - baselineDamage);
    expect(shielded.combat?.log.some((line) => line.includes(`吸收 ${baselineDamage} 点最终入伤`))).toBe(true);

    const titan = startBloodlineCombat('titan_marrow', 3);
    if (!titan.combat || !titan.run) throw new Error('Expected titan combat');
    const lethal = { ...titan, combat: { ...titan.combat, monsterHp: 40 } };
    const rewardBefore = titan.run.lootBag.rewardPoints;
    const killed = game.useBloodlineSurge(lethal);
    expect(killed.phase).toBe('explore');
    expect(killed.combat).toBeUndefined();
    expect(killed.run?.clearedNodeIds).toContain(lethal.combat.nodeId);
    expect(killed.run?.lootBag.rewardPoints).toBeGreaterThan(rewardBefore);
    expect(killed.log.some((line) => line.includes('血统爆发'))).toBe(true);
  });

  it('atomically spends only the minimum current-run serum across all three splice consoles', () => {
    let state = genesisEntry();
    state = collectReward(atGenesisNode(state, 'first_splice_console'));
    expect(game.getNodeDepartureBlock(state)).toEqual({
      kind: 'genesis_splice',
      message: '原型拼接尚未完成，请先选择武力、术法、守御或复生基因。'
    });
    expect(game.moveToNode(state, 'bloodline_survey_archive').run?.currentNodeId).toBe('first_splice_console');
    state = game.resolveGenesisSplice(state, 'force');
    expect(state.log[0]).toContain('消耗原型血清 0 支，本轮剩余 1 支');

    state = collectReward(atGenesisNode(state, 'second_splice_console'));
    state = game.resolveGenesisSplice(state, 'force');
    expect(state.log[0]).toContain('消耗原型血清 1 支，本轮剩余 1 支');

    state = collectReward(atGenesisNode(state, 'third_splice_console'));
    state = game.resolveGenesisSplice(state, 'force');
    expect(state.log[0]).toContain('消耗原型血清 2 支，本轮剩余 0 支');
    expect(state.run?.lootBag.items.genesis_serum ?? 0).toBe(0);
    expect(state.inventory.genesis_serum).toBe(20);
    expect(game.getCurrentGenesisSpliceStatus(state)).toMatchObject({
      pending: false, allResolved: true, spliceSequence: ['force', 'force', 'force']
    });
  });

  it('keeps illegal, nonpending, bank-only, and mismatched serum splice attempts fully unchanged', () => {
    const firstPending = collectReward(atGenesisNode(genesisEntry(), 'first_splice_console'));
    const firstResolved = game.resolveGenesisSplice(firstPending, 'force');
    expect(game.resolveGenesisSplice(firstResolved, 'art')).toBe(firstResolved);

    const secondPending = collectReward(atGenesisNode(firstResolved, 'second_splice_console'));
    if (!secondPending.run) throw new Error('Expected pending splice run');
    const bankOnly: GameState = {
      ...secondPending,
      inventory: { ...secondPending.inventory, genesis_serum: 99 },
      run: {
        ...secondPending.run,
        lootBag: { ...secondPending.run.lootBag, items: { ...secondPending.run.lootBag.items, genesis_serum: 0 } }
      }
    };
    expect(game.getCurrentGenesisSpliceStatus(bankOnly)).toMatchObject({
      availableGenesisSerum: 0,
      choices: { force: { available: false, serumCost: 1 } }
    });
    expect(game.resolveGenesisSplice(bankOnly, 'force')).toBe(bankOnly);

    const inventoryShort: GameState = {
      ...secondPending,
      inventory: { ...secondPending.inventory, genesis_serum: 0 },
      run: {
        ...secondPending.run,
        lootBag: { ...secondPending.run.lootBag, items: { ...secondPending.run.lootBag.items, genesis_serum: 2 } }
      }
    };
    expect(game.getCurrentGenesisSpliceStatus(inventoryShort)?.availableGenesisSerum).toBe(0);
    expect(game.resolveGenesisSplice(inventoryShort, 'force')).toBe(inventoryShort);
    expect(game.resolveGenesisSplice(secondPending, 'unknown' as game.GenesisGene)).toBe(secondPending);
  });

  it('wires all entry gear and the frozen bloodline into the boss genome snapshot and law modifiers', () => {
    let state = genesisEntry(
      ['helix_cleaver', 'symbiote_cowl', 'carapace_harness', 'rebirth_amulet'],
      'titan_marrow',
      3
    );
    expect(state.run?.lawState?.law).toMatchObject({
      kind: 'genesis_vault',
      entryGear: { helixCleaver: true, symbioteCowl: true, carapaceHarness: true, rebirthAmulet: true },
      entryBloodline: { aspect: 'force', rank: 3 }
    });

    for (const nodeId of ['first_splice_console', 'second_splice_console', 'third_splice_console'] as const) {
      state = collectReward(atGenesisNode(state, nodeId));
      state = game.resolveGenesisSplice(state, 'force');
    }
    const boss = selectNode(atGenesisNode(state, 'primal_curator'), 'primal_curator');
    expect(boss.run?.lawState?.law).toMatchObject({
      kind: 'genesis_vault', bossGenomeSnapshot: ['force', 'force', 'force']
    });
    expect(game.getCurrentDungeonLaw(boss)?.modifiers).toMatchObject({
      encounter: { defensePercent: 4 }, outgoingDamage: { forcePercent: 18 }
    });
    const awakened = { ...boss, combat: boss.combat ? { ...boss.combat, bossPhase: 'awakened' as const } : boss.combat };
    expect(game.getCurrentDungeonLaw(awakened)?.modifiers).toMatchObject({
      encounter: { defensePercent: 7 }, outgoingDamage: { forcePercent: 20 }
    });
  });

  it('passes the live genesis law state into directive display and exit settlement', () => {
    let state = genesisEntry([], 'void_symbiote', 2);
    const genes = ['force', 'art', 'guard'] as const;
    for (const [index, nodeId] of ['first_splice_console', 'second_splice_console', 'third_splice_console'].entries()) {
      state = collectReward(atGenesisNode(state, nodeId));
      state = game.resolveGenesisSplice(state, genes[index]!);
    }

    const evaluation = game.getDirectiveEvaluation(state);
    expect(evaluation.objectiveResults.find((result) => result.id === 'genesis_vault_three_splices_two_genes')?.completed).toBe(true);
    expect(evaluation.objectiveResults.find((result) => result.id === 'genesis_vault_active_bloodline')?.completed).toBe(true);
    if (!state.run) throw new Error('Expected directive genesis run');

    const exitReady: GameState = {
      ...state,
      completedDungeonIds: state.completedDungeonIds.filter((dungeonId) => dungeonId !== 'genesis_vault'),
      run: {
        ...state.run,
        currentNodeId: 'genesis_exit',
        damageTaken: 0,
        clearedNodeIds: [
          ...state.run.clearedNodeIds,
          'primal_curator',
          'genesis_gate',
          'lower_serum_supply',
          'lineage_event_stage',
          'genome_repair_station'
        ]
      }
    };
    const exited = resolveExit(exitReady);
    expect(exited.claimedDirectiveIds).toContain('directive_genesis_vault');
  });
});

describe('entropy ark game integration', () => {
  it('freezes all three entropy passives on entry and ignores later loadout changes', () => {
    const entered = createEntropyEntryState([
      'entropy_compass',
      'dissipation_mantle',
      'ark_keel_boots'
    ]);
    const law = entered.run?.lawState?.law;
    expect(law?.kind).toBe('entropy_ark');
    if (law?.kind !== 'entropy_ark') throw new Error('Expected entropy law');
    expect(law.entryPassives).toEqual({
      entropyCompass: true,
      dissipationMantle: true,
      arkKeelBoots: true
    });

    const changedAfterEntry: GameState = {
      ...entered,
      equipped: {
        ...entered.equipped,
        charm: 'plain_charm',
        armor: 'patched_coat',
        feet: 'patched_boots'
      }
    };
    const afterDanger = clearEntropyMonster(changedAfterEntry, 'entropy_deckhand');
    expect(game.getCurrentEntropyHeadingStatus(afterDanger)?.entropy).toBe(2);
    expect(afterDanger.run?.lawState?.law).toMatchObject({
      entryPassives: {
        entropyCompass: true,
        dissipationMantle: true,
        arkKeelBoots: true
      },
      compassCreditUsed: true
    });
  });

  it('raises entropy on ordinary danger and lets the compass waive that increase exactly once', () => {
    const plain = clearEntropyMonster(createEntropyEntryState(), 'entropy_deckhand');
    expect(game.getCurrentEntropyHeadingStatus(plain)?.entropy).toBe(3);

    const compassFirst = clearEntropyMonster(
      createEntropyEntryState(['entropy_compass']),
      'entropy_deckhand'
    );
    expect(game.getCurrentEntropyHeadingStatus(compassFirst)?.entropy).toBe(2);
    const compassSecond = clearEntropyMonster(compassFirst, 'entropy_deckhand_port');
    expect(game.getCurrentEntropyHeadingStatus(compassSecond)?.entropy).toBe(3);
  });

  it('opens heading on console reward and blocks real movement until a choice is made', () => {
    const pending = collectReward(atEntropyNode(createEntropyEntryState(), 'bow_heading_console'));
    expect(game.getCurrentEntropyHeadingStatus(pending)).toMatchObject({
      pending: true,
      pendingHeadingNodeId: 'bow_heading_console',
      entropy: 2
    });
    expect(game.getNodeDepartureBlock(pending)).toEqual({
      kind: 'entropy_heading',
      message: '方舟航向尚未指定，请先选择稳航或抢航。'
    });

    const blocked = game.moveToNode(pending, 'dissipation_navigator_alpha');
    expect(blocked.run?.currentNodeId).toBe('bow_heading_console');
    expect(blocked.log[0]).toContain('先选择稳航或抢航');
  });

  it('applies exact steady, rush, and mantle deltas without economy or HP effects', () => {
    const pending = collectReward(atEntropyNode(createEntropyEntryState(), 'bow_heading_console'));
    const rewardBefore = pending.rewardPoints;
    const hpBefore = pending.player.hp;
    const steady = game.resolveEntropyHeading(pending, 'steady');
    expect(game.getCurrentEntropyHeadingStatus(steady)).toMatchObject({ pending: false, entropy: 1 });
    expect(steady.rewardPoints).toBe(rewardBefore);
    expect(steady.player.hp).toBe(hpBefore);
    expect(steady.log[0]).toContain('稳航：熵值 -1，当前熵值 1/4');

    const rushPending = collectReward(atEntropyNode(createEntropyEntryState(), 'stern_heading_console'));
    const rush = game.resolveEntropyHeading(rushPending, 'rush');
    expect(game.getCurrentEntropyHeadingStatus(rush)).toMatchObject({ pending: false, entropy: 3 });
    expect(rush.log[0]).toContain('抢航：熵值 +1，当前熵值 3/4');

    const mantlePending = collectReward(atEntropyNode(
      createEntropyEntryState(['dissipation_mantle']),
      'midship_heading_console'
    ));
    const mantleSteady = game.resolveEntropyHeading(mantlePending, 'steady');
    expect(game.getCurrentEntropyHeadingStatus(mantleSteady)?.entropy).toBe(0);
    expect(mantleSteady.log[0]).toContain('稳航：熵值 -2，当前熵值 0/4');
  });

  it('rejects boundary, duplicate, invalid, and out-of-phase choices without changing domain state', () => {
    const zeroPending = withEntropy(
      collectReward(atEntropyNode(createEntropyEntryState(), 'bow_heading_console')),
      0
    );
    const rejectedSteady = game.resolveEntropyHeading(zeroPending, 'steady');
    expect(rejectedSteady.run).toEqual(zeroPending.run);
    expect(rejectedSteady.log[0]).toContain('熵值已达 0/4');

    const fourPending = withEntropy(
      collectReward(atEntropyNode(createEntropyEntryState(), 'stern_heading_console')),
      4
    );
    const rejectedRush = game.resolveEntropyHeading(fourPending, 'rush');
    expect(rejectedRush.run).toEqual(fourPending.run);
    expect(rejectedRush.log[0]).toContain('熵值已达 4/4');

    const settled = game.resolveEntropyHeading(
      collectReward(atEntropyNode(createEntropyEntryState(), 'midship_heading_console')),
      'steady'
    );
    const repeated = game.resolveEntropyHeading(settled, 'steady');
    expect(repeated.run).toEqual(settled.run);
    expect(repeated.log[0]).toContain('当前没有待指定');

    const invalid = game.resolveEntropyHeading(
      collectReward(atEntropyNode(createEntropyEntryState(), 'bow_heading_console')),
      'invalid' as game.EntropyHeadingChoice
    );
    expect(invalid.log[0]).toContain('这个航向选项不存在');

    const hub = createInitialState();
    const outOfPhase = game.resolveEntropyHeading(hub, 'steady');
    expect(outOfPhase.player).toEqual(hub.player);
    expect(outOfPhase.run).toBeUndefined();
    expect(game.getCurrentEntropyHeadingStatus(outOfPhase)).toBeUndefined();
  });

  it('locks normal and keel-boot collapse layers at real Boss engagement and keeps them after action', () => {
    const engage = (equipmentIds: readonly EquipmentId[]) => {
      const selected = selectNode(
        atEntropyNode(withEntropy(createEntropyEntryState(equipmentIds), 4), 'last_helmsman'),
        'last_helmsman'
      );
      if (!selected.combat) throw new Error('Expected entropy boss combat');
      return {
        selected,
        acted: performCombatAction({
          ...selected,
          player: { ...selected.player, hp: 1_000, maxHp: 1_000 },
          combat: { ...selected.combat, monsterHp: 1_000 }
        }, 'attack')
      };
    };

    const plain = engage([]);
    expect(game.getCurrentDungeonLaw(plain.selected)?.state.law).toMatchObject({
      bossEntropyLocked: true,
      collapseLayers: 2
    });
    expect(game.getCurrentDungeonLaw(plain.acted)?.state.law).toMatchObject({
      bossEntropyLocked: true,
      collapseLayers: 2
    });

    const boots = engage(['ark_keel_boots']);
    expect(game.getCurrentDungeonLaw(boots.selected)?.state.law).toMatchObject({
      bossEntropyLocked: true,
      collapseLayers: 1
    });
    expect(game.getCurrentDungeonLaw(boots.acted)?.state.law).toMatchObject({
      bossEntropyLocked: true,
      collapseLayers: 1
    });
  });

  it('freezes entropy passives when a portal enters the ark', () => {
    const source = createCausalEntryState([
      'entropy_compass',
      'dissipation_mantle',
      'ark_keel_boots'
    ]);
    const portal = DUNGEONS.causal_clearinghouse.nodes.find(
      (node) => node.portal?.targetDungeonId === 'entropy_ark'
    );
    if (!portal) throw new Error('Expected causal-to-entropy portal');
    const transported = usePortal({
      ...source,
      run: source.run ? { ...source.run, currentNodeId: portal.id } : source.run
    }, 'force');
    expect(transported.run?.dungeonId).toBe('entropy_ark');
    expect(transported.run?.lawState?.law).toMatchObject({
      kind: 'entropy_ark',
      entryPassives: {
        entropyCompass: true,
        dissipationMantle: true,
        arkKeelBoots: true
      }
    });
  });

  it('normalizes malformed pending law locally and resolves node-mismatched saves without deadlock', () => {
    const pending = collectReward(atEntropyNode(createEntropyEntryState(), 'bow_heading_console'));
    const mismatched = atEntropyNode(pending, 'dissipation_navigator_alpha');
    expect(game.getNodeDepartureBlock(mismatched)?.kind).toBe('entropy_heading');
    const unlocked = game.resolveEntropyHeading(mismatched, 'rush');
    expect(game.getCurrentEntropyHeadingStatus(unlocked)).toMatchObject({ pending: false, entropy: 3 });

    if (!pending.run?.lawState) throw new Error('Expected entropy law state');
    const malformed: GameState = {
      ...pending,
      run: {
        ...pending.run,
        lawState: {
          ...pending.run.lawState,
          clearedNodeIds: ['ark_gate'],
          law: {
            kind: 'entropy_ark',
            entropy: 'broken',
            pendingHeadingNodeId: 'bow_heading_console',
            resolvedHeadingChoices: { broken: 'sideways' },
            entryPassives: { dissipationMantle: true }
          }
        } as unknown as DungeonLawState
      }
    };
    const normalized = game.resolveEntropyHeading(malformed, 'steady');
    expect(game.getCurrentEntropyHeadingStatus(normalized)).toMatchObject({ pending: false, entropy: 0 });
    expect(normalized.run?.lawState?.clearedNodeIds).toEqual(['ark_gate']);
    expect(normalized.run?.lawState?.law).toMatchObject({
      entryPassives: {
        entropyCompass: false,
        dissipationMantle: true,
        arkKeelBoots: false
      },
      resolvedHeadingChoices: { bow_heading_console: 'steady' }
    });

    const ordinary = collectReward(createEntropyEntryState());
    expect(game.getCurrentEntropyHeadingStatus(ordinary)?.pending).toBe(false);
    expect(game.moveToNode(ordinary, 'entropy_deckhand').run?.currentNodeId).toBe('entropy_deckhand');
  });
});

describe('mirror cycle city game integration', () => {
  it('defines the drop-only material and exact Tier-11 equipment economy', () => {
    expect(ITEMS.phase_glass).toMatchObject({
      id: 'phase_glass',
      name: '相位镜晶',
      kind: 'material'
    });
    expect(ITEMS.phase_glass.cost).toBeUndefined();
    const rejected = buyItem(createInitialState(), 'phase_glass');
    expect(rejected.inventory.phase_glass).toBe(0);
    expect(rejected.log[0]).toContain('只能在副本中获得');

    expect(EQUIPMENT.parallax_visor).toMatchObject({
      name: '视差面甲',
      slot: 'head',
      cost: { rewardPoints: 980, lingyun: 3, items: { phase_glass: 1, chronal_glass: 1 } },
      base: { spirit: 2, defense: 4, trapCheck: 6 },
      perLevel: { artPower: 3, defense: 1, trapCheck: 2 },
      maxLevel: 3
    });
    expect(EQUIPMENT.phaseweave_mantle).toMatchObject({
      name: '相织披风',
      slot: 'armor',
      cost: { rewardPoints: 1000, lingyun: 3, items: { phase_glass: 1, rift_dust: 1 } },
      base: { maxHp: 40, artPower: 6, defense: 9 },
      perLevel: { maxHp: 14, artPower: 2, defense: 3 },
      maxLevel: 3
    });
    expect(EQUIPMENT.homecoming_prism).toMatchObject({
      name: '归真棱镜',
      slot: 'charm',
      cost: { rewardPoints: 1020, lingyun: 3, items: { phase_glass: 1, star_iron: 1 } },
      base: { spirit: 2, artPower: 14, defense: 4 },
      perLevel: { artPower: 6, defense: 1 },
      maxLevel: 3
    });
  });

  it('freezes all three entry passives and keeps the visor limited to wrong-phase penalties', () => {
    const entered = createMirrorCityEntryState([
      'parallax_visor',
      'phaseweave_mantle',
      'homecoming_prism'
    ]);
    expect(entered.run?.lawState?.law).toMatchObject({
      kind: 'mirror_cycle_city',
      entryPassives: {
        parallaxVisor: true,
        phaseweaveMantle: true,
        homecomingPrism: true
      }
    });
    expect(game.getCurrentDungeonLaw(entered)?.modifiers.outgoingDamage).toEqual({
      forcePercent: 12,
      artPercent: 0
    });

    const unequippedAfterEntry: GameState = {
      ...entered,
      equipped: {
        ...entered.equipped,
        head: 'patched_headwrap',
        armor: 'patched_coat',
        charm: 'plain_charm'
      }
    };
    const mirrored = resolveMirrorChoice(unequippedAfterEntry, 'first_phase_mirror', 'mirror');
    expect(game.getCurrentDungeonLaw(mirrored)?.modifiers.outgoingDamage).toEqual({
      forcePercent: 0,
      artPercent: 12
    });

    const plain = createMirrorCityEntryState();
    expect(game.getCurrentDungeonLaw(plain)?.modifiers.outgoingDamage).toEqual({
      forcePercent: 12,
      artPercent: -6
    });
  });

  it('charges exact transition HP, applies the mantle reduction, and always leaves a safe legal choice', () => {
    const plainEntry = createMirrorCityEntryState();
    const pendingPlain = collectReward(atMirrorCityNode({
      ...plainEntry,
      player: { ...plainEntry.player, hp: 1_000, maxHp: 1_000 }
    }, 'first_phase_mirror'));
    const plain = game.resolveMirrorCityPhase(pendingPlain, 'mirror');
    expect(plain.player.hp).toBe(900);
    expect(plain.log[0]).toContain('最大生命 10%');

    const mantleEntry = createMirrorCityEntryState(['phaseweave_mantle']);
    const mantlePending = collectReward(atMirrorCityNode({
      ...mantleEntry,
      player: { ...mantleEntry.player, hp: 1_000, maxHp: 1_000 }
    }, 'first_phase_mirror'));
    const mantle = game.resolveMirrorCityPhase(mantlePending, 'mirror');
    expect(mantle.player.hp).toBe(950);
    expect(mantle.log[0]).toContain('最大生命 5%');

    const lowHpEntry = createMirrorCityEntryState();
    const lowHpPending = collectReward(atMirrorCityNode({
      ...lowHpEntry,
      player: { ...lowHpEntry.player, hp: 100, maxHp: 1_000 }
    }, 'first_phase_mirror'));
    expect(game.getCurrentMirrorCityPhaseStatus(lowHpPending)?.choices).toMatchObject({
      real: { available: true, damagePercent: 0 },
      mirror: { available: false, damagePercent: 10 }
    });
    const rejected = game.resolveMirrorCityPhase(lowHpPending, 'mirror');
    expect(rejected.player.hp).toBe(100);
    expect(game.getCurrentMirrorCityPhaseStatus(rejected)?.pending).toBe(true);
    const safe = game.resolveMirrorCityPhase(rejected, 'real');
    expect(safe.player.hp).toBe(100);
    expect(game.getCurrentMirrorCityPhaseStatus(safe)?.pending).toBe(false);
  });

  it('blocks ordinary movement non-modally until each phase reward is resolved', () => {
    const pending = collectReward(atMirrorCityNode(createMirrorCityEntryState(), 'first_phase_mirror'));
    const pressureBefore = pending.run?.pressureState;
    const pursuitBefore = pending.run?.pursuitState;
    expect(game.getNodeDepartureBlock(pending)).toEqual({
      kind: 'mirror_phase',
      message: '镜城相位尚未指定，请先选择现实或镜像。'
    });

    const blocked = game.moveToNode(pending, 'real_relic_gallery');
    expect(blocked.phase).toBe('explore');
    expect(blocked.run?.currentNodeId).toBe('first_phase_mirror');
    const resolved = game.resolveMirrorCityPhase(blocked, 'real');
    expect(resolved.run?.pressureState).toEqual(pressureBefore);
    expect(resolved.run?.pursuitState).toEqual(pursuitBefore);
    expect(game.moveToNode(resolved, 'real_relic_gallery').run?.currentNodeId).toBe('real_relic_gallery');
  });

  it('credits anchors only in their matching phase and snapshots them when the reachable Boss starts', () => {
    const missingAnchors = prepareMirrorBoss();
    const missingLaw = missingAnchors.run?.lawState?.law;
    expect(missingLaw).toMatchObject({
      kind: 'mirror_cycle_city',
      anchors: { real: false, mirror: false },
      bossAnchorSnapshot: { real: false, mirror: false }
    });
    if (!missingAnchors.run?.lawState) throw new Error('Expected mirror law state');
    expect(getMirrorCityShellStatus(missingAnchors.run.lawState)).toMatchObject({
      anchoredPhaseCount: 0,
      prismCredit: 0,
      totalShells: 2,
      remainingShells: 2
    });

    let wrong = createMirrorCityEntryState();
    wrong = resolveMirrorChoice(wrong, 'first_phase_mirror', 'mirror');
    wrong = collectReward(atMirrorCityNode(wrong, 'real_anchor'));
    expect(game.getCurrentMirrorCityPhaseStatus(wrong)?.anchors.real).toBe(false);

    const both = prepareMirrorBoss([], ['real', 'mirror']);
    expect(both.run?.lawState?.law).toMatchObject({
      anchors: { real: true, mirror: true },
      bossAnchorSnapshot: { real: true, mirror: true }
    });
    expect(getMirrorCityShellStatus(both.run!.lawState!)).toMatchObject({
      anchoredPhaseCount: 2,
      totalShells: 0
    });

    const prism = prepareMirrorBoss(['homecoming_prism'], ['real']);
    expect(getMirrorCityShellStatus(prism.run!.lawState!)).toMatchObject({
      anchoredPhaseCount: 1,
      prismCredit: 1,
      totalShells: 0
    });
  });

  it('consumes one shell only on positive Boss damage, halves that hit, and preserves shells through awakening', () => {
    const boss = prepareMirrorBoss([], [], ['healing_pill']);
    if (!boss.combat || !boss.run?.lawState) throw new Error('Expected mirror boss state');
    const durable: GameState = {
      ...boss,
      player: { ...boss.player, hp: 980, maxHp: 1_000 },
      combat: { ...boss.combat, monsterHp: 1_000 }
    };
    const guarded = performCombatAction(durable, 'guard');
    expect(getMirrorCityShellStatus(guarded.run!.lawState!).brokenMirrorShells).toBe(0);
    const healed = performCombatAction(durable, 'use_healing_pill');
    expect(getMirrorCityShellStatus(healed.run!.lawState!).brokenMirrorShells).toBe(0);

    const noShellLaw: DungeonLawState = {
      ...durable.run!.lawState!,
      law: {
        ...(durable.run!.lawState!.law as Extract<DungeonLawState['law'], { kind: 'mirror_cycle_city' }>),
        brokenMirrorShells: 2
      }
    };
    const noShell: GameState = {
      ...durable,
      run: { ...durable.run!, lawState: noShellLaw }
    };
    const baselineHit = performCombatAction(noShell, 'attack');
    const shelledHit = performCombatAction(durable, 'attack');
    const baselineDamage = 1_000 - (baselineHit.combat?.monsterHp ?? 1_000);
    const shelledDamage = 1_000 - (shelledHit.combat?.monsterHp ?? 1_000);
    expect(shelledDamage).toBe(Math.max(1, Math.floor(baselineDamage * 0.5)));
    expect(getMirrorCityShellStatus(shelledHit.run!.lawState!)).toMatchObject({
      brokenMirrorShells: 1,
      remainingShells: 1
    });
    expect(shelledHit.combat?.log.some((line) => line.includes('镜壳') && line.includes('减半'))).toBe(true);

    const profile = game.getCombatEncounterProfile(boss);
    if (!profile?.boss) throw new Error('Expected mirror boss profile');
    const threshold = Math.floor(profile.monster.maxHp / 2);
    const awakeningStart: GameState = {
      ...boss,
      player: { ...boss.player, hp: 1_000, maxHp: 1_000 },
      combat: { ...boss.combat, monsterHp: threshold + shelledDamage }
    };
    const awakened = performCombatAction(awakeningStart, 'attack');
    expect(awakened.combat?.bossPhase).toBe('awakened');
    expect(getMirrorCityShellStatus(awakened.run!.lawState!)).toMatchObject({
      brokenMirrorShells: 1,
      remainingShells: 1
    });
    const secondHit = performCombatAction(awakened, 'attack');
    expect(getMirrorCityShellStatus(secondHit.run!.lawState!)).toMatchObject({
      brokenMirrorShells: 2,
      remainingShells: 0
    });
  });

  it('creates a fresh mirror-law equipment snapshot after a portal transfer', () => {
    const source = createEntropyEntryState([
      'parallax_visor',
      'phaseweave_mantle',
      'homecoming_prism'
    ]);
    const portal = DUNGEONS.entropy_ark.nodes.find(
      (node) => node.portal?.targetDungeonId === 'mirror_cycle_city'
    );
    if (!portal) throw new Error('Expected entropy-to-mirror portal');
    const transported = usePortal({
      ...source,
      player: { ...source.player, hp: 1_000, maxHp: 1_000 },
      run: source.run ? { ...source.run, currentNodeId: portal.id } : source.run
    }, 'force');
    expect(transported.run?.dungeonId).toBe('mirror_cycle_city');
    expect(transported.run?.lawState?.law).toMatchObject({
      kind: 'mirror_cycle_city',
      entryPassives: {
        parallaxVisor: true,
        phaseweaveMantle: true,
        homecomingPrism: true
      }
    });
  });
});

describe('redaction scriptorium game integration', () => {
  it('exposes the drop-only ink and exact Tier-12 equipment contracts', () => {
    const initial = createInitialState();
    expect(initial.inventory.redaction_ink).toBe(0);
    expect(ITEMS.redaction_ink).toMatchObject({
      id: 'redaction_ink',
      name: '删界墨',
      kind: 'material'
    });
    expect(ITEMS.redaction_ink.cost).toBeUndefined();

    expect(EQUIPMENT.redline_edge).toMatchObject({
      id: 'redline_edge',
      name: '朱批断章刃',
      slot: 'weapon',
      cost: { rewardPoints: 1100, lingyun: 4, items: { redaction_ink: 1, phase_glass: 1 } },
      base: { attack: 20, artPower: 6 },
      perLevel: { attack: 6, artPower: 2 }
    });
    expect(EQUIPMENT.palimpsest_mantle).toMatchObject({
      id: 'palimpsest_mantle',
      name: '覆页披甲',
      slot: 'armor',
      cost: { rewardPoints: 1080, lingyun: 4, items: { redaction_ink: 1, rift_dust: 1 } },
      base: { maxHp: 44, artPower: 7, defense: 10 },
      perLevel: { maxHp: 15, artPower: 2, defense: 3 }
    });
    expect(EQUIPMENT.final_proof_seal).toMatchObject({
      id: 'final_proof_seal',
      name: '终校印玺',
      slot: 'charm',
      cost: { rewardPoints: 1120, lingyun: 4, items: { redaction_ink: 1, star_iron: 1 } },
      base: { spirit: 2, artPower: 16, defense: 5 },
      perLevel: { artPower: 6, defense: 2 }
    });
  });

  it('freezes all three equipment passives on entry and ignores later loadout changes', () => {
    const entered = createRedactionEntryState([
      'redline_edge',
      'palimpsest_mantle',
      'final_proof_seal'
    ]);
    expect(entered.run?.lawState?.law).toMatchObject({
      kind: 'redaction_scriptorium',
      entryPassives: {
        redlineEdge: true,
        palimpsestMantle: true,
        finalProofSeal: true
      }
    });

    const changedAfterEntry: GameState = {
      ...entered,
      equipped: {
        ...entered.equipped,
        weapon: 'training_blade',
        armor: 'patched_coat',
        charm: 'plain_charm'
      }
    };
    const pending = collectReward(atRedactionNode(changedAfterEntry, 'body_clause_desk'));
    const certified = game.resolveRedactionClause(pending, 'certify');
    expect(game.getCurrentRedactionClauseStatus(certified)?.projectedBossEffects.sealed.defensePercent).toBe(5);
    expect(certified.run?.lawState?.law).toMatchObject({
      entryPassives: {
        redlineEdge: true,
        palimpsestMantle: true,
        finalProofSeal: true
      }
    });
  });

  it('charges floor eight-percent HP with a nonzero minimum and keeps certify legal', () => {
    const base = createRedactionEntryState();
    const pending = collectReward(atRedactionNode({
      ...base,
      player: { ...base.player, hp: 101, maxHp: 101 }
    }, 'body_clause_desk'));
    expect(game.getCurrentRedactionClauseStatus(pending)).toMatchObject({
      pending: true,
      pendingClauseNodeId: 'body_clause_desk',
      choices: {
        certify: { available: true, costPercent: 0 },
        redact: { available: true, costPercent: 8 }
      }
    });
    const redacted = game.resolveRedactionClause(pending, 'redact');
    expect(redacted.player.hp).toBe(93);
    expect(game.getCurrentRedactionClauseStatus(redacted)).toMatchObject({
      pending: false,
      resolvedClauseChoices: { body_clause_desk: 'redact' }
    });

    const minimumPending = collectReward(atRedactionNode({
      ...createRedactionEntryState(),
      player: { ...base.player, hp: 2, maxHp: 7 }
    }, 'memory_clause_desk'));
    expect(game.resolveRedactionClause(minimumPending, 'redact').player.hp).toBe(1);

    const lethalPending = collectReward(atRedactionNode({
      ...createRedactionEntryState(),
      player: { ...base.player, hp: 1, maxHp: 7 }
    }, 'return_clause_desk'));
    expect(game.getCurrentRedactionClauseStatus(lethalPending)?.choices).toMatchObject({
      certify: { available: true },
      redact: { available: false, unavailableReason: '当前生命不足以支付删改代价。' }
    });
    const rejected = game.resolveRedactionClause(lethalPending, 'redact');
    expect(rejected.player.hp).toBe(1);
    expect(game.getCurrentRedactionClauseStatus(rejected)?.pending).toBe(true);
    const certified = game.resolveRedactionClause(rejected, 'certify');
    expect(certified.player.hp).toBe(1);
    expect(game.getCurrentRedactionClauseStatus(certified)?.pending).toBe(false);
  });

  it('blocks movement only while a clause is pending and resolves without advancing run systems', () => {
    const pending = collectReward(atRedactionNode(createRedactionEntryState(), 'body_clause_desk'));
    const pressureBefore = pending.run?.pressureState;
    const pursuitBefore = pending.run?.pursuitState;
    expect(game.getNodeDepartureBlock(pending)).toEqual({
      kind: 'redaction_clause',
      message: '终稿条款尚未裁定，请先选择认证或删改。'
    });

    const blocked = game.moveToNode(pending, 'severed_sentence_trap');
    expect(blocked.phase).toBe('explore');
    expect(blocked.run?.currentNodeId).toBe('body_clause_desk');
    const resolved = game.resolveRedactionClause(blocked, 'certify');
    expect(resolved.run?.pressureState).toEqual(pressureBefore);
    expect(resolved.run?.pursuitState).toEqual(pursuitBefore);
    expect(resolved.run?.clearedNodeIds).toEqual(pending.run?.clearedNodeIds);
    expect(game.moveToNode(resolved, 'severed_sentence_trap').run?.currentNodeId).toBe(
      'severed_sentence_trap'
    );
  });

  it('creates fresh law and equipment-passive snapshots on entry and cross-dungeon portals', () => {
    const direct = createRedactionEntryState(['redline_edge']);
    expect(direct.run?.lawState?.law).toMatchObject({
      kind: 'redaction_scriptorium',
      entryPassives: { redlineEdge: true, palimpsestMantle: false, finalProofSeal: false }
    });

    const mirrorBase = createMirrorCityEntryState();
    const liveTierTwelveLoadout: GameState = {
      ...mirrorBase,
      player: { ...mirrorBase.player, hp: 1_000, maxHp: 1_000 },
      equipped: {
        ...mirrorBase.equipped,
        weapon: 'redline_edge',
        armor: 'palimpsest_mantle',
        charm: 'final_proof_seal'
      }
    };
    const transportedLawStates: DungeonLawState[] = [];
    for (const [portalNodeId, targetNodeId] of [
      ['upper_return_portal', 'folio_gate'],
      ['lower_return_portal', 'lower_supply_margin']
    ] as const) {
      const transported = usePortal(atRedactionNode(liveTierTwelveLoadout, portalNodeId), 'force');
      expect(transported.run?.dungeonId).toBe('redaction_scriptorium');
      expect(transported.run?.currentNodeId).toBe(targetNodeId);
      expect(transported.run?.lawState?.law).toMatchObject({
        kind: 'redaction_scriptorium',
        pendingClauseNodeId: null,
        resolvedClauseChoices: {},
        entryPassives: {
          redlineEdge: true,
          palimpsestMantle: true,
          finalProofSeal: true
        }
      });
      if (transported.run?.lawState) transportedLawStates.push(transported.run.lawState);
    }
    expect(transportedLawStates).toHaveLength(2);
    expect(transportedLawStates[0]).not.toBe(transportedLawStates[1]);

    const outgoing = usePortal(atRedactionNode({
      ...direct,
      player: { ...direct.player, hp: 1_000, maxHp: 1_000 }
    }, 'upper_revision_portal'), 'force');
    expect(outgoing.run?.dungeonId).toBe('legacy_auction_court');
    expect(outgoing.run?.currentNodeId).toBe('estate_gate');
    expect(outgoing.run?.lawState).not.toBe(direct.run?.lawState);
    expect(outgoing.run?.lawState).toEqual(createDungeonLawState('legacy_auction_court'));
  });

  it('applies the frozen certified-clause multipliers again at their awakened values', () => {
    let state = createRedactionEntryState();
    for (const nodeId of ['body_clause_desk', 'memory_clause_desk', 'return_clause_desk'] as const) {
      state = collectReward(atRedactionNode(state, nodeId));
      state = game.resolveRedactionClause(state, 'certify');
    }

    const started = selectNode(atRedactionNode(state, 'last_redactor'), 'last_redactor');
    const sealedProfile = game.getCombatEncounterProfile(started);
    expect(game.getCurrentDungeonLaw(started)?.modifiers).toMatchObject({
      encounter: { defensePercent: 10, artPowerPercent: 10 },
      healingPercent: -10,
      guardEffectPercent: -10
    });

    const awakened: GameState = {
      ...started,
      combat: started.combat ? { ...started.combat, bossPhase: 'awakened' } : started.combat
    };
    const awakenedProfile = game.getCombatEncounterProfile(awakened);
    expect(game.getCurrentDungeonLaw(awakened)?.modifiers).toMatchObject({
      encounter: { defensePercent: 20, artPowerPercent: 20 },
      healingPercent: -20,
      guardEffectPercent: -20
    });
    expect(awakenedProfile?.monster.defense).toBeGreaterThan(sealedProfile?.monster.defense ?? 0);
    expect(awakenedProfile?.monster.artPower).toBeGreaterThan(sealedProfile?.monster.artPower ?? 0);
  });
});

describe('legacy auction court game integration', () => {
  it('keeps legacy scrip drop-only and freezes all four equipment passives on entry', () => {
    const initial = createInitialState();
    expect(initial.inventory.legacy_scrip).toBe(0);
    expect(ITEMS.legacy_scrip).toMatchObject({ id: 'legacy_scrip', name: '遗产筹码', kind: 'material' });
    expect(ITEMS.legacy_scrip.cost).toBeUndefined();

    const entered = createAuctionEntryState([
      'legacy_gavel', 'anonymous_veil', 'escrow_plate', 'final_lot_bell'
    ]);
    expect(entered.run?.lawState?.law).toMatchObject({
      kind: 'legacy_auction_court',
      pendingLotNodeId: null,
      resolvedLotChoices: {},
      entryPassives: {
        legacyGavel: true,
        anonymousVeil: true,
        escrowPlate: true,
        finalLotBell: true
      }
    });
  });

  it('uses only run loot and leaves both law and loot untouched when a paid choice is unaffordable', () => {
    const collected = collectReward(atAuctionNode(createAuctionEntryState(), 'force_lot_dais'));
    if (!collected.run) throw new Error('Expected auction run');
    const pending: GameState = {
      ...collected,
      inventory: { ...collected.inventory, legacy_scrip: 99 },
      run: {
        ...collected.run,
        lootBag: { ...collected.run.lootBag, items: { ...collected.run.lootBag.items, legacy_scrip: 0 } }
      }
    };
    const lawBefore = pending.run?.lawState;
    const lootBefore = pending.run?.lootBag;

    expect(game.getCurrentAuctionLotStatus(pending)).toMatchObject({
      pending: true,
      availableScrip: 0,
      choices: { bid: { available: false, scripCost: 1 }, burn: { available: false, scripCost: 1 }, fold: { available: true, scripCost: 0 } }
    });
    const rejected = game.resolveAuctionLot(pending, 'bid');
    expect(rejected.run?.lawState).toBe(lawBefore);
    expect(rejected.run?.lootBag).toBe(lootBefore);
    expect(rejected.inventory.legacy_scrip).toBe(99);
    expect(game.getCurrentAuctionLotStatus(rejected)?.pending).toBe(true);
  });

  it('consumes the exact returned scrip cost once and blocks only map movement while pending', () => {
    const pending = collectReward(atAuctionNode(createAuctionEntryState(), 'force_lot_dais'));
    expect(game.getNodeDepartureBlock(pending)).toEqual({
      kind: 'auction_lot',
      message: '遗产拍品尚未裁定，请先选择竞得、焚毁或放弃。'
    });
    expect(game.moveToNode(pending, 'hammerfall_trap').run?.currentNodeId).toBe('force_lot_dais');

    const before = pending.run?.lootBag.items.legacy_scrip ?? 0;
    const resolved = game.resolveAuctionLot(pending, 'bid');
    expect(resolved.run?.lootBag.items.legacy_scrip ?? 0).toBe(before - 1);
    expect(resolved.inventory.legacy_scrip).toBe(0);
    expect(resolved.log[0]).toContain(`本轮剩余 ${before - 1}`);
    expect(game.getCurrentAuctionLotStatus(resolved)).toMatchObject({
      pending: false,
      resolvedLotChoices: { force_lot_dais: 'bid' }
    });
    expect(game.moveToNode(resolved, 'hammerfall_trap').run?.currentNodeId).toBe('hammerfall_trap');
  });

  it('banks only retained run scrip at settlement without touching previously durable scrip', () => {
    const entered = createAuctionEntryState();
    if (!entered.run) throw new Error('Expected auction run');
    const readyToExit: GameState = {
      ...atAuctionNode(entered, 'auction_exit'),
      inventory: { ...entered.inventory, legacy_scrip: 5 },
      run: {
        ...entered.run,
        currentNodeId: 'auction_exit',
        clearedNodeIds: ['estate_auctioneer'],
        lootBag: {
          ...entered.run.lootBag,
          items: { ...entered.run.lootBag.items, legacy_scrip: 2 }
        }
      }
    };

    const settled = resolveExit(readyToExit);
    expect(settled.phase).toBe('result');
    expect(settled.run?.lastLootSettlement?.retained.items.legacy_scrip).toBe(2);
    expect(settled.inventory.legacy_scrip).toBe(11);
  });

  it('creates fresh entry and cross-dungeon auction snapshots from the live equipment loadout', () => {
    const equippedIds = ['legacy_gavel', 'anonymous_veil', 'escrow_plate', 'final_lot_bell'] as const;
    const direct = createAuctionEntryState(equippedIds);
    const redaction = createRedactionEntryState();
    const liveLoadout: GameState = {
      ...redaction,
      player: { ...redaction.player, hp: 1_000, maxHp: 1_000 },
      equipped: {
        ...redaction.equipped,
        weapon: 'legacy_gavel',
        head: 'anonymous_veil',
        armor: 'escrow_plate',
        charm: 'final_lot_bell'
      }
    };
    const transported = usePortal(atRedactionNode(liveLoadout, 'upper_revision_portal'), 'force');

    expect(transported.run?.dungeonId).toBe('legacy_auction_court');
    expect(transported.run?.currentNodeId).toBe('estate_gate');
    expect(transported.run?.lawState).not.toBe(redaction.run?.lawState);
    expect(transported.run?.lawState).not.toBe(direct.run?.lawState);
    expect(transported.run?.lawState?.law).toMatchObject({
      kind: 'legacy_auction_court',
      pendingLotNodeId: null,
      resolvedLotChoices: {},
      entryPassives: { legacyGavel: true, anonymousVeil: true, escrowPlate: true, finalLotBell: true }
    });
  });

  it('exposes frozen sealed and awakened boss modifiers through combat context', () => {
    let state = createAuctionEntryState();
    for (const nodeId of ['force_lot_dais', 'guard_lot_dais', 'art_lot_dais', 'return_lot_dais'] as const) {
      state = collectReward(atAuctionNode(state, nodeId));
      state = game.resolveAuctionLot(state, 'fold');
    }
    const started = selectNode(atAuctionNode(state, 'estate_auctioneer'), 'estate_auctioneer');
    const sealedProfile = game.getCombatEncounterProfile(started);
    expect(game.getCurrentDungeonLaw(started)?.modifiers).toMatchObject({
      encounter: { allStatsPercent: 5, artPowerPercent: 10, defensePercent: 10 },
      healingPercent: -10
    });

    const awakened: GameState = {
      ...started,
      combat: started.combat ? { ...started.combat, bossPhase: 'awakened' } : started.combat
    };
    const awakenedProfile = game.getCombatEncounterProfile(awakened);
    expect(game.getCurrentDungeonLaw(awakened)?.modifiers).toMatchObject({
      encounter: { allStatsPercent: 10, artPowerPercent: 18, defensePercent: 18 },
      healingPercent: -18
    });
    expect(awakenedProfile?.monster.attack).toBeGreaterThan(sealedProfile?.monster.attack ?? 0);
    expect(awakenedProfile?.monster.artPower).toBeGreaterThan(sealedProfile?.monster.artPower ?? 0);
    expect(awakenedProfile?.monster.defense).toBeGreaterThan(sealedProfile?.monster.defense ?? 0);
  });
});

describe('run pursuit game integration', () => {
  it('writes an own pursuit snapshot for every entry while preserving first-clear behavior', () => {
    const initial = createInitialState();
    const firstClear = enterDungeon(initial, 'demon_tower_1');
    const replay = createPursuitReplayState();

    expect(initial).not.toHaveProperty('pursuitState');
    expect(firstClear.run).toHaveProperty('pursuitState');
    expect(firstClear.run?.pursuitState?.status).toBe('disabled');
    expect(replay.run).toHaveProperty('pursuitState');
    expect(replay.run?.pursuitState?.status).toBe('dormant');
    expect(game.getCurrentRunPursuit(firstClear)).toMatchObject({
      legacyDisabled: false,
      progress: { status: 'disabled', clearedNodeCount: 0 }
    });
    expect(game.getCurrentRunPursuit(replay)).toMatchObject({
      legacyDisabled: false,
      progress: { status: 'dormant', clearedNodeCount: 0 }
    });
  });

  it('spawns exactly on the sixth non-exit first clear and never backfills legacy runs', () => {
    const dungeon = DUNGEONS.demon_tower_1;
    const fiveNodeIds = dungeon.nodes
      .filter((node) => node.id !== 'sealed_cache' && node.type !== 'exit')
      .slice(0, 5)
      .map((node) => node.id);
    let pressureAtFive: RunPressureState | undefined = createRunPressureState();
    for (let index = 0; index < 5; index += 1) {
      pressureAtFive = advanceRunPressureOnNodeClear(pressureAtFive);
    }
    const dormant = patchPursuitRun(createPursuitReplayState(), {
      currentNodeId: 'sealed_cache',
      clearedNodeIds: fiveNodeIds,
      pressureState: pressureAtFive,
      pursuitState: game.createRunPursuitState('demon_tower_1', true)
    });
    const spawned = collectReward(dormant);
    const repeated = collectReward(spawned);

    expect(spawned.run?.clearedNodeIds).toHaveLength(6);
    expect(spawned.run?.pressureState?.clearedNodeCount).toBe(6);
    expect(spawned.run?.pursuitState).toMatchObject({
      status: 'stalking',
      nodeId: game.RUN_PURSUIT_CATALOG.demon_tower_1.spawnNodeId
    });
    expect(spawned.log.filter((line) => line.includes('已在') && line.includes('现身'))).toHaveLength(1);
    expect(repeated.run?.pursuitState).toEqual(spawned.run?.pursuitState);
    expect(repeated.run?.clearedNodeIds).toHaveLength(6);

    const legacyRun = patchPursuitRun(createPursuitReplayState(), {
      currentNodeId: 'sealed_cache',
      clearedNodeIds: fiveNodeIds,
      pressureState: pressureAtFive
    });
    if (!legacyRun.run) throw new Error('Expected a run');
    const runWithoutPursuit = { ...legacyRun.run };
    delete runWithoutPursuit.pursuitState;
    const legacyCleared = collectReward({ ...legacyRun, run: runWithoutPursuit });

    expect(legacyCleared.run).not.toHaveProperty('pursuitState');
    expect(game.getCurrentRunPursuit(legacyCleared)).toMatchObject({
      legacyDisabled: true,
      progress: { status: 'disabled', clearedNodeCount: 0 }
    });
  });

  it('advances only after a real successful move and consumes grace without a movement log', () => {
    const active = atPursuitNode(
      createPursuitReplayState(),
      'sealed_cache',
      stalkingPursuit('demon_tower_1', { nodeId: 'blood_pool_trap' }),
      ['sealed_cache']
    );
    const blocked = game.moveToNode(
      atPursuitNode(
        createPursuitReplayState(),
        'fog_lesser_demon',
        stalkingPursuit(),
        []
      ),
      'blood_rune_trap'
    );
    const moved = game.moveToNode(active, 'tower_exit');
    const graceState = atPursuitNode(
      { ...createPursuitReplayState(), log: [] },
      'sealed_cache',
      stalkingPursuit('demon_tower_1', { nodeId: 'blood_pool_trap', graceMoves: 1 }),
      ['sealed_cache']
    );
    const graceMoved = game.moveToNode(graceState, 'tower_exit');

    expect(blocked.run?.currentNodeId).toBe('fog_lesser_demon');
    expect(blocked.run?.pursuitState).toEqual(stalkingPursuit());
    expect(moved.run?.currentNodeId).toBe('tower_exit');
    expect(moved.run?.pursuitState?.nodeId).not.toBe('blood_pool_trap');
    expect(moved.log.some((line) => line.includes('破界追兵') && line.includes('移动'))).toBe(true);
    expect(graceMoved.run?.pursuitState).toMatchObject({
      nodeId: 'blood_pool_trap',
      graceMoves: 0
    });
    expect(graceMoved.log.some((line) => line.includes('破界追兵') && line.includes('移动'))).toBe(false);
  });

  it('honors a closed law edge in its authored direction', () => {
    const gate = DUNGEON_ROUTE_GATES.demon_tower_1.find(
      (candidate) => candidate.fromNodeId === 'lower_fog_lesser' && candidate.toNodeId === 'cracked_portal'
    );
    if (!gate) throw new Error('Missing directed pursuit gate');
    let lawState = createDungeonLawState('demon_tower_1');
    for (const node of DUNGEONS.demon_tower_1.nodes) {
      if (getRouteBlockReason('demon_tower_1', gate.fromNodeId, gate.toNodeId, lawState)) break;
      lawState = signalFirstNodeClear(lawState, { node, damageTaken: 99 });
    }
    expect(getRouteBlockReason('demon_tower_1', gate.fromNodeId, gate.toNodeId, lawState)).toBeDefined();

    const forward = patchPursuitRun(
      atPursuitNode(
        createPursuitReplayState(),
        'blood_rune_trap',
        stalkingPursuit('demon_tower_1', { nodeId: 'lower_fog_lesser' }),
        ['blood_rune_trap']
      ),
      { lawState }
    );
    const reverse = patchPursuitRun(
      atPursuitNode(
        createPursuitReplayState(),
        'demon_bone_cache',
        stalkingPursuit('demon_tower_1', { nodeId: 'cracked_portal' }),
        ['demon_bone_cache']
      ),
      { lawState }
    );
    const forwardProbe = patchPursuitRun(forward, { currentNodeId: 'lower_fog_lesser' });

    expect(game.getCurrentRouteBlockReason(forwardProbe, 'cracked_portal')).toBeDefined();
    const forwardMoved = game.moveToNode(forward, 'cracked_portal');
    const reverseMoved = game.moveToNode(reverse, 'lower_fog_lesser');

    expect(forwardMoved.run?.pursuitState?.nodeId).not.toBe('cracked_portal');
    expect(reverseMoved.run?.pursuitState).toMatchObject({ contacts: 1, graceMoves: 1 });
  });

  it('applies contact damage through damageTaken and immediately settles a lethal contact', () => {
    const contactState = atPursuitNode(
      createPursuitReplayState(),
      'sealed_cache',
      stalkingPursuit('demon_tower_1', { nodeId: 'blood_pool_trap', contacts: 2 }),
      ['sealed_cache']
    );
    const expectedDamage = game.getRunPursuitContactDamage(
      contactState.player.maxHp,
      DUNGEONS.demon_tower_1.tier
    );
    const contacted = game.moveToNode(contactState, 'tower_exit');
    const lethal = game.moveToNode(
      {
        ...contactState,
        player: { ...contactState.player, hp: 1 }
      },
      'tower_exit'
    );

    expect(contacted.player.hp).toBe(contactState.player.hp - expectedDamage);
    expect(contacted.run?.damageTaken).toBe(expectedDamage);
    expect(contacted.run?.pursuitState).toMatchObject({ contacts: 3, graceMoves: 1 });
    expect(lethal.phase).toBe('result');
    expect(lethal.player.hp).toBe(0);
    expect(lethal.run?.damageTaken).toBe(1);
    expect(lethal.run?.lastPursuitSettlement).toMatchObject({
      reason: 'failure',
      rewarded: false,
      state: { status: 'repelled', contacts: 3 }
    });
    expect(lethal.lastOutcome).toContain('pursuitRewarded=0');
  });

  it('keeps containment pending until exit, grants exactly one material, and is idempotent', () => {
    const bossNodeId = getBossDefinition('demon_tower_1').nodeId;
    const beforeContainment = atPursuitNode(
      createPursuitReplayState(),
      'sealed_cache',
      stalkingPursuit('demon_tower_1', { nodeId: 'cracked_portal' }),
      ['sealed_cache', bossNodeId]
    );
    const materialId = game.RUN_PURSUIT_CATALOG.demon_tower_1.materialId;
    const initialMaterial = beforeContainment.inventory[materialId];
    const contained = game.moveToNode(beforeContainment, 'tower_exit');

    expect(contained.run?.pursuitState?.status).toBe('contained');
    expect(contained.inventory[materialId]).toBe(initialMaterial);
    expect(contained.log.some((line) => line.includes('待成功撤离带回'))).toBe(true);

    const exited = resolveExit(contained);
    const repeated = resolveExit(exited);
    expect(exited.inventory[materialId]).toBe(initialMaterial + 1);
    expect(exited.run?.lastPursuitSettlement).toMatchObject({
      reason: 'successful_exit',
      materialId,
      rewarded: true,
      state: { status: 'contained' }
    });
    expect(exited.lastOutcome).toContain('pursuitRewarded=1');
    expect(repeated.inventory[materialId]).toBe(initialMaterial + 1);
  });

  it('never grants contained material on retreat or failure', () => {
    const materialId = game.RUN_PURSUIT_CATALOG.demon_tower_1.materialId;
    const contained = atPursuitNode(
      createPursuitReplayState(),
      'sealed_cache',
      containedPursuit(),
      ['sealed_cache']
    );
    const initialMaterial = contained.inventory[materialId];
    const retreated = resolveRetreat(contained);
    const failed = game.resolveRunFailure(contained);

    for (const result of [retreated, failed]) {
      expect(result.inventory[materialId]).toBe(initialMaterial);
      expect(result.run?.lastPursuitSettlement).toMatchObject({
        rewarded: false,
        state: { status: 'contained' }
      });
      expect(result.log.some((line) => line.includes('未带回') && line.includes('奖励为 0'))).toBe(true);
    }
  });

  it('carries pending containment across a portal settlement and rewards it at the target exit', () => {
    const source = atPursuitNode(
      createPursuitReplayState(1),
      'cracked_portal',
      containedPursuit(),
      ['sealed_cache']
    );
    const materialId = game.RUN_PURSUIT_CATALOG.demon_tower_1.materialId;
    const crossed = usePortal(source, 'stabilize');

    expect(crossed.run?.dungeonId).toBe('metro_abyss');
    expect(crossed.run?.pursuitState?.status).toBe('disabled');
    expect(crossed.run?.lastPursuitSettlement).toMatchObject({
      reason: 'stable_portal',
      rewarded: false,
      state: { dungeonId: 'demon_tower_1', status: 'contained' }
    });

    const exitNode = DUNGEONS.metro_abyss.nodes.find((node) => node.type === 'exit');
    if (!exitNode) throw new Error('Missing metro exit');
    const readyToExit = patchPursuitRun(crossed, {
      currentNodeId: exitNode.id,
      clearedNodeIds: [getBossDefinition('metro_abyss').nodeId]
    });
    const initialMaterial = readyToExit.inventory[materialId];
    const exited = resolveExit(readyToExit);

    expect(exited.inventory[materialId]).toBe(initialMaterial + 1);
    expect(exited.run?.lastPursuitSettlement).toMatchObject({
      reason: 'successful_exit',
      rewarded: true,
      materialId,
      state: { dungeonId: 'demon_tower_1', status: 'contained' }
    });
  });

  it('does not treat a non-portal contained settlement as cross-dungeon pending loot', () => {
    const materialId = game.RUN_PURSUIT_CATALOG.demon_tower_1.materialId;
    const readyToExit = patchPursuitRun(createPursuitReplayState(), {
      currentNodeId: 'tower_exit',
      clearedNodeIds: [getBossDefinition('demon_tower_1').nodeId],
      pursuitState: game.createRunPursuitState('demon_tower_1', false),
      lastPursuitSettlement: {
        state: containedPursuit(),
        reason: 'retreat',
        materialId,
        rewarded: false
      }
    });
    const initialMaterial = readyToExit.inventory[materialId];
    const exited = resolveExit(readyToExit);

    expect(exited.inventory[materialId]).toBe(initialMaterial);
    expect(exited.run?.lastPursuitSettlement).toMatchObject({
      reason: 'successful_exit',
      materialId,
      rewarded: false,
      state: { status: 'contained' }
    });
  });

  it('repels on stabilize, carries only active force pursuits, and preserves legacy absence', () => {
    const stable = usePortal(
      atPursuitNode(createPursuitReplayState(1), 'cracked_portal', stalkingPursuit(), []),
      'stabilize'
    );
    const forced = usePortal(
      atPursuitNode(
        createPursuitReplayState(),
        'cracked_portal',
        stalkingPursuit('demon_tower_1', { contacts: 4 }),
        []
      ),
      'force'
    );
    const dormantForced = usePortal(
      atPursuitNode(
        createPursuitReplayState(),
        'cracked_portal',
        game.createRunPursuitState('demon_tower_1', true),
        []
      ),
      'force'
    );
    const legacySource = patchPursuitRun(createPursuitReplayState(), { currentNodeId: 'cracked_portal' });
    if (!legacySource.run) throw new Error('Expected a run');
    const legacyRun = { ...legacySource.run };
    delete legacyRun.pursuitState;
    const legacyTarget = usePortal({ ...legacySource, run: legacyRun }, 'force');

    expect(stable.run?.pursuitState?.status).toBe('disabled');
    expect(stable.run?.lastPursuitSettlement).toMatchObject({
      reason: 'stable_portal',
      state: { status: 'repelled', repelledReason: 'stable_portal' },
      rewarded: false
    });
    expect(forced.run?.pursuitState).toMatchObject({
      dungeonId: 'metro_abyss',
      status: 'stalking',
      nodeId: game.RUN_PURSUIT_CATALOG.metro_abyss.spawnNodeId,
      contacts: 4,
      graceMoves: 1
    });
    expect(dormantForced.run?.pursuitState?.status).toBe('disabled');
    expect(legacyTarget.run).not.toHaveProperty('pursuitState');
  });

  it('fuses a strict stalking boss after protocol and pressure layers without touching contained bosses', () => {
    let pressureState: RunPressureState | undefined = createRunPressureState();
    for (let index = 0; index < 8; index += 1) {
      pressureState = advanceRunPressureOnNodeClear(pressureState);
    }
    const entered = enterDungeon(
      {
        ...createInitialState(),
        completedDungeonIds: ['demon_tower_1'],
        claimedTaskIds: ['mainline_clear_demon_tower_1']
      },
      'demon_tower_1',
      'imprint'
    );
    const bossNodeId = getBossDefinition('demon_tower_1').nodeId;
    const commonRun = {
      currentNodeId: bossNodeId,
      clearedNodeIds: [],
      pressureState
    };
    const fusedCombat = selectNode(
      patchPursuitRun(entered, { ...commonRun, pursuitState: stalkingPursuit() }),
      bossNodeId
    );
    const containedCombat = selectNode(
      patchPursuitRun(entered, { ...commonRun, pursuitState: containedPursuit() }),
      bossNodeId
    );
    expect(fusedCombat.run?.pursuitState?.status).toBe('fused');
    expect(containedCombat.run?.pursuitState?.status).toBe('contained');
    const fusionDescription = game.RUN_PURSUIT_CATALOG.demon_tower_1.fusionDescription;
    for (const phase of ['sealed', 'awakened'] as const) {
      const fusedProfile = game.getCombatEncounterProfile({
        ...fusedCombat,
        combat: fusedCombat.combat ? { ...fusedCombat.combat, bossPhase: phase } : fusedCombat.combat
      });
      const baselineProfile = game.getCombatEncounterProfile({
        ...containedCombat,
        combat: containedCombat.combat
          ? { ...containedCombat.combat, bossPhase: phase }
          : containedCombat.combat
      });
      if (!fusedProfile || !baselineProfile) throw new Error(`Expected ${phase} boss profiles`);

      for (const stat of ['maxHp', 'attack', 'artPower', 'defense', 'speed'] as const) {
        expect(fusedProfile.monster[stat]).toBe(Math.ceil(baselineProfile.monster[stat] * 1.15));
      }
      expect(fusedProfile.monster.ability.split(fusionDescription)).toHaveLength(2);
      expect(baselineProfile.monster.ability).not.toContain(fusionDescription);
    }
  });

  it('safely disables malformed helpers without mutating or synthesizing pursuit state', () => {
    const entered = createPursuitReplayState();
    const malformed = patchPursuitRun(entered, {
      currentNodeId: 'sealed_cache',
      clearedNodeIds: ['sealed_cache'],
      pursuitState: { status: 'stalking' } as game.RunPursuitState
    });
    const moved = game.moveToNode(malformed, 'tower_exit');

    expect(game.getCurrentRunPursuit(malformed)).toMatchObject({
      legacyDisabled: true,
      progress: { status: 'disabled', clearedNodeCount: 0 }
    });
    expect(moved.run?.pursuitState).toEqual({ status: 'stalking' });
    expect(moved.log.some((line) => line.includes('破界追兵') && line.includes('移动'))).toBe(false);
  });
});

describe('infinite-flow richer demo loop', () => {
  const defenseEquipmentSlots = ['head', 'armor', 'hands', 'feet', 'waist'] as const;
  const weaponSkillIds = [
    'armor_piercing_sword',
    'bone_spear',
    'ember_staff',
    'starforged_edge',
    'chronal_edge'
  ] as const satisfies readonly EquipmentId[];

  function mainlineTaskId(dungeonId: GameState['completedDungeonIds'][number]): string {
    return `mainline_clear_${dungeonId}`;
  }

  function withCompletedDungeons(state: GameState, completedDungeonIds: GameState['completedDungeonIds']): GameState {
    const claimedTaskIds = new Set(state.claimedTaskIds);
    completedDungeonIds.forEach((dungeonId) => claimedTaskIds.add(mainlineTaskId(dungeonId)));

    return {
      ...state,
      completedDungeonIds,
      claimedTaskIds: [...claimedTaskIds]
    };
  }

  function withCurrentNode(state: GameState, nodeId: string): GameState {
    if (!state.run) return state;

    // Non-movement tests can exercise node-specific actions without bypassing moveToNode rules.
    return {
      ...state,
      phase: 'explore',
      combat: undefined,
      run: {
        ...state.run,
        currentNodeId: nodeId
      }
    };
  }

  function withClearedNodes(state: GameState, ...nodeIds: string[]): GameState {
    if (!state.run) return state;

    return {
      ...state,
      run: {
        ...state.run,
        clearedNodeIds: [...new Set([...state.run.clearedNodeIds, ...nodeIds])]
      }
    };
  }

  function withBossCleared(state: GameState): GameState {
    if (!state.run) return state;
    return withClearedNodes(state, getBossDefinition(state.run.dungeonId).nodeId);
  }

  function withEquippedWeapon(state: GameState, weaponId: EquipmentId, level = 1): GameState {
    return {
      ...state,
      ownedEquipment: state.ownedEquipment.includes(weaponId)
        ? state.ownedEquipment
        : [...state.ownedEquipment, weaponId],
      equipmentLevels: {
        ...state.equipmentLevels,
        [weaponId]: level
      },
      equipped: {
        ...state.equipped,
        weapon: weaponId
      }
    };
  }

  function startWeaponSkillCombat(weaponId: EquipmentId, level = 1): GameState {
    return selectNode(
      enterDungeon(withEquippedWeapon(createInitialState(), weaponId, level), 'demon_tower_1'),
      'fog_lesser_demon'
    );
  }

  function withMonsterHp(state: GameState, monsterHp: number): GameState {
    return {
      ...state,
      combat: state.combat
        ? {
            ...state.combat,
            monsterHp
          }
        : state.combat
    };
  }

  function withWeaponFocus(
    state: GameState,
    weaponFocus: NonNullable<game.CombatState['weaponFocus']> = 3
  ): GameState {
    return {
      ...state,
      combat: state.combat ? { ...state.combat, weaponFocus } : state.combat
    };
  }

  it('starts dungeon runs from the tactical grid start node', () => {
    const state = createInitialState();

    for (const dungeonId of DUNGEON_ORDER) {
      const dungeon = dungeonWithGrid(dungeonId);
      const entered = enterDungeon(state, dungeonId);

      if (entered.phase === 'explore') {
        expect(dungeon.grid).toBeDefined();
        if (!dungeon.grid) return;
        expect(entered.run?.currentNodeId).toBe(dungeon.grid.startNodeId);
      }
    }
  });

  it('moves only to adjacent tactical grid nodes and keeps node events usable', () => {
    const moveToNode = getMoveToNode();

    expect(moveToNode).toBeTypeOf('function');
    if (!moveToNode) return;

    const entered = withClearedNodes(enterDungeon(createInitialState(), 'demon_tower_1'), 'fog_lesser_demon');
    const movedToTrap = moveToNode(entered, 'blood_rune_trap');
    const blockedJump = moveToNode(entered, 'sealed_cache');
    const handledTrap = handleTrap(movedToTrap);

    expect(dungeonWithGrid('demon_tower_1').grid).toBeDefined();
    expect(entered.run?.currentNodeId).toBe(dungeonWithGrid('demon_tower_1').grid?.startNodeId);
    expect(movedToTrap.phase).toBe('explore');
    expect(movedToTrap.run?.currentNodeId).toBe('blood_rune_trap');
    expect(movedToTrap.combat).toBeUndefined();
    expect(blockedJump.run?.currentNodeId).toBe(entered.run?.currentNodeId);
    expect(blockedJump.log[0]).toMatch(/相邻|无法移动/);
    expect(handledTrap.run?.clearedNodeIds).toContain('blood_rune_trap');
  });

  it('blocks leaving an uncleared monster node', () => {
    const entered = enterDungeon(createInitialState(), 'demon_tower_1');
    const blocked = game.moveToNode(entered, 'blood_rune_trap');
    const blockedInCombat = game.moveToNode(selectNode(entered, 'fog_lesser_demon'), 'blood_rune_trap');

    expect(blocked.run?.currentNodeId).toBe('fog_lesser_demon');
    expect(blocked.run?.clearedNodeIds).not.toContain('fog_lesser_demon');
    expect(blocked.log[0]).toContain('先处理当前怪物');
    expect(blockedInCombat.log[0]).toBe('战斗中无法走格移动。');
  });

  it('allows leaving a monster node after killing it', () => {
    let state = selectNode(enterDungeon(createInitialState(), 'demon_tower_1'), 'fog_lesser_demon');

    for (let i = 0; i < 8 && state.phase === 'combat'; i += 1) {
      state = performCombatAction(state, 'attack');
    }

    const moved = game.moveToNode(state, 'blood_rune_trap');

    expect(state.run?.clearedNodeIds).toContain('fog_lesser_demon');
    expect(moved.run?.currentNodeId).toBe('blood_rune_trap');
  });

  it('allows leaving a monster node after capturing it', () => {
    let state = selectNode(
      enterDungeon(prepareTacticalItems(buyItem(createInitialState(), 'capture_net'), 'capture_net'), 'demon_tower_1'),
      'fog_lesser_demon'
    );

    state = performCombatAction(state, 'attack');
    state = performCombatAction(state, 'attack');
    state = capturePet(state, 'mist_kitten');

    const moved = game.moveToNode(state, 'blood_rune_trap');

    expect(state.run?.clearedNodeIds).toContain('fog_lesser_demon');
    expect(moved.run?.currentNodeId).toBe('blood_rune_trap');
  });

  it('keeps an escaped monster node locked because the encounter is not cleared', () => {
    const base = withCompletedDungeons(createInitialState(), [
      'demon_tower_1',
      'metro_abyss',
      'starfall_mine',
      'rust_hospital',
      'ash_arena'
    ]);
    const combat = selectNode(
      withCurrentNode(enterDungeon({ ...base, learnedMethods: ['cloud_step'] }, 'dream_archive'), 'paper_librarian'),
      'paper_librarian'
    );
    const escaped = performCombatAction(combat, 'escape');
    const blocked = game.moveToNode(escaped, 'failed_file_reward');

    expect(escaped.phase).toBe('explore');
    expect(escaped.run?.clearedNodeIds).not.toContain('paper_librarian');
    expect(blocked.run?.currentNodeId).toBe('paper_librarian');
    expect(blocked.log[0]).toContain('先处理当前怪物');
  });

  it('blocks leaving an untreated trap and allows movement after handling it', () => {
    const entered = withClearedNodes(enterDungeon(createInitialState(), 'demon_tower_1'), 'fog_lesser_demon');
    const atTrap = game.moveToNode(entered, 'blood_rune_trap');
    const blocked = game.moveToNode(atTrap, 'cracked_portal');
    const handled = handleTrap(atTrap);
    const moved = game.moveToNode(handled, 'cracked_portal');

    expect(blocked.run?.currentNodeId).toBe('blood_rune_trap');
    expect(blocked.log[0]).toContain('先处理当前陷阱');
    expect(handled.run?.clearedNodeIds).toContain('blood_rune_trap');
    expect(moved.run?.currentNodeId).toBe('cracked_portal');
  });

  it('does not lock reward, portal, exit, or already-cleared nodes', () => {
    const entered = enterDungeon(createInitialState(), 'demon_tower_1');
    const fromReward = game.moveToNode(withCurrentNode(entered, 'sealed_cache'), 'tower_exit');
    const fromPortal = game.moveToNode(withCurrentNode(entered, 'cracked_portal'), 'sealed_cache');
    const fromExit = game.moveToNode(withCurrentNode(entered, 'tower_exit'), 'sealed_cache');
    const fromClearedMonster = game.moveToNode(withClearedNodes(entered, 'fog_lesser_demon'), 'blood_rune_trap');

    expect(fromReward.run?.currentNodeId).toBe('tower_exit');
    expect(fromPortal.run?.currentNodeId).toBe('sealed_cache');
    expect(fromExit.run?.currentNodeId).toBe('sealed_cache');
    expect(fromClearedMonster.run?.currentNodeId).toBe('blood_rune_trap');
  });

  it('does not let selectNode jump to a non-current grid node', () => {
    const entered = enterDungeon(createInitialState(), 'demon_tower_1');
    const jumped = selectNode(entered, 'sealed_cache');

    expect(jumped.phase).toBe('explore');
    expect(jumped.run?.currentNodeId).toBe(entered.run?.currentNodeId);
    expect(jumped.combat).toBeUndefined();
    expect(jumped.log[0]).toMatch(/走格|移动|当前位置/);
  });

  it('shows and resolves dungeon events only on their attached tactical grid node', () => {
    const entered = enterDungeon(createInitialState(), 'demon_tower_1');
    const prematureEvent = game.resolveDungeonEvent(entered, 'blood_rune_stair', 'send_pet_first');
    const movedToTrap = withCurrentNode(entered, 'blood_rune_trap');

    expect(game.getAvailableDungeonEvents(entered).map((event) => event.id)).not.toContain('blood_rune_stair');
    expect(prematureEvent.run?.resolvedEventIds).not.toContain('blood_rune_stair');
    expect(prematureEvent.log[0]).toMatch(/当前位置|格子/);
    expect(game.getAvailableDungeonEvents(movedToTrap).map((event) => event.id)).toContain('blood_rune_stair');
  });

  it('starts with a full character sheet and multiple explorable dungeons', () => {
    const state = createInitialState();

    expect(state.phase).toBe('hub');
    expect(state.player.hp).toBe(state.player.maxHp);
    expect(state.player.base.body).toBeGreaterThan(0);
    expect(state.equipped.weapon).toBe('training_blade');
    expect(state.claimedTaskIds).toEqual([]);
    expect(state.bloodlineRanks).toEqual({});
    expect(state.activeBloodline).toBeUndefined();
    expect(Object.keys(DUNGEONS)).toHaveLength(19);
    expect(DUNGEONS.demon_tower_1.nodes.some((node) => node.type === 'monster')).toBe(true);
    expect(DUNGEONS.demon_tower_1.nodes.some((node) => node.type === 'trap')).toBe(true);
    expect(DUNGEONS.demon_tower_1.nodes.some((node) => node.type === 'portal')).toBe(true);
  });

  it('starts with five equipped defense pieces that are owned and leveled', () => {
    const state = createInitialState();
    const equipped = state.equipped as Record<string, game.EquipmentId | undefined>;

    expect((game as typeof game & { DEFENSE_EQUIPMENT_SLOTS?: readonly string[] }).DEFENSE_EQUIPMENT_SLOTS).toEqual([
      ...defenseEquipmentSlots
    ]);
    expect(defenseEquipmentSlots.filter((slot) => equipped[slot])).toHaveLength(5);

    for (const slot of defenseEquipmentSlots) {
      const equipmentId = equipped[slot];

      expect(equipmentId).toBeDefined();
      expect(EQUIPMENT[equipmentId as game.EquipmentId]?.slot).toBe(slot);
      expect(state.ownedEquipment).toContain(equipmentId);
      expect(state.equipmentLevels[equipmentId as game.EquipmentId]).toBe(1);
    }
  });

  it('keeps starter combat stats aligned with the original armor balance', () => {
    expect(getDerivedStats(createInitialState())).toMatchObject({
      maxHp: 102,
      attack: 19,
      artPower: 13,
      defense: 8,
      speed: 14,
      trapCheck: 5
    });
  });

  it('defines at least one equipment item for each defense slot', () => {
    const slots = new Set(Object.values(EQUIPMENT).map((equipment) => equipment.slot));

    expect((game as typeof game & { EQUIPMENT_SLOTS?: readonly string[] }).EQUIPMENT_SLOTS).toEqual([
      'weapon',
      ...defenseEquipmentSlots,
      'charm'
    ]);
    expect(defenseEquipmentSlots.every((slot) => slots.has(slot as game.EquipmentSlot))).toBe(true);

    for (const slot of defenseEquipmentSlots) {
      expect(Object.values(EQUIPMENT).filter((equipment) => equipment.slot === slot).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('defines nineteen progression dungeons with complete encounter structure and rising recommended power', () => {
    const requiredNodeTypes: NodeType[] = ['monster', 'trap', 'portal', 'reward', 'exit'];
    const recommendedPower = DUNGEON_ORDER.map((dungeonId) => DUNGEONS[dungeonId].recommendedPower);

    expect(DUNGEON_ORDER).toHaveLength(19);
    expect(recommendedPower).toEqual([...recommendedPower].sort((a, b) => a - b));

    for (const dungeonId of DUNGEON_ORDER) {
      const dungeon = DUNGEONS[dungeonId];
      const nodeTypes = new Set(dungeon.nodes.map((node) => node.type));

      expect(dungeon.nodes.length).toBeGreaterThanOrEqual(5);
      for (const nodeType of requiredNodeTypes) {
        expect(nodeTypes.has(nodeType)).toBe(true);
      }
    }
  });

  it('exposes the Tier 8 temporal catalog without changing starter ownership defaults', () => {
    expect(DUNGEON_ORDER[7]).toBe('temporal_observatory');
    expect(DUNGEONS.temporal_observatory).toMatchObject({
      id: 'temporal_observatory',
      name: '时序观测庭',
      tier: 8,
      recommendedPower: 435
    });
    expect(DUNGEONS.temporal_observatory.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'past_calibration_anchor' }),
        expect.objectContaining({ id: 'future_calibration_anchor' })
      ])
    );
    expect([
      game.MONSTERS.clockwork_scout,
      game.MONSTERS.epoch_sentinel,
      game.MONSTERS.zero_hour_regent
    ]).toEqual([
      expect.objectContaining({ id: 'clockwork_scout', dungeonId: 'temporal_observatory' }),
      expect.objectContaining({ id: 'epoch_sentinel', dungeonId: 'temporal_observatory' }),
      expect.objectContaining({ id: 'zero_hour_regent', dungeonId: 'temporal_observatory' })
    ]);
    expect(game.ITEM_IDS).toContain('chronal_glass');
    expect(ITEMS.chronal_glass).toMatchObject({
      id: 'chronal_glass',
      name: '时序玻璃',
      kind: 'material'
    });
    expect(ITEMS.chronal_glass.cost).toBeUndefined();

    expect(EQUIPMENT.chronal_edge).toMatchObject({
      slot: 'weapon',
      cost: { rewardPoints: 720, lingyun: 2, items: { chronal_glass: 1, star_iron: 1 } },
      base: { attack: 17, artPower: 5 },
      perLevel: { attack: 5, artPower: 2 },
      maxLevel: 3
    });
    expect(EQUIPMENT.chronal_aegis).toMatchObject({
      slot: 'armor',
      cost: { rewardPoints: 700, lingyun: 2, items: { chronal_glass: 1, cracked_core: 1 } },
      base: { maxHp: 32, defense: 8 },
      perLevel: { maxHp: 12, defense: 3 },
      maxLevel: 3
    });
    expect(EQUIPMENT.chronal_lens).toMatchObject({
      slot: 'charm',
      cost: { rewardPoints: 760, lingyun: 2, items: { chronal_glass: 1, rift_dust: 1 } },
      base: { spirit: 2, artPower: 12, defense: 3 },
      perLevel: { artPower: 5, defense: 1 },
      maxLevel: 3
    });

    const initial = createInitialState();
    expect(initial.inventory.chronal_glass).toBe(0);
    expect(initial.ownedEquipment).not.toEqual(
      expect.arrayContaining(['chronal_edge', 'chronal_aegis', 'chronal_lens'])
    );
    expect(initial.equipmentAttunements).toEqual({});
    expect(initial.equipmentTemperRanks).toEqual({});
  });

  it('exposes the Tier 9 causal catalog with three passive equipment choices', () => {
    expect(DUNGEON_ORDER[8]).toBe('causal_clearinghouse');
    expect(DUNGEONS.causal_clearinghouse).toMatchObject({
      id: 'causal_clearinghouse',
      name: '因果清算所',
      tier: 9,
      recommendedPower: 500
    });
    expect([
      game.MONSTERS.verdict_usher,
      game.MONSTERS.paradox_bailiff,
      game.MONSTERS.zero_sum_auditor
    ]).toEqual([
      expect.objectContaining({ id: 'verdict_usher', dungeonId: 'causal_clearinghouse' }),
      expect.objectContaining({ id: 'paradox_bailiff', dungeonId: 'causal_clearinghouse' }),
      expect.objectContaining({ id: 'zero_sum_auditor', dungeonId: 'causal_clearinghouse' })
    ]);
    expect(ITEMS.causal_seal).toMatchObject({
      id: 'causal_seal',
      name: '因果印章',
      kind: 'material'
    });
    expect(EQUIPMENT.causal_visor).toMatchObject({
      slot: 'head',
      base: { spirit: 1, defense: 2, trapCheck: 4 },
      perLevel: { artPower: 2, trapCheck: 1 },
      maxLevel: 3
    });
    expect(EQUIPMENT.echo_breaker_gauntlets).toMatchObject({
      slot: 'hands',
      base: { attack: 4, artPower: 4, defense: 3 },
      perLevel: { attack: 2, artPower: 1 },
      maxLevel: 3
    });
    expect(EQUIPMENT.return_anchor_belt).toMatchObject({
      slot: 'waist',
      base: { maxHp: 16, defense: 4, speed: 1 },
      perLevel: { maxHp: 8, defense: 1 },
      maxLevel: 3
    });

    const initial = createInitialState();
    expect(initial.inventory.causal_seal).toBe(0);
    expect(initial.ownedEquipment).not.toEqual(
      expect.arrayContaining(['causal_visor', 'echo_breaker_gauntlets', 'return_anchor_belt'])
    );
  });

  it('has enough commercial-slice content across items, equipment, methods, and pets', () => {
    const purchasableItems = Object.values(ITEMS).filter((item) => item.cost);

    expect(purchasableItems.length).toBeGreaterThanOrEqual(8);
    expect(Object.keys(EQUIPMENT).length).toBeGreaterThanOrEqual(12);
    expect(Object.keys(METHODS).length).toBeGreaterThanOrEqual(7);
    expect(Object.keys(PETS).length).toBeGreaterThanOrEqual(6);
  });

  it('lets the player buy, equip, and upgrade gear that changes derived stats', () => {
    const state = createInitialState();
    const baseAttack = getDerivedStats(state).attack;

    const withSword = equipEquipment(buyEquipment(state, 'armor_piercing_sword'), 'armor_piercing_sword');
    expect(withSword.equipped.weapon).toBe('armor_piercing_sword');
    expect(getDerivedStats(withSword).attack).toBeGreaterThan(baseAttack);

    const upgraded = upgradeEquipment(withSword, 'armor_piercing_sword');
    expect(upgraded.equipmentLevels.armor_piercing_sword).toBe(2);
    expect(getDerivedStats(upgraded).attack).toBeGreaterThan(getDerivedStats(withSword).attack);
  });

  it('does not count purchased unequipped replacement gear toward player power', () => {
    const state = { ...createInitialState(), rewardPoints: 2000 };
    const basePower = getPlayerPower(state);

    const purchased = buyEquipment(state, 'armor_piercing_sword');

    expect(purchased.equipped.weapon).toBe('training_blade');
    expect(purchased.ownedEquipment).toContain('armor_piercing_sword');
    expect(getPlayerPower(purchased)).toBe(basePower);

    const equipped = equipEquipment(purchased, 'armor_piercing_sword');

    expect(equipped.equipped.weapon).toBe('armor_piercing_sword');
    expect(getPlayerPower(equipped)).toBeGreaterThan(basePower);
  });

  it('only counts upgraded replacement gear after it is equipped', () => {
    const state = { ...createInitialState(), rewardPoints: 2000 };
    const purchased = buyEquipment(state, 'armor_piercing_sword');
    const levelOneEquipped = equipEquipment(purchased, 'armor_piercing_sword');

    const upgradedUnequipped = upgradeEquipment(purchased, 'armor_piercing_sword');

    expect(upgradedUnequipped.equipped.weapon).toBe('training_blade');
    expect(upgradedUnequipped.equipmentLevels.armor_piercing_sword).toBe(2);
    expect(getPlayerPower(upgradedUnequipped)).toBe(getPlayerPower(purchased));

    const levelTwoEquipped = equipEquipment(upgradedUnequipped, 'armor_piercing_sword');

    expect(levelTwoEquipped.equipped.weapon).toBe('armor_piercing_sword');
    expect(getPlayerPower(levelTwoEquipped) - getPlayerPower(levelOneEquipped)).toBe(16);
  });

  it('lets the player buy and equip a new hands armor piece that raises power', () => {
    const equipmentId = 'guardian_gauntlets' as game.EquipmentId;
    const state = { ...createInitialState(), rewardPoints: 2000 };
    const basePower = getPlayerPower(state);

    expect(EQUIPMENT[equipmentId]?.slot).toBe('hands');

    const purchased = buyEquipment(state, equipmentId);
    const equipped = equipEquipment(purchased, equipmentId);

    expect((equipped.equipped as Record<string, game.EquipmentId | undefined>).hands).toBe(equipmentId);
    expect(equipped.ownedEquipment).toContain(equipmentId);
    expect(equipped.equipmentLevels[equipmentId]).toBe(1);
    expect(getPlayerPower(equipped)).toBeGreaterThan(basePower);
  });

  it('uses player power to make late-dungeon risk improve after growth investments', () => {
    const fresh = createInitialState();
    const stocked = {
      ...fresh,
      rewardPoints: 5000,
      lingyun: 12,
      inventory: {
        ...fresh.inventory,
        hidden_stone: 3,
        star_iron: 2,
        method_page: 2,
        cracked_core: 2,
        rift_dust: 3
      }
    };

    const geared = equipEquipment(
      upgradeEquipment(
        learnMethod(
          learnMethod(
            buyPet(equipEquipment(buyEquipment(stocked, 'starforged_edge'), 'starforged_edge'), 'contract_sprite'),
            'gate_sense'
          ),
          'star_core_method'
        ),
        'starforged_edge'
      ),
      'starforged_edge'
    );

    expect(getPlayerPower(geared)).toBeGreaterThan(getPlayerPower(fresh));
    expect(getDungeonReadiness(fresh, 'void_citadel')).toBe('deadly');
    expect(getDungeonReadiness(geared, 'void_citadel')).not.toBe('deadly');
  });

  it('supports buying pets and applying active pet stat growth', () => {
    const state = createInitialState();
    const baseStats = getDerivedStats(state);
    const withPet = buyPet(state, 'contract_sprite');

    expect(withPet.ownedPets).toContain('contract_sprite');
    expect(withPet.activePet).toBe('contract_sprite');
    expect(withPet.rewardPoints).toBeLessThan(state.rewardPoints);
    expect(getDerivedStats(withPet).spirit).toBeGreaterThan(baseStats.spirit);
  });

  it('turns a monster node into a simple turn-based combat and pays rewards when cleared', () => {
    const entered = enterDungeon(createInitialState(), 'demon_tower_1');
    const combat = selectNode(entered, 'fog_lesser_demon');

    expect(combat.phase).toBe('combat');
    expect(combat.combat?.monsterId).toBe('fog_lesser_demon');

    let state = combat;
    for (let i = 0; i < 8 && state.phase === 'combat'; i += 1) {
      state = performCombatAction(state, 'attack');
    }

    expect(state.phase).toBe('explore');
    expect(state.rewardPoints).toBeGreaterThan(850);
    expect(state.inventory.demon_bone).toBeGreaterThanOrEqual(1);
    expect(state.run?.clearedNodeIds).toContain('fog_lesser_demon');
  });

  it('does not let a cleared monster node restart combat for duplicate rewards', () => {
    let state = selectNode(enterDungeon(createInitialState(), 'demon_tower_1'), 'fog_lesser_demon');

    for (let i = 0; i < 8 && state.phase === 'combat'; i += 1) {
      state = performCombatAction(state, 'attack');
    }

    const rewardAfterClear = state.rewardPoints;
    const repeated = selectNode(state, 'fog_lesser_demon');

    expect(repeated.phase).toBe('explore');
    expect(repeated.rewardPoints).toBe(rewardAfterClear);
    expect(repeated.combat).toBeUndefined();
  });

  it('makes all five advanced weapon skills available with distinct real combat effects', () => {
    const damageByWeapon = weaponSkillIds.map((weaponId) => {
      const started = withWeaponFocus(withMonsterHp(startWeaponSkillCombat(weaponId), 1000));
      const status = getWeaponSkillStatus(started);
      const resolved = performCombatAction(started, 'weapon_skill');
      const damage = (started.combat?.monsterHp ?? 0) - (resolved.combat?.monsterHp ?? 0);

      expect(status).toMatchObject({
        weaponId,
        available: true,
        definition: { weaponId }
      });
      expect(resolved.combat?.weaponFocus).toBe(0);
      expect(resolved.combat?.weaponSkillUsed).toBeUndefined();
      expect(resolved.combat?.turn).toBe((started.combat?.turn ?? 0) + 1);
      expect(resolved.combat?.log.join('')).toContain(status.definition?.name);
      expect(damage).toBeGreaterThan(0);

      return damage;
    });

    expect(new Set(damageByWeapon).size).toBe(weaponSkillIds.length);
  });

  it('routes weapon levels into every skill resolution', () => {
    for (const weaponId of weaponSkillIds) {
      const levelOne = withWeaponFocus(withMonsterHp(startWeaponSkillCombat(weaponId, 1), 1000));
      const levelThree = withWeaponFocus(withMonsterHp(startWeaponSkillCombat(weaponId, 3), 1000));
      const levelOneResult = performCombatAction(levelOne, 'weapon_skill');
      const levelThreeResult = performCombatAction(levelThree, 'weapon_skill');
      const levelOneDamage = (levelOne.combat?.monsterHp ?? 0) - (levelOneResult.combat?.monsterHp ?? 0);
      const levelThreeDamage = (levelThree.combat?.monsterHp ?? 0) - (levelThreeResult.combat?.monsterHp ?? 0);

      expect(levelThreeDamage, weaponId).toBeGreaterThan(levelOneDamage);
    }
  });

  it('gates weapon skills at 3/3, ignores the legacy used flag, and allows recharge in one encounter', () => {
    const started = withMonsterHp(startWeaponSkillCombat('armor_piercing_sword'), 1000);
    const legacyState: GameState = {
      ...started,
      combat: started.combat
        ? {
            ...started.combat,
            weaponFocus: 2,
            weaponSkillUsed: true
          }
        : started.combat
    };
    const rejected = performCombatAction(legacyState, 'weapon_skill');
    const ready = withWeaponFocus(legacyState);
    const firstUse = performCombatAction(ready, 'weapon_skill');
    let recharged = firstUse;
    for (let action = 0; action < 3; action += 1) recharged = performCombatAction(recharged, 'attack');
    const secondUse = performCombatAction(recharged, 'weapon_skill');

    expect(getWeaponSkillStatus(legacyState)).toMatchObject({
      available: false,
      currentFocus: 2,
      requiredFocus: 3
    });
    expect(rejected.combat).toEqual(legacyState.combat);
    expect(rejected.player).toEqual(legacyState.player);
    expect(rejected.log[0]).toContain('2/3');
    expect(getWeaponSkillStatus(ready).available).toBe(true);
    expect(firstUse.combat?.weaponFocus).toBe(0);
    expect(firstUse.combat?.weaponSkillUsed).toBe(true);
    expect(firstUse.combat?.log.join('')).toContain('战技消耗 3 点战意');
    expect(recharged.combat?.weaponFocus).toBe(3);
    expect(getWeaponSkillStatus(recharged).available).toBe(true);
    expect(secondUse.combat?.weaponFocus).toBe(0);
    expect(secondUse.combat?.turn).toBe((recharged.combat?.turn ?? 0) + 1);
  });

  it('starts focus at zero and resolves regular, recommended, and dangerous actions from pre-action intent', () => {
    const regularEncounter = withMonsterHp(startWeaponSkillCombat('armor_piercing_sword'), 1_000);
    const regularStart: GameState = {
      ...regularEncounter,
      combat: regularEncounter.combat ? { ...regularEncounter.combat, turn: 2 } : regularEncounter.combat
    };
    const recommendedStart = withMonsterHp(startWeaponSkillCombat('armor_piercing_sword'), 1_000);
    const dangerousStart = withWeaponFocus(
      withMonsterHp(startWeaponSkillCombat('bone_spear'), 1_000),
      1
    );
    const clampedStart = withWeaponFocus(
      withMonsterHp(startWeaponSkillCombat('bone_spear'), 1_000),
      0
    );

    expect(recommendedStart.combat?.weaponFocus).toBe(0);
    expect(recommendedStart.combat?.weaponSkillUsed).toBeUndefined();
    expect(getWeaponSkillStatus(recommendedStart)).toMatchObject({
      available: false,
      currentFocus: 0,
      requiredFocus: 3
    });

    const regular = performCombatAction(regularStart, 'attack');
    const recommended = performCombatAction(recommendedStart, 'attack');
    const dangerous = performCombatAction(dangerousStart, 'attack');
    const clamped = performCombatAction(clampedStart, 'attack');

    expect(regular.combat?.weaponFocus).toBe(1);
    expect(regular.combat?.log[0]).toContain('战意 +1');
    expect(recommended.combat?.weaponFocus).toBe(2);
    expect(recommended.combat?.log[0]).toContain('战意 +2');
    expect(dangerous.combat?.weaponFocus).toBe(0);
    expect(dangerous.combat?.log[0]).toContain('战意回落 1 点');
    expect(clamped.combat?.weaponFocus).toBe(0);
    expect(clamped.combat?.log.join('')).not.toContain('战意回落');
  });

  it('resets focus for the next encounter while carrying it through a boss awakening', () => {
    const first = withWeaponFocus(withMonsterHp(startWeaponSkillCombat('armor_piercing_sword'), 1), 2);
    const defeated = performCombatAction(first, 'attack');
    const nextEncounter = selectNode(withCurrentNode(defeated, 'butcher_turn'), 'butcher_turn');

    const bossStart = selectNode(
      withCurrentNode(
        enterDungeon(withEquippedWeapon(createInitialState(), 'armor_piercing_sword'), 'demon_tower_1'),
        'bone_lane_monster'
      ),
      'bone_lane_monster'
    );
    const awakeningAction = performCombatAction(
      withWeaponFocus(withMonsterHp(bossStart, 50), 2),
      'attack'
    );

    expect(defeated.combat).toBeUndefined();
    expect(nextEncounter.combat?.weaponFocus).toBe(0);
    expect(awakeningAction.combat?.bossPhase).toBe('awakened');
    expect(awakeningAction.combat?.weaponFocus).toBe(3);
  });

  it('rejects a weapon without a skill without spending a turn or triggering retaliation', () => {
    const started = startWeaponSkillCombat('training_blade');
    const status = getWeaponSkillStatus(started);
    const rejected = performCombatAction(started, 'weapon_skill');

    expect(status).toMatchObject({
      weaponId: 'training_blade',
      weaponName: EQUIPMENT.training_blade.name,
      available: false
    });
    expect(status.definition).toBeUndefined();
    expect(status.unavailableReason).toContain('没有可用战技');
    expect(rejected.combat).toEqual(started.combat);
    expect(rejected.player).toEqual(started.player);
    expect(rejected.run?.damageTaken).toBe(started.run?.damageTaken);
    expect(rejected.log[0]).toContain('没有可用战技');
  });

  it('applies ember skill healing before the monster retaliation', () => {
    const started = withWeaponFocus(withMonsterHp(startWeaponSkillCombat('ember_staff'), 1000));
    const wounded: GameState = {
      ...started,
      player: {
        ...started.player,
        hp: 4
      }
    };
    const resolved = performCombatAction(wounded, 'weapon_skill');

    expect(resolved.phase).toBe('combat');
    expect(resolved.player.hp).toBeGreaterThan(0);
    expect(resolved.combat?.turn).toBe((wounded.combat?.turn ?? 0) + 1);
    expect(resolved.combat?.log.join('')).toContain('余烬回流');
  });

  it('gives the starforged skill its awakened boss bonus through the live encounter profile', () => {
    const started = selectNode(
      withCurrentNode(
        enterDungeon(withEquippedWeapon(createInitialState(), 'starforged_edge', 3), 'demon_tower_1'),
        'bone_lane_monster'
      ),
      'bone_lane_monster'
    );
    const sealed = performCombatAction(
      withWeaponFocus({
        ...withMonsterHp(started, 1000),
        combat: started.combat ? { ...started.combat, monsterHp: 1000, bossPhase: 'sealed' } : started.combat
      }),
      'weapon_skill'
    );
    const awakened = performCombatAction(
      withWeaponFocus({
        ...withMonsterHp(started, 1000),
        combat: started.combat ? { ...started.combat, monsterHp: 1000, bossPhase: 'awakened' } : started.combat
      }),
      'weapon_skill'
    );
    const sealedDamage = 1000 - (sealed.combat?.monsterHp ?? 0);
    const awakenedDamage = 1000 - (awakened.combat?.monsterHp ?? 0);

    expect(awakenedDamage).toBeGreaterThan(sealedDamage);
    expect(awakened.combat?.log.join('')).toContain('觉醒星痕共鸣');
  });

  it('keeps boss half-health awakening in the weapon skill damage path', () => {
    const started = selectNode(
      withCurrentNode(
        enterDungeon(withEquippedWeapon(createInitialState(), 'armor_piercing_sword'), 'demon_tower_1'),
        'bone_lane_monster'
      ),
      'bone_lane_monster'
    );
    const nearThreshold = withWeaponFocus(withMonsterHp(started, 50));
    const awakened = performCombatAction(nearThreshold, 'weapon_skill');

    expect(awakened.phase).toBe('combat');
    expect(awakened.combat?.bossPhase).toBe('awakened');
    expect(awakened.combat?.log.join('')).toContain(getBossDefinition('demon_tower_1').awakeningLine);
  });

  it('settles a weapon skill kill through the normal combat victory flow', () => {
    const started = withWeaponFocus(withMonsterHp(startWeaponSkillCombat('armor_piercing_sword'), 1));
    const defeated = performCombatAction(started, 'weapon_skill');

    expect(defeated.phase).toBe('explore');
    expect(defeated.combat).toBeUndefined();
    expect(defeated.run?.clearedNodeIds).toContain('fog_lesser_demon');
    expect(defeated.run?.lootBag.rewardPoints).toBe(game.MONSTERS.fog_lesser_demon.rewardPoints);
    expect(defeated.inventory.demon_bone).toBe(started.inventory.demon_bone + 1);
    expect(defeated.log[0]).toContain('倒下');
  });

  it('supports capturing weakened monsters as pets during combat', () => {
    let state = selectNode(
      enterDungeon(prepareTacticalItems(buyItem(createInitialState(), 'capture_net'), 'capture_net'), 'demon_tower_1'),
      'fog_lesser_demon'
    );
    const tooEarly = capturePet(state, 'mist_kitten');

    expect(tooEarly.phase).toBe('combat');
    expect(game.getCurrentDungeonLaw(tooEarly)?.state.combatVictoryNodeIds).toEqual([]);

    state = performCombatAction(tooEarly, 'attack');
    state = performCombatAction(state, 'attack');
    expect(game.getCurrentDungeonLaw(state)?.state.combatOpenings.fog_lesser_demon).toMatchObject({
      isBoss: false,
      style: 'force'
    });

    const captured = capturePet(state, 'mist_kitten');

    expect(captured.phase).toBe('explore');
    expect(captured.ownedPets).toContain('mist_kitten');
    expect(captured.activePet).toBe('mist_kitten');
    expect(captured.inventory.capture_net).toBe(0);
    expect(captured.run?.clearedNodeIds).toContain('fog_lesser_demon');
    expect(game.getCurrentDungeonLaw(captured)?.state.combatVictoryNodeIds).toEqual(['fog_lesser_demon']);

    const duplicateNode = DUNGEONS.demon_tower_1.nodes.find(
      (node) => node.monsterId === 'fog_lesser_demon' && node.id !== 'fog_lesser_demon'
    );
    if (!duplicateNode) throw new Error('Missing duplicate capture fixture');
    const duplicateCombat = selectNode(withCurrentNode(captured, duplicateNode.id), duplicateNode.id);
    const duplicate = capturePet(duplicateCombat, 'mist_kitten');
    expect(duplicate.phase).toBe('combat');
    expect(game.getCurrentDungeonLaw(duplicate)?.state.combatVictoryNodeIds).toEqual(['fog_lesser_demon']);
  });

  it('turns only the configured monster node into a boosted boss encounter', () => {
    const entered = enterDungeon(createInitialState(), 'demon_tower_1');
    const bossCombat = selectNode(withCurrentNode(entered, 'bone_lane_monster'), 'bone_lane_monster');
    const ordinaryCombat = selectNode(withCurrentNode(entered, 'butcher_turn'), 'butcher_turn');
    const bossProfile = game.getCombatEncounterProfile(bossCombat);
    const ordinaryProfile = game.getCombatEncounterProfile(ordinaryCombat);

    expect(bossCombat.combat?.bossPhase).toBe('sealed');
    expect(bossProfile?.boss?.definition.bossTitle).toBe('雾塔剔骨监斩官');
    expect(bossProfile?.monster.maxHp).toBeGreaterThan(game.MONSTERS.tower_butcher.maxHp);
    expect(bossCombat.combat?.monsterHp).toBe(bossProfile?.monster.maxHp);
    expect(ordinaryCombat.combat?.bossPhase).toBeUndefined();
    expect(ordinaryProfile?.boss).toBeUndefined();
    expect(ordinaryProfile?.monster.maxHp).toBe(game.MONSTERS.tower_butcher.maxHp);
  });

  it('awakens a boss once at half health and applies its stronger phase', () => {
    const started = selectNode(
      withCurrentNode(enterDungeon(createInitialState(), 'demon_tower_1'), 'bone_lane_monster'),
      'bone_lane_monster'
    );
    const sealedProfile = game.getCombatEncounterProfile(started);
    const nearThreshold: GameState = {
      ...started,
      combat: started.combat
        ? {
            ...started.combat,
            monsterHp: Math.floor((sealedProfile?.monster.maxHp ?? 0) / 2) + 1
          }
        : started.combat
    };
    const awakened = performCombatAction(nearThreshold, 'attack');
    const awakenedProfile = game.getCombatEncounterProfile(awakened);
    const actedAgain = performCombatAction(awakened, 'guard');
    const awakeningLine = getBossDefinition('demon_tower_1').awakeningLine;

    expect(awakened.phase).toBe('combat');
    expect(awakened.combat?.bossPhase).toBe('awakened');
    expect(awakenedProfile?.monster.attack).toBeGreaterThan(sealedProfile?.monster.attack ?? 0);
    expect(awakened.combat?.log.some((line) => line.includes(awakeningLine))).toBe(true);
    expect(actedAgain.combat?.log.filter((line) => line.includes(awakeningLine))).toHaveLength(1);
  });

  it('adds the boss bounty to unsecured loot and opens an elite equipment choice', () => {
    const started = selectNode(
      withCurrentNode(enterDungeon(createInitialState(), 'demon_tower_1'), 'bone_lane_monster'),
      'bone_lane_monster'
    );
    const defeated = performCombatAction(
      {
        ...started,
        combat: started.combat ? { ...started.combat, monsterHp: 1 } : started.combat
      },
      'attack'
    );
    const boss = getBossDefinition('demon_tower_1');

    expect(defeated.phase).toBe('explore');
    expect(defeated.run?.clearedNodeIds).toContain(boss.nodeId);
    expect(defeated.run?.lootBag.rewardPoints).toBe(
      game.MONSTERS.tower_butcher.rewardPoints + (boss.bonusReward.rewardPoints ?? 0)
    );
    expect(defeated.run?.pendingEquipmentOffer?.equipmentIds).toHaveLength(3);
    expect(defeated.log[0]).toContain(boss.sealName);
  });

  it('keeps the exit sealed until the configured boss node is cleared', () => {
    const entered = enterDungeon(createInitialState(), 'demon_tower_1');
    const blocked = resolveExit(selectNode(withCurrentNode(entered, 'tower_exit'), 'tower_exit'));
    const unsealed = resolveExit(
      selectNode(withCurrentNode(withBossCleared(entered), 'tower_exit'), 'tower_exit')
    );
    const hub = returnToHub(unsealed);
    const rerun = enterDungeon(hub, 'demon_tower_1');

    expect(blocked.phase).toBe('explore');
    expect(blocked.completedDungeonIds).toEqual([]);
    expect(blocked.log[0]).toContain('出口仍被封印');
    expect(unsealed.phase).toBe('result');
    expect(unsealed.completedDungeonIds).toContain('demon_tower_1');
    expect(game.getBossSealStatus(hub, 'demon_tower_1')?.cleared).toBe(true);
    expect(game.getBossSealStatus(rerun, 'demon_tower_1')?.cleared).toBe(false);
  });

  it('lets purchased tools counter traps instead of taking raw damage', () => {
    const entered = enterDungeon(createInitialState(), 'demon_tower_1');
    const trapState = selectNode(withCurrentNode(entered, 'blood_rune_trap'), 'blood_rune_trap');
    const damaged = handleTrap(trapState);

    expect(damaged.player.hp).toBeLessThan(trapState.player.hp);

    const prepared = enterDungeon(buyItem(createInitialState(), 'dispel_talisman'), 'demon_tower_1');
    const counteredTrap = selectNode(withCurrentNode(prepared, 'blood_rune_trap'), 'blood_rune_trap');
    const countered = handleTrap(counteredTrap);

    expect(countered.player.hp).toBe(counteredTrap.player.hp);
    expect(countered.inventory.dispel_talisman).toBe(0);
    expect(countered.run?.clearedNodeIds).toContain('blood_rune_trap');
  });

  it('does not let a portal bypass a locked mainline dungeon gate', () => {
    const entered = enterDungeon(createInitialState(), 'demon_tower_1');
    const portal = selectNode(
      withCurrentNode({
        ...entered,
        inventory: {
          ...entered.inventory,
          gate_sigil: 1
        }
      }, 'cracked_portal'),
      'cracked_portal'
    );
    const blocked = usePortal(portal);

    expect(blocked.phase).toBe('explore');
    expect(blocked.run?.dungeonId).toBe('demon_tower_1');
    expect(blocked.run?.currentNodeId).toBe('cracked_portal');
    expect(blocked.run?.clearedNodeIds).not.toContain('cracked_portal');
    expect(blocked.run?.usedItems).not.toContain('gate_sigil');
    expect(blocked.inventory.gate_sigil).toBe(1);
    expect(blocked.log[0]).toMatch(/主线任务|副本锁定/);
  });

  it('uses a portal node to jump into an unlocked dungeon branch', () => {
    const progressed = withCompletedDungeons(createInitialState(), ['demon_tower_1']);
    const entered = enterDungeon(progressed, 'demon_tower_1');
    const portal = selectNode(withCurrentNode(entered, 'cracked_portal'), 'cracked_portal');
    const shifted = usePortal(portal);

    expect(shifted.phase).toBe('explore');
    expect(shifted.run?.dungeonId).toBe('metro_abyss');
    expect(shifted.run?.currentNodeId).toBe('platform_arrival');
    expect(shifted.log[0]).toContain('传送');
  });

  it('lets methods unlock safer reward collection routes', () => {
    const entered = enterDungeon(learnMethod(createInitialState(), 'mist_breathing'), 'demon_tower_1');
    const rewardNode = selectNode(withCurrentNode(entered, 'sealed_cache'), 'sealed_cache');
    const looted = collectReward(rewardNode);

    expect(looted.inventory.hidden_stone).toBeGreaterThanOrEqual(1);
    expect(looted.rewardPoints).toBeGreaterThan(entered.rewardPoints);
    expect(looted.run?.clearedNodeIds).toContain('sealed_cache');
  });

  it('does not pay reward or exit nodes twice after they are cleared', () => {
    const rewardNode = selectNode(withCurrentNode(enterDungeon(createInitialState(), 'demon_tower_1'), 'sealed_cache'), 'sealed_cache');
    const looted = collectReward(rewardNode);
    const repeatedReward = collectReward(looted);

    expect(repeatedReward.rewardPoints).toBe(looted.rewardPoints);
    expect(repeatedReward.inventory.medicine_ash).toBe(looted.inventory.medicine_ash);

    const exitNode = selectNode(
      withCurrentNode(withBossCleared(enterDungeon(createInitialState(), 'demon_tower_1')), 'tower_exit'),
      'tower_exit'
    );
    const exited = resolveExit(exitNode);
    const repeatedExit = resolveExit(exited);

    expect(repeatedExit.rewardPoints).toBe(exited.rewardPoints);
    expect(repeatedExit.lingyun).toBe(exited.lingyun);
  });

  it('tracks node rewards as unsecured run loot while keeping consumables usable', () => {
    const entered = enterDungeon(buyItem(createInitialState(), 'healing_pill'), 'demon_tower_1');
    const rewardNode = selectNode(withCurrentNode(entered, 'mist_herb_cache'), 'mist_herb_cache');
    const looted = collectReward(rewardNode);
    const combat = selectNode(withCurrentNode(looted, 'fog_patrol_pair'), 'fog_patrol_pair');
    const used = performCombatAction(combat, 'use_healing_pill');

    expect(looted.rewardPoints).toBe(entered.rewardPoints + 85);
    expect(looted.inventory.healing_pill).toBe(2);
    expect(looted.run?.lootBag).toMatchObject({ rewardPoints: 85, items: { healing_pill: 1 } });
    expect(used.inventory.healing_pill).toBe(1);
    expect(used.run?.lootBag.items.healing_pill ?? 0).toBe(0);
  });

  it('locks an elite node on a deterministic equipment choice and carries the selected item', () => {
    const eliteNode = selectNode(
      withCurrentNode(enterDungeon(createInitialState(), 'demon_tower_1'), 'butcher_turn'),
      'butcher_turn'
    );
    const defeated = performCombatAction(
      {
        ...eliteNode,
        combat: eliteNode.combat ? { ...eliteNode.combat, monsterHp: 1 } : eliteNode.combat
      },
      'attack'
    );
    const equipmentId = defeated.run?.pendingEquipmentOffer?.equipmentIds[0];
    const blocked = game.moveToNode(defeated, 'side_gate_portal');

    expect(equipmentId).toBeDefined();
    expect(defeated.run?.lootOffersMade).toBe(1);
    expect(blocked.run?.currentNodeId).toBe('butcher_turn');
    expect(blocked.log[0]).toContain('精英战利品');
    if (!equipmentId) return;

    const selected = resolveEquipmentLoot(defeated, equipmentId);
    const moved = game.moveToNode(selected, 'side_gate_portal');

    expect(selected.run?.pendingEquipmentOffer).toBeUndefined();
    expect(selected.run?.lootBag.equipmentIds).toContain(equipmentId);
    expect(selected.ownedEquipment).not.toContain(equipmentId);
    expect(moved.run?.currentNodeId).toBe('side_gate_portal');
  });

  it('banks selected elite equipment only on clear and loses it on retreat', () => {
    const eliteNode = selectNode(
      withCurrentNode(enterDungeon(createInitialState(), 'demon_tower_1'), 'butcher_turn'),
      'butcher_turn'
    );
    const defeated = performCombatAction(
      {
        ...eliteNode,
        combat: eliteNode.combat ? { ...eliteNode.combat, monsterHp: 1 } : eliteNode.combat
      },
      'attack'
    );
    const equipmentId = defeated.run?.pendingEquipmentOffer?.equipmentIds[0];
    expect(equipmentId).toBeDefined();
    if (!equipmentId) return;

    const selected = resolveEquipmentLoot(defeated, equipmentId);
    const cleared = resolveExit(selectNode(withCurrentNode(withBossCleared(selected), 'tower_exit'), 'tower_exit'));
    const retreated = resolveRetreat(selected);

    expect(cleared.ownedEquipment).toContain(equipmentId);
    expect(cleared.equipmentLevels[equipmentId]).toBe(1);
    expect(cleared.run?.lastLootSettlement?.retained.equipmentIds).toContain(equipmentId);
    expect(retreated.ownedEquipment).not.toContain(equipmentId);
    expect(retreated.run?.lastLootSettlement?.lost.equipmentIds).toContain(equipmentId);
  });

  it('applies equipment affixes and two-piece set bonuses to derived stats', () => {
    const base = createInitialState();
    const withForgeWeaponOnly: GameState = {
      ...base,
      ownedEquipment: [...base.ownedEquipment, 'armor_piercing_sword', 'guardian_plate'],
      equipmentLevels: {
        ...base.equipmentLevels,
        armor_piercing_sword: 1,
        guardian_plate: 1
      },
      equipped: {
        ...base.equipped,
        weapon: 'armor_piercing_sword'
      }
    };
    const withForgeSet: GameState = {
      ...withForgeWeaponOnly,
      equipped: {
        ...withForgeWeaponOnly.equipped,
        armor: 'guardian_plate'
      }
    };

    expect(getDerivedStats(withForgeSet).attack).toBeGreaterThan(getDerivedStats(withForgeWeaponOnly).attack);
    expect(getDerivedStats(withForgeSet).defense).toBeGreaterThan(getDerivedStats(withForgeWeaponOnly).defense);
  });

  it('upgrades an owned pet by paying the cultivation cost and increasing its active stat bonus', () => {
    const upgradePet = (game as typeof game & { upgradePet?: (state: GameState, petId: PetId) => GameState }).upgradePet;
    const withPet = {
      ...buyPet(createInitialState(), 'contract_sprite'),
      rewardPoints: 500,
      lingyun: 3,
      inventory: {
        ...createInitialState().inventory,
        focus_incense: 1
      }
    };
    const before = getDerivedStats(withPet);

    expect(upgradePet).toBeTypeOf('function');
    if (!upgradePet) return;

    const upgraded = upgradePet(withPet, 'contract_sprite');

    expect(upgraded.petLevels.contract_sprite).toBe(2);
    expect(upgraded.rewardPoints).toBe(withPet.rewardPoints - 120);
    expect(upgraded.lingyun).toBe(withPet.lingyun - 2);
    expect(upgraded.inventory.focus_incense).toBe(0);
    expect(getDerivedStats(upgraded).artPower).toBeGreaterThan(before.artPower);
  });

  it('routes monster special effects through combat actions and persists their effect state', () => {
    let state = selectNode(
      withCurrentNode(enterDungeon(withCompletedDungeons(createInitialState(), ['demon_tower_1', 'metro_abyss']), 'starfall_mine'), 'rift_beast'),
      'rift_beast'
    );

    state = performCombatAction(state, 'attack');
    state = performCombatAction(state, 'attack');

    expect(state.combat?.monsterHp).toBe(62);
    expect(state.combat?.log.some((line) => line.includes('裂门蜕兽偏移身位'))).toBe(true);
    expect((state.combat as { effects?: { lastShiftTurn?: number } } | undefined)?.effects?.lastShiftTurn).toBe(2);
  });

  it('charges mist breathing during guard and releases it into a stronger real combat art hit', () => {
    const start = selectNode(
      withCurrentNode(enterDungeon(learnMethod(withCompletedDungeons(createInitialState(), ['demon_tower_1']), 'mist_breathing'), 'metro_abyss'), 'tide_boatman'),
      'tide_boatman'
    );

    const directArtStartHp = start.combat?.monsterHp ?? 0;
    const directArt = performCombatAction(start, 'art');
    const directArtDamage = directArtStartHp - (directArt.combat?.monsterHp ?? 0);

    const guarded = performCombatAction(start, 'guard');
    const chargedArtStartHp = guarded.combat?.monsterHp ?? 0;
    const chargedArt = performCombatAction(guarded, 'art');
    const chargedArtDamage = chargedArtStartHp - (chargedArt.combat?.monsterHp ?? 0);

    expect(guarded.combat?.log.some((line) => line.includes('吐纳诀') && line.includes('蓄息'))).toBe(true);
    expect((guarded.combat as { effects?: { breathStacks?: number } } | undefined)?.effects?.breathStacks).toBe(1);
    expect(chargedArtDamage).toBeGreaterThan(directArtDamage);
    expect(chargedArt.combat?.log.some((line) => line.includes('释息') && line.includes('蓄息'))).toBe(true);
    expect((chargedArt.combat as { effects?: { breathStacks?: number } } | undefined)?.effects?.breathStacks).toBe(0);
  });

  it('evaluates main god directives from the live run context', () => {
    const demonTowerRun: GameState = {
      ...enterDungeon(createInitialState(), 'demon_tower_1'),
      learnedMethods: ['mist_breathing'],
      run: {
        ...enterDungeon(createInitialState(), 'demon_tower_1').run!,
        dungeonId: 'demon_tower_1',
        currentNodeId: 'tower_exit',
        clearedNodeIds: ['fog_lesser_demon', 'blood_rune_trap', 'sealed_cache'],
        captures: 1,
        capturedPetIds: ['mist_kitten'],
        usedItems: [],
        damageTaken: 12,
        resolvedEventIds: [],
        eventLog: []
      }
    };
    const metroRun: GameState = {
      ...enterDungeon(withCompletedDungeons(createInitialState(), ['demon_tower_1']), 'metro_abyss'),
      run: {
        ...enterDungeon(withCompletedDungeons(createInitialState(), ['demon_tower_1']), 'metro_abyss').run!,
        dungeonId: 'metro_abyss',
        currentNodeId: 'metro_exit',
        clearedNodeIds: ['platform_arrival', 'mirror_spider', 'ticket_gate', 'metro_exit'],
        captures: 0,
        capturedPetIds: [],
        usedItems: ['thunder_talisman'],
        damageTaken: 4,
        resolvedEventIds: [],
        eventLog: []
      }
    };
    const ashRun: GameState = {
      ...enterDungeon(
        withCompletedDungeons(createInitialState(), ['demon_tower_1', 'metro_abyss', 'starfall_mine', 'rust_hospital']),
        'ash_arena'
      ),
      activePet: 'ash_hound',
      run: {
        ...enterDungeon(
          withCompletedDungeons(createInitialState(), ['demon_tower_1', 'metro_abyss', 'starfall_mine', 'rust_hospital']),
          'ash_arena'
        ).run!,
        dungeonId: 'ash_arena',
        currentNodeId: 'arena_exit',
        clearedNodeIds: ['ash_gate', 'ash_duelist', 'furnace_judge', 'arena_exit'],
        captures: 0,
        capturedPetIds: [],
        usedItems: [],
        damageTaken: 8,
        resolvedEventIds: [],
        eventLog: []
      }
    };

    expect(game.getDirectiveEvaluation(demonTowerRun).objectiveResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'demon_tower_1_low_damage', completed: true }),
        expect.objectContaining({ id: 'demon_tower_1_capture_mist_kitten', completed: true }),
        expect.objectContaining({ id: 'demon_tower_1_mist_breathing', completed: true })
      ])
    );
    expect(game.getDirectiveEvaluation(metroRun).objectiveResults).toContainEqual(
      expect.objectContaining({ id: 'metro_abyss_no_talisman', completed: false })
    );
    expect(game.getDirectiveEvaluation(ashRun).objectiveResults).toContainEqual(
      expect.objectContaining({ id: 'ash_arena_active_ash_hound', completed: true })
    );
  });

  it('resolves dungeon events into state rewards, damage, logs, and resolved ids', () => {
    const state = withCurrentNode(enterDungeon(learnMethod(createInitialState(), 'mist_breathing'), 'demon_tower_1'), 'blood_rune_trap');
    const events = game.getAvailableDungeonEvents(state);

    expect(events[0].id).toBe('blood_rune_stair');
    expect(events[0].options[0].available).toBe(true);

    const resolved = game.resolveDungeonEvent(state, 'blood_rune_stair', 'breathe_through_runes');

    expect(resolved.rewardPoints).toBe(state.rewardPoints + 180);
    expect(resolved.lingyun).toBe(state.lingyun + 1);
    expect(resolved.inventory.hidden_stone).toBe(state.inventory.hidden_stone + 1);
    expect(resolved.player.hp).toBe(state.player.hp);
    expect(resolved.log[0]).toContain('吐纳诀压住血字阶梯');
    expect(resolved.run?.resolvedEventIds).toContain('blood_rune_stair');
    expect(resolved.run?.eventLog).toContain('吐纳诀压住血字阶梯，雾后石从暗格里松动。');
  });

  it('does not resolve the same dungeon event twice', () => {
    const state = withCurrentNode(enterDungeon(learnMethod(createInitialState(), 'mist_breathing'), 'demon_tower_1'), 'blood_rune_trap');
    const resolved = game.resolveDungeonEvent(state, 'blood_rune_stair', 'breathe_through_runes');
    const repeated = game.resolveDungeonEvent(resolved, 'blood_rune_stair', 'breathe_through_runes');

    expect(repeated.rewardPoints).toBe(resolved.rewardPoints);
    expect(repeated.lingyun).toBe(resolved.lingyun);
    expect(repeated.inventory.hidden_stone).toBe(resolved.inventory.hidden_stone);
    expect(repeated.run?.resolvedEventIds.filter((eventId) => eventId === 'blood_rune_stair')).toHaveLength(1);
  });

  it('records combat item usage in the current run', () => {
    let state = selectNode(
      enterDungeon(
        prepareTacticalItems(buyItem(createInitialState(), 'thunder_talisman'), 'thunder_talisman'),
        'demon_tower_1'
      ),
      'fog_lesser_demon'
    );

    state = performCombatAction(state, 'use_thunder_talisman');

    expect(state.inventory.thunder_talisman).toBe(0);
    expect(state.run?.usedItems).toContain('thunder_talisman');
  });

  it('routes healing pill use through dream jailer consumable backlash', () => {
    const ready = withCompletedDungeons(createInitialState(), ['demon_tower_1', 'metro_abyss', 'starfall_mine', 'rust_hospital', 'ash_arena']);
    const stocked = {
      ...ready,
      inventory: {
        ...ready.inventory,
        healing_pill: 1
      }
    };
    const state = selectNode(withCurrentNode(enterDungeon(stocked, 'dream_archive'), 'dream_jailer'), 'dream_jailer');
    const normalHit = performCombatAction(state, 'attack');
    const pillHit = performCombatAction(state, 'use_healing_pill');
    const normalDamageTaken = state.player.hp - normalHit.player.hp;
    const pillDamageTaken = state.player.hp - pillHit.player.hp;
    const visibleLogs = `${pillHit.combat?.log.join('\n') ?? ''}\n${pillHit.log.join('\n')}`;

    expect(visibleLogs).toMatch(/梦锁反噬|消耗品被梦锁反噬/);
    expect(pillDamageTaken).toBe(normalDamageTaken + 5);
  });

  it('uses cloud step footwork to make the same physical attack hit harder', () => {
    const bare = selectNode(enterDungeon(createInitialState(), 'demon_tower_1'), 'fog_lesser_demon');
    const cloud = selectNode(enterDungeon(learnMethod(createInitialState(), 'cloud_step'), 'demon_tower_1'), 'fog_lesser_demon');

    const bareStartHp = bare.combat?.monsterHp ?? 0;
    const cloudStartHp = cloud.combat?.monsterHp ?? 0;
    const bareHit = performCombatAction(bare, 'attack');
    const cloudHit = performCombatAction(cloud, 'attack');
    const bareDamage = bareStartHp - (bareHit.combat?.monsterHp ?? 0);
    const cloudDamage = cloudStartHp - (cloudHit.combat?.monsterHp ?? 0);

    expect(cloudDamage).toBeGreaterThan(bareDamage);
    expect(cloudHit.combat?.log.some((line) => /云隙步|游斗/.test(line))).toBe(true);
  });

  it('uses cloud step to turn the same escape check from failure into success', () => {
    const base = withCompletedDungeons(createInitialState(), [
      'demon_tower_1',
      'metro_abyss',
      'starfall_mine',
      'rust_hospital',
      'ash_arena'
    ]);
    const trapped = selectNode(withCurrentNode(enterDungeon(base, 'dream_archive'), 'paper_librarian'), 'paper_librarian');
    const cloudTrapped = selectNode(
      withCurrentNode(enterDungeon({ ...base, learnedMethods: ['cloud_step'] }, 'dream_archive'), 'paper_librarian'),
      'paper_librarian'
    );
    const cloudHpBefore = cloudTrapped.player.hp;

    const failedEscape = performCombatAction(trapped, 'escape');
    const escaped = performCombatAction(cloudTrapped, 'escape');

    expect(failedEscape.phase).toBe('combat');
    expect(escaped.phase).toBe('explore');
    expect(escaped.player.hp).toBeGreaterThan(cloudHpBefore - 8);
    expect(escaped.log[0]).toMatch(/云隙步|游斗/);
  });

  it('settles lethal retaliation after a failed escape without granting focus', () => {
    const base = withCompletedDungeons(createInitialState(), [
      'demon_tower_1',
      'metro_abyss',
      'starfall_mine',
      'rust_hospital',
      'ash_arena'
    ]);
    const trapped = selectNode(
      withCurrentNode(enterDungeon(base, 'dream_archive'), 'paper_librarian'),
      'paper_librarian'
    );
    const lowHealth: GameState = {
      ...trapped,
      player: { ...trapped.player, hp: 1 },
      combat: trapped.combat ? { ...trapped.combat, weaponFocus: 2 } : trapped.combat
    };

    const failed = performCombatAction(lowHealth, 'escape');

    expect(failed.phase).toBe('result');
    expect(failed.player.hp).toBe(0);
    expect(failed.combat).toBeUndefined();
    expect(failed.lastOutcome).toContain('outcome=failed_recovered');
    expect(failed.log.join('')).not.toContain('战意');
  });

  it('settles lethal retaliation after a healing pill instead of leaving zero-HP combat', () => {
    const unlocked = withCompletedDungeons(createInitialState(), [...DUNGEON_ORDER]);
    const boostedDraft: GameState = {
      ...unlocked,
      inventory: { ...unlocked.inventory, healing_pill: 1 },
      player: {
        ...unlocked.player,
        base: { ...unlocked.player.base, body: 65 }
      }
    };
    const boostedMaxHp = getDerivedStats(boostedDraft).maxHp;
    const bossNodeId = getBossDefinition('void_citadel').nodeId;
    const started = selectNode(
      withCurrentNode(
        enterDungeon(
          {
            ...boostedDraft,
            player: { ...boostedDraft.player, hp: 1, maxHp: boostedMaxHp }
          },
          'void_citadel'
        ),
        bossNodeId
      ),
      bossNodeId
    );
    const focused: GameState = {
      ...started,
      combat: started.combat ? { ...started.combat, weaponFocus: 2 } : started.combat
    };

    const failed = performCombatAction(focused, 'use_healing_pill');

    expect(failed.inventory.healing_pill).toBe(0);
    expect(failed.phase).toBe('result');
    expect(failed.player.hp).toBe(0);
    expect(failed.combat).toBeUndefined();
    expect(failed.lastOutcome).toContain('outcome=failed_recovered');
    expect(failed.log.join('')).not.toContain('战意');
  });

  it('settles a low-health cloud step escape as a result instead of exploration', () => {
    const base = withCompletedDungeons(createInitialState(), [
      'demon_tower_1',
      'metro_abyss',
      'starfall_mine',
      'rust_hospital',
      'ash_arena'
    ]);
    const cloudTrapped = selectNode(
      withCurrentNode(enterDungeon({ ...base, learnedMethods: ['cloud_step'] }, 'dream_archive'), 'paper_librarian'),
      'paper_librarian'
    );
    const lowHealth = {
      ...cloudTrapped,
      player: {
        ...cloudTrapped.player,
        hp: 1
      }
    };

    const escaped = performCombatAction(lowHealth, 'escape');

    expect(escaped.phase).toBe('result');
    expect(escaped.combat).toBeUndefined();
    expect(escaped.player.hp).toBe(0);
    expect(escaped.lastOutcome).toContain('failed_recovered');
  });

  it('spends an armor patch during guard to reduce one incoming hit', () => {
    const bare = selectNode(enterDungeon(createInitialState(), 'demon_tower_1'), 'fog_lesser_demon');
    const patched = selectNode(
      enterDungeon(
        prepareTacticalItems(
          {
            ...createInitialState(),
            inventory: {
              ...createInitialState().inventory,
              armor_patch: 1
            }
          },
          'armor_patch'
        ),
        'demon_tower_1'
      ),
      'fog_lesser_demon'
    );

    const bareGuard = performCombatAction(bare, 'guard');
    const patchedGuard = performCombatAction(patched, 'guard');

    expect(patchedGuard.player.hp).toBeGreaterThan(bareGuard.player.hp);
    expect(patchedGuard.inventory.armor_patch).toBe(0);
    expect(patchedGuard.run?.usedItems).toContain('armor_patch');
    expect(patchedGuard.combat?.log.some((line) => line.includes('护甲补片'))).toBe(true);
  });

  it('turns iron body guard into a reduced guard-counter hit', () => {
    const base = withCompletedDungeons(createInitialState(), ['demon_tower_1', 'metro_abyss']);
    const ordinary = selectNode(
      withCurrentNode(enterDungeon(
        {
          ...base,
          player: {
            ...base.player,
            base: {
              ...base.player.base,
              body: base.player.base.body + (METHODS.iron_body.stats.body ?? 0)
            }
          }
        },
        'starfall_mine'
      ), 'mine_shell_guard'),
      'mine_shell_guard'
    );
    const ironBody = selectNode(
      withCurrentNode(enterDungeon(
        {
          ...base,
          learnedMethods: ['iron_body']
        },
        'starfall_mine'
      ), 'mine_shell_guard'),
      'mine_shell_guard'
    );

    const ordinaryGuard = performCombatAction(ordinary, 'guard');
    const ironBodyGuard = performCombatAction(ironBody, 'guard');
    const ironBodyLog = ironBodyGuard.combat?.log.join('\n') ?? '';

    expect(ordinaryGuard.combat?.monsterHp).toBe(ordinary.combat?.monsterHp);
    expect(ironBodyGuard.run?.damageTaken).toBeLessThan(ordinaryGuard.run?.damageTaken ?? Infinity);
    expect(ironBodyGuard.combat?.monsterHp).toBeLessThan(ironBody.combat?.monsterHp ?? 0);
    expect(ironBodyLog).toMatch(/铁衣诀.*守反|守反.*铁衣诀/);
  });

  it('settles low-health iron body guard as recovered failure when counter does not kill the monster', () => {
    const combat = selectNode(
      enterDungeon(
        {
          ...createInitialState(),
          learnedMethods: ['iron_body'] as GameState['learnedMethods']
        },
        'demon_tower_1'
      ),
      'fog_lesser_demon'
    );
    const wounded: GameState = {
      ...combat,
      player: {
        ...combat.player,
        hp: 1
      }
    };

    const guarded = performCombatAction(wounded, 'guard');

    expect(guarded.phase).toBe('result');
    expect(guarded.combat).toBeUndefined();
    expect(guarded.player.hp).toBe(0);
    expect(guarded.lastOutcome).toContain('outcome=failed_recovered');
  });

  it('settles simultaneous iron body guard death as failure before victory rewards', () => {
    const combat = selectNode(
      enterDungeon(
        {
          ...createInitialState(),
          learnedMethods: ['iron_body'] as GameState['learnedMethods']
        },
        'demon_tower_1'
      ),
      'fog_lesser_demon'
    );
    const wounded: GameState = {
      ...combat,
      player: {
        ...combat.player,
        hp: 1
      },
      combat: {
        ...combat.combat!,
        monsterHp: 2
      }
    };

    const guarded = performCombatAction(wounded, 'guard');

    expect(guarded.phase).toBe('result');
    expect(guarded.combat).toBeUndefined();
    expect(guarded.completedDungeonIds).toEqual([]);
    expect(guarded.run?.clearedNodeIds).not.toContain('fog_lesser_demon');
    expect(guarded.lastOutcome).toContain('outcome=failed_recovered');
  });

  it('uses spirit bait to widen the capture window and records the bait', () => {
    const entered = enterDungeon(
      prepareTacticalItems(
        {
          ...withCompletedDungeons(createInitialState(), ['demon_tower_1', 'metro_abyss']),
          inventory: {
            ...createInitialState().inventory,
            spirit_bait: 1
          }
        },
        'spirit_bait'
      ),
      'starfall_mine'
    );
    const barelyAboveNetWindow: GameState = {
      ...entered,
      phase: 'combat',
      combat: {
        nodeId: 'mine_arrival',
        monsterId: 'spark_imp',
        monsterHp: 16,
        turn: 1,
        guarding: false,
        effects: {},
        log: ['跳火小鬼出现。']
      }
    };

    const captured = capturePet(barelyAboveNetWindow, 'ash_hound');

    expect(captured.phase).toBe('explore');
    expect(captured.ownedPets).toContain('ash_hound');
    expect(captured.inventory.spirit_bait).toBe(0);
    expect(captured.run?.usedItems).toContain('spirit_bait');
    expect(captured.log[0]).toContain('灵饵');
  });

  it('surfaces pet utility passives in traps and portals as logs with benefits', () => {
    const scoutTrap = selectNode(
      withCurrentNode(enterDungeon(
        {
          ...createInitialState(),
          ownedPets: ['mist_kitten'],
          petLevels: { mist_kitten: 1 },
          activePet: 'mist_kitten'
        },
        'demon_tower_1'
      ), 'blood_rune_trap'),
      'blood_rune_trap'
    );
    const scouted = handleTrap(scoutTrap);
    expect(scouted.log[0]).toContain('探陷灵宠');

    const anchoredPortal = selectNode(
      withCurrentNode(enterDungeon(
        {
          ...withCompletedDungeons(createInitialState(), ['demon_tower_1']),
          ownedPets: ['mirror_moth'],
          petLevels: { mirror_moth: 1 },
          activePet: 'mirror_moth'
        },
        'demon_tower_1'
      ), 'cracked_portal'),
      'cracked_portal'
    );
    const shifted = usePortal(anchoredPortal);

    expect(shifted.rewardPoints).toBeGreaterThan(anchoredPortal.rewardPoints);
    expect(shifted.log[0]).toContain('锚门灵宠');
  });

  it('uses run economy for exit settlement and does not grant the economy reward twice', () => {
    const exitNode = selectNode(
      withCurrentNode(withBossCleared(enterDungeon(createInitialState(), 'demon_tower_1')), 'tower_exit'),
      'tower_exit'
    );
    const exited = resolveExit(exitNode);
    const repeatedExit = resolveExit(exited);

    expect(exited.lastOutcome).toContain('outcome=');
    expect(exited.lastOutcome).toContain('score=');
    expect(exited.lastOutcome).toContain('multiplier=');
    expect(repeatedExit.rewardPoints).toBe(exited.rewardPoints);
    expect(repeatedExit.lingyun).toBe(exited.lingyun);
  });

  it('resolves retreat through run economy without completing the dungeon', () => {
    const rewardNode = selectNode(withCurrentNode(enterDungeon(createInitialState(), 'demon_tower_1'), 'sealed_cache'), 'sealed_cache');
    const progressed = collectReward(rewardNode);
    const clear = resolveExit(selectNode(withCurrentNode(withBossCleared(progressed), 'tower_exit'), 'tower_exit'));
    const retreated = resolveRetreat(progressed);

    expect(retreated.phase).toBe('result');
    expect(progressed.run?.lootBag.rewardPoints).toBe(120);
    expect(retreated.run?.lastLootSettlement?.retained.rewardPoints).toBe(60);
    expect(retreated.run?.lastLootSettlement?.lost.rewardPoints).toBe(60);
    expect(retreated.inventory.medicine_ash).toBe(0);
    expect(retreated.rewardPoints).toBeGreaterThan(createInitialState().rewardPoints);
    expect(retreated.rewardPoints).toBeLessThan(progressed.rewardPoints);
    expect(retreated.rewardPoints).toBeLessThan(clear.rewardPoints);
    expect(retreated.completedDungeonIds).toEqual([]);
    expect(retreated.lastOutcome).toContain('outcome=retreat');
    expect(retreated.lastOutcome).toContain('score=');
    expect(retreated.lastOutcome).toContain('multiplier=');
  });

  it('recovers only one fifth of unsecured points after a failed run', () => {
    const entered = enterDungeon(createInitialState(), 'demon_tower_1');
    const rewardNode = selectNode(withCurrentNode(entered, 'sealed_cache'), 'sealed_cache');
    const progressed = collectReward(rewardNode);
    const failed = game.resolveRunFailure(progressed, '测试濒死回收。');

    expect(failed.run?.lastLootSettlement?.retained.rewardPoints).toBe(24);
    expect(failed.run?.lastLootSettlement?.lost.rewardPoints).toBe(96);
    expect(failed.run?.lastLootSettlement?.retained.items).toEqual({});
    expect(failed.inventory.medicine_ash).toBe(0);
    expect(failed.completedDungeonIds).toEqual([]);
  });

  it('does not mint retreat recovery rewards after the run is already settled', () => {
    const rewardNode = selectNode(withCurrentNode(enterDungeon(createInitialState(), 'demon_tower_1'), 'sealed_cache'), 'sealed_cache');
    const retreated = resolveRetreat(collectReward(rewardNode));
    const repeated = resolveRetreat(retreated);

    expect(repeated.rewardPoints).toBe(retreated.rewardPoints);
    expect(repeated.lastOutcome).toBe(retreated.lastOutcome);
    expect(repeated.log[0]).toMatch(/已结算|已经.*结算/);
  });

  it('settles combat failure as recovered run economy without completion or directive rewards', () => {
    const entered = enterDungeon(createInitialState(), 'demon_tower_1');
    const combat = selectNode(entered, 'fog_lesser_demon');
    const wounded: GameState = {
      ...combat,
      player: {
        ...combat.player,
        hp: 1
      }
    };

    const failed = performCombatAction(wounded, 'attack');

    expect(failed.phase).toBe('result');
    expect(failed.rewardPoints).toBeGreaterThanOrEqual(combat.rewardPoints);
    expect(failed.completedDungeonIds).toEqual([]);
    expect(failed.claimedDirectiveIds).toEqual([]);
    expect(failed.lastOutcome).toContain('outcome=failed_recovered');
    expect(failed.lastOutcome).toContain('score=');
    expect(failed.lastOutcome).toContain('multiplier=');
  });

  it('does not mint failure recovery rewards after the run is already settled', () => {
    const combat = selectNode(enterDungeon(createInitialState(), 'demon_tower_1'), 'fog_lesser_demon');
    const failed = performCombatAction(
      {
        ...combat,
        player: {
          ...combat.player,
          hp: 1
        }
      },
      'attack'
    );
    const repeated = game.resolveRunFailure(failed);

    expect(repeated.rewardPoints).toBe(failed.rewardPoints);
    expect(repeated.lastOutcome).toBe(failed.lastOutcome);
    expect(repeated.log[0]).toMatch(/已结算|已经.*结算/);
  });

  it('returns from non-clear results to hub while preserving rewards and completion state', () => {
    const rewardNode = selectNode(withCurrentNode(enterDungeon(createInitialState(), 'demon_tower_1'), 'sealed_cache'), 'sealed_cache');
    const retreated = resolveRetreat(collectReward(rewardNode));
    const hub = returnToHub(retreated);

    expect(hub.phase).toBe('hub');
    expect(hub.run).toBeUndefined();
    expect(hub.rewardPoints).toBe(retreated.rewardPoints);
    expect(hub.completedDungeonIds).toEqual(retreated.completedDungeonIds);
  });

  it('tracks completed campaign dungeons exactly once through exit settlement and hub return', () => {
    const initial = createInitialState();
    const exitNode = selectNode(
      withCurrentNode(withBossCleared(enterDungeon(initial, 'demon_tower_1')), 'tower_exit'),
      'tower_exit'
    );
    const exited = resolveExit(exitNode);
    const repeatedExit = resolveExit(exited);
    const hub = returnToHub(repeatedExit);

    expect(initial.completedDungeonIds).toEqual([]);
    expect(exited.completedDungeonIds).toEqual(['demon_tower_1']);
    expect(repeatedExit.completedDungeonIds).toEqual(['demon_tower_1']);
    expect(hub.completedDungeonIds).toEqual(['demon_tower_1']);
  });

  it('exposes campaign gates from state and prevents entering locked dungeons', () => {
    const initial = createInitialState();
    const gates = getCampaignGates(initial);
    const firstGate = gates.find((gate) => gate.dungeonId === 'demon_tower_1');
    const finalGate = gates.find((gate) => gate.dungeonId === 'void_citadel');
    const lockedAttempt = enterDungeon(initial, 'void_citadel');
    const firstExit = resolveExit(
      selectNode(withCurrentNode(withBossCleared(enterDungeon(initial, 'demon_tower_1')), 'tower_exit'), 'tower_exit')
    );
    const progressedGates = getCampaignGates(returnToHub(firstExit));

    expect(firstGate?.status).toBe('available');
    expect(firstGate?.isNextRecommended).toBe(true);
    expect(finalGate?.status).toBe('locked');
    expect(lockedAttempt.phase).toBe('hub');
    expect(lockedAttempt.run).toBeUndefined();
    expect(lockedAttempt.log[0]).toContain('锁定');
    expect(progressedGates.find((gate) => gate.dungeonId === 'demon_tower_1')?.status).toBe('completed');
    expect(progressedGates.find((gate) => gate.dungeonId === 'metro_abyss')?.status).toBe('locked');
    expect(progressedGates.find((gate) => gate.dungeonId === 'metro_abyss')?.isNextRecommended).toBe(false);
  });

  it('unlocks the next dungeon only after claiming the previous mainline task', () => {
    const initial = createInitialState();
    const cleared = returnToHub(
      resolveExit(
        selectNode(withCurrentNode(withBossCleared(enterDungeon(initial, 'demon_tower_1')), 'tower_exit'), 'tower_exit')
      )
    );
    const beforeClaim = getCampaignGates(cleared).find((gate) => gate.dungeonId === 'metro_abyss');
    const afterClaimState = claimTaskReward(cleared, 'mainline_clear_demon_tower_1');
    const afterClaim = getCampaignGates(afterClaimState).find((gate) => gate.dungeonId === 'metro_abyss');

    expect(beforeClaim?.status).toBe('locked');
    expect(beforeClaim?.requirementText).toContain('主线任务');
    expect(enterDungeon(cleared, 'metro_abyss').phase).toBe('hub');
    expect(afterClaim?.status).toBe('available');
    expect(afterClaim?.isNextRecommended).toBe(true);
    expect(enterDungeon(afterClaimState, 'metro_abyss').phase).toBe('explore');
  });

  it('does not let high player power bypass unclaimed mainline progression', () => {
    const initial = {
      ...createInitialState(),
      player: {
        ...createInitialState().player,
        base: { body: 99, spirit: 99, agility: 99, luck: 99 }
      }
    };
    const metroGate = getCampaignGates(initial).find((gate) => gate.dungeonId === 'metro_abyss');
    const attempt = enterDungeon(initial, 'metro_abyss');

    expect(getPlayerPower(initial)).toBeGreaterThan(DUNGEONS.metro_abyss.recommendedPower * 2);
    expect(metroGate?.status).toBe('locked');
    expect(metroGate?.availabilityKind).toBeUndefined();
    expect(attempt.phase).toBe('hub');
    expect(attempt.log[0]).toContain('主线任务');
  });

  it('requires the specific captured pet id for capture directives', () => {
    const entered = enterDungeon(createInitialState(), 'demon_tower_1');
    const baseRun = {
      ...entered.run!,
      currentNodeId: 'tower_exit',
      clearedNodeIds: ['fog_lesser_demon', 'blood_rune_trap', 'sealed_cache'],
      captures: 1,
      damageTaken: 0
    };
    const wrongPetRun = {
      ...entered,
      learnedMethods: ['mist_breathing' as const],
      run: {
        ...baseRun,
        capturedPetIds: ['ash_hound' as const]
      }
    };
    const correctPetRun = {
      ...wrongPetRun,
      run: {
        ...baseRun,
        capturedPetIds: ['mist_kitten' as const]
      }
    };

    expect(game.getDirectiveEvaluation(wrongPetRun).objectiveResults).toContainEqual(
      expect.objectContaining({ id: 'demon_tower_1_capture_mist_kitten', completed: false })
    );
    expect(game.getDirectiveEvaluation(correctPetRun).objectiveResults).toContainEqual(
      expect.objectContaining({ id: 'demon_tower_1_capture_mist_kitten', completed: true })
    );
  });

  it('pays completed main god directive rewards once during exit settlement', () => {
    const entered = enterDungeon(createInitialState(), 'demon_tower_1');
    const readyToExit = {
      ...entered,
      rewardPoints: 1000,
      lingyun: 5,
      learnedMethods: ['mist_breathing' as const],
      run: {
        ...entered.run!,
        currentNodeId: 'tower_exit',
        clearedNodeIds: ['fog_lesser_demon', 'blood_rune_trap', 'sealed_cache'],
        captures: 1,
        capturedPetIds: ['mist_kitten' as const],
        damageTaken: 0
      }
    };

    const exited = resolveExit(withBossCleared(readyToExit));
    const repeated = resolveExit(exited);

    expect(exited.rewardPoints).toBeGreaterThanOrEqual(readyToExit.rewardPoints + 260);
    expect(exited.lingyun).toBeGreaterThanOrEqual(readyToExit.lingyun + 2);
    expect(exited.inventory.hidden_stone).toBe(readyToExit.inventory.hidden_stone + 1);
    expect(exited.log[0]).toMatch(/首通|首次通关/);
    expect(repeated.rewardPoints).toBe(exited.rewardPoints);
    expect(repeated.lingyun).toBe(exited.lingyun);
    expect(repeated.inventory.hidden_stone).toBe(exited.inventory.hidden_stone);
  });

  it('pays a completed mainline task reward only once, including migrated legacy flat ids', () => {
    const cleared = returnToHub(
      resolveExit(
        selectNode(
          withCurrentNode(withBossCleared(enterDungeon(createInitialState(), 'demon_tower_1')), 'tower_exit'),
          'tower_exit'
        )
      )
    );
    const claimed = claimTaskReward(cleared, 'mainline_clear_demon_tower_1');
    const repeated = claimTaskReward(claimed, 'mainline_clear_demon_tower_1');
    const legacyClaimed = {
      ...cleared,
      claimedTaskIds: ['clear_demon_tower']
    };
    const legacyRepeated = claimTaskReward(legacyClaimed, 'mainline_clear_demon_tower_1');

    expect(claimed.claimedTaskIds).toContain('mainline_clear_demon_tower_1');
    expect(claimed.rewardPoints).toBeGreaterThan(cleared.rewardPoints);
    expect(repeated.rewardPoints).toBe(claimed.rewardPoints);
    expect(repeated.claimedTaskIds.filter((taskId) => taskId === 'mainline_clear_demon_tower_1')).toHaveLength(1);
    expect(legacyRepeated.rewardPoints).toBe(legacyClaimed.rewardPoints);
    expect(legacyRepeated.claimedTaskIds).toEqual(['clear_demon_tower']);
  });

  it('settles completed dungeon reruns without first-clear directive rewards', () => {
    const entered = enterDungeon(
      withCompletedDungeons(createInitialState(), ['demon_tower_1']),
      'demon_tower_1'
    );
    const readyToExit = {
      ...entered,
      rewardPoints: 1000,
      lingyun: 5,
      learnedMethods: ['mist_breathing' as const],
      run: {
        ...entered.run!,
        currentNodeId: 'tower_exit',
        clearedNodeIds: ['fog_lesser_demon', 'blood_rune_trap', 'sealed_cache'],
        captures: 1,
        capturedPetIds: ['mist_kitten' as const],
        damageTaken: 0
      }
    };

    const exited = resolveExit(withBossCleared(readyToExit));

    expect(exited.rewardPoints).toBeGreaterThan(readyToExit.rewardPoints);
    expect(exited.lingyun).toBe(readyToExit.lingyun + 1);
    expect(exited.inventory.hidden_stone).toBe(readyToExit.inventory.hidden_stone);
    expect(exited.completedDungeonIds).toEqual(['demon_tower_1']);
    expect(exited.claimedDirectiveIds).toEqual([]);
    expect(exited.log[0]).toMatch(/复刷|重复探索|已通关/);
  });

  it('adds overlapping exit and directive item rewards during first-clear settlement', () => {
    const entered = enterDungeon(
      {
        ...withCompletedDungeons(createInitialState(), ['demon_tower_1', 'metro_abyss', 'starfall_mine']),
        learnedMethods: ['iron_body']
      },
      'rust_hospital'
    );
    const readyToExit = {
      ...entered,
      run: {
        ...entered.run!,
        currentNodeId: 'hospital_exit',
        clearedNodeIds: ['triage_reward', 'plague_orderly', 'sterile_corridor', 'pulse_doctor'],
        damageTaken: 0
      }
    };

    const exited = resolveExit(withBossCleared(readyToExit));

    expect(exited.inventory.method_page).toBe(readyToExit.inventory.method_page + 2);
    expect(exited.claimedDirectiveIds).toContain('directive_rust_hospital');
  });

  it('reports total reward points in lastOutcome when directive reward is paid', () => {
    const entered = enterDungeon(createInitialState(), 'demon_tower_1');
    const readyToExit = {
      ...entered,
      learnedMethods: ['mist_breathing' as const],
      run: {
        ...entered.run!,
        currentNodeId: 'tower_exit',
        clearedNodeIds: ['fog_lesser_demon', 'blood_rune_trap', 'sealed_cache'],
        captures: 1,
        capturedPetIds: ['mist_kitten' as const],
        damageTaken: 0
      }
    };

    const exited = resolveExit(withBossCleared(readyToExit));
    const reportedReward = Number(/reward=(\d+)/.exec(exited.lastOutcome ?? '')?.[1]);

    expect(reportedReward).toBe(exited.rewardPoints - readyToExit.rewardPoints);
  });

  it('consumes item requirements and records them when dungeon events succeed', () => {
    const initial = createInitialState();
    const entered = enterDungeon(
      {
        ...withCompletedDungeons(initial, ['demon_tower_1']),
        inventory: {
          ...initial.inventory,
          gate_sigil: 1
        }
      },
      'metro_abyss'
    );
    const state = withCurrentNode(entered, 'rail_portal');

    const resolved = game.resolveDungeonEvent(state, 'last_train_reflection', 'anchor_last_train');

    expect(resolved.inventory.gate_sigil).toBe(0);
    expect(resolved.run?.usedItems).toContain('gate_sigil');
    expect(resolved.run?.resolvedEventIds).toContain('last_train_reflection');
  });

  it('does not consume missing item requirements when dungeon events fail', () => {
    const initial = createInitialState();
    const entered = enterDungeon(
      withCompletedDungeons(initial, ['demon_tower_1']),
      'metro_abyss'
    );
    const state = withCurrentNode(entered, 'rail_portal');

    const resolved = game.resolveDungeonEvent(state, 'last_train_reflection', 'anchor_last_train');

    expect(resolved.inventory.gate_sigil).toBe(0);
    expect(resolved.run?.usedItems).not.toContain('gate_sigil');
    expect(resolved.run?.resolvedEventIds).toContain('last_train_reflection');
  });

  it('claims a completed main god task reward once', () => {
    const cleared = {
      ...returnToHub(
        resolveExit(
          selectNode(
            withCurrentNode(withBossCleared(enterDungeon(createInitialState(), 'demon_tower_1')), 'tower_exit'),
            'tower_exit'
          )
        )
      ),
      rewardPoints: 0,
      lingyun: 0,
    };

    const claimed = claimTaskReward(cleared, 'mainline_clear_demon_tower_1');
    const repeated = claimTaskReward(claimed, 'mainline_clear_demon_tower_1');

    expect(claimed.rewardPoints).toBeGreaterThan(cleared.rewardPoints);
    expect(claimed.claimedTaskIds).toEqual(['mainline_clear_demon_tower_1']);
    expect(claimed.log[0]).toContain('妖塔一层');
    expect(repeated.rewardPoints).toBe(claimed.rewardPoints);
    expect(repeated.claimedTaskIds).toEqual(['mainline_clear_demon_tower_1']);
    expect(repeated.log[0]).toMatch(/已领取|已经领取/);
  });

  it('does not pay unfinished or unknown main god task rewards', () => {
    const initial = createInitialState();
    const unfinished = claimTaskReward(initial, 'mainline_clear_demon_tower_1');
    const unknown = claimTaskReward(initial, 'not_a_task');

    expect(unfinished.rewardPoints).toBe(initial.rewardPoints);
    expect(unfinished.lingyun).toBe(initial.lingyun);
    expect(unfinished.inventory).toEqual(initial.inventory);
    expect(unfinished.claimedTaskIds).toEqual([]);
    expect(unfinished.log[0]).toMatch(/尚未完成|未完成/);
    expect(unknown.rewardPoints).toBe(initial.rewardPoints);
    expect(unknown.inventory).toEqual(initial.inventory);
    expect(unknown.claimedTaskIds).toEqual([]);
    expect(unknown.log[0]).toMatch(/未知|不存在/);
  });
});

describe('equipment sealing commission core integration', () => {
  const equipmentIds = ['armor_piercing_sword', 'ember_staff'] as const;
  const targetMaterialId = 'demon_bone' as const;

  function commissionReadyHub(): GameState {
    const initial = createInitialState();
    return {
      ...initial,
      rewardPoints: 2000,
      lingyun: 5,
      completedDungeonIds: [...DUNGEON_ORDER],
      claimedTaskIds: DUNGEON_ORDER.map((dungeonId) => `mainline_clear_${dungeonId}`),
      ownedEquipment: [...initial.ownedEquipment, ...equipmentIds],
      equipmentLevels: {
        ...initial.equipmentLevels,
        armor_piercing_sword: EQUIPMENT.armor_piercing_sword.maxLevel,
        ember_staff: EQUIPMENT.ember_staff.maxLevel
      },
      equipmentAttunements: {
        armor_piercing_sword: 'forge_overdrive',
        ember_staff: 'rift_resonance'
      },
      equipmentTemperRanks: {
        armor_piercing_sword: 2,
        ember_staff: 1
      }
    };
  }

  function readySuccessfulExit(state: GameState, dungeonId: game.DungeonId): GameState {
    const entered = enterDungeon(state, dungeonId);
    if (!entered.run) throw new Error(`Expected ${dungeonId} to start`);

    const exitNode = DUNGEONS[dungeonId].nodes.find((node) => node.type === 'exit');
    if (!exitNode) throw new Error(`Missing exit node for ${dungeonId}`);

    return {
      ...entered,
      phase: 'explore',
      combat: undefined,
      run: {
        ...entered.run,
        currentNodeId: exitNode.id,
        clearedNodeIds: [getBossDefinition(dungeonId).nodeId]
      }
    };
  }

  function clearCommissionDungeon(state: GameState, dungeonId: game.DungeonId): GameState {
    return resolveExit(readySuccessfulExit(state, dungeonId));
  }

  function expectCommissionFailureAtomic(before: GameState, after: GameState): void {
    expect(after.rewardPoints).toBe(before.rewardPoints);
    expect(after.lingyun).toBe(before.lingyun);
    expect(after.inventory).toEqual(before.inventory);
    expect(after.ownedEquipment).toEqual(before.ownedEquipment);
    expect(after.equipmentLevels).toEqual(before.equipmentLevels);
    expect(after.equipmentAttunements).toEqual(before.equipmentAttunements);
    expect(after.equipmentTemperRanks).toEqual(before.equipmentTemperRanks);
    expect(after.equipmentCommission).toEqual(before.equipmentCommission);
  }

  it('lists only owned, max-level, temper-eligible, unequipped candidates with their material', () => {
    const initial = createInitialState();
    const state: GameState = {
      ...initial,
      ownedEquipment: [
        ...initial.ownedEquipment,
        'armor_piercing_sword',
        'bone_spear',
        'ember_staff'
      ],
      equipmentLevels: {
        ...initial.equipmentLevels,
        armor_piercing_sword: EQUIPMENT.armor_piercing_sword.maxLevel,
        bone_spear: EQUIPMENT.bone_spear.maxLevel - 1,
        ember_staff: EQUIPMENT.ember_staff.maxLevel
      },
      equipped: {
        ...initial.equipped,
        weapon: 'ember_staff'
      }
    };

    expect(game.getEquipmentCommissionStatus(state)).toEqual({
      candidates: [{ equipmentId: 'armor_piercing_sword', materialId: 'demon_bone' }],
      cost: { rewardPoints: 300, lingyun: 1 },
      requiredDungeonCount: 3,
      materialReward: 2
    });
  });

  it('validates the whole start request before paying once and rejects another active deposit', () => {
    const ready = commissionReadyHub();
    const failures: Array<[GameState, GameState, RegExp]> = [
      [
        { ...ready, phase: 'explore' },
        game.startEquipmentCommission({ ...ready, phase: 'explore' }, equipmentIds, targetMaterialId),
        /主神空间/
      ],
      [ready, game.startEquipmentCommission(ready, [equipmentIds[0], equipmentIds[0]], targetMaterialId), /不同装备/],
      [
        { ...ready, equipped: { ...ready.equipped, weapon: equipmentIds[0] } },
        game.startEquipmentCommission(
          { ...ready, equipped: { ...ready.equipped, weapon: equipmentIds[0] } },
          equipmentIds,
          targetMaterialId
        ),
        /当前未装备/
      ],
      [ready, game.startEquipmentCommission(ready, equipmentIds, 'star_iron'), /目标材料/],
      [
        { ...ready, rewardPoints: 299 },
        game.startEquipmentCommission({ ...ready, rewardPoints: 299 }, equipmentIds, targetMaterialId),
        /资源不足/
      ],
      [
        { ...ready, lingyun: 0 },
        game.startEquipmentCommission({ ...ready, lingyun: 0 }, equipmentIds, targetMaterialId),
        /资源不足/
      ]
    ];

    for (const [before, after, message] of failures) {
      expectCommissionFailureAtomic(before, after);
      expect(after.log[0]).toMatch(message);
    }

    const started = game.startEquipmentCommission(ready, equipmentIds, targetMaterialId);
    expect(started.rewardPoints).toBe(ready.rewardPoints - 300);
    expect(started.lingyun).toBe(ready.lingyun - 1);
    expect(started.inventory).toEqual(ready.inventory);
    expect(started.equipmentCommission).toEqual({
      rulesVersion: 1,
      equipmentIds,
      targetMaterialId,
      completedDungeonIds: []
    });
    expect(started.equipmentLevels).toEqual(ready.equipmentLevels);
    expect(started.equipmentAttunements).toEqual(ready.equipmentAttunements);
    expect(started.equipmentTemperRanks).toEqual(ready.equipmentTemperRanks);

    const repeated = game.startEquipmentCommission(started, equipmentIds, targetMaterialId);
    expectCommissionFailureAtomic(started, repeated);
    expect(repeated.log[0]).toMatch(/进行中|重复封存/);
  });

  it('locks both sealed items against equip, upgrade, attunement, and temper mutations', () => {
    const started = game.startEquipmentCommission(commissionReadyHub(), equipmentIds, targetMaterialId);
    expect(game.isEquipmentCommissionSealed(started, equipmentIds[0])).toBe(true);
    expect(game.isEquipmentCommissionSealed(started, equipmentIds[1])).toBe(true);
    expect(game.isEquipmentCommissionSealed(started, 'bone_spear')).toBe(false);

    const attempts = [
      equipEquipment(started, equipmentIds[0]),
      upgradeEquipment(started, equipmentIds[0]),
      game.attuneEquipment(started, equipmentIds[0], 'forge_overdrive'),
      game.temperEquipment(started, equipmentIds[0])
    ];

    for (const attempted of attempts) {
      expect(attempted.log[0]).toMatch(/封存委托/);
      expectCommissionFailureAtomic(started, attempted);
      expect(attempted.equipped).toEqual(started.equipped);
    }
  });

  it('preserves commission state on retreat and failure and recalls only in the hub without a refund', () => {
    const started = game.startEquipmentCommission(commissionReadyHub(), equipmentIds, targetMaterialId);
    const entered = enterDungeon(started, 'demon_tower_1');
    const retreated = resolveRetreat(entered);
    const failed = game.resolveRunFailure(entered);

    expect(retreated.equipmentCommission).toEqual(started.equipmentCommission);
    expect(failed.equipmentCommission).toEqual(started.equipmentCommission);
    expect(retreated.run?.lastEquipmentCommissionSettlement).toBeUndefined();
    expect(failed.run?.lastEquipmentCommissionSettlement).toBeUndefined();

    const rejectedRecall = game.recallEquipmentCommission(entered);
    expect(rejectedRecall.equipmentCommission).toEqual(started.equipmentCommission);
    expect(rejectedRecall.log[0]).toMatch(/主神空间/);

    const firstClear = clearCommissionDungeon(started, 'demon_tower_1');
    const hub = returnToHub(firstClear);
    const recalled = game.recallEquipmentCommission(hub);
    expect(recalled.equipmentCommission).toBeUndefined();
    expect(recalled.rewardPoints).toBe(hub.rewardPoints);
    expect(recalled.lingyun).toBe(hub.lingyun);
    expect(recalled.inventory).toEqual(hub.inventory);
    expect(recalled.log[0]).toMatch(/1\/3.*进度全部丢失/);
  });

  it('does not advance or attach a new settlement for a repeat clear of the same dungeon', () => {
    const started = game.startEquipmentCommission(commissionReadyHub(), equipmentIds, targetMaterialId);
    const firstClear = clearCommissionDungeon(started, 'demon_tower_1');
    const repeatedClear = clearCommissionDungeon(returnToHub(firstClear), 'demon_tower_1');

    expect(firstClear.equipmentCommission?.completedDungeonIds).toEqual(['demon_tower_1']);
    expect(firstClear.run?.lastEquipmentCommissionSettlement).toMatchObject({
      status: 'advanced',
      dungeonId: 'demon_tower_1',
      completedDungeonIds: ['demon_tower_1'],
      rewardAmount: 0
    });
    expect(repeatedClear.equipmentCommission?.completedDungeonIds).toEqual(['demon_tower_1']);
    expect(repeatedClear.run?.lastEquipmentCommissionSettlement).toBeUndefined();
  });

  it('completes on three distinct exits, grants only the direct material reward, and preserves equipment progression', () => {
    const ready = commissionReadyHub();
    const started = game.startEquipmentCommission(ready, equipmentIds, targetMaterialId);
    const firstClear = clearCommissionDungeon(started, 'demon_tower_1');
    const secondClear = clearCommissionDungeon(returnToHub(firstClear), 'metro_abyss');
    const thirdReady = readySuccessfulExit(returnToHub(secondClear), 'starfall_mine');
    const baselineThirdClear = resolveExit({ ...thirdReady, equipmentCommission: undefined });
    const completed = resolveExit(thirdReady);

    expect(firstClear.run?.lastEquipmentCommissionSettlement).toEqual({
      status: 'advanced',
      dungeonId: 'demon_tower_1',
      equipmentIds,
      targetMaterialId,
      completedDungeonIds: ['demon_tower_1'],
      rewardAmount: 0
    });
    expect(secondClear.run?.lastEquipmentCommissionSettlement).toEqual({
      status: 'advanced',
      dungeonId: 'metro_abyss',
      equipmentIds,
      targetMaterialId,
      completedDungeonIds: ['demon_tower_1', 'metro_abyss'],
      rewardAmount: 0
    });
    expect(completed.run?.lastEquipmentCommissionSettlement).toEqual({
      status: 'completed',
      dungeonId: 'starfall_mine',
      equipmentIds,
      targetMaterialId,
      completedDungeonIds: ['demon_tower_1', 'metro_abyss', 'starfall_mine'],
      rewardAmount: 2
    });
    expect(completed.equipmentCommission).toBeUndefined();
    expect(completed.rewardPoints).toBe(baselineThirdClear.rewardPoints);
    expect(completed.lingyun).toBe(baselineThirdClear.lingyun);
    for (const itemId of game.ITEM_IDS) {
      expect(completed.inventory[itemId]).toBe(
        baselineThirdClear.inventory[itemId] + (itemId === targetMaterialId ? 2 : 0)
      );
    }
    expect(completed.run?.lastLootSettlement).toEqual(baselineThirdClear.run?.lastLootSettlement);
    expect(completed.ownedEquipment).toEqual(ready.ownedEquipment);
    expect(completed.equipmentLevels).toEqual(ready.equipmentLevels);
    expect(completed.equipmentAttunements).toEqual(ready.equipmentAttunements);
    expect(completed.equipmentTemperRanks).toEqual(ready.equipmentTemperRanks);
    expect(completed.log).toContainEqual(expect.stringMatching(/装备封存委托完成/));
  });
});

describe('run protocol and equipment attunement integration', () => {
  function withAllDungeonsCompleted(state = createInitialState()): GameState {
    return {
      ...state,
      completedDungeonIds: [...DUNGEON_ORDER],
      claimedTaskIds: DUNGEON_ORDER.map((dungeonId) => `mainline_clear_${dungeonId}`)
    };
  }

  function atNode(state: GameState, nodeId: string): GameState {
    if (!state.run) return state;
    return {
      ...state,
      phase: 'explore',
      combat: undefined,
      run: {
        ...state.run,
        currentNodeId: nodeId
      }
    };
  }

  function getDemonTowerDeepDefinition(): DeepRunProtocolDefinition {
    const definition = getRunProtocolDefinition('demon_tower_1', 'deep');
    if (!definition || definition.id !== 'deep') throw new Error('Missing deep protocol fixture');
    return definition;
  }

  function withCycleImprints(state: GameState, amount: number): GameState {
    return {
      ...state,
      inventory: {
        ...state.inventory,
        cycle_imprint: amount
      }
    };
  }

  function enterDemonTowerDeep(amount = 1): GameState {
    return enterDungeon(withCycleImprints(withAllDungeonsCompleted(), amount), 'demon_tower_1', 'deep');
  }

  function readyDemonTowerDeepExit(clearedNodeIds?: readonly string[]): GameState {
    const entered = enterDemonTowerDeep();
    const definition = getDemonTowerDeepDefinition();
    if (!entered.run) throw new Error('Missing deep run');

    const bossNodeId = getBossDefinition('demon_tower_1').nodeId;
    const exitNode = DUNGEONS.demon_tower_1.nodes.find((node) => node.type === 'exit');
    if (!exitNode) throw new Error('Missing demon tower exit');

    const requiredNodeIds = getRunProtocolRequiredNodeIds(definition);
    const otherNodeIds = DUNGEONS.demon_tower_1.nodes
      .filter(
        (node) => node.id !== exitNode.id && node.id !== bossNodeId && !requiredNodeIds.includes(node.id)
      )
      .map((node) => node.id);

    return {
      ...atNode(entered, exitNode.id),
      completedDungeonIds: [],
      claimedDirectiveIds: [],
      learnedMethods: ['mist_breathing'],
      run: {
        ...entered.run,
        currentNodeId: exitNode.id,
        clearedNodeIds: [...(clearedNodeIds ?? [...requiredNodeIds, ...otherNodeIds, bossNodeId])],
        captures: 1,
        capturedPetIds: ['mist_kitten']
      }
    };
  }

  function readyDemonTowerExit(protocolId: RunProtocolId, anchorCompleted: boolean): GameState {
    const entered = enterDungeon(createInitialState(), 'demon_tower_1');
    const definition = getRunProtocolDefinition('demon_tower_1', 'imprint');
    if (!entered.run || !definition || definition.id !== 'imprint') throw new Error('Missing protocol fixture');

    const bossNodeId = getBossDefinition('demon_tower_1').nodeId;
    const exitNode = DUNGEONS.demon_tower_1.nodes.find((node) => node.type === 'exit');
    if (!exitNode) throw new Error('Missing demon tower exit');

    const otherNodeIds = DUNGEONS.demon_tower_1.nodes
      .filter((node) => node.id !== exitNode.id && node.id !== definition.requiredNodeId && node.id !== bossNodeId)
      .map((node) => node.id);
    const clearedNodeIds = anchorCompleted
      ? [definition.requiredNodeId, ...otherNodeIds, bossNodeId]
      : [bossNodeId];

    return {
      ...atNode(entered, exitNode.id),
      completedDungeonIds: [],
      claimedDirectiveIds: [],
      learnedMethods: ['mist_breathing'],
      run: {
        ...entered.run,
        currentNodeId: exitNode.id,
        clearedNodeIds,
        captures: 1,
        capturedPetIds: ['mist_kitten'],
        protocol: { id: protocolId, rulesVersion: 1 }
      }
    };
  }

  it('keeps standard and legacy runs at identity behavior while exposing the new material', () => {
    const standard = selectNode(enterDungeon(createInitialState(), 'demon_tower_1'), 'fog_lesser_demon');
    if (!standard.run) throw new Error('Missing standard run');
    const legacy = {
      ...standard,
      run: {
        ...standard.run,
        protocol: undefined
      }
    };

    expect(standard.run.protocol).toEqual({ id: 'standard', rulesVersion: 1 });
    expect(game.getCombatEncounterProfile(standard)?.monster).toEqual(game.MONSTERS.fog_lesser_demon);
    expect(game.getCombatEncounterProfile(legacy)?.monster).toEqual(game.getCombatEncounterProfile(standard)?.monster);
    expect(game.getCurrentRunProtocol(standard)).toMatchObject({
      completedAnchorCount: 0,
      requiredAnchorCount: 0,
      anchorCompleted: true
    });
    expect(ITEMS.cycle_imprint).toMatchObject({ name: '轮回刻印', kind: 'material' });
    expect(ITEMS.cycle_imprint.cost).toBeUndefined();
    expect(createInitialState().inventory.cycle_imprint).toBe(0);
  });

  it('rejects unknown or locked runs and creates imprint runs for all eight completed dungeons', () => {
    const initial = createInitialState();
    const locked = enterDungeon(initial, 'demon_tower_1', 'imprint');
    const unknownDungeon = enterDungeon(initial, 'missing' as game.DungeonId);
    const unknownProtocol = enterDungeon(
      withAllDungeonsCompleted(initial),
      'demon_tower_1',
      'missing' as RunProtocolId
    );

    expect(locked.phase).toBe('hub');
    expect(locked.log[0]).toContain('轮回协议锁定');
    expect(unknownDungeon.phase).toBe('hub');
    expect(unknownDungeon.log[0]).toContain('未知副本');
    expect(unknownProtocol.phase).toBe('hub');
    expect(unknownProtocol.log[0]).toContain('未知轮回协议');

    const unlocked = withAllDungeonsCompleted(initial);
    for (const dungeonId of DUNGEON_ORDER) {
      const entered = enterDungeon(unlocked, dungeonId, 'imprint');
      expect(entered.phase).toBe('explore');
      expect(entered.run?.protocol).toEqual({ id: 'imprint', rulesVersion: 1 });
      expect(game.getCurrentRunProtocol(entered)?.definition.dungeonId).toBe(dungeonId);
    }
  });

  it('keeps deep behind the completed-dungeon gate and clearly rejects a missing entry imprint', () => {
    const initial = createInitialState();
    const locked = enterDungeon(withCycleImprints(initial, 1), 'demon_tower_1', 'deep');
    const missingResource = enterDungeon(withAllDungeonsCompleted(initial), 'demon_tower_1', 'deep');

    expect(locked.phase).toBe('hub');
    expect(locked.inventory.cycle_imprint).toBe(1);
    expect(locked.log[0]).toContain('轮回协议锁定');
    expect(missingResource.phase).toBe('hub');
    expect(missingResource.run).toBeUndefined();
    expect(missingResource.inventory.cycle_imprint).toBe(0);
    expect(missingResource.log[0]).toMatch(/轮回刻印不足.*消耗轮回刻印 x1/);
  });

  it('runs every existing entry validation before charging the deep protocol token', () => {
    const invalid = withCycleImprints(
      {
        ...withAllDungeonsCompleted(),
        preparedItemIds: ['healing_pill', 'dispel_talisman', 'gate_sigil', 'echo_coin']
      },
      1
    );
    const blocked = enterDungeon(invalid, 'demon_tower_1', 'deep');

    expect(blocked.phase).toBe('hub');
    expect(blocked.run).toBeUndefined();
    expect(blocked.inventory.cycle_imprint).toBe(1);
    expect(blocked.log[0]).toMatch(/战术携行配置无效|溢出/);
    expect(blocked.log[0]).not.toContain('轮回刻印不足');
  });

  it('charges exactly one imprint for a deep snapshot and audits its dual anchors', () => {
    const entered = enterDemonTowerDeep(2);
    const afterEncounter = selectNode(entered, entered.run?.currentNodeId ?? 'fog_lesser_demon');

    expect(entered.phase).toBe('explore');
    expect(entered.inventory.cycle_imprint).toBe(1);
    expect(entered.run?.protocol).toEqual({ id: 'deep', rulesVersion: 1 });
    expect(afterEncounter.inventory.cycle_imprint).toBe(1);
    expect(entered.log[0]).toMatch(/深层轮回协议.*轮回刻印 x1 已消耗.*双锚点 0\/2/);
  });

  it('exposes aggregate two-anchor progress for the current deep run', () => {
    const entered = enterDemonTowerDeep();
    const requiredNodeIds = getRunProtocolRequiredNodeIds(getDemonTowerDeepDefinition());
    if (!entered.run) throw new Error('Missing deep run');

    const oneAnchor: GameState = {
      ...entered,
      run: { ...entered.run, clearedNodeIds: [requiredNodeIds[0]] }
    };
    const bothAnchors: GameState = {
      ...entered,
      run: { ...entered.run, clearedNodeIds: [...requiredNodeIds] }
    };

    expect(requiredNodeIds).toHaveLength(2);
    expect(game.getCurrentRunProtocol(entered)).toMatchObject({
      completedAnchorCount: 0,
      requiredAnchorCount: 2,
      anchorCompleted: false
    });
    expect(game.getCurrentRunProtocol(oneAnchor)).toMatchObject({
      completedAnchorCount: 1,
      requiredAnchorCount: 2,
      anchorCompleted: false
    });
    expect(game.getCurrentRunProtocol(bothAnchors)).toMatchObject({
      completedAnchorCount: 2,
      requiredAnchorCount: 2,
      anchorCompleted: true
    });
  });

  it('does not count deep anchors completed after the boss as valid progress', () => {
    const entered = enterDemonTowerDeep();
    const requiredNodeIds = getRunProtocolRequiredNodeIds(getDemonTowerDeepDefinition());
    const bossNodeId = getBossDefinition('demon_tower_1').nodeId;
    if (!entered.run) throw new Error('Missing deep run');

    const lateAnchors: GameState = {
      ...entered,
      run: {
        ...entered.run,
        clearedNodeIds: [requiredNodeIds[0], bossNodeId, requiredNodeIds[1]]
      }
    };

    expect(game.getCurrentRunProtocol(lateAnchors)).toMatchObject({
      completedAnchorCount: 1,
      requiredAnchorCount: 2,
      anchorCompleted: false,
      bossDefeated: true
    });
  });

  it('applies imprint pressure to monsters, boss breach snapshots, completed anchors, and traps', () => {
    const unlocked = withAllDungeonsCompleted();
    const standardMonster = selectNode(enterDungeon(unlocked, 'demon_tower_1'), 'fog_lesser_demon');
    const imprintMonster = selectNode(enterDungeon(unlocked, 'demon_tower_1', 'imprint'), 'fog_lesser_demon');
    expect(game.getCombatEncounterProfile(imprintMonster)?.monster.maxHp).toBeGreaterThan(
      game.getCombatEncounterProfile(standardMonster)?.monster.maxHp ?? 0
    );

    const definition = getRunProtocolDefinition('demon_tower_1', 'imprint');
    if (!definition || definition.id !== 'imprint') throw new Error('Missing imprint definition');
    const bossNodeId = getBossDefinition('demon_tower_1').nodeId;
    const unanchoredBoss = selectNode(atNode(enterDungeon(unlocked, 'demon_tower_1', 'imprint'), bossNodeId), bossNodeId);
    const anchoredRun = enterDungeon(unlocked, 'demon_tower_1', 'imprint');
    if (!anchoredRun.run) throw new Error('Missing anchored run');
    const anchoredBoss = selectNode(
      atNode(
        {
          ...anchoredRun,
          run: {
            ...anchoredRun.run,
            clearedNodeIds: [definition.requiredNodeId]
          }
        },
        bossNodeId
      ),
      bossNodeId
    );
    const breachProfile = game.getCombatEncounterProfile(unanchoredBoss);
    const anchoredProfile = game.getCombatEncounterProfile(anchoredBoss);

    expect(unanchoredBoss.combat?.protocolAnchorCompletedBeforeBoss).toBe(false);
    expect(anchoredBoss.combat?.protocolAnchorCompletedBeforeBoss).toBe(true);
    expect(unanchoredBoss.combat?.monsterHp).toBe(breachProfile?.monster.maxHp);
    expect(anchoredBoss.combat?.monsterHp).toBe(anchoredProfile?.monster.maxHp);
    expect(breachProfile?.monster.maxHp).toBeGreaterThan(anchoredProfile?.monster.maxHp ?? 0);
    expect(game.getCurrentRunProtocol(unanchoredBoss)?.bossBreachActive).toBe(true);
    expect(game.getCombatEncounterProfile(performCombatAction(unanchoredBoss, 'attack'))?.monster.maxHp).toBe(
      breachProfile?.monster.maxHp
    );

    const trapNode = DUNGEONS.demon_tower_1.nodes.find((node) => node.trap);
    if (!trapNode) throw new Error('Missing demon tower trap');
    const standardTrap = handleTrap(atNode(enterDungeon(unlocked, 'demon_tower_1'), trapNode.id));
    const imprintTrap = handleTrap(atNode(enterDungeon(unlocked, 'demon_tower_1', 'imprint'), trapNode.id));
    expect(imprintTrap.run?.damageTaken).toBeGreaterThan(standardTrap.run?.damageTaken ?? 0);
  });

  it('delegates deep monster and boss breach scaling to the protocol rules', () => {
    const regular = selectNode(enterDemonTowerDeep(), 'fog_lesser_demon');
    const expectedRegular = scaleMonsterForRunProtocol(game.MONSTERS.fog_lesser_demon, 'deep', {
      isBoss: false,
      anchorCompletedBeforeBoss: true
    });
    expect(game.getCombatEncounterProfile(regular)?.monster).toEqual(expectedRegular);

    const definition = getDemonTowerDeepDefinition();
    const requiredNodeIds = getRunProtocolRequiredNodeIds(definition);
    const bossDefinition = getBossDefinition('demon_tower_1');
    const baseBoss = game.MONSTERS[bossDefinition.monsterId];
    const sealedBoss = {
      ...baseBoss,
      ...getBossCombatStats(
        bossDefinition,
        { maxHp: baseBoss.maxHp, attack: baseBoss.attack, defense: baseBoss.defense },
        'sealed'
      )
    };
    const startBoss = (clearedNodeIds: readonly string[]) => {
      const entered = enterDemonTowerDeep();
      if (!entered.run) throw new Error('Missing deep boss run');
      return selectNode(
        atNode(
          {
            ...entered,
            run: { ...entered.run, clearedNodeIds: [...clearedNodeIds] }
          },
          bossDefinition.nodeId
        ),
        bossDefinition.nodeId
      );
    };
    const breached = startBoss([]);
    const anchored = startBoss(requiredNodeIds);
    const expectedBreached = scaleMonsterForRunProtocol(sealedBoss, 'deep', {
      isBoss: true,
      anchorCompletedBeforeBoss: false
    });
    const expectedAnchored = scaleMonsterForRunProtocol(sealedBoss, 'deep', {
      isBoss: true,
      anchorCompletedBeforeBoss: true
    });

    expect(game.getCombatEncounterProfile(breached)?.monster).toEqual(expectedBreached);
    expect(game.getCombatEncounterProfile(anchored)?.monster).toEqual(expectedAnchored);
    expect(expectedBreached.maxHp).toBeGreaterThan(expectedAnchored.maxHp);
    expect(game.getCurrentRunProtocol(breached)?.bossBreachActive).toBe(true);
  });

  it('freezes aggregate deep anchor completion when boss combat starts', () => {
    const entered = enterDemonTowerDeep();
    const requiredNodeIds = getRunProtocolRequiredNodeIds(getDemonTowerDeepDefinition());
    const bossNodeId = getBossDefinition('demon_tower_1').nodeId;
    if (!entered.run) throw new Error('Missing deep boss run');

    const started = selectNode(
      atNode(
        {
          ...entered,
          run: { ...entered.run, clearedNodeIds: [requiredNodeIds[0]] }
        },
        bossNodeId
      ),
      bossNodeId
    );
    const breachedMaxHp = game.getCombatEncounterProfile(started)?.monster.maxHp;
    if (!started.run) throw new Error('Missing started deep boss run');
    const completedDuringCombat: GameState = {
      ...started,
      run: { ...started.run, clearedNodeIds: [...requiredNodeIds] }
    };

    expect(started.combat?.protocolAnchorCompletedBeforeBoss).toBe(false);
    expect(game.getCurrentRunProtocol(completedDuringCombat)).toMatchObject({
      completedAnchorCount: 2,
      requiredAnchorCount: 2,
      anchorCompleted: true,
      bossBreachActive: true
    });
    expect(completedDuringCombat.combat?.protocolAnchorCompletedBeforeBoss).toBe(false);
    expect(game.getCombatEncounterProfile(completedDuringCombat)?.monster.maxHp).toBe(breachedMaxHp);
  });

  it('inherits the protocol through portals and resolves pressure from the target dungeon definition', () => {
    const entered = enterDungeon(withAllDungeonsCompleted(), 'demon_tower_1', 'imprint');
    const portalNode = DUNGEONS.demon_tower_1.nodes.find((node) => node.portal);
    if (!portalNode?.portal) throw new Error('Missing demon tower portal');

    const transported = usePortal(atNode(entered, portalNode.id));

    expect(transported.run?.dungeonId).toBe(portalNode.portal.targetDungeonId);
    expect(transported.run?.protocol).toEqual({ id: 'imprint', rulesVersion: 1 });
    expect(game.getCurrentRunProtocol(transported)?.definition.dungeonId).toBe(portalNode.portal.targetDungeonId);
  });

  it('adds only the protocol point bonus, grants one imprint, and keeps directive rewards outside the multiplier', () => {
    const standardReady = readyDemonTowerExit('standard', true);
    const imprintReady = readyDemonTowerExit('imprint', true);
    expect(game.getDirectiveEvaluation(standardReady).status).toBe('completed');

    const standardExit = resolveExit(standardReady);
    const imprintExit = resolveExit(imprintReady);
    const settlement = imprintExit.run?.lastProtocolSettlement;
    const standardGain = standardExit.rewardPoints - standardReady.rewardPoints;
    const imprintGain = imprintExit.rewardPoints - imprintReady.rewardPoints;

    expect(settlement).toMatchObject({
      status: 'succeeded',
      bossDefeated: true,
      anchorCompletedBeforeBoss: true,
      cycleImprintGranted: true
    });
    expect(imprintGain - standardGain).toBe(settlement?.rewardPointBonus);
    expect(imprintExit.claimedDirectiveIds).toEqual(standardExit.claimedDirectiveIds);
    expect(imprintExit.inventory.cycle_imprint).toBe(1);
    expect(imprintExit.lastOutcome).toContain('protocol=imprint:succeeded');
    expect(standardExit.run?.lastProtocolSettlement).toBeUndefined();
    expect(settlement?.materialReward).toBeUndefined();

    const repeated = resolveExit(imprintExit);
    expect(repeated.rewardPoints).toBe(imprintExit.rewardPoints);
    expect(repeated.inventory.cycle_imprint).toBe(1);
  });

  it('does not grant an imprint for a failed anchor, retreat, or run failure', () => {
    const failedAnchor = resolveExit(readyDemonTowerExit('imprint', false));
    const activeImprint = enterDungeon(withAllDungeonsCompleted(), 'demon_tower_1', 'imprint');
    const retreated = resolveRetreat(activeImprint);
    const failed = game.resolveRunFailure(activeImprint);

    expect(failedAnchor.inventory.cycle_imprint).toBe(0);
    expect(failedAnchor.run?.lastProtocolSettlement).toMatchObject({
      status: 'failed',
      anchorCompletedBeforeBoss: false,
      cycleImprintGranted: false
    });
    expect(failedAnchor.lastOutcome).toContain('protocol=imprint:failed');
    expect(retreated.inventory.cycle_imprint).toBe(0);
    expect(retreated.lastOutcome).toContain('protocol=imprint:failed');
    expect(failed.inventory.cycle_imprint).toBe(0);
    expect(failed.lastOutcome).toContain('protocol=imprint:failed');
  });

  it('pays a successful deep protocol point bonus and x2 material without granting an imprint', () => {
    const standardReady = readyDemonTowerExit('standard', true);
    const deepReady = readyDemonTowerDeepExit();
    const standardExit = resolveExit(standardReady);
    const deepExit = resolveExit(deepReady);
    const settlement = deepExit.run?.lastProtocolSettlement;
    if (!settlement || !deepReady.run) throw new Error('Missing deep settlement');

    const evaluation = evaluateRunProtocolReward({
      dungeonId: deepReady.run.dungeonId,
      protocolId: 'deep',
      clearedNodeIds: deepExit.run?.clearedNodeIds ?? deepReady.run.clearedNodeIds,
      baseRewardPoints: settlement.baseRewardPoints
    });
    if (!evaluation.materialReward) throw new Error('Missing deep material reward');

    const standardGain = standardExit.rewardPoints - standardReady.rewardPoints;
    const deepGain = deepExit.rewardPoints - deepReady.rewardPoints;
    const standardMaterialGain =
      standardExit.inventory[evaluation.materialReward.itemId] - standardReady.inventory[evaluation.materialReward.itemId];
    const deepMaterialGain =
      deepExit.inventory[evaluation.materialReward.itemId] - deepReady.inventory[evaluation.materialReward.itemId];

    expect(evaluation).toMatchObject({
      canGrantProtocolReward: true,
      completedAnchorCount: 2,
      requiredAnchorCount: 2,
      materialReward: { amount: 2 }
    });
    expect(settlement).toMatchObject({
      protocol: { id: 'deep', rulesVersion: 1 },
      status: 'succeeded',
      bossDefeated: true,
      anchorCompletedBeforeBoss: true,
      rewardPointBonus: evaluation.rewardPoints - settlement.baseRewardPoints,
      cycleImprintGranted: false,
      materialReward: evaluation.materialReward
    });
    expect(deepGain - standardGain).toBe(settlement.rewardPointBonus);
    expect(deepMaterialGain - standardMaterialGain).toBe(2);
    expect(deepExit.inventory.cycle_imprint).toBe(deepReady.inventory.cycle_imprint);
    expect(deepExit.lastOutcome).toContain('protocol=deep:succeeded');
    expect(deepExit.lastOutcome).toContain(
      `material=${evaluation.materialReward.itemId}:${evaluation.materialReward.amount}`
    );
    expect(deepExit.log[0]).toMatch(/深层轮回协议成功.*双锚点 2\/2.*x2/);

    const repeated = resolveExit(deepExit);
    expect(repeated.rewardPoints).toBe(deepExit.rewardPoints);
    expect(repeated.inventory[evaluation.materialReward.itemId]).toBe(
      deepExit.inventory[evaluation.materialReward.itemId]
    );
    expect(repeated.inventory.cycle_imprint).toBe(deepExit.inventory.cycle_imprint);
    expect(repeated.run?.lastProtocolSettlement).toEqual(settlement);
  });

  it.each([
    ['one anchor', (anchors: readonly string[], bossNodeId: string) => [anchors[0], bossNodeId], 1],
    ['misordered second anchor', (anchors: readonly string[], bossNodeId: string) => [anchors[0], bossNodeId, anchors[1]], 2]
  ] as const)('fails deep settlement with %s and grants no protocol payout', (_label, clearedNodeIds, completedAnchorCount) => {
    const requiredNodeIds = getRunProtocolRequiredNodeIds(getDemonTowerDeepDefinition());
    const ready = readyDemonTowerDeepExit(clearedNodeIds(requiredNodeIds, getBossDefinition('demon_tower_1').nodeId));
    if (!ready.run) throw new Error('Missing failed deep run');
    const standardReady: GameState = {
      ...ready,
      run: {
        ...ready.run,
        protocol: { id: 'standard', rulesVersion: 1 }
      }
    };
    const standardExit = resolveExit(standardReady);
    const deepExit = resolveExit(ready);
    const settlement = deepExit.run?.lastProtocolSettlement;
    if (!settlement) throw new Error('Missing failed deep settlement');

    expect(deepExit.rewardPoints).toBe(standardExit.rewardPoints);
    expect(deepExit.inventory).toEqual(standardExit.inventory);
    expect(settlement).toMatchObject({
      status: 'failed',
      anchorCompletedBeforeBoss: false,
      protocolRewardPoints: settlement.baseRewardPoints,
      rewardPointBonus: 0,
      cycleImprintGranted: false
    });
    expect(settlement.materialReward).toBeUndefined();
    expect(deepExit.lastOutcome).toContain('protocol=deep:failed');
    expect(deepExit.lastOutcome).toContain(`anchors=${completedAnchorCount}/2`);
    expect(deepExit.lastOutcome).toContain('material=none');
    expect(deepExit.log[0]).toContain(`双锚点 ${completedAnchorCount}/2`);
    expect(deepExit.log[0]).toMatch(/深层轮回协议失败.*不发放协议奖励或材料/);
  });

  it('does not refund the deep entry imprint on retreat or failure', () => {
    const retreated = resolveRetreat(enterDemonTowerDeep());
    const failed = game.resolveRunFailure(enterDemonTowerDeep());

    for (const settled of [retreated, failed]) {
      expect(settled.inventory.cycle_imprint).toBe(0);
      expect(settled.lastOutcome).toContain('protocol=deep:failed');
      expect(settled.lastOutcome).toContain('material=none');
      expect(settled.log[0]).toMatch(/深层轮回协议失败.*不返还/);
    }
  });

  it('enforces attunement eligibility, charges each branch choice, and applies stats and power', () => {
    const initial = createInitialState();
    const maxLevel = EQUIPMENT.bone_spear.maxLevel;
    const eligible: GameState = {
      ...initial,
      rewardPoints: 2_000,
      lingyun: 4,
      inventory: {
        ...initial.inventory,
        cycle_imprint: 4
      },
      ownedEquipment: [...initial.ownedEquipment, 'bone_spear'],
      equipmentLevels: {
        ...initial.equipmentLevels,
        bone_spear: maxLevel
      },
      equipped: {
        ...initial.equipped,
        weapon: 'bone_spear'
      }
    };
    const baselineStats = getDerivedStats(eligible);
    const baselinePower = getPlayerPower(eligible);

    const inRun = game.attuneEquipment({ ...eligible, phase: 'explore' }, 'bone_spear', 'mist_vanguard');
    const basic = game.attuneEquipment(eligible, 'training_blade', 'mist_vanguard');
    const notMax = game.attuneEquipment(
      {
        ...eligible,
        equipmentLevels: { ...eligible.equipmentLevels, bone_spear: maxLevel - 1 }
      },
      'bone_spear',
      'mist_vanguard'
    );
    const mismatched = game.attuneEquipment(eligible, 'bone_spear', 'forge_overdrive');
    const first = game.attuneEquipment(eligible, 'bone_spear', 'mist_vanguard');
    const repeated = game.attuneEquipment(first, 'bone_spear', 'mist_vanguard');
    const switched = game.attuneEquipment(repeated, 'bone_spear', 'mist_veilguard');

    expect(inRun.equipmentAttunements?.bone_spear).toBeUndefined();
    expect(basic.equipmentAttunements?.training_blade).toBeUndefined();
    expect(notMax.equipmentAttunements?.bone_spear).toBeUndefined();
    expect(mismatched.rewardPoints).toBe(eligible.rewardPoints);
    expect(first.rewardPoints).toBe(eligible.rewardPoints - game.EQUIPMENT_ATTUNEMENT_COST.rewardPoints);
    expect(first.lingyun).toBe(eligible.lingyun - game.EQUIPMENT_ATTUNEMENT_COST.lingyun);
    expect(first.inventory.cycle_imprint).toBe(eligible.inventory.cycle_imprint - 1);
    expect(first.equipmentAttunements?.bone_spear).toBe('mist_vanguard');
    expect(getDerivedStats(first).speed).toBeGreaterThan(baselineStats.speed);
    expect(getPlayerPower(first)).toBeGreaterThan(
      getPlayerPower({ ...first, equipmentAttunements: {} })
    );
    expect(baselinePower).toBe(getPlayerPower({ ...eligible, equipmentAttunements: {} }));
    expect(game.getEquipmentSystemStatus(first).equipmentScores.bone_spear).toBeGreaterThan(
      game.getEquipmentSystemStatus(eligible).equipmentScores.bone_spear ?? 0
    );
    expect(repeated.rewardPoints).toBe(first.rewardPoints);
    expect(repeated.inventory.cycle_imprint).toBe(first.inventory.cycle_imprint);
    expect(switched.rewardPoints).toBe(first.rewardPoints - game.EQUIPMENT_ATTUNEMENT_COST.rewardPoints);
    expect(switched.inventory.cycle_imprint).toBe(first.inventory.cycle_imprint - 1);
    expect(switched.equipmentAttunements?.bone_spear).toBe('mist_veilguard');
  });

  it('treats old states without equipment attunements as an empty mapping', () => {
    const initial = createInitialState();
    const { equipmentAttunements: _removed, ...legacyFields } = initial;
    const legacy = legacyFields as GameState;

    expect(getDerivedStats(legacy)).toEqual(getDerivedStats({ ...initial, equipmentAttunements: {} }));
    expect(getPlayerPower(legacy)).toBe(getPlayerPower({ ...initial, equipmentAttunements: {} }));
    expect(game.getEquipmentSystemStatus(legacy)).toEqual(
      game.getEquipmentSystemStatus({ ...initial, equipmentAttunements: {} })
    );
  });

  it('tempers eligible max-level gear through exact rank costs and grows score, stats, and power', () => {
    const initial = createInitialState();
    const maxLevel = EQUIPMENT.guardian_plate.maxLevel;
    const eligibleDraft: GameState = {
      ...initial,
      rewardPoints: 2_000,
      lingyun: 4,
      inventory: { ...initial.inventory, star_iron: 6 },
      ownedEquipment: [...initial.ownedEquipment, 'guardian_plate'],
      equipmentLevels: { ...initial.equipmentLevels, guardian_plate: maxLevel },
      equipmentAttunements: { guardian_plate: 'forge_overdrive' },
      equipped: { ...initial.equipped, armor: 'guardian_plate' }
    };
    const eligibleMaxHp = getDerivedStats(eligibleDraft).maxHp;
    const eligible: GameState = {
      ...eligibleDraft,
      player: { ...eligibleDraft.player, hp: eligibleMaxHp - 10, maxHp: eligibleMaxHp }
    };
    const rankOneCost = game.getEquipmentTemperStatus(eligible, 'guardian_plate').nextCost;
    const beforeStats = getDerivedStats(eligible);
    const beforeSystem = game.getEquipmentSystemStatus(eligible);
    const beforePower = getPlayerPower(eligible);
    const beforeResonance = game.getCurrentWeaponResonanceProgress(eligible);
    if (!rankOneCost) throw new Error('Missing rank I temper cost');

    const rankOne = game.temperEquipment(eligible, 'guardian_plate');
    const rankTwoCost = game.getEquipmentTemperStatus(rankOne, 'guardian_plate').nextCost;
    if (!rankTwoCost) throw new Error('Missing rank II temper cost');
    const rankTwo = game.temperEquipment(rankOne, 'guardian_plate');

    expect(rankOne.equipmentTemperRanks?.guardian_plate).toBe(1);
    expect(rankOne.rewardPoints).toBe(eligible.rewardPoints - rankOneCost.rewardPoints);
    expect(rankOne.lingyun).toBe(eligible.lingyun - (rankOneCost.lingyun ?? 0));
    expect(rankOne.inventory.star_iron).toBe(
      eligible.inventory.star_iron - (rankOneCost.items.star_iron ?? 0)
    );
    expect(getDerivedStats(rankOne).maxHp).toBe(beforeStats.maxHp + 24);
    expect(rankOne.player.maxHp).toBe(eligible.player.maxHp + 24);
    expect(rankOne.player.hp).toBe(eligible.player.hp + 24);
    expect(game.getEquipmentSystemStatus(rankOne).equipmentScores.guardian_plate).toBeGreaterThan(
      beforeSystem.equipmentScores.guardian_plate ?? 0
    );
    expect(getPlayerPower(rankOne)).toBeGreaterThan(beforePower);
    expect(rankOne.log[0]).toContain('淬炼至 I');
    expect(rankOne.log[0]).toContain(ITEMS.star_iron.name);

    expect(rankTwo.equipmentTemperRanks?.guardian_plate).toBe(2);
    expect(rankTwo.rewardPoints).toBe(rankOne.rewardPoints - rankTwoCost.rewardPoints);
    expect(rankTwo.lingyun).toBe(rankOne.lingyun - (rankTwoCost.lingyun ?? 0));
    expect(rankTwo.inventory.star_iron).toBe(
      rankOne.inventory.star_iron - (rankTwoCost.items.star_iron ?? 0)
    );
    expect(game.getEquipmentSystemStatus(rankTwo).totalScore).toBeGreaterThan(
      game.getEquipmentSystemStatus(rankOne).totalScore
    );
    expect(getPlayerPower(rankTwo)).toBeGreaterThan(getPlayerPower(rankOne));
    expect(rankTwo.equipmentLevels).toEqual(eligible.equipmentLevels);
    expect(game.getEquipmentSystemStatus(rankTwo).setCounts).toEqual(beforeSystem.setCounts);
    expect(game.getEquipmentSystemStatus(rankTwo).activeSets).toEqual(beforeSystem.activeSets);
    expect(game.getCurrentWeaponResonanceProgress(rankTwo)).toEqual(beforeResonance);
    expect(game.getEquipmentTemperStatus(rankTwo, 'guardian_plate')).toMatchObject({
      currentRank: 2,
      nextRank: undefined,
      nextCost: undefined
    });
  });

  it('enforces every temper gate atomically, including exact-item attunement for rank II', () => {
    const initial = createInitialState();
    const maxLevel = EQUIPMENT.guardian_plate.maxLevel;
    const eligible: GameState = {
      ...initial,
      rewardPoints: 2_000,
      lingyun: 4,
      inventory: { ...initial.inventory, star_iron: 6 },
      ownedEquipment: [...initial.ownedEquipment, 'guardian_plate'],
      equipmentLevels: { ...initial.equipmentLevels, guardian_plate: maxLevel }
    };
    const assertAtomicFailure = (before: GameState, after: GameState, reason: RegExp) => {
      expect(after.rewardPoints).toBe(before.rewardPoints);
      expect(after.lingyun).toBe(before.lingyun);
      expect(after.inventory).toEqual(before.inventory);
      expect(after.equipmentTemperRanks).toEqual(before.equipmentTemperRanks);
      expect(after.player).toEqual(before.player);
      expect(after.log[0]).toMatch(reason);
    };

    assertAtomicFailure(
      { ...eligible, phase: 'explore' },
      game.temperEquipment({ ...eligible, phase: 'explore' }, 'guardian_plate'),
      /主神空间/
    );
    const unowned = { ...eligible, ownedEquipment: initial.ownedEquipment };
    assertAtomicFailure(unowned, game.temperEquipment(unowned, 'guardian_plate'), /还没有/);
    assertAtomicFailure(eligible, game.temperEquipment(eligible, 'training_blade'), /高阶装备/);
    const underleveled = {
      ...eligible,
      equipmentLevels: { ...eligible.equipmentLevels, guardian_plate: maxLevel - 1 }
    };
    assertAtomicFailure(underleveled, game.temperEquipment(underleveled, 'guardian_plate'), /最高等级/);
    const insufficient = {
      ...eligible,
      rewardPoints: 0,
      inventory: { ...eligible.inventory, star_iron: 0 }
    };
    assertAtomicFailure(insufficient, game.temperEquipment(insufficient, 'guardian_plate'), /资源不足/);

    const rankOne = game.temperEquipment(eligible, 'guardian_plate');
    assertAtomicFailure(rankOne, game.temperEquipment(rankOne, 'guardian_plate'), /自己的铭刻/);
    const attunedElsewhere: GameState = {
      ...rankOne,
      equipmentAttunements: { starforged_edge: 'forge_overdrive' }
    };
    assertAtomicFailure(
      attunedElsewhere,
      game.temperEquipment(attunedElsewhere, 'guardian_plate'),
      /自己的铭刻/
    );
    const invalidExact: GameState = {
      ...rankOne,
      equipmentAttunements: { guardian_plate: 'mist_vanguard' }
    };
    assertAtomicFailure(invalidExact, game.temperEquipment(invalidExact, 'guardian_plate'), /自己的铭刻/);

    const rankTwo = game.temperEquipment(
      { ...rankOne, equipmentAttunements: { guardian_plate: 'forge_overdrive' } },
      'guardian_plate'
    );
    assertAtomicFailure(rankTwo, game.temperEquipment(rankTwo, 'guardian_plate'), /淬炼上限/);
  });

  it('treats missing legacy temper ranks exactly as an empty mapping', () => {
    const initial = createInitialState();
    const { equipmentTemperRanks: _removed, ...legacyFields } = initial;
    const legacy = legacyFields as GameState;

    expect(initial.equipmentTemperRanks).toEqual({});
    expect(game.getEquipmentTemperStatus(legacy, 'guardian_plate')).toEqual(
      game.getEquipmentTemperStatus(initial, 'guardian_plate')
    );
    expect(getDerivedStats(legacy)).toEqual(getDerivedStats(initial));
    expect(getPlayerPower(legacy)).toBe(getPlayerPower(initial));
    expect(game.getEquipmentSystemStatus(legacy)).toEqual(game.getEquipmentSystemStatus(initial));
  });
});

describe('run pressure core integration', () => {
  function unlockedState(): GameState {
    return {
      ...createInitialState(),
      completedDungeonIds: [...DUNGEON_ORDER],
      claimedTaskIds: DUNGEON_ORDER.map((dungeonId) => `mainline_clear_${dungeonId}`)
    };
  }

  function pressureStateAt(clearedNodeCount: number): RunPressureState {
    return { rulesVersion: 1, clearedNodeCount };
  }

  function withPressure(state: GameState, clearedNodeCount: number): GameState {
    if (!state.run) return state;
    return {
      ...state,
      run: {
        ...state.run,
        pressureState: pressureStateAt(clearedNodeCount)
      }
    };
  }

  function withoutPressure(state: GameState): GameState {
    if (!state.run) return state;
    const { pressureState: _pressureState, lastPressureSettlement: _settlement, ...legacyRun } = state.run;
    return { ...state, run: legacyRun };
  }

  function atNode(state: GameState, nodeId: string): GameState {
    if (!state.run) return state;
    return {
      ...state,
      phase: 'explore',
      combat: undefined,
      run: {
        ...state.run,
        currentNodeId: nodeId
      }
    };
  }

  function durable(state: GameState): GameState {
    return {
      ...state,
      player: {
        ...state.player,
        hp: 10_000,
        maxHp: 10_000
      }
    };
  }

  function readyPressureExit(clearedNodeCount: number): GameState {
    const entered = enterDungeon(unlockedState(), 'demon_tower_1', 'imprint');
    const protocol = getRunProtocolDefinition('demon_tower_1', 'imprint');
    const exitNode = DUNGEONS.demon_tower_1.nodes.find((node) => node.type === 'exit');
    if (!entered.run || !protocol || protocol.id !== 'imprint' || !exitNode) {
      throw new Error('Missing pressure exit fixture');
    }

    return atNode(
      {
        ...entered,
        run: {
          ...entered.run,
          clearedNodeIds: [protocol.requiredNodeId, getBossDefinition('demon_tower_1').nodeId],
          pressureState: pressureStateAt(clearedNodeCount)
        }
      },
      exitNode.id
    );
  }

  it('freezes a zero-count snapshot for new runs and exposes an active status', () => {
    const initial = createInitialState();
    const entered = enterDungeon(initial, 'demon_tower_1');

    expect(game.getCurrentRunPressure(initial)).toEqual({ legacyDisabled: false });
    expect(entered.run?.pressureState).toEqual(createRunPressureState());
    expect(game.getCurrentRunPressure(entered)).toEqual({
      legacyDisabled: false,
      status: {
        state: createRunPressureState(),
        tier: 'stable',
        label: '稳定',
        pressurePercent: 0,
        rewardBonusPercent: 15,
        nextTierAt: 6
      }
    });
  });

  it('advances only on the first non-exit clear and leaves exit settlement at the prior count', () => {
    const entered = enterDungeon(createInitialState(), 'demon_tower_1');
    const rewardNode = DUNGEONS.demon_tower_1.nodes.find((node) => node.type === 'reward' && node.reward);
    const exitNode = DUNGEONS.demon_tower_1.nodes.find((node) => node.type === 'exit');
    if (!entered.run || !rewardNode || !exitNode) throw new Error('Missing pressure clear fixture');

    const firstClear = collectReward(atNode(entered, rewardNode.id));
    const repeatedClear = collectReward(atNode(firstClear, rewardNode.id));
    expect(firstClear.run?.pressureState).toEqual(pressureStateAt(1));
    expect(repeatedClear.run?.pressureState).toEqual(pressureStateAt(1));

    const exitReady = atNode(
      {
        ...repeatedClear,
        run: repeatedClear.run
          ? {
              ...repeatedClear.run,
              clearedNodeIds: [
                ...repeatedClear.run.clearedNodeIds,
                getBossDefinition('demon_tower_1').nodeId
              ]
            }
          : repeatedClear.run
      },
      exitNode.id
    );
    const exited = resolveExit(exitReady);

    expect(exited.run?.clearedNodeIds).toContain(exitNode.id);
    expect(exited.run?.pressureState).toEqual(pressureStateAt(1));
    expect(exited.run?.lastPressureSettlement?.state).toEqual(pressureStateAt(1));
  });

  it('layers hunted and breach pressure after boss, law, and protocol scaling', () => {
    const bossNodeId = getBossDefinition('demon_tower_1').nodeId;
    const startBoss = (clearedNodeCount: number) => {
      const entered = withPressure(
        enterDungeon(unlockedState(), 'demon_tower_1', 'imprint'),
        clearedNodeCount
      );
      return selectNode(atNode(entered, bossNodeId), bossNodeId);
    };
    const stable = startBoss(5);
    const stableMonster = game.getCombatEncounterProfile(stable)?.monster;
    if (!stableMonster) throw new Error('Missing pressure boss profile');

    for (const clearedNodeCount of [6, 12]) {
      const pressured = startBoss(clearedNodeCount);
      const expected = scaleMonsterForRunPressure(stableMonster, pressureStateAt(clearedNodeCount));
      expect(game.getCombatEncounterProfile(pressured)?.monster).toEqual(expected);
      expect(pressured.combat?.monsterHp).toBe(expected.maxHp);
    }
  });

  it('layers pressure after law and protocol trap scaling at both thresholds', () => {
    const entered = durable(enterDungeon(unlockedState(), 'starfall_mine', 'imprint'));
    const trapNode = DUNGEONS.starfall_mine.nodes.find((node) => node.trap);
    if (!entered.run || !trapNode?.trap) throw new Error('Missing pressure trap fixture');

    const trapModifiers = game.getCurrentDungeonLaw(entered)?.modifiers.trap;
    if (!trapModifiers) throw new Error('Missing pressure trap law');
    expect(trapModifiers).toEqual({ damagePercent: -20, dcPercent: -20 });

    const lawTrap = {
      ...trapNode.trap,
      damage: Math.max(1, Math.ceil((trapNode.trap.damage * (100 + trapModifiers.damagePercent)) / 100)),
      dc: Math.max(1, Math.ceil((trapNode.trap.dc * (100 + trapModifiers.dcPercent)) / 100))
    };
    const protocolTrap = scaleTrapForRunProtocol(lawTrap, 'starfall_mine', 'imprint');

    for (const clearedNodeCount of [5, 6, 12]) {
      const active = atNode(withPressure(entered, clearedNodeCount), trapNode.id);
      const expectedTrap = scaleTrapForRunPressure(protocolTrap, pressureStateAt(clearedNodeCount));
      const naturallyPassed = getDerivedStats(active).trapCheck >= expectedTrap.dc;
      const expectedDamage = Math.max(
        4,
        Math.floor((naturallyPassed ? expectedTrap.damage * 0.45 : expectedTrap.damage))
      );
      const resolved = handleTrap(active, 'risk');

      expect((resolved.run?.damageTaken ?? 0) - (active.run?.damageTaken ?? 0)).toBe(expectedDamage);
    }
  });

  it('advances the portal node once and carries the resulting snapshot into the target dungeon', () => {
    const entered = durable(enterDungeon(unlockedState(), 'demon_tower_1', 'imprint'));
    const portalNode = DUNGEONS.demon_tower_1.nodes.find((node) => node.portal);
    if (!entered.run || !portalNode?.portal) throw new Error('Missing pressure portal fixture');

    const source = atNode(withPressure(entered, 6), portalNode.id);
    const transported = usePortal(source, 'force');

    expect(transported.run?.dungeonId).toBe(portalNode.portal.targetDungeonId);
    expect(transported.run?.pressureState).toEqual(
      advanceRunPressureOnNodeClear(pressureStateAt(6))
    );
  });

  it('keeps legacy runs disabled and never synthesizes pressure through a portal', () => {
    const entered = durable(enterDungeon(unlockedState(), 'demon_tower_1', 'imprint'));
    const portalNode = DUNGEONS.demon_tower_1.nodes.find((node) => node.portal);
    if (!entered.run || !portalNode?.portal) throw new Error('Missing legacy pressure fixture');

    const legacy = atNode(withoutPressure(entered), portalNode.id);
    const transported = usePortal(legacy, 'force');

    expect(game.getCurrentRunPressure(legacy)).toEqual({ legacyDisabled: true });
    expect(transported.run?.pressureState).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(transported.run, 'pressureState')).toBe(false);
    expect(game.getCurrentRunPressure(transported)).toEqual({ legacyDisabled: true });
  });

  it.each([
    [5, 'stable', 15],
    [6, 'hunted', 5],
    [12, 'breach', 0]
  ] as const)(
    'settles the exit bonus from economy points at %i cleared nodes without changing protocol rewards',
    (clearedNodeCount, tier: RunPressureTier, rewardBonusPercent) => {
      const ready = readyPressureExit(clearedNodeCount);
      const resolved = resolveExit(ready);
      const pressureSettlement = resolved.run?.lastPressureSettlement;
      const protocolSettlement = resolved.run?.lastProtocolSettlement;
      if (!pressureSettlement || !protocolSettlement) throw new Error('Missing pressure settlement');

      const expectedBonus = Math.floor(
        (protocolSettlement.baseRewardPoints * rewardBonusPercent) / 100
      );
      expect(pressureSettlement).toEqual({
        state: pressureStateAt(clearedNodeCount),
        tier,
        rewardPointBonus: expectedBonus
      });
      expect(pressureSettlement.rewardPointBonus).toBe(
        calculateRunPressureBonus(protocolSettlement.baseRewardPoints, pressureStateAt(clearedNodeCount))
      );
      expect(resolved.rewardPoints - ready.rewardPoints).toBe(
        protocolSettlement.baseRewardPoints +
          protocolSettlement.rewardPointBonus +
          pressureSettlement.rewardPointBonus
      );
      expect(resolved.claimedDirectiveIds).toEqual(ready.claimedDirectiveIds);
      expect(resolved.inventory.cycle_imprint).toBe(ready.inventory.cycle_imprint + 1);
      expect(resolved.lastOutcome).toContain(`pressure=${tier}`);
      expect(resolved.lastOutcome).toContain(`pressureBonus=${expectedBonus}`);
      expect(resolved.log[0]).toContain('侵蚀结算');
      expect(resolved.log[0]).toContain(`+${expectedBonus} 奖励点`);
    }
  );

  it('does not apply or record pressure bonuses on retreat or failure', () => {
    const active = withPressure(enterDungeon(unlockedState(), 'demon_tower_1'), 5);
    const legacy = withoutPressure(active);
    const retreated = resolveRetreat(active);
    const legacyRetreated = resolveRetreat(legacy);
    const failed = game.resolveRunFailure(active);
    const legacyFailed = game.resolveRunFailure(legacy);

    expect(retreated.rewardPoints).toBe(legacyRetreated.rewardPoints);
    expect(failed.rewardPoints).toBe(legacyFailed.rewardPoints);
    expect(retreated.run?.lastPressureSettlement).toBeUndefined();
    expect(failed.run?.lastPressureSettlement).toBeUndefined();
    expect(retreated.lastOutcome).not.toContain('pressureBonus');
    expect(failed.lastOutcome).not.toContain('pressureBonus');
  });
});

describe('law-driven route gate integration', () => {
  const openingStyles: readonly CombatOpeningStyle[] = ['force', 'art', 'guard'];

  function unlockedState(): GameState {
    const state = createInitialState();
    return {
      ...state,
      completedDungeonIds: [...DUNGEON_ORDER],
      claimedTaskIds: DUNGEON_ORDER.map((dungeonId) => `mainline_clear_${dungeonId}`)
    };
  }

  function withLaw(dungeonId: game.DungeonId, law: DungeonLawState['law']): DungeonLawState {
    return { ...createDungeonLawState(dungeonId), law };
  }

  function withOpenings(
    dungeonId: 'ash_arena' | 'void_citadel',
    counts: Record<CombatOpeningStyle, number>
  ): DungeonLawState {
    const bossNodeId = getBossDefinition(dungeonId).nodeId;
    const nodeIds = DUNGEONS[dungeonId].nodes
      .filter((node) => node.monsterId && node.id !== bossNodeId)
      .map((node) => node.id);
    const combatOpenings: DungeonLawState['combatOpenings'] = {};
    const combatVictoryNodeIds: string[] = [];
    let index = 0;

    for (const style of openingStyles) {
      for (let count = 0; count < counts[style]; count += 1) {
        const nodeId = nodeIds[index];
        if (!nodeId) throw new Error(`Missing ${dungeonId} opening fixture`);
        combatOpenings[nodeId] = { isBoss: false, style };
        combatVictoryNodeIds.push(nodeId);
        index += 1;
      }
    }

    return {
      ...createDungeonLawState(dungeonId),
      combatOpenings,
      combatVictoryNodeIds
    };
  }

  const gateCases: readonly {
    dungeonId: game.DungeonId;
    openState: DungeonLawState;
    closedState: DungeonLawState;
  }[] = [
    {
      dungeonId: 'demon_tower_1',
      openState: withLaw('demon_tower_1', { kind: 'demon_tower', fogPressure: 1 }),
      closedState: withLaw('demon_tower_1', { kind: 'demon_tower', fogPressure: 2 })
    },
    {
      dungeonId: 'metro_abyss',
      openState: withLaw('metro_abyss', { kind: 'metro_abyss', tide: 'ebb' }),
      closedState: withLaw('metro_abyss', { kind: 'metro_abyss', tide: 'mirror' })
    },
    {
      dungeonId: 'starfall_mine',
      openState: withLaw('starfall_mine', { kind: 'starfall_mine', gravity: 'upward' }),
      closedState: withLaw('starfall_mine', { kind: 'starfall_mine', gravity: 'downward' })
    },
    {
      dungeonId: 'rust_hospital',
      openState: withLaw('rust_hospital', { kind: 'rust_hospital', pollution: 2 }),
      closedState: withLaw('rust_hospital', { kind: 'rust_hospital', pollution: 3 })
    },
    {
      dungeonId: 'ash_arena',
      openState: withOpenings('ash_arena', { force: 1, art: 1, guard: 1 }),
      closedState: withOpenings('ash_arena', { force: 1, art: 1, guard: 0 })
    },
    {
      dungeonId: 'dream_archive',
      openState: withLaw('dream_archive', {
        kind: 'dream_archive',
        sealedFeatures: ['consumable']
      }),
      closedState: withLaw('dream_archive', {
        kind: 'dream_archive',
        sealedFeatures: ['consumable', 'method']
      })
    },
    {
      dungeonId: 'void_citadel',
      openState: withOpenings('void_citadel', { force: 2, art: 2, guard: 1 }),
      closedState: withOpenings('void_citadel', { force: 3, art: 1, guard: 1 })
    },
    {
      dungeonId: 'temporal_observatory',
      openState: withLaw('temporal_observatory', {
        kind: 'temporal_observatory',
        pastCalibrated: true,
        futureCalibrated: true
      }),
      closedState: withLaw('temporal_observatory', {
        kind: 'temporal_observatory',
        pastCalibrated: false,
        futureCalibrated: false
      })
    },
    {
      dungeonId: 'causal_clearinghouse',
      openState: withLaw('causal_clearinghouse', {
        kind: 'causal_clearinghouse',
        debt: 1,
        pendingLedgerNodeId: null,
        settledLedgerNodeIds: [],
        bossDebtLocked: false,
        collectionSeals: 0,
        entryPassives: {
          causalVisor: false,
          echoBreakerGauntlets: false,
          returnAnchorBelt: false
        },
        visorCreditUsed: false
      }),
      closedState: withLaw('causal_clearinghouse', {
        kind: 'causal_clearinghouse',
        debt: 3,
        pendingLedgerNodeId: null,
        settledLedgerNodeIds: [],
        bossDebtLocked: false,
        collectionSeals: 0,
        entryPassives: {
          causalVisor: false,
          echoBreakerGauntlets: false,
          returnAnchorBelt: false
        },
        visorCreditUsed: false
      })
    },
    {
      dungeonId: 'entropy_ark',
      openState: withLaw('entropy_ark', {
        kind: 'entropy_ark',
        entropy: 1,
        pendingHeadingNodeId: null,
        resolvedHeadingChoices: {},
        bossEntropyLocked: false,
        collapseLayers: 0,
        entryPassives: {
          entropyCompass: false,
          dissipationMantle: false,
          arkKeelBoots: false
        },
        compassCreditUsed: false
      }),
      closedState: withLaw('entropy_ark', {
        kind: 'entropy_ark',
        entropy: 2,
        pendingHeadingNodeId: null,
        resolvedHeadingChoices: {},
        bossEntropyLocked: false,
        collapseLayers: 0,
        entryPassives: {
          entropyCompass: false,
          dissipationMantle: false,
          arkKeelBoots: false
        },
        compassCreditUsed: false
      })
    },
    {
      dungeonId: 'mirror_cycle_city',
      openState: withLaw('mirror_cycle_city', {
        kind: 'mirror_cycle_city',
        currentPhase: 'real',
        pendingPhaseNodeId: null,
        resolvedPhaseChoices: {},
        anchors: { real: false, mirror: false },
        bossAnchorSnapshot: null,
        brokenMirrorShells: 0,
        entryPassives: {
          parallaxVisor: false,
          phaseweaveMantle: false,
          homecomingPrism: false
        }
      }),
      closedState: withLaw('mirror_cycle_city', {
        kind: 'mirror_cycle_city',
        currentPhase: 'mirror',
        pendingPhaseNodeId: null,
        resolvedPhaseChoices: {},
        anchors: { real: false, mirror: false },
        bossAnchorSnapshot: null,
        brokenMirrorShells: 0,
        entryPassives: {
          parallaxVisor: false,
          phaseweaveMantle: false,
          homecomingPrism: false
        }
      })
    },
    {
      dungeonId: 'redaction_scriptorium',
      openState: withLaw('redaction_scriptorium', {
        kind: 'redaction_scriptorium',
        pendingClauseNodeId: null,
        resolvedClauseChoices: { memory_clause_desk: 'certify' },
        bossClauseSnapshot: null,
        entryPassives: {
          redlineEdge: false,
          palimpsestMantle: false,
          finalProofSeal: false
        }
      }),
      closedState: withLaw('redaction_scriptorium', {
        kind: 'redaction_scriptorium',
        pendingClauseNodeId: null,
        resolvedClauseChoices: { memory_clause_desk: 'redact' },
        bossClauseSnapshot: null,
        entryPassives: {
          redlineEdge: false,
          palimpsestMantle: false,
          finalProofSeal: false
        }
      })
    },
    {
      dungeonId: 'legacy_auction_court',
      openState: withLaw('legacy_auction_court', {
        kind: 'legacy_auction_court',
        pendingLotNodeId: null,
        resolvedLotChoices: { force_lot_dais: 'bid' },
        bossLotSnapshot: null,
        entryPassives: {
          legacyGavel: false,
          anonymousVeil: false,
          escrowPlate: false,
          finalLotBell: false
        }
      }),
      closedState: withLaw('legacy_auction_court', {
        kind: 'legacy_auction_court',
        pendingLotNodeId: null,
        resolvedLotChoices: { force_lot_dais: 'fold' },
        bossLotSnapshot: null,
        entryPassives: {
          legacyGavel: false,
          anonymousVeil: false,
          escrowPlate: false,
          finalLotBell: false
        }
      })
    },
    {
      dungeonId: 'genesis_vault',
      openState: withLaw('genesis_vault', {
        kind: 'genesis_vault',
        pendingSpliceNodeId: null,
        spliceSequence: ['force', 'force'],
        bossGenomeSnapshot: null,
        entryGear: { helixCleaver: false, symbioteCowl: false, carapaceHarness: false, rebirthAmulet: false },
        entryBloodline: { aspect: null, rank: 0 }
      }),
      closedState: withLaw('genesis_vault', {
        kind: 'genesis_vault',
        pendingSpliceNodeId: null,
        spliceSequence: ['force'],
        bossGenomeSnapshot: null,
        entryGear: { helixCleaver: false, symbioteCowl: false, carapaceHarness: false, rebirthAmulet: false },
        entryBloodline: { aspect: null, rank: 0 }
      })
    },
    {
      dungeonId: 'silent_broadcast_tower',
      openState: {
        ...withLaw('silent_broadcast_tower', {
          kind: 'silent_broadcast_tower',
          noise: 1,
          pendingRelayNodeId: null,
          resolvedRelayChoices: {
            north_relay_console: 'mute',
            central_relay_console: 'mute'
          },
          bossNoiseSnapshot: null,
          entryPassives: {
            hushblade: false,
            deadAirHeadset: false,
            anechoicMantle: false,
            lastChannelBeacon: false
          },
          firstClashMutedUsed: false
        }),
        clearedNodeIds: ['north_relay_console', 'central_relay_console']
      },
      closedState: {
        ...withLaw('silent_broadcast_tower', {
          kind: 'silent_broadcast_tower',
          noise: 2,
          pendingRelayNodeId: null,
          resolvedRelayChoices: {
            north_relay_console: 'mute',
            central_relay_console: 'broadcast'
          },
          bossNoiseSnapshot: null,
          entryPassives: {
            hushblade: false,
            deadAirHeadset: false,
            anechoicMantle: false,
            lastChannelBeacon: false
          },
          firstClashMutedUsed: false
        }),
        clearedNodeIds: ['north_relay_console', 'central_relay_console']
      }
    },
    {
      dungeonId: 'lost_shelter',
      openState: {
        ...withLaw('lost_shelter', {
          kind: 'lost_shelter',
          survivorHp: 75,
          pendingCheckpointNodeId: null,
          resolvedCheckpointChoices: {
            north_checkpoint: 'treat',
            central_checkpoint: 'treat',
            south_checkpoint: 'push'
          },
          bossSurvivorSnapshot: null,
          entryGear: {
            rescueCarbine: false,
            triageVisor: false,
            evacuationPlate: false,
            blackboxBeacon: false
          },
          entryCompanion: { id: null, rank: 0 },
          firstHazardGuardUsed: false,
          companionAnalysisUsed: false,
          companionTriageUsed: false
        }),
        clearedNodeIds: ['north_checkpoint', 'central_checkpoint', 'south_checkpoint']
      },
      closedState: {
        ...withLaw('lost_shelter', {
          kind: 'lost_shelter',
          survivorHp: 74,
          pendingCheckpointNodeId: null,
          resolvedCheckpointChoices: {
            north_checkpoint: 'treat',
            central_checkpoint: 'push',
            south_checkpoint: 'push'
          },
          bossSurvivorSnapshot: null,
          entryGear: {
            rescueCarbine: false,
            triageVisor: false,
            evacuationPlate: false,
            blackboxBeacon: false
          },
          entryCompanion: { id: null, rank: 0 },
          firstHazardGuardUsed: false,
          companionAnalysisUsed: false,
          companionTriageUsed: false
        }),
        clearedNodeIds: ['north_checkpoint', 'central_checkpoint', 'south_checkpoint']
      }
    },
    {
      dungeonId: 'false_testimony_court',
      openState: {
        ...withLaw('false_testimony_court', {
          kind: 'false_testimony_court',
          revealedEvidenceIds: ['voice_evidence', 'timeline_evidence', 'residue_evidence'],
          contaminatedEvidenceIds: [],
          pendingVerdictNodeId: null,
          accusedSuspect: 'route_surveyor',
          accusationCorrect: true,
          accusationTrustedCount: 3,
          appealUsed: false,
          bossVerdictSnapshot: null,
          entryGear: {
            crossExaminerSabre: false,
            forensicVisor: false,
            custodyShell: false,
            appealSeal: false
          },
          custodyProtectionUsed: false
        }),
        clearedNodeIds: [
          'voice_evidence', 'timeline_evidence', 'residue_evidence',
          'voice_filter_trap', 'timeline_checksum_trap', 'residue_sterility_trap'
        ]
      },
      closedState: {
        ...withLaw('false_testimony_court', {
          kind: 'false_testimony_court',
          revealedEvidenceIds: ['voice_evidence', 'timeline_evidence', 'residue_evidence'],
          contaminatedEvidenceIds: [],
          pendingVerdictNodeId: null,
          accusedSuspect: 'route_surveyor',
          accusationCorrect: true,
          accusationTrustedCount: 2,
          appealUsed: false,
          bossVerdictSnapshot: null,
          entryGear: {
            crossExaminerSabre: false,
            forensicVisor: false,
            custodyShell: false,
            appealSeal: false
          },
          custodyProtectionUsed: false
        }),
        clearedNodeIds: [
          'voice_evidence', 'timeline_evidence', 'residue_evidence',
          'voice_filter_trap', 'timeline_checksum_trap', 'residue_sterility_trap'
        ]
      }
    }
  ];

  function atGate(
    dungeonId: game.DungeonId,
    lawState: DungeonLawState,
    direction: 'forward' | 'reverse' = 'forward'
  ): GameState {
    const gate = DUNGEON_ROUTE_GATES[dungeonId][0];
    const entered = enterDungeon(unlockedState(), dungeonId);
    if (!gate || !entered.run) throw new Error(`Missing ${dungeonId} route fixture`);
    const currentNodeId = direction === 'forward' ? gate.fromNodeId : gate.toNodeId;

    return {
      ...entered,
      run: {
        ...entered.run,
        currentNodeId,
        clearedNodeIds: [gate.fromNodeId, gate.toNodeId],
        lawState
      }
    };
  }

  it('tables open and closed integrated helper results for all legacy directional gates', () => {
    expect(gateCases.map((entry) => entry.dungeonId)).toEqual(
      DUNGEON_ORDER.filter((dungeonId) => dungeonId !== 'combat_replay_stage' && dungeonId !== 'panopticon_city')
    );

    for (const entry of gateCases) {
      const gate = DUNGEON_ROUTE_GATES[entry.dungeonId][0];
      if (!gate) throw new Error(`Missing ${entry.dungeonId} gate`);
      const open = atGate(entry.dungeonId, entry.openState);
      const closed = atGate(entry.dungeonId, entry.closedState);

      expect(game.getCurrentRouteGateStatus(open, gate.toNodeId), entry.dungeonId).toMatchObject({
        status: 'open',
        isOpen: true
      });
      expect(game.getCurrentRouteBlockReason(open, gate.toNodeId), entry.dungeonId).toBeUndefined();
      expect(game.getCurrentRouteGateStatus(closed, gate.toNodeId), entry.dungeonId).toMatchObject({
        status: 'closed',
        isOpen: false
      });
      expect(game.getCurrentRouteBlockReason(closed, gate.toNodeId), entry.dungeonId).toBeTruthy();
      expect(game.getCurrentLegalAdjacentTargetIds(open), entry.dungeonId).toContain(gate.toNodeId);
      expect(game.getCurrentLegalAdjacentTargetIds(closed), entry.dungeonId).not.toContain(gate.toNodeId);
    }
  });

  it.each(['demon_tower_1', 'metro_abyss', 'ash_arena'] as const)(
    'blocks and reopens representative %s movement while preserving directional retreat',
    (dungeonId) => {
      const entry = gateCases.find((candidate) => candidate.dungeonId === dungeonId);
      const gate = DUNGEON_ROUTE_GATES[dungeonId][0];
      if (!entry || !gate) throw new Error(`Missing ${dungeonId} gate case`);
      const closed = atGate(dungeonId, entry.closedState);
      const blocked = game.moveToNode(closed, gate.toNodeId);
      const opened = game.moveToNode(atGate(dungeonId, entry.openState), gate.toNodeId);
      const retreated = game.moveToNode(atGate(dungeonId, entry.closedState, 'reverse'), gate.fromNodeId);

      expect(blocked.run?.currentNodeId).toBe(gate.fromNodeId);
      expect(blocked.log[0]).toContain(gate.label);
      expect(blocked.log[0]).toContain(game.getCurrentRouteBlockReason(closed, gate.toNodeId));
      expect(opened.run?.currentNodeId).toBe(gate.toNodeId);
      expect(retreated.run?.currentNodeId).toBe(gate.fromNodeId);
    }
  );

  it('normalizes a missing legacy law to its initial gate state', () => {
    const entry = gateCases[0];
    const gate = DUNGEON_ROUTE_GATES.demon_tower_1[0];
    const current = atGate('demon_tower_1', entry.openState);
    if (!current.run || !gate) throw new Error('Missing legacy route fixture');
    const { lawState: _removed, ...legacyRun } = current.run;
    const legacy: GameState = { ...current, run: legacyRun };

    expect(game.getCurrentRouteGateStatus(legacy, gate.toNodeId)).toMatchObject({ status: 'open' });
    expect(game.moveToNode(legacy, gate.toNodeId).run?.currentNodeId).toBe(gate.toNodeId);
  });
});

describe('tactical loadout core integration', () => {
  function unlockedHub(): GameState {
    const state = createInitialState();
    return {
      ...state,
      completedDungeonIds: [...DUNGEON_ORDER],
      claimedTaskIds: DUNGEON_ORDER.map((dungeonId) => `mainline_clear_${dungeonId}`)
    };
  }

  function atNode(state: GameState, nodeId: string): GameState {
    if (!state.run) throw new Error('Missing run');
    return {
      ...state,
      phase: 'explore',
      combat: undefined,
      run: {
        ...state.run,
        currentNodeId: nodeId
      }
    };
  }

  function withItem(state: GameState, itemId: game.ItemId, amount = 1): GameState {
    return {
      ...state,
      inventory: {
        ...state.inventory,
        [itemId]: amount
      }
    };
  }

  function withPortalHealth(state: GameState, hp = 1_000): GameState {
    return {
      ...state,
      player: {
        ...state.player,
        hp,
        maxHp: hp
      }
    };
  }

  it('uses the default three-item preparation and migrates legacy hubs on entry', () => {
    const initial = createInitialState();
    expect(initial.preparedItemIds).toEqual(game.DEFAULT_PREPARED_TACTICAL_ITEM_IDS);
    expect(game.getTacticalLoadoutStatus(initial)).toMatchObject({
      preparedItemIds: ['healing_pill', 'dispel_talisman', 'gate_sigil'],
      isValid: true,
      generalSlotsUsed: 3,
      usesDefaultPreparation: false,
      legacyRunUnrestricted: false
    });

    const { preparedItemIds: _removed, ...legacyFields } = initial;
    const legacyHub = legacyFields as GameState;
    expect(game.getTacticalLoadoutStatus(legacyHub).usesDefaultPreparation).toBe(true);

    const entered = enterDungeon(legacyHub, 'demon_tower_1');
    expect(entered.preparedItemIds).toEqual(game.DEFAULT_PREPARED_TACTICAL_ITEM_IDS);
    expect(entered.run?.tacticalLoadout).toEqual({
      rulesVersion: 1,
      itemIds: game.DEFAULT_PREPARED_TACTICAL_ITEM_IDS
    });
  });

  it('validates capacity without mutating input and lets equipped field rigs add specialized slots', () => {
    const initial = createInitialState();
    const fourItems: TacticalItemId[] = [
      'healing_pill',
      'dispel_talisman',
      'gate_sigil',
      'echo_coin'
    ];
    const inputSnapshot = [...fourItems];
    const rejected = game.configureTacticalLoadout(initial, fourItems);

    expect(fourItems).toEqual(inputSnapshot);
    expect(rejected.preparedItemIds).toBe(initial.preparedItemIds);
    expect(rejected.log[0]).toMatch(/配置失败|溢出/);

    const rigged: GameState = {
      ...initial,
      equipped: {
        ...initial.equipped,
        waist: 'rift_belt'
      }
    };
    const configured = game.configureTacticalLoadout(rigged, fourItems);
    const status = game.getTacticalLoadoutStatus(configured);

    expect(configured.preparedItemIds).toEqual(fourItems);
    expect(configured.preparedItemIds).not.toBe(fourItems);
    expect(status).toMatchObject({ isValid: true, generalSlotsUsed: 3 });
    expect(status.activeFieldRigs.map(({ id }) => id)).toEqual(['rift_belt_portal_rig']);
    expect(status.specializedSlotAssignments).toHaveLength(1);
  });

  it('rejects invalid entry preparation and refuses reconfiguration outside the hub', () => {
    const invalidHub: GameState = {
      ...createInitialState(),
      preparedItemIds: ['healing_pill', 'dispel_talisman', 'gate_sigil', 'echo_coin']
    };
    const blocked = enterDungeon(invalidHub, 'demon_tower_1');

    expect(blocked.phase).toBe('hub');
    expect(blocked.run).toBeUndefined();
    expect(blocked.log[0]).toMatch(/战术携行配置无效|溢出/);

    const entered = enterDungeon(createInitialState(), 'demon_tower_1');
    const snapshot = entered.run?.tacticalLoadout;
    const reconfigured = game.configureTacticalLoadout(entered, ['echo_coin']);
    expect(reconfigured.preparedItemIds).toEqual(entered.preparedItemIds);
    expect(reconfigured.run?.tacticalLoadout).toBe(snapshot);
    expect(reconfigured.log[0]).toContain('只能在主神空间');
  });

  it('copies entry preparation once, ignores mid-run equipment changes, and inherits the snapshot through portals', () => {
    const riggedHub: GameState = {
      ...unlockedHub(),
      equipped: {
        ...unlockedHub().equipped,
        waist: 'rift_belt'
      }
    };
    const configured = game.configureTacticalLoadout(riggedHub, [
      'healing_pill',
      'dispel_talisman',
      'gate_sigil',
      'echo_coin'
    ]);
    const entered = enterDungeon(configured, 'demon_tower_1');
    const snapshot = entered.run?.tacticalLoadout;

    expect(snapshot?.itemIds).toEqual(configured.preparedItemIds);
    expect(snapshot?.itemIds).not.toBe(configured.preparedItemIds);

    const changedEquipment = equipEquipment(entered, 'patched_belt');
    expect(changedEquipment.run?.tacticalLoadout).toBe(snapshot);
    expect(game.getTacticalLoadoutStatus(changedEquipment).isValid).toBe(false);

    const transported = usePortal(atNode(changedEquipment, 'cracked_portal'), 'force');
    expect(transported.run?.dungeonId).toBe('metro_abyss');
    expect(transported.run?.tacticalLoadout).toBe(snapshot);
  });

  it('keeps legacy runs without a snapshot unrestricted for known tactical items', () => {
    const entered = enterDungeon(
      withItem(prepareTacticalItems(createInitialState(), 'healing_pill'), 'thunder_talisman'),
      'demon_tower_1'
    );
    if (!entered.run) throw new Error('Missing run');
    const { tacticalLoadout: _removed, ...legacyRun } = entered.run;
    const legacy = selectNode({ ...entered, run: legacyRun }, 'fog_lesser_demon');
    const used = performCombatAction(legacy, 'use_thunder_talisman');

    expect(game.getTacticalLoadoutStatus(legacy).legacyRunUnrestricted).toBe(true);
    expect(used.inventory.thunder_talisman).toBe(0);
    expect(used.run?.usedItems).toContain('thunder_talisman');
  });

  it.each([
    ['healing_pill', 'use_healing_pill'],
    ['thunder_talisman', 'use_thunder_talisman']
  ] as const)('blocks uncarried combat item %s without consuming a turn', (itemId, action) => {
    const entered = enterDungeon(
      withItem(prepareTacticalItems(createInitialState(), 'gate_sigil'), itemId),
      'demon_tower_1'
    );
    const combat = selectNode(entered, 'fog_lesser_demon');
    const blocked = performCombatAction(combat, action);

    expect(blocked.inventory[itemId]).toBe(1);
    expect(blocked.combat?.turn).toBe(combat.combat?.turn);
    expect(blocked.combat?.monsterHp).toBe(combat.combat?.monsterHp);
    expect(blocked.log[0]).toContain('未装入战术携行');
  });

  it('keeps archive sealing ahead of the uncarried reason', () => {
    const entered = enterDungeon(
      withItem(prepareTacticalItems(unlockedHub(), 'gate_sigil'), 'healing_pill'),
      'dream_archive'
    );
    const combat = selectNode(atNode(entered, 'paper_librarian'), 'paper_librarian');
    if (!combat.run) throw new Error('Missing archive run');
    const sealed: GameState = {
      ...combat,
      run: {
        ...combat.run,
        lawState: {
          ...createDungeonLawState('dream_archive'),
          law: { kind: 'dream_archive', sealedFeatures: ['consumable'] }
        }
      }
    };
    const blocked = performCombatAction(sealed, 'use_healing_pill');

    expect(blocked.combat?.turn).toBe(sealed.combat?.turn);
    expect(blocked.inventory.healing_pill).toBe(1);
    expect(blocked.log[0]).toContain('梦档案馆已封存消耗品');
    expect(blocked.log[0]).not.toContain('未装入战术携行');
  });

  it('blocks uncarried capture nets and spirit bait without advancing capture', () => {
    const netEntered = enterDungeon(
      withItem(prepareTacticalItems(createInitialState(), 'gate_sigil'), 'capture_net'),
      'demon_tower_1'
    );
    const netCombat = selectNode(netEntered, 'fog_lesser_demon');
    const weakenedNetCombat: GameState = {
      ...netCombat,
      combat: netCombat.combat ? { ...netCombat.combat, monsterHp: 1 } : netCombat.combat
    };
    const netBlocked = capturePet(weakenedNetCombat, 'mist_kitten');

    const baitEntered = enterDungeon(
      withItem(prepareTacticalItems(unlockedHub(), 'gate_sigil'), 'spirit_bait'),
      'starfall_mine'
    );
    const baitCombat: GameState = {
      ...baitEntered,
      phase: 'combat',
      combat: {
        nodeId: 'mine_arrival',
        monsterId: 'spark_imp',
        monsterHp: 1,
        turn: 1,
        guarding: false,
        effects: {},
        log: ['跳火小鬼出现。']
      }
    };
    const baitBlocked = capturePet(baitCombat, 'ash_hound');

    expect(netBlocked.phase).toBe('combat');
    expect(netBlocked.inventory.capture_net).toBe(1);
    expect(netBlocked.run?.clearedNodeIds).not.toContain('fog_lesser_demon');
    expect(netBlocked.log[0]).toContain('未装入战术携行');
    expect(baitBlocked.phase).toBe('combat');
    expect(baitBlocked.inventory.spirit_bait).toBe(1);
    expect(baitBlocked.ownedPets).not.toContain('ash_hound');
    expect(baitBlocked.log[0]).toContain('未装入战术携行');
  });

  it('does not apply an uncarried armor patch during guard', () => {
    const entered = enterDungeon(
      withItem(prepareTacticalItems(createInitialState(), 'gate_sigil'), 'armor_patch'),
      'demon_tower_1'
    );
    const combat = selectNode(entered, 'fog_lesser_demon');
    const guarded = performCombatAction(combat, 'guard');

    expect(guarded.inventory.armor_patch).toBe(1);
    expect(guarded.run?.usedItems).not.toContain('armor_patch');
    expect(guarded.combat?.log.join(' ')).toContain('未装入战术携行');
  });

  it('hides uncarried tactical event inventory and leaves the event unresolved', () => {
    const entered = enterDungeon(
      withItem(prepareTacticalItems(unlockedHub(), 'healing_pill'), 'gate_sigil'),
      'metro_abyss'
    );
    const eventState = atNode(entered, 'rail_portal');
    const option = game
      .getAvailableDungeonEvents(eventState)
      .find(({ id }) => id === 'last_train_reflection')
      ?.options.find(({ id }) => id === 'anchor_last_train');
    const blocked = game.resolveDungeonEvent(eventState, 'last_train_reflection', 'anchor_last_train');

    expect(option?.available).toBe(false);
    expect(blocked.inventory.gate_sigil).toBe(1);
    expect(blocked.run?.resolvedEventIds).not.toContain('last_train_reflection');
    expect(blocked.log[0]).toContain('未装入战术携行');
  });

  it('resolves explicit counter and risk choices differently on the same trap', () => {
    const carriedTrap = atNode(
      enterDungeon(
        withItem(prepareTacticalItems(createInitialState(), 'dispel_talisman'), 'dispel_talisman'),
        'demon_tower_1'
      ),
      'blood_rune_trap'
    );
    const countered = handleTrap(carriedTrap, 'counter');

    const uncarriedTrap = atNode(
      enterDungeon(
        withItem(prepareTacticalItems(createInitialState(), 'healing_pill'), 'dispel_talisman'),
        'demon_tower_1'
      ),
      'blood_rune_trap'
    );
    const blockedCounter = handleTrap(uncarriedTrap, 'counter');
    const risked = handleTrap(uncarriedTrap, 'risk');

    expect(countered.player.hp).toBe(carriedTrap.player.hp);
    expect(countered.inventory.dispel_talisman).toBe(0);
    expect(countered.run?.clearedNodeIds).toContain('blood_rune_trap');
    expect(blockedCounter.player.hp).toBe(uncarriedTrap.player.hp);
    expect(blockedCounter.inventory.dispel_talisman).toBe(1);
    expect(blockedCounter.run?.clearedNodeIds).not.toContain('blood_rune_trap');
    expect(blockedCounter.log[0]).toContain('未装入战术携行');
    expect(risked.player.hp).toBeLessThan(uncarriedTrap.player.hp);
    expect(risked.inventory.dispel_talisman).toBe(1);
    expect(risked.run?.clearedNodeIds).toContain('blood_rune_trap');
  });

  it('makes stabilize consume its item, force retain it, and auto choose a real branch', () => {
    const portalHub = withItem(prepareTacticalItems(unlockedHub(), 'gate_sigil'), 'gate_sigil');
    const stableStart = atNode(enterDungeon(portalHub, 'demon_tower_1'), 'cracked_portal');
    const stabilized = usePortal(stableStart, 'stabilize');
    const forced = usePortal(atNode(enterDungeon(portalHub, 'demon_tower_1'), 'cracked_portal'), 'force');
    const autoStabilized = usePortal(atNode(enterDungeon(portalHub, 'demon_tower_1'), 'cracked_portal'));

    const uncarriedHub = withItem(prepareTacticalItems(unlockedHub(), 'healing_pill'), 'gate_sigil');
    const uncarriedStart = atNode(enterDungeon(uncarriedHub, 'demon_tower_1'), 'cracked_portal');
    const blockedStabilize = usePortal(uncarriedStart, 'stabilize');
    const autoForced = usePortal(uncarriedStart);

    expect(stabilized.player.hp).toBe(stableStart.player.hp);
    expect(stabilized.inventory.gate_sigil).toBe(0);
    expect(stabilized.run?.usedItems).toContain('gate_sigil');
    expect(forced.player.hp).toBeLessThan(stableStart.player.hp);
    expect(forced.inventory.gate_sigil).toBe(1);
    expect(autoStabilized.player.hp).toBe(stableStart.player.hp);
    expect(autoStabilized.inventory.gate_sigil).toBe(0);
    expect(blockedStabilize.run?.dungeonId).toBe('demon_tower_1');
    expect(blockedStabilize.run?.currentNodeId).toBe('cracked_portal');
    expect(blockedStabilize.inventory.gate_sigil).toBe(1);
    expect(blockedStabilize.log[0]).toContain('未装入战术携行');
    expect(autoForced.run?.dungeonId).toBe('metro_abyss');
    expect(autoForced.player.hp).toBeLessThan(uncarriedStart.player.hp);
    expect(autoForced.inventory.gate_sigil).toBe(1);
    expect(autoForced.log[0]).toMatch(/未装入战术携行.*强闯/);
  });

  it('scales force backlash by tier, lets portal-anchor reduce it, and keeps high-tier risk', () => {
    const lowStart = withPortalHealth(
      atNode(enterDungeon(prepareTacticalItems(unlockedHub()), 'demon_tower_1'), 'cracked_portal')
    );
    const highStart = withPortalHealth(
      atNode(enterDungeon(prepareTacticalItems(unlockedHub()), 'void_citadel'), 'echo_portal')
    );
    const anchorHub: GameState = {
      ...prepareTacticalItems(unlockedHub()),
      ownedPets: ['mirror_moth'],
      petLevels: { mirror_moth: 1 },
      activePet: 'mirror_moth'
    };
    const anchoredStart = withPortalHealth(atNode(enterDungeon(anchorHub, 'void_citadel'), 'echo_portal'));

    const low = usePortal(lowStart, 'force');
    const high = usePortal(highStart, 'force');
    const anchored = usePortal(anchoredStart, 'force');
    const lowDamage = (low.run?.damageTaken ?? 0) - (lowStart.run?.damageTaken ?? 0);
    const highDamage = (high.run?.damageTaken ?? 0) - (highStart.run?.damageTaken ?? 0);
    const anchoredDamage = (anchored.run?.damageTaken ?? 0) - (anchoredStart.run?.damageTaken ?? 0);

    expect(highDamage).toBeGreaterThan(lowDamage);
    expect(anchoredDamage).toBeLessThan(highDamage);
    expect(anchoredDamage).toBeGreaterThan(0);
    expect(anchored.log[0]).toContain('锚门灵宠');
  });

  it('uses real failure settlement when force backlash is lethal and does not transfer or spend echo coin', () => {
    const hub = withItem(prepareTacticalItems(unlockedHub(), 'echo_coin'), 'echo_coin');
    const portal = atNode(enterDungeon(hub, 'void_citadel'), 'echo_portal');
    const doomed: GameState = {
      ...portal,
      player: { ...portal.player, hp: 1 }
    };
    const failed = usePortal(doomed, 'force');

    expect(failed.phase).toBe('result');
    expect(failed.player.hp).toBe(0);
    expect(failed.run?.dungeonId).toBe('void_citadel');
    expect(failed.run?.currentNodeId).toBe('echo_portal');
    expect(failed.inventory.echo_coin).toBe(1);
    expect(failed.run?.usedItems).not.toContain('echo_coin');
    expect(failed.lastOutcome).toContain('failed_recovered');
  });

  it('spends a carried echo coin into the loot bag and ignores an uncarried one', () => {
    const carriedHub = withItem(prepareTacticalItems(unlockedHub(), 'echo_coin'), 'echo_coin');
    const carriedStart = withPortalHealth(
      atNode(enterDungeon(carriedHub, 'demon_tower_1'), 'cracked_portal')
    );
    const carried = usePortal(carriedStart, 'force');

    const uncarriedHub = withItem(prepareTacticalItems(unlockedHub()), 'echo_coin');
    const uncarriedStart = withPortalHealth(
      atNode(enterDungeon(uncarriedHub, 'demon_tower_1'), 'cracked_portal')
    );
    const uncarried = usePortal(uncarriedStart, 'force');

    expect(carried.inventory.echo_coin).toBe(0);
    expect(carried.run?.usedItems).toContain('echo_coin');
    expect(carried.run?.lootBag.rewardPoints).toBe((carriedStart.run?.lootBag.rewardPoints ?? 0) + 20);
    expect(carried.rewardPoints).toBe(carriedStart.rewardPoints + 20);
    expect(uncarried.inventory.echo_coin).toBe(1);
    expect(uncarried.run?.usedItems).not.toContain('echo_coin');
    expect(uncarried.run?.lootBag.rewardPoints).toBe(uncarriedStart.run?.lootBag.rewardPoints ?? 0);
    expect(uncarried.log[0]).toContain('未装入战术携行');
  });
});

describe('dungeon law, intent, and resonance integration', () => {
  function unlockedState(): GameState {
    const state = createInitialState();
    return {
      ...state,
      completedDungeonIds: [...DUNGEON_ORDER],
      claimedTaskIds: DUNGEON_ORDER.map((dungeonId) => `mainline_clear_${dungeonId}`)
    };
  }

  function atNode(state: GameState, nodeId: string): GameState {
    if (!state.run) return state;
    return {
      ...state,
      phase: 'explore',
      combat: undefined,
      run: {
        ...state.run,
        currentNodeId: nodeId
      }
    };
  }

  function durable(state: GameState): GameState {
    return {
      ...state,
      player: {
        ...state.player,
        hp: 1_000,
        maxHp: 1_000
      }
    };
  }

  function withCombatHp(state: GameState, monsterHp: number): GameState {
    return {
      ...state,
      combat: state.combat ? { ...state.combat, monsterHp } : state.combat
    };
  }

  function clearMonster(state: GameState, nodeId: string, action: game.CombatAction = 'attack'): GameState {
    const started = selectNode(atNode(durable(state), nodeId), nodeId);
    if (!started.combat) throw new Error(`Missing combat at ${nodeId}`);
    let result = withCombatHp(started, 1);
    for (let attempt = 0; attempt < 3 && result.phase === 'combat'; attempt += 1) {
      result = performCombatAction(result, action);
    }
    return result;
  }

  it('initializes laws on entry and portal transfer and lazily restores old runs without the field', () => {
    const unlocked = unlockedState();

    for (const dungeonId of DUNGEON_ORDER) {
      const entered = enterDungeon(unlocked, dungeonId);
      expect(entered.run?.lawState?.dungeonId).toBe(dungeonId);
      expect(game.getCurrentDungeonLaw(entered)).toMatchObject({
        state: { dungeonId, clearedNodeIds: [], resolvedEventIds: [] },
        display: { dungeonId }
      });
    }

    const entered = enterDungeon(unlocked, 'demon_tower_1');
    if (!entered.run) throw new Error('Missing run');
    const { lawState: _removed, ...legacyRun } = entered.run;
    const legacy: GameState = { ...entered, run: legacyRun };
    expect(game.getCurrentDungeonLaw(legacy)?.state).toEqual(createDungeonLawState('demon_tower_1'));

    const portalNode = DUNGEONS.demon_tower_1.nodes.find((node) => node.portal);
    if (!portalNode?.portal) throw new Error('Missing portal');
    const transported = usePortal(atNode(entered, portalNode.id));
    expect(game.getCurrentDungeonLaw(transported)?.state).toEqual(
      createDungeonLawState(portalNode.portal.targetDungeonId)
    );
  });

  it('applies demon, metro, and mine law transitions to real encounter and trap numbers in law-before-protocol order', () => {
    let demon = durable(enterDungeon(unlockedState(), 'demon_tower_1', 'imprint'));
    const demonTraps = DUNGEONS.demon_tower_1.nodes.filter((node) => node.trap).slice(0, 2);
    for (const trap of demonTraps) demon = handleTrap(atNode(demon, trap.id));
    expect(game.getCurrentDungeonLaw(demon)?.state.law).toMatchObject({ fogPressure: 2 });

    const demonCombat = selectNode(atNode(demon, 'fog_lesser_demon'), 'fog_lesser_demon');
    const demonProfile = game.getCombatEncounterProfile(demonCombat)?.monster;
    expect(demonProfile?.attack).toBe(12);
    expect(demonProfile?.attack).not.toBe(
      Math.ceil((Math.ceil(game.MONSTERS.fog_lesser_demon.attack * 1.12) * 1.1))
    );

    let metro = enterDungeon(unlockedState(), 'metro_abyss');
    metro = collectReward(atNode(metro, 'platform_arrival'));
    metro = collectReward(atNode(metro, 'lampbox_reward'));
    expect(game.getCurrentDungeonLaw(metro)?.state.law).toMatchObject({ tide: 'mirror' });

    const mirrorSpider = selectNode(atNode(metro, 'mirror_thread_spider'), 'mirror_thread_spider');
    const ebbMirrorSpider = selectNode(
      atNode(enterDungeon(unlockedState(), 'metro_abyss'), 'mirror_thread_spider'),
      'mirror_thread_spider'
    );
    const boatmanReflection = selectNode(atNode(metro, 'tide_boatman_reflection'), 'tide_boatman_reflection');
    expect(game.getCombatEncounterProfile(mirrorSpider)?.monster.maxHp).toBe(
      Math.ceil((game.getCombatEncounterProfile(ebbMirrorSpider)?.monster.maxHp ?? 0) * 1.2)
    );
    expect(game.getCombatEncounterProfile(boatmanReflection)?.monster.maxHp).toBe(
      game.MONSTERS.tide_boatman.maxHp
    );

    let mine = durable(enterDungeon(unlockedState(), 'starfall_mine'));
    const damageBefore = mine.run?.damageTaken ?? 0;
    mine = handleTrap(atNode(mine, 'tilted_gravity_switch'));
    expect((mine.run?.damageTaken ?? 0) - damageBefore).toBe(23);
    expect(game.getCurrentDungeonLaw(mine)?.state.law).toMatchObject({ gravity: 'downward' });

    const mineCombat = selectNode(atNode(mine, 'mine_shell_guard'), 'mine_shell_guard');
    expect(game.getCombatEncounterProfile(mineCombat)?.monster.defense).toBe(
      Math.ceil(game.MONSTERS.mine_shell_guard.defense * 0.8)
    );
  });

  it('makes hospital healing pressure and arena opening verdicts affect live combat', () => {
    let hospital = durable(enterDungeon(unlockedState(), 'rust_hospital'));
    const hospitalTraps = DUNGEONS.rust_hospital.nodes.filter((node) => node.trap).slice(0, 3);
    for (const trap of hospitalTraps) hospital = handleTrap(atNode(hospital, trap.id));
    expect(game.getCurrentDungeonLaw(hospital)?.state.law).toMatchObject({ pollution: 3 });

    const doctorNode = DUNGEONS.rust_hospital.nodes.find((node) => node.monsterId === 'pulse_doctor');
    if (!doctorNode) throw new Error('Missing pulse doctor');
    const doctorCombat = selectNode(
      atNode(
        {
          ...hospital,
          inventory: { ...hospital.inventory, healing_pill: 1 }
        },
        doctorNode.id
      ),
      doctorNode.id
    );
    expect(game.getCombatEncounterProfile(doctorCombat)?.monster.artPower).toBe(
      Math.ceil(game.MONSTERS.pulse_doctor.artPower * 1.1)
    );
    const healed = performCombatAction(
      {
        ...doctorCombat,
        player: { ...doctorCombat.player, hp: 10 }
      },
      'use_healing_pill'
    );
    expect(healed.combat?.log.join('')).toContain('生命回复 33 点');

    let arena = enterDungeon(unlockedState(), 'ash_arena');
    const bossNodeId = getBossDefinition('ash_arena').nodeId;
    const arenaMonsters = DUNGEONS.ash_arena.nodes
      .filter((node) => node.monsterId && node.id !== bossNodeId)
      .slice(0, 3);
    arena = clearMonster(arena, arenaMonsters[0].id);
    arena = clearMonster(arena, arenaMonsters[1].id);
    const arenaLaw = game.getCurrentDungeonLaw(arena)?.state;
    if (!arenaLaw) throw new Error('Missing arena law');
    expect(getCombatOpeningDistribution(arenaLaw)).toEqual({ force: 2, art: 0, guard: 0 });

    const penalizedStart = withCombatHp(
      selectNode(atNode(durable(arena), arenaMonsters[2].id), arenaMonsters[2].id),
      1_000
    );
    const baselineStart: GameState = {
      ...penalizedStart,
      run: penalizedStart.run
        ? { ...penalizedStart.run, lawState: createDungeonLawState('ash_arena') }
        : penalizedStart.run
    };
    const penalized = performCombatAction(penalizedStart, 'attack');
    const baseline = performCombatAction(baselineStart, 'attack');
    expect(1_000 - (penalized.combat?.monsterHp ?? 0)).toBeLessThan(
      1_000 - (baseline.combat?.monsterHp ?? 0)
    );
  });

  it('records node, event, and combat signals once without treating old run damage or utility actions as openings', () => {
    const entered = enterDungeon(unlockedState(), 'demon_tower_1');
    if (!entered.run) throw new Error('Missing demon run');
    const historical: GameState = {
      ...entered,
      run: { ...entered.run, damageTaken: 40 }
    };
    const started = selectNode(atNode(historical, 'fog_lesser_demon'), 'fog_lesser_demon');
    const cleared = performCombatAction(withCombatHp(started, 1), 'attack');
    expect(game.getCurrentDungeonLaw(cleared)?.state.law).toMatchObject({ fogPressure: 0 });
    expect(game.getCurrentDungeonLaw(cleared)?.state.clearedNodeIds).toEqual(['fog_lesser_demon']);
    const repeated = selectNode(cleared, 'fog_lesser_demon');
    expect(game.getCurrentDungeonLaw(repeated)?.state.clearedNodeIds).toEqual(['fog_lesser_demon']);

    const failedEvent = game.resolveDungeonEvent(
      atNode(enterDungeon(unlockedState(), 'demon_tower_1'), 'blood_rune_trap'),
      'blood_rune_stair',
      'breathe_through_runes'
    );
    expect(game.getCurrentDungeonLaw(failedEvent)?.state).toMatchObject({
      resolvedEventIds: ['blood_rune_stair'],
      law: { fogPressure: 1 }
    });
    const repeatedEvent = game.resolveDungeonEvent(failedEvent, 'blood_rune_stair', 'breathe_through_runes');
    expect(game.getCurrentDungeonLaw(repeatedEvent)?.state.resolvedEventIds).toEqual(['blood_rune_stair']);

    const successfulEvent = game.resolveDungeonEvent(
      atNode(
        enterDungeon({ ...unlockedState(), learnedMethods: ['mist_breathing'] }, 'demon_tower_1'),
        'blood_rune_trap'
      ),
      'blood_rune_stair',
      'breathe_through_runes'
    );
    expect(game.getCurrentDungeonLaw(successfulEvent)?.state.resolvedEventIds).toEqual(['blood_rune_stair']);

    const arenaBase = prepareTacticalItems(
      {
        ...unlockedState(),
        inventory: {
          ...unlockedState().inventory,
          healing_pill: 1,
          thunder_talisman: 1
        },
        equipmentLevels: { ...unlockedState().equipmentLevels, ember_staff: 3 },
        equipped: { ...unlockedState().equipped, weapon: 'ember_staff' as const }
      },
      'healing_pill',
      'thunder_talisman'
    );
    const arenaNode = DUNGEONS.ash_arena.nodes.find(
      (node) => node.monsterId && node.id !== getBossDefinition('ash_arena').nodeId
    );
    if (!arenaNode) throw new Error('Missing arena monster');
    const openingStart = withCombatHp(
      selectNode(atNode(durable(enterDungeon(arenaBase, 'ash_arena')), arenaNode.id), arenaNode.id),
      1_000
    );
    const escaped = performCombatAction(openingStart, 'escape');
    expect(game.getCurrentDungeonLaw(escaped)?.state.combatOpenings[arenaNode.id]).toBeUndefined();

    let delayed = performCombatAction(openingStart, 'use_healing_pill');
    delayed = performCombatAction(delayed, 'use_thunder_talisman');
    expect(game.getCurrentDungeonLaw(delayed)?.state.combatOpenings[arenaNode.id]).toBeUndefined();
    delayed = performCombatAction(
      {
        ...delayed,
        combat: delayed.combat ? { ...delayed.combat, weaponFocus: 3 } : delayed.combat
      },
      'weapon_skill'
    );
    expect(game.getCurrentDungeonLaw(delayed)?.state.combatOpenings[arenaNode.id]).toMatchObject({
      style: 'art',
      isBoss: false
    });
    const actedAgain = performCombatAction(delayed, 'attack');
    expect(game.getCurrentDungeonLaw(actedAgain)?.state.combatOpenings[arenaNode.id]?.style).toBe('art');
  });

  it('seals archive abilities in order while preserving basic actions and restores them at the index', () => {
    const stocked = {
      ...unlockedState(),
      learnedMethods: ['cloud_step'] as GameState['learnedMethods'],
      ownedPets: ['contract_sprite'] as GameState['ownedPets'],
      petLevels: { contract_sprite: 1 },
      activePet: 'contract_sprite' as const,
      inventory: Object.fromEntries(
        Object.entries(unlockedState().inventory).map(([itemId, amount]) => [itemId, amount || 2])
      ) as GameState['inventory']
    };
    let archive = enterDungeon(stocked, 'dream_archive');
    const archiveBossId = getBossDefinition('dream_archive').nodeId;
    const archiveMonsters = DUNGEONS.dream_archive.nodes.filter(
      (node) => node.monsterId && node.id !== archiveBossId
    );
    const archiveTrap = DUNGEONS.dream_archive.nodes.find((node) => node.trap?.counterItem);
    if (archiveMonsters.length < 3 || !archiveTrap?.trap?.counterItem) throw new Error('Missing archive fixtures');

    archive = clearMonster(archive, archiveMonsters[0].id);
    expect(game.isCurrentDungeonFeatureAvailable(archive, 'consumable')).toBe(false);
    const counterItem = archiveTrap.trap.counterItem;
    const counterCount = archive.inventory[counterItem];
    const damageBefore = archive.run?.damageTaken ?? 0;
    archive = handleTrap(atNode(durable(archive), archiveTrap.id));
    expect(archive.inventory[counterItem]).toBe(counterCount);
    expect(archive.run?.damageTaken).toBeGreaterThan(damageBefore);
    expect(game.isCurrentDungeonFeatureAvailable(archive, 'method')).toBe(false);

    archive = clearMonster(archive, archiveMonsters[1].id);
    expect(game.isCurrentDungeonFeatureAvailable(archive, 'pet')).toBe(false);
    expect(archive.learnedMethods).toEqual(['cloud_step']);
    expect(archive.ownedPets).toEqual(['contract_sprite']);
    expect(archive.activePet).toBe('contract_sprite');

    const sealedStart = withCombatHp(
      selectNode(atNode(durable(archive), archiveMonsters[2].id), archiveMonsters[2].id),
      1_000
    );
    const attacked = performCombatAction(sealedStart, 'attack');
    const guarded = performCombatAction(sealedStart, 'guard');
    const artBlocked = performCombatAction(sealedStart, 'art');
    const pillBlocked = performCombatAction(sealedStart, 'use_healing_pill');
    expect(attacked.combat?.turn).toBe((sealedStart.combat?.turn ?? 0) + 1);
    expect(guarded.combat?.turn).toBe((sealedStart.combat?.turn ?? 0) + 1);
    expect(attacked.combat?.log.join('')).not.toMatch(/助战灵宠|云隙步/);
    expect(artBlocked.combat?.turn).toBe(sealedStart.combat?.turn);
    expect(pillBlocked.combat?.turn).toBe(sealedStart.combat?.turn);
    expect(pillBlocked.inventory.healing_pill).toBe(sealedStart.inventory.healing_pill);

    const restored = collectReward(atNode(archive, 'index_reward'));
    expect(game.getCurrentDungeonLaw(restored)?.state.law).toMatchObject({ sealedFeatures: [] });
    const restoredCombat: GameState = {
      ...sealedStart,
      run: sealedStart.run && restored.run
        ? { ...sealedStart.run, lawState: restored.run.lawState }
        : sealedStart.run
    };
    expect(performCombatAction(restoredCombat, 'art').combat?.turn).toBe(
      (restoredCombat.combat?.turn ?? 0) + 1
    );
  });

  it('locks the void counter at boss engagement and keeps the boss action outside non-boss distribution', () => {
    let citadel = enterDungeon(unlockedState(), 'void_citadel');
    const bossNodeId = getBossDefinition('void_citadel').nodeId;
    const patrols = DUNGEONS.void_citadel.nodes
      .filter((node) => node.monsterId && node.id !== bossNodeId)
      .slice(0, 2);
    citadel = clearMonster(citadel, patrols[0].id);
    citadel = clearMonster(citadel, patrols[1].id);
    const approachLaw = game.getCurrentDungeonLaw(citadel)?.state;
    if (!approachLaw) throw new Error('Missing citadel approach law');
    expect(approachLaw.combatOpenings).toMatchObject({
      [patrols[0].id]: { isBoss: false, style: 'force' },
      [patrols[1].id]: { isBoss: false, style: 'force' }
    });
    expect(approachLaw.combatVictoryNodeIds).toEqual([patrols[0].id, patrols[1].id]);

    const boss = withCombatHp(
      selectNode(atNode(durable(citadel), bossNodeId), bossNodeId),
      1_000
    );
    const lockedLaw = game.getCurrentDungeonLaw(boss)?.state;
    if (!lockedLaw) throw new Error('Missing citadel law');
    expect(getCombatOpeningDistribution(lockedLaw)).toEqual({ force: 2, art: 0, guard: 0 });
    expect(lockedLaw.law).toMatchObject({ bossAssessmentLocked: true, bossCounter: 'force' });
    expect(lockedLaw.combatOpenings[bossNodeId]).toMatchObject({ isBoss: true, style: null });

    const neutralBoss: GameState = {
      ...boss,
      run: boss.run
        ? { ...boss.run, lawState: createDungeonLawState('void_citadel') }
        : boss.run
    };
    const countered = performCombatAction(boss, 'attack');
    const neutral = performCombatAction(neutralBoss, 'attack');
    expect(1_000 - (countered.combat?.monsterHp ?? 0)).toBeLessThan(
      1_000 - (neutral.combat?.monsterHp ?? 0)
    );
    const afterLaw = game.getCurrentDungeonLaw(countered)?.state;
    expect(afterLaw && getCombatOpeningDistribution(afterLaw)).toEqual({ force: 2, art: 0, guard: 0 });
  });

  it('derives combat intents from live turns and effects without mutating state', () => {
    expect(game.getCurrentCombatIntent(createInitialState())).toBeUndefined();
    const bossNodeId = getBossDefinition('ash_arena').nodeId;
    const started = withCombatHp(
      selectNode(atNode(durable(enterDungeon(unlockedState(), 'ash_arena')), bossNodeId), bossNodeId),
      1_000
    );
    expect(game.getCurrentCombatIntent(started)?.id).toBe('regular-pursuit');

    const acted = performCombatAction(started, 'attack');
    const snapshot = structuredClone(acted);
    expect(game.getCurrentCombatIntent(acted)).toMatchObject({
      id: 'furnace-repeat-verdict',
      dangerousActions: expect.arrayContaining(['attack'])
    });
    expect(acted.combat?.effects?.lastPlayerAction).toBe('attack');
    expect(game.getCurrentCombatIntent(acted)).toEqual(game.getCurrentCombatIntent(acted));
    expect(acted).toEqual(snapshot);
  });

  it('activates three-piece same-branch resonance in real combat while two-piece and mixed branches stay inactive', () => {
    const base = unlockedState();
    const loadout: GameState = {
      ...base,
      equipmentLevels: {
        ...base.equipmentLevels,
        ember_staff: 3,
        rift_belt: 3,
        rift_charm: 3
      },
      equipped: {
        ...base.equipped,
        weapon: 'ember_staff',
        waist: 'rift_belt',
        charm: 'rift_charm'
      }
    };
    const start = (equipmentAttunements: NonNullable<GameState['equipmentAttunements']>) =>
      withCombatHp(
        selectNode(
          enterDungeon({ ...loadout, equipmentAttunements }, 'demon_tower_1'),
          'fog_lesser_demon'
        ),
        1_000
      );
    const ready = (state: GameState): GameState => ({
      ...state,
      combat: state.combat ? { ...state.combat, weaponFocus: 3 } : state.combat
    });
    const active = ready(
      start({
        ember_staff: 'rift_resonance',
        rift_belt: 'rift_resonance',
        rift_charm: 'rift_resonance'
      })
    );
    const twoPiece = ready(
      start({
        ember_staff: 'rift_resonance',
        rift_belt: 'rift_resonance'
      })
    );
    const mixed = ready(
      start({
        ember_staff: 'rift_resonance',
        rift_belt: 'rift_resonance',
        rift_charm: 'rift_anchor'
      })
    );

    const powerBeforeRead = getPlayerPower(active);
    expect(game.getCurrentWeaponResonanceProgress(active)).toMatchObject({
      branchId: 'rift_resonance',
      attunedCount: 3,
      active: true
    });
    expect(game.getCurrentWeaponResonanceProgress(twoPiece)).toMatchObject({ attunedCount: 2, active: false });
    expect(game.getCurrentWeaponResonanceProgress(mixed)).toMatchObject({ attunedCount: 2, active: false });
    expect(getPlayerPower(active)).toBe(powerBeforeRead);

    const activeResult = performCombatAction(active, 'weapon_skill');
    const twoPieceResult = performCombatAction(twoPiece, 'weapon_skill');
    const mixedResult = performCombatAction(mixed, 'weapon_skill');
    const activeDamage = 1_000 - (activeResult.combat?.monsterHp ?? 0);
    const twoPieceDamage = 1_000 - (twoPieceResult.combat?.monsterHp ?? 0);
    const mixedDamage = 1_000 - (mixedResult.combat?.monsterHp ?? 0);
    expect(activeDamage).toBeGreaterThan(Math.max(twoPieceDamage, mixedDamage));
    expect(activeResult.combat?.log.join('')).toContain('虚界共鸣放大');
    expect(twoPieceResult.combat?.log.join('')).not.toContain('虚界共鸣放大');
    expect(mixedResult.combat?.log.join('')).not.toContain('虚界共鸣放大');

    const repeated = performCombatAction(activeResult, 'weapon_skill');
    expect(repeated.combat?.turn).toBe(activeResult.combat?.turn);
    expect(repeated.combat?.monsterHp).toBe(activeResult.combat?.monsterHp);
  });
});

describe('run relic core integration', () => {
  function unlockedHub(): GameState {
    const state = createInitialState();
    return {
      ...state,
      completedDungeonIds: [...DUNGEON_ORDER],
      claimedTaskIds: DUNGEON_ORDER.map((dungeonId) => `mainline_clear_${dungeonId}`)
    };
  }

  function atNode(state: GameState, nodeId: string): GameState {
    if (!state.run) throw new Error('Expected an active run');
    return {
      ...state,
      phase: 'explore',
      combat: undefined,
      run: {
        ...state.run,
        currentNodeId: nodeId
      }
    };
  }

  function withAcquiredRelics(
    state: GameState,
    frame: RunRelicFrame,
    acquiredIds: readonly RunRelicId[]
  ): GameState {
    if (!state.run) throw new Error('Expected an active run');
    return {
      ...state,
      run: {
        ...state.run,
        relicState: {
          ...createRunRelicState(frame, 123),
          acquiredIds: [...acquiredIds]
        }
      }
    };
  }

  function completeDemonTower(acquiredIds: readonly RunRelicId[]): GameState {
    const entered = withAcquiredRelics(
      enterDungeon(createInitialState(), 'demon_tower_1'),
      'assault',
      acquiredIds
    );
    if (!entered.run) throw new Error('Expected an active run');
    return resolveExit({
      ...atNode(entered, 'tower_exit'),
      run: {
        ...entered.run,
        currentNodeId: 'tower_exit',
        clearedNodeIds: [getBossDefinition('demon_tower_1').nodeId]
      }
    });
  }

  it('defaults old and new saves safely and enforces hub-only frame and archived-seed configuration', () => {
    const initial = createInitialState();
    expect(initial).toMatchObject({ preparedRelicFrame: 'assault', archivedRelicIds: [] });
    expect(initial.preparedRelicSeedId).toBeUndefined();
    expect(game.getRunRelicPreparationStatus(initial)).toMatchObject({
      preparedRelicFrame: 'assault',
      archivedRelicIds: [],
      matchingConduitSourceEquipmentIds: [],
      usesDefaultPreparation: false,
      legacyRunWithoutRelics: false
    });

    const {
      preparedRelicFrame: _frame,
      archivedRelicIds: _archive,
      preparedRelicSeedId: _seed,
      ...legacyFields
    } = initial;
    const legacyHub: GameState = legacyFields;
    expect(game.getRunRelicPreparationStatus(legacyHub)).toMatchObject({
      preparedRelicFrame: 'assault',
      archivedRelicIds: [],
      usesDefaultPreparation: true
    });

    const inRun = enterDungeon(initial, 'demon_tower_1');
    const blocked = game.configureRunRelicPreparation(inRun, 'bulwark');
    expect(blocked.preparedRelicFrame).toBe('assault');
    expect(blocked.log[0]).toContain('只能在主神空间');

    const unarchived = game.configureRunRelicPreparation(initial, 'assault', 'mist_edge');
    expect(unarchived.preparedRelicSeedId).toBeUndefined();
    expect(unarchived.log[0]).toContain('雾锋');
    expect(unarchived.log[0]).not.toContain('mist_edge');

    const archived: GameState = {
      ...initial,
      archivedRelicIds: ['mist_edge', 'bone_shell'],
      preparedRelicSeedId: 'mist_edge'
    };
    const crossFrame = game.configureRunRelicPreparation(archived, 'bulwark', 'mist_edge');
    expect(crossFrame.preparedRelicFrame).toBe('assault');
    expect(crossFrame.preparedRelicSeedId).toBe('mist_edge');

    const switched = game.configureRunRelicPreparation(archived, 'bulwark');
    expect(switched.preparedRelicFrame).toBe('bulwark');
    expect(switched.preparedRelicSeedId).toBeUndefined();

    const seeded = game.configureRunRelicPreparation(archived, 'bulwark', 'bone_shell');
    expect(seeded.preparedRelicSeedId).toBe('bone_shell');
    expect(seeded.log[0]).toMatch(/守御.*骨壳/);
    expect(seeded.log[0]).not.toMatch(/bulwark|bone_shell/);
  });

  it('freezes entry conduit sources and offers two or three candidates from that snapshot', () => {
    const ordinaryEntry = enterDungeon(createInitialState(), 'demon_tower_1');
    const equippedAfterEntry: GameState = {
      ...ordinaryEntry,
      equipmentLevels: { ...ordinaryEntry.equipmentLevels, armor_piercing_sword: 2 },
      equipped: { ...ordinaryEntry.equipped, weapon: 'armor_piercing_sword' }
    };
    const ordinaryDraft = collectReward(atNode(equippedAfterEntry, 'watch_post_cache'));
    expect(ordinaryDraft.run?.relicConduitSourceEquipmentIds).toEqual([]);
    expect(ordinaryDraft.run?.relicState?.pendingDraft?.candidateIds).toHaveLength(2);

    const conduitHub: GameState = {
      ...createInitialState(),
      equipmentLevels: { ...createInitialState().equipmentLevels, armor_piercing_sword: 2 },
      equipped: { ...createInitialState().equipped, weapon: 'armor_piercing_sword' }
    };
    const conduitEntry = enterDungeon(conduitHub, 'demon_tower_1');
    expect(conduitEntry.run?.relicConduitSourceEquipmentIds).toEqual(['armor_piercing_sword']);

    const unequippedAfterEntry: GameState = {
      ...conduitEntry,
      equipmentLevels: { ...conduitEntry.equipmentLevels, armor_piercing_sword: 1 },
      equipped: { ...conduitEntry.equipped, weapon: 'training_blade' }
    };
    const conduitDraft = collectReward(atNode(unequippedAfterEntry, 'watch_post_cache'));
    expect(conduitDraft.run?.relicState?.pendingDraft?.candidateIds).toHaveLength(3);
    expect(conduitDraft.run?.relicState?.frame).toBe('assault');
  });

  it('locks departure for a pending draft, leaves illegal choices unchanged, and applies a legal choice', () => {
    const drafted = collectReward(
      atNode(enterDungeon(createInitialState(), 'demon_tower_1'), 'watch_post_cache')
    );
    expect(game.getNodeDepartureBlockReason(drafted)).toContain('回响遗物');

    const blockedMove = game.moveToNode(drafted, 'upper_fog_patrol');
    expect(blockedMove.run?.currentNodeId).toBe('watch_post_cache');
    expect(game.resolveRunRelicDraft(drafted, 'bone_shell')).toBe(drafted);

    const candidateId = drafted.run?.relicState?.pendingDraft?.candidateIds[0];
    if (!candidateId) throw new Error('Expected a relic candidate');
    const selected = game.resolveRunRelicDraft(drafted, candidateId);
    expect(selected.run?.relicState?.acquiredIds).toEqual([candidateId]);
    expect(selected.run?.relicState?.pendingDraft).toBeUndefined();
    expect(selected.log[0]).toContain('效果立即生效');
    expect(selected.log[0]).toContain(RUN_RELIC_DEFINITIONS[candidateId].name);
    expect(game.moveToNode(selected, 'upper_fog_patrol').run?.currentNodeId).toBe('upper_fog_patrol');
  });

  it('applies all three stat relics immediately after a legal draft choice', () => {
    const cases: Array<{
      frame: RunRelicFrame;
      relicId: RunRelicId;
      expected: Partial<game.DerivedStats>;
    }> = [
      { frame: 'assault', relicId: 'mist_edge', expected: { attack: 6, artPower: 4 } },
      { frame: 'bulwark', relicId: 'bone_shell', expected: { defense: 4 } },
      { frame: 'wayfinder', relicId: 'rift_step', expected: { speed: 4, trapCheck: 4 } }
    ];

    for (const { frame, relicId, expected } of cases) {
      const entered = enterDungeon(createInitialState(), 'demon_tower_1');
      if (!entered.run) throw new Error('Expected an active run');
      const pending = generateRunRelicDraft(createRunRelicState(frame, 77), {
        draftId: `draft:${frame}`,
        nodeId: `reward:${frame}`,
        matchingEquipmentConduit: true
      });
      const prepared: GameState = {
        ...entered,
        run: { ...entered.run, relicState: pending }
      };
      const before = getDerivedStats(prepared);
      const selected = game.resolveRunRelicDraft(prepared, relicId);
      const after = getDerivedStats(selected);

      for (const [stat, amount] of Object.entries(expected) as Array<[keyof game.DerivedStats, number]>) {
        expect(after[stat] - before[stat]).toBe(amount);
      }
    }
  });

  it('keeps permanent power, readiness, gates, and run economy independent of temporary stats', () => {
    const baseline = enterDungeon(createInitialState(), 'demon_tower_1');
    const boosted = withAcquiredRelics(baseline, 'assault', ['mist_edge']);

    expect(getDerivedStats(boosted).attack).toBe(getDerivedStats(baseline).attack + 6);
    expect(getPlayerPower(boosted)).toBe(getPlayerPower(baseline));
    expect(getDungeonReadiness(boosted, 'demon_tower_1')).toEqual(
      getDungeonReadiness(baseline, 'demon_tower_1')
    );
    expect(getCampaignGates(boosted)).toEqual(getCampaignGates(baseline));
    expect(resolveRetreat(boosted).lastOutcome).toBe(resolveRetreat(baseline).lastOutcome);
  });

  it('applies focus prism and hunter clock to combat starts, kills, and captures', () => {
    const focused = selectNode(
      withAcquiredRelics(enterDungeon(createInitialState(), 'demon_tower_1'), 'assault', ['focus_prism']),
      'fog_lesser_demon'
    );
    expect(focused.combat?.weaponFocus).toBe(1);
    expect(focused.combat?.log.join('')).toContain('战意 +1');

    const hunterStart = selectNode(
      withAcquiredRelics(enterDungeon(createInitialState(), 'demon_tower_1'), 'assault', ['hunter_clock']),
      'fog_lesser_demon'
    );
    const hunterKill = performCombatAction(
      {
        ...hunterStart,
        combat: hunterStart.combat ? { ...hunterStart.combat, monsterHp: 1 } : hunterStart.combat
      },
      'attack'
    );
    expect(hunterKill.run?.lootBag.rewardPoints).toBe(192);
    expect(hunterKill.log[0]).toContain('192 点奖励');

    const captureHub = game.configureTacticalLoadout(
      {
        ...createInitialState(),
        inventory: { ...createInitialState().inventory, capture_net: 1 }
      },
      ['capture_net']
    );
    const captureStart = selectNode(
      withAcquiredRelics(enterDungeon(captureHub, 'demon_tower_1'), 'assault', ['hunter_clock']),
      'fog_lesser_demon'
    );
    const captured = capturePet(
      {
        ...captureStart,
        combat: captureStart.combat ? { ...captureStart.combat, monsterHp: 1 } : captureStart.combat
      },
      'mist_kitten'
    );
    expect(captured.run?.lootBag.rewardPoints).toBe(68);
    expect(captured.log[0]).toContain('68 点奖励');
  });

  it('applies lucky map, mending thread, and iron echo in reward and trap rule order', () => {
    const luckyStart = withAcquiredRelics(
      enterDungeon(createInitialState(), 'demon_tower_1'),
      'wayfinder',
      ['lucky_map']
    );
    const lucky = collectReward(atNode(luckyStart, 'watch_post_cache'));
    expect(lucky.rewardPoints - luckyStart.rewardPoints).toBe(84);
    expect(lucky.run?.lootBag.rewardPoints).toBe(84);
    expect(lucky.log[0]).toContain('70 提升至 84');

    const hospitalEntry = withAcquiredRelics(
      enterDungeon(unlockedHub(), 'rust_hospital'),
      'bulwark',
      ['mending_thread']
    );
    if (!hospitalEntry.run) throw new Error('Expected a hospital run');
    const hospitalStart: GameState = {
      ...atNode(hospitalEntry, 'triage_reward'),
      player: { ...hospitalEntry.player, hp: hospitalEntry.player.maxHp - 30 },
      run: {
        ...hospitalEntry.run,
        currentNodeId: 'triage_reward',
        lawState: {
          ...createDungeonLawState('rust_hospital'),
          law: { kind: 'rust_hospital', pollution: 3 }
        }
      }
    };
    const mended = collectReward(hospitalStart);
    expect(mended.player.hp - hospitalStart.player.hp).toBe(11);
    expect(mended.log[0]).toContain('回复 11 点生命');

    const trapEntry = enterDungeon(
      { ...createInitialState(), learnedMethods: ['iron_body'] },
      'demon_tower_1'
    );
    const baselineTrap = handleTrap(atNode(trapEntry, 'blood_rune_trap'), 'risk');
    const ironTrap = handleTrap(
      atNode(withAcquiredRelics(trapEntry, 'bulwark', ['iron_echo']), 'blood_rune_trap'),
      'risk'
    );
    expect(baselineTrap.run?.damageTaken).toBe(19);
    expect(ironTrap.run?.damageTaken).toBe(14);
    expect(ironTrap.log[0]).toContain('19 点降至 14 点');
  });

  it('reduces final forced-portal backlash and preserves relic snapshots across transfer', () => {
    const base = unlockedHub();
    const conduitHub = game.configureRunRelicPreparation(
      {
        ...base,
        equipmentLevels: { ...base.equipmentLevels, cloudstep_boots: 2 },
        equipped: { ...base.equipped, feet: 'cloudstep_boots' }
      },
      'wayfinder'
    );
    const entered = enterDungeon(conduitHub, 'demon_tower_1');
    const baselineStart = atNode(entered, 'cracked_portal');
    const gateStartWithRelic = withAcquiredRelics(baselineStart, 'wayfinder', ['gate_anchor']);
    if (!gateStartWithRelic.run) throw new Error('Expected a portal run');
    const gateStart: GameState = {
      ...gateStartWithRelic,
      run: {
        ...gateStartWithRelic.run,
        lastRelicSettlement: {
          status: 'skipped',
          frame: 'wayfinder',
          acquiredIds: ['gate_anchor']
        }
      }
    };

    const baseline = usePortal(baselineStart, 'force');
    const transported = usePortal(gateStart, 'force');
    expect((baseline.run?.damageTaken ?? 0) - (baselineStart.run?.damageTaken ?? 0)).toBe(16);
    expect((transported.run?.damageTaken ?? 0) - (gateStart.run?.damageTaken ?? 0)).toBe(10);
    expect(transported.log[0]).toContain('16 点降至 10 点');
    expect(transported.run?.dungeonId).toBe('metro_abyss');
    expect(transported.run?.relicState).toEqual(gateStart.run?.relicState);
    expect(transported.run?.relicConduitSourceEquipmentIds).toEqual(['cloudstep_boots']);
    expect(transported.run?.lastRelicSettlement).toEqual(gateStart.run?.lastRelicSettlement);
  });

  it('blocks hub return until archive or skip and guarantees an archived seed next run', () => {
    const completed = completeDemonTower(['mist_edge']);
    expect(completed.phase).toBe('result');
    expect(completed.run?.lastRelicSettlement?.status).toBe('pending');

    const blocked = returnToHub(completed);
    expect(blocked.phase).toBe('result');
    expect(blocked.run).toBe(completed.run);
    expect(game.resolveRunRelicArchive(completed, 'bone_shell')).toBe(completed);

    const archived = game.resolveRunRelicArchive(completed, 'mist_edge');
    expect(archived.run?.lastRelicSettlement).toMatchObject({
      status: 'archived',
      archivedRelicId: 'mist_edge'
    });
    expect(archived.archivedRelicIds).toEqual(['mist_edge']);
    expect(archived.preparedRelicSeedId).toBe('mist_edge');
    expect(archived.log[0]).toContain('雾锋');
    expect(archived.log[0]).not.toContain('mist_edge');

    const rerun = enterDungeon(returnToHub(archived), 'demon_tower_1');
    const seededDraft = collectReward(atNode(rerun, 'watch_post_cache'));
    expect(seededDraft.run?.relicState?.pendingDraft?.candidateIds[0]).toBe('mist_edge');

    const skipped = game.resolveRunRelicArchive(completeDemonTower(['focus_prism']), undefined);
    expect(skipped.run?.lastRelicSettlement?.status).toBe('skipped');
    expect(returnToHub(skipped).phase).toBe('hub');

    const emptyClear = completeDemonTower([]);
    expect(emptyClear.run?.lastRelicSettlement?.status).toBe('skipped');
    expect(returnToHub(emptyClear).phase).toBe('hub');
  });

  it('marks retreat and failure relics lost without archiving them', () => {
    const active = withAcquiredRelics(
      enterDungeon(createInitialState(), 'demon_tower_1'),
      'assault',
      ['hunter_clock']
    );
    const retreated = resolveRetreat(active);
    const failed = game.resolveRunFailure(active, '测试失败，主神强制回收。');

    for (const settled of [retreated, failed]) {
      expect(settled.run?.lastRelicSettlement).toMatchObject({
        status: 'lost',
        acquiredIds: ['hunter_clock']
      });
      expect(settled.archivedRelicIds).toEqual([]);
      expect(settled.preparedRelicSeedId).toBeUndefined();
      expect(returnToHub(settled).phase).toBe('hub');
    }
  });

  it('keeps legacy active runs without relicState relic-free for the entire run', () => {
    const entered = enterDungeon(createInitialState(), 'demon_tower_1');
    if (!entered.run) throw new Error('Expected an active run');
    const {
      relicState: _relicState,
      relicConduitSourceEquipmentIds: _conduitSources,
      ...legacyRun
    } = entered.run;
    const legacy: GameState = { ...entered, run: legacyRun };

    const reward = collectReward(atNode(legacy, 'watch_post_cache'));
    expect(reward.run?.relicState).toBeUndefined();
    expect(reward.log[0]).not.toContain('回响遗物候选');
    expect(game.getCurrentRunRelicEffects(reward).statBonuses).toEqual({
      attack: 0,
      artPower: 0,
      defense: 0,
      speed: 0,
      trapCheck: 0
    });

    const combat = selectNode(atNode(reward, 'fog_lesser_demon'), 'fog_lesser_demon');
    expect(combat.combat?.weaponFocus).toBe(0);
    expect(combat.run?.relicState).toBeUndefined();
  });
});

describe('equipment soul skill game integration', () => {
  const SOUL_SKILL_SOURCES = {
    mist_fixed_point: { equipmentId: 'mist_hood', slot: 'head' },
    spirit_grounding: { equipmentId: 'spirit_robe', slot: 'armor' },
    gauntlet_breakbeat: { equipmentId: 'guardian_gauntlets', slot: 'hands' },
    cloudstep_retrace: { equipmentId: 'cloudstep_boots', slot: 'feet' },
    rift_misalignment: { equipmentId: 'rift_belt', slot: 'waist' },
    rift_seal: { equipmentId: 'rift_charm', slot: 'charm' }
  } as const satisfies Record<
    EquipmentSoulSkillId,
    { equipmentId: EquipmentId; slot: game.EquipmentSlot }
  >;
  const ALL_SOUL_SKILL_IDS = Object.keys(SOUL_SKILL_SOURCES) as EquipmentSoulSkillId[];

  function withAllDungeonsUnlocked(state: GameState): GameState {
    return {
      ...state,
      completedDungeonIds: [...DUNGEON_ORDER],
      claimedTaskIds: DUNGEON_ORDER.map((dungeonId) => `mainline_clear_${dungeonId}`)
    };
  }

  function withSoulSkills(
    skillIds: readonly EquipmentSoulSkillId[],
    state = createInitialState()
  ): GameState {
    const equipped = { ...state.equipped };
    const equipmentLevels = { ...state.equipmentLevels };
    const equipmentTemperRanks = { ...(state.equipmentTemperRanks ?? {}) };
    const ownedEquipment = new Set(state.ownedEquipment);

    for (const skillId of skillIds) {
      const source = SOUL_SKILL_SOURCES[skillId];
      equipped[source.slot] = source.equipmentId;
      equipmentLevels[source.equipmentId] = 3;
      equipmentTemperRanks[source.equipmentId] = 1;
      ownedEquipment.add(source.equipmentId);
    }

    return {
      ...state,
      ownedEquipment: [...ownedEquipment],
      equipmentLevels,
      equipmentTemperRanks,
      equipped
    };
  }

  function enterSoulRun(
    skillIds: readonly EquipmentSoulSkillId[],
    dungeonId: game.DungeonId = 'demon_tower_1',
    protocolId: RunProtocolId = 'standard',
    state = createInitialState()
  ): GameState {
    return enterDungeon(withSoulSkills(skillIds, withAllDungeonsUnlocked(state)), dungeonId, protocolId);
  }

  function atSoulNode(
    state: GameState,
    nodeId: string,
    ...clearedNodeIds: string[]
  ): GameState {
    if (!state.run) return state;
    return {
      ...state,
      phase: 'explore',
      combat: undefined,
      run: {
        ...state.run,
        currentNodeId: nodeId,
        clearedNodeIds: [...new Set([...state.run.clearedNodeIds, ...clearedNodeIds])]
      }
    };
  }

  function startSoulCombat(
    skillIds: readonly EquipmentSoulSkillId[],
    dungeonId: game.DungeonId,
    nodeId: string,
    turn = 1
  ): GameState {
    const started = selectNode(atSoulNode(enterSoulRun(skillIds, dungeonId), nodeId), nodeId);
    if (!started.combat) throw new Error(`Missing combat fixture for ${nodeId}`);
    return {
      ...started,
      combat: { ...started.combat, turn }
    };
  }

  it('freezes six entry skills with two shared charges and ignores later equipment swaps', () => {
    const entered = enterSoulRun(ALL_SOUL_SKILL_IDS);
    const entrySnapshot = entered.run?.soulSkillState;

    expect(entrySnapshot).toMatchObject({
      rulesVersion: 1,
      frozenSkillIds: ALL_SOUL_SKILL_IDS,
      readySkillIds: ALL_SOUL_SKILL_IDS,
      chargesRemaining: 2,
      usedRechargeIds: []
    });

    const swapped = equipEquipment(entered, 'patched_headwrap');
    expect(swapped.equipped.head).toBe('patched_headwrap');
    expect(swapped.run?.soulSkillState).toEqual(entrySnapshot);
    expect(game.getEquipmentSoulSkillActionStatuses(swapped)).toHaveLength(6);
  });

  it('shares exactly two charges across ready skills and rejects a third use without consuming it', () => {
    const started = startSoulCombat(ALL_SOUL_SKILL_IDS, 'demon_tower_1', 'fog_lesser_demon');
    if (!started.combat) throw new Error('Missing shared-charge combat');
    const pressured: GameState = {
      ...started,
      combat: {
        ...started.combat,
        effects: { rustPoisonStacks: 2, armorCracked: true }
      }
    };

    const skipped = game.useEquipmentSoulSkill(pressured, 'gauntlet_breakbeat');
    const cleansed = game.useEquipmentSoulSkill(skipped, 'spirit_grounding');
    const rewardNode = atSoulNode(cleansed, 'watch_post_cache');
    const blocked = game.useEquipmentSoulSkill(rewardNode, 'rift_seal', { itemId: 'medicine_ash' });

    expect(cleansed.run?.soulSkillState?.chargesRemaining).toBe(0);
    expect(cleansed.run?.soulSkillState?.readySkillIds).toContain('rift_seal');
    expect(game.getEquipmentSoulSkillActionStatus(rewardNode, 'rift_seal')).toMatchObject({
      availability: 'no_charges',
      available: false
    });
    expect(blocked.run?.soulSkillState).toEqual(rewardNode.run?.soulSkillState);
    expect(blocked.run?.clearedNodeIds).not.toContain('watch_post_cache');
    expect(blocked.inventory.medicine_ash).toBe(rewardNode.inventory.medicine_ash);
  });

  it('forces only a naturally failing trap through ordinary pass damage without using an item', () => {
    const weakBase = createInitialState();
    const weakStats: GameState = {
      ...weakBase,
      player: {
        ...weakBase.player,
        base: { ...weakBase.player.base, spirit: 0, luck: 0 }
      }
    };
    const entered = enterSoulRun(['mist_fixed_point'], 'dream_archive', 'imprint', weakStats);
    const trap = atSoulNode(entered, 'paper_cut_trap');
    const safeControl: GameState = {
      ...trap,
      player: {
        ...trap.player,
        base: { ...trap.player.base, spirit: 100, luck: 100 }
      }
    };
    const ordinaryPass = handleTrap(safeControl, 'risk');
    const invalid = game.useEquipmentSoulSkill(safeControl, 'mist_fixed_point');
    const resolved = game.useEquipmentSoulSkill(trap, 'mist_fixed_point');

    expect(game.getEquipmentSoulSkillActionStatus(trap, 'mist_fixed_point').available).toBe(true);
    expect(game.getEquipmentSoulSkillActionStatus(safeControl, 'mist_fixed_point').available).toBe(false);
    expect(invalid.run?.soulSkillState).toEqual(safeControl.run?.soulSkillState);
    expect(invalid.run?.clearedNodeIds).not.toContain('paper_cut_trap');
    expect(trap.player.hp - resolved.player.hp).toBe(safeControl.player.hp - ordinaryPass.player.hp);
    expect(resolved.run?.clearedNodeIds).toContain('paper_cut_trap');
    expect(resolved.run?.usedItems).toEqual(trap.run?.usedItems);
    expect(resolved.inventory).toEqual(trap.inventory);
    expect(resolved.run?.soulSkillState).toMatchObject({ readySkillIds: [], chargesRemaining: 0 });
  });

  it('cleanses only three hostile fields without spending a turn, focus, hp, or retaliation', () => {
    const started = startSoulCombat(['spirit_grounding'], 'demon_tower_1', 'fog_lesser_demon');
    if (!started.combat) throw new Error('Missing cleanse combat');
    const pressured: GameState = {
      ...started,
      combat: {
        ...started.combat,
        weaponFocus: 2,
        effects: {
          rustPoisonStacks: 3,
          mirrorSlowStacks: 2,
          lastPlayerAction: 'attack',
          armorCracked: true,
          lastShiftTurn: 4,
          breathStacks: 2
        }
      }
    };
    const beforeCombat = pressured.combat;
    if (!beforeCombat) throw new Error('Missing pressured cleanse combat');
    const resolved = game.useEquipmentSoulSkill(pressured, 'spirit_grounding');

    expect(resolved.combat?.effects).toEqual({ armorCracked: true, lastShiftTurn: 4, breathStacks: 2 });
    expect(resolved.combat?.turn).toBe(beforeCombat.turn);
    expect(resolved.combat?.weaponFocus).toBe(beforeCombat.weaponFocus);
    expect(resolved.combat?.monsterHp).toBe(beforeCombat.monsterHp);
    expect(resolved.player.hp).toBe(pressured.player.hp);

    const noDebuff: GameState = {
      ...started,
      combat: { ...started.combat, effects: { armorCracked: true } }
    };
    const rejected = game.useEquipmentSoulSkill(noDebuff, 'spirit_grounding');
    expect(rejected.run?.soulSkillState).toEqual(noDebuff.run?.soulSkillState);
    expect(rejected.combat).toEqual(noDebuff.combat);
  });

  it('skips exactly the four dangerous intent beats without a combat action or retaliation', () => {
    const cases = [
      { dungeonId: 'demon_tower_1', nodeId: 'fog_lesser_demon', turn: 1, intentId: 'fog-armor-rend' },
      { dungeonId: 'starfall_mine', nodeId: 'spark_imp_roost', turn: 3, intentId: 'spark-burst' },
      { dungeonId: 'starfall_mine', nodeId: 'molt_beast_patrol', turn: 2, intentId: 'rift-shift' },
      { dungeonId: 'rust_hospital', nodeId: 'pulse_doctor', turn: 3, intentId: 'pulse-wave' }
    ] as const;

    for (const testCase of cases) {
      const started = startSoulCombat(
        ['gauntlet_breakbeat'],
        testCase.dungeonId,
        testCase.nodeId,
        testCase.turn
      );
      if (!started.combat) throw new Error(`Missing intent combat for ${testCase.intentId}`);
      const before = started.combat;

      expect(game.getCurrentCombatIntent(started)?.id).toBe(testCase.intentId);
      expect(game.getEquipmentSoulSkillActionStatus(started, 'gauntlet_breakbeat').available).toBe(true);
      const resolved = game.useEquipmentSoulSkill(started, 'gauntlet_breakbeat');
      expect(resolved.combat?.turn).toBe(before.turn + 1);
      expect(resolved.combat?.monsterHp).toBe(before.monsterHp);
      expect(resolved.combat?.weaponFocus).toBe(before.weaponFocus);
      expect(resolved.combat?.effects).toEqual(before.effects);
      expect(resolved.player.hp).toBe(started.player.hp);
    }

    const regular = startSoulCombat(['gauntlet_breakbeat'], 'demon_tower_1', 'fog_lesser_demon', 2);
    const rejected = game.useEquipmentSoulSkill(regular, 'gauntlet_breakbeat');
    expect(rejected.run?.soulSkillState).toEqual(regular.run?.soulSkillState);
    expect(rejected.combat).toEqual(regular.combat);
  });

  it('backsteps only to a cleared legal adjacent node and leaves the trap uncleared', () => {
    const trap = atSoulNode(
      enterSoulRun(['cloudstep_retrace']),
      'blood_rune_trap',
      'fog_lesser_demon'
    );
    const status = game.getEquipmentSoulSkillActionStatus(trap, 'cloudstep_retrace');
    const invalid = game.useEquipmentSoulSkill(trap, 'cloudstep_retrace', { targetNodeId: 'sealed_cache' });
    const resolved = game.useEquipmentSoulSkill(trap, 'cloudstep_retrace', {
      targetNodeId: 'fog_lesser_demon'
    });

    expect(status.targetNodeIds).toContain('fog_lesser_demon');
    expect(invalid.run?.soulSkillState).toEqual(trap.run?.soulSkillState);
    expect(invalid.run?.currentNodeId).toBe('blood_rune_trap');
    expect(resolved.run?.currentNodeId).toBe('fog_lesser_demon');
    expect(resolved.run?.clearedNodeIds).not.toContain('blood_rune_trap');
    expect(resolved.run?.soulSkillState).toMatchObject({ readySkillIds: [], chargesRemaining: 0 });
  });

  it('offsets portal landing with normal costs and preserves soul state across dungeons', () => {
    const invalidPortal = atSoulNode(enterSoulRun(['rift_misalignment']), 'cracked_portal');
    const invalid = game.useEquipmentSoulSkill(invalidPortal, 'rift_misalignment', {
      targetNodeId: 'platform_arrival',
      portalChoice: 'force'
    });
    expect(invalid.run?.soulSkillState).toEqual(invalidPortal.run?.soulSkillState);
    expect(invalid.run?.dungeonId).toBe('demon_tower_1');

    let prepared = startSoulCombat(
      ['gauntlet_breakbeat', 'rift_misalignment'],
      'demon_tower_1',
      'fog_lesser_demon'
    );
    prepared = game.useEquipmentSoulSkill(prepared, 'gauntlet_breakbeat');
    prepared = atSoulNode(prepared, 'upper_fog_patrol', 'upper_fog_patrol');
    prepared = game.activateCurrentEquipmentSoulSkillRecharge(prepared);
    prepared = game.resolveCurrentEquipmentSoulSkillRecharge(prepared, 'gauntlet_breakbeat');
    const portal = atSoulNode(prepared, 'cracked_portal');
    const forceStatus = game.getEquipmentSoulSkillActionStatus(portal, 'rift_misalignment');
    const forceTarget = forceStatus.targetNodeIds[0];
    if (!forceTarget) throw new Error('Missing legal portal offset target');
    const forced = game.useEquipmentSoulSkill(portal, 'rift_misalignment', {
      targetNodeId: forceTarget,
      portalChoice: 'force'
    });

    expect(forced.run?.dungeonId).toBe('metro_abyss');
    expect(forced.run?.currentNodeId).toBe(forceTarget);
    expect(forced.player.hp).toBeLessThan(portal.player.hp);
    expect(forced.run?.soulSkillState).toMatchObject({
      readySkillIds: ['gauntlet_breakbeat'],
      chargesRemaining: 1,
      usedRechargeIds: ['soul_node_demon_mist_watch']
    });

    const stableBase = createInitialState();
    const stableInventory: GameState = {
      ...stableBase,
      inventory: { ...stableBase.inventory, gate_sigil: 1 }
    };
    const stablePortal = atSoulNode(
      enterSoulRun(['rift_misalignment'], 'demon_tower_1', 'standard', stableInventory),
      'cracked_portal'
    );
    const stableStatus = game.getEquipmentSoulSkillActionStatus(stablePortal, 'rift_misalignment');
    const stableTarget = stableStatus.targetNodeIds[0];
    if (!stableTarget) throw new Error('Missing stable portal offset target');
    const stabilized = game.useEquipmentSoulSkill(stablePortal, 'rift_misalignment', {
      targetNodeId: stableTarget,
      portalChoice: 'stabilize'
    });
    expect(stabilized.player.hp).toBe(stablePortal.player.hp);
    expect(stabilized.inventory.gate_sigil).toBe(0);
    expect(stabilized.run?.usedItems).toContain('gate_sigil');
  });

  it('seals one reward item while normal reward, relic draft, and retreat settlement still resolve', () => {
    const rewardNode = atSoulNode(enterSoulRun(['rift_seal']), 'watch_post_cache');
    const normal = collectReward(rewardNode);
    const invalid = game.useEquipmentSoulSkill(rewardNode, 'rift_seal', { itemId: 'demon_bone' });
    const sealed = game.useEquipmentSoulSkill(rewardNode, 'rift_seal', { itemId: 'medicine_ash' });

    expect(invalid.run?.soulSkillState).toEqual(rewardNode.run?.soulSkillState);
    expect(invalid.run?.clearedNodeIds).not.toContain('watch_post_cache');
    expect(sealed.rewardPoints).toBe(normal.rewardPoints);
    expect(sealed.inventory.medicine_ash).toBe(normal.inventory.medicine_ash);
    expect(normal.run?.lootBag.items.medicine_ash).toBe(1);
    expect(sealed.run?.lootBag.items.medicine_ash ?? 0).toBe(0);
    expect(sealed.run?.clearedNodeIds).toContain('watch_post_cache');
    expect(sealed.run?.relicState?.pendingDraft?.draftId).toBe('demon_tower_1:echo:1');
    expect(normal.run?.relicState?.pendingDraft?.draftId).toBe('demon_tower_1:echo:1');

    const normalRetreat = resolveRetreat(normal);
    const sealedRetreat = resolveRetreat(sealed);
    expect(normalRetreat.inventory.medicine_ash).toBe(rewardNode.inventory.medicine_ash);
    expect(sealedRetreat.inventory.medicine_ash).toBe(rewardNode.inventory.medicine_ash + 1);
    expect(sealedRetreat.run?.lastLootSettlement?.lost.items.medicine_ash ?? 0).toBe(0);
  });

  it('restores a spent skill, supports cancel, locks travel pending, and never locks retreat', () => {
    let spent = startSoulCombat(['gauntlet_breakbeat'], 'demon_tower_1', 'fog_lesser_demon');
    spent = game.useEquipmentSoulSkill(spent, 'gauntlet_breakbeat');
    const station = atSoulNode(spent, 'upper_fog_patrol', 'upper_fog_patrol');
    const pending = game.activateCurrentEquipmentSoulSkillRecharge(station);
    const moved = game.moveToNode(pending, 'watch_post_cache');
    const portalBlocked = usePortal(pending);
    const exitBlocked = resolveExit(pending);
    const retreated = resolveRetreat(pending);

    expect(game.getEquipmentSoulSkillRechargeStatus(station)).toMatchObject({
      available: true,
      rechargeId: 'soul_node_demon_mist_watch',
      spentSkillIds: ['gauntlet_breakbeat']
    });
    expect(game.getNodeDepartureBlock(pending)).toEqual({
      kind: 'soul_recharge_pending',
      message: game.SOUL_RECHARGE_PENDING_BLOCK_MESSAGE
    });
    expect(moved.run?.currentNodeId).toBe('upper_fog_patrol');
    expect(moved.log[0]).toBe(game.SOUL_RECHARGE_PENDING_BLOCK_MESSAGE);
    expect(portalBlocked.log[0]).toBe(game.SOUL_RECHARGE_PENDING_BLOCK_MESSAGE);
    expect(exitBlocked.log[0]).toBe(game.SOUL_RECHARGE_PENDING_BLOCK_MESSAGE);
    expect(retreated.phase).toBe('result');

    const cancelled = game.cancelCurrentEquipmentSoulSkillRecharge(pending);
    expect(cancelled.run?.soulSkillState?.pendingRecharge).toBeUndefined();
    expect(cancelled.run?.soulSkillState?.usedRechargeIds).toEqual([]);
    expect(game.getEquipmentSoulSkillRechargeStatus(cancelled).available).toBe(true);

    const reopened = game.activateCurrentEquipmentSoulSkillRecharge(cancelled);
    const restored = game.resolveCurrentEquipmentSoulSkillRecharge(reopened, 'gauntlet_breakbeat');
    const reused = game.activateCurrentEquipmentSoulSkillRecharge(restored);
    expect(restored.run?.soulSkillState).toMatchObject({
      readySkillIds: ['gauntlet_breakbeat'],
      chargesRemaining: 1,
      usedRechargeIds: ['soul_node_demon_mist_watch']
    });
    expect(reused.run?.soulSkillState).toEqual(restored.run?.soulSkillState);
    expect(game.getEquipmentSoulSkillRechargeStatus(restored)).toMatchObject({ available: false, used: true });
  });

  it('keeps legacy runs disabled and does not synthesize soul state through a portal', () => {
    const entered = enterSoulRun(['spirit_grounding']);
    if (!entered.run) throw new Error('Missing legacy soul run fixture');
    const { soulSkillState: _soulSkillState, ...legacyRun } = entered.run;
    const legacy: GameState = { ...entered, run: legacyRun };
    const combat = selectNode(atSoulNode(legacy, 'fog_lesser_demon'), 'fog_lesser_demon');
    if (!combat.combat) throw new Error('Missing legacy combat fixture');
    const pressured: GameState = {
      ...combat,
      combat: { ...combat.combat, effects: { rustPoisonStacks: 2 } }
    };
    const rejected = game.useEquipmentSoulSkill(pressured, 'spirit_grounding');
    const station = atSoulNode(rejected, 'upper_fog_patrol', 'upper_fog_patrol');
    const rechargeRejected = game.activateCurrentEquipmentSoulSkillRecharge(station);
    const portal = atSoulNode(rechargeRejected, 'cracked_portal');
    const transported = usePortal(portal, 'force');

    expect(game.getEquipmentSoulSkillActionStatus(pressured, 'spirit_grounding').available).toBe(false);
    expect(rejected.combat).toEqual(pressured.combat);
    expect(rejected.run?.soulSkillState).toBeUndefined();
    expect(game.getEquipmentSoulSkillRechargeStatus(station)).toMatchObject({
      legacyDisabled: true,
      available: false
    });
    expect(rechargeRejected.run?.soulSkillState).toBeUndefined();
    expect(transported.run?.dungeonId).toBe('metro_abyss');
    expect(transported.run?.soulSkillState).toBeUndefined();
  });
});

describe('field survey core integration', () => {
  const SURVEY_SOURCES: Record<
    EquipmentAttunementId,
    { equipmentId: EquipmentId; slot: game.EquipmentSlot }
  > = {
    mist_vanguard: { equipmentId: 'mist_hood', slot: 'head' },
    mist_veilguard: { equipmentId: 'mist_hood', slot: 'head' },
    forge_overdrive: { equipmentId: 'armor_piercing_sword', slot: 'weapon' },
    forge_channeling: { equipmentId: 'armor_piercing_sword', slot: 'weapon' },
    rift_resonance: { equipmentId: 'rift_belt', slot: 'waist' },
    rift_anchor: { equipmentId: 'rift_belt', slot: 'waist' },
    chronal_acceleration: { equipmentId: 'chronal_lens', slot: 'charm' },
    chronal_stasis: { equipmentId: 'chronal_lens', slot: 'charm' }
  };

  function unlockedHub(): GameState {
    const state = createInitialState();
    return {
      ...state,
      completedDungeonIds: [...DUNGEON_ORDER],
      claimedTaskIds: DUNGEON_ORDER.map((dungeonId) => `mainline_clear_${dungeonId}`)
    };
  }

  function withSurveySource(state: GameState, attunementId: EquipmentAttunementId): GameState {
    const source = SURVEY_SOURCES[attunementId];
    const prepared: GameState = {
      ...state,
      ownedEquipment: state.ownedEquipment.includes(source.equipmentId)
        ? state.ownedEquipment
        : [...state.ownedEquipment, source.equipmentId],
      equipmentLevels: {
        ...state.equipmentLevels,
        [source.equipmentId]: EQUIPMENT[source.equipmentId].maxLevel
      },
      equipmentAttunements: {
        ...(state.equipmentAttunements ?? {}),
        [source.equipmentId]: attunementId
      },
      equipped: {
        ...state.equipped,
        [source.slot]: source.equipmentId
      }
    };
    const maxHp = getDerivedStats(prepared).maxHp;
    return { ...prepared, player: { ...prepared.player, hp: maxHp, maxHp } };
  }

  function atNode(state: GameState, nodeId: string): GameState {
    if (!state.run) throw new Error('Expected an active field survey run');
    return {
      ...state,
      phase: 'explore',
      combat: undefined,
      run: { ...state.run, currentNodeId: nodeId }
    };
  }

  function withRelic(state: GameState, frame: RunRelicFrame, relicId: RunRelicId): GameState {
    if (!state.run) throw new Error('Expected an active field survey run');
    return {
      ...state,
      run: {
        ...state.run,
        relicState: { ...createRunRelicState(frame, 991), acquiredIds: [relicId] }
      }
    };
  }

  function optionStatus(state: GameState, optionId: string): game.CurrentFieldSurveyOptionStatus {
    const option = game.getCurrentFieldSurveyStatus(state).options.find(
      (candidate) => candidate.definition.id === optionId
    );
    if (!option) throw new Error(`Missing field survey option ${optionId}`);
    return option;
  }

  it('freezes only equipped max-level valid sources and ignores later loadout changes', () => {
    const mistReady = withSurveySource(unlockedHub(), 'mist_vanguard');
    const prepared: GameState = {
      ...mistReady,
      ownedEquipment: [...mistReady.ownedEquipment, 'armor_piercing_sword', 'rift_belt'],
      equipmentLevels: {
        ...mistReady.equipmentLevels,
        armor_piercing_sword: 2,
        rift_belt: EQUIPMENT.rift_belt.maxLevel
      },
      equipmentAttunements: {
        ...mistReady.equipmentAttunements,
        armor_piercing_sword: 'forge_overdrive',
        rift_belt: 'rift_anchor'
      },
      equipped: { ...mistReady.equipped, weapon: 'armor_piercing_sword' }
    };
    const entered = enterDungeon(prepared, 'demon_tower_1');
    const snapshot = entered.run?.fieldSurveyState;

    expect(snapshot?.frozenSources).toEqual([
      { equipmentId: 'mist_hood', attunementId: 'mist_vanguard' }
    ]);

    const changed: GameState = {
      ...entered,
      equipmentLevels: { ...entered.equipmentLevels, armor_piercing_sword: 3 },
      equipmentAttunements: {
        ...entered.equipmentAttunements,
        mist_hood: 'mist_veilguard',
        armor_piercing_sword: 'forge_overdrive'
      }
    };
    const host = atNode(changed, 'demon_bone_cache');
    const mist = optionStatus(host, 'mist_vanguard_fast_search');
    const forge = optionStatus(host, 'forge_overdrive_crush_bone');

    expect(changed.run?.fieldSurveyState).toBe(snapshot);
    expect(mist).toMatchObject({ available: true, frozenSourceEquipmentIds: ['mist_hood'] });
    expect(forge).toMatchObject({
      available: false,
      frozenSourceEquipmentIds: [],
      unavailableReason: '入场快照未冻结该选项对应的铭刻分支。'
    });
  });

  it('keeps normal reward collection numerically unchanged and does not resolve the survey', () => {
    const start = atNode(enterDungeon(unlockedHub(), 'demon_tower_1'), 'demon_bone_cache');
    const snapshot = start.run?.fieldSurveyState;
    const result = collectReward(start);

    expect(result.rewardPoints - start.rewardPoints).toBe(95);
    expect(result.inventory.demon_bone - start.inventory.demon_bone).toBe(1);
    expect(result.run?.clearedNodeIds).toContain('demon_bone_cache');
    expect(result.run?.fieldSurveyState).toBe(snapshot);
    expect(result.run?.fieldSurveyState?.resolvedSurveys).toEqual([]);
  });

  it('settles damage, conversion, and cost-plus-healing options through real rewards', () => {
    const damageStart = atNode(
      enterDungeon(withSurveySource(unlockedHub(), 'forge_overdrive'), 'demon_tower_1'),
      'demon_bone_cache'
    );
    const damageOption = optionStatus(damageStart, 'forge_overdrive_crush_bone').definition;
    const expectedDamage = Math.max(
      1,
      Math.floor(getDerivedStats(damageStart).maxHp * Math.abs(damageOption.hpPercent ?? 0) / 100)
    );
    const damaged = game.resolveFieldSurvey(damageStart, damageOption.id);
    expect(damaged.rewardPoints - damageStart.rewardPoints).toBe(
      Math.floor(95 * damageOption.rewardPointsPercent / 100)
    );
    expect(damaged.inventory.demon_bone - damageStart.inventory.demon_bone).toBe(2);
    expect((damaged.run?.damageTaken ?? 0) - (damageStart.run?.damageTaken ?? 0)).toBe(expectedDamage);
    expect(damaged.log[0]).toContain(damageOption.name);

    const conversionStart = atNode(
      enterDungeon(withSurveySource(unlockedHub(), 'forge_channeling'), 'starfall_mine'),
      'resonant_pick_reward'
    );
    const conversionOption = optionStatus(conversionStart, 'forge_channeling_heat_refine').definition;
    const converted = game.resolveFieldSurvey(conversionStart, conversionOption.id);
    expect(converted.rewardPoints - conversionStart.rewardPoints).toBe(
      Math.floor(130 * conversionOption.rewardPointsPercent / 100)
    );
    expect(converted.inventory.cracked_core).toBe(conversionStart.inventory.cracked_core);
    expect(converted.lingyun - conversionStart.lingyun).toBe(conversionOption.lingyunDelta);

    const carried = game.configureTacticalLoadout(
      withSurveySource(unlockedHub(), 'rift_anchor'),
      ['echo_coin']
    );
    const metro = enterDungeon(carried, 'metro_abyss');
    const pickedUp = collectReward(atNode(metro, 'echo_coin_vendor'));
    expect(pickedUp.run?.lootBag.items.echo_coin).toBe(1);
    const anchorStartBase = atNode(pickedUp, 'lost_locker_reward');
    const anchorStart: GameState = {
      ...anchorStartBase,
      player: { ...anchorStartBase.player, hp: anchorStartBase.player.maxHp - 30 }
    };
    const anchorOption = optionStatus(anchorStart, 'rift_anchor_lost_property').definition;
    const anchored = game.resolveFieldSurvey(anchorStart, anchorOption.id);
    expect(anchored.inventory.echo_coin).toBe(0);
    expect(anchored.run?.lootBag.items.echo_coin ?? 0).toBe(0);
    expect(anchored.run?.usedItems).toContain('echo_coin');
    expect(anchored.inventory.gate_sigil - anchorStart.inventory.gate_sigil).toBe(1);
    expect(anchored.player.hp).toBeGreaterThan(anchorStart.player.hp);
    expect(anchored.run?.lootBag.items.gate_sigil).toBe(1);
  });

  it('applies the relic reward-point modifier before survey percentage conversion', () => {
    const base = atNode(
      enterDungeon(withSurveySource(unlockedHub(), 'mist_vanguard'), 'demon_tower_1'),
      'demon_bone_cache'
    );
    const start = withRelic(base, 'wayfinder', 'lucky_map');
    const option = optionStatus(start, 'mist_vanguard_fast_search').definition;
    const result = game.resolveFieldSurvey(start, option.id);
    const relicAdjusted = Math.ceil(95 * 1.2);

    expect(result.rewardPoints - start.rewardPoints).toBe(
      Math.floor(relicAdjusted * option.rewardPointsPercent / 100)
    );
    expect(result.log[0]).toContain(`95 提升至 ${relicAdjusted}`);
  });

  it('leaves cost, node, and survey untouched for invalid branch, cost, option, and repeat calls', () => {
    const noBranch = atNode(enterDungeon(unlockedHub(), 'demon_tower_1'), 'demon_bone_cache');
    const branchRejected = game.resolveFieldSurvey(noBranch, 'forge_overdrive_crush_bone');
    expect(branchRejected.inventory).toEqual(noBranch.inventory);
    expect(branchRejected.run?.clearedNodeIds).not.toContain('demon_bone_cache');
    expect(branchRejected.run?.fieldSurveyState).toBe(noBranch.run?.fieldSurveyState);

    const carried = game.configureTacticalLoadout(
      withSurveySource(unlockedHub(), 'rift_anchor'),
      ['echo_coin']
    );
    const missingCost = atNode(enterDungeon(carried, 'metro_abyss'), 'lost_locker_reward');
    const costRejected = game.resolveFieldSurvey(missingCost, 'rift_anchor_lost_property');
    expect(optionStatus(missingCost, 'rift_anchor_lost_property').costAvailability).toMatchObject({
      available: false,
      items: [{ reason: 'missing' }]
    });
    expect(costRejected.inventory).toEqual(missingCost.inventory);
    expect(costRejected.run?.clearedNodeIds).not.toContain('lost_locker_reward');
    expect(costRejected.run?.fieldSurveyState).toBe(missingCost.run?.fieldSurveyState);

    const uncarriedBase = withSurveySource(unlockedHub(), 'rift_anchor');
    const uncarried = atNode(
      enterDungeon(
        { ...uncarriedBase, inventory: { ...uncarriedBase.inventory, echo_coin: 1 } },
        'metro_abyss'
      ),
      'lost_locker_reward'
    );
    expect(optionStatus(uncarried, 'rift_anchor_lost_property').costAvailability.items[0]).toMatchObject({
      available: false,
      reason: 'not_carried'
    });
    const uncarriedRejected = game.resolveFieldSurvey(uncarried, 'rift_anchor_lost_property');
    expect(uncarriedRejected.inventory.echo_coin).toBe(1);
    expect(uncarriedRejected.run?.clearedNodeIds).not.toContain('lost_locker_reward');
    expect(uncarriedRejected.run?.fieldSurveyState).toBe(uncarried.run?.fieldSurveyState);

    const valid = atNode(
      enterDungeon(withSurveySource(unlockedHub(), 'mist_vanguard'), 'demon_tower_1'),
      'demon_bone_cache'
    );
    const wrong = game.resolveFieldSurvey(valid, 'not_an_option');
    expect(wrong.inventory).toEqual(valid.inventory);
    expect(wrong.run?.fieldSurveyState).toBe(valid.run?.fieldSurveyState);
    expect(wrong.run?.clearedNodeIds).not.toContain('demon_bone_cache');

    const resolved = game.resolveFieldSurvey(valid, 'mist_vanguard_fast_search');
    const repeated = game.resolveFieldSurvey(resolved, 'mist_vanguard_fast_search');
    expect(repeated.rewardPoints).toBe(resolved.rewardPoints);
    expect(repeated.inventory).toEqual(resolved.inventory);
    expect(repeated.run?.fieldSurveyState).toBe(resolved.run?.fieldSurveyState);
    expect(repeated.run?.clearedNodeIds).toEqual(resolved.run?.clearedNodeIds);
  });

  it('settles survey rewards through the normal retreat loot economy', () => {
    const host = atNode(
      enterDungeon(withSurveySource(unlockedHub(), 'mist_vanguard'), 'demon_tower_1'),
      'demon_bone_cache'
    );
    const option = optionStatus(host, 'mist_vanguard_fast_search').definition;
    const resolved = game.resolveFieldSurvey(host, option.id);
    const awardedRewardPoints = Math.floor(95 * option.rewardPointsPercent / 100);
    const retreated = resolveRetreat(resolved);

    expect(retreated.phase).toBe('result');
    expect(retreated.run?.lastLootSettlement?.retained.rewardPoints).toBe(
      Math.floor(awardedRewardPoints * 0.5)
    );
    expect(retreated.run?.lastLootSettlement?.lost.rewardPoints).toBe(
      awardedRewardPoints - Math.floor(awardedRewardPoints * 0.5)
    );
    expect(retreated.run?.lastLootSettlement?.lost.items.focus_incense).toBe(1);
  });

  it('preserves the exact snapshot and resolved record across portals', () => {
    const host = atNode(
      enterDungeon(withSurveySource(unlockedHub(), 'mist_vanguard'), 'demon_tower_1'),
      'demon_bone_cache'
    );
    const resolved = game.resolveFieldSurvey(host, 'mist_vanguard_fast_search');
    const snapshot = resolved.run?.fieldSurveyState;
    const changed: GameState = {
      ...resolved,
      equipmentAttunements: { ...resolved.equipmentAttunements, mist_hood: 'mist_veilguard' }
    };
    const transported = usePortal(atNode(changed, 'cracked_portal'), 'force');

    expect(transported.run?.dungeonId).toBe('metro_abyss');
    expect(transported.run?.fieldSurveyState).toBe(snapshot);
    expect(transported.run?.fieldSurveyState?.resolvedSurveys).toEqual([
      { surveyId: 'survey_demon_bone_marrow', optionId: 'mist_vanguard_fast_search' }
    ]);
  });

  it('disables legacy and malformed snapshots while keeping normal collect and portal behavior', () => {
    const entered = enterDungeon(withSurveySource(unlockedHub(), 'mist_vanguard'), 'demon_tower_1');
    if (!entered.run) throw new Error('Expected an active field survey run');
    const { fieldSurveyState: _fieldSurveyState, ...legacyRun } = entered.run;
    const malformedSnapshot = {
      rulesVersion: 2,
      frozenSources: [{ equipmentId: 'mist_hood', attunementId: 'mist_vanguard' }],
      resolvedSurveys: []
    } as unknown as NonNullable<game.DungeonRun['fieldSurveyState']>;
    const variants: GameState[] = [
      { ...entered, run: legacyRun },
      { ...entered, run: { ...entered.run, fieldSurveyState: malformedSnapshot } }
    ];

    for (const variant of variants) {
      const host = atNode(variant, 'demon_bone_cache');
      const rejected = game.resolveFieldSurvey(host, 'mist_vanguard_fast_search');
      expect(game.getCurrentFieldSurveyStatus(host).legacyDisabled).toBe(true);
      expect(rejected.run?.clearedNodeIds).not.toContain('demon_bone_cache');
      expect(rejected.inventory).toEqual(host.inventory);

      const normal = collectReward(rejected);
      expect(normal.rewardPoints - rejected.rewardPoints).toBe(95);
      expect(normal.run?.clearedNodeIds).toContain('demon_bone_cache');

      const snapshot = variant.run?.fieldSurveyState;
      const transported = usePortal(atNode(variant, 'cracked_portal'), 'force');
      expect(transported.run?.fieldSurveyState).toBe(snapshot);
    }
  });

  it('records lethal survey damage before normal failure settlement handles awarded loot', () => {
    const host = atNode(
      enterDungeon(withSurveySource(unlockedHub(), 'forge_overdrive'), 'ash_arena'),
      'cracked_core_prize'
    );
    const doomed: GameState = { ...host, player: { ...host.player, hp: 1 } };
    const option = optionStatus(doomed, 'forge_overdrive_core_break').definition;
    const failed = game.resolveFieldSurvey(doomed, option.id);
    const awardedRewardPoints = Math.floor(100 * option.rewardPointsPercent / 100);

    expect(failed.phase).toBe('result');
    expect(failed.player.hp).toBe(0);
    expect((failed.run?.damageTaken ?? 0) - (doomed.run?.damageTaken ?? 0)).toBe(1);
    expect(failed.run?.fieldSurveyState?.resolvedSurveys).toContainEqual({
      surveyId: 'survey_arena_cracked_prize',
      optionId: option.id
    });
    expect(failed.run?.clearedNodeIds).toContain('cracked_core_prize');
    expect(failed.run?.lastLootSettlement?.retained.rewardPoints).toBe(
      Math.floor(awardedRewardPoints * 0.2)
    );
    expect(failed.run?.lastLootSettlement?.lost.rewardPoints).toBe(
      awardedRewardPoints - Math.floor(awardedRewardPoints * 0.2)
    );
    expect(failed.run?.lootBag.rewardPoints).toBe(0);
    expect(failed.log[0]).toContain(option.name);
    expect(failed.log[0]).toContain('强制回收');
  });
});

describe('equipment hunt core integration', () => {
  const dungeonId = 'demon_tower_1' as const;
  const targetEquipmentId = 'spirit_robe' as const;
  const clueNodeIds = ['broken_sigil_reward', 'fallen_pack_reward'] as const;

  function unlockedHub(state = createInitialState()): GameState {
    return {
      ...state,
      completedDungeonIds: [...DUNGEON_ORDER],
      claimedTaskIds: DUNGEON_ORDER.map((id) => `mainline_clear_${id}`)
    };
  }

  function atNode(state: GameState, nodeId: string, ...clearedNodeIds: string[]): GameState {
    if (!state.run) throw new Error('Expected an active equipment hunt run');
    return {
      ...state,
      phase: 'explore',
      combat: undefined,
      run: {
        ...state.run,
        currentNodeId: nodeId,
        clearedNodeIds: [...new Set([...state.run.clearedNodeIds, ...clearedNodeIds])]
      }
    };
  }

  function enterPreparedHunt(targetId: EquipmentId = targetEquipmentId): GameState {
    return enterDungeon(
      game.prepareEquipmentHunt(unlockedHub(), dungeonId, targetId),
      dungeonId
    );
  }

  function collectClue(state: GameState, clueNodeId = clueNodeIds[0]): GameState {
    return collectReward(atNode(state, clueNodeId));
  }

  function defeatElite(state: GameState, nodeId = 'butcher_turn'): GameState {
    const started = selectNode(atNode(state, nodeId), nodeId);
    if (!started.combat) throw new Error(`Missing elite combat fixture ${nodeId}`);
    return performCombatAction(
      {
        ...started,
        combat: { ...started.combat, monsterHp: 1 }
      },
      'attack'
    );
  }

  function getQualifiedOffer(): GameState {
    return defeatElite(collectClue(enterPreparedHunt()));
  }

  function withBossClearedAtExit(state: GameState): GameState {
    return atNode(state, 'tower_exit', getBossDefinition(dungeonId).nodeId);
  }

  function withPortalSoulSkill(state: GameState): GameState {
    return {
      ...state,
      ownedEquipment: state.ownedEquipment.includes('rift_belt')
        ? state.ownedEquipment
        : [...state.ownedEquipment, 'rift_belt'],
      equipmentLevels: { ...state.equipmentLevels, rift_belt: 3 },
      equipmentTemperRanks: { ...(state.equipmentTemperRanks ?? {}), rift_belt: 1 },
      equipped: { ...state.equipped, waist: 'rift_belt' }
    };
  }

  it('prepares, repeats, clears, and rejects illegal or already-owned targets only in the hub', () => {
    const initial = unlockedHub();
    const status = game.getEquipmentHuntPreparationStatus(initial, dungeonId);
    const prepared = game.prepareEquipmentHunt(initial, dungeonId, targetEquipmentId);
    const repeated = game.prepareEquipmentHunt(prepared, dungeonId, targetEquipmentId);
    const illegal = game.prepareEquipmentHunt(prepared, dungeonId, 'void_lantern');
    const cleared = game.prepareEquipmentHunt(prepared, dungeonId);
    const ownedTarget: GameState = {
      ...initial,
      ownedEquipment: [...initial.ownedEquipment, targetEquipmentId]
    };
    const ownedRejected = game.prepareEquipmentHunt(ownedTarget, dungeonId, targetEquipmentId);
    const inRun = enterDungeon(initial, dungeonId);
    const inRunRejected = game.prepareEquipmentHunt(inRun, dungeonId, targetEquipmentId);

    expect(status.targetEquipmentIds).toContain(targetEquipmentId);
    expect(status.clueNodes).toHaveLength(2);
    expect(status.clueNodes.map((clue) => clue.nodeId)).toEqual(clueNodeIds);
    expect(prepared.preparedEquipmentHunt).toEqual({ dungeonId, targetEquipmentId });
    expect(prepared.rewardPoints).toBe(initial.rewardPoints);
    expect(prepared.lingyun).toBe(initial.lingyun);
    expect(prepared.inventory).toEqual(initial.inventory);
    expect(repeated).toBe(prepared);
    expect(illegal.preparedEquipmentHunt).toEqual(prepared.preparedEquipmentHunt);
    expect(illegal.log[0]).toContain('不在该副本装备池');
    expect(cleared.preparedEquipmentHunt).toBeUndefined();
    expect(ownedRejected.preparedEquipmentHunt).toBeUndefined();
    expect(ownedRejected.log[0]).toContain('已经入架');
    expect(inRunRejected.preparedEquipmentHunt).toBeUndefined();
    expect(inRunRejected.log[0]).toContain('只能在主神空间');
  });

  it('freezes only a legal matching preparation on entry', () => {
    const prepared = game.prepareEquipmentHunt(unlockedHub(), dungeonId, targetEquipmentId);
    const entered = enterDungeon(prepared, dungeonId);
    const snapshot = entered.run?.equipmentHunt;
    const changedAfterEntry: GameState = {
      ...entered,
      preparedEquipmentHunt: { dungeonId, targetEquipmentId: 'bone_spear' },
      ownedEquipment: [...entered.ownedEquipment, targetEquipmentId]
    };

    expect(snapshot).toMatchObject({
      rulesVersion: 1,
      dungeonId,
      targetEquipmentId,
      clueNodeIds,
      crossedDungeonPortal: false
    });
    expect(changedAfterEntry.run?.equipmentHunt).toBe(snapshot);
    expect(entered.log[0]).toContain('装备追猎目标已冻结');

    const wrongDungeonPreparation = game.prepareEquipmentHunt(
      unlockedHub(),
      'metro_abyss',
      'cloudstep_charm'
    );
    const wrongDungeonEntry = enterDungeon(wrongDungeonPreparation, dungeonId);
    const nowOwnedPreparation = game.prepareEquipmentHunt(
      unlockedHub(),
      dungeonId,
      targetEquipmentId
    );
    const nowOwnedEntry = enterDungeon(
      {
        ...nowOwnedPreparation,
        ownedEquipment: [...nowOwnedPreparation.ownedEquipment, targetEquipmentId]
      },
      dungeonId
    );
    const ordinaryEntry = enterDungeon(unlockedHub(), dungeonId);

    expect(wrongDungeonEntry.run?.equipmentHunt).toBeUndefined();
    expect(nowOwnedEntry.run?.equipmentHunt).toBeUndefined();
    expect(ordinaryEntry.run?.equipmentHunt).toBeUndefined();
    expect(wrongDungeonEntry.log[0]).not.toContain('装备追猎');
    expect(nowOwnedEntry.log[0]).not.toContain('装备追猎');
    expect(ordinaryEntry.log[0]).not.toContain('装备追猎');
  });

  it('qualifies from either collected clue but not from merely standing on one', () => {
    for (const clueNodeId of clueNodeIds) {
      const standing = atNode(enterPreparedHunt(), clueNodeId);
      const standingStatus = game.getCurrentEquipmentHuntStatus(standing);
      const collected = collectReward(standing);
      const collectedStatus = game.getCurrentEquipmentHuntStatus(collected);

      expect(standingStatus).toMatchObject({
        enabled: true,
        cleared: false,
        qualified: false,
        crossed: false,
        passed: false
      });
      expect(collected.run?.clearedNodeIds).toContain(clueNodeId);
      expect(collectedStatus).toMatchObject({ cleared: true, qualified: true, passed: false });
      expect(collectedStatus.clueNodes.find((clue) => clue.nodeId === clueNodeId)?.cleared).toBe(true);
      expect(collectedStatus.clueNodes.filter((clue) => clue.cleared)).toHaveLength(1);
    }
  });

  it('puts the qualified target first and exactly once in the first elite offer', () => {
    const clued = collectClue(enterPreparedHunt());
    expect(game.getCurrentEquipmentHuntStatus(clued).qualified).toBe(true);

    const offered = defeatElite(clued);
    const offer = offered.run?.pendingEquipmentOffer;

    expect(offer?.guaranteedEquipmentId).toBe(targetEquipmentId);
    expect(offer?.equipmentIds[0]).toBe(targetEquipmentId);
    expect(offer?.equipmentIds.filter((equipmentId) => equipmentId === targetEquipmentId)).toHaveLength(1);
    expect(game.getCurrentEquipmentHuntStatus(offered)).toMatchObject({
      cleared: true,
      qualified: false,
      offer: true,
      selected: false,
      passed: false
    });

    const alternateEquipmentId = offer?.equipmentIds[1];
    expect(alternateEquipmentId).toBeDefined();
    if (!alternateEquipmentId) return;
    const alternate = resolveEquipmentLoot(offered, alternateEquipmentId);
    expect(game.getCurrentEquipmentHuntStatus(alternate)).toMatchObject({
      offer: false,
      selected: false,
      passed: true
    });
  });

  it('falls back to the ordinary first offer when the elite precedes the clue and never upgrades retroactively', () => {
    const entered = enterPreparedHunt();
    const offered = defeatElite(entered);
    const dismissed = resolveEquipmentLoot(offered);
    const cluedTooLate = collectClue(dismissed);
    const secondElite = defeatElite(cluedTooLate, 'tower_butcher_patrol');

    expect(offered.run?.pendingEquipmentOffer?.guaranteedEquipmentId).toBeUndefined();
    expect(game.getCurrentEquipmentHuntStatus(offered)).toMatchObject({
      cleared: false,
      qualified: false,
      offer: false,
      passed: true
    });
    expect(game.getCurrentEquipmentHuntStatus(cluedTooLate)).toMatchObject({
      cleared: true,
      qualified: false,
      passed: true
    });
    expect(secondElite.run?.lootOffersMade).toBe(1);
    expect(secondElite.run?.pendingEquipmentOffer).toBeUndefined();
  });

  it('does not invalidate a qualified hunt by moving onto a portal node', () => {
    const clued = collectClue(enterPreparedHunt());
    const besidePortal = atNode(clued, 'blood_rune_trap', 'blood_rune_trap');
    const onPortal = game.moveToNode(besidePortal, 'cracked_portal');

    expect(onPortal.run?.currentNodeId).toBe('cracked_portal');
    expect(onPortal.run?.equipmentHunt?.crossedDungeonPortal).toBe(false);
    expect(game.getCurrentEquipmentHuntStatus(onPortal)).toMatchObject({
      qualified: true,
      crossed: false,
      passed: false
    });
  });

  it('marks and carries the snapshot only after a normal portal transfer succeeds', () => {
    const lockedStart = collectClue(
      enterDungeon(
        game.prepareEquipmentHunt(createInitialState(), dungeonId, targetEquipmentId),
        dungeonId
      )
    );
    const blocked = usePortal(atNode(lockedStart, 'cracked_portal'), 'force');
    expect(blocked.run?.dungeonId).toBe(dungeonId);
    expect(game.getCurrentEquipmentHuntStatus(blocked).crossed).toBe(false);

    const portal = atNode(collectClue(enterPreparedHunt()), 'cracked_portal');
    const transported = usePortal(portal, 'force');
    expect(transported.run?.dungeonId).toBe('metro_abyss');
    expect(transported.run?.equipmentHunt).toMatchObject({
      dungeonId,
      targetEquipmentId,
      crossedDungeonPortal: true
    });
    expect(game.getCurrentEquipmentHuntStatus(transported)).toMatchObject({
      enabled: true,
      crossed: true,
      qualified: false,
      passed: true
    });
  });

  it('invalidates through the shared equipment-soul portal offset path', () => {
    const preparedHub = withPortalSoulSkill(
      game.prepareEquipmentHunt(unlockedHub(), dungeonId, targetEquipmentId)
    );
    const portal = atNode(collectClue(enterDungeon(preparedHub, dungeonId)), 'cracked_portal');
    const soulStatus = game.getEquipmentSoulSkillActionStatus(portal, 'rift_misalignment');
    const targetNodeId = soulStatus.targetNodeIds[0];
    expect(targetNodeId).toBeDefined();
    if (!targetNodeId) return;

    const transported = game.useEquipmentSoulSkill(portal, 'rift_misalignment', {
      targetNodeId,
      portalChoice: 'force'
    });

    expect(transported.run?.dungeonId).toBe('metro_abyss');
    expect(transported.run?.currentNodeId).toBe(targetNodeId);
    expect(transported.run?.equipmentHunt?.crossedDungeonPortal).toBe(true);
    expect(game.getCurrentEquipmentHuntStatus(transported)).toMatchObject({ crossed: true, passed: true });
  });

  it('banks the selected target at level one only on clear and loses it on retreat or failure', () => {
    const offered = getQualifiedOffer();
    const selected = resolveEquipmentLoot(offered, targetEquipmentId);
    const cleared = resolveExit(withBossClearedAtExit(selected));
    const retreated = resolveRetreat(selected);
    const failed = game.resolveRunFailure(selected);

    expect(selected.ownedEquipment).not.toContain(targetEquipmentId);
    expect(selected.run?.lootBag.equipmentIds).toContain(targetEquipmentId);
    expect(game.getCurrentEquipmentHuntStatus(selected)).toMatchObject({
      offer: false,
      selected: true,
      passed: false
    });
    expect(cleared.ownedEquipment).toContain(targetEquipmentId);
    expect(cleared.equipmentLevels[targetEquipmentId]).toBe(1);
    expect(cleared.run?.lastLootSettlement?.retained.equipmentIds).toContain(targetEquipmentId);
    expect(retreated.ownedEquipment).not.toContain(targetEquipmentId);
    expect(retreated.equipmentLevels[targetEquipmentId]).toBeUndefined();
    expect(retreated.run?.lastLootSettlement?.lost.equipmentIds).toContain(targetEquipmentId);
    expect(failed.ownedEquipment).not.toContain(targetEquipmentId);
    expect(failed.equipmentLevels[targetEquipmentId]).toBeUndefined();
    expect(failed.run?.lastLootSettlement?.lost.equipmentIds).toContain(targetEquipmentId);
  });

  it('keeps legacy active runs without a snapshot disabled and never backfills from hub preparation', () => {
    const entered = enterPreparedHunt();
    if (!entered.run) throw new Error('Expected an active equipment hunt run');
    const { equipmentHunt: _equipmentHunt, ...legacyRun } = entered.run;
    const legacy: GameState = { ...entered, run: legacyRun };
    const clued = collectClue(legacy);
    const offered = defeatElite(clued);
    const transported = usePortal(atNode(legacy, 'cracked_portal'), 'force');

    expect(legacy.preparedEquipmentHunt).toEqual({ dungeonId, targetEquipmentId });
    expect(game.getCurrentEquipmentHuntStatus(legacy).enabled).toBe(false);
    expect(offered.run?.pendingEquipmentOffer?.guaranteedEquipmentId).toBeUndefined();
    expect(transported.run?.equipmentHunt).toBeUndefined();
    expect(game.getCurrentEquipmentHuntStatus(transported).enabled).toBe(false);
  });

  it('keeps the no-hunt elite offer baseline byte-for-byte unchanged', () => {
    const entered = enterDungeon(unlockedHub(), dungeonId);
    const expectedOffer = getDungeonLootOffer({
      dungeonId,
      monsterId: 'tower_butcher',
      nodeId: 'butcher_turn',
      ownedEquipmentIds: entered.ownedEquipment,
      carriedEquipmentIds: entered.run?.lootBag.equipmentIds ?? [],
      offersMade: entered.run?.lootOffersMade ?? 0
    });
    const defeated = defeatElite(entered);

    expect(entered.run?.equipmentHunt).toBeUndefined();
    expect(defeated.run?.pendingEquipmentOffer).toEqual(expectedOffer);
    expect(defeated.run?.pendingEquipmentOffer?.guaranteedEquipmentId).toBeUndefined();
    expect(game.getCurrentEquipmentHuntStatus(defeated).enabled).toBe(false);
  });
});

describe('route contract game integration', () => {
  const dungeonId = 'demon_tower_1' as const;
  const definition = game.listRouteContracts(dungeonId)[1];

  function replayHub(): GameState {
    const state = createInitialState();
    return {
      ...state,
      completedDungeonIds: [...DUNGEON_ORDER],
      claimedTaskIds: DUNGEON_ORDER.map((id) => `mainline_clear_${id}`),
      inventory: {
        ...state.inventory,
        cycle_imprint: 3,
        gate_sigil: 3
      }
    };
  }

  function enterContract(protocolId: RunProtocolId = 'standard'): GameState {
    return enterDungeon(replayHub(), dungeonId, protocolId, definition.id);
  }

  function atNode(state: GameState, nodeId: string): GameState {
    if (!state.run) throw new Error('Expected an active dungeon run.');
    return {
      ...state,
      phase: 'explore',
      combat: undefined,
      run: {
        ...state.run,
        currentNodeId: nodeId
      }
    };
  }

  function clearNode(state: GameState, nodeId: string): GameState {
    if (!state.run) throw new Error('Expected an active dungeon run.');
    const node = DUNGEONS[state.run.dungeonId].nodes.find((candidate) => candidate.id === nodeId);
    if (!node) throw new Error(`Missing node ${nodeId}.`);

    const positioned = atNode(state, nodeId);
    if (node.type === 'trap') {
      return handleTrap(
        {
          ...positioned,
          player: { ...positioned.player, hp: 10_000, maxHp: 10_000 }
        },
        'risk'
      );
    }
    if (node.type === 'reward') return collectReward(positioned);
    if (node.type === 'monster') {
      const combat = selectNode(positioned, nodeId);
      if (!combat.combat) throw new Error(`Expected combat at ${nodeId}.`);
      const cleared = performCombatAction(
        {
          ...combat,
          player: { ...combat.player, hp: 10_000, maxHp: 10_000 },
          combat: { ...combat.combat, monsterHp: 1 }
        },
        'attack'
      );
      return cleared.run?.pendingEquipmentOffer ? resolveEquipmentLoot(cleared) : cleared;
    }

    throw new Error(`Node ${nodeId} cannot be used as a route-contract target.`);
  }

  function secureContract(state = enterContract()): GameState {
    return clearNode(clearNode(state, definition.targetNodeIds[0]), definition.targetNodeIds[1]);
  }

  function readyForExit(state: GameState): GameState {
    if (!state.run) throw new Error('Expected an active dungeon run.');
    const protocol = getRunProtocolDefinition(state.run.dungeonId, state.run.protocol?.id ?? 'standard');
    const protocolNodeIds = protocol ? getRunProtocolRequiredNodeIds(protocol) : [];
    const bossNodeId = getBossDefinition(state.run.dungeonId).nodeId;
    const exitNode = DUNGEONS[state.run.dungeonId].nodes.find((node) => node.type === 'exit');
    if (!exitNode) throw new Error('Expected an exit node.');

    return {
      ...state,
      phase: 'explore',
      combat: undefined,
      run: {
        ...state.run,
        currentNodeId: exitNode.id,
        clearedNodeIds: [
          ...new Set([...state.run.clearedNodeIds, ...protocolNodeIds, bossNodeId])
        ]
      }
    };
  }

  function withoutContract(state: GameState): GameState {
    if (!state.run) throw new Error('Expected an active dungeon run.');
    return {
      ...state,
      run: {
        ...state.run,
        routeContractState: undefined,
        lastRouteContractSettlement: undefined
      }
    };
  }

  function withHighPressure(state: GameState): GameState {
    if (!state.run) throw new Error('Expected an active dungeon run.');
    let pressureState = createRunPressureState();
    for (let index = 0; index < 8; index += 1) {
      pressureState = advanceRunPressureOnNodeClear(pressureState);
    }
    return {
      ...state,
      run: {
        ...state.run,
        pressureState
      }
    };
  }

  it('rejects first-clear, unknown, wrong-dungeon, and deep-cost selections atomically while keeping replay selection optional', () => {
    const firstClearHub = createInitialState();
    const firstClear = enterDungeon(firstClearHub, dungeonId, 'standard', definition.id);
    expect(firstClear.phase).toBe('hub');
    expect(firstClear.run).toBeUndefined();
    expect(firstClear.rewardPoints).toBe(firstClearHub.rewardPoints);
    expect(firstClear.inventory).toEqual(firstClearHub.inventory);

    const optional = enterDungeon(replayHub(), dungeonId);
    expect(Object.prototype.hasOwnProperty.call(optional.run, 'routeContractState')).toBe(true);
    expect(game.getCurrentRouteContract(optional)).toMatchObject({
      legacyDisabled: false,
      progress: { enabled: false, status: 'disabled' },
      display: { key: 'disabled' }
    });

    const selected = enterContract();
    expect(selected.run?.routeContractState).toMatchObject({
      contractId: definition.id,
      dungeonId,
      completedTargetCount: 0,
      status: 'active'
    });
    expect(game.getCurrentRouteContract(selected)).toMatchObject({
      legacyDisabled: false,
      definition,
      progress: { enabled: true, status: 'active' },
      display: { key: 'pending_first' }
    });

    const wrongDungeonDefinition = game.listRouteContracts('metro_abyss')[0];
    const unknown = enterDungeon(replayHub(), dungeonId, 'standard', 'unknown_contract');
    const wrongDungeon = enterDungeon(replayHub(), dungeonId, 'standard', wrongDungeonDefinition.id);
    expect(unknown.phase).toBe('hub');
    expect(unknown.run).toBeUndefined();
    expect(wrongDungeon.phase).toBe('hub');
    expect(wrongDungeon.run).toBeUndefined();

    const deepHub = replayHub();
    const deepRejected = enterDungeon(deepHub, dungeonId, 'deep', 'unknown_contract');
    expect(deepRejected.phase).toBe('hub');
    expect(deepRejected.run).toBeUndefined();
    expect(deepRejected.inventory.cycle_imprint).toBe(deepHub.inventory.cycle_imprint);
  });

  it('advances only first clears in order and makes a second-target-first failure irreversible', () => {
    const entered = enterContract();
    const unrelated = clearNode(entered, 'north_supply_niche');
    expect(unrelated.run?.routeContractState).toMatchObject({ status: 'active', completedTargetCount: 0 });

    const afterFirst = clearNode(unrelated, definition.targetNodeIds[0]);
    expect(afterFirst.run?.routeContractState).toMatchObject({ status: 'active', completedTargetCount: 1 });

    const repeatedFirst = clearNode(afterFirst, definition.targetNodeIds[0]);
    expect(repeatedFirst.run?.routeContractState).toBe(afterFirst.run?.routeContractState);

    const secured = clearNode(repeatedFirst, definition.targetNodeIds[1]);
    expect(secured.run?.routeContractState).toMatchObject({ status: 'secured', completedTargetCount: 2 });

    const wrongOrder = clearNode(enterContract(), definition.targetNodeIds[1]);
    expect(wrongOrder.run?.routeContractState).toMatchObject({
      status: 'failed',
      reason: 'out_of_order',
      completedTargetCount: 0
    });
    const irreversible = clearNode(wrongOrder, definition.targetNodeIds[0]);
    expect(irreversible.run?.routeContractState).toBe(wrongOrder.run?.routeContractState);
    const prefailedExit = resolveExit(readyForExit(irreversible));
    expect(prefailedExit.run?.lastRouteContractSettlement).toMatchObject({
      state: { status: 'failed', reason: 'out_of_order', completedTargetCount: 0 },
      rewardPoints: 0,
      rewarded: false
    });
  });

  it.each(['standard', 'imprint', 'deep'] as const)(
    'adds the exact independent bonus after %s protocol, pressure, and directive calculations',
    (protocolId) => {
      const secured = withHighPressure(secureContract(enterContract(protocolId)));
      const baseline = resolveExit(readyForExit(withoutContract(secured)));
      const exited = resolveExit(readyForExit(secured));

      expect(exited.rewardPoints - baseline.rewardPoints).toBe(definition.rewardPoints);
      expect(exited.run?.lastLootSettlement).toEqual(baseline.run?.lastLootSettlement);
      expect(exited.run?.lastProtocolSettlement).toEqual(baseline.run?.lastProtocolSettlement);
      expect(exited.run?.lastPressureSettlement).toEqual(baseline.run?.lastPressureSettlement);
      expect(exited.run?.lastRelicSettlement).toEqual(baseline.run?.lastRelicSettlement);
      expect(exited.claimedDirectiveIds).toEqual(baseline.claimedDirectiveIds);
      expect(exited.run?.lastRouteContractSettlement).toMatchObject({
        state: { contractId: definition.id, status: 'banked', completedTargetCount: 2 },
        rewardPoints: definition.rewardPoints,
        rewarded: true
      });
      expect(exited.lastOutcome).toContain(`routeContractBonus=${definition.rewardPoints}`);
      expect(exited.log[0]).toContain(`独立获得 ${definition.rewardPoints} 奖励点`);
    }
  );

  it('keeps the contract bonus independent when a first-clear directive is also awarded', () => {
    const secured = withHighPressure(secureContract());
    if (!secured.run) throw new Error('Expected a secured route contract.');
    const directiveReady: GameState = {
      ...secured,
      learnedMethods: [...new Set([...secured.learnedMethods, 'mist_breathing' as const])],
      completedDungeonIds: secured.completedDungeonIds.filter((id) => id !== dungeonId),
      run: {
        ...secured.run,
        damageTaken: 0,
        capturedPetIds: ['mist_kitten']
      }
    };
    const baseline = resolveExit(readyForExit(withoutContract(directiveReady)));
    const exited = resolveExit(readyForExit(directiveReady));

    expect(baseline.claimedDirectiveIds).toContain('directive_demon_tower_1');
    expect(exited.claimedDirectiveIds).toEqual(baseline.claimedDirectiveIds);
    expect(exited.rewardPoints - baseline.rewardPoints).toBe(definition.rewardPoints);
  });

  it('settles incomplete exits, retreats, and failures independently with zero reward and exact reasons', () => {
    const afterFirst = clearNode(enterContract(), definition.targetNodeIds[0]);
    const incomplete = resolveExit(readyForExit(afterFirst));
    const retreated = resolveRetreat(afterFirst);
    const failed = game.resolveRunFailure(afterFirst, '测试路线契约失败回收。');

    expect(incomplete.run?.lastRouteContractSettlement).toMatchObject({
      state: { status: 'failed', reason: 'incomplete_exit', completedTargetCount: 1 },
      rewardPoints: 0,
      rewarded: false
    });
    expect(retreated.run?.lastRouteContractSettlement).toMatchObject({
      state: { status: 'lost', reason: 'retreat', completedTargetCount: 1 },
      rewardPoints: 0,
      rewarded: false
    });
    expect(failed.run?.lastRouteContractSettlement).toMatchObject({
      state: { status: 'lost', reason: 'failure', completedTargetCount: 1 },
      rewardPoints: 0,
      rewarded: false
    });
  });

  it('loses a source contract only after a successful cross-dungeon portal and disables it before target clears', () => {
    const entered = secureContract();
    const noSigil = {
      ...entered,
      inventory: { ...entered.inventory, gate_sigil: 0 }
    };
    const portal = atNode(noSigil, 'cracked_portal');
    const blocked = usePortal(portal, 'stabilize');
    expect(blocked.run?.dungeonId).toBe(dungeonId);
    expect(blocked.run?.routeContractState).toMatchObject({ status: 'secured', completedTargetCount: 2 });
    expect(blocked.run?.lastRouteContractSettlement).toBeUndefined();

    const transported = usePortal(portal, 'force');
    expect(transported.run?.dungeonId).toBe('metro_abyss');
    expect(Object.prototype.hasOwnProperty.call(transported.run, 'routeContractState')).toBe(true);
    expect(transported.run?.routeContractState).toBeUndefined();
    expect(transported.run?.lastRouteContractSettlement).toMatchObject({
      state: {
        contractId: definition.id,
        dungeonId,
        status: 'lost',
        reason: 'cross_dungeon',
        completedTargetCount: 2
      },
      rewardPoints: 0,
      rewarded: false
    });
    expect(game.getCurrentRouteContract(transported)).toMatchObject({
      legacyDisabled: false,
      progress: { enabled: false, status: 'disabled' },
      display: { key: 'disabled' },
      lastSettlement: { state: { reason: 'cross_dungeon' }, rewardPoints: 0 }
    });

    const targetNode = DUNGEONS.metro_abyss.nodes.find(
      (node) => node.type === 'reward' || node.type === 'trap' || node.type === 'monster'
    );
    if (!targetNode) throw new Error('Expected a clearable target-dungeon node.');
    const targetCleared = clearNode(transported, targetNode.id);
    expect(targetCleared.run?.routeContractState).toBeUndefined();
    expect(targetCleared.run?.lastRouteContractSettlement).toEqual(
      transported.run?.lastRouteContractSettlement
    );
  });

  it('keeps legacy-missing and malformed run fields disabled without synthesizing contract state', () => {
    const selected = enterContract();
    if (!selected.run) throw new Error('Expected an active route-contract run.');
    const {
      routeContractState: _routeContractState,
      lastRouteContractSettlement: _lastRouteContractSettlement,
      ...legacyRun
    } = selected.run;
    const legacy: GameState = { ...selected, run: legacyRun };
    const legacyCleared = clearNode(legacy, definition.targetNodeIds[0]);
    expect(game.getCurrentRouteContract(legacy)).toMatchObject({
      legacyDisabled: true,
      progress: { enabled: false, status: 'disabled' },
      display: { key: 'disabled' }
    });
    expect(Object.prototype.hasOwnProperty.call(legacyCleared.run, 'routeContractState')).toBe(false);

    const malformedValue = { rulesVersion: 1, contractId: definition.id, status: 'active' };
    const malformed: GameState = {
      ...selected,
      run: {
        ...selected.run,
        routeContractState: malformedValue as unknown as game.RouteContractRunState
      }
    };
    const malformedCleared = clearNode(malformed, definition.targetNodeIds[0]);
    const malformedExit = resolveExit(readyForExit(malformedCleared));
    expect(game.getCurrentRouteContract(malformed)).toMatchObject({
      legacyDisabled: false,
      progress: { enabled: false, status: 'disabled' },
      display: { key: 'disabled' }
    });
    expect(malformedCleared.run?.routeContractState).toBe(malformedValue);
    expect(malformedExit.run?.lastRouteContractSettlement).toBeUndefined();
  });

  it('does not award or replace a settled contract on duplicate exit resolution', () => {
    const exited = resolveExit(readyForExit(secureContract()));
    const rewardPoints = exited.rewardPoints;
    const settlement = exited.run?.lastRouteContractSettlement;
    const repeated = resolveExit(exited);

    expect(repeated.rewardPoints).toBe(rewardPoints);
    expect(repeated.run?.lastRouteContractSettlement).toBe(settlement);
  });
});

describe('equipment memory hunt game integration', () => {
  const dungeonId = 'demon_tower_1' as const;
  const equipmentId = 'armor_piercing_sword' as const;

  function qualifiedHub(
    targetEquipmentId: game.EquipmentMemoryEquipmentId = equipmentId
  ): GameState {
    const state = createInitialState();
    const equipment = EQUIPMENT[targetEquipmentId];
    const attunement = getEquipmentAttunementOptions(targetEquipmentId)[0];
    if (!attunement) throw new Error(`Expected an attunement for ${targetEquipmentId}`);

    return {
      ...state,
      rewardPoints: 20_000,
      lingyun: 20,
      player: { ...state.player, hp: 5_000, maxHp: 5_000 },
      inventory: { ...state.inventory, cycle_imprint: 3 },
      completedDungeonIds: [...DUNGEON_ORDER],
      claimedTaskIds: DUNGEON_ORDER.map((id) => `mainline_clear_${id}`),
      ownedEquipment: [...new Set([...state.ownedEquipment, targetEquipmentId])],
      equipmentLevels: {
        ...state.equipmentLevels,
        [targetEquipmentId]: equipment.maxLevel
      },
      equipmentAttunements: {
        ...(state.equipmentAttunements ?? {}),
        [targetEquipmentId]: attunement.id
      },
      equipmentTemperRanks: {
        ...(state.equipmentTemperRanks ?? {}),
        [targetEquipmentId]: 2
      },
      equipped: {
        ...state.equipped,
        [equipment.slot]: targetEquipmentId
      },
      equipmentMemories: {}
    };
  }

  function prepareMemoryHunt(state = qualifiedHub()): GameState {
    return game.prepareEquipmentMemoryHunt(state, dungeonId, equipmentId);
  }

  function enterMemoryHunt(state = prepareMemoryHunt()): GameState {
    return enterDungeon(state, dungeonId);
  }

  function withCurrentNode(state: GameState, nodeId: string): GameState {
    if (!state.run) throw new Error('Expected an active run');
    return {
      ...state,
      phase: 'explore',
      combat: undefined,
      run: { ...state.run, currentNodeId: nodeId }
    };
  }

  function atDungeonEvent(state: GameState, eventId: string): GameState {
    for (const node of DUNGEONS[dungeonId].nodes) {
      const candidate = withCurrentNode(state, node.id);
      if (game.getAvailableDungeonEvents(candidate).some((event) => event.id === eventId)) {
        return candidate;
      }
    }
    throw new Error(`Could not locate dungeon event ${eventId}`);
  }

  function clearMemoryTarget(state: GameState): GameState {
    const definition = game.getEquipmentMemoryForDungeon(dungeonId);
    if (!definition) throw new Error('Expected equipment memory definition');
    return handleTrap(withCurrentNode(state, definition.nodeId), 'risk');
  }

  function secureMemoryHunt(state: GameState): GameState {
    if (!state.run?.equipmentMemoryHunt) throw new Error('Expected an equipment memory hunt');
    const afterNode = game.transitionEquipmentMemoryHuntNodeClear(
      state.run.equipmentMemoryHunt,
      state.run.equipmentMemoryHunt.nodeId
    );
    const secured = game.transitionEquipmentMemoryHuntEventOutcome(
      afterNode,
      state.run.equipmentMemoryHunt.eventId,
      { success: true }
    );
    if (!secured) throw new Error('Expected a secured equipment memory hunt');
    return { ...state, run: { ...state.run, equipmentMemoryHunt: secured } };
  }

  function failMemoryEvent(state: GameState): GameState {
    if (!state.run?.equipmentMemoryHunt) throw new Error('Expected an equipment memory hunt');
    const failed = game.transitionEquipmentMemoryHuntEventOutcome(
      state.run.equipmentMemoryHunt,
      state.run.equipmentMemoryHunt.eventId,
      { success: false }
    );
    if (!failed) throw new Error('Expected a failed equipment memory hunt');
    return { ...state, run: { ...state.run, equipmentMemoryHunt: failed } };
  }

  function readyForExit(state: GameState): GameState {
    if (!state.run) throw new Error('Expected an active run');
    const dungeon = DUNGEONS[state.run.dungeonId];
    const exitNode = dungeon.nodes.find((node) => node.type === 'exit');
    if (!exitNode) throw new Error('Expected an exit node');
    return {
      ...state,
      phase: 'explore',
      combat: undefined,
      run: {
        ...state.run,
        currentNodeId: exitNode.id,
        clearedNodeIds: dungeon.nodes
          .filter((node) => node.type !== 'exit')
          .map((node) => node.id),
        pendingEquipmentOffer: undefined
      }
    };
  }

  function withoutMemoryHunt(state: GameState): GameState {
    if (!state.run) return state;
    const run = { ...state.run };
    delete run.equipmentMemoryHunt;
    delete run.lastEquipmentMemoryHuntSettlement;
    return { ...state, run };
  }

  function memoryEnabledHub(
    memoryId = game.getEquipmentMemoryForDungeon(dungeonId)?.id,
    equipmentIds: readonly game.EquipmentMemoryEquipmentId[] = [equipmentId]
  ): GameState {
    if (!memoryId) throw new Error('Expected equipment memory id');
    let state = qualifiedHub(equipmentIds[0]);
    const equipmentMemories: game.EquipmentMemoryMap = {};
    for (const id of equipmentIds) {
      const equipment = EQUIPMENT[id];
      state = {
        ...state,
        ownedEquipment: [...new Set([...state.ownedEquipment, id])],
        equipped: { ...state.equipped, [equipment.slot]: id }
      };
      (equipmentMemories as Partial<Record<EquipmentId, game.EquipmentMemoryEntry>>)[id] = {
        unlockedIds: [memoryId],
        activeId: memoryId
      };
    }
    return { ...state, equipmentMemories };
  }

  function startMemoryCombat(state: GameState): GameState {
    const entered = enterDungeon(state, dungeonId);
    const monsterNode = DUNGEONS[dungeonId].nodes.find(
      (node) => node.type === 'monster' && node.monsterId !== 'tower_butcher'
    );
    if (!monsterNode) throw new Error('Expected a regular monster node');
    const started = selectNode(withCurrentNode(entered, monsterNode.id), monsterNode.id);
    if (!started.combat) throw new Error('Expected combat');
    return {
      ...started,
      player: { ...started.player, hp: 5_000, maxHp: 5_000 },
      combat: { ...started.combat, monsterHp: 10_000 }
    };
  }

  it('reports every preparation gate and keeps failed preparation atomic', () => {
    const ready = qualifiedHub();
    const readyStatus = game.getEquipmentMemoryHuntPreparationStatus(ready, dungeonId);
    expect(readyStatus.definition?.id).toBe('equipment_memory_demon_tower_1');
    expect(readyStatus.targetEquipmentIds).toContain(equipmentId);
    expect(readyStatus.candidates).toHaveLength(56);

    const candidateCodes = (state: GameState) =>
      game.getEquipmentMemoryHuntPreparationStatus(state, dungeonId)
        .candidates.find((candidate) => candidate.equipmentId === equipmentId)
        ?.unavailableReasons.map((reason) => reason.code) ?? [];
    const baseEquipment = EQUIPMENT[equipmentId];
    const variants: Array<[GameState, game.EquipmentMemoryHuntPreparationIssueCode]> = [
      [{ ...ready, completedDungeonIds: [] }, 'chapter_not_completed'],
      [{ ...ready, ownedEquipment: ready.ownedEquipment.filter((id) => id !== equipmentId) }, 'not_owned'],
      [{ ...ready, equipped: { ...ready.equipped, weapon: 'training_blade' } }, 'not_equipped'],
      [{ ...ready, equipmentLevels: { ...ready.equipmentLevels, [equipmentId]: 1 } }, 'not_max_level'],
      [{ ...ready, equipmentAttunements: { ...ready.equipmentAttunements, [equipmentId]: undefined } }, 'invalid_attunement'],
      [{ ...ready, equipmentTemperRanks: { ...ready.equipmentTemperRanks, [equipmentId]: 1 } }, 'temper_rank_too_low'],
      [{
        ...ready,
        equipmentCommission: {
          rulesVersion: 1,
          equipmentIds: [equipmentId, 'bone_spear'],
          targetMaterialId: 'demon_bone',
          completedDungeonIds: []
        }
      }, 'sealed'],
      [{
        ...ready,
        equipmentMemories: {
          [equipmentId]: {
            unlockedIds: ['equipment_memory_demon_tower_1'],
            activeId: 'equipment_memory_demon_tower_1'
          }
        }
      }, 'already_unlocked']
    ];
    expect(baseEquipment.maxLevel).toBe(3);
    for (const [state, code] of variants) expect(candidateCodes(state)).toContain(code);

    const before = prepareMemoryHunt(ready);
    const failed = game.prepareEquipmentMemoryHunt(before, dungeonId, 'training_blade');
    expect(failed.preparedEquipmentMemoryHunt).toEqual(before.preparedEquipmentMemoryHunt);
    expect(failed.rewardPoints).toBe(before.rewardPoints);
    expect(failed.lingyun).toBe(before.lingyun);
    expect(failed.inventory).toBe(before.inventory);
  });

  it('keeps ordinary and memory hunts mutually exclusive without touching route contracts', () => {
    const ready = qualifiedHub();
    const ordinaryTarget = game.getEquipmentHuntPreparationStatus(ready, dungeonId).targetEquipmentIds[0];
    if (!ordinaryTarget) throw new Error('Expected ordinary equipment hunt target');
    const ordinaryPrepared = game.prepareEquipmentHunt(ready, dungeonId, ordinaryTarget);
    const blockedMemory = game.prepareEquipmentMemoryHunt(ordinaryPrepared, dungeonId, equipmentId);
    expect(blockedMemory.preparedEquipmentHunt).toEqual(ordinaryPrepared.preparedEquipmentHunt);
    expect(blockedMemory.preparedEquipmentMemoryHunt).toBeUndefined();
    expect(blockedMemory.log[0]).toContain('不能并行');

    const memoryPrepared = prepareMemoryHunt(ready);
    const blockedOrdinary = game.prepareEquipmentHunt(memoryPrepared, dungeonId, ordinaryTarget);
    expect(blockedOrdinary.preparedEquipmentMemoryHunt).toEqual(memoryPrepared.preparedEquipmentMemoryHunt);
    expect(blockedOrdinary.preparedEquipmentHunt).toBeUndefined();
    expect(blockedOrdinary.log[0]).toContain('不能并行');

    const contract = game.ROUTE_CONTRACT_CATALOG.find((entry) => entry.dungeonId === dungeonId);
    if (!contract) throw new Error('Expected route contract');
    const entered = enterDungeon(memoryPrepared, dungeonId, 'standard', contract.id);
    expect(entered.run?.equipmentMemoryHunt?.status).toBe('active');
    expect(entered.run?.routeContractState?.contractId).toBe(contract.id);
  });

  it('activates only unlocked memories on owned gear for free and idempotently', () => {
    const state = qualifiedHub();
    const memories: game.EquipmentMemoryMap = {
      [equipmentId]: {
        unlockedIds: [
          'equipment_memory_demon_tower_1',
          'equipment_memory_metro_abyss'
        ],
        activeId: 'equipment_memory_demon_tower_1'
      }
    };
    const unlocked = { ...state, equipmentMemories: memories };
    const activated = game.activateOwnedEquipmentMemory(
      unlocked,
      equipmentId,
      'equipment_memory_metro_abyss'
    );
    expect(activated.equipmentMemories?.[equipmentId]?.activeId).toBe('equipment_memory_metro_abyss');
    expect(activated.rewardPoints).toBe(unlocked.rewardPoints);
    expect(activated.lingyun).toBe(unlocked.lingyun);
    expect(activated.inventory).toBe(unlocked.inventory);
    expect(game.activateOwnedEquipmentMemory(
      activated,
      equipmentId,
      'equipment_memory_metro_abyss'
    )).toBe(activated);

    const illegal = game.activateOwnedEquipmentMemory(
      activated,
      equipmentId,
      'equipment_memory_starfall_mine'
    );
    expect(illegal.equipmentMemories).toBe(activated.equipmentMemories);
    const unowned = game.activateOwnedEquipmentMemory(
      { ...activated, ownedEquipment: activated.ownedEquipment.filter((id) => id !== equipmentId) },
      equipmentId,
      'equipment_memory_demon_tower_1'
    );
    expect(unowned.equipmentMemories).toBe(activated.equipmentMemories);
  });

  it('rejects stale or conflicting memory preparation before deep cost and freezes every entry snapshot', () => {
    const prepared = prepareMemoryHunt();
    const stale: GameState = {
      ...prepared,
      equipped: { ...prepared.equipped, weapon: 'training_blade' }
    };
    const staleCount = stale.inventory.cycle_imprint;
    const blocked = enterDungeon(stale, dungeonId, 'deep');
    expect(blocked.run).toBeUndefined();
    expect(blocked.inventory.cycle_imprint).toBe(staleCount);
    expect(blocked.log[0]).toContain('记忆狩猎准备已失效');

    const ordinaryTarget = game.getEquipmentHuntPreparationStatus(prepared, dungeonId).targetEquipmentIds[0];
    if (!ordinaryTarget) throw new Error('Expected ordinary hunt target');
    const conflicting = {
      ...prepared,
      preparedEquipmentHunt: { dungeonId, targetEquipmentId: ordinaryTarget }
    };
    const conflictBlocked = enterDungeon(conflicting, dungeonId, 'deep');
    expect(conflictBlocked.run).toBeUndefined();
    expect(conflictBlocked.inventory.cycle_imprint).toBe(prepared.inventory.cycle_imprint);

    const empty = enterDungeon(qualifiedHub(), dungeonId);
    expect(empty.run?.equipmentMemorySnapshot).toEqual({ rulesVersion: 1, activeEntries: [] });

    const active = memoryEnabledHub();
    const entered = enterDungeon(active, dungeonId);
    expect(entered.run?.equipmentMemorySnapshot?.activeEntries).toEqual([
      { equipmentId, memoryId: 'equipment_memory_demon_tower_1' }
    ]);
    const changed = {
      ...entered,
      equipped: { ...entered.equipped, weapon: 'training_blade' },
      equipmentMemories: {
        [equipmentId]: {
          unlockedIds: ['equipment_memory_metro_abyss'] as const,
          activeId: 'equipment_memory_metro_abyss' as const
        }
      }
    };
    expect(changed.run?.equipmentMemorySnapshot).toBe(entered.run?.equipmentMemorySnapshot);
    expect(game.getEquipmentMemoryRunSnapshotMatch(
      changed.run?.equipmentMemorySnapshot,
      dungeonId
    )?.matched).toBe(true);
  });

  it('accepts target clear and successful event in either order and ignores unrelated or repeated signals', () => {
    const base = enterMemoryHunt(prepareMemoryHunt({
      ...qualifiedHub(),
      learnedMethods: ['mist_breathing'],
      player: {
        ...qualifiedHub().player,
        base: { body: 20, spirit: 20, agility: 20, luck: 20 },
        hp: 5_000,
        maxHp: 5_000
      }
    }));
    const definition = game.getEquipmentMemoryForDungeon(dungeonId);
    if (!definition) throw new Error('Expected equipment memory definition');

    const eventFirst = game.resolveDungeonEvent(
      atDungeonEvent(base, definition.eventId),
      definition.eventId,
      'breathe_through_runes'
    );
    expect(eventFirst.run?.equipmentMemoryHunt?.eventSucceeded).toBe(true);
    const eventThenNode = clearMemoryTarget(eventFirst);
    expect(eventThenNode.run?.equipmentMemoryHunt?.status).toBe('secured');

    const nodeFirst = clearMemoryTarget(base);
    expect(nodeFirst.run?.equipmentMemoryHunt?.nodeCleared).toBe(true);
    const nodeThenEvent = game.resolveDungeonEvent(
      atDungeonEvent(nodeFirst, definition.eventId),
      definition.eventId,
      'breathe_through_runes'
    );
    expect(nodeThenEvent.run?.equipmentMemoryHunt?.status).toBe('secured');

    const rewardNode = DUNGEONS[dungeonId].nodes.find(
      (node) => node.type === 'reward' && node.id !== definition.nodeId
    );
    if (!rewardNode) throw new Error('Expected unrelated reward node');
    const unrelated = collectReward(withCurrentNode(base, rewardNode.id));
    expect(unrelated.run?.equipmentMemoryHunt).toEqual(base.run?.equipmentMemoryHunt);
    const once = clearMemoryTarget(base);
    const repeated = clearMemoryTarget(once);
    expect(repeated.run?.equipmentMemoryHunt).toEqual(once.run?.equipmentMemoryHunt);
  });

  it('makes a failed target event permanent while other event outcomes do not affect the hunt', () => {
    const base = enterMemoryHunt();
    const definition = game.getEquipmentMemoryForDungeon(dungeonId);
    if (!definition) throw new Error('Expected equipment memory definition');
    const failed = game.resolveDungeonEvent(
      atDungeonEvent(base, definition.eventId),
      definition.eventId,
      'send_pet_first'
    );
    expect(failed.run?.equipmentMemoryHunt?.status).toBe('failed');
    expect(failed.run?.equipmentMemoryHunt?.reason).toBe('event_failure');
    const repeated = game.resolveDungeonEvent(
      atDungeonEvent({
        ...failed,
        run: failed.run ? { ...failed.run, resolvedEventIds: [] } : failed.run
      }, definition.eventId),
      definition.eventId,
      'breathe_through_runes'
    );
    expect(repeated.run?.equipmentMemoryHunt).toEqual(failed.run?.equipmentMemoryHunt);

    let unrelatedState = base;
    let unrelatedEventId: string | undefined;
    for (const node of DUNGEONS[dungeonId].nodes) {
      const candidate = withCurrentNode(unrelatedState, node.id);
      const unrelatedEvent = game.getAvailableDungeonEvents(candidate)
        .find((event) => event.id !== definition.eventId);
      if (!unrelatedEvent) continue;
      unrelatedState = candidate;
      unrelatedEventId = unrelatedEvent.id;
      break;
    }
    if (unrelatedEventId) {
      const event = game.getAvailableDungeonEvents(unrelatedState)
        .find((candidate) => candidate.id === unrelatedEventId);
      const option = event?.options[0];
      if (!option) throw new Error('Expected unrelated event option');
      const resolved = game.resolveDungeonEvent(unrelatedState, unrelatedEventId, option.id);
      expect(resolved.run?.equipmentMemoryHunt).toEqual(base.run?.equipmentMemoryHunt);
    }
  });

  it('banks only the target gear, auto-activates it, grants no extra economy, and is idempotent', () => {
    const otherMemory = {
      unlockedIds: ['equipment_memory_metro_abyss'] as const,
      activeId: 'equipment_memory_metro_abyss' as const
    };
    const entered = enterMemoryHunt(prepareMemoryHunt({
      ...qualifiedHub(),
      equipmentMemories: { bone_spear: otherMemory }
    }));
    const secured = readyForExit(secureMemoryHunt(entered));
    const baseline = resolveExit(readyForExit(withoutMemoryHunt(entered)));
    const exited = resolveExit(secured);
    expect(exited.equipmentMemories?.[equipmentId]).toEqual({
      unlockedIds: ['equipment_memory_demon_tower_1'],
      activeId: 'equipment_memory_demon_tower_1'
    });
    expect(exited.equipmentMemories?.bone_spear).toEqual(otherMemory);
    expect(exited.preparedEquipmentMemoryHunt).toBeUndefined();
    expect(exited.run?.lastEquipmentMemoryHuntSettlement?.granted).toBe(true);
    expect(exited.run?.equipmentMemoryHunt?.status).toBe('banked');
    expect(exited.rewardPoints).toBe(baseline.rewardPoints);
    expect(exited.lingyun).toBe(baseline.lingyun);
    expect(exited.inventory).toEqual(baseline.inventory);
    expect(exited.lastOutcome).toContain('equipmentMemoryGranted=1');
    expect(exited.log[0]).toContain('自动激活');

    const memoryMap = exited.equipmentMemories;
    const repeated = resolveExit(exited);
    expect(repeated.equipmentMemories).toBe(memoryMap);
    expect(repeated.run?.lastEquipmentMemoryHuntSettlement).toBe(
      exited.run?.lastEquipmentMemoryHuntSettlement
    );
  });

  it('settles incomplete, prefailed, retreat, and failure without granting or clearing preparation', () => {
    const active = enterMemoryHunt();
    const incomplete = resolveExit(readyForExit(active));
    expect(incomplete.run?.equipmentMemoryHunt).toMatchObject({
      status: 'failed',
      reason: 'incomplete_exit'
    });
    expect(incomplete.run?.lastEquipmentMemoryHuntSettlement?.granted).toBe(false);
    expect(incomplete.equipmentMemories).toEqual({});
    expect(incomplete.preparedEquipmentMemoryHunt).toBeDefined();

    const prefailed = resolveExit(readyForExit(failMemoryEvent(active)));
    expect(prefailed.run?.equipmentMemoryHunt).toMatchObject({
      status: 'failed',
      reason: 'event_failure'
    });
    expect(prefailed.equipmentMemories).toEqual({});

    const retreated = resolveRetreat(active);
    expect(retreated.run?.equipmentMemoryHunt).toMatchObject({ status: 'lost', reason: 'retreat' });
    expect(retreated.run?.lastEquipmentMemoryHuntSettlement?.granted).toBe(false);
    expect(retreated.equipmentMemories).toEqual({});
    expect(retreated.preparedEquipmentMemoryHunt).toBeDefined();
    expect(retreated.lastOutcome).toContain('equipmentMemoryReason=retreat');

    const failed = game.resolveRunFailure(active, '测试铭刻记忆失败回收。');
    expect(failed.run?.equipmentMemoryHunt).toMatchObject({ status: 'lost', reason: 'failure' });
    expect(failed.equipmentMemories).toEqual({});
    expect(failed.lastOutcome).toContain('equipmentMemoryReason=failure');
  });

  it('loses active or secured hunts across dungeons, preserves snapshots, and keeps same-dungeon progress', () => {
    const portalNode = DUNGEONS[dungeonId].nodes.find((node) => node.type === 'portal' && node.portal);
    if (!portalNode?.portal) throw new Error('Expected portal');
    for (const source of [enterMemoryHunt(), secureMemoryHunt(enterMemoryHunt())]) {
      const snapshot = source.run?.equipmentMemorySnapshot;
      const transported = usePortal(withCurrentNode(source, portalNode.id), 'force');
      expect(transported.run?.dungeonId).not.toBe(dungeonId);
      expect(transported.run?.equipmentMemoryHunt).toBeUndefined();
      expect(transported.run?.lastEquipmentMemoryHuntSettlement?.state).toMatchObject({
        status: 'lost',
        reason: 'cross_dungeon',
        dungeonId
      });
      expect(transported.run?.equipmentMemorySnapshot).toBe(snapshot);
      expect(transported.equipmentMemories).toEqual({});
    }

    const sameDungeonSource = clearMemoryTarget(enterMemoryHunt());
    const originalPortal = portalNode.portal;
    portalNode.portal = {
      ...originalPortal,
      targetDungeonId: dungeonId,
      targetNodeId: DUNGEONS[dungeonId].grid.startNodeId
    };
    try {
      const transported = usePortal(withCurrentNode(sameDungeonSource, portalNode.id), 'force');
      expect(transported.run?.dungeonId).toBe(dungeonId);
      expect(transported.run?.equipmentMemoryHunt).toEqual(
        sameDungeonSource.run?.equipmentMemoryHunt
      );
      expect(transported.run?.lastEquipmentMemoryHuntSettlement).toBeUndefined();
      expect(transported.run?.equipmentMemorySnapshot).toBe(
        sameDungeonSource.run?.equipmentMemorySnapshot
      );
    } finally {
      portalNode.portal = originalPortal;
    }
  });

  it('safely disables legacy and malformed run or combat evidence', () => {
    const entered = enterDungeon(memoryEnabledHub(), dungeonId);
    if (!entered.run) throw new Error('Expected run');
    const legacyRun = { ...entered.run };
    delete legacyRun.equipmentMemorySnapshot;
    delete legacyRun.equipmentMemoryHunt;
    const legacy = { ...entered, run: legacyRun };
    expect(game.getCurrentEquipmentMemoryHuntStatus(legacy)).toMatchObject({
      enabled: false,
      legacyDisabled: true
    });
    expect(game.getCurrentEquipmentMemoryCombatStatus(legacy)).toMatchObject({
      enabled: false,
      legacyDisabled: true
    });

    const malformed = {
      ...entered,
      run: {
        ...entered.run,
        equipmentMemorySnapshot: { rulesVersion: 999, activeEntries: [] },
        equipmentMemoryHunt: { status: 'secured' }
      },
      combat: {
        nodeId: 'broken',
        monsterId: 'fog_lesser_demon' as const,
        monsterHp: 1,
        turn: 1,
        guarding: false,
        equipmentMemoryState: { rulesVersion: 999 },
        log: []
      }
    } as unknown as GameState;
    expect(() => game.getCurrentEquipmentMemoryHuntStatus(malformed)).not.toThrow();
    expect(game.getCurrentEquipmentMemoryHuntStatus(malformed)).toMatchObject({
      enabled: false,
      malformedDisabled: true
    });
    expect(game.getCurrentEquipmentMemoryCombatStatus(malformed)).toMatchObject({
      enabled: false,
      malformedDisabled: true
    });
  });

  it('stores regular and recommended overflow, restores once after a surviving weapon skill, and logs both', () => {
    const started = startMemoryCombat(memoryEnabledHub());
    if (!started.combat) throw new Error('Expected combat');
    const regular = performCombatAction({
      ...started,
      combat: { ...started.combat, weaponFocus: 3 }
    }, 'attack');
    expect(game.getCurrentEquipmentMemoryCombatStatus(regular)).toMatchObject({
      enabled: true,
      overflowStored: true,
      restored: false,
      activeName: '血阶余息'
    });
    expect(regular.combat?.log.join('')).toContain('暂存 1 点溢出战意');

    const recommendedStart = {
      ...started,
      combat: { ...started.combat, weaponFocus: 2 as const }
    };
    const intent = game.getCurrentCombatIntent(recommendedStart);
    if (!intent) throw new Error('Expected combat intent');
    const recommended = performCombatAction(
      recommendedStart,
      intent.recommendedActions[0] as game.CombatAction
    );
    expect(game.getCurrentEquipmentMemoryCombatStatus(recommended).overflowStored).toBe(true);

    if (!regular.combat) throw new Error('Expected continuing combat');
    const restored = performCombatAction({
      ...regular,
      combat: { ...regular.combat, weaponFocus: 3, monsterHp: 10_000 }
    }, 'weapon_skill');
    expect(restored.combat?.weaponFocus).toBe(1);
    expect(game.getCurrentEquipmentMemoryCombatStatus(restored)).toMatchObject({
      overflowStored: false,
      restored: true
    });
    expect(restored.combat?.log.join('')).toContain('武器技后恢复 1 点战意');

    if (!restored.combat) throw new Error('Expected continuing combat after weapon skill');
    const cannotStoreAgain = performCombatAction({
      ...restored,
      combat: { ...restored.combat, weaponFocus: 3, monsterHp: 10_000 }
    }, 'attack');
    expect(game.getCurrentEquipmentMemoryCombatStatus(cannotStoreAgain)).toMatchObject({
      overflowStored: false,
      restored: true
    });
  });

  it('does not restore on a killing weapon skill and disables nonmatching memories', () => {
    const started = startMemoryCombat(memoryEnabledHub());
    if (!started.combat) throw new Error('Expected combat');
    const stored = performCombatAction({
      ...started,
      combat: { ...started.combat, weaponFocus: 3, monsterHp: 10_000 }
    }, 'attack');
    if (!stored.combat) throw new Error('Expected stored combat memory');
    const killed = performCombatAction({
      ...stored,
      combat: { ...stored.combat, weaponFocus: 3, monsterHp: 1 }
    }, 'weapon_skill');
    expect(killed.combat).toBeUndefined();
    expect(killed.log.join('')).not.toContain('武器技后恢复 1 点战意');

    const nonmatching = startMemoryCombat(memoryEnabledHub('equipment_memory_metro_abyss'));
    expect(nonmatching.combat?.equipmentMemoryState).toBeUndefined();
    expect(game.getCurrentEquipmentMemoryCombatStatus(nonmatching).enabled).toBe(false);
  });

  it('collapses multiple matching gear memories to one combat effect', () => {
    const started = startMemoryCombat(memoryEnabledHub(
      'equipment_memory_demon_tower_1',
      [equipmentId, 'mist_hood']
    ));
    const status = game.getCurrentEquipmentMemoryCombatStatus(started);
    expect(status.snapshotMatch?.entries).toHaveLength(2);
    expect(status.snapshotMatch?.effectCount).toBe(1);
    if (!started.combat) throw new Error('Expected combat');
    const stored = performCombatAction({
      ...started,
      combat: { ...started.combat, weaponFocus: 3, monsterHp: 10_000 }
    }, 'attack');
    expect(stored.combat?.log.filter((line) => line.includes('暂存 1 点溢出战意'))).toHaveLength(1);
  });
});

describe('companion roster and combat integration', () => {
  function fundedCompanionHub(): GameState {
    const initial = createInitialState();
    return {
      ...initial,
      rewardPoints: 10_000,
      lingyun: 20,
      inventory: {
        ...initial.inventory,
        demon_bone: 10,
        method_page: 10,
        medicine_ash: 10
      },
      completedDungeonIds: [...DUNGEON_ORDER],
      claimedTaskIds: DUNGEON_ORDER.map((dungeonId) => `mainline_clear_${dungeonId}`)
    };
  }

  function companionHub(
    companionId: game.CompanionId,
    rank: game.CompanionRank = 1
  ): GameState {
    return {
      ...fundedCompanionHub(),
      ownedCompanions: [companionId],
      companionRanks: { [companionId]: rank },
      activeCompanion: companionId
    };
  }

  function startCompanionCombat(
    companionId: game.CompanionId,
    rank: game.CompanionRank = 1,
    nodeId = 'fog_lesser_demon'
  ): GameState {
    const entered = enterDungeon(companionHub(companionId, rank), 'demon_tower_1');
    if (!entered.run) throw new Error('Expected companion run');
    return selectNode({
      ...entered,
      phase: 'explore',
      combat: undefined,
      run: { ...entered.run, currentNodeId: nodeId }
    }, nodeId);
  }

  it('gates and charges all three recruits exactly, creates R1, and defaults the first active slot', () => {
    for (const definition of game.COMPANION_CATALOG) {
      const funded = fundedCompanionHub();
      const locked: GameState = {
        ...funded,
        completedDungeonIds: funded.completedDungeonIds.filter(
          (dungeonId) => dungeonId !== definition.unlockDungeonId
        )
      };
      expect(game.recruitCompanion(locked, definition.id)).toBe(locked);

      const poor: GameState = { ...funded, rewardPoints: definition.recruitCost.rewardPoints! - 1 };
      expect(game.recruitCompanion(poor, definition.id)).toBe(poor);

      const recruited = game.recruitCompanion(funded, definition.id);
      expect(recruited.ownedCompanions).toEqual([definition.id]);
      expect(recruited.companionRanks[definition.id]).toBe(1);
      expect(recruited.activeCompanion).toBe(definition.id);
      expect(recruited.rewardPoints).toBe(funded.rewardPoints - definition.recruitCost.rewardPoints!);
      expect(recruited.lingyun).toBe(funded.lingyun - definition.recruitCost.lingyun!);
      expect(recruited.inventory[definition.trainingMaterial]).toBe(
        funded.inventory[definition.trainingMaterial] - definition.recruitCost.items![definition.trainingMaterial]!
      );
      expect(game.recruitCompanion(recruited, definition.id)).toBe(recruited);
    }
  });

  it('upgrades every companion through exact R2/R3 costs, caps R3, and activates only owned companions in hub', () => {
    for (const definition of game.COMPANION_CATALOG) {
      const rankOne = companionHub(definition.id);
      const rankTwoCost = game.getCompanionUpgradeCost(definition.id, 2)!;
      const rankTwo = game.upgradeCompanion(rankOne, definition.id);
      expect(rankTwo.companionRanks[definition.id]).toBe(2);
      expect(rankTwo.rewardPoints).toBe(rankOne.rewardPoints - rankTwoCost.rewardPoints!);
      expect(rankTwo.lingyun).toBe(rankOne.lingyun - rankTwoCost.lingyun!);
      expect(rankTwo.inventory[definition.trainingMaterial]).toBe(
        rankOne.inventory[definition.trainingMaterial] - rankTwoCost.items![definition.trainingMaterial]!
      );

      const rankThreeCost = game.getCompanionUpgradeCost(definition.id, 3)!;
      const rankThree = game.upgradeCompanion(rankTwo, definition.id);
      expect(rankThree.companionRanks[definition.id]).toBe(3);
      expect(rankThree.rewardPoints).toBe(rankTwo.rewardPoints - rankThreeCost.rewardPoints!);
      expect(rankThree.lingyun).toBe(rankTwo.lingyun - rankThreeCost.lingyun!);
      expect(game.upgradeCompanion(rankThree, definition.id)).toBe(rankThree);
    }

    const roster: GameState = {
      ...fundedCompanionHub(),
      ownedCompanions: ['qin_che', 'zhou_yingxue'],
      companionRanks: { qin_che: 1, zhou_yingxue: 1 },
      activeCompanion: 'qin_che'
    };
    const activated = game.activateCompanion(roster, 'zhou_yingxue');
    expect(activated.activeCompanion).toBe('zhou_yingxue');
    expect(game.activateCompanion(activated, 'lu_guanlan')).toBe(activated);

    const inRun = enterDungeon(activated, 'demon_tower_1');
    expect(game.activateCompanion(inRun, 'qin_che')).toBe(inRun);
    expect(game.upgradeCompanion(inRun, 'zhou_yingxue')).toBe(inRun);
    expect(game.recruitCompanion(inRun, 'lu_guanlan')).toBe(inRun);
  });

  it('freezes active identity and rank on entry, omits empty snapshots, and preserves the source snapshot through portals', () => {
    const emptyEntry = enterDungeon(fundedCompanionHub(), 'demon_tower_1');
    expect(emptyEntry.run).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(emptyEntry.run, 'companionSnapshot')).toBe(false);

    const entered = enterDungeon(companionHub('qin_che', 1), 'demon_tower_1');
    const snapshot = entered.run?.companionSnapshot;
    expect(snapshot).toEqual({ rulesVersion: 1, companionId: 'qin_che', rank: 1 });

    const changedRoster: GameState = {
      ...entered,
      ownedCompanions: ['qin_che', 'zhou_yingxue'],
      companionRanks: { qin_che: 3, zhou_yingxue: 3 },
      activeCompanion: 'zhou_yingxue',
      run: entered.run ? { ...entered.run, currentNodeId: 'cracked_portal' } : entered.run
    };
    const transported = usePortal(changedRoster, 'force');
    expect(transported.run?.dungeonId).not.toBe('demon_tower_1');
    expect(transported.run?.companionSnapshot).toBe(snapshot);
  });

  it('keeps missing or malformed run snapshots legacy-disabled and leaves illegal assist calls unchanged', () => {
    const started = startCompanionCombat('qin_che');
    if (!started.run) throw new Error('Expected companion run');
    const legacyRun = { ...started.run };
    delete legacyRun.companionSnapshot;
    const legacy: GameState = { ...started, run: legacyRun };
    expect(game.getCurrentCompanionAssistStatus(legacy)).toMatchObject({
      legacyDisabled: true,
      available: false,
      reason: 'legacy_disabled'
    });
    expect(game.useCompanionAssist(legacy)).toBe(legacy);

    const malformed: GameState = {
      ...started,
      run: {
        ...started.run,
        companionSnapshot: { rulesVersion: 1, companionId: 'qin_che', rank: 4 } as never
      }
    };
    expect(game.getCurrentCompanionAssistStatus(malformed).legacyDisabled).toBe(true);
    expect(game.useCompanionAssist(malformed)).toBe(malformed);

    const exploring: GameState = { ...started, phase: 'explore', combat: undefined };
    expect(game.getCurrentCompanionAssistStatus(exploring).reason).toBe('not_in_combat');
    expect(game.useCompanionAssist(exploring)).toBe(exploring);
  });

  it.each([
    ['qin_che', 1, true, 0, 0],
    ['qin_che', 2, true, 1, 0],
    ['qin_che', 3, true, 1, 8],
    ['zhou_yingxue', 1, false, 1, 0],
    ['zhou_yingxue', 2, false, 2, 0],
    ['zhou_yingxue', 3, false, 3, 0],
    ['lu_guanlan', 1, false, 0, 12],
    ['lu_guanlan', 2, false, 0, 18],
    ['lu_guanlan', 3, false, 0, 25]
  ] as const)('applies %s R%s once without spending a turn or touching monster hp', (
    companionId,
    rank,
    guarding,
    focusGain,
    healPercent
  ) => {
    const started = startCompanionCombat(companionId, rank);
    if (!started.combat) throw new Error('Expected companion combat');
    const prepared: GameState = {
      ...started,
      player: { ...started.player, hp: 1 },
      combat: { ...started.combat, weaponFocus: 0 }
    };
    const used = game.useCompanionAssist(prepared);
    expect(used.combat?.turn).toBe(prepared.combat?.turn);
    expect(used.combat?.monsterHp).toBe(prepared.combat?.monsterHp);
    expect(used.combat?.guarding).toBe(guarding);
    expect(used.combat?.weaponFocus).toBe(Math.min(3, focusGain));
    expect(used.player.hp).toBe(Math.min(
      prepared.player.maxHp,
      1 + Math.ceil((prepared.player.maxHp * healPercent) / 100)
    ));
    expect(used.combat?.companionAssistUsed).toBe(true);
    expect(used.combat?.log[0]).toContain(game.getCompanionDefinition(companionId)!.name);
    expect(used.log[0]).toContain(game.getCompanionDefinition(companionId)!.name);
  });

  it('clamps focus and healing, explains no-benefit states, while Qin Che remains available for guarding', () => {
    const zhou = startCompanionCombat('zhou_yingxue', 3);
    if (!zhou.combat) throw new Error('Expected Zhou combat');
    const focusTwo: GameState = { ...zhou, combat: { ...zhou.combat, weaponFocus: 2 } };
    expect(game.useCompanionAssist(focusTwo).combat?.weaponFocus).toBe(3);
    const focusFull: GameState = { ...zhou, combat: { ...zhou.combat, weaponFocus: 3 } };
    expect(game.getCurrentCompanionAssistStatus(focusFull).reason).toBe('no_benefit');
    expect(game.useCompanionAssist(focusFull)).toBe(focusFull);

    const lu = startCompanionCombat('lu_guanlan', 3);
    const almostFull: GameState = { ...lu, player: { ...lu.player, hp: lu.player.maxHp - 1 } };
    expect(game.useCompanionAssist(almostFull).player.hp).toBe(lu.player.maxHp);
    expect(game.getCurrentCompanionAssistStatus(lu).reason).toBe('no_benefit');
    expect(game.useCompanionAssist(lu)).toBe(lu);

    const qin = startCompanionCombat('qin_che', 1);
    if (!qin.combat) throw new Error('Expected Qin combat');
    const full: GameState = { ...qin, combat: { ...qin.combat, weaponFocus: 3 } };
    expect(game.getCurrentCompanionAssistStatus(full).available).toBe(true);
  });

  it('does not retaliate, resolve intent, mutate effects, advance boss phase, or settle focus on assist', () => {
    const boss = startCompanionCombat('qin_che', 1, 'bone_lane_monster');
    if (!boss.combat || !boss.run) throw new Error('Expected companion boss combat');
    const intentBefore = game.getCurrentCombatIntent(boss);
    const effectsBefore = boss.combat.effects;
    const damageTakenBefore = boss.run.damageTaken;
    const used = game.useCompanionAssist(boss);

    expect(used.combat?.turn).toBe(boss.combat.turn);
    expect(used.combat?.monsterHp).toBe(boss.combat.monsterHp);
    expect(used.player.hp).toBe(boss.player.hp);
    expect(used.run?.damageTaken).toBe(damageTakenBefore);
    expect(used.combat?.bossPhase).toBe(boss.combat.bossPhase);
    expect(used.combat?.effects).toBe(effectsBefore);
    expect(game.getCurrentCombatIntent(used)).toEqual(intentBefore);
    expect(used.combat?.weaponFocus).toBe(boss.combat.weaponFocus);
  });

  it('consumes Qin Che guarding on the next real retaliation and reduces that attack only', () => {
    const started = startCompanionCombat('qin_che', 1);
    if (!started.combat) throw new Error('Expected Qin combat');
    const durableCombat: GameState = {
      ...started,
      combat: { ...started.combat, monsterHp: 10_000 }
    };
    const durableTurn = durableCombat.combat!.turn;
    const durableMonsterHp = durableCombat.combat!.monsterHp;
    const assisted = game.useCompanionAssist(durableCombat);
    expect(assisted.combat?.turn).toBe(durableTurn);
    expect(assisted.combat?.monsterHp).toBe(durableMonsterHp);

    const guardedResult = performCombatAction(assisted, 'attack');
    const baselineResult = performCombatAction(durableCombat, 'attack');
    expect(guardedResult.player.hp).toBeGreaterThan(baselineResult.player.hp);
    expect(guardedResult.combat?.guarding).toBe(false);
    expect(guardedResult.combat?.turn).toBe(durableTurn + 1);
  });

  it('allows one assist per combat and resets the flag when a real new encounter starts', () => {
    const started = startCompanionCombat('qin_che', 2);
    const used = game.useCompanionAssist(started);
    expect(game.getCurrentCompanionAssistStatus(used).reason).toBe('already_used');
    expect(game.useCompanionAssist(used)).toBe(used);
    if (!used.run || !used.combat) throw new Error('Expected used companion combat');

    const secondNode = 'bone_lane_monster';
    const exploring: GameState = {
      ...used,
      phase: 'explore',
      combat: undefined,
      run: {
        ...used.run,
        currentNodeId: secondNode,
        clearedNodeIds: [...used.run.clearedNodeIds, used.combat.nodeId]
      }
    };
    const nextCombat = selectNode(exploring, secondNode);
    expect(nextCombat.combat?.companionAssistUsed).toBe(false);
    expect(game.getCurrentCompanionAssistStatus(nextCombat).available).toBe(true);
  });

  it('adds no companion reward on retreat, failure, or successful exit settlement', () => {
    const active = enterDungeon(companionHub('lu_guanlan', 3), 'demon_tower_1');
    if (!active.run) throw new Error('Expected active companion run');
    const legacyRun = { ...active.run };
    delete legacyRun.companionSnapshot;
    const legacy: GameState = { ...active, run: legacyRun };

    const retreated = resolveRetreat(active);
    const legacyRetreated = resolveRetreat(legacy);
    expect(retreated.rewardPoints).toBe(legacyRetreated.rewardPoints);
    expect(retreated.inventory).toEqual(legacyRetreated.inventory);

    const failed = game.resolveRunFailure(active);
    const legacyFailed = game.resolveRunFailure(legacy);
    expect(failed.rewardPoints).toBe(legacyFailed.rewardPoints);
    expect(failed.inventory).toEqual(legacyFailed.inventory);

    const bossNodeId = getBossDefinition('demon_tower_1').nodeId;
    const atExit = (state: GameState): GameState => {
      if (!state.run) throw new Error('Expected exit run');
      const exitReady: GameState = {
        ...state,
        phase: 'explore',
        combat: undefined,
        run: {
          ...state.run,
          currentNodeId: 'tower_exit',
          clearedNodeIds: [...new Set([...state.run.clearedNodeIds, bossNodeId])]
        }
      };
      return selectNode(exitReady, 'tower_exit');
    };
    const exited = resolveExit(atExit(active));
    const legacyExited = resolveExit(atExit(legacy));
    expect(exited.rewardPoints).toBe(legacyExited.rewardPoints);
    expect(exited.lingyun).toBe(legacyExited.lingyun);
    expect(exited.inventory).toEqual(legacyExited.inventory);
  });
});

describe('method cultivation lifecycle and combat integration', () => {
  const methodIds = Object.keys(METHODS) as game.MethodId[];

  function withCurrentNode(state: GameState, nodeId: string): GameState {
    if (!state.run) return state;
    return {
      ...state,
      phase: 'explore',
      combat: undefined,
      run: { ...state.run, currentNodeId: nodeId }
    };
  }

  function fundedMethodHub(
    methodId: game.MethodId,
    rank: game.MethodRank,
    options: { withPet?: boolean; learnedMethods?: game.MethodId[] } = {}
  ): GameState {
    const initial = createInitialState();
    const learnedMethods = options.learnedMethods ?? [methodId];
    const methodRanks = Object.fromEntries(
      learnedMethods.map((learnedMethodId) => [learnedMethodId, learnedMethodId === methodId ? rank : 1])
    ) as Partial<Record<game.MethodId, game.MethodRank>>;
    return {
      ...initial,
      rewardPoints: 10_000,
      lingyun: 20,
      inventory: { ...initial.inventory, method_page: 10, rift_dust: 10, gate_sigil: 1 },
      learnedMethods,
      methodRanks,
      activeMethod: methodId,
      completedDungeonIds: [...DUNGEON_ORDER],
      claimedTaskIds: ['mainline_clear_demon_tower_1'],
      ...(options.withPet === false
        ? {}
        : {
            ownedPets: ['contract_sprite'] as game.PetId[],
            petLevels: { contract_sprite: 1 },
            activePet: 'contract_sprite' as const
          })
    };
  }

  function startMethodCombat(
    methodId: game.MethodId,
    rank: game.MethodRank,
    options: { withPet?: boolean; nodeId?: string; learnedMethods?: game.MethodId[] } = {}
  ): GameState {
    const nodeId = options.nodeId ?? 'fog_lesser_demon';
    const entered = enterDungeon(
      fundedMethodHub(methodId, rank, options),
      'demon_tower_1'
    );
    return selectNode(withCurrentNode(entered, nodeId), nodeId);
  }

  it('starts empty and normalizes legacy learned methods to R1 without inventing a main method', () => {
    const initial = createInitialState();
    expect(initial.methodRanks).toEqual({});
    expect(initial.activeMethod).toBeUndefined();

    const legacy = {
      ...initial,
      learnedMethods: ['mist_breathing', 'iron_body'] as game.MethodId[],
      methodRanks: { mist_breathing: 99 } as unknown as GameState['methodRanks']
    };
    expect(game.getMethodCultivationProgress(legacy)).toEqual({
      rulesVersion: 1,
      ranks: { mist_breathing: 1, iron_body: 1 }
    });
  });

  it('assigns R1 on learn, auto-selects only the new first selection, and activates only learned methods at hub', () => {
    const funded = fundedMethodHub('mist_breathing', 1);
    const empty = {
      ...funded,
      learnedMethods: [] as game.MethodId[],
      methodRanks: {},
      activeMethod: undefined
    };
    const first = learnMethod(empty, 'mist_breathing');
    const second = learnMethod(first, 'gate_sense');

    expect(first.methodRanks).toEqual({ mist_breathing: 1 });
    expect(first.activeMethod).toBe('mist_breathing');
    expect(second.methodRanks).toEqual({ mist_breathing: 1, gate_sense: 1 });
    expect(second.activeMethod).toBe('mist_breathing');

    const invalid = game.activateMethod(second, 'void_heart');
    expect(invalid).toBe(second);
    const activated = game.activateMethod(second, 'gate_sense');
    expect(activated.activeMethod).toBe('gate_sense');
    expect(game.activateMethod(activated, 'gate_sense')).toBe(activated);
    const entered = enterDungeon(activated, 'demon_tower_1');
    expect(game.activateMethod(entered, 'mist_breathing')).toBe(entered);
  });

  it('pays the exact atomic R2 and R3 costs and preserves identity for illegal, unaffordable, max, and non-hub calls', () => {
    const rank1 = fundedMethodHub('mist_breathing', 1);
    const rank2 = game.upgradeMethod(rank1, 'mist_breathing');
    expect(rank2.methodRanks.mist_breathing).toBe(2);
    expect(rank2.rewardPoints).toBe(rank1.rewardPoints - 420);
    expect(rank2.lingyun).toBe(rank1.lingyun - 1);
    expect(rank2.inventory.method_page).toBe(rank1.inventory.method_page - 1);

    const rank3 = game.upgradeMethod(rank2, 'mist_breathing');
    expect(rank3.methodRanks.mist_breathing).toBe(3);
    expect(rank3.rewardPoints).toBe(rank2.rewardPoints - 760);
    expect(rank3.lingyun).toBe(rank2.lingyun - 2);
    expect(rank3.inventory.method_page).toBe(rank2.inventory.method_page - 2);
    expect(game.upgradeMethod(rank3, 'mist_breathing')).toBe(rank3);
    expect(game.upgradeMethod(rank1, 'void_heart')).toBe(rank1);

    const poor = { ...rank1, rewardPoints: 419 };
    expect(game.upgradeMethod(poor, 'mist_breathing')).toBe(poor);
    const entered = enterDungeon(rank1, 'demon_tower_1');
    expect(game.upgradeMethod(entered, 'mist_breathing')).toBe(entered);
  });

  it('freezes every learned method with the preferred method first and preserves the snapshots through portals', () => {
    const entered = enterDungeon(fundedMethodHub('void_heart', 2, {
      learnedMethods: ['mist_breathing', 'iron_body', 'void_heart']
    }), 'demon_tower_1');
    const snapshot = entered.run?.methodSnapshot;
    const snapshots = entered.run?.methodSnapshots;
    expect(snapshot).toEqual({ rulesVersion: 1, methodId: 'void_heart', rank: 2 });
    expect(snapshots).toEqual([
      { rulesVersion: 1, methodId: 'void_heart', rank: 2 },
      { rulesVersion: 1, methodId: 'mist_breathing', rank: 1 },
      { rulesVersion: 1, methodId: 'iron_body', rank: 1 }
    ]);

    const changedHubFields: GameState = {
      ...entered,
      activeMethod: 'mist_breathing',
      methodRanks: { ...entered.methodRanks, void_heart: 3, mist_breathing: 3 },
      learnedMethods: [...entered.learnedMethods, 'mist_breathing']
    };
    expect(changedHubFields.run?.methodSnapshot).toBe(snapshot);
    expect(changedHubFields.run?.methodSnapshots).toBe(snapshots);

    const portal = withCurrentNode(changedHubFields, 'cracked_portal');
    const transported = usePortal(portal, 'force');
    expect(transported.run?.dungeonId).toBe('metro_abyss');
    expect(transported.run?.methodSnapshot).toBe(snapshot);
    expect(transported.run?.methodSnapshots).toBe(snapshots);
  });

  it('still freezes learned methods when no preferred method is selected and records an explicit empty library', () => {
    const learned = {
      ...fundedMethodHub('mist_breathing', 2, {
        learnedMethods: ['mist_breathing', 'iron_body']
      }),
      activeMethod: undefined
    };
    const entered = enterDungeon(learned, 'demon_tower_1');
    expect(entered.run?.methodSnapshot).toBeUndefined();
    expect(entered.run?.methodSnapshots).toEqual([
      { rulesVersion: 1, methodId: 'mist_breathing', rank: 2 },
      { rulesVersion: 1, methodId: 'iron_body', rank: 1 }
    ]);

    const started = selectNode(withCurrentNode(entered, 'fog_lesser_demon'), 'fog_lesser_demon');
    expect(game.getCurrentMethodTechniqueStatus(started).snapshot?.methodId).toBe('mist_breathing');
    expect(game.getCurrentMethodTechniqueStatus(started).available).toBe(true);

    const emptyHub: GameState = {
      ...learned,
      learnedMethods: [],
      methodRanks: {},
      activeMethod: undefined
    };
    const emptyRun = enterDungeon(emptyHub, 'demon_tower_1');
    expect(emptyRun.run?.methodSnapshots).toEqual([]);
    expect(game.getCurrentMethodTechniqueStatus(emptyRun).reason).toBe('no_learned_method');
    expect(game.useMethodTechnique(emptyRun)).toBe(emptyRun);
  });

  it('reports not-in-combat, sealed, legacy, malformed, requires-pet, and no-benefit reasons without mutation', () => {
    const hub = fundedMethodHub('gate_sense', 3);
    expect(game.getCurrentMethodTechniqueStatus(hub).reason).toBe('not_in_combat');

    const started = startMethodCombat('gate_sense', 3);
    if (!started.run || !started.combat) throw new Error('Missing method combat');
    const legacyRun = { ...started.run };
    delete legacyRun.methodSnapshots;
    delete legacyRun.methodSnapshot;
    const legacy = { ...started, run: legacyRun };
    expect(game.getCurrentMethodTechniqueStatus(legacy).reason).toBe('legacy_disabled');
    expect(game.useMethodTechnique(legacy)).toBe(legacy);

    const malformed = {
      ...started,
      run: {
        ...started.run,
        methodSnapshots: [{ rulesVersion: 1, methodId: 'gate_sense', rank: 3, extra: true }] as never,
        methodSnapshot: { rulesVersion: 1, methodId: 'gate_sense', rank: 3, extra: true } as never
      }
    };
    expect(game.getCurrentMethodTechniqueStatus(malformed).reason).toBe('legacy_disabled');
    expect(game.useMethodTechnique(malformed)).toBe(malformed);

    const sealedLaw = createDungeonLawState('dream_archive');
    const sealed = {
      ...started,
      run: {
        ...started.run,
        dungeonId: 'dream_archive' as const,
        lawState: {
          ...sealedLaw,
          law: { kind: 'dream_archive' as const, sealedFeatures: ['method' as const] }
        }
      }
    };
    expect(game.getCurrentMethodTechniqueStatus(sealed).reason).toBe('sealed');
    expect(game.useMethodTechnique(sealed)).toBe(sealed);

    const petless = startMethodCombat('beast_taming', 3, { withPet: false });
    expect(game.getCurrentMethodTechniqueStatus(petless).reason).toBe('requires_pet');
    expect(game.useMethodTechnique(petless)).toBe(petless);

    const noBenefit: GameState = {
      ...started,
      combat: { ...started.combat, weaponFocus: 3 }
    };
    expect(game.getCurrentMethodTechniqueStatus(noBenefit).reason).toBe('no_benefit');
    expect(game.useMethodTechnique(noBenefit)).toBe(noBenefit);
  });

  it('keeps legacy single-method runs playable without inventing newly learned techniques', () => {
    const started = startMethodCombat('gate_sense', 2, {
      learnedMethods: ['gate_sense', 'mist_breathing']
    });
    if (!started.run || !started.combat) throw new Error('Missing legacy method combat');
    const run = { ...started.run };
    delete run.methodSnapshots;
    const combat = { ...started.combat };
    delete combat.methodTechniqueUsedIds;
    const legacy: GameState = { ...started, run, combat };

    expect(game.getCurrentRunMethodSnapshots(legacy)).toEqual([
      { rulesVersion: 1, methodId: 'gate_sense', rank: 2 }
    ]);
    expect(game.getCurrentMethodTechniqueStatus(legacy, 'gate_sense').available).toBe(true);
    expect(game.getCurrentMethodTechniqueStatus(legacy, 'mist_breathing').reason).toBe('not_in_run');
  });

  const techniqueCases = game.METHOD_TECHNIQUE_CATALOG.flatMap((definition) =>
    ([1, 2, 3] as const).map((rank) => ({
      methodId: definition.methodId,
      rank,
      effect: definition.effects[rank]
    }))
  );

  it.each(techniqueCases)(
    'applies $methodId R$rank exactly as a free once-per-combat technique',
    ({ methodId, rank, effect }) => {
      const started = startMethodCombat(methodId, rank);
      if (!started.combat || !started.run) throw new Error('Missing technique combat');
      const prepared: GameState = {
        ...started,
        player: { ...started.player, hp: Math.max(1, started.player.maxHp - 50) },
        combat: {
          ...started.combat,
          monsterHp: 10_000,
          turn: 7,
          guarding: false,
          weaponFocus: 0,
          bossPhase: 'sealed',
          effects: {
            rustPoisonStacks: 2,
            mirrorSlowStacks: 2,
            breathStacks: 0,
            armorCracked: true,
            lastShiftTurn: 6,
            revivedOnce: true,
            lastPlayerAction: 'attack',
            echoCopiedStat: 'attack',
            echoCopiedValue: 17
          }
        }
      };
      const combatBefore = prepared.combat!;
      const runBefore = prepared.run!;
      const intentBefore = game.getCurrentCombatIntent(prepared);
      const used = game.useMethodTechnique(prepared);
      const expectedBreathCap = methodId === 'star_core_method' ? 3 : methodId === 'mist_breathing' ? 2 : 0;
      const expectedHealing = Math.min(
        prepared.player.maxHp - prepared.player.hp,
        Math.ceil((prepared.player.maxHp * effect.healPercent) / 100)
      );

      expect(used.combat?.guarding).toBe(effect.guarding);
      expect(used.combat?.weaponFocus).toBe(Math.min(3, effect.focusGain));
      expect(used.combat?.effects?.rustPoisonStacks).toBe(effect.clearsRustPoison ? 0 : 2);
      expect(used.combat?.effects?.mirrorSlowStacks).toBe(effect.clearsMirrorSlow ? 0 : 2);
      expect(used.combat?.effects?.breathStacks).toBe(
        effect.breathGain > 0 ? Math.min(expectedBreathCap, effect.breathGain) : 0
      );
      expect(used.player.hp).toBe(prepared.player.hp + expectedHealing);
      expect(used.combat?.methodTechniqueUsed).toBe(true);
      expect(used.combat?.methodTechniqueUsedIds).toEqual([methodId]);

      expect(used.combat).toMatchObject({
        turn: combatBefore.turn,
        monsterHp: combatBefore.monsterHp,
        bossPhase: combatBefore.bossPhase,
        damageTakenAtStart: combatBefore.damageTakenAtStart
      });
      expect(used.run).toBe(runBefore);
      expect(used.player.maxHp).toBe(prepared.player.maxHp);
      expect(used.combat?.effects).toMatchObject({
        armorCracked: true,
        lastShiftTurn: 6,
        revivedOnce: true,
        lastPlayerAction: 'attack',
        echoCopiedStat: 'attack',
        echoCopiedValue: 17
      });
      expect(game.getCurrentCombatIntent(used)).toEqual(intentBefore);
      expect(game.getCurrentMethodTechniqueStatus(used).reason).toBe('already_used');
    }
  );

  it('allows every snapshotted method technique once in the same combat', () => {
    const started = startMethodCombat('gate_sense', 3, {
      learnedMethods: ['mist_breathing', 'iron_body', 'gate_sense']
    });
    if (!started.combat) throw new Error('Missing multi-method combat');
    const prepared: GameState = {
      ...started,
      player: { ...started.player, hp: Math.max(1, started.player.maxHp - 20) },
      combat: {
        ...started.combat,
        weaponFocus: 0,
        effects: { breathStacks: 0 }
      }
    };

    const afterGate = game.useMethodTechnique(prepared, 'gate_sense');
    expect(game.getCurrentMethodTechniqueStatus(afterGate, 'gate_sense').reason).toBe('already_used');
    expect(game.getCurrentMethodTechniqueStatus(afterGate, 'mist_breathing').available).toBe(true);

    const afterMist = game.useMethodTechnique(afterGate, 'mist_breathing');
    expect(game.getCurrentMethodTechniqueStatus(afterMist, 'mist_breathing').reason).toBe('already_used');
    expect(game.getCurrentMethodTechniqueStatus(afterMist, 'iron_body').available).toBe(true);

    const afterIron = game.useMethodTechnique(afterMist, 'iron_body');
    expect(afterIron.combat?.methodTechniqueUsedIds).toEqual([
      'gate_sense',
      'mist_breathing',
      'iron_body'
    ]);
    expect(game.getCurrentMethodTechniqueStatus(afterIron, 'iron_body').reason).toBe('already_used');
  });

  it('clamps breath with learned Star Core before Mist and never clears existing positive breath', () => {
    const started = startMethodCombat('mist_breathing', 3, {
      learnedMethods: ['mist_breathing', 'star_core_method']
    });
    if (!started.combat) throw new Error('Missing breath combat');
    const prepared = {
      ...started,
      combat: {
        ...started.combat,
        effects: { ...started.combat.effects, breathStacks: 2 }
      }
    };
    expect(game.useMethodTechnique(prepared).combat?.effects?.breathStacks).toBe(3);

    const voidStarted = startMethodCombat('void_heart', 1, {
      learnedMethods: ['void_heart', 'mist_breathing']
    });
    if (!voidStarted.combat) throw new Error('Missing clear combat');
    const unclearedBreath = {
      ...voidStarted,
      combat: {
        ...voidStarted.combat,
        effects: { rustPoisonStacks: 1, mirrorSlowStacks: 1, breathStacks: 2 }
      }
    };
    expect(game.useMethodTechnique(unclearedBreath).combat?.effects?.breathStacks).toBe(2);
  });

  it('uses the frozen run library for breath limits even if hub fields are changed mid-run', () => {
    const started = startMethodCombat('mist_breathing', 3);
    if (!started.combat) throw new Error('Missing frozen breath combat');
    const changedHubFields: GameState = {
      ...started,
      learnedMethods: [...started.learnedMethods, 'star_core_method'],
      methodRanks: { ...started.methodRanks, star_core_method: 3 },
      combat: {
        ...started.combat,
        effects: { ...started.combat.effects, breathStacks: 1 }
      }
    };

    expect(game.useMethodTechnique(changedHubFields).combat?.effects?.breathStacks).toBe(2);
  });

  it('survives reload as used and resets only when a real next combat starts', () => {
    const started = startMethodCombat('iron_body', 1);
    const used = game.useMethodTechnique(started);
    const reloaded = JSON.parse(JSON.stringify(used)) as GameState;
    expect(game.getCurrentMethodTechniqueStatus(reloaded).reason).toBe('already_used');
    expect(game.useMethodTechnique(reloaded)).toBe(reloaded);
    if (!reloaded.run || !reloaded.combat) throw new Error('Missing reloaded method combat');

    const nextNodeId = 'bone_lane_monster';
    const exploring: GameState = {
      ...reloaded,
      phase: 'explore',
      combat: undefined,
      run: {
        ...reloaded.run,
        currentNodeId: nextNodeId,
        clearedNodeIds: [...reloaded.run.clearedNodeIds, reloaded.combat.nodeId]
      }
    };
    const nextCombat = selectNode(exploring, nextNodeId);
    expect(nextCombat.combat?.methodTechniqueUsed).toBe(false);
    expect(nextCombat.combat?.methodTechniqueUsedIds).toEqual([]);
    expect(game.getCurrentMethodTechniqueStatus(nextCombat).available).toBe(true);
  });

  it('keeps every non-main learned method in the old base stat and passive path', () => {
    for (const methodId of methodIds) {
      const learnedMethods: game.MethodId[] = methodId === 'gate_sense'
        ? ['gate_sense']
        : [methodId, 'gate_sense'];
      const active = fundedMethodHub(methodId, 1, { learnedMethods });
      const nonMain = { ...active, activeMethod: 'gate_sense' as const };
      expect(getDerivedStats(nonMain)).toEqual(getDerivedStats(active));
      expect(game.getPlayerPower(nonMain)).toBe(game.getPlayerPower(active));
    }

    const mistNonMain = fundedMethodHub('gate_sense', 1, {
      learnedMethods: ['gate_sense', 'mist_breathing']
    });
    const rewardNode = selectNode(
      withCurrentNode(enterDungeon(mistNonMain, 'demon_tower_1'), 'sealed_cache'),
      'sealed_cache'
    );
    expect(collectReward(rewardNode).run?.clearedNodeIds).toContain('sealed_cache');
  });
});

describe('silent broadcast tower game integration', () => {
  const silentEquipmentIds = [
    'hushblade', 'dead_air_headset', 'anechoic_mantle', 'last_channel_beacon'
  ] as const satisfies readonly EquipmentId[];

  function enterSilent(equipmentIds: readonly EquipmentId[] = []): GameState {
    const initial = createInitialState();
    const completedDungeonIds = DUNGEON_ORDER.filter((id) => id !== 'silent_broadcast_tower');
    const equipped = { ...initial.equipped };
    const equipmentLevels = { ...initial.equipmentLevels };
    for (const id of equipmentIds) {
      equipped[EQUIPMENT[id].slot] = id;
      equipmentLevels[id] = 3;
    }
    return enterDungeon({
      ...initial,
      inventory: {
        ...initial.inventory,
        healing_pill: 4,
        thunder_talisman: 4,
        dispel_talisman: 4,
        gate_sigil: 5
      },
      completedDungeonIds,
      claimedTaskIds: completedDungeonIds.map((id) => `mainline_clear_${id}`),
      ownedEquipment: [...new Set([...initial.ownedEquipment, ...equipmentIds])],
      equipmentLevels,
      equipped
    }, 'silent_broadcast_tower');
  }

  function atNode(state: GameState, nodeId: string): GameState {
    if (!state.run) throw new Error('Expected an active silent-tower run');
    return {
      ...state,
      phase: 'explore',
      combat: undefined,
      run: { ...state.run, currentNodeId: nodeId }
    };
  }

  function clearRelay(state: GameState, nodeId: string): GameState {
    return collectReward(atNode(state, nodeId));
  }

  function startCombat(state: GameState, nodeId: string): GameState {
    const started = selectNode(atNode(state, nodeId), nodeId);
    if (!started.combat) throw new Error(`Expected combat at ${nodeId}`);
    return {
      ...started,
      player: { ...started.player, hp: 10_000, maxHp: 10_000 },
      combat: { ...started.combat, monsterHp: 10_000 }
    };
  }

  it('freezes passives from equipped slots, not ownership, and survives reload', () => {
    const entered = enterSilent(silentEquipmentIds);
    const expected = {
      hushblade: true,
      deadAirHeadset: true,
      anechoicMantle: true,
      lastChannelBeacon: true
    };
    expect(entered.run?.broadcastEntryPassives).toEqual(expected);
    expect(game.getCurrentBroadcastRelayStatus(entered)?.entryPassives).toEqual(expected);

    const changed: GameState = { ...entered, equipped: createInitialState().equipped };
    expect(game.getCurrentBroadcastRelayStatus(changed)?.entryPassives).toEqual(expected);
    expect(game.getCurrentBroadcastRelayStatus(
      JSON.parse(JSON.stringify(changed)) as GameState
    )?.entryPassives).toEqual(expected);

    const merelyOwned = enterSilent([]);
    expect(game.getCurrentBroadcastRelayStatus({
      ...merelyOwned,
      ownedEquipment: [...merelyOwned.ownedEquipment, ...silentEquipmentIds]
    })?.entryPassives).toEqual({
      hushblade: false,
      deadAirHeadset: false,
      anechoicMantle: false,
      lastChannelBeacon: false
    });
  });

  it('blocks pending relay movement and awards broadcast exactly once without inventory payment', () => {
    const pending = clearRelay(enterSilent(), 'north_relay_console');
    expect(game.getNodeDepartureBlock(pending)?.kind).toBe('broadcast_relay');
    expect(game.moveToNode(pending, 'north_entry').run?.currentNodeId).toBe('north_relay_console');

    const rewardBefore = pending.rewardPoints;
    const lootBefore = pending.run?.lootBag.rewardPoints ?? 0;
    const inventoryBefore = pending.inventory;
    const broadcast = game.resolveCurrentBroadcastRelay(pending, 'broadcast');
    expect(broadcast.rewardPoints - rewardBefore).toBe(180);
    expect((broadcast.run?.lootBag.rewardPoints ?? 0) - lootBefore).toBe(180);
    expect(broadcast.inventory).toEqual(inventoryBefore);
    expect(broadcast.log[0]).toContain('本局奖励点 +180');
    expect(broadcast.log[0]).not.toContain('各 +180');
    expect(game.resolveCurrentBroadcastRelay(broadcast, 'broadcast')).toBe(broadcast);
    expect(game.resolveCurrentBroadcastRelay(pending, 'invalid' as never)).toBe(pending);

    const wrongNode = atNode(pending, 'broadcast_gate');
    expect(game.resolveCurrentBroadcastRelay(wrongNode, 'mute')).toBe(wrongNode);
    expect(game.moveToNode(broadcast, 'north_entry').run?.currentNodeId).toBe('north_entry');

    const broadcastRetreat = resolveRetreat(broadcast);
    const muteRetreat = resolveRetreat(game.resolveCurrentBroadcastRelay(pending, 'mute'));
    expect(broadcastRetreat.rewardPoints - muteRetreat.rewardPoints).toBe(90);
    expect(broadcastRetreat.run?.lastLootSettlement?.retained.rewardPoints).toBe(
      (muteRetreat.run?.lastLootSettlement?.retained.rewardPoints ?? 0) + 90
    );
    expect(broadcastRetreat.run?.lastLootSettlement?.lost.rewardPoints).toBe(
      (muteRetreat.run?.lastLootSettlement?.lost.rewardPoints ?? 0) + 90
    );

    const broadcastFailure = game.resolveRunFailure(broadcast, '广播失败测试。');
    const muteFailure = game.resolveRunFailure(
      game.resolveCurrentBroadcastRelay(pending, 'mute'),
      '静默失败测试。'
    );
    expect(broadcastFailure.rewardPoints - muteFailure.rewardPoints).toBe(36);

    const atExit = (relayState: GameState): GameState => {
      if (!relayState.run) throw new Error('Expected relay run at exit');
      return atNode({
        ...relayState,
        run: {
          ...relayState.run,
          clearedNodeIds: [...relayState.run.clearedNodeIds, 'last_broadcaster']
        }
      }, 'broadcast_exit');
    };
    const broadcastExit = resolveExit(atExit(broadcast));
    const muteExit = resolveExit(atExit(game.resolveCurrentBroadcastRelay(pending, 'mute')));
    expect(broadcastExit.rewardPoints - muteExit.rewardPoints).toBe(180);
  });

  it('applies frozen passives and keeps the Boss noise snapshot stable', () => {
    let state = startCombat(enterSilent(silentEquipmentIds), 'frequency_leech_north');
    state = performCombatAction(state, 'attack');
    expect(game.getCurrentBroadcastRelayStatus(state)?.noise).toBe(0);

    state = game.resolveCurrentBroadcastRelay(clearRelay(atNode(state, 'north_relay_console'), 'north_relay_console'), 'broadcast');
    state = game.resolveCurrentBroadcastRelay(clearRelay(state, 'central_relay_console'), 'broadcast');
    state = game.resolveCurrentBroadcastRelay(clearRelay(state, 'south_relay_console'), 'mute');
    expect(game.getCurrentBroadcastRelayStatus(state)?.noise).toBe(0);

    const boss = selectNode(atNode(state, 'last_broadcaster'), 'last_broadcaster');
    const snapshot = game.getCurrentBroadcastRelayStatus(boss)?.bossNoiseSnapshot;
    expect(snapshot).toBe(0);
    expect(game.resolveCurrentBroadcastRelay(boss, 'broadcast')).toBe(boss);
    const afterAction = performCombatAction({
      ...boss,
      equipped: createInitialState().equipped
    }, 'attack');
    expect(game.getCurrentBroadcastRelayStatus(afterAction)?.bossNoiseSnapshot).toBe(snapshot);
    expect(game.getCurrentDungeonLaw(afterAction)?.display.broadcast?.bossNoiseSnapshot).toBe(snapshot);

    if (!boss.combat) throw new Error('Expected broadcaster combat');
    const victory = performCombatAction({
      ...boss,
      combat: { ...boss.combat, monsterHp: 1 }
    }, 'attack');
    expect(victory.run?.clearedNodeIds).toContain('last_broadcaster');
    const repeated = selectNode(atNode(victory, 'last_broadcaster'), 'last_broadcaster');
    expect(repeated.rewardPoints).toBe(victory.rewardPoints);
    expect(repeated.run?.lootBag.rewardPoints).toBe(victory.run?.lootBag.rewardPoints);
  });

  it('carries the frozen loadout through the Tier 14 to 15 to 16 to 17 to 18 to 1 portal chain', () => {
    const initial = createInitialState();
    const completedDungeonIds = DUNGEON_ORDER.filter((id) => id !== 'silent_broadcast_tower');
    const equipped = { ...initial.equipped };
    for (const id of silentEquipmentIds) equipped[EQUIPMENT[id].slot] = id;
    let state = enterDungeon({
      ...initial,
      inventory: { ...initial.inventory, gate_sigil: 6 },
      completedDungeonIds,
      claimedTaskIds: completedDungeonIds.map((id) => `mainline_clear_${id}`),
      ownedEquipment: [...initial.ownedEquipment, ...silentEquipmentIds],
      equipmentLevels: {
        ...initial.equipmentLevels,
        ...Object.fromEntries(silentEquipmentIds.map((id) => [id, 3]))
      },
      equipped
    }, 'genesis_vault');
    state = {
      ...atNode(state, 'upper_genesis_portal'),
      equipped: initial.equipped
    };

    let silent = usePortal(state, 'stabilize');
    expect(silent.run?.dungeonId).toBe('silent_broadcast_tower');
    expect(silent.run?.broadcastEntryPassives).toEqual({
      hushblade: true,
      deadAirHeadset: true,
      anechoicMantle: true,
      lastChannelBeacon: true
    });
    expect(game.getCurrentBroadcastRelayStatus(silent)?.entryPassives).toEqual(
      silent.run?.broadcastEntryPassives
    );

    silent = game.resolveCurrentBroadcastRelay(
      clearRelay(atNode(silent, 'north_relay_console'), 'north_relay_console'),
      'broadcast'
    );
    const rewardBeforePortal = silent.rewardPoints;
    const lootBeforePortal = silent.run?.lootBag.rewardPoints;

    const shelter = usePortal(atNode(silent, 'upper_return_portal'), 'stabilize');
    expect(shelter.run?.dungeonId).toBe('lost_shelter');
    expect(shelter.run?.broadcastEntryPassives).toEqual(silent.run?.broadcastEntryPassives);
    expect(shelter.rewardPoints).toBe(rewardBeforePortal);
    expect(shelter.run?.lootBag.rewardPoints).toBe(lootBeforePortal);

    const verdict = usePortal(atNode(shelter, 'upper_return_portal'), 'stabilize');
    expect(verdict.run?.dungeonId).toBe('false_testimony_court');
    expect(verdict.run?.broadcastEntryPassives).toEqual(silent.run?.broadcastEntryPassives);
    expect(verdict.rewardPoints).toBe(rewardBeforePortal);
    expect(verdict.run?.lootBag.rewardPoints).toBe(lootBeforePortal);

    const replay = usePortal(atNode(verdict, 'upper_return_portal'), 'stabilize');
    expect(replay.run?.dungeonId).toBe('combat_replay_stage');
    const panopticon = usePortal(atNode(replay, 'upper_return_portal'), 'stabilize');
    expect(panopticon.run?.dungeonId).toBe('panopticon_city');
    const tierOne = usePortal(atNode(panopticon, 'upper_return_portal'), 'stabilize');
    expect(tierOne.run?.dungeonId).toBe('demon_tower_1');
    expect(tierOne.run?.broadcastEntryPassives).toEqual(silent.run?.broadcastEntryPassives);
    expect(tierOne.rewardPoints).toBe(rewardBeforePortal);
    expect(tierOne.run?.lootBag.rewardPoints).toBe(lootBeforePortal);
  });

  it('runs all four monster counters through real combat actions', () => {
    let leech = startCombat(enterSilent(), 'frequency_leech_north');
    leech = performCombatAction(performCombatAction(leech, 'attack'), 'attack');
    expect(leech.combat?.log.some((line) => line.includes('重复的武力频段'))).toBe(true);

    let warden = startCombat(enterSilent(), 'broadcast_warden_north');
    warden = performCombatAction(performCombatAction(warden, 'attack'), 'attack');
    expect(warden.combat?.log.some((line) => line.includes('同频护幕'))).toBe(true);

    let mimic = startCombat(enterSilent(), 'dead_air_mimic');
    mimic = performCombatAction(mimic, 'use_healing_pill');
    expect(mimic.combat?.effects?.deadAirEcho).toBe(true);
    mimic = performCombatAction(mimic, 'guard');
    expect(mimic.combat?.effects?.deadAirEcho).toBe(false);
    expect(mimic.combat?.log.some((line) => line.includes('安全消除'))).toBe(true);

    let boss = startCombat(enterSilent(), 'last_broadcaster');
    boss = { ...boss, combat: boss.combat ? { ...boss.combat, turn: 3 } : boss.combat };
    boss = performCombatAction(boss, 'guard');
    expect(boss.combat?.log.some((line) => line.includes('仅造成 4 点余波伤害'))).toBe(true);
  });
});

describe('silent broadcast equipment integration', () => {
  const definitions = {
    hushblade: ['weapon', { rewardPoints: 1600, lingyun: 6, items: { silence_core: 1, star_iron: 1 } }, { attack: 28, artPower: 6 }, { attack: 8, artPower: 2 }, 'forge_overdrive'],
    dead_air_headset: ['head', { rewardPoints: 1540, lingyun: 6, items: { silence_core: 1, phase_glass: 1 } }, { spirit: 3, artPower: 18, speed: 4, trapCheck: 7 }, { artPower: 5, speed: 2, trapCheck: 2 }, 'mist_vanguard'],
    anechoic_mantle: ['armor', { rewardPoints: 1620, lingyun: 6, items: { silence_core: 1, rift_dust: 1 } }, { maxHp: 62, defense: 16 }, { maxHp: 20, defense: 5 }, 'rift_resonance'],
    last_channel_beacon: ['charm', { rewardPoints: 1580, lingyun: 6, items: { silence_core: 1, chronal_glass: 1 } }, { spirit: 3, artPower: 23, defense: 5 }, { artPower: 8, defense: 2 }, 'chronal_stasis']
  } as const;

  it('registers exact mature definitions and defaults the non-purchasable material to zero', () => {
    expect(Object.values(EQUIPMENT).filter((equipment) => equipment.maxLevel === 3)).toHaveLength(56);
    expect(ITEMS.silence_core.kind).toBe('material');
    expect(ITEMS.silence_core.cost).toBeUndefined();
    expect(createInitialState().inventory.silence_core).toBe(0);
    expect(buyItem(createInitialState(), 'silence_core').inventory.silence_core).toBe(0);

    for (const equipmentId of Object.keys(definitions) as Array<keyof typeof definitions>) {
      const [slot, cost, base, perLevel, attunementId] = definitions[equipmentId];
      expect(EQUIPMENT[equipmentId]).toMatchObject({ slot, cost, base, perLevel, maxLevel: 3 });
      expect(EQUIPMENT[equipmentId].description).toContain('入场时冻结寂声法则被动');
      expect(getEquipmentAttunementOptions(equipmentId).map((option) => option.id)).toContain(attunementId);
    }
  });

  it('supports purchase, level three, attunement, and temper rank two for every new item', () => {
    let state: GameState = {
      ...createInitialState(),
      rewardPoints: 100_000,
      lingyun: 100,
      inventory: Object.fromEntries(
        game.ITEM_IDS.map((itemId) => [itemId, 100])
      ) as GameState['inventory']
    };

    for (const equipmentId of Object.keys(definitions) as Array<keyof typeof definitions>) {
      state = buyEquipment(state, equipmentId);
      state = upgradeEquipment(state, equipmentId);
      state = upgradeEquipment(state, equipmentId);
      state = game.temperEquipment(state, equipmentId);
      state = game.attuneEquipment(state, equipmentId, definitions[equipmentId][4]);
      state = game.temperEquipment(state, equipmentId);
      expect(state.equipmentLevels[equipmentId]).toBe(3);
      expect(state.equipmentAttunements?.[equipmentId]).toBe(definitions[equipmentId][4]);
      expect(state.equipmentTemperRanks?.[equipmentId]).toBe(2);
    }
  });

  it('clears all new run state in a fresh game', () => {
    const fresh = createInitialState();
    expect(fresh.run).toBeUndefined();
    expect(fresh.combat).toBeUndefined();
    expect(fresh.inventory.silence_core).toBe(0);
  });
});

describe('lost shelter core game integration', () => {
  const rescueEquipmentIds = [
    'rescue_carbine', 'triage_visor', 'evacuation_plate', 'blackbox_beacon'
  ] as const satisfies readonly EquipmentId[];

  function shelterHub(
    equipmentIds: readonly EquipmentId[] = [],
    companionId?: game.CompanionId,
    companionRank: game.CompanionRank = 1
  ): GameState {
    const initial = createInitialState();
    const completedDungeonIds = DUNGEON_ORDER.filter((id) => id !== 'lost_shelter');
    const equipped = { ...initial.equipped };
    const equipmentLevels = { ...initial.equipmentLevels };
    for (const id of equipmentIds) {
      equipped[EQUIPMENT[id].slot] = id;
      equipmentLevels[id] = 3;
    }
    return {
      ...initial,
      rewardPoints: 100_000,
      lingyun: 100,
      inventory: {
        ...initial.inventory,
        gate_sigil: 10,
        armor_patch: 10,
        focus_incense: 10
      },
      completedDungeonIds,
      claimedTaskIds: completedDungeonIds.map((id) => `mainline_clear_${id}`),
      ownedEquipment: [...new Set([...initial.ownedEquipment, ...equipmentIds])],
      equipmentLevels,
      equipped,
      ...(companionId === undefined
        ? {}
        : {
            ownedCompanions: [companionId],
            companionRanks: { [companionId]: companionRank },
            activeCompanion: companionId
          })
    };
  }

  function enterShelter(
    equipmentIds: readonly EquipmentId[] = [],
    companionId?: game.CompanionId,
    companionRank: game.CompanionRank = 1
  ): GameState {
    return enterDungeon(shelterHub(equipmentIds, companionId, companionRank), 'lost_shelter');
  }

  function atShelterNode(state: GameState, nodeId: string): GameState {
    if (!state.run) throw new Error('Expected an active lost-shelter run');
    return {
      ...state,
      phase: 'explore',
      combat: undefined,
      run: { ...state.run, currentNodeId: nodeId }
    };
  }

  function clearShelterMonster(state: GameState, nodeId = 'mimic_survivor'): GameState {
    const started = selectNode(atShelterNode(state, nodeId), nodeId);
    if (!started.combat) throw new Error(`Expected shelter combat at ${nodeId}`);
    return performCombatAction({
      ...started,
      player: { ...started.player, hp: 10_000, maxHp: 10_000 },
      combat: { ...started.combat, monsterHp: 1 }
    }, 'attack');
  }

  function setShelterSurvivorHp(state: GameState, survivorHp: number): GameState {
    if (!state.run) throw new Error('Expected an active shelter run');
    const lawState = game.getCurrentDungeonLaw(state)?.state;
    if (!lawState || lawState.law.kind !== 'lost_shelter') {
      throw new Error('Expected lost shelter law');
    }
    return {
      ...state,
      run: {
        ...state.run,
        lawState: {
          ...lawState,
          law: { ...lawState.law, survivorHp }
        }
      }
    };
  }

  function withRunHealingPills(state: GameState, amount: number, inventoryAmount = amount): GameState {
    if (!state.run) throw new Error('Expected an active shelter run');
    const items = { ...state.run.lootBag.items };
    if (amount > 0) items.healing_pill = amount;
    else delete items.healing_pill;
    return {
      ...state,
      inventory: { ...state.inventory, healing_pill: inventoryAmount },
      run: {
        ...state.run,
        lootBag: { ...state.run.lootBag, items }
      }
    };
  }

  function pendingCheckpoint(state: GameState, nodeId = 'central_checkpoint'): GameState {
    return collectReward(atShelterNode(state, nodeId));
  }

  it('registers exact mature rescue gear and keeps rescue badges non-purchasable at zero', () => {
    const definitions = {
      rescue_carbine: ['weapon', { rewardPoints: 1780, lingyun: 7, items: { rescue_badge: 1, star_iron: 1 } }, { attack: 31, artPower: 7 }, { attack: 9, artPower: 2 }, 'forge_overdrive'],
      triage_visor: ['head', { rewardPoints: 1720, lingyun: 7, items: { rescue_badge: 1, phase_glass: 1 } }, { spirit: 3, artPower: 21, speed: 4, trapCheck: 8 }, { artPower: 6, speed: 2, trapCheck: 2 }, 'mist_vanguard'],
      evacuation_plate: ['armor', { rewardPoints: 1800, lingyun: 7, items: { rescue_badge: 1, rift_dust: 1 } }, { maxHp: 70, defense: 18 }, { maxHp: 22, defense: 5 }, 'rift_resonance'],
      blackbox_beacon: ['charm', { rewardPoints: 1760, lingyun: 7, items: { rescue_badge: 1, chronal_glass: 1 } }, { spirit: 3, artPower: 26, defense: 6 }, { artPower: 9, defense: 2 }, 'chronal_stasis']
    } as const;

    expect(Object.values(EQUIPMENT).filter((equipment) => equipment.maxLevel === 3)).toHaveLength(56);
    expect(ITEMS.rescue_badge).toMatchObject({ id: 'rescue_badge', name: '救援铭牌', kind: 'material' });
    expect(ITEMS.rescue_badge.cost).toBeUndefined();
    expect(createInitialState().inventory.rescue_badge).toBe(0);
    expect(buyItem(createInitialState(), 'rescue_badge').inventory.rescue_badge).toBe(0);

    for (const equipmentId of Object.keys(definitions) as Array<keyof typeof definitions>) {
      const [slot, cost, base, perLevel, attunementId] = definitions[equipmentId];
      expect(EQUIPMENT[equipmentId]).toMatchObject({ slot, cost, base, perLevel, maxLevel: 3 });
      expect(EQUIPMENT[equipmentId].description).toContain('入场时冻结');
      expect(EQUIPMENT[equipmentId].description).toContain('护送被动');
      expect(getEquipmentAttunementOptions(equipmentId).map((option) => option.id)).toContain(attunementId);
    }
  });

  it('keeps all legacy cycle-imprint ids and adds verdict and replay marks', () => {
    const expectedIds = [
      'mist_reverse_mark',
      'last_train_tide_mark',
      'star_vein_plumb_mark',
      'redline_triage_mark',
      'ember_verdict_mark',
      'lost_page_index_mark',
      'echo_balance_mark',
      'chronometer_entry_mark',
      'causal_docket_mark',
      'entropy_manifest_mark',
      'mirror_cycle_mark',
      'final_proof_mark',
      'hammer_chain_mark',
      'genesis_mosaic_mark',
      'last_broadcast_mark',
      'survivor_roll_call_mark',
      'cross_exam_verdict_mark',
      'script_projection_mark',
      'inverse_observation_mark'
    ] as const satisfies readonly game.CycleImprintId[];
    const actualIds = DUNGEON_ORDER.map((dungeonId) => {
      const definition = getRunProtocolDefinition(dungeonId, 'imprint');
      if (!definition || definition.id !== 'imprint') {
        throw new Error(`Missing imprint protocol for ${dungeonId}`);
      }
      return definition.imprint.id;
    });

    expect(actualIds).toEqual(expectedIds);
    expect(new Set(actualIds).size).toBe(19);
  });

  it('supports purchase, level three, attunement, and temper rank two for all rescue gear', () => {
    let state: GameState = {
      ...createInitialState(),
      rewardPoints: 100_000,
      lingyun: 100,
      inventory: Object.fromEntries(game.ITEM_IDS.map((itemId) => [itemId, 100])) as GameState['inventory']
    };
    const attunements = {
      rescue_carbine: 'forge_overdrive',
      triage_visor: 'mist_vanguard',
      evacuation_plate: 'rift_resonance',
      blackbox_beacon: 'chronal_stasis'
    } as const;

    for (const equipmentId of rescueEquipmentIds) {
      state = buyEquipment(state, equipmentId);
      state = upgradeEquipment(upgradeEquipment(state, equipmentId), equipmentId);
      state = game.temperEquipment(state, equipmentId);
      state = game.attuneEquipment(state, equipmentId, attunements[equipmentId]);
      state = game.temperEquipment(state, equipmentId);
      expect(state.equipmentLevels[equipmentId]).toBe(3);
      expect(state.equipmentAttunements?.[equipmentId]).toBe(attunements[equipmentId]);
      expect(state.equipmentTemperRanks?.[equipmentId]).toBe(2);
    }
  });

  it('freezes equipped rescue gear and the run companion snapshot across mutation and reload', () => {
    const entered = enterShelter(rescueEquipmentIds, 'qin_che', 2);
    const expectedGear = {
      rescueCarbine: true,
      triageVisor: true,
      evacuationPlate: true,
      blackboxBeacon: true
    };
    expect(entered.run?.escortEntryGear).toEqual(expectedGear);
    expect(game.getCurrentEscortCheckpointStatus(entered)).toMatchObject({
      entryGear: expectedGear,
      entryCompanion: { id: 'qin_che', rank: 2 },
      companionRole: expect.stringContaining('首次险情护卫')
    });

    const changed: GameState = {
      ...entered,
      equipped: createInitialState().equipped,
      activeCompanion: 'zhou_yingxue',
      companionRanks: { qin_che: 3, zhou_yingxue: 3 },
      ownedCompanions: ['qin_che', 'zhou_yingxue']
    };
    expect(game.getCurrentEscortCheckpointStatus(changed)?.entryGear).toEqual(expectedGear);
    expect(game.getCurrentEscortCheckpointStatus(changed)?.entryCompanion).toEqual({ id: 'qin_che', rank: 2 });
    const reloaded = JSON.parse(JSON.stringify(changed)) as GameState;
    expect(game.getCurrentEscortCheckpointStatus(reloaded)?.entryGear).toEqual(expectedGear);
    expect(game.getCurrentEscortCheckpointStatus(reloaded)?.entryCompanion).toEqual({ id: 'qin_che', rank: 2 });
  });

  it('does not backfill missing run snapshots from changed hub-facing fields during a portal', () => {
    let source = enterDungeon(shelterHub(rescueEquipmentIds, 'qin_che', 2), 'silent_broadcast_tower');
    if (!source.run) throw new Error('Expected silent-tower source run');
    const legacyRun = { ...source.run };
    delete legacyRun.escortEntryGear;
    delete legacyRun.companionSnapshot;
    source = {
      ...source,
      run: { ...legacyRun, currentNodeId: 'upper_return_portal' },
      equipped: shelterHub(rescueEquipmentIds).equipped,
      ownedCompanions: ['qin_che'],
      companionRanks: { qin_che: 3 },
      activeCompanion: 'qin_che'
    };

    const transported = usePortal(source, 'stabilize');
    expect(transported.run?.dungeonId).toBe('lost_shelter');
    expect(transported.run?.escortEntryGear).toEqual({
      rescueCarbine: false,
      triageVisor: false,
      evacuationPlate: false,
      blackboxBeacon: false
    });
    expect(Object.prototype.hasOwnProperty.call(transported.run, 'companionSnapshot')).toBe(false);
    expect(game.getCurrentEscortCheckpointStatus(transported)?.entryCompanion).toEqual({ id: null, rank: 0 });
  });

  it('preserves rescue gear and companion snapshots through the Tier 15 to 16 to 17 to 1 portal chain', () => {
    let source = enterDungeon(shelterHub(rescueEquipmentIds, 'zhou_yingxue', 2), 'silent_broadcast_tower');
    source = atShelterNode(source, 'upper_return_portal');
    source = { ...source, equipped: createInitialState().equipped };
    const shelter = usePortal(source, 'stabilize');
    expect(shelter.run?.dungeonId).toBe('lost_shelter');
    expect(game.getCurrentEscortCheckpointStatus(shelter)).toMatchObject({
      entryGear: {
        rescueCarbine: true,
        triageVisor: true,
        evacuationPlate: true,
        blackboxBeacon: true
      },
      entryCompanion: { id: 'zhou_yingxue', rank: 2 }
    });

    const verdict = usePortal(atShelterNode(shelter, 'upper_return_portal'), 'stabilize');
    expect(verdict.run?.dungeonId).toBe('false_testimony_court');
    expect(verdict.run?.escortEntryGear).toEqual(shelter.run?.escortEntryGear);
    expect(verdict.run?.companionSnapshot).toEqual(shelter.run?.companionSnapshot);

    const replay = usePortal(atShelterNode(verdict, 'upper_return_portal'), 'stabilize');
    expect(replay.run?.dungeonId).toBe('combat_replay_stage');
    const panopticon = usePortal(atShelterNode(replay, 'upper_return_portal'), 'stabilize');
    expect(panopticon.run?.dungeonId).toBe('panopticon_city');
    const tierOne = usePortal(atShelterNode(panopticon, 'upper_return_portal'), 'stabilize');
    expect(tierOne.run?.dungeonId).toBe('demon_tower_1');
    expect(tierOne.run?.escortEntryGear).toEqual(shelter.run?.escortEntryGear);
    expect(tierOne.run?.companionSnapshot).toEqual(shelter.run?.companionSnapshot);
  });

  it('gives Qin, Zhou, and Lu distinct R1/R2 escort responsibilities', () => {
    const qinR1 = clearShelterMonster(enterShelter([], 'qin_che', 1));
    const qinR2 = clearShelterMonster(enterShelter([], 'qin_che', 2));
    expect(game.getCurrentEscortCheckpointStatus(qinR1)?.survivorHp).toBe(90);
    expect(game.getCurrentEscortCheckpointStatus(qinR2)).toMatchObject({
      survivorHp: 100,
      firstHazardGuardUsed: true
    });

    const zhouR1 = game.resolveCurrentEscortCheckpoint(
      pendingCheckpoint(setShelterSurvivorHp(enterShelter([], 'zhou_yingxue', 1), 70)),
      'push'
    );
    const zhouR2 = game.resolveCurrentEscortCheckpoint(
      pendingCheckpoint(setShelterSurvivorHp(enterShelter([], 'zhou_yingxue', 2), 70)),
      'push'
    );
    expect(game.getCurrentEscortCheckpointStatus(zhouR1)?.survivorHp).toBe(60);
    expect(game.getCurrentEscortCheckpointStatus(zhouR2)).toMatchObject({
      survivorHp: 70,
      companionAnalysisUsed: true
    });

    const luR1Pending = pendingCheckpoint(withRunHealingPills(
      setShelterSurvivorHp(enterShelter([], 'lu_guanlan', 1), 50),
      1
    ));
    const luR2Pending = pendingCheckpoint(withRunHealingPills(
      setShelterSurvivorHp(enterShelter([], 'lu_guanlan', 2), 50),
      1
    ));
    const luR1 = game.resolveCurrentEscortCheckpoint(luR1Pending, 'treat');
    const luR2 = game.resolveCurrentEscortCheckpoint(luR2Pending, 'treat');
    expect(game.getCurrentEscortCheckpointStatus(luR1)?.survivorHp).toBe(75);
    expect(luR1.inventory.healing_pill).toBe(0);
    expect(game.getCurrentEscortCheckpointStatus(luR2)).toMatchObject({
      survivorHp: 85,
      companionTriageUsed: true
    });
    expect(luR2.inventory.healing_pill).toBe(1);
  });

  it('consumes treat pills only from synchronized run loot and leaves every error unchanged', () => {
    const bankOnly = pendingCheckpoint(withRunHealingPills(setShelterSurvivorHp(enterShelter(), 50), 0, 5));
    expect(game.getCurrentEscortCheckpointStatus(bankOnly)?.choices.treat).toMatchObject({
      available: false,
      unavailableReason: '当前 run 没有止血丹。'
    });
    expect(game.resolveCurrentEscortCheckpoint(bankOnly, 'treat')).toBe(bankOnly);

    const desynced = pendingCheckpoint(withRunHealingPills(setShelterSurvivorHp(enterShelter(), 50), 1, 0));
    expect(game.resolveCurrentEscortCheckpoint(desynced, 'treat')).toBe(desynced);

    const funded = pendingCheckpoint(withRunHealingPills(setShelterSurvivorHp(enterShelter(), 50), 1));
    const treated = game.resolveCurrentEscortCheckpoint(funded, 'treat');
    expect(treated.inventory.healing_pill).toBe(0);
    expect(treated.run?.lootBag.items.healing_pill).toBeUndefined();
    expect(game.getCurrentEscortCheckpointStatus(treated)?.survivorHp).toBe(75);
    expect(game.resolveCurrentEscortCheckpoint(treated, 'treat')).toBe(treated);
    expect(game.resolveCurrentEscortCheckpoint(funded, 'invalid' as never)).toBe(funded);
    const fresh = createInitialState();
    expect(game.resolveCurrentEscortCheckpoint(fresh, 'treat')).toBe(fresh);
  });

  it('applies hazard loss on first clear only and honors frozen monster/trap protection', () => {
    const plainMonster = clearShelterMonster(enterShelter());
    expect(game.getCurrentEscortCheckpointStatus(plainMonster)?.survivorHp).toBe(90);
    const repeatedMonster = selectNode(atShelterNode(plainMonster, 'mimic_survivor'), 'mimic_survivor');
    expect(game.getCurrentEscortCheckpointStatus(repeatedMonster)?.survivorHp).toBe(90);

    const carbineMonster = clearShelterMonster(enterShelter(['rescue_carbine']));
    expect(game.getCurrentEscortCheckpointStatus(carbineMonster)?.survivorHp).toBe(94);

    const preparedPlain = enterDungeon(
      game.configureTacticalLoadout(shelterHub(), ['armor_patch']),
      'lost_shelter'
    );
    const plainTrap = handleTrap(atShelterNode(preparedPlain, 'collapsed_hall_trap'), 'counter');
    expect(game.getCurrentEscortCheckpointStatus(plainTrap)?.survivorHp).toBe(85);

    const preparedPlate = enterDungeon(
      game.configureTacticalLoadout(shelterHub(['evacuation_plate']), ['armor_patch']),
      'lost_shelter'
    );
    const plateTrap = handleTrap(atShelterNode(preparedPlate, 'collapsed_hall_trap'), 'counter');
    expect(game.getCurrentEscortCheckpointStatus(plateTrap)?.survivorHp).toBe(90);
  });

  it('blocks movement while pending and resolves push exactly once for +200 run reward', () => {
    const pending = pendingCheckpoint(setShelterSurvivorHp(enterShelter(), 70));
    expect(game.getNodeDepartureBlock(pending)?.kind).toBe('escort_checkpoint');
    expect(game.moveToNode(pending, 'survivor_cell').run?.currentNodeId).toBe('central_checkpoint');
    const rewardBefore = pending.rewardPoints;
    const lootBefore = pending.run?.lootBag.rewardPoints ?? 0;
    const pushed = game.resolveCurrentEscortCheckpoint(pending, 'push');
    expect(pushed.rewardPoints - rewardBefore).toBe(200);
    expect((pushed.run?.lootBag.rewardPoints ?? 0) - lootBefore).toBe(200);
    expect(game.resolveCurrentEscortCheckpoint(pushed, 'push')).toBe(pushed);
    expect(game.moveToNode(pushed, 'survivor_cell').run?.currentNodeId).toBe('survivor_cell');
  });

  it('freezes boss survivor state through reload and exposes all modifier branches without revival', () => {
    for (const [survivorHp, allStatsPercent] of [[80, -6], [50, 0], [20, 6], [0, 12]] as const) {
      const ready = setShelterSurvivorHp(enterShelter(), survivorHp);
      const selected = selectNode(atShelterNode(ready, 'shelter_overseer'), 'shelter_overseer');
      if (!selected.combat) throw new Error('Expected shelter overseer combat');
      const started = performCombatAction({
        ...selected,
        player: { ...selected.player, hp: 10_000, maxHp: 10_000 },
        combat: { ...selected.combat, monsterHp: 10_000 }
      }, 'attack');
      expect(game.getCurrentEscortCheckpointStatus(started)?.bossSurvivorSnapshot).toBe(survivorHp);
      const reloaded = JSON.parse(JSON.stringify(started)) as GameState;
      expect(game.getCurrentDungeonLaw(reloaded)?.modifiers.encounter.allStatsPercent).toBe(allStatsPercent);
    }

    const deadPending = pendingCheckpoint(setShelterSurvivorHp(enterShelter(), 0));
    expect(game.getCurrentEscortCheckpointStatus(deadPending)?.choices.treat).toMatchObject({
      available: false,
      unavailableReason: '幸存者已经死亡，无法复活。'
    });
    expect(game.resolveCurrentEscortCheckpoint(deadPending, 'treat')).toBe(deadPending);
    expect(game.getCurrentEscortCheckpointStatus(deadPending)?.survivorHp).toBe(0);
  });

  it('settles push rewards through clear, retreat, and failure branches without duplication', () => {
    const makePending = () => pendingCheckpoint(setShelterSurvivorHp(enterShelter(), 70));
    const makePushed = () => game.resolveCurrentEscortCheckpoint(makePending(), 'push');
    const pushedForRetreat = makePushed();
    const withoutPushForRetreat = makePending();
    expect(resolveRetreat(pushedForRetreat).rewardPoints - resolveRetreat(withoutPushForRetreat).rewardPoints).toBe(100);

    const pushedForFailure = makePushed();
    const withoutPushForFailure = makePending();
    expect(
      game.resolveRunFailure(pushedForFailure).rewardPoints -
      game.resolveRunFailure(withoutPushForFailure).rewardPoints
    ).toBe(40);

    const atExit = (state: GameState): GameState => {
      if (!state.run) throw new Error('Expected shelter exit run');
      return atShelterNode({
        ...state,
        run: {
          ...state.run,
          clearedNodeIds: [...new Set([...state.run.clearedNodeIds, 'shelter_overseer'])]
        }
      }, 'shelter_exit');
    };
    const makeTreated = () => game.resolveCurrentEscortCheckpoint(
      withRunHealingPills(makePending(), 1),
      'treat'
    );
    const clearedWithPush = resolveExit(atExit(makePushed()));
    const clearedWithoutPush = resolveExit(atExit(makeTreated()));
    expect(clearedWithPush.rewardPoints - clearedWithoutPush.rewardPoints).toBe(200);
    expect(clearedWithPush.completedDungeonIds).toContain('lost_shelter');
  });

  it('starts a genuinely fresh v1-compatible state with no shelter run fields', () => {
    const fresh = createInitialState();
    expect(fresh.run).toBeUndefined();
    expect(fresh.combat).toBeUndefined();
    expect(fresh.inventory.rescue_badge).toBe(0);
    expect(fresh.ownedEquipment).not.toEqual(expect.arrayContaining([...rescueEquipmentIds]));
  });
});

describe('false testimony verdict law integration', () => {
  const verdictEquipmentIds = [
    'cross_examiner_sabre',
    'forensic_visor',
    'custody_shell',
    'appeal_seal'
  ] as const satisfies readonly EquipmentId[];
  const evidenceIds = ['voice_evidence', 'timeline_evidence', 'residue_evidence'] as const;
  const trapIds = ['voice_filter_trap', 'timeline_checksum_trap', 'residue_sterility_trap'] as const;
  const evidenceCounterIds = ['focus_incense', 'dispel_talisman', 'armor_patch'] as const;

  function verdictHub(
    equipmentIds: readonly EquipmentId[] = [],
    tacticalItemIds: readonly TacticalItemId[] = []
  ): GameState {
    const initial = createInitialState();
    const completedDungeonIds = DUNGEON_ORDER.filter((id) => id !== 'false_testimony_court');
    const equipped = { ...initial.equipped };
    const equipmentLevels = { ...initial.equipmentLevels };
    for (const equipmentId of equipmentIds) {
      equipped[EQUIPMENT[equipmentId].slot] = equipmentId;
      equipmentLevels[equipmentId] = 3;
    }
    return game.configureTacticalLoadout({
      ...initial,
      rewardPoints: 100_000,
      lingyun: 100,
      completedDungeonIds,
      claimedTaskIds: completedDungeonIds.map((id) => `mainline_clear_${id}`),
      ownedEquipment: [...new Set([...initial.ownedEquipment, ...equipmentIds])],
      equipmentLevels,
      equipped,
      inventory: {
        ...initial.inventory,
        healing_pill: 10,
        focus_incense: 10,
        dispel_talisman: 10,
        armor_patch: 10,
        gate_sigil: 10
      }
    }, tacticalItemIds);
  }

  function enterVerdict(
    equipmentIds: readonly EquipmentId[] = [],
    tacticalItemIds: readonly TacticalItemId[] = evidenceCounterIds
  ): GameState {
    const entered = enterDungeon(verdictHub(equipmentIds, tacticalItemIds), 'false_testimony_court');
    return {
      ...entered,
      player: { ...entered.player, hp: 10_000, maxHp: 10_000 }
    };
  }

  function atVerdictNode(state: GameState, nodeId: string): GameState {
    if (!state.run) throw new Error('Expected false-testimony run');
    return {
      ...state,
      phase: 'explore',
      combat: undefined,
      run: { ...state.run, currentNodeId: nodeId }
    };
  }

  function revealEvidence(state: GameState, count: number): GameState {
    let next = state;
    for (const [index, evidenceId] of evidenceIds.slice(0, count).entries()) {
      if (!next.run?.clearedNodeIds.includes(trapIds[index])) {
        next = handleTrap(atVerdictNode(next, trapIds[index]), 'counter');
      }
      next = collectReward(atVerdictNode(next, evidenceId));
    }
    return next;
  }

  function openVerdict(state: GameState): GameState {
    return collectReward(atVerdictNode(state, 'verdict_chamber'));
  }

  function originalVerdict(
    trustedCount: number,
    suspect: game.FalseTestimonySuspect = 'route_surveyor',
    equipmentIds: readonly EquipmentId[] = []
  ): { pending: GameState; resolved: GameState } {
    const pending = openVerdict(revealEvidence(enterVerdict(equipmentIds), trustedCount));
    return { pending, resolved: game.resolveCurrentVerdictChoice(pending, suspect) };
  }

  it('freezes all four gear passives on entry, reload, and the Tier16 -> Tier17 -> Tier18 -> Tier19 -> Tier1 portal chain', () => {
    const expectedGear = {
      crossExaminerSabre: true,
      forensicVisor: true,
      custodyShell: true,
      appealSeal: true
    };
    const entered = enterVerdict(verdictEquipmentIds);
    expect(entered.run?.falseTestimonyEntryGear).toEqual(expectedGear);
    expect(game.getCurrentVerdictStatus(entered)?.entryGear).toEqual(expectedGear);
    const changed = { ...entered, equipped: createInitialState().equipped };
    expect(game.getCurrentVerdictStatus(JSON.parse(JSON.stringify(changed)) as GameState)?.entryGear)
      .toEqual(expectedGear);

    let tier16 = enterDungeon(
      game.configureTacticalLoadout(verdictHub(verdictEquipmentIds), ['gate_sigil']),
      'lost_shelter'
    );
    tier16 = { ...atVerdictNode(tier16, 'upper_return_portal'), equipped: createInitialState().equipped };
    const tier17 = usePortal(tier16, 'stabilize');
    expect(tier17.run?.dungeonId).toBe('false_testimony_court');
    expect(game.getCurrentVerdictStatus(tier17)?.entryGear).toEqual(expectedGear);
    const tier18 = usePortal(atVerdictNode(tier17, 'upper_return_portal'), 'stabilize');
    expect(tier18.run?.dungeonId).toBe('combat_replay_stage');
    expect(tier18.run?.combatReplayState).toMatchObject({
      rulesVersion: 1,
      recordings: {},
      entryGear: { frameEngraver: false, cueVisor: false, bufferPlate: false, thawMetronome: false }
    });
    const tier19 = usePortal(atVerdictNode(tier18, 'upper_return_portal'), 'stabilize');
    expect(tier19.run?.dungeonId).toBe('panopticon_city');
    const tier1 = usePortal(atVerdictNode(tier19, 'upper_return_portal'), 'stabilize');
    expect(tier1.run?.dungeonId).toBe('demon_tower_1');
    expect(tier1.run?.falseTestimonyEntryGear).toEqual(expectedGear);
  });

  it('never backfills a missing legacy verdict snapshot from hub-facing equipment', () => {
    let source = enterDungeon(
      game.configureTacticalLoadout(verdictHub([], ['gate_sigil']), ['gate_sigil']),
      'lost_shelter'
    );
    if (!source.run) throw new Error('Expected legacy source run');
    const legacyRun = { ...source.run };
    delete legacyRun.falseTestimonyEntryGear;
    source = {
      ...source,
      run: { ...legacyRun, currentNodeId: 'upper_return_portal' },
      equipped: verdictHub(verdictEquipmentIds).equipped
    };
    const transported = usePortal(source, 'stabilize');
    expect(game.getCurrentVerdictStatus(transported)?.entryGear).toEqual({
      crossExaminerSabre: false,
      forensicVisor: false,
      custodyShell: false,
      appealSeal: false
    });
  });

  it('reveals all three evidence records and distinguishes clean, contaminated, armor-protected, and visor clues', () => {
    for (let index = 0; index < evidenceIds.length; index += 1) {
      const cleanTrap = handleTrap(atVerdictNode(enterVerdict(), trapIds[index]), 'counter');
      const clean = collectReward(atVerdictNode(cleanTrap, evidenceIds[index]));
      expect(game.getCurrentVerdictStatus(clean)?.evidence[index]).toMatchObject({
        id: evidenceIds[index], revealed: true, contaminated: false, trusted: true
      });

      const contaminated = collectReward(
        atVerdictNode(handleTrap(atVerdictNode(enterVerdict(), trapIds[index]), 'risk'), evidenceIds[index])
      );
      expect(game.getCurrentVerdictStatus(contaminated)?.evidence[index]).toMatchObject({
        revealed: true, contaminated: true, trusted: false
      });
    }

    let armored = handleTrap(atVerdictNode(enterVerdict(['custody_shell']), trapIds[0]), 'risk');
    expect(game.getCurrentVerdictStatus(armored)).toMatchObject({
      custodyProtectionUsed: true,
      currentTrustedCount: 0
    });
    armored = handleTrap(atVerdictNode(armored, trapIds[1]), 'risk');
    expect(game.getCurrentVerdictStatus(armored)?.evidence[1].contaminated).toBe(true);

    const preRevealedReload = JSON.parse(JSON.stringify(armored)) as GameState;
    expect(game.getCurrentVerdictStatus(preRevealedReload)?.evidence[1]).toMatchObject({
      revealed: false,
      contaminated: true,
      trusted: false
    });

    const visor = game.getCurrentVerdictStatus(enterVerdict(['forensic_visor']));
    expect(visor?.eliminatedSuspects).toContain('field_medic');
    expect(visor?.currentTrustedCount).toBe(0);

    const illegallyRevealed = collectReward(atVerdictNode(enterVerdict(), 'voice_evidence'));
    const lateTrap = handleTrap(atVerdictNode(illegallyRevealed, 'voice_filter_trap'), 'risk');
    expect(game.getCurrentVerdictStatus(lateTrap)?.evidence[0]).toMatchObject({
      revealed: true,
      contaminated: false,
      trusted: true
    });
  });

  it('locks movement while a verdict is pending and returns the original object on every failed resolution', () => {
    const pending = openVerdict(revealEvidence(enterVerdict(), 1));
    expect(game.getNodeDepartureBlock(pending)?.kind).toBe('false_testimony_verdict');
    const blocked = game.moveToNode(pending, 'timeline_evidence');
    expect(blocked.run?.currentNodeId).toBe('verdict_chamber');
    expect(game.resolveCurrentVerdictChoice(pending, 'unknown' as never)).toBe(pending);
    const hub = createInitialState();
    expect(game.resolveCurrentVerdictChoice(hub, 'route_surveyor')).toBe(hub);

    const resolved = game.resolveCurrentVerdictChoice(pending, 'route_surveyor');
    expect(game.resolveCurrentVerdictChoice(resolved, 'route_surveyor')).toBe(resolved);
    expect(game.getNodeDepartureBlock(resolved)?.kind).not.toBe('false_testimony_verdict');
  });

  it('pays all three original-correct reward bands exactly once and adds the frozen sabre bonus', () => {
    const baseRewards = [480, 320, 160];
    for (const [index, trustedCount] of [1, 2, 3].entries()) {
      const plain = originalVerdict(trustedCount);
      expect(plain.resolved.rewardPoints - plain.pending.rewardPoints).toBe(baseRewards[index]);
      expect((plain.resolved.run?.lootBag.rewardPoints ?? 0) - (plain.pending.run?.lootBag.rewardPoints ?? 0))
        .toBe(baseRewards[index]);

      const sabre = originalVerdict(trustedCount, 'route_surveyor', ['cross_examiner_sabre']);
      expect(sabre.resolved.rewardPoints - sabre.pending.rewardPoints).toBe(baseRewards[index] + 120);
      expect(game.resolveCurrentVerdictChoice(sabre.resolved, 'route_surveyor')).toBe(sabre.resolved);
    }
  });

  it('evaluates all four suspects, rewarding only the true route surveyor', () => {
    const suspects = ['records_keeper', 'field_medic', 'security_chief', 'route_surveyor'] as const;
    for (const suspect of suspects) {
      const { pending, resolved } = originalVerdict(1, suspect);
      expect(game.getCurrentVerdictStatus(resolved)?.accusationCorrect)
        .toBe(suspect === 'route_surveyor');
      expect(resolved.rewardPoints - pending.rewardPoints)
        .toBe(suspect === 'route_surveyor' ? 480 : 0);
    }
  });

  it('routes truth and swift vaults only by the frozen original trusted count', () => {
    for (const frozenTrustedCount of [1, 2]) {
      let supplemented = originalVerdict(frozenTrustedCount).resolved;
      supplemented = revealEvidence(supplemented, 3);
      expect(game.getCurrentVerdictStatus(supplemented)).toMatchObject({
        currentTrustedCount: 3,
        accusationTrustedCount: frozenTrustedCount,
        appealUsed: false
      });
      const truthBlocked = collectReward(atVerdictNode(supplemented, 'truth_archive'));
      expect(truthBlocked.run?.clearedNodeIds).not.toContain('truth_archive');
      const swiftGranted = collectReward(atVerdictNode(supplemented, 'swift_judgment_armory'));
      expect(swiftGranted.run?.clearedNodeIds).toContain('swift_judgment_armory');
    }

    const threeTrusted = originalVerdict(3).resolved;
    expect(game.getCurrentVerdictStatus(threeTrusted)).toMatchObject({
      currentTrustedCount: 3,
      accusationTrustedCount: 3,
      appealUsed: false
    });
    const swiftBlocked = collectReward(atVerdictNode(threeTrusted, 'swift_judgment_armory'));
    expect(swiftBlocked.run?.clearedNodeIds).not.toContain('swift_judgment_armory');
    const truthGranted = collectReward(atVerdictNode(threeTrusted, 'truth_archive'));
    expect(truthGranted.run?.clearedNodeIds).toContain('truth_archive');
  });

  it('allows one seal-backed appeal with no reward and blocks appeal after the false vault is cleared', () => {
    const wrong = originalVerdict(1, 'records_keeper', ['appeal_seal']).resolved;
    const appealPending = collectReward(atVerdictNode(wrong, 'appeal_desk'));
    expect(game.getCurrentVerdictStatus(appealPending)?.pendingVerdictNodeId).toBe('appeal_desk');
    const beforeReward = appealPending.rewardPoints;
    const appealed = game.resolveCurrentVerdictChoice(appealPending, 'route_surveyor');
    expect(appealed.rewardPoints).toBe(beforeReward);
    expect(game.getCurrentVerdictStatus(appealed)).toMatchObject({
      accusationCorrect: true,
      accusationTrustedCount: 1,
      appealUsed: true,
      projectedAccusationRewardPoints: 0
    });
    expect(collectReward(atVerdictNode(appealed, 'truth_archive')).run?.clearedNodeIds)
      .not.toContain('truth_archive');
    expect(collectReward(atVerdictNode(appealed, 'swift_judgment_armory')).run?.clearedNodeIds)
      .not.toContain('swift_judgment_armory');

    const wrongAgain = originalVerdict(1, 'records_keeper', ['appeal_seal']).resolved;
    const vaultFirst = collectReward(atVerdictNode(wrongAgain, 'false_verdict_vault'));
    const deskAfterVault = collectReward(atVerdictNode(vaultFirst, 'appeal_desk'));
    expect(game.getCurrentVerdictStatus(deskAfterVault)?.pendingVerdictNodeId).toBeNull();
    expect(game.resolveCurrentVerdictChoice(deskAfterVault, 'route_surveyor')).toBe(deskAfterVault);
  });

  it('freezes the boss verdict and modifiers across reload', () => {
    const resolved = originalVerdict(3).resolved;
    const selected = selectNode(atVerdictNode(resolved, 'false_testimony_judge'), 'false_testimony_judge');
    expect(game.getCurrentVerdictStatus(selected)?.bossVerdictSnapshot).toMatchObject({
      suspect: 'route_surveyor', correct: true, trustedCount: 3, appealed: false
    });
    expect(game.getCurrentDungeonLaw(selected)?.modifiers).toMatchObject({
      encounter: { allStatsPercent: -8 },
      outgoingDamage: { forcePercent: 6, artPercent: 6 }
    });
    const reloaded = JSON.parse(JSON.stringify(selected)) as GameState;
    expect(game.getCurrentVerdictStatus(reloaded)?.bossVerdictSnapshot)
      .toEqual(game.getCurrentVerdictStatus(selected)?.bossVerdictSnapshot);
    expect(game.getCurrentDungeonLaw(reloaded)?.modifiers)
      .toEqual(game.getCurrentDungeonLaw(selected)?.modifiers);
  });

  it('preserves one atomic verdict reward through retreat, failure, exit, and fresh-state resets', () => {
    const rewarded = originalVerdict(2).resolved;
    const unrewarded = originalVerdict(2, 'records_keeper').resolved;
    const rewardInRun = rewarded.run?.lootBag.rewardPoints ?? 0;
    expect(rewardInRun).toBeGreaterThanOrEqual(320);
    const retreated = resolveRetreat(rewarded);
    const baselineRetreated = resolveRetreat(unrewarded);
    const failed = game.resolveRunFailure(rewarded);
    const baselineFailed = game.resolveRunFailure(unrewarded);
    expect(retreated.phase).toBe('result');
    expect(failed.phase).toBe('result');
    expect(retreated.rewardPoints - baselineRetreated.rewardPoints).toBe(160);
    expect(failed.rewardPoints - baselineFailed.rewardPoints).toBe(64);

    if (!rewarded.run) throw new Error('Expected rewarded verdict run');
    const atExit = (state: GameState): GameState => {
      if (!state.run) throw new Error('Expected verdict exit run');
      return atVerdictNode({
        ...state,
        run: {
          ...state.run,
          clearedNodeIds: [...new Set([...state.run.clearedNodeIds, 'false_testimony_judge'])]
        }
      }, 'verdict_exit');
    };
    const exited = resolveExit(atExit(rewarded));
    const baselineExited = resolveExit(atExit(unrewarded));
    expect(exited.completedDungeonIds).toContain('false_testimony_court');
    expect(exited.rewardPoints - baselineExited.rewardPoints).toBe(320);
    expect(createInitialState().inventory.truth_fragment).toBe(0);
    expect(createInitialState().run).toBeUndefined();
  });
});

describe('combat replay stage combat integration', () => {
  function enterReplayStage(equipped: Partial<GameState['equipped']> = {}): GameState {
    const initial = createInitialState();
    const equipmentIds = Object.values(equipped) as EquipmentId[];
    const entered = enterDungeon({
      ...initial,
      completedDungeonIds: DUNGEON_ORDER.filter((id) => id !== 'combat_replay_stage'),
      claimedTaskIds: DUNGEON_ORDER.slice(0, 17).map((id) => `mainline_clear_${id}`),
      ownedEquipment: [...new Set([...initial.ownedEquipment, ...equipmentIds])],
      equipmentLevels: { ...initial.equipmentLevels, ...Object.fromEntries(equipmentIds.map((id) => [id, 1])) },
      equipped: { ...initial.equipped, ...equipped },
      player: {
        ...initial.player,
        hp: 5000,
        maxHp: 5000,
        base: { body: 80, spirit: 60, agility: 30, luck: 10 }
      }
    }, 'combat_replay_stage');
    if (!entered.run || entered.run.dungeonId !== 'combat_replay_stage') {
      throw new Error(`Expected combat replay stage entry: ${entered.log[0]}`);
    }
    return entered;
  }

  function startAt(state: GameState, nodeId: string): GameState {
    if (!state.run) throw new Error('Expected active replay-stage run');
    return selectNode({
      ...state,
      phase: 'explore',
      combat: undefined,
      run: {
        ...state.run,
        currentNodeId: nodeId,
        clearedNodeIds: state.run.clearedNodeIds.filter((id) => id !== nodeId)
      }
    }, nodeId);
  }

  function recordTakes(
    equipped: Partial<GameState['equipped']> = {},
    actions: readonly game.CombatReplayDirectAction[] = ['attack', 'art', 'guard']
  ): GameState {
    let state = enterReplayStage(equipped);
    for (const [index, takeId] of game.COMBAT_REPLAY_TAKE_IDS.entries()) {
      state = startAt(state, takeId);
      state = performCombatAction(state, actions[index] ?? 'attack');
    }
    return { ...state, phase: 'explore', combat: undefined };
  }

  it('records only the first successful direct action in each ordered take', () => {
    let state = enterReplayStage({ weapon: 'frame_engraver' });
    state = startAt(state, 'take_alpha');
    const afterItem = performCombatAction(state, 'use_healing_pill');
    expect(afterItem.run?.combatReplayState?.recordings.take_alpha).toBeUndefined();
    const recorded = performCombatAction(afterItem, 'attack');
    const first = recorded.run?.combatReplayState?.recordings.take_alpha;
    expect(first?.action).toBe('attack');
    expect(first?.observedValue).toBeGreaterThanOrEqual(0);
    expect(first?.replayValue).toBe(Math.min(9999, Math.ceil((first?.observedValue ?? 0) * 1.15)));
    expect(performCombatAction(recorded, 'art').run?.combatReplayState?.recordings.take_alpha).toEqual(first);

    const rejected = performCombatAction(startAt(recorded, 'take_gamma'), 'guard');
    expect(rejected.run?.combatReplayState?.recordings.take_gamma).toBeUndefined();
  });

  it('releases sequence, burst, and afterbeat at their distinct boundaries without replay turns', () => {
    const recorded = recordTakes();
    const sequence = game.selectCombatReplayRoute(recorded, 'sequence');
    const sequenceFight = startAt(sequence, 'cue_stalker');
    const sequenceStartHp = sequenceFight.combat?.monsterHp ?? 0;
    const sequenced = performCombatAction(sequenceFight, 'guard');
    expect(sequenced.combat?.combatReplayState?.cursor).toBe(1);
    expect(sequenceStartHp - (sequenced.combat?.monsterHp ?? 0))
      .toBe(sequence.run?.combatReplayState?.recordings.take_alpha?.replayValue);
    expect(sequenced.combat?.turn).toBe(2);

    const burstFight = startAt(game.selectCombatReplayRoute(recorded, 'burst'), 'cue_stalker');
    expect(burstFight.combat?.combatReplayState?.cursor).toBe(3);
    expect(burstFight.combat?.turn).toBe(1);
    expect(burstFight.combat?.effects).toEqual({});

    const afterbeat = game.selectCombatReplayRoute(recorded, 'afterbeat');
    const afterbeatFight = startAt(afterbeat, 'cue_stalker');
    const afterbeatHp = afterbeatFight.combat?.monsterHp ?? 0;
    const afterbeaten = performCombatAction(afterbeatFight, 'guard');
    expect(afterbeaten.player.hp).toBeGreaterThan(0);
    expect(afterbeaten.combat?.combatReplayState?.cursor).toBe(1);
    expect(afterbeatHp - (afterbeaten.combat?.monsterHp ?? 0))
      .toBe(Math.floor((afterbeat.run?.combatReplayState?.recordings.take_alpha?.replayValue ?? 0) * 1.25));
  });

  it('consumes a guard buffer once, or across two counters with buffer plate', () => {
    const plain = game.selectCombatReplayRoute(recordTakes({}, ['guard', 'attack', 'art']), 'sequence');
    const plainAfter = performCombatAction(startAt(plain, 'cue_stalker'), 'attack');
    expect(plainAfter.combat?.combatReplayState).toMatchObject({ buffer: 0, remainingBufferHits: 0 });

    const plated = game.selectCombatReplayRoute(
      recordTakes({ armor: 'buffer_plate' }, ['guard', 'attack', 'art']),
      'sequence'
    );
    const platedAfter = performCombatAction(startAt(plated, 'cue_stalker'), 'attack');
    expect(platedAfter.combat?.combatReplayState?.buffer).toBeGreaterThan(0);
    expect(platedAfter.combat?.combatReplayState?.remainingBufferHits).toBe(1);
    if (!platedAfter.combat) throw new Error('Expected plated replay combat');
    const secondCounter = performCombatAction({
      ...platedAfter,
      combat: { ...platedAfter.combat, monsterHp: 9999 }
    }, 'guard');
    expect(secondCounter.combat?.combatReplayState).toMatchObject({ buffer: 0, remainingBufferHits: 0 });
  });

  it('settles a replay kill exactly once without running a direct turn or duplicate reward', () => {
    const routed = game.selectCombatReplayRoute(recordTakes(), 'sequence');
    const started = startAt(routed, 'cue_stalker');
    if (!started.combat) throw new Error('Expected replay kill combat');
    const killed = performCombatAction({
      ...started,
      combat: { ...started.combat, monsterHp: 1 }
    }, 'guard');
    expect(killed.phase).toBe('explore');
    expect(killed.combat).toBeUndefined();
    expect(killed.run?.clearedNodeIds.filter((id) => id === 'cue_stalker')).toHaveLength(1);
    const rewardPoints = killed.run?.lootBag.rewardPoints;
    const repeated = selectNode(killed, 'cue_stalker');
    expect(repeated.run?.lootBag.rewardPoints).toBe(rewardPoints);
    expect(repeated.run?.clearedNodeIds.filter((id) => id === 'cue_stalker')).toHaveLength(1);
  });

  it('freezes boss takes/route, enforces both phases, and applies frozen equipment', () => {
    const recorded = recordTakes({
      weapon: 'frame_engraver', head: 'cue_visor', armor: 'buffer_plate', charm: 'thaw_metronome'
    });
    const routed = game.selectCombatReplayRoute(recorded, 'sequence');
    const boss = startAt({ ...routed, equipped: createInitialState().equipped }, 'final_cut_director');
    expect(boss.combat?.combatReplayState).toMatchObject({
      boss: true,
      cursor: 1,
      firstBoostUsed: true,
      entryGear: { frameEngraver: true, cueVisor: true, bufferPlate: true, thawMetronome: true }
    });
    const sealedMismatch = performCombatAction(boss, 'guard');
    expect(sealedMismatch.combat?.combatReplayState?.cursor).toBe(1);
    const sealedMatch = performCombatAction(sealedMismatch, 'art');
    expect(sealedMatch.combat?.combatReplayState?.cursor).toBe(2);
    if (!sealedMatch.combat) throw new Error('Expected continuing boss combat');
    const awakened: GameState = { ...sealedMatch, combat: { ...sealedMatch.combat, bossPhase: 'awakened' } };
    const matchingAwakened = performCombatAction(awakened, 'guard');
    expect(matchingAwakened.combat?.combatReplayState?.cursor).toBe(2);
    const differentAwakened = performCombatAction(matchingAwakened, 'attack');
    expect(differentAwakened.combat?.combatReplayState?.cursor).toBe(3);
  });

  it('round-trips strict cursor state and disables missing or malformed active-combat saves', () => {
    const routed = game.selectCombatReplayRoute(recordTakes(), 'afterbeat');
    const active = performCombatAction(startAt(routed, 'cue_stalker'), 'guard');
    const roundTripped = JSON.parse(JSON.stringify(active)) as GameState;
    expect(game.normalizeCombatReplayRunState(roundTripped.run?.combatReplayState))
      .toEqual(active.run?.combatReplayState);
    expect(game.normalizeCombatReplayCombatState(roundTripped.combat?.combatReplayState))
      .toEqual(active.combat?.combatReplayState);
    if (!active.combat) throw new Error('Expected active replay combat');

    const malformed: GameState = {
      ...active,
      combat: { ...active.combat, combatReplayState: { ...active.combat.combatReplayState!, cursor: 4 as never } }
    };
    expect(game.normalizeCombatReplayCombatState(malformed.combat?.combatReplayState)).toBeUndefined();
    expect(game.normalizeCombatReplayCombatState(performCombatAction(malformed, 'guard').combat?.combatReplayState))
      .toBeUndefined();
    const legacy: GameState = { ...active, combat: { ...active.combat, combatReplayState: undefined } };
    expect(performCombatAction(legacy, 'guard').combat?.combatReplayState).toBeUndefined();
    expect(resolveRetreat(active).combat).toBeUndefined();
    expect(game.resolveRunFailure(active).combat).toBeUndefined();
    expect(createInitialState().run).toBeUndefined();
    expect(createInitialState().combat).toBeUndefined();
  });
});
