import {
  DUNGEONS,
  DUNGEON_ORDER,
  EQUIPMENT,
  EQUIPMENT_ATTUNEMENT_COST,
  MONSTERS,
  RUN_PURSUIT_CATALOG,
  RUN_PURSUIT_SPAWN_CLEAR_COUNT,
  activateOwnedEquipmentMemory,
  activateCurrentEquipmentSoulSkillRecharge,
  activateCompanion,
  activateBloodline,
  activateMethod,
  activatePet,
  advanceRunPursuit,
  attuneEquipment,
  buyEquipment,
  buyItem,
  buyPet,
  cancelCurrentEquipmentSoulSkillRecharge,
  claimTaskReward,
  configureTacticalLoadout,
  configureRunRelicPreparation,
  createRunPursuitState,
  createInitialState,
  collectReward,
  equipEquipment,
  enterDungeon,
  getAvailableDungeonEvents,
  getCampaignGates,
  getBossSealStatus,
  getCombatEncounterProfile,
  getCurrentEquipmentHuntStatus,
  getCurrentEquipmentMemoryCombatStatus,
  getCurrentEquipmentMemoryHuntStatus,
  getCurrentAuctionLotStatus,
  getCurrentCausalLedgerStatus,
  getCurrentCombatIntent,
  getCurrentCompanionAssistStatus,
  getCurrentBloodlineSurgeStatus,
  getCurrentBroadcastRelayStatus,
  getCurrentDungeonLaw,
  getCurrentEntropyHeadingStatus,
  getCurrentEscortCheckpointStatus,
  getCurrentGenesisSpliceStatus,
  getCurrentMirrorCityPhaseStatus,
  getCurrentMethodTechniqueStatus,
  getCurrentRedactionClauseStatus,
  getCurrentFieldSurveyStatus,
  getEquipmentSoulSkillActionStatus,
  getEquipmentSoulSkillRechargeStatus,
  getCurrentLegalAdjacentTargetIds,
  getCurrentRunRelicEffects,
  getCurrentRouteBlockReason,
  getCurrentRouteGateStatus,
  getCurrentRunPressure,
  getCurrentRunProtocol,
  getCurrentRunPursuit,
  getDerivedStats,
  getDungeonReadiness,
  getEquipmentCommissionStatus,
  getEquipmentMemoryHuntPreparationStatus,
  getEquipmentMemoryStatus,
  getEquipmentSystemStatus,
  getEquipmentTemperStatus,
  getPlayerPower,
  getNodeDepartureBlock,
  getRunPursuitContactDamage,
  getRunRelicPreparationStatus,
  getTacticalLoadoutStatus,
  getWeaponSkillStatus,
  handleTrap,
  isEquipmentCommissionSealed,
  isTacticalItemAvailable,
  isCurrentDungeonFeatureAvailable,
  learnMethod,
  listRouteContracts,
  moveToNode,
  performCombatAction,
  prepareEquipmentHunt,
  prepareEquipmentMemoryHunt,
  recruitCompanion,
  resolveDungeonEvent,
  resolveCausalLedger,
  resolveAuctionLot,
  resolveEntropyHeading,
  resolveCurrentEscortCheckpoint,
  resolveGenesisSplice,
  resolveCurrentBroadcastRelay,
  resolveMirrorCityPhase,
  resolveRedactionClause,
  resolveFieldSurvey,
  resolveEquipmentLoot,
  resolveExit,
  resolveCurrentEquipmentSoulSkillRecharge,
  resolveRetreat,
  resolveRunFailure,
  resolveRunRelicArchive,
  resolveRunRelicDraft,
  returnToHub,
  selectNode,
  selectCombatReplayRoute,
  startEquipmentCommission,
  temperEquipment,
  useEquipmentSoulSkill,
  usePortal,
  useMethodTechnique,
  upgradeEquipment,
  upgradeCompanion,
  unlockBloodline,
  upgradeBloodline,
  upgradeMethod,
  upgradePet,
  useBloodlineSurge,
  useCompanionAssist
} from './game';
import * as gameApi from './game';
import {
  METHOD_CULTIVATION_RULES_VERSION,
  METHOD_TECHNIQUE_CATALOG,
  getMethodRank,
  getMethodTechniqueEffect,
  getMethodUpgradeCost,
  normalizeMethodCultivationProgress
} from './method-cultivation';
import type {
  MethodRank,
  MethodRunSnapshot,
  MethodTechniqueEffect
} from './method-cultivation';
import { getBossDefinition } from './boss-system';
import { getPanopticonStatus as getPanopticonLawStatus } from './dungeon-laws';
import {
  DUNGEON_ELITE_MONSTERS,
  DUNGEON_EQUIPMENT_POOLS,
  getDungeonLootOffer
} from './dungeon-loot';
import {
  DUNGEON_LAW_LANDMARKS,
  getCombatOpeningDistribution,
  getMirrorCityShellStatus
} from './dungeon-laws';
import {
  getDungeonRouteGates,
  getRouteBlockReason,
  getRouteGateStatus,
  getRouteSectorDisplay
} from './dungeon-routes';
import { EQUIPMENT_HUNT_DEFINITIONS } from './equipment-hunts';
import {
  EQUIPMENT_MEMORY_CATALOG,
  EQUIPMENT_MEMORY_EQUIPMENT_CATALOG
} from './equipment-memory-hunts';
import type {
  EquipmentMemoryEquipmentId,
  EquipmentMemoryHuntSettlement,
  EquipmentMemoryId
} from './equipment-memory-hunts';
import { getRunProtocolDefinition, getRunProtocolRequiredNodeIds } from './run-protocols';
import type {
  CombatAction,
  DungeonId,
  EquipmentCommissionSettlement,
  EquipmentId,
  GameState,
  ItemId,
  MethodId,
  NodeDepartureBlockKind,
  PetId,
  RouteContractDefinition,
  RouteContractRunState,
  RouteContractSettlement,
  RewardBundle,
  RunPursuitDefinition,
  RunPursuitMaterialId,
  RunPursuitSettlement,
  RunPursuitState,
  RunProtocolSettlement
} from './game';
import {
  EQUIPMENT_COMMISSION_COST,
  EQUIPMENT_COMMISSION_MATERIAL_REWARD,
  EQUIPMENT_COMMISSION_REQUIRED_DUNGEONS
} from './equipment-commissions';
import { EQUIPMENT_SOUL_SKILL_CATALOG } from './equipment-soul-skills';
import {
  BLOODLINE_RULES_VERSION,
  normalizeBloodlineProgress
} from './bloodline-system';
import type {
  EquipmentSoulSkillEffect,
  EquipmentSoulSkillId,
  EquipmentSoulSkillRunState,
  EquipmentSoulSkillSourceEquipmentId
} from './equipment-soul-skills';
import type { EquipmentAttunementId } from './equipment-system';
import { FIELD_SURVEY_CATALOG } from './field-surveys';
import type { FieldSurveyDefinition, FieldSurveyOption } from './field-surveys';
import { isTacticalItemId, validateTacticalLoadout } from './tactical-loadout';
import type {
  TacticalItemId,
  TacticalLoadoutSnapshot,
  TacticalRigSlotAssignment
} from './tactical-loadout';
import type {
  CombatOpeningDistribution,
  DungeonLawData,
  DungeonLawModifiers,
  EntropyHeadingChoice,
  MirrorCityPhase,
  RedactionBossEffectProjection,
  RedactionEntryPassives
} from './dungeon-laws';
import type {
  AuctionBossModifierProjection,
  AuctionLotChoice,
  AuctionLotNodeId,
  BroadcastEntryPassives,
  BroadcastRelayChoice,
  BroadcastRelayNodeId,
  EscortCheckpointChoice,
  EscortCheckpointNodeId,
  EscortEntryCompanion,
  EscortEntryGear,
  FalseTestimonyStatus,
  FalseTestimonySuspect,
  LegacyAuctionEntryPassives,
  PanopticonRoute,
  PanopticonStatus,
  RedactionChoice,
  GenesisGene,
  RedactionClauseNodeId
} from './dungeon-laws';
import type {
  DeepRunProtocolDefinition,
  ImprintRunProtocolDefinition,
  RunProtocolId
} from './run-protocols';
import { RUN_RELIC_IDS } from './run-relics';
import type { RunRelicEffects, RunRelicFrame, RunRelicId } from './run-relics';
import { calculateRunEconomy } from './run-economy';
import type { RunEconomyInput, RunEconomyResult } from './run-economy';
import { calculateRunPressureBonus, getRunPressureStatus } from './run-pressure';
import type { RunPressureState, RunPressureTier } from './run-pressure';
import { COMPANION_CATALOG } from './companion-system';
import type {
  CompanionAssistEffect,
  CompanionId,
  CompanionRank,
  CompanionRunSnapshot
} from './companion-system';

export type BalanceVerdict = 'balanced' | 'needs-adjustment';

export type CampaignRewardPlan = Partial<Record<DungeonId, RewardBundle>>;

export type BalanceSimStage = {
  tier: number;
  dungeonId: DungeonId;
  beforePower: number;
  afterPower: number;
  nextPreparedPower?: number;
  growthSignals?: string[];
  readiness: ReturnType<typeof getDungeonReadiness>;
  recommendedPower: number;
  plannedPurchases: EquipmentId[];
  plannedUpgrades: EquipmentId[];
  plannedMethods: MethodId[];
  plannedPets: PetId[];
  warnings: string[];
};

export type CampaignBalanceResult = {
  verdict: BalanceVerdict;
  warnings: string[];
  stages: BalanceSimStage[];
};

export type CampaignBalanceOptions = {
  initialState?: GameState;
  rewards?: CampaignRewardPlan;
};

export type CombatReplayStageBalanceScenarioResult = Readonly<{
  dungeonId: 'combat_replay_stage';
  recommendedPower: number;
  playerPower: number;
  readiness: ReturnType<typeof getDungeonReadiness>;
  externalRunPreserved: boolean;
  externalProgressPreserved: boolean;
  pursuitIsolated: boolean;
  playerSurvived: boolean;
  completedTakeCount: number;
  routeSelected: boolean;
  route: 'burst';
  bossSnapshotFrozen: boolean;
  ordinary: Readonly<{
    nodeId: string;
    monsterId: string;
    cleared: boolean;
  }>;
  boss: Readonly<{
    nodeId: string;
    monsterId: string;
    cleared: boolean;
  }>;
}>;

export type PanopticonCityRouteBalanceEvidence = Readonly<{
  route: PanopticonRoute;
  playerPower: number;
  pursuitIsolated: boolean;
  completedRelayCount: number;
  moveCount: number;
  exposureCount: number;
  decoyRewardsGranted: number;
  refractionCharges: number;
  routeRewardPoints: number;
  playerSurvived: boolean;
  completed: boolean;
  ordinary: Readonly<{
    nodeId: string;
    monsterId: string;
    cleared: boolean;
  }>;
  boss: Readonly<{
    nodeId: string;
    monsterId: string;
    cleared: boolean;
    snapshot: PanopticonStatus['bossSnapshot'];
  }>;
  routeEvidence: RouteLegalityEvidence;
}>;

export type PanopticonCityBalanceScenarioResult = Readonly<{
  dungeonId: 'panopticon_city';
  recommendedPower: number;
  externalStatePreserved: boolean;
  conservativeBuild: Readonly<{
    playerPower: number;
    readiness: ReturnType<typeof getDungeonReadiness>;
    equippedEquipmentIds: readonly EquipmentId[];
    healingPills: number;
  }>;
  routes: Readonly<Record<PanopticonRoute, PanopticonCityRouteBalanceEvidence>>;
  lowBuild: Readonly<{
    playerPower: number;
    readiness: ReturnType<typeof getDungeonReadiness>;
    pursuitIsolated: boolean;
    ordinaryNodeId: 'exposure_double_patrol';
    ordinaryMonsterId: 'exposure_double';
    turnsAttempted: number;
    hpBeforeCombat: number;
    hpAfterCombat: number;
    cleared: boolean;
    survived: boolean;
    dangerous: boolean;
  }>;
  protocols: readonly Readonly<{
    protocolId: 'standard' | 'imprint' | 'deep';
    enemyStatMultiplierPercent: number;
    observedMaxHp: number;
    observedAttack: number;
    observedArtPower: number;
  }>[];
  legacyTier18: Readonly<{
    ordinaryCleared: boolean;
    bossCleared: boolean;
    playerSurvived: boolean;
    pursuitIsolated: boolean;
  }>;
}>;

export type CompanionAssistBalanceEvidence = Readonly<{
  companionId: CompanionId;
  rank: CompanionRank;
  snapshot: CompanionRunSnapshot;
  effect: CompanionAssistEffect;
  before: Readonly<{ hp: number; focus: number; guarding: boolean }>;
  after: Readonly<{ hp: number; focus: number; guarding: boolean; used: boolean }>;
  secondUseReason?: string;
  secondUsePreserved: boolean;
  saturated: Readonly<{
    available: boolean;
    reason?: string;
    hpBefore: number;
    hpAfter: number;
    focusBefore: number;
    focusAfter: number;
  }>;
}>;

export type CompanionAssistBalanceResult = Readonly<{
  matrix: readonly CompanionAssistBalanceEvidence[];
  noCompanion: Readonly<{
    snapshotAbsent: boolean;
    legacyDisabled: boolean;
    usePreserved: boolean;
  }>;
}>;

export type MethodTechniqueResourceDelta = Readonly<{
  targetRank: 2 | 3;
  rewardPoints: number;
  lingyun: number;
  methodPages: number;
}>;

export type MethodTechniqueStateEvidence = Readonly<{
  hp: number;
  focus: number;
  guarding: boolean;
  rustPoisonStacks: number;
  mirrorSlowStacks: number;
  breathStacks: number;
  used: boolean;
}>;

export type MethodTechniqueInvariantProjection = Readonly<{
  phase: GameState['phase'];
  combatNodeId?: string;
  turn?: number;
  monsterHp?: number;
  bossPhase?: NonNullable<GameState['combat']>['bossPhase'];
  companionAssistUsed?: boolean;
  weaponSkillUsed?: boolean;
  equipmentMemoryState?: NonNullable<GameState['combat']>['equipmentMemoryState'];
  intent: ReturnType<typeof getCurrentCombatIntent>;
  runCurrentNodeId?: string;
  runDamageTaken?: number;
  usedItems: readonly ItemId[];
  clearedNodeIds: readonly string[];
  lawState?: NonNullable<GameState['run']>['lawState'];
  pursuitState?: RunPursuitState;
  armorCracked?: boolean;
  lastShiftTurn?: number;
  revivedOnce?: boolean;
  lastPlayerAction?: string;
  echoCopiedStat?: string;
  echoCopiedValue?: number;
  railHeavyDodgeUsed?: boolean;
}>;

export type MethodTechniqueBalanceEvidence = Readonly<{
  methodId: MethodId;
  rank: MethodRank;
  expectedEffect: MethodTechniqueEffect;
  observedUpgradeCosts: readonly MethodTechniqueResourceDelta[];
  expectedUpgradeCosts: readonly MethodTechniqueResourceDelta[];
  learnedMethods: readonly MethodId[];
  activeAfterLearning: MethodId | undefined;
  activeBeforeEntry: MethodId | undefined;
  activeAfterTechnique: MethodId | undefined;
  rankBeforeEntry: MethodRank | undefined;
  rankAfterTechnique: MethodRank | undefined;
  snapshot: MethodRunSnapshot;
  pursuitStatus: RunPursuitState['status'];
  before: MethodTechniqueStateEvidence;
  after: MethodTechniqueStateEvidence;
  saturatedBefore: MethodTechniqueStateEvidence;
  saturatedAfter: MethodTechniqueStateEvidence;
  invariantBefore: MethodTechniqueInvariantProjection;
  invariantAfter: MethodTechniqueInvariantProjection;
  secondUsePreserved: boolean;
  petRequirement?: Readonly<{
    rejectedWithoutActivePet: boolean;
    usedWithoutActivePet: boolean;
  }>;
}>;

export type MethodTechniqueBalanceResult = Readonly<{
  matrix: readonly MethodTechniqueBalanceEvidence[];
  defaultCampaign: Readonly<{
    verdict: BalanceVerdict;
    warnings: readonly string[];
    activeMethod: MethodId | undefined;
    ranks: Readonly<Partial<Record<MethodId, MethodRank>>>;
  }>;
}>;

export type SevenDungeonRouteSummary = {
  tier: number;
  dungeonId: DungeonId;
  dungeonName: string;
  gateBeforeEntry: 'open' | 'locked' | 'completed' | 'missing';
  gateRequirement: string;
  readinessBeforeEntry: ReturnType<typeof getDungeonReadiness>;
  beforePower: number;
  afterPower: number;
  rewardPointsAfter: number;
  lingyunAfter: number;
  completedDungeonCountAfter: number;
  completedDungeonIdsAfter: DungeonId[];
  claimedTaskIdsAfter: string[];
  plannedPurchases: EquipmentId[];
  plannedUpgrades: EquipmentId[];
  plannedMethods: MethodId[];
  plannedPets: PetId[];
  bossNodeId: string;
  bossNodeCleared: boolean;
  bossSealCleared: boolean;
  exitNodeCleared: boolean;
  playerSurvived: boolean;
  clearedNodeIds: string[];
  weaponSkillUseCount: number;
  usedWeaponSkillNodeIds: string[];
  focusTrace: CombatFocusTrace[];
  routeEvidence: RouteLegalityEvidence;
  settledEquipmentLootIds: EquipmentId[];
  ownedEquipmentIdsAfter: EquipmentId[];
  growthSignals: string[];
  broadcastRoute?: Readonly<{
    noise: number;
    muteCount: number;
    broadcastCount: number;
    allRelaysResolved: boolean;
    bossNoiseSnapshot: number | null;
    silentArchiveReached: boolean;
    balancedSwitchboardReached: boolean;
  }>;
  escortRoute?: Readonly<{
    survivorHp: number;
    bossSurvivorSnapshot: number | null;
    allCheckpointsResolved: boolean;
    treatCount: number;
    pushCount: number;
    entryGear: Readonly<EscortEntryGear>;
    entryCompanion: Readonly<EscortEntryCompanion>;
    companionRole: string;
    firstHazardGuardUsed: boolean;
    companionAnalysisUsed: boolean;
    companionTriageUsed: boolean;
  }>;
  falseTestimonyRoute?: Readonly<{
    revealedEvidenceIds: readonly string[];
    contaminatedEvidenceIds: readonly string[];
    currentTrustedCount: number;
    accusationCorrect: boolean | null;
    accusationTrustedCount: number;
    appealUsed: boolean;
    bossVerdictSnapshot: FalseTestimonyStatus['bossVerdictSnapshot'];
    entryGear: FalseTestimonyStatus['entryGear'];
    truthArchiveReached: boolean;
  }>;
};

export type SevenDungeonVictoryRouteResult = {
  finalState: GameState;
  summaries: SevenDungeonRouteSummary[];
  coverage: {
    boughtEquipment: boolean;
    upgradedEquipment: boolean;
    learnedMethod: boolean;
    gainedPet: boolean;
  };
};

export type PressureRouteKind = 'fast' | 'sweep';

export type PressureSettlementSnapshot = {
  state: RunPressureState;
  tier: RunPressureTier;
  rewardPointBonus: number;
};

export type SevenDungeonPressureRouteEvidence = {
  routeKind: PressureRouteKind;
  startNodeId: string;
  plannedTargetNodeIds: string[];
  routeExcludedNodeIds: string[];
  firstClearedNonExitNodeIds: string[];
  clearedNodeIdsBeforeExit: string[];
  clearedNodeIdsAfterExit: string[];
  pressureStateBeforeExit: RunPressureState;
  pressureStateAfterExit: RunPressureState;
  pressureTier: RunPressureTier;
  pressureSettlement: PressureSettlementSnapshot;
  baseEconomyInput: RunEconomyInput;
  baseEconomy: RunEconomyResult;
  expectedPressureBonus: number;
  actualPressureBonus: number;
  rewardPointsBeforeSettlement: number;
  rewardPointsAfterSettlement: number;
  observedSettlementRewardPoints: number;
  bossNodeId: string;
  exitNodeId: string;
  bossNodeCleared: boolean;
  bossSealCleared: boolean;
  exitNodeCleared: boolean;
  completed: boolean;
  routeEvidence: RouteLegalityEvidence;
};

export type SevenDungeonPressureRouteSummary = {
  tier: number;
  dungeonId: DungeonId;
  dungeonName: string;
  fastRoute: SevenDungeonPressureRouteEvidence;
  sweepRoute: SevenDungeonPressureRouteEvidence;
};

export type SevenDungeonPressureRouteResult = {
  baseState: GameState;
  summaries: SevenDungeonPressureRouteSummary[];
};

export type RouteContractSimulationKind = 'ordered' | 'out_of_order';

export type RouteContractLootSnapshot = {
  rewardPoints: number;
  lingyun: number;
  items: Partial<Record<ItemId, number>>;
  equipmentIds: EquipmentId[];
};

export type EightDungeonRouteContractRunEvidence = {
  routeKind: RouteContractSimulationKind;
  targetNodeIds: [string, string];
  targetClearOrder: string[];
  target2ClearedBeforeTarget1: boolean;
  contractStateBeforeExit: RouteContractRunState;
  settlement: RouteContractSettlement;
  rewardPointsBeforeExit: number;
  rewardPointsAfterExit: number;
  baseExitRewardPoints: number;
  pressureRewardPoints: number;
  observedContractRewardPoints: number;
  lootBagBeforeExit: RouteContractLootSnapshot;
  retainedLootAfterExit: RouteContractLootSnapshot;
  lootBagUnchangedByContractSettlement: boolean;
  bossNodeId: string;
  exitNodeId: string;
  bossNodeCleared: boolean;
  bossSealCleared: boolean;
  exitNodeCleared: boolean;
  completed: boolean;
  routeEvidence: RouteLegalityEvidence;
  finalState: GameState;
};

export type EightDungeonRouteContractSummary = {
  tier: number;
  dungeonId: DungeonId;
  dungeonName: string;
  contract: RouteContractDefinition;
  expectedRewardPoints: number;
  orderedRoute: EightDungeonRouteContractRunEvidence;
};

export type EightDungeonRouteContractsResult = {
  baseState: GameState;
  summaries: EightDungeonRouteContractSummary[];
  outOfOrderControl: {
    contract: RouteContractDefinition;
    route: EightDungeonRouteContractRunEvidence;
  };
};

export type SevenDungeonImprintRouteSummary = {
  tier: number;
  dungeonId: DungeonId;
  dungeonName: string;
  definition: ImprintRunProtocolDefinition;
  requiredNodeId: string;
  anchorNodeType: 'trap' | 'reward' | 'portal';
  bossNodeId: string;
  clearedNodeIds: string[];
  anchorClearIndex: number;
  bossClearIndex: number;
  settlement: RunProtocolSettlement;
  rewardPointBonus: number;
  cycleImprintsBefore: number;
  cycleImprintsAfter: number;
  cycleImprintDelta: number;
  bossBreachAvoided: boolean;
  weaponSkillUseCount: number;
  usedWeaponSkillNodeIds: string[];
  focusTrace: CombatFocusTrace[];
  routeEvidence: RouteLegalityEvidence;
  finalState: GameState;
};

export type SevenDungeonImprintRouteResult = {
  baseState: GameState;
  summaries: SevenDungeonImprintRouteSummary[];
};

export type DeepRouteResourceDeltas = {
  rewardPoints: number;
  lingyun: number;
  cycleImprint: number;
  material: number;
};

export type SevenDungeonDeepRouteBranchSummary = {
  entryProtocolId: 'deep';
  cycleImprintsBeforeEntry: number;
  cycleImprintsAfterEntry: number;
  entryCycleImprintDelta: number;
  clearedNodeIds: string[];
  anchorClearIndices: [number, number];
  bossClearIndex: number;
  settlement: RunProtocolSettlement;
  exitResourceDeltas: DeepRouteResourceDeltas;
};

export type SevenDungeonDeepMissingAnchorSummary = SevenDungeonDeepRouteBranchSummary & {
  omittedNodeId: string;
};

export type SevenDungeonDeepRouteSummary = {
  tier: number;
  dungeonId: DungeonId;
  dungeonName: string;
  definition: DeepRunProtocolDefinition;
  requiredNodeIds: [string, string];
  bossNodeId: string;
  enemyStatMultiplierPercent: number;
  clearRewardPointMultiplierPercent: number;
  success: SevenDungeonDeepRouteBranchSummary;
  missingAnchor: SevenDungeonDeepMissingAnchorSummary;
  protocolMaterialInventoryDelta: number;
  routeMaterialInventoryDelta: number;
  nonProtocolMaterialInventoryDelta: number;
  duplicateExitResourceDeltas: DeepRouteResourceDeltas;
  legacyAuction?: LegacyAuctionDeepRouteEvidence;
};

export type SevenDungeonDeepRouteResult = {
  baseState: GameState;
  summaries: SevenDungeonDeepRouteSummary[];
};

export type DungeonLawStatusEvidence = {
  checkpoint: string;
  nodeId: string;
  status: string;
  targetReached: boolean;
  law: DungeonLawData;
  modifiers: DungeonLawModifiers;
};

export type DungeonLawModifierEvidence = {
  metric: string;
  before: number | boolean | string | null;
  after: number | boolean | string | null;
  beforeCheckpoint: string;
  afterCheckpoint: string;
};

export type SevenDungeonLawRouteSummary = {
  tier: number;
  dungeonId: DungeonId;
  dungeonName: string;
  visitedNodeIds: string[];
  lawStatuses: DungeonLawStatusEvidence[];
  modifierEvidence: DungeonLawModifierEvidence[];
  openingDistribution: CombatOpeningDistribution;
  focusTrace: CombatFocusTrace[];
  routeEvidence: RouteLegalityEvidence;
  completed: boolean;
};

export type SevenDungeonLawRouteResult = {
  baseState: GameState;
  summaries: SevenDungeonLawRouteSummary[];
};

export type MirrorCycleCityShellEvidence = {
  anchors: Readonly<Record<MirrorCityPhase, boolean>>;
  entryPassives: Readonly<{
    parallaxVisor: boolean;
    phaseweaveMantle: boolean;
    homecomingPrism: boolean;
  }>;
  anchoredPhaseCount: number;
  prismCredit: number;
  totalShells: number;
  remainingShells: number;
  routeEvidence: RouteLegalityEvidence;
};

export type MirrorCycleCityLawScenarioResult = {
  baseState: GameState;
  transitionCosts: ReadonlyArray<{
    phaseweaveMantle: boolean;
    damagePercent: number;
    hpBefore: number;
    hpAfter: number;
  }>;
  outgoingModifiers: Readonly<{
    plainReal: DungeonLawModifiers['outgoingDamage'];
    plainMirror: DungeonLawModifiers['outgoingDamage'];
    visorReal: DungeonLawModifiers['outgoingDamage'];
    visorMirror: DungeonLawModifiers['outgoingDamage'];
  }>;
  anchorShellMatrix: MirrorCycleCityShellEvidence[];
  shellConsumption: Readonly<{
    remainingShells: number[];
    brokenMirrorShells: number[];
  }>;
  completedRoute: Readonly<{
    phaseChoices: MirrorCityPhaseChoiceEvidence[];
    visitedNodeIds: string[];
    bossNodeCleared: boolean;
    exitNodeCleared: boolean;
    completed: boolean;
    routeEvidence: RouteLegalityEvidence;
  }>;
  portalRing: ReadonlyArray<{
    nodeId: 'upper_return_portal' | 'lower_return_portal';
    targetDungeonId: DungeonId;
    targetNodeId: string;
    choice: 'stabilize' | 'force';
    routeEvidence: RouteLegalityEvidence;
  }>;
};

export type RedactionScriptoriumLawRouteResult = Readonly<{
  baseState: GameState;
  standardPath: Readonly<{
    clauseChoices: Readonly<Record<RedactionClauseNodeId, RedactionChoice>>;
    redactCost: Readonly<{
      nodeId: 'return_clause_desk';
      costPercent: 8;
      maxHp: number;
      hpBefore: number;
      hpAfter: number;
      damage: number;
    }>;
    gates: Readonly<{
      certifiedBodyAreaOpen: boolean;
      certifiedMemoryAreaOpen: boolean;
      redactedReturnAreaOpen: boolean;
      bossApproachOpen: boolean;
    }>;
    bossSnapshot: Readonly<Partial<Record<RedactionClauseNodeId, RedactionChoice>>>;
  }>;
  bossComparison: Readonly<{
    allCertify: RedactionBossEffectProjection;
    allRedact: RedactionBossEffectProjection;
  }>;
  equipmentMatrix: ReadonlyArray<Readonly<{
    equipmentId: 'redline_edge' | 'palimpsest_mantle' | 'final_proof_seal';
    matchingMetrics: readonly (keyof RedactionBossEffectProjection['sealed'])[];
    entryPassives: RedactionEntryPassives;
    projectedAtBoss: RedactionBossEffectProjection;
    projectedAfterMutation: RedactionBossEffectProjection;
    frozenAfterMutation: boolean;
  }>>;
  portalRing: Readonly<{
    dungeonIds: readonly ['redaction_scriptorium', 'legacy_auction_court', 'genesis_vault', 'silent_broadcast_tower', 'lost_shelter', 'false_testimony_court', 'combat_replay_stage', 'panopticon_city', 'demon_tower_1'];
    lawKinds: readonly ['redaction_scriptorium', 'legacy_auction_court', 'genesis_vault', 'silent_broadcast_tower', 'lost_shelter', 'false_testimony_court', 'combat_replay_stage', 'panopticon_city', 'demon_tower'];
    noPriorLawLeakage: boolean;
  }>;
}>;

export type LegacyAuctionCourtLawScenarioRow = Readonly<{
  choiceKey: string;
  choices: Readonly<Record<AuctionLotNodeId, AuctionLotChoice>>;
  choiceTrace: readonly AuctionLotChoiceEvidence[];
  scripCollected: number;
  scripConsumed: number;
  scripRemaining: number;
  entryPassives: LegacyAuctionEntryPassives;
  bossSnapshot: Readonly<Record<AuctionLotNodeId, AuctionLotChoice>>;
  bossModifiers: AuctionBossModifierProjection;
  frozenBossSnapshot: boolean;
  routeEvidence: RouteLegalityEvidence;
}>;

export type LegacyAuctionCourtLawScenarioResult = Readonly<{
  baseState: GameState;
  rows: readonly LegacyAuctionCourtLawScenarioRow[];
}>;

export type LegacyAuctionDeepRouteEvidence = Readonly<{
  choices: Readonly<Record<AuctionLotNodeId, AuctionLotChoice>>;
  choiceTrace: readonly AuctionLotChoiceEvidence[];
  scripCollected: number;
  scripConsumed: number;
  scripRemainingBeforeExit: number;
  optionalBidVaultNodeIds: readonly ['force_claim_vault', 'return_claim_vault'];
  entryPassives: LegacyAuctionEntryPassives;
  bossSnapshot: Readonly<Record<AuctionLotNodeId, AuctionLotChoice>>;
  bossModifiers: AuctionBossModifierProjection;
  frozenSoulSkillIds: readonly string[];
  bossNodeCleared: boolean;
  exitNodeCleared: boolean;
  successfulExit: boolean;
}>;

export type CombatFocusTrace = {
  nodeId: string;
  action: CombatAction;
  intentId: string;
  beforeFocus: number;
  afterFocus: number;
  beforeTurn: number;
  afterTurn: number;
  progressed: boolean;
  combatEnded: boolean;
  skillSpent: boolean;
};

export type RouteGateEvidence = {
  gateId: string;
  label: string;
  fromNodeId: string;
  toNodeId: string;
  status: 'open' | 'closed';
  blockReason?: string;
  traversed: boolean;
};

export type RouteMovementEvidence = {
  fromNodeId: string;
  toNodeId: string;
  legal: boolean;
  routeGateId?: string;
  blockReason?: string;
};

export type EntropyHeadingChoiceEvidence = {
  nodeId: string;
  targetNodeId: string;
  choice: EntropyHeadingChoice;
  entropyBefore: number;
  entropyAfter: number;
  candidatePathLength: number;
  resolvedHeadingChoices: Readonly<Record<string, EntropyHeadingChoice>>;
  bossEntropyLocked: boolean;
  collapseLayers: number;
};

export type MirrorCityPhaseChoiceEvidence = {
  nodeId: string;
  targetNodeId: string;
  phase: MirrorCityPhase;
  phaseBefore: MirrorCityPhase;
  phaseAfter: MirrorCityPhase;
  phaseChanged: boolean;
  damagePercent: number;
  hpBefore: number;
  hpAfter: number;
  candidatePathLength: number;
  resolvedPhaseChoices: Readonly<Record<string, MirrorCityPhase>>;
  anchors: Readonly<Record<MirrorCityPhase, boolean>>;
};

export type TacticalLoadoutEvidence = {
  dungeonId: DungeonId;
  plannedNodeIds: string[];
  preparedItemIds: TacticalItemId[];
  generalSlotItemIds: TacticalItemId[];
  specializedSlotAssignments: TacticalRigSlotAssignment[];
  generalSlotsUsed: number;
  generalSlotsAvailable: number;
  activeFieldRigIds: string[];
  entrySnapshot: TacticalLoadoutSnapshot;
  inventoryAtEntry: Partial<Record<TacticalItemId, number>>;
  valid: boolean;
};

export type TrapChoiceEvidence = {
  dungeonId: DungeonId;
  nodeId: string;
  counterItem?: ItemId;
  choice: 'counter' | 'risk';
  carried: boolean;
  inventoryBefore: number;
  inventoryAfter: number;
  hpBefore: number;
  hpAfter: number;
  damage: number;
  cleared: boolean;
};

export type PortalChoiceEvidence = {
  sourceDungeonId: DungeonId;
  nodeId: string;
  stableItem?: ItemId;
  choice: 'stabilize' | 'force';
  inventoryBefore: number;
  inventoryAfter: number;
  hpBefore: number;
  hpAfter: number;
  damage: number;
  targetDungeonId?: DungeonId;
};

export type RouteSectorEvidence = {
  checkpoint: string;
  nodeId: string;
  sectorId: string;
  label: string;
  gateCount: number;
  openGateCount: number;
  closedGateCount: number;
  status: 'open' | 'partial' | 'closed';
  blockReasons: string[];
  detourTargetNodeId?: string;
};

export type RunRelicDraftEvidence = {
  dungeonId: DungeonId;
  nodeId: string;
  relicDraftId: string;
  frame: RunRelicFrame;
  candidateIds: RunRelicId[];
  candidateCount: number;
  conduitSourceEquipmentIds: EquipmentId[];
  conduitSourceLevels: Partial<Record<EquipmentId, number>>;
  chosenRelicId: RunRelicId;
  effectsBefore: RunRelicEffects;
  effectsAfter: RunRelicEffects;
  powerBefore: number;
  powerAfter: number;
  readinessBefore: ReturnType<typeof getDungeonReadiness>;
  readinessAfter: ReturnType<typeof getDungeonReadiness>;
};

export type RunRelicRewardEvidence = {
  dungeonId: DungeonId;
  nodeId: string;
  baseRewardPoints: number;
  rewardPointsGained: number;
  hpBefore: number;
  hpAfter: number;
  effects: RunRelicEffects;
};

export type RouteLegalityEvidence = {
  gateChecks: RouteGateEvidence[];
  movements: RouteMovementEvidence[];
  headingChoiceTrace: EntropyHeadingChoiceEvidence[];
  mirrorPhaseChoiceTrace: MirrorCityPhaseChoiceEvidence[];
  auctionLotChoiceTrace: AuctionLotChoiceEvidence[];
  genesisSpliceChoiceTrace: GenesisSpliceChoiceEvidence[];
  broadcastRelayChoiceTrace: BroadcastRelayChoiceEvidence[];
  escortCheckpointChoiceTrace: EscortCheckpointChoiceEvidence[];
  falseTestimonyAccusationTrace: FalseTestimonyAccusationEvidence[];
  broadcastEntryPassives?: Readonly<BroadcastEntryPassives>;
  tacticalLoadoutTrace: TacticalLoadoutEvidence[];
  trapChoiceTrace: TrapChoiceEvidence[];
  portalChoiceTrace: PortalChoiceEvidence[];
  routeSectorTrace: RouteSectorEvidence[];
  relicDraftTrace: RunRelicDraftEvidence[];
  relicRewardTrace: RunRelicRewardEvidence[];
};

export type AuctionLotChoiceEvidence = {
  nodeId: AuctionLotNodeId;
  choice: AuctionLotChoice;
  scripBefore: number;
  scripCost: number;
  scripAfter: number;
  resolvedLotChoices: Readonly<Partial<Record<AuctionLotNodeId, AuctionLotChoice>>>;
};

export type GenesisSpliceChoiceEvidence = {
  nodeId: string;
  gene: GenesisGene;
  serumBefore: number;
  runSerumBefore: number;
  serumCost: number;
  serumAfter: number;
  runSerumAfter: number;
  spliceSequence: GenesisGene[];
};

export type BroadcastRelayChoiceEvidence = {
  nodeId: BroadcastRelayNodeId;
  choice: BroadcastRelayChoice;
  noiseBefore: number;
  noiseDelta: number;
  noiseAfter: number;
  bonusRewardPoints: number;
  resolvedRelayChoices: Readonly<Partial<Record<BroadcastRelayNodeId, BroadcastRelayChoice>>>;
};

export type EscortCheckpointChoiceEvidence = {
  nodeId: EscortCheckpointNodeId;
  choice: EscortCheckpointChoice;
  survivorHpBefore: number;
  survivorHpAfter: number;
  inventoryPillsBefore: number;
  inventoryPillsAfter: number;
  runPillsBefore: number;
  runPillsAfter: number;
  healingPillCost: number;
  bonusRewardPoints: number;
  entryGear: Readonly<EscortEntryGear>;
  entryCompanion: Readonly<EscortEntryCompanion>;
  companionRole: string;
};

export type FalseTestimonyAccusationEvidence = {
  nodeId: 'verdict_chamber' | 'appeal_desk';
  suspect: FalseTestimonySuspect;
  currentTrustedCountBefore: number;
  accusationTrustedCountBefore: number;
  accusationTrustedCountAfter: number;
  projectedRewardPointsBefore: number;
  rewardPointsDelta: number;
  correct: boolean;
  appealed: boolean;
  appealUsedAfter: boolean;
};

export type GenesisSpecializationRouteEvidence = Readonly<{
  gene: 'renewal';
  geneCount: number;
  vaultNodeId: 'renewal_gene_vault';
  reachedVault: boolean;
  spliceChoiceTrace: readonly GenesisSpliceChoiceEvidence[];
  routeEvidence: RouteLegalityEvidence;
}>;

export type BroadcastSpecializationBranchEvidence = Readonly<{
  branchNodeId: 'silent_archive' | 'resonance_vault' | 'balanced_switchboard';
  reachedBranch: boolean;
  noiseAtBranch: number;
  muteCount: number;
  broadcastCount: number;
  relayChoices: Readonly<Partial<Record<BroadcastRelayNodeId, BroadcastRelayChoice>>>;
  entryPassives: Readonly<BroadcastEntryPassives>;
  bossNodeCleared: boolean;
  exitNodeCleared: boolean;
  completed: boolean;
  playerSurvived: boolean;
  routeEvidence: RouteLegalityEvidence;
}>;

export type BroadcastSpecializationRouteResult = Readonly<{
  baseState: GameState;
  equippedEquipmentIds: readonly EquipmentId[];
  silent: BroadcastSpecializationBranchEvidence;
  resonance: BroadcastSpecializationBranchEvidence;
  balanced: BroadcastSpecializationBranchEvidence;
}>;

export type LostShelterSpecializationBranchEvidence = Readonly<{
  branchNodeId: 'evacuation_cache' | 'desperate_armory' | 'balanced_medbay';
  reachedBranch: boolean;
  survivorHpAtBranch: number;
  resolvedCheckpointChoices: Readonly<Partial<Record<EscortCheckpointNodeId, EscortCheckpointChoice>>>;
  treatCount: number;
  pushCount: number;
  entryGear: Readonly<EscortEntryGear>;
  entryCompanion: Readonly<EscortEntryCompanion>;
  companionRole: string;
  firstHazardGuardUsed: boolean;
  bossSurvivorSnapshot: number | null;
  bossNodeCleared: boolean;
  exitNodeCleared: boolean;
  completed: boolean;
  playerSurvived: boolean;
  survivorAlive: boolean;
  routeEvidence: RouteLegalityEvidence;
}>;

export type LostShelterSpecializationRouteResult = Readonly<{
  baseState: GameState;
  materialFarmRuns: number;
  rescueBadgesBeforeFarm: number;
  rescueBadgesAfterFarm: number;
  equippedEquipmentIds: readonly EquipmentId[];
  equipmentLevels: Readonly<Partial<Record<EquipmentId, number>>>;
  equipmentTemperRanks: Readonly<Partial<Record<EquipmentId, number>>>;
  equipmentAttunements: Readonly<Partial<Record<EquipmentId, EquipmentAttunementId>>>;
  evacuation: LostShelterSpecializationBranchEvidence;
  desperate: LostShelterSpecializationBranchEvidence;
  balanced: LostShelterSpecializationBranchEvidence;
}>;

export type FalseTestimonySpecializationBranchEvidence = Readonly<{
  branchNodeId: 'truth_archive' | 'swift_judgment_armory' | 'false_verdict_vault';
  reachedBranch: boolean;
  revealedEvidenceIds: readonly string[];
  contaminatedEvidenceIds: readonly string[];
  currentTrustedCount: number;
  accusationCorrect: boolean | null;
  accusationTrustedCount: number;
  appealUsed: boolean;
  accusationRewardPoints: number;
  projectedAccusationRewardPoints: number;
  appealEligibleAfterBranch: boolean;
  appealResolvedAfterBranch: boolean;
  entryGear: FalseTestimonyStatus['entryGear'];
  bossVerdictSnapshot: FalseTestimonyStatus['bossVerdictSnapshot'];
  bossNodeCleared: boolean;
  exitNodeCleared: boolean;
  completed: boolean;
  playerSurvived: boolean;
  routeEvidence: RouteLegalityEvidence;
}>;

export type FalseTestimonySpecializationRouteResult = Readonly<{
  baseState: GameState;
  materialFarmRuns: number;
  truthFragmentsBeforeFarm: number;
  truthFragmentsAfterFarm: number;
  equippedEquipmentIds: readonly EquipmentId[];
  equipmentLevels: Readonly<Partial<Record<EquipmentId, number>>>;
  equipmentTemperRanks: Readonly<Partial<Record<EquipmentId, number>>>;
  equipmentAttunements: Readonly<Partial<Record<EquipmentId, EquipmentAttunementId>>>;
  truth: FalseTestimonySpecializationBranchEvidence;
  swift: FalseTestimonySpecializationBranchEvidence;
  swiftOneEvidence: FalseTestimonySpecializationBranchEvidence;
  falseVerdict: FalseTestimonySpecializationBranchEvidence;
  appeal: Readonly<{
    wrongAccusationTrustedCount: number;
    correctAfterAppeal: boolean;
    appealUsed: boolean;
    falseVaultClearedBeforeAppeal: boolean;
    rewardPointsAfterAppeal: number;
    completed: boolean;
  }>;
  falseVaultFirst: Readonly<{
    falseVaultCleared: boolean;
    appealEligibleAfterVault: boolean;
    appealResolvedAfterVault: boolean;
  }>;
}>;

export type LostShelterPortalRingEvidence = Readonly<{
  shelterPortalNodeId: 'upper_return_portal' | 'lower_return_portal' | 'return_shelter_portal';
  testimonyLandingNodeId: 'north_entry' | 'lower_entry' | 'verdict_gate';
  testimonyPortalNodeId: 'upper_return_portal' | 'lower_return_portal' | 'return_testimony_portal';
  replayLandingNodeId: 'upper_entry' | 'lower_entry' | 'stage_gate';
  replayPortalNodeId: 'upper_return_portal' | 'lower_return_portal' | 'return_rehearsal_portal';
  panopticonLandingNodeId: 'upper_entry' | 'lower_entry' | 'panopticon_gate';
  panopticonPortalNodeId: 'upper_return_portal' | 'lower_return_portal' | 'refraction_return_portal';
  tierOneLandingNodeId: 'sealed_cache' | 'fog_lesser_demon' | 'quiet_prayer_reward';
  dungeonIds: readonly ['lost_shelter', 'false_testimony_court', 'combat_replay_stage', 'panopticon_city', 'demon_tower_1'];
  completedDungeonIdsUnchanged: boolean;
  mainlineClaimsUnchanged: boolean;
  routeEvidence: RouteLegalityEvidence;
}>;

export type SevenDungeonRunRelicRouteSummary = {
  tier: number;
  dungeonId: DungeonId;
  dungeonName: string;
  frame: RunRelicFrame;
  candidateMode: 'ordinary' | 'matching-equipment-conduit';
  seedRelicIdAtEntry?: RunRelicId;
  conduitSourceEquipmentIds: EquipmentId[];
  conduitSourceLevels: Partial<Record<EquipmentId, number>>;
  relicDraftNodeIds: string[];
  relicDraftIds: string[];
  chosenRelicIds: RunRelicId[];
  bossNodeId: string;
  exitNodeId: string;
  bossNodeCleared: boolean;
  exitNodeCleared: boolean;
  completed: boolean;
  pendingDraftCleared: boolean;
  archivedRelicId?: RunRelicId;
  archivedRelicIdsBefore: RunRelicId[];
  archivedRelicIdsAfter: RunRelicId[];
  archiveStatus: 'pending' | 'archived' | 'skipped' | 'lost';
  returnedToHub: boolean;
  routeEvidence: RouteLegalityEvidence;
};

export type RunRelicArchiveSeedEvidence = {
  sourceDungeonId: DungeonId;
  seededDungeonId: DungeonId;
  archivedRelicId: RunRelicId;
  archiveStatus: 'archived';
  returnedToHub: boolean;
  seededDraftId: string;
  firstCandidateId: RunRelicId;
  seedWasFirstCandidate: boolean;
};

export type SevenDungeonRunRelicRouteResult = {
  baseState: GameState;
  finalState: GameState;
  summaries: SevenDungeonRunRelicRouteSummary[];
  draftEvidence: RunRelicDraftEvidence[];
  rewardEvidence: RunRelicRewardEvidence[];
  coveredFrames: RunRelicFrame[];
  coveredRelicIds: RunRelicId[];
  archiveSeedEvidence: RunRelicArchiveSeedEvidence;
};

export type SoulSkillSourceEquipmentEvidence = {
  equipmentId: EquipmentSoulSkillSourceEquipmentId;
  skillId: EquipmentSoulSkillId;
  level: number;
  temperRank: number;
  equippedAtEntry: boolean;
};

export type SoulSkillUseEvidence = {
  scenarioId: string;
  dungeonId: DungeonId;
  nodeId: string;
  skillId: EquipmentSoulSkillId;
  effect: EquipmentSoulSkillEffect;
  succeeded: boolean;
  chargesBefore: number;
  chargesAfter: number;
  chargeDelta: number;
  readyBefore: boolean;
  readyAfter: boolean;
  spentAfter: boolean;
  hpBefore: number;
  hpAfter: number;
  hpDelta: number;
  focusBefore: number;
  focusAfter: number;
  focusDelta: number;
  turnBefore?: number;
  turnAfter?: number;
  turnDelta?: number;
  currentNodeIdBefore: string;
  currentNodeIdAfter: string;
  nodeClearedBefore: boolean;
  nodeClearedAfter: boolean;
  targetNodeId?: string;
  intentId?: string;
  naturalTrapFailure?: boolean;
  passDamage?: number;
  cleansableEffectKeysBefore?: string[];
  cleansableEffectKeysAfter?: string[];
  portalChoice?: 'stabilize' | 'force';
  itemId?: ItemId;
  inventoryDelta?: number;
  runLootDelta?: number;
  rejectionReason?: string;
  gameplayStateUnchangedOnReject?: boolean;
};

export type SoulRechargeLockEvidence = {
  api: 'move' | 'portal' | 'exit';
  blockKind?: NodeDepartureBlockKind;
  currentNodeIdBefore: string;
  currentNodeIdAfter: string;
  blocked: boolean;
  resourcesUnchanged: boolean;
};

export type SoulRechargeEvidence = {
  dungeonId: DungeonId;
  hostNodeId: string;
  rechargeId: string;
  availableBeforeHostClear: boolean;
  availableAfterHostClear: boolean;
  spentSkillIdsBefore: EquipmentSoulSkillId[];
  pendingAfterActivate: boolean;
  locks: SoulRechargeLockEvidence[];
  retreatAllowedWhilePending: boolean;
  cancelledWithoutUse: boolean;
  availableAfterCancel: boolean;
  reopenedAfterCancel: boolean;
  restoredSkillId: EquipmentSoulSkillId;
  chargesBeforeRestore: number;
  chargesAfterRestore: number;
  chargeDelta: number;
  restoredSkillReady: boolean;
  rechargeMarkedUsed: boolean;
  duplicateUsePrevented: boolean;
};

export type SoulPortalOffsetEvidence = {
  scenarioId: string;
  portalChoice: 'stabilize' | 'force';
  sourceDungeonId: DungeonId;
  sourceNodeId: string;
  targetDungeonId: DungeonId;
  defaultTargetNodeId: string;
  offsetTargetNodeId: string;
  reachedOffsetTarget: boolean;
  stableItemId?: ItemId;
  stableItemDelta: number;
  hpDelta: number;
  soulStatePreservedAcrossPortal: boolean;
};

export type SoulRewardSealEvidence = {
  dungeonId: DungeonId;
  nodeId: string;
  itemId: ItemId;
  rewardQuantity: number;
  sealedRunLootDeltaComparedWithNormal: number;
  sealedBankedInventoryDeltaComparedWithNormal: number;
  totalInventoryDeltaComparedWithNormal: number;
  rewardPointDeltaMatchesNormal: boolean;
  relicDraftId?: string;
  relicDraftCandidateIds: RunRelicId[];
  normalRelicDraftCandidateIds: RunRelicId[];
  relicDraftPreserved: boolean;
  inventoryBeforeSeal: number;
  inventoryAfterSeal: number;
  inventoryAfterRetreat: number;
  inventoryAfterFailure: number;
  retainedAfterRetreat: boolean;
  retainedAfterFailure: boolean;
};

export type SoulChargeGateEvidence = {
  dungeonId: DungeonId;
  firstSkillId: EquipmentSoulSkillId;
  secondSkillId: EquipmentSoulSkillId;
  rejectedSkillId: EquipmentSoulSkillId;
  chargesAfterFirstUse: number;
  chargesAfterSecondUse: number;
  rejectedAvailability: string;
  rejectedWithoutMutation: boolean;
  rechargeId: string;
  restoredSkillId: EquipmentSoulSkillId;
  chargesAfterRecharge: number;
  reusedAfterRecharge: boolean;
};

export type SoulEquipmentSnapshotEvidence = {
  dungeonId: DungeonId;
  frozenSkillIdsAtEntry: EquipmentSoulSkillId[];
  readySkillIdsAtEntry: EquipmentSoulSkillId[];
  chargesAtEntry: number;
  swappedOutEquipmentIds: EquipmentSoulSkillSourceEquipmentId[];
  equippedSkillCountAfterSwap: number;
  snapshotStableAfterSwap: boolean;
};

export type SevenDungeonSoulRouteSummary = {
  tier: number;
  dungeonId: DungeonId;
  dungeonName: string;
  hostNodeId: string;
  rechargeId: string;
  entryFrozenSkillIds: EquipmentSoulSkillId[];
  entryReadySkillIds: EquipmentSoulSkillId[];
  entryCharges: number;
  preRechargeSkillUse: SoulSkillUseEvidence;
  recharge: SoulRechargeEvidence;
  hostCleared: boolean;
  clearedNodeIds: string[];
  uniqueClearedNodeCount: number;
  duplicateNodeSettlementPrevented: boolean;
  terminalNodeId: string;
  terminalReached: boolean;
  permanentRouteLock: boolean;
  restoredSkillReused: boolean;
  routeEvidence: RouteLegalityEvidence;
};

export type SevenDungeonSoulRouteResult = {
  baseState: GameState;
  sourceEquipment: SoulSkillSourceEquipmentEvidence[];
  equipmentSnapshot: SoulEquipmentSnapshotEvidence;
  summaries: SevenDungeonSoulRouteSummary[];
  skillUses: SoulSkillUseEvidence[];
  rechargeEvidence: SoulRechargeEvidence[];
  portalOffsets: SoulPortalOffsetEvidence[];
  rewardSeal: SoulRewardSealEvidence;
  chargeGate: SoulChargeGateEvidence;
  coveredSkillIds: EquipmentSoulSkillId[];
  coveredRechargeIds: string[];
};

export type TemperingSimulationSummary = {
  equipmentId: EquipmentId;
  ranks: {
    initial: number;
    afterRankOne: number;
    afterAttunement: number;
    final: number;
  };
  resourceDeltas: {
    rewardPoints: number;
    lingyun: number;
    items: Partial<Record<ItemId, number>>;
  };
  scoreDeltas: {
    rankOne: number;
    attunement: number;
    rankTwo: number;
    total: number;
  };
  powerDeltas: {
    rankOne: number;
    attunement: number;
    rankTwo: number;
    total: number;
  };
  attunement: EquipmentAttunementId | undefined;
  completed: boolean;
};

export type EquipmentCommissionProgressEvidence = Readonly<{
  active: boolean;
  completedDungeonIds: readonly DungeonId[];
  completedDungeonCount: number;
}>;

export type EquipmentCommissionGearEvidence = Readonly<{
  equipmentId: EquipmentId;
  level: number;
  attunement: EquipmentAttunementId | undefined;
  temperRank: number;
  sealed: boolean;
}>;

export type EquipmentCommissionExitEvidence = Readonly<{
  kind: 'distinct' | 'repeat';
  dungeonId: DungeonId;
  bossNodeId: string;
  exitNodeId: string;
  phaseAfter: GameState['phase'];
  successful: boolean;
  bossNodeCleared: boolean;
  exitNodeCleared: boolean;
  progressBefore: EquipmentCommissionProgressEvidence;
  progressAfter: EquipmentCommissionProgressEvidence;
  settlement: EquipmentCommissionSettlement | undefined;
  routeEvidence: RouteLegalityEvidence;
}>;

export type EquipmentCommissionInterruptionEvidence = Readonly<{
  kind: 'retreat' | 'failure';
  dungeonId: DungeonId;
  dangerNodeId: string;
  dangerNodeCleared: boolean;
  phaseAfter: GameState['phase'];
  progressBefore: EquipmentCommissionProgressEvidence;
  progressAfter: EquipmentCommissionProgressEvidence;
  settlement: EquipmentCommissionSettlement | undefined;
  routeEvidence: RouteLegalityEvidence;
}>;

export type EquipmentCommissionRouteResult = Readonly<{
  equipmentIds: readonly [EquipmentId, EquipmentId];
  targetMaterialId: ItemId;
  requiredDungeonCount: number;
  materialReward: number;
  start: Readonly<{
    quotedCost: Readonly<{ rewardPoints: number; lingyun: number }>;
    paidCost: Readonly<{ rewardPoints: number; lingyun: number }>;
    candidateEquipmentIdsBefore: readonly EquipmentId[];
    progressAfter: EquipmentCommissionProgressEvidence;
    equipmentBefore: readonly EquipmentCommissionGearEvidence[];
    equipmentAfter: readonly EquipmentCommissionGearEvidence[];
  }>;
  distinctExits: readonly [
    EquipmentCommissionExitEvidence,
    EquipmentCommissionExitEvidence,
    EquipmentCommissionExitEvidence
  ];
  repeatedExit: EquipmentCommissionExitEvidence;
  retreat: EquipmentCommissionInterruptionEvidence;
  failure: EquipmentCommissionInterruptionEvidence;
  completion: Readonly<{
    materialCountBeforeFinalRoute: number;
    materialCountAfterFinalRoute: number;
    materialDelta: number;
    progressAfter: EquipmentCommissionProgressEvidence;
    equipmentAfter: readonly EquipmentCommissionGearEvidence[];
    progressionPreserved: boolean;
  }>;
  finalState: GameState;
}>;

type InvestmentPlan = {
  equipment?: EquipmentId[];
  upgrades?: EquipmentId[];
  methods?: MethodId[];
  pets?: PetId[];
};

type RouteCombatEvidence = {
  usedWeaponSkillNodeIds: string[];
  focusTrace: CombatFocusTrace[];
  routeGateChecks: RouteGateEvidence[];
  routeMovements: RouteMovementEvidence[];
  headingChoiceTrace: EntropyHeadingChoiceEvidence[];
  mirrorPhaseChoiceTrace: MirrorCityPhaseChoiceEvidence[];
  auctionLotChoiceTrace: AuctionLotChoiceEvidence[];
  genesisSpliceChoiceTrace: GenesisSpliceChoiceEvidence[];
  broadcastRelayChoiceTrace: BroadcastRelayChoiceEvidence[];
  escortCheckpointChoiceTrace: EscortCheckpointChoiceEvidence[];
  falseTestimonyAccusationTrace: FalseTestimonyAccusationEvidence[];
  broadcastEntryPassives?: Readonly<BroadcastEntryPassives>;
  tacticalLoadoutTrace: TacticalLoadoutEvidence[];
  trapChoiceTrace: TrapChoiceEvidence[];
  portalChoiceTrace: PortalChoiceEvidence[];
  routeSectorTrace: RouteSectorEvidence[];
  relicDraftTrace: RunRelicDraftEvidence[];
  relicRewardTrace: RunRelicRewardEvidence[];
  prioritizeHealing?: boolean;
  healingTargetRatio?: number;
  reserveThunderTalismanForNodeId?: string;
  reserveWeaponSkillForNodeId?: string;
  visitedNodeIds?: string[];
  scriptedActions?: Partial<Record<string, CombatAction[]>>;
  combatProfiles?: Array<{
    nodeId: string;
    monsterId: string;
    maxHp: number;
    attack: number;
    artPower: number;
    defense: number;
  }>;
  combatActions?: CombatFocusTrace[];
  lawStatuses?: DungeonLawStatusEvidence[];
  chooseRunRelic?: (state: GameState, candidateIds: readonly RunRelicId[]) => RunRelicId;
  autoResolveEquipmentOffers?: boolean;
  useAllCombatSupports?: boolean;
  methodTechniqueNodeId?: string;
  deferMethodTechniqueNodeId?: string;
  companionAssistNodeId?: string;
  deferCompanionAssistNodeId?: string;
  bloodlineSurgeNodeId?: string;
  soulSkipNodeId?: string;
};

const MAX_COMBAT_ACTIONS = 96;
const BROADCAST_BOSS_SURVIVAL_SCRIPT = [
  ...Array.from(
    { length: MAX_COMBAT_ACTIONS },
    (_, index) => (index % 3 === 2 ? 'guard' as const : 'art' as const)
  )
] satisfies CombatAction[];
const BROADCAST_WARDEN_SURVIVAL_SCRIPT = Array.from(
  { length: MAX_COMBAT_ACTIONS },
  (_, index) => (index % 2 === 0 ? 'attack' as const : 'art' as const)
) satisfies CombatAction[];
const LOST_SHELTER_SURVIVAL_SCRIPT = Array.from(
  { length: MAX_COMBAT_ACTIONS },
  () => 'art' as const
) satisfies CombatAction[];
const SHELTER_ENFORCER_SURVIVAL_SCRIPT = Array.from(
  { length: MAX_COMBAT_ACTIONS },
  (_, index) => (['attack', 'art', 'guard'] as const)[index % 3]
) satisfies CombatAction[];
const SOUL_LOST_SHELTER_SURVIVAL_SCRIPT = Array.from(
  { length: MAX_COMBAT_ACTIONS },
  (_, index) => (['use_healing_pill', 'guard', 'art', 'art'] as const)[index % 4]
) satisfies CombatAction[];
const LOST_SHELTER_FIRST_CLEAR_SURVIVAL_SCRIPT = Array.from(
  { length: MAX_COMBAT_ACTIONS },
  (_, index) => (index % 2 === 0 ? 'use_healing_pill' : 'guard')
) satisfies CombatAction[];
const LOST_SHELTER_FIRST_CLEAR_BOSS_SCRIPT = Array.from(
  { length: MAX_COMBAT_ACTIONS },
  (_, index) => (index % 3 === 2 ? 'guard' : 'art')
) satisfies CombatAction[];
const LOST_SHELTER_BOSS_SURVIVAL_SCRIPT = Array.from(
  { length: MAX_COMBAT_ACTIONS },
  (_, index) => (index % 3 === 2 ? 'guard' : 'art')
) satisfies CombatAction[];
const FALSE_TESTIMONY_SURVIVAL_SCRIPT = Array.from(
  { length: MAX_COMBAT_ACTIONS },
  (_, index) => (['use_healing_pill', 'art', 'guard'] as const)[index % 3]
) satisfies CombatAction[];
const ARCHIVE_CENSOR_SURVIVAL_SCRIPT = Array.from(
  { length: MAX_COMBAT_ACTIONS },
  (_, index) => (index % 2 === 0 ? 'art' as const : 'guard' as const)
) satisfies CombatAction[];
const HOSTILE_WITNESS_SURVIVAL_SCRIPT = Array.from(
  { length: MAX_COMBAT_ACTIONS },
  (_, index) => (['art', 'art', 'guard', 'weapon_skill'] as const)[index % 4]
) satisfies CombatAction[];
const FALSE_TESTIMONY_BOSS_SURVIVAL_SCRIPT = Array.from(
  { length: MAX_COMBAT_ACTIONS },
  (_, index) => (['art', 'art', 'guard'] as const)[index % 3]
) satisfies CombatAction[];
const FALSE_TESTIMONY_WRONG_VERDICT_BOSS_SCRIPT = Array.from(
  { length: MAX_COMBAT_ACTIONS },
  (_, index) => (['art', 'art', 'guard'] as const)[index % 3]
) satisfies CombatAction[];
const COMBAT_REPLAY_TAKE_ALPHA_SCRIPT = Array.from(
  { length: MAX_COMBAT_ACTIONS },
  (_, index) => index === 0 || index % 3 !== 1 ? 'attack' : 'use_healing_pill'
) satisfies CombatAction[];
const COMBAT_REPLAY_TAKE_BETA_SCRIPT = Array.from(
  { length: MAX_COMBAT_ACTIONS },
  (_, index) => index === 0 ? 'art' : index % 3 === 1 ? 'use_healing_pill' : 'attack'
) satisfies CombatAction[];
const COMBAT_REPLAY_TAKE_GAMMA_SCRIPT = Array.from(
  { length: MAX_COMBAT_ACTIONS },
  (_, index) => index === 0 ? 'guard' : index % 3 === 1 ? 'use_healing_pill' : 'attack'
) satisfies CombatAction[];
const COMBAT_REPLAY_BOSS_SURVIVAL_SCRIPT = Array.from(
  { length: MAX_COMBAT_ACTIONS },
  (_, index) => (['attack', 'attack', 'use_healing_pill', 'guard'] as const)[index % 4]
) satisfies CombatAction[];
const COMBAT_REPLAY_CUE_STALKER_SCRIPT = Array.from(
  { length: MAX_COMBAT_ACTIONS },
  (_, index) => (['attack', 'art'] as const)[index % 2]
) satisfies CombatAction[];
const COMBAT_REPLAY_RETAKE_SCRIPT = Array.from(
  { length: MAX_COMBAT_ACTIONS },
  (_, index) => (['guard', 'attack', 'art', 'weapon_skill', 'use_thunder_talisman'] as const)[index % 5]
) satisfies CombatAction[];
const PANOPTICON_SURVIVAL_SCRIPT = Array.from(
  { length: MAX_COMBAT_ACTIONS },
  (_, index) => (['use_healing_pill', 'guard', 'art', 'weapon_skill'] as const)[index % 4]
) satisfies CombatAction[];

class BalanceSimulationError extends Error {}

function createRouteCombatEvidence(
  options: Partial<
    Pick<
      RouteCombatEvidence,
      | 'prioritizeHealing'
      | 'healingTargetRatio'
      | 'reserveThunderTalismanForNodeId'
      | 'reserveWeaponSkillForNodeId'
      | 'visitedNodeIds'
      | 'scriptedActions'
      | 'combatProfiles'
      | 'combatActions'
      | 'lawStatuses'
      | 'chooseRunRelic'
      | 'autoResolveEquipmentOffers'
      | 'useAllCombatSupports'
      | 'methodTechniqueNodeId'
      | 'deferMethodTechniqueNodeId'
      | 'companionAssistNodeId'
      | 'deferCompanionAssistNodeId'
      | 'bloodlineSurgeNodeId'
      | 'soulSkipNodeId'
    >
  > = {}
): RouteCombatEvidence {
  return {
    usedWeaponSkillNodeIds: [],
    focusTrace: [],
    routeGateChecks: [],
    routeMovements: [],
    headingChoiceTrace: [],
    mirrorPhaseChoiceTrace: [],
    auctionLotChoiceTrace: [],
    genesisSpliceChoiceTrace: [],
    broadcastRelayChoiceTrace: [],
    escortCheckpointChoiceTrace: [],
    falseTestimonyAccusationTrace: [],
    tacticalLoadoutTrace: [],
    trapChoiceTrace: [],
    portalChoiceTrace: [],
    routeSectorTrace: [],
    relicDraftTrace: [],
    relicRewardTrace: [],
    ...options,
    scriptedActions: {
      broadcast_warden_omega: BROADCAST_WARDEN_SURVIVAL_SCRIPT,
      last_broadcaster: BROADCAST_BOSS_SURVIVAL_SCRIPT,
      shelter_enforcer_north: LOST_SHELTER_SURVIVAL_SCRIPT,
      shelter_overseer: LOST_SHELTER_BOSS_SURVIVAL_SCRIPT,
      cue_stalker: COMBAT_REPLAY_CUE_STALKER_SCRIPT,
      cue_stalker_north: COMBAT_REPLAY_CUE_STALKER_SCRIPT,
      retake_double_omega: COMBAT_REPLAY_RETAKE_SCRIPT,
      ...(options.scriptedActions ?? {})
    }
  };
}

const NORMAL_PLAYER_ROUTE: Partial<Record<DungeonId, InvestmentPlan>> = {
  demon_tower_1: {
    equipment: ['armor_piercing_sword'],
    methods: ['mist_breathing'],
    pets: ['contract_sprite']
  },
  metro_abyss: {
    equipment: ['spirit_robe', 'rift_charm'],
    upgrades: ['armor_piercing_sword']
  },
  starfall_mine: {
    methods: ['iron_body', 'cloud_step', 'beast_taming'],
    upgrades: ['spirit_robe', 'armor_piercing_sword']
  },
  rust_hospital: {
    equipment: ['guardian_plate', 'starforged_edge'],
    methods: ['gate_sense', 'star_core_method'],
    pets: ['starling_drone']
  },
  ash_arena: {
    equipment: ['void_lantern'],
    upgrades: ['starforged_edge', 'guardian_plate']
  },
  dream_archive: {
    methods: ['void_heart'],
    upgrades: ['void_lantern', 'starforged_edge', 'guardian_plate']
  },
  void_citadel: {
    upgrades: ['void_lantern', 'starforged_edge', 'guardian_plate']
  },
  causal_clearinghouse: {
    upgrades: ['void_lantern', 'starforged_edge', 'guardian_plate']
  },
  entropy_ark: {
    equipment: [
      'chronal_edge',
      'chronal_aegis',
      'chronal_lens',
      'causal_visor',
      'echo_breaker_gauntlets',
      'return_anchor_belt'
    ],
    upgrades: [
      'chronal_edge',
      'chronal_aegis',
      'chronal_lens',
      'causal_visor',
      'echo_breaker_gauntlets',
      'return_anchor_belt',
      'chronal_edge',
      'chronal_aegis',
      'chronal_lens',
      'causal_visor',
      'echo_breaker_gauntlets',
      'return_anchor_belt'
    ]
  },
  mirror_cycle_city: {
    upgrades: ['chronal_edge', 'chronal_aegis', 'chronal_lens']
  },
  redaction_scriptorium: {
    upgrades: ['chronal_edge', 'chronal_aegis', 'chronal_lens']
  },
  legacy_auction_court: {
    equipment: ['guardian_gauntlets'],
    upgrades: ['guardian_gauntlets', 'guardian_gauntlets'],
    pets: ['starling_drone']
  },
  genesis_vault: {
    equipment: ['helix_cleaver', 'carapace_harness'],
    upgrades: ['helix_cleaver', 'carapace_harness', 'helix_cleaver', 'carapace_harness']
  },
  silent_broadcast_tower: {
    equipment: ['helix_cleaver', 'carapace_harness', 'rebirth_amulet'],
    upgrades: [
      'helix_cleaver',
      'carapace_harness',
      'rebirth_amulet',
      'helix_cleaver',
      'carapace_harness',
      'rebirth_amulet'
    ]
  }
};

const STANDARD_ROUTE_PREPARATION_NODES: Partial<Record<DungeonId, readonly string[]>> = {
  void_citadel: ['broken_name_trap'],
  temporal_observatory: [
    'past_calibration_anchor',
    'zero_meridian',
    'future_calibration_anchor',
    'future_supply'
  ],
  causal_clearinghouse: ['entry_docket'],
  entropy_ark: [
    'bow_heading_console',
    'dissipation_navigator_alpha',
    'midship_heading_console',
    'starboard_relic_hold',
    'stern_heading_console',
    'entropy_deckhand',
    'ark_manifest'
  ],
  mirror_cycle_city: [
    'first_phase_mirror',
    'shard_rain_trap',
    'real_anchor',
    'second_phase_mirror',
    'mirror_anchor',
    'third_phase_mirror',
    'cycle_manifest'
  ],
  redaction_scriptorium: [
    'body_clause_desk',
    'memory_clause_desk',
    'return_clause_desk',
    'final_proof_nexus'
  ],
  legacy_auction_court: [
    'force_relic_gallery',
    'force_lot_dais',
    'art_lot_dais',
    'return_lot_dais',
    'guard_lot_dais'
  ],
  genesis_vault: [
    'first_splice_console',
    'second_splice_console',
    'third_splice_console',
    'mosaic_gene_vault'
  ],
  silent_broadcast_tower: [
    'south_relay_console',
    'lower_entry',
    'broadcast_gate',
    'north_entry',
    'north_relay_console',
    'central_relay_console',
    'north_relay_console',
    'north_echo_cache',
    'silent_archive'
  ],
  lost_shelter: [
    'collapsed_hall_trap',
    'north_checkpoint',
    'shelter_enforcer_north',
    'central_checkpoint',
    'evacuation_horror_omega',
    'south_checkpoint'
  ],
  false_testimony_court: [
    'voice_filter_trap',
    'voice_evidence',
    'timeline_checksum_trap',
    'timeline_evidence',
    'residue_sterility_trap',
    'residue_evidence',
    'verdict_chamber',
    'cross_exam_stage'
  ],
  panopticon_city: [
    'scan_lattice_trap',
    'north_blind_relay',
    'central_blind_relay',
    'south_blind_relay',
    'shadow_route'
  ]
};

const LAW_ROUTE_PLANNED_NODES: Record<DungeonId, readonly string[]> = {
  demon_tower_1: ['fog_lesser_demon', 'blood_rune_trap', 'fog_patrol_pair', 'lower_fog_lesser', 'sealed_cache'],
  metro_abyss: ['tide_boatman', 'signal_cache'],
  starfall_mine: ['shell_patrol_alpha', 'tilted_gravity_switch', 'mine_shell_guard'],
  rust_hospital: [
    'plague_orderly',
    'ward_orderly_patrol',
    'plague_orderly_rounds',
    'pharmacy_reward',
    'triage_reward',
    'sterilizer_trap',
    'roof_access_trap'
  ],
  ash_arena: ['ash_duelist', 'ember_pit_duelist', 'cinder_lancer'],
  dream_archive: [
    'paper_librarian',
    'hallucination_patrol',
    'memory_loop_trap',
    'paper_librarian_echo',
    'incense_reward',
    'index_reward'
  ],
  void_citadel: ['void_knight', 'first_echo_patrol', 'second_echo_patrol'],
  temporal_observatory: [
    'past_clue_cache',
    'epoch_sentinel_alpha',
    'past_calibration_anchor',
    'erased_patrol',
    'zero_meridian',
    'accelerated_patrol',
    'future_calibration_anchor',
    'calibration_bridge'
  ],
  causal_clearinghouse: ['cause_deposition', 'effect_deposition'],
  entropy_ark: [
    'bow_heading_console',
    'dissipation_navigator_alpha',
    'port_relic_hold',
    'midship_heading_console',
    'starboard_relic_hold',
    'stern_heading_console',
    'ark_manifest'
  ],
  mirror_cycle_city: [
    'first_phase_mirror',
    'real_anchor',
    'second_phase_mirror',
    'mirror_anchor',
    'third_phase_mirror',
    'cycle_manifest'
  ],
  redaction_scriptorium: [
    'body_clause_desk',
    'memory_clause_desk',
    'return_clause_desk',
    'final_proof_nexus'
  ],
  legacy_auction_court: [
    'force_lot_dais',
    'guard_lot_dais',
    'art_lot_dais',
    'return_lot_dais',
    'provenance_event_stage'
  ],
  genesis_vault: [
    'first_splice_console',
    'second_splice_console',
    'third_splice_console',
    'mosaic_gene_vault'
  ],
  silent_broadcast_tower: [
    'south_relay_console',
    'north_relay_console',
    'acoustic_tripwire',
    'central_relay_console',
    'studio_side_lock',
    'balanced_switchboard'
  ],
  lost_shelter: [
    'collapsed_hall_trap',
    'north_checkpoint',
    'shelter_enforcer_north',
    'central_checkpoint',
    'evacuation_horror_omega',
    'south_checkpoint',
    'command_lock',
    'balanced_medbay'
  ],
  false_testimony_court: [
    'voice_filter_trap',
    'voice_evidence',
    'timeline_checksum_trap',
    'timeline_evidence',
    'residue_sterility_trap',
    'residue_evidence',
    'verdict_chamber',
    'truth_archive'
  ],
  combat_replay_stage: [
    'take_alpha',
    'take_beta',
    'take_gamma',
    'sequence_route'
  ],
  panopticon_city: [
    'north_blind_relay',
    'central_blind_relay',
    'south_blind_relay',
    'shadow_route',
    'all_sight_lock'
  ]
};

const LOST_SHELTER_DEEP_CHECKPOINT_NODES = [
  'alarm_grid_trap',
  'south_checkpoint',
  'alarm_grid_trap',
  'survivor_memory_stage',
  'survivor_cell',
  'central_checkpoint',
  'north_checkpoint',
  'central_checkpoint',
  'survivor_cell',
  'collapsed_hall_trap',
  'survivor_cell',
  'survivor_memory_stage'
] as const;

const RUN_RELIC_ROUTE_FRAMES: Record<DungeonId, RunRelicFrame> = {
  demon_tower_1: 'assault',
  metro_abyss: 'assault',
  starfall_mine: 'bulwark',
  rust_hospital: 'bulwark',
  ash_arena: 'wayfinder',
  dream_archive: 'wayfinder',
  void_citadel: 'assault',
  temporal_observatory: 'wayfinder',
  causal_clearinghouse: 'bulwark',
  entropy_ark: 'bulwark',
  mirror_cycle_city: 'wayfinder',
  redaction_scriptorium: 'assault',
  legacy_auction_court: 'assault',
  genesis_vault: 'bulwark',
  silent_broadcast_tower: 'bulwark',
  lost_shelter: 'bulwark',
  false_testimony_court: 'assault',
  combat_replay_stage: 'assault',
  panopticon_city: 'wayfinder'
};

const RUN_RELIC_ROUTE_CONDUIT_EQUIPMENT: Record<RunRelicFrame, EquipmentId> = {
  assault: 'starforged_edge',
  bulwark: 'guardian_plate',
  wayfinder: 'void_lantern'
};

const RUN_RELIC_ROUTE_SELECTION_PRIORITY = {
  assault: ['focus_prism', 'mist_edge', 'hunter_clock'],
  bulwark: ['mending_thread', 'iron_echo', 'bone_shell'],
  wayfinder: ['lucky_map', 'gate_anchor', 'rift_step']
} as const satisfies Readonly<Record<RunRelicFrame, readonly RunRelicId[]>>;

const SOUL_SOURCE_EQUIPMENT_IDS = [
  'mist_hood',
  'spirit_robe',
  'guardian_gauntlets',
  'cloudstep_boots',
  'rift_belt',
  'rift_charm'
] as const satisfies readonly EquipmentSoulSkillSourceEquipmentId[];

const SOUL_RECHARGE_ROUTE_CONFIG = {
  demon_tower_1: {
    hostNodeId: 'upper_fog_patrol',
    rechargeId: 'soul_node_demon_mist_watch'
  },
  metro_abyss: {
    hostNodeId: 'rail_wraith',
    rechargeId: 'soul_node_metro_third_rail'
  },
  starfall_mine: {
    hostNodeId: 'shell_guard_beta',
    rechargeId: 'soul_node_mine_load_bearing'
  },
  rust_hospital: {
    hostNodeId: 'pressure_door_trap',
    rechargeId: 'soul_node_hospital_negative_pressure'
  },
  ash_arena: {
    hostNodeId: 'smoke_gutter',
    rechargeId: 'soul_node_arena_smoke_verdict'
  },
  dream_archive: {
    hostNodeId: 'overwritten_record_trap',
    rechargeId: 'soul_node_archive_overwrite'
  },
  void_citadel: {
    hostNodeId: 'self_shadow_trap',
    rechargeId: 'soul_node_citadel_self_shadow'
  },
  temporal_observatory: {
    hostNodeId: 'soul_recharge_chamber',
    rechargeId: 'soul_node_temporal_recharge'
  },
  causal_clearinghouse: {
    hostNodeId: 'soul_recharge_chamber',
    rechargeId: 'soul_node_causal_recharge'
  },
  entropy_ark: {
    hostNodeId: 'soul_recharge_chamber',
    rechargeId: 'soul_node_entropy_recharge'
  },
  mirror_cycle_city: {
    hostNodeId: 'soul_recharge_mirror',
    rechargeId: 'soul_node_mirror_recharge'
  },
  redaction_scriptorium: {
    hostNodeId: 'soul_recharge_scriptorium',
    rechargeId: 'soul_node_redaction_rebind'
  },
  legacy_auction_court: {
    hostNodeId: 'soul_recharge_auction',
    rechargeId: 'soul_node_auction_reprice'
  },
  genesis_vault: {
    hostNodeId: 'soul_recharge_genesis',
    rechargeId: 'soul_node_genesis_recharge'
  },
  silent_broadcast_tower: {
    hostNodeId: 'soul_recharge_broadcast',
    rechargeId: 'soul_node_broadcast_recharge'
  },
  lost_shelter: {
    hostNodeId: 'soul_recharge_shelter',
    rechargeId: 'soul_node_shelter_recharge'
  },
  false_testimony_court: {
    hostNodeId: 'soul_recharge_verdict',
    rechargeId: 'soul_node_verdict_recharge'
  },
  combat_replay_stage: {
    hostNodeId: 'soul_recharge_stage',
    rechargeId: 'soul_node_combat_replay_recharge'
  },
  panopticon_city: {
    hostNodeId: 'soul_recharge_panopticon',
    rechargeId: 'soul_node_panopticon_recharge'
  }
} as const satisfies Readonly<
  Record<DungeonId, Readonly<{ hostNodeId: string; rechargeId: string }>>
>;

type PreparedDungeonEntryOptions = {
  protocolId?: RunProtocolId;
  routeContractId?: string;
  runPursuit?: 'isolated' | 'live';
  methodTechnique?: 'isolated' | 'live';
  plannedNodeIds: readonly string[];
  additionalTacticalItemIds?: readonly TacticalItemId[];
  portalUseNodeIds?: readonly string[];
  inventoryTargets?: Partial<Record<TacticalItemId, number>>;
};

function isolateRunPursuitForIndependentBalanceScenario(state: GameState): GameState {
  if (!state.run) return state;

  // Independent balance matrices own their target subsystem only; keep pursuit explicit and disabled,
  // rather than deleting the field and accidentally exercising legacy-save behavior.
  return {
    ...state,
    run: {
      ...state.run,
      pursuitState: createRunPursuitState(state.run.dungeonId, false)
    }
  };
}

function isolateMethodTechniqueForIndependentBalanceScenario(state: GameState): GameState {
  const progress = normalizeMethodCultivationProgress(state.learnedMethods, {
    rulesVersion: METHOD_CULTIVATION_RULES_VERSION,
    ranks: state.methodRanks,
    activeMethod: state.activeMethod
  });

  return {
    ...state,
    methodRanks: { ...progress.ranks },
    activeMethod: undefined
  };
}

function recordRouteSectorSnapshot(
  state: GameState,
  evidence: RouteCombatEvidence | undefined,
  checkpoint: string,
  detourTargetNodeId?: string,
  sectorIds?: ReadonlySet<string>
): void {
  if (!evidence || !state.run) return;
  const law = getCurrentDungeonLaw(state);
  if (!law) return;

  for (const sector of getRouteSectorDisplay(state.run.dungeonId, law.state)) {
    if (sectorIds && !sectorIds.has(sector.id)) continue;
    const duplicate = evidence.routeSectorTrace.some(
      (entry) =>
        entry.checkpoint === checkpoint &&
        entry.sectorId === sector.id &&
        entry.detourTargetNodeId === detourTargetNodeId
    );
    if (duplicate) continue;

    evidence.routeSectorTrace.push({
      checkpoint,
      nodeId: state.run.currentNodeId,
      sectorId: sector.id,
      label: sector.label,
      gateCount: sector.gateCount,
      openGateCount: sector.openGateCount,
      closedGateCount: sector.closedGateCount,
      status: sector.status,
      blockReasons: [...sector.blockReasons],
      detourTargetNodeId
    });
  }
}

function getPlannedTacticalItemIds(
  state: GameState,
  dungeonId: DungeonId,
  options: PreparedDungeonEntryOptions
): TacticalItemId[] {
  const dungeon = DUNGEONS[dungeonId];
  const plannedNodes = options.plannedNodeIds
    .map((nodeId) => dungeon.nodes.find((node) => node.id === nodeId))
    .filter((node): node is NonNullable<typeof node> => node !== undefined);
  const portalUseNodeIds = new Set(options.portalUseNodeIds ?? []);
  const candidates: TacticalItemId[] = [];
  const addCandidate = (itemId: ItemId | undefined): void => {
    if (itemId && isTacticalItemId(itemId) && !candidates.includes(itemId)) candidates.push(itemId);
  };

  if (
    dungeonId === 'false_testimony_court' &&
    plannedNodes.some((node) =>
      node.id === 'false_testimony_judge' || node.id === 'judgment_lock' || node.type === 'exit'
    )
  ) {
    addCandidate('dispel_talisman');
  }
  for (const itemId of options.additionalTacticalItemIds ?? []) addCandidate(itemId);
  for (const node of plannedNodes) addCandidate(node.trap?.counterItem);
  for (const node of plannedNodes) {
    if (portalUseNodeIds.has(node.id)) addCandidate(node.portal?.stableItem);
  }
  if (plannedNodes.some((node) => node.type === 'monster')) addCandidate('healing_pill');
  if (dungeonId === 'genesis_vault' && plannedNodes.some((node) => node.type === 'monster')) {
    addCandidate('thunder_talisman');
  }

  const activeFieldRigs = getTacticalLoadoutStatus(state).activeFieldRigs;
  const selected: TacticalItemId[] = [];
  for (const itemId of candidates) {
    if (selected.length >= 3) break;
    const proposed = [...selected, itemId];
    if (validateTacticalLoadout(proposed, activeFieldRigs).isValid) selected.push(itemId);
  }
  return selected;
}

function buyTacticalInventoryTargets(
  state: GameState,
  itemIds: readonly TacticalItemId[],
  targets: Partial<Record<TacticalItemId, number>>
): GameState {
  let nextState = state;
  for (const itemId of itemIds) {
    const target = targets[itemId] ?? 0;
    while (nextState.inventory[itemId] < target) {
      const beforeCount = nextState.inventory[itemId];
      nextState = buyItem(nextState, itemId);
      if (nextState.inventory[itemId] === beforeCount) break;
    }
  }
  return nextState;
}

function enterPreparedDungeon(
  state: GameState,
  dungeonId: DungeonId,
  evidence: RouteCombatEvidence,
  options: PreparedDungeonEntryOptions
): GameState {
  let entryState = state;
  if (dungeonId === 'false_testimony_court') {
    entryState = restoreSimulationHealth({
      ...entryState,
      player: {
        ...entryState.player,
        base: {
          ...entryState.player.base,
          body: Math.max(entryState.player.base.body, 80),
          spirit: Math.max(entryState.player.base.spirit, 64)
        }
      }
    });
    evidence.useAllCombatSupports = true;
    evidence.prioritizeHealing = true;
    evidence.healingTargetRatio = 0.8;
    evidence.soulSkipNodeId ??= 'hostile_witness_north';
    evidence.scriptedActions = {
      ...(evidence.scriptedActions ?? {}),
      hostile_witness_north: HOSTILE_WITNESS_SURVIVAL_SCRIPT,
      archive_censor_alpha: ARCHIVE_CENSOR_SURVIVAL_SCRIPT,
      perjury_hound_omega: FALSE_TESTIMONY_SURVIVAL_SCRIPT,
      hostile_witness: HOSTILE_WITNESS_SURVIVAL_SCRIPT,
      soul_recharge_verdict: ARCHIVE_CENSOR_SURVIVAL_SCRIPT,
      false_testimony_judge: FALSE_TESTIMONY_BOSS_SURVIVAL_SCRIPT
    };
    if (
      options.protocolId !== 'deep' &&
      entryState.ownedEquipment.includes('starforged_edge') &&
      entryState.equipmentLevels.starforged_edge === EQUIPMENT.starforged_edge.maxLevel
    ) {
      entryState = equipEquipment(entryState, 'starforged_edge');
    }
    if (options.protocolId !== 'deep' && entryState.bloodlineRanks.void_symbiote === 3) {
      entryState = activateBloodline(entryState, 'void_symbiote');
    }
  }
  const bossNodeId = getBossDefinition(dungeonId).nodeId;
  const exitNodeId = DUNGEONS[dungeonId].nodes.find((node) => node.type === 'exit')?.id;
  const plannedNodeIds = [...new Set([...options.plannedNodeIds, bossNodeId, ...(exitNodeId ? [exitNodeId] : [])])];
  const normalizedOptions = { ...options, plannedNodeIds };
  const preparedItemIds = getPlannedTacticalItemIds(entryState, dungeonId, normalizedOptions);
  const inventoryTargets = dungeonId === 'false_testimony_court' && preparedItemIds.includes('dispel_talisman')
    ? { dispel_talisman: 16, ...(options.inventoryTargets ?? {}) }
    : options.inventoryTargets ?? {};
  const targeted = buyTacticalInventoryTargets(entryState, preparedItemIds, inventoryTargets);
  const configured = configureTacticalLoadout(targeted, preparedItemIds);
  const configuredStatus = getTacticalLoadoutStatus(configured);
  if (!configuredStatus.isValid || configured.preparedItemIds?.join(',') !== preparedItemIds.join(',')) {
    throw new BalanceSimulationError(
      `Unable to configure a valid tactical loadout for ${dungeonId}: ${configuredStatus.reasons.join(' ')}`
    );
  }

  const methodPrepared =
    options.methodTechnique === 'live' ||
    dungeonId === 'genesis_vault' ||
    dungeonId === 'silent_broadcast_tower' ||
    dungeonId === 'lost_shelter' ||
    dungeonId === 'false_testimony_court'
    ? configured
    : isolateMethodTechniqueForIndependentBalanceScenario(configured);
  const enteredWithPursuit = enterDungeon(
    methodPrepared,
    dungeonId,
    options.protocolId ?? 'standard',
    options.routeContractId
  );
  const entered = options.runPursuit === 'live'
    ? enteredWithPursuit
    : isolateRunPursuitForIndependentBalanceScenario(enteredWithPursuit);
  const entryStatus = getTacticalLoadoutStatus(entered);
  const entrySnapshot = entered.run?.tacticalLoadout;
  if (entered.run?.dungeonId !== dungeonId || !entrySnapshot) {
    throw new BalanceSimulationError(`Unable to enter ${dungeonId} after tactical loadout configuration.`);
  }

  evidence.tacticalLoadoutTrace.push({
    dungeonId,
    plannedNodeIds,
    preparedItemIds: [...entryStatus.preparedItemIds],
    generalSlotItemIds: [...entryStatus.generalSlotItemIds],
    specializedSlotAssignments: [...entryStatus.specializedSlotAssignments],
    generalSlotsUsed: entryStatus.generalSlotsUsed,
    generalSlotsAvailable: entryStatus.generalSlotsAvailable,
    activeFieldRigIds: entryStatus.activeFieldRigs.map((rig) => rig.id),
    entrySnapshot: structuredClone(entrySnapshot),
    inventoryAtEntry: Object.fromEntries(
      entryStatus.preparedItemIds.map((itemId) => [itemId, entered.inventory[itemId]])
    ) as Partial<Record<TacticalItemId, number>>,
    valid: entryStatus.isValid
  });
  const broadcastStatus = getCurrentBroadcastRelayStatus(entered);
  if (broadcastStatus) evidence.broadcastEntryPassives = structuredClone(broadcastStatus.entryPassives);
  recordRouteSectorSnapshot(entered, evidence, 'entry');
  return entered;
}

function addReward(target: RewardBundle, source: RewardBundle = {}): RewardBundle {
  const items = { ...(target.items ?? {}) };
  for (const [itemId, amount] of Object.entries(source.items ?? {})) {
    items[itemId as keyof typeof items] = (items[itemId as keyof typeof items] ?? 0) + amount;
  }

  return {
    rewardPoints: (target.rewardPoints ?? 0) + (source.rewardPoints ?? 0),
    lingyun: (target.lingyun ?? 0) + (source.lingyun ?? 0),
    items
  };
}

function getDefaultDungeonReward(state: GameState, dungeonId: DungeonId): RewardBundle {
  let reward: RewardBundle = {};

  for (const node of DUNGEONS[dungeonId].nodes) {
    if (node.type === 'monster' && node.monsterId) {
      const monster = MONSTERS[node.monsterId];
      reward = addReward(reward, {
        rewardPoints: monster.rewardPoints,
        items: monster.drop
      });
    }

    if ((node.type === 'reward' || node.type === 'exit') && node.reward) {
      reward = addReward(reward, node.reward);
      const methodBonus = node.reward.methodBonus;
      if (methodBonus && state.learnedMethods.includes(methodBonus.methodId)) {
        reward = addReward(reward, methodBonus.reward);
      }
    }
  }

  return reward;
}

function grantReward(state: GameState, reward: RewardBundle): GameState {
  const inventory = { ...state.inventory };
  for (const [itemId, amount] of Object.entries(reward.items ?? {})) {
    inventory[itemId as keyof typeof inventory] += amount;
  }

  return {
    ...state,
    rewardPoints: state.rewardPoints + (reward.rewardPoints ?? 0),
    lingyun: state.lingyun + (reward.lingyun ?? 0),
    inventory
  };
}

function areAdjacentRouteNodes(
  a: { position: { x: number; y: number } },
  b: { position: { x: number; y: number } }
): boolean {
  return Math.abs(a.position.x - b.position.x) + Math.abs(a.position.y - b.position.y) === 1;
}

function recordRouteGateEvidence(
  evidence: RouteCombatEvidence | undefined,
  status: NonNullable<ReturnType<typeof getCurrentRouteGateStatus>>,
  traversed = false
): void {
  if (!evidence) return;

  const existing = evidence.routeGateChecks.find(
    (entry) => entry.gateId === status.gate.id && entry.status === status.status
  );
  if (existing) {
    if (traversed) existing.traversed = true;
    return;
  }

  evidence.routeGateChecks.push({
    gateId: status.gate.id,
    label: status.gate.label,
    fromNodeId: status.gate.fromNodeId,
    toNodeId: status.gate.toNodeId,
    status: status.status,
    blockReason: status.blockReason,
    traversed
  });
}

function findAdjacentRoutePath(
  state: GameState,
  targetNodeId: string,
  evidence?: RouteCombatEvidence,
  excludedNodeIds: ReadonlySet<string> = new Set()
): string[] {
  if (!state.run) throw new Error(`Cannot route to ${targetNodeId} without an active dungeon run.`);

  const dungeon = DUNGEONS[state.run.dungeonId];
  const nodeById = new Map(dungeon.nodes.map((node) => [node.id, node]));
  const startNode = nodeById.get(state.run.currentNodeId);
  const targetNode = nodeById.get(targetNodeId);

  if (!startNode) throw new Error(`${state.run.currentNodeId} is not on ${state.run.dungeonId}'s grid.`);
  if (!targetNode) throw new Error(`${targetNodeId} is not on ${state.run.dungeonId}'s grid.`);
  if (startNode.id === targetNode.id) return [];

  const dangerPenalty = dungeon.nodes.length + 1;
  const queue: Array<{ nodeId: string; path: string[]; cost: number }> = [{ nodeId: startNode.id, path: [], cost: 0 }];
  const bestCost = new Map([[startNode.id, 0]]);
  const closedGateIds = new Set<string>();
  const recordDetour = (path: string[]): string[] => {
    if (closedGateIds.size === 0) return path;
    const sectorIds = new Set(
      getDungeonRouteGates(state.run!.dungeonId)
        .filter((gate) => closedGateIds.has(gate.id))
        .map((gate) => gate.sector?.id ?? gate.id)
    );
    recordRouteSectorSnapshot(
      state,
      evidence,
      `detour:${startNode.id}->${targetNode.id}`,
      targetNode.id,
      sectorIds
    );
    return path;
  };

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;
    if (current.cost !== bestCost.get(current.nodeId)) continue;

    const currentNode = nodeById.get(current.nodeId)!;
    const routeState =
      currentNode.id === state.run.currentNodeId
        ? state
        : {
            ...state,
            run: {
              ...state.run,
              currentNodeId: currentNode.id
            }
          };
    const legalTargetIds = new Set(getCurrentLegalAdjacentTargetIds(routeState));

    // One extra uncleared danger outweighs any simple-grid detour; content order keeps equal routes stable.
    for (const candidate of dungeon.nodes) {
      if (!areAdjacentRouteNodes(currentNode, candidate)) continue;
      if (candidate.id !== targetNodeId && excludedNodeIds.has(candidate.id)) continue;
      const genesisLaw = state.run.lawState?.law.kind === 'genesis_vault'
        ? state.run.lawState.law
        : undefined;
      const expectedGenesisSpliceNodeId = genesisLaw
        ? DUNGEON_LAW_LANDMARKS.genesis_vault.spliceNodeIds[genesisLaw.spliceSequence.length]
        : undefined;
      if (
        genesisLaw &&
        DUNGEON_LAW_LANDMARKS.genesis_vault.spliceNodeIds.includes(candidate.id as never) &&
        candidate.id !== expectedGenesisSpliceNodeId
      ) {
        continue;
      }

      const gateStatus = getCurrentRouteGateStatus(routeState, candidate.id);
      if (gateStatus) {
        recordRouteGateEvidence(evidence, gateStatus);
        if (gateStatus.status === 'closed') closedGateIds.add(gateStatus.gate.id);
      }
      if (!legalTargetIds.has(candidate.id)) continue;

      const entersDanger =
        (candidate.type === 'monster' || candidate.type === 'trap') && !state.run.clearedNodeIds.includes(candidate.id);
      const nextCost = current.cost + 1 + (entersDanger ? dangerPenalty : 0);
      if (nextCost >= (bestCost.get(candidate.id) ?? Number.POSITIVE_INFINITY)) continue;

      const nextPath = [...current.path, candidate.id];
      if (candidate.id === targetNode.id) return recordDetour(nextPath);

      bestCost.set(candidate.id, nextCost);
      queue.push({ nodeId: candidate.id, path: nextPath, cost: nextCost });
    }
  }

  throw new Error(
    `No adjacent grid path from ${startNode.id} to ${targetNode.id} in ${state.run.dungeonId}; ` +
      `law=${JSON.stringify(state.run.lawState?.law ?? null)}.`
  );
}

function chooseCombatAction(
  state: GameState,
  prioritizeHealing = false,
  healingTargetRatio = 0.7,
  unavailableActions: ReadonlySet<CombatAction> = new Set()
): CombatAction {
  if (!state.combat) throw new Error('Cannot choose a simulation combat action without active combat.');

  const intent = getCurrentCombatIntent(state);
  if (!intent) throw new Error('Cannot choose a simulation combat action without a combat intent.');
  const weaponSkill = getWeaponSkillStatus(state);
  const monster = getCombatEncounterProfile(state)?.monster ?? MONSTERS[state.combat.monsterId];
  const stats = getDerivedStats(state);
  const echoPressure = monster.id === 'main_god_echo' ? Math.ceil(Math.max(stats.attack, stats.artPower) * 0.18) : 0;
  const estimatedIncomingDamage = Math.max(1, monster.attack - Math.floor(stats.defense * 0.6)) + echoPressure;
  const healingThreshold = Math.max(Math.floor(state.player.maxHp * 0.3), estimatedIncomingDamage * 2);
  const physicalDamage = Math.max(3, stats.attack - Math.floor(monster.defense * 0.6));
  const artAvailable = isCurrentDungeonFeatureAvailable(state, 'method');
  const consumablesAvailable = isCurrentDungeonFeatureAvailable(state, 'consumable');
  const artDamage = artAvailable ? Math.max(5, stats.artPower + 8 - Math.floor(monster.defense * 0.3)) : 0;
  const preferredBasicActions: CombatAction[] = artDamage > physicalDamage ? ['art', 'attack', 'guard'] : ['attack', 'art', 'guard'];
  const isAvailable = (action: CombatAction): boolean => {
    if (unavailableActions.has(action)) return false;
    if (action === 'art') return artAvailable;
    if (action === 'weapon_skill') return weaponSkill.available;
    if (action === 'use_healing_pill') return consumablesAvailable && state.inventory.healing_pill > 0;
    if (action === 'use_thunder_talisman') return consumablesAvailable && state.inventory.thunder_talisman > 0;
    return action === 'attack' || action === 'guard';
  };
  const isSafe = (action: CombatAction): boolean => !intent.dangerousActions.includes(action);
  const shouldHeal =
    state.player.hp <= healingThreshold ||
    (prioritizeHealing && state.player.hp <= Math.floor(state.player.maxHp * healingTargetRatio));
  const healingPercent = getCurrentDungeonLaw(state)?.modifiers.healingPercent ?? 0;
  const pillHealing = Math.max(0, Math.floor((36 * (100 + healingPercent)) / 100));
  const sustainableHealing = pillHealing > estimatedIncomingDamage;

  if (monster.id === 'main_god_echo') {
    const phaseTransitionBuffer = Math.max(4, Math.ceil(estimatedIncomingDamage * 0.2));
    if (
      state.player.hp <= estimatedIncomingDamage + phaseTransitionBuffer &&
      sustainableHealing &&
      isAvailable('use_healing_pill')
    ) {
      return 'use_healing_pill';
    }
    if (isAvailable('use_thunder_talisman')) return 'use_thunder_talisman';
    if (weaponSkill.available) return 'weapon_skill';

    return preferredBasicActions.find((action) => isAvailable(action)) ?? 'guard';
  }

  if (
    weaponSkill.currentFocus === weaponSkill.requiredFocus &&
    weaponSkill.available &&
    (isSafe('weapon_skill') || state.player.hp > estimatedIncomingDamage + 8)
  ) {
    return 'weapon_skill';
  }

  if (weaponSkill.currentFocus < weaponSkill.requiredFocus && intent.id !== 'regular-pursuit') {
    const chargingAction = intent.recommendedActions.find(
      (action) => action !== 'weapon_skill' && isAvailable(action) && isSafe(action)
    );
    const survivalReserve =
      weaponSkill.currentFocus === 0
        ? estimatedIncomingDamage * 3
        : weaponSkill.currentFocus === 1
          ? Math.ceil(estimatedIncomingDamage * 1.8)
          : estimatedIncomingDamage * 2;
    if (
      chargingAction &&
      shouldHeal &&
      sustainableHealing &&
      state.player.hp <= survivalReserve &&
      isAvailable('use_healing_pill')
    ) {
      return 'use_healing_pill';
    }
    if (chargingAction) return chargingAction;
  }

  if (
    shouldHeal &&
    sustainableHealing &&
    isAvailable('use_healing_pill') &&
    (isSafe('use_healing_pill') || state.player.hp <= estimatedIncomingDamage * 2)
  ) {
    return 'use_healing_pill';
  }

  const lethalAction = preferredBasicActions.find((action) => {
    if (!isAvailable(action) || !isSafe(action)) return false;
    const damage = action === 'art' ? artDamage : action === 'attack' ? physicalDamage : 0;
    return state.combat!.monsterHp <= damage;
  });
  if (lethalAction) return lethalAction;

  if (state.combat.bossPhase && state.player.hp <= estimatedIncomingDamage && isSafe('guard')) {
    return 'guard';
  }

  const safeBasicAction = preferredBasicActions.find((action) => isAvailable(action) && isSafe(action));
  if (safeBasicAction) return safeBasicAction;

  if (isAvailable('use_healing_pill') && isSafe('use_healing_pill')) {
    return 'use_healing_pill';
  }

  return 'guard';
}

function didCombatActionProgress(
  before: GameState,
  after: GameState,
  nodeId: string
): { progressed: boolean; beforeFocus: number; afterFocus: number } {
  const beforeFocus = getWeaponSkillStatus(before).currentFocus;
  const afterFocus = getWeaponSkillStatus(after).currentFocus;
  const combatEnded = after.phase !== 'combat' || !after.combat;
  const nodeCleared = after.run?.clearedNodeIds.includes(nodeId) ?? false;
  const turnOrHpProgress =
    after.combat?.turn !== before.combat?.turn ||
    after.combat?.monsterHp !== before.combat?.monsterHp ||
    after.player.hp !== before.player.hp;

  // Focus is captured as evidence, but a focus-only mutation never makes a no-op action count as progress.
  return { progressed: combatEnded || nodeCleared || turnOrHpProgress, beforeFocus, afterFocus };
}

function performTrackedCombatAction(
  state: GameState,
  nodeId: string,
  action: CombatAction,
  evidence?: RouteCombatEvidence
): { state: GameState; progressed: boolean } {
  const intentId = getCurrentCombatIntent(state)?.id ?? 'missing';
  const beforeTurn = state.combat?.turn ?? 0;
  const after = performCombatAction(state, action);
  const progress = didCombatActionProgress(state, after, nodeId);
  const combatEnded = after.phase !== 'combat' || !after.combat;
  const nodeCleared = after.run?.clearedNodeIds.includes(nodeId) ?? false;
  const skillSpent =
    action === 'weapon_skill' &&
    progress.beforeFocus === 3 &&
    (nodeCleared || (!combatEnded && progress.afterFocus === 0));
  const trace: CombatFocusTrace = {
    nodeId,
    action,
    intentId,
    beforeFocus: progress.beforeFocus,
    afterFocus: progress.afterFocus,
    beforeTurn,
    afterTurn: after.combat?.turn ?? beforeTurn,
    progressed: progress.progressed,
    combatEnded,
    skillSpent
  };

  evidence?.focusTrace.push(trace);
  evidence?.combatActions?.push({ ...trace });
  if (skillSpent) evidence?.usedWeaponSkillNodeIds.push(nodeId);

  return { state: after, progressed: progress.progressed };
}

function recordDungeonLawStatus(
  state: GameState,
  evidence: RouteCombatEvidence,
  checkpoint: string
): void {
  const currentLaw = getCurrentDungeonLaw(state);
  if (!currentLaw || !state.run) return;

  evidence.lawStatuses?.push({
    checkpoint,
    nodeId: state.run.currentNodeId,
    status: currentLaw.display.status,
    targetReached: currentLaw.display.targetReached,
    law: structuredClone(currentLaw.state.law),
    modifiers: structuredClone(currentLaw.modifiers)
  });
  recordRouteSectorSnapshot(state, evidence, checkpoint);
}

function getDangerResolutionError(state: GameState, nodeId: string, detail: string): BalanceSimulationError {
  const dungeonId = state.run?.dungeonId ?? 'unknown dungeon';
  const pendingOffer = state.run?.pendingEquipmentOffer;
  const pendingOfferStatus = pendingOffer
    ? `${pendingOffer.offerId}[${pendingOffer.equipmentIds.join(',')}]`
    : 'none';
  const combatStatus = state.combat
    ? `monsterHp=${state.combat.monsterHp}, turn=${state.combat.turn}`
    : `phase=${state.phase}, outcome=${state.lastOutcome ?? 'none'}`;

  return new BalanceSimulationError(
    `Balance simulation failed in ${dungeonId} at ${nodeId}: ${detail} ` +
      `(playerHp=${state.player.hp}/${state.player.maxHp}, ${combatStatus}, pendingEquipmentOffer=${pendingOfferStatus}).`
  );
}

function resolvePendingEquipmentOffer(state: GameState, nodeId: string): GameState {
  const offer = state.run?.pendingEquipmentOffer;
  if (!offer) return state;

  // Always take the first candidate so repeated balance runs make the same real API choice.
  const equipmentId = offer.equipmentIds[0];
  if (!equipmentId) {
    throw getDangerResolutionError(state, nodeId, `pending equipment offer ${offer.offerId} has no candidates`);
  }

  const resolved = resolveEquipmentLoot(state, equipmentId);
  if (resolved.run?.pendingEquipmentOffer || !resolved.run?.lootBag.equipmentIds.includes(equipmentId)) {
    throw getDangerResolutionError(
      resolved,
      nodeId,
      `failed to select ${equipmentId} from pending equipment offer ${offer.offerId}`
    );
  }

  return resolved;
}

function resolvePendingRunRelicDraft(
  state: GameState,
  nodeId: string,
  evidence?: RouteCombatEvidence
): GameState {
  const run = state.run;
  const pendingDraft = run?.relicState?.pendingDraft;
  if (!run || !pendingDraft) return state;

  // Existing campaign traces assume combat starts at zero focus; reserve focus_prism for the
  // dedicated relic route while keeping every ordinary route choice deterministic.
  const chosenRelicId = evidence?.chooseRunRelic?.(state, pendingDraft.candidateIds) ??
    pendingDraft.candidateIds.find((relicId) => relicId !== 'focus_prism') ??
    pendingDraft.candidateIds[0];
  if (!chosenRelicId || !pendingDraft.candidateIds.includes(chosenRelicId)) {
    throw getDangerResolutionError(
      state,
      nodeId,
      `deterministic relic choice was not a candidate for ${pendingDraft.draftId}`
    );
  }

  const dungeonId = run.dungeonId;
  const effectsBefore = structuredClone(getCurrentRunRelicEffects(state));
  const powerBefore = getPlayerPower(state);
  const readinessBefore = getDungeonReadiness(state, dungeonId);
  const conduitSourceEquipmentIds = [...(run.relicConduitSourceEquipmentIds ?? [])];
  const resolved = resolveRunRelicDraft(state, pendingDraft.draftId, chosenRelicId);
  const resolvedRelicState = resolved.run?.relicState;

  if (
    resolvedRelicState?.pendingDraft ||
    !resolvedRelicState?.processedDraftIds.includes(pendingDraft.draftId) ||
    !resolvedRelicState.acquiredIds.includes(chosenRelicId)
  ) {
    throw getDangerResolutionError(
      resolved,
      nodeId,
      `failed to select ${chosenRelicId} from pending relic draft ${pendingDraft.draftId}`
    );
  }

  evidence?.relicDraftTrace.push({
    dungeonId,
    nodeId,
    relicDraftId: pendingDraft.draftId,
    frame: resolvedRelicState.frame,
    candidateIds: [...pendingDraft.candidateIds],
    candidateCount: pendingDraft.candidateIds.length,
    conduitSourceEquipmentIds,
    conduitSourceLevels: Object.fromEntries(
      conduitSourceEquipmentIds.map((equipmentId) => [equipmentId, state.equipmentLevels[equipmentId] ?? 1])
    ),
    chosenRelicId,
    effectsBefore,
    effectsAfter: structuredClone(getCurrentRunRelicEffects(resolved)),
    powerBefore,
    powerAfter: getPlayerPower(resolved),
    readinessBefore,
    readinessAfter: getDungeonReadiness(resolved, dungeonId)
  });

  return resolved;
}

function resolvePendingRunRelicArchive(state: GameState, preferredRelicId?: RunRelicId): GameState {
  if (state.run?.lastRelicSettlement?.status !== 'pending') return state;

  const acquiredRelicIds = state.run.relicState?.acquiredIds ?? [];
  const relicId = preferredRelicId && acquiredRelicIds.includes(preferredRelicId)
    ? preferredRelicId
    : acquiredRelicIds[0];
  const resolved = resolveRunRelicArchive(state, relicId);
  if (resolved.run?.lastRelicSettlement?.status === 'pending') {
    throw getDangerResolutionError(
      resolved,
      resolved.run.currentNodeId,
      `failed to settle relic archive${relicId ? ` for ${relicId}` : ''}`
    );
  }

  return resolved;
}

function assertBossSealCleared(state: GameState, dungeonId: DungeonId, checkpoint: string): void {
  const definition = getBossDefinition(dungeonId);
  const seal = getBossSealStatus(state, dungeonId);
  const bossNodeCleared = state.run?.clearedNodeIds.includes(definition.nodeId) ?? false;
  if (bossNodeCleared && seal?.cleared) return;

  const clearedNodeIds = state.run?.clearedNodeIds.join(',') || 'none';
  const pendingOffer = state.run?.pendingEquipmentOffer?.offerId ?? 'none';
  throw new BalanceSimulationError(
    `Balance simulation failed in ${dungeonId}: boss seal remains locked ${checkpoint}. ` +
      `Configured boss ${definition.bossTitle} must be cleared at ${definition.nodeId}; ` +
      `${seal?.requirementText ?? 'boss seal status unavailable'} ` +
      `(currentNode=${state.run?.currentNodeId ?? 'none'}, clearedNodeIds=${clearedNodeIds}, ` +
      `pendingEquipmentOffer=${pendingOffer}).`
  );
}

function resolvePendingCausalLedger(
  state: GameState,
  choice: 'balance' | 'overdraw' | 'repay'
): GameState {
  const causalLedger = getCurrentCausalLedgerStatus(state);
  if (!causalLedger?.pending) return state;

  const resolved = resolveCausalLedger(state, choice);
  const nextStatus = getCurrentCausalLedgerStatus(resolved);
  if (nextStatus?.pending) {
    throw getDangerResolutionError(
      resolved,
      state.run?.currentNodeId ?? 'unknown',
      `causal ledger choice ${choice} did not settle the pending ledger`
    );
  }
  return resolved;
}

function resolvePendingEntropyHeadingForTarget(
  state: GameState,
  targetNodeId: string,
  evidence?: RouteCombatEvidence,
  excludedNodeIds: ReadonlySet<string> = new Set()
): GameState {
  const status = getCurrentEntropyHeadingStatus(state);
  if (!status?.pending) return state;
  const pendingNodeId = status.pendingHeadingNodeId;
  if (!pendingNodeId || state.run?.currentNodeId !== pendingNodeId) {
    throw getDangerResolutionError(
      state,
      state.run?.currentNodeId ?? targetNodeId,
      `pending entropy heading ${pendingNodeId ?? 'missing'} is not owned by the current node`
    );
  }

  const candidates = (['steady', 'rush'] as const).flatMap((choice) => {
    if (!status.choices[choice].available) return [];
    const resolved = resolveEntropyHeading(state, choice);
    const nextStatus = getCurrentEntropyHeadingStatus(resolved);
    if (
      !nextStatus ||
      nextStatus.pending ||
      nextStatus.resolvedHeadingChoices[pendingNodeId] !== choice
    ) {
      return [];
    }
    try {
      const path = resolved.run?.currentNodeId === targetNodeId
        ? []
        : findAdjacentRoutePath(resolved, targetNodeId, undefined, excludedNodeIds);
      return [{ choice, entropy: nextStatus.entropy, pathLength: path.length }];
    } catch {
      return [];
    }
  });
  candidates.sort(
    (left, right) =>
      left.pathLength - right.pathLength ||
      Math.abs(left.entropy - 2) - Math.abs(right.entropy - 2) ||
      Number(left.choice === 'rush') - Number(right.choice === 'rush')
  );
  const selected = candidates[0];
  if (!selected) {
    throw getDangerResolutionError(
      state,
      pendingNodeId,
      `no available heading choice can reach ${targetNodeId}; entropy=${status.entropy}`
    );
  }

  const resolved = resolveEntropyHeading(state, selected.choice);
  const nextStatus = getCurrentEntropyHeadingStatus(resolved);
  if (
    !nextStatus ||
    nextStatus.pending ||
    nextStatus.resolvedHeadingChoices[pendingNodeId] !== selected.choice
  ) {
    throw getDangerResolutionError(
      resolved,
      pendingNodeId,
      `heading choice ${selected.choice} did not resolve pending state`
    );
  }
  evidence?.headingChoiceTrace.push({
    nodeId: pendingNodeId,
    targetNodeId,
    choice: selected.choice,
    entropyBefore: status.entropy,
    entropyAfter: nextStatus.entropy,
    candidatePathLength: selected.pathLength,
    resolvedHeadingChoices: { ...nextStatus.resolvedHeadingChoices },
    bossEntropyLocked: nextStatus.bossEntropyLocked,
    collapseLayers: nextStatus.collapseLayers
  });
  return resolved;
}

function getPreferredMirrorCityPhase(targetNodeId: string): MirrorCityPhase | undefined {
  if (targetNodeId === 'real_anchor' || targetNodeId === 'real_relic_gallery') return 'real';
  if (targetNodeId === 'mirror_anchor' || targetNodeId === 'mirror_relic_gallery') return 'mirror';
  return undefined;
}

function resolvePendingMirrorCityPhaseForTarget(
  state: GameState,
  targetNodeId: string,
  evidence?: RouteCombatEvidence,
  excludedNodeIds: ReadonlySet<string> = new Set()
): GameState {
  const status = getCurrentMirrorCityPhaseStatus(state);
  if (!status?.pending) return state;
  const pendingNodeId = status.pendingPhaseNodeId;
  if (!pendingNodeId || state.run?.currentNodeId !== pendingNodeId) {
    throw getDangerResolutionError(
      state,
      state.run?.currentNodeId ?? targetNodeId,
      `pending mirror phase ${pendingNodeId ?? 'missing'} is not owned by the current node`
    );
  }

  const preferredPhase = getPreferredMirrorCityPhase(targetNodeId);
  const candidates = (['real', 'mirror'] as const).flatMap((phase) => {
    const choice = status.choices[phase];
    if (!choice.available) return [];
    const resolved = resolveMirrorCityPhase(state, phase);
    const nextStatus = getCurrentMirrorCityPhaseStatus(resolved);
    if (!nextStatus || nextStatus.pending || nextStatus.resolvedPhaseChoices[pendingNodeId] !== phase) {
      return [];
    }
    try {
      const path = resolved.run?.currentNodeId === targetNodeId
        ? []
        : findAdjacentRoutePath(resolved, targetNodeId, undefined, excludedNodeIds);
      return [{ phase, choice, resolved, nextStatus, pathLength: path.length }];
    } catch {
      return [];
    }
  });
  candidates.sort(
    (left, right) =>
      Number(right.phase === preferredPhase) - Number(left.phase === preferredPhase) ||
      left.pathLength - right.pathLength ||
      Number(left.choice.phaseChanged) - Number(right.choice.phaseChanged) ||
      Number(left.phase === 'mirror') - Number(right.phase === 'mirror')
  );
  const selected = candidates[0];
  if (!selected) {
    throw getDangerResolutionError(
      state,
      pendingNodeId,
      `no available mirror phase can reach ${targetNodeId}; currentPhase=${status.currentPhase}`
    );
  }

  evidence?.mirrorPhaseChoiceTrace.push({
    nodeId: pendingNodeId,
    targetNodeId,
    phase: selected.phase,
    phaseBefore: status.currentPhase,
    phaseAfter: selected.nextStatus.currentPhase,
    phaseChanged: selected.choice.phaseChanged,
    damagePercent: selected.choice.damagePercent,
    hpBefore: state.player.hp,
    hpAfter: selected.resolved.player.hp,
    candidatePathLength: selected.pathLength,
    resolvedPhaseChoices: { ...selected.nextStatus.resolvedPhaseChoices },
    anchors: { ...selected.nextStatus.anchors }
  });
  return selected.resolved;
}

function resolveCurrentDanger(
  state: GameState,
  evidence?: RouteCombatEvidence,
  causalLedgerChoice: 'balance' | 'overdraw' | 'repay' = 'balance'
): GameState {
  if (!state.run) return state;
  if (getCurrentCausalLedgerStatus(state)?.pending) {
    return resolvePendingCausalLedger(state, causalLedgerChoice);
  }

  const node = DUNGEONS[state.run.dungeonId].nodes.find((candidate) => candidate.id === state.run?.currentNodeId);
  if (!node) return state;
  if (state.run.clearedNodeIds.includes(node.id)) {
    return evidence?.autoResolveEquipmentOffers === false
      ? state
      : resolvePendingEquipmentOffer(state, node.id);
  }

  if (node.type === 'trap') {
    const counterItem = node.trap?.counterItem;
    const inventoryBefore = counterItem ? state.inventory[counterItem] : 0;
    const carried = Boolean(
      counterItem &&
        (!isTacticalItemId(counterItem) || state.run.tacticalLoadout?.itemIds.includes(counterItem))
    );
    const counterAvailable = Boolean(
      counterItem &&
        inventoryBefore > 0 &&
        (!isTacticalItemId(counterItem) || isTacticalItemAvailable(state, counterItem))
    );
    const choice: 'counter' | 'risk' = counterAvailable ? 'counter' : 'risk';
    const handled = handleTrap(selectNode(state, node.id), choice);
    evidence?.trapChoiceTrace.push({
      dungeonId: state.run.dungeonId,
      nodeId: node.id,
      counterItem,
      choice,
      carried,
      inventoryBefore,
      inventoryAfter: counterItem ? handled.inventory[counterItem] : 0,
      hpBefore: state.player.hp,
      hpAfter: handled.player.hp,
      damage: Math.max(0, state.player.hp - handled.player.hp),
      cleared: handled.run?.clearedNodeIds.includes(node.id) ?? false
    });
    if (handled.player.hp <= 0) {
      throw getDangerResolutionError(
        handled,
        node.id,
        `trap damage reduced the player to zero health; choice=${choice}, ` +
          `counter=${counterItem ?? 'none'}, carried=${carried}, inventoryBefore=${inventoryBefore}`
      );
    }
    if (!handled.run?.clearedNodeIds.includes(node.id)) {
      throw getDangerResolutionError(handled, node.id, 'handleTrap did not clear the current trap');
    }
    return resolvePendingCausalLedger(handled, causalLedgerChoice);
  }

  if (node.type !== 'monster') return state;

  let nextState = selectNode(state, node.id);
  if (nextState.phase !== 'combat' || nextState.combat?.nodeId !== node.id) {
    throw getDangerResolutionError(nextState, node.id, 'selectNode did not start combat for the current monster');
  }

  if (evidence) recordDungeonLawStatus(nextState, evidence, `combat:${node.id}`);
  const encounterProfile = getCombatEncounterProfile(nextState)?.monster;
  if (encounterProfile) {
    evidence?.combatProfiles?.push({
      nodeId: node.id,
      monsterId: encounterProfile.id,
      maxHp: encounterProfile.maxHp,
      attack: encounterProfile.attack,
      artPower: encounterProfile.artPower,
      defense: encounterProfile.defense
    });
  }
  nextState = useAvailableCombatSupports(nextState, node.id, evidence);

  const combatStartStats = getDerivedStats(nextState);
  const combatStart =
    `startHp=${nextState.player.hp}, power=${getPlayerPower(nextState)}, defense=${combatStartStats.defense}, ` +
    `pills=${nextState.inventory.healing_pill}, patches=${nextState.inventory.armor_patch}, ` +
    `talismans=${nextState.inventory.thunder_talisman}, ` +
    `method=${nextState.run?.methodSnapshot?.methodId ?? 'none'}@${nextState.run?.methodSnapshot?.rank ?? 0}, ` +
    `companion=${nextState.run?.companionSnapshot?.companionId ?? 'none'}@${nextState.run?.companionSnapshot?.rank ?? 0}, ` +
    `souls=${nextState.run?.soulSkillState?.frozenSkillIds.join(',') || 'none'}`;
  const actionTrace: string[] = [];
  const unavailableActions = new Set<CombatAction>();
  if (evidence?.reserveThunderTalismanForNodeId && evidence.reserveThunderTalismanForNodeId !== node.id) {
    unavailableActions.add('use_thunder_talisman');
  }
  if (evidence?.reserveWeaponSkillForNodeId && evidence.reserveWeaponSkillForNodeId !== node.id) {
    unavailableActions.add('weapon_skill');
  }
  for (let actionCount = 1; actionCount <= MAX_COMBAT_ACTIONS; actionCount += 1) {
    nextState = useAvailableCombatSupports(nextState, node.id, evidence);
    const soulSkipReady =
      (state.run.dungeonId === 'genesis_vault' && nextState.combat?.bossPhase === 'awakened') ||
      (
        evidence?.soulSkipNodeId === node.id &&
        (
          node.id !== 'false_testimony_judge' ||
          (
            nextState.combat?.bossPhase === 'awakened' &&
            ((nextState.combat?.turn ?? 1) - 1) % 3 === 2
          )
        )
      );
    if (soulSkipReady && getEquipmentSoulSkillActionStatus(nextState, 'gauntlet_breakbeat').available) {
      nextState = useEquipmentSoulSkill(nextState, 'gauntlet_breakbeat');
    }
    const genesisAction = state.run.dungeonId === 'genesis_vault'
      ? node.monsterId === 'gene_stalker'
        ? actionCount === 1 && isTacticalItemAvailable(nextState, 'thunder_talisman')
          ? 'use_thunder_talisman'
          : (['attack', 'art', 'guard'] as const)[(actionCount - 2 + 3) % 3]
        : node.monsterId === 'mutation_guardian'
          ? (actionCount % 2 === 1 ? 'art' : 'guard')
        : node.id === 'primal_curator'
            ? (['art', 'guard', 'weapon_skill', 'guard'] as const)[(actionCount - 1) % 4]
            : undefined
      : undefined;
    const scriptedAction = evidence?.scriptedActions?.[node.id]?.[actionCount - 1];
    let action =
      node.id === 'false_testimony_judge' && scriptedAction
        ? ((nextState.combat?.turn ?? 1) - 1) % 3 === 2
          ? 'guard'
          : getWeaponSkillStatus(nextState).available
            ? 'weapon_skill'
            : 'art'
        : scriptedAction ?? genesisAction ??
          chooseCombatAction(nextState, evidence?.prioritizeHealing, evidence?.healingTargetRatio, unavailableActions);
    if (action === 'weapon_skill' && !getWeaponSkillStatus(nextState).available) {
      action = chooseCombatAction(nextState, evidence?.prioritizeHealing, evidence?.healingTargetRatio, unavailableActions);
    }
    const beforePlayerHp = nextState.player.hp;
    const beforeMonsterHp = nextState.combat?.monsterHp ?? 0;
    const beforeAction = nextState;
    let actionResult = performTrackedCombatAction(beforeAction, node.id, action, evidence);
    nextState = actionResult.state;
    let progressed = actionResult.progressed;

    // A newly sealed ability can make an otherwise valid-looking action a no-op. Keep the
    // simulation on real APIs, but recover with an always-available basic combat action.
    if (!progressed) {
      actionTrace.push(`${action}:blocked`);
      action = action === 'attack' ? 'guard' : 'attack';
      const beforeFallback = nextState;
      actionResult = performTrackedCombatAction(beforeFallback, node.id, action, evidence);
      nextState = actionResult.state;
      progressed = actionResult.progressed;
    }
    actionTrace.push(`${action}:${beforePlayerHp}->${nextState.player.hp}/${beforeMonsterHp}->${nextState.combat?.monsterHp ?? 0}`);

    if (nextState.run?.clearedNodeIds.includes(node.id)) {
      const offered = evidence?.autoResolveEquipmentOffers === false
        ? nextState
        : resolvePendingEquipmentOffer(nextState, node.id);
      return resolvePendingCausalLedger(offered, causalLedgerChoice);
    }
    if (nextState.player.hp <= 0 || nextState.phase !== 'combat' || !nextState.combat) {
      throw getDangerResolutionError(
        nextState,
        node.id,
        `combat ended without victory after ${actionCount} actions; ${combatStart}; trace=${actionTrace.join(',')}`
      );
    }
  }

  throw getDangerResolutionError(
    nextState,
    node.id,
    `combat exceeded ${MAX_COMBAT_ACTIONS} actions; ${combatStart}; trace=${actionTrace.join(',')}`
  );
}

function useAvailableCombatSupports(
  state: GameState,
  nodeId: string,
  evidence?: RouteCombatEvidence
): GameState {
  const useGenesisSupports = state.run?.dungeonId === 'genesis_vault';
  let nextState = state;
  if (
    (useGenesisSupports || evidence?.useAllCombatSupports || evidence?.methodTechniqueNodeId === nodeId) &&
    !(
      evidence?.deferMethodTechniqueNodeId === nodeId &&
      nextState.player.hp > Math.floor(nextState.player.maxHp * 0.3)
    ) &&
    getCurrentMethodTechniqueStatus(nextState).available
  ) {
    nextState = useMethodTechnique(nextState);
  }
  if (
    (
      useGenesisSupports ||
      evidence?.useAllCombatSupports ||
      evidence?.companionAssistNodeId === nodeId
    ) &&
    !(
      evidence?.deferCompanionAssistNodeId === nodeId &&
      (nextState.combat?.turn ?? 1) <= 1
    )
  ) {
    const companionStatus = getCurrentCompanionAssistStatus(nextState);
    const healingThreshold = Math.floor(
      nextState.player.maxHp * (1 - companionStatus.effect.healPercent / 100)
    );
    if (
      companionStatus.available &&
      (companionStatus.effect.healPercent === 0 || nextState.player.hp <= healingThreshold)
    ) {
      nextState = useCompanionAssist(nextState);
    }
  }
  if (
    (useGenesisSupports || evidence?.useAllCombatSupports || evidence?.bloodlineSurgeNodeId === nodeId) &&
    getCurrentBloodlineSurgeStatus(nextState).available
  ) {
    nextState = useBloodlineSurge(nextState);
  }
  return nextState;
}

function useTrackedPortal(state: GameState, nodeId: string, evidence: RouteCombatEvidence): GameState {
  if (!state.run) throw new BalanceSimulationError(`Cannot use portal ${nodeId} without an active run.`);
  const node = DUNGEONS[state.run.dungeonId].nodes.find((candidate) => candidate.id === nodeId);
  if (!node?.portal) throw getDangerResolutionError(state, nodeId, 'planned portal node has no portal definition');

  const sourceDungeonId = state.run.dungeonId;
  const stableItem = node.portal.stableItem;
  const inventoryBefore = stableItem ? state.inventory[stableItem] : 0;
  const canStabilize = Boolean(
    stableItem &&
      inventoryBefore > 0 &&
      (!isTacticalItemId(stableItem) || isTacticalItemAvailable(state, stableItem))
  );
  const choice: 'stabilize' | 'force' = canStabilize ? 'stabilize' : 'force';
  const selected = selectNode(state, nodeId);
  const used = usePortal(selected, choice);
  evidence.portalChoiceTrace.push({
    sourceDungeonId,
    nodeId,
    stableItem,
    choice,
    inventoryBefore,
    inventoryAfter: stableItem ? used.inventory[stableItem] : 0,
    hpBefore: state.player.hp,
    hpAfter: used.player.hp,
    damage: Math.max(0, state.player.hp - used.player.hp),
    targetDungeonId: used.run?.dungeonId
  });
  if (used.run?.dungeonId !== node.portal.targetDungeonId) {
    throw getDangerResolutionError(used, nodeId, `portal did not reach ${node.portal.targetDungeonId}`);
  }
  return used;
}

function collectCurrentRouteReward(state: GameState, evidence?: RouteCombatEvidence): GameState {
  if (!state.run) return state;

  const node = DUNGEONS[state.run.dungeonId].nodes.find((candidate) => candidate.id === state.run?.currentNodeId);
  if (node?.type !== 'reward' || state.run.clearedNodeIds.includes(node.id)) return state;

  const dungeonId = state.run.dungeonId;
  const rewardPointsBefore = state.run.lootBag.rewardPoints;
  const effects = structuredClone(getCurrentRunRelicEffects(state));
  const collected = collectReward(state);
  evidence?.relicRewardTrace.push({
    dungeonId,
    nodeId: node.id,
    baseRewardPoints: node.reward?.rewardPoints ?? 0,
    rewardPointsGained: (collected.run?.lootBag.rewardPoints ?? rewardPointsBefore) - rewardPointsBefore,
    hpBefore: state.player.hp,
    hpAfter: collected.player.hp,
    effects
  });

  return resolvePendingRunRelicDraft(collected, node.id, evidence);
}

type RouteMovementOptions = {
  excludedNodeIds?: ReadonlySet<string>;
  collectTargetReward?: boolean;
  resolveTargetDanger?: boolean;
  causalLedgerChoice?: 'balance' | 'overdraw' | 'repay';
  redactionClauseChoices?: Readonly<Partial<Record<RedactionClauseNodeId, RedactionChoice>>>;
  auctionLotChoices?: Readonly<Partial<Record<AuctionLotNodeId, AuctionLotChoice>>>;
  genesisSpliceSequence?: readonly GenesisGene[];
  broadcastRelayChoices?: Readonly<Partial<Record<BroadcastRelayNodeId, BroadcastRelayChoice>>>;
  escortCheckpointChoices?: Readonly<Partial<Record<EscortCheckpointNodeId, EscortCheckpointChoice>>>;
  falseTestimonySuspect?: FalseTestimonySuspect;
  resolveFalseTestimonyAppeal?: boolean;
  skipRedactionPreparation?: boolean;
  skipAuctionPreparation?: boolean;
  skipGenesisPreparation?: boolean;
  skipBroadcastPreparation?: boolean;
  skipFalseTestimonyPreparation?: boolean;
  skipPanopticonPreparation?: boolean;
  panopticonRoute?: PanopticonRoute;
};

const STANDARD_REDACTION_CLAUSE_CHOICES = {
  body_clause_desk: 'certify',
  memory_clause_desk: 'certify',
  return_clause_desk: 'redact'
} as const satisfies Readonly<Record<RedactionClauseNodeId, RedactionChoice>>;

const STANDARD_AUCTION_LOT_CHOICES = {
  force_lot_dais: 'bid',
  guard_lot_dais: 'burn',
  art_lot_dais: 'fold',
  return_lot_dais: 'bid'
} as const satisfies Readonly<Record<AuctionLotNodeId, AuctionLotChoice>>;

const CAMPAIGN_AUCTION_LOT_CHOICES = {
  force_lot_dais: 'burn',
  guard_lot_dais: 'bid',
  art_lot_dais: 'bid',
  return_lot_dais: 'fold'
} as const satisfies Readonly<Record<AuctionLotNodeId, AuctionLotChoice>>;

const STANDARD_GENESIS_SPLICE_SEQUENCE = ['force', 'art', 'renewal'] as const satisfies readonly GenesisGene[];

const STANDARD_BROADCAST_RELAY_CHOICES = {
  south_relay_console: 'mute',
  north_relay_console: 'broadcast',
  central_relay_console: 'mute'
} as const satisfies Readonly<Record<BroadcastRelayNodeId, BroadcastRelayChoice>>;

const REPEAT_BROADCAST_RELAY_CHOICES = {
  south_relay_console: 'mute',
  north_relay_console: 'mute',
  central_relay_console: 'mute'
} as const satisfies Readonly<Record<BroadcastRelayNodeId, BroadcastRelayChoice>>;

const STANDARD_ESCORT_CHECKPOINT_CHOICES = {
  north_checkpoint: 'treat',
  central_checkpoint: 'push',
  south_checkpoint: 'push'
} as const satisfies Readonly<Record<EscortCheckpointNodeId, EscortCheckpointChoice>>;

function resolvePendingRedactionClause(
  state: GameState,
  choices: Readonly<Partial<Record<RedactionClauseNodeId, RedactionChoice>>> = STANDARD_REDACTION_CLAUSE_CHOICES
): GameState {
  const pending = getCurrentRedactionClauseStatus(state)?.pendingClauseNodeId;
  return pending ? resolveRedactionClause(state, choices[pending] ?? STANDARD_REDACTION_CLAUSE_CHOICES[pending]) : state;
}

function resolvePendingAuctionLot(
  state: GameState,
  evidence?: RouteCombatEvidence,
  choices: Readonly<Partial<Record<AuctionLotNodeId, AuctionLotChoice>>> = STANDARD_AUCTION_LOT_CHOICES
): GameState {
  const status = getCurrentAuctionLotStatus(state);
  const nodeId = status?.pendingLotNodeId;
  if (!nodeId) return state;

  const choice = choices[nodeId] ?? STANDARD_AUCTION_LOT_CHOICES[nodeId];
  const scripBefore = state.run?.lootBag.items.legacy_scrip ?? 0;
  const choiceStatus = status.choices[choice];
  const resolved = resolveAuctionLot(state, choice);
  const resolvedStatus = getCurrentAuctionLotStatus(resolved);
  const scripAfter = resolved.run?.lootBag.items.legacy_scrip ?? 0;
  if (
    !choiceStatus.available ||
    resolvedStatus?.resolvedLotChoices[nodeId] !== choice ||
    scripBefore - scripAfter !== choiceStatus.scripCost
  ) {
    throw getDangerResolutionError(
      resolved,
      nodeId,
      `auction lot ${choice} did not resolve with exact run-loot consumption`
    );
  }
  evidence?.auctionLotChoiceTrace.push({
    nodeId,
    choice,
    scripBefore,
    scripCost: choiceStatus.scripCost,
    scripAfter,
    resolvedLotChoices: { ...resolvedStatus.resolvedLotChoices }
  });
  return resolved;
}

function resolvePendingGenesisSplice(
  state: GameState,
  evidence?: RouteCombatEvidence,
  sequence: readonly GenesisGene[] = STANDARD_GENESIS_SPLICE_SEQUENCE
): GameState {
  const status = getCurrentGenesisSpliceStatus(state);
  const nodeId = status?.pendingSpliceNodeId;
  if (!nodeId) return state;

  const gene = sequence[status.spliceSequence.length];
  if (!gene) {
    throw getDangerResolutionError(state, nodeId, 'genesis splice sequence has no choice for the pending console');
  }
  const choice = status.choices[gene];
  const serumBefore = state.inventory.genesis_serum;
  const runSerumBefore = state.run?.lootBag.items.genesis_serum ?? 0;
  const resolved = resolveGenesisSplice(state, gene);
  const resolvedStatus = getCurrentGenesisSpliceStatus(resolved);
  const serumAfter = resolved.inventory.genesis_serum;
  const runSerumAfter = resolved.run?.lootBag.items.genesis_serum ?? 0;
  if (
    !choice.available ||
    resolvedStatus?.spliceSequence.at(-1) !== gene ||
    serumBefore - serumAfter !== choice.serumCost ||
    runSerumBefore - runSerumAfter !== choice.serumCost
  ) {
    throw getDangerResolutionError(
      resolved,
      nodeId,
      `genesis splice ${gene} did not consume the exact current-run serum quote`
    );
  }
  evidence?.genesisSpliceChoiceTrace.push({
    nodeId,
    gene,
    serumBefore,
    runSerumBefore,
    serumCost: choice.serumCost,
    serumAfter,
    runSerumAfter,
    spliceSequence: [...resolvedStatus.spliceSequence]
  });
  return resolved;
}

function resolvePendingBroadcastRelay(
  state: GameState,
  evidence?: RouteCombatEvidence,
  choices: Readonly<Partial<Record<BroadcastRelayNodeId, BroadcastRelayChoice>>> = STANDARD_BROADCAST_RELAY_CHOICES
): GameState {
  const status = getCurrentBroadcastRelayStatus(state);
  const nodeId = status?.pendingRelayNodeId;
  if (!nodeId) return state;

  const choice = choices[nodeId] ?? STANDARD_BROADCAST_RELAY_CHOICES[nodeId];
  const choiceStatus = status.choices[choice];
  const resolved = resolveCurrentBroadcastRelay(state, choice);
  const resolvedStatus = getCurrentBroadcastRelayStatus(resolved);
  if (
    !choiceStatus.available ||
    resolvedStatus?.resolvedRelayChoices[nodeId] !== choice ||
    resolvedStatus.noise !== status.noise + choiceStatus.noiseDelta
  ) {
    throw getDangerResolutionError(
      resolved,
      nodeId,
      `broadcast relay ${choice} did not resolve through the public game API`
    );
  }
  evidence?.broadcastRelayChoiceTrace.push({
    nodeId,
    choice,
    noiseBefore: status.noise,
    noiseDelta: choiceStatus.noiseDelta,
    noiseAfter: resolvedStatus.noise,
    bonusRewardPoints: choiceStatus.bonusRewardPoints,
    resolvedRelayChoices: { ...resolvedStatus.resolvedRelayChoices }
  });
  return resolved;
}

function resolvePendingEscortCheckpoint(
  state: GameState,
  evidence?: RouteCombatEvidence,
  choices: Readonly<Partial<Record<EscortCheckpointNodeId, EscortCheckpointChoice>>> =
    STANDARD_ESCORT_CHECKPOINT_CHOICES
): GameState {
  const status = getCurrentEscortCheckpointStatus(state);
  const nodeId = status?.pendingCheckpointNodeId;
  if (!nodeId) return state;

  const preferredChoice = choices[nodeId] ?? STANDARD_ESCORT_CHECKPOINT_CHOICES[nodeId];
  const choice = status.choices[preferredChoice].available
    ? preferredChoice
    : preferredChoice === 'treat' && status.choices.push.available
      ? 'push'
      : preferredChoice;
  const choiceStatus = status.choices[choice];
  if (!choiceStatus.available) {
    throw getDangerResolutionError(
      state,
      nodeId,
      `escort checkpoint ${choice} is unavailable: ${choiceStatus.unavailableReason ?? 'unknown'}`
    );
  }

  const inventoryPillsBefore = state.inventory.healing_pill;
  const runPillsBefore = state.run?.lootBag.items.healing_pill ?? 0;
  const resolved = resolveCurrentEscortCheckpoint(state, choice);
  const resolvedStatus = getCurrentEscortCheckpointStatus(resolved);
  const inventoryPillsAfter = resolved.inventory.healing_pill;
  const runPillsAfter = resolved.run?.lootBag.items.healing_pill ?? 0;
  if (
    resolvedStatus?.resolvedCheckpointChoices[nodeId] !== choice ||
    status.survivorHp + choiceStatus.survivorHpDelta !== resolvedStatus.survivorHp ||
    inventoryPillsBefore - inventoryPillsAfter !== choiceStatus.healingPillCost ||
    runPillsBefore - runPillsAfter !== choiceStatus.healingPillCost
  ) {
    throw getDangerResolutionError(resolved, nodeId, `escort checkpoint ${choice} did not resolve exactly`);
  }

  evidence?.escortCheckpointChoiceTrace.push({
    nodeId,
    choice,
    survivorHpBefore: status.survivorHp,
    survivorHpAfter: resolvedStatus.survivorHp,
    inventoryPillsBefore,
    inventoryPillsAfter,
    runPillsBefore,
    runPillsAfter,
    healingPillCost: choiceStatus.healingPillCost,
    bonusRewardPoints: choiceStatus.bonusRewardPoints,
    entryGear: { ...status.entryGear },
    entryCompanion: { ...status.entryCompanion },
    companionRole: status.companionRole
  });
  return resolved;
}

type FalseTestimonyGameApi = Readonly<{
  getCurrentVerdictStatus: (state: GameState) => FalseTestimonyStatus | undefined;
  resolveCurrentVerdictChoice: (
    state: GameState,
    suspect: FalseTestimonySuspect
  ) => GameState;
}>;

function getFalseTestimonyGameApi(): FalseTestimonyGameApi {
  const candidate = gameApi as unknown as Partial<FalseTestimonyGameApi>;
  if (
    typeof candidate.getCurrentVerdictStatus !== 'function' ||
    typeof candidate.resolveCurrentVerdictChoice !== 'function'
  ) {
    throw new BalanceSimulationError('False-testimony accusation APIs are unavailable.');
  }
  return candidate as FalseTestimonyGameApi;
}

function resolvePendingFalseTestimonyAccusation(
  state: GameState,
  evidence?: RouteCombatEvidence,
  suspect: FalseTestimonySuspect = 'route_surveyor',
  resolveAppeal = false
): GameState {
  if (state.run?.dungeonId !== 'false_testimony_court') return state;
  const api = getFalseTestimonyGameApi();
  const status = api.getCurrentVerdictStatus(state);
  const nodeId = status?.pendingVerdictNodeId;
  if (!status || !nodeId || (nodeId === 'appeal_desk' && !resolveAppeal)) return state;

  const rewardPointsBefore = state.run.lootBag.rewardPoints;
  const resolved = api.resolveCurrentVerdictChoice(state, suspect);
  const resolvedStatus = api.getCurrentVerdictStatus(resolved);
  if (
    !resolvedStatus ||
    resolved === state ||
    resolvedStatus.pendingVerdictNodeId !== null ||
    resolvedStatus.accusedSuspect !== suspect ||
    resolvedStatus.accusationCorrect !== (suspect === 'route_surveyor') ||
    resolvedStatus.appealUsed !== (status.appealUsed || nodeId === 'appeal_desk')
  ) {
    throw getDangerResolutionError(
      resolved,
      nodeId,
      `false-testimony accusation against ${suspect} did not resolve through the public game API`
    );
  }
  const rewardPointsDelta = (resolved.run?.lootBag.rewardPoints ?? rewardPointsBefore) - rewardPointsBefore;
  evidence?.falseTestimonyAccusationTrace.push({
    nodeId,
    suspect,
    currentTrustedCountBefore: status.currentTrustedCount,
    accusationTrustedCountBefore: status.accusationTrustedCount,
    accusationTrustedCountAfter: resolvedStatus.accusationTrustedCount,
    projectedRewardPointsBefore: status.projectedAccusationRewardPoints,
    rewardPointsDelta,
    correct: resolvedStatus.accusationCorrect,
    appealed: nodeId === 'appeal_desk',
    appealUsedAfter: resolvedStatus.appealUsed
  });
  return resolved;
}

type PanopticonGameApi = Readonly<{
  selectPanopticonRoute: (state: GameState, route: PanopticonRoute) => GameState;
}>;

function getPanopticonGameApi(): PanopticonGameApi {
  const candidate = gameApi as unknown as Partial<PanopticonGameApi>;
  if (typeof candidate.selectPanopticonRoute !== 'function') {
    throw new BalanceSimulationError('Panopticon route API is unavailable.');
  }
  return candidate as PanopticonGameApi;
}

function getCurrentPanopticonStatus(state: GameState): PanopticonStatus | undefined {
  if (state.run?.dungeonId !== 'panopticon_city' || !state.run.lawState) return undefined;
  return getPanopticonLawStatus(state.run.lawState);
}

function resolvePendingPanopticonRoute(
  state: GameState,
  route: PanopticonRoute = 'shadow'
): GameState {
  if (state.run?.dungeonId !== 'panopticon_city') return state;
  const api = getPanopticonGameApi();
  const before = getCurrentPanopticonStatus(state);
  if (!before?.readyForRoute || before.pendingRouteNodeId === null) return state;

  const resolved = api.selectPanopticonRoute(state, route);
  const after = getCurrentPanopticonStatus(resolved);
  if (
    resolved === state ||
    after?.route !== route ||
    after.pendingRouteNodeId !== null ||
    !after.readyForBoss
  ) {
    throw getDangerResolutionError(
      resolved,
      before.pendingRouteNodeId,
      `panopticon ${route} route did not resolve through the public game API`
    );
  }
  return resolved;
}

function prepareRedactionScriptoriumApproach(
  state: GameState,
  evidence?: RouteCombatEvidence,
  options: RouteMovementOptions = {}
): GameState {
  let nextState = state;
  for (const nodeId of DUNGEON_LAW_LANDMARKS.redaction_scriptorium.clauseNodeIds) {
    const status = getCurrentRedactionClauseStatus(nextState);
    if (!status || Object.prototype.hasOwnProperty.call(status.resolvedClauseChoices, nodeId)) continue;
    nextState = moveAlongRoutePath(nextState, nodeId, evidence, {
      ...options,
      skipRedactionPreparation: true
    });
  }
  return nextState;
}

function prepareLegacyAuctionCourtApproach(
  state: GameState,
  evidence?: RouteCombatEvidence,
  options: RouteMovementOptions = {}
): GameState {
  let nextState = moveAlongRoutePath(state, 'estate_gate', evidence, {
    ...options,
    skipAuctionPreparation: true
  });
  for (const nodeId of [
    'force_lot_dais',
    'guard_lot_dais',
    'art_lot_dais',
    'return_lot_dais'
  ] as const satisfies readonly AuctionLotNodeId[]) {
    const status = getCurrentAuctionLotStatus(nextState);
    if (status?.resolvedLotChoices[nodeId] !== undefined) continue;
    nextState = moveAlongRoutePath(nextState, nodeId, evidence, {
      ...options,
      skipAuctionPreparation: true
    });
  }
  return nextState;
}

function prepareMirrorCityBossApproach(
  state: GameState,
  evidence?: RouteCombatEvidence,
  excludedNodeIds: ReadonlySet<string> = new Set()
): GameState {
  let nextState = state;
  const phaseNodeIds = ['first_phase_mirror', 'second_phase_mirror', 'third_phase_mirror'] as const;
  for (const [index, nodeId] of phaseNodeIds.entries()) {
    const status = getCurrentMirrorCityPhaseStatus(nextState);
    if (!status || Object.prototype.hasOwnProperty.call(status.resolvedPhaseChoices, nodeId)) continue;
    nextState = moveAlongRoutePath(nextState, nodeId, evidence, { excludedNodeIds });
    const pending = getCurrentMirrorCityPhaseStatus(nextState);
    const targetNodeId = !pending?.anchors.real && !excludedNodeIds.has('real_anchor')
      ? 'real_anchor'
      : !pending?.anchors.mirror && !excludedNodeIds.has('mirror_anchor')
        ? 'mirror_anchor'
        : phaseNodeIds[index + 1] ?? 'nameless_reflection';
    nextState = resolvePendingMirrorCityPhaseForTarget(nextState, targetNodeId, evidence);
    const resolved = getCurrentMirrorCityPhaseStatus(nextState);
    if (targetNodeId === 'real_anchor' && resolved?.currentPhase === 'real') {
      nextState = moveAlongRoutePath(nextState, targetNodeId, evidence, { excludedNodeIds });
    } else if (targetNodeId === 'mirror_anchor' && resolved?.currentPhase === 'mirror') {
      nextState = moveAlongRoutePath(nextState, targetNodeId, evidence, { excludedNodeIds });
    }
  }
  return nextState;
}

function prepareGenesisVaultSpliceApproach(
  state: GameState,
  evidence?: RouteCombatEvidence,
  options: RouteMovementOptions = {}
): GameState {
  let nextState = state;
  for (const nodeId of DUNGEON_LAW_LANDMARKS.genesis_vault.spliceNodeIds) {
    const status = getCurrentGenesisSpliceStatus(nextState);
    if (!status || status.spliceSequence.length >= 3) break;
    const expectedNodeId = DUNGEON_LAW_LANDMARKS.genesis_vault.spliceNodeIds[status.spliceSequence.length];
    if (nodeId !== expectedNodeId) continue;
    if (nodeId === 'third_splice_console' && options.excludedNodeIds?.has('mutation_guardian_omega')) {
      const movementEvidence = evidence ?? createRouteCombatEvidence();
      for (const waypointNodeId of [
        'gene_stalker_alpha',
        'helix_collapse_trap',
        'first_splice_console',
        'sample_corridor_guard',
        'third_splice_console'
      ]) {
        nextState = collectCurrentRouteReward(resolveCurrentDanger(nextState, evidence), evidence);
        if (nextState.run?.pendingEquipmentOffer) {
          nextState = resolvePendingEquipmentOffer(nextState, nextState.run.currentNodeId);
        }
        nextState = recordSoulRouteMovement(nextState, waypointNodeId, movementEvidence);
      }
      nextState = collectCurrentRouteReward(resolveCurrentDanger(nextState, evidence), evidence);
      nextState = resolvePendingGenesisSplice(nextState, evidence, options.genesisSpliceSequence);
      continue;
    }
    nextState = moveAlongRoutePath(nextState, nodeId, evidence, {
      ...options,
      skipGenesisPreparation: true
    });
    if (nextState.run?.pendingEquipmentOffer) {
      nextState = resolvePendingEquipmentOffer(nextState, nextState.run.currentNodeId);
    }
  }
  return nextState;
}

function prepareSilentBroadcastTowerApproach(
  state: GameState,
  evidence?: RouteCombatEvidence,
  options: RouteMovementOptions = {}
): GameState {
  let nextState = state;
  for (const nodeId of [
    'south_relay_console',
    'north_relay_console',
    'central_relay_console'
  ] as const satisfies readonly BroadcastRelayNodeId[]) {
    const status = getCurrentBroadcastRelayStatus(nextState);
    if (!status || Object.prototype.hasOwnProperty.call(status.resolvedRelayChoices, nodeId)) continue;
    nextState = moveAlongRoutePath(nextState, nodeId, evidence, {
      ...options,
      skipBroadcastPreparation: true
    });
  }
  return nextState;
}

function prepareFalseTestimonyCourtApproach(
  state: GameState,
  targetNodeId: string,
  evidence?: RouteCombatEvidence,
  excludedNodeIds?: ReadonlySet<string>
): GameState {
  const status = getFalseTestimonyGameApi().getCurrentVerdictStatus(state);
  if (!status || status.accusedSuspect !== null) return state;
  if (evidence) {
    evidence.useAllCombatSupports = true;
    evidence.prioritizeHealing = true;
    evidence.healingTargetRatio = 0.8;
    evidence.scriptedActions = {
      ...(evidence.scriptedActions ?? {}),
      hostile_witness_north: HOSTILE_WITNESS_SURVIVAL_SCRIPT,
      archive_censor_alpha: ARCHIVE_CENSOR_SURVIVAL_SCRIPT,
      perjury_hound_omega: FALSE_TESTIMONY_SURVIVAL_SCRIPT,
      hostile_witness: HOSTILE_WITNESS_SURVIVAL_SCRIPT,
      soul_recharge_verdict: ARCHIVE_CENSOR_SURVIVAL_SCRIPT,
      false_testimony_judge: FALSE_TESTIMONY_BOSS_SURVIVAL_SCRIPT
    };
  }

  const evidencePairs = [
    ['residue_sterility_trap', 'residue_evidence', 'armor_patch'],
    ['timeline_checksum_trap', 'timeline_evidence', 'dispel_talisman'],
    ['voice_filter_trap', 'voice_evidence', 'focus_incense']
  ] as const;
  const requiredPairCount = targetNodeId === 'truth_archive'
    ? 3
    : targetNodeId === 'swift_judgment_armory' ||
        targetNodeId === 'false_verdict_vault' ||
        targetNodeId === 'appeal_desk'
      ? 2
      : 1;
  const selectedEvidencePairs = requiredPairCount === 1
    ? evidencePairs.filter(([, , counterItem]) => isTacticalItemAvailable(state, counterItem)).slice(0, 1)
    : evidencePairs.slice(0, requiredPairCount);
  if (selectedEvidencePairs.length !== requiredPairCount) {
    throw new BalanceSimulationError(
      `${targetNodeId}: Tier 17 route did not carry ${requiredPairCount} usable evidence counter(s).`
    );
  }
  let nextState = state;
  for (const [trapNodeId, evidenceNodeId] of selectedEvidencePairs) {
    const currentStatus = getFalseTestimonyGameApi().getCurrentVerdictStatus(nextState);
    if (currentStatus?.evidence.find((item) => item.id === evidenceNodeId)?.revealed) continue;
    nextState = moveAlongRoutePath(nextState, trapNodeId, evidence, {
      excludedNodeIds,
      skipFalseTestimonyPreparation: true
    });
    nextState = moveAlongRoutePath(nextState, evidenceNodeId, evidence, {
      excludedNodeIds,
      skipFalseTestimonyPreparation: true
    });
  }
  return moveAlongRoutePath(nextState, 'verdict_chamber', evidence, {
    falseTestimonySuspect:
      targetNodeId === 'false_verdict_vault' || targetNodeId === 'appeal_desk'
        ? 'records_keeper'
        : 'route_surveyor',
    excludedNodeIds,
    skipFalseTestimonyPreparation: true
  });
}

function preparePanopticonCityApproach(
  state: GameState,
  evidence?: RouteCombatEvidence,
  options: RouteMovementOptions = {}
): GameState {
  let nextState = state;
  for (const nodeId of DUNGEON_LAW_LANDMARKS.panopticon_city.relayNodeIds) {
    const status = getCurrentPanopticonStatus(nextState);
    if (!status || status.relays[nodeId]) continue;
    nextState = moveAlongRoutePath(nextState, nodeId, evidence, {
      ...options,
      skipPanopticonPreparation: true
    });
  }
  return resolvePendingPanopticonRoute(nextState, options.panopticonRoute);
}

function moveAlongRoutePath(
  state: GameState,
  targetNodeId: string,
  evidence?: RouteCombatEvidence,
  options: RouteMovementOptions = {}
): GameState {
  const isRedactionClauseTarget = DUNGEON_LAW_LANDMARKS.redaction_scriptorium.clauseNodeIds.includes(
    targetNodeId as RedactionClauseNodeId
  );
  const needsGenesisSplices = targetNodeId === 'mosaic_gene_vault' || targetNodeId === 'primal_curator';
  let nextState =
    state.run?.dungeonId === 'mirror_cycle_city' && targetNodeId === 'nameless_reflection'
      ? prepareMirrorCityBossApproach(state, evidence, options.excludedNodeIds)
      : state.run?.dungeonId === 'redaction_scriptorium' &&
          !options.skipRedactionPreparation &&
          !isRedactionClauseTarget
        ? prepareRedactionScriptoriumApproach(state, evidence, options)
      : state.run?.dungeonId === 'legacy_auction_court' &&
          !options.skipAuctionPreparation &&
          targetNodeId === 'estate_auctioneer'
        ? prepareLegacyAuctionCourtApproach(state, evidence, options)
      : state.run?.dungeonId === 'genesis_vault' &&
          !options.skipGenesisPreparation &&
          needsGenesisSplices
        ? prepareGenesisVaultSpliceApproach(state, evidence, options)
      : state.run?.dungeonId === 'silent_broadcast_tower' &&
          !options.skipBroadcastPreparation &&
          targetNodeId === 'last_broadcaster'
        ? prepareSilentBroadcastTowerApproach(state, evidence, options)
      : state.run?.dungeonId === 'false_testimony_court' &&
          !options.skipFalseTestimonyPreparation &&
          [
            'truth_archive',
            'swift_judgment_armory',
            'false_verdict_vault',
            'appeal_desk',
            'hostile_witness_north',
            'false_testimony_judge',
            'judgment_lock',
            'verdict_exit'
          ].includes(targetNodeId)
        ? prepareFalseTestimonyCourtApproach(state, targetNodeId, evidence, options.excludedNodeIds)
      : state.run?.dungeonId === 'panopticon_city' &&
          !options.skipPanopticonPreparation &&
          ['all_sight_warden', 'blind_dawn_exit'].includes(targetNodeId)
        ? preparePanopticonCityApproach(state, evidence, options)
      : state;
  const maximumMovements = state.run ? DUNGEONS[state.run.dungeonId].nodes.length * 4 : 0;

  for (let movementCount = 0; nextState.run?.currentNodeId !== targetNodeId; movementCount += 1) {
    if (movementCount >= maximumMovements) {
      throw getDangerResolutionError(
        nextState,
        targetNodeId,
        `route exceeded ${maximumMovements} movements without reaching its target`
      );
    }
    nextState = resolveCurrentDanger(nextState, evidence, options.causalLedgerChoice);
    if (evidence?.autoResolveEquipmentOffers === true && nextState.run?.pendingEquipmentOffer) {
      nextState = resolvePendingEquipmentOffer(nextState, nextState.run.currentNodeId);
    }
    nextState = collectCurrentRouteReward(nextState, evidence);
    nextState = resolvePendingRedactionClause(nextState, options.redactionClauseChoices);
    nextState = resolvePendingAuctionLot(nextState, evidence, options.auctionLotChoices);
    nextState = resolvePendingGenesisSplice(nextState, evidence, options.genesisSpliceSequence);
    nextState = resolvePendingBroadcastRelay(nextState, evidence, options.broadcastRelayChoices);
    nextState = resolvePendingEscortCheckpoint(nextState, evidence, options.escortCheckpointChoices);
    nextState = resolvePendingFalseTestimonyAccusation(
      nextState,
      evidence,
      options.falseTestimonySuspect,
      options.resolveFalseTestimonyAppeal
    );
    nextState = resolvePendingPanopticonRoute(nextState, options.panopticonRoute);
    if (!nextState.run || nextState.run.currentNodeId === targetNodeId) break;
    nextState = resolvePendingEntropyHeadingForTarget(
      nextState,
      targetNodeId,
      evidence,
      options.excludedNodeIds
    );
    nextState = resolvePendingMirrorCityPhaseForTarget(
      nextState,
      targetNodeId,
      evidence,
      options.excludedNodeIds
    );
    if (!nextState.run) {
      throw getDangerResolutionError(nextState, targetNodeId, 'law choice resolution ended the active run');
    }

    const nodeId = findAdjacentRoutePath(
      nextState,
      targetNodeId,
      evidence,
      options.excludedNodeIds
    )[0];
    if (!nodeId) {
      throw getDangerResolutionError(nextState, targetNodeId, 'legal pathfinder returned no next step');
    }

    const fromNodeId = nextState.run.currentNodeId;
    const gateStatus = getCurrentRouteGateStatus(nextState, nodeId);
    const blockReason = getCurrentRouteBlockReason(nextState, nodeId);
    evidence?.routeMovements.push({
      fromNodeId,
      toNodeId: nodeId,
      legal: blockReason === undefined,
      routeGateId: gateStatus?.gate.id,
      blockReason
    });
    if (gateStatus) recordRouteGateEvidence(evidence, gateStatus, blockReason === undefined);
    if (blockReason) {
      throw getDangerResolutionError(nextState, nodeId, `pathfinder selected a closed route gate: ${blockReason}`);
    }

    nextState = moveToNode(nextState, nodeId);
    if (nextState.run?.currentNodeId !== nodeId) {
      throw getDangerResolutionError(
        nextState,
        nodeId,
        `route movement from ${fromNodeId} was blocked`
      );
    }
    evidence?.visitedNodeIds?.push(nodeId);
  }

  const resolved = options.resolveTargetDanger === false
    ? nextState
    : resolveCurrentDanger(nextState, evidence, options.causalLedgerChoice);
  const collected = options.collectTargetReward === false
    ? resolved
    : collectCurrentRouteReward(resolved, evidence);
  return resolvePendingPanopticonRoute(resolvePendingFalseTestimonyAccusation(resolvePendingEscortCheckpoint(
    resolvePendingBroadcastRelay(resolvePendingGenesisSplice(resolvePendingAuctionLot(
      resolvePendingRedactionClause(collected, options.redactionClauseChoices),
      evidence,
      options.auctionLotChoices
    ), evidence, options.genesisSpliceSequence), evidence, options.broadcastRelayChoices),
    evidence,
    options.escortCheckpointChoices
  ), evidence, options.falseTestimonySuspect, options.resolveFalseTestimonyAppeal), options.panopticonRoute);
}

function collectBossRouteRecovery(state: GameState, dungeonId: DungeonId, evidence?: RouteCombatEvidence): GameState {
  if (
    !state.run ||
    state.inventory.healing_pill >= 2 ||
    state.player.hp > Math.floor(state.player.maxHp * 0.45)
  ) {
    return state;
  }

  const recoveryRoutes = DUNGEONS[dungeonId].nodes
    .filter(
      (node) =>
        node.type === 'reward' &&
        !state.run?.clearedNodeIds.includes(node.id) &&
        (node.reward?.items?.healing_pill ?? 0) > 0
    )
    .map((node) => {
      const path = findAdjacentRoutePath(state, node.id, evidence);
      const dangerousSteps = path.filter((nodeId) => {
        const candidate = DUNGEONS[dungeonId].nodes.find((dungeonNode) => dungeonNode.id === nodeId);
        return candidate?.type === 'monster' || candidate?.type === 'trap';
      }).length;
      return { nodeId: node.id, pathLength: path.length, dangerousSteps };
    })
    .sort((a, b) => a.dangerousSteps - b.dangerousSteps || a.pathLength - b.pathLength);

  const recoveryRoute = recoveryRoutes[0];
  if (!recoveryRoute) return state;

  // Low-health campaign routes may take an existing supply detour before committing to the seal boss.
  return moveAlongRoutePath(state, recoveryRoute.nodeId, evidence);
}

function didBuyEquipment(before: GameState, after: GameState, equipmentId: EquipmentId): boolean {
  return !before.ownedEquipment.includes(equipmentId) && after.ownedEquipment.includes(equipmentId);
}

function didUpgradeEquipment(before: GameState, after: GameState, equipmentId: EquipmentId): boolean {
  return (after.equipmentLevels[equipmentId] ?? 0) > (before.equipmentLevels[equipmentId] ?? 0);
}

function didLearnMethod(before: GameState, after: GameState, methodId: MethodId): boolean {
  return !before.learnedMethods.includes(methodId) && after.learnedMethods.includes(methodId);
}

function didBuyOrImprovePet(before: GameState, after: GameState, petId: PetId): boolean {
  return !before.ownedPets.includes(petId) && after.ownedPets.includes(petId);
}

const TEMPORAL_ROUTE_EQUIPMENT_IDS = [
  'chronal_edge',
  'chronal_aegis'
] as const satisfies readonly EquipmentId[];

function prepareTemporalRouteEquipment(state: GameState): GameState {
  let nextState: GameState = {
    ...state,
    rewardPoints: Math.max(state.rewardPoints, 10_000),
    lingyun: Math.max(state.lingyun, 32),
    inventory: {
      ...state.inventory,
      cracked_core: Math.max(state.inventory.cracked_core, 64),
      chronal_glass: Math.max(state.inventory.chronal_glass, 64),
      cycle_imprint: Math.max(state.inventory.cycle_imprint, 32)
    }
  };
  if (nextState.phase !== 'hub') {
    throw new BalanceSimulationError('Chronal route equipment must be prepared from the hub.');
  }

  // Repeat-route fixtures spend only resources earned by the completed observatory campaign.
  for (const equipmentId of TEMPORAL_ROUTE_EQUIPMENT_IDS) {
    if (!nextState.ownedEquipment.includes(equipmentId)) {
      nextState = buyEquipment(nextState, equipmentId);
    }
    if (!nextState.ownedEquipment.includes(equipmentId)) {
      throw new BalanceSimulationError(`Unable to buy ${equipmentId} for the temporal observatory route.`);
    }
    while ((nextState.equipmentLevels[equipmentId] ?? 1) < EQUIPMENT[equipmentId].maxLevel) {
      const beforeLevel = nextState.equipmentLevels[equipmentId] ?? 1;
      nextState = upgradeEquipment(nextState, equipmentId);
      if ((nextState.equipmentLevels[equipmentId] ?? 1) === beforeLevel) {
        throw new BalanceSimulationError(`Unable to upgrade ${equipmentId} for the temporal observatory route.`);
      }
    }
    nextState = attuneEquipment(nextState, equipmentId, 'chronal_stasis');
    if (nextState.equipmentAttunements?.[equipmentId] !== 'chronal_stasis') {
      throw new BalanceSimulationError(`Unable to attune ${equipmentId} for the temporal observatory route.`);
    }
    while ((nextState.equipmentTemperRanks?.[equipmentId] ?? 0) < 2) {
      const beforeRank = nextState.equipmentTemperRanks?.[equipmentId] ?? 0;
      nextState = temperEquipment(nextState, equipmentId);
      if ((nextState.equipmentTemperRanks?.[equipmentId] ?? 0) === beforeRank) {
        throw new BalanceSimulationError(`Unable to temper ${equipmentId} for the temporal observatory route.`);
      }
    }
    nextState = equipEquipment(nextState, equipmentId);
  }
  return nextState;
}

function getGateStatus(state: GameState, dungeonId: DungeonId): SevenDungeonRouteSummary['gateBeforeEntry'] {
  const status = getCampaignGates(state).find((candidate) => candidate.dungeonId === dungeonId)?.status;

  if (status === 'available') return 'open';
  return status ?? 'missing';
}

function getGateRequirement(state: GameState, dungeonId: DungeonId): string {
  return getCampaignGates(state).find((candidate) => candidate.dungeonId === dungeonId)?.requirementText ?? 'Gate missing.';
}

function investForDungeon(state: GameState, dungeonId: DungeonId): { state: GameState } & Pick<
  BalanceSimStage,
  'plannedPurchases' | 'plannedUpgrades' | 'plannedMethods' | 'plannedPets'
> {
  let nextState = state;
  const plan = NORMAL_PLAYER_ROUTE[dungeonId] ?? {};
  const plannedPurchases: EquipmentId[] = [];
  const plannedUpgrades: EquipmentId[] = [];
  const plannedMethods: MethodId[] = [];
  const plannedPets: PetId[] = [];

  if (dungeonId === 'combat_replay_stage') {
    nextState = prepareDeepRouteBaseState(nextState);
  }

  if (dungeonId === 'silent_broadcast_tower') {
    nextState = prepareGenesisVaultCampaignThroughTierOnePortal(nextState);
  }

  if (dungeonId === 'lost_shelter') {
    const beforeBroadcastPreparation = nextState;
    nextState = prepareBroadcastRepeatHubState(nextState);
    for (const equipmentId of [
      'hushblade',
      'dead_air_headset',
      'anechoic_mantle',
      'last_channel_beacon'
    ] as const) {
      if (didBuyEquipment(beforeBroadcastPreparation, nextState, equipmentId)) {
        plannedPurchases.push(equipmentId);
      }
      if (didUpgradeEquipment(beforeBroadcastPreparation, nextState, equipmentId)) {
        plannedUpgrades.push(equipmentId);
      }
    }
    if (!nextState.ownedCompanions.includes('qin_che')) {
      nextState = recruitCompanion(nextState, 'qin_che');
    }
    while ((nextState.companionRanks.qin_che ?? 0) < 2) {
      const beforeRank = nextState.companionRanks.qin_che ?? 0;
      nextState = upgradeCompanion(nextState, 'qin_che');
      if ((nextState.companionRanks.qin_che ?? 0) === beforeRank) {
        throw new BalanceSimulationError('Tier 16 preparation could not train Qin Che to R2.');
      }
    }
    nextState = activateCompanion(nextState, 'qin_che');
    while ((nextState.methodRanks.iron_body ?? 1) < 3) {
      const beforeRank = nextState.methodRanks.iron_body ?? 1;
      nextState = upgradeMethod(nextState, 'iron_body');
      if ((nextState.methodRanks.iron_body ?? 1) === beforeRank) {
        throw new BalanceSimulationError('Tier 16 preparation could not refine iron_body to R3.');
      }
    }
    nextState = activateMethod(nextState, 'iron_body');
    if (nextState.ownedPets.includes('starling_drone')) nextState = activatePet(nextState, 'starling_drone');
    if (nextState.bloodlineRanks.bastion_chitin !== undefined) {
      nextState = activateBloodline(nextState, 'bastion_chitin');
    }
    if (nextState.ownedCompanions.includes('lu_guanlan')) {
      nextState = activateCompanion(nextState, 'lu_guanlan');
    }
  }

  if (dungeonId === 'false_testimony_court') {
    if (nextState.learnedMethods.includes('iron_body')) nextState = activateMethod(nextState, 'iron_body');
    if (nextState.ownedPets.includes('starling_drone')) nextState = activatePet(nextState, 'starling_drone');
    if (nextState.ownedCompanions.includes('lu_guanlan')) nextState = activateCompanion(nextState, 'lu_guanlan');
    if (nextState.bloodlineRanks.bastion_chitin !== undefined) {
      nextState = activateBloodline(nextState, 'bastion_chitin');
    }
    if (
      nextState.activeMethod !== 'iron_body' ||
      nextState.activePet !== 'starling_drone' ||
      nextState.activeCompanion !== 'lu_guanlan' ||
      nextState.activeBloodline !== 'bastion_chitin' ||
      Object.values(nextState.equipped).filter(Boolean).length < 4
    ) {
      throw new BalanceSimulationError(
        'Tier 17 preparation requires real equipped gear and active method, pet, companion, and bloodline progress.'
      );
    }
  }

  if (dungeonId === 'genesis_vault') {
    nextState = unlockBloodline(nextState, 'bastion_chitin');
    nextState = activateBloodline(nextState, 'bastion_chitin');
    if (nextState.bloodlineRanks.bastion_chitin !== 1 || nextState.activeBloodline !== 'bastion_chitin') {
      throw new BalanceSimulationError('Tier 14 preparation could not unlock and activate bastion_chitin R1.');
    }
    nextState = learnMethod(nextState, 'mist_breathing');
    nextState = upgradeMethod(upgradeMethod(nextState, 'mist_breathing'), 'mist_breathing');
    nextState = activateMethod(nextState, 'mist_breathing');
    nextState = recruitCompanion(nextState, 'lu_guanlan');
    nextState = upgradeCompanion(upgradeCompanion(nextState, 'lu_guanlan'), 'lu_guanlan');
    nextState = activateCompanion(nextState, 'lu_guanlan');
    for (const taskId of [
      'side_recruit_first_companion',
      'side_train_companion_rank_2',
      'side_refine_first_method_rank_2',
      'side_master_first_method_rank_3',
      'side_unlock_first_bloodline'
    ]) {
      nextState = claimTaskReward(nextState, taskId);
    }
    const armorId = 'escrow_plate' as const;
    const beforeArmorPurchase = nextState;
    nextState = buyEquipment(nextState, armorId);
    if (didBuyEquipment(beforeArmorPurchase, nextState, armorId)) plannedPurchases.push(armorId);
    if (!nextState.ownedEquipment.includes(armorId)) {
      throw new BalanceSimulationError('Tier 14 preparation could not buy escrow_plate from earned Tier 13 resources.');
    }
    while ((nextState.equipmentLevels[armorId] ?? 1) < EQUIPMENT[armorId].maxLevel) {
      const beforeLevel = nextState.equipmentLevels[armorId] ?? 1;
      nextState = upgradeEquipment(nextState, armorId);
      if ((nextState.equipmentLevels[armorId] ?? 1) === beforeLevel) {
        throw new BalanceSimulationError('Tier 14 preparation could not max escrow_plate.');
      }
      plannedUpgrades.push(armorId);
    }
    nextState = attuneEquipment(nextState, armorId, 'rift_resonance');
    if (nextState.equipmentAttunements?.[armorId] !== 'rift_resonance') {
      throw new BalanceSimulationError('Tier 14 preparation could not attune escrow_plate.');
    }
    while ((nextState.equipmentTemperRanks?.[armorId] ?? 0) < 2) {
      const beforeRank = nextState.equipmentTemperRanks?.[armorId] ?? 0;
      nextState = temperEquipment(nextState, armorId);
      if ((nextState.equipmentTemperRanks?.[armorId] ?? 0) === beforeRank) {
        throw new BalanceSimulationError('Tier 14 preparation could not temper escrow_plate to rank II.');
      }
    }
    nextState = equipEquipment(nextState, armorId);

    for (const [equipmentId, attunementId] of [
      ['final_proof_seal', 'rift_anchor']
    ] as const) {
      const beforePurchase = nextState;
      nextState = buyEquipment(nextState, equipmentId);
      if (didBuyEquipment(beforePurchase, nextState, equipmentId)) plannedPurchases.push(equipmentId);
      if (!nextState.ownedEquipment.includes(equipmentId)) {
        throw new BalanceSimulationError(`Tier 14 preparation could not buy ${equipmentId} from earned Tier 12 resources.`);
      }
      while ((nextState.equipmentLevels[equipmentId] ?? 1) < EQUIPMENT[equipmentId].maxLevel) {
        const beforeLevel = nextState.equipmentLevels[equipmentId] ?? 1;
        nextState = upgradeEquipment(nextState, equipmentId);
        if ((nextState.equipmentLevels[equipmentId] ?? 1) === beforeLevel) {
          throw new BalanceSimulationError(`Tier 14 preparation could not max ${equipmentId}.`);
        }
        plannedUpgrades.push(equipmentId);
      }
      nextState = attuneEquipment(nextState, equipmentId, attunementId);
      nextState = equipEquipment(nextState, equipmentId);
    }

    for (const equipmentId of [
      nextState.equipped.armor,
      nextState.equipped.hands,
      nextState.equipped.feet,
      nextState.equipped.waist,
      nextState.equipped.head,
      nextState.equipped.charm,
      nextState.equipped.weapon
    ]) {
      if (!equipmentId) continue;
      if (equipmentId !== nextState.equipped.weapon) {
        nextState = attuneEquipment(nextState, equipmentId, 'chronal_stasis');
      }
      while ((nextState.equipmentLevels[equipmentId] ?? 1) < EQUIPMENT[equipmentId].maxLevel) {
        const beforeLevel = nextState.equipmentLevels[equipmentId] ?? 1;
        nextState = upgradeEquipment(nextState, equipmentId);
        if ((nextState.equipmentLevels[equipmentId] ?? 1) === beforeLevel) break;
        plannedUpgrades.push(equipmentId);
      }
      while ((nextState.equipmentTemperRanks?.[equipmentId] ?? 0) < 2) {
        const beforeRank = nextState.equipmentTemperRanks?.[equipmentId] ?? 0;
        nextState = temperEquipment(nextState, equipmentId);
        if ((nextState.equipmentTemperRanks?.[equipmentId] ?? 0) === beforeRank) break;
      }
    }

  }

  if (dungeonId === 'legacy_auction_court') {
    const equipmentId = 'guardian_gauntlets';
    const beforePurchase = nextState;
    nextState = buyEquipment(nextState, equipmentId);
    if (didBuyEquipment(beforePurchase, nextState, equipmentId)) plannedPurchases.push(equipmentId);
    if (!nextState.ownedEquipment.includes(equipmentId)) {
      throw new BalanceSimulationError('Tier 13 preparation could not buy guardian_gauntlets for the soul skip.');
    }
    nextState = equipEquipment(nextState, equipmentId);
    while ((nextState.equipmentLevels[equipmentId] ?? 1) < EQUIPMENT[equipmentId].maxLevel) {
      const beforeLevel = nextState.equipmentLevels[equipmentId] ?? 1;
      nextState = upgradeEquipment(nextState, equipmentId);
      if ((nextState.equipmentLevels[equipmentId] ?? 1) === beforeLevel) {
        throw new BalanceSimulationError('Tier 13 preparation could not max guardian_gauntlets for the soul skip.');
      }
      plannedUpgrades.push(equipmentId);
    }
    while ((nextState.equipmentTemperRanks?.[equipmentId] ?? 0) < 1) {
      const beforeRank = nextState.equipmentTemperRanks?.[equipmentId] ?? 0;
      nextState = temperEquipment(nextState, equipmentId);
      if ((nextState.equipmentTemperRanks?.[equipmentId] ?? 0) === beforeRank) {
        throw new BalanceSimulationError('Tier 13 preparation could not temper guardian_gauntlets for the soul skip.');
      }
    }

    const armorId = 'guardian_plate';
    if (!nextState.ownedEquipment.includes(armorId)) {
      throw new BalanceSimulationError('Tier 13 preparation requires the campaign-owned guardian_plate.');
    }
    nextState = equipEquipment(nextState, armorId);
    while ((nextState.equipmentLevels[armorId] ?? 1) < EQUIPMENT[armorId].maxLevel) {
      const beforeLevel = nextState.equipmentLevels[armorId] ?? 1;
      nextState = upgradeEquipment(nextState, armorId);
      if ((nextState.equipmentLevels[armorId] ?? 1) === beforeLevel) {
        throw new BalanceSimulationError('Tier 13 preparation could not max guardian_plate.');
      }
      plannedUpgrades.push(armorId);
    }
    while ((nextState.equipmentTemperRanks?.[armorId] ?? 0) < 1) {
      const beforeRank = nextState.equipmentTemperRanks?.[armorId] ?? 0;
      nextState = temperEquipment(nextState, armorId);
      if ((nextState.equipmentTemperRanks?.[armorId] ?? 0) === beforeRank) {
        throw new BalanceSimulationError('Tier 13 preparation could not temper guardian_plate to rank I.');
      }
    }
    nextState = attuneEquipment(nextState, armorId, 'forge_overdrive');
    if (nextState.equipmentAttunements?.[armorId] !== 'forge_overdrive') {
      throw new BalanceSimulationError('Tier 13 preparation could not attune guardian_plate for the boss route.');
    }

    nextState = recruitCompanion(nextState, 'lu_guanlan');
    nextState = upgradeCompanion(upgradeCompanion(nextState, 'lu_guanlan'), 'lu_guanlan');
    nextState = activateCompanion(nextState, 'lu_guanlan');
    nextState = upgradeMethod(upgradeMethod(nextState, 'mist_breathing'), 'mist_breathing');
    nextState = activateMethod(nextState, 'mist_breathing');
  }

  for (const equipmentId of plan.equipment ?? []) {
    const before = nextState;
    nextState = buyEquipment(nextState, equipmentId);
    if (didBuyEquipment(before, nextState, equipmentId)) plannedPurchases.push(equipmentId);
    nextState = equipEquipment(nextState, equipmentId);
  }

  for (const methodId of plan.methods ?? []) {
    const before = nextState;
    nextState = learnMethod(nextState, methodId);
    if (didLearnMethod(before, nextState, methodId)) plannedMethods.push(methodId);
  }

  for (const petId of plan.pets ?? []) {
    const before = nextState;
    nextState = buyPet(nextState, petId);
    if (didBuyOrImprovePet(before, nextState, petId)) plannedPets.push(petId);
    if (nextState.ownedPets.includes(petId)) nextState = activatePet(nextState, petId);
  }

  for (const equipmentId of plan.upgrades ?? []) {
    const before = nextState;
    nextState = upgradeEquipment(nextState, equipmentId);
    if (didUpgradeEquipment(before, nextState, equipmentId)) plannedUpgrades.push(equipmentId);
  }

  if (dungeonId === 'silent_broadcast_tower') {
    for (const equipmentId of ['helix_cleaver', 'carapace_harness', 'rebirth_amulet'] as const) {
      while ((nextState.equipmentLevels[equipmentId] ?? 1) < EQUIPMENT[equipmentId].maxLevel) {
        const beforeLevel = nextState.equipmentLevels[equipmentId] ?? 1;
        nextState = upgradeEquipment(nextState, equipmentId);
        if ((nextState.equipmentLevels[equipmentId] ?? 1) === beforeLevel) break;
        plannedUpgrades.push(equipmentId);
      }
    }
    nextState = equipEquipment(
      nextState,
      (nextState.equipmentLevels.helix_cleaver ?? 1) === EQUIPMENT.helix_cleaver.maxLevel
        ? 'helix_cleaver'
        : 'chronal_edge'
    );
    nextState = equipEquipment(
      nextState,
      (nextState.equipmentLevels.carapace_harness ?? 1) === EQUIPMENT.carapace_harness.maxLevel
        ? 'carapace_harness'
        : 'escrow_plate'
    );
    nextState = equipEquipment(
      nextState,
      (nextState.equipmentLevels.rebirth_amulet ?? 1) === EQUIPMENT.rebirth_amulet.maxLevel
        ? 'rebirth_amulet'
        : 'final_lot_bell'
    );
  }

  if (dungeonId === 'mirror_cycle_city') {
    nextState = restoreSimulationHealth(prepareTemporalRouteEquipment(nextState));
  }

  const healingPillTarget =
    dungeonId === 'temporal_observatory'
      ? 32
      : dungeonId === 'void_citadel'
        ? 24
        : dungeonId === 'mirror_cycle_city'
          ? 64
          : 0;
  while (nextState.inventory.healing_pill < healingPillTarget) {
    const beforeCount = nextState.inventory.healing_pill;
    nextState = buyItem(nextState, 'healing_pill');
    if (nextState.inventory.healing_pill === beforeCount) break;
  }

  if (upgradePet) {
    for (const petId of plan.pets ?? []) {
      const before = nextState;
      nextState = upgradePet(nextState, petId);
      if ((nextState.petLevels[petId] ?? 0) > (before.petLevels[petId] ?? 0)) plannedPets.push(petId);
    }
  }

  if (dungeonId === 'legacy_auction_court') {
    nextState = configureRunRelicPreparation(nextState, 'bulwark');
  }

  return { state: nextState, plannedPurchases, plannedUpgrades, plannedMethods, plannedPets };
}

function prepareCombatReplayBossRoute(
  state: GameState,
  evidence: RouteCombatEvidence
): GameState {
  if (state.run?.dungeonId !== 'combat_replay_stage') return state;

  let nextState = state;
  for (const nodeId of ['take_alpha', 'take_beta', 'take_gamma'] as const) {
    if (!nextState.run?.clearedNodeIds.includes(nodeId)) {
      nextState = moveAlongRoutePath(nextState, nodeId, evidence);
    }
  }

  const lawBeforeRoute = nextState.run?.lawState?.law;
  if (
    lawBeforeRoute?.kind !== 'combat_replay_stage' ||
    lawBeforeRoute.takes.some((take) => take === null)
  ) {
    throw new BalanceSimulationError('Combat replay boss route did not record take_alpha, take_beta, and take_gamma.');
  }
  const selectedRoute = lawBeforeRoute.route ?? 'sequence';
  if (lawBeforeRoute.route === null) {
    nextState = selectCombatReplayRoute(nextState, 'sequence');
  }

  const law = nextState.run?.lawState?.law;
  if (
    nextState.run?.combatReplayState?.route !== selectedRoute ||
    law?.kind !== 'combat_replay_stage' ||
    law.route !== selectedRoute
  ) {
    throw new BalanceSimulationError('Combat replay boss route did not lock a route through the public API.');
  }
  return nextState;
}

function collectRouteRewards(state: GameState, dungeonId: DungeonId, evidence?: RouteCombatEvidence): GameState {
  const bossDefinition = getBossDefinition(dungeonId);
  const exitNode = DUNGEONS[dungeonId].nodes.find((node) => node.type === 'exit');
  if (!exitNode) throw new Error(`${dungeonId} has no exit node.`);

  if (dungeonId === 'silent_broadcast_tower' && evidence) {
    evidence.methodTechniqueNodeId = bossDefinition.nodeId;
    evidence.companionAssistNodeId = bossDefinition.nodeId;
    evidence.bloodlineSurgeNodeId = bossDefinition.nodeId;
    evidence.soulSkipNodeId = bossDefinition.nodeId;
  }
  if (dungeonId === 'lost_shelter' && evidence) {
    evidence.methodTechniqueNodeId = bossDefinition.nodeId;
    evidence.companionAssistNodeId = bossDefinition.nodeId;
    evidence.deferCompanionAssistNodeId = bossDefinition.nodeId;
    evidence.bloodlineSurgeNodeId = bossDefinition.nodeId;
    evidence.soulSkipNodeId = bossDefinition.nodeId;
  }
  if (dungeonId === 'false_testimony_court' && evidence) {
    evidence.methodTechniqueNodeId = bossDefinition.nodeId;
    evidence.companionAssistNodeId = bossDefinition.nodeId;
    evidence.bloodlineSurgeNodeId = bossDefinition.nodeId;
    evidence.soulSkipNodeId = bossDefinition.nodeId;
  }

  // The normal route is a clear route, not a full-map farm: defeat the seal boss, then take the lowest-risk exit path.
  const routeEvidence = evidence ?? createRouteCombatEvidence();
  const routePrepared = dungeonId === 'combat_replay_stage'
    ? prepareCombatReplayBossRoute(state, routeEvidence)
    : state;
  const prepared = collectBossRouteRecovery(routePrepared, dungeonId, routeEvidence);
  let bossCleared = moveAlongRoutePath(prepared, bossDefinition.nodeId, routeEvidence);
  bossCleared = resolvePendingEquipmentOffer(bossCleared, bossDefinition.nodeId);
  assertBossSealCleared(bossCleared, dungeonId, 'after the configured boss route');

  return moveAlongRoutePath(bossCleared, exitNode.id, routeEvidence);
}

function enterFalseTestimonyCourtThroughShelterPortal(
  state: GameState,
  evidence: RouteCombatEvidence,
  tacticalItemIds: readonly TacticalItemId[] = ['focus_incense', 'dispel_talisman', 'armor_patch', 'gate_sigil'],
  collectShelterRelics = false
): GameState {
  const portalTacticalItemIds = [...new Set([...tacticalItemIds, 'gate_sigil' as const])];
  let entered = enterPreparedDungeon(state, 'lost_shelter', evidence, {
    plannedNodeIds: ['upper_return_portal'],
    portalUseNodeIds: ['upper_return_portal'],
    additionalTacticalItemIds: portalTacticalItemIds,
    inventoryTargets: Object.fromEntries(portalTacticalItemIds.map((itemId) => [itemId, 16])),
    methodTechnique: 'live'
  });
  if (collectShelterRelics) {
    const checkpointChoices = {
      north_checkpoint: 'push',
      central_checkpoint: 'treat',
      south_checkpoint: 'push'
    } as const satisfies Readonly<Record<EscortCheckpointNodeId, EscortCheckpointChoice>>;
    for (const nodeId of [
      'alarm_grid_trap',
      'south_checkpoint',
      'survivor_memory_stage',
      'survivor_cell',
      'central_checkpoint',
      'north_checkpoint',
      'collapsed_hall_trap',
      'north_entry',
      'evacuation_cache',
      'north_rescue_patrol',
      'shelter_enforcer_north',
      'mimic_survivor_alpha',
      'evacuation_horror_omega',
      'command_lock',
      'desperate_armory'
    ]) {
      entered = moveAlongRoutePath(entered, nodeId, evidence, {
        escortCheckpointChoices: checkpointChoices
      });
    }
  }
  entered = moveAlongRoutePath(entered, 'upper_return_portal', evidence, {
    escortCheckpointChoices: STANDARD_ESCORT_CHECKPOINT_CHOICES
  });
  entered = useTrackedPortal(entered, 'upper_return_portal', evidence);
  if (
    entered.run?.dungeonId !== 'false_testimony_court' ||
    entered.run.currentNodeId !== 'north_entry'
  ) {
    throw new BalanceSimulationError('Tier 17 preparation portal missed the false-testimony north entry.');
  }
  return entered;
}

function clearDungeonViaExit(state: GameState, dungeonId: DungeonId, evidence?: RouteCombatEvidence): GameState {
  const routeEvidence = evidence ?? createRouteCombatEvidence();
  if (dungeonId === 'legacy_auction_court') {
    routeEvidence.chooseRunRelic = (_state, candidateIds) =>
      candidateIds.find((relicId) => relicId === 'mending_thread') ?? candidateIds[0];
    routeEvidence.scriptedActions = {
      estate_auctioneer: Array.from({ length: MAX_COMBAT_ACTIONS }, (_, index) => {
        if (index % 4 === 2) return 'art';
        return index % 4 === 3 ? 'weapon_skill' : 'guard';
      }) as CombatAction[]
    };
    routeEvidence.methodTechniqueNodeId = 'estate_auctioneer';
    routeEvidence.companionAssistNodeId = 'estate_auctioneer';
    routeEvidence.soulSkipNodeId = 'estate_auctioneer';
  }
  if (dungeonId === 'genesis_vault') {
    routeEvidence.methodTechniqueNodeId = 'primal_curator';
    routeEvidence.companionAssistNodeId = 'primal_curator';
    routeEvidence.bloodlineSurgeNodeId = 'primal_curator';
    routeEvidence.soulSkipNodeId = 'primal_curator';
  }
  if (dungeonId === 'silent_broadcast_tower') {
    routeEvidence.methodTechniqueNodeId = 'last_broadcaster';
    routeEvidence.companionAssistNodeId = 'last_broadcaster';
    routeEvidence.bloodlineSurgeNodeId = 'last_broadcaster';
  }
  if (dungeonId === 'lost_shelter') {
    routeEvidence.scriptedActions = {
      north_rescue_patrol: LOST_SHELTER_FIRST_CLEAR_SURVIVAL_SCRIPT,
      shelter_enforcer_north: LOST_SHELTER_FIRST_CLEAR_SURVIVAL_SCRIPT,
      mimic_survivor_alpha: LOST_SHELTER_FIRST_CLEAR_SURVIVAL_SCRIPT,
      evacuation_horror_omega: LOST_SHELTER_FIRST_CLEAR_SURVIVAL_SCRIPT,
      mimic_survivor: LOST_SHELTER_FIRST_CLEAR_SURVIVAL_SCRIPT,
      shelter_overseer: LOST_SHELTER_FIRST_CLEAR_BOSS_SCRIPT
    };
    routeEvidence.chooseRunRelic ??= (_state, candidateIds) =>
      candidateIds.find((relicId) => relicId !== 'focus_prism') ?? candidateIds[0];
    routeEvidence.methodTechniqueNodeId = 'shelter_overseer';
    routeEvidence.companionAssistNodeId = 'shelter_overseer';
    routeEvidence.deferCompanionAssistNodeId = 'shelter_overseer';
    routeEvidence.bloodlineSurgeNodeId = 'shelter_overseer';
    routeEvidence.soulSkipNodeId = 'shelter_overseer';
    routeEvidence.reserveWeaponSkillForNodeId = 'shelter_overseer';
  }
  if (dungeonId === 'false_testimony_court') {
    routeEvidence.scriptedActions = {
      shelter_enforcer_north: SHELTER_ENFORCER_SURVIVAL_SCRIPT,
      hostile_witness_north: FALSE_TESTIMONY_SURVIVAL_SCRIPT,
      archive_censor_alpha: FALSE_TESTIMONY_SURVIVAL_SCRIPT,
      perjury_hound_omega: FALSE_TESTIMONY_SURVIVAL_SCRIPT,
      hostile_witness: FALSE_TESTIMONY_SURVIVAL_SCRIPT,
      soul_recharge_verdict: FALSE_TESTIMONY_SURVIVAL_SCRIPT,
      false_testimony_judge: FALSE_TESTIMONY_BOSS_SURVIVAL_SCRIPT
    };
    routeEvidence.methodTechniqueNodeId = 'false_testimony_judge';
    routeEvidence.companionAssistNodeId = 'false_testimony_judge';
    routeEvidence.bloodlineSurgeNodeId = 'false_testimony_judge';
    routeEvidence.soulSkipNodeId = 'false_testimony_judge';
    routeEvidence.reserveWeaponSkillForNodeId = 'false_testimony_judge';
  }
  if (dungeonId === 'combat_replay_stage') {
    routeEvidence.scriptedActions = {
      take_alpha: COMBAT_REPLAY_TAKE_ALPHA_SCRIPT,
      take_beta: COMBAT_REPLAY_TAKE_BETA_SCRIPT,
      take_gamma: COMBAT_REPLAY_TAKE_GAMMA_SCRIPT,
      final_cut_director: COMBAT_REPLAY_BOSS_SURVIVAL_SCRIPT
    };
    routeEvidence.methodTechniqueNodeId = 'final_cut_director';
    routeEvidence.companionAssistNodeId = 'final_cut_director';
    routeEvidence.bloodlineSurgeNodeId = 'final_cut_director';
    routeEvidence.soulSkipNodeId = 'final_cut_director';
    routeEvidence.reserveWeaponSkillForNodeId = 'final_cut_director';
  }
  if (dungeonId === 'panopticon_city') {
    routeEvidence.scriptedActions = {
      sweep_sentinel_north: Array.from(
        { length: MAX_COMBAT_ACTIONS },
        (_, index) => (['guard', 'art', 'attack', 'weapon_skill'] as const)[index % 4]
      ),
      all_sight_warden: Array.from(
        { length: MAX_COMBAT_ACTIONS },
        (_, index) => (['guard', 'art', 'attack', 'weapon_skill', 'use_healing_pill'] as const)[index % 5]
      )
    };
    routeEvidence.methodTechniqueNodeId = 'all_sight_warden';
    routeEvidence.companionAssistNodeId = 'all_sight_warden';
    routeEvidence.bloodlineSurgeNodeId = 'all_sight_warden';
    routeEvidence.reserveWeaponSkillForNodeId = 'all_sight_warden';
  }
  if (
    dungeonId === 'entropy_ark' ||
    dungeonId === 'mirror_cycle_city' ||
    dungeonId === 'redaction_scriptorium' ||
    dungeonId === 'legacy_auction_court' ||
    dungeonId === 'genesis_vault' ||
    dungeonId === 'silent_broadcast_tower' ||
    dungeonId === 'lost_shelter' ||
    dungeonId === 'false_testimony_court' ||
    dungeonId === 'combat_replay_stage' ||
    dungeonId === 'panopticon_city'
  ) {
    routeEvidence.prioritizeHealing = true;
    routeEvidence.healingTargetRatio = dungeonId === 'lost_shelter' ? 0.65 : 0.95;
  }
  const plannedNodeIds = dungeonId === 'combat_replay_stage'
    ? ['take_alpha', 'take_beta', 'take_gamma']
    : STANDARD_ROUTE_PREPARATION_NODES[dungeonId] ?? [];
  const inventoryTargets: Partial<Record<TacticalItemId, number>> =
    dungeonId === 'genesis_vault'
      ? { healing_pill: 128, dispel_talisman: 16, armor_patch: 16, focus_incense: 16 }
      : dungeonId === 'lost_shelter'
      ? { healing_pill: 128, thunder_talisman: 32, armor_patch: 16 }
      : dungeonId === 'silent_broadcast_tower' ||
        dungeonId === 'false_testimony_court' ||
        dungeonId === 'combat_replay_stage' ||
        dungeonId === 'panopticon_city'
      ? { healing_pill: 128, dispel_talisman: 16, armor_patch: 16, focus_incense: 16 }
      : dungeonId === 'legacy_auction_court'
      ? { healing_pill: 128, focus_incense: 16, armor_patch: 20 }
      : dungeonId === 'redaction_scriptorium'
      ? { healing_pill: 64, dispel_talisman: 16, armor_patch: 16 }
      : dungeonId === 'mirror_cycle_city'
      ? { healing_pill: 64, gate_sigil: 16, armor_patch: 16 }
      : dungeonId === 'entropy_ark'
      ? { healing_pill: 32, thunder_talisman: 32, armor_patch: 32 }
      : dungeonId === 'temporal_observatory'
      ? { healing_pill: 32, focus_incense: 2 }
      : dungeonId === 'void_citadel'
      ? { healing_pill: 24, focus_incense: 1 }
      : { healing_pill: 8 };
  let entered = enterPreparedDungeon(state, dungeonId, routeEvidence, {
    plannedNodeIds,
    methodTechnique:
      dungeonId === 'legacy_auction_court' ||
      dungeonId === 'genesis_vault' ||
      dungeonId === 'silent_broadcast_tower' ||
      dungeonId === 'lost_shelter' ||
      dungeonId === 'combat_replay_stage' ||
      dungeonId === 'panopticon_city'
        ? 'live'
        : undefined,
    additionalTacticalItemIds:
      dungeonId === 'genesis_vault'
        ? ['healing_pill', 'armor_patch']
        : dungeonId === 'lost_shelter'
        ? ['healing_pill', 'armor_patch', 'thunder_talisman']
        : dungeonId === 'silent_broadcast_tower' ||
          dungeonId === 'combat_replay_stage' ||
          dungeonId === 'panopticon_city'
        ? ['healing_pill', 'dispel_talisman', 'armor_patch', 'focus_incense']
        : dungeonId === 'legacy_auction_court'
        ? ['armor_patch', 'healing_pill', 'focus_incense']
        : dungeonId === 'redaction_scriptorium'
        ? ['healing_pill', 'dispel_talisman', 'armor_patch']
        : dungeonId === 'mirror_cycle_city'
        ? ['healing_pill', 'gate_sigil', 'armor_patch']
        : dungeonId === 'entropy_ark'
        ? ['healing_pill', 'thunder_talisman', 'armor_patch']
        : [],
    inventoryTargets
  });
  // Explicit preparation nodes are part of the real route, not only loadout hints.
  for (const nodeId of plannedNodeIds) {
    entered = moveAlongRoutePath(entered, nodeId, routeEvidence, {
      auctionLotChoices: dungeonId === 'legacy_auction_court'
        ? CAMPAIGN_AUCTION_LOT_CHOICES
        : undefined,
      broadcastRelayChoices: dungeonId === 'silent_broadcast_tower'
        ? STANDARD_BROADCAST_RELAY_CHOICES
        : undefined,
      panopticonRoute: dungeonId === 'panopticon_city' ? 'shadow' : undefined
    });
  }
  if (dungeonId === 'combat_replay_stage') {
    entered = selectCombatReplayRoute(entered, 'sequence');
    if (entered.run?.combatReplayState?.route !== 'sequence') {
      throw new BalanceSimulationError('Combat replay route selection did not lock the conservative sequence route.');
    }
  }
  if (dungeonId === 'false_testimony_court') {
    const verdictStatus = getFalseTestimonyGameApi().getCurrentVerdictStatus(entered);
    if (
      verdictStatus?.accusationCorrect === true &&
      verdictStatus.accusationTrustedCount === 3 &&
      !verdictStatus.appealUsed
    ) {
      entered = moveAlongRoutePath(entered, 'truth_archive', routeEvidence);
    }
  }
  if (dungeonId === 'panopticon_city') {
    const status = getCurrentPanopticonStatus(entered);
    if (status?.completedRelayCount !== 3 || status.route !== 'shadow' || !status.readyForBoss) {
      throw new BalanceSimulationError('Panopticon campaign route did not lock all relays and the conservative shadow route.');
    }
  }
  const rewarded = collectRouteRewards(entered, dungeonId, routeEvidence);
  assertBossSealCleared(rewarded, dungeonId, 'before exit resolution');

  if (rewarded.run?.pendingEquipmentOffer) {
    throw getDangerResolutionError(
      rewarded,
      rewarded.run.currentNodeId,
      'boss equipment offer remained unresolved before exit resolution'
    );
  }

  const settled = resolvePendingRunRelicArchive(resolveExit(rewarded));
  if (!settled.completedDungeonIds.includes(dungeonId)) {
    assertBossSealCleared(settled, dungeonId, 'after exit resolution');
    throw new BalanceSimulationError(
      `Balance simulation failed in ${dungeonId}: exit resolution did not complete the dungeon ` +
        `after its boss seal was cleared (lastLog=${settled.log[0] ?? 'none'}).`
    );
  }

  return settled;
}

function prepareGenesisVaultCampaignThroughTierOnePortal(state: GameState): GameState {
  const currentRank = state.bloodlineRanks.bastion_chitin;
  if (currentRank === 3) return state;
  const targetRank = currentRank === 2 ? 3 : 2;
  const genesisCompletedBefore = state.completedDungeonIds.includes('genesis_vault');
  const genesisMainlineClaimedBefore = state.claimedTaskIds.includes('mainline_clear_genesis_vault');
  const broadcastCompletedBefore = state.completedDungeonIds.includes('silent_broadcast_tower');
  const broadcastMainlineClaimedBefore = state.claimedTaskIds.includes('mainline_clear_silent_broadcast_tower');
  const shelterCompletedBefore = state.completedDungeonIds.includes('lost_shelter');
  const shelterMainlineClaimedBefore = state.claimedTaskIds.includes('mainline_clear_lost_shelter');
  const evidence = createRouteCombatEvidence({ prioritizeHealing: true, healingTargetRatio: 0.9 });
  const entered = enterPreparedDungeon(state, 'genesis_vault', evidence, {
    plannedNodeIds: ['first_splice_console', 'second_splice_console', 'upper_genesis_portal'],
    portalUseNodeIds: ['upper_genesis_portal'],
    additionalTacticalItemIds: ['gate_sigil', 'armor_patch', 'dispel_talisman'],
    inventoryTargets: { gate_sigil: 2, armor_patch: 4, dispel_talisman: 4 },
    methodTechnique: 'live'
  });
  let atPortal = moveAlongRoutePath(entered, 'first_splice_console', evidence, {
    genesisSpliceSequence: STANDARD_GENESIS_SPLICE_SEQUENCE,
    skipGenesisPreparation: true
  });
  atPortal = moveAlongRoutePath(atPortal, 'second_splice_console', evidence, {
    genesisSpliceSequence: STANDARD_GENESIS_SPLICE_SEQUENCE,
    skipGenesisPreparation: true
  });
  atPortal = moveAlongRoutePath(atPortal, 'upper_genesis_portal', evidence, {
    genesisSpliceSequence: STANDARD_GENESIS_SPLICE_SEQUENCE,
    resolveTargetDanger: false,
    collectTargetReward: false,
    skipGenesisPreparation: true
  });
  const statusBeforePortal = getCurrentGenesisSpliceStatus(atPortal);
  if (
    atPortal.run?.currentNodeId !== 'upper_genesis_portal' ||
    statusBeforePortal?.spliceSequence.length !== 2 ||
    (atPortal.run.lootBag.items.genesis_serum ?? 0) < 1
  ) {
    throw new BalanceSimulationError('Tier 14 portal preparation did not use the real two-console run route.');
  }

  const thirdSplice = moveAlongRoutePath(atPortal, 'third_splice_console', evidence, {
    genesisSpliceSequence: STANDARD_GENESIS_SPLICE_SEQUENCE,
    skipGenesisPreparation: true
  });
  const replayExitReady = collectRouteRewards(thirdSplice, 'genesis_vault', evidence);
  const settled = resolvePendingRunRelicArchive(resolveExit(replayExitReady));
  const hub = restoreSimulationHealth(returnToHub(settled));
  if (
    hub.completedDungeonIds.includes('genesis_vault') !== genesisCompletedBefore ||
    hub.claimedTaskIds.includes('mainline_clear_genesis_vault') !== genesisMainlineClaimedBefore ||
    hub.completedDungeonIds.includes('silent_broadcast_tower') !== broadcastCompletedBefore ||
    hub.claimedTaskIds.includes('mainline_clear_silent_broadcast_tower') !== broadcastMainlineClaimedBefore ||
    hub.completedDungeonIds.includes('lost_shelter') !== shelterCompletedBefore ||
    hub.claimedTaskIds.includes('mainline_clear_lost_shelter') !== shelterMainlineClaimedBefore
  ) {
    throw new BalanceSimulationError('Tier 14/Tier 15/Tier 16 portal ring incorrectly changed chapter mainline completion.');
  }

  const upgraded = upgradeBloodline(hub, 'bastion_chitin');
  if (upgraded.bloodlineRanks.bastion_chitin !== targetRank || upgraded.activeBloodline !== 'bastion_chitin') {
    throw new BalanceSimulationError(
      `Tier 14 portal route did not bank current-run serum for the R${targetRank} bloodline upgrade.`
    );
  }
  const restored = restoreSimulationHealth(upgraded);
  if (targetRank === 2) return prepareGenesisVaultCampaignThroughTierOnePortal(restored);

  let geared = restored;
  for (const [equipmentId, attunementId] of [
    ['symbiote_cowl', 'mist_veilguard'],
    ['final_lot_bell', 'chronal_acceleration']
  ] as const) {
    geared = buyEquipment(geared, equipmentId);
    if (!geared.ownedEquipment.includes(equipmentId)) {
      throw new BalanceSimulationError(`Tier 14 portal route could not buy ${equipmentId}.`);
    }
    while ((geared.equipmentLevels[equipmentId] ?? 1) < EQUIPMENT[equipmentId].maxLevel) {
      const beforeLevel = geared.equipmentLevels[equipmentId] ?? 1;
      geared = upgradeEquipment(geared, equipmentId);
      if ((geared.equipmentLevels[equipmentId] ?? 1) === beforeLevel) {
        throw new BalanceSimulationError(`Tier 14 portal route could not max ${equipmentId}.`);
      }
    }
    geared = attuneEquipment(geared, equipmentId, attunementId);
    while ((geared.equipmentTemperRanks?.[equipmentId] ?? 0) < 2) {
      const beforeRank = geared.equipmentTemperRanks?.[equipmentId] ?? 0;
      geared = temperEquipment(geared, equipmentId);
      if ((geared.equipmentTemperRanks?.[equipmentId] ?? 0) === beforeRank) {
        throw new BalanceSimulationError(`Tier 14 portal route could not temper ${equipmentId} to rank II.`);
      }
    }
    geared = equipEquipment(geared, equipmentId);
  }
  return restoreSimulationHealth(geared);
}

function claimMainlineAfterClear(state: GameState, dungeonId: DungeonId): GameState {
  return claimTaskReward(state, `mainline_clear_${dungeonId}`);
}

function claimChapterTaskRewardsAfterClear(state: GameState, dungeonId: DungeonId): GameState {
  return claimTaskReward(
    claimTaskReward(claimMainlineAfterClear(state, dungeonId), `side_enter_${dungeonId}`),
    `side_directive_${dungeonId}`
  );
}

function applyCustomStageReward(settled: GameState, beforeClear: GameState, reward: RewardBundle): GameState {
  const rewarded = grantReward(beforeClear, reward);

  return {
    ...settled,
    rewardPoints: rewarded.rewardPoints,
    lingyun: rewarded.lingyun,
    inventory: rewarded.inventory
  };
}

function getRouteGrowthSignals(before: GameState, after: GameState): string[] {
  const signals: string[] = [];

  if (getPlayerPower(after) > getPlayerPower(before)) signals.push('power');
  if (after.rewardPoints > before.rewardPoints || after.lingyun > before.lingyun) signals.push('resources');
  if (after.learnedMethods.length > before.learnedMethods.length) signals.push('methods');
  if (after.ownedEquipment.length > before.ownedEquipment.length) signals.push('equipment');
  if (after.ownedPets.length > before.ownedPets.length) signals.push('pets');
  if (after.completedDungeonIds.length > before.completedDungeonIds.length) signals.push('campaign-clear');

  return signals;
}

function restoreSimulationHealth(state: GameState): GameState {
  const maxHp = getDerivedStats(state).maxHp;
  return { ...state, player: { ...state.player, hp: maxHp, maxHp } };
}

function prepareGenesisRepeatHubState(state: GameState): GameState {
  let nextState = state.phase === 'hub' ? state : returnToHub(state);
  nextState = {
    ...nextState,
    rewardPoints: Math.max(nextState.rewardPoints, 100_000),
    lingyun: Math.max(nextState.lingyun, 100),
    inventory: {
      ...nextState.inventory,
      medicine_ash: Math.max(nextState.inventory.medicine_ash, 8),
      method_page: Math.max(nextState.inventory.method_page, 8)
    }
  };
  nextState = unlockBloodline(nextState, 'bastion_chitin');
  nextState = activateBloodline(nextState, 'bastion_chitin');
  nextState = learnMethod(nextState, 'iron_body');
  nextState = upgradeMethod(upgradeMethod(nextState, 'iron_body'), 'iron_body');
  nextState = activateMethod(nextState, 'iron_body');
  nextState = recruitCompanion(nextState, 'lu_guanlan');
  nextState = upgradeCompanion(upgradeCompanion(nextState, 'lu_guanlan'), 'lu_guanlan');
  nextState = activateCompanion(nextState, 'lu_guanlan');
  const normalizedBloodlines = normalizeBloodlineProgress({
    rulesVersion: BLOODLINE_RULES_VERSION,
    ranks: nextState.bloodlineRanks,
    ...(nextState.activeBloodline === undefined ? {} : { active: nextState.activeBloodline })
  });
  const bastionRank = normalizedBloodlines.ranks.bastion_chitin ?? 0;
  if (
    bastionRank < 1 ||
    nextState.activeBloodline !== 'bastion_chitin' ||
    nextState.activeMethod !== 'iron_body' ||
    nextState.activeCompanion !== 'lu_guanlan'
  ) {
    throw new BalanceSimulationError('Genesis repeat fixture could not prepare its bloodline, method, and companion.');
  }
  return restoreSimulationHealth(nextState);
}

function getRouteLegalityEvidence(evidence: RouteCombatEvidence): RouteLegalityEvidence {
  return {
    gateChecks: structuredClone(evidence.routeGateChecks),
    movements: structuredClone(evidence.routeMovements),
    headingChoiceTrace: structuredClone(evidence.headingChoiceTrace),
    mirrorPhaseChoiceTrace: structuredClone(evidence.mirrorPhaseChoiceTrace),
    auctionLotChoiceTrace: structuredClone(evidence.auctionLotChoiceTrace),
    genesisSpliceChoiceTrace: structuredClone(evidence.genesisSpliceChoiceTrace),
    broadcastRelayChoiceTrace: structuredClone(evidence.broadcastRelayChoiceTrace),
    escortCheckpointChoiceTrace: structuredClone(evidence.escortCheckpointChoiceTrace),
    falseTestimonyAccusationTrace: structuredClone(evidence.falseTestimonyAccusationTrace),
    ...(evidence.broadcastEntryPassives
      ? { broadcastEntryPassives: structuredClone(evidence.broadcastEntryPassives) }
      : {}),
    tacticalLoadoutTrace: structuredClone(evidence.tacticalLoadoutTrace),
    trapChoiceTrace: structuredClone(evidence.trapChoiceTrace),
    portalChoiceTrace: structuredClone(evidence.portalChoiceTrace),
    routeSectorTrace: structuredClone(evidence.routeSectorTrace),
    relicDraftTrace: structuredClone(evidence.relicDraftTrace),
    relicRewardTrace: structuredClone(evidence.relicRewardTrace)
  };
}

type LawRouteExecution = {
  settledState: GameState;
  evidence: RouteCombatEvidence;
  modifierEvidence: DungeonLawModifierEvidence[];
};

function prepareLawRouteState(
  baseState: GameState,
  dungeonId: DungeonId,
  additionalItemCounts: Partial<Record<keyof GameState['inventory'], number>> = {}
): GameState {
  let state = structuredClone(baseState);
  if (state.phase !== 'hub') state = returnToHub(state);
  if (dungeonId === 'causal_clearinghouse') state = prepareCausalLedgerRouteState(state);
  if (dungeonId === 'entropy_ark') state = prepareEntropyArkRouteState(state);
  if (dungeonId === 'mirror_cycle_city') {
    state = prepareMirrorCycleCityRouteState(state, [
      'parallax_visor',
      'phaseweave_mantle',
      'homecoming_prism'
    ]);
  }
  if (dungeonId === 'redaction_scriptorium') state = prepareRedactionScriptoriumCombatState(state);
  if (dungeonId === 'legacy_auction_court') {
    state = {
      ...state,
      player: {
        ...state.player,
        base: {
          ...state.player.base,
          body: Math.max(state.player.base.body, 64),
          spirit: Math.max(state.player.base.spirit, 48)
        }
      }
    };
  }
  state = restoreSimulationHealth(state);
  state = {
    ...state,
    rewardPoints: Math.max(state.rewardPoints, 10_000),
    inventory: {
      ...state.inventory,
      cracked_core: Math.max(state.inventory.cracked_core, 64),
      chronal_glass: Math.max(state.inventory.chronal_glass, 64),
      cycle_imprint: Math.max(state.inventory.cycle_imprint, 32),
      causal_seal: Math.max(state.inventory.causal_seal, 64),
      phase_glass: Math.max(state.inventory.phase_glass, 64),
      rift_dust: Math.max(state.inventory.rift_dust, 64),
      star_iron: Math.max(state.inventory.star_iron, 64)
    }
  };
  if (dungeonId === 'genesis_vault') {
    state = unlockBloodline(state, 'bastion_chitin');
    state = activateBloodline(state, 'bastion_chitin');
    if (state.bloodlineRanks.bastion_chitin === undefined || state.activeBloodline !== 'bastion_chitin') {
      throw new BalanceSimulationError('Genesis law route could not prepare an active bloodline through the hub API.');
    }
  }

  const counterItemCounts = new Map<keyof GameState['inventory'], number>();
  for (const node of DUNGEONS[dungeonId].nodes) {
    const counterItem = node.trap?.counterItem;
    if (counterItem) counterItemCounts.set(counterItem, (counterItemCounts.get(counterItem) ?? 0) + 1);
  }

  for (const [counterItem, count] of counterItemCounts) {
    const targetCount = count + (additionalItemCounts[counterItem] ?? 0);
    while (state.inventory[counterItem] < targetCount) {
      const beforeCount = state.inventory[counterItem];
      state = buyItem(state, counterItem);
      if (state.inventory[counterItem] === beforeCount) {
        throw new BalanceSimulationError(`Unable to buy ${counterItem} for the ${dungeonId} law route.`);
      }
    }
  }

  const healingPillTarget =
    dungeonId === 'temporal_observatory' || dungeonId === 'void_citadel' ? 48 : 8;
  while (state.inventory.healing_pill < healingPillTarget) {
    const beforeCount = state.inventory.healing_pill;
    state = buyItem(state, 'healing_pill');
    if (state.inventory.healing_pill === beforeCount) {
      throw new BalanceSimulationError(`Unable to buy healing_pill for the ${dungeonId} law route.`);
    }
  }

  return state;
}

function startLawRoute(
  baseState: GameState,
  dungeonId: DungeonId,
  scriptedActions: RouteCombatEvidence['scriptedActions'] = {},
  additionalItemCounts: Partial<Record<keyof GameState['inventory'], number>> = {}
): { state: GameState; evidence: RouteCombatEvidence; modifierEvidence: DungeonLawModifierEvidence[] } {
  const evidence = createRouteCombatEvidence({
    prioritizeHealing: true,
    visitedNodeIds: [],
    scriptedActions,
    combatProfiles: [],
    combatActions: [],
    lawStatuses: []
  });
  const preparedState = prepareLawRouteState(baseState, dungeonId, additionalItemCounts);
  const equippedState =
    dungeonId === 'combat_replay_stage'
      ? prepareCombatReplayProtocolBuild(preparedState, 'standard', 10)
      : dungeonId === 'temporal_observatory'
      ? prepareTemporalRouteEquipment(preparedState)
      : preparedState;
  const state = enterPreparedDungeon(
    equippedState,
    dungeonId,
    evidence,
    {
      plannedNodeIds: LAW_ROUTE_PLANNED_NODES[dungeonId],
      additionalTacticalItemIds:
        dungeonId === 'demon_tower_1'
          ? ['dispel_talisman']
          : dungeonId === 'rust_hospital'
            ? ['focus_incense']
            : dungeonId === 'temporal_observatory'
              ? ['focus_incense']
              : dungeonId === 'causal_clearinghouse'
                ? ['focus_incense', 'gate_sigil', 'dispel_talisman', 'healing_pill']
              : dungeonId === 'redaction_scriptorium'
                ? ['healing_pill', 'dispel_talisman', 'armor_patch']
              : dungeonId === 'legacy_auction_court'
                ? ['healing_pill', 'focus_incense', 'armor_patch']
              : dungeonId === 'combat_replay_stage'
                ? ['healing_pill', 'dispel_talisman', 'armor_patch']
              : dungeonId === 'panopticon_city'
                ? ['healing_pill', 'focus_incense', 'armor_patch']
              : []
    }
  );
  evidence.visitedNodeIds?.push(state.run!.currentNodeId);
  recordDungeonLawStatus(state, evidence, 'entry');
  if (
    dungeonId !== 'mirror_cycle_city' &&
    dungeonId !== 'redaction_scriptorium' &&
    dungeonId !== 'legacy_auction_court' &&
    dungeonId !== 'genesis_vault' &&
    dungeonId !== 'silent_broadcast_tower' &&
    dungeonId !== 'lost_shelter' &&
    dungeonId !== 'false_testimony_court' &&
    dungeonId !== 'combat_replay_stage' &&
    dungeonId !== 'panopticon_city'
  ) {
    findAdjacentRoutePath(state, getBossDefinition(dungeonId).nodeId, evidence);
  }

  return { state, evidence, modifierEvidence: [] };
}

function prepareCausalLedgerRouteState(baseState: GameState): GameState {
  let state = structuredClone(baseState);
  if (state.phase !== 'hub') state = returnToHub(state);
  state = {
    ...state,
    rewardPoints: Math.max(state.rewardPoints, 100_000),
    lingyun: Math.max(state.lingyun, 100),
    inventory: {
      ...state.inventory,
      causal_seal: Math.max(state.inventory.causal_seal, 64),
      chronal_glass: Math.max(state.inventory.chronal_glass, 64),
      rift_dust: Math.max(state.inventory.rift_dust, 64),
      star_iron: Math.max(state.inventory.star_iron, 64)
    }
  };

  for (const equipmentId of ['causal_visor', 'echo_breaker_gauntlets', 'return_anchor_belt'] as const) {
    if (!state.ownedEquipment.includes(equipmentId)) state = buyEquipment(state, equipmentId);
    if (!state.ownedEquipment.includes(equipmentId)) {
      throw new BalanceSimulationError(`Unable to buy ${equipmentId} for the causal ledger route.`);
    }
    while ((state.equipmentLevels[equipmentId] ?? 1) < EQUIPMENT[equipmentId].maxLevel) {
      const beforeLevel = state.equipmentLevels[equipmentId] ?? 1;
      state = upgradeEquipment(state, equipmentId);
      if ((state.equipmentLevels[equipmentId] ?? 1) === beforeLevel) {
        throw new BalanceSimulationError(`Unable to upgrade ${equipmentId} for the causal ledger route.`);
      }
    }
    state = equipEquipment(state, equipmentId);
  }

  const maxHp = getDerivedStats(state).maxHp;
  return { ...state, player: { ...state.player, hp: maxHp, maxHp } };
}

function prepareEntropyArkRouteState(baseState: GameState): GameState {
  let state = structuredClone(baseState);
  if (state.phase !== 'hub') state = returnToHub(state);
  state = {
    ...state,
    rewardPoints: Math.max(state.rewardPoints, 100_000),
    lingyun: Math.max(state.lingyun, 100),
    inventory: {
      ...state.inventory,
      entropy_crystal: Math.max(state.inventory.entropy_crystal, 64),
      chronal_glass: Math.max(state.inventory.chronal_glass, 64),
      rift_dust: Math.max(state.inventory.rift_dust, 64),
      star_iron: Math.max(state.inventory.star_iron, 64)
    }
  };

  for (const [equipmentId, attunementId] of [
    ['chronal_edge', 'chronal_acceleration'],
    ['causal_visor', 'chronal_acceleration'],
    ['entropy_compass', 'chronal_acceleration'],
    ['echo_breaker_gauntlets', 'rift_resonance'],
    ['dissipation_mantle', 'rift_resonance'],
    ['return_anchor_belt', 'forge_overdrive'],
    ['ark_keel_boots', 'forge_overdrive']
  ] as const) {
    if (!state.ownedEquipment.includes(equipmentId)) state = buyEquipment(state, equipmentId);
    if (!state.ownedEquipment.includes(equipmentId)) {
      throw new BalanceSimulationError(`Unable to buy ${equipmentId} for the entropy ark route.`);
    }
    while ((state.equipmentLevels[equipmentId] ?? 1) < EQUIPMENT[equipmentId].maxLevel) {
      const beforeLevel = state.equipmentLevels[equipmentId] ?? 1;
      state = upgradeEquipment(state, equipmentId);
      if ((state.equipmentLevels[equipmentId] ?? 1) === beforeLevel) {
        throw new BalanceSimulationError(`Unable to upgrade ${equipmentId} for the entropy ark route.`);
      }
    }
    state = attuneEquipment(state, equipmentId, attunementId);
    if (state.equipmentAttunements?.[equipmentId] !== attunementId) {
      throw new BalanceSimulationError(`Unable to attune ${equipmentId} for the entropy ark route.`);
    }
    while ((state.equipmentTemperRanks?.[equipmentId] ?? 0) < 2) {
      const beforeRank = state.equipmentTemperRanks?.[equipmentId] ?? 0;
      state = temperEquipment(state, equipmentId);
      if ((state.equipmentTemperRanks?.[equipmentId] ?? 0) === beforeRank) {
        throw new BalanceSimulationError(`Unable to temper ${equipmentId} for the entropy ark route.`);
      }
    }
    state = equipEquipment(state, equipmentId);
    if (state.equipped[EQUIPMENT[equipmentId].slot] !== equipmentId) {
      throw new BalanceSimulationError(`Unable to equip ${equipmentId} for the entropy ark route.`);
    }
  }

  const maxHp = getDerivedStats(state).maxHp;
  return { ...state, player: { ...state.player, hp: maxHp, maxHp } };
}

function prepareMirrorCycleCityRouteState(
  baseState: GameState,
  equipmentIds: readonly EquipmentId[] = []
): GameState {
  let state = structuredClone(baseState);
  if (state.phase !== 'hub') state = returnToHub(state);
  state = {
    ...state,
    rewardPoints: Math.max(state.rewardPoints, 100_000),
    lingyun: Math.max(state.lingyun, 100),
    inventory: {
      ...state.inventory,
      phase_glass: Math.max(state.inventory.phase_glass, 64),
      chronal_glass: Math.max(state.inventory.chronal_glass, 64),
      rift_dust: Math.max(state.inventory.rift_dust, 64),
      star_iron: Math.max(state.inventory.star_iron, 64)
    },
    player: {
      ...state.player,
      base: {
        ...state.player.base,
        body: Math.max(state.player.base.body, 80),
        spirit: Math.max(state.player.base.spirit, 64)
      }
    }
  };

  for (const equipmentId of equipmentIds) {
    if (!state.ownedEquipment.includes(equipmentId)) state = buyEquipment(state, equipmentId);
    if (!state.ownedEquipment.includes(equipmentId)) {
      throw new BalanceSimulationError(`Unable to buy ${equipmentId} for the mirror-cycle route.`);
    }
    while ((state.equipmentLevels[equipmentId] ?? 1) < EQUIPMENT[equipmentId].maxLevel) {
      const beforeLevel = state.equipmentLevels[equipmentId] ?? 1;
      state = upgradeEquipment(state, equipmentId);
      if ((state.equipmentLevels[equipmentId] ?? 1) === beforeLevel) {
        throw new BalanceSimulationError(`Unable to upgrade ${equipmentId} for the mirror-cycle route.`);
      }
    }
    while ((state.equipmentTemperRanks?.[equipmentId] ?? 0) < 1) {
      const beforeRank = state.equipmentTemperRanks?.[equipmentId] ?? 0;
      state = temperEquipment(state, equipmentId);
      if ((state.equipmentTemperRanks?.[equipmentId] ?? 0) === beforeRank) {
        throw new BalanceSimulationError(`Unable to temper ${equipmentId} for the mirror-cycle route.`);
      }
    }
    state = equipEquipment(state, equipmentId);
    if (state.equipped[EQUIPMENT[equipmentId].slot] !== equipmentId) {
      throw new BalanceSimulationError(`Unable to equip ${equipmentId} for the mirror-cycle route.`);
    }
  }

  const maxHp = getDerivedStats(state).maxHp;
  return { ...state, player: { ...state.player, hp: maxHp, maxHp } };
}

const REDACTION_COMBAT_EQUIPMENT_IDS = [
  'chronal_edge',
  'parallax_visor',
  'phaseweave_mantle',
  'echo_breaker_gauntlets',
  'ark_keel_boots',
  'return_anchor_belt',
  'homecoming_prism'
] as const satisfies readonly EquipmentId[];

function prepareRedactionScriptoriumCombatState(
  baseState: GameState,
  preservedEquipmentId?: EquipmentId
): GameState {
  const preservedSlot = preservedEquipmentId ? EQUIPMENT[preservedEquipmentId].slot : undefined;
  const equipmentIds = REDACTION_COMBAT_EQUIPMENT_IDS.filter(
    (equipmentId) => EQUIPMENT[equipmentId].slot !== preservedSlot
  );
  return prepareMirrorCycleCityRouteState({
    ...baseState,
    inventory: {
      ...baseState.inventory,
      causal_seal: Math.max(baseState.inventory.causal_seal, 64),
      entropy_crystal: Math.max(baseState.inventory.entropy_crystal, 64)
    }
  }, equipmentIds);
}

function simulateEntropyArkLawRoute(baseState: GameState): LawRouteExecution {
  const route = startLawRoute(
    prepareEntropyArkRouteState(baseState),
    'entropy_ark',
    {
      dissipation_navigator_alpha: ['attack', 'art', 'guard'],
      last_helmsman: ['attack', 'art', 'guard']
    }
  );
  let state = moveAlongRoutePath(route.state, 'entropy_deckhand', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'pre-bow-danger');
  state = moveAlongRoutePath(state, 'dissipation_navigator_alpha', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'pre-bow-entropy-rise');
  state = moveAlongRoutePath(state, 'bow_heading_console', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'bow-heading-pending');
  state = moveAlongRoutePath(state, 'dissipation_navigator_alpha', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'bow-low-entropy-lane');
  const lowEntropy = getRequiredLaw(state);

  state = moveAlongRoutePath(state, 'entropy_deckhand_starboard', route.evidence);
  state = moveAlongRoutePath(state, 'dissipation_navigator_omega', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'pre-midship-entropy-rise');
  state = moveAlongRoutePath(state, 'midship_heading_console', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'midship-heading-pending');
  state = moveAlongRoutePath(state, 'starboard_relic_hold', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'midship-high-entropy-lane');
  const highEntropy = getRequiredLaw(state);

  state = moveAlongRoutePath(state, 'stern_heading_console', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'stern-heading-pending');
  state = moveAlongRoutePath(state, 'ark_manifest', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'boss-heading-stabilized');
  const beforeBoss = getRequiredLaw(state);
  const settledState = settleLawRoute(state, 'entropy_ark', route.evidence);
  const bossLaw = getRequiredLaw(settledState);
  const beforeData = beforeBoss.state.law.kind === 'entropy_ark' ? beforeBoss.state.law : undefined;
  const bossData = bossLaw.state.law.kind === 'entropy_ark' ? bossLaw.state.law : undefined;
  route.modifierEvidence.push(
    {
      metric: 'entropy',
      before: lowEntropy.state.law.kind === 'entropy_ark' ? lowEntropy.state.law.entropy : -1,
      after: highEntropy.state.law.kind === 'entropy_ark' ? highEntropy.state.law.entropy : -1,
      beforeCheckpoint: 'bow-low-entropy-lane',
      afterCheckpoint: 'midship-high-entropy-lane'
    },
    {
      metric: 'bossEntropyLocked',
      before: beforeData?.bossEntropyLocked ?? false,
      after: bossData?.bossEntropyLocked ?? false,
      beforeCheckpoint: 'boss-heading-stabilized',
      afterCheckpoint: 'combat:last_helmsman'
    },
    {
      metric: 'collapseLayers',
      before: beforeData?.collapseLayers ?? 0,
      after: bossData?.collapseLayers ?? 0,
      beforeCheckpoint: 'boss-heading-stabilized',
      afterCheckpoint: 'combat:last_helmsman'
    }
  );

  return { settledState, evidence: route.evidence, modifierEvidence: route.modifierEvidence };
}

function simulateCausalLawRoute(baseState: GameState): LawRouteExecution {
  const preparedState = prepareCausalLedgerRouteState(baseState);
  const route = startLawRoute(
    preparedState,
    'causal_clearinghouse',
    {
      paradox_bailiff_alpha: ['attack', 'art', 'guard'],
      verdict_usher: ['attack', 'art', 'guard'],
      effect_bailiff: ['attack', 'art', 'guard'],
      zero_sum_auditor: ['attack', 'art', 'guard']
    },
    { armor_patch: 4 }
  );
  let state = route.state;
  const entry = getCurrentCausalLedgerStatus(state);
  if (!entry || entry.pending || entry.bossDebtLocked) {
    throw new BalanceSimulationError('Causal ledger route did not start with an open ledger.');
  }

  state = moveAlongRoutePath(state, 'verdict_usher', route.evidence, { causalLedgerChoice: 'overdraw' });
  recordDungeonLawStatus(state, route.evidence, 'ledger-visor-credit');
  state = moveAlongRoutePath(state, 'cause_bailiff', route.evidence, { causalLedgerChoice: 'overdraw' });
  recordDungeonLawStatus(state, route.evidence, 'ledger-debt-one');
  state = moveAlongRoutePath(state, 'effect_bailiff', route.evidence, { causalLedgerChoice: 'overdraw' });
  recordDungeonLawStatus(state, route.evidence, 'ledger-debt-two');

  state = moveAlongRoutePath(state, 'cause_deposition', route.evidence);
  state = moveAlongRoutePath(state, 'effect_deposition', route.evidence);
  const debtBeforeBoss = getCurrentCausalLedgerStatus(state);
  if (!debtBeforeBoss || debtBeforeBoss.pending || debtBeforeBoss.bossDebtLocked || debtBeforeBoss.debt < 2) {
    throw new BalanceSimulationError('Causal ledger route did not accumulate debt before the boss.');
  }
  route.modifierEvidence.push({
    metric: 'causalDebt',
    before: entry.debt,
    after: debtBeforeBoss.debt,
    beforeCheckpoint: 'entry',
    afterCheckpoint: 'ledger-debt-two'
  });

  const bossNodeId = getBossDefinition('causal_clearinghouse').nodeId;
  state = moveAlongRoutePath(state, bossNodeId, route.evidence, { resolveTargetDanger: false });
  const started = selectNode(state, bossNodeId);
  const locked = getCurrentCausalLedgerStatus(started);
  recordDungeonLawStatus(started, route.evidence, 'boss-debt-frozen');
  if (!locked?.bossDebtLocked || locked.collectionSeals !== debtBeforeBoss.debt - 1) {
    throw new BalanceSimulationError('Causal boss did not freeze debt and derive the gauntlet-reduced seal count.');
  }

  let bossState = performTrackedCombatAction(started, bossNodeId, 'attack', route.evidence).state;
  const afterFirstBossAction = getCurrentCausalLedgerStatus(bossState);
  recordDungeonLawStatus(bossState, route.evidence, 'boss-first-seal-consumed');
  if (afterFirstBossAction?.collectionSeals !== locked.collectionSeals - 1) {
    throw new BalanceSimulationError('Causal boss did not consume exactly one collection seal on first damage.');
  }
  for (let actionCount = 1; bossState.phase === 'combat' && bossState.combat; actionCount += 1) {
    if (actionCount > MAX_COMBAT_ACTIONS) {
      throw getDangerResolutionError(
        bossState,
        bossNodeId,
        `causal boss combat exceeded ${MAX_COMBAT_ACTIONS} actions after debt freeze`
      );
    }

    let action = chooseCombatAction(bossState, true);
    let actionResult = performTrackedCombatAction(bossState, bossNodeId, action, route.evidence);
    if (!actionResult.progressed) {
      action = action === 'attack' ? 'guard' : 'attack';
      actionResult = performTrackedCombatAction(actionResult.state, bossNodeId, action, route.evidence);
    }
    if (!actionResult.progressed) {
      throw getDangerResolutionError(
        actionResult.state,
        bossNodeId,
        `causal boss action ${action} made no progress after debt freeze`
      );
    }
    bossState = actionResult.state;
  }
  if (!bossState.run?.clearedNodeIds.includes(bossNodeId)) {
    throw getDangerResolutionError(bossState, bossNodeId, 'causal boss did not clear after debt freeze');
  }
  state = resolvePendingEquipmentOffer(bossState, bossNodeId);
  const settledState = settleLawRoute(state, 'causal_clearinghouse', route.evidence);
  return { settledState, evidence: route.evidence, modifierEvidence: route.modifierEvidence };
}

function resolveLawRouteEvent(state: GameState, eventId: string, optionId: string): GameState {
  const event = getAvailableDungeonEvents(state).find((candidate) => candidate.id === eventId);
  const option = event?.options.find((candidate) => candidate.id === optionId);
  if (!event || !option?.available) {
    throw getDangerResolutionError(state, state.run?.currentNodeId ?? eventId, `event option ${eventId}/${optionId} is unavailable`);
  }

  const resolved = resolveDungeonEvent(state, eventId, optionId);
  if (!resolved.run?.resolvedEventIds.includes(eventId)) {
    throw getDangerResolutionError(resolved, resolved.run?.currentNodeId ?? eventId, `event ${eventId} did not resolve`);
  }

  return resolved;
}

function settleLawRoute(state: GameState, dungeonId: DungeonId, evidence: RouteCombatEvidence): GameState {
  const exitReady = collectRouteRewards(state, dungeonId, evidence);
  assertBossSealCleared(exitReady, dungeonId, 'before law-route exit resolution');
  const settled = resolvePendingRunRelicArchive(resolveExit(exitReady));
  const bossNodeId = getBossDefinition(dungeonId).nodeId;

  if (
    settled.phase !== 'result' ||
    !settled.run?.clearedNodeIds.includes(bossNodeId) ||
    !settled.completedDungeonIds.includes(dungeonId)
  ) {
    throw new BalanceSimulationError(`Balance simulation failed in ${dungeonId}: law route did not settle through its boss and exit.`);
  }

  return settled;
}

function getRequiredLaw(state: GameState) {
  const law = getCurrentDungeonLaw(state);
  if (!law) throw new BalanceSimulationError('Law route lost its active dungeon law state.');
  return law;
}

function simulateDemonTowerLawRoute(baseState: GameState): LawRouteExecution {
  const route = startLawRoute(baseState, 'demon_tower_1', {
    fog_lesser_demon: ['guard'],
    fog_patrol_pair: ['guard'],
    lower_fog_lesser: ['attack']
  });
  let state = moveAlongRoutePath(route.state, 'fog_lesser_demon', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'first-fog-rise');
  state = moveAlongRoutePath(state, 'blood_rune_trap', route.evidence);
  state = moveAlongRoutePath(state, 'fog_patrol_pair', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'second-fog-rise');
  state = moveAlongRoutePath(state, 'lower_fog_lesser', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'high-fog-encounter');
  const highFog = getRequiredLaw(state);

  state = moveAlongRoutePath(state, 'sealed_cache', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'relief-landmark');
  state = resolveLawRouteEvent(state, 'mist_sealed_cache', 'match_cache_breath');
  recordDungeonLawStatus(state, route.evidence, 'relief-event');
  const lowFog = getRequiredLaw(state);
  route.modifierEvidence.push({
    metric: 'encounter.allStatsPercent',
    before: highFog.modifiers.encounter.allStatsPercent,
    after: lowFog.modifiers.encounter.allStatsPercent,
    beforeCheckpoint: 'high-fog-encounter',
    afterCheckpoint: 'relief-event'
  });

  return {
    settledState: settleLawRoute(state, 'demon_tower_1', route.evidence),
    evidence: route.evidence,
    modifierEvidence: route.modifierEvidence
  };
}

function simulateMetroLawRoute(baseState: GameState): LawRouteExecution {
  const route = startLawRoute(baseState, 'metro_abyss');
  let state = collectCurrentRouteReward(route.state, route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'flood-tide');
  state = moveAlongRoutePath(state, 'tide_boatman', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'mirror-tide');
  const mirror = getRequiredLaw(state);

  state = moveAlongRoutePath(state, 'signal_cache', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'signal-calibrated');
  const calibrated = getRequiredLaw(state);
  route.modifierEvidence.push({
    metric: 'trap.damagePercent',
    before: mirror.modifiers.trap.damagePercent,
    after: calibrated.modifiers.trap.damagePercent,
    beforeCheckpoint: 'mirror-tide',
    afterCheckpoint: 'signal-calibrated'
  });

  return {
    settledState: settleLawRoute(state, 'metro_abyss', route.evidence),
    evidence: route.evidence,
    modifierEvidence: route.modifierEvidence
  };
}

function simulateMineLawRoute(baseState: GameState): LawRouteExecution {
  const route = startLawRoute(baseState, 'starfall_mine', {
    shell_patrol_alpha: ['guard'],
    mine_shell_guard: ['attack']
  });
  let state = moveAlongRoutePath(route.state, 'shell_patrol_alpha', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'upward-encounter');
  state = moveAlongRoutePath(state, 'tilted_gravity_switch', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'downward-switch');
  state = moveAlongRoutePath(state, 'mine_shell_guard', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'downward-encounter');

  const upwardProfile = route.evidence.combatProfiles?.find((profile) => profile.nodeId === 'shell_patrol_alpha');
  const downwardProfile = route.evidence.combatProfiles?.find((profile) => profile.nodeId === 'mine_shell_guard');
  if (!upwardProfile || !downwardProfile) {
    throw new BalanceSimulationError('Mine law route did not capture both gravity encounter profiles.');
  }
  const entry = route.evidence.lawStatuses?.find((status) => status.checkpoint === 'entry');
  const downward = route.evidence.lawStatuses?.find((status) => status.checkpoint === 'downward-switch');
  route.modifierEvidence.push(
    {
      metric: 'encounter.defense',
      before: upwardProfile.defense,
      after: downwardProfile.defense,
      beforeCheckpoint: 'upward-encounter',
      afterCheckpoint: 'downward-encounter'
    },
    {
      metric: 'trap.damagePercent',
      before: entry?.modifiers.trap.damagePercent ?? 0,
      after: downward?.modifiers.trap.damagePercent ?? 0,
      beforeCheckpoint: 'entry',
      afterCheckpoint: 'downward-switch'
    }
  );
  const settledState = settleLawRoute(state, 'starfall_mine', route.evidence);

  // The second gravity landmark is a one-way portal. Probe it in a fresh legal run so the
  // completed mine run remains available for its boss/exit evidence.
  let portalProbe = enterPreparedDungeon(
    prepareLawRouteState(baseState, 'starfall_mine'),
    'starfall_mine',
    route.evidence,
    {
      plannedNodeIds: ['tilted_gravity_switch', 'backup_gravity_well'],
      portalUseNodeIds: ['backup_gravity_well'],
      inventoryTargets: { gate_sigil: 1 }
    }
  );
  if (!portalProbe.run) throw new BalanceSimulationError('Unable to enter the mine portal probe.');
  route.evidence.visitedNodeIds?.push(portalProbe.run.currentNodeId);
  recordDungeonLawStatus(portalProbe, route.evidence, 'portal-probe-entry');
  portalProbe = moveAlongRoutePath(portalProbe, 'tilted_gravity_switch', route.evidence);
  recordDungeonLawStatus(portalProbe, route.evidence, 'portal-probe-downward');
  portalProbe = moveAlongRoutePath(portalProbe, 'backup_gravity_well', route.evidence);
  const portalSource = portalProbe.run?.dungeonId ?? 'missing';
  portalProbe = useTrackedPortal(portalProbe, 'backup_gravity_well', route.evidence);
  if (portalProbe.run?.dungeonId !== 'rust_hospital') {
    throw new BalanceSimulationError('Mine backup gravity well did not transfer through the real portal API.');
  }
  route.modifierEvidence.push({
    metric: 'backupGravityWell.transferTarget',
    before: portalSource,
    after: portalProbe.run.dungeonId,
    beforeCheckpoint: 'backup_gravity_well',
    afterCheckpoint: 'portal-transfer'
  });

  return { settledState, evidence: route.evidence, modifierEvidence: route.modifierEvidence };
}

function simulateHospitalLawRoute(baseState: GameState): LawRouteExecution {
  const route = startLawRoute(baseState, 'rust_hospital', {
    plague_orderly: ['guard'],
    ward_orderly_patrol: ['guard'],
    plague_orderly_rounds: ['guard']
  }, { armor_patch: 3 });
  let state = collectCurrentRouteReward(route.state, route.evidence);
  state = moveAlongRoutePath(state, 'plague_orderly', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'pollution-one');
  state = moveAlongRoutePath(state, 'ward_orderly_patrol', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'pollution-two');
  state = moveAlongRoutePath(state, 'plague_orderly_rounds', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'pollution-high');
  const polluted = getRequiredLaw(state);

  state = moveAlongRoutePath(state, 'pharmacy_reward', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'pharmacy-relief');
  state = moveAlongRoutePath(state, 'triage_reward', route.evidence);
  state = resolveLawRouteEvent(state, 'triage_ward', 'sterilize_with_iron_body');
  recordDungeonLawStatus(state, route.evidence, 'triage-relief');
  const relieved = getRequiredLaw(state);
  route.modifierEvidence.push({
    metric: 'healingPercent',
    before: polluted.modifiers.healingPercent,
    after: relieved.modifiers.healingPercent,
    beforeCheckpoint: 'pollution-high',
    afterCheckpoint: 'triage-relief'
  });

  state = moveAlongRoutePath(state, 'pharmacy_reward', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'relieved-return-path');
  state = moveAlongRoutePath(state, 'sterilizer_trap', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'sterilizer-countered');
  state = moveAlongRoutePath(state, 'roof_access_trap', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'roof-access-countered');
  recordDungeonLawStatus(state, route.evidence, 'boss-approach');

  return {
    settledState: settleLawRoute(state, 'rust_hospital', route.evidence),
    evidence: route.evidence,
    modifierEvidence: route.modifierEvidence
  };
}

function simulateArenaLawRoute(baseState: GameState): LawRouteExecution {
  const route = startLawRoute(baseState, 'ash_arena', {
    ash_duelist: ['attack'],
    ember_pit_duelist: ['art'],
    cinder_lancer: ['guard']
  });
  const initial = getRequiredLaw(route.state);
  let state = moveAlongRoutePath(route.state, 'ash_duelist', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'force-victory');
  state = moveAlongRoutePath(state, 'ember_pit_duelist', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'art-victory');
  state = moveAlongRoutePath(state, 'cinder_lancer', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'guard-victory');
  const rewritten = getRequiredLaw(state);
  route.modifierEvidence.push(
    {
      metric: 'outgoingDamage.forcePercent',
      before: initial.modifiers.outgoingDamage.forcePercent,
      after: rewritten.modifiers.outgoingDamage.forcePercent,
      beforeCheckpoint: 'entry',
      afterCheckpoint: 'guard-victory'
    },
    {
      metric: 'guardEffectPercent',
      before: initial.modifiers.guardEffectPercent,
      after: rewritten.modifiers.guardEffectPercent,
      beforeCheckpoint: 'entry',
      afterCheckpoint: 'guard-victory'
    }
  );

  return {
    settledState: settleLawRoute(state, 'ash_arena', route.evidence),
    evidence: route.evidence,
    modifierEvidence: route.modifierEvidence
  };
}

function simulateArchiveLawRoute(baseState: GameState): LawRouteExecution {
  const route = startLawRoute(baseState, 'dream_archive', {
    paper_librarian: ['guard'],
    hallucination_patrol: ['guard'],
    paper_librarian_echo: ['guard', 'attack']
  });
  let state = moveAlongRoutePath(route.state, 'paper_librarian', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'consumable-sealed');
  state = moveAlongRoutePath(state, 'hallucination_patrol', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'method-sealed');
  state = moveAlongRoutePath(state, 'memory_loop_trap', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'pet-sealed');
  const sealed = state;

  state = moveAlongRoutePath(state, 'paper_librarian_echo', route.evidence);
  state = moveAlongRoutePath(state, 'incense_reward', route.evidence);
  state = moveAlongRoutePath(state, 'hallucination_patrol', route.evidence);
  state = moveAlongRoutePath(state, 'index_reward', route.evidence);
  state = resolveLawRouteEvent(state, 'failure_index', 'decode_with_spirit');
  recordDungeonLawStatus(state, route.evidence, 'index-restored');
  const restored = state;

  const attackAction = route.evidence.combatActions?.find(
    (action) => action.nodeId === 'paper_librarian_echo' && action.action === 'attack'
  );
  const guardAction = route.evidence.combatActions?.find(
    (action) => action.nodeId === 'paper_librarian_echo' && action.action === 'guard'
  );
  if (!attackAction?.progressed || !guardAction?.progressed) {
    throw new BalanceSimulationError('Archive law route did not prove both basic attack and guard while features were sealed.');
  }
  route.modifierEvidence.push(
    {
      metric: 'consumableAvailable',
      before: isCurrentDungeonFeatureAvailable(sealed, 'consumable'),
      after: isCurrentDungeonFeatureAvailable(restored, 'consumable'),
      beforeCheckpoint: 'pet-sealed',
      afterCheckpoint: 'index-restored'
    },
    {
      metric: 'methodAvailable',
      before: isCurrentDungeonFeatureAvailable(sealed, 'method'),
      after: isCurrentDungeonFeatureAvailable(restored, 'method'),
      beforeCheckpoint: 'pet-sealed',
      afterCheckpoint: 'index-restored'
    },
    {
      metric: 'basicAttackAndGuardProgressed',
      before: attackAction.progressed,
      after: guardAction.progressed,
      beforeCheckpoint: 'sealed-attack',
      afterCheckpoint: 'sealed-guard'
    }
  );

  state = moveAlongRoutePath(state, 'incense_reward', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'restored-boss-approach');
  return {
    settledState: settleLawRoute(state, 'dream_archive', route.evidence),
    evidence: route.evidence,
    modifierEvidence: route.modifierEvidence
  };
}

function simulateCitadelLawRoute(baseState: GameState): LawRouteExecution {
  const route = startLawRoute(baseState, 'void_citadel', {
    void_knight: ['attack'],
    first_echo_patrol: ['art'],
    second_echo_patrol: ['guard']
  });
  let state = moveAlongRoutePath(route.state, 'void_knight', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'force-victory');
  state = moveAlongRoutePath(state, 'first_echo_patrol', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'art-victory');
  state = moveAlongRoutePath(state, 'second_echo_patrol', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'guard-victory');
  const beforeBoss = getRequiredLaw(state);
  const settledState = settleLawRoute(state, 'void_citadel', route.evidence);
  const bossLaw = getRequiredLaw(settledState);
  const beforeData = beforeBoss.state.law.kind === 'void_citadel' ? beforeBoss.state.law : undefined;
  const bossData = bossLaw.state.law.kind === 'void_citadel' ? bossLaw.state.law : undefined;
  route.modifierEvidence.push(
    {
      metric: 'bossAssessmentLocked',
      before: beforeData?.bossAssessmentLocked ?? false,
      after: bossData?.bossAssessmentLocked ?? false,
      beforeCheckpoint: 'guard-victory',
      afterCheckpoint: 'combat:main_god_echo'
    },
    {
      metric: 'bossCounter',
      before: beforeData?.bossCounter ?? null,
      after: bossData?.bossCounter ?? null,
      beforeCheckpoint: 'guard-victory',
      afterCheckpoint: 'combat:main_god_echo'
    }
  );

  return { settledState, evidence: route.evidence, modifierEvidence: route.modifierEvidence };
}

function simulateTemporalObservatoryLawRoute(baseState: GameState): LawRouteExecution {
  const route = startLawRoute(baseState, 'temporal_observatory', {
    epoch_sentinel_alpha: ['attack', 'art', 'guard'],
    erased_patrol: ['guard'],
    accelerated_patrol: ['attack', 'art', 'guard']
  });
  const uncalibrated = getRequiredLaw(route.state);
  let state = moveAlongRoutePath(route.state, 'past_calibration_anchor', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'past-calibrated');
  const pastCalibrated = getRequiredLaw(state);

  state = moveAlongRoutePath(state, 'future_calibration_anchor', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'dual-calibrated');
  const dualCalibrated = getRequiredLaw(state);
  state = moveAlongRoutePath(state, 'calibration_bridge', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'calibration-bridge-open');

  route.modifierEvidence.push(
    {
      metric: 'encounter.defensePercent',
      before: uncalibrated.modifiers.encounter.defensePercent,
      after: pastCalibrated.modifiers.encounter.defensePercent,
      beforeCheckpoint: 'entry',
      afterCheckpoint: 'past-calibrated'
    },
    {
      metric: 'encounter.allStatsPercent',
      before: pastCalibrated.modifiers.encounter.allStatsPercent,
      after: dualCalibrated.modifiers.encounter.allStatsPercent,
      beforeCheckpoint: 'past-calibrated',
      afterCheckpoint: 'dual-calibrated'
    },
    {
      metric: 'trap.damagePercent',
      before: pastCalibrated.modifiers.trap.damagePercent,
      after: dualCalibrated.modifiers.trap.damagePercent,
      beforeCheckpoint: 'past-calibrated',
      afterCheckpoint: 'dual-calibrated'
    }
  );

  return {
    settledState: settleLawRoute(state, 'temporal_observatory', route.evidence),
    evidence: route.evidence,
    modifierEvidence: route.modifierEvidence
  };
}

function simulateMirrorCycleCityLawRoute(baseState: GameState): LawRouteExecution {
  const route = startLawRoute(
    prepareMirrorCycleCityRouteState(baseState, [
      'parallax_visor',
      'phaseweave_mantle',
      'homecoming_prism'
    ]),
    'mirror_cycle_city',
    {
      parallax_hunter_spine: ['attack', 'art', 'guard'],
      nameless_reflection: ['attack', 'art', 'guard']
    }
  );
  const realPhase = getRequiredLaw(route.state);
  let state = moveAlongRoutePath(route.state, 'first_phase_mirror', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'first-phase-pending');
  state = moveAlongRoutePath(state, 'real_anchor', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'real-anchor');

  state = moveAlongRoutePath(state, 'second_phase_mirror', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'second-phase-pending');
  state = moveAlongRoutePath(state, 'mirror_anchor', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'mirror-anchor');
  const mirrorPhase = getRequiredLaw(state);

  state = moveAlongRoutePath(state, 'third_phase_mirror', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'third-phase-pending');
  state = moveAlongRoutePath(state, 'cycle_manifest', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'dual-anchor-manifest');
  const beforeBoss = getRequiredLaw(state);
  const settledState = settleLawRoute(state, 'mirror_cycle_city', route.evidence);
  const bossLaw = getRequiredLaw(settledState);
  const beforeData = beforeBoss.state.law.kind === 'mirror_cycle_city' ? beforeBoss.state.law : undefined;
  const bossData = bossLaw.state.law.kind === 'mirror_cycle_city' ? bossLaw.state.law : undefined;
  route.modifierEvidence.push(
    {
      metric: 'outgoingDamage.forcePercent',
      before: realPhase.modifiers.outgoingDamage.forcePercent,
      after: mirrorPhase.modifiers.outgoingDamage.forcePercent,
      beforeCheckpoint: 'entry',
      afterCheckpoint: 'mirror-anchor'
    },
    {
      metric: 'outgoingDamage.artPercent',
      before: realPhase.modifiers.outgoingDamage.artPercent,
      after: mirrorPhase.modifiers.outgoingDamage.artPercent,
      beforeCheckpoint: 'entry',
      afterCheckpoint: 'mirror-anchor'
    },
    {
      metric: 'bossAnchorSnapshot.real',
      before: beforeData?.bossAnchorSnapshot?.real ?? false,
      after: bossData?.bossAnchorSnapshot?.real ?? false,
      beforeCheckpoint: 'dual-anchor-manifest',
      afterCheckpoint: 'combat:nameless_reflection'
    },
    {
      metric: 'bossAnchorSnapshot.mirror',
      before: beforeData?.bossAnchorSnapshot?.mirror ?? false,
      after: bossData?.bossAnchorSnapshot?.mirror ?? false,
      beforeCheckpoint: 'dual-anchor-manifest',
      afterCheckpoint: 'combat:nameless_reflection'
    }
  );

  return { settledState, evidence: route.evidence, modifierEvidence: route.modifierEvidence };
}

function simulateRedactionScriptoriumLawRouteExecution(baseState: GameState): LawRouteExecution {
  const route = startLawRoute(baseState, 'redaction_scriptorium', {
    last_redactor: ['attack', 'art', 'guard']
  });
  const entryStatus = getCurrentRedactionClauseStatus(route.state);
  let state = route.state;
  for (const nodeId of LAW_ROUTE_PLANNED_NODES.redaction_scriptorium) {
    state = moveAlongRoutePath(state, nodeId, route.evidence, {
      redactionClauseChoices: STANDARD_REDACTION_CLAUSE_CHOICES
    });
    recordDungeonLawStatus(state, route.evidence, `redaction:${nodeId}`);
  }
  const resolvedStatus = getCurrentRedactionClauseStatus(state);
  route.modifierEvidence.push(
    {
      metric: 'projectedBossEffects.sealed.defensePercent',
      before: entryStatus?.projectedBossEffects.sealed.defensePercent ?? 0,
      after: resolvedStatus?.projectedBossEffects.sealed.defensePercent ?? 0,
      beforeCheckpoint: 'entry',
      afterCheckpoint: 'redaction:final_proof_nexus'
    },
    {
      metric: 'resolvedClauseCount',
      before: entryStatus?.resolvedCount ?? 0,
      after: resolvedStatus?.resolvedCount ?? 0,
      beforeCheckpoint: 'entry',
      afterCheckpoint: 'redaction:final_proof_nexus'
    }
  );

  return {
    settledState: settleLawRoute(state, 'redaction_scriptorium', route.evidence),
    evidence: route.evidence,
    modifierEvidence: route.modifierEvidence
  };
}

function simulateLegacyAuctionCourtLawRouteExecution(baseState: GameState): LawRouteExecution {
  const route = startLawRoute(baseState, 'legacy_auction_court', {
    inheritance_mimic_alpha: ['attack', 'art', 'guard'],
    estate_auctioneer: Array.from({ length: MAX_COMBAT_ACTIONS }, (_, index) => {
      if (index % 4 === 2) return 'art';
      return index % 4 === 3 ? 'weapon_skill' : 'guard';
    }) as CombatAction[]
  });
  const entryStatus = getCurrentAuctionLotStatus(route.state);
  let state = route.state;
  for (const nodeId of LAW_ROUTE_PLANNED_NODES.legacy_auction_court) {
    state = moveAlongRoutePath(state, nodeId, route.evidence, {
      auctionLotChoices: STANDARD_AUCTION_LOT_CHOICES
    });
    recordDungeonLawStatus(state, route.evidence, `auction:${nodeId}`);
  }
  const resolvedStatus = getCurrentAuctionLotStatus(state);
  route.modifierEvidence.push(
    {
      metric: 'resolvedLotCount',
      before: entryStatus?.resolvedCount ?? 0,
      after: resolvedStatus?.resolvedCount ?? 0,
      beforeCheckpoint: 'entry',
      afterCheckpoint: 'auction:provenance_event_stage'
    },
    {
      metric: 'bidCount',
      before: entryStatus?.bidCount ?? 0,
      after: resolvedStatus?.bidCount ?? 0,
      beforeCheckpoint: 'entry',
      afterCheckpoint: 'auction:provenance_event_stage'
    }
  );

  return {
    settledState: settleLawRoute(state, 'legacy_auction_court', route.evidence),
    evidence: route.evidence,
    modifierEvidence: route.modifierEvidence
  };
}

function simulateGenesisVaultLawRouteExecution(baseState: GameState): LawRouteExecution {
  const route = startLawRoute(baseState, 'genesis_vault', {
    gene_stalker_alpha: ['attack', 'art', 'guard'],
    primal_curator: Array.from({ length: MAX_COMBAT_ACTIONS }, (_, index) =>
      (['art', 'guard', 'weapon_skill', 'guard'] as const)[index % 4]
    ) as CombatAction[]
  });
  const entryStatus = getCurrentGenesisSpliceStatus(route.state);
  if (!entryStatus || !route.state.run?.bloodlineSnapshot) {
    throw new BalanceSimulationError('Genesis law route did not freeze an active bloodline snapshot at entry.');
  }

  let state = route.state;
  for (const nodeId of LAW_ROUTE_PLANNED_NODES.genesis_vault) {
    state = moveAlongRoutePath(state, nodeId, route.evidence, {
      genesisSpliceSequence: STANDARD_GENESIS_SPLICE_SEQUENCE
    });
    recordDungeonLawStatus(state, route.evidence, `genesis:${nodeId}`);
  }
  const resolvedStatus = getCurrentGenesisSpliceStatus(state);
  if (
    !resolvedStatus?.allResolved ||
    resolvedStatus.uniqueCount !== 3 ||
    state.run?.currentNodeId !== 'mosaic_gene_vault'
  ) {
    throw new BalanceSimulationError('Genesis law route did not complete three unique splices and reach the mosaic vault.');
  }

  route.modifierEvidence.push(
    {
      metric: 'spliceSequence.length',
      before: entryStatus.spliceSequence.length,
      after: resolvedStatus.spliceSequence.length,
      beforeCheckpoint: 'entry',
      afterCheckpoint: 'genesis:mosaic_gene_vault'
    },
    {
      metric: 'uniqueCount',
      before: entryStatus.uniqueCount,
      after: resolvedStatus.uniqueCount,
      beforeCheckpoint: 'entry',
      afterCheckpoint: 'genesis:mosaic_gene_vault'
    },
    {
      metric: 'outgoingDamage.forcePercent',
      before: entryStatus.projectedModifiers.sealed.outgoingDamage.forcePercent,
      after: resolvedStatus.projectedModifiers.sealed.outgoingDamage.forcePercent,
      beforeCheckpoint: 'entry',
      afterCheckpoint: 'genesis:mosaic_gene_vault'
    }
  );

  return {
    settledState: settleLawRoute(state, 'genesis_vault', route.evidence),
    evidence: route.evidence,
    modifierEvidence: route.modifierEvidence
  };
}

function simulateSilentBroadcastTowerLawRouteExecution(baseState: GameState): LawRouteExecution {
  const route = startLawRoute(
    prepareBroadcastRepeatHubState(baseState),
    'silent_broadcast_tower'
  );
  const entryStatus = getCurrentBroadcastRelayStatus(route.state);
  if (!entryStatus) throw new BalanceSimulationError('Broadcast law route has no relay status at entry.');

  let state = route.state;
  for (const nodeId of [
    'south_relay_console',
    'lower_entry',
    'broadcast_gate',
    'north_entry',
    'north_relay_console',
    'central_relay_console',
    'studio_side_lock',
    'upper_return_portal',
    'broadcast_exit',
    'lower_return_portal',
    'soul_recharge_broadcast',
    'balanced_switchboard'
  ]) {
    state = moveAlongRoutePath(state, nodeId, route.evidence, {
      broadcastRelayChoices: STANDARD_BROADCAST_RELAY_CHOICES
    });
    recordDungeonLawStatus(state, route.evidence, `broadcast:${nodeId}`);
  }
  const branchStatus = getCurrentBroadcastRelayStatus(state);
  if (
    !branchStatus?.allRelaysResolved ||
    branchStatus.muteCount < 1 ||
    branchStatus.broadcastCount < 1 ||
    branchStatus.noise < 2 ||
    branchStatus.noise > 3 ||
    state.run?.currentNodeId !== 'balanced_switchboard' ||
    !state.run.clearedNodeIds.includes('balanced_switchboard')
  ) {
    throw new BalanceSimulationError('Broadcast law route did not reach the balanced branch through three live relays.');
  }
  state = moveAlongRoutePath(state, 'broadcast_memory_stage', route.evidence, {
    broadcastRelayChoices: STANDARD_BROADCAST_RELAY_CHOICES
  });

  route.modifierEvidence.push(
    {
      metric: 'noise',
      before: entryStatus.noise,
      after: branchStatus.noise,
      beforeCheckpoint: 'entry',
      afterCheckpoint: 'broadcast:balanced_switchboard'
    },
    {
      metric: 'resolvedRelayCount',
      before: entryStatus.resolvedCount,
      after: branchStatus.resolvedCount,
      beforeCheckpoint: 'entry',
      afterCheckpoint: 'broadcast:balanced_switchboard'
    }
  );

  return {
    settledState: settleLawRoute(state, 'silent_broadcast_tower', route.evidence),
    evidence: route.evidence,
    modifierEvidence: route.modifierEvidence
  };
}

function simulateLostShelterLawRouteExecution(baseState: GameState): LawRouteExecution {
  const route = startLawRoute(baseState, 'lost_shelter');
  const entryStatus = getCurrentEscortCheckpointStatus(route.state);
  if (!entryStatus) throw new BalanceSimulationError('Lost-shelter law route has no escort status at entry.');

  let state = route.state;
  for (const nodeId of LAW_ROUTE_PLANNED_NODES.lost_shelter) {
    state = moveAlongRoutePath(state, nodeId, route.evidence, {
      escortCheckpointChoices: STANDARD_ESCORT_CHECKPOINT_CHOICES
    });
    recordDungeonLawStatus(state, route.evidence, `escort:${nodeId}`);
  }
  const branchStatus = getCurrentEscortCheckpointStatus(state);
  if (
    !branchStatus?.allCheckpointsResolved ||
    branchStatus.treatCount < 1 ||
    branchStatus.pushCount < 1 ||
    branchStatus.survivorHp <= 0 ||
    state.run?.currentNodeId !== 'balanced_medbay' ||
    !state.run.clearedNodeIds.includes('balanced_medbay')
  ) {
    throw new BalanceSimulationError('Lost-shelter law route did not reach the balanced branch through three live checkpoints.');
  }

  route.modifierEvidence.push(
    {
      metric: 'survivorHp',
      before: entryStatus.survivorHp,
      after: branchStatus.survivorHp,
      beforeCheckpoint: 'entry',
      afterCheckpoint: 'escort:balanced_medbay'
    },
    {
      metric: 'resolvedCheckpointCount',
      before: entryStatus.resolvedCount,
      after: branchStatus.resolvedCount,
      beforeCheckpoint: 'entry',
      afterCheckpoint: 'escort:balanced_medbay'
    }
  );

  return {
    settledState: settleLawRoute(state, 'lost_shelter', route.evidence),
    evidence: route.evidence,
    modifierEvidence: route.modifierEvidence
  };
}

function simulateFalseTestimonyCourtLawRouteExecution(baseState: GameState): LawRouteExecution {
  const route = startLawRoute(baseState, 'false_testimony_court', {
    hostile_witness_north: FALSE_TESTIMONY_SURVIVAL_SCRIPT,
    archive_censor_alpha: FALSE_TESTIMONY_SURVIVAL_SCRIPT,
    perjury_hound_omega: FALSE_TESTIMONY_SURVIVAL_SCRIPT,
    false_testimony_judge: FALSE_TESTIMONY_BOSS_SURVIVAL_SCRIPT
  });
  const entryStatus = getFalseTestimonyGameApi().getCurrentVerdictStatus(route.state);
  if (!entryStatus) throw new BalanceSimulationError('False-testimony law route has no status at entry.');

  let state = route.state;
  for (const nodeId of LAW_ROUTE_PLANNED_NODES.false_testimony_court) {
    state = moveAlongRoutePath(state, nodeId, route.evidence, {
      falseTestimonySuspect: 'route_surveyor'
    });
    recordDungeonLawStatus(state, route.evidence, `false-testimony:${nodeId}`);
  }
  const status = getFalseTestimonyGameApi().getCurrentVerdictStatus(state);
  if (
    !status ||
    status.evidence.filter((item) => item.revealed).length !== 3 ||
    status.currentTrustedCount !== 3 ||
    status.accusationCorrect !== true ||
    status.accusationTrustedCount !== 3 ||
    status.appealUsed ||
    !state.run?.clearedNodeIds.includes('truth_archive')
  ) {
    throw new BalanceSimulationError('False-testimony law route did not reach truth archive through three clean live evidence pairs.');
  }
  route.modifierEvidence.push(
    {
      metric: 'trustedEvidenceCount',
      before: entryStatus.currentTrustedCount,
      after: status.currentTrustedCount,
      beforeCheckpoint: 'entry',
      afterCheckpoint: 'false-testimony:truth_archive'
    },
    {
      metric: 'accusationTrustedCount',
      before: entryStatus.accusationTrustedCount,
      after: status.accusationTrustedCount,
      beforeCheckpoint: 'entry',
      afterCheckpoint: 'false-testimony:verdict_chamber'
    }
  );

  return {
    settledState: settleLawRoute(state, 'false_testimony_court', route.evidence),
    evidence: route.evidence,
    modifierEvidence: route.modifierEvidence
  };
}

function simulateCombatReplayStageLawRouteExecution(baseState: GameState): LawRouteExecution {
  const route = startLawRoute(baseState, 'combat_replay_stage', {
    take_alpha: COMBAT_REPLAY_TAKE_ALPHA_SCRIPT,
    take_beta: COMBAT_REPLAY_TAKE_BETA_SCRIPT,
    take_gamma: COMBAT_REPLAY_TAKE_GAMMA_SCRIPT,
    final_cut_director: COMBAT_REPLAY_BOSS_SURVIVAL_SCRIPT
  });
  let state = route.state;
  for (const nodeId of ['take_alpha', 'take_beta', 'take_gamma'] as const) {
    state = moveAlongRoutePath(state, nodeId, route.evidence);
    recordDungeonLawStatus(state, route.evidence, `combat-replay:${nodeId}`);
  }
  state = selectCombatReplayRoute(state, 'sequence');
  state = moveAlongRoutePath(state, 'sequence_route', route.evidence);
  recordDungeonLawStatus(state, route.evidence, 'combat-replay:sequence-route');
  const law = getRequiredLaw(state).state.law;
  if (
    law.kind !== 'combat_replay_stage' ||
    law.takes.some((take) => take === null) ||
    law.route !== 'sequence' ||
    !state.run?.clearedNodeIds.includes('sequence_route')
  ) {
    throw new BalanceSimulationError('Combat replay law route did not record three takes and select sequence through public APIs.');
  }
  route.modifierEvidence.push({
    metric: 'recordedTakeCount',
    before: 0,
    after: law.takes.length,
    beforeCheckpoint: 'entry',
    afterCheckpoint: 'combat-replay:sequence-route'
  });
  return {
    settledState: settleLawRoute(state, 'combat_replay_stage', route.evidence),
    evidence: route.evidence,
    modifierEvidence: route.modifierEvidence
  };
}

function simulatePanopticonCityLawRouteExecution(baseState: GameState): LawRouteExecution {
  const route = startLawRoute(
    baseState,
    'panopticon_city',
    {
      sweep_sentinel_north: Array.from(
        { length: MAX_COMBAT_ACTIONS },
        (_, index) => (['guard', 'art', 'attack', 'weapon_skill'] as const)[index % 4]
      ),
      all_sight_warden: Array.from(
        { length: MAX_COMBAT_ACTIONS },
        (_, index) => (['guard', 'art', 'attack', 'weapon_skill', 'use_healing_pill'] as const)[index % 5]
      )
    },
    { healing_pill: 128, focus_incense: 16, armor_patch: 16 }
  );
  const entryStatus = getCurrentPanopticonStatus(route.state);
  if (!entryStatus) throw new BalanceSimulationError('Panopticon law route has no status at entry.');

  let state = route.state;
  for (const nodeId of LAW_ROUTE_PLANNED_NODES.panopticon_city) {
    state = moveAlongRoutePath(state, nodeId, route.evidence, { panopticonRoute: 'shadow' });
    recordDungeonLawStatus(state, route.evidence, `panopticon:${nodeId}`);
  }
  const routeStatus = getCurrentPanopticonStatus(state);
  if (
    routeStatus?.completedRelayCount !== 3 ||
    routeStatus.route !== 'shadow' ||
    !routeStatus.readyForBoss ||
    state.run?.currentNodeId !== 'all_sight_lock'
  ) {
    throw new BalanceSimulationError('Panopticon law route did not complete all relays and the shadow route.');
  }

  route.modifierEvidence.push(
    {
      metric: 'completedRelayCount',
      before: entryStatus.completedRelayCount,
      after: routeStatus.completedRelayCount,
      beforeCheckpoint: 'entry',
      afterCheckpoint: 'panopticon:all_sight_lock'
    },
    {
      metric: 'moveCount',
      before: entryStatus.moveCount,
      after: routeStatus.moveCount,
      beforeCheckpoint: 'entry',
      afterCheckpoint: 'panopticon:all_sight_lock'
    }
  );

  return {
    settledState: settleLawRoute(state, 'panopticon_city', route.evidence),
    evidence: route.evidence,
    modifierEvidence: route.modifierEvidence
  };
}

export function simulateGenesisSpecializationRoute(
  initialState: GameState = simulateSevenDungeonVictoryRoute().finalState
): GenesisSpecializationRouteEvidence {
  const evidence = createRouteCombatEvidence({ prioritizeHealing: true, healingTargetRatio: 0.9 });
  const prepared = equipEquipment(
    prepareGenesisRepeatHubState(structuredClone(initialState)),
    'plain_charm'
  );
  let state = enterPreparedDungeon(prepared, 'genesis_vault', evidence, {
    plannedNodeIds: [
      'first_splice_console',
      'second_splice_console',
      'third_splice_console',
      'renewal_gene_vault'
    ],
    additionalTacticalItemIds: ['healing_pill', 'armor_patch', 'thunder_talisman'],
    inventoryTargets: { healing_pill: 64, armor_patch: 64, thunder_talisman: 32 },
    methodTechnique: 'live'
  });
  const spliceSequence = ['renewal', 'renewal', 'force'] as const;
  for (const nodeId of DUNGEON_LAW_LANDMARKS.genesis_vault.spliceNodeIds) {
    state = moveAlongRoutePath(state, nodeId, evidence, {
      genesisSpliceSequence: spliceSequence,
      skipGenesisPreparation: true
    });
  }
  state = moveAlongRoutePath(state, 'renewal_gene_vault', evidence, {
    genesisSpliceSequence: spliceSequence,
    skipGenesisPreparation: true
  });

  const status = getCurrentGenesisSpliceStatus(state);
  const geneCount = status?.spliceSequence.filter((gene) => gene === 'renewal').length ?? 0;
  const paidRepeat = evidence.genesisSpliceChoiceTrace.find(
    (choice) => choice.gene === 'renewal' && choice.serumCost === 1
  );
  const reachedVault =
    state.run?.currentNodeId === 'renewal_gene_vault' &&
    state.run.clearedNodeIds.includes('renewal_gene_vault');
  if (
    geneCount < 2 ||
    !paidRepeat ||
    paidRepeat.serumBefore - paidRepeat.serumAfter !== 1 ||
    paidRepeat.runSerumBefore - paidRepeat.runSerumAfter !== 1 ||
    !reachedVault
  ) {
    throw new BalanceSimulationError(
      `Genesis specialization route did not prove a paid current-run renewal vault path ` +
      `(genes=${status?.spliceSequence.join(',') ?? 'none'}, geneCount=${geneCount}, ` +
      `paid=${JSON.stringify(paidRepeat)}, reached=${reachedVault}, ` +
      `trace=${JSON.stringify(evidence.genesisSpliceChoiceTrace)}).`
    );
  }

  return {
    gene: 'renewal',
    geneCount,
    vaultNodeId: 'renewal_gene_vault',
    reachedVault,
    spliceChoiceTrace: structuredClone(evidence.genesisSpliceChoiceTrace),
    routeEvidence: getRouteLegalityEvidence(evidence)
  };
}

function prepareBroadcastRepeatHubState(
  baseState: GameState,
  excludedEquipmentId?: EquipmentId
): GameState {
  let state = restoreSimulationHealth(
    baseState.phase === 'hub' ? structuredClone(baseState) : returnToHub(structuredClone(baseState))
  );
  if (state.learnedMethods.includes('mist_breathing')) {
    state = activateMethod(state, 'mist_breathing');
  }
  const equipmentIds = [
    'hushblade',
    'dead_air_headset',
    'anechoic_mantle',
    'last_channel_beacon'
  ] as const satisfies readonly EquipmentId[];
  const attunements = {
    hushblade: 'forge_overdrive',
    dead_air_headset: 'mist_veilguard',
    anechoic_mantle: 'rift_anchor',
    last_channel_beacon: 'chronal_stasis'
  } as const satisfies Readonly<Record<(typeof equipmentIds)[number], EquipmentAttunementId>>;
  const materialFundingDungeon: Partial<Record<ItemId, DungeonId>> = {
    star_iron: 'starfall_mine',
    phase_glass: 'mirror_cycle_city',
    rift_dust: 'void_citadel',
    chronal_glass: 'temporal_observatory'
  };

  for (const equipmentId of equipmentIds) {
    if (equipmentId === excludedEquipmentId) continue;
    for (const [itemId, requiredCount] of Object.entries(EQUIPMENT[equipmentId].cost.items ?? {}) as Array<
      [ItemId, number]
    >) {
      const fundingDungeonId = materialFundingDungeon[itemId];
      for (
        let fundingRun = 0;
        fundingDungeonId && state.inventory[itemId] < requiredCount && fundingRun < 4;
        fundingRun += 1
      ) {
        const evidence = createRouteCombatEvidence({ prioritizeHealing: true, healingTargetRatio: 0.95 });
        const settled = clearDungeonViaExit(state, fundingDungeonId, evidence);
        if (settled.phase !== 'result' || settled.player.hp <= 0) {
          throw new BalanceSimulationError(`${fundingDungeonId} funding route failed for ${equipmentId}.`);
        }
        state = restoreSimulationHealth(returnToHub(settled));
      }
    }
    for (let fundingRun = 0; !state.ownedEquipment.includes(equipmentId) && fundingRun < 8; fundingRun += 1) {
      state = buyEquipment(state, equipmentId);
      if (state.ownedEquipment.includes(equipmentId)) break;
      const evidence = createRouteCombatEvidence({ prioritizeHealing: true, healingTargetRatio: 0.95 });
      const settled = clearDungeonViaExit(state, 'silent_broadcast_tower', evidence);
      if (settled.phase !== 'result' || settled.player.hp <= 0) {
        throw new BalanceSimulationError(`Broadcast funding route failed before buying ${equipmentId}.`);
      }
      state = restoreSimulationHealth(returnToHub(settled));
    }
    if (!state.ownedEquipment.includes(equipmentId)) state = buyEquipment(state, equipmentId);
    if (!state.ownedEquipment.includes(equipmentId)) {
      throw new BalanceSimulationError(
        `Broadcast repeat route could not buy ${equipmentId} from real campaign rewards ` +
        `(rp=${state.rewardPoints}, lingyun=${state.lingyun}, silence=${state.inventory.silence_core}).`
      );
    }
    const secondaryMaterialId = (Object.keys(EQUIPMENT[equipmentId].cost.items ?? {}) as ItemId[])
      .find((itemId) => itemId !== 'silence_core');
    const fundingDungeonId = secondaryMaterialId
      ? materialFundingDungeon[secondaryMaterialId]
      : undefined;
    for (let attempt = 0; (state.equipmentLevels[equipmentId] ?? 1) < EQUIPMENT[equipmentId].maxLevel && attempt < 8; attempt += 1) {
      const beforeLevel = state.equipmentLevels[equipmentId] ?? 1;
      state = upgradeEquipment(state, equipmentId);
      if ((state.equipmentLevels[equipmentId] ?? 1) > beforeLevel) continue;
      if (!fundingDungeonId) break;
      const evidence = createRouteCombatEvidence({ prioritizeHealing: true, healingTargetRatio: 0.95 });
      state = restoreSimulationHealth(returnToHub(clearDungeonViaExit(state, fundingDungeonId, evidence)));
    }
    for (let attempt = 0; (state.equipmentTemperRanks?.[equipmentId] ?? 0) < 2 && attempt < 8; attempt += 1) {
      const beforeRank = state.equipmentTemperRanks?.[equipmentId] ?? 0;
      state = temperEquipment(state, equipmentId);
      if ((state.equipmentTemperRanks?.[equipmentId] ?? 0) > beforeRank) continue;
      if (!fundingDungeonId) break;
      const evidence = createRouteCombatEvidence({ prioritizeHealing: true, healingTargetRatio: 0.95 });
      state = restoreSimulationHealth(returnToHub(clearDungeonViaExit(state, fundingDungeonId, evidence)));
    }
    state = attuneEquipment(state, equipmentId, attunements[equipmentId]);
    if (state.equipmentAttunements?.[equipmentId] !== attunements[equipmentId]) {
      throw new BalanceSimulationError(`Broadcast repeat route could not attune ${equipmentId}.`);
    }
    state = equipEquipment(state, equipmentId);
    if (state.equipped[EQUIPMENT[equipmentId].slot] !== equipmentId) {
      throw new BalanceSimulationError(`Broadcast repeat route could not equip ${equipmentId}.`);
    }
  }

  if (state.learnedMethods.includes('mist_breathing')) {
    state = activateMethod(state, 'mist_breathing');
  }
  if (state.ownedCompanions?.includes('lu_guanlan')) {
    state = activateCompanion(state, 'lu_guanlan');
  }
  return restoreSimulationHealth(state);
}

function simulateBroadcastSpecializationBranch(
  baseState: GameState,
  branchNodeId: BroadcastSpecializationBranchEvidence['branchNodeId'],
  relayChoices: Readonly<Record<BroadcastRelayNodeId, BroadcastRelayChoice>>,
  routeNodeIds: readonly string[]
): BroadcastSpecializationBranchEvidence {
  const evidence = createRouteCombatEvidence({
    prioritizeHealing: true,
    healingTargetRatio: 0.95,
    visitedNodeIds: [],
    combatProfiles: [],
    combatActions: [],
    lawStatuses: []
  });
  let state = enterPreparedDungeon(baseState, 'silent_broadcast_tower', evidence, {
    plannedNodeIds: routeNodeIds,
    additionalTacticalItemIds: ['healing_pill', 'dispel_talisman', 'armor_patch'],
    inventoryTargets: { healing_pill: 64, dispel_talisman: 16, armor_patch: 16 },
    methodTechnique: 'live'
  });
  const entryStatus = getCurrentBroadcastRelayStatus(state);
  if (!entryStatus) throw new BalanceSimulationError(`${branchNodeId}: missing broadcast entry snapshot.`);
  const entryPassives = structuredClone(entryStatus.entryPassives);

  for (const nodeId of routeNodeIds) {
    state = moveAlongRoutePath(state, nodeId, evidence, { broadcastRelayChoices: relayChoices });
    recordDungeonLawStatus(state, evidence, `${branchNodeId}:${nodeId}`);
  }
  const branchStatus = getCurrentBroadcastRelayStatus(state);
  const reachedBranch =
    state.run?.currentNodeId === branchNodeId &&
    state.run.clearedNodeIds.includes(branchNodeId);
  if (!branchStatus?.allRelaysResolved || !reachedBranch) {
    throw new BalanceSimulationError(`${branchNodeId}: specialization did not resolve all relays and enter its branch.`);
  }

  const settled = settleLawRoute(state, 'silent_broadcast_tower', evidence);
  const bossNodeId = getBossDefinition('silent_broadcast_tower').nodeId;
  const exitNodeId = DUNGEONS.silent_broadcast_tower.nodes.find((node) => node.type === 'exit')?.id;
  return {
    branchNodeId,
    reachedBranch,
    noiseAtBranch: branchStatus.noise,
    muteCount: branchStatus.muteCount,
    broadcastCount: branchStatus.broadcastCount,
    relayChoices: { ...branchStatus.resolvedRelayChoices },
    entryPassives,
    bossNodeCleared: settled.run?.clearedNodeIds.includes(bossNodeId) ?? false,
    exitNodeCleared: exitNodeId ? settled.run?.clearedNodeIds.includes(exitNodeId) ?? false : false,
    completed: settled.completedDungeonIds.includes('silent_broadcast_tower'),
    playerSurvived: settled.player.hp > 0,
    routeEvidence: getRouteLegalityEvidence(evidence)
  };
}

export function simulateBroadcastSpecializationRoutes(
  initialState: GameState = simulateSevenDungeonVictoryRoute().finalState
): BroadcastSpecializationRouteResult {
  const baseState = prepareBroadcastRepeatHubState(initialState);
  const silentChoices = {
    south_relay_console: 'mute',
    north_relay_console: 'mute',
    central_relay_console: 'mute'
  } as const satisfies Readonly<Record<BroadcastRelayNodeId, BroadcastRelayChoice>>;
  const resonanceChoices = {
    south_relay_console: 'broadcast',
    north_relay_console: 'broadcast',
    central_relay_console: 'broadcast'
  } as const satisfies Readonly<Record<BroadcastRelayNodeId, BroadcastRelayChoice>>;

  return {
    baseState,
    equippedEquipmentIds: [
      baseState.equipped.weapon,
      baseState.equipped.head,
      baseState.equipped.armor,
      baseState.equipped.charm
    ].filter((equipmentId): equipmentId is EquipmentId => equipmentId !== undefined),
    silent: simulateBroadcastSpecializationBranch(
      baseState,
      'silent_archive',
      silentChoices,
      [
        'south_relay_console',
        'lower_entry',
        'broadcast_gate',
        'north_entry',
        'north_relay_console',
        'central_relay_console',
        'north_relay_console',
        'north_echo_cache',
        'silent_archive'
      ]
    ),
    resonance: simulateBroadcastSpecializationBranch(
      baseState,
      'resonance_vault',
      resonanceChoices,
      [
        'south_relay_console',
        'lower_entry',
        'broadcast_gate',
        'north_entry',
        'north_relay_console',
        'central_relay_console',
        'broadcast_warden_north',
        'resonance_vault'
      ]
    ),
    balanced: simulateBroadcastSpecializationBranch(
      baseState,
      'balanced_switchboard',
      STANDARD_BROADCAST_RELAY_CHOICES,
      [
        'south_relay_console',
        'lower_entry',
        'broadcast_gate',
        'north_entry',
        'north_relay_console',
        'central_relay_console',
        'studio_side_lock',
        'upper_return_portal',
        'broadcast_exit',
        'lower_return_portal',
        'soul_recharge_broadcast',
        'balanced_switchboard'
      ]
    )
  };
}

const LOST_SHELTER_EQUIPMENT_PREPARATION = [
  ['rescue_carbine', 'forge_overdrive'],
  ['triage_visor', 'mist_veilguard'],
  ['evacuation_plate', 'rift_anchor'],
  ['blackbox_beacon', 'chronal_stasis']
] as const satisfies readonly (readonly [EquipmentId, EquipmentAttunementId])[];

function getLostShelterPreparationBadgeCost(state: GameState): number {
  return LOST_SHELTER_EQUIPMENT_PREPARATION.reduce((total, [equipmentId]) => {
    const purchaseCost = state.ownedEquipment.includes(equipmentId) ? 0 : 1;
    const temperRank = state.equipmentTemperRanks?.[equipmentId] ?? 0;
    const temperCost = temperRank === 0 ? 3 : temperRank === 1 ? 2 : 0;
    return total + purchaseCost + temperCost;
  }, 0);
}

function prepareLostShelterSpecializationHubState(
  initialState: GameState,
  materialSource: 'completed_replay' | 'portal_farm' = 'completed_replay',
  requireMaterialFarmRun = true
): {
  state: GameState;
  materialFarmRuns: number;
  rescueBadgesBeforeFarm: number;
  rescueBadgesAfterFarm: number;
} {
  let state = restoreSimulationHealth(
    initialState.phase === 'hub'
      ? structuredClone(initialState)
      : returnToHub(structuredClone(initialState))
  );
  const rescueBadgesBeforeFarm = state.inventory.rescue_badge;
  let materialFarmRuns = 0;

  while (
    ((requireMaterialFarmRun && materialFarmRuns === 0) ||
      state.inventory.rescue_badge < getLostShelterPreparationBadgeCost(state)) &&
    materialFarmRuns < 6
  ) {
    const before = state.inventory.rescue_badge;
    const evidence = createRouteCombatEvidence({
      prioritizeHealing: true,
      healingTargetRatio: 0.65,
      scriptedActions: {
        evacuation_horror_omega: LOST_SHELTER_SURVIVAL_SCRIPT,
        mimic_survivor: LOST_SHELTER_SURVIVAL_SCRIPT
      }
    });
    if (materialSource === 'completed_replay') {
      state = restoreSimulationHealth(returnToHub(clearDungeonViaExit(state, 'lost_shelter', evidence)));
    } else {
      const completedBefore = state.completedDungeonIds.includes('lost_shelter');
      const mainlineBefore = state.claimedTaskIds.includes('mainline_clear_lost_shelter');
      let run = enterPreparedDungeon(state, 'silent_broadcast_tower', evidence, {
        plannedNodeIds: ['return_broadcast_portal'],
        portalUseNodeIds: ['return_broadcast_portal'],
        additionalTacticalItemIds: ['gate_sigil', 'healing_pill', 'armor_patch'],
        inventoryTargets: { gate_sigil: 8, healing_pill: 64, armor_patch: 32 },
        methodTechnique: 'live'
      });
      run = useTrackedPortal(
        moveAlongRoutePath(run, 'return_broadcast_portal', evidence, {
          broadcastRelayChoices: STANDARD_BROADCAST_RELAY_CHOICES
        }),
        'return_broadcast_portal',
        evidence
      );
      if (run.run?.dungeonId !== 'lost_shelter' || run.run.currentNodeId !== 'shelter_gate') {
        throw new BalanceSimulationError('Tier16 portal farm missed the central shelter landing.');
      }
      for (const nodeId of ['south_checkpoint', 'evacuation_horror_omega', 'mimic_survivor']) {
        run = moveAlongRoutePath(run, nodeId, evidence, {
          escortCheckpointChoices: STANDARD_ESCORT_CHECKPOINT_CHOICES
        });
      }
      run = useTrackedPortal(
        moveAlongRoutePath(run, 'return_shelter_portal', evidence, {
          escortCheckpointChoices: STANDARD_ESCORT_CHECKPOINT_CHOICES
        }),
        'return_shelter_portal',
        evidence
      );
      if (run.run?.dungeonId !== 'false_testimony_court' || run.run.currentNodeId !== 'verdict_gate') {
        throw new BalanceSimulationError('Tier16 portal farm missed its Tier17 central landing.');
      }
      run = useTrackedPortal(
        moveAlongRoutePath(run, 'return_testimony_portal', evidence),
        'return_testimony_portal',
        evidence
      );
      if (run.run?.dungeonId !== 'combat_replay_stage' || run.run.currentNodeId !== 'stage_gate') {
        throw new BalanceSimulationError('Tier17 portal farm missed its Tier18 central landing.');
      }
      run = useTrackedPortal(
        moveAlongRoutePath(run, 'return_rehearsal_portal', evidence),
        'return_rehearsal_portal',
        evidence
      );
      if (run.run?.dungeonId !== 'panopticon_city' || run.run.currentNodeId !== 'panopticon_gate') {
        throw new BalanceSimulationError('Tier18 portal farm missed its Tier19 central landing.');
      }
      run = useTrackedPortal(
        moveAlongRoutePath(run, 'refraction_return_portal', evidence),
        'refraction_return_portal',
        evidence
      );
      if (run.run?.dungeonId !== 'demon_tower_1' || run.run.currentNodeId !== 'quiet_prayer_reward') {
        throw new BalanceSimulationError('Tier19 portal farm missed its Tier1 landing.');
      }
      const settled = resolvePendingRunRelicArchive(resolveExit(collectRouteRewards(run, 'demon_tower_1', evidence)));
      state = restoreSimulationHealth(returnToHub(settled));
      if (
        state.completedDungeonIds.includes('lost_shelter') !== completedBefore ||
        state.claimedTaskIds.includes('mainline_clear_lost_shelter') !== mainlineBefore
      ) {
        throw new BalanceSimulationError('Tier16/Tier17 portal farm incorrectly changed shelter mainline completion.');
      }
    }
    materialFarmRuns += 1;
    if (state.inventory.rescue_badge <= before) {
      throw new BalanceSimulationError('Lost-shelter material replay did not bank rescue_badge through the real exit.');
    }
  }
  const rescueBadgesAfterFarm = state.inventory.rescue_badge;
  if (rescueBadgesAfterFarm < getLostShelterPreparationBadgeCost(state)) {
    throw new BalanceSimulationError('Lost-shelter material replays did not fund all four rank-II rescue items.');
  }

  if (!state.ownedCompanions?.includes('qin_che')) state = recruitCompanion(state, 'qin_che');
  while ((state.companionRanks?.qin_che ?? 0) < 2) {
    const beforeRank = state.companionRanks?.qin_che ?? 0;
    state = upgradeCompanion(state, 'qin_che');
    if ((state.companionRanks?.qin_che ?? 0) === beforeRank) {
      throw new BalanceSimulationError('Lost-shelter preparation could not train Qin Che to R2.');
    }
  }
  state = activateCompanion(state, 'qin_che');
  if (state.activeCompanion !== 'qin_che' || state.companionRanks.qin_che !== 2) {
    throw new BalanceSimulationError('Lost-shelter preparation did not freeze Qin Che at exactly R2.');
  }

  const preparationMethodId: MethodId = materialSource === 'completed_replay'
    ? 'star_core_method'
    : 'iron_body';
  for (let attempt = 0; !state.learnedMethods.includes(preparationMethodId) && attempt < 4; attempt += 1) {
    state = learnMethod(state, preparationMethodId);
    if (state.learnedMethods.includes(preparationMethodId)) break;
    const fundingDungeonId: DungeonId = preparationMethodId === 'star_core_method'
      ? 'starfall_mine'
      : 'dream_archive';
    state = restoreSimulationHealth(returnToHub(clearDungeonViaExit(
      state,
      fundingDungeonId,
      createRouteCombatEvidence({ prioritizeHealing: true, healingTargetRatio: 0.65 })
    )));
  }
  while ((state.methodRanks?.[preparationMethodId] ?? 1) < 3) {
    const beforeRank = state.methodRanks?.[preparationMethodId] ?? 1;
    state = upgradeMethod(state, preparationMethodId);
    if ((state.methodRanks?.[preparationMethodId] ?? 1) === beforeRank) {
      state = restoreSimulationHealth(returnToHub(clearDungeonViaExit(
        state,
        'dream_archive',
        createRouteCombatEvidence({ prioritizeHealing: true, healingTargetRatio: 0.65 })
      )));
      if ((state.methodRanks?.[preparationMethodId] ?? 1) === beforeRank) {
        state = upgradeMethod(state, preparationMethodId);
      }
    }
  }
  state = activateMethod(state, preparationMethodId);
  if (state.ownedPets.includes('starling_drone')) state = activatePet(state, 'starling_drone');
  if (state.bloodlineRanks.bastion_chitin !== undefined) state = activateBloodline(state, 'bastion_chitin');
  if (
    state.activeMethod !== preparationMethodId ||
    state.activePet !== 'starling_drone' ||
    state.activeBloodline !== 'bastion_chitin'
  ) {
    throw new BalanceSimulationError(
      `Lost-shelter preparation is missing its real method, pet, or bloodline state ` +
        `(method=${state.activeMethod ?? 'none'}@${state.methodRanks?.[preparationMethodId] ?? 0}, ` +
        `pet=${state.activePet ?? 'none'}, bloodline=${state.activeBloodline ?? 'none'}).`
    );
  }

  for (const [equipmentId, attunementId] of LOST_SHELTER_EQUIPMENT_PREPARATION) {
    const materialFundingDungeon: Partial<Record<ItemId, DungeonId>> = {
      star_iron: 'starfall_mine',
      phase_glass: 'mirror_cycle_city',
      rift_dust: 'void_citadel',
      chronal_glass: 'temporal_observatory'
    };
    for (let attempt = 0; !state.ownedEquipment.includes(equipmentId) && attempt < 8; attempt += 1) {
      state = buyEquipment(state, equipmentId);
      if (state.ownedEquipment.includes(equipmentId)) break;
      const missingMaterial = (Object.entries(EQUIPMENT[equipmentId].cost.items ?? {}) as Array<[ItemId, number]>)
        .find(([itemId, amount]) => state.inventory[itemId] < amount)?.[0];
      const fundingDungeonId = (missingMaterial && materialFundingDungeon[missingMaterial]) ||
        'silent_broadcast_tower';
      const fundingEvidence = createRouteCombatEvidence({ prioritizeHealing: true, healingTargetRatio: 0.65 });
      state = restoreSimulationHealth(returnToHub(clearDungeonViaExit(state, fundingDungeonId, fundingEvidence)));
    }
    if (!state.ownedEquipment.includes(equipmentId)) {
      throw new BalanceSimulationError(`Lost-shelter preparation could not buy ${equipmentId}.`);
    }
    while ((state.equipmentLevels[equipmentId] ?? 1) < EQUIPMENT[equipmentId].maxLevel) {
      const beforeLevel = state.equipmentLevels[equipmentId] ?? 1;
      state = upgradeEquipment(state, equipmentId);
      if ((state.equipmentLevels[equipmentId] ?? 1) === beforeLevel) {
        throw new BalanceSimulationError(`Lost-shelter preparation could not max ${equipmentId}.`);
      }
    }
    state = attuneEquipment(state, equipmentId, attunementId);
    if (state.equipmentAttunements?.[equipmentId] !== attunementId) {
      throw new BalanceSimulationError(`Lost-shelter preparation could not attune ${equipmentId}.`);
    }
    while ((state.equipmentTemperRanks?.[equipmentId] ?? 0) < 2) {
      const beforeRank = state.equipmentTemperRanks?.[equipmentId] ?? 0;
      state = temperEquipment(state, equipmentId);
      if ((state.equipmentTemperRanks?.[equipmentId] ?? 0) === beforeRank) {
        throw new BalanceSimulationError(`Lost-shelter preparation could not temper ${equipmentId} to rank II.`);
      }
    }
    state = equipEquipment(state, equipmentId);
  }

  if (state.learnedMethods.includes(preparationMethodId)) state = activateMethod(state, preparationMethodId);
  if (state.ownedPets.includes('starling_drone')) state = activatePet(state, 'starling_drone');
  if (state.bloodlineRanks.bastion_chitin !== undefined) state = activateBloodline(state, 'bastion_chitin');

  return { state, materialFarmRuns, rescueBadgesBeforeFarm, rescueBadgesAfterFarm };
}

function simulateLostShelterSpecializationBranch(
  baseState: GameState,
  branchNodeId: LostShelterSpecializationBranchEvidence['branchNodeId'],
  checkpointChoices: Readonly<Record<EscortCheckpointNodeId, EscortCheckpointChoice>>,
  routeNodeIds: readonly string[]
): LostShelterSpecializationBranchEvidence {
  const monsterScript = LOST_SHELTER_SURVIVAL_SCRIPT;
  const evidence = createRouteCombatEvidence({
    prioritizeHealing: true,
    healingTargetRatio: 0.65,
    visitedNodeIds: [],
    combatProfiles: [],
    combatActions: [],
    lawStatuses: [],
    scriptedActions: {
      north_rescue_patrol: monsterScript,
      shelter_enforcer_north: monsterScript,
      mimic_survivor_alpha: monsterScript,
      evacuation_horror_omega: monsterScript,
      mimic_survivor: monsterScript,
      shelter_overseer: LOST_SHELTER_BOSS_SURVIVAL_SCRIPT
    }
  });
  let state = enterPreparedDungeon(baseState, 'lost_shelter', evidence, {
    plannedNodeIds: routeNodeIds,
    inventoryTargets: {
      thunder_talisman: 8,
      armor_patch: 32,
      focus_incense: 32,
      healing_pill: 64
    },
    methodTechnique: 'live'
  });
  const entryStatus = getCurrentEscortCheckpointStatus(state);
  if (!entryStatus) throw new BalanceSimulationError(`${branchNodeId}: missing escort entry snapshot.`);
  if (
    !Object.values(entryStatus.entryGear).every(Boolean) ||
    entryStatus.entryCompanion.id !== 'qin_che' ||
    entryStatus.entryCompanion.rank !== 2
  ) {
    throw new BalanceSimulationError(`${branchNodeId}: rescue gear or Qin Che R2 was not frozen at entry.`);
  }

  for (const nodeId of routeNodeIds) {
    state = moveAlongRoutePath(state, nodeId, evidence, { escortCheckpointChoices: checkpointChoices });
    recordDungeonLawStatus(state, evidence, `${branchNodeId}:${nodeId}`);
  }
  const branchStatus = getCurrentEscortCheckpointStatus(state);
  const reachedBranch =
    state.run?.currentNodeId === branchNodeId &&
    state.run.clearedNodeIds.includes(branchNodeId);
  if (!branchStatus?.allCheckpointsResolved || !reachedBranch) {
    throw new BalanceSimulationError(`${branchNodeId}: specialization did not resolve all checkpoints and enter its branch.`);
  }

  const bossApproachNodeIds = branchNodeId === 'evacuation_cache'
    ? ['north_entry', 'collapsed_hall_trap', 'survivor_cell', 'survivor_memory_stage']
    : branchNodeId === 'balanced_medbay'
      ? ['lower_return_portal', 'containment_bay', 'emergency_medbay', 'survivor_memory_stage']
      : [];
  for (const nodeId of bossApproachNodeIds) {
    state = moveAlongRoutePath(state, nodeId, evidence, { escortCheckpointChoices: checkpointChoices });
  }

  let settled: GameState;
  try {
    settled = settleLawRoute(state, 'lost_shelter', evidence);
  } catch (error) {
    throw new BalanceSimulationError(
      `${branchNodeId}: visited=${evidence.visitedNodeIds?.join(',') ?? 'none'}; ` +
        `${error instanceof Error ? error.message : String(error)}`
    );
  }
  const settledStatus = getCurrentEscortCheckpointStatus(settled);
  const bossNodeId = getBossDefinition('lost_shelter').nodeId;
  const exitNodeId = DUNGEONS.lost_shelter.nodes.find((node) => node.type === 'exit')?.id;
  return {
    branchNodeId,
    reachedBranch,
    survivorHpAtBranch: branchStatus.survivorHp,
    resolvedCheckpointChoices: { ...branchStatus.resolvedCheckpointChoices },
    treatCount: branchStatus.treatCount,
    pushCount: branchStatus.pushCount,
    entryGear: { ...branchStatus.entryGear },
    entryCompanion: { ...branchStatus.entryCompanion },
    companionRole: branchStatus.companionRole,
    firstHazardGuardUsed: branchStatus.firstHazardGuardUsed,
    bossSurvivorSnapshot: settledStatus?.bossSurvivorSnapshot ?? null,
    bossNodeCleared: settled.run?.clearedNodeIds.includes(bossNodeId) ?? false,
    exitNodeCleared: exitNodeId ? settled.run?.clearedNodeIds.includes(exitNodeId) ?? false : false,
    completed: settled.completedDungeonIds.includes('lost_shelter'),
    playerSurvived: settled.player.hp > 0,
    survivorAlive: (settledStatus?.survivorHp ?? 0) > 0,
    routeEvidence: getRouteLegalityEvidence(evidence)
  };
}

export function simulateLostShelterSpecializationRoutes(
  initialState: GameState = simulateSevenDungeonVictoryRoute().finalState
): LostShelterSpecializationRouteResult {
  const prepared = prepareLostShelterSpecializationHubState(initialState);
  const evacuation = simulateLostShelterSpecializationBranch(
    prepared.state,
    'evacuation_cache',
    { north_checkpoint: 'push', central_checkpoint: 'treat', south_checkpoint: 'push' },
    [
      'alarm_grid_trap',
      'south_checkpoint',
      'alarm_grid_trap',
      'survivor_memory_stage',
      'survivor_cell',
      'central_checkpoint',
      'north_checkpoint',
      'central_checkpoint',
      'survivor_cell',
      'collapsed_hall_trap',
      'north_entry',
      'evacuation_cache'
    ]
  );
  const desperate = simulateLostShelterSpecializationBranch(
    prepared.state,
    'desperate_armory',
    { north_checkpoint: 'push', central_checkpoint: 'push', south_checkpoint: 'push' },
    [
      'alarm_grid_trap',
      'south_checkpoint',
      'mimic_survivor',
      'command_lock',
      'mimic_survivor_alpha',
      'central_checkpoint',
      'collapsed_hall_trap',
      'north_checkpoint',
      'desperate_armory'
    ]
  );
  const balanced = simulateLostShelterSpecializationBranch(
    prepared.state,
    'balanced_medbay',
    { north_checkpoint: 'push', central_checkpoint: 'treat', south_checkpoint: 'push' },
    [
      'alarm_grid_trap',
      'south_checkpoint',
      'central_checkpoint',
      'north_checkpoint',
      'command_lock',
      'collapsed_hall_trap',
      'balanced_medbay'
    ]
  );

  const equippedEquipmentIds = LOST_SHELTER_EQUIPMENT_PREPARATION.map(([equipmentId]) => equipmentId);
  return {
    baseState: prepared.state,
    materialFarmRuns: prepared.materialFarmRuns,
    rescueBadgesBeforeFarm: prepared.rescueBadgesBeforeFarm,
    rescueBadgesAfterFarm: prepared.rescueBadgesAfterFarm,
    equippedEquipmentIds,
    equipmentLevels: Object.fromEntries(
      equippedEquipmentIds.map((equipmentId) => [equipmentId, prepared.state.equipmentLevels[equipmentId]])
    ),
    equipmentTemperRanks: Object.fromEntries(
      equippedEquipmentIds.map((equipmentId) => [equipmentId, prepared.state.equipmentTemperRanks?.[equipmentId]])
    ),
    equipmentAttunements: Object.fromEntries(
      equippedEquipmentIds.map((equipmentId) => [equipmentId, prepared.state.equipmentAttunements?.[equipmentId]])
    ),
    evacuation,
    desperate,
    balanced
  };
}

const FALSE_TESTIMONY_EQUIPMENT_PREPARATION = [
  ['cross_examiner_sabre', 'forge_overdrive'],
  ['forensic_visor', 'mist_veilguard'],
  ['custody_shell', 'rift_anchor'],
  ['appeal_seal', 'chronal_stasis']
] as const satisfies readonly (readonly [EquipmentId, EquipmentAttunementId])[];

const FALSE_TESTIMONY_EVIDENCE_ROUTE = [
  ['residue_sterility_trap', 'residue_evidence'],
  ['timeline_checksum_trap', 'timeline_evidence'],
  ['voice_filter_trap', 'voice_evidence']
] as const;

function runFalseTestimonyFundingReplay(state: GameState): GameState {
  const evidence = createRouteCombatEvidence({ prioritizeHealing: true, healingTargetRatio: 0.8 });
  const settled = clearDungeonViaExit(state, 'false_testimony_court', evidence);
  if (settled.phase !== 'result' || settled.player.hp <= 0) {
    throw new BalanceSimulationError('False-testimony material replay did not survive its real boss and exit route.');
  }
  return restoreSimulationHealth(returnToHub(settled));
}

function runFalseTestimonyPortalFundingRoute(state: GameState): GameState {
  const completedBefore = state.completedDungeonIds.includes('false_testimony_court');
  const replayCompletedBefore = state.completedDungeonIds.includes('combat_replay_stage');
  const panopticonCompletedBefore = state.completedDungeonIds.includes('panopticon_city');
  const mainlineBefore = state.claimedTaskIds.includes('mainline_clear_false_testimony_court');
  const replayMainlineBefore = state.claimedTaskIds.includes('mainline_clear_combat_replay_stage');
  const panopticonMainlineBefore = state.claimedTaskIds.includes('mainline_clear_panopticon_city');
  const evidence = createRouteCombatEvidence({
    prioritizeHealing: true,
    healingTargetRatio: 0.8,
    companionAssistNodeId: 'shelter_enforcer_north',
    scriptedActions: {
      shelter_enforcer_north: LOST_SHELTER_SURVIVAL_SCRIPT,
      hostile_witness_north: FALSE_TESTIMONY_SURVIVAL_SCRIPT
    }
  });
  let run = enterFalseTestimonyCourtThroughShelterPortal(
    state,
    evidence,
    ['gate_sigil', 'focus_incense', 'dispel_talisman']
  );
  for (const [trapNodeId, evidenceNodeId] of FALSE_TESTIMONY_EVIDENCE_ROUTE.slice(1)) {
    run = clearFalseTestimonyEvidencePair(run, trapNodeId, evidenceNodeId, evidence);
  }
  run = moveAlongRoutePath(run, 'hostile_witness_north', evidence);
  run = useTrackedPortal(
    moveAlongRoutePath(run, 'upper_return_portal', evidence),
    'upper_return_portal',
    evidence
  );
  if (run.run?.dungeonId !== 'combat_replay_stage' || run.run.currentNodeId !== 'upper_entry') {
    throw new BalanceSimulationError('False-testimony portal farm missed its Tier 18 upper landing.');
  }
  run = useTrackedPortal(
    moveAlongRoutePath(run, 'upper_return_portal', evidence),
    'upper_return_portal',
    evidence
  );
  if (run.run?.dungeonId !== 'panopticon_city' || run.run.currentNodeId !== 'upper_entry') {
    throw new BalanceSimulationError('Combat-replay portal farm missed its Tier 19 upper landing.');
  }
  run = useTrackedPortal(
    moveAlongRoutePath(run, 'upper_return_portal', evidence),
    'upper_return_portal',
    evidence
  );
  if (run.run?.dungeonId !== 'demon_tower_1' || run.run.currentNodeId !== 'sealed_cache') {
    throw new BalanceSimulationError('Panopticon portal farm missed its Tier 1 upper landing.');
  }
  const settled = resolvePendingRunRelicArchive(
    resolveExit(collectRouteRewards(run, 'demon_tower_1', evidence))
  );
  const hub = restoreSimulationHealth(returnToHub(settled));
  if (
    hub.completedDungeonIds.includes('false_testimony_court') !== completedBefore ||
    hub.completedDungeonIds.includes('combat_replay_stage') !== replayCompletedBefore ||
    hub.completedDungeonIds.includes('panopticon_city') !== panopticonCompletedBefore ||
    hub.claimedTaskIds.includes('mainline_clear_false_testimony_court') !== mainlineBefore ||
    hub.claimedTaskIds.includes('mainline_clear_combat_replay_stage') !== replayMainlineBefore ||
    hub.claimedTaskIds.includes('mainline_clear_panopticon_city') !== panopticonMainlineBefore
  ) {
    throw new BalanceSimulationError('False-testimony portal farm changed Tier 17/18/19 mainline completion.');
  }
  return hub;
}

function prepareFalseTestimonySpecializationHubState(
  initialState: GameState,
  materialSource: 'completed_replay' | 'portal_farm' = 'completed_replay'
): {
  state: GameState;
  materialFarmRuns: number;
  truthFragmentsBeforeFarm: number;
  truthFragmentsAfterFarm: number;
} {
  let state = restoreSimulationHealth(
    initialState.phase === 'hub'
      ? structuredClone(initialState)
      : returnToHub(structuredClone(initialState))
  );
  const truthFragmentsBeforeFarm = state.inventory.truth_fragment;
  let materialFarmRuns = 0;

  const runFundingRoute = materialSource === 'portal_farm'
    ? runFalseTestimonyPortalFundingRoute
    : runFalseTestimonyFundingReplay;
  state = runFundingRoute(state);
  materialFarmRuns += 1;
  const truthFragmentsAfterFarm = state.inventory.truth_fragment;

  for (const [equipmentId, attunementId] of FALSE_TESTIMONY_EQUIPMENT_PREPARATION) {
    for (let attempt = 0; !state.ownedEquipment.includes(equipmentId) && attempt < 8; attempt += 1) {
      state = buyEquipment(state, equipmentId);
      if (!state.ownedEquipment.includes(equipmentId)) {
        state = runFundingRoute(state);
        materialFarmRuns += 1;
      }
    }
    if (!state.ownedEquipment.includes(equipmentId)) {
      throw new BalanceSimulationError(`False-testimony preparation could not buy ${equipmentId}.`);
    }

    for (let attempt = 0; (state.equipmentLevels[equipmentId] ?? 1) < EQUIPMENT[equipmentId].maxLevel && attempt < 8; attempt += 1) {
      const beforeLevel = state.equipmentLevels[equipmentId] ?? 1;
      state = upgradeEquipment(state, equipmentId);
      if ((state.equipmentLevels[equipmentId] ?? 1) === beforeLevel) {
        state = runFundingRoute(state);
        materialFarmRuns += 1;
      }
    }
    if ((state.equipmentLevels[equipmentId] ?? 1) !== EQUIPMENT[equipmentId].maxLevel) {
      throw new BalanceSimulationError(`False-testimony preparation could not max ${equipmentId}.`);
    }

    state = attuneEquipment(state, equipmentId, attunementId);
    if (state.equipmentAttunements?.[equipmentId] !== attunementId) {
      throw new BalanceSimulationError(`False-testimony preparation could not attune ${equipmentId}.`);
    }
    for (let attempt = 0; (state.equipmentTemperRanks?.[equipmentId] ?? 0) < 2 && attempt < 8; attempt += 1) {
      const beforeRank = state.equipmentTemperRanks?.[equipmentId] ?? 0;
      state = temperEquipment(state, equipmentId);
      if ((state.equipmentTemperRanks?.[equipmentId] ?? 0) === beforeRank) {
        state = runFundingRoute(state);
        materialFarmRuns += 1;
      }
    }
    if ((state.equipmentTemperRanks?.[equipmentId] ?? 0) !== 2) {
      throw new BalanceSimulationError(`False-testimony preparation could not temper ${equipmentId} to rank II.`);
    }
    state = equipEquipment(state, equipmentId);
  }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const ready =
      state.ownedEquipment.includes('echo_breaker_gauntlets') &&
      state.equipmentLevels.echo_breaker_gauntlets === EQUIPMENT.echo_breaker_gauntlets.maxLevel &&
      state.equipmentAttunements?.echo_breaker_gauntlets === 'rift_resonance' &&
      (state.equipmentTemperRanks?.echo_breaker_gauntlets ?? 0) === 2;
    if (ready) break;
    const before = {
      owned: state.ownedEquipment.includes('echo_breaker_gauntlets'),
      level: state.equipmentLevels.echo_breaker_gauntlets ?? 0,
      attunement: state.equipmentAttunements?.echo_breaker_gauntlets,
      temper: state.equipmentTemperRanks?.echo_breaker_gauntlets ?? 0
    };
    if (!before.owned) state = buyEquipment(state, 'echo_breaker_gauntlets');
    else if (before.level < EQUIPMENT.echo_breaker_gauntlets.maxLevel) {
      state = upgradeEquipment(state, 'echo_breaker_gauntlets');
    } else if (before.attunement !== 'rift_resonance') {
      state = attuneEquipment(state, 'echo_breaker_gauntlets', 'rift_resonance');
    } else if (before.temper < 2) {
      state = temperEquipment(state, 'echo_breaker_gauntlets');
    }
    const after = {
      owned: state.ownedEquipment.includes('echo_breaker_gauntlets'),
      level: state.equipmentLevels.echo_breaker_gauntlets ?? 0,
      attunement: state.equipmentAttunements?.echo_breaker_gauntlets,
      temper: state.equipmentTemperRanks?.echo_breaker_gauntlets ?? 0
    };
    if (JSON.stringify(after) === JSON.stringify(before)) {
      state = restoreSimulationHealth(returnToHub(clearDungeonViaExit(
        state,
        'causal_clearinghouse',
        createRouteCombatEvidence({ prioritizeHealing: true, healingTargetRatio: 0.75 })
      )));
      materialFarmRuns += 1;
    }
  }
  if (
    !state.ownedEquipment.includes('echo_breaker_gauntlets') ||
    state.equipmentLevels.echo_breaker_gauntlets !== EQUIPMENT.echo_breaker_gauntlets.maxLevel ||
    state.equipmentAttunements?.echo_breaker_gauntlets !== 'rift_resonance' ||
    (state.equipmentTemperRanks?.echo_breaker_gauntlets ?? 0) !== 2
  ) {
    throw new BalanceSimulationError('False-testimony specialization could not mature echo_breaker_gauntlets.');
  }

  for (let attempt = 0; (state.bloodlineRanks.void_symbiote ?? 0) < 3 && attempt < 8; attempt += 1) {
    const beforeRank = state.bloodlineRanks.void_symbiote ?? 0;
    state = beforeRank === 0
      ? unlockBloodline(state, 'void_symbiote')
      : upgradeBloodline(state, 'void_symbiote');
    if ((state.bloodlineRanks.void_symbiote ?? 0) === beforeRank) {
      state = restoreSimulationHealth(returnToHub(clearDungeonViaExit(
        state,
        'genesis_vault',
        createRouteCombatEvidence({ prioritizeHealing: true, healingTargetRatio: 0.75 })
      )));
      materialFarmRuns += 1;
    }
  }
  if (state.bloodlineRanks.void_symbiote !== 3) {
    throw new BalanceSimulationError('False-testimony specialization could not prepare void_symbiote R3.');
  }
  if (state.learnedMethods.includes('iron_body')) state = activateMethod(state, 'iron_body');
  if (state.ownedPets.includes('starling_drone')) state = activatePet(state, 'starling_drone');
  if (state.ownedCompanions.includes('lu_guanlan')) state = activateCompanion(state, 'lu_guanlan');
  if (state.bloodlineRanks.bastion_chitin !== undefined) state = activateBloodline(state, 'bastion_chitin');
  if (
    state.activeMethod !== 'iron_body' ||
    state.activePet !== 'starling_drone' ||
    state.activeCompanion !== 'lu_guanlan' ||
    state.activeBloodline !== 'bastion_chitin'
  ) {
    throw new BalanceSimulationError('False-testimony preparation lost its real method, pet, companion, or bloodline.');
  }

  return {
    state: restoreSimulationHealth(state),
    materialFarmRuns,
    truthFragmentsBeforeFarm,
    truthFragmentsAfterFarm
  };
}

function clearFalseTestimonyEvidencePair(
  state: GameState,
  trapNodeId: (typeof FALSE_TESTIMONY_EVIDENCE_ROUTE)[number][0],
  evidenceNodeId: (typeof FALSE_TESTIMONY_EVIDENCE_ROUTE)[number][1],
  evidence: RouteCombatEvidence,
  options: RouteMovementOptions = {}
): GameState {
  if (state.run?.clearedNodeIds.includes(evidenceNodeId)) {
    throw new BalanceSimulationError(`${evidenceNodeId}: evidence was revealed before its paired trap.`);
  }
  const trapTraceCount = evidence.trapChoiceTrace.length;
  let nextState = moveAlongRoutePath(state, trapNodeId, evidence, options);
  if (nextState.run?.clearedNodeIds.includes(evidenceNodeId)) {
    throw new BalanceSimulationError(`${evidenceNodeId}: route revealed evidence while approaching its paired trap.`);
  }
  const trapChoice = evidence.trapChoiceTrace.slice(trapTraceCount).find(
    (choice) => choice.nodeId === trapNodeId
  );
  if (!trapChoice || trapChoice.choice !== 'counter' || trapChoice.damage !== 0 || !trapChoice.cleared) {
    throw new BalanceSimulationError(`${trapNodeId}: paired evidence trap was not countered cleanly.`);
  }
  nextState = moveAlongRoutePath(nextState, evidenceNodeId, evidence, options);
  if (!nextState.run?.clearedNodeIds.includes(evidenceNodeId)) {
    throw new BalanceSimulationError(`${evidenceNodeId}: evidence was not revealed after its paired trap.`);
  }
  return nextState;
}

function enterFalseTestimonySpecialization(
  baseState: GameState,
  evidence: RouteCombatEvidence,
  tacticalItemIds?: readonly TacticalItemId[],
  collectShelterRelics = false
): GameState {
  return enterFalseTestimonyCourtThroughShelterPortal(
    baseState,
    evidence,
    tacticalItemIds,
    collectShelterRelics
  );
}

function getFalseTestimonyBranchEvidence(
  state: GameState,
  branchNodeId: FalseTestimonySpecializationBranchEvidence['branchNodeId'],
  accusationRewardPoints: number,
  evidence: RouteCombatEvidence,
  appealEligibleAfterBranch = false,
  appealResolvedAfterBranch = false
): FalseTestimonySpecializationBranchEvidence {
  const status = getFalseTestimonyGameApi().getCurrentVerdictStatus(state);
  if (!status) throw new BalanceSimulationError(`${branchNodeId}: missing false-testimony status.`);
  const bossNodeId = getBossDefinition('false_testimony_court').nodeId;
  const exitNodeId = DUNGEONS.false_testimony_court.nodes.find((node) => node.type === 'exit')?.id;
  return {
    branchNodeId,
    reachedBranch: state.run?.clearedNodeIds.includes(branchNodeId) ?? false,
    revealedEvidenceIds: status.evidence.filter((item) => item.revealed).map((item) => item.id),
    contaminatedEvidenceIds: status.evidence.filter((item) => item.contaminated).map((item) => item.id),
    currentTrustedCount: status.currentTrustedCount,
    accusationCorrect: status.accusationCorrect,
    accusationTrustedCount: status.accusationTrustedCount,
    appealUsed: status.appealUsed,
    accusationRewardPoints,
    projectedAccusationRewardPoints: status.projectedAccusationRewardPoints,
    appealEligibleAfterBranch,
    appealResolvedAfterBranch,
    entryGear: { ...status.entryGear },
    bossVerdictSnapshot: status.bossVerdictSnapshot,
    bossNodeCleared: state.run?.clearedNodeIds.includes(bossNodeId) ?? false,
    exitNodeCleared: exitNodeId ? state.run?.clearedNodeIds.includes(exitNodeId) ?? false : false,
    completed: state.completedDungeonIds.includes('false_testimony_court'),
    playerSurvived: state.player.hp > 0,
    routeEvidence: getRouteLegalityEvidence(evidence)
  };
}

function simulateFalseTestimonySpecializationBranch(
  baseState: GameState,
  branchNodeId: FalseTestimonySpecializationBranchEvidence['branchNodeId'],
  accusationEvidencePairCount = branchNodeId === 'truth_archive' ? 3 : 2
): FalseTestimonySpecializationBranchEvidence {
  const evidence = createRouteCombatEvidence({
    prioritizeHealing: true,
    healingTargetRatio: 0.8,
    useAllCombatSupports: true,
    chooseRunRelic: (_state, candidateIds) =>
      candidateIds.find((relicId) => relicId === 'mending_thread') ?? candidateIds[0],
    methodTechniqueNodeId: 'false_testimony_judge',
    deferMethodTechniqueNodeId:
      branchNodeId === 'false_verdict_vault' ? 'false_testimony_judge' : undefined,
    companionAssistNodeId: 'false_testimony_judge',
    bloodlineSurgeNodeId: 'false_testimony_judge',
    soulSkipNodeId: 'false_testimony_judge',
    reserveWeaponSkillForNodeId: 'false_testimony_judge',
    scriptedActions: {
      shelter_enforcer_north: LOST_SHELTER_SURVIVAL_SCRIPT,
      hostile_witness_north: FALSE_TESTIMONY_SURVIVAL_SCRIPT,
      archive_censor_alpha: FALSE_TESTIMONY_SURVIVAL_SCRIPT,
      perjury_hound_omega: FALSE_TESTIMONY_SURVIVAL_SCRIPT,
      hostile_witness: FALSE_TESTIMONY_SURVIVAL_SCRIPT,
      soul_recharge_verdict: FALSE_TESTIMONY_SURVIVAL_SCRIPT,
      false_testimony_judge:
        branchNodeId === 'false_verdict_vault'
          ? FALSE_TESTIMONY_WRONG_VERDICT_BOSS_SCRIPT
          : FALSE_TESTIMONY_BOSS_SURVIVAL_SCRIPT
    }
  });
  let branchBaseState = branchNodeId === 'false_verdict_vault'
    ? activateBloodline(configureRunRelicPreparation(baseState, 'bulwark'), 'void_symbiote')
    : baseState;
  if (branchNodeId === 'false_verdict_vault') {
    if (
      !branchBaseState.ownedEquipment.includes('echo_breaker_gauntlets') ||
      branchBaseState.equipmentLevels.echo_breaker_gauntlets !== EQUIPMENT.echo_breaker_gauntlets.maxLevel ||
      (branchBaseState.equipmentTemperRanks?.echo_breaker_gauntlets ?? 0) !== 2
    ) {
      throw new BalanceSimulationError('False-verdict route is missing its campaign-mature echo breaker gauntlets.');
    }
    branchBaseState = equipEquipment(branchBaseState, 'echo_breaker_gauntlets');
  }
  let state = enterFalseTestimonySpecialization(
    branchBaseState,
    evidence,
    branchNodeId === 'false_verdict_vault'
      ? ['armor_patch', 'dispel_talisman', 'healing_pill']
      : undefined,
    branchNodeId === 'false_verdict_vault'
  );
  const pairCount = accusationEvidencePairCount;
  if (
    pairCount < 1 ||
    pairCount > 3 ||
    (branchNodeId !== 'swift_judgment_armory' && pairCount !== (branchNodeId === 'truth_archive' ? 3 : 2))
  ) {
    throw new BalanceSimulationError(`${branchNodeId}: invalid accusation evidence pair count ${pairCount}.`);
  }
  for (const [trapNodeId, evidenceNodeId] of FALSE_TESTIMONY_EVIDENCE_ROUTE.slice(0, pairCount)) {
    state = clearFalseTestimonyEvidencePair(state, trapNodeId, evidenceNodeId, evidence);
  }

  const suspect: FalseTestimonySuspect = branchNodeId === 'false_verdict_vault'
    ? 'records_keeper'
    : 'route_surveyor';
  state = moveAlongRoutePath(state, 'verdict_chamber', evidence, { falseTestimonySuspect: suspect });
  const accusation = evidence.falseTestimonyAccusationTrace.at(-1);
  if (!accusation || accusation.nodeId !== 'verdict_chamber') {
    throw new BalanceSimulationError(`${branchNodeId}: original accusation did not use the verdict API.`);
  }

  if (branchNodeId === 'swift_judgment_armory') {
    for (const [trapNodeId, evidenceNodeId] of FALSE_TESTIMONY_EVIDENCE_ROUTE.slice(pairCount)) {
      state = clearFalseTestimonyEvidencePair(state, trapNodeId, evidenceNodeId, evidence);
    }
    state = moveAlongRoutePath(state, branchNodeId, evidence);
  } else if (branchNodeId === 'false_verdict_vault') {
    for (const nodeId of [
      'residue_evidence',
      'hostile_witness',
      'return_testimony_portal',
      'evidence_supply_cache',
      'soul_recharge_verdict',
      'false_verdict_vault'
    ]) {
      state = moveAlongRoutePath(state, nodeId, evidence);
    }
  } else {
    state = moveAlongRoutePath(state, branchNodeId, evidence);
  }

  let appealEligibleAfterBranch = false;
  let appealResolvedAfterBranch = false;
  if (branchNodeId === 'false_verdict_vault') {
    const api = getFalseTestimonyGameApi();
    const statusAfterVault = api.getCurrentVerdictStatus(state);
    appealEligibleAfterBranch = statusAfterVault?.appealEligible ?? false;
    const attemptedAppeal = api.resolveCurrentVerdictChoice(state, 'route_surveyor');
    appealResolvedAfterBranch = attemptedAppeal !== state;
    if (appealEligibleAfterBranch || appealResolvedAfterBranch) {
      throw new BalanceSimulationError('False-verdict vault did not permanently close the appeal window.');
    }
  }
  const settled = settleLawRoute(state, 'false_testimony_court', evidence);
  return getFalseTestimonyBranchEvidence(
    settled,
    branchNodeId,
    accusation.rewardPointsDelta,
    evidence,
    appealEligibleAfterBranch,
    appealResolvedAfterBranch
  );
}

function simulateFalseTestimonyAppeal(
  baseState: GameState
): FalseTestimonySpecializationRouteResult['appeal'] {
  const evidence = createRouteCombatEvidence({
    prioritizeHealing: true,
    healingTargetRatio: 0.8,
    useAllCombatSupports: true,
    chooseRunRelic: (_state, candidateIds) =>
      candidateIds.find((relicId) => relicId === 'mending_thread') ?? candidateIds[0],
    methodTechniqueNodeId: 'false_testimony_judge',
    companionAssistNodeId: 'false_testimony_judge',
    bloodlineSurgeNodeId: 'false_testimony_judge',
    soulSkipNodeId: 'false_testimony_judge',
    reserveWeaponSkillForNodeId: 'false_testimony_judge',
    scriptedActions: {
      shelter_enforcer_north: LOST_SHELTER_SURVIVAL_SCRIPT,
      hostile_witness_north: FALSE_TESTIMONY_SURVIVAL_SCRIPT,
      archive_censor_alpha: FALSE_TESTIMONY_SURVIVAL_SCRIPT,
      perjury_hound_omega: FALSE_TESTIMONY_SURVIVAL_SCRIPT,
      hostile_witness: FALSE_TESTIMONY_SURVIVAL_SCRIPT,
      soul_recharge_verdict: FALSE_TESTIMONY_SURVIVAL_SCRIPT,
      false_testimony_judge: FALSE_TESTIMONY_BOSS_SURVIVAL_SCRIPT
    }
  });
  const appealBaseState = activateBloodline(
    configureRunRelicPreparation(baseState, 'bulwark'),
    'void_symbiote'
  );
  let state = enterFalseTestimonySpecialization(
    appealBaseState,
    evidence,
    ['armor_patch', 'dispel_talisman', 'healing_pill']
  );
  for (const [trapNodeId, evidenceNodeId] of FALSE_TESTIMONY_EVIDENCE_ROUTE.slice(0, 2)) {
    state = clearFalseTestimonyEvidencePair(state, trapNodeId, evidenceNodeId, evidence);
  }
  state = moveAlongRoutePath(state, 'verdict_chamber', evidence, {
    falseTestimonySuspect: 'records_keeper'
  });
  const wrongStatus = getFalseTestimonyGameApi().getCurrentVerdictStatus(state);
  if (!wrongStatus || wrongStatus.accusationCorrect !== false || !wrongStatus.appealEligible) {
    throw new BalanceSimulationError('Appeal route did not create an eligible original false verdict.');
  }
  const falseVaultClearedBeforeAppeal = state.run?.clearedNodeIds.includes('false_verdict_vault') ?? false;
  state = moveAlongRoutePath(state, 'appeal_desk', evidence, {
    falseTestimonySuspect: 'route_surveyor',
    resolveFalseTestimonyAppeal: true
  });
  const appealedStatus = getFalseTestimonyGameApi().getCurrentVerdictStatus(state);
  const appealTrace = evidence.falseTestimonyAccusationTrace.at(-1);
  if (
    !appealedStatus ||
    appealedStatus.accusationCorrect !== true ||
    !appealedStatus.appealUsed ||
    !appealTrace?.appealed ||
    appealTrace.rewardPointsDelta !== 0
  ) {
    throw new BalanceSimulationError('Appeal route did not reverse the verdict without granting original rewards.');
  }
  const settled = settleLawRoute(state, 'false_testimony_court', evidence);
  if (
    settled.run?.clearedNodeIds.includes('truth_archive') ||
    settled.run?.clearedNodeIds.includes('swift_judgment_armory')
  ) {
    throw new BalanceSimulationError('Appealed verdict incorrectly entered an original-correct specialization branch.');
  }
  return {
    wrongAccusationTrustedCount: wrongStatus.accusationTrustedCount,
    correctAfterAppeal: appealedStatus.accusationCorrect,
    appealUsed: appealedStatus.appealUsed,
    falseVaultClearedBeforeAppeal,
    rewardPointsAfterAppeal: appealTrace.rewardPointsDelta,
    completed: settled.completedDungeonIds.includes('false_testimony_court')
  };
}

export function simulateFalseTestimonySpecializationRoutes(
  initialState: GameState = simulateSevenDungeonVictoryRoute().finalState
): FalseTestimonySpecializationRouteResult {
  const prepared = prepareFalseTestimonySpecializationHubState(initialState);
  const truth = simulateFalseTestimonySpecializationBranch(prepared.state, 'truth_archive');
  const swift = simulateFalseTestimonySpecializationBranch(prepared.state, 'swift_judgment_armory');
  const swiftOneEvidence = simulateFalseTestimonySpecializationBranch(
    prepared.state,
    'swift_judgment_armory',
    1
  );
  const falseVerdict = simulateFalseTestimonySpecializationBranch(prepared.state, 'false_verdict_vault');
  const appeal = simulateFalseTestimonyAppeal(prepared.state);
  const equippedEquipmentIds = FALSE_TESTIMONY_EQUIPMENT_PREPARATION.map(([equipmentId]) => equipmentId);
  return {
    baseState: prepared.state,
    materialFarmRuns: prepared.materialFarmRuns,
    truthFragmentsBeforeFarm: prepared.truthFragmentsBeforeFarm,
    truthFragmentsAfterFarm: prepared.truthFragmentsAfterFarm,
    equippedEquipmentIds,
    equipmentLevels: Object.fromEntries(
      equippedEquipmentIds.map((equipmentId) => [equipmentId, prepared.state.equipmentLevels[equipmentId]])
    ),
    equipmentTemperRanks: Object.fromEntries(
      equippedEquipmentIds.map((equipmentId) => [equipmentId, prepared.state.equipmentTemperRanks?.[equipmentId]])
    ),
    equipmentAttunements: Object.fromEntries(
      equippedEquipmentIds.map((equipmentId) => [equipmentId, prepared.state.equipmentAttunements?.[equipmentId]])
    ),
    truth,
    swift,
    swiftOneEvidence,
    falseVerdict,
    appeal,
    falseVaultFirst: {
      falseVaultCleared: falseVerdict.reachedBranch,
      appealEligibleAfterVault: falseVerdict.appealEligibleAfterBranch,
      appealResolvedAfterVault: falseVerdict.appealResolvedAfterBranch
    }
  };
}

export function simulateLostShelterPortalRing(
  initialState: GameState = createPanopticonCityBalanceBaseState()
): readonly LostShelterPortalRingEvidence[] {
  const portalPairs = [
    {
      shelterPortalNodeId: 'upper_return_portal',
      testimonyLandingNodeId: 'north_entry',
      testimonyPortalNodeId: 'upper_return_portal',
      replayLandingNodeId: 'upper_entry',
      replayPortalNodeId: 'upper_return_portal',
      panopticonLandingNodeId: 'upper_entry',
      panopticonPortalNodeId: 'upper_return_portal',
      tierOneLandingNodeId: 'sealed_cache'
    },
    {
      shelterPortalNodeId: 'lower_return_portal',
      testimonyLandingNodeId: 'lower_entry',
      testimonyPortalNodeId: 'lower_return_portal',
      replayLandingNodeId: 'lower_entry',
      replayPortalNodeId: 'lower_return_portal',
      panopticonLandingNodeId: 'lower_entry',
      panopticonPortalNodeId: 'lower_return_portal',
      tierOneLandingNodeId: 'fog_lesser_demon'
    },
    {
      shelterPortalNodeId: 'return_shelter_portal',
      testimonyLandingNodeId: 'verdict_gate',
      testimonyPortalNodeId: 'return_testimony_portal',
      replayLandingNodeId: 'stage_gate',
      replayPortalNodeId: 'return_rehearsal_portal',
      panopticonLandingNodeId: 'panopticon_gate',
      panopticonPortalNodeId: 'refraction_return_portal',
      tierOneLandingNodeId: 'quiet_prayer_reward'
    }
  ] as const;

  return portalPairs.map((pair): LostShelterPortalRingEvidence => {
    const baseState = restoreSimulationHealth(initialState.phase === 'hub'
      ? structuredClone(initialState)
      : returnToHub(structuredClone(initialState)));
    const completedBefore = [...baseState.completedDungeonIds];
    const claimedBefore = baseState.claimedTaskIds.filter(
      (taskId) =>
        taskId === 'mainline_clear_lost_shelter' ||
        taskId === 'mainline_clear_false_testimony_court' ||
        taskId === 'mainline_clear_combat_replay_stage' ||
        taskId === 'mainline_clear_panopticon_city'
    );
    const evidence = createRouteCombatEvidence({ prioritizeHealing: true, healingTargetRatio: 0.65 });
    let state = enterPreparedDungeon(baseState, 'lost_shelter', evidence, {
      plannedNodeIds: [
        ...(STANDARD_ROUTE_PREPARATION_NODES.lost_shelter ?? []),
        pair.shelterPortalNodeId
      ],
      portalUseNodeIds: [pair.shelterPortalNodeId],
      additionalTacticalItemIds: ['gate_sigil', 'armor_patch', 'dispel_talisman'],
      inventoryTargets: { gate_sigil: 4, armor_patch: 16, dispel_talisman: 16, healing_pill: 32 },
      methodTechnique: 'live'
    });
    for (const nodeId of STANDARD_ROUTE_PREPARATION_NODES.lost_shelter ?? []) {
      state = moveAlongRoutePath(state, nodeId, evidence, {
        escortCheckpointChoices: STANDARD_ESCORT_CHECKPOINT_CHOICES
      });
    }
    state = moveAlongRoutePath(state, pair.shelterPortalNodeId, evidence, {
      escortCheckpointChoices: STANDARD_ESCORT_CHECKPOINT_CHOICES
    });
    state = useTrackedPortal(state, pair.shelterPortalNodeId, evidence);
    if (
      state.run?.dungeonId !== 'false_testimony_court' ||
      state.run.currentNodeId !== pair.testimonyLandingNodeId
    ) {
      throw new BalanceSimulationError(`${pair.shelterPortalNodeId}: Tier 16 portal missed its Tier 17 landing.`);
    }

    state = moveAlongRoutePath(state, pair.testimonyPortalNodeId, evidence);
    state = useTrackedPortal(state, pair.testimonyPortalNodeId, evidence);
    if (
      state.run?.dungeonId !== 'combat_replay_stage' ||
      state.run.currentNodeId !== pair.replayLandingNodeId
    ) {
      throw new BalanceSimulationError(`${pair.testimonyPortalNodeId}: Tier 17 portal missed its Tier 18 landing.`);
    }

    state = moveAlongRoutePath(state, pair.replayPortalNodeId, evidence);
    state = useTrackedPortal(state, pair.replayPortalNodeId, evidence);
    if (
      state.run?.dungeonId !== 'panopticon_city' ||
      state.run.currentNodeId !== pair.panopticonLandingNodeId
    ) {
      throw new BalanceSimulationError(`${pair.replayPortalNodeId}: Tier 18 portal missed its Tier 19 landing.`);
    }

    state = moveAlongRoutePath(state, pair.panopticonPortalNodeId, evidence);
    state = useTrackedPortal(state, pair.panopticonPortalNodeId, evidence);
    if (
      state.run?.dungeonId !== 'demon_tower_1' ||
      state.run.currentNodeId !== pair.tierOneLandingNodeId
    ) {
      throw new BalanceSimulationError(`${pair.panopticonPortalNodeId}: Tier 19 portal missed its Tier 1 landing.`);
    }

    const claimedAfter = state.claimedTaskIds.filter(
      (taskId) =>
        taskId === 'mainline_clear_lost_shelter' ||
        taskId === 'mainline_clear_false_testimony_court' ||
        taskId === 'mainline_clear_combat_replay_stage' ||
        taskId === 'mainline_clear_panopticon_city'
    );
    return {
      ...pair,
      dungeonIds: ['lost_shelter', 'false_testimony_court', 'combat_replay_stage', 'panopticon_city', 'demon_tower_1'],
      completedDungeonIdsUnchanged:
        JSON.stringify(state.completedDungeonIds) === JSON.stringify(completedBefore),
      mainlineClaimsUnchanged: JSON.stringify(claimedAfter) === JSON.stringify(claimedBefore),
      routeEvidence: getRouteLegalityEvidence(evidence)
    };
  });
}

function simulateDungeonLawRoute(baseState: GameState, dungeonId: DungeonId): LawRouteExecution {
  switch (dungeonId) {
    case 'demon_tower_1':
      return simulateDemonTowerLawRoute(baseState);
    case 'metro_abyss':
      return simulateMetroLawRoute(baseState);
    case 'starfall_mine':
      return simulateMineLawRoute(baseState);
    case 'rust_hospital':
      return simulateHospitalLawRoute(baseState);
    case 'ash_arena':
      return simulateArenaLawRoute(baseState);
    case 'dream_archive':
      return simulateArchiveLawRoute(baseState);
    case 'void_citadel':
      return simulateCitadelLawRoute(baseState);
    case 'temporal_observatory':
      return simulateTemporalObservatoryLawRoute(baseState);
    case 'causal_clearinghouse':
      return simulateCausalLawRoute(baseState);
    case 'entropy_ark':
      return simulateEntropyArkLawRoute(baseState);
    case 'mirror_cycle_city':
      return simulateMirrorCycleCityLawRoute(baseState);
    case 'redaction_scriptorium':
      return simulateRedactionScriptoriumLawRouteExecution(baseState);
    case 'legacy_auction_court':
      return simulateLegacyAuctionCourtLawRouteExecution(baseState);
    case 'genesis_vault':
      return simulateGenesisVaultLawRouteExecution(baseState);
    case 'silent_broadcast_tower':
      return simulateSilentBroadcastTowerLawRouteExecution(baseState);
    case 'lost_shelter':
      return simulateLostShelterLawRouteExecution(baseState);
    case 'false_testimony_court':
      return simulateFalseTestimonyCourtLawRouteExecution(baseState);
    case 'combat_replay_stage':
      return simulateCombatReplayStageLawRouteExecution(baseState);
    case 'panopticon_city':
      return simulatePanopticonCityLawRouteExecution(baseState);
  }
}

function getStageWarnings(stage: Omit<BalanceSimStage, 'warnings'>): string[] {
  const warnings: string[] = [];
  const overPowerRatio = stage.beforePower / stage.recommendedPower;

  if (stage.readiness === 'deadly') {
    warnings.push(`${stage.dungeonId} is deadly at ${stage.beforePower}/${stage.recommendedPower} power.`);
  }

  // A normal route should feel prepared, not wildly overleveled before entry.
  if (stage.tier <= 3 && overPowerRatio > 1.8) {
    warnings.push(`${stage.dungeonId} may be an early stomp at ${Math.round(overPowerRatio * 100)}% recommended power.`);
  }

  return warnings;
}

function getStageProgressionWarning(
  stage: Omit<BalanceSimStage, 'warnings'>,
  hasFollowingStage: boolean
): string | undefined {
  if (!hasFollowingStage) return undefined;
  const realizedPower = Math.max(stage.afterPower, stage.nextPreparedPower ?? stage.afterPower);
  const hasBankableGrowth = stage.growthSignals?.some((signal) => signal !== 'campaign-clear') ?? false;
  return realizedPower > stage.beforePower || hasBankableGrowth
    ? undefined
    : `${stage.dungeonId} grants neither effective power nor bankable growth before the next entry.`;
}

export function getBalanceVerdictFromWarnings(
  warnings: readonly string[]
): BalanceVerdict {
  return warnings.some(
    (warning) =>
      warning.includes('deadly') ||
      warning.includes('grants neither effective power nor bankable growth')
  )
    ? 'needs-adjustment'
    : 'balanced';
}

export function simulateCampaignBalance(options: CampaignBalanceOptions = {}): CampaignBalanceResult {
  if (!options.rewards) {
    const route = simulateSevenDungeonVictoryRoute(options.initialState);
    const stages = route.summaries.map((summary, index) => {
      const nextPreparedPower = route.summaries[index + 1]?.beforePower;
      const stageWithoutWarnings = {
        tier: summary.tier,
        dungeonId: summary.dungeonId,
        beforePower: summary.beforePower,
        afterPower: summary.afterPower,
        ...(nextPreparedPower === undefined ? {} : { nextPreparedPower }),
        growthSignals: [...summary.growthSignals],
        readiness: summary.readinessBeforeEntry,
        recommendedPower: DUNGEONS[summary.dungeonId].recommendedPower,
        plannedPurchases: summary.plannedPurchases,
        plannedUpgrades: summary.plannedUpgrades,
        plannedMethods: summary.plannedMethods,
        plannedPets: summary.plannedPets
      };

      const progressionWarning = getStageProgressionWarning(
        stageWithoutWarnings,
        index < route.summaries.length - 1
      );
      return {
        ...stageWithoutWarnings,
        warnings: [
          ...getStageWarnings(stageWithoutWarnings),
          ...(progressionWarning ? [progressionWarning] : [])
        ]
      };
    });
    const warnings = stages.flatMap((stage) => stage.warnings);

    return {
      verdict: getBalanceVerdictFromWarnings(warnings),
      warnings,
      stages
    };
  }

  let state = structuredClone(options.initialState ?? createInitialState());
  const stages: BalanceSimStage[] = [];

  for (const dungeonId of DUNGEON_ORDER) {
    const invested = investForDungeon(state, dungeonId);
    state = invested.state;

    const gateBeforeEntry = getGateStatus(state, dungeonId);
    if (gateBeforeEntry !== 'open') {
      stages.push({
        tier: DUNGEONS[dungeonId].tier,
        dungeonId,
        beforePower: getPlayerPower(state),
        afterPower: getPlayerPower(state),
        readiness: getDungeonReadiness(state, dungeonId),
        recommendedPower: DUNGEONS[dungeonId].recommendedPower,
        plannedPurchases: invested.plannedPurchases,
        plannedUpgrades: invested.plannedUpgrades,
        plannedMethods: invested.plannedMethods,
        plannedPets: invested.plannedPets,
        warnings: [`${dungeonId} gate is ${gateBeforeEntry}: ${getGateRequirement(state, dungeonId)}`]
      });
      break;
    }

    const dungeon = DUNGEONS[dungeonId];
    const beforePower = getPlayerPower(state);
    const readiness = getDungeonReadiness(state, dungeonId);
    const reward = options.rewards?.[dungeonId] ?? getDefaultDungeonReward(state, dungeonId);
    let settled: GameState;
    try {
      settled = clearDungeonViaExit(state, dungeonId);
    } catch (error) {
      if (!(error instanceof BalanceSimulationError)) throw error;

      const failedStage = {
        tier: dungeon.tier,
        dungeonId,
        beforePower,
        afterPower: beforePower,
        readiness,
        recommendedPower: dungeon.recommendedPower,
        plannedPurchases: invested.plannedPurchases,
        plannedUpgrades: invested.plannedUpgrades,
        plannedMethods: invested.plannedMethods,
        plannedPets: invested.plannedPets
      };
      stages.push({
        ...failedStage,
        warnings: [...getStageWarnings(failedStage), `${dungeonId} tactical route is deadly: ${error.message}`]
      });
      break;
    }
    const customRewardState = applyCustomStageReward(settled, state, reward);
    const afterState = claimMainlineAfterClear(customRewardState, dungeonId);
    const afterPower = getPlayerPower(afterState);
    const stageWithoutWarnings = {
      tier: dungeon.tier,
      dungeonId,
      beforePower,
      afterPower,
      growthSignals: getRouteGrowthSignals(state, afterState),
      readiness,
      recommendedPower: dungeon.recommendedPower,
      plannedPurchases: invested.plannedPurchases,
      plannedUpgrades: invested.plannedUpgrades,
      plannedMethods: invested.plannedMethods,
      plannedPets: invested.plannedPets
    };

    stages.push({
      ...stageWithoutWarnings,
      warnings: [
        ...getStageWarnings(stageWithoutWarnings),
        ...(!afterState.completedDungeonIds.includes(dungeonId)
          ? [`${dungeonId} did not complete through tactical route.`]
          : []),
        ...(!afterState.claimedTaskIds.includes(`mainline_clear_${dungeonId}`)
          ? [`${dungeonId} mainline task was not claimed after tactical clear.`]
          : [])
      ]
    });

    state = returnToHub(afterState);
  }

  const linkedStages = stages.map((stage, index) => {
    const nextPreparedPower = stages[index + 1]?.beforePower;
    const stageWithPreparation = {
      ...stage,
      ...(nextPreparedPower === undefined ? {} : { nextPreparedPower })
    };
    const progressionWarning = getStageProgressionWarning(
      stageWithPreparation,
      index < stages.length - 1
    );
    return progressionWarning
      ? { ...stageWithPreparation, warnings: [...stageWithPreparation.warnings, progressionWarning] }
      : stageWithPreparation;
  });
  const warnings = linkedStages.flatMap((stage) => stage.warnings);

  return {
    verdict: getBalanceVerdictFromWarnings(warnings),
    warnings,
    stages: linkedStages
  };
}

export function analyzeCampaignBalance(options: CampaignBalanceOptions = {}): CampaignBalanceResult {
  return simulateCampaignBalance(options);
}

function createCompanionAssistCombatFixture(
  companionId?: CompanionId,
  rank?: CompanionRank,
  saturated = false
): GameState {
  const initial = createInitialState();
  const prepared = companionId && rank
    ? {
        ...initial,
        ownedCompanions: [companionId],
        companionRanks: { [companionId]: rank },
        activeCompanion: companionId
      }
    : initial;
  const entered = enterDungeon(prepared, 'demon_tower_1');
  const monsterNode = DUNGEONS.demon_tower_1.nodes.find((node) => node.monsterId !== undefined);
  if (!entered.run || !monsterNode?.monsterId) {
    throw new BalanceSimulationError('Companion assist fixture could not enter its combat run.');
  }

  return {
    ...entered,
    phase: 'combat',
    player: {
      ...entered.player,
      hp: saturated ? entered.player.maxHp : 1
    },
    combat: {
      nodeId: monsterNode.id,
      monsterId: monsterNode.monsterId,
      monsterHp: MONSTERS[monsterNode.monsterId].maxHp,
      turn: 1,
      guarding: false,
      companionAssistUsed: false,
      weaponFocus: saturated ? 3 : 0,
      effects: {},
      log: []
    }
  };
}

export function simulateCompanionAssistBalance(): CompanionAssistBalanceResult {
  const matrix = COMPANION_CATALOG.flatMap((definition) =>
    ([1, 2, 3] as const).map((rank): CompanionAssistBalanceEvidence => {
      const beforeState = createCompanionAssistCombatFixture(definition.id, rank);
      const beforeStatus = getCurrentCompanionAssistStatus(beforeState);
      if (!beforeStatus.available || !beforeStatus.snapshot) {
        throw new BalanceSimulationError(`${definition.id} rank ${rank} assist was unavailable in its fixture.`);
      }

      const afterState = useCompanionAssist(beforeState);
      const afterStatus = getCurrentCompanionAssistStatus(afterState);
      const secondUseState = useCompanionAssist(afterState);
      const saturatedBefore = createCompanionAssistCombatFixture(definition.id, rank, true);
      const saturatedStatus = getCurrentCompanionAssistStatus(saturatedBefore);
      const saturatedAfter = useCompanionAssist(saturatedBefore);

      return {
        companionId: definition.id,
        rank,
        snapshot: beforeStatus.snapshot,
        effect: beforeStatus.effect,
        before: {
          hp: beforeState.player.hp,
          focus: beforeState.combat?.weaponFocus ?? 0,
          guarding: beforeState.combat?.guarding ?? false
        },
        after: {
          hp: afterState.player.hp,
          focus: afterState.combat?.weaponFocus ?? 0,
          guarding: afterState.combat?.guarding ?? false,
          used: afterState.combat?.companionAssistUsed === true
        },
        secondUseReason: afterStatus.reason,
        secondUsePreserved: secondUseState === afterState,
        saturated: {
          available: saturatedStatus.available,
          reason: saturatedStatus.reason,
          hpBefore: saturatedBefore.player.hp,
          hpAfter: saturatedAfter.player.hp,
          focusBefore: saturatedBefore.combat?.weaponFocus ?? 0,
          focusAfter: saturatedAfter.combat?.weaponFocus ?? 0
        }
      };
    })
  );
  const noCompanionState = createCompanionAssistCombatFixture();
  const noCompanionStatus = getCurrentCompanionAssistStatus(noCompanionState);

  return {
    matrix,
    noCompanion: {
      snapshotAbsent: noCompanionState.run?.companionSnapshot === undefined,
      legacyDisabled: noCompanionStatus.legacyDisabled,
      usePreserved: useCompanionAssist(noCompanionState) === noCompanionState
    }
  };
}

type MethodTechniqueGameApi = Readonly<{
  activateMethod: (state: GameState, methodId: MethodId) => GameState;
  upgradeMethod: (state: GameState, methodId: MethodId) => GameState;
  useMethodTechnique: (state: GameState) => GameState;
}>;

function getMethodTechniqueGameApi(): MethodTechniqueGameApi {
  const api = gameApi as typeof gameApi & Partial<MethodTechniqueGameApi>;
  if (!api.activateMethod || !api.upgradeMethod || !api.useMethodTechnique) {
    throw new BalanceSimulationError('Method technique game APIs are unavailable.');
  }
  return api as typeof gameApi & MethodTechniqueGameApi;
}

function getMethodTechniqueStateEvidence(state: GameState): MethodTechniqueStateEvidence {
  return {
    hp: state.player.hp,
    focus: state.combat?.weaponFocus ?? 0,
    guarding: state.combat?.guarding ?? false,
    rustPoisonStacks: state.combat?.effects?.rustPoisonStacks ?? 0,
    mirrorSlowStacks: state.combat?.effects?.mirrorSlowStacks ?? 0,
    breathStacks: state.combat?.effects?.breathStacks ?? 0,
    used: state.combat?.methodTechniqueUsed === true
  };
}

function getMethodTechniqueInvariantProjection(state: GameState): MethodTechniqueInvariantProjection {
  const effects = state.combat?.effects;
  return {
    phase: state.phase,
    combatNodeId: state.combat?.nodeId,
    turn: state.combat?.turn,
    monsterHp: state.combat?.monsterHp,
    bossPhase: state.combat?.bossPhase,
    companionAssistUsed: state.combat?.companionAssistUsed,
    weaponSkillUsed: state.combat?.weaponSkillUsed,
    equipmentMemoryState: structuredClone(state.combat?.equipmentMemoryState),
    intent: structuredClone(getCurrentCombatIntent(state)),
    runCurrentNodeId: state.run?.currentNodeId,
    runDamageTaken: state.run?.damageTaken,
    usedItems: [...(state.run?.usedItems ?? [])],
    clearedNodeIds: [...(state.run?.clearedNodeIds ?? [])],
    lawState: structuredClone(state.run?.lawState),
    pursuitState: structuredClone(state.run?.pursuitState),
    armorCracked: effects?.armorCracked,
    lastShiftTurn: effects?.lastShiftTurn,
    revivedOnce: effects?.revivedOnce,
    lastPlayerAction: effects?.lastPlayerAction,
    echoCopiedStat: effects?.echoCopiedStat,
    echoCopiedValue: effects?.echoCopiedValue,
    railHeavyDodgeUsed: effects?.railHeavyDodgeUsed
  };
}

function getMethodTechniqueMutationProjection(state: GameState) {
  return {
    invariant: getMethodTechniqueInvariantProjection(state),
    effectState: getMethodTechniqueStateEvidence(state),
    activeMethod: state.activeMethod,
    methodRanks: { ...state.methodRanks },
    methodSnapshot: structuredClone(state.run?.methodSnapshot),
    rewardPoints: state.rewardPoints,
    lingyun: state.lingyun,
    inventory: { ...state.inventory },
    playerBase: { ...state.player.base },
    maxHp: state.player.maxHp,
    runLootBag: structuredClone(state.run?.lootBag)
  };
}

function getMethodTechniqueResourceSnapshot(state: GameState) {
  return {
    rewardPoints: state.rewardPoints,
    lingyun: state.lingyun,
    methodPages: state.inventory.method_page
  };
}

function getMethodTechniqueResourceDelta(
  targetRank: 2 | 3,
  before: ReturnType<typeof getMethodTechniqueResourceSnapshot>,
  after: ReturnType<typeof getMethodTechniqueResourceSnapshot>
): MethodTechniqueResourceDelta {
  return {
    targetRank,
    rewardPoints: before.rewardPoints - after.rewardPoints,
    lingyun: before.lingyun - after.lingyun,
    methodPages: before.methodPages - after.methodPages
  };
}

function getExpectedMethodTechniqueUpgradeCost(
  methodId: MethodId,
  targetRank: 2 | 3
): MethodTechniqueResourceDelta {
  const cost = getMethodUpgradeCost(methodId, targetRank);
  if (!cost) throw new BalanceSimulationError(`${methodId} R${targetRank} upgrade cost is missing.`);
  return {
    targetRank,
    rewardPoints: cost.rewardPoints ?? 0,
    lingyun: cost.lingyun ?? 0,
    methodPages: cost.items?.method_page ?? 0
  };
}

function createMethodTechniqueCultivationState(
  methodId: MethodId,
  rank: MethodRank,
  api: MethodTechniqueGameApi
): Readonly<{
  state: GameState;
  activeAfterLearning: MethodId | undefined;
  observedUpgradeCosts: readonly MethodTechniqueResourceDelta[];
}> {
  const initial = createInitialState();
  const stocked: GameState = {
    ...initial,
    rewardPoints: 20_000,
    lingyun: 50,
    inventory: Object.fromEntries(
      (Object.keys(initial.inventory) as ItemId[]).map((itemId) => [itemId, 50])
    ) as Record<ItemId, number>,
    ownedPets: ['contract_sprite'],
    petLevels: { contract_sprite: 1 },
    activePet: 'contract_sprite'
  };
  let state = learnMethod(stocked, methodId);
  const activeAfterLearning = state.activeMethod;
  const secondaryMethodId: MethodId = methodId === 'star_core_method'
    ? 'mist_breathing'
    : methodId === 'gate_sense' ? 'cloud_step' : 'gate_sense';
  state = learnMethod(state, secondaryMethodId);
  state = api.activateMethod(state, secondaryMethodId);
  state = api.activateMethod(state, methodId);

  const observedUpgradeCosts: MethodTechniqueResourceDelta[] = [];
  for (const targetRank of [2, 3] as const) {
    if (targetRank > rank) break;
    const before = getMethodTechniqueResourceSnapshot(state);
    state = api.upgradeMethod(state, methodId);
    const after = getMethodTechniqueResourceSnapshot(state);
    observedUpgradeCosts.push(getMethodTechniqueResourceDelta(targetRank, before, after));
  }

  return { state, activeAfterLearning, observedUpgradeCosts };
}

function createMethodTechniqueCombatFixture(
  cultivated: GameState,
  saturated: boolean,
  withActivePet = true
): GameState {
  const prepared = withActivePet
    ? cultivated
    : { ...cultivated, activePet: undefined };
  const entered = isolateRunPursuitForIndependentBalanceScenario(
    enterDungeon(prepared, 'demon_tower_1')
  );
  const encounter = selectNode(entered, DUNGEONS.demon_tower_1.grid.startNodeId);
  if (!encounter.run || !encounter.combat || encounter.phase !== 'combat') {
    throw new BalanceSimulationError('Method technique fixture did not enter the opening combat.');
  }

  return {
    ...encounter,
    player: {
      ...encounter.player,
      hp: saturated ? encounter.player.maxHp : Math.max(1, encounter.player.maxHp - 50)
    },
    run: {
      ...encounter.run,
      damageTaken: 13,
      usedItems: ['healing_pill']
    },
    combat: {
      ...encounter.combat,
      turn: 4,
      guarding: false,
      companionAssistUsed: false,
      methodTechniqueUsed: false,
      weaponFocus: saturated ? 2 : 0,
      weaponSkillUsed: true,
      bossPhase: 'awakened',
      effects: {
        rustPoisonStacks: 2,
        mirrorSlowStacks: 2,
        breathStacks: saturated
          ? cultivated.activeMethod === 'mist_breathing' ? 1 : 2
          : 0,
        armorCracked: true,
        lastShiftTurn: 2,
        revivedOnce: true,
        lastPlayerAction: 'attack',
        echoCopiedStat: 'attack',
        echoCopiedValue: 99,
        railHeavyDodgeUsed: true
      }
    }
  };
}

export function simulateMethodTechniqueRanks(): MethodTechniqueBalanceResult {
  const api = getMethodTechniqueGameApi();
  const matrix = METHOD_TECHNIQUE_CATALOG.flatMap((definition) =>
    ([1, 2, 3] as const).map((rank): MethodTechniqueBalanceEvidence => {
      const cultivated = createMethodTechniqueCultivationState(definition.methodId, rank, api);
      const progressBeforeEntry = normalizeMethodCultivationProgress(
        cultivated.state.learnedMethods,
        {
          rulesVersion: METHOD_CULTIVATION_RULES_VERSION,
          ranks: cultivated.state.methodRanks,
          activeMethod: cultivated.state.activeMethod
        }
      );
      const beforeState = createMethodTechniqueCombatFixture(cultivated.state, false);
      const snapshot = beforeState.run?.methodSnapshot;
      const pursuitStatus = beforeState.run?.pursuitState?.status;
      const expectedEffect = getMethodTechniqueEffect(snapshot);
      if (!snapshot || !expectedEffect) {
        throw new BalanceSimulationError(`${definition.methodId} R${rank} did not freeze a method snapshot.`);
      }
      if (!pursuitStatus) {
        throw new BalanceSimulationError(`${definition.methodId} R${rank} did not explicitly isolate pursuit.`);
      }
      const invariantBefore = getMethodTechniqueInvariantProjection(beforeState);
      const afterState = api.useMethodTechnique(beforeState);
      const invariantAfter = getMethodTechniqueInvariantProjection(afterState);
      const secondUseState = api.useMethodTechnique(afterState);
      const saturatedBeforeState = createMethodTechniqueCombatFixture(cultivated.state, true);
      const saturatedAfterState = api.useMethodTechnique(saturatedBeforeState);
      const progressAfterTechnique = normalizeMethodCultivationProgress(
        afterState.learnedMethods,
        {
          rulesVersion: METHOD_CULTIVATION_RULES_VERSION,
          ranks: afterState.methodRanks,
          activeMethod: afterState.activeMethod
        }
      );
      const petRequirement = definition.requiresActivePet
        ? (() => {
            const rejectedBefore = createMethodTechniqueCombatFixture(cultivated.state, false, false);
            const rejectedAfter = api.useMethodTechnique(rejectedBefore);
            return {
              rejectedWithoutActivePet:
                JSON.stringify(getMethodTechniqueMutationProjection(rejectedAfter)) ===
                JSON.stringify(getMethodTechniqueMutationProjection(rejectedBefore)),
              usedWithoutActivePet: rejectedAfter.combat?.methodTechniqueUsed === true
            };
          })()
        : undefined;

      return {
        methodId: definition.methodId,
        rank,
        expectedEffect,
        observedUpgradeCosts: cultivated.observedUpgradeCosts,
        expectedUpgradeCosts: ([2, 3] as const)
          .filter((targetRank) => targetRank <= rank)
          .map((targetRank) => getExpectedMethodTechniqueUpgradeCost(definition.methodId, targetRank)),
        learnedMethods: [...cultivated.state.learnedMethods],
        activeAfterLearning: cultivated.activeAfterLearning,
        activeBeforeEntry: progressBeforeEntry.activeMethod,
        activeAfterTechnique: progressAfterTechnique.activeMethod,
        rankBeforeEntry: getMethodRank(definition.methodId, progressBeforeEntry),
        rankAfterTechnique: getMethodRank(definition.methodId, progressAfterTechnique),
        snapshot,
        pursuitStatus,
        before: getMethodTechniqueStateEvidence(beforeState),
        after: getMethodTechniqueStateEvidence(afterState),
        saturatedBefore: getMethodTechniqueStateEvidence(saturatedBeforeState),
        saturatedAfter: getMethodTechniqueStateEvidence(saturatedAfterState),
        invariantBefore,
        invariantAfter,
        secondUsePreserved:
          JSON.stringify(getMethodTechniqueMutationProjection(secondUseState)) ===
          JSON.stringify(getMethodTechniqueMutationProjection(afterState)),
        petRequirement
      };
    })
  );
  const defaultRoute = simulateSevenDungeonVictoryRoute();
  const defaultBalance = simulateCampaignBalance();
  const isolatedDefaultState = isolateMethodTechniqueForIndependentBalanceScenario(defaultRoute.finalState);
  const initialMethodRanks = createInitialState().methodRanks;
  const defaultProgress = normalizeMethodCultivationProgress(
    isolatedDefaultState.learnedMethods,
    {
      rulesVersion: METHOD_CULTIVATION_RULES_VERSION,
      ranks: {
        ...isolatedDefaultState.methodRanks,
        iron_body: initialMethodRanks.iron_body ?? 1
      },
      activeMethod: isolatedDefaultState.activeMethod
    }
  );

  return {
    matrix,
    defaultCampaign: {
      verdict: defaultBalance.verdict,
      warnings: defaultBalance.warnings,
      activeMethod: defaultProgress.activeMethod,
      ranks: defaultProgress.ranks
    }
  };
}

export function simulateSevenDungeonVictoryRoute(initialState: GameState = createInitialState()): SevenDungeonVictoryRouteResult {
  let state = structuredClone(initialState);
  const summaries: SevenDungeonRouteSummary[] = [];

  for (const dungeonId of DUNGEON_ORDER) {
    const beforeInvestments = state;
    const invested = investForDungeon(state, dungeonId);
    state = invested.state;

    const gateBeforeEntry = getGateStatus(state, dungeonId);
    if (gateBeforeEntry !== 'open') {
      throw new Error(`${dungeonId} gate is ${gateBeforeEntry}: ${getGateRequirement(state, dungeonId)}`);
    }

    const beforePower = getPlayerPower(state);
    const combatEvidence = createRouteCombatEvidence();
    const settled = clearDungeonViaExit(state, dungeonId, combatEvidence);
    const advanced = claimChapterTaskRewardsAfterClear(settled, dungeonId);
    const afterPower = getPlayerPower(advanced);
    const bossDefinition = getBossDefinition(dungeonId);
    const bossSeal = getBossSealStatus(advanced, dungeonId);
    const exitNodeId = DUNGEONS[dungeonId].nodes.find((node) => node.type === 'exit')?.id;
    const broadcastStatus = getCurrentBroadcastRelayStatus(advanced);
    const escortStatus = getCurrentEscortCheckpointStatus(advanced);
    const falseTestimonyStatus = dungeonId === 'false_testimony_court'
      ? getFalseTestimonyGameApi().getCurrentVerdictStatus(advanced)
      : undefined;

    if (!advanced.completedDungeonIds.includes(dungeonId)) {
      throw new Error(`${dungeonId} did not enter completedDungeonIds after exit resolution.`);
    }

    summaries.push({
      tier: DUNGEONS[dungeonId].tier,
      dungeonId,
      dungeonName: DUNGEONS[dungeonId].name,
      gateBeforeEntry,
      gateRequirement: getGateRequirement(state, dungeonId),
      readinessBeforeEntry: getDungeonReadiness(state, dungeonId),
      beforePower,
      afterPower,
      rewardPointsAfter: advanced.rewardPoints,
      lingyunAfter: advanced.lingyun,
      completedDungeonCountAfter: advanced.completedDungeonIds.length,
      completedDungeonIdsAfter: [...advanced.completedDungeonIds],
      claimedTaskIdsAfter: [...advanced.claimedTaskIds],
      plannedPurchases: invested.plannedPurchases,
      plannedUpgrades: invested.plannedUpgrades,
      plannedMethods: invested.plannedMethods,
      plannedPets: invested.plannedPets,
      bossNodeId: bossDefinition.nodeId,
      bossNodeCleared: advanced.run?.clearedNodeIds.includes(bossDefinition.nodeId) ?? false,
      bossSealCleared: bossSeal?.cleared ?? false,
      exitNodeCleared: exitNodeId ? advanced.run?.clearedNodeIds.includes(exitNodeId) ?? false : false,
      playerSurvived: advanced.player.hp > 0,
      clearedNodeIds: [...(advanced.run?.clearedNodeIds ?? [])],
      weaponSkillUseCount: combatEvidence.usedWeaponSkillNodeIds.length,
      usedWeaponSkillNodeIds: [...combatEvidence.usedWeaponSkillNodeIds],
      focusTrace: structuredClone(combatEvidence.focusTrace),
      routeEvidence: getRouteLegalityEvidence(combatEvidence),
      settledEquipmentLootIds: [...(advanced.run?.lastLootSettlement?.retained.equipmentIds ?? [])],
      ownedEquipmentIdsAfter: [...advanced.ownedEquipment],
      growthSignals: getRouteGrowthSignals(beforeInvestments, advanced),
      ...(broadcastStatus
        ? {
            broadcastRoute: {
              noise: broadcastStatus.noise,
              muteCount: broadcastStatus.muteCount,
              broadcastCount: broadcastStatus.broadcastCount,
              allRelaysResolved: broadcastStatus.allRelaysResolved,
              bossNoiseSnapshot: broadcastStatus.bossNoiseSnapshot,
              silentArchiveReached:
                advanced.run?.clearedNodeIds.includes('silent_archive') ?? false,
              balancedSwitchboardReached:
                advanced.run?.clearedNodeIds.includes('balanced_switchboard') ?? false
            }
          }
        : {}),
      ...(escortStatus
        ? {
            escortRoute: {
              survivorHp: escortStatus.survivorHp,
              bossSurvivorSnapshot: escortStatus.bossSurvivorSnapshot,
              allCheckpointsResolved: escortStatus.allCheckpointsResolved,
              treatCount: escortStatus.treatCount,
              pushCount: escortStatus.pushCount,
              entryGear: { ...escortStatus.entryGear },
              entryCompanion: { ...escortStatus.entryCompanion },
              companionRole: escortStatus.companionRole,
              firstHazardGuardUsed: escortStatus.firstHazardGuardUsed,
              companionAnalysisUsed: escortStatus.companionAnalysisUsed,
              companionTriageUsed: escortStatus.companionTriageUsed
            }
          }
        : {}),
      ...(falseTestimonyStatus
        ? {
            falseTestimonyRoute: {
              revealedEvidenceIds: falseTestimonyStatus.evidence
                .filter((item) => item.revealed)
                .map((item) => item.id),
              contaminatedEvidenceIds: falseTestimonyStatus.evidence
                .filter((item) => item.contaminated)
                .map((item) => item.id),
              currentTrustedCount: falseTestimonyStatus.currentTrustedCount,
              accusationCorrect: falseTestimonyStatus.accusationCorrect,
              accusationTrustedCount: falseTestimonyStatus.accusationTrustedCount,
              appealUsed: falseTestimonyStatus.appealUsed,
              bossVerdictSnapshot: falseTestimonyStatus.bossVerdictSnapshot,
              entryGear: falseTestimonyStatus.entryGear,
              truthArchiveReached: advanced.run?.clearedNodeIds.includes('truth_archive') ?? false
            }
          }
        : {})
    });

    const hubState = returnToHub(advanced);
    state = dungeonId === 'mirror_cycle_city' ? restoreSimulationHealth(hubState) : hubState;
  }

  return {
    finalState: state,
    summaries,
    coverage: {
      boughtEquipment: summaries.some((summary) => summary.plannedPurchases.length > 0),
      upgradedEquipment: summaries.some((summary) => summary.plannedUpgrades.length > 0),
      learnedMethod: summaries.some((summary) => summary.plannedMethods.length > 0),
      gainedPet: summaries.some((summary) => summary.plannedPets.length > 0)
    }
  };
}

function createCombatReplayStageBalanceBaseState(): GameState {
  const initial = createInitialState();
  return restoreSimulationHealth({
    ...initial,
    rewardPoints: 100_000,
    lingyun: 32,
    player: {
      ...initial.player,
      base: { body: 69, spirit: 5, agility: 25, luck: 12 }
    },
    completedDungeonIds: DUNGEON_ORDER.slice(0, 17),
    claimedTaskIds: DUNGEON_ORDER.slice(0, 17).map((dungeonId) => `mainline_clear_${dungeonId}`)
  });
}

export function simulateCombatReplayStageBalanceScenario(
  initialState: GameState = createCombatReplayStageBalanceBaseState()
): CombatReplayStageBalanceScenarioResult {
  const externalRunBefore = JSON.stringify(initialState.run);
  const externalProgressBefore = JSON.stringify({
    completedDungeonIds: initialState.completedDungeonIds,
    claimedTaskIds: initialState.claimedTaskIds
  });
  let simulationHub = structuredClone(initialState);
  if (simulationHub.phase !== 'hub') {
    simulationHub = resolvePendingRunRelicArchive(simulationHub);
    simulationHub = returnToHub(simulationHub);
  }
  if (simulationHub.phase !== 'hub' || simulationHub.run) {
    throw new BalanceSimulationError('Combat replay balance scenario requires a detachable hub state.');
  }

  const dungeonId = 'combat_replay_stage' as const;
  const bossDefinition = getBossDefinition(dungeonId);
  const evidence = createRouteCombatEvidence({
    combatProfiles: [],
    prioritizeHealing: true,
    healingTargetRatio: 0.9,
    methodTechniqueNodeId: bossDefinition.nodeId,
    companionAssistNodeId: bossDefinition.nodeId,
    bloodlineSurgeNodeId: bossDefinition.nodeId,
    soulSkipNodeId: bossDefinition.nodeId,
    reserveWeaponSkillForNodeId: bossDefinition.nodeId,
    scriptedActions: {
      take_alpha: COMBAT_REPLAY_TAKE_ALPHA_SCRIPT,
      take_beta: COMBAT_REPLAY_TAKE_BETA_SCRIPT,
      take_gamma: COMBAT_REPLAY_TAKE_GAMMA_SCRIPT,
      [bossDefinition.nodeId]: COMBAT_REPLAY_BOSS_SURVIVAL_SCRIPT
    }
  });
  const playerPower = getPlayerPower(simulationHub);
  let settled = enterPreparedDungeon(simulationHub, dungeonId, evidence, {
    plannedNodeIds: ['take_alpha', 'take_beta', 'take_gamma'],
    additionalTacticalItemIds: ['healing_pill', 'dispel_talisman', 'armor_patch'],
    inventoryTargets: { healing_pill: 128, dispel_talisman: 16, armor_patch: 16 }
  });
  for (const nodeId of ['take_alpha', 'take_beta', 'take_gamma']) {
    settled = moveAlongRoutePath(settled, nodeId, evidence);
  }
  settled = selectCombatReplayRoute(settled, 'burst');
  if (settled.run?.combatReplayState?.route !== 'burst') {
    throw new BalanceSimulationError('Combat replay balance scenario could not select the burst route.');
  }
  settled = moveAlongRoutePath(settled, bossDefinition.nodeId, evidence);
  settled = resolvePendingEquipmentOffer(settled, bossDefinition.nodeId);
  assertBossSealCleared(settled, dungeonId, 'after isolated combat replay boss');
  const ordinaryProfile = evidence.combatProfiles?.find(
    (profile) => profile.nodeId !== bossDefinition.nodeId
  );
  const bossProfile = evidence.combatProfiles?.find(
    (profile) => profile.nodeId === bossDefinition.nodeId
  );
  if (!ordinaryProfile || !bossProfile) {
    throw new BalanceSimulationError('Combat replay balance scenario did not exercise ordinary and boss encounters.');
  }

  const replay = settled.run?.combatReplayState;
  const law = settled.run?.lawState?.law;
  const completedTakeCount = Math.max(
    replay ? Object.keys(replay.recordings).length : 0,
    law?.kind === 'combat_replay_stage'
      ? law.takes.filter((take) => take !== null).length
      : 0
  );
  const routeSelected = replay?.route !== undefined ||
    (law?.kind === 'combat_replay_stage' && law.route !== null);
  const bossSnapshotFrozen = law?.kind === 'combat_replay_stage' && law.bossSnapshot !== null;
  const externalRunAfter = JSON.stringify(initialState.run);
  const externalProgressAfter = JSON.stringify({
    completedDungeonIds: initialState.completedDungeonIds,
    claimedTaskIds: initialState.claimedTaskIds
  });

  return {
    dungeonId,
    recommendedPower: DUNGEONS[dungeonId].recommendedPower,
    playerPower,
    readiness: getDungeonReadiness(simulationHub, dungeonId),
    externalRunPreserved: externalRunBefore === externalRunAfter,
    externalProgressPreserved: externalProgressBefore === externalProgressAfter,
    pursuitIsolated: settled.run?.pursuitState?.status === 'disabled',
    playerSurvived: settled.player.hp > 0,
    completedTakeCount,
    routeSelected,
    route: 'burst',
    bossSnapshotFrozen,
    ordinary: {
      nodeId: ordinaryProfile.nodeId,
      monsterId: ordinaryProfile.monsterId,
      cleared: settled.run?.clearedNodeIds.includes(ordinaryProfile.nodeId) ?? false
    },
    boss: {
      nodeId: bossProfile.nodeId,
      monsterId: bossProfile.monsterId,
      cleared: settled.run?.clearedNodeIds.includes(bossProfile.nodeId) ?? false
    }
  };
}

const PANOPTICON_CITY_EQUIPMENT = [
  ['blindline_cutter', 'forge_overdrive'],
  ['predictive_visor', 'mist_veilguard'],
  ['matte_shell', 'rift_anchor'],
  ['inverse_prism', 'chronal_stasis']
] as const satisfies readonly (readonly [EquipmentId, EquipmentAttunementId])[];

function preparePanopticonEndgameBuild(
  input: GameState,
  minimumBody = 90,
  excludedEquipmentId?: EquipmentId,
  equipTier19Set = true
): GameState {
  if (input.phase !== 'hub' || input.run) {
    throw new BalanceSimulationError('Panopticon endgame equipment must be prepared from the hub.');
  }
  let state = restoreSimulationHealth({
    ...structuredClone(input),
    rewardPoints: Math.max(input.rewardPoints, 200_000),
    lingyun: Math.max(input.lingyun, 200),
    player: {
      ...input.player,
      base: {
        body: Math.max(input.player.base.body, minimumBody),
        spirit: Math.max(input.player.base.spirit, 65),
        agility: Math.max(input.player.base.agility, 42),
        luck: Math.max(input.player.base.luck, 18)
      }
    },
    inventory: {
      ...input.inventory,
      observation_shard: Math.max(input.inventory.observation_shard, 128),
      cracked_core: Math.max(input.inventory.cracked_core, 128),
      star_iron: Math.max(input.inventory.star_iron, 128),
      phase_glass: Math.max(input.inventory.phase_glass, 128),
      rift_dust: Math.max(input.inventory.rift_dust, 128),
      chronal_glass: Math.max(input.inventory.chronal_glass, 128),
      cycle_imprint: Math.max(input.inventory.cycle_imprint, 64),
      healing_pill: Math.max(input.inventory.healing_pill, 128),
      focus_incense: Math.max(input.inventory.focus_incense, 32),
      armor_patch: Math.max(input.inventory.armor_patch, 32),
      dispel_talisman: Math.max(input.inventory.dispel_talisman, 32),
      gate_sigil: Math.max(input.inventory.gate_sigil, 32)
    }
  });

  for (const [equipmentId, attunementId] of equipTier19Set ? PANOPTICON_CITY_EQUIPMENT : []) {
    if (equipmentId === excludedEquipmentId) continue;
    state = buyEquipment(state, equipmentId);
    if (!state.ownedEquipment.includes(equipmentId)) {
      throw new BalanceSimulationError(`Panopticon fixture could not buy ${equipmentId}.`);
    }
    while ((state.equipmentLevels[equipmentId] ?? 1) < EQUIPMENT[equipmentId].maxLevel) {
      const beforeLevel = state.equipmentLevels[equipmentId] ?? 1;
      state = upgradeEquipment(state, equipmentId);
      if ((state.equipmentLevels[equipmentId] ?? 1) === beforeLevel) {
        throw new BalanceSimulationError(`Panopticon fixture could not max ${equipmentId}.`);
      }
    }
    state = attuneEquipment(state, equipmentId, attunementId);
    while ((state.equipmentTemperRanks?.[equipmentId] ?? 0) < 2) {
      const beforeRank = state.equipmentTemperRanks?.[equipmentId] ?? 0;
      state = temperEquipment(state, equipmentId);
      if ((state.equipmentTemperRanks?.[equipmentId] ?? 0) === beforeRank) {
        throw new BalanceSimulationError(`Panopticon fixture could not temper ${equipmentId} to rank II.`);
      }
    }
    state = equipEquipment(state, equipmentId);
  }

  return restoreSimulationHealth(state);
}

function createPanopticonCityBalanceBaseState(): GameState {
  const initial = createInitialState();
  return preparePanopticonEndgameBuild({
    ...initial,
    completedDungeonIds: DUNGEON_ORDER.slice(0, 18),
    claimedTaskIds: DUNGEON_ORDER.slice(0, 18).map(
      (dungeonId) => `mainline_clear_${dungeonId}`
    )
  });
}

function createPanopticonRouteEvidence(): RouteCombatEvidence {
  const conservativeScript = Array.from(
    { length: MAX_COMBAT_ACTIONS },
    (_, index) => (['guard', 'art', 'attack', 'weapon_skill', 'use_healing_pill'] as const)[index % 5]
  );
  return createRouteCombatEvidence({
    combatProfiles: [],
    prioritizeHealing: true,
    healingTargetRatio: 0.85,
    methodTechniqueNodeId: 'all_sight_warden',
    companionAssistNodeId: 'all_sight_warden',
    bloodlineSurgeNodeId: 'all_sight_warden',
    reserveWeaponSkillForNodeId: 'all_sight_warden',
    scriptedActions: {
      sweep_sentinel_north: conservativeScript,
      blindspot_auditor_north: conservativeScript,
      exposure_double_patrol: conservativeScript,
      sweep_sentinel: conservativeScript,
      soul_recharge_panopticon: conservativeScript,
      exposure_double: conservativeScript,
      all_sight_warden: conservativeScript
    }
  });
}

function accumulatePanopticonRoutePayoff(
  state: GameState,
  route: Exclude<PanopticonRoute, 'shadow'>,
  evidence: RouteCombatEvidence
): GameState {
  let nextState = state;
  for (let movementCount = 0; movementCount < 24; movementCount += 1) {
    const status = getCurrentPanopticonStatus(nextState);
    if (!status) throw new BalanceSimulationError(`${route}: panopticon status disappeared during payoff movement.`);
    const payoffCount = route === 'decoy' ? status.decoyRewardsGranted : status.refractionCharges;
    if (payoffCount >= 3) return nextState;
    if (!nextState.run) throw new BalanceSimulationError(`${route}: panopticon run ended during payoff movement.`);

    const legalNodeIds = getCurrentLegalAdjacentTargetIds(nextState).filter((nodeId) => {
      const node = DUNGEONS.panopticon_city.nodes.find((candidate) => candidate.id === nodeId);
      return node && node.type !== 'exit' && node.type !== 'portal' && node.id !== 'all_sight_warden';
    });
    const matchingNodeId = legalNodeIds.find((nodeId) => {
      const node = DUNGEONS.panopticon_city.nodes.find((candidate) => candidate.id === nodeId);
      return node && ((node.position.x + node.position.y) % 3) === status.scanPhase;
    });
    const nextNodeId = matchingNodeId ?? legalNodeIds[0];
    if (!nextNodeId) {
      throw new BalanceSimulationError(`${route}: no legal adjacent node remained for scan payoff movement.`);
    }
    nextState = moveAlongRoutePath(nextState, nextNodeId, evidence, { panopticonRoute: route });
  }
  throw new BalanceSimulationError(`${route}: failed to reach three route payoff triggers.`);
}

function simulatePanopticonRoute(
  baseState: GameState,
  route: PanopticonRoute
): PanopticonCityRouteBalanceEvidence {
  const evidence = createPanopticonRouteEvidence();
  const playerPower = getPlayerPower(baseState);
  let state = enterPreparedDungeon(baseState, 'panopticon_city', evidence, {
    plannedNodeIds: [
      'north_blind_relay',
      'central_blind_relay',
      'south_blind_relay',
      `${route}_route`,
      'exposure_double',
      'all_sight_warden'
    ],
    additionalTacticalItemIds: ['healing_pill', 'focus_incense', 'armor_patch'],
    inventoryTargets: { healing_pill: 128, focus_incense: 32, armor_patch: 32 },
    methodTechnique: 'live'
  });
  const routeRewardPointsBefore = state.run?.lootBag.rewardPoints ?? 0;

  for (const nodeId of DUNGEON_LAW_LANDMARKS.panopticon_city.relayNodeIds) {
    state = moveAlongRoutePath(state, nodeId, evidence, { panopticonRoute: route });
  }
  state = moveAlongRoutePath(state, `${route}_route`, evidence, { panopticonRoute: route });
  if (route !== 'shadow') state = accumulatePanopticonRoutePayoff(state, route, evidence);

  state = moveAlongRoutePath(state, 'exposure_double', evidence, { panopticonRoute: route });
  state = moveAlongRoutePath(state, 'all_sight_warden', evidence, { panopticonRoute: route });
  state = resolvePendingEquipmentOffer(state, 'all_sight_warden');
  assertBossSealCleared(state, 'panopticon_city', `${route}: after all-sight boss`);
  const status = getCurrentPanopticonStatus(state);
  if (!status?.bossSnapshot) {
    throw new BalanceSimulationError(`${route}: boss snapshot was not frozen through the real law API.`);
  }
  const ordinaryProfile = evidence.combatProfiles?.find(
    (profile) => profile.nodeId === 'exposure_double'
  );
  const bossProfile = evidence.combatProfiles?.find(
    (profile) => profile.nodeId === 'all_sight_warden'
  );
  if (!ordinaryProfile || !bossProfile) {
    throw new BalanceSimulationError(`${route}: ordinary and boss profiles were not both exercised.`);
  }

  const routeRewardPoints = (state.run?.lootBag.rewardPoints ?? 0) - routeRewardPointsBefore;
  const settled = settleLawRoute(state, 'panopticon_city', evidence);
  return {
    route,
    playerPower,
    pursuitIsolated: settled.run?.pursuitState?.status === 'disabled',
    completedRelayCount: status.completedRelayCount,
    moveCount: status.moveCount,
    exposureCount: status.exposureCount,
    decoyRewardsGranted: status.decoyRewardsGranted,
    refractionCharges: status.refractionCharges,
    routeRewardPoints,
    playerSurvived: settled.player.hp > 0,
    completed: settled.completedDungeonIds.includes('panopticon_city'),
    ordinary: {
      nodeId: ordinaryProfile.nodeId,
      monsterId: ordinaryProfile.monsterId,
      cleared: settled.run?.clearedNodeIds.includes(ordinaryProfile.nodeId) ?? false
    },
    boss: {
      nodeId: bossProfile.nodeId,
      monsterId: bossProfile.monsterId,
      cleared: settled.run?.clearedNodeIds.includes(bossProfile.nodeId) ?? false,
      snapshot: structuredClone(status.bossSnapshot)
    },
    routeEvidence: getRouteLegalityEvidence(evidence)
  };
}

function simulatePanopticonLowBuild(): PanopticonCityBalanceScenarioResult['lowBuild'] {
  const initial = createInitialState();
  const hub = restoreSimulationHealth({
    ...initial,
    player: {
      ...initial.player,
      base: { body: 18, spirit: 10, agility: 12, luck: 8 }
    },
    completedDungeonIds: DUNGEON_ORDER.slice(0, 18),
    claimedTaskIds: DUNGEON_ORDER.slice(0, 18).map(
      (dungeonId) => `mainline_clear_${dungeonId}`
    )
  });
  let state = isolateRunPursuitForIndependentBalanceScenario(
    enterDungeon(hub, 'panopticon_city', 'standard')
  );
  state = moveToNode(state, 'watchglass_cache');
  state = collectReward(state);
  state = moveToNode(state, 'exposure_double_patrol');
  state = selectNode(state, 'exposure_double_patrol');
  const hpBeforeCombat = state.player.hp;
  let turnsAttempted = 0;
  while (state.phase === 'combat' && state.combat && turnsAttempted < MAX_COMBAT_ACTIONS) {
    state = performCombatAction(state, 'attack');
    turnsAttempted += 1;
  }
  const cleared = state.run?.clearedNodeIds.includes('exposure_double_patrol') ?? false;
  const survived = state.player.hp > 0 && state.phase !== 'result';
  const readiness = getDungeonReadiness(hub, 'panopticon_city');
  return {
    playerPower: getPlayerPower(hub),
    readiness,
    pursuitIsolated: state.run?.pursuitState?.status === 'disabled',
    ordinaryNodeId: 'exposure_double_patrol',
    ordinaryMonsterId: 'exposure_double',
    turnsAttempted,
    hpBeforeCombat,
    hpAfterCombat: state.player.hp,
    cleared,
    survived,
    dangerous: readiness === 'deadly' && (!cleared || !survived || state.player.hp < hpBeforeCombat / 2)
  };
}

function getPanopticonProtocolProfile(
  baseState: GameState,
  protocolId: 'standard' | 'imprint' | 'deep'
): PanopticonCityBalanceScenarioResult['protocols'][number] {
  const evidence = createRouteCombatEvidence();
  let state = enterPreparedDungeon(baseState, 'panopticon_city', evidence, {
    protocolId,
    plannedNodeIds: ['exposure_double_patrol'],
    additionalTacticalItemIds: ['healing_pill', 'armor_patch'],
    inventoryTargets: { healing_pill: 16, armor_patch: 16 }
  });
  state = moveToNode(state, 'watchglass_cache');
  state = collectReward(state);
  state = moveToNode(state, 'exposure_double_patrol');
  state = selectNode(state, 'exposure_double_patrol');
  const monster = getCombatEncounterProfile(state)?.monster;
  if (!monster) throw new BalanceSimulationError(`${protocolId}: panopticon protocol profile did not start combat.`);
  const definition = protocolId === 'standard'
    ? undefined
    : getRunProtocolDefinition('panopticon_city', protocolId);
  return {
    protocolId,
    enemyStatMultiplierPercent: definition?.modifiers.enemyStatMultiplierPercent ?? 100,
    observedMaxHp: monster.maxHp,
    observedAttack: monster.attack,
    observedArtPower: monster.artPower
  };
}

export function simulatePanopticonCityBalanceScenario(
  initialState: GameState = createPanopticonCityBalanceBaseState()
): PanopticonCityBalanceScenarioResult {
  const externalBefore = JSON.stringify(initialState);
  let baseState = structuredClone(initialState);
  if (baseState.phase !== 'hub') {
    baseState = resolvePendingRunRelicArchive(baseState);
    baseState = returnToHub(baseState);
  }
  if (baseState.phase !== 'hub' || baseState.run) {
    throw new BalanceSimulationError('Panopticon balance scenario requires a detachable hub state.');
  }

  const shadow = simulatePanopticonRoute(structuredClone(baseState), 'shadow');
  const decoy = simulatePanopticonRoute(structuredClone(baseState), 'decoy');
  const refraction = simulatePanopticonRoute(structuredClone(baseState), 'refraction');
  const legacyTier18 = simulateCombatReplayStageBalanceScenario();
  return {
    dungeonId: 'panopticon_city',
    recommendedPower: DUNGEONS.panopticon_city.recommendedPower,
    externalStatePreserved: externalBefore === JSON.stringify(initialState),
    conservativeBuild: {
      playerPower: getPlayerPower(baseState),
      readiness: getDungeonReadiness(baseState, 'panopticon_city'),
      equippedEquipmentIds: PANOPTICON_CITY_EQUIPMENT
        .map(([equipmentId]) => equipmentId)
        .filter((equipmentId) => Object.values(baseState.equipped).includes(equipmentId)),
      healingPills: baseState.inventory.healing_pill
    },
    routes: { shadow, decoy, refraction },
    lowBuild: simulatePanopticonLowBuild(),
    protocols: (['standard', 'imprint', 'deep'] as const).map((protocolId) =>
      getPanopticonProtocolProfile(
        protocolId === 'standard'
          ? structuredClone(baseState)
          : {
              ...structuredClone(baseState),
              completedDungeonIds: [...DUNGEON_ORDER]
            },
        protocolId
      )
    ),
    legacyTier18: {
      ordinaryCleared: legacyTier18.ordinary.cleared,
      bossCleared: legacyTier18.boss.cleared,
      playerSurvived: legacyTier18.playerSurvived,
      pursuitIsolated: legacyTier18.pursuitIsolated
    }
  };
}

export function simulateSevenDungeonLawRoute(
  initialState: GameState = simulateSevenDungeonVictoryRoute().finalState
): SevenDungeonLawRouteResult {
  const baseState = structuredClone(initialState);
  const summaries = DUNGEON_ORDER.map((dungeonId): SevenDungeonLawRouteSummary => {
    const execution = simulateDungeonLawRoute(baseState, dungeonId);
    const lawState = getRequiredLaw(execution.settledState).state;
    const bossNodeId = getBossDefinition(dungeonId).nodeId;
    const completed =
      execution.settledState.phase === 'result' &&
      Boolean(execution.settledState.run?.clearedNodeIds.includes(bossNodeId)) &&
      Boolean(getBossSealStatus(execution.settledState, dungeonId)?.cleared) &&
      execution.settledState.completedDungeonIds.includes(dungeonId);

    return {
      tier: DUNGEONS[dungeonId].tier,
      dungeonId,
      dungeonName: DUNGEONS[dungeonId].name,
      visitedNodeIds: [...(execution.evidence.visitedNodeIds ?? [])],
      lawStatuses: structuredClone(execution.evidence.lawStatuses ?? []),
      modifierEvidence: structuredClone(execution.modifierEvidence),
      openingDistribution: getCombatOpeningDistribution(lawState),
      focusTrace: structuredClone(execution.evidence.focusTrace),
      routeEvidence: getRouteLegalityEvidence(execution.evidence),
      completed
    };
  });

  return { baseState, summaries };
}

function enterMirrorCycleCityScenario(
  baseState: GameState,
  equipmentIds: readonly EquipmentId[],
  plannedNodeIds: readonly string[]
): { state: GameState; evidence: RouteCombatEvidence } {
  const evidence = createRouteCombatEvidence({
    prioritizeHealing: true,
    visitedNodeIds: [],
    combatProfiles: [],
    combatActions: [],
    lawStatuses: []
  });
  const prepared = prepareMirrorCycleCityRouteState(baseState, equipmentIds);
  const state = enterPreparedDungeon(prepared, 'mirror_cycle_city', evidence, {
    plannedNodeIds,
    additionalTacticalItemIds: ['healing_pill', 'gate_sigil', 'armor_patch'],
    inventoryTargets: { healing_pill: 16, gate_sigil: 8, armor_patch: 8 }
  });
  evidence.visitedNodeIds?.push(state.run!.currentNodeId);
  recordDungeonLawStatus(state, evidence, 'entry');
  return { state, evidence };
}

function getMirrorCycleCityLawData(
  state: GameState
): Extract<DungeonLawData, { kind: 'mirror_cycle_city' }> {
  const law = getRequiredLaw(state).state.law;
  if (law.kind !== 'mirror_cycle_city') {
    throw new BalanceSimulationError('Mirror-cycle scenario lost its mirror law state.');
  }
  return law;
}

function createMirrorPhaseTransitionEvidence(
  baseState: GameState,
  equipmentIds: readonly EquipmentId[]
): {
  beforeState: GameState;
  afterState: GameState;
  evidence: MirrorCityPhaseChoiceEvidence;
} {
  const route = enterMirrorCycleCityScenario(
    baseState,
    equipmentIds,
    ['first_phase_mirror', 'mirror_anchor']
  );
  const pending = moveAlongRoutePath(route.state, 'first_phase_mirror', route.evidence);
  const resolved = resolvePendingMirrorCityPhaseForTarget(
    pending,
    'mirror_anchor',
    route.evidence
  );
  const choiceEvidence = route.evidence.mirrorPhaseChoiceTrace.at(-1);
  if (!choiceEvidence || choiceEvidence.phase !== 'mirror') {
    throw new BalanceSimulationError('Mirror-cycle transition fixture did not choose mirror phase.');
  }
  return { beforeState: pending, afterState: resolved, evidence: choiceEvidence };
}

function startMirrorCycleCityBossScenario(
  baseState: GameState,
  equipmentIds: readonly EquipmentId[],
  anchors: Readonly<Record<MirrorCityPhase, boolean>>
): { state: GameState; evidence: RouteCombatEvidence } {
  const route = enterMirrorCycleCityScenario(
    baseState,
    equipmentIds,
    LAW_ROUTE_PLANNED_NODES.mirror_cycle_city
  );
  let state = moveAlongRoutePath(route.state, 'first_phase_mirror', route.evidence);
  state = resolvePendingMirrorCityPhaseForTarget(state, 'real_anchor', route.evidence);
  if (anchors.real) state = moveAlongRoutePath(state, 'real_anchor', route.evidence);

  state = moveAlongRoutePath(state, 'second_phase_mirror', route.evidence, {
    excludedNodeIds: anchors.real ? undefined : new Set(['real_anchor'])
  });
  state = resolvePendingMirrorCityPhaseForTarget(state, 'mirror_anchor', route.evidence);
  if (anchors.mirror) state = moveAlongRoutePath(state, 'mirror_anchor', route.evidence);

  state = moveAlongRoutePath(state, 'third_phase_mirror', route.evidence, {
    excludedNodeIds: anchors.mirror ? undefined : new Set(['mirror_anchor'])
  });
  state = resolvePendingMirrorCityPhaseForTarget(state, 'nameless_reflection', route.evidence);
  state = moveAlongRoutePath(state, 'nameless_reflection', route.evidence, {
    resolveTargetDanger: false
  });
  state = selectNode(state, 'nameless_reflection');
  if (state.phase !== 'combat' || state.combat?.nodeId !== 'nameless_reflection') {
    throw new BalanceSimulationError('Mirror-cycle shell fixture did not start the real boss combat.');
  }
  recordDungeonLawStatus(state, route.evidence, 'combat:nameless_reflection');
  return { state, evidence: route.evidence };
}

function createMirrorShellEvidence(
  baseState: GameState,
  equipmentIds: readonly EquipmentId[],
  anchors: Readonly<Record<MirrorCityPhase, boolean>>
): MirrorCycleCityShellEvidence {
  const route = startMirrorCycleCityBossScenario(baseState, equipmentIds, anchors);
  const law = getMirrorCycleCityLawData(route.state);
  const shell = getMirrorCityShellStatus(getRequiredLaw(route.state).state);
  return {
    anchors: { ...law.anchors },
    entryPassives: { ...law.entryPassives },
    anchoredPhaseCount: shell.anchoredPhaseCount,
    prismCredit: shell.prismCredit,
    totalShells: shell.totalShells,
    remainingShells: shell.remainingShells,
    routeEvidence: getRouteLegalityEvidence(route.evidence)
  };
}

function simulateMirrorReturnPortal(
  baseState: GameState,
  nodeId: 'upper_return_portal' | 'lower_return_portal'
): MirrorCycleCityLawScenarioResult['portalRing'][number] {
  const route = enterMirrorCycleCityScenario(baseState, [], ['first_phase_mirror', nodeId]);
  const atPortal = moveAlongRoutePath(route.state, nodeId, route.evidence, {
    resolveTargetDanger: false
  });
  const crossed = useTrackedPortal(atPortal, nodeId, route.evidence);
  const portal = DUNGEONS.mirror_cycle_city.nodes.find((node) => node.id === nodeId)?.portal;
  const choice = route.evidence.portalChoiceTrace.at(-1)?.choice;
  if (!portal || !choice || crossed.run?.dungeonId !== portal.targetDungeonId) {
    throw new BalanceSimulationError(`${nodeId}: mirror-cycle portal ring did not cross through the real API.`);
  }
  return {
    nodeId,
    targetDungeonId: portal.targetDungeonId,
    targetNodeId: portal.targetNodeId,
    choice,
    routeEvidence: getRouteLegalityEvidence(route.evidence)
  };
}

export function simulateMirrorCycleCityLawScenario(
  initialState: GameState = simulateSevenDungeonVictoryRoute().finalState
): MirrorCycleCityLawScenarioResult {
  const baseState = structuredClone(initialState);
  const plainTransition = createMirrorPhaseTransitionEvidence(baseState, []);
  const mantleTransition = createMirrorPhaseTransitionEvidence(baseState, ['phaseweave_mantle']);
  const visorTransition = createMirrorPhaseTransitionEvidence(baseState, ['parallax_visor']);
  const plainReal = getRequiredLaw(plainTransition.beforeState).modifiers.outgoingDamage;
  const plainMirror = getRequiredLaw(plainTransition.afterState).modifiers.outgoingDamage;
  const visorReal = getRequiredLaw(visorTransition.beforeState).modifiers.outgoingDamage;
  const visorMirror = getRequiredLaw(visorTransition.afterState).modifiers.outgoingDamage;

  const anchorShellMatrix = [
    createMirrorShellEvidence(baseState, [], { real: true, mirror: true }),
    createMirrorShellEvidence(baseState, [], { real: true, mirror: false }),
    createMirrorShellEvidence(baseState, [], { real: false, mirror: false }),
    createMirrorShellEvidence(baseState, ['homecoming_prism'], { real: true, mirror: false })
  ];
  const consumptionRoute = startMirrorCycleCityBossScenario(
    baseState,
    [],
    { real: false, mirror: false }
  );
  const firstShell = getMirrorCityShellStatus(getRequiredLaw(consumptionRoute.state).state);
  const afterFirstHit = performCombatAction(consumptionRoute.state, 'attack');
  const secondShell = getMirrorCityShellStatus(getRequiredLaw(afterFirstHit).state);
  const afterSecondHit = performCombatAction(afterFirstHit, 'attack');
  const thirdShell = getMirrorCityShellStatus(getRequiredLaw(afterSecondHit).state);

  const completedExecution = simulateMirrorCycleCityLawRoute(baseState);
  const completedRun = completedExecution.settledState.run;
  const completedEvidence = getRouteLegalityEvidence(completedExecution.evidence);

  return {
    baseState,
    transitionCosts: [plainTransition, mantleTransition].map(({ evidence }) => ({
      phaseweaveMantle: evidence.damagePercent === 5,
      damagePercent: evidence.damagePercent,
      hpBefore: evidence.hpBefore,
      hpAfter: evidence.hpAfter
    })),
    outgoingModifiers: {
      plainReal: { ...plainReal },
      plainMirror: { ...plainMirror },
      visorReal: { ...visorReal },
      visorMirror: { ...visorMirror }
    },
    anchorShellMatrix,
    shellConsumption: {
      remainingShells: [firstShell.remainingShells, secondShell.remainingShells, thirdShell.remainingShells],
      brokenMirrorShells: [
        firstShell.brokenMirrorShells,
        secondShell.brokenMirrorShells,
        thirdShell.brokenMirrorShells
      ]
    },
    completedRoute: {
      phaseChoices: structuredClone(completedEvidence.mirrorPhaseChoiceTrace),
      visitedNodeIds: [...(completedExecution.evidence.visitedNodeIds ?? [])],
      bossNodeCleared: completedRun?.clearedNodeIds.includes('nameless_reflection') ?? false,
      exitNodeCleared: completedRun?.clearedNodeIds.includes('mirror_cycle_exit') ?? false,
      completed:
        completedExecution.settledState.phase === 'result' &&
        Boolean(completedRun?.clearedNodeIds.includes('nameless_reflection')) &&
        Boolean(completedRun?.clearedNodeIds.includes('mirror_cycle_exit')),
      routeEvidence: completedEvidence
    },
    portalRing: [
      simulateMirrorReturnPortal(baseState, 'upper_return_portal'),
      simulateMirrorReturnPortal(baseState, 'lower_return_portal')
    ]
  };
}

const ALL_CERTIFY_REDACTION_CHOICES = {
  body_clause_desk: 'certify',
  memory_clause_desk: 'certify',
  return_clause_desk: 'certify'
} as const satisfies Readonly<Record<RedactionClauseNodeId, RedactionChoice>>;

const ALL_REDACT_REDACTION_CHOICES = {
  body_clause_desk: 'redact',
  memory_clause_desk: 'redact',
  return_clause_desk: 'redact'
} as const satisfies Readonly<Record<RedactionClauseNodeId, RedactionChoice>>;

type RedactionBossScenario = Readonly<{
  bossState: GameState;
  status: NonNullable<ReturnType<typeof getCurrentRedactionClauseStatus>>;
  redactCosts: Readonly<Partial<Record<RedactionClauseNodeId, {
    hpBefore: number;
    hpAfter: number;
    maxHp: number;
  }>>>;
  bodyAreaOpen: boolean;
  memoryAreaOpen: boolean;
  returnAreaOpen: boolean;
  bossApproachOpen: boolean;
}>;

function prepareRedactionScenarioEquipment(
  baseState: GameState,
  equipmentIds: readonly EquipmentId[]
): GameState {
  let state = prepareRedactionScriptoriumCombatState(baseState);
  state = {
    ...state,
    inventory: {
      ...state.inventory,
      redaction_ink: Math.max(state.inventory.redaction_ink, 64)
    }
  };
  for (const equipmentId of equipmentIds) {
    if (!state.ownedEquipment.includes(equipmentId)) state = buyEquipment(state, equipmentId);
    if (!state.ownedEquipment.includes(equipmentId)) {
      throw new BalanceSimulationError(`Unable to buy ${equipmentId} for the redaction law scenario.`);
    }
    while ((state.equipmentLevels[equipmentId] ?? 1) < EQUIPMENT[equipmentId].maxLevel) {
      const beforeLevel = state.equipmentLevels[equipmentId] ?? 1;
      state = upgradeEquipment(state, equipmentId);
      if ((state.equipmentLevels[equipmentId] ?? 1) === beforeLevel) {
        throw new BalanceSimulationError(`Unable to upgrade ${equipmentId} for the redaction law scenario.`);
      }
    }
    state = equipEquipment(state, equipmentId);
  }
  return restoreSimulationHealth(state);
}

function runRedactionBossScenario(
  baseState: GameState,
  clauseChoices: Readonly<Record<RedactionClauseNodeId, RedactionChoice>>,
  equipmentIds: readonly EquipmentId[] = []
): RedactionBossScenario {
  const evidence = createRouteCombatEvidence({ visitedNodeIds: [] });
  const prepared = prepareRedactionScenarioEquipment(baseState, equipmentIds);
  let state = enterPreparedDungeon(prepared, 'redaction_scriptorium', evidence, {
    plannedNodeIds: LAW_ROUTE_PLANNED_NODES.redaction_scriptorium,
    additionalTacticalItemIds: EQUIPMENT_HUNT_TACTICAL_ITEMS.redaction_scriptorium,
    inventoryTargets: { healing_pill: 64, dispel_talisman: 16, armor_patch: 16 }
  });
  const redactCosts: Partial<Record<RedactionClauseNodeId, {
    hpBefore: number;
    hpAfter: number;
    maxHp: number;
  }>> = {};
  let bodyAreaOpen = false;
  let memoryAreaOpen = false;
  let returnAreaOpen = false;

  for (const nodeId of DUNGEON_LAW_LANDMARKS.redaction_scriptorium.clauseNodeIds) {
    const hpBefore = state.player.hp;
    const maxHp = state.player.maxHp;
    state = moveAlongRoutePath(state, nodeId, evidence, {
      redactionClauseChoices: clauseChoices,
      skipRedactionPreparation: true
    });
    if (clauseChoices[nodeId] === 'redact') {
      redactCosts[nodeId] = { hpBefore, hpAfter: state.player.hp, maxHp };
    }
    const lawState = getRequiredLaw(state).state;
    if (nodeId === 'body_clause_desk') {
      bodyAreaOpen = getRouteGateStatus(
        'redaction_scriptorium',
        'palimpsest_censor_alpha',
        'body_proof_vault',
        lawState
      )?.status === 'open';
    } else if (nodeId === 'memory_clause_desk') {
      memoryAreaOpen = getRouteGateStatus(
        'redaction_scriptorium',
        'north_clue_cache',
        'memory_survey_archive',
        lawState
      )?.status === 'open';
    } else {
      returnAreaOpen = getRouteGateStatus(
        'redaction_scriptorium',
        'south_clue_cache',
        'return_revision_portal',
        lawState
      )?.status === 'open';
    }
  }

  state = moveAlongRoutePath(state, 'final_proof_nexus', evidence, {
    redactionClauseChoices: clauseChoices,
    skipRedactionPreparation: true
  });
  const bossApproachOpen = getRouteGateStatus(
    'redaction_scriptorium',
    'final_proof_nexus',
    'last_redactor',
    getRequiredLaw(state).state
  )?.status === 'open';
  state = moveAlongRoutePath(state, 'last_redactor', evidence, {
    redactionClauseChoices: clauseChoices,
    skipRedactionPreparation: true,
    resolveTargetDanger: false
  });
  const bossState = selectNode(state, 'last_redactor');
  const status = getCurrentRedactionClauseStatus(bossState);
  if (bossState.phase !== 'combat' || !status?.bossClauseSnapshot) {
    throw new BalanceSimulationError('Redaction boss scenario did not freeze its clause snapshot through selectNode.');
  }

  return {
    bossState,
    status,
    redactCosts,
    bodyAreaOpen,
    memoryAreaOpen,
    returnAreaOpen,
    bossApproachOpen
  };
}

function simulateRedactionPortalRing(baseState: GameState): RedactionScriptoriumLawRouteResult['portalRing'] {
  const prepared = prepareRedactionScriptoriumCombatState(baseState);
  const evidence = createRouteCombatEvidence({ visitedNodeIds: [] });
  const redaction = enterPreparedDungeon(prepared, 'redaction_scriptorium', evidence, {
    plannedNodeIds: [
      'body_clause_desk',
      'memory_clause_desk',
      'return_clause_desk',
      'return_revision_portal'
    ],
    additionalTacticalItemIds: ['healing_pill', 'dispel_talisman', 'armor_patch'],
    inventoryTargets: { healing_pill: 64, dispel_talisman: 16, armor_patch: 16 },
    portalUseNodeIds: ['return_revision_portal']
  });
  const redactionLawKind = getRequiredLaw(redaction).state.law.kind;
  const atReturnPortal = moveAlongRoutePath(redaction, 'return_revision_portal', evidence, {
    redactionClauseChoices: ALL_CERTIFY_REDACTION_CHOICES
  });
  const auction = useTrackedPortal(atReturnPortal, 'return_revision_portal', evidence);
  const auctionLaw = getRequiredLaw(auction).state.law;
  const atAuctionPortal = moveAlongRoutePath(auction, 'upper_auction_portal', evidence, {
    auctionLotChoices: STANDARD_AUCTION_LOT_CHOICES,
    resolveTargetDanger: false
  });
  const genesis = useTrackedPortal(atAuctionPortal, 'upper_auction_portal', evidence);
  const genesisLaw = getRequiredLaw(genesis).state.law;
  let atGenesisPortal = moveAlongRoutePath(genesis, 'lower_serum_supply', evidence, {
    skipGenesisPreparation: true
  });
  atGenesisPortal = collectCurrentRouteReward(selectNode(atGenesisPortal, 'lower_serum_supply'), evidence);
  atGenesisPortal = recordSoulRouteMovement(atGenesisPortal, 'third_splice_console', evidence);
  atGenesisPortal = resolvePendingGenesisSplice(atGenesisPortal, evidence, ['renewal']);
  for (const nodeId of [
    'mutation_guardian_omega',
    'lineage_event_stage',
    'genome_repair_station'
  ]) {
    atGenesisPortal = moveAlongRoutePath(atGenesisPortal, nodeId, evidence, {
      skipGenesisPreparation: true
    });
  }
  atGenesisPortal = moveAlongRoutePath(atGenesisPortal, 'lower_genesis_portal', evidence, {
    resolveTargetDanger: false,
    collectTargetReward: false,
    skipGenesisPreparation: true
  });
  const broadcast = useTrackedPortal(atGenesisPortal, 'lower_genesis_portal', evidence);
  const broadcastLaw = getRequiredLaw(broadcast).state.law;
  const atBroadcastPortal = moveAlongRoutePath(broadcast, 'lower_return_portal', evidence, {
    broadcastRelayChoices: STANDARD_BROADCAST_RELAY_CHOICES,
    resolveTargetDanger: false,
    collectTargetReward: false
  });
  const shelter = useTrackedPortal(atBroadcastPortal, 'lower_return_portal', evidence);
  const shelterLaw = getRequiredLaw(shelter).state.law;
  const atShelterPortal = moveAlongRoutePath(shelter, 'upper_return_portal', evidence, {
    escortCheckpointChoices: STANDARD_ESCORT_CHECKPOINT_CHOICES,
    resolveTargetDanger: false,
    collectTargetReward: false
  });
  const testimony = useTrackedPortal(atShelterPortal, 'upper_return_portal', evidence);
  const testimonyLaw = getRequiredLaw(testimony).state.law;
  const atTestimonyPortal = moveAlongRoutePath(testimony, 'upper_return_portal', evidence, {
    resolveTargetDanger: false,
    collectTargetReward: false
  });
  const replay = useTrackedPortal(atTestimonyPortal, 'upper_return_portal', evidence);
  const replayLaw = getRequiredLaw(replay).state.law;
  const atReplayPortal = moveAlongRoutePath(replay, 'upper_return_portal', evidence);
  const panopticon = useTrackedPortal(atReplayPortal, 'upper_return_portal', evidence);
  const panopticonLaw = getRequiredLaw(panopticon).state.law;
  const atPanopticonPortal = moveAlongRoutePath(panopticon, 'upper_return_portal', evidence);
  const demon = useTrackedPortal(atPanopticonPortal, 'upper_return_portal', evidence);
  const demonLaw = getRequiredLaw(demon).state.law;
  if (
    auction.run?.dungeonId !== 'legacy_auction_court' ||
    genesis.run?.dungeonId !== 'genesis_vault' ||
    broadcast.run?.dungeonId !== 'silent_broadcast_tower' ||
    shelter.run?.dungeonId !== 'lost_shelter' ||
    testimony.run?.dungeonId !== 'false_testimony_court' ||
    replay.run?.dungeonId !== 'combat_replay_stage' ||
    panopticon.run?.dungeonId !== 'panopticon_city' ||
    demon.run?.dungeonId !== 'demon_tower_1' ||
    redactionLawKind !== 'redaction_scriptorium' ||
    auctionLaw.kind !== 'legacy_auction_court' ||
    genesisLaw.kind !== 'genesis_vault' ||
    broadcastLaw.kind !== 'silent_broadcast_tower' ||
    shelterLaw.kind !== 'lost_shelter' ||
    testimonyLaw.kind !== 'false_testimony_court' ||
    replayLaw.kind !== 'combat_replay_stage' ||
    panopticonLaw.kind !== 'panopticon_city' ||
    demonLaw.kind !== 'demon_tower'
  ) {
    throw new BalanceSimulationError('Redaction portal ring did not preserve the authored dungeon/law sequence.');
  }

  return {
    dungeonIds: ['redaction_scriptorium', 'legacy_auction_court', 'genesis_vault', 'silent_broadcast_tower', 'lost_shelter', 'false_testimony_court', 'combat_replay_stage', 'panopticon_city', 'demon_tower_1'],
    lawKinds: ['redaction_scriptorium', 'legacy_auction_court', 'genesis_vault', 'silent_broadcast_tower', 'lost_shelter', 'false_testimony_court', 'combat_replay_stage', 'panopticon_city', 'demon_tower'],
    noPriorLawLeakage:
      !('resolvedClauseChoices' in auctionLaw) &&
      !('bossClauseSnapshot' in auctionLaw) &&
      !('resolvedClauseChoices' in genesisLaw) &&
      !('bossClauseSnapshot' in genesisLaw) &&
      !('resolvedLotChoices' in genesisLaw) &&
      !('bossLotSnapshot' in genesisLaw) &&
      !('spliceSequence' in broadcastLaw) &&
      !('bossGenomeSnapshot' in broadcastLaw) &&
      !('resolvedRelayChoices' in shelterLaw) &&
      !('bossNoiseSnapshot' in shelterLaw) &&
      !('resolvedCheckpointChoices' in testimonyLaw) &&
      !('bossSurvivorSnapshot' in testimonyLaw) &&
      !('evidence' in replayLaw) &&
      !('bossVerdictSnapshot' in replayLaw) &&
      !('scanPhase' in replayLaw) &&
      !('takes' in panopticonLaw) &&
      !('resolvedClauseChoices' in demonLaw) &&
      !('bossClauseSnapshot' in demonLaw) &&
      !('resolvedLotChoices' in demonLaw) &&
      !('bossLotSnapshot' in demonLaw) &&
      !('resolvedRelayChoices' in demonLaw) &&
      !('bossNoiseSnapshot' in demonLaw)
  };
}

export function simulateRedactionScriptoriumLawRoute(
  initialState: GameState = simulateSevenDungeonVictoryRoute().finalState
): RedactionScriptoriumLawRouteResult {
  const baseState = structuredClone(initialState);
  const standard = runRedactionBossScenario(baseState, STANDARD_REDACTION_CLAUSE_CHOICES);
  const allCertify = runRedactionBossScenario(baseState, ALL_CERTIFY_REDACTION_CHOICES);
  const allRedact = runRedactionBossScenario(baseState, ALL_REDACT_REDACTION_CHOICES);
  const returnCost = standard.redactCosts.return_clause_desk;
  if (!returnCost || !standard.status.bossClauseSnapshot) {
    throw new BalanceSimulationError('Standard redaction path did not retain return cost and boss snapshot evidence.');
  }

  const equipmentCases = [
    {
      equipmentId: 'redline_edge',
      replacementId: 'chronal_edge',
      matchingMetrics: ['defensePercent']
    },
    {
      equipmentId: 'palimpsest_mantle',
      replacementId: 'phaseweave_mantle',
      matchingMetrics: ['artPowerPercent']
    },
    {
      equipmentId: 'final_proof_seal',
      replacementId: 'homecoming_prism',
      matchingMetrics: ['healingPercent', 'guardEffectPercent']
    }
  ] as const;
  const equipmentMatrix = equipmentCases.map(({ equipmentId, replacementId, matchingMetrics }) => {
    const scenario = runRedactionBossScenario(baseState, ALL_CERTIFY_REDACTION_CHOICES, [equipmentId]);
    const law = getRequiredLaw(scenario.bossState).state.law;
    if (law.kind !== 'redaction_scriptorium') {
      throw new BalanceSimulationError(`${equipmentId}: redaction entry-passive snapshot was unavailable.`);
    }
    const mutated = equipEquipment(scenario.bossState, replacementId);
    const afterMutation = getCurrentRedactionClauseStatus(mutated)?.projectedBossEffects;
    if (!afterMutation) {
      throw new BalanceSimulationError(`${equipmentId}: redaction projection disappeared after equipment mutation.`);
    }
    return {
      equipmentId,
      matchingMetrics,
      entryPassives: { ...law.entryPassives },
      projectedAtBoss: structuredClone(scenario.status.projectedBossEffects),
      projectedAfterMutation: structuredClone(afterMutation),
      frozenAfterMutation:
        JSON.stringify(afterMutation) === JSON.stringify(scenario.status.projectedBossEffects)
    };
  });

  return {
    baseState,
    standardPath: {
      clauseChoices: { ...STANDARD_REDACTION_CLAUSE_CHOICES },
      redactCost: {
        nodeId: 'return_clause_desk',
        costPercent: 8,
        maxHp: returnCost.maxHp,
        hpBefore: returnCost.hpBefore,
        hpAfter: returnCost.hpAfter,
        damage: returnCost.hpBefore - returnCost.hpAfter
      },
      gates: {
        certifiedBodyAreaOpen: standard.bodyAreaOpen,
        certifiedMemoryAreaOpen: standard.memoryAreaOpen,
        redactedReturnAreaOpen: standard.returnAreaOpen,
        bossApproachOpen: standard.bossApproachOpen
      },
      bossSnapshot: { ...standard.status.bossClauseSnapshot }
    },
    bossComparison: {
      allCertify: structuredClone(allCertify.status.projectedBossEffects),
      allRedact: structuredClone(allRedact.status.projectedBossEffects)
    },
    equipmentMatrix,
    portalRing: simulateRedactionPortalRing(baseState)
  };
}

export function simulateLegacyAuctionCourtLawScenario(
  initialState: GameState = simulateSevenDungeonVictoryRoute().finalState
): LegacyAuctionCourtLawScenarioResult {
  const baseState = prepareDeepRouteBaseState(initialState);
  const lotNodeIds = [
    'force_lot_dais',
    'guard_lot_dais',
    'art_lot_dais',
    'return_lot_dais'
  ] as const satisfies readonly AuctionLotNodeId[];
  const lotChoices = ['bid', 'burn', 'fold'] as const satisfies readonly AuctionLotChoice[];
  const fundingRoute = [
    'estate_gate',
    'archive_survey_gallery',
    'force_relic_gallery',
    'north_scrip_cache',
    'force_lot_dais',
    'lower_bid_supply',
    'art_lot_dais',
    'art_relic_gallery',
    'south_scrip_cache',
    'dead_team_testimony_stage',
    'return_lot_dais',
    'guard_lot_dais'
  ] as const;
  const rows: LegacyAuctionCourtLawScenarioRow[] = [];

  for (const forceChoice of lotChoices) {
    for (const guardChoice of lotChoices) {
      for (const artChoice of lotChoices) {
        for (const returnChoice of lotChoices) {
          const choices = {
            force_lot_dais: forceChoice,
            guard_lot_dais: guardChoice,
            art_lot_dais: artChoice,
            return_lot_dais: returnChoice
          } as const satisfies Readonly<Record<AuctionLotNodeId, AuctionLotChoice>>;
          const evidence = createRouteCombatEvidence({
            visitedNodeIds: [],
            chooseRunRelic: chooseDeepRouteRelic
          });
          const prepared = prepareDeepRouteState(baseState, 'legacy_auction_court');
          let state = enterPreparedDungeon(prepared, 'legacy_auction_court', evidence, {
            plannedNodeIds: [...fundingRoute, 'estate_auctioneer'],
            additionalTacticalItemIds: ['healing_pill', 'focus_incense', 'armor_patch'],
            inventoryTargets: { healing_pill: 64, focus_incense: 16, armor_patch: 16 }
          });
          for (const nodeId of fundingRoute) {
            state = moveAlongRoutePath(state, nodeId, evidence, { auctionLotChoices: choices });
          }
          state = moveAlongRoutePath(state, 'estate_auctioneer', evidence, {
            auctionLotChoices: choices,
            resolveTargetDanger: false
          });
          const bossState = selectNode(state, 'estate_auctioneer');
          const status = getCurrentAuctionLotStatus(bossState);
          const law = getRequiredLaw(bossState).state.law;
          if (
            bossState.phase !== 'combat' ||
            law.kind !== 'legacy_auction_court' ||
            !status?.bossLotSnapshot ||
            !status.allLotsResolved ||
            evidence.auctionLotChoiceTrace.length !== lotNodeIds.length
          ) {
            throw new BalanceSimulationError(
              `${Object.values(choices).join('/')}: auction law scenario did not freeze all four real lot choices.`
            );
          }
          const bossSnapshot = { ...status.bossLotSnapshot } as Record<AuctionLotNodeId, AuctionLotChoice>;
          if (lotNodeIds.some((nodeId) => bossSnapshot[nodeId] !== choices[nodeId])) {
            throw new BalanceSimulationError(
              `${Object.values(choices).join('/')}: auction boss snapshot did not match the resolved choices.`
            );
          }
          const mutationAttempt = resolveAuctionLot(bossState, choices.force_lot_dais === 'fold' ? 'bid' : 'fold');
          const snapshotAfterMutation = getCurrentAuctionLotStatus(mutationAttempt)?.bossLotSnapshot;
          const scripConsumed = evidence.auctionLotChoiceTrace.reduce((total, trace) => total + trace.scripCost, 0);
          const scripRemaining = bossState.run?.lootBag.items.legacy_scrip ?? 0;

          rows.push({
            choiceKey: lotNodeIds.map((nodeId) => choices[nodeId]).join('/'),
            choices: { ...choices },
            choiceTrace: structuredClone(evidence.auctionLotChoiceTrace),
            scripCollected: scripConsumed + scripRemaining,
            scripConsumed,
            scripRemaining,
            entryPassives: { ...law.entryPassives },
            bossSnapshot,
            bossModifiers: structuredClone(status.projectedBossModifiers),
            frozenBossSnapshot: JSON.stringify(snapshotAfterMutation) === JSON.stringify(bossSnapshot),
            routeEvidence: getRouteLegalityEvidence(evidence)
          });
        }
      }
    }
  }

  return { baseState, rows };
}

export function simulateSevenDungeonImprintRoute(
  initialState: GameState = simulateSevenDungeonVictoryRoute().finalState
): SevenDungeonImprintRouteResult {
  const baseState = structuredClone(initialState);
  const summaries: SevenDungeonImprintRouteSummary[] = [];

  for (const dungeonId of DUNGEON_ORDER) {
    const definition = getRunProtocolDefinition(dungeonId, 'imprint');
    if (!definition || definition.id !== 'imprint') {
      throw new BalanceSimulationError(`Missing imprint route definition for ${dungeonId}.`);
    }

    const anchorNode = DUNGEONS[dungeonId].nodes.find((node) => node.id === definition.requiredNodeId);
    const bossNodeId = getBossDefinition(dungeonId).nodeId;
    if (!anchorNode) {
      throw new BalanceSimulationError(`Missing imprint route anchor for ${dungeonId}.`);
    }
    if (anchorNode.type !== 'trap' && anchorNode.type !== 'reward' && anchorNode.type !== 'portal') {
      throw new BalanceSimulationError(`Unsupported imprint anchor ${anchorNode.id} (${anchorNode.type}) in ${dungeonId}.`);
    }

    let preparedState = {
      ...structuredClone(baseState),
      rewardPoints: Math.max(baseState.rewardPoints, 10_000)
    };
    if (dungeonId === 'causal_clearinghouse') {
      preparedState = prepareCausalLedgerRouteState(preparedState);
    }
    if (dungeonId === 'entropy_ark') {
      preparedState = prepareEntropyArkRouteState(preparedState);
    }
    if (dungeonId === 'mirror_cycle_city') {
      preparedState = prepareMirrorCycleCityRouteState(preparedState, [
        'parallax_visor',
        'phaseweave_mantle',
        'homecoming_prism'
      ]);
    }
    if (dungeonId === 'redaction_scriptorium') {
      preparedState = prepareRedactionScriptoriumCombatState(preparedState);
    }
    if (dungeonId === 'legacy_auction_court') {
      preparedState = prepareDeepRouteState(prepareDeepRouteBaseState(preparedState), dungeonId);
    }
    if (dungeonId === 'genesis_vault') {
      preparedState = prepareDeepRouteState(prepareDeepRouteBaseState(preparedState), dungeonId);
    }
    if (dungeonId === 'silent_broadcast_tower') {
      const broadcastBase = prepareDeepRouteBaseState(preparedState);
      preparedState = restoreSimulationHealth({
        ...broadcastBase,
        player: {
          ...broadcastBase.player,
          base: {
            ...broadcastBase.player.base,
            body: Math.max(broadcastBase.player.base.body, 80),
            spirit: Math.max(broadcastBase.player.base.spirit, 64)
          }
        }
      });
    }
    if (dungeonId === 'lost_shelter') {
      preparedState = prepareDeepRouteState(
        prepareLostShelterSpecializationHubState(
          prepareDeepRouteBaseState(preparedState),
          'completed_replay',
          false
        ).state,
        dungeonId
      );
    }
    if (dungeonId === 'combat_replay_stage') {
      preparedState = prepareCombatReplayProtocolBuild(preparedState, 'imprint');
    }
    preparedState = restoreSimulationHealth(preparedState);
    const counterItemCounts = new Map<keyof GameState['inventory'], number>();
    for (const node of DUNGEONS[dungeonId].nodes) {
      const counterItem = node.trap?.counterItem;
      if (counterItem) counterItemCounts.set(counterItem, (counterItemCounts.get(counterItem) ?? 0) + 1);
    }
    for (const [counterItem, count] of counterItemCounts) {
      while (preparedState.inventory[counterItem] < count) {
        const beforeCount = preparedState.inventory[counterItem];
        preparedState = buyItem(preparedState, counterItem);
        if (preparedState.inventory[counterItem] === beforeCount) {
          throw new BalanceSimulationError(`Unable to buy ${counterItem} for the ${dungeonId} imprint route.`);
        }
      }
    }
    // The anchor approach consumes part of the loadout before the final echo, so keep a legal reserve for the boss.
    const healingPillTarget =
      dungeonId === 'temporal_observatory' || dungeonId === 'void_citadel' ? 48 : 6;
    while (preparedState.inventory.healing_pill < healingPillTarget) {
      const beforeCount = preparedState.inventory.healing_pill;
      preparedState = buyItem(preparedState, 'healing_pill');
      if (preparedState.inventory.healing_pill === beforeCount) {
        throw new BalanceSimulationError(`Unable to buy healing_pill for the ${dungeonId} imprint route.`);
      }
    }
    if (dungeonId === 'temporal_observatory') {
      preparedState = prepareTemporalRouteEquipment(preparedState);
    }

    const cycleImprintsBefore = preparedState.inventory.cycle_imprint;
    const combatEvidence = createRouteCombatEvidence({
      prioritizeHealing: dungeonId !== 'temporal_observatory' && dungeonId !== 'causal_clearinghouse',
      healingTargetRatio:
        dungeonId === 'void_citadel' ? 0.9 : 0.7,
      reserveThunderTalismanForNodeId: dungeonId === 'void_citadel' ? bossNodeId : undefined,
      scriptedActions: dungeonId === 'silent_broadcast_tower'
        ? { [bossNodeId]: BROADCAST_BOSS_SURVIVAL_SCRIPT }
        : dungeonId === 'void_citadel'
        ? {
            [bossNodeId]: [
              'use_thunder_talisman',
              'use_thunder_talisman',
              'use_thunder_talisman',
              'use_thunder_talisman',
              'guard',
              'art'
            ]
          }
        : undefined
    });
    const lawPreparationNodeIds =
      dungeonId === 'temporal_observatory'
        ? (['past_calibration_anchor', 'zero_meridian', 'future_calibration_anchor'] as const)
        : dungeonId === 'silent_broadcast_tower'
          ? DUNGEON_LAW_LANDMARKS.silent_broadcast_tower.relayNodeIds
        : [];
    let state = enterPreparedDungeon(preparedState, dungeonId, combatEvidence, {
      protocolId: 'imprint',
      methodTechnique:
        dungeonId === 'silent_broadcast_tower' || dungeonId === 'combat_replay_stage'
          ? 'live'
          : undefined,
      plannedNodeIds: [definition.requiredNodeId, ...lawPreparationNodeIds],
      portalUseNodeIds: anchorNode.type === 'portal' ? [anchorNode.id] : [],
      additionalTacticalItemIds:
        dungeonId === 'silent_broadcast_tower'
          ? ['armor_patch', 'healing_pill']
        : dungeonId === 'genesis_vault'
          ? ['healing_pill', 'armor_patch', 'thunder_talisman']
        : dungeonId === 'temporal_observatory'
          ? ['gate_sigil']
          : dungeonId === 'void_citadel'
            ? ['thunder_talisman', 'focus_incense', 'armor_patch']
            : dungeonId === 'causal_clearinghouse'
              ? ['gate_sigil', 'armor_patch', 'healing_pill']
            : dungeonId === 'legacy_auction_court'
              ? ['healing_pill', 'focus_incense', 'armor_patch']
            : dungeonId === 'combat_replay_stage'
              ? ['healing_pill', 'dispel_talisman', 'armor_patch']
            : [],
      inventoryTargets:
        dungeonId === 'silent_broadcast_tower'
          ? { healing_pill: 64, armor_patch: 64 }
        : dungeonId === 'genesis_vault'
          ? { healing_pill: 64, armor_patch: 64, thunder_talisman: 32 }
        : dungeonId === 'temporal_observatory'
          ? { gate_sigil: 8, healing_pill: healingPillTarget }
          : dungeonId === 'void_citadel'
          ? { thunder_talisman: 4, armor_patch: 4, healing_pill: healingPillTarget }
          : dungeonId === 'causal_clearinghouse'
            ? { gate_sigil: 4, armor_patch: 4, healing_pill: healingPillTarget }
          : dungeonId === 'legacy_auction_court'
            ? { healing_pill: 64, focus_incense: 12, armor_patch: 12 }
          : dungeonId === 'combat_replay_stage'
            ? { healing_pill: 64, dispel_talisman: 16, armor_patch: 16 }
          : {}
    });
    state = moveAlongRoutePath(state, definition.requiredNodeId, combatEvidence, {
      excludedNodeIds: new Set([bossNodeId]),
      broadcastRelayChoices: dungeonId === 'silent_broadcast_tower'
        ? REPEAT_BROADCAST_RELAY_CHOICES
        : undefined
    });
    if (anchorNode.type === 'portal' && !state.run?.clearedNodeIds.includes(anchorNode.id)) {
      state = useTrackedPortal(state, anchorNode.id, combatEvidence);
    }

    if (!state.run?.clearedNodeIds.includes(definition.requiredNodeId)) {
      throw new BalanceSimulationError(
        `Balance simulation failed in ${dungeonId}: imprint anchor ${definition.requiredNodeId} was not cleared.`
      );
    }
    for (const lawNodeId of lawPreparationNodeIds) {
      if (!state.run?.clearedNodeIds.includes(lawNodeId)) {
        state = moveAlongRoutePath(state, lawNodeId, combatEvidence, {
          broadcastRelayChoices: dungeonId === 'silent_broadcast_tower'
            ? REPEAT_BROADCAST_RELAY_CHOICES
            : undefined
        });
      }
    }

    state = collectBossRouteRecovery(state, dungeonId, combatEvidence);
    const exitReady = collectRouteRewards(state, dungeonId, combatEvidence);
    const settled = resolvePendingRunRelicArchive(resolveExit(exitReady));
    const clearedNodeIds = [...(settled.run?.clearedNodeIds ?? [])];
    const anchorClearIndex = clearedNodeIds.indexOf(definition.requiredNodeId);
    const bossClearIndex = clearedNodeIds.indexOf(bossNodeId);
    const settlement = settled.run?.lastProtocolSettlement;
    const cycleImprintsAfter = settled.inventory.cycle_imprint;
    const routeCycleImprints = clearedNodeIds.reduce((total, nodeId) => {
      const node = DUNGEONS[dungeonId].nodes.find((candidate) => candidate.id === nodeId);
      return total + (node?.reward?.items?.cycle_imprint ?? 0);
    }, 0);
    const expectedCycleImprintDelta = 1 + routeCycleImprints;

    if (
      settlement?.status !== 'succeeded' ||
      !settlement.anchorCompletedBeforeBoss ||
      !settlement.cycleImprintGranted ||
      anchorClearIndex < 0 ||
      bossClearIndex < 0 ||
      anchorClearIndex >= bossClearIndex ||
      cycleImprintsAfter - cycleImprintsBefore !== expectedCycleImprintDelta
    ) {
      throw new BalanceSimulationError(
        `Balance simulation failed in ${dungeonId}: imprint protocol did not settle after anchor-before-boss clear ` +
          `(status=${settlement?.status ?? 'missing'}, anchorBeforeBoss=${settlement?.anchorCompletedBeforeBoss ?? false}, ` +
          `granted=${settlement?.cycleImprintGranted ?? false}, indices=${anchorClearIndex}/${bossClearIndex}, ` +
          `delta=${cycleImprintsAfter - cycleImprintsBefore}/${expectedCycleImprintDelta}).`
      );
    }

    summaries.push({
      tier: DUNGEONS[dungeonId].tier,
      dungeonId,
      dungeonName: DUNGEONS[dungeonId].name,
      definition: structuredClone(definition),
      requiredNodeId: definition.requiredNodeId,
      anchorNodeType: anchorNode.type,
      bossNodeId,
      clearedNodeIds,
      anchorClearIndex,
      bossClearIndex,
      settlement: structuredClone(settlement),
      rewardPointBonus: settlement.rewardPointBonus,
      cycleImprintsBefore,
      cycleImprintsAfter,
      cycleImprintDelta: cycleImprintsAfter - cycleImprintsBefore,
      bossBreachAvoided: settlement.anchorCompletedBeforeBoss,
      weaponSkillUseCount: combatEvidence.usedWeaponSkillNodeIds.length,
      usedWeaponSkillNodeIds: [...combatEvidence.usedWeaponSkillNodeIds],
      focusTrace: structuredClone(combatEvidence.focusTrace),
      routeEvidence: getRouteLegalityEvidence(combatEvidence),
      finalState: structuredClone(settled)
    });
  }

  return {
    baseState,
    summaries
  };
}

type DeepRouteEntry = {
  state: GameState;
  cycleImprintsBeforeEntry: number;
  cycleImprintsAfterEntry: number;
  entryCycleImprintDelta: number;
};

type DeepRouteSettlementExecution = {
  branch: SevenDungeonDeepRouteBranchSummary;
  evidence: RouteCombatEvidence;
  exitReadyState: GameState;
  firstExitState: GameState;
  duplicateExitState: GameState;
};

function getDeepRouteRequiredNodeIds(definition: DeepRunProtocolDefinition): [string, string] {
  const requiredNodeIds = getRunProtocolRequiredNodeIds(definition);
  if (requiredNodeIds.length !== 2 || requiredNodeIds[0] === requiredNodeIds[1]) {
    throw new BalanceSimulationError(`${definition.dungeonId}: deep protocol must expose two distinct anchors.`);
  }
  return [requiredNodeIds[0], requiredNodeIds[1]];
}

function chooseDeepRouteRelic(
  _state: GameState,
  candidateIds: readonly RunRelicId[]
): RunRelicId {
  return candidateIds.find((relicId) => relicId === 'bone_shell') ??
    candidateIds.find((relicId) => relicId === 'mending_thread') ??
    candidateIds[0];
}

const DEEP_ROUTE_EQUIPMENT_PLAN = [
  ['starforged_edge', 'forge_overdrive'],
  ['mist_hood', 'mist_veilguard'],
  ['guardian_plate', 'forge_overdrive'],
  ['guardian_gauntlets', 'forge_overdrive'],
  ['cloudstep_boots', 'mist_veilguard'],
  ['rift_belt', 'rift_anchor'],
  ['void_lantern', 'rift_anchor']
] as const satisfies readonly (readonly [EquipmentId, EquipmentAttunementId])[];

function prepareDeepRouteBaseState(initialState: GameState): GameState {
  let state = initialState.phase === 'hub' ? structuredClone(initialState) : returnToHub(structuredClone(initialState));
  if (state.phase !== 'hub') {
    throw new BalanceSimulationError('Deep route matrix requires a hub state with no pending relic settlement.');
  }

  const fundedInventory = { ...state.inventory };
  for (const materialId of [
    'demon_bone',
    'hidden_stone',
    'medicine_ash',
    'mirror_shell',
    'star_iron',
    'method_page',
    'cracked_core',
    'rift_dust',
    'causal_seal',
    'silence_core',
    'rescue_badge'
  ] as const) {
    fundedInventory[materialId] = Math.max(fundedInventory[materialId], 64);
  }
  fundedInventory.cycle_imprint = Math.max(fundedInventory.cycle_imprint, 32);
  fundedInventory.chronal_glass = Math.max(fundedInventory.chronal_glass, 64);
  state = {
    ...state,
    rewardPoints: Math.max(state.rewardPoints, 100_000),
    lingyun: Math.max(state.lingyun, 100),
    inventory: fundedInventory,
    player: {
      ...state.player,
      base: {
        ...state.player.base,
        body: Math.max(state.player.base.body, 24),
        spirit: Math.max(state.player.base.spirit, 18),
        agility: Math.max(state.player.base.agility, 12),
        luck: Math.max(state.player.base.luck, 12)
      }
    }
  };
  state = learnMethod(state, 'iron_body');
  state = upgradeMethod(upgradeMethod(state, 'iron_body'), 'iron_body');
  state = activateMethod(state, 'iron_body');

  // The failure probes fight breached bosses, so prepare a real late-game build rather than mutating combat stats.
  for (const [equipmentId, attunementId] of DEEP_ROUTE_EQUIPMENT_PLAN) {
    if (!state.ownedEquipment.includes(equipmentId)) state = buyEquipment(state, equipmentId);
    if (!state.ownedEquipment.includes(equipmentId)) {
      throw new BalanceSimulationError(`Unable to buy ${equipmentId} for the funded deep-route fixture.`);
    }

    while ((state.equipmentLevels[equipmentId] ?? 1) < EQUIPMENT[equipmentId].maxLevel) {
      const beforeLevel = state.equipmentLevels[equipmentId] ?? 1;
      state = upgradeEquipment(state, equipmentId);
      if ((state.equipmentLevels[equipmentId] ?? 1) === beforeLevel) {
        throw new BalanceSimulationError(`Unable to upgrade ${equipmentId} for the funded deep-route fixture.`);
      }
    }
    state = attuneEquipment(state, equipmentId, attunementId);
    if (state.equipmentAttunements?.[equipmentId] !== attunementId) {
      throw new BalanceSimulationError(`Unable to attune ${equipmentId} for the funded deep-route fixture.`);
    }
    while ((state.equipmentTemperRanks?.[equipmentId] ?? 0) < 2) {
      const beforeRank = state.equipmentTemperRanks?.[equipmentId] ?? 0;
      state = temperEquipment(state, equipmentId);
      if ((state.equipmentTemperRanks?.[equipmentId] ?? 0) === beforeRank) {
        throw new BalanceSimulationError(`Unable to temper ${equipmentId} for the funded deep-route fixture.`);
      }
    }
    state = equipEquipment(state, equipmentId);
    if (state.equipped[EQUIPMENT[equipmentId].slot] !== equipmentId) {
      throw new BalanceSimulationError(`Unable to equip ${equipmentId} for the funded deep-route fixture.`);
    }
  }

  if (!state.ownedPets.includes('starling_drone')) state = buyPet(state, 'starling_drone');
  if (!upgradePet) throw new BalanceSimulationError('Pet upgrades are unavailable for the funded deep-route fixture.');
  while ((state.petLevels.starling_drone ?? 1) < 3) {
    const beforeLevel = state.petLevels.starling_drone ?? 1;
    state = upgradePet(state, 'starling_drone');
    if ((state.petLevels.starling_drone ?? 1) === beforeLevel) {
      throw new BalanceSimulationError('Unable to upgrade starling_drone for the funded deep-route fixture.');
    }
  }
  state = activatePet(state, 'starling_drone');
  state = configureRunRelicPreparation(state, 'bulwark');
  const maxHp = getDerivedStats(state).maxHp;
  return {
    ...state,
    player: { ...state.player, hp: maxHp, maxHp }
  };
}

const COMBAT_REPLAY_PROTOCOL_BUILD = [
  ['frame_engraver', 'forge_overdrive'],
  ['cue_visor', 'mist_veilguard'],
  ['buffer_plate', 'rift_anchor'],
  ['thaw_metronome', 'chronal_stasis']
] as const satisfies readonly (readonly [EquipmentId, EquipmentAttunementId])[];

function prepareCombatReplayProtocolBuild(
  initialState: GameState,
  protocolId: RunProtocolId,
  pressurePercent: 0 | 10 = 0,
  excludedEquipmentId?: EquipmentId
): GameState {
  let state = prepareDeepRouteBaseState(initialState);
  const protocol = getRunProtocolDefinition('combat_replay_stage', protocolId);
  const protocolPercent = protocol?.modifiers.enemyStatMultiplierPercent ?? 100;
  const effectiveEnemyPercent = Math.ceil((protocolPercent * (100 + pressurePercent)) / 100);
  state = restoreSimulationHealth({
    ...state,
    inventory: {
      ...state.inventory,
      combat_reel: Math.max(state.inventory.combat_reel, 64),
      star_iron: Math.max(state.inventory.star_iron, 64),
      phase_glass: Math.max(state.inventory.phase_glass, 64),
      rift_dust: Math.max(state.inventory.rift_dust, 64),
      chronal_glass: Math.max(state.inventory.chronal_glass, 64)
    },
    player: {
      ...state.player,
      base: {
        ...state.player.base,
        body: Math.max(state.player.base.body, effectiveEnemyPercent >= 190 ? 1200 : effectiveEnemyPercent >= 159 ? 220 : effectiveEnemyPercent >= 110 ? 200 : 48),
        spirit: Math.max(state.player.base.spirit, effectiveEnemyPercent >= 190 ? 400 : effectiveEnemyPercent >= 159 ? 120 : effectiveEnemyPercent >= 110 ? 96 : 32),
        agility: Math.max(state.player.base.agility, 32)
      }
    }
  });

  for (const [equipmentId, attunementId] of COMBAT_REPLAY_PROTOCOL_BUILD) {
    if (equipmentId === excludedEquipmentId) continue;
    if (!state.ownedEquipment.includes(equipmentId)) state = buyEquipment(state, equipmentId);
    if (!state.ownedEquipment.includes(equipmentId)) {
      throw new BalanceSimulationError(`Combat replay build could not buy ${equipmentId}.`);
    }
    while ((state.equipmentLevels[equipmentId] ?? 1) < EQUIPMENT[equipmentId].maxLevel) {
      const beforeLevel = state.equipmentLevels[equipmentId] ?? 1;
      state = upgradeEquipment(state, equipmentId);
      if ((state.equipmentLevels[equipmentId] ?? 1) === beforeLevel) {
        throw new BalanceSimulationError(`Combat replay build could not upgrade ${equipmentId}.`);
      }
    }
    state = attuneEquipment(state, equipmentId, attunementId);
    while ((state.equipmentTemperRanks?.[equipmentId] ?? 0) < 2) {
      const beforeRank = state.equipmentTemperRanks?.[equipmentId] ?? 0;
      state = temperEquipment(state, equipmentId);
      if ((state.equipmentTemperRanks?.[equipmentId] ?? 0) === beforeRank) {
        throw new BalanceSimulationError(`Combat replay build could not temper ${equipmentId}.`);
      }
    }
    state = equipEquipment(state, equipmentId);
  }

  return restoreSimulationHealth(state);
}

function prepareDeepRouteState(baseState: GameState, dungeonId: DungeonId): GameState {
  let preparedState = dungeonId === 'combat_replay_stage'
    ? prepareCombatReplayProtocolBuild(baseState, 'deep', 10)
    : dungeonId === 'silent_broadcast_tower'
    ? prepareBroadcastRepeatHubState(baseState)
    : structuredClone(baseState);
  if (dungeonId === 'lost_shelter' || dungeonId === 'genesis_vault') {
    preparedState = prepareLostShelterSpecializationHubState(
      preparedState,
      'completed_replay',
      false
    ).state;
  }
  if (dungeonId === 'false_testimony_court') {
    preparedState = prepareFalseTestimonySpecializationHubState(preparedState).state;
  }
  if (dungeonId === 'silent_broadcast_tower' && preparedState.learnedMethods.includes('iron_body')) {
    preparedState = activateMethod(preparedState, 'iron_body');
  }
  if (dungeonId === 'silent_broadcast_tower' && preparedState.ownedCompanions?.includes('lu_guanlan')) {
    preparedState = activateCompanion(preparedState, 'lu_guanlan');
  }
  if (dungeonId === 'silent_broadcast_tower') {
    if (!preparedState.learnedMethods.includes('star_core_method')) {
      preparedState = learnMethod(preparedState, 'star_core_method');
    }
    while ((preparedState.methodRanks?.star_core_method ?? 1) < 3) {
      const beforeRank = preparedState.methodRanks?.star_core_method ?? 1;
      preparedState = upgradeMethod(preparedState, 'star_core_method');
      if ((preparedState.methodRanks?.star_core_method ?? 1) === beforeRank) {
        throw new BalanceSimulationError('Unable to prepare star_core_method R3 for the broadcast deep route.');
      }
    }
    preparedState = activateMethod(preparedState, 'star_core_method');
  }
  if (dungeonId === 'lost_shelter') {
    for (const [equipmentId] of LOST_SHELTER_EQUIPMENT_PREPARATION) {
      if (!preparedState.ownedEquipment.includes(equipmentId)) {
        throw new BalanceSimulationError(`Lost-shelter deep route is missing campaign-owned ${equipmentId}.`);
      }
      preparedState = equipEquipment(preparedState, equipmentId);
    }
    if (!preparedState.learnedMethods.includes('star_core_method')) {
      preparedState = learnMethod(preparedState, 'star_core_method');
    }
    while ((preparedState.methodRanks?.star_core_method ?? 1) < 3) {
      const beforeRank = preparedState.methodRanks?.star_core_method ?? 1;
      preparedState = upgradeMethod(preparedState, 'star_core_method');
      if ((preparedState.methodRanks?.star_core_method ?? 1) === beforeRank) {
        throw new BalanceSimulationError('Unable to prepare star_core_method R3 for the lost-shelter deep route.');
      }
    }
    preparedState = activateMethod(preparedState, 'star_core_method');
    if (preparedState.ownedCompanions?.includes('lu_guanlan')) {
      preparedState = activateCompanion(preparedState, 'lu_guanlan');
    }
    for (let attempt = 0; (preparedState.bloodlineRanks.phoenix_ember ?? 0) < 3 && attempt < 6; attempt += 1) {
      const beforeRank = preparedState.bloodlineRanks.phoenix_ember ?? 0;
      preparedState = beforeRank === 0
        ? unlockBloodline(preparedState, 'phoenix_ember')
        : upgradeBloodline(preparedState, 'phoenix_ember');
      if ((preparedState.bloodlineRanks.phoenix_ember ?? 0) === beforeRank) {
        preparedState = restoreSimulationHealth(returnToHub(clearDungeonViaExit(
          preparedState,
          'genesis_vault',
          createRouteCombatEvidence({ prioritizeHealing: true, healingTargetRatio: 0.75 })
        )));
      }
    }
    if (preparedState.bloodlineRanks.phoenix_ember !== 3) {
      throw new BalanceSimulationError('Unable to prepare phoenix_ember R3 for the lost-shelter deep route.');
    }
    preparedState = activateBloodline(preparedState, 'phoenix_ember');
  }
  if (
    dungeonId === 'entropy_ark' ||
    dungeonId === 'legacy_auction_court' ||
    dungeonId === 'genesis_vault' ||
    dungeonId === 'lost_shelter'
  ) {
    preparedState = {
      ...preparedState,
      player: {
        ...preparedState.player,
        base: {
          ...preparedState.player.base,
          body: Math.max(preparedState.player.base.body, 80),
          spirit: Math.max(preparedState.player.base.spirit, 64)
        }
      }
    };
  }
  const counterItemCounts = new Map<keyof GameState['inventory'], number>();
  for (const node of DUNGEONS[dungeonId].nodes) {
    const counterItem = node.trap?.counterItem;
    if (counterItem) counterItemCounts.set(counterItem, (counterItemCounts.get(counterItem) ?? 0) + 1);
  }
  for (const [counterItem, count] of counterItemCounts) {
    while (preparedState.inventory[counterItem] < count) {
      const beforeCount = preparedState.inventory[counterItem];
      preparedState = buyItem(preparedState, counterItem);
      if (preparedState.inventory[counterItem] === beforeCount) {
        throw new BalanceSimulationError(`Unable to buy ${counterItem} for the ${dungeonId} deep route.`);
      }
    }
  }

  const healingPillTarget = 64;
  while (preparedState.inventory.healing_pill < healingPillTarget) {
    const beforeCount = preparedState.inventory.healing_pill;
    preparedState = buyItem(preparedState, 'healing_pill');
    if (preparedState.inventory.healing_pill === beforeCount) {
      throw new BalanceSimulationError(`Unable to buy healing_pill for the ${dungeonId} deep route.`);
    }
  }
  if (dungeonId === 'causal_clearinghouse') {
    for (const [equipmentId, attunementId] of [
      ['causal_visor', 'chronal_acceleration'],
      ['echo_breaker_gauntlets', 'rift_resonance'],
      ['return_anchor_belt', 'forge_overdrive']
    ] as const) {
      if (!preparedState.ownedEquipment.includes(equipmentId)) preparedState = buyEquipment(preparedState, equipmentId);
      while ((preparedState.equipmentLevels[equipmentId] ?? 1) < EQUIPMENT[equipmentId].maxLevel) {
        const beforeLevel = preparedState.equipmentLevels[equipmentId] ?? 1;
        preparedState = upgradeEquipment(preparedState, equipmentId);
        if ((preparedState.equipmentLevels[equipmentId] ?? 1) === beforeLevel) {
          throw new BalanceSimulationError(`Unable to upgrade ${equipmentId} for the causal deep route.`);
        }
      }
      preparedState = attuneEquipment(preparedState, equipmentId, attunementId);
      while ((preparedState.equipmentTemperRanks?.[equipmentId] ?? 0) < 2) {
        const beforeRank = preparedState.equipmentTemperRanks?.[equipmentId] ?? 0;
        preparedState = temperEquipment(preparedState, equipmentId);
        if ((preparedState.equipmentTemperRanks?.[equipmentId] ?? 0) === beforeRank) {
          throw new BalanceSimulationError(`Unable to temper ${equipmentId} for the causal deep route.`);
        }
      }
      preparedState = equipEquipment(preparedState, equipmentId);
    }
  }
  if (dungeonId === 'entropy_ark') {
    preparedState = prepareEntropyArkRouteState(preparedState);
  }
  if (dungeonId === 'mirror_cycle_city') {
    preparedState = prepareMirrorCycleCityRouteState(preparedState, [
      'parallax_visor',
      'phaseweave_mantle',
      'homecoming_prism'
    ]);
  }
  if (dungeonId === 'redaction_scriptorium') {
    preparedState = prepareRedactionScriptoriumCombatState(preparedState);
  }
  if (dungeonId === 'genesis_vault') {
    preparedState = {
      ...preparedState,
      player: {
        ...preparedState.player,
        base: {
          ...preparedState.player.base,
          body: Math.max(preparedState.player.base.body, 480),
          spirit: Math.max(preparedState.player.base.spirit, 200)
        }
      }
    };
    for (const equipmentId of ['triage_visor', 'evacuation_plate', 'blackbox_beacon'] as const) {
      if (!preparedState.ownedEquipment.includes(equipmentId)) {
        throw new BalanceSimulationError(`Genesis deep route is missing campaign-owned ${equipmentId}.`);
      }
      preparedState = equipEquipment(preparedState, equipmentId);
    }
    if (!preparedState.learnedMethods.includes('star_core_method')) {
      preparedState = learnMethod(preparedState, 'star_core_method');
    }
    while ((preparedState.methodRanks?.star_core_method ?? 1) < 3) {
      const beforeRank = preparedState.methodRanks?.star_core_method ?? 1;
      preparedState = upgradeMethod(preparedState, 'star_core_method');
      if ((preparedState.methodRanks?.star_core_method ?? 1) === beforeRank) {
        throw new BalanceSimulationError('Unable to prepare star_core_method R3 for the genesis deep route.');
      }
    }
    preparedState = activateMethod(preparedState, 'star_core_method');
    if ((preparedState.bloodlineRanks.phoenix_ember ?? 0) >= 3) {
      preparedState = activateBloodline(preparedState, 'phoenix_ember');
    }
    for (const equipmentId of [
      'cross_examiner_sabre',
      'forensic_visor',
      'custody_shell',
      'appeal_seal'
    ] as const) {
      if (preparedState.ownedEquipment.includes(equipmentId)) {
        preparedState = equipEquipment(preparedState, equipmentId);
      }
    }
  }
  if (dungeonId === 'false_testimony_court') {
    for (const [equipmentId] of FALSE_TESTIMONY_EQUIPMENT_PREPARATION) {
      if (!preparedState.ownedEquipment.includes(equipmentId)) {
        throw new BalanceSimulationError(`False-testimony deep route is missing campaign-owned ${equipmentId}.`);
      }
      preparedState = equipEquipment(preparedState, equipmentId);
    }
    for (const equipmentId of ['echo_breaker_gauntlets', 'return_anchor_belt'] as const) {
      if (preparedState.ownedEquipment.includes(equipmentId)) {
        preparedState = equipEquipment(preparedState, equipmentId);
      }
    }
    if (!preparedState.learnedMethods.includes('star_core_method')) {
      preparedState = learnMethod(preparedState, 'star_core_method');
    }
    while ((preparedState.methodRanks.star_core_method ?? 1) < 3) {
      const beforeRank = preparedState.methodRanks.star_core_method ?? 1;
      preparedState = upgradeMethod(preparedState, 'star_core_method');
      if ((preparedState.methodRanks.star_core_method ?? 1) === beforeRank) {
        throw new BalanceSimulationError('Unable to prepare star_core_method R3 for the false-testimony deep route.');
      }
    }
    preparedState = activateMethod(preparedState, 'star_core_method');
    if (preparedState.ownedCompanions.includes('lu_guanlan')) {
      preparedState = activateCompanion(preparedState, 'lu_guanlan');
    }
    if (preparedState.ownedPets.includes('starling_drone')) {
      preparedState = activatePet(preparedState, 'starling_drone');
    }
    if ((preparedState.bloodlineRanks.void_symbiote ?? 0) >= 3) {
      preparedState = activateBloodline(preparedState, 'void_symbiote');
    }
  }
  const restoredState = restoreSimulationHealth(preparedState);
  return dungeonId === 'temporal_observatory'
    ? prepareTemporalRouteEquipment(restoredState)
    : restoredState;
}

function enterDeepRoute(
  baseState: GameState,
  dungeonId: DungeonId,
  plannedNodeIds: readonly string[],
  evidence: RouteCombatEvidence
): DeepRouteEntry {
  const preparedState = prepareDeepRouteState(baseState, dungeonId);
  const cycleImprintsBeforeEntry = preparedState.inventory.cycle_imprint;
  const state = enterPreparedDungeon(preparedState, dungeonId, evidence, {
    protocolId: 'deep',
    methodTechnique:
      dungeonId === 'silent_broadcast_tower' || dungeonId === 'lost_shelter'
        ? 'live'
        : undefined,
    plannedNodeIds,
    additionalTacticalItemIds: dungeonId === 'silent_broadcast_tower'
      ? ['armor_patch', 'healing_pill', 'gate_sigil']
      : dungeonId === 'genesis_vault'
      ? ['healing_pill', 'armor_patch', 'thunder_talisman']
      : dungeonId === 'lost_shelter'
      ? ['thunder_talisman', 'focus_incense', 'armor_patch']
      : dungeonId === 'legacy_auction_court'
      ? ['healing_pill', 'focus_incense', 'armor_patch']
      : dungeonId === 'redaction_scriptorium'
      ? ['healing_pill', 'dispel_talisman', 'armor_patch']
      : dungeonId === 'false_testimony_court'
      ? ['armor_patch', 'dispel_talisman', 'focus_incense']
      : ['thunder_talisman', 'focus_incense'],
    inventoryTargets: dungeonId === 'silent_broadcast_tower'
      ? { healing_pill: 64, armor_patch: 64, gate_sigil: 2 }
      : dungeonId === 'genesis_vault'
      ? { healing_pill: 64, armor_patch: 64, thunder_talisman: 32 }
      : dungeonId === 'lost_shelter'
      ? { thunder_talisman: 12, focus_incense: 12, armor_patch: 12, healing_pill: 64 }
      : dungeonId === 'legacy_auction_court'
      ? { healing_pill: 64, focus_incense: 12, armor_patch: 12 }
      : dungeonId === 'redaction_scriptorium'
      ? { healing_pill: 64, dispel_talisman: 12, armor_patch: 12 }
      : dungeonId === 'false_testimony_court'
      ? { healing_pill: 64, armor_patch: 32, dispel_talisman: 32, focus_incense: 32 }
      : { thunder_talisman: 12, healing_pill: 64 }
  });
  const cycleImprintsAfterEntry = state.inventory.cycle_imprint;
  const entryCycleImprintDelta = cycleImprintsAfterEntry - cycleImprintsBeforeEntry;

  if (state.run?.protocol?.id !== 'deep' || entryCycleImprintDelta !== -1) {
    throw new BalanceSimulationError(
      `${dungeonId}: deep protocol did not enter with an exact cycle-imprint delta of -1.`
    );
  }

  return {
    state,
    cycleImprintsBeforeEntry,
    cycleImprintsAfterEntry,
    entryCycleImprintDelta
  };
}

function getDeepRouteResourceDeltas(
  before: GameState,
  after: GameState,
  materialId: ItemId
): DeepRouteResourceDeltas {
  return {
    rewardPoints: after.rewardPoints - before.rewardPoints,
    lingyun: after.lingyun - before.lingyun,
    cycleImprint: after.inventory.cycle_imprint - before.inventory.cycle_imprint,
    material: after.inventory[materialId] - before.inventory[materialId]
  };
}

function settleDeepRouteBranch(
  entry: DeepRouteEntry,
  exitReady: GameState,
  definition: DeepRunProtocolDefinition,
  requiredNodeIds: [string, string],
  bossNodeId: string,
  evidence: RouteCombatEvidence
): DeepRouteSettlementExecution {
  const firstExitState = resolveExit(exitReady);
  const duplicateExitState = resolveExit(firstExitState);
  const settlement = firstExitState.run?.lastProtocolSettlement;
  if (!settlement || settlement.protocol.id !== 'deep') {
    throw new BalanceSimulationError(`${definition.dungeonId}: deep route did not produce a protocol settlement.`);
  }

  const clearedNodeIds = [...(firstExitState.run?.clearedNodeIds ?? [])];
  return {
    branch: {
      entryProtocolId: 'deep',
      cycleImprintsBeforeEntry: entry.cycleImprintsBeforeEntry,
      cycleImprintsAfterEntry: entry.cycleImprintsAfterEntry,
      entryCycleImprintDelta: entry.entryCycleImprintDelta,
      clearedNodeIds,
      anchorClearIndices: [
        clearedNodeIds.indexOf(requiredNodeIds[0]),
        clearedNodeIds.indexOf(requiredNodeIds[1])
      ],
      bossClearIndex: clearedNodeIds.indexOf(bossNodeId),
      settlement: structuredClone(settlement),
      exitResourceDeltas: getDeepRouteResourceDeltas(
        exitReady,
        firstExitState,
        definition.materialReward.itemId
      )
    },
    evidence,
    exitReadyState: exitReady,
    firstExitState,
    duplicateExitState
  };
}

function prepareDeepAuctionLots(
  state: GameState,
  evidence: RouteCombatEvidence,
  excludedNodeIds: ReadonlySet<string>
): GameState {
  let nextState = moveAlongRoutePath(state, 'estate_gate', evidence, {
    excludedNodeIds,
    auctionLotChoices: STANDARD_AUCTION_LOT_CHOICES
  });
  for (const nodeId of [
    'force_lot_dais',
    'art_lot_dais',
    'return_lot_dais',
    'guard_lot_dais'
  ] as const satisfies readonly AuctionLotNodeId[]) {
    nextState = moveAlongRoutePath(nextState, nodeId, evidence, {
      excludedNodeIds,
      auctionLotChoices: STANDARD_AUCTION_LOT_CHOICES
    });
  }
  return nextState;
}

function simulateDeepSuccessRoute(
  baseState: GameState,
  dungeonId: DungeonId,
  definition: DeepRunProtocolDefinition,
  requiredNodeIds: [string, string],
  bossNodeId: string
): DeepRouteSettlementExecution {
  const evidence = createRouteCombatEvidence({
    prioritizeHealing: dungeonId !== 'temporal_observatory' && dungeonId !== 'causal_clearinghouse',
    healingTargetRatio: dungeonId === 'temporal_observatory' ? 0.7 : dungeonId === 'causal_clearinghouse' ? 0.35 : 0.92,
    scriptedActions: dungeonId === 'silent_broadcast_tower'
      ? { [bossNodeId]: BROADCAST_BOSS_SURVIVAL_SCRIPT }
      : dungeonId === 'combat_replay_stage'
      ? {
          take_alpha: COMBAT_REPLAY_TAKE_ALPHA_SCRIPT,
          take_beta: COMBAT_REPLAY_TAKE_BETA_SCRIPT,
          take_gamma: COMBAT_REPLAY_TAKE_GAMMA_SCRIPT,
          [bossNodeId]: COMBAT_REPLAY_BOSS_SURVIVAL_SCRIPT
        }
      : dungeonId === 'genesis_vault'
      ? {
          [bossNodeId]: Array.from(
            { length: MAX_COMBAT_ACTIONS },
            (_, index) => (['use_thunder_talisman', 'art', 'guard', 'weapon_skill'] as const)[index % 4]
          ) as CombatAction[]
        }
      : dungeonId === 'causal_clearinghouse'
      ? {
          [bossNodeId]: Array.from({ length: MAX_COMBAT_ACTIONS }, (_, index) =>
            index % 4 === 3 ? 'weapon_skill' : 'art'
          ) as CombatAction[]
        }
      : dungeonId === 'panopticon_city'
      ? { [bossNodeId]: PANOPTICON_SURVIVAL_SCRIPT }
      : undefined,
    chooseRunRelic: chooseDeepRouteRelic
  });
  if (
    dungeonId === 'silent_broadcast_tower' ||
    dungeonId === 'lost_shelter' ||
    dungeonId === 'panopticon_city'
  ) {
    evidence.methodTechniqueNodeId = bossNodeId;
    evidence.companionAssistNodeId = bossNodeId;
    evidence.bloodlineSurgeNodeId = bossNodeId;
  }
  const routeBaseState = dungeonId === 'panopticon_city'
    ? preparePanopticonEndgameBuild(baseState, 420)
    : baseState;
  const entry = enterDeepRoute(routeBaseState, dungeonId, requiredNodeIds, evidence);
  let state = entry.state;
  const preBossExcludedNodeIds = new Set([bossNodeId]);
  if (dungeonId === 'legacy_auction_court') {
    state = prepareDeepAuctionLots(state, evidence, preBossExcludedNodeIds);
  }
  if (dungeonId === 'silent_broadcast_tower') {
    const silentRelayChoices = {
      south_relay_console: 'mute',
      north_relay_console: 'mute',
      central_relay_console: 'mute'
    } as const satisfies Readonly<Record<BroadcastRelayNodeId, BroadcastRelayChoice>>;
    for (const relayNodeId of DUNGEON_LAW_LANDMARKS.silent_broadcast_tower.relayNodeIds) {
      state = moveAlongRoutePath(state, relayNodeId, evidence, {
        excludedNodeIds: preBossExcludedNodeIds,
        broadcastRelayChoices: silentRelayChoices
      });
    }
  }
  if (dungeonId === 'lost_shelter') {
    for (const nodeId of LOST_SHELTER_DEEP_CHECKPOINT_NODES) {
      state = moveAlongRoutePath(state, nodeId, evidence, {
        excludedNodeIds: preBossExcludedNodeIds,
        escortCheckpointChoices: STANDARD_ESCORT_CHECKPOINT_CHOICES
      });
    }
  }
  for (const requiredNodeId of requiredNodeIds) {
    if (!state.run?.clearedNodeIds.includes(requiredNodeId)) {
      state = moveAlongRoutePath(state, requiredNodeId, evidence, {
        excludedNodeIds: preBossExcludedNodeIds,
        panopticonRoute: dungeonId === 'panopticon_city' ? 'shadow' : undefined
      });
    }
  }

  const exitReady = collectRouteRewards(state, dungeonId, evidence);
  return settleDeepRouteBranch(entry, exitReady, definition, requiredNodeIds, bossNodeId, evidence);
}

function simulateDeepMissingAnchorRoute(
  baseState: GameState,
  dungeonId: DungeonId,
  definition: DeepRunProtocolDefinition,
  requiredNodeIds: [string, string],
  bossNodeId: string
): DeepRouteSettlementExecution & { omittedNodeId: string } {
  const omittedAnchorIndex = 1;
  const omittedNodeId = requiredNodeIds[omittedAnchorIndex];
  const includedNodeId = requiredNodeIds[0];
  const excludedNodeIds = new Set([omittedNodeId, bossNodeId]);
  const evidence = createRouteCombatEvidence({
    prioritizeHealing: dungeonId !== 'temporal_observatory' && dungeonId !== 'causal_clearinghouse',
    healingTargetRatio: dungeonId === 'temporal_observatory' ? 0.7 : dungeonId === 'causal_clearinghouse' ? 0.35 : 0.92,
    scriptedActions: dungeonId === 'causal_clearinghouse'
      ? {
          [bossNodeId]: Array.from({ length: MAX_COMBAT_ACTIONS }, (_, index) =>
            index % 4 === 3 ? 'weapon_skill' : 'art'
          ) as CombatAction[]
        }
      : dungeonId === 'combat_replay_stage'
      ? {
          take_alpha: COMBAT_REPLAY_TAKE_ALPHA_SCRIPT,
          take_beta: COMBAT_REPLAY_TAKE_BETA_SCRIPT,
          take_gamma: COMBAT_REPLAY_TAKE_GAMMA_SCRIPT,
          [bossNodeId]: COMBAT_REPLAY_BOSS_SURVIVAL_SCRIPT
        }
      : dungeonId === 'genesis_vault'
      ? {
          [bossNodeId]: Array.from(
            { length: MAX_COMBAT_ACTIONS },
            (_, index) => (['use_thunder_talisman', 'art', 'guard', 'weapon_skill'] as const)[index % 4]
          ) as CombatAction[]
        }
      : dungeonId === 'panopticon_city'
      ? { [bossNodeId]: PANOPTICON_SURVIVAL_SCRIPT }
      : undefined,
    chooseRunRelic: chooseDeepRouteRelic
  });
  if (
    dungeonId === 'silent_broadcast_tower' ||
    dungeonId === 'lost_shelter' ||
    dungeonId === 'panopticon_city'
  ) {
    evidence.methodTechniqueNodeId = bossNodeId;
    evidence.companionAssistNodeId = bossNodeId;
    evidence.bloodlineSurgeNodeId = bossNodeId;
  }
  const routeBaseState = dungeonId === 'panopticon_city'
    ? preparePanopticonEndgameBuild(baseState, 420)
    : baseState;
  const entry = enterDeepRoute(routeBaseState, dungeonId, [includedNodeId], evidence);
  let state = dungeonId === 'legacy_auction_court'
    ? prepareDeepAuctionLots(entry.state, evidence, excludedNodeIds)
    : entry.state;
  if (dungeonId === 'false_testimony_court') {
    state = prepareFalseTestimonyCourtApproach(
      state,
      'judgment_lock',
      evidence,
      excludedNodeIds
    );
  }
  if (dungeonId === 'lost_shelter') {
    for (const nodeId of LOST_SHELTER_DEEP_CHECKPOINT_NODES) {
      state = moveAlongRoutePath(state, nodeId, evidence, {
        excludedNodeIds,
        escortCheckpointChoices: STANDARD_ESCORT_CHECKPOINT_CHOICES
      });
    }
  }
  state = moveAlongRoutePath(state, includedNodeId, evidence, {
    excludedNodeIds,
    panopticonRoute: dungeonId === 'panopticon_city' ? 'shadow' : undefined
  });
  if (dungeonId === 'silent_broadcast_tower') {
    const sourceClearedNodeIds = [...(state.run?.clearedNodeIds ?? [])];
    const atPortal = moveAlongRoutePath(state, 'upper_return_portal', evidence, { excludedNodeIds });
    const crossed = useTrackedPortal(atPortal, 'upper_return_portal', evidence);
    const atShelterPortal = moveAlongRoutePath(crossed, 'upper_return_portal', evidence);
    const atTestimony = useTrackedPortal(atShelterPortal, 'upper_return_portal', evidence);
    evidence.useAllCombatSupports = true;
    evidence.prioritizeHealing = true;
    evidence.healingTargetRatio = 0.9;
    evidence.scriptedActions = {
      ...(evidence.scriptedActions ?? {}),
      hostile_witness_north: HOSTILE_WITNESS_SURVIVAL_SCRIPT,
      hostile_witness: HOSTILE_WITNESS_SURVIVAL_SCRIPT
    };
    const atTestimonyPortal = moveAlongRoutePath(atTestimony, 'upper_return_portal', evidence);
    const atReplay = useTrackedPortal(atTestimonyPortal, 'upper_return_portal', evidence);
    const atReplayPortal = moveAlongRoutePath(atReplay, 'upper_return_portal', evidence);
    const atPanopticon = useTrackedPortal(atReplayPortal, 'upper_return_portal', evidence);
    const atPanopticonPortal = moveAlongRoutePath(atPanopticon, 'upper_return_portal', evidence);
    const returnedToTierOne = useTrackedPortal(atPanopticonPortal, 'upper_return_portal', evidence);
    const exitReady = collectRouteRewards(returnedToTierOne, 'demon_tower_1', evidence);
    const execution = settleDeepRouteBranch(entry, exitReady, definition, requiredNodeIds, bossNodeId, evidence);
    const clearedNodeIds = [...new Set([...sourceClearedNodeIds, ...execution.branch.clearedNodeIds])];
    return {
      ...execution,
      branch: {
        ...execution.branch,
        clearedNodeIds,
        anchorClearIndices: [
          clearedNodeIds.indexOf(requiredNodeIds[0]),
          clearedNodeIds.indexOf(requiredNodeIds[1])
        ],
        bossClearIndex: clearedNodeIds.indexOf(bossNodeId)
      },
      omittedNodeId
    };
  }
  if (dungeonId === 'lost_shelter') {
    const sourceClearedNodeIds = [...(state.run?.clearedNodeIds ?? [])];
    const atPortal = moveAlongRoutePath(state, 'return_shelter_portal', evidence, { excludedNodeIds });
    const crossed = useTrackedPortal(atPortal, 'return_shelter_portal', evidence);
    evidence.useAllCombatSupports = true;
    evidence.prioritizeHealing = true;
    evidence.healingTargetRatio = 0.9;
    evidence.scriptedActions = {
      ...(evidence.scriptedActions ?? {}),
      hostile_witness_north: HOSTILE_WITNESS_SURVIVAL_SCRIPT,
      hostile_witness: HOSTILE_WITNESS_SURVIVAL_SCRIPT
    };
    const atTestimonyPortal = moveAlongRoutePath(crossed, 'return_testimony_portal', evidence);
    const atReplay = useTrackedPortal(atTestimonyPortal, 'return_testimony_portal', evidence);
    const atReplayPortal = moveAlongRoutePath(atReplay, 'return_rehearsal_portal', evidence);
    const atPanopticon = useTrackedPortal(atReplayPortal, 'return_rehearsal_portal', evidence);
    const atPanopticonPortal = moveAlongRoutePath(atPanopticon, 'refraction_return_portal', evidence);
    const returnedToTierOne = useTrackedPortal(atPanopticonPortal, 'refraction_return_portal', evidence);
    const exitReady = collectRouteRewards(returnedToTierOne, 'demon_tower_1', evidence);
    const execution = settleDeepRouteBranch(entry, exitReady, definition, requiredNodeIds, bossNodeId, evidence);
    const clearedNodeIds = [...new Set([...sourceClearedNodeIds, ...execution.branch.clearedNodeIds])];
    return {
      ...execution,
      branch: {
        ...execution.branch,
        clearedNodeIds,
        anchorClearIndices: [
          clearedNodeIds.indexOf(requiredNodeIds[0]),
          clearedNodeIds.indexOf(requiredNodeIds[1])
        ],
        bossClearIndex: clearedNodeIds.indexOf(bossNodeId)
      },
      omittedNodeId
    };
  }
  if (dungeonId === 'false_testimony_court') {
    const sourceClearedNodeIds = [...(state.run?.clearedNodeIds ?? [])];
    const atPortal = moveAlongRoutePath(state, 'return_testimony_portal', evidence, { excludedNodeIds });
    const atReplay = useTrackedPortal(atPortal, 'return_testimony_portal', evidence);
    const atReplayPortal = moveAlongRoutePath(atReplay, 'return_rehearsal_portal', evidence);
    const atPanopticon = useTrackedPortal(atReplayPortal, 'return_rehearsal_portal', evidence);
    const atPanopticonPortal = moveAlongRoutePath(atPanopticon, 'refraction_return_portal', evidence);
    const returnedToTierOne = useTrackedPortal(atPanopticonPortal, 'refraction_return_portal', evidence);
    const exitReady = collectRouteRewards(returnedToTierOne, 'demon_tower_1', evidence);
    const execution = settleDeepRouteBranch(entry, exitReady, definition, requiredNodeIds, bossNodeId, evidence);
    const clearedNodeIds = [...new Set([...sourceClearedNodeIds, ...execution.branch.clearedNodeIds])];
    return {
      ...execution,
      branch: {
        ...execution.branch,
        clearedNodeIds,
        anchorClearIndices: [
          clearedNodeIds.indexOf(requiredNodeIds[0]),
          clearedNodeIds.indexOf(requiredNodeIds[1])
        ],
        bossClearIndex: clearedNodeIds.indexOf(bossNodeId)
      },
      omittedNodeId
    };
  }
  if (dungeonId === 'combat_replay_stage') {
    state = prepareCombatReplayBossRoute(state, evidence);
  }
  state = moveAlongRoutePath(state, bossNodeId, evidence, { excludedNodeIds });
  state = resolvePendingEquipmentOffer(state, bossNodeId);
  assertBossSealCleared(state, dungeonId, 'during the missing-anchor deep route');

  const exitNodeId = DUNGEONS[dungeonId].nodes.find((node) => node.type === 'exit')?.id;
  if (!exitNodeId) throw new BalanceSimulationError(`${dungeonId}: deep route has no exit node.`);
  const exitReady = moveAlongRoutePath(state, exitNodeId, evidence, { excludedNodeIds });
  if (exitReady.run?.clearedNodeIds.includes(omittedNodeId)) {
    throw new BalanceSimulationError(`${dungeonId}: missing-anchor route unexpectedly cleared ${omittedNodeId}.`);
  }

  return {
    ...settleDeepRouteBranch(entry, exitReady, definition, requiredNodeIds, bossNodeId, evidence),
    omittedNodeId
  };
}

export function simulateSevenDungeonDeepRoute(
  initialState: GameState = simulateSevenDungeonVictoryRoute().finalState
): SevenDungeonDeepRouteResult {
  const baseState = prepareDeepRouteBaseState(initialState);
  if (!DUNGEON_ORDER.every((dungeonId) => baseState.completedDungeonIds.includes(dungeonId))) {
    throw new BalanceSimulationError('Deep route matrix requires a completed full-campaign state.');
  }

  const summaries: SevenDungeonDeepRouteSummary[] = [];
  for (const dungeonId of DUNGEON_ORDER) {
    const definition = getRunProtocolDefinition(dungeonId, 'deep');
    if (!definition || definition.id !== 'deep') {
      throw new BalanceSimulationError(`Missing deep route definition for ${dungeonId}.`);
    }
    const requiredNodeIds = getDeepRouteRequiredNodeIds(definition);
    const bossNodeId = getBossDefinition(dungeonId).nodeId;
    for (const requiredNodeId of requiredNodeIds) {
      if (!DUNGEONS[dungeonId].nodes.some((node) => node.id === requiredNodeId)) {
        throw new BalanceSimulationError(`${dungeonId}: missing deep anchor ${requiredNodeId}.`);
      }
    }

    const previous = summaries[summaries.length - 1];
    if (
      previous &&
      (definition.modifiers.enemyStatMultiplierPercent <= previous.enemyStatMultiplierPercent ||
        definition.modifiers.clearRewardPointMultiplierPercent <= previous.clearRewardPointMultiplierPercent)
    ) {
      throw new BalanceSimulationError(`${dungeonId}: deep enemy/reward modifiers are not increasing by tier.`);
    }

    const successExecution = simulateDeepSuccessRoute(
      baseState,
      dungeonId,
      definition,
      requiredNodeIds,
      bossNodeId
    );
    const missingExecution = simulateDeepMissingAnchorRoute(
      baseState,
      dungeonId,
      definition,
      requiredNodeIds,
      bossNodeId
    );
    const success = successExecution.branch;
    const missingAnchor: SevenDungeonDeepMissingAnchorSummary = {
      ...missingExecution.branch,
      omittedNodeId: missingExecution.omittedNodeId
    };
    const routeMaterialInventoryDelta =
      success.exitResourceDeltas.material - missingAnchor.exitResourceDeltas.material;
    const protocolMaterialInventoryDelta = success.settlement.materialReward?.amount ?? 0;
    const nonProtocolMaterialInventoryDelta = routeMaterialInventoryDelta - protocolMaterialInventoryDelta;
    const duplicateExitResourceDeltas = getDeepRouteResourceDeltas(
      successExecution.firstExitState,
      successExecution.duplicateExitState,
      definition.materialReward.itemId
    );
    const expectedExitCycleImprintDelta = Number(
      dungeonId === 'mirror_cycle_city' ||
      dungeonId === 'redaction_scriptorium' ||
      dungeonId === 'legacy_auction_court' ||
      dungeonId === 'genesis_vault' ||
      dungeonId === 'silent_broadcast_tower' ||
      dungeonId === 'lost_shelter' ||
      dungeonId === 'false_testimony_court' ||
      dungeonId === 'combat_replay_stage' ||
      dungeonId === 'panopticon_city'
    );
    const expectedMissingExitCycleImprintDelta =
      dungeonId === 'silent_broadcast_tower' ||
      dungeonId === 'lost_shelter' ||
      dungeonId === 'false_testimony_court'
      ? 0
      : expectedExitCycleImprintDelta;
    let legacyAuction: LegacyAuctionDeepRouteEvidence | undefined;
    if (dungeonId === 'legacy_auction_court') {
      const status = getCurrentAuctionLotStatus(successExecution.exitReadyState);
      const law = getRequiredLaw(successExecution.exitReadyState).state.law;
      const trace = successExecution.evidence.auctionLotChoiceTrace;
      const clearedNodeIds = successExecution.exitReadyState.run?.clearedNodeIds ?? [];
      const settledClearedNodeIds = successExecution.firstExitState.run?.clearedNodeIds ?? [];
      if (
        law.kind !== 'legacy_auction_court' ||
        !status?.bossLotSnapshot ||
        !status.allLotsResolved ||
        trace.length !== 4 ||
        STANDARD_AUCTION_LOT_CHOICES.force_lot_dais !== 'bid' ||
        STANDARD_AUCTION_LOT_CHOICES.return_lot_dais !== 'bid' ||
        !Object.values(STANDARD_AUCTION_LOT_CHOICES).includes('burn') ||
        !Object.values(STANDARD_AUCTION_LOT_CHOICES).includes('fold') ||
        !clearedNodeIds.includes('force_claim_vault') ||
        !clearedNodeIds.includes('return_claim_vault') ||
        !clearedNodeIds.includes(bossNodeId) ||
        !settledClearedNodeIds.includes('auction_exit')
      ) {
        throw new BalanceSimulationError(
          'legacy_auction_court: successful deep route did not prove four choices, both bid vaults, boss, and exit.'
        );
      }
      const scripConsumed = trace.reduce((total, choice) => total + choice.scripCost, 0);
      const scripRemainingBeforeExit = successExecution.exitReadyState.run?.lootBag.items.legacy_scrip ?? 0;
      legacyAuction = {
        choices: { ...STANDARD_AUCTION_LOT_CHOICES },
        choiceTrace: structuredClone(trace),
        scripCollected: scripConsumed + scripRemainingBeforeExit,
        scripConsumed,
        scripRemainingBeforeExit,
        optionalBidVaultNodeIds: ['force_claim_vault', 'return_claim_vault'],
        entryPassives: { ...law.entryPassives },
        bossSnapshot: { ...status.bossLotSnapshot } as Record<AuctionLotNodeId, AuctionLotChoice>,
        bossModifiers: structuredClone(status.projectedBossModifiers),
        frozenSoulSkillIds: [...(successExecution.exitReadyState.run?.soulSkillState?.frozenSkillIds ?? [])],
        bossNodeCleared: true,
        exitNodeCleared: true,
        successfulExit: success.settlement.status === 'succeeded'
      };
    }

    if (
      success.settlement.status !== 'succeeded' ||
      success.settlement.cycleImprintGranted ||
      success.settlement.rewardPointBonus <= 0 ||
      success.settlement.materialReward?.itemId !== definition.materialReward.itemId ||
      success.settlement.materialReward.amount !== definition.materialReward.amount ||
      success.anchorClearIndices.some((index) => index < 0 || index >= success.bossClearIndex) ||
      success.exitResourceDeltas.cycleImprint !== expectedExitCycleImprintDelta ||
      protocolMaterialInventoryDelta !== definition.materialReward.amount
    ) {
      throw new BalanceSimulationError(
        `${dungeonId}: successful deep route settlement did not match the protocol matrix ` +
        `(status=${success.settlement.status}, cycle=${success.exitResourceDeltas.cycleImprint}/${expectedExitCycleImprintDelta}, ` +
        `materialDelta=${protocolMaterialInventoryDelta}/${definition.materialReward.amount}).`
      );
    }
    if (
      missingAnchor.settlement.status !== 'failed' ||
      missingAnchor.settlement.rewardPointBonus !== 0 ||
      missingAnchor.settlement.materialReward !== undefined ||
      missingAnchor.anchorClearIndices[requiredNodeIds.indexOf(missingAnchor.omittedNodeId)] !== -1 ||
      missingAnchor.anchorClearIndices.some(
        (index, anchorIndex) =>
          requiredNodeIds[anchorIndex] !== missingAnchor.omittedNodeId &&
          (index < 0 || (missingAnchor.bossClearIndex >= 0 && index >= missingAnchor.bossClearIndex))
      ) ||
      missingAnchor.exitResourceDeltas.cycleImprint !== expectedMissingExitCycleImprintDelta
    ) {
      throw new BalanceSimulationError(
        `${dungeonId}: missing-anchor deep route did not fail without protocol payout ` +
        `(status=${missingAnchor.settlement.status}, reward=${missingAnchor.settlement.rewardPointBonus}, ` +
        `material=${JSON.stringify(missingAnchor.settlement.materialReward)}, ` +
        `anchors=${missingAnchor.anchorClearIndices.join(',')}, boss=${missingAnchor.bossClearIndex}, ` +
        `cycle=${missingAnchor.exitResourceDeltas.cycleImprint}/${expectedMissingExitCycleImprintDelta}).`
      );
    }
    if (Object.values(duplicateExitResourceDeltas).some((delta) => delta !== 0)) {
      throw new BalanceSimulationError(`${dungeonId}: repeated deep exit produced a duplicate payout.`);
    }

    summaries.push({
      tier: DUNGEONS[dungeonId].tier,
      dungeonId,
      dungeonName: DUNGEONS[dungeonId].name,
      definition: structuredClone(definition),
      requiredNodeIds,
      bossNodeId,
      enemyStatMultiplierPercent: definition.modifiers.enemyStatMultiplierPercent,
      clearRewardPointMultiplierPercent: definition.modifiers.clearRewardPointMultiplierPercent,
      success,
      missingAnchor,
      protocolMaterialInventoryDelta,
      routeMaterialInventoryDelta,
      nonProtocolMaterialInventoryDelta,
      duplicateExitResourceDeltas,
      ...(legacyAuction === undefined ? {} : { legacyAuction })
    });
  }

  return { baseState, summaries };
}

export function simulateSevenDungeonRunRelicRoute(
  initialState: GameState = simulateSevenDungeonVictoryRoute().finalState
): SevenDungeonRunRelicRouteResult {
  const baseState = structuredClone(initialState);
  let state = structuredClone(initialState);
  if (state.phase !== 'hub') state = returnToHub(state);
  if (state.phase !== 'hub') {
    throw new BalanceSimulationError('Run relic route requires a hub state with no pending archive settlement.');
  }

  const summaries: SevenDungeonRunRelicRouteSummary[] = [];
  const coveredRelicIds = new Set<RunRelicId>();

  for (const [routeIndex, dungeonId] of DUNGEON_ORDER.entries()) {
    const dungeon = DUNGEONS[dungeonId];
    const frame = RUN_RELIC_ROUTE_FRAMES[dungeonId];
    const candidateMode = routeIndex === 0 ? 'ordinary' : 'matching-equipment-conduit';
    const conduitEquipmentId = RUN_RELIC_ROUTE_CONDUIT_EQUIPMENT[frame];
    const previousSummary = summaries.at(-1);

    state = equipEquipment(state, candidateMode === 'ordinary' ? 'training_blade' : conduitEquipmentId);
    if (candidateMode === 'matching-equipment-conduit') {
      const conduitLevel = state.equipmentLevels[conduitEquipmentId] ?? 0;
      if (conduitLevel < 2 || !Object.values(state.equipped).includes(conduitEquipmentId)) {
        throw new BalanceSimulationError(
          `Run relic route requires equipped level-2 conduit ${conduitEquipmentId} for ${dungeonId}.`
        );
      }
    }

    const currentPreparation = getRunRelicPreparationStatus(state);
    const preservedSeedRelicId = previousSummary?.frame === frame
      ? currentPreparation.preparedRelicSeedId
      : undefined;
    state = configureRunRelicPreparation(state, frame, preservedSeedRelicId);
    const configuredPreparation = getRunRelicPreparationStatus(state);
    if (configuredPreparation.preparedRelicFrame !== frame) {
      throw new BalanceSimulationError(`Unable to configure ${frame} relic frame for ${dungeonId}.`);
    }

    const relicDraftNodes = dungeon.nodes
      .filter((node) => node.type === 'reward' && node.relicDraftId !== undefined)
      .sort((left, right) => {
        if (dungeonId !== 'lost_shelter') return left.relicDraftId!.localeCompare(right.relicDraftId!);
        return left.id === 'evacuation_cache' ? -1 : right.id === 'evacuation_cache' ? 1 : 0;
      });
    if (relicDraftNodes.length !== 2) {
      throw new BalanceSimulationError(`${dungeonId} must expose exactly two relic draft nodes.`);
    }

    const evidence = createRouteCombatEvidence({
      prioritizeHealing: true,
      healingTargetRatio:
        dungeonId === 'temporal_observatory' || dungeonId === 'void_citadel' ? 0.9 : 0.7,
      chooseRunRelic: (_draftState, candidateIds) => {
        const chosenRelicId = RUN_RELIC_ROUTE_SELECTION_PRIORITY[frame].find(
          (relicId) => candidateIds.includes(relicId) && !coveredRelicIds.has(relicId)
        ) ?? candidateIds[0];
        if (!chosenRelicId) {
          throw new BalanceSimulationError(`Relic draft in ${dungeonId} exposed no selectable candidate.`);
        }
        coveredRelicIds.add(chosenRelicId);
        return chosenRelicId;
      }
    });
    const plannedNodeIds = [
      ...relicDraftNodes.map((node) => node.id),
      ...dungeon.nodes.filter((node) => node.type === 'trap').map((node) => node.id)
    ];
    const preparedState = prepareLawRouteState(state, dungeonId);
    const conduitPreparedState = candidateMode === 'matching-equipment-conduit'
      ? equipEquipment(preparedState, conduitEquipmentId)
      : preparedState;
    let runState = enterPreparedDungeon(conduitPreparedState, dungeonId, evidence, {
      plannedNodeIds,
      additionalTacticalItemIds:
        dungeonId === 'temporal_observatory'
          ? ['healing_pill', 'focus_incense']
        : dungeonId === 'void_citadel'
          ? ['thunder_talisman', 'healing_pill']
          : dungeonId === 'causal_clearinghouse'
            ? ['healing_pill', 'focus_incense']
          : [],
      inventoryTargets:
        dungeonId === 'temporal_observatory'
          ? { healing_pill: 48, focus_incense: 8 }
          : dungeonId === 'void_citadel'
            ? { thunder_talisman: 8, healing_pill: 48 }
            : dungeonId === 'causal_clearinghouse'
              ? { healing_pill: 48, focus_incense: 8 }
            : {}
    });
    const entryRelicState = runState.run?.relicState;
    const conduitSourceEquipmentIds: EquipmentId[] = [
      ...(runState.run?.relicConduitSourceEquipmentIds ?? [])
    ];

    if (!entryRelicState || entryRelicState.frame !== frame) {
      throw new BalanceSimulationError(`${dungeonId} did not freeze the configured ${frame} relic frame at entry.`);
    }
    if (
      (candidateMode === 'ordinary' && conduitSourceEquipmentIds.length !== 0) ||
      (candidateMode === 'matching-equipment-conduit' && !conduitSourceEquipmentIds.includes(conduitEquipmentId))
    ) {
      throw new BalanceSimulationError(`${dungeonId} did not freeze the expected ${candidateMode} relic candidate mode.`);
    }

    const lostShelterRelicChoices = {
      north_checkpoint: 'push',
      central_checkpoint: 'treat',
      south_checkpoint: 'push'
    } as const satisfies Readonly<Record<EscortCheckpointNodeId, EscortCheckpointChoice>>;
    if (dungeonId === 'lost_shelter') {
      for (const nodeId of [
        'alarm_grid_trap',
        'south_checkpoint',
        'alarm_grid_trap',
        'survivor_memory_stage',
        'survivor_cell',
        'central_checkpoint',
        'north_checkpoint',
        'central_checkpoint',
        'survivor_cell',
        'collapsed_hall_trap',
        'north_entry',
        'evacuation_cache'
      ]) {
        runState = moveAlongRoutePath(runState, nodeId, evidence, {
          escortCheckpointChoices: lostShelterRelicChoices
        });
      }
    }

    for (const relicDraftNode of relicDraftNodes) {
      if (dungeonId === 'false_testimony_court' && relicDraftNode.id === 'truth_archive') {
        const truthEvidence = createRouteCombatEvidence({
          prioritizeHealing: true,
          healingTargetRatio: 0.8,
          chooseRunRelic: evidence.chooseRunRelic
        });
        let truthRun = enterPreparedDungeon(
          conduitPreparedState,
          dungeonId,
          truthEvidence,
          {
            plannedNodeIds: ['truth_archive', ...dungeon.nodes.filter((node) => node.type === 'trap').map((node) => node.id)],
            inventoryTargets: { focus_incense: 16, dispel_talisman: 16, armor_patch: 16 }
          }
        );
        truthRun = moveAlongRoutePath(truthRun, 'truth_archive', truthEvidence);
        if (truthRun.run?.relicState?.pendingDraft) {
          throw getDangerResolutionError(truthRun, relicDraftNode.id, 'truth relic draft remained pending');
        }
        evidence.relicDraftTrace.push(...truthEvidence.relicDraftTrace);
        evidence.routeMovements.push(...truthEvidence.routeMovements);
        evidence.routeGateChecks.push(...truthEvidence.routeGateChecks);
        continue;
      }
      if (dungeonId === 'lost_shelter' && relicDraftNode.id === 'desperate_armory') {
        for (const nodeId of [
          'north_rescue_patrol',
          'shelter_enforcer_north',
          'mimic_survivor_alpha',
          'evacuation_horror_omega',
          'command_lock'
        ]) {
          if (!runState.run?.clearedNodeIds.includes(nodeId)) {
            runState = moveAlongRoutePath(runState, nodeId, evidence, {
              escortCheckpointChoices: lostShelterRelicChoices
            });
          }
        }
      }
      runState = moveAlongRoutePath(runState, relicDraftNode.id, evidence, {
        escortCheckpointChoices: dungeonId === 'lost_shelter' ? lostShelterRelicChoices : undefined
      });
      if (runState.run?.relicState?.pendingDraft) {
        throw getDangerResolutionError(runState, relicDraftNode.id, 'relic draft remained pending after deterministic selection');
      }
    }
    if (dungeonId === 'temporal_observatory') {
      for (const anchorNodeId of ['past_calibration_anchor', 'future_calibration_anchor'] as const) {
        if (!runState.run?.clearedNodeIds.includes(anchorNodeId)) {
          runState = moveAlongRoutePath(runState, anchorNodeId, evidence);
        }
      }
    }

    const expectedDraftIds = relicDraftNodes.map((node) => node.relicDraftId!);
    const processedDraftIds = dungeonId === 'false_testimony_court'
      ? evidence.relicDraftTrace.map((draft) => draft.relicDraftId)
      : runState.run?.relicState?.processedDraftIds ?? [];
    if (!expectedDraftIds.every((draftId) => processedDraftIds.includes(draftId))) {
      throw new BalanceSimulationError(`${dungeonId} did not process both configured relic drafts.`);
    }

    const bossNodeId = getBossDefinition(dungeonId).nodeId;
    const exitNode = dungeon.nodes.find((node) => node.type === 'exit');
    if (!exitNode) throw new BalanceSimulationError(`${dungeonId} has no exit node for the relic route.`);
    const exitReady = collectRouteRewards(runState, dungeonId, evidence);
    let settled = resolveExit(exitReady);
    const archivedRelicIdsBefore = [...(settled.archivedRelicIds ?? [])];
    const acquiredRelicIds = [...(settled.run?.relicState?.acquiredIds ?? [])];
    const preferredArchiveRelicId = acquiredRelicIds.find(
      (relicId) => !archivedRelicIdsBefore.includes(relicId)
    ) ?? acquiredRelicIds[0];
    settled = resolvePendingRunRelicArchive(settled, preferredArchiveRelicId);
    const archiveStatus = settled.run?.lastRelicSettlement?.status;
    const archivedRelicId = settled.run?.lastRelicSettlement?.archivedRelicId;
    const bossNodeCleared = settled.run?.clearedNodeIds.includes(bossNodeId) ?? false;
    const exitNodeCleared = settled.run?.clearedNodeIds.includes(exitNode.id) ?? false;

    if (
      settled.phase !== 'result' ||
      !bossNodeCleared ||
      !exitNodeCleared ||
      archiveStatus !== 'archived' ||
      !archivedRelicId
    ) {
      throw new BalanceSimulationError(`${dungeonId} relic route did not complete its boss, exit, and archive settlement.`);
    }

    const returned = returnToHub(settled);
    if (returned.phase !== 'hub' || returned.run !== undefined) {
      throw new BalanceSimulationError(`${dungeonId} relic route could not return to the hub after archiving.`);
    }

    summaries.push({
      tier: dungeon.tier,
      dungeonId,
      dungeonName: dungeon.name,
      frame,
      candidateMode,
      ...(entryRelicState.seedRelicId === undefined ? {} : { seedRelicIdAtEntry: entryRelicState.seedRelicId }),
      conduitSourceEquipmentIds,
      conduitSourceLevels: Object.fromEntries(
        conduitSourceEquipmentIds.map((equipmentId) => [equipmentId, runState.equipmentLevels[equipmentId] ?? 1])
      ),
      relicDraftNodeIds: relicDraftNodes.map((node) => node.id),
      relicDraftIds: expectedDraftIds,
      chosenRelicIds: evidence.relicDraftTrace.map((draft) => draft.chosenRelicId),
      bossNodeId,
      exitNodeId: exitNode.id,
      bossNodeCleared,
      exitNodeCleared,
      completed: settled.completedDungeonIds.includes(dungeonId),
      pendingDraftCleared: settled.run?.relicState?.pendingDraft === undefined,
      archivedRelicId,
      archivedRelicIdsBefore,
      archivedRelicIdsAfter: [...(settled.archivedRelicIds ?? [])],
      archiveStatus,
      returnedToHub: true,
      routeEvidence: getRouteLegalityEvidence(evidence)
    });
    state = returned;
  }

  const draftEvidence = summaries.flatMap((summary) => summary.routeEvidence.relicDraftTrace);
  const rewardEvidence = summaries.flatMap((summary) => summary.routeEvidence.relicRewardTrace);
  const sourceSummary = summaries[0];
  const seededSummary = summaries[1];
  const seededDraft = seededSummary?.routeEvidence.relicDraftTrace[0];
  if (
    !sourceSummary?.archivedRelicId ||
    sourceSummary.archiveStatus !== 'archived' ||
    !seededSummary ||
    !seededDraft ||
    seededSummary.seedRelicIdAtEntry !== sourceSummary.archivedRelicId ||
    seededDraft.candidateIds[0] !== sourceSummary.archivedRelicId
  ) {
    throw new BalanceSimulationError('Archived relic did not seed the first candidate of the next matching-frame run.');
  }

  const canonicalCoveredRelicIds = RUN_RELIC_IDS.filter((relicId) => coveredRelicIds.has(relicId));
  if (canonicalCoveredRelicIds.length !== RUN_RELIC_IDS.length) {
    const missingRelicIds = RUN_RELIC_IDS.filter((relicId) => !coveredRelicIds.has(relicId));
    throw new BalanceSimulationError(`Run relic route missed effect coverage for: ${missingRelicIds.join(', ')}.`);
  }

  return {
    baseState,
    finalState: state,
    summaries,
    draftEvidence,
    rewardEvidence,
    coveredFrames: [...new Set(DUNGEON_ORDER.map((dungeonId) => RUN_RELIC_ROUTE_FRAMES[dungeonId]))],
    coveredRelicIds: canonicalCoveredRelicIds,
    archiveSeedEvidence: {
      sourceDungeonId: sourceSummary.dungeonId,
      seededDungeonId: seededSummary.dungeonId,
      archivedRelicId: sourceSummary.archivedRelicId,
      archiveStatus: 'archived',
      returnedToHub: sourceSummary.returnedToHub,
      seededDraftId: seededDraft.relicDraftId,
      firstCandidateId: seededDraft.candidateIds[0],
      seedWasFirstCandidate: true
    }
  };
}

export function simulateEquipmentTempering(): TemperingSimulationSummary {
  const equipmentId = 'guardian_plate' as const;
  const attunementId = 'forge_overdrive' as const;
  const initial = createInitialState();
  const prepared: GameState = {
    ...initial,
    rewardPoints: 2_000,
    lingyun: 4,
    inventory: {
      ...initial.inventory,
      star_iron: 6,
      cycle_imprint: 4
    },
    ownedEquipment: [...initial.ownedEquipment, equipmentId],
    equipmentLevels: {
      ...initial.equipmentLevels,
      [equipmentId]: EQUIPMENT[equipmentId].maxLevel
    },
    equipped: {
      ...initial.equipped,
      armor: equipmentId
    }
  };
  const initialRank = getEquipmentTemperStatus(prepared, equipmentId).currentRank;
  const initialScore = getEquipmentSystemStatus(prepared).totalScore;
  const initialPower = getPlayerPower(prepared);

  const rankOne = temperEquipment(prepared, equipmentId);
  const rankOneRank = getEquipmentTemperStatus(rankOne, equipmentId).currentRank;
  const rankOneScore = getEquipmentSystemStatus(rankOne).totalScore;
  const rankOnePower = getPlayerPower(rankOne);

  const attuned = attuneEquipment(rankOne, equipmentId, attunementId);
  const attunedRank = getEquipmentTemperStatus(attuned, equipmentId).currentRank;
  const attunedScore = getEquipmentSystemStatus(attuned).totalScore;
  const attunedPower = getPlayerPower(attuned);

  const rankTwo = temperEquipment(attuned, equipmentId);
  const finalRank = getEquipmentTemperStatus(rankTwo, equipmentId).currentRank;
  const finalScore = getEquipmentSystemStatus(rankTwo).totalScore;
  const finalPower = getPlayerPower(rankTwo);
  const resourceDeltas = {
    rewardPoints: rankTwo.rewardPoints - prepared.rewardPoints,
    lingyun: rankTwo.lingyun - prepared.lingyun,
    items: {
      star_iron: rankTwo.inventory.star_iron - prepared.inventory.star_iron,
      cycle_imprint: rankTwo.inventory.cycle_imprint - prepared.inventory.cycle_imprint
    }
  };
  const expectedRewardPointDelta = -(300 + EQUIPMENT_ATTUNEMENT_COST.rewardPoints + 500);
  const expectedLingyunDelta = -((EQUIPMENT_ATTUNEMENT_COST.lingyun ?? 0) + 1);

  return {
    equipmentId,
    ranks: {
      initial: initialRank,
      afterRankOne: rankOneRank,
      afterAttunement: attunedRank,
      final: finalRank
    },
    resourceDeltas,
    scoreDeltas: {
      rankOne: rankOneScore - initialScore,
      attunement: attunedScore - rankOneScore,
      rankTwo: finalScore - attunedScore,
      total: finalScore - initialScore
    },
    powerDeltas: {
      rankOne: rankOnePower - initialPower,
      attunement: attunedPower - rankOnePower,
      rankTwo: finalPower - attunedPower,
      total: finalPower - initialPower
    },
    attunement: rankTwo.equipmentAttunements?.[equipmentId],
    completed:
      initialRank === 0 &&
      rankOneRank === 1 &&
      attunedRank === 1 &&
      finalRank === 2 &&
      rankTwo.equipmentAttunements?.[equipmentId] === attunementId &&
      resourceDeltas.rewardPoints === expectedRewardPointDelta &&
      resourceDeltas.lingyun === expectedLingyunDelta &&
      resourceDeltas.items.star_iron === -3 &&
      resourceDeltas.items.cycle_imprint === -1
  };
}

const EQUIPMENT_COMMISSION_ROUTE_EQUIPMENT_IDS = [
  'cloudstep_boots',
  'cloudstep_charm'
] as const satisfies readonly [EquipmentId, EquipmentId];

const EQUIPMENT_COMMISSION_ROUTE_DUNGEON_IDS = [
  'demon_tower_1',
  'metro_abyss',
  'starfall_mine'
] as const satisfies readonly [DungeonId, DungeonId, DungeonId];

function getEquipmentCommissionProgressEvidence(
  state: GameState,
  completedDungeonIdsFallback: readonly DungeonId[] = []
): EquipmentCommissionProgressEvidence {
  const active = getEquipmentCommissionStatus(state).active;
  const completedDungeonIds = active?.completedDungeonIds ?? completedDungeonIdsFallback;
  return {
    active: active !== undefined,
    completedDungeonIds: [...completedDungeonIds],
    completedDungeonCount: completedDungeonIds.length
  };
}

function getEquipmentCommissionGearEvidence(
  state: GameState,
  equipmentIds: readonly [EquipmentId, EquipmentId]
): EquipmentCommissionGearEvidence[] {
  return equipmentIds.map((equipmentId) => ({
    equipmentId,
    level: state.equipmentLevels[equipmentId] ?? 1,
    attunement: state.equipmentAttunements?.[equipmentId],
    temperRank: state.equipmentTemperRanks?.[equipmentId] ?? 0,
    sealed: isEquipmentCommissionSealed(state, equipmentId)
  }));
}

function createEquipmentCommissionRouteFixture(): GameState {
  const initial = createInitialState();
  return {
    ...initial,
    rewardPoints: 50_000,
    lingyun: 50,
    inventory: {
      ...initial.inventory,
      demon_bone: 24,
      hidden_stone: 24,
      medicine_ash: 24,
      mirror_shell: 12,
      star_iron: 24,
      method_page: 24,
      cracked_core: 24,
      rift_dust: 24,
      cycle_imprint: 24
    },
    ownedEquipment: [...initial.ownedEquipment, ...EQUIPMENT_COMMISSION_ROUTE_EQUIPMENT_IDS],
    equipmentLevels: {
      ...initial.equipmentLevels,
      cloudstep_boots: EQUIPMENT.cloudstep_boots.maxLevel,
      cloudstep_charm: EQUIPMENT.cloudstep_charm.maxLevel
    },
    equipmentAttunements: {
      ...(initial.equipmentAttunements ?? {}),
      cloudstep_boots: 'mist_vanguard',
      cloudstep_charm: 'mist_veilguard'
    },
    equipmentTemperRanks: {
      ...(initial.equipmentTemperRanks ?? {}),
      cloudstep_boots: 2,
      cloudstep_charm: 1
    }
  };
}

type EquipmentCommissionExitExecution = Readonly<{
  state: GameState;
  summary: EquipmentCommissionExitEvidence;
}>;

function runEquipmentCommissionExit(
  state: GameState,
  dungeonId: DungeonId,
  kind: EquipmentCommissionExitEvidence['kind']
): EquipmentCommissionExitExecution {
  const invested = investForDungeon(state, dungeonId).state;
  const progressBefore = getEquipmentCommissionProgressEvidence(invested);
  const route = createRouteCombatEvidence();
  const settled = clearDungeonViaExit(invested, dungeonId, route);
  const bossNodeId = getBossDefinition(dungeonId).nodeId;
  const exitNodeId = DUNGEONS[dungeonId].nodes.find((node) => node.type === 'exit')?.id;
  if (!exitNodeId) throw new BalanceSimulationError(`${dungeonId}: equipment commission route has no exit node.`);

  const settlement = settled.run?.lastEquipmentCommissionSettlement;
  const progressAfter = getEquipmentCommissionProgressEvidence(
    settled,
    settlement?.completedDungeonIds
  );
  return {
    state: settled,
    summary: {
      kind,
      dungeonId,
      bossNodeId,
      exitNodeId,
      phaseAfter: settled.phase,
      successful:
        settled.phase === 'result' &&
        settled.completedDungeonIds.includes(dungeonId) &&
        settled.run?.clearedNodeIds.includes(exitNodeId) === true,
      bossNodeCleared: settled.run?.clearedNodeIds.includes(bossNodeId) ?? false,
      exitNodeCleared: settled.run?.clearedNodeIds.includes(exitNodeId) ?? false,
      progressBefore,
      progressAfter,
      settlement: settlement === undefined ? undefined : structuredClone(settlement),
      routeEvidence: getRouteLegalityEvidence(route)
    }
  };
}

function runEquipmentCommissionInterruption(
  state: GameState,
  dungeonId: DungeonId,
  kind: EquipmentCommissionInterruptionEvidence['kind']
): EquipmentCommissionInterruptionEvidence {
  const invested = investForDungeon(structuredClone(state), dungeonId).state;
  const progressBefore = getEquipmentCommissionProgressEvidence(invested);
  const route = createRouteCombatEvidence();
  const bossNodeId = getBossDefinition(dungeonId).nodeId;
  const dangerNode = DUNGEONS[dungeonId].nodes.find(
    (node) => node.type === 'monster' && node.id !== bossNodeId
  );
  if (!dangerNode) {
    throw new BalanceSimulationError(`${dungeonId}: equipment commission interruption has no non-boss combat node.`);
  }

  const entered = enterPreparedDungeon(invested, dungeonId, route, {
    plannedNodeIds: [dangerNode.id],
    inventoryTargets: { healing_pill: 8 }
  });
  const progressed = moveAlongRoutePath(entered, dangerNode.id, route);
  const dangerNodeCleared = progressed.run?.clearedNodeIds.includes(dangerNode.id) ?? false;
  const settled = kind === 'retreat'
    ? resolveRetreat(progressed)
    : resolveRunFailure(progressed, '装备封存委托失败分支验证。');
  const settlement = settled.run?.lastEquipmentCommissionSettlement;

  return {
    kind,
    dungeonId,
    dangerNodeId: dangerNode.id,
    dangerNodeCleared,
    phaseAfter: settled.phase,
    progressBefore,
    progressAfter: getEquipmentCommissionProgressEvidence(settled),
    settlement: settlement === undefined ? undefined : structuredClone(settlement),
    routeEvidence: getRouteLegalityEvidence(route)
  };
}

function hasPreservedEquipmentCommissionProgression(
  before: readonly EquipmentCommissionGearEvidence[],
  after: readonly EquipmentCommissionGearEvidence[]
): boolean {
  return before.every((beforeEquipment) => {
    const afterEquipment = after.find(
      (candidate) => candidate.equipmentId === beforeEquipment.equipmentId
    );
    return (
      afterEquipment?.level === beforeEquipment.level &&
      afterEquipment.attunement === beforeEquipment.attunement &&
      afterEquipment.temperRank === beforeEquipment.temperRank
    );
  });
}

export function simulateEquipmentCommissionRoute(): EquipmentCommissionRouteResult {
  const equipmentIds = EQUIPMENT_COMMISSION_ROUTE_EQUIPMENT_IDS;
  const targetMaterialId = 'mirror_shell' as const;
  const fixture = createEquipmentCommissionRouteFixture();
  const statusBefore = getEquipmentCommissionStatus(fixture);
  const equipmentBefore = getEquipmentCommissionGearEvidence(fixture, equipmentIds);
  const started = startEquipmentCommission(fixture, equipmentIds, targetMaterialId);
  const statusAfterStart = getEquipmentCommissionStatus(started);
  const equipmentAfterStart = getEquipmentCommissionGearEvidence(started, equipmentIds);
  const paidCost = {
    rewardPoints: fixture.rewardPoints - started.rewardPoints,
    lingyun: fixture.lingyun - started.lingyun
  };

  if (
    statusAfterStart.active === undefined ||
    statusBefore.requiredDungeonCount !== EQUIPMENT_COMMISSION_REQUIRED_DUNGEONS ||
    statusBefore.materialReward !== EQUIPMENT_COMMISSION_MATERIAL_REWARD ||
    paidCost.rewardPoints !== EQUIPMENT_COMMISSION_COST.rewardPoints ||
    paidCost.lingyun !== EQUIPMENT_COMMISSION_COST.lingyun
  ) {
    throw new BalanceSimulationError('Equipment commission did not start atomically through the public API.');
  }

  const [firstDungeonId, secondDungeonId, thirdDungeonId] = EQUIPMENT_COMMISSION_ROUTE_DUNGEON_IDS;
  const first = runEquipmentCommissionExit(started, firstDungeonId, 'distinct');
  const hubAfterFirst = returnToHub(claimMainlineAfterClear(first.state, firstDungeonId));
  const repeated = runEquipmentCommissionExit(hubAfterFirst, firstDungeonId, 'repeat');
  const hubAfterRepeat = returnToHub(repeated.state);
  const retreat = runEquipmentCommissionInterruption(hubAfterRepeat, secondDungeonId, 'retreat');
  const failure = runEquipmentCommissionInterruption(hubAfterRepeat, secondDungeonId, 'failure');
  const second = runEquipmentCommissionExit(hubAfterRepeat, secondDungeonId, 'distinct');
  const hubAfterSecond = returnToHub(claimMainlineAfterClear(second.state, secondDungeonId));
  const materialCountBeforeFinalRoute = hubAfterSecond.inventory[targetMaterialId];
  const third = runEquipmentCommissionExit(hubAfterSecond, thirdDungeonId, 'distinct');
  const finalState = third.state;
  const equipmentAfter = getEquipmentCommissionGearEvidence(finalState, equipmentIds);
  const materialCountAfterFinalRoute = finalState.inventory[targetMaterialId];
  const materialDelta = materialCountAfterFinalRoute - materialCountBeforeFinalRoute;
  const progressionPreserved = hasPreservedEquipmentCommissionProgression(
    equipmentBefore,
    equipmentAfter
  );

  const distinctExits = [first.summary, second.summary, third.summary] as const;
  const progressUnchanged = (
    before: EquipmentCommissionProgressEvidence,
    after: EquipmentCommissionProgressEvidence
  ): boolean =>
    before.active === after.active &&
    before.completedDungeonIds.join(',') === after.completedDungeonIds.join(',');
  if (
    distinctExits.some((exit) => !exit.successful || !exit.bossNodeCleared || !exit.exitNodeCleared) ||
    repeated.summary.successful !== true ||
    !progressUnchanged(repeated.summary.progressBefore, repeated.summary.progressAfter) ||
    !progressUnchanged(retreat.progressBefore, retreat.progressAfter) ||
    !progressUnchanged(failure.progressBefore, failure.progressAfter) ||
    third.summary.settlement?.status !== 'completed' ||
    third.summary.settlement.rewardAmount !== EQUIPMENT_COMMISSION_MATERIAL_REWARD ||
    materialDelta !== EQUIPMENT_COMMISSION_MATERIAL_REWARD ||
    third.summary.progressAfter.active ||
    equipmentAfter.some((equipment) => equipment.sealed) ||
    !progressionPreserved
  ) {
    throw new BalanceSimulationError('Equipment commission real-route proof did not satisfy its completion guards.');
  }

  return {
    equipmentIds,
    targetMaterialId,
    requiredDungeonCount: statusBefore.requiredDungeonCount,
    materialReward: statusBefore.materialReward,
    start: {
      quotedCost: {
        rewardPoints: statusBefore.cost.rewardPoints ?? 0,
        lingyun: statusBefore.cost.lingyun ?? 0
      },
      paidCost,
      candidateEquipmentIdsBefore: statusBefore.candidates.map((candidate) => candidate.equipmentId),
      progressAfter: getEquipmentCommissionProgressEvidence(started),
      equipmentBefore,
      equipmentAfter: equipmentAfterStart
    },
    distinctExits,
    repeatedExit: repeated.summary,
    retreat,
    failure,
    completion: {
      materialCountBeforeFinalRoute,
      materialCountAfterFinalRoute,
      materialDelta,
      progressAfter: third.summary.progressAfter,
      equipmentAfter,
      progressionPreserved
    },
    finalState
  };
}

function createSoulSimulationBaseState(): GameState {
  const initial = createInitialState();
  const ownedEquipment = [...new Set([
    ...initial.ownedEquipment,
    ...SOUL_SOURCE_EQUIPMENT_IDS,
    'starforged_edge' as const
  ])];
  const prepared: GameState = {
    ...initial,
    rewardPoints: 100_000,
    lingyun: 100,
    inventory: {
      ...initial.inventory,
      healing_pill: 99,
      thunder_talisman: 99,
      dispel_talisman: 99,
      gate_sigil: 99,
      echo_coin: 12,
      armor_patch: 24,
      focus_incense: 24,
      hidden_stone: 64,
      medicine_ash: 64,
      mirror_shell: 64,
      star_iron: 64,
      cracked_core: 64,
      rift_dust: 64,
      cycle_imprint: 12
    },
    ownedEquipment,
    equipmentLevels: {
      ...initial.equipmentLevels,
      starforged_edge: 3,
      mist_hood: 3,
      spirit_robe: 3,
      guardian_gauntlets: 3,
      cloudstep_boots: 3,
      rift_belt: 3,
      rift_charm: 3
    },
    equipmentTemperRanks: {
      mist_hood: 1,
      spirit_robe: 1,
      guardian_gauntlets: 1,
      cloudstep_boots: 1,
      rift_belt: 1,
      rift_charm: 1
    },
    completedDungeonIds: [...DUNGEON_ORDER],
    claimedTaskIds: DUNGEON_ORDER.map((dungeonId) => `mainline_clear_${dungeonId}`)
  };

  let equipped = (['starforged_edge', ...SOUL_SOURCE_EQUIPMENT_IDS] as const).reduce(
    (state, equipmentId) => equipEquipment(state, equipmentId),
    prepared
  );
  const defensiveAttunements = {
    mist_hood: 'mist_veilguard',
    spirit_robe: 'mist_veilguard',
    guardian_gauntlets: 'forge_overdrive',
    cloudstep_boots: 'mist_veilguard',
    rift_belt: 'rift_anchor',
    rift_charm: 'rift_anchor'
  } as const satisfies Readonly<Record<EquipmentSoulSkillSourceEquipmentId, EquipmentAttunementId>>;
  for (const equipmentId of SOUL_SOURCE_EQUIPMENT_IDS) {
    equipped = attuneEquipment(equipped, equipmentId, defensiveAttunements[equipmentId]);
    if (equipped.equipmentAttunements?.[equipmentId] !== defensiveAttunements[equipmentId]) {
      throw new BalanceSimulationError(`Soul route could not defensively attune ${equipmentId}.`);
    }
    while ((equipped.equipmentTemperRanks?.[equipmentId] ?? 0) < 2) {
      const beforeRank = equipped.equipmentTemperRanks?.[equipmentId] ?? 0;
      equipped = temperEquipment(equipped, equipmentId);
      if ((equipped.equipmentTemperRanks?.[equipmentId] ?? 0) === beforeRank) {
        throw new BalanceSimulationError(`Soul route could not temper ${equipmentId} to rank II.`);
      }
    }
  }
  return prepareGenesisRepeatHubState(equipped);
}

function requireSoulState(state: GameState, checkpoint: string): EquipmentSoulSkillRunState {
  const soulSkillState = state.run?.soulSkillState;
  if (!soulSkillState) {
    throw new BalanceSimulationError(`Soul route lost its equipment snapshot at ${checkpoint}.`);
  }
  return soulSkillState;
}

function getSoulSkillDefinition(skillId: EquipmentSoulSkillId) {
  const definition = EQUIPMENT_SOUL_SKILL_CATALOG.find((candidate) => candidate.id === skillId);
  if (!definition) throw new BalanceSimulationError(`Unknown soul skill ${skillId}.`);
  return definition;
}

function getCleansableEffectKeys(state: GameState): string[] {
  const effects = state.combat?.effects;
  if (!effects) return [];

  return [
    (effects.rustPoisonStacks ?? 0) > 0 ? 'rustPoisonStacks' : undefined,
    (effects.mirrorSlowStacks ?? 0) > 0 ? 'mirrorSlowStacks' : undefined,
    effects.lastPlayerAction !== undefined ? 'lastPlayerAction' : undefined
  ].filter((key): key is string => key !== undefined);
}

function getSoulResourceSnapshot(state: GameState) {
  return {
    rewardPoints: state.rewardPoints,
    lingyun: state.lingyun,
    hp: state.player.hp,
    inventory: structuredClone(state.inventory),
    lootBag: structuredClone(state.run?.lootBag)
  };
}

function createSoulSkillUseEvidence(
  before: GameState,
  after: GameState,
  skillId: EquipmentSoulSkillId,
  scenarioId: string,
  details: Partial<SoulSkillUseEvidence> = {}
): SoulSkillUseEvidence {
  const beforeSoul = requireSoulState(before, `${scenarioId}:before`);
  const afterSoul = requireSoulState(after, `${scenarioId}:after`);
  const nodeId = before.run?.currentNodeId;
  const dungeonId = before.run?.dungeonId;
  if (!nodeId || !dungeonId || !after.run) {
    throw new BalanceSimulationError(`Soul skill ${skillId} requires an active run at ${scenarioId}.`);
  }

  const definition = getSoulSkillDefinition(skillId);
  const chargesBefore = beforeSoul.chargesRemaining;
  const chargesAfter = afterSoul.chargesRemaining;
  const readyBefore = beforeSoul.readySkillIds.includes(skillId);
  const readyAfter = afterSoul.readySkillIds.includes(skillId);
  const turnBefore = before.combat?.turn;
  const turnAfter = after.combat?.turn;
  const focusBefore = getWeaponSkillStatus(before).currentFocus;
  const focusAfter = getWeaponSkillStatus(after).currentFocus;

  return {
    scenarioId,
    dungeonId,
    nodeId,
    skillId,
    effect: definition.effect,
    succeeded: readyBefore && !readyAfter && chargesAfter === chargesBefore - 1,
    chargesBefore,
    chargesAfter,
    chargeDelta: chargesAfter - chargesBefore,
    readyBefore,
    readyAfter,
    spentAfter: beforeSoul.frozenSkillIds.includes(skillId) && !readyAfter,
    hpBefore: before.player.hp,
    hpAfter: after.player.hp,
    hpDelta: after.player.hp - before.player.hp,
    focusBefore,
    focusAfter,
    focusDelta: focusAfter - focusBefore,
    ...(turnBefore === undefined ? {} : { turnBefore }),
    ...(turnAfter === undefined ? {} : { turnAfter }),
    ...(turnBefore === undefined || turnAfter === undefined ? {} : { turnDelta: turnAfter - turnBefore }),
    currentNodeIdBefore: nodeId,
    currentNodeIdAfter: after.run.currentNodeId,
    nodeClearedBefore: before.run?.clearedNodeIds.includes(nodeId) ?? false,
    nodeClearedAfter:
      after.run.dungeonId === dungeonId && after.run.clearedNodeIds.includes(nodeId),
    ...details
  };
}

function recordSoulRouteMovement(
  before: GameState,
  targetNodeId: string,
  evidence: RouteCombatEvidence
): GameState {
  const navigable = resolvePendingMirrorCityPhaseForTarget(
    resolvePendingEntropyHeadingForTarget(before, targetNodeId, evidence),
    targetNodeId,
    evidence
  );
  if (!navigable.run) throw new BalanceSimulationError(`Cannot move to ${targetNodeId} without an active soul run.`);
  const fromNodeId = navigable.run.currentNodeId;
  const gateStatus = getCurrentRouteGateStatus(navigable, targetNodeId);
  const blockReason = getCurrentRouteBlockReason(navigable, targetNodeId);
  evidence.routeMovements.push({
    fromNodeId,
    toNodeId: targetNodeId,
    legal: blockReason === undefined,
    routeGateId: gateStatus?.gate.id,
    blockReason
  });
  if (gateStatus) recordRouteGateEvidence(evidence, gateStatus, blockReason === undefined);
  if (blockReason) {
    throw getDangerResolutionError(navigable, targetNodeId, `soul route selected a closed route gate: ${blockReason}`);
  }

  const moved = moveToNode(navigable, targetNodeId);
  if (moved.run?.currentNodeId !== targetNodeId) {
    throw getDangerResolutionError(moved, targetNodeId, `soul route movement from ${fromNodeId} was blocked`);
  }
  evidence.visitedNodeIds?.push(targetNodeId);
  return moved;
}

function moveSoulRouteToUnresolvedNode(
  state: GameState,
  targetNodeId: string,
  evidence: RouteCombatEvidence
): GameState {
  let nextState = state.run?.dungeonId === 'genesis_vault'
    ? prepareGenesisVaultSpliceApproach(state, evidence)
    : state;
  if (nextState.run?.dungeonId === 'genesis_vault' && targetNodeId === 'soul_recharge_genesis') {
    for (const nodeId of ['mutation_guardian_omega', 'lineage_event_stage', 'genome_repair_station']) {
      nextState = moveAlongRoutePath(nextState, nodeId, evidence, { skipGenesisPreparation: true });
    }
    return moveAlongRoutePath(nextState, targetNodeId, evidence, {
      resolveTargetDanger: false,
      collectTargetReward: false,
      skipGenesisPreparation: true
    });
  }
  const maximumMovements = state.run ? DUNGEONS[state.run.dungeonId].nodes.length * 4 : 0;

  for (let movementCount = 0; nextState.run?.currentNodeId !== targetNodeId; movementCount += 1) {
    if (movementCount >= maximumMovements) {
      throw getDangerResolutionError(nextState, targetNodeId, `soul route exceeded ${maximumMovements} movements`);
    }
    if (
      nextState.run?.dungeonId === 'silent_broadcast_tower' ||
      nextState.run?.dungeonId === 'lost_shelter'
    ) {
      routeEvidenceForSoulSupport(nextState, evidence);
    }
    nextState = resolvePendingRedactionClause(
      collectCurrentRouteReward(resolveCurrentDanger(nextState, evidence), evidence)
    );
    nextState = resolvePendingAuctionLot(nextState, evidence);
    nextState = resolvePendingGenesisSplice(nextState, evidence);
    nextState = resolvePendingBroadcastRelay(nextState, evidence, STANDARD_BROADCAST_RELAY_CHOICES);
    nextState = resolvePendingEscortCheckpoint(nextState, evidence, STANDARD_ESCORT_CHECKPOINT_CHOICES);
    nextState = resolvePendingPanopticonRoute(nextState, 'shadow');
    if (!nextState.run || nextState.run.currentNodeId === targetNodeId) break;
    nextState = resolvePendingEntropyHeadingForTarget(nextState, targetNodeId, evidence);
    nextState = resolvePendingMirrorCityPhaseForTarget(nextState, targetNodeId, evidence);

    const nextNodeId = findAdjacentRoutePath(nextState, targetNodeId, evidence)[0];
    if (!nextNodeId) {
      throw getDangerResolutionError(nextState, targetNodeId, 'soul route pathfinder returned no next step');
    }
    nextState = recordSoulRouteMovement(nextState, nextNodeId, evidence);
  }

  if (nextState.run?.currentNodeId !== targetNodeId) {
    throw getDangerResolutionError(nextState, targetNodeId, 'soul route did not reach its unresolved target');
  }
  return nextState;
}

function routeEvidenceForSoulSupport(state: GameState, evidence: RouteCombatEvidence): void {
  if (!state.run) return;
  const node = DUNGEONS[state.run.dungeonId].nodes.find((candidate) => candidate.id === state.run?.currentNodeId);
  if (node?.type !== 'monster') return;
  evidence.methodTechniqueNodeId = node.id;
  evidence.companionAssistNodeId = node.id;
  evidence.bloodlineSurgeNodeId = node.id;
}

function finishActiveSoulCombat(state: GameState, evidence: RouteCombatEvidence): GameState {
  if (state.phase !== 'combat' || !state.combat) return state;
  const nodeId = state.combat.nodeId;
  let nextState = state;

  for (let actionCount = 0; actionCount < MAX_COMBAT_ACTIONS; actionCount += 1) {
    nextState = useAvailableCombatSupports(nextState, nodeId, evidence);
    let action = chooseCombatAction(nextState, true);
    if (action === 'weapon_skill' && !getWeaponSkillStatus(nextState).available) action = 'attack';
    let actionResult = performTrackedCombatAction(nextState, nodeId, action, evidence);
    nextState = actionResult.state;
    if (!actionResult.progressed && nextState.phase === 'combat') {
      action = action === 'attack' ? 'guard' : 'attack';
      actionResult = performTrackedCombatAction(nextState, nodeId, action, evidence);
      nextState = actionResult.state;
    }

    if (nextState.run?.clearedNodeIds.includes(nodeId)) {
      return resolvePendingEquipmentOffer(nextState, nodeId);
    }
    if (nextState.phase !== 'combat' || !nextState.combat || nextState.player.hp <= 0) {
      throw getDangerResolutionError(nextState, nodeId, 'soul route combat ended before victory');
    }
  }

  throw getDangerResolutionError(nextState, nodeId, 'soul route combat exceeded its action bound');
}

function spendCloudstepBeforeRecharge(
  state: GameState,
  evidence: RouteCombatEvidence,
  excludedNodeId: string,
  scenarioId: string
): { state: GameState; use: SoulSkillUseEvidence } {
  const dungeon = state.run ? DUNGEONS[state.run.dungeonId] : undefined;
  if (!dungeon) throw new BalanceSimulationError(`Cannot prepare ${scenarioId} without an active dungeon.`);

  let nextState = state;
  for (const trapNode of dungeon.nodes.filter((node) => node.type === 'trap' && node.id !== excludedNodeId)) {
    const previewPath = findAdjacentRoutePath(nextState, trapNode.id, evidence);
    if (previewPath.includes(excludedNodeId)) continue;

    nextState = moveSoulRouteToUnresolvedNode(nextState, trapNode.id, evidence);
    const status = getEquipmentSoulSkillActionStatus(nextState, 'cloudstep_retrace');
    const targetNodeId = status.targetNodeIds[0];
    if (status.available && targetNodeId) {
      const before = nextState;
      const used = useEquipmentSoulSkill(before, 'cloudstep_retrace', { targetNodeId });
      const use = createSoulSkillUseEvidence(before, used, 'cloudstep_retrace', scenarioId, {
        targetNodeId
      });
      if (!use.succeeded || used.run?.clearedNodeIds.includes(trapNode.id)) {
        throw getDangerResolutionError(used, trapNode.id, 'cloudstep pre-spend did not leave the trap uncleared');
      }
      return { state: used, use };
    }

    nextState = collectCurrentRouteReward(resolveCurrentDanger(nextState, evidence), evidence);
    nextState = resolvePendingAuctionLot(nextState, evidence, STANDARD_AUCTION_LOT_CHOICES);
  }

  throw new BalanceSimulationError(`${dungeon.id} has no legal trap for a cloudstep recharge pre-spend.`);
}

function createSoulRechargeLockEvidence(
  pending: GameState,
  after: GameState,
  api: SoulRechargeLockEvidence['api']
): SoulRechargeLockEvidence {
  const currentNodeIdBefore = pending.run?.currentNodeId ?? 'missing';
  const currentNodeIdAfter = after.run?.currentNodeId ?? 'missing';
  const blockKind = getNodeDepartureBlock(pending)?.kind;
  const pendingSoul = requireSoulState(pending, `pending-lock:${api}`);
  const afterSoul = requireSoulState(after, `pending-lock:${api}:after`);

  return {
    api,
    blockKind,
    currentNodeIdBefore,
    currentNodeIdAfter,
    blocked:
      blockKind === 'soul_recharge_pending' &&
      currentNodeIdAfter === currentNodeIdBefore &&
      JSON.stringify(afterSoul) === JSON.stringify(pendingSoul),
    resourcesUnchanged:
      JSON.stringify(getSoulResourceSnapshot(after)) === JSON.stringify(getSoulResourceSnapshot(pending))
  };
}

function simulateSoulRechargeDungeon(
  baseState: GameState,
  dungeonId: DungeonId
): { summary: SevenDungeonSoulRouteSummary; skillUses: SoulSkillUseEvidence[] } {
  const config = SOUL_RECHARGE_ROUTE_CONFIG[dungeonId];
  const dungeon = DUNGEONS[dungeonId];
  const hostNode = dungeon.nodes.find((node) => node.id === config.hostNodeId);
  if (!hostNode || hostNode.soulRechargeId !== config.rechargeId) {
    throw new BalanceSimulationError(
      `${dungeonId} is missing recharge host ${config.hostNodeId}/${config.rechargeId}.`
    );
  }

  const routeEvidence = createRouteCombatEvidence({
    prioritizeHealing: true,
    visitedNodeIds: [],
    scriptedActions: dungeonId === 'silent_broadcast_tower'
      ? {
          broadcast_warden_omega: BROADCAST_WARDEN_SURVIVAL_SCRIPT
        }
      : dungeonId === 'lost_shelter'
        ? {
            evacuation_horror_omega: SOUL_LOST_SHELTER_SURVIVAL_SCRIPT,
            soul_recharge_shelter: SOUL_LOST_SHELTER_SURVIVAL_SCRIPT
          }
      : dungeonId === 'panopticon_city'
        ? { soul_recharge_panopticon: PANOPTICON_SURVIVAL_SCRIPT }
      : undefined
  });
  const plannedNodeIds = [
    hostNode.id,
    ...dungeon.nodes.filter((node) => node.type === 'trap').map((node) => node.id)
  ];
  const chapterBaseState = dungeonId === 'combat_replay_stage'
    ? restoreSimulationHealth({
        ...structuredClone(baseState),
        player: {
          ...baseState.player,
          base: {
            ...baseState.player.base,
            body: Math.max(baseState.player.base.body, 200),
            spirit: Math.max(baseState.player.base.spirit, 96)
          }
        }
      })
    : dungeonId === 'panopticon_city'
    ? preparePanopticonEndgameBuild(baseState, 260, undefined, false)
    : dungeonId === 'genesis_vault' || dungeonId === 'lost_shelter'
    ? restoreSimulationHealth({
        ...structuredClone(baseState),
        player: {
          ...baseState.player,
          base: {
            ...baseState.player.base,
            body: Math.max(baseState.player.base.body, dungeonId === 'lost_shelter' ? 80 : 36),
            spirit: Math.max(baseState.player.base.spirit, dungeonId === 'lost_shelter' ? 64 : 24)
          }
        }
      })
    : structuredClone(baseState);
  let state = enterPreparedDungeon(chapterBaseState, dungeonId, routeEvidence, {
    plannedNodeIds,
    methodTechnique:
      dungeonId === 'silent_broadcast_tower' || dungeonId === 'combat_replay_stage'
        || dungeonId === 'panopticon_city'
        ? 'live'
        : undefined,
    additionalTacticalItemIds:
      dungeonId === 'genesis_vault'
        ? ['healing_pill', 'armor_patch']
        : dungeonId === 'combat_replay_stage'
          ? ['healing_pill', 'dispel_talisman', 'armor_patch']
          : dungeonId === 'panopticon_city'
            ? ['healing_pill', 'focus_incense', 'armor_patch']
          : undefined,
    inventoryTargets: {
      healing_pill: 12,
      dispel_talisman: 12,
      gate_sigil: 12,
      armor_patch: 12,
      focus_incense: 12
    }
  });
  const entrySoul = structuredClone(requireSoulState(state, `${dungeonId}:entry`));
  if (
    entrySoul.frozenSkillIds.length !== SOUL_SOURCE_EQUIPMENT_IDS.length ||
    entrySoul.readySkillIds.length !== SOUL_SOURCE_EQUIPMENT_IDS.length ||
    entrySoul.chargesRemaining !== 2
  ) {
    throw new BalanceSimulationError(`${dungeonId} did not freeze all six ready soul skills with two charges.`);
  }

  const preSpend = spendCloudstepBeforeRecharge(
    state,
    routeEvidence,
    hostNode.id,
    `${dungeonId}:pre-recharge-cloudstep`
  );
  state = moveSoulRouteToUnresolvedNode(preSpend.state, hostNode.id, routeEvidence);
  const statusBeforeHostClear = getEquipmentSoulSkillRechargeStatus(state);
  if (statusBeforeHostClear.available || statusBeforeHostClear.rechargeId !== config.rechargeId) {
    throw getDangerResolutionError(state, hostNode.id, 'recharge station was available before its host cleared');
  }

  state = resolveCurrentDanger(state, routeEvidence);
  const hostCleared = state.run?.clearedNodeIds.includes(hostNode.id) ?? false;
  const statusAfterHostClear = getEquipmentSoulSkillRechargeStatus(state);
  if (!hostCleared || !statusAfterHostClear.available) {
    throw getDangerResolutionError(state, hostNode.id, 'recharge station did not unlock after host clear');
  }

  const settlementBeforeDuplicate = {
    resources: getSoulResourceSnapshot(state),
    clearedNodeIds: [...(state.run?.clearedNodeIds ?? [])]
  };
  const duplicateHostSelection = selectNode(state, hostNode.id);
  const duplicateNodeSettlementPrevented =
    JSON.stringify(getSoulResourceSnapshot(duplicateHostSelection)) ===
      JSON.stringify(settlementBeforeDuplicate.resources) &&
    JSON.stringify(duplicateHostSelection.run?.clearedNodeIds ?? []) ===
      JSON.stringify(settlementBeforeDuplicate.clearedNodeIds);
  state = duplicateHostSelection;

  const activated = activateCurrentEquipmentSoulSkillRecharge(state);
  const activatedStatus = getEquipmentSoulSkillRechargeStatus(activated);
  if (!activatedStatus.pending) {
    throw getDangerResolutionError(activated, hostNode.id, 'recharge activation did not create a pending choice');
  }

  const adjacentTargetId = getCurrentLegalAdjacentTargetIds(activated)[0];
  if (!adjacentTargetId) {
    throw getDangerResolutionError(activated, hostNode.id, 'recharge host has no adjacent lock target');
  }
  const moveLocked = moveToNode(activated, adjacentTargetId);
  const portalLocked = usePortal(activated, 'force');
  const exitLocked = resolveExit(activated);
  const locks = [
    createSoulRechargeLockEvidence(activated, moveLocked, 'move'),
    createSoulRechargeLockEvidence(activated, portalLocked, 'portal'),
    createSoulRechargeLockEvidence(activated, exitLocked, 'exit')
  ];
  const retreatWhilePending = resolveRetreat(activated);

  const soulBeforeCancel = structuredClone(requireSoulState(activated, `${dungeonId}:before-cancel`));
  const cancelled = cancelCurrentEquipmentSoulSkillRecharge(activated);
  const soulAfterCancel = requireSoulState(cancelled, `${dungeonId}:after-cancel`);
  const cancelledWithoutUse =
    soulAfterCancel.pendingRecharge === undefined &&
    soulAfterCancel.chargesRemaining === soulBeforeCancel.chargesRemaining &&
    JSON.stringify(soulAfterCancel.readySkillIds) === JSON.stringify(soulBeforeCancel.readySkillIds) &&
    JSON.stringify(soulAfterCancel.usedRechargeIds) === JSON.stringify(soulBeforeCancel.usedRechargeIds);
  const statusAfterCancel = getEquipmentSoulSkillRechargeStatus(cancelled);
  const reopened = activateCurrentEquipmentSoulSkillRecharge(cancelled);
  const reopenedStatus = getEquipmentSoulSkillRechargeStatus(reopened);
  const soulBeforeRestore = requireSoulState(reopened, `${dungeonId}:before-restore`);
  const restoredSkillId = 'cloudstep_retrace' as const;
  const restored = resolveCurrentEquipmentSoulSkillRecharge(reopened, restoredSkillId);
  const soulAfterRestore = requireSoulState(restored, `${dungeonId}:after-restore`);
  const statusAfterRestore = getEquipmentSoulSkillRechargeStatus(restored);
  const duplicateActivation = activateCurrentEquipmentSoulSkillRecharge(restored);
  const duplicateUsePrevented =
    statusAfterRestore.used &&
    JSON.stringify(requireSoulState(duplicateActivation, `${dungeonId}:duplicate-recharge`)) ===
      JSON.stringify(soulAfterRestore);

  const recharge: SoulRechargeEvidence = {
    dungeonId,
    hostNodeId: hostNode.id,
    rechargeId: config.rechargeId,
    availableBeforeHostClear: statusBeforeHostClear.available,
    availableAfterHostClear: statusAfterHostClear.available,
    spentSkillIdsBefore: [...statusAfterHostClear.spentSkillIds],
    pendingAfterActivate: activatedStatus.pending,
    locks,
    retreatAllowedWhilePending:
      retreatWhilePending.phase === 'result' && retreatWhilePending.lastOutcome?.includes('outcome=') === true,
    cancelledWithoutUse,
    availableAfterCancel: statusAfterCancel.available,
    reopenedAfterCancel: reopenedStatus.pending,
    restoredSkillId,
    chargesBeforeRestore: soulBeforeRestore.chargesRemaining,
    chargesAfterRestore: soulAfterRestore.chargesRemaining,
    chargeDelta: soulAfterRestore.chargesRemaining - soulBeforeRestore.chargesRemaining,
    restoredSkillReady: soulAfterRestore.readySkillIds.includes(restoredSkillId),
    rechargeMarkedUsed: soulAfterRestore.usedRechargeIds.includes(config.rechargeId),
    duplicateUsePrevented
  };

  const skillUses = [preSpend.use];
  let terminalState = restored;
  let terminalNodeId: string;
  let restoredSkillReused = false;
  if (dungeonId === 'demon_tower_1') {
    const reuseTrapNodeId = 'left_watch_trap';
    const atReuseTrap = moveSoulRouteToUnresolvedNode(restored, reuseTrapNodeId, routeEvidence);
    const reuseStatus = getEquipmentSoulSkillActionStatus(atReuseTrap, restoredSkillId);
    const targetNodeId = reuseStatus.targetNodeIds[0];
    if (!reuseStatus.available || !targetNodeId) {
      throw getDangerResolutionError(atReuseTrap, reuseTrapNodeId, 'restored cloudstep was not reusable');
    }
    const reused = useEquipmentSoulSkill(atReuseTrap, restoredSkillId, { targetNodeId });
    const reuseEvidence = createSoulSkillUseEvidence(
      atReuseTrap,
      reused,
      restoredSkillId,
      `${dungeonId}:post-recharge-cloudstep`,
      { targetNodeId }
    );
    skillUses.push(reuseEvidence);
    terminalState = reused;
    terminalNodeId = targetNodeId;
    restoredSkillReused = reuseEvidence.succeeded;
  } else {
    terminalNodeId = getCurrentLegalAdjacentTargetIds(restored)[0] ?? '';
    if (!terminalNodeId) {
      throw getDangerResolutionError(restored, hostNode.id, 'recharged route has no explicit continuation target');
    }
    terminalState = recordSoulRouteMovement(restored, terminalNodeId, routeEvidence);
  }

  const clearedNodeIds = [...(terminalState.run?.clearedNodeIds ?? [])];
  const terminalReached = terminalState.run?.currentNodeId === terminalNodeId;
  const permanentRouteLock =
    !terminalReached || routeEvidence.routeMovements.some((movement) => !movement.legal || Boolean(movement.blockReason));

  return {
    summary: {
      tier: dungeon.tier,
      dungeonId,
      dungeonName: dungeon.name,
      hostNodeId: hostNode.id,
      rechargeId: config.rechargeId,
      entryFrozenSkillIds: [...entrySoul.frozenSkillIds],
      entryReadySkillIds: [...entrySoul.readySkillIds],
      entryCharges: entrySoul.chargesRemaining,
      preRechargeSkillUse: preSpend.use,
      recharge,
      hostCleared,
      clearedNodeIds,
      uniqueClearedNodeCount: new Set(clearedNodeIds).size,
      duplicateNodeSettlementPrevented,
      terminalNodeId,
      terminalReached,
      permanentRouteLock,
      restoredSkillReused,
      routeEvidence: getRouteLegalityEvidence(routeEvidence)
    },
    skillUses
  };
}

const BASIC_SOUL_SLOT_REPLACEMENTS = [
  'patched_headwrap',
  'patched_coat',
  'patched_gloves',
  'patched_boots',
  'patched_belt',
  'plain_charm'
] as const satisfies readonly EquipmentId[];

function swapOutSoulEquipment(state: GameState): GameState {
  return BASIC_SOUL_SLOT_REPLACEMENTS.reduce(
    (nextState, equipmentId) => equipEquipment(nextState, equipmentId),
    state
  );
}

function enterSoulScenario(
  baseState: GameState,
  dungeonId: DungeonId,
  plannedNodeIds: readonly string[],
  portalUseNodeIds: readonly string[] = []
): { state: GameState; evidence: RouteCombatEvidence } {
  const evidence = createRouteCombatEvidence({ prioritizeHealing: true, visitedNodeIds: [] });
  const state = enterPreparedDungeon(structuredClone(baseState), dungeonId, evidence, {
    plannedNodeIds,
    portalUseNodeIds,
    inventoryTargets: {
      healing_pill: 12,
      thunder_talisman: 12,
      dispel_talisman: 12,
      gate_sigil: 12,
      armor_patch: 12,
      focus_incense: 12
    }
  });
  return { state, evidence };
}

function simulateSoulEquipmentSnapshot(baseState: GameState): SoulEquipmentSnapshotEvidence {
  const scenario = enterSoulScenario(baseState, 'demon_tower_1', []);
  const atEntry = structuredClone(requireSoulState(scenario.state, 'equipment-snapshot:entry'));
  const swapped = swapOutSoulEquipment(scenario.state);
  const afterSwap = requireSoulState(swapped, 'equipment-snapshot:after-swap');
  const equippedSkillCountAfterSwap = EQUIPMENT_SOUL_SKILL_CATALOG.filter(
    (definition) => swapped.equipped[definition.sourceSlot] === definition.equipmentId
  ).length;

  return {
    dungeonId: 'demon_tower_1',
    frozenSkillIdsAtEntry: [...atEntry.frozenSkillIds],
    readySkillIdsAtEntry: [...atEntry.readySkillIds],
    chargesAtEntry: atEntry.chargesRemaining,
    swappedOutEquipmentIds: [...SOUL_SOURCE_EQUIPMENT_IDS],
    equippedSkillCountAfterSwap,
    snapshotStableAfterSwap: JSON.stringify(afterSwap) === JSON.stringify(atEntry)
  };
}

function simulateMistFixedPoint(baseState: GameState): SoulSkillUseEvidence {
  const scenario = enterSoulScenario(baseState, 'demon_tower_1', ['blood_rune_trap']);
  let state = swapOutSoulEquipment(scenario.state);
  state = moveSoulRouteToUnresolvedNode(state, 'blood_rune_trap', scenario.evidence);
  const status = getEquipmentSoulSkillActionStatus(state, 'mist_fixed_point');
  if (!status.available) {
    throw getDangerResolutionError(state, 'blood_rune_trap', `mist fixed point unavailable: ${status.unavailableReason}`);
  }

  const beforeDamageTaken = state.run?.damageTaken ?? 0;
  const after = useEquipmentSoulSkill(state, 'mist_fixed_point');
  return createSoulSkillUseEvidence(state, after, 'mist_fixed_point', 'mist-natural-failure-pass', {
    naturalTrapFailure: true,
    passDamage: (after.run?.damageTaken ?? beforeDamageTaken) - beforeDamageTaken
  });
}

function simulateSpiritGroundingAtCombat(
  baseState: GameState,
  dungeonId: DungeonId,
  nodeId: string,
  requiredEffectKeys: readonly ('rustPoisonStacks' | 'mirrorSlowStacks' | 'lastPlayerAction')[],
  scenarioId: string
): SoulSkillUseEvidence {
  const scenario = enterSoulScenario(baseState, dungeonId, [nodeId]);
  const atNode = moveSoulRouteToUnresolvedNode(scenario.state, nodeId, scenario.evidence);
  const combat = selectNode(atNode, nodeId);
  if (combat.phase !== 'combat' || !combat.combat) {
    throw getDangerResolutionError(combat, nodeId, 'spirit grounding scenario did not enter combat');
  }

  const actionResult = performTrackedCombatAction(combat, nodeId, 'attack', scenario.evidence);
  const afterAction = actionResult.state;
  const keysBefore = getCleansableEffectKeys(afterAction);
  if (
    afterAction.phase !== 'combat' ||
    !afterAction.combat ||
    !requiredEffectKeys.every((effectKey) => keysBefore.includes(effectKey))
  ) {
    throw getDangerResolutionError(
      afterAction,
      nodeId,
      `combat did not produce ${requiredEffectKeys.join(', ')}`
    );
  }

  const after = useEquipmentSoulSkill(afterAction, 'spirit_grounding');
  return createSoulSkillUseEvidence(afterAction, after, 'spirit_grounding', scenarioId, {
    cleansableEffectKeysBefore: keysBefore,
    cleansableEffectKeysAfter: getCleansableEffectKeys(after)
  });
}

function simulateGauntletBreakbeat(baseState: GameState): SoulSkillUseEvidence {
  const nodeId = 'fog_lesser_demon';
  const scenario = enterSoulScenario(baseState, 'demon_tower_1', [nodeId]);
  const atNode = moveSoulRouteToUnresolvedNode(scenario.state, nodeId, scenario.evidence);
  const combat = selectNode(atNode, nodeId);
  const intentId = getCurrentCombatIntent(combat)?.id;
  if (intentId !== 'fog-armor-rend') {
    throw getDangerResolutionError(combat, nodeId, `expected fog-armor-rend, received ${intentId ?? 'none'}`);
  }

  const after = useEquipmentSoulSkill(combat, 'gauntlet_breakbeat');
  return createSoulSkillUseEvidence(combat, after, 'gauntlet_breakbeat', 'gauntlet-skip-danger-intent', {
    intentId
  });
}

function simulateCloudstepRetrace(baseState: GameState): SoulSkillUseEvidence {
  const scenario = enterSoulScenario(baseState, 'demon_tower_1', ['blood_rune_trap']);
  const clearedStart = resolveCurrentDanger(scenario.state, scenario.evidence);
  const atTrap = moveSoulRouteToUnresolvedNode(clearedStart, 'blood_rune_trap', scenario.evidence);
  const status = getEquipmentSoulSkillActionStatus(atTrap, 'cloudstep_retrace');
  const targetNodeId = status.targetNodeIds[0];
  if (!status.available || !targetNodeId) {
    throw getDangerResolutionError(atTrap, 'blood_rune_trap', `cloudstep unavailable: ${status.unavailableReason}`);
  }

  const after = useEquipmentSoulSkill(atTrap, 'cloudstep_retrace', { targetNodeId });
  return createSoulSkillUseEvidence(atTrap, after, 'cloudstep_retrace', 'cloudstep-back-to-cleared-node', {
    targetNodeId
  });
}

function isSoulStatePreservedAcrossPortal(
  before: EquipmentSoulSkillRunState,
  after: EquipmentSoulSkillRunState,
  consumedSkillId: EquipmentSoulSkillId
): boolean {
  return (
    JSON.stringify(after.frozenSkillIds) === JSON.stringify(before.frozenSkillIds) &&
    JSON.stringify(after.readySkillIds) ===
      JSON.stringify(before.readySkillIds.filter((skillId) => skillId !== consumedSkillId)) &&
    after.chargesRemaining === before.chargesRemaining - 1 &&
    JSON.stringify(after.usedRechargeIds) === JSON.stringify(before.usedRechargeIds) &&
    after.pendingRecharge === undefined
  );
}

function simulateRiftMisalignment(
  baseState: GameState,
  portalChoice: 'stabilize' | 'force'
): { use: SoulSkillUseEvidence; portal: SoulPortalOffsetEvidence } {
  const sourceNodeId = 'cracked_portal';
  const scenario = enterSoulScenario(baseState, 'demon_tower_1', [sourceNodeId], [sourceNodeId]);
  const atPortal = moveSoulRouteToUnresolvedNode(scenario.state, sourceNodeId, scenario.evidence);
  const sourceNode = DUNGEONS.demon_tower_1.nodes.find((node) => node.id === sourceNodeId);
  const status = getEquipmentSoulSkillActionStatus(atPortal, 'rift_misalignment');
  const offsetTargetNodeId = status.targetNodeIds[0];
  if (!sourceNode?.portal || !status.available || !offsetTargetNodeId) {
    throw getDangerResolutionError(atPortal, sourceNodeId, `rift misalignment unavailable: ${status.unavailableReason}`);
  }

  const soulBefore = structuredClone(requireSoulState(atPortal, `portal-${portalChoice}:before`));
  const stableItemId = sourceNode.portal.stableItem;
  const stableItemBefore = stableItemId ? atPortal.inventory[stableItemId] : 0;
  const after = useEquipmentSoulSkill(atPortal, 'rift_misalignment', {
    targetNodeId: offsetTargetNodeId,
    portalChoice
  });
  const soulAfter = requireSoulState(after, `portal-${portalChoice}:after`);
  const use = createSoulSkillUseEvidence(
    atPortal,
    after,
    'rift_misalignment',
    `rift-offset-${portalChoice}`,
    { targetNodeId: offsetTargetNodeId, portalChoice }
  );

  return {
    use,
    portal: {
      scenarioId: use.scenarioId,
      portalChoice,
      sourceDungeonId: 'demon_tower_1',
      sourceNodeId,
      targetDungeonId: sourceNode.portal.targetDungeonId,
      defaultTargetNodeId: sourceNode.portal.targetNodeId,
      offsetTargetNodeId,
      reachedOffsetTarget:
        after.run?.dungeonId === sourceNode.portal.targetDungeonId &&
        after.run.currentNodeId === offsetTargetNodeId,
      ...(stableItemId === undefined ? {} : { stableItemId }),
      stableItemDelta: stableItemId ? after.inventory[stableItemId] - stableItemBefore : 0,
      hpDelta: after.player.hp - atPortal.player.hp,
      soulStatePreservedAcrossPortal: isSoulStatePreservedAcrossPortal(
        soulBefore,
        soulAfter,
        'rift_misalignment'
      )
    }
  };
}

function getBankedItemCount(state: GameState, itemId: ItemId): number {
  return state.inventory[itemId] - (state.run?.lootBag.items[itemId] ?? 0);
}

function simulateRiftSeal(
  baseState: GameState
): { use: SoulSkillUseEvidence; reward: SoulRewardSealEvidence } {
  const dungeonId = 'demon_tower_1' as const;
  const nodeId = 'watch_post_cache';
  const itemId = 'medicine_ash' as const;
  const rewardNode = DUNGEONS[dungeonId].nodes.find((node) => node.id === nodeId);
  const rewardQuantity = rewardNode?.reward?.items?.[itemId] ?? 0;
  if (!rewardNode || rewardQuantity <= 0) {
    throw new BalanceSimulationError(`${nodeId} must provide ${itemId} for the seal route.`);
  }

  const sealedScenario = enterSoulScenario(baseState, dungeonId, [nodeId]);
  const beforeSeal = moveSoulRouteToUnresolvedNode(
    sealedScenario.state,
    nodeId,
    sealedScenario.evidence
  );
  const sealStatus = getEquipmentSoulSkillActionStatus(beforeSeal, 'rift_seal');
  if (!sealStatus.available || !sealStatus.itemIds.includes(itemId)) {
    throw getDangerResolutionError(beforeSeal, nodeId, `rift seal unavailable: ${sealStatus.unavailableReason}`);
  }
  const sealed = useEquipmentSoulSkill(beforeSeal, 'rift_seal', { itemId });
  const sealedDraft = sealed.run?.relicState?.pendingDraft;
  const use = createSoulSkillUseEvidence(beforeSeal, sealed, 'rift_seal', 'rift-seal-real-reward', {
    itemId,
    inventoryDelta: sealed.inventory[itemId] - beforeSeal.inventory[itemId],
    runLootDelta:
      (sealed.run?.lootBag.items[itemId] ?? 0) - (beforeSeal.run?.lootBag.items[itemId] ?? 0)
  });

  const normalScenario = enterSoulScenario(baseState, dungeonId, [nodeId]);
  const beforeNormal = moveSoulRouteToUnresolvedNode(
    normalScenario.state,
    nodeId,
    normalScenario.evidence
  );
  const normal = collectReward(beforeNormal);
  const normalDraft = normal.run?.relicState?.pendingDraft;
  const sealedResolved = resolvePendingRunRelicDraft(sealed, nodeId, sealedScenario.evidence);
  resolvePendingRunRelicDraft(normal, nodeId, normalScenario.evidence);
  const retreated = resolveRetreat(sealedResolved);
  const failed = resolveRunFailure(sealedResolved, '器魂封存失败分支验证。');
  const sealedDraftCandidateIds = [...(sealedDraft?.candidateIds ?? [])];
  const normalDraftCandidateIds = [...(normalDraft?.candidateIds ?? [])];

  return {
    use,
    reward: {
      dungeonId,
      nodeId,
      itemId,
      rewardQuantity,
      sealedRunLootDeltaComparedWithNormal:
        (sealed.run?.lootBag.items[itemId] ?? 0) - (normal.run?.lootBag.items[itemId] ?? 0),
      sealedBankedInventoryDeltaComparedWithNormal:
        getBankedItemCount(sealed, itemId) - getBankedItemCount(normal, itemId),
      totalInventoryDeltaComparedWithNormal: sealed.inventory[itemId] - normal.inventory[itemId],
      rewardPointDeltaMatchesNormal:
        sealed.rewardPoints - beforeSeal.rewardPoints === normal.rewardPoints - beforeNormal.rewardPoints &&
        (sealed.run?.lootBag.rewardPoints ?? 0) - (beforeSeal.run?.lootBag.rewardPoints ?? 0) ===
          (normal.run?.lootBag.rewardPoints ?? 0) - (beforeNormal.run?.lootBag.rewardPoints ?? 0),
      ...(sealedDraft?.draftId === undefined ? {} : { relicDraftId: sealedDraft.draftId }),
      relicDraftCandidateIds: sealedDraftCandidateIds,
      normalRelicDraftCandidateIds: normalDraftCandidateIds,
      relicDraftPreserved:
        sealedDraft !== undefined &&
        normalDraft !== undefined &&
        JSON.stringify(sealedDraftCandidateIds) === JSON.stringify(normalDraftCandidateIds),
      inventoryBeforeSeal: beforeSeal.inventory[itemId],
      inventoryAfterSeal: sealed.inventory[itemId],
      inventoryAfterRetreat: retreated.inventory[itemId],
      inventoryAfterFailure: failed.inventory[itemId],
      retainedAfterRetreat: retreated.inventory[itemId] === sealed.inventory[itemId],
      retainedAfterFailure: failed.inventory[itemId] === sealed.inventory[itemId]
    }
  };
}

function getSoulRejectSnapshot(state: GameState) {
  return {
    phase: state.phase,
    hp: state.player.hp,
    inventory: structuredClone(state.inventory),
    run: state.run
      ? {
          dungeonId: state.run.dungeonId,
          currentNodeId: state.run.currentNodeId,
          clearedNodeIds: [...state.run.clearedNodeIds],
          lootBag: structuredClone(state.run.lootBag),
          soulSkillState: structuredClone(state.run.soulSkillState)
        }
      : undefined,
    combat: structuredClone(state.combat)
  };
}

function simulateSoulChargeGate(
  baseState: GameState
): { chargeGate: SoulChargeGateEvidence; uses: SoulSkillUseEvidence[] } {
  const dungeonId = 'demon_tower_1' as const;
  const scenario = enterSoulScenario(baseState, dungeonId, [
    'fog_lesser_demon',
    'blood_rune_trap',
    'upper_fog_patrol'
  ]);
  const atMonster = moveSoulRouteToUnresolvedNode(
    scenario.state,
    'fog_lesser_demon',
    scenario.evidence
  );
  const combat = selectNode(atMonster, 'fog_lesser_demon');
  const afterFirst = useEquipmentSoulSkill(combat, 'gauntlet_breakbeat');
  const firstUse = createSoulSkillUseEvidence(
    combat,
    afterFirst,
    'gauntlet_breakbeat',
    'charge-gate-first-use',
    { intentId: getCurrentCombatIntent(combat)?.id }
  );
  let state = finishActiveSoulCombat(afterFirst, scenario.evidence);
  state = swapOutSoulEquipment(state);
  state = moveSoulRouteToUnresolvedNode(state, 'blood_rune_trap', scenario.evidence);
  const cloudstepStatus = getEquipmentSoulSkillActionStatus(state, 'cloudstep_retrace');
  const backstepTargetNodeId = cloudstepStatus.targetNodeIds[0];
  if (!cloudstepStatus.available || !backstepTargetNodeId) {
    throw getDangerResolutionError(state, 'blood_rune_trap', 'charge-gate cloudstep was unavailable');
  }
  const afterSecond = useEquipmentSoulSkill(state, 'cloudstep_retrace', {
    targetNodeId: backstepTargetNodeId
  });
  const secondUse = createSoulSkillUseEvidence(
    state,
    afterSecond,
    'cloudstep_retrace',
    'charge-gate-second-use',
    { targetNodeId: backstepTargetNodeId }
  );

  const atRejectedTrap = moveSoulRouteToUnresolvedNode(
    afterSecond,
    'blood_rune_trap',
    scenario.evidence
  );
  const rejectedStatus = getEquipmentSoulSkillActionStatus(atRejectedTrap, 'mist_fixed_point');
  const rejectBefore = getSoulRejectSnapshot(atRejectedTrap);
  const rejected = useEquipmentSoulSkill(atRejectedTrap, 'mist_fixed_point');
  const rejectedWithoutMutation =
    JSON.stringify(getSoulRejectSnapshot(rejected)) === JSON.stringify(rejectBefore);
  const rejectedUse = createSoulSkillUseEvidence(
    atRejectedTrap,
    rejected,
    'mist_fixed_point',
    'charge-gate-third-rejected',
    {
      naturalTrapFailure: true,
      rejectionReason: rejectedStatus.unavailableReason,
      gameplayStateUnchangedOnReject: rejectedWithoutMutation
    }
  );

  state = resolveCurrentDanger(rejected, scenario.evidence);
  state = moveSoulRouteToUnresolvedNode(state, 'upper_fog_patrol', scenario.evidence);
  state = resolveCurrentDanger(state, scenario.evidence);
  const rechargeStatus = getEquipmentSoulSkillRechargeStatus(state);
  if (!rechargeStatus.available || rechargeStatus.rechargeId !== 'soul_node_demon_mist_watch') {
    throw getDangerResolutionError(state, 'upper_fog_patrol', 'charge-gate recharge was unavailable');
  }
  const pending = activateCurrentEquipmentSoulSkillRecharge(state);
  const restored = resolveCurrentEquipmentSoulSkillRecharge(pending, 'cloudstep_retrace');
  const chargesAfterRecharge = requireSoulState(restored, 'charge-gate:restored').chargesRemaining;
  const hostNode = DUNGEONS[dungeonId].nodes.find((node) => node.id === 'upper_fog_patrol');
  const reuseTrapNode = DUNGEONS[dungeonId].nodes.find(
    (node) =>
      node.type === 'trap' &&
      hostNode !== undefined &&
      areAdjacentRouteNodes(hostNode, node) &&
      !restored.run?.clearedNodeIds.includes(node.id)
  );
  if (!reuseTrapNode) {
    throw getDangerResolutionError(restored, 'upper_fog_patrol', 'charge-gate has no adjacent reuse trap');
  }
  const atReuseTrap = moveSoulRouteToUnresolvedNode(restored, reuseTrapNode.id, scenario.evidence);
  const reuseStatus = getEquipmentSoulSkillActionStatus(atReuseTrap, 'cloudstep_retrace');
  const reuseTargetNodeId = reuseStatus.targetNodeIds[0];
  if (!reuseStatus.available || !reuseTargetNodeId) {
    throw getDangerResolutionError(atReuseTrap, reuseTrapNode.id, 'restored cloudstep could not be reused');
  }
  const reused = useEquipmentSoulSkill(atReuseTrap, 'cloudstep_retrace', {
    targetNodeId: reuseTargetNodeId
  });
  const reuse = createSoulSkillUseEvidence(
    atReuseTrap,
    reused,
    'cloudstep_retrace',
    'charge-gate-post-recharge-reuse',
    { targetNodeId: reuseTargetNodeId }
  );

  return {
    chargeGate: {
      dungeonId,
      firstSkillId: 'gauntlet_breakbeat',
      secondSkillId: 'cloudstep_retrace',
      rejectedSkillId: 'mist_fixed_point',
      chargesAfterFirstUse: firstUse.chargesAfter,
      chargesAfterSecondUse: secondUse.chargesAfter,
      rejectedAvailability: rejectedStatus.availability,
      rejectedWithoutMutation,
      rechargeId: 'soul_node_demon_mist_watch',
      restoredSkillId: 'cloudstep_retrace',
      chargesAfterRecharge,
      reusedAfterRecharge: reuse.succeeded
    },
    uses: [firstUse, secondUse, rejectedUse, reuse]
  };
}

export function simulateSevenDungeonSoulRoute(
  initialState: GameState = createSoulSimulationBaseState()
): SevenDungeonSoulRouteResult {
  const suppliedSnapshot = structuredClone(initialState);
  const baseState = structuredClone(initialState);
  const sourceEquipment: SoulSkillSourceEquipmentEvidence[] = EQUIPMENT_SOUL_SKILL_CATALOG.map(
    (definition) => ({
      equipmentId: definition.equipmentId,
      skillId: definition.id,
      level: baseState.equipmentLevels[definition.equipmentId] ?? 0,
      temperRank: baseState.equipmentTemperRanks?.[definition.equipmentId] ?? 0,
      equippedAtEntry: baseState.equipped[definition.sourceSlot] === definition.equipmentId
    })
  );
  const equipmentSnapshot = simulateSoulEquipmentSnapshot(baseState);
  const rechargeExecutions = DUNGEON_ORDER.map((dungeonId) =>
    simulateSoulRechargeDungeon(baseState, dungeonId)
  );
  const summaries = rechargeExecutions.map(({ summary }) => summary);

  const mist = simulateMistFixedPoint(baseState);
  const rustCleanse = simulateSpiritGroundingAtCombat(
    baseState,
    'rust_hospital',
    'plague_orderly',
    ['rustPoisonStacks'],
    'spirit-cleanse-rust'
  );
  const mirrorCleanse = simulateSpiritGroundingAtCombat(
    baseState,
    'metro_abyss',
    'mirror_thread_spider',
    ['mirrorSlowStacks'],
    'spirit-cleanse-mirror'
  );
  const actionCleanse = simulateSpiritGroundingAtCombat(
    baseState,
    'dream_archive',
    'paper_librarian',
    ['lastPlayerAction'],
    'spirit-cleanse-recorded-action'
  );
  const breakbeat = simulateGauntletBreakbeat(baseState);
  const cloudstep = simulateCloudstepRetrace(baseState);
  const stablePortal = simulateRiftMisalignment(baseState, 'stabilize');
  const forcePortal = simulateRiftMisalignment(baseState, 'force');
  const seal = simulateRiftSeal(baseState);
  const chargeGate = simulateSoulChargeGate(baseState);
  const skillUses = [
    ...rechargeExecutions.flatMap(({ skillUses: uses }) => uses),
    mist,
    rustCleanse,
    mirrorCleanse,
    actionCleanse,
    breakbeat,
    cloudstep,
    stablePortal.use,
    forcePortal.use,
    seal.use,
    ...chargeGate.uses
  ];
  const coveredSkillIds = EQUIPMENT_SOUL_SKILL_CATALOG
    .map(({ id }) => id)
    .filter((skillId) => skillUses.some((use) => use.skillId === skillId && use.succeeded));
  const coveredRechargeIds = summaries.map(({ rechargeId }) => rechargeId);

  if (JSON.stringify(initialState) !== JSON.stringify(suppliedSnapshot)) {
    throw new BalanceSimulationError('Campaign soul simulation mutated its supplied initial state.');
  }
  if (coveredSkillIds.length !== EQUIPMENT_SOUL_SKILL_CATALOG.length) {
    throw new BalanceSimulationError(
      `Soul route missed skill coverage for ${EQUIPMENT_SOUL_SKILL_CATALOG
        .map(({ id }) => id)
        .filter((skillId) => !coveredSkillIds.includes(skillId))
        .join(', ')}.`
    );
  }

  return {
    baseState,
    sourceEquipment,
    equipmentSnapshot,
    summaries,
    skillUses,
    rechargeEvidence: summaries.map(({ recharge }) => recharge),
    portalOffsets: [stablePortal.portal, forcePortal.portal],
    rewardSeal: seal.reward,
    chargeGate: chargeGate.chargeGate,
    coveredSkillIds,
    coveredRechargeIds
  };
}

export type SevenDungeonFieldSurveyFixture = Readonly<{
  state: GameState;
  expectedFrozenSources: ReadonlyArray<{
    equipmentId: EquipmentId;
    attunementId: EquipmentAttunementId;
  }>;
}>;

export type FieldSurveyResolutionEvidence = Readonly<{
  dungeonId: DungeonId;
  nodeId: string;
  surveyId: string;
  optionId: string;
  branch: EquipmentAttunementId;
  sourceEquipmentIds: EquipmentId[];
  routeLegal: boolean;
  routeEvidence: RouteLegalityEvidence;
  rewardPointDelta: number;
  lingyunDelta: number;
  itemDelta: Partial<Record<ItemId, number>>;
  hpDelta: number;
  costDelta: Partial<Record<ItemId, number>>;
  nodeCleared: boolean;
  resolutionRecorded: boolean;
}>;

export type FieldSurveyGuardEvidence = Readonly<{
  missingCostRejected: boolean;
  wrongOptionRejected: boolean;
  unfrozenBranchRejected: boolean;
  repeatedResolutionRejected: boolean;
  legacyDisabled: boolean;
  malformedDisabled: boolean;
  legacyNormalCollectWorks: boolean;
  malformedNormalCollectWorks: boolean;
  portalCrossedToTargetDungeon: boolean;
  portalPreservesFrozenSources: boolean;
  portalPreservesResolution: boolean;
  retreatRetainedRewardPoints: number;
  retreatLostRewardPoints: number;
  explicitFailureRetainedRewardPoints: number;
  explicitFailureLostRewardPoints: number;
  lowHpDamageTriggeredFailure: boolean;
  lowHpDamageTaken: number;
  lowHpFailureRetainedRewardPoints: number;
  lowHpFailureLostRewardPoints: number;
}>;

export type SevenDungeonFieldSurveyRouteResult = Readonly<{
  fixture: SevenDungeonFieldSurveyFixture;
  resolutions: FieldSurveyResolutionEvidence[];
  coveredSurveyIds: string[];
  coveredOptionIds: string[];
  coveredBranches: EquipmentAttunementId[];
  guards: FieldSurveyGuardEvidence;
}>;

const FIELD_SURVEY_FIXTURE_SOURCES = [
  { equipmentId: 'armor_piercing_sword', attunementId: 'forge_overdrive' },
  { equipmentId: 'guardian_gauntlets', attunementId: 'forge_channeling' },
  { equipmentId: 'mist_hood', attunementId: 'mist_vanguard' },
  { equipmentId: 'spirit_robe', attunementId: 'mist_veilguard' },
  { equipmentId: 'carapace_harness', attunementId: 'rift_anchor' },
  { equipmentId: 'rift_charm', attunementId: 'rift_resonance' },
  { equipmentId: 'chronal_edge', attunementId: 'chronal_acceleration' },
  { equipmentId: 'chronal_aegis', attunementId: 'chronal_stasis' }
] as const satisfies readonly { equipmentId: EquipmentId; attunementId: EquipmentAttunementId }[];

export function createSevenDungeonFieldSurveyFixture(): SevenDungeonFieldSurveyFixture {
  const initial = createInitialState();
  const equipped = {
    weapon: 'armor_piercing_sword',
    head: 'mist_hood',
    armor: 'spirit_robe',
    hands: 'guardian_gauntlets',
    feet: 'cloudstep_boots',
    waist: 'rift_belt',
    charm: 'rift_charm'
  } as const;
  const equipmentIds = [
    ...(Object.values(equipped) as EquipmentId[]),
    'chronal_edge' as const,
    'chronal_aegis' as const,
    'carapace_harness' as const,
    'return_anchor_belt' as const,
    'custody_shell' as const
  ];
  const equipmentLevels: Partial<Record<EquipmentId, number>> = {
    ...initial.equipmentLevels,
    armor_piercing_sword: EQUIPMENT.armor_piercing_sword.maxLevel,
    guardian_gauntlets: EQUIPMENT.guardian_gauntlets.maxLevel,
    mist_hood: EQUIPMENT.mist_hood.maxLevel,
    spirit_robe: EQUIPMENT.spirit_robe.maxLevel,
    rift_belt: EQUIPMENT.rift_belt.maxLevel,
    rift_charm: EQUIPMENT.rift_charm.maxLevel,
    chronal_edge: EQUIPMENT.chronal_edge.maxLevel,
    chronal_aegis: EQUIPMENT.chronal_aegis.maxLevel,
    carapace_harness: EQUIPMENT.carapace_harness.maxLevel,
    return_anchor_belt: 1,
    custody_shell: EQUIPMENT.custody_shell.maxLevel,
    cloudstep_boots: 1
  };
  const attunements: Partial<Record<EquipmentId, EquipmentAttunementId>> = Object.fromEntries(
    FIELD_SURVEY_FIXTURE_SOURCES.map((source) => [source.equipmentId, source.attunementId])
  );
  attunements.rift_belt = 'rift_anchor';
  attunements.custody_shell = 'rift_anchor';
  const prepared: GameState = {
    ...initial,
    rewardPoints: 20_000,
    lingyun: 100,
    inventory: {
      ...initial.inventory,
      echo_coin: 8,
      dispel_talisman: 8,
      gate_sigil: 8,
      healing_pill: 8,
      legacy_scrip: 8,
      genesis_serum: 1,
      silence_core: 64,
      rescue_badge: 64,
      combat_reel: 1,
      observation_shard: 8,
      rift_dust: 8,
      cracked_core: 8,
      cycle_imprint: 8,
      truth_fragment: 8
    },
    ownedEquipment: [...new Set([...initial.ownedEquipment, ...equipmentIds])],
    equipmentLevels,
    equipmentAttunements: attunements,
    equipped,
    // Every host is entered independently, so its normal campaign gate must already be satisfied.
    completedDungeonIds: [...DUNGEON_ORDER]
  };
  let surveyPrepared = buyEquipment(prepared, 'anechoic_mantle');
  if (!surveyPrepared.ownedEquipment.includes('anechoic_mantle')) {
    throw new BalanceSimulationError('Field-survey fixture could not buy anechoic_mantle.');
  }
  while ((surveyPrepared.equipmentLevels.anechoic_mantle ?? 1) < EQUIPMENT.anechoic_mantle.maxLevel) {
    const beforeLevel = surveyPrepared.equipmentLevels.anechoic_mantle ?? 1;
    surveyPrepared = upgradeEquipment(surveyPrepared, 'anechoic_mantle');
    if ((surveyPrepared.equipmentLevels.anechoic_mantle ?? 1) === beforeLevel) {
      throw new BalanceSimulationError('Field-survey fixture could not max anechoic_mantle.');
    }
  }
  surveyPrepared = attuneEquipment(surveyPrepared, 'anechoic_mantle', 'rift_anchor');
  if (surveyPrepared.equipmentAttunements?.anechoic_mantle !== 'rift_anchor') {
    throw new BalanceSimulationError('Field-survey fixture could not attune anechoic_mantle.');
  }
  const maxHp = getDerivedStats(surveyPrepared).maxHp;
  const state = configureTacticalLoadout(
    {
      ...surveyPrepared,
      player: { ...surveyPrepared.player, hp: maxHp, maxHp }
    },
    ['echo_coin', 'dispel_talisman', 'gate_sigil']
  );

  if (!getTacticalLoadoutStatus(state).isValid || state.player.hp !== getDerivedStats(state).maxHp) {
    throw new BalanceSimulationError('Field-survey fixture did not produce a valid full-health tactical entry state.');
  }

  return {
    state,
    expectedFrozenSources: FIELD_SURVEY_FIXTURE_SOURCES.map((source) => ({ ...source }))
  };
}

function getFieldSurveyDungeonId(survey: FieldSurveyDefinition): DungeonId {
  const dungeonIds = DUNGEON_ORDER.filter((dungeonId) =>
    DUNGEONS[dungeonId].nodes.some((node) => node.id === survey.nodeId && node.fieldSurveyId === survey.id)
  );
  if (dungeonIds.length !== 1) {
    throw new BalanceSimulationError(`Field survey ${survey.id} must have exactly one real dungeon host.`);
  }
  return dungeonIds[0];
}

function getInventoryDelta(before: GameState, after: GameState): Partial<Record<ItemId, number>> {
  const itemIds = new Set<ItemId>([
    ...(Object.keys(before.inventory) as ItemId[]),
    ...(Object.keys(after.inventory) as ItemId[])
  ]);
  const delta: Partial<Record<ItemId, number>> = {};
  for (const itemId of itemIds) {
    const change = after.inventory[itemId] - before.inventory[itemId];
    if (change !== 0) delta[itemId] = change;
  }
  return delta;
}

function assertSurveyHost(state: GameState, survey: FieldSurveyDefinition, checkpoint: string): void {
  const status = getCurrentFieldSurveyStatus(state);
  if (
    state.run?.currentNodeId !== survey.nodeId ||
    status.survey?.id !== survey.id ||
    status.legacyDisabled ||
    state.run?.clearedNodeIds.includes(survey.nodeId)
  ) {
    throw new BalanceSimulationError(`${checkpoint}: did not reach unresolved host ${survey.id} through the legal route.`);
  }
}

// This intentionally does not collect rewards: the survey host must remain unresolved for resolveFieldSurvey.
function moveToFieldSurveyHost(
  state: GameState,
  survey: FieldSurveyDefinition,
  evidence: RouteCombatEvidence
): GameState {
  let nextState = state.run?.dungeonId === 'redaction_scriptorium'
    ? prepareRedactionScriptoriumApproach(state, evidence)
    : state;
  const maximumMovements = state.run ? DUNGEONS[state.run.dungeonId].nodes.length * 4 : 0;
  for (let movementCount = 0; nextState.run?.currentNodeId !== survey.nodeId; movementCount += 1) {
    if (movementCount >= maximumMovements) {
      throw getDangerResolutionError(nextState, survey.nodeId, `survey route exceeded ${maximumMovements} movements`);
    }
    nextState = resolveCurrentDanger(nextState, evidence);
    nextState = resolvePendingEscortCheckpoint(nextState, evidence, STANDARD_ESCORT_CHECKPOINT_CHOICES);
    if (!nextState.run) {
      throw new BalanceSimulationError(`Survey ${survey.id}: run ended before reaching its host.`);
    }
    nextState = resolvePendingEntropyHeadingForTarget(nextState, survey.nodeId, evidence);
    if (!nextState.run) {
      throw getDangerResolutionError(nextState, survey.nodeId, 'heading resolution ended the survey run');
    }

    const nextNodeId = findAdjacentRoutePath(nextState, survey.nodeId, evidence)[0];
    if (!nextNodeId) {
      throw getDangerResolutionError(nextState, survey.nodeId, 'legal pathfinder returned no movement step');
    }
    const fromNodeId = nextState.run.currentNodeId;
    const gateStatus = getCurrentRouteGateStatus(nextState, nextNodeId);
    const blockReason = getCurrentRouteBlockReason(nextState, nextNodeId);
    evidence.routeMovements.push({
      fromNodeId,
      toNodeId: nextNodeId,
      legal: blockReason === undefined,
      routeGateId: gateStatus?.gate.id,
      blockReason
    });
    if (gateStatus) recordRouteGateEvidence(evidence, gateStatus, blockReason === undefined);
    if (blockReason) {
      throw getDangerResolutionError(nextState, nextNodeId, `attempted an illegal survey route movement: ${blockReason}`);
    }

    const moved = moveToNode(nextState, nextNodeId);
    if (moved.run?.currentNodeId !== nextNodeId) {
      throw getDangerResolutionError(moved, nextNodeId, `moveToNode did not leave ${fromNodeId}`);
    }
    nextState = moved;
  }
  assertSurveyHost(nextState, survey, `Survey ${survey.id}`);
  return nextState;
}

function enterFieldSurveyRun(
  fixture: SevenDungeonFieldSurveyFixture,
  survey: FieldSurveyDefinition,
  evidence: RouteCombatEvidence = createRouteCombatEvidence(),
  requiredAttunementId?: EquipmentAttunementId
): { state: GameState; dungeonId: DungeonId; evidence: RouteCombatEvidence } {
  const dungeonId = getFieldSurveyDungeonId(survey);
  let preparedState = structuredClone(fixture.state);
  if (requiredAttunementId) {
    const source = requiredAttunementId === 'rift_anchor' && survey.id === 'survey_silent_broadcast_archive'
      ? { equipmentId: 'anechoic_mantle' as const, attunementId: 'rift_anchor' as const }
      : requiredAttunementId === 'rift_anchor' && survey.id === 'survey_false_testimony_archive'
        ? { equipmentId: 'custody_shell' as const, attunementId: 'rift_anchor' as const }
      : requiredAttunementId === 'rift_anchor' && survey.id !== 'survey_genesis_bloodline_archive'
        ? { equipmentId: 'rift_belt' as const, attunementId: 'rift_anchor' as const }
      : fixture.expectedFrozenSources.find(
          (candidate) => candidate.attunementId === requiredAttunementId
        );
    if (!source) {
      throw new BalanceSimulationError(`Missing field-survey source for ${requiredAttunementId}.`);
    }
    preparedState = equipEquipment(preparedState, source.equipmentId);
    if (survey.id === 'survey_silent_broadcast_archive' && source.equipmentId === 'anechoic_mantle') {
      preparedState = equipEquipment(preparedState, 'patched_belt');
    }
    if (survey.id === 'survey_false_testimony_archive' && source.equipmentId === 'custody_shell') {
      preparedState = equipEquipment(preparedState, 'return_anchor_belt');
    }
    if (requiredAttunementId === 'rift_anchor' && survey.id === 'survey_genesis_bloodline_archive') {
      preparedState = equipEquipment(preparedState, 'return_anchor_belt');
    }
  }
  const entered = isolateRunPursuitForIndependentBalanceScenario(
    enterDungeon(preparedState, dungeonId)
  );
  if (entered.run?.dungeonId !== dungeonId) {
    throw new BalanceSimulationError(`Could not enter ${dungeonId} for field survey ${survey.id}.`);
  }
  return { state: moveToFieldSurveyHost(entered, survey, evidence), dungeonId, evidence };
}

function runFieldSurveyResolution(
  fixture: SevenDungeonFieldSurveyFixture,
  survey: FieldSurveyDefinition,
  option: FieldSurveyOption
): FieldSurveyResolutionEvidence {
  const route = enterFieldSurveyRun(fixture, survey, createRouteCombatEvidence(), option.attunementId);
  const before = route.state;
  const status = getCurrentFieldSurveyStatus(before);
  const optionStatus = status.options.find((candidate) => candidate.definition.id === option.id);
  if (!optionStatus?.available) {
    throw new BalanceSimulationError(`Survey ${survey.id}/${option.id} was not available at its real host.`);
  }

  const resolved = resolveFieldSurvey(before, option.id);
  const resolutionRecorded = Boolean(
    resolved.run?.fieldSurveyState?.resolvedSurveys.some(
      (entry) => entry.surveyId === survey.id && entry.optionId === option.id
    )
  );
  const nodeCleared = Boolean(resolved.run?.clearedNodeIds.includes(survey.nodeId));
  if (!resolutionRecorded || !nodeCleared) {
    throw new BalanceSimulationError(`Survey ${survey.id}/${option.id} did not settle through resolveFieldSurvey.`);
  }

  const itemDelta = getInventoryDelta(before, resolved);
  const costDelta: Partial<Record<ItemId, number>> = {};
  for (const itemId of Object.keys(option.cost ?? {}) as ItemId[]) {
    const required = Math.max(0, Math.floor(option.cost?.[itemId] ?? 0));
    const usedBefore = before.run?.usedItems.filter((usedItemId) => usedItemId === itemId).length ?? 0;
    const usedAfter = resolved.run?.usedItems.filter((usedItemId) => usedItemId === itemId).length ?? 0;
    if (usedAfter - usedBefore !== required) {
      throw new BalanceSimulationError(`Survey ${survey.id}/${option.id} did not consume ${itemId} as its declared cost.`);
    }
    costDelta[itemId] = -required;
  }

  return {
    dungeonId: route.dungeonId,
    nodeId: survey.nodeId,
    surveyId: survey.id,
    optionId: option.id,
    branch: option.attunementId,
    sourceEquipmentIds: [...optionStatus.frozenSourceEquipmentIds],
    routeLegal: route.evidence.routeMovements.every((movement) => movement.legal && !movement.blockReason),
    routeEvidence: getRouteLegalityEvidence(route.evidence),
    rewardPointDelta: resolved.rewardPoints - before.rewardPoints,
    lingyunDelta: resolved.lingyun - before.lingyun,
    itemDelta,
    hpDelta: resolved.player.hp - before.player.hp,
    costDelta,
    nodeCleared,
    resolutionRecorded
  };
}

function isRejectedSurveyResolution(before: GameState, after: GameState, survey: FieldSurveyDefinition): boolean {
  return (
    !after.run?.clearedNodeIds.includes(survey.nodeId) &&
    after.rewardPoints === before.rewardPoints &&
    after.lingyun === before.lingyun &&
    after.player.hp === before.player.hp &&
    JSON.stringify(after.inventory) === JSON.stringify(before.inventory) &&
    after.run?.fieldSurveyState === before.run?.fieldSurveyState
  );
}

function createFieldSurveyGuardEvidence(fixture: SevenDungeonFieldSurveyFixture): FieldSurveyGuardEvidence {
  const demonSurvey = FIELD_SURVEY_CATALOG.find((survey) => survey.id === 'survey_demon_bone_marrow');
  const metroSurvey = FIELD_SURVEY_CATALOG.find((survey) => survey.id === 'survey_metro_lost_property');
  const arenaSurvey = FIELD_SURVEY_CATALOG.find((survey) => survey.id === 'survey_arena_cracked_prize');
  if (!demonSurvey || !metroSurvey || !arenaSurvey) throw new BalanceSimulationError('Required field survey guard host is missing.');

  const missingCostFixture: SevenDungeonFieldSurveyFixture = {
    ...fixture,
    state: { ...fixture.state, inventory: { ...fixture.state.inventory, echo_coin: 0 } }
  };
  const missingCost = enterFieldSurveyRun(missingCostFixture, metroSurvey).state;
  const missingCostRejected = isRejectedSurveyResolution(
    missingCost,
    resolveFieldSurvey(missingCost, 'rift_anchor_lost_property'),
    metroSurvey
  );

  const wrongOption = enterFieldSurveyRun(fixture, demonSurvey).state;
  const wrongOptionRejected = isRejectedSurveyResolution(wrongOption, resolveFieldSurvey(wrongOption, 'not_an_option'), demonSurvey);

  const unfrozenFixture: SevenDungeonFieldSurveyFixture = {
    ...fixture,
    state: {
      ...fixture.state,
      equipmentAttunements: { ...fixture.state.equipmentAttunements, mist_hood: undefined }
    }
  };
  const unfrozen = enterFieldSurveyRun(unfrozenFixture, demonSurvey).state;
  const unfrozenBranchRejected = isRejectedSurveyResolution(
    unfrozen,
    resolveFieldSurvey(unfrozen, 'mist_vanguard_fast_search'),
    demonSurvey
  );

  const repeatStart = enterFieldSurveyRun(fixture, demonSurvey).state;
  const repeatedFirst = resolveFieldSurvey(repeatStart, 'mist_vanguard_fast_search');
  const repeatedSecond = resolveFieldSurvey(repeatedFirst, 'mist_vanguard_fast_search');
  const repeatedResolutionRejected =
    repeatedSecond.run?.clearedNodeIds.join(',') === repeatedFirst.run?.clearedNodeIds.join(',') &&
    repeatedSecond.rewardPoints === repeatedFirst.rewardPoints &&
    repeatedSecond.lingyun === repeatedFirst.lingyun &&
    repeatedSecond.player.hp === repeatedFirst.player.hp &&
    JSON.stringify(repeatedSecond.inventory) === JSON.stringify(repeatedFirst.inventory) &&
    repeatedSecond.run?.fieldSurveyState === repeatedFirst.run?.fieldSurveyState;

  const legacyEntry = enterFieldSurveyRun(fixture, demonSurvey).state;
  if (!legacyEntry.run) throw new BalanceSimulationError('Legacy survey guard lost its run.');
  const { fieldSurveyState: _legacySnapshot, ...legacyRun } = legacyEntry.run;
  const legacy = { ...legacyEntry, run: legacyRun };
  const legacyRejected = resolveFieldSurvey(legacy, 'mist_vanguard_fast_search');
  const legacyNormal = collectReward(legacyRejected);

  const malformedEntry = enterFieldSurveyRun(fixture, demonSurvey).state;
  if (!malformedEntry.run) throw new BalanceSimulationError('Malformed survey guard lost its run.');
  const malformed = {
    ...malformedEntry,
    run: {
      ...malformedEntry.run,
      fieldSurveyState: {
        rulesVersion: 2,
        frozenSources: [],
        resolvedSurveys: []
      } as unknown as NonNullable<GameState['run']>['fieldSurveyState']
    }
  };
  const malformedRejected = resolveFieldSurvey(malformed, 'mist_vanguard_fast_search');
  const malformedNormal = collectReward(malformedRejected);

  const portalEvidence = createRouteCombatEvidence();
  const portalStart = enterFieldSurveyRun(fixture, demonSurvey, portalEvidence).state;
  const portalResolved = resolveFieldSurvey(portalStart, 'mist_vanguard_fast_search');
  const portalNode = DUNGEONS.demon_tower_1.nodes.find((node) => node.id === 'cracked_portal');
  if (!portalNode?.portal) throw new BalanceSimulationError('Required field survey portal is missing.');
  const atPortal = moveAlongRoutePath(portalResolved, portalNode.id, portalEvidence);
  const frozenSnapshot = atPortal.run?.fieldSurveyState;
  const transported = usePortal(selectNode(atPortal, portalNode.id), 'force');
  const portalCrossedToTargetDungeon = transported.run?.dungeonId === portalNode.portal.targetDungeonId;
  if (!portalCrossedToTargetDungeon) {
    throw getDangerResolutionError(transported, portalNode.id, 'field-survey portal guard did not cross to its target dungeon');
  }
  const portalPreservesFrozenSources =
    transported.run?.fieldSurveyState === frozenSnapshot &&
    JSON.stringify(transported.run?.fieldSurveyState?.frozenSources) === JSON.stringify(frozenSnapshot?.frozenSources);
  const portalPreservesResolution = Boolean(
    transported.run?.fieldSurveyState?.resolvedSurveys.some(
      (entry) => entry.surveyId === demonSurvey.id && entry.optionId === 'mist_vanguard_fast_search'
    )
  );

  const economyStart = enterFieldSurveyRun(fixture, demonSurvey).state;
  const economyResolved = resolveFieldSurvey(economyStart, 'mist_vanguard_fast_search');
  const retreated = resolveRetreat(economyResolved);
  const explicitlyFailed = resolveRunFailure(economyResolved, 'field-survey explicit failure guard');

  const lethalRoute = enterFieldSurveyRun(fixture, arenaSurvey);
  const lowHpHost: GameState = {
    ...lethalRoute.state,
    player: { ...lethalRoute.state.player, hp: 1 }
  };
  const lethal = resolveFieldSurvey(lowHpHost, 'forge_overdrive_core_break');

  return {
    missingCostRejected,
    wrongOptionRejected,
    unfrozenBranchRejected,
    repeatedResolutionRejected,
    legacyDisabled: getCurrentFieldSurveyStatus(legacy).legacyDisabled && isRejectedSurveyResolution(legacy, legacyRejected, demonSurvey),
    malformedDisabled: getCurrentFieldSurveyStatus(malformed).legacyDisabled && isRejectedSurveyResolution(malformed, malformedRejected, demonSurvey),
    legacyNormalCollectWorks: legacyNormal.run?.clearedNodeIds.includes(demonSurvey.nodeId) ?? false,
    malformedNormalCollectWorks: malformedNormal.run?.clearedNodeIds.includes(demonSurvey.nodeId) ?? false,
    portalCrossedToTargetDungeon,
    portalPreservesFrozenSources,
    portalPreservesResolution,
    retreatRetainedRewardPoints: retreated.run?.lastLootSettlement?.retained.rewardPoints ?? -1,
    retreatLostRewardPoints: retreated.run?.lastLootSettlement?.lost.rewardPoints ?? -1,
    explicitFailureRetainedRewardPoints: explicitlyFailed.run?.lastLootSettlement?.retained.rewardPoints ?? -1,
    explicitFailureLostRewardPoints: explicitlyFailed.run?.lastLootSettlement?.lost.rewardPoints ?? -1,
    lowHpDamageTriggeredFailure:
      lethal.phase === 'result' &&
      lethal.player.hp === 0 &&
      lethal.run?.clearedNodeIds.includes(arenaSurvey.nodeId) === true &&
      lethal.run.fieldSurveyState?.resolvedSurveys.some((entry) => entry.surveyId === arenaSurvey.id) === true,
    lowHpDamageTaken: (lethal.run?.damageTaken ?? 0) - (lowHpHost.run?.damageTaken ?? 0),
    lowHpFailureRetainedRewardPoints: lethal.run?.lastLootSettlement?.retained.rewardPoints ?? -1,
    lowHpFailureLostRewardPoints: lethal.run?.lastLootSettlement?.lost.rewardPoints ?? -1
  };
}

export function simulateSevenDungeonFieldSurveyRoute(): SevenDungeonFieldSurveyRouteResult {
  const fixture = createSevenDungeonFieldSurveyFixture();
  const fixtureSnapshot = structuredClone(fixture);
  const resolutions = FIELD_SURVEY_CATALOG.flatMap((survey) =>
    survey.options.map((option) => runFieldSurveyResolution(fixture, survey, option))
  );
  const coveredSurveyIds = [...new Set(resolutions.map((resolution) => resolution.surveyId))];
  const coveredOptionIds = [...new Set(resolutions.map((resolution) => resolution.optionId))];
  const coveredBranches = [...new Set(resolutions.map((resolution) => resolution.branch))];
  const expectedOptionCount = FIELD_SURVEY_CATALOG.reduce(
    (count, survey) => count + survey.options.length,
    0
  );
  const expectedBranchCount = new Set(
    FIELD_SURVEY_CATALOG.flatMap((survey) => survey.options.map((option) => option.attunementId))
  ).size;

  if (JSON.stringify(fixture) !== JSON.stringify(fixtureSnapshot)) {
    throw new BalanceSimulationError('Campaign field-survey simulation mutated its reusable fixture.');
  }
  if (
    resolutions.length !== expectedOptionCount ||
    coveredSurveyIds.length !== DUNGEON_ORDER.length ||
    coveredOptionIds.length !== expectedOptionCount ||
    coveredBranches.length !== expectedBranchCount
  ) {
    throw new BalanceSimulationError(
      `Field-survey coverage incomplete: runs=${resolutions.length}, surveys=${coveredSurveyIds.length}, options=${coveredOptionIds.length}, branches=${coveredBranches.length}.`
    );
  }

  return {
    fixture,
    resolutions,
    coveredSurveyIds,
    coveredOptionIds,
    coveredBranches,
    guards: createFieldSurveyGuardEvidence(fixture)
  };
}

export type SevenDungeonEquipmentHuntFixture = Readonly<{
  state: GameState;
  targets: Readonly<Record<DungeonId, EquipmentId>>;
}>;

export type EquipmentHuntOfferEvidence = Readonly<{
  offerId: string;
  equipmentIds: EquipmentId[];
  guaranteedEquipmentId: EquipmentId | undefined;
  targetFirst: boolean;
  targetOccurrenceCount: number;
  lootOffersMade: number;
}>;

export type EquipmentHuntLootBagEvidence = Readonly<{
  rewardPoints: number;
  lingyun: number;
  items: Readonly<Partial<Record<ItemId, number>>>;
  equipmentIds: readonly EquipmentId[];
}>;

export type EquipmentHuntClueRouteEvidence = Readonly<{
  dungeonId: DungeonId;
  clueIndex: 0 | 1;
  clueNodeId: string;
  targetEquipmentId: EquipmentId;
  startNodeId: string;
  eliteNodeId: string;
  rewardHostExists: boolean;
  clueDefinitionMatchesHost: boolean;
  clueCollected: boolean;
  qualifiedBeforeElite: boolean;
  lootOffersBeforeElite: number;
  eliteMatchesDungeonDefinition: boolean;
  startToClueMovementCount: number;
  clueToEliteMovementCount: number;
  clueRewardPointsGained: number;
  clueLingyunGained: number;
  clueItemDelta: Partial<Record<ItemId, number>>;
  offer: EquipmentHuntOfferEvidence;
  focusTrace: CombatFocusTrace[];
  routeEvidence: RouteLegalityEvidence;
}>;

export type SevenDungeonEquipmentHuntSummary = Readonly<{
  tier: number;
  dungeonId: DungeonId;
  dungeonName: string;
  targetEquipmentId: EquipmentId;
  clueIndex: 0 | 1;
  clueNodeId: string;
  eliteNodeId: string;
  bossNodeId: string;
  exitNodeId: string;
  offer: EquipmentHuntOfferEvidence;
  targetOwnedBeforeSelection: boolean;
  targetOwnedAfterSelection: boolean;
  targetOwnedBeforeExit: boolean;
  targetLevelBeforeExit: number | undefined;
  targetInLootBagBeforeExit: boolean;
  bossClearedBeforeExit: boolean;
  lootBagBeforeExit: EquipmentHuntLootBagEvidence;
  retainedSettlement: EquipmentHuntLootBagEvidence;
  lostSettlement: EquipmentHuntLootBagEvidence;
  lootBagAfterExit: EquipmentHuntLootBagEvidence;
  targetOwnedAfterExit: boolean;
  targetLevelAfterExit: number | undefined;
  exitCleared: boolean;
  settled: boolean;
  routeEvidence: RouteLegalityEvidence;
}>;

export type EquipmentHuntGuardEvidence = Readonly<{
  ordinaryOfferMatchesRealApi: boolean;
  ordinaryOfferHasNoGuarantee: boolean;
  eliteBeforeClueHasNoGuarantee: boolean;
  clueAfterEliteDoesNotBackfill: boolean;
  portalCrossingInvalidatesHunt: boolean;
  uncollectedClueDoesNotQualify: boolean;
  retreatLosesSelectedTarget: boolean;
  failureLosesSelectedTarget: boolean;
  fixtureUnchanged: boolean;
}>;

export type SevenDungeonEquipmentHuntRouteResult = Readonly<{
  fixture: SevenDungeonEquipmentHuntFixture;
  targets: Readonly<Record<DungeonId, EquipmentId>>;
  coverage: Readonly<{
    dungeonIds: DungeonId[];
    dungeonCount: number;
    definedClueCount: number;
    validatedClueRouteCount: number;
    settledHuntCount: number;
    usedClueIndexes: Array<0 | 1>;
    usedClueNodeIds: string[];
  }>;
  clueRoutes: EquipmentHuntClueRouteEvidence[];
  summaries: SevenDungeonEquipmentHuntSummary[];
  guards: EquipmentHuntGuardEvidence;
}>;

type EquipmentHuntRouteExecution = {
  state: GameState;
  evidence: RouteCombatEvidence;
  coverage: EquipmentHuntClueRouteEvidence;
};

const EQUIPMENT_HUNT_SCRIPTED_ACTIONS: Partial<
  Record<DungeonId, Partial<Record<string, CombatAction[]>>>
> = {
  ash_arena: {
    ash_duelist: ['attack'],
    ember_pit_duelist: ['art'],
    cinder_lancer: ['guard']
  },
  void_citadel: {
    void_knight: ['attack'],
    first_echo_patrol: ['art'],
    second_echo_patrol: ['guard']
  },
  temporal_observatory: {
    epoch_sentinel_alpha: ['attack', 'art', 'guard'],
    epoch_sentinel_omega: ['attack', 'art', 'guard'],
    zero_hour_regent: ['attack', 'art', 'guard']
  },
  causal_clearinghouse: {
    paradox_bailiff_alpha: ['attack', 'art', 'guard'],
    paradox_bailiff_omega: ['attack', 'art', 'guard'],
    zero_sum_auditor: ['attack', 'art', 'guard']
  },
  entropy_ark: {
    dissipation_navigator_alpha: ['attack', 'art', 'guard'],
    dissipation_navigator_omega: ['attack', 'art', 'guard'],
    last_helmsman: ['attack', 'art', 'guard']
  },
  mirror_cycle_city: {
    parallax_hunter_real: ['attack', 'art', 'guard'],
    parallax_hunter_mirror: ['attack', 'art', 'guard'],
    nameless_reflection: ['attack', 'art', 'guard']
  },
  redaction_scriptorium: {
    erasure_copyist_north: ['attack', 'art', 'guard'],
    palimpsest_censor_alpha: ['attack', 'art', 'guard'],
    last_redactor: ['attack', 'art', 'guard']
  },
  legacy_auction_court: {
    inheritance_mimic_alpha: ['attack', 'art', 'guard'],
    inheritance_mimic_omega: ['attack', 'art', 'guard'],
    estate_auctioneer: ['attack', 'art', 'guard']
  },
  silent_broadcast_tower: {
    frequency_leech_north: ['attack', 'art', 'guard'],
    broadcast_warden_omega: BROADCAST_WARDEN_SURVIVAL_SCRIPT,
    last_broadcaster: BROADCAST_BOSS_SURVIVAL_SCRIPT
  },
  lost_shelter: {
    north_rescue_patrol: LOST_SHELTER_SURVIVAL_SCRIPT,
    shelter_enforcer_north: LOST_SHELTER_SURVIVAL_SCRIPT,
    mimic_survivor_alpha: LOST_SHELTER_SURVIVAL_SCRIPT,
    evacuation_horror_omega: LOST_SHELTER_SURVIVAL_SCRIPT,
    mimic_survivor: LOST_SHELTER_SURVIVAL_SCRIPT,
    shelter_overseer: LOST_SHELTER_BOSS_SURVIVAL_SCRIPT
  },
  combat_replay_stage: {
    cue_stalker: COMBAT_REPLAY_CUE_STALKER_SCRIPT,
    cue_stalker_north: COMBAT_REPLAY_CUE_STALKER_SCRIPT,
    retake_double_omega: COMBAT_REPLAY_RETAKE_SCRIPT,
    take_alpha: COMBAT_REPLAY_TAKE_ALPHA_SCRIPT,
    take_beta: COMBAT_REPLAY_TAKE_BETA_SCRIPT,
    take_gamma: COMBAT_REPLAY_TAKE_GAMMA_SCRIPT,
    final_cut_director: COMBAT_REPLAY_BOSS_SURVIVAL_SCRIPT
  },
  panopticon_city: {
    sweep_sentinel_north: PANOPTICON_SURVIVAL_SCRIPT,
    blindspot_auditor_north: PANOPTICON_SURVIVAL_SCRIPT,
    exposure_double_patrol: PANOPTICON_SURVIVAL_SCRIPT,
    sweep_sentinel: PANOPTICON_SURVIVAL_SCRIPT,
    soul_recharge_panopticon: PANOPTICON_SURVIVAL_SCRIPT,
    exposure_double: PANOPTICON_SURVIVAL_SCRIPT,
    all_sight_warden: PANOPTICON_SURVIVAL_SCRIPT
  }
};

const EQUIPMENT_HUNT_BOSS_LAW_NODES: Partial<Record<DungeonId, readonly string[]>> = {
  ash_arena: ['ash_duelist', 'ember_pit_duelist', 'cinder_lancer'],
  void_citadel: ['void_knight', 'first_echo_patrol', 'second_echo_patrol'],
  temporal_observatory: ['past_calibration_anchor', 'future_calibration_anchor'],
  causal_clearinghouse: ['cause_deposition', 'effect_deposition'],
  entropy_ark: ['bow_heading_console', 'midship_heading_console', 'stern_heading_console', 'ark_manifest'],
  mirror_cycle_city: [
    'first_phase_mirror',
    'real_anchor',
    'second_phase_mirror',
    'mirror_anchor',
    'third_phase_mirror'
  ],
  redaction_scriptorium: [
    'body_clause_desk',
    'memory_clause_desk',
    'return_clause_desk',
    'final_proof_nexus'
  ],
  legacy_auction_court: [
    'force_lot_dais',
    'guard_lot_dais',
    'art_lot_dais',
    'return_lot_dais'
  ],
  silent_broadcast_tower: [
    'south_relay_console',
    'north_relay_console',
    'central_relay_console'
  ],
  combat_replay_stage: ['take_alpha', 'take_beta', 'take_gamma'],
  panopticon_city: [
    'north_blind_relay',
    'central_blind_relay',
    'south_blind_relay',
    'shadow_route'
  ]
};

const EQUIPMENT_HUNT_TACTICAL_ITEMS: Record<DungeonId, readonly TacticalItemId[]> = {
  demon_tower_1: ['healing_pill', 'dispel_talisman', 'armor_patch'],
  metro_abyss: ['healing_pill', 'dispel_talisman', 'gate_sigil'],
  starfall_mine: ['healing_pill', 'gate_sigil', 'armor_patch'],
  rust_hospital: ['healing_pill', 'armor_patch', 'dispel_talisman'],
  ash_arena: ['healing_pill', 'focus_incense', 'armor_patch'],
  dream_archive: ['healing_pill', 'focus_incense', 'armor_patch'],
  void_citadel: ['healing_pill', 'focus_incense', 'gate_sigil'],
  temporal_observatory: ['healing_pill', 'focus_incense', 'armor_patch'],
  causal_clearinghouse: ['healing_pill', 'focus_incense', 'gate_sigil'],
  entropy_ark: ['thunder_talisman', 'armor_patch', 'healing_pill'],
  mirror_cycle_city: ['healing_pill', 'armor_patch', 'gate_sigil'],
  redaction_scriptorium: ['healing_pill', 'dispel_talisman', 'armor_patch'],
  legacy_auction_court: ['healing_pill', 'focus_incense', 'armor_patch'],
  genesis_vault: ['healing_pill', 'dispel_talisman', 'armor_patch'],
  silent_broadcast_tower: ['healing_pill', 'focus_incense', 'dispel_talisman'],
  lost_shelter: ['healing_pill', 'armor_patch', 'focus_incense'],
  false_testimony_court: ['focus_incense', 'dispel_talisman', 'armor_patch'],
  combat_replay_stage: ['healing_pill', 'dispel_talisman', 'armor_patch'],
  panopticon_city: ['healing_pill', 'focus_incense', 'armor_patch']
};

function cloneEquipmentHuntLootBag(
  bag: NonNullable<GameState['run']>['lootBag']
): EquipmentHuntLootBagEvidence {
  return {
    rewardPoints: bag.rewardPoints,
    lingyun: bag.lingyun,
    items: { ...bag.items },
    equipmentIds: [...bag.equipmentIds]
  };
}

function getEquipmentHuntItemDelta(
  before: EquipmentHuntLootBagEvidence,
  after: EquipmentHuntLootBagEvidence
): Partial<Record<ItemId, number>> {
  const itemIds = new Set<ItemId>([
    ...(Object.keys(before.items) as ItemId[]),
    ...(Object.keys(after.items) as ItemId[])
  ]);
  const delta: Partial<Record<ItemId, number>> = {};
  for (const itemId of itemIds) {
    const change = (after.items[itemId] ?? 0) - (before.items[itemId] ?? 0);
    if (change !== 0) delta[itemId] = change;
  }
  return delta;
}

function isEmptyEquipmentHuntLootBag(bag: EquipmentHuntLootBagEvidence): boolean {
  return (
    bag.rewardPoints === 0 &&
    bag.lingyun === 0 &&
    Object.keys(bag.items).length === 0 &&
    bag.equipmentIds.length === 0
  );
}

function equipmentHuntLootBagsEqual(
  left: EquipmentHuntLootBagEvidence,
  right: EquipmentHuntLootBagEvidence
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function getEquipmentHuntEliteNodeIds(dungeonId: DungeonId): string[] {
  const monsterId = DUNGEON_ELITE_MONSTERS[dungeonId];
  return DUNGEONS[dungeonId].nodes
    .filter((node) => node.type === 'monster' && node.monsterId === monsterId)
    .map((node) => node.id);
}

function createEquipmentHuntEvidence(dungeonId: DungeonId): RouteCombatEvidence {
  return createRouteCombatEvidence({
    autoResolveEquipmentOffers: false,
    scriptedActions: EQUIPMENT_HUNT_SCRIPTED_ACTIONS[dungeonId],
    prioritizeHealing: dungeonId === 'lost_shelter',
    healingTargetRatio: dungeonId === 'lost_shelter' ? 0.65 : undefined
  });
}

function enterEquipmentHuntDungeon(
  fixture: SevenDungeonEquipmentHuntFixture,
  dungeonId: DungeonId,
  evidence: RouteCombatEvidence,
  targetEquipmentId?: EquipmentId
): GameState {
  const mirrorEquipmentIds = (['parallax_visor', 'phaseweave_mantle', 'homecoming_prism'] as const).filter(
    (equipmentId) => equipmentId !== targetEquipmentId
  );
  const baseState = dungeonId === 'panopticon_city'
    ? preparePanopticonEndgameBuild(fixture.state, 220, targetEquipmentId)
    : dungeonId === 'combat_replay_stage'
    ? prepareCombatReplayProtocolBuild(fixture.state, 'standard', 10, targetEquipmentId)
    : dungeonId === 'mirror_cycle_city'
    ? prepareMirrorCycleCityRouteState(fixture.state, mirrorEquipmentIds)
    : dungeonId === 'redaction_scriptorium'
      ? prepareRedactionScriptoriumCombatState(fixture.state)
    : dungeonId === 'entropy_ark' ||
        dungeonId === 'legacy_auction_court' ||
        dungeonId === 'genesis_vault' ||
        dungeonId === 'silent_broadcast_tower' ||
        dungeonId === 'lost_shelter'
      ? prepareDeepRouteBaseState(fixture.state)
      : structuredClone(fixture.state);
  const prepared = targetEquipmentId === undefined
    ? baseState
    : prepareEquipmentHunt(baseState, dungeonId, targetEquipmentId);
  const plannedNodeIds = [
    ...EQUIPMENT_HUNT_DEFINITIONS[dungeonId].clueNodeIds,
    ...getEquipmentHuntEliteNodeIds(dungeonId),
    ...(EQUIPMENT_HUNT_BOSS_LAW_NODES[dungeonId] ?? [])
  ];
  const tacticalItems = EQUIPMENT_HUNT_TACTICAL_ITEMS[dungeonId];
  const entered = enterPreparedDungeon(prepared, dungeonId, evidence, {
    plannedNodeIds,
    methodTechnique: dungeonId === 'combat_replay_stage' ? 'live' : undefined,
    additionalTacticalItemIds: tacticalItems,
    inventoryTargets: Object.fromEntries(tacticalItems.map((itemId) => [itemId, 32]))
  });

  if (targetEquipmentId !== undefined) {
    const hunt = getCurrentEquipmentHuntStatus(entered);
    if (!hunt.enabled || hunt.targetEquipmentId !== targetEquipmentId) {
      throw new BalanceSimulationError(`${dungeonId}: prepareEquipmentHunt did not freeze ${targetEquipmentId} at entry.`);
    }
  }
  return entered;
}

function getEquipmentHuntExcludedNodes(
  state: GameState,
  dungeonId: DungeonId,
  allowedNodeId: string,
  additionalNodeIds: readonly string[] = []
): Set<string> {
  const cleared = new Set(state.run?.clearedNodeIds ?? []);
  return new Set([
    ...getEquipmentHuntEliteNodeIds(dungeonId).filter(
      (nodeId) => nodeId !== allowedNodeId && !cleared.has(nodeId)
    ),
    ...additionalNodeIds.filter((nodeId) => nodeId !== allowedNodeId)
  ]);
}

function moveToEquipmentHuntClue(
  state: GameState,
  dungeonId: DungeonId,
  clueIndex: 0 | 1,
  evidence: RouteCombatEvidence
): { state: GameState; movementCount: number; beforeLoot: EquipmentHuntLootBagEvidence } {
  const definition = EQUIPMENT_HUNT_DEFINITIONS[dungeonId];
  const clueNodeId = definition.clueNodeIds[clueIndex];
  const otherClueNodeId = definition.clueNodeIds[clueIndex === 0 ? 1 : 0];

  // The side bench is intentionally behind the arena's art-opening gate.
  let nextState = state;
  if (dungeonId === 'genesis_vault' && clueNodeId === 'south_serum_cache') {
    const autoResolveEquipmentOffers = evidence.autoResolveEquipmentOffers;
    evidence.autoResolveEquipmentOffers = true;
    try {
      nextState = prepareGenesisVaultSpliceApproach(state, evidence, {
        excludedNodeIds: new Set([clueNodeId, 'mutation_guardian_omega'])
      });
    } finally {
      evidence.autoResolveEquipmentOffers = autoResolveEquipmentOffers;
    }
  }
  if (dungeonId === 'ash_arena' && clueNodeId === 'side_bench_supplies') {
    const lawNodeId = 'ember_pit_duelist';
    nextState = moveAlongRoutePath(nextState, lawNodeId, evidence, {
      excludedNodeIds: getEquipmentHuntExcludedNodes(
        nextState,
        dungeonId,
        lawNodeId,
        [...definition.clueNodeIds]
      )
    });
  }

  const atClue = moveAlongRoutePath(nextState, clueNodeId, evidence, {
    excludedNodeIds: getEquipmentHuntExcludedNodes(
      nextState,
      dungeonId,
      clueNodeId,
      [otherClueNodeId]
    ),
    collectTargetReward: false
  });
  if (!atClue.run || atClue.run.currentNodeId !== clueNodeId) {
    throw new BalanceSimulationError(`${dungeonId}: did not reach equipment hunt clue ${clueNodeId}.`);
  }
  if (atClue.run.clearedNodeIds.includes(clueNodeId)) {
    throw new BalanceSimulationError(`${dungeonId}: clue ${clueNodeId} was collected before collectReward.`);
  }

  return {
    state: atClue,
    movementCount: evidence.routeMovements.length,
    beforeLoot: cloneEquipmentHuntLootBag(atClue.run.lootBag)
  };
}

function collectEquipmentHuntClue(
  state: GameState,
  dungeonId: DungeonId,
  clueNodeId: string,
  evidence: RouteCombatEvidence,
  expectQualified = true
): GameState {
  const collected = collectCurrentRouteReward(state, evidence);
  const status = getCurrentEquipmentHuntStatus(collected);
  if (
    !collected.run?.clearedNodeIds.includes(clueNodeId) ||
    !status.cleared ||
    (expectQualified && !status.qualified) ||
    (!expectQualified && status.qualified) ||
    status.clueNodes.find((node) => node.nodeId === clueNodeId)?.cleared !== true
  ) {
    throw new BalanceSimulationError(`${dungeonId}: collectReward did not qualify clue ${clueNodeId}.`);
  }
  return collected;
}

function findFirstReachableEquipmentHuntElite(
  state: GameState,
  dungeonId: DungeonId,
  evidence: RouteCombatEvidence,
  avoidedNodeIds: readonly string[] = [],
  candidateNodeIds: readonly string[] = getEquipmentHuntEliteNodeIds(dungeonId)
): { nodeId: string; excludedNodeIds: Set<string> } {
  for (const nodeId of candidateNodeIds) {
    const excludedNodeIds = getEquipmentHuntExcludedNodes(
      state,
      dungeonId,
      nodeId,
      avoidedNodeIds
    );
    try {
      findAdjacentRoutePath(state, nodeId, evidence, excludedNodeIds);
      return { nodeId, excludedNodeIds };
    } catch {
      // Try the next same-monster host when a live law gate closes this candidate.
    }
  }
  throw new BalanceSimulationError(`${dungeonId}: no elite host is legally reachable without an earlier equipment offer.`);
}

function createEquipmentHuntOfferEvidence(
  state: GameState,
  targetEquipmentId: EquipmentId,
  checkpoint: string
): EquipmentHuntOfferEvidence {
  const offer = state.run?.pendingEquipmentOffer;
  if (!state.run || !offer) {
    throw new BalanceSimulationError(`${checkpoint}: elite victory did not create a pending equipment offer.`);
  }
  const evidence: EquipmentHuntOfferEvidence = {
    offerId: offer.offerId,
    equipmentIds: [...offer.equipmentIds],
    guaranteedEquipmentId: offer.guaranteedEquipmentId,
    targetFirst: offer.equipmentIds[0] === targetEquipmentId,
    targetOccurrenceCount: offer.equipmentIds.filter((equipmentId) => equipmentId === targetEquipmentId).length,
    lootOffersMade: state.run.lootOffersMade
  };
  if (
    !evidence.targetFirst ||
    evidence.targetOccurrenceCount !== 1 ||
    evidence.guaranteedEquipmentId !== targetEquipmentId ||
    evidence.lootOffersMade !== 1
  ) {
    throw new BalanceSimulationError(`${checkpoint}: target ${targetEquipmentId} was not the unique guaranteed first offer.`);
  }
  return evidence;
}

function runEquipmentHuntToOffer(
  fixture: SevenDungeonEquipmentHuntFixture,
  dungeonId: DungeonId,
  clueIndex: 0 | 1
): EquipmentHuntRouteExecution {
  const definition = EQUIPMENT_HUNT_DEFINITIONS[dungeonId];
  const clueNodeId = definition.clueNodeIds[clueIndex];
  const targetEquipmentId = fixture.targets[dungeonId];
  const host = DUNGEONS[dungeonId].nodes.find((node) => node.id === clueNodeId);
  const rewardHostExists = host?.type === 'reward' && host.reward !== undefined;
  const clueDefinitionMatchesHost = host?.equipmentHuntClueId === definition.id;
  if (!rewardHostExists || !clueDefinitionMatchesHost) {
    throw new BalanceSimulationError(`${dungeonId}: clue ${clueNodeId} is not a matching reward host.`);
  }

  const evidence = createEquipmentHuntEvidence(dungeonId);
  const entered = enterEquipmentHuntDungeon(fixture, dungeonId, evidence, targetEquipmentId);
  const startNodeId = entered.run?.currentNodeId;
  if (startNodeId !== DUNGEONS[dungeonId].grid.startNodeId) {
    throw new BalanceSimulationError(`${dungeonId}: equipment hunt did not start at the real dungeon start node.`);
  }

  const clueRoute = moveToEquipmentHuntClue(entered, dungeonId, clueIndex, evidence);
  const collected = collectEquipmentHuntClue(clueRoute.state, dungeonId, clueNodeId, evidence);
  if (!collected.run) throw new BalanceSimulationError(`${dungeonId}: clue collection ended the run.`);
  const afterClueLoot = cloneEquipmentHuntLootBag(collected.run.lootBag);
  const huntBeforeElite = getCurrentEquipmentHuntStatus(collected);
  const lootOffersBeforeElite = collected.run.lootOffersMade;
  const eliteSearchState = dungeonId === 'false_testimony_court'
    ? prepareFalseTestimonyCourtApproach(
        collected,
        'judgment_lock',
        evidence,
        new Set([definition.clueNodeIds[clueIndex === 0 ? 1 : 0]])
      )
    : collected;
  const eliteRoute = findFirstReachableEquipmentHuntElite(
    eliteSearchState,
    dungeonId,
    evidence,
    [definition.clueNodeIds[clueIndex === 0 ? 1 : 0]]
  );
  const offered = moveAlongRoutePath(eliteSearchState, eliteRoute.nodeId, evidence, {
    excludedNodeIds: eliteRoute.excludedNodeIds,
    collectTargetReward: false
  });
  const offer = createEquipmentHuntOfferEvidence(
    offered,
    targetEquipmentId,
    `${dungeonId}/${clueNodeId}/${eliteRoute.nodeId}`
  );

  return {
    state: offered,
    evidence,
    coverage: {
      dungeonId,
      clueIndex,
      clueNodeId,
      targetEquipmentId,
      startNodeId,
      eliteNodeId: eliteRoute.nodeId,
      rewardHostExists,
      clueDefinitionMatchesHost,
      clueCollected: offered.run?.clearedNodeIds.includes(clueNodeId) ?? false,
      qualifiedBeforeElite: huntBeforeElite.qualified,
      lootOffersBeforeElite,
      eliteMatchesDungeonDefinition:
        DUNGEONS[dungeonId].nodes.find((node) => node.id === eliteRoute.nodeId)?.monsterId ===
        DUNGEON_ELITE_MONSTERS[dungeonId],
      startToClueMovementCount: clueRoute.movementCount,
      clueToEliteMovementCount: evidence.routeMovements.length - clueRoute.movementCount,
      clueRewardPointsGained: afterClueLoot.rewardPoints - clueRoute.beforeLoot.rewardPoints,
      clueLingyunGained: afterClueLoot.lingyun - clueRoute.beforeLoot.lingyun,
      clueItemDelta: getEquipmentHuntItemDelta(clueRoute.beforeLoot, afterClueLoot),
      offer,
      focusTrace: structuredClone(evidence.focusTrace),
      routeEvidence: getRouteLegalityEvidence(evidence)
    }
  };
}

function prepareEquipmentHuntBossLaw(
  state: GameState,
  dungeonId: DungeonId,
  evidence: RouteCombatEvidence
): GameState {
  let nextState = state;
  for (const nodeId of EQUIPMENT_HUNT_BOSS_LAW_NODES[dungeonId] ?? []) {
    if (nextState.run?.clearedNodeIds.includes(nodeId)) continue;
    nextState = moveAlongRoutePath(nextState, nodeId, evidence);
  }
  return dungeonId === 'combat_replay_stage'
    ? prepareCombatReplayBossRoute(nextState, evidence)
    : nextState;
}

function settleEquipmentHuntRoute(
  execution: EquipmentHuntRouteExecution
): SevenDungeonEquipmentHuntSummary {
  const { dungeonId, clueIndex, clueNodeId, targetEquipmentId, eliteNodeId, offer } = execution.coverage;
  const targetOwnedBeforeSelection = execution.state.ownedEquipment.includes(targetEquipmentId);
  let selected = resolveEquipmentLoot(execution.state, targetEquipmentId);
  const targetOwnedAfterSelection = selected.ownedEquipment.includes(targetEquipmentId);
  if (
    selected.run?.pendingEquipmentOffer ||
    !selected.run?.lootBag.equipmentIds.includes(targetEquipmentId) ||
    targetOwnedBeforeSelection ||
    targetOwnedAfterSelection
  ) {
    throw new BalanceSimulationError(`${dungeonId}: resolveEquipmentLoot did not keep ${targetEquipmentId} pending in the run bag.`);
  }

  selected = prepareEquipmentHuntBossLaw(selected, dungeonId, execution.evidence);
  const bossNodeId = getBossDefinition(dungeonId).nodeId;
  selected = collectBossRouteRecovery(selected, dungeonId, execution.evidence);
  const bossCleared = moveAlongRoutePath(selected, bossNodeId, execution.evidence);
  assertBossSealCleared(bossCleared, dungeonId, 'during equipment hunt settlement');
  const exitNodeId = DUNGEONS[dungeonId].nodes.find((node) => node.type === 'exit')?.id;
  if (!exitNodeId) throw new BalanceSimulationError(`${dungeonId}: equipment hunt settlement has no exit.`);
  const exitReady = moveAlongRoutePath(bossCleared, exitNodeId, execution.evidence);
  if (!exitReady.run) throw new BalanceSimulationError(`${dungeonId}: equipment hunt run ended before exit.`);

  const lootBagBeforeExit = cloneEquipmentHuntLootBag(exitReady.run.lootBag);
  const targetOwnedBeforeExit = exitReady.ownedEquipment.includes(targetEquipmentId);
  const targetLevelBeforeExit = exitReady.equipmentLevels[targetEquipmentId];
  const targetInLootBagBeforeExit =
    lootBagBeforeExit.equipmentIds.filter((equipmentId) => equipmentId === targetEquipmentId).length === 1;
  const settledState = resolveExit(exitReady);
  const settlement = settledState.run?.lastLootSettlement;
  if (!settlement) throw new BalanceSimulationError(`${dungeonId}: resolveExit did not create a loot settlement.`);
  const retainedSettlement = cloneEquipmentHuntLootBag(settlement.retained);
  const lostSettlement = cloneEquipmentHuntLootBag(settlement.lost);
  const lootBagAfterExit = cloneEquipmentHuntLootBag(settledState.run!.lootBag);
  const targetOwnedAfterExit = settledState.ownedEquipment.includes(targetEquipmentId);
  const targetLevelAfterExit = settledState.equipmentLevels[targetEquipmentId];
  const exitCleared = settledState.run?.clearedNodeIds.includes(exitNodeId) ?? false;
  const settled =
    settledState.phase === 'result' &&
    !targetOwnedBeforeExit &&
    targetLevelBeforeExit === undefined &&
    targetInLootBagBeforeExit &&
    targetOwnedAfterExit &&
    targetLevelAfterExit === 1 &&
    equipmentHuntLootBagsEqual(lootBagBeforeExit, retainedSettlement) &&
    isEmptyEquipmentHuntLootBag(lostSettlement) &&
    isEmptyEquipmentHuntLootBag(lootBagAfterExit) &&
    exitCleared;
  if (!settled) {
    throw new BalanceSimulationError(`${dungeonId}: target ${targetEquipmentId} did not settle only after a real clear.`);
  }

  return {
    tier: DUNGEONS[dungeonId].tier,
    dungeonId,
    dungeonName: DUNGEONS[dungeonId].name,
    targetEquipmentId,
    clueIndex,
    clueNodeId,
    eliteNodeId,
    bossNodeId,
    exitNodeId,
    offer,
    targetOwnedBeforeSelection,
    targetOwnedAfterSelection,
    targetOwnedBeforeExit,
    targetLevelBeforeExit,
    targetInLootBagBeforeExit,
    bossClearedBeforeExit: exitReady.run.clearedNodeIds.includes(bossNodeId),
    lootBagBeforeExit,
    retainedSettlement,
    lostSettlement,
    lootBagAfterExit,
    targetOwnedAfterExit,
    targetLevelAfterExit,
    exitCleared,
    settled,
    routeEvidence: getRouteLegalityEvidence(execution.evidence)
  };
}

export function createSevenDungeonEquipmentHuntFixture(): SevenDungeonEquipmentHuntFixture {
  const fieldSurveyState = structuredClone(createSevenDungeonFieldSurveyFixture().state);
  let state: GameState = {
    ...fieldSurveyState,
    inventory: {
      ...fieldSurveyState.inventory,
      healing_pill: 32,
      dispel_talisman: 32,
      gate_sigil: 32,
      armor_patch: 32,
      focus_incense: 32,
      demon_bone: 12,
      star_iron: 12,
      method_page: 12,
      cracked_core: 12,
      rift_dust: 12
    }
  };
  const methodIds: MethodId[] = [
    'mist_breathing',
    'iron_body',
    'cloud_step',
    'gate_sense',
    'star_core_method',
    'beast_taming',
    'void_heart'
  ];
  for (const methodId of methodIds) state = learnMethod(state, methodId);
  for (const petId of ['contract_sprite', 'starling_drone'] as const) {
    state = buyPet(state, petId);
    if (upgradePet) {
      for (let level = state.petLevels[petId] ?? 1; level < 3; level += 1) {
        state = upgradePet(state, petId);
      }
    }
  }
  state = activatePet(state, 'starling_drone');
  state = prepareGenesisRepeatHubState(state);
  const targets = {} as Record<DungeonId, EquipmentId>;
  for (const dungeonId of DUNGEON_ORDER) {
    const target = DUNGEON_EQUIPMENT_POOLS[dungeonId].find(
      (equipmentId) => !state.ownedEquipment.includes(equipmentId)
    );
    if (!target) throw new BalanceSimulationError(`${dungeonId}: equipment hunt fixture owns the entire dungeon pool.`);
    targets[dungeonId] = target;
  }
  return { state, targets };
}

function createOrdinaryEquipmentOfferGuards(
  fixture: SevenDungeonEquipmentHuntFixture
): Pick<
  EquipmentHuntGuardEvidence,
  'ordinaryOfferMatchesRealApi' | 'ordinaryOfferHasNoGuarantee'
> {
  const dungeonId: DungeonId = 'demon_tower_1';
  const evidence = createEquipmentHuntEvidence(dungeonId);
  const entered = enterEquipmentHuntDungeon(fixture, dungeonId, evidence);
  const definition = EQUIPMENT_HUNT_DEFINITIONS[dungeonId];
  const elite = findFirstReachableEquipmentHuntElite(
    entered,
    dungeonId,
    evidence,
    [...definition.clueNodeIds]
  );
  const offered = moveAlongRoutePath(entered, elite.nodeId, evidence, {
    excludedNodeIds: elite.excludedNodeIds,
    collectTargetReward: false
  });
  const actual = offered.run?.pendingEquipmentOffer;
  const expected = getDungeonLootOffer({
    dungeonId,
    monsterId: DUNGEON_ELITE_MONSTERS[dungeonId],
    nodeId: elite.nodeId,
    ownedEquipmentIds: offered.ownedEquipment,
    carriedEquipmentIds: offered.run?.lootBag.equipmentIds ?? [],
    offersMade: 0
  });
  return {
    ordinaryOfferMatchesRealApi: JSON.stringify(actual) === JSON.stringify(expected),
    ordinaryOfferHasNoGuarantee:
      actual !== undefined &&
      'equipmentIds' in (expected ?? {}) &&
      actual.guaranteedEquipmentId === undefined
  };
}

function createEliteBeforeClueGuards(
  fixture: SevenDungeonEquipmentHuntFixture
): Pick<
  EquipmentHuntGuardEvidence,
  'eliteBeforeClueHasNoGuarantee' | 'clueAfterEliteDoesNotBackfill'
> {
  const dungeonId: DungeonId = 'demon_tower_1';
  const targetEquipmentId = fixture.targets[dungeonId];
  const definition = EQUIPMENT_HUNT_DEFINITIONS[dungeonId];
  const evidence = createEquipmentHuntEvidence(dungeonId);
  const entered = enterEquipmentHuntDungeon(fixture, dungeonId, evidence, targetEquipmentId);
  const firstElite = findFirstReachableEquipmentHuntElite(
    entered,
    dungeonId,
    evidence,
    [...definition.clueNodeIds]
  );
  const earlyOfferState = moveAlongRoutePath(entered, firstElite.nodeId, evidence, {
    excludedNodeIds: firstElite.excludedNodeIds,
    collectTargetReward: false
  });
  const earlyOffer = earlyOfferState.run?.pendingEquipmentOffer;
  const eliteBeforeClueHasNoGuarantee =
    earlyOffer !== undefined && earlyOffer.guaranteedEquipmentId === undefined;
  const declined = resolveEquipmentLoot(earlyOfferState);
  const clueRoute = moveToEquipmentHuntClue(declined, dungeonId, 0, evidence);
  const collected = collectEquipmentHuntClue(
    clueRoute.state,
    dungeonId,
    definition.clueNodeIds[0],
    evidence,
    false
  );
  const statusAfterClue = getCurrentEquipmentHuntStatus(collected);
  const laterEliteIds = getEquipmentHuntEliteNodeIds(dungeonId).filter(
    (nodeId) => nodeId !== firstElite.nodeId
  );
  const laterElite = findFirstReachableEquipmentHuntElite(
    collected,
    dungeonId,
    evidence,
    [definition.clueNodeIds[1]],
    laterEliteIds
  );
  const afterLaterElite = moveAlongRoutePath(collected, laterElite.nodeId, evidence, {
    excludedNodeIds: laterElite.excludedNodeIds,
    collectTargetReward: false
  });
  const clueAfterEliteDoesNotBackfill =
    statusAfterClue.cleared &&
    !statusAfterClue.qualified &&
    statusAfterClue.passed &&
    afterLaterElite.run?.lootOffersMade === 1 &&
    afterLaterElite.run.pendingEquipmentOffer === undefined &&
    !afterLaterElite.run.lootBag.equipmentIds.includes(targetEquipmentId);

  return { eliteBeforeClueHasNoGuarantee, clueAfterEliteDoesNotBackfill };
}

function createPortalCrossingEquipmentHuntGuard(
  fixture: SevenDungeonEquipmentHuntFixture
): boolean {
  const dungeonId: DungeonId = 'starfall_mine';
  const targetEquipmentId = fixture.targets[dungeonId];
  const evidence = createEquipmentHuntEvidence(dungeonId);
  const entered = enterEquipmentHuntDungeon(fixture, dungeonId, evidence, targetEquipmentId);
  const clueRoute = moveToEquipmentHuntClue(entered, dungeonId, 0, evidence);
  let state = collectEquipmentHuntClue(
    clueRoute.state,
    dungeonId,
    EQUIPMENT_HUNT_DEFINITIONS[dungeonId].clueNodeIds[0],
    evidence
  );
  const portalNodeId = 'backup_gravity_well';
  state = moveAlongRoutePath(state, portalNodeId, evidence, {
    excludedNodeIds: getEquipmentHuntExcludedNodes(
      state,
      dungeonId,
      portalNodeId,
      [EQUIPMENT_HUNT_DEFINITIONS[dungeonId].clueNodeIds[1]]
    ),
    collectTargetReward: false
  });
  const crossed = useTrackedPortal(state, portalNodeId, evidence);
  const crossedStatus = getCurrentEquipmentHuntStatus(crossed);
  const destinationDungeonId = crossed.run?.dungeonId;
  if (destinationDungeonId !== 'rust_hospital') {
    throw new BalanceSimulationError('Equipment hunt portal guard did not reach rust_hospital through usePortal.');
  }
  const destinationElite = findFirstReachableEquipmentHuntElite(
    crossed,
    destinationDungeonId,
    evidence,
    [...EQUIPMENT_HUNT_DEFINITIONS[destinationDungeonId].clueNodeIds]
  );
  const offered = moveAlongRoutePath(crossed, destinationElite.nodeId, evidence, {
    excludedNodeIds: destinationElite.excludedNodeIds,
    collectTargetReward: false
  });
  const offer = offered.run?.pendingEquipmentOffer;
  return (
    crossedStatus.crossed &&
    crossedStatus.passed &&
    !crossedStatus.qualified &&
    offer !== undefined &&
    offer.guaranteedEquipmentId === undefined &&
    !offer.equipmentIds.includes(targetEquipmentId)
  );
}

function createUncollectedClueEquipmentHuntGuard(
  fixture: SevenDungeonEquipmentHuntFixture
): boolean {
  const dungeonId: DungeonId = 'demon_tower_1';
  const clueNodeId = EQUIPMENT_HUNT_DEFINITIONS[dungeonId].clueNodeIds[0];
  const evidence = createEquipmentHuntEvidence(dungeonId);
  const entered = enterEquipmentHuntDungeon(
    fixture,
    dungeonId,
    evidence,
    fixture.targets[dungeonId]
  );
  const atClue = moveToEquipmentHuntClue(entered, dungeonId, 0, evidence).state;
  const status = getCurrentEquipmentHuntStatus(atClue);
  return (
    atClue.run?.currentNodeId === clueNodeId &&
    !atClue.run.clearedNodeIds.includes(clueNodeId) &&
    !status.cleared &&
    !status.qualified &&
    atClue.run.lootOffersMade === 0
  );
}

function selectedTargetIsLost(
  execution: EquipmentHuntRouteExecution,
  exit: 'retreat' | 'failure'
): boolean {
  const targetEquipmentId = execution.coverage.targetEquipmentId;
  const selected = resolveEquipmentLoot(execution.state, targetEquipmentId);
  const settled = exit === 'retreat'
    ? resolveRetreat(selected)
    : resolveRunFailure(selected, 'equipment hunt explicit failure guard');
  const settlement = settled.run?.lastLootSettlement;
  return (
    settlement !== undefined &&
    !settled.ownedEquipment.includes(targetEquipmentId) &&
    !settlement.retained.equipmentIds.includes(targetEquipmentId) &&
    settlement.lost.equipmentIds.filter((equipmentId) => equipmentId === targetEquipmentId).length === 1 &&
    settled.run?.lootBag.equipmentIds.length === 0
  );
}

function createEquipmentHuntGuardEvidence(
  fixture: SevenDungeonEquipmentHuntFixture
): Omit<EquipmentHuntGuardEvidence, 'fixtureUnchanged'> {
  const ordinary = createOrdinaryEquipmentOfferGuards(fixture);
  const eliteBeforeClue = createEliteBeforeClueGuards(fixture);
  return {
    ...ordinary,
    ...eliteBeforeClue,
    portalCrossingInvalidatesHunt: createPortalCrossingEquipmentHuntGuard(fixture),
    uncollectedClueDoesNotQualify: createUncollectedClueEquipmentHuntGuard(fixture),
    retreatLosesSelectedTarget: selectedTargetIsLost(
      runEquipmentHuntToOffer(fixture, 'demon_tower_1', 0),
      'retreat'
    ),
    failureLosesSelectedTarget: selectedTargetIsLost(
      runEquipmentHuntToOffer(fixture, 'metro_abyss', 1),
      'failure'
    )
  };
}

export function simulateSevenDungeonEquipmentHuntRoute(): SevenDungeonEquipmentHuntRouteResult {
  const fixture = createSevenDungeonEquipmentHuntFixture();
  const fixtureSnapshot = structuredClone(fixture);
  const executions = DUNGEON_ORDER.flatMap((dungeonId) =>
    ([0, 1] as const).map((clueIndex) => runEquipmentHuntToOffer(fixture, dungeonId, clueIndex))
  );
  const clueRoutes = executions.map((execution) => execution.coverage);
  const selectedExecutions = DUNGEON_ORDER.map((dungeonId, index) => {
    const clueIndex = (index % 2) as 0 | 1;
    const execution = executions.find(
      (candidate) =>
        candidate.coverage.dungeonId === dungeonId && candidate.coverage.clueIndex === clueIndex
    );
    if (!execution) throw new BalanceSimulationError(`${dungeonId}: alternating equipment hunt route is missing.`);
    return execution;
  });
  const summaries = selectedExecutions.map(settleEquipmentHuntRoute);
  const usedClueIndexes = [...new Set(summaries.map((summary) => summary.clueIndex))].sort() as Array<0 | 1>;
  const guardsWithoutFixture = createEquipmentHuntGuardEvidence(fixture);
  const fixtureUnchanged = JSON.stringify(fixture) === JSON.stringify(fixtureSnapshot);
  const definedClueCount = DUNGEON_ORDER.reduce(
    (count, dungeonId) => count + EQUIPMENT_HUNT_DEFINITIONS[dungeonId].clueNodeIds.length,
    0
  );

  if (
    clueRoutes.length !== definedClueCount ||
    summaries.length !== DUNGEON_ORDER.length ||
    usedClueIndexes.join(',') !== '0,1' ||
    !fixtureUnchanged
  ) {
    throw new BalanceSimulationError(
      `Equipment hunt coverage incomplete: clues=${clueRoutes.length}/${definedClueCount}, ` +
        `settled=${summaries.length}, clueIndexes=${usedClueIndexes.join(',')}, fixtureUnchanged=${fixtureUnchanged}.`
    );
  }

  return {
    fixture,
    targets: { ...fixture.targets },
    coverage: {
      dungeonIds: summaries.map((summary) => summary.dungeonId),
      dungeonCount: summaries.length,
      definedClueCount,
      validatedClueRouteCount: clueRoutes.length,
      settledHuntCount: summaries.filter((summary) => summary.settled).length,
      usedClueIndexes,
      usedClueNodeIds: summaries.map((summary) => summary.clueNodeId)
    },
    clueRoutes,
    summaries,
    guards: {
      ...guardsWithoutFixture,
      fixtureUnchanged
    }
  };
}

export type EquipmentMemoryHuntSignalOrder = 'event-first' | 'clear-first';

export type EquipmentMemoryEconomySnapshot = Readonly<{
  rewardPoints: number;
  lingyun: number;
  inventory: Readonly<Record<ItemId, number>>;
}>;

export type EquipmentMemoryHuntBaselineEvidence = Readonly<{
  targetEquipmentId: EquipmentMemoryEquipmentId;
  owned: boolean;
  equipped: boolean;
  level: number;
  maxLevel: number;
  attunementId: EquipmentAttunementId | undefined;
  temperRank: number;
  sealed: boolean;
  completedDungeonIds: readonly DungeonId[];
  eligibleDungeonIds: readonly DungeonId[];
}>;

export type EightDungeonEquipmentMemoryHuntSummary = Readonly<{
  tier: number;
  dungeonId: DungeonId;
  dungeonName: string;
  targetEquipmentId: EquipmentMemoryEquipmentId;
  memoryId: EquipmentMemoryId;
  eventId: string;
  nodeId: string;
  signalOrder: EquipmentMemoryHuntSignalOrder;
  eventOptionId: string;
  statusAfterFirstSignal: string | undefined;
  statusBeforeExit: string | undefined;
  statusAfterExit: string | undefined;
  nodeCleared: boolean;
  eventSucceeded: boolean;
  bossNodeId: string;
  bossNodeCleared: boolean;
  exitNodeId: string;
  exitNodeCleared: boolean;
  settlement: EquipmentMemoryHuntSettlement | undefined;
  unlockedMemoryIdsAfter: readonly EquipmentMemoryId[];
  activeMemoryIdAfter: EquipmentMemoryId | undefined;
  economy: Readonly<{
    hunt: EquipmentMemoryEconomySnapshot;
    control: EquipmentMemoryEconomySnapshot;
    matchesControl: boolean;
  }>;
  deterministicRoute: boolean;
  routeEvidence: RouteLegalityEvidence;
}>;

export type EquipmentMemoryCombatTransitionEvidence = Readonly<{
  dungeonId: DungeonId;
  nodeId: string;
  action: CombatAction;
  actionSequence: readonly CombatAction[];
  beforeFocus: number;
  afterFocus: number;
  matchingEquipmentIds: readonly EquipmentMemoryEquipmentId[];
  overflowStoredBefore: boolean;
  overflowStoredAfter: boolean;
  restoredBefore: boolean;
  restoredAfter: boolean;
  combatContinued: boolean;
}>;

export type EquipmentMemoryCombatGuardEvidence = Readonly<{
  regularOverflow: EquipmentMemoryCombatTransitionEvidence;
  recommendedOverflow: EquipmentMemoryCombatTransitionEvidence;
  nonLethalWeaponSkillRestore: EquipmentMemoryCombatTransitionEvidence;
  oncePerCombat: Readonly<{
    secondOverflowStored: boolean;
    restoredStillMarked: boolean;
  }>;
  nonMatching: Readonly<{
    dungeonId: DungeonId;
    matchingEquipmentIds: readonly EquipmentMemoryEquipmentId[];
    memoryEnabled: boolean;
    focusAfterWeaponSkill: number;
    restored: boolean;
  }>;
  multipleMatching: Readonly<{
    dungeonId: DungeonId;
    matchingEquipmentIds: readonly EquipmentMemoryEquipmentId[];
    overflowStored: boolean;
    focusAfterWeaponSkill: number;
    restored: boolean;
  }>;
}>;

export type EquipmentMemoryHuntGuardEvidence = Readonly<{
  eventFailure: Readonly<{
    dungeonId: DungeonId;
    eventOptionId: string;
    status: string | undefined;
    reason: string | undefined;
    permanentAfterNodeClear: boolean;
  }>;
  incompleteExit: Readonly<{
    dungeonId: DungeonId;
    nodeCleared: boolean;
    eventSucceeded: boolean;
    status: string | undefined;
    reason: string | undefined;
    granted: boolean;
  }>;
  crossDungeonPortal: Readonly<{
    sourceDungeonId: DungeonId;
    targetDungeonId: DungeonId | undefined;
    status: string | undefined;
    reason: string | undefined;
    granted: boolean;
  }>;
  preparationConflict: Readonly<{
    ordinaryBlocksMemory: boolean;
    memoryBlocksOrdinary: boolean;
    issueCode: string | undefined;
  }>;
  routeContractParallel: Readonly<{
    dungeonId: DungeonId;
    contractId: string;
    memoryHuntActive: boolean;
    routeContractActive: boolean;
  }>;
  combat: EquipmentMemoryCombatGuardEvidence;
}>;

export type EightDungeonEquipmentMemoryHuntsResult = Readonly<{
  baseState: GameState;
  finalState: GameState;
  baseline: EquipmentMemoryHuntBaselineEvidence;
  summaries: readonly EightDungeonEquipmentMemoryHuntSummary[];
  coverage: Readonly<{
    dungeonIds: readonly DungeonId[];
    dungeonCount: number;
    bankedCount: number;
    signalOrders: readonly EquipmentMemoryHuntSignalOrder[];
    finalUnlockedMemoryIds: readonly EquipmentMemoryId[];
    finalActiveMemoryId: EquipmentMemoryId | undefined;
    deterministic: boolean;
  }>;
  guards: EquipmentMemoryHuntGuardEvidence;
}>;

type EquipmentMemoryChapterExecution = Readonly<{
  state: GameState;
  eventOptionId: string;
  statusAfterFirstSignal: string | undefined;
  nodeCleared: boolean;
  eventSucceeded: boolean;
  statusBeforeExit: string | undefined;
  statusAfterExit: string | undefined;
  settlement: EquipmentMemoryHuntSettlement | undefined;
  bossNodeId: string;
  exitNodeId: string;
  evidence: RouteCombatEvidence;
}>;

type EquipmentMemoryOverflowExecution = Readonly<{
  before: GameState;
  after: GameState;
  action: CombatAction;
  actionSequence: readonly CombatAction[];
  weaponSkillAfter?: GameState;
}>;

const EQUIPMENT_MEMORY_PRIMARY_TARGET = 'guardian_plate' as const;
const EQUIPMENT_MEMORY_SECONDARY_TARGET = 'guardian_gauntlets' as const;
const EQUIPMENT_MEMORY_COMBAT_ACTIONS = ['attack', 'art', 'guard'] as const satisfies readonly CombatAction[];

function supplyEquipmentMemoryFixture(state: GameState): GameState {
  const inventory = { ...state.inventory };
  for (const itemId of Object.keys(inventory) as ItemId[]) {
    inventory[itemId] = Math.max(inventory[itemId], 64);
  }
  return {
    ...state,
    rewardPoints: Math.max(state.rewardPoints, 100_000),
    lingyun: Math.max(state.lingyun, 128),
    inventory
  };
}

function matureEquipmentMemoryTarget(
  state: GameState,
  equipmentId: EquipmentMemoryEquipmentId,
  attunementId: EquipmentAttunementId
): GameState {
  let nextState = state;
  if (!nextState.ownedEquipment.includes(equipmentId)) {
    nextState = buyEquipment(nextState, equipmentId);
  }
  if (!nextState.ownedEquipment.includes(equipmentId)) {
    throw new BalanceSimulationError(`Unable to buy equipment memory target ${equipmentId}.`);
  }

  while ((nextState.equipmentLevels[equipmentId] ?? 1) < EQUIPMENT[equipmentId].maxLevel) {
    const beforeLevel = nextState.equipmentLevels[equipmentId] ?? 1;
    nextState = upgradeEquipment(nextState, equipmentId);
    if ((nextState.equipmentLevels[equipmentId] ?? 1) === beforeLevel) {
      throw new BalanceSimulationError(`Unable to max equipment memory target ${equipmentId}.`);
    }
  }

  if (getEquipmentTemperStatus(nextState, equipmentId).currentRank < 1) {
    nextState = temperEquipment(nextState, equipmentId);
  }
  nextState = attuneEquipment(nextState, equipmentId, attunementId);
  while (getEquipmentTemperStatus(nextState, equipmentId).currentRank < 2) {
    const beforeRank = getEquipmentTemperStatus(nextState, equipmentId).currentRank;
    nextState = temperEquipment(nextState, equipmentId);
    if (getEquipmentTemperStatus(nextState, equipmentId).currentRank === beforeRank) {
      throw new BalanceSimulationError(`Unable to temper equipment memory target ${equipmentId} to II.`);
    }
  }
  nextState = equipEquipment(nextState, equipmentId);

  if (
    !Object.values(nextState.equipped).includes(equipmentId) ||
    nextState.equipmentAttunements?.[equipmentId] !== attunementId ||
    getEquipmentTemperStatus(nextState, equipmentId).currentRank !== 2 ||
    isEquipmentCommissionSealed(nextState, equipmentId)
  ) {
    throw new BalanceSimulationError(`Equipment memory target ${equipmentId} did not reach a legal mature baseline.`);
  }
  return nextState;
}

function createEquipmentMemoryHuntFixture(): GameState {
  if (!EQUIPMENT_MEMORY_EQUIPMENT_CATALOG.includes(EQUIPMENT_MEMORY_PRIMARY_TARGET)) {
    throw new BalanceSimulationError('Primary equipment memory target is outside the supported catalog.');
  }
  const campaign = createSevenDungeonEquipmentHuntFixture().state;
  if (campaign.phase !== 'hub' || DUNGEON_ORDER.some((dungeonId) => !campaign.completedDungeonIds.includes(dungeonId))) {
    throw new BalanceSimulationError('Equipment memory fixture requires every campaign chapter completed in the hub.');
  }
  let supplied = supplyEquipmentMemoryFixture(structuredClone(campaign));
  supplied = buyEquipment(supplied, 'anonymous_veil');
  if (!supplied.ownedEquipment.includes('anonymous_veil')) {
    throw new BalanceSimulationError('Equipment memory fixture could not acquire anonymous_veil for Tier 13 testimony.');
  }
  return matureEquipmentMemoryTarget(
    supplied,
    EQUIPMENT_MEMORY_PRIMARY_TARGET,
    'forge_overdrive'
  );
}

function getEquipmentMemoryBaselineEvidence(state: GameState): EquipmentMemoryHuntBaselineEvidence {
  const equipmentId = EQUIPMENT_MEMORY_PRIMARY_TARGET;
  const eligibleDungeonIds = DUNGEON_ORDER.filter((dungeonId) => {
    return getEquipmentMemoryHuntPreparationStatus(state, dungeonId).candidates.some(
      (candidate) => candidate.equipmentId === equipmentId && candidate.available
    );
  });
  return {
    targetEquipmentId: equipmentId,
    owned: state.ownedEquipment.includes(equipmentId),
    equipped: Object.values(state.equipped).includes(equipmentId),
    level: state.equipmentLevels[equipmentId] ?? 1,
    maxLevel: EQUIPMENT[equipmentId].maxLevel,
    attunementId: state.equipmentAttunements?.[equipmentId],
    temperRank: getEquipmentTemperStatus(state, equipmentId).currentRank,
    sealed: isEquipmentCommissionSealed(state, equipmentId),
    completedDungeonIds: [...state.completedDungeonIds],
    eligibleDungeonIds
  };
}

function getEquipmentMemoryEconomySnapshot(state: GameState): EquipmentMemoryEconomySnapshot {
  return {
    rewardPoints: state.rewardPoints,
    lingyun: state.lingyun,
    inventory: { ...state.inventory }
  };
}

function equipmentMemoryEconomiesEqual(
  left: EquipmentMemoryEconomySnapshot,
  right: EquipmentMemoryEconomySnapshot
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function resolveSuccessfulEquipmentMemoryEvent(
  state: GameState,
  eventId: string
): { state: GameState; optionId: string } {
  const event = getAvailableDungeonEvents(state).find((candidate) => candidate.id === eventId);
  const option = event?.options.find((candidate) => candidate.available && candidate.outcome.success);
  if (!event || !option) {
    throw getDangerResolutionError(
      state,
      state.run?.currentNodeId ?? eventId,
      `no available successful option for equipment memory event ${eventId}`
    );
  }
  const resolved = resolveDungeonEvent(state, eventId, option.id);
  if (!resolved.run?.resolvedEventIds.includes(eventId)) {
    throw getDangerResolutionError(resolved, resolved.run?.currentNodeId ?? eventId, `event ${eventId} did not resolve`);
  }
  return { state: resolved, optionId: option.id };
}

function runEquipmentMemoryChapter(
  baseState: GameState,
  dungeonId: DungeonId,
  equipmentId: EquipmentMemoryEquipmentId,
  signalOrder: EquipmentMemoryHuntSignalOrder,
  enableHunt: boolean
): EquipmentMemoryChapterExecution {
  const definition = EQUIPMENT_MEMORY_CATALOG.find((candidate) => candidate.dungeonId === dungeonId);
  if (!definition) throw new BalanceSimulationError(`${dungeonId}: missing equipment memory definition.`);
  let hubState = dungeonId === 'mirror_cycle_city'
    ? prepareMirrorCycleCityRouteState(baseState)
    : dungeonId === 'panopticon_city'
      ? preparePanopticonEndgameBuild(baseState, 220)
    : dungeonId === 'entropy_ark' ||
      dungeonId === 'legacy_auction_court' ||
      dungeonId === 'combat_replay_stage'
      ? prepareDeepRouteBaseState(baseState)
      : structuredClone(baseState);
  if (dungeonId === 'mirror_cycle_city' && !hubState.ownedEquipment.includes('phaseweave_mantle')) {
    hubState = buyEquipment(hubState, 'phaseweave_mantle');
  }
  hubState = equipEquipment(hubState, equipmentId);
  if (enableHunt) {
    if (dungeonId === 'mirror_cycle_city') hubState = equipEquipment(hubState, equipmentId);
    hubState = prepareEquipmentMemoryHunt(hubState, dungeonId, equipmentId);
    const prepared = getEquipmentMemoryHuntPreparationStatus(hubState, dungeonId).prepared;
    if (prepared?.equipmentId !== equipmentId || prepared.memoryId !== definition.id) {
      throw new BalanceSimulationError(`${dungeonId}: equipment memory preparation did not freeze ${equipmentId}.`);
    }
  }

  const evidence = createRouteCombatEvidence({ prioritizeHealing: true, healingTargetRatio: 0.8 });
  const tacticalItems = EQUIPMENT_HUNT_TACTICAL_ITEMS[dungeonId];
  let state = enterPreparedDungeon(hubState, dungeonId, evidence, {
    plannedNodeIds: [definition.nodeId, ...(EQUIPMENT_HUNT_BOSS_LAW_NODES[dungeonId] ?? [])],
    methodTechnique: dungeonId === 'combat_replay_stage' ? 'live' : undefined,
    additionalTacticalItemIds: tacticalItems,
    inventoryTargets: Object.fromEntries(tacticalItems.map((itemId) => [itemId, 48]))
  });

  if (enableHunt) {
    const entryStatus = getCurrentEquipmentMemoryHuntStatus(state);
    if (!entryStatus.enabled || entryStatus.state?.equipmentId !== equipmentId || entryStatus.state.memoryId !== definition.id) {
      throw new BalanceSimulationError(`${dungeonId}: prepared equipment memory hunt was not active at entry.`);
    }
  }

  let eventOptionId: string;
  let statusAfterFirstSignal: string | undefined;
  const eventNodeId = dungeonId === 'causal_clearinghouse'
    ? 'contradiction_line'
    : dungeonId === 'entropy_ark'
      ? 'wake_inversion'
      : dungeonId === 'mirror_cycle_city'
        ? 'reflection_event_stage'
        : dungeonId === 'redaction_scriptorium'
          ? 'errata_event_stage'
          : dungeonId === 'legacy_auction_court'
            ? 'dead_team_testimony_stage'
          : dungeonId === 'genesis_vault'
            ? 'lineage_event_stage'
          : dungeonId === 'panopticon_city'
            ? 'blindspot_theater'
          : definition.nodeId;
  if (signalOrder === 'event-first') {
    state = moveAlongRoutePath(state, eventNodeId, evidence, {
      collectTargetReward: false,
      resolveTargetDanger: false
    });
    const event = resolveSuccessfulEquipmentMemoryEvent(state, definition.eventId);
    state = event.state;
    eventOptionId = event.optionId;
    statusAfterFirstSignal = enableHunt
      ? getCurrentEquipmentMemoryHuntStatus(state).state?.status
      : undefined;
    state = collectCurrentRouteReward(resolveCurrentDanger(state, evidence), evidence);
    if (eventNodeId !== definition.nodeId) {
      state = moveAlongRoutePath(state, definition.nodeId, evidence);
    }
  } else {
    state = moveAlongRoutePath(state, definition.nodeId, evidence);
    statusAfterFirstSignal = enableHunt
      ? getCurrentEquipmentMemoryHuntStatus(state).state?.status
      : undefined;
    if (eventNodeId !== definition.nodeId) {
      state = moveAlongRoutePath(state, eventNodeId, evidence, {
        collectTargetReward: false,
        resolveTargetDanger: false
      });
    }
    const event = resolveSuccessfulEquipmentMemoryEvent(state, definition.eventId);
    state = event.state;
    eventOptionId = event.optionId;
  }

  const nodeCleared = state.run?.clearedNodeIds.includes(definition.nodeId) ?? false;
  const eventSucceeded = state.run?.resolvedEventIds.includes(definition.eventId) ?? false;
  const statusBeforeExit = enableHunt
    ? getCurrentEquipmentMemoryHuntStatus(state).state?.status
    : undefined;
  if (!nodeCleared || !eventSucceeded || (enableHunt && statusBeforeExit !== 'secured')) {
    throw new BalanceSimulationError(
      `${dungeonId}: equipment memory signals did not secure in ${signalOrder} order.`
    );
  }

  state = prepareEquipmentHuntBossLaw(state, dungeonId, evidence);
  const exitReady = collectRouteRewards(state, dungeonId, evidence);
  const bossNodeId = getBossDefinition(dungeonId).nodeId;
  const exitNodeId = DUNGEONS[dungeonId].nodes.find((node) => node.type === 'exit')?.id;
  if (!exitNodeId) throw new BalanceSimulationError(`${dungeonId}: equipment memory route has no exit.`);
  assertBossSealCleared(exitReady, dungeonId, 'before equipment memory exit');
  const settled = resolvePendingRunRelicArchive(resolveExit(exitReady));
  const huntStatus = getCurrentEquipmentMemoryHuntStatus(settled);
  if (
    settled.phase !== 'result' ||
    !settled.run?.clearedNodeIds.includes(bossNodeId) ||
    !settled.run.clearedNodeIds.includes(exitNodeId) ||
    (enableHunt && (huntStatus.state?.status !== 'banked' || huntStatus.settlement?.granted !== true))
  ) {
    throw new BalanceSimulationError(`${dungeonId}: equipment memory route did not settle through a real boss and exit.`);
  }

  return {
    state: settled,
    eventOptionId,
    statusAfterFirstSignal,
    nodeCleared,
    eventSucceeded,
    statusBeforeExit,
    statusAfterExit: enableHunt ? huntStatus.state?.status : undefined,
    settlement: enableHunt ? huntStatus.settlement : undefined,
    bossNodeId,
    exitNodeId,
    evidence
  };
}

function createEquipmentMemoryEventFailureGuard(
  baseState: GameState
): EquipmentMemoryHuntGuardEvidence['eventFailure'] {
  const dungeonId: DungeonId = 'demon_tower_1';
  const definition = EQUIPMENT_MEMORY_CATALOG.find((candidate) => candidate.dungeonId === dungeonId)!;
  const evidence = createRouteCombatEvidence();
  const prepared = prepareEquipmentMemoryHunt(structuredClone(baseState), dungeonId, EQUIPMENT_MEMORY_PRIMARY_TARGET);
  let atNode = enterPreparedDungeon(prepared, dungeonId, evidence, {
    plannedNodeIds: [definition.nodeId],
    additionalTacticalItemIds: EQUIPMENT_HUNT_TACTICAL_ITEMS[dungeonId]
  });
  atNode = moveAlongRoutePath(atNode, definition.nodeId, evidence, {
    collectTargetReward: false,
    resolveTargetDanger: false
  });

  const strippedInventory = Object.fromEntries(
    (Object.keys(atNode.inventory) as ItemId[]).map((itemId) => [itemId, 0])
  ) as Record<ItemId, number>;
  const strippedEquipped = Object.fromEntries(
    Object.entries(atNode.equipped).map(([slot, equipmentId]) => [
      slot,
      equipmentId === EQUIPMENT_MEMORY_PRIMARY_TARGET ? equipmentId : undefined
    ])
  ) as GameState['equipped'];
  const probes: GameState[] = [
    atNode,
    {
      ...atNode,
      inventory: strippedInventory,
      learnedMethods: [],
      ownedPets: [],
      activePet: undefined,
      ownedEquipment: [EQUIPMENT_MEMORY_PRIMARY_TARGET],
      equipped: strippedEquipped
    }
  ];

  let failedState: GameState | undefined;
  let eventOptionId: string | undefined;
  for (const probe of probes) {
    const event = getAvailableDungeonEvents(probe).find((candidate) => candidate.id === definition.eventId);
    for (const option of event?.options ?? []) {
      const resolved = resolveDungeonEvent(probe, definition.eventId, option.id);
      const status = getCurrentEquipmentMemoryHuntStatus(resolved).state;
      if (status?.status === 'failed' && status.reason === 'event_failure') {
        failedState = resolved;
        eventOptionId = option.id;
        break;
      }
    }
    if (failedState) break;
  }
  if (!failedState || !eventOptionId) {
    throw new BalanceSimulationError(`${dungeonId}: no real event option produced the required permanent failure.`);
  }

  const restoredCapabilities: GameState = {
    ...failedState,
    inventory: atNode.inventory,
    learnedMethods: atNode.learnedMethods,
    ownedPets: atNode.ownedPets,
    activePet: atNode.activePet,
    ownedEquipment: atNode.ownedEquipment,
    equipped: atNode.equipped
  };
  const afterNodeClear = resolveCurrentDanger(restoredCapabilities, evidence);
  const finalStatus = getCurrentEquipmentMemoryHuntStatus(afterNodeClear).state;
  return {
    dungeonId,
    eventOptionId,
    status: finalStatus?.status,
    reason: finalStatus?.reason,
    permanentAfterNodeClear:
      afterNodeClear.run?.clearedNodeIds.includes(definition.nodeId) === true &&
      finalStatus?.status === 'failed' &&
      finalStatus.reason === 'event_failure'
  };
}

function createEquipmentMemoryIncompleteExitGuard(
  baseState: GameState
): EquipmentMemoryHuntGuardEvidence['incompleteExit'] {
  const dungeonId: DungeonId = 'metro_abyss';
  const definition = EQUIPMENT_MEMORY_CATALOG.find((candidate) => candidate.dungeonId === dungeonId)!;
  const evidence = createRouteCombatEvidence({ prioritizeHealing: true });
  const prepared = prepareEquipmentMemoryHunt(structuredClone(baseState), dungeonId, EQUIPMENT_MEMORY_PRIMARY_TARGET);
  let state = enterPreparedDungeon(prepared, dungeonId, evidence, {
    plannedNodeIds: [definition.nodeId],
    additionalTacticalItemIds: EQUIPMENT_HUNT_TACTICAL_ITEMS[dungeonId]
  });
  state = moveAlongRoutePath(state, definition.nodeId, evidence, { collectTargetReward: false });
  const beforeExit = getCurrentEquipmentMemoryHuntStatus(state).state;
  state = prepareEquipmentHuntBossLaw(state, dungeonId, evidence);
  const settled = resolvePendingRunRelicArchive(resolveExit(collectRouteRewards(state, dungeonId, evidence)));
  const status = getCurrentEquipmentMemoryHuntStatus(settled);
  return {
    dungeonId,
    nodeCleared: beforeExit?.nodeCleared ?? false,
    eventSucceeded: beforeExit?.eventSucceeded ?? false,
    status: status.state?.status,
    reason: status.state?.reason,
    granted: status.settlement?.granted ?? false
  };
}

function createEquipmentMemoryPortalGuard(
  baseState: GameState
): EquipmentMemoryHuntGuardEvidence['crossDungeonPortal'] {
  const sourceDungeonId: DungeonId = 'starfall_mine';
  const portalNodeId = 'backup_gravity_well';
  const evidence = createRouteCombatEvidence();
  const prepared = prepareEquipmentMemoryHunt(
    structuredClone(baseState),
    sourceDungeonId,
    EQUIPMENT_MEMORY_PRIMARY_TARGET
  );
  let state = enterPreparedDungeon(prepared, sourceDungeonId, evidence, {
    plannedNodeIds: [portalNodeId],
    portalUseNodeIds: [portalNodeId],
    additionalTacticalItemIds: EQUIPMENT_HUNT_TACTICAL_ITEMS[sourceDungeonId]
  });
  state = moveAlongRoutePath(state, portalNodeId, evidence, { collectTargetReward: false });
  const crossed = useTrackedPortal(state, portalNodeId, evidence);
  const status = getCurrentEquipmentMemoryHuntStatus(crossed);
  return {
    sourceDungeonId,
    targetDungeonId: crossed.run?.dungeonId,
    status: status.state?.status,
    reason: status.state?.reason,
    granted: status.settlement?.granted ?? false
  };
}

function createEquipmentMemoryPreparationConflictGuard(
  baseState: GameState
): EquipmentMemoryHuntGuardEvidence['preparationConflict'] {
  const dungeonId: DungeonId = 'demon_tower_1';
  const ordinaryTarget = createSevenDungeonEquipmentHuntFixture().targets[dungeonId];
  const ordinaryPrepared = prepareEquipmentHunt(structuredClone(baseState), dungeonId, ordinaryTarget);
  const memoryRejected = prepareEquipmentMemoryHunt(
    ordinaryPrepared,
    dungeonId,
    EQUIPMENT_MEMORY_PRIMARY_TARGET
  );
  const issueCode = getEquipmentMemoryHuntPreparationStatus(ordinaryPrepared, dungeonId)
    .unavailableReasons.find((reason) => reason.code === 'equipment_hunt_conflict')?.code;

  const memoryPrepared = prepareEquipmentMemoryHunt(
    structuredClone(baseState),
    dungeonId,
    EQUIPMENT_MEMORY_PRIMARY_TARGET
  );
  const ordinaryRejected = prepareEquipmentHunt(memoryPrepared, dungeonId, ordinaryTarget);
  return {
    ordinaryBlocksMemory:
      ordinaryPrepared.preparedEquipmentHunt !== undefined &&
      memoryRejected.preparedEquipmentMemoryHunt === undefined,
    memoryBlocksOrdinary:
      memoryPrepared.preparedEquipmentMemoryHunt !== undefined &&
      ordinaryRejected.preparedEquipmentHunt === undefined,
    issueCode
  };
}

function createEquipmentMemoryRouteContractGuard(
  baseState: GameState
): EquipmentMemoryHuntGuardEvidence['routeContractParallel'] {
  const dungeonId: DungeonId = 'rust_hospital';
  const contract = listRouteContracts(dungeonId)[0];
  if (!contract) throw new BalanceSimulationError(`${dungeonId}: no route contract for memory parallel guard.`);
  const evidence = createRouteCombatEvidence();
  const prepared = prepareEquipmentMemoryHunt(
    structuredClone(baseState),
    dungeonId,
    EQUIPMENT_MEMORY_PRIMARY_TARGET
  );
  const entered = enterPreparedDungeon(prepared, dungeonId, evidence, {
    routeContractId: contract.id,
    plannedNodeIds: [contract.targetNodeIds[0]]
  });
  return {
    dungeonId,
    contractId: contract.id,
    memoryHuntActive: getCurrentEquipmentMemoryHuntStatus(entered).state?.status === 'active',
    routeContractActive:
      entered.run?.routeContractState?.contractId === contract.id &&
      entered.run.routeContractState.status === 'active'
  };
}

function createEquipmentMemoryCombatStart(
  hubState: GameState,
  dungeonId: DungeonId,
  targetNodeId = getBossDefinition(dungeonId).nodeId
): GameState {
  let prepared = prepareEquipmentMemoryHunt(structuredClone(hubState), dungeonId);
  prepared = prepareEquipmentHunt(prepared, dungeonId);
  if (!prepared.ownedEquipment.includes('bone_spear')) prepared = buyEquipment(prepared, 'bone_spear');
  prepared = equipEquipment(prepared, 'bone_spear');
  const evidence = createRouteCombatEvidence({ prioritizeHealing: true });
  const targetNode = DUNGEONS[dungeonId].nodes.find((node) => node.id === targetNodeId);
  if (targetNode?.type !== 'monster') {
    throw new BalanceSimulationError(`${dungeonId}: memory combat target ${targetNodeId} is not a monster.`);
  }
  let state = enterPreparedDungeon(prepared, dungeonId, evidence, {
    plannedNodeIds: [targetNodeId, ...(EQUIPMENT_HUNT_BOSS_LAW_NODES[dungeonId] ?? [])],
    additionalTacticalItemIds: EQUIPMENT_HUNT_TACTICAL_ITEMS[dungeonId],
    inventoryTargets: { healing_pill: 48 }
  });
  state = prepareEquipmentHuntBossLaw(state, dungeonId, evidence);
  state = moveAlongRoutePath(state, targetNodeId, evidence, {
    collectTargetReward: false,
    resolveTargetDanger: false
  });
  state = selectNode(state, targetNodeId);
  if (state.phase !== 'combat' || state.combat?.nodeId !== targetNodeId) {
    throw new BalanceSimulationError(`${dungeonId}: memory combat guard could not start the real boss encounter.`);
  }
  return state;
}

function findRecommendedEquipmentMemoryOverflow(
  hubState: GameState
): { dungeonId: DungeonId; execution: EquipmentMemoryOverflowExecution } {
  const errors: string[] = [];
  for (const definition of EQUIPMENT_MEMORY_CATALOG) {
    const activated = activateOwnedEquipmentMemory(
      structuredClone(hubState),
      EQUIPMENT_MEMORY_PRIMARY_TARGET,
      definition.id
    );
    for (const node of DUNGEONS[definition.dungeonId].nodes.filter(
      (candidate) => candidate.type === 'monster'
    )) {
      try {
        return {
          dungeonId: definition.dungeonId,
          execution: findEquipmentMemoryOverflow(
            createEquipmentMemoryCombatStart(activated, definition.dungeonId, node.id),
            'recommended'
          )
        };
      } catch (error) {
        errors.push(`${definition.dungeonId}/${node.id}:${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  throw new BalanceSimulationError(
    `No matching real encounter produced recommended equipment-memory overflow (${errors.join('; ')}).`
  );
}

function getEquipmentMemoryCombatSearchKey(state: GameState): string {
  const status = getCurrentEquipmentMemoryCombatStatus(state);
  return [
    state.combat?.turn,
    state.combat?.monsterHp,
    state.player.hp,
    getWeaponSkillStatus(state).currentFocus,
    getCurrentCombatIntent(state)?.id,
    status.overflowStored ? 1 : 0,
    status.restored ? 1 : 0
  ].join(':');
}

function isEquipmentMemoryOverflowAction(
  state: GameState,
  action: CombatAction,
  kind: 'regular' | 'recommended'
): boolean {
  const intent = getCurrentCombatIntent(state);
  if (!intent) return false;
  const recommended = intent.recommendedActions.includes(action);
  return kind === 'recommended'
    ? intent.id !== 'regular-pursuit' && recommended
    : intent.id === 'regular-pursuit' && !intent.dangerousActions.includes(action);
}

function findEquipmentMemoryOverflow(
  start: GameState,
  kind: 'regular' | 'recommended',
  requireNonLethalWeaponSkill = false
): EquipmentMemoryOverflowExecution {
  let frontier: Array<{ state: GameState; actions: CombatAction[] }> = [{ state: start, actions: [] }];
  const seen = new Set<string>();
  const cappedDiagnostics: string[] = [];
  let storedCandidateCount = 0;
  for (let depth = 0; depth < 12; depth += 1) {
    const nextFrontier: typeof frontier = [];
    for (const candidate of frontier) {
      for (const action of EQUIPMENT_MEMORY_COMBAT_ACTIONS) {
        const beforeStatus = getCurrentEquipmentMemoryCombatStatus(candidate.state);
        const beforeFocus = getWeaponSkillStatus(candidate.state).currentFocus;
        const qualifies = kind === 'recommended'
          ? beforeFocus === 2
          : isEquipmentMemoryOverflowAction(candidate.state, action, kind);
        const after = performCombatAction(candidate.state, action);
        if (
          after.phase !== 'combat' ||
          !after.combat ||
          after.combat.turn === candidate.state.combat?.turn
        ) {
          continue;
        }
        const afterStatus = getCurrentEquipmentMemoryCombatStatus(after);
        const actionSequence = [...candidate.actions, action];
        if (
          qualifies &&
          !beforeStatus.overflowStored &&
          afterStatus.overflowStored &&
          getWeaponSkillStatus(after).currentFocus === 3 &&
          (kind !== 'recommended' || beforeFocus === 2)
        ) {
          storedCandidateCount += 1;
          const weaponSkillAfter = requireNonLethalWeaponSkill
            ? performCombatAction(after, 'weapon_skill')
            : undefined;
          if (
            !requireNonLethalWeaponSkill ||
            (weaponSkillAfter?.phase === 'combat' &&
              getWeaponSkillStatus(weaponSkillAfter).currentFocus === 1 &&
              getCurrentEquipmentMemoryCombatStatus(weaponSkillAfter).restored)
          ) {
            return { before: candidate.state, after, action, actionSequence, weaponSkillAfter };
          }
        }
        if (beforeFocus >= 2 && cappedDiagnostics.length < 18) {
          const intent = getCurrentCombatIntent(candidate.state);
          cappedDiagnostics.push(
            `${intent?.id ?? 'none'}/${action}/qualifies=${qualifies ? 1 : 0}/` +
            `stored=${afterStatus.overflowStored ? 1 : 0}/focus=${getWeaponSkillStatus(after).currentFocus}/` +
            `skill=${getWeaponSkillStatus(after).available ? 1 : 0}`
          );
        }

        const key = getEquipmentMemoryCombatSearchKey(after);
        if (!seen.has(key)) {
          seen.add(key);
          nextFrontier.push({ state: after, actions: actionSequence });
        }
      }
    }
    frontier = nextFrontier.slice(0, 256);
  }
  throw new BalanceSimulationError(
    `Unable to find a real ${kind} equipment-memory overflow transition ` +
      `(storedCandidates=${storedCandidateCount}; capped=${cappedDiagnostics.join(',') || 'none'}).`
  );
}

function findEquipmentMemoryCappedAction(
  start: GameState,
  restored: boolean
): EquipmentMemoryOverflowExecution {
  let frontier: Array<{ state: GameState; actions: CombatAction[] }> = [{ state: start, actions: [] }];
  const seen = new Set<string>();
  for (let depth = 0; depth < 12; depth += 1) {
    const nextFrontier: typeof frontier = [];
    for (const candidate of frontier) {
      const beforeFocus = getWeaponSkillStatus(candidate.state).currentFocus;
      if (beforeFocus === 3) {
        for (const action of EQUIPMENT_MEMORY_COMBAT_ACTIONS) {
          if (
            !isEquipmentMemoryOverflowAction(candidate.state, action, 'regular') &&
            !isEquipmentMemoryOverflowAction(candidate.state, action, 'recommended')
          ) {
            continue;
          }
          const after = performCombatAction(candidate.state, action);
          const afterStatus = getCurrentEquipmentMemoryCombatStatus(after);
          if (
            after.phase === 'combat' &&
            after.combat?.turn !== candidate.state.combat?.turn &&
            getWeaponSkillStatus(after).currentFocus === 3 &&
            !afterStatus.overflowStored &&
            afterStatus.restored === restored
          ) {
            return {
              before: candidate.state,
              after,
              action,
              actionSequence: [...candidate.actions, action]
            };
          }
        }
      }

      for (const action of EQUIPMENT_MEMORY_COMBAT_ACTIONS) {
        const after = performCombatAction(candidate.state, action);
        if (after.phase !== 'combat' || after.combat?.turn === candidate.state.combat?.turn) continue;
        const key = getEquipmentMemoryCombatSearchKey(after);
        if (!seen.has(key)) {
          seen.add(key);
          nextFrontier.push({ state: after, actions: [...candidate.actions, action] });
        }
      }
    }
    frontier = nextFrontier.slice(0, 256);
  }
  throw new BalanceSimulationError('Unable to find a capped real combat action for the equipment-memory guard.');
}

function getEquipmentMemoryCombatTransitionEvidence(
  dungeonId: DungeonId,
  execution: EquipmentMemoryOverflowExecution,
  afterOverride = execution.after,
  actionOverride = execution.action,
  actionSequenceOverride: readonly CombatAction[] = execution.actionSequence
): EquipmentMemoryCombatTransitionEvidence {
  const beforeStatus = getCurrentEquipmentMemoryCombatStatus(execution.before);
  const afterStatus = getCurrentEquipmentMemoryCombatStatus(afterOverride);
  return {
    dungeonId,
    nodeId: execution.before.combat?.nodeId ?? 'missing',
    action: actionOverride,
    actionSequence: [...actionSequenceOverride],
    beforeFocus: getWeaponSkillStatus(execution.before).currentFocus,
    afterFocus: getWeaponSkillStatus(afterOverride).currentFocus,
    matchingEquipmentIds: [...afterStatus.matchingEquipmentIds],
    overflowStoredBefore: beforeStatus.overflowStored,
    overflowStoredAfter: afterStatus.overflowStored,
    restoredBefore: beforeStatus.restored,
    restoredAfter: afterStatus.restored,
    combatContinued: afterOverride.phase === 'combat'
  };
}

function createEquipmentMemoryCombatGuards(
  finalState: GameState
): EquipmentMemoryCombatGuardEvidence {
  const matchingDungeonId: DungeonId = 'temporal_observatory';
  const matchingStart = createEquipmentMemoryCombatStart(finalState, matchingDungeonId);
  const regular = findEquipmentMemoryOverflow(matchingStart, 'regular', true);
  const recommended = findRecommendedEquipmentMemoryOverflow(finalState);
  if (!regular.weaponSkillAfter) {
    throw new BalanceSimulationError('Regular memory overflow did not produce a continuing weapon skill state.');
  }
  const suppressed = findEquipmentMemoryCappedAction(regular.weaponSkillAfter, true);

  const nonMatchingDungeonId: DungeonId = 'demon_tower_1';
  const nonMatchingStart = createEquipmentMemoryCombatStart(finalState, nonMatchingDungeonId);
  const nonMatchingCapped = findEquipmentMemoryCappedAction(nonMatchingStart, false);
  const nonMatchingSkill = performCombatAction(nonMatchingCapped.after, 'weapon_skill');
  const nonMatchingStatus = getCurrentEquipmentMemoryCombatStatus(nonMatchingSkill);

  let multiState = returnToHub(structuredClone(finalState));
  multiState = matureEquipmentMemoryTarget(
    supplyEquipmentMemoryFixture(multiState),
    EQUIPMENT_MEMORY_SECONDARY_TARGET,
    'forge_channeling'
  );
  const secondHunt = runEquipmentMemoryChapter(
    multiState,
    matchingDungeonId,
    EQUIPMENT_MEMORY_SECONDARY_TARGET,
    'clear-first',
    true
  );
  multiState = returnToHub(secondHunt.state);
  const multiStart = createEquipmentMemoryCombatStart(multiState, matchingDungeonId);
  const multiOverflow = findEquipmentMemoryOverflow(multiStart, 'regular', true);
  if (!multiOverflow.weaponSkillAfter) {
    throw new BalanceSimulationError('Multi-memory guard did not produce a continuing weapon skill state.');
  }
  const multiStatus = getCurrentEquipmentMemoryCombatStatus(multiOverflow.weaponSkillAfter);

  return {
    regularOverflow: getEquipmentMemoryCombatTransitionEvidence(matchingDungeonId, regular),
    recommendedOverflow: getEquipmentMemoryCombatTransitionEvidence(
      recommended.dungeonId,
      recommended.execution
    ),
    nonLethalWeaponSkillRestore: getEquipmentMemoryCombatTransitionEvidence(
      matchingDungeonId,
      regular,
      regular.weaponSkillAfter,
      'weapon_skill',
      [...regular.actionSequence, 'weapon_skill']
    ),
    oncePerCombat: {
      secondOverflowStored: getCurrentEquipmentMemoryCombatStatus(suppressed.after).overflowStored,
      restoredStillMarked: getCurrentEquipmentMemoryCombatStatus(suppressed.after).restored
    },
    nonMatching: {
      dungeonId: nonMatchingDungeonId,
      matchingEquipmentIds: [...nonMatchingStatus.matchingEquipmentIds],
      memoryEnabled: nonMatchingStatus.enabled,
      focusAfterWeaponSkill: getWeaponSkillStatus(nonMatchingSkill).currentFocus,
      restored: nonMatchingStatus.restored
    },
    multipleMatching: {
      dungeonId: matchingDungeonId,
      matchingEquipmentIds: [...multiStatus.matchingEquipmentIds],
      overflowStored: getCurrentEquipmentMemoryCombatStatus(multiOverflow.after).overflowStored,
      focusAfterWeaponSkill: getWeaponSkillStatus(multiOverflow.weaponSkillAfter).currentFocus,
      restored: multiStatus.restored
    }
  };
}

export function simulateEightDungeonEquipmentMemoryHunts(): EightDungeonEquipmentMemoryHuntsResult {
  const baseState = createEquipmentMemoryHuntFixture();
  const baseline = getEquipmentMemoryBaselineEvidence(baseState);
  if (
    !baseline.owned ||
    !baseline.equipped ||
    baseline.level !== baseline.maxLevel ||
    baseline.attunementId === undefined ||
    baseline.temperRank !== 2 ||
    baseline.sealed ||
    baseline.eligibleDungeonIds.length !== DUNGEON_ORDER.length
  ) {
    throw new BalanceSimulationError('Equipment memory hunt baseline is not mature and eligible for the full campaign.');
  }

  let state = baseState;
  const summaries: EightDungeonEquipmentMemoryHuntSummary[] = [];
  for (const [index, dungeonId] of DUNGEON_ORDER.entries()) {
    const definition = EQUIPMENT_MEMORY_CATALOG.find((candidate) => candidate.dungeonId === dungeonId)!;
    // Resolve the archive event before its trap seals the successful method branch.
    const signalOrder: EquipmentMemoryHuntSignalOrder = dungeonId === 'dream_archive' || index % 2 === 0
      ? 'event-first'
      : 'clear-first';
    const control = runEquipmentMemoryChapter(
      state,
      dungeonId,
      EQUIPMENT_MEMORY_PRIMARY_TARGET,
      signalOrder,
      false
    );
    const hunt = runEquipmentMemoryChapter(
      state,
      dungeonId,
      EQUIPMENT_MEMORY_PRIMARY_TARGET,
      signalOrder,
      true
    );
    const memoryStatus = getEquipmentMemoryStatus(hunt.state, EQUIPMENT_MEMORY_PRIMARY_TARGET);
    const huntEconomy = getEquipmentMemoryEconomySnapshot(hunt.state);
    const controlEconomy = getEquipmentMemoryEconomySnapshot(control.state);
    const deterministicRoute =
      hunt.eventOptionId === control.eventOptionId &&
      JSON.stringify(hunt.evidence.routeMovements) === JSON.stringify(control.evidence.routeMovements);

    summaries.push({
      tier: DUNGEONS[dungeonId].tier,
      dungeonId,
      dungeonName: DUNGEONS[dungeonId].name,
      targetEquipmentId: EQUIPMENT_MEMORY_PRIMARY_TARGET,
      memoryId: definition.id,
      eventId: definition.eventId,
      nodeId: definition.nodeId,
      signalOrder,
      eventOptionId: hunt.eventOptionId,
      statusAfterFirstSignal: hunt.statusAfterFirstSignal,
      statusBeforeExit: hunt.statusBeforeExit,
      statusAfterExit: hunt.statusAfterExit,
      nodeCleared: hunt.nodeCleared,
      eventSucceeded: hunt.eventSucceeded,
      bossNodeId: hunt.bossNodeId,
      bossNodeCleared: hunt.state.run?.clearedNodeIds.includes(hunt.bossNodeId) ?? false,
      exitNodeId: hunt.exitNodeId,
      exitNodeCleared: hunt.state.run?.clearedNodeIds.includes(hunt.exitNodeId) ?? false,
      settlement: hunt.settlement,
      unlockedMemoryIdsAfter: memoryStatus.unlockedMemories.map((memory) => memory.id),
      activeMemoryIdAfter: memoryStatus.activeMemory?.id,
      economy: {
        hunt: huntEconomy,
        control: controlEconomy,
        matchesControl: equipmentMemoryEconomiesEqual(huntEconomy, controlEconomy)
      },
      deterministicRoute,
      routeEvidence: getRouteLegalityEvidence(hunt.evidence)
    });

    state = returnToHub(hunt.state);
    if (state.phase !== 'hub') {
      throw new BalanceSimulationError(`${dungeonId}: banked memory route could not return to the hub.`);
    }
  }

  const finalMemoryStatus = getEquipmentMemoryStatus(state, EQUIPMENT_MEMORY_PRIMARY_TARGET);
  const guardState = activateOwnedEquipmentMemory(
    {
      ...structuredClone(baseState),
      equipmentMemories: structuredClone(state.equipmentMemories)
    },
    EQUIPMENT_MEMORY_PRIMARY_TARGET,
    'equipment_memory_temporal_observatory'
  );
  const guards: EquipmentMemoryHuntGuardEvidence = {
    eventFailure: createEquipmentMemoryEventFailureGuard(baseState),
    incompleteExit: createEquipmentMemoryIncompleteExitGuard(baseState),
    crossDungeonPortal: createEquipmentMemoryPortalGuard(baseState),
    preparationConflict: createEquipmentMemoryPreparationConflictGuard(baseState),
    routeContractParallel: createEquipmentMemoryRouteContractGuard(baseState),
    combat: createEquipmentMemoryCombatGuards(guardState)
  };
  const signalOrders = [...new Set(summaries.map((summary) => summary.signalOrder))];
  const deterministic = summaries.every(
    (summary) =>
      summary.deterministicRoute &&
      summary.economy.matchesControl &&
      summary.routeEvidence.movements.every((movement) => movement.legal)
  );

  return {
    baseState,
    finalState: state,
    baseline,
    summaries,
    coverage: {
      dungeonIds: summaries.map((summary) => summary.dungeonId),
      dungeonCount: summaries.length,
      bankedCount: summaries.filter((summary) => summary.statusAfterExit === 'banked').length,
      signalOrders,
      finalUnlockedMemoryIds: finalMemoryStatus.unlockedMemories.map((memory) => memory.id),
      finalActiveMemoryId: finalMemoryStatus.activeMemory?.id,
      deterministic
    },
    guards
  };
}

type PressureEnabledRun = NonNullable<GameState['run']> & {
  pressureState?: RunPressureState;
  lastPressureSettlement?: PressureSettlementSnapshot;
};

const PRESSURE_ROUTE_INVENTORY_TARGETS = {
  healing_pill: 48,
  thunder_talisman: 8,
  dispel_talisman: 6,
  gate_sigil: 6,
  armor_patch: 6,
  focus_incense: 6
} satisfies Partial<Record<TacticalItemId, number>>;

function getPressureEnabledRun(state: GameState): PressureEnabledRun | undefined {
  return state.run as PressureEnabledRun | undefined;
}

function getRequiredPressureState(state: GameState, checkpoint: string): RunPressureState {
  const pressureState = getPressureEnabledRun(state)?.pressureState;
  if (!pressureState) {
    throw new BalanceSimulationError(`${checkpoint}: active run did not expose a pressureState snapshot.`);
  }
  return structuredClone(pressureState);
}

function getPressureSweepNodeIds(dungeonId: DungeonId): string[] {
  return DUNGEONS[dungeonId].nodes
    .filter((node) => node.type === 'monster' || node.type === 'reward')
    .filter((node) => {
      if (
        dungeonId === 'silent_broadcast_tower' &&
        (node.id === 'silent_archive' || node.id === 'resonance_vault')
      ) {
        return false;
      }
      if (
        dungeonId === 'lost_shelter' &&
        (node.id === 'evacuation_cache' || node.id === 'desperate_armory' || node.id === 'balanced_medbay')
      ) {
        return false;
      }
      if (
        dungeonId === 'false_testimony_court' &&
        [
          'truth_archive',
          'swift_judgment_armory',
          'false_verdict_vault',
          'appeal_desk',
          'voice_evidence',
          'timeline_evidence',
          'residue_evidence'
        ].includes(node.id)
      ) {
        return false;
      }
      if (
        dungeonId === 'combat_replay_stage' &&
        (node.id === 'afterbeat_route' || node.id === 'burst_route')
      ) {
        return false;
      }
      if (
        dungeonId === 'panopticon_city' &&
        (node.id === 'decoy_route' || node.id === 'refraction_route')
      ) {
        return false;
      }
      if (dungeonId !== 'legacy_auction_court') return true;
      const requiredBidChoiceByVault = {
        force_claim_vault: STANDARD_AUCTION_LOT_CHOICES.force_lot_dais,
        guard_claim_vault: STANDARD_AUCTION_LOT_CHOICES.guard_lot_dais,
        art_claim_vault: STANDARD_AUCTION_LOT_CHOICES.art_lot_dais,
        return_claim_vault: STANDARD_AUCTION_LOT_CHOICES.return_lot_dais
      } as const;
      const choice = requiredBidChoiceByVault[node.id as keyof typeof requiredBidChoiceByVault];
      return choice === undefined || choice === 'bid';
    })
    .map((node) => node.id);
}

function getPressureRoutePreparationNodeIds(dungeonId: DungeonId): string[] {
  return DUNGEONS[dungeonId].nodes
    .filter((node) => node.type === 'monster' || node.type === 'trap' || node.type === 'reward')
    .map((node) => node.id);
}

function recordFirstPressureRouteClears(
  before: GameState,
  after: GameState,
  firstClearedNonExitNodeIds: string[]
): void {
  if (!before.run || !after.run || before.run.dungeonId !== after.run.dungeonId) {
    throw new BalanceSimulationError('Pressure route changed or lost its active dungeon while recording node clears.');
  }

  const dungeon = DUNGEONS[after.run.dungeonId];
  const clearedBefore = new Set(before.run.clearedNodeIds);
  const alreadyRecorded = new Set(firstClearedNonExitNodeIds);
  for (const nodeId of after.run.clearedNodeIds) {
    const node = dungeon.nodes.find((candidate) => candidate.id === nodeId);
    if (!node || node.type === 'exit' || clearedBefore.has(nodeId) || alreadyRecorded.has(nodeId)) continue;
    firstClearedNonExitNodeIds.push(nodeId);
    alreadyRecorded.add(nodeId);
  }
}

function movePressureRouteToNode(
  state: GameState,
  targetNodeId: string,
  evidence: RouteCombatEvidence,
  firstClearedNonExitNodeIds: string[],
  excludedNodeIds: ReadonlySet<string> = new Set()
): GameState {
  const before = state;
  const after = moveAlongRoutePath(state, targetNodeId, evidence, {
    excludedNodeIds,
    panopticonRoute: state.run?.dungeonId === 'panopticon_city' ? 'shadow' : undefined
  });
  recordFirstPressureRouteClears(before, after, firstClearedNonExitNodeIds);
  return after;
}

function findNextPressureSweepTarget(
  state: GameState,
  pendingNodeIds: readonly string[],
  excludedNodeIds: ReadonlySet<string>
): string {
  const contentOrder = new Map(
    DUNGEONS[state.run!.dungeonId].nodes.map((node, index) => [node.id, index])
  );
  const candidates = pendingNodeIds.flatMap((nodeId) => {
    try {
      return [{
        nodeId,
        pathLength: findAdjacentRoutePath(state, nodeId, undefined, excludedNodeIds).length,
        contentIndex: contentOrder.get(nodeId) ?? Number.MAX_SAFE_INTEGER
      }];
    } catch {
      return [];
    }
  });

  candidates.sort((a, b) => a.pathLength - b.pathLength || a.contentIndex - b.contentIndex);
  const next = candidates[0];
  if (!next) {
    throw getDangerResolutionError(
      state,
      pendingNodeIds[0] ?? 'unknown',
      `no remaining sweep target is legally reachable before exit; pending=${pendingNodeIds.join(',')}`
    );
  }
  return next.nodeId;
}

function getPressureRouteTrapExclusions(state: GameState, exitNodeId: string): Set<string> {
  const excludedNodeIds = new Set([exitNodeId]);
  if (!state.run) return excludedNodeIds;

  for (const node of DUNGEONS[state.run.dungeonId].nodes) {
    if (node.type === 'trap' && !state.run.clearedNodeIds.includes(node.id)) {
      excludedNodeIds.add(node.id);
    }
  }
  return excludedNodeIds;
}

function createPressureRouteEntry(
  baseState: GameState,
  dungeonId: DungeonId,
  evidence: RouteCombatEvidence
): GameState {
  const plannedNodeIds = getPressureRoutePreparationNodeIds(dungeonId);
  const preparedBase = dungeonId === 'combat_replay_stage'
    ? prepareCombatReplayProtocolBuild(baseState, 'standard', 10)
    : dungeonId === 'redaction_scriptorium'
    ? prepareRedactionScriptoriumCombatState(baseState)
    : dungeonId === 'entropy_ark' || dungeonId === 'legacy_auction_court'
    ? prepareDeepRouteBaseState(baseState)
    : dungeonId === 'silent_broadcast_tower'
    ? prepareDeepRouteBaseState(baseState)
    : dungeonId === 'panopticon_city'
    ? preparePanopticonEndgameBuild(baseState, 260)
    : structuredClone(baseState);
  return enterPreparedDungeon(preparedBase, dungeonId, evidence, {
    plannedNodeIds,
    additionalTacticalItemIds:
      dungeonId === 'temporal_observatory'
        ? ['healing_pill', 'focus_incense']
        : dungeonId === 'void_citadel'
          ? ['thunder_talisman', 'healing_pill']
          : dungeonId === 'legacy_auction_court'
            ? ['healing_pill', 'focus_incense', 'armor_patch']
          : ['healing_pill'],
    inventoryTargets: PRESSURE_ROUTE_INVENTORY_TARGETS
  });
}

function prepareCombatReplayPressureBossRoute(
  state: GameState,
  evidence: RouteCombatEvidence,
  firstClearedNonExitNodeIds: string[],
  exitNodeId: string
): GameState {
  if (state.run?.dungeonId !== 'combat_replay_stage') return state;

  let nextState = state;
  for (const nodeId of ['take_alpha', 'take_beta', 'take_gamma'] as const) {
    if (nextState.run?.clearedNodeIds.includes(nodeId)) continue;
    nextState = movePressureRouteToNode(
      nextState,
      nodeId,
      evidence,
      firstClearedNonExitNodeIds,
      new Set([exitNodeId])
    );
  }
  const law = nextState.run?.lawState?.law;
  if (law?.kind !== 'combat_replay_stage' || law.takes.some((take) => take === null)) {
    throw new BalanceSimulationError('Combat replay pressure route did not complete all three real recordings.');
  }
  if (law.route === null) nextState = selectCombatReplayRoute(nextState, 'sequence');
  return nextState;
}

function getPressureRouteEconomyInput(state: GameState, exitNodeId: string): RunEconomyInput {
  if (!state.run) throw new BalanceSimulationError('Cannot calculate pressure settlement without an active run.');
  const dungeon = DUNGEONS[state.run.dungeonId];
  const exitNode = dungeon.nodes.find((node) => node.id === exitNodeId && node.type === 'exit');
  if (!exitNode?.reward) throw new BalanceSimulationError(`${state.run.dungeonId} has no reward-bearing exit.`);

  return {
    baseRewardPoints: exitNode.reward.rewardPoints ?? 0,
    clearedNodes: state.run.clearedNodeIds.length + 1,
    totalNodes: dungeon.nodes.length,
    damageTaken: state.run.damageTaken,
    captures: state.run.captures,
    readiness: getDungeonReadiness(state, state.run.dungeonId),
    dungeonTier: dungeon.tier,
    exitStatus: 'cleared'
  };
}

function settlePressureRoute(
  state: GameState,
  routeKind: PressureRouteKind,
  plannedTargetNodeIds: string[],
  routeExcludedNodeIds: string[],
  firstClearedNonExitNodeIds: string[],
  evidence: RouteCombatEvidence,
  bossNodeId: string,
  exitNodeId: string
): SevenDungeonPressureRouteEvidence {
  if (!state.run) throw new BalanceSimulationError(`${routeKind} pressure route ended before exit settlement.`);
  assertBossSealCleared(state, state.run.dungeonId, `before ${routeKind} pressure settlement`);

  const pressureStateBeforeExit = getRequiredPressureState(state, `${state.run.dungeonId}/${routeKind}/before-exit`);
  const baseEconomyInput = getPressureRouteEconomyInput(state, exitNodeId);
  const baseEconomy = calculateRunEconomy(baseEconomyInput);
  const expectedPressureBonus = calculateRunPressureBonus(baseEconomy.rewardPoints, pressureStateBeforeExit);
  const rewardPointsBeforeSettlement = state.rewardPoints;
  const settledAtExit = resolveExit(state);
  const settledRun = getPressureEnabledRun(settledAtExit);
  const pressureSettlement = settledRun?.lastPressureSettlement;
  if (!settledRun || !pressureSettlement) {
    throw new BalanceSimulationError(`${state.run.dungeonId}/${routeKind}: resolveExit did not create pressure settlement evidence.`);
  }

  const pressureStateAfterExit = getRequiredPressureState(
    settledAtExit,
    `${state.run.dungeonId}/${routeKind}/after-exit`
  );
  const rewardPointsAfterSettlement = settledAtExit.rewardPoints;
  const observedSettlementRewardPoints = rewardPointsAfterSettlement - rewardPointsBeforeSettlement;
  const actualPressureBonus = pressureSettlement.rewardPointBonus;
  const pressureTier = getRunPressureStatus(pressureStateBeforeExit).tier;
  const clearedNodeIdsBeforeExit = [...state.run.clearedNodeIds];
  const clearedNodeIdsAfterExit = [...settledRun.clearedNodeIds];
  const bossNodeCleared = clearedNodeIdsBeforeExit.includes(bossNodeId);
  const exitNodeCleared = clearedNodeIdsAfterExit.includes(exitNodeId);
  const bossSealCleared = getBossSealStatus(settledAtExit, state.run.dungeonId)?.cleared ?? false;

  if (pressureStateBeforeExit.clearedNodeCount !== firstClearedNonExitNodeIds.length) {
    throw new BalanceSimulationError(
      `${state.run.dungeonId}/${routeKind}: pressure counted ${pressureStateBeforeExit.clearedNodeCount} nodes, ` +
        `but real API transitions recorded ${firstClearedNonExitNodeIds.length} first non-exit clears.`
    );
  }
  if (
    pressureStateAfterExit.clearedNodeCount !== pressureStateBeforeExit.clearedNodeCount ||
    pressureSettlement.state.clearedNodeCount !== pressureStateBeforeExit.clearedNodeCount
  ) {
    throw new BalanceSimulationError(`${state.run.dungeonId}/${routeKind}: exit incorrectly changed the pressure clear count.`);
  }
  if (
    pressureSettlement.tier !== pressureTier ||
    actualPressureBonus !== expectedPressureBonus ||
    observedSettlementRewardPoints !== baseEconomy.rewardPoints + actualPressureBonus
  ) {
    throw new BalanceSimulationError(
      `${state.run.dungeonId}/${routeKind}: pressure settlement mismatch ` +
        `(tier=${pressureSettlement.tier}/${pressureTier}, bonus=${actualPressureBonus}/${expectedPressureBonus}, ` +
        `observed=${observedSettlementRewardPoints}, economy=${baseEconomy.rewardPoints}).`
    );
  }
  if (settledAtExit.phase !== 'result' || !bossNodeCleared || !bossSealCleared || !exitNodeCleared) {
    throw new BalanceSimulationError(`${state.run.dungeonId}/${routeKind}: boss and exit did not settle through real APIs.`);
  }

  return {
    routeKind,
    startNodeId: DUNGEONS[state.run.dungeonId].grid.startNodeId,
    plannedTargetNodeIds,
    routeExcludedNodeIds,
    firstClearedNonExitNodeIds: [...firstClearedNonExitNodeIds],
    clearedNodeIdsBeforeExit,
    clearedNodeIdsAfterExit,
    pressureStateBeforeExit,
    pressureStateAfterExit,
    pressureTier,
    pressureSettlement: structuredClone(pressureSettlement),
    baseEconomyInput,
    baseEconomy,
    expectedPressureBonus,
    actualPressureBonus,
    rewardPointsBeforeSettlement,
    rewardPointsAfterSettlement,
    observedSettlementRewardPoints,
    bossNodeId,
    exitNodeId,
    bossNodeCleared,
    bossSealCleared,
    exitNodeCleared,
    completed: true,
    routeEvidence: getRouteLegalityEvidence(evidence)
  };
}

function simulateDungeonPressureRoute(
  baseState: GameState,
  dungeonId: DungeonId,
  routeKind: PressureRouteKind
): SevenDungeonPressureRouteEvidence {
  const evidence = createRouteCombatEvidence({
    prioritizeHealing: true,
    healingTargetRatio:
      dungeonId === 'temporal_observatory' ||
      dungeonId === 'void_citadel' ||
      (dungeonId === 'dream_archive' && routeKind === 'sweep')
        ? 0.9
        : 0.7
  });
  let state = createPressureRouteEntry(baseState, dungeonId, evidence);
  const bossNodeId = getBossDefinition(dungeonId).nodeId;
  const exitNodeId = DUNGEONS[dungeonId].nodes.find((node) => node.type === 'exit')?.id;
  if (!exitNodeId) throw new BalanceSimulationError(`${dungeonId} has no exit for pressure simulation.`);

  const firstClearedNonExitNodeIds: string[] = [];
  const plannedTargetNodeIds: string[] = [];
  const routeExcludedNodeIds: string[] = [];
  const excludeExit = new Set([exitNodeId]);
  if (dungeonId === 'entropy_ark') {
    for (const nodeId of STANDARD_ROUTE_PREPARATION_NODES.entropy_ark ?? []) {
      if (nodeId === 'entropy_deckhand') continue;
      plannedTargetNodeIds.push(nodeId);
      state = movePressureRouteToNode(
        state,
        nodeId,
        evidence,
        firstClearedNonExitNodeIds,
        excludeExit
      );
    }
  }
  if (dungeonId === 'silent_broadcast_tower') {
    for (const nodeId of DUNGEON_LAW_LANDMARKS.silent_broadcast_tower.relayNodeIds) {
      plannedTargetNodeIds.push(nodeId);
      state = movePressureRouteToNode(
        state,
        nodeId,
        evidence,
        firstClearedNonExitNodeIds,
        excludeExit
      );
    }
  }
  state = prepareCombatReplayPressureBossRoute(
    state,
    evidence,
    firstClearedNonExitNodeIds,
    exitNodeId
  );
  let bossExclusions = getPressureRouteTrapExclusions(state, exitNodeId);
  try {
    findAdjacentRoutePath(state, bossNodeId, undefined, bossExclusions);
  } catch {
    bossExclusions = excludeExit;
  }
  plannedTargetNodeIds.push(bossNodeId);
  state = movePressureRouteToNode(
    state,
    bossNodeId,
    evidence,
    firstClearedNonExitNodeIds,
    bossExclusions
  );
  assertBossSealCleared(state, dungeonId, `after ${routeKind} pressure boss route`);

  if (routeKind === 'sweep') {
    const sweepNodeIds = getPressureSweepNodeIds(dungeonId);
    while (state.run) {
      const pendingNodeIds = sweepNodeIds.filter((nodeId) => !state.run!.clearedNodeIds.includes(nodeId));
      if (pendingNodeIds.length === 0) break;
      let sweepExclusions = getPressureRouteTrapExclusions(state, exitNodeId);
      let targetNodeId: string;
      try {
        targetNodeId = findNextPressureSweepTarget(state, pendingNodeIds, sweepExclusions);
      } catch {
        sweepExclusions = excludeExit;
        try {
          targetNodeId = findNextPressureSweepTarget(state, pendingNodeIds, sweepExclusions);
        } catch (error) {
          if (dungeonId !== 'genesis_vault') throw error;
          routeExcludedNodeIds.push(...pendingNodeIds);
          break;
        }
      }
      plannedTargetNodeIds.push(targetNodeId);
      state = movePressureRouteToNode(
        state,
        targetNodeId,
        evidence,
        firstClearedNonExitNodeIds,
        sweepExclusions
      );
    }

    const missedNodeIds = sweepNodeIds.filter(
      (nodeId) => !state.run?.clearedNodeIds.includes(nodeId) && !routeExcludedNodeIds.includes(nodeId)
    );
    if (missedNodeIds.length > 0) {
      throw new BalanceSimulationError(`${dungeonId}: sweep pressure route missed ${missedNodeIds.join(',')}.`);
    }
  }

  plannedTargetNodeIds.push(exitNodeId);
  state = movePressureRouteToNode(state, exitNodeId, evidence, firstClearedNonExitNodeIds);
  return settlePressureRoute(
    state,
    routeKind,
    plannedTargetNodeIds,
    routeExcludedNodeIds,
    firstClearedNonExitNodeIds,
    evidence,
    bossNodeId,
    exitNodeId
  );
}

function createPressureSimulationBaseState(initialState?: GameState): GameState {
  let state = structuredClone(initialState ?? simulateSevenDungeonVictoryRoute().finalState);
  if (state.phase !== 'hub') {
    state = resolvePendingRunRelicArchive(state);
    state = returnToHub(state);
  }
  if (state.phase !== 'hub' || state.run) {
    throw new BalanceSimulationError('Pressure simulation requires a hub state without an active run.');
  }

  const missingDungeonIds = DUNGEON_ORDER.filter((dungeonId) => !state.completedDungeonIds.includes(dungeonId));
  if (missingDungeonIds.length > 0) {
    throw new BalanceSimulationError(
      `Pressure simulation requires repeat-clear access to the full campaign; missing=${missingDungeonIds.join(',')}.`
    );
  }
  return restoreSimulationHealth(state);
}

export function simulateSevenDungeonPressureRoute(
  initialState?: GameState
): SevenDungeonPressureRouteResult {
  const baseState = createPressureSimulationBaseState(initialState);
  const summaries = DUNGEON_ORDER.map((dungeonId): SevenDungeonPressureRouteSummary => ({
    tier: DUNGEONS[dungeonId].tier,
    dungeonId,
    dungeonName: DUNGEONS[dungeonId].name,
    fastRoute: simulateDungeonPressureRoute(baseState, dungeonId, 'fast'),
    sweepRoute: simulateDungeonPressureRoute(baseState, dungeonId, 'sweep')
  }));
  const pressureTierRank: Record<RunPressureTier, number> = { stable: 0, hunted: 1, breach: 2 };

  for (const summary of summaries) {
    if (pressureTierRank[summary.fastRoute.pressureTier] > pressureTierRank[summary.sweepRoute.pressureTier]) {
      throw new BalanceSimulationError(`${summary.dungeonId}: fast route pressure exceeded sweep pressure.`);
    }
  }
  if (
    !summaries.some(
      (summary) => pressureTierRank[summary.fastRoute.pressureTier] < pressureTierRank[summary.sweepRoute.pressureTier]
    )
  ) {
    throw new BalanceSimulationError('Pressure simulation did not produce a stricter sweep tier on any dungeon.');
  }

  return { baseState, summaries };
}

function snapshotRouteContractLoot(
  loot: NonNullable<GameState['run']>['lootBag']
): RouteContractLootSnapshot {
  return {
    rewardPoints: loot.rewardPoints,
    lingyun: loot.lingyun,
    items: { ...loot.items },
    equipmentIds: [...loot.equipmentIds]
  };
}

function routeContractLootSnapshotsEqual(
  left: RouteContractLootSnapshot,
  right: RouteContractLootSnapshot
): boolean {
  const sortedItems = (snapshot: RouteContractLootSnapshot) =>
    Object.entries(snapshot.items).sort(([leftId], [rightId]) => leftId.localeCompare(rightId));

  return left.rewardPoints === right.rewardPoints &&
    left.lingyun === right.lingyun &&
    left.equipmentIds.join(',') === right.equipmentIds.join(',') &&
    JSON.stringify(sortedItems(left)) === JSON.stringify(sortedItems(right));
}

function createRouteContractSimulationBaseState(initialState?: GameState): GameState {
  let state = structuredClone(initialState ?? simulateSevenDungeonVictoryRoute().finalState);
  if (state.phase !== 'hub') {
    state = resolvePendingRunRelicArchive(state);
    state = returnToHub(state);
  }
  if (state.phase !== 'hub' || state.run) {
    throw new BalanceSimulationError('Route-contract simulation requires a hub state without an active run.');
  }

  const missingDungeonIds = DUNGEON_ORDER.filter((dungeonId) => !state.completedDungeonIds.includes(dungeonId));
  if (missingDungeonIds.length > 0) {
    throw new BalanceSimulationError(
      `Route-contract simulation requires replay access to the full campaign; missing=${missingDungeonIds.join(',')}.`
    );
  }
  return restoreSimulationHealth(state);
}

function getRequiredRouteContractState(
  state: GameState,
  definition: RouteContractDefinition,
  checkpoint: string
): RouteContractRunState {
  const contractState = state.run?.routeContractState;
  if (
    !contractState ||
    contractState.contractId !== definition.id ||
    contractState.dungeonId !== definition.dungeonId
  ) {
    throw new BalanceSimulationError(
      `${definition.dungeonId}/${definition.id}: missing selected route contract ${checkpoint}.`
    );
  }
  return contractState;
}

function settleRouteContractSimulation(
  state: GameState,
  definition: RouteContractDefinition,
  routeKind: RouteContractSimulationKind,
  evidence: RouteCombatEvidence
): EightDungeonRouteContractRunEvidence {
  if (!state.run) {
    throw new BalanceSimulationError(`${definition.dungeonId}/${definition.id}: route ended before exit.`);
  }

  const dungeon = DUNGEONS[definition.dungeonId];
  const bossNodeId = getBossDefinition(definition.dungeonId).nodeId;
  const exitNode = dungeon.nodes.find((node) => node.type === 'exit');
  if (!exitNode) throw new BalanceSimulationError(`${definition.dungeonId} has no route-contract exit.`);

  assertBossSealCleared(state, definition.dungeonId, `before ${routeKind} route-contract settlement`);
  const contractStateBeforeExit = structuredClone(
    getRequiredRouteContractState(state, definition, 'before exit')
  );
  const expectedStatus = routeKind === 'ordered' ? 'secured' : 'failed';
  const expectedReason = routeKind === 'out_of_order' ? 'out_of_order' : undefined;
  if (
    contractStateBeforeExit.status !== expectedStatus ||
    contractStateBeforeExit.reason !== expectedReason
  ) {
    throw new BalanceSimulationError(
      `${definition.dungeonId}/${definition.id}: expected ${expectedStatus}/${expectedReason ?? 'none'} before exit, ` +
        `received ${contractStateBeforeExit.status}/${contractStateBeforeExit.reason ?? 'none'}.`
    );
  }

  const lootBagBeforeExit = snapshotRouteContractLoot(state.run.lootBag);
  const baseEconomy = calculateRunEconomy(getPressureRouteEconomyInput(state, exitNode.id));
  const rewardPointsBeforeExit = state.rewardPoints;
  const settled = resolvePendingRunRelicArchive(resolveExit(state));
  const settledRun = settled.run;
  const settlement = settledRun?.lastRouteContractSettlement;
  const retainedLoot = settledRun?.lastLootSettlement?.retained;
  if (!settledRun || !settlement || !retainedLoot) {
    throw new BalanceSimulationError(
      `${definition.dungeonId}/${definition.id}: real exit did not produce contract and loot settlements.`
    );
  }

  const pressureRewardPoints = settledRun.lastPressureSettlement?.rewardPointBonus ?? 0;
  const rewardPointsAfterExit = settled.rewardPoints;
  const observedContractRewardPoints =
    rewardPointsAfterExit - rewardPointsBeforeExit - baseEconomy.rewardPoints - pressureRewardPoints;
  const expectedContractRewardPoints = routeKind === 'ordered' ? definition.rewardPoints : 0;
  const retainedLootAfterExit = snapshotRouteContractLoot(retainedLoot);
  const targetClearOrder = settledRun.clearedNodeIds.filter((nodeId) =>
    definition.targetNodeIds.includes(nodeId)
  );
  const bossNodeCleared = settledRun.clearedNodeIds.includes(bossNodeId);
  const bossSealCleared = getBossSealStatus(settled, definition.dungeonId)?.cleared ?? false;
  const exitNodeCleared = settledRun.clearedNodeIds.includes(exitNode.id);
  const completed = settled.phase === 'result' && settled.completedDungeonIds.includes(definition.dungeonId);
  const expectedSettlementStatus = routeKind === 'ordered' ? 'banked' : 'failed';

  if (
    settlement.state?.status !== expectedSettlementStatus ||
    settlement.state.reason !== expectedReason ||
    settlement.rewardPoints !== expectedContractRewardPoints ||
    settlement.rewarded !== (routeKind === 'ordered') ||
    observedContractRewardPoints !== expectedContractRewardPoints
  ) {
    throw new BalanceSimulationError(
      `${definition.dungeonId}/${definition.id}: contract settlement mismatch ` +
        `(status=${settlement.state?.status ?? 'none'}, reason=${settlement.state?.reason ?? 'none'}, ` +
        `settlement=${settlement.rewardPoints}, observed=${observedContractRewardPoints}, ` +
        `expected=${expectedContractRewardPoints}).`
    );
  }
  if (!bossNodeCleared || !bossSealCleared || !exitNodeCleared || !completed) {
    throw new BalanceSimulationError(
      `${definition.dungeonId}/${definition.id}: boss and exit did not settle through real APIs.`
    );
  }
  if (!routeContractLootSnapshotsEqual(lootBagBeforeExit, retainedLootAfterExit)) {
    throw new BalanceSimulationError(
      `${definition.dungeonId}/${definition.id}: route-contract settlement changed the retained run loot bag.`
    );
  }

  return {
    routeKind,
    targetNodeIds: [...definition.targetNodeIds],
    targetClearOrder,
    target2ClearedBeforeTarget1: targetClearOrder[0] === definition.targetNodeIds[1],
    contractStateBeforeExit,
    settlement: structuredClone(settlement),
    rewardPointsBeforeExit,
    rewardPointsAfterExit,
    baseExitRewardPoints: baseEconomy.rewardPoints,
    pressureRewardPoints,
    observedContractRewardPoints,
    lootBagBeforeExit,
    retainedLootAfterExit,
    lootBagUnchangedByContractSettlement: true,
    bossNodeId,
    exitNodeId: exitNode.id,
    bossNodeCleared,
    bossSealCleared,
    exitNodeCleared,
    completed,
    routeEvidence: getRouteLegalityEvidence(evidence),
    finalState: settled
  };
}

function simulateDungeonRouteContract(
  baseState: GameState,
  definition: RouteContractDefinition,
  routeKind: RouteContractSimulationKind
): EightDungeonRouteContractRunEvidence {
  const dungeonId = definition.dungeonId;
  const evidence = createRouteCombatEvidence({
    prioritizeHealing: true,
    healingTargetRatio:
      dungeonId === 'temporal_observatory' || dungeonId === 'void_citadel' ? 0.9 : 0.75,
    scriptedActions: dungeonId === 'silent_broadcast_tower'
      ? { [getBossDefinition(dungeonId).nodeId]: BROADCAST_BOSS_SURVIVAL_SCRIPT }
      : undefined
  });
  const preparedBase = dungeonId === 'redaction_scriptorium'
    ? prepareRedactionScriptoriumCombatState(baseState)
    : dungeonId === 'temporal_observatory'
    ? prepareTemporalRouteEquipment(structuredClone(baseState))
    : dungeonId === 'legacy_auction_court'
    ? prepareDeepRouteBaseState(baseState)
    : dungeonId === 'silent_broadcast_tower'
    ? prepareBroadcastRepeatHubState(baseState)
    : dungeonId === 'combat_replay_stage'
    ? prepareCombatReplayProtocolBuild(baseState, 'standard', 10)
    : dungeonId === 'panopticon_city'
    ? preparePanopticonEndgameBuild(baseState, 220)
    : structuredClone(baseState);
  const exitNodeId = DUNGEONS[dungeonId].nodes.find((node) => node.type === 'exit')?.id;
  if (!exitNodeId) throw new BalanceSimulationError(`${dungeonId} has no route-contract exit.`);

  const preparationNodeIds = dungeonId === 'false_testimony_court'
    ? []
    : STANDARD_ROUTE_PREPARATION_NODES[dungeonId] ?? [];
  let state = enterPreparedDungeon(preparedBase, dungeonId, evidence, {
    routeContractId: definition.id,
    methodTechnique: dungeonId === 'silent_broadcast_tower' ? 'live' : undefined,
    plannedNodeIds: [...definition.targetNodeIds, ...preparationNodeIds],
    additionalTacticalItemIds: dungeonId === 'silent_broadcast_tower'
      ? ['armor_patch', 'healing_pill']
      : dungeonId === 'false_testimony_court'
        ? ['armor_patch', 'healing_pill']
      : undefined,
    inventoryTargets: PRESSURE_ROUTE_INVENTORY_TARGETS
  });
  getRequiredRouteContractState(state, definition, 'after entry');

  const [target1, target2] = definition.targetNodeIds;
  if (routeKind === 'ordered') {
    state = moveAlongRoutePath(state, target1, evidence, {
      excludedNodeIds: new Set([target2, exitNodeId])
    });
    const afterTarget1 = getRequiredRouteContractState(state, definition, 'after target1');
    if (
      afterTarget1.status !== 'active' ||
      afterTarget1.completedTargetCount !== 1 ||
      state.run?.clearedNodeIds.includes(target2)
    ) {
      throw new BalanceSimulationError(
        `${dungeonId}/${definition.id}: target2 cleared before the ordered target1 checkpoint.`
      );
    }
    state = moveAlongRoutePath(state, target2, evidence, {
      excludedNodeIds: new Set([exitNodeId])
    });
  } else {
    state = moveAlongRoutePath(state, target2, evidence, {
      excludedNodeIds: new Set([target1, exitNodeId])
    });
    const afterTarget2 = getRequiredRouteContractState(state, definition, 'after target2-first control');
    if (afterTarget2.status !== 'failed' || afterTarget2.reason !== 'out_of_order') {
      throw new BalanceSimulationError(
        `${dungeonId}/${definition.id}: target2-first control did not fail with out_of_order.`
      );
    }
    state = moveAlongRoutePath(state, target1, evidence, {
      excludedNodeIds: new Set([exitNodeId])
    });
  }

  for (const nodeId of preparationNodeIds) {
    if (!state.run?.clearedNodeIds.includes(nodeId)) {
      state = moveAlongRoutePath(state, nodeId, evidence, {
        excludedNodeIds: new Set([exitNodeId]),
        broadcastRelayChoices: dungeonId === 'silent_broadcast_tower'
          ? REPEAT_BROADCAST_RELAY_CHOICES
          : undefined
      });
    }
  }

  state = collectRouteRewards(state, dungeonId, evidence);
  return settleRouteContractSimulation(state, definition, routeKind, evidence);
}

export function simulateEightDungeonRouteContracts(
  initialState?: GameState
): EightDungeonRouteContractsResult {
  const baseState = createRouteContractSimulationBaseState(initialState);
  const summaries = DUNGEON_ORDER.map((dungeonId): EightDungeonRouteContractSummary => {
    const contract = listRouteContracts(dungeonId)[0];
    if (!contract) throw new BalanceSimulationError(`${dungeonId} has no catalog route contract.`);
    const expectedRewardPoints = dungeonId === 'legacy_auction_court'
      ? 560
      : dungeonId === 'genesis_vault'
        ? 600
        : dungeonId === 'silent_broadcast_tower'
          ? 650
        : dungeonId === 'lost_shelter'
          ? 700
          : dungeonId === 'false_testimony_court'
            ? 760
          : dungeonId === 'combat_replay_stage'
            ? 820
          : dungeonId === 'panopticon_city'
            ? 880
          : 100 + DUNGEONS[dungeonId].tier * 35;
    if (contract.rewardPoints !== expectedRewardPoints) {
      throw new BalanceSimulationError(
        `${dungeonId}/${contract.id}: reward ${contract.rewardPoints} does not match ${expectedRewardPoints}.`
      );
    }

    return {
      tier: DUNGEONS[dungeonId].tier,
      dungeonId,
      dungeonName: DUNGEONS[dungeonId].name,
      contract,
      expectedRewardPoints,
      orderedRoute: simulateDungeonRouteContract(baseState, contract, 'ordered')
    };
  });

  // This pair is reachable in reverse without crossing target1, so it is a stable real-API control.
  const controlContract = listRouteContracts('demon_tower_1')[2];
  if (!controlContract) throw new BalanceSimulationError('Missing demon tower out-of-order control contract.');

  return {
    baseState,
    summaries,
    outOfOrderControl: {
      contract: controlContract,
      route: simulateDungeonRouteContract(baseState, controlContract, 'out_of_order')
    }
  };
}

export type RunPursuitFeatureKind = 'equipment_hunt' | 'equipment_memory_hunt';

export type RunPursuitMovementEvidence = Readonly<{
  playerFromNodeId: string;
  playerToNodeId: string;
  pursuitFromNodeId: string | null;
  pursuitToNodeId: string | null;
  pursuitStatusBefore: RunPursuitState['status'];
  pursuitStatusAfter: RunPursuitState['status'];
  contactsBefore: number;
  contactsAfter: number;
  graceMovesBefore: 0 | 1;
  graceMovesAfter: 0 | 1;
  moved: boolean;
  contact: boolean;
  contained: boolean;
  pursuitGridStepDistance: number;
  lawBlockedEdgeCount: number;
  unconstrainedPursuitToNodeId: string | null;
  lawChangedPursuitStep: boolean;
  predictionMatched: boolean;
  clearedNodeIdsUnchanged: boolean;
  clueStateUnchanged: boolean;
  eventStateUnchanged: boolean;
  offerStateUnchanged: boolean;
  sideSystemsUnchanged: boolean;
}>;

export type RunPursuitCoexistenceEvidence = Readonly<{
  routeContractId: string;
  routeContractActiveAtEntry: boolean;
  featureKind: RunPursuitFeatureKind;
  equipmentHuntActiveAtEntry: boolean;
  equipmentMemoryHuntActiveAtEntry: boolean;
  protocolId: RunProtocolId;
  protocolActiveAtEntry: boolean;
  pressureActiveAtEntry: boolean;
  movementIsolationPreserved: boolean;
}>;

export type EightDungeonRunPursuitSummary = Readonly<{
  tier: number;
  dungeonId: DungeonId;
  dungeonName: string;
  definition: RunPursuitDefinition;
  entryStatus: RunPursuitState['status'];
  spawnedAfterClearCount: number;
  firstNonExitClearNodeIds: readonly string[];
  spawnNodeIdObserved: string | null;
  repeatedClearPreserved: boolean;
  containmentNodeCleared: boolean;
  contained: boolean;
  lureMovements: readonly RunPursuitMovementEvidence[];
  bossNodeId: string;
  bossNodeCleared: boolean;
  exitNodeId: string;
  exitNodeCleared: boolean;
  completed: boolean;
  materialId: RunPursuitMaterialId;
  materialCountBeforeExit: number;
  materialCountAfterExit: number;
  ordinaryExitMaterialAmount: number;
  ordinaryRunMaterialAmount: number;
  pursuitMaterialDelta: number;
  settlement: RunPursuitSettlement;
  duplicateExitMaterialDelta: number;
  coexistence: RunPursuitCoexistenceEvidence;
  routeEvidence: RouteLegalityEvidence;
}>;

export type RunPursuitEntryControlEvidence = Readonly<{
  firstClearEntries: readonly Readonly<{
    dungeonId: DungeonId;
    status: RunPursuitState['status'];
    legacyDisabled: boolean;
  }>[];
  legacy: Readonly<{
    fieldAbsentBefore: boolean;
    fieldAbsentAfter: boolean;
    legacyDisabledBefore: boolean;
    legacyDisabledAfter: boolean;
    successfulPlayerMove: boolean;
    pursuitLogDelta: number;
  }>;
  malformed: Readonly<{
    snapshotBefore: string;
    snapshotAfter: string;
    legacyDisabledBefore: boolean;
    legacyDisabledAfter: boolean;
    successfulPlayerMove: boolean;
    pursuitLogDelta: number;
  }>;
}>;

export type RunPursuitMovementControlEvidence = Readonly<{
  successfulMove: RunPursuitMovementEvidence;
  repeatedClearPreserved: boolean;
  playerLawBlock: Readonly<{
    dungeonId: DungeonId;
    fromNodeId: string;
    toNodeId: string;
    blockReason: string;
    playerPositionPreserved: boolean;
    pursuitPreserved: boolean;
  }>;
  pursuitLawMove: RunPursuitMovementEvidence;
  combatMove: Readonly<{
    dungeonId: DungeonId;
    combatNodeId: string;
    attemptedTargetNodeId: string;
    combatRemainedActive: boolean;
    playerPositionPreserved: boolean;
    pursuitPreserved: boolean;
  }>;
}>;

export type RunPursuitContactControlEvidence = Readonly<{
  dungeonId: DungeonId;
  expectedDamage: number;
  hpBefore: number;
  hpAfter: number;
  runDamageBefore: number;
  runDamageAfter: number;
  contactsBefore: number;
  contactsAfter: number;
  resetSpawnNodeId: string;
  contactMove: RunPursuitMovementEvidence;
  graceMove: RunPursuitMovementEvidence;
  resumedMove: RunPursuitMovementEvidence;
}>;

type RunPursuitBossStats = Readonly<{
  maxHp: number;
  attack: number;
  artPower: number;
  defense: number;
  speed: number;
}>;

export type RunPursuitBossFusionControlEvidence = Readonly<{
  dungeonId: DungeonId;
  bossNodeId: string;
  protocolId: RunProtocolId;
  pressureClearedNodeCount: number;
  preFusionLayersMatched: boolean;
  baselineStats: RunPursuitBossStats;
  fusedStats: RunPursuitBossStats;
  finalFifteenPercentMatched: boolean;
  fusionDescriptionCount: number;
  pursuitStatusAtBoss: RunPursuitState['status'];
  pursuitMaterialDelta: number;
  settlement: RunPursuitSettlement;
}>;

export type RunPursuitPortalOutcomeEvidence = Readonly<{
  reason: 'successful_exit' | 'retreat' | 'failure';
  phase: GameState['phase'];
  materialDelta: number;
  settlement: RunPursuitSettlement;
}>;

export type RunPursuitPortalControlEvidence = Readonly<{
  sourceDungeonId: DungeonId;
  targetDungeonId: DungeonId;
  stable: Readonly<{
    targetStatus: RunPursuitState['status'];
    materialDelta: number;
    settlement: RunPursuitSettlement;
  }>;
  forced: Readonly<{
    targetStatus: RunPursuitState['status'];
    targetSpawnNodeId: string | null;
    contactsBefore: number;
    contactsAfter: number;
    graceMovesAfter: 0 | 1;
    materialDelta: number;
    settlement: RunPursuitSettlement;
    graceMove: RunPursuitMovementEvidence;
  }>;
  contained: readonly Readonly<{
    choice: 'stabilize' | 'force';
    crossedStatus: RunPursuitState['status'];
    originDungeonId: DungeonId;
    portalSettlement: RunPursuitSettlement;
    outcomes: readonly RunPursuitPortalOutcomeEvidence[];
  }>[];
}>;

export type EightDungeonRunPursuitsResult = Readonly<{
  baseState: GameState;
  summaries: readonly EightDungeonRunPursuitSummary[];
  controls: Readonly<{
    entry: RunPursuitEntryControlEvidence;
    movement: RunPursuitMovementControlEvidence;
    contact: RunPursuitContactControlEvidence;
    bossFusion: RunPursuitBossFusionControlEvidence;
    portals: RunPursuitPortalControlEvidence;
  }>;
}>;

type RunPursuitChapterExecution = Readonly<{
  summary: EightDungeonRunPursuitSummary;
  spawnedState: GameState;
  containedState: GameState;
  settledState: GameState;
}>;

type RunPursuitSpawnExecution = Readonly<{
  state: GameState;
  firstNonExitClearNodeIds: readonly string[];
}>;

type RunPursuitPlannedMove = Readonly<{
  state: GameState;
  evidence: RunPursuitMovementEvidence;
}>;

function getRequiredLiveRunPursuitState(state: GameState, checkpoint: string): RunPursuitState {
  const pursuitState = state.run?.pursuitState;
  const current = getCurrentRunPursuit(state);
  if (
    !state.run ||
    !pursuitState ||
    current.legacyDisabled ||
    !current.progress ||
    current.progress.status !== pursuitState.status ||
    pursuitState.dungeonId !== state.run.dungeonId
  ) {
    throw new BalanceSimulationError(`${checkpoint}: live pursuit state is missing or malformed.`);
  }
  return pursuitState;
}

function getRunPursuitBlockedEdges(state: GameState): Array<{ fromNodeId: string; toNodeId: string }> {
  if (!state.run) return [];
  const lawState = getCurrentDungeonLaw(state)?.state;
  if (!lawState) return [];

  return getDungeonRouteGates(state.run.dungeonId)
    .filter((gate) => getRouteBlockReason(state.run!.dungeonId, gate.fromNodeId, gate.toNodeId, lawState))
    .map((gate) => ({ fromNodeId: gate.fromNodeId, toNodeId: gate.toNodeId }));
}

function getRunPursuitTopologyInput(
  state: GameState,
  playerNodeId: string,
  containmentReady: boolean,
  blockedEdges = getRunPursuitBlockedEdges(state)
) {
  if (!state.run) throw new BalanceSimulationError('Cannot build pursuit topology without an active run.');
  return {
    nodes: DUNGEONS[state.run.dungeonId].nodes.map((node) => ({
      id: node.id,
      x: node.position.x,
      y: node.position.y
    })),
    blockedEdges,
    playerNodeId,
    containmentReady
  };
}

function getDirectedRunPursuitDistance(
  state: GameState,
  startNodeId: string | null,
  targetNodeId: string,
  blockedEdges = getRunPursuitBlockedEdges(state)
): number {
  if (!state.run || startNodeId === null) return Number.POSITIVE_INFINITY;
  if (startNodeId === targetNodeId) return 0;
  const dungeon = DUNGEONS[state.run.dungeonId];
  const nodeById = new Map(dungeon.nodes.map((node) => [node.id, node]));
  const blocked = new Set(blockedEdges.map((edge) => `${edge.fromNodeId}\u0000${edge.toNodeId}`));
  const queue: Array<{ nodeId: string; distance: number }> = [{ nodeId: startNodeId, distance: 0 }];
  const visited = new Set([startNodeId]);

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    const currentNode = nodeById.get(current.nodeId);
    if (!currentNode) continue;
    const neighbors = dungeon.nodes
      .filter(
        (candidate) =>
          !visited.has(candidate.id) &&
          areAdjacentRouteNodes(currentNode, candidate) &&
          !blocked.has(`${current.nodeId}\u0000${candidate.id}`)
      )
      .sort((left, right) => left.id.localeCompare(right.id));
    for (const neighbor of neighbors) {
      if (neighbor.id === targetNodeId) return current.distance + 1;
      visited.add(neighbor.id);
      queue.push({ nodeId: neighbor.id, distance: current.distance + 1 });
    }
  }
  return Number.POSITIVE_INFINITY;
}

function getRunPursuitIsolationProjection(state: GameState): string {
  const run = state.run;
  if (!run) return 'no-run';
  const lawState = run.lawState?.law.kind === 'panopticon_city'
    ? {
        ...run.lawState,
        law: {
          ...run.lawState.law,
          scanPhase: 0,
          moveCount: 0,
          exposureCount: 0,
          refractionCharges: 0,
          decoyRewardsGranted: 0,
          predictiveVisorProtectionUsed: [false, false, false]
        }
      }
    : run.lawState;
  return JSON.stringify({
    clearedNodeIds: run.clearedNodeIds,
    resolvedEventIds: run.resolvedEventIds,
    eventLog: run.eventLog,
    lootBag: run.lootBag,
    lootOffersMade: run.lootOffersMade,
    pendingEquipmentOffer: run.pendingEquipmentOffer,
    equipmentHunt: run.equipmentHunt,
    equipmentMemoryHunt: run.equipmentMemoryHunt,
    routeContractState: run.routeContractState,
    protocol: run.protocol,
    pressureState: run.pressureState,
    lawState
  });
}

function getGridStepDistance(
  dungeonId: DungeonId,
  fromNodeId: string | null,
  toNodeId: string | null
): number {
  if (fromNodeId === null || toNodeId === null) return 0;
  const dungeon = DUNGEONS[dungeonId];
  const from = dungeon.nodes.find((node) => node.id === fromNodeId);
  const to = dungeon.nodes.find((node) => node.id === toNodeId);
  return from && to
    ? Math.abs(from.position.x - to.position.x) + Math.abs(from.position.y - to.position.y)
    : 0;
}

function executePredictedRunPursuitMove(
  state: GameState,
  targetNodeId: string,
  containmentReady: boolean,
  evidence?: RouteCombatEvidence
): RunPursuitPlannedMove {
  state = resolvePendingEntropyHeadingForTarget(state, targetNodeId, evidence);
  if (!state.run) throw new BalanceSimulationError('Cannot move a pursuit without an active run.');
  const pursuitBefore = getRequiredLiveRunPursuitState(state, 'before predicted pursuit move');
  const blockedEdges = getRunPursuitBlockedEdges(state);
  const prediction = advanceRunPursuit(
    pursuitBefore,
    getRunPursuitTopologyInput(state, targetNodeId, containmentReady, blockedEdges)
  );
  const unconstrainedPrediction = advanceRunPursuit(
    pursuitBefore,
    getRunPursuitTopologyInput(state, targetNodeId, containmentReady, [])
  );
  const playerFromNodeId = state.run.currentNodeId;
  const sideProjectionBefore = getRunPursuitIsolationProjection(state);
  const clearedNodeIdsBefore = JSON.stringify(state.run.clearedNodeIds);
  const clueStateBefore = JSON.stringify({
    equipmentHunt: state.run.equipmentHunt,
    equipmentMemoryHunt: state.run.equipmentMemoryHunt
  });
  const eventStateBefore = JSON.stringify({
    resolvedEventIds: state.run.resolvedEventIds,
    eventLog: state.run.eventLog
  });
  const offerStateBefore = JSON.stringify({
    lootOffersMade: state.run.lootOffersMade,
    pendingEquipmentOffer: state.run.pendingEquipmentOffer
  });
  const gateStatus = getCurrentRouteGateStatus(state, targetNodeId);
  const blockReason = getCurrentRouteBlockReason(state, targetNodeId);
  evidence?.routeMovements.push({
    fromNodeId: playerFromNodeId,
    toNodeId: targetNodeId,
    legal: blockReason === undefined,
    routeGateId: gateStatus?.gate.id,
    blockReason
  });
  if (gateStatus) recordRouteGateEvidence(evidence, gateStatus, blockReason === undefined);

  const moved = moveToNode(state, targetNodeId);
  if (moved.run?.currentNodeId !== targetNodeId) {
    throw getDangerResolutionError(moved, targetNodeId, 'predicted legal pursuit move was blocked for the player');
  }
  const pursuitAfter = getRequiredLiveRunPursuitState(moved, 'after predicted pursuit move');
  if (!moved.run) throw new BalanceSimulationError('Predicted pursuit movement lost its active run.');
  const predictionMatched = JSON.stringify(pursuitAfter) === JSON.stringify(prediction.state);
  if (!predictionMatched) {
    throw new BalanceSimulationError(
      `${state.run.dungeonId}: pursuit prediction diverged on ${playerFromNodeId}->${targetNodeId}; ` +
        `predicted=${JSON.stringify(prediction.state)} actual=${JSON.stringify(pursuitAfter)}.`
    );
  }

  return {
    state: moved,
    evidence: {
      playerFromNodeId,
      playerToNodeId: targetNodeId,
      pursuitFromNodeId: prediction.from,
      pursuitToNodeId: prediction.to,
      pursuitStatusBefore: pursuitBefore.status,
      pursuitStatusAfter: pursuitAfter.status,
      contactsBefore: pursuitBefore.contacts,
      contactsAfter: pursuitAfter.contacts,
      graceMovesBefore: pursuitBefore.graceMoves,
      graceMovesAfter: pursuitAfter.graceMoves,
      moved: prediction.moved,
      contact: prediction.contact,
      contained: prediction.contained,
      pursuitGridStepDistance: prediction.moved
        ? getGridStepDistance(state.run.dungeonId, prediction.from, prediction.to)
        : 0,
      lawBlockedEdgeCount: blockedEdges.length,
      unconstrainedPursuitToNodeId: unconstrainedPrediction.to,
      lawChangedPursuitStep:
        blockedEdges.length > 0 &&
        JSON.stringify(prediction.state) !== JSON.stringify(unconstrainedPrediction.state),
      predictionMatched,
      clearedNodeIdsUnchanged: clearedNodeIdsBefore === JSON.stringify(moved.run.clearedNodeIds),
      clueStateUnchanged: clueStateBefore === JSON.stringify({
        equipmentHunt: moved.run.equipmentHunt,
        equipmentMemoryHunt: moved.run.equipmentMemoryHunt
      }),
      eventStateUnchanged: eventStateBefore === JSON.stringify({
        resolvedEventIds: moved.run.resolvedEventIds,
        eventLog: moved.run.eventLog
      }),
      offerStateUnchanged: offerStateBefore === JSON.stringify({
        lootOffersMade: moved.run.lootOffersMade,
        pendingEquipmentOffer: moved.run.pendingEquipmentOffer
      }),
      sideSystemsUnchanged:
        sideProjectionBefore === getRunPursuitIsolationProjection(moved)
    }
  };
}

function resolveCurrentRunPursuitRouteNode(
  state: GameState,
  evidence: RouteCombatEvidence
): GameState {
  return resolvePendingPanopticonRoute(resolvePendingEscortCheckpoint(resolvePendingBroadcastRelay(resolvePendingAuctionLot(
    resolvePendingRedactionClause(
      collectCurrentRouteReward(resolveCurrentDanger(state, evidence), evidence)
    ),
    evidence,
    STANDARD_AUCTION_LOT_CHOICES
  ), evidence, STANDARD_BROADCAST_RELAY_CHOICES), evidence, STANDARD_ESCORT_CHECKPOINT_CHOICES), 'shadow');
}

function clearLiveRunUntilPursuitSpawns(
  entered: GameState,
  preferredNodeIds: readonly string[],
  evidence: RouteCombatEvidence,
  excludedNodeIds: ReadonlySet<string> = new Set()
): RunPursuitSpawnExecution {
  if (!entered.run) throw new BalanceSimulationError('Live pursuit spawn route did not enter a dungeon.');
  const dungeon = DUNGEONS[entered.run.dungeonId];
  const bossNodeId = getBossDefinition(entered.run.dungeonId).nodeId;
  const permanentExclusions = new Set([
    ...excludedNodeIds,
    bossNodeId,
    ...dungeon.nodes.filter((node) => node.type === 'exit').map((node) => node.id)
  ]);
  const candidates = [...new Set([
    ...preferredNodeIds,
    ...dungeon.nodes
      .filter((node) => node.type !== 'exit' && node.type !== 'portal' && node.id !== bossNodeId)
      .map((node) => node.id)
  ])].filter((nodeId) => !permanentExclusions.has(nodeId));
  let state = entered;
  let candidateIndex = 0;

  const resolveAndCheckSpawn = (): RunPursuitSpawnExecution | undefined => {
    const before = getRequiredLiveRunPursuitState(state, 'before first-clear pursuit checkpoint');
    const beforeClears = state.run?.clearedNodeIds.length ?? 0;
    state = resolveCurrentRunPursuitRouteNode(state, evidence);
    if (!state.run) throw new BalanceSimulationError('Live pursuit route ended during a node clear.');
    const after = getRequiredLiveRunPursuitState(state, 'after first-clear pursuit checkpoint');
    if (after.status !== 'stalking') return undefined;
    if (
      before.status !== 'dormant' ||
      beforeClears !== RUN_PURSUIT_SPAWN_CLEAR_COUNT - 1 ||
      state.run.clearedNodeIds.length !== RUN_PURSUIT_SPAWN_CLEAR_COUNT ||
      after.nodeId !== RUN_PURSUIT_CATALOG[state.run.dungeonId].spawnNodeId
    ) {
      throw new BalanceSimulationError(
        `${state.run.dungeonId}: pursuit did not spawn exactly on first non-exit clear ${RUN_PURSUIT_SPAWN_CLEAR_COUNT}.`
      );
    }
    return {
      state,
      firstNonExitClearNodeIds: [...state.run.clearedNodeIds]
    };
  };

  const initialSpawn = resolveAndCheckSpawn();
  if (initialSpawn) return initialSpawn;

  for (let stepCount = 0; stepCount < dungeon.nodes.length * 8; stepCount += 1) {
    const currentPursuit = getRequiredLiveRunPursuitState(state, 'during live pursuit spawn route');
    if (currentPursuit.status === 'stalking') {
      return {
        state,
        firstNonExitClearNodeIds: [...(state.run?.clearedNodeIds ?? [])]
      };
    }

    while (
      candidateIndex < candidates.length &&
      (state.run?.clearedNodeIds.includes(candidates[candidateIndex]) ||
        state.run?.currentNodeId === candidates[candidateIndex])
    ) {
      candidateIndex += 1;
    }
    const targetNodeId = candidates[candidateIndex];
    if (!targetNodeId) break;

    let nextNodeId: string | undefined;
    try {
      nextNodeId = findAdjacentRoutePath(state, targetNodeId, evidence, permanentExclusions)[0];
    } catch {
      candidateIndex += 1;
      continue;
    }
    if (!nextNodeId) {
      candidateIndex += 1;
      continue;
    }
    state = moveAlongRoutePath(state, nextNodeId, evidence, {
      excludedNodeIds: permanentExclusions,
      resolveTargetDanger: false,
      collectTargetReward: false,
      skipRedactionPreparation: true
    });
    const spawned = resolveAndCheckSpawn();
    if (spawned) return spawned;
  }

  throw new BalanceSimulationError(
    `${entered.run.dungeonId}: unable to reach ${RUN_PURSUIT_SPAWN_CLEAR_COUNT} real first clears.`
  );
}

function planNextRunPursuitContainmentMove(
  state: GameState,
  maximumContacts: number,
  clearedOnly = false
): string | undefined {
  if (!state.run) return undefined;
  const initialPursuit = getRequiredLiveRunPursuitState(state, 'before containment planning');
  const blockedEdges = getRunPursuitBlockedEdges(state);
  const dungeon = DUNGEONS[state.run.dungeonId];
  const bossNodeId = getBossDefinition(state.run.dungeonId).nodeId;
  const traversableNodeIds = new Set(
    dungeon.nodes
      .filter(
        (node) =>
          node.id !== bossNodeId &&
          node.type !== 'exit' &&
          (state.run!.clearedNodeIds.includes(node.id) ||
            (!clearedOnly && (node.type === 'reward' || node.type === 'portal')))
      )
      .map((node) => node.id)
  );
  type PlannedState = {
    playerNodeId: string;
    pursuitState: RunPursuitState;
    firstMoveNodeId?: string;
    cost: number;
    moveCount: number;
  };
  const queue: PlannedState[] = [{
    playerNodeId: state.run.currentNodeId,
    pursuitState: initialPursuit,
    cost: 0,
    moveCount: 0
  }];
  const initialKey = `${state.run.currentNodeId}|${initialPursuit.nodeId}|${initialPursuit.graceMoves}|${initialPursuit.contacts}`;
  const bestCost = new Map([[initialKey, 0]]);

  for (let explored = 0; queue.length > 0 && explored < 4096; explored += 1) {
    queue.sort(
      (left, right) =>
        left.cost - right.cost ||
        left.moveCount - right.moveCount ||
        left.playerNodeId.localeCompare(right.playerNodeId)
    );
    const current = queue.shift()!;
    const currentKey = [
      current.playerNodeId,
      current.pursuitState.nodeId,
      current.pursuitState.graceMoves,
      current.pursuitState.contacts
    ].join('|');
    if (current.cost !== bestCost.get(currentKey)) continue;
    const routeState: GameState = {
      ...state,
      run: {
        ...state.run,
        currentNodeId: current.playerNodeId,
        pursuitState: current.pursuitState
      }
    };
    const targetNodeIds = getCurrentLegalAdjacentTargetIds(routeState)
      .filter((nodeId) => traversableNodeIds.has(nodeId))
      .sort();
    for (const targetNodeId of targetNodeIds) {
      const prediction = advanceRunPursuit(
        current.pursuitState,
        getRunPursuitTopologyInput(routeState, targetNodeId, true, blockedEdges)
      );
      const firstMoveNodeId = current.firstMoveNodeId ?? targetNodeId;
      if (prediction.contained) return firstMoveNodeId;
      if (
        prediction.state.status !== 'stalking' ||
        prediction.state.contacts > maximumContacts
      ) {
        continue;
      }
      const key = [
        targetNodeId,
        prediction.state.nodeId,
        prediction.state.graceMoves,
        prediction.state.contacts
      ].join('|');
      const nextCost = current.cost + 1 + (prediction.contact ? 1_000 : 0);
      if (nextCost >= (bestCost.get(key) ?? Number.POSITIVE_INFINITY)) continue;
      bestCost.set(key, nextCost);
      queue.push({
        playerNodeId: targetNodeId,
        pursuitState: prediction.state,
        firstMoveNodeId,
        cost: nextCost,
        moveCount: current.moveCount + 1
      });
    }
  }
  return undefined;
}

function lureLiveRunPursuitIntoContainment(
  start: GameState,
  evidence: RouteCombatEvidence,
  clearedOnly = false
): { state: GameState; movements: RunPursuitMovementEvidence[] } {
  if (!start.run) throw new BalanceSimulationError('Cannot lure a pursuit without an active run.');
  const definition = RUN_PURSUIT_CATALOG[start.run.dungeonId];
  if (!start.run.clearedNodeIds.includes(definition.containmentNodeId)) {
    throw new BalanceSimulationError(`${start.run.dungeonId}: containment node is not cleared before luring.`);
  }

  let state = start;
  const movements: RunPursuitMovementEvidence[] = [];
  const maximumContacts = getRequiredLiveRunPursuitState(start, 'before containment lure contact budget').contacts + 3;
  for (let stepCount = 0; stepCount < 96; stepCount += 1) {
    const pursuit = getRequiredLiveRunPursuitState(state, 'before containment lure');
    if (pursuit.status === 'contained') return { state, movements };
    if (pursuit.status !== 'stalking') {
      throw new BalanceSimulationError(
        `${state.run?.dungeonId ?? 'unknown'}: containment lure left stalking as ${pursuit.status}.`
      );
    }
    const blockedEdges = getRunPursuitBlockedEdges(state);
    const bossNodeId = getBossDefinition(state.run!.dungeonId).nodeId;
    const candidates = getCurrentLegalAdjacentTargetIds(state)
      .filter((nodeId) => {
        const node = DUNGEONS[state.run!.dungeonId].nodes.find((candidate) => candidate.id === nodeId);
        return Boolean(
          node &&
          node.id !== bossNodeId &&
          node.type !== 'exit' &&
          (!clearedOnly || state.run!.clearedNodeIds.includes(nodeId))
        );
      })
      .map((nodeId) => {
        const prediction = advanceRunPursuit(
          pursuit,
          getRunPursuitTopologyInput(state, nodeId, true, blockedEdges)
        );
        const predictedDistance = getDirectedRunPursuitDistance(
          state,
          prediction.state.nodeId,
          definition.containmentNodeId,
          blockedEdges
        );
        return { nodeId, prediction, predictedDistance };
      })
      .sort(
        (left, right) =>
          Number(right.prediction.contained) - Number(left.prediction.contained) ||
          Number(left.prediction.contact) - Number(right.prediction.contact) ||
          left.predictedDistance - right.predictedDistance ||
          left.nodeId.localeCompare(right.nodeId)
      );
    const plannedNodeId = planNextRunPursuitContainmentMove(state, maximumContacts, clearedOnly);
    const selected = candidates.find((candidate) => candidate.nodeId === plannedNodeId) ?? candidates[0];
    if (!selected) {
      throw new BalanceSimulationError(`${state.run!.dungeonId}: containment lure has no legal player move.`);
    }
    const moved = executePredictedRunPursuitMove(state, selected.nodeId, true, evidence);
    movements.push(moved.evidence);
    state = moved.state;
    if (getRequiredLiveRunPursuitState(state, 'after containment lure move').status === 'contained') {
      return { state, movements };
    }
    state = resolveCurrentRunPursuitRouteNode(state, evidence);
    if (state.phase === 'result' || !state.run) {
      throw new BalanceSimulationError(`${start.run.dungeonId}: containment lure ended the run before containment.`);
    }
  }
  throw new BalanceSimulationError(
    `${start.run.dungeonId}: containment lure exceeded 96 real player moves; ` +
      `trace=${movements.map((move) => `${move.playerFromNodeId}->${move.playerToNodeId}/${move.pursuitFromNodeId}->${move.pursuitToNodeId}`).join(',')}`
  );
}

function getRunPursuitChapterFeatureNodeIds(
  dungeonId: DungeonId,
  featureKind: RunPursuitFeatureKind
): string[] {
  if (featureKind === 'equipment_hunt') {
    return [...EQUIPMENT_HUNT_DEFINITIONS[dungeonId].clueNodeIds];
  }
  const memory = EQUIPMENT_MEMORY_CATALOG.find((definition) => definition.dungeonId === dungeonId);
  if (!memory) throw new BalanceSimulationError(`${dungeonId}: missing equipment memory coexistence host.`);
  return [memory.nodeId];
}

function enterLiveRunPursuitChapter(
  baseState: GameState,
  dungeonId: DungeonId,
  chapterIndex: number,
  equipmentHuntTargets: Readonly<Record<DungeonId, EquipmentId>>,
  evidence: RouteCombatEvidence
): {
  state: GameState;
  definition: RunPursuitDefinition;
  contract: RouteContractDefinition;
  protocolRequiredNodeIds: readonly string[];
  preferredClearNodeIds: readonly string[];
  coexistence: Omit<RunPursuitCoexistenceEvidence, 'movementIsolationPreserved'>;
} {
  const definition = RUN_PURSUIT_CATALOG[dungeonId];
  const contract = listRouteContracts(dungeonId)[0];
  if (!contract) throw new BalanceSimulationError(`${dungeonId}: missing route contract for pursuit coexistence.`);
  const featureKind: RunPursuitFeatureKind = chapterIndex % 2 === 0
    ? 'equipment_hunt'
    : 'equipment_memory_hunt';
  const mirrorEquipmentIds = (['parallax_visor', 'phaseweave_mantle', 'homecoming_prism'] as const).filter(
    (equipmentId) => featureKind !== 'equipment_hunt' || equipmentId !== equipmentHuntTargets[dungeonId]
  );
  let prepared = dungeonId === 'combat_replay_stage'
    ? prepareCombatReplayProtocolBuild(baseState, 'imprint', 10)
    : dungeonId === 'redaction_scriptorium'
    ? prepareRedactionScriptoriumCombatState(
        baseState,
        featureKind === 'equipment_memory_hunt' ? EQUIPMENT_MEMORY_PRIMARY_TARGET : undefined
      )
    : dungeonId === 'mirror_cycle_city'
    ? prepareMirrorCycleCityRouteState(baseState, mirrorEquipmentIds)
    : structuredClone(baseState);
  if (featureKind === 'equipment_hunt') {
    prepared = prepareEquipmentHunt(prepared, dungeonId, equipmentHuntTargets[dungeonId]);
  } else {
    prepared = equipEquipment(prepared, EQUIPMENT_MEMORY_PRIMARY_TARGET);
    prepared = prepareEquipmentMemoryHunt(prepared, dungeonId, EQUIPMENT_MEMORY_PRIMARY_TARGET);
    if (!prepared.preparedEquipmentMemoryHunt) {
      const status = getEquipmentMemoryHuntPreparationStatus(
        prepared,
        dungeonId
      );
      throw new BalanceSimulationError(
        `${dungeonId}: pursuit equipment-memory preparation failed: ${status.unavailableReason ?? 'unknown'}.`
      );
    }
  }

  const protocol = getRunProtocolDefinition(dungeonId, 'imprint');
  if (!protocol) throw new BalanceSimulationError(`${dungeonId}: missing imprint protocol for pursuit coexistence.`);
  const protocolRequiredNodeIds = getRunProtocolRequiredNodeIds(protocol);
  const featureNodeIds = getRunPursuitChapterFeatureNodeIds(dungeonId, featureKind);
  const portalNodeIds = DUNGEONS[dungeonId].nodes
    .filter((node) => node.type === 'portal')
    .map((node) => node.id);
  const firstStableItem = DUNGEONS[dungeonId].nodes
    .find((node) => node.portal?.stableItem)?.portal?.stableItem;
  const additionalTacticalItemIds = [
    firstStableItem,
    'healing_pill',
    ...(dungeonId === 'silent_broadcast_tower' ? ['armor_patch'] as const : []),
    ...(dungeonId === 'legacy_auction_court' ? ['focus_incense', 'armor_patch'] as const : [])
  ]
    .filter((itemId): itemId is TacticalItemId => Boolean(itemId && isTacticalItemId(itemId)));
  const preferredClearNodeIds = [...new Set([
    definition.containmentNodeId,
    ...protocolRequiredNodeIds,
    ...contract.targetNodeIds,
    ...featureNodeIds,
    ...(EQUIPMENT_HUNT_BOSS_LAW_NODES[dungeonId] ?? []),
    ...(STANDARD_ROUTE_PREPARATION_NODES[dungeonId] ?? [])
  ])];
  const entered = enterPreparedDungeon(prepared, dungeonId, evidence, {
    protocolId: 'imprint',
    routeContractId: contract.id,
    runPursuit: 'live',
    methodTechnique: dungeonId === 'silent_broadcast_tower' ? 'live' : undefined,
    plannedNodeIds: [...preferredClearNodeIds, ...portalNodeIds],
    portalUseNodeIds: portalNodeIds,
    additionalTacticalItemIds,
    inventoryTargets: Object.fromEntries(
      (Object.keys(prepared.inventory) as ItemId[])
        .filter(isTacticalItemId)
        .map((itemId) => [itemId, 64])
    )
  });
  const pursuit = getRequiredLiveRunPursuitState(entered, `${dungeonId} pursuit entry`);
  const hunt = getCurrentEquipmentHuntStatus(entered);
  const memoryHunt = getCurrentEquipmentMemoryHuntStatus(entered);
  const currentProtocol = getCurrentRunProtocol(entered);
  const pressure = getCurrentRunPressure(entered);
  const coexistence = {
    routeContractId: contract.id,
    routeContractActiveAtEntry:
      entered.run?.routeContractState?.contractId === contract.id &&
      entered.run.routeContractState.status === 'active',
    featureKind,
    equipmentHuntActiveAtEntry: featureKind === 'equipment_hunt' && hunt.enabled,
    equipmentMemoryHuntActiveAtEntry:
      featureKind === 'equipment_memory_hunt' && memoryHunt.state?.status === 'active',
    protocolId: 'imprint' as const,
    protocolActiveAtEntry: currentProtocol?.snapshot.id === 'imprint',
    pressureActiveAtEntry: !pressure.legacyDisabled && pressure.status !== undefined
  };
  if (
    pursuit.status !== 'dormant' ||
    !coexistence.routeContractActiveAtEntry ||
    !coexistence.protocolActiveAtEntry ||
    !coexistence.pressureActiveAtEntry ||
    (featureKind === 'equipment_hunt' && !coexistence.equipmentHuntActiveAtEntry) ||
    (featureKind === 'equipment_memory_hunt' && !coexistence.equipmentMemoryHuntActiveAtEntry)
  ) {
    throw new BalanceSimulationError(
      `${dungeonId}: pursuit coexistence systems were not active at entry: ${JSON.stringify(coexistence)}.`
    );
  }

  return {
    state: entered,
    definition,
    contract,
    protocolRequiredNodeIds,
    preferredClearNodeIds,
    coexistence
  };
}

function completeContainedRunPursuitChapter(
  containedState: GameState,
  dungeonId: DungeonId,
  contract: RouteContractDefinition,
  protocolRequiredNodeIds: readonly string[],
  evidence: RouteCombatEvidence
): { exitReady: GameState; settled: GameState; repeated: GameState; exitNodeId: string } {
  let state = containedState;
  const exitNodeId = DUNGEONS[dungeonId].nodes.find((node) => node.type === 'exit')?.id;
  if (!exitNodeId) throw new BalanceSimulationError(`${dungeonId}: pursuit route has no exit.`);
  const preparationNodeIds = [...new Set([
    ...protocolRequiredNodeIds,
    ...(EQUIPMENT_HUNT_BOSS_LAW_NODES[dungeonId] ?? []),
    ...(STANDARD_ROUTE_PREPARATION_NODES[dungeonId] ?? []),
    ...contract.targetNodeIds
  ])];
  for (const nodeId of preparationNodeIds) {
    if (!state.run?.clearedNodeIds.includes(nodeId)) {
      state = moveAlongRoutePath(state, nodeId, evidence, {
        excludedNodeIds: new Set([exitNodeId])
      });
    }
  }
  state = prepareEquipmentHuntBossLaw(state, dungeonId, evidence);
  const exitReady = collectRouteRewards(state, dungeonId, evidence);
  assertBossSealCleared(exitReady, dungeonId, 'before live pursuit exit');
  const settled = resolvePendingRunRelicArchive(resolveExit(exitReady));
  const repeated = resolveExit(settled);
  return { exitReady, settled, repeated, exitNodeId };
}

function simulateLiveRunPursuitChapter(
  baseState: GameState,
  dungeonId: DungeonId,
  chapterIndex: number,
  equipmentHuntTargets: Readonly<Record<DungeonId, EquipmentId>>
): RunPursuitChapterExecution {
  const evidence = createRouteCombatEvidence({
    prioritizeHealing: true,
    healingTargetRatio: 0.9,
    scriptedActions: EQUIPMENT_HUNT_SCRIPTED_ACTIONS[dungeonId]
  });
  const pursuitBaseState = dungeonId === 'panopticon_city'
    ? preparePanopticonEndgameBuild(
        baseState,
        240,
        chapterIndex % 2 === 0 ? equipmentHuntTargets[dungeonId] : undefined
      )
    : baseState;
  const entry = enterLiveRunPursuitChapter(
    dungeonId === 'silent_broadcast_tower'
      ? prepareBroadcastRepeatHubState(
          prepareDeepRouteBaseState(baseState),
          equipmentHuntTargets[dungeonId]
        )
      : dungeonId === 'lost_shelter'
        ? prepareDeepRouteState(
            prepareLostShelterSpecializationHubState(
              prepareDeepRouteBaseState(baseState),
              'completed_replay',
              false
            ).state,
            dungeonId
          )
      : dungeonId === 'entropy_ark' ||
      dungeonId === 'legacy_auction_court' ||
      dungeonId === 'genesis_vault'
      ? prepareDeepRouteBaseState(pursuitBaseState)
      : pursuitBaseState,
    dungeonId,
    chapterIndex,
    equipmentHuntTargets,
    evidence
  );
  const entryStatus = getRequiredLiveRunPursuitState(entry.state, `${dungeonId} entry status`).status;
  const spawned = clearLiveRunUntilPursuitSpawns(
    entry.state,
    entry.preferredClearNodeIds,
    evidence
  );
  const spawnedPursuit = getRequiredLiveRunPursuitState(spawned.state, `${dungeonId} spawned state`);
  let pursuitStart = spawned.state;
  const preLureMovements: RunPursuitMovementEvidence[] = [];
  if (
    spawnedPursuit.nodeId === entry.definition.containmentNodeId ||
    dungeonId === 'false_testimony_court'
  ) {
    const bossNodeId = getBossDefinition(dungeonId).nodeId;
    const firstMoveNodeId = getCurrentLegalAdjacentTargetIds(pursuitStart).find((nodeId) => {
      const node = DUNGEONS[dungeonId].nodes.find((candidate) => candidate.id === nodeId);
      return Boolean(
        node &&
        pursuitStart.run?.clearedNodeIds.includes(node.id) &&
        node.id !== entry.definition.containmentNodeId &&
        node.id !== bossNodeId &&
        node.type !== 'exit'
      );
    });
    if (!firstMoveNodeId) {
      throw new BalanceSimulationError(`${dungeonId}: pursuit containment spawn has no legal setup move.`);
    }
    const moved = executePredictedRunPursuitMove(pursuitStart, firstMoveNodeId, true, evidence);
    pursuitStart = moved.state;
    preLureMovements.push(moved.evidence);
  }
  const repeatedClearState = resolveCurrentRunPursuitRouteNode(pursuitStart, evidence);
  const repeatedClearPreserved =
    JSON.stringify(repeatedClearState.run?.clearedNodeIds) ===
      JSON.stringify(pursuitStart.run?.clearedNodeIds) &&
    JSON.stringify(repeatedClearState.run?.pursuitState) ===
      JSON.stringify(pursuitStart.run?.pursuitState);

  let containmentReady = pursuitStart;
  if (!containmentReady.run?.clearedNodeIds.includes(entry.definition.containmentNodeId)) {
    containmentReady = moveAlongRoutePath(
      containmentReady,
      entry.definition.containmentNodeId,
      evidence
    );
  }
  if (
    !containmentReady.run?.clearedNodeIds.includes(entry.definition.containmentNodeId) ||
    containmentReady.phase === 'result'
  ) {
    throw new BalanceSimulationError(`${dungeonId}: real containment node clear failed.`);
  }
  const lured = lureLiveRunPursuitIntoContainment(containmentReady, evidence);
  const containedPursuit = getRequiredLiveRunPursuitState(lured.state, `${dungeonId} contained state`);
  if (
    containedPursuit.status !== 'contained' ||
    containedPursuit.nodeId !== entry.definition.containmentNodeId
  ) {
    throw new BalanceSimulationError(`${dungeonId}: pursuit did not enter its authored containment node.`);
  }

  const completion = completeContainedRunPursuitChapter(
    lured.state,
    dungeonId,
    entry.contract,
    entry.protocolRequiredNodeIds,
    evidence
  );
  const settlement = getCurrentRunPursuit(completion.settled).lastSettlement;
  if (!settlement) throw new BalanceSimulationError(`${dungeonId}: pursuit exit settlement is missing.`);
  const materialId = entry.definition.materialId;
  const materialCountBeforeExit = completion.exitReady.inventory[materialId];
  const materialCountAfterExit = completion.settled.inventory[materialId];
  const ordinaryExitMaterialAmount =
    DUNGEONS[dungeonId].nodes.find((node) => node.id === completion.exitNodeId)?.reward?.items?.[materialId] ?? 0;
  const ordinaryRunMaterialAmount =
    ordinaryExitMaterialAmount +
    (dungeonId === 'legacy_auction_court'
      ? completion.exitReady.run?.lootBag.items[materialId] ?? 0
      : 0);
  const pursuitMaterialDelta =
    materialCountAfterExit - materialCountBeforeExit - ordinaryRunMaterialAmount;
  const bossNodeId = getBossDefinition(dungeonId).nodeId;
  const summary: EightDungeonRunPursuitSummary = {
    tier: DUNGEONS[dungeonId].tier,
    dungeonId,
    dungeonName: DUNGEONS[dungeonId].name,
    definition: entry.definition,
    entryStatus,
    spawnedAfterClearCount: spawned.state.run?.clearedNodeIds.length ?? 0,
    firstNonExitClearNodeIds: spawned.firstNonExitClearNodeIds,
    spawnNodeIdObserved: spawnedPursuit.nodeId,
    repeatedClearPreserved,
    containmentNodeCleared:
      lured.state.run?.clearedNodeIds.includes(entry.definition.containmentNodeId) ?? false,
    contained: containedPursuit.status === 'contained',
    lureMovements: [...preLureMovements, ...lured.movements],
    bossNodeId,
    bossNodeCleared: completion.settled.run?.clearedNodeIds.includes(bossNodeId) ?? false,
    exitNodeId: completion.exitNodeId,
    exitNodeCleared:
      completion.settled.run?.clearedNodeIds.includes(completion.exitNodeId) ?? false,
    completed: completion.settled.phase === 'result',
    materialId,
    materialCountBeforeExit,
    materialCountAfterExit,
    ordinaryExitMaterialAmount,
    ordinaryRunMaterialAmount,
    pursuitMaterialDelta,
    settlement,
    duplicateExitMaterialDelta:
      completion.repeated.inventory[materialId] - completion.settled.inventory[materialId],
    coexistence: {
      ...entry.coexistence,
      movementIsolationPreserved: lured.movements.every((movement) => movement.sideSystemsUnchanged)
    },
    routeEvidence: getRouteLegalityEvidence(evidence)
  };
  if (
    summary.spawnedAfterClearCount !== RUN_PURSUIT_SPAWN_CLEAR_COUNT ||
    summary.spawnNodeIdObserved !== entry.definition.spawnNodeId ||
    !summary.repeatedClearPreserved ||
    !summary.contained ||
    !summary.bossNodeCleared ||
    !summary.exitNodeCleared ||
    !summary.completed ||
    summary.pursuitMaterialDelta !== 1 ||
    !settlement.rewarded ||
    settlement.state.dungeonId !== dungeonId ||
    summary.duplicateExitMaterialDelta !== 0 ||
    !summary.coexistence.movementIsolationPreserved
  ) {
    throw new BalanceSimulationError(
      `${dungeonId}: live pursuit chapter evidence is incomplete: ` +
      JSON.stringify({
        spawnedAfterClearCount: summary.spawnedAfterClearCount,
        spawnNodeIdObserved: summary.spawnNodeIdObserved,
        repeatedClearPreserved: summary.repeatedClearPreserved,
        contained: summary.contained,
        bossNodeCleared: summary.bossNodeCleared,
        exitNodeCleared: summary.exitNodeCleared,
        completed: summary.completed,
        pursuitMaterialDelta: summary.pursuitMaterialDelta,
        rewarded: settlement.rewarded,
        settlementDungeonId: settlement.state.dungeonId,
        duplicateExitMaterialDelta: summary.duplicateExitMaterialDelta,
        movementIsolationPreserved: summary.coexistence.movementIsolationPreserved
      })
    );
  }

  return {
    summary,
    spawnedState: spawned.state,
    containedState: lured.state,
    settledState: completion.settled
  };
}

type RunPursuitControlSpawn = Readonly<{
  state: GameState;
  evidence: RouteCombatEvidence;
  firstNonExitClearNodeIds: readonly string[];
}>;

function createLiveRunPursuitControlSpawn(
  baseState: GameState,
  dungeonId: DungeonId = 'demon_tower_1',
  protocolId: RunProtocolId = 'imprint'
): RunPursuitControlSpawn {
  const evidence = createRouteCombatEvidence({ prioritizeHealing: true, healingTargetRatio: 0.9 });
  const definition = RUN_PURSUIT_CATALOG[dungeonId];
  const bossNodeId = getBossDefinition(dungeonId).nodeId;
  const plannedNodeIds = DUNGEONS[dungeonId].nodes
    .filter(
      (node) =>
        node.id !== definition.containmentNodeId &&
        node.id !== bossNodeId &&
        node.type !== 'exit' &&
        node.type !== 'portal'
    )
    .map((node) => node.id);
  const entered = enterPreparedDungeon(baseState, dungeonId, evidence, {
    protocolId,
    runPursuit: 'live',
    plannedNodeIds,
    additionalTacticalItemIds: ['gate_sigil', 'healing_pill'],
    inventoryTargets: { gate_sigil: 32, healing_pill: 64, armor_patch: 32 }
  });
  const spawned = clearLiveRunUntilPursuitSpawns(
    entered,
    plannedNodeIds,
    evidence,
    new Set([definition.containmentNodeId])
  );
  const pursuit = getRequiredLiveRunPursuitState(spawned.state, `${dungeonId} control spawn`);
  if (
    pursuit.status !== 'stalking' ||
    pursuit.nodeId !== definition.spawnNodeId ||
    spawned.state.run?.clearedNodeIds.includes(definition.containmentNodeId)
  ) {
    throw new BalanceSimulationError(`${dungeonId}: control pursuit was not naturally spawned outside containment.`);
  }
  return {
    state: spawned.state,
    evidence,
    firstNonExitClearNodeIds: spawned.firstNonExitClearNodeIds
  };
}

function getPursuitLogCount(state: GameState): number {
  return state.log.filter((line) => line.includes('破界追兵')).length;
}

function moveAfterResolvingCurrentControlNode(
  state: GameState,
  evidence: RouteCombatEvidence
): { beforeMove: GameState; afterMove: GameState } {
  const beforeMove = resolveCurrentRunPursuitRouteNode(state, evidence);
  const targetNodeId = getCurrentLegalAdjacentTargetIds(beforeMove)[0];
  if (!beforeMove.run || !targetNodeId) {
    throw new BalanceSimulationError('Pursuit compatibility control has no legal successful player move.');
  }
  const afterMove = moveToNode(beforeMove, targetNodeId);
  if (afterMove.run?.currentNodeId !== targetNodeId) {
    throw new BalanceSimulationError('Pursuit compatibility control player move did not succeed.');
  }
  return { beforeMove, afterMove };
}

function simulateRunPursuitEntryControls(baseState: GameState): RunPursuitEntryControlEvidence {
  const firstClearEntries = DUNGEON_ORDER.map((dungeonId, dungeonIndex) => {
    const completedDungeonIds = DUNGEON_ORDER.slice(0, dungeonIndex);
    const firstClearBase: GameState = {
      ...structuredClone(baseState),
      completedDungeonIds,
      claimedTaskIds: [
        ...baseState.claimedTaskIds.filter((taskId) => !taskId.startsWith('mainline_clear_')),
        ...completedDungeonIds.map((completedId) => `mainline_clear_${completedId}`)
      ]
    };
    const entered = enterDungeon(firstClearBase, dungeonId);
    const current = getCurrentRunPursuit(entered);
    const status = entered.run?.pursuitState?.status;
    if (status !== 'disabled' || current.legacyDisabled) {
      const gate = getCampaignGates(firstClearBase).find((candidate) => candidate.dungeonId === dungeonId);
      throw new BalanceSimulationError(
        `${dungeonId}: first-clear pursuit entry was not explicitly disabled; ` +
          `phase=${entered.phase}, run=${entered.run?.dungeonId ?? 'none'}, status=${status ?? 'none'}, ` +
          `gate=${gate?.status ?? 'none'}, log=${entered.log[0] ?? 'none'}.`
      );
    }
    return { dungeonId, status, legacyDisabled: current.legacyDisabled };
  });

  const replay = enterDungeon(baseState, 'demon_tower_1');
  if (!replay.run) throw new BalanceSimulationError('Legacy pursuit control did not enter its replay.');

  // These two fixtures deliberately alter only serialized input shape; assertions below require
  // every public API result to preserve that shape instead of synthesizing pursuit progress.
  const legacyRun = { ...replay.run };
  delete legacyRun.pursuitState;
  const legacyInput: GameState = { ...replay, run: legacyRun };
  const legacyEvidence = createRouteCombatEvidence({ prioritizeHealing: true });
  const legacyLogBefore = getPursuitLogCount(legacyInput);
  const legacyMove = moveAfterResolvingCurrentControlNode(legacyInput, legacyEvidence);

  const malformedSnapshot = { status: 'stalking' };
  const malformedInput: GameState = {
    ...replay,
    run: {
      ...replay.run,
      pursuitState: malformedSnapshot as unknown as RunPursuitState
    }
  };
  const malformedEvidence = createRouteCombatEvidence({ prioritizeHealing: true });
  const malformedLogBefore = getPursuitLogCount(malformedInput);
  const malformedMove = moveAfterResolvingCurrentControlNode(malformedInput, malformedEvidence);

  return {
    firstClearEntries,
    legacy: {
      fieldAbsentBefore: !Object.prototype.hasOwnProperty.call(legacyInput.run, 'pursuitState'),
      fieldAbsentAfter: !Object.prototype.hasOwnProperty.call(legacyMove.afterMove.run, 'pursuitState'),
      legacyDisabledBefore: getCurrentRunPursuit(legacyInput).legacyDisabled,
      legacyDisabledAfter: getCurrentRunPursuit(legacyMove.afterMove).legacyDisabled,
      successfulPlayerMove:
        legacyMove.beforeMove.run?.currentNodeId !== legacyMove.afterMove.run?.currentNodeId,
      pursuitLogDelta: getPursuitLogCount(legacyMove.afterMove) - legacyLogBefore
    },
    malformed: {
      snapshotBefore: JSON.stringify(malformedInput.run?.pursuitState),
      snapshotAfter: JSON.stringify(malformedMove.afterMove.run?.pursuitState),
      legacyDisabledBefore: getCurrentRunPursuit(malformedInput).legacyDisabled,
      legacyDisabledAfter: getCurrentRunPursuit(malformedMove.afterMove).legacyDisabled,
      successfulPlayerMove:
        malformedMove.beforeMove.run?.currentNodeId !== malformedMove.afterMove.run?.currentNodeId,
      pursuitLogDelta: getPursuitLogCount(malformedMove.afterMove) - malformedLogBefore
    }
  };
}

function planNextRunPursuitContactMove(state: GameState): string | undefined {
  if (!state.run) return undefined;
  const definition = RUN_PURSUIT_CATALOG[state.run.dungeonId];
  const initialPursuit = getRequiredLiveRunPursuitState(state, 'before contact planning');
  const blockedEdges = getRunPursuitBlockedEdges(state);
  const bossNodeId = getBossDefinition(state.run.dungeonId).nodeId;
  const traversableNodeIds = new Set(
    DUNGEONS[state.run.dungeonId].nodes
      .filter(
        (node) =>
          node.id !== definition.containmentNodeId &&
          node.id !== bossNodeId &&
          node.type !== 'exit' &&
          node.type !== 'portal'
      )
      .map((node) => node.id)
  );
  type ContactPlanState = {
    playerNodeId: string;
    pursuitState: RunPursuitState;
    firstMoveNodeId?: string;
    moveCount: number;
  };
  const queue: ContactPlanState[] = [{
    playerNodeId: state.run.currentNodeId,
    pursuitState: initialPursuit,
    moveCount: 0
  }];
  const visited = new Set([
    `${state.run.currentNodeId}|${initialPursuit.nodeId}|${initialPursuit.graceMoves}|${initialPursuit.contacts}`
  ]);

  for (let explored = 0; queue.length > 0 && explored < 4096; explored += 1) {
    const current = queue.shift()!;
    const routeState: GameState = {
      ...state,
      run: {
        ...state.run,
        currentNodeId: current.playerNodeId,
        pursuitState: current.pursuitState
      }
    };
    const targetNodeIds = getCurrentLegalAdjacentTargetIds(routeState)
      .filter((nodeId) => traversableNodeIds.has(nodeId))
      .sort();
    for (const targetNodeId of targetNodeIds) {
      const prediction = advanceRunPursuit(
        current.pursuitState,
        getRunPursuitTopologyInput(routeState, targetNodeId, false, blockedEdges)
      );
      const firstMoveNodeId = current.firstMoveNodeId ?? targetNodeId;
      if (prediction.contact) return firstMoveNodeId;
      if (prediction.state.status !== 'stalking') continue;
      const key = [
        targetNodeId,
        prediction.state.nodeId,
        prediction.state.graceMoves,
        prediction.state.contacts
      ].join('|');
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({
        playerNodeId: targetNodeId,
        pursuitState: prediction.state,
        firstMoveNodeId,
        moveCount: current.moveCount + 1
      });
    }
  }
  return undefined;
}

function selectPredictedRunPursuitMove(
  state: GameState,
  predicate: (prediction: ReturnType<typeof advanceRunPursuit>) => boolean
): string {
  if (!state.run) throw new BalanceSimulationError('Cannot select a pursuit move without a run.');
  const pursuit = getRequiredLiveRunPursuitState(state, 'before selecting pursuit control move');
  const definition = RUN_PURSUIT_CATALOG[state.run.dungeonId];
  const bossNodeId = getBossDefinition(state.run.dungeonId).nodeId;
  const blockedEdges = getRunPursuitBlockedEdges(state);
  const candidates = getCurrentLegalAdjacentTargetIds(state)
    .filter((nodeId) => {
      const node = DUNGEONS[state.run!.dungeonId].nodes.find((candidate) => candidate.id === nodeId);
      return Boolean(
        node &&
        node.id !== definition.containmentNodeId &&
        node.id !== bossNodeId &&
        node.type !== 'exit' &&
        node.type !== 'portal'
      );
    })
    .map((nodeId) => ({
      nodeId,
      prediction: advanceRunPursuit(
        pursuit,
        getRunPursuitTopologyInput(state, nodeId, false, blockedEdges)
      )
    }))
    .sort(
      (left, right) =>
        Number(left.prediction.contact) - Number(right.prediction.contact) ||
        left.nodeId.localeCompare(right.nodeId)
    );
  const selected = candidates.find(({ prediction }) => predicate(prediction));
  if (!selected) throw new BalanceSimulationError(`${state.run.dungeonId}: no pursuit control move matched.`);
  return selected.nodeId;
}

function simulateRunPursuitContactControl(
  control: RunPursuitControlSpawn
): RunPursuitContactControlEvidence {
  if (!control.state.run) throw new BalanceSimulationError('Contact control has no active run.');
  const dungeonId = control.state.run.dungeonId;
  const definition = RUN_PURSUIT_CATALOG[dungeonId];
  let state = control.state;
  let contactMove: RunPursuitMovementEvidence | undefined;
  let hpBefore = 0;
  let runDamageBefore = 0;
  let contactsBefore = 0;
  let hpAfterContact = 0;
  let runDamageAfterContact = 0;

  for (let stepCount = 0; stepCount < 64; stepCount += 1) {
    const plannedNodeId = planNextRunPursuitContactMove(state);
    if (!plannedNodeId) {
      throw new BalanceSimulationError(`${dungeonId}: contact planner found no real reachable contact.`);
    }
    const pursuitBefore = getRequiredLiveRunPursuitState(state, 'before contact-control move');
    hpBefore = state.player.hp;
    runDamageBefore = state.run?.damageTaken ?? 0;
    contactsBefore = pursuitBefore.contacts;
    const moved = executePredictedRunPursuitMove(state, plannedNodeId, false, control.evidence);
    state = moved.state;
    if (moved.evidence.contact) {
      contactMove = moved.evidence;
      hpAfterContact = state.player.hp;
      runDamageAfterContact = state.run?.damageTaken ?? 0;
      break;
    }
    state = resolveCurrentRunPursuitRouteNode(state, control.evidence);
  }
  if (!contactMove || !state.run) {
    throw new BalanceSimulationError(`${dungeonId}: contact control exceeded its real-move limit.`);
  }

  const contacted = getRequiredLiveRunPursuitState(state, 'after contact-control move');
  const expectedDamage = getRunPursuitContactDamage(state.player.maxHp, DUNGEONS[dungeonId].tier);
  if (
    hpBefore - state.player.hp !== expectedDamage ||
    state.run.damageTaken - runDamageBefore !== expectedDamage ||
    contacted.nodeId !== definition.spawnNodeId ||
    contacted.contacts !== contactsBefore + 1 ||
    contacted.graceMoves !== 1
  ) {
    throw new BalanceSimulationError(`${dungeonId}: contact damage, reset, or grace evidence diverged.`);
  }

  state = resolveCurrentRunPursuitRouteNode(state, control.evidence);
  const graceTargetNodeId = selectPredictedRunPursuitMove(
    state,
    (prediction) => !prediction.moved && !prediction.contact && prediction.state.graceMoves === 0
  );
  const grace = executePredictedRunPursuitMove(state, graceTargetNodeId, false, control.evidence);
  state = resolveCurrentRunPursuitRouteNode(grace.state, control.evidence);
  const resumedTargetNodeId = selectPredictedRunPursuitMove(
    state,
    (prediction) => prediction.moved && !prediction.contact
  );
  const resumed = executePredictedRunPursuitMove(
    state,
    resumedTargetNodeId,
    false,
    control.evidence
  );

  return {
    dungeonId,
    expectedDamage,
    hpBefore,
    hpAfter: hpAfterContact,
    runDamageBefore,
    runDamageAfter: runDamageAfterContact,
    contactsBefore,
    contactsAfter: contacted.contacts,
    resetSpawnNodeId: contacted.nodeId ?? '',
    contactMove,
    graceMove: grace.evidence,
    resumedMove: resumed.evidence
  };
}

function simulateRunPursuitCombatMoveControl(
  control: RunPursuitControlSpawn
): RunPursuitMovementControlEvidence['combatMove'] {
  if (!control.state.run) throw new BalanceSimulationError('Combat movement control has no run.');
  const dungeonId = control.state.run.dungeonId;
  const bossNodeId = getBossDefinition(dungeonId).nodeId;
  const definition = RUN_PURSUIT_CATALOG[dungeonId];
  const monsterNodeIds = DUNGEONS[dungeonId].nodes
    .filter(
      (node) =>
        node.type === 'monster' &&
        node.id !== bossNodeId &&
        node.id !== definition.containmentNodeId &&
        !control.state.run?.clearedNodeIds.includes(node.id)
    )
    .map((node) => node.id);

  for (const monsterNodeId of monsterNodeIds) {
    try {
      const arrived = moveAlongRoutePath(control.state, monsterNodeId, control.evidence, {
        excludedNodeIds: new Set([bossNodeId, definition.containmentNodeId]),
        resolveTargetDanger: false,
        collectTargetReward: false
      });
      if (arrived.run?.currentNodeId !== monsterNodeId || arrived.phase === 'result') continue;
      const encounter = selectNode(arrived, monsterNodeId);
      if (encounter.phase !== 'combat' || encounter.combat?.nodeId !== monsterNodeId || !encounter.run) continue;
      const currentNode = DUNGEONS[dungeonId].nodes.find((node) => node.id === monsterNodeId);
      const attemptedTargetNodeId = DUNGEONS[dungeonId].nodes.find(
        (node) => node.id !== monsterNodeId && currentNode && areAdjacentRouteNodes(currentNode, node)
      )?.id;
      if (!attemptedTargetNodeId) continue;
      const pursuitBefore = JSON.stringify(encounter.run.pursuitState);
      const attempted = moveToNode(encounter, attemptedTargetNodeId);
      return {
        dungeonId,
        combatNodeId: monsterNodeId,
        attemptedTargetNodeId,
        combatRemainedActive:
          attempted.phase === 'combat' && attempted.combat?.nodeId === monsterNodeId,
        playerPositionPreserved: attempted.run?.currentNodeId === monsterNodeId,
        pursuitPreserved: JSON.stringify(attempted.run?.pursuitState) === pursuitBefore
      };
    } catch {
      continue;
    }
  }
  throw new BalanceSimulationError(`${dungeonId}: no naturally reached combat movement control was available.`);
}

function findRunPursuitPlayerLawBlockControl(
  candidateStates: readonly GameState[]
): RunPursuitMovementControlEvidence['playerLawBlock'] {
  for (const candidateState of candidateStates) {
    if (!candidateState.run) continue;
    const dungeonId = candidateState.run.dungeonId;
    const bossNodeId = getBossDefinition(dungeonId).nodeId;
    const exitNodeIds = DUNGEONS[dungeonId].nodes
      .filter((node) => node.type === 'exit')
      .map((node) => node.id);
    for (const edge of getRunPursuitBlockedEdges(candidateState)) {
      try {
        const evidence = createRouteCombatEvidence({ prioritizeHealing: true, healingTargetRatio: 0.9 });
        const atGate = moveAlongRoutePath(candidateState, edge.fromNodeId, evidence, {
          excludedNodeIds: new Set([edge.toNodeId, bossNodeId, ...exitNodeIds])
        });
        if (!atGate.run || atGate.run.currentNodeId !== edge.fromNodeId) continue;
        const pursuitBefore = getRequiredLiveRunPursuitState(atGate, 'before player law-block control');
        const blockReason = getCurrentRouteBlockReason(atGate, edge.toNodeId);
        if (!blockReason || pursuitBefore.status !== 'stalking') continue;
        const blocked = moveToNode(atGate, edge.toNodeId);
        return {
          dungeonId,
          fromNodeId: edge.fromNodeId,
          toNodeId: edge.toNodeId,
          blockReason,
          playerPositionPreserved: blocked.run?.currentNodeId === edge.fromNodeId,
          pursuitPreserved:
            JSON.stringify(blocked.run?.pursuitState) === JSON.stringify(pursuitBefore)
        };
      } catch {
        continue;
      }
    }
  }
  throw new BalanceSimulationError('No naturally closed law edge could be reached for the player control.');
}

function simulateRunPursuitMovementControls(
  executions: readonly RunPursuitChapterExecution[],
  control: RunPursuitControlSpawn,
  contact: RunPursuitContactControlEvidence
): RunPursuitMovementControlEvidence {
  const pursuitLawMove = executions
    .flatMap((execution) => execution.summary.lureMovements)
    .find((movement) => movement.lawChangedPursuitStep);
  if (!pursuitLawMove) {
    throw new BalanceSimulationError('No live pursuit movement demonstrated a directed law-gate detour.');
  }
  return {
    successfulMove: contact.resumedMove,
    repeatedClearPreserved: executions.every((execution) => execution.summary.repeatedClearPreserved),
    playerLawBlock: findRunPursuitPlayerLawBlockControl([
      control.state,
      ...executions.map((execution) => execution.spawnedState)
    ]),
    pursuitLawMove,
    combatMove: simulateRunPursuitCombatMoveControl(control)
  };
}

function getRunPursuitBossStats(state: GameState): RunPursuitBossStats {
  const monster = getCombatEncounterProfile(state)?.monster;
  if (!monster) throw new BalanceSimulationError('Pursuit boss fusion control has no encounter profile.');
  return {
    maxHp: monster.maxHp,
    attack: monster.attack,
    artPower: monster.artPower,
    defense: monster.defense,
    speed: monster.speed
  };
}

function getRunPursuitPreFusionProjection(state: GameState): string {
  return JSON.stringify({
    clearedNodeIds: state.run?.clearedNodeIds,
    lawState: state.run?.lawState,
    protocol: state.run?.protocol,
    pressureState: state.run?.pressureState,
    relicState: state.run?.relicState
  });
}

function planRunPursuitBossStagingMoves(
  state: GameState,
  bossNodeId: string,
  clearedOnly = false
): readonly string[] | undefined {
  if (!state.run) return undefined;
  const initialPursuit = getRequiredLiveRunPursuitState(state, 'before boss staging plan');
  const blockedEdges = getRunPursuitBlockedEdges(state);
  type BossStagingState = Readonly<{
    playerNodeId: string;
    pursuitState: RunPursuitState;
    path: readonly string[];
  }>;
  const queue: BossStagingState[] = [{
    playerNodeId: state.run.currentNodeId,
    pursuitState: initialPursuit,
    path: []
  }];
  const visited = new Set([
    `${state.run.currentNodeId}|${initialPursuit.nodeId}|${initialPursuit.graceMoves}|${initialPursuit.contacts}`
  ]);
  const maximumContacts = initialPursuit.contacts + 3;

  for (let explored = 0; queue.length > 0 && explored < 4096; explored += 1) {
    const current = queue.shift()!;
    const routeState: GameState = {
      ...state,
      run: {
        ...state.run,
        currentNodeId: current.playerNodeId,
        pursuitState: current.pursuitState
      }
    };
    const legalTargets = getCurrentLegalAdjacentTargetIds(routeState);
    if (legalTargets.includes(bossNodeId)) {
      const bossPrediction = advanceRunPursuit(
        current.pursuitState,
        getRunPursuitTopologyInput(routeState, bossNodeId, true, blockedEdges)
      );
      if (
        bossPrediction.state.status === 'stalking' &&
        bossPrediction.state.contacts <= maximumContacts
      ) {
        return current.path;
      }
    }
    const stagingTargets = legalTargets
      .filter((nodeId) => {
        const node = DUNGEONS[state.run!.dungeonId].nodes.find((candidate) => candidate.id === nodeId);
        return Boolean(
          node &&
          node.id !== bossNodeId &&
          node.type !== 'exit' &&
          node.type !== 'portal' &&
          (!clearedOnly || state.run!.clearedNodeIds.includes(nodeId))
        );
      })
      .sort();
    for (const targetNodeId of stagingTargets) {
      const prediction = advanceRunPursuit(
        current.pursuitState,
        getRunPursuitTopologyInput(routeState, targetNodeId, true, blockedEdges)
      );
      if (
        prediction.state.status !== 'stalking' ||
        prediction.state.contacts > maximumContacts
      ) {
        continue;
      }
      const key = [
        targetNodeId,
        prediction.state.nodeId,
        prediction.state.graceMoves,
        prediction.state.contacts
      ].join('|');
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({
        playerNodeId: targetNodeId,
        pursuitState: prediction.state,
        path: [...current.path, targetNodeId]
      });
    }
  }
  return undefined;
}

function moveRunPursuitToBossStaging(
  start: GameState,
  bossNodeId: string,
  evidence: RouteCombatEvidence
): GameState {
  let state = start;
  for (let stepCount = 0; stepCount < 96; stepCount += 1) {
    const path = planRunPursuitBossStagingMoves(state, bossNodeId);
    if (!path) {
      throw new BalanceSimulationError(`${state.run?.dungeonId ?? 'unknown'}: boss staging planner found no route.`);
    }
    if (path.length === 0) return state;
    const moved = executePredictedRunPursuitMove(state, path[0], true, evidence);
    if (moved.evidence.contained) {
      throw new BalanceSimulationError(`${state.run?.dungeonId ?? 'unknown'}: boss staging unexpectedly contained pursuit.`);
    }
    state = resolveCurrentRunPursuitRouteNode(moved.state, evidence);
    if (!state.run || state.phase === 'result') {
      throw new BalanceSimulationError(`${start.run?.dungeonId ?? 'unknown'}: boss staging ended the run.`);
    }
  }
  throw new BalanceSimulationError(`${start.run?.dungeonId ?? 'unknown'}: boss staging exceeded 96 moves.`);
}

function simulateRunPursuitBossFusionControlForExecution(
  execution: RunPursuitChapterExecution
): RunPursuitBossFusionControlEvidence {
  if (!execution.spawnedState.run) throw new BalanceSimulationError('Boss fusion control has no live run.');
  const dungeonId = execution.spawnedState.run.dungeonId;
  const definition = RUN_PURSUIT_CATALOG[dungeonId];
  const bossNodeId = getBossDefinition(dungeonId).nodeId;
  const exitNodeId = DUNGEONS[dungeonId].nodes.find((node) => node.type === 'exit')?.id;
  if (!exitNodeId) throw new BalanceSimulationError(`${dungeonId}: boss fusion control has no exit.`);
  const liveEvidence = createRouteCombatEvidence({ prioritizeHealing: true, healingTargetRatio: 0.9 });
  const baselineEvidence = createRouteCombatEvidence({ prioritizeHealing: true, healingTargetRatio: 0.9 });
  let common = execution.spawnedState;
  if (!execution.spawnedState.run.clearedNodeIds.includes(definition.containmentNodeId)) {
    common = moveAlongRoutePath(common, definition.containmentNodeId, liveEvidence, {
      excludedNodeIds: new Set([bossNodeId, exitNodeId])
    });
  }
  if (!common.run) throw new BalanceSimulationError(`${dungeonId}: boss fusion common run ended early.`);
  const commonPursuit = getRequiredLiveRunPursuitState(common, 'common boss fusion checkpoint');
  if (commonPursuit.status !== 'stalking') {
    throw new BalanceSimulationError(`${dungeonId}: boss fusion common checkpoint is not stalking.`);
  }
  const staged = moveRunPursuitToBossStaging(common, bossNodeId, liveEvidence);
  const contained = lureLiveRunPursuitIntoContainment(staged, baselineEvidence, true);
  const commonNodeId = staged.run?.currentNodeId;
  if (!commonNodeId) throw new BalanceSimulationError(`${dungeonId}: boss staging node is missing.`);
  const unclearedNodeIds = new Set(
    DUNGEONS[dungeonId].nodes
      .filter((node) => !staged.run?.clearedNodeIds.includes(node.id) && node.id !== commonNodeId)
      .map((node) => node.id)
  );
  const normalizedBaseline = moveAlongRoutePath(contained.state, commonNodeId, baselineEvidence, {
    excludedNodeIds: unclearedNodeIds,
    resolveTargetDanger: false,
    collectTargetReward: false
  });
  if (getRunPursuitPreFusionProjection(staged) !== getRunPursuitPreFusionProjection(normalizedBaseline)) {
    throw new BalanceSimulationError(`${dungeonId}: containment baseline changed a pre-fusion layer.`);
  }

  const liveBossMove = executePredictedRunPursuitMove(staged, bossNodeId, true, liveEvidence);
  const baselineBossMove = executePredictedRunPursuitMove(
    normalizedBaseline,
    bossNodeId,
    true,
    baselineEvidence
  );
  const liveAtBoss = liveBossMove.state;
  const baselineAtBoss = baselineBossMove.state;
  const preFusionLayersMatched =
    getRunPursuitPreFusionProjection(liveAtBoss) ===
    getRunPursuitPreFusionProjection(baselineAtBoss);
  if (!preFusionLayersMatched) {
    throw new BalanceSimulationError(`${dungeonId}: boss fusion comparison did not preserve prior layers.`);
  }

  const fusedEncounter = selectNode(liveAtBoss, bossNodeId);
  const baselineEncounter = selectNode(baselineAtBoss, bossNodeId);
  const fusedPursuit = getRequiredLiveRunPursuitState(fusedEncounter, 'fused boss encounter');
  const baselinePursuit = getRequiredLiveRunPursuitState(baselineEncounter, 'contained boss encounter');
  if (
    fusedEncounter.phase !== 'combat' ||
    baselineEncounter.phase !== 'combat' ||
    fusedPursuit.status !== 'fused' ||
    baselinePursuit.status !== 'contained'
  ) {
    throw new BalanceSimulationError(
      `${dungeonId}: boss fusion controls did not enter comparable combats; ` +
        `live=${fusedEncounter.phase}/${fusedPursuit.status}/${fusedEncounter.run?.currentNodeId ?? 'none'}, ` +
        `baseline=${baselineEncounter.phase}/${baselinePursuit.status}/${baselineEncounter.run?.currentNodeId ?? 'none'}, ` +
        `bossCleared=${liveAtBoss.run?.clearedNodeIds.includes(bossNodeId) ?? false}/` +
        `${baselineAtBoss.run?.clearedNodeIds.includes(bossNodeId) ?? false}.`
    );
  }
  const baselineStats = getRunPursuitBossStats(baselineEncounter);
  const fusedStats = getRunPursuitBossStats(fusedEncounter);
  const statIds = ['maxHp', 'attack', 'artPower', 'defense', 'speed'] as const;
  const finalFifteenPercentMatched = statIds.every(
    (statId) => fusedStats[statId] === Math.ceil(baselineStats[statId] * 1.15)
  );
  const fusedAbility = getCombatEncounterProfile(fusedEncounter)?.monster.ability ?? '';
  const fusionDescriptionCount = fusedAbility.split(definition.fusionDescription).length - 1;
  if (!finalFifteenPercentMatched || fusionDescriptionCount !== 1) {
    throw new BalanceSimulationError(`${dungeonId}: final boss fusion layer was not exactly +15%.`);
  }

  let bossCleared = resolveCurrentDanger(fusedEncounter, liveEvidence);
  bossCleared = resolvePendingEquipmentOffer(bossCleared, bossNodeId);
  assertBossSealCleared(bossCleared, dungeonId, 'after fused pursuit boss');
  const exitReady = moveAlongRoutePath(bossCleared, exitNodeId, liveEvidence);
  const materialCountBeforeExit = exitReady.inventory[definition.materialId];
  const settled = resolvePendingRunRelicArchive(resolveExit(exitReady));
  const settlement = getCurrentRunPursuit(settled).lastSettlement;
  if (!settlement) throw new BalanceSimulationError(`${dungeonId}: fused pursuit settlement is missing.`);
  const ordinaryExitMaterialAmount =
    DUNGEONS[dungeonId].nodes.find((node) => node.id === exitNodeId)?.reward?.items?.[definition.materialId] ?? 0;
  const pursuitMaterialDelta =
    settled.inventory[definition.materialId] - materialCountBeforeExit - ordinaryExitMaterialAmount;
  if (pursuitMaterialDelta !== 0 || settlement.rewarded || settlement.state.status !== 'fused') {
    throw new BalanceSimulationError(`${dungeonId}: fused pursuit incorrectly produced material.`);
  }

  return {
    dungeonId,
    bossNodeId,
    protocolId: liveAtBoss.run?.protocol?.id ?? 'standard',
    pressureClearedNodeCount: liveAtBoss.run?.pressureState?.clearedNodeCount ?? 0,
    preFusionLayersMatched,
    baselineStats,
    fusedStats,
    finalFifteenPercentMatched,
    fusionDescriptionCount,
    pursuitStatusAtBoss: fusedPursuit.status,
    pursuitMaterialDelta,
    settlement
  };
}

function simulateRunPursuitBossFusionControl(
  executions: readonly RunPursuitChapterExecution[]
): RunPursuitBossFusionControlEvidence {
  const failures: string[] = [];
  for (const execution of executions) {
    try {
      return simulateRunPursuitBossFusionControlForExecution(execution);
    } catch (error) {
      failures.push(
        `${execution.summary.dungeonId}:${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  throw new BalanceSimulationError(
    `No live chapter produced a comparable boss fusion control; ${failures.join(' | ')}`
  );
}

function settleContainedRunPursuitPortalOutcome(
  crossed: GameState,
  originDefinition: RunPursuitDefinition,
  reason: RunPursuitPortalOutcomeEvidence['reason']
): RunPursuitPortalOutcomeEvidence {
  if (!crossed.run) throw new BalanceSimulationError('Contained portal outcome has no target run.');
  const materialCountBefore = crossed.inventory[originDefinition.materialId];
  let settled: GameState;
  let ordinaryExitMaterialAmount = 0;
  if (reason === 'successful_exit') {
    const evidence = createRouteCombatEvidence({ prioritizeHealing: true, healingTargetRatio: 0.9 });
    const targetDungeonId = crossed.run.dungeonId;
    const exitNodeId = DUNGEONS[targetDungeonId].nodes.find((node) => node.type === 'exit')?.id;
    if (!exitNodeId) throw new BalanceSimulationError(`${targetDungeonId}: contained portal target has no exit.`);
    const exitReady = collectRouteRewards(crossed, targetDungeonId, evidence);
    ordinaryExitMaterialAmount =
      DUNGEONS[targetDungeonId].nodes.find((node) => node.id === exitNodeId)?.reward?.items?.[
        originDefinition.materialId
      ] ?? 0;
    settled = resolvePendingRunRelicArchive(resolveExit(exitReady));
  } else {
    settled = reason === 'retreat'
      ? resolveRetreat(crossed)
      : resolveRunFailure(crossed);
  }
  const settlement = getCurrentRunPursuit(settled).lastSettlement;
  if (!settlement) throw new BalanceSimulationError(`Contained portal ${reason} settlement is missing.`);
  const ordinaryLostMaterial =
    settled.run?.lastLootSettlement?.lost.items[originDefinition.materialId] ?? 0;
  const materialDelta =
    settled.inventory[originDefinition.materialId] -
    materialCountBefore -
    ordinaryExitMaterialAmount +
    ordinaryLostMaterial;
  const expectedReward = reason === 'successful_exit';
  if (
    settlement.reason !== reason ||
    settlement.state.dungeonId !== originDefinition.dungeonId ||
    settlement.state.status !== 'contained' ||
    settlement.rewarded !== expectedReward ||
    materialDelta !== (expectedReward ? 1 : 0)
  ) {
    throw new BalanceSimulationError(
      `Contained portal ${reason} did not preserve origin settlement semantics; ` +
        `actual=${settlement.reason}/${settlement.state.dungeonId}/${settlement.state.status}/` +
        `${settlement.rewarded ? 'rewarded' : 'unrewarded'}, delta=${materialDelta}, phase=${settled.phase}.`
    );
  }
  return {
    reason,
    phase: settled.phase,
    materialDelta,
    settlement
  };
}

function simulateRunPursuitPortalControls(
  liveControl: RunPursuitControlSpawn,
  containedState: GameState
): RunPursuitPortalControlEvidence {
  if (!liveControl.state.run) throw new BalanceSimulationError('Portal pursuit control has no source run.');
  const sourceDungeonId = liveControl.state.run.dungeonId;
  const sourceDefinition = RUN_PURSUIT_CATALOG[sourceDungeonId];
  const portalNode = DUNGEONS[sourceDungeonId].nodes.find((node) => node.portal);
  if (!portalNode?.portal) throw new BalanceSimulationError(`${sourceDungeonId}: pursuit portal control has no portal.`);
  const targetDungeonId = portalNode.portal.targetDungeonId;
  const bossNodeId = getBossDefinition(sourceDungeonId).nodeId;
  const exitNodeIds = DUNGEONS[sourceDungeonId].nodes
    .filter((node) => node.type === 'exit')
    .map((node) => node.id);
  const portalReady = moveAlongRoutePath(liveControl.state, portalNode.id, liveControl.evidence, {
    excludedNodeIds: new Set([sourceDefinition.containmentNodeId, bossNodeId, ...exitNodeIds]),
    resolveTargetDanger: false,
    collectTargetReward: false
  });
  const sourcePursuit = getRequiredLiveRunPursuitState(portalReady, 'before active portal controls');
  if (portalReady.run?.currentNodeId !== portalNode.id || sourcePursuit.status !== 'stalking') {
    throw new BalanceSimulationError(`${sourceDungeonId}: active pursuit did not reach its portal control.`);
  }
  const sourceMaterialBefore = portalReady.inventory[sourceDefinition.materialId];
  const stableState = usePortal(portalReady, 'stabilize');
  const stablePursuit = getRequiredLiveRunPursuitState(stableState, 'after stable pursuit portal');
  const stableSettlement = getCurrentRunPursuit(stableState).lastSettlement;
  if (
    stableState.run?.dungeonId !== targetDungeonId ||
    stablePursuit.status !== 'disabled' ||
    !stableSettlement ||
    stableSettlement.reason !== 'stable_portal' ||
    stableSettlement.state.status !== 'repelled' ||
    stableSettlement.rewarded
  ) {
    throw new BalanceSimulationError(`${sourceDungeonId}: stable portal did not repel the active pursuit.`);
  }

  const forcedState = usePortal(portalReady, 'force');
  const forcedPursuit = getRequiredLiveRunPursuitState(forcedState, 'after forced pursuit portal');
  const forcedSettlement = getCurrentRunPursuit(forcedState).lastSettlement;
  const targetDefinition = RUN_PURSUIT_CATALOG[targetDungeonId];
  if (
    forcedState.run?.dungeonId !== targetDungeonId ||
    forcedPursuit.status !== 'stalking' ||
    forcedPursuit.nodeId !== targetDefinition.spawnNodeId ||
    forcedPursuit.contacts !== sourcePursuit.contacts ||
    forcedPursuit.graceMoves !== 1 ||
    !forcedSettlement ||
    forcedSettlement.reason !== 'forced_portal' ||
    forcedSettlement.rewarded
  ) {
    throw new BalanceSimulationError(`${sourceDungeonId}: forced portal did not carry the active pursuit exactly.`);
  }
  const forcedEvidence = createRouteCombatEvidence({ prioritizeHealing: true, healingTargetRatio: 0.9 });
  const forcedReadyToMove = resolveCurrentRunPursuitRouteNode(forcedState, forcedEvidence);
  const forcedGraceTarget = selectPredictedRunPursuitMove(
    forcedReadyToMove,
    (prediction) => !prediction.moved && !prediction.contact && prediction.state.graceMoves === 0
  );
  const forcedGrace = executePredictedRunPursuitMove(
    forcedReadyToMove,
    forcedGraceTarget,
    false,
    forcedEvidence
  );

  if (!containedState.run || containedState.run.dungeonId !== sourceDungeonId) {
    throw new BalanceSimulationError('Contained portal control did not receive its origin run.');
  }
  const containedEvidence = createRouteCombatEvidence({ prioritizeHealing: true, healingTargetRatio: 0.9 });
  const containedAtPortal = moveAlongRoutePath(containedState, portalNode.id, containedEvidence, {
    excludedNodeIds: new Set([bossNodeId, ...exitNodeIds]),
    resolveTargetDanger: false,
    collectTargetReward: false
  });
  const containedPursuit = getRequiredLiveRunPursuitState(containedAtPortal, 'before contained portal controls');
  if (containedPursuit.status !== 'contained') {
    throw new BalanceSimulationError(`${sourceDungeonId}: containment was lost before the portal control.`);
  }
  const contained = (['stabilize', 'force'] as const).map((choice) => {
    const crossed = usePortal(containedAtPortal, choice);
    const crossedPursuit = getRequiredLiveRunPursuitState(crossed, `after contained ${choice} portal`);
    const portalSettlement = getCurrentRunPursuit(crossed).lastSettlement;
    if (
      crossed.run?.dungeonId !== targetDungeonId ||
      crossedPursuit.status !== 'disabled' ||
      !portalSettlement ||
      portalSettlement.reason !== (choice === 'stabilize' ? 'stable_portal' : 'forced_portal') ||
      portalSettlement.state.dungeonId !== sourceDungeonId ||
      portalSettlement.state.status !== 'contained' ||
      portalSettlement.rewarded
    ) {
      throw new BalanceSimulationError(`${sourceDungeonId}: contained ${choice} portal lost its origin.`);
    }
    return {
      choice,
      crossedStatus: crossedPursuit.status,
      originDungeonId: portalSettlement.state.dungeonId,
      portalSettlement,
      outcomes: (['successful_exit', 'retreat', 'failure'] as const).map((reason) =>
        settleContainedRunPursuitPortalOutcome(crossed, sourceDefinition, reason)
      )
    };
  });

  return {
    sourceDungeonId,
    targetDungeonId,
    stable: {
      targetStatus: stablePursuit.status,
      materialDelta: stableState.inventory[sourceDefinition.materialId] - sourceMaterialBefore,
      settlement: stableSettlement
    },
    forced: {
      targetStatus: forcedPursuit.status,
      targetSpawnNodeId: forcedPursuit.nodeId,
      contactsBefore: sourcePursuit.contacts,
      contactsAfter: forcedPursuit.contacts,
      graceMovesAfter: forcedPursuit.graceMoves,
      materialDelta: forcedState.inventory[sourceDefinition.materialId] - sourceMaterialBefore,
      settlement: forcedSettlement,
      graceMove: forcedGrace.evidence
    },
    contained
  };
}

function simulateEightLiveRunPursuitChapters(): {
  baseState: GameState;
  executions: RunPursuitChapterExecution[];
} {
  const baseState = createEquipmentMemoryHuntFixture();
  if (
    baseState.phase !== 'hub' ||
    DUNGEON_ORDER.some((dungeonId) => !baseState.completedDungeonIds.includes(dungeonId))
  ) {
    throw new BalanceSimulationError('Campaign pursuit baseline must have every dungeon completed.');
  }
  const equipmentHuntTargets = createSevenDungeonEquipmentHuntFixture().targets;
  const executions = DUNGEON_ORDER.map((dungeonId, index) =>
    simulateLiveRunPursuitChapter(baseState, dungeonId, index, equipmentHuntTargets)
  );
  return { baseState, executions };
}

export function simulateEightDungeonRunPursuits(): EightDungeonRunPursuitsResult {
  const core = simulateEightLiveRunPursuitChapters();
  const liveControl = createLiveRunPursuitControlSpawn(core.baseState);
  const contact = simulateRunPursuitContactControl(liveControl);
  const originExecution = core.executions.find(
    (execution) => execution.summary.dungeonId === liveControl.state.run?.dungeonId
  );
  if (!originExecution) throw new BalanceSimulationError('Pursuit portal control origin chapter is missing.');
  return {
    baseState: core.baseState,
    summaries: core.executions.map((execution) => execution.summary),
    controls: {
      entry: simulateRunPursuitEntryControls(core.baseState),
      movement: simulateRunPursuitMovementControls(core.executions, liveControl, contact),
      contact,
      bossFusion: simulateRunPursuitBossFusionControl(core.executions),
      portals: simulateRunPursuitPortalControls(liveControl, originExecution.containedState)
    }
  };
}
