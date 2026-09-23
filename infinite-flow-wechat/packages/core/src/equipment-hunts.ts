import type { DungeonId, EquipmentId, MonsterId } from './game';
import { DUNGEON_EQUIPMENT_POOLS } from './dungeon-loot';

export const EQUIPMENT_HUNT_RULES_VERSION = 1 as const;

export type EquipmentHuntDefinition = Readonly<{
  id: `equipment_hunt_${DungeonId}` | 'equipment_hunt_false_testimony';
  dungeonId: DungeonId;
  clueNodeIds: readonly [string, string];
  equipmentPool?: readonly EquipmentId[];
  eliteMonsterId?: MonsterId;
  soldOutRecoveryRewardPoints?: number;
}>;

export type PreparedEquipmentHunt = Readonly<{
  dungeonId: DungeonId;
  targetEquipmentId: EquipmentId;
}>;

export type EquipmentHuntRunState = Readonly<{
  rulesVersion: typeof EQUIPMENT_HUNT_RULES_VERSION;
  dungeonId: DungeonId;
  targetEquipmentId: EquipmentId;
  clueNodeIds: readonly [string, string];
  crossedDungeonPortal: boolean;
}>;

export type EquipmentHuntProgress = Readonly<{
  targetEquipmentId: EquipmentId;
  clearedClueNodeIds: readonly string[];
  qualifiedByNodeId?: string;
  qualified: boolean;
  crossedDungeonPortal: boolean;
}>;

export const EQUIPMENT_HUNT_DEFINITIONS = Object.freeze({
  demon_tower_1: Object.freeze({
    id: 'equipment_hunt_demon_tower_1',
    dungeonId: 'demon_tower_1',
    clueNodeIds: Object.freeze(['broken_sigil_reward', 'fallen_pack_reward'] as const)
  }),
  metro_abyss: Object.freeze({
    id: 'equipment_hunt_metro_abyss',
    dungeonId: 'metro_abyss',
    clueNodeIds: Object.freeze(['coin_turnstile', 'maintenance_ladder'] as const)
  }),
  starfall_mine: Object.freeze({
    id: 'equipment_hunt_starfall_mine',
    dungeonId: 'starfall_mine',
    clueNodeIds: Object.freeze(['north_star_vein', 'lower_rail_reward'] as const)
  }),
  rust_hospital: Object.freeze({
    id: 'equipment_hunt_rust_hospital',
    dungeonId: 'rust_hospital',
    clueNodeIds: Object.freeze(['isolation_chart_reward', 'morgue_reward'] as const)
  }),
  ash_arena: Object.freeze({
    id: 'equipment_hunt_ash_arena',
    dungeonId: 'ash_arena',
    clueNodeIds: Object.freeze(['side_bench_supplies', 'ration_cache'] as const)
  }),
  dream_archive: Object.freeze({
    id: 'equipment_hunt_dream_archive',
    dungeonId: 'dream_archive',
    clueNodeIds: Object.freeze(['method_fragment_reward', 'blank_shelf_reward'] as const)
  }),
  void_citadel: Object.freeze({
    id: 'equipment_hunt_void_citadel',
    dungeonId: 'void_citadel',
    clueNodeIds: Object.freeze(['gate_oath_cache', 'rift_dust_cache'] as const)
  }),
  temporal_observatory: Object.freeze({
    id: 'equipment_hunt_temporal_observatory',
    dungeonId: 'temporal_observatory',
    clueNodeIds: Object.freeze(['past_clue_cache', 'future_clue_cache'] as const)
  }),
  causal_clearinghouse: Object.freeze({
    id: 'equipment_hunt_causal_clearinghouse',
    dungeonId: 'causal_clearinghouse',
    clueNodeIds: Object.freeze(['cause_clue_cache', 'effect_clue_cache'] as const)
  }),
  entropy_ark: Object.freeze({
    id: 'equipment_hunt_entropy_ark',
    dungeonId: 'entropy_ark',
    clueNodeIds: Object.freeze(['port_clue_cache', 'starboard_clue_cache'] as const),
    equipmentPool: Object.freeze(['entropy_compass', 'dissipation_mantle', 'ark_keel_boots'] as const),
    eliteMonsterId: 'dissipation_navigator',
    soldOutRecoveryRewardPoints: 280
  }),
  mirror_cycle_city: Object.freeze({
    id: 'equipment_hunt_mirror_cycle_city',
    dungeonId: 'mirror_cycle_city',
    clueNodeIds: Object.freeze(['real_clue_vault', 'mirror_clue_vault'] as const),
    equipmentPool: Object.freeze(['parallax_visor', 'phaseweave_mantle', 'homecoming_prism'] as const),
    eliteMonsterId: 'mirror_chorus',
    soldOutRecoveryRewardPoints: 300
  }),
  redaction_scriptorium: Object.freeze({
    id: 'equipment_hunt_redaction_scriptorium',
    dungeonId: 'redaction_scriptorium',
    clueNodeIds: Object.freeze(['north_clue_cache', 'south_clue_cache'] as const),
    equipmentPool: Object.freeze(['redline_edge', 'palimpsest_mantle', 'final_proof_seal'] as const),
    eliteMonsterId: 'palimpsest_censor',
    soldOutRecoveryRewardPoints: 320
  }),
  legacy_auction_court: Object.freeze({
    id: 'equipment_hunt_legacy_auction_court',
    dungeonId: 'legacy_auction_court',
    clueNodeIds: Object.freeze(['north_scrip_cache', 'south_scrip_cache'] as const),
    equipmentPool: Object.freeze([
      'legacy_gavel',
      'anonymous_veil',
      'escrow_plate',
      'final_lot_bell'
    ] as const),
    eliteMonsterId: 'inheritance_mimic',
    soldOutRecoveryRewardPoints: 360
  }),
  genesis_vault: Object.freeze({
    id: 'equipment_hunt_genesis_vault',
    dungeonId: 'genesis_vault',
    clueNodeIds: Object.freeze(['north_serum_cache', 'south_serum_cache'] as const),
    equipmentPool: Object.freeze([
      'helix_cleaver',
      'symbiote_cowl',
      'carapace_harness',
      'rebirth_amulet'
    ] as const),
    eliteMonsterId: 'mutation_guardian',
    soldOutRecoveryRewardPoints: 400
  }),
  silent_broadcast_tower: Object.freeze({
    id: 'equipment_hunt_silent_broadcast_tower',
    dungeonId: 'silent_broadcast_tower',
    clueNodeIds: Object.freeze(['north_signal_cache', 'south_signal_cache'] as const),
    equipmentPool: Object.freeze([
      'hushblade',
      'dead_air_headset',
      'anechoic_mantle',
      'last_channel_beacon'
    ] as const),
    eliteMonsterId: 'broadcast_warden',
    soldOutRecoveryRewardPoints: 400
  }),
  lost_shelter: Object.freeze({
    id: 'equipment_hunt_lost_shelter',
    dungeonId: 'lost_shelter',
    clueNodeIds: Object.freeze(['north_supply_cache', 'south_supply_cache'] as const),
    equipmentPool: Object.freeze([
      'rescue_carbine',
      'breach_shotgun',
      'triage_visor',
      'evacuation_plate',
      'blackbox_beacon'
    ] as const),
    eliteMonsterId: 'shelter_enforcer',
    soldOutRecoveryRewardPoints: 440
  }),
  false_testimony_court: Object.freeze({
    id: 'equipment_hunt_false_testimony',
    dungeonId: 'false_testimony_court',
    clueNodeIds: Object.freeze(['records_stacks', 'evidence_supply_cache'] as const),
    equipmentPool: Object.freeze([
      'cross_examiner_sabre',
      'forensic_visor',
      'custody_shell',
      'appeal_seal'
    ] as const),
    eliteMonsterId: 'archive_censor',
    soldOutRecoveryRewardPoints: 480
  }),
  combat_replay_stage: Object.freeze({
    id: 'equipment_hunt_combat_replay_stage',
    dungeonId: 'combat_replay_stage',
    clueNodeIds: Object.freeze(['script_stacks', 'film_supply_cache'] as const),
    equipmentPool: Object.freeze([
      'frame_engraver',
      'cue_visor',
      'buffer_plate',
      'thaw_metronome'
    ] as const),
    eliteMonsterId: 'continuity_editor',
    soldOutRecoveryRewardPoints: 520
  }),
  panopticon_city: Object.freeze({
    id: 'equipment_hunt_panopticon_city',
    dungeonId: 'panopticon_city',
    clueNodeIds: Object.freeze(['watchglass_cache', 'matte_supply'] as const),
    equipmentPool: Object.freeze([
      'blindline_cutter',
      'phase_coil_rifle',
      'predictive_visor',
      'matte_shell',
      'inverse_prism'
    ] as const),
    eliteMonsterId: 'blindspot_auditor',
    soldOutRecoveryRewardPoints: 560
  })
} as const satisfies Readonly<Record<DungeonId, EquipmentHuntDefinition>>);

const DUNGEON_IDS = Object.keys(EQUIPMENT_HUNT_DEFINITIONS) as DungeonId[];
const DUNGEON_ID_SET = new Set<string>(DUNGEON_IDS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const actualKeys = Object.keys(value);
  return (
    actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

function isDungeonId(value: unknown): value is DungeonId {
  return typeof value === 'string' && DUNGEON_ID_SET.has(value);
}

function isEquipmentIdInDungeon(value: unknown, dungeonId: DungeonId): value is EquipmentId {
  return (
    typeof value === 'string' &&
    DUNGEON_EQUIPMENT_POOLS[dungeonId].some((equipmentId) => equipmentId === value)
  );
}

export function getEquipmentHuntDefinition(dungeonId: DungeonId): EquipmentHuntDefinition {
  return EQUIPMENT_HUNT_DEFINITIONS[dungeonId];
}

export function getEquipmentHuntTargetIds(
  dungeonId: DungeonId,
  ownedEquipmentIds: readonly EquipmentId[]
): EquipmentId[] {
  const owned = new Set(ownedEquipmentIds);
  return DUNGEON_EQUIPMENT_POOLS[dungeonId].filter((equipmentId) => !owned.has(equipmentId));
}

export function normalizePreparedEquipmentHunt(value: unknown): PreparedEquipmentHunt {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['dungeonId', 'targetEquipmentId']) ||
    !isDungeonId(value.dungeonId) ||
    !isEquipmentIdInDungeon(value.targetEquipmentId, value.dungeonId)
  ) {
    throw new TypeError('Prepared equipment hunt must contain a valid dungeon target only.');
  }

  return {
    dungeonId: value.dungeonId,
    targetEquipmentId: value.targetEquipmentId
  };
}

export function normalizeEquipmentHuntRunState(value: unknown): EquipmentHuntRunState {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'rulesVersion',
      'dungeonId',
      'targetEquipmentId',
      'clueNodeIds',
      'crossedDungeonPortal'
    ]) ||
    value.rulesVersion !== EQUIPMENT_HUNT_RULES_VERSION ||
    !isDungeonId(value.dungeonId) ||
    !isEquipmentIdInDungeon(value.targetEquipmentId, value.dungeonId) ||
    typeof value.crossedDungeonPortal !== 'boolean'
  ) {
    throw new TypeError('Equipment hunt state is malformed or uses unsupported rules.');
  }

  const definition = getEquipmentHuntDefinition(value.dungeonId);
  if (
    !Array.isArray(value.clueNodeIds) ||
    value.clueNodeIds.length !== 2 ||
    value.clueNodeIds[0] !== definition.clueNodeIds[0] ||
    value.clueNodeIds[1] !== definition.clueNodeIds[1]
  ) {
    throw new TypeError('Equipment hunt clue nodes must match the frozen dungeon definition.');
  }

  return {
    rulesVersion: EQUIPMENT_HUNT_RULES_VERSION,
    dungeonId: value.dungeonId,
    targetEquipmentId: value.targetEquipmentId,
    clueNodeIds: [definition.clueNodeIds[0], definition.clueNodeIds[1]],
    crossedDungeonPortal: value.crossedDungeonPortal
  };
}

export function isEquipmentHuntRunState(value: unknown): value is EquipmentHuntRunState {
  try {
    normalizeEquipmentHuntRunState(value);
    return true;
  } catch {
    return false;
  }
}

export function createEquipmentHuntRunState(
  prepared: PreparedEquipmentHunt,
  dungeonId: DungeonId,
  ownedEquipmentIds: readonly EquipmentId[]
): EquipmentHuntRunState;
export function createEquipmentHuntRunState(
  prepared: undefined,
  dungeonId: DungeonId,
  ownedEquipmentIds: readonly EquipmentId[]
): undefined;
export function createEquipmentHuntRunState(
  prepared: PreparedEquipmentHunt | undefined,
  dungeonId: DungeonId,
  ownedEquipmentIds: readonly EquipmentId[]
): EquipmentHuntRunState | undefined;
export function createEquipmentHuntRunState(
  prepared: PreparedEquipmentHunt | undefined,
  dungeonId: DungeonId,
  ownedEquipmentIds: readonly EquipmentId[]
): EquipmentHuntRunState | undefined {
  if (prepared === undefined) return undefined;

  const normalizedPrepared = normalizePreparedEquipmentHunt(prepared);
  if (normalizedPrepared.dungeonId !== dungeonId) {
    throw new TypeError('Prepared equipment hunt does not match the current dungeon.');
  }
  if (!getEquipmentHuntTargetIds(dungeonId, ownedEquipmentIds).includes(normalizedPrepared.targetEquipmentId)) {
    throw new TypeError('Prepared equipment hunt target is no longer available.');
  }

  const definition = getEquipmentHuntDefinition(dungeonId);
  return {
    rulesVersion: EQUIPMENT_HUNT_RULES_VERSION,
    dungeonId,
    targetEquipmentId: normalizedPrepared.targetEquipmentId,
    clueNodeIds: [definition.clueNodeIds[0], definition.clueNodeIds[1]],
    crossedDungeonPortal: false
  };
}

export function getEquipmentHuntProgress(
  snapshot: EquipmentHuntRunState,
  currentDungeonId: DungeonId,
  clearedNodeIds: readonly string[],
  lootOffersMade: number
): EquipmentHuntProgress {
  const clearedNodes = new Set(clearedNodeIds);
  const clearedClueNodeIds = snapshot.clueNodeIds.filter((nodeId) => clearedNodes.has(nodeId));
  const eligible =
    snapshot.dungeonId === currentDungeonId &&
    !snapshot.crossedDungeonPortal &&
    lootOffersMade === 0;
  const qualifiedByNodeId = eligible ? clearedClueNodeIds[0] : undefined;

  return {
    targetEquipmentId: snapshot.targetEquipmentId,
    clearedClueNodeIds,
    ...(qualifiedByNodeId === undefined ? {} : { qualifiedByNodeId }),
    qualified: qualifiedByNodeId !== undefined,
    crossedDungeonPortal: snapshot.crossedDungeonPortal
  };
}

export function markEquipmentHuntPortalCrossed(
  snapshot: EquipmentHuntRunState
): EquipmentHuntRunState {
  if (snapshot.crossedDungeonPortal) return snapshot;

  return {
    ...snapshot,
    clueNodeIds: [snapshot.clueNodeIds[0], snapshot.clueNodeIds[1]],
    crossedDungeonPortal: true
  };
}
