import { describe, expect, it } from 'vitest';
import { getBossDefinition } from './boss-system';
import {
  COMBAT_REPLAY_STAGE_DUNGEON_ID,
  DUNGEON_LAW_LANDMARKS,
  createDungeonLawState,
  freezeCombatReplayBossSnapshot,
  normalizeDungeonLawState,
  recordCombatReplayTake,
  resolveFalseTestimonyAccusation,
  resolveBroadcastRelayChoice,
  resolveEscortCheckpointChoice,
  selectCombatReplayRoute,
  selectPanopticonRoute,
  type ArchiveSealableFeature,
  type AuctionLotChoice,
  type AuctionLotNodeId,
  type CombatOpeningStyle,
  type CombatReplayRoute,
  type DungeonLawState,
  type EscortCheckpointChoice,
  type FalseTestimonyEntryGear,
  type FalseTestimonyEvidenceId,
  type FalseTestimonySuspect,
  type GenesisGene,
  type MirrorCityPhase,
  type PanopticonRoute,
  type RedactionChoice,
  type BroadcastRelayChoice
} from './dungeon-laws';
import { resolveMirrorCityPhaseChoice, signalFirstNodeClear } from './dungeon-laws';
import {
  DUNGEON_ROUTE_GATES,
  getDungeonRouteGates,
  getLegalAdjacentTargetIds,
  getProceduralBossAccessStatus,
  getRouteBlockReason,
  getRouteGateStatus,
  getRouteSectorDisplay,
  type DungeonRouteGateDefinition
} from './dungeon-routes';
import {
  createInitialState,
  enterDungeon,
  moveToNode,
  type DungeonId,
  type GameState
} from './game';
import { DUNGEONS, DUNGEON_ORDER } from './level-content';
import { getRunProtocolDefinition } from './run-protocols';

const OPENING_STYLES: readonly CombatOpeningStyle[] = ['force', 'art', 'guard'];

type OpeningDistribution = Record<CombatOpeningStyle, number>;

type GateCase = {
  readonly dungeonId: DungeonId;
  readonly gateId: string;
  readonly openState: DungeonLawState;
  readonly closedState: DungeonLawState;
  readonly reopenHint: string;
};

function withLaw(dungeonId: DungeonId, law: DungeonLawState['law']): DungeonLawState {
  return { ...createDungeonLawState(dungeonId), law };
}

function withCausalDebt(debt: number): DungeonLawState {
  const state = createDungeonLawState('causal_clearinghouse');
  if (state.law.kind !== 'causal_clearinghouse') throw new Error('Missing causal clearinghouse law');
  return { ...state, law: { ...state.law, debt } };
}

function withEntropy(entropy: number): DungeonLawState {
  const state = createDungeonLawState('entropy_ark');
  if (state.law.kind !== 'entropy_ark') throw new Error('Missing entropy ark law');
  return { ...state, law: { ...state.law, entropy } };
}

type MirrorCityLaw = Extract<DungeonLawState['law'], { kind: 'mirror_cycle_city' }>;

function withMirrorCityLaw(law: Partial<MirrorCityLaw> = {}): DungeonLawState {
  const state = createDungeonLawState('mirror_cycle_city');
  if (state.law.kind !== 'mirror_cycle_city') throw new Error('Missing mirror cycle city law');
  return normalizeDungeonLawState({
    ...state,
    law: { ...state.law, ...law }
  }, 'mirror_cycle_city');
}

function completeMirrorCityChoices(
  phase: MirrorCityPhase = 'real',
  anchors: MirrorCityLaw['anchors'] = { real: false, mirror: false }
): DungeonLawState {
  return withMirrorCityLaw({
    currentPhase: phase,
    resolvedPhaseChoices: {
      first_phase_mirror: phase,
      second_phase_mirror: phase,
      third_phase_mirror: phase
    },
    anchors
  });
}

type RedactionLaw = Extract<DungeonLawState['law'], { kind: 'redaction_scriptorium' }>;

function withRedactionChoices(
  body: RedactionChoice,
  memory: RedactionChoice,
  returnChoice: RedactionChoice
): DungeonLawState {
  const state = createDungeonLawState('redaction_scriptorium');
  if (state.law.kind !== 'redaction_scriptorium') throw new Error('Missing redaction law');
  const law: RedactionLaw = {
    ...state.law,
    resolvedClauseChoices: {
      body_clause_desk: body,
      memory_clause_desk: memory,
      return_clause_desk: returnChoice
    }
  };
  return { ...state, law };
}

function withAuctionChoices(
  force: AuctionLotChoice,
  guard: AuctionLotChoice,
  art: AuctionLotChoice,
  returnChoice: AuctionLotChoice
): DungeonLawState {
  const state = createDungeonLawState('legacy_auction_court');
  if (state.law.kind !== 'legacy_auction_court') throw new Error('Missing legacy auction law');
  return {
    ...state,
    law: {
      ...state.law,
      resolvedLotChoices: {
        force_lot_dais: force,
        guard_lot_dais: guard,
        art_lot_dais: art,
        return_lot_dais: returnChoice
      }
    }
  };
}

function withGenesisSequence(sequence: readonly GenesisGene[]): DungeonLawState {
  const state = createDungeonLawState('genesis_vault');
  if (state.law.kind !== 'genesis_vault') throw new Error('Missing genesis vault law');
  return { ...state, law: { ...state.law, spliceSequence: [...sequence] } };
}

function withBroadcastChoices(
  noise: number,
  choices: readonly BroadcastRelayChoice[]
): DungeonLawState {
  const state = createDungeonLawState('silent_broadcast_tower');
  if (state.law.kind !== 'silent_broadcast_tower') throw new Error('Missing broadcast law');
  const resolvedRelayChoices = Object.fromEntries(
    DUNGEON_LAW_LANDMARKS.silent_broadcast_tower.relayNodeIds
      .slice(0, choices.length)
      .map((nodeId, index) => [nodeId, choices[index]])
  );
  return {
    ...state,
    clearedNodeIds: DUNGEON_LAW_LANDMARKS.silent_broadcast_tower.relayNodeIds.slice(0, choices.length),
    law: { ...state.law, noise, resolvedRelayChoices }
  };
}

function withEscortState(
  survivorHp: number,
  choices: readonly EscortCheckpointChoice[] = ['treat', 'treat', 'treat']
): DungeonLawState {
  const state = createDungeonLawState('lost_shelter');
  if (state.law.kind !== 'lost_shelter') throw new Error('Missing lost shelter law');
  const checkpointNodeIds = DUNGEON_LAW_LANDMARKS.lost_shelter.checkpointNodeIds;
  const resolvedCheckpointChoices = Object.fromEntries(
    checkpointNodeIds.slice(0, choices.length).map((nodeId, index) => [nodeId, choices[index]])
  );
  return {
    ...state,
    clearedNodeIds: checkpointNodeIds.slice(0, choices.length),
    law: { ...state.law, survivorHp, resolvedCheckpointChoices }
  };
}

type FalseTestimonyLaw = Extract<DungeonLawState['law'], { kind: 'false_testimony_court' }>;

function withFalseTestimonyState(input: {
  revealedEvidenceIds?: readonly FalseTestimonyEvidenceId[];
  contaminatedEvidenceIds?: readonly FalseTestimonyEvidenceId[];
  accusedSuspect?: FalseTestimonySuspect | null;
  accusationTrustedCount?: number;
  appealUsed?: boolean;
  entryGear?: Partial<FalseTestimonyEntryGear>;
  clearedNodeIds?: readonly string[];
} = {}): DungeonLawState {
  const state = createDungeonLawState('false_testimony_court', { entryGear: input.entryGear });
  if (state.law.kind !== 'false_testimony_court') throw new Error('Missing false testimony law');
  const accusedSuspect = input.accusedSuspect ?? null;
  const law: FalseTestimonyLaw = {
    ...state.law,
    revealedEvidenceIds: [...(input.revealedEvidenceIds ?? [])],
    contaminatedEvidenceIds: [...(input.contaminatedEvidenceIds ?? [])],
    accusedSuspect,
    accusationCorrect: accusedSuspect === null ? null : accusedSuspect === 'route_surveyor',
    accusationTrustedCount: input.accusationTrustedCount ?? 0,
    appealUsed: input.appealUsed ?? false,
    entryGear: { ...state.law.entryGear, ...input.entryGear }
  };
  return { ...state, clearedNodeIds: [...(input.clearedNodeIds ?? [])], law };
}

const FALSE_TESTIMONY_ALL_TRAPS = [
  'voice_filter_trap', 'timeline_checksum_trap', 'residue_sterility_trap'
] as const;

const FALSE_TESTIMONY_TRUTH_STATE = withFalseTestimonyState({
  revealedEvidenceIds: ['voice_evidence', 'timeline_evidence', 'residue_evidence'],
  accusedSuspect: 'route_surveyor',
  accusationTrustedCount: 3,
  clearedNodeIds: FALSE_TESTIMONY_ALL_TRAPS
});

function withCombatReplayRoute(route?: CombatReplayRoute): DungeonLawState {
  let state = createDungeonLawState(COMBAT_REPLAY_STAGE_DUNGEON_ID);
  for (const [index, nodeId] of DUNGEON_LAW_LANDMARKS.combat_replay_stage.takeNodeIds.entries()) {
    const recorded = recordCombatReplayTake(state, nodeId, 'attack', index + 1);
    if (!recorded.recorded) throw new Error(`Failed to record ${nodeId}`);
    state = recorded.state;
  }
  if (!route) return state;
  const selected = selectCombatReplayRoute(state, route);
  if (!selected.selected) throw new Error(`Failed to select ${route}`);
  return selected.state;
}

function withPanopticonRoute(route?: PanopticonRoute): DungeonLawState {
  let state = createDungeonLawState('panopticon_city');
  for (const nodeId of DUNGEON_LAW_LANDMARKS.panopticon_city.relayNodeIds) {
    state = signalFirstNodeClear(state, { node: { id: nodeId, type: 'reward' } });
  }
  return route ? selectPanopticonRoute(state, route).state : state;
}

describe('combat replay stage routes', () => {
  const routeNodeByRoute: Readonly<Record<CombatReplayRoute, string>> = {
    sequence: 'sequence_route',
    burst: 'burst_route',
    afterbeat: 'afterbeat_route'
  };

  it('authors gates only on real orthogonal edges of the fixed 30-node 6x5 map', () => {
    const dungeon = DUNGEONS[COMBAT_REPLAY_STAGE_DUNGEON_ID];
    expect(dungeon.grid).toEqual({ width: 6, height: 5, startNodeId: 'stage_gate' });
    expect(dungeon.nodes).toHaveLength(30);
    const positions = new Map(dungeon.nodes.map((node) => [node.id, node.position]));
    const gates = getDungeonRouteGates(COMBAT_REPLAY_STAGE_DUNGEON_ID);
    expect(gates.length).toBeGreaterThan(0);
    for (const gate of gates) {
      const from = positions.get(gate.fromNodeId);
      const to = positions.get(gate.toNodeId);
      expect(from, gate.fromNodeId).toBeDefined();
      expect(to, gate.toNodeId).toBeDefined();
      expect(Math.abs(from!.x - to!.x) + Math.abs(from!.y - to!.y), gate.id).toBe(1);
    }
    expect(getRouteGateStatus(
      COMBAT_REPLAY_STAGE_DUNGEON_ID,
      'stage_gate',
      'final_cut_director',
      createDungeonLawState(COMBAT_REPLAY_STAGE_DUNGEON_ID)
    )).toBeUndefined();
  });

  it('opens take_alpha, take_beta, and take_gamma strictly in order and blocks every take exit until recorded', () => {
    let state = createDungeonLawState(COMBAT_REPLAY_STAGE_DUNGEON_ID);
    const entryNeighbor = {
      take_alpha: 'opening_prop_cache',
      take_beta: 'upper_entry',
      take_gamma: 'rehearsal_hall'
    } as const;
    for (const [index, takeNodeId] of DUNGEON_LAW_LANDMARKS.combat_replay_stage.takeNodeIds.entries()) {
      for (const [candidateIndex, candidateNodeId] of DUNGEON_LAW_LANDMARKS.combat_replay_stage.takeNodeIds.entries()) {
        expect(getRouteGateStatus(
          COMBAT_REPLAY_STAGE_DUNGEON_ID,
          entryNeighbor[candidateNodeId],
          candidateNodeId,
          state
        )?.isOpen, `${takeNodeId}:${candidateNodeId}`).toBe(candidateIndex === index);
      }
      const adjacent = getAdjacentTargetIds(COMBAT_REPLAY_STAGE_DUNGEON_ID, takeNodeId);
      expect(adjacent).toHaveLength(4);
      expect(getLegalAdjacentTargetIds(
        COMBAT_REPLAY_STAGE_DUNGEON_ID,
        takeNodeId,
        adjacent,
        state
      )).toEqual([]);
      const recorded = recordCombatReplayTake(state, takeNodeId, 'attack', index);
      expect(recorded.recorded).toBe(true);
      state = recorded.state;
      const legalAfterRecording = getLegalAdjacentTargetIds(
        COMBAT_REPLAY_STAGE_DUNGEON_ID,
        takeNodeId,
        adjacent,
        state
      );
      expect(legalAfterRecording.length).toBeGreaterThan(0);
    }
  });

  it('keeps a legal staged path from the script projection through recording, route review, and the Boss', () => {
    let state = createDungeonLawState(COMBAT_REPLAY_STAGE_DUNGEON_ID);
    expect(getRouteDistances(
      COMBAT_REPLAY_STAGE_DUNGEON_ID,
      state,
      'script_projection_stage'
    ).has('take_alpha')).toBe(true);

    state = recordCombatReplayTake(state, 'take_alpha', 'attack', 1).state;
    expect(getRouteDistances(
      COMBAT_REPLAY_STAGE_DUNGEON_ID,
      state,
      'script_projection_stage'
    ).has('take_beta')).toBe(true);

    state = recordCombatReplayTake(state, 'take_beta', 'art', 2).state;
    expect(getRouteDistances(
      COMBAT_REPLAY_STAGE_DUNGEON_ID,
      state,
      'script_projection_stage'
    ).has('take_gamma')).toBe(true);

    state = recordCombatReplayTake(state, 'take_gamma', 'guard', 3).state;
    state = selectCombatReplayRoute(state, 'sequence').state;
    const readyDistances = getRouteDistances(
      COMBAT_REPLAY_STAGE_DUNGEON_ID,
      state,
      'script_projection_stage'
    );
    expect(readyDistances.has('sequence_route')).toBe(true);
    expect(readyDistances.has('final_cut_director')).toBe(true);
  });

  it('keeps all three route branches closed before selection and permanently opens only the selected branch', () => {
    const complete = withCombatReplayRoute();
    const ingressByRoute: Readonly<Record<CombatReplayRoute, string>> = {
      sequence: 'opening_prop_cache',
      burst: 'continuity_editor_alpha',
      afterbeat: 'film_supply_cache'
    };
    for (const route of ['sequence', 'burst', 'afterbeat'] as const) {
      expect(getRouteGateStatus(
        COMBAT_REPLAY_STAGE_DUNGEON_ID,
        ingressByRoute[route],
        routeNodeByRoute[route],
        complete
      ), route).toMatchObject({ isOpen: false });
    }
    for (const selectedRoute of ['sequence', 'burst', 'afterbeat'] as const) {
      const selected = selectCombatReplayRoute(complete, selectedRoute).state;
      for (const route of ['sequence', 'burst', 'afterbeat'] as const) {
        expect(getRouteGateStatus(
          COMBAT_REPLAY_STAGE_DUNGEON_ID,
          ingressByRoute[route],
          routeNodeByRoute[route],
          selected
        )?.isOpen, `${selectedRoute}:${route}`).toBe(route === selectedRoute);
      }
      expect(selectCombatReplayRoute(selected, selectedRoute === 'sequence' ? 'burst' : 'sequence'))
        .toMatchObject({ selected: false, state: selected });
    }
  });

  it('requires three takes plus a route for every Boss entrance and a Boss victory for the exit', () => {
    const bossNeighbors = getAdjacentTargetIds(
      COMBAT_REPLAY_STAGE_DUNGEON_ID,
      'final_cut_director'
    );
    expect(new Set(bossNeighbors)).toEqual(new Set([
      'continuity_editor_alpha', 'take_gamma', 'theater_exit', 'final_cut_lock'
    ]));
    const incomplete = createDungeonLawState(COMBAT_REPLAY_STAGE_DUNGEON_ID);
    for (const neighborId of bossNeighbors) {
      expect(getRouteGateStatus(
        COMBAT_REPLAY_STAGE_DUNGEON_ID,
        neighborId,
        'final_cut_director',
        incomplete
      )?.isOpen).toBe(false);
    }

    const ready = withCombatReplayRoute('sequence');
    for (const neighborId of bossNeighbors) {
      const expectedOpen = neighborId !== 'theater_exit';
      expect(getRouteGateStatus(
        COMBAT_REPLAY_STAGE_DUNGEON_ID,
        neighborId,
        'final_cut_director',
        ready
      )?.isOpen, neighborId).toBe(expectedOpen);
    }
    for (const fromNodeId of ['final_cut_director', 'lower_return_portal']) {
      expect(getRouteGateStatus(
        COMBAT_REPLAY_STAGE_DUNGEON_ID,
        fromNodeId,
        'theater_exit',
        ready
      )?.blockReason).toBe('击败最终剪辑师后方可离场。');
    }
    const frozen = freezeCombatReplayBossSnapshot(ready);
    expect(frozen.frozen).toBe(true);
    expect(getRouteGateStatus(
      COMBAT_REPLAY_STAGE_DUNGEON_ID,
      'final_cut_director',
      'theater_exit',
      frozen.state
    )?.isOpen).toBe(false);
    const defeated: DungeonLawState = {
      ...frozen.state,
      clearedNodeIds: ['final_cut_director']
    };
    expect(defeated.law).toMatchObject({
      kind: 'combat_replay_stage',
      route: 'sequence',
      bossSnapshot: { route: 'sequence' }
    });
    expect(getLegalAdjacentTargetIds(
      COMBAT_REPLAY_STAGE_DUNGEON_ID,
      'final_cut_director',
      bossNeighbors,
      defeated
    )).toContain('theater_exit');
    for (const fromNodeId of ['final_cut_director', 'lower_return_portal']) {
      expect(getRouteGateStatus(
        COMBAT_REPLAY_STAGE_DUNGEON_ID,
        fromNodeId,
        'theater_exit',
        defeated
      )?.isOpen).toBe(true);
    }
  });
});

const FALSE_TESTIMONY_SWIFT_STATE = withFalseTestimonyState({
  revealedEvidenceIds: ['voice_evidence', 'timeline_evidence', 'residue_evidence'],
  accusedSuspect: 'route_surveyor',
  accusationTrustedCount: 1,
  clearedNodeIds: FALSE_TESTIMONY_ALL_TRAPS
});

function getNonBossCombatNodeIds(dungeonId: DungeonId): string[] {
  const bossNodeId = getBossDefinition(dungeonId).nodeId;
  return DUNGEONS[dungeonId].nodes
    .filter((node) => node.type === 'monster' && node.id !== bossNodeId)
    .map((node) => node.id);
}

function withOpeningDistribution(
  dungeonId: 'ash_arena' | 'void_citadel',
  distribution: OpeningDistribution
): DungeonLawState {
  const nodeIds = getNonBossCombatNodeIds(dungeonId);
  const combatOpenings: DungeonLawState['combatOpenings'] = {};
  const combatVictoryNodeIds: string[] = [];
  let nodeIndex = 0;

  for (const style of OPENING_STYLES) {
    for (let count = 0; count < distribution[style]; count += 1) {
      const nodeId = nodeIds[nodeIndex];
      if (!nodeId) throw new Error(`Not enough combat nodes for ${dungeonId}`);
      combatOpenings[nodeId] = { isBoss: false, style };
      combatVictoryNodeIds.push(nodeId);
      nodeIndex += 1;
    }
  }

  return {
    ...createDungeonLawState(dungeonId),
    combatOpenings,
    combatVictoryNodeIds
  };
}

function openings(force: number, art: number, guard: number): OpeningDistribution {
  return { force, art, guard };
}

const GATE_CASES: readonly GateCase[] = [
  {
    dungeonId: 'demon_tower_1',
    gateId: 'demon_fog_bone_lane',
    openState: withLaw('demon_tower_1', { kind: 'demon_tower', fogPressure: 1 }),
    closedState: withLaw('demon_tower_1', { kind: 'demon_tower', fogPressure: 2 }),
    reopenHint: '雾后暗格'
  },
  {
    dungeonId: 'metro_abyss',
    gateId: 'metro_ebb_boss_lane',
    openState: withLaw('metro_abyss', { kind: 'metro_abyss', tide: 'ebb' }),
    closedState: withLaw('metro_abyss', { kind: 'metro_abyss', tide: 'mirror' }),
    reopenHint: '信号箱暗格'
  },
  {
    dungeonId: 'starfall_mine',
    gateId: 'mine_upward_beast_lane',
    openState: withLaw('starfall_mine', { kind: 'starfall_mine', gravity: 'upward' }),
    closedState: withLaw('starfall_mine', { kind: 'starfall_mine', gravity: 'downward' }),
    reopenHint: '重力岔路闸'
  },
  {
    dungeonId: 'rust_hospital',
    gateId: 'hospital_clean_roof_lane',
    openState: withLaw('rust_hospital', { kind: 'rust_hospital', pollution: 2 }),
    closedState: withLaw('rust_hospital', { kind: 'rust_hospital', pollution: 3 }),
    reopenHint: '药房'
  },
  {
    dungeonId: 'ash_arena',
    gateId: 'arena_three_style_judge_lane',
    openState: withOpeningDistribution('ash_arena', openings(1, 1, 1)),
    closedState: withOpeningDistribution('ash_arena', openings(1, 1, 0)),
    reopenHint: '力、术、守'
  },
  {
    dungeonId: 'dream_archive',
    gateId: 'archive_method_jailer_lane',
    openState: withLaw('dream_archive', { kind: 'dream_archive', sealedFeatures: ['consumable'] }),
    closedState: withLaw('dream_archive', {
      kind: 'dream_archive',
      sealedFeatures: ['consumable', 'method']
    }),
    reopenHint: '索引柜'
  },
  {
    dungeonId: 'void_citadel',
    gateId: 'citadel_balanced_core_lane',
    openState: withOpeningDistribution('void_citadel', openings(2, 2, 1)),
    closedState: withOpeningDistribution('void_citadel', openings(3, 1, 1)),
    reopenHint: '次数差'
  },
  {
    dungeonId: 'temporal_observatory',
    gateId: 'temporal_calibration_bridge',
    openState: withLaw('temporal_observatory', {
      kind: 'temporal_observatory',
      pastCalibrated: true,
      futureCalibrated: true
    }),
    closedState: withLaw('temporal_observatory', {
      kind: 'temporal_observatory',
      pastCalibrated: false,
      futureCalibrated: false
    }),
    reopenHint: '过去与未来'
  },
  {
    dungeonId: 'causal_clearinghouse',
    gateId: 'causal_cause_bailiff_lane',
    openState: withCausalDebt(2),
    closedState: withCausalDebt(3),
    reopenHint: '因果债'
  },
  {
    dungeonId: 'mirror_cycle_city',
    gateId: 'mirror_city_real_relic_phase_lane',
    openState: withMirrorCityLaw({ currentPhase: 'real' }),
    closedState: withMirrorCityLaw({ currentPhase: 'mirror' }),
    reopenHint: '现实相位'
  },
  {
    dungeonId: 'redaction_scriptorium',
    gateId: 'redaction_memory_north_entry',
    openState: withRedactionChoices('redact', 'certify', 'redact'),
    closedState: withRedactionChoices('certify', 'redact', 'certify'),
    reopenHint: '认证'
  },
  {
    dungeonId: 'legacy_auction_court',
    gateId: 'auction_force_gallery_vault',
    openState: withAuctionChoices('bid', 'burn', 'fold', 'bid'),
    closedState: withAuctionChoices('fold', 'bid', 'burn', 'fold'),
    reopenHint: '竞得'
  },
  {
    dungeonId: 'genesis_vault',
    gateId: 'genesis_force_gallery_vault',
    openState: withGenesisSequence(['force', 'force', 'art']),
    closedState: withGenesisSequence(['force', 'art', 'guard']),
    reopenHint: '专精至少2次'
  },
  {
    dungeonId: 'silent_broadcast_tower',
    gateId: 'broadcast_silent_archive_gate',
    openState: withBroadcastChoices(1, ['mute', 'mute', 'broadcast']),
    closedState: withBroadcastChoices(1, ['mute', 'broadcast', 'broadcast']),
    reopenHint: '静默'
  },
  {
    dungeonId: 'lost_shelter',
    gateId: 'shelter_evacuation_cache_east_in',
    openState: withEscortState(75),
    closedState: withEscortState(74),
    reopenHint: 'HP至少75'
  },
  {
    dungeonId: 'false_testimony_court',
    gateId: 'false_testimony_truth_archive_to_voice_evidence',
    openState: FALSE_TESTIMONY_TRUTH_STATE,
    closedState: createDungeonLawState('false_testimony_court'),
    reopenHint: '全部条件'
  },
  {
    dungeonId: 'combat_replay_stage',
    gateId: 'combat_replay_sequence_route_to_opening_prop_cache',
    openState: withCombatReplayRoute('sequence'),
    closedState: withCombatReplayRoute(),
    reopenHint: '顺序路线'
  },
  {
    dungeonId: 'panopticon_city',
    gateId: 'panopticon_shadow_route_to_blindline_archive',
    openState: withPanopticonRoute('shadow'),
    closedState: withPanopticonRoute(),
    reopenHint: '影路路线'
  }
];

const REPRESENTATIVE_GATE_EDGES: Readonly<
  Record<DungeonId, { readonly id: string; readonly fromNodeId: string; readonly toNodeId: string }>
> = {
  demon_tower_1: {
    id: 'demon_fog_bone_lane',
    fromNodeId: 'mist_herb_cache',
    toNodeId: 'bone_lane_monster'
  },
  metro_abyss: {
    id: 'metro_ebb_boss_lane',
    fromNodeId: 'boatman_echo',
    toNodeId: 'mirror_thread_spider'
  },
  starfall_mine: {
    id: 'mine_upward_beast_lane',
    fromNodeId: 'rift_dust_reward',
    toNodeId: 'molt_beast_den'
  },
  rust_hospital: {
    id: 'hospital_clean_roof_lane',
    fromNodeId: 'roof_access_trap',
    toNodeId: 'chief_pulse_doctor'
  },
  ash_arena: {
    id: 'arena_three_style_judge_lane',
    fromNodeId: 'oath_cinders',
    toNodeId: 'furnace_judge'
  },
  dream_archive: {
    id: 'archive_method_jailer_lane',
    fromNodeId: 'paper_cut_trap',
    toNodeId: 'dream_jailer_second'
  },
  void_citadel: {
    id: 'citadel_balanced_core_lane',
    fromNodeId: 'growth_mirror_trap',
    toNodeId: 'main_god_echo'
  },
  temporal_observatory: {
    id: 'temporal_calibration_bridge',
    fromNodeId: 'calibration_bridge',
    toNodeId: 'zero_hour_regent'
  },
  causal_clearinghouse: {
    id: 'causal_cause_bailiff_lane',
    fromNodeId: 'cause_foyer',
    toNodeId: 'cause_bailiff'
  },
  entropy_ark: {
    id: 'ark_bow_dissipation_lane',
    fromNodeId: 'bow_heading_console',
    toNodeId: 'dissipation_navigator_alpha'
  },
  mirror_cycle_city: {
    id: 'mirror_city_real_relic_phase_lane',
    fromNodeId: 'first_phase_mirror',
    toNodeId: 'real_relic_gallery'
  },
  redaction_scriptorium: {
    id: 'redaction_memory_north_entry',
    fromNodeId: 'north_clue_cache',
    toNodeId: 'memory_survey_archive'
  },
  legacy_auction_court: {
    id: 'auction_force_gallery_vault',
    fromNodeId: 'force_relic_gallery',
    toNodeId: 'force_claim_vault'
  },
  genesis_vault: {
    id: 'genesis_force_gallery_vault',
    fromNodeId: 'force_sample_gallery',
    toNodeId: 'force_gene_vault'
  },
  silent_broadcast_tower: {
    id: 'broadcast_silent_archive_gate',
    fromNodeId: 'north_echo_cache',
    toNodeId: 'silent_archive'
  },
  lost_shelter: {
    id: 'shelter_evacuation_cache_east_in',
    fromNodeId: 'north_supply_cache',
    toNodeId: 'evacuation_cache'
  },
  false_testimony_court: {
    id: 'false_testimony_truth_archive_to_voice_evidence',
    fromNodeId: 'truth_archive',
    toNodeId: 'voice_evidence'
  },
  combat_replay_stage: {
    id: 'combat_replay_sequence_route_to_opening_prop_cache',
    fromNodeId: 'sequence_route',
    toNodeId: 'opening_prop_cache'
  },
  panopticon_city: {
    id: 'panopticon_shadow_route_to_blindline_archive',
    fromNodeId: 'shadow_route',
    toNodeId: 'blindline_archive'
  }
};

const REOPENING_NODE_IDS: Readonly<Record<DungeonId, readonly string[]>> = {
  demon_tower_1: [
    ...DUNGEON_LAW_LANDMARKS.demon_tower_1.reliefNodeIds,
    'blood_rune_trap'
  ],
  metro_abyss: DUNGEON_LAW_LANDMARKS.metro_abyss.calibrationNodeIds,
  starfall_mine: DUNGEON_LAW_LANDMARKS.starfall_mine.gravitySwitchNodeIds,
  rust_hospital: [
    ...DUNGEON_LAW_LANDMARKS.rust_hospital.pharmacyNodeIds,
    'triage_reward'
  ],
  ash_arena: ['ash_duelist', 'ember_pit_duelist', 'cinder_lancer'],
  dream_archive: DUNGEON_LAW_LANDMARKS.dream_archive.indexNodeIds,
  void_citadel: ['void_knight', 'first_echo_patrol', 'echo_gate_guard'],
  temporal_observatory: [
    ...DUNGEON_LAW_LANDMARKS.temporal_observatory.pastAnchorNodeIds,
    ...DUNGEON_LAW_LANDMARKS.temporal_observatory.futureAnchorNodeIds
  ],
  causal_clearinghouse: ['verdict_usher', 'contradiction_line'],
  entropy_ark: DUNGEON_LAW_LANDMARKS.entropy_ark.headingConsoleNodeIds,
  mirror_cycle_city: [
    ...DUNGEON_LAW_LANDMARKS.mirror_cycle_city.phaseChoiceNodeIds,
    ...DUNGEON_LAW_LANDMARKS.mirror_cycle_city.realAnchorNodeIds,
    ...DUNGEON_LAW_LANDMARKS.mirror_cycle_city.mirrorAnchorNodeIds
  ],
  redaction_scriptorium: DUNGEON_LAW_LANDMARKS.redaction_scriptorium.clauseNodeIds,
  legacy_auction_court: DUNGEON_LAW_LANDMARKS.legacy_auction_court.lotNodeIds,
  genesis_vault: DUNGEON_LAW_LANDMARKS.genesis_vault.spliceNodeIds,
  silent_broadcast_tower: DUNGEON_LAW_LANDMARKS.silent_broadcast_tower.relayNodeIds,
  lost_shelter: DUNGEON_LAW_LANDMARKS.lost_shelter.checkpointNodeIds,
  false_testimony_court: [
    ...DUNGEON_LAW_LANDMARKS.false_testimony_court.trapNodeIds,
    ...DUNGEON_LAW_LANDMARKS.false_testimony_court.evidenceNodeIds
  ],
  combat_replay_stage: ['stage_gate'],
  panopticon_city: DUNGEON_LAW_LANDMARKS.panopticon_city.relayNodeIds
};

function getGate(dungeonId: DungeonId, gateId: string): DungeonRouteGateDefinition {
  const gate = getDungeonRouteGates(dungeonId).find((candidate) => candidate.id === gateId);
  if (!gate) throw new Error(`Missing route gate ${dungeonId}:${gateId}`);
  return gate;
}

function getAdjacentTargetIds(dungeonId: DungeonId, fromNodeId: string): string[] {
  const dungeon = DUNGEONS[dungeonId];
  const from = dungeon.nodes.find((node) => node.id === fromNodeId);
  if (!from) throw new Error(`Missing node ${dungeonId}:${fromNodeId}`);

  return dungeon.nodes
    .filter((node) => {
      const distance = Math.abs(node.position.x - from.position.x) + Math.abs(node.position.y - from.position.y);
      return distance === 1;
    })
    .map((node) => node.id);
}

function getRouteDistances(
  dungeonId: DungeonId,
  lawState: DungeonLawState,
  sourceNodeId = DUNGEONS[dungeonId].grid.startNodeId
): Map<string, number> {
  const distances = new Map<string, number>([[sourceNodeId, 0]]);
  const pending = [sourceNodeId];

  for (let index = 0; index < pending.length; index += 1) {
    const fromNodeId = pending[index];
    const distance = distances.get(fromNodeId);
    if (distance === undefined) continue;
    const adjacentTargetIds = getAdjacentTargetIds(dungeonId, fromNodeId);
    const legalTargetIds = getLegalAdjacentTargetIds(dungeonId, fromNodeId, adjacentTargetIds, lawState);

    for (const targetId of legalTargetIds) {
      if (distances.has(targetId)) continue;
      distances.set(targetId, distance + 1);
      pending.push(targetId);
    }
  }

  return distances;
}

function getOpeningDistributions(maximumTotal: number): OpeningDistribution[] {
  const distributions: OpeningDistribution[] = [];
  for (let force = 0; force <= maximumTotal; force += 1) {
    for (let art = 0; art <= maximumTotal - force; art += 1) {
      for (let guard = 0; guard <= maximumTotal - force - art; guard += 1) {
        distributions.push(openings(force, art, guard));
      }
    }
  }
  return distributions;
}

function getLawDecisionStates(dungeonId: DungeonId): DungeonLawState[] {
  switch (dungeonId) {
    case 'demon_tower_1':
      return [0, 1, 2, 3].map((fogPressure) =>
        withLaw(dungeonId, { kind: 'demon_tower', fogPressure })
      );
    case 'metro_abyss':
      return (['ebb', 'flood', 'mirror'] as const).map((tide) =>
        withLaw(dungeonId, { kind: 'metro_abyss', tide })
      );
    case 'starfall_mine':
      return (['upward', 'downward'] as const).map((gravity) =>
        withLaw(dungeonId, { kind: 'starfall_mine', gravity })
      );
    case 'rust_hospital':
      return [0, 1, 2, 3, 4].map((pollution) =>
        withLaw(dungeonId, { kind: 'rust_hospital', pollution })
      );
    case 'ash_arena':
    case 'void_citadel':
      return getOpeningDistributions(getNonBossCombatNodeIds(dungeonId).length).map((distribution) =>
        withOpeningDistribution(dungeonId, distribution)
      );
    case 'dream_archive': {
      const features: readonly ArchiveSealableFeature[] = ['consumable', 'method', 'pet'];
      return Array.from({ length: 2 ** features.length }, (_, mask) =>
        withLaw(dungeonId, {
          kind: 'dream_archive',
          sealedFeatures: features.filter((_, index) => (mask & (1 << index)) !== 0)
        })
      );
    }
    case 'temporal_observatory':
      return [false, true].flatMap((pastCalibrated) =>
        [false, true].map((futureCalibrated) =>
          withLaw(dungeonId, {
            kind: 'temporal_observatory',
            pastCalibrated,
            futureCalibrated
          })
        )
      );
    case 'causal_clearinghouse':
      return [0, 1, 2, 3, 4].map(withCausalDebt);
    case 'entropy_ark':
      return [0, 1, 2, 3, 4].map(withEntropy);
    case 'mirror_cycle_city':
      return (['real', 'mirror'] as const).flatMap((currentPhase) =>
        [false, true].flatMap((choicesComplete) =>
          [false, true].flatMap((real) =>
            [false, true].map((mirror) => withMirrorCityLaw({
              currentPhase,
              resolvedPhaseChoices: choicesComplete ? {
                first_phase_mirror: currentPhase,
                second_phase_mirror: currentPhase,
                third_phase_mirror: currentPhase
              } : {},
              anchors: { real, mirror }
            }))
          )
        )
      );
    case 'redaction_scriptorium':
      return [
        createDungeonLawState(dungeonId),
        ...(['certify', 'redact'] as const).flatMap((body) =>
          (['certify', 'redact'] as const).flatMap((memory) =>
            (['certify', 'redact'] as const).map((returnChoice) =>
              withRedactionChoices(body, memory, returnChoice)
            )
          )
        )
      ];
    case 'legacy_auction_court':
      return [
        createDungeonLawState(dungeonId),
        ...(['bid', 'burn', 'fold'] as const).flatMap((force) =>
          (['bid', 'burn', 'fold'] as const).flatMap((guard) =>
            (['bid', 'burn', 'fold'] as const).flatMap((art) =>
              (['bid', 'burn', 'fold'] as const).map((returnChoice) =>
                withAuctionChoices(force, guard, art, returnChoice)
              )
            )
          )
        )
      ];
    case 'genesis_vault': {
      const genes: readonly GenesisGene[] = ['force', 'art', 'guard', 'renewal'];
      return [
        createDungeonLawState(dungeonId),
        ...genes.flatMap((first) =>
          genes.flatMap((second) =>
            genes.map((third) => withGenesisSequence([first, second, third]))
          )
        )
      ];
    }
    case 'silent_broadcast_tower': {
      return [
        createDungeonLawState(dungeonId),
        ...Array.from({ length: 8 }, (_, mask) =>
          Array.from({ length: 3 }, (_, index): BroadcastRelayChoice =>
            ((mask >> index) & 1) === 0 ? 'mute' : 'broadcast'
          )
        ).flatMap((relayChoices) =>
          Array.from({ length: 7 }, (_, noise) => withBroadcastChoices(noise, relayChoices))
        )
      ];
    }
    case 'lost_shelter':
      return [
        createDungeonLawState(dungeonId),
        ...[0, 40, 41, 74, 75, 100].map((survivorHp) => withEscortState(survivorHp))
      ];
    case 'false_testimony_court':
      return [
        createDungeonLawState(dungeonId),
        withFalseTestimonyState({ clearedNodeIds: FALSE_TESTIMONY_ALL_TRAPS }),
        withFalseTestimonyState({
          revealedEvidenceIds: ['voice_evidence'],
          clearedNodeIds: FALSE_TESTIMONY_ALL_TRAPS
        }),
        FALSE_TESTIMONY_TRUTH_STATE,
        FALSE_TESTIMONY_SWIFT_STATE,
        withFalseTestimonyState({
          revealedEvidenceIds: ['voice_evidence'],
          accusedSuspect: 'records_keeper',
          accusationTrustedCount: 1,
          entryGear: { appealSeal: true },
          clearedNodeIds: FALSE_TESTIMONY_ALL_TRAPS
        }),
        withFalseTestimonyState({
          revealedEvidenceIds: ['voice_evidence'],
          accusedSuspect: 'route_surveyor',
          accusationTrustedCount: 1,
          appealUsed: true,
          entryGear: { appealSeal: true },
          clearedNodeIds: [...FALSE_TESTIMONY_ALL_TRAPS, 'appeal_desk']
        })
      ];
    case 'combat_replay_stage': {
      const empty = createDungeonLawState(dungeonId);
      const alpha = recordCombatReplayTake(empty, 'take_alpha', 'attack', 1).state;
      const beta = recordCombatReplayTake(alpha, 'take_beta', 'art', 2).state;
      const complete = recordCombatReplayTake(beta, 'take_gamma', 'guard', 3).state;
      const selected = (['sequence', 'burst', 'afterbeat'] as const).map((route) =>
        selectCombatReplayRoute(complete, route).state
      );
      return [
        empty,
        alpha,
        beta,
        complete,
        ...selected,
        ...selected.map((state) => ({
          ...state,
          clearedNodeIds: ['final_cut_director']
        }))
      ];
    }
    case 'panopticon_city': {
      const complete = withPanopticonRoute();
      const selected = (['shadow', 'decoy', 'refraction'] as const).map((route) =>
        selectPanopticonRoute(complete, route).state
      );
      return [
        createDungeonLawState(dungeonId),
        complete,
        ...selected,
        ...selected.map((state) => ({
          ...state,
          clearedNodeIds: ['all_sight_warden']
        }))
      ];
    }
  }
}

function getGateDecisionState(
  dungeonId: DungeonId,
  gate: DungeonRouteGateDefinition,
  shouldOpen: boolean
): DungeonLawState {
  const state = getLawDecisionStates(dungeonId).find((candidate) => {
    const status = getRouteGateStatus(dungeonId, gate.fromNodeId, gate.toNodeId, candidate);
    return status?.isOpen === shouldOpen;
  });
  if (!state) throw new Error(`Missing ${shouldOpen ? 'open' : 'closed'} state for ${gate.id}`);
  return state;
}

function isDangerousNode(dungeonId: DungeonId, nodeId: string): boolean {
  const type = DUNGEONS[dungeonId].nodes.find((node) => node.id === nodeId)?.type;
  return type === 'monster' || type === 'trap';
}

describe('dungeon route gates', () => {
  it('evaluates procedural Boss readiness without depending on a random incoming edge', () => {
    const closed = getProceduralBossAccessStatus(
      'metro_abyss',
      'mirror_thread_spider',
      withLaw('metro_abyss', { kind: 'metro_abyss', tide: 'mirror' })
    );
    expect(closed).toMatchObject({
      allowed: false,
      eligibleSourceNodeIds: []
    });
    expect(closed.blockReason).toContain('信号箱暗格');

    expect(getProceduralBossAccessStatus(
      'metro_abyss',
      'mirror_thread_spider',
      withLaw('metro_abyss', { kind: 'metro_abyss', tide: 'ebb' })
    )).toEqual({
      allowed: true,
      eligibleSourceNodeIds: ['boatman_echo']
    });
  });

  it('accepts every authored Boss approach when any canonical inbound gate is open', () => {
    for (const dungeonId of DUNGEON_ORDER) {
      const bossNodeId = getBossDefinition(dungeonId).nodeId;
      const bossGates = getDungeonRouteGates(dungeonId).filter(
        (gate) => gate.toNodeId === bossNodeId
      );
      expect(bossGates.length, dungeonId).toBeGreaterThan(0);
      for (const gate of bossGates) {
        const state = getGateDecisionState(dungeonId, gate, true);
        const access = getProceduralBossAccessStatus(dungeonId, bossNodeId, state);
        expect(access.allowed, `${dungeonId}:${gate.id}`).toBe(true);
        expect(
          access.eligibleSourceNodeIds,
          `${dungeonId}:${gate.id}:source`
        ).toContain(gate.fromNodeId);
      }
    }
  });

  it('preserves legacy gates and validates one representative gate per dungeon', () => {
    expect(DUNGEON_ORDER.length).toBe(19);
    expect(new Set(Object.keys(DUNGEON_ROUTE_GATES))).toEqual(new Set(DUNGEON_ORDER));
    expect(GATE_CASES.map(({ dungeonId }) => dungeonId)).toEqual(
      DUNGEON_ORDER.filter((dungeonId) => dungeonId !== 'entropy_ark')
    );

    for (const gateCase of GATE_CASES) {
      const gate = getGate(gateCase.dungeonId, gateCase.gateId);
      if (gateCase.dungeonId !== 'temporal_observatory') {
        expect(getDungeonRouteGates(gateCase.dungeonId)[0]).toMatchObject(
          REPRESENTATIVE_GATE_EDGES[gateCase.dungeonId]
        );
      }
      expect(gate).toMatchObject(REPRESENTATIVE_GATE_EDGES[gateCase.dungeonId]);
      expect(
        getRouteGateStatus(gateCase.dungeonId, gate.fromNodeId, gate.toNodeId, gateCase.openState),
        gateCase.dungeonId
      ).toMatchObject({ gate, status: 'open', isOpen: true });
      expect(
        getRouteBlockReason(gateCase.dungeonId, gate.fromNodeId, gate.toNodeId, gateCase.openState),
        gateCase.dungeonId
      ).toBeUndefined();

      const closed = getRouteGateStatus(
        gateCase.dungeonId,
        gate.fromNodeId,
        gate.toNodeId,
        gateCase.closedState
      );
      expect(closed, gateCase.dungeonId).toMatchObject({ gate, status: 'closed', isOpen: false });
      if (!closed || closed.status !== 'closed') throw new Error(`Expected closed gate for ${gateCase.dungeonId}`);
      expect(closed.blockReason, gateCase.dungeonId).toContain(gateCase.reopenHint);
      expect(closed.blockReason.length, gateCase.dungeonId).toBeLessThanOrEqual(40);
    }
  });

  it('stops recommending spent fog relief landmarks after every recovery was consumed', () => {
    const gate = getGate('demon_tower_1', 'demon_fog_bone_lane');
    const base = withLaw('demon_tower_1', { kind: 'demon_tower', fogPressure: 3 });
    const exhausted: DungeonLawState = {
      ...base,
      clearedNodeIds: [...DUNGEON_LAW_LANDMARKS.demon_tower_1.reliefNodeIds],
      resolvedEventIds: [...DUNGEON_LAW_LANDMARKS.demon_tower_1.reliefEventIds]
    };

    expect(
      getRouteBlockReason('demon_tower_1', gate.fromNodeId, gate.toNodeId, exhausted)
    ).toBe('雾压需降至 1 或以下；减压地标均已结算，改走白光裂口侧路或撤回。');
  });

  it('keeps the original twelve chapter gate catalogs unchanged', () => {
    const legacyCounts = {
      demon_tower_1: 4,
      metro_abyss: 4,
      starfall_mine: 4,
      rust_hospital: 4,
      ash_arena: 4,
      dream_archive: 4,
      void_citadel: 4,
      temporal_observatory: 5,
      causal_clearinghouse: 5,
      entropy_ark: 5,
      mirror_cycle_city: 9,
      redaction_scriptorium: 10
    } as const;
    expect(DUNGEON_ORDER.slice(0, 12)).toEqual(Object.keys(legacyCounts));
    for (const [dungeonId, count] of Object.entries(legacyCounts)) {
      expect(getDungeonRouteGates(dungeonId as keyof typeof legacyCounts)).toHaveLength(count);
    }
  });

  it('gates temporal shortcuts independently, requires both anchors at the boss, and keeps the north bypass open', () => {
    const states = {
      none: withLaw('temporal_observatory', {
        kind: 'temporal_observatory',
        pastCalibrated: false,
        futureCalibrated: false
      }),
      past: withLaw('temporal_observatory', {
        kind: 'temporal_observatory',
        pastCalibrated: true,
        futureCalibrated: false
      }),
      future: withLaw('temporal_observatory', {
        kind: 'temporal_observatory',
        pastCalibrated: false,
        futureCalibrated: true
      }),
      dual: withLaw('temporal_observatory', {
        kind: 'temporal_observatory',
        pastCalibrated: true,
        futureCalibrated: true
      })
    };
    const requirements = [
      ['past_shortcut_foyer', 'erased_patrol', 'past_calibrated'],
      ['future_shortcut_foyer', 'accelerated_patrol', 'future_calibrated'],
      ['calibration_bridge', 'zero_hour_regent', 'dual_calibrated'],
      ['boss_south_lock', 'zero_hour_regent', 'dual_calibrated'],
      ['east_time_lock', 'zero_hour_regent', 'dual_calibrated']
    ] as const;

    for (const [fromNodeId, toNodeId, requirementKind] of requirements) {
      const gate = getDungeonRouteGates('temporal_observatory').find(
        (candidate) => candidate.fromNodeId === fromNodeId && candidate.toNodeId === toNodeId
      );
      expect(gate?.requirement.kind, `${fromNodeId}->${toNodeId}`).toBe(requirementKind);
      expect(getRouteGateStatus('temporal_observatory', fromNodeId, toNodeId, states.none)?.isOpen).toBe(false);
      expect(getRouteGateStatus('temporal_observatory', fromNodeId, toNodeId, states.dual)?.isOpen).toBe(true);
      if (requirementKind === 'dual_calibrated') {
        expect(getRouteGateStatus('temporal_observatory', fromNodeId, toNodeId, states.past)?.isOpen).toBe(false);
        expect(getRouteGateStatus('temporal_observatory', fromNodeId, toNodeId, states.future)?.isOpen).toBe(false);
      }
    }

    expect(getRouteGateStatus('temporal_observatory', 'past_shortcut_foyer', 'erased_patrol', states.past)?.isOpen).toBe(true);
    expect(getRouteGateStatus('temporal_observatory', 'future_shortcut_foyer', 'accelerated_patrol', states.past)?.isOpen).toBe(false);
    expect(getRouteGateStatus('temporal_observatory', 'past_shortcut_foyer', 'erased_patrol', states.future)?.isOpen).toBe(false);
    expect(getRouteGateStatus('temporal_observatory', 'future_shortcut_foyer', 'accelerated_patrol', states.future)?.isOpen).toBe(true);

    expect(
      getRouteGateStatus(
        'temporal_observatory',
        'field_observation_deck',
        'boss_north_lock',
        states.none
      )
    ).toBeUndefined();
    expect(
      getLegalAdjacentTargetIds(
        'temporal_observatory',
        'field_observation_deck',
        ['boss_north_lock'],
        states.none
      )
    ).toEqual(['boss_north_lock']);
    expect(getRouteDistances('temporal_observatory', states.none).has('zero_hour_regent')).toBe(true);
  });

  it('applies causal debt thresholds exactly at debt 0, 2, 3, and 4 while keeping the south boss route open', () => {
    const gates = getDungeonRouteGates('causal_clearinghouse');
    expect(gates.map((gate) => [gate.fromNodeId, gate.toNodeId, gate.requirement])).toEqual([
      ['cause_foyer', 'cause_bailiff', { kind: 'debt_at_most', maximum: 2 }],
      ['effect_foyer', 'effect_bailiff', { kind: 'debt_at_most', maximum: 2 }],
      ['verdict_bridge', 'zero_sum_auditor', { kind: 'debt_at_most', maximum: 2 }],
      ['north_verdict_lock', 'zero_sum_auditor', { kind: 'debt_at_most', maximum: 1 }],
      ['east_verdict_lock', 'zero_sum_auditor', { kind: 'debt_at_most', maximum: 3 }]
    ]);

    const expectedOpenByDebt: Readonly<Record<0 | 2 | 3 | 4, readonly boolean[]>> = {
      0: [true, true, true, true, true],
      2: [true, true, true, false, true],
      3: [false, false, false, false, true],
      4: [false, false, false, false, false]
    };
    for (const debt of [0, 2, 3, 4] as const) {
      const state = withCausalDebt(debt);
      expect(gates.map((gate) =>
        getRouteGateStatus('causal_clearinghouse', gate.fromNodeId, gate.toNodeId, state)?.isOpen
      ), `debt=${debt}`).toEqual(expectedOpenByDebt[debt]);
    }

    const debtFour = withCausalDebt(4);
    const closed = getRouteGateStatus(
      'causal_clearinghouse',
      'verdict_bridge',
      'zero_sum_auditor',
      debtFour
    );
    expect(closed).toMatchObject({
      status: 'closed',
      blockReason: expect.stringContaining('因果债需降至 2 或以下')
    });
    if (!closed || closed.status !== 'closed') throw new Error('Expected causal verdict bridge to close');
    expect(closed.blockReason).toContain('选择偿还');
    expect(getRouteGateStatus(
      'causal_clearinghouse',
      'south_verdict_lock',
      'zero_sum_auditor',
      debtFour
    )).toBeUndefined();
    expect(getRouteDistances('causal_clearinghouse', debtFour).has('zero_sum_auditor')).toBe(true);
  });

  it('authors five entropy gates with independent sectors, reasons, and exact positive/negative thresholds', () => {
    const gates = getDungeonRouteGates('entropy_ark');
    expect(gates.map(({ fromNodeId, toNodeId, requirement }) => [fromNodeId, toNodeId, requirement])).toEqual([
      ['bow_heading_console', 'dissipation_navigator_alpha', { kind: 'entropy_at_most', maximum: 1 }],
      ['bow_heading_console', 'port_relic_hold', { kind: 'entropy_at_least', minimum: 3 }],
      ['midship_heading_console', 'dissipation_navigator_omega', { kind: 'entropy_at_most', maximum: 1 }],
      ['midship_heading_console', 'starboard_relic_hold', { kind: 'entropy_at_least', minimum: 3 }],
      ['ark_manifest', 'last_helmsman', { kind: 'entropy_between', minimum: 1, maximum: 3 }]
    ]);
    expect(new Set(gates.map((gate) => gate.sector?.id)).size).toBe(5);
    expect(new Set(gates.map((gate) => gate.closedReason)).size).toBe(5);
    expect(gates.every((gate) => Boolean(gate.closedReason && /[\u4e00-\u9fff]/u.test(gate.closedReason)))).toBe(true);

    const cases = [
      { gateIndex: 0, openEntropy: 1, closedEntropy: 2 },
      { gateIndex: 1, openEntropy: 3, closedEntropy: 2 },
      { gateIndex: 2, openEntropy: 1, closedEntropy: 2 },
      { gateIndex: 3, openEntropy: 3, closedEntropy: 2 },
      { gateIndex: 4, openEntropy: 2, closedEntropy: 4 }
    ] as const;
    for (const testCase of cases) {
      const gate = gates[testCase.gateIndex];
      if (!gate) throw new Error(`Missing entropy gate ${testCase.gateIndex}`);
      expect(getRouteGateStatus(
        'entropy_ark',
        gate.fromNodeId,
        gate.toNodeId,
        withEntropy(testCase.openEntropy)
      )).toMatchObject({ gate, status: 'open', isOpen: true });
      expect(getRouteGateStatus(
        'entropy_ark',
        gate.fromNodeId,
        gate.toNodeId,
        withEntropy(testCase.closedEntropy)
      )).toMatchObject({
        gate,
        status: 'closed',
        isOpen: false,
        blockReason: gate.closedReason
      });
    }

    const expectedOpenByEntropy: Readonly<Record<number, readonly boolean[]>> = {
      0: [true, false, true, false, false],
      1: [true, false, true, false, true],
      2: [false, false, false, false, true],
      3: [false, true, false, true, true],
      4: [false, true, false, true, false]
    };
    for (const entropy of [0, 1, 2, 3, 4]) {
      expect(gates.map((gate) => getRouteGateStatus(
        'entropy_ark', gate.fromNodeId, gate.toNodeId, withEntropy(entropy)
      )?.isOpen), `entropy=${entropy}`).toEqual(expectedOpenByEntropy[entropy]);
    }
  });

  it('authors mirror city phase, anchor, and four choice-complete boss gates', () => {
    const gates = getDungeonRouteGates('mirror_cycle_city');
    expect(gates.map(({ fromNodeId, toNodeId, requirement }) => [fromNodeId, toNodeId, requirement])).toEqual([
      ['first_phase_mirror', 'real_relic_gallery', { kind: 'mirror_city_phase', phase: 'real' }],
      ['reflection_event_stage', 'mirror_relic_gallery', { kind: 'mirror_city_phase', phase: 'mirror' }],
      ['real_anchor', 'mirror_city_survey', { kind: 'mirror_city_real_anchor' }],
      ['mirror_anchor', 'soul_recharge_mirror', { kind: 'mirror_city_mirror_anchor' }],
      ['cycle_manifest', 'mirror_city_survey', { kind: 'mirror_city_dual_anchors' }],
      ['cycle_manifest', 'nameless_reflection', { kind: 'mirror_city_all_phase_choices' }],
      ['parallax_corridor_trap', 'nameless_reflection', { kind: 'mirror_city_all_phase_choices' }],
      ['boss_side_trap', 'nameless_reflection', { kind: 'mirror_city_all_phase_choices' }],
      ['third_phase_mirror', 'nameless_reflection', { kind: 'mirror_city_all_phase_choices' }]
    ]);

    const real = withMirrorCityLaw({ currentPhase: 'real' });
    const mirror = withMirrorCityLaw({ currentPhase: 'mirror' });
    expect(getRouteGateStatus(
      'mirror_cycle_city',
      'first_phase_mirror',
      'real_relic_gallery',
      real
    )?.isOpen).toBe(true);
    expect(getRouteGateStatus(
      'mirror_cycle_city',
      'first_phase_mirror',
      'real_relic_gallery',
      mirror
    )?.isOpen).toBe(false);
    expect(getRouteGateStatus(
      'mirror_cycle_city',
      'reflection_event_stage',
      'mirror_relic_gallery',
      mirror
    )?.isOpen).toBe(true);

    const noAnchors = completeMirrorCityChoices('mirror');
    const bossApproaches = gates.filter((gate) => gate.toNodeId === 'nameless_reflection');
    expect(bossApproaches).toHaveLength(4);
    expect(bossApproaches.every((gate) => gate.requirement.kind === 'mirror_city_all_phase_choices')).toBe(true);
    expect(bossApproaches.every((gate) =>
      getRouteGateStatus('mirror_cycle_city', gate.fromNodeId, gate.toNodeId, noAnchors)?.isOpen
    )).toBe(true);
    expect(noAnchors.law).toMatchObject({ anchors: { real: false, mirror: false } });

    const incomplete = withMirrorCityLaw({ anchors: { real: true, mirror: true } });
    expect(bossApproaches.every((gate) =>
      getRouteGateStatus('mirror_cycle_city', gate.fromNodeId, gate.toNodeId, incomplete)?.isOpen === false
    )).toBe(true);
    expect(getRouteGateStatus(
      'mirror_cycle_city',
      'real_anchor',
      'mirror_city_survey',
      withMirrorCityLaw({ anchors: { real: true, mirror: false } })
    )?.isOpen).toBe(true);
    expect(getRouteGateStatus(
      'mirror_cycle_city',
      'mirror_anchor',
      'soul_recharge_mirror',
      withMirrorCityLaw({ anchors: { real: false, mirror: true } })
    )?.isOpen).toBe(true);
    expect(getRouteGateStatus(
      'mirror_cycle_city',
      'cycle_manifest',
      'mirror_city_survey',
      withMirrorCityLaw({ anchors: { real: true, mirror: true } })
    )?.isOpen).toBe(true);
  });

  it('reaches the mirror king after transition-aware choices without touching either anchor', () => {
    const path = [
      'cycle_gate',
      'parallax_hunter_spine',
      'mirror_chorus_real',
      'parallax_hunter_real',
      'first_phase_mirror',
      'parallax_hunter_real',
      'mirror_chorus_real',
      'parallax_hunter_spine',
      'second_phase_mirror',
      'cycle_manifest',
      'soul_recharge_mirror',
      'third_phase_mirror',
      'nameless_reflection'
    ] as const;
    let lawState = createDungeonLawState('mirror_cycle_city');

    for (let index = 1; index < path.length; index += 1) {
      const fromNodeId = path[index - 1];
      const toNodeId = path[index];
      expect(
        getRouteBlockReason('mirror_cycle_city', fromNodeId, toNodeId, lawState),
        `${fromNodeId}->${toNodeId}`
      ).toBeUndefined();
      if (DUNGEON_LAW_LANDMARKS.mirror_cycle_city.phaseChoiceNodeIds.some((nodeId) => nodeId === toNodeId)) {
        lawState = signalFirstNodeClear(lawState, { node: { id: toNodeId, type: 'reward' } });
        const resolution = resolveMirrorCityPhaseChoice(lawState, 'mirror');
        expect(resolution.resolved, toNodeId).toBe(true);
        lawState = resolution.state;
      }
    }

    expect(lawState.law).toMatchObject({
      currentPhase: 'mirror',
      anchors: { real: false, mirror: false },
      resolvedPhaseChoices: {
        first_phase_mirror: 'mirror',
        second_phase_mirror: 'mirror',
        third_phase_mirror: 'mirror'
      }
    });
    expect(getRouteDistances('mirror_cycle_city', lawState).has('nameless_reflection')).toBe(true);
  });

  it('authors all ten redaction gates with no optional-area or Boss bypass', () => {
    const gates = getDungeonRouteGates('redaction_scriptorium');
    expect(gates.map(({ fromNodeId, toNodeId, requirement }) => [
      fromNodeId,
      toNodeId,
      requirement
    ])).toEqual([
      ['north_clue_cache', 'memory_survey_archive', {
        kind: 'redaction_clause_certified', clause: 'memory_clause_desk'
      }],
      ['upper_supply_margin', 'memory_survey_archive', {
        kind: 'redaction_clause_certified', clause: 'memory_clause_desk'
      }],
      ['palimpsest_censor_alpha', 'body_proof_vault', {
        kind: 'redaction_clause_certified', clause: 'body_clause_desk'
      }],
      ['upper_revision_portal', 'body_proof_vault', {
        kind: 'redaction_clause_certified', clause: 'body_clause_desk'
      }],
      ['south_clue_cache', 'return_revision_portal', {
        kind: 'redaction_clause_certified', clause: 'return_clause_desk'
      }],
      ['lower_supply_margin', 'return_revision_portal', {
        kind: 'redaction_clause_certified', clause: 'return_clause_desk'
      }],
      ['final_proof_nexus', 'last_redactor', { kind: 'redaction_all_clauses_resolved' }],
      ['boss_north_lock', 'last_redactor', { kind: 'redaction_all_clauses_resolved' }],
      ['boss_side_lock', 'last_redactor', { kind: 'redaction_all_clauses_resolved' }],
      ['boss_south_lock', 'last_redactor', { kind: 'redaction_all_clauses_resolved' }]
    ]);

    const optionalAreas = {
      body_clause_desk: 'body_proof_vault',
      memory_clause_desk: 'memory_survey_archive',
      return_clause_desk: 'return_revision_portal'
    } as const;
    const incomplete = createDungeonLawState('redaction_scriptorium');
    expect(gates.filter((gate) => gate.toNodeId === 'last_redactor').every((gate) =>
      getRouteGateStatus(
        'redaction_scriptorium', gate.fromNodeId, gate.toNodeId, incomplete
      )?.isOpen === false
    )).toBe(true);

    for (const body of ['certify', 'redact'] as const) {
      for (const memory of ['certify', 'redact'] as const) {
        for (const returnChoice of ['certify', 'redact'] as const) {
          const state = withRedactionChoices(body, memory, returnChoice);
          const distances = getRouteDistances('redaction_scriptorium', state);
          expect(distances.has('last_redactor'), `${body}:${memory}:${returnChoice}:boss`).toBe(true);
          for (const [clause, areaNodeId] of Object.entries(optionalAreas) as [
            keyof typeof optionalAreas,
            string
          ][]) {
            const expected = state.law.kind === 'redaction_scriptorium' &&
              state.law.resolvedClauseChoices[clause] === 'certify';
            expect(
              distances.has(areaNodeId),
              `${body}:${memory}:${returnChoice}:${areaNodeId}`
            ).toBe(expected);
          }
        }
      }
    }

    for (const gate of gates.filter((candidate) => candidate.requirement.kind === 'redaction_clause_certified')) {
      const certified = withRedactionChoices('certify', 'certify', 'certify');
      expect(getRouteGateStatus(
        'redaction_scriptorium', gate.fromNodeId, gate.toNodeId, certified
      )?.isOpen).toBe(true);
      expect(getRouteGateStatus(
        'redaction_scriptorium', gate.toNodeId, gate.fromNodeId, certified
      )).toBeUndefined();
      expect(getRouteBlockReason(
        'redaction_scriptorium', gate.toNodeId, gate.fromNodeId, certified
      )).toBeUndefined();
    }
  });

  it('authors all twelve auction gates with bid-only vault entry and no Boss bypass in all 81 maps', () => {
    const gates = getDungeonRouteGates('legacy_auction_court');
    expect(gates.map(({ fromNodeId, toNodeId, requirement }) => [
      fromNodeId,
      toNodeId,
      requirement
    ])).toEqual([
      ['force_relic_gallery', 'force_claim_vault', {
        kind: 'auction_lot_bid', lot: 'force'
      }],
      ['archive_survey_gallery', 'force_claim_vault', {
        kind: 'auction_lot_bid', lot: 'force'
      }],
      ['inheritance_mimic_north', 'guard_claim_vault', {
        kind: 'auction_lot_bid', lot: 'guard'
      }],
      ['upper_auction_portal', 'guard_claim_vault', {
        kind: 'auction_lot_bid', lot: 'guard'
      }],
      ['lower_bid_supply', 'art_claim_vault', {
        kind: 'auction_lot_bid', lot: 'art'
      }],
      ['art_relic_gallery', 'art_claim_vault', {
        kind: 'auction_lot_bid', lot: 'art'
      }],
      ['lower_auction_portal', 'return_claim_vault', {
        kind: 'auction_lot_bid', lot: 'return'
      }],
      ['soul_recharge_auction', 'return_claim_vault', {
        kind: 'auction_lot_bid', lot: 'return'
      }],
      ['provenance_event_stage', 'estate_auctioneer', { kind: 'auction_all_lots_resolved' }],
      ['inheritance_mimic_alpha', 'estate_auctioneer', { kind: 'auction_all_lots_resolved' }],
      ['dead_team_testimony_stage', 'estate_auctioneer', { kind: 'auction_all_lots_resolved' }],
      ['boss_side_rostrum', 'estate_auctioneer', { kind: 'auction_all_lots_resolved' }]
    ]);

    const incomplete = createDungeonLawState('legacy_auction_court');
    expect(gates.filter((gate) => gate.toNodeId === 'estate_auctioneer').every((gate) =>
      getRouteGateStatus(
        'legacy_auction_court', gate.fromNodeId, gate.toNodeId, incomplete
      )?.isOpen === false
    )).toBe(true);
    expect(getRouteDistances('legacy_auction_court', incomplete).has('estate_auctioneer')).toBe(false);
    const validForMalformedControl = withAuctionChoices('bid', 'burn', 'fold', 'bid');
    if (validForMalformedControl.law.kind !== 'legacy_auction_court') {
      throw new Error('Missing auction law');
    }
    const malformed: DungeonLawState = {
      ...validForMalformedControl,
      law: {
        ...validForMalformedControl.law,
        resolvedLotChoices: {
          force_lot_dais: 'bid',
          guard_lot_dais: 'burn',
          art_lot_dais: 'steal',
          return_lot_dais: 'fold'
        } as unknown as typeof validForMalformedControl.law.resolvedLotChoices
      }
    };
    expect(getRouteDistances('legacy_auction_court', malformed).has('estate_auctioneer')).toBe(false);

    const vaults: Readonly<Record<AuctionLotNodeId, string>> = {
      force_lot_dais: 'force_claim_vault',
      guard_lot_dais: 'guard_claim_vault',
      art_lot_dais: 'art_claim_vault',
      return_lot_dais: 'return_claim_vault'
    };
    let combinationCount = 0;
    for (const force of ['bid', 'burn', 'fold'] as const) {
      for (const guard of ['bid', 'burn', 'fold'] as const) {
        for (const art of ['bid', 'burn', 'fold'] as const) {
          for (const returnChoice of ['bid', 'burn', 'fold'] as const) {
            combinationCount += 1;
            const state = withAuctionChoices(force, guard, art, returnChoice);
            const distances = getRouteDistances('legacy_auction_court', state);
            expect(
              distances.has('estate_auctioneer'),
              `${force}:${guard}:${art}:${returnChoice}:boss`
            ).toBe(true);
            if (state.law.kind !== 'legacy_auction_court') throw new Error('Missing auction law');
            for (const [lot, vault] of Object.entries(vaults) as [AuctionLotNodeId, string][]) {
              expect(
                distances.has(vault),
                `${force}:${guard}:${art}:${returnChoice}:${vault}`
              ).toBe(state.law.resolvedLotChoices[lot] === 'bid');
            }
          }
        }
      }
    }
    expect(combinationCount).toBe(81);

    const allBid = withAuctionChoices('bid', 'bid', 'bid', 'bid');
    for (const gate of gates.filter((candidate) => candidate.requirement.kind === 'auction_lot_bid')) {
      expect(getRouteGateStatus(
        'legacy_auction_court', gate.fromNodeId, gate.toNodeId, allBid
      )?.isOpen).toBe(true);
      expect(getRouteGateStatus(
        'legacy_auction_court', gate.toNodeId, gate.fromNodeId, allBid
      )).toBeUndefined();
      expect(getRouteBlockReason(
        'legacy_auction_court', gate.toNodeId, gate.fromNodeId, allBid
      )).toBeUndefined();
      expect(getLegalAdjacentTargetIds(
        'legacy_auction_court', gate.toNodeId, [gate.fromNodeId], allBid
      )).toEqual([gate.fromNodeId]);
    }
  });

  it('gives every authored edge at least one open and one readable closed law state', () => {
    for (const dungeonId of DUNGEON_ORDER) {
      for (const gate of getDungeonRouteGates(dungeonId)) {
        const openState = getGateDecisionState(dungeonId, gate, true);
        const closedState = getGateDecisionState(dungeonId, gate, false);
        const open = getRouteGateStatus(dungeonId, gate.fromNodeId, gate.toNodeId, openState);
        const closed = getRouteGateStatus(dungeonId, gate.fromNodeId, gate.toNodeId, closedState);

        expect(open, gate.id).toMatchObject({ gate, status: 'open', isOpen: true });
        expect(closed, gate.id).toMatchObject({ gate, status: 'closed', isOpen: false });
        if (!closed || closed.status !== 'closed') throw new Error(`Expected closed gate ${gate.id}`);
        expect(closed.blockReason.length, gate.id).toBeGreaterThan(0);
        expect(closed.blockReason.length, gate.id).toBeLessThanOrEqual(48);
      }
    }
  });

  it('summarizes sector status without duplicating gate-law decisions', () => {
    for (const dungeonId of DUNGEON_ORDER) {
      const gates = getDungeonRouteGates(dungeonId);
      for (const lawState of getLawDecisionStates(dungeonId)) {
        const displays = getRouteSectorDisplay(dungeonId, lawState);
        expect(new Set(displays.map((display) => display.id)).size, dungeonId).toBe(displays.length);
        expect(displays.reduce((total, display) => total + display.gateCount, 0), dungeonId).toBe(gates.length);

        for (const display of displays) {
          const sectorGates = gates.filter((gate) => (gate.sector?.id ?? gate.id) === display.id);
          const openGateCount = sectorGates.filter(
            (gate) => getRouteGateStatus(dungeonId, gate.fromNodeId, gate.toNodeId, lawState)?.isOpen
          ).length;
          const closedGateCount = sectorGates.length - openGateCount;
          const expectedStatus = closedGateCount === 0 ? 'open' : openGateCount === 0 ? 'closed' : 'partial';

          expect(display.openGateCount, `${dungeonId}:${display.id}`).toBe(openGateCount);
          expect(display.closedGateCount, `${dungeonId}:${display.id}`).toBe(closedGateCount);
          expect(display.status, `${dungeonId}:${display.id}`).toBe(expectedStatus);
          expect(new Set(display.blockReasons).size, `${dungeonId}:${display.id}`).toBe(
            display.blockReasons.length
          );
        }
      }
    }

    const ebbSectors = new Map(
      getRouteSectorDisplay(
        'metro_abyss',
        withLaw('metro_abyss', { kind: 'metro_abyss', tide: 'ebb' })
      ).map((display) => [display.id, display])
    );
    expect(ebbSectors.get('metro_ebb_tracks')?.status).toBe('open');
    expect(ebbSectors.get('metro_flood_tracks')?.status).toBe('closed');
    expect(ebbSectors.get('metro_mirror_tracks')?.status).toBe('closed');

    const hospitalSectors = new Map(
      getRouteSectorDisplay(
        'rust_hospital',
        withLaw('rust_hospital', { kind: 'rust_hospital', pollution: 1 })
      ).map((display) => [display.id, display])
    );
    expect(hospitalSectors.get('hospital_clean_wards')).toMatchObject({
      gateCount: 2,
      openGateCount: 1,
      closedGateCount: 1,
      status: 'partial'
    });
  });

  it('keeps legacy retreats open, seals shelter specialists both ways, and preserves candidate order', () => {
    for (const dungeonId of DUNGEON_ORDER) {
      for (const gate of getDungeonRouteGates(dungeonId)) {
        const closedState = getGateDecisionState(dungeonId, gate, false);
        const openState = getGateDecisionState(dungeonId, gate, true);
        const adjacentTargetIds = getAdjacentTargetIds(dungeonId, gate.fromNodeId);
        const prioritizedTargets = [...adjacentTargetIds].sort(
          (left, right) => Number(isDangerousNode(dungeonId, right)) - Number(isDangerousNode(dungeonId, left))
        );
        const candidateSnapshot = [...prioritizedTargets];
        const closedTargets = new Set(
          getDungeonRouteGates(dungeonId)
            .filter((candidate) => candidate.fromNodeId === gate.fromNodeId)
            .filter(
              (candidate) =>
                getRouteGateStatus(
                  dungeonId,
                  candidate.fromNodeId,
                  candidate.toNodeId,
                  closedState
                )?.status === 'closed'
            )
            .map((candidate) => candidate.toNodeId)
        );

        const reverseStatus = getRouteGateStatus(
          dungeonId,
          gate.toNodeId,
          gate.fromNodeId,
          closedState
        );
        const hasSealedReverseGate = dungeonId === 'lost_shelter' &&
          gate.toNodeId !== 'shelter_overseer';
        if (hasSealedReverseGate) {
          expect(reverseStatus, `${dungeonId}:${gate.id}`).toMatchObject({ status: 'closed' });
          expect(
            getLegalAdjacentTargetIds(dungeonId, gate.toNodeId, [gate.fromNodeId], closedState),
            `${dungeonId}:${gate.id}:sealed-retreat`
          ).toEqual([]);
        } else if (
          dungeonId === 'false_testimony_court' ||
          dungeonId === 'combat_replay_stage' ||
          dungeonId === 'panopticon_city'
        ) {
          expect(reverseStatus, `${dungeonId}:${gate.id}:reverse`).toBeDefined();
          expect(
            getLegalAdjacentTargetIds(dungeonId, gate.toNodeId, [gate.fromNodeId], closedState),
            `${dungeonId}:${gate.id}:paired-retreat`
          ).toEqual(reverseStatus?.isOpen ? [gate.fromNodeId] : []);
        } else {
          expect(reverseStatus, `${dungeonId}:${gate.id}`).toBeUndefined();
          expect(
            getLegalAdjacentTargetIds(dungeonId, gate.toNodeId, [gate.fromNodeId], closedState),
            `${dungeonId}:${gate.id}:retreat`
          ).toEqual([gate.fromNodeId]);
        }
        expect(
          getLegalAdjacentTargetIds(dungeonId, gate.fromNodeId, prioritizedTargets, closedState),
          `${dungeonId}:${gate.id}:closed`
        ).toEqual(prioritizedTargets.filter((nodeId) => !closedTargets.has(nodeId)));
        expect(
          getLegalAdjacentTargetIds(dungeonId, gate.fromNodeId, prioritizedTargets, openState),
          `${dungeonId}:${gate.id}:open`
        ).toContain(gate.toNodeId);
        expect(prioritizedTargets).toEqual(candidateSnapshot);
      }
    }
  });

  it('keeps an uncleared dangerous departure reason ahead of a closed route reason', () => {
    const gate = getGate('demon_tower_1', 'demon_clear_blood_stair');
    const entered = enterDungeon(createInitialState(), 'demon_tower_1');
    if (!entered.run) throw new Error('Failed to enter demon tower');
    const closedState = withLaw('demon_tower_1', { kind: 'demon_tower', fogPressure: 1 });
    const atDanger: GameState = {
      ...entered,
      phase: 'explore',
      run: {
        ...entered.run,
        currentNodeId: gate.fromNodeId,
        clearedNodeIds: [],
        lawState: closedState
      }
    };

    const dangerBlocked = moveToNode(atDanger, gate.toNodeId);
    expect(dangerBlocked.log[0]).toContain('先处理当前陷阱');
    expect(dangerBlocked.log[0]).not.toContain(gate.label);

    const clearedSource: GameState = {
      ...atDanger,
      run: { ...atDanger.run!, clearedNodeIds: [gate.fromNodeId] }
    };
    const routeBlocked = moveToNode(clearedSource, gate.toNodeId);
    expect(routeBlocked.log[0]).toContain(gate.label);
    expect(routeBlocked.run?.currentNodeId).toBe(gate.fromNodeId);
  });

  it('treats unknown and nonadjacent edges as having no route gate', () => {
    for (const gateCase of GATE_CASES) {
      const dungeon = DUNGEONS[gateCase.dungeonId];
      const start = dungeon.nodes.find((node) => node.id === dungeon.grid.startNodeId);
      if (!start) throw new Error(`Missing start node for ${gateCase.dungeonId}`);
      const nonadjacent = dungeon.nodes.find(
        (node) => Math.abs(node.position.x - start.position.x) + Math.abs(node.position.y - start.position.y) > 1
      );
      if (!nonadjacent) throw new Error(`Missing nonadjacent node for ${gateCase.dungeonId}`);

      expect(
        getRouteGateStatus(
          gateCase.dungeonId,
          start.id,
          nonadjacent.id,
          gateCase.closedState
        )
      ).toBeUndefined();
      expect(
        getRouteBlockReason(gateCase.dungeonId, 'unknown_from', 'unknown_to', gateCase.closedState)
      ).toBeUndefined();
    }
  });

  it('authors the exact unique real adjacent edges per dungeon with no reverse doors or teleport edges', () => {
    const expectedCounts: Readonly<Record<DungeonId, number>> = {
      demon_tower_1: 4,
      metro_abyss: 4,
      starfall_mine: 4,
      rust_hospital: 4,
      ash_arena: 4,
      dream_archive: 4,
      void_citadel: 4,
      temporal_observatory: 5,
      causal_clearinghouse: 5,
      entropy_ark: 5,
      mirror_cycle_city: 9,
      redaction_scriptorium: 10,
      legacy_auction_court: 12,
      genesis_vault: 15,
      silent_broadcast_tower: 4,
      lost_shelter: 15,
      false_testimony_court: 52,
      combat_replay_stage: 44,
      panopticon_city: 24
    };
    const gateIds = new Set<string>();
    const directedEdges = new Set<string>();
    const authoredEdges: { dungeonId: DungeonId; gate: DungeonRouteGateDefinition }[] = [];
    const sectorLabels = new Map<string, string>();

    for (const dungeonId of DUNGEON_ORDER) {
      const dungeon = DUNGEONS[dungeonId];
      const nodesById = new Map(dungeon.nodes.map((node) => [node.id, node]));
      const gates = getDungeonRouteGates(dungeonId);
      const sectorIds = new Set(gates.map((gate) => gate.sector?.id));

      expect(gates.length, dungeonId).toBe(expectedCounts[dungeonId]);
      expect(gates.length, dungeonId).toBeGreaterThanOrEqual(4);
      expect(gates.length, dungeonId).toBeLessThanOrEqual(
        dungeonId === 'false_testimony_court'
          ? 52
          : dungeonId === 'combat_replay_stage'
            ? 44
          : dungeonId === 'panopticon_city'
            ? 24
          : dungeonId === 'genesis_vault' || dungeonId === 'lost_shelter'
            ? 15
            : 12
      );
      expect(sectorIds.size, dungeonId).toBeGreaterThanOrEqual(2);

      for (const gate of gates) {
        const from = nodesById.get(gate.fromNodeId);
        const to = nodesById.get(gate.toNodeId);
        expect(from, `${dungeonId}:${gate.id}:from`).toBeDefined();
        expect(to, `${dungeonId}:${gate.id}:to`).toBeDefined();
        if (!from || !to) continue;

        const distance = Math.abs(from.position.x - to.position.x) + Math.abs(from.position.y - to.position.y);
        const edge = `${dungeonId}:${gate.fromNodeId}->${gate.toNodeId}`;
        expect(distance, `${dungeonId}:${gate.id}`).toBe(1);
        expect(gate.id.length).toBeGreaterThan(0);
        expect(gate.label.length).toBeGreaterThan(0);
        expect(gate.sector?.id.length, gate.id).toBeGreaterThan(0);
        expect(gate.sector?.label.length, gate.id).toBeGreaterThan(0);
        expect(gateIds.has(gate.id), gate.id).toBe(false);
        expect(directedEdges.has(edge), gate.id).toBe(false);

        if (
          (dungeonId === 'demon_tower_1' || dungeonId === 'starfall_mine') &&
          gate.id !== REPRESENTATIVE_GATE_EDGES[dungeonId].id
        ) {
          expect(from.position.x, `${gate.id}:vertical`).toBe(to.position.x);
        }
        if (dungeonId === 'metro_abyss' || dungeonId === 'rust_hospital') {
          expect(from.position.y, `${gate.id}:horizontal`).toBe(to.position.y);
        }

        const sectorKey = `${dungeonId}:${gate.sector?.id}`;
        const previousLabel = sectorLabels.get(sectorKey);
        if (previousLabel) expect(gate.sector?.label, sectorKey).toBe(previousLabel);
        else sectorLabels.set(sectorKey, gate.sector?.label ?? '');

        gateIds.add(gate.id);
        directedEdges.add(edge);
        authoredEdges.push({ dungeonId, gate });
      }
    }

    expect(authoredEdges).toHaveLength(
      DUNGEON_ORDER.reduce((total, dungeonId) => total + expectedCounts[dungeonId], 0)
    );
    for (const { dungeonId, gate } of authoredEdges) {
      expect(
        directedEdges.has(`${dungeonId}:${gate.toNodeId}->${gate.fromNodeId}`),
        `${dungeonId}:${gate.id}:reverse`
      ).toBe(
        (dungeonId === 'lost_shelter' && gate.toNodeId !== 'shelter_overseer') ||
        dungeonId === 'false_testimony_court' ||
        dungeonId === 'combat_replay_stage' ||
        dungeonId === 'panopticon_city'
      );
    }
  });

  it('keeps exits, imprint anchors, and recovery nodes reachable while honoring every boss lock', () => {
    for (const dungeonId of DUNGEON_ORDER) {
      const dungeon = DUNGEONS[dungeonId];
      const protocol = getRunProtocolDefinition(dungeonId, 'imprint');
      const exit = dungeon.nodes.find((node) => node.type === 'exit');
      if (!protocol || protocol.id !== 'imprint' || !exit) {
        throw new Error(`Missing route target for ${dungeonId}`);
      }

      const requiredNodeIds = new Set([
        getBossDefinition(dungeonId).nodeId,
        protocol.requiredNodeId,
        exit.id,
        ...REOPENING_NODE_IDS[dungeonId]
      ]);

      for (const lawState of getLawDecisionStates(dungeonId)) {
        const distances = getRouteDistances(dungeonId, lawState);
        for (const nodeId of requiredNodeIds) {
          if (dungeonId === 'false_testimony_court' && lawState.law.kind === 'false_testimony_court') {
            const evidenceTrap = {
              voice_evidence: 'voice_filter_trap',
              timeline_evidence: 'timeline_checksum_trap',
              residue_evidence: 'residue_sterility_trap'
            } as const;
            const trapNodeId = evidenceTrap[nodeId as keyof typeof evidenceTrap];
            const isTrap = DUNGEON_LAW_LANDMARKS.false_testimony_court.trapNodeIds.includes(
              nodeId as (typeof DUNGEON_LAW_LANDMARKS.false_testimony_court.trapNodeIds)[number]
            );
            const verdictComplete = lawState.law.accusedSuspect !== null &&
              lawState.law.pendingVerdictNodeId === null;
            const expectedReachable = trapNodeId
              ? lawState.clearedNodeIds.includes(trapNodeId)
              : isTrap
                ? true
                : nodeId === 'false_testimony_judge'
                  ? verdictComplete
                  : true;
            expect(
              distances.has(nodeId),
              `${dungeonId}:${nodeId}:${JSON.stringify(lawState.law)}`
            ).toBe(expectedReachable);
            continue;
          }
          if (dungeonId === 'combat_replay_stage' && lawState.law.kind === 'combat_replay_stage') {
            const expectedReachable = nodeId === 'final_cut_director'
              ? lawState.law.takes.every((take) => take !== null) && lawState.law.route !== null
              : nodeId === 'theater_exit'
                ? lawState.clearedNodeIds.includes('final_cut_director')
                : true;
            expect(
              distances.has(nodeId),
              `${dungeonId}:${nodeId}:${JSON.stringify(lawState.law)}`
            ).toBe(expectedReachable);
            continue;
          }
          if (dungeonId === 'panopticon_city' && lawState.law.kind === 'panopticon_city') {
            const ready = DUNGEON_LAW_LANDMARKS.panopticon_city.relayNodeIds.every(
              (relayNodeId) => lawState.law.kind === 'panopticon_city' && lawState.law.relays[relayNodeId]
            ) && lawState.law.route !== null && lawState.law.pendingRouteNodeId === null;
            const expectedReachable = nodeId === 'all_sight_warden'
              ? ready
              : nodeId === 'blind_dawn_exit'
                ? lawState.clearedNodeIds.includes('all_sight_warden')
                : true;
            expect(
              distances.has(nodeId),
              `${dungeonId}:${nodeId}:${JSON.stringify(lawState.law)}`
            ).toBe(expectedReachable);
            continue;
          }
          if (dungeonId === 'mirror_cycle_city' && nodeId === 'nameless_reflection') {
            const mirrorLaw = lawState.law;
            const choicesComplete = mirrorLaw.kind === 'mirror_cycle_city' &&
              DUNGEON_LAW_LANDMARKS.mirror_cycle_city.phaseChoiceNodeIds.every((phaseNodeId) =>
                Object.prototype.hasOwnProperty.call(mirrorLaw.resolvedPhaseChoices, phaseNodeId)
              );
            expect(
              distances.has(nodeId),
              `${dungeonId}:${nodeId}:${JSON.stringify(lawState.law)}`
            ).toBe(choicesComplete);
            continue;
          }
          if (dungeonId === 'redaction_scriptorium' && nodeId === 'last_redactor') {
            const redactionLaw = lawState.law;
            const choicesComplete = redactionLaw.kind === 'redaction_scriptorium' &&
              DUNGEON_LAW_LANDMARKS.redaction_scriptorium.clauseNodeIds.every((clauseNodeId) =>
                Object.prototype.hasOwnProperty.call(
                  redactionLaw.resolvedClauseChoices,
                  clauseNodeId
                )
              );
            expect(
              distances.has(nodeId),
              `${dungeonId}:${nodeId}:${JSON.stringify(lawState.law)}`
            ).toBe(choicesComplete);
            continue;
          }
          if (dungeonId === 'legacy_auction_court' && nodeId === 'estate_auctioneer') {
            const auctionLaw = lawState.law;
            const choicesComplete = auctionLaw.kind === 'legacy_auction_court' &&
              DUNGEON_LAW_LANDMARKS.legacy_auction_court.lotNodeIds.every((lotNodeId) =>
                Object.prototype.hasOwnProperty.call(
                  auctionLaw.resolvedLotChoices,
                  lotNodeId
                )
              );
            expect(
              distances.has(nodeId),
              `${dungeonId}:${nodeId}:${JSON.stringify(lawState.law)}`
            ).toBe(choicesComplete);
            continue;
          }
          if (dungeonId === 'genesis_vault' && nodeId === 'primal_curator') {
            const genesisLaw = lawState.law;
            const choicesComplete = genesisLaw.kind === 'genesis_vault' &&
              genesisLaw.spliceSequence.length === 3;
            expect(
              distances.has(nodeId),
              `${dungeonId}:${nodeId}:${JSON.stringify(lawState.law)}`
            ).toBe(choicesComplete);
            continue;
          }
          if (dungeonId === 'genesis_vault' && nodeId === 'mosaic_gene_vault') {
            const genesisLaw = lawState.law;
            const canReachThroughMosaicOrBoss = genesisLaw.kind === 'genesis_vault' &&
              genesisLaw.spliceSequence.length === 3;
            expect(
              distances.has(nodeId),
              `${dungeonId}:${nodeId}:${JSON.stringify(lawState.law)}`
            ).toBe(canReachThroughMosaicOrBoss);
            continue;
          }
          expect(
            distances.has(nodeId),
            `${dungeonId}:${nodeId}:${JSON.stringify(lawState.law)}:${JSON.stringify(lawState.combatOpenings)}`
          ).toBe(true);
        }
      }
    }
  });

  it('does not place a recovery node behind a gate controlled by the law it restores', () => {
    for (const dungeonId of DUNGEON_ORDER) {
      const recoveryNodeIds = REOPENING_NODE_IDS[dungeonId];
      expect(recoveryNodeIds.length, dungeonId).toBeGreaterThan(0);
      for (const nodeId of recoveryNodeIds) {
        if (
          dungeonId === 'false_testimony_court' &&
          DUNGEON_LAW_LANDMARKS.false_testimony_court.trapNodeIds.includes(
            nodeId as (typeof DUNGEON_LAW_LANDMARKS.false_testimony_court.trapNodeIds)[number]
          )
        ) {
          const base = createDungeonLawState(dungeonId);
          expect(
            getRouteDistances(dungeonId, base).has(nodeId),
            `${dungeonId}:${nodeId}:recovery`
          ).toBe(true);
          continue;
        }
        if (
          dungeonId === 'false_testimony_court' &&
          DUNGEON_LAW_LANDMARKS.false_testimony_court.evidenceNodeIds.includes(
            nodeId as (typeof DUNGEON_LAW_LANDMARKS.false_testimony_court.evidenceNodeIds)[number]
          )
        ) continue;
        if (dungeonId === 'panopticon_city') {
          expect(getRouteDistances(dungeonId, createDungeonLawState(dungeonId)).has(nodeId)).toBe(true);
          continue;
        }
        expect(
          getDungeonRouteGates(dungeonId).some((gate) => gate.toNodeId === nodeId),
          `${dungeonId}:${nodeId}`
        ).toBe(false);
      }
    }
  });

  it('makes a representative closed sector cost at least two real steps in every dungeon', () => {
    for (const gateCase of GATE_CASES) {
      const gate = getGate(gateCase.dungeonId, gateCase.gateId);
      const openDistance = getRouteDistances(
        gateCase.dungeonId,
        gateCase.openState,
        gate.fromNodeId
      ).get(gate.toNodeId);
      const closedDistance = getRouteDistances(
        gateCase.dungeonId,
        gateCase.closedState,
        gate.fromNodeId
      ).get(gate.toNodeId);
      const sectorId = gate.sector?.id;
      const openSector = getRouteSectorDisplay(gateCase.dungeonId, gateCase.openState).find(
        (display) => display.id === sectorId
      );
      const closedSector = getRouteSectorDisplay(gateCase.dungeonId, gateCase.closedState).find(
        (display) => display.id === sectorId
      );

      expect(openSector?.status, `${gateCase.dungeonId}:open-sector`).toBe('open');
      expect(closedSector?.status, `${gateCase.dungeonId}:closed-sector`).toBe('closed');
      expect(openDistance, `${gateCase.dungeonId}:open-distance`).toBe(1);
      if (
        gateCase.dungeonId === 'redaction_scriptorium' ||
        gateCase.dungeonId === 'legacy_auction_court' ||
        gateCase.dungeonId === 'genesis_vault' ||
        gateCase.dungeonId === 'lost_shelter' ||
        gateCase.dungeonId === 'false_testimony_court' ||
        gateCase.dungeonId === 'combat_replay_stage' ||
        gateCase.dungeonId === 'panopticon_city'
      ) {
        expect(closedDistance, `${gateCase.dungeonId}:closed-distance`).toBeUndefined();
        continue;
      }
      expect(closedDistance, `${gateCase.dungeonId}:closed-distance`).toBeDefined();
      expect(
        (closedDistance ?? Number.NEGATIVE_INFINITY) - (openDistance ?? Number.POSITIVE_INFINITY),
        gateCase.dungeonId
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it('defines exactly the 15 directed genesis gates and keeps every reverse edge legal', () => {
    const expectedEdges = [
      ['force_sample_gallery', 'force_gene_vault'],
      ['bloodline_survey_archive', 'force_gene_vault'],
      ['mutation_guardian_north', 'art_gene_vault'],
      ['upper_genesis_portal', 'art_gene_vault'],
      ['guard_relic_gallery', 'guard_gene_vault'],
      ['lower_serum_supply', 'guard_gene_vault'],
      ['soul_recharge_genesis', 'renewal_gene_vault'],
      ['lower_genesis_portal', 'renewal_gene_vault'],
      ['sample_corridor_guard', 'mosaic_gene_vault'],
      ['helix_collapse_trap', 'mosaic_gene_vault'],
      ['mutation_guardian_omega', 'mosaic_gene_vault'],
      ['mosaic_gene_vault', 'primal_curator'],
      ['gene_stalker_alpha', 'primal_curator'],
      ['boss_side_lock', 'primal_curator'],
      ['lineage_event_stage', 'primal_curator']
    ] as const;
    const gates = getDungeonRouteGates('genesis_vault');
    expect(gates).toHaveLength(15);
    expect(gates.map((gate) => [gate.fromNodeId, gate.toNodeId])).toEqual(expectedEdges);

    const closed = createDungeonLawState('genesis_vault');
    for (const gate of gates) {
      expect(getRouteGateStatus(
        'genesis_vault', gate.toNodeId, gate.fromNodeId, closed
      ), `${gate.id}:reverse-status`).toBeUndefined();
      expect(getLegalAdjacentTargetIds(
        'genesis_vault', gate.toNodeId, [gate.fromNodeId], closed
      ), `${gate.id}:reverse-legal`).toEqual([gate.fromNodeId]);
    }

    const specialist = gates.find((gate) => gate.toNodeId === 'force_gene_vault');
    const mosaic = gates.find((gate) => gate.toNodeId === 'mosaic_gene_vault');
    const boss = gates.find((gate) => gate.toNodeId === 'primal_curator');
    if (!specialist || !mosaic || !boss) throw new Error('Missing genesis message gate');
    expect(getRouteBlockReason(
      'genesis_vault', specialist.fromNodeId, specialist.toNodeId, closed
    )).toContain('专精至少2次');
    expect(getRouteBlockReason(
      'genesis_vault', mosaic.fromNodeId, mosaic.toNodeId, closed
    )).toContain('三种互异');
    expect(getRouteBlockReason(
      'genesis_vault', boss.fromNodeId, boss.toNodeId, closed
    )).toContain('完成三次拼接');
  });

  it('routes all 64 genesis sequences to the boss and only their earned gene vaults', () => {
    const genes: readonly GenesisGene[] = ['force', 'art', 'guard', 'renewal'];
    const sequences = genes.flatMap((first) =>
      genes.flatMap((second) => genes.map((third) => [first, second, third] as const))
    );
    const gates = getDungeonRouteGates('genesis_vault');
    const specialistTargets: Readonly<Record<GenesisGene, string>> = {
      force: 'force_gene_vault',
      art: 'art_gene_vault',
      guard: 'guard_gene_vault',
      renewal: 'renewal_gene_vault'
    };

    for (const sequence of sequences) {
      const state = withGenesisSequence(sequence);
      const uniqueCount = new Set(sequence).size;
      for (const gene of genes) {
        const earned = sequence.filter((candidate) => candidate === gene).length >= 2;
        const specialistGates = gates.filter((gate) => gate.toNodeId === specialistTargets[gene]);
        expect(specialistGates).toHaveLength(2);
        for (const gate of specialistGates) {
          expect(getRouteGateStatus(
            'genesis_vault', gate.fromNodeId, gate.toNodeId, state
          )?.isOpen, `${sequence.join('/')}:${gene}:${gate.id}`).toBe(earned);
        }
      }

      const mosaicGates = gates.filter((gate) => gate.toNodeId === 'mosaic_gene_vault');
      expect(mosaicGates).toHaveLength(3);
      for (const gate of mosaicGates) {
        expect(getRouteGateStatus(
          'genesis_vault', gate.fromNodeId, gate.toNodeId, state
        )?.isOpen, `${sequence.join('/')}:mosaic:${gate.id}`).toBe(uniqueCount === 3);
      }

      const bossGates = gates.filter((gate) => gate.toNodeId === 'primal_curator');
      expect(bossGates).toHaveLength(4);
      for (const gate of bossGates) {
        expect(getRouteGateStatus(
          'genesis_vault', gate.fromNodeId, gate.toNodeId, state
        )?.isOpen, `${sequence.join('/')}:boss:${gate.id}`).toBe(true);
      }
      expect(getRouteDistances('genesis_vault', state).has('primal_curator'), sequence.join('/'))
        .toBe(true);
    }

    const incomplete = withGenesisSequence(['force', 'force']);
    const bossGates = gates.filter((gate) => gate.toNodeId === 'primal_curator');
    expect(bossGates).toHaveLength(4);
    for (const gate of bossGates) {
      expect(getRouteGateStatus(
        'genesis_vault', gate.fromNodeId, gate.toNodeId, incomplete
      )?.isOpen, gate.id).toBe(false);
    }
    expect(getRouteDistances('genesis_vault', incomplete).has('primal_curator')).toBe(false);
  });

  it('authors the three broadcast specialization gates and Boss gate across all eight relay sequences', () => {
    const gates = getDungeonRouteGates('silent_broadcast_tower');
    expect(gates.map(({ fromNodeId, toNodeId, requirement }) => [
      fromNodeId,
      toNodeId,
      requirement
    ])).toEqual([
      [
        'north_echo_cache',
        'silent_archive',
        {
          kind: 'broadcast_mute_count_at_least_and_noise_at_most',
          minimumMuteCount: 2,
          maximumNoise: 1
        }
      ],
      [
        'broadcast_warden_north',
        'resonance_vault',
        {
          kind: 'broadcast_count_at_least_and_noise_at_least',
          minimumBroadcastCount: 2,
          minimumNoise: 4
        }
      ],
      [
        'soul_recharge_broadcast',
        'balanced_switchboard',
        {
          kind: 'broadcast_all_relays_resolved_and_noise_between',
          minimumNoise: 2,
          maximumNoise: 3
        }
      ],
      [
        'broadcast_memory_stage',
        'last_broadcaster',
        { kind: 'broadcast_all_relays_resolved' }
      ]
    ]);

    for (let mask = 0; mask < 8; mask += 1) {
      const choices = Array.from({ length: 3 }, (_, index): BroadcastRelayChoice =>
        ((mask >> index) & 1) === 0 ? 'mute' : 'broadcast'
      );
      const muteCount = choices.filter((choice) => choice === 'mute').length;
      const broadcastCount = 3 - muteCount;
      for (let noise = 0; noise <= 6; noise += 1) {
        const state = withBroadcastChoices(noise, choices);
        const decisions = gates.map((gate) => getRouteGateStatus(
          'silent_broadcast_tower', gate.fromNodeId, gate.toNodeId, state
        )?.isOpen);
        expect(decisions, `${choices.join('/')}:${noise}`).toEqual([
          muteCount >= 2 && noise <= 1,
          broadcastCount >= 2 && noise >= 4,
          noise >= 2 && noise <= 3,
          true
        ]);
      }
    }

    const incomplete = withBroadcastChoices(3, ['mute', 'broadcast']);
    expect(gates.map((gate) => getRouteGateStatus(
      'silent_broadcast_tower', gate.fromNodeId, gate.toNodeId, incomplete
    )?.blockReason)).toEqual([
      '至少静默 2 座中继，且噪声不高于 1。',
      '至少播送 2 座中继，且噪声不低于 4。',
      '三座中继全部调谐，且噪声保持在 2-3。',
      '三座中继全部调谐后，末频道王门开放。'
    ]);
  });

  it('locks only real adjacent moves while a broadcast relay choice is pending', () => {
    for (const relayNodeId of DUNGEON_LAW_LANDMARKS.silent_broadcast_tower.relayNodeIds) {
      const pending = signalFirstNodeClear(createDungeonLawState('silent_broadcast_tower'), {
        node: { id: relayNodeId, type: 'reward' }
      });
      const adjacentTargetIds = getAdjacentTargetIds('silent_broadcast_tower', relayNodeId);
      expect(adjacentTargetIds, relayNodeId).toHaveLength(4);
      expect(getLegalAdjacentTargetIds(
        'silent_broadcast_tower', relayNodeId, adjacentTargetIds, pending
      ), relayNodeId).toEqual([]);
      expect(getRouteBlockReason(
        'silent_broadcast_tower', relayNodeId, 'not_adjacent', pending
      ), relayNodeId).toBeUndefined();

      const resolved = resolveBroadcastRelayChoice(pending, 'mute');
      expect(resolved.resolved, relayNodeId).toBe(true);
      expect(getLegalAdjacentTargetIds(
        'silent_broadcast_tower', relayNodeId, adjacentTargetIds, resolved.state
      ), relayNodeId).toEqual(adjacentTargetIds);
    }
  });

  it('gates every specialization neighbor in both directions across all escort HP bands', () => {
    const gates = getDungeonRouteGates('lost_shelter');
    const specializationCases = [
      {
        targetNodeId: 'evacuation_cache',
        expectedNeighbors: ['north_supply_cache', 'north_entry'],
        openHp: 75
      },
      {
        targetNodeId: 'desperate_armory',
        expectedNeighbors: ['upper_return_portal', 'mimic_survivor_alpha', 'shelter_exit'],
        openHp: 40
      },
      {
        targetNodeId: 'balanced_medbay',
        expectedNeighbors: ['lower_return_portal', 'soul_recharge_shelter'],
        openHp: 41
      }
    ] as const;

    for (const testCase of specializationCases) {
      const actualNeighbors = getAdjacentTargetIds('lost_shelter', testCase.targetNodeId).sort();
      expect(actualNeighbors).toEqual([...testCase.expectedNeighbors].sort());
      const targetGates = gates.filter((gate) =>
        gate.fromNodeId === testCase.targetNodeId || gate.toNodeId === testCase.targetNodeId
      );
      expect(targetGates).toHaveLength(actualNeighbors.length * 2);
      for (const adjacentNodeId of actualNeighbors) {
        const forward = targetGates.find((gate) =>
          gate.fromNodeId === adjacentNodeId && gate.toNodeId === testCase.targetNodeId
        );
        const reverse = targetGates.find((gate) =>
          gate.fromNodeId === testCase.targetNodeId && gate.toNodeId === adjacentNodeId
        );
        expect(forward, `${adjacentNodeId}->${testCase.targetNodeId}`).toBeDefined();
        expect(reverse, `${testCase.targetNodeId}->${adjacentNodeId}`).toBeDefined();
        if (!forward || !reverse) continue;
        expect(getRouteGateStatus(
          'lost_shelter', forward.fromNodeId, forward.toNodeId, withEscortState(testCase.openHp)
        )?.isOpen).toBe(true);
        expect(getRouteGateStatus(
          'lost_shelter', reverse.fromNodeId, reverse.toNodeId, withEscortState(testCase.openHp)
        )?.isOpen).toBe(true);
        expect(getRouteGateStatus(
          'lost_shelter', forward.fromNodeId, forward.toNodeId, createDungeonLawState('lost_shelter')
        )?.isOpen).toBe(false);
      }
    }

    const matrix = [
      { hp: 100, reachable: [true, false, false] },
      { hp: 75, reachable: [true, false, false] },
      { hp: 74, reachable: [false, false, true] },
      { hp: 41, reachable: [false, false, true] },
      { hp: 40, reachable: [false, true, false] },
      { hp: 0, reachable: [false, true, false] }
    ] as const;
    for (const testCase of matrix) {
      const distances = getRouteDistances('lost_shelter', withEscortState(testCase.hp));
      expect(
        specializationCases.map(({ targetNodeId }) => distances.has(targetNodeId)),
        `HP ${testCase.hp}`
      ).toEqual(testCase.reachable);
    }
    const incompleteDistances = getRouteDistances('lost_shelter', createDungeonLawState('lost_shelter'));
    expect(specializationCases.map(({ targetNodeId }) => incompleteDistances.has(targetNodeId)))
      .toEqual([false, false, false]);
  });

  it('evaluates all eight escort choice sequences and requires all checkpoints at the memory Boss gate', () => {
    const gates = getDungeonRouteGates('lost_shelter');
    const bossGate = gates.find((gate) => gate.id === 'shelter_memory_boss_gate');
    if (!bossGate) throw new Error('Missing shelter memory Boss gate');
    expect(bossGate).toMatchObject({
      fromNodeId: 'survivor_memory_stage',
      toNodeId: 'shelter_overseer',
      requirement: { kind: 'escort_all_checkpoints_resolved' }
    });

    for (let mask = 0; mask < 8; mask += 1) {
      const choices = Array.from({ length: 3 }, (_, index): EscortCheckpointChoice =>
        ((mask >> index) & 1) === 0 ? 'treat' : 'push'
      );
      const hp = 35 + choices.filter((choice) => choice === 'treat').length * 25 -
        choices.filter((choice) => choice === 'push').length * 10;
      const state = withEscortState(Math.min(100, Math.max(0, hp)), choices);
      expect(getRouteGateStatus(
        'lost_shelter', bossGate.fromNodeId, bossGate.toNodeId, state
      )?.isOpen, choices.join('/')).toBe(true);
      const specializationOpen = ['evacuation_cache', 'desperate_armory', 'balanced_medbay'].map(
        (targetNodeId) => gates
          .filter((gate) => gate.toNodeId === targetNodeId)
          .every((gate) => getRouteGateStatus(
            'lost_shelter', gate.fromNodeId, gate.toNodeId, state
          )?.isOpen)
      );
      expect(specializationOpen.filter(Boolean), choices.join('/')).toHaveLength(1);
    }

    for (const completedCount of [0, 1, 2]) {
      const incomplete = withEscortState(75, ['treat', 'treat', 'treat'].slice(
        0,
        completedCount
      ) as EscortCheckpointChoice[]);
      const status = getRouteGateStatus(
        'lost_shelter', bossGate.fromNodeId, bossGate.toNodeId, incomplete
      );
      expect(status?.isOpen, `${completedCount}/3`).toBe(false);
      expect(status?.blockReason).toBe('完成三处护送检查点后开放。');
    }
  });

  it('locks every real orthogonal checkpoint move while its escort choice is pending', () => {
    const expectedNeighborCounts = {
      north_checkpoint: 3,
      central_checkpoint: 4,
      south_checkpoint: 4
    } as const;
    for (const checkpointNodeId of DUNGEON_LAW_LANDMARKS.lost_shelter.checkpointNodeIds) {
      const pending = signalFirstNodeClear(createDungeonLawState('lost_shelter'), {
        node: { id: checkpointNodeId, type: 'reward' }
      });
      const adjacentTargetIds = getAdjacentTargetIds('lost_shelter', checkpointNodeId);
      expect(adjacentTargetIds).toHaveLength(expectedNeighborCounts[checkpointNodeId]);
      expect(getLegalAdjacentTargetIds(
        'lost_shelter', checkpointNodeId, adjacentTargetIds, pending
      )).toEqual([]);
      expect(getRouteBlockReason(
        'lost_shelter', checkpointNodeId, 'not_adjacent', pending
      )).toBeUndefined();
      for (const adjacentTargetId of adjacentTargetIds) {
        expect(getRouteBlockReason(
          'lost_shelter', checkpointNodeId, adjacentTargetId, pending
        )).toBe('先选择救治或强推。');
      }

      const resolved = resolveEscortCheckpointChoice(
        pending,
        checkpointNodeId,
        'push',
        0
      );
      expect(resolved.resolved).toBe(true);
      expect(getLegalAdjacentTargetIds(
        'lost_shelter', checkpointNodeId, adjacentTargetIds, resolved.state
      )).toEqual(adjacentTargetIds);
    }
  });

  it('gates every false-testimony evidence entrance after its paired trap and authors every reverse edge', () => {
    const trapByEvidence = {
      voice_evidence: 'voice_filter_trap',
      timeline_evidence: 'timeline_checksum_trap',
      residue_evidence: 'residue_sterility_trap'
    } as const;
    for (const evidenceId of DUNGEON_LAW_LANDMARKS.false_testimony_court.evidenceNodeIds) {
      const adjacentNodeIds = getAdjacentTargetIds('false_testimony_court', evidenceId);
      const closed = createDungeonLawState('false_testimony_court');
      const trapCleared = withFalseTestimonyState({ clearedNodeIds: [trapByEvidence[evidenceId]] });
      const revealed = withFalseTestimonyState({
        revealedEvidenceIds: [evidenceId],
        clearedNodeIds: [trapByEvidence[evidenceId]]
      });
      for (const adjacentNodeId of adjacentNodeIds) {
        const openIngressState = adjacentNodeId === 'truth_archive'
          ? FALSE_TESTIMONY_TRUTH_STATE
          : adjacentNodeId === 'verdict_chamber'
            ? FALSE_TESTIMONY_SWIFT_STATE
            : trapCleared;
        expect(getRouteGateStatus(
          'false_testimony_court', adjacentNodeId, evidenceId, closed
        )?.isOpen, `${adjacentNodeId}->${evidenceId}:closed`).toBe(false);
        expect(getRouteGateStatus(
          'false_testimony_court', adjacentNodeId, evidenceId, openIngressState
        )?.isOpen, `${adjacentNodeId}->${evidenceId}:open`).toBe(true);
        expect(getRouteGateStatus(
          'false_testimony_court', evidenceId, adjacentNodeId, closed
        ), `${evidenceId}->${adjacentNodeId}:reverse`).toBeDefined();
        expect(getRouteGateStatus(
          'false_testimony_court', evidenceId, adjacentNodeId,
          adjacentNodeId === 'truth_archive' ? FALSE_TESTIMONY_TRUTH_STATE : revealed
        )?.isOpen, `${evidenceId}->${adjacentNodeId}:revealed`).toBe(true);
      }
    }
  });

  it('uses frozen original trusted count for truth and swift routes across the full connectivity matrix', () => {
    const originalThree = FALSE_TESTIMONY_TRUTH_STATE;
    const originalOneThenThree = FALSE_TESTIMONY_SWIFT_STATE;
    const appealedCorrect = withFalseTestimonyState({
      revealedEvidenceIds: ['voice_evidence', 'timeline_evidence', 'residue_evidence'],
      accusedSuspect: 'route_surveyor',
      accusationTrustedCount: 1,
      appealUsed: true,
      entryGear: { appealSeal: true },
      clearedNodeIds: [...FALSE_TESTIMONY_ALL_TRAPS, 'appeal_desk']
    });
    const wrong = withFalseTestimonyState({
      revealedEvidenceIds: ['voice_evidence'],
      accusedSuspect: 'records_keeper',
      accusationTrustedCount: 1,
      entryGear: { appealSeal: true },
      clearedNodeIds: FALSE_TESTIMONY_ALL_TRAPS
    });
    const matrix = [
      { state: originalThree, truth: true, swift: false, falseVault: false },
      { state: originalOneThenThree, truth: false, swift: true, falseVault: false },
      { state: appealedCorrect, truth: false, swift: false, falseVault: false },
      { state: wrong, truth: false, swift: false, falseVault: true }
    ];
    for (const row of matrix) {
      const distances = getRouteDistances('false_testimony_court', row.state);
      expect(distances.has('truth_archive')).toBe(row.truth);
      expect(distances.has('swift_judgment_armory')).toBe(row.swift);
      expect(distances.has('false_verdict_vault')).toBe(row.falseVault);
    }

    for (const targetNodeId of [
      'truth_archive', 'swift_judgment_armory', 'false_verdict_vault'
    ]) {
      const adjacentNodeIds = getAdjacentTargetIds('false_testimony_court', targetNodeId);
      const targetGates = getDungeonRouteGates('false_testimony_court').filter((gate) =>
        gate.fromNodeId === targetNodeId || gate.toNodeId === targetNodeId
      );
      expect(targetGates).toHaveLength(adjacentNodeIds.length * 2);
      for (const adjacentNodeId of adjacentNodeIds) {
        expect(targetGates.some((gate) =>
          gate.fromNodeId === adjacentNodeId && gate.toNodeId === targetNodeId
        )).toBe(true);
        expect(targetGates.some((gate) =>
          gate.fromNodeId === targetNodeId && gate.toNodeId === adjacentNodeId
        )).toBe(true);
      }
    }
  });

  it('gates verdict, appeal, and every Boss approach without turning pending into a global lock', () => {
    const bossNeighborIds = getAdjacentTargetIds('false_testimony_court', 'false_testimony_judge');
    expect(bossNeighborIds).toHaveLength(4);
    const base = createDungeonLawState('false_testimony_court');
    for (const neighborId of bossNeighborIds) {
      expect(getRouteGateStatus(
        'false_testimony_court', neighborId, 'false_testimony_judge', base
      )?.isOpen, `${neighborId}->boss`).toBe(false);
      expect(getRouteGateStatus(
        'false_testimony_court', 'false_testimony_judge', neighborId, base
      ), `boss->${neighborId}`).toBeDefined();
    }

    let pending = signalFirstNodeClear(base, {
      node: { id: 'voice_filter_trap', type: 'trap' }, damageTaken: 0
    });
    pending = signalFirstNodeClear(pending, {
      node: { id: 'voice_evidence', type: 'reward' }
    });
    const verdictNeighbors = getAdjacentTargetIds('false_testimony_court', 'verdict_chamber');
    const allEvidenceRevealed = withFalseTestimonyState({
      revealedEvidenceIds: ['voice_evidence', 'timeline_evidence', 'residue_evidence'],
      clearedNodeIds: FALSE_TESTIMONY_ALL_TRAPS
    });
    for (const neighborId of verdictNeighbors) {
      if (neighborId === 'false_testimony_judge') continue;
      expect(getRouteGateStatus(
        'false_testimony_court', neighborId, 'verdict_chamber', allEvidenceRevealed
      )?.isOpen).toBe(true);
    }
    pending = signalFirstNodeClear(pending, {
      node: { id: 'verdict_chamber', type: 'reward' }
    });
    expect(getLegalAdjacentTargetIds(
      'false_testimony_court', 'verdict_chamber', verdictNeighbors, pending
    )).toEqual([]);
    expect(getRouteBlockReason(
      'false_testimony_court', 'verdict_chamber', 'not_adjacent', pending
    )).toBeUndefined();
    const unrelatedTargets = getAdjacentTargetIds('false_testimony_court', 'lower_entry');
    expect(getLegalAdjacentTargetIds(
      'false_testimony_court', 'lower_entry', unrelatedTargets, pending
    ).length).toBeGreaterThan(0);

    const accused = resolveFalseTestimonyAccusation(pending, 'records_keeper');
    expect(accused.resolved).toBe(true);
    const bossGate = getRouteGateStatus(
      'false_testimony_court', 'verdict_chamber', 'false_testimony_judge', accused.state
    );
    expect(bossGate?.isOpen).toBe(true);

    let appealPending = withFalseTestimonyState({
      revealedEvidenceIds: ['voice_evidence'],
      accusedSuspect: 'records_keeper',
      accusationTrustedCount: 1,
      entryGear: { appealSeal: true },
      clearedNodeIds: ['voice_filter_trap', 'voice_evidence', 'verdict_chamber']
    });
    appealPending = signalFirstNodeClear(appealPending, {
      node: { id: 'appeal_desk', type: 'reward' }
    });
    const appealNeighbors = getAdjacentTargetIds('false_testimony_court', 'appeal_desk');
    expect(appealNeighbors).toHaveLength(4);
    expect(getLegalAdjacentTargetIds(
      'false_testimony_court', 'appeal_desk', appealNeighbors, appealPending
    )).toEqual([]);
    const corrected = resolveFalseTestimonyAccusation(appealPending, 'route_surveyor');
    expect(corrected.resolved).toBe(true);
    expect(getLegalAdjacentTargetIds(
      'false_testimony_court', 'appeal_desk', appealNeighbors, corrected.state
    )).toEqual(appealNeighbors);

    const vaulted = withFalseTestimonyState({
      revealedEvidenceIds: ['voice_evidence'],
      accusedSuspect: 'records_keeper',
      accusationTrustedCount: 1,
      entryGear: { appealSeal: true },
      clearedNodeIds: ['voice_filter_trap', 'false_verdict_vault']
    });
    for (const neighborId of appealNeighbors) {
      expect(getRouteGateStatus(
        'false_testimony_court', neighborId, 'appeal_desk', vaulted
      )?.isOpen).toBe(false);
    }
  });

  it('is deterministic and does not mutate law, candidates, catalog, or dungeon content', () => {
    const catalogSnapshot = structuredClone(DUNGEON_ROUTE_GATES);
    const dungeonSnapshot = structuredClone(DUNGEONS);

    for (const dungeonId of DUNGEON_ORDER) {
      for (const gate of getDungeonRouteGates(dungeonId)) {
        const closedState = getGateDecisionState(dungeonId, gate, false);
        const stateSnapshot = structuredClone(closedState);
        const candidates = getAdjacentTargetIds(dungeonId, gate.fromNodeId);
        const candidateSnapshot = [...candidates];
        const first = getRouteGateStatus(
          dungeonId,
          gate.fromNodeId,
          gate.toNodeId,
          closedState
        );
        const second = getRouteGateStatus(
          dungeonId,
          gate.fromNodeId,
          gate.toNodeId,
          closedState
        );
        const firstSectors = getRouteSectorDisplay(dungeonId, closedState);
        const secondSectors = getRouteSectorDisplay(dungeonId, closedState);

        expect(second).toEqual(first);
        expect(secondSectors).toEqual(firstSectors);
        expect(getDungeonRouteGates(dungeonId)).toBe(getDungeonRouteGates(dungeonId));
        getLegalAdjacentTargetIds(dungeonId, gate.fromNodeId, candidates, closedState);
        expect(closedState).toEqual(stateSnapshot);
        expect(candidates).toEqual(candidateSnapshot);
      }
    }

    expect(DUNGEON_ROUTE_GATES).toEqual(catalogSnapshot);
    expect(DUNGEONS).toEqual(dungeonSnapshot);
  });
});
