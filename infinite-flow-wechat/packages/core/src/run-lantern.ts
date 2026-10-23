export const RUN_LANTERN_RULES_VERSION = 1 as const;

const RUN_LANTERN_DUNGEON_IDS = [
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
] as const;
const RUN_LANTERN_STATE_KEYS = ['rulesVersion', 'dungeonId', 'oil'] as const;
const RUN_LANTERN_LIT_NODES_KEY = 'litNodeIds';
const RUN_LANTERN_MAX_LIT_NODES = 64;

export type RunLanternDungeonId = (typeof RUN_LANTERN_DUNGEON_IDS)[number];

export type RunLanternDefinition = {
  readonly dungeonId: RunLanternDungeonId;
  readonly startOil: number;
  readonly supplyOil: number;
  readonly contactOilLoss: number;
  readonly supplyNodeIds: readonly string[];
};

/**
 * Every chapter is a 30-room grid, so all of them share the demon tower's lamp budget; only the
 * supply rooms differ: four plain chests per chapter (no relic, survey, hunt, event or seal room).
 */
function defineRunLantern(
  dungeonId: RunLanternDungeonId,
  supplyNodeIds: readonly [string, string, string, string]
): RunLanternDefinition {
  return { dungeonId, startOil: 12, supplyOil: 4, contactOilLoss: 2, supplyNodeIds };
}

export const RUN_LANTERN_CATALOG = {
  demon_tower_1: defineRunLantern('demon_tower_1', ['north_supply_niche', 'evac_supply_cache', 'last_blessing_reward', 'quiet_prayer_reward']),
  metro_abyss: defineRunLantern('metro_abyss', ['drainage_cache', 'lampbox_supply', 'tideline_first_aid', 'wet_ticket_hall']),
  starfall_mine: defineRunLantern('starfall_mine', ['hanging_lamp_cache', 'gravity_branch_reward', 'rail_map_reward', 'rift_dust_reward']),
  rust_hospital: defineRunLantern('rust_hospital', ['medicine_cabinet', 'contaminated_ward_reward', 'backup_generator_reward', 'surgical_theater_reward']),
  ash_arena: defineRunLantern('ash_arena', ['spectator_cache', 'ash_purse', 'chant_cache', 'champion_branch_reward']),
  dream_archive: defineRunLantern('dream_archive', ['incense_reward', 'footnote_cache_reward', 'forgotten_method_reward', 'white_page_reward']),
  void_citadel: defineRunLantern('void_citadel', ['mirror_supply', 'fallback_medicine_reward', 'last_resource_point', 'echo_branch_cache']),
  temporal_observatory: defineRunLantern('temporal_observatory', ['entry_chronometer', 'future_supply', 'past_shortcut_foyer', 'future_shortcut_foyer']),
  causal_clearinghouse: defineRunLantern('causal_clearinghouse', ['effect_supply', 'cause_foyer', 'effect_foyer', 'verdict_bridge']),
  entropy_ark: defineRunLantern('entropy_ark', ['port_supply', 'starboard_supply', 'bow_heading_console', 'stern_heading_console']),
  mirror_cycle_city: defineRunLantern('mirror_cycle_city', ['real_supply_alcove', 'mirror_supply_alcove', 'real_anchor', 'mirror_anchor']),
  redaction_scriptorium: defineRunLantern('redaction_scriptorium', ['upper_supply_margin', 'lower_supply_margin', 'memory_clause_desk', 'body_proof_vault']),
  legacy_auction_court: defineRunLantern('legacy_auction_court', ['lower_bid_supply', 'force_claim_vault', 'guard_claim_vault', 'return_claim_vault']),
  genesis_vault: defineRunLantern('genesis_vault', ['lower_serum_supply', 'renewal_gene_vault', 'force_gene_vault', 'art_gene_vault']),
  silent_broadcast_tower: defineRunLantern('silent_broadcast_tower', ['emergency_shelter', 'resonance_vault', 'silent_archive', 'balanced_switchboard']),
  lost_shelter: defineRunLantern('lost_shelter', ['emergency_medbay', 'balanced_medbay', 'north_checkpoint', 'south_checkpoint']),
  false_testimony_court: defineRunLantern('false_testimony_court', ['lower_entry', 'north_entry', 'appeal_desk', 'false_verdict_vault']),
  combat_replay_stage: defineRunLantern('combat_replay_stage', ['opening_prop_cache', 'lower_entry', 'burst_route', 'afterbeat_route']),
  panopticon_city: defineRunLantern('panopticon_city', ['north_blind_relay', 'central_blind_relay', 'south_blind_relay', 'refraction_route'])
} as const satisfies Readonly<Record<RunLanternDungeonId, RunLanternDefinition>>;

export type RunLanternState = {
  readonly rulesVersion: typeof RUN_LANTERN_RULES_VERSION;
  readonly dungeonId: RunLanternDungeonId;
  readonly oil: number;
  /** Rooms the lamp has already lit; stepping back into one burns no oil. Missing on older runs. */
  readonly litNodeIds?: readonly string[];
};

export type RunLanternBurnResult = {
  readonly state: RunLanternState;
  readonly burned: number;
  /** True only on the burn that takes the lamp from lit to empty. */
  readonly exhausted: boolean;
};

export type RunLanternRefillResult = {
  readonly state: RunLanternState;
  readonly gained: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Every required key, plus only the optional lit-room list. */
function hasLanternKeys(value: Record<string, unknown>): boolean {
  const actualKeys = Object.keys(value);
  return (
    RUN_LANTERN_STATE_KEYS.every((key) => actualKeys.includes(key)) &&
    actualKeys.every((key) => (RUN_LANTERN_STATE_KEYS as readonly string[]).includes(key) || key === RUN_LANTERN_LIT_NODES_KEY)
  );
}

function isLitNodeIdList(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.length <= RUN_LANTERN_MAX_LIT_NODES &&
    value.every((nodeId, index) => typeof nodeId === 'string' && nodeId.length > 0 && value.indexOf(nodeId) === index)
  );
}

function isRunLanternDungeonId(value: unknown): value is RunLanternDungeonId {
  return typeof value === 'string' && (RUN_LANTERN_DUNGEON_IDS as readonly string[]).includes(value);
}

function toSafeAmount(value: number): number {
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

export function getRunLanternDefinition(dungeonId: string): RunLanternDefinition | undefined {
  return isRunLanternDungeonId(dungeonId) ? RUN_LANTERN_CATALOG[dungeonId] : undefined;
}

/** The most oil a run can ever hold: the starting lamp plus every supply room refilling once. */
export function getRunLanternMaxOil(definition: RunLanternDefinition): number {
  return definition.startOil + definition.supplyOil * definition.supplyNodeIds.length;
}

/** A full lamp that already lights the entry room. */
export function createRunLanternState(dungeonId: string, entryNodeId: string): RunLanternState | undefined {
  const definition = getRunLanternDefinition(dungeonId);
  if (!definition) return undefined;

  return {
    rulesVersion: RUN_LANTERN_RULES_VERSION,
    dungeonId: definition.dungeonId,
    oil: definition.startOil,
    litNodeIds: [entryNodeId]
  };
}

export function normalizeRunLanternState(value: unknown): RunLanternState | undefined {
  if (
    !isRecord(value) ||
    !hasLanternKeys(value) ||
    (value.litNodeIds !== undefined && !isLitNodeIdList(value.litNodeIds)) ||
    value.rulesVersion !== RUN_LANTERN_RULES_VERSION ||
    !isRunLanternDungeonId(value.dungeonId) ||
    typeof value.oil !== 'number' ||
    !Number.isSafeInteger(value.oil) ||
    value.oil < 0 ||
    value.oil > getRunLanternMaxOil(RUN_LANTERN_CATALOG[value.dungeonId])
  ) {
    return undefined;
  }

  return {
    rulesVersion: RUN_LANTERN_RULES_VERSION,
    dungeonId: value.dungeonId,
    oil: value.oil,
    ...(value.litNodeIds === undefined ? {} : { litNodeIds: [...(value.litNodeIds as readonly string[])] })
  };
}

export function isRunLanternState(value: unknown): value is RunLanternState {
  return normalizeRunLanternState(value) !== undefined;
}

export function burnRunLanternOil(state: RunLanternState, amount: number): RunLanternBurnResult {
  const burned = Math.min(state.oil, toSafeAmount(amount));
  if (burned === 0) return { state, burned: 0, exhausted: false };

  const oil = state.oil - burned;
  return {
    state: { ...state, oil },
    burned,
    exhausted: oil === 0
  };
}

export function isRunLanternNodeLit(state: RunLanternState, nodeId: string): boolean {
  return state.litNodeIds?.includes(nodeId) ?? false;
}

/** Adds rooms to the lit list; an older run without one starts its list here. */
export function lightRunLanternNodes(state: RunLanternState, nodeIds: readonly string[]): RunLanternState {
  const litNodeIds = state.litNodeIds ?? [];
  const added = nodeIds.filter((nodeId, index) => nodeId.length > 0 && !litNodeIds.includes(nodeId) && nodeIds.indexOf(nodeId) === index);
  if (added.length === 0 && state.litNodeIds !== undefined) return state;
  return { ...state, litNodeIds: [...litNodeIds, ...added] };
}

export function isRunLanternSupplyNode(dungeonId: string, nodeId: string): boolean {
  return getRunLanternDefinition(dungeonId)?.supplyNodeIds.includes(nodeId) ?? false;
}

export function refillRunLanternAtNode(state: RunLanternState, nodeId: string): RunLanternRefillResult {
  const definition: RunLanternDefinition = RUN_LANTERN_CATALOG[state.dungeonId];
  if (!definition.supplyNodeIds.includes(nodeId)) return { state, gained: 0 };

  const gained = Math.max(0, Math.min(definition.supplyOil, getRunLanternMaxOil(definition) - state.oil));
  return {
    state: { ...state, oil: state.oil + gained },
    gained
  };
}
