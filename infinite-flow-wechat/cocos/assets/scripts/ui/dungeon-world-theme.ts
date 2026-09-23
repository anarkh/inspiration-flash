import type { ExploreDetailViewModel } from '@infinite-flow/presentation';

type DungeonId = ExploreDetailViewModel['map']['dungeonId'];

/** Dedicated walkable environment art, distinct from the legacy chapter illustration. */
export function getDungeonWorldBackgroundKey(dungeonId: DungeonId): string {
  return `scene:dungeon_world_${dungeonId}`;
}

export type WorldTint = readonly [number, number, number];
export type DungeonWorldTheme = Readonly<{
  id: DungeonId | 'hub';
  floor: 'stone' | 'tile' | 'metal' | 'wood' | 'sand' | 'void';
  ground: WorldTint;
  wall: WorldTint;
  accent: WorldTint;
  motif: 'sigil' | 'rails' | 'crystal' | 'ward' | 'arena' | 'archive' | 'rift' | 'clock' | 'balance' | 'keel' | 'mirror' | 'redaction' | 'auction' | 'helix' | 'antenna' | 'shelter' | 'evidence' | 'replay' | 'surveillance';
  enemy: 'beast' | 'specter' | 'armored' | 'human' | 'machine';
  bossNodeId: string;
  eliteMonsterId: string;
  eliteNodeIds: readonly string[];
}>;

/** Art metadata only. IDs mirror level-data, boss-system and dungeon-loot; no rules or hidden state are read. */
export const DUNGEON_WORLD_THEMES: Readonly<Record<DungeonId, DungeonWorldTheme>> = {
  demon_tower_1: { id: 'demon_tower_1', floor: 'stone', ground: [38, 49, 48], wall: [72, 85, 78], accent: [152, 204, 154], motif: 'sigil', enemy: 'beast', bossNodeId: 'bone_lane_monster', eliteMonsterId: 'tower_butcher', eliteNodeIds: ['butcher_turn', 'bone_lane_monster', 'tower_butcher_patrol'] },
  metro_abyss: { id: 'metro_abyss', floor: 'tile', ground: [28, 52, 61], wall: [71, 104, 110], accent: [102, 218, 227], motif: 'rails', enemy: 'specter', bossNodeId: 'mirror_thread_spider', eliteMonsterId: 'mirror_thread_spider', eliteNodeIds: ['mirror_thread_spider'] },
  starfall_mine: { id: 'starfall_mine', floor: 'stone', ground: [46, 36, 55], wall: [87, 70, 101], accent: [180, 145, 249], motif: 'crystal', enemy: 'armored', bossNodeId: 'molt_beast_den', eliteMonsterId: 'portal_molt_beast', eliteNodeIds: ['molt_beast_patrol', 'rift_beast', 'molt_beast_den'] },
  rust_hospital: { id: 'rust_hospital', floor: 'tile', ground: [38, 57, 50], wall: [104, 126, 102], accent: [172, 215, 126], motif: 'ward', enemy: 'human', bossNodeId: 'chief_pulse_doctor', eliteMonsterId: 'pulse_doctor', eliteNodeIds: ['pulse_doctor', 'doctor_patrol_route', 'pulse_doctor_round', 'chief_pulse_doctor'] },
  ash_arena: { id: 'ash_arena', floor: 'sand', ground: [66, 44, 36], wall: [105, 72, 58], accent: [240, 143, 83], motif: 'arena', enemy: 'armored', bossNodeId: 'furnace_judge', eliteMonsterId: 'furnace_judge', eliteNodeIds: ['furnace_judge', 'judge_shadow'] },
  dream_archive: { id: 'dream_archive', floor: 'wood', ground: [51, 39, 52], wall: [93, 67, 95], accent: [191, 151, 213], motif: 'archive', enemy: 'specter', bossNodeId: 'dream_jailer_second', eliteMonsterId: 'dream_jailer', eliteNodeIds: ['dream_jailer', 'jailer_patrol', 'dream_jailer_second'] },
  void_citadel: { id: 'void_citadel', floor: 'void', ground: [24, 30, 54], wall: [59, 71, 111], accent: [117, 161, 249], motif: 'rift', enemy: 'specter', bossNodeId: 'main_god_echo', eliteMonsterId: 'main_god_echo', eliteNodeIds: ['main_god_echo', 'echo_core_shard'] },
  temporal_observatory: { id: 'temporal_observatory', floor: 'stone', ground: [42, 49, 56], wall: [96, 105, 112], accent: [236, 204, 134], motif: 'clock', enemy: 'machine', bossNodeId: 'zero_hour_regent', eliteMonsterId: 'epoch_sentinel', eliteNodeIds: ['epoch_sentinel_alpha', 'epoch_sentinel_omega'] },
  causal_clearinghouse: { id: 'causal_clearinghouse', floor: 'tile', ground: [53, 49, 36], wall: [107, 100, 76], accent: [218, 210, 130], motif: 'balance', enemy: 'human', bossNodeId: 'zero_sum_auditor', eliteMonsterId: 'paradox_bailiff', eliteNodeIds: ['paradox_bailiff_alpha', 'paradox_bailiff_omega'] },
  entropy_ark: { id: 'entropy_ark', floor: 'metal', ground: [31, 52, 57], wall: [68, 106, 111], accent: [100, 211, 198], motif: 'keel', enemy: 'armored', bossNodeId: 'last_helmsman', eliteMonsterId: 'dissipation_navigator', eliteNodeIds: ['dissipation_navigator_alpha', 'dissipation_navigator_omega'] },
  mirror_cycle_city: { id: 'mirror_cycle_city', floor: 'tile', ground: [49, 36, 62], wall: [99, 75, 119], accent: [224, 157, 235], motif: 'mirror', enemy: 'specter', bossNodeId: 'nameless_reflection', eliteMonsterId: 'mirror_chorus', eliteNodeIds: ['mirror_chorus_real', 'mirror_chorus_upper', 'mirror_chorus_mirror', 'soul_recharge_mirror'] },
  redaction_scriptorium: { id: 'redaction_scriptorium', floor: 'wood', ground: [54, 33, 39], wall: [102, 61, 70], accent: [237, 126, 130], motif: 'redaction', enemy: 'human', bossNodeId: 'last_redactor', eliteMonsterId: 'palimpsest_censor', eliteNodeIds: ['palimpsest_censor_alpha', 'palimpsest_censor_omega'] },
  legacy_auction_court: { id: 'legacy_auction_court', floor: 'wood', ground: [56, 39, 33], wall: [112, 81, 61], accent: [240, 190, 110], motif: 'auction', enemy: 'specter', bossNodeId: 'estate_auctioneer', eliteMonsterId: 'inheritance_mimic', eliteNodeIds: ['inheritance_mimic_north', 'inheritance_mimic_alpha', 'inheritance_mimic_omega'] },
  genesis_vault: { id: 'genesis_vault', floor: 'metal', ground: [30, 53, 45], wall: [63, 103, 84], accent: [123, 236, 171], motif: 'helix', enemy: 'beast', bossNodeId: 'primal_curator', eliteMonsterId: 'mutation_guardian', eliteNodeIds: ['mutation_guardian_north', 'mutation_guardian_omega'] },
  silent_broadcast_tower: { id: 'silent_broadcast_tower', floor: 'metal', ground: [44, 45, 50], wall: [91, 96, 102], accent: [236, 180, 100], motif: 'antenna', enemy: 'machine', bossNodeId: 'last_broadcaster', eliteMonsterId: 'broadcast_warden', eliteNodeIds: ['broadcast_warden_north', 'broadcast_warden_omega'] },
  lost_shelter: { id: 'lost_shelter', floor: 'metal', ground: [43, 49, 38], wall: [88, 102, 73], accent: [201, 215, 128], motif: 'shelter', enemy: 'human', bossNodeId: 'shelter_overseer', eliteMonsterId: 'shelter_enforcer', eliteNodeIds: ['shelter_enforcer_north', 'soul_recharge_shelter'] },
  false_testimony_court: { id: 'false_testimony_court', floor: 'tile', ground: [37, 45, 57], wall: [77, 94, 113], accent: [133, 187, 236], motif: 'evidence', enemy: 'human', bossNodeId: 'false_testimony_judge', eliteMonsterId: 'archive_censor', eliteNodeIds: ['archive_censor_alpha', 'soul_recharge_verdict'] },
  combat_replay_stage: { id: 'combat_replay_stage', floor: 'metal', ground: [35, 43, 55], wall: [69, 87, 112], accent: [111, 232, 238], motif: 'replay', enemy: 'machine', bossNodeId: 'final_cut_director', eliteMonsterId: 'continuity_editor', eliteNodeIds: ['take_beta', 'continuity_editor_alpha', 'soul_recharge_stage'] },
  panopticon_city: { id: 'panopticon_city', floor: 'metal', ground: [42, 36, 54], wall: [90, 77, 113], accent: [224, 137, 249], motif: 'surveillance', enemy: 'machine', bossNodeId: 'all_sight_warden', eliteMonsterId: 'blindspot_auditor', eliteNodeIds: ['blindspot_auditor_north', 'soul_recharge_panopticon'] },
};

export const HUB_WORLD_THEME: DungeonWorldTheme = {
  // 玄黑金箓: warm dark-stone hall with red-gold ritual sigils and bronze banners.
  id: 'hub', floor: 'stone', ground: [34, 31, 27], wall: [78, 66, 50], accent: [201, 168, 106], motif: 'sigil', enemy: 'beast', bossNodeId: '', eliteMonsterId: '', eliteNodeIds: [],
};
