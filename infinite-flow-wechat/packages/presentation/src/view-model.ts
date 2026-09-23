import {
  reduceGameCommand,
  type GameCommand,
  type ReadonlyGameState
} from '@infinite-flow/application';
import {
  BLOODLINE_CATALOG,
  COMPANION_CATALOG,
  COMPANION_RULES_VERSION,
  DUNGEONS,
  DUNGEON_FEATURE_HELP,
  DUNGEON_FEATURE_HELP_IDS,
  DUNGEON_ORDER,
  EQUIPMENT,
  EQUIPMENT_SLOTS,
  ITEMS,
  METHOD_TECHNIQUE_CATALOG,
  METHODS,
  PETS,
  getAvailableDungeonEvents,
  getBossSealStatus,
  getBloodlineProgress,
  getBloodlineUpgradeStatus,
  getCampaignGates,
  getCombatActionDamagePreview,
  getCombatEncounterProfile,
  getCurrentBloodlineSurgeStatus,
  getCurrentCombatIntent,
  getCurrentCompanionAssistStatus,
  getCurrentDungeonDefinition,
  getCurrentDungeonLaw,
  getCurrentFieldSurveyStatus,
  getCurrentLegalAdjacentTargetIds,
  getCurrentMethodTechniqueStatus,
  getCurrentRouteBlockReason,
  getCurrentRouteContract,
  getCurrentRunMethodSnapshots,
  getCurrentRunPursuit,
  getDirectiveEvaluation,
  getDirectiveForDungeon,
  getCompanionRecruitmentStatus,
  getCompanionUpgradeStatus,
  getCurrentEquipmentMemoryCombatStatus,
  getCurrentEquipmentMemoryHuntStatus,
  getCurrentRunPressure,
  getDerivedStats,
  getEquipmentCommissionStatus,
  getEquipmentMemoryStatus,
  getEquipmentSoulSkillActionStatuses,
  getEquipmentSoulSkillRechargeStatus,
  getEquipmentRecipePurchaseStatus,
  getEquipmentTemperStatus,
  getGameAsset,
  getInfernoUnlockedTier,
  getMethodCultivationProgress,
  getMethodUpgradeStatus,
  getNodeDepartureBlock,
  getPlayerPower,
  getReadyCombatCapturePetId,
  getRouteContractById,
  getRunRelicPreparationStatus,
  getRunDiscoveredNodeIds,
  getRunPursuitDefinition,
  normalizeRunPursuitState,
  getTacticalLoadoutStatus,
  getWeaponSkillStatus,
  isCurrentDungeonFeatureAvailable,
  isTacticalItemAvailable,
  listRouteContracts,
  type CombatAction,
  type DirectiveObjective,
  type DirectiveObjectiveResult,
  type DungeonId,
  type EquipmentId,
  type GameState,
  type GameAssetDefinition,
  type GameAssetKind,
  type ItemId,
  type NodeDepartureBlock
} from '@infinite-flow/core';
import { getEquipmentMemoryForDungeon } from '@infinite-flow/core/equipment-memory-hunts';
import { getEquipmentRelicConduitFrameMatch } from '@infinite-flow/core/equipment-relic-conduits';
import { isEquipmentRoll } from '@infinite-flow/core/equipment-rolls';
import { getEquipmentAttunementOptions } from '@infinite-flow/core/equipment-system';
import { getExplorationGuide } from '@infinite-flow/core/exploration-guide';
import { normalizeRouteContractRunState } from '@infinite-flow/core/route-contracts';
import type { RunOutcome } from '@infinite-flow/core/run-economy';
import { normalizeRunPressureState } from '@infinite-flow/core/run-pressure';
import { getRunProtocolDefinition } from '@infinite-flow/core/run-protocols';
import {
  RUN_PROTOCOL_IDS,
  isRunProtocolAvailable,
  type RunProtocolId
} from '@infinite-flow/core/run-protocols';
import {
  RUN_RELIC_DRAFT_CANDIDATE_COUNTS,
  RUN_RELIC_DEFINITIONS,
  RUN_RELIC_FRAME_DEFINITIONS,
  type RunRelicFrame
} from '@infinite-flow/core/run-relics';
import {
  evaluateVisibleTasks,
  type MainGodTaskEvaluation
} from '@infinite-flow/core/task-system';
import {
  CARRIED_TACTICAL_ITEM_IDS,
  FIELD_SUPPLY_ITEM_IDS,
  TACTICAL_ITEM_IDS,
  TACTICAL_ITEM_CATEGORY_BY_ID,
  isFieldSupplyItemId
} from '@infinite-flow/core/tactical-loadout';
import { COCOS_DESIGN_TOKENS } from './tokens.js';
import { buildHubOwnedLoadoutCatalog, buildHubShopCatalog } from './hub-shop.js';
import {
  HUB_PANELS,
  type ActionsSection,
  type ChapterDecisionViewModel,
  type CharacterLoadoutViewModel,
  type ChapterDirectiveViewModel,
  type ChapterLawCardViewModel,
  type ChapterPressureViewModel,
  type ChapterPursuitViewModel,
  type ChapterRouteContractViewModel,
  type CombatChapterContextViewModel,
  type CombatDetailViewModel,
  type DeepReadonly,
  type EntryBuildViewModel,
  type EntryProtocolDraft,
  type EquipmentCommissionDetailViewModel,
  type EquipmentCommissionDraft,
  type EquipmentCommissionDraftEquipmentIds,
  type EquipmentCommissionSettlementViewModel,
  type EquipmentMemoryCombatViewModel,
  type EquipmentMemoryHuntViewModel,
  type EquipmentMemoryLibraryViewModel,
  type EquipmentMemoryModernLibraryResultViewModel,
  type EquipmentMemoryResultViewModel,
  type ExploreDetailViewModel,
  type GameViewModel,
  type HelpSection,
  type HubCatalogPanel,
  type HubDetailViewModel,
  type HubEntryServiceViewModel,
  type HubOwnedLoadoutViewModel,
  type HubPanel,
  type LogsSection,
  type MapNodeState,
  type MapNodeViewModel,
  type MapViewModel,
  type ObjectiveSection,
  type PendingChoiceViewModel,
  type PresentationEvent,
  type PresentationHelpId,
  type PresentationLocalUiState,
  type ResultDetailViewModel,
  type ResultDirectiveSettlementViewModel,
  type ResultEquipmentRollSettlementViewModel,
  type ResultLootSettlementViewModel,
  type ResultPursuitSettlementViewModel,
  type ResultPressureSettlementViewModel,
  type ResultProtocolSettlementViewModel,
  type ResultRouteContractSettlementViewModel,
  type ResultSettlementCard,
  type ResultSettlementInvalid,
  type RiskItem,
  type RisksSection,
  type StatusMetric,
  type StatusSection,
  type TaskViewModel,
  type ViewActionModel,
  type ViewActionPlacement,
  type ViewActionRecommendation
} from './types.js';

const FIRST_DUNGEON_ID: DungeonId = DUNGEON_ORDER[0];

const EQUIPMENT_COMMISSION_HELP = Object.freeze({
  title: '装备封存委托',
  summary: '封存两件合格装备，完成三个不同副本的成功出口后，换取所选淬炼材料。',
  mechanic: '候选装备必须已拥有、达到最高等级、可淬炼且当前未装备。委托进行中，两件装备被封存，不能装备、升级、铭刻、淬炼，也不能作为装备记忆狩猎目标。',
  guidance: '启动固定消耗 300 奖励点与 1 灵蕴；两件装备必须不同，目标材料必须来自其中一件装备的淬炼材料。只有成功抵达三个不同副本的出口才推进，重复副本、主动撤退或失败都不推进。',
  readout: '撤回不返还启动消耗，并会清空已完成的不同副本进度。完成后两件装备解除封存，目标材料 x2 直接存入永久背包。',
  keywords: ['装备', '封存', '委托', '不同副本', '撤回', '淬炼材料'] as const
});

const EQUIPMENT_MEMORY_HELP = Object.freeze({
  title: '装备记忆',
  summary: '现代流程会为已装备、满级、采用合法铭刻且淬炼达到 II 的成熟装备，在成功抵达出口后自动收录并激活当前章节记忆。',
  mechanic: '装备记忆是长期装备能力：入场时只冻结已装备且已激活的记忆，现代 flowVersion 2 不再选择或准备记忆狩猎。已经收录多段记忆时，可在装备面板聚焦该装备并循环切换当前激活记忆。',
  guidance: '想收录本章记忆时，先在主神空间完成装备、满级、合法铭刻与淬炼 II 的整备，再正常通关；现代入场无需额外接取狩猎，也不要寻找旧版预选入口。',
  readout: '导入的 legacy 狩猎局仍按“目标节点 + 目标事件”双信号、冻结铭刻和原结算结果显示；这只用于兼容恢复，不会重新成为现代入场选项。',
  keywords: ['装备记忆', '自动收录', '成功出口', '装备面板切换', '入场冻结', 'legacy 双信号'] as const
});

const PRESENTATION_HELP_IDS: readonly PresentationHelpId[] = Object.freeze([
  ...DUNGEON_FEATURE_HELP_IDS,
  'equipmentCommission'
]);

function getPresentationHelpEntry(id: PresentationHelpId) {
  if (id === 'equipmentCommission') return EQUIPMENT_COMMISSION_HELP;
  if (id === 'equipmentMemory') return EQUIPMENT_MEMORY_HELP;
  return DUNGEON_FEATURE_HELP[id];
}

type ActionInput = Readonly<{
  actionId: string;
  label: string;
  placement: ViewActionPlacement;
  enabled?: boolean;
  event?: PresentationEvent;
  disabledReason?: string;
  riskReason?: string;
  readout?: string;
  emphasis?: ViewActionModel['emphasis'];
  recommendation?: ViewActionRecommendation;
  combatAction?: CombatAction;
}>;

type PhaseProjection = Readonly<{
  title: string;
  visualAssetKey?: GameAssetDefinition['key'];
  objective: ObjectiveSection;
  status: StatusSection;
  actions: readonly ViewActionModel[];
  risks?: readonly RiskItem[];
  logs: readonly string[];
}>;

function verifiedVisualAssetKey(
  kind: GameAssetKind,
  entityId: string
): GameAssetDefinition['key'] | undefined {
  return getGameAsset(kind, entityId)?.key;
}

function asDomainState(state: ReadonlyGameState): GameState {
  // Core selectors are pure. The cast is internal and the returned VM never retains state.
  return state as GameState;
}

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

function serializableSnapshot<T>(value: T): DeepReadonly<T> {
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new TypeError('Presentation view model is not JSON serializable.');
  return deepFreeze(JSON.parse(encoded) as T);
}

function clampPercent(value: number, maximum: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(maximum) || maximum <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / maximum) * 100)));
}

function makeAction(input: ActionInput): ViewActionModel {
  const enabled = input.enabled ?? true;
  return {
    actionId: input.actionId,
    label: input.label,
    enabled,
    placement: input.placement,
    emphasis: input.emphasis ?? 'secondary',
    recommendation: input.recommendation ?? 'neutral',
    ...(enabled && input.event ? { event: input.event } : {}),
    ...(!enabled && input.disabledReason ? { disabledReason: input.disabledReason } : {}),
    ...(input.riskReason ? { riskReason: input.riskReason } : {}),
    ...(input.readout ? { readout: input.readout } : {}),
    ...(input.combatAction ? { combatAction: input.combatAction } : {})
  };
}

function commandAction(
  actionId: string,
  label: string,
  placement: ViewActionPlacement,
  command: GameCommand,
  options: Omit<ActionInput, 'actionId' | 'label' | 'placement' | 'event'> = {}
): ViewActionModel {
  return makeAction({
    actionId,
    label,
    placement,
    event: { kind: 'command', command },
    ...options
  });
}

function localAction(
  actionId: string,
  label: string,
  placement: ViewActionPlacement,
  action: Extract<PresentationEvent, { kind: 'local' }>['action'],
  options: Omit<ActionInput, 'actionId' | 'label' | 'placement' | 'event'> = {}
): ViewActionModel {
  return makeAction({
    actionId,
    label,
    placement,
    event: { kind: 'local', action },
    ...options
  });
}

function disabledAction(
  actionId: string,
  label: string,
  placement: ViewActionPlacement,
  disabledReason: string,
  options: Omit<ActionInput, 'actionId' | 'label' | 'placement' | 'event' | 'enabled' | 'disabledReason'> = {}
): ViewActionModel {
  return makeAction({ actionId, label, placement, enabled: false, disabledReason, ...options });
}

function mergeUniqueActionsEnabledFirst(
  groups: readonly (readonly ViewActionModel[])[]
): ViewActionModel[] {
  const seen = new Set<string>();
  const actions = groups.flatMap((group) => group).filter((action) => {
    if (seen.has(action.actionId)) return false;
    seen.add(action.actionId);
    return true;
  });
  return [
    ...actions.filter((action) => action.enabled),
    ...actions.filter((action) => !action.enabled)
  ];
}

function buildHelpSection(activeHelpId: PresentationLocalUiState['activeHelpId']): HelpSection {
  const entries = PRESENTATION_HELP_IDS.map((id) => {
    const entry = getPresentationHelpEntry(id);
    return {
      id,
      title: entry.title,
      summary: entry.summary,
      mechanic: entry.mechanic,
      guidance: entry.guidance,
      readout: entry.readout,
      keywords: [...entry.keywords],
      openAction: {
        actionId: `help.open:${id}`,
        event: { kind: 'local' as const, action: { type: 'help/open' as const, helpId: id } }
      }
    };
  });
  const active = activeHelpId ? getPresentationHelpEntry(activeHelpId) : undefined;
  return {
    kind: 'help',
    entries,
    ...(activeHelpId && active
      ? {
          active: {
            id: activeHelpId,
            title: active.title,
            summary: active.summary,
            mechanic: active.mechanic,
            guidance: active.guidance,
            readout: active.readout,
            keywords: [...active.keywords],
            closeAction: {
              actionId: 'help.close' as const,
              event: { kind: 'local' as const, action: { type: 'help/close' as const } }
            }
          }
        }
      : {})
  };
}

function getActionRisks(actions: readonly ViewActionModel[]): RiskItem[] {
  return actions.flatMap((action): RiskItem[] => {
    if (!action.enabled && action.disabledReason) {
      return [{
        id: `disabled:${action.actionId}`,
        severity: 'notice',
        label: `${action.label}不可用`,
        reason: action.disabledReason,
        actionId: action.actionId
      }];
    }
    if (action.riskReason) {
      return [{
        id: `risk:${action.actionId}`,
        severity: action.recommendation === 'high-risk' ? 'danger' : 'warning',
        label: action.recommendation === 'high-risk' ? `${action.label}：高风险` : action.label,
        reason: action.riskReason,
        actionId: action.actionId
      }];
    }
    return [];
  });
}

function dedupeRisks(items: readonly RiskItem[]): RiskItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.id}:${item.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function defaultEntryDraft(): EntryProtocolDraft {
  return { dungeonId: FIRST_DUNGEON_ID, protocolId: 'standard' };
}

function getEntryDraftIssue(state: GameState, draft: EntryProtocolDraft): string | undefined {
  const gate = getCampaignGates(state).find((candidate) => candidate.dungeonId === draft.dungeonId);
  if (!gate || gate.status === 'locked') return gate?.requirementText ?? '未知副本，无法入场。';
  if (draft.routeContractId !== undefined) {
    const routeContract = getRouteContractById(draft.routeContractId, draft.dungeonId);
    if (!routeContract) return '所选路线契约不属于当前副本，请重新选择后再入场。';
    if (!state.completedDungeonIds.includes(draft.dungeonId)) {
      return `路线契约仅可用于已通关的${DUNGEONS[draft.dungeonId].name}复刷。`;
    }
  }
  if (!RUN_PROTOCOL_IDS.includes(draft.protocolId)) return '未知入场协议。';
  if (!isRunProtocolAvailable(draft.dungeonId, draft.protocolId, state.completedDungeonIds)) {
    return '该协议需要先完成对应副本的标准探索。';
  }
  if (draft.protocolId === 'deep') {
    const unlockedTier = getInfernoUnlockedTier(state, draft.dungeonId);
    if (!Number.isSafeInteger(draft.infernoTier) || (draft.infernoTier ?? 0) < 1) {
      return '炼狱入场必须选择正整数层级。';
    }
    if ((draft.infernoTier ?? 0) > unlockedTier) return `炼狱最高仅解锁至第 ${unlockedTier} 层。`;
  }
  return undefined;
}

type EntryBuildProjection = Readonly<{
  detail: EntryBuildViewModel;
  actions: readonly ViewActionModel[];
}>;

function routeContractTargetReadout(
  dungeonId: DungeonId,
  targetNodeIds: readonly [string, string]
): string {
  const dungeon = DUNGEONS[dungeonId];
  const targetTitle = (nodeId: string): string =>
    dungeon.nodes.find((node) => node.id === nodeId)?.title ?? nodeId;
  return `目标 1 ${targetTitle(targetNodeIds[0])} → 目标 2 ${targetTitle(targetNodeIds[1])}`;
}

function buildEntryBuildProjection(state: GameState, draft: EntryProtocolDraft): EntryBuildProjection {
  const dungeon = DUNGEONS[draft.dungeonId];
  const contracts = dungeon === undefined ? [] : [...listRouteContracts(draft.dungeonId)];
  const selectedContract = draft.routeContractId === undefined
    ? undefined
    : getRouteContractById(draft.routeContractId, draft.dungeonId);
  const routeUnlocked = dungeon !== undefined && state.completedDungeonIds.includes(draft.dungeonId);
  const routeSelectionIssue = draft.routeContractId !== undefined && selectedContract === undefined
    ? '所选路线契约不属于当前副本。'
    : selectedContract !== undefined && !routeUnlocked
      ? `首次通关${dungeon?.name ?? '当前副本'}后才能携带路线契约复刷。`
      : undefined;
  const routeOptions: EntryBuildViewModel['routeContract']['options'] = [
    {
      routeContractId: null,
      name: '不接契约',
      description: '保持普通路线，不增加有序目标。',
      orderedTargets: [],
      rewardPoints: 0,
      selected: draft.routeContractId === undefined,
      selectable: draft.routeContractId !== undefined,
      ...(draft.routeContractId === undefined ? { disabledReason: '当前已选择不接契约。' } : {})
    },
    ...contracts.map((contract) => {
      const selected = contract.id === draft.routeContractId;
      const disabledReason = selected
        ? `当前已选择路线契约「${contract.name}」。`
        : !routeUnlocked
          ? `首次通关${dungeon!.name}后才能选择路线契约。`
          : undefined;
      return {
        routeContractId: contract.id,
        name: contract.name,
        description: contract.description,
        orderedTargets: contract.targetNodeIds.map((nodeId, index) => ({
          order: (index + 1) as 1 | 2,
          nodeId,
          nodeTitle: dungeon!.nodes.find((node) => node.id === nodeId)?.title ?? nodeId
        })),
        rewardPoints: contract.rewardPoints,
        selected,
        selectable: disabledReason === undefined,
        ...(disabledReason === undefined ? {} : { disabledReason })
      };
    })
  ];
  const selectableRouteIds: readonly (string | null)[] = routeUnlocked
    ? routeOptions.map(({ routeContractId }) => routeContractId)
    : [null];
  const currentRouteId = selectedContract?.id ?? null;
  const routeIndex = selectableRouteIds.findIndex((routeContractId) => routeContractId === currentRouteId);
  const nextRouteId = routeSelectionIssue !== undefined
    ? null
    : selectableRouteIds[(Math.max(0, routeIndex) + 1) % selectableRouteIds.length]!;
  const nextRoute = nextRouteId === null
    ? undefined
    : contracts.find((contract) => contract.id === nextRouteId);
  const routeAction = selectableRouteIds.length <= 1 && routeSelectionIssue === undefined
    ? disabledAction(
        'hub.entry.route-contract:next',
        '路线契约：不接契约',
        'preparation',
        dungeon === undefined
          ? '未知副本没有可选择的路线契约。'
          : `首次通关${dungeon.name}后才会解锁该章的 3 个路线契约。`
      )
    : localAction(
        'hub.entry.route-contract:next',
        `切换路线契约：${nextRoute?.name ?? '不接契约'}`,
        'preparation',
        { type: 'entry/select-route-contract', routeContractId: nextRouteId },
        {
          readout: nextRoute === undefined
            ? '保持普通路线，不增加有序目标。'
            : `${routeContractTargetReadout(nextRoute.dungeonId, nextRoute.targetNodeIds)} · 独立奖励 ${nextRoute.rewardPoints} 奖励点`
        }
      );

  const preparation = getRunRelicPreparationStatus(state);
  const frame = preparation.preparedRelicFrame;
  const frameDefinition = RUN_RELIC_FRAME_DEFINITIONS[frame];
  const conduitMatch = getEquipmentRelicConduitFrameMatch(frame, preparation.activeConduits);
  const candidateCount = conduitMatch.matched
    ? RUN_RELIC_DRAFT_CANDIDATE_COUNTS.matchingEquipmentConduit
    : RUN_RELIC_DRAFT_CANDIDATE_COUNTS.ordinary;
  const legalSeedRelicIds = preparation.archivedRelicIds.filter(
    (relicId) => RUN_RELIC_DEFINITIONS[relicId].frame === frame
  );
  const selectedSeedRelicId = preparation.preparedRelicSeedId;
  const seedOptions: EntryBuildViewModel['relic']['seedOptions'] = [
    {
      seedRelicId: null,
      name: '不携带种子',
      description: '首轮候选保持正常随机。',
      selected: selectedSeedRelicId === undefined,
      selectable: selectedSeedRelicId !== undefined,
      ...(selectedSeedRelicId === undefined ? { disabledReason: '当前未携带归档种子。' } : {})
    },
    ...legalSeedRelicIds.map((relicId) => {
      const relic = RUN_RELIC_DEFINITIONS[relicId];
      const selected = relicId === selectedSeedRelicId;
      return {
        seedRelicId: relicId,
        name: relic.name,
        description: relic.description,
        selected,
        selectable: !selected,
        ...(selected ? { disabledReason: `「${relic.name}」已经是当前归档种子。` } : {})
      };
    })
  ];
  const currentSeedIndex = seedOptions.findIndex(({ selected }) => selected);
  const nextSeed = seedOptions[(Math.max(0, currentSeedIndex) + 1) % seedOptions.length]!;
  const seedAction = seedOptions.length <= 1
    ? disabledAction(
        'hub.entry.relic-seed:next',
        `${frameDefinition.name}回响：无归档种子`,
        'preparation',
        `「${frameDefinition.name}」框架尚无已归档遗物；先完成一局并归档后才能设为种子。`,
        { readout: `每次回响候选 ${candidateCount} 个。` }
      )
    : localAction(
        'hub.entry.relic-seed:next',
        `切换归档种子：${nextSeed.name}`,
        'preparation',
        {
          type: 'entry/select-relic-seed',
          frame,
          seedRelicId: nextSeed.seedRelicId
        },
        {
          readout: `${nextSeed.description} · 每次回响候选 ${conduitMatch.matched ? '2 → 3' : '2'} 个。`
        }
      );

  return {
    detail: {
      routeContract: {
        selectedRouteContractId: draft.routeContractId ?? null,
        selectionValid: routeSelectionIssue === undefined,
        options: routeOptions,
        ...(routeSelectionIssue === undefined ? {} : { issue: routeSelectionIssue })
      },
      relic: {
        frame,
        frameName: frameDefinition.name,
        candidateCount,
        candidateReadout: conduitMatch.matched ? '2 → 3' : '2',
        matchingConduitEquipmentIds: [...conduitMatch.sourceEquipmentIds],
        selectedSeedRelicId: selectedSeedRelicId ?? null,
        seedOptions
      }
    },
    actions: [routeAction, seedAction]
  };
}

const HUB_PANEL_LABELS: Readonly<Record<HubPanel, string>> = Object.freeze({
  entry: '入场',
  supplies: '物资与携行',
  equipment: '装备工坊',
  pets: '灵宠',
  methods: '功法',
  bloodlines: '血统',
  companions: '同伴',
  tasks: '任务'
});

const EQUIPMENT_SLOT_LABELS = Object.freeze({
  weapon: '武器',
  head: '头部',
  armor: '护甲',
  hands: '护手',
  feet: '足部',
  waist: '腰部',
  charm: '护符'
});

const BLOODLINE_ASPECT_LABELS = Object.freeze({
  force: '力',
  art: '术',
  guard: '守',
  renewal: '复生'
});

type HubPanelProjection = Readonly<{
  actions: readonly ViewActionModel[];
  summary: string;
  objectiveTitle: string;
  objectiveSummary: string;
  entryBuild?: EntryBuildViewModel;
  equipmentCommission?: EquipmentCommissionDetailViewModel;
  equipmentMemory?: EquipmentMemoryLibraryViewModel;
}>;

type CatalogEntry = Readonly<{ id: string; name: string }>;

type PreviewActionOptions = Omit<
  ActionInput,
  'actionId' | 'label' | 'placement' | 'event' | 'enabled' | 'disabledReason'
> & Readonly<{ fallbackDisabledReason?: string }>;

function resourceSpendReadout(before: GameState, after: ReadonlyGameState): string | undefined {
  const parts: string[] = [];
  const rewardPoints = before.rewardPoints - after.rewardPoints;
  const lingyun = before.lingyun - after.lingyun;
  if (rewardPoints > 0) parts.push(`${rewardPoints} 奖励点`);
  if (lingyun > 0) parts.push(`${lingyun} 灵蕴`);
  for (const itemId of Object.keys(before.inventory) as ItemId[]) {
    const amount = before.inventory[itemId] - after.inventory[itemId];
    if (amount > 0) parts.push(`${ITEMS[itemId].name} x${amount}`);
  }
  return parts.length > 0 ? `消耗 ${parts.join('、')}` : undefined;
}

function previewSpendWithAbundantResources(state: GameState, command: GameCommand): string | undefined {
  const inventory = Object.fromEntries(
    (Object.keys(state.inventory) as ItemId[]).map((itemId) => [itemId, 1_000_000])
  ) as GameState['inventory'];
  const abundant: GameState = {
    ...state,
    rewardPoints: 1_000_000_000,
    lingyun: 1_000_000_000,
    inventory
  };
  const preview = reduceGameCommand(abundant, command);
  return preview.status === 'committed'
    ? resourceSpendReadout(abundant, preview.state)
    : undefined;
}

/**
 * Uses the real application reducer as a pure preflight. Domain rejection text
 * remains the single source of truth for disabled actions and the committed
 * before/after delta remains the source of truth for cost readouts.
 */
function previewCommandAction(
  state: GameState,
  actionId: string,
  label: string,
  placement: ViewActionPlacement,
  command: GameCommand,
  options: PreviewActionOptions = {}
): ViewActionModel {
  const { fallbackDisabledReason, ...actionOptions } = options;
  const preview = reduceGameCommand(state, command);
  if (preview.status === 'rejected') {
    const reason = preview.reason.message === 'The command did not produce a domain transition.'
      ? fallbackDisabledReason ?? '当前尚不满足使用条件。'
      : preview.reason.message;
    const spend = previewSpendWithAbundantResources(state, command);
    const readout = [actionOptions.readout, spend].filter(Boolean).join(' · ');
    const visibleReason = spend === undefined
      ? reason
      : `${reason} 所需${spend.replace(/^消耗\s*/, '')}。`;
    return disabledAction(actionId, label, placement, visibleReason, {
      ...actionOptions,
      ...(readout.length > 0 ? { readout } : {})
    });
  }
  const spend = resourceSpendReadout(state, preview.state);
  const readout = [actionOptions.readout, spend].filter(Boolean).join(' · ')
    || `确认后执行：${label}。`;
  return commandAction(actionId, label, placement, command, {
    ...actionOptions,
    ...(readout.length > 0 ? { readout } : {})
  });
}

function selectedCatalogIndex(entries: readonly CatalogEntry[], requestedId: string | undefined): number {
  const requestedIndex = requestedId === undefined
    ? -1
    : entries.findIndex((entry) => entry.id === requestedId);
  return requestedIndex >= 0 ? requestedIndex : 0;
}

function buildCatalogCycleActions(
  panel: HubCatalogPanel,
  entries: readonly CatalogEntry[],
  index: number
): ViewActionModel[] {
  if (entries.length <= 1) {
    return [disabledAction(
      `hub.${panel}.select:only`,
      '仅有当前条目',
      'preparation',
      '当前目录没有其他可选择条目。'
    )];
  }
  const previous = entries[(index - 1 + entries.length) % entries.length]!;
  const next = entries[(index + 1) % entries.length]!;
  return [
    localAction(
      `hub.${panel}.select:previous`,
      `上一项：${previous.name}`,
      'preparation',
      { type: 'hub/select-catalog-entry', panel, entityId: previous.id },
      { readout: `查看${previous.name}的用途与操作；浏览不消耗资源。` }
    ),
    localAction(
      `hub.${panel}.select:next`,
      `下一项：${next.name}`,
      'preparation',
      { type: 'hub/select-catalog-entry', panel, entityId: next.id },
      { readout: `查看${next.name}的用途与操作；浏览不消耗资源。` }
    )
  ];
}

function buildHubNavigation(activePanel: HubPanel): ViewActionModel[] {
  return (Object.keys(HUB_PANEL_LABELS) as HubPanel[]).flatMap((panel) => panel === activePanel
    ? []
    : [localAction(
        `hub.panel:${panel}`,
        `前往${HUB_PANEL_LABELS[panel]}`,
        'preparation',
        { type: 'hub/select-panel', panel },
        { readout: `打开${HUB_PANEL_LABELS[panel]}，查看可用服务；不消耗资源。` }
      )]);
}

function buildEntryPanel(state: GameState, draft: EntryProtocolDraft): HubPanelProjection {
  const dungeon = DUNGEONS[draft.dungeonId] ?? DUNGEONS[FIRST_DUNGEON_ID];
  const entryIssue = getEntryDraftIssue(state, draft);
  const entryBuild = buildEntryBuildProjection(state, draft);
  const actions: ViewActionModel[] = [entryIssue
    ? disabledAction('hub.entry.confirm', '确认入场', 'primary', entryIssue, { emphasis: 'primary' })
    : localAction(
        'hub.entry.confirm',
        '确认入场',
        'primary',
        { type: 'entry/request-enter', draft },
        {
          emphasis: 'primary',
          recommendation: 'recommended',
          readout: '宿主会先生成并持久化显式 seed，再提交唯一一次 run/enter。'
        }
      )];
  const dungeonIndex = Math.max(0, DUNGEON_ORDER.indexOf(draft.dungeonId));
  const previousDungeonId = DUNGEON_ORDER[(dungeonIndex - 1 + DUNGEON_ORDER.length) % DUNGEON_ORDER.length]!;
  const nextDungeonId = DUNGEON_ORDER[(dungeonIndex + 1) % DUNGEON_ORDER.length]!;
  actions.push(
    localAction('hub.entry.dungeon:previous', `上一章：${DUNGEONS[previousDungeonId].name}`, 'preparation', {
      type: 'entry/select-dungeon', dungeonId: previousDungeonId
    }, { readout: '仅更新入场草案；确认入场前不会生成 seed。' }),
    localAction('hub.entry.dungeon:next', `下一章：${DUNGEONS[nextDungeonId].name}`, 'preparation', {
      type: 'entry/select-dungeon', dungeonId: nextDungeonId
    }, { readout: '仅更新入场草案；确认入场前不会生成 seed。' })
  );

  const protocolLabels: Readonly<Record<RunProtocolId, string>> = {
    standard: '标准探索',
    imprint: '烙印协议',
    deep: '炼狱探索'
  };
  for (const protocolId of RUN_PROTOCOL_IDS) {
    const available = isRunProtocolAvailable(draft.dungeonId, protocolId, state.completedDungeonIds);
    actions.push(protocolId === draft.protocolId
      ? disabledAction(
          `hub.entry.protocol:${protocolId}`,
          protocolLabels[protocolId],
          'preparation',
          '当前已选择该入场协议。'
        )
      : available
        ? localAction(`hub.entry.protocol:${protocolId}`, protocolLabels[protocolId], 'preparation', {
            type: 'entry/select-protocol', protocolId
          }, { readout: '仅更新入场草案；确认入场前不会生成 seed。' })
        : disabledAction(
            `hub.entry.protocol:${protocolId}`,
            protocolLabels[protocolId],
            'preparation',
            '需先完成该副本的标准探索。'
          ));
  }

  if (draft.protocolId === 'deep') {
    const unlocked = getInfernoUnlockedTier(state, draft.dungeonId);
    const tier = draft.infernoTier ?? Math.max(1, unlocked);
    actions.push(tier > 1
      ? localAction('hub.entry.inferno-tier:down', '炼狱层级 -1', 'preparation', {
          type: 'entry/set-inferno-tier', infernoTier: tier - 1
        }, { readout: '仅更新入场草案；确认入场前不会生成 seed。' })
      : disabledAction('hub.entry.inferno-tier:down', '炼狱层级 -1', 'preparation', '已经是最低层级。'));
    actions.push(tier < unlocked
      ? localAction('hub.entry.inferno-tier:up', '炼狱层级 +1', 'preparation', {
          type: 'entry/set-inferno-tier', infernoTier: tier + 1
        }, { readout: '仅更新入场草案；确认入场前不会生成 seed。' })
      : disabledAction('hub.entry.inferno-tier:up', '炼狱层级 +1', 'preparation', '尚未解锁更高层级。'));
  }

  actions.push(...entryBuild.actions);
  const relicPreparation = getRunRelicPreparationStatus(state);
  for (const frame of Object.keys(RUN_RELIC_FRAME_DEFINITIONS) as RunRelicFrame[]) {
    if (frame === relicPreparation.preparedRelicFrame) continue;
    const definition = RUN_RELIC_FRAME_DEFINITIONS[frame];
    const conduitMatch = getEquipmentRelicConduitFrameMatch(frame, relicPreparation.activeConduits);
    actions.push(previewCommandAction(
      state,
      `hub.relic-frame:${frame}`,
      `${definition.name}回响`,
      'preparation',
      { type: 'hub/configure-relic', frame },
      {
        readout: `切换框架并清除不相容的归档种子 · 每次候选 ${conduitMatch.matched ? '2 → 3' : '2'} 个`
      }
    ));
  }
  const selectedContract = entryBuild.detail.routeContract.options.find(({ selected }) => selected);
  return {
    actions,
    summary: `${dungeon.name} · ${protocolLabels[draft.protocolId] ?? '未知协议'}${draft.infernoTier ? ` · 第 ${draft.infernoTier} 层` : ''} · ${selectedContract?.name ?? '契约异常'} · ${entryBuild.detail.relic.frameName}回响 / 候选 ${entryBuild.detail.relic.candidateReadout}`,
    objectiveTitle: '整备并确认入场协议',
    objectiveSummary: entryIssue ?? `当前目标：进入${dungeon.name}。确认只产生一次宿主入场请求。`,
    entryBuild: entryBuild.detail
  };
}

/** Expanded entry choices reuse the existing host events without changing the compact action API. */
function buildEntryServices(
  state: GameState,
  draft: EntryProtocolDraft,
  entryBuild: EntryBuildViewModel,
  actions: readonly ViewActionModel[]
): readonly HubEntryServiceViewModel[] {
  const originalAction = (actionId: string): ViewActionModel => {
    const action = actions.find((candidate) => candidate.actionId === actionId);
    if (action === undefined) throw new Error(`Missing entry service action: ${actionId}`);
    return action;
  };
  const dungeonId = DUNGEONS[draft.dungeonId] === undefined ? FIRST_DUNGEON_ID : draft.dungeonId;
  const dungeon = DUNGEONS[dungeonId];
  const gates = getCampaignGates(state);
  const selectedGate = gates.find((gate) => gate.dungeonId === draft.dungeonId);
  const protocolNames: Readonly<Record<RunProtocolId, string>> = {
    standard: '标准探索', imprint: '烙印协议', deep: '炼狱探索'
  };
  const services: HubEntryServiceViewModel[] = [
    {
      id: 'dungeon',
      name: '挑战副本',
      summary: `${dungeon.name}${selectedGate?.status === 'locked' ? ' · 未解锁' : ''}`,
      description: '选择本次挑战的副本。未解锁的副本可查看要求，满足条件后才能入场。',
      options: gates.map((gate) => {
        const selected = gate.dungeonId === draft.dungeonId;
        const status = gate.status === 'locked' ? '未解锁' : gate.status === 'completed' ? '已通关' : '已解锁';
        const description = `${status} · ${gate.requirementText}`;
        return {
          id: gate.dungeonId,
          name: gate.dungeonName,
          description,
          selected,
          action: selected
            ? disabledAction(`hub.entry.dungeon:select:${gate.dungeonId}`, gate.dungeonName, 'preparation', '当前已选择该副本。')
            : localAction(`hub.entry.dungeon:select:${gate.dungeonId}`, gate.dungeonName, 'preparation', {
                type: 'entry/select-dungeon', dungeonId: gate.dungeonId
              }, { readout: description })
        };
      })
    },
    {
      id: 'protocol',
      name: '探索协议',
      summary: protocolNames[draft.protocolId] ?? '未知协议',
      description: '选择普通探索，或在通关后挑战本章的特殊目标。',
      options: RUN_PROTOCOL_IDS.map((protocolId) => ({
        id: protocolId,
        name: protocolNames[protocolId],
        description: getRunProtocolDefinition(dungeonId, protocolId)!.description,
        selected: protocolId === draft.protocolId,
        action: originalAction(`hub.entry.protocol:${protocolId}`)
      }))
    }
  ];
  if (draft.protocolId === 'deep') {
    const unlocked = getInfernoUnlockedTier(state, draft.dungeonId);
    const tier = draft.infernoTier ?? Math.max(1, unlocked);
    services.push({
      id: 'inferno-tier',
      name: '炼狱层级',
      summary: `第 ${tier} 层 · 已解锁至 ${unlocked} 层`,
      description: '逐层挑战炼狱；完成当前最高层后可解锁更高一层。',
      options: (['down', 'up'] as const).map((direction) => {
        const action = originalAction(`hub.entry.inferno-tier:${direction}`);
        return {
          id: direction,
          name: direction === 'down' ? '降低一层' : '提高一层',
          description: action.enabled
            ? `调整至第 ${tier + (direction === 'down' ? -1 : 1)} 层。`
            : action.disabledReason!,
          selected: false,
          action
        };
      })
    });
  }
  const selectedRoute = entryBuild.routeContract.options.find((option) => option.selected);
  const routeCycle = originalAction('hub.entry.route-contract:next');
  services.push({
    id: 'route-contract',
    name: '路线契约',
    summary: entryBuild.routeContract.selectionValid ? selectedRoute!.name : '契约异常 · 重新选择',
    description: entryBuild.routeContract.issue ?? '本章通关后可接取路线契约，按顺序完成两个目标，获得额外奖励。',
    options: entryBuild.routeContract.options.map((option) => {
      const description = [
        option.description,
        ...option.orderedTargets.map((target) => `目标 ${target.order}：${target.nodeTitle}`),
        ...(option.rewardPoints > 0 ? [`独立奖励 ${option.rewardPoints} 奖励点`] : [])
      ].join(' · ');
      const actionId = `hub.entry.route-contract:select:${option.routeContractId ?? 'none'}`;
      const cycleMatches = routeCycle.event?.kind === 'local'
        && routeCycle.event.action.type === 'entry/select-route-contract'
        && routeCycle.event.action.routeContractId === option.routeContractId;
      return {
        id: option.routeContractId ?? 'none',
        name: option.name,
        description,
        selected: option.selected,
        action: !option.selectable
          ? disabledAction(actionId, option.name, 'preparation', option.disabledReason!)
          : cycleMatches ? routeCycle
            : localAction(actionId, option.name, 'preparation', {
                type: 'entry/select-route-contract', routeContractId: option.routeContractId
              }, { readout: description })
      };
    })
  });
  const preparation = getRunRelicPreparationStatus(state);
  const frameDescriptions: Readonly<Record<RunRelicFrame, string>> = {
    assault: '偏向攻击与战斗收益的回响。',
    bulwark: '偏向防御与恢复的回响。',
    wayfinder: '偏向探索与路线应对的回响。'
  };
  services.push({
    id: 'relic-frame',
    name: '遗物回响',
    summary: `${entryBuild.relic.frameName} · 每次 ${entryBuild.relic.candidateReadout} 个候选`,
    description: '选择本局回响的方向。切换方向会清除不相容的归档种子。',
    options: (Object.keys(RUN_RELIC_FRAME_DEFINITIONS) as RunRelicFrame[]).map((frame) => {
      const selected = frame === entryBuild.relic.frame;
      const conduit = getEquipmentRelicConduitFrameMatch(frame, preparation.activeConduits);
      return {
        id: frame,
        name: `${RUN_RELIC_FRAME_DEFINITIONS[frame].name}回响`,
        description: `${frameDescriptions[frame]}每次提供 ${conduit.matched ? '3' : '2'} 个候选。`,
        selected,
        action: selected
          ? disabledAction(`hub.relic-frame:${frame}`, `${RUN_RELIC_FRAME_DEFINITIONS[frame].name}回响`, 'preparation', '当前已选择该回响方向。')
          : originalAction(`hub.relic-frame:${frame}`)
      };
    })
  });
  const selectedSeed = entryBuild.relic.seedOptions.find((option) => option.selected);
  const seedCycle = originalAction('hub.entry.relic-seed:next');
  services.push({
    id: 'relic-seed',
    name: '归档种子',
    summary: selectedSeed!.name,
    description: `从已归档的${entryBuild.relic.frameName}回响中选择种子，使它出现在本局首轮候选中。`,
    options: entryBuild.relic.seedOptions.map((option) => {
      const actionId = `hub.entry.relic-seed:select:${option.seedRelicId ?? 'none'}`;
      const cycleMatches = seedCycle.event?.kind === 'local'
        && seedCycle.event.action.type === 'entry/select-relic-seed'
        && seedCycle.event.action.seedRelicId === option.seedRelicId;
      return {
        id: option.seedRelicId ?? 'none',
        name: option.name,
        description: option.description,
        selected: option.selected,
        action: !option.selectable
          ? disabledAction(actionId, option.name, 'preparation', option.disabledReason!)
          : cycleMatches ? seedCycle
            : localAction(actionId, option.name, 'preparation', {
                type: 'entry/select-relic-seed', frame: entryBuild.relic.frame, seedRelicId: option.seedRelicId
              }, { readout: option.description })
      };
    })
  });
  return services;
}

function buildSuppliesPanel(state: GameState, requestedId: string | undefined): HubPanelProjection {
  const entries = TACTICAL_ITEM_IDS.map((id) => ({ id, name: ITEMS[id].name }));
  const index = selectedCatalogIndex(entries, requestedId);
  const itemId = entries[index]!.id as ItemId;
  const item = ITEMS[itemId];
  const isSupply = isFieldSupplyItemId(itemId);
  const loadout = getTacticalLoadoutStatus(state);
  const carried = !isSupply
    && loadout.preparedItemIds.includes(itemId as typeof loadout.preparedItemIds[number]);
  const nextItemIds = carried
    ? loadout.preparedItemIds.filter((candidate) => candidate !== itemId)
    : [...loadout.preparedItemIds, itemId];
  const actions = [
    ...buildCatalogCycleActions('supplies', entries, index),
    previewCommandAction(
      state,
      `hub.supplies.buy:${itemId}`,
      `兑换${item.name}`,
      'primary',
      { type: 'hub/buy-item', itemId },
      { readout: `获得 1 个并放入背包。${item.description} ${isSupply ? '无需装入携行。' : '带入副本前还需装入携行。'}当前库存 ${state.inventory[itemId]}。` }
    ),
    // 补给品不占携行槽，不生成装入/移出携行动作。
    ...(isSupply
      ? []
      : [
          previewCommandAction(
            state,
            `hub.supplies.toggle:${itemId}`,
            `${carried ? '移出' : '装入'}携行：${item.name}`,
            'primary',
            { type: 'hub/configure-tactical-loadout', itemIds: nextItemIds },
            {
              recommendation: carried ? 'neutral' : 'recommended',
              readout: `${carried ? '下次入场不再携带此道具，背包库存保留。' : '下次入场带上此类道具；只配置携行，不会购买，使用仍需库存。'}当前携行 ${loadout.preparedItemIds.length} 类；库存 ${state.inventory[itemId]}。`
            }
          ),
        ]),
    previewCommandAction(
      state,
      'hub.loadout.current',
      '确认当前携行',
      'preparation',
      { type: 'hub/configure-tactical-loadout', itemIds: [...loadout.preparedItemIds] },
      { readout: `下次入场沿用当前 ${loadout.preparedItemIds.length} 类特殊道具；不购买、不消耗库存。` }
    ),
    previewCommandAction(
      state,
      'hub.loadout.chapter-one',
      '首章生存携行',
      'preparation',
      { type: 'hub/configure-tactical-loadout', itemIds: ['thunder_talisman', 'dispel_talisman', 'gate_sigil'] },
      { recommendation: 'recommended', readout: '将携行列表替换为雷火符、破禁符、小界门符，分别用于伤敌、破陷阱、稳传送门；不会自动购买。' }
    ),
    previewCommandAction(state, 'hub.recover', '恢复生命', 'preparation', { type: 'hub/recover' }, {
      readout: `免费将生命补满，立即生效。当前生命 ${state.player.hp}/${getDerivedStats(state).maxHp}。`
    })
  ];
  return {
    actions,
    summary: isSupply
      ? `${item.name} · 库存 ${state.inventory[itemId]} · 补给品 · 无需携行`
      : `${item.name} · 库存 ${state.inventory[itemId]} · ${carried ? '已携行' : '未携行'}`,
    objectiveTitle: isSupply ? '兑换副本中使用的补给品' : '先兑换道具，再选择带入副本的种类',
    objectiveSummary: isSupply
      ? `${item.description} 补给品不占携行槽，副本内库存有即可用。`
      : `${item.description} 兑换增加库存，装入携行决定下次入场带什么；使用时仍需库存。`
  };
}

type EquipmentRecipeStatus = NonNullable<ReturnType<typeof getEquipmentRecipePurchaseStatus>>;

function listEquipmentRecipeStatuses(
  state: GameState,
  equipmentId: EquipmentId
): EquipmentRecipeStatus[] {
  return DUNGEON_ORDER.flatMap((dungeonId) => {
    const status = getEquipmentRecipePurchaseStatus(state, dungeonId, equipmentId);
    return status === undefined ? [] : [status];
  });
}

function equipmentRecipeReadout(state: GameState, status: EquipmentRecipeStatus): string {
  const held = state.inventory[status.materialId] ?? 0;
  const gap = Math.max(0, status.materialAmount - held);
  return `${DUNGEONS[status.dungeonId].name}目录 · 成本 ${ITEMS[status.materialId].name} x${status.materialAmount} · 持有 ${held} · 缺口 ${gap}`;
}

function buildEquipmentPurchaseAction(
  state: GameState,
  equipmentId: EquipmentId
): ViewActionModel {
  const equipment = EQUIPMENT[equipmentId];
  const statuses = listEquipmentRecipeStatuses(state, equipmentId);
  const unlocked = statuses.filter(({ unlocked: isUnlocked }) => isUnlocked);
  // Match Web: the first payable unlocked recipe wins, otherwise the first unlocked recipe.
  const preferred = unlocked.find(({ affordable }) => affordable) ?? unlocked[0];
  if (preferred !== undefined) {
    return previewCommandAction(
      state,
      `hub.equipment.buy:${equipmentId}`,
      `兑换${equipment.name}`,
      'primary',
      {
        type: 'hub/buy-equipment',
        equipmentId,
        sourceDungeonId: preferred.dungeonId
      },
      {
        readout: `获得装备并放入装备架，还需点击「装备」才生效。${equipment.description} · ${equipmentRecipeReadout(state, preferred)}`,
        fallbackDisabledReason: `资源不足，无法按${DUNGEONS[preferred.dungeonId].name}章节配方兑换${equipment.name}。`
      }
    );
  }
  const firstRecipe = statuses[0];
  if (firstRecipe === undefined) {
    return disabledAction(
      `hub.equipment.buy:${equipmentId}`,
      `兑换${equipment.name}`,
      'primary',
      `${equipment.name}不在任何章节兑换目录中，不能按普通奖励点价格回退购买。`,
      { readout: `获得后需装备到角色身上才生效。${equipment.description}` }
    );
  }
  const sourceNames = statuses.map(({ dungeonId }) => DUNGEONS[dungeonId].name).join('、');
  return disabledAction(
    `hub.equipment.buy:${equipmentId}`,
    `兑换${equipment.name}`,
    'primary',
    `首次通关${sourceNames}中的任一来源副本后，才会解锁${equipment.name}的章节兑换。`,
    {
      readout: `兑换后放入装备架，还需点击「装备」。${equipment.description} · 来源 ${sourceNames} · ${equipmentRecipeReadout(state, firstRecipe)}`
    }
  );
}

function normalizeEquipmentCommissionDraft(
  state: GameState,
  rawDraft: EquipmentCommissionDraft | undefined
): EquipmentCommissionDraft {
  if (getEquipmentCommissionStatus(state).active) {
    return { equipmentIds: [], targetMaterialId: null };
  }
  const candidates = getEquipmentCommissionStatus(state).candidates;
  const candidateIds = new Set(candidates.map(({ equipmentId }) => equipmentId));
  const equipmentIds = Array.from(new Set(rawDraft?.equipmentIds ?? []))
    .filter((equipmentId): equipmentId is EquipmentId => candidateIds.has(equipmentId))
    .slice(0, 2) as unknown as EquipmentCommissionDraftEquipmentIds;
  const candidateById = new Map(candidates.map((candidate) => [candidate.equipmentId, candidate]));
  const validMaterialIds = Array.from(new Set(equipmentIds.flatMap((equipmentId) => {
    const candidate = candidateById.get(equipmentId);
    return candidate ? [candidate.materialId] : [];
  })));
  const requestedMaterialId = rawDraft?.targetMaterialId ?? null;
  return {
    equipmentIds,
    targetMaterialId: requestedMaterialId !== null && validMaterialIds.includes(requestedMaterialId)
      ? requestedMaterialId
      : null
  };
}

function buildEquipmentCommissionProjection(
  state: GameState,
  focusedEquipmentId: EquipmentId,
  rawDraft: EquipmentCommissionDraft | undefined
): Readonly<{
  actions: readonly ViewActionModel[];
  detail: EquipmentCommissionDetailViewModel;
}> {
  const commissionStatus = getEquipmentCommissionStatus(state);
  const draft = normalizeEquipmentCommissionDraft(state, rawDraft);
  const active = commissionStatus.active;
  const candidateById = new Map(
    commissionStatus.candidates.map((candidate) => [candidate.equipmentId, candidate])
  );
  const activeEquipmentIds = new Set(active?.equipmentIds ?? []);
  const selectedEquipmentIds = new Set(active ? active.equipmentIds : draft.equipmentIds);
  const candidates = commissionStatus.candidates.map((candidate) => ({
    equipmentId: candidate.equipmentId,
    name: EQUIPMENT[candidate.equipmentId].name,
    slotLabel: EQUIPMENT_SLOT_LABELS[EQUIPMENT[candidate.equipmentId].slot],
    materialId: candidate.materialId,
    materialName: ITEMS[candidate.materialId].name,
    selected: selectedEquipmentIds.has(candidate.equipmentId)
  }));
  const selectedCandidateMaterialIds = active
    ? [active.targetMaterialId]
    : draft.equipmentIds.flatMap((equipmentId) => {
        const candidate = candidateById.get(equipmentId);
        return candidate ? [candidate.materialId] : [];
      });
  const materialOptions = Array.from(new Set(selectedCandidateMaterialIds)).map((materialId) => ({
    materialId,
    materialName: ITEMS[materialId].name,
    selected: (active?.targetMaterialId ?? draft.targetMaterialId) === materialId
  }));
  const rewardPointsRequired = commissionStatus.cost.rewardPoints ?? 0;
  const lingyunRequired = commissionStatus.cost.lingyun ?? 0;
  const cost = [
    {
      resource: 'rewardPoints' as const,
      label: '奖励点',
      required: rewardPointsRequired,
      held: state.rewardPoints,
      gap: Math.max(0, rewardPointsRequired - state.rewardPoints)
    },
    {
      resource: 'lingyun' as const,
      label: '灵蕴',
      required: lingyunRequired,
      held: state.lingyun,
      gap: Math.max(0, lingyunRequired - state.lingyun)
    }
  ];
  const canAfford = cost.every(({ gap }) => gap === 0);
  const focusedCandidate = candidateById.get(focusedEquipmentId);
  const focusedSelected = selectedEquipmentIds.has(focusedEquipmentId);
  const actions: ViewActionModel[] = [];
  let startAction: ViewActionModel | undefined;

  if (active) {
    const completedCount = active.completedDungeonIds.length;
    actions.push(previewCommandAction(
      state,
      'hub.equipment.commission.recall',
      '撤回装备封存委托',
      'preparation',
      { type: 'hub/recall-equipment-commission' },
      {
        emphasis: 'danger',
        recommendation: 'high-risk',
        riskReason: `撤回不返还启动消耗，并会丢失 ${completedCount}/${commissionStatus.requiredDungeonCount} 个不同副本进度。`,
        readout: `立即解除两件装备的封存。不返还 ${rewardPointsRequired} 奖励点与 ${lingyunRequired} 灵蕴；已完成进度全部清空。`
      }
    ));
  } else {
    const nextEquipmentIds = focusedSelected
      ? draft.equipmentIds.filter((equipmentId) => equipmentId !== focusedEquipmentId)
      : [...draft.equipmentIds, focusedEquipmentId];
    const normalizedNextEquipmentIds = nextEquipmentIds.slice(0, 2) as unknown as EquipmentCommissionDraftEquipmentIds;
    const nextMaterialIds = normalizedNextEquipmentIds.flatMap((equipmentId) => {
      const candidate = candidateById.get(equipmentId);
      return candidate ? [candidate.materialId] : [];
    });
    const nextTargetMaterialId = draft.targetMaterialId !== null
      && nextMaterialIds.includes(draft.targetMaterialId)
      ? draft.targetMaterialId
      : null;
    if (!focusedCandidate) {
      actions.push(disabledAction(
        `hub.equipment.commission.toggle:${focusedEquipmentId}`,
        `封存选择：${EQUIPMENT[focusedEquipmentId].name}`,
        'preparation',
        '需先拥有这件装备，将其升至满级，并确认可淬炼且当前未装备。',
        { readout: '选择两件满级、可淬炼且未装备的装备，暂时封存，通关后换取淬炼材料。' }
      ));
    } else if (!focusedSelected && draft.equipmentIds.length >= 2) {
      actions.push(disabledAction(
        `hub.equipment.commission.toggle:${focusedEquipmentId}`,
        `封存选择：${EQUIPMENT[focusedEquipmentId].name}`,
        'preparation',
        '已经选择两件不同装备；请先取消其中一件。',
        { readout: '调整准备封存的装备；点击「启动」前不会封存或消耗资源。' }
      ));
    } else {
      actions.push(localAction(
        `hub.equipment.commission.toggle:${focusedEquipmentId}`,
        focusedSelected
          ? `取消封存选择：${EQUIPMENT[focusedEquipmentId].name}`
          : `加入封存委托：${EQUIPMENT[focusedEquipmentId].name}`,
        'preparation',
        {
          type: 'hub/set-equipment-commission-draft',
          draft: {
            equipmentIds: normalizedNextEquipmentIds,
            targetMaterialId: nextTargetMaterialId
          }
        },
        { readout: '选择准备封存的装备；点击「启动」前仍可改选，不会封存或消耗资源。' }
      ));
    }

    if (materialOptions.length === 0) {
      actions.push(disabledAction(
        'hub.equipment.commission.material',
        '选择目标淬炼材料',
        'preparation',
        '先选择至少一件合格装备，才能选择其淬炼材料。',
        { readout: '选择委托完成后领取哪种淬炼材料，用于强化满级装备。' }
      ));
    } else if (materialOptions.length === 1 && materialOptions[0]!.selected) {
      actions.push(disabledAction(
        'hub.equipment.commission.material',
        `目标材料：${materialOptions[0]!.materialName}`,
        'preparation',
        '所选装备当前只有这一种可用目标材料。',
        { readout: `完成委托后获得${materialOptions[0]!.materialName} x${commissionStatus.materialReward}，用于淬炼装备。` }
      ));
    } else {
      const selectedIndex = materialOptions.findIndex(({ selected }) => selected);
      const nextMaterial = materialOptions[(selectedIndex + 1) % materialOptions.length]!;
      actions.push(localAction(
        'hub.equipment.commission.material',
        `选择目标材料：${nextMaterial.materialName}`,
        'preparation',
        {
          type: 'hub/set-equipment-commission-draft',
          draft: { equipmentIds: draft.equipmentIds, targetMaterialId: nextMaterial.materialId }
        },
        { readout: `${nextMaterial.materialName} x${commissionStatus.materialReward}将在委托完成后直接存入永久背包。` }
      ));
    }

    if (draft.equipmentIds.length !== 2) {
      startAction = disabledAction(
        'hub.equipment.commission.start',
        '启动装备封存委托',
        'primary',
        `请选择两件不同的合格装备（当前 ${draft.equipmentIds.length}/2）。`,
        { emphasis: 'primary', readout: `暂时封存两件装备，成功走出 ${commissionStatus.requiredDungeonCount} 个不同副本后解除封存，并获得所选淬炼材料。` }
      );
    } else if (draft.targetMaterialId === null) {
      startAction = disabledAction(
        'hub.equipment.commission.start',
        '启动装备封存委托',
        'primary',
        '请选择来自所选装备的目标淬炼材料。',
        { emphasis: 'primary', readout: `暂时封存两件装备，成功走出 ${commissionStatus.requiredDungeonCount} 个不同副本后解除封存，并获得所选淬炼材料。` }
      );
    } else {
      startAction = previewCommandAction(
        state,
        'hub.equipment.commission.start',
        '启动装备封存委托',
        'primary',
        {
          type: 'hub/start-equipment-commission',
          equipmentIds: draft.equipmentIds,
          targetMaterialId: draft.targetMaterialId
        },
        {
          emphasis: 'primary',
          recommendation: 'recommended',
          readout: `封存两件装备，期间不能使用或强化；成功走出 ${commissionStatus.requiredDungeonCount} 个不同副本后解除封存，并获得${ITEMS[draft.targetMaterialId].name} x${commissionStatus.materialReward}。`,
          fallbackDisabledReason: '请检查所选装备与目标材料是否满足委托条件。'
        }
      );
    }
    actions.push(startAction);
  }

  const activeDetail = active ? {
    equipmentIds: [active.equipmentIds[0], active.equipmentIds[1]] as const,
    equipmentNames: [
      EQUIPMENT[active.equipmentIds[0]].name,
      EQUIPMENT[active.equipmentIds[1]].name
    ] as const,
    targetMaterialId: active.targetMaterialId,
    targetMaterialName: ITEMS[active.targetMaterialId].name,
    completedDungeonIds: [...active.completedDungeonIds],
    completedDungeonNames: active.completedDungeonIds.map((dungeonId) => DUNGEONS[dungeonId].name),
    completedCount: active.completedDungeonIds.length,
    remainingCount: Math.max(0, commissionStatus.requiredDungeonCount - active.completedDungeonIds.length),
    recallLossReadout: `召回不退款，并丢失 ${active.completedDungeonIds.length}/${commissionStatus.requiredDungeonCount} 个不同副本进度。`
  } : undefined;
  const detail: EquipmentCommissionDetailViewModel = {
    helpId: 'equipmentCommission',
    status: active
      ? 'active'
      : draft.equipmentIds.length === 0 && draft.targetMaterialId === null
        ? 'idle'
        : 'draft',
    draft,
    requiredEquipmentCount: 2,
    requiredDungeonCount: commissionStatus.requiredDungeonCount,
    materialReward: commissionStatus.materialReward,
    cost,
    canAfford,
    candidates,
    focusedEquipment: {
      equipmentId: focusedEquipmentId,
      name: EQUIPMENT[focusedEquipmentId].name,
      eligible: focusedCandidate !== undefined,
      selected: focusedSelected,
      ...(!focusedCandidate
        ? { disabledReason: '需先拥有这件装备，将其升至满级，并确认可淬炼且当前未装备。' }
        : active && !activeEquipmentIds.has(focusedEquipmentId)
          ? { disabledReason: '已有装备封存委托进行中，不能改选装备。' }
          : {})
    },
    materialOptions,
    ...(startAction
      ? {
          start: {
            enabled: startAction.enabled,
            ...(!startAction.enabled && startAction.disabledReason
              ? { disabledReason: startAction.disabledReason }
              : {})
          }
        }
      : {}),
    ...(activeDetail ? { active: activeDetail } : {})
  };
  return { actions, detail };
}

function buildEquipmentMemoryLibraryProjection(
  state: GameState,
  equipmentId: EquipmentId
): Readonly<{
  action: ViewActionModel;
  detail: EquipmentMemoryLibraryViewModel;
}> {
  const status = getEquipmentMemoryStatus(state, equipmentId);
  const activeMemoryId = status.activeMemory?.id;
  const unlockedMemories = status.unlockedMemories.map((memory) => ({
    memoryId: memory.id,
    name: memory.name,
    dungeonId: memory.dungeonId,
    dungeonName: DUNGEONS[memory.dungeonId].name,
    description: memory.description,
    effectDescription: memory.effectDescription,
    active: memory.id === activeMemoryId
  }));
  const activeMemory = unlockedMemories.find(({ active }) => active);
  const activeIndex = status.unlockedMemories.findIndex(({ id }) => id === activeMemoryId);
  const nextMemory = status.unlockedMemories.length === 0
    ? undefined
    : status.unlockedMemories[
        activeIndex < 0 ? 0 : (activeIndex + 1) % status.unlockedMemories.length
      ];
  let action: ViewActionModel;
  if (!status.supported) {
    action = disabledAction(
      'hub.equipment.memory.cycle',
      '装备记忆：不支持',
      'preparation',
      '这件装备不支持装备记忆。',
      { readout: '装备记忆为成熟装备提供额外能力；支持记忆的装备可在通关后收录。' }
    );
  } else if (!status.owned) {
    action = disabledAction(
      'hub.equipment.memory.cycle',
      '装备记忆：尚未拥有',
      'preparation',
      `你还没有${status.equipment.name}，不能切换其装备记忆。`,
      { readout: '选择一段已收录记忆，装备后在下次副本中获得该能力。' }
    );
  } else if (!nextMemory) {
    action = disabledAction(
      'hub.equipment.memory.cycle',
      '装备记忆：尚未收录',
      'preparation',
      '当前装备尚未收录任何记忆；可通过附近的 ? 查看收录条件。',
      { readout: '穿戴满级、已铭刻且淬炼 II 的装备，成功走到副本出口后可收录本章记忆。' }
    );
  } else if (status.unlockedMemories.length === 1 && nextMemory.id === activeMemoryId) {
    action = disabledAction(
      'hub.equipment.memory.cycle',
      `装备记忆：${nextMemory.name}`,
      'preparation',
      `${status.equipment.name}当前只收录并已激活这一段记忆。`,
      { readout: `装备后在下次副本获得该能力。${nextMemory.effectDescription}` }
    );
  } else {
    action = previewCommandAction(
      state,
      'hub.equipment.memory.cycle',
      `激活装备记忆：${nextMemory.name}`,
      'preparation',
      {
        type: 'hub/activate-equipment-memory',
        equipmentId,
        memoryId: nextMemory.id
      },
      {
        recommendation: activeMemoryId === undefined ? 'recommended' : 'neutral',
        readout: `换用这段记忆，装备后在下次副本生效。${DUNGEONS[nextMemory.dungeonId].name} · ${nextMemory.effectDescription}`,
        fallbackDisabledReason: '当前无法启用这段记忆，请检查装备是否已拥有且记忆已收录。'
      }
    );
  }
  const acquisitionReadout = !status.supported
    ? '当前装备不承载装备记忆。'
    : status.unlockedMemories.length === 0
      ? '装备达到满级、完成铭刻与淬炼 II 后，穿戴它成功走到副本出口，即可自动收录并启用本章记忆；无需另接记忆狩猎任务。'
      : `已收录 ${status.unlockedMemories.length} 段；当前${activeMemory ? `激活「${activeMemory.name}」` : '未激活'}。`;
  return {
    action,
    detail: {
      helpId: 'equipmentMemory',
      equipmentId,
      equipmentName: status.equipment.name,
      supported: status.supported,
      owned: status.owned,
      equipped: status.equipped,
      unlocked: unlockedMemories.length > 0,
      active: activeMemory !== undefined,
      unlockedCount: unlockedMemories.length,
      unlockedMemories,
      ...(activeMemory ? { activeMemory } : {}),
      cycle: {
        enabled: action.enabled,
        ...(action.enabled && nextMemory
          ? { nextMemoryId: nextMemory.id, nextMemoryName: nextMemory.name }
          : {}),
        ...(!action.enabled && action.disabledReason
          ? { disabledReason: action.disabledReason }
          : {})
      },
      acquisitionReadout
    }
  };
}

function buildEquipmentPanel(
  state: GameState,
  requestedId: string | undefined,
  commissionDraft: EquipmentCommissionDraft | undefined
): HubPanelProjection {
  const entries = Object.values(EQUIPMENT).map(({ id, name }) => ({ id, name }));
  const defaultId = entries.some(({ id }) => id === 'armor_piercing_sword') ? 'armor_piercing_sword' : entries[0]?.id;
  const index = selectedCatalogIndex(entries, requestedId ?? defaultId);
  const equipmentId = entries[index]!.id as EquipmentId;
  const equipment = EQUIPMENT[equipmentId];
  const owned = state.ownedEquipment.includes(equipmentId);
  const level = state.equipmentLevels[equipmentId] ?? 1;
  const equipped = state.equipped[equipment.slot] === equipmentId;
  const attunementId = state.equipmentAttunements?.[equipmentId];
  const temper = getEquipmentTemperStatus(state, equipmentId);
  const actions: ViewActionModel[] = [
    ...buildCatalogCycleActions('equipment', entries, index),
    owned
      ? disabledAction(`hub.equipment.buy:${equipmentId}`, `兑换${equipment.name}`, 'primary', `装备架已经拥有${equipment.name}。`, { readout: `兑换后放入装备架，装备到角色身上才生效。${equipment.description}` })
      : buildEquipmentPurchaseAction(state, equipmentId),
    equipped
      ? disabledAction(`hub.equipment.equip:${equipmentId}`, `装备${equipment.name}`, 'primary', `${equipment.name}已经装备在${EQUIPMENT_SLOT_LABELS[equipment.slot]}槽位。`, { readout: `穿戴到${EQUIPMENT_SLOT_LABELS[equipment.slot]}，装备属性立即生效；同部位只能装备一件。` })
      : previewCommandAction(
          state,
          `hub.equipment.equip:${equipmentId}`,
          `装备${equipment.name}`,
          'primary',
          { type: 'hub/equip-equipment', equipmentId },
          { recommendation: 'recommended', readout: `替换当前${EQUIPMENT_SLOT_LABELS[equipment.slot]}装备，属性立即生效；换下的装备保留在装备架。` }
        ),
    previewCommandAction(
      state,
      `hub.equipment.upgrade:${equipmentId}`,
      `升级${equipment.name}`,
      'primary',
      { type: 'hub/upgrade-equipment', equipmentId },
      {
        readout: `永久提高这件装备的等级和属性，穿戴时生效。当前等级 ${level}/${equipment.maxLevel}。`,
        fallbackDisabledReason: owned ? `${equipment.name}当前无法继续升级。` : `你还没有${equipment.name}。`
      }
    )
  ];
  const attunements = getEquipmentAttunementOptions(equipmentId);
  if (attunements.length === 0) {
    actions.push(disabledAction(
      `hub.equipment.attune:${equipmentId}:none`,
      `${equipment.name}铭刻`,
      'preparation',
      '该装备没有可用的铭刻分支。',
      { readout: '为满级装备选择一种额外属性；只有支持铭刻的装备可用。' }
    ));
  } else {
    for (const attunement of attunements) {
      actions.push(attunementId === attunement.id
        ? disabledAction(
            `hub.equipment.attune:${equipmentId}:${attunement.id}`,
            `铭刻：${attunement.name}`,
            'preparation',
            `${equipment.name}已经生效${attunement.name}。`,
            { readout: `为满级装备选择额外属性，穿戴时生效。${attunement.description}` }
          )
        : previewCommandAction(
            state,
            `hub.equipment.attune:${equipmentId}:${attunement.id}`,
            `铭刻：${attunement.name}`,
            'preparation',
            { type: 'hub/attune-equipment', equipmentId, attunementId: attunement.id },
            { readout: `为满级装备选择额外属性，穿戴时生效；改选会替换原铭刻并重新消耗资源。${attunement.description}` }
          ));
    }
  }
  actions.push(previewCommandAction(
    state,
    `hub.equipment.temper:${equipmentId}`,
    `淬炼${equipment.name}`,
    'preparation',
    { type: 'hub/temper-equipment', equipmentId },
    { readout: `进一步提高满级装备的属性，穿戴时生效；淬炼 II 还需先完成铭刻。当前淬炼 ${temper.currentRank}/${temper.maxRank}。` }
  ));
  const commission = buildEquipmentCommissionProjection(state, equipmentId, commissionDraft);
  actions.push(...commission.actions);
  const memory = buildEquipmentMemoryLibraryProjection(state, equipmentId);
  actions.push(memory.action);
  return {
    actions,
    summary: `${equipment.name} · ${EQUIPMENT_SLOT_LABELS[equipment.slot]} · ${owned ? `等级 ${level}/${equipment.maxLevel}` : '未拥有'} · ${equipped ? '已装备' : '未装备'} · 委托${commission.detail.status === 'active' ? `进行中 ${commission.detail.active?.completedCount ?? 0}/${commission.detail.requiredDungeonCount}` : commission.detail.status === 'draft' ? '草稿' : '待配置'}`,
    objectiveTitle: '先获得并穿戴装备，再逐步强化',
    objectiveSummary: `${equipment.description} 兑换后需手动装备；升级提高属性，满级后可铭刻或淬炼。${attunementId ? `当前铭刻：${getEquipmentAttunementOptions(equipmentId).find(({ id }) => id === attunementId)?.name ?? '存档分支异常'}。` : ''}`,
    equipmentCommission: commission.detail,
    equipmentMemory: memory.detail
  };
}

function buildPetsPanel(state: GameState, requestedId: string | undefined): HubPanelProjection {
  const entries = Object.values(PETS).map(({ id, name }) => ({ id, name }));
  const index = selectedCatalogIndex(entries, requestedId);
  const petId = entries[index]!.id as keyof typeof PETS;
  const pet = PETS[petId];
  const owned = state.ownedPets.includes(petId);
  const level = state.petLevels[petId] ?? 1;
  const acquireReadout = `获得这只灵宠。${state.activePet === undefined ? '当前没有出战灵宠，签约后会自动出战。' : '签约后可手动设为出战灵宠。'}${pet.description}`;
  const activateReadout = '换用这只灵宠，属性加成立即生效，探索与战斗可发挥它的特性；每次只能出战一只。';
  const actions = [
    ...buildCatalogCycleActions('pets', entries, index),
    owned
      ? disabledAction(`hub.pets.buy:${petId}`, `签约${pet.name}`, 'primary', `你已经拥有${pet.name}。`, { readout: `拥有后可培养，并设为出战灵宠。${pet.description}` })
      : previewCommandAction(state, `hub.pets.buy:${petId}`, `签约${pet.name}`, 'primary', { type: 'hub/buy-pet', petId }, { readout: acquireReadout }),
    previewCommandAction(
      state,
      `hub.pets.upgrade:${petId}`,
      `培养${pet.name}`,
      'primary',
      { type: 'hub/upgrade-pet', petId },
      {
        readout: `永久提高灵宠等级，增强它的属性加成；出战时生效。当前等级 ${level}/${pet.maxLevel}。`,
        fallbackDisabledReason: owned ? `${pet.name}当前无法继续培养。` : `你还没有${pet.name}。`
      }
    ),
    state.activePet === petId
      ? disabledAction(`hub.pets.activate:${petId}`, `设为出战灵宠：${pet.name}`, 'primary', `${pet.name}已经在出战位。`, { readout: activateReadout })
      : previewCommandAction(
          state,
          `hub.pets.activate:${petId}`,
          `设为出战灵宠：${pet.name}`,
          'primary',
          { type: 'hub/activate-pet', petId },
          { recommendation: 'recommended', readout: activateReadout }
        )
  ];
  return {
    actions,
    summary: `${pet.name} · ${owned ? `${level}/${pet.maxLevel} 级` : pet.source === 'shop' ? '可签约' : '副本捕获'} · ${state.activePet === petId ? '出战中' : '未出战'}`,
    objectiveTitle: '获得灵宠，选一只出战助你探索和战斗',
    objectiveSummary: `${pet.description} 只有出战灵宠提供加成，培养可永久提高它的等级。`
  };
}

function buildMethodsPanel(state: GameState, requestedId: string | undefined): HubPanelProjection {
  const entries = METHOD_TECHNIQUE_CATALOG.map(({ methodId }) => ({ id: methodId, name: METHODS[methodId].name }));
  const index = selectedCatalogIndex(entries, requestedId);
  const methodId = entries[index]!.id as keyof typeof METHODS;
  const method = METHODS[methodId];
  const progress = getMethodCultivationProgress(state);
  const upgrade = getMethodUpgradeStatus(methodId, progress);
  const rank = progress.ranks[methodId];
  const learned = rank !== undefined;
  const technique = METHOD_TECHNIQUE_CATALOG[index]!;
  const learnReadout = `学会后立即获得属性与被动，下次入场可使用战技「${technique.name}」。${method.passive}`;
  const activateReadout = '将这门功法排到下次副本战技列表首位；不增加额外属性，也不影响使用其他已学功法。';
  const actions = [
    ...buildCatalogCycleActions('methods', entries, index),
    learned
      ? disabledAction(`hub.methods.learn:${methodId}`, `学习${method.name}`, 'primary', `你已经学会${method.name}。`, { readout: learnReadout })
      : previewCommandAction(state, `hub.methods.learn:${methodId}`, `学习${method.name}`, 'primary', { type: 'hub/learn-method', methodId }, { readout: learnReadout }),
    previewCommandAction(
      state,
      `hub.methods.upgrade:${methodId}`,
      `精研${method.name}`,
      'primary',
      { type: 'hub/upgrade-method', methodId },
      {
        readout: `永久提高功法阶位，增强战技「${technique.name}」；下次入场按新阶位生效。当前${rank === undefined ? '未学习' : `${rank}/3 阶`}。`,
        fallbackDisabledReason: upgrade?.state === 'max_rank'
          ? `${method.name}已经达到 R3。`
          : !learned
            ? `请先学习${method.name}。`
            : `当前资源不足，无法精研${method.name}。`
      }
    ),
    progress.activeMethod === methodId
      ? disabledAction(`hub.methods.activate:${methodId}`, `设为常用：${method.name}`, 'primary', `${method.name}已经是常用功法。`, { readout: activateReadout })
      : previewCommandAction(
          state,
          `hub.methods.activate:${methodId}`,
          `设为常用：${method.name}`,
          'primary',
          { type: 'hub/activate-method', methodId },
          { recommendation: 'recommended', readout: activateReadout, fallbackDisabledReason: `请先学习${method.name}。` }
        )
  ];
  return {
    actions,
    summary: `${method.name} · ${rank === undefined ? '未学习' : `${rank} 阶`} · ${state.activeMethod === methodId ? '常用功法' : '未设为常用'}`,
    objectiveTitle: '学习获得被动，精研强化战技',
    objectiveSummary: `${method.description} 已学功法的被动都可生效；常用设置只调整战技顺序。`
  };
}

function buildBloodlinesPanel(state: GameState, requestedId: string | undefined): HubPanelProjection {
  const entries = BLOODLINE_CATALOG.map(({ id, name }) => ({ id, name }));
  const index = selectedCatalogIndex(entries, requestedId);
  const bloodline = BLOODLINE_CATALOG[index]!;
  const progress = getBloodlineProgress(state);
  const upgrade = getBloodlineUpgradeStatus(bloodline.id, progress);
  const rank = progress.ranks[bloodline.id];
  const unlockReadout = `解锁 1 阶血统，激活后获得属性加成与战斗中的血统爆发。${progress.active === undefined ? '当前没有激活血统，觉醒后自动激活。' : '觉醒后需手动激活。'}`;
  const activateReadout = '换用这条血统，属性加成立即更新；下次入场带入它的阶位与爆发能力，每次只生效一种。';
  const actions = [
    ...buildCatalogCycleActions('bloodlines', entries, index),
    rank !== undefined
      ? disabledAction(`hub.bloodlines.unlock:${bloodline.id}`, `觉醒${bloodline.name}`, 'primary', `${bloodline.name}已经觉醒至 R${rank}。`, { readout: '解锁血统后可晋升、激活；激活的血统提供属性加成与战斗中的爆发能力。' })
      : previewCommandAction(
          state,
          `hub.bloodlines.unlock:${bloodline.id}`,
          `觉醒${bloodline.name}`,
          'primary',
          { type: 'hub/unlock-bloodline', bloodlineId: bloodline.id },
          { readout: unlockReadout, fallbackDisabledReason: `当前资源不足，无法觉醒${bloodline.name}。` }
        ),
    previewCommandAction(
      state,
      `hub.bloodlines.upgrade:${bloodline.id}`,
      `晋升${bloodline.name}`,
      'primary',
      { type: 'hub/upgrade-bloodline', bloodlineId: bloodline.id },
      {
        readout: `永久提高血统阶位，增强属性与爆发能力；激活后随下次入场带入。当前${rank === undefined ? '未觉醒' : `${rank}/3 阶`}。`,
        fallbackDisabledReason: upgrade?.state === 'max_rank'
          ? `${bloodline.name}已经达到 R3。`
          : rank === undefined
            ? `请先觉醒${bloodline.name}。`
            : `当前资源不足，无法晋升${bloodline.name}。`
      }
    ),
    progress.active === bloodline.id
      ? disabledAction(`hub.bloodlines.activate:${bloodline.id}`, `激活${bloodline.name}`, 'primary', `${bloodline.name}已经是当前有效血统。`, { readout: activateReadout })
      : previewCommandAction(
          state,
          `hub.bloodlines.activate:${bloodline.id}`,
          `激活${bloodline.name}`,
          'primary',
          { type: 'hub/activate-bloodline', bloodlineId: bloodline.id },
          { recommendation: 'recommended', readout: activateReadout, fallbackDisabledReason: `请先觉醒${bloodline.name}。` }
        )
  ];
  return {
    actions,
    summary: `${bloodline.name} · ${bloodline.title} · ${rank === undefined ? '未觉醒' : `${rank} 阶`} · ${state.activeBloodline === bloodline.id ? '已激活' : '未激活'}`,
    objectiveTitle: '激活一种血统，获得属性与爆发能力',
    objectiveSummary: `始祖倾向：${BLOODLINE_ASPECT_LABELS[bloodline.aspect]}。觉醒解锁，晋升强化，激活后生效；每次副本沿用入场时的血统与阶位。`
  };
}

function buildCompanionsPanel(state: GameState, requestedId: string | undefined): HubPanelProjection {
  const entries = COMPANION_CATALOG.map(({ id, name }) => ({ id, name }));
  const index = selectedCatalogIndex(entries, requestedId);
  const companion = COMPANION_CATALOG[index]!;
  const progress = {
    rulesVersion: COMPANION_RULES_VERSION,
    owned: state.ownedCompanions,
    ranks: state.companionRanks,
    ...(state.activeCompanion === undefined ? {} : { active: state.activeCompanion })
  };
  const recruitment = getCompanionRecruitmentStatus(companion.id, progress, state.completedDungeonIds);
  const upgrade = getCompanionUpgradeStatus(companion.id, progress);
  const rank = progress.ranks[companion.id];
  const recruitReadout = `邀请同伴加入，出战后可在副本战斗中使用「${companion.assistName}」。${state.ownedCompanions.length === 0 ? '首位同伴自动设为出战。' : '招募后需手动设为出战。'}`;
  const activateReadout = `下次入场由这位同伴出战，战斗中可使用「${companion.assistName}」援助；每次只能带一位。`;
  const actions = [
    ...buildCatalogCycleActions('companions', entries, index),
    recruitment === 'owned'
      ? disabledAction(`hub.companions.recruit:${companion.id}`, `招募${companion.name}`, 'primary', `${companion.name}已经加入轮回小队。`, { readout: `加入后可训练，并设为出战同伴，在副本战斗中使用「${companion.assistName}」。` })
      : recruitment === 'locked'
        ? disabledAction(
            `hub.companions.recruit:${companion.id}`,
            `招募${companion.name}`,
            'primary',
            `首次通关${DUNGEONS[companion.unlockDungeonId].name}后才能招募。`,
            { readout: recruitReadout }
          )
        : previewCommandAction(
            state,
            `hub.companions.recruit:${companion.id}`,
            `招募${companion.name}`,
            'primary',
            { type: 'hub/recruit-companion', companionId: companion.id },
            {
              readout: recruitReadout,
              fallbackDisabledReason: `当前资源不足，无法招募${companion.name}。`
            }
          ),
    previewCommandAction(
      state,
      `hub.companions.upgrade:${companion.id}`,
      `训练${companion.name}`,
      'primary',
      { type: 'hub/upgrade-companion', companionId: companion.id },
      {
        readout: `永久提高同伴阶位，增强「${companion.assistName}」的援助效果；下次出战时生效。当前${rank === undefined ? '未招募' : `${rank}/3 阶`}。`,
        fallbackDisabledReason: upgrade?.state === 'max_rank'
          ? `${companion.name}已经达到 R3。`
          : rank === undefined
            ? `请先招募${companion.name}。`
            : `当前资源不足，无法训练${companion.name}。`
      }
    ),
    state.activeCompanion === companion.id
      ? disabledAction(`hub.companions.activate:${companion.id}`, `设为出战同伴：${companion.name}`, 'primary', `${companion.name}已经在出战位。`, { readout: activateReadout })
      : previewCommandAction(
          state,
          `hub.companions.activate:${companion.id}`,
          `设为出战同伴：${companion.name}`,
          'primary',
          { type: 'hub/activate-companion', companionId: companion.id },
          { recommendation: 'recommended', readout: activateReadout, fallbackDisabledReason: `请先招募${companion.name}。` }
        )
  ];
  return {
    actions,
    summary: `${companion.name} · ${companion.title} · ${rank === undefined ? '未招募' : `${rank} 阶`} · ${state.activeCompanion === companion.id ? '出战中' : '未出战'}`,
    objectiveTitle: '招募同伴，选一位提供战斗援助',
    objectiveSummary: `出战后可使用「${companion.assistName}」；每次副本沿用入场时的同伴与阶位。训练需要${ITEMS[companion.trainingMaterial].name}。`
  };
}

function taskStatusLabel(evaluation: MainGodTaskEvaluation): string {
  const labels: Readonly<Record<MainGodTaskEvaluation['status'], string>> = {
    locked: '未解锁',
    active: '进行中',
    completed: '可领取',
    claimed: '已领取'
  };
  return labels[evaluation.status];
}

function rewardReadout(evaluation: MainGodTaskEvaluation): string {
  const parts = [
    evaluation.task.reward.rewardPoints ? `${evaluation.task.reward.rewardPoints} 奖励点` : '',
    evaluation.task.reward.lingyun ? `${evaluation.task.reward.lingyun} 灵蕴` : '',
    ...Object.entries(evaluation.task.reward.items ?? {}).map(([itemId, amount]) => `${ITEMS[itemId as ItemId].name} x${amount}`)
  ].filter(Boolean);
  return parts.length > 0 ? `奖励 ${parts.join('、')}` : '无额外奖励';
}

function taskProgressFraction(evaluation: MainGodTaskEvaluation): string {
  const fraction = evaluation.progressText.match(/^\d+\/\d+/)?.[0];
  if (!fraction) throw new Error(`Task ${evaluation.taskId} has no count progress: ${evaluation.progressText}`);
  return fraction;
}

function directiveObjectiveAction(objective: DirectiveObjective, result: DirectiveObjectiveResult): readonly string[] {
  const count = `${Number(result.completed)}/1`;
  switch (objective.kind) {
    case 'capture': return [`捕获${objective.petId ? PETS[objective.petId].name : '灵宠'} ${count}`];
    case 'method': return [`掌握${METHODS[objective.methodId!].name} ${count}`];
    case 'equip': return [`装备${EQUIPMENT[objective.equipmentId!].name} ${count}`];
    case 'active_pet': return [`携带${PETS[objective.petId!].name}出战 ${count}`];
    case 'active_bloodline': return [`携带已觉醒血统入场 ${count}`];
    case 'hidden_clear': return [result.progressText.replace('全图清理', '清理全部节点')];
    case 'route': return [`${objective.label} ${result.progressText.replace('路线锚点 ', '')}`];
    case 'auction': return result.progressText.split('；').map((part) => `完成${part}`);
    case 'genesis_splice': return result.progressText.split('；').map((part) =>
      part.startsWith('不同基因') ? part.replace('不同基因', '使用不同基因') : `完成基因${part}`);
    case 'broadcast_relays': return result.progressText.split('；').map((part) =>
      part.startsWith('中继') ? `处理中继 ${part.slice(3)}` : part.replace('静默 ', '静默中继 ').replace('广播 ', '广播中继 '));
    case 'escort_checkpoints': return result.progressText.split('；').filter((part) => !part.startsWith('幸存者生命')).map((part) =>
      part.replace('检查点 ', '完成检查点 ').replace('救治 ', '救治幸存者 ').replace('推进 ', '推进护送 '));
    case 'false_testimony_verdict':
    case 'combat_replay_complete':
    case 'panopticon_complete': return [`${objective.label} · ${result.progressText}`];
    // These ongoing limits and final-fight snapshots stay in the full task details.
    case 'low_damage':
    case 'no_item':
    case 'broadcast_snapshot':
    case 'escort_snapshot':
    case 'false_testimony_snapshot': return [];
  }
}

function getTaskDirectiveEvaluation(state: GameState, dungeonId: DungeonId) {
  // A different chapter's run must not hide this task's durable equipment/pet/method progress.
  return getDirectiveEvaluation(state.run?.dungeonId === dungeonId ? state : { ...state, run: undefined }, dungeonId);
}

function buildDirectiveTaskObjectives(state: GameState, evaluation: MainGodTaskEvaluation): readonly string[] {
  const dungeonId = evaluation.task.chapterDungeonId;
  const dungeonName = DUNGEONS[dungeonId].name;
  if (evaluation.completed) return [`首通${dungeonName}并完成指令 1/1`];
  const directive = getDirectiveForDungeon(dungeonId);
  const progress = getTaskDirectiveEvaluation(state, dungeonId);
  const clearedCount = state.run?.dungeonId === dungeonId ? state.run.clearedNodeIds.length : 0;
  const objectives = [
    ...(clearedCount < directive.requiredClears
      ? [progress.progressText.replace('节点清理', `清理${dungeonName}节点`)]
      : []),
    ...directive.optionalObjectives.flatMap((objective, index) => {
      const result = progress.objectiveResults[index]!;
      return result.completed ? [] : directiveObjectiveAction(objective, result);
    }),
    ...progress.objectiveResults.flatMap((objective) => !objective.completed &&
      (objective.kind === 'low_damage' || objective.kind === 'no_item')
      ? [`本轮未满足：${objective.label}`]
      : []),
    ...(progress.status === 'completed'
      ? [`从出口完成${dungeonName}首通结算 0/1`]
      : [`首通${dungeonName} ${Number(state.completedDungeonIds.includes(dungeonId))}/1`])
  ];
  return objectives;
}

function buildTaskObjectives(state: GameState, evaluation: MainGodTaskEvaluation): readonly string[] {
  const { task } = evaluation;
  const dungeonName = DUNGEONS[task.chapterDungeonId].name;
  const fraction = taskProgressFraction(evaluation);
  if (task.kind === 'mainline') return [`通关${dungeonName} ${fraction}`];

  const cultivationLabels: Readonly<Record<string, string>> = {
    side_recruit_first_companion: '招募任意同伴',
    side_train_companion_rank_2: '训练任意同伴至位阶 2',
    side_refine_first_method_rank_2: '精研任意功法至 R2',
    side_master_first_method_rank_3: '精研任意功法至 R3',
    side_unlock_first_bloodline: '觉醒任意血统',
    side_master_first_bloodline_rank_3: '觉醒任意血统至 R3'
  };
  const cultivationLabel = cultivationLabels[task.id];
  if (cultivationLabel) return [`${cultivationLabel} ${fraction}`];

  if (task.id === `side_enter_${task.chapterDungeonId}`) {
    if (task.chapterDungeonId === 'combat_replay_stage') return [`完成战斗录制 ${fraction}`];
    if (task.chapterDungeonId === 'panopticon_city') return [`完成盲区中继 ${fraction}`];
    return [`进入${dungeonName} ${fraction}`];
  }

  if (task.id === `side_directive_${task.chapterDungeonId}`) {
    if (task.chapterDungeonId === 'combat_replay_stage' || task.chapterDungeonId === 'panopticon_city') {
      const run = state.run?.dungeonId === task.chapterDungeonId ? state.run : undefined;
      const law = run?.lawState?.law;
      const alreadyCleared = state.completedDungeonIds.includes(task.chapterDungeonId);
      const matchingLaw = law?.kind === task.chapterDungeonId ? law : undefined;
      const routeSelected = alreadyCleared || matchingLaw?.route != null ||
        (task.chapterDungeonId === 'combat_replay_stage' && run?.combatReplayState?.route !== undefined);
      const bossRecorded = alreadyCleared || matchingLaw?.bossSnapshot != null;
      return [
        `选择${task.chapterDungeonId === 'combat_replay_stage' ? '复演' : '逃逸'}路线 ${Number(routeSelected)}/1`,
        `冻结首领快照 ${Number(bossRecorded)}/1`
      ];
    }
    return buildDirectiveTaskObjectives(state, evaluation);
  }
  throw new Error(`No objective presentation for task: ${task.id}`);
}

function buildCurrentTasks(state: GameState): readonly TaskViewModel[] {
  return evaluateVisibleTasks(state).flatMap((evaluation) => {
    if (evaluation.status !== 'active' && evaluation.status !== 'completed') return [];
    const { task } = evaluation;
    const isDirective = task.id === `side_directive_${task.chapterDungeonId}` &&
      task.chapterDungeonId !== 'combat_replay_stage' && task.chapterDungeonId !== 'panopticon_city';
    const directive = isDirective && !evaluation.completed
      ? getTaskDirectiveEvaluation(state, task.chapterDungeonId)
      : undefined;
    const completedDirective = isDirective && evaluation.completed
      ? getDirectiveForDungeon(task.chapterDungeonId)
      : undefined;
    return [{
      id: task.id,
      title: task.title,
      kind: task.kind,
      status: evaluation.status,
      objectives: buildTaskObjectives(state, evaluation),
      ...(directive ? {
        detailObjectives: [
          directive.progressText,
          ...directive.objectiveResults.map((objective) => `${objective.label} · ${objective.progressText}`),
          `首通${DUNGEONS[task.chapterDungeonId].name} ${Number(state.completedDungeonIds.includes(task.chapterDungeonId))}/1`,
          '首通时满足全部指令目标，由出口自动结算'
        ]
      } : completedDirective ? {
        detailObjectives: [
          `清理节点 ${completedDirective.requiredClears}/${completedDirective.requiredClears}`,
          ...completedDirective.optionalObjectives.map((objective) => `${objective.label} · 首通时已满足`),
          `首通${DUNGEONS[task.chapterDungeonId].name} 1/1`,
          '指令奖励已结算 1/1'
        ]
      } : {}),
      description: task.description,
      hint: task.hint,
      rewardText: rewardReadout(evaluation)
    }];
  });
}

function buildTasksPanel(state: GameState, requestedId: string | undefined): HubPanelProjection {
  const evaluations = evaluateVisibleTasks(state);
  if (evaluations.length === 0) {
    return {
      actions: [disabledAction('hub.tasks.empty', '暂无可见任务', 'primary', '当前没有可展示的主神任务。')],
      summary: '暂无可见任务',
      objectiveTitle: '查看与领取主神任务',
      objectiveSummary: '推进副本与养成后会出现新的任务。'
    };
  }
  const entries = evaluations.map(({ task }) => ({ id: task.id, name: task.title }));
  const preferredId = requestedId ?? evaluations.find(({ status }) => status === 'completed')?.task.id;
  const index = selectedCatalogIndex(entries, preferredId);
  const evaluation = evaluations[index]!;
  const claimReadout = `完成后点击领取，奖励立即入账。${rewardReadout(evaluation)}。当前进度：${evaluation.progressText}。`;
  const actions = [
    ...buildCatalogCycleActions('tasks', entries, index),
    evaluation.status === 'claimed'
      ? disabledAction(
          `hub.tasks.claim:${evaluation.task.id}`,
          `领取：${evaluation.task.title}`,
          'primary',
          '该任务奖励已经领取。',
          { readout: `任务奖励已入账，每项任务只能领取一次。${rewardReadout(evaluation)}。` }
        )
      : previewCommandAction(
          state,
          `hub.tasks.claim:${evaluation.task.id}`,
          `领取：${evaluation.task.title}`,
          'primary',
          { type: 'hub/claim-task', taskId: evaluation.task.id },
          { recommendation: evaluation.status === 'completed' ? 'recommended' : 'neutral', readout: claimReadout }
        )
  ];
  return {
    actions,
    summary: `${evaluation.task.title} · ${taskStatusLabel(evaluation)} · ${evaluation.progressText}`,
    objectiveTitle: '按目标推进，完成后手动领取奖励',
    objectiveSummary: `${evaluation.task.description} ${evaluation.task.hint}${evaluation.task.kind === 'mainline' ? ' 主线完成后记得领取奖励，后续章节由领取进度解锁。' : ''}`
  };
}

function buildHubPanelProjection(
  state: GameState,
  localUiState: PresentationLocalUiState,
  draft: EntryProtocolDraft,
  panel: HubPanel
): HubPanelProjection {
  const selections = localUiState.hubSelections;
  switch (panel) {
    case 'entry': return buildEntryPanel(state, draft);
    case 'supplies': return buildSuppliesPanel(state, selections?.supplies);
    case 'equipment': return buildEquipmentPanel(
      state,
      selections?.equipment,
      localUiState.equipmentCommissionDraft
    );
    case 'pets': return buildPetsPanel(state, selections?.pets);
    case 'methods': return buildMethodsPanel(state, selections?.methods);
    case 'bloodlines': return buildBloodlinesPanel(state, selections?.bloodlines);
    case 'companions': return buildCompanionsPanel(state, selections?.companions);
    case 'tasks': return buildTasksPanel(state, selections?.tasks);
  }
  const exhaustive: never = panel;
  throw new Error(`Unsupported hub panel: ${String(exhaustive)}`);
}

function buildHubProjection(state: GameState, localUiState: PresentationLocalUiState): PhaseProjection {
  const draft = localUiState.entryDraft ?? defaultEntryDraft();
  const dungeon = DUNGEONS[draft.dungeonId] ?? DUNGEONS[FIRST_DUNGEON_ID];
  const activePanel = HUB_PANELS.includes(localUiState.hubPanel as HubPanel)
    ? localUiState.hubPanel as HubPanel
    : 'entry';
  const panel = buildHubPanelProjection(state, localUiState, draft, activePanel);
  const actions = [...panel.actions, ...buildHubNavigation(activePanel)];
  const entryBuild = panel.entryBuild ?? buildEntryBuildProjection(state, draft).detail;
  const detail: HubDetailViewModel = {
    kind: 'hub',
    activePanel,
    activePanelLabel: HUB_PANEL_LABELS[activePanel],
    panelSummary: panel.summary,
    entryDraft: draft,
    selectedDungeonName: dungeon.name,
    seedStatus: 'host-on-confirm',
    dungeonCount: DUNGEON_ORDER.length,
    entryBuild,
    ...(activePanel === 'entry' ? { entryServices: buildEntryServices(state, draft, entryBuild, panel.actions) } : {}),
    ...(panel.equipmentCommission
      ? { equipmentCommission: panel.equipmentCommission }
      : {}),
    ...(panel.equipmentMemory
      ? { equipmentMemory: panel.equipmentMemory }
      : {}),
    ...(activePanel === 'entry' ? {} : {
      shop: buildHubShopCatalog(state, activePanel, (id) => buildHubPanelProjection(
        state,
        { ...localUiState, hubSelections: { ...localUiState.hubSelections, [activePanel]: id } },
        draft,
        activePanel
      ))
    })
  };
  const metrics: StatusMetric[] = [
    { id: 'hp', label: '生命', value: `${state.player.hp}/${state.player.maxHp}`, symbol: '♥', severity: state.player.hp < state.player.maxHp / 3 ? 'danger' : 'neutral' },
    { id: 'power', label: '战力', value: String(getPlayerPower(state)), symbol: '力', severity: 'neutral' },
    { id: 'reward-points', label: '奖励点', value: String(state.rewardPoints), symbol: '点', severity: 'neutral' },
    { id: 'lingyun', label: '灵蕴', value: String(state.lingyun), symbol: '蕴', severity: 'neutral' },
    { id: 'hub-panel', label: '大厅面板', value: HUB_PANEL_LABELS[activePanel], symbol: '厅', severity: 'positive' }
  ];
  return {
    title: `主神空间 · ${HUB_PANEL_LABELS[activePanel]}`,
    visualAssetKey: verifiedVisualAssetKey('scene', 'main_god_space'),
    objective: {
      kind: 'objective',
      title: panel.objectiveTitle,
      summary: panel.objectiveSummary
    },
    status: { kind: 'status', metrics, detail },
    actions,
    logs: state.log.slice(0, 12)
  };
}

/** Character preparation is requested by the host on demand, independently of NPC shops. */
export function buildHubOwnedLoadoutViewModel(
  state: ReadonlyGameState,
  localUiState: PresentationLocalUiState = {}
): HubOwnedLoadoutViewModel | undefined {
  if (state.phase !== 'hub') return undefined;
  const domain = asDomainState(state);
  const draft = localUiState.entryDraft ?? defaultEntryDraft();
  return serializableSnapshot(buildHubOwnedLoadoutCatalog(
    domain,
    (panel, id) => buildHubPanelProjection(
      domain,
      { ...localUiState, hubSelections: { ...localUiState.hubSelections, [panel]: id } },
      draft,
      panel
    ),
    (equipmentId, memory) => {
      const actionId = `hub.equipment.memory.activate:${equipmentId}:${memory.memoryId}::owned/equipment/${equipmentId}`;
      const label = `激活记忆：${memory.name}`;
      const readout = `装备后在下次副本获得该能力。${memory.effectDescription}`;
      return memory.active
        ? disabledAction(actionId, label, 'preparation', `当前已激活「${memory.name}」。`, { readout })
        : previewCommandAction(domain, actionId, label, 'preparation', {
            type: 'hub/activate-equipment-memory', equipmentId, memoryId: memory.memoryId
          }, {
            readout,
            fallbackDisabledReason: '当前无法启用这段记忆，请检查装备是否已拥有且记忆已收录。'
          });
    }
  ));
}

function getPhysicalAdjacentIds(state: GameState): Set<string> {
  const run = state.run;
  const dungeon = getCurrentDungeonDefinition(state);
  if (!run || !dungeon) return new Set();
  if (run.protocol?.id === 'deep' && run.infernoMap) {
    return new Set(
      run.infernoMap.nodes.find((node) => node.nodeId === run.currentNodeId)?.connectionIds ?? []
    );
  }
  const current = dungeon.nodes.find((node) => node.id === run.currentNodeId);
  if (!current) return new Set();
  return new Set(dungeon.nodes
    .filter((node) => Math.abs(node.position.x - current.position.x) + Math.abs(node.position.y - current.position.y) === 1)
    .map((node) => node.id));
}

function getMapNodeState(
  nodeId: string,
  currentNodeId: string,
  adjacentIds: ReadonlySet<string>,
  clearedIds: ReadonlySet<string>,
  discoveredIds: ReadonlySet<string>
): MapNodeState {
  if (nodeId === currentNodeId) return 'current';
  if (clearedIds.has(nodeId)) return 'cleared';
  if (adjacentIds.has(nodeId)) return 'adjacent';
  if (discoveredIds.has(nodeId)) return 'scouted';
  return 'fogged';
}

function buildMap(state: GameState): Readonly<{ map: MapViewModel; movementActions: ViewActionModel[] }> {
  const run = state.run!;
  const dungeon = getCurrentDungeonDefinition(state) ?? DUNGEONS[run.dungeonId];
  const adjacentIds = getPhysicalAdjacentIds(state);
  const legalIds = new Set(getCurrentLegalAdjacentTargetIds(state));
  const clearedIds = new Set(run.clearedNodeIds);
  const discoveredIds = new Set(getRunDiscoveredNodeIds(run, dungeon));
  const departureBlock = getNodeDepartureBlock(state);
  const movementActions: ViewActionModel[] = [];
  const nodes: MapNodeViewModel[] = dungeon.nodes.map((node) => {
    const mapState = getMapNodeState(node.id, run.currentNodeId, adjacentIds, clearedIds, discoveredIds);
    const visual = COCOS_DESIGN_TOKENS.mapStates[mapState];
    const cellId = `map.cell:${node.position.x}:${node.position.y}`;
    const moveActionId = node.id === run.currentNodeId ? undefined : `map.move:${cellId}`;
    const isAdjacent = adjacentIds.has(node.id);
    const routeBlock = isAdjacent ? getCurrentRouteBlockReason(state, node.id) : undefined;
    const disabledReason = node.id === run.currentNodeId
      ? undefined
      : !isAdjacent
        ? '仅可移动至相邻节点。'
        : departureBlock
          ? departureBlock.message
          : routeBlock
            ? routeBlock
            : !legalIds.has(node.id)
              ? '相邻路线当前关闭。'
              : undefined;
    const canMove = Boolean(moveActionId && !disabledReason);
    if (moveActionId) {
      movementActions.push(canMove
        ? commandAction(moveActionId, `移动至${mapState === 'fogged' ? '未知区域' : node.title}`, 'map', {
            type: 'run/move', nodeId: node.id
          }, { recommendation: mapState === 'adjacent' ? 'recommended' : 'neutral' })
        : disabledAction(moveActionId, `移动至${mapState === 'fogged' ? '未知区域' : node.title}`, 'map', disabledReason!));
    }
    return {
      cellId,
      ...(mapState === 'fogged' ? {} : { nodeId: node.id }),
      title: mapState === 'fogged' ? '未知区域' : node.title,
      nodeType: mapState === 'fogged' ? 'unknown' : node.type,
      state: mapState,
      stateLabel: visual.label,
      stateSymbol: visual.symbol,
      x: node.position.x,
      y: node.position.y,
      isAdjacent,
      canMove,
      ...(moveActionId ? { moveActionId } : {}),
      ...(disabledReason ? { disabledReason } : {})
    };
  });
  return {
    map: {
      dungeonId: dungeon.id,
      dungeonName: dungeon.name,
      width: dungeon.grid.width,
      height: dungeon.grid.height,
      ...(run.infernoMap ? { seed: run.infernoMap.seed } : {}),
      currentNodeId: run.currentNodeId,
      nodes
    },
    movementActions
  };
}

type PendingProjection = Readonly<{
  pending?: PendingChoiceViewModel;
  actions: readonly ViewActionModel[];
}>;

function lawChoiceActions(block: NodeDepartureBlock): PendingProjection | undefined {
  const definitions: Partial<Record<NodeDepartureBlock['kind'], Readonly<{
    title: string;
    choices: readonly Readonly<{ id: string; label: string; command: GameCommand; risk?: string }>[];
  }>>> = {
    causal_ledger: {
      title: '因果账本',
      choices: [
        { id: 'balance', label: '平衡账本', command: { type: 'law/resolve-causal-ledger', choice: 'balance' } },
        { id: 'overdraw', label: '透支因果', command: { type: 'law/resolve-causal-ledger', choice: 'overdraw' }, risk: '透支会用更高风险换取即时收益。' },
        { id: 'repay', label: '偿还因果', command: { type: 'law/resolve-causal-ledger', choice: 'repay' } }
      ]
    },
    entropy_heading: {
      title: '方舟航向',
      choices: [
        { id: 'steady', label: '稳航', command: { type: 'law/resolve-entropy-heading', choice: 'steady' } },
        { id: 'rush', label: '抢航', command: { type: 'law/resolve-entropy-heading', choice: 'rush' }, risk: '抢航会提高当前路线风险。' }
      ]
    },
    mirror_phase: {
      title: '镜城相位',
      choices: [
        { id: 'real', label: '现实相位', command: { type: 'law/resolve-mirror-city-phase', phase: 'real' } },
        { id: 'mirror', label: '镜像相位', command: { type: 'law/resolve-mirror-city-phase', phase: 'mirror' } }
      ]
    },
    redaction_clause: {
      title: '终稿条款',
      choices: [
        { id: 'certify', label: '认证', command: { type: 'law/resolve-redaction-clause', choice: 'certify' } },
        { id: 'redact', label: '删改', command: { type: 'law/resolve-redaction-clause', choice: 'redact' } }
      ]
    },
    auction_lot: {
      title: '遗产拍品',
      choices: [
        { id: 'bid', label: '竞得', command: { type: 'law/resolve-auction-lot', choice: 'bid' } },
        { id: 'burn', label: '焚毁', command: { type: 'law/resolve-auction-lot', choice: 'burn' } },
        { id: 'fold', label: '放弃', command: { type: 'law/resolve-auction-lot', choice: 'fold' } }
      ]
    },
    genesis_splice: {
      title: '原型拼接',
      choices: [
        { id: 'force', label: '武力基因', command: { type: 'law/resolve-genesis-splice', gene: 'force' } },
        { id: 'art', label: '术法基因', command: { type: 'law/resolve-genesis-splice', gene: 'art' } },
        { id: 'guard', label: '守御基因', command: { type: 'law/resolve-genesis-splice', gene: 'guard' } },
        { id: 'renewal', label: '复生基因', command: { type: 'law/resolve-genesis-splice', gene: 'renewal' } }
      ]
    },
    broadcast_relay: {
      title: '广播中继',
      choices: [
        { id: 'mute', label: '静默', command: { type: 'law/resolve-broadcast-relay', choice: 'mute' } },
        { id: 'broadcast', label: '播送', command: { type: 'law/resolve-broadcast-relay', choice: 'broadcast' }, risk: '播送可能提高噪声与后续压力。' }
      ]
    },
    escort_checkpoint: {
      title: '护送检查点',
      choices: [
        { id: 'treat', label: '救治', command: { type: 'law/resolve-escort-checkpoint', choice: 'treat' } },
        { id: 'push', label: '强推', command: { type: 'law/resolve-escort-checkpoint', choice: 'push' }, risk: '强推会让幸存者承担风险。' }
      ]
    },
    false_testimony_verdict: {
      title: '伪证裁决',
      choices: [
        { id: 'records_keeper', label: '指控档案员', command: { type: 'law/resolve-verdict', suspect: 'records_keeper' } },
        { id: 'field_medic', label: '指控战地医师', command: { type: 'law/resolve-verdict', suspect: 'field_medic' } },
        { id: 'security_chief', label: '指控安保主管', command: { type: 'law/resolve-verdict', suspect: 'security_chief' } },
        { id: 'route_surveyor', label: '指控路线勘测员', command: { type: 'law/resolve-verdict', suspect: 'route_surveyor' } }
      ]
    },
    panopticon_route: {
      title: '监察潜入路线',
      choices: [
        { id: 'shadow', label: '影路', command: { type: 'law/select-panopticon-route', route: 'shadow' } },
        { id: 'decoy', label: '诱饵', command: { type: 'law/select-panopticon-route', route: 'decoy' } },
        { id: 'refraction', label: '折光', command: { type: 'law/select-panopticon-route', route: 'refraction' } }
      ]
    }
  };
  const definition = definitions[block.kind];
  if (!definition) return undefined;
  const actions = definition.choices.map((choice) => commandAction(
    `law.${block.kind}:${choice.id}`,
    choice.label,
    'node',
    choice.command,
    choice.risk ? { recommendation: 'high-risk', riskReason: choice.risk } : {}
  ));
  return {
    pending: {
      kind: 'law',
      title: definition.title,
      message: block.message,
      actionIds: actions.map((action) => action.actionId)
    },
    actions
  };
}

function buildCombatReplayRouteChoice(state: GameState): PendingProjection | undefined {
  const replay = getCurrentDungeonLaw(state)?.display.combatReplay;
  if (!replay?.readyForRoute || replay.route) return undefined;
  const choices = [
    { id: 'sequence', label: '顺序回放' },
    { id: 'burst', label: '爆发回放' },
    { id: 'afterbeat', label: '后拍回放' }
  ] as const;
  const actions = choices.map((choice) => commandAction(
    `law.combat-replay:${choice.id}`,
    choice.label,
    'node',
    { type: 'law/select-combat-replay-route', route: choice.id }
  ));
  return {
    pending: {
      kind: 'law', title: '战斗回放路线', message: '三段录制完成，请先冻结首领回放路线。',
      actionIds: actions.map((action) => action.actionId)
    },
    actions
  };
}

function buildPendingProjection(state: GameState): PendingProjection {
  const run = state.run!;
  const equipmentOffer = run.pendingEquipmentOffer;
  if (equipmentOffer) {
    const actions = equipmentOffer.equipmentIds.map((equipmentId) => commandAction(
      `pending.equipment:${equipmentOffer.offerId}:${equipmentId}`,
      `选择${EQUIPMENT[equipmentId].name}`,
      'node',
      { type: 'node/resolve-equipment-loot', equipmentId }
    ));
    actions.push(commandAction(
      `pending.equipment:${equipmentOffer.offerId}:skip`, '放弃装备', 'node',
      { type: 'node/resolve-equipment-loot' }, { emphasis: 'quiet' }
    ));
    return {
      pending: { kind: 'equipment-offer', title: '精英装备三选一', message: '选择一件装备，或放弃本次掉落。', actionIds: actions.map((action) => action.actionId) },
      actions
    };
  }

  const relicDraft = run.relicState?.pendingDraft;
  if (relicDraft) {
    const actions = relicDraft.candidateIds.map((relicId) => commandAction(
      `pending.relic:${relicDraft.draftId}:${relicId}`,
      `选择${RUN_RELIC_DEFINITIONS[relicId].name}`,
      'node',
      { type: 'node/resolve-relic-draft', relicId, draftId: relicDraft.draftId },
      { readout: RUN_RELIC_DEFINITIONS[relicId].description }
    ));
    return {
      pending: { kind: 'relic-draft', title: '回响遗物', message: '选择一件本局回响后继续。', actionIds: actions.map((action) => action.actionId) },
      actions
    };
  }

  const recharge = getEquipmentSoulSkillRechargeStatus(state);
  if (recharge.pending) {
    const names = new Map(getEquipmentSoulSkillActionStatuses(state).map((entry) => [entry.skillId, entry.definition.name]));
    const actions = recharge.spentSkillIds.map((skillId) => commandAction(
      `pending.soul-recharge:${skillId}`,
      `恢复${names.get(skillId) ?? skillId}`,
      'node',
      { type: 'node/resolve-soul-recharge', skillId }
    ));
    actions.push(commandAction('pending.soul-recharge:cancel', '取消共鸣', 'node', { type: 'node/cancel-soul-recharge' }, { emphasis: 'quiet' }));
    return {
      pending: { kind: 'soul-recharge', title: '器魂共鸣', message: '选择恢复一项已消耗器魂，或取消。', actionIds: actions.map((action) => action.actionId) },
      actions
    };
  }

  const departureBlock = getNodeDepartureBlock(state);
  if (departureBlock) {
    const law = lawChoiceActions(departureBlock);
    if (law) return law;
  }
  const replay = buildCombatReplayRouteChoice(state);
  if (replay) return replay;

  const event = getAvailableDungeonEvents(state)[0];
  if (event) {
    const actions = event.options.map((option) => {
      const riskReason = option.risk === 'high'
        ? option.description
        : option.risk === 'medium'
          ? `中等风险：${option.description}`
          : undefined;
      return option.available
        ? commandAction(
            `pending.event:${event.id}:${option.id}`,
            option.label,
            'node',
            { type: 'node/resolve-event', eventId: event.id, optionId: option.id },
            riskReason
              ? { recommendation: option.risk === 'high' ? 'high-risk' : 'neutral', riskReason, readout: option.description }
              : { readout: option.description }
          )
        : disabledAction(
            `pending.event:${event.id}:${option.id}`,
            option.label,
            'node',
            option.unmetRequirements.map((requirement) => requirement.description).join('；') || '未满足事件条件。',
            { readout: option.description }
          );
    });
    return {
      pending: { kind: 'dungeon-event', title: event.title, message: event.description, actionIds: actions.map((action) => action.actionId) },
      actions
    };
  }

  const survey = getCurrentFieldSurveyStatus(state);
  if (survey.survey && !survey.resolved) {
    const actions = survey.options.map((option) => option.available
      ? commandAction(
          `pending.field-survey:${survey.survey!.id}:${option.definition.id}`,
          option.definition.name,
          'node',
          { type: 'node/resolve-field-survey', optionId: option.definition.id },
          option.definition.hpPercent && option.definition.hpPercent < 0
            ? { recommendation: 'high-risk', riskReason: `将损失 ${Math.abs(option.definition.hpPercent)}% 最大生命。` }
            : {}
        )
      : disabledAction(
          `pending.field-survey:${survey.survey!.id}:${option.definition.id}`,
          option.definition.name,
          'node',
          option.unavailableReason ?? '该铭刻分支当前不可用。'
        ));
    actions.push(commandAction('pending.field-survey:ordinary', '普通领取', 'node', { type: 'node/collect-reward' }));
    return {
      pending: { kind: 'field-survey', title: '铭刻勘探', message: '选择铭刻分支，或按普通规则领取。', actionIds: actions.map((action) => action.actionId) },
      actions
    };
  }

  return { actions: [] };
}

function buildSoulSkillActions(state: GameState, placement: ViewActionPlacement): ViewActionModel[] {
  return getEquipmentSoulSkillActionStatuses(state).flatMap((status): ViewActionModel[] => {
    if (!status.available) {
      if (!status.frozen) return [];
      return [disabledAction(
        `soul-skill:${status.skillId}`,
        status.definition.name,
        placement,
        status.unavailableReason ?? '器魂当前不可用。'
      )];
    }
    const variants: Readonly<{ suffix: string; command: GameCommand; label: string }>[] = status.targetNodeIds.length > 0
      ? status.targetNodeIds.map((targetNodeId) => ({
          suffix: `node:${targetNodeId}`,
          label: `${status.definition.name} → ${targetNodeId}`,
          command: { type: 'node/use-soul-skill', skillId: status.skillId, targetNodeId }
        }))
      : status.portalChoices.length > 0
        ? status.portalChoices.map((portalChoice) => ({
            suffix: `portal:${portalChoice}`,
            label: `${status.definition.name}：${portalChoice === 'stabilize' ? '稳定' : '强闯'}`,
            command: { type: 'node/use-soul-skill', skillId: status.skillId, portalChoice }
          }))
        : status.itemIds.length > 0
          ? status.itemIds.map((itemId) => ({
              suffix: `item:${itemId}`,
              label: `${status.definition.name}：${ITEMS[itemId].name}`,
              command: { type: 'node/use-soul-skill', skillId: status.skillId, itemId }
            }))
          : [{
              suffix: 'use',
              label: status.definition.name,
              command: { type: 'node/use-soul-skill', skillId: status.skillId }
            }];
    return variants.map((variant) => commandAction(
      `soul-skill:${status.skillId}:${variant.suffix}`,
      variant.label,
      placement,
      variant.command,
      { readout: status.definition.description }
    ));
  });
}

function buildSoulRechargeActivationActions(state: GameState): ViewActionModel[] {
  const recharge = getEquipmentSoulSkillRechargeStatus(state);
  if (recharge.rechargeId === undefined || recharge.pending) return [];
  const skillNames = new Map(
    getEquipmentSoulSkillActionStatuses(state).map(({ skillId, definition }) => [skillId, definition.name])
  );
  const readout = recharge.spentSkillIds.length === 0
    ? '当前没有已消耗器魂技。'
    : `可恢复：${recharge.spentSkillIds.map((skillId) => skillNames.get(skillId) ?? skillId).join('、')}`;
  return [recharge.available
    ? commandAction(
        `soul-recharge.activate:${recharge.rechargeId}`,
        '开启器魂共鸣台',
        'node',
        { type: 'node/activate-soul-recharge' },
        { emphasis: 'primary', recommendation: 'recommended', readout }
      )
    : disabledAction(
        `soul-recharge.activate:${recharge.rechargeId}`,
        '开启器魂共鸣台',
        'node',
        recharge.unavailableReason ?? '当前无法开启器魂共鸣台。',
        { readout }
      )];
}

function buildCurrentNodeActions(state: GameState): ViewActionModel[] {
  const run = state.run!;
  const dungeon = getCurrentDungeonDefinition(state) ?? DUNGEONS[run.dungeonId];
  const node = dungeon.nodes.find((candidate) => candidate.id === run.currentNodeId)!;
  if (run.clearedNodeIds.includes(node.id)) {
    return [
      ...buildSoulRechargeActivationActions(state),
      ...buildSoulSkillActions(state, 'advanced')
    ];
  }
  const actions: ViewActionModel[] = [];
  if (node.type === 'monster') {
    actions.push(commandAction(`node.select:${node.id}`, `迎战${node.title}`, 'node', { type: 'run/select-node', nodeId: node.id }, { emphasis: 'primary', recommendation: 'recommended' }));
  } else if (node.type === 'trap') {
    const counterItem = node.trap?.counterItem;
    const canCounter = counterItem ? (state.inventory[counterItem] ?? 0) > 0 : false;
    actions.push(canCounter
      ? commandAction(`node.trap:${node.id}:counter`, `使用${ITEMS[counterItem!].name}破解`, 'node', { type: 'node/handle-trap', choice: 'counter' }, { recommendation: 'recommended' })
      : disabledAction(`node.trap:${node.id}:counter`, '道具破解', 'node', counterItem ? `缺少${ITEMS[counterItem].name}。` : '该陷阱没有道具破解方式。'));
    actions.push(commandAction(`node.trap:${node.id}:risk`, '强行通过', 'node', { type: 'node/handle-trap', choice: 'risk' }, { emphasis: 'danger', recommendation: 'high-risk', riskReason: `失败可能承受 ${node.trap?.damage ?? 0} 点伤害。` }));
  } else if (node.type === 'portal') {
    const stableItem = node.portal?.stableItem;
    const canStabilize = stableItem ? (state.inventory[stableItem] ?? 0) > 0 : false;
    actions.push(canStabilize
      ? commandAction(`node.portal:${node.id}:stabilize`, `使用${ITEMS[stableItem!].name}稳定`, 'node', { type: 'node/use-portal', choice: 'stabilize' }, { recommendation: 'recommended' })
      : disabledAction(`node.portal:${node.id}:stabilize`, '稳定传送', 'node', stableItem ? `缺少${ITEMS[stableItem].name}。` : '该传送门没有稳定方式。'));
    actions.push(commandAction(`node.portal:${node.id}:force`, '强闯传送', 'node', { type: 'node/use-portal', choice: 'force' }, { emphasis: 'danger', recommendation: 'high-risk', riskReason: '强闯会承受传送反噬。' }));
  } else if (node.type === 'reward') {
    actions.push(commandAction(`node.reward:${node.id}`, '领取奖励', 'node', { type: 'node/collect-reward' }, { emphasis: 'primary', recommendation: 'recommended' }));
  } else {
    const seal = getBossSealStatus(state, run.dungeonId);
    actions.push(seal && !seal.cleared
      ? disabledAction(`node.exit:${node.id}`, '出口结算', 'node', seal.requirementText, { emphasis: 'primary' })
      : commandAction(`node.exit:${node.id}`, '出口结算', 'node', { type: 'run/resolve-exit' }, { emphasis: 'primary', recommendation: 'recommended' }));
  }
  actions.push(...buildSoulRechargeActivationActions(state));
  actions.push(...buildSoulSkillActions(state, 'advanced'));
  return actions;
}

function buildEquipmentMemoryHuntProjection(
  state: GameState
): EquipmentMemoryHuntViewModel | undefined {
  const current = getCurrentEquipmentMemoryHuntStatus(state);
  if (!current.enabled && !current.malformedDisabled) return undefined;
  const hunt = current.malformedDisabled ? undefined : current.state;
  const definition = hunt ? current.definition : undefined;
  const nodeTitle = hunt
    ? DUNGEONS[hunt.dungeonId].nodes.find((node) => node.id === hunt.nodeId)?.title
      ?? hunt.nodeId
    : undefined;
  const signals: EquipmentMemoryHuntViewModel['signals'] = hunt && definition && nodeTitle
    ? [
        {
          type: 'node',
          label: '目标节点',
          targetId: hunt.nodeId,
          targetName: nodeTitle,
          completed: current.progress.nodeCleared
        },
        {
          type: 'event',
          label: '目标事件',
          targetId: hunt.eventId,
          targetName: `事件 ID · ${hunt.eventId}`,
          completed: current.progress.eventSucceeded
        }
      ]
    : [];
  const nextTarget: EquipmentMemoryHuntViewModel['nextTarget'] = current.malformedDisabled
    ? { kind: 'blocked', label: '狩猎快照格式异常，已停止投影任务目标。' }
    : current.progress.status === 'active'
      ? !current.progress.nodeCleared
        ? { kind: 'node', label: `节点 · ${nodeTitle ?? '未知节点'}` }
        : !current.progress.eventSucceeded
          ? { kind: 'event', label: `事件 ID · ${hunt?.eventId ?? '未知事件'}` }
          : { kind: 'exit', label: '前往出口结算' }
      : current.progress.status === 'secured'
        ? { kind: 'exit', label: '双信号已完成，前往出口结算' }
        : current.progress.status === 'banked'
          ? { kind: 'resolved', label: '已写入装备记忆库' }
          : { kind: 'blocked', label: current.display.detail };
  return {
    helpId: 'equipmentMemory',
    compatibility: current.malformedDisabled
      ? 'malformed'
      : current.legacyDisabled
        ? 'imported-legacy-hunt'
        : 'current-legacy-hunt',
    enabled: current.enabled && !current.malformedDisabled,
    legacyDisabled: current.legacyDisabled,
    malformedDisabled: current.malformedDisabled,
    display: current.malformedDisabled
      ? {
          key: 'disabled',
          label: '装备记忆异常',
          detail: '狩猎或结算证据格式异常，未投影 legacy 任务。'
        }
      : {
          key: current.display.key,
          label: current.display.label,
          detail: current.display.detail
        },
    ...(definition
      ? {
          memory: {
            memoryId: definition.id,
            name: definition.name,
            description: definition.description
          }
        }
      : {}),
    ...(hunt && current.equipment
      ? {
          equipment: {
            equipmentId: hunt.equipmentId,
            name: current.equipment.name
          }
        }
      : {}),
    ...(hunt && current.attunement
      ? {
          frozenAttunement: {
            attunementId: hunt.attunementId,
            name: current.attunement.name
          }
        }
      : {}),
    signals,
    completedConditionCount: current.malformedDisabled
      ? 0
      : current.progress.completedConditionCount,
    totalConditionCount: current.progress.totalConditionCount,
    nextTarget,
    ...(!current.malformedDisabled && current.progress.reason
      ? { failureReason: current.progress.reason }
      : {})
  };
}

function buildChapterLawCard(state: GameState): ChapterLawCardViewModel {
  const law = getCurrentDungeonLaw(state);
  if (!law) {
    return {
      present: false,
      title: '场域律动缺失',
      status: '本轮未记录场域律',
      severity: 'stable',
      targetReached: false,
      modifiers: {
        encounter: { allStatsPercent: 0, defensePercent: 0, artPowerPercent: 0 },
        trap: { damagePercent: 0, dcPercent: 0 },
        healingPercent: 0,
        outgoingDamage: { forcePercent: 0, artPercent: 0 },
        guardEffectPercent: 0
      }
    };
  }
  const { display } = law;
  const modifiers = display.modifiers;
  return {
    present: true,
    title: display.title,
    status: display.status,
    severity: display.severity,
    ...(display.meter ? { meter: { value: display.meter.value, max: display.meter.max } } : {}),
    targetReached: display.targetReached,
    modifiers: {
      encounter: {
        allStatsPercent: modifiers.encounter.allStatsPercent,
        defensePercent: modifiers.encounter.defensePercent,
        artPowerPercent: modifiers.encounter.artPowerPercent
      },
      trap: {
        damagePercent: modifiers.trap.damagePercent,
        dcPercent: modifiers.trap.dcPercent
      },
      healingPercent: modifiers.healingPercent,
      outgoingDamage: {
        forcePercent: modifiers.outgoingDamage.forcePercent,
        artPercent: modifiers.outgoingDamage.artPercent
      },
      guardEffectPercent: modifiers.guardEffectPercent
    }
  };
}

function buildChapterDirective(state: GameState): ChapterDirectiveViewModel {
  const evaluation = getDirectiveEvaluation(state);
  return {
    status: evaluation.status,
    progressText: evaluation.progressText,
    rewardPreview: evaluation.rewardPreview,
    objectives: evaluation.objectiveResults.map((objective) => ({
      id: objective.id,
      kind: objective.kind,
      label: objective.label,
      description: objective.description,
      completed: objective.completed,
      progressText: objective.progressText
    }))
  };
}

const ROUTE_CONTRACT_COMPLETED_READOUTS: Readonly<Record<0 | 1 | 2, '0 / 2' | '1 / 2' | '2 / 2'>> =
  Object.freeze({ 0: '0 / 2', 1: '1 / 2', 2: '2 / 2' });

function buildChapterRouteContract(state: GameState): ChapterRouteContractViewModel {
  const contract = getCurrentRouteContract(state);
  const { progress, display } = contract;
  const definition = progress.definition;
  const dungeon = definition ? DUNGEONS[definition.dungeonId] : undefined;
  const targetTitle = (nodeId: string): string =>
    dungeon?.nodes.find((node) => node.id === nodeId)?.title ?? nodeId;
  const orderedTargets: ChapterRouteContractViewModel['orderedTargets'] = definition
    ? definition.targetNodeIds.map((nodeId, index) => ({
        order: (index + 1) as 1 | 2,
        nodeId,
        nodeTitle: targetTitle(nodeId)
      }))
    : [];
  const nextTarget = progress.nextTargetNodeId !== undefined
    ? orderedTargets.find((target) => target.nodeId === progress.nextTargetNodeId)
    : undefined;
  // `progress.status` is 'disabled' when no contract is active; otherwise a real run status.
  const status: ChapterRouteContractViewModel['status'] =
    progress.status === 'disabled' ? 'disabled' : progress.status;
  return {
    enabled: progress.enabled,
    legacyDisabled: contract.legacyDisabled,
    status,
    display: { key: display.key, label: display.label, detail: display.detail },
    ...(definition ? { name: definition.name, description: definition.description } : {}),
    completedTargetCount: progress.completedTargetCount,
    totalTargetCount: progress.totalTargetCount,
    completedReadout: ROUTE_CONTRACT_COMPLETED_READOUTS[progress.completedTargetCount],
    orderedTargets,
    ...(nextTarget ? { nextTarget } : {}),
    potentialRewardPoints: progress.potentialRewardPoints,
    bankedRewardPoints: progress.bankedRewardPoints,
    ...(progress.reason ? { reason: progress.reason } : {})
  };
}

function buildChapterPressure(state: GameState): ChapterPressureViewModel {
  const pressure = getCurrentRunPressure(state);
  if (pressure.legacyDisabled) return { legacyDisabled: true, present: false };
  if (!pressure.status) return { legacyDisabled: false, present: false };
  const { status } = pressure;
  return {
    legacyDisabled: false,
    present: true,
    tier: status.tier,
    label: status.label,
    pressurePercent: status.pressurePercent,
    rewardBonusPercent: status.rewardBonusPercent,
    nextTierAt: status.nextTierAt
  };
}

function buildChapterPursuit(state: GameState): ChapterPursuitViewModel {
  const pursuit = getCurrentRunPursuit(state);
  if (!pursuit.definition || !pursuit.display || !pursuit.progress) {
    // No pursuit defined for this chapter, or the run predates the pursuit snapshot.
    return { legacyDisabled: pursuit.legacyDisabled, present: false };
  }
  const { display, progress } = pursuit;
  return {
    legacyDisabled: pursuit.legacyDisabled,
    present: true,
    name: display.name,
    status: display.status,
    statusLabel: display.statusLabel,
    statusDescription: display.statusDescription,
    flavorDescription: display.flavorDescription,
    fusionDescription: display.fusionDescription,
    contactDamagePercent: display.contactDamagePercent,
    bossFusionPercent: display.bossFusionPercent,
    rewardAmount: display.rewardAmount,
    progress: {
      active: progress.active,
      currentNodeId: progress.currentNodeId,
      contacts: progress.contacts,
      graceMoves: progress.graceMoves,
      rewardGranted: progress.rewardGranted,
      repelledReason: progress.repelledReason,
      clearedNodeCount: progress.clearedNodeCount,
      spawnClearCount: progress.spawnClearCount,
      clearsRemaining: progress.clearsRemaining
    }
  };
}

function buildChapterDecision(state: GameState, dungeonId: DungeonId, dungeonName: string): ChapterDecisionViewModel {
  return {
    dungeonId,
    dungeonName,
    law: buildChapterLawCard(state),
    directive: buildChapterDirective(state),
    routeContract: buildChapterRouteContract(state),
    pressure: buildChapterPressure(state),
    pursuit: buildChapterPursuit(state)
  };
}

/**
 * Read-only combat chapter context. Every number is copied from the public core law/pursuit
 * selectors; the presentation layer never recomputes modifiers or pursuit rules. A missing law
 * or pursuit snapshot fails closed to `present: false` with zeroed modifiers, never inventing
 * titles, percentages, or rewards.
 */
function buildCombatChapterContext(state: GameState): CombatChapterContextViewModel | undefined {
  if (!state.run) return undefined;
  const dungeon = getCurrentDungeonDefinition(state) ?? DUNGEONS[state.run.dungeonId];
  const law = getCurrentDungeonLaw(state);
  const pursuit = getCurrentRunPursuit(state);
  const lawContext: CombatChapterContextViewModel['law'] = law
    ? {
        present: true,
        title: law.display.title,
        status: law.display.status,
        severity: law.display.severity,
        ...(law.display.meter ? { meter: { value: law.display.meter.value, max: law.display.meter.max } } : {}),
        modifiers: {
          enemyAllStatsPercent: law.display.modifiers.encounter.allStatsPercent,
          enemyDefensePercent: law.display.modifiers.encounter.defensePercent,
          enemyArtPowerPercent: law.display.modifiers.encounter.artPowerPercent,
          outgoingForcePercent: law.display.modifiers.outgoingDamage.forcePercent,
          outgoingArtPercent: law.display.modifiers.outgoingDamage.artPercent,
          healingPercent: law.display.modifiers.healingPercent,
          guardEffectPercent: law.display.modifiers.guardEffectPercent
        }
      }
    : {
        present: false,
        title: '场域律动缺失',
        status: '本轮未记录场域律',
        severity: 'stable',
        modifiers: {
          enemyAllStatsPercent: 0,
          enemyDefensePercent: 0,
          enemyArtPowerPercent: 0,
          outgoingForcePercent: 0,
          outgoingArtPercent: 0,
          healingPercent: 0,
          guardEffectPercent: 0
        }
      };
  const pursuitContext: CombatChapterContextViewModel['pursuit'] = !pursuit.definition || !pursuit.display
    ? { legacyDisabled: pursuit.legacyDisabled, present: false }
    : {
        legacyDisabled: pursuit.legacyDisabled,
        present: true,
        name: pursuit.display.name,
        status: pursuit.display.status,
        statusLabel: pursuit.display.statusLabel,
        contactDamagePercent: pursuit.display.contactDamagePercent,
        bossFusionPercent: pursuit.display.bossFusionPercent
      };
  return {
    dungeonId: dungeon.id,
    dungeonName: dungeon.name,
    law: lawContext,
    pursuit: pursuitContext
  };
}

function buildExploreProjection(state: GameState): PhaseProjection {
  if (!state.run) {
    const detail: ExploreDetailViewModel = {
      kind: 'explore',
      map: { dungeonId: FIRST_DUNGEON_ID, dungeonName: '无进行中副本', width: 0, height: 0, currentNodeId: '', nodes: [] },
      currentNode: { nodeId: '', title: '状态缺失', nodeType: 'exit', description: '副本状态缺失。', cleared: false }
    };
    return {
      title: '探索状态异常',
      objective: { kind: 'objective', title: '等待恢复', summary: '当前 explore phase 缺少 run 快照。' },
      status: { kind: 'status', metrics: [], detail },
      actions: [],
      risks: [{ id: 'missing-run', severity: 'danger', label: '状态缺失', reason: '宿主应恢复最近一次有效快照。' }],
      logs: state.log.slice(0, 12)
    };
  }
  const dungeon = getCurrentDungeonDefinition(state) ?? DUNGEONS[state.run.dungeonId];
  const currentNode = dungeon.nodes.find((node) => node.id === state.run!.currentNodeId)!;
  const { map, movementActions } = buildMap(state);
  const pendingProjection = buildPendingProjection(state);
  const eventPending = pendingProjection.pending?.kind === 'dungeon-event';
  const nodeActions = !pendingProjection.pending || eventPending ? buildCurrentNodeActions(state) : [];
  const retreat = commandAction(
    'run.retreat', '撤回主神空间', 'advanced', { type: 'run/retreat' },
    { emphasis: 'danger', riskReason: '撤退会按当前固化进度损失部分或全部未结算战利品。' }
  );
  const actions = eventPending
    ? mergeUniqueActionsEnabledFirst([
        pendingProjection.actions,
        nodeActions,
        movementActions,
        [retreat]
      ])
    : [...movementActions, ...pendingProjection.actions, ...nodeActions, retreat];
  const guide = getExplorationGuide(state);
  const pressure = getCurrentRunPressure(state);
  const law = getCurrentDungeonLaw(state);
  const seal = getBossSealStatus(state, state.run.dungeonId);
  const loot = state.run.lootBag;
  const equipmentMemoryHunt = buildEquipmentMemoryHuntProjection(state);
  const chapterDecision = buildChapterDecision(state, dungeon.id, dungeon.name);
  const detail: ExploreDetailViewModel = {
    kind: 'explore',
    map,
    currentNode: {
      nodeId: currentNode.id,
      title: currentNode.title,
      nodeType: currentNode.type,
      description: currentNode.description,
      cleared: state.run.clearedNodeIds.includes(currentNode.id)
    },
    chapterDecision,
    ...(pendingProjection.pending ? { pending: pendingProjection.pending } : {}),
    ...(equipmentMemoryHunt ? { equipmentMemoryHunt } : {})
  };
  const lootPoints = loot.rewardPoints ?? 0;
  const metrics: StatusMetric[] = [
    { id: 'hp', label: '生命', value: `${state.player.hp}/${state.player.maxHp}`, symbol: '♥', severity: state.player.hp <= state.player.maxHp * 0.3 ? 'danger' : 'neutral' },
    { id: 'loot', label: '袋中奖励点', value: String(lootPoints), symbol: '袋', severity: lootPoints > 0 ? 'positive' : 'neutral' },
    { id: 'cleared', label: '已清理', value: `${state.run.clearedNodeIds.length}/${dungeon.nodes.length}`, symbol: '✓', severity: 'neutral' },
    { id: 'pressure', label: '侵蚀', value: pressure.status?.label ?? (pressure.legacyDisabled ? '旧档禁用' : '稳定'), symbol: '侵', severity: pressure.status?.tier === 'breach' ? 'danger' : pressure.status?.tier === 'hunted' ? 'warning' : 'neutral' },
    { id: 'boss-seal', label: '出口封印', value: seal?.cleared ? '1/1 已解除' : '0/1 未解除', symbol: seal?.cleared ? '✓' : '锁', severity: seal?.cleared ? 'positive' : 'warning' },
    ...(equipmentMemoryHunt
      ? [{
          id: 'equipment-memory-hunt',
          label: '装备记忆',
          value: equipmentMemoryHunt.display.label,
          symbol: equipmentMemoryHunt.malformedDisabled ? '!' : '忆',
          severity: equipmentMemoryHunt.malformedDisabled || equipmentMemoryHunt.display.key === 'failed' || equipmentMemoryHunt.display.key === 'lost'
            ? 'danger' as const
            : equipmentMemoryHunt.display.key === 'secured' || equipmentMemoryHunt.display.key === 'banked'
              ? 'positive' as const
              : 'neutral' as const
        }]
      : []),
    ...(law ? [{ id: 'law', label: law.display.title, value: law.display.status, symbol: '律', severity: law.display.severity === 'danger' ? 'danger' as const : law.display.severity === 'warning' ? 'warning' as const : law.display.severity === 'resolved' ? 'positive' as const : 'neutral' as const }] : [])
  ];
  const risks: RiskItem[] = [];
  if (state.player.hp <= state.player.maxHp * 0.3) risks.push({ id: 'low-hp', severity: 'danger', label: '生命危险', reason: '当前生命低于或等于 30%，继续探索可能触发强制回收。' });
  if (equipmentMemoryHunt?.malformedDisabled) risks.push({
    id: 'equipment-memory-malformed',
    severity: 'danger',
    label: '装备记忆快照异常',
    reason: '已按 fail-closed 停止投影 legacy 双信号；不要把异常状态当作现代记忆任务。'
  });
  return {
    title: `${dungeon.name} · 探索`,
    visualAssetKey: verifiedVisualAssetKey('dungeon', state.run.dungeonId),
    objective: {
      kind: 'objective',
      title: guide?.eyebrow ?? '探索目标',
      summary: [guide?.instruction ?? '处理当前节点并推进路线。', guide?.detail].filter(Boolean).join(' — ')
    },
    status: { kind: 'status', metrics, detail },
    actions,
    risks,
    logs: [...state.run.eventLog, ...state.log].slice(0, 12)
  };
}

const COMBAT_ACTION_LABELS: Readonly<Record<CombatAction, string>> = {
  attack: '普通攻击',
  art: '术法攻击',
  guard: '防御',
  weapon_skill: '武器战技',
  use_healing_pill: '使用止血丹',
  use_thunder_talisman: '使用雷火符',
  escape: '脱离当前战斗'
};

function getCombatActionAvailability(state: GameState, action: CombatAction): Readonly<{ available: boolean; reason?: string }> {
  if (action === 'attack' && !isCurrentDungeonFeatureAvailable(state, 'attack')) return { available: false, reason: '当前场域封存了普通攻击。' };
  if (action === 'art' && !isCurrentDungeonFeatureAvailable(state, 'method')) return { available: false, reason: '当前场域封存了功法与术法。' };
  if (action === 'guard' && !isCurrentDungeonFeatureAvailable(state, 'defense')) return { available: false, reason: '当前场域封存了防御。' };
  if (action === 'weapon_skill') {
    const status = getWeaponSkillStatus(state);
    return { available: status.available, ...(status.unavailableReason ? { reason: status.unavailableReason } : {}) };
  }
  if (action === 'use_healing_pill') return isTacticalItemAvailable(state, 'healing_pill')
    ? { available: true }
    : { available: false, reason: '止血丹库存不足或被场域封存。' };
  if (action === 'use_thunder_talisman') return isTacticalItemAvailable(state, 'thunder_talisman')
    ? { available: true }
    : { available: false, reason: '雷火符未携行（或本局未拾取）、库存不足或被场域封存。' };
  return { available: true };
}

function buildEquipmentMemoryCombatProjection(
  state: GameState
): EquipmentMemoryCombatViewModel | undefined {
  const current = getCurrentEquipmentMemoryCombatStatus(state);
  if (!current.enabled && !current.legacyDisabled && !current.malformedDisabled) return undefined;
  const failClosed = current.legacyDisabled || current.malformedDisabled;
  const status: EquipmentMemoryCombatViewModel['status'] = current.malformedDisabled
    ? 'malformed-disabled'
    : current.legacyDisabled
      ? 'legacy-disabled'
      : 'active';
  const matchingEquipmentIds = failClosed ? [] : [...current.matchingEquipmentIds];
  const overflowStored = !failClosed && current.overflowStored;
  const restored = !failClosed && current.restored;
  return {
    helpId: 'equipmentMemory',
    status,
    enabled: current.enabled && !failClosed,
    ...(!failClosed && current.activeName ? { activeName: current.activeName } : {}),
    ...(!failClosed && current.definition ? { memoryId: current.definition.id } : {}),
    matchingEquipmentIds,
    matchingEquipmentNames: matchingEquipmentIds.map((equipmentId) => EQUIPMENT[equipmentId].name),
    overflowState: restored ? 'restored' : overflowStored ? 'stored' : 'empty',
    overflowStored,
    restored,
    ...(current.malformedDisabled
      ? { disabledReason: '装备记忆快照或战斗状态格式异常，效果已按 fail-closed 禁用。' }
      : current.legacyDisabled
        ? { disabledReason: '导入局缺少装备记忆入场快照，战斗效果已按 fail-closed 禁用。' }
        : {})
  };
}

function buildCombatProjection(state: GameState, localUiState: PresentationLocalUiState): PhaseProjection {
  const profile = getCombatEncounterProfile(state);
  const combat = state.combat;
  if (!combat || !profile) {
    const detail: CombatDetailViewModel = {
      kind: 'combat',
      player: { hp: state.player.hp, maxHp: state.player.maxHp, hpPercent: clampPercent(state.player.hp, state.player.maxHp) },
      enemy: { id: 'missing', name: '未知敌人', hp: 0, maxHp: 1, hpPercent: 0, ability: '战斗快照缺失。' },
      intent: { id: 'missing', name: '未知意图', severity: 'danger', consequence: '宿主应恢复最近一次有效快照。', recommendedActions: [], dangerousActions: [] },
      turn: 0,
      advancedExpanded: Boolean(localUiState.advancedCombatExpanded)
    };
    return {
      title: '战斗状态异常',
      objective: { kind: 'objective', title: '等待恢复', summary: '当前 combat phase 缺少 combat 快照。' },
      status: { kind: 'status', metrics: [], detail },
      actions: [],
      risks: [{ id: 'missing-combat', severity: 'danger', label: '状态缺失', reason: '不要提交战斗动作；先恢复有效状态。' }],
      logs: state.log.slice(0, 12)
    };
  }
  const intent = getCurrentCombatIntent(state) ?? {
    id: 'regular-pursuit' as const,
    name: '常规追击',
    severity: 'normal' as const,
    consequence: '敌人将进行常规反击。',
    recommendedActions: ['guard'] as const,
    dangerousActions: [] as const
  };
  const availability = new Map<CombatAction, Readonly<{ available: boolean; reason?: string }>>();
  const baseActions: CombatAction[] = ['attack', 'art', 'guard', 'weapon_skill', 'use_healing_pill', 'use_thunder_talisman', 'escape'];
  for (const action of baseActions) availability.set(action, getCombatActionAvailability(state, action));
  const usableRecommendation = intent.recommendedActions.find((action) => availability.get(action)?.available);
  const recommendedAction = usableRecommendation ?? (availability.get('guard')?.available ? 'guard' : undefined);
  const actions: ViewActionModel[] = baseActions.map((action) => {
    const status = availability.get(action)!;
    const preview = action === 'attack' || action === 'art' ? getCombatActionDamagePreview(state, action) : undefined;
    const dangerous = intent.dangerousActions.includes(action) || preview?.playerWillFall === true;
    const readout = preview
      ? `预计伤害 ${preview.damage}；敌方余血 ${preview.monsterHpAfter}。${preview.playerWillFall ? ' 行动后将濒死。' : ''}`
      : action === 'weapon_skill'
        ? `战意 ${getWeaponSkillStatus(state).currentFocus}/${getWeaponSkillStatus(state).requiredFocus}`
        : action === 'use_healing_pill' || action === 'use_thunder_talisman'
          ? `库存 ${state.inventory[action === 'use_healing_pill' ? 'healing_pill' : 'thunder_talisman']}`
          : undefined;
    if (!status.available) return disabledAction(`combat.action:${action}`, COMBAT_ACTION_LABELS[action], 'combat', status.reason ?? '当前动作不可用。', { combatAction: action, readout });
    return commandAction(
      `combat.action:${action}`,
      COMBAT_ACTION_LABELS[action],
      'combat',
      { type: 'combat/act', action },
      {
        combatAction: action,
        emphasis: dangerous ? 'danger' : action === recommendedAction ? 'primary' : 'secondary',
        recommendation: dangerous ? 'high-risk' : action === recommendedAction ? 'recommended' : 'neutral',
        ...(dangerous ? { riskReason: preview?.playerWillFall ? '该动作预估会使玩家濒死并触发强制回收。' : intent.consequence } : {}),
        ...(readout ? { readout } : {})
      }
    );
  });

  const capturePetId = getReadyCombatCapturePetId(state);
  if (capturePetId) {
    actions.push(commandAction(
      `combat.capture:${capturePetId}`,
      `捕获${PETS[capturePetId].name}`,
      'combat',
      { type: 'combat/capture', petId: capturePetId },
      { emphasis: 'primary', recommendation: 'recommended', readout: '目标已进入捕获线；继续攻击可能关闭窗口。' }
    ));
  }
  actions.push(localAction(
    'combat.advanced.toggle',
    localUiState.advancedCombatExpanded ? '收起进阶战术' : '展开进阶战术',
    'advanced',
    { type: 'combat/set-advanced-expanded', expanded: !localUiState.advancedCombatExpanded },
    { emphasis: 'quiet' }
  ));
  if (localUiState.advancedCombatExpanded) {
    for (const snapshot of getCurrentRunMethodSnapshots(state)) {
      const status = getCurrentMethodTechniqueStatus(state, snapshot.methodId);
      actions.push(status.available
        ? commandAction(`combat.method:${snapshot.methodId}`, status.definition?.name ?? METHODS[snapshot.methodId].name, 'advanced', { type: 'combat/use-method-technique', methodId: snapshot.methodId })
        : disabledAction(`combat.method:${snapshot.methodId}`, status.definition?.name ?? METHODS[snapshot.methodId].name, 'advanced', status.unavailableReason ?? '功法技当前不可用。'));
    }
    const companion = getCurrentCompanionAssistStatus(state);
    if (companion.snapshot) {
      actions.push(companion.available
        ? commandAction('combat.companion-assist', companion.definition?.assistName ?? '同伴援护', 'advanced', { type: 'combat/use-companion-assist' })
        : disabledAction('combat.companion-assist', companion.definition?.assistName ?? '同伴援护', 'advanced', companion.unavailableReason ?? '同伴援护当前不可用。'));
    }
    const bloodline = getCurrentBloodlineSurgeStatus(state);
    if (bloodline.snapshot) {
      actions.push(bloodline.available
        ? commandAction('combat.bloodline-surge', '血统爆发', 'advanced', { type: 'combat/use-bloodline-surge' })
        : disabledAction('combat.bloodline-surge', '血统爆发', 'advanced', bloodline.unavailableReason ?? '血统爆发当前不可用。'));
    }
    actions.push(...buildSoulSkillActions(state, 'advanced'));
    actions.push(commandAction('combat.retreat-run', '放弃本轮并回收', 'advanced', { type: 'run/retreat' }, { emphasis: 'danger', riskReason: '该动作结束整轮副本，并按撤退规则结算战利品。' }));
  }

  const maxHp = profile.monster.maxHp;
  const equipmentMemory = buildEquipmentMemoryCombatProjection(state);
  const chapterContext = buildCombatChapterContext(state);
  const detail: CombatDetailViewModel = {
    kind: 'combat',
    player: { hp: state.player.hp, maxHp: state.player.maxHp, hpPercent: clampPercent(state.player.hp, state.player.maxHp) },
    enemy: {
      id: profile.monster.id,
      name: profile.monster.name,
      hp: combat.monsterHp,
      maxHp,
      hpPercent: clampPercent(combat.monsterHp, maxHp),
      ability: profile.monster.ability
    },
    intent: {
      id: intent.id,
      name: intent.name,
      severity: intent.severity,
      consequence: intent.consequence,
      recommendedActions: [...intent.recommendedActions],
      dangerousActions: [...intent.dangerousActions]
    },
    ...(profile.boss ? {
      boss: {
        phase: profile.boss.phase,
        phaseLabel: profile.boss.phase === 'sealed' ? '封印阶段' : profile.boss.definition.awakenedPhaseName,
        title: profile.boss.definition.bossTitle,
        sealName: profile.boss.definition.sealName
      }
    } : {}),
    turn: combat.turn,
    advancedExpanded: Boolean(localUiState.advancedCombatExpanded),
    ...(chapterContext ? { chapterContext } : {}),
    ...(equipmentMemory ? { equipmentMemory } : {})
  };
  const stats = getDerivedStats(state);
  const metrics: StatusMetric[] = [
    { id: 'player-hp', label: '我方生命', value: `${state.player.hp}/${state.player.maxHp}`, symbol: '我', severity: state.player.hp <= state.player.maxHp * 0.3 ? 'danger' : 'neutral' },
    { id: 'enemy-hp', label: '敌方生命', value: `${combat.monsterHp}/${maxHp}`, symbol: '敌', severity: combat.monsterHp <= maxHp * 0.3 ? 'positive' : 'warning' },
    { id: 'turn', label: '回合', value: String(combat.turn), symbol: '回', severity: 'neutral' },
    { id: 'attack', label: '攻击/术强', value: `${stats.attack}/${stats.artPower}`, symbol: '攻', severity: 'neutral' },
    { id: 'intent', label: '敌方意图', value: intent.name, symbol: intent.severity === 'danger' ? '!' : '眼', severity: intent.severity === 'danger' ? 'danger' : intent.severity === 'warning' ? 'warning' : 'neutral' },
    ...(equipmentMemory
      ? [{
          id: 'equipment-memory',
          label: '装备记忆',
          value: equipmentMemory.enabled
            ? `${equipmentMemory.activeName ?? '生效'} · ${equipmentMemory.overflowState === 'restored' ? '已恢复' : equipmentMemory.overflowState === 'stored' ? '已储存' : '待触发'}`
            : '已禁用',
          symbol: equipmentMemory.enabled ? '忆' : '!',
          severity: equipmentMemory.enabled ? 'positive' as const : 'danger' as const
        }]
      : []),
    ...(profile.boss ? [{ id: 'boss-phase', label: '首领阶段', value: profile.boss.phase === 'sealed' ? '封印阶段' : profile.boss.definition.awakenedPhaseName, symbol: profile.boss.phase === 'sealed' ? '锁' : '醒', severity: profile.boss.phase === 'awakened' ? 'danger' as const : 'warning' as const }] : [])
  ];
  const guide = getExplorationGuide(state);
  const risks: RiskItem[] = [
    ...(intent.severity === 'danger' ? [{ id: `intent:${intent.id}`, severity: 'danger' as const, label: `危险意图：${intent.name}`, reason: intent.consequence }] : []),
    ...(state.player.hp <= state.player.maxHp * 0.3 ? [{ id: 'low-hp', severity: 'danger' as const, label: '生命危险', reason: '当前生命低于或等于 30%。' }] : []),
    ...(chapterContext?.law.present && chapterContext.law.severity === 'danger'
      ? [{
          id: 'combat-law-danger',
          severity: 'danger' as const,
          label: `场域危险：${chapterContext.law.title}`,
          reason: `${chapterContext.law.status}；敌方属性与我方输出/治疗已按场域律结算，详见法则帮助。`
        }]
      : []),
    ...(chapterContext?.pursuit.present && (chapterContext.pursuit.status === 'stalking' || chapterContext.pursuit.status === 'fused')
      ? [{
          id: 'combat-pursuit-active',
          severity: (chapterContext.pursuit.status === 'fused' ? 'danger' : 'warning') as 'danger' | 'warning',
          label: `追兵：${chapterContext.pursuit.name ?? chapterContext.pursuit.statusLabel ?? '未知'}`,
          reason: chapterContext.pursuit.status === 'fused'
            ? `追兵已与首领融合（首领强化 +${chapterContext.pursuit.bossFusionPercent ?? 0}%）。`
            : `追兵追踪中；节点接触将造成 ${chapterContext.pursuit.contactDamagePercent ?? 0}% 生命伤害。`
        }]
      : [])
  ];
  return {
    title: `${profile.monster.name} · 战斗`,
    visualAssetKey: verifiedVisualAssetKey('monster', profile.monster.id),
    objective: {
      kind: 'objective',
      title: guide?.eyebrow ?? '本回合目标',
      summary: [guide?.instruction ?? `应对${intent.name}。`, guide?.detail ?? intent.consequence].filter(Boolean).join(' — ')
    },
    status: { kind: 'status', metrics, detail },
    actions,
    risks,
    logs: [...combat.log, ...state.log].slice(0, 12)
  };
}

function buildEquipmentMemoryResultProjection(
  state: GameState
): EquipmentMemoryResultViewModel | undefined {
  const run = state.run;
  if (!run) return undefined;
  const huntStatus = getCurrentEquipmentMemoryHuntStatus(state);
  const settlement = huntStatus.settlement;
  const hunt = settlement?.state;
  const definition = hunt ? getEquipmentMemoryForDungeon(hunt.dungeonId) : undefined;
  const legacyHunt = settlement && hunt && definition
    ? {
        granted: settlement.granted,
        status: hunt.status,
        ...(hunt.reason ? { reason: hunt.reason } : {}),
        dungeonId: hunt.dungeonId,
        dungeonName: DUNGEONS[hunt.dungeonId].name,
        equipmentId: hunt.equipmentId,
        equipmentName: EQUIPMENT[hunt.equipmentId].name,
        memoryId: hunt.memoryId,
        memoryName: definition.name,
        displayLabel: huntStatus.display.label,
        displayDetail: huntStatus.display.detail,
        rewardReadout: settlement.granted
          ? `${definition.name}已收录至${EQUIPMENT[hunt.equipmentId].name}并自动激活；额外奖励点、灵蕴与物品均为 0。`
          : `${definition.name}未收录，本局记忆不入库；${huntStatus.display.detail}`
      }
    : undefined;
  const modernDefinition = run.entryFlowVersion === 2
    ? getEquipmentMemoryForDungeon(run.dungeonId)
    : undefined;
  let modernLibrary: EquipmentMemoryModernLibraryResultViewModel | undefined;
  if (modernDefinition) {
    const statuses = (Object.keys(EQUIPMENT) as EquipmentId[])
      .map((equipmentId) => getEquipmentMemoryStatus(state, equipmentId))
      .filter(({ supported, owned }) => supported && owned);
    const recordedStatuses = statuses.filter(({ unlockedMemories }) =>
      unlockedMemories.some(({ id }) => id === modernDefinition.id)
    );
    const activeStatuses = recordedStatuses.filter(
      ({ activeMemory }) => activeMemory?.id === modernDefinition.id
    );
    const modernStatus: EquipmentMemoryModernLibraryResultViewModel['status'] =
      activeStatuses.length > 0
        ? 'active'
        : recordedStatuses.length > 0
          ? 'recorded'
          : 'not-recorded';
    const recordedEquipmentIds = recordedStatuses.map(({ equipmentId }) => equipmentId);
    const activeEquipmentIds = activeStatuses.map(({ equipmentId }) => equipmentId);
    modernLibrary = {
      dungeonId: run.dungeonId,
      dungeonName: DUNGEONS[run.dungeonId].name,
      memoryId: modernDefinition.id,
      memoryName: modernDefinition.name,
      status: modernStatus,
      recordedEquipmentIds,
      recordedEquipmentNames: recordedEquipmentIds.map((equipmentId) => EQUIPMENT[equipmentId].name),
      activeEquipmentIds,
      activeEquipmentNames: activeEquipmentIds.map((equipmentId) => EQUIPMENT[equipmentId].name),
      readout: modernStatus === 'active'
        ? `本章记忆「${modernDefinition.name}」已收录，并在${activeEquipmentIds.map((equipmentId) => EQUIPMENT[equipmentId].name).join('、')}激活。`
        : modernStatus === 'recorded'
          ? `本章记忆「${modernDefinition.name}」已收录；当前装备记忆库未将其设为激活记忆。`
          : `当前装备记忆库尚未收录本章记忆「${modernDefinition.name}」。`
    };
  }
  if (!legacyHunt && !modernLibrary) return undefined;
  return {
    helpId: 'equipmentMemory',
    ...(legacyHunt ? { legacyHunt } : {}),
    ...(modernLibrary ? { modernLibrary } : {})
  };
}

const RUN_OUTCOME_LABELS: Readonly<Record<RunOutcome, string>> = {
  clean_clear: '完美撤离',
  normal_clear: '稳定通关',
  retreat: '主动撤退',
  failed_recovered: '濒死回收'
};

function readOutcomeReadout(
  lastOutcome: string | undefined
): { label: string; severity: 'positive' | 'warning' | 'danger' | 'neutral' } {
  const token = lastOutcome?.match(/outcome=([a-z_]+)/)?.[1] as RunOutcome | undefined;
  if (token && Object.prototype.hasOwnProperty.call(RUN_OUTCOME_LABELS, token)) {
    return {
      label: RUN_OUTCOME_LABELS[token],
      severity: token === 'failed_recovered'
        ? 'danger'
        : token === 'retreat'
          ? 'warning'
          : 'positive'
    };
  }
  return { label: '本轮已结算', severity: 'neutral' };
}

function isSettlementRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function knownItemName(id: unknown): string | undefined {
  if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(ITEMS, id)) return undefined;
  const name = ITEMS[id as ItemId].name;
  return typeof name === 'string' && name.length > 0 ? name : undefined;
}

function knownEquipmentName(id: unknown): string | undefined {
  if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(EQUIPMENT, id)) return undefined;
  const name = EQUIPMENT[id as EquipmentId].name;
  return typeof name === 'string' && name.length > 0 ? name : undefined;
}

function knownDungeonId(id: unknown): id is DungeonId {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(DUNGEONS, id);
}

function invalidSettlement(card: ResultSettlementCard, diagnostic: string): ResultSettlementInvalid {
  return Object.freeze({ state: 'invalid', card, diagnostic });
}

type LootBagSnapshot = Readonly<{
  rewardPoints: number;
  lingyun: number;
  itemCount: number;
  equipmentNames: readonly string[];
}>;

function parseLootBag(bag: unknown): LootBagSnapshot | undefined {
  if (!isSettlementRecord(bag)) return undefined;
  if (!isNonNegativeInteger(bag.rewardPoints) || !isNonNegativeInteger(bag.lingyun)) return undefined;
  if (!isSettlementRecord(bag.items)) return undefined;
  let itemCount = 0;
  for (const [itemId, count] of Object.entries(bag.items)) {
    if (knownItemName(itemId) === undefined) return undefined;
    if (!isNonNegativeInteger(count)) return undefined;
    itemCount += count;
  }
  if (!Array.isArray(bag.equipmentIds)) return undefined;
  const equipmentNames: string[] = [];
  for (const equipmentId of bag.equipmentIds) {
    const name = knownEquipmentName(equipmentId);
    if (name === undefined) return undefined;
    equipmentNames.push(name);
  }
  return {
    rewardPoints: bag.rewardPoints,
    lingyun: bag.lingyun,
    itemCount,
    equipmentNames
  };
}

function buildResultLootSettlement(
  run: GameState['run']
): ResultLootSettlementViewModel | undefined {
  const loot: unknown = run?.lastLootSettlement;
  if (loot === undefined) return undefined;
  try {
    if (!isSettlementRecord(loot)) return invalidSettlement('loot', '战利品结算记录不完整');
    const retained = parseLootBag(loot.retained);
    const lost = parseLootBag(loot.lost);
    if (!retained || !lost) return invalidSettlement('loot', '战利品结算记录不可用');
    return Object.freeze({
      state: 'valid',
      retainedRewardPoints: retained.rewardPoints,
      retainedLingyun: retained.lingyun,
      retainedItemCount: retained.itemCount,
      retainedEquipmentCount: retained.equipmentNames.length,
      retainedEquipmentNames: retained.equipmentNames,
      lostRewardPoints: lost.rewardPoints,
      lostLingyun: lost.lingyun,
      lostItemCount: lost.itemCount,
      lostEquipmentCount: lost.equipmentNames.length,
      lostEquipmentNames: lost.equipmentNames
    });
  } catch {
    return invalidSettlement('loot', '战利品结算记录不可用');
  }
}

const EQUIPMENT_ROLL_OUTCOME_LABELS: Readonly<Record<'acquired' | 'upgraded' | 'salvaged', string>> = {
  acquired: '获得',
  upgraded: '升级',
  salvaged: '分解'
};

function buildResultEquipmentRollSettlement(
  run: GameState['run']
): ResultEquipmentRollSettlementViewModel | undefined {
  const roll: unknown = run?.lastEquipmentRollSettlement;
  if (roll === undefined) return undefined;
  try {
    if (!isSettlementRecord(roll)) return invalidSettlement('equipment-roll', '装备铭刻结算记录不可用');
    const equipmentName = knownEquipmentName(roll.equipmentId);
    if (equipmentName === undefined) return invalidSettlement('equipment-roll', '装备铭刻结算记录不可用');
    if (!isEquipmentRoll(roll.roll)) return invalidSettlement('equipment-roll', '装备铭刻结算记录不可用');
    const outcome = roll.outcome;
    if (outcome !== 'acquired' && outcome !== 'upgraded' && outcome !== 'salvaged') {
      return invalidSettlement('equipment-roll', '装备铭刻结算记录不可用');
    }
    if (!isNonNegativeInteger(roll.salvageRewardPoints)) {
      return invalidSettlement('equipment-roll', '装备铭刻结算记录不可用');
    }
    if (roll.previousItemPower !== undefined && !isNonNegativeInteger(roll.previousItemPower)) {
      return invalidSettlement('equipment-roll', '装备铭刻结算记录不可用');
    }
    // Core only pays salvage points when the duplicate was actually salvaged.
    if (outcome !== 'salvaged' && roll.salvageRewardPoints !== 0) {
      return invalidSettlement('equipment-roll', '装备铭刻结算记录不可用');
    }
    return Object.freeze({
      state: 'valid',
      equipmentName,
      outcomeLabel: EQUIPMENT_ROLL_OUTCOME_LABELS[outcome],
      ...(roll.previousItemPower !== undefined ? { previousItemPower: roll.previousItemPower } : {}),
      salvageRewardPoints: roll.salvageRewardPoints
    });
  } catch {
    return invalidSettlement('equipment-roll', '装备铭刻结算记录不可用');
  }
}

const PROTOCOL_STATUS_LABELS: Readonly<Record<'succeeded' | 'failed', string>> = {
  succeeded: '成功',
  failed: '失败'
};

function buildResultProtocolSettlement(
  run: GameState['run']
): ResultProtocolSettlementViewModel | undefined {
  const protocol: unknown = run?.lastProtocolSettlement;
  if (protocol === undefined || !run) return undefined;
  try {
    if (!isSettlementRecord(protocol)) return invalidSettlement('protocol', '协议结算记录不可用');
    const snapshot = protocol.protocol;
    if (!isSettlementRecord(snapshot) || typeof snapshot.id !== 'string') {
      return invalidSettlement('protocol', '协议结算记录不可用');
    }
    const definition = getRunProtocolDefinition(run.dungeonId, snapshot.id as RunProtocolId);
    if (!definition) return invalidSettlement('protocol', '协议结算记录不可用');
    const status = protocol.status;
    if (status !== 'succeeded' && status !== 'failed') {
      return invalidSettlement('protocol', '协议结算记录不可用');
    }
    if (!isNonNegativeInteger(protocol.baseRewardPoints)
      || !isNonNegativeInteger(protocol.protocolRewardPoints)
      || !isNonNegativeInteger(protocol.rewardPointBonus)) {
      return invalidSettlement('protocol', '协议结算记录不可用');
    }
    if (typeof protocol.bossDefeated !== 'boolean'
      || typeof protocol.cycleImprintGranted !== 'boolean') {
      return invalidSettlement('protocol', '协议结算记录不可用');
    }
    // Core zeroes the protocol bonus on failure.
    if (status === 'failed' && protocol.rewardPointBonus !== 0) {
      return invalidSettlement('protocol', '协议结算记录不可用');
    }
    let materialRewardName: string | undefined;
    let materialRewardAmount: number | undefined;
    if (protocol.materialReward !== undefined) {
      if (!isSettlementRecord(protocol.materialReward)) {
        return invalidSettlement('protocol', '协议结算记录不可用');
      }
      const materialName = knownItemName(protocol.materialReward.itemId);
      if (materialName === undefined
        || !isNonNegativeInteger(protocol.materialReward.amount)
        || protocol.materialReward.amount < 1) {
        return invalidSettlement('protocol', '协议结算记录不可用');
      }
      materialRewardName = materialName;
      materialRewardAmount = protocol.materialReward.amount;
    }
    return Object.freeze({
      state: 'valid',
      protocolName: definition.name,
      statusLabel: PROTOCOL_STATUS_LABELS[status],
      bossDefeated: protocol.bossDefeated,
      baseRewardPoints: protocol.baseRewardPoints,
      protocolRewardPoints: protocol.protocolRewardPoints,
      rewardPointBonus: protocol.rewardPointBonus,
      cycleImprintGranted: protocol.cycleImprintGranted,
      ...(materialRewardName !== undefined && materialRewardAmount !== undefined
        ? { materialRewardName, materialRewardAmount }
        : {})
    });
  } catch {
    return invalidSettlement('protocol', '协议结算记录不可用');
  }
}

const DIRECTIVE_STATUS_LABELS: Readonly<Record<'locked' | 'active' | 'completed' | 'failed', string>> = {
  locked: '未解锁',
  active: '进行中',
  completed: '已完成',
  failed: '失败'
};

function buildResultDirectiveSettlement(
  state: GameState
): ResultDirectiveSettlementViewModel | undefined {
  if (!state.run) return undefined;
  try {
    const evaluation = getDirectiveEvaluation(state) as unknown;
    if (!isSettlementRecord(evaluation)) return invalidSettlement('directive', '指令结算记录不可用');
    const status = evaluation.status;
    if (status !== 'locked' && status !== 'active' && status !== 'completed' && status !== 'failed') {
      return invalidSettlement('directive', '指令结算记录不可用');
    }
    if (typeof evaluation.progressText !== 'string'
      || typeof evaluation.rewardPreview !== 'string'
      || !Array.isArray(evaluation.objectiveResults)) {
      return invalidSettlement('directive', '指令结算记录不可用');
    }
    const objectives = evaluation.objectiveResults.map((objective) => {
      if (!isSettlementRecord(objective)
        || typeof objective.id !== 'string'
        || typeof objective.kind !== 'string'
        || typeof objective.label !== 'string'
        || typeof objective.description !== 'string'
        || typeof objective.progressText !== 'string'
        || typeof objective.completed !== 'boolean') {
        return undefined;
      }
      return {
        id: objective.id,
        kind: objective.kind,
        label: objective.label,
        description: objective.description,
        completed: objective.completed,
        progressText: objective.progressText
      };
    });
    if (objectives.some((objective) => objective === undefined)) {
      return invalidSettlement('directive', '指令结算记录不可用');
    }
    return Object.freeze({
      state: 'valid',
      statusLabel: DIRECTIVE_STATUS_LABELS[status],
      progressText: evaluation.progressText,
      rewardPreview: evaluation.rewardPreview,
      objectives: objectives as NonNullable<(typeof objectives)[number]>[]
    });
  } catch {
    return invalidSettlement('directive', '指令结算记录不可用');
  }
}

const ROUTE_CONTRACT_STATUS_LABELS: Readonly<Record<'active' | 'secured' | 'failed' | 'lost' | 'banked', string>> = {
  active: '进行中',
  secured: '已保全',
  failed: '失败',
  lost: '已遗失',
  banked: '已入账'
};

const ROUTE_CONTRACT_REASON_LABELS: Readonly<Record<'out_of_order' | 'incomplete_exit' | 'retreat' | 'failure' | 'cross_dungeon', string>> = {
  out_of_order: '目标顺序错误',
  incomplete_exit: '未完成出口',
  retreat: '主动撤退',
  failure: '挑战失败',
  cross_dungeon: '跨副本转移'
};

function buildResultRouteContractSettlement(
  run: GameState['run']
): ResultRouteContractSettlementViewModel | undefined {
  const contract: unknown = run?.lastRouteContractSettlement;
  if (contract === undefined) return undefined;
  try {
    if (!isSettlementRecord(contract)) return invalidSettlement('route-contract', '路线契约结算记录不可用');
    const state = contract.state;
    if (!isSettlementRecord(state) || !knownDungeonId(state.dungeonId)) {
      return invalidSettlement('route-contract', '路线契约结算记录不可用');
    }
    const normalized = normalizeRouteContractRunState(state, state.dungeonId);
    if (!normalized) return invalidSettlement('route-contract', '路线契约结算记录不可用');
    const definition = getRouteContractById(normalized.contractId, state.dungeonId);
    if (!definition) return invalidSettlement('route-contract', '路线契约结算记录不可用');
    if (!isNonNegativeInteger(contract.rewardPoints) || typeof contract.rewarded !== 'boolean') {
      return invalidSettlement('route-contract', '路线契约结算记录不可用');
    }
    // Core only banks a reward for a fully secured contract; every other state pays zero.
    if (contract.rewarded) {
      if (contract.rewardPoints <= 0 || normalized.status !== 'banked' || normalized.reason !== undefined) {
        return invalidSettlement('route-contract', '路线契约结算记录不可用');
      }
    } else if (contract.rewardPoints !== 0) {
      return invalidSettlement('route-contract', '路线契约结算记录不可用');
    }
    return Object.freeze({
      state: 'valid',
      contractName: definition.name,
      statusLabel: ROUTE_CONTRACT_STATUS_LABELS[normalized.status],
      completedTargetCount: normalized.completedTargetCount,
      totalTargetCount: definition.targetNodeIds.length,
      rewardPoints: contract.rewardPoints,
      rewarded: contract.rewarded,
      ...(normalized.reason !== undefined ? { reasonLabel: ROUTE_CONTRACT_REASON_LABELS[normalized.reason] } : {})
    });
  } catch {
    return invalidSettlement('route-contract', '路线契约结算记录不可用');
  }
}

const PRESSURE_TIER_LABELS: Readonly<Record<'stable' | 'hunted' | 'breach', string>> = {
  stable: '稳定',
  hunted: '追猎',
  breach: '破界'
};

function buildResultPressureSettlement(
  run: GameState['run']
): ResultPressureSettlementViewModel | undefined {
  const pressure: unknown = run?.lastPressureSettlement;
  if (pressure === undefined) return undefined;
  try {
    if (!isSettlementRecord(pressure)) return invalidSettlement('pressure', '侵蚀压力结算记录不可用');
    if (normalizeRunPressureState(pressure.state) === undefined) {
      return invalidSettlement('pressure', '侵蚀压力结算记录不可用');
    }
    const tier = pressure.tier;
    if (tier !== 'stable' && tier !== 'hunted' && tier !== 'breach') {
      return invalidSettlement('pressure', '侵蚀压力结算记录不可用');
    }
    if (!isNonNegativeInteger(pressure.rewardPointBonus)) {
      return invalidSettlement('pressure', '侵蚀压力结算记录不可用');
    }
    return Object.freeze({
      state: 'valid',
      tierLabel: PRESSURE_TIER_LABELS[tier],
      rewardPointBonus: pressure.rewardPointBonus
    });
  } catch {
    return invalidSettlement('pressure', '侵蚀压力结算记录不可用');
  }
}

const PURSUIT_REASON_LABELS: Readonly<Record<'successful_exit' | 'retreat' | 'failure' | 'stable_portal' | 'forced_portal', string>> = {
  successful_exit: '成功撤离',
  retreat: '主动撤退',
  failure: '濒死回收',
  stable_portal: '稳定传送门',
  forced_portal: '强制传送门'
};

function buildResultPursuitSettlement(
  run: GameState['run']
): ResultPursuitSettlementViewModel | undefined {
  const pursuit: unknown = run?.lastPursuitSettlement;
  if (pursuit === undefined) return undefined;
  try {
    if (!isSettlementRecord(pursuit)) return invalidSettlement('pursuit', '追兵结算记录不可用');
    const state = pursuit.state;
    if (!isSettlementRecord(state) || !knownDungeonId(state.dungeonId)) {
      return invalidSettlement('pursuit', '追兵结算记录不可用');
    }
    const definition = getRunPursuitDefinition(state.dungeonId);
    if (!definition) return invalidSettlement('pursuit', '追兵结算记录不可用');
    const knownNodeIds = DUNGEONS[state.dungeonId].nodes.map((node) => node.id);
    const normalized = normalizeRunPursuitState(state, knownNodeIds);
    if (!normalized || normalized.dungeonId !== state.dungeonId) {
      return invalidSettlement('pursuit', '追兵结算记录不可用');
    }
    const reason = pursuit.reason;
    if (reason !== 'successful_exit' && reason !== 'retreat' && reason !== 'failure'
      && reason !== 'stable_portal' && reason !== 'forced_portal') {
      return invalidSettlement('pursuit', '追兵结算记录不可用');
    }
    if (typeof pursuit.rewarded !== 'boolean' || pursuit.materialId !== definition.materialId) {
      return invalidSettlement('pursuit', '追兵结算记录不可用');
    }
    // Core only grants the pursuit material on a successful exit.
    if (pursuit.rewarded && reason !== 'successful_exit') {
      return invalidSettlement('pursuit', '追兵结算记录不可用');
    }
    const materialName = knownItemName(definition.materialId);
    if (materialName === undefined) return invalidSettlement('pursuit', '追兵结算记录不可用');
    return Object.freeze({
      state: 'valid',
      name: definition.name,
      reasonLabel: PURSUIT_REASON_LABELS[reason],
      rewarded: pursuit.rewarded,
      ...(pursuit.rewarded ? { materialName } : {})
    });
  } catch {
    return invalidSettlement('pursuit', '追兵结算记录不可用');
  }
}

function buildResultProjection(state: GameState): PhaseProjection {
  const run = state.run;
  const dungeonId = run?.dungeonId;
  const dungeon = dungeonId ? DUNGEONS[dungeonId] : undefined;
  const settlement = run?.lastRelicSettlement;
  const commissionSettlement = run?.lastEquipmentCommissionSettlement;
  const equipmentMemory = buildEquipmentMemoryResultProjection(state);
  const commissionRules = getEquipmentCommissionStatus(state);
  const status = settlement?.status ?? 'none';
  const actions: ViewActionModel[] = [];
  if (settlement?.status === 'pending') {
    for (const relicId of settlement.acquiredIds) {
      actions.push(commandAction(
        `result.archive-relic:${relicId}`,
        `归档${RUN_RELIC_DEFINITIONS[relicId].name}`,
        'result',
        { type: 'result/archive-relic', relicId },
        { emphasis: 'primary', recommendation: 'recommended', readout: RUN_RELIC_DEFINITIONS[relicId].description }
      ));
    }
    actions.push(commandAction('result.archive-relic:skip', '跳过回响归档', 'result', { type: 'result/archive-relic' }, { emphasis: 'quiet' }));
    actions.push(disabledAction('result.return-hub', '返回主神空间', 'result', '请先归档一件回响，或明确跳过。', { emphasis: 'primary' }));
  } else {
    actions.push(commandAction('result.return-hub', '返回主神空间', 'result', { type: 'result/return-hub' }, { emphasis: 'primary', recommendation: 'recommended' }));
  }
  const equipmentCommissionSettlement: EquipmentCommissionSettlementViewModel | undefined = commissionSettlement
    ? {
        helpId: 'equipmentCommission',
        status: commissionSettlement.status,
        dungeonId: commissionSettlement.dungeonId,
        dungeonName: DUNGEONS[commissionSettlement.dungeonId].name,
        equipmentIds: [
          commissionSettlement.equipmentIds[0],
          commissionSettlement.equipmentIds[1]
        ],
        equipmentNames: [
          EQUIPMENT[commissionSettlement.equipmentIds[0]].name,
          EQUIPMENT[commissionSettlement.equipmentIds[1]].name
        ],
        targetMaterialId: commissionSettlement.targetMaterialId,
        targetMaterialName: ITEMS[commissionSettlement.targetMaterialId].name,
        completedDungeonIds: [...commissionSettlement.completedDungeonIds],
        completedDungeonNames: commissionSettlement.completedDungeonIds.map(
          (completedDungeonId) => DUNGEONS[completedDungeonId].name
        ),
        completedCount: commissionSettlement.completedDungeonIds.length,
        requiredDungeonCount: commissionRules.requiredDungeonCount,
        remainingCount: Math.max(
          0,
          commissionRules.requiredDungeonCount - commissionSettlement.completedDungeonIds.length
        ),
        rewardAmount: commissionSettlement.rewardAmount,
        rewardReadout: commissionSettlement.status === 'completed'
          ? `${ITEMS[commissionSettlement.targetMaterialId].name} x${commissionSettlement.rewardAmount} 已存入永久背包。`
          : `本次成功出口已推进委托；还需 ${Math.max(0, commissionRules.requiredDungeonCount - commissionSettlement.completedDungeonIds.length)} 个不同副本。`
      }
    : undefined;
  const lootSettlement = buildResultLootSettlement(run);
  const equipmentRollSettlement = buildResultEquipmentRollSettlement(run);
  const protocolSettlement = buildResultProtocolSettlement(run);
  const directiveSettlement = buildResultDirectiveSettlement(state);
  const routeContractSettlement = buildResultRouteContractSettlement(run);
  const pressureSettlement = buildResultPressureSettlement(run);
  const pursuitSettlement = buildResultPursuitSettlement(run);
  const outcome = readOutcomeReadout(state.lastOutcome);
  const detail: ResultDetailViewModel = {
    kind: 'result',
    ...(dungeonId ? { dungeonId } : {}),
    ...(dungeon ? { dungeonName: dungeon.name } : {}),
    outcome: outcome.label,
    relicArchiveStatus: status,
    ...(equipmentCommissionSettlement
      ? { equipmentCommissionSettlement }
      : {}),
    ...(equipmentMemory ? { equipmentMemory } : {}),
    ...(lootSettlement ? { lootSettlement } : {}),
    ...(equipmentRollSettlement ? { equipmentRollSettlement } : {}),
    ...(protocolSettlement ? { protocolSettlement } : {}),
    ...(directiveSettlement ? { directiveSettlement } : {}),
    ...(routeContractSettlement ? { routeContractSettlement } : {}),
    ...(pressureSettlement ? { pressureSettlement } : {}),
    ...(pursuitSettlement ? { pursuitSettlement } : {})
  };
  const settlementLabel: Record<ResultDetailViewModel['relicArchiveStatus'], string> = {
    none: '无回响归档',
    pending: '待归档',
    archived: '已归档',
    skipped: '已跳过',
    lost: '已遗失'
  };
  const metrics: StatusMetric[] = [
    { id: 'outcome', label: '结算', value: outcome.label, symbol: '结', severity: outcome.severity },
    { id: 'reward-points', label: '奖励点', value: String(state.rewardPoints), symbol: '点', severity: 'positive' },
    { id: 'lingyun', label: '灵蕴', value: String(state.lingyun), symbol: '蕴', severity: 'positive' },
    { id: 'relic-archive', label: '回响归档', value: settlementLabel[status], symbol: status === 'pending' ? '!' : '档', severity: status === 'pending' ? 'warning' : 'neutral' },
    ...(equipmentCommissionSettlement
      ? [{
          id: 'equipment-commission',
          label: '装备封存委托',
          value: equipmentCommissionSettlement.status === 'completed'
            ? `完成 · ${equipmentCommissionSettlement.targetMaterialName} x${equipmentCommissionSettlement.rewardAmount}`
            : `推进 ${equipmentCommissionSettlement.completedCount}/${equipmentCommissionSettlement.requiredDungeonCount}`,
          symbol: equipmentCommissionSettlement.status === 'completed' ? '成' : '封',
          severity: 'positive' as const
        }]
      : []),
    ...(equipmentMemory
      ? [{
          id: 'equipment-memory-result',
          label: '装备记忆',
          value: equipmentMemory.legacyHunt
            ? `${equipmentMemory.legacyHunt.displayLabel} · ${equipmentMemory.legacyHunt.granted ? '已收录' : '未收录'}`
            : equipmentMemory.modernLibrary?.status === 'active'
              ? '本章已收录/激活'
              : equipmentMemory.modernLibrary?.status === 'recorded'
                ? '本章已收录'
                : '本章未收录',
          symbol: equipmentMemory.legacyHunt?.granted || equipmentMemory.modernLibrary?.status === 'active' ? '忆' : '!',
          severity: equipmentMemory.legacyHunt && !equipmentMemory.legacyHunt.granted
            ? 'warning' as const
            : equipmentMemory.modernLibrary?.status === 'not-recorded'
              ? 'neutral' as const
              : 'positive' as const
        }]
      : [])
  ];
  return {
    title: `${dungeon?.name ?? '副本'} · 结算`,
    ...(dungeonId === undefined
      ? {}
      : { visualAssetKey: verifiedVisualAssetKey('dungeon', dungeonId) }),
    objective: settlement?.status === 'pending'
      ? { kind: 'objective', title: '归档本轮回响', summary: '选择一件回响作为下轮种子，或明确跳过；归档完成后才能回大厅。' }
      : { kind: 'objective', title: '返回主神空间', summary: '本轮结算已完成；重复提交出口或归档不会出现在可执行动作中。' },
    status: { kind: 'status', metrics, detail },
    actions,
    logs: state.log.slice(0, 12)
  };
}

/**
 * Builds a detached, deeply frozen JSON snapshot. Each enabled action emits exactly one
 * command or one local event; disabled actions emit no event.
 */
function buildCharacterLoadout(state: GameState): CharacterLoadoutViewModel {
  const stats = getDerivedStats(state);
  const prepared = new Set(getTacticalLoadoutStatus(state).preparedItemIds);
  return {
    power: getPlayerPower(state),
    hp: state.player.hp,
    maxHp: state.player.maxHp,
    attack: stats.attack,
    artPower: stats.artPower,
    defense: stats.defense,
    equipment: EQUIPMENT_SLOTS.map((slot) => {
      const equipmentId = state.equipped[slot]!;
      const equipment = EQUIPMENT[equipmentId];
      return {
        slot,
        slotLabel: EQUIPMENT_SLOT_LABELS[slot],
        equipmentId,
        name: equipment.name,
        level: state.equipmentLevels[equipmentId] ?? 1,
        maxLevel: equipment.maxLevel,
      };
    }),
    items: [
      ...FIELD_SUPPLY_ITEM_IDS.map((itemId) => ({
        itemId,
        name: ITEMS[itemId].name,
        category: TACTICAL_ITEM_CATEGORY_BY_ID[itemId],
        itemGroup: 'supply' as const,
        count: state.inventory[itemId] ?? 0,
        carried: false,
      })),
      ...CARRIED_TACTICAL_ITEM_IDS.map((itemId) => ({
        itemId,
        name: ITEMS[itemId].name,
        category: TACTICAL_ITEM_CATEGORY_BY_ID[itemId],
        itemGroup: 'carry' as const,
        count: state.inventory[itemId] ?? 0,
        carried: prepared.has(itemId),
      })),
    ],
    carriedCount: CARRIED_TACTICAL_ITEM_IDS.reduce(
      (count, itemId) => count + (prepared.has(itemId) ? 1 : 0),
      0
    ),
  };
}

export function buildGameViewModel(
  state: ReadonlyGameState,
  localUiState: PresentationLocalUiState = {}
): DeepReadonly<GameViewModel> {
  const domain = asDomainState(state);
  const projection = domain.phase === 'hub'
    ? buildHubProjection(domain, localUiState)
    : domain.phase === 'explore'
      ? buildExploreProjection(domain)
      : domain.phase === 'combat'
        ? buildCombatProjection(domain, localUiState)
        : buildResultProjection(domain);
  const actions: ActionsSection = { kind: 'actions', actions: projection.actions };
  const status: StatusSection = { ...projection.status, loadout: buildCharacterLoadout(domain) };
  const risks: RisksSection = {
    kind: 'risks',
    items: dedupeRisks([...(projection.risks ?? []), ...getActionRisks(projection.actions)])
  };
  const logs: LogsSection = { kind: 'logs', lines: [...projection.logs] };
  const viewModel: GameViewModel = {
    schemaVersion: 1,
    phase: domain.phase,
    screenTitle: projection.title,
    ...(projection.visualAssetKey === undefined
      ? {}
      : { visualAssetKey: projection.visualAssetKey }),
    dispatchPolicy: 'one-event-per-action',
    tasks: buildCurrentTasks(domain),
    sections: [
      projection.objective,
      status,
      actions,
      risks,
      buildHelpSection(localUiState.activeHelpId),
      logs
    ]
  };
  return serializableSnapshot(viewModel);
}
