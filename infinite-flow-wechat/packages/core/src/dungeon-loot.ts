import type { DungeonId, EquipmentId, ItemId, MonsterId } from './game';

export const DUNGEON_ELITE_MONSTERS = {
  demon_tower_1: 'tower_butcher',
  metro_abyss: 'mirror_thread_spider',
  starfall_mine: 'portal_molt_beast',
  rust_hospital: 'pulse_doctor',
  ash_arena: 'furnace_judge',
  dream_archive: 'dream_jailer',
  void_citadel: 'main_god_echo',
  temporal_observatory: 'epoch_sentinel',
  causal_clearinghouse: 'paradox_bailiff',
  entropy_ark: 'dissipation_navigator',
  mirror_cycle_city: 'mirror_chorus',
  redaction_scriptorium: 'palimpsest_censor',
  legacy_auction_court: 'inheritance_mimic',
  genesis_vault: 'mutation_guardian',
  silent_broadcast_tower: 'broadcast_warden',
  lost_shelter: 'shelter_enforcer',
  false_testimony_court: 'archive_censor',
  combat_replay_stage: 'continuity_editor',
  panopticon_city: 'blindspot_auditor'
} as const satisfies Record<DungeonId, MonsterId>;

export const DUNGEON_EQUIPMENT_POOLS = {
  demon_tower_1: ['armor_piercing_sword', 'bone_spear', 'mist_hood', 'spirit_robe'],
  metro_abyss: ['bone_spear', 'mist_hood', 'cloudstep_boots', 'cloudstep_charm', 'rift_charm'],
  starfall_mine: ['armor_piercing_sword', 'guardian_gauntlets', 'rift_belt', 'starforged_edge', 'rift_charm'],
  rust_hospital: ['ember_staff', 'spirit_robe', 'guardian_plate', 'guardian_gauntlets', 'rift_charm'],
  ash_arena: ['ember_staff', 'guardian_plate', 'guardian_gauntlets', 'cloudstep_boots', 'starforged_edge'],
  dream_archive: ['mist_hood', 'spirit_robe', 'rift_belt', 'rift_charm', 'void_lantern'],
  void_citadel: ['starforged_edge', 'guardian_plate', 'rift_belt', 'cloudstep_charm', 'void_lantern'],
  temporal_observatory: ['chronal_edge', 'chronal_aegis', 'chronal_lens', 'starforged_edge', 'void_lantern'],
  causal_clearinghouse: ['causal_visor', 'echo_breaker_gauntlets', 'return_anchor_belt'],
  entropy_ark: ['entropy_compass', 'dissipation_mantle', 'ark_keel_boots'],
  mirror_cycle_city: ['parallax_visor', 'phaseweave_mantle', 'homecoming_prism'],
  redaction_scriptorium: ['redline_edge', 'palimpsest_mantle', 'final_proof_seal'],
  legacy_auction_court: ['legacy_gavel', 'anonymous_veil', 'escrow_plate', 'final_lot_bell'],
  genesis_vault: ['helix_cleaver', 'symbiote_cowl', 'carapace_harness', 'rebirth_amulet'],
  silent_broadcast_tower: [
    'hushblade',
    'dead_air_headset',
    'anechoic_mantle',
    'last_channel_beacon'
  ],
  lost_shelter: [
    'rescue_carbine',
    'breach_shotgun',
    'triage_visor',
    'evacuation_plate',
    'blackbox_beacon'
  ],
  false_testimony_court: [
    'cross_examiner_sabre',
    'forensic_visor',
    'custody_shell',
    'appeal_seal'
  ],
  combat_replay_stage: [
    'frame_engraver',
    'cue_visor',
    'buffer_plate',
    'thaw_metronome'
  ],
  panopticon_city: [
    'blindline_cutter',
    'phase_coil_rifle',
    'predictive_visor',
    'matte_shell',
    'inverse_prism'
  ]
} as const satisfies Record<DungeonId, readonly EquipmentId[]>;

export const DUNGEON_MATERIAL_REWARDS = {
  demon_tower_1: { itemId: 'demon_bone', amount: 1 },
  metro_abyss: { itemId: 'mirror_shell', amount: 1 },
  starfall_mine: { itemId: 'star_iron', amount: 1 },
  rust_hospital: { itemId: 'medicine_ash', amount: 1 },
  ash_arena: { itemId: 'cracked_core', amount: 1 },
  dream_archive: { itemId: 'hidden_stone', amount: 1 },
  void_citadel: { itemId: 'rift_dust', amount: 1 },
  temporal_observatory: { itemId: 'chronal_glass', amount: 1 },
  causal_clearinghouse: { itemId: 'causal_seal', amount: 1 },
  entropy_ark: { itemId: 'entropy_crystal', amount: 1 },
  mirror_cycle_city: { itemId: 'phase_glass', amount: 1 },
  redaction_scriptorium: { itemId: 'redaction_ink', amount: 1 },
  legacy_auction_court: { itemId: 'legacy_scrip', amount: 1 },
  genesis_vault: { itemId: 'genesis_serum', amount: 1 },
  silent_broadcast_tower: { itemId: 'silence_core', amount: 1 },
  lost_shelter: { itemId: 'rescue_badge', amount: 1 },
  false_testimony_court: { itemId: 'truth_fragment', amount: 1 },
  combat_replay_stage: { itemId: 'combat_reel', amount: 1 },
  panopticon_city: { itemId: 'observation_shard', amount: 1 }
} as const satisfies Record<DungeonId, Readonly<{ itemId: ItemId; amount: 1 }>>;

export type DungeonEquipmentRecipe = Readonly<{
  dungeonId: DungeonId;
  materialId: ItemId;
  equipmentId: EquipmentId;
  materialAmount: 1;
}>;

const DUNGEON_IDS = Object.keys(DUNGEON_EQUIPMENT_POOLS) as DungeonId[];

export function getDungeonEquipmentRecipes(dungeonId: DungeonId): DungeonEquipmentRecipe[] {
  const materialId = DUNGEON_MATERIAL_REWARDS[dungeonId].itemId;
  return DUNGEON_EQUIPMENT_POOLS[dungeonId].map((equipmentId) => ({
    dungeonId,
    materialId,
    equipmentId,
    materialAmount: 1
  }));
}

export function getEquipmentRecipe(
  dungeonId: DungeonId,
  equipmentId: EquipmentId
): DungeonEquipmentRecipe | undefined {
  return getDungeonEquipmentRecipes(dungeonId).find(
    (recipe) => recipe.equipmentId === equipmentId
  );
}

export function getEquipmentRecipeDungeonIds(equipmentId: EquipmentId): DungeonId[] {
  return DUNGEON_IDS.filter((dungeonId) =>
    DUNGEON_EQUIPMENT_POOLS[dungeonId].some((candidate) => candidate === equipmentId)
  );
}

export const DUNGEON_SALVAGE_REWARD_POINTS = {
  demon_tower_1: 100,
  metro_abyss: 120,
  starfall_mine: 140,
  rust_hospital: 160,
  ash_arena: 180,
  dream_archive: 200,
  void_citadel: 220,
  temporal_observatory: 240,
  causal_clearinghouse: 260,
  entropy_ark: 280,
  mirror_cycle_city: 300,
  redaction_scriptorium: 320,
  legacy_auction_court: 360,
  genesis_vault: 400,
  silent_broadcast_tower: 440,
  lost_shelter: 480,
  false_testimony_court: 520,
  combat_replay_stage: 560,
  panopticon_city: 600
} as const satisfies Record<DungeonId, number>;

export type DungeonLootInput = {
  dungeonId: DungeonId;
  monsterId: MonsterId;
  nodeId: string;
  ownedEquipmentIds: readonly EquipmentId[];
  carriedEquipmentIds: readonly EquipmentId[];
  offersMade: number;
  guaranteedEquipmentId?: EquipmentId;
  includeOwnedEquipment?: boolean;
  rotationSeed?: number;
};

export type DungeonLootOffer =
  | {
      offerId: string;
      equipmentIds: EquipmentId[];
      guaranteedEquipmentId?: EquipmentId;
    }
  | {
      offerId: string;
      salvageRewardPoints: number;
    };

function stableHash(value: string): number {
  // FNV-1a with 32-bit arithmetic is stable across JavaScript runtimes.
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rotateByNodeId(equipmentIds: EquipmentId[], nodeId: string): EquipmentId[] {
  const offset = stableHash(nodeId) % equipmentIds.length;
  return [...equipmentIds.slice(offset), ...equipmentIds.slice(0, offset)];
}

export function getDungeonLootOffer({
  dungeonId,
  monsterId,
  nodeId,
  ownedEquipmentIds,
  carriedEquipmentIds,
  offersMade,
  guaranteedEquipmentId,
  includeOwnedEquipment = false,
  rotationSeed
}: DungeonLootInput): DungeonLootOffer | undefined {
  if (offersMade >= 1 || DUNGEON_ELITE_MONSTERS[dungeonId] !== monsterId) {
    return undefined;
  }

  const unavailableEquipmentIds = new Set<EquipmentId>([
    ...(includeOwnedEquipment ? [] : ownedEquipmentIds),
    ...carriedEquipmentIds
  ]);
  const availableEquipmentIds = DUNGEON_EQUIPMENT_POOLS[dungeonId].filter(
    (equipmentId) => !unavailableEquipmentIds.has(equipmentId)
  );
  const offerId = `dungeon-loot:${dungeonId}:${nodeId}${
    rotationSeed === undefined ? '' : `:${rotationSeed}`
  }`;

  if (availableEquipmentIds.length === 0) {
    return {
      offerId,
      salvageRewardPoints: DUNGEON_SALVAGE_REWARD_POINTS[dungeonId]
    };
  }

  const rotatedEquipmentIds = rotateByNodeId(
    availableEquipmentIds,
    rotationSeed === undefined ? nodeId : `${nodeId}:${rotationSeed}`
  );
  if (
    guaranteedEquipmentId === undefined ||
    !availableEquipmentIds.some((equipmentId) => equipmentId === guaranteedEquipmentId)
  ) {
    return {
      offerId,
      equipmentIds: rotatedEquipmentIds.slice(0, 3)
    };
  }

  return {
    offerId,
    equipmentIds: [
      guaranteedEquipmentId,
      ...rotatedEquipmentIds.filter((equipmentId) => equipmentId !== guaranteedEquipmentId)
    ].slice(0, 3),
    guaranteedEquipmentId
  };
}
