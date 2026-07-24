import { describe, expect, it } from 'vitest';
import { getDungeonEvents } from './dungeon-events';
import { DUNGEONS } from './level-content';
import type { DungeonId, DungeonNode } from './game';
import {
  COMBAT_REPLAY_STAGE_DUNGEON_ID,
  PANOPTICON_CITY_DUNGEON_ID,
  DUNGEON_LAW_LANDMARKS,
  FALSE_TESTIMONY_COURT_DUNGEON_ID,
  LEGACY_AUCTION_COURT_DUNGEON_ID,
  LOST_SHELTER_DUNGEON_ID,
  SILENT_BROADCAST_TOWER_DUNGEON_ID,
  consumeCausalCollectionSeal,
  consumeMirrorCityShell,
  createDungeonLawState,
  freezeCombatReplayBossSnapshot,
  freezePanopticonBossSnapshot,
  advancePanopticonScan,
  getCausalLedgerStatus,
  getCombatOpeningDistribution,
  getCombatReplayStatus,
  getPanopticonStatus,
  getDungeonLawDisplay,
  getDungeonLawModifiers,
  getGenesisSpliceStatus,
  getAuctionLotStatus,
  getBroadcastRelayStatus,
  getEntropyHeadingStatus,
  getEscortCheckpointStatus,
  getFalseTestimonyStatus,
  getMirrorCityPhaseStatus,
  getMirrorCityShellStatus,
  getRedactionClauseStatus,
  isArchiveFeatureAvailable,
  normalizeDungeonLawState,
  recordCombatReplayTake,
  resolveCausalLedgerChoice,
  resolveEntropyHeadingChoice,
  resolveEscortCheckpointChoice,
  resolveFalseTestimonyAccusation,
  resolveMirrorCityPhaseChoice,
  resolveRedactionClauseChoice,
  resolveAuctionLotChoice,
  resolveGenesisSpliceChoice,
  resolveBroadcastRelayChoice,
  selectCombatReplayRoute,
  selectPanopticonRoute,
  signalCombatStarted,
  signalCombatVictory,
  signalDungeonEvent,
  signalFirstNodeClear,
  type DungeonLawState,
  type AuctionLotChoice,
  type AuctionLotNodeId,
  type LegacyAuctionEntryPassives,
  type GenesisEntryGear,
  type GenesisGene,
  type BroadcastEntryPassives,
  type BroadcastRelayChoice,
  type CombatReplayAction,
  type CombatReplayRoute,
  type EscortCheckpointChoice,
  type EscortEntryCompanion,
  type EscortEntryGear,
  type FalseTestimonyEntryGear,
  type FalseTestimonyEvidenceId,
  type FalseTestimonySuspect,
  type RedactionChoice
} from './dungeon-laws';

function node(id: string, type: DungeonNode['type']): Pick<DungeonNode, 'id' | 'type'> {
  return { id, type };
}

function clear(
  state: DungeonLawState,
  id: string,
  type: DungeonNode['type'] = 'reward',
  damageTaken = 0
): DungeonLawState {
  return signalFirstNodeClear(state, { node: node(id, type), damageTaken });
}

function win(
  state: DungeonLawState,
  nodeId: string,
  openingAction: 'attack' | 'art' | 'guard',
  isBoss = false
): DungeonLawState {
  const started = signalCombatStarted(state, { nodeId, openingAction, isBoss });
  return signalCombatVictory(started, { nodeId, isBoss });
}

function expectBoundedModifiers(state: DungeonLawState): void {
  const modifiers = getDungeonLawModifiers(state, { isReflectionEncounter: true, isBossEncounter: true });
  const values = [
    ...Object.values(modifiers.encounter),
    ...Object.values(modifiers.trap),
    modifiers.healingPercent,
    ...Object.values(modifiers.outgoingDamage),
    modifiers.guardEffectPercent
  ];
  for (const value of values) expect(value).toBeGreaterThanOrEqual(-20);
  for (const value of values) expect(value).toBeLessThanOrEqual(20);
}

function withCausalDebt(
  debt: number,
  entryConfig: {
    causalVisor?: boolean;
    echoBreakerGauntlets?: boolean;
    returnAnchorBelt?: boolean;
  } = {}
): DungeonLawState {
  const state = createDungeonLawState('causal_clearinghouse', entryConfig);
  if (state.law.kind !== 'causal_clearinghouse') throw new Error('Missing causal clearinghouse law');
  return { ...state, law: { ...state.law, debt } };
}

function resolveRedactionClauses(
  choices: readonly RedactionChoice[],
  entryPassives: {
    redlineEdge?: boolean;
    palimpsestMantle?: boolean;
    finalProofSeal?: boolean;
  } = {}
): DungeonLawState {
  let state = createDungeonLawState('redaction_scriptorium', entryPassives);
  for (const [index, nodeId] of DUNGEON_LAW_LANDMARKS.redaction_scriptorium.clauseNodeIds.entries()) {
    state = clear(state, nodeId);
    const resolution = resolveRedactionClauseChoice(state, choices[index] ?? 'redact');
    if (!resolution.resolved) throw new Error(`Failed to resolve ${nodeId}`);
    state = resolution.state;
  }
  return state;
}

function resolveAuctionLots(
  choices: Readonly<Record<AuctionLotNodeId, AuctionLotChoice>>,
  entryPassives: Partial<LegacyAuctionEntryPassives> = {}
): DungeonLawState {
  let state = createDungeonLawState(LEGACY_AUCTION_COURT_DUNGEON_ID, entryPassives);
  for (const nodeId of DUNGEON_LAW_LANDMARKS.legacy_auction_court.lotNodeIds) {
    state = clear(state, nodeId);
    const resolution = resolveAuctionLotChoice(state, choices[nodeId], 99);
    if (!resolution.resolved) throw new Error(`Failed to resolve ${nodeId}`);
    state = resolution.state;
  }
  return state;
}

function auctionChoiceMap(
  force: AuctionLotChoice,
  guard: AuctionLotChoice,
  art: AuctionLotChoice,
  returnChoice: AuctionLotChoice
): Record<AuctionLotNodeId, AuctionLotChoice> {
  return {
    force_lot_dais: force,
    guard_lot_dais: guard,
    art_lot_dais: art,
    return_lot_dais: returnChoice
  };
}

function resolveGenesisSequence(
  sequence: readonly GenesisGene[],
  entryGear: Partial<GenesisEntryGear> = {},
  entryBloodline: { aspect: GenesisGene | null; rank: 0 | 1 | 2 | 3 } = { aspect: null, rank: 0 }
): DungeonLawState {
  let state = createDungeonLawState('genesis_vault', { entryGear, entryBloodline });
  for (const [index, gene] of sequence.entries()) {
    const nodeId = DUNGEON_LAW_LANDMARKS.genesis_vault.spliceNodeIds[index];
    if (!nodeId) throw new Error(`Missing genesis splice node ${index}`);
    state = clear(state, nodeId);
    const resolution = resolveGenesisSpliceChoice(state, gene, 99);
    if (!resolution.resolved) throw new Error(`Failed to resolve ${nodeId}:${gene}`);
    state = resolution.state;
  }
  return state;
}

function withBroadcastNoise(
  noise: number,
  entryPassives: Partial<BroadcastEntryPassives> = {}
): DungeonLawState {
  const state = createDungeonLawState(SILENT_BROADCAST_TOWER_DUNGEON_ID, entryPassives);
  if (state.law.kind !== 'silent_broadcast_tower') throw new Error('Missing broadcast law');
  return { ...state, law: { ...state.law, noise } };
}

function resolveBroadcastSequence(
  choices: readonly BroadcastRelayChoice[],
  startingNoise = 0,
  entryPassives: Partial<BroadcastEntryPassives> = {}
): DungeonLawState {
  let state = withBroadcastNoise(startingNoise, entryPassives);
  for (const [index, choice] of choices.entries()) {
    const nodeId = DUNGEON_LAW_LANDMARKS.silent_broadcast_tower.relayNodeIds[index];
    if (!nodeId) throw new Error(`Missing broadcast relay ${index}`);
    state = clear(state, nodeId);
    const resolution = resolveBroadcastRelayChoice(state, choice);
    if (!resolution.resolved) throw new Error(`Failed to resolve ${nodeId}:${choice}`);
    state = resolution.state;
  }
  return state;
}

function withSurvivorHp(
  survivorHp: number,
  entryGear: Partial<EscortEntryGear> = {},
  entryCompanion: Partial<EscortEntryCompanion> = {}
): DungeonLawState {
  const state = createDungeonLawState(LOST_SHELTER_DUNGEON_ID, { entryGear, entryCompanion });
  if (state.law.kind !== 'lost_shelter') throw new Error('Missing lost shelter law');
  return { ...state, law: { ...state.law, survivorHp } };
}

function resolveEscortSequence(
  choices: readonly EscortCheckpointChoice[],
  startingHp = 35,
  entryGear: Partial<EscortEntryGear> = {},
  entryCompanion: Partial<EscortEntryCompanion> = {},
  availablePills = 99
): DungeonLawState {
  let state = withSurvivorHp(startingHp, entryGear, entryCompanion);
  for (const [index, choice] of choices.entries()) {
    const checkpointNodeId = DUNGEON_LAW_LANDMARKS.lost_shelter.checkpointNodeIds[index];
    if (!checkpointNodeId) throw new Error(`Missing escort checkpoint ${index}`);
    state = clear(state, checkpointNodeId);
    const resolution = resolveEscortCheckpointChoice(
      state,
      checkpointNodeId,
      choice,
      availablePills
    );
    if (!resolution.resolved) throw new Error(`Failed to resolve ${checkpointNodeId}:${choice}`);
    state = resolution.state;
  }
  return state;
}

const FALSE_TESTIMONY_TRAP_BY_EVIDENCE: Readonly<Record<FalseTestimonyEvidenceId, string>> = {
  voice_evidence: 'voice_filter_trap',
  timeline_evidence: 'timeline_checksum_trap',
  residue_evidence: 'residue_sterility_trap'
};

function revealFalseTestimonyEvidence(
  state: DungeonLawState,
  evidenceId: FalseTestimonyEvidenceId,
  contaminated = false
): DungeonLawState {
  const trapNodeId = FALSE_TESTIMONY_TRAP_BY_EVIDENCE[evidenceId];
  const afterTrap = clear(state, trapNodeId, 'trap', contaminated ? 1 : 0);
  return clear(afterTrap, evidenceId);
}

function accuseWithEvidence(
  evidenceIds: readonly FalseTestimonyEvidenceId[],
  suspect: FalseTestimonySuspect = 'route_surveyor',
  entryGear: Partial<FalseTestimonyEntryGear> = {},
  contaminatedIds: readonly FalseTestimonyEvidenceId[] = []
): { state: DungeonLawState; rewardPoints: number } {
  let state = createDungeonLawState(FALSE_TESTIMONY_COURT_DUNGEON_ID, { entryGear });
  for (const evidenceId of evidenceIds) {
    state = revealFalseTestimonyEvidence(state, evidenceId, contaminatedIds.includes(evidenceId));
  }
  state = clear(state, 'verdict_chamber');
  const resolution = resolveFalseTestimonyAccusation(state, suspect);
  if (!resolution.resolved) throw new Error(`Failed false-testimony accusation: ${suspect}`);
  return { state: resolution.state, rewardPoints: resolution.rewardPoints };
}

function startFalseTestimonyBoss(state: DungeonLawState): DungeonLawState {
  return signalCombatStarted(state, {
    nodeId: 'false_testimony_judge',
    isBoss: true,
    openingAction: 'attack'
  });
}

describe('dungeon laws', () => {
  it('uses only real level and event ids for every landmark', () => {
    const nodeLandmarks: Partial<Record<DungeonId, readonly string[]>> = {
      demon_tower_1: DUNGEON_LAW_LANDMARKS.demon_tower_1.reliefNodeIds,
      metro_abyss: DUNGEON_LAW_LANDMARKS.metro_abyss.calibrationNodeIds,
      starfall_mine: DUNGEON_LAW_LANDMARKS.starfall_mine.gravitySwitchNodeIds,
      rust_hospital: DUNGEON_LAW_LANDMARKS.rust_hospital.pharmacyNodeIds,
      dream_archive: DUNGEON_LAW_LANDMARKS.dream_archive.indexNodeIds,
      temporal_observatory: [
        ...DUNGEON_LAW_LANDMARKS.temporal_observatory.pastAnchorNodeIds,
        ...DUNGEON_LAW_LANDMARKS.temporal_observatory.futureAnchorNodeIds
      ],
      genesis_vault: DUNGEON_LAW_LANDMARKS.genesis_vault.spliceNodeIds,
      silent_broadcast_tower: DUNGEON_LAW_LANDMARKS.silent_broadcast_tower.relayNodeIds
    };
    const eventLandmarks: Partial<Record<DungeonId, readonly string[]>> = {
      demon_tower_1: DUNGEON_LAW_LANDMARKS.demon_tower_1.reliefEventIds,
      rust_hospital: DUNGEON_LAW_LANDMARKS.rust_hospital.triageEventIds,
      dream_archive: DUNGEON_LAW_LANDMARKS.dream_archive.indexEventIds
    };

    for (const [dungeonId, ids] of Object.entries(nodeLandmarks) as [DungeonId, readonly string[]][]) {
      const realIds = new Set(DUNGEONS[dungeonId].nodes.map(({ id }) => id));
      for (const id of ids) expect(realIds.has(id), `${dungeonId}:${id}`).toBe(true);
    }
    for (const [dungeonId, ids] of Object.entries(eventLandmarks) as [DungeonId, readonly string[]][]) {
      const realIds = new Set(getDungeonEvents(dungeonId).map(({ id }) => id));
      for (const id of ids) expect(realIds.has(id), `${dungeonId}:${id}`).toBe(true);
    }
  });

  it('raises and relieves demon tower fog without replaying a node or event', () => {
    const initial = createDungeonLawState('demon_tower_1');
    const first = clear(initial, 'blood_rune_trap', 'trap', 12);
    const highFog = clear(first, 'fog_lesser_demon', 'monster', 7);

    expect(getDungeonLawDisplay(highFog)).toMatchObject({ status: '雾压 2/3', severity: 'danger' });
    expect(getDungeonLawModifiers(highFog).encounter.allStatsPercent).toBe(10);
    expect(clear(highFog, 'fog_lesser_demon', 'monster', 99)).toEqual(highFog);

    const landmark = clear(highFog, 'sealed_cache');
    const relieved = signalDungeonEvent(landmark, {
      eventId: 'blood_rune_stair',
      outcome: { success: true }
    });
    expect(getDungeonLawDisplay(relieved).status).toBe('雾压 0/3');
    expect(signalDungeonEvent(relieved, { eventId: 'blood_rune_stair', outcome: { success: true } })).toEqual(relieved);
    expect(initial).toEqual(createDungeonLawState('demon_tower_1'));
  });

  it('cycles metro tides and lets the signal box recalibrate mirror tide', () => {
    const initial = createDungeonLawState('metro_abyss');
    const flood = clear(initial, 'platform_arrival');
    const mirror = clear(flood, 'tide_boatman', 'monster');

    expect(getDungeonLawDisplay(flood).status).toBe('涨潮');
    expect(getDungeonLawDisplay(mirror).status).toBe('镜潮');
    expect(getDungeonLawModifiers(mirror).trap).toEqual({ damagePercent: 20, dcPercent: 20 });
    expect(getDungeonLawModifiers(mirror, { isReflectionEncounter: true }).encounter.allStatsPercent).toBe(20);

    const recalibrated = clear(mirror, 'signal_cache');
    expect(getDungeonLawDisplay(recalibrated).status).toBe('退潮');
    expect(clear(recalibrated, 'signal_cache')).toEqual(recalibrated);
  });

  it('toggles mine gravity at real switches with opposite trap and defense effects', () => {
    const initial = createDungeonLawState('starfall_mine');
    expect(getDungeonLawModifiers(initial)).toMatchObject({
      encounter: { defensePercent: 20 },
      trap: { damagePercent: -20, dcPercent: -20 }
    });

    const downward = clear(initial, 'tilted_gravity_switch');
    expect(getDungeonLawDisplay(downward).status).toBe('下沉');
    expect(getDungeonLawModifiers(downward)).toMatchObject({
      encounter: { defensePercent: -20 },
      trap: { damagePercent: 20, dcPercent: 20 }
    });

    const upward = clear(downward, 'backup_gravity_well');
    expect(getDungeonLawDisplay(upward).status).toBe('上浮');
    expect(clear(upward, 'backup_gravity_well')).toEqual(upward);
  });

  it('builds hospital pollution, weakens healing, and recovers at pharmacy and triage', () => {
    let state = createDungeonLawState('rust_hospital');
    state = clear(state, 'rust_gurney_trap', 'trap', 8);
    state = clear(state, 'plague_orderly', 'monster', 5);
    state = clear(state, 'disinfectant_mist_trap', 'trap', 10);
    state = clear(state, 'pulse_doctor', 'monster', 3);

    expect(getDungeonLawDisplay(state).status).toBe('污染 4/4');
    expect(getDungeonLawModifiers(state)).toMatchObject({
      encounter: { artPowerPercent: 20 },
      healingPercent: -20
    });

    state = clear(state, 'pharmacy_reward');
    state = signalDungeonEvent(state, { eventId: 'triage_ward', outcome: { success: true } });
    expect(getDungeonLawDisplay(state).status).toBe('污染 2/4');
    expect(getDungeonLawModifiers(state).healingPercent).toBe(0);
  });

  it('penalizes repeated arena openings and rewrites the ruling after all three styles win', () => {
    let state = createDungeonLawState('ash_arena');
    state = win(state, 'ash_duelist', 'attack');
    state = win(state, 'ember_pit_duelist', 'attack');

    expect(getDungeonLawDisplay(state)).toMatchObject({ status: '连续复招：力', severity: 'danger' });
    expect(getDungeonLawModifiers(state).outgoingDamage.forcePercent).toBe(-20);

    const duplicate = signalCombatVictory(state, { nodeId: 'ember_pit_duelist', isBoss: false });
    expect(duplicate).toEqual(state);
    state = win(state, 'cinder_lancer', 'art');
    state = win(state, 'final_duelist', 'guard');
    state = win(state, 'furnace_judge', 'attack', true);

    expect(getCombatOpeningDistribution(state)).toEqual({ force: 2, art: 1, guard: 1 });
    expect(getDungeonLawDisplay(state)).toMatchObject({ targetReached: true, severity: 'resolved' });
    expect(getDungeonLawModifiers(state)).toMatchObject({
      outgoingDamage: { forcePercent: 10, artPercent: 10 },
      guardEffectPercent: 10
    });
  });

  it('seals archive features in order, never seals attack or defense, and restores at a real index', () => {
    let state = createDungeonLawState('dream_archive');
    state = clear(state, 'paper_librarian', 'monster');
    state = clear(state, 'margin_snare_trap', 'trap');
    state = clear(state, 'dream_jailer', 'monster');

    expect(state.law).toEqual({
      kind: 'dream_archive',
      sealedFeatures: ['consumable', 'method', 'pet']
    });
    expect(isArchiveFeatureAvailable(state, 'consumable')).toBe(false);
    expect(isArchiveFeatureAvailable(state, 'attack')).toBe(true);
    expect(isArchiveFeatureAvailable(state, 'defense')).toBe(true);
    expect(clear(state, 'dream_jailer', 'monster')).toEqual(state);

    const restored = clear(state, 'cracked_core_index_reward');
    expect(getDungeonLawDisplay(restored)).toMatchObject({ status: '已封存 0/3', targetReached: true });
    expect(isArchiveFeatureAvailable(restored, 'pet')).toBe(true);
  });

  it('locks a citadel counter for a biased boss approach and disables it for balance', () => {
    let biased = createDungeonLawState('void_citadel');
    biased = win(biased, 'void_knight', 'attack');
    biased = win(biased, 'first_echo_patrol', 'attack');
    biased = win(biased, 'echo_gate_guard', 'art');
    biased = signalCombatStarted(biased, { nodeId: 'main_god_echo', isBoss: true, openingAction: 'guard' });

    expect(getDungeonLawDisplay(biased).status).toBe('克制偏科：力');
    expect(getDungeonLawModifiers(biased, { isBossEncounter: true }).outgoingDamage.forcePercent).toBe(-20);
    expect(getDungeonLawModifiers(biased).outgoingDamage.forcePercent).toBe(0);

    let balanced = createDungeonLawState('void_citadel');
    balanced = win(balanced, 'void_knight', 'attack');
    balanced = win(balanced, 'first_echo_patrol', 'art');
    balanced = win(balanced, 'echo_gate_guard', 'guard');
    balanced = win(balanced, 'second_echo_patrol', 'attack');
    balanced = win(balanced, 'knight_afterimage', 'art');
    balanced = signalCombatStarted(balanced, { nodeId: 'main_god_echo', isBoss: true, openingAction: 'attack' });

    expect(getCombatOpeningDistribution(balanced)).toEqual({ force: 2, art: 2, guard: 1 });
    expect(getDungeonLawDisplay(balanced)).toMatchObject({
      status: '分布均衡，克制关闭',
      targetReached: true,
      severity: 'resolved'
    });
    expect(getDungeonLawModifiers(balanced, { isBossEncounter: true }).outgoingDamage).toEqual({
      forcePercent: 0,
      artPercent: 0
    });
  });

  it('deterministically counters a two-style tie instead of treating the missing third style as balanced', () => {
    let state = createDungeonLawState('void_citadel');
    state = win(state, 'void_knight', 'art');
    state = win(state, 'first_echo_patrol', 'attack');
    state = signalCombatStarted(state, { nodeId: 'main_god_echo', isBoss: true, openingAction: 'guard' });

    expect(getCombatOpeningDistribution(state)).toEqual({ force: 1, art: 1, guard: 0 });
    expect(state.law).toMatchObject({ bossAssessmentLocked: true, bossCounter: 'force' });
    expect(getDungeonLawDisplay(state)).toMatchObject({
      status: '克制偏科：力',
      targetReached: false,
      severity: 'danger'
    });
    expect(getDungeonLawModifiers(state, { isBossEncounter: true }).outgoingDamage.forcePercent).toBe(-20);
  });

  it('calibrates each temporal anchor once and resolves every penalty after dual calibration', () => {
    const initial = createDungeonLawState('temporal_observatory');
    expect(initial.law).toEqual({
      kind: 'temporal_observatory',
      pastCalibrated: false,
      futureCalibrated: false
    });
    expect(getDungeonLawDisplay(initial)).toMatchObject({
      title: '时间校准',
      status: '0/2 时序漂移',
      severity: 'danger',
      meter: { value: 0, max: 2 },
      targetReached: false
    });
    expect(getDungeonLawModifiers(initial, { isBossEncounter: true })).toMatchObject({
      encounter: { allStatsPercent: 20, defensePercent: 20 },
      trap: { damagePercent: 20, dcPercent: 20 }
    });

    const past = clear(initial, 'past_calibration_anchor');
    expect(past.law).toEqual({
      kind: 'temporal_observatory',
      pastCalibrated: true,
      futureCalibrated: false
    });
    expect(getDungeonLawDisplay(past)).toMatchObject({
      status: '1/2 单锚锁定',
      severity: 'warning',
      meter: { value: 1, max: 2 },
      targetReached: false
    });
    expect(getDungeonLawModifiers(past, { isBossEncounter: true })).toMatchObject({
      encounter: { allStatsPercent: 10, defensePercent: 0 },
      trap: { damagePercent: 20, dcPercent: 20 }
    });
    expect(clear(past, 'past_calibration_anchor')).toEqual(past);

    const future = clear(initial, 'future_calibration_anchor');
    expect(getDungeonLawModifiers(future, { isBossEncounter: true })).toMatchObject({
      encounter: { allStatsPercent: 10, defensePercent: 20 },
      trap: { damagePercent: 0, dcPercent: 0 }
    });
    expect(clear(future, 'future_calibration_anchor')).toEqual(future);

    const dual = clear(past, 'future_calibration_anchor');
    expect(getDungeonLawDisplay(dual)).toMatchObject({
      status: '2/2 双锚同步',
      severity: 'resolved',
      meter: { value: 2, max: 2 },
      targetReached: true
    });
    expect(getDungeonLawModifiers(dual, { isBossEncounter: true })).toEqual({
      encounter: { allStatsPercent: 0, defensePercent: 0, artPowerPercent: 0 },
      trap: { damagePercent: 0, dcPercent: 0 },
      healingPercent: 0,
      outgoingDamage: { forcePercent: 0, artPercent: 0 },
      guardEffectPercent: 0
    });
    expect(initial).toEqual(createDungeonLawState('temporal_observatory'));
  });

  it('snapshots causal passives and opens one ledger for each first-cleared non-boss danger', () => {
    const initial = createDungeonLawState('causal_clearinghouse');
    expect(initial.law).toEqual({
      kind: 'causal_clearinghouse',
      debt: 0,
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
    });
    expect(createDungeonLawState('causal_clearinghouse', {
      causalVisor: true,
      echoBreakerGauntlets: true,
      returnAnchorBelt: true
    }).law).toMatchObject({
      entryPassives: {
        causalVisor: true,
        echoBreakerGauntlets: true,
        returnAnchorBelt: true
      }
    });

    const harmless = clear(initial, 'cause_foyer', 'reward');
    expect(getCausalLedgerStatus(harmless)).toMatchObject({ pending: false, debt: 0 });

    const monster = clear(harmless, 'verdict_usher', 'monster');
    expect(getCausalLedgerStatus(monster)).toMatchObject({
      available: true,
      pending: true,
      debt: 0,
      pendingLedgerNodeId: 'verdict_usher',
      choices: {
        balance: { available: true },
        overdraw: { available: true },
        repay: { available: false }
      }
    });
    expect(getDungeonLawDisplay(monster).status).toContain('待平账');
    expect(clear(monster, 'verdict_usher', 'monster')).toEqual(monster);

    const balanced = resolveCausalLedgerChoice(monster, 'balance');
    expect(balanced).toMatchObject({
      resolved: true,
      effect: { healPercent: 0, rewardPoints: 0, damagePercent: 0 },
      state: {
        law: {
          debt: 0,
          pendingLedgerNodeId: null,
          settledLedgerNodeIds: ['verdict_usher']
        }
      }
    });
    const trap = clear(balanced.state, 'contradiction_line', 'trap');
    expect(getCausalLedgerStatus(trap).pendingLedgerNodeId).toBe('contradiction_line');
    expect(clear(initial, 'zero_sum_auditor', 'monster').law).toMatchObject({ pendingLedgerNodeId: null });
    expect(getDungeonLawModifiers(trap)).toEqual(getDungeonLawModifiers(initial));
  });

  it('resolves balance, overdraw, and repay with exact debt and health effects', () => {
    const balanced = resolveCausalLedgerChoice(
      clear(withCausalDebt(0), 'verdict_usher', 'monster'),
      'balance'
    );
    expect(balanced).toMatchObject({
      resolved: true,
      effect: { healPercent: 0, rewardPoints: 0, damagePercent: 0 },
      state: { law: { debt: 0, pendingLedgerNodeId: null } }
    });

    const overdrawn = resolveCausalLedgerChoice(
      clear(withCausalDebt(0), 'contradiction_line', 'trap'),
      'overdraw'
    );
    expect(overdrawn).toMatchObject({
      resolved: true,
      effect: { healPercent: 10, rewardPoints: 108, damagePercent: 0 },
      state: { law: { debt: 1, pendingLedgerNodeId: null } }
    });

    const capped = clear(withCausalDebt(4), 'verdict_usher', 'monster');
    expect(getCausalLedgerStatus(capped).choices.overdraw).toMatchObject({
      available: false,
      unavailableReason: expect.stringContaining('4/4')
    });
    const rejectedOverdraw = resolveCausalLedgerChoice(capped, 'overdraw');
    expect(rejectedOverdraw).toMatchObject({
      resolved: false,
      effect: { healPercent: 0, rewardPoints: 0, damagePercent: 0 }
    });
    expect(rejectedOverdraw.state).toEqual(capped);

    const repayable = clear(withCausalDebt(1), 'verdict_usher', 'monster');
    expect(getCausalLedgerStatus(repayable, { canAffordRepayDamage: false }).choices.repay).toMatchObject({
      available: false,
      unavailableReason: expect.stringContaining('生命不足')
    });
    expect(resolveCausalLedgerChoice(repayable, 'repay', { canAffordRepayDamage: false }).state).toEqual(repayable);
    expect(resolveCausalLedgerChoice(repayable, 'repay')).toMatchObject({
      resolved: true,
      effect: { healPercent: 0, rewardPoints: 0, damagePercent: 15 },
      state: { law: { debt: 0, pendingLedgerNodeId: null } }
    });
  });

  it('applies all three frozen causal equipment passives without leaking into static modifiers', () => {
    let visor = clear(withCausalDebt(0, { causalVisor: true }), 'verdict_usher', 'monster');
    const credited = resolveCausalLedgerChoice(visor, 'overdraw');
    expect(credited.state.law).toMatchObject({ debt: 0, visorCreditUsed: true });
    visor = clear(credited.state, 'contradiction_line', 'trap');
    expect(resolveCausalLedgerChoice(visor, 'overdraw').state.law).toMatchObject({
      debt: 1,
      visorCreditUsed: true
    });

    const anchored = clear(withCausalDebt(1, { returnAnchorBelt: true }), 'verdict_usher', 'monster');
    expect(getCausalLedgerStatus(anchored).repayDamagePercent).toBe(8);
    expect(resolveCausalLedgerChoice(anchored, 'repay').effect.damagePercent).toBe(8);

    const identity = getDungeonLawModifiers(createDungeonLawState('causal_clearinghouse', {
      causalVisor: true,
      echoBreakerGauntlets: true,
      returnAnchorBelt: true
    }), { isBossEncounter: true });
    expect(identity).toEqual({
      encounter: { allStatsPercent: 0, defensePercent: 0, artPowerPercent: 0 },
      trap: { damagePercent: 0, dcPercent: 0 },
      healingPercent: 0,
      outgoingDamage: { forcePercent: 0, artPercent: 0 },
      guardEffectPercent: 0
    });
  });

  it('freezes boss debt into seals once and consumes exactly one 50% seal per hit', () => {
    const locked = signalCombatStarted(withCausalDebt(4), {
      nodeId: 'zero_sum_auditor',
      isBoss: true,
      openingAction: 'attack'
    });
    expect(locked.law).toMatchObject({ bossDebtLocked: true, collectionSeals: 4, debt: 4 });
    expect(getDungeonLawDisplay(locked).status).toContain('追缴印 4');
    expect(signalCombatStarted(locked, {
      nodeId: 'zero_sum_auditor',
      isBoss: true,
      openingAction: 'art'
    })).toEqual(locked);

    let current = locked;
    for (const remaining of [3, 2, 1, 0]) {
      const consumption = consumeCausalCollectionSeal(current);
      expect(consumption).toMatchObject({ consumed: true, finalDamageMultiplier: 0.5 });
      expect(consumption.state.law).toMatchObject({ collectionSeals: remaining });
      current = consumption.state;
    }
    expect(consumeCausalCollectionSeal(current)).toEqual({
      state: current,
      consumed: false,
      finalDamageMultiplier: 1
    });

    const brokenEcho = signalCombatStarted(withCausalDebt(4, { echoBreakerGauntlets: true }), {
      nodeId: 'zero_sum_auditor',
      isBoss: true,
      openingAction: 'guard'
    });
    expect(brokenEcho.law).toMatchObject({ bossDebtLocked: true, collectionSeals: 3, debt: 4 });
  });

  it('normalizes illegal legacy values, remains deterministic, and is JSON round-trippable', () => {
    const transitionSource = clear(createDungeonLawState('metro_abyss'), 'platform_arrival');
    const transitionSnapshot = structuredClone(transitionSource);
    const transition = { node: node('tide_boatman', 'monster'), damageTaken: 4 };
    expect(signalFirstNodeClear(transitionSource, transition)).toEqual(
      signalFirstNodeClear(structuredClone(transitionSource), transition)
    );
    expect(transitionSource).toEqual(transitionSnapshot);

    const cases: Array<[DungeonId, unknown, unknown]> = [
      ['demon_tower_1', { fogPressure: 99 }, { kind: 'demon_tower', fogPressure: 3 }],
      ['metro_abyss', { tide: 'storm' }, { kind: 'metro_abyss', tide: 'ebb' }],
      ['starfall_mine', { gravity: 'sideways' }, { kind: 'starfall_mine', gravity: 'upward' }],
      ['rust_hospital', { pollution: -9 }, { kind: 'rust_hospital', pollution: 0 }],
      ['ash_arena', { repeatedStyle: 'cheat' }, { kind: 'ash_arena' }],
      [
        'dream_archive',
        { sealedFeatures: ['pet', 'bad', 'consumable', 'pet'] },
        { kind: 'dream_archive', sealedFeatures: ['consumable', 'pet'] }
      ],
      [
        'void_citadel',
        { bossAssessmentLocked: true, bossCounter: 'speed' },
        { kind: 'void_citadel', bossAssessmentLocked: true, bossCounter: 'force' }
      ],
      [
        'temporal_observatory',
        { pastCalibrated: 'yes', futureCalibrated: 1 },
        { kind: 'temporal_observatory', pastCalibrated: false, futureCalibrated: false }
      ],
      [
        'causal_clearinghouse',
        {
          debt: 99.8,
          pendingLedgerNodeId: 'pending_audit',
          settledLedgerNodeIds: ['settled_b', 'settled_a', 'settled_b', '', 4],
          bossDebtLocked: true,
          collectionSeals: 99,
          entryPassives: {
            causalVisor: true,
            echoBreakerGauntlets: 'yes',
            returnAnchorBelt: 1
          },
          visorCreditUsed: true
        },
        {
          kind: 'causal_clearinghouse',
          debt: 4,
          pendingLedgerNodeId: 'pending_audit',
          settledLedgerNodeIds: ['settled_b', 'settled_a'],
          bossDebtLocked: true,
          collectionSeals: 4,
          entryPassives: {
            causalVisor: true,
            echoBreakerGauntlets: false,
            returnAnchorBelt: false
          },
          visorCreditUsed: true
        }
      ]
    ];

    for (const [dungeonId, law, expectedLaw] of cases) {
      const legacy = {
        rulesVersion: 0,
        dungeonId: 'wrong',
        clearedNodeIds: ['a', 'a', '', 4],
        resolvedEventIds: ['e', 'e'],
        combatOpenings: {
          z: { isBoss: false, style: 'force' },
          broken: { isBoss: 'yes', style: 'speed' }
        },
        combatVictoryNodeIds: ['z', 'z'],
        law
      };
      const before = structuredClone(legacy);
      const first = normalizeDungeonLawState(legacy, dungeonId);
      const second = normalizeDungeonLawState(structuredClone(legacy), dungeonId);

      expect(first).toEqual(second);
      expect(legacy).toEqual(before);
      expect(first.law).toEqual(expectedLaw);
      expect(first.clearedNodeIds).toEqual(['a']);
      expect(first.combatVictoryNodeIds).toEqual(['z']);
      expect(JSON.parse(JSON.stringify(first))).toEqual(first);
      expectBoundedModifiers(first);
    }

    expect(normalizeDungeonLawState({ law: { debt: 2 } }, 'causal_clearinghouse').law).toEqual({
      kind: 'causal_clearinghouse',
      debt: 2,
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
    });
    expect(normalizeDungeonLawState({
      law: {
        debt: 4,
        pendingLedgerNodeId: 'settled',
        settledLedgerNodeIds: ['settled'],
        bossDebtLocked: true,
        collectionSeals: 4,
        entryPassives: { echoBreakerGauntlets: true }
      }
    }, 'causal_clearinghouse').law).toMatchObject({
      pendingLedgerNodeId: null,
      collectionSeals: 3,
      entryPassives: { echoBreakerGauntlets: true }
    });
  });

  it('creates the entropy ark at neutral entropy and snapshots nested passives compatibly', () => {
    expect(createDungeonLawState('entropy_ark').law).toEqual({
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
    });

    expect(createDungeonLawState('entropy_ark', {
      entryPassives: {
        entropyCompass: true,
        dissipationMantle: true,
        arkKeelBoots: true,
        causalVisor: true
      }
    }).law).toMatchObject({
      entryPassives: {
        entropyCompass: true,
        dissipationMantle: true,
        arkKeelBoots: true
      }
    });
    expect(createDungeonLawState('causal_clearinghouse', {
      entryPassives: { causalVisor: true, echoBreakerGauntlets: true, returnAnchorBelt: true }
    }).law).toMatchObject({
      entryPassives: { causalVisor: true, echoBreakerGauntlets: true, returnAnchorBelt: true }
    });
  });

  it('applies first-clear entropy changes, compass credit, and heading-console exceptions exactly once', () => {
    let state = createDungeonLawState('entropy_ark', { entropyCompass: true });
    state = clear(state, 'deck_raider', 'monster');
    expect(state.law).toMatchObject({ entropy: 2, compassCreditUsed: true });
    expect(clear(state, 'deck_raider', 'monster')).toEqual(state);

    state = clear(state, 'fracture_trap', 'trap');
    expect(state.law).toMatchObject({ entropy: 3, compassCreditUsed: true });
    state = clear(state, 'supply_reward', 'reward');
    expect(state.law).toMatchObject({ entropy: 2 });
    expect(clear(state, 'last_helmsman', 'monster').law).toMatchObject({ entropy: 2 });

    const pending = clear(state, 'bow_heading_console', 'reward');
    expect(pending.law).toMatchObject({ entropy: 2, pendingHeadingNodeId: 'bow_heading_console' });
    expect(getEntropyHeadingStatus(pending)).toMatchObject({
      available: true,
      pending: true,
      choices: { steady: { available: true }, rush: { available: true } }
    });
  });

  it('resolves steady and rush headings with bounded choices, mantle reduction, and idempotent rejection', () => {
    const steadyPending = clear(createDungeonLawState('entropy_ark'), 'bow_heading_console');
    const steady = resolveEntropyHeadingChoice(steadyPending, 'steady');
    expect(steady).toMatchObject({
      resolved: true,
      state: {
        law: {
          entropy: 1,
          pendingHeadingNodeId: null,
          resolvedHeadingChoices: { bow_heading_console: 'steady' }
        }
      }
    });
    const duplicate = resolveEntropyHeadingChoice(steady.state, 'steady');
    expect(duplicate).toMatchObject({ resolved: false, unavailableReason: expect.any(String) });
    expect(duplicate.state).toEqual(steady.state);

    const mantlePending = clear(
      createDungeonLawState('entropy_ark', { dissipationMantle: true }),
      'midship_heading_console'
    );
    expect(resolveEntropyHeadingChoice(mantlePending, 'steady').state.law).toMatchObject({ entropy: 0 });

    const rushPending = clear(createDungeonLawState('entropy_ark', { entropyCompass: true }), 'stern_heading_console');
    expect(resolveEntropyHeadingChoice(rushPending, 'rush').state.law).toMatchObject({
      entropy: 3,
      compassCreditUsed: false,
      resolvedHeadingChoices: { stern_heading_console: 'rush' }
    });

    const atZero = normalizeDungeonLawState({ law: {
      entropy: 0,
      pendingHeadingNodeId: 'bow_heading_console'
    } }, 'entropy_ark');
    expect(getEntropyHeadingStatus(atZero).choices).toEqual({
      steady: { available: false, unavailableReason: expect.stringContaining('0/4') },
      rush: { available: true }
    });
    const atFour = normalizeDungeonLawState({ law: {
      entropy: 4,
      pendingHeadingNodeId: 'bow_heading_console'
    } }, 'entropy_ark');
    expect(getEntropyHeadingStatus(atFour).choices).toEqual({
      steady: { available: true },
      rush: { available: false, unavailableReason: expect.stringContaining('4/4') }
    });
    const illegal = resolveEntropyHeadingChoice(atFour, 'warp' as never);
    expect(illegal).toMatchObject({ resolved: false, unavailableReason: expect.any(String) });
    expect(illegal.state).toEqual(atFour);
    expect(getEntropyHeadingStatus(createDungeonLawState('demon_tower_1'))).toMatchObject({
      available: false,
      pending: false
    });
  });

  it('locks boss entropy once, applies keel boots, and freezes all later automatic changes', () => {
    const extreme = normalizeDungeonLawState({ law: { entropy: 4 } }, 'entropy_ark');
    const locked = signalCombatStarted(extreme, {
      nodeId: 'last_helmsman',
      isBoss: true,
      openingAction: 'attack'
    });
    expect(locked.law).toMatchObject({ entropy: 4, bossEntropyLocked: true, collapseLayers: 2 });
    expect(signalCombatStarted(locked, {
      nodeId: 'last_helmsman',
      isBoss: true,
      openingAction: 'art'
    })).toEqual(locked);
    expect(clear(locked, 'post_lock_trap', 'trap').law).toMatchObject({ entropy: 4, collapseLayers: 2 });
    expect(clear(locked, 'post_lock_reward', 'reward').law).toMatchObject({ entropy: 4, collapseLayers: 2 });

    const booted = signalCombatStarted(
      normalizeDungeonLawState({ law: {
        entropy: 4,
        entryPassives: { arkKeelBoots: true }
      } }, 'entropy_ark'),
      { nodeId: 'last_helmsman', isBoss: true, openingAction: 'guard' }
    );
    expect(booted.law).toMatchObject({ bossEntropyLocked: true, collapseLayers: 1 });
  });

  it('derives bounded entropy modifiers and displays pending, neutral, and locked ark states', () => {
    const expected = [
      { entropy: 0, trap: -20, defense: 20, ordinary: 0, output: 0 },
      { entropy: 1, trap: -10, defense: 10, ordinary: 0, output: 0 },
      { entropy: 2, trap: 0, defense: 0, ordinary: 0, output: 0 },
      { entropy: 3, trap: 10, defense: 0, ordinary: 10, output: 10 },
      { entropy: 4, trap: 20, defense: 0, ordinary: 20, output: 20 }
    ] as const;
    for (const row of expected) {
      const state = normalizeDungeonLawState({ law: { entropy: row.entropy } }, 'entropy_ark');
      expect(getDungeonLawModifiers(state)).toMatchObject({
        encounter: { allStatsPercent: row.ordinary, defensePercent: row.defense },
        trap: { damagePercent: row.trap, dcPercent: row.trap },
        outgoingDamage: { forcePercent: row.output, artPercent: row.output }
      });
      expectBoundedModifiers(state);
    }

    const locked = normalizeDungeonLawState({ law: {
      entropy: 4,
      bossEntropyLocked: true,
      collapseLayers: 1
    } }, 'entropy_ark');
    expect(getDungeonLawModifiers(locked, { isBossEncounter: true })).toMatchObject({
      encounter: { allStatsPercent: 10 },
      outgoingDamage: { forcePercent: 20, artPercent: 20 }
    });
    expect(getDungeonLawDisplay(createDungeonLawState('entropy_ark'))).toMatchObject({
      title: '方舟航态',
      status: '熵值 2/4',
      meter: { value: 2, max: 4 },
      targetReached: true
    });
    expect(getDungeonLawDisplay(clear(createDungeonLawState('entropy_ark'), 'bow_heading_console'))).toMatchObject({
      status: '熵值 2/4，待选航',
      targetReached: false
    });
    expect(getDungeonLawDisplay(locked)).toMatchObject({
      status: '熵值 4/4，已锁定，崩解层 1',
      targetReached: false
    });
  });

  it('normalizes malformed entropy saves without resetting valid old-run progress', () => {
    expect(normalizeDungeonLawState({ law: {
      entropy: 3.9,
      pendingHeadingNodeId: 'settled_console',
      resolvedHeadingChoices: {
        settled_console: 'steady',
        rush_console: 'rush',
        broken_console: 'warp',
        '': 'steady'
      },
      bossEntropyLocked: false,
      collapseLayers: 2,
      entryPassives: {
        entropyCompass: true,
        dissipationMantle: 'yes',
        arkKeelBoots: 1
      },
      compassCreditUsed: true
    } }, 'entropy_ark').law).toEqual({
      kind: 'entropy_ark',
      entropy: 3,
      pendingHeadingNodeId: null,
      resolvedHeadingChoices: {
        rush_console: 'rush',
        settled_console: 'steady'
      },
      bossEntropyLocked: false,
      collapseLayers: 0,
      entryPassives: {
        entropyCompass: true,
        dissipationMantle: false,
        arkKeelBoots: false
      },
      compassCreditUsed: true
    });
    expect(normalizeDungeonLawState({ law: {
      entropy: 99,
      pendingHeadingNodeId: 'bow_heading_console',
      bossEntropyLocked: true,
      collapseLayers: 99,
      compassCreditUsed: true
    } }, 'entropy_ark').law).toMatchObject({
      entropy: 4,
      pendingHeadingNodeId: null,
      bossEntropyLocked: true,
      collapseLayers: 2,
      compassCreditUsed: false
    });
  });

  it('creates JSON-safe mirror city defaults and freezes all three entry passives', () => {
    const initial = createDungeonLawState('mirror_cycle_city');
    expect(initial.law).toEqual({
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
    });
    expect(createDungeonLawState('mirror_cycle_city', {
      entryPassives: {
        parallaxVisor: true,
        phaseweaveMantle: true,
        homecomingPrism: true
      }
    }).law).toMatchObject({
      entryPassives: {
        parallaxVisor: true,
        phaseweaveMantle: true,
        homecomingPrism: true
      }
    });
    expect(JSON.parse(JSON.stringify(initial))).toEqual(initial);
  });

  it('resolves each authored mirror phase choice once with exact transition costs', () => {
    let state = clear(createDungeonLawState('mirror_cycle_city'), 'first_phase_mirror');
    expect(getMirrorCityPhaseStatus(state)).toMatchObject({
      available: true,
      pending: true,
      currentPhase: 'real',
      pendingPhaseNodeId: 'first_phase_mirror',
      resolvedChoiceCount: 0,
      allChoicesResolved: false,
      choices: {
        real: { available: true, phaseChanged: false, damagePercent: 0 },
        mirror: { available: true, phaseChanged: true, damagePercent: 10 }
      }
    });

    const first = resolveMirrorCityPhaseChoice(state, 'mirror');
    expect(first).toMatchObject({ resolved: true, phaseChanged: true, damagePercent: 10 });
    expect(first.state.law).toMatchObject({
      currentPhase: 'mirror',
      pendingPhaseNodeId: null,
      resolvedPhaseChoices: { first_phase_mirror: 'mirror' }
    });
    const duplicate = resolveMirrorCityPhaseChoice(first.state, 'real');
    expect(duplicate).toMatchObject({
      resolved: false,
      phaseChanged: false,
      damagePercent: 0,
      unavailableReason: expect.any(String)
    });
    expect(duplicate.state).toEqual(first.state);

    state = clear(first.state, 'second_phase_mirror');
    const second = resolveMirrorCityPhaseChoice(state, 'mirror');
    expect(second).toMatchObject({ resolved: true, phaseChanged: false, damagePercent: 0 });
    state = clear(second.state, 'third_phase_mirror');
    const third = resolveMirrorCityPhaseChoice(state, 'real');
    expect(third).toMatchObject({ resolved: true, phaseChanged: true, damagePercent: 10 });
    expect(getMirrorCityPhaseStatus(third.state)).toMatchObject({
      pending: false,
      currentPhase: 'real',
      resolvedChoiceCount: 3,
      allChoicesResolved: true
    });

    const mantlePending = clear(
      createDungeonLawState('mirror_cycle_city', { phaseweaveMantle: true }),
      'first_phase_mirror'
    );
    expect(resolveMirrorCityPhaseChoice(mantlePending, 'mirror')).toMatchObject({
      resolved: true,
      phaseChanged: true,
      damagePercent: 5
    });
  });

  it('credits anchors only in their matching current phase and applies exact phase output', () => {
    const initial = createDungeonLawState('mirror_cycle_city');
    const wrongMirrorAnchor = clear(initial, 'mirror_anchor');
    expect(wrongMirrorAnchor.law).toMatchObject({ anchors: { real: false, mirror: false } });
    expect(getDungeonLawModifiers(initial).outgoingDamage).toEqual({
      forcePercent: 12,
      artPercent: -6
    });

    const visor = createDungeonLawState('mirror_cycle_city', { parallaxVisor: true });
    expect(getDungeonLawModifiers(visor).outgoingDamage).toEqual({ forcePercent: 12, artPercent: 0 });

    const pending = clear(initial, 'first_phase_mirror');
    const mirrored = resolveMirrorCityPhaseChoice(pending, 'mirror').state;
    expect(getDungeonLawModifiers(mirrored).outgoingDamage).toEqual({
      forcePercent: -6,
      artPercent: 12
    });
    expect(getDungeonLawModifiers(resolveMirrorCityPhaseChoice(
      clear(visor, 'first_phase_mirror'),
      'mirror'
    ).state).outgoingDamage).toEqual({ forcePercent: 0, artPercent: 12 });
    expect(clear(mirrored, 'mirror_anchor').law).toMatchObject({
      anchors: { real: false, mirror: true }
    });
    expect(clear(initial, 'real_anchor').law).toMatchObject({
      anchors: { real: true, mirror: false }
    });
  });

  it('snapshots boss anchors once and consumes one shell only for each positive damage action', () => {
    const pending = clear(createDungeonLawState('mirror_cycle_city'), 'first_phase_mirror');
    const started = signalCombatStarted(pending, {
      nodeId: 'nameless_reflection',
      isBoss: true,
      openingAction: 'attack'
    });
    expect(started.law).toMatchObject({
      pendingPhaseNodeId: null,
      bossAnchorSnapshot: { real: false, mirror: false },
      brokenMirrorShells: 0
    });
    expect(getMirrorCityShellStatus(started)).toEqual({
      available: true,
      bossStarted: true,
      anchoredPhaseCount: 0,
      prismCredit: 0,
      totalShells: 2,
      brokenMirrorShells: 0,
      remainingShells: 2
    });
    expect(consumeMirrorCityShell(started, 0)).toEqual({
      state: started,
      consumed: false,
      finalDamageMultiplier: 1
    });

    const first = consumeMirrorCityShell(started, 20);
    expect(first).toMatchObject({ consumed: true, finalDamageMultiplier: 0.5 });
    expect(getMirrorCityShellStatus(first.state)).toMatchObject({
      brokenMirrorShells: 1,
      remainingShells: 1
    });
    const awakened = signalCombatStarted(first.state, {
      nodeId: 'nameless_reflection',
      isBoss: true,
      openingAction: 'art'
    });
    expect(awakened).toEqual(first.state);
    const second = consumeMirrorCityShell(awakened, 1);
    expect(getMirrorCityShellStatus(second.state)).toMatchObject({
      available: false,
      brokenMirrorShells: 2,
      remainingShells: 0
    });
    expect(consumeMirrorCityShell(second.state, 99)).toEqual({
      state: second.state,
      consumed: false,
      finalDamageMultiplier: 1
    });

    const prismState = normalizeDungeonLawState({ law: {
      anchors: { real: true, mirror: false },
      entryPassives: { homecomingPrism: true }
    } }, 'mirror_cycle_city');
    const prismStarted = signalCombatStarted(prismState, {
      nodeId: 'nameless_reflection',
      isBoss: true,
      openingAction: 'guard'
    });
    expect(getMirrorCityShellStatus(prismStarted)).toMatchObject({
      anchoredPhaseCount: 1,
      prismCredit: 1,
      totalShells: 0,
      remainingShells: 0
    });
  });

  it('normalizes mirror city saves to authored ids and remains idempotent', () => {
    const legacy = {
      law: {
        currentPhase: 'sideways',
        pendingPhaseNodeId: 'first_phase_mirror',
        resolvedPhaseChoices: {
          first_phase_mirror: 'mirror',
          second_phase_mirror: 'real',
          third_phase_mirror: 'invalid',
          invented_phase_node: 'mirror'
        },
        anchors: { real: true, mirror: 'yes' },
        bossAnchorSnapshot: { real: false, mirror: false },
        brokenMirrorShells: 99,
        entryPassives: {
          parallaxVisor: true,
          phaseweaveMantle: 'yes',
          homecomingPrism: false
        }
      }
    };
    const normalized = normalizeDungeonLawState(legacy, 'mirror_cycle_city');
    expect(normalized.law).toEqual({
      kind: 'mirror_cycle_city',
      currentPhase: 'real',
      pendingPhaseNodeId: null,
      resolvedPhaseChoices: {
        first_phase_mirror: 'mirror',
        second_phase_mirror: 'real'
      },
      anchors: { real: true, mirror: false },
      bossAnchorSnapshot: { real: false, mirror: false },
      brokenMirrorShells: 2,
      entryPassives: {
        parallaxVisor: true,
        phaseweaveMantle: false,
        homecomingPrism: false
      }
    });
    expect(normalizeDungeonLawState(normalized, 'mirror_cycle_city')).toEqual(normalized);
    expect(JSON.parse(JSON.stringify(normalized))).toEqual(normalized);
    expect(getDungeonLawDisplay(normalized)).toMatchObject({
      dungeonId: 'mirror_cycle_city',
      title: '镜海相位',
      status: '现实相位，镜壳 0/2',
      meter: { value: 2, max: 3 }
    });
  });
});

describe('Tier-19 panopticon three-phase law', () => {
  function completeRelays(state = createDungeonLawState(PANOPTICON_CITY_DUNGEON_ID)): DungeonLawState {
    let next = state;
    for (const nodeId of DUNGEON_LAW_LANDMARKS.panopticon_city.relayNodeIds) {
      next = signalFirstNodeClear(next, { node: { id: nodeId, type: 'reward' } });
    }
    return next;
  }

  it('rotates on every move and resolves exposure, visor evasion, matte reduction, decoy rewards, and refraction charges', () => {
    let plain = createDungeonLawState(PANOPTICON_CITY_DUNGEON_ID);
    const first = advancePanopticonScan(plain, { x: 0, y: 0 });
    expect(first).toMatchObject({ phaseBefore: 0, phaseAfter: 1, exposed: true, damagePercent: 8 });
    plain = first.state;
    expect(getPanopticonStatus(plain)).toMatchObject({ moveCount: 1, exposureCount: 1, scanPhase: 1 });

    const protectedState = createDungeonLawState(PANOPTICON_CITY_DUNGEON_ID, {
      entryGear: { predictiveVisor: true, matteShell: true }
    });
    const protectedFirst = advancePanopticonScan(protectedState, { x: 0, y: 0 });
    expect(protectedFirst).toMatchObject({ exposed: true, evaded: true, damagePercent: 0 });
    const cycled = advancePanopticonScan(
      advancePanopticonScan(protectedFirst.state, { x: 0, y: 0 }).state,
      { x: 0, y: 0 }
    );
    const repeatedPhase = advancePanopticonScan(cycled.state, { x: 0, y: 0 });
    expect(repeatedPhase).toMatchObject({ phaseBefore: 0, exposed: true, evaded: false, damagePercent: 4 });

    const complete = completeRelays();
    const shadow = selectPanopticonRoute(complete, 'shadow').state;
    expect(advancePanopticonScan(shadow, { x: 0, y: 0 })).toMatchObject({ scanned: true, exposed: false, damagePercent: 0 });

    let decoy = selectPanopticonRoute(complete, 'decoy').state;
    for (let index = 0; index < 4; index += 1) {
      const phase = getPanopticonStatus(decoy).scanPhase;
      const advanced = advancePanopticonScan(decoy, { x: phase, y: 0 });
      expect(advanced.rewardPoints).toBe(index < 3 ? 120 : 0);
      decoy = advanced.state;
    }
    expect(getPanopticonStatus(decoy).decoyRewardsGranted).toBe(3);

    let refraction = selectPanopticonRoute(complete, 'refraction').state;
    for (let index = 0; index < 4; index += 1) {
      const phase = getPanopticonStatus(refraction).scanPhase;
      const advanced = advancePanopticonScan(refraction, { x: phase, y: 0 });
      expect(advanced.damagePercent).toBe(4);
      refraction = advanced.state;
    }
    expect(getPanopticonStatus(refraction).refractionCharges).toBe(3);
  });

  it('opens route selection only at the third relay, locks once, and freezes an inverse-prism boss snapshot', () => {
    const entry = createDungeonLawState(PANOPTICON_CITY_DUNGEON_ID, {
      entryGear: { blindlineCutter: true, inversePrism: true }
    });
    const complete = completeRelays(entry);
    expect(getPanopticonStatus(complete)).toMatchObject({
      completedRelayCount: 3,
      pendingRouteNodeId: 'south_blind_relay',
      readyForRoute: true
    });
    const selected = selectPanopticonRoute(complete, 'refraction');
    expect(selected.selected).toBe(true);
    expect(selectPanopticonRoute(selected.state, 'shadow').selected).toBe(false);

    let charged = selected.state;
    for (let index = 0; index < 2; index += 1) {
      const phase = getPanopticonStatus(charged).scanPhase;
      charged = advancePanopticonScan(charged, { x: phase, y: 0 }).state;
    }
    const frozen = freezePanopticonBossSnapshot(charged);
    expect(frozen.frozen).toBe(true);
    expect(getPanopticonStatus(frozen.state).bossSnapshot).toEqual({
      route: 'refraction', exposureCount: 1, refractionCharges: 3
    });
    expect(getDungeonLawModifiers(frozen.state, { isBossEncounter: true }).outgoingDamage).toEqual({
      forcePercent: 12, artPercent: 12
    });
  });

  it('strictly resets malformed chapter data without recovering gear from partial saved fields', () => {
    const valid = completeRelays(createDungeonLawState(PANOPTICON_CITY_DUNGEON_ID, {
      entryGear: {
        blindlineCutter: true,
        predictiveVisor: true,
        matteShell: true,
        inversePrism: true
      }
    }));
    if (valid.law.kind !== 'panopticon_city') throw new Error('Missing panopticon law');
    const malformed = {
      ...valid,
      law: { ...valid.law, scanPhase: 9 }
    };
    expect(normalizeDungeonLawState(malformed, PANOPTICON_CITY_DUNGEON_ID)).toEqual(
      createDungeonLawState(PANOPTICON_CITY_DUNGEON_ID)
    );
  });
});

describe('combat replay stage law', () => {
  function completeReplayLaw(
    route: CombatReplayRoute = 'sequence',
    frameEngraver = false
  ): DungeonLawState {
    let state = createDungeonLawState(COMBAT_REPLAY_STAGE_DUNGEON_ID, {
      entryGear: { frameEngraver }
    });
    const actions: readonly CombatReplayAction[] = ['attack', 'art', 'guard'];
    for (const [index, nodeId] of DUNGEON_LAW_LANDMARKS.combat_replay_stage.takeNodeIds.entries()) {
      const result = recordCombatReplayTake(state, nodeId, actions[index]!, (index + 1) * 100);
      if (!result.recorded) throw new Error(`Failed to record ${nodeId}`);
      state = result.state;
    }
    const selected = selectCombatReplayRoute(state, route);
    if (!selected.selected) throw new Error(`Failed to select ${route}`);
    return selected.state;
  }

  it('creates v1 state with an exact frozen four-gear entry snapshot', () => {
    const state = createDungeonLawState(COMBAT_REPLAY_STAGE_DUNGEON_ID, {
      entryGear: {
        frameEngraver: true,
        cueVisor: true,
        bufferPlate: false,
        thawMetronome: true
      }
    });
    expect(state).toEqual({
      rulesVersion: 1,
      dungeonId: 'combat_replay_stage',
      clearedNodeIds: [],
      resolvedEventIds: [],
      combatOpenings: {},
      combatVictoryNodeIds: [],
      law: {
        kind: 'combat_replay_stage',
        takes: [null, null, null],
        route: null,
        bossSnapshot: null,
        entryGear: {
          frameEngraver: true,
          cueVisor: true,
          bufferPlate: false,
          thawMetronome: true
        }
      }
    });
  });

  it('records exact ordered takes, rejects pseudo-enums, and enforces numeric boundaries', () => {
    const entry = createDungeonLawState(COMBAT_REPLAY_STAGE_DUNGEON_ID, {
      entryGear: { frameEngraver: true }
    });
    expect(recordCombatReplayTake(entry, 'take_beta', 'attack', 1)).toMatchObject({
      recorded: false
    });
    for (const value of [-1, 0.5, 10000, Number.NaN]) {
      expect(recordCombatReplayTake(entry, 'take_alpha', 'attack', value).recorded).toBe(false);
    }
    expect(recordCombatReplayTake(
      entry,
      'take_alpha',
      'skill' as CombatReplayAction,
      1
    ).recorded).toBe(false);
    expect(recordCombatReplayTake(
      entry,
      'fake_take' as 'take_alpha',
      'attack',
      1
    ).recorded).toBe(false);

    const zero = recordCombatReplayTake(entry, 'take_alpha', 'attack', 0);
    expect(zero.recorded).toBe(true);
    expect(zero.state.law).toMatchObject({
      takes: [{ action: 'attack', observedValue: 0, replayValue: 0 }, null, null]
    });
    const beta = recordCombatReplayTake(zero.state, 'take_beta', 'art', 1);
    expect(beta.state.law).toMatchObject({
      takes: [
        { action: 'attack', observedValue: 0, replayValue: 0 },
        { action: 'art', observedValue: 1, replayValue: 2 },
        null
      ]
    });
    const maximum = recordCombatReplayTake(beta.state, 'take_gamma', 'guard', 9999);
    expect(maximum.state.law).toMatchObject({
      takes: [
        expect.anything(),
        expect.anything(),
        { action: 'guard', observedValue: 9999, replayValue: 9999 }
      ]
    });
  });

  it('selects exactly one permanent route only after all three takes', () => {
    let state = createDungeonLawState(COMBAT_REPLAY_STAGE_DUNGEON_ID);
    expect(selectCombatReplayRoute(state, 'sequence').selected).toBe(false);
    for (const [index, nodeId] of DUNGEON_LAW_LANDMARKS.combat_replay_stage.takeNodeIds.entries()) {
      state = recordCombatReplayTake(state, nodeId, 'attack', index).state;
    }
    const invalid = selectCombatReplayRoute(state, 'loop' as CombatReplayRoute);
    expect(invalid.selected).toBe(false);
    expect(invalid.state).toBe(state);
    const selected = selectCombatReplayRoute(state, 'burst');
    expect(selected.selected).toBe(true);
    expect(selected.state.law).toMatchObject({ route: 'burst' });
    expect(selectCombatReplayRoute(selected.state, 'afterbeat')).toMatchObject({
      selected: false,
      state: selected.state
    });
  });

  it('freezes a deep Boss snapshot only when three takes and a route are complete', () => {
    const entry = createDungeonLawState(COMBAT_REPLAY_STAGE_DUNGEON_ID);
    expect(freezeCombatReplayBossSnapshot(entry).frozen).toBe(false);
    expect(signalCombatStarted(entry, {
      nodeId: 'final_cut_director', isBoss: true, openingAction: 'attack'
    })).toEqual(entry);

    const ready = completeReplayLaw('afterbeat', true);
    const frozen = freezeCombatReplayBossSnapshot(ready);
    expect(frozen.frozen).toBe(true);
    if (frozen.state.law.kind !== 'combat_replay_stage') throw new Error('Missing replay law');
    expect(frozen.state.law.bossSnapshot).toEqual({
      takes: [
        { action: 'attack', observedValue: 100, replayValue: 115 },
        { action: 'art', observedValue: 200, replayValue: 230 },
        { action: 'guard', observedValue: 300, replayValue: 345 }
      ],
      route: 'afterbeat'
    });
    expect(frozen.state.law.bossSnapshot!.takes).not.toBe(frozen.state.law.takes);
    expect(frozen.state.law.bossSnapshot!.takes[0]).not.toBe(frozen.state.law.takes[0]);

    const started = signalCombatStarted(ready, {
      nodeId: 'final_cut_director', isBoss: true, openingAction: 'art'
    });
    expect(started.law).toMatchObject({ bossSnapshot: frozen.state.law.bossSnapshot });
    expect(started.combatOpenings.final_cut_director).toEqual({ isBoss: true, style: 'art' });
  });

  it('strictly rejects extra keys, pseudo-enums, malformed values, and legacy saves without gear refill', () => {
    const valid = completeReplayLaw('sequence', true);
    const frozenValid = freezeCombatReplayBossSnapshot(valid).state;
    const fallback = createDungeonLawState(COMBAT_REPLAY_STAGE_DUNGEON_ID);
    if (valid.law.kind !== 'combat_replay_stage') throw new Error('Missing replay law');
    if (frozenValid.law.kind !== 'combat_replay_stage') throw new Error('Missing frozen replay law');
    const invalidStates: unknown[] = [
      { ...valid, extra: true },
      { ...valid, rulesVersion: 0 },
      { ...valid, law: { ...valid.law, extra: true } },
      { ...valid, law: { ...valid.law, route: 'pseudo' } },
      { ...valid, law: { ...valid.law, takes: [valid.law.takes[0], null, valid.law.takes[2]] } },
      {
        ...valid,
        law: {
          ...valid.law,
          takes: [
            { ...valid.law.takes[0]!, replayValue: 116 },
            valid.law.takes[1],
            valid.law.takes[2]
          ]
        }
      },
      { ...valid, law: { ...valid.law, entryGear: { ...valid.law.entryGear, extra: false } } },
      { ...valid, law: { kind: 'combat_replay_stage' } },
      {
        ...frozenValid,
        law: {
          ...frozenValid.law,
          bossSnapshot: { ...frozenValid.law.bossSnapshot!, extra: true }
        }
      },
      {
        ...frozenValid,
        law: {
          ...frozenValid.law,
          bossSnapshot: { ...frozenValid.law.bossSnapshot!, route: 'afterbeat' }
        }
      }
    ];
    for (const invalid of invalidStates) {
      const before = structuredClone(invalid);
      expect(normalizeDungeonLawState(invalid, COMBAT_REPLAY_STAGE_DUNGEON_ID)).toEqual(fallback);
      expect(invalid).toEqual(before);
    }
    expect(normalizeDungeonLawState(valid, COMBAT_REPLAY_STAGE_DUNGEON_ID)).toEqual(valid);
    expect(normalizeDungeonLawState(frozenValid, COMBAT_REPLAY_STAGE_DUNGEON_ID))
      .toEqual(frozenValid);
    expect(normalizeDungeonLawState(valid, COMBAT_REPLAY_STAGE_DUNGEON_ID)).not.toBe(valid);
    expect(fallback.law).toMatchObject({
      entryGear: {
        frameEngraver: false,
        cueVisor: false,
        bufferPlate: false,
        thawMetronome: false
      }
    });
  });

  it('returns deep status and display models without exposing saved tuples', () => {
    const frozen = freezeCombatReplayBossSnapshot(completeReplayLaw('burst')).state;
    const status = getCombatReplayStatus(frozen);
    const display = getDungeonLawDisplay(frozen);
    expect(status).toMatchObject({
      completedTakeCount: 3,
      nextTakeNodeId: null,
      route: 'burst',
      readyForRoute: true,
      readyForBoss: true
    });
    expect(display).toMatchObject({
      dungeonId: 'combat_replay_stage',
      title: '战痕复演律',
      severity: 'resolved',
      meter: { value: 3, max: 3 },
      targetReached: true
    });
    expect(display.status).toContain('路线:爆发剪辑');
    expect(display.status).toContain('Boss快照:已冻结');
    if (frozen.law.kind !== 'combat_replay_stage') throw new Error('Missing replay law');
    expect(status.takes).not.toBe(frozen.law.takes);
    expect(status.bossSnapshot).not.toBe(frozen.law.bossSnapshot);
  });
});

describe('redaction scriptorium law', () => {
  it('creates clean defaults and strictly sanitizes Tier-12 saves without inferring passives', () => {
    expect(createDungeonLawState('redaction_scriptorium')).toEqual({
      rulesVersion: 1,
      dungeonId: 'redaction_scriptorium',
      clearedNodeIds: [],
      resolvedEventIds: [],
      combatOpenings: {},
      combatVictoryNodeIds: [],
      law: {
        kind: 'redaction_scriptorium',
        pendingClauseNodeId: null,
        resolvedClauseChoices: {},
        bossClauseSnapshot: null,
        entryPassives: {
          redlineEdge: false,
          palimpsestMantle: false,
          finalProofSeal: false
        }
      }
    });

    const malformedTopLevel = normalizeDungeonLawState({
      rulesVersion: 99,
      dungeonId: 'mirror_cycle_city',
      equipment: { redlineEdge: true },
      law: { kind: 'redaction_scriptorium', entryPassives: { redlineEdge: true } }
    }, 'redaction_scriptorium');
    expect(malformedTopLevel).toEqual(createDungeonLawState('redaction_scriptorium'));

    const sanitized = normalizeDungeonLawState({
      rulesVersion: 1,
      dungeonId: 'redaction_scriptorium',
      clearedNodeIds: ['body_clause_desk', 7],
      resolvedEventIds: [],
      combatOpenings: {},
      combatVictoryNodeIds: [],
      law: {
        kind: 'redaction_scriptorium',
        pendingClauseNodeId: 'return_clause_desk',
        resolvedClauseChoices: {
          body_clause_desk: 'certify',
          memory_clause_desk: 'invalid',
          invented_clause: 'redact'
        },
        bossClauseSnapshot: null,
        entryPassives: {
          redlineEdge: true,
          palimpsestMantle: 'yes',
          finalProofSeal: false,
          inventedPassive: true
        }
      }
    }, 'redaction_scriptorium');
    expect(sanitized.law).toEqual({
      kind: 'redaction_scriptorium',
      pendingClauseNodeId: 'return_clause_desk',
      resolvedClauseChoices: { body_clause_desk: 'certify' },
      bossClauseSnapshot: null,
      entryPassives: {
        redlineEdge: true,
        palimpsestMantle: false,
        finalProofSeal: false
      }
    });
    expect(normalizeDungeonLawState(sanitized, 'redaction_scriptorium')).toEqual(sanitized);

    const recoveredBoss = normalizeDungeonLawState({
      rulesVersion: 1,
      dungeonId: 'redaction_scriptorium',
      law: {
        kind: 'redaction_scriptorium',
        pendingClauseNodeId: 'return_clause_desk',
        resolvedClauseChoices: {
          body_clause_desk: 'certify',
          memory_clause_desk: 'redact',
          return_clause_desk: 'certify'
        },
        bossClauseSnapshot: { body_clause_desk: 'certify', invented_clause: 'redact' },
        entryPassives: { redlineEdge: true }
      }
    }, 'redaction_scriptorium');
    expect(recoveredBoss.law).toMatchObject({
      pendingClauseNodeId: null,
      resolvedClauseChoices: {
        body_clause_desk: 'certify',
        memory_clause_desk: 'redact',
        return_clause_desk: 'certify'
      },
      bossClauseSnapshot: {
        body_clause_desk: 'certify',
        memory_clause_desk: 'redact',
        return_clause_desk: 'certify'
      }
    });

    const snapshotWins = normalizeDungeonLawState({
      rulesVersion: 1,
      dungeonId: 'redaction_scriptorium',
      law: {
        kind: 'redaction_scriptorium',
        resolvedClauseChoices: { body_clause_desk: 'redact' },
        bossClauseSnapshot: {
          body_clause_desk: 'certify',
          memory_clause_desk: 'redact',
          return_clause_desk: 'certify'
        }
      }
    }, 'redaction_scriptorium');
    expect(snapshotWins.law).toMatchObject({
      resolvedClauseChoices: {
        body_clause_desk: 'certify',
        memory_clause_desk: 'redact',
        return_clause_desk: 'certify'
      },
      bossClauseSnapshot: {
        body_clause_desk: 'certify',
        memory_clause_desk: 'redact',
        return_clause_desk: 'certify'
      }
    });
  });

  it('opens each clause exactly once, exposes exact choice costs, and keeps invalid resolutions pure', () => {
    const initial = createDungeonLawState('redaction_scriptorium');
    const bodyPending = clear(initial, 'body_clause_desk');
    expect(bodyPending.law).toMatchObject({ pendingClauseNodeId: 'body_clause_desk' });
    expect(clear(bodyPending, 'body_clause_desk')).toEqual(bodyPending);
    expect(getRedactionClauseStatus(bodyPending)).toMatchObject({
      available: true,
      pending: true,
      pendingClauseNodeId: 'body_clause_desk',
      costPercent: 8,
      certifiedCount: 0,
      redactedCount: 0,
      resolvedCount: 0,
      choices: {
        certify: { available: true, costPercent: 0 },
        redact: { available: true, costPercent: 8 }
      }
    });

    const certified = resolveRedactionClauseChoice(bodyPending, 'certify');
    expect(certified).toMatchObject({ resolved: true, costPercent: 0 });
    expect(getRedactionClauseStatus(certified.state)).toMatchObject({
      pending: false,
      certifiedCount: 1,
      redactedCount: 0,
      resolvedCount: 1
    });
    expect(clear(certified.state, 'body_clause_desk')).toEqual(certified.state);
    expect(resolveRedactionClauseChoice(certified.state, 'redact').state).toBe(certified.state);
    expect(resolveRedactionClauseChoice(
      bodyPending,
      'unknown' as RedactionChoice
    ).state).toBe(bodyPending);

    const alreadyResolved = {
      ...certified.state,
      law: certified.state.law.kind === 'redaction_scriptorium'
        ? { ...certified.state.law, pendingClauseNodeId: 'body_clause_desk' as const }
        : certified.state.law
    };
    expect(resolveRedactionClauseChoice(alreadyResolved, 'certify').state).toBe(alreadyResolved);
  });

  it('records certify and redact across all clauses and reports projected and frozen display clauses', () => {
    const resolved = resolveRedactionClauses(['certify', 'redact', 'certify']);
    const status = getRedactionClauseStatus(resolved);
    expect(status).toMatchObject({
      available: false,
      pending: false,
      certifiedCount: 2,
      redactedCount: 1,
      resolvedCount: 3,
      projectedClauseChoices: {
        body_clause_desk: 'certify',
        memory_clause_desk: 'redact',
        return_clause_desk: 'certify'
      }
    });
    expect(getDungeonLawDisplay(resolved)).toMatchObject({
      title: '删界终稿',
      status: expect.stringContaining('抉择 3/3，认证 2，删改 1'),
      meter: { value: 3, max: 3 },
      targetReached: true,
      redaction: {
        resolvedCount: 3,
        certifiedCount: 2,
        redactedCount: 1,
        pendingClauseNodeId: null,
        frozenClauseChoices: null
      }
    });

    const started = signalCombatStarted(resolved, {
      nodeId: 'last_redactor',
      isBoss: true,
      openingAction: 'attack'
    });
    expect(getDungeonLawDisplay(started).redaction).toMatchObject({
      projectedClauseChoices: status.projectedClauseChoices,
      frozenClauseChoices: status.projectedClauseChoices
    });
  });

  it('freezes the Boss clause snapshot and applies exact sealed, awakened, and passive modifiers', () => {
    const resolved = resolveRedactionClauses(['certify', 'certify', 'certify']);
    const beforeBoss = getDungeonLawModifiers(resolved, {
      isBossEncounter: true,
      isBossAwakened: true
    });
    expect(beforeBoss).toEqual({
      encounter: { allStatsPercent: 0, defensePercent: 0, artPowerPercent: 0 },
      trap: { damagePercent: 0, dcPercent: 0 },
      healingPercent: 0,
      outgoingDamage: { forcePercent: 0, artPercent: 0 },
      guardEffectPercent: 0
    });

    const started = signalCombatStarted(resolved, {
      nodeId: 'last_redactor',
      isBoss: true,
      openingAction: 'guard'
    });
    expect(started.law).toMatchObject({
      bossClauseSnapshot: {
        body_clause_desk: 'certify',
        memory_clause_desk: 'certify',
        return_clause_desk: 'certify'
      }
    });
    expect(getDungeonLawModifiers(started, { isBossEncounter: true })).toMatchObject({
      encounter: { defensePercent: 10, artPowerPercent: 10 },
      healingPercent: -10,
      guardEffectPercent: -10
    });
    expect(getDungeonLawModifiers(started, {
      isBossEncounter: true,
      isBossAwakened: true
    })).toMatchObject({
      encounter: { defensePercent: 20, artPowerPercent: 20 },
      healingPercent: -20,
      guardEffectPercent: -20
    });

    const passiveResolved = resolveRedactionClauses(
      ['certify', 'certify', 'certify'],
      { redlineEdge: true, palimpsestMantle: true, finalProofSeal: true }
    );
    const passiveBoss = signalCombatStarted(passiveResolved, {
      nodeId: 'last_redactor',
      isBoss: true,
      openingAction: 'art'
    });
    expect(getDungeonLawModifiers(passiveBoss, { isBossEncounter: true })).toMatchObject({
      encounter: { defensePercent: 5, artPowerPercent: 5 },
      healingPercent: -5,
      guardEffectPercent: -5
    });
    expect(getDungeonLawModifiers(passiveBoss, {
      isBossEncounter: true,
      isBossAwakened: true
    })).toMatchObject({
      encounter: { defensePercent: 10, artPowerPercent: 10 },
      healingPercent: -10,
      guardEffectPercent: -10
    });

    const repeatedStart = signalCombatStarted(started, {
      nodeId: 'last_redactor',
      isBoss: true,
      openingAction: 'art'
    });
    expect(repeatedStart).toEqual(started);
    expect(resolveRedactionClauseChoice(started, 'redact').state).toBe(started);
  });
});

describe('legacy auction court law', () => {
  it('creates clean defaults and strictly sanitizes Tier-13 saves without inferring passives', () => {
    const clean = createDungeonLawState(LEGACY_AUCTION_COURT_DUNGEON_ID);
    expect(clean).toEqual({
      rulesVersion: 1,
      dungeonId: 'legacy_auction_court',
      clearedNodeIds: [],
      resolvedEventIds: [],
      combatOpenings: {},
      combatVictoryNodeIds: [],
      law: {
        kind: 'legacy_auction_court',
        pendingLotNodeId: null,
        resolvedLotChoices: {},
        bossLotSnapshot: null,
        entryPassives: {
          legacyGavel: false,
          anonymousVeil: false,
          escrowPlate: false,
          finalLotBell: false
        }
      }
    });

    expect(normalizeDungeonLawState({
      rulesVersion: 99,
      dungeonId: 'legacy_auction_court',
      law: { kind: 'legacy_auction_court', entryPassives: { legacyGavel: true } }
    }, LEGACY_AUCTION_COURT_DUNGEON_ID)).toEqual(clean);
    expect(normalizeDungeonLawState({
      rulesVersion: 1,
      dungeonId: 'redaction_scriptorium',
      law: { kind: 'legacy_auction_court' }
    }, LEGACY_AUCTION_COURT_DUNGEON_ID)).toEqual(clean);
    expect(normalizeDungeonLawState({
      rulesVersion: 1,
      dungeonId: 'legacy_auction_court',
      law: { kind: 'redaction_scriptorium' }
    }, LEGACY_AUCTION_COURT_DUNGEON_ID)).toEqual(clean);

    const sanitized = normalizeDungeonLawState({
      rulesVersion: 1,
      dungeonId: 'legacy_auction_court',
      clearedNodeIds: ['force_lot_dais', 7],
      resolvedEventIds: [],
      combatOpenings: {},
      combatVictoryNodeIds: [],
      equipment: { anonymousVeil: true },
      law: {
        kind: 'legacy_auction_court',
        pendingLotNodeId: 'return_lot_dais',
        resolvedLotChoices: {
          force_lot_dais: 'bid',
          guard_lot_dais: 'steal',
          invented_lot: 'fold'
        },
        bossLotSnapshot: null,
        entryPassives: {
          legacyGavel: true,
          anonymousVeil: 'yes',
          escrowPlate: false,
          finalLotBell: true,
          inventedPassive: true
        }
      }
    }, LEGACY_AUCTION_COURT_DUNGEON_ID);
    expect(sanitized.law).toEqual({
      kind: 'legacy_auction_court',
      pendingLotNodeId: 'return_lot_dais',
      resolvedLotChoices: { force_lot_dais: 'bid' },
      bossLotSnapshot: null,
      entryPassives: {
        legacyGavel: true,
        anonymousVeil: false,
        escrowPlate: false,
        finalLotBell: true
      }
    });
    expect(normalizeDungeonLawState(sanitized, LEGACY_AUCTION_COURT_DUNGEON_ID)).toEqual(sanitized);
  });

  it('keeps complete Boss snapshots authoritative and reconstructs only from complete valid resolutions', () => {
    const completeResolved = auctionChoiceMap('bid', 'burn', 'fold', 'bid');
    const reconstructed = normalizeDungeonLawState({
      rulesVersion: 1,
      dungeonId: 'legacy_auction_court',
      law: {
        kind: 'legacy_auction_court',
        pendingLotNodeId: 'art_lot_dais',
        resolvedLotChoices: completeResolved,
        bossLotSnapshot: { force_lot_dais: 'bid', invented_lot: 'burn' }
      }
    }, LEGACY_AUCTION_COURT_DUNGEON_ID);
    expect(reconstructed.law).toMatchObject({
      pendingLotNodeId: null,
      resolvedLotChoices: completeResolved,
      bossLotSnapshot: completeResolved
    });

    const authoritative = auctionChoiceMap('fold', 'fold', 'burn', 'bid');
    const snapshotWins = normalizeDungeonLawState({
      rulesVersion: 1,
      dungeonId: 'legacy_auction_court',
      law: {
        kind: 'legacy_auction_court',
        pendingLotNodeId: 'guard_lot_dais',
        resolvedLotChoices: { force_lot_dais: 'bid' },
        bossLotSnapshot: authoritative
      }
    }, LEGACY_AUCTION_COURT_DUNGEON_ID);
    expect(snapshotWins.law).toMatchObject({
      pendingLotNodeId: null,
      resolvedLotChoices: authoritative,
      bossLotSnapshot: authoritative
    });

    const damaged = normalizeDungeonLawState({
      rulesVersion: 1,
      dungeonId: 'legacy_auction_court',
      law: {
        kind: 'legacy_auction_court',
        pendingLotNodeId: 'guard_lot_dais',
        resolvedLotChoices: { force_lot_dais: 'bid' },
        bossLotSnapshot: { force_lot_dais: 'bid', guard_lot_dais: 'broken' }
      }
    }, LEGACY_AUCTION_COURT_DUNGEON_ID);
    expect(damaged.law).toMatchObject({
      pendingLotNodeId: 'guard_lot_dais',
      resolvedLotChoices: { force_lot_dais: 'bid' },
      bossLotSnapshot: null
    });
  });

  it('prices bids dynamically, applies only the matching discount, and reports exact insufficiency', () => {
    let state = clear(createDungeonLawState(LEGACY_AUCTION_COURT_DUNGEON_ID), 'force_lot_dais');
    expect(clear(state, 'force_lot_dais')).toEqual(state);
    expect(getAuctionLotStatus(state, 0)).toMatchObject({
      availableScrip: 0,
      pendingLotNodeId: 'force_lot_dais',
      currentCosts: { bid: 1, burn: 1, fold: 0 },
      choices: {
        bid: { available: false, scripCost: 1, unavailableReason: expect.stringContaining('1') },
        burn: { available: false, scripCost: 1, unavailableReason: expect.stringContaining('1') },
        fold: { available: true, scripCost: 0 }
      }
    });
    const firstBid = resolveAuctionLotChoice(state, 'bid', 1);
    expect(firstBid).toMatchObject({ resolved: true, scripCost: 1 });

    state = clear(firstBid.state, 'guard_lot_dais');
    expect(getAuctionLotStatus(state, 1)).toMatchObject({
      currentCosts: { bid: 2, burn: 1, fold: 0 },
      choices: { bid: { available: false, scripCost: 2, unavailableReason: expect.stringContaining('1') } }
    });
    const insufficient = resolveAuctionLotChoice(state, 'bid', 1);
    expect(insufficient).toMatchObject({ resolved: false, scripCost: 0, unavailableReason: expect.stringContaining('2') });
    expect(insufficient.state).toBe(state);

    let discounted = clear(createDungeonLawState(LEGACY_AUCTION_COURT_DUNGEON_ID, {
      legacyGavel: true,
      escrowPlate: true
    }), 'force_lot_dais');
    discounted = resolveAuctionLotChoice(discounted, 'bid', 1).state;
    discounted = clear(discounted, 'guard_lot_dais');
    expect(getAuctionLotStatus(discounted, 1).currentCosts.bid).toBe(1);
    expect(resolveAuctionLotChoice(discounted, 'bid', 1)).toMatchObject({ resolved: true, scripCost: 1 });

    const wrongPassive = clear(createDungeonLawState(LEGACY_AUCTION_COURT_DUNGEON_ID, {
      legacyGavel: true
    }), 'guard_lot_dais');
    expect(getAuctionLotStatus(wrongPassive, 9).currentCosts.bid).toBe(1);
    const onePriorBid = {
      ...wrongPassive,
      law: wrongPassive.law.kind === 'legacy_auction_court'
        ? { ...wrongPassive.law, resolvedLotChoices: { force_lot_dais: 'bid' as const } }
        : wrongPassive.law
    };
    expect(getAuctionLotStatus(onePriorBid, 9).currentCosts.bid).toBe(2);
  });

  it('charges burn exactly once, keeps fold free, and leaves every rejected resolution pure', () => {
    const pending = clear(createDungeonLawState(LEGACY_AUCTION_COURT_DUNGEON_ID), 'art_lot_dais');
    const burned = resolveAuctionLotChoice(pending, 'burn', 1);
    expect(burned).toMatchObject({ resolved: true, scripCost: 1 });
    expect(burned.state.law).toMatchObject({
      pendingLotNodeId: null,
      resolvedLotChoices: { art_lot_dais: 'burn' }
    });
    expect(resolveAuctionLotChoice(burned.state, 'fold', 99)).toEqual({
      state: burned.state,
      choice: 'fold',
      resolved: false,
      scripCost: 0,
      unavailableReason: expect.any(String)
    });

    const folded = resolveAuctionLotChoice(
      clear(burned.state, 'return_lot_dais'),
      'fold',
      0
    );
    expect(folded).toMatchObject({ resolved: true, scripCost: 0 });
    expect(folded.state.law).toMatchObject({ resolvedLotChoices: {
      art_lot_dais: 'burn',
      return_lot_dais: 'fold'
    } });

    const wrongDungeon = createDungeonLawState('demon_tower_1');
    expect(resolveAuctionLotChoice(wrongDungeon, 'bid', 9).state).toBe(wrongDungeon);
    expect(resolveAuctionLotChoice(pending, 'steal' as AuctionLotChoice, 9).state).toBe(pending);
    const alreadyResolved = {
      ...pending,
      law: pending.law.kind === 'legacy_auction_court'
        ? { ...pending.law, resolvedLotChoices: { art_lot_dais: 'bid' as const } }
        : pending.law
    };
    expect(resolveAuctionLotChoice(alreadyResolved, 'bid', 9).state).toBe(alreadyResolved);
  });

  it('snapshots every one of the 81 complete choice maps once and never applies pre-snapshot modifiers', () => {
    const choices = ['bid', 'burn', 'fold'] as const;
    let combinationCount = 0;
    for (const force of choices) {
      for (const guard of choices) {
        for (const art of choices) {
          for (const returnChoice of choices) {
            combinationCount += 1;
            const choiceMap = auctionChoiceMap(force, guard, art, returnChoice);
            const resolved = resolveAuctionLots(choiceMap);
            expect(getAuctionLotStatus(resolved, 12)).toMatchObject({
              resolvedCount: 4,
              allLotsResolved: true,
              projectedLotChoices: choiceMap,
              bossLotSnapshot: null
            });
            expect(getDungeonLawModifiers(resolved, {
              isBossEncounter: true,
              isBossAwakened: true
            })).toEqual({
              encounter: { allStatsPercent: 0, defensePercent: 0, artPowerPercent: 0 },
              trap: { damagePercent: 0, dcPercent: 0 },
              healingPercent: 0,
              outgoingDamage: { forcePercent: 0, artPercent: 0 },
              guardEffectPercent: 0
            });

            const started = signalCombatStarted(resolved, {
              nodeId: 'estate_auctioneer',
              isBoss: true,
              openingAction: 'attack'
            });
            expect(started.law).toMatchObject({
              pendingLotNodeId: null,
              resolvedLotChoices: choiceMap,
              bossLotSnapshot: choiceMap
            });
            expect(signalCombatStarted(started, {
              nodeId: 'estate_auctioneer',
              isBoss: true,
              openingAction: 'art'
            })).toEqual(started);
            expect(resolveAuctionLotChoice(started, 'bid', 99).state).toBe(started);
          }
        }
      }
    }
    expect(combinationCount).toBe(81);
  });

  it('applies every sealed, awakened, and passive auction modifier from the frozen snapshot only', () => {
    const cases = [
      {
        nodeId: 'force_lot_dais',
        passive: 'legacyGavel',
        bidSealed: { outgoingDamage: { forcePercent: 8 } },
        bidAwakened: { outgoingDamage: { forcePercent: 14 } },
        foldSealed: { encounter: { allStatsPercent: 5 } },
        foldAwakened: { encounter: { allStatsPercent: 10 } },
        passiveSealed: { encounter: { allStatsPercent: 3 } },
        passiveAwakened: { encounter: { allStatsPercent: 5 } }
      },
      {
        nodeId: 'guard_lot_dais',
        passive: 'escrowPlate',
        bidSealed: { guardEffectPercent: 10 },
        bidAwakened: { guardEffectPercent: 16 },
        foldSealed: { encounter: { defensePercent: 10 } },
        foldAwakened: { encounter: { defensePercent: 18 } },
        passiveSealed: { encounter: { defensePercent: 5 } },
        passiveAwakened: { encounter: { defensePercent: 9 } }
      },
      {
        nodeId: 'art_lot_dais',
        passive: 'anonymousVeil',
        bidSealed: { outgoingDamage: { artPercent: 8 } },
        bidAwakened: { outgoingDamage: { artPercent: 14 } },
        foldSealed: { encounter: { artPowerPercent: 10 } },
        foldAwakened: { encounter: { artPowerPercent: 18 } },
        passiveSealed: { encounter: { artPowerPercent: 5 } },
        passiveAwakened: { encounter: { artPowerPercent: 9 } }
      },
      {
        nodeId: 'return_lot_dais',
        passive: 'finalLotBell',
        bidSealed: { healingPercent: 10 },
        bidAwakened: { healingPercent: 16 },
        foldSealed: { healingPercent: -10 },
        foldAwakened: { healingPercent: -18 },
        passiveSealed: { healingPercent: -5 },
        passiveAwakened: { healingPercent: -9 }
      }
    ] as const;

    for (const testCase of cases) {
      const bidMap = auctionChoiceMap('burn', 'burn', 'burn', 'burn');
      bidMap[testCase.nodeId] = 'bid';
      const foldMap = auctionChoiceMap('burn', 'burn', 'burn', 'burn');
      foldMap[testCase.nodeId] = 'fold';
      const bidBoss = signalCombatStarted(resolveAuctionLots(bidMap), {
        nodeId: 'estate_auctioneer', isBoss: true, openingAction: 'attack'
      });
      const foldBoss = signalCombatStarted(resolveAuctionLots(foldMap), {
        nodeId: 'estate_auctioneer', isBoss: true, openingAction: 'attack'
      });
      const passiveBoss = signalCombatStarted(resolveAuctionLots(foldMap, {
        [testCase.passive]: true
      }), { nodeId: 'estate_auctioneer', isBoss: true, openingAction: 'attack' });

      expect(getDungeonLawModifiers(bidBoss, { isBossEncounter: true })).toMatchObject(testCase.bidSealed);
      expect(getDungeonLawModifiers(bidBoss, {
        isBossEncounter: true, isBossAwakened: true
      })).toMatchObject(testCase.bidAwakened);
      expect(getDungeonLawModifiers(foldBoss, { isBossEncounter: true })).toMatchObject(testCase.foldSealed);
      expect(getDungeonLawModifiers(foldBoss, {
        isBossEncounter: true, isBossAwakened: true
      })).toMatchObject(testCase.foldAwakened);
      expect(getDungeonLawModifiers(passiveBoss, {
        isBossEncounter: true
      })).toMatchObject(testCase.passiveSealed);
      expect(getDungeonLawModifiers(passiveBoss, {
        isBossEncounter: true, isBossAwakened: true
      })).toMatchObject(testCase.passiveAwakened);
      expectBoundedModifiers(bidBoss);
      expectBoundedModifiers(foldBoss);
      expectBoundedModifiers(passiveBoss);
    }

    const burnBoss = signalCombatStarted(resolveAuctionLots(
      auctionChoiceMap('burn', 'burn', 'burn', 'burn')
    ), { nodeId: 'estate_auctioneer', isBoss: true, openingAction: 'guard' });
    expect(getDungeonLawModifiers(burnBoss, { isBossEncounter: true })).toEqual({
      encounter: { allStatsPercent: 0, defensePercent: 0, artPowerPercent: 0 },
      trap: { damagePercent: 0, dcPercent: 0 },
      healingPercent: 0,
      outgoingDamage: { forcePercent: 0, artPercent: 0 },
      guardEffectPercent: 0
    });
    expect(getDungeonLawModifiers(burnBoss)).toEqual(getDungeonLawModifiers(
      createDungeonLawState(LEGACY_AUCTION_COURT_DUNGEON_ID)
    ));
  });

  it('exposes scrip, costs, counts, projected choices, frozen choices, and both Boss projections', () => {
    let state = resolveAuctionLots(auctionChoiceMap('bid', 'burn', 'fold', 'bid'));
    const display = getDungeonLawDisplay(state, { availableScrip: 7 });
    expect(display).toMatchObject({
      dungeonId: 'legacy_auction_court',
      title: '亡队遗产拍卖',
      status: expect.stringContaining('遗产筹码 7'),
      meter: { value: 4, max: 4 },
      targetReached: true,
      auction: {
        totalLotCount: 4,
        availableScrip: 7,
        resolvedCount: 4,
        bidCount: 2,
        burnCount: 1,
        foldCount: 1,
        pendingLotNodeId: null,
        currentCosts: { bid: 3, burn: 1, fold: 0 },
        projectedLotChoices: auctionChoiceMap('bid', 'burn', 'fold', 'bid'),
        frozenLotChoices: null,
        projectedBossModifiers: {
          sealed: {
            encounter: { artPowerPercent: 10 },
            healingPercent: 10,
            outgoingDamage: { forcePercent: 8 }
          },
          awakened: {
            encounter: { artPowerPercent: 18 },
            healingPercent: 16,
            outgoingDamage: { forcePercent: 14 }
          }
        }
      }
    });
    state = signalCombatStarted(state, {
      nodeId: 'estate_auctioneer', isBoss: true, openingAction: 'attack'
    });
    expect(getDungeonLawDisplay(state, 7).auction).toMatchObject({
      projectedLotChoices: auctionChoiceMap('bid', 'burn', 'fold', 'bid'),
      frozenLotChoices: auctionChoiceMap('bid', 'burn', 'fold', 'bid')
    });
  });

  it('strictly normalizes genesis entry config, ordered sequence, pending console, and snapshots', () => {
    const entry = createDungeonLawState('genesis_vault', {
      entryGear: {
        helixCleaver: true,
        symbioteCowl: 1 as unknown as boolean,
        carapaceHarness: false,
        rebirthAmulet: true
      },
      entryBloodline: { aspect: 'guard', rank: 3 }
    });
    expect(entry.law).toMatchObject({
      kind: 'genesis_vault',
      pendingSpliceNodeId: null,
      spliceSequence: [],
      bossGenomeSnapshot: null,
      entryGear: {
        helixCleaver: true,
        symbioteCowl: false,
        carapaceHarness: false,
        rebirthAmulet: true
      },
      entryBloodline: { aspect: 'guard', rank: 3 }
    });

    const normalized = normalizeDungeonLawState({
      ...entry,
      clearedNodeIds: ['second_splice_console'],
      law: {
        kind: 'genesis_vault',
        pendingSpliceNodeId: 'second_splice_console',
        spliceSequence: ['force', 'bad', 'art', 'guard', 'renewal'],
        bossGenomeSnapshot: null,
        entryGear: { helixCleaver: true, symbioteCowl: 'yes' },
        entryBloodline: { aspect: 'force', rank: 0 }
      }
    }, 'genesis_vault');
    expect(normalized.law).toMatchObject({
      spliceSequence: ['force', 'art', 'guard'],
      pendingSpliceNodeId: null,
      bossGenomeSnapshot: null,
      entryGear: {
        helixCleaver: true,
        symbioteCowl: false,
        carapaceHarness: false,
        rebirthAmulet: false
      },
      entryBloodline: { aspect: null, rank: 0 }
    });

    const pending = normalizeDungeonLawState({
      ...entry,
      clearedNodeIds: ['first_splice_console', 'second_splice_console'],
      law: {
        ...entry.law,
        spliceSequence: ['renewal'],
        pendingSpliceNodeId: 'second_splice_console'
      }
    }, 'genesis_vault');
    expect(pending.law).toMatchObject({
      spliceSequence: ['renewal'],
      pendingSpliceNodeId: 'second_splice_console'
    });
    expect(normalizeDungeonLawState({
      ...pending,
      clearedNodeIds: [],
      law: { ...pending.law, pendingSpliceNodeId: 'second_splice_console' }
    }, 'genesis_vault').law).toMatchObject({ pendingSpliceNodeId: null });

    const recoveredSnapshot = normalizeDungeonLawState({
      ...entry,
      law: {
        ...entry.law,
        spliceSequence: ['art', 'force', 'art'],
        bossGenomeSnapshot: ['bad']
      }
    }, 'genesis_vault');
    expect(recoveredSnapshot.law).toMatchObject({
      spliceSequence: ['art', 'force', 'art'],
      bossGenomeSnapshot: ['art', 'force', 'art'],
      pendingSpliceNodeId: null
    });
    expect(normalizeDungeonLawState({
      ...entry,
      law: { ...entry.law, spliceSequence: ['guard'], bossGenomeSnapshot: ['bad'] }
    }, 'genesis_vault').law).toMatchObject({
      spliceSequence: ['guard'],
      bossGenomeSnapshot: null
    });
    expect(normalizeDungeonLawState({ ...entry, law: { kind: 'ash_arena' } }, 'genesis_vault'))
      .toEqual(createDungeonLawState('genesis_vault'));

    let outOfOrder = clear(createDungeonLawState('genesis_vault'), 'third_splice_console');
    expect(outOfOrder.law).toMatchObject({ pendingSpliceNodeId: 'third_splice_console' });
    outOfOrder = resolveGenesisSpliceChoice(outOfOrder, 'art', 0).state;
    outOfOrder = clear(outOfOrder, 'first_splice_console');
    expect(outOfOrder.law).toMatchObject({
      spliceSequence: ['art'],
      pendingSpliceNodeId: 'first_splice_console'
    });
  });

  it('uses the full genesis cost matrix, four exact gear discounts, and atomic serum failure', () => {
    const genes: readonly GenesisGene[] = ['force', 'art', 'guard', 'renewal'];
    const gearByGene: Record<GenesisGene, keyof GenesisEntryGear> = {
      force: 'helixCleaver',
      art: 'symbioteCowl',
      guard: 'carapaceHarness',
      renewal: 'rebirthAmulet'
    };

    for (const gene of genes) {
      for (const priorCount of [0, 1, 2] as const) {
        let state = resolveGenesisSequence(Array.from({ length: priorCount }, () => gene));
        const nodeId = DUNGEON_LAW_LANDMARKS.genesis_vault.spliceNodeIds[priorCount];
        state = clear(state, nodeId);
        expect(getGenesisSpliceStatus(state, 9).choices[gene].serumCost, `${gene}:${priorCount}`)
          .toBe(priorCount);

        const gear = { [gearByGene[gene]]: true } as Partial<GenesisEntryGear>;
        let discounted = resolveGenesisSequence(Array.from({ length: priorCount }, () => gene), gear);
        discounted = clear(discounted, nodeId);
        expect(getGenesisSpliceStatus(discounted, 9).choices[gene].serumCost, `gear:${gene}:${priorCount}`)
          .toBe(Math.max(0, priorCount - 1));
      }
    }

    let state = resolveGenesisSequence(['force']);
    state = clear(state, 'second_splice_console');
    const failed = resolveGenesisSpliceChoice(state, 'force', 0);
    expect(failed).toMatchObject({ resolved: false, gene: 'force', serumCost: 1 });
    expect(failed.unavailableReason).toContain('原型血清');
    expect(failed.state).toBe(state);
  });

  it('moves pending through three consoles and freezes every one of the 64 ordered genomes once', () => {
    const genes: readonly GenesisGene[] = ['force', 'art', 'guard', 'renewal'];
    const sequences = genes.flatMap((first) =>
      genes.flatMap((second) => genes.map((third) => [first, second, third] as const))
    );
    expect(sequences).toHaveLength(64);

    for (const sequence of sequences) {
      let state = createDungeonLawState('genesis_vault');
      for (const [index, gene] of sequence.entries()) {
        const nodeId = DUNGEON_LAW_LANDMARKS.genesis_vault.spliceNodeIds[index];
        state = clear(state, nodeId);
        expect(state.law).toMatchObject({ pendingSpliceNodeId: nodeId });
        const resolution = resolveGenesisSpliceChoice(state, gene, 9);
        expect(resolution.resolved, sequence.join('/')).toBe(true);
        state = resolution.state;
      }
      expect(state.law).toMatchObject({ spliceSequence: sequence, pendingSpliceNodeId: null });
      const frozen = signalCombatStarted(state, {
        nodeId: 'primal_curator', isBoss: true, openingAction: 'attack'
      });
      expect(frozen.law).toMatchObject({
        spliceSequence: sequence,
        bossGenomeSnapshot: sequence,
        pendingSpliceNodeId: null
      });
      expect(signalCombatStarted(frozen, {
        nodeId: 'primal_curator', isBoss: true, openingAction: 'art'
      }).law).toEqual(frozen.law);
      expect(resolveGenesisSpliceChoice(frozen, 'renewal', 99).state).toBe(frozen);
    }

    let incomplete = resolveGenesisSequence(['force', 'art']);
    incomplete = signalCombatStarted(incomplete, {
      nodeId: 'primal_curator', isBoss: true, openingAction: 'guard'
    });
    expect(incomplete.law).toMatchObject({ bossGenomeSnapshot: null, spliceSequence: ['force', 'art'] });
    const complete = resolveGenesisSequence(['guard', 'art', 'renewal']);
    expect(signalCombatStarted(complete, {
      nodeId: 'primal_curator', isBoss: false, openingAction: 'attack'
    }).law).toMatchObject({ bossGenomeSnapshot: null });
    expect(signalCombatStarted(complete, {
      nodeId: 'gene_stalker_alpha', isBoss: true, openingAction: 'attack'
    }).law).toMatchObject({ bossGenomeSnapshot: null });
    expect(clear(resolveGenesisSequence(['force', 'art', 'guard']), 'third_splice_console').law)
      .toMatchObject({ pendingSpliceNodeId: null, spliceSequence: ['force', 'art', 'guard'] });
  });

  it('projects sealed and awakened gene bonuses, rank-three affinity, adaptation halving, and clamp', () => {
    const force = resolveGenesisSequence(['force', 'force', 'art']);
    expect(getDungeonLawModifiers(force)).toMatchObject({
      outgoingDamage: { forcePercent: 8, artPercent: 4 }
    });
    expect(getDungeonLawModifiers(force, { isBossEncounter: true })).toMatchObject({
      encounter: { defensePercent: 8 },
      outgoingDamage: { forcePercent: 8, artPercent: 4 }
    });
    expect(getDungeonLawModifiers(force, {
      isBossEncounter: true, isBossAwakened: true
    })).toMatchObject({
      encounter: { defensePercent: 14 },
      outgoingDamage: { forcePercent: 12, artPercent: 6 }
    });

    const dominantCases = [
      {
        state: resolveGenesisSequence(['art', 'art', 'force']),
        sealed: { encounter: { artPowerPercent: 8 } },
        awakened: { encounter: { artPowerPercent: 14 } }
      },
      {
        state: resolveGenesisSequence(['guard', 'guard', 'art']),
        sealed: { encounter: { allStatsPercent: 5 } },
        awakened: { encounter: { allStatsPercent: 10 } }
      },
      {
        state: resolveGenesisSequence(['renewal', 'renewal', 'force']),
        sealed: { healingPercent: 0 },
        awakened: { healingPercent: -2 }
      }
    ];
    for (const testCase of dominantCases) {
      expect(getDungeonLawModifiers(testCase.state, { isBossEncounter: true }))
        .toMatchObject(testCase.sealed);
      expect(getDungeonLawModifiers(testCase.state, {
        isBossEncounter: true, isBossAwakened: true
      })).toMatchObject(testCase.awakened);
    }

    const matching = resolveGenesisSequence(
      ['force', 'force', 'art'],
      {},
      { aspect: 'force', rank: 1 }
    );
    expect(getDungeonLawModifiers(matching, { isBossEncounter: true }).encounter.defensePercent).toBe(4);
    expect(getDungeonLawModifiers(matching, {
      isBossEncounter: true, isBossAwakened: true
    }).encounter.defensePercent).toBe(7);

    const rankThree = resolveGenesisSequence(
      ['guard', 'guard', 'guard'],
      {},
      { aspect: 'guard', rank: 3 }
    );
    expect(getDungeonLawModifiers(rankThree)).toMatchObject({ guardEffectPercent: 18 });
    expect(getDungeonLawModifiers(rankThree, {
      isBossEncounter: true, isBossAwakened: true
    })).toMatchObject({
      encounter: { allStatsPercent: 5 },
      guardEffectPercent: 20
    });

    const unique = resolveGenesisSequence(['force', 'art', 'renewal']);
    expect(getDungeonLawModifiers(unique, { isBossEncounter: true }).encounter).toEqual({
      allStatsPercent: 0,
      defensePercent: 0,
      artPowerPercent: 0
    });
    const renewal = resolveGenesisSequence(['renewal', 'renewal', 'renewal']);
    expect(getDungeonLawModifiers(renewal, { isBossEncounter: true }).healingPercent).toBe(4);
    expect(getDungeonLawModifiers(renewal, {
      isBossEncounter: true, isBossAwakened: true
    }).healingPercent).toBe(4);

    for (const state of [force, matching, rankThree, unique, renewal]) {
      expectBoundedModifiers(state);
      const awakened = getDungeonLawModifiers(state, {
        isBossEncounter: true, isBossAwakened: true
      });
      for (const value of [
        ...Object.values(awakened.encounter),
        ...Object.values(awakened.trap),
        ...Object.values(awakened.outgoingDamage),
        awakened.healingPercent,
        awakened.guardEffectPercent
      ]) {
        expect(value).toBeGreaterThanOrEqual(-20);
        expect(value).toBeLessThanOrEqual(20);
      }
    }
  });

  it('exposes genesis serum, diversity, pending, snapshot, meter, and both modifier projections', () => {
    let state = resolveGenesisSequence(['force', 'art']);
    state = clear(state, 'third_splice_console');
    const pending = getDungeonLawDisplay(state, { availableGenesisSerum: 5 });
    expect(pending).toMatchObject({
      dungeonId: 'genesis_vault',
      title: '众生原型拼接',
      status: expect.stringContaining('原型血清 5'),
      meter: { value: 2, max: 3 },
      targetReached: false,
      genesis: {
        availableGenesisSerum: 5,
        pendingSpliceNodeId: 'third_splice_console',
        spliceSequence: ['force', 'art'],
        uniqueCount: 2,
        bossGenomeSnapshot: null,
        projectedModifiers: {
          sealed: { outgoingDamage: { forcePercent: 4, artPercent: 4 } },
          awakened: { outgoingDamage: { forcePercent: 6, artPercent: 6 } }
        }
      }
    });
    const completed = resolveGenesisSpliceChoice(state, 'guard', 5).state;
    const frozen = signalCombatStarted(completed, {
      nodeId: 'primal_curator', isBoss: true, openingAction: 'attack'
    });
    expect(getDungeonLawDisplay(frozen, { availableGenesisSerum: 2 })).toMatchObject({
      status: expect.stringContaining('Boss快照 force/art/guard'),
      meter: { value: 3, max: 3 },
      targetReached: true,
      genesis: { bossGenomeSnapshot: ['force', 'art', 'guard'], uniqueCount: 3 }
    });
  });

  it('tracks first-clear noise only, clamps it, and spends hushblade on the first clash', () => {
    let state = createDungeonLawState(SILENT_BROADCAST_TOWER_DUNGEON_ID, { hushblade: true });
    state = clear(state, 'frequency_leech_north', 'monster');
    expect(state.law).toMatchObject({ noise: 0, firstClashMutedUsed: true });
    expect(clear(state, 'frequency_leech_north', 'monster')).toEqual(state);

    state = clear(state, 'north_echo_cache', 'reward');
    state = clear(state, 'broadcast_exit', 'exit');
    expect(state.law).toMatchObject({ noise: 0 });
    state = clear(state, 'acoustic_tripwire', 'trap');
    for (let index = 0; index < 8; index += 1) {
      state = clear(state, `noise_boundary_${index}`, 'monster');
    }
    expect(state.law).toMatchObject({ noise: 6, firstClashMutedUsed: true });
    expectBoundedModifiers(state);
  });

  it('resolves all eight relay sequences deterministically and pays only broadcasts', () => {
    const cases: readonly [readonly BroadcastRelayChoice[], number][] = [
      [['mute', 'mute', 'mute'], 0],
      [['mute', 'mute', 'broadcast'], 1],
      [['mute', 'broadcast', 'mute'], 0],
      [['mute', 'broadcast', 'broadcast'], 2],
      [['broadcast', 'mute', 'mute'], 0],
      [['broadcast', 'mute', 'broadcast'], 1],
      [['broadcast', 'broadcast', 'mute'], 1],
      [['broadcast', 'broadcast', 'broadcast'], 3]
    ];

    for (const [choices, expectedNoise] of cases) {
      const state = resolveBroadcastSequence(choices);
      const status = getBroadcastRelayStatus(state);
      expect(status.noise, choices.join('/')).toBe(expectedNoise);
      expect(status.resolvedCount, choices.join('/')).toBe(3);
      expect(status.muteCount, choices.join('/')).toBe(choices.filter((choice) => choice === 'mute').length);
      expect(status.broadcastCount, choices.join('/')).toBe(choices.filter((choice) => choice === 'broadcast').length);
      expect(status.allRelaysResolved, choices.join('/')).toBe(true);
    }

    let headset = clear(withBroadcastNoise(1, { deadAirHeadset: true }), 'north_relay_console');
    expect(getBroadcastRelayStatus(headset).choices.mute).toMatchObject({
      available: true,
      noiseDelta: -1,
      bonusRewardPoints: 0
    });
    const muted = resolveBroadcastRelayChoice(headset, 'mute');
    expect(muted).toMatchObject({ resolved: true, bonusRewardPoints: 0 });
    expect(muted.state.law).toMatchObject({ noise: 0, pendingRelayNodeId: null });

    headset = clear(muted.state, 'central_relay_console');
    const broadcast = resolveBroadcastRelayChoice(headset, 'broadcast');
    expect(broadcast).toMatchObject({ resolved: true, bonusRewardPoints: 180 });
    expect(broadcast.state.law).toMatchObject({ noise: 1 });
    expect(clear(broadcast.state, 'central_relay_console')).toEqual(broadcast.state);

    const cappedPending = clear(withBroadcastNoise(6), 'north_relay_console');
    const cappedBroadcast = resolveBroadcastRelayChoice(cappedPending, 'broadcast');
    expect(cappedBroadcast).toMatchObject({ resolved: true, bonusRewardPoints: 180 });
    expect(cappedBroadcast.state.law).toMatchObject({ noise: 6 });
  });

  it('freezes the Boss noise once and applies the last-channel beacon before the snapshot', () => {
    const beforeBoss = resolveBroadcastSequence(
      ['broadcast', 'broadcast', 'broadcast'],
      1,
      { lastChannelBeacon: true }
    );
    const frozen = signalCombatStarted(beforeBoss, {
      nodeId: 'last_broadcaster', isBoss: true, openingAction: 'attack'
    });
    expect(frozen.law).toMatchObject({ noise: 4, bossNoiseSnapshot: 3, pendingRelayNodeId: null });

    const noisyAfterStart = clear(frozen, 'abnormal_post_boss_trap', 'trap');
    const repeated = signalCombatStarted(noisyAfterStart, {
      nodeId: 'last_broadcaster', isBoss: true, openingAction: 'art'
    });
    expect(repeated.law).toMatchObject({ noise: 5, bossNoiseSnapshot: 3 });
    expect(getDungeonLawModifiers(repeated, { isBossEncounter: true }).encounter.defensePercent).toBe(0);

    const zeroFloor = signalCombatStarted(
      withBroadcastNoise(0, { lastChannelBeacon: true }),
      { nodeId: 'last_broadcaster', isBoss: true, openingAction: 'guard' }
    );
    expect(zeroFloor.law).toMatchObject({ noise: 0, bossNoiseSnapshot: 0 });
  });

  it('keeps broadcast risk-reward modifiers exact, bounded, and mantle-safe', () => {
    const dangerByNoise = [0, 0, 0, 0, 4, 8, 12];
    const outputByNoise = [0, 0, 0, 0, 2, 4, 6];
    for (let noise = 0; noise <= 6; noise += 1) {
      const state = withBroadcastNoise(noise);
      const exploration = getDungeonLawModifiers(state);
      expect(exploration.encounter.allStatsPercent, `noise ${noise}`).toBe(dangerByNoise[noise]);
      expect(exploration.trap, `noise ${noise}`).toEqual({
        damagePercent: dangerByNoise[noise],
        dcPercent: dangerByNoise[noise]
      });
      expect(exploration.outgoingDamage, `noise ${noise}`).toEqual({
        forcePercent: outputByNoise[noise],
        artPercent: outputByNoise[noise]
      });
      expectBoundedModifiers(state);
    }

    for (const [noise, defensePercent] of [[0, 12], [1, 8], [2, 4], [3, 0]] as const) {
      const frozen = signalCombatStarted(withBroadcastNoise(noise), {
        nodeId: 'last_broadcaster', isBoss: true, openingAction: 'guard'
      });
      expect(getDungeonLawModifiers(frozen, { isBossEncounter: true }).encounter.defensePercent)
        .toBe(defensePercent);
    }

    const mantle = withBroadcastNoise(5, { anechoicMantle: true });
    expect(getDungeonLawModifiers(mantle)).toMatchObject({
      encounter: { allStatsPercent: 4 },
      trap: { damagePercent: 4, dcPercent: 4 },
      outgoingDamage: { forcePercent: 4, artPercent: 4 }
    });
    const quietBoss = signalCombatStarted(withBroadcastNoise(0, { anechoicMantle: true }), {
      nodeId: 'last_broadcaster', isBoss: true, openingAction: 'attack'
    });
    expect(getDungeonLawModifiers(quietBoss, { isBossEncounter: true }).encounter.defensePercent).toBe(6);
  });

  it('strictly normalizes broadcast state to a safe default without mutating input', () => {
    const pending = clear(
      createDungeonLawState(SILENT_BROADCAST_TOWER_DUNGEON_ID, {
        hushblade: true,
        deadAirHeadset: true,
        anechoicMantle: true,
        lastChannelBeacon: true
      }),
      'north_relay_console'
    );
    const invalidStates: unknown[] = [
      { ...pending, dungeonId: 'genesis_vault' },
      { ...pending, law: { ...pending.law, noise: 7 } },
      { ...pending, law: { ...pending.law, noise: -1 } },
      { ...pending, law: { ...pending.law, noise: 1.5 } },
      { ...pending, law: { ...pending.law, pendingRelayNodeId: 'unknown_relay' } },
      { ...pending, law: { ...pending.law, resolvedRelayChoices: { unknown_relay: 'mute' } } },
      { ...pending, law: { ...pending.law, resolvedRelayChoices: { north_relay_console: 'unknown' } } },
      { ...pending, clearedNodeIds: ['north_relay_console', 'north_relay_console'] },
      {
        ...pending,
        law: {
          ...pending.law,
          pendingRelayNodeId: 'north_relay_console',
          resolvedRelayChoices: { north_relay_console: 'mute' }
        }
      },
      { ...pending, law: { ...pending.law, pendingRelayNodeId: null, bossNoiseSnapshot: 2 } },
      { ...pending, law: { ...pending.law, pendingRelayNodeId: null, bossNoiseSnapshot: 7 } }
    ];

    for (const invalid of invalidStates) {
      const snapshot = structuredClone(invalid);
      expect(normalizeDungeonLawState(invalid, SILENT_BROADCAST_TOWER_DUNGEON_ID))
        .toEqual(createDungeonLawState(SILENT_BROADCAST_TOWER_DUNGEON_ID));
      expect(invalid).toEqual(snapshot);
    }
    const unknownChoice = resolveBroadcastRelayChoice(
      pending,
      'unknown' as BroadcastRelayChoice
    );
    expect(unknownChoice).toMatchObject({ resolved: false, bonusRewardPoints: 0 });
    expect(unknownChoice.state).toEqual(pending);
  });

  it('exposes relay choices, counts, snapshot, entry passives, and availability reasons', () => {
    let state = resolveBroadcastSequence(
      ['mute', 'broadcast'],
      3,
      {
        hushblade: true,
        deadAirHeadset: true,
        anechoicMantle: true,
        lastChannelBeacon: true
      }
    );
    state = clear(state, 'south_relay_console');
    const display = getDungeonLawDisplay(state);
    expect(display).toMatchObject({
      dungeonId: 'silent_broadcast_tower',
      title: '寂声广播律',
      status: expect.stringContaining('北中继:静默，中央中继:播送，南中继:未定'),
      meter: { value: 2, max: 6 },
      targetReached: false,
      broadcast: {
        totalRelayCount: 3,
        noise: 2,
        pendingRelayNodeId: 'south_relay_console',
        resolvedCount: 2,
        muteCount: 1,
        broadcastCount: 1,
        bossNoiseSnapshot: null,
        firstClashMutedUsed: false,
        entryPassives: {
          hushblade: true,
          deadAirHeadset: true,
          anechoicMantle: true,
          lastChannelBeacon: true
        },
        choices: {
          mute: { available: true },
          broadcast: { available: true, bonusRewardPoints: 180 }
        }
      }
    });
    expect(display.broadcast?.entryPassiveReasons.hushblade).toContain('断频长刃');
    expect(display.broadcast?.entryPassiveReasons.lastChannelBeacon).toContain('末路断播器');
  });

  it('tracks first-clear escort hazards, equipment reductions, and all eight checkpoint sequences', () => {
    expect(clear(withSurvivorHp(100), 'mimic_survivor_alpha', 'monster').law)
      .toMatchObject({ survivorHp: 90 });
    expect(clear(withSurvivorHp(100, { rescueCarbine: true }), 'mimic_survivor_alpha', 'monster').law)
      .toMatchObject({ survivorHp: 94 });
    expect(clear(withSurvivorHp(100), 'collapsed_bulkhead', 'trap').law)
      .toMatchObject({ survivorHp: 85 });
    expect(clear(withSurvivorHp(100, { evacuationPlate: true }), 'collapsed_bulkhead', 'trap').law)
      .toMatchObject({ survivorHp: 90 });

    let repeat = clear(withSurvivorHp(20), 'mimic_survivor_alpha', 'monster');
    expect(clear(repeat, 'mimic_survivor_alpha', 'monster')).toEqual(repeat);
    repeat = clear(repeat, 'supply_reward', 'reward');
    repeat = clear(repeat, 'shelter_exit', 'exit');
    expect(repeat.law).toMatchObject({ survivorHp: 10 });

    for (let mask = 0; mask < 8; mask += 1) {
      const choices = Array.from({ length: 3 }, (_, index): EscortCheckpointChoice =>
        ((mask >> index) & 1) === 0 ? 'treat' : 'push'
      );
      const state = resolveEscortSequence(choices);
      const status = getEscortCheckpointStatus(state, 99);
      let expectedHp = 35;
      for (const choice of choices) {
        expectedHp = choice === 'treat'
          ? Math.min(100, expectedHp + 25)
          : Math.max(0, expectedHp - 10);
      }
      expect(status.survivorHp, choices.join('/')).toBe(expectedHp);
      expect(status.resolvedCount, choices.join('/')).toBe(3);
      expect(status.treatCount, choices.join('/')).toBe(choices.filter((choice) => choice === 'treat').length);
      expect(status.pushCount, choices.join('/')).toBe(choices.filter((choice) => choice === 'push').length);
      expect(status.allCheckpointsResolved, choices.join('/')).toBe(true);
    }
  });

  it('applies all three companion roles exactly at rank two', () => {
    const qinOne = clear(withSurvivorHp(100, {}, { id: 'qin_che', rank: 1 }), 'hazard_a', 'monster');
    expect(qinOne.law).toMatchObject({ survivorHp: 90, firstHazardGuardUsed: false });
    let qinTwo = clear(withSurvivorHp(100, {}, { id: 'qin_che', rank: 2 }), 'hazard_a', 'monster');
    expect(qinTwo.law).toMatchObject({ survivorHp: 100, firstHazardGuardUsed: true });
    qinTwo = clear(qinTwo, 'hazard_b', 'trap');
    expect(qinTwo.law).toMatchObject({ survivorHp: 85, firstHazardGuardUsed: true });

    let zhouOne = clear(withSurvivorHp(60, {}, { id: 'zhou_yingxue', rank: 1 }), 'north_checkpoint');
    zhouOne = resolveEscortCheckpointChoice(zhouOne, 'north_checkpoint', 'push', 0).state;
    expect(zhouOne.law).toMatchObject({ survivorHp: 50, companionAnalysisUsed: false });
    let zhouTwo = clear(withSurvivorHp(60, {}, { id: 'zhou_yingxue', rank: 2 }), 'north_checkpoint');
    zhouTwo = resolveEscortCheckpointChoice(zhouTwo, 'north_checkpoint', 'push', 0).state;
    expect(zhouTwo.law).toMatchObject({ survivorHp: 60, companionAnalysisUsed: true });
    zhouTwo = clear(zhouTwo, 'central_checkpoint');
    zhouTwo = resolveEscortCheckpointChoice(zhouTwo, 'central_checkpoint', 'push', 0).state;
    expect(zhouTwo.law).toMatchObject({ survivorHp: 50, companionAnalysisUsed: true });

    let luOne = clear(withSurvivorHp(40, {}, { id: 'lu_guanlan', rank: 1 }), 'north_checkpoint');
    expect(getEscortCheckpointStatus(luOne, 1).choices.treat).toMatchObject({
      survivorHpDelta: 25,
      healingPillCost: 1
    });
    luOne = resolveEscortCheckpointChoice(luOne, 'north_checkpoint', 'treat', 1).state;
    expect(luOne.law).toMatchObject({ survivorHp: 65, companionTriageUsed: false });
    let luTwo = clear(withSurvivorHp(40, {}, { id: 'lu_guanlan', rank: 2 }), 'north_checkpoint');
    expect(getEscortCheckpointStatus(luTwo, 0).choices.treat).toMatchObject({
      available: true,
      survivorHpDelta: 35,
      healingPillCost: 0
    });
    luTwo = resolveEscortCheckpointChoice(luTwo, 'north_checkpoint', 'treat', 0).state;
    expect(luTwo.law).toMatchObject({ survivorHp: 75, companionTriageUsed: true });
    luTwo = clear(luTwo, 'central_checkpoint');
    expect(getEscortCheckpointStatus(luTwo, 1).choices.treat).toMatchObject({
      survivorHpDelta: 25,
      healingPillCost: 1
    });
  });

  it('uses only current-run pills, stacks triage bonuses, and preserves failed states', () => {
    let pending = clear(withSurvivorHp(50, { triageVisor: true }), 'north_checkpoint');
    const noRunPills = getEscortCheckpointStatus(pending, 0);
    expect(noRunPills.availableHealingPills).toBe(0);
    expect(noRunPills.choices.treat).toMatchObject({
      available: false,
      survivorHpDelta: 35,
      healingPillCost: 1
    });
    expect(noRunPills.choices.push).toEqual({
      available: true,
      survivorHpDelta: -10,
      healingPillCost: 0,
      bonusRewardPoints: 200
    });

    const wrongNode = resolveEscortCheckpointChoice(pending, 'central_checkpoint', 'push', 0);
    expect(wrongNode.resolved).toBe(false);
    expect(wrongNode.state).toBe(pending);
    const illegal = resolveEscortCheckpointChoice(
      pending,
      'north_checkpoint',
      'unknown' as EscortCheckpointChoice,
      0
    );
    expect(illegal.resolved).toBe(false);
    expect(illegal.state).toBe(pending);

    pending = clear(withSurvivorHp(
      50,
      { triageVisor: true },
      { id: 'lu_guanlan', rank: 2 }
    ), 'north_checkpoint');
    const stacked = getEscortCheckpointStatus(pending, 0);
    expect(stacked.choices.treat).toMatchObject({
      available: true,
      survivorHpDelta: 45,
      healingPillCost: 0
    });
    const treated = resolveEscortCheckpointChoice(pending, 'north_checkpoint', 'treat', 0);
    expect(treated).toMatchObject({ resolved: true, survivorHpDelta: 45, healingPillCost: 0 });
    expect(treated.state.law).toMatchObject({ survivorHp: 95, companionTriageUsed: true });
    const repeated = resolveEscortCheckpointChoice(treated.state, 'north_checkpoint', 'treat', 9);
    expect(repeated.resolved).toBe(false);
    expect(repeated.state).toBe(treated.state);
  });

  it('never revives a dead survivor and freezes the beacon-adjusted Boss snapshot once', () => {
    let dead = clear(withSurvivorHp(10), 'fatal_trap', 'trap');
    expect(dead.law).toMatchObject({ survivorHp: 0 });
    dead = clear(dead, 'north_checkpoint');
    expect(getEscortCheckpointStatus(dead, 99).choices.treat).toMatchObject({ available: false });
    const pushedDead = resolveEscortCheckpointChoice(dead, 'north_checkpoint', 'push', 99);
    expect(pushedDead).toMatchObject({ resolved: true, survivorHpDelta: 0, bonusRewardPoints: 200 });
    expect(pushedDead.state.law).toMatchObject({ survivorHp: 0 });

    let state = withSurvivorHp(70, { blackboxBeacon: true });
    state = signalCombatStarted(state, {
      nodeId: 'shelter_overseer', isBoss: true, openingAction: 'attack'
    });
    expect(state.law).toMatchObject({ survivorHp: 70, bossSurvivorSnapshot: 80 });
    state = clear(state, 'post_boss_hazard', 'monster');
    expect(state.law).toMatchObject({ survivorHp: 60, bossSurvivorSnapshot: 80 });
    const repeated = signalCombatStarted(state, {
      nodeId: 'shelter_overseer', isBoss: true, openingAction: 'art'
    });
    expect(repeated.law).toMatchObject({ survivorHp: 60, bossSurvivorSnapshot: 80 });
    expect(getDungeonLawModifiers(repeated)).toMatchObject({
      encounter: { allStatsPercent: 0 },
      outgoingDamage: { forcePercent: 0, artPercent: 0 }
    });
    expect(getDungeonLawModifiers(repeated, { isBossEncounter: true })).toMatchObject({
      encounter: { allStatsPercent: -6 },
      outgoingDamage: { forcePercent: 6, artPercent: 6 }
    });
  });

  it('applies exact escort HP modifier bands and bounds every value', () => {
    const cases = [
      { hp: 100, enemy: -6, output: 6 },
      { hp: 75, enemy: -6, output: 6 },
      { hp: 74, enemy: 0, output: 0 },
      { hp: 41, enemy: 0, output: 0 },
      { hp: 40, enemy: 6, output: 4 },
      { hp: 1, enemy: 6, output: 4 },
      { hp: 0, enemy: 12, output: 8 }
    ];
    for (const testCase of cases) {
      const state = withSurvivorHp(testCase.hp);
      expect(getDungeonLawModifiers(state)).toMatchObject({
        encounter: { allStatsPercent: testCase.enemy },
        outgoingDamage: { forcePercent: testCase.output, artPercent: testCase.output }
      });
      expectBoundedModifiers(state);
    }
  });

  it('strictly normalizes escort state and exposes the full escort display', () => {
    const pending = clear(withSurvivorHp(
      55,
      {
        rescueCarbine: true,
        triageVisor: true,
        evacuationPlate: true,
        blackboxBeacon: true
      },
      { id: 'lu_guanlan', rank: 2 }
    ), 'north_checkpoint');
    if (pending.law.kind !== 'lost_shelter') throw new Error('Missing lost shelter law');
    const invalidStates: unknown[] = [
      { ...pending, extra: true },
      { ...pending, dungeonId: 'silent_broadcast_tower' },
      { ...pending, law: { ...pending.law, extra: true } },
      { ...pending, law: { ...pending.law, survivorHp: -1 } },
      { ...pending, law: { ...pending.law, survivorHp: 101 } },
      { ...pending, law: { ...pending.law, survivorHp: 1.5 } },
      { ...pending, law: { ...pending.law, pendingCheckpointNodeId: 'unknown_checkpoint' } },
      { ...pending, law: { ...pending.law, resolvedCheckpointChoices: { unknown: 'treat' } } },
      { ...pending, law: { ...pending.law, resolvedCheckpointChoices: { north_checkpoint: 'unknown' } } },
      { ...pending, clearedNodeIds: [] },
      {
        ...pending,
        law: {
          ...pending.law,
          resolvedCheckpointChoices: { north_checkpoint: 'treat' }
        }
      },
      { ...pending, law: { ...pending.law, entryCompanion: { id: null, rank: 2 } } },
      { ...pending, law: { ...pending.law, entryCompanion: { id: 'qin_che', rank: 0 } } },
      { ...pending, law: { ...pending.law, firstHazardGuardUsed: true } },
      { ...pending, law: { ...pending.law, companionAnalysisUsed: true } },
      { ...pending, law: { ...pending.law, entryCompanion: { id: 'qin_che', rank: 2 }, companionTriageUsed: true } },
      { ...pending, law: { ...pending.law, entryGear: { ...pending.law.entryGear, unknown: true } } },
      { ...pending, law: { ...pending.law, bossSurvivorSnapshot: 75 } }
    ];
    for (const invalid of invalidStates) {
      const snapshot = structuredClone(invalid);
      expect(normalizeDungeonLawState(invalid, LOST_SHELTER_DUNGEON_ID))
        .toEqual(createDungeonLawState(LOST_SHELTER_DUNGEON_ID));
      expect(invalid).toEqual(snapshot);
    }

    const display = getDungeonLawDisplay(pending, { availableHealingPills: 0 });
    expect(display).toMatchObject({
      dungeonId: 'lost_shelter',
      title: '失联护送律',
      status: expect.stringContaining('幸存者HP 55/100'),
      meter: { value: 55, max: 100 },
      escort: {
        totalCheckpointCount: 3,
        availableHealingPills: 0,
        pendingCheckpointNodeId: 'north_checkpoint',
        treatCount: 0,
        pushCount: 0,
        entryCompanion: { id: 'lu_guanlan', rank: 2 },
        companionRole: expect.stringContaining('免药分诊'),
        entryGear: {
          rescueCarbine: true,
          triageVisor: true,
          evacuationPlate: true,
          blackboxBeacon: true
        },
        choices: {
          treat: { available: true, survivorHpDelta: 45, healingPillCost: 0 },
          push: { available: true, survivorHpDelta: -10, bonusRewardPoints: 200 }
        }
      }
    });
    expect(display.status).toContain('北:未定，中:未定，南:未定');
    expect(display.status).toContain('run止血丹 0');
    expect(display.status).toContain('Boss快照 未冻结');
  });

  describe('false testimony court law', () => {
    it('tracks all three evidence items in both clean and pre-contaminated orders', () => {
      const eliminatedByEvidence: Record<FalseTestimonyEvidenceId, FalseTestimonySuspect> = {
        voice_evidence: 'field_medic',
        timeline_evidence: 'security_chief',
        residue_evidence: 'records_keeper'
      };
      for (const evidenceId of DUNGEON_LAW_LANDMARKS.false_testimony_court.evidenceNodeIds) {
        const clean = revealFalseTestimonyEvidence(
          createDungeonLawState(FALSE_TESTIMONY_COURT_DUNGEON_ID),
          evidenceId
        );
        expect(getFalseTestimonyStatus(clean)).toMatchObject({
          currentTrustedCount: 1,
          eliminatedSuspects: [eliminatedByEvidence[evidenceId]]
        });
        expect(getFalseTestimonyStatus(clean).evidence.find(({ id }) => id === evidenceId))
          .toMatchObject({ revealed: true, contaminated: false, trusted: true });

        const contaminated = revealFalseTestimonyEvidence(
          createDungeonLawState(FALSE_TESTIMONY_COURT_DUNGEON_ID),
          evidenceId,
          true
        );
        expect(getFalseTestimonyStatus(contaminated)).toMatchObject({
          currentTrustedCount: 0,
          eliminatedSuspects: []
        });
        expect(getFalseTestimonyStatus(contaminated).evidence.find(({ id }) => id === evidenceId))
          .toMatchObject({ revealed: true, contaminated: true, trusted: false });
      }

      let illegalLateTrap = clear(
        createDungeonLawState(FALSE_TESTIMONY_COURT_DUNGEON_ID),
        'voice_evidence'
      );
      illegalLateTrap = clear(illegalLateTrap, 'voice_filter_trap', 'trap', 10);
      expect(illegalLateTrap.law).toMatchObject({
        revealedEvidenceIds: ['voice_evidence'],
        contaminatedEvidenceIds: [],
        custodyProtectionUsed: false
      });
    });

    it('spends custody protection only on the first would-be contamination and keeps visor baseline untrusted', () => {
      let state = createDungeonLawState(FALSE_TESTIMONY_COURT_DUNGEON_ID, {
        entryGear: { custodyShell: true, forensicVisor: true }
      });
      state = clear(state, 'voice_filter_trap', 'trap', 0);
      expect(state.law).toMatchObject({ custodyProtectionUsed: false, contaminatedEvidenceIds: [] });
      state = clear(state, 'timeline_checksum_trap', 'trap', 5);
      expect(state.law).toMatchObject({ custodyProtectionUsed: true, contaminatedEvidenceIds: [] });
      state = clear(state, 'residue_sterility_trap', 'trap', 5);
      expect(state.law).toMatchObject({
        custodyProtectionUsed: true,
        contaminatedEvidenceIds: ['residue_evidence']
      });
      const status = getFalseTestimonyStatus(state);
      expect(status.currentTrustedCount).toBe(0);
      expect(status.eliminatedSuspects).toEqual(['field_medic']);
    });

    it('allows all four suspects, rewards only the culprit, and preserves failed states', () => {
      const suspects: readonly FalseTestimonySuspect[] = [
        'records_keeper', 'field_medic', 'security_chief', 'route_surveyor'
      ];
      for (const suspect of suspects) {
        let pending = revealFalseTestimonyEvidence(
          createDungeonLawState(FALSE_TESTIMONY_COURT_DUNGEON_ID),
          'voice_evidence'
        );
        pending = clear(pending, 'verdict_chamber');
        const resolution = resolveFalseTestimonyAccusation(pending, suspect);
        expect(resolution).toMatchObject({
          resolved: true,
          correct: suspect === 'route_surveyor',
          rewardPoints: suspect === 'route_surveyor' ? 480 : 0
        });
        const repeated = resolveFalseTestimonyAccusation(resolution.state, suspect);
        expect(repeated.resolved).toBe(false);
        expect(repeated.state).toBe(resolution.state);
      }
      const idle = createDungeonLawState(FALSE_TESTIMONY_COURT_DUNGEON_ID);
      const unknown = resolveFalseTestimonyAccusation(idle, 'unknown' as FalseTestimonySuspect);
      expect(unknown.resolved).toBe(false);
      expect(unknown.state).toBe(idle);
    });

    it('freezes all three original reward bands and the sabre bonus before later clean evidence', () => {
      const evidenceIds = DUNGEON_LAW_LANDMARKS.false_testimony_court.evidenceNodeIds;
      const rewards = [480, 320, 160];
      for (let count = 1; count <= 3; count += 1) {
        expect(accuseWithEvidence(evidenceIds.slice(0, count)).rewardPoints).toBe(rewards[count - 1]);
        expect(accuseWithEvidence(
          evidenceIds.slice(0, count),
          'route_surveyor',
          { crossExaminerSabre: true }
        ).rewardPoints).toBe(rewards[count - 1] + 120);
      }

      let originalOne = accuseWithEvidence(['voice_evidence']).state;
      originalOne = revealFalseTestimonyEvidence(originalOne, 'timeline_evidence');
      originalOne = revealFalseTestimonyEvidence(originalOne, 'residue_evidence');
      expect(getFalseTestimonyStatus(originalOne)).toMatchObject({
        currentTrustedCount: 3,
        accusationTrustedCount: 1,
        projectedAccusationRewardPoints: 480
      });
    });

    it('makes the false vault permanently consume appeal eligibility and gives appeals no reward', () => {
      let withoutSeal = accuseWithEvidence(['voice_evidence'], 'records_keeper').state;
      withoutSeal = clear(withoutSeal, 'appeal_desk');
      expect(getFalseTestimonyStatus(withoutSeal).pendingVerdictNodeId).toBeNull();

      let vaulted = accuseWithEvidence(
        ['voice_evidence'], 'records_keeper', { appealSeal: true }
      ).state;
      vaulted = clear(vaulted, 'false_verdict_vault');
      vaulted = clear(vaulted, 'appeal_desk');
      expect(getFalseTestimonyStatus(vaulted)).toMatchObject({
        appealEligible: false,
        pendingVerdictNodeId: null,
        accusationCorrect: false
      });

      let appealed = accuseWithEvidence(
        ['voice_evidence'], 'records_keeper', { appealSeal: true }
      ).state;
      appealed = clear(appealed, 'appeal_desk');
      const corrected = resolveFalseTestimonyAccusation(appealed, 'route_surveyor');
      expect(corrected).toMatchObject({
        resolved: true,
        appealed: true,
        correct: true,
        rewardPoints: 0
      });
      expect(corrected.state.law).toMatchObject({
        accusedSuspect: 'route_surveyor',
        accusationCorrect: true,
        accusationTrustedCount: 1,
        appealUsed: true
      });

      let maintained = accuseWithEvidence(
        ['voice_evidence'], 'records_keeper', { appealSeal: true }
      ).state;
      maintained = clear(maintained, 'appeal_desk');
      const same = resolveFalseTestimonyAccusation(maintained, 'records_keeper');
      expect(same).toMatchObject({ resolved: true, appealed: true, correct: false, rewardPoints: 0 });
    });

    it('freezes each Boss verdict band once and clamps every modifier', () => {
      const three = accuseWithEvidence([
        'voice_evidence', 'timeline_evidence', 'residue_evidence'
      ]).state;
      const two = accuseWithEvidence(['voice_evidence', 'timeline_evidence']).state;
      let appeal = accuseWithEvidence(
        ['voice_evidence'], 'records_keeper', { appealSeal: true }
      ).state;
      appeal = clear(appeal, 'appeal_desk');
      appeal = resolveFalseTestimonyAccusation(appeal, 'route_surveyor').state;
      const wrong = accuseWithEvidence(['voice_evidence'], 'records_keeper').state;
      const cases = [
        { state: three, enemy: -8, player: 6, appealed: false },
        { state: two, enemy: -4, player: 8, appealed: false },
        { state: appeal, enemy: -2, player: 4, appealed: true },
        { state: wrong, enemy: 10, player: 10, appealed: false }
      ];
      for (const testCase of cases) {
        const started = startFalseTestimonyBoss(testCase.state);
        expect(started.law).toMatchObject({
          bossVerdictSnapshot: { appealed: testCase.appealed }
        });
        expect(getDungeonLawModifiers(started, { isBossEncounter: true })).toMatchObject({
          encounter: { allStatsPercent: testCase.enemy },
          outgoingDamage: { forcePercent: testCase.player, artPercent: testCase.player }
        });
        expectBoundedModifiers(started);
        const snapshot = structuredClone(
          started.law.kind === 'false_testimony_court' ? started.law.bossVerdictSnapshot : null
        );
        const afterClear = revealFalseTestimonyEvidence(started, 'residue_evidence');
        expect(afterClear.law).toMatchObject({ bossVerdictSnapshot: snapshot });
        const repeated = startFalseTestimonyBoss(afterClear);
        expect(repeated.law).toMatchObject({ bossVerdictSnapshot: snapshot });
      }
    });

    it('strictly normalizes exact persistent state and renders compact evidence status', () => {
      let preContaminated = createDungeonLawState(FALSE_TESTIMONY_COURT_DUNGEON_ID);
      preContaminated = clear(preContaminated, 'voice_filter_trap', 'trap', 5);
      expect(normalizeDungeonLawState(
        preContaminated,
        FALSE_TESTIMONY_COURT_DUNGEON_ID
      )).toEqual(preContaminated);

      const valid = startFalseTestimonyBoss(accuseWithEvidence(
        ['voice_evidence'],
        'route_surveyor',
        {
          crossExaminerSabre: true,
          forensicVisor: true,
          custodyShell: true,
          appealSeal: true
        }
      ).state);
      if (valid.law.kind !== 'false_testimony_court') throw new Error('Missing verdict law');
      const invalidStates: unknown[] = [
        { ...valid, extra: true },
        { ...valid, clearedNodeIds: [...valid.clearedNodeIds, valid.clearedNodeIds[0]] },
        { ...valid, law: { ...valid.law, extra: true } },
        { ...valid, law: { ...valid.law, revealedEvidenceIds: ['unknown_evidence'] } },
        { ...valid, law: { ...valid.law, revealedEvidenceIds: ['voice_evidence', 'voice_evidence'] } },
        { ...valid, clearedNodeIds: valid.clearedNodeIds.filter((id) => id !== 'voice_evidence') },
        { ...valid, law: { ...valid.law, pendingVerdictNodeId: 'appeal_desk' } },
        { ...valid, law: { ...valid.law, accusationCorrect: false } },
        { ...valid, law: { ...valid.law, accusationTrustedCount: 3 } },
        {
          ...valid,
          law: {
            ...valid.law,
            bossVerdictSnapshot: { ...valid.law.bossVerdictSnapshot!, trustedCount: 4 }
          }
        },
        { ...valid, law: { ...valid.law, entryGear: { ...valid.law.entryGear, extra: true } } },
        { ...valid, law: { ...valid.law, entryGear: { ...valid.law.entryGear, appealSeal: 'yes' } } },
        {
          ...createDungeonLawState(FALSE_TESTIMONY_COURT_DUNGEON_ID),
          law: {
            ...createDungeonLawState(FALSE_TESTIMONY_COURT_DUNGEON_ID).law,
            custodyProtectionUsed: true
          }
        }
      ];
      for (const invalid of invalidStates) {
        const snapshot = structuredClone(invalid);
        expect(normalizeDungeonLawState(invalid, FALSE_TESTIMONY_COURT_DUNGEON_ID))
          .toEqual(createDungeonLawState(FALSE_TESTIMONY_COURT_DUNGEON_ID));
        expect(invalid).toEqual(snapshot);
      }

      const display = getDungeonLawDisplay(valid);
      expect(display).toMatchObject({
        dungeonId: 'false_testimony_court',
        title: '伪证裁定律',
        falseTestimony: {
          currentTrustedCount: 1,
          accusationTrustedCount: 1,
          eliminatedSuspects: ['field_medic'],
          projectedAccusationRewardPoints: 600
        }
      });
      expect(display.status).toContain('声纹:净');
      expect(display.status).toContain('时序:未揭示');
      expect(display.status).toContain('裁刃:有');
      expect(display.status).toContain('Boss快照:');
    });
  });
});
