import { describe, expect, it } from 'vitest';

import { getBossDefinition } from './boss-system';
import { createDungeonLawState, recordCombatReplayTake, resolveAuctionLotChoice, resolveBroadcastRelayChoice, resolveEscortCheckpointChoice, resolveGenesisSpliceChoice, resolveMirrorCityPhaseChoice, resolveRedactionClauseChoice, signalFirstNodeClear } from './dungeon-laws';
import { getRouteBlockReason } from './dungeon-routes';
import type { DungeonId, DungeonNode } from './game';
import { createInfernoMapSnapshot, getInfernoConnectionIds } from './inferno-system';
import { DUNGEONS, DUNGEON_ORDER } from './level-content';
import {
  ROUTE_CONTRACT_CATALOG,
  ROUTE_CONTRACT_RULES_VERSION,
  HIDDEN_ROUTE_CONTRACT_TRIGGER_PROBABILITY,
  createRouteContractRunState,
  discoverHiddenRouteContract,
  getRouteContractById,
  getRouteContractDisplayStatus,
  getRouteContractProgress,
  isOrderedRouteContractReachable,
  isRouteContractDefinition,
  isRouteContractRunState,
  listRouteContracts,
  markRouteContractLost,
  normalizeRouteContractRunState,
  settleRouteContractExit,
  settleRouteContractRun,
  transitionRouteContractFirstClear,
  type RouteContractDefinition,
  type RouteContractRunState
} from './route-contracts';

const LEGAL_ROUTE_WITNESSES: Readonly<Record<string, readonly string[]>> = {
  tower_mist_watch: ['fog_lesser_demon', 'broken_sigil_reward', 'watch_post_cache', 'upper_fog_patrol', 'left_watch_trap', 'blood_rune_trap', 'demon_bone_cache', 'lower_fog_lesser', 'risky_font_trap'],
  tower_ash_blade: ['fog_lesser_demon', 'ash_pit_trap', 'fog_lesser_demon', 'broken_sigil_reward', 'watch_post_cache', 'upper_fog_patrol', 'loose_tile_trap', 'north_supply_niche', 'butcher_turn'],
  tower_lower_hunt: ['fog_lesser_demon', 'blood_rune_trap', 'demon_bone_cache', 'tower_butcher_patrol', 'demon_bone_cache', 'blood_rune_trap', 'left_watch_trap', 'upper_fog_patrol', 'loose_tile_trap'],
  metro_wraith_return: ['platform_arrival', 'lampbox_reward', 'reflection_fork', 'rail_patrol_wraith', 'reflection_fork', 'tide_boatman', 'boatman_echo', 'rail_wraith', 'mirror_web_cache', 'thread_snare_trap', 'tide_boatman_reflection'],
  metro_flood_reflection: ['platform_arrival', 'tide_boatman', 'boatman_echo', 'rail_wraith', 'mirror_web_cache', 'thread_snare_trap', 'tide_boatman_reflection', 'flooded_escalator_trap', 'gate_sigil_kiosk', 'wet_ticket_hall', 'signal_cache', 'north_floodgate_trap', 'coin_turnstile', 'rail_patrol_wraith', 'reflection_fork'],
  metro_relay_floodgate: ['platform_arrival', 'tide_boatman', 'boatman_echo', 'rail_wraith', 'mirror_web_cache', 'rail_wraith_relay', 'echo_coin_vendor', 'rail_wraith', 'boatman_echo', 'tide_boatman', 'reflection_fork', 'rail_patrol_wraith', 'coin_turnstile', 'north_floodgate_trap'],
  mine_roost_inversion: ['mine_arrival', 'shell_patrol_alpha', 'rail_chain_cache', 'tilted_gravity_switch', 'spark_imp_roost', 'tilted_gravity_switch', 'rail_chain_cache', 'shell_patrol_alpha', 'mine_arrival', 'inverted_shaft_trap'],
  mine_ore_shell: ['mine_arrival', 'mine_shell_guard', 'magnetic_rail_trap', 'coil_burst_trap', 'molt_beast_patrol', 'rail_map_reward', 'falling_ore_trap', 'east_ore_cache', 'rift_beast', 'static_dust_trap', 'resonant_pick_reward', 'spark_imp_switchback', 'star_core_reward', 'shell_guard_beta'],
  mine_dust_switch: ['mine_arrival', 'mine_shell_guard', 'magnetic_rail_trap', 'spark_imp_switchback', 'resonant_pick_reward', 'static_dust_trap', 'rift_beast', 'rail_map_reward', 'molt_beast_patrol', 'north_star_vein', 'spark_imp_roost', 'tilted_gravity_switch'],
  hospital_orderly_sterilizer: ['triage_reward', 'medicine_cabinet', 'plague_orderly', 'rust_gurney_trap', 'disinfectant_mist_trap', 'pharmacy_reward', 'sterilizer_trap'],
  hospital_roof_rounds: ['triage_reward', 'medicine_cabinet', 'plague_orderly', 'rust_gurney_trap', 'disinfectant_mist_trap', 'pharmacy_reward', 'sterilizer_trap', 'roof_access_trap', 'sterilizer_trap', 'pharmacy_reward', 'disinfectant_mist_trap', 'sterile_corridor', 'ward_orderly_patrol'],
  hospital_patrol_gurney: ['triage_reward', 'medicine_cabinet', 'plague_orderly', 'sterile_corridor', 'disinfectant_mist_trap', 'pulse_doctor', 'doctor_patrol_route', 'pulse_doctor', 'isolation_chart_reward', 'rust_gurney_trap'],
  arena_duelist_gutter: ['arena_gate', 'odds_marker', 'ash_duelist', 'ember_pit_duelist', 'oath_cinders', 'ember_sentinel', 'smoke_gutter'],
  arena_penalty_ringbreaker: ['arena_gate', 'odds_marker', 'ash_duelist', 'ember_pit_duelist', 'oath_cinders', 'ember_sentinel', 'smoke_gutter', 'champion_branch_reward', 'penalty_fire', 'champion_branch_reward', 'smoke_gutter', 'ember_sentinel', 'ringbreaker_duelist'],
  arena_lancer_white_step: ['arena_gate', 'odds_marker', 'repeat_brazier', 'cinder_lancer', 'ringbreaker_duelist', 'ember_sentinel', 'smoke_gutter', 'champion_branch_reward', 'white_step_tax'],
  archive_librarian_record: ['index_reward', 'failed_file_reward', 'paper_librarian', 'failed_file_reward', 'hallucination_patrol', 'footnote_cache_reward', 'overwritten_record_trap'],
  archive_paper_jailer: ['index_reward', 'failed_file_reward', 'hallucination_patrol', 'footnote_cache_reward', 'overwritten_record_trap', 'paper_cut_trap', 'overwritten_record_trap', 'footnote_cache_reward', 'hallucination_patrol', 'memory_loop_trap', 'blank_shelf_reward', 'dream_jailer'],
  archive_afterimage_margin: ['index_reward', 'failed_file_reward', 'paper_librarian', 'memory_loop_trap', 'blank_shelf_reward', 'ink_sleep_trap', 'hallucination_patrol_two', 'ink_sleep_trap', 'blank_shelf_reward', 'margin_snare_trap'],
  citadel_knight_shadow: ['citadel_gate', 'gate_oath_cache', 'void_knight', 'gate_oath_cache', 'first_echo_patrol', 'broken_name_trap', 'second_echo_patrol', 'self_shadow_trap'],
  citadel_memory_guard: ['citadel_gate', 'gate_oath_cache', 'first_echo_patrol', 'broken_name_trap', 'second_echo_patrol', 'armor_memory_trap', 'second_echo_patrol', 'self_shadow_trap', 'method_page_reward', 'balance_reward', 'mirror_supply', 'echo_gate_guard'],
  citadel_shard_name: ['citadel_gate', 'gate_oath_cache', 'void_knight', 'growth_mirror_trap', 'mirror_supply', 'balance_reward', 'method_page_reward', 'echo_core_shard', 'method_page_reward', 'self_shadow_trap', 'second_echo_patrol', 'broken_name_trap'],
  temporal_epoch_recharge: ['temporal_gate', 'entry_chronometer', 'past_clue_cache', 'epoch_sentinel_alpha', 'past_calibration_anchor', 'past_relic_archive', 'field_observation_deck', 'calibration_bridge', 'soul_recharge_chamber'],
  temporal_unborn_erased: ['temporal_gate', 'clockwork_scout', 'zero_meridian', 'calibration_bridge', 'soul_recharge_chamber', 'boss_south_lock', 'unborn_gear_trap', 'boss_south_lock', 'soul_recharge_chamber', 'calibration_bridge', 'field_observation_deck', 'erased_patrol'],
  temporal_north_acceleration: ['temporal_gate', 'clockwork_scout', 'zero_meridian', 'erased_patrol', 'field_observation_deck', 'boss_north_lock', 'field_observation_deck', 'erased_patrol', 'zero_meridian', 'accelerated_patrol'],
  causal_alpha_recharge: ['clearinghouse_gate', 'entry_docket', 'cause_clue_cache', 'paradox_bailiff_alpha', 'cause_deposition', 'cause_bailiff', 'contradiction_line', 'verdict_bridge', 'soul_recharge_chamber'],
  causal_sentence_bailiff: ['clearinghouse_gate', 'effect_supply', 'effect_clue_cache', 'paradox_bailiff_omega', 'effect_deposition', 'effect_relic_archive', 'prospective_sentence_trap', 'effect_relic_archive', 'effect_deposition', 'effect_bailiff', 'contradiction_line', 'cause_bailiff'],
  causal_effect_verdict: ['clearinghouse_gate', 'effect_supply', 'effect_foyer', 'effect_bailiff', 'soul_recharge_chamber', 'verdict_bridge', 'evidence_survey_dais', 'north_verdict_lock'],
  entropy_deckhand_recharge: ['ark_gate', 'entropy_deckhand', 'wake_inversion', 'ark_manifest', 'soul_recharge_chamber'],
  entropy_wake_ballast: ['ark_gate', 'entropy_deckhand', 'wake_inversion', 'port_ballast_core'],
  entropy_navigator_lock: ['ark_gate', 'port_supply', 'port_clue_cache', 'dissipation_navigator_alpha', 'entropy_deckhand_port', 'entropy_deckhand', 'wake_inversion', 'ark_manifest', 'last_helmsman'],
  mirror_hunter_recharge: ['cycle_gate', 'real_supply_alcove', 'real_clue_vault', 'parallax_hunter_real', 'mirror_chorus_real', 'parallax_hunter_spine', 'second_phase_mirror', 'mirror_anchor', 'soul_recharge_mirror'],
  mirror_shard_fracture: ['cycle_gate', 'real_supply_alcove', 'real_clue_vault', 'parallax_hunter_real', 'first_phase_mirror', 'real_relic_gallery', 'shard_rain_trap', 'real_relic_gallery', 'mirror_city_survey', 'real_anchor', 'mirror_chorus_real', 'parallax_hunter_spine', 'second_phase_mirror', 'mirror_anchor', 'soul_recharge_mirror', 'third_phase_mirror', 'identity_fracture_trap'],
  mirror_chorus_rehearsal: ['cycle_gate', 'real_supply_alcove', 'real_clue_vault', 'parallax_hunter_real', 'first_phase_mirror', 'real_relic_gallery', 'shard_rain_trap', 'parallax_corridor_trap', 'mirror_chorus_upper', 'parallax_corridor_trap', 'mirror_city_survey', 'real_anchor', 'mirror_chorus_real', 'parallax_hunter_spine', 'second_phase_mirror', 'mirror_anchor', 'mirror_chorus_mirror', 'parallax_hunter_mirror', 'reflection_event_stage'],
  redaction_copyist_recharge: ['folio_gate', 'margin_scribe_spine', 'memory_clause_desk', 'severed_sentence_trap', 'erasure_copyist_north', 'body_relic_gallery', 'erasure_copyist_alpha', 'final_proof_nexus', 'errata_event_stage', 'return_relic_gallery', 'soul_recharge_scriptorium'],
  redaction_sentence_south_lock: ['folio_gate', 'margin_scribe_spine', 'memory_clause_desk', 'severed_sentence_trap', 'erasure_copyist_alpha', 'final_proof_nexus', 'errata_event_stage', 'boss_south_lock'],
  redaction_censor_errata: ['folio_gate', 'margin_scribe_spine', 'memory_clause_desk', 'severed_sentence_trap', 'erasure_copyist_alpha', 'body_relic_gallery', 'palimpsest_censor_alpha', 'body_relic_gallery', 'erasure_copyist_alpha', 'final_proof_nexus', 'errata_event_stage'],
  legacy_reserve_recharge: ['estate_gate', 'catalog_bailiff', 'provenance_event_stage', 'hammerfall_trap', 'inheritance_mimic_alpha', 'reserve_bailiff_north', 'inheritance_mimic_north', 'guard_lot_dais', 'boss_side_rostrum', 'return_lot_dais', 'soul_recharge_auction'],
  legacy_hammerfall_rostrum: ['estate_gate', 'catalog_bailiff', 'provenance_event_stage', 'hammerfall_trap', 'inheritance_mimic_alpha', 'guard_lot_dais', 'boss_side_rostrum'],
  legacy_mimic_testimony: ['estate_gate', 'catalog_bailiff', 'provenance_event_stage', 'hammerfall_trap', 'inheritance_mimic_alpha', 'guard_lot_dais', 'boss_side_rostrum', 'return_lot_dais', 'dead_team_testimony_stage'],
  genesis_stalker_recharge: ['genesis_gate', 'lower_serum_supply', 'third_splice_console', 'mutation_guardian_omega', 'lineage_event_stage', 'genome_repair_station', 'boss_side_lock', 'second_splice_console', 'mutation_guardian_north', 'gene_stalker_north', 'mutation_guardian_north', 'second_splice_console', 'boss_side_lock', 'genome_repair_station', 'soul_recharge_genesis'],
  genesis_helix_side_lock: ['genesis_gate', 'bloodline_survey_archive', 'first_splice_console', 'helix_collapse_trap', 'gene_stalker_alpha', 'second_splice_console', 'boss_side_lock'],
  genesis_guardian_lineage: ['genesis_gate', 'lower_serum_supply', 'third_splice_console', 'mutation_guardian_omega', 'lineage_event_stage'],
  broadcast_leech_recharge: ['broadcast_gate', 'north_entry', 'north_relay_console', 'acoustic_tripwire', 'north_signal_cache', 'frequency_leech_north', 'broadcast_warden_north', 'central_relay_console', 'studio_side_lock', 'anechoic_chamber', 'soul_recharge_broadcast'],
  broadcast_tripwire_studio_lock: ['broadcast_gate', 'north_entry', 'north_relay_console', 'acoustic_tripwire', 'dead_air_gallery', 'central_relay_console', 'studio_side_lock'],
  broadcast_warden_anechoic: ['broadcast_gate', 'lower_entry', 'south_relay_console', 'broadcast_warden_omega', 'emergency_shelter', 'anechoic_chamber'],
  shelter_patrol_recharge: ['shelter_gate', 'north_entry', 'collapsed_hall_trap', 'survivor_cell', 'north_rescue_patrol', 'survivor_cell', 'central_checkpoint', 'mimic_survivor_alpha', 'command_lock', 'containment_bay', 'soul_recharge_shelter'],
  shelter_collapse_command: ['shelter_gate', 'north_entry', 'collapsed_hall_trap', 'survivor_cell', 'central_checkpoint', 'mimic_survivor_alpha', 'command_lock'],
  shelter_horror_containment: ['shelter_gate', 'lower_entry', 'south_checkpoint', 'evacuation_horror_omega', 'emergency_medbay', 'containment_bay'],
  testimony_witness_recharge: ['north_entry', 'hostile_witness_north', 'archive_censor_alpha', 'judgment_lock', 'cross_exam_stage', 'soul_recharge_verdict'],
  testimony_voice_judgment: ['north_entry', 'voice_filter_trap', 'north_entry', 'hostile_witness_north', 'archive_censor_alpha', 'judgment_lock'],
  testimony_hound_hall: ['lower_entry', 'verdict_gate', 'residue_sterility_trap', 'residue_evidence', 'perjury_hound_omega', 'residue_evidence', 'lower_entry', 'verdict_gate', 'records_stacks', 'testimony_hall'],
  replay_stalker_recharge: ['stage_gate', 'script_stacks', 'take_alpha', 'continuity_break_trap', 'take_beta', 'continuity_editor_alpha', 'cue_stalker_north', 'upper_entry', 'opening_cue_trap', 'continuity_break_trap', 'rehearsal_hall', 'take_gamma', 'script_projection_stage', 'soul_recharge_stage'],
  replay_opening_final_lock: ['stage_gate', 'script_stacks', 'take_alpha', 'continuity_break_trap', 'opening_cue_trap', 'continuity_break_trap', 'take_beta', 'take_gamma', 'script_projection_stage', 'final_cut_lock'],
  replay_double_prop_cache: ['stage_gate', 'lower_entry', 'projection_gallery', 'retake_double_omega', 'projection_gallery', 'lower_entry', 'stage_gate', 'script_stacks', 'take_alpha', 'opening_prop_cache'],
  panopticon_north_recharge: ['panopticon_gate', 'watchglass_cache', 'exposure_double_patrol', 'south_blind_relay', 'central_blind_relay', 'scan_lattice_trap', 'north_blind_relay', 'scan_lattice_trap', 'central_blind_relay', 'south_blind_relay', 'refraction_lab', 'soul_recharge_panopticon'],
  panopticon_central_lock: ['panopticon_gate', 'watchglass_cache', 'exposure_double_patrol', 'south_blind_relay', 'central_blind_relay', 'scan_lattice_trap', 'blindspot_theater', 'all_sight_lock'],
  panopticon_south_inverse: ['panopticon_gate', 'watchglass_cache', 'exposure_double_patrol', 'south_blind_relay', 'exposure_double_patrol', 'watchglass_cache', 'matte_supply', 'sweep_sentinel', 'inverse_observation_stage']
};

const ROUTE_ENTRY_OVERRIDES: Readonly<Record<string, string>> = {
  testimony_witness_recharge: 'north_entry',
  testimony_voice_judgment: 'north_entry',
  testimony_hound_hall: 'lower_entry'
};

const MIRROR_ROUTE_PHASE_CHOICES = {
  first_phase_mirror: 'real',
  second_phase_mirror: 'mirror',
  third_phase_mirror: 'mirror'
} as const;

function getNode(definition: RouteContractDefinition, nodeId: string): DungeonNode {
  const node = DUNGEONS[definition.dungeonId].nodes.find((candidate) => candidate.id === nodeId);
  if (!node) throw new Error(`Missing ${definition.dungeonId} node ${nodeId}.`);
  return node;
}

function createTestState(): RouteContractRunState {
  const state = createRouteContractRunState(ROUTE_CONTRACT_CATALOG[0]);
  if (!state) throw new Error('Expected the catalog definition to create a state.');
  return state;
}

describe('route contracts catalog', () => {
  it('defines exactly three immutable contracts for all nineteen dungeons', () => {
    expect(ROUTE_CONTRACT_RULES_VERSION).toBe(1);
    expect(DUNGEON_ORDER).toHaveLength(19);
    expect(ROUTE_CONTRACT_CATALOG).toHaveLength(57);
    expect(Object.isFrozen(ROUTE_CONTRACT_CATALOG)).toBe(true);

    const ids = new Set<string>();
    for (const dungeonId of DUNGEON_ORDER) {
      const definitions = listRouteContracts(dungeonId);
      expect(definitions).toHaveLength(3);
      expect(Object.isFrozen(definitions)).toBe(true);
      for (const definition of definitions) {
        expect(definition.dungeonId).toBe(dungeonId);
        expect(definition.name.length).toBeGreaterThan(0);
        expect(definition.description.length).toBeGreaterThan(0);
        expect(Object.isFrozen(definition)).toBe(true);
        expect(Object.isFrozen(definition.targetNodeIds)).toBe(true);
        expect(ids.has(definition.id)).toBe(false);
        expect(isRouteContractDefinition({ ...definition, targetNodeIds: [...definition.targetNodeIds] })).toBe(true);
        ids.add(definition.id);
      }
    }
    expect(ids.size).toBe(57);
  });

  it('defines the three causal contracts with the exact ordered targets and Tier-9 reward', () => {
    expect(listRouteContracts('causal_clearinghouse')).toEqual([
      expect.objectContaining({
        id: 'causal_alpha_recharge',
        targetNodeIds: ['paradox_bailiff_alpha', 'soul_recharge_chamber'],
        rewardPoints: 415
      }),
      expect.objectContaining({
        id: 'causal_sentence_bailiff',
        targetNodeIds: ['prospective_sentence_trap', 'cause_bailiff'],
        rewardPoints: 415
      }),
      expect.objectContaining({
        id: 'causal_effect_verdict',
        targetNodeIds: ['effect_bailiff', 'north_verdict_lock'],
        rewardPoints: 415
      })
    ]);
  });

  it('defines the three entropy contracts with exact 1-to-2 targets and Tier-10 rewards', () => {
    expect(listRouteContracts('entropy_ark')).toEqual([
      expect.objectContaining({ id: 'entropy_deckhand_recharge', targetNodeIds: ['entropy_deckhand', 'soul_recharge_chamber'], rewardPoints: 450 }),
      expect.objectContaining({ id: 'entropy_wake_ballast', targetNodeIds: ['wake_inversion', 'port_ballast_core'], rewardPoints: 450 }),
      expect.objectContaining({ id: 'entropy_navigator_lock', targetNodeIds: ['dissipation_navigator_alpha', 'last_helmsman'], rewardPoints: 450 })
    ]);
  });

  it('defines the three mirror-city contracts with exact ordered targets and Tier-11 rewards', () => {
    expect(listRouteContracts('mirror_cycle_city')).toEqual([
      expect.objectContaining({ id: 'mirror_hunter_recharge', targetNodeIds: ['parallax_hunter_real', 'soul_recharge_mirror'], rewardPoints: 485 }),
      expect.objectContaining({ id: 'mirror_shard_fracture', targetNodeIds: ['shard_rain_trap', 'identity_fracture_trap'], rewardPoints: 485 }),
      expect.objectContaining({ id: 'mirror_chorus_rehearsal', targetNodeIds: ['mirror_chorus_upper', 'reflection_event_stage'], rewardPoints: 485 })
    ]);
  });

  it('defines the three redaction contracts with exact ordered targets and Tier-12 rewards', () => {
    expect(listRouteContracts('redaction_scriptorium')).toEqual([
      expect.objectContaining({ id: 'redaction_copyist_recharge', name: '北抄重订', targetNodeIds: ['erasure_copyist_north', 'soul_recharge_scriptorium'], rewardPoints: 520 }),
      expect.objectContaining({ id: 'redaction_sentence_south_lock', name: '断句验锁', targetNodeIds: ['severed_sentence_trap', 'boss_south_lock'], rewardPoints: 520 }),
      expect.objectContaining({ id: 'redaction_censor_errata', name: '覆页勘误', targetNodeIds: ['palimpsest_censor_alpha', 'errata_event_stage'], rewardPoints: 520 })
    ]);
  });

  it('defines the three legacy-auction contracts with exact ordered targets and Tier-13 rewards', () => {
    expect(listRouteContracts('legacy_auction_court')).toEqual([
      expect.objectContaining({ id: 'legacy_reserve_recharge', name: '北席保价', targetNodeIds: ['reserve_bailiff_north', 'soul_recharge_auction'], rewardPoints: 560 }),
      expect.objectContaining({ id: 'legacy_hammerfall_rostrum', name: '落槌登席', targetNodeIds: ['hammerfall_trap', 'boss_side_rostrum'], rewardPoints: 560 }),
      expect.objectContaining({ id: 'legacy_mimic_testimony', name: '伪产作证', targetNodeIds: ['inheritance_mimic_alpha', 'dead_team_testimony_stage'], rewardPoints: 560 })
    ]);
  });

  it('defines the three genesis contracts with exact Chinese objectives, ordered targets, and Tier-14 rewards', () => {
    expect(listRouteContracts('genesis_vault')).toEqual([
      expect.objectContaining({
        id: 'genesis_stalker_recharge',
        name: '北猎复育',
        description: '先击退北廊基因猎犬，再抵达器魂复育槽完成重组，让装备免于被重复战斗表达同化。',
        targetNodeIds: ['gene_stalker_north', 'soul_recharge_genesis'],
        rewardPoints: 600
      }),
      expect.objectContaining({
        id: 'genesis_helix_side_lock',
        name: '螺旋验锁',
        description: '先穿过螺旋坍缩阱，再前往典藏侧锁完成自我校验，证明外来组织未污染归档序列。',
        targetNodeIds: ['helix_collapse_trap', 'boss_side_lock'],
        rewardPoints: 600
      }),
      expect.objectContaining({
        id: 'genesis_guardian_lineage',
        name: '终代溯祖',
        description: '先击退终代变异守库体，再到谱系演化台承认祖型回声，让成熟变异取得可核验的来源。',
        targetNodeIds: ['mutation_guardian_omega', 'lineage_event_stage'],
        rewardPoints: 600
      })
    ]);
  });

  it('defines the three broadcast contracts with exact Chinese objectives, ordered targets, and Tier-15 rewards', () => {
    expect(listRouteContracts('silent_broadcast_tower')).toEqual([
      expect.objectContaining({
        id: 'broadcast_leech_recharge',
        name: '寄频续魂',
        description: '先清除北廊频段寄生体，再抵达器魂静默充能舱完成净频，让器魂不再被重复攻势啃噬。',
        targetNodeIds: ['frequency_leech_north', 'soul_recharge_broadcast'],
        rewardPoints: 650
      }),
      expect.objectContaining({
        id: 'broadcast_tripwire_studio_lock',
        name: '声纹验锁',
        description: '先穿过声纹绊线阵，再前往主播播间侧锁完成意识校准，证明借声频道未能复制本次通行频谱。',
        targetNodeIds: ['acoustic_tripwire', 'studio_side_lock'],
        rewardPoints: 650
      }),
      expect.objectContaining({
        id: 'broadcast_warden_anechoic',
        name: '终卫归静',
        description: '先击退终段广播守卫，再进入全消声室封存残余频道，让守卫的反击脉冲失去广播出口。',
        targetNodeIds: ['broadcast_warden_omega', 'anechoic_chamber'],
        rewardPoints: 650
      })
    ]);
  });

  it('defines the three shelter contracts with exact Chinese objectives, ordered targets, and Tier-16 rewards', () => {
    expect(listRouteContracts('lost_shelter')).toEqual([
      expect.objectContaining({
        id: 'shelter_patrol_recharge',
        name: '北巡续援',
        description: '先摧毁北区失控哨戒炮，再抵达器魂救援充能舱切断接管回路，让救援装备保持真实回应。',
        targetNodeIds: ['north_rescue_patrol', 'soul_recharge_shelter'],
        rewardPoints: 700
      }),
      expect.objectContaining({
        id: 'shelter_collapse_command',
        name: '坍廊验权',
        description: '先穿过坍塌走廊压锁，再前往总控身份锁完成自我核验，证明护送队未被伪造口令接管。',
        targetNodeIds: ['collapsed_hall_trap', 'command_lock'],
        rewardPoints: 700
      }),
      expect.objectContaining({
        id: 'shelter_horror_containment',
        name: '终撤收容',
        description: '先击退终段撤离畸变体，再进入失联收容舱封闭接管样本，让畸变撤离记录无法回写幸存者。',
        targetNodeIds: ['evacuation_horror_omega', 'containment_bay'],
        rewardPoints: 700
      })
    ]);
  });

  it('defines the three testimony contracts with exact ordered targets and Tier-17 rewards', () => {
    expect(listRouteContracts('false_testimony_court')).toEqual([
      expect.objectContaining({
        id: 'testimony_witness_recharge',
        name: '北证续魂',
        targetNodeIds: ['hostile_witness_north', 'soul_recharge_verdict'],
        rewardPoints: 760
      }),
      expect.objectContaining({
        id: 'testimony_voice_judgment',
        name: '声证锁判',
        targetNodeIds: ['voice_filter_trap', 'judgment_lock'],
        rewardPoints: 760
      }),
      expect.objectContaining({
        id: 'testimony_hound_hall',
        name: '猎伪归厅',
        targetNodeIds: ['perjury_hound_omega', 'testimony_hall'],
        rewardPoints: 760
      })
    ]);
  });

  it('defines the three combat replay contracts with exact ordered targets and Tier-18 rewards', () => {
    expect(listRouteContracts('combat_replay_stage')).toEqual([
      expect.objectContaining({
        dungeonId: 'combat_replay_stage',
        targetNodeIds: ['cue_stalker_north', 'soul_recharge_stage'],
        rewardPoints: 820
      }),
      expect.objectContaining({
        dungeonId: 'combat_replay_stage',
        targetNodeIds: ['opening_cue_trap', 'final_cut_lock'],
        rewardPoints: 820
      }),
      expect.objectContaining({
        dungeonId: 'combat_replay_stage',
        targetNodeIds: ['retake_double_omega', 'opening_prop_cache'],
        rewardPoints: 820
      })
    ]);
  });

  it('defines the three panopticon contracts with exact ordered targets and Tier-19 rewards', () => {
    expect(listRouteContracts('panopticon_city')).toEqual([
      expect.objectContaining({
        id: 'panopticon_north_recharge',
        name: '北盲续界',
        targetNodeIds: ['north_blind_relay', 'soul_recharge_panopticon'],
        rewardPoints: 880
      }),
      expect.objectContaining({
        id: 'panopticon_central_lock',
        name: '中盲锁视',
        targetNodeIds: ['central_blind_relay', 'all_sight_lock'],
        rewardPoints: 880
      }),
      expect.objectContaining({
        id: 'panopticon_south_inverse',
        name: '南盲逆观',
        targetNodeIds: ['south_blind_relay', 'inverse_observation_stage'],
        rewardPoints: 880
      })
    ]);
    expect(listRouteContracts('combat_replay_stage').every(({ rewardPoints }) => rewardPoints === 820)).toBe(true);
  });

  it('uses the dungeon-tier reward curve and unique ordered pairs', () => {
    const pairs = new Set<string>();
    for (const definition of ROUTE_CONTRACT_CATALOG) {
      const dungeon = DUNGEONS[definition.dungeonId];
      expect(definition.rewardPoints).toBe(dungeon.tier === 19 ? 880 : dungeon.tier === 18 ? 820 : dungeon.tier === 17 ? 760 : dungeon.tier === 16 ? 700 : dungeon.tier === 15 ? 650 : dungeon.tier === 14 ? 600 : dungeon.tier === 13 ? 560 : 100 + dungeon.tier * 35);
      const pairKey = `${definition.dungeonId}:${definition.targetNodeIds.join('->')}`;
      expect(pairs.has(pairKey)).toBe(false);
      pairs.add(pairKey);
    }
  });

  it('uses real consequential targets with only the fixed short-pair and boss exceptions', () => {
    const unorderedPairs = new Set<string>();
    for (const definition of ROUTE_CONTRACT_CATALOG) {
      const dungeon = DUNGEONS[definition.dungeonId];
      const bossNodeId = getBossDefinition(definition.dungeonId).nodeId;
      const [first, second] = definition.targetNodeIds.map((nodeId) => getNode(definition, nodeId));

      for (const target of [first, second]) {
        expect(target.id).not.toBe(dungeon.grid.startNodeId);
        if (target.id === bossNodeId) {
          expect(definition.id).toBe('entropy_navigator_lock');
          expect(target.id).toBe(definition.targetNodeIds[1]);
        }
        expect(target.type).not.toBe('portal');
        expect(target.type).not.toBe('exit');
      }
      const targetDistance = Math.abs(first.position.x - second.position.x) + Math.abs(first.position.y - second.position.y);
      if (definition.id === 'entropy_wake_ballast') {
        expect([first.type, second.type]).toEqual(['reward', 'reward']);
        expect(targetDistance).toBe(1);
      } else if (definition.id === 'legacy_mimic_testimony') {
        expect([first.type, second.type]).toEqual(['monster', 'reward']);
        expect(targetDistance).toBe(2);
      } else if (definition.id === 'genesis_guardian_lineage') {
        expect([first.type, second.type]).toEqual(['monster', 'reward']);
        expect(targetDistance).toBe(1);
      } else if (definition.id === 'broadcast_warden_anechoic') {
        expect([first.type, second.type]).toEqual(['monster', 'reward']);
        expect(targetDistance).toBe(2);
      } else if (definition.id === 'shelter_horror_containment') {
        expect([first.type, second.type]).toEqual(['monster', 'reward']);
        expect(targetDistance).toBe(2);
      } else if (definition.id === 'panopticon_central_lock' || definition.id === 'panopticon_south_inverse') {
        expect([first.type, second.type]).toEqual(['reward', 'reward']);
        expect(targetDistance).toBeGreaterThanOrEqual(3);
      } else {
        expect([first.type, second.type].some((type) => type === 'monster' || type === 'trap')).toBe(true);
        expect(targetDistance).toBeGreaterThanOrEqual(3);
      }

      const unorderedPairKey = `${definition.dungeonId}:${[first.id, second.id].sort().join('<->')}`;
      expect(unorderedPairs.has(unorderedPairKey)).toBe(false);
      unorderedPairs.add(unorderedPairKey);
    }
  });

  it('proves every ordered pair with an explicit path under live route laws', () => {
    expect(Object.keys(LEGAL_ROUTE_WITNESSES).sort()).toEqual(ROUTE_CONTRACT_CATALOG.map((definition) => definition.id).sort());

    for (const definition of ROUTE_CONTRACT_CATALOG) {
      const dungeon = DUNGEONS[definition.dungeonId];
      const bossNodeId = getBossDefinition(definition.dungeonId).nodeId;
      const path = LEGAL_ROUTE_WITNESSES[definition.id];
      const firstTargetIndex = path.indexOf(definition.targetNodeIds[0]);
      const secondTargetIndex = path.indexOf(definition.targetNodeIds[1]);

      expect(path[0]).toBe(ROUTE_ENTRY_OVERRIDES[definition.id] ?? dungeon.grid.startNodeId);
      expect(firstTargetIndex).toBeGreaterThan(0);
      expect(secondTargetIndex).toBeGreaterThan(firstTargetIndex);

      let lawState = createDungeonLawState(definition.dungeonId);
      for (let index = 0; index < path.length; index += 1) {
        const node = getNode(definition, path[index]);
        if (node.id === bossNodeId) {
          expect(definition.id).toBe('entropy_navigator_lock');
          expect(index).toBe(path.length - 1);
        }
        expect(node.type).not.toBe('portal');
        expect(node.type).not.toBe('exit');

        if (index > 0) {
          const previousNode = getNode(definition, path[index - 1]);
          expect(Math.abs(previousNode.position.x - node.position.x) + Math.abs(previousNode.position.y - node.position.y)).toBe(1);
          expect(getRouteBlockReason(definition.dungeonId, previousNode.id, node.id, lawState)).toBeUndefined();
        }

        // Zero damage is a legal clear and keeps the route proof deterministic across combat balance changes.
        lawState = signalFirstNodeClear(lawState, {
          node: { id: node.id, type: node.type },
          damageTaken: 0
        });
        if (lawState.law.kind === 'combat_replay_stage' && DUNGEONS.combat_replay_stage.nodes.some((candidate) => candidate.id === node.id && candidate.id.startsWith('take_'))) {
          const resolution = recordCombatReplayTake(lawState, node.id as 'take_alpha' | 'take_beta' | 'take_gamma', 'attack', 1);
          expect(resolution.recorded).toBe(true);
          lawState = resolution.state;
        }
        if (lawState.law.kind === 'redaction_scriptorium' && lawState.law.pendingClauseNodeId !== null) {
          const resolution = resolveRedactionClauseChoice(lawState, 'certify');
          expect(resolution.resolved).toBe(true);
          lawState = resolution.state;
        }
        if (lawState.law.kind === 'legacy_auction_court' && lawState.law.pendingLotNodeId !== null) {
          const resolution = resolveAuctionLotChoice(lawState, 'fold', 0);
          expect(resolution.resolved).toBe(true);
          lawState = resolution.state;
        }
        if (lawState.law.kind === 'genesis_vault' && lawState.law.pendingSpliceNodeId !== null) {
          const genes = ['force', 'art', 'guard'] as const;
          const resolution = resolveGenesisSpliceChoice(
            lawState,
            genes[lawState.law.spliceSequence.length],
            99
          );
          expect(resolution.resolved).toBe(true);
          lawState = resolution.state;
        }
        if (lawState.law.kind === 'silent_broadcast_tower' && lawState.law.pendingRelayNodeId !== null) {
          const resolution = resolveBroadcastRelayChoice(lawState, 'mute');
          expect(resolution.resolved).toBe(true);
          lawState = resolution.state;
        }
        if (lawState.law.kind === 'lost_shelter' && lawState.law.pendingCheckpointNodeId !== null) {
          const resolution = resolveEscortCheckpointChoice(
            lawState,
            lawState.law.pendingCheckpointNodeId,
            'push',
            0
          );
          expect(resolution.resolved).toBe(true);
          lawState = resolution.state;
        }
        const phaseChoice = MIRROR_ROUTE_PHASE_CHOICES[node.id as keyof typeof MIRROR_ROUTE_PHASE_CHOICES];
        if (phaseChoice) lawState = resolveMirrorCityPhaseChoice(lawState, phaseChoice).state;
      }
    }
  });
});

describe('hidden route contract discovery', () => {
  const dungeonId = 'demon_tower_1' as const;
  const nonTargetPath = [
    'fog_lesser_demon',
    'broken_sigil_reward',
    'watch_post_cache',
    'left_watch_trap',
    'blood_rune_trap',
    'demon_bone_cache',
    'lower_fog_lesser'
  ];

  function findTriggeringSeed(
    clearedNodeIds: readonly string[],
    expectedContractId?: string
  ): { seed: number; state: RouteContractRunState } {
    for (let seed = 1; seed <= 10_000; seed += 1) {
      const state = discoverHiddenRouteContract({ dungeonId, seed, clearedNodeIds });
      if (state && (expectedContractId === undefined || state.contractId === expectedContractId)) {
        return { seed, state };
      }
    }
    throw new Error('Expected to find a deterministic hidden-contract trigger seed.');
  }

  it('exports the fixed trigger probability and is deterministic for the same seed and path', () => {
    expect(HIDDEN_ROUTE_CONTRACT_TRIGGER_PROBABILITY).toBe(0.35);
    const clearedNodeIds = nonTargetPath.slice(0, 2);
    const { seed, state } = findTriggeringSeed(clearedNodeIds);

    expect(discoverHiddenRouteContract({ dungeonId, seed, clearedNodeIds })).toEqual(state);
    expect(discoverHiddenRouteContract({ dungeonId, seed, clearedNodeIds })).toEqual(state);
  });

  it('uses the seed for both triggering and stable candidate selection at about thirty-five percent', () => {
    const clearedNodeIds = nonTargetPath.slice(0, 2);
    const projections = Array.from({ length: 4096 }, (_, index) =>
      discoverHiddenRouteContract({ dungeonId, seed: index + 1, clearedNodeIds })?.contractId ?? 'none'
    );
    const triggered = projections.filter((contractId) => contractId !== 'none').length;

    expect(new Set(projections).size).toBeGreaterThan(2);
    expect(triggered / projections.length).toBeGreaterThan(0.32);
    expect(triggered / projections.length).toBeLessThan(0.38);
  });

  it('checks only the second through sixth unique cleared non-exit nodes', () => {
    expect(discoverHiddenRouteContract({
      dungeonId,
      seed: 1,
      clearedNodeIds: nonTargetPath.slice(0, 1)
    })).toBeUndefined();

    for (let count = 2; count <= 6; count += 1) {
      const clearedNodeIds = nonTargetPath.slice(0, count);
      const { seed, state } = findTriggeringSeed(clearedNodeIds);
      expect(discoverHiddenRouteContract({ dungeonId, seed, clearedNodeIds })).toEqual(state);
    }

    for (let seed = 1; seed <= 64; seed += 1) {
      expect(discoverHiddenRouteContract({
        dungeonId,
        seed,
        clearedNodeIds: nonTargetPath.slice(0, 7)
      })).toBeUndefined();
    }

    const basePath = nonTargetPath.slice(0, 2);
    const { seed, state } = findTriggeringSeed(basePath);
    expect(discoverHiddenRouteContract({
      dungeonId,
      seed,
      clearedNodeIds: [basePath[0], 'tower_exit', basePath[0], basePath[1], 'foreign_node']
    })).toEqual(state);
  });

  it('rejects invalid seeds', () => {
    const clearedNodeIds = nonTargetPath.slice(0, 2);
    for (const seed of [0, -1, 1.5, Number.NaN, 0x1_0000_0000]) {
      expect(discoverHiddenRouteContract({ dungeonId, seed, clearedNodeIds })).toBeUndefined();
    }
  });

  it('excludes every contract with either target already cleared', () => {
    const contracts = listRouteContracts(dungeonId);
    const clearedNodeIds = [contracts[0].targetNodeIds[0], contracts[1].targetNodeIds[1]];
    const expected = contracts[2];
    const { seed, state } = findTriggeringSeed(clearedNodeIds, expected.id);

    expect(discoverHiddenRouteContract({ dungeonId, seed, clearedNodeIds })).toEqual(state);
    expect(state.contractId).toBe(expected.id);
  });

  it('returns undefined when all canonical candidates have a cleared target', () => {
    const clearedNodeIds = listRouteContracts(dungeonId).flatMap(
      (definition) => definition.targetNodeIds
    );

    for (let seed = 1; seed <= 128; seed += 1) {
      expect(discoverHiddenRouteContract({ dungeonId, seed, clearedNodeIds })).toBeUndefined();
    }
  });

  it('returns a frozen canonical active state accepted by the existing state API', () => {
    const clearedNodeIds = nonTargetPath.slice(0, 2);
    const { state } = findTriggeringSeed(clearedNodeIds);
    const definition = getRouteContractById(state.contractId, dungeonId);

    expect(definition?.dungeonId).toBe(dungeonId);
    expect(state).toEqual({
      rulesVersion: ROUTE_CONTRACT_RULES_VERSION,
      contractId: definition?.id,
      dungeonId,
      completedTargetCount: 0,
      status: 'active'
    });
    expect(Object.isFrozen(state)).toBe(true);
    expect(isRouteContractRunState(state, dungeonId)).toBe(true);
  });

  it('filters the seed-6 map/task-15 contract that reaches its first target only through its second', () => {
    const clearedNodeIds = ['fog_lesser_demon', 'broken_sigil_reward'];
    const legacySeedSixConnections = {
      broken_sigil_reward: ['upper_fog_patrol', 'tower_butcher_patrol', 'blood_rune_trap'],
      upper_fog_patrol: ['broken_sigil_reward', 'risky_font_trap'],
      risky_font_trap: ['upper_fog_patrol'],
      tower_butcher_patrol: ['broken_sigil_reward', 'loose_tile_trap'],
      loose_tile_trap: ['tower_butcher_patrol'],
      blood_rune_trap: ['broken_sigil_reward', 'butcher_turn'],
      butcher_turn: ['blood_rune_trap', 'ash_pit_trap'],
      ash_pit_trap: ['butcher_turn']
    } as const;

    expect(discoverHiddenRouteContract({
      dungeonId,
      seed: 15,
      clearedNodeIds
    })?.contractId).toBe('tower_ash_blade');
    expect(isOrderedRouteContractReachable(
      legacySeedSixConnections,
      'broken_sigil_reward',
      ['ash_pit_trap', 'butcher_turn']
    )).toBe(false);

    const filtered = discoverHiddenRouteContract({
      dungeonId,
      seed: 15,
      clearedNodeIds,
      currentNodeId: 'broken_sigil_reward',
      connectionIdsByNodeId: legacySeedSixConnections
    });
    expect(filtered).toBeDefined();
    expect(filtered?.contractId).not.toBe('tower_ash_blade');
    if (filtered) {
      const definition = getRouteContractById(filtered.contractId, dungeonId);
      expect(definition).toBeDefined();
      expect(isOrderedRouteContractReachable(
        legacySeedSixConnections,
        'broken_sigil_reward',
        definition!.targetNodeIds
      )).toBe(true);
    }
  });

  it('only discovers ordered-reachable contracts on every procedural chapter and seed sample', () => {
    for (const candidateDungeonId of DUNGEON_ORDER) {
      const dungeon = DUNGEONS[candidateDungeonId];
      const targetNodeIds = new Set(
        listRouteContracts(candidateDungeonId)
          .flatMap((definition) => definition.targetNodeIds)
      );
      const clearedNodeIds = dungeon.nodes
        .filter((node) => node.type !== 'exit' && !targetNodeIds.has(node.id))
        .slice(0, 2)
        .map((node) => node.id);
      expect(clearedNodeIds, candidateDungeonId).toHaveLength(2);

      for (const mapSeed of [1, 4, 6, 11]) {
        const snapshot = createInfernoMapSnapshot({
          dungeon,
          bossNodeId: getBossDefinition(candidateDungeonId).nodeId,
          seed: mapSeed
        });
        const connectionIdsByNodeId = getInfernoConnectionIds(snapshot)!;
        for (let taskSeed = 1; taskSeed <= 64; taskSeed += 1) {
          const state = discoverHiddenRouteContract({
            dungeonId: candidateDungeonId,
            seed: taskSeed,
            clearedNodeIds,
            currentNodeId: clearedNodeIds[1],
            connectionIdsByNodeId
          });
          if (!state) continue;
          const definition = getRouteContractById(state.contractId, candidateDungeonId);
          expect(
            definition,
            `${candidateDungeonId}:${mapSeed}:${taskSeed}`
          ).toBeDefined();
          expect(isOrderedRouteContractReachable(
            connectionIdsByNodeId,
            clearedNodeIds[1],
            definition!.targetNodeIds
          ), `${candidateDungeonId}:${mapSeed}:${taskSeed}:${state.contractId}`).toBe(true);
        }
      }
    }
  });
});

describe('route contract state machine', () => {
  it('queries only canonical definitions and disables unknown selections', () => {
    const definition = ROUTE_CONTRACT_CATALOG[0];
    expect(getRouteContractById(definition.id, definition.dungeonId)).toBe(definition);
    expect(getRouteContractById(definition.id, 'metro_abyss')).toBeUndefined();
    expect(getRouteContractById('unknown_contract', definition.dungeonId)).toBeUndefined();
    expect(listRouteContracts('unknown_dungeon' as DungeonId)).toEqual([]);
    expect(isRouteContractDefinition({ ...definition, id: 'unknown_contract' })).toBe(false);
    expect(createRouteContractRunState(undefined)).toBeUndefined();
    expect(createRouteContractRunState({ ...definition, id: 'unknown_contract' })).toBeUndefined();
  });

  it('creates, normalizes, and displays a selected contract without mutating input', () => {
    const definition = ROUTE_CONTRACT_CATALOG[0];
    const state = createTestState();
    expect(state).toEqual({
      rulesVersion: 1,
      contractId: definition.id,
      dungeonId: definition.dungeonId,
      completedTargetCount: 0,
      status: 'active'
    });
    expect(Object.isFrozen(state)).toBe(true);
    expect(isRouteContractRunState(state, definition.dungeonId)).toBe(true);

    const raw = { ...state };
    const normalized = normalizeRouteContractRunState(raw, definition.dungeonId);
    expect(normalized).toEqual(raw);
    expect(normalized).not.toBe(raw);
    expect(Object.isFrozen(normalized)).toBe(true);
    expect(raw).toEqual(state);

    expect(getRouteContractProgress(state, definition.dungeonId)).toMatchObject({
      enabled: true,
      status: 'active',
      completedTargetCount: 0,
      totalTargetCount: 2,
      potentialRewardPoints: definition.rewardPoints,
      bankedRewardPoints: 0,
      definition,
      nextTargetNodeId: definition.targetNodeIds[0]
    });
    expect(getRouteContractDisplayStatus(state, definition.dungeonId).key).toBe('pending_first');
  });

  it('normalizes missing, old, malformed, unknown, and cross-dungeon state as disabled', () => {
    const state = createTestState();
    const malformed: unknown[] = [
      undefined,
      null,
      {},
      { ...state, rulesVersion: 0 },
      { ...state, contractId: 'unknown_contract' },
      { ...state, completedTargetCount: 3 },
      { ...state, status: 'secured', completedTargetCount: 1 },
      { ...state, status: 'failed', reason: 'out_of_order', completedTargetCount: 1 },
      { ...state, status: 'lost', reason: 'out_of_order' },
      { ...state, extra: true }
    ];

    for (const value of malformed) {
      expect(normalizeRouteContractRunState(value, state.dungeonId)).toBeUndefined();
      expect(isRouteContractRunState(value, state.dungeonId)).toBe(false);
      expect(getRouteContractProgress(value, state.dungeonId)).toEqual({
        enabled: false,
        status: 'disabled',
        completedTargetCount: 0,
        totalTargetCount: 2,
        potentialRewardPoints: 0,
        bankedRewardPoints: 0
      });
      expect(getRouteContractDisplayStatus(value, state.dungeonId).key).toBe('disabled');
    }

    expect(normalizeRouteContractRunState(state, 'metro_abyss')).toBeUndefined();
    expect(transitionRouteContractFirstClear(state, 'metro_abyss', 'anything')).toBeUndefined();
    expect(settleRouteContractExit(state, 'metro_abyss')).toEqual({ state: undefined, rewardPoints: 0, rewarded: false });
  });

  it('advances in order, ignores duplicate first-clear signals, and secures at 2/2', () => {
    const definition = ROUTE_CONTRACT_CATALOG[0];
    const initial = createTestState();
    expect(transitionRouteContractFirstClear(initial, initial.dungeonId, 'unrelated_node')).toBe(initial);

    const afterFirst = transitionRouteContractFirstClear(initial, initial.dungeonId, definition.targetNodeIds[0]);
    expect(afterFirst).toMatchObject({ status: 'active', completedTargetCount: 1 });
    expect(initial).toMatchObject({ status: 'active', completedTargetCount: 0 });
    expect(getRouteContractProgress(afterFirst, initial.dungeonId).nextTargetNodeId).toBe(definition.targetNodeIds[1]);
    expect(getRouteContractDisplayStatus(afterFirst, initial.dungeonId).key).toBe('pending_second');
    expect(transitionRouteContractFirstClear(afterFirst, initial.dungeonId, definition.targetNodeIds[0])).toBe(afterFirst);

    const secured = transitionRouteContractFirstClear(afterFirst, initial.dungeonId, definition.targetNodeIds[1]);
    expect(secured).toMatchObject({ status: 'secured', completedTargetCount: 2 });
    expect(Object.isFrozen(secured)).toBe(true);
    expect(getRouteContractDisplayStatus(secured, initial.dungeonId)).toEqual({
      key: 'secured',
      label: '契约已保全',
      detail: `从本副本出口结算可获得 ${definition.rewardPoints} 奖励点。`
    });
    expect(transitionRouteContractFirstClear(secured, initial.dungeonId, definition.targetNodeIds[1])).toBe(secured);
  });

  it('fails irreversibly when the second target clears first', () => {
    const definition = ROUTE_CONTRACT_CATALOG[0];
    const initial = createTestState();
    const failed = transitionRouteContractFirstClear(initial, initial.dungeonId, definition.targetNodeIds[1]);
    expect(failed).toEqual({
      rulesVersion: 1,
      contractId: definition.id,
      dungeonId: definition.dungeonId,
      completedTargetCount: 0,
      status: 'failed',
      reason: 'out_of_order'
    });
    expect(getRouteContractDisplayStatus(failed, initial.dungeonId)).toMatchObject({ key: 'failed' });
    expect(transitionRouteContractFirstClear(failed, initial.dungeonId, definition.targetNodeIds[0])).toBe(failed);
    expect(settleRouteContractExit(failed, initial.dungeonId)).toEqual({ state: failed, rewardPoints: 0, rewarded: false });
  });

  it('fails incomplete exits and rewards only the first secured exit settlement', () => {
    const definition = ROUTE_CONTRACT_CATALOG[0];
    const initial = createTestState();
    const incompleteAtZero = settleRouteContractExit(initial, initial.dungeonId);
    expect(incompleteAtZero).toMatchObject({ rewardPoints: 0, rewarded: false, state: { status: 'failed', reason: 'incomplete_exit', completedTargetCount: 0 } });

    const afterFirst = transitionRouteContractFirstClear(initial, initial.dungeonId, definition.targetNodeIds[0]);
    const incompleteAtOne = settleRouteContractExit(afterFirst, initial.dungeonId);
    expect(incompleteAtOne).toMatchObject({ rewardPoints: 0, rewarded: false, state: { status: 'failed', reason: 'incomplete_exit', completedTargetCount: 1 } });

    const secured = transitionRouteContractFirstClear(afterFirst, initial.dungeonId, definition.targetNodeIds[1]);
    const firstSettlement = settleRouteContractExit(secured, initial.dungeonId);
    expect(firstSettlement).toMatchObject({
      rewardPoints: definition.rewardPoints,
      rewarded: true,
      state: { status: 'banked', completedTargetCount: 2 }
    });
    expect(secured).toMatchObject({ status: 'secured', completedTargetCount: 2 });
    expect(Object.isFrozen(firstSettlement)).toBe(true);
    expect(Object.isFrozen(firstSettlement.state)).toBe(true);

    const secondSettlement = settleRouteContractExit(firstSettlement.state, initial.dungeonId);
    expect(secondSettlement).toEqual({ state: firstSettlement.state, rewardPoints: 0, rewarded: false });
    expect(getRouteContractProgress(firstSettlement.state, initial.dungeonId)).toMatchObject({
      status: 'banked',
      bankedRewardPoints: definition.rewardPoints
    });
    expect(getRouteContractDisplayStatus(firstSettlement.state, initial.dungeonId)).toEqual({
      key: 'banked',
      label: '契约已入账',
      detail: `已获得 ${definition.rewardPoints} 奖励点。`
    });
  });

  it('marks retreat, run failure, and cross-dungeon outcomes as terminal losses', () => {
    const definition = ROUTE_CONTRACT_CATALOG[0];
    const initial = createTestState();
    const afterFirst = transitionRouteContractFirstClear(initial, initial.dungeonId, definition.targetNodeIds[0]);
    const secured = transitionRouteContractFirstClear(afterFirst, initial.dungeonId, definition.targetNodeIds[1]);

    for (const reason of ['retreat', 'failure', 'cross_dungeon'] as const) {
      const source = reason === 'cross_dungeon' ? secured : afterFirst;
      const lost = markRouteContractLost(source, initial.dungeonId, reason);
      expect(lost).toMatchObject({ status: 'lost', reason, completedTargetCount: reason === 'cross_dungeon' ? 2 : 1 });
      expect(getRouteContractDisplayStatus(lost, initial.dungeonId).key).toBe('lost');
      expect(settleRouteContractRun(lost, initial.dungeonId, 'successful_exit')).toEqual({ state: lost, rewardPoints: 0, rewarded: false });
      expect(markRouteContractLost(lost, initial.dungeonId, reason)).toBe(lost);
    }
  });

  it('preserves Tier-15 order, cross-dungeon loss, incomplete exit, and one-time banking semantics', () => {
    const definition = listRouteContracts('silent_broadcast_tower')[0];
    const initial = createRouteContractRunState(definition);
    if (!initial) throw new Error('Expected broadcast route contract state.');

    expect(transitionRouteContractFirstClear(initial, definition.dungeonId, definition.targetNodeIds[1])).toMatchObject({
      status: 'failed', reason: 'out_of_order', completedTargetCount: 0
    });
    const afterFirst = transitionRouteContractFirstClear(initial, definition.dungeonId, definition.targetNodeIds[0]);
    expect(settleRouteContractExit(afterFirst, definition.dungeonId)).toMatchObject({
      rewarded: false,
      rewardPoints: 0,
      state: { status: 'failed', reason: 'incomplete_exit', completedTargetCount: 1 }
    });
    expect(markRouteContractLost(afterFirst, definition.dungeonId, 'cross_dungeon')).toMatchObject({
      status: 'lost', reason: 'cross_dungeon', completedTargetCount: 1
    });

    const secured = transitionRouteContractFirstClear(afterFirst, definition.dungeonId, definition.targetNodeIds[1]);
    const settled = settleRouteContractExit(secured, definition.dungeonId);
    expect(settled).toMatchObject({ rewarded: true, rewardPoints: 650, state: { status: 'banked' } });
    expect(settleRouteContractExit(settled.state, definition.dungeonId)).toEqual({
      state: settled.state,
      rewardPoints: 0,
      rewarded: false
    });
  });
});
