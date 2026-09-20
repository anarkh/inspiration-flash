import {
  BLOODLINE_RULES_VERSION,
  COMPANION_RULES_VERSION,
  DEFAULT_PREPARED_TACTICAL_ITEM_IDS,
  DUNGEONS,
  EQUIPMENT,
  EQUIPMENT_SLOTS,
  ITEMS,
  METHODS,
  MONSTERS,
  PETS,
  createInitialState,
  getCurrentRunMethodSnapshots,
  getBloodlineRank,
  getDerivedStats,
  getEquipmentMemoryHuntProgress,
  getInfernoUnlockedTier,
  getRunPursuitDefinition,
  getRouteContractById,
  getRunDiscoveredNodeIds,
  normalizeBloodlineProgress,
  normalizeBloodlineRunSnapshot,
  normalizeCombatReplayCombatState,
  normalizeCombatReplayRunState,
  normalizeCompanionProgress,
  normalizeCompanionRunSnapshot,
  normalizeEquipmentMemoryCombatState,
  normalizeEquipmentMemoryHuntRunState,
  normalizeEquipmentMemoryMap,
  normalizeEquipmentMemoryRunSnapshot,
  normalizeMethodCultivationProgress,
  normalizeMethodRunSnapshot,
  normalizeMethodRunSnapshots,
  normalizePreparedEquipmentMemoryHunt,
  normalizeRunPursuitState,
  resolveRunFailure,
  sanitizeEquipmentMemoryMap,
  type ActiveEquipmentCommission,
  type BloodlineId,
  type BloodlineRank,
  type BloodlineRunSnapshot,
  type CombatReplayCombatState,
  type CombatReplayRunState,
  type CombatState,
  type CompanionId,
  type CompanionRank,
  type CompanionRunSnapshot,
  type DungeonId,
  type DungeonRun,
  type EquipmentId,
  type EquipmentMemoryCombatState,
  type EquipmentMemoryHuntRunState,
  type EquipmentMemoryHuntSettlement,
  type EquipmentMemoryMap,
  type EquipmentMemoryRunSnapshot,
  type EquipmentRollSettlement,
  type EquipmentCommissionSettlement,
  type EquipmentSlot,
  type GameState,
  type ItemId,
  type MethodId,
  type MethodRank,
  type MethodRunSnapshot,
  type PreparedEquipmentMemoryHunt,
  type RouteContractRunState,
  type RouteContractSettlement,
  type RunPressureSettlement,
  type RunPursuitState,
  type RunPursuitSettlement,
  type RunProtocolSettlement,
  type RunProtocolSnapshot,
  type RunRelicSettlement
} from '@infinite-flow/core';
import {
  EQUIPMENT_COMMISSION_MATERIAL_REWARD,
  EQUIPMENT_COMMISSION_REQUIRED_DUNGEONS,
  normalizeEquipmentCommission,
  type EquipmentCommissionValidators
} from '@infinite-flow/core/equipment-commissions';
import {
  getEquipmentAttunementOptions,
  getEquipmentTemperDefinition,
  type EquipmentAttunementId,
  type EquipmentAttunementMap,
  type EquipmentTemperMap
} from '@infinite-flow/core/equipment-system';
import { COMBAT_FOCUS_MAX } from '@infinite-flow/core/combat-focus';
import {
  createEmptyRunLootBag,
  type RunLootBag,
  type RunLootSettlement
} from '@infinite-flow/core/run-economy';
import { EXPLORATION_REWARD_VERSION } from '@infinite-flow/core/exploration-rewards';
import {
  getRunProtocolDefinition,
  getRunProtocolRequiredNodeIds,
  type DeepRunProtocolDefinition
} from '@infinite-flow/core/run-protocols';
import {
  isEquipmentRoll,
  sanitizeEquipmentRollMap,
  type EquipmentRoll,
  type EquipmentRollMap
} from '@infinite-flow/core/equipment-rolls';
import {
  getInfernoConnectionIds,
  isInfernoMapSnapshot,
  repairInfernoMapSnapshot,
  sanitizeInfernoProgress,
  type InfernoProgress
} from '@infinite-flow/core/inferno-system';
import { getBossDefinition } from '@infinite-flow/core/boss-system';
import {
  isTacticalItemId,
  type TacticalItemId,
  type TacticalLoadoutSnapshot
} from '@infinite-flow/core/tactical-loadout';
import {
  RUN_RELIC_DEFINITIONS,
  isRunRelicFrame,
  isRunRelicId,
  isRunRelicState,
  type RunRelicFrame,
  type RunRelicId,
  type RunRelicState
} from '@infinite-flow/core/run-relics';
import {
  getEquipmentRelicConduitByEquipmentId,
  type RelicConduitEquipmentId
} from '@infinite-flow/core/equipment-relic-conduits';
import {
  isEquipmentSoulSkillRunState,
  normalizeEquipmentSoulSkillRunState,
  type EquipmentSoulSkillRunState
} from '@infinite-flow/core/equipment-soul-skills';
import {
  isFieldSurveyRunState,
  normalizeFieldSurveyRunState,
  type FieldSurveyRunState
} from '@infinite-flow/core/field-surveys';
import {
  isEquipmentHuntRunState,
  normalizeEquipmentHuntRunState,
  normalizePreparedEquipmentHunt,
  type PreparedEquipmentHunt
} from '@infinite-flow/core/equipment-hunts';
import {
  isRunPressureState,
  normalizeRunPressureState,
  type RunPressureState,
  type RunPressureTier
} from '@infinite-flow/core/run-pressure';
import {
  getRouteContractProgress,
  isOrderedRouteContractReachable,
  normalizeRouteContractRunState
} from '@infinite-flow/core/route-contracts';
import { normalizeDungeonLawState } from '@infinite-flow/core/dungeon-laws';
import {
  METHOD_CULTIVATION_RULES_VERSION,
  getMethodRank as getCultivationMethodRank,
  isMethodRank
} from '@infinite-flow/core/method-cultivation';

type EquipmentMemoryDungeonRun = DungeonRun & {
  equipmentMemorySnapshot?: EquipmentMemoryRunSnapshot;
  equipmentMemoryHunt?: EquipmentMemoryHuntRunState;
  lastEquipmentMemoryHuntSettlement?: EquipmentMemoryHuntSettlement;
  methodSnapshots?: readonly MethodRunSnapshot[];
  methodSnapshot?: MethodRunSnapshot;
  bloodlineSnapshot?: BloodlineRunSnapshot;
};
type EquipmentMemoryCombat = CombatState & {
  equipmentMemoryState?: EquipmentMemoryCombatState;
  methodTechniqueUsedIds?: MethodId[];
  methodTechniqueUsed?: boolean;
  bloodlineSurgeUsed?: boolean;
  bloodlineBarrier?: number;
};
export type EquipmentMemoryGameState = GameState;
type SavedEquipped = Partial<Record<EquipmentSlot, EquipmentId>>
  & Record<'weapon' | 'armor' | 'charm', EquipmentId>;
type SavedInventory = Record<
  Exclude<
    ItemId,
    | 'cycle_imprint'
    | 'chronal_glass'
    | 'phase_glass'
    | 'redaction_ink'
    | 'legacy_scrip'
    | 'genesis_serum'
    | 'silence_core'
    | 'rescue_badge'
    | 'truth_fragment'
    | 'combat_reel'
    | 'observation_shard'
  >,
  number
> & {
  cycle_imprint?: number;
  chronal_glass?: number;
  phase_glass?: number;
  redaction_ink?: number;
  legacy_scrip?: number;
  genesis_serum?: number;
  silence_core?: number;
  rescue_badge?: number;
  truth_fragment?: number;
  combat_reel?: number;
  observation_shard?: number;
};
type SavedDungeonRun = Omit<
  EquipmentMemoryDungeonRun,
  | 'lootBag'
  | 'lootOffersMade'
  | 'tacticalLoadout'
  | 'protocol'
  | 'relicState'
  | 'relicConduitSourceEquipmentIds'
  | 'soulSkillState'
  | 'fieldSurveyState'
  | 'equipmentHunt'
  | 'lawState'
  | 'pressureState'
  | 'routeContractState'
  | 'lastRouteContractSettlement'
  | 'lastPressureSettlement'
  | 'lastRelicSettlement'
  | 'lastEquipmentCommissionSettlement'
  | 'equipmentMemorySnapshot'
  | 'equipmentMemoryHunt'
  | 'lastEquipmentMemoryHuntSettlement'
  | 'pursuitState'
  | 'lastPursuitSettlement'
  | 'companionSnapshot'
  | 'methodSnapshots'
  | 'methodSnapshot'
  | 'bloodlineSnapshot'
  | 'combatReplayState'
> & {
  lootBag?: RunLootBag<ItemId, EquipmentId>;
  lootOffersMade?: number;
  tacticalLoadout?: TacticalLoadoutSnapshot;
  protocol?: RunProtocolSnapshot;
  relicState?: RunRelicState;
  relicConduitSourceEquipmentIds?: RelicConduitEquipmentId[];
  soulSkillState?: EquipmentSoulSkillRunState;
  fieldSurveyState?: FieldSurveyRunState;
  equipmentHunt?: EquipmentMemoryDungeonRun['equipmentHunt'];
  lawState?: unknown;
  pressureState?: RunPressureState;
  routeContractState?: RouteContractRunState;
  lastRouteContractSettlement?: RouteContractSettlement;
  lastPressureSettlement?: RunPressureSettlement;
  lastRelicSettlement?: DungeonRun['lastRelicSettlement'];
  lastEquipmentCommissionSettlement?: EquipmentCommissionSettlement;
  equipmentMemorySnapshot?: EquipmentMemoryRunSnapshot;
  equipmentMemoryHunt?: EquipmentMemoryHuntRunState;
  lastEquipmentMemoryHuntSettlement?: EquipmentMemoryHuntSettlement;
  pursuitState?: DungeonRun['pursuitState'];
  lastPursuitSettlement?: RunPursuitSettlement;
  companionSnapshot?: CompanionRunSnapshot;
  methodSnapshots?: readonly MethodRunSnapshot[];
  methodSnapshot?: MethodRunSnapshot;
  bloodlineSnapshot?: BloodlineRunSnapshot;
  combatReplayState?: CombatReplayRunState;
};
type SavedCombat = Omit<
  EquipmentMemoryCombat,
  | 'equipmentMemoryState'
  | 'methodTechniqueUsedIds'
  | 'methodTechniqueUsed'
  | 'bloodlineSurgeUsed'
  | 'bloodlineBarrier'
  | 'combatReplayState'
> & {
  equipmentMemoryState?: EquipmentMemoryCombatState;
  methodTechniqueUsedIds?: MethodId[];
  methodTechniqueUsed?: boolean;
  bloodlineSurgeUsed?: boolean;
  bloodlineBarrier?: number;
  combatReplayState?: CombatReplayCombatState;
};
export type SavedGameState = Omit<
  EquipmentMemoryGameState,
  | 'claimedTaskIds'
  | 'equipped'
  | 'equipmentAttunements'
  | 'equipmentTemperRanks'
  | 'equipmentCommission'
  | 'inventory'
  | 'preparedItemIds'
  | 'preparedRelicFrame'
  | 'archivedRelicIds'
  | 'preparedRelicSeedId'
  | 'preparedEquipmentHunt'
  | 'equipmentMemories'
  | 'preparedEquipmentMemoryHunt'
  | 'ownedCompanions'
  | 'companionRanks'
  | 'activeCompanion'
  | 'methodRanks'
  | 'activeMethod'
  | 'bloodlineRanks'
  | 'activeBloodline'
  | 'run'
  | 'combat'
> & {
  claimedTaskIds?: string[];
  equipped: SavedEquipped;
  equipmentAttunements?: EquipmentAttunementMap;
  equipmentTemperRanks?: EquipmentTemperMap;
  equipmentCommission?: ActiveEquipmentCommission;
  inventory: SavedInventory;
  preparedItemIds?: TacticalItemId[];
  preparedRelicFrame?: RunRelicFrame;
  archivedRelicIds?: RunRelicId[];
  preparedRelicSeedId?: RunRelicId;
  preparedEquipmentHunt?: PreparedEquipmentHunt;
  equipmentMemories?: EquipmentMemoryMap;
  preparedEquipmentMemoryHunt?: PreparedEquipmentMemoryHunt;
  ownedCompanions?: CompanionId[];
  companionRanks?: Partial<Record<CompanionId, CompanionRank>>;
  activeCompanion?: CompanionId;
  methodRanks?: Partial<Record<MethodId, MethodRank>>;
  activeMethod?: MethodId;
  bloodlineRanks?: Partial<Record<BloodlineId, BloodlineRank>>;
  activeBloodline?: BloodlineId;
  run?: SavedDungeonRun;
  combat?: SavedCombat;
};

const REPLACED_COMBAT_ENCOUNTER_MIGRATIONS = [
  {
    dungeonId: 'lost_shelter',
    nodeId: 'north_rescue_patrol',
    legacyMonsterId: 'mimic_survivor',
    monsterId: 'rogue_sentry'
  },
  {
    dungeonId: 'panopticon_city',
    nodeId: 'sweep_sentinel_north',
    legacyMonsterId: 'sweep_sentinel',
    monsterId: 'phase_hunter_drone'
  }
] as const;
const equipmentAttunementIds: readonly EquipmentAttunementId[] = [
  'mist_vanguard',
  'mist_veilguard',
  'forge_overdrive',
  'forge_channeling',
  'rift_resonance',
  'rift_anchor',
  'chronal_acceleration',
  'chronal_stasis'
];
const equipmentCommissionValidators: EquipmentCommissionValidators<
  EquipmentId,
  ItemId,
  DungeonId
> = {
  isEquipmentId: (value): value is EquipmentId => hasOwnKey(EQUIPMENT, value),
  isItemId: (value): value is ItemId => hasOwnKey(ITEMS, value),
  isDungeonId: (value): value is DungeonId => hasOwnKey(DUNGEONS, value)
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isNumberMap(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every(isFiniteNumber);
}

function hasOwnKey(source: object, key: unknown): key is string {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(source, key);
}

function isKnownStringArray(value: unknown, source: object): value is string[] {
  return isStringArray(value) && value.every((entry) => hasOwnKey(source, entry));
}

function isKnownNumberMap(value: unknown, source: object): value is Record<string, number> {
  return isNumberMap(value) && Object.keys(value).every((entry) => hasOwnKey(source, entry));
}

function isEquipmentSlotKey(value: unknown): value is EquipmentSlot {
  return typeof value === 'string' && (EQUIPMENT_SLOTS as readonly string[]).includes(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isSavedInventory(value: unknown): value is SavedInventory {
  if (!isRecord(value)) return false;

  const requiredItemIds = (Object.keys(ITEMS) as ItemId[]).filter(
    (itemId) => itemId !== 'cycle_imprint' && itemId !== 'chronal_glass' && itemId !== 'phase_glass' && itemId !== 'redaction_ink' && itemId !== 'legacy_scrip' && itemId !== 'genesis_serum' && itemId !== 'silence_core' && itemId !== 'rescue_badge' && itemId !== 'truth_fragment' && itemId !== 'combat_reel' && String(itemId) !== 'observation_shard'
  );
  return (
    requiredItemIds.every((itemId) => isNonNegativeInteger(value[itemId])) &&
    (value.cycle_imprint === undefined || isNonNegativeInteger(value.cycle_imprint)) &&
    (value.chronal_glass === undefined || isNonNegativeInteger(value.chronal_glass)) &&
    (value.phase_glass === undefined || isNonNegativeInteger(value.phase_glass)) &&
    (value.redaction_ink === undefined || isNonNegativeInteger(value.redaction_ink)) &&
    (value.legacy_scrip === undefined || isNonNegativeInteger(value.legacy_scrip)) &&
    (value.genesis_serum === undefined || isNonNegativeInteger(value.genesis_serum)) &&
    (value.silence_core === undefined || isNonNegativeInteger(value.silence_core)) &&
    (value.rescue_badge === undefined || isNonNegativeInteger(value.rescue_badge)) &&
    (value.truth_fragment === undefined || isNonNegativeInteger(value.truth_fragment)) &&
    (value.combat_reel === undefined || isNonNegativeInteger(value.combat_reel)) &&
    (value.observation_shard === undefined || isNonNegativeInteger(value.observation_shard)) &&
    Object.entries(value).every(([itemId, amount]) => hasOwnKey(ITEMS, itemId) && isNonNegativeInteger(amount))
  );
}

function isSavedBossPhase(value: unknown): boolean {
  return value === undefined || value === 'sealed' || value === 'awakened';
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}

function isSavedCombatEffects(value: unknown): value is NonNullable<CombatState['effects']> {
  if (!isRecord(value)) return false;

  const knownKeys = new Set<string>([
    'rustPoisonStacks',
    'armorCracked',
    'lastShiftTurn',
    'revivedOnce',
    'echoCopiedStat',
    'echoCopiedValue',
    'lastPlayerAction',
    'breathStacks',
    'mirrorSlowStacks',
    'railHeavyDodgeUsed',
    'reserveBidDamage',
    'provenanceShield',
    'frequencyLockAction',
    'broadcastWardKind',
    'deadAirEcho',
    'mimicHesitation',
    'shelterWardKind',
    'evacuationPanicStacks',
    'witnessContradiction',
    'censorSealKind',
    'perjuryPressureStacks'
  ]);
  const optionalBoolean = (candidate: unknown) => candidate === undefined || typeof candidate === 'boolean';
  const optionalInteger = (candidate: unknown, maximum = Number.MAX_SAFE_INTEGER) =>
    candidate === undefined || isIntegerInRange(candidate, 0, maximum);

  return (
    Object.keys(value).every((key) => knownKeys.has(key)) &&
    optionalInteger(value.rustPoisonStacks, 3) &&
    optionalBoolean(value.armorCracked) &&
    optionalInteger(value.lastShiftTurn) &&
    optionalBoolean(value.revivedOnce) &&
    (value.echoCopiedStat === undefined || ['attack', 'artPower', 'defense', 'speed'].includes(String(value.echoCopiedStat))) &&
    optionalInteger(value.echoCopiedValue) &&
    (value.lastPlayerAction === undefined ||
      ['attack', 'art', 'guard', 'use_healing_pill', 'use_thunder_talisman'].includes(String(value.lastPlayerAction))) &&
    optionalInteger(value.breathStacks, 3) &&
    optionalInteger(value.mirrorSlowStacks, 2) &&
    optionalBoolean(value.railHeavyDodgeUsed) &&
    (value.reserveBidDamage === undefined || isIntegerInRange(value.reserveBidDamage, 1, Number.MAX_SAFE_INTEGER)) &&
    optionalBoolean(value.provenanceShield) &&
    (value.frequencyLockAction === undefined || value.frequencyLockAction === 'attack' || value.frequencyLockAction === 'art') &&
    (value.broadcastWardKind === undefined ||
      value.broadcastWardKind === 'physical' ||
      value.broadcastWardKind === 'art' ||
      value.broadcastWardKind === 'talisman') &&
    optionalBoolean(value.deadAirEcho) &&
    optionalBoolean(value.mimicHesitation) &&
    (value.shelterWardKind === undefined ||
      value.shelterWardKind === 'physical' ||
      value.shelterWardKind === 'art' ||
      value.shelterWardKind === 'talisman') &&
    optionalInteger(value.evacuationPanicStacks, 2) &&
    optionalBoolean(value.witnessContradiction) &&
    (value.censorSealKind === undefined ||
      value.censorSealKind === 'attack' ||
      value.censorSealKind === 'art' ||
      value.censorSealKind === 'talisman') &&
    optionalInteger(value.perjuryPressureStacks, 2)
  );
}

function isSavedRunLootItems(value: unknown): value is Partial<Record<ItemId, number>> {
  return (
    isRecord(value) &&
    Object.entries(value).every(([itemId, amount]) => hasOwnKey(ITEMS, itemId) && isNonNegativeInteger(amount))
  );
}

function isSavedRunLootBag(value: unknown): value is RunLootBag<ItemId, EquipmentId> {
  if (!isRecord(value) || !isKnownStringArray(value.equipmentIds, EQUIPMENT)) return false;

  return (
    isNonNegativeInteger(value.rewardPoints) &&
    isNonNegativeInteger(value.lingyun) &&
    isSavedRunLootItems(value.items) &&
    new Set(value.equipmentIds).size === value.equipmentIds.length
  );
}

function isSavedEquipmentRollMap(
  value: unknown,
  allowedEquipmentIds?: readonly EquipmentId[]
): value is EquipmentRollMap {
  if (!isRecord(value)) return false;
  const allowed = allowedEquipmentIds ? new Set(allowedEquipmentIds) : undefined;
  return Object.entries(value).every(
    ([equipmentId, roll]) =>
      hasOwnKey(EQUIPMENT, equipmentId) &&
      (!allowed || allowed.has(equipmentId as EquipmentId)) &&
      isEquipmentRoll(roll)
  );
}

function isSavedPendingEquipmentOffer(value: unknown): value is NonNullable<DungeonRun['pendingEquipmentOffer']> {
  if (!isRecord(value) || !isKnownStringArray(value.equipmentIds, EQUIPMENT)) return false;

  return (
    typeof value.offerId === 'string' &&
    value.offerId.length > 0 &&
    value.equipmentIds.length > 0 &&
    value.equipmentIds.length <= 3 &&
    new Set(value.equipmentIds).size === value.equipmentIds.length &&
    (value.equipmentRolls === undefined ||
      isSavedEquipmentRollMap(value.equipmentRolls, value.equipmentIds as EquipmentId[])) &&
    (value.guaranteedEquipmentId === undefined ||
      (typeof value.guaranteedEquipmentId === 'string' &&
        hasOwnKey(EQUIPMENT, value.guaranteedEquipmentId) &&
        value.equipmentIds.includes(value.guaranteedEquipmentId)))
  );
}

function isSavedRunLootSettlement(value: unknown): value is RunLootSettlement<ItemId, EquipmentId> {
  return isRecord(value) && isSavedRunLootBag(value.retained) && isSavedRunLootBag(value.lost);
}

function isSavedEquipmentLevels(value: unknown): value is Partial<Record<EquipmentId, number>> {
  if (!isRecord(value)) return false;

  return Object.entries(value).every(
    ([equipmentId, level]) =>
      hasOwnKey(EQUIPMENT, equipmentId) && isPositiveInteger(level) && level <= EQUIPMENT[equipmentId as EquipmentId].maxLevel
  );
}

function isSavedInfernoProgress(
  value: unknown,
  completedDungeonIds: readonly DungeonId[]
): value is InfernoProgress {
  if (!isRecord(value)) return false;
  const completed = new Set(completedDungeonIds);
  return Object.entries(value).every(
    ([dungeonId, tier]) =>
      hasOwnKey(DUNGEONS, dungeonId) &&
      completed.has(dungeonId as DungeonId) &&
      Number.isSafeInteger(tier) &&
      Number(tier) >= 1
  );
}

function isSavedEquipmentAttunements(
  value: unknown,
  ownedEquipment: readonly EquipmentId[],
  equipmentLevels: Partial<Record<EquipmentId, number>>
): value is EquipmentAttunementMap {
  if (!isRecord(value)) return false;

  return Object.entries(value).every(([equipmentId, attunementId]) => {
    if (
      !hasOwnKey(EQUIPMENT, equipmentId) ||
      typeof attunementId !== 'string' ||
      !equipmentAttunementIds.includes(attunementId as EquipmentAttunementId)
    ) {
      return false;
    }

    const typedEquipmentId = equipmentId as EquipmentId;
    const typedAttunementId = attunementId as EquipmentAttunementId;
    return (
      ownedEquipment.includes(typedEquipmentId) &&
      equipmentLevels[typedEquipmentId] === EQUIPMENT[typedEquipmentId].maxLevel &&
      getEquipmentAttunementOptions(typedEquipmentId).some((option) => option.id === typedAttunementId)
    );
  });
}

function isSavedEquipmentTemperRanks(
  value: unknown,
  ownedEquipment: readonly EquipmentId[],
  equipmentLevels: Partial<Record<EquipmentId, number>>,
  equipmentAttunements: EquipmentAttunementMap
): value is EquipmentTemperMap {
  if (!isRecord(value)) return false;

  return Object.entries(value).every(([equipmentId, rank]) => {
    if (!hasOwnKey(EQUIPMENT, equipmentId) || (rank !== 1 && rank !== 2)) return false;

    const typedEquipmentId = equipmentId as EquipmentId;
    if (
      !getEquipmentTemperDefinition(typedEquipmentId).eligible ||
      !ownedEquipment.includes(typedEquipmentId) ||
      equipmentLevels[typedEquipmentId] !== EQUIPMENT[typedEquipmentId].maxLevel
    ) {
      return false;
    }
    if (rank === 1) return true;

    const attunementId = equipmentAttunements[typedEquipmentId];
    return getEquipmentAttunementOptions(typedEquipmentId).some((option) => option.id === attunementId);
  });
}

function isKnownEquipmentForSlot(value: unknown, slot: EquipmentSlot): value is EquipmentId {
  return hasOwnKey(EQUIPMENT, value) && EQUIPMENT[value as EquipmentId].slot === slot;
}

function isSavedEquipped(value: unknown): value is SavedEquipped {
  if (!isRecord(value)) return false;

  return (
    isKnownEquipmentForSlot(value.weapon, 'weapon') &&
    isKnownEquipmentForSlot(value.armor, 'armor') &&
    isKnownEquipmentForSlot(value.charm, 'charm') &&
    Object.entries(value).every(([slot, equipmentId]) => isEquipmentSlotKey(slot) && isKnownEquipmentForSlot(equipmentId, slot))
  );
}

function isSavedEquipmentProgressionConsistent(
  ownedEquipment: readonly EquipmentId[],
  equipmentLevels: Partial<Record<EquipmentId, number>>,
  equipped: SavedEquipped
): boolean {
  const ownedEquipmentIds = new Set(ownedEquipment);
  const equippedIds = Object.values(equipped);

  // Normalization can add missing starter slots for old saves, but saved equipped items must not be phantom gear.
  if (!equippedIds.every((equipmentId) => ownedEquipmentIds.has(equipmentId))) return false;

  return (Object.keys(equipmentLevels) as EquipmentId[]).every(
    (equipmentId) => ownedEquipmentIds.has(equipmentId) || equippedIds.includes(equipmentId)
  );
}

function normalizeSavedActiveEquipmentCommission(value: unknown): ActiveEquipmentCommission | undefined {
  const normalized = normalizeEquipmentCommission(value, equipmentCommissionValidators);
  if (!normalized) return undefined;

  return {
    ...normalized,
    equipmentIds: [normalized.equipmentIds[0], normalized.equipmentIds[1]],
    completedDungeonIds: [...normalized.completedDungeonIds]
  };
}

function isSavedEquipmentCommissionConsistent(
  commission: ActiveEquipmentCommission,
  value: Record<string, unknown>
): boolean {
  if (
    !isKnownStringArray(value.ownedEquipment, EQUIPMENT) ||
    !isSavedEquipmentLevels(value.equipmentLevels) ||
    !isSavedEquipped(value.equipped)
  ) {
    return false;
  }

  const ownedEquipment = new Set(value.ownedEquipment as EquipmentId[]);
  const equippedEquipment = new Set(Object.values(value.equipped));
  const equipmentLevels = value.equipmentLevels as Partial<Record<EquipmentId, number>>;
  const eligible = commission.equipmentIds.every((equipmentId) => {
    const temperDefinition = getEquipmentTemperDefinition(equipmentId);
    return (
      ownedEquipment.has(equipmentId) &&
      equipmentLevels[equipmentId] === EQUIPMENT[equipmentId].maxLevel &&
      temperDefinition.eligible &&
      !equippedEquipment.has(equipmentId)
    );
  });
  const targetMatchesSelection = commission.equipmentIds.some(
    (equipmentId) => getEquipmentTemperDefinition(equipmentId).materialId === commission.targetMaterialId
  );

  return eligible && targetMatchesSelection;
}

function isSavedTacticalItemIds(value: unknown): value is TacticalItemId[] {
  return (
    Array.isArray(value) &&
    value.every((itemId): itemId is TacticalItemId => typeof itemId === 'string' && isTacticalItemId(itemId)) &&
    new Set(value).size === value.length
  );
}

function isSavedTacticalLoadoutSnapshot(value: unknown): value is TacticalLoadoutSnapshot {
  return isRecord(value) && value.rulesVersion === 1 && isSavedTacticalItemIds(value.itemIds);
}

function isSavedPreparedEquipmentHunt(value: unknown): value is PreparedEquipmentHunt {
  try {
    normalizePreparedEquipmentHunt(value);
    return true;
  } catch {
    return false;
  }
}

function isSavedRunProtocolSnapshot(value: unknown): value is RunProtocolSnapshot {
  return (
    isRecord(value) &&
    (value.id === 'standard' || value.id === 'imprint' || value.id === 'deep') &&
    value.rulesVersion === 1 &&
    (
      value.id === 'deep'
        ? value.infernoTier === undefined ||
          (Number.isSafeInteger(value.infernoTier) && Number(value.infernoTier) >= 1)
        : value.infernoTier === undefined
    )
  );
}

function isSavedEquipmentRollSettlement(value: unknown): value is EquipmentRollSettlement {
  return (
    isRecord(value) &&
    typeof value.equipmentId === 'string' &&
    hasOwnKey(EQUIPMENT, value.equipmentId) &&
    isEquipmentRoll(value.roll) &&
    (value.outcome === 'acquired' || value.outcome === 'upgraded' || value.outcome === 'salvaged') &&
    (value.previousItemPower === undefined ||
      (Number.isSafeInteger(value.previousItemPower) && Number(value.previousItemPower) >= 1)) &&
    isNonNegativeInteger(value.salvageRewardPoints)
  );
}

function isSavedRunProtocolSettlement(value: unknown, dungeonId: DungeonId): value is RunProtocolSettlement {
  if (
    !isRecord(value) ||
    !isSavedRunProtocolSnapshot(value.protocol) ||
    (value.protocol.id !== 'imprint' && value.protocol.id !== 'deep') ||
    (value.status !== 'succeeded' && value.status !== 'failed') ||
    typeof value.bossDefeated !== 'boolean' ||
    typeof value.anchorCompletedBeforeBoss !== 'boolean' ||
    !isNonNegativeInteger(value.baseRewardPoints) ||
    !isNonNegativeInteger(value.protocolRewardPoints) ||
    !isNonNegativeInteger(value.rewardPointBonus) ||
    typeof value.cycleImprintGranted !== 'boolean'
  ) {
    return false;
  }

  const isDeepSettlement = value.protocol.id === 'deep';
  const isLayeredInfernoSettlement =
    isDeepSettlement && value.protocol.infernoTier !== undefined;
  if (
    isLayeredInfernoSettlement &&
    (
      value.infernoTier !== value.protocol.infernoTier ||
      !Number.isSafeInteger(value.unlockedInfernoTier) ||
      Number(value.unlockedInfernoTier) < Number(value.infernoTier)
    )
  ) {
    return false;
  }
  if (
    !isLayeredInfernoSettlement &&
    (value.infernoTier !== undefined || value.unlockedInfernoTier !== undefined)
  ) {
    return false;
  }
  const deepDefinition = isDeepSettlement
    ? getRunProtocolDefinition(dungeonId, 'deep') as DeepRunProtocolDefinition | undefined
    : undefined;
  const hasExpectedDeepMaterialReward = (
    isDeepSettlement &&
    deepDefinition !== undefined &&
    isRecord(value.materialReward) &&
    value.materialReward.itemId === deepDefinition.materialReward.itemId &&
    value.materialReward.amount === deepDefinition.materialReward.amount
  );
  const materialRewardIsConsistent = isDeepSettlement && value.status === 'succeeded'
    ? isLayeredInfernoSettlement
      ? value.materialReward === undefined
      : hasExpectedDeepMaterialReward
    : value.materialReward === undefined;
  if (!materialRewardIsConsistent) return false;

  if (value.status === 'succeeded') {
    return (
      value.bossDefeated &&
      value.anchorCompletedBeforeBoss &&
      value.cycleImprintGranted === !isDeepSettlement &&
      value.protocolRewardPoints >= value.baseRewardPoints &&
      value.rewardPointBonus === value.protocolRewardPoints - value.baseRewardPoints
    );
  }

  return (
    !value.anchorCompletedBeforeBoss &&
    !value.cycleImprintGranted &&
    value.protocolRewardPoints === value.baseRewardPoints &&
    value.rewardPointBonus === 0
  );
}

function isRunPressureTier(value: unknown): value is RunPressureTier {
  return value === 'stable' || value === 'hunted' || value === 'breach';
}

function isSavedRunPressureSettlement(value: unknown): value is RunPressureSettlement {
  if (
    !isRecord(value) ||
    !isRunPressureState(value.state) ||
    !isRunPressureTier(value.tier) ||
    !isNonNegativeInteger(value.rewardPointBonus)
  ) {
    return false;
  }

  const count = value.state.clearedNodeCount;
  const expectedTier: RunPressureTier = count >= 12 ? 'breach' : count >= 6 ? 'hunted' : 'stable';
  return value.tier === expectedTier;
}

function isRunPursuitSettlementReason(value: unknown): value is RunPursuitSettlement['reason'] {
  return (
    value === 'successful_exit' ||
    value === 'retreat' ||
    value === 'failure' ||
    value === 'stable_portal' ||
    value === 'forced_portal'
  );
}

function hasExactRecordKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actualKeys = Object.keys(value);
  return actualKeys.length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function getRunPursuitNodeIds(dungeonId: string): readonly string[] | undefined {
  if (!hasOwnKey(DUNGEONS, dungeonId) || !getRunPursuitDefinition(dungeonId)) return undefined;
  return DUNGEONS[dungeonId as DungeonId].nodes.map((node) => node.id);
}

function normalizeSavedCurrentRunPursuitState(
  value: unknown,
  currentDungeonId: DungeonId
): RunPursuitState | undefined {
  const nodeIds = getRunPursuitNodeIds(currentDungeonId);
  if (!nodeIds) return undefined;

  const pursuitState = normalizeRunPursuitState(value, nodeIds);
  return pursuitState?.dungeonId === currentDungeonId ? pursuitState : undefined;
}

function normalizeSavedRunPursuitSettlement(
  value: unknown
): RunPursuitSettlement | undefined {
  if (
    !isRecord(value) ||
    !hasExactRecordKeys(value, ['state', 'reason', 'materialId', 'rewarded']) ||
    !isRecord(value.state) ||
    typeof value.state.dungeonId !== 'string' ||
    !isRunPursuitSettlementReason(value.reason) ||
    typeof value.rewarded !== 'boolean'
  ) {
    return undefined;
  }

  const definition = getRunPursuitDefinition(value.state.dungeonId);
  const nodeIds = getRunPursuitNodeIds(value.state.dungeonId);
  if (!definition || !nodeIds || value.materialId !== definition.materialId) return undefined;

  // Portal results carry their own origin dungeon; never validate them against the currently open run.
  const pursuitState = normalizeRunPursuitState(value.state, nodeIds);
  if (!pursuitState || pursuitState.dungeonId !== definition.dungeonId) return undefined;

  const expectedRewarded = pursuitState.status === 'contained' && value.reason === 'successful_exit';
  if (value.rewarded !== expectedRewarded) return undefined;

  return {
    state: pursuitState,
    reason: value.reason,
    materialId: definition.materialId,
    rewarded: expectedRewarded
  };
}

function isSavedRunRelicIds(value: unknown, expectedFrame?: RunRelicFrame): value is RunRelicId[] {
  return (
    Array.isArray(value) &&
    value.every(
      (relicId): relicId is RunRelicId =>
        isRunRelicId(relicId) &&
        (expectedFrame === undefined || RUN_RELIC_DEFINITIONS[relicId].frame === expectedFrame)
    ) &&
    new Set(value).size === value.length
  );
}

function isSavedRelicConduitEquipmentIds(
  value: unknown,
  frame: RunRelicFrame
): value is RelicConduitEquipmentId[] {
  return (
    Array.isArray(value) &&
    value.every((equipmentId): equipmentId is RelicConduitEquipmentId => {
      if (typeof equipmentId !== 'string' || !hasOwnKey(EQUIPMENT, equipmentId)) return false;
      return getEquipmentRelicConduitByEquipmentId(equipmentId as EquipmentId)?.frameId === frame;
    }) &&
    new Set(value).size === value.length
  );
}

function isSavedRunRelicSettlement(
  value: unknown,
  relicState?: RunRelicState
): value is RunRelicSettlement {
  if (
    !isRecord(value) ||
    !['pending', 'archived', 'skipped', 'lost'].includes(String(value.status)) ||
    !isSavedRunRelicIds(value.acquiredIds, relicState?.frame) ||
    (value.frame !== undefined && !isRunRelicFrame(value.frame)) ||
    (value.archivedRelicId !== undefined && !isRunRelicId(value.archivedRelicId))
  ) {
    return false;
  }

  if (relicState) {
    if (value.frame !== relicState.frame) return false;
    if (
      value.acquiredIds.length !== relicState.acquiredIds.length ||
      !value.acquiredIds.every((relicId, index) => relicId === relicState.acquiredIds[index])
    ) {
      return false;
    }
  } else if (value.frame !== undefined || value.acquiredIds.length > 0) {
    return false;
  }

  if (value.status === 'pending' && (!relicState || value.acquiredIds.length === 0)) return false;
  if (value.status === 'archived') {
    return value.archivedRelicId !== undefined && value.acquiredIds.includes(value.archivedRelicId);
  }
  return value.archivedRelicId === undefined;
}

function normalizeSavedEquipmentCommissionSettlement(
  value: unknown
): EquipmentCommissionSettlement | undefined {
  if (
    !isRecord(value) ||
    (value.status !== 'advanced' && value.status !== 'completed') ||
    !equipmentCommissionValidators.isDungeonId(value.dungeonId) ||
    !equipmentCommissionValidators.isItemId(value.targetMaterialId) ||
    !Array.isArray(value.equipmentIds) ||
    value.equipmentIds.length !== 2 ||
    !equipmentCommissionValidators.isEquipmentId(value.equipmentIds[0]) ||
    !equipmentCommissionValidators.isEquipmentId(value.equipmentIds[1]) ||
    value.equipmentIds[0] === value.equipmentIds[1] ||
    !Array.isArray(value.completedDungeonIds) ||
    value.completedDungeonIds.length < 1 ||
    value.completedDungeonIds.length > EQUIPMENT_COMMISSION_REQUIRED_DUNGEONS ||
    !value.completedDungeonIds.every(equipmentCommissionValidators.isDungeonId) ||
    new Set(value.completedDungeonIds).size !== value.completedDungeonIds.length ||
    !value.completedDungeonIds.includes(value.dungeonId) ||
    (value.status === 'advanced' && value.completedDungeonIds.length >= EQUIPMENT_COMMISSION_REQUIRED_DUNGEONS) ||
    (value.status === 'completed' && value.completedDungeonIds.length !== EQUIPMENT_COMMISSION_REQUIRED_DUNGEONS) ||
    !isNonNegativeInteger(value.rewardAmount) ||
    value.rewardAmount !== (value.status === 'completed' ? EQUIPMENT_COMMISSION_MATERIAL_REWARD : 0)
  ) {
    return undefined;
  }

  return {
    status: value.status,
    dungeonId: value.dungeonId,
    equipmentIds: [value.equipmentIds[0], value.equipmentIds[1]],
    targetMaterialId: value.targetMaterialId,
    completedDungeonIds: [...value.completedDungeonIds],
    rewardAmount: value.rewardAmount
  };
}

function sanitizeSavedRunRelicFields(value: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...value };
  const relicState = isRunRelicState(value.relicState) ? value.relicState : undefined;

  if (relicState) {
    sanitized.relicState = relicState;
    if (value.relicConduitSourceEquipmentIds === undefined) {
      delete sanitized.relicConduitSourceEquipmentIds;
    } else {
      sanitized.relicConduitSourceEquipmentIds = isSavedRelicConduitEquipmentIds(
        value.relicConduitSourceEquipmentIds,
        relicState.frame
      )
        ? [...value.relicConduitSourceEquipmentIds]
        : [];
    }
  } else {
    // Missing and malformed snapshots both become a legacy no-relic run; never synthesize a run relic state.
    delete sanitized.relicState;
    delete sanitized.relicConduitSourceEquipmentIds;
  }

  if (isSavedRunRelicSettlement(value.lastRelicSettlement, relicState)) {
    sanitized.lastRelicSettlement = value.lastRelicSettlement;
  } else {
    delete sanitized.lastRelicSettlement;
  }

  return sanitized;
}

function sanitizeSavedRunSoulSkillFields(value: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...value };

  if (isEquipmentSoulSkillRunState(value.soulSkillState)) {
    sanitized.soulSkillState = normalizeEquipmentSoulSkillRunState(value.soulSkillState);
  } else {
    // A missing or malformed snapshot stays legacy-disabled for this run; current gear must not backfill it.
    delete sanitized.soulSkillState;
  }

  return sanitized;
}

function sanitizeSavedRunFieldSurveyFields(value: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...value };
  const normalized = normalizeFieldSurveyRunState(value.fieldSurveyState);

  if (isFieldSurveyRunState(value.fieldSurveyState) && normalized) {
    // Keep only a validated v1 snapshot; old runs must not inherit the current loadout.
    sanitized.fieldSurveyState = normalized;
  } else {
    // Missing and malformed snapshots intentionally remain disabled for this run.
    delete sanitized.fieldSurveyState;
  }

  return sanitized;
}

function sanitizeSavedRunPressureFields(value: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...value };
  const pressureState = isRunPressureState(value.pressureState)
    ? normalizeRunPressureState(value.pressureState)
    : undefined;

  if (pressureState) {
    sanitized.pressureState = pressureState;
  } else {
    // Missing and malformed snapshots stay legacy-disabled; cleared nodes must never backfill pressure.
    delete sanitized.pressureState;
  }

  if (isSavedRunPressureSettlement(value.lastPressureSettlement)) {
    const settlementState = normalizeRunPressureState(value.lastPressureSettlement.state);
    sanitized.lastPressureSettlement = settlementState
      ? { ...value.lastPressureSettlement, state: settlementState }
      : undefined;
  } else {
    delete sanitized.lastPressureSettlement;
  }

  return sanitized;
}

function sanitizeSavedRunEntryFlowFields(value: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...value };
  if (value.entryFlowVersion === 2 && isIntegerInRange(value.hiddenTaskSeed, 1, 0xffff_ffff)) {
    sanitized.entryFlowVersion = 2;
    sanitized.hiddenTaskSeed = value.hiddenTaskSeed;
  } else {
    delete sanitized.entryFlowVersion;
    delete sanitized.hiddenTaskSeed;
  }
  return sanitized;
}

function sanitizeSavedRunPursuitFields(value: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...value };
  const currentDungeonId = hasOwnKey(DUNGEONS, value.dungeonId)
    ? value.dungeonId as DungeonId
    : undefined;

  if (Object.prototype.hasOwnProperty.call(value, 'pursuitState') && currentDungeonId) {
    const pursuitState = normalizeSavedCurrentRunPursuitState(value.pursuitState, currentDungeonId);
    if (pursuitState) sanitized.pursuitState = pursuitState;
    else delete sanitized.pursuitState;
  } else {
    // Missing legacy snapshots remain missing; malformed optional data never backfills from pressure progress.
    delete sanitized.pursuitState;
  }

  const settlement = normalizeSavedRunPursuitSettlement(value.lastPursuitSettlement);
  if (settlement) sanitized.lastPursuitSettlement = settlement;
  else delete sanitized.lastPursuitSettlement;

  return sanitized;
}

function normalizeSavedRouteContractSettlement(
  value: unknown
): RouteContractSettlement | undefined {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== 3 ||
    !Object.prototype.hasOwnProperty.call(value, 'state') ||
    !Object.prototype.hasOwnProperty.call(value, 'rewardPoints') ||
    !Object.prototype.hasOwnProperty.call(value, 'rewarded') ||
    !isNonNegativeInteger(value.rewardPoints) ||
    typeof value.rewarded !== 'boolean' ||
    !isRecord(value.state) ||
    !hasOwnKey(DUNGEONS, value.state.dungeonId)
  ) {
    return undefined;
  }

  const settlementDungeonId = value.state.dungeonId as DungeonId;
  const routeContractState = normalizeRouteContractRunState(value.state, settlementDungeonId);
  if (!routeContractState || !['failed', 'lost', 'banked'].includes(routeContractState.status)) {
    return undefined;
  }

  const progress = getRouteContractProgress(routeContractState, settlementDungeonId);
  const expectedRewardPoints = routeContractState.status === 'banked'
    ? progress.bankedRewardPoints
    : 0;
  const expectedRewarded = routeContractState.status === 'banked';
  if (value.rewardPoints !== expectedRewardPoints || value.rewarded !== expectedRewarded) {
    return undefined;
  }

  return Object.freeze({
    state: routeContractState,
    rewardPoints: expectedRewardPoints,
    rewarded: expectedRewarded
  });
}

function normalizeSavedEquipmentMemoryHuntSettlement(
  value: unknown
): EquipmentMemoryHuntSettlement | undefined {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== 2 ||
    !Object.prototype.hasOwnProperty.call(value, 'state') ||
    !Object.prototype.hasOwnProperty.call(value, 'granted') ||
    typeof value.granted !== 'boolean'
  ) {
    return undefined;
  }

  const huntState = normalizeEquipmentMemoryHuntRunState(value.state);
  if (!huntState || !['failed', 'lost', 'banked'].includes(huntState.status)) return undefined;

  // The final state carries its origin dungeon and rules version, so portal exits are
  // validated against that evidence instead of whichever dungeon is currently open.
  const progress = getEquipmentMemoryHuntProgress(huntState);
  const expectedGranted = progress.status === 'banked' && progress.granted;
  if (!progress.definition || progress.definition.dungeonId !== huntState.dungeonId || value.granted !== expectedGranted) {
    return undefined;
  }

  return Object.freeze({ state: huntState, granted: expectedGranted });
}

function sanitizeSavedRunRouteContractFields(value: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...value };
  const hasRouteContractState = Object.prototype.hasOwnProperty.call(value, 'routeContractState');
  if (hasRouteContractState && hasOwnKey(DUNGEONS, value.dungeonId)) {
    const routeContractState = normalizeRouteContractRunState(
      value.routeContractState,
      value.dungeonId as DungeonId
    );
    if (routeContractState) sanitized.routeContractState = routeContractState;
    else delete sanitized.routeContractState;
  } else if (hasRouteContractState) {
    delete sanitized.routeContractState;
  }

  // Portal settlements remain evidence for their origin dungeon and never backfill active progress.
  const settlement = normalizeSavedRouteContractSettlement(value.lastRouteContractSettlement);
  if (settlement) sanitized.lastRouteContractSettlement = settlement;
  else delete sanitized.lastRouteContractSettlement;

  return sanitized;
}

function sanitizeSavedPressureFields(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const sanitized: Record<string, unknown> = { ...value };
  if (isRecord(value.run)) {
    sanitized.run = sanitizeSavedRunPursuitFields(
      sanitizeSavedRunRouteContractFields(
        sanitizeSavedRunPressureFields(sanitizeSavedRunEntryFlowFields(value.run))
      )
    );
  }
  return sanitized;
}

function sanitizeSavedEquipmentMemoryFields(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const sanitized: Record<string, unknown> = {
    ...value,
    // Legacy maps and malformed entries normalize independently to an empty or repaired map.
    equipmentMemories: sanitizeEquipmentMemoryMap(value.equipmentMemories)
  };
  const prepared = normalizePreparedEquipmentMemoryHunt(value.preparedEquipmentMemoryHunt);
  if (prepared) sanitized.preparedEquipmentMemoryHunt = prepared;
  else delete sanitized.preparedEquipmentMemoryHunt;

  if (isRecord(value.run)) {
    const run: Record<string, unknown> = { ...value.run };
    const runDungeonId = hasOwnKey(DUNGEONS, value.run.dungeonId)
      ? value.run.dungeonId as DungeonId
      : undefined;

    if (Object.prototype.hasOwnProperty.call(value.run, 'equipmentMemorySnapshot')) {
      const snapshot = normalizeEquipmentMemoryRunSnapshot(value.run.equipmentMemorySnapshot);
      if (snapshot) run.equipmentMemorySnapshot = snapshot;
      else delete run.equipmentMemorySnapshot;
    }

    if (Object.prototype.hasOwnProperty.call(value.run, 'equipmentMemoryHunt')) {
      const hunt = normalizeEquipmentMemoryHuntRunState(value.run.equipmentMemoryHunt);
      if (hunt && hunt.dungeonId === runDungeonId) run.equipmentMemoryHunt = hunt;
      else delete run.equipmentMemoryHunt;
    }

    const settlement = normalizeSavedEquipmentMemoryHuntSettlement(
      value.run.lastEquipmentMemoryHuntSettlement
    );
    if (settlement) run.lastEquipmentMemoryHuntSettlement = settlement;
    else delete run.lastEquipmentMemoryHuntSettlement;
    sanitized.run = run;
  }

  if (isRecord(value.combat)) {
    const combat: Record<string, unknown> = { ...value.combat };
    const memoryState = normalizeEquipmentMemoryCombatState(value.combat.equipmentMemoryState);
    const runDungeonId = isRecord(sanitized.run) && hasOwnKey(DUNGEONS, sanitized.run.dungeonId)
      ? sanitized.run.dungeonId as DungeonId
      : undefined;
    if (memoryState && memoryState.dungeonId === runDungeonId) combat.equipmentMemoryState = memoryState;
    else delete combat.equipmentMemoryState;
    sanitized.combat = combat;
  }

  return sanitized;
}

function sanitizeSavedEquipmentHuntFields(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const sanitized: Record<string, unknown> = { ...value };
  if (isSavedPreparedEquipmentHunt(value.preparedEquipmentHunt)) {
    sanitized.preparedEquipmentHunt = normalizePreparedEquipmentHunt(value.preparedEquipmentHunt);
  } else {
    // Hunt corruption is isolated: preserve the rest of the save and never infer preparation.
    delete sanitized.preparedEquipmentHunt;
  }

  if (isRecord(value.run)) {
    const run: Record<string, unknown> = { ...value.run };
    if (isEquipmentHuntRunState(value.run.equipmentHunt)) {
      run.equipmentHunt = normalizeEquipmentHuntRunState(value.run.equipmentHunt);
    } else {
      // A legacy or malformed active run remains hunt-disabled; hub preparation must not backfill it.
      delete run.equipmentHunt;
    }
    sanitized.run = run;
  }

  return sanitized;
}

function sanitizeSavedEquipmentCommissionFields(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const sanitized: Record<string, unknown> = { ...value };
  const equipmentCommission = normalizeSavedActiveEquipmentCommission(value.equipmentCommission);
  if (equipmentCommission && isSavedEquipmentCommissionConsistent(equipmentCommission, value)) {
    sanitized.equipmentCommission = equipmentCommission;
  } else {
    // Commission corruption is isolated so an otherwise valid legacy save remains playable.
    delete sanitized.equipmentCommission;
  }

  if (isRecord(value.run)) {
    const run: Record<string, unknown> = { ...value.run };
    const settlement = normalizeSavedEquipmentCommissionSettlement(value.run.lastEquipmentCommissionSettlement);
    if (settlement) run.lastEquipmentCommissionSettlement = settlement;
    else delete run.lastEquipmentCommissionSettlement;
    sanitized.run = run;
  }

  return sanitized;
}

function sanitizeSavedCompanionFields(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const progress = normalizeCompanionProgress({
    rulesVersion: COMPANION_RULES_VERSION,
    owned: value.ownedCompanions,
    ranks: value.companionRanks,
    active: value.activeCompanion
  });
  const sanitized: Record<string, unknown> = {
    ...value,
    ownedCompanions: [...progress.owned],
    companionRanks: { ...progress.ranks }
  };
  if (progress.active === undefined) delete sanitized.activeCompanion;
  else sanitized.activeCompanion = progress.active;

  if (isRecord(value.run)) {
    const run: Record<string, unknown> = { ...value.run };
    if (Object.prototype.hasOwnProperty.call(value.run, 'companionSnapshot')) {
      const snapshot = normalizeCompanionRunSnapshot(value.run.companionSnapshot);
      if (snapshot) run.companionSnapshot = snapshot;
      else delete run.companionSnapshot;
    } else {
      // Legacy runs remain companion-disabled and never inherit the current hub roster.
      delete run.companionSnapshot;
    }
    sanitized.run = run;
  }

  if (isRecord(value.combat)) {
    const combat: Record<string, unknown> = { ...value.combat };
    if (typeof value.combat.companionAssistUsed !== 'boolean') {
      delete combat.companionAssistUsed;
    }
    sanitized.combat = combat;
  }

  return sanitized;
}

function sanitizeSavedMethodFields(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const learnedMethods: MethodId[] = [];
  for (const methodId of Array.isArray(value.learnedMethods) ? value.learnedMethods : []) {
    if (hasOwnKey(METHODS, methodId) && !learnedMethods.includes(methodId as MethodId)) {
      learnedMethods.push(methodId as MethodId);
    }
  }
  const progress = normalizeMethodCultivationProgress(learnedMethods, {
    rulesVersion: METHOD_CULTIVATION_RULES_VERSION,
    ranks: value.methodRanks,
    activeMethod: value.activeMethod
  });

  const sanitized: Record<string, unknown> = {
    ...value,
    learnedMethods,
    methodRanks: { ...progress.ranks }
  };
  if (progress.activeMethod !== undefined) {
    sanitized.activeMethod = progress.activeMethod;
  } else {
    delete sanitized.activeMethod;
  }

  let methodSnapshots: readonly MethodRunSnapshot[] | undefined;
  let methodSnapshot: MethodRunSnapshot | undefined;
  if (isRecord(value.run)) {
    const run: Record<string, unknown> = { ...value.run };
    if (Object.prototype.hasOwnProperty.call(value.run, 'methodSnapshots')) {
      const snapshotCandidates = normalizeMethodRunSnapshots(value.run.methodSnapshots);
      methodSnapshots = snapshotCandidates?.filter(({ methodId }) => learnedMethods.includes(methodId));
      if (methodSnapshots) run.methodSnapshots = methodSnapshots;
      else delete run.methodSnapshots;
    } else {
      delete run.methodSnapshots;
    }
    const snapshotCandidate = normalizeMethodRunSnapshot(value.run.methodSnapshot);
    methodSnapshot = snapshotCandidate && learnedMethods.includes(snapshotCandidate.methodId)
      ? snapshotCandidate
      : undefined;
    if (methodSnapshot) run.methodSnapshot = methodSnapshot;
    else delete run.methodSnapshot;
    sanitized.run = run;
  }

  if (isRecord(value.combat)) {
    const combat: Record<string, unknown> = { ...value.combat };
    const availableMethodIds = new Set(
      methodSnapshots?.map(({ methodId }) => methodId) ?? (methodSnapshot ? [methodSnapshot.methodId] : [])
    );
    if (methodSnapshots && Array.isArray(value.combat.methodTechniqueUsedIds)) {
      combat.methodTechniqueUsedIds = Array.from(new Set(
        value.combat.methodTechniqueUsedIds.filter(
          (methodId): methodId is MethodId => hasOwnKey(METHODS, methodId) && availableMethodIds.has(methodId as MethodId)
        )
      ));
    } else {
      delete combat.methodTechniqueUsedIds;
    }
    if (availableMethodIds.size === 0 || typeof value.combat.methodTechniqueUsed !== 'boolean') {
      delete combat.methodTechniqueUsed;
    }
    sanitized.combat = combat;
  }

  return sanitized;
}

function sanitizeSavedBloodlineFields(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const progress = normalizeBloodlineProgress({
    rulesVersion: BLOODLINE_RULES_VERSION,
    ranks: value.bloodlineRanks,
    active: value.activeBloodline
  });
  const sanitized: Record<string, unknown> = {
    ...value,
    bloodlineRanks: { ...progress.ranks }
  };
  if (progress.active === undefined) delete sanitized.activeBloodline;
  else sanitized.activeBloodline = progress.active;

  let snapshot: BloodlineRunSnapshot | undefined;
  if (isRecord(value.run)) {
    const run: Record<string, unknown> = { ...value.run };
    if (Object.prototype.hasOwnProperty.call(value.run, 'bloodlineSnapshot')) {
      snapshot = normalizeBloodlineRunSnapshot(value.run.bloodlineSnapshot);
      if (snapshot) run.bloodlineSnapshot = snapshot;
      else delete run.bloodlineSnapshot;
    } else {
      delete run.bloodlineSnapshot;
    }
    sanitized.run = run;
  }

  if (isRecord(value.combat)) {
    const combat: Record<string, unknown> = { ...value.combat };
    if (!snapshot) {
      delete combat.bloodlineSurgeUsed;
      delete combat.bloodlineBarrier;
    } else {
      combat.bloodlineSurgeUsed = typeof value.combat.bloodlineSurgeUsed === 'boolean'
        ? value.combat.bloodlineSurgeUsed
        : false;
      const barrier = isFiniteNumber(value.combat.bloodlineBarrier)
        ? Math.trunc(value.combat.bloodlineBarrier)
        : 0;
      combat.bloodlineBarrier = Math.max(0, Math.min(50, barrier));
    }
    sanitized.combat = combat;
  }

  return sanitized;
}

function sanitizeSavedShelterCombatFields(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const sanitized: Record<string, unknown> = { ...value };

  if (isRecord(value.run)) {
    const run: Record<string, unknown> = { ...value.run };
    if (Object.prototype.hasOwnProperty.call(value.run, 'escortEntryGear')) {
      const gear = value.run.escortEntryGear;
      const gearKeys = ['rescueCarbine', 'triageVisor', 'evacuationPlate', 'blackboxBeacon'] as const;
      const validGear = isRecord(gear) &&
        Object.keys(gear).every((key) => gearKeys.includes(key as typeof gearKeys[number])) &&
        gearKeys.every((key) => typeof gear[key] === 'boolean');
      if (validGear) run.escortEntryGear = { ...gear };
      else delete run.escortEntryGear;
    }
    sanitized.run = run;
  }

  if (isRecord(value.combat) && isRecord(value.combat.effects)) {
    const effects: Record<string, unknown> = { ...value.combat.effects };
    if (effects.mimicHesitation !== undefined && typeof effects.mimicHesitation !== 'boolean') {
      delete effects.mimicHesitation;
    }
    if (
      effects.shelterWardKind !== undefined &&
      effects.shelterWardKind !== 'physical' &&
      effects.shelterWardKind !== 'art' &&
      effects.shelterWardKind !== 'talisman'
    ) {
      delete effects.shelterWardKind;
    }
    if (effects.evacuationPanicStacks !== undefined && !isIntegerInRange(effects.evacuationPanicStacks, 0, 2)) {
      delete effects.evacuationPanicStacks;
    }
    sanitized.combat = { ...value.combat, effects };
  }

  return sanitized;
}

function migrateSavedReplacedCombatEncounter(value: unknown): unknown {
  if (
    !isRecord(value) ||
    value.phase !== 'combat' ||
    !isRecord(value.run) ||
    !isRecord(value.combat)
  ) {
    return value;
  }

  const run = value.run;
  const combat = value.combat;
  const migration = REPLACED_COMBAT_ENCOUNTER_MIGRATIONS.find((candidate) =>
    run.dungeonId === candidate.dungeonId &&
    run.currentNodeId === candidate.nodeId &&
    combat.nodeId === candidate.nodeId &&
    combat.monsterId === candidate.legacyMonsterId
  );
  if (!migration) return value;

  return {
    ...value,
    combat: {
      ...combat,
      monsterId: migration.monsterId
    }
  };
}

function isSavedFalseTestimonyEntryGear(value: unknown): boolean {
  const gearKeys = ['crossExaminerSabre', 'forensicVisor', 'custodyShell', 'appealSeal'] as const;
  return isRecord(value) &&
    Object.keys(value).length === gearKeys.length &&
    gearKeys.every((key) => typeof value[key] === 'boolean');
}

function sanitizeSavedFalseTestimonyFields(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const sanitized: Record<string, unknown> = { ...value };

  if (isRecord(value.run)) {
    const run: Record<string, unknown> = { ...value.run };
    if (
      Object.prototype.hasOwnProperty.call(value.run, 'falseTestimonyEntryGear') &&
      !isSavedFalseTestimonyEntryGear(value.run.falseTestimonyEntryGear)
    ) {
      delete run.falseTestimonyEntryGear;
    }
    sanitized.run = run;
  }

  if (isRecord(value.combat) && isRecord(value.combat.effects)) {
    const effects: Record<string, unknown> = { ...value.combat.effects };
    if (effects.witnessContradiction !== undefined && typeof effects.witnessContradiction !== 'boolean') {
      delete effects.witnessContradiction;
    }
    if (
      effects.censorSealKind !== undefined &&
      effects.censorSealKind !== 'attack' &&
      effects.censorSealKind !== 'art' &&
      effects.censorSealKind !== 'talisman'
    ) {
      delete effects.censorSealKind;
    }
    if (effects.perjuryPressureStacks !== undefined && !isIntegerInRange(effects.perjuryPressureStacks, 0, 2)) {
      delete effects.perjuryPressureStacks;
    }
    sanitized.combat = { ...value.combat, effects };
  }

  return sanitized;
}

function sanitizeSavedCombatReplayFields(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const sanitized: Record<string, unknown> = { ...value };
  let runReplayState: CombatReplayRunState | undefined;

  if (isRecord(value.run)) {
    const run: Record<string, unknown> = { ...value.run };
    if (value.run.dungeonId === 'combat_replay_stage') {
      runReplayState = normalizeCombatReplayRunState(value.run.combatReplayState);
      if (runReplayState) run.combatReplayState = runReplayState;
      else delete run.combatReplayState;
    } else {
      delete run.combatReplayState;
    }
    sanitized.run = run;
  }

  if (isRecord(value.combat)) {
    const combat: Record<string, unknown> = { ...value.combat };
    const combatReplayState = runReplayState
      ? normalizeCombatReplayCombatState(value.combat.combatReplayState)
      : undefined;
    if (combatReplayState) combat.combatReplayState = combatReplayState;
    else delete combat.combatReplayState;
    sanitized.combat = combat;
  }

  return sanitized;
}

function isSavedBloodlineProgress(value: Record<string, unknown>): boolean {
  if (!isRecord(value.bloodlineRanks)) return false;
  const progress = normalizeBloodlineProgress({
    rulesVersion: BLOODLINE_RULES_VERSION,
    ranks: value.bloodlineRanks,
    active: value.activeBloodline
  });
  return (
    Object.keys(progress.ranks).length === Object.keys(value.bloodlineRanks).length &&
    Object.entries(value.bloodlineRanks).every(
      ([bloodlineId, rank]) => getBloodlineRank(bloodlineId, progress) === rank
    ) &&
    progress.active === value.activeBloodline
  );
}

function isSavedMethodProgress(value: Record<string, unknown>): boolean {
  if (!Array.isArray(value.learnedMethods) || !isRecord(value.methodRanks)) return false;
  const learnedMethods = value.learnedMethods as MethodId[];
  const methodRanks = value.methodRanks;
  const rankEntries = Object.entries(methodRanks);
  const progress = normalizeMethodCultivationProgress(learnedMethods, {
    rulesVersion: METHOD_CULTIVATION_RULES_VERSION,
    ranks: methodRanks,
    activeMethod: value.activeMethod
  });
  return (
    rankEntries.length === learnedMethods.length &&
    learnedMethods.every((methodId) => getCultivationMethodRank(methodId, progress) === methodRanks[methodId]) &&
    rankEntries.every(([methodId, rank]) => hasOwnKey(METHODS, methodId) && learnedMethods.includes(methodId as MethodId) && isMethodRank(rank)) &&
    progress.activeMethod === value.activeMethod
  );
}

function isSavedCompanionProgress(value: Record<string, unknown>): boolean {
  if (!Array.isArray(value.ownedCompanions) || !isRecord(value.companionRanks)) return false;
  const ownedCompanions = value.ownedCompanions;
  const companionRanks = value.companionRanks;

  const progress = normalizeCompanionProgress({
    rulesVersion: COMPANION_RULES_VERSION,
    owned: ownedCompanions,
    ranks: companionRanks,
    active: value.activeCompanion
  });
  const rankEntries = Object.entries(companionRanks);
  return (
    progress.owned.length === ownedCompanions.length &&
    progress.owned.every((companionId, index) => companionId === ownedCompanions[index]) &&
    rankEntries.length === Object.keys(progress.ranks).length &&
    rankEntries.every(([companionId, rank]) => progress.ranks[companionId as CompanionId] === rank) &&
    progress.active === value.activeCompanion
  );
}

function sanitizeSavedRelicFields(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const preparedRelicFrame = isRunRelicFrame(value.preparedRelicFrame)
    ? value.preparedRelicFrame
    : 'assault';
  const archivedRelicIds = isSavedRunRelicIds(value.archivedRelicIds)
    ? [...value.archivedRelicIds]
    : [];
  const preparedRelicSeedId =
    isRunRelicId(value.preparedRelicSeedId) &&
    archivedRelicIds.includes(value.preparedRelicSeedId) &&
    RUN_RELIC_DEFINITIONS[value.preparedRelicSeedId].frame === preparedRelicFrame
      ? value.preparedRelicSeedId
      : undefined;
  const sanitized: Record<string, unknown> = {
    ...value,
    preparedRelicFrame,
    archivedRelicIds
  };

  if (preparedRelicSeedId === undefined) delete sanitized.preparedRelicSeedId;
  else sanitized.preparedRelicSeedId = preparedRelicSeedId;
  if (isRecord(value.run)) {
    sanitized.run = sanitizeSavedRunFieldSurveyFields(
      sanitizeSavedRunSoulSkillFields(sanitizeSavedRunRelicFields(value.run))
    );
  }

  return sanitized;
}

function sanitizeSavedProtocolSettlementField(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.run)) return value;

  const sanitized: Record<string, unknown> = { ...value };
  const run: Record<string, unknown> = { ...value.run };
  const dungeonId = run.dungeonId;
  const settlementIsValid =
    typeof dungeonId === 'string' &&
    hasOwnKey(DUNGEONS, dungeonId) &&
    isSavedRunProtocolSettlement(run.lastProtocolSettlement, dungeonId as DungeonId) &&
    isSavedRunProtocolSnapshot(run.protocol) &&
    run.protocol.id === run.lastProtocolSettlement.protocol.id &&
    run.protocol.rulesVersion === run.lastProtocolSettlement.protocol.rulesVersion;

  if (!settlementIsValid) delete run.lastProtocolSettlement;
  sanitized.run = run;
  return sanitized;
}

function isSavedDungeonRun(value: unknown): value is SavedDungeonRun {
  if (!isRecord(value) || !hasOwnKey(DUNGEONS, value.dungeonId)) return false;

  const dungeon = DUNGEONS[value.dungeonId as DungeonId];
  const nodeIds = new Set(dungeon.nodes.map((node) => node.id));
  const hasRouteContractState = Object.prototype.hasOwnProperty.call(value, 'routeContractState');
  const routeContractState = normalizeRouteContractRunState(value.routeContractState, dungeon.id);
  const routeContractSettlement = normalizeSavedRouteContractSettlement(value.lastRouteContractSettlement);
  const hasEquipmentMemorySnapshot = Object.prototype.hasOwnProperty.call(value, 'equipmentMemorySnapshot');
  const equipmentMemorySnapshot = normalizeEquipmentMemoryRunSnapshot(value.equipmentMemorySnapshot);
  const hasEquipmentMemoryHunt = Object.prototype.hasOwnProperty.call(value, 'equipmentMemoryHunt');
  const equipmentMemoryHunt = normalizeEquipmentMemoryHuntRunState(value.equipmentMemoryHunt);
  const equipmentMemorySettlement = normalizeSavedEquipmentMemoryHuntSettlement(
    value.lastEquipmentMemoryHuntSettlement
  );
  const hasPursuitState = Object.prototype.hasOwnProperty.call(value, 'pursuitState');
  const pursuitState = normalizeSavedCurrentRunPursuitState(value.pursuitState, dungeon.id);
  const pursuitSettlement = normalizeSavedRunPursuitSettlement(value.lastPursuitSettlement);
  const hasCompanionSnapshot = Object.prototype.hasOwnProperty.call(value, 'companionSnapshot');
  const companionSnapshot = normalizeCompanionRunSnapshot(value.companionSnapshot);
  const hasMethodSnapshots = Object.prototype.hasOwnProperty.call(value, 'methodSnapshots');
  const methodSnapshots = normalizeMethodRunSnapshots(value.methodSnapshots);
  const hasMethodSnapshot = Object.prototype.hasOwnProperty.call(value, 'methodSnapshot');
  const methodSnapshot = normalizeMethodRunSnapshot(value.methodSnapshot);
  const hasBloodlineSnapshot = Object.prototype.hasOwnProperty.call(value, 'bloodlineSnapshot');
  const bloodlineSnapshot = normalizeBloodlineRunSnapshot(value.bloodlineSnapshot);
  const combatReplayState = normalizeCombatReplayRunState(value.combatReplayState);

  return (
    typeof value.currentNodeId === 'string' &&
    nodeIds.has(value.currentNodeId) &&
    isStringArray(value.clearedNodeIds) &&
    value.clearedNodeIds.every((nodeId) => nodeIds.has(nodeId)) &&
    (value.discoveredNodeIds === undefined || (
      isStringArray(value.discoveredNodeIds) &&
      value.discoveredNodeIds.every((nodeId) => nodeIds.has(nodeId))
    )) &&
    isFiniteNumber(value.captures) &&
    isKnownStringArray(value.capturedPetIds, PETS) &&
    isKnownStringArray(value.usedItems, ITEMS) &&
    isFiniteNumber(value.damageTaken) &&
    isStringArray(value.resolvedEventIds) &&
    isStringArray(value.eventLog) &&
    (value.lootBag === undefined || isSavedRunLootBag(value.lootBag)) &&
    (value.lootOffersMade === undefined || isNonNegativeInteger(value.lootOffersMade)) &&
    (value.tacticalLoadout === undefined || isSavedTacticalLoadoutSnapshot(value.tacticalLoadout)) &&
    (value.protocol === undefined || isSavedRunProtocolSnapshot(value.protocol)) &&
    (value.infernoMap === undefined || (
      isSavedRunProtocolSnapshot(value.protocol) &&
      value.protocol.id === 'deep' &&
      isInfernoMapSnapshot(value.infernoMap, dungeon)
    )) &&
    (value.carriedEquipmentRolls === undefined ||
      isSavedEquipmentRollMap(value.carriedEquipmentRolls)) &&
    (value.entryFlowVersion === undefined || value.entryFlowVersion === 2) &&
    (value.explorationRewardVersion === undefined ||
      value.explorationRewardVersion === EXPLORATION_REWARD_VERSION) &&
    (value.entryFlowVersion === 2
      ? isIntegerInRange(value.hiddenTaskSeed, 1, 0xffff_ffff)
      : value.hiddenTaskSeed === undefined) &&
    (value.relicState === undefined || isRunRelicState(value.relicState)) &&
    (value.relicConduitSourceEquipmentIds === undefined ||
      (isRunRelicState(value.relicState) &&
        isSavedRelicConduitEquipmentIds(value.relicConduitSourceEquipmentIds, value.relicState.frame))) &&
    (value.soulSkillState === undefined || isEquipmentSoulSkillRunState(value.soulSkillState)) &&
    (value.fieldSurveyState === undefined || isFieldSurveyRunState(value.fieldSurveyState)) &&
    (value.equipmentHunt === undefined || isEquipmentHuntRunState(value.equipmentHunt)) &&
    (value.falseTestimonyEntryGear === undefined || isSavedFalseTestimonyEntryGear(value.falseTestimonyEntryGear)) &&
    (!hasEquipmentMemorySnapshot || equipmentMemorySnapshot !== undefined) &&
    (!hasEquipmentMemoryHunt ||
      (equipmentMemoryHunt !== undefined && equipmentMemoryHunt.dungeonId === dungeon.id)) &&
    (value.lastEquipmentMemoryHuntSettlement === undefined || equipmentMemorySettlement !== undefined) &&
    (!hasPursuitState || pursuitState !== undefined) &&
    (value.lastPursuitSettlement === undefined || pursuitSettlement !== undefined) &&
    (!hasCompanionSnapshot || companionSnapshot !== undefined) &&
    (!hasMethodSnapshots || methodSnapshots !== undefined) &&
    (!hasMethodSnapshot || methodSnapshot !== undefined) &&
    (!hasBloodlineSnapshot || bloodlineSnapshot !== undefined) &&
    (value.combatReplayState === undefined || (
      dungeon.id === 'combat_replay_stage' && combatReplayState !== undefined
    )) &&
    (!hasRouteContractState || value.routeContractState === undefined || routeContractState !== undefined) &&
    (value.lastRouteContractSettlement === undefined || routeContractSettlement?.state !== undefined) &&
    (value.pressureState === undefined || isRunPressureState(value.pressureState)) &&
    (value.pendingEquipmentOffer === undefined || isSavedPendingEquipmentOffer(value.pendingEquipmentOffer)) &&
    (value.lastLootSettlement === undefined || isSavedRunLootSettlement(value.lastLootSettlement)) &&
    (value.lastAutoEquippedEquipmentIds === undefined ||
      isKnownStringArray(value.lastAutoEquippedEquipmentIds, EQUIPMENT)) &&
    (value.lastProtocolSettlement === undefined ||
      (isSavedRunProtocolSettlement(value.lastProtocolSettlement, value.dungeonId as DungeonId) &&
        isSavedRunProtocolSnapshot(value.protocol) &&
        value.protocol.id === value.lastProtocolSettlement.protocol.id &&
        value.protocol.rulesVersion === value.lastProtocolSettlement.protocol.rulesVersion)) &&
    (value.lastPressureSettlement === undefined ||
      isSavedRunPressureSettlement(value.lastPressureSettlement)) &&
    (value.lastRelicSettlement === undefined ||
      isSavedRunRelicSettlement(
        value.lastRelicSettlement,
        isRunRelicState(value.relicState) ? value.relicState : undefined
      )) &&
    (value.lastEquipmentCommissionSettlement === undefined ||
      normalizeSavedEquipmentCommissionSettlement(value.lastEquipmentCommissionSettlement) !== undefined) &&
    (value.lastEquipmentRollSettlement === undefined ||
      isSavedEquipmentRollSettlement(value.lastEquipmentRollSettlement))
  );
}

function isSavedCombatState(value: unknown, run: unknown): boolean {
  if (!isRecord(run) || !hasOwnKey(DUNGEONS, run.dungeonId)) return false;

  const dungeon = DUNGEONS[run.dungeonId as DungeonId];
  const combatNode = typeof value === 'object' && value !== null
    ? dungeon.nodes.find((node) => node.id === (value as { nodeId?: unknown }).nodeId)
    : undefined;

  return (
    isRecord(value) &&
    typeof value.nodeId === 'string' &&
    Boolean(combatNode?.monsterId) &&
    combatNode?.monsterId === value.monsterId &&
    hasOwnKey(MONSTERS, value.monsterId) &&
    isFiniteNumber(value.monsterHp) &&
    isFiniteNumber(value.turn) &&
    typeof value.guarding === 'boolean' &&
    (value.damageTakenAtStart === undefined || isNonNegativeInteger(value.damageTakenAtStart)) &&
    (value.weaponFocus === undefined || isIntegerInRange(value.weaponFocus, 0, COMBAT_FOCUS_MAX)) &&
    (value.weaponSkillUsed === undefined || typeof value.weaponSkillUsed === 'boolean') &&
    isSavedBossPhase(value.bossPhase) &&
    (value.protocolAnchorCompletedBeforeBoss === undefined || typeof value.protocolAnchorCompletedBeforeBoss === 'boolean') &&
    (value.effects === undefined || isSavedCombatEffects(value.effects)) &&
    (value.combatReplayState === undefined || (
      run.dungeonId === 'combat_replay_stage' &&
      normalizeCombatReplayRunState(run.combatReplayState) !== undefined &&
      normalizeCombatReplayCombatState(value.combatReplayState) !== undefined
    )) &&
    (value.equipmentMemoryState === undefined ||
      normalizeEquipmentMemoryCombatState(value.equipmentMemoryState)?.dungeonId === dungeon.id) &&
    (value.companionAssistUsed === undefined || typeof value.companionAssistUsed === 'boolean') &&
    (value.methodTechniqueUsedIds === undefined || (
      normalizeMethodRunSnapshots(run.methodSnapshots) !== undefined &&
      isKnownStringArray(value.methodTechniqueUsedIds, METHODS) &&
      value.methodTechniqueUsedIds.every((methodId) =>
        normalizeMethodRunSnapshots(run.methodSnapshots)?.some((snapshot) => snapshot.methodId === methodId)
      )
    )) &&
    (value.methodTechniqueUsed === undefined || (
      (normalizeMethodRunSnapshots(run.methodSnapshots)?.some(() => true) === true ||
        normalizeMethodRunSnapshot(run.methodSnapshot) !== undefined) &&
      typeof value.methodTechniqueUsed === 'boolean'
    )) &&
    (value.bloodlineSurgeUsed === undefined || (
      normalizeBloodlineRunSnapshot(run.bloodlineSnapshot) !== undefined &&
      typeof value.bloodlineSurgeUsed === 'boolean'
    )) &&
    (value.bloodlineBarrier === undefined || (
      normalizeBloodlineRunSnapshot(run.bloodlineSnapshot) !== undefined &&
      isIntegerInRange(value.bloodlineBarrier, 0, 50)
    )) &&
    isStringArray(value.log)
  );
}

function isSavedGameState(value: unknown): value is SavedGameState {
  if (!isRecord(value)) return false;

  const phase = value.phase;
  const player = value.player;
  const inventory = value.inventory;
  const equipped = value.equipped;
  const equipmentCommission = normalizeSavedActiveEquipmentCommission(value.equipmentCommission);

  return (
    ['hub', 'explore', 'combat', 'result'].includes(String(phase)) &&
    isFiniteNumber(value.rewardPoints) &&
    isFiniteNumber(value.lingyun) &&
    isRecord(player) &&
    isFiniteNumber(player.hp) &&
    isFiniteNumber(player.maxHp) &&
    isRecord(player.base) &&
    isFiniteNumber(player.base.body) &&
    isFiniteNumber(player.base.spirit) &&
    isFiniteNumber(player.base.agility) &&
    isFiniteNumber(player.base.luck) &&
    isSavedInventory(inventory) &&
    (value.preparedItemIds === undefined || isSavedTacticalItemIds(value.preparedItemIds)) &&
    isRunRelicFrame(value.preparedRelicFrame) &&
    isSavedRunRelicIds(value.archivedRelicIds) &&
    (value.preparedRelicSeedId === undefined ||
      (isRunRelicId(value.preparedRelicSeedId) &&
        value.archivedRelicIds.includes(value.preparedRelicSeedId) &&
        RUN_RELIC_DEFINITIONS[value.preparedRelicSeedId].frame === value.preparedRelicFrame)) &&
    (value.preparedEquipmentHunt === undefined || isSavedPreparedEquipmentHunt(value.preparedEquipmentHunt)) &&
    (value.equipmentMemories === undefined || normalizeEquipmentMemoryMap(value.equipmentMemories) !== undefined) &&
    (value.preparedEquipmentMemoryHunt === undefined ||
      normalizePreparedEquipmentMemoryHunt(value.preparedEquipmentMemoryHunt) !== undefined) &&
    isKnownStringArray(value.ownedEquipment, EQUIPMENT) &&
    isSavedEquipmentLevels(value.equipmentLevels) &&
    (value.equipmentRolls === undefined ||
      isSavedEquipmentRollMap(
        value.equipmentRolls,
        value.ownedEquipment as EquipmentId[]
      )) &&
    (value.equipmentAttunements === undefined ||
      isSavedEquipmentAttunements(
        value.equipmentAttunements,
        value.ownedEquipment as EquipmentId[],
        value.equipmentLevels as Partial<Record<EquipmentId, number>>
      )) &&
    (value.equipmentTemperRanks === undefined ||
      isSavedEquipmentTemperRanks(
        value.equipmentTemperRanks,
        value.ownedEquipment as EquipmentId[],
        value.equipmentLevels as Partial<Record<EquipmentId, number>>,
        (value.equipmentAttunements ?? {}) as EquipmentAttunementMap
      )) &&
    (value.equipmentCommission === undefined ||
      (equipmentCommission !== undefined && isSavedEquipmentCommissionConsistent(equipmentCommission, value))) &&
    isSavedEquipped(equipped) &&
    isSavedEquipmentProgressionConsistent(value.ownedEquipment as EquipmentId[], value.equipmentLevels, equipped) &&
    isKnownStringArray(value.learnedMethods, METHODS) &&
    isSavedMethodProgress(value) &&
    isSavedBloodlineProgress(value) &&
    isKnownStringArray(value.completedDungeonIds, DUNGEONS) &&
    (value.infernoProgress === undefined ||
      isSavedInfernoProgress(
        value.infernoProgress,
        value.completedDungeonIds as DungeonId[]
      )) &&
    (value.enteredDungeonIds === undefined || isKnownStringArray(value.enteredDungeonIds, DUNGEONS)) &&
    isStringArray(value.claimedDirectiveIds) &&
    (value.claimedTaskIds === undefined || isStringArray(value.claimedTaskIds)) &&
    isKnownStringArray(value.ownedPets, PETS) &&
    isKnownNumberMap(value.petLevels, PETS) &&
    (value.activePet === undefined || hasOwnKey(PETS, value.activePet)) &&
    isSavedCompanionProgress(value) &&
    (value.run === undefined || isSavedDungeonRun(value.run)) &&
    (value.combat === undefined || isSavedCombatState(value.combat, value.run)) &&
    (phase !== 'explore' || isSavedDungeonRun(value.run)) &&
    (phase !== 'combat' || (isSavedDungeonRun(value.run) && isSavedCombatState(value.combat, value.run))) &&
    (value.lastOutcome === undefined || typeof value.lastOutcome === 'string') &&
    isStringArray(value.log)
  );
}

function createInitialUiState(): EquipmentMemoryGameState {
  const initialState = createInitialState() as EquipmentMemoryGameState;
  const bloodlineProgress = normalizeBloodlineProgress({
    rulesVersion: BLOODLINE_RULES_VERSION,
    ranks: initialState.bloodlineRanks,
    active: initialState.activeBloodline
  });
  return {
    ...initialState,
    equipmentMemories: sanitizeEquipmentMemoryMap(initialState.equipmentMemories),
    methodRanks: { ...(initialState.methodRanks ?? {}) },
    activeMethod: initialState.activeMethod,
    bloodlineRanks: { ...bloodlineProgress.ranks },
    activeBloodline: bloodlineProgress.active
  };
}

function normalizeSavedState(savedState: SavedGameState): EquipmentMemoryGameState {
  const initialState = createInitialUiState();
  const inventory = {
    ...initialState.inventory,
    ...savedState.inventory,
    cycle_imprint: savedState.inventory.cycle_imprint ?? 0,
    chronal_glass: savedState.inventory.chronal_glass ?? 0,
    phase_glass: savedState.inventory.phase_glass ?? 0,
    redaction_ink: savedState.inventory.redaction_ink ?? 0,
    legacy_scrip: savedState.inventory.legacy_scrip ?? 0,
    genesis_serum: savedState.inventory.genesis_serum ?? 0,
    silence_core: savedState.inventory.silence_core ?? 0,
    rescue_badge: savedState.inventory.rescue_badge ?? 0,
    truth_fragment: savedState.inventory.truth_fragment ?? 0,
    combat_reel: savedState.inventory.combat_reel ?? 0,
    observation_shard: savedState.inventory.observation_shard ?? 0
  };
  const equipped = {
    ...initialState.equipped,
    ...savedState.equipped
  };
  const requiredEquipmentIds = Object.values(equipped);
  const ownedEquipment = Array.from(new Set([...savedState.ownedEquipment, ...requiredEquipmentIds]));
  const equipmentLevels: Partial<Record<EquipmentId, number>> = { ...savedState.equipmentLevels };
  const savedEquipmentRolls = sanitizeEquipmentRollMap(savedState.equipmentRolls);
  const equipmentRolls: Partial<Record<EquipmentId, EquipmentRoll>> = Object.fromEntries(
    Object.entries(savedEquipmentRolls).filter(([equipmentId]) =>
      ownedEquipment.includes(equipmentId as EquipmentId)
    )
  );
  const infernoProgress = sanitizeInfernoProgress(
    savedState.infernoProgress,
    savedState.completedDungeonIds
  );
  let normalizedInfernoMap = savedState.run?.infernoMap;
  let infernoMapWasRepaired = false;
  if (
    savedState.run?.protocol?.id === 'deep' &&
    savedState.run.infernoMap
  ) {
    const dungeon = DUNGEONS[savedState.run.dungeonId];
    const protocolDefinition = getRunProtocolDefinition(savedState.run.dungeonId, 'deep');
    normalizedInfernoMap = repairInfernoMapSnapshot(
      savedState.run.infernoMap,
      {
        dungeon,
        bossNodeId: getBossDefinition(savedState.run.dungeonId).nodeId,
        entryNodeId: savedState.run.currentNodeId,
        priorityNodeIds: protocolDefinition
          ? getRunProtocolRequiredNodeIds(protocolDefinition)
          : []
      }
    );
    infernoMapWasRepaired = normalizedInfernoMap !== savedState.run.infernoMap;
  }
  const normalizedRunSource = savedState.run
    ? {
        ...savedState.run,
        infernoMap: normalizedInfernoMap
      }
    : undefined;
  let normalizedRouteContractState =
    savedState.run && Object.prototype.hasOwnProperty.call(savedState.run, 'routeContractState')
      ? normalizeRouteContractRunState(
          savedState.run.routeContractState,
          savedState.run.dungeonId
        )
      : undefined;
  let routeContractDroppedAfterRepair = false;
  if (
    infernoMapWasRepaired &&
    normalizedRunSource?.infernoMap &&
    normalizedRouteContractState?.status === 'active' &&
    normalizedRouteContractState.completedTargetCount === 0
  ) {
    const definition = getRouteContractById(
      normalizedRouteContractState.contractId,
      normalizedRouteContractState.dungeonId
    );
    const connections = getInfernoConnectionIds(normalizedRunSource.infernoMap);
    if (
      definition &&
      connections &&
      !isOrderedRouteContractReachable(
        connections,
        normalizedRunSource.currentNodeId,
        definition.targetNodeIds
      )
    ) {
      normalizedRouteContractState = undefined;
      routeContractDroppedAfterRepair = true;
    }
  }

  for (const equipmentId of requiredEquipmentIds) {
    equipmentLevels[equipmentId] ??= initialState.equipmentLevels[equipmentId] ?? 1;
  }

  // An absent legacy tactical snapshot intentionally remains unrestricted after normalization and re-save.
  const run: EquipmentMemoryDungeonRun | undefined = normalizedRunSource
    ? {
        ...normalizedRunSource,
        discoveredNodeIds: getRunDiscoveredNodeIds(
          normalizedRunSource,
          DUNGEONS[normalizedRunSource.dungeonId]
        ),
        lootBag: normalizedRunSource.lootBag ?? createEmptyRunLootBag<ItemId, EquipmentId>(),
        lootOffersMade: normalizedRunSource.lootOffersMade ?? 0,
        tacticalLoadout: normalizedRunSource.tacticalLoadout,
        pressureState: normalizeRunPressureState(normalizedRunSource.pressureState),
        ...(Object.prototype.hasOwnProperty.call(normalizedRunSource, 'combatReplayState')
          ? { combatReplayState: normalizeCombatReplayRunState(normalizedRunSource.combatReplayState) }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(normalizedRunSource, 'routeContractState')
          ? {
              routeContractState: normalizedRouteContractState
            }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(normalizedRunSource, 'lastRouteContractSettlement')
          ? {
              lastRouteContractSettlement: normalizeSavedRouteContractSettlement(
                normalizedRunSource.lastRouteContractSettlement
              )
            }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(normalizedRunSource, 'equipmentMemorySnapshot')
          ? {
              equipmentMemorySnapshot: normalizeEquipmentMemoryRunSnapshot(
                normalizedRunSource.equipmentMemorySnapshot
              )
            }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(normalizedRunSource, 'equipmentMemoryHunt')
          ? {
              equipmentMemoryHunt: normalizeEquipmentMemoryHuntRunState(
                normalizedRunSource.equipmentMemoryHunt
              )
            }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(normalizedRunSource, 'pursuitState')
          ? {
              pursuitState: normalizeSavedCurrentRunPursuitState(
                normalizedRunSource.pursuitState,
                normalizedRunSource.dungeonId
              )
            }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(normalizedRunSource, 'lastPursuitSettlement')
          ? {
              lastPursuitSettlement: normalizeSavedRunPursuitSettlement(
                normalizedRunSource.lastPursuitSettlement
              )
            }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(normalizedRunSource, 'companionSnapshot')
          ? {
              companionSnapshot: normalizeCompanionRunSnapshot(
                normalizedRunSource.companionSnapshot
              )
            }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(normalizedRunSource, 'methodSnapshots')
          ? { methodSnapshots: normalizeMethodRunSnapshots(normalizedRunSource.methodSnapshots) }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(normalizedRunSource, 'methodSnapshot')
          ? { methodSnapshot: normalizeMethodRunSnapshot(normalizedRunSource.methodSnapshot) }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(normalizedRunSource, 'bloodlineSnapshot')
          ? { bloodlineSnapshot: normalizeBloodlineRunSnapshot(normalizedRunSource.bloodlineSnapshot) }
          : {}),
        lastEquipmentMemoryHuntSettlement: normalizeSavedEquipmentMemoryHuntSettlement(
          normalizedRunSource.lastEquipmentMemoryHuntSettlement
        ),
        equipmentHunt: normalizedRunSource.equipmentHunt === undefined
          ? undefined
          : normalizeEquipmentHuntRunState(normalizedRunSource.equipmentHunt),
        pendingEquipmentOffer: normalizedRunSource.pendingEquipmentOffer
          ? {
              ...normalizedRunSource.pendingEquipmentOffer,
              equipmentIds: [...normalizedRunSource.pendingEquipmentOffer.equipmentIds],
              equipmentRolls: normalizedRunSource.pendingEquipmentOffer.equipmentRolls
                ? { ...normalizedRunSource.pendingEquipmentOffer.equipmentRolls }
                : undefined
            }
          : undefined,
        lastAutoEquippedEquipmentIds:
          normalizedRunSource.lastAutoEquippedEquipmentIds === undefined
            ? undefined
            : [...normalizedRunSource.lastAutoEquippedEquipmentIds],
        lastEquipmentCommissionSettlement: normalizedRunSource.lastEquipmentCommissionSettlement
          ? {
              ...normalizedRunSource.lastEquipmentCommissionSettlement,
              equipmentIds: [
                normalizedRunSource.lastEquipmentCommissionSettlement.equipmentIds[0],
                normalizedRunSource.lastEquipmentCommissionSettlement.equipmentIds[1]
              ],
              completedDungeonIds: [...normalizedRunSource.lastEquipmentCommissionSettlement.completedDungeonIds]
            }
          : undefined,
        protocol: normalizedRunSource.entryFlowVersion === 2 && normalizedRunSource.protocol?.id === 'deep'
          ? {
              ...normalizedRunSource.protocol,
              infernoTier: normalizedRunSource.protocol.infernoTier ?? 1
            }
          : normalizedRunSource.protocol ?? { id: 'standard', rulesVersion: 1 },
        lawState: normalizeDungeonLawState(normalizedRunSource.lawState, normalizedRunSource.dungeonId)
      }
    : undefined;
  let combat: EquipmentMemoryCombat | undefined;
  if (savedState.combat) {
    combat = { ...savedState.combat };
    if (Object.prototype.hasOwnProperty.call(savedState.combat, 'combatReplayState')) {
      combat.combatReplayState = normalizeCombatReplayCombatState(savedState.combat.combatReplayState);
    }
    const legacyWeaponSkillUsed = combat.weaponSkillUsed;
    delete combat.weaponSkillUsed;
    if (savedState.phase === 'combat' && combat.weaponFocus === undefined) {
      combat.weaponFocus = legacyWeaponSkillUsed === true ? 0 : COMBAT_FOCUS_MAX;
    }
    const runMethodSnapshots = run ? getCurrentRunMethodSnapshots({ run }) : [];
    if (
      !run?.methodSnapshots ||
      !Array.isArray(savedState.combat.methodTechniqueUsedIds)
    ) {
      delete combat.methodTechniqueUsedIds;
    } else {
      combat.methodTechniqueUsedIds = savedState.combat.methodTechniqueUsedIds.filter((methodId) =>
        runMethodSnapshots.some((snapshot) => snapshot.methodId === methodId)
      );
    }
    if (runMethodSnapshots.length === 0 || typeof savedState.combat.methodTechniqueUsed !== 'boolean') {
      delete combat.methodTechniqueUsed;
    }
    if (!run?.bloodlineSnapshot) {
      delete combat.bloodlineSurgeUsed;
      delete combat.bloodlineBarrier;
    } else {
      combat.bloodlineSurgeUsed = savedState.combat.bloodlineSurgeUsed ?? false;
      combat.bloodlineBarrier = savedState.combat.bloodlineBarrier ?? 0;
    }
  }

  const normalized: EquipmentMemoryGameState = {
    ...savedState,
    claimedTaskIds: savedState.claimedTaskIds ?? [],
    enteredDungeonIds: Array.from(new Set([
      ...(savedState.enteredDungeonIds ?? []),
      ...(run ? [run.dungeonId] : [])
    ])),
    inventory,
    ownedEquipment,
    equipmentLevels,
    equipmentRolls,
    equipmentAttunements: { ...(savedState.equipmentAttunements ?? {}) },
    equipmentTemperRanks: { ...(savedState.equipmentTemperRanks ?? {}) },
    equipmentCommission: savedState.equipmentCommission
      ? {
          ...savedState.equipmentCommission,
          equipmentIds: [
            savedState.equipmentCommission.equipmentIds[0],
            savedState.equipmentCommission.equipmentIds[1]
          ],
          completedDungeonIds: [...savedState.equipmentCommission.completedDungeonIds]
        }
      : undefined,
    equipped,
    preparedItemIds: [...(savedState.preparedItemIds ?? DEFAULT_PREPARED_TACTICAL_ITEM_IDS)],
    preparedRelicFrame: savedState.preparedRelicFrame ?? 'assault',
    archivedRelicIds: [...(savedState.archivedRelicIds ?? [])],
    preparedRelicSeedId: savedState.preparedRelicSeedId,
    preparedEquipmentHunt: savedState.preparedEquipmentHunt === undefined
      ? undefined
      : normalizePreparedEquipmentHunt(savedState.preparedEquipmentHunt),
    equipmentMemories: sanitizeEquipmentMemoryMap(savedState.equipmentMemories),
    preparedEquipmentMemoryHunt: normalizePreparedEquipmentMemoryHunt(
      savedState.preparedEquipmentMemoryHunt
    ),
    ownedCompanions: [...(savedState.ownedCompanions ?? [])],
    companionRanks: { ...(savedState.companionRanks ?? {}) },
    activeCompanion: savedState.activeCompanion,
    methodRanks: { ...(savedState.methodRanks ?? {}) },
    activeMethod: savedState.activeMethod,
    bloodlineRanks: { ...(savedState.bloodlineRanks ?? {}) },
    activeBloodline: savedState.activeBloodline,
    infernoProgress,
    run,
    combat,
    log: infernoMapWasRepaired
      ? [
          routeContractDroppedAfterRepair
            ? '已修复旧版炼狱随机地图；原隐藏任务在新拓扑中无法保证顺序完成，已安全取消。'
            : '已修复旧版炼狱随机地图，保留当前进度、战利品与关卡法则。',
          ...savedState.log
        ].slice(0, 20)
      : savedState.log
  };
  const maxHp = getDerivedStats(normalized).maxHp;
  const maxHpDelta = maxHp - savedState.player.maxHp;

  return {
    ...normalized,
    player: {
      ...normalized.player,
      hp: Math.max(0, Math.min(maxHp, normalized.player.hp + Math.max(0, maxHpDelta))),
      maxHp
    }
  };
}

function discardInvalidSavedRun(
  state: EquipmentMemoryGameState,
  reason: string
): EquipmentMemoryGameState {
  const lootBag = state.run?.lootBag ?? createEmptyRunLootBag<ItemId, EquipmentId>();
  const inventory = { ...state.inventory };
  for (const [itemId, amount] of Object.entries(lootBag.items) as Array<[ItemId, number]>) {
    if (itemId === 'legacy_scrip') continue;
    inventory[itemId] = Math.max(0, (inventory[itemId] ?? 0) - amount);
  }
  const hubState: EquipmentMemoryGameState = {
    ...state,
    phase: 'hub',
    rewardPoints: Math.max(0, state.rewardPoints - lootBag.rewardPoints),
    lingyun: Math.max(0, state.lingyun - lootBag.lingyun),
    inventory,
    run: undefined,
    combat: undefined,
    lastOutcome: undefined,
    log: [reason, ...state.log].slice(0, 20)
  };
  const maxHp = getDerivedStats(hubState).maxHp;
  return {
    ...hubState,
    player: {
      ...hubState.player,
      hp: maxHp,
      maxHp
    }
  };
}

export type WebV1ParityNotice = Readonly<{
  code: string;
  path: string;
  message: string;
}>;

export type WebV1ParityMigration = Readonly<{
  state: EquipmentMemoryGameState;
  repairs: readonly WebV1ParityNotice[];
  warnings: readonly WebV1ParityNotice[];
}>;

/**
 * The exact sanitizer composition used by Web v1 loadSavedState. Keep the order
 * aligned with infinite-flow/src/main.ts; later sanitizers depend on earlier
 * subsystem repairs.
 */
export function sanitizeWebV1State(value: unknown): unknown {
  let sanitized = sanitizeSavedRelicFields(value);
  sanitized = sanitizeSavedPressureFields(sanitized);
  sanitized = sanitizeSavedEquipmentHuntFields(sanitized);
  sanitized = sanitizeSavedEquipmentCommissionFields(sanitized);
  sanitized = sanitizeSavedCompanionFields(sanitized);
  sanitized = sanitizeSavedMethodFields(sanitized);
  sanitized = sanitizeSavedBloodlineFields(sanitized);
  sanitized = sanitizeSavedEquipmentMemoryFields(sanitized);
  sanitized = migrateSavedReplacedCombatEncounter(sanitized);
  sanitized = sanitizeSavedShelterCombatFields(sanitized);
  sanitized = sanitizeSavedFalseTestimonyFields(sanitized);
  sanitized = sanitizeSavedCombatReplayFields(sanitized);
  return sanitizeSavedProtocolSettlementField(sanitized);
}

export function isWebV1SavedGameState(value: unknown): value is SavedGameState {
  return isSavedGameState(value);
}

/**
 * Normalize a state that has already passed the Web v1 validator, including the
 * current illegal-inferno and depleted-run recovery branches. This function is
 * pure: it neither persists the normalized state nor removes the source.
 */
export function migrateValidatedWebV1State(
  savedState: SavedGameState
): WebV1ParityMigration {
  const repairs: WebV1ParityNotice[] = [];
  const warnings: WebV1ParityNotice[] = [];
  const shouldRecoverDepletedRun =
    savedState.player.hp <= 0 &&
    Boolean(savedState.run) &&
    (savedState.phase === 'explore' || savedState.phase === 'combat');
  let normalized = normalizeSavedState(savedState);

  if (JSON.stringify(normalized) !== JSON.stringify(savedState)) {
    repairs.push({
      code: 'web-v1-state-normalized',
      path: '$.state',
      message: 'Web v1 defaults, snapshots, derived maxHp, or subsystem state were normalized.'
    });
  }

  if (savedState.run && savedState.run.tacticalLoadout === undefined) {
    warnings.push({
      code: 'legacy-run-without-tactical-snapshot',
      path: '$.state.run.tacticalLoadout',
      message: 'An absent historical tactical snapshot remains absent and unrestricted.'
    });
  }
  if (savedState.run && savedState.run.companionSnapshot === undefined) {
    warnings.push({
      code: 'legacy-run-without-companion-snapshot',
      path: '$.state.run.companionSnapshot',
      message: 'Companion assistance remains disabled for this historical run.'
    });
  }
  if (
    savedState.run &&
    savedState.run.methodSnapshots === undefined &&
    savedState.run.methodSnapshot === undefined
  ) {
    warnings.push({
      code: 'legacy-run-without-method-snapshot',
      path: '$.state.run.methodSnapshots',
      message: 'Method techniques remain disabled for this historical run.'
    });
  } else if (
    savedState.run?.methodSnapshots === undefined &&
    savedState.run?.methodSnapshot !== undefined
  ) {
    warnings.push({
      code: 'legacy-single-method-snapshot',
      path: '$.state.run.methodSnapshot',
      message: 'The historical single method snapshot is preserved without backfilling other methods.'
    });
  }
  if (savedState.run && savedState.run.bloodlineSnapshot === undefined) {
    warnings.push({
      code: 'legacy-run-without-bloodline-snapshot',
      path: '$.state.run.bloodlineSnapshot',
      message: 'Bloodline surge remains disabled for this historical run.'
    });
  }

  const rawRun = savedState.run;
  const rawInfernoTierIsExplicit =
    rawRun?.protocol?.id === 'deep' &&
    Number.isSafeInteger(rawRun.protocol.infernoTier) &&
    (rawRun.protocol.infernoTier ?? 0) >= 1;
  const rawInfernoShapeIsInvalid =
    rawRun?.protocol?.id === 'deep' &&
    (
      (
        rawRun.entryFlowVersion === 2 &&
        rawInfernoTierIsExplicit &&
        (rawRun.protocol.infernoTier ?? 0) > 1 &&
        rawRun.infernoMap === undefined
      ) ||
      (
        rawRun.entryFlowVersion !== 2 &&
        (rawInfernoTierIsExplicit || rawRun.infernoMap !== undefined)
      )
    );
  const activeRun = normalized.run;
  const activeInfernoTier =
    activeRun?.protocol?.id === 'deep' &&
    Number.isSafeInteger(activeRun.protocol.infernoTier) &&
    (activeRun.protocol.infernoTier ?? 0) >= 1
      ? activeRun.protocol.infernoTier
      : 1;
  const shouldRecoverIllegalInfernoRun =
    activeRun !== undefined &&
    (normalized.phase === 'explore' || normalized.phase === 'combat') &&
    activeRun.protocol?.id === 'deep' &&
    (
      rawInfernoShapeIsInvalid ||
      getInfernoUnlockedTier(normalized, activeRun.dungeonId) < 1 ||
      (activeInfernoTier ?? 1) > getInfernoUnlockedTier(normalized, activeRun.dungeonId)
    );

  if (shouldRecoverIllegalInfernoRun) {
    normalized = discardInvalidSavedRun(
      normalized,
      '恢复历史存档时检测到非法或未解锁的炼狱运行，本轮临时战利品已丢弃并安全返回主神空间；既有永久进度与仓库保持不变。'
    );
    repairs.push({
      code: 'illegal-inferno-run-discarded',
      path: '$.state.run',
      message: 'The invalid or locked inferno run was discarded using Web v1 loot rollback semantics.'
    });
  } else if (shouldRecoverDepletedRun) {
    normalized = resolveRunFailure(
      {
        ...normalized,
        player: { ...normalized.player, hp: 0 }
      },
      '恢复历史存档时检测到生命已经归零，主神强制回收。'
    );
    repairs.push({
      code: 'depleted-run-settled',
      path: '$.state.player.hp',
      message: 'The zero-HP active run was settled through the Web v1 failure reducer.'
    });
  }

  return { state: normalized, repairs, warnings };
}
