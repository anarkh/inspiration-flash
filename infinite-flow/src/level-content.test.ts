import { describe, expect, it } from 'vitest';

import { getBossDefinition } from './boss-system';
import { getDungeonEvents } from './dungeon-events';
import {
  createDungeonLawState,
  DUNGEON_LAW_LANDMARKS,
  resolveFalseTestimonyAccusation,
  signalFirstNodeClear
} from './dungeon-laws';
import { getDungeonRouteGates, getRouteBlockReason } from './dungeon-routes';
import { getEquipmentMemoryForDungeon } from './equipment-memory-hunts';
import { EQUIPMENT_HUNT_DEFINITIONS } from './equipment-hunts';
import {
  collectReward,
  createInitialState,
  enterDungeon,
  getCurrentCausalLedgerStatus,
  getCurrentAuctionLotStatus,
  getCurrentBroadcastRelayStatus,
  getCurrentEscortCheckpointStatus,
  getCurrentVerdictStatus,
  getCurrentGenesisSpliceStatus,
  getCurrentMirrorCityPhaseStatus,
  getCurrentRedactionClauseStatus,
  getDerivedStats,
  handleTrap,
  moveToNode,
  performCombatAction,
  resolveCausalLedger,
  resolveAuctionLot,
  resolveCurrentBroadcastRelay,
  resolveCurrentEscortCheckpoint,
  resolveCurrentVerdictChoice,
  resolveEquipmentLoot,
  resolveGenesisSplice,
  resolveExit,
  resolveMirrorCityPhase,
  resolveRedactionClause,
  selectCombatReplayRoute,
  selectNode,
  type DungeonId,
  type GameState
} from './game';
import { getImprintRunProtocolDefinitions, getRunProtocolDefinition } from './run-protocols';

type NodeType = 'monster' | 'trap' | 'portal' | 'reward' | 'exit';

type LevelNode = {
  id: string;
  type: NodeType;
  equipmentHuntClueId?: string;
  fieldSurveyId?: string;
  relicDraftId?: string;
  soulRechargeId?: string;
  title: string;
  description: string;
  position: {
    x: number;
    y: number;
  };
  monsterId?: string;
  trap?: {
    damage: number;
    dc: number;
    counterItem?: string;
  };
  portal?: {
    targetDungeonId: DungeonId;
    targetNodeId: string;
    stableItem?: string;
  };
  reward?: {
    rewardPoints?: number;
    lingyun?: number;
    items?: Record<string, number>;
  };
};

type LevelDungeon = {
  id: DungeonId;
  name: string;
  tier: number;
  recommendedPower: number;
  grid: {
    width: number;
    height: number;
    startNodeId: string;
  };
  nodes: LevelNode[];
};

type LevelMonster = {
  id: string;
  dungeonId: string;
  maxHp: number;
  attack: number;
  artPower: number;
  defense: number;
  speed: number;
  rewardPoints: number;
  drop: Record<string, number>;
  ability: string;
  counter: string;
};

type LevelContentModule = {
  DUNGEON_ORDER: DungeonId[];
  DUNGEONS: Record<DungeonId, LevelDungeon>;
  MONSTERS: Record<string, LevelMonster>;
};

const FIELD_SURVEY_PLACEMENTS = {
  demon_tower_1: { nodeId: 'demon_bone_cache', fieldSurveyId: 'survey_demon_bone_marrow' },
  metro_abyss: { nodeId: 'lost_locker_reward', fieldSurveyId: 'survey_metro_lost_property' },
  starfall_mine: { nodeId: 'resonant_pick_reward', fieldSurveyId: 'survey_mine_resonant_vein' },
  rust_hospital: { nodeId: 'supply_cabinet_reward', fieldSurveyId: 'survey_hospital_emergency_stock' },
  ash_arena: { nodeId: 'cracked_core_prize', fieldSurveyId: 'survey_arena_cracked_prize' },
  dream_archive: { nodeId: 'void_map_reward', fieldSurveyId: 'survey_archive_void_map' },
  void_citadel: { nodeId: 'cracked_core_reward', fieldSurveyId: 'survey_citadel_final_cache' },
  temporal_observatory: { nodeId: 'field_observation_deck', fieldSurveyId: 'survey_temporal_observatory_deck' },
  causal_clearinghouse: { nodeId: 'evidence_survey_dais', fieldSurveyId: 'survey_causal_evidence_dais' },
  entropy_ark: { nodeId: 'entropy_ballast_deck', fieldSurveyId: 'survey_entropy_ballast_deck' },
  mirror_cycle_city: { nodeId: 'mirror_city_survey', fieldSurveyId: 'survey_mirror_city_parallax' },
  redaction_scriptorium: { nodeId: 'memory_survey_archive', fieldSurveyId: 'survey_redaction_memory_archive' },
  legacy_auction_court: { nodeId: 'archive_survey_gallery', fieldSurveyId: 'survey_legacy_auction_archive' },
  genesis_vault: { nodeId: 'bloodline_survey_archive', fieldSurveyId: 'survey_genesis_bloodline_archive' },
  silent_broadcast_tower: { nodeId: 'field_survey_archive', fieldSurveyId: 'survey_silent_broadcast_archive' },
  lost_shelter: { nodeId: 'field_survey_archive', fieldSurveyId: 'survey_shelter_rescue_archive' },
  false_testimony_court: { nodeId: 'field_survey_archive', fieldSurveyId: 'survey_false_testimony_archive' },
  combat_replay_stage: { nodeId: 'field_survey_cutting_room', fieldSurveyId: 'survey_combat_replay_cutting_room' },
  panopticon_city: { nodeId: 'refraction_lab', fieldSurveyId: 'survey_panopticon_refraction_lab' }
} as const satisfies Readonly<Record<DungeonId, { readonly nodeId: string; readonly fieldSurveyId: string }>>;

const EQUIPMENT_HUNT_CLUE_HOSTS = {
  demon_tower_1: ['broken_sigil_reward', 'fallen_pack_reward'],
  metro_abyss: ['coin_turnstile', 'maintenance_ladder'],
  starfall_mine: ['north_star_vein', 'lower_rail_reward'],
  rust_hospital: ['isolation_chart_reward', 'morgue_reward'],
  ash_arena: ['side_bench_supplies', 'ration_cache'],
  dream_archive: ['method_fragment_reward', 'blank_shelf_reward'],
  void_citadel: ['gate_oath_cache', 'rift_dust_cache'],
  temporal_observatory: ['past_clue_cache', 'future_clue_cache'],
  causal_clearinghouse: ['cause_clue_cache', 'effect_clue_cache'],
  entropy_ark: ['port_clue_cache', 'starboard_clue_cache'],
  mirror_cycle_city: ['real_clue_vault', 'mirror_clue_vault'],
  redaction_scriptorium: ['north_clue_cache', 'south_clue_cache'],
  legacy_auction_court: ['north_scrip_cache', 'south_scrip_cache'],
  genesis_vault: ['north_serum_cache', 'south_serum_cache'],
  silent_broadcast_tower: ['north_signal_cache', 'south_signal_cache'],
  lost_shelter: ['north_supply_cache', 'south_supply_cache'],
  false_testimony_court: ['records_stacks', 'evidence_supply_cache'],
  combat_replay_stage: ['script_stacks', 'film_supply_cache'],
  panopticon_city: ['watchglass_cache', 'matte_supply']
} as const satisfies Readonly<Record<DungeonId, readonly [string, string]>>;

const RELIC_DRAFT_IDS = {
  demon_tower_1: ['demon_tower_1:echo:1', 'demon_tower_1:echo:2'],
  metro_abyss: ['metro_abyss:echo:1', 'metro_abyss:echo:2'],
  starfall_mine: ['starfall_mine:echo:1', 'starfall_mine:echo:2'],
  rust_hospital: ['rust_hospital:echo:1', 'rust_hospital:echo:2'],
  ash_arena: ['ash_arena:echo:1', 'ash_arena:echo:2'],
  dream_archive: ['dream_archive:echo:1', 'dream_archive:echo:2'],
  void_citadel: ['void_citadel:echo:1', 'void_citadel:echo:2'],
  temporal_observatory: ['temporal_observatory:past:1', 'temporal_observatory:future:2'],
  causal_clearinghouse: ['causal_clearinghouse:cause:1', 'causal_clearinghouse:effect:2'],
  entropy_ark: ['entropy_ark:port:1', 'entropy_ark:starboard:2'],
  mirror_cycle_city: ['mirror_cycle_city:real:1', 'mirror_cycle_city:mirror:2'],
  redaction_scriptorium: ['redaction_scriptorium:body:1', 'redaction_scriptorium:return:2'],
  legacy_auction_court: ['legacy_auction_court:force:1', 'legacy_auction_court:art:2'],
  genesis_vault: ['genesis_vault:force:1', 'genesis_vault:guard:2'],
  silent_broadcast_tower: ['silent_broadcast_tower:echo:1', 'silent_broadcast_tower:anechoic:2'],
  lost_shelter: ['lost_shelter:evacuation:1', 'lost_shelter:desperate:2'],
  false_testimony_court: ['false_testimony_court:truth:1', 'false_testimony_court:swift:2'],
  combat_replay_stage: ['combat_replay_stage:sequence:1', 'combat_replay_stage:afterbeat:2'],
  panopticon_city: ['panopticon_city:blindline:1', 'panopticon_city:inverse:2']
} as const satisfies Readonly<Record<DungeonId, readonly [string, string]>>;

const SOUL_RECHARGE_PLACEMENTS = {
  demon_tower_1: { nodeId: 'upper_fog_patrol', soulRechargeId: 'soul_node_demon_mist_watch' },
  metro_abyss: { nodeId: 'rail_wraith', soulRechargeId: 'soul_node_metro_third_rail' },
  starfall_mine: { nodeId: 'shell_guard_beta', soulRechargeId: 'soul_node_mine_load_bearing' },
  rust_hospital: { nodeId: 'pressure_door_trap', soulRechargeId: 'soul_node_hospital_negative_pressure' },
  ash_arena: { nodeId: 'smoke_gutter', soulRechargeId: 'soul_node_arena_smoke_verdict' },
  dream_archive: { nodeId: 'overwritten_record_trap', soulRechargeId: 'soul_node_archive_overwrite' },
  void_citadel: { nodeId: 'self_shadow_trap', soulRechargeId: 'soul_node_citadel_self_shadow' },
  temporal_observatory: { nodeId: 'soul_recharge_chamber', soulRechargeId: 'soul_node_temporal_recharge' },
  causal_clearinghouse: { nodeId: 'soul_recharge_chamber', soulRechargeId: 'soul_node_causal_recharge' },
  entropy_ark: { nodeId: 'soul_recharge_chamber', soulRechargeId: 'soul_node_entropy_recharge' },
  mirror_cycle_city: { nodeId: 'soul_recharge_mirror', soulRechargeId: 'soul_node_mirror_recharge' },
  redaction_scriptorium: { nodeId: 'soul_recharge_scriptorium', soulRechargeId: 'soul_node_redaction_rebind' },
  legacy_auction_court: { nodeId: 'soul_recharge_auction', soulRechargeId: 'soul_node_auction_reprice' },
  genesis_vault: { nodeId: 'soul_recharge_genesis', soulRechargeId: 'soul_node_genesis_recharge' },
  silent_broadcast_tower: { nodeId: 'soul_recharge_broadcast', soulRechargeId: 'soul_node_broadcast_recharge' },
  lost_shelter: { nodeId: 'soul_recharge_shelter', soulRechargeId: 'soul_node_shelter_recharge' },
  false_testimony_court: { nodeId: 'soul_recharge_verdict', soulRechargeId: 'soul_node_verdict_recharge' },
  combat_replay_stage: { nodeId: 'soul_recharge_stage', soulRechargeId: 'soul_node_combat_replay_recharge' },
  panopticon_city: { nodeId: 'soul_recharge_panopticon', soulRechargeId: 'soul_node_panopticon_recharge' }
} as const satisfies Readonly<Record<DungeonId, { readonly nodeId: string; readonly soulRechargeId: string }>>;

const SOUL_RECHARGE_ROUTES = {
  demon_tower_1: [
    'fog_lesser_demon',
    'broken_sigil_reward',
    'left_watch_trap',
    'upper_fog_patrol',
    'loose_tile_trap',
    'north_supply_niche',
    'butcher_turn',
    'bone_lane_monster',
    'tower_exit'
  ],
  metro_abyss: [
    'platform_arrival',
    'drainage_cache',
    'lampbox_supply',
    'rail_wraith',
    'mirror_web_cache',
    'mirror_thread_spider',
    'metro_exit'
  ],
  starfall_mine: [
    'mine_arrival',
    'inverted_shaft_trap',
    'lower_rail_reward',
    'shell_guard_beta',
    'rift_dust_reward',
    'spark_imp_switchback',
    'resonant_pick_reward',
    'molt_beast_den',
    'exit_anchor_reward',
    'mine_exit'
  ],
  rust_hospital: [
    'triage_reward',
    'contaminated_ward_reward',
    'supply_cabinet_reward',
    'rusted_iv_trap',
    'pressure_door_trap',
    'pulse_doctor_round',
    'sterilizer_trap',
    'pharmacy_reward',
    'doctor_patrol_route',
    'antidote_cabinet',
    'chief_pulse_doctor',
    'hospital_exit'
  ],
  ash_arena: [
    'arena_gate',
    'spectator_cache',
    'ash_purse',
    'cinder_lancer',
    'ringbreaker_duelist',
    'ember_sentinel',
    'smoke_gutter',
    'furnace_judge',
    'smoke_gutter',
    'cracked_core_prize',
    'white_step_tax',
    'arena_exit'
  ],
  dream_archive: [
    'index_reward',
    'rejected_strategy_reward',
    'broken_save_trap',
    'jailer_patrol',
    'overwritten_record_trap',
    'incense_reward',
    'dream_jailer_second',
    'void_map_reward',
    'afterimage_bookmark_reward',
    'archive_exit'
  ],
  void_citadel: [
    'citadel_gate',
    'identity_trial_reward',
    'first_echo_patrol',
    'broken_name_trap',
    'second_echo_patrol',
    'self_shadow_trap',
    'main_god_echo',
    'balance_reward',
    'method_page_reward',
    'cracked_core_reward',
    'last_resource_point',
    'citadel_exit'
  ],
  temporal_observatory: [
    'temporal_gate',
    'entry_chronometer',
    'past_shortcut_foyer',
    'epoch_sentinel_alpha',
    'past_calibration_anchor',
    'erased_patrol',
    'zero_meridian',
    'accelerated_patrol',
    'future_calibration_anchor',
    'accelerated_patrol',
    'soul_recharge_chamber',
    'boss_south_lock',
    'zero_hour_regent',
    'boss_south_lock',
    'future_echo_portal',
    'observatory_exit'
  ],
  causal_clearinghouse: [
    'clearinghouse_gate',
    'verdict_usher',
    'contradiction_line',
    'verdict_bridge',
    'soul_recharge_chamber',
    'south_verdict_lock',
    'zero_sum_auditor',
    'east_verdict_lock',
    'effect_echo_portal',
    'clearinghouse_exit'
  ],
  entropy_ark: [
    'ark_gate',
    'port_supply',
    'entropy_deckhand_port',
    'port_ballast_core',
    'entropy_ballast_deck',
    'port_pressure_lock',
    'last_helmsman',
    'stern_heading_console',
    'soul_recharge_chamber',
    'stern_heading_console',
    'starboard_return_portal',
    'entropy_ark_exit'
  ],
  mirror_cycle_city: [
    'cycle_gate',
    'real_supply_alcove',
    'mirror_chorus_real',
    'parallax_hunter_real',
    'first_phase_mirror',
    'real_anchor',
    'second_phase_mirror',
    'mirror_anchor',
    'soul_recharge_mirror',
    'third_phase_mirror',
    'nameless_reflection',
    'boss_side_trap',
    'lower_return_portal',
    'mirror_cycle_exit'
  ],
  redaction_scriptorium: [
    'folio_gate',
    'upper_supply_margin',
    'body_clause_desk',
    'severed_sentence_trap',
    'erasure_copyist_alpha',
    'final_proof_nexus',
    'memory_clause_desk',
    'palimpsest_censor_omega',
    'return_clause_desk',
    'palimpsest_censor_omega',
    'errata_event_stage',
    'boss_south_lock',
    'soul_recharge_scriptorium',
    'boss_south_lock',
    'last_redactor',
    'boss_side_lock',
    'lower_revision_portal',
    'scriptorium_exit'
  ],
  legacy_auction_court: [
    'estate_gate',
    'catalog_bailiff',
    'force_lot_dais',
    'archive_survey_gallery',
    'force_lot_dais',
    'hammerfall_trap',
    'inheritance_mimic_alpha',
    'guard_lot_dais',
    'upper_auction_portal',
    'auction_exit',
    'lower_auction_portal',
    'return_lot_dais',
    'dead_team_testimony_stage',
    'inheritance_mimic_omega',
    'art_lot_dais',
    'inheritance_mimic_omega',
    'dead_team_testimony_stage',
    'south_scrip_cache',
    'soul_recharge_auction',
    'return_claim_vault',
    'lower_auction_portal',
    'auction_exit',
    'boss_side_rostrum',
    'estate_auctioneer',
    'boss_side_rostrum',
    'auction_exit'
  ],
  genesis_vault: [
    'genesis_gate',
    'bloodline_survey_archive',
    'first_splice_console',
    'helix_collapse_trap',
    'gene_stalker_alpha',
    'second_splice_console',
    'boss_side_lock',
    'genome_repair_station',
    'lineage_event_stage',
    'mutation_guardian_omega',
    'third_splice_console',
    'mutation_guardian_omega',
    'lineage_event_stage',
    'south_serum_cache',
    'soul_recharge_genesis',
    'south_serum_cache',
    'lineage_event_stage',
    'genome_repair_station',
    'boss_side_lock',
    'primal_curator',
    'boss_side_lock',
    'genesis_exit'
  ],
  silent_broadcast_tower: [
    'broadcast_gate',
    'north_entry',
    'north_relay_console',
    'acoustic_tripwire',
    'dead_air_gallery',
    'central_relay_console',
    'dead_air_gallery',
    'acoustic_tripwire',
    'broadcast_memory_stage',
    'static_screen_trap',
    'broadcast_gate',
    'lower_entry',
    'south_relay_console',
    'broadcast_warden_omega',
    'emergency_shelter',
    'south_signal_cache',
    'soul_recharge_broadcast',
    'balanced_switchboard',
    'lower_return_portal',
    'broadcast_exit',
    'studio_side_lock',
    'last_broadcaster',
    'studio_side_lock',
    'broadcast_exit'
  ],
  lost_shelter: [
    'shelter_gate',
    'north_entry',
    'collapsed_hall_trap',
    'survivor_cell',
    'north_rescue_patrol',
    'north_checkpoint',
    'shelter_enforcer_north',
    'mimic_survivor_alpha',
    'central_checkpoint',
    'survivor_cell',
    'survivor_memory_stage',
    'alarm_grid_trap',
    'shelter_gate',
    'lower_entry',
    'south_checkpoint',
    'evacuation_horror_omega',
    'emergency_medbay',
    'containment_bay',
    'command_lock',
    'shelter_overseer',
    'command_lock',
    'containment_bay',
    'soul_recharge_shelter',
    'containment_bay',
    'command_lock',
    'shelter_exit'
  ],
  false_testimony_court: [
    'north_entry',
    'voice_filter_trap',
    'voice_evidence',
    'voice_filter_trap',
    'north_entry',
    'hostile_witness_north',
    'archive_censor_alpha',
    'judgment_lock',
    'cross_exam_stage',
    'soul_recharge_verdict',
    'evidence_supply_cache',
    'soul_recharge_verdict',
    'cross_exam_stage',
    'judgment_lock',
    'archive_censor_alpha',
    'timeline_checksum_trap',
    'timeline_evidence',
    'testimony_hall',
    'records_stacks',
    'verdict_gate',
    'lower_entry',
    'verdict_gate',
    'residue_sterility_trap',
    'residue_evidence',
    'perjury_hound_omega',
    'residue_evidence',
    'residue_sterility_trap',
    'verdict_chamber',
    'false_testimony_judge',
    'judgment_lock',
    'verdict_exit'
  ],
  combat_replay_stage: [
    'stage_gate',
    'script_stacks',
    'take_alpha',
    'continuity_break_trap',
    'take_beta',
    'take_gamma',
    'final_cut_director',
    'final_cut_lock',
    'script_projection_stage',
    'soul_recharge_stage',
    'script_projection_stage'
  ],
  panopticon_city: [
    'panopticon_gate',
    'watchglass_cache',
    'exposure_double_patrol',
    'south_blind_relay',
    'refraction_lab',
    'soul_recharge_panopticon',
    'refraction_lab'
  ]
} as const satisfies Readonly<Record<DungeonId, readonly string[]>>;

const LAW_LANDMARK_NODE_IDS: Readonly<Partial<Record<DungeonId, readonly string[]>>> = {
  demon_tower_1: DUNGEON_LAW_LANDMARKS.demon_tower_1.reliefNodeIds,
  metro_abyss: DUNGEON_LAW_LANDMARKS.metro_abyss.calibrationNodeIds,
  starfall_mine: DUNGEON_LAW_LANDMARKS.starfall_mine.gravitySwitchNodeIds,
  rust_hospital: DUNGEON_LAW_LANDMARKS.rust_hospital.pharmacyNodeIds,
  dream_archive: DUNGEON_LAW_LANDMARKS.dream_archive.indexNodeIds,
  temporal_observatory: [
    ...DUNGEON_LAW_LANDMARKS.temporal_observatory.pastAnchorNodeIds,
    ...DUNGEON_LAW_LANDMARKS.temporal_observatory.futureAnchorNodeIds
  ],
  entropy_ark: DUNGEON_LAW_LANDMARKS.entropy_ark.headingConsoleNodeIds,
  mirror_cycle_city: [
    ...DUNGEON_LAW_LANDMARKS.mirror_cycle_city.phaseChoiceNodeIds,
    ...DUNGEON_LAW_LANDMARKS.mirror_cycle_city.realAnchorNodeIds,
    ...DUNGEON_LAW_LANDMARKS.mirror_cycle_city.mirrorAnchorNodeIds
  ],
  redaction_scriptorium: DUNGEON_LAW_LANDMARKS.redaction_scriptorium.clauseNodeIds,
  silent_broadcast_tower: DUNGEON_LAW_LANDMARKS.silent_broadcast_tower.relayNodeIds,
  lost_shelter: DUNGEON_LAW_LANDMARKS.lost_shelter.checkpointNodeIds,
  false_testimony_court: [
    ...DUNGEON_LAW_LANDMARKS.false_testimony_court.evidenceNodeIds,
    ...DUNGEON_LAW_LANDMARKS.false_testimony_court.trapNodeIds,
    ...DUNGEON_LAW_LANDMARKS.false_testimony_court.verdictNodeIds
  ],
  combat_replay_stage: [
    ...DUNGEON_LAW_LANDMARKS.combat_replay_stage.takeNodeIds,
    ...DUNGEON_LAW_LANDMARKS.combat_replay_stage.routeNodeIds
  ],
  panopticon_city: [
    ...DUNGEON_LAW_LANDMARKS.panopticon_city.relayNodeIds,
    ...DUNGEON_LAW_LANDMARKS.panopticon_city.routeNodeIds
  ]
};

async function loadLevelContent(): Promise<LevelContentModule | null> {
  const modulePath = './level-content';
  const content = await import(modulePath).catch(() => null);

  return content as LevelContentModule | null;
}

function hasRewardValue(node: LevelNode): boolean {
  return Boolean(
    node.reward &&
      ((node.reward.rewardPoints ?? 0) > 0 ||
        (node.reward.lingyun ?? 0) > 0 ||
        Object.keys(node.reward.items ?? {}).length > 0)
  );
}

function encounterScore(monster: LevelMonster): number {
  return monster.maxHp + monster.attack * 4 + monster.artPower * 3 + monster.defense * 2 + monster.rewardPoints * 0.25;
}

function isManhattanAdjacent(source: LevelNode, target: LevelNode): boolean {
  return Math.abs(source.position.x - target.position.x) + Math.abs(source.position.y - target.position.y) === 1;
}

function getReachableNodeIds(dungeon: LevelDungeon): Set<string> {
  const nodeById = new Map(dungeon.nodes.map((node) => [node.id, node]));
  const reachable = new Set<string>();
  const queue = [dungeon.grid.startNodeId];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const node = nodeById.get(nodeId);
    if (!node || reachable.has(nodeId)) continue;

    reachable.add(nodeId);
    for (const candidate of dungeon.nodes) {
      if (!reachable.has(candidate.id) && isManhattanAdjacent(node, candidate)) {
        queue.push(candidate.id);
      }
    }
  }

  return reachable;
}

function getLevelNode(dungeon: LevelDungeon, nodeId: string): LevelNode {
  const node = dungeon.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) throw new Error(`Missing node ${dungeon.id}:${nodeId}`);
  return node;
}

function scopedNodeId(dungeonId: DungeonId, nodeId: string): string {
  return `${dungeonId}:${nodeId}`;
}

function createRouteTestState(dungeonId: DungeonId, completedDungeonIds: readonly DungeonId[]): GameState {
  const initial = createInitialState();
  // Keep the run, law, movement, and clears game-created; extra stats only make combat survival deterministic.
  const prepared: GameState = {
    ...initial,
    completedDungeonIds: [...completedDungeonIds],
    player: {
      ...initial.player,
      base: { body: 10_000, spirit: 10_000, agility: 10_000, luck: 10_000 }
    }
  };
  const maxHp = getDerivedStats(prepared).maxHp;

  return enterDungeon(
    {
      ...prepared,
      player: { ...prepared.player, hp: maxHp, maxHp }
    },
    dungeonId
  );
}

function resolveRouteNode(state: GameState, node: LevelNode): GameState {
  if (state.run?.clearedNodeIds.includes(node.id)) return state;

  let resolved = selectNode(state, node.id);
  if (node.type === 'monster') {
    for (let turn = 0; turn < 24 && !resolved.run?.clearedNodeIds.includes(node.id); turn += 1) {
      resolved = performCombatAction(resolved, 'attack');
    }
    if (resolved.run?.pendingEquipmentOffer) resolved = resolveEquipmentLoot(resolved);
  } else if (node.type === 'trap') {
    resolved = handleTrap(resolved, 'risk');
  } else if (node.type === 'reward') {
    resolved = collectReward(resolved);
  }

  if (node.type !== 'portal' && node.type !== 'exit' && !resolved.run?.clearedNodeIds.includes(node.id)) {
    throw new Error(`Failed to clear route node ${resolved.run?.dungeonId ?? 'unknown'}:${node.id}`);
  }
  return resolved;
}

describe('level content tables', () => {
  it('exports seventeen complete dungeons with playable node structure', async () => {
    const content = await loadLevelContent();

    expect(content).not.toBeNull();
    if (!content) return;

    const requiredNodeTypes: NodeType[] = ['monster', 'trap', 'portal', 'reward', 'exit'];

    expect(content.DUNGEON_ORDER).toHaveLength(19);
    expect(Object.keys(content.DUNGEONS).sort()).toEqual([...content.DUNGEON_ORDER].sort());

    for (const [index, dungeonId] of content.DUNGEON_ORDER.entries()) {
      const dungeon = content.DUNGEONS[dungeonId];
      const nodeIds = new Set(dungeon.nodes.map((node) => node.id));
      const nodeTypes = new Set(dungeon.nodes.map((node) => node.type));

      expect(dungeon.id).toBe(dungeonId);
      expect(dungeon.tier).toBe(index + 1);
      expect(dungeon.nodes.length).toBeGreaterThanOrEqual(30);
      expect(nodeIds.size).toBe(dungeon.nodes.length);

      for (const nodeType of requiredNodeTypes) {
        expect(nodeTypes.has(nodeType)).toBe(true);
      }
      expect(dungeon.nodes.filter((node) => node.type === 'monster').length).toBeGreaterThanOrEqual(
        dungeonId === 'genesis_vault' || dungeonId === 'silent_broadcast_tower' ? 5 : 6
      );
      expect(dungeon.nodes.filter((node) => node.type === 'trap').length).toBeGreaterThanOrEqual(
        dungeonId === 'lost_shelter' || dungeonId === 'false_testimony_court' || dungeonId === 'combat_replay_stage' || dungeonId === 'panopticon_city' ? 2 : 4
      );
      expect(dungeon.nodes.filter((node) => node.type === 'reward').length).toBeGreaterThanOrEqual(8);
      expect(dungeon.nodes.filter((node) => node.type === 'portal').length).toBeGreaterThanOrEqual(2);
      expect(dungeon.nodes.filter((node) => node.type === 'exit').length).toBeGreaterThanOrEqual(1);

      for (const node of dungeon.nodes) {
        expect(node.description.length).toBeGreaterThan(12);

        if (node.type === 'monster') {
          expect(node.monsterId).toBeTypeOf('string');
          const monster = content.MONSTERS[node.monsterId ?? ''];

          expect(monster).toBeDefined();
          expect(monster.dungeonId).toBe(dungeonId);
          expect(monster.ability.length).toBeGreaterThan(6);
          expect(monster.counter.length).toBeGreaterThan(6);
          expect(Object.keys(monster.drop).length).toBeGreaterThanOrEqual(1);
        }

        if (node.type === 'trap') {
          expect(node.trap?.damage).toBeGreaterThan(0);
          expect(node.trap?.dc).toBeGreaterThanOrEqual(6 + dungeon.tier);
          expect(node.trap?.counterItem).toBeTypeOf('string');
        }

        if (node.type === 'portal') {
          const targetDungeonId = node.portal?.targetDungeonId;
          const expectedTargetIndex = index === content.DUNGEON_ORDER.length - 1 ? 0 : index + 1;

          expect(targetDungeonId).toBeTypeOf('string');
          if (!targetDungeonId) throw new Error(`Missing portal target for ${dungeonId}:${node.id}`);
          const targetDungeon = content.DUNGEONS[targetDungeonId];
          expect(node.portal?.stableItem).toBeTypeOf('string');
          expect(content.DUNGEON_ORDER.indexOf(targetDungeonId)).toBe(expectedTargetIndex);
          expect(targetDungeon.nodes.some((targetNode) => targetNode.id === node.portal?.targetNodeId)).toBe(true);
        }

        if (node.type === 'reward' || node.type === 'exit') {
          expect(hasRewardValue(node)).toBe(true);
        }
      }
    }
  });

  it('matches every temporal observatory map and special-node contract', async () => {
    const content = await loadLevelContent();

    expect(content).not.toBeNull();
    if (!content) return;

    const dungeon = content.DUNGEONS.temporal_observatory;
    const expectedRows = [
      [
        'past_clue_cache',
        'epoch_sentinel_alpha',
        'past_calibration_anchor',
        'past_relic_archive',
        'aged_gear_trap',
        'past_echo_portal'
      ],
      [
        'entry_chronometer',
        'past_shortcut_foyer',
        'erased_patrol',
        'field_observation_deck',
        'boss_north_lock',
        'past_portal_cache'
      ],
      [
        'temporal_gate',
        'clockwork_scout',
        'zero_meridian',
        'calibration_bridge',
        'zero_hour_regent',
        'east_time_lock'
      ],
      [
        'future_supply',
        'future_shortcut_foyer',
        'accelerated_patrol',
        'soul_recharge_chamber',
        'boss_south_lock',
        'future_echo_portal'
      ],
      [
        'future_clue_cache',
        'epoch_sentinel_omega',
        'future_calibration_anchor',
        'future_relic_archive',
        'unborn_gear_trap',
        'observatory_exit'
      ]
    ] as const;

    expect(dungeon).toMatchObject({
      id: 'temporal_observatory',
      tier: 8,
      recommendedPower: 435,
      grid: { width: 6, height: 5, startNodeId: 'temporal_gate' }
    });
    expect(dungeon.nodes).toHaveLength(30);
    for (const [y, row] of expectedRows.entries()) {
      for (const [x, nodeId] of row.entries()) {
        expect(getLevelNode(dungeon, nodeId).position, nodeId).toEqual({ x, y });
      }
    }

    const monsterBindings = {
      epoch_sentinel_alpha: 'epoch_sentinel',
      erased_patrol: 'clockwork_scout',
      clockwork_scout: 'clockwork_scout',
      zero_hour_regent: 'zero_hour_regent',
      accelerated_patrol: 'clockwork_scout',
      epoch_sentinel_omega: 'epoch_sentinel'
    } as const;
    for (const [nodeId, monsterId] of Object.entries(monsterBindings)) {
      expect(getLevelNode(dungeon, nodeId)).toMatchObject({ type: 'monster', monsterId });
    }
    expect(getBossDefinition('temporal_observatory')).toMatchObject({
      nodeId: 'zero_hour_regent',
      monsterId: 'zero_hour_regent'
    });

    expect(getLevelNode(dungeon, 'past_clue_cache').equipmentHuntClueId).toBe(
      'equipment_hunt_temporal_observatory'
    );
    expect(getLevelNode(dungeon, 'future_clue_cache').equipmentHuntClueId).toBe(
      'equipment_hunt_temporal_observatory'
    );
    expect(getLevelNode(dungeon, 'field_observation_deck').fieldSurveyId).toBe(
      'survey_temporal_observatory_deck'
    );
    expect(getLevelNode(dungeon, 'past_relic_archive').relicDraftId).toBe(
      'temporal_observatory:past:1'
    );
    expect(getLevelNode(dungeon, 'future_relic_archive').relicDraftId).toBe(
      'temporal_observatory:future:2'
    );
    expect(getLevelNode(dungeon, 'soul_recharge_chamber')).toMatchObject({
      type: 'trap',
      soulRechargeId: 'soul_node_temporal_recharge'
    });
    expect(DUNGEON_LAW_LANDMARKS.temporal_observatory).toEqual({
      pastAnchorNodeIds: ['past_calibration_anchor'],
      futureAnchorNodeIds: ['future_calibration_anchor']
    });

    expect(getLevelNode(dungeon, 'past_echo_portal').portal).toEqual({
      targetDungeonId: 'causal_clearinghouse',
      targetNodeId: 'cause_clue_cache',
      stableItem: 'gate_sigil'
    });
    expect(getLevelNode(dungeon, 'future_echo_portal').portal).toEqual({
      targetDungeonId: 'causal_clearinghouse',
      targetNodeId: 'effect_clue_cache',
      stableItem: 'gate_sigil'
    });
    expect(getLevelNode(content.DUNGEONS.void_citadel, 'echo_portal').portal).toMatchObject({
      targetDungeonId: 'temporal_observatory',
      targetNodeId: 'past_clue_cache'
    });
    expect(getLevelNode(content.DUNGEONS.void_citadel, 'return_echo_portal').portal).toMatchObject({
      targetDungeonId: 'temporal_observatory',
      targetNodeId: 'future_clue_cache'
    });

    const chronalRewardNodes = dungeon.nodes.filter(
      (node) => (node.type === 'reward' || node.type === 'exit') && (node.reward?.items?.chronal_glass ?? 0) > 0
    );
    expect(chronalRewardNodes.filter((node) => node.type === 'reward').length).toBeGreaterThanOrEqual(4);
    expect(getLevelNode(dungeon, 'observatory_exit').reward?.items?.chronal_glass).toBe(3);
  });

  it('matches every causal clearinghouse map, special-node, portal, boss, and material contract', async () => {
    const content = await loadLevelContent();

    expect(content).not.toBeNull();
    if (!content) return;

    const dungeon = content.DUNGEONS.causal_clearinghouse;
    const expectedRows = [
      [
        ['cause_clue_cache', 'reward'],
        ['paradox_bailiff_alpha', 'monster'],
        ['cause_deposition', 'reward'],
        ['cause_relic_archive', 'reward'],
        ['retroactive_sentence_trap', 'trap'],
        ['cause_echo_portal', 'portal']
      ],
      [
        ['entry_docket', 'reward'],
        ['cause_foyer', 'reward'],
        ['cause_bailiff', 'monster'],
        ['evidence_survey_dais', 'reward'],
        ['north_verdict_lock', 'trap'],
        ['portal_warrant_cache', 'reward']
      ],
      [
        ['clearinghouse_gate', 'reward'],
        ['verdict_usher', 'monster'],
        ['contradiction_line', 'trap'],
        ['verdict_bridge', 'reward'],
        ['zero_sum_auditor', 'monster'],
        ['east_verdict_lock', 'trap']
      ],
      [
        ['effect_supply', 'reward'],
        ['effect_foyer', 'reward'],
        ['effect_bailiff', 'monster'],
        ['soul_recharge_chamber', 'trap'],
        ['south_verdict_lock', 'trap'],
        ['effect_echo_portal', 'portal']
      ],
      [
        ['effect_clue_cache', 'reward'],
        ['paradox_bailiff_omega', 'monster'],
        ['effect_deposition', 'reward'],
        ['effect_relic_archive', 'reward'],
        ['prospective_sentence_trap', 'trap'],
        ['clearinghouse_exit', 'exit']
      ]
    ] as const;

    expect(dungeon).toMatchObject({
      id: 'causal_clearinghouse',
      name: '因果清算所',
      tier: 9,
      recommendedPower: 500,
      grid: { width: 6, height: 5, startNodeId: 'clearinghouse_gate' }
    });
    expect(dungeon.nodes).toHaveLength(30);
    for (const [y, row] of expectedRows.entries()) {
      for (const [x, [nodeId, nodeType]] of row.entries()) {
        expect(getLevelNode(dungeon, nodeId), nodeId).toMatchObject({
          type: nodeType,
          position: { x, y }
        });
      }
    }

    const monsterBindings = {
      paradox_bailiff_alpha: 'paradox_bailiff',
      cause_bailiff: 'verdict_usher',
      verdict_usher: 'verdict_usher',
      zero_sum_auditor: 'zero_sum_auditor',
      effect_bailiff: 'verdict_usher',
      paradox_bailiff_omega: 'paradox_bailiff'
    } as const;
    for (const [nodeId, monsterId] of Object.entries(monsterBindings)) {
      expect(getLevelNode(dungeon, nodeId)).toMatchObject({ type: 'monster', monsterId });
    }

    expect(getLevelNode(dungeon, 'cause_clue_cache').equipmentHuntClueId).toBe(
      'equipment_hunt_causal_clearinghouse'
    );
    expect(getLevelNode(dungeon, 'effect_clue_cache').equipmentHuntClueId).toBe(
      'equipment_hunt_causal_clearinghouse'
    );
    expect(getLevelNode(dungeon, 'evidence_survey_dais').fieldSurveyId).toBe('survey_causal_evidence_dais');
    expect(getLevelNode(dungeon, 'cause_relic_archive').relicDraftId).toBe(
      'causal_clearinghouse:cause:1'
    );
    expect(getLevelNode(dungeon, 'effect_relic_archive').relicDraftId).toBe(
      'causal_clearinghouse:effect:2'
    );
    expect(getLevelNode(dungeon, 'soul_recharge_chamber')).toMatchObject({
      type: 'trap',
      soulRechargeId: 'soul_node_causal_recharge'
    });

    expect(getLevelNode(dungeon, 'cause_echo_portal').portal).toEqual({
      targetDungeonId: 'entropy_ark',
      targetNodeId: 'port_clue_cache',
      stableItem: 'gate_sigil'
    });
    expect(getLevelNode(dungeon, 'effect_echo_portal').portal).toEqual({
      targetDungeonId: 'entropy_ark',
      targetNodeId: 'starboard_clue_cache',
      stableItem: 'gate_sigil'
    });
    expect(getLevelNode(content.DUNGEONS.temporal_observatory, 'past_echo_portal').portal).toMatchObject({
      targetDungeonId: 'causal_clearinghouse',
      targetNodeId: 'cause_clue_cache'
    });
    expect(getLevelNode(content.DUNGEONS.temporal_observatory, 'future_echo_portal').portal).toMatchObject({
      targetDungeonId: 'causal_clearinghouse',
      targetNodeId: 'effect_clue_cache'
    });

    expect(getBossDefinition('causal_clearinghouse')).toMatchObject({
      tier: 9,
      nodeId: 'zero_sum_auditor',
      monsterId: 'zero_sum_auditor',
      maxHpMultiplier: 1.72,
      bonusReward: { items: { causal_seal: 2 } }
    });
    expect(content.MONSTERS.verdict_usher).toMatchObject({
      maxHp: 162,
      attack: 26,
      artPower: 22,
      defense: 12,
      speed: 20,
      rewardPoints: 660,
      drop: { causal_seal: 1 }
    });
    expect(content.MONSTERS.paradox_bailiff).toMatchObject({
      maxHp: 196,
      attack: 29,
      artPower: 29,
      defense: 16,
      speed: 18,
      rewardPoints: 820,
      drop: { causal_seal: 2 }
    });
    expect(content.MONSTERS.zero_sum_auditor).toMatchObject({
      maxHp: 242,
      attack: 32,
      artPower: 38,
      defense: 17,
      speed: 19,
      rewardPoints: 1030,
      drop: { causal_seal: 3, method_page: 1 }
    });

    const tierComparisons = [
      ['verdict_usher', 'clockwork_scout'],
      ['paradox_bailiff', 'epoch_sentinel'],
      ['zero_sum_auditor', 'zero_hour_regent']
    ] as const;
    const risingStats = ['maxHp', 'attack', 'artPower', 'defense', 'speed', 'rewardPoints'] as const;
    for (const [currentId, previousId] of tierComparisons) {
      for (const stat of risingStats) {
        expect(content.MONSTERS[currentId][stat], `${currentId}:${stat}`).toBeGreaterThan(
          content.MONSTERS[previousId][stat]
        );
      }
    }

    expect(getLevelNode(dungeon, 'cause_clue_cache').reward?.items?.causal_seal).toBe(1);
    expect(getLevelNode(dungeon, 'effect_clue_cache').reward?.items?.causal_seal).toBe(1);
    expect(getLevelNode(dungeon, 'clearinghouse_exit').reward?.items?.causal_seal).toBe(3);
  });

  it('matches every entropy ark map, special-node, portal, monster, boss, and material contract', async () => {
    const content = await loadLevelContent();

    expect(content).not.toBeNull();
    if (!content) return;

    const dungeon = content.DUNGEONS.entropy_ark;
    const expectedRows = [
      [
        ['port_clue_cache', 'reward'],
        ['dissipation_navigator_alpha', 'monster'],
        ['bow_heading_console', 'reward'],
        ['port_relic_hold', 'reward'],
        ['wake_shear_trap', 'trap'],
        ['port_return_portal', 'portal']
      ],
      [
        ['port_supply', 'reward'],
        ['entropy_deckhand_port', 'monster'],
        ['port_ballast_core', 'reward'],
        ['entropy_ballast_deck', 'reward'],
        ['port_pressure_lock', 'trap'],
        ['gate_sigil_locker', 'reward']
      ],
      [
        ['ark_gate', 'reward'],
        ['entropy_deckhand', 'monster'],
        ['wake_inversion', 'reward'],
        ['ark_manifest', 'reward'],
        ['last_helmsman', 'monster'],
        ['starboard_pressure_lock', 'trap']
      ],
      [
        ['starboard_supply', 'reward'],
        ['entropy_deckhand_starboard', 'monster'],
        ['starboard_ballast_core', 'reward'],
        ['soul_recharge_chamber', 'trap'],
        ['stern_heading_console', 'reward'],
        ['starboard_return_portal', 'portal']
      ],
      [
        ['starboard_clue_cache', 'reward'],
        ['dissipation_navigator_omega', 'monster'],
        ['midship_heading_console', 'reward'],
        ['starboard_relic_hold', 'reward'],
        ['heat_death_trap', 'trap'],
        ['entropy_ark_exit', 'exit']
      ]
    ] as const;

    expect(content.DUNGEON_ORDER).toEqual([
      'demon_tower_1',
      'metro_abyss',
      'starfall_mine',
      'rust_hospital',
      'ash_arena',
      'dream_archive',
      'void_citadel',
      'temporal_observatory',
      'causal_clearinghouse',
      'entropy_ark',
      'mirror_cycle_city',
      'redaction_scriptorium',
      'legacy_auction_court',
      'genesis_vault',
      'silent_broadcast_tower',
      'lost_shelter',
      'false_testimony_court',
      'combat_replay_stage',
      'panopticon_city'
    ]);
    expect(dungeon).toMatchObject({
      id: 'entropy_ark',
      name: '熵海方舟',
      tier: 10,
      recommendedPower: 565,
      grid: { width: 6, height: 5, startNodeId: 'ark_gate' }
    });
    expect(dungeon.nodes).toHaveLength(30);
    for (const [y, row] of expectedRows.entries()) {
      for (const [x, [nodeId, nodeType]] of row.entries()) {
        expect(getLevelNode(dungeon, nodeId), nodeId).toMatchObject({
          type: nodeType,
          position: { x, y }
        });
      }
    }

    const monsterBindings = {
      dissipation_navigator_alpha: 'dissipation_navigator',
      entropy_deckhand_port: 'entropy_deckhand',
      entropy_deckhand: 'entropy_deckhand',
      last_helmsman: 'last_helmsman',
      entropy_deckhand_starboard: 'entropy_deckhand',
      dissipation_navigator_omega: 'dissipation_navigator'
    } as const;
    for (const [nodeId, monsterId] of Object.entries(monsterBindings)) {
      expect(getLevelNode(dungeon, nodeId)).toMatchObject({ type: 'monster', monsterId });
    }

    expect(content.MONSTERS.entropy_deckhand).toMatchObject({
      id: 'entropy_deckhand',
      name: '熵舱水手',
      dungeonId: 'entropy_ark',
      maxHp: 212,
      attack: 31,
      artPower: 22,
      defense: 15,
      speed: 22,
      rewardPoints: 760,
      drop: { entropy_crystal: 1 }
    });
    expect(content.MONSTERS.dissipation_navigator).toMatchObject({
      id: 'dissipation_navigator',
      name: '耗散领航员',
      dungeonId: 'entropy_ark',
      maxHp: 258,
      attack: 34,
      artPower: 34,
      defense: 18,
      speed: 20,
      rewardPoints: 940,
      drop: { entropy_crystal: 2 }
    });
    expect(content.MONSTERS.last_helmsman).toMatchObject({
      id: 'last_helmsman',
      name: '终末舵手',
      dungeonId: 'entropy_ark',
      maxHp: 318,
      attack: 38,
      artPower: 44,
      defense: 20,
      speed: 22,
      rewardPoints: 1240,
      drop: { entropy_crystal: 3, method_page: 1 }
    });

    expect(getLevelNode(dungeon, 'port_clue_cache').equipmentHuntClueId).toBe('equipment_hunt_entropy_ark');
    expect(getLevelNode(dungeon, 'starboard_clue_cache').equipmentHuntClueId).toBe('equipment_hunt_entropy_ark');
    expect(getLevelNode(dungeon, 'entropy_ballast_deck').fieldSurveyId).toBe('survey_entropy_ballast_deck');
    expect(getLevelNode(dungeon, 'port_relic_hold').relicDraftId).toBe('entropy_ark:port:1');
    expect(getLevelNode(dungeon, 'starboard_relic_hold').relicDraftId).toBe('entropy_ark:starboard:2');
    expect(getLevelNode(dungeon, 'soul_recharge_chamber')).toMatchObject({
      type: 'trap',
      soulRechargeId: 'soul_node_entropy_recharge'
    });
    expect(getDungeonEvents('entropy_ark').map((event) => event.nodeId)).toEqual([
      'wake_inversion',
      'ark_manifest'
    ]);
    expect(getRunProtocolDefinition('entropy_ark', 'imprint')).toMatchObject({
      requiredNodeId: 'ark_manifest'
    });
    expect(getRunProtocolDefinition('entropy_ark', 'deep')).toMatchObject({
      requiredNodeIds: ['port_ballast_core', 'starboard_ballast_core']
    });

    expect(getLevelNode(content.DUNGEONS.causal_clearinghouse, 'cause_echo_portal').portal).toEqual({
      targetDungeonId: 'entropy_ark',
      targetNodeId: 'port_clue_cache',
      stableItem: 'gate_sigil'
    });
    expect(getLevelNode(content.DUNGEONS.causal_clearinghouse, 'effect_echo_portal').portal).toEqual({
      targetDungeonId: 'entropy_ark',
      targetNodeId: 'starboard_clue_cache',
      stableItem: 'gate_sigil'
    });
    expect(getLevelNode(dungeon, 'port_return_portal').portal).toEqual({
      targetDungeonId: 'mirror_cycle_city',
      targetNodeId: 'real_clue_vault',
      stableItem: 'gate_sigil'
    });
    expect(getLevelNode(dungeon, 'starboard_return_portal').portal).toEqual({
      targetDungeonId: 'mirror_cycle_city',
      targetNodeId: 'mirror_clue_vault',
      stableItem: 'gate_sigil'
    });

    expect(getBossDefinition('entropy_ark')).toMatchObject({
      tier: 10,
      nodeId: 'last_helmsman',
      monsterId: 'last_helmsman',
      bonusReward: { items: { entropy_crystal: 2 } }
    });
    const entropyRewardNodes = dungeon.nodes.filter(
      (node) => (node.type === 'reward' || node.type === 'exit') && (node.reward?.items?.entropy_crystal ?? 0) > 0
    );
    expect(entropyRewardNodes.filter((node) => node.type === 'reward').length).toBeGreaterThanOrEqual(10);
    expect(getLevelNode(dungeon, 'entropy_ark_exit').reward?.items?.entropy_crystal).toBe(3);
  });

  it('matches every mirror cycle city map, special-node, portal, monster, boss, and material contract', async () => {
    const content = await loadLevelContent();

    expect(content).not.toBeNull();
    if (!content) return;

    const dungeon = content.DUNGEONS.mirror_cycle_city;
    const expectedRows = [
      [
        ['real_clue_vault', 'reward'],
        ['parallax_hunter_real', 'monster'],
        ['first_phase_mirror', 'reward'],
        ['real_relic_gallery', 'reward'],
        ['shard_rain_trap', 'trap'],
        ['upper_return_portal', 'portal']
      ],
      [
        ['real_supply_alcove', 'reward'],
        ['mirror_chorus_real', 'monster'],
        ['real_anchor', 'reward'],
        ['mirror_city_survey', 'reward'],
        ['parallax_corridor_trap', 'trap'],
        ['mirror_chorus_upper', 'monster']
      ],
      [
        ['cycle_gate', 'reward'],
        ['parallax_hunter_spine', 'monster'],
        ['second_phase_mirror', 'reward'],
        ['cycle_manifest', 'reward'],
        ['nameless_reflection', 'monster'],
        ['boss_side_trap', 'trap']
      ],
      [
        ['mirror_supply_alcove', 'reward'],
        ['mirror_chorus_mirror', 'monster'],
        ['mirror_anchor', 'reward'],
        ['soul_recharge_mirror', 'monster'],
        ['third_phase_mirror', 'reward'],
        ['lower_return_portal', 'portal']
      ],
      [
        ['mirror_clue_vault', 'reward'],
        ['parallax_hunter_mirror', 'monster'],
        ['reflection_event_stage', 'reward'],
        ['mirror_relic_gallery', 'reward'],
        ['identity_fracture_trap', 'trap'],
        ['mirror_cycle_exit', 'exit']
      ]
    ] as const;

    expect(dungeon).toMatchObject({
      id: 'mirror_cycle_city',
      name: '镜海轮回城',
      tier: 11,
      recommendedPower: 630,
      grid: { width: 6, height: 5, startNodeId: 'cycle_gate' }
    });
    expect(dungeon.nodes).toHaveLength(30);
    for (const [y, row] of expectedRows.entries()) {
      for (const [x, [nodeId, nodeType]] of row.entries()) {
        expect(getLevelNode(dungeon, nodeId), nodeId).toMatchObject({
          type: nodeType,
          position: { x, y }
        });
      }
    }

    const monsterBindings = {
      parallax_hunter_real: 'parallax_hunter',
      mirror_chorus_real: 'mirror_chorus',
      mirror_chorus_upper: 'mirror_chorus',
      parallax_hunter_spine: 'parallax_hunter',
      nameless_reflection: 'nameless_reflection',
      mirror_chorus_mirror: 'mirror_chorus',
      soul_recharge_mirror: 'mirror_chorus',
      parallax_hunter_mirror: 'parallax_hunter'
    } as const;
    for (const [nodeId, monsterId] of Object.entries(monsterBindings)) {
      expect(getLevelNode(dungeon, nodeId)).toMatchObject({ type: 'monster', monsterId });
    }
    expect(dungeon.nodes.filter((node) => node.type === 'trap')).toHaveLength(4);
    expect(
      dungeon.nodes.filter((node) => node.type === 'monster' && node.id !== 'nameless_reflection').length
    ).toBeGreaterThanOrEqual(6);

    expect(content.MONSTERS.parallax_hunter).toMatchObject({
      id: 'parallax_hunter',
      name: '视差猎手',
      dungeonId: 'mirror_cycle_city',
      maxHp: 236,
      attack: 34,
      artPower: 27,
      defense: 17,
      speed: 24,
      rewardPoints: 840,
      drop: { phase_glass: 1 }
    });
    expect(content.MONSTERS.mirror_chorus).toMatchObject({
      id: 'mirror_chorus',
      name: '镜群合唱者',
      dungeonId: 'mirror_cycle_city',
      maxHp: 286,
      attack: 37,
      artPower: 39,
      defense: 20,
      speed: 23,
      rewardPoints: 1040,
      drop: { phase_glass: 2 }
    });
    expect(content.MONSTERS.nameless_reflection).toMatchObject({
      id: 'nameless_reflection',
      name: '无名镜王',
      dungeonId: 'mirror_cycle_city',
      maxHp: 356,
      attack: 42,
      artPower: 50,
      defense: 23,
      speed: 25,
      rewardPoints: 1380,
      drop: { phase_glass: 3, method_page: 1 }
    });

    expect(getLevelNode(dungeon, 'real_clue_vault').equipmentHuntClueId).toBe(
      'equipment_hunt_mirror_cycle_city'
    );
    expect(getLevelNode(dungeon, 'mirror_clue_vault').equipmentHuntClueId).toBe(
      'equipment_hunt_mirror_cycle_city'
    );
    expect(getLevelNode(dungeon, 'mirror_city_survey').fieldSurveyId).toBe('survey_mirror_city_parallax');
    expect(getLevelNode(dungeon, 'real_relic_gallery').relicDraftId).toBe('mirror_cycle_city:real:1');
    expect(getLevelNode(dungeon, 'mirror_relic_gallery').relicDraftId).toBe('mirror_cycle_city:mirror:2');
    expect(getLevelNode(dungeon, 'soul_recharge_mirror')).toMatchObject({
      type: 'monster',
      soulRechargeId: 'soul_node_mirror_recharge'
    });
    expect(DUNGEON_LAW_LANDMARKS.mirror_cycle_city).toEqual({
      phaseChoiceNodeIds: ['first_phase_mirror', 'second_phase_mirror', 'third_phase_mirror'],
      realAnchorNodeIds: ['real_anchor'],
      mirrorAnchorNodeIds: ['mirror_anchor']
    });
    expect(getDungeonEvents('mirror_cycle_city').map((event) => [event.id, event.nodeId])).toEqual([
      ['faceless_procession', 'cycle_manifest'],
      ['identity_rehearsal', 'reflection_event_stage']
    ]);

    expect(getLevelNode(content.DUNGEONS.entropy_ark, 'port_return_portal').portal).toEqual({
      targetDungeonId: 'mirror_cycle_city',
      targetNodeId: 'real_clue_vault',
      stableItem: 'gate_sigil'
    });
    expect(getLevelNode(content.DUNGEONS.entropy_ark, 'starboard_return_portal').portal).toEqual({
      targetDungeonId: 'mirror_cycle_city',
      targetNodeId: 'mirror_clue_vault',
      stableItem: 'gate_sigil'
    });
    expect(getLevelNode(dungeon, 'upper_return_portal').portal).toEqual({
      targetDungeonId: 'redaction_scriptorium',
      targetNodeId: 'folio_gate',
      stableItem: 'gate_sigil'
    });
    expect(getLevelNode(dungeon, 'lower_return_portal').portal).toEqual({
      targetDungeonId: 'redaction_scriptorium',
      targetNodeId: 'lower_supply_margin',
      stableItem: 'gate_sigil'
    });

    expect(getBossDefinition('mirror_cycle_city')).toMatchObject({
      tier: 11,
      nodeId: 'nameless_reflection',
      monsterId: 'nameless_reflection',
      bonusReward: { items: { phase_glass: 2 } }
    });
    const phaseGlassRewardNodes = dungeon.nodes.filter(
      (node) => (node.type === 'reward' || node.type === 'exit') && (node.reward?.items?.phase_glass ?? 0) > 0
    );
    expect(phaseGlassRewardNodes.filter((node) => node.type === 'reward').length).toBeGreaterThanOrEqual(10);
    expect(getLevelNode(dungeon, 'mirror_cycle_exit').reward).toMatchObject({
      rewardPoints: 920,
      lingyun: 7,
      items: { phase_glass: 4, method_page: 2, cracked_core: 1, cycle_imprint: 1 }
    });
  });

  it('matches the exact Tier-12 redaction scriptorium map and chapter contracts', async () => {
    const content = await loadLevelContent();

    expect(content).not.toBeNull();
    if (!content) return;

    const dungeon = content.DUNGEONS.redaction_scriptorium;
    const expectedRows = [
      [
        ['memory_survey_archive', 'reward'],
        ['north_clue_cache', 'reward'],
        ['erasure_copyist_north', 'monster'],
        ['body_relic_gallery', 'reward'],
        ['palimpsest_censor_alpha', 'monster'],
        ['body_proof_vault', 'reward']
      ],
      [
        ['upper_supply_margin', 'reward'],
        ['body_clause_desk', 'reward'],
        ['severed_sentence_trap', 'trap'],
        ['erasure_copyist_alpha', 'monster'],
        ['boss_north_lock', 'trap'],
        ['upper_revision_portal', 'portal']
      ],
      [
        ['folio_gate', 'reward'],
        ['margin_scribe_spine', 'monster'],
        ['memory_clause_desk', 'reward'],
        ['final_proof_nexus', 'reward'],
        ['last_redactor', 'monster'],
        ['boss_side_lock', 'trap']
      ],
      [
        ['lower_supply_margin', 'reward'],
        ['return_clause_desk', 'reward'],
        ['palimpsest_censor_omega', 'monster'],
        ['errata_event_stage', 'reward'],
        ['boss_south_lock', 'trap'],
        ['lower_revision_portal', 'portal']
      ],
      [
        ['return_revision_portal', 'portal'],
        ['south_clue_cache', 'reward'],
        ['erasure_copyist_south', 'monster'],
        ['return_relic_gallery', 'reward'],
        ['soul_recharge_scriptorium', 'trap'],
        ['scriptorium_exit', 'exit']
      ]
    ] as const;

    expect(dungeon).toMatchObject({
      id: 'redaction_scriptorium',
      name: '删界终稿院',
      tier: 12,
      recommendedPower: 700,
      grid: { width: 6, height: 5, startNodeId: 'folio_gate' }
    });
    expect(dungeon.nodes).toHaveLength(30);
    expect(getReachableNodeIds(dungeon).size).toBe(30);
    for (const [y, row] of expectedRows.entries()) {
      for (const [x, [nodeId, nodeType]] of row.entries()) {
        expect(getLevelNode(dungeon, nodeId), nodeId).toMatchObject({
          type: nodeType,
          position: { x, y }
        });
      }
    }

    expect(dungeon.nodes.filter((node) => node.type === 'monster')).toHaveLength(7);
    expect(dungeon.nodes.filter((node) => node.type === 'trap')).toHaveLength(5);
    expect(dungeon.nodes.filter((node) => node.type === 'reward')).toHaveLength(14);
    expect(dungeon.nodes.filter((node) => node.type === 'portal')).toHaveLength(3);
    expect(dungeon.nodes.filter((node) => node.type === 'exit')).toHaveLength(1);

    expect(content.MONSTERS.erasure_copyist).toMatchObject({
      id: 'erasure_copyist',
      name: '删界抄写员',
      dungeonId: 'redaction_scriptorium',
      maxHp: 262,
      attack: 39,
      artPower: 32,
      defense: 19,
      speed: 26,
      rewardPoints: 920,
      drop: { redaction_ink: 1 }
    });
    expect(content.MONSTERS.palimpsest_censor).toMatchObject({
      id: 'palimpsest_censor',
      name: '覆页裁定者',
      dungeonId: 'redaction_scriptorium',
      maxHp: 318,
      attack: 42,
      artPower: 45,
      defense: 22,
      speed: 25,
      rewardPoints: 1150,
      drop: { redaction_ink: 2 }
    });
    expect(content.MONSTERS.last_redactor).toMatchObject({
      id: 'last_redactor',
      name: '终稿删界官',
      dungeonId: 'redaction_scriptorium',
      maxHp: 398,
      attack: 47,
      artPower: 56,
      defense: 26,
      speed: 28,
      rewardPoints: 1510,
      drop: { redaction_ink: 3, method_page: 1 }
    });

    expect(getLevelNode(dungeon, 'north_clue_cache').equipmentHuntClueId).toBe(
      'equipment_hunt_redaction_scriptorium'
    );
    expect(getLevelNode(dungeon, 'south_clue_cache').equipmentHuntClueId).toBe(
      'equipment_hunt_redaction_scriptorium'
    );
    expect(getLevelNode(dungeon, 'memory_survey_archive').fieldSurveyId).toBe(
      'survey_redaction_memory_archive'
    );
    expect(getLevelNode(dungeon, 'body_relic_gallery').relicDraftId).toBe(
      'redaction_scriptorium:body:1'
    );
    expect(getLevelNode(dungeon, 'return_relic_gallery').relicDraftId).toBe(
      'redaction_scriptorium:return:2'
    );
    expect(getLevelNode(dungeon, 'soul_recharge_scriptorium')).toMatchObject({
      type: 'trap',
      soulRechargeId: 'soul_node_redaction_rebind'
    });
    expect(DUNGEON_LAW_LANDMARKS.redaction_scriptorium.clauseNodeIds).toEqual([
      'body_clause_desk',
      'memory_clause_desk',
      'return_clause_desk'
    ]);
    expect(getDungeonEvents('redaction_scriptorium').map((event) => [event.id, event.nodeId])).toEqual([
      ['first_erratum', 'final_proof_nexus'],
      ['palimpsest_testimony', 'errata_event_stage']
    ]);

    const expectedPortals = {
      upper_revision_portal: 'estate_gate',
      lower_revision_portal: 'lower_bid_supply',
      return_revision_portal: 'archive_survey_gallery'
    } as const;
    for (const [nodeId, targetNodeId] of Object.entries(expectedPortals)) {
      expect(getLevelNode(dungeon, nodeId).portal).toEqual({
        targetDungeonId: 'legacy_auction_court',
        targetNodeId,
        stableItem: 'gate_sigil'
      });
    }
    expect(getLevelNode(content.DUNGEONS.mirror_cycle_city, 'upper_return_portal').portal).toEqual({
      targetDungeonId: 'redaction_scriptorium',
      targetNodeId: 'folio_gate',
      stableItem: 'gate_sigil'
    });
    expect(getLevelNode(content.DUNGEONS.mirror_cycle_city, 'lower_return_portal').portal).toEqual({
      targetDungeonId: 'redaction_scriptorium',
      targetNodeId: 'lower_supply_margin',
      stableItem: 'gate_sigil'
    });

    for (const node of dungeon.nodes.filter((candidate) => candidate.type === 'reward')) {
      expect(node.reward?.rewardPoints, node.id).toBeGreaterThanOrEqual(230);
      expect(node.reward?.rewardPoints, node.id).toBeLessThanOrEqual(380);
      expect(node.reward?.items?.redaction_ink, node.id).toBeGreaterThanOrEqual(1);
    }
    for (const node of dungeon.nodes.filter((candidate) => candidate.type === 'trap')) {
      expect(node.trap?.damage, node.id).toBeGreaterThanOrEqual(128);
      expect(node.trap?.damage, node.id).toBeLessThanOrEqual(140);
      expect(node.trap?.dc, node.id).toBeGreaterThanOrEqual(30);
      expect(node.trap?.dc, node.id).toBeLessThanOrEqual(32);
      expect(node.trap?.counterItem, node.id).toBeTypeOf('string');
    }
    expect(getLevelNode(dungeon, 'body_proof_vault').reward).toEqual({
      rewardPoints: 360,
      lingyun: 1,
      items: { redaction_ink: 2, cycle_imprint: 1 }
    });
    expect(getLevelNode(dungeon, 'scriptorium_exit').reward).toEqual({
      rewardPoints: 1020,
      lingyun: 8,
      items: { redaction_ink: 4, method_page: 2, cracked_core: 1, cycle_imprint: 1 }
    });
    expect(getBossDefinition('redaction_scriptorium')).toMatchObject({
      tier: 12,
      nodeId: 'last_redactor',
      monsterId: 'last_redactor',
      bonusReward: { items: { redaction_ink: 2 } }
    });
  });

  it('keeps recommended power and strongest monster pressure rising by tier', async () => {
    const content = await loadLevelContent();

    expect(content).not.toBeNull();
    if (!content) return;

    let previousRecommendedPower = 0;
    let previousStrongestReward = 0;
    let previousStrongestScore = 0;

    for (const dungeonId of content.DUNGEON_ORDER) {
      const dungeon = content.DUNGEONS[dungeonId];
      const monsters = dungeon.nodes
        .filter((node) => node.type === 'monster')
        .map((node) => content.MONSTERS[node.monsterId ?? '']);
      const strongest = monsters.reduce((best, monster) => (encounterScore(monster) > encounterScore(best) ? monster : best));

      expect(dungeon.recommendedPower).toBeGreaterThan(previousRecommendedPower);
      expect(strongest.rewardPoints).toBeGreaterThan(previousStrongestReward);
      expect(encounterScore(strongest)).toBeGreaterThan(previousStrongestScore);

      previousRecommendedPower = dungeon.recommendedPower;
      previousStrongestReward = strongest.rewardPoints;
      previousStrongestScore = encounterScore(strongest);
    }
  });

  it('assigns two globally unique relic drafts to ordinary reward nodes in every dungeon', async () => {
    const content = await loadLevelContent();

    expect(content).not.toBeNull();
    if (!content) return;

    const relicDraftIds = new Set<string>();

    for (const dungeonId of content.DUNGEON_ORDER) {
      const dungeon = content.DUNGEONS[dungeonId];
      const relicDraftNodes = dungeon.nodes.filter((node) => node.relicDraftId !== undefined);

      expect(relicDraftNodes).toHaveLength(2);
      expect(relicDraftNodes.map((node) => node.relicDraftId).sort()).toEqual([...RELIC_DRAFT_IDS[dungeonId]].sort());

      for (const node of relicDraftNodes) {
        expect(node.relicDraftId).toBeTypeOf('string');
        expect(relicDraftIds.has(node.relicDraftId!)).toBe(false);
        expect(node.type).toBe('reward');
        expect(node.id).not.toBe(dungeon.grid.startNodeId);
        expect(node.type).not.toBe('exit');
        relicDraftIds.add(node.relicDraftId!);
      }
    }

    expect(relicDraftIds.size).toBe(38);
  });

  it('assigns exactly two interchangeable equipment hunt clue rewards per dungeon', async () => {
    const content = await loadLevelContent();

    expect(content).not.toBeNull();
    if (!content) return;

    const definitionIds = Object.values(EQUIPMENT_HUNT_DEFINITIONS).map((definition) => definition.id);
    const clueIds = new Set<string>();
    const hostIds = new Set<string>();

    expect(definitionIds).toHaveLength(content.DUNGEON_ORDER.length);
    expect(new Set(definitionIds).size).toBe(definitionIds.length);

    for (const dungeonId of content.DUNGEON_ORDER) {
      const dungeon = content.DUNGEONS[dungeonId];
      const expectedClueId = EQUIPMENT_HUNT_DEFINITIONS[dungeonId].id;
      const expectedHostIds = EQUIPMENT_HUNT_CLUE_HOSTS[dungeonId];
      const hosts = dungeon.nodes.filter((node) => node.equipmentHuntClueId !== undefined);

      expect(hosts, dungeonId).toHaveLength(2);
      expect(hosts.map((node) => node.id).sort(), dungeonId).toEqual([...expectedHostIds].sort());
      // Both rewards expose the same hunt so either host can resolve it; they are not a two-step clue chain.
      expect(hosts.map((node) => node.equipmentHuntClueId), dungeonId).toEqual([expectedClueId, expectedClueId]);

      for (const host of hosts) {
        expect(host.type, `${dungeonId}:${host.id}`).toBe('reward');
        expect(host.reward, `${dungeonId}:${host.id}`).toBeDefined();
        expect(['exit', 'portal', 'monster', 'trap'], `${dungeonId}:${host.id}`).not.toContain(host.type);

        const hostId = scopedNodeId(dungeonId, host.id);
        expect(hostIds.has(hostId), hostId).toBe(false);
        hostIds.add(hostId);
      }

      clueIds.add(expectedClueId);
    }

    expect(hostIds.size).toBe(38);
    expect([...clueIds].sort()).toEqual([...definitionIds].sort());
  });

  it('assigns each field survey once to its intended reward node without reward interaction conflicts', async () => {
    const content = await loadLevelContent();

    expect(content).not.toBeNull();
    if (!content) return;

    const surveyHosts = content.DUNGEON_ORDER.flatMap((dungeonId) =>
      content.DUNGEONS[dungeonId].nodes
        .filter((node) => node.fieldSurveyId !== undefined)
        .map((node) => ({ dungeonId, node }))
    );

    expect(surveyHosts).toHaveLength(19);

    for (const dungeonId of content.DUNGEON_ORDER) {
      const expected = FIELD_SURVEY_PLACEMENTS[dungeonId];
      const matches = surveyHosts.filter(({ node }) => node.fieldSurveyId === expected.fieldSurveyId);

      expect(matches, expected.fieldSurveyId).toHaveLength(1);
      const host = matches[0];
      if (!host) throw new Error(`Missing field survey host for ${dungeonId}`);

      expect(host.dungeonId, expected.fieldSurveyId).toBe(dungeonId);
      expect(host.node.id, expected.fieldSurveyId).toBe(expected.nodeId);
      expect(host.node.type, expected.fieldSurveyId).toBe('reward');
      expect(host.node.reward, expected.fieldSurveyId).toBeDefined();
      expect(host.node.relicDraftId, expected.fieldSurveyId).toBeUndefined();
      expect(host.node.soulRechargeId, expected.fieldSurveyId).toBeUndefined();
    }
  });

  it('assigns exactly eighteen unique soul recharge hosts and preserves the Tier-17 special-law departure', async () => {
    const content = await loadLevelContent();

    expect(content).not.toBeNull();
    if (!content) return;

    const bossNodeIds = new Set(
      content.DUNGEON_ORDER.map((dungeonId) => scopedNodeId(dungeonId, getBossDefinition(dungeonId).nodeId))
    );
    const imprintAnchorNodeIds = new Set(
      getImprintRunProtocolDefinitions().map((protocol) => scopedNodeId(protocol.dungeonId, protocol.requiredNodeId))
    );
    const lawLandmarkNodeIds = new Set(
      content.DUNGEON_ORDER.flatMap((dungeonId) =>
        (LAW_LANDMARK_NODE_IDS[dungeonId] ?? []).map((nodeId) => scopedNodeId(dungeonId, nodeId))
      )
    );
    const dungeonEventNodeIds = new Set(
      content.DUNGEON_ORDER.flatMap((dungeonId) =>
        getDungeonEvents(dungeonId).map((event) => scopedNodeId(dungeonId, event.nodeId))
      )
    );
    const routeGateDepartureNodeIds = new Set(
      content.DUNGEON_ORDER.flatMap((dungeonId) =>
        getDungeonRouteGates(dungeonId).map((gate) => scopedNodeId(dungeonId, gate.fromNodeId))
      )
    );
    const soulRechargeIds: string[] = [];

    for (const dungeonId of content.DUNGEON_ORDER) {
      const dungeon = content.DUNGEONS[dungeonId];
      const expected = SOUL_RECHARGE_PLACEMENTS[dungeonId];
      const hosts = dungeon.nodes.filter((node) => node.soulRechargeId !== undefined);

      expect(hosts, dungeonId).toHaveLength(1);
      const host = hosts[0];
      if (!host?.soulRechargeId) throw new Error(`Missing soul recharge host for ${dungeonId}`);

      expect(
        { nodeId: host.id, soulRechargeId: host.soulRechargeId },
        dungeonId
      ).toEqual(expected);
      expect(['monster', 'trap'], dungeonId).toContain(host.type);
      expect(host.monsterId !== undefined || host.trap !== undefined, dungeonId).toBe(true);
      expect(host.reward, dungeonId).toBeUndefined();
      expect(host.portal, dungeonId).toBeUndefined();
      expect(host.relicDraftId, dungeonId).toBeUndefined();

      const hostKey = scopedNodeId(dungeonId, host.id);
      expect(bossNodeIds.has(hostKey), `${hostKey}:boss`).toBe(false);
      expect(imprintAnchorNodeIds.has(hostKey), `${hostKey}:imprint-anchor`).toBe(false);
      expect(lawLandmarkNodeIds.has(hostKey), `${hostKey}:law-landmark`).toBe(false);
      expect(dungeonEventNodeIds.has(hostKey), `${hostKey}:dungeon-event`).toBe(false);
      if (dungeonId !== 'legacy_auction_court' && dungeonId !== 'genesis_vault' && dungeonId !== 'silent_broadcast_tower' && dungeonId !== 'lost_shelter' && dungeonId !== 'false_testimony_court' && dungeonId !== 'combat_replay_stage') {
        expect(routeGateDepartureNodeIds.has(hostKey), `${hostKey}:route-gate-departure`).toBe(false);
      }
      soulRechargeIds.push(host.soulRechargeId);
    }

    expect(soulRechargeIds).toHaveLength(19);
    expect(new Set(soulRechargeIds).size).toBe(19);
    expect([...soulRechargeIds].sort()).toEqual(
      content.DUNGEON_ORDER.map((dungeonId) => SOUL_RECHARGE_PLACEMENTS[dungeonId].soulRechargeId).sort()
    );

    const dungeonId = 'false_testimony_court' as const;
    const hostNodeId = 'soul_recharge_verdict';
    const vaultNodeId = 'false_verdict_vault';
    const ordinaryNodeId = 'evidence_supply_cache';
    const hostDepartureGates = getDungeonRouteGates(dungeonId).filter(
      (gate) => gate.fromNodeId === hostNodeId
    );

    expect(hostDepartureGates.map((gate) => gate.toNodeId)).toEqual([vaultNodeId]);

    const defaultLaw = createDungeonLawState(dungeonId);
    const resolveVerdict = (suspect: 'records_keeper' | 'route_surveyor') => {
      let lawState = signalFirstNodeClear(defaultLaw, {
        node: { id: 'voice_filter_trap', type: 'trap' },
        damageTaken: 0
      });
      lawState = signalFirstNodeClear(lawState, {
        node: { id: 'voice_evidence', type: 'reward' },
        damageTaken: 0
      });
      lawState = signalFirstNodeClear(lawState, {
        node: { id: 'verdict_chamber', type: 'reward' },
        damageTaken: 0
      });
      const resolution = resolveFalseTestimonyAccusation(lawState, suspect);
      expect(resolution.resolved).toBe(true);
      return resolution.state;
    };
    const correctLaw = resolveVerdict('route_surveyor');
    const incorrectLaw = resolveVerdict('records_keeper');

    expect(getRouteBlockReason(dungeonId, hostNodeId, vaultNodeId, defaultLaw)).toBeDefined();
    expect(getRouteBlockReason(dungeonId, hostNodeId, vaultNodeId, correctLaw)).toBeDefined();
    expect(getRouteBlockReason(dungeonId, hostNodeId, vaultNodeId, incorrectLaw)).toBeUndefined();
    for (const lawState of [defaultLaw, correctLaw, incorrectLaw]) {
      expect(getRouteBlockReason(dungeonId, hostNodeId, ordinaryNodeId, lawState)).toBeUndefined();
    }

    const route = [
      'north_entry',
      'hostile_witness_north',
      'archive_censor_alpha',
      'judgment_lock',
      'cross_exam_stage',
      hostNodeId,
      ordinaryNodeId
    ] as const;
    let state = createRouteTestState(dungeonId, content.DUNGEON_ORDER);
    if (!state.run) throw new Error('Expected a false testimony run.');
    state = { ...state, run: { ...state.run, currentNodeId: route[0] } };

    for (let index = 0; index < route.length - 1; index += 1) {
      const node = getLevelNode(content.DUNGEONS[dungeonId], route[index]);
      const nextNodeId = route[index + 1];
      state = resolveRouteNode(state, node);
      const moved = moveToNode(state, nextNodeId);
      expect(moved.run?.currentNodeId, `${node.id}->${nextNodeId}`).toBe(nextNodeId);
      state = moved;
    }
    expect(state.run?.clearedNodeIds).toContain(hostNodeId);
    expect(state.run?.currentNodeId).toBe(ordinaryNodeId);
  });

  it('walks each soul recharge route under default laws and clears the host before optional departure', async () => {
    const content = await loadLevelContent();

    expect(content).not.toBeNull();
    if (!content) return;

    for (const dungeonId of content.DUNGEON_ORDER) {
      const dungeon = content.DUNGEONS[dungeonId];
      const route = SOUL_RECHARGE_ROUTES[dungeonId];
      const expectedHost = SOUL_RECHARGE_PLACEMENTS[dungeonId];
      const exit = getLevelNode(dungeon, route[route.length - 1]);

      const expectedEntryNodeId = dungeonId === 'false_testimony_court' ? 'north_entry' : dungeon.grid.startNodeId;
      expect(route[0], `${dungeonId}:start`).toBe(expectedEntryNodeId);
      expect(route, `${dungeonId}:host`).toContain(expectedHost.nodeId);
      if (dungeonId === 'combat_replay_stage') {
        expect(exit.id, `${dungeonId}:post-host`).toBe('script_projection_stage');
      } else if (dungeonId === 'panopticon_city') {
        expect(exit.id, `${dungeonId}:post-host`).toBe('refraction_lab');
      } else {
        expect(exit.type, `${dungeonId}:exit`).toBe('exit');
      }
      for (let index = 1; index < route.length; index += 1) {
        const previous = getLevelNode(dungeon, route[index - 1]);
        const current = getLevelNode(dungeon, route[index]);
        expect(isManhattanAdjacent(previous, current), `${dungeonId}:${previous.id}->${current.id}`).toBe(true);
      }

      let state = createRouteTestState(dungeonId, content.DUNGEON_ORDER);
      if (dungeonId === 'false_testimony_court' && state.run) {
        state = { ...state, run: { ...state.run, currentNodeId: expectedEntryNodeId } };
      }
      let clearedRechargeHost = false;
      expect(state.run?.currentNodeId, `${dungeonId}:entered`).toBe(route[0]);
      expect(state.run?.lawState, `${dungeonId}:default-law`).toEqual(createDungeonLawState(dungeonId));

      for (let index = 0; index < route.length - 1; index += 1) {
        const node = getLevelNode(dungeon, route[index]);
        const nextNodeId = route[index + 1];
        expect(state.run?.currentNodeId, `${dungeonId}:at:${node.id}`).toBe(node.id);

        if (node.soulRechargeId && !state.run?.clearedNodeIds.includes(node.id)) {
          const blocked = moveToNode(state, nextNodeId);
          expect(blocked.run?.currentNodeId, `${dungeonId}:${node.id}:uncleared`).toBe(node.id);
          expect(blocked.run?.clearedNodeIds, `${dungeonId}:${node.id}:uncleared`).not.toContain(node.id);
          state = blocked;
        }

        state = resolveRouteNode(state, node);
        if (getCurrentCausalLedgerStatus(state)?.pending) {
          state = resolveCausalLedger(state, 'balance');
        }
        if (getCurrentRedactionClauseStatus(state)?.pending) {
          state = resolveRedactionClause(state, 'certify');
        }
        if (getCurrentAuctionLotStatus(state)?.pending) {
          state = resolveAuctionLot(state, 'bid');
        }
        if (getCurrentGenesisSpliceStatus(state)?.pending) {
          state = resolveGenesisSplice(state, 'renewal');
        }
        if (getCurrentBroadcastRelayStatus(state)?.pending) {
          state = resolveCurrentBroadcastRelay(state, 'mute');
        }
        const escortStatus = getCurrentEscortCheckpointStatus(state);
        if (escortStatus?.pending) {
          state = resolveCurrentEscortCheckpoint(
            state,
            escortStatus.choices.treat.available ? 'treat' : 'push'
          );
        }
        const verdictStatus = getCurrentVerdictStatus(state);
        if (verdictStatus?.pendingVerdictNodeId) {
          state = resolveCurrentVerdictChoice(state, 'route_surveyor');
        }
        if (
          dungeonId === 'mirror_cycle_city' &&
          (node.id === 'first_phase_mirror' ||
            node.id === 'second_phase_mirror' ||
            node.id === 'third_phase_mirror')
        ) {
          expect(getCurrentMirrorCityPhaseStatus(state)).toMatchObject({
            pending: true,
            pendingPhaseNodeId: node.id
          });
          const targetPhase = node.id === 'first_phase_mirror' ? 'real' : 'mirror';
          state = resolveMirrorCityPhase(state, targetPhase);
          expect(getCurrentMirrorCityPhaseStatus(state)).toMatchObject({
            pending: false,
            pendingPhaseNodeId: null,
            currentPhase: targetPhase,
            resolvedPhaseChoices: { [node.id]: targetPhase }
          });
        }
        if (dungeonId === 'combat_replay_stage' && node.id === 'take_gamma') {
          state = selectCombatReplayRoute(state, 'afterbeat');
        }
        if (node.soulRechargeId) {
          expect(state.run?.clearedNodeIds, `${dungeonId}:${node.id}:cleared`).toContain(node.id);
          clearedRechargeHost = true;
        }

        const moved = moveToNode(state, nextNodeId);
        expect(moved.run?.currentNodeId, `${dungeonId}:${node.id}->${nextNodeId}`).toBe(nextNodeId);
        state = moved;
      }

      expect(clearedRechargeHost, `${dungeonId}:recharge-host-cleared`).toBe(true);
      if (dungeonId === 'combat_replay_stage' || dungeonId === 'panopticon_city') continue;
      const exited = resolveExit(selectNode(state, exit.id));
      expect(exited.phase, `${dungeonId}:resolved-exit`).toBe('result');
      expect(exited.run?.clearedNodeIds, `${dungeonId}:resolved-exit`).toContain(exit.id);
    }
  });

  it('places every dungeon node on a bounded tactical grid with one start node', async () => {
    const content = await loadLevelContent();

    expect(content).not.toBeNull();
    if (!content) return;

    for (const dungeonId of content.DUNGEON_ORDER) {
      const dungeon = content.DUNGEONS[dungeonId];
      const nodeIds = new Set(dungeon.nodes.map((node) => node.id));
      const occupiedCells = new Set<string>();

      expect(dungeon.grid).toBeDefined();
      if (!dungeon.grid) return;
      expect(dungeon.grid.width).toBeGreaterThan(1);
      expect(dungeon.grid.height).toBeGreaterThan(1);
      expect(dungeon.grid.width * dungeon.grid.height).toBeGreaterThanOrEqual(30);
      expect(nodeIds.has(dungeon.grid.startNodeId)).toBe(true);

      for (const node of dungeon.nodes) {
        expect(Number.isInteger(node.position.x)).toBe(true);
        expect(Number.isInteger(node.position.y)).toBe(true);
        expect(node.position.x).toBeGreaterThanOrEqual(0);
        expect(node.position.x).toBeLessThan(dungeon.grid.width);
        expect(node.position.y).toBeGreaterThanOrEqual(0);
        expect(node.position.y).toBeLessThan(dungeon.grid.height);

        const cellKey = `${node.position.x},${node.position.y}`;
        expect(occupiedCells.has(cellKey)).toBe(false);
        occupiedCells.add(cellKey);
      }
    }
  });

  it('keeps every dungeon node reachable from the start by adjacent grid moves', async () => {
    const content = await loadLevelContent();

    expect(content).not.toBeNull();
    if (!content) return;

    for (const dungeonId of content.DUNGEON_ORDER) {
      const dungeon = content.DUNGEONS[dungeonId];
      const reachable = getReachableNodeIds(dungeon);
      const criticalNodeIds = dungeon.nodes
        .filter((node) => node.type === 'monster' || node.type === 'trap' || node.type === 'portal' || node.type === 'exit')
        .map((node) => node.id);

      expect([...reachable].sort()).toEqual(dungeon.nodes.map((node) => node.id).sort());
      for (const nodeId of criticalNodeIds) {
        expect(reachable.has(nodeId)).toBe(true);
      }
    }
  });

  it('matches the locked Tier-13 auction map, hosts, portals, rewards, and monsters', async () => {
    const content = await loadLevelContent();
    expect(content).not.toBeNull();
    if (!content) return;

    const dungeon = content.DUNGEONS.legacy_auction_court;
    const expectedRows = [
      ['force_claim_vault', 'force_relic_gallery', 'north_scrip_cache', 'reserve_bailiff_north', 'inheritance_mimic_north', 'guard_claim_vault'],
      ['archive_survey_gallery', 'force_lot_dais', 'hammerfall_trap', 'inheritance_mimic_alpha', 'guard_lot_dais', 'upper_auction_portal'],
      ['estate_gate', 'catalog_bailiff', 'provenance_event_stage', 'estate_auctioneer', 'boss_side_rostrum', 'auction_exit'],
      ['lower_bid_supply', 'art_lot_dais', 'inheritance_mimic_omega', 'dead_team_testimony_stage', 'return_lot_dais', 'lower_auction_portal'],
      ['art_claim_vault', 'art_relic_gallery', 'return_auction_portal', 'south_scrip_cache', 'soul_recharge_auction', 'return_claim_vault']
    ] as const;

    expect(dungeon).toMatchObject({
      id: 'legacy_auction_court', name: '亡队遗产拍卖庭', tier: 13, recommendedPower: 780,
      grid: { width: 6, height: 5, startNodeId: 'estate_gate' }
    });
    expect(dungeon.nodes).toHaveLength(30);
    for (const [y, row] of expectedRows.entries()) {
      for (const [x, nodeId] of row.entries()) {
        expect(getLevelNode(dungeon, nodeId).position, nodeId).toEqual({ x, y });
      }
    }
    expect(getReachableNodeIds(dungeon).size).toBe(30);

    expect(getLevelNode(dungeon, 'archive_survey_gallery').fieldSurveyId).toBe('survey_legacy_auction_archive');
    expect(['north_scrip_cache', 'south_scrip_cache'].map((id) => getLevelNode(dungeon, id).equipmentHuntClueId)).toEqual([
      'equipment_hunt_legacy_auction_court', 'equipment_hunt_legacy_auction_court'
    ]);
    expect(['force_relic_gallery', 'art_relic_gallery'].map((id) => getLevelNode(dungeon, id).relicDraftId)).toEqual([
      'legacy_auction_court:force:1', 'legacy_auction_court:art:2'
    ]);
    expect(getLevelNode(dungeon, 'soul_recharge_auction').soulRechargeId).toBe('soul_node_auction_reprice');
    expect(getDungeonEvents('legacy_auction_court').map((event) => [event.id, event.nodeId])).toEqual([
      ['provenance_dispute', 'provenance_event_stage'],
      ['dead_team_testimony', 'dead_team_testimony_stage']
    ]);

    expect(['upper_auction_portal', 'lower_auction_portal', 'return_auction_portal'].map((id) => getLevelNode(dungeon, id).portal)).toEqual([
      { targetDungeonId: 'genesis_vault', targetNodeId: 'genesis_gate', stableItem: 'gate_sigil' },
      { targetDungeonId: 'genesis_vault', targetNodeId: 'lower_serum_supply', stableItem: 'gate_sigil' },
      { targetDungeonId: 'genesis_vault', targetNodeId: 'bloodline_survey_archive', stableItem: 'gate_sigil' }
    ]);
    const redaction = content.DUNGEONS.redaction_scriptorium;
    expect(['upper_revision_portal', 'lower_revision_portal', 'return_revision_portal'].map((id) => getLevelNode(redaction, id).portal)).toEqual([
      { targetDungeonId: 'legacy_auction_court', targetNodeId: 'estate_gate', stableItem: 'gate_sigil' },
      { targetDungeonId: 'legacy_auction_court', targetNodeId: 'lower_bid_supply', stableItem: 'gate_sigil' },
      { targetDungeonId: 'legacy_auction_court', targetNodeId: 'archive_survey_gallery', stableItem: 'gate_sigil' }
    ]);

    expect(getLevelNode(dungeon, 'estate_gate').reward).toEqual({ rewardPoints: 380, items: { legacy_scrip: 2, gate_sigil: 1 } });
    expect(getLevelNode(dungeon, 'auction_exit').reward).toEqual({
      rewardPoints: 1180, lingyun: 9,
      items: { legacy_scrip: 4, method_page: 2, cracked_core: 1, cycle_imprint: 1 }
    });
    expect(content.MONSTERS.reserve_bailiff).toMatchObject({ maxHp: 292, attack: 45, artPower: 38, defense: 22, speed: 29, rewardPoints: 1080, drop: { legacy_scrip: 1 } });
    expect(content.MONSTERS.inheritance_mimic).toMatchObject({ maxHp: 350, attack: 47, artPower: 50, defense: 24, speed: 28, rewardPoints: 1290, drop: { legacy_scrip: 2 } });
    expect(content.MONSTERS.estate_auctioneer).toMatchObject({ maxHp: 456, attack: 53, artPower: 64, defense: 30, speed: 31, rewardPoints: 1720, drop: { legacy_scrip: 3, method_page: 1 } });
  });

  it('matches the locked Tier-14 genesis map, rewards, portals, and monsters', async () => {
    const content = await loadLevelContent();
    expect(content).not.toBeNull();
    if (!content) return;

    const dungeon = content.DUNGEONS.genesis_vault;
    const expectedRows = [
      ['force_gene_vault', 'force_sample_gallery', 'north_serum_cache', 'gene_stalker_north', 'mutation_guardian_north', 'art_gene_vault'],
      ['bloodline_survey_archive', 'first_splice_console', 'helix_collapse_trap', 'gene_stalker_alpha', 'second_splice_console', 'upper_genesis_portal'],
      ['genesis_gate', 'sample_corridor_guard', 'mosaic_gene_vault', 'primal_curator', 'boss_side_lock', 'genesis_exit'],
      ['lower_serum_supply', 'third_splice_console', 'mutation_guardian_omega', 'lineage_event_stage', 'genome_repair_station', 'lower_genesis_portal'],
      ['guard_gene_vault', 'guard_relic_gallery', 'return_genesis_portal', 'south_serum_cache', 'soul_recharge_genesis', 'renewal_gene_vault']
    ] as const;

    expect(dungeon).toMatchObject({
      id: 'genesis_vault', name: '众生原型库', tier: 14, recommendedPower: 860,
      grid: { width: 6, height: 5, startNodeId: 'genesis_gate' }
    });
    expect(dungeon.nodes).toHaveLength(30);
    for (const [y, row] of expectedRows.entries()) {
      for (const [x, nodeId] of row.entries()) {
        expect(getLevelNode(dungeon, nodeId).position, nodeId).toEqual({ x, y });
      }
    }
    expect(new Set(dungeon.nodes.map((node) => `${node.position.x},${node.position.y}`)).size).toBe(30);
    expect(getLevelNode(dungeon, 'genesis_gate').reward).toEqual({
      rewardPoints: 420, items: { genesis_serum: 2, gate_sigil: 1 }
    });
    expect(['first_splice_console', 'second_splice_console', 'third_splice_console'].map((id) => getLevelNode(dungeon, id).reward?.items?.genesis_serum)).toEqual([1, 1, 1]);
    expect(getLevelNode(dungeon, 'genesis_exit').reward).toEqual({
      rewardPoints: 1320, lingyun: 10,
      items: { genesis_serum: 4, method_page: 2, cracked_core: 1, cycle_imprint: 1 }
    });
    expect(['upper_genesis_portal', 'lower_genesis_portal', 'return_genesis_portal'].map((id) => getLevelNode(dungeon, id).portal)).toEqual([
      { targetDungeonId: 'silent_broadcast_tower', targetNodeId: 'north_entry', stableItem: 'gate_sigil' },
      { targetDungeonId: 'silent_broadcast_tower', targetNodeId: 'lower_entry', stableItem: 'gate_sigil' },
      { targetDungeonId: 'silent_broadcast_tower', targetNodeId: 'broadcast_gate', stableItem: 'gate_sigil' }
    ]);
    expect(content.MONSTERS.gene_stalker).toMatchObject({ maxHp: 390, attack: 51, artPower: 48, defense: 26, speed: 34, rewardPoints: 1420, drop: { genesis_serum: 1 } });
    expect(content.MONSTERS.mutation_guardian).toMatchObject({ maxHp: 435, attack: 56, artPower: 54, defense: 30, speed: 30, rewardPoints: 1560, drop: { genesis_serum: 2 } });
    expect(content.MONSTERS.primal_curator).toMatchObject({ maxHp: 525, attack: 60, artPower: 72, defense: 34, speed: 34, rewardPoints: 1980, drop: { genesis_serum: 3, method_page: 1 } });
  });

  it('matches the locked Tier-15 broadcast map, hosts, portals, rewards, and monsters', async () => {
    const content = await loadLevelContent();
    expect(content).not.toBeNull();
    if (!content) return;

    const dungeon = content.DUNGEONS.silent_broadcast_tower;
    const expectedRows = [
      ['silent_archive', 'north_echo_cache', 'north_signal_cache', 'frequency_leech_north', 'broadcast_warden_north', 'resonance_vault'],
      ['north_entry', 'north_relay_console', 'acoustic_tripwire', 'dead_air_gallery', 'central_relay_console', 'upper_return_portal'],
      ['broadcast_gate', 'static_screen_trap', 'broadcast_memory_stage', 'last_broadcaster', 'studio_side_lock', 'broadcast_exit'],
      ['lower_entry', 'south_relay_console', 'broadcast_warden_omega', 'emergency_shelter', 'anechoic_chamber', 'lower_return_portal'],
      ['field_survey_archive', 'dead_air_mimic', 'return_broadcast_portal', 'south_signal_cache', 'soul_recharge_broadcast', 'balanced_switchboard']
    ] as const;

    expect(content.DUNGEON_ORDER.at(-5)).toBe('silent_broadcast_tower');
    expect(dungeon).toMatchObject({
      id: 'silent_broadcast_tower', name: '寂声广播塔', tier: 15, recommendedPower: 950,
      grid: { width: 6, height: 5, startNodeId: 'broadcast_gate' }
    });
    expect(dungeon.nodes).toHaveLength(30);
    expect(new Set(dungeon.nodes.map((node) => node.id)).size).toBe(30);
    for (const [y, row] of expectedRows.entries()) {
      for (const [x, nodeId] of row.entries()) {
        expect(getLevelNode(dungeon, nodeId).position, nodeId).toEqual({ x, y });
      }
    }
    expect(new Set(dungeon.nodes.map((node) => `${node.position.x},${node.position.y}`)).size).toBe(30);
    expect(getReachableNodeIds(dungeon).size).toBe(30);

    expect(['north_relay_console', 'central_relay_console', 'south_relay_console'].map((id) => getLevelNode(dungeon, id).type)).toEqual([
      'reward', 'reward', 'reward'
    ]);
    for (const entryId of ['broadcast_gate', 'north_entry', 'lower_entry']) {
      const entry = getLevelNode(dungeon, entryId);
      expect(entry.type, entryId).toBe('reward');
      expect(entry.reward?.items?.silence_core, entryId).toBeGreaterThanOrEqual(1);
      expect(entry.reward?.items?.gate_sigil, entryId).toBe(1);
    }
    expect(['north_signal_cache', 'south_signal_cache'].map((id) => getLevelNode(dungeon, id).equipmentHuntClueId)).toEqual([
      'equipment_hunt_silent_broadcast_tower', 'equipment_hunt_silent_broadcast_tower'
    ]);
    expect(getLevelNode(dungeon, 'field_survey_archive').fieldSurveyId).toBe('survey_silent_broadcast_archive');
    expect(['north_echo_cache', 'anechoic_chamber'].map((id) => getLevelNode(dungeon, id).relicDraftId)).toEqual([
      'silent_broadcast_tower:echo:1', 'silent_broadcast_tower:anechoic:2'
    ]);
    expect(getLevelNode(dungeon, 'soul_recharge_broadcast').soulRechargeId).toBe('soul_node_broadcast_recharge');
    expect(['frequency_leech_north', 'dead_air_mimic'].map((id) => getLevelNode(dungeon, id).monsterId)).toEqual([
      'frequency_leech', 'dead_air_mimic'
    ]);
    expect(['broadcast_warden_north', 'broadcast_warden_omega'].map((id) => getLevelNode(dungeon, id).monsterId)).toEqual([
      'broadcast_warden', 'broadcast_warden'
    ]);
    expect(getLevelNode(dungeon, 'last_broadcaster').monsterId).toBe('last_broadcaster');

    const advancedTraps = ['acoustic_tripwire', 'studio_side_lock', 'soul_recharge_broadcast'].map((id) => getLevelNode(dungeon, id));
    expect(advancedTraps.map((node) => node.trap)).toEqual([
      { damage: 170, dc: 40, counterItem: 'dispel_talisman' },
      { damage: 176, dc: 41, counterItem: 'focus_incense' },
      { damage: 178, dc: 40, counterItem: 'armor_patch' }
    ]);
    expect(new Set(advancedTraps.map((node) => node.trap?.counterItem)).size).toBe(3);

    expect(['upper_genesis_portal', 'lower_genesis_portal', 'return_genesis_portal'].map((id) => getLevelNode(content.DUNGEONS.genesis_vault, id).portal)).toEqual([
      { targetDungeonId: 'silent_broadcast_tower', targetNodeId: 'north_entry', stableItem: 'gate_sigil' },
      { targetDungeonId: 'silent_broadcast_tower', targetNodeId: 'lower_entry', stableItem: 'gate_sigil' },
      { targetDungeonId: 'silent_broadcast_tower', targetNodeId: 'broadcast_gate', stableItem: 'gate_sigil' }
    ]);
    expect(['upper_return_portal', 'lower_return_portal', 'return_broadcast_portal'].map((id) => getLevelNode(dungeon, id).portal)).toEqual([
      { targetDungeonId: 'lost_shelter', targetNodeId: 'north_entry', stableItem: 'gate_sigil' },
      { targetDungeonId: 'lost_shelter', targetNodeId: 'lower_entry', stableItem: 'gate_sigil' },
      { targetDungeonId: 'lost_shelter', targetNodeId: 'shelter_gate', stableItem: 'gate_sigil' }
    ]);
    expect(getLevelNode(dungeon, 'broadcast_exit').reward).toEqual({
      rewardPoints: 1450, lingyun: 11,
      items: { silence_core: 4, method_page: 2, cycle_imprint: 1 }
    });

    const memoryEvent = getEquipmentMemoryForDungeon('silent_broadcast_tower');
    expect(memoryEvent).toMatchObject({ eventId: 'last_broadcast', nodeId: 'broadcast_memory_stage' });
    expect(getLevelNode(dungeon, memoryEvent?.nodeId ?? '').type).toBe('reward');

    expect(content.MONSTERS.frequency_leech).toMatchObject({ maxHp: 430, attack: 58, artPower: 62, defense: 30, speed: 37, rewardPoints: 1690, drop: { silence_core: 1 } });
    expect(content.MONSTERS.dead_air_mimic).toMatchObject({ maxHp: 455, attack: 61, artPower: 68, defense: 31, speed: 34, rewardPoints: 1780, drop: { silence_core: 1, rift_dust: 1 } });
    expect(content.MONSTERS.broadcast_warden).toMatchObject({ maxHp: 500, attack: 65, artPower: 70, defense: 36, speed: 32, rewardPoints: 1910, drop: { silence_core: 2 } });
    expect(content.MONSTERS.last_broadcaster).toMatchObject({ maxHp: 585, attack: 70, artPower: 84, defense: 40, speed: 36, rewardPoints: 2280, drop: { silence_core: 3, method_page: 1 } });
    expect(getBossDefinition('silent_broadcast_tower')).toMatchObject({
      tier: 15, nodeId: 'last_broadcaster', monsterId: 'last_broadcaster'
    });
  });

  it('matches the locked Tier-16 shelter map, hosts, portals, rewards, and monsters', async () => {
    const content = await loadLevelContent();
    expect(content).not.toBeNull();
    if (!content) return;

    const dungeon = content.DUNGEONS.lost_shelter;
    const expectedRows = [
      ['evacuation_cache', 'north_supply_cache', 'north_rescue_patrol', 'north_checkpoint', 'shelter_enforcer_north', 'upper_return_portal'],
      ['north_entry', 'collapsed_hall_trap', 'survivor_cell', 'central_checkpoint', 'mimic_survivor_alpha', 'desperate_armory'],
      ['shelter_gate', 'alarm_grid_trap', 'survivor_memory_stage', 'shelter_overseer', 'command_lock', 'shelter_exit'],
      ['lower_entry', 'south_checkpoint', 'evacuation_horror_omega', 'emergency_medbay', 'containment_bay', 'lower_return_portal'],
      ['field_survey_archive', 'mimic_survivor', 'return_shelter_portal', 'south_supply_cache', 'soul_recharge_shelter', 'balanced_medbay']
    ] as const;

    expect(content.DUNGEON_ORDER.at(-4)).toBe('lost_shelter');
    expect(dungeon).toMatchObject({
      id: 'lost_shelter', name: '失联避难所', tier: 16, recommendedPower: 1040,
      grid: { width: 6, height: 5, startNodeId: 'shelter_gate' }
    });
    expect(dungeon.nodes).toHaveLength(30);
    expect(new Set(dungeon.nodes.map((node) => node.id)).size).toBe(30);
    for (const [y, row] of expectedRows.entries()) {
      for (const [x, nodeId] of row.entries()) {
        expect(getLevelNode(dungeon, nodeId).position, nodeId).toEqual({ x, y });
      }
    }
    expect(new Set(dungeon.nodes.map((node) => `${node.position.x},${node.position.y}`)).size).toBe(30);
    expect(getReachableNodeIds(dungeon).size).toBe(30);

    expect(['north_checkpoint', 'central_checkpoint', 'south_checkpoint'].map((id) => getLevelNode(dungeon, id).type)).toEqual([
      'reward', 'reward', 'reward'
    ]);
    for (const entryId of ['shelter_gate', 'north_entry', 'lower_entry']) {
      const entry = getLevelNode(dungeon, entryId);
      expect(entry.type, entryId).toBe('reward');
      expect(entry.reward?.items?.gate_sigil, entryId).toBe(1);
      expect(
        (entry.reward?.items?.healing_pill ?? 0) + (entry.reward?.items?.armor_patch ?? 0),
        entryId
      ).toBeGreaterThanOrEqual(1);
    }
    expect(['north_supply_cache', 'south_supply_cache'].map((id) => getLevelNode(dungeon, id).equipmentHuntClueId)).toEqual([
      'equipment_hunt_lost_shelter', 'equipment_hunt_lost_shelter'
    ]);
    expect(getLevelNode(dungeon, 'field_survey_archive').fieldSurveyId).toBe('survey_shelter_rescue_archive');
    expect(['evacuation_cache', 'desperate_armory'].map((id) => getLevelNode(dungeon, id).relicDraftId)).toEqual([
      'lost_shelter:evacuation:1', 'lost_shelter:desperate:2'
    ]);
    expect(getLevelNode(dungeon, 'soul_recharge_shelter').soulRechargeId).toBe('soul_node_shelter_recharge');
    expect(['north_rescue_patrol', 'mimic_survivor_alpha', 'mimic_survivor'].map((id) => getLevelNode(dungeon, id).monsterId)).toEqual([
      'mimic_survivor', 'mimic_survivor', 'mimic_survivor'
    ]);
    expect(getLevelNode(dungeon, 'shelter_enforcer_north').monsterId).toBe('shelter_enforcer');
    expect(getLevelNode(dungeon, 'evacuation_horror_omega').monsterId).toBe('evacuation_horror');
    expect(getLevelNode(dungeon, 'shelter_overseer').monsterId).toBe('shelter_overseer');

    const shelterTraps = ['collapsed_hall_trap', 'alarm_grid_trap', 'command_lock'].map((id) => getLevelNode(dungeon, id));
    expect(shelterTraps.map((node) => node.trap)).toEqual([
      { damage: 182, dc: 42, counterItem: 'armor_patch' },
      { damage: 186, dc: 43, counterItem: 'thunder_talisman' },
      { damage: 188, dc: 44, counterItem: 'focus_incense' }
    ]);
    expect(new Set(shelterTraps.map((node) => node.trap?.counterItem)).size).toBe(3);
    expect(getLevelNode(dungeon, 'soul_recharge_shelter')).toMatchObject({
      type: 'monster', monsterId: 'shelter_enforcer', soulRechargeId: 'soul_node_shelter_recharge'
    });
    expect(['upper_return_portal', 'lower_return_portal', 'return_shelter_portal'].map((id) => getLevelNode(dungeon, id).portal)).toEqual([
      { targetDungeonId: 'false_testimony_court', targetNodeId: 'north_entry', stableItem: 'gate_sigil' },
      { targetDungeonId: 'false_testimony_court', targetNodeId: 'lower_entry', stableItem: 'gate_sigil' },
      { targetDungeonId: 'false_testimony_court', targetNodeId: 'verdict_gate', stableItem: 'gate_sigil' }
    ]);
    expect(getLevelNode(dungeon, 'shelter_exit').reward).toEqual({
      rewardPoints: 1580, lingyun: 12,
      items: { rescue_badge: 4, method_page: 2, cycle_imprint: 1 }
    });

    const memoryEvent = getEquipmentMemoryForDungeon('lost_shelter');
    expect(memoryEvent).toMatchObject({ eventId: 'last_roll_call', nodeId: 'survivor_memory_stage' });
    expect(getLevelNode(dungeon, memoryEvent?.nodeId ?? '').type).toBe('reward');

    expect(content.MONSTERS.mimic_survivor).toMatchObject({ maxHp: 480, attack: 64, artPower: 72, defense: 33, speed: 38, rewardPoints: 1870, drop: { rescue_badge: 1 } });
    expect(content.MONSTERS.shelter_enforcer).toMatchObject({ maxHp: 510, attack: 68, artPower: 74, defense: 38, speed: 34, rewardPoints: 2000, drop: { rescue_badge: 2 } });
    expect(content.MONSTERS.evacuation_horror).toMatchObject({ maxHp: 555, attack: 72, artPower: 78, defense: 40, speed: 35, rewardPoints: 2150, drop: { rescue_badge: 2, rift_dust: 1 } });
    expect(content.MONSTERS.shelter_overseer).toMatchObject({ maxHp: 650, attack: 76, artPower: 90, defense: 44, speed: 38, rewardPoints: 2480, drop: { rescue_badge: 3, method_page: 1 } });
    expect(getBossDefinition('lost_shelter')).toMatchObject({
      tier: 16, nodeId: 'shelter_overseer', monsterId: 'shelter_overseer'
    });
  });

  it('matches the locked Tier-17 false testimony court map, hosts, portals, rewards, and monsters', async () => {
    const content = await loadLevelContent();
    expect(content).not.toBeNull();
    if (!content) return;

    const dungeon = content.DUNGEONS.false_testimony_court;
    const expectedRows = [
      ['truth_archive', 'voice_evidence', 'voice_filter_trap', 'north_entry', 'hostile_witness_north', 'upper_return_portal'],
      ['records_stacks', 'testimony_hall', 'timeline_evidence', 'timeline_checksum_trap', 'archive_censor_alpha', 'swift_judgment_armory'],
      ['verdict_gate', 'residue_sterility_trap', 'verdict_chamber', 'false_testimony_judge', 'judgment_lock', 'verdict_exit'],
      ['lower_entry', 'residue_evidence', 'perjury_hound_omega', 'appeal_desk', 'cross_exam_stage', 'lower_return_portal'],
      ['field_survey_archive', 'hostile_witness', 'return_testimony_portal', 'evidence_supply_cache', 'soul_recharge_verdict', 'false_verdict_vault']
    ] as const;

    expect(content.DUNGEON_ORDER.at(-3)).toBe('false_testimony_court');
    expect(dungeon).toMatchObject({
      id: 'false_testimony_court', name: '伪证裁定庭', tier: 17, recommendedPower: 1140,
      grid: { width: 6, height: 5, startNodeId: 'verdict_gate' }
    });
    expect(dungeon.nodes).toHaveLength(30);
    expect(new Set(dungeon.nodes.map((node) => node.id)).size).toBe(30);
    for (const [y, row] of expectedRows.entries()) {
      for (const [x, nodeId] of row.entries()) {
        expect(getLevelNode(dungeon, nodeId).position, nodeId).toEqual({ x, y });
      }
    }
    expect(new Set(dungeon.nodes.map((node) => `${node.position.x},${node.position.y}`)).size).toBe(30);
    expect(getReachableNodeIds(dungeon).size).toBe(30);

    expect(['voice_evidence', 'timeline_evidence', 'residue_evidence'].map((id) => getLevelNode(dungeon, id).type)).toEqual([
      'reward', 'reward', 'reward'
    ]);
    for (const entryId of ['verdict_gate', 'north_entry', 'lower_entry']) {
      const entry = getLevelNode(dungeon, entryId);
      expect(entry.type, entryId).toBe('reward');
      expect(entry.reward?.items?.gate_sigil, entryId).toBe(1);
    }
    expect(['records_stacks', 'evidence_supply_cache'].map((id) => getLevelNode(dungeon, id).equipmentHuntClueId)).toEqual([
      'equipment_hunt_false_testimony', 'equipment_hunt_false_testimony'
    ]);
    expect(getLevelNode(dungeon, 'field_survey_archive').fieldSurveyId).toBe('survey_false_testimony_archive');
    expect(['truth_archive', 'swift_judgment_armory'].map((id) => getLevelNode(dungeon, id).relicDraftId)).toEqual([
      'false_testimony_court:truth:1', 'false_testimony_court:swift:2'
    ]);
    expect(getLevelNode(dungeon, 'soul_recharge_verdict')).toMatchObject({
      type: 'monster', monsterId: 'archive_censor', soulRechargeId: 'soul_node_verdict_recharge'
    });

    const traps = ['voice_filter_trap', 'timeline_checksum_trap', 'residue_sterility_trap'].map((id) => getLevelNode(dungeon, id));
    expect(traps.map((node) => node.trap)).toEqual([
      { damage: 190, dc: 45, counterItem: 'focus_incense' },
      { damage: 198, dc: 46, counterItem: 'dispel_talisman' },
      { damage: 205, dc: 47, counterItem: 'armor_patch' }
    ]);
    expect(['upper_return_portal', 'lower_return_portal', 'return_testimony_portal'].map((id) => getLevelNode(dungeon, id).portal)).toEqual([
      { targetDungeonId: 'combat_replay_stage', targetNodeId: 'upper_entry', stableItem: 'gate_sigil' },
      { targetDungeonId: 'combat_replay_stage', targetNodeId: 'lower_entry', stableItem: 'gate_sigil' },
      { targetDungeonId: 'combat_replay_stage', targetNodeId: 'stage_gate', stableItem: 'gate_sigil' }
    ]);
    expect(getLevelNode(dungeon, 'verdict_exit').reward).toEqual({
      rewardPoints: 1690, lingyun: 13,
      items: { truth_fragment: 4, method_page: 2, cycle_imprint: 1 }
    });

    expect(content.MONSTERS.hostile_witness).toMatchObject({ maxHp: 520, drop: { truth_fragment: 1 } });
    expect(content.MONSTERS.archive_censor).toMatchObject({ maxHp: 550, drop: { truth_fragment: 2 } });
    expect(content.MONSTERS.perjury_hound).toMatchObject({ maxHp: 590, drop: { truth_fragment: 2, rift_dust: 1 } });
    expect(content.MONSTERS.false_testimony_judge).toMatchObject({ maxHp: 700, drop: { truth_fragment: 3, method_page: 1 } });
    expect(getBossDefinition('false_testimony_court')).toMatchObject({
      tier: 17, nodeId: 'false_testimony_judge', monsterId: 'false_testimony_judge'
    });
  });

  it('matches the locked Tier-18 combat replay map, hosts, portals, rewards, and monsters', async () => {
    const content = await loadLevelContent();
    expect(content).not.toBeNull();
    if (!content) return;

    const dungeon = content.DUNGEONS.combat_replay_stage;
    const expectedRows = [
      ['sequence_route', 'opening_prop_cache', 'opening_cue_trap', 'upper_entry', 'cue_stalker_north', 'upper_return_portal'],
      ['script_stacks', 'take_alpha', 'continuity_break_trap', 'take_beta', 'continuity_editor_alpha', 'burst_route'],
      ['stage_gate', 'blank_frame_trap', 'rehearsal_hall', 'take_gamma', 'final_cut_director', 'theater_exit'],
      ['lower_entry', 'projection_gallery', 'retake_double_omega', 'script_projection_stage', 'final_cut_lock', 'lower_return_portal'],
      ['field_survey_cutting_room', 'cue_stalker', 'return_rehearsal_portal', 'soul_recharge_stage', 'film_supply_cache', 'afterbeat_route']
    ] as const;

    expect(content.DUNGEON_ORDER.at(-2)).toBe('combat_replay_stage');
    expect(dungeon).toMatchObject({
      id: 'combat_replay_stage', name: '战痕复演场', tier: 18, recommendedPower: 1240,
      grid: { width: 6, height: 5, startNodeId: 'stage_gate' }
    });
    expect(dungeon.nodes).toHaveLength(30);
    expect(new Set(dungeon.nodes.map((node) => node.id)).size).toBe(30);
    for (const [y, row] of expectedRows.entries()) {
      for (const [x, nodeId] of row.entries()) {
        expect(getLevelNode(dungeon, nodeId).position, nodeId).toEqual({ x, y });
      }
    }
    expect(getReachableNodeIds(dungeon).size).toBe(30);

    expect(['take_alpha', 'take_beta', 'take_gamma'].map((id) => getLevelNode(dungeon, id).monsterId)).toEqual([
      'cue_stalker', 'continuity_editor', 'retake_double'
    ]);
    expect(['sequence_route', 'burst_route', 'afterbeat_route'].map((id) => getLevelNode(dungeon, id).reward)).toEqual([
      { rewardPoints: 520, items: { combat_reel: 1 } },
      { rewardPoints: 340, lingyun: 2, items: { combat_reel: 1 } },
      { rewardPoints: 180, items: { combat_reel: 2 } }
    ]);
    expect(['opening_cue_trap', 'continuity_break_trap', 'blank_frame_trap'].map((id) => getLevelNode(dungeon, id).trap?.counterItem)).toEqual([
      'focus_incense', 'dispel_talisman', 'armor_patch'
    ]);
    expect(['script_stacks', 'film_supply_cache'].map((id) => getLevelNode(dungeon, id).equipmentHuntClueId)).toEqual([
      'equipment_hunt_combat_replay_stage', 'equipment_hunt_combat_replay_stage'
    ]);
    expect(getLevelNode(dungeon, 'field_survey_cutting_room').fieldSurveyId).toBe('survey_combat_replay_cutting_room');
    expect(['projection_gallery', 'rehearsal_hall'].map((id) => getLevelNode(dungeon, id).relicDraftId)).toEqual([
      'combat_replay_stage:sequence:1', 'combat_replay_stage:afterbeat:2'
    ]);
    expect(getLevelNode(dungeon, 'soul_recharge_stage')).toMatchObject({
      type: 'monster', monsterId: 'continuity_editor', soulRechargeId: 'soul_node_combat_replay_recharge'
    });
    expect(getDungeonEvents('combat_replay_stage').map((event) => [event.id, event.nodeId])).toEqual([
      ['uncredited_take', 'rehearsal_hall'],
      ['last_retake', 'script_projection_stage']
    ]);
    expect(['upper_return_portal', 'lower_return_portal', 'return_rehearsal_portal'].map((id) => getLevelNode(dungeon, id).portal)).toEqual([
      { targetDungeonId: 'panopticon_city', targetNodeId: 'upper_entry', stableItem: 'gate_sigil' },
      { targetDungeonId: 'panopticon_city', targetNodeId: 'lower_entry', stableItem: 'gate_sigil' },
      { targetDungeonId: 'panopticon_city', targetNodeId: 'panopticon_gate', stableItem: 'gate_sigil' }
    ]);
    expect(getLevelNode(dungeon, 'theater_exit').reward).toEqual({
      rewardPoints: 1800, lingyun: 14,
      items: { combat_reel: 4, method_page: 2, cycle_imprint: 1 }
    });

    expect(content.MONSTERS.cue_stalker).toMatchObject({ maxHp: 560, attack: 80, artPower: 92, defense: 42, speed: 42, rewardPoints: 2280 });
    expect(content.MONSTERS.continuity_editor).toMatchObject({ maxHp: 590, attack: 84, artPower: 98, defense: 45, speed: 37, rewardPoints: 2400 });
    expect(content.MONSTERS.retake_double).toMatchObject({ maxHp: 630, attack: 88, artPower: 102, defense: 47, speed: 40, rewardPoints: 2540 });
    expect(content.MONSTERS.final_cut_director).toMatchObject({ maxHp: 750, attack: 92, artPower: 110, defense: 52, speed: 42, rewardPoints: 2900 });
    expect(getBossDefinition('combat_replay_stage')).toMatchObject({
      tier: 18, nodeId: 'final_cut_director', monsterId: 'final_cut_director'
    });
  });

  it('matches the locked Tier-19 panopticon map, ecology hosts, portals, rewards, and monsters', async () => {
    const content = await loadLevelContent();
    expect(content).not.toBeNull();
    if (!content) return;

    const dungeon = content.DUNGEONS.panopticon_city;
    const expectedRows = [
      ['shadow_route', 'blindline_archive', 'north_blind_relay', 'upper_entry', 'sweep_sentinel_north', 'upper_return_portal'],
      ['all_sight_lock', 'blindspot_theater', 'scan_lattice_trap', 'central_blind_relay', 'blindspot_auditor_north', 'decoy_route'],
      ['panopticon_gate', 'watchglass_cache', 'exposure_double_patrol', 'south_blind_relay', 'all_sight_warden', 'blind_dawn_exit'],
      ['lower_entry', 'matte_supply', 'blind_angle_trap', 'refraction_lab', 'spectrum_switchyard', 'lower_return_portal'],
      ['inverse_observation_stage', 'sweep_sentinel', 'refraction_return_portal', 'soul_recharge_panopticon', 'exposure_double', 'refraction_route']
    ] as const;

    expect(content.DUNGEON_ORDER.at(-1)).toBe('panopticon_city');
    expect(dungeon).toMatchObject({
      id: 'panopticon_city', name: '天幕监察城', tier: 19, recommendedPower: 1350,
      grid: { width: 6, height: 5, startNodeId: 'panopticon_gate' }
    });
    expect(dungeon.nodes).toHaveLength(30);
    expect(new Set(dungeon.nodes.map((node) => node.id)).size).toBe(30);
    for (const [y, row] of expectedRows.entries()) {
      for (const [x, nodeId] of row.entries()) {
        expect(getLevelNode(dungeon, nodeId).position, nodeId).toEqual({ x, y });
      }
    }
    expect(getReachableNodeIds(dungeon).size).toBe(30);
    expect(['upper_entry', 'panopticon_gate', 'lower_entry'].map((id) => getLevelNode(dungeon, id).reward?.items?.gate_sigil)).toEqual([1, 1, 1]);
    expect(['watchglass_cache', 'matte_supply'].map((id) => getLevelNode(dungeon, id).equipmentHuntClueId)).toEqual([
      'equipment_hunt_panopticon_city', 'equipment_hunt_panopticon_city'
    ]);
    expect(getLevelNode(dungeon, 'refraction_lab').fieldSurveyId).toBe('survey_panopticon_refraction_lab');
    expect(['blindline_archive', 'inverse_observation_stage'].map((id) => getLevelNode(dungeon, id).relicDraftId)).toEqual([
      'panopticon_city:blindline:1', 'panopticon_city:inverse:2'
    ]);
    expect(getLevelNode(dungeon, 'soul_recharge_panopticon')).toMatchObject({
      type: 'monster', monsterId: 'blindspot_auditor', soulRechargeId: 'soul_node_panopticon_recharge'
    });
    expect(['upper_return_portal', 'lower_return_portal', 'refraction_return_portal'].map((id) => getLevelNode(dungeon, id).portal)).toEqual([
      { targetDungeonId: 'demon_tower_1', targetNodeId: 'sealed_cache', stableItem: 'gate_sigil' },
      { targetDungeonId: 'demon_tower_1', targetNodeId: 'fog_lesser_demon', stableItem: 'gate_sigil' },
      { targetDungeonId: 'demon_tower_1', targetNodeId: 'quiet_prayer_reward', stableItem: 'gate_sigil' }
    ]);
    expect(content.MONSTERS.sweep_sentinel).toMatchObject({ maxHp: 600 });
    expect(content.MONSTERS.blindspot_auditor).toMatchObject({ maxHp: 640 });
    expect(content.MONSTERS.exposure_double).toMatchObject({ maxHp: 680 });
    expect(content.MONSTERS.all_sight_warden).toMatchObject({
      maxHp: 810, attack: 100, artPower: 120, defense: 56, speed: 44
    });
    expect(getBossDefinition('panopticon_city')).toMatchObject({
      tier: 19, nodeId: 'all_sight_warden', monsterId: 'all_sight_warden'
    });
  });
});

describe('run pursuit authored catalog', () => {
  it('references real reachable nodes and real material rewards in every dungeon', async () => {
    const content = await loadLevelContent();
    const pursuitModule = await import('./run-pursuit');
    const gameModule = await import('./game');

    expect(content).not.toBeNull();
    if (!content) return;

    expect(Object.keys(pursuitModule.RUN_PURSUIT_CATALOG).sort()).toEqual(
      [...content.DUNGEON_ORDER].sort()
    );

    for (const dungeonId of content.DUNGEON_ORDER) {
      const dungeon = content.DUNGEONS[dungeonId];
      const definition = pursuitModule.getRunPursuitDefinition(dungeonId);
      const reachableNodeIds = getReachableNodeIds(dungeon);

      expect(definition, dungeonId).toBeDefined();
      if (!definition) throw new Error(`Missing run pursuit definition for ${dungeonId}`);

      const spawnNode = dungeon.nodes.find((node) => node.id === definition.spawnNodeId);
      const containmentNode = dungeon.nodes.find((node) => node.id === definition.containmentNodeId);
      const material = gameModule.ITEMS[definition.materialId];

      expect(spawnNode, `${dungeonId}:spawn`).toBeDefined();
      expect(containmentNode, `${dungeonId}:containment`).toBeDefined();
      expect(containmentNode?.type, `${dungeonId}:containment-stays-in-dungeon`).not.toBe('portal');
      expect(containmentNode?.type, `${dungeonId}:containment-precedes-exit`).not.toBe('exit');
      expect(definition.spawnNodeId, dungeonId).not.toBe(definition.containmentNodeId);
      expect(reachableNodeIds.has(definition.spawnNodeId), `${dungeonId}:spawn-reachable`).toBe(true);
      expect(
        reachableNodeIds.has(definition.containmentNodeId),
        `${dungeonId}:containment-reachable`
      ).toBe(true);
      expect(material, `${dungeonId}:${definition.materialId}`).toBeDefined();
      expect(material?.kind, `${dungeonId}:${definition.materialId}`).toBe('material');
      expect(definition.rewardAmount, dungeonId).toBe(1);
      expect(definition.contactDamagePercent, dungeonId).toBe(15);
      expect(definition.bossFusionPercent, dungeonId).toBe(15);
      expect(definition.spawnClearCount, dungeonId).toBe(6);
      expect(definition.flavorDescription.length, dungeonId).toBeGreaterThan(12);
      expect(definition.fusionDescription.length, dungeonId).toBeGreaterThan(12);
    }
  });
});
