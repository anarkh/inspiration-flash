import type { GameCommand } from '@infinite-flow/application';
import type {
  BloodlineId,
  CombatAction,
  CompanionId,
  DungeonFeatureHelpId,
  DungeonId,
  EquipmentId,
  EquipmentSlot,
  GameAssetDefinition,
  ItemId,
  MethodId,
  NodeType,
  PetId,
  Phase
} from '@infinite-flow/core';
import type { TacticalItemCategory } from '@infinite-flow/core/tactical-loadout';
import type { RunProtocolId } from '@infinite-flow/core/run-protocols';
import type {
  EquipmentMemoryId,
  EquipmentMemoryHuntReason,
  EquipmentMemoryHuntStatus
} from '@infinite-flow/core/equipment-memory-hunts';
import type { EquipmentAttunementId } from '@infinite-flow/core/equipment-system';
import type { RunRelicFrame, RunRelicId } from '@infinite-flow/core/run-relics';

export type DeepReadonly<T> = T extends (...arguments_: never[]) => unknown
  ? T
  : T extends readonly unknown[]
    ? { readonly [Index in keyof T]: DeepReadonly<T[Index]> }
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

export type EntryProtocolDraft = Readonly<{
  dungeonId: DungeonId;
  protocolId: RunProtocolId;
  routeContractId?: string;
  infernoTier?: number;
}>;

export type PresentationHelpId = DungeonFeatureHelpId | 'equipmentCommission';

export type EquipmentCommissionDraftEquipmentIds =
  | readonly []
  | readonly [EquipmentId]
  | readonly [EquipmentId, EquipmentId];

export type EquipmentCommissionDraft = Readonly<{
  equipmentIds: EquipmentCommissionDraftEquipmentIds;
  targetMaterialId: ItemId | null;
}>;

export const HUB_PANELS = [
  'entry',
  'supplies',
  'equipment',
  'pets',
  'methods',
  'bloodlines',
  'companions',
  'tasks'
] as const;

export type HubPanel = (typeof HUB_PANELS)[number];
export type HubCatalogPanel = Exclude<HubPanel, 'entry'>;

export type HubCatalogSelections = Readonly<Partial<{
  supplies: ItemId;
  equipment: EquipmentId;
  pets: PetId;
  methods: MethodId;
  bloodlines: BloodlineId;
  companions: CompanionId;
  tasks: string;
}>>;

export type PresentationLocalUiState = Readonly<{
  entryDraft?: EntryProtocolDraft;
  equipmentCommissionDraft?: EquipmentCommissionDraft;
  hubPanel?: HubPanel;
  hubSelections?: HubCatalogSelections;
  activeHelpId?: PresentationHelpId;
  advancedCombatExpanded?: boolean;
}>;

export type PresentationLocalAction =
  | Readonly<{ type: 'help/open'; helpId: PresentationHelpId }>
  | Readonly<{ type: 'help/close' }>
  | Readonly<{ type: 'hub/select-panel'; panel: HubPanel }>
  | Readonly<{
      type: 'hub/select-catalog-entry';
      panel: HubCatalogPanel;
      entityId: string;
    }>
  | Readonly<{ type: 'entry/select-dungeon'; dungeonId: DungeonId }>
  | Readonly<{ type: 'entry/select-protocol'; protocolId: RunProtocolId }>
  | Readonly<{ type: 'entry/set-inferno-tier'; infernoTier: number }>
  | Readonly<{
      type: 'entry/select-route-contract';
      /** `null` is the stable JSON representation of “no route contract”. */
      routeContractId: string | null;
    }>
  | Readonly<{
      type: 'entry/select-relic-seed';
      frame: RunRelicFrame;
      /** `null` tells the host to omit `seedRelicId` from `hub/configure-relic`. */
      seedRelicId: RunRelicId | null;
    }>
  | Readonly<{
      /** The host replaces its entire local commission draft with this normalized snapshot. */
      type: 'hub/set-equipment-commission-draft';
      draft: EquipmentCommissionDraft;
    }>
  | Readonly<{
      /** The client persists explicit seeds, then creates exactly one run/enter command. */
      type: 'entry/request-enter';
      draft: EntryProtocolDraft;
    }>
  | Readonly<{ type: 'combat/set-advanced-expanded'; expanded: boolean }>;

export type PresentationEvent =
  | Readonly<{ kind: 'command'; command: GameCommand }>
  | Readonly<{ kind: 'local'; action: PresentationLocalAction }>;

export type ViewActionPlacement =
  | 'primary'
  | 'preparation'
  | 'map'
  | 'node'
  | 'combat'
  | 'advanced'
  | 'result';

export type ViewActionRecommendation = 'recommended' | 'neutral' | 'high-risk';

export type ViewActionModel = Readonly<{
  actionId: string;
  label: string;
  enabled: boolean;
  placement: ViewActionPlacement;
  emphasis: 'primary' | 'secondary' | 'danger' | 'quiet';
  recommendation: ViewActionRecommendation;
  event?: PresentationEvent;
  disabledReason?: string;
  riskReason?: string;
  readout?: string;
  combatAction?: CombatAction;
}>;

export type StatusMetric = Readonly<{
  id: string;
  label: string;
  value: string;
  symbol: string;
  severity: 'neutral' | 'positive' | 'warning' | 'danger';
}>;

export type RiskItem = Readonly<{
  id: string;
  severity: 'notice' | 'warning' | 'danger';
  label: string;
  reason: string;
  actionId?: string;
}>;

export type MapNodeState = 'current' | 'adjacent' | 'scouted' | 'cleared' | 'fogged';

export type MapNodeViewModel = Readonly<{
  cellId: string;
  nodeId?: string;
  title: string;
  nodeType: NodeType | 'unknown';
  state: MapNodeState;
  stateLabel: string;
  stateSymbol: string;
  x: number;
  y: number;
  isAdjacent: boolean;
  canMove: boolean;
  moveActionId?: string;
  disabledReason?: string;
}>;

export type MapViewModel = Readonly<{
  dungeonId: DungeonId;
  dungeonName: string;
  width: number;
  height: number;
  seed?: number;
  currentNodeId: string;
  nodes: readonly MapNodeViewModel[];
}>;

export type PendingChoiceViewModel = Readonly<{
  kind:
    | 'equipment-offer'
    | 'relic-draft'
    | 'soul-recharge'
    | 'dungeon-event'
    | 'field-survey'
    | 'law';
  title: string;
  message: string;
  actionIds: readonly string[];
}>;

export type EntryRouteContractTargetViewModel = Readonly<{
  order: 1 | 2;
  nodeId: string;
  nodeTitle: string;
}>;

export type EntryRouteContractOptionViewModel = Readonly<{
  routeContractId: string | null;
  name: string;
  description: string;
  orderedTargets: readonly EntryRouteContractTargetViewModel[];
  rewardPoints: number;
  selected: boolean;
  selectable: boolean;
  disabledReason?: string;
}>;

export type EntryRelicSeedOptionViewModel = Readonly<{
  seedRelicId: RunRelicId | null;
  name: string;
  description: string;
  selected: boolean;
  selectable: boolean;
  disabledReason?: string;
}>;

export type EntryBuildViewModel = Readonly<{
  routeContract: Readonly<{
    selectedRouteContractId: string | null;
    selectionValid: boolean;
    options: readonly EntryRouteContractOptionViewModel[];
    issue?: string;
  }>;
  relic: Readonly<{
    frame: RunRelicFrame;
    frameName: string;
    candidateCount: 2 | 3;
    candidateReadout: '2' | '2 → 3';
    matchingConduitEquipmentIds: readonly EquipmentId[];
    selectedSeedRelicId: RunRelicId | null;
    seedOptions: readonly EntryRelicSeedOptionViewModel[];
  }>;
}>;

export type EquipmentCommissionCostViewModel = Readonly<{
  resource: 'rewardPoints' | 'lingyun';
  label: string;
  required: number;
  held: number;
  gap: number;
}>;

export type EquipmentCommissionCandidateViewModel = Readonly<{
  equipmentId: EquipmentId;
  name: string;
  slotLabel: string;
  materialId: ItemId;
  materialName: string;
  selected: boolean;
}>;

export type EquipmentCommissionMaterialOptionViewModel = Readonly<{
  materialId: ItemId;
  materialName: string;
  selected: boolean;
}>;

export type EquipmentCommissionDetailViewModel = Readonly<{
  helpId: 'equipmentCommission';
  status: 'idle' | 'draft' | 'active';
  draft: EquipmentCommissionDraft;
  requiredEquipmentCount: 2;
  requiredDungeonCount: number;
  materialReward: number;
  cost: readonly EquipmentCommissionCostViewModel[];
  canAfford: boolean;
  candidates: readonly EquipmentCommissionCandidateViewModel[];
  focusedEquipment: Readonly<{
    equipmentId: EquipmentId;
    name: string;
    eligible: boolean;
    selected: boolean;
    disabledReason?: string;
  }>;
  materialOptions: readonly EquipmentCommissionMaterialOptionViewModel[];
  start?: Readonly<{
    enabled: boolean;
    disabledReason?: string;
  }>;
  active?: Readonly<{
    equipmentIds: readonly [EquipmentId, EquipmentId];
    equipmentNames: readonly [string, string];
    targetMaterialId: ItemId;
    targetMaterialName: string;
    completedDungeonIds: readonly DungeonId[];
    completedDungeonNames: readonly string[];
    completedCount: number;
    remainingCount: number;
    recallLossReadout: string;
  }>;
}>;

export type EquipmentMemoryOptionViewModel = Readonly<{
  memoryId: EquipmentMemoryId;
  name: string;
  dungeonId: DungeonId;
  dungeonName: string;
  description: string;
  effectDescription: string;
  active: boolean;
}>;

export type EquipmentMemoryLibraryViewModel = Readonly<{
  helpId: 'equipmentMemory';
  equipmentId: EquipmentId;
  equipmentName: string;
  supported: boolean;
  owned: boolean;
  equipped: boolean;
  unlocked: boolean;
  active: boolean;
  unlockedCount: number;
  unlockedMemories: readonly EquipmentMemoryOptionViewModel[];
  activeMemory?: EquipmentMemoryOptionViewModel;
  cycle: Readonly<{
    enabled: boolean;
    nextMemoryId?: EquipmentMemoryId;
    nextMemoryName?: string;
    disabledReason?: string;
  }>;
  acquisitionReadout: string;
}>;

export type HubDetailViewModel = Readonly<{
  kind: 'hub';
  activePanel: HubPanel;
  activePanelLabel: string;
  panelSummary: string;
  entryDraft: EntryProtocolDraft;
  selectedDungeonName: string;
  seedStatus: 'host-on-confirm';
  dungeonCount: number;
  entryBuild: EntryBuildViewModel;
  equipmentCommission?: EquipmentCommissionDetailViewModel;
  equipmentMemory?: EquipmentMemoryLibraryViewModel;
}>;

export type EquipmentMemoryHuntSignalViewModel = Readonly<{
  type: 'node' | 'event';
  label: string;
  targetId: string;
  targetName: string;
  completed: boolean;
}>;

export type EquipmentMemoryHuntViewModel = Readonly<{
  helpId: 'equipmentMemory';
  compatibility: 'current-legacy-hunt' | 'imported-legacy-hunt' | 'malformed';
  enabled: boolean;
  legacyDisabled: boolean;
  malformedDisabled: boolean;
  display: Readonly<{
    key: 'disabled' | 'active' | 'secured' | 'failed' | 'lost' | 'banked';
    label: string;
    detail: string;
  }>;
  memory?: Readonly<{
    memoryId: EquipmentMemoryId;
    name: string;
    description: string;
  }>;
  equipment?: Readonly<{
    equipmentId: EquipmentId;
    name: string;
  }>;
  frozenAttunement?: Readonly<{
    attunementId: EquipmentAttunementId;
    name: string;
  }>;
  signals: readonly EquipmentMemoryHuntSignalViewModel[];
  completedConditionCount: 0 | 1 | 2;
  totalConditionCount: 2;
  nextTarget: Readonly<{
    kind: 'node' | 'event' | 'exit' | 'resolved' | 'blocked';
    label: string;
  }>;
  failureReason?: EquipmentMemoryHuntReason;
}>;

export type ChapterLawCardViewModel = Readonly<{
  /** `true` only when the core law selector produced a display for the active chapter. */
  present: boolean;
  title: string;
  status: string;
  severity: 'stable' | 'warning' | 'danger' | 'resolved';
  /** Ordered chapter-specific readouts copied verbatim from the core display; never invented. */
  meter?: Readonly<{ value: number; max: number }>;
  targetReached: boolean;
  /** Encounter/trap/healing/output modifier percentages copied from the core display. */
  modifiers: Readonly<{
    encounter: Readonly<{ allStatsPercent: number; defensePercent: number; artPowerPercent: number }>;
    trap: Readonly<{ damagePercent: number; dcPercent: number }>;
    healingPercent: number;
    outgoingDamage: Readonly<{ forcePercent: number; artPercent: number }>;
    guardEffectPercent: number;
  }>;
}>;

export type ChapterDirectiveObjectiveViewModel = Readonly<{
  id: string;
  kind: string;
  label: string;
  description: string;
  completed: boolean;
  progressText: string;
}>;

export type ChapterDirectiveViewModel = Readonly<{
  /** Optional objectives never gate the main route; failure here is separate from route blocking. */
  status: 'locked' | 'active' | 'completed' | 'failed';
  progressText: string;
  rewardPreview: string;
  objectives: readonly ChapterDirectiveObjectiveViewModel[];
}>;

export type ChapterRouteContractTargetViewModel = Readonly<{
  order: 1 | 2;
  nodeId: string;
  nodeTitle: string;
}>;

export type ChapterRouteContractViewModel = Readonly<{
  enabled: boolean;
  /** `true` when the run predates the route-contract field; the panel fails closed. */
  legacyDisabled: boolean;
  /** Discriminates “no contract selected” from a real active/secured/failed contract. */
  status: 'disabled' | 'active' | 'secured' | 'failed' | 'lost' | 'banked';
  display: Readonly<{
    key: 'disabled' | 'pending_first' | 'pending_second' | 'secured' | 'failed' | 'lost' | 'banked';
    label: string;
    detail: string;
  }>;
  name?: string;
  description?: string;
  /** Strict 0|1|2 of 2 completed targets exposed by the core progress selector. */
  completedTargetCount: 0 | 1 | 2;
  totalTargetCount: 2;
  completedReadout: '0 / 2' | '1 / 2' | '2 / 2';
  /** Ordered 1→2 targets; only present when the core selector supplies a definition. */
  orderedTargets: readonly ChapterRouteContractTargetViewModel[];
  nextTarget?: Readonly<{ order: 1 | 2; nodeId: string; nodeTitle: string }>;
  potentialRewardPoints: number;
  bankedRewardPoints: number;
  reason?: string;
}>;

export type ChapterPressureViewModel = Readonly<{
  /** `true` when the run predates or corrupts the pressure snapshot; shown honestly. */
  legacyDisabled: boolean;
  present: boolean;
  tier?: 'stable' | 'hunted' | 'breach';
  label?: string;
  pressurePercent?: number;
  rewardBonusPercent?: number;
  nextTierAt?: number | null;
}>;

export type ChapterPursuitViewModel = Readonly<{
  /** `true` when this chapter defines no pursuit or the run predates the pursuit snapshot. */
  legacyDisabled: boolean;
  present: boolean;
  name?: string;
  status?: 'disabled' | 'dormant' | 'stalking' | 'contained' | 'fused' | 'repelled';
  statusLabel?: string;
  statusDescription?: string;
  flavorDescription?: string;
  fusionDescription?: string;
  contactDamagePercent?: number;
  bossFusionPercent?: number;
  rewardAmount?: number;
  progress?: Readonly<{
    active: boolean;
    currentNodeId: string | null;
    contacts: number;
    graceMoves: 0 | 1;
    rewardGranted: boolean;
    repelledReason: string | null;
    clearedNodeCount: number;
    spawnClearCount: number;
    clearsRemaining: number;
  }>;
}>;

export type ChapterDecisionViewModel = Readonly<{
  dungeonId: DungeonId;
  dungeonName: string;
  law: ChapterLawCardViewModel;
  directive: ChapterDirectiveViewModel;
  routeContract: ChapterRouteContractViewModel;
  pressure: ChapterPressureViewModel;
  pursuit: ChapterPursuitViewModel;
}>;

export type ExploreDetailViewModel = Readonly<{
  kind: 'explore';
  map: MapViewModel;
  currentNode: Readonly<{
    nodeId: string;
    title: string;
    nodeType: NodeType;
    description: string;
    cleared: boolean;
  }>;
  /** Read-only chapter decision projection; present for every healthy run, never gated by pending. */
  chapterDecision?: ChapterDecisionViewModel;
  pending?: PendingChoiceViewModel;
  equipmentMemoryHunt?: EquipmentMemoryHuntViewModel;
}>;

export type EquipmentMemoryCombatViewModel = Readonly<{
  helpId: 'equipmentMemory';
  status: 'active' | 'legacy-disabled' | 'malformed-disabled';
  enabled: boolean;
  activeName?: string;
  memoryId?: EquipmentMemoryId;
  matchingEquipmentIds: readonly EquipmentId[];
  matchingEquipmentNames: readonly string[];
  overflowState: 'empty' | 'stored' | 'restored';
  overflowStored: boolean;
  restored: boolean;
  disabledReason?: string;
}>;

/**
 * Read-only combat chapter context. Every field is copied from the public core law/pursuit
 * selectors; the presentation layer never recomputes modifiers or pursuit rules. Missing or
 * corrupt snapshots fail closed: `present: false` carries no invented numbers.
 */
export type CombatChapterLawContextViewModel = Readonly<{
  present: boolean;
  title: string;
  status: string;
  severity: 'stable' | 'warning' | 'danger' | 'resolved';
  meter?: Readonly<{ value: number; max: number }>;
  /** Combat-relevant modifier percentages copied verbatim from the core law display. */
  modifiers: Readonly<{
    enemyAllStatsPercent: number;
    enemyDefensePercent: number;
    enemyArtPowerPercent: number;
    outgoingForcePercent: number;
    outgoingArtPercent: number;
    healingPercent: number;
    guardEffectPercent: number;
  }>;
}>;

export type CombatChapterPursuitContextViewModel = Readonly<{
  /** `true` when this chapter defines no pursuit or the run predates the pursuit snapshot. */
  legacyDisabled: boolean;
  present: boolean;
  name?: string;
  status?: 'disabled' | 'dormant' | 'stalking' | 'contained' | 'fused' | 'repelled';
  statusLabel?: string;
  contactDamagePercent?: number;
  bossFusionPercent?: number;
}>;

export type CombatChapterContextViewModel = Readonly<{
  dungeonId: DungeonId;
  dungeonName: string;
  law: CombatChapterLawContextViewModel;
  pursuit: CombatChapterPursuitContextViewModel;
}>;

export type CombatDetailViewModel = Readonly<{
  kind: 'combat';
  player: Readonly<{ hp: number; maxHp: number; hpPercent: number }>;
  enemy: Readonly<{
    id: string;
    name: string;
    hp: number;
    maxHp: number;
    hpPercent: number;
    ability: string;
  }>;
  intent: Readonly<{
    id: string;
    name: string;
    severity: 'normal' | 'warning' | 'danger';
    consequence: string;
    recommendedActions: readonly CombatAction[];
    dangerousActions: readonly CombatAction[];
  }>;
  boss?: Readonly<{
    phase: 'sealed' | 'awakened';
    phaseLabel: string;
    title: string;
    sealName: string;
  }>;
  turn: number;
  advancedExpanded: boolean;
  /** Read-only chapter law/pursuit context for the active run; absent when no run snapshot exists. */
  chapterContext?: CombatChapterContextViewModel;
  equipmentMemory?: EquipmentMemoryCombatViewModel;
}>;

export type EquipmentCommissionSettlementViewModel = Readonly<{
  helpId: 'equipmentCommission';
  status: 'advanced' | 'completed';
  dungeonId: DungeonId;
  dungeonName: string;
  equipmentIds: readonly [EquipmentId, EquipmentId];
  equipmentNames: readonly [string, string];
  targetMaterialId: ItemId;
  targetMaterialName: string;
  completedDungeonIds: readonly DungeonId[];
  completedDungeonNames: readonly string[];
  completedCount: number;
  requiredDungeonCount: number;
  remainingCount: number;
  rewardAmount: number;
  rewardReadout: string;
}>;

export type EquipmentMemoryLegacySettlementViewModel = Readonly<{
  granted: boolean;
  status: EquipmentMemoryHuntStatus;
  reason?: EquipmentMemoryHuntReason;
  dungeonId: DungeonId;
  dungeonName: string;
  equipmentId: EquipmentId;
  equipmentName: string;
  memoryId: EquipmentMemoryId;
  memoryName: string;
  displayLabel: string;
  displayDetail: string;
  rewardReadout: string;
}>;

export type EquipmentMemoryModernLibraryResultViewModel = Readonly<{
  dungeonId: DungeonId;
  dungeonName: string;
  memoryId: EquipmentMemoryId;
  memoryName: string;
  status: 'not-recorded' | 'recorded' | 'active';
  recordedEquipmentIds: readonly EquipmentId[];
  recordedEquipmentNames: readonly string[];
  activeEquipmentIds: readonly EquipmentId[];
  activeEquipmentNames: readonly string[];
  readout: string;
}>;

export type EquipmentMemoryResultViewModel = Readonly<{
  helpId: 'equipmentMemory';
  legacyHunt?: EquipmentMemoryLegacySettlementViewModel;
  modernLibrary?: EquipmentMemoryModernLibraryResultViewModel;
}>;

/**
 * Stable identity of each result settlement card. The invalid variant carries only this
 * identity plus a Chinese diagnostic, so a corrupt settlement can never masquerade as a
 * valid card or leak raw domain tokens.
 */
export type ResultSettlementCard =
  | 'loot'
  | 'equipment-roll'
  | 'protocol'
  | 'directive'
  | 'route-contract'
  | 'pressure'
  | 'pursuit';

export type ResultSettlementInvalid = Readonly<{
  state: 'invalid';
  card: ResultSettlementCard;
  diagnostic: string;
}>;

export type ResultLootSettlementViewModel = Readonly<{
  state: 'valid';
  retainedRewardPoints: number;
  retainedLingyun: number;
  retainedItemCount: number;
  retainedEquipmentCount: number;
  retainedEquipmentNames: readonly string[];
  lostRewardPoints: number;
  lostLingyun: number;
  lostItemCount: number;
  lostEquipmentCount: number;
  lostEquipmentNames: readonly string[];
}> | ResultSettlementInvalid;

export type ResultEquipmentRollSettlementViewModel = Readonly<{
  state: 'valid';
  equipmentName: string;
  outcomeLabel: string;
  previousItemPower?: number;
  salvageRewardPoints: number;
}> | ResultSettlementInvalid;

export type ResultProtocolSettlementViewModel = Readonly<{
  state: 'valid';
  protocolName: string;
  statusLabel: string;
  bossDefeated: boolean;
  baseRewardPoints: number;
  protocolRewardPoints: number;
  rewardPointBonus: number;
  cycleImprintGranted: boolean;
  materialRewardName?: string;
  materialRewardAmount?: number;
}> | ResultSettlementInvalid;

export type ResultDirectiveSettlementViewModel = Readonly<{
  state: 'valid';
  statusLabel: string;
  progressText: string;
  rewardPreview: string;
  objectives: readonly Readonly<{
    id: string;
    kind: string;
    label: string;
    description: string;
    completed: boolean;
    progressText: string;
  }>[];
}> | ResultSettlementInvalid;

export type ResultRouteContractSettlementViewModel = Readonly<{
  state: 'valid';
  contractName: string;
  statusLabel: string;
  completedTargetCount: number;
  totalTargetCount: number;
  rewardPoints: number;
  rewarded: boolean;
  reasonLabel?: string;
}> | ResultSettlementInvalid;

export type ResultPressureSettlementViewModel = Readonly<{
  state: 'valid';
  tierLabel: string;
  rewardPointBonus: number;
}> | ResultSettlementInvalid;

export type ResultPursuitSettlementViewModel = Readonly<{
  state: 'valid';
  name: string;
  reasonLabel: string;
  rewarded: boolean;
  materialName?: string;
}> | ResultSettlementInvalid;

export type ResultDetailViewModel = Readonly<{
  kind: 'result';
  dungeonId?: DungeonId;
  dungeonName?: string;
  outcome: string;
  relicArchiveStatus: 'none' | 'pending' | 'archived' | 'skipped' | 'lost';
  equipmentCommissionSettlement?: EquipmentCommissionSettlementViewModel;
  equipmentMemory?: EquipmentMemoryResultViewModel;
  lootSettlement?: ResultLootSettlementViewModel;
  equipmentRollSettlement?: ResultEquipmentRollSettlementViewModel;
  protocolSettlement?: ResultProtocolSettlementViewModel;
  directiveSettlement?: ResultDirectiveSettlementViewModel;
  routeContractSettlement?: ResultRouteContractSettlementViewModel;
  pressureSettlement?: ResultPressureSettlementViewModel;
  pursuitSettlement?: ResultPursuitSettlementViewModel;
}>;

export type PhaseDetailViewModel =
  | HubDetailViewModel
  | ExploreDetailViewModel
  | CombatDetailViewModel
  | ResultDetailViewModel;

export type ObjectiveSection = Readonly<{
  kind: 'objective';
  title: string;
  summary: string;
}>;

export type CharacterLoadoutViewModel = Readonly<{
  /** Read-only preparation snapshot for the paper-doll character sheet. */
  power: number;
  hp: number;
  maxHp: number;
  attack: number;
  artPower: number;
  defense: number;
  equipment: readonly Readonly<{
    slot: EquipmentSlot;
    slotLabel: string;
    equipmentId: EquipmentId;
    name: string;
    level: number;
    maxLevel: number;
  }>[];
  items: readonly Readonly<{
    itemId: ItemId;
    name: string;
    category: TacticalItemCategory;
    count: number;
    carried: boolean;
  }>[];
  carriedCount: number;
}>;

export type StatusSection = Readonly<{
  kind: 'status';
  metrics: readonly StatusMetric[];
  detail: PhaseDetailViewModel;
  /** Present in every projection; the mobile character sheet renders the equipment doll from it. */
  loadout?: CharacterLoadoutViewModel;
}>;

export type ActionsSection = Readonly<{
  kind: 'actions';
  actions: readonly ViewActionModel[];
}>;

export type RisksSection = Readonly<{
  kind: 'risks';
  items: readonly RiskItem[];
}>;

export type HelpEntryViewModel = Readonly<{
  id: PresentationHelpId;
  title: string;
  summary: string;
  mechanic: string;
  guidance: string;
  readout: string;
  keywords: readonly string[];
  openAction: Readonly<{
    actionId: string;
    event: Extract<PresentationEvent, { kind: 'local' }>;
  }>;
}>;

export type HelpSection = Readonly<{
  kind: 'help';
  entries: readonly HelpEntryViewModel[];
  active?: Readonly<{
    id: PresentationHelpId;
    title: string;
    summary: string;
    mechanic: string;
    guidance: string;
    readout: string;
    keywords: readonly string[];
    closeAction: Readonly<{
      actionId: 'help.close';
      event: Extract<PresentationEvent, { kind: 'local' }>;
    }>;
  }>;
}>;

export type LogsSection = Readonly<{
  kind: 'logs';
  lines: readonly string[];
}>;

export type OrderedViewSections = readonly [
  ObjectiveSection,
  StatusSection,
  ActionsSection,
  RisksSection,
  HelpSection,
  LogsSection
];

export type GameViewModel = Readonly<{
  schemaVersion: 1;
  phase: Phase;
  screenTitle: string;
  visualAssetKey?: GameAssetDefinition['key'];
  dispatchPolicy: 'one-event-per-action';
  sections: OrderedViewSections;
}>;
