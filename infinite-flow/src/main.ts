import './styles.css';
import * as gameApi from './game';
import * as dungeonLawApi from './dungeon-laws';
import { getExplorationGuide } from './exploration-guide';
import { getNodeVisibility, type VisibilityState } from './exploration-visibility';
import {
  DUNGEON_FEATURE_HELP,
  isDungeonFeatureHelpId,
  type DungeonFeatureHelpId
} from './dungeon-feature-help';
import { getGameAsset, type GameAssetKind } from './game-assets';
import {
  activateOwnedEquipmentMemory,
  activateBloodline,
  activateMethod,
  activateCompanion,
  activatePet,
  type ActiveEquipmentCommission,
  attuneEquipment,
  buyEquipment,
  buyItem,
  buyPet,
  capturePet,
  claimTaskReward,
  collectReward,
  configureRunRelicPreparation,
  configureTacticalLoadout,
  createInitialState,
  DEFAULT_PREPARED_TACTICAL_ITEM_IDS,
  DUNGEONS,
  DUNGEON_ORDER,
  enterDungeon,
  EQUIPMENT,
  EQUIPMENT_ATTUNEMENT_COST,
  EQUIPMENT_SLOTS,
  equipEquipment,
  getEquipmentCommissionStatus,
  getCampaignGates,
  getBossSealStatus,
  getCombatEncounterProfile,
  getCurrentCompanionAssistStatus,
  getCurrentMethodTechniqueStatus,
  getCurrentCombatIntent,
  getCurrentCausalLedgerStatus,
  getCurrentDungeonLaw,
  getCurrentEscortCheckpointStatus,
  getCurrentVerdictStatus,
  getCurrentEquipmentHuntStatus,
  getCurrentEquipmentMemoryCombatStatus,
  getCurrentEquipmentMemoryHuntStatus,
  getCurrentFieldSurveyStatus,
  getCurrentGenesisSpliceStatus,
  getCurrentMirrorCityPhaseStatus,
  getCurrentRedactionClauseStatus,
  getCurrentAuctionLotStatus,
  getCurrentRouteBlockReason,
  getCurrentRouteGateStatus,
  getCurrentRunPursuit,
  getCurrentRunPressure,
  getCurrentRunMethodSnapshots,
  getCurrentRunRelicEffects,
  getCurrentRunProtocol,
  getCurrentWeaponResonanceProgress,
  getCurrentBloodlineSurgeStatus,
  getCurrentBroadcastRelayStatus,
  getDerivedStats,
  getDungeonReadiness,
  getEquipmentHuntPreparationStatus,
  getEquipmentMemoryHuntPreparationStatus,
  getEquipmentMemoryStatus,
  getEquipmentRecipePurchaseStatus,
  getEquipmentTemperStatus,
  getEquipmentSoulSkillActionStatus,
  getEquipmentSoulSkillActionStatuses,
  getEquipmentSoulSkillRechargeStatus,
  getNodeDepartureBlock,
  getNodeDepartureBlockReason,
  getPlayerPower,
  getRunRelicPreparationStatus,
  getTacticalLoadoutStatus,
  getWeaponSkillStatus,
  handleTrap,
  ITEMS,
  isCurrentDungeonFeatureAvailable,
  isEquipmentCommissionSealed,
  isTacticalItemAvailable,
  learnMethod,
  METHODS,
  MONSTERS,
  moveToNode,
  normalizeCombatReplayCombatState,
  normalizeCombatReplayRunState,
  PETS,
  prepareEquipmentHunt,
  prepareEquipmentMemoryHunt,
  performCombatAction,
  recruitCompanion,
  resolveEquipmentLoot,
  resolveCurrentEquipmentSoulSkillRecharge,
  resolveCurrentBroadcastRelay,
  resolveCurrentEscortCheckpoint,
  resolveCurrentVerdictChoice,
  resolveFieldSurvey,
  resolveGenesisSplice,
  resolveMirrorCityPhase,
  resolveRedactionClause,
  resolveAuctionLot,
  resolveExit,
  resolveRunRelicArchive,
  resolveRunRelicDraft,
  resolveRetreat,
  recallEquipmentCommission,
  returnToHub,
  selectCombatReplayRoute,
  selectNode,
  startEquipmentCommission,
  activateCurrentEquipmentSoulSkillRecharge,
  cancelCurrentEquipmentSoulSkillRecharge,
  temperEquipment,
  upgradeCompanion,
  upgradeMethod,
  upgradeEquipment,
  useEquipmentSoulSkill,
  useCompanionAssist,
  useMethodTechnique,
  useBloodlineSurge,
  usePortal,
  unlockBloodline,
  upgradeBloodline,
  type CombatAction,
  type CombatReplayCombatState,
  type CombatReplayRoute,
  type CombatReplayRunState,
  type CombatState,
  type CausalLedgerChoice,
  type CausalLedgerStatus,
  type Cost,
  type DerivedStats,
  type DungeonId,
  type DungeonNode,
  type DungeonReadiness,
  type DungeonRun,
  type EquipmentId,
  type EquipmentCommissionSettlement,
  type EquipmentSoulSkillActionStatus,
  type EquipmentSlot,
  type GameState,
  type ItemId,
  type MethodId,
  type MirrorCityPhase,
  type RedactionChoice,
  type RedactionClauseStatus,
  type PetId,
  type RunPressureSettlement,
  type RunPursuitSettlement,
  type RunProtocolSettlement,
  type RunProtocolSnapshot,
  type RunRelicSettlement
} from './game';
import {
  METHOD_CULTIVATION_RULES_VERSION,
  METHOD_TECHNIQUE_CATALOG,
  getMethodRank as getCultivationMethodRank,
  getMethodTechniqueDefinition,
  getMethodTechniqueEffect,
  getMethodUpgradeCost,
  getMethodUpgradeStatus,
  isMethodRank,
  normalizeMethodCultivationProgress,
  normalizeMethodRunSnapshot,
  normalizeMethodRunSnapshots
} from './method-cultivation';
import type {
  MethodCultivationProgress,
  MethodRank,
  MethodRunSnapshot
} from './method-cultivation';
import {
  EQUIPMENT_COMMISSION_MATERIAL_REWARD,
  EQUIPMENT_COMMISSION_REQUIRED_DUNGEONS,
  normalizeEquipmentCommission,
  type EquipmentCommissionValidators
} from './equipment-commissions';
import {
  getEquipmentAttunementOptions,
  getEquipmentTemperDefinition,
  getEquipmentScore,
  getEquipmentSetTags,
  getEquipmentSwapPreview,
  getEquipmentSystemBonus,
  type EquipmentAttunementId,
  type EquipmentAttunementMap,
  type EquipmentTemperMap,
  type EquipmentSetTag
} from './equipment-system';
import { COMBAT_FOCUS_MAX, resolveCombatFocus } from './combat-focus';
import { getPetPassiveTags, getPetStatBonus, getPetUpgradeCost, type PetPassiveTag } from './pet-system';
import {
  calculateRunEconomy,
  createEmptyRunLootBag,
  type RunExitStatus,
  type RunLootBag,
  type RunLootSettlement
} from './run-economy';
import {
  DUNGEON_ELITE_MONSTERS,
  DUNGEON_MATERIAL_REWARDS,
  getDungeonEquipmentRecipes,
  type DungeonEquipmentRecipe
} from './dungeon-loot';
import {
  DUNGEON_LAW_LANDMARKS,
  getCombatReplayStatus,
  getMirrorCityShellStatus,
  normalizeDungeonLawState,
  recordCombatReplayTake,
  selectCombatReplayRoute as selectCombatReplayLawRoute,
  type ArchiveFeature,
  type AuctionLotChoice,
  type AuctionLotStatus,
  type BroadcastRelayChoice,
  type BroadcastRelayStatus,
  type DungeonLawModifiers,
  type EntropyHeadingChoice,
  type EntropyHeadingStatus,
  type EscortCheckpointChoice,
  type EscortCheckpointStatus,
  type FalseTestimonySuspect,
  type GenesisGene,
  type GenesisSpliceStatus
} from './dungeon-laws';
import { analyzeCampaignBalance, simulateSevenDungeonVictoryRoute, type BalanceSimStage, type SevenDungeonRouteSummary } from './balance-sim';
import { getDirectiveForDungeon, type DirectiveObjectiveResult, type DirectiveStatus } from './directive-system';
import {
  evaluateVisibleSideTasks,
  getNextMainlineTaskEvaluation,
  type MainGodTaskEvaluation,
  type MainGodTaskStatus
} from './task-system';
import {
  getDungeonEvents,
  type DungeonEventOutcome,
  type DungeonEventRequirement,
  type DungeonEventRisk,
  type EvaluatedDungeonEventOption
} from './dungeon-events';
import { getShopAdvice, type ShopAdvice } from './shop-advice';
import { getWeaponSkillDefinition, type WeaponSkillDefinition } from './weapon-skills';
import {
  getRunProtocolDefinition,
  getRunProtocolRequiredNodeIds,
  type DeepRunProtocolDefinition,
  type RunProtocolId
} from './run-protocols';
import {
  getEquipmentFieldRigDescription,
  getEquipmentFieldRigLabel
} from './equipment-field-rigs';
import { getRouteSectorDisplay } from './dungeon-routes';
import {
  TACTICAL_ITEM_CATEGORIES,
  TACTICAL_ITEM_IDS,
  getTacticalItemCategory,
  isTacticalItemId,
  type TacticalItemCategory,
  type TacticalItemId,
  type TacticalLoadoutSnapshot
} from './tactical-loadout';
import {
  RUN_RELIC_DEFINITIONS,
  RUN_RELIC_FRAME_DEFINITIONS,
  RUN_RELIC_FRAMES,
  RUN_RELIC_IDS_BY_FRAME,
  isRunRelicFrame,
  isRunRelicId,
  isRunRelicState,
  type RunRelicFrame,
  type RunRelicId,
  type RunRelicState
} from './run-relics';
import {
  getActiveEquipmentRelicConduits,
  getEquipmentRelicConduitByEquipmentId,
  getEquipmentRelicConduitFrameMatch,
  type RelicConduitEquipmentId
} from './equipment-relic-conduits';
import {
  EQUIPMENT_SOUL_SKILL_CATALOG,
  getActiveEquipmentSoulSkills,
  getEquipmentSoulSkillByEquipmentId,
  isEquipmentSoulSkillRunState,
  normalizeEquipmentSoulSkillRunState,
  type EquipmentSoulSkillDefinition,
  type EquipmentSoulSkillId,
  type EquipmentSoulSkillRunState
} from './equipment-soul-skills';
import {
  FIELD_SURVEY_CATALOG,
  isFieldSurveyRunState,
  normalizeFieldSurveyRunState,
  type FieldSurveyOption,
  type FieldSurveyRunState
} from './field-surveys';
import {
  isEquipmentHuntRunState,
  normalizeEquipmentHuntRunState,
  normalizePreparedEquipmentHunt,
  type EquipmentHuntRunState,
  type PreparedEquipmentHunt
} from './equipment-hunts';
import {
  EQUIPMENT_MEMORY_CATALOG,
  EQUIPMENT_MEMORY_EQUIPMENT_CATALOG,
  getEquipmentMemoryById,
  getEquipmentMemoryHuntDisplayStatus,
  getEquipmentMemoryHuntProgress,
  isEquipmentMemoryEquipmentId,
  isEquipmentMemoryId,
  normalizeEquipmentMemoryCombatState,
  normalizeEquipmentMemoryHuntRunState,
  normalizeEquipmentMemoryMap,
  normalizeEquipmentMemoryRunSnapshot,
  normalizePreparedEquipmentMemoryHunt,
  sanitizeEquipmentMemoryMap,
  type EquipmentMemoryCombatState,
  type EquipmentMemoryEquipmentId,
  type EquipmentMemoryHuntRunState,
  type EquipmentMemoryHuntSettlement,
  type EquipmentMemoryId,
  type EquipmentMemoryMap,
  type EquipmentMemoryRunSnapshot,
  type PreparedEquipmentMemoryHunt
} from './equipment-memory-hunts';
import {
  isRunPressureState,
  normalizeRunPressureState,
  type RunPressureState,
  type RunPressureTier
} from './run-pressure';
import {
  getRouteContractDisplayStatus,
  getRouteContractProgress,
  listRouteContracts,
  normalizeRouteContractRunState,
  type RouteContractProgress,
  type RouteContractRunState,
  type RouteContractSettlement
} from './route-contracts';
import {
  getRunPursuitDefinition,
  normalizeRunPursuitState,
  type RunPursuitState
} from './run-pursuit';
import {
  COMPANION_CATALOG,
  COMPANION_RULES_VERSION,
  getCompanionAssistEffect,
  getCompanionRecruitmentStatus,
  getCompanionUpgradeCost,
  getCompanionUpgradeStatus,
  normalizeCompanionProgress,
  normalizeCompanionRunSnapshot,
  type CompanionId,
  type CompanionProgress,
  type CompanionRank,
  type CompanionRunSnapshot
} from './companion-system';
import {
  BLOODLINE_CATALOG,
  BLOODLINE_RULES_VERSION,
  getBloodlineDefinition,
  getBloodlineRank,
  getBloodlineStatBonus,
  getBloodlineSurgeEffect,
  getBloodlineUpgradeCost,
  getBloodlineUpgradeStatus,
  normalizeBloodlineProgress,
  normalizeBloodlineRunSnapshot,
  type BloodlineAspect,
  type BloodlineId,
  type BloodlineProgress,
  type BloodlineRank,
  type BloodlineRunSnapshot
} from './bloodline-system';

type ViewAction = {
  id: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  hint?: string;
  persist?: boolean;
};
type RenderFocusTarget =
  | 'causal-ledger-dialog'
  | 'entropy-heading'
  | 'entropy-heading-move'
  | 'mirror-phase'
  | 'mirror-phase-move'
  | 'redaction-clause'
  | 'redaction-clause-move'
  | 'auction-lot'
  | 'auction-lot-move'
  | 'character-dialog'
  | 'character-trigger'
  | 'task-dialog'
  | 'task-trigger'
  | 'companion-dialog'
  | 'companion-trigger'
  | 'method-dialog'
  | 'method-trigger'
  | 'bloodline-dialog'
  | 'bloodline-trigger'
  | 'protocol-dialog'
  | 'protocol-mode'
  | 'protocol-trigger'
  | 'hub-directory-dialog'
  | 'hub-directory-trigger'
  | 'hub-codex-search'
  | 'equipment-commission-dialog'
  | 'equipment-commission-trigger'
  | { actionId: string }
  | { equipmentMemorySelect: EquipmentMemoryEquipmentId };
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
type EquipmentMemoryGameState = Omit<GameState, 'run' | 'combat'> & {
  equipmentMemories?: EquipmentMemoryMap;
  preparedEquipmentMemoryHunt?: PreparedEquipmentMemoryHunt;
  bloodlineRanks?: Partial<Record<BloodlineId, BloodlineRank>>;
  activeBloodline?: BloodlineId;
  run?: EquipmentMemoryDungeonRun;
  combat?: EquipmentMemoryCombat;
};
type OptionalGameApi = typeof gameApi & {
  getCurrentEntropyHeadingStatus?: (state: GameState) => EntropyHeadingStatus | undefined;
  resolveEntropyHeading?: (state: GameState, choice: EntropyHeadingChoice) => GameState;
  selectPanopticonRoute?: (state: GameState, route: PanopticonRoute) => GameState;
  upgradePet?: (state: GameState, petId: PetId) => GameState;
};
type PanopticonRoute = 'shadow' | 'decoy' | 'refraction';
type PanopticonBossSnapshotState = 'none' | 'frozen' | 'defeated';
type PanopticonUiStatus = {
  raw: Record<string, unknown>;
  scanPhase: string;
  scanPhaseIndex: number;
  moveCount: number;
  exposureCount: number;
  relayCount: number;
  pendingRouteNodeId: string | null;
  route: PanopticonRoute | null;
  refractionCharges: number;
  decoyRewardsGranted: boolean;
  bossSnapshot: PanopticonBossSnapshotState;
  entryGearFrozenCount: number;
  state: 'tracking' | 'choice-ready' | 'routed' | 'frozen' | 'resolved' | 'legacy';
};
type OptionalDungeonLawApi = typeof dungeonLawApi & {
  getPanopticonStatus?: (lawState: ReturnType<typeof normalizeDungeonLawState>) => unknown;
};
type RunEconomyOutcome = ReturnType<typeof calculateRunEconomy>['outcome'];
type ShopRecommendation = {
  id: string;
  title: string;
  target: string;
  reason: string;
  impact: string;
  affordability: string;
  affordable: boolean;
  score: number;
  action?: ViewAction;
};
type SavedEquipped = Partial<Record<EquipmentSlot, EquipmentId>> & Record<'weapon' | 'armor' | 'charm', EquipmentId>;
type SavedInventory = Record<Exclude<ItemId, 'cycle_imprint' | 'chronal_glass' | 'phase_glass' | 'redaction_ink' | 'legacy_scrip' | 'genesis_serum' | 'silence_core' | 'rescue_badge' | 'truth_fragment' | 'combat_reel' | 'observation_shard'>, number> & {
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
  equipmentHunt?: EquipmentHuntRunState;
  lawState?: unknown;
  pressureState?: RunPressureState;
  routeContractState?: RouteContractRunState;
  lastRouteContractSettlement?: RouteContractSettlement;
  lastPressureSettlement?: RunPressureSettlement;
  lastRelicSettlement?: RunRelicSettlement;
  lastEquipmentCommissionSettlement?: EquipmentCommissionSettlement;
  equipmentMemorySnapshot?: EquipmentMemoryRunSnapshot;
  equipmentMemoryHunt?: EquipmentMemoryHuntRunState;
  lastEquipmentMemoryHuntSettlement?: EquipmentMemoryHuntSettlement;
  pursuitState?: RunPursuitState;
  lastPursuitSettlement?: RunPursuitSettlement;
  companionSnapshot?: CompanionRunSnapshot;
  methodSnapshots?: readonly MethodRunSnapshot[];
  methodSnapshot?: MethodRunSnapshot;
  bloodlineSnapshot?: BloodlineRunSnapshot;
  combatReplayState?: CombatReplayRunState;
};
type SavedCombat = Omit<EquipmentMemoryCombat, 'equipmentMemoryState' | 'methodTechniqueUsedIds' | 'methodTechniqueUsed' | 'bloodlineSurgeUsed' | 'bloodlineBarrier' | 'combatReplayState'> & {
  equipmentMemoryState?: EquipmentMemoryCombatState;
  methodTechniqueUsedIds?: MethodId[];
  methodTechniqueUsed?: boolean;
  bloodlineSurgeUsed?: boolean;
  bloodlineBarrier?: number;
  combatReplayState?: CombatReplayCombatState;
};
type SavedGameState = Omit<
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

type ProtocolSelection = {
  dungeonId: DungeonId;
  protocolId: RunProtocolId;
  routeContractId?: string;
};

type HubPanel = 'codex' | 'dungeons' | 'pets' | 'supplies' | 'equipment' | 'forge';
type CodexCategory = 'all' | 'dungeons' | 'monsters' | 'equipment' | 'items' | 'pets' | 'methods' | 'bloodlines';
type CodexEntry = {
  id: string;
  category: Exclude<CodexCategory, 'all'>;
  name: string;
  description: string;
  status: string;
};
type ShopMode = 'all' | 'supplies' | 'equipment' | 'forge';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app root');
const root = app;

const STORAGE_VERSION = 1;
const STORAGE_KEY = `infinite-flow:save:v${STORAGE_VERSION}`;
const LEGACY_PROTOCOL_PREPARATION_VISIBLE = false;
const CAMPAIGN_DUNGEON_COUNT = DUNGEON_ORDER.length;
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
const equipmentCommissionValidators: EquipmentCommissionValidators<EquipmentId, ItemId, DungeonId> = {
  isEquipmentId: (value): value is EquipmentId => hasOwnKey(EQUIPMENT, value),
  isItemId: (value): value is ItemId => hasOwnKey(ITEMS, value),
  isDungeonId: (value): value is DungeonId => hasOwnKey(DUNGEONS, value)
};

let state: EquipmentMemoryGameState = loadSavedState();
let isCharacterPanelOpen = false;
let isTaskPanelOpen = false;
let isCompanionPanelOpen = false;
let isMethodPanelOpen = false;
let isBloodlinePanelOpen = false;
let isEquipmentCommissionModalOpen = false;
let modalFocusRequest = 0;
let selectedCommissionEquipmentIds: EquipmentId[] = [];
let selectedCommissionMaterialId: ItemId | undefined;
let protocolSelection: ProtocolSelection | undefined;
let protocolTriggerDungeonId: DungeonId | undefined;
let hubPanel: HubPanel | undefined;
let hubPanelTriggerActionId: string | undefined;
let codexCategory: CodexCategory = 'all';
let codexSearch = '';
let featureHelpTrigger: HTMLButtonElement | undefined;
let featureHelpHideTimer: number | undefined;
let suppressFeatureHelpFocus = false;
let lastBroadcastRelayResult: {
  nodeId: string;
  choice: BroadcastRelayChoice;
  noiseBefore: number;
  noiseAfter: number;
  bonusRewardPoints: number;
} | undefined;
let lastShelterCheckpointResult: {
  nodeId: string;
  choice: EscortCheckpointChoice;
  hpBefore: number;
  hpAfter: number;
  healingPillCost: number;
  bonusRewardPoints: number;
} | undefined;
const optionalGameApi = gameApi as OptionalGameApi;
const optionalDungeonLawApi = dungeonLawApi as OptionalDungeonLawApi;

// Keep catalogs derived from rule exports so parallel content additions appear without another UI pass.
const shopItems = (Object.keys(ITEMS) as ItemId[]).filter((itemId) => Boolean(ITEMS[itemId].cost));
const equipmentShop = (Object.keys(EQUIPMENT) as EquipmentId[]).filter((equipmentId) => hasSpendableCost(EQUIPMENT[equipmentId].cost));
const methodShop = Object.keys(METHODS) as MethodId[];
const petIds = Object.keys(PETS) as PetId[];

function getUnlockedEquipmentRecipes(equipmentId?: EquipmentId): DungeonEquipmentRecipe[] {
  return DUNGEON_ORDER
    .filter((dungeonId) => state.completedDungeonIds.includes(dungeonId))
    .flatMap((dungeonId) => getDungeonEquipmentRecipes(dungeonId))
    .filter((recipe) => equipmentId === undefined || recipe.equipmentId === equipmentId);
}

function getPreferredEquipmentRecipe(equipmentId: EquipmentId): DungeonEquipmentRecipe | undefined {
  const recipes = getUnlockedEquipmentRecipes(equipmentId);
  return recipes.find((recipe) => state.inventory[recipe.materialId] >= recipe.materialAmount) ?? recipes[0];
}
const slotLabels: Record<EquipmentSlot, string> = {
  weapon: '武器',
  head: '头部',
  armor: '身体',
  hands: '手部',
  feet: '足部',
  waist: '腰部',
  charm: '护符'
};
const nodeTypeLabels: Record<DungeonNode['type'], string> = {
  monster: '怪物',
  trap: '陷阱',
  portal: '传送',
  reward: '奖励',
  exit: '出口'
};
const readinessMeta: Record<DungeonReadiness, { label: string; hint: string }> = {
  ready: { label: '战力充足', hint: '可稳定进入' },
  hard: { label: '较为吃力', hint: '建议补强' },
  deadly: { label: '极度危险', hint: '高概率失败' }
};
const equipmentSetLabels: Record<EquipmentSetTag, string> = {
  mist: '雾行',
  forge: '星炉',
  rift: '裂隙',
  chronal: '时序'
};
const petPassiveLabels: Record<PetPassiveTag, string> = {
  trap_scout: '探陷',
  combat_assist: '助战',
  portal_anchor: '锚门'
};
const outcomeLabels: Record<RunEconomyOutcome, string> = {
  clean_clear: '完美撤离',
  normal_clear: '稳定通关',
  retreat: '中途撤回',
  failed_recovered: '濒死回收'
};
const statLabels: Partial<Record<keyof DerivedStats, string>> = {
  body: '体',
  spirit: '灵',
  agility: '身',
  luck: '运',
  maxHp: '命',
  attack: '攻',
  artPower: '术',
  defense: '防',
  speed: '速',
  trapCheck: '察'
};
const eventRiskLabels: Record<DungeonEventRisk, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险'
};
const directiveStatusLabels: Record<DirectiveStatus, string> = {
  locked: '未开启',
  active: '执行中',
  completed: '已完成',
  failed: '目标未满'
};
const taskStatusLabels: Record<MainGodTaskStatus, string> = {
  locked: '未开启',
  active: '进行中',
  completed: '可领取',
  claimed: '已领取'
};
const campaignStatusLabels = {
  available: '已解锁',
  locked: '锁定',
  completed: '已完成'
} as const;
const combatIntentSeverityLabels = {
  normal: '常态',
  warning: '警戒',
  danger: '危急'
} as const;
const runPressureTierLabels: Record<RunPressureTier, string> = {
  stable: '稳定',
  hunted: '追猎',
  breach: '破界'
};
const tacticalItemCategoryLabels: Record<TacticalItemCategory, string> = {
  combat: '战斗',
  ward: '防护',
  portal: '传送',
  capture: '捕获'
};
const combatActionLabels: Record<CombatAction, string> = {
  attack: '攻击',
  art: '功法',
  guard: '防御',
  use_healing_pill: '止血丹',
  use_thunder_talisman: '雷火符',
  escape: '撤离',
  weapon_skill: '武器战技'
};
const archiveFeatureLabels: Record<ArchiveFeature, string> = {
  consumable: '消耗品',
  method: '功法',
  pet: '宠物',
  attack: '攻击',
  defense: '防御'
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

function isSavedPendingEquipmentOffer(value: unknown): value is NonNullable<DungeonRun['pendingEquipmentOffer']> {
  if (!isRecord(value) || !isKnownStringArray(value.equipmentIds, EQUIPMENT)) return false;

  return (
    typeof value.offerId === 'string' &&
    value.offerId.length > 0 &&
    value.equipmentIds.length > 0 &&
    value.equipmentIds.length <= 3 &&
    new Set(value.equipmentIds).size === value.equipmentIds.length &&
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
    value.rulesVersion === 1
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
    ? hasExpectedDeepMaterialReward
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
      combat.methodTechniqueUsedIds = [...new Set(
        value.combat.methodTechniqueUsedIds.filter(
          (methodId): methodId is MethodId => hasOwnKey(METHODS, methodId) && availableMethodIds.has(methodId as MethodId)
        )
      )];
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
    (value.entryFlowVersion === undefined || value.entryFlowVersion === 2) &&
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
      normalizeSavedEquipmentCommissionSettlement(value.lastEquipmentCommissionSettlement) !== undefined)
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

function clearSavedState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Local storage can be unavailable in restricted browser modes; gameplay should continue.
  }
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
  const ownedEquipment = [...new Set([...savedState.ownedEquipment, ...requiredEquipmentIds])];
  const equipmentLevels: Partial<Record<EquipmentId, number>> = { ...savedState.equipmentLevels };

  for (const equipmentId of requiredEquipmentIds) {
    equipmentLevels[equipmentId] ??= initialState.equipmentLevels[equipmentId] ?? 1;
  }

  // An absent legacy tactical snapshot intentionally remains unrestricted after normalization and re-save.
  const run: EquipmentMemoryDungeonRun | undefined = savedState.run
    ? {
        ...savedState.run,
        lootBag: savedState.run.lootBag ?? createEmptyRunLootBag<ItemId, EquipmentId>(),
        lootOffersMade: savedState.run.lootOffersMade ?? 0,
        tacticalLoadout: savedState.run.tacticalLoadout,
        pressureState: normalizeRunPressureState(savedState.run.pressureState),
        ...(Object.prototype.hasOwnProperty.call(savedState.run, 'combatReplayState')
          ? { combatReplayState: normalizeCombatReplayRunState(savedState.run.combatReplayState) }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(savedState.run, 'routeContractState')
          ? {
              routeContractState: normalizeRouteContractRunState(
                savedState.run.routeContractState,
                savedState.run.dungeonId
              )
            }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(savedState.run, 'lastRouteContractSettlement')
          ? {
              lastRouteContractSettlement: normalizeSavedRouteContractSettlement(
                savedState.run.lastRouteContractSettlement
              )
            }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(savedState.run, 'equipmentMemorySnapshot')
          ? {
              equipmentMemorySnapshot: normalizeEquipmentMemoryRunSnapshot(
                savedState.run.equipmentMemorySnapshot
              )
            }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(savedState.run, 'equipmentMemoryHunt')
          ? {
              equipmentMemoryHunt: normalizeEquipmentMemoryHuntRunState(
                savedState.run.equipmentMemoryHunt
              )
            }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(savedState.run, 'pursuitState')
          ? {
              pursuitState: normalizeSavedCurrentRunPursuitState(
                savedState.run.pursuitState,
                savedState.run.dungeonId
              )
            }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(savedState.run, 'lastPursuitSettlement')
          ? {
              lastPursuitSettlement: normalizeSavedRunPursuitSettlement(
                savedState.run.lastPursuitSettlement
              )
            }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(savedState.run, 'companionSnapshot')
          ? {
              companionSnapshot: normalizeCompanionRunSnapshot(
                savedState.run.companionSnapshot
              )
            }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(savedState.run, 'methodSnapshots')
          ? { methodSnapshots: normalizeMethodRunSnapshots(savedState.run.methodSnapshots) }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(savedState.run, 'methodSnapshot')
          ? { methodSnapshot: normalizeMethodRunSnapshot(savedState.run.methodSnapshot) }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(savedState.run, 'bloodlineSnapshot')
          ? { bloodlineSnapshot: normalizeBloodlineRunSnapshot(savedState.run.bloodlineSnapshot) }
          : {}),
        lastEquipmentMemoryHuntSettlement: normalizeSavedEquipmentMemoryHuntSettlement(
          savedState.run.lastEquipmentMemoryHuntSettlement
        ),
        equipmentHunt: savedState.run.equipmentHunt === undefined
          ? undefined
          : normalizeEquipmentHuntRunState(savedState.run.equipmentHunt),
        pendingEquipmentOffer: savedState.run.pendingEquipmentOffer
          ? {
              ...savedState.run.pendingEquipmentOffer,
              equipmentIds: [...savedState.run.pendingEquipmentOffer.equipmentIds]
            }
          : undefined,
        lastEquipmentCommissionSettlement: savedState.run.lastEquipmentCommissionSettlement
          ? {
              ...savedState.run.lastEquipmentCommissionSettlement,
              equipmentIds: [
                savedState.run.lastEquipmentCommissionSettlement.equipmentIds[0],
                savedState.run.lastEquipmentCommissionSettlement.equipmentIds[1]
              ],
              completedDungeonIds: [...savedState.run.lastEquipmentCommissionSettlement.completedDungeonIds]
            }
          : undefined,
        protocol: savedState.run.protocol ?? { id: 'standard', rulesVersion: 1 },
        lawState: normalizeDungeonLawState(savedState.run.lawState, savedState.run.dungeonId)
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
    inventory,
    ownedEquipment,
    equipmentLevels,
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
    run,
    combat
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

function loadSavedState(): EquipmentMemoryGameState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialUiState();

    const payload: unknown = JSON.parse(raw);
    const sanitizedState = isRecord(payload)
      ? sanitizeSavedCombatReplayFields(
        sanitizeSavedFalseTestimonyFields(
          sanitizeSavedShelterCombatFields(
          sanitizeSavedEquipmentMemoryFields(
            sanitizeSavedBloodlineFields(
            sanitizeSavedMethodFields(
              sanitizeSavedCompanionFields(
                sanitizeSavedEquipmentCommissionFields(
                  sanitizeSavedEquipmentHuntFields(sanitizeSavedPressureFields(sanitizeSavedRelicFields(payload.state)))
                )
              )
            )
            )
          )
          )
        )
        )
      : undefined;
    if (isRecord(payload) && payload.version === STORAGE_VERSION && isSavedGameState(sanitizedState)) {
      const normalized = normalizeSavedState(sanitizedState);
      saveState(normalized);
      return normalized;
    }
  } catch {
    // Corrupt or inaccessible local storage falls back to a fresh demo state.
  }

  clearSavedState();
  return createInitialUiState();
}

function saveState(nextState: EquipmentMemoryGameState): void {
  try {
    const persistedState: EquipmentMemoryGameState = nextState.combat
      ? { ...nextState, combat: { ...nextState.combat } }
      : nextState;
    if (persistedState.combat) delete persistedState.combat.weaponSkillUsed;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, state: persistedState }));
  } catch {
    // Saving is best-effort so quota/privacy failures do not break the playable demo.
  }
}

function currentDungeon() {
  return state.run ? DUNGEONS[state.run.dungeonId] : undefined;
}

function currentNode(): DungeonNode | undefined {
  const dungeon = currentDungeon();
  return dungeon?.nodes.find((node) => node.id === state.run?.currentNodeId);
}

function syncCombatReplayLawState(nextState: EquipmentMemoryGameState): EquipmentMemoryGameState {
  if (nextState.run?.dungeonId !== 'combat_replay_stage') return nextState;
  const replay = normalizeCombatReplayRunState(nextState.run.combatReplayState);
  if (!replay) return nextState;

  let lawState = normalizeDungeonLawState(nextState.run.lawState, 'combat_replay_stage');
  for (const [index, takeId] of (['take_alpha', 'take_beta', 'take_gamma'] as const).entries()) {
    const recording = replay.recordings[takeId];
    if (!recording || getCombatReplayStatus(lawState).takes[index] !== null) continue;
    const resolution = recordCombatReplayTake(lawState, takeId, recording.action, recording.observedValue);
    if (resolution.recorded) lawState = resolution.state;
  }
  if (replay.route && getCombatReplayStatus(lawState).route === null) {
    const resolution = selectCombatReplayLawRoute(lawState, replay.route);
    if (resolution.selected) lawState = resolution.state;
  }
  if (lawState === nextState.run.lawState) return nextState;
  return { ...nextState, run: { ...nextState.run, lawState } };
}

function getDirectiveForCurrentDungeon(dungeonId?: DungeonId) {
  return gameApi.getDirectiveEvaluation(state, dungeonId);
}

function equippedEquipmentIds(): EquipmentId[] {
  return EQUIPMENT_SLOTS.map((slot) => state.equipped[slot]);
}

function getEquipmentMemoryEntry(equipmentId: EquipmentId) {
  return sanitizeEquipmentMemoryMap(state.equipmentMemories)[equipmentId];
}

function getEquipmentMemoryName(memoryId: EquipmentMemoryId | undefined): string {
  return memoryId ? getEquipmentMemoryById(memoryId)?.name ?? memoryId : '未激活';
}

function getEquipmentMemoryAttunementName(
  equipmentId: EquipmentId,
  attunementId = state.equipmentAttunements?.[equipmentId]
): string {
  if (!attunementId) return '无';
  return getEquipmentAttunementOptions(equipmentId).find((option) => option.id === attunementId)?.name ?? attunementId;
}

function getCurrentEquipmentMemoryHunt(): EquipmentMemoryHuntRunState | undefined {
  if (!state.run) return undefined;
  const hunt = normalizeEquipmentMemoryHuntRunState(state.run.equipmentMemoryHunt);
  return hunt?.dungeonId === state.run.dungeonId ? hunt : undefined;
}

function getEquipmentMemoryEventTitle(dungeonId: DungeonId, eventId: string): string {
  return getDungeonEvents(dungeonId).find((event) => event.id === eventId)?.title ?? eventId;
}

function renderEquipmentMemoryCompactLabel(equipmentId: EquipmentId): string {
  const memoryStatus = getEquipmentMemoryStatus(state, equipmentId);
  if (!memoryStatus.supported) return '';
  return `<span
    class="equipment-memory-compact"
    data-equipment-memory-equipment="${equipmentId}"
    data-equipment-memory-collection="${memoryStatus.unlockedMemories.length}"
    data-equipment-memory-active="${memoryStatus.activeMemory?.id ?? 'none'}"
  ><small>装备记忆</small><strong>${memoryStatus.activeMemory?.name ?? '未激活'}</strong><b>${memoryStatus.unlockedMemories.length}/${EQUIPMENT_MEMORY_CATALOG.length}</b></span>`;
}

function getDungeonBaseRewardPoints(dungeon: NonNullable<ReturnType<typeof currentDungeon>>): number {
  return dungeon.nodes.reduce((total, node) => {
    const monsterReward = node.monsterId ? MONSTERS[node.monsterId].rewardPoints : 0;
    const nodeReward = node.reward?.rewardPoints ?? 0;
    return total + monsterReward + nodeReward;
  }, 0);
}

function formatCost(cost: Cost = {}): string {
  const parts: string[] = [];
  if (cost.rewardPoints) parts.push(`${cost.rewardPoints} 点`);
  if (cost.lingyun) parts.push(`${cost.lingyun} 灵蕴`);
  for (const [itemId, amount] of Object.entries(cost.items ?? {}) as Array<[ItemId, number]>) {
    parts.push(`${ITEMS[itemId].name} x${amount}`);
  }
  return parts.length ? parts.join(' / ') : '免费';
}

function getUiCompanionProgress(): CompanionProgress {
  return normalizeCompanionProgress({
    rulesVersion: COMPANION_RULES_VERSION,
    owned: state.ownedCompanions,
    ranks: state.companionRanks,
    active: state.activeCompanion
  });
}

function canAffordCost(cost: Readonly<Cost>): boolean {
  if ((cost.rewardPoints ?? 0) > state.rewardPoints || (cost.lingyun ?? 0) > state.lingyun) return false;
  return Object.entries(cost.items ?? {}).every(
    ([itemId, amount]) => state.inventory[itemId as ItemId] >= (amount ?? 0)
  );
}

function formatCompanionAssist(snapshot: CompanionRunSnapshot): string {
  const effect = getCompanionAssistEffect(snapshot);
  const parts: string[] = [];
  if (effect.guarding) parts.push('下一次敌方反击前进入守势');
  if (effect.focusGain) parts.push(`战意 +${effect.focusGain}`);
  if (effect.healPercent) parts.push(`回复 ${effect.healPercent}% 最大生命`);
  return parts.join(' / ') || '无直接效果';
}

function getUiMethodProgress(): MethodCultivationProgress {
  return normalizeMethodCultivationProgress(state.learnedMethods, {
    rulesVersion: METHOD_CULTIVATION_RULES_VERSION,
    ranks: state.methodRanks,
    activeMethod: state.activeMethod
  });
}

function getUiBloodlineProgress(): BloodlineProgress {
  return normalizeBloodlineProgress({
    rulesVersion: BLOODLINE_RULES_VERSION,
    ranks: state.bloodlineRanks,
    active: state.activeBloodline
  });
}

const bloodlineAspectLabels: Record<BloodlineAspect, string> = {
  force: '武力',
  art: '术法',
  guard: '守势',
  renewal: '归返'
};

const bloodlineStatLabels: Record<string, string> = {
  attack: '攻击',
  maxHp: '生命',
  spirit: '神识',
  artPower: '术强',
  defense: '防御',
  speed: '速度'
};

function formatBloodlineStats(snapshot: BloodlineRunSnapshot): string {
  const bonus = getBloodlineStatBonus(snapshot);
  if (!bonus) return '常驻属性不可用';
  return Object.entries(bonus)
    .map(([stat, amount]) => `${bloodlineStatLabels[stat] ?? stat} +${amount}`)
    .join(' / ');
}

function formatBloodlineSurge(snapshot: BloodlineRunSnapshot): string {
  const effect = getBloodlineSurgeEffect(snapshot);
  if (!effect) return '爆发不可用';
  const parts: string[] = [];
  if (effect.forceDamage) parts.push(`力伤 ${effect.forceDamage}`);
  if (effect.artDamage) parts.push(`术伤 ${effect.artDamage}`);
  if (effect.barrier) parts.push(`屏障 ${effect.barrier}`);
  if (effect.healPercent) parts.push(`回复 ${effect.healPercent}% 最大生命`);
  return parts.join(' / ') || '无直接效果';
}

function formatMethodTechnique(snapshot: MethodRunSnapshot): string {
  const definition = getMethodTechniqueDefinition(snapshot.methodId);
  const effect = getMethodTechniqueEffect(snapshot);
  if (!definition || !effect) return '战技不可用';
  const parts: string[] = [];
  if (effect.guarding) parts.push('进入守势');
  if (effect.clearsRustPoison) parts.push('清除锈毒');
  if (effect.clearsMirrorSlow) parts.push('清除镜慢');
  if (effect.focusGain) parts.push(`战意 +${effect.focusGain}`);
  if (effect.breathGain) parts.push(`呼吸 +${effect.breathGain}`);
  if (effect.healPercent) parts.push(`回复 ${effect.healPercent}% 最大生命`);
  return `${definition.name} · ${parts.join(' / ')}`;
}

function formatReward(reward: Cost = {}): string {
  const parts: string[] = [];
  if (reward.rewardPoints) parts.push(`奖励点 +${reward.rewardPoints}`);
  if (reward.lingyun) parts.push(`灵蕴 +${reward.lingyun}`);
  for (const [itemId, amount] of Object.entries(reward.items ?? {}) as Array<[ItemId, number]>) {
    parts.push(`${ITEMS[itemId].name} +${amount}`);
  }
  return parts.length ? parts.join(' / ') : '无奖励';
}

function formatRunLootItems(items: Readonly<Partial<Record<ItemId, number>>>): string {
  const entries = (Object.entries(items) as Array<[ItemId, number]>).filter(([, amount]) => amount > 0);
  return entries.length ? entries.map(([itemId, amount]) => `${ITEMS[itemId].name} x${amount}`).join(' / ') : '无';
}

function formatRunLootEquipment(equipmentIds: readonly EquipmentId[]): string {
  return equipmentIds.length ? equipmentIds.map((equipmentId) => EQUIPMENT[equipmentId].name).join(' / ') : '无';
}

function renderLootBag(): string {
  const bag = state.run?.lootBag ?? createEmptyRunLootBag<ItemId, EquipmentId>();

  return `<div
    class="loot-bag"
    data-loot-reward-points="${bag.rewardPoints}"
    data-loot-lingyun="${bag.lingyun}"
    data-loot-equipment-count="${bag.equipmentIds.length}"
  >
    <div class="loot-bag-heading">
      <div>
        <span class="eyebrow">未结算</span>
        <h3 class="feature-help-label">战利品袋${renderFeatureHelpTrigger('lootBag')}</h3>
      </div>
      <div class="loot-retention-tags" aria-label="战利品带回比例">
        <span>通关 100%</span>
        <span>撤退 50%</span>
        <span>濒死 20%点数</span>
      </div>
    </div>
    <div class="loot-bag-grid">
      <div class="loot-bag-stat"><span>奖励点</span><strong>${bag.rewardPoints}</strong></div>
      <div class="loot-bag-stat"><span>灵蕴</span><strong>${bag.lingyun}</strong></div>
      <div class="loot-bag-stat loot-bag-wide"><span>袋中物品</span><strong>${formatRunLootItems(bag.items)}</strong></div>
      <div class="loot-bag-stat loot-bag-wide"><span>待带回装备</span><strong>${formatRunLootEquipment(bag.equipmentIds)}</strong></div>
    </div>
  </div>`;
}

function renderSettlementGroup(
  label: string,
  tone: 'retained' | 'lost',
  bag: RunLootBag<ItemId, EquipmentId>
): string {
  return `<div
    class="settlement-group ${tone}"
    data-settlement-${tone}-points="${bag.rewardPoints}"
    data-settlement-${tone}-lingyun="${bag.lingyun}"
    data-settlement-${tone}-equipment-count="${bag.equipmentIds.length}"
  >
    <strong>${label}</strong>
    <div class="settlement-line"><span>奖励点</span><b>${bag.rewardPoints}</b></div>
    <div class="settlement-line"><span>灵蕴</span><b>${bag.lingyun}</b></div>
    <div class="settlement-line"><span>物品</span><b>${formatRunLootItems(bag.items)}</b></div>
    <div class="settlement-line"><span>装备</span><b>${formatRunLootEquipment(bag.equipmentIds)}</b></div>
  </div>`;
}

function renderLootSettlement(): string {
  const settlement = state.run?.lastLootSettlement;
  if (!settlement) return '';

  return `<div class="loot-settlement" aria-label="战利品袋结算">
    <div class="loot-settlement-heading">
      <span class="eyebrow">战利品袋结算</span>
      <strong>带回与遗失</strong>
    </div>
    <div class="loot-settlement-grid">
      ${renderSettlementGroup('已带回', 'retained', settlement.retained)}
      ${renderSettlementGroup('已遗失', 'lost', settlement.lost)}
    </div>
  </div>`;
}

function hasSpendableCost(cost: Cost = {}): boolean {
  return Boolean(cost.rewardPoints || cost.lingyun || Object.keys(cost.items ?? {}).length);
}

function formatBonus(bonus: Partial<DerivedStats>): string {
  const parts = Object.entries(bonus).map(([key, value]) => `${statLabels[key as keyof DerivedStats] ?? key} +${value}`);
  return parts.length ? parts.join(' / ') : '成长型';
}

function renderWeaponResonance(
  resonance: ReturnType<typeof getCurrentWeaponResonanceProgress>,
  placement: 'character' | 'equipment' | 'combat'
): string {
  const progress = `${resonance.attunedCount}/${resonance.requiredCount}`;
  const detail = resonance.active
    ? `${resonance.name} · ${resonance.effectDescription}`
    : resonance.effectDescription;

  return `<div
    class="weapon-resonance ${resonance.active ? 'active' : 'inactive'}"
    data-weapon-resonance="${placement}"
    data-resonance-progress="${progress}"
    data-resonance-active="${resonance.active}"
  >
    <span>当前武器共鸣 <strong>${progress}</strong></span>
    <small>${detail}</small>
  </div>`;
}

function renderEquipmentFieldRig(equipmentId: EquipmentId, placement: 'card' | 'loadout'): string {
  const label = getEquipmentFieldRigLabel(equipmentId);
  if (!label) return '';

  const description = getEquipmentFieldRigDescription(equipmentId);
  return `<div
    class="equipment-field-rig ${placement}"
    data-equipment-field-rig="${equipmentId}"
    data-field-rig-placement="${placement}"
  >
    <span>战术挂载</span>
    <strong>${label}</strong>
    ${placement === 'card' && description ? `<small>${description}</small>` : ''}
  </div>`;
}

function getRunRelicName(value: unknown): string | undefined {
  return isRunRelicId(value) ? RUN_RELIC_DEFINITIONS[value].name : undefined;
}

function getRunRelicFrameName(value: unknown): string | undefined {
  return isRunRelicFrame(value) ? RUN_RELIC_FRAME_DEFINITIONS[value].name : undefined;
}

function formatCurrentRunRelicEffects(): string {
  const effects = getCurrentRunRelicEffects(state);
  const statParts = (Object.entries(effects.statBonuses) as Array<[keyof typeof effects.statBonuses, number]>)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => `${statLabels[key] ?? key} +${value}`);
  const parts = [
    ...statParts,
    effects.combatStartFocusBonus > 0 ? `开战战意 +${effects.combatStartFocusBonus}` : undefined,
    effects.combatRewardPointsBonusPercent > 0 ? `战斗奖励 +${effects.combatRewardPointsBonusPercent}%` : undefined,
    effects.rewardNodeHealing > 0 ? `奖励节点治疗 ${effects.rewardNodeHealing}` : undefined,
    effects.trapDamageReductionPercent > 0 ? `陷阱减伤 ${effects.trapDamageReductionPercent}%` : undefined,
    effects.forcedPortalBacklashReductionPercent > 0
      ? `传送反噬减伤 ${effects.forcedPortalBacklashReductionPercent}%`
      : undefined,
    effects.rewardNodeRewardPointsBonusPercent > 0
      ? `奖励节点点数 +${effects.rewardNodeRewardPointsBonusPercent}%`
      : undefined
  ].filter((part): part is string => Boolean(part));

  return parts.length ? parts.join(' / ') : '尚未获得局内遗物效果';
}

function renderEquipmentRelicConduit(
  equipmentId: EquipmentId,
  placement: 'card' | 'loadout'
): string {
  const conduit = getEquipmentRelicConduitByEquipmentId(equipmentId);
  if (!conduit) return '';

  const level = state.equipmentLevels[equipmentId] ?? 1;
  const active =
    state.equipped[conduit.sourceSlot] === equipmentId &&
    level >= conduit.minimumLevel;
  const frameName = RUN_RELIC_FRAME_DEFINITIONS[conduit.frameId].name;

  return `<div
    class="equipment-relic-conduit ${placement} ${active ? 'active' : 'inactive'}"
    data-relic-conduit="${equipmentId}"
    data-relic-conduit-frame="${conduit.frameId}"
    data-relic-conduit-min-level="${conduit.minimumLevel}"
    data-relic-conduit-active="${active}"
  >
    <span>回响导管</span>
    <strong>${frameName}</strong>
    <small>Lv.${conduit.minimumLevel} 起效${placement === 'loadout' ? ` · 当前 Lv.${level} · ${active ? '已激活' : '未激活'}` : ''}</small>
  </div>`;
}

function getPreparedEquipmentSoulSkills(): EquipmentSoulSkillDefinition[] {
  return getActiveEquipmentSoulSkills(
    state.equipped,
    state.equipmentLevels,
    state.equipmentTemperRanks ?? {}
  );
}

function renderEquipmentSoulSkill(equipmentId: EquipmentId, placement: 'card' | 'loadout'): string {
  const definition = getEquipmentSoulSkillByEquipmentId(equipmentId);
  if (!definition) return '';

  const hypotheticalLoadout = { ...state.equipped, [definition.sourceSlot]: equipmentId };
  const unlocked =
    state.ownedEquipment.includes(equipmentId) &&
    getActiveEquipmentSoulSkills(
      hypotheticalLoadout,
      state.equipmentLevels,
      state.equipmentTemperRanks ?? {}
    ).some(({ id }) => id === definition.id);
  const freezesOnNextEntry = getPreparedEquipmentSoulSkills().some(({ id }) => id === definition.id);
  const level = state.equipmentLevels[equipmentId] ?? 1;
  const temperRank = state.equipmentTemperRanks?.[equipmentId] ?? 0;
  const stateText = freezesOnNextEntry
    ? '已解锁 · 下次入场冻结'
    : unlocked
      ? '已解锁 · 装备后下次入场冻结'
      : '未解锁';

  return `<div
    class="equipment-soul-skill ${placement} ${unlocked ? 'unlocked' : 'locked'} ${freezesOnNextEntry ? 'will-freeze' : ''}"
    data-equipment-soul-skill="${definition.id}"
    data-soul-skill-unlocked="${unlocked}"
    data-soul-skill-source-equipment="${equipmentId}"
    data-soul-skill-will-freeze="${freezesOnNextEntry}"
  >
    <div><span>器魂技</span><strong>${definition.name}</strong></div>
    <small>${definition.description}</small>
    <small class="soul-skill-requirement">解锁：装备 Lv.${definition.requiredLevel} + 淬炼 I · 当前 Lv.${level} / 淬炼 ${formatTemperRank(temperRank)}</small>
    <b>${stateText}</b>
  </div>`;
}

function formatSignedDelta(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function formatStatDelta(statDelta: Record<keyof DerivedStats, number>): string {
  const parts = (Object.entries(statDelta) as Array<[keyof DerivedStats, number]>)
    .filter(([, value]) => value !== 0)
    .map(([key, value]) => `${statLabels[key] ?? key} ${formatSignedDelta(value)}`);

  return parts.length ? parts.join(' / ') : '净属性持平';
}

function formatEquipmentEffectChanges(
  activated: readonly EquipmentSetTag[],
  deactivated: readonly EquipmentSetTag[],
  effectLabel: '2件套' | '3件精通'
): string {
  const changes = [
    ...activated.map((tag) => `激活${effectLabel} ${equipmentSetLabels[tag]}`),
    ...deactivated.map((tag) => `失效${effectLabel} ${equipmentSetLabels[tag]}`)
  ];

  return changes.length ? changes.join(' / ') : `${effectLabel}无变化`;
}

function formatWeaponSkillGrowth(definition: WeaponSkillDefinition, level: number, maxLevel: number): string {
  const growthLabels: Record<WeaponSkillDefinition['id'], string> = {
    armor_sunder: '升级继续降低防御影响',
    bone_pursuit: '升级提高追刺段数与伤害',
    ember_rekindle: '升级同步提高伤害与治疗',
    starforged_finale: '升级提高攻术伤害与觉醒增幅',
    chronal_reversal: '升级提高时差折返与攻术合击'
  };
  const levelText = level >= maxLevel ? `Lv.${level} 满级` : `Lv.${level} -> Lv.${level + 1}`;
  return `${levelText} · ${growthLabels[definition.id]}`;
}

function renderWeaponSkillSummary(equipmentId: EquipmentId): string {
  const definition = getWeaponSkillDefinition(equipmentId);
  if (!definition) return '';

  const equipment = EQUIPMENT[equipmentId];
  const level = state.equipmentLevels[equipmentId] ?? 1;
  return `<div
    class="weapon-skill-summary"
    data-weapon-skill-id="${definition.id}"
    data-weapon-skill-name="${definition.name}"
    data-weapon-skill-level="${level}"
  >
    <span>进阶战技 · 战意驱动</span>
    <strong>${definition.name}</strong>
    <small>${formatWeaponSkillGrowth(definition, level, equipment.maxLevel)} · 长战可反复充能发动</small>
  </div>`;
}

function renderEquipmentSwapPreview(equipmentId: EquipmentId, owned: boolean, actionNoteOverride?: string): string {
  const equipment = EQUIPMENT[equipmentId];
  const preview = getEquipmentSwapPreview(
    state.equipped,
    equipmentId,
    state.equipmentLevels,
    state.equipmentAttunements ?? {},
    state.equipmentTemperRanks ?? {}
  );
  const setCountText = getEquipmentSetTags(equipmentId)
    .map(
      (tag) =>
        `${equipmentSetLabels[tag]} ${preview.beforeSetCounts[tag]} -> ${preview.afterSetCounts[tag]}`
    )
    .join(' / ');
  const scoreDeltaClass = preview.scoreDelta > 0 ? 'positive' : preview.scoreDelta < 0 ? 'negative' : 'neutral';
  const scoreDeltaText = preview.scoreDelta === 0 ? '持平' : formatSignedDelta(preview.scoreDelta);
  const equipped = state.equipped[equipment.slot] === equipmentId;
  const actionNote = actionNoteOverride ??
    (equipped
      ? '当前已装备，以上预览保持不变。'
      : owned
        ? '点击“装备”后才应用以上变化。'
        : '兑换仅加入装备架，不会自动装备；点击“装备”后才应用以上变化。');

  return `<div
    class="equipment-swap-preview"
    data-swap-preview="${equipmentId}"
    data-replaced-equipment-id="${preview.replacedEquipmentId}"
    data-score-delta="${preview.scoreDelta}"
  >
    <div class="swap-route">
      <span>当前${slotLabels[equipment.slot]} -> 候选</span>
      <strong>${EQUIPMENT[preview.replacedEquipmentId].name} -> ${equipment.name}</strong>
    </div>
    <div class="swap-metrics">
      <span class="swap-score ${scoreDeltaClass}">评分 ${preview.beforeScore} -> ${preview.afterScore} / 净 ${scoreDeltaText}</span>
      <span>候选套装 ${setCountText || '基础件，无套装计数'}</span>
    </div>
    <div class="swap-stat-deltas">${formatStatDelta(preview.statDelta)}</div>
    <div class="swap-effect-changes">
      <span>${formatEquipmentEffectChanges(preview.activatedSets, preview.deactivatedSets, '2件套')}</span>
      <span>${formatEquipmentEffectChanges(preview.activatedMasteries, preview.deactivatedMasteries, '3件精通')}</span>
    </div>
    ${renderWeaponSkillSummary(equipmentId)}
    <small class="equipment-action-note">${actionNote}</small>
  </div>`;
}

function formatEquipmentSetTags(equipmentId: EquipmentId): string {
  const tags = getEquipmentSetTags(equipmentId);
  return tags.length ? tags.map((tag) => equipmentSetLabels[tag]).join(' / ') : '基础件';
}

function getCurrentEquipmentAttunementName(equipmentId: EquipmentId): string | undefined {
  const currentId = state.equipmentAttunements?.[equipmentId];
  return getEquipmentAttunementOptions(equipmentId).find((option) => option.id === currentId)?.name;
}

function getFieldSurveyLocation(nodeId: string): string {
  for (const dungeon of Object.values(DUNGEONS)) {
    const node = dungeon.nodes.find((candidate) => candidate.id === nodeId);
    if (node) return `${dungeon.name} · ${node.title}`;
  }
  return nodeId;
}

function formatFieldSurveyItemDelta(option: FieldSurveyOption): string | undefined {
  const items = Object.entries(option.itemDelta ?? {}) as Array<[ItemId, number]>;
  const itemText = items
    .filter(([, amount]) => amount !== 0)
    .map(([itemId, amount]) => `${ITEMS[itemId].name} ${amount > 0 ? '+' : ''}${amount}`);
  return itemText.length ? itemText.join(' / ') : undefined;
}

function formatFieldSurveyTradeoff(option: FieldSurveyOption): string {
  const parts = [`RP ${option.rewardPointsPercent}%`];
  const itemDelta = formatFieldSurveyItemDelta(option);
  if (itemDelta) parts.push(itemDelta);
  if (option.lingyunDelta) parts.push(`灵蕴 ${option.lingyunDelta > 0 ? '+' : ''}${option.lingyunDelta}`);
  if (option.hpPercent) parts.push(option.hpPercent > 0 ? `治疗 ${option.hpPercent}%` : `伤害 ${Math.abs(option.hpPercent)}%`);
  const cost = Object.entries(option.cost ?? {}) as Array<[ItemId, number]>;
  if (cost.length) parts.push(`成本 ${cost.map(([itemId, amount]) => `${ITEMS[itemId].name} x${amount}`).join(' / ')}`);
  return parts.join(' · ');
}

function renderAttunementFieldSurveys(equipmentId: EquipmentId, attunementId: EquipmentAttunementId): string {
  const options = FIELD_SURVEY_CATALOG.flatMap((survey) =>
    survey.options.filter((option) => option.attunementId === attunementId).map((option) => ({ survey, option }))
  );
  if (!options.length) return '<small class="field-survey-branch-empty">此铭刻暂无勘探节点。</small>';

  return `<div class="field-survey-branch-list" data-field-survey-state="prepared">
    ${options.map(({ survey, option }) => `<span
      data-field-survey-id="${survey.id}"
      data-field-survey-option="${option.id}"
      data-field-survey-attunement="${option.attunementId}"
      data-field-survey-source-equipment="${equipmentId}"
    ><strong>${getFieldSurveyLocation(survey.nodeId)}</strong><small>${option.name} · ${formatFieldSurveyTradeoff(option)}</small></span>`).join('')}
  </div>`;
}

function renderEquipmentAttunements(equipmentId: EquipmentId, actions: ViewAction[]): string {
  const equipment = EQUIPMENT[equipmentId];
  const options = getEquipmentAttunementOptions(equipmentId);
  if (!state.ownedEquipment.includes(equipmentId) || options.length === 0) return '';

  const level = state.equipmentLevels[equipmentId] ?? 1;
  const sealed = isEquipmentCommissionSealed(state, equipmentId);
  if (level < equipment.maxLevel) {
    return `<div class="attunement-locked" data-attunement-locked="${equipmentId}">
      <strong>装备铭刻</strong>
      <span>满级后解锁铭刻</span>
    </div>`;
  }

  const currentId = state.equipmentAttunements?.[equipmentId];
  const affordable = canPay(EQUIPMENT_ATTUNEMENT_COST);
  const branches = options
    .map((option) => {
      const selected = option.id === currentId;
      const action: ViewAction = {
        id: `attune-${equipmentId}-${option.id}`,
        label: sealed ? '封存中' : selected ? '当前铭刻' : '铭刻',
        hint: sealed ? '委托期间不可铭刻' : selected ? '已生效' : affordable ? formatCost(EQUIPMENT_ATTUNEMENT_COST) : '资源不足',
        disabled: sealed || selected || !affordable,
        onSelect: () => {
          state = attuneEquipment(state, equipmentId, option.id);
        }
      };
      actions.push(action);

      return `<div class="attunement-branch ${selected ? 'selected' : ''} ${sealed ? 'is-equipment-sealed' : ''}" data-attunement-id="${option.id}">
        <div class="attunement-copy">
          <div class="attunement-title">
            <strong>${option.name}</strong>
            <span>${formatBonus(option.bonus)}</span>
          </div>
          <small>${option.description}</small>
          ${renderAttunementFieldSurveys(equipmentId, option.id)}
        </div>
        ${actionButton(action, selected ? 'button secondary attunement-button' : 'button attunement-button')}
      </div>`;
    })
    .join('');

  return `<div class="equipment-attunements" data-equipment-attunements="${equipmentId}">
    <div class="attunement-heading">
      <div>
        <strong>装备铭刻</strong>
        <small>改选分支仍按统一成本支付</small>
      </div>
      <span class="${sealed ? 'equipment-sealed-label' : ''}">${sealed ? '封存中' : formatCost(EQUIPMENT_ATTUNEMENT_COST)}</span>
    </div>
    ${branches}
  </div>`;
}

function formatTemperRank(rank: number): string {
  return rank === 2 ? 'II' : rank === 1 ? 'I' : '未淬炼';
}

function formatTemperCost(cost: NonNullable<ReturnType<typeof getEquipmentTemperStatus>['nextCost']>): string {
  const parts = [`${cost.rewardPoints} 奖励点`];
  if (cost.lingyun) parts.push(`${cost.lingyun} 灵蕴`);
  for (const [itemId, amount] of Object.entries(cost.items) as Array<[ItemId, number]>) {
    parts.push(`${ITEMS[itemId].name} x${amount}`);
  }
  return parts.join(' / ');
}

function getTemperMissingResources(cost: NonNullable<ReturnType<typeof getEquipmentTemperStatus>['nextCost']>): string[] {
  const missing: string[] = [];
  if (state.rewardPoints < cost.rewardPoints) missing.push(`奖励点缺 ${cost.rewardPoints - state.rewardPoints}`);
  if (state.lingyun < (cost.lingyun ?? 0)) missing.push(`灵蕴缺 ${(cost.lingyun ?? 0) - state.lingyun}`);
  for (const [itemId, amount] of Object.entries(cost.items) as Array<[ItemId, number]>) {
    const owned = state.inventory[itemId] ?? 0;
    if (owned < amount) missing.push(`${ITEMS[itemId].name}缺 ${amount - owned}`);
  }
  return missing;
}

function getTemperActionStatus(
  equipmentId: EquipmentId,
  progress: ReturnType<typeof getEquipmentTemperStatus>
): { disabled: boolean; hint: string } {
  const equipment = EQUIPMENT[equipmentId];
  if (state.phase !== 'hub') return { disabled: true, hint: '仅可在主神空间锻造' };
  if (isEquipmentCommissionSealed(state, equipmentId)) return { disabled: true, hint: '封存中，委托期间不可淬炼' };
  if (!state.ownedEquipment.includes(equipmentId)) return { disabled: true, hint: '先兑换入装备架' };

  const level = state.equipmentLevels[equipmentId] ?? 1;
  if (level !== equipment.maxLevel) return { disabled: true, hint: `需先强化至 +${equipment.maxLevel - 1}` };
  if (!progress.nextRank || !progress.nextCost) return { disabled: true, hint: '已达 II 阶上限' };
  if (
    progress.nextRank === 2 &&
    !getEquipmentAttunementOptions(equipmentId).some(
      (option) => option.id === state.equipmentAttunements?.[equipmentId]
    )
  ) {
    return { disabled: true, hint: 'II 阶需先为本装备生效铭刻' };
  }

  const missing = getTemperMissingResources(progress.nextCost);
  if (missing.length) return { disabled: true, hint: `资源不足：${missing.join(' / ')}` };
  return { disabled: false, hint: formatTemperCost(progress.nextCost) };
}

function renderEquipmentTemper(equipmentId: EquipmentId, actions: ViewAction[]): string {
  const progress = getEquipmentTemperStatus(state, equipmentId);
  const sealed = isEquipmentCommissionSealed(state, equipmentId);
  const rankLabel = formatTemperRank(progress.currentRank);
  const nextRankLabel = progress.nextRank ? formatTemperRank(progress.nextRank) : '已满';

  if (!progress.eligible) {
    return `<div
      class="equipment-temper temper-ineligible"
      data-equipment-temper="${equipmentId}"
      data-temper-rank="0"
      data-temper-next-rank=""
      data-temper-eligible="false"
    >
      <div class="temper-heading"><strong>首领锻造</strong><span>不适用</span></div>
      <small>基础装备不可淬炼。</small>
    </div>`;
  }

  const actionStatus = getTemperActionStatus(equipmentId, progress);
  const materialId = progress.materialId;
  const materialOwned = materialId ? state.inventory[materialId] ?? 0 : 0;
  const nextBonus = progress.nextRank ? progress.rankBonuses[progress.nextRank] : {};
  const action: ViewAction = {
    id: `temper-${equipmentId}`,
    label: sealed ? '封存中' : progress.nextRank ? `淬炼至 ${nextRankLabel}` : '淬炼已满',
    hint: actionStatus.hint,
    disabled: actionStatus.disabled,
    onSelect: () => {
      state = temperEquipment(state, equipmentId);
    }
  };
  actions.push(action);

  return `<div
    class="equipment-temper rank-${progress.currentRank} ${sealed ? 'is-equipment-sealed' : ''}"
    data-equipment-temper="${equipmentId}"
    data-temper-rank="${progress.currentRank}"
    data-temper-next-rank="${progress.nextRank ?? ''}"
    data-temper-eligible="true"
  >
    <div class="temper-heading">
      <div><strong>首领锻造</strong><small>${progress.currentRank}/2 · ${rankLabel}</small></div>
      <span>${materialId ? `${ITEMS[materialId].name} · 持有 x${materialOwned}` : '无材料'}</span>
    </div>
    <div class="temper-bonuses">
      <span><small>累计</small><strong>${formatBonus(progress.cumulativeBonus)}</strong></span>
      <span><small>下阶 ${nextRankLabel}</small><strong>${progress.nextRank ? formatBonus(nextBonus) : '已达上限'}</strong></span>
    </div>
    <div class="temper-footer">
      <small>${progress.nextCost ? `精确消耗：${formatTemperCost(progress.nextCost)}` : 'II 阶已满，无后续消耗'}</small>
      ${actionButton(action, 'button temper-button')}
    </div>
  </div>`;
}

function formatPetPassives(petId: PetId): string {
  return getPetPassiveTags(PETS[petId]).map((tag) => petPassiveLabels[tag]).join(' / ');
}

function formatEquipmentList(equipmentIds: EquipmentId[]): string {
  return equipmentIds.length ? equipmentIds.map((equipmentId) => EQUIPMENT[equipmentId].name).join(' / ') : '暂不购买';
}

function formatMethodList(methodIds: MethodId[]): string {
  return methodIds.length ? methodIds.map((methodId) => METHODS[methodId].name).join(' / ') : '暂不学习';
}

function formatPetList(ids: PetId[]): string {
  return ids.length ? ids.map((petId) => PETS[petId].name).join(' / ') : '暂不培养';
}

function formatEquipmentUpgradeList(equipmentIds: EquipmentId[]): string {
  return equipmentIds.length ? equipmentIds.map((equipmentId) => EQUIPMENT[equipmentId].name).join(' / ') : '暂不升级';
}

function formatDungeonNames(dungeonIds: DungeonId[]): string {
  return dungeonIds.map((dungeonId) => DUNGEONS[dungeonId].name).join('、');
}

function formatReadinessChanges(advice: ShopAdvice): string {
  return advice.readinessChanges
    .map(
      (change) =>
        `${DUNGEONS[change.dungeonId].name} ${readinessMeta[change.before].label} -> ${readinessMeta[change.after].label}`
    )
    .join(' / ');
}

function getReadinessChangesBetween(before: GameState, after: GameState): ShopAdvice['readinessChanges'] {
  return DUNGEON_ORDER.map((dungeonId) => ({
    dungeonId,
    before: getDungeonReadiness(before, dungeonId),
    after: getDungeonReadiness(after, dungeonId)
  })).filter((change) => change.before !== change.after);
}

function formatReadinessChangeList(changes: ShopAdvice['readinessChanges']): string {
  return changes
    .map((change) => `${DUNGEONS[change.dungeonId].name} ${readinessMeta[change.before].label} -> ${readinessMeta[change.after].label}`)
    .join(' / ');
}

function renderShopAdvice(advice: ShopAdvice, routeLabel = '建议'): string {
  const rows: string[] = [];

  if (advice.powerDelta > 0) rows.push(`<strong>战力 +${advice.powerDelta}</strong>`);
  if (advice.recommendedForDungeonIds.length) rows.push(`<span>推荐用于：${formatDungeonNames(advice.recommendedForDungeonIds)}</span>`);

  const readinessText = formatReadinessChanges(advice);
  if (readinessText) rows.push(`<span>门槛变化：${readinessText}</span>`);

  // Capture pets and capture tools can be valuable even when they do not raise raw power.
  rows.push(`<span>${routeLabel}：${advice.reasonText}</span>`);
  rows.push(`<span>${advice.affordabilityText}</span>`);

  return `<div class="shop-advice">${rows.join('')}</div>`;
}

function nextRecommendedDungeonId(): DungeonId {
  const gates = getCampaignGates(state);
  return (
    gates.find((gate) => gate.isNextRecommended)?.dungeonId ??
    gates.find((gate) => gate.status === 'available')?.dungeonId ??
    DUNGEON_ORDER[0]
  );
}

function recommendationImpact(advice: ShopAdvice, nextDungeonId: DungeonId): string {
  const nextChange = advice.readinessChanges.find((change) => change.dungeonId === nextDungeonId);
  if (nextChange) {
    return `${DUNGEONS[nextDungeonId].name} ${readinessMeta[nextChange.before].label} -> ${readinessMeta[nextChange.after].label}`;
  }

  const readinessText = formatReadinessChanges(advice);
  if (readinessText) return readinessText;
  if (advice.powerDelta > 0) return `战力 +${advice.powerDelta}，推进 ${DUNGEONS[nextDungeonId].name} 更稳。`;
  if (advice.recommendedForDungeonIds.includes(nextDungeonId)) return `命中下一推荐副本：${DUNGEONS[nextDungeonId].name}。`;
  return `补齐 ${DUNGEONS[nextDungeonId].name} 前的工具或成长短板。`;
}

function scoreAdvice(advice: ShopAdvice, nextDungeonId: DungeonId, affordable: boolean, priority = 0): number {
  const nextReadinessChange = advice.readinessChanges.some((change) => change.dungeonId === nextDungeonId);
  const recommendedForNext = advice.recommendedForDungeonIds.includes(nextDungeonId);
  return (
    priority +
    (affordable ? 120 : 0) +
    (nextReadinessChange ? 90 : 0) +
    (recommendedForNext ? 55 : 0) +
    advice.readinessChanges.length * 20 +
    advice.powerDelta * 2
  );
}

function buildShopRecommendations(actions?: ViewAction[]): ShopRecommendation[] {
  const nextDungeonId = nextRecommendedDungeonId();
  const recommendations: ShopRecommendation[] = [];

  const addRecommendation = (recommendation: ShopRecommendation) => {
    if (recommendation.action && actions) actions.push(recommendation.action);
    recommendations.push(recommendation);
  };

  for (const itemId of shopItems) {
    const item = ITEMS[itemId];
    const advice = getShopAdvice(state, 'item', itemId);
    const affordable = Boolean(item.cost) && canPay(item.cost);
    const action: ViewAction = {
      id: `top-buy-item-${itemId}`,
      label: '兑换',
      hint: item.cost ? formatCost(item.cost) : '副本掉落',
      disabled: !affordable,
      onSelect: () => {
        state = buyItem(state, itemId);
      }
    };
    addRecommendation({
      id: `item-${itemId}`,
      title: `兑换 ${item.name}`,
      target: `${DUNGEONS[nextDungeonId].name} / 关键道具`,
      reason: advice.reasonText,
      impact: recommendationImpact(advice, nextDungeonId),
      affordability: advice.affordabilityText,
      affordable,
      score: scoreAdvice(advice, nextDungeonId, affordable, itemId === 'capture_net' || itemId === 'dispel_talisman' ? 18 : 0),
      action
    });
  }

  for (const equipmentId of equipmentShop) {
    const equipment = EQUIPMENT[equipmentId];
    const owned = state.ownedEquipment.includes(equipmentId);
    const baseAdvice = getShopAdvice(state, 'equipment', equipmentId);
    if (!owned) {
      const recipe = getPreferredEquipmentRecipe(equipmentId);
      if (!recipe) continue;
      const purchaseStatus = getEquipmentRecipePurchaseStatus(state, recipe.dungeonId, equipmentId);
      if (!purchaseStatus) continue;
      const affordable = purchaseStatus.affordable;
      const advice: ShopAdvice = {
        ...baseAdvice,
        reasonText: `${equipment.description} ${DUNGEONS[recipe.dungeonId].name}目录已解锁。`,
        affordabilityText: affordable
          ? `${ITEMS[recipe.materialId].name}充足，可以立即兑换。`
          : `需要${ITEMS[recipe.materialId].name} x${recipe.materialAmount}，可复刷${DUNGEONS[recipe.dungeonId].name}获取。`
      };
      const action: ViewAction = {
        id: `top-buy-equipment-${equipmentId}`,
        label: '兑换入架',
        hint: formatCost(purchaseStatus.cost),
        disabled: !affordable,
        onSelect: () => {
          state = buyEquipment(state, equipmentId, recipe.dungeonId);
        }
      };
      addRecommendation({
        id: `equipment-${equipmentId}`,
        title: `兑换 ${equipment.name}`,
        target: `${DUNGEONS[nextDungeonId].name} / ${slotLabels[equipment.slot]}`,
        reason: advice.reasonText,
        impact: recommendationImpact(advice, nextDungeonId),
        affordability: advice.affordabilityText,
        affordable,
        score: scoreAdvice(advice, nextDungeonId, affordable, 12),
        action
      });
      continue;
    }

    const level = state.equipmentLevels[equipmentId] ?? 1;
    const sealed = isEquipmentCommissionSealed(state, equipmentId);
    const upgraded = sealed ? state : upgradeEquipment(state, equipmentId);
    const nextLevel = upgraded.equipmentLevels[equipmentId] ?? level;
    const affordable = !sealed && nextLevel > level;
    const changes = affordable ? getReadinessChangesBetween(state, upgraded) : [];
    const powerDelta = affordable ? Math.max(0, getPlayerPower(upgraded) - getPlayerPower(state)) : 0;
    const action: ViewAction = {
      id: `top-upgrade-equipment-${equipmentId}`,
      label: sealed ? '封存中' : level >= equipment.maxLevel ? '满级' : '升级',
      hint: sealed ? '委托期间不可升级' : `当前 +${level - 1}`,
      disabled: !affordable,
      onSelect: () => {
        state = upgradeEquipment(state, equipmentId);
      }
    };
    if (level < equipment.maxLevel) {
      addRecommendation({
        id: `equipment-upgrade-${equipmentId}`,
        title: sealed ? `${equipment.name} 封存中` : `升级 ${equipment.name}`,
        target: `${DUNGEONS[nextDungeonId].name} / 装备培养`,
        reason: `${equipment.name}已经在装备架中，升级会放大当前配装收益。`,
        impact: changes.length ? formatReadinessChangeList(changes) : powerDelta > 0 ? `战力 +${powerDelta}。` : `保持当前 readiness，等待更多资源。`,
        affordability: sealed
          ? '装备正在执行封存委托。'
          : affordable
            ? `资源足够，可升到 +${nextLevel - 1}。`
            : `资源不足，暂时无法升级${equipment.name}。`,
        affordable,
        score: (affordable ? 115 : 0) + changes.length * 25 + powerDelta * 2 + 8,
        action
      });
    }
  }

  for (const methodId of methodShop) {
    if (state.learnedMethods.includes(methodId)) continue;
    const method = METHODS[methodId];
    const advice = getShopAdvice(state, 'method', methodId);
    const affordable = canPay(method.cost);
    const action: ViewAction = {
      id: `top-learn-${methodId}`,
      label: '学习',
      hint: formatCost(method.cost),
      disabled: !affordable,
      onSelect: () => {
        state = learnMethod(state, methodId);
      }
    };
    addRecommendation({
      id: `method-${methodId}`,
      title: `学习 ${method.name}`,
      target: `${DUNGEONS[nextDungeonId].name} / 功法`,
      reason: advice.reasonText,
      impact: recommendationImpact(advice, nextDungeonId),
      affordability: advice.affordabilityText,
      affordable,
      score: scoreAdvice(advice, nextDungeonId, affordable, 10),
      action
    });
  }

  for (const petId of petIds) {
    const pet = PETS[petId];
    const owned = state.ownedPets.includes(petId);
    const advice = getShopAdvice(state, 'pet', petId);
    if (!owned && pet.source === 'shop' && pet.cost) {
      const affordable = canPay(pet.cost);
      const action: ViewAction = {
        id: `top-buy-pet-${petId}`,
        label: '签约',
        hint: formatCost(pet.cost),
        disabled: !affordable,
        onSelect: () => {
          state = buyPet(state, petId);
        }
      };
      addRecommendation({
        id: `pet-${petId}`,
        title: `签约 ${pet.name}`,
        target: `${DUNGEONS[nextDungeonId].name} / 灵宠`,
        reason: advice.reasonText,
        impact: recommendationImpact(advice, nextDungeonId),
        affordability: advice.affordabilityText,
        affordable,
        score: scoreAdvice(advice, nextDungeonId, affordable, 14),
        action
      });
    } else if (!owned && pet.source === 'capture') {
      const captureItem = pet.captureItem ?? 'capture_net';
      addRecommendation({
        id: `pet-capture-${petId}`,
        title: `准备捕获 ${pet.name}`,
        target: `${DUNGEONS[nextDungeonId].name} / 捕获路线`,
        reason: advice.reasonText,
        impact: recommendationImpact(advice, nextDungeonId),
        affordability: state.inventory[captureItem] > 0 ? `背包已有${ITEMS[captureItem].name}，可进副本寻找目标。` : `缺少${ITEMS[captureItem].name}，先兑换捕获道具。`,
        affordable: state.inventory[captureItem] > 0,
        score: scoreAdvice(advice, nextDungeonId, state.inventory[captureItem] > 0, 6)
      });
    } else if (owned) {
      const upgradePet = optionalGameApi.upgradePet;
      const level = state.petLevels[petId] ?? 1;
      if (!upgradePet || level >= pet.maxLevel) continue;
      const upgraded = upgradePet(state, petId);
      const nextLevel = upgraded.petLevels[petId] ?? level;
      const affordable = nextLevel > level;
      const changes = affordable ? getReadinessChangesBetween(state, upgraded) : [];
      const powerDelta = affordable ? Math.max(0, getPlayerPower(upgraded) - getPlayerPower(state)) : 0;
      const action: ViewAction = {
        id: `top-upgrade-pet-${petId}`,
        label: '培养',
        hint: `Lv.${level}`,
        disabled: !affordable,
        onSelect: () => {
          state = upgradePet(state, petId);
        }
      };
      addRecommendation({
        id: `pet-upgrade-${petId}`,
        title: `培养 ${pet.name}`,
        target: `${DUNGEONS[nextDungeonId].name} / 灵宠培养`,
        reason: `${pet.name}已入队，培养能提高常驻属性和出战稳定性。`,
        impact: changes.length ? formatReadinessChangeList(changes) : powerDelta > 0 ? `战力 +${powerDelta}。` : `保持当前 readiness，等待更多资源。`,
        affordability: affordable ? `资源足够，可培养到 Lv.${nextLevel}。` : `资源不足，暂时无法培养${pet.name}。`,
        affordable,
        score: (affordable ? 112 : 0) + changes.length * 25 + powerDelta * 2 + 9,
        action
      });
    }
  }

  return recommendations
    .sort((left, right) => right.score - left.score || Number(right.affordable) - Number(left.affordable))
    .filter((recommendation, index, list) => list.findIndex((candidate) => candidate.id === recommendation.id) === index);
}

function renderRecommendationRow(recommendation: ShopRecommendation, index: number, showButton: boolean): string {
  return `<article class="recommendation-row ${recommendation.affordable ? 'is-affordable' : 'is-locked'}">
    <div class="recommendation-rank">Top ${index + 1}</div>
    <div class="recommendation-copy">
      <div class="card-topline">
        <span>${recommendation.target}</span>
        <small>${recommendation.affordable ? '现在可执行' : '资源不足'}</small>
      </div>
      <h3>${recommendation.title}</h3>
      <p>${recommendation.reason}</p>
      <small class="mechanic-line">影响：${recommendation.impact}</small>
      <small class="mechanic-line">支付状态：${recommendation.affordability}</small>
    </div>
    ${showButton && recommendation.action ? actionButton(recommendation.action, recommendation.affordable ? 'button' : 'button ghost') : ''}
  </article>`;
}

function renderTopRecommendations(actions: ViewAction[]): string {
  const recommendations = buildShopRecommendations(actions).slice(0, 3);
  if (!recommendations.length) return '';
  const nextDungeonId = nextRecommendedDungeonId();

  return `<section class="panel wide-panel top-recommendations">
    <div class="panel-title">
      <span class="eyebrow">主神推荐补强</span>
      <h2>现在最该做的 Top 3</h2>
    </div>
    <p class="lead-copy">下一推荐副本：${DUNGEONS[nextDungeonId].name}。主神按战力、readiness 和商店建议排序。</p>
    <div class="recommendation-list">${recommendations.map((recommendation, index) => renderRecommendationRow(recommendation, index, true)).join('')}</div>
  </section>`;
}

function renderNextActionPanel(actions: ViewAction[]): string {
  const recommendations = buildShopRecommendations(actions).slice(0, 3);
  const nextDungeonId = nextRecommendedDungeonId();
  const rows = recommendations.length
    ? recommendations.map((recommendation, index) => renderRecommendationRow(recommendation, index, true)).join('')
    : `<article class="recommendation-row is-affordable">
        <div class="recommendation-rank">Next</div>
        <div class="recommendation-copy">
          <div class="card-topline"><span>${DUNGEONS[nextDungeonId].name}</span><small>继续推进</small></div>
          <h3>进入下一推荐副本</h3>
          <p>当前没有更高收益的商店动作，先推进章节获取下一轮材料。</p>
          <small class="mechanic-line">影响：打开后续兑换和成长路线。</small>
          <small class="mechanic-line">支付状态：无需消耗资源。</small>
        </div>
      </article>`;

  return `<section class="next-action-panel">
    <div class="panel-title">
      <span class="eyebrow">下一步行动</span>
      <h2>把本轮收益转成推进</h2>
    </div>
    <div class="recommendation-list">${rows}</div>
  </section>`;
}

function formatRequirement(requirement: DungeonEventRequirement): string {
  if (requirement.type === 'method') return `功法：${METHODS[requirement.methodId].name}`;
  if (requirement.type === 'equipment') return `装备：${EQUIPMENT[requirement.equipmentId].name}`;
  if (requirement.type === 'pet') return `灵宠：${PETS[requirement.petId].name}`;
  if (requirement.type === 'item') return `${ITEMS[requirement.itemId].name} x${requirement.count}`;
  if (requirement.type === 'stat') return `${statLabels[requirement.stat] ?? requirement.stat} >= ${requirement.min}`;
  if (requirement.type === 'equipmentSet') return `套装：${equipmentSetLabels[requirement.setTag]}`;
  if (requirement.type === 'petPassive') return `灵宠词条：${petPassiveLabels[requirement.passiveTag]}`;
  return requirement.description;
}

function formatEventOutcome(outcome: DungeonEventOutcome): string {
  const parts: string[] = [];
  if (outcome.rewardPoints) parts.push(`奖励点 +${outcome.rewardPoints}`);
  if (outcome.lingyun) parts.push(`灵蕴 +${outcome.lingyun}`);
  for (const [itemId, amount] of Object.entries(outcome.items ?? {}) as Array<[ItemId, number]>) {
    parts.push(`${ITEMS[itemId].name} +${amount}`);
  }
  if (outcome.damage) parts.push(`承伤 ${outcome.damage}`);
  return parts.length ? parts.join(' / ') : outcome.success ? '安全通过' : '无收益';
}

function canPay(cost: Cost = {}): boolean {
  const hasPoints = state.rewardPoints >= (cost.rewardPoints ?? 0);
  const hasLingyun = state.lingyun >= (cost.lingyun ?? 0);
  const hasItems = (Object.entries(cost.items ?? {}) as Array<[ItemId, number]>).every(
    ([itemId, amount]) => state.inventory[itemId] >= amount
  );
  return hasPoints && hasLingyun && hasItems;
}

function runEconomy(exitStatus: RunExitStatus, includeCurrentNode = false): ReturnType<typeof calculateRunEconomy> | undefined {
  const dungeon = currentDungeon();
  if (!dungeon || !state.run) return undefined;

  const clearedNodeIds = new Set(state.run.clearedNodeIds);
  const node = currentNode();
  if (includeCurrentNode && node) clearedNodeIds.add(node.id);

  return calculateRunEconomy({
    baseRewardPoints: getDungeonBaseRewardPoints(dungeon),
    clearedNodes: clearedNodeIds.size,
    totalNodes: dungeon.nodes.length,
    damageTaken: Math.max(0, getDerivedStats(state).maxHp - state.player.hp),
    captures: state.run?.captures ?? 0,
    readiness: getDungeonReadiness(state, dungeon.id),
    dungeonTier: dungeon.tier,
    exitStatus
  });
}

function renderScoreStrip(label: string, economy: ReturnType<typeof calculateRunEconomy> | undefined): string {
  if (!economy) return '';

  return `<div class="score-strip">
    <span>${label}</span>
    <strong>${economy.score}</strong>
    <small>${outcomeLabels[economy.outcome]} / x${economy.rewardMultiplier} / 估算 ${economy.rewardPoints} 点</small>
  </div>`;
}

function getPendingCausalLedgerStatus(): CausalLedgerStatus | undefined {
  const status = getCurrentCausalLedgerStatus(state);
  return status?.pending ? status : undefined;
}

function getEntropyHeadingStatus(): EntropyHeadingStatus | undefined {
  return optionalGameApi.getCurrentEntropyHeadingStatus?.(state);
}

function getMirrorPhaseStatus() {
  return getCurrentMirrorCityPhaseStatus(state);
}

function getRedactionClauseStatus(): RedactionClauseStatus | undefined {
  return getCurrentRedactionClauseStatus(state);
}

function getAuctionLotStatus(): AuctionLotStatus | undefined {
  return getCurrentAuctionLotStatus(state);
}

function isAnyModalOpen(): boolean {
  return Boolean(getPendingCausalLedgerStatus()) || isCharacterPanelOpen || isTaskPanelOpen || isCompanionPanelOpen || isMethodPanelOpen || isBloodlinePanelOpen || isEquipmentCommissionModalOpen || Boolean(protocolSelection) || Boolean(state.phase === 'hub' && hubPanel);
}

function getModalFocusTarget(
  wasCharacterPanelOpen: boolean,
  wasTaskPanelOpen: boolean,
  wasCompanionPanelOpen: boolean,
  wasMethodPanelOpen: boolean,
  wasBloodlinePanelOpen: boolean,
  wasEquipmentCommissionModalOpen: boolean,
  previousProtocolSelection?: ProtocolSelection
): RenderFocusTarget | undefined {
  if (getPendingCausalLedgerStatus()) return 'causal-ledger-dialog';
  if (!wasEquipmentCommissionModalOpen && isEquipmentCommissionModalOpen) return 'equipment-commission-dialog';
  if (!wasCharacterPanelOpen && isCharacterPanelOpen) return 'character-dialog';
  if (!wasTaskPanelOpen && isTaskPanelOpen) return 'task-dialog';
  if (!wasCompanionPanelOpen && isCompanionPanelOpen) return 'companion-dialog';
  if (!wasMethodPanelOpen && isMethodPanelOpen) return 'method-dialog';
  if (!wasBloodlinePanelOpen && isBloodlinePanelOpen) return 'bloodline-dialog';
  if (!previousProtocolSelection && protocolSelection) return 'protocol-dialog';
  if (previousProtocolSelection && protocolSelection && previousProtocolSelection.protocolId !== protocolSelection.protocolId) {
    return 'protocol-mode';
  }
  if (wasCharacterPanelOpen && !isCharacterPanelOpen) return 'character-trigger';
  if (wasTaskPanelOpen && !isTaskPanelOpen) return 'task-trigger';
  if (wasCompanionPanelOpen && !isCompanionPanelOpen) return 'companion-trigger';
  if (wasMethodPanelOpen && !isMethodPanelOpen) return 'method-trigger';
  if (wasBloodlinePanelOpen && !isBloodlinePanelOpen) return 'bloodline-trigger';
  if (wasEquipmentCommissionModalOpen && !isEquipmentCommissionModalOpen) return 'equipment-commission-trigger';
  if (previousProtocolSelection && !protocolSelection) return 'protocol-trigger';
  return undefined;
}

function focusCausalLedgerDialog(): void {
  const dialog = root.querySelector<HTMLElement>('.causal-ledger-sheet[role="dialog"][aria-modal="true"]');
  const firstChoice = dialog?.querySelector<HTMLButtonElement>('[data-causal-ledger-choice]:not(:disabled)');
  (firstChoice ?? dialog)?.focus();
}

function focusEntropyHeadingChoice(): void {
  root.querySelector<HTMLButtonElement>('button[data-entropy-heading-choice]:not(:disabled)')?.focus();
}

function focusEntropyHeadingMove(): void {
  const target = root.querySelector<HTMLButtonElement>('.grid-node.movable.gate-open:not(:disabled)') ??
    root.querySelector<HTMLButtonElement>('.grid-node.movable:not(:disabled)');
  (target ?? root.querySelector<HTMLElement>('.node-action-panel'))?.focus();
}

function focusMirrorPhaseChoice(): void {
  root.querySelector<HTMLButtonElement>('button[data-mirror-phase-choice]:not(:disabled)')?.focus();
}

function focusMirrorPhaseMove(): void {
  const target = root.querySelector<HTMLButtonElement>('.grid-node.movable.gate-open:not(:disabled)') ??
    root.querySelector<HTMLButtonElement>('.grid-node.movable:not(:disabled)');
  (target ?? root.querySelector<HTMLElement>('.node-action-panel'))?.focus();
}

function focusRedactionClauseChoice(): void {
  root.querySelector<HTMLButtonElement>('button.redaction-clause-choice[data-redaction-clause-choice]:not(:disabled)')?.focus();
}

function focusRedactionClauseMove(): void {
  const target = root.querySelector<HTMLButtonElement>('.grid-node.movable.gate-open:not(:disabled)') ??
    root.querySelector<HTMLButtonElement>('.grid-node.movable:not(:disabled)');
  (target ?? root.querySelector<HTMLElement>('.node-action-panel'))?.focus();
}

function focusAuctionLotChoice(): void {
  root.querySelector<HTMLButtonElement>('button.auction-lot-choice[data-auction-lot-choice]:not(:disabled)')?.focus();
}

function focusAuctionLotMove(): void {
  const target = root.querySelector<HTMLButtonElement>('.grid-node.movable.gate-open:not(:disabled)') ??
    root.querySelector<HTMLButtonElement>('.grid-node.movable:not(:disabled)');
  (target ?? root.querySelector<HTMLElement>('.node-action-panel'))?.focus();
}

function focusCharacterDialog(): void {
  const closeButton = root.querySelector<HTMLButtonElement>('.character-close');
  const dialog = root.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]');
  (closeButton ?? dialog)?.focus();
}

function focusCharacterTrigger(): void {
  root.querySelector<HTMLButtonElement>('.character-trigger')?.focus();
}

function focusTaskDialog(): void {
  const closeButton = root.querySelector<HTMLButtonElement>('.task-close');
  const dialog = root.querySelector<HTMLElement>('.task-sheet[role="dialog"][aria-modal="true"]');
  (closeButton ?? dialog)?.focus();
}

function focusTaskTrigger(): void {
  root.querySelector<HTMLButtonElement>('.task-trigger')?.focus();
}

function focusCompanionDialog(): void {
  const closeButton = root.querySelector<HTMLButtonElement>('.companion-close');
  const dialog = root.querySelector<HTMLElement>('.companion-sheet[role="dialog"][aria-modal="true"]');
  (closeButton ?? dialog)?.focus();
}

function focusCompanionTrigger(): void {
  root.querySelector<HTMLButtonElement>('.companion-trigger')?.focus();
}

function focusMethodDialog(): void {
  const closeButton = root.querySelector<HTMLButtonElement>('.method-close');
  const dialog = root.querySelector<HTMLElement>('.method-sheet[role="dialog"][aria-modal="true"]');
  (closeButton ?? dialog)?.focus();
}

function focusMethodTrigger(): void {
  root.querySelector<HTMLButtonElement>('.method-trigger')?.focus();
}

function focusBloodlineDialog(): void {
  const closeButton = root.querySelector<HTMLButtonElement>('.bloodline-close');
  const dialog = root.querySelector<HTMLElement>('.bloodline-sheet[role="dialog"][aria-modal="true"]');
  (closeButton ?? dialog)?.focus();
}

function focusBloodlineTrigger(): void {
  root.querySelector<HTMLButtonElement>('.bloodline-trigger')?.focus();
}

function focusProtocolDialog(): void {
  const dialog = root.querySelector<HTMLElement>('.protocol-sheet[role="dialog"][aria-modal="true"]');
  const selectedMode = dialog?.querySelector<HTMLButtonElement>('[data-protocol-mode][aria-pressed="true"]');
  (selectedMode ?? dialog)?.focus();
}

function focusProtocolMode(): void {
  root.querySelector<HTMLButtonElement>('[data-protocol-mode][aria-pressed="true"]')?.focus();
}

function focusProtocolTrigger(): void {
  if (!protocolTriggerDungeonId) return;
  root.querySelector<HTMLButtonElement>(`[data-action="open-protocol-${protocolTriggerDungeonId}"]`)?.focus();
}

function focusHubDirectoryDialog(): void {
  const closeButton = root.querySelector<HTMLButtonElement>('.hub-directory-close');
  const dialog = root.querySelector<HTMLElement>('.hub-directory-sheet[role="dialog"][aria-modal="true"]');
  (closeButton ?? dialog)?.focus();
}

function focusHubDirectoryTrigger(): void {
  if (!hubPanelTriggerActionId) return;
  root.querySelector<HTMLButtonElement>(`[data-action="${hubPanelTriggerActionId}"]`)?.focus();
}

function focusHubCodexSearch(): void {
  const search = root.querySelector<HTMLInputElement>('.codex-search');
  if (!search) return;
  search.focus();
  search.setSelectionRange(search.value.length, search.value.length);
}

function focusEquipmentCommissionDialog(): void {
  const closeButton = root.querySelector<HTMLButtonElement>('.equipment-commission-close');
  const dialog = root.querySelector<HTMLElement>('.equipment-commission-sheet[role="dialog"][aria-modal="true"]');
  (closeButton ?? dialog)?.focus();
}

function focusEquipmentCommissionTrigger(): void {
  root.querySelector<HTMLButtonElement>('.equipment-commission-trigger')?.focus();
}

function syncModalSideEffects(focusTarget?: RenderFocusTarget): void {
  document.body.classList.toggle('modal-open', isAnyModalOpen());
  const focusRequest = ++modalFocusRequest;
  queueMicrotask(() => {
    if (focusRequest !== modalFocusRequest) return;
    if (!focusTarget && getPendingCausalLedgerStatus()) {
      focusCausalLedgerDialog();
      return;
    }
    if (focusTarget && typeof focusTarget !== 'string') {
      if ('equipmentMemorySelect' in focusTarget) {
        root.querySelector<HTMLSelectElement>(
          `[data-equipment-memory-select="${focusTarget.equipmentMemorySelect}"]`
        )?.focus();
      } else {
        root.querySelector<HTMLButtonElement>(`[data-action="${focusTarget.actionId}"]`)?.focus();
      }
      return;
    }
    if (focusTarget === 'causal-ledger-dialog') focusCausalLedgerDialog();
    if (focusTarget === 'entropy-heading') focusEntropyHeadingChoice();
    if (focusTarget === 'entropy-heading-move') focusEntropyHeadingMove();
    if (focusTarget === 'mirror-phase') focusMirrorPhaseChoice();
    if (focusTarget === 'mirror-phase-move') focusMirrorPhaseMove();
    if (focusTarget === 'redaction-clause') focusRedactionClauseChoice();
    if (focusTarget === 'redaction-clause-move') focusRedactionClauseMove();
    if (focusTarget === 'auction-lot') focusAuctionLotChoice();
    if (focusTarget === 'auction-lot-move') focusAuctionLotMove();
    if (focusTarget === 'character-dialog') focusCharacterDialog();
    if (focusTarget === 'character-trigger') focusCharacterTrigger();
    if (focusTarget === 'task-dialog') focusTaskDialog();
    if (focusTarget === 'task-trigger') focusTaskTrigger();
    if (focusTarget === 'companion-dialog') focusCompanionDialog();
    if (focusTarget === 'companion-trigger') focusCompanionTrigger();
    if (focusTarget === 'method-dialog') focusMethodDialog();
    if (focusTarget === 'method-trigger') focusMethodTrigger();
    if (focusTarget === 'bloodline-dialog') focusBloodlineDialog();
    if (focusTarget === 'bloodline-trigger') focusBloodlineTrigger();
    if (focusTarget === 'protocol-dialog') focusProtocolDialog();
    if (focusTarget === 'protocol-mode') focusProtocolMode();
    if (focusTarget === 'protocol-trigger') focusProtocolTrigger();
    if (focusTarget === 'hub-directory-dialog') focusHubDirectoryDialog();
    if (focusTarget === 'hub-directory-trigger') focusHubDirectoryTrigger();
    if (focusTarget === 'hub-codex-search') focusHubCodexSearch();
    if (focusTarget === 'equipment-commission-dialog') focusEquipmentCommissionDialog();
    if (focusTarget === 'equipment-commission-trigger') focusEquipmentCommissionTrigger();
  });
}

function bindActions(actions: ViewAction[]): void {
  const handlers = new Map(actions.map((action) => [action.id, action]));

  document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = handlers.get(button.dataset.action ?? '');
      if (!action || action.disabled) return;
      const wasCharacterPanelOpen = isCharacterPanelOpen;
      const wasTaskPanelOpen = isTaskPanelOpen;
      const wasCompanionPanelOpen = isCompanionPanelOpen;
      const wasMethodPanelOpen = isMethodPanelOpen;
      const wasBloodlinePanelOpen = isBloodlinePanelOpen;
      const wasEquipmentCommissionModalOpen = isEquipmentCommissionModalOpen;
      const wasEntropyHeadingPending = getEntropyHeadingStatus()?.pending === true;
      const wasMirrorPhasePending = getMirrorPhaseStatus()?.pending === true;
      const wasRedactionClausePending = getRedactionClauseStatus()?.pending === true;
      const wasAuctionLotPending = getAuctionLotStatus()?.pending === true;
      const previousProtocolSelection = protocolSelection ? { ...protocolSelection } : undefined;
      action.onSelect();
      if (state.phase !== 'hub' || protocolSelection) hubPanel = undefined;
      state = syncCombatReplayLawState(state);
      // Restart must discard durable progress instead of saving the freshly reset state.
      if (action.id === 'new-run') {
        clearSavedState();
      } else if (action.persist !== false) {
        // UI-only sheet toggles should not create a durable save file.
        saveState(state);
      }
      const focusTarget: RenderFocusTarget | undefined = action.id.startsWith('open-hub-')
        ? 'hub-directory-dialog'
        : action.id === 'close-hub-directory'
          ? 'hub-directory-trigger'
          : action.id.startsWith('filter-codex-')
            ? { actionId: action.id }
            : action.id.startsWith('prepare-equipment-hunt-') ||
        action.id.startsWith('prepare-equipment-memory-hunt-') ||
        action.id.startsWith('select-route-contract-') ||
        action.id.startsWith('select-equipment-commission-')
        ? { actionId: action.id }
        : action.id === 'start-equipment-commission' || action.id === 'recall-equipment-commission'
          ? 'equipment-commission-dialog'
          : action.id.startsWith('entropy-heading-')
            ? 'entropy-heading-move'
            : action.id.startsWith('mirror-phase-')
              ? 'mirror-phase-move'
            : action.id.startsWith('redaction-clause-')
              ? 'redaction-clause-move'
            : action.id.startsWith('auction-lot-')
              ? 'auction-lot-move'
            : !wasEntropyHeadingPending && getEntropyHeadingStatus()?.pending
              ? 'entropy-heading'
              : !wasMirrorPhasePending && getMirrorPhaseStatus()?.pending
                ? 'mirror-phase'
              : !wasRedactionClausePending && getRedactionClauseStatus()?.pending
                ? 'redaction-clause'
              : !wasAuctionLotPending && getAuctionLotStatus()?.pending
                ? 'auction-lot'
          : getModalFocusTarget(
              wasCharacterPanelOpen,
              wasTaskPanelOpen,
              wasCompanionPanelOpen,
              wasMethodPanelOpen,
              wasBloodlinePanelOpen,
              wasEquipmentCommissionModalOpen,
              previousProtocolSelection
            );
      render(focusTarget);
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-guide-target]').forEach((button) => {
    button.addEventListener('click', () => {
      const targetActionId = button.dataset.guideTarget;
      if (!targetActionId) return;
      const target = [...root.querySelectorAll<HTMLButtonElement>('[data-action]')].find(
        (candidate) => candidate.dataset.action === targetActionId
      );
      if (!target) return;
      target.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      });
      target.focus({ preventScroll: true });
    });
  });

  root.querySelectorAll<HTMLSelectElement>('[data-equipment-memory-select]').forEach((select) => {
    select.addEventListener('change', () => {
      const equipmentId = select.dataset.equipmentMemorySelect;
      const memoryId = select.value;
      if (!isEquipmentMemoryEquipmentId(equipmentId) || !isEquipmentMemoryId(memoryId)) return;
      state = activateOwnedEquipmentMemory(state, equipmentId, memoryId);
      saveState(state);
      render({ equipmentMemorySelect: equipmentId });
    });
  });

  root.querySelector<HTMLInputElement>('.codex-search')?.addEventListener('input', (event) => {
    codexSearch = (event.currentTarget as HTMLInputElement).value;
    render('hub-codex-search');
  });

  bindFeatureHelp();
}

function actionButton(action: ViewAction, className = 'button'): string {
  return `<button class="${className}" data-action="${action.id}" ${action.disabled ? 'disabled' : ''}>
    <span>${action.label}</span>
    ${action.hint ? `<small>${action.hint}</small>` : ''}
  </button>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderGameAsset(
  kind: GameAssetKind,
  entityId: string,
  className: string,
  options: { decorative?: boolean; loading?: 'eager' | 'lazy' } = {}
): string {
  const asset = getGameAsset(kind, entityId);
  if (!asset) return '';

  const decorative = options.decorative ?? false;
  return `<img
    class="game-art ${className}"
    src="${escapeHtml(asset.src)}"
    alt="${decorative ? '' : escapeHtml(asset.alt)}"
    data-asset-key="${escapeHtml(asset.key)}"
    data-asset-role="${asset.role}"
    data-asset-fit="${asset.fit}"
    width="${asset.width}"
    height="${asset.height}"
    loading="${options.loading ?? 'lazy'}"
    decoding="async"
    draggable="false"
    ${decorative ? 'aria-hidden="true"' : ''}
  >`;
}

function renderHubStationButton(action: ViewAction, className: string, npcId: string): string {
  return `<button class="${className} has-art" data-action="${action.id}" ${action.disabled ? 'disabled' : ''}>
    ${renderGameAsset('npc', npcId, 'hub-station-art', { decorative: true, loading: 'eager' })}
    <span>${action.label}</span>
    ${action.hint ? `<small>${action.hint}</small>` : ''}
  </button>`;
}

const dungeonBannerLegacyClasses: Partial<Record<DungeonId, string>> = {
  mirror_cycle_city: 'mirror-city-banner',
  redaction_scriptorium: 'redaction-scriptorium-banner',
  legacy_auction_court: 'legacy-auction-court-banner',
  genesis_vault: 'genesis-vault-banner',
  silent_broadcast_tower: 'silent-broadcast-tower-banner',
  lost_shelter: 'lost-shelter-banner',
  false_testimony_court: 'false-testimony-court-banner',
  combat_replay_stage: 'combat-replay-stage-banner',
  panopticon_city: 'panopticon-city-banner'
};

function renderDungeonBanner(dungeonId: DungeonId): string {
  const legacyClass = dungeonBannerLegacyClasses[dungeonId];
  return renderGameAsset(
    'dungeon',
    dungeonId,
    `dungeon-banner${legacyClass ? ` ${legacyClass}` : ''}`,
    { loading: 'eager' }
  );
}

function renderFeatureHelpTrigger(id: DungeonFeatureHelpId): string {
  const help = DUNGEON_FEATURE_HELP[id];
  return `<button
    type="button"
    class="feature-help-trigger"
    data-feature-help="${id}"
    aria-label="${escapeHtml(`查看「${help.title}」说明`)}"
    aria-haspopup="dialog"
    aria-controls="dungeon-feature-help-popover"
    aria-expanded="false"
  ></button>`;
}

function renderFeatureHelpPopover(): string {
  return `<aside
    id="dungeon-feature-help-popover"
    class="feature-help-popover"
    data-feature-help-popover
    role="dialog"
    aria-modal="false"
    aria-labelledby="dungeon-feature-help-title"
    aria-describedby="dungeon-feature-help-summary dungeon-feature-help-mechanic dungeon-feature-help-guidance dungeon-feature-help-readout"
    tabindex="-1"
    hidden
  >
    <button type="button" class="feature-help-close" data-feature-help-close aria-label="关闭系统说明"></button>
    <span class="feature-help-eyebrow">系统说明</span>
    <strong id="dungeon-feature-help-title" data-feature-help-title></strong>
    <div class="feature-help-section">
      <span>是什么</span>
      <p id="dungeon-feature-help-summary" data-feature-help-summary></p>
    </div>
    <div class="feature-help-section">
      <span>怎样影响本局</span>
      <p id="dungeon-feature-help-mechanic" data-feature-help-mechanic></p>
    </div>
    <div class="feature-help-section feature-help-guidance">
      <span>现在怎么做</span>
      <p id="dungeon-feature-help-guidance" data-feature-help-guidance></p>
    </div>
    <small id="dungeon-feature-help-readout" data-feature-help-readout><b>界面怎么看</b><span></span></small>
  </aside>`;
}

function getFeatureHelpPopover(): HTMLElement | null {
  return root.querySelector<HTMLElement>('[data-feature-help-popover]');
}

function cancelFeatureHelpHide(): void {
  if (featureHelpHideTimer === undefined) return;
  window.clearTimeout(featureHelpHideTimer);
  featureHelpHideTimer = undefined;
}

function resetFeatureHelpInteraction(): void {
  cancelFeatureHelpHide();
  featureHelpTrigger = undefined;
  suppressFeatureHelpFocus = false;
}

function positionFeatureHelpPopover(trigger: HTMLButtonElement, popover: HTMLElement): void {
  popover.style.removeProperty('left');
  popover.style.removeProperty('top');
  popover.style.removeProperty('width');
  if (window.matchMedia('(max-width: 760px)').matches) return;

  const viewportPadding = 12;
  const gap = 9;
  const width = Math.min(340, window.innerWidth - viewportPadding * 2);
  const triggerRect = trigger.getBoundingClientRect();
  popover.style.width = `${width}px`;
  const popoverHeight = popover.offsetHeight;
  const centeredLeft = triggerRect.left + triggerRect.width / 2 - width / 2;
  const left = Math.min(
    window.innerWidth - width - viewportPadding,
    Math.max(viewportPadding, centeredLeft)
  );
  const below = triggerRect.bottom + gap;
  const top = below + popoverHeight <= window.innerHeight - viewportPadding
    ? below
    : Math.max(viewportPadding, triggerRect.top - popoverHeight - gap);
  popover.style.left = `${Math.round(left)}px`;
  popover.style.top = `${Math.round(top)}px`;
}

function showFeatureHelp(trigger: HTMLButtonElement, pinned: boolean): void {
  const id = trigger.dataset.featureHelp;
  const popover = getFeatureHelpPopover();
  if (!id || !isDungeonFeatureHelpId(id) || !popover) return;

  cancelFeatureHelpHide();
  const help = DUNGEON_FEATURE_HELP[id];
  popover.querySelector<HTMLElement>('[data-feature-help-title]')!.textContent = help.title;
  popover.querySelector<HTMLElement>('[data-feature-help-summary]')!.textContent = help.summary;
  popover.querySelector<HTMLElement>('[data-feature-help-mechanic]')!.textContent = help.mechanic;
  popover.querySelector<HTMLElement>('[data-feature-help-guidance]')!.textContent = help.guidance;
  popover.querySelector<HTMLElement>('[data-feature-help-readout] span')!.textContent = help.readout;
  popover.dataset.featureHelpId = id;
  popover.dataset.pinned = String(pinned);
  popover.hidden = false;
  featureHelpTrigger = trigger;
  root.querySelectorAll<HTMLButtonElement>('[data-feature-help]').forEach((candidate) => {
    candidate.setAttribute('aria-expanded', String(candidate === trigger));
  });
  positionFeatureHelpPopover(trigger, popover);
  if (pinned) popover.focus({ preventScroll: true });
}

function hideFeatureHelp(force = false, restoreFocus = false): boolean {
  const popover = getFeatureHelpPopover();
  if (!popover || popover.hidden || (!force && popover.dataset.pinned === 'true')) return false;

  cancelFeatureHelpHide();
  const trigger = featureHelpTrigger;
  popover.hidden = true;
  delete popover.dataset.featureHelpId;
  delete popover.dataset.pinned;
  popover.removeAttribute('style');
  root.querySelectorAll<HTMLButtonElement>('[data-feature-help]').forEach((candidate) => {
    candidate.setAttribute('aria-expanded', 'false');
  });
  featureHelpTrigger = undefined;
  if (restoreFocus && trigger?.isConnected) {
    suppressFeatureHelpFocus = true;
    trigger.focus();
    window.requestAnimationFrame(() => {
      suppressFeatureHelpFocus = false;
    });
  }
  return true;
}

function refreshFeatureHelpPosition(): void {
  const popover = getFeatureHelpPopover();
  if (!featureHelpTrigger?.isConnected || !popover || popover.hidden) return;
  positionFeatureHelpPopover(featureHelpTrigger, popover);
}

function scheduleFeatureHelpHide(): void {
  cancelFeatureHelpHide();
  featureHelpHideTimer = window.setTimeout(() => {
    featureHelpHideTimer = undefined;
    const popover = getFeatureHelpPopover();
    const activeElement = document.activeElement;
    if (
      popover?.matches(':hover') ||
      featureHelpTrigger?.matches(':hover') ||
      (activeElement instanceof Node && (popover?.contains(activeElement) || featureHelpTrigger?.contains(activeElement)))
    ) {
      return;
    }
    hideFeatureHelp();
  }, 180);
}

function bindFeatureHelp(): void {
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  root.querySelectorAll<HTMLButtonElement>('[data-feature-help]').forEach((trigger) => {
    if (canHover) {
      trigger.addEventListener('mouseenter', () => {
        if (getFeatureHelpPopover()?.dataset.pinned !== 'true') showFeatureHelp(trigger, false);
      });
      trigger.addEventListener('mouseleave', scheduleFeatureHelpHide);
    }
    trigger.addEventListener('focus', () => {
      if (suppressFeatureHelpFocus) return;
      if (getFeatureHelpPopover()?.dataset.pinned !== 'true') showFeatureHelp(trigger, false);
    });
    trigger.addEventListener('blur', scheduleFeatureHelpHide);
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const popover = getFeatureHelpPopover();
      const isPinnedHere = featureHelpTrigger === trigger && popover?.dataset.pinned === 'true';
      if (isPinnedHere) {
        hideFeatureHelp(true);
      } else {
        showFeatureHelp(trigger, true);
      }
    });
  });

  const popover = getFeatureHelpPopover();
  popover?.addEventListener('mouseenter', cancelFeatureHelpHide);
  popover?.addEventListener('mouseleave', scheduleFeatureHelpHide);
  popover?.querySelector<HTMLButtonElement>('[data-feature-help-close]')?.addEventListener('click', (event) => {
    event.stopPropagation();
    hideFeatureHelp(true, true);
  });
}

function renderExplorationGuide(): string {
  const guide = getExplorationGuide(state);
  if (!guide) return '';

  const marker = guide.kind === 'combat' || guide.kind === 'blocker'
    ? '!'
    : guide.kind === 'node'
      ? '>'
      : '?';
  const targetActionId = guide.targetActionId ? escapeHtml(guide.targetActionId) : '';

  return `<aside
    class="exploration-guide tone-${guide.tone} kind-${guide.kind}"
    data-guide-kind="${guide.kind}"
    data-guide-tone="${guide.tone}"
    ${targetActionId ? `data-guide-action-target="${targetActionId}"` : ''}
    aria-live="polite"
  >
    <span class="exploration-guide-marker" aria-hidden="true">${marker}</span>
    <div class="exploration-guide-copy">
      <span class="eyebrow">${escapeHtml(guide.eyebrow)}</span>
      <strong>${escapeHtml(guide.instruction)}</strong>
      ${guide.detail ? `<small>${escapeHtml(guide.detail)}</small>` : ''}
    </div>
    ${targetActionId
      ? `<button
          type="button"
          class="exploration-guide-target"
          data-guide-target="${targetActionId}"
          aria-label="定位到建议操作"
          title="定位到建议操作"
        >定位</button>`
      : ''}
  </aside>`;
}

function statCard(label: string, value: string | number, hint: string): string {
  return `<div class="stat-card">
    <span>${label}</span>
    <strong>${value}</strong>
    <small>${hint}</small>
  </div>`;
}

function objectiveRow(objective: DirectiveObjectiveResult): string {
  return `<li class="${objective.completed ? 'complete' : ''}">
    <span>${objective.completed ? '完成' : '未完成'}</span>
    <div>
      <strong>${objective.label}</strong>
      <small>${objective.description} / ${objective.progressText}</small>
    </div>
  </li>`;
}

function formatDirectiveProgress(progressText: string): string {
  const match = progressText.match(/(\d+)\/(\d+)/);
  return match ? `进度 ${match[1]}/${match[2]}` : progressText;
}

function renderDirectiveCard(dungeonId?: DungeonId, compact = false): string {
  const evaluation = getDirectiveForCurrentDungeon(dungeonId);
  const targetDungeonId = dungeonId ?? state.run?.dungeonId ?? DUNGEON_ORDER[0];
  const directive = getDirectiveForDungeon(targetDungeonId);

  return `<section class="directive-card ${compact ? 'compact-directive' : 'panel wide-panel'}">
    <div class="panel-title">
      <span class="eyebrow">主神指令</span>
      <h2>${evaluation.objectiveResults.length ? directiveStatusLabels[evaluation.status] : '目标'}</h2>
    </div>
    <h3>${directive.name}</h3>
    <p>${directive.brief}</p>
    <small class="mechanic-line">${formatDirectiveProgress(evaluation.progressText)} / 奖励预览：${evaluation.rewardPreview}</small>
    <ul class="directive-objectives">${evaluation.objectiveResults.map(objectiveRow).join('')}</ul>
  </section>`;
}

function taskClaimAction(evaluation: MainGodTaskEvaluation, actions: ViewAction[], idPrefix: string): ViewAction {
  const task = evaluation.task;
  const action: ViewAction = {
    id: `${idPrefix}-${task.id}`,
    label: evaluation.status === 'claimed' ? '已领取' : evaluation.status === 'completed' ? '领取' : '进行中',
    hint: evaluation.status === 'completed' ? formatReward(task.reward) : evaluation.progressText,
    disabled: evaluation.status !== 'completed',
    onSelect: () => {
      state = claimTaskReward(state, task.id);
    }
  };
  actions.push(action);

  return action;
}

function renderMainlineTaskPanel(actions: ViewAction[]): string {
  const evaluation = getNextMainlineTaskEvaluation(state);
  if (!evaluation) {
    return `<section class="panel wide-panel mainline-task-panel">
      <div class="panel-title">
        <span class="eyebrow">主线任务</span>
        <h2>${CAMPAIGN_DUNGEON_COUNT}章主线已完成</h2>
      </div>
      <p class="lead-copy">全部章节门禁已经推进完毕。</p>
    </section>`;
  }

  const task = evaluation.task;
  const dungeon = DUNGEONS[task.chapterDungeonId];
  const chapterNumber = (task.mainlineIndex ?? 0) + 1;
  const action = taskClaimAction(evaluation, actions, 'claim-mainline-task');

  return `<section class="panel wide-panel mainline-task-panel task-${evaluation.status}">
    <div class="panel-title">
      <div>
        <span class="eyebrow">主线任务</span>
        <h2>第 ${chapterNumber} 章 · ${dungeon.name}</h2>
      </div>
      <small>${taskStatusLabels[evaluation.status]}</small>
    </div>
    <article class="mainline-task-card">
      <div class="card-topline">
        <span>${task.title}</span>
        <small>${evaluation.progressText}</small>
      </div>
      <p>${evaluation.completed ? task.description : task.hint}</p>
      <small class="mechanic-line">奖励：${formatReward(task.reward)}</small>
      ${actionButton(action, evaluation.status === 'completed' ? 'button' : 'button ghost')}
    </article>
  </section>`;
}

function renderSideTaskCard(evaluation: MainGodTaskEvaluation, actions: ViewAction[]): string {
  const task = evaluation.task;
  const dungeon = DUNGEONS[task.chapterDungeonId];
  const action = taskClaimAction(evaluation, actions, 'claim-side-task');

  return `<article class="side-task-card task-${evaluation.status}">
    <div class="card-topline">
      <span>${dungeon.name} · ${taskStatusLabels[evaluation.status]}</span>
      <small>${evaluation.progressText}</small>
    </div>
    <h3>${task.title}</h3>
    <p>${evaluation.completed ? task.description : task.hint}</p>
    <small class="mechanic-line">奖励：${formatReward(task.reward)}</small>
    ${actionButton(action, evaluation.status === 'completed' ? 'button' : 'button ghost')}
  </article>`;
}

function renderChapterSideTasks(actions: ViewAction[]): string {
  const evaluations = evaluateVisibleSideTasks(state);
  if (!evaluations.length) return '';

  const readyCount = evaluations.filter((evaluation) => evaluation.status === 'completed').length;
  const claimedCount = evaluations.filter((evaluation) => evaluation.status === 'claimed').length;

  return `<section class="panel wide-panel chapter-side-task-panel">
    <div class="panel-title">
      <div>
        <span class="eyebrow">章节支线</span>
        <h2>已解锁章节支线</h2>
      </div>
      <small>${claimedCount}/${evaluations.length} 已领取 · ${readyCount} 可领取</small>
    </div>
    <div class="side-task-grid">${evaluations.map((evaluation) => renderSideTaskCard(evaluation, actions)).join('')}</div>
  </section>`;
}

function renderGrowthPlanner(): string {
  let stages: BalanceSimStage[];
  try {
    stages = analyzeCampaignBalance().stages;
  } catch {
    return `<section class="panel wide-panel growth-planner">
      <div class="panel-title">
        <span class="eyebrow">成长建议</span>
        <h2>${CAMPAIGN_DUNGEON_COUNT} 阶成长规划</h2>
      </div>
      <div class="campaign-route-summary"><strong>成长推演暂不可用</strong></div>
    </section>`;
  }

  return `<section class="panel wide-panel growth-planner">
    <div class="panel-title">
      <span class="eyebrow">成长建议</span>
      <h2>${CAMPAIGN_DUNGEON_COUNT} 阶成长规划</h2>
    </div>
    <div class="growth-grid">
      ${stages.map(renderGrowthStage).join('')}
    </div>
  </section>`;
}

function renderGrowthStage(stage: BalanceSimStage): string {
  const dungeon = DUNGEONS[stage.dungeonId];

  return `<article class="growth-stage risk-${stage.readiness}">
    <div class="card-topline">
      <span>Tier ${stage.tier}</span>
      <small>${readinessMeta[stage.readiness].label}</small>
    </div>
    <h3>${dungeon.name}</h3>
    <div class="growth-power">
      <span>Before <strong>${stage.beforePower}</strong></span>
      <span>After <strong>${stage.afterPower}</strong></span>
    </div>
    <small class="mechanic-line">推荐 ${stage.recommendedPower} / ${readinessMeta[stage.readiness].hint}</small>
    <p>装备：${formatEquipmentList([...stage.plannedPurchases, ...stage.plannedUpgrades])}</p>
    <p>功法：${formatMethodList(stage.plannedMethods)}</p>
    <p>灵宠：${formatPetList(stage.plannedPets)}</p>
  </article>`;
}

function formatRouteGateStatus(summary: SevenDungeonRouteSummary): string {
  if (summary.gateBeforeEntry === 'open') return '可达';
  if (summary.gateBeforeEntry === 'completed') return '推演通关';
  if (summary.gateBeforeEntry === 'locked') return '锁定';
  return '缺失';
}

function renderRouteCoverageTag(label: string, active: boolean): string {
  return `<span class="${active ? 'covered' : ''}">${label} ${active ? '已覆盖' : '未覆盖'}</span>`;
}

function renderCampaignRouteRow(summary: SevenDungeonRouteSummary): string {
  return `<article class="campaign-route-row risk-${summary.readinessBeforeEntry}">
    <div class="route-stage">
      <strong>${summary.tier}</strong>
      <span>${formatRouteGateStatus(summary)} / ${readinessMeta[summary.readinessBeforeEntry].label}</span>
    </div>
    <div class="route-copy">
      <div class="card-topline">
        <h3>${summary.dungeonName}</h3>
        <small>推演进度 ${summary.completedDungeonCountAfter}/${CAMPAIGN_DUNGEON_COUNT}</small>
      </div>
      <small class="mechanic-line">${summary.gateRequirement}</small>
      <div class="route-plan">
        <span>装备：${formatEquipmentList(summary.plannedPurchases)}</span>
        <span>升级：${formatEquipmentUpgradeList(summary.plannedUpgrades)}</span>
        <span>功法：${formatMethodList(summary.plannedMethods)}</span>
        <span>宠物：${formatPetList(summary.plannedPets)}</span>
      </div>
    </div>
    <div class="route-result">
      <strong>${summary.afterPower}</strong>
      <span>通关后战力</span>
      <small>${summary.beforePower} -> ${summary.afterPower}</small>
    </div>
  </article>`;
}

function renderCampaignRoutePanel(): string {
  // The route sim clones its input; this panel is a read-only plan and never writes the player's save.
  let route: ReturnType<typeof simulateSevenDungeonVictoryRoute>;
  try {
    route = simulateSevenDungeonVictoryRoute();
  } catch {
    return `<section class="panel wide-panel campaign-route-panel">
      <div class="panel-title">
        <span class="eyebrow">主神推演</span>
        <h2>战役路线</h2>
      </div>
      <div class="campaign-route-summary"><strong>推演终局暂不可用</strong></div>
    </section>`;
  }
  const finalSummary = route.summaries[route.summaries.length - 1];
  const finalProgress = finalSummary
    ? `${finalSummary.completedDungeonCountAfter}/${CAMPAIGN_DUNGEON_COUNT}`
    : `0/${CAMPAIGN_DUNGEON_COUNT}`;

  return `<section class="panel wide-panel campaign-route-panel">
    <div class="panel-title">
      <span class="eyebrow">主神推演</span>
      <h2>战役路线</h2>
    </div>
    <div class="campaign-route-summary">
      <strong>推演终局 ${finalProgress}</strong>
      <div class="route-coverage">
        ${renderRouteCoverageTag('装备', route.coverage.boughtEquipment)}
        ${renderRouteCoverageTag('升级', route.coverage.upgradedEquipment)}
        ${renderRouteCoverageTag('功法', route.coverage.learnedMethod)}
        ${renderRouteCoverageTag('宠物', route.coverage.gainedPet)}
      </div>
    </div>
    <div class="campaign-route-grid">
      ${route.summaries.map(renderCampaignRouteRow).join('')}
    </div>
  </section>`;
}

function getTaskTriggerHint(): string {
  const mainlineEvaluation = getNextMainlineTaskEvaluation(state);
  const chapterLabel = mainlineEvaluation ? DUNGEONS[mainlineEvaluation.task.chapterDungeonId].name : '主线完成';
  const mainlineReadyCount = mainlineEvaluation?.status === 'completed' ? 1 : 0;
  const sideReadyCount = evaluateVisibleSideTasks(state).filter((evaluation) => evaluation.status === 'completed').length;

  return `${chapterLabel} · ${mainlineReadyCount + sideReadyCount} 可领取`;
}

function getCompanionTriggerHint(): string {
  const snapshot = normalizeCompanionRunSnapshot(state.run?.companionSnapshot);
  if (state.run) {
    if (!snapshot) return '本局未携带';
    const definition = COMPANION_CATALOG.find(({ id }) => id === snapshot.companionId)!;
    return `本局 ${definition.name} R${snapshot.rank}`;
  }

  const progress = getUiCompanionProgress();
  if (!progress.active) return `${progress.owned.length}/3 已招募`;
  const definition = COMPANION_CATALOG.find(({ id }) => id === progress.active)!;
  return `${definition.name} R${progress.ranks[progress.active]}`;
}

function getMethodRank(methodId: MethodId): MethodRank | undefined {
  return getCultivationMethodRank(methodId, getUiMethodProgress());
}

function getMethodTriggerHint(): string {
  const snapshots = getCurrentRunMethodSnapshots(state);
  if (state.run) {
    if (snapshots.length > 0) return `本局 ${snapshots.length} 门功法可用`;
    return normalizeMethodRunSnapshots(state.run.methodSnapshots) ? '本局未带入功法' : '旧副本需重新进入';
  }
  if (!state.activeMethod) return `${state.learnedMethods.length}/7 已学会`;
  const rank = getMethodRank(state.activeMethod);
  return rank ? `${METHODS[state.activeMethod].name} R${rank}` : `${state.learnedMethods.length}/7 已学会`;
}

function getBloodlineTriggerHint(): string {
  const snapshot = normalizeBloodlineRunSnapshot(state.run?.bloodlineSnapshot);
  if (state.run) {
    if (!snapshot) return '本局未启用';
    return `本局 ${getBloodlineDefinition(snapshot.bloodlineId)!.name} R${snapshot.rank}`;
  }

  const progress = getUiBloodlineProgress();
  if (!progress.active) return `${Object.keys(progress.ranks).length}/4 已觉醒`;
  return `${getBloodlineDefinition(progress.active)!.name} R${progress.ranks[progress.active]}`;
}

function renderTopbar(actions: ViewAction[]): string {
  const stats = getDerivedStats(state);
  const playerPower = getPlayerPower(state);
  const commissionStatus = getEquipmentCommissionStatus(state);
  const bagRewardPoints = state.run?.lootBag.rewardPoints ?? 0;
  const bagLingyun = state.run?.lootBag.lingyun ?? 0;
  const bankedRewardPoints = Math.max(0, state.rewardPoints - bagRewardPoints);
  const bankedLingyun = Math.max(0, state.lingyun - bagLingyun);
  const phaseLabel = state.phase === 'hub' ? '主神空间' : state.phase === 'combat' ? '回合战斗' : state.phase === 'result' ? '结算' : '副本探索';
  const commissionAction: ViewAction = {
    id: 'open-equipment-commission',
    label: '委托',
    hint: commissionStatus.active
      ? `进度 ${commissionStatus.active.completedDungeonIds.length}/${commissionStatus.requiredDungeonCount}`
      : `${commissionStatus.candidates.length} 件可选`,
    persist: false,
    onSelect: () => {
      isEquipmentCommissionModalOpen = true;
      isTaskPanelOpen = false;
      isCharacterPanelOpen = false;
      isCompanionPanelOpen = false;
      isMethodPanelOpen = false;
      isBloodlinePanelOpen = false;
      protocolSelection = undefined;
    }
  };
  const taskAction: ViewAction = {
    id: 'open-task-panel',
    label: '任务',
    hint: getTaskTriggerHint(),
    persist: false,
    onSelect: () => {
      isTaskPanelOpen = true;
      isCharacterPanelOpen = false;
      isCompanionPanelOpen = false;
      isMethodPanelOpen = false;
      isBloodlinePanelOpen = false;
      isEquipmentCommissionModalOpen = false;
      protocolSelection = undefined;
    }
  };
  const characterAction: ViewAction = {
    id: 'open-character-panel',
    label: '角色',
    hint: `生命 ${state.player.hp}/${stats.maxHp} · 战力 ${playerPower}`,
    persist: false,
    onSelect: () => {
      isCharacterPanelOpen = true;
      isTaskPanelOpen = false;
      isCompanionPanelOpen = false;
      isMethodPanelOpen = false;
      isBloodlinePanelOpen = false;
      isEquipmentCommissionModalOpen = false;
      protocolSelection = undefined;
    }
  };
  const companionAction: ViewAction = {
    id: 'open-companion-panel',
    label: '小队',
    hint: getCompanionTriggerHint(),
    persist: false,
    onSelect: () => {
      isCompanionPanelOpen = true;
      isCharacterPanelOpen = false;
      isTaskPanelOpen = false;
      isMethodPanelOpen = false;
      isBloodlinePanelOpen = false;
      isEquipmentCommissionModalOpen = false;
      protocolSelection = undefined;
    }
  };
  const methodAction: ViewAction = {
    id: 'open-method-panel',
    label: '功法',
    hint: getMethodTriggerHint(),
    persist: false,
    onSelect: () => {
      isMethodPanelOpen = true;
      isCharacterPanelOpen = false;
      isTaskPanelOpen = false;
      isCompanionPanelOpen = false;
      isEquipmentCommissionModalOpen = false;
      isBloodlinePanelOpen = false;
      protocolSelection = undefined;
    }
  };
  const bloodlineAction: ViewAction = {
    id: 'open-bloodline-panel',
    label: '血统',
    hint: getBloodlineTriggerHint(),
    persist: false,
    onSelect: () => {
      isBloodlinePanelOpen = true;
      isCharacterPanelOpen = false;
      isTaskPanelOpen = false;
      isCompanionPanelOpen = false;
      isMethodPanelOpen = false;
      isEquipmentCommissionModalOpen = false;
      protocolSelection = undefined;
    }
  };
  actions.push(commissionAction, taskAction, companionAction, methodAction, bloodlineAction, characterAction);

  return `<header class="topbar">
    <div>
      <span class="eyebrow">INFINITE FLOW DEMO</span>
      <h1>主神空间</h1>
    </div>
    <div class="topbar-actions">
      <div class="resource-strip">
        <span class="resource-phase">${phaseLabel}</span>
        <div class="resource-value" data-resource="reward-points">
          <small>已入账奖励点</small>
          <strong>${bankedRewardPoints}</strong>
          ${bagRewardPoints > 0 ? `<span class="resource-pending">袋中 +${bagRewardPoints}</span>` : ''}
        </div>
        <div class="resource-value" data-resource="lingyun">
          <small>已入账灵蕴</small>
          <strong>${bankedLingyun}</strong>
          ${bagLingyun > 0 ? `<span class="resource-pending">袋中 +${bagLingyun}</span>` : ''}
        </div>
        <div class="resource-value"><small>战力</small><strong>${playerPower}</strong></div>
        <div class="resource-value"><small>生命</small><strong>${state.player.hp}/${stats.maxHp}</strong></div>
      </div>
      ${actionButton(commissionAction, 'button secondary equipment-commission-trigger')}
      ${actionButton(taskAction, 'button secondary task-trigger')}
      ${actionButton(companionAction, 'button secondary companion-trigger')}
      ${actionButton(methodAction, 'button secondary method-trigger')}
      ${actionButton(bloodlineAction, 'button secondary bloodline-trigger')}
      ${actionButton(characterAction, 'button secondary character-trigger')}
    </div>
  </header>`;
}

function renderEquipmentMemoryLibrary(showEmpty = false): string {
  const memoryMap = sanitizeEquipmentMemoryMap(state.equipmentMemories);
  const equipmentIds = EQUIPMENT_MEMORY_EQUIPMENT_CATALOG.filter((equipmentId) => {
    return state.ownedEquipment.includes(equipmentId) && Boolean(memoryMap[equipmentId]?.unlockedIds.length);
  });
  if (equipmentIds.length === 0) {
    if (!showEmpty) return '';
    return `<section class="panel compact-panel equipment-memory-library empty">
      <div class="panel-title">
        <span class="eyebrow">装备能力</span>
        <h2>装备记忆</h2>
      </div>
      <div class="equipment-memory-empty"><strong>尚未收录记忆</strong><small>成熟装备会在通关时自动记录当前副本能力。</small></div>
    </section>`;
  }

  return `<section class="panel compact-panel equipment-memory-library">
    <div class="panel-title">
      <span class="eyebrow">装备记忆库</span>
      <h2>装备能力</h2>
    </div>
    <div class="equipment-memory-library-list">
      ${equipmentIds.map((equipmentId) => {
        const entry = memoryMap[equipmentId];
        if (!entry) return '';
        const activeId = entry.activeId;
        return `<label class="equipment-memory-library-row" data-equipment-memory-equipment="${equipmentId}">
          <span><strong>${EQUIPMENT[equipmentId].name}</strong><small>已收录 ${entry.unlockedIds.length}/${EQUIPMENT_MEMORY_CATALOG.length} · 当前 ${getEquipmentMemoryName(activeId)}</small></span>
          <select
            data-equipment-memory-select="${equipmentId}"
            aria-label="切换${EQUIPMENT[equipmentId].name}的装备记忆"
            title="${getEquipmentMemoryName(activeId)}"
          >
            ${activeId ? '' : '<option value="" selected disabled>未激活</option>'}
            ${entry.unlockedIds.map((memoryId) => `<option value="${memoryId}" ${memoryId === activeId ? 'selected' : ''}>${getEquipmentMemoryName(memoryId)}</option>`).join('')}
          </select>
        </label>`;
      }).join('')}
    </div>
  </section>`;
}

function renderCharacterPanel(closeAction: ViewAction, restartAction?: ViewAction): string {
  const stats = getDerivedStats(state);
  const activePet = state.activePet ? PETS[state.activePet] : undefined;
  const activePetLevel = state.activePet ? state.petLevels[state.activePet] ?? 1 : 0;
  const weaponResonance = getCurrentWeaponResonanceProgress(state);
  const equipmentSystem = getEquipmentSystemBonus(
    equippedEquipmentIds(),
    state.equipmentLevels,
    state.equipmentAttunements ?? {},
    state.equipmentTemperRanks ?? {}
  );
  const activeSetText = equipmentSystem.activeSets.length
    ? equipmentSystem.activeSets.map((tag) => `${equipmentSetLabels[tag]}2件套`).join(' / ')
    : '暂无2件套';
  const activeMasteryText = equipmentSystem.activeMasteries.length
    ? equipmentSystem.activeMasteries.map((tag) => `${equipmentSetLabels[tag]}3件精通`).join(' / ')
    : '暂无3件精通';
  const methodNames = state.learnedMethods.length
    ? state.learnedMethods.map((methodId) => METHODS[methodId].name).join(' / ')
    : '未学习';

  return `<div class="character-panel">
    <section class="panel">
      <div class="panel-title">
        <div>
          <span class="eyebrow">角色</span>
          <h2 id="character-sheet-title">轮回者面板</h2>
        </div>
        <div class="sheet-actions">
          ${restartAction ? actionButton(restartAction, 'button secondary modal-restart') : ''}
          ${actionButton(closeAction, 'button secondary character-close')}
        </div>
      </div>
      <div class="character-profile">
        ${renderGameAsset('character', 'reincarnator', 'character-portrait', { loading: 'eager' })}
        <div>
          <span class="eyebrow">当前轮回者</span>
          <strong>无名幸存者</strong>
          <p>从主神空间出发，在不同世界中带回装备、能力与仍可延续的记忆。</p>
          <small>已完成 ${state.completedDungeonIds.length}/${CAMPAIGN_DUNGEON_COUNT} 个副本 · 战力 ${getPlayerPower(state)}</small>
        </div>
      </div>
      <div class="stats-grid">
        ${statCard('体魄', stats.body, '血量/近战')}
        ${statCard('灵力', stats.spirit, '术法/陷阱')}
        ${statCard('身法', stats.agility, '速度/撤离')}
        ${statCard('气运', stats.luck, '掉落/检定')}
        ${statCard('攻击', stats.attack, '普通伤害')}
        ${statCard('防御', stats.defense, '承伤减免')}
        ${statCard('术强', stats.artPower, '功法与符咒')}
        ${statCard('速度', stats.speed, '回合先后')}
      </div>
    </section>

    <section class="panel compact-panel">
      <div class="panel-title">
        <span class="eyebrow">装备</span>
        <h2>当前装配</h2>
      </div>
      ${EQUIPMENT_SLOTS
        .map((slot) => {
          const equipmentId = state.equipped[slot];
          const level = state.equipmentLevels[equipmentId] ?? 1;
          const sealed = isEquipmentCommissionSealed(state, equipmentId);
          const attunementName = getCurrentEquipmentAttunementName(equipmentId);
          const score =
            equipmentSystem.equipmentScores[equipmentId] ??
            getEquipmentScore(
              equipmentId,
              level,
              state.equipmentAttunements?.[equipmentId],
              state.equipmentTemperRanks ?? {}
            );
          const temper = getEquipmentTemperStatus(state, equipmentId);
          const temperText = temper.eligible
            ? `淬炼 ${temper.currentRank}/2 · ${formatTemperRank(temper.currentRank)}`
            : '基础装备不可淬炼';
          return `<div class="loadout-row ${sealed ? 'is-equipment-sealed' : ''}" data-loadout-equipment="${equipmentId}" data-temper-rank="${temper.currentRank}" data-equipment-sealed="${sealed}">
            <div class="loadout-art-cell">
              ${renderGameAsset('equipment', equipmentId, 'loadout-art', { decorative: true })}
              <span>${slotLabels[slot]}</span>
            </div>
            <div>
              <strong>${EQUIPMENT[equipmentId].name}${sealed ? ' · 封存中' : ''}</strong>
              <small>${formatEquipmentSetTags(equipmentId)} / 评分 ${score}${attunementName ? ` / 铭刻 ${attunementName}` : ''} / ${temperText}</small>
              ${renderEquipmentFieldRig(equipmentId, 'loadout')}
              ${renderEquipmentRelicConduit(equipmentId, 'loadout')}
              ${renderEquipmentSoulSkill(equipmentId, 'loadout')}
              ${renderEquipmentMemoryCompactLabel(equipmentId)}
            </div>
            <small>+${level - 1}</small>
          </div>`;
        })
        .join('')}
      ${renderWeaponResonance(weaponResonance, 'character')}
      <div class="set-summary">
        <span>装备评分</span>
        <strong>${equipmentSystem.totalScore}</strong>
        <div class="set-status">
          <small data-equipment-set-status>${activeSetText}</small>
          <small data-equipment-mastery-status>${activeMasteryText}</small>
        </div>
      </div>
      ${
        equipmentSystem.descriptions.length
          ? `<div class="set-effects">${equipmentSystem.descriptions.map((description) => `<span>${description}</span>`).join('')}</div>`
          : '<small class="mechanic-line">套装词条会在换装后自动刷新。</small>'
      }
      <div class="method-line">功法：${methodNames}</div>
    </section>

    ${renderEquipmentMemoryLibrary()}

    <section class="panel compact-panel">
      <div class="panel-title">
        <span class="eyebrow">宠物栏</span>
        <h2>出战位</h2>
      </div>
      ${
        activePet
          ? `<div class="active-pet-card">
              ${renderGameAsset('pet', activePet.id, 'active-pet-art', { decorative: true })}
              <div>
                <strong>${activePet.name}</strong>
                <span>Lv.${activePetLevel} / ${formatBonus(getPetStatBonus(activePet, activePetLevel))}</span>
                <small>${activePet.description}</small>
              </div>
            </div>`
          : '<p class="empty-copy">暂无出战宠物。可在宠物馆签约，或在战斗中捕获。</p>'
      }
    </section>

    ${renderInventory()}
  </div>`;
}

function renderInventory(): string {
  const entries = (Object.entries(state.inventory) as Array<[ItemId, number]>).filter(([, amount]) => amount > 0);
  const content = entries.length
    ? entries
        .map(([itemId, amount]) => {
          const art = renderGameAsset('item', itemId, 'inventory-art', { decorative: true });
          return `<div class="inventory-chip ${art ? 'has-art' : ''}" data-item-id="${itemId}" data-bag-count="${state.run?.lootBag.items[itemId] ?? 0}">
            ${art}
            <div>
              <span>${ITEMS[itemId].name}</span>
              ${(state.run?.lootBag.items[itemId] ?? 0) > 0 ? `<small>其中袋中 x${state.run?.lootBag.items[itemId]}</small>` : ''}
            </div>
            <strong>x${amount}</strong>
          </div>`;
        })
        .join('')
    : '<p class="empty-copy">背包为空。先兑换补给，或进副本拿材料。</p>';

  return `<section class="panel">
    <div class="panel-title">
      <span class="eyebrow">背包</span>
      <h2>道具与材料</h2>
    </div>
    <div class="inventory-grid">${content}</div>
  </section>`;
}

function renderPetHouse(actions: ViewAction[]): string {
  const petCards = petIds
    .map((petId) => {
      const pet = PETS[petId];
      const owned = state.ownedPets.includes(petId);
      const previewLevel = state.petLevels[petId] ?? 1;
      const isCapturePet = pet.source === 'capture';
      const advice = getShopAdvice(state, 'pet', petId);
      const action: ViewAction = {
        id: owned ? `activate-shop-pet-${petId}` : `buy-pet-${petId}`,
        label: owned ? (state.activePet === petId ? '出战中' : '出战') : isCapturePet ? '捕获' : '签约',
        hint: owned ? `Lv.${state.petLevels[petId] ?? 1}` : isCapturePet ? formatCost({ items: { [pet.captureItem ?? 'capture_net']: 1 } }) : formatCost(pet.cost),
        disabled: owned ? state.activePet === petId : isCapturePet || !pet.cost || !canPay(pet.cost),
        onSelect: () => {
          state = owned ? activatePet(state, petId) : buyPet(state, petId);
        }
      };
      actions.push(action);

      return `<article class="pet-card">
        <div class="card-topline">
          <span>${isCapturePet ? '副本捕获' : '可购买'}</span>
          <small>${owned ? '已拥有' : isCapturePet ? formatCost({ items: { [pet.captureItem ?? 'capture_net']: 1 } }) : formatCost(pet.cost)}</small>
        </div>
        ${renderGameAsset('pet', petId, 'card-art pet-card-art', { decorative: true })}
        <h3>${pet.name}</h3>
        <p>${pet.description}</p>
        <small class="mechanic-line">${formatPetPassives(petId)} / Lv.${previewLevel} ${formatBonus(getPetStatBonus(pet, previewLevel))}</small>
        ${renderShopAdvice(advice, isCapturePet ? '捕获路线' : '建议')}
        ${actionButton(action)}
      </article>`;
    })
    .join('');

  const ownedContent = state.ownedPets.length
    ? state.ownedPets
        .map((petId) => {
          const pet = PETS[petId];
          const level = state.petLevels[petId] ?? 1;
          const nextLevel = Math.min(level + 1, pet.maxLevel);
          const upgradeCost = getPetUpgradeCost(pet, nextLevel);
          const upgradePet = optionalGameApi.upgradePet;
          const action: ViewAction = {
            id: `activate-owned-pet-${petId}`,
            label: state.activePet === petId ? '出战中' : '出战',
            hint: `Lv.${level}`,
            disabled: state.activePet === petId,
            onSelect: () => {
              state = activatePet(state, petId);
            }
          };
          const upgradeAction: ViewAction = {
            id: `upgrade-pet-${petId}`,
            label: level >= pet.maxLevel ? '满级' : '培养',
            hint:
              level >= pet.maxLevel
                ? `Lv.${level}`
                : `${formatCost(upgradeCost)}${upgradePet ? '' : ' · 待接线'}`,
            disabled: level >= pet.maxLevel || !upgradePet || !canPay(upgradeCost),
            onSelect: () => {
              if (upgradePet) state = upgradePet(state, petId);
            }
          };
          actions.push(action, upgradeAction);

          return `<article class="pet-card owned ${state.activePet === petId ? 'active' : ''}">
            <div class="card-topline">
              <span>${state.activePet === petId ? '出战宠物' : '已拥有'}</span>
              <small>Lv.${level}</small>
            </div>
            ${renderGameAsset('pet', petId, 'card-art pet-card-art', { decorative: true })}
            <h3>${pet.name}</h3>
            <p>${formatBonus(getPetStatBonus(pet, level))}</p>
            <small class="mechanic-line">${formatPetPassives(petId)} / 培养到 Lv.${nextLevel}：${formatCost(upgradeCost)}</small>
            <div class="button-row">${actionButton(action, 'button ghost')}${actionButton(upgradeAction, 'button ghost')}</div>
          </article>`;
        })
        .join('')
    : '<p class="empty-copy">宠物栏为空。购买契约宠物，或把战斗目标压低血量后捕获。</p>';

  return `<section class="panel wide-panel pet-house">
    <div class="panel-title">
      <span class="eyebrow">宠物馆</span>
      <h2>签约 / 出战</h2>
    </div>
    <div class="pet-layout">
      <div>
        <h3>可购买宠物</h3>
        <div class="pet-grid">${petCards}</div>
      </div>
      <div>
        <h3>已拥有宠物</h3>
        <div class="pet-roster">${ownedContent}</div>
      </div>
    </div>
  </section>`;
}

function shopCard(
  title: string,
  kicker: string,
  description: string,
  cost: string,
  action: ViewAction,
  advice: ShopAdvice,
  routeLabel = '建议',
  art = ''
): string {
  return `<article class="shop-card">
    <div class="card-topline">
      <span>${kicker}</span>
      <small>${cost}</small>
    </div>
    ${art}
    <h3>${title}</h3>
    <p>${description}</p>
    ${renderShopAdvice(advice, routeLabel)}
    ${actionButton(action)}
  </article>`;
}

function renderShop(actions: ViewAction[], mode: ShopMode = 'all'): string {
  const showSupplies = mode === 'all' || mode === 'supplies';
  const showEquipment = mode === 'all' || mode === 'equipment' || mode === 'forge';
  const showPurchaseActions = mode === 'all' || mode === 'equipment';
  const showForgeActions = mode === 'all' || mode === 'forge';
  const itemCards = showSupplies
    ? shopItems
        .map((itemId) => {
          const item = ITEMS[itemId];
          const disabled = !item.cost || !canPay(item.cost);
          const action: ViewAction = {
            id: `buy-item-${itemId}`,
            label: '兑换',
            hint: item.kind,
            disabled,
            onSelect: () => {
              state = buyItem(state, itemId);
            }
          };
          actions.push(action);
          return shopCard(
            item.name,
            '道具',
            item.description,
            formatCost(item.cost),
            action,
            getShopAdvice(state, 'item', itemId),
            itemId === 'capture_net' || itemId === 'spirit_bait' ? '捕获路线' : '建议',
            renderGameAsset('item', itemId, 'card-art item-card-art', { decorative: true })
          );
        })
        .join('')
    : '';

  const forgeOwnedEquipmentCount = equipmentShop.filter((equipmentId) => state.ownedEquipment.includes(equipmentId)).length;
  const equipmentEntries: Array<{
    equipmentId: EquipmentId;
    recipe?: DungeonEquipmentRecipe;
  }> = mode === 'forge'
    ? equipmentShop
        .filter((equipmentId) => state.ownedEquipment.includes(equipmentId))
        .map((equipmentId) => ({ equipmentId }))
    : equipmentShop.flatMap((equipmentId) => {
        if (state.ownedEquipment.includes(equipmentId)) return [{ equipmentId }];
        const recipe = getPreferredEquipmentRecipe(equipmentId);
        return recipe ? [{ equipmentId, recipe }] : [];
      });
  const equipmentCards = showEquipment
    ? equipmentEntries
        .map(({ equipmentId, recipe }) => {
          const equipment = EQUIPMENT[equipmentId];
          const owned = state.ownedEquipment.includes(equipmentId);
          const level = state.equipmentLevels[equipmentId] ?? 1;
          const sealed = isEquipmentCommissionSealed(state, equipmentId);
          const purchaseStatus = recipe
            ? getEquipmentRecipePurchaseStatus(state, recipe.dungeonId, equipmentId)
            : undefined;
          const equipAction: ViewAction = {
            id: owned ? `equip-${equipmentId}` : `buy-equipment-${equipmentId}`,
            label: sealed ? '封存中' : owned ? '装备' : '兑换入架',
            hint: sealed
              ? '委托期间不可装备'
              : owned
                ? `${slotLabels[equipment.slot]} +${level - 1}`
                : purchaseStatus
                  ? formatCost(purchaseStatus.cost)
                  : '目录未解锁',
            disabled: sealed || (owned ? state.equipped[equipment.slot] === equipmentId : !purchaseStatus?.affordable),
            onSelect: () => {
              state = owned
                ? equipEquipment(state, equipmentId)
                : recipe
                  ? buyEquipment(state, equipmentId, recipe.dungeonId)
                  : state;
            }
          };
          const upgradeAction: ViewAction = {
            id: `upgrade-${equipmentId}`,
            label: sealed ? '封存中' : mode === 'forge' && !owned ? '未拥有' : '升级',
            hint: sealed ? '委托期间不可升级' : !owned ? '先在装备商人兑换' : `当前 +${level - 1}`,
            disabled: sealed || !owned || level >= equipment.maxLevel,
            onSelect: () => {
              state = upgradeEquipment(state, equipmentId);
            }
          };
          if (showPurchaseActions) actions.push(equipAction);
          if (showForgeActions) actions.push(upgradeAction);
          const baseAdvice = getShopAdvice(state, 'equipment', equipmentId);
          const advice: ShopAdvice = !owned && recipe
            ? {
                ...baseAdvice,
                reasonText: `${equipment.description} ${DUNGEONS[recipe.dungeonId].name}目录已解锁。`,
                affordabilityText: purchaseStatus?.affordable
                  ? `${ITEMS[recipe.materialId].name}充足，可以立即兑换。`
                  : `需要${ITEMS[recipe.materialId].name} x${recipe.materialAmount}，可复刷${DUNGEONS[recipe.dungeonId].name}获取。`
              }
            : baseAdvice;
          const equipmentScore = getEquipmentScore(
            equipmentId,
            level,
            state.equipmentAttunements?.[equipmentId],
            state.equipmentTemperRanks ?? {}
          );
          const attunementName = getCurrentEquipmentAttunementName(equipmentId);
          const weaponResonance = equipmentId === state.equipped.weapon ? getCurrentWeaponResonanceProgress(state) : undefined;

          return `<article class="shop-card equipment-card ${sealed ? 'is-equipment-sealed' : ''}" data-equipment-id="${equipmentId}" data-equipment-sealed="${sealed}">
            <div class="card-topline">
              <span>${slotLabels[equipment.slot]}</span>
              <small class="${sealed ? 'equipment-sealed-label' : ''}">${sealed ? '封存中' : owned ? `已拥有 +${level - 1}` : purchaseStatus ? formatCost(purchaseStatus.cost) : '目录未解锁'}</small>
            </div>
            ${renderGameAsset('equipment', equipmentId, 'card-art equipment-card-art', { decorative: true })}
            <h3>${equipment.name}</h3>
            <p>${equipment.description}</p>
            ${recipe ? `<div class="equipment-recipe-source"><span>通关解锁</span><strong>${DUNGEONS[recipe.dungeonId].name}</strong><small>持有 ${ITEMS[recipe.materialId].name} x${state.inventory[recipe.materialId]}</small></div>` : ''}
            ${showForgeActions ? `${renderEquipmentFieldRig(equipmentId, 'card')}${renderEquipmentRelicConduit(equipmentId, 'card')}${renderEquipmentSoulSkill(equipmentId, 'card')}` : ''}
            ${showForgeActions || owned ? renderEquipmentMemoryCompactLabel(equipmentId) : ''}
            <small class="mechanic-line" data-equipment-score="${equipmentScore}">${formatEquipmentSetTags(equipmentId)} / 评分 ${equipmentScore} / ${formatBonus(equipment.base)}${attunementName ? ` / 当前铭刻：${attunementName}` : ''}</small>
            ${showForgeActions && weaponResonance ? renderWeaponResonance(weaponResonance, 'equipment') : ''}
            ${showPurchaseActions ? renderEquipmentSwapPreview(equipmentId, owned) : ''}
            ${showForgeActions ? renderEquipmentAttunements(equipmentId, actions) : ''}
            ${renderShopAdvice(advice)}
            <div class="button-row">${showPurchaseActions ? actionButton(equipAction) : ''}${showForgeActions ? actionButton(upgradeAction, 'button ghost') : ''}</div>
            ${showForgeActions ? renderEquipmentTemper(equipmentId, actions) : ''}
          </article>`;
        })
        .join('')
    : '';

  const panelTitle = mode === 'supplies'
    ? '补给商人'
    : mode === 'equipment'
      ? '装备商人'
      : mode === 'forge'
        ? '锻造商人'
        : '补给 / 装备';
  const equipmentHeading = mode === 'equipment' ? '章节装备兑换' : '装备锻造';
  const equipmentContent = mode === 'forge'
    ? `<p class="forge-directory-note">${forgeOwnedEquipmentCount > 0
        ? `当前可锻造 ${forgeOwnedEquipmentCount} 件装备。装备记忆也在这里查看与切换。`
        : '当前还没有可升级装备。先通关副本，再前往装备商人用章节材料兑换。'}</p>${equipmentCards}`
    : equipmentCards || '<p class="empty-copy">通关副本后，装备商人会开放对应章节的装备目录。</p>';

  return `<section class="panel wide-panel shop-mode-${mode}">
    <div class="panel-title">
      <span class="eyebrow">主神兑换</span>
      <h2>${panelTitle}</h2>
    </div>
    ${showSupplies ? `<div class="shop-section">
      <h3>战斗补给与副本工具</h3>
      <div class="catalog-grid">${itemCards}</div>
    </div>` : ''}
    ${showEquipment ? `<div class="shop-section equipment-forge-section">
      <div class="shop-section-heading">
        <h3>${equipmentHeading}</h3>
        ${showForgeActions ? `<span class="imprint-inventory">已拥有 <strong>${forgeOwnedEquipmentCount}</strong> 件可锻造装备</span>` : ''}
      </div>
      <div class="catalog-grid">${equipmentContent}</div>
    </div>` : ''}
    ${mode === 'equipment' || mode === 'forge' ? renderEquipmentMemoryLibrary(true) : ''}
  </section>`;
}

function getDungeonCriticalTacticalItemIds(dungeonId: DungeonId): TacticalItemId[] {
  const requiredItemIds = new Set<TacticalItemId>();

  for (const node of DUNGEONS[dungeonId].nodes) {
    const nodeItemIds = [node.trap?.counterItem, node.portal?.stableItem];
    for (const itemId of nodeItemIds) {
      if (itemId && isTacticalItemId(itemId)) requiredItemIds.add(itemId);
    }

    if (!node.monsterId) continue;
    for (const pet of Object.values(PETS)) {
      if (pet.source !== 'capture' || pet.captureFrom !== node.monsterId) continue;
      const captureItem = pet.captureItem ?? 'capture_net';
      if (isTacticalItemId(captureItem)) requiredItemIds.add(captureItem);
    }
  }

  return TACTICAL_ITEM_IDS.filter((itemId) => requiredItemIds.has(itemId));
}

function formatTacticalValidationReasons(reasons: readonly string[]): string {
  return reasons
    .map((reason) => TACTICAL_ITEM_IDS.reduce(
      (formatted, itemId) => formatted.split(itemId).join(ITEMS[itemId].name),
      reason
    ))
    .join(' ');
}

function renderRunRelicPreparation(actions: ViewAction[]): string {
  const status = getRunRelicPreparationStatus(state);
  const frame = status.preparedRelicFrame;
  const activeConduits = getActiveEquipmentRelicConduits(state.equipped, state.equipmentLevels);
  const frameMatch = getEquipmentRelicConduitFrameMatch(frame, activeConduits);
  const frameRelics = Object.values(RUN_RELIC_DEFINITIONS).filter((relic) => relic.frame === frame);
  const matchingArchivedIds = status.archivedRelicIds.filter(
    (relicId) => RUN_RELIC_DEFINITIONS[relicId].frame === frame
  );

  const frameSegments = RUN_RELIC_FRAMES.map((candidateFrame) => {
    const selected = candidateFrame === frame;
    const action: ViewAction = {
      id: `set-relic-frame-${candidateFrame}`,
      label: RUN_RELIC_FRAME_DEFINITIONS[candidateFrame].name,
      persist: !selected,
      onSelect: () => {
        if (!selected) state = configureRunRelicPreparation(state, candidateFrame);
      }
    };
    actions.push(action);

    return `<button
      type="button"
      class="relic-frame-segment frame-${candidateFrame} ${selected ? 'selected' : ''}"
      data-action="${action.id}"
      data-relic-frame="${candidateFrame}"
      role="radio"
      aria-checked="${selected}"
      aria-pressed="${selected}"
    >${action.label}</button>`;
  }).join('');

  const conduitRows = activeConduits.length
    ? activeConduits.map((conduit) => {
        const matched = conduit.frameId === frame;
        return `<span
          class="relic-conduit-row ${matched ? 'matched' : 'unmatched'}"
          data-relic-conduit="${conduit.equipmentId}"
          data-relic-conduit-frame="${conduit.frameId}"
          data-relic-conduit-match="${matched}"
        >
          <strong>${EQUIPMENT[conduit.equipmentId].name}</strong>
          <small>${RUN_RELIC_FRAME_DEFINITIONS[conduit.frameId].name} · Lv.${conduit.minimumLevel} · ${matched ? '匹配' : '未匹配'}</small>
        </span>`;
      }).join('')
    : '<span class="relic-conduit-empty">当前装备没有达到最低等级的回响导管。</span>';

  const clearSeedAction: ViewAction = {
    id: 'clear-relic-seed',
    label: '不携带种子',
    hint: '首轮正常随机',
    disabled: status.preparedRelicSeedId === undefined,
    onSelect: () => {
      state = configureRunRelicPreparation(state, frame);
    }
  };
  actions.push(clearSeedAction);
  const seedButtons = matchingArchivedIds.map((relicId) => {
    const selected = relicId === status.preparedRelicSeedId;
    const relic = RUN_RELIC_DEFINITIONS[relicId];
    const action: ViewAction = {
      id: `set-relic-seed-${relicId}`,
      label: relic.name,
      hint: selected ? '首轮优先' : relic.description,
      disabled: selected,
      onSelect: () => {
        state = configureRunRelicPreparation(state, frame, relicId);
      }
    };
    actions.push(action);
    return `<button
      type="button"
      class="relic-seed-button ${selected ? 'selected' : ''}"
      data-action="${action.id}"
      data-relic-seed="${relicId}"
      aria-pressed="${selected}"
      ${action.disabled ? 'disabled' : ''}
    ><strong>${relic.name}</strong><small>${action.hint}</small></button>`;
  }).join('');

  return `<section
    class="panel wide-panel run-relic-preparation frame-${frame}"
    data-relic-preparation="true"
    data-selected-relic-frame="${frame}"
    data-relic-candidate-count="${frameMatch.matched ? 3 : 2}"
  >
    <div class="panel-title relic-preparation-heading">
      <div><span class="eyebrow">局内构筑</span><h2>回响构筑</h2></div>
      <div class="relic-candidate-summary ${frameMatch.matched ? 'matched' : ''}">
        <span>候选数量</span><strong>${frameMatch.matched ? '2 -> 3' : '2'}</strong><small>${frameMatch.matched ? '装备导管已匹配' : '需匹配装备导管'}</small>
      </div>
    </div>
    <div class="relic-frame-segments" role="radiogroup" aria-label="回响遗物框架">${frameSegments}</div>
    <div class="relic-preparation-layout">
      <div class="relic-effect-column">
        <div class="relic-subheading"><strong>${RUN_RELIC_FRAME_DEFINITIONS[frame].name}遗物池</strong><small>本框架固定 3 件</small></div>
        <div class="relic-effect-list">
          ${frameRelics.map((relic) => `<div class="relic-effect-row" data-relic-definition="${relic.id}">
            <strong>${relic.name}</strong><span>${relic.description}</span>
          </div>`).join('')}
        </div>
      </div>
      <div class="relic-conduit-column">
        <div class="relic-subheading"><strong>装备导管</strong><small>${frameMatch.sourceEquipmentIds.length} 件匹配</small></div>
        <div class="relic-conduit-list">${conduitRows}</div>
        <p>${frameMatch.matched ? '匹配导管会把每次遗物候选从 2 个扩展为 3 个。' : '当前仍为 2 选 1；装备并升级匹配框架的导管可增加一个候选。'}</p>
      </div>
    </div>
    <div class="relic-seed-preparation">
      <div class="relic-subheading"><strong>归档种子</strong><small>仅显示当前框架已归档遗物</small></div>
      <div class="relic-seed-actions">
        <button
          type="button"
          class="relic-seed-button clear ${status.preparedRelicSeedId === undefined ? 'selected' : ''}"
          data-action="${clearSeedAction.id}"
          data-relic-seed="none"
          aria-pressed="${status.preparedRelicSeedId === undefined}"
          ${clearSeedAction.disabled ? 'disabled' : ''}
        ><strong>${clearSeedAction.label}</strong><small>${clearSeedAction.hint}</small></button>
        ${seedButtons || '<span class="relic-seed-empty">该框架尚无已归档种子。</span>'}
      </div>
    </div>
  </section>`;
}

function renderTacticalItemToggle(
  itemId: TacticalItemId,
  status: ReturnType<typeof getTacticalLoadoutStatus>,
  actions: ViewAction[]
): string {
  const selected = status.preparedItemIds.includes(itemId);
  const candidateItemIds = selected
    ? status.preparedItemIds.filter((candidate) => candidate !== itemId)
    : [...status.preparedItemIds, itemId];
  const candidateStatus = getTacticalLoadoutStatus({ ...state, preparedItemIds: [...candidateItemIds] });
  const disabled = !selected && !candidateStatus.isValid;
  const stock = state.inventory[itemId];
  const hint = selected
    ? '已分配 · 取消后释放槽位'
    : disabled
      ? formatTacticalValidationReasons(candidateStatus.reasons)
      : stock > 0
        ? '可分配'
        : '库存 0 · 可预设';
  const action: ViewAction = {
    id: `toggle-tactical-${itemId}`,
    label: ITEMS[itemId].name,
    hint,
    disabled,
    onSelect: () => {
      const currentItemIds = getTacticalLoadoutStatus(state).preparedItemIds;
      const nextItemIds = currentItemIds.includes(itemId)
        ? currentItemIds.filter((candidate) => candidate !== itemId)
        : [...currentItemIds, itemId];
      state = configureTacticalLoadout(state, nextItemIds);
    }
  };
  actions.push(action);

  return `<button
    type="button"
    class="tactical-item-toggle ${selected ? 'selected' : ''} category-${getTacticalItemCategory(itemId)}"
    data-action="${action.id}"
    data-tactical-item="${itemId}"
    data-selected="${selected}"
    data-stock="${stock}"
    aria-pressed="${selected}"
    ${disabled ? 'disabled' : ''}
  >
    <span class="tactical-item-main"><strong>${ITEMS[itemId].name}</strong><b>库存 ${stock}</b></span>
    <small>${hint}</small>
  </button>`;
}

function renderTacticalLoadoutPreparation(actions: ViewAction[]): string {
  const status = getTacticalLoadoutStatus(state);
  const generalSlots = Array.from({ length: status.generalSlotsAvailable }, (_, index) => {
    const itemId = status.generalSlotItemIds[index];
    return `<div
      class="tactical-slot general ${itemId ? 'filled' : 'empty'}"
      data-tactical-slot="general-${index + 1}"
      data-assigned-item="${itemId ?? ''}"
    >
      <span>通用槽 ${index + 1}</span>
      <strong>${itemId ? ITEMS[itemId].name : '空'}</strong>
      <small>${itemId ? tacticalItemCategoryLabels[getTacticalItemCategory(itemId) ?? 'combat'] : '待分配'}</small>
    </div>`;
  }).join('');
  const specializedSlots = status.activeFieldRigs.map((rig, slotIndex) => {
    const assignment = status.specializedSlotAssignments.find((candidate) => candidate.slotIndex === slotIndex);
    return `<div
      class="tactical-slot specialized ${assignment ? 'filled' : 'empty'}"
      data-tactical-slot="${rig.id}"
      data-slot-category="${rig.category}"
      data-assigned-item="${assignment?.itemId ?? ''}"
    >
      <span>${rig.name}</span>
      <strong>${assignment ? ITEMS[assignment.itemId].name : '空'}</strong>
      <small>来源：${EQUIPMENT[rig.equipmentId].name} · 类别：${rig.category === 'any' ? '通用' : tacticalItemCategoryLabels[rig.category]}</small>
    </div>`;
  }).join('');

  return `<section
    class="panel wide-panel tactical-loadout-panel"
    data-general-slots-used="${status.generalSlotsUsed}"
    data-general-slots-available="${status.generalSlotsAvailable}"
    data-specialized-slots="${status.activeFieldRigs.length}"
  >
    <div class="panel-title tactical-loadout-heading">
      <div><span class="eyebrow">出发整备</span><h2>战术携行</h2></div>
      <div class="tactical-capacity"><strong>${status.preparedItemIds.length}</strong><span>已选类型</span><b>${status.generalSlotsUsed}/${status.generalSlotsAvailable}</b><span>通用槽</span></div>
    </div>
    ${status.isValid ? '' : `<div class="tactical-loadout-warning" role="status">${formatTacticalValidationReasons(status.reasons)}</div>`}
    <div class="tactical-slot-grid" aria-label="战术携行槽位">
      ${generalSlots}
      ${specializedSlots || '<div class="tactical-rig-empty">当前装备无专用挂载槽</div>'}
    </div>
    <div class="tactical-category-grid">
      ${TACTICAL_ITEM_CATEGORIES.map((category) => {
        const itemIds = TACTICAL_ITEM_IDS.filter((itemId) => getTacticalItemCategory(itemId) === category);
        return `<section class="tactical-item-group" data-tactical-category="${category}">
          <div class="tactical-group-heading"><strong>${tacticalItemCategoryLabels[category]}</strong><small>${itemIds.length} 类</small></div>
          <div class="tactical-item-grid">${itemIds.map((itemId) => renderTacticalItemToggle(itemId, status, actions)).join('')}</div>
        </section>`;
      }).join('')}
    </div>
  </section>`;
}

function renderDungeonTacticalFit(dungeonId: DungeonId): string {
  const requiredItemIds = getDungeonCriticalTacticalItemIds(dungeonId);
  const preparedItemIds = getTacticalLoadoutStatus(state).preparedItemIds;
  const preparedCount = requiredItemIds.filter((itemId) => preparedItemIds.includes(itemId)).length;
  const missingItemIds = requiredItemIds.filter((itemId) => !preparedItemIds.includes(itemId));
  const detail = requiredItemIds.length === 0
    ? '无特定关键工具'
    : missingItemIds.length === 0
      ? '关键工具已覆盖'
      : `缺：${missingItemIds.map((itemId) => ITEMS[itemId].name).join('、')}`;

  return `<div
    class="dungeon-tactical-fit ${preparedCount === requiredItemIds.length ? 'fit-complete' : 'fit-missing'}"
    data-tactical-fit-dungeon="${dungeonId}"
    data-prepared-count="${preparedCount}"
    data-required-count="${requiredItemIds.length}"
  >
    <span>携行适配</span><strong>${preparedCount}/${requiredItemIds.length}</strong><small>${detail}</small>
  </div>`;
}

function renderProtocolRelicLock(actions: ViewAction[]): string {
  const status = getRunRelicPreparationStatus(state);
  const frame = status.preparedRelicFrame;
  const seedName = getRunRelicName(status.preparedRelicSeedId);
  const frameDescriptions: Record<RunRelicFrame, string> = {
    assault: '强化输出与战斗收益',
    bulwark: '强化生存与恢复能力',
    wayfinder: '强化探索与路线收益'
  };
  const frameButtons = RUN_RELIC_FRAMES.map((candidateFrame) => {
    const selected = candidateFrame === frame;
    const action: ViewAction = {
      id: `protocol-relic-frame-${candidateFrame}`,
      label: RUN_RELIC_FRAME_DEFINITIONS[candidateFrame].name,
      disabled: selected,
      onSelect: () => {
        state = configureRunRelicPreparation(state, candidateFrame);
      }
    };
    actions.push(action);
    return `<button
      type="button"
      class="protocol-relic-frame ${selected ? 'selected' : ''}"
      data-action="${action.id}"
      data-relic-frame="${candidateFrame}"
      role="radio"
      aria-checked="${selected}"
      aria-pressed="${selected}"
      ${action.disabled ? 'disabled' : ''}
    ><strong>${action.label}</strong><small>${frameDescriptions[candidateFrame]}</small></button>`;
  }).join('');
  const relics = RUN_RELIC_IDS_BY_FRAME[frame].map((relicId) => RUN_RELIC_DEFINITIONS[relicId]);

  return `<section
    class="protocol-relic-lock protocol-relic-choice"
    data-locked-relic-frame="${frame}"
    data-locked-relic-seed="${status.preparedRelicSeedId ?? 'none'}"
  >
    <div class="protocol-section-heading"><span class="feature-help-label">本局回响${renderFeatureHelpTrigger('relic')}</span><strong>探索中随机出现，仅本局生效</strong></div>
    <div class="protocol-relic-frames" role="radiogroup" aria-label="选择回响流派">${frameButtons}</div>
    <div class="protocol-relic-preview">
      ${relics.map((relic) => `<span><strong>${relic.name}</strong><small>${relic.description}</small></span>`).join('')}
    </div>
    ${seedName ? `<small class="protocol-relic-seed">首轮优先出现：${seedName}</small>` : ''}
  </section>`;
}

function renderRunTacticalLoadout(): string {
  const snapshot = state.run?.tacticalLoadout;
  if (!state.run) return '';

  if (!snapshot) {
    return `<div class="run-tactical-loadout legacy" data-run-tactical-loadout="legacy-unrestricted">
      <span class="feature-help-label">本轮携行${renderFeatureHelpTrigger('tacticalLoadout')}</span><strong>旧档本轮不限携行</strong>
    </div>`;
  }

  return `<div
    class="run-tactical-loadout"
    data-run-tactical-loadout="snapshot"
    data-run-tactical-count="${snapshot.itemIds.length}"
  >
    <div><span class="feature-help-label">本轮携行快照${renderFeatureHelpTrigger('tacticalLoadout')}</span><strong>${snapshot.itemIds.length} 类</strong></div>
    <div class="run-tactical-items">
      ${snapshot.itemIds.length
        ? snapshot.itemIds.map((itemId) => `<span data-run-tactical-item="${itemId}">${ITEMS[itemId].name}<b>x${state.inventory[itemId]}</b></span>`).join('')
        : '<span class="empty">未携行战术道具</span>'}
    </div>
  </div>`;
}

function getSoulSkillAvailabilityLabel(status: EquipmentSoulSkillActionStatus): string {
  if (status.availability === 'spent') return '已消耗';
  if (status.availability === 'no_charges') return '技能就绪 · 共鸣次数耗尽';
  if (status.availability === 'ready') return '就绪';
  return '未冻结';
}

function renderRunSoulSkillStatus(): string {
  if (!state.run) return '';
  const snapshot = isEquipmentSoulSkillRunState(state.run.soulSkillState)
    ? state.run.soulSkillState
    : undefined;

  if (!snapshot) {
    return `<div
      class="run-soul-skill-status legacy"
      data-run-soul-skills="legacy-disabled"
      data-frozen-soul-skill-count="0"
      data-soul-skill-charge="0"
    >
      <div><span class="feature-help-label">本局器魂${renderFeatureHelpTrigger('soulSkill')}</span><strong>旧档本局未启用器魂</strong></div>
      <small>不会按当前装备补齐技能；返回主神空间后，下一次入场会重新冻结。</small>
    </div>`;
  }

  const statuses = getEquipmentSoulSkillActionStatuses(state).filter(({ frozen }) => frozen);
  return `<div
    class="run-soul-skill-status active"
    data-run-soul-skills="active"
    data-frozen-soul-skill-count="${snapshot.frozenSkillIds.length}"
    data-soul-skill-charge="${snapshot.chargesRemaining}"
  >
    <div class="run-soul-skill-heading">
      <div><span class="feature-help-label">本局器魂${renderFeatureHelpTrigger('soulSkill')}</span><strong>共鸣次数 ${snapshot.chargesRemaining}/2</strong></div>
      <small>${snapshot.pendingRecharge ? '共鸣待选择' : `${snapshot.readySkillIds.length} 项技能仍就绪`}</small>
    </div>
    <div class="run-soul-skill-list">
      ${statuses.length
        ? statuses.map((status) => `<span
            class="soul-skill-state state-${status.availability}"
            data-soul-skill-id="${status.skillId}"
            data-soul-skill-charge="${snapshot.chargesRemaining}"
            data-soul-skill-source-equipment="${status.definition.equipmentId}"
          >
            <strong>${status.definition.name}</strong>
            <small>${EQUIPMENT[status.definition.equipmentId].name} · ${getSoulSkillAvailabilityLabel(status)}</small>
          </span>`).join('')
        : '<span class="empty"><strong>本局未冻结技能</strong><small>共鸣次数为 0</small></span>'}
    </div>
  </div>`;
}

function renderRunFieldSurveyStatus(): string {
  if (!state.run) return '';
  const snapshot = isFieldSurveyRunState(state.run.fieldSurveyState)
    ? state.run.fieldSurveyState
    : undefined;

  if (!snapshot) {
    return `<div class="run-field-survey-status legacy" data-field-survey-state="legacy-disabled">
      <div><span class="feature-help-label">本局铭刻勘探${renderFeatureHelpTrigger('fieldSurvey')}</span><strong>本局禁用</strong></div>
      <small>快照缺失或格式异常，不会按当前装备回填；普通奖励仍可照常收取。</small>
    </div>`;
  }

  return `<div
    class="run-field-survey-status active"
    data-field-survey-state="active"
    data-frozen-field-survey-source-count="${snapshot.frozenSources.length}"
    data-resolved-field-survey-count="${snapshot.resolvedSurveys.length}"
  >
    <div><span class="feature-help-label">本局铭刻勘探${renderFeatureHelpTrigger('fieldSurvey')}</span><strong>${snapshot.frozenSources.length} 个冻结来源 · ${snapshot.resolvedSurveys.length} 处已结算</strong></div>
    <div class="field-survey-source-list">
      ${snapshot.frozenSources.length
        ? snapshot.frozenSources.map((source) => `<span
            data-field-survey-attunement="${source.attunementId}"
            data-field-survey-source-equipment="${source.equipmentId}"
          ><strong>${EQUIPMENT[source.equipmentId].name}</strong><small>${getEquipmentAttunementOptions(source.equipmentId).find((option) => option.id === source.attunementId)?.name ?? source.attunementId}</small></span>`).join('')
        : '<span class="empty">本局没有冻结来源</span>'}
    </div>
  </div>`;
}

function renderRunRelicStatus(actions: ViewAction[]): string {
  if (!state.run) return '';
  const relicState = isRunRelicState(state.run.relicState) ? state.run.relicState : undefined;
  if (!relicState) {
    return `<div class="run-relic-status legacy" data-run-relic-state="legacy-no-relic">
      <div><span class="feature-help-label">本局回响${renderFeatureHelpTrigger('relic')}</span><strong>旧档本局未启用遗物</strong></div>
      <small>不会补发框架、候选或局内效果；返回主神空间后可为下一局整备。</small>
    </div>`;
  }

  const acquiredRelics = relicState.acquiredIds.map((relicId) => RUN_RELIC_DEFINITIONS[relicId]);
  const frozenConduits = (state.run.relicConduitSourceEquipmentIds ?? []).flatMap((value) => {
    if (typeof value !== 'string' || !hasOwnKey(EQUIPMENT, value)) return [];
    const equipmentId = value as EquipmentId;
    const conduit = getEquipmentRelicConduitByEquipmentId(equipmentId);
    return conduit && conduit.frameId === relicState.frame
      ? [{ equipmentId, name: EQUIPMENT[equipmentId].name }]
      : [];
  });
  const pendingDraft = relicState.pendingDraft;
  const draftChoices = pendingDraft
    ? pendingDraft.candidateIds.map((relicId) => {
        const relic = RUN_RELIC_DEFINITIONS[relicId];
        const action: ViewAction = {
          id: `choose-run-relic-${relicId}`,
          label: relic.name,
          hint: relic.description,
          onSelect: () => {
            state = resolveRunRelicDraft(state, pendingDraft.draftId, relicId);
          }
        };
        actions.push(action);
        return `<button
          type="button"
          class="relic-draft-choice frame-${relic.frame}"
          data-action="${action.id}"
          data-relic-choice="${relicId}"
        ><strong>${relic.name}</strong><small>${relic.description}</small></button>`;
      }).join('')
    : '';

  return `<div
    class="run-relic-status frame-${relicState.frame} ${pendingDraft ? 'has-pending-draft' : ''}"
    data-run-relic-state="active"
    data-relic-frame="${relicState.frame}"
    data-run-relic-acquired-count="${acquiredRelics.length}"
    data-run-relic-candidate-count="${pendingDraft?.candidateIds.length ?? 0}"
  >
    <div class="run-relic-summary">
      <div><span class="feature-help-label">本局框架${renderFeatureHelpTrigger('relic')}</span><strong>${RUN_RELIC_FRAME_DEFINITIONS[relicState.frame].name}</strong></div>
      <div><span>归档种子</span><strong data-relic-seed="${relicState.seedRelicId ?? 'none'}">${getRunRelicName(relicState.seedRelicId) ?? '无'}</strong></div>
      <div><span>已获得</span><strong>${acquiredRelics.length}/3</strong></div>
      <div><span>冻结导管</span><strong>${frozenConduits.length ? `${frozenConduits.length} 件 · 候选 3` : '无 · 候选 2'}</strong></div>
    </div>
    <div class="run-relic-detail">
      <div class="run-relic-acquired">
        ${acquiredRelics.length
          ? acquiredRelics.map((relic) => `<span data-run-relic-acquired="${relic.id}"><strong>${relic.name}</strong><small>${relic.description}</small></span>`).join('')
          : '<span class="empty">尚未获得本局遗物</span>'}
      </div>
      <div class="run-relic-conduits">
        ${frozenConduits.length
          ? frozenConduits.map((conduit) => `<span data-relic-conduit="${conduit.equipmentId}">${conduit.name}</span>`).join('')
          : '<span>本局未冻结匹配导管</span>'}
      </div>
      <small class="run-relic-effects">当前合计：${formatCurrentRunRelicEffects()}</small>
    </div>
    ${pendingDraft ? `<div class="relic-pending-draft" role="group" aria-label="回响遗物选择">
      <div><span class="eyebrow">路线已暂停</span><strong>选择一件回响遗物</strong><small>${pendingDraft.candidateIds.length} 选 1，选择后立即生效。</small></div>
      <div class="relic-draft-choices">${draftChoices}</div>
    </div>` : ''}
  </div>`;
}

function renderBossSealProgress(dungeonId: DungeonId, compact = false): string {
  const seal = getBossSealStatus(state, dungeonId);
  if (!seal) return '';

  return `<div class="boss-seal-progress ${seal.cleared ? 'is-cleared' : 'is-sealed'} ${compact ? 'compact' : ''}"
    data-boss-seal="${seal.cleared ? 'cleared' : 'sealed'}"
    data-boss-node-id="${seal.definition.nodeId}">
    <span class="boss-seal-count">${seal.cleared ? '1/1' : '0/1'}</span>
    <div class="boss-seal-copy">
      <strong class="feature-help-label">${seal.definition.bossTitle}${renderFeatureHelpTrigger('bossSeal')}</strong>
      <small>${seal.requirementText}</small>
    </div>
  </div>`;
}

function protocolPressureDelta(multiplierPercent: number): string {
  return `+${Math.max(0, multiplierPercent - 100)}%`;
}

function renderProtocolEquipmentMemoryHuntPreparation(
  dungeonId: DungeonId,
  actions: ViewAction[]
): string {
  const status = getEquipmentMemoryHuntPreparationStatus(state, dungeonId);
  const definition = status.definition;
  const selectedEquipmentId = status.currentPrepared?.dungeonId === dungeonId
    ? status.currentPrepared.equipmentId
    : undefined;
  const eligibleEquipmentIds = status.targetEquipmentIds;
  const equipmentHuntPrepared = status.equipmentHuntConflict;
  const blockedByEquipmentHunt = equipmentHuntPrepared && !selectedEquipmentId;
  const preparationState = selectedEquipmentId
    ? 'prepared'
    : status.available
      ? 'none'
      : 'unavailable';
  const noneAction: ViewAction = {
    id: `prepare-equipment-memory-hunt-${dungeonId}-none`,
    label: '不狩猎',
    disabled: blockedByEquipmentHunt,
    onSelect: () => {
      state = prepareEquipmentMemoryHunt(state, dungeonId);
    }
  };
  const equipmentActions = definition
    ? eligibleEquipmentIds.map((equipmentId) => [
        equipmentId,
        {
          id: `prepare-equipment-memory-hunt-${dungeonId}-${equipmentId}`,
          label: EQUIPMENT[equipmentId].name,
          disabled: blockedByEquipmentHunt,
          onSelect: () => {
            state = prepareEquipmentMemoryHunt(state, dungeonId, equipmentId);
          }
        } satisfies ViewAction
      ] as const)
    : [];
  actions.push(noneAction, ...equipmentActions.map(([, action]) => action));

  const noneSelected = selectedEquipmentId === undefined;
  const noneOption = `<button
    class="protocol-equipment-memory-option none ${noneSelected ? 'selected' : ''}"
    data-action="${noneAction.id}"
    data-equipment-memory-option="none"
    ${noneSelected ? 'data-equipment-memory-selected="true"' : ''}
    type="button"
    role="radio"
    aria-checked="${noneSelected}"
    aria-disabled="${noneAction.disabled === true}"
    ${noneAction.disabled ? 'disabled' : ''}
  ><span class="equipment-memory-radio" aria-hidden="true"></span><span><strong>不狩猎</strong><small>本局不接装备记忆委托</small></span></button>`;
  const memoryOptions = equipmentActions.map(([equipmentId, action]) => {
    if (!definition) return '';
    const selected = selectedEquipmentId === equipmentId;
    const entry = getEquipmentMemoryEntry(equipmentId);
    const candidate = status.candidates.find((entry) => entry.equipmentId === equipmentId);
    const activeName = getEquipmentMemoryName(entry?.activeId);
    const nodeTitle = DUNGEONS[dungeonId].nodes.find((node) => node.id === definition.nodeId)?.title ?? definition.nodeId;
    const eventTitle = getEquipmentMemoryEventTitle(dungeonId, definition.eventId);
    return `<button
      class="protocol-equipment-memory-option ${selected ? 'selected' : ''}"
      data-action="${action.id}"
      data-equipment-memory-option="${equipmentId}"
      data-equipment-memory-id="${definition.id}"
      data-equipment-memory-collection="${entry?.unlockedIds.length ?? 0}"
      ${selected ? 'data-equipment-memory-selected="true"' : ''}
      type="button"
      role="radio"
      aria-checked="${selected}"
      aria-disabled="${action.disabled === true}"
      ${action.disabled ? 'disabled' : ''}
    >
      <span class="equipment-memory-radio" aria-hidden="true"></span>
      <span class="equipment-memory-option-title"><strong>${EQUIPMENT[equipmentId].name}</strong><b>${definition.name}</b></span>
      <small>${eventTitle} / ${nodeTitle}</small>
      <span class="equipment-memory-option-meta"><small>收录 ${entry?.unlockedIds.length ?? 0}/${EQUIPMENT_MEMORY_CATALOG.length}</small><small>active ${activeName}</small><small>铭刻 ${candidate?.attunement?.name ?? getEquipmentMemoryAttunementName(equipmentId)}</small></span>
    </button>`;
  }).join('');
  const conflict = equipmentHuntPrepared ? 'equipment' : 'none';
  const heading = definition
    ? `${definition.name} · ${selectedEquipmentId ? EQUIPMENT[selectedEquipmentId].name : '未选择装备'}`
    : '当前副本无可恢复记忆';

  return `<section
    class="protocol-equipment-memory-hunt state-${preparationState}"
    data-equipment-memory-preparation="${preparationState}"
    data-equipment-memory-id="${definition?.id ?? 'none'}"
    data-hunt-conflict="${conflict}"
  >
    <div class="protocol-equipment-memory-heading"><span>装备记忆</span><strong>${heading}</strong></div>
    <div class="protocol-equipment-memory-options" role="radiogroup" aria-label="装备记忆狩猎目标">
      ${noneOption}${memoryOptions}
    </div>
    ${blockedByEquipmentHunt ? '<p class="equipment-hunt-conflict" role="status">每局仅一个装备狩猎委托</p>' : ''}
    ${!status.available ? `<small class="equipment-memory-unavailable">${status.unavailableReason ?? '当前已装备且符合领域 eligibility 的装备为空。'}</small>` : ''}
  </section>`;
}

function renderProtocolEquipmentHuntPreparation(dungeonId: DungeonId, actions: ViewAction[]): string {
  const status = getEquipmentHuntPreparationStatus(state, dungeonId);
  const selectedTargetId = status.targetEquipmentId;
  const memoryPreparation = normalizePreparedEquipmentMemoryHunt(state.preparedEquipmentMemoryHunt);
  const memoryPrepared = memoryPreparation?.dungeonId === dungeonId;
  const blockedByMemoryHunt = memoryPrepared && !selectedTargetId;
  const poolCollected = status.targetEquipmentIds.length === 0;
  const preparationState = poolCollected ? 'collected' : selectedTargetId ? 'prepared' : 'none';
  const targetLabel = poolCollected
    ? '装备池已收集'
    : selectedTargetId
      ? EQUIPMENT[selectedTargetId].name
      : '未指定';
  const cluePreview = `<div class="protocol-equipment-hunt-clues">
    <span>替代线索</span>
    <div>${status.clueNodes.map((clue) => `<strong>${clue.title}</strong>`).join('')}</div>
  </div>`;

  if (poolCollected) {
    return `<section
      class="protocol-equipment-hunt pool-collected"
      data-equipment-hunt-preparation="${preparationState}"
      data-equipment-hunt-target="none"
      data-hunt-conflict="${memoryPrepared ? 'memory' : 'none'}"
    >
      <div class="protocol-equipment-hunt-heading"><span>装备追猎</span><strong>${targetLabel}</strong></div>
      ${cluePreview}
    </section>`;
  }

  const clearAction: ViewAction = {
    id: `prepare-equipment-hunt-${dungeonId}-none`,
    label: '不追猎',
    disabled: blockedByMemoryHunt,
    onSelect: () => {
      state = prepareEquipmentHunt(state, dungeonId);
    }
  };
  const targetActions = status.targetEquipmentIds.map((equipmentId): [EquipmentId, ViewAction] => [
    equipmentId,
    {
      id: `prepare-equipment-hunt-${dungeonId}-${equipmentId}`,
      label: EQUIPMENT[equipmentId].name,
      disabled: blockedByMemoryHunt,
      onSelect: () => {
        state = prepareEquipmentHunt(state, dungeonId, equipmentId);
      }
    }
  ]);
  actions.push(clearAction, ...targetActions.map(([, action]) => action));

  const optionButton = (equipmentId: EquipmentId | undefined, action: ViewAction): string => {
    const selected = equipmentId === selectedTargetId;
    const equipment = equipmentId ? EQUIPMENT[equipmentId] : undefined;
    return `<button
      class="protocol-equipment-hunt-option ${selected ? 'selected' : ''}"
      data-action="${action.id}"
      data-equipment-hunt-target="${equipmentId ?? 'none'}"
      type="button"
      role="radio"
      aria-checked="${selected}"
      aria-pressed="${selected}"
      aria-disabled="${action.disabled === true}"
      ${action.disabled ? 'disabled' : ''}
    ><span>${action.label}</span><small>${selected ? '已选' : equipment ? slotLabels[equipment.slot] : '普通探索'}</small></button>`;
  };

  return `<section
    class="protocol-equipment-hunt"
    data-equipment-hunt-preparation="${preparationState}"
    data-equipment-hunt-target="${selectedTargetId ?? 'none'}"
    data-hunt-conflict="${memoryPrepared ? 'memory' : 'none'}"
  >
    <div class="protocol-equipment-hunt-heading"><span>装备追猎</span><strong>${targetLabel}</strong></div>
    <div class="protocol-equipment-hunt-options" role="radiogroup" aria-label="装备追猎目标">
      ${optionButton(undefined, clearAction)}
      ${targetActions.map(([equipmentId, action]) => optionButton(equipmentId, action)).join('')}
    </div>
    ${cluePreview}
    ${blockedByMemoryHunt ? '<p class="equipment-hunt-conflict" role="status">每局仅一个装备狩猎委托</p>' : ''}
  </section>`;
}

function renderRouteContractPreparation(dungeonId: DungeonId, actions: ViewAction[]): string {
  if (!protocolSelection) return '';

  const contracts = listRouteContracts(dungeonId);
  const selectedContractId = protocolSelection.routeContractId;
  const createAction = (routeContractId?: string): ViewAction => ({
    id: `select-route-contract-${routeContractId ?? 'none'}`,
    label: routeContractId ?? '不接契约',
    persist: false,
    onSelect: () => {
      protocolSelection = {
        ...protocolSelection,
        dungeonId,
        protocolId: protocolSelection?.protocolId ?? 'standard',
        routeContractId
      };
    }
  });
  const noneAction = createAction();
  const contractActions = contracts.map((contract) => [contract, createAction(contract.id)] as const);
  actions.push(noneAction, ...contractActions.map(([, action]) => action));

  const option = (
    routeContractId: string | undefined,
    action: ViewAction,
    name: string,
    order: string,
    rewardPoints: number
  ): string => {
    const selected = routeContractId === selectedContractId;
    return `<button
      class="route-contract-option ${selected ? 'selected' : ''}"
      data-action="${action.id}"
      data-route-contract-option="${routeContractId ?? 'none'}"
      data-route-contract-reward-points="${rewardPoints}"
      type="button"
      role="radio"
      aria-checked="${selected}"
      aria-pressed="${selected}"
    >
      <span class="route-contract-radio" aria-hidden="true"></span>
      <strong>${name}</strong>
      <small>${order}</small>
      <b>+${rewardPoints} 奖励点</b>
    </button>`;
  };

  return `<section
    class="protocol-route-contract"
    data-route-contract-selected="${selectedContractId ?? 'none'}"
    aria-labelledby="route-contract-heading"
  >
    <div class="route-contract-heading">
      <span id="route-contract-heading">路线契约</span>
      <strong>${selectedContractId ? '按顺序完成可获独立加成' : '可选'}</strong>
    </div>
    <div class="route-contract-options" role="radiogroup" aria-label="路线契约">
      ${option(undefined, noneAction, '不接契约', '保持普通路线，不增加顺序目标', 0)}
      ${contractActions.map(([contract, action]) => {
        const [firstTargetId, secondTargetId] = contract.targetNodeIds;
        const firstTitle = DUNGEONS[dungeonId].nodes.find((node) => node.id === firstTargetId)?.title ?? firstTargetId;
        const secondTitle = DUNGEONS[dungeonId].nodes.find((node) => node.id === secondTargetId)?.title ?? secondTargetId;
        return option(
          contract.id,
          action,
          contract.name,
          `1 ${firstTitle} -> 2 ${secondTitle}`,
          contract.rewardPoints
        );
      }).join('')}
    </div>
  </section>`;
}

function renderProtocolModal(actions: ViewAction[]): string {
  if (!protocolSelection) return '';

  const { dungeonId, protocolId } = protocolSelection;
  const dungeon = DUNGEONS[dungeonId];
  const selectedDefinition = getRunProtocolDefinition(dungeonId, protocolId);
  const advancedUnlocked = state.completedDungeonIds.includes(dungeonId);
  const difficultyNames: Record<RunProtocolId, string> = {
    standard: '普通',
    imprint: '困难',
    deep: '炼狱'
  };
  const difficultyDescriptions: Record<RunProtocolId, string> = {
    standard: '标准敌人与陷阱，适合首次探索。',
    imprint: '敌人与陷阱更强，通关奖励更高。',
    deep: '最高强度挑战，提供最高通关收益。'
  };
  const standardModeAction: ViewAction = {
    id: 'protocol-mode-standard',
    label: difficultyNames.standard,
    persist: false,
    onSelect: () => {
      protocolSelection = { ...protocolSelection, dungeonId, protocolId: 'standard' };
    }
  };
  const imprintModeAction: ViewAction = {
    id: 'protocol-mode-imprint',
    label: difficultyNames.imprint,
    disabled: !advancedUnlocked,
    persist: false,
    onSelect: () => {
      protocolSelection = { ...protocolSelection, dungeonId, protocolId: 'imprint' };
    }
  };
  const deepModeAction: ViewAction = {
    id: 'protocol-mode-deep',
    label: difficultyNames.deep,
    disabled: !advancedUnlocked,
    persist: false,
    onSelect: () => {
      protocolSelection = { ...protocolSelection, dungeonId, protocolId: 'deep' };
    }
  };
  const cancelAction: ViewAction = {
    id: 'close-protocol-modal',
    label: '取消',
    persist: false,
    onSelect: () => {
      protocolSelection = undefined;
    }
  };
  const confirmAction: ViewAction = {
    id: 'confirm-protocol-entry',
    label: `进入${difficultyNames[protocolId]}`,
    disabled: protocolId !== 'standard' && !advancedUnlocked,
    onSelect: () => {
      state = enterDungeon(
        {
          ...state,
          preparedEquipmentHunt: undefined,
          preparedEquipmentMemoryHunt: undefined
        },
        dungeonId,
        protocolId,
        undefined,
        { flowVersion: 2 }
      );
      protocolSelection = undefined;
    }
  };
  actions.push(standardModeAction, imprintModeAction, deepModeAction, cancelAction, confirmAction);

  const modeButton = (action: ViewAction, mode: RunProtocolId) => `<button
    class="protocol-segment ${protocolId === mode ? 'selected' : ''}"
    data-action="${action.id}"
    data-protocol-mode="${mode}"
    type="button"
    role="radio"
    aria-checked="${protocolId === mode}"
    aria-pressed="${protocolId === mode}"
    aria-disabled="${action.disabled === true}"
    ${action.disabled ? 'disabled' : ''}
  ><strong>${action.label}</strong><small>${action.disabled ? '普通通关后解锁' : difficultyDescriptions[mode]}</small></button>`;
  const modifiers = selectedDefinition?.modifiers;
  const materialAmount = protocolId === 'standard' ? 1 : protocolId === 'imprint' ? 2 : 3;
  const materialReward = DUNGEON_MATERIAL_REWARDS[dungeonId];
  const materialName = ITEMS[materialReward.itemId].name;
  const unlockedEquipmentCount = getDungeonEquipmentRecipes(dungeonId).length;
  const playerPower = getPlayerPower(state);

  return `<div class="protocol-modal">
    <button class="protocol-backdrop" data-action="${cancelAction.id}" aria-label="取消副本准备"></button>
    <section class="protocol-sheet" role="dialog" aria-modal="true" aria-labelledby="protocol-sheet-title" tabindex="-1">
      <div class="protocol-sheet-header">
        <div>
          <span class="eyebrow">副本准备</span>
          <h2 id="protocol-sheet-title">${dungeon.name}</h2>
          <small>${dungeon.theme}</small>
        </div>
        ${actionButton(cancelAction, 'button secondary protocol-close')}
      </div>
      <div class="protocol-entry-metrics">
        <span><small>当前战力</small><strong>${playerPower}</strong></span>
        <span><small>推荐战力</small><strong>${dungeon.recommendedPower}</strong></span>
        <span><small>首次通关</small><strong>解锁 ${unlockedEquipmentCount} 件装备</strong></span>
      </div>
      <div class="protocol-section-heading"><span class="feature-help-label">难度${renderFeatureHelpTrigger('difficulty')}</span><strong>${difficultyNames[protocolId]}</strong></div>
      <div class="protocol-segments simplified" role="radiogroup" aria-label="副本难度">
        ${modeButton(standardModeAction, 'standard')}
        ${modeButton(imprintModeAction, 'imprint')}
        ${modeButton(deepModeAction, 'deep')}
      </div>
      <div class="protocol-selected-summary" data-selected-protocol="${protocolId}">
        <strong>${difficultyNames[protocolId]}难度</strong>
        <span>${difficultyDescriptions[protocolId]}</span>
      </div>
      <div class="protocol-pressure-grid simplified">
        <span><small>敌人强度</small><strong>${modifiers ? protocolPressureDelta(modifiers.enemyStatMultiplierPercent) : '+0%'}</strong></span>
        <span><small>陷阱伤害</small><strong>${modifiers ? protocolPressureDelta(modifiers.trapDamageMultiplierPercent) : '+0%'}</strong></span>
        <span><small>奖励点</small><strong>x${((modifiers?.clearRewardPointMultiplierPercent ?? 100) / 100).toFixed(2)}</strong></span>
        <span><small>${materialName}</small><strong>x${materialAmount}</strong></span>
      </div>
      ${renderProtocolRelicLock(actions)}
      ${LEGACY_PROTOCOL_PREPARATION_VISIBLE
        ? `${renderProtocolEquipmentMemoryHuntPreparation(dungeonId, actions)}${renderProtocolEquipmentHuntPreparation(dungeonId, actions)}${renderRouteContractPreparation(dungeonId, actions)}`
        : ''}
      <div class="protocol-modal-actions">
        ${actionButton(cancelAction, 'button secondary')}
        ${actionButton(confirmAction, 'button protocol-confirm')}
      </div>
    </section>
  </div>`;
}

function renderDungeonEntrances(actions: ViewAction[]): string {
  const playerPower = getPlayerPower(state);
  const dungeonIds = DUNGEON_ORDER.length ? DUNGEON_ORDER : (Object.keys(DUNGEONS) as DungeonId[]);
  const gates = new Map(getCampaignGates(state).map((gate) => [gate.dungeonId, gate]));
  const cards = dungeonIds
    .map((dungeonId) => {
      const dungeon = DUNGEONS[dungeonId];
      const readiness = getDungeonReadiness(state, dungeonId);
      const risk = readinessMeta[readiness];
      const gate = gates.get(dungeonId);
      const locked = gate?.status === 'locked';
      const gateClass = gate ? `gate-${gate.status}` : 'gate-available';
      const gateLabel = gate ? campaignStatusLabels[gate.status] : '已解锁';
      const protocolUnlocked = state.completedDungeonIds.includes(dungeonId);
      const materialReward = DUNGEON_MATERIAL_REWARDS[dungeonId];
      const materialName = ITEMS[materialReward.itemId].name;
      const gateNote = gate?.isNextRecommended
        ? '下一推荐'
        : gate?.availabilityKind === 'sequence_break'
          ? '越级挑战'
          : gateLabel;
      const action: ViewAction = {
        id: `open-protocol-${dungeonId}`,
        label: '准备进入',
        hint: locked ? '完成前置章节' : protocolUnlocked ? '普通 / 困难 / 炼狱' : '首次仅开放普通难度',
        disabled: locked,
        persist: false,
        onSelect: () => {
          protocolTriggerDungeonId = dungeonId;
          protocolSelection = { dungeonId, protocolId: 'standard' };
          isCharacterPanelOpen = false;
          isTaskPanelOpen = false;
          isCompanionPanelOpen = false;
          isMethodPanelOpen = false;
          isBloodlinePanelOpen = false;
          isEquipmentCommissionModalOpen = false;
        }
      };
      actions.push(action);
      const dungeonBanner = renderDungeonBanner(dungeonId);
      return `<article class="dungeon-card risk-${readiness} ${gateClass}" data-dungeon-id="${dungeonId}">
        <div class="card-topline">
          <span>Tier ${dungeon.tier}</span>
          <small class="risk-pill">${risk.label} / ${gateNote}</small>
        </div>
        ${dungeonBanner}
        <h3>${dungeon.name}</h3>
        <p>${dungeon.theme}</p>
        <div class="dungeon-metrics">
          <span><strong>${dungeon.recommendedPower}</strong> 推荐战力</span>
          <span><strong>${playerPower}</strong> 当前战力</span>
          <span><strong>${materialName}</strong> 通关材料</span>
        </div>
        <small class="mechanic-line">${gate?.requirementText ?? dungeon.recommended}</small>
        <small class="mechanic-line">${gate?.isNextRecommended ? '下一推荐：主神建议优先推进这里。' : risk.hint}</small>
        ${renderDungeonTacticalFit(dungeonId)}
        ${renderBossSealProgress(dungeonId, true)}
        ${renderDirectiveCard(dungeonId, true)}
        <div class="node-tags">
          ${dungeon.nodes.map((node) => `<span>${nodeTypeLabels[node.type]}</span>`).join('')}
        </div>
        ${actionButton(action)}
      </article>`;
    })
    .join('');

  return `<section class="panel wide-panel">
    <div class="panel-title">
      <span class="eyebrow">副本门</span>
      <h2>${CAMPAIGN_DUNGEON_COUNT}章轮回入口</h2>
    </div>
    <div class="dungeon-grid">${cards}</div>
  </section>`;
}

function isAdjacentGridNode(source: DungeonNode | undefined, target: DungeonNode): boolean {
  if (!source) return false;

  return Math.abs(source.position.x - target.position.x) + Math.abs(source.position.y - target.position.y) === 1;
}

type CurrentRouteContractProgress = {
  dungeonId: DungeonId;
  snapshot: RouteContractRunState;
  progress: RouteContractProgress;
  source: 'active' | 'settlement';
  settlement?: RouteContractSettlement;
};

function getCurrentRouteContractProgress(): CurrentRouteContractProgress | undefined {
  if (!state.run) return undefined;

  const activeSnapshot = normalizeRouteContractRunState(
    state.run.routeContractState,
    state.run.dungeonId
  );
  if (activeSnapshot) {
    const progress = getRouteContractProgress(activeSnapshot, state.run.dungeonId);
    if (progress.enabled && progress.definition) {
      return {
        dungeonId: state.run.dungeonId,
        snapshot: activeSnapshot,
        progress,
        source: 'active'
      };
    }
  }

  const settlement = normalizeSavedRouteContractSettlement(state.run.lastRouteContractSettlement);
  if (!settlement?.state) return undefined;
  const settlementDungeonId = settlement.state.dungeonId;
  const progress = getRouteContractProgress(settlement.state, settlementDungeonId);
  return progress.enabled && progress.definition
    ? {
        dungeonId: settlementDungeonId,
        snapshot: settlement.state,
        progress,
        source: 'settlement',
        settlement
      }
    : undefined;
}

function renderRouteContractStatus(): string {
  if (!state.run) return '';

  const current = getCurrentRouteContractProgress();
  const definition = current?.progress.definition;
  if (!current || !definition) return '';
  const { dungeonId, progress, snapshot } = current;
  const display = getRouteContractDisplayStatus(snapshot, dungeonId);
  const statusLabels: Record<RouteContractProgress['status'], string> = {
    disabled: '未启用',
    active: '执行中',
    secured: '已保全',
    failed: '失败',
    lost: '已错过',
    banked: '已入账'
  };
  const nextTarget = progress.nextTargetNodeId
    ? DUNGEONS[dungeonId].nodes.find((node) => node.id === progress.nextTargetNodeId)
    : undefined;
  const nextTargetVisibility = nextTarget && state.run
    ? getNodeVisibility(nextTarget, {
        currentNodeId: state.run.currentNodeId,
        clearedNodeIds: state.run.clearedNodeIds,
        nodes: DUNGEONS[dungeonId].nodes
      })
    : undefined;
  const nextObjective = nextTarget && nextTargetVisibility === 'explored'
    ? `${progress.completedTargetCount + 1} · ${nextTarget.title}`
    : nextTarget
      ? '继续探索任务线索'
    : progress.status === 'secured'
      ? '前往出口结算'
      : progress.status === 'banked'
        ? '奖励已入账'
        : display.detail;
  const rewardPoints = current.settlement?.rewardPoints ?? (
    progress.status === 'failed' || progress.status === 'lost'
      ? 0
      : progress.status === 'banked'
        ? progress.bankedRewardPoints
        : progress.potentialRewardPoints
  );

  return `<div
    class="run-route-contract-status status-${progress.status}"
    data-route-contract-status="${progress.status}"
    data-route-contract-selected="${definition.id}"
    data-route-contract-dungeon="${dungeonId}"
    data-route-contract-reward-points="${rewardPoints}"
    aria-live="polite"
  >
    <span><small class="feature-help-label">隐藏任务 · ${DUNGEONS[dungeonId].name}${renderFeatureHelpTrigger('hiddenTask')}</small><strong>${definition.name}</strong></span>
    <span><small>进度 / 状态</small><strong>${progress.completedTargetCount}/2 · ${statusLabels[progress.status]}</strong></span>
    <span><small>下一目标</small><strong>${nextObjective}</strong></span>
    <span><small>任务奖励</small><strong>+${rewardPoints} 奖励点</strong></span>
  </div>`;
}

function renderRunProtocolStatus(): string {
  const protocol = getCurrentRunProtocol(state);
  if (!protocol) return '';
  const definition = protocol.definition;

  if (state.run?.entryFlowVersion === 2) {
    const difficultyName = definition.id === 'standard' ? '普通' : definition.id === 'imprint' ? '困难' : '炼狱';
    const materialAmount = definition.id === 'standard' ? 1 : definition.id === 'imprint' ? 2 : 3;
    const materialName = ITEMS[DUNGEON_MATERIAL_REWARDS[state.run.dungeonId].itemId].name;
    return `<div class="run-protocol-status difficulty-${definition.id}" data-run-protocol="${definition.id}">
      <span><small class="feature-help-label">当前难度${renderFeatureHelpTrigger('difficulty')}</small><strong>${difficultyName}</strong></span>
      <span><small>敌人 / 陷阱</small><strong>${protocolPressureDelta(definition.modifiers.enemyStatMultiplierPercent)} / ${protocolPressureDelta(definition.modifiers.trapDamageMultiplierPercent)}</strong></span>
      <span><small>通关收益</small><strong>奖励 x${(definition.modifiers.clearRewardPointMultiplierPercent / 100).toFixed(2)} · ${materialName} x${materialAmount}</strong></span>
    </div>`;
  }

  if (definition.id === 'standard') {
    return `<div class="run-protocol-status standard" data-run-protocol="standard">
      <span><small class="feature-help-label">协议${renderFeatureHelpTrigger('difficulty')}</small><strong>${definition.name}</strong></span>
      <span><small>锚点</small><strong>无额外目标</strong></span>
      <span><small>首领破界</small><strong>不启用</strong></span>
    </div>`;
  }

  const requiredNodeIds = getRunProtocolRequiredNodeIds(definition);
  const clearedNodeIds = state.run?.clearedNodeIds ?? [];
  const bossNodeId = getBossSealStatus(state)?.definition.nodeId;
  const bossIndex = bossNodeId === undefined ? -1 : clearedNodeIds.indexOf(bossNodeId);
  const requiredNodes = requiredNodeIds.map((nodeId) => {
    const anchorIndex = clearedNodeIds.indexOf(nodeId);
    const cleared = anchorIndex >= 0;
    return {
      id: nodeId,
      title: currentDungeon()?.nodes.find((node) => node.id === nodeId)?.title ?? nodeId,
      cleared,
      completed: cleared && (bossIndex < 0 || anchorIndex < bossIndex)
    };
  });
  const breachText = protocol.bossBreachActive
    ? `已触发 ${protocolPressureDelta(definition.modifiers.unmetAnchorBossMultiplierPercent)}`
    : protocol.anchorCompleted
      ? '已解除'
      : `未触发 · 缺锚将${protocolPressureDelta(definition.modifiers.unmetAnchorBossMultiplierPercent)}`;

  if (definition.id === 'deep') {
    const anchorProgress = `${protocol.completedAnchorCount}/${protocol.requiredAnchorCount}`;
    const anchorNames = requiredNodes
      .map((node) => `${node.title} ${node.completed ? '已完成' : node.cleared ? '已失效' : '待完成'}`)
      .join(' / ');
    return `<div
      class="run-protocol-status deep ${protocol.anchorCompleted ? 'anchor-complete' : 'anchor-pending'} ${protocol.bossBreachActive ? 'breach-active' : ''}"
      data-run-protocol="deep"
      data-protocol-anchor-count="${protocol.completedAnchorCount}"
      data-protocol-anchor-progress="${anchorProgress}"
      data-protocol-anchor-complete="${protocol.anchorCompleted}"
      data-protocol-breach-active="${protocol.bossBreachActive}"
      aria-live="polite"
    >
      <span><small class="feature-help-label">深层变异${renderFeatureHelpTrigger('difficulty')}</small><strong>${definition.mutationName}</strong></span>
      <span><small>双锚进度</small><strong>${anchorProgress} · ${anchorNames}</strong></span>
      <span><small>首领破界</small><strong>${breachText}</strong></span>
    </div>`;
  }

  const requiredNode = requiredNodes[0];
  return `<div
    class="run-protocol-status imprint ${protocol.anchorCompleted ? 'anchor-complete' : 'anchor-pending'} ${protocol.bossBreachActive ? 'breach-active' : ''}"
    data-run-protocol="imprint"
    data-protocol-anchor-count="${protocol.completedAnchorCount}"
    data-protocol-anchor-complete="${protocol.anchorCompleted}"
    data-protocol-breach-active="${protocol.bossBreachActive}"
  >
    <span><small class="feature-help-label">协议${renderFeatureHelpTrigger('difficulty')}</small><strong>${definition.name}</strong></span>
    <span><small>锚点</small><strong>${protocol.anchorCompleted ? '已完成' : '未完成'} · ${requiredNode?.title ?? definition.requiredNodeId}</strong></span>
    <span><small>首领破界</small><strong>${breachText}</strong></span>
  </div>`;
}

function formatRunPressurePercent(percent: number): string {
  return percent > 0 ? `+${percent}%` : '0%';
}

function renderRunPursuitStatus(): string {
  if (!state.run) return '';

  const pursuit = getCurrentRunPursuit(state);
  const pursuitState = normalizeSavedCurrentRunPursuitState(
    state.run.pursuitState,
    state.run.dungeonId
  );
  if (pursuit.legacyDisabled || !pursuitState || !pursuit.definition || !pursuit.display || !pursuit.progress) {
    return `<div
      class="run-pursuit-status status-legacy"
      data-run-pursuit-status="legacy"
      data-run-pursuit-node="none"
      data-run-pursuit-contacts="0"
      data-run-pursuit-clears-remaining="0"
    >
      <span class="pursuit-primary"><small class="feature-help-label">破界追兵${renderFeatureHelpTrigger('pursuit')}</small><strong>本轮未启用</strong></span>
      <span><small>存档状态</small><strong>旧档不追溯生成</strong></span>
    </div>`;
  }

  const { definition, display, progress } = pursuit;
  const dungeon = DUNGEONS[pursuitState.dungeonId];
  const pursuitNode = pursuitState.nodeId
    ? dungeon.nodes.find((node) => node.id === pursuitState.nodeId)
    : undefined;
  const containmentNode = dungeon.nodes.find((node) => node.id === definition.containmentNodeId);
  const materialName = ITEMS[definition.materialId].name;
  const repelledReasonLabels: Record<NonNullable<RunPursuitState['repelledReason']>, string> = {
    stable_portal: '稳定门驱离',
    successful_exit: '出口结算驱离',
    retreat: '撤退时驱离',
    failure: '回收时驱离'
  };
  const detailByStatus: Record<RunPursuitState['status'], readonly [string, string, string, string]> = {
    disabled: ['本轮', '首通不启用', '收容', '无'],
    dormant: ['距唤醒', `${progress.clearsRemaining} 格`, '收容点', containmentNode?.title ?? definition.containmentNodeId],
    stalking: ['当前位置', pursuitNode?.title ?? pursuitState.nodeId ?? '未知', '收容点', containmentNode?.title ?? definition.containmentNodeId],
    contained: ['收容点', containmentNode?.title ?? definition.containmentNodeId, '撤离材料', `${materialName} x1`],
    fused: ['首领融合', `首领 +${definition.bossFusionPercent}%`, '材料', '不可获得'],
    repelled: ['驱离原因', pursuitState.repelledReason ? repelledReasonLabels[pursuitState.repelledReason] : '已离场', '材料', '不可获得']
  };
  const [detailLabel, detailValue, objectiveLabel, objectiveValue] = detailByStatus[pursuitState.status];

  return `<div
    class="run-pursuit-status status-${pursuitState.status}"
    data-run-pursuit-status="${pursuitState.status}"
    data-run-pursuit-node="${pursuitState.nodeId ?? 'none'}"
    data-run-pursuit-contacts="${pursuitState.contacts}"
    data-run-pursuit-clears-remaining="${progress.clearsRemaining}"
    aria-live="polite"
  >
    <span class="pursuit-primary"><small class="feature-help-label">破界追兵 · ${display.statusLabel}${renderFeatureHelpTrigger('pursuit')}</small><strong>${definition.name}</strong></span>
    <span><small>${detailLabel}</small><strong>${detailValue}</strong></span>
    <span><small>${objectiveLabel}</small><strong>${objectiveValue}</strong></span>
    <span><small>接触 / 记录</small><strong>${definition.contactDamagePercent}% · ${pursuitState.contacts} 次</strong></span>
  </div>`;
}

function renderRunPressureStatus(): string {
  const pressure = getCurrentRunPressure(state);
  const status = pressure.status;
  if (pressure.legacyDisabled || !status?.state) {
    return `<div
      class="run-pressure-status legacy"
      data-pressure-status="legacy-disabled"
      data-pressure-tier="legacy"
      data-pressure-count="0"
      data-pressure-bonus="0"
    >
      <span class="pressure-legacy"><small class="feature-help-label">侵蚀${renderFeatureHelpTrigger('pressure')}</small><strong>本轮未启用</strong></span>
    </div>${renderRunPursuitStatus()}`;
  }

  const pressureState = status.state;
  return `<div
    class="run-pressure-status tier-${status.tier}"
    data-pressure-status="active"
    data-pressure-tier="${status.tier}"
    data-pressure-count="${pressureState.clearedNodeCount}"
    data-pressure-bonus="${status.rewardBonusPercent}"
    aria-live="polite"
  >
    <span><small class="feature-help-label">侵蚀段位${renderFeatureHelpTrigger('pressure')}</small><strong>${status.label || runPressureTierLabels[status.tier]}</strong></span>
    <span><small>已清节点</small><strong>${pressureState.clearedNodeCount}</strong></span>
    <span><small>敌人 / 陷阱</small><strong>${formatRunPressurePercent(status.pressurePercent)}</strong></span>
    <span><small>出口加成</small><strong>${formatRunPressurePercent(status.rewardBonusPercent)}</strong></span>
  </div>${renderRunPursuitStatus()}`;
}

function renderRunCompanionStatus(): string {
  if (!state.run) return '';
  const snapshot = normalizeCompanionRunSnapshot(state.run.companionSnapshot);
  if (!snapshot) {
    return `<div class="run-companion-status legacy-disabled" data-run-companion="disabled">
      <span><small class="feature-help-label">本局小队${renderFeatureHelpTrigger('companion')}</small><strong>未携带同伴</strong></span>
      <span><small>助战</small><strong>本局禁用</strong></span>
    </div>`;
  }

  const definition = COMPANION_CATALOG.find(({ id }) => id === snapshot.companionId)!;
  const assistUsed = state.combat?.companionAssistUsed === true;
  return `<div class="run-companion-status ${assistUsed ? 'assist-used' : 'assist-ready'}"
    data-run-companion="${snapshot.companionId}"
    data-run-companion-rank="${snapshot.rank}"
    data-companion-assist-used="${assistUsed}">
    <span><small class="feature-help-label">入场冻结同伴${renderFeatureHelpTrigger('companion')}</small><strong>${definition.name} · R${snapshot.rank}</strong></span>
    <span><small>${definition.assistName}</small><strong>${formatCompanionAssist(snapshot)}</strong></span>
  </div>`;
}

function renderRunMethodStatus(): string {
  if (!state.run) return '';
  const snapshots = getCurrentRunMethodSnapshots(state);
  const currentSnapshots = normalizeMethodRunSnapshots(state.run.methodSnapshots);
  if (snapshots.length === 0) {
    const currentEmpty = currentSnapshots !== undefined;
    return `<div class="run-method-status legacy-disabled" data-run-method="disabled" data-run-method-rank="0">
      <span><small class="feature-help-label">本局功法库${renderFeatureHelpTrigger('method')}</small><strong>${currentEmpty ? '入场时未学会功法' : '旧副本快照缺失，返回后重进可刷新'}</strong></span>
    </div>`;
  }
  const roster = snapshots.map((snapshot) => `${METHODS[snapshot.methodId].name} R${snapshot.rank}`).join(' / ');
  const techniques = snapshots.map((snapshot) => getMethodTechniqueDefinition(snapshot.methodId)?.name).filter(Boolean).join(' / ');
  return `<div class="run-method-status" data-run-method="library" data-run-method-count="${snapshots.length}">
    <span><small class="feature-help-label">入场功法库${renderFeatureHelpTrigger('method')}</small><strong>${snapshots.length} 门 · 全部可用</strong><b>${roster}</b></span>
    <span><small>战技</small><strong>${techniques}</strong><b>每门每场可发动一次</b></span>
  </div>`;
}

type EquipmentHuntDisplayState =
  | 'seeking'
  | 'locked'
  | 'crossed'
  | 'order-expired'
  | 'offering'
  | 'selected'
  | 'abandoned';

function wasEquipmentHuntClueClearedBeforeElite(
  status: ReturnType<typeof getCurrentEquipmentHuntStatus>
): boolean {
  if (!state.run || !status.dungeonId) return false;

  const dungeon = DUNGEONS[status.dungeonId];
  const clueNodeIds = new Set(status.clueNodes.map((clue) => clue.nodeId));
  const eliteMonsterId = DUNGEON_ELITE_MONSTERS[status.dungeonId];
  const eliteNodeIds = new Set(
    dungeon.nodes.filter((node) => node.monsterId === eliteMonsterId).map((node) => node.id)
  );
  const clueIndex = state.run.clearedNodeIds.findIndex((nodeId) => clueNodeIds.has(nodeId));
  const eliteIndex = state.run.clearedNodeIds.findIndex((nodeId) => eliteNodeIds.has(nodeId));

  // Cleared-node order is the durable distinction after the one-shot offer itself is gone.
  return clueIndex >= 0 && eliteIndex >= 0 && clueIndex < eliteIndex;
}

function getEquipmentHuntDisplayState(
  status: ReturnType<typeof getCurrentEquipmentHuntStatus>
): { state: EquipmentHuntDisplayState; label: string; detail: string; clue: string } {
  if (status.selected) {
    return { state: 'selected', label: '已选择', detail: '通关后入架', clue: '已锁定' };
  }
  if (status.offer) {
    return { state: 'offering', label: '报价中', detail: '目标进入三选一', clue: '已锁定' };
  }
  if (status.crossed) {
    return { state: 'crossed', label: '跨门失效', detail: '本局追猎结束', clue: '已失效' };
  }
  if (status.passed) {
    return wasEquipmentHuntClueClearedBeforeElite(status)
      ? { state: 'abandoned', label: '已放弃', detail: '目标未选取', clue: '已锁定' }
      : { state: 'order-expired', label: '错序失效', detail: '精英早于线索', clue: '已失效' };
  }
  if (status.qualified) {
    return { state: 'locked', label: '已锁定', detail: '等待首个精英', clue: '已锁定' };
  }

  return { state: 'seeking', label: '追踪中', detail: '两处任选其一', clue: '线索 0/1' };
}

function renderRunEquipmentHuntStatus(): string {
  const status = getCurrentEquipmentHuntStatus(state);
  if (!status.enabled || !status.targetEquipmentId) return '';

  const display = getEquipmentHuntDisplayState(status);
  return `<div
    class="run-equipment-hunt-status state-${display.state}"
    data-equipment-hunt-state="${display.state}"
    data-equipment-hunt-target="${status.targetEquipmentId}"
    aria-live="polite"
  >
    <span><small class="feature-help-label">装备追猎${renderFeatureHelpTrigger('equipmentHunt')}</small><strong>${EQUIPMENT[status.targetEquipmentId].name}</strong></span>
    <span><small>线索</small><strong>${display.clue}</strong></span>
    <span><small>状态</small><strong>${display.label}</strong><b>${display.detail}</b></span>
  </div>`;
}

function renderRunEquipmentMemoryHuntStatus(): string {
  const current = getCurrentEquipmentMemoryHuntStatus(state);
  const hunt = current.state;
  const progress = current.progress;
  const display = current.display;
  const definition = current.definition;
  if (!current.enabled || !hunt || !definition || !progress.equipmentId || !progress.attunementId) return '';
  if (hunt.status === 'active' && hunt.dungeonId !== state.run?.dungeonId) return '';
  const status = progress.status === 'active'
    ? `${progress.completedConditionCount}/${progress.totalConditionCount}`
    : progress.status;
  const nodeTitle = DUNGEONS[hunt.dungeonId].nodes.find((node) => node.id === hunt.nodeId)?.title ?? hunt.nodeId;
  const eventTitle = getEquipmentMemoryEventTitle(hunt.dungeonId, hunt.eventId);
  const nextTarget = progress.status === 'active'
    ? !progress.nodeCleared
      ? `节点 · ${nodeTitle}`
      : !progress.eventSucceeded
        ? `事件 · ${eventTitle}`
        : '前往出口结算'
    : progress.status === 'secured'
      ? '前往出口结算'
      : progress.status === 'banked'
        ? '已写入装备记忆库'
        : display.detail;

  return `<div
    class="run-equipment-memory-hunt-status status-${progress.status}"
    data-equipment-memory-id="${definition.id}"
    data-equipment-memory-equipment="${progress.equipmentId}"
    data-equipment-memory-status="${status}"
    aria-live="polite"
  >
    <span><small class="feature-help-label">装备记忆 · 目标装备${renderFeatureHelpTrigger('equipmentMemory')}</small><strong>${current.equipment?.name ?? EQUIPMENT[progress.equipmentId].name}</strong></span>
    <span><small>冻结铭刻</small><strong>${current.attunement?.name ?? getEquipmentMemoryAttunementName(progress.equipmentId, progress.attunementId)}</strong></span>
    <span><small>记忆</small><strong>${definition.name}</strong></span>
    <span><small>双信号</small><strong>${status}</strong></span>
    <span><small>下一目标</small><strong>${nextTarget}</strong></span>
  </div>`;
}

function renderEquipmentMemoryCombatStatus(): string {
  if (!state.run || !state.combat) return '';
  const current = getCurrentEquipmentMemoryCombatStatus(state);
  const memoryState = current.state;
  const definition = current.definition;
  if (!current.enabled || !memoryState || !definition || memoryState.dungeonId !== state.run.dungeonId) return '';

  const sourceNames = current.matchingEquipmentIds.map((equipmentId) => EQUIPMENT[equipmentId].name).join(' / ');
  const focusState = current.restored
    ? '已恢复'
    : current.overflowStored
      ? '已储存'
      : '空';

  return `<div
    class="equipment-memory-combat-status state-${memoryState.restored ? 'restored' : memoryState.overflowFocus ? 'stored' : 'empty'}"
    data-equipment-memory-id="${definition.id}"
    data-equipment-memory-status="active"
    data-equipment-memory-combat-focus="${focusState}"
  >
    <span><small>生效装备记忆</small><strong>${current.activeName ?? definition.name}</strong><b>${sourceNames}</b></span>
    <span><small>回忆战意</small><strong>${focusState}</strong></span>
  </div>`;
}

function formatLawPercent(label: string, value: number): string | undefined {
  if (value === 0) return undefined;
  return `${label} ${value > 0 ? '+' : ''}${value}%`;
}

function formatDungeonLawModifiers(modifiers: DungeonLawModifiers): string {
  const parts = [
    formatLawPercent('敌方全属性', modifiers.encounter.allStatsPercent),
    formatLawPercent('敌方防御', modifiers.encounter.defensePercent),
    formatLawPercent('敌方术强', modifiers.encounter.artPowerPercent),
    formatLawPercent('陷阱伤害', modifiers.trap.damagePercent),
    formatLawPercent('陷阱难度', modifiers.trap.dcPercent),
    formatLawPercent('治疗', modifiers.healingPercent),
    formatLawPercent('力伤', modifiers.outgoingDamage.forcePercent),
    formatLawPercent('术伤', modifiers.outgoingDamage.artPercent),
    formatLawPercent('防御效果', modifiers.guardEffectPercent)
  ].filter((part): part is string => Boolean(part));

  return parts.length ? parts.join(' / ') : '当前无数值修正';
}

function getDungeonLawTarget(law: NonNullable<ReturnType<typeof getCurrentDungeonLaw>>): string {
  switch (law.state.law.kind) {
    case 'demon_tower':
      return '维持雾压 0/3，恢复地标可降压';
    case 'metro_abyss':
      return '校时回到退潮';
    case 'starfall_mine':
      return '利用重力闸切换极向';
    case 'rust_hospital':
      return '将污染降至 0/4';
    case 'ash_arena':
      return '以力、术、守三种开局改判';
    case 'dream_archive':
      return '通过索引恢复全部封存';
    case 'void_citadel':
      return '让力、术、守开局分布均衡';
    case 'temporal_observatory':
      return '校准过去与未来两枚时序锚点';
    case 'causal_clearinghouse':
      return '完成双向核验，并在终审前处理因果债';
    case 'entropy_ark':
      return '指定三座航向台，并把熵位维持在可控航区';
    case 'mirror_cycle_city':
      return '落定三次相位抉择，校准现实与镜像双锚并削减镜王镜壳';
    case 'redaction_scriptorium':
      return '裁定肉身、记忆与归返三份终稿条款，权衡可选路线与首领增幅';
    case 'legacy_auction_court':
      return '落定武力、守备、术法与归返四件遗产拍品，权衡筹码、库房与首领继承';
    case 'genesis_vault':
      return '依序完成三次基因拼接，并在首领战前冻结原型序列';
    case 'silent_broadcast_tower':
      return '落定三座广播中继，并在末频道播音主前控制噪声';
    case 'lost_shelter':
      return '护送幸存者通过三处检查点，并在失联总控前保住生命';
    case 'false_testimony_court':
      return '揭示三份证据、排除伪证嫌疑人，并在终审前完成原始裁决或翻案';
    case 'combat_replay_stage':
      return '完成甲乙丙三段战斗母带录制，锁定复演路线并冻结终剪快照';
    case 'panopticon_city':
      return '激活三座盲区中继，锁定唯一监察路线并冻结万目快照';
  }
}

function renderMirrorCityMapStatus(): string {
  const law = getCurrentDungeonLaw(state);
  const status = getMirrorPhaseStatus();
  if (!law || law.state.law.kind !== 'mirror_cycle_city' || !status) return '';

  const shellStatus = getMirrorCityShellStatus(law.state);
  const phaseLabel = status.currentPhase === 'real' ? '现实' : '镜像';
  const anchorCount = Number(status.anchors.real) + Number(status.anchors.mirror);
  const projectedShells = Math.max(
    0,
    2 - anchorCount - Number(law.state.law.entryPassives.homecomingPrism)
  );
  const shellValue = shellStatus.bossStarted ? shellStatus.remainingShells : projectedShells;
  const shellLabel = shellStatus.bossStarted ? '剩余镜壳' : '预计镜壳';
  const phaseEffect = status.currentPhase === 'real'
    ? `力伤 +12% · 术伤 ${law.state.law.entryPassives.parallaxVisor ? '无惩罚' : '-6%'}`
    : `术伤 +12% · 力伤 ${law.state.law.entryPassives.parallaxVisor ? '无惩罚' : '-6%'}`;

  return `<div
    class="mirror-city-map-status phase-${status.currentPhase}"
    data-mirror-phase-status="${status.pending ? 'pending' : shellStatus.bossStarted ? 'boss' : 'active'}"
    data-mirror-phase-value="${status.currentPhase}"
    data-mirror-phase-node="${status.pendingPhaseNodeId ?? ''}"
    data-mirror-phase-choice="${status.pending ? 'pending' : 'resolved'}"
    data-mirror-anchor-count="${anchorCount}"
    data-mirror-choice-count="${status.resolvedChoiceCount}"
    data-mirror-shell-count="${shellValue}"
    aria-live="polite"
  >
    <span><small>当前相位</small><strong>${phaseLabel}</strong></span>
    <span><small>相位效果</small><strong>${phaseEffect}</strong></span>
    <span><small>锚点</small><strong>${anchorCount}/2 · 现实${status.anchors.real ? '已亮' : '未亮'} / 镜像${status.anchors.mirror ? '已亮' : '未亮'}</strong></span>
    <span><small>抉择</small><strong>${status.resolvedChoiceCount}/3${status.allChoicesResolved ? ' · 已完成' : ''}</strong></span>
    <span><small>${shellLabel}</small><strong>${shellValue}${shellStatus.bossStarted ? `/${shellStatus.totalShells}` : ' 枚'}</strong></span>
  </div>`;
}

function formatRedactionBossEffect(effect: RedactionClauseStatus['projectedBossEffects']['sealed']): string {
  const parts = [
    formatLawPercent('防御', effect.defensePercent),
    formatLawPercent('术强', effect.artPowerPercent),
    formatLawPercent('治疗', effect.healingPercent),
    formatLawPercent('防御效果', effect.guardEffectPercent)
  ].filter((part): part is string => Boolean(part));
  return parts.length ? parts.join(' / ') : '无条款增幅';
}

function renderRedactionMapStatus(): string {
  const law = getCurrentDungeonLaw(state);
  const status = getRedactionClauseStatus();
  if (!law || law.state.law.kind !== 'redaction_scriptorium' || !status) return '';

  const frozen = status.bossClauseSnapshot !== null;
  const statusValue = status.pending ? 'pending' : frozen ? 'frozen' : status.resolvedCount === 3 ? 'resolved' : 'active';
  const pendingLabels: Record<string, string> = {
    body_clause_desk: '肉身条款',
    memory_clause_desk: '记忆条款',
    return_clause_desk: '归返条款'
  };
  const passives = law.state.law.entryPassives;
  const passiveItems = [
    ['redlineEdge', '朱批断章刃', passives.redlineEdge],
    ['palimpsestMantle', '覆页披甲', passives.palimpsestMantle],
    ['finalProofSeal', '终校印玺', passives.finalProofSeal]
  ] as const;

  return `<div
    class="redaction-map-status state-${statusValue}"
    data-redaction-clause-status="${statusValue}"
    data-redaction-clause-value="${status.resolvedCount}"
    data-redaction-clause-node="${status.pendingClauseNodeId ?? ''}"
    data-redaction-clause-choice="${status.pending ? 'pending' : frozen ? 'frozen' : 'resolved'}"
    aria-live="polite"
  >
    <span><small>裁定进度</small><strong>${status.resolvedCount}/3</strong></span>
    <span><small>核准 / 删去</small><strong>${status.certifiedCount} / ${status.redactedCount}</strong></span>
    <span><small>当前条款</small><strong>${status.pendingClauseNodeId ? `${pendingLabels[status.pendingClauseNodeId]}待定` : frozen ? '首领终稿已冻结' : status.resolvedCount === 3 ? '三份条款已定' : '继续勘校'}</strong></span>
    <span><small>${frozen ? '冻结' : '预计'}封印态</small><strong>${formatRedactionBossEffect(status.projectedBossEffects.sealed)}</strong></span>
    <span><small>${frozen ? '冻结' : '预计'}觉醒态</small><strong>${formatRedactionBossEffect(status.projectedBossEffects.awakened)}</strong></span>
    <span class="redaction-frozen-passives"><small>入场冻结被动</small><strong>${passiveItems.map(([id, label, active]) => `<b data-redaction-entry-passive="${id}" data-frozen="${active}">${label}${active ? '已冻结' : '未冻结'}</b>`).join('')}</strong></span>
  </div>`;
}

function formatAuctionProjection(modifiers: DungeonLawModifiers, side: 'player' | 'boss'): string {
  const parts = side === 'player'
    ? [
        formatLawPercent('治疗', modifiers.healingPercent),
        formatLawPercent('力伤', modifiers.outgoingDamage.forcePercent),
        formatLawPercent('术伤', modifiers.outgoingDamage.artPercent),
        formatLawPercent('防御效果', modifiers.guardEffectPercent)
      ]
    : [
        formatLawPercent('全属性', modifiers.encounter.allStatsPercent),
        formatLawPercent('防御', modifiers.encounter.defensePercent),
        formatLawPercent('术强', modifiers.encounter.artPowerPercent)
      ];
  const visible = parts.filter((part): part is string => Boolean(part));
  return visible.length ? visible.join(' / ') : '无拍品效果';
}

const auctionLotUi = {
  force_lot_dais: { label: '武力拍品', area: '武力角库', passiveId: 'legacyGavel', gear: '亡队落槌', effect: '力伤' },
  guard_lot_dais: { label: '守备拍品', area: '守备角库', passiveId: 'escrowPlate', gear: '托管契甲', effect: '防御效果' },
  art_lot_dais: { label: '术法拍品', area: '术法角库', passiveId: 'anonymousVeil', gear: '无名竞标面', effect: '术伤' },
  return_lot_dais: { label: '归返拍品', area: '归返角库', passiveId: 'finalLotBell', gear: '终场号钟', effect: '治疗' }
} as const;

function renderAuctionMapStatus(): string {
  const law = getCurrentDungeonLaw(state);
  const status = getAuctionLotStatus();
  if (!law || law.state.law.kind !== 'legacy_auction_court' || !status) return '';

  const frozen = status.bossLotSnapshot !== null;
  const statusValue = status.pending ? 'pending' : frozen ? 'frozen' : status.allLotsResolved ? 'resolved' : 'active';
  const pendingMeta = status.pendingLotNodeId ? auctionLotUi[status.pendingLotNodeId] : undefined;
  const passives = law.state.law.entryPassives;
  const passiveItems = Object.values(auctionLotUi);

  return `<div
    class="auction-map-status state-${statusValue}"
    data-auction-lot-status="${statusValue}"
    data-auction-lot-value="${status.resolvedCount}"
    data-auction-lot-node="${status.pendingLotNodeId ?? ''}"
    data-auction-lot-choice="${status.pending ? 'pending' : frozen ? 'frozen' : 'resolved'}"
    aria-live="polite"
  >
    <span><small>遗产筹码</small><strong>${status.availableScrip}</strong></span>
    <span><small>拍品进度</small><strong>${status.resolvedCount}/4</strong></span>
    <span><small>竞得 / 焚契 / 放弃</small><strong>${status.bidCount} / ${status.burnCount} / ${status.foldCount}</strong></span>
    <span><small>当前拍品</small><strong>${pendingMeta ? `${pendingMeta.label}待定` : frozen ? '首领拍品已冻结' : status.allLotsResolved ? '四件拍品已定' : '继续竞标'}</strong></span>
    <span><small>${frozen ? '冻结' : '预计'}封印态玩家</small><strong>${formatAuctionProjection(status.projectedBossModifiers.sealed, 'player')}</strong></span>
    <span><small>${frozen ? '冻结' : '预计'}封印态首领</small><strong>${formatAuctionProjection(status.projectedBossModifiers.sealed, 'boss')}</strong></span>
    <span><small>${frozen ? '冻结' : '预计'}觉醒态玩家</small><strong>${formatAuctionProjection(status.projectedBossModifiers.awakened, 'player')}</strong></span>
    <span><small>${frozen ? '冻结' : '预计'}觉醒态首领</small><strong>${formatAuctionProjection(status.projectedBossModifiers.awakened, 'boss')}</strong></span>
    <span class="auction-frozen-passives"><small>入场冻结匹配装备</small><strong>${passiveItems.map(({ passiveId, gear }) => `<b data-auction-entry-passive="${passiveId}" data-frozen="${passives[passiveId]}">${gear}${passives[passiveId] ? '已冻结' : '未冻结'}</b>`).join('')}</strong></span>
  </div>`;
}

const genesisGeneLabels: Record<GenesisGene, string> = {
  force: '武力',
  art: '术法',
  guard: '守势',
  renewal: '归返'
};

function getGenesisStatus(): GenesisSpliceStatus | undefined {
  return getCurrentGenesisSpliceStatus(state);
}

function renderGenesisMapStatus(): string {
  const status = getGenesisStatus();
  if (!status) return '';
  const slots = Array.from({ length: 3 }, (_, index) => {
    const gene = status.spliceSequence[index];
    return `<b data-genesis-slot="${index + 1}" data-gene="${gene ?? 'empty'}">${index + 1}. ${gene ? genesisGeneLabels[gene] : '待拼接'}</b>`;
  }).join('');
  const bossText = status.bossGenomeSnapshot
    ? status.bossGenomeSnapshot.map((gene) => genesisGeneLabels[gene]).join(' / ')
    : '未冻结';

  return `<div class="genesis-map-status ${status.bossGenomeSnapshot ? 'frozen' : status.pending ? 'pending' : 'active'}"
    data-genesis-status="${status.pending ? 'pending' : status.bossGenomeSnapshot ? 'frozen' : status.allResolved ? 'resolved' : 'active'}"
    data-genesis-serum="${status.availableGenesisSerum}"
    data-genesis-unique="${status.uniqueCount}"
    data-genesis-boss-frozen="${Boolean(status.bossGenomeSnapshot)}"
    aria-live="polite">
    <span><small>本局原型血清</small><strong>${status.availableGenesisSerum}</strong></span>
    <span class="genesis-sequence"><small>有序序列 · unique ${status.uniqueCount}</small><strong>${slots}</strong></span>
    <span><small>Boss 基因冻结</small><strong>${bossText}</strong></span>
  </div>`;
}

const broadcastRelayUi = {
  north_relay_console: '北段中继',
  central_relay_console: '中央中继',
  south_relay_console: '南段中继'
} as const;

const broadcastPassiveUi = {
  hushblade: '断频长刃',
  deadAirHeadset: '死频耳罩',
  anechoicMantle: '消声披甲',
  lastChannelBeacon: '末路断播器'
} as const;

function getBroadcastStatus(): BroadcastRelayStatus | undefined {
  return getCurrentBroadcastRelayStatus(state);
}

function renderBroadcastMapStatus(): string {
  const status = getBroadcastStatus();
  if (!status) return '';

  const relaySequence = Object.entries(broadcastRelayUi).map(([nodeId, label]) => {
    const choice = status.resolvedRelayChoices[nodeId as keyof typeof status.resolvedRelayChoices];
    const text = choice === 'mute' ? '静默' : choice === 'broadcast' ? '转播' : '待定';
    return `<b data-broadcast-relay="${nodeId}" data-relay-choice="${choice ?? 'pending'}">${label} ${text}</b>`;
  }).join('');
  const passives = Object.entries(broadcastPassiveUi).map(([passiveId, label]) => {
    const active = status.entryPassives[passiveId as keyof typeof status.entryPassives];
    const reason = status.entryPassiveReasons[passiveId as keyof typeof status.entryPassiveReasons];
    return `<b data-broadcast-entry-passive="${passiveId}" data-frozen="${active}" title="${reason}">${label}${active ? '已冻结' : '未冻结'}</b>`;
  }).join('');
  const stateValue = status.bossNoiseSnapshot !== null
    ? 'frozen'
    : status.pending
      ? 'pending'
      : status.allRelaysResolved
        ? 'resolved'
        : 'active';

  return `<div class="broadcast-map-status ${stateValue}"
    data-broadcast-status="${stateValue}"
    data-broadcast-noise="${status.noise}"
    data-broadcast-resolved="${status.resolvedCount}"
    data-broadcast-mute-count="${status.muteCount}"
    data-broadcast-count="${status.broadcastCount}"
    data-broadcast-boss-snapshot="${status.bossNoiseSnapshot ?? 'none'}"
    aria-live="polite">
    <span><small>noise</small><strong>${status.noise}/6</strong></span>
    <span class="broadcast-relay-sequence"><small>三座中继</small><strong>${relaySequence}</strong></span>
    <span><small>静默 / 转播</small><strong>${status.muteCount} / ${status.broadcastCount}</strong></span>
    <span class="broadcast-entry-passives"><small>入场冻结被动</small><strong>${passives}</strong></span>
    <span><small>Boss snapshot</small><strong>${status.bossNoiseSnapshot === null ? '未冻结' : `noise ${status.bossNoiseSnapshot}/6`}</strong></span>
  </div>`;
}

const shelterCheckpointUi = {
  north_checkpoint: '北站检查点',
  central_checkpoint: '中央检查点',
  south_checkpoint: '南站检查点'
} as const;

const shelterEntryGearUi = {
  rescueCarbine: { equipmentId: 'rescue_carbine', label: '救援卡宾枪' },
  triageVisor: { equipmentId: 'triage_visor', label: '分诊目镜' },
  evacuationPlate: { equipmentId: 'evacuation_plate', label: '撤离护甲' },
  blackboxBeacon: { equipmentId: 'blackbox_beacon', label: '黑匣信标' }
} as const;

function getShelterStatus(): EscortCheckpointStatus | undefined {
  return getCurrentEscortCheckpointStatus(state);
}

function signedValue(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}`;
}

function getShelterCompanionUsed(status: EscortCheckpointStatus): boolean {
  if (status.entryCompanion.id === 'qin_che') return status.firstHazardGuardUsed;
  if (status.entryCompanion.id === 'zhou_yingxue') return status.companionAnalysisUsed;
  if (status.entryCompanion.id === 'lu_guanlan') return status.companionTriageUsed;
  return false;
}

function renderShelterMapStatus(): string {
  const status = getShelterStatus();
  if (!status) return '';

  const sequence = Object.entries(shelterCheckpointUi).map(([nodeId, label]) => {
    const choice = status.resolvedCheckpointChoices[nodeId as keyof typeof status.resolvedCheckpointChoices];
    const text = choice === 'treat' ? '治疗' : choice === 'push' ? '强推' : '待定';
    return `<b data-shelter-checkpoint="${nodeId}" data-checkpoint-choice="${choice ?? 'pending'}">${label} ${text}</b>`;
  }).join('');
  const gear = Object.entries(shelterEntryGearUi).map(([gearId, meta]) => {
    const frozen = status.entryGear[gearId as keyof typeof status.entryGear];
    return `<b data-shelter-entry-gear="${gearId}" data-equipment-id="${meta.equipmentId}" data-frozen="${frozen}">${meta.label}${frozen ? '已冻结' : '未冻结'}</b>`;
  }).join('');
  const companionId = status.entryCompanion.id ?? 'none';
  const companionUsed = getShelterCompanionUsed(status);
  const stateValue = status.bossSurvivorSnapshot !== null
    ? 'frozen'
    : status.pending
      ? 'pending'
      : status.allCheckpointsResolved
        ? 'resolved'
        : 'active';

  return `<div class="shelter-map-status ${stateValue}"
    data-shelter-status="${stateValue}"
    data-survivor-hp="${status.survivorHp}"
    data-shelter-resolved="${status.resolvedCount}"
    data-shelter-treat-count="${status.treatCount}"
    data-shelter-push-count="${status.pushCount}"
    data-shelter-run-pills="${status.availableHealingPills}"
    data-shelter-boss-snapshot="${status.bossSurvivorSnapshot ?? 'none'}"
    aria-live="polite">
    <span><small>幸存者 HP</small><strong>${status.survivorHp}/100</strong></span>
    <span class="shelter-checkpoint-sequence"><small>三处检查点 · 治疗 ${status.treatCount} / 强推 ${status.pushCount}</small><strong>${sequence}</strong></span>
    <span class="shelter-choice-projection"><small>当前选择</small><strong>治疗 HP ${signedValue(status.choices.treat.survivorHpDelta)} / 止血丹 ${status.choices.treat.healingPillCost} · 强推 HP ${signedValue(status.choices.push.survivorHpDelta)} / RP +${status.choices.push.bonusRewardPoints}</strong></span>
    <span class="shelter-entry-gear"><small>入场冻结装备</small><strong>${gear}</strong></span>
    <span><small>同伴职责 / used</small><strong data-shelter-companion-role="${companionId}" data-companion-rank="${status.entryCompanion.rank}" data-used="${companionUsed}">${status.companionRole} · ${companionUsed ? '已用' : '未用'}</strong></span>
    <span><small>Boss snapshot</small><strong>${status.bossSurvivorSnapshot === null ? '未冻结' : `幸存者 HP ${status.bossSurvivorSnapshot}/100`}</strong></span>
  </div>`;
}

const verdictEvidenceLabels = {
  voice_evidence: '声纹',
  timeline_evidence: '时间线',
  residue_evidence: '残留物'
} as const;

const verdictSuspectLabels: Record<FalseTestimonySuspect, string> = {
  records_keeper: '卷宗保管员',
  field_medic: '战地医师',
  security_chief: '安保主管',
  route_surveyor: '路线测绘员'
};

const verdictEntryGearUi = {
  crossExaminerSabre: { equipmentId: 'cross_examiner_sabre', label: '诘问裁刃' },
  forensicVisor: { equipmentId: 'forensic_visor', label: '溯证目镜' },
  custodyShell: { equipmentId: 'custody_shell', label: '封证护甲' },
  appealSeal: { equipmentId: 'appeal_seal', label: '翻案印玺' }
} as const;

function renderVerdictMapStatus(): string {
  const status = getCurrentVerdictStatus(state);
  if (!status) return '';

  const evidence = status.evidence.map((item) => {
    const evidenceState = item.trusted ? 'trusted' : item.contaminated ? 'contaminated' : item.revealed ? 'revealed' : 'hidden';
    const text = item.trusted ? '净证' : item.contaminated ? '污染' : item.revealed ? '已揭示' : '未揭示';
    return `<b data-verdict-evidence="${item.id}" data-evidence-state="${evidenceState}">${verdictEvidenceLabels[item.id]} ${text}</b>`;
  }).join('');
  const gear = Object.entries(verdictEntryGearUi).map(([gearId, meta]) => {
    const frozen = status.entryGear[gearId as keyof typeof status.entryGear];
    return `<b data-verdict-entry-gear="${gearId}" data-equipment-id="${meta.equipmentId}" data-frozen="${frozen}">${meta.label}${frozen ? '已冻结' : '未冻结'}</b>`;
  }).join('');
  const eliminated = status.eliminatedSuspects.length
    ? status.eliminatedSuspects.map((suspect) => verdictSuspectLabels[suspect]).join(' / ')
    : '暂无';
  const verdict = status.accusedSuspect === null
    ? '未裁决'
    : `${verdictSuspectLabels[status.accusedSuspect]} · ${status.accusationCorrect ? '正确' : '错误'} · 冻结净证 ${status.accusationTrustedCount}`;
  const appeal = status.appealUsed
    ? '翻案已用'
    : status.appealEligible
      ? '翻案资格可用'
      : '维持原判';
  const snapshot = status.bossVerdictSnapshot;
  const snapshotText = snapshot
    ? `${verdictSuspectLabels[snapshot.suspect]} · ${snapshot.correct ? '正确' : '错误'} · 净证 ${snapshot.trustedCount} · ${snapshot.appealed ? '翻案' : '原判'}`
    : '未冻结';
  const stateValue = snapshot
    ? 'frozen'
    : status.pendingVerdictNodeId
      ? 'pending'
      : status.accusedSuspect
        ? 'resolved'
        : 'active';

  return `<div class="verdict-map-status ${stateValue}"
    data-verdict-status="${stateValue}"
    data-verdict-pending="${status.pendingVerdictNodeId ?? 'none'}"
    data-verdict-trusted-count="${status.currentTrustedCount}"
    data-verdict-accusation-trusted-count="${status.accusationTrustedCount}"
    data-verdict-accusation-correct="${status.accusationCorrect ?? 'none'}"
    data-verdict-appeal-eligible="${status.appealEligible}"
    data-verdict-appeal-used="${status.appealUsed}"
    data-verdict-custody-used="${status.custodyProtectionUsed}"
    data-verdict-boss-snapshot="${snapshot ? `${snapshot.suspect}:${snapshot.trustedCount}:${snapshot.appealed}` : 'none'}"
    aria-live="polite">
    <span class="verdict-evidence"><small>三份证据 · 净证 ${status.currentTrustedCount}/3</small><strong>${evidence}</strong></span>
    <span><small>已排除者</small><strong data-verdict-eliminated="${status.eliminatedSuspects.join(',')}">${eliminated}</strong></span>
    <span><small>当前裁决</small><strong>${verdict}</strong></span>
    <span class="verdict-entry-gear"><small>入场冻结装备</small><strong>${gear}</strong></span>
    <span><small>封证护甲 / 裁决奖励</small><strong>${status.custodyProtectionUsed ? '首次保护已用' : '首次保护未用'} · RP +${status.projectedAccusationRewardPoints}</strong></span>
    <span><small>翻案 / Boss snapshot</small><strong>${appeal} · ${snapshotText}</strong></span>
  </div>`;
}

const combatReplayTakeUi = {
  take_alpha: '甲段',
  take_beta: '乙段',
  take_gamma: '丙段'
} as const;

const combatReplayActionLabels = {
  attack: '攻击',
  art: '战技',
  guard: '防御'
} as const;

const combatReplayRouteLabels: Record<CombatReplayRoute, string> = {
  sequence: '顺序剪辑',
  burst: '爆发蒙太奇',
  afterbeat: '余拍回放'
};

const combatReplayEntryGearUi = {
  frameEngraver: { equipmentId: 'frame_engraver', label: '定帧刻刀' },
  cueVisor: { equipmentId: 'cue_visor', label: '起拍目镜' },
  bufferPlate: { equipmentId: 'buffer_plate', label: '缓冲叠甲' },
  thawMetronome: { equipmentId: 'thaw_metronome', label: '解冻节拍器' }
} as const;

function getCombatReplayUiState() {
  if (state.run?.dungeonId !== 'combat_replay_stage') return undefined;
  const runReplay = normalizeCombatReplayRunState(state.run.combatReplayState);
  const lawState = normalizeDungeonLawState(state.run.lawState, 'combat_replay_stage');
  const lawStatus = getCombatReplayStatus(lawState);
  const combatReplay = normalizeCombatReplayCombatState(state.combat?.combatReplayState);
  const recordings = (Object.keys(combatReplayTakeUi) as Array<keyof typeof combatReplayTakeUi>).map((takeId, index) => {
    const runRecording = runReplay?.recordings[takeId];
    const lawTake = lawStatus.takes[index];
    return runRecording ?? (lawTake ? { action: lawTake.action, observedValue: lawTake.observedValue } : undefined);
  });
  return {
    recordings,
    recordedCount: recordings.filter(Boolean).length,
    route: runReplay?.route ?? lawStatus.route ?? undefined,
    bossSnapshot: lawStatus.bossSnapshot,
    entryGear: runReplay?.entryGear ?? lawStatus.entryGear,
    cursor: combatReplay?.cursor ?? 0,
    buffer: combatReplay?.buffer ?? 0,
    remainingBufferHits: combatReplay?.remainingBufferHits ?? 0,
    pendingTakeId: combatReplay?.pending?.takeId
  };
}

function renderCombatReplayMapStatus(): string {
  const replay = getCombatReplayUiState();
  if (!replay) return '';
  const takeIds = Object.keys(combatReplayTakeUi) as Array<keyof typeof combatReplayTakeUi>;
  const takes = takeIds.map((takeId, index) => {
    const recording = replay.recordings[index];
    return `<b data-replay-take="${takeId}" data-replay-action="${recording?.action ?? 'none'}" data-replay-observed-value="${recording?.observedValue ?? 'none'}">${combatReplayTakeUi[takeId]} ${recording ? `${combatReplayActionLabels[recording.action]} · 实录 ${recording.observedValue}` : '待录制'}</b>`;
  }).join('');
  const gear = Object.entries(combatReplayEntryGearUi).map(([gearId, meta]) => {
    const frozen = replay.entryGear[gearId as keyof typeof replay.entryGear];
    return `<b data-replay-entry-gear="${gearId}" data-equipment-id="${meta.equipmentId}" data-frozen="${frozen}">${meta.label}${frozen ? '已冻结' : '未冻结'}</b>`;
  }).join('');
  const snapshotText = replay.bossSnapshot
    ? `${combatReplayRouteLabels[replay.bossSnapshot.route]} · 三段母带已冻结`
    : '未冻结';
  const stateValue = replay.bossSnapshot ? 'frozen' : replay.route ? 'routed' : replay.recordedCount === 3 ? 'ready' : 'recording';

  return `<div class="combat-replay-map-status ${stateValue}"
    data-replay-recorded-count="${replay.recordedCount}"
    data-replay-route="${replay.route ?? 'none'}"
    data-replay-boss-snapshot="${replay.bossSnapshot ? 'frozen' : 'none'}"
    data-replay-cursor="${replay.cursor}"
    data-replay-buffer="${replay.buffer}"
    aria-live="polite">
    <span class="combat-replay-takes"><small>三段战斗母带 · ${replay.recordedCount}/3</small><strong>${takes}</strong></span>
    <span><small>当前路线</small><strong>${replay.route ? combatReplayRouteLabels[replay.route] : replay.recordedCount === 3 ? '待锁定' : '录制未完成'}</strong></span>
    <span><small>Boss snapshot</small><strong>${snapshotText}</strong></span>
    <span><small>复演游标</small><strong>${replay.cursor}/3${replay.pendingTakeId ? ` · ${combatReplayTakeUi[replay.pendingTakeId]}待释放` : ''}</strong></span>
    <span><small>buffer</small><strong>${replay.buffer} · ${replay.remainingBufferHits} 次承伤</strong></span>
    <span class="combat-replay-entry-gear"><small>入场冻结装备</small><strong>${gear}</strong></span>
  </div>`;
}

const panopticonRelayNodeIds = [
  'north_blind_relay',
  'central_blind_relay',
  'south_blind_relay'
] as const;
const panopticonRouteByNodeId: Record<string, PanopticonRoute> = {
  shadow_route: 'shadow',
  decoy_route: 'decoy',
  refraction_route: 'refraction'
};
const panopticonRouteLabels: Record<PanopticonRoute, string> = {
  shadow: '影行路线',
  decoy: '诱饵路线',
  refraction: '折光路线'
};
const panopticonScanLabels = ['扫描相位 0', '扫描相位 1', '扫描相位 2'] as const;

function getPanopticonZoneForNode(node: DungeonNode): number {
  return ((node.position.x + node.position.y) % 3 + 3) % 3;
}

function readPanopticonNumber(source: Record<string, unknown>, keys: readonly string[]): number {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  }
  return 0;
}

function normalizePanopticonScanPhase(value: unknown): { value: string; index: number } {
  if (typeof value === 'number' && Number.isInteger(value)) {
    const index = Math.max(0, Math.min(2, value));
    return { value: String(index), index };
  }
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    const aliases: Record<string, number> = { north: 0, northern: 0, central: 1, center: 1, middle: 1, south: 2, southern: 2 };
    const parsed = /^\d+$/.test(normalized) ? Number(normalized) : aliases[normalized];
    if (Number.isInteger(parsed)) {
      const index = Math.max(0, Math.min(2, parsed));
      return { value: String(index), index };
    }
    return { value, index: 0 };
  }
  return { value: '0', index: 0 };
}

function isPanopticonRelayComplete(raw: Record<string, unknown>, nodeId: string): boolean {
  for (const key of ['completedRelayNodeIds', 'activatedRelayNodeIds', 'resolvedRelayNodeIds']) {
    const value = raw[key];
    if (Array.isArray(value) && value.includes(nodeId)) return true;
  }
  for (const key of ['relays', 'relayState', 'relayStatus', 'relayCompleted']) {
    const value = raw[key];
    if (!isRecord(value)) continue;
    const entry = value[nodeId];
    if (entry === true || entry === 'completed' || entry === 'active' || entry === 'activated') return true;
    if (isRecord(entry) && (entry.completed === true || entry.active === true || entry.status === 'completed')) return true;
  }
  return state.run?.clearedNodeIds.includes(nodeId) ?? false;
}

function getPanopticonUiStatus(): PanopticonUiStatus | undefined {
  if (!state.run || String(state.run.dungeonId) !== 'panopticon_city') return undefined;
  const lawState = normalizeDungeonLawState(state.run.lawState, state.run.dungeonId);
  const rawStatus = optionalDungeonLawApi.getPanopticonStatus?.(lawState) as unknown;
  if (!isRecord(rawStatus)) {
    return {
      raw: {},
      scanPhase: '0',
      scanPhaseIndex: 0,
      moveCount: 0,
      exposureCount: 0,
      relayCount: 0,
      pendingRouteNodeId: null,
      route: null,
      refractionCharges: 0,
      decoyRewardsGranted: false,
      bossSnapshot: 'none',
      entryGearFrozenCount: 0,
      state: 'legacy'
    };
  }

  const phase = normalizePanopticonScanPhase(rawStatus.scanPhase);
  const route = rawStatus.route === 'shadow' || rawStatus.route === 'decoy' || rawStatus.route === 'refraction'
    ? rawStatus.route
    : null;
  const relayCountFromStatus = readPanopticonNumber(rawStatus, ['relayCount', 'completedRelayCount', 'resolvedRelayCount']);
  const relayCount = relayCountFromStatus || panopticonRelayNodeIds.filter((nodeId) => isPanopticonRelayComplete(rawStatus, nodeId)).length;
  const pendingRouteNodeId = typeof rawStatus.pendingRouteNodeId === 'string' ? rawStatus.pendingRouteNodeId : null;
  const entryGear = isRecord(rawStatus.entryGear) ? rawStatus.entryGear : {};
  const entryGearFrozenCount = Object.values(entryGear).filter((value) => value === true).length;
  const bossDefeated = state.run.clearedNodeIds.includes('all_sight_warden');
  const bossFrozen = !bossDefeated && rawStatus.bossSnapshot !== undefined && rawStatus.bossSnapshot !== null;
  const bossSnapshot: PanopticonBossSnapshotState = bossDefeated ? 'defeated' : bossFrozen ? 'frozen' : 'none';
  const uiState = bossDefeated
    ? 'resolved'
    : bossFrozen
      ? 'frozen'
      : route
        ? 'routed'
        : pendingRouteNodeId || relayCount >= 3
          ? 'choice-ready'
          : 'tracking';

  return {
    raw: rawStatus,
    scanPhase: phase.value,
    scanPhaseIndex: phase.index,
    moveCount: readPanopticonNumber(rawStatus, ['moveCount', 'moves']),
    exposureCount: readPanopticonNumber(rawStatus, ['exposureCount', 'exposures']),
    relayCount: Math.min(3, relayCount),
    pendingRouteNodeId,
    route,
    refractionCharges: readPanopticonNumber(rawStatus, ['refractionCharges', 'refractionChargeCount']),
    decoyRewardsGranted: readPanopticonNumber(rawStatus, ['decoyRewardsGranted']) > 0,
    bossSnapshot,
    entryGearFrozenCount,
    state: uiState
  };
}

function renderPanopticonLawStatus(): string {
  const status = getPanopticonUiStatus();
  if (!status) return '';
  const scanLabel = panopticonScanLabels[status.scanPhaseIndex] ?? `扫描相位 ${status.scanPhase}`;
  const routeLabel = status.route
    ? panopticonRouteLabels[status.route]
    : status.state === 'choice-ready'
      ? '等待路线选择'
      : '尚未开放';
  const bossLabel = status.bossSnapshot === 'defeated' ? '万目监察者已击破' : status.bossSnapshot === 'frozen' ? '万目快照已冻结' : '快照未冻结';

  return `<div class="dungeon-law-status panopticon-law-status state-${status.state}"
    data-dungeon-law="panopticon_city"
    data-panopticon-state="${status.state}"
    data-panopticon-scan-phase="${status.scanPhase}"
    data-panopticon-relay-count="${status.relayCount}"
    data-panopticon-route="${status.route ?? 'none'}"
    data-panopticon-exposure-count="${status.exposureCount}"
    data-panopticon-refraction-charges="${status.refractionCharges}"
    data-panopticon-boss-snapshot="${status.bossSnapshot}"
    data-panopticon-entry-gear-frozen-count="${status.entryGearFrozenCount}"
    aria-live="polite">
    <span><small class="feature-help-label">场域法则 · 天幕扫描${renderFeatureHelpTrigger('law')}</small><strong>${scanLabel} · ${status.moveCount} 步</strong></span>
    <span><small>盲区中继</small><strong>${status.relayCount}/3 已激活</strong></span>
    <span><small>路线 / 入场冻结</small><strong>${routeLabel} · 装备 ${status.entryGearFrozenCount}/4</strong></span>
    <span><small>暴露 / 折光 / 首领</small><strong>${status.exposureCount} / ${status.refractionCharges} · ${bossLabel}${status.decoyRewardsGranted ? ' · 诱饵奖励已发' : ''}</strong></span>
  </div>`;
}

function renderDungeonLawStatus(): string {
  const law = getCurrentDungeonLaw(state);
  if (!law) return '';
  if (String(law.state.dungeonId) === 'panopticon_city') return renderPanopticonLawStatus();

  const target = getDungeonLawTarget(law);
  const mirrorStatus = law.state.law.kind === 'mirror_cycle_city'
    ? getMirrorCityShellStatus(law.state)
    : undefined;
  const mirrorData = law.state.law.kind === 'mirror_cycle_city'
    ? `data-mirror-phase-status="${mirrorStatus?.bossStarted ? 'boss' : law.state.law.pendingPhaseNodeId ? 'pending' : 'active'}"
      data-mirror-phase-value="${law.state.law.currentPhase}"
      data-mirror-phase-node="${law.state.law.pendingPhaseNodeId ?? ''}"
      data-mirror-phase-choice="${law.state.law.pendingPhaseNodeId ? 'pending' : 'resolved'}"
      data-mirror-anchor-count="${Number(law.state.law.anchors.real) + Number(law.state.law.anchors.mirror)}"
      data-mirror-choice-count="${Object.keys(law.state.law.resolvedPhaseChoices).length}"
      data-mirror-shell-count="${mirrorStatus?.remainingShells ?? 0}"`
    : '';
  const genesisData = law.state.law.kind === 'genesis_vault'
    ? `data-genesis-boss-frozen="${law.state.law.bossGenomeSnapshot !== null}"
      data-genesis-sequence="${law.state.law.spliceSequence.join(',')}"`
    : '';
  return `<div
    class="dungeon-law-status severity-${law.display.severity}"
    data-dungeon-law="${law.state.dungeonId}"
    data-law-status="${law.display.status}"
    data-law-target-reached="${law.display.targetReached}"
    ${mirrorData}
    ${genesisData}
    aria-live="polite"
  >
    <span><small class="feature-help-label">场域法则${renderFeatureHelpTrigger('law')}</small><strong>${law.display.title}</strong></span>
    <span><small>当前状态</small><strong>${law.display.status}</strong></span>
    <span class="law-modifiers"><small>生效修正</small><strong>${formatDungeonLawModifiers(law.modifiers)}</strong></span>
    <span><small>目标</small><strong>${law.display.targetReached ? `已达成 · ${target}` : target}</strong></span>
  </div>`;
}

const routeSectorStatusLabels = {
  open: '已开放',
  partial: '部分开放',
  closed: '未开放'
} as const;

function renderRouteSectorSummary(): string {
  const law = getCurrentDungeonLaw(state);
  if (!state.run || !law) return '';

  const sectors = getRouteSectorDisplay(state.run.dungeonId, law.state);
  if (sectors.length === 0) return '';

  return `<div class="route-sector-summary" aria-label="当前法则区段">
    <div class="route-sector-heading"><span class="feature-help-label">法则区段${renderFeatureHelpTrigger('lawSector')}</span><strong>${sectors.length}</strong></div>
    <div class="route-sector-grid">
      ${sectors.map((sector) => `<span
        class="route-sector status-${sector.status}"
        data-route-sector="${sector.id}"
        data-route-sector-status="${sector.status}"
        data-open-gates="${sector.openGateCount}"
        data-total-gates="${sector.gateCount}"
      ><strong>${sector.label}</strong><small>${routeSectorStatusLabels[sector.status]} · 开放 ${sector.openGateCount}/${sector.gateCount}</small></span>`).join('')}
    </div>
  </div>`;
}

function isDungeonLawLandmark(dungeonId: DungeonId, nodeId: string): boolean {
  const landmarkGroups = DUNGEON_LAW_LANDMARKS[dungeonId as keyof typeof DUNGEON_LAW_LANDMARKS];
  if (!landmarkGroups) return false;

  return Object.entries(landmarkGroups).some(
    ([groupName, ids]) => groupName.endsWith('NodeIds') && (ids as readonly string[]).includes(nodeId)
  );
}

function renderNearbyRouteGateStatus(dungeon: NonNullable<ReturnType<typeof currentDungeon>>): string {
  const statuses = dungeon.nodes.flatMap((node) => {
    if (!isAdjacentGridNode(currentNode(), node)) return [];
    const status = getCurrentRouteGateStatus(state, node.id);
    return status ? [status] : [];
  });
  if (!statuses.length) return '';

  return `<div class="nearby-route-gates" aria-live="polite">
    ${statuses
      .map((status) => `<div
        id="route-gate-${status.gate.id}"
        class="nearby-route-gate gate-${status.status}"
        data-route-gate-id="${status.gate.id}"
        data-route-gate-status="${status.status}"
      >
        <strong>门 · ${status.gate.label}</strong>
        <span>${status.isOpen ? '已开启，可探索相邻区域。' : status.blockReason}</span>
      </div>`)
      .join('')}
  </div>`;
}

type RouteContractTargetDisplayState = 'pending' | 'locked' | 'completed' | 'failed' | 'lost';

function getRouteContractTargetDisplayState(
  progress: RouteContractProgress,
  targetIndex: number
): RouteContractTargetDisplayState {
  if (progress.status === 'failed') return 'failed';
  if (progress.status === 'lost') return 'lost';
  if (progress.status === 'secured' || progress.status === 'banked') return 'completed';
  if (targetIndex < progress.completedTargetCount) return 'completed';
  if (targetIndex === 1 && progress.completedTargetCount === 0) return 'locked';
  return 'pending';
}

function fogGridNodeButton(
  node: DungeonNode,
  visibility: Exclude<VisibilityState, 'explored'>,
  actions: ViewAction[],
  departureBlockReason?: string
): string {
  const frontier = visibility === 'frontier';
  const departureBlocked = frontier && Boolean(departureBlockReason);
  const routeGate = frontier ? getCurrentRouteGateStatus(state, node.id) : undefined;
  const status = departureBlocked
    ? '当前位置待处理'
    : routeGate?.status === 'closed'
      ? '门禁关闭 · 可查看'
      : frontier
        ? '可探索'
        : '靠近后侦察';
  const action: ViewAction = {
    id: `grid-${node.id}`,
    label: '探索未知区域',
    hint: status,
    disabled: !frontier || departureBlocked,
    onSelect: () => {
      state = moveToNode(state, node.id);
    }
  };
  actions.push(action);

  const gridStatusClass = departureBlocked ? 'route-blocked' : frontier ? 'movable' : 'distant';
  const gateClass = routeGate ? `route-gate-node gate-${routeGate.status}` : '';
  const ariaLabel = frontier
    ? routeGate?.status === 'closed'
      ? '相邻未知区域，门禁尚未开启'
      : departureBlocked
        ? '相邻未知区域，处理当前位置后可探索'
        : '相邻未知区域，可探索'
    : '未探索区域，靠近后可侦察';

  return `<button class="grid-node fog-node fog-${visibility} ${gridStatusClass} ${gateClass}"
    data-action="${action.id}"
    data-fog-state="${visibility}"
    ${routeGate ? `data-route-gate-id="${routeGate.gate.id}" data-route-gate-status="${routeGate.status}"` : ''}
    aria-label="${ariaLabel}"
    ${departureBlocked ? 'aria-describedby="route-lock-reason"' : routeGate ? `aria-describedby="route-gate-${routeGate.gate.id}"` : ''}
    ${action.disabled ? 'disabled' : ''}>
    <span class="fog-signal" aria-hidden="true">?</span>
    ${frontier
      ? `<span class="node-type-label">邻接区域</span>
        <strong>迷雾边界</strong>
        <small>${status}</small>`
      : ''}
  </button>`;
}

function gridNodeButton(
  node: DungeonNode,
  visibility: VisibilityState,
  actions: ViewAction[],
  departureBlockReason?: string,
  boss?: { nodeId: string; title: string }
): string {
  if (visibility !== 'explored') {
    return fogGridNodeButton(node, visibility, actions, departureBlockReason);
  }

  const cleared = state.run?.clearedNodeIds.includes(node.id) ?? false;
  const current = state.run?.currentNodeId === node.id;
  const movable = !current && isAdjacentGridNode(currentNode(), node);
  const departureBlocked = movable && Boolean(departureBlockReason);
  const routeGate = movable ? getCurrentRouteGateStatus(state, node.id) : undefined;
  const routeGateBlockReason = movable ? getCurrentRouteBlockReason(state, node.id) : undefined;
  const isBoss = boss?.nodeId === node.id;
  const protocol = getCurrentRunProtocol(state);
  const protocolAnchorNodeIds = protocol && state.run?.entryFlowVersion !== 2
    ? getRunProtocolRequiredNodeIds(protocol.definition)
    : [];
  const protocolAnchorIndex = protocolAnchorNodeIds.indexOf(node.id);
  const isProtocolAnchor = protocolAnchorIndex >= 0;
  const isDeepProtocolAnchor = isProtocolAnchor && protocol?.definition.id === 'deep';
  const protocolAnchorClass = isDeepProtocolAnchor
    ? `deep-protocol-anchor-node deep-protocol-anchor-${protocolAnchorIndex + 1}`
    : isProtocolAnchor
      ? 'imprint-protocol-anchor-node'
      : '';
  const isLawLandmark = state.run ? isDungeonLawLandmark(state.run.dungeonId, node.id) : false;
  const equipmentHunt = getCurrentEquipmentHuntStatus(state);
  const equipmentHuntClue = equipmentHunt.enabled && equipmentHunt.dungeonId === state.run?.dungeonId
    ? equipmentHunt.clueNodes.find((clue) => clue.nodeId === node.id)
    : undefined;
  const equipmentMemoryHunt = getCurrentEquipmentMemoryHunt();
  const equipmentMemoryTargetHunt = equipmentMemoryHunt?.nodeId === node.id
    ? equipmentMemoryHunt
    : undefined;
  const equipmentMemoryTargetId = equipmentMemoryTargetHunt?.memoryId;
  const isEquipmentMemoryTarget = equipmentMemoryTargetId !== undefined;
  const equipmentMemoryTargetStatus = equipmentMemoryTargetHunt
    ? equipmentMemoryTargetHunt.status === 'failed'
      ? 'failed'
      : equipmentMemoryTargetHunt.status === 'lost'
        ? 'lost'
        : equipmentMemoryTargetHunt.nodeCleared || equipmentMemoryTargetHunt.status === 'secured' || equipmentMemoryTargetHunt.status === 'banked'
          ? 'completed'
          : 'pending'
    : undefined;
  const routeContractContext = getCurrentRouteContractProgress();
  const routeContract = routeContractContext?.source === 'active'
    ? routeContractContext.progress
    : undefined;
  const routeContractTargetIndex = routeContract?.definition?.targetNodeIds.indexOf(node.id) ?? -1;
  const routeContractOrder = routeContractTargetIndex >= 0 ? routeContractTargetIndex + 1 : undefined;
  const routeContractTargetState = routeContract && routeContractTargetIndex >= 0
    ? getRouteContractTargetDisplayState(routeContract, routeContractTargetIndex)
    : undefined;
  const pursuit = getCurrentRunPursuit(state);
  const pursuitState = state.run
    ? normalizeSavedCurrentRunPursuitState(state.run.pursuitState, state.run.dungeonId)
    : undefined;
  const pursuitDefinition = pursuitState ? pursuit.definition : undefined;
  const isPursuitPosition = pursuitState?.status === 'stalking' && pursuitState.nodeId === node.id;
  const isPursuitContainment = Boolean(
    pursuitDefinition &&
    pursuitDefinition.containmentNodeId === node.id &&
    (pursuitState?.status === 'dormant' || pursuitState?.status === 'stalking' || pursuitState?.status === 'contained')
  );
  const isPursuitContainmentCompleted = isPursuitContainment && pursuitState?.status === 'contained';
  const isPursuitFusion = pursuitState?.status === 'fused' && isBoss;
  const pursuitMapStatus = isPursuitPosition
    ? 'stalking'
    : isPursuitContainmentCompleted
      ? 'completed'
      : isPursuitFusion
        ? 'fused'
        : undefined;
  const combatReplay = getCombatReplayUiState();
  const replayTakeIds = Object.keys(combatReplayTakeUi) as Array<keyof typeof combatReplayTakeUi>;
  const replayTakeIndex = replayTakeIds.indexOf(node.id as keyof typeof combatReplayTakeUi);
  const replayTakeRecording = replayTakeIndex >= 0 ? combatReplay?.recordings[replayTakeIndex] : undefined;
  const replayRouteByNodeId: Partial<Record<string, CombatReplayRoute>> = {
    sequence_route: 'sequence',
    burst_route: 'burst',
    afterbeat_route: 'afterbeat'
  };
  const replayRouteNode = replayRouteByNodeId[node.id];
  const replayRouteSelected = replayRouteNode !== undefined && combatReplay?.route === replayRouteNode;
  const panopticonStatus = getPanopticonUiStatus();
  const panopticonZone = panopticonStatus ? getPanopticonZoneForNode(node) : undefined;
  const panopticonZoneActive = panopticonZone !== undefined && panopticonStatus?.state !== 'legacy' && panopticonZone === panopticonStatus?.scanPhaseIndex;
  const panopticonRelayNode = panopticonStatus && panopticonRelayNodeIds.includes(node.id as typeof panopticonRelayNodeIds[number])
    ? node.id
    : undefined;
  const panopticonRelayComplete = Boolean(panopticonRelayNode && panopticonStatus && isPanopticonRelayComplete(panopticonStatus.raw, panopticonRelayNode));
  const panopticonRouteNode = panopticonStatus ? panopticonRouteByNodeId[node.id] : undefined;
  const panopticonRouteSelected = Boolean(panopticonRouteNode && panopticonStatus?.route === panopticonRouteNode);
  const panopticonBossNode = Boolean(panopticonStatus && node.id === 'all_sight_warden');
  const panopticonBossState = panopticonBossNode ? panopticonStatus?.bossSnapshot ?? 'none' : undefined;
  const panopticonMarked = Boolean(panopticonZoneActive || panopticonRelayNode || panopticonRouteNode || panopticonBossNode);
  const gateClass = routeGate ? `route-gate-node gate-${routeGate.status}` : '';
  const gridStatusClass = current ? 'current' : departureBlocked ? 'route-blocked' : movable ? 'movable' : 'distant';
  const status = current
    ? '当前位置'
    : departureBlocked
      ? '封锁'
      : routeGate?.status === 'closed'
        ? '门禁关闭 · 可查看'
        : routeGate?.status === 'open'
          ? '门禁开启 · 可移动'
          : cleared
            ? '已清理'
            : movable
              ? '可移动'
              : '未相邻';
  const action: ViewAction = {
    id: `grid-${node.id}`,
    label: node.title,
    hint: status,
    disabled: !movable || departureBlocked,
    onSelect: () => {
      state = moveToNode(state, node.id);
    }
  };
  actions.push(action);
  const baseAriaLabel = isBoss
    ? `首领 ${boss.title}，${node.title}，${status}`
    : routeContractOrder
      ? `${node.title}，隐藏任务目标 ${routeContractOrder}，${routeContractTargetState === 'locked' ? '完成目标 1 后解锁' : routeContractTargetState === 'completed' ? '已完成' : routeContractTargetState === 'failed' ? '任务已失败' : routeContractTargetState === 'lost' ? '任务已错过' : '待完成'}，${status}`
      : `${node.title}，${status}`;
  const pursuitAriaLabel = [
    isPursuitPosition ? '破界追兵当前位置' : '',
    isPursuitContainment ? `追兵收容点${isPursuitContainmentCompleted ? '已完成' : '待完成'}` : '',
    isPursuitFusion ? '破界追兵已与首领融合' : ''
  ].filter(Boolean).join('，');
  const equipmentMemoryAriaLabel = isEquipmentMemoryTarget
    ? `装备记忆目标${equipmentMemoryTargetStatus === 'completed' ? '已完成' : equipmentMemoryTargetStatus === 'failed' ? '已失败' : equipmentMemoryTargetStatus === 'lost' ? '已遗失' : '待完成'}`
    : '';
  const panopticonAriaLabel = panopticonStatus
    ? [
        panopticonZoneActive ? `当前${panopticonScanLabels[panopticonStatus.scanPhaseIndex]}` : '',
        panopticonRelayNode ? `盲区中继${panopticonRelayComplete ? '已激活' : '待激活'}` : '',
        panopticonRouteNode ? `${panopticonRouteLabels[panopticonRouteNode]}${panopticonRouteSelected ? '已选' : '未选'}` : '',
        panopticonBossNode ? `万目监察者${panopticonBossState === 'defeated' ? '已击破' : panopticonBossState === 'frozen' ? '快照已冻结' : '未冻结'}` : ''
      ].filter(Boolean).join('，')
    : '';
  const ariaLabel = [baseAriaLabel, pursuitAriaLabel, equipmentMemoryAriaLabel, panopticonAriaLabel].filter(Boolean).join('，');

  return `<button class="grid-node type-${node.type} ${gridStatusClass} ${gateClass} ${cleared ? 'cleared' : ''} ${isBoss ? 'boss-node' : ''} ${isProtocolAnchor ? 'protocol-anchor-node' : ''} ${protocolAnchorClass} ${isLawLandmark ? 'law-landmark-node' : ''} ${equipmentHuntClue ? 'equipment-hunt-clue-node' : ''} ${equipmentHuntClue?.cleared ? 'equipment-hunt-clue-collected' : ''} ${routeContractOrder ? `route-contract-target-node route-contract-target-${routeContractOrder} route-contract-target-${routeContractTargetState}` : ''} ${isEquipmentMemoryTarget ? `equipment-memory-target-node status-${equipmentMemoryTargetStatus}` : ''} ${isPursuitPosition ? 'pursuit-position-node' : ''} ${isPursuitContainment ? 'pursuit-containment-node' : ''} ${isPursuitContainmentCompleted ? 'pursuit-containment-completed' : ''} ${isPursuitFusion ? 'pursuit-fusion-node' : ''} ${replayTakeIndex >= 0 ? `combat-replay-take-node ${replayTakeRecording ? 'recorded' : 'pending'}` : ''} ${replayRouteNode ? `combat-replay-route-node ${replayRouteSelected ? 'selected' : ''}` : ''} ${panopticonStatus ? 'panopticon-node' : ''} ${panopticonMarked ? 'panopticon-marked-node' : ''} ${panopticonZoneActive ? 'panopticon-zone-active' : ''} ${panopticonRelayNode ? `panopticon-relay-node ${panopticonRelayComplete ? 'completed' : 'pending'}` : ''} ${panopticonRouteNode ? `panopticon-route-node ${panopticonRouteSelected ? 'selected' : ''}` : ''} ${panopticonBossNode ? `panopticon-boss-node state-${panopticonBossState}` : ''}"
    data-action="${action.id}"
    ${routeGate ? `data-route-gate-id="${routeGate.gate.id}" data-route-gate-status="${routeGate.status}"` : ''}
    ${isProtocolAnchor ? `data-protocol-anchor="true" data-protocol-anchor-mode="${protocol?.definition.id}"` : ''}
    ${isDeepProtocolAnchor ? `data-deep-protocol-anchor="true" data-protocol-anchor-index="${protocolAnchorIndex + 1}"` : ''}
    ${isLawLandmark ? 'data-law-landmark="true"' : ''}
    ${equipmentHuntClue ? `data-equipment-hunt-clue="${equipmentHuntClue.cleared ? 'collected' : 'pending'}" data-equipment-hunt-clue-id="${equipmentHuntClue.nodeId}"` : ''}
    ${isEquipmentMemoryTarget ? `data-equipment-memory-target="${equipmentMemoryTargetId}" data-equipment-memory-status="${equipmentMemoryTargetStatus}"` : ''}
    ${routeContractOrder ? `data-route-contract-order="${routeContractOrder}" data-route-contract-status="${routeContractTargetState}"` : ''}
    ${isPursuitPosition ? 'data-pursuit-position="true"' : ''}
    ${isPursuitContainment ? `data-pursuit-containment="true" data-pursuit-containment-status="${isPursuitContainmentCompleted ? 'completed' : 'ready'}"` : ''}
    ${isPursuitFusion ? 'data-pursuit-fusion="true"' : ''}
    ${replayTakeIndex >= 0 ? `data-replay-take-node="${replayTakeIds[replayTakeIndex]}" data-replay-take-status="${replayTakeRecording ? 'recorded' : 'pending'}"` : ''}
    ${replayRouteNode ? `data-replay-route-node="${replayRouteNode}" data-replay-route-selected="${replayRouteSelected}"` : ''}
    ${panopticonZone !== undefined ? `data-panopticon-zone="${panopticonZone}" data-panopticon-zone-active="${panopticonZoneActive}"` : ''}
    ${panopticonRelayNode ? `data-panopticon-relay-status="${panopticonRelayComplete ? 'completed' : 'pending'}"` : ''}
    ${panopticonRouteNode ? `data-panopticon-route-node="${panopticonRouteNode}" data-panopticon-route-selected="${panopticonRouteSelected}"` : ''}
    ${panopticonBossState ? `data-panopticon-boss-state="${panopticonBossState}"` : ''}
    ${pursuitMapStatus ? `data-pursuit-status="${pursuitMapStatus}"` : ''}
    ${isBoss ? 'data-boss-node="true"' : ''} aria-label="${ariaLabel}"
    ${departureBlocked ? 'aria-describedby="route-lock-reason"' : routeGate ? `aria-describedby="route-gate-${routeGate.gate.id}"` : ''}
    ${action.disabled ? 'disabled' : ''}>
    ${isProtocolAnchor ? `<span class="protocol-anchor-mark" aria-hidden="true">${isDeepProtocolAnchor ? `深${protocolAnchorIndex + 1}` : '锚'}</span>` : ''}
    ${isLawLandmark && !panopticonStatus ? '<span class="law-landmark-mark" aria-hidden="true">律</span>' : ''}
    ${replayTakeIndex >= 0 ? `<span class="combat-replay-node-mark ${replayTakeRecording ? 'recorded' : ''}" aria-hidden="true">${replayTakeRecording ? '录' : replayTakeIndex + 1}</span>` : replayRouteNode ? `<span class="combat-replay-node-mark route ${replayRouteSelected ? 'selected' : ''}" aria-hidden="true">剪</span>` : ''}
    ${panopticonMarked ? `<span class="panopticon-node-marks" aria-hidden="true">${
      panopticonBossNode
        ? '<span class="panopticon-node-mark boss">目</span>'
        : panopticonRelayNode
          ? `<span class="panopticon-node-mark relay ${panopticonRelayComplete ? 'completed' : ''}">${panopticonRelayComplete ? '继' : '盲'}</span>`
          : panopticonRouteNode
            ? `<span class="panopticon-node-mark route ${panopticonRouteSelected ? 'selected' : ''}">${panopticonRouteNode === 'shadow' ? '影' : panopticonRouteNode === 'decoy' ? '诱' : '折'}</span>`
            : '<span class="panopticon-node-mark scan">扫</span>'
    }</span>` : ''}
    ${routeContractOrder ? `<span class="route-contract-order-mark state-${routeContractTargetState}" aria-hidden="true">${routeContractOrder}</span>` : ''}
    ${equipmentHuntClue ? `<span class="equipment-hunt-clue-mark" aria-hidden="true">${equipmentHuntClue.cleared ? '线索已取' : '追猎线索'}</span>` : ''}
    ${isEquipmentMemoryTarget ? `<span class="equipment-memory-mark state-${equipmentMemoryTargetStatus}" aria-hidden="true" title="装备记忆目标">忆</span>` : ''}
    <span class="node-type-label">${isBoss ? '首领' : nodeTypeLabels[node.type]}</span>
    <strong>${node.title}</strong>
    ${isPursuitPosition || isPursuitContainment || isPursuitFusion
      ? `<span class="pursuit-node-marks" aria-hidden="true">
          ${isPursuitPosition ? '<span class="pursuit-mark">追</span>' : ''}
          ${isPursuitContainment ? `<span class="pursuit-containment-mark ${isPursuitContainmentCompleted ? 'completed' : ''}">封</span>` : ''}
          ${isPursuitFusion ? '<span class="pursuit-fusion-mark">融</span>' : ''}
        </span>`
      : ''}
    <small${routeGateBlockReason ? ` title="${routeGateBlockReason}"` : ''}>${routeGate ? `<span class="route-gate-mark gate-${routeGate.status}" aria-hidden="true">门</span>` : ''}${status}</small>
  </button>`;
}

function renderDungeonMap(
  dungeon: NonNullable<ReturnType<typeof currentDungeon>>,
  actions: ViewAction[],
  departureBlockReason?: string
): string {
  const nodesByCell = new Map(dungeon.nodes.map((node) => [`${node.position.x},${node.position.y}`, node]));
  const bossSeal = getBossSealStatus(state, dungeon.id);
  const boss = bossSeal ? { nodeId: bossSeal.definition.nodeId, title: bossSeal.definition.bossTitle } : undefined;
  const cells: string[] = [];
  const visibilityInput = {
    currentNodeId: state.run?.currentNodeId ?? dungeon.grid.startNodeId,
    clearedNodeIds: state.run?.clearedNodeIds ?? [],
    nodes: dungeon.nodes
  };

  for (let y = 0; y < dungeon.grid.height; y += 1) {
    for (let x = 0; x < dungeon.grid.width; x += 1) {
      const node = nodesByCell.get(`${x},${y}`);
      const visibility = node ? getNodeVisibility(node, visibilityInput) : undefined;
      cells.push(node && visibility
        ? gridNodeButton(node, visibility, actions, departureBlockReason, boss)
        : '<div class="grid-cell empty fog-void" aria-hidden="true"></div>');
    }
  }

  return `<div class="dungeon-map-heading">
    <span class="feature-help-label">探索地图${renderFeatureHelpTrigger('fogMap')}</span>
    <small>处理当前区域，逐步揭开相邻迷雾</small>
  </div>
  <div class="dungeon-map" data-dungeon-id="${dungeon.id}" style="--dungeon-grid-columns: ${dungeon.grid.width}">
    ${cells.join('')}
  </div>`;
}

function renderDepartureBlock(reason?: string, kind?: string): string {
  if (!reason) return '';

  return `<div class="route-lock-status" data-route-lock-kind="${kind ?? ''}" role="status" aria-live="polite">
    <strong>路线封锁</strong>
    <span id="route-lock-reason">${reason}</span>
  </div>`;
}

function renderPendingEquipmentOffer(actions: ViewAction[]): string {
  const offer = state.run?.pendingEquipmentOffer;
  if (!offer) return '';

  const options = offer.equipmentIds.slice(0, 3).map((equipmentId) => {
    const equipment = EQUIPMENT[equipmentId];
    const guaranteed = offer.guaranteedEquipmentId === equipmentId;
    const action: ViewAction = {
      id: `loot-select-${equipmentId}`,
      label: '选择',
      hint: `${slotLabels[equipment.slot]} · 通关后入架`,
      onSelect: () => {
        state = resolveEquipmentLoot(state, equipmentId);
      }
    };
    actions.push(action);

    return `<article
      class="loot-offer-option ${guaranteed ? 'equipment-hunt-guaranteed' : ''}"
      data-loot-equipment-id="${equipmentId}"
      ${guaranteed ? `data-equipment-hunt-guaranteed="true" data-equipment-hunt-target="${equipmentId}"` : ''}
    >
      <div class="card-topline">
        <div class="loot-offer-option-title">
          ${guaranteed ? '<span class="equipment-hunt-target-mark">追猎目标</span>' : ''}
          <h3>${equipment.name}</h3>
        </div>
        <small>${slotLabels[equipment.slot]}</small>
      </div>
      <p class="loot-equipment-core">${equipment.description}</p>
      ${renderEquipmentRelicConduit(equipmentId, 'card')}
      ${renderEquipmentSwapPreview(equipmentId, false, '仅作换装对比；选择后仍需通关才归入装备架。')}
      ${actionButton(action, 'button loot-select-button')}
    </article>`;
  });
  const declineAction: ViewAction = {
    id: 'loot-decline-equipment',
    label: '放弃',
    hint: '不带装备',
    onSelect: () => {
      state = resolveEquipmentLoot(state);
    }
  };
  actions.push(declineAction);

  return `<div class="equipment-loot-offer" data-offer-id="${offer.offerId}" role="group" aria-label="精英装备三选一">
    <div class="loot-offer-heading">
      <div>
        <span class="eyebrow">精英战利品</span>
        <h3>选择一件装备</h3>
      </div>
      <small>选择后暂存袋中，出口结算后才归入装备架。</small>
    </div>
    <div class="loot-offer-grid">${options.join('')}</div>
    <div class="loot-offer-footer">
      <small>三选一，选择或放弃后路线恢复。</small>
      ${actionButton(declineAction, 'button ghost loot-decline-button')}
    </div>
  </div>`;
}

function getNodeToolAvailability(itemId: ItemId | undefined): { available: boolean; hint: string } {
  if (!itemId) return { available: false, hint: '该节点没有对应工具' };

  const itemName = ITEMS[itemId].name;
  if (isTacticalItemId(itemId)) {
    if (isTacticalItemAvailable(state, itemId)) {
      return { available: true, hint: `${itemName} x${state.inventory[itemId]}` };
    }
    if (!isCurrentDungeonFeatureAvailable(state, 'consumable')) {
      return { available: false, hint: `场域法则已封存${itemName}` };
    }
    if (state.run?.tacticalLoadout && !state.run.tacticalLoadout.itemIds.includes(itemId)) {
      return { available: false, hint: `本轮未携行${itemName}` };
    }
    if (state.inventory[itemId] <= 0) {
      return { available: false, hint: `${itemName}库存为 0` };
    }
    return { available: false, hint: `${itemName}当前不可用` };
  }

  if (!isCurrentDungeonFeatureAvailable(state, 'consumable')) {
    return { available: false, hint: `场域法则已封存${itemName}` };
  }
  return state.inventory[itemId] > 0
    ? { available: true, hint: `${itemName} x${state.inventory[itemId]}` }
    : { available: false, hint: `${itemName}库存为 0` };
}

function equipmentSoulSkillButton(
  action: ViewAction,
  status: EquipmentSoulSkillActionStatus,
  className = 'button soul-skill-button',
  extraData = ''
): string {
  return `<button
    class="${className}"
    data-action="${action.id}"
    data-soul-skill-id="${status.skillId}"
    data-soul-skill-charge="${status.chargesRemaining}"
    data-soul-skill-source-equipment="${status.definition.equipmentId}"
    ${extraData}
    ${action.disabled ? 'disabled' : ''}
  >
    <span>${action.label}</span>
    ${action.hint ? `<small>${action.hint}</small>` : ''}
  </button>`;
}

function getDungeonNodeTitle(dungeonId: DungeonId, nodeId: string): string {
  return DUNGEONS[dungeonId].nodes.find((node) => node.id === nodeId)?.title ?? nodeId;
}

function renderNodeSoulSkillActions(actions: ViewAction[]): string {
  const node = currentNode();
  if (!node || !state.run) return '';

  const contextSkillIds: EquipmentSoulSkillId[] = node.type === 'trap'
    ? ['mist_fixed_point', 'cloudstep_retrace']
    : node.type === 'portal'
      ? ['rift_misalignment']
      : node.type === 'reward'
        ? ['rift_seal']
        : [];
  const statuses = contextSkillIds
    .map((skillId) => getEquipmentSoulSkillActionStatus(state, skillId))
    .filter(({ frozen }) => frozen);
  if (!statuses.length) return '';

  const controls: string[] = [];
  for (const status of statuses) {
    if (status.definition.effect === 'trap_force_pass') {
      const action: ViewAction = {
        id: `soul-skill-${status.skillId}-${node.id}`,
        label: status.definition.name,
        hint: status.available ? '强制通过本次陷阱判定' : status.unavailableReason,
        disabled: !status.available,
        onSelect: () => {
          state = useEquipmentSoulSkill(state, status.skillId);
        }
      };
      actions.push(action);
      controls.push(equipmentSoulSkillButton(action, status));
      continue;
    }

    if (status.definition.effect === 'trap_backstep') {
      if (status.targetNodeIds.length) {
        for (const targetNodeId of status.targetNodeIds) {
          const targetTitle = getDungeonNodeTitle(state.run.dungeonId, targetNodeId);
          const action: ViewAction = {
            id: `soul-skill-${status.skillId}-${node.id}-${targetNodeId}`,
            label: `${status.definition.name} · ${targetTitle}`,
            hint: '退回已清理节点，保留当前陷阱',
            disabled: !status.available,
            onSelect: () => {
              state = useEquipmentSoulSkill(state, status.skillId, { targetNodeId });
            }
          };
          actions.push(action);
          controls.push(equipmentSoulSkillButton(action, status, 'button soul-skill-button', `data-soul-skill-target-node="${targetNodeId}"`));
        }
      } else {
        const action: ViewAction = {
          id: `soul-skill-${status.skillId}-${node.id}-unavailable`,
          label: status.definition.name,
          hint: status.unavailableReason,
          disabled: true,
          onSelect: () => {}
        };
        actions.push(action);
        controls.push(equipmentSoulSkillButton(action, status));
      }
      continue;
    }

    if (status.definition.effect === 'portal_offset') {
      const targetDungeonId = node.portal?.targetDungeonId;
      if (status.available && targetDungeonId) {
        for (const targetNodeId of status.targetNodeIds) {
          for (const portalChoice of status.portalChoices) {
            const targetTitle = getDungeonNodeTitle(targetDungeonId, targetNodeId);
            const choiceLabel = portalChoice === 'stabilize' ? '稳定' : '强闯';
            const action: ViewAction = {
              id: `soul-skill-${status.skillId}-${node.id}-${targetNodeId}-${portalChoice}`,
              label: `${status.definition.name} · ${targetTitle}`,
              hint: `${choiceLabel}传送 · 落点偏移`,
              onSelect: () => {
                state = useEquipmentSoulSkill(state, status.skillId, { targetNodeId, portalChoice });
              }
            };
            actions.push(action);
            controls.push(equipmentSoulSkillButton(
              action,
              status,
              `button soul-skill-button ${portalChoice === 'force' ? 'secondary risk-action' : ''}`,
              `data-soul-skill-target-node="${targetNodeId}" data-soul-skill-portal-choice="${portalChoice}"`
            ));
          }
        }
      } else {
        const action: ViewAction = {
          id: `soul-skill-${status.skillId}-${node.id}-unavailable`,
          label: status.definition.name,
          hint: status.unavailableReason,
          disabled: true,
          onSelect: () => {}
        };
        actions.push(action);
        controls.push(equipmentSoulSkillButton(action, status));
      }
      continue;
    }

    if (status.definition.effect === 'reward_seal_item') {
      if (status.itemIds.length) {
        for (const itemId of status.itemIds) {
          const action: ViewAction = {
            id: `soul-skill-${status.skillId}-${node.id}-${itemId}`,
            label: `封存 ${ITEMS[itemId].name}`,
            hint: status.available ? '立即转入持久背包' : status.unavailableReason,
            disabled: !status.available,
            onSelect: () => {
              state = useEquipmentSoulSkill(state, status.skillId, { itemId });
            }
          };
          actions.push(action);
          controls.push(equipmentSoulSkillButton(action, status, 'button soul-skill-button', `data-soul-skill-item="${itemId}"`));
        }
      } else {
        const action: ViewAction = {
          id: `soul-skill-${status.skillId}-${node.id}-unavailable`,
          label: status.definition.name,
          hint: status.unavailableReason,
          disabled: true,
          onSelect: () => {}
        };
        actions.push(action);
        controls.push(equipmentSoulSkillButton(action, status));
      }
    }
  }

  return controls.length ? `<div class="node-soul-skill-controls" data-soul-skill-context="${node.type}">
    <div><span>器魂介入</span><small>即时工具，不占用战斗回合</small></div>
    <div class="button-row">${controls.join('')}</div>
  </div>` : '';
}

function renderSoulRechargeStation(actions: ViewAction[]): string {
  const node = currentNode();
  const rechargeId = node?.soulRechargeId;
  if (!node || !rechargeId || !state.run) return '';

  const status = getEquipmentSoulSkillRechargeStatus(state);
  const cleared = state.run.clearedNodeIds.includes(node.id);
  if (!cleared && !status.pending) return '';

  const departureBlock = getNodeDepartureBlock(state);
  const stateLabel = status.legacyDisabled
    ? 'legacy-disabled'
    : status.pending
      ? 'pending'
      : status.used
        ? 'used'
        : status.available
          ? 'available'
          : 'unavailable';
  const controls: string[] = [];

  if (status.available) {
    const action: ViewAction = {
      id: `soul-recharge-open-${rechargeId}`,
      label: '开启共鸣台',
      hint: '选择恢复一项已消耗技能，并回复 1 charge',
      onSelect: () => {
        state = activateCurrentEquipmentSoulSkillRecharge(state);
      }
    };
    actions.push(action);
    controls.push(`<button class="button soul-recharge-open" data-action="${action.id}" data-soul-recharge-id="${rechargeId}"><span>${action.label}</span><small>${action.hint}</small></button>`);
  } else if (status.pending) {
    for (const skillId of status.spentSkillIds) {
      const definition = EQUIPMENT_SOUL_SKILL_CATALOG.find(({ id }) => id === skillId);
      if (!definition) continue;
      const action: ViewAction = {
        id: `soul-recharge-${rechargeId}-${skillId}`,
        label: `恢复 ${definition.name}`,
        hint: '技能重新就绪 · charge +1',
        onSelect: () => {
          state = resolveCurrentEquipmentSoulSkillRecharge(state, skillId);
        }
      };
      actions.push(action);
      controls.push(`<button
        class="button soul-recharge-choice"
        data-action="${action.id}"
        data-soul-recharge-choice="${skillId}"
        data-soul-recharge-id="${rechargeId}"
      ><span>${action.label}</span><small>${action.hint}</small></button>`);
    }
    const cancelAction: ViewAction = {
      id: `soul-recharge-cancel-${rechargeId}`,
      label: '取消',
      hint: '保留共鸣台使用机会',
      onSelect: () => {
        state = cancelCurrentEquipmentSoulSkillRecharge(state);
      }
    };
    actions.push(cancelAction);
    controls.push(`<button
      class="button secondary soul-recharge-cancel"
      data-action="${cancelAction.id}"
      data-soul-recharge-choice="cancel"
      data-soul-recharge-id="${rechargeId}"
    ><span>${cancelAction.label}</span><small>${cancelAction.hint}</small></button>`);
  }

  const detail = status.legacyDisabled
    ? '旧档本局未启用器魂，共鸣台保持静默。'
    : status.pending
      ? '路线已暂停；选择一项技能恢复，或取消后继续探索。'
      : status.used
        ? '本局已完成共鸣，无法重复使用。'
        : status.available
          ? '检测到已消耗器魂技，可开启一次共鸣。'
          : status.unavailableReason ?? '当前没有可恢复技能。';

  return `<div
    class="soul-recharge-station state-${stateLabel}"
    data-soul-recharge-id="${rechargeId}"
    data-soul-recharge-state="${stateLabel}"
    data-route-lock-kind="${departureBlock?.kind ?? ''}"
  >
    <div class="soul-recharge-copy"><span>${CAMPAIGN_DUNGEON_COUNT}章共鸣台</span><strong>${status.pending ? '共鸣待定' : status.used ? '回路已熄灭' : '器魂回路'}</strong><small>${detail}</small></div>
    ${controls.length ? `<div class="button-row">${controls.join('')}</div>` : ''}
  </div>`;
}

function renderCurrentFieldSurveyActions(actions: ViewAction[]): string {
  const status = getCurrentFieldSurveyStatus(state);
  const survey = status.survey;
  if (!survey) return '';

  const optionButtons = status.options.map((option) => {
    const definition = option.definition;
    const action: ViewAction = {
      id: `field-survey-${survey.id}-${definition.id}`,
      label: definition.name,
      hint: option.available ? formatFieldSurveyTradeoff(definition) : option.unavailableReason ?? '当前不可用',
      disabled: !option.available,
      onSelect: () => {
        state = resolveFieldSurvey(state, definition.id);
      }
    };
    actions.push(action);
    const sources = option.frozenSourceEquipmentIds;

    return `<div class="field-survey-option ${option.available ? 'available' : 'blocked'}"
      data-field-survey-id="${survey.id}"
      data-field-survey-option="${definition.id}"
      data-field-survey-attunement="${definition.attunementId}"
    >
      <div>
        <strong>${definition.name}</strong>
        <small>${formatFieldSurveyTradeoff(definition)}</small>
        <span class="field-survey-option-sources">${sources.length
          ? sources.map((equipmentId) => `<b data-field-survey-source-equipment="${equipmentId}">${EQUIPMENT[equipmentId].name}</b>`).join('')
          : '<b>无冻结来源</b>'}</span>
      </div>
      <button
        class="button node-action-button field-survey-action"
        data-action="${action.id}"
        data-field-survey-id="${survey.id}"
        data-field-survey-option="${definition.id}"
        data-field-survey-attunement="${definition.attunementId}"
        ${action.disabled ? 'disabled' : ''}
      ><span>${action.label}</span><small>${action.hint ?? ''}</small></button>
    </div>`;
  }).join('');

  return `<div
    class="current-field-survey-actions ${status.legacyDisabled ? 'legacy-disabled' : ''}"
    data-field-survey-state="${status.legacyDisabled ? 'legacy-disabled' : 'active'}"
    data-field-survey-id="${survey.id}"
    data-field-survey-node="${survey.nodeId}"
  >
    <div class="field-survey-heading"><span>铭刻勘探</span><small>${status.legacyDisabled ? '本局快照无效，不会回填当前装备。' : status.resolved ? '本节点勘探已结算。' : '选择其一会替代普通奖励结算。'}</small></div>
    <div class="field-survey-option-grid">${optionButtons}</div>
  </div>`;
}

function renderEntropyHeadingControl(actions: ViewAction[]): string {
  const node = currentNode();
  const status = getEntropyHeadingStatus();
  if (!node || !status) return '';

  const resolvedChoice = status.resolvedHeadingChoices[node.id];
  if (!status.pending || status.pendingHeadingNodeId !== node.id) {
    if (!resolvedChoice) return '';
    const choiceLabel = resolvedChoice === 'steady' ? '稳航' : '抢航';
    const routeLabel = resolvedChoice === 'steady' ? '低熵路线' : '高熵路线';
    return `<div
      class="entropy-heading-result choice-${resolvedChoice}"
      data-entropy-ark-status="resolved"
      data-entropy-value="${status.entropy}"
      data-entropy-heading-node="${node.id}"
      data-entropy-heading-choice="${resolvedChoice}"
      role="status"
      aria-live="polite"
    ><strong>${choiceLabel}完成</strong><span>熵位 ${status.entropy}/4 · ${routeLabel}已开启</span></div>`;
  }

  const law = getCurrentDungeonLaw(state);
  const steadyDelta = law?.state.law.kind === 'entropy_ark' && law.state.law.entryPassives.dissipationMantle ? 2 : 1;
  const choiceMeta: Record<EntropyHeadingChoice, { label: string; effect: string }> = {
    steady: {
      label: '稳航',
      effect: `熵位 -${steadyDelta}${steadyDelta === 2 ? ' · 耗散披甲' : ''} · 开启低熵路线`
    },
    rush: { label: '抢航', effect: '熵位 +1 · 开启高熵路线' }
  };
  const buttons = (['steady', 'rush'] as const).map((choice) => {
    const choiceStatus = status.choices[choice];
    const meta = choiceMeta[choice];
    const detail = choiceStatus.available
      ? meta.effect
      : `禁用：${choiceStatus.unavailableReason ?? '当前不可用'}`;
    const action: ViewAction = {
      id: `entropy-heading-${choice}-${node.id}`,
      label: meta.label,
      hint: detail,
      disabled: !choiceStatus.available,
      onSelect: () => {
        if (optionalGameApi.resolveEntropyHeading) {
          state = optionalGameApi.resolveEntropyHeading(state, choice);
        }
      }
    };
    actions.push(action);

    return `<button
      class="button entropy-heading-choice choice-${choice}"
      data-action="${action.id}"
      data-entropy-heading-choice="${choice}"
      aria-describedby="entropy-heading-${choice}-detail"
      ${action.disabled ? 'disabled aria-disabled="true"' : 'aria-disabled="false"'}
    ><span>${meta.label}</span><small id="entropy-heading-${choice}-detail">${detail}</small></button>`;
  }).join('');

  return `<fieldset
    class="entropy-heading-fieldset"
    data-entropy-ark-status="pending"
    data-entropy-value="${status.entropy}"
    data-entropy-heading-node="${node.id}"
    data-entropy-heading-choice="pending"
  >
    <legend>选择航向</legend>
    <p class="entropy-heading-prompt" role="status" aria-live="polite">当前熵位 ${status.entropy}/4。指定航向后恢复地图移动。</p>
    <div class="entropy-heading-choices">${buttons}</div>
  </fieldset>`;
}

function renderMirrorPhaseControl(actions: ViewAction[]): string {
  const node = currentNode();
  const status = getMirrorPhaseStatus();
  const law = getCurrentDungeonLaw(state);
  if (!node || !status || !law || law.state.law.kind !== 'mirror_cycle_city') return '';

  const resolvedChoice = status.resolvedPhaseChoices[node.id as keyof typeof status.resolvedPhaseChoices];
  const anchorCount = Number(status.anchors.real) + Number(status.anchors.mirror);
  const shellStatus = getMirrorCityShellStatus(law.state);
  const projectedShells = Math.max(
    0,
    2 - anchorCount - Number(law.state.law.entryPassives.homecomingPrism)
  );
  const shellText = shellStatus.bossStarted
    ? `镜壳 ${shellStatus.remainingShells}/${shellStatus.totalShells}`
    : `预计镜壳 ${projectedShells} 枚`;

  if (!status.pending || status.pendingPhaseNodeId !== node.id) {
    if (!resolvedChoice) return '';
    const choiceLabel = resolvedChoice === 'real' ? '落实现' : '入镜像';
    return `<div
      class="mirror-phase-result phase-${resolvedChoice}"
      data-mirror-phase-status="resolved"
      data-mirror-phase-value="${status.currentPhase}"
      data-mirror-phase-node="${node.id}"
      data-mirror-phase-choice="${resolvedChoice}"
      role="status"
      aria-live="polite"
    ><strong>${choiceLabel}完成</strong><span>抉择 ${status.resolvedChoiceCount}/3 · 锚点 ${anchorCount}/2 · ${shellText}</span></div>`;
  }

  const choiceMeta: Record<MirrorCityPhase, { label: string; effect: string }> = {
    real: {
      label: '落实现',
      effect: `现实效果：力伤 +12% · 术伤 ${law.state.law.entryPassives.parallaxVisor ? '无惩罚' : '-6%'}`
    },
    mirror: {
      label: '入镜像',
      effect: `镜像效果：术伤 +12% · 力伤 ${law.state.law.entryPassives.parallaxVisor ? '无惩罚' : '-6%'}`
    }
  };
  const buttons = (['real', 'mirror'] as const).map((phase) => {
    const choiceStatus = status.choices[phase];
    const damage = choiceStatus.phaseChanged && choiceStatus.damagePercent > 0
      ? Math.max(1, Math.floor(Math.max(0, state.player.maxHp) * choiceStatus.damagePercent / 100))
      : 0;
    const cost = choiceStatus.phaseChanged
      ? `切换代价：最大生命 ${choiceStatus.damagePercent}%（${damage} 点）`
      : '切换代价：0 生命（保持当前相位）';
    const detail = choiceStatus.available
      ? `${cost} · ${choiceMeta[phase].effect}`
      : `禁用：${choiceStatus.unavailableReason ?? '当前不可用'} · ${cost} · ${choiceMeta[phase].effect}`;
    const action: ViewAction = {
      id: `mirror-phase-${phase}-${node.id}`,
      label: choiceMeta[phase].label,
      hint: detail,
      disabled: !choiceStatus.available,
      onSelect: () => {
        state = resolveMirrorCityPhase(state, phase);
      }
    };
    actions.push(action);

    return `<button
      class="button mirror-phase-choice phase-${phase}"
      data-action="${action.id}"
      data-mirror-phase-choice="${phase}"
      aria-describedby="mirror-phase-${phase}-detail"
      ${action.disabled ? 'disabled aria-disabled="true"' : 'aria-disabled="false"'}
    ><span>${choiceMeta[phase].label}</span><small id="mirror-phase-${phase}-detail">${detail}</small></button>`;
  }).join('');

  return `<fieldset
    class="mirror-phase-fieldset"
    data-mirror-phase-status="pending"
    data-mirror-phase-value="${status.currentPhase}"
    data-mirror-phase-node="${node.id}"
    data-mirror-phase-choice="pending"
  >
    <legend>指定镜城相位</legend>
    <p class="mirror-phase-prompt" role="status" aria-live="polite">当前${status.currentPhase === 'real' ? '现实' : '镜像'}相位 · 抉择 ${status.resolvedChoiceCount}/3 · 锚点 ${anchorCount}/2 · ${shellText}。落定后恢复地图移动。</p>
    <div class="mirror-phase-choices">${buttons}</div>
  </fieldset>`;
}

function renderRedactionClauseControl(actions: ViewAction[]): string {
  const node = currentNode();
  const status = getRedactionClauseStatus();
  const law = getCurrentDungeonLaw(state);
  if (!node || !status || !law || law.state.law.kind !== 'redaction_scriptorium') return '';

  const clauseMeta: Record<string, { label: string; area: string; passive: boolean; clauseEffect: string }> = {
    body_clause_desk: {
      label: '肉身条款',
      area: '正文条款选区',
      passive: law.state.law.entryPassives.redlineEdge,
      clauseEffect: '首领防御 +'
    },
    memory_clause_desk: {
      label: '记忆条款',
      area: '记忆条款选区',
      passive: law.state.law.entryPassives.palimpsestMantle,
      clauseEffect: '首领术强 +'
    },
    return_clause_desk: {
      label: '归返条款',
      area: '归返条款选区',
      passive: law.state.law.entryPassives.finalProofSeal,
      clauseEffect: '玩家治疗与防御效果 -'
    }
  };
  const meta = clauseMeta[node.id];
  if (!meta) return '';

  const resolvedChoice = status.resolvedClauseChoices[node.id as keyof typeof status.resolvedClauseChoices];
  if (!status.pending || status.pendingClauseNodeId !== node.id) {
    if (!resolvedChoice) return '';
    const choiceLabel = resolvedChoice === 'certify' ? '核准原文' : '删去条款';
    return `<div
      class="redaction-clause-result choice-${resolvedChoice}"
      data-redaction-clause-status="resolved"
      data-redaction-clause-value="${status.resolvedCount}"
      data-redaction-clause-node="${node.id}"
      data-redaction-clause-choice="${resolvedChoice}"
      role="status"
      aria-live="polite"
    ><strong>${meta.label}：${choiceLabel}</strong><span>已裁定 ${status.resolvedCount}/3 · 核准 ${status.certifiedCount} · 删去 ${status.redactedCount}</span></div>`;
  }

  const certifyPercent = meta.passive ? 5 : 10;
  const awakenedPercent = certifyPercent * 2;
  const redactDamage = Math.max(1, Math.floor(Math.max(0, state.player.maxHp) * status.costPercent / 100));
  const choiceMeta: Record<RedactionChoice, { label: string; detail: string }> = {
    certify: {
      label: '核准原文',
      detail: `不消耗生命 · 开启${meta.area} · 写入条款：封印态${meta.clauseEffect}${certifyPercent}%，觉醒态${meta.clauseEffect}${awakenedPercent}%${meta.passive ? '（匹配入场被动减半）' : ''}`
    },
    redact: {
      label: '删去条款',
      detail: `支付最大生命 8%（${redactDamage} 点） · 永久关闭${meta.area} · 首领不获得该条款`
    }
  };
  const buttons = (['certify', 'redact'] as const).map((choice) => {
    const choiceStatus = status.choices[choice];
    const detail = choiceStatus.available
      ? choiceMeta[choice].detail
      : `禁用：${choiceStatus.unavailableReason ?? '当前不可用'} · ${choiceMeta[choice].detail}`;
    const action: ViewAction = {
      id: `redaction-clause-${choice}-${node.id}`,
      label: choiceMeta[choice].label,
      hint: detail,
      disabled: !choiceStatus.available,
      onSelect: () => {
        state = resolveRedactionClause(state, choice);
      }
    };
    actions.push(action);
    return `<button
      class="button redaction-clause-choice choice-${choice}"
      data-action="${action.id}"
      data-redaction-clause-choice="${choice}"
      aria-describedby="redaction-clause-${choice}-detail"
      ${action.disabled ? 'disabled aria-disabled="true"' : 'aria-disabled="false"'}
    ><span>${choiceMeta[choice].label}</span><small id="redaction-clause-${choice}-detail">${detail}</small></button>`;
  }).join('');

  return `<fieldset
    class="redaction-clause-fieldset"
    data-redaction-clause-status="pending"
    data-redaction-clause-value="${status.resolvedCount}"
    data-redaction-clause-node="${node.id}"
    data-redaction-clause-choice="pending"
  >
    <legend>裁定${meta.label}</legend>
    <p class="redaction-clause-prompt" role="status" aria-live="polite">已裁定 ${status.resolvedCount}/3 · 核准 ${status.certifiedCount} · 删去 ${status.redactedCount}。落定后恢复地图移动。</p>
    <div class="redaction-clause-choices">${buttons}</div>
  </fieldset>`;
}

function renderAuctionLotControl(actions: ViewAction[]): string {
  const node = currentNode();
  const status = getAuctionLotStatus();
  const law = getCurrentDungeonLaw(state);
  if (!node || !status || !law || law.state.law.kind !== 'legacy_auction_court') return '';

  const meta = auctionLotUi[node.id as keyof typeof auctionLotUi];
  if (!meta) return '';

  const resolvedChoice = status.resolvedLotChoices[node.id as keyof typeof status.resolvedLotChoices];
  if (!status.pending || status.pendingLotNodeId !== node.id) {
    if (!resolvedChoice) return '';
    const labels: Record<AuctionLotChoice, string> = { bid: '竞得拍品', burn: '焚契毁标', fold: '放弃竞标' };
    const matchingPassive = law.state.law.entryPassives[meta.passiveId];
    const resolvedEntries = Object.entries(status.resolvedLotChoices);
    const resolvedIndex = resolvedEntries.findIndex(([nodeId]) => nodeId === node.id);
    const priorBidCount = resolvedEntries
      .slice(0, Math.max(0, resolvedIndex))
      .filter(([, choice]) => choice === 'bid').length;
    const paid = resolvedChoice === 'bid'
      ? Math.max(1, 1 + priorBidCount - Number(matchingPassive))
      : resolvedChoice === 'burn'
        ? 1
        : 0;
    return `<div
      class="auction-lot-result choice-${resolvedChoice}"
      data-auction-lot-status="resolved"
      data-auction-lot-value="${status.resolvedCount}"
      data-auction-lot-node="${node.id}"
      data-auction-lot-choice="${resolvedChoice}"
      role="status"
      aria-live="polite"
    ><strong>${meta.label}：${labels[resolvedChoice]} · 消耗 ${paid} 枚遗产筹码</strong><span>已落定 ${status.resolvedCount}/4 · 竞得 ${status.bidCount} · 焚契 ${status.burnCount} · 放弃 ${status.foldCount}</span></div>`;
  }

  const matchingPassive = law.state.law.entryPassives[meta.passiveId];
  const choiceMeta: Record<AuctionLotChoice, { label: string; detail: string }> = {
    bid: {
      label: '竞得拍品',
      detail: `消耗 ${status.choices.bid.scripCost} 枚遗产筹码（1 + 此前竞得 ${status.bidCount}${matchingPassive ? ' - 匹配装备减免 1' : ''}，最低 1） · 开启${meta.area} · 玩家封印态/觉醒态${meta.effect}获得拍品增益`
    },
    burn: {
      label: '焚契毁标',
      detail: `固定消耗 ${status.choices.burn.scripCost} 枚遗产筹码 · 永久关闭${meta.area} · 玩家与首领都不获得${meta.effect}拍品`
    },
    fold: {
      label: '放弃竞标',
      detail: `消耗 ${status.choices.fold.scripCost} 枚遗产筹码 · 永久关闭${meta.area} · 首领封印态/觉醒态继承${meta.effect}拍品${matchingPassive ? `（${meta.gear}入场被动已计入投影）` : ''}`
    }
  };
  const buttons = (['bid', 'burn', 'fold'] as const).map((choice) => {
    const choiceStatus = status.choices[choice];
    const detail = choiceStatus.available
      ? choiceMeta[choice].detail
      : `禁用：${choiceStatus.unavailableReason ?? '遗产筹码不足'} · ${choiceMeta[choice].detail}`;
    const action: ViewAction = {
      id: `auction-lot-${choice}-${node.id}`,
      label: choiceMeta[choice].label,
      hint: detail,
      disabled: !choiceStatus.available,
      onSelect: () => {
        state = resolveAuctionLot(state, choice);
      }
    };
    actions.push(action);
    return `<button
      class="button auction-lot-choice choice-${choice}"
      data-action="${action.id}"
      data-auction-lot-choice="${choice}"
      aria-describedby="auction-lot-${choice}-detail"
      ${action.disabled ? 'disabled aria-disabled="true"' : 'aria-disabled="false"'}
    ><span>${choiceMeta[choice].label}</span><small id="auction-lot-${choice}-detail">${detail}</small></button>`;
  }).join('');

  return `<fieldset
    class="auction-lot-fieldset"
    data-auction-lot-status="pending"
    data-auction-lot-value="${status.resolvedCount}"
    data-auction-lot-node="${node.id}"
    data-auction-lot-choice="pending"
  >
    <legend>裁定${meta.label}</legend>
    <p class="auction-lot-prompt" role="status" aria-live="polite">遗产筹码 ${status.availableScrip} · 已落定 ${status.resolvedCount}/4 · 竞得 ${status.bidCount} · 焚契 ${status.burnCount} · 放弃 ${status.foldCount}。落定后恢复地图移动。</p>
    <div class="auction-lot-choices">${buttons}</div>
  </fieldset>`;
}

function renderGenesisSpliceControl(actions: ViewAction[]): string {
  const node = currentNode();
  const status = getGenesisStatus();
  if (!node || !status?.pending || status.pendingSpliceNodeId !== node.id) return '';

  const genes: readonly GenesisGene[] = ['force', 'art', 'guard', 'renewal'];
  const buttons = genes.map((gene) => {
    const choice = status.choices[gene];
    const action: ViewAction = {
      id: `genesis-splice-${gene}`,
      label: genesisGeneLabels[gene],
      hint: choice.available
        ? `原型血清 ${choice.serumCost}`
        : `${choice.serumCost} 支 · ${choice.unavailableReason ?? '当前不可用'}`,
      disabled: !choice.available,
      onSelect: () => {
        state = resolveGenesisSplice(state, gene) as EquipmentMemoryGameState;
      }
    };
    actions.push(action);

    return `<button class="button genesis-splice-choice choice-${gene}"
      data-action="${action.id}"
      data-genesis-gene="${gene}"
      data-serum-cost="${choice.serumCost}"
      ${action.disabled ? 'disabled aria-disabled="true"' : 'aria-disabled="false"'}>
      <span>${action.label}</span><small>${action.hint}</small>
    </button>`;
  }).join('');

  return `<fieldset class="genesis-splice-fieldset"
    data-genesis-splice="pending"
    data-genesis-console="${node.id}"
    data-genesis-serum="${status.availableGenesisSerum}">
    <legend>基因拼接</legend>
    <div class="genesis-splice-choices">${buttons}</div>
  </fieldset>`;
}

function renderBroadcastRelayControl(actions: ViewAction[]): string {
  const node = currentNode();
  const status = getBroadcastStatus();
  if (!node || !status) return '';

  const resolvedChoice = status.resolvedRelayChoices[node.id as keyof typeof status.resolvedRelayChoices];
  if (!status.pending || status.pendingRelayNodeId !== node.id) {
    if (!resolvedChoice) return '';
    const result = lastBroadcastRelayResult?.nodeId === node.id ? lastBroadcastRelayResult : undefined;
    const resultText = result
      ? `noise ${result.noiseBefore}/6 → ${result.noiseAfter}/6（${result.noiseAfter - result.noiseBefore >= 0 ? '+' : ''}${result.noiseAfter - result.noiseBefore}） · 本局 RP +${result.bonusRewardPoints}`
      : `当前 noise ${status.noise}/6 · 本局 RP ${resolvedChoice === 'broadcast' ? '+180' : '+0'}`;
    return `<div class="broadcast-relay-result choice-${resolvedChoice}"
      data-broadcast-relay-result="${resolvedChoice}"
      data-broadcast-relay-node="${node.id}"
      data-noise-after="${result?.noiseAfter ?? status.noise}"
      data-bonus-rp="${result?.bonusRewardPoints ?? (resolvedChoice === 'broadcast' ? 180 : 0)}"
      role="status" aria-live="polite"><strong>${resolvedChoice === 'mute' ? '静默频道' : '转播频道'}已结算</strong><span>${resultText}</span></div>`;
  }

  const buttons = (['mute', 'broadcast'] as const).map((choice) => {
    const choiceStatus = status.choices[choice];
    const noiseAfter = status.noise + choiceStatus.noiseDelta;
    const deltaText = `${choiceStatus.noiseDelta >= 0 ? '+' : ''}${choiceStatus.noiseDelta}`;
    const label = choice === 'mute' ? '静默频道' : '转播频道';
    const rewardText = choiceStatus.bonusRewardPoints > 0
      ? ` · 本局 RP +${choiceStatus.bonusRewardPoints}`
      : ' · 本局 RP +0';
    const detail = choiceStatus.available
      ? `noise ${status.noise}/6 → ${noiseAfter}/6（${deltaText}）${rewardText}`
      : `禁用：${choiceStatus.unavailableReason ?? '当前不可用'} · noise ${status.noise}/6 → ${noiseAfter}/6（${deltaText}）${rewardText}`;
    const action: ViewAction = {
      id: `broadcast-relay-${choice}`,
      label,
      hint: detail,
      disabled: !choiceStatus.available,
      onSelect: () => {
        if (!state.run) return;
        const noiseBefore = status.noise;
        const nextState = resolveCurrentBroadcastRelay(state, choice) as EquipmentMemoryGameState;
        const nextStatus = getCurrentBroadcastRelayStatus(nextState);
        if (!nextStatus || nextStatus.pendingRelayNodeId === status.pendingRelayNodeId) return;
        const noiseAfter = nextStatus.noise;
        lastBroadcastRelayResult = {
          nodeId: node.id,
          choice,
          noiseBefore,
          noiseAfter,
          bonusRewardPoints: choiceStatus.bonusRewardPoints
        };
        state = nextState;
      }
    };
    actions.push(action);
    return `<button class="button broadcast-relay-choice choice-${choice}"
      data-action="${action.id}"
      data-broadcast-relay-choice="${choice}"
      data-noise-before="${status.noise}"
      data-noise-after="${noiseAfter}"
      data-noise-delta="${choiceStatus.noiseDelta}"
      data-bonus-rp="${choiceStatus.bonusRewardPoints}"
      ${action.disabled ? 'disabled aria-disabled="true"' : 'aria-disabled="false"'}>
      <span>${label}</span><small>${detail}</small>
    </button>`;
  }).join('');

  return `<fieldset class="broadcast-relay-fieldset"
    data-broadcast-relay="pending"
    data-broadcast-relay-node="${node.id}"
    data-broadcast-noise="${status.noise}">
    <legend>广播中继</legend>
    <p class="broadcast-relay-prompt" role="status" aria-live="polite">已落定 ${status.resolvedCount}/3 · 静默 ${status.muteCount} · 转播 ${status.broadcastCount}。落定后恢复地图移动。</p>
    <div class="broadcast-relay-choices">${buttons}</div>
  </fieldset>`;
}

function renderShelterCheckpointControl(actions: ViewAction[]): string {
  const node = currentNode();
  const status = getShelterStatus();
  if (!node || !status) return '';

  const resolvedChoice = status.resolvedCheckpointChoices[node.id as keyof typeof status.resolvedCheckpointChoices];
  if (!status.pending || status.pendingCheckpointNodeId !== node.id) {
    if (!resolvedChoice) return '';
    const result = lastShelterCheckpointResult?.nodeId === node.id && lastShelterCheckpointResult.choice === resolvedChoice
      ? lastShelterCheckpointResult
      : undefined;
    const resultText = result
      ? `幸存者 HP ${result.hpBefore}/100 → ${result.hpAfter}/100（${signedValue(result.hpAfter - result.hpBefore)}） · 止血丹 ${result.healingPillCost} · 本局 RP +${result.bonusRewardPoints}`
      : `幸存者 HP ${status.survivorHp}/100 · 已落定 ${status.resolvedCount}/3`;
    return `<div class="shelter-checkpoint-result choice-${resolvedChoice}"
      data-shelter-checkpoint-result="${resolvedChoice}"
      data-shelter-checkpoint-node="${node.id}"
      data-survivor-hp-after="${result?.hpAfter ?? status.survivorHp}"
      data-healing-pill-cost="${result?.healingPillCost ?? 0}"
      data-bonus-rp="${result?.bonusRewardPoints ?? (resolvedChoice === 'push' ? 200 : 0)}"
      role="status" aria-live="polite"><strong>${resolvedChoice === 'treat' ? '幸存者治疗完成' : '强行推进完成'}</strong><span>${resultText}</span></div>`;
  }

  const buttons = (['treat', 'push'] as const).map((choice) => {
    const choiceStatus = status.choices[choice];
    const hpAfter = Math.max(0, Math.min(100, status.survivorHp + choiceStatus.survivorHpDelta));
    const label = choice === 'treat' ? '治疗幸存者' : '强行推进';
    const costText = choice === 'treat'
      ? `当前 run 止血丹 ${status.availableHealingPills} · cost ${choiceStatus.healingPillCost}${choiceStatus.healingPillCost === 0 ? '（陆观澜首次分诊免费）' : ''}`
      : `本局 RP +${choiceStatus.bonusRewardPoints}`;
    const projection = `幸存者 HP ${status.survivorHp}/100 → ${hpAfter}/100（${signedValue(choiceStatus.survivorHpDelta)}） · ${costText}`;
    const detail = choiceStatus.available
      ? projection
      : `禁用：${choiceStatus.unavailableReason ?? '当前不可用'} · ${projection}`;
    const action: ViewAction = {
      id: `shelter-checkpoint-${choice}-${node.id}`,
      label,
      hint: detail,
      disabled: !choiceStatus.available,
      onSelect: () => {
        const hpBefore = status.survivorHp;
        const nextState = resolveCurrentEscortCheckpoint(state, choice) as EquipmentMemoryGameState;
        if (nextState === state) return;
        const nextStatus = getCurrentEscortCheckpointStatus(nextState);
        if (!nextStatus || nextStatus.pendingCheckpointNodeId === status.pendingCheckpointNodeId) return;
        lastShelterCheckpointResult = {
          nodeId: node.id,
          choice,
          hpBefore,
          hpAfter: nextStatus.survivorHp,
          healingPillCost: choiceStatus.healingPillCost,
          bonusRewardPoints: choiceStatus.bonusRewardPoints
        };
        state = nextState;
      }
    };
    actions.push(action);
    return `<button class="button shelter-checkpoint-choice choice-${choice}"
      data-action="${action.id}"
      data-shelter-checkpoint-choice="${choice}"
      data-survivor-hp-before="${status.survivorHp}"
      data-survivor-hp-after="${hpAfter}"
      data-survivor-hp-delta="${choiceStatus.survivorHpDelta}"
      data-healing-pill-cost="${choiceStatus.healingPillCost}"
      data-bonus-rp="${choiceStatus.bonusRewardPoints}"
      ${action.disabled ? 'disabled aria-disabled="true"' : 'aria-disabled="false"'}>
      <span>${label}</span><small>${detail}</small>
    </button>`;
  }).join('');

  return `<fieldset class="shelter-checkpoint-fieldset"
    data-shelter-checkpoint="pending"
    data-shelter-checkpoint-node="${node.id}"
    data-survivor-hp="${status.survivorHp}"
    data-shelter-run-pills="${status.availableHealingPills}">
    <legend>护送检查点</legend>
    <p class="shelter-checkpoint-prompt" role="status" aria-live="polite">幸存者 HP ${status.survivorHp}/100 · 已落定 ${status.resolvedCount}/3 · 治疗 ${status.treatCount} · 强推 ${status.pushCount}。落定后恢复地图移动。</p>
    <div class="shelter-checkpoint-choices">${buttons}</div>
  </fieldset>`;
}

function renderVerdictControl(actions: ViewAction[]): string {
  const node = currentNode();
  const status = getCurrentVerdictStatus(state);
  if (!node || !status || status.pendingVerdictNodeId !== node.id) return '';

  const evidence = status.evidence.map((item) => {
    const evidenceState = item.trusted ? 'trusted' : item.contaminated ? 'contaminated' : item.revealed ? 'revealed' : 'hidden';
    const text = item.trusted ? '净证' : item.contaminated ? '污染' : item.revealed ? '已揭示' : '未揭示';
    return `<b data-verdict-choice-evidence="${item.id}" data-evidence-state="${evidenceState}">${verdictEvidenceLabels[item.id]} ${text}</b>`;
  }).join('');
  const eliminated = status.eliminatedSuspects.length
    ? status.eliminatedSuspects.map((suspect) => verdictSuspectLabels[suspect]).join(' / ')
    : '暂无';
  const currentVerdict = status.accusedSuspect === null
    ? '尚未裁决'
    : `${verdictSuspectLabels[status.accusedSuspect]} · ${status.accusationCorrect ? '正确' : '错误'} · 原始冻结净证 ${status.accusationTrustedCount}`;
  const appealText = status.pendingVerdictNodeId === 'appeal_desk'
    ? `翻案资格：${status.appealEligible ? '可用' : '不可用'}`
    : status.appealUsed
      ? '翻案已用 · 维持当前裁决'
      : status.appealEligible
        ? '翻案资格：可用'
        : '维持原判';
  const buttons = (Object.keys(verdictSuspectLabels) as FalseTestimonySuspect[]).map((suspect) => {
    const isEliminated = status.eliminatedSuspects.includes(suspect);
    const action: ViewAction = {
      id: `verdict-choice-${status.pendingVerdictNodeId}-${suspect}`,
      label: verdictSuspectLabels[suspect],
      hint: isEliminated ? '证据已排除' : '提交裁决',
      onSelect: () => {
        state = resolveCurrentVerdictChoice(state, suspect) as EquipmentMemoryGameState;
      }
    };
    actions.push(action);
    return `<button class="button verdict-suspect-choice${isEliminated ? ' eliminated' : ''}"
      data-action="${action.id}"
      data-verdict-choice="${suspect}"
      data-verdict-eliminated="${isEliminated}"
      data-correct-reward-preview="${status.projectedAccusationRewardPoints}">
      <span>${action.label}</span><small>${action.hint}</small>
    </button>`;
  }).join('');

  return `<fieldset class="verdict-choice-fieldset"
    data-verdict-choice-panel="pending"
    data-verdict-choice-node="${node.id}"
    data-verdict-current-trusted="${status.currentTrustedCount}"
    data-verdict-frozen-trusted="${status.accusationTrustedCount}"
    data-verdict-correct-reward="${status.projectedAccusationRewardPoints}"
    data-verdict-appeal-eligible="${status.appealEligible}">
    <legend>证据裁定</legend>
    <div class="verdict-choice-evidence"><span>三证状态</span><strong>${evidence}</strong></div>
    <div class="verdict-choice-summary" role="status" aria-live="polite">
      <span><small>已排除者</small><strong>${eliminated}</strong></span>
      <span><small>当前裁决</small><strong>${currentVerdict}</strong></span>
      <span><small>正确奖励预估</small><strong>本局 RP +${status.projectedAccusationRewardPoints}</strong></span>
      <span><small>翻案状态</small><strong>${appealText}</strong></span>
    </div>
    <div class="verdict-suspect-choices">${buttons}</div>
  </fieldset>`;
}

function renderCombatReplayRouteControl(actions: ViewAction[]): string {
  const replay = getCombatReplayUiState();
  if (!replay || replay.recordedCount < 3) return '';
  if (replay.route) {
    return `<div class="combat-replay-route-result" data-replay-route-result="${replay.route}" role="status" aria-live="polite">
      <strong>${combatReplayRouteLabels[replay.route]}已锁定</strong>
      <span>三段战斗母带将按此路线进入后续战斗，Boss 开战时冻结快照。</span>
    </div>`;
  }

  const routeDetails: Record<CombatReplayRoute, string> = {
    sequence: '逐回合依次释放，保留每段母带的原始节奏',
    burst: '开场快速释放三段，单段按 60% 结算',
    afterbeat: '敌方行动后释放，单段按 125% 结算'
  };
  const buttons = (Object.keys(combatReplayRouteLabels) as CombatReplayRoute[]).map((route) => {
    const action: ViewAction = {
      id: `combat-replay-route-${route}`,
      label: combatReplayRouteLabels[route],
      hint: routeDetails[route],
      onSelect: () => {
        state = selectCombatReplayRoute(state, route) as EquipmentMemoryGameState;
      }
    };
    actions.push(action);
    return `<button class="button combat-replay-route-choice route-${route}"
      data-action="${action.id}"
      data-replay-route-choice="${route}">
      <span>${action.label}</span><small>${action.hint}</small>
    </button>`;
  }).join('');

  return `<fieldset class="combat-replay-route-fieldset" data-replay-route-choice-panel="ready">
    <legend>复演路线</legend>
    <p class="combat-replay-route-prompt" role="status" aria-live="polite">三段母带已录制。路线一经锁定，本局不可重选。</p>
    <div class="combat-replay-route-choices">${buttons}</div>
  </fieldset>`;
}

function renderPanopticonRouteControl(actions: ViewAction[]): string {
  const status = getPanopticonUiStatus();
  if (!status || status.state === 'legacy' || status.relayCount < 3) return '';
  if (status.route) {
    return `<div class="panopticon-route-result" data-panopticon-route-result="${status.route}" role="status" aria-live="polite">
      <strong>${panopticonRouteLabels[status.route]}已锁定</strong>
      <span>${status.route === 'shadow' ? '压低暴露，沿扫描盲线前进。' : status.route === 'decoy' ? '投放诱饵，奖励只结算一次。' : '积蓄折光次数，反制后续监察。'}</span>
    </div>`;
  }

  const routeDetails: Record<PanopticonRoute, string> = {
    shadow: '利用扫描盲线压低暴露',
    decoy: '制造假目标并获取一次性收益',
    refraction: '积攒折光次数反制监察'
  };
  const routeApiAvailable = typeof optionalGameApi.selectPanopticonRoute === 'function';
  const buttons = (Object.keys(panopticonRouteLabels) as PanopticonRoute[]).map((route) => {
    const action: ViewAction = {
      id: `panopticon-route-${route}`,
      label: panopticonRouteLabels[route],
      hint: routeApiAvailable ? routeDetails[route] : '等待核心路线 API',
      disabled: !routeApiAvailable,
      onSelect: () => {
        const selectRoute = optionalGameApi.selectPanopticonRoute;
        if (selectRoute) state = selectRoute(state, route) as EquipmentMemoryGameState;
      }
    };
    actions.push(action);
    return `<button class="button panopticon-route-choice route-${route}"
      data-action="${action.id}"
      data-panopticon-route-choice="${route}"
      ${action.disabled ? 'disabled' : ''}>
      <span>${action.label}</span><small>${action.hint}</small>
    </button>`;
  }).join('');

  return `<fieldset class="panopticon-route-fieldset" data-panopticon-route-choice-panel="ready" data-panopticon-route-node="${status.pendingRouteNodeId ?? ''}">
    <legend>监察路线</legend>
    <p class="panopticon-route-prompt" role="status" aria-live="polite">三座盲区中继已激活。路线一经选定，本局不可重选。</p>
    <div class="panopticon-route-choices">${buttons}</div>
  </fieldset>`;
}

function renderNodeAction(actions: ViewAction[]): string {
  const node = currentNode();
  if (!node) return '';

  const cleared = state.run?.clearedNodeIds.includes(node.id) ?? false;
  const hasPendingEquipmentOffer = Boolean(state.run?.pendingEquipmentOffer);
  const exitBossSeal = node.type === 'exit' ? getBossSealStatus(state) : undefined;
  const exitSealed = Boolean(exitBossSeal && !exitBossSeal.cleared);
  const nodeActions: ViewAction[] = [];
  if (hasPendingEquipmentOffer) {
    // The loot choice below is the only unresolved action after an elite is defeated.
  } else if (cleared) {
    nodeActions.push({
      id: `cleared-current-${node.id}`,
      label: '节点已清理',
      hint: '不可重复结算',
      disabled: true,
      onSelect: () => {}
    });
  } else if (node.type === 'monster') {
    nodeActions.push({
      id: `fight-current-${node.id}`,
      label: '进入战斗',
      hint: node.monsterId ? MONSTERS[node.monsterId].name : '',
      onSelect: () => {
        state = selectNode(state, node.id);
      }
    });
  }
  if (!hasPendingEquipmentOffer && !cleared && node.type === 'trap') {
    const counterItem = node.trap?.counterItem;
    const counterStatus = getNodeToolAvailability(counterItem);
    nodeActions.push(
      {
        id: `trap-counter-${node.id}`,
        label: counterItem ? `使用 ${ITEMS[counterItem].name}` : '无反制工具',
        hint: counterStatus.available ? `${counterStatus.hint} · 无伤通过` : counterStatus.hint,
        disabled: !counterStatus.available,
        onSelect: () => {
          state = handleTrap(state, 'counter');
        }
      },
      {
        id: `trap-risk-${node.id}`,
        label: '冒险检定',
        hint: '无需道具 · 可能承受陷阱伤害',
        onSelect: () => {
          state = handleTrap(state, 'risk');
        }
      }
    );
  }
  if (!hasPendingEquipmentOffer && !cleared && node.type === 'portal') {
    const stableItem = node.portal?.stableItem;
    const stableStatus = getNodeToolAvailability(stableItem);
    nodeActions.push(
      {
        id: `portal-stabilize-${node.id}`,
        label: '稳定传送',
        hint: stableStatus.available ? `${stableStatus.hint} · 避免裂隙反噬` : stableStatus.hint,
        disabled: !stableStatus.available,
        onSelect: () => {
          state = usePortal(state, 'stabilize');
        }
      },
      {
        id: `portal-force-${node.id}`,
        label: '强闯传送',
        hint: '无需道具 · 会承受裂隙反噬',
        onSelect: () => {
          state = usePortal(state, 'force');
        }
      }
    );
  }
  if (!cleared && node.type === 'reward') {
    nodeActions.push({
      id: `reward-current-${node.id}`,
      label: '收取奖励',
      hint: node.reward?.methodBonus ? `${METHODS[node.reward.methodBonus.methodId].name}有额外收益` : '结算',
      onSelect: () => {
        state = collectReward(state);
      }
    });
  }
  if (node.type === 'exit') {
    nodeActions.push({
      id: `exit-current-${node.id}`,
      label: '完成副本',
      hint: exitSealed && exitBossSeal ? `封印中 · 击败${exitBossSeal.definition.bossTitle}` : '返回结算',
      disabled: exitSealed,
      onSelect: () => {
        state = resolveExit(state);
      }
    });
  }

  actions.push(...nodeActions);
  const scorePreview = node.type === 'exit' ? renderScoreStrip('出口评分预估', runEconomy('cleared', true)) : '';
  const equipmentOffer = renderPendingEquipmentOffer(actions);
  const soulSkillControls = renderNodeSoulSkillActions(actions);
  const soulRechargeStation = renderSoulRechargeStation(actions);
  const fieldSurveyActions = renderCurrentFieldSurveyActions(actions);
  const entropyHeadingControl = renderEntropyHeadingControl(actions);
  const mirrorPhaseControl = renderMirrorPhaseControl(actions);
  const redactionClauseControl = renderRedactionClauseControl(actions);
  const auctionLotControl = renderAuctionLotControl(actions);
  const genesisSpliceControl = renderGenesisSpliceControl(actions);
  const broadcastRelayControl = renderBroadcastRelayControl(actions);
  const shelterCheckpointControl = renderShelterCheckpointControl(actions);
  const verdictControl = renderVerdictControl(actions);
  const combatReplayRouteControl = renderCombatReplayRouteControl(actions);
  const panopticonRouteControl = renderPanopticonRouteControl(actions);

  return `<div class="action-panel node-action-panel ${hasPendingEquipmentOffer ? 'has-equipment-offer' : ''}"
    data-current-node-id="${node.id}"
    tabindex="-1"
    ${node.fieldSurveyId ? `data-field-survey-node="${node.id}"` : ''}
  >
    <div class="node-action-copy">
      <span class="eyebrow">当前节点</span>
      <h2>${node.title}</h2>
      <p>${node.description}</p>
      ${
        exitSealed && exitBossSeal
          ? `<div class="exit-seal-reason" role="status">
              <strong>出口封印未解</strong>
              <span>${exitBossSeal.requirementText}</span>
            </div>`
          : ''
      }
      ${scorePreview}
      ${equipmentOffer}
      ${fieldSurveyActions}
      ${entropyHeadingControl}
      ${mirrorPhaseControl}
      ${redactionClauseControl}
      ${renderAuctionMapStatus()}
      ${auctionLotControl}
      ${genesisSpliceControl}
      ${broadcastRelayControl}
      ${shelterCheckpointControl}
      ${verdictControl}
      ${combatReplayRouteControl}
      ${panopticonRouteControl}
      ${soulSkillControls}
      ${soulRechargeStation}
    </div>
    ${nodeActions.length ? `<div class="button-row">${nodeActions.map((action) => {
      const isRiskAction = action.id.startsWith('trap-risk-') || action.id.startsWith('portal-force-');
      return actionButton(action, `button node-action-button ${isRiskAction ? 'secondary risk-action' : 'tool-action'}`);
    }).join('')}</div>` : ''}
  </div>`;
}

function renderEventOption(eventId: string, option: EvaluatedDungeonEventOption, actions: ViewAction[]): string {
  const action: ViewAction = {
    id: `event-${eventId}-${option.id}`,
    label: option.label,
    hint: eventRiskLabels[option.risk],
    disabled: false,
    onSelect: () => {
      state = gameApi.resolveDungeonEvent(state, eventId, option.id);
    }
  };
  actions.push(action);

  const requirements = option.requirements.length
    ? option.requirements.map((requirement) => formatRequirement(requirement)).join(' / ')
    : '无条件';
  const unmet = option.unmetRequirements.length
    ? `未满足：${option.unmetRequirements.map((requirement) => requirement.description).join(' / ')}`
    : '条件满足';

  return `<div class="event-option ${option.available ? 'available' : 'blocked'}">
    <div>
      <div class="card-topline">
        <span>风险：${eventRiskLabels[option.risk]}</span>
        <small>${unmet}</small>
      </div>
      <strong>${option.label}</strong>
      <p>${option.description}</p>
      <small class="mechanic-line">条件：${requirements} / 预期：${formatEventOutcome(option.outcome)}</small>
      ${!option.available && option.failureOutcome ? `<small class="mechanic-line">强行尝试：${formatEventOutcome(option.failureOutcome)}</small>` : ''}
    </div>
    ${actionButton(action, option.available ? 'button' : 'button ghost')}
  </div>`;
}

function renderDungeonEvents(actions: ViewAction[]): string {
  const events = gameApi.getAvailableDungeonEvents(state);
  const eventLog = state.run?.eventLog ?? [];
  const resolved = eventLog.length
    ? `<div class="event-log">${eventLog.map((line) => `<p>${line}</p>`).join('')}</div>`
    : '<p class="empty-copy">当前还没有处理过关卡事件。</p>';

  if (!events.length) {
    return `<section class="panel wide-panel dungeon-events">
      <div class="panel-title">
        <span class="eyebrow">关卡事件</span>
        <h2>事件记录</h2>
      </div>
      ${resolved}
    </section>`;
  }

  return `<section class="panel wide-panel dungeon-events">
    <div class="panel-title">
      <span class="eyebrow">关卡事件</span>
      <h2>可选择事件</h2>
    </div>
    <div class="event-grid">
      ${events
        .map(
          (event) => `<article class="dungeon-event-card">
            <h3>${event.title}</h3>
            <p>${event.description}</p>
            <div class="event-options">${event.options.map((option) => renderEventOption(event.id, option, actions)).join('')}</div>
          </article>`
        )
        .join('')}
    </div>
    ${resolved}
  </section>`;
}

function renderExplore(actions: ViewAction[]): string {
  const dungeon = currentDungeon();
  if (!dungeon) return '';
  const departureBlock = getNodeDepartureBlock(state);
  const departureBlockReason = departureBlock?.message ?? getNodeDepartureBlockReason(state);

  const returnAction: ViewAction = {
    id: 'abandon-run',
    label: '撤回主神空间',
    hint: '袋中点数/物品/灵蕴保留50%，装备遗失',
    onSelect: () => {
      state = resolveRetreat(state);
    }
  };
  actions.push(returnAction);

  return `${renderDirectiveCard(dungeon.id)}
  ${renderDungeonEvents(actions)}
  <section class="panel wide-panel">
    <div class="panel-title">
      <span class="eyebrow">副本探索</span>
      <h2>${dungeon.name}</h2>
    </div>
    ${renderRunProtocolStatus()}
    ${renderRouteContractStatus()}
    ${renderRunPressureStatus()}
    ${renderRunCompanionStatus()}
    ${renderRunMethodStatus()}
    ${renderRunEquipmentHuntStatus()}
    ${renderRunEquipmentMemoryHuntStatus()}
    ${renderRunTacticalLoadout()}
    ${renderRunFieldSurveyStatus()}
    ${renderRunSoulSkillStatus()}
    ${renderRunRelicStatus(actions)}
    ${renderDungeonLawStatus()}
    ${renderGenesisMapStatus()}
    ${renderBroadcastMapStatus()}
    ${renderShelterMapStatus()}
    ${renderVerdictMapStatus()}
    ${renderCombatReplayMapStatus()}
    ${renderMirrorCityMapStatus()}
    ${renderRedactionMapStatus()}
    ${renderRouteSectorSummary()}
    ${renderNearbyRouteGateStatus(dungeon)}
    <p class="lead-copy">${dungeon.theme}</p>
    ${renderBossSealProgress(dungeon.id)}
    ${renderLootBag()}
    ${renderDepartureBlock(departureBlockReason, departureBlock?.kind)}
    ${renderExplorationGuide()}
    ${renderDungeonMap(dungeon, actions, departureBlockReason)}
    ${renderNodeAction(actions)}
    ${actionButton(returnAction, 'button secondary')}
  </section>`;
}

function getDungeonFeatureUnavailableReason(feature: ArchiveFeature): string | undefined {
  return isCurrentDungeonFeatureAvailable(state, feature)
    ? undefined
    : `梦档案馆已封存${archiveFeatureLabels[feature]}`;
}

function isCombatActionAvailableUnderCurrentLaw(action: CombatAction): boolean {
  if (action === 'art') return isCurrentDungeonFeatureAvailable(state, 'method');
  if (action === 'use_healing_pill' || action === 'use_thunder_talisman') {
    return isCurrentDungeonFeatureAvailable(state, 'consumable');
  }
  return true;
}

function formatCombatIntentActions(
  intentActions: readonly CombatAction[],
  weaponSkillStatus: ReturnType<typeof getWeaponSkillStatus>
): string {
  const availableActions = intentActions.filter(isCombatActionAvailableUnderCurrentLaw);
  const displayActions = availableActions.length ? availableActions : intentActions;
  return displayActions
    .map((action) => (action === 'weapon_skill' ? weaponSkillStatus.definition?.name ?? combatActionLabels[action] : combatActionLabels[action]))
    .join(' / ');
}

function renderCombatIntent(
  intent: NonNullable<ReturnType<typeof getCurrentCombatIntent>>,
  weaponSkillStatus: ReturnType<typeof getWeaponSkillStatus>
): string {
  return `<div
    class="combat-intent severity-${intent.severity}"
    data-combat-intent="${intent.id}"
    data-intent-severity="${intent.severity}"
    aria-live="polite"
  >
    <div class="intent-heading">
      <span>敌方意图 · ${combatIntentSeverityLabels[intent.severity]}</span>
      <strong>${intent.name}</strong>
    </div>
    <p><b>后果</b>${intent.consequence}</p>
    <p><b>推荐</b>${formatCombatIntentActions(intent.recommendedActions, weaponSkillStatus)}</p>
  </div>`;
}

function getCombatIntentActionClass(
  intent: NonNullable<ReturnType<typeof getCurrentCombatIntent>>,
  action: CombatAction
): string {
  if (intent.recommendedActions.includes(action) && isCombatActionAvailableUnderCurrentLaw(action)) return 'intent-counter';
  if (intent.dangerousActions.includes(action)) return 'intent-risk';
  return '';
}

function getCombatFocusProjection(
  action: CombatAction,
  intent: NonNullable<ReturnType<typeof getCurrentCombatIntent>> | undefined,
  currentFocus: number,
  disabled: boolean
): string | undefined {
  if (!intent || disabled) return undefined;

  const resolution = resolveCombatFocus({
    currentFocus,
    action,
    intent,
    combatContinues: true
  });
  if (resolution.spent) return `战意：消耗 ${COMBAT_FOCUS_MAX}`;
  if (resolution.delta > 0) return `战意 +${resolution.delta}`;
  if (resolution.delta < 0) return `战意 ${resolution.delta}`;
  return '战意 +0';
}

function combatAction(
  action: CombatAction,
  label: string,
  hint: string,
  disabled = false,
  intent?: NonNullable<ReturnType<typeof getCurrentCombatIntent>>,
  currentFocus = 0
): ViewAction {
  const focusProjection = getCombatFocusProjection(action, intent, currentFocus, disabled);
  return {
    id: `combat-${action}`,
    label,
    hint: focusProjection ? `${hint} · ${focusProjection}` : hint,
    disabled,
    onSelect: () => {
      state = performCombatAction(state, action);
    }
  };
}

function renderWeaponSkillState(status: ReturnType<typeof getWeaponSkillStatus>): string {
  const focusState = !status.definition
    ? 'unloaded'
    : status.currentFocus >= status.requiredFocus
      ? 'ready'
      : 'charging';
  const stateLabel = focusState === 'unloaded' ? '未装载' : focusState === 'ready' ? '战意已满' : '充能中';
  const detail = status.definition
    ? `${status.definition.name} · 战意蓄满后发动，持久战可重复充能`
    : `${status.weaponName}没有武器战技`;
  const resonance = status.resonance ?? getCurrentWeaponResonanceProgress(state);
  const segments = Array.from({ length: status.requiredFocus }, (_, index) =>
    `<span class="focus-segment ${index < status.currentFocus ? 'filled' : ''}" aria-hidden="true"></span>`
  ).join('');

  return `<div
    class="weapon-skill-state state-${focusState}"
    data-weapon-skill-state="${focusState}"
    data-weapon-focus-state="${focusState}"
    data-focus-current="${status.currentFocus}"
    data-focus-max="${status.requiredFocus}"
    ${status.definition ? `data-weapon-skill-name="${status.definition.name}"` : ''}
    aria-live="polite"
  >
    <span class="weapon-skill-label">武器战技</span>
    <strong class="weapon-skill-status">${stateLabel}</strong>
    <div
      class="weapon-focus-meter"
      data-weapon-focus="true"
      data-focus-current="${status.currentFocus}"
      data-focus-max="${status.requiredFocus}"
      aria-label="战意 ${status.currentFocus}/${status.requiredFocus}"
    >${segments}<b>${status.currentFocus}/${status.requiredFocus}</b></div>
    <small class="weapon-skill-detail">${detail}</small>
    ${renderWeaponResonance(resonance, 'combat')}
  </div>`;
}

function renderCapturePanel(actions: ViewAction[]): string {
  if (!state.combat) return '';

  const monster = getCombatEncounterProfile(state)?.monster ?? MONSTERS[state.combat.monsterId];
  const methodAvailable = isCurrentDungeonFeatureAvailable(state, 'method');
  const consumableAvailable = isCurrentDungeonFeatureAvailable(state, 'consumable');
  const candidates = petIds.filter((petId) => {
    const pet = PETS[petId];
    return pet.source === 'capture' && pet.captureFrom === monster.id;
  });
  if (!candidates.length) return '';

  const thresholdRatio = methodAvailable && state.learnedMethods.includes('beast_taming') ? 0.5 : 0.35;
  const weakThreshold = Math.floor(monster.maxHp * thresholdRatio);

  const notices = candidates
    .map((petId) => {
      const pet = PETS[petId];
      const captureItem = pet.captureItem ?? 'capture_net';
      const owned = state.ownedPets.includes(petId);
      const hasItem = state.inventory[captureItem] > 0;
      const isWeak = state.combat ? state.combat.monsterHp <= weakThreshold : false;
      const disabled = owned || !consumableAvailable || !hasItem || !isWeak;
      const status = owned
        ? '已拥有'
        : !consumableAvailable
          ? '场域封存'
          : !hasItem
          ? `缺少${ITEMS[captureItem].name}`
          : isWeak
            ? '可捕获'
            : `压低至 ${weakThreshold} 血`;
      const action: ViewAction = {
        id: `capture-${petId}`,
        label: '捕获',
        hint: status,
        disabled,
        onSelect: () => {
          state = capturePet(state, petId);
        }
      };
      actions.push(action);

      return `<div class="capture-row ${isWeak && hasItem && consumableAvailable && !owned ? 'capture-ready' : ''}">
        <div>
          <span class="eyebrow">可捕获目标</span>
          <strong>${pet.name}</strong>
          <small>${ITEMS[captureItem].name} x${state.inventory[captureItem]} / ${formatBonus(pet.bonus)}</small>
        </div>
        ${actionButton(action, 'button capture-button')}
      </div>`;
    })
    .join('');

  return `<div class="capture-panel">${notices}</div>`;
}

function renderCombatSoulSkillToolbar(actions: ViewAction[]): string {
  const statuses = (['spirit_grounding', 'gauntlet_breakbeat'] as const)
    .map((skillId) => getEquipmentSoulSkillActionStatus(state, skillId))
    .filter(({ frozen }) => frozen);
  if (!statuses.length) return '';

  const buttons = statuses.map((status) => {
    const action: ViewAction = {
      id: `combat-soul-skill-${status.skillId}`,
      label: status.definition.name,
      hint: status.available ? status.definition.description : status.unavailableReason,
      disabled: !status.available,
      onSelect: () => {
        state = useEquipmentSoulSkill(state, status.skillId);
      }
    };
    actions.push(action);
    return equipmentSoulSkillButton(action, status, 'button combat-soul-skill-button');
  }).join('');

  return `<div class="combat-soul-skill-toolbar" data-soul-skill-context="combat">
    <div><span>器魂工具</span><small>即时发动 · 不消耗回合、战意或普通动作</small></div>
    <div class="button-row">${buttons}</div>
  </div>`;
}

function renderCompanionAssistCommand(actions: ViewAction[]): string {
  const status = getCurrentCompanionAssistStatus(state);
  if (!status.snapshot || !status.definition) return '';

  const action: ViewAction = {
    id: 'use-companion-assist',
    label: status.definition.assistName,
    hint: status.available
      ? `${status.definition.name} · ${formatCompanionAssist(status.snapshot)}`
      : status.unavailableReason,
    disabled: !status.available,
    onSelect: () => {
      state = useCompanionAssist(state);
    }
  };
  actions.push(action);

  return `<div class="companion-assist-command ${status.reason ?? 'ready'}"
    data-companion-assist="${status.available ? 'ready' : status.reason ?? 'disabled'}"
    aria-live="polite">
    <div><span>同伴助战 · ${status.definition.name} R${status.snapshot.rank}</span><small>${formatCompanionAssist(status.snapshot)}</small></div>
    ${actionButton(action, 'button companion-assist-button')}
  </div>`;
}

function renderMethodTechniqueCommand(actions: ViewAction[]): string {
  const snapshots = getCurrentRunMethodSnapshots(state);
  if (snapshots.length === 0) {
    const status = getCurrentMethodTechniqueStatus(state);
    const action: ViewAction = {
      id: 'use-method-technique',
      label: '功法技',
      hint: status.unavailableReason,
      disabled: true,
      onSelect: () => undefined
    };
    actions.push(action);
    return `<div class="method-technique-command ${status.reason ?? 'disabled'}"
      data-method-technique="${status.reason ?? 'disabled'}" aria-live="polite">
      <div><span>功法战技库</span><small>${status.unavailableReason ?? '本局未启用'}</small></div>
      ${actionButton(action, 'button method-technique-button')}
    </div>`;
  }

  const options = snapshots.map((snapshot) => {
    const status = getCurrentMethodTechniqueStatus(state, snapshot.methodId);
    const action: ViewAction = {
      id: `use-method-technique-${snapshot.methodId}`,
      label: status.definition?.name ?? '功法技',
      hint: status.available ? formatMethodTechnique(snapshot) : status.unavailableReason,
      disabled: !status.available,
      onSelect: () => {
        state = useMethodTechnique(state, snapshot.methodId) as EquipmentMemoryGameState;
      }
    };
    actions.push(action);
    const techniqueState = status.available ? 'ready' : status.reason ?? 'disabled';
    return `<div class="method-technique-option ${techniqueState}" data-method-id="${snapshot.methodId}">
      <div><span>${METHODS[snapshot.methodId].name} · R${snapshot.rank}</span><small>${formatMethodTechnique(snapshot)}</small></div>
      ${actionButton(action, 'button method-technique-button')}
    </div>`;
  }).join('');

  return `<div class="method-technique-command method-technique-library ready"
    data-method-technique="library" data-method-technique-count="${snapshots.length}" aria-live="polite">
    <div class="method-technique-library-heading"><span>功法战技库</span><small>每门战技每场可发动一次</small></div>
    <div class="method-technique-options">${options}</div>
  </div>`;
}

function renderBloodlineSurgeCommand(actions: ViewAction[]): string {
  const status = getCurrentBloodlineSurgeStatus(state);
  const definition = status.snapshot ? getBloodlineDefinition(status.snapshot.bloodlineId) : undefined;
  const action: ViewAction = {
    id: 'use-bloodline-surge',
    label: '血统爆发',
    hint: status.available && status.snapshot
      ? formatBloodlineSurge(status.snapshot)
      : status.unavailableReason ?? '本局未启用',
    disabled: !status.available,
    onSelect: () => {
      state = useBloodlineSurge(state) as EquipmentMemoryGameState;
    }
  };
  actions.push(action);
  const surgeState = status.available ? 'ready' : status.reason ?? 'disabled';

  return `<div class="bloodline-surge-command ${surgeState}"
    data-bloodline-surge="${surgeState}"
    data-bloodline-barrier="${state.combat?.bloodlineBarrier ?? 0}"
    aria-live="polite">
    <div><span>血统爆发${definition && status.snapshot ? ` · ${definition.name} R${status.snapshot.rank}` : ''}</span><small>${action.hint}</small></div>
    ${actionButton(action, 'button bloodline-surge-button')}
  </div>`;
}

function renderCombat(actions: ViewAction[]): string {
  if (!state.combat) return '';

  const encounter = getCombatEncounterProfile(state);
  const monster = encounter?.monster ?? MONSTERS[state.combat.monsterId];
  const boss = encounter?.boss;
  const encounterName = boss?.definition.bossTitle ?? monster.name;
  const bossPhaseLabel = boss
    ? boss.phase === 'awakened'
      ? boss.definition.awakenedPhaseName
      : '封印阶段'
    : '';
  const stats = getDerivedStats(state);
  const activePet = state.activePet ? PETS[state.activePet] : undefined;
  const activePetLevel = state.activePet ? state.petLevels[state.activePet] ?? 1 : 0;
  const methodUnavailableReason = getDungeonFeatureUnavailableReason('method');
  const consumableUnavailableReason = getDungeonFeatureUnavailableReason('consumable');
  const petUnavailableReason = getDungeonFeatureUnavailableReason('pet');
  const hasCloudStep = !methodUnavailableReason && state.learnedMethods.includes('cloud_step');
  const hasIronBody = !methodUnavailableReason && state.learnedMethods.includes('iron_body');
  const cloudStepAttackBonus =
    hasCloudStep && stats.speed > monster.speed ? Math.max(1, Math.floor((stats.speed - monster.speed) / 2)) : 0;
  const attackHint = hasCloudStep
    ? cloudStepAttackBonus > 0
      ? `${stats.attack} 攻击 / 云隙步游斗 +${cloudStepAttackBonus}`
      : `${stats.attack} 攻击 / 云隙步需抢速`
    : `${stats.attack} 攻击`;
  const guardHint = hasIronBody ? '铁衣诀守反/减伤' : '本回合减伤';
  const escapeHint = hasCloudStep ? '成功后代价 2' : '速度检定';
  const weaponSkillStatus = getWeaponSkillStatus(state);
  const combatIntent = getCurrentCombatIntent(state);
  const combatActions: ViewAction[] = [
    combatAction('attack', '攻击', attackHint, false, combatIntent, weaponSkillStatus.currentFocus),
    combatAction(
      'art',
      '功法',
      methodUnavailableReason ?? `${stats.artPower} 术强`,
      Boolean(methodUnavailableReason),
      combatIntent,
      weaponSkillStatus.currentFocus
    ),
  ];
  if (weaponSkillStatus.definition) {
    combatActions.push(
      combatAction(
        'weapon_skill',
        weaponSkillStatus.definition.name,
        weaponSkillStatus.available
          ? `战意 ${weaponSkillStatus.currentFocus}/${weaponSkillStatus.requiredFocus}`
          : weaponSkillStatus.unavailableReason ?? `战意 ${weaponSkillStatus.currentFocus}/${weaponSkillStatus.requiredFocus}`,
        !weaponSkillStatus.available,
        combatIntent,
        weaponSkillStatus.currentFocus
      )
    );
  }
  combatActions.push(
    combatAction('guard', '防御', guardHint, false, combatIntent, weaponSkillStatus.currentFocus),
    combatAction(
      'use_healing_pill',
      '止血丹',
      consumableUnavailableReason ?? `x${state.inventory.healing_pill}`,
      Boolean(consumableUnavailableReason) || state.inventory.healing_pill <= 0,
      combatIntent,
      weaponSkillStatus.currentFocus
    ),
    combatAction(
      'use_thunder_talisman',
      '雷火符',
      consumableUnavailableReason ?? `x${state.inventory.thunder_talisman}`,
      Boolean(consumableUnavailableReason) || state.inventory.thunder_talisman <= 0,
      combatIntent,
      weaponSkillStatus.currentFocus
    ),
    combatAction('escape', '撤离', escapeHint, false, combatIntent, weaponSkillStatus.currentFocus)
  );
  actions.push(...combatActions);

  return `<section class="panel combat-panel wide-panel ${boss ? `boss-combat boss-phase-${boss.phase}` : ''}"
    ${boss ? `data-boss-phase="${boss.phase}" data-boss-max-hp="${monster.maxHp}"` : ''}>
    <div class="panel-title">
      <span class="eyebrow">回合 ${state.combat.turn}${boss ? ' · 首领战' : ''}</span>
      <h2>${encounterName}</h2>
    </div>
    ${renderRunProtocolStatus()}
    ${renderRouteContractStatus()}
    ${renderRunPressureStatus()}
    ${renderRunCompanionStatus()}
    ${renderRunMethodStatus()}
    ${renderRunEquipmentMemoryHuntStatus()}
    ${renderEquipmentMemoryCombatStatus()}
    ${renderDungeonLawStatus()}
    ${renderBroadcastMapStatus()}
    ${renderShelterMapStatus()}
    ${renderVerdictMapStatus()}
    ${renderCombatReplayMapStatus()}
    ${
      boss
        ? `<div class="boss-combat-status" aria-live="polite">
            <span class="boss-phase-label">${bossPhaseLabel}</span>
            <small>「${boss.definition.sealName}」镇守者</small>
            <strong>强化生命 ${monster.maxHp}</strong>
          </div>`
        : ''
    }
    ${combatIntent ? renderCombatIntent(combatIntent, weaponSkillStatus) : ''}
    ${renderExplorationGuide()}
    <div class="battlefield">
      <div class="side enemy-side">
        <div class="slot empty"></div>
        <div class="slot enemy-token">
          ${renderGameAsset('monster', state.combat.monsterId, 'combat-portrait enemy-portrait', { decorative: true, loading: 'eager' })}
          <strong>${encounterName}</strong>
          <span>${state.combat.monsterHp}/${monster.maxHp}</span>
          <small>${boss ? `${monster.name} · ${monster.ability}` : monster.ability}</small>
        </div>
        <div class="slot empty"></div>
      </div>
      <div class="battleline">战线</div>
      <div class="side player-side">
        <div class="slot player-token" data-player-hp="${state.player.hp}" data-player-max-hp="${stats.maxHp}">
          ${renderGameAsset('character', 'reincarnator', 'combat-portrait player-portrait', { decorative: true, loading: 'eager' })}
          <strong>你</strong>
          <span>生命 ${state.player.hp}/${stats.maxHp}</span>
          <small>防 ${stats.defense} / 速 ${stats.speed}${state.combat.bloodlineBarrier ? ` / 屏障 ${state.combat.bloodlineBarrier}` : ''}</small>
        </div>
        <div class="slot support-token">
          ${renderGameAsset('equipment', state.equipped.charm, 'combat-portrait support-portrait', { decorative: true })}
          <strong>${EQUIPMENT[state.equipped.charm].name}</strong>
          <span>术强 ${stats.artPower}</span>
          <small>后排支援</small>
        </div>
        ${
          activePet
            ? petUnavailableReason
              ? `<div class="slot pet-token sealed" data-pet-availability="sealed">
                  ${renderGameAsset('pet', activePet.id, 'combat-portrait pet-portrait', { decorative: true })}
                  <strong>${activePet.name}</strong>
                  <span>被封存</span>
                  <small>${petUnavailableReason}，暂不助战</small>
                </div>`
              : `<div class="slot pet-token" data-pet-availability="available">
                ${renderGameAsset('pet', activePet.id, 'combat-portrait pet-portrait', { decorative: true })}
                <strong>${activePet.name}</strong>
                <span>Lv.${activePetLevel}</span>
                <small>${formatBonus(activePet.bonus)}</small>
              </div>`
            : '<div class="slot empty"></div>'
        }
      </div>
    </div>
    ${renderCapturePanel(actions)}
    <div class="combat-command-area">
      ${renderWeaponSkillState(weaponSkillStatus)}
      ${renderCombatSoulSkillToolbar(actions)}
      ${renderCompanionAssistCommand(actions)}
      ${renderMethodTechniqueCommand(actions)}
      ${renderBloodlineSurgeCommand(actions)}
      <div class="button-row combat-actions">
        ${combatActions
          .map((action) => {
            const actionType = action.id.slice('combat-'.length) as CombatAction;
            const className = [
              'button',
              actionType === 'weapon_skill' ? 'weapon-skill-button' : '',
              combatIntent ? getCombatIntentActionClass(combatIntent, actionType) : ''
            ]
              .filter(Boolean)
              .join(' ');
            return actionButton(action, className);
          })
          .join('')}
      </div>
    </div>
    <div class="combat-log" aria-live="polite">
      <span class="combat-log-label">战斗记录</span>
      ${state.combat.log.map((line, index) => `<p${index === 0 ? ' class="latest"' : ''}>${line}</p>`).join('')}
    </div>
  </section>`;
}

function formatLastOutcome(outcome: string | undefined): { title: string; detail: string } {
  if (!outcome) return { title: '副本结束', detail: '本轮副本已经完成结算。' };

  const economy = outcome.match(/outcome=([^;]+);\s*score=([^;]+);\s*multiplier=([^;]+)x;\s*reward=([^;]+)/);
  if (economy) {
    const label = outcomeLabels[economy[1] as RunEconomyOutcome] ?? '稳定通关';
    return {
      title: `${label} / 评分 ${economy[2]} / 奖励倍率 x${economy[3]}`,
      detail: `主神发放 ${economy[4]} 奖励点，资源和材料已经入账。`
    };
  }

  if (outcome.includes('濒死')) return { title: '濒死回收', detail: outcome };
  return { title: '副本结算完成', detail: outcome };
}

function getResultExitStatus(outcome: string | undefined): RunExitStatus {
  if (outcome?.includes('outcome=failed_recovered')) return 'failed';
  if (outcome?.includes('outcome=retreat')) return 'retreated';
  return 'cleared';
}

function renderProtocolSettlement(): string {
  const protocol = getCurrentRunProtocol(state);
  if (!protocol) return '';

  if (state.run?.entryFlowVersion === 2) {
    const difficultyName = protocol.definition.id === 'standard'
      ? '普通'
      : protocol.definition.id === 'imprint'
        ? '困难'
        : '炼狱';
    const materialAmount = protocol.definition.id === 'standard' ? 1 : protocol.definition.id === 'imprint' ? 2 : 3;
    const materialName = ITEMS[DUNGEON_MATERIAL_REWARDS[state.run.dungeonId].itemId].name;
    const succeeded = protocol.definition.id === 'standard' || protocol.settlement?.status === 'succeeded';
    return `<div
      class="protocol-settlement difficulty ${succeeded ? 'succeeded' : 'failed'}"
      data-protocol-settlement="${succeeded ? 'succeeded' : 'failed'}"
      data-run-protocol="${protocol.definition.id}"
      data-protocol-bonus="${protocol.settlement?.rewardPointBonus ?? 0}"
    >
      <div><span>${difficultyName}难度</span><strong>${succeeded ? '挑战完成' : '挑战未完成'}</strong></div>
      <div class="protocol-settlement-rewards">
        <span>难度加成 <strong>+${protocol.settlement?.rewardPointBonus ?? 0} 奖励点</strong></span>
        <span>${materialName} <strong>+${succeeded ? materialAmount : 0}</strong></span>
      </div>
    </div>`;
  }

  if (protocol.definition.id === 'standard') {
    return `<div class="protocol-settlement standard" data-protocol-settlement="standard" data-run-protocol="standard">
      <strong>标准探索完成</strong>
      <span>本轮未启用额外协议，无刻印消耗、材料或协议加成。</span>
    </div>`;
  }

  const settlement = protocol.settlement;
  const succeeded = settlement?.status === 'succeeded';

  if (protocol.definition.id === 'deep') {
    const expectedMaterial = protocol.definition.materialReward;
    const grantedMaterial = settlement?.materialReward;
    const materialAmount = grantedMaterial?.itemId === expectedMaterial.itemId && isNonNegativeInteger(grantedMaterial.amount)
      ? grantedMaterial.amount
      : 0;
    return `<div
      class="protocol-settlement deep ${succeeded ? 'succeeded' : 'failed'}"
      data-protocol-settlement="${succeeded ? 'succeeded' : 'failed'}"
      data-run-protocol="deep"
      data-protocol-bonus="${settlement?.rewardPointBonus ?? 0}"
      data-cycle-imprint-consumed="true"
      data-deep-material-reward="${materialAmount}"
    >
      <div>
        <span>深层协议</span>
        <strong>${succeeded ? '成功' : '失败'} · ${protocol.definition.mutationName}</strong>
      </div>
      <div class="protocol-settlement-rewards">
        <span>轮回刻印 <strong>-1 · 入场已消耗</strong></span>
        <span>协议加成 <strong>+${settlement?.rewardPointBonus ?? 0}</strong></span>
        <span>${ITEMS[expectedMaterial.itemId].name} <strong>+${materialAmount}</strong></span>
      </div>
    </div>`;
  }

  return `<div
    class="protocol-settlement ${succeeded ? 'succeeded' : 'failed'}"
    data-protocol-settlement="${succeeded ? 'succeeded' : 'failed'}"
    data-run-protocol="imprint"
    data-protocol-bonus="${settlement?.rewardPointBonus ?? 0}"
    data-cycle-imprint-granted="${settlement?.cycleImprintGranted === true}"
  >
    <div>
      <span>烙印协议</span>
      <strong>${succeeded ? '成功' : '失败'} · ${protocol.definition.name}</strong>
    </div>
    <div class="protocol-settlement-rewards">
      <span>协议加成 <strong>+${settlement?.rewardPointBonus ?? 0}</strong></span>
      <span>${protocol.definition.imprint.name} / 轮回刻印 <strong>${settlement?.cycleImprintGranted ? '+1' : '+0'}</strong></span>
    </div>
  </div>`;
}

function renderRouteContractSettlement(): string {
  const settlement = normalizeSavedRouteContractSettlement(state.run?.lastRouteContractSettlement);
  if (!state.run || !settlement?.state) return '';

  const settlementDungeonId = settlement.state.dungeonId;
  const progress = getRouteContractProgress(settlement.state, settlementDungeonId);
  if (!progress.enabled || !progress.definition) return '';
  const display = getRouteContractDisplayStatus(settlement.state, settlementDungeonId);

  return `<div
    class="route-contract-settlement status-${progress.status}"
    data-route-contract-status="${progress.status}"
    data-route-contract-selected="${progress.definition.id}"
    data-route-contract-dungeon="${settlementDungeonId}"
    data-route-contract-reward-points="${settlement.rewardPoints}"
  >
    <div>
      <span>隐藏任务结算 · ${DUNGEONS[settlementDungeonId].name}</span>
      <strong>${display.label} · ${progress.definition.name}</strong>
      <small>${display.detail}</small>
    </div>
    <div class="route-contract-settlement-reward">
      <span>隐藏任务奖励 <strong>+${settlement.rewardPoints} 奖励点</strong></span>
    </div>
  </div>`;
}

function renderRunPressureSettlement(): string {
  const settlement = state.run?.lastPressureSettlement;
  if (settlement) {
    return `<div
      class="pressure-settlement tier-${settlement.tier}"
      data-pressure-status="settled"
      data-pressure-tier="${settlement.tier}"
      data-pressure-count="${settlement.state.clearedNodeCount}"
      data-pressure-bonus="${settlement.rewardPointBonus}"
    >
      <div>
        <span>侵蚀结算</span>
        <strong>${runPressureTierLabels[settlement.tier]} · ${settlement.state.clearedNodeCount} 个已清节点</strong>
      </div>
      <div class="pressure-settlement-reward">
        <span>出口侵蚀加成 <strong>+${settlement.rewardPointBonus} 奖励点</strong></span>
      </div>
    </div>`;
  }

  const pressure = getCurrentRunPressure(state);
  const status = pressure.status;
  if (!pressure.legacyDisabled && status?.state) {
    return `<div
      class="pressure-settlement no-bonus tier-${status.tier}"
      data-pressure-status="not-settled"
      data-pressure-tier="${status.tier}"
      data-pressure-count="${status.state.clearedNodeCount}"
      data-pressure-bonus="0"
    >
      <div>
        <span>侵蚀结算</span>
        <strong>${runPressureTierLabels[status.tier]} · ${status.state.clearedNodeCount} 个已清节点</strong>
      </div>
      <div class="pressure-settlement-reward"><span>未从出口结算 <strong>+0 奖励点</strong></span></div>
    </div>`;
  }

  return `<div
    class="pressure-settlement legacy"
    data-pressure-status="legacy-disabled"
    data-pressure-tier="legacy"
    data-pressure-count="0"
    data-pressure-bonus="0"
  >
    <div><span>侵蚀结算</span><strong>本轮未启用</strong></div>
    <div class="pressure-settlement-reward"><span>旧档不追溯计算 <strong>+0 奖励点</strong></span></div>
  </div>`;
}

function renderRunPursuitSettlement(): string {
  if (!state.run) return '';

  const settlement = normalizeSavedRunPursuitSettlement(state.run.lastPursuitSettlement);
  if (!settlement) {
    const pursuitState = state.run.pursuitState;
    const definition = getRunPursuitDefinition(pursuitState?.dungeonId ?? state.run.dungeonId);
    if (!definition) return '';
    const status = pursuitState?.status === 'disabled' ? 'disabled' : 'legacy';
    return `<div
      class="pursuit-settlement status-${status}"
      data-pursuit-settlement="${status}/none"
      data-pursuit-status="${status}"
      data-pursuit-reason="none"
      data-pursuit-rewarded="false"
      data-pursuit-material="${definition.materialId}"
      data-pursuit-origin-dungeon="${definition.dungeonId}"
    >
      <span><small>破界追兵结算 · ${DUNGEONS[definition.dungeonId].name}</small><strong>本轮未启用</strong></span>
      <span class="pursuit-settlement-result"><small>旧档或首通不追溯</small><strong>${ITEMS[definition.materialId].name} +0</strong></span>
    </div>`;
  }

  const { state: settledState, reason, materialId, rewarded } = settlement;
  const definition = getRunPursuitDefinition(settledState.dungeonId);
  if (!definition) return '';
  const materialName = ITEMS[materialId].name;
  const reasonLabels: Record<RunPursuitSettlement['reason'], string> = {
    successful_exit: '成功撤离',
    retreat: '主动撤退',
    failure: '濒死回收',
    stable_portal: '稳定门驱离',
    forced_portal: '强制门转移'
  };
  let title = '追猎结束，无材料';
  let detail = reasonLabels[reason];

  if (settledState.status === 'contained') {
    title = rewarded ? '收容成功，材料已带回' : '已完成收容，材料未带回';
    detail = rewarded
      ? `${definition.name} 已封存为 ${materialName} x1`
      : `${reasonLabels[reason]}，封存材料留在副本内`;
  } else if (settledState.status === 'fused') {
    title = reason === 'successful_exit' ? 'Boss 融合体已击破' : 'Boss 融合体未带回材料';
    detail = `首领增幅 +${definition.bossFusionPercent}% · ${materialName} +0`;
  } else if (settledState.status === 'repelled' && settledState.repelledReason === 'stable_portal') {
    title = '稳定门已驱离追兵';
    detail = `${definition.name} 未进入下一副本 · ${materialName} +0`;
  } else if (settledState.status === 'disabled') {
    title = '本轮未启用';
    detail = `首通不生成追兵 · ${materialName} +0`;
  }

  return `<div
    class="pursuit-settlement status-${settledState.status} ${rewarded ? 'rewarded' : 'unrewarded'}"
    data-pursuit-settlement="${settledState.status}/${reason}"
    data-pursuit-status="${settledState.status}"
    data-pursuit-reason="${reason}"
    data-pursuit-repelled-reason="${settledState.repelledReason ?? 'none'}"
    data-pursuit-rewarded="${rewarded}"
    data-pursuit-material="${materialId}"
    data-pursuit-origin-dungeon="${settledState.dungeonId}"
  >
    <span><small>破界追兵结算 · ${DUNGEONS[settledState.dungeonId].name}</small><strong>${title}</strong></span>
    <span class="pursuit-settlement-result"><small>${reasonLabels[reason]}</small><strong>${detail}</strong></span>
  </div>`;
}

function renderRunRelicSettlement(actions: ViewAction[]): string {
  const settlement = state.run?.lastRelicSettlement;
  if (!settlement) {
    return `<div class="relic-settlement legacy" data-relic-settlement="legacy-no-settlement">
      <div><span>回响归档</span><strong>旧档无遗物结算</strong></div>
      <p>本局没有可归档的回响遗物。</p>
    </div>`;
  }

  const frameName = getRunRelicFrameName(settlement.frame) ?? '未启用框架';
  const acquiredRelics = settlement.acquiredIds.flatMap((relicId) =>
    isRunRelicId(relicId) ? [RUN_RELIC_DEFINITIONS[relicId]] : []
  );
  const acquiredNames = acquiredRelics.length
    ? acquiredRelics.map((relic) => relic.name).join('、')
    : '无';

  if (settlement.status === 'pending') {
    const archiveButtons = acquiredRelics.map((relic) => {
      const action: ViewAction = {
        id: `archive-run-relic-${relic.id}`,
        label: `归档 ${relic.name}`,
        hint: '设为下一局种子',
        onSelect: () => {
          state = resolveRunRelicArchive(state, relic.id);
        }
      };
      actions.push(action);
      return `<button
        type="button"
        class="relic-archive-button"
        data-action="${action.id}"
        data-relic-archive="${relic.id}"
      ><strong>${action.label}</strong><small>${relic.description}</small></button>`;
    }).join('');
    const skipAction: ViewAction = {
      id: 'skip-run-relic-archive',
      label: '放弃归档',
      hint: '不保留种子',
      onSelect: () => {
        state = resolveRunRelicArchive(state);
      }
    };
    actions.push(skipAction);

    return `<div
      class="relic-settlement pending"
      data-relic-settlement="pending"
      data-relic-frame="${settlement.frame ?? 'none'}"
    >
      <div class="relic-settlement-heading"><span>回响归档 · ${frameName}</span><strong>选择一件带回主神空间</strong></div>
      <p>本局已获得：${acquiredNames}。归档后会自动设为下一局同框架种子。</p>
      <div class="relic-archive-actions">
        ${archiveButtons}
        <button
          type="button"
          class="relic-archive-button skip"
          data-action="${skipAction.id}"
          data-relic-archive="skip"
        ><strong>${skipAction.label}</strong><small>${skipAction.hint}</small></button>
      </div>
    </div>`;
  }

  if (settlement.status === 'archived') {
    const archivedName = getRunRelicName(settlement.archivedRelicId) ?? '已选遗物';
    return `<div class="relic-settlement archived" data-relic-settlement="archived">
      <div><span>回响归档 · ${frameName}</span><strong>${archivedName} 已归档</strong></div>
      <p>已加入主神空间归档，并设为下一局同框架种子。</p>
    </div>`;
  }

  if (settlement.status === 'lost') {
    return `<div class="relic-settlement lost" data-relic-settlement="lost">
      <div><span>回响归档 · ${frameName}</span><strong>本局遗物已遗失</strong></div>
      <p>${acquiredRelics.length ? `未能带回：${acquiredNames}。` : '本局没有形成可带回的遗物。'}撤退或濒死结算不能归档。</p>
    </div>`;
  }

  return `<div class="relic-settlement skipped" data-relic-settlement="skipped">
    <div><span>回响归档 · ${frameName}</span><strong>${acquiredRelics.length ? '已放弃本局归档' : '本局无可归档遗物'}</strong></div>
    <p>${acquiredRelics.length ? `已放弃：${acquiredNames}。下一局种子保持当前整备。` : '本局未获得遗物，直接结束归档。'}</p>
  </div>`;
}

function renderEquipmentCommissionSettlement(): string {
  const settlement = state.run?.lastEquipmentCommissionSettlement;
  if (!settlement) return '';

  const completedCount = settlement.completedDungeonIds.length;
  const equipmentNames = settlement.equipmentIds.map((equipmentId) => EQUIPMENT[equipmentId].name).join(' / ');
  const completedDungeonNames = settlement.completedDungeonIds
    .map((dungeonId) => DUNGEONS[dungeonId].name)
    .join(' / ');
  const completed = settlement.status === 'completed';

  return `<div
    class="equipment-commission-settlement ${settlement.status}"
    data-equipment-commission-settlement="${settlement.status}"
    data-equipment-commission-progress="${completedCount}/${EQUIPMENT_COMMISSION_REQUIRED_DUNGEONS}"
  >
    <div class="equipment-commission-settlement-heading">
      <span>${completed ? '装备委托完成' : '装备委托推进'}</span>
      <strong>${completedCount}/${EQUIPMENT_COMMISSION_REQUIRED_DUNGEONS}</strong>
    </div>
    <div class="equipment-commission-settlement-grid">
      <span><small>本次副本</small><strong>${DUNGEONS[settlement.dungeonId].name}</strong></span>
      <span><small>封存装备</small><strong>${equipmentNames}</strong></span>
      <span><small>不同副本</small><strong>${completedDungeonNames}</strong></span>
      <span><small>${completed ? '完成奖励' : '剩余进度'}</small><strong>${completed ? `${ITEMS[settlement.targetMaterialId].name} x${settlement.rewardAmount}` : `${EQUIPMENT_COMMISSION_REQUIRED_DUNGEONS - completedCount} 个不同副本`}</strong></span>
    </div>
  </div>`;
}

function renderEquipmentMemoryHuntSettlement(): string {
  const settlement = normalizeSavedEquipmentMemoryHuntSettlement(
    state.run?.lastEquipmentMemoryHuntSettlement
  );
  const hunt = settlement?.state;
  if (!settlement || !hunt) return '';
  const definition = getEquipmentMemoryById(hunt.memoryId);
  if (!definition) return '';
  const display = getEquipmentMemoryHuntDisplayStatus(hunt);

  return `<div
    class="equipment-memory-settlement status-${hunt.status}"
    data-equipment-memory-settlement="${hunt.status}"
    data-equipment-memory-granted="${settlement.granted}"
    data-equipment-memory-id="${hunt.memoryId}"
    data-equipment-memory-equipment="${hunt.equipmentId}"
  >
    <div><span>装备记忆结算 · ${DUNGEONS[hunt.dungeonId].name}</span><strong>${display.label} · ${definition.name}</strong><small>${EQUIPMENT[hunt.equipmentId].name}</small></div>
    <div class="equipment-memory-settlement-result">
      <span>${settlement.granted ? '已收录至装备记忆库' : '未收录，本局记忆不入库'}</span>
      <strong>额外奖励点 +0</strong>
    </div>
  </div>`;
}

function renderResult(actions: ViewAction[]): string {
  if (state.phase !== 'result') return '';
  const status = getResultExitStatus(state.lastOutcome);
  const outcome = formatLastOutcome(state.lastOutcome);

  const action: ViewAction = {
    id: 'return-hub',
    label: '返回主神空间',
    hint: state.run?.lastRelicSettlement?.status === 'pending' ? '先归档或放弃回响遗物' : '整理战利品',
    disabled: state.run?.lastRelicSettlement?.status === 'pending',
    onSelect: () => {
      state = returnToHub(state);
    }
  };
  actions.push(action);

  return `<section class="panel result-panel wide-panel">
    <span class="eyebrow">结算</span>
    <h2>${outcome.title}</h2>
    ${renderScoreStrip('结算评分', runEconomy(status))}
    ${renderProtocolSettlement()}
    ${renderEquipmentMemoryHuntSettlement()}
    ${renderRouteContractSettlement()}
    ${renderRunPressureSettlement()}
    ${renderRunPursuitSettlement()}
    ${renderEquipmentCommissionSettlement()}
    ${renderLootSettlement()}
    ${renderRunRelicSettlement(actions)}
    <p>${outcome.detail} 现在可以继续兑换、升级装备或学习功法，再进入更高风险的副本。</p>
    ${renderNextActionPanel(actions)}
    ${actionButton(action)}
  </section>`;
}

function formatEquipmentCommissionCost(cost: Cost): string {
  return `${cost.rewardPoints ?? 0} 奖励点 + ${cost.lingyun ?? 0} 灵蕴`;
}

function normalizeEquipmentCommissionSelection(
  status: ReturnType<typeof getEquipmentCommissionStatus>
): { equipmentIds: EquipmentId[]; materialIds: ItemId[] } {
  const candidateByEquipmentId = new Map(
    status.candidates.map((candidate) => [candidate.equipmentId, candidate])
  );
  const equipmentIds = selectedCommissionEquipmentIds
    .filter((equipmentId, index, ids) => candidateByEquipmentId.has(equipmentId) && ids.indexOf(equipmentId) === index)
    .slice(0, 2);
  const materialIds = equipmentIds
    .map((equipmentId) => candidateByEquipmentId.get(equipmentId)?.materialId)
    .filter((itemId, index, ids): itemId is ItemId => itemId !== undefined && ids.indexOf(itemId) === index);

  selectedCommissionEquipmentIds = equipmentIds;
  if (selectedCommissionMaterialId && !materialIds.includes(selectedCommissionMaterialId)) {
    selectedCommissionMaterialId = undefined;
  }

  return { equipmentIds, materialIds };
}

function renderIdleEquipmentCommission(
  actions: ViewAction[],
  status: ReturnType<typeof getEquipmentCommissionStatus>
): string {
  const selection = normalizeEquipmentCommissionSelection(status);
  const candidateRows = status.candidates.map((candidate) => {
    const selected = selection.equipmentIds.includes(candidate.equipmentId);
    const selectionFull = selection.equipmentIds.length >= 2 && !selected;
    const action: ViewAction = {
      id: `select-equipment-commission-equipment-${candidate.equipmentId}`,
      label: EQUIPMENT[candidate.equipmentId].name,
      persist: false,
      disabled: selectionFull,
      onSelect: () => {
        selectedCommissionEquipmentIds = selected
          ? selectedCommissionEquipmentIds.filter((equipmentId) => equipmentId !== candidate.equipmentId)
          : [...selectedCommissionEquipmentIds, candidate.equipmentId].slice(0, 2);
        const selectedCandidates = status.candidates.filter((entry) =>
          selectedCommissionEquipmentIds.includes(entry.equipmentId)
        );
        if (
          selectedCommissionMaterialId &&
          !selectedCandidates.some((entry) => entry.materialId === selectedCommissionMaterialId)
        ) {
          selectedCommissionMaterialId = undefined;
        }
      }
    };
    actions.push(action);

    return `<button
      class="equipment-commission-equipment-row ${selected ? 'selected' : ''}"
      type="button"
      data-action="${action.id}"
      data-commission-equipment="${candidate.equipmentId}"
      aria-pressed="${selected}"
      ${selectionFull ? 'disabled' : ''}
    >
      <span><strong>${EQUIPMENT[candidate.equipmentId].name}</strong><small>${slotLabels[EQUIPMENT[candidate.equipmentId].slot]} · 满级</small></span>
      <span><small>目标材料</small><strong>${ITEMS[candidate.materialId].name}</strong></span>
      <b>${selected ? '已选' : selectionFull ? '已满' : '选择'}</b>
    </button>`;
  }).join('');
  const materialOptions = selection.materialIds.map((itemId) => {
    const selected = selectedCommissionMaterialId === itemId;
    const action: ViewAction = {
      id: `select-equipment-commission-material-${itemId}`,
      label: ITEMS[itemId].name,
      persist: false,
      onSelect: () => {
        selectedCommissionMaterialId = itemId;
      }
    };
    actions.push(action);

    return `<button
      class="equipment-commission-material-option ${selected ? 'selected' : ''}"
      type="button"
      data-action="${action.id}"
      data-commission-material="${itemId}"
      aria-pressed="${selected}"
    ><span>${ITEMS[itemId].name}</span><small>x${status.materialReward}</small></button>`;
  }).join('');
  const hasTwoEquipment = selection.equipmentIds.length === 2;
  const hasValidMaterial = Boolean(
    selectedCommissionMaterialId && selection.materialIds.includes(selectedCommissionMaterialId)
  );
  const hasResources = canPay(status.cost);
  const startDisabled = state.phase !== 'hub' || !hasTwoEquipment || !hasValidMaterial || !hasResources;
  const startHint = state.phase !== 'hub'
    ? '仅可在主神空间启动'
    : !hasTwoEquipment
      ? `已选 ${selection.equipmentIds.length}/2`
      : !hasValidMaterial
        ? '请选择目标材料'
        : !hasResources
          ? '资源不足'
          : formatEquipmentCommissionCost(status.cost);
  const startAction: ViewAction = {
    id: 'start-equipment-commission',
    label: '启动委托',
    hint: startHint,
    disabled: startDisabled,
    onSelect: () => {
      if (selection.equipmentIds.length !== 2 || !selectedCommissionMaterialId) return;
      state = startEquipmentCommission(
        state,
        [selection.equipmentIds[0], selection.equipmentIds[1]],
        selectedCommissionMaterialId
      );
      if (state.equipmentCommission) {
        selectedCommissionEquipmentIds = [];
        selectedCommissionMaterialId = undefined;
      }
    }
  };
  actions.push(startAction);

  return `<div class="equipment-commission-content idle" data-equipment-commission-status="idle">
    <div class="equipment-commission-metrics" aria-label="委托条件">
      <span><small>启动消耗</small><strong>${formatEquipmentCommissionCost(status.cost)}</strong></span>
      <span><small>成功撤离</small><strong>${status.requiredDungeonCount} 个不同副本</strong></span>
      <span><small>完成奖励</small><strong>目标材料 x${status.materialReward}</strong></span>
    </div>
    <div class="equipment-commission-section-heading"><strong>封存装备</strong><span>${selection.equipmentIds.length}/2</span></div>
    <div class="equipment-commission-equipment-list" role="group" aria-label="选择两件封存装备">
      ${candidateRows || '<p class="equipment-commission-empty">暂无符合条件的满级未装备装备。</p>'}
    </div>
    <div class="equipment-commission-section-heading"><strong>目标材料</strong><span>${selectedCommissionMaterialId ? ITEMS[selectedCommissionMaterialId].name : '未选'}</span></div>
    <div class="equipment-commission-material-options" role="group" aria-label="选择目标材料">
      ${materialOptions || '<p class="equipment-commission-empty">先选择封存装备。</p>'}
    </div>
    <div class="equipment-commission-footer">
      <span>不同副本成功撤离 0/${status.requiredDungeonCount}</span>
      ${actionButton(startAction, 'button equipment-commission-start')}
    </div>
  </div>`;
}

function renderActiveEquipmentCommission(
  actions: ViewAction[],
  status: ReturnType<typeof getEquipmentCommissionStatus>
): string {
  const active = status.active;
  if (!active) return '';

  const completedCount = active.completedDungeonIds.length;
  const remainingCount = Math.max(0, status.requiredDungeonCount - completedCount);
  const completedDungeonNames = active.completedDungeonIds.length
    ? active.completedDungeonIds.map((dungeonId) => DUNGEONS[dungeonId].name).join(' / ')
    : '尚无';
  const recallAction: ViewAction = {
    id: 'recall-equipment-commission',
    label: '撤回委托',
    hint: state.phase === 'hub' ? '不返还启动消耗' : '仅可在主神空间撤回',
    disabled: state.phase !== 'hub',
    onSelect: () => {
      state = recallEquipmentCommission(state);
      if (!state.equipmentCommission) {
        selectedCommissionEquipmentIds = [];
        selectedCommissionMaterialId = undefined;
      }
    }
  };
  actions.push(recallAction);

  return `<div class="equipment-commission-content active" data-equipment-commission-status="active">
    <div class="equipment-commission-active-summary">
      <span><small>目标材料</small><strong>${ITEMS[active.targetMaterialId].name} x${status.materialReward}</strong></span>
      <span><small>委托进度</small><strong>${completedCount}/${status.requiredDungeonCount}</strong></span>
      <span><small>剩余</small><strong>${remainingCount} 个不同副本</strong></span>
    </div>
    <div class="equipment-commission-section-heading"><strong>封存中</strong><span>${active.equipmentIds.length} 件</span></div>
    <div class="equipment-commission-sealed-list">
      ${active.equipmentIds.map((equipmentId) => `<span data-commission-sealed-equipment="${equipmentId}"><strong>${EQUIPMENT[equipmentId].name}</strong><small>${slotLabels[EQUIPMENT[equipmentId].slot]}</small><b>封存中</b></span>`).join('')}
    </div>
    <div class="equipment-commission-progress" role="status">
      <span>已完成不同副本</span>
      <strong>${completedCount}/${status.requiredDungeonCount}</strong>
      <small>${completedDungeonNames}</small>
    </div>
    <div class="equipment-commission-footer">
      <span>完成后获得 ${ITEMS[active.targetMaterialId].name} x${status.materialReward}</span>
      ${actionButton(recallAction, 'button secondary equipment-commission-recall')}
    </div>
  </div>`;
}

function renderEquipmentCommissionModal(actions: ViewAction[]): string {
  if (!isEquipmentCommissionModalOpen) return '';

  const status = getEquipmentCommissionStatus(state);
  const closeAction: ViewAction = {
    id: 'close-equipment-commission',
    label: '关闭',
    persist: false,
    onSelect: () => {
      isEquipmentCommissionModalOpen = false;
    }
  };
  actions.push(closeAction);

  return `<div class="equipment-commission-modal">
    <button class="equipment-commission-backdrop" type="button" data-action="${closeAction.id}" aria-label="关闭装备封存委托"></button>
    <section class="equipment-commission-sheet" role="dialog" aria-modal="true" aria-labelledby="equipment-commission-title" tabindex="-1">
      <div class="equipment-commission-header">
        <div><span class="eyebrow">装备封存</span><h2 id="equipment-commission-title">委托</h2></div>
        ${actionButton(closeAction, 'button secondary equipment-commission-close')}
      </div>
      ${status.active ? renderActiveEquipmentCommission(actions, status) : renderIdleEquipmentCommission(actions, status)}
    </section>
  </div>`;
}

function renderCausalLedgerModal(actions: ViewAction[]): string {
  const status = getPendingCausalLedgerStatus();
  if (!status) return '';

  const dungeon = state.run ? DUNGEONS[state.run.dungeonId] : undefined;
  const nodeTitle = dungeon?.nodes.find((node) => node.id === status.pendingLedgerNodeId)?.title ?? '当前节点';
  const choiceMeta: Record<CausalLedgerChoice, { label: string; effect: string }> = {
    balance: { label: '平衡', effect: '债务不变 · 原样归档' },
    overdraw: { label: '透支', effect: '生命回复 10% · 奖励点 +108 · 普通情况债务 +1（因果视镜可免首次增债）' },
    repay: { label: '偿还', effect: `支付最大生命 ${status.repayDamagePercent}% · 债务 -1` }
  };
  const choices: readonly CausalLedgerChoice[] = ['balance', 'overdraw', 'repay'];
  const buttons = choices.map((choice) => {
    const choiceStatus = status.choices[choice];
    const meta = choiceMeta[choice];
    const disabledReason = choiceStatus.unavailableReason;
    const action: ViewAction = {
      id: `causal-ledger-${choice}`,
      label: meta.label,
      hint: choiceStatus.available ? meta.effect : disabledReason ?? '当前不可用',
      disabled: !choiceStatus.available,
      onSelect: () => {
        state = gameApi.resolveCausalLedger(state, choice);
      }
    };
    actions.push(action);

    return `<button
      class="button causal-ledger-choice causal-ledger-choice-${choice}"
      data-action="${action.id}"
      data-causal-ledger-choice="${choice}"
      aria-describedby="causal-ledger-${choice}-detail"
      ${action.disabled ? 'disabled aria-disabled="true"' : 'aria-disabled="false"'}
    >
      <span>${meta.label}</span>
      <small id="causal-ledger-${choice}-detail">${choiceStatus.available ? meta.effect : `禁用：${disabledReason ?? '当前不可用'}`}</small>
    </button>`;
  }).join('');

  return `<div class="causal-ledger-modal" data-causal-ledger-pending="true">
    <div class="causal-ledger-backdrop" aria-hidden="true"></div>
    <section
      class="causal-ledger-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="causal-ledger-title"
      aria-describedby="causal-ledger-description"
      tabindex="-1"
    >
      <div class="causal-ledger-header">
        <div>
          <span class="eyebrow">因果清算所 · 强制结算</span>
          <h2 id="causal-ledger-title">因果账本</h2>
        </div>
        <strong class="causal-ledger-debt">债务 ${status.debt}/4</strong>
      </div>
      <p id="causal-ledger-description" class="causal-ledger-description">${nodeTitle} 已生成待平账记录。完成结算后才能继续剧情与地图探索。</p>
      <div class="causal-ledger-metrics">
        <span><small>当前债务</small><strong>${status.debt}/4</strong></span>
        <span><small>透支收益</small><strong>10% +108</strong><b>生命回复 / 奖励点</b></span>
        <span><small>偿还代价</small><strong>${status.repayDamagePercent}%</strong><b>最大生命</b></span>
      </div>
      <div class="causal-ledger-choices" role="group" aria-label="因果账本结算选项">
        ${buttons}
      </div>
    </section>
  </div>`;
}

function renderLog(): string {
  return `<section class="panel log-panel wide-panel">
    <div class="panel-title">
      <span class="eyebrow">主神记录</span>
      <h2>最近事件</h2>
    </div>
    <ul>${state.log.map((line) => `<li>${line}</li>`).join('')}</ul>
  </section>`;
}

function renderMethodModal(actions: ViewAction[]): string {
  if (!isMethodPanelOpen) return '';

  const progress = getUiMethodProgress();
  const runSnapshots = getCurrentRunMethodSnapshots(state);
  const readOnly = Boolean(state.run);
  const closeAction: ViewAction = {
    id: 'close-method-panel',
    label: '关闭',
    persist: false,
    onSelect: () => {
      isMethodPanelOpen = false;
    }
  };
  actions.push(closeAction);

  const cards = methodShop.map((methodId) => {
    const method = METHODS[methodId];
    const technique = METHOD_TECHNIQUE_CATALOG.find((entry) => entry.methodId === methodId)!;
    const rank = getCultivationMethodRank(methodId, progress);
    const learned = rank !== undefined;
    const active = progress.activeMethod === methodId;
    const upgrade = getMethodUpgradeStatus(methodId, progress)!;
    const learnAction: ViewAction = {
      id: `learn-${methodId}`,
      label: '学习',
      hint: readOnly ? '本局功法库已冻结' : formatCost(method.cost),
      disabled: readOnly || learned || !canAffordCost(method.cost),
      onSelect: () => {
        state = learnMethod(state, methodId) as EquipmentMemoryGameState;
      }
    };
    const activateAction: ViewAction = {
      id: `activate-method-${methodId}`,
      label: active ? '常用功法' : '设为常用',
      hint: readOnly
        ? '本局功法库已冻结'
        : active
          ? '只影响战斗栏排序，不限制其他功法'
          : '下次入场优先展示，不限制其他功法',
      disabled: readOnly || !learned || active,
      onSelect: () => {
        state = activateMethod(state, methodId) as EquipmentMemoryGameState;
      }
    };
    const upgradeAction: ViewAction = {
      id: `upgrade-method-${methodId}`,
      label: upgrade.state === 'max_rank' ? '已满阶' : `晋升 R${upgrade.targetRank ?? 2}`,
      hint: readOnly
        ? '本局功法库已冻结'
        : upgrade.cost
          ? formatCost(upgrade.cost)
          : upgrade.state === 'max_rank'
            ? 'R3'
            : '需先学习',
      disabled: readOnly || upgrade.state !== 'upgradeable' || !upgrade.cost || !canAffordCost(upgrade.cost),
      onSelect: () => {
        state = upgradeMethod(state, methodId) as EquipmentMemoryGameState;
      }
    };
    if (learned) actions.push(activateAction, upgradeAction);
    else actions.push(learnAction);

    const techniqueRows = ([1, 2, 3] as const).map((effectRank) => {
      const snapshot: MethodRunSnapshot = {
        rulesVersion: METHOD_CULTIVATION_RULES_VERSION,
        methodId,
        rank: effectRank
      };
      return `<span class="${rank === effectRank ? 'current' : ''}"><small>R${effectRank}</small><strong>${formatMethodTechnique(snapshot)}</strong></span>`;
    }).join('');
    const command = learned
      ? `${actionButton(activateAction, 'button secondary method-activate')}${actionButton(upgradeAction, 'button method-upgrade')}`
      : actionButton(learnAction, 'button method-learn');

    return `<article class="method-card ${learned ? 'learned' : ''} ${active ? 'active' : ''}"
      data-method-id="${methodId}"
      data-method-learned="${learned}"
      data-method-rank="${rank ?? 0}"
      data-method-active="${active}">
      <div class="method-card-heading">
        <div><span class="eyebrow">${technique.name}</span><h3>${method.name}</h3></div>
        <strong>${learned ? `R${rank}` : '未学'}</strong>
      </div>
      <p>${method.description} ${method.passive}</p>
      <div class="method-costs">
        <span><small>学习</small><strong>${formatCost(method.cost)}</strong></span>
        <span><small>R2 晋升</small><strong>${formatCost(getMethodUpgradeCost(methodId, 2))}</strong></span>
        <span><small>R3 晋升</small><strong>${formatCost(getMethodUpgradeCost(methodId, 3))}</strong></span>
      </div>
      <div class="method-technique-heading"><span>战技 · 每场一次</span><small>${technique.requiresActivePet ? '需要出战宠物' : '即时发动'}</small></div>
      <div class="method-rank-effects">${techniqueRows}</div>
      <div class="method-card-footer"><div class="button-row">${command}</div></div>
    </article>`;
  }).join('');

  const snapshotSummary = runSnapshots.length > 0
    ? `<div class="method-frozen-summary" data-frozen-method="library" data-frozen-method-count="${runSnapshots.length}">
        <span><small>本局功法库</small><strong>${runSnapshots.length} 门已冻结，全部可用</strong></span>
        <span><small>功法与战技</small><strong>${runSnapshots.map((snapshot) => `${METHODS[snapshot.methodId].name} R${snapshot.rank} · ${getMethodTechniqueDefinition(snapshot.methodId)?.name ?? '战技'}`).join(' / ')}</strong></span>
      </div>`
    : readOnly
      ? '<div class="method-frozen-summary disabled" data-frozen-method="disabled" data-frozen-method-count="0"><span><small>本局功法库</small><strong>入场时没有已学功法，或旧副本尚未刷新</strong></span></div>'
      : '<div class="method-frozen-summary"><span><small>下次入场</small><strong>所有已学功法与位阶都会冻结并可使用；常用功法仅优先展示</strong></span></div>';

  return `<div class="method-modal" data-method-sheet="open">
    <button class="method-backdrop" data-action="${closeAction.id}" aria-label="关闭功法面板"></button>
    <section class="method-sheet" role="dialog" aria-modal="true" aria-labelledby="method-sheet-title" tabindex="-1">
      <div class="method-sheet-header panel-title">
        <div><span class="eyebrow">修行谱系</span><h2 id="method-sheet-title">功法</h2></div>
        ${actionButton(closeAction, 'button secondary method-close')}
      </div>
      ${snapshotSummary}
      <div class="method-roster">${cards}</div>
    </section>
  </div>`;
}

function renderBloodlineModal(actions: ViewAction[]): string {
  if (!isBloodlinePanelOpen) return '';

  const progress = getUiBloodlineProgress();
  const runSnapshot = normalizeBloodlineRunSnapshot(state.run?.bloodlineSnapshot);
  const readOnly = Boolean(state.run);
  const closeAction: ViewAction = {
    id: 'close-bloodline-panel',
    label: '关闭',
    persist: false,
    onSelect: () => {
      isBloodlinePanelOpen = false;
    }
  };
  actions.push(closeAction);

  const cards = BLOODLINE_CATALOG.map((definition) => {
    const rank = getBloodlineRank(definition.id, progress);
    const owned = rank !== undefined;
    const active = progress.active === definition.id;
    const upgrade = getBloodlineUpgradeStatus(definition.id, progress)!;
    const targetRank = upgrade.targetRank;
    const cost = targetRank ? getBloodlineUpgradeCost(definition.id, targetRank) : undefined;
    const unavailableHint = readOnly ? '本局血统已冻结' : undefined;
    const upgradeAction: ViewAction = {
      id: `${owned ? 'upgrade' : 'unlock'}-bloodline-${definition.id}`,
      label: owned ? (rank === 3 ? '已满阶' : `晋升 R${targetRank}`) : '觉醒 R1',
      hint: unavailableHint ?? (cost ? formatCost(cost) : 'R3'),
      disabled: readOnly || upgrade.state === 'max_rank' || !cost || !canAffordCost(cost),
      onSelect: () => {
        state = (owned
          ? upgradeBloodline(state, definition.id)
          : unlockBloodline(state, definition.id)) as EquipmentMemoryGameState;
      }
    };
    const activateAction: ViewAction = {
      id: `activate-bloodline-${definition.id}`,
      label: active ? '当前血统' : '设为当前',
      hint: unavailableHint ?? (active ? '下次入场沿用，不重复支付' : '下次入场冻结'),
      disabled: readOnly || !owned || active,
      onSelect: () => {
        state = activateBloodline(state, definition.id) as EquipmentMemoryGameState;
      }
    };
    actions.push(upgradeAction);
    if (owned) actions.push(activateAction);

    const rankEffects = ([1, 2, 3] as const).map((effectRank) => {
      const snapshot: BloodlineRunSnapshot = {
        rulesVersion: BLOODLINE_RULES_VERSION,
        bloodlineId: definition.id,
        aspect: definition.aspect,
        rank: effectRank
      };
      return `<span class="${rank === effectRank ? 'current' : ''}">
        <small>R${effectRank} 常驻</small><strong>${formatBloodlineStats(snapshot)}</strong>
        <small>爆发</small><b>${formatBloodlineSurge(snapshot)}</b>
      </span>`;
    }).join('');
    const command = owned
      ? `${actionButton(activateAction, 'button secondary bloodline-activate')}${actionButton(upgradeAction, 'button bloodline-upgrade')}`
      : actionButton(upgradeAction, 'button bloodline-unlock');

    return `<article class="bloodline-card ${owned ? 'owned' : ''} ${active ? 'active' : ''}"
      data-bloodline-id="${definition.id}"
      data-bloodline-aspect="${definition.aspect}"
      data-bloodline-rank="${rank ?? 0}"
      data-bloodline-active="${active}">
      <div class="bloodline-card-heading">
        <div><span class="eyebrow">${definition.title}</span><h3>${definition.name}</h3></div>
        <strong>${bloodlineAspectLabels[definition.aspect]} · ${owned ? `R${rank}` : '未觉醒'}</strong>
      </div>
      <div class="bloodline-rank-effects">${rankEffects}</div>
      <div class="bloodline-card-footer">
        <small>${rank === 3 ? '当前阶 R3 · 已满阶' : `当前阶 ${rank ? `R${rank}` : '未觉醒'} · 下一阶精确成本 ${cost ? formatCost(cost) : '无'}`}</small>
        <div class="button-row">${command}</div>
      </div>
    </article>`;
  }).join('');

  const snapshotSummary = runSnapshot
    ? `<div class="bloodline-frozen-summary" data-frozen-bloodline="${runSnapshot.bloodlineId}" data-frozen-bloodline-rank="${runSnapshot.rank}">
        <span><small>本局冻结</small><strong>${getBloodlineDefinition(runSnapshot.bloodlineId)!.name} · R${runSnapshot.rank}</strong></span>
        <span><small>常驻 / 爆发</small><strong>${formatBloodlineStats(runSnapshot)} / ${formatBloodlineSurge(runSnapshot)}</strong></span>
      </div>`
    : readOnly
      ? '<div class="bloodline-frozen-summary disabled" data-frozen-bloodline="disabled" data-frozen-bloodline-rank="0"><span><small>本局冻结</small><strong>本局未启用血统，无法修改或回填</strong></span></div>'
      : '<div class="bloodline-frozen-summary"><span><small>下次入场</small><strong>当前血统与位阶会在进入副本时冻结</strong></span></div>';

  return `<div class="bloodline-modal" data-bloodline-sheet="open">
    <button class="bloodline-backdrop" data-action="${closeAction.id}" aria-label="关闭血统面板"></button>
    <section class="bloodline-sheet" role="dialog" aria-modal="true" aria-labelledby="bloodline-sheet-title" tabindex="-1">
      <div class="bloodline-sheet-header panel-title">
        <div><span class="eyebrow">原型谱系</span><h2 id="bloodline-sheet-title">血统</h2></div>
        ${actionButton(closeAction, 'button secondary bloodline-close')}
      </div>
      ${snapshotSummary}
      <div class="bloodline-roster">${cards}</div>
    </section>
  </div>`;
}

function renderCompanionModal(actions: ViewAction[]): string {
  if (!isCompanionPanelOpen) return '';

  const progress = getUiCompanionProgress();
  const runSnapshot = normalizeCompanionRunSnapshot(state.run?.companionSnapshot);
  const readOnly = Boolean(state.run);
  const closeAction: ViewAction = {
    id: 'close-companion-panel',
    label: '关闭',
    persist: false,
    onSelect: () => {
      isCompanionPanelOpen = false;
    }
  };
  actions.push(closeAction);

  const cards = COMPANION_CATALOG.map((definition) => {
    const recruitment = getCompanionRecruitmentStatus(
      definition.id,
      progress,
      state.completedDungeonIds
    )!;
    const owned = recruitment === 'owned';
    const rank = progress.ranks[definition.id];
    const active = progress.active === definition.id;
    const upgrade = getCompanionUpgradeStatus(definition.id, progress)!;
    const recruitAffordable = canAffordCost(definition.recruitCost);
    const upgradeAffordable = Boolean(upgrade.cost && canAffordCost(upgrade.cost));
    const recruitAction: ViewAction = {
      id: `recruit-companion-${definition.id}`,
      label: recruitment === 'locked' ? '未解锁' : '招募',
      hint: readOnly ? '本局阵容已冻结' : formatCost(definition.recruitCost),
      disabled: readOnly || recruitment !== 'recruitable' || !recruitAffordable,
      onSelect: () => {
        state = recruitCompanion(state, definition.id);
      }
    };
    const activateAction: ViewAction = {
      id: `activate-companion-${definition.id}`,
      label: active ? '出战中' : '设为出战',
      hint: readOnly ? '本局阵容已冻结' : active ? '下次入场沿用' : '下次入场冻结',
      disabled: readOnly || !owned || active,
      onSelect: () => {
        state = activateCompanion(state, definition.id);
      }
    };
    const upgradeAction: ViewAction = {
      id: `upgrade-companion-${definition.id}`,
      label: upgrade.state === 'max_rank' ? '已满阶' : `晋升 R${upgrade.targetRank ?? 2}`,
      hint: readOnly
        ? '本局阵容已冻结'
        : upgrade.cost
          ? formatCost(upgrade.cost)
          : upgrade.state === 'max_rank'
            ? 'R3'
            : '需先招募',
      disabled: readOnly || upgrade.state !== 'upgradeable' || !upgradeAffordable,
      onSelect: () => {
        state = upgradeCompanion(state, definition.id);
      }
    };
    if (owned) actions.push(activateAction, upgradeAction);
    else actions.push(recruitAction);

    const rankEffects = ([1, 2, 3] as const).map((effectRank) => {
      const snapshot: CompanionRunSnapshot = {
        rulesVersion: COMPANION_RULES_VERSION,
        companionId: definition.id,
        rank: effectRank
      };
      return `<span class="${rank === effectRank ? 'current' : ''}"><small>R${effectRank}</small><strong>${formatCompanionAssist(snapshot)}</strong></span>`;
    }).join('');
    const command = owned
      ? `${actionButton(activateAction, 'button secondary companion-activate')}${actionButton(upgradeAction, 'button companion-upgrade')}`
      : actionButton(recruitAction, 'button companion-recruit');

    return `<article class="companion-card ${owned ? 'owned' : recruitment} ${active ? 'active' : ''}"
      data-companion-id="${definition.id}"
      data-companion-owned="${owned}"
      data-companion-active="${active}"
      data-companion-rank="${rank ?? 0}">
      <div class="companion-card-heading">
        <div><span class="eyebrow">${definition.title}</span><h3>${definition.name}</h3></div>
        <strong>${owned ? `R${rank}` : recruitment === 'locked' ? '未解锁' : '可招募'}</strong>
      </div>
      <div class="companion-costs">
        <span><small>招募</small><strong>${formatCost(definition.recruitCost)}</strong></span>
        <span><small>R2 晋升</small><strong>${formatCost(getCompanionUpgradeCost(definition.id, 2)!)}</strong></span>
        <span><small>R3 晋升</small><strong>${formatCost(getCompanionUpgradeCost(definition.id, 3)!)}</strong></span>
      </div>
      <div class="companion-assist-heading"><span>助战 · ${definition.assistName}</span><small>每场战斗一次</small></div>
      <div class="companion-rank-effects">${rankEffects}</div>
      <div class="companion-card-footer">
        <small>通关「${DUNGEONS[definition.unlockDungeonId].name}」后解锁</small>
        <div class="button-row">${command}</div>
      </div>
    </article>`;
  }).join('');

  const snapshotSummary = runSnapshot
    ? (() => {
        const definition = COMPANION_CATALOG.find(({ id }) => id === runSnapshot.companionId)!;
        return `<div class="companion-frozen-summary" data-frozen-companion="${runSnapshot.companionId}">
          <span><small>本局冻结</small><strong>${definition.name} · R${runSnapshot.rank}</strong></span>
          <span><small>${definition.assistName}</small><strong>${formatCompanionAssist(runSnapshot)}</strong></span>
        </div>`;
      })()
    : readOnly
      ? '<div class="companion-frozen-summary disabled" data-frozen-companion="disabled"><span><small>本局冻结</small><strong>未携带同伴，助战禁用</strong></span></div>'
      : '<div class="companion-frozen-summary"><span><small>下次入场</small><strong>当前出战位会在进入副本时冻结</strong></span></div>';

  return `<div class="companion-modal">
    <button class="companion-backdrop" data-action="${closeAction.id}" aria-label="关闭小队面板"></button>
    <section class="companion-sheet" role="dialog" aria-modal="true" aria-labelledby="companion-sheet-title" tabindex="-1">
      <div class="companion-sheet-header panel-title">
        <div><span class="eyebrow">轮回小队</span><h2 id="companion-sheet-title">小队</h2></div>
        ${actionButton(closeAction, 'button secondary companion-close')}
      </div>
      ${snapshotSummary}
      <div class="companion-roster">${cards}</div>
    </section>
  </div>`;
}

function renderTaskModal(actions: ViewAction[]): string {
  if (!isTaskPanelOpen) return '';

  const restartAction = actions.find((action) => action.id === 'new-run');
  const closeAction: ViewAction = {
    id: 'close-task-panel',
    label: '关闭',
    persist: false,
    onSelect: () => {
      isTaskPanelOpen = false;
    }
  };
  actions.push(closeAction);

  return `<div class="task-modal">
    <button class="task-backdrop" data-action="${closeAction.id}" aria-label="关闭任务面板"></button>
    <section class="task-sheet" role="dialog" aria-modal="true" aria-labelledby="task-sheet-title" tabindex="-1">
      <div class="task-panel">
        <div class="task-sheet-header panel-title">
          <div>
            <span class="eyebrow">主神任务</span>
            <h2 id="task-sheet-title">任务</h2>
          </div>
          <div class="sheet-actions">
            ${restartAction ? actionButton(restartAction, 'button secondary modal-restart') : ''}
            ${actionButton(closeAction, 'button secondary task-close')}
          </div>
        </div>
        <div class="task-sheet-content">
          ${renderMainlineTaskPanel(actions)}
          ${renderChapterSideTasks(actions)}
        </div>
      </div>
    </section>
  </div>`;
}

function renderCharacterModal(actions: ViewAction[]): string {
  if (!isCharacterPanelOpen) return '';

  const restartAction = actions.find((action) => action.id === 'new-run');
  const closeAction: ViewAction = {
    id: 'close-character-panel',
    label: '关闭',
    persist: false,
    onSelect: () => {
      isCharacterPanelOpen = false;
    }
  };
  actions.push(closeAction);

  return `<div class="character-modal">
    <button class="character-backdrop" data-action="${closeAction.id}" aria-label="关闭角色面板"></button>
    <section class="character-sheet" role="dialog" aria-modal="true" aria-labelledby="character-sheet-title" tabindex="-1">
      ${renderCharacterPanel(closeAction, restartAction)}
    </section>
  </div>`;
}

function createHubPanelAction(panel: HubPanel, label: string, hint: string): ViewAction {
  const id = `open-hub-${panel}`;
  return {
    id,
    label,
    hint,
    persist: false,
    onSelect: () => {
      hubPanel = panel;
      hubPanelTriggerActionId = id;
      isCharacterPanelOpen = false;
      isTaskPanelOpen = false;
      isCompanionPanelOpen = false;
      isMethodPanelOpen = false;
      isBloodlinePanelOpen = false;
      isEquipmentCommissionModalOpen = false;
      protocolSelection = undefined;
    }
  };
}

function getCodexEntries(): CodexEntry[] {
  const gates = new Map(getCampaignGates(state).map((gate) => [gate.dungeonId, gate]));
  const bloodlineProgress = getUiBloodlineProgress();
  const dungeonEntries = (Object.keys(DUNGEONS) as DungeonId[]).map((dungeonId): CodexEntry => {
    const dungeon = DUNGEONS[dungeonId];
    const gate = gates.get(dungeonId);
    const status = state.completedDungeonIds.includes(dungeonId)
      ? '已通关'
      : gate?.status === 'locked'
        ? '未解锁'
        : '已解锁';
    return { id: dungeonId, category: 'dungeons', name: dungeon.name, description: dungeon.theme, status };
  });
  const monsterEntries = (Object.keys(MONSTERS) as Array<keyof typeof MONSTERS>).map((monsterId): CodexEntry => {
    const monster = MONSTERS[monsterId];
    return {
      id: monsterId,
      category: 'monsters',
      name: monster.name,
      description: `${monster.ability} 对策：${monster.counter}`,
      status: `${DUNGEONS[monster.dungeonId].name} · ${state.completedDungeonIds.includes(monster.dungeonId) ? '已记录' : '未遭遇'}`
    };
  });
  const equipmentEntries = (Object.keys(EQUIPMENT) as EquipmentId[]).map((equipmentId): CodexEntry => ({
    id: equipmentId,
    category: 'equipment',
    name: EQUIPMENT[equipmentId].name,
    description: EQUIPMENT[equipmentId].description,
    status: state.ownedEquipment.includes(equipmentId) ? `已拥有 · +${(state.equipmentLevels[equipmentId] ?? 1) - 1}` : '未拥有'
  }));
  const itemEntries = (Object.keys(ITEMS) as ItemId[]).map((itemId): CodexEntry => ({
    id: itemId,
    category: 'items',
    name: ITEMS[itemId].name,
    description: ITEMS[itemId].description,
    status: state.inventory[itemId] > 0 ? `拥有 x${state.inventory[itemId]}` : '未拥有'
  }));
  const petEntries = (Object.keys(PETS) as PetId[]).map((petId): CodexEntry => ({
    id: petId,
    category: 'pets',
    name: PETS[petId].name,
    description: PETS[petId].description,
    status: state.ownedPets.includes(petId) ? `已拥有 · Lv.${state.petLevels[petId] ?? 1}` : '未拥有'
  }));
  const methodEntries = (Object.keys(METHODS) as MethodId[]).map((methodId): CodexEntry => ({
    id: methodId,
    category: 'methods',
    name: METHODS[methodId].name,
    description: `${METHODS[methodId].description} ${METHODS[methodId].passive}`,
    status: state.learnedMethods.includes(methodId) ? `已学会 · R${state.methodRanks?.[methodId] ?? 1}` : '未学会'
  }));
  const bloodlineEntries = BLOODLINE_CATALOG.map((definition): CodexEntry => ({
    id: definition.id,
    category: 'bloodlines',
    name: definition.name,
    description: `${definition.title} · ${bloodlineAspectLabels[definition.aspect]}`,
    status: bloodlineProgress.ranks[definition.id] ? `已觉醒 · R${bloodlineProgress.ranks[definition.id]}` : '未觉醒'
  }));
  return [...dungeonEntries, ...monsterEntries, ...equipmentEntries, ...itemEntries, ...petEntries, ...methodEntries, ...bloodlineEntries];
}

function renderHubCodex(actions: ViewAction[]): string {
  const categoryLabels: Record<CodexCategory, string> = {
    all: '全部',
    dungeons: '副本',
    monsters: '怪物',
    equipment: '装备',
    items: '道具',
    pets: '宠物',
    methods: '功法',
    bloodlines: '血统'
  };
  const categoryAssetKinds: Partial<Record<Exclude<CodexCategory, 'all'>, GameAssetKind>> = {
    dungeons: 'dungeon',
    monsters: 'monster',
    equipment: 'equipment',
    items: 'item',
    pets: 'pet'
  };
  const filterButtons = (Object.keys(categoryLabels) as CodexCategory[]).map((category) => {
    const action: ViewAction = {
      id: `filter-codex-${category}`,
      label: categoryLabels[category],
      persist: false,
      onSelect: () => {
        codexCategory = category;
      }
    };
    actions.push(action);
    return `<button class="codex-filter" data-action="${action.id}" aria-pressed="${codexCategory === category}">${categoryLabels[category]}</button>`;
  }).join('');
  const query = codexSearch.trim().toLocaleLowerCase();
  const entries = getCodexEntries().filter((entry) => {
    if (codexCategory !== 'all' && entry.category !== codexCategory) return false;
    if (!query) return true;
    return [entry.name, categoryLabels[entry.category], entry.description, entry.status]
      .some((value) => value.toLocaleLowerCase().includes(query));
  });
  const content = entries.length
    ? entries.map((entry) => {
        const assetKind = categoryAssetKinds[entry.category];
        const art = assetKind
          ? renderGameAsset(assetKind, entry.id, `codex-art codex-art-${entry.category}`, { decorative: true })
          : '';
        return `<article class="codex-entry ${art ? 'has-art' : ''}" data-codex-category="${entry.category}" data-codex-id="${entry.id}">
          ${art}
          <div><span>${categoryLabels[entry.category]}</span><strong>${escapeHtml(entry.name)}</strong></div>
          <p>${escapeHtml(entry.description)}</p>
          <small>${escapeHtml(entry.status)}</small>
        </article>`;
      }).join('')
    : '<div class="codex-empty"><strong>没有匹配条目</strong><p>调整分类或搜索词后再试。</p></div>';

  return `<div class="hub-codex">
    <div class="codex-toolbar">
      <label>搜索图鉴
        <input class="codex-search" type="search" value="${escapeHtml(codexSearch)}" aria-label="搜索轮回图鉴" autocomplete="off">
      </label>
      <div class="codex-filters" aria-label="图鉴分类">${filterButtons}</div>
      <span class="codex-count" aria-live="polite">结果 ${entries.length}</span>
    </div>
    <div class="codex-results">${content}</div>
  </div>`;
}

function renderMainGodSpace(actions: ViewAction[]): string {
  const codexAction = createHubPanelAction('codex', '轮回图鉴', '查看已知世界');
  const dungeonAction = createHubPanelAction('dungeons', '副本门', `${CAMPAIGN_DUNGEON_COUNT} 章入口`);
  const petAction = createHubPanelAction('pets', '宠物商人', `${state.ownedPets.length} 只已拥有`);
  const suppliesAction = createHubPanelAction('supplies', '补给商人', '道具与副本工具');
  const equipmentAction = createHubPanelAction('equipment', '装备商人', '购买与装备');
  const forgeAction = createHubPanelAction('forge', '锻造商人', '升级 / 铭刻 / 淬炼');
  actions.push(codexAction, dungeonAction, petAction, suppliesAction, equipmentAction, forgeAction);
  const methodAction = actions.find((action) => action.id === 'open-method-panel');
  const taskAction = actions.find((action) => action.id === 'open-task-panel');
  const methodStationAction = methodAction
    ? { ...methodAction, label: '功法大师', hint: getMethodTriggerHint() }
    : undefined;
  const taskStationAction = taskAction
    ? { ...taskAction, label: '主神投影', hint: getTaskTriggerHint() }
    : undefined;
  const compatibilityCatalog = hubPanel
    ? ''
    : `<div class="hub-compat-catalog" hidden aria-hidden="true">
        ${renderDungeonEntrances(actions)}
        ${renderPetHouse(actions)}
        ${renderShop(actions)}
      </div>`;

  return `<section class="hub-stage">
    <div class="hub-scene">
      <div class="hub-scene-art" aria-hidden="true">
        <span class="hub-scene-orbit"></span>
        <span class="hub-scene-core"></span>
      </div>
      <div class="hub-stations" aria-label="主神空间站点">
        ${renderHubStationButton(petAction, 'hub-station hub-station-pets', 'pet_keeper')}
        ${renderHubStationButton(suppliesAction, 'hub-station hub-station-supplies', 'supply_trader')}
        ${renderHubStationButton(equipmentAction, 'hub-station hub-station-equipment', 'equipment_quartermaster')}
        ${renderHubStationButton(forgeAction, 'hub-station hub-station-forge', 'forge_smith')}
        ${methodStationAction ? renderHubStationButton(methodStationAction, 'hub-station hub-station-method', 'method_master') : ''}
        ${taskStationAction ? renderHubStationButton(taskStationAction, 'hub-station hub-station-task', 'main_god_projection') : ''}
      </div>
      <div class="hub-scene-entrances">
        ${actionButton(dungeonAction, 'hub-gate')}
        ${actionButton(codexAction, 'hub-codex-trigger')}
      </div>
    </div>
    ${compatibilityCatalog}
  </section>`;
}

function renderHubArchive(title: string, hint: string, content: string): string {
  return `<details class="hub-archive">
    <summary><span><strong>${title}</strong><small>${hint}</small></span></summary>
    <div class="hub-archive-content">${content}</div>
  </details>`;
}

function renderHubDirectoryModal(actions: ViewAction[]): string {
  if (state.phase !== 'hub' || !hubPanel) return '';
  const panel = hubPanel;
  const closeAction: ViewAction = {
    id: 'close-hub-directory',
    label: '关闭',
    persist: false,
    onSelect: () => {
      hubPanel = undefined;
    }
  };
  actions.push(closeAction);
  const panelTitles: Record<HubPanel, string> = {
    codex: '轮回图鉴',
    dungeons: '副本门',
    pets: '宠物商人',
    supplies: '补给商人',
    equipment: '装备商人',
    forge: '锻造商人'
  };
  const panelNpcIds: Record<HubPanel, string> = {
    codex: 'main_god_projection',
    dungeons: 'main_god_projection',
    pets: 'pet_keeper',
    supplies: 'supply_trader',
    equipment: 'equipment_quartermaster',
    forge: 'forge_smith'
  };
  const content = panel === 'codex'
    ? `${renderHubCodex(actions)}${renderHubArchive('成长规划', `${CAMPAIGN_DUNGEON_COUNT} 阶成长推演`, renderGrowthPlanner())}`
    : panel === 'dungeons'
      ? `${renderDungeonEntrances(actions)}${renderHubArchive('路线推演与补强', '章节路径 / 主神推荐', `${renderCampaignRoutePanel()}${renderTopRecommendations(actions)}`)}`
      : panel === 'pets'
        ? renderPetHouse(actions)
        : panel === 'supplies'
          ? `${renderShop(actions, panel)}${renderHubArchive('出发准备', '遗物构筑 / 战术携行', `${renderRunRelicPreparation(actions)}${renderTacticalLoadoutPreparation(actions)}`)}`
          : renderShop(actions, panel);

  return `<div class="hub-directory-modal">
    <button class="hub-directory-backdrop" data-action="${closeAction.id}" aria-label="关闭${panelTitles[panel]}"></button>
    <section class="hub-directory-sheet" role="dialog" aria-modal="true" aria-labelledby="hub-directory-title" tabindex="-1">
      <div class="hub-directory-header">
        <div class="hub-directory-identity">
          ${renderGameAsset('npc', panelNpcIds[panel], 'hub-directory-npc', { decorative: true, loading: 'eager' })}
          <div><span class="eyebrow">主神空间</span><h2 id="hub-directory-title">${panelTitles[panel]}</h2></div>
        </div>
        ${actionButton(closeAction, 'button secondary hub-directory-close')}
      </div>
      <div class="hub-directory-content">${content}</div>
    </section>
  </div>`;
}

function renderMain(actions: ViewAction[]): string {
  if (state.phase === 'combat') return renderCombat(actions);
  if (state.phase === 'result') return renderResult(actions);

  if (state.phase === 'explore') {
    return renderExplore(actions);
  }

  return renderMainGodSpace(actions);
}

function render(focusTarget?: RenderFocusTarget): void {
  resetFeatureHelpInteraction();
  const actions: ViewAction[] = [
    {
      id: 'new-run',
      label: '重开',
      hint: '新档',
      onSelect: () => {
        state = createInitialUiState();
        isCharacterPanelOpen = false;
        isTaskPanelOpen = false;
        isCompanionPanelOpen = false;
        isMethodPanelOpen = false;
        isBloodlinePanelOpen = false;
        isEquipmentCommissionModalOpen = false;
        selectedCommissionEquipmentIds = [];
        selectedCommissionMaterialId = undefined;
        protocolSelection = undefined;
        hubPanel = undefined;
        hubPanelTriggerActionId = undefined;
        codexCategory = 'all';
        codexSearch = '';
        lastShelterCheckpointResult = undefined;
      }
    }
  ];

  root.innerHTML = `<div class="shell">
    <div class="app-content"${isAnyModalOpen() ? ' inert' : ''}>
      ${renderTopbar(actions)}
      <main class="layout">
        <section class="main-column">
          <div class="quick-actions">${actionButton(actions[0], 'button secondary')}</div>
          ${renderMain(actions)}
          ${renderLog()}
        </section>
      </main>
    </div>
    ${renderFeatureHelpPopover()}
    ${renderHubDirectoryModal(actions)}
    ${renderProtocolModal(actions)}
    ${renderTaskModal(actions)}
    ${renderCompanionModal(actions)}
    ${renderMethodModal(actions)}
    ${renderBloodlineModal(actions)}
    ${renderCharacterModal(actions)}
    ${renderEquipmentCommissionModal(actions)}
    ${renderCausalLedgerModal(actions)}
  </div>`;

  bindActions(actions);
  syncModalSideEffects(focusTarget);
}

document.addEventListener('pointerdown', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest('[data-feature-help], [data-feature-help-popover]')) return;
  hideFeatureHelp(true);
});

window.addEventListener('resize', refreshFeatureHelpPosition);
window.addEventListener('scroll', refreshFeatureHelpPosition, true);

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (hideFeatureHelp(true, true)) {
    event.preventDefault();
    return;
  }
  if (!isAnyModalOpen()) return;
  event.preventDefault();
  if (getPendingCausalLedgerStatus()) return;
  if (isEquipmentCommissionModalOpen) {
    isEquipmentCommissionModalOpen = false;
    render('equipment-commission-trigger');
    return;
  }
  if (protocolSelection) {
    protocolSelection = undefined;
    render('protocol-trigger');
    return;
  }
  if (hubPanel) {
    hubPanel = undefined;
    render('hub-directory-trigger');
    return;
  }
  if (isCharacterPanelOpen) {
    isCharacterPanelOpen = false;
    render('character-trigger');
    return;
  }
  if (isCompanionPanelOpen) {
    isCompanionPanelOpen = false;
    render('companion-trigger');
    return;
  }
  if (isMethodPanelOpen) {
    isMethodPanelOpen = false;
    render('method-trigger');
    return;
  }
  if (isBloodlinePanelOpen) {
    isBloodlinePanelOpen = false;
    render('bloodline-trigger');
    return;
  }
  isTaskPanelOpen = false;
  render('task-trigger');
});

render();
