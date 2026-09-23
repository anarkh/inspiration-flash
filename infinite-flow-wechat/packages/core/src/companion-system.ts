import type { Cost, DungeonId, ItemId } from './game';

export const COMPANION_RULES_VERSION = 1 as const;

export type CompanionId = 'qin_che' | 'zhou_yingxue' | 'lu_guanlan';
export type CompanionRank = 1 | 2 | 3;

export type CompanionAssistEffect = Readonly<{
  guarding: boolean;
  focusGain: number;
  healPercent: number;
}>;

export type CompanionDefinition = Readonly<{
  id: CompanionId;
  name: string;
  title: string;
  unlockDungeonId: DungeonId;
  recruitCost: Readonly<Cost>;
  trainingMaterial: ItemId;
  assistName: string;
  assistEffects: Readonly<Record<CompanionRank, CompanionAssistEffect>>;
}>;

export type CompanionProgress = Readonly<{
  rulesVersion: typeof COMPANION_RULES_VERSION;
  owned: readonly CompanionId[];
  ranks: Readonly<Partial<Record<CompanionId, CompanionRank>>>;
  active?: CompanionId;
}>;

export type CompanionRunSnapshot = Readonly<{
  rulesVersion: typeof COMPANION_RULES_VERSION;
  companionId: CompanionId;
  rank: CompanionRank;
}>;

export type CompanionRecruitmentStatus = 'locked' | 'recruitable' | 'owned';
export type CompanionUpgradeState = 'not_owned' | 'upgradeable' | 'max_rank';

export type CompanionUpgradeStatus = Readonly<{
  state: CompanionUpgradeState;
  currentRank?: CompanionRank;
  targetRank?: CompanionRank;
  cost?: Readonly<Cost>;
}>;

export type CompanionAssistStatus = Readonly<{
  active: boolean;
  snapshot?: CompanionRunSnapshot;
  effect: CompanionAssistEffect;
}>;

const NO_ASSIST_EFFECT: CompanionAssistEffect = Object.freeze({
  guarding: false,
  focusGain: 0,
  healPercent: 0
});

function freezeCost(
  rewardPoints: number,
  lingyun: number,
  itemId: ItemId,
  itemCount: number
): Readonly<Cost> {
  return Object.freeze({
    rewardPoints,
    lingyun,
    items: Object.freeze({ [itemId]: itemCount })
  });
}

function freezeEffect(
  guarding: boolean,
  focusGain: number,
  healPercent: number
): CompanionAssistEffect {
  return Object.freeze({ guarding, focusGain, healPercent });
}

export const COMPANION_CATALOG = Object.freeze([
  Object.freeze({
    id: 'qin_che',
    name: '秦彻',
    title: '壁垒先锋',
    unlockDungeonId: 'demon_tower_1',
    recruitCost: freezeCost(480, 1, 'demon_bone', 2),
    trainingMaterial: 'demon_bone',
    assistName: '抢位援护',
    assistEffects: Object.freeze({
      1: freezeEffect(true, 0, 0),
      2: freezeEffect(true, 1, 0),
      3: freezeEffect(true, 1, 8)
    })
  }),
  Object.freeze({
    id: 'zhou_yingxue',
    name: '周映雪',
    title: '精神分析师',
    unlockDungeonId: 'dream_archive',
    recruitCost: freezeCost(920, 2, 'method_page', 2),
    trainingMaterial: 'method_page',
    assistName: '弱点演算',
    assistEffects: Object.freeze({
      1: freezeEffect(false, 1, 0),
      2: freezeEffect(false, 2, 0),
      3: freezeEffect(false, 3, 0)
    })
  }),
  Object.freeze({
    id: 'lu_guanlan',
    name: '陆观澜',
    title: '战地医师',
    unlockDungeonId: 'rust_hospital',
    recruitCost: freezeCost(720, 2, 'medicine_ash', 2),
    trainingMaterial: 'medicine_ash',
    assistName: '紧急处置',
    assistEffects: Object.freeze({
      1: freezeEffect(false, 0, 12),
      2: freezeEffect(false, 0, 18),
      3: freezeEffect(false, 0, 25)
    })
  })
] as const) satisfies readonly CompanionDefinition[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isCompanionId(value: unknown): value is CompanionId {
  return typeof value === 'string' && COMPANION_CATALOG.some((definition) => definition.id === value);
}

export function isCompanionRank(value: unknown): value is CompanionRank {
  return value === 1 || value === 2 || value === 3;
}

export function getCompanionDefinition(value: unknown): CompanionDefinition | undefined {
  return isCompanionId(value)
    ? COMPANION_CATALOG.find((definition) => definition.id === value)
    : undefined;
}

export function createEmptyCompanionProgress(): CompanionProgress {
  return Object.freeze({
    rulesVersion: COMPANION_RULES_VERSION,
    owned: Object.freeze([]),
    ranks: Object.freeze({})
  });
}

export function normalizeActiveCompanion(
  value: unknown,
  owned: readonly CompanionId[]
): CompanionId | undefined {
  return isCompanionId(value) && owned.includes(value) ? value : undefined;
}

export function normalizeCompanionProgress(value: unknown): CompanionProgress {
  if (!isRecord(value) || value.rulesVersion !== COMPANION_RULES_VERSION) {
    return createEmptyCompanionProgress();
  }

  const rawRanks = isRecord(value.ranks) ? value.ranks : {};
  const seen = new Set<CompanionId>();
  const owned: CompanionId[] = [];
  const ranks: Partial<Record<CompanionId, CompanionRank>> = {};

  if (Array.isArray(value.owned)) {
    for (const candidate of value.owned) {
      if (!isCompanionId(candidate) || seen.has(candidate)) continue;
      const rank = rawRanks[candidate];
      if (!isCompanionRank(rank)) continue;

      seen.add(candidate);
      owned.push(candidate);
      ranks[candidate] = rank;
    }
  }

  const active = normalizeActiveCompanion(value.active, owned);
  const normalized: CompanionProgress = active === undefined
    ? {
        rulesVersion: COMPANION_RULES_VERSION,
        owned: Object.freeze(owned),
        ranks: Object.freeze(ranks)
      }
    : {
        rulesVersion: COMPANION_RULES_VERSION,
        owned: Object.freeze(owned),
        ranks: Object.freeze(ranks),
        active
      };

  return Object.freeze(normalized);
}

export function isCompanionUnlocked(
  companionId: unknown,
  clearedDungeonIds: readonly unknown[]
): boolean {
  const definition = getCompanionDefinition(companionId);
  return definition !== undefined && clearedDungeonIds.includes(definition.unlockDungeonId);
}

export function getCompanionRecruitmentStatus(
  companionId: unknown,
  progress: unknown,
  clearedDungeonIds: readonly unknown[]
): CompanionRecruitmentStatus | undefined {
  if (!isCompanionId(companionId)) return undefined;

  const normalized = normalizeCompanionProgress(progress);
  if (normalized.owned.includes(companionId)) return 'owned';
  return isCompanionUnlocked(companionId, clearedDungeonIds) ? 'recruitable' : 'locked';
}

export function getCompanionUpgradeCost(
  companionId: unknown,
  targetRank: unknown
): Readonly<Cost> | undefined {
  const definition = getCompanionDefinition(companionId);
  if (definition === undefined) return undefined;
  if (targetRank === 2) return freezeCost(360, 1, definition.trainingMaterial, 1);
  if (targetRank === 3) return freezeCost(680, 2, definition.trainingMaterial, 2);
  return undefined;
}

export function getCompanionUpgradeStatus(
  companionId: unknown,
  progress: unknown
): CompanionUpgradeStatus | undefined {
  if (!isCompanionId(companionId)) return undefined;

  const normalized = normalizeCompanionProgress(progress);
  const currentRank = normalized.ranks[companionId];
  if (currentRank === undefined || !normalized.owned.includes(companionId)) {
    return Object.freeze({ state: 'not_owned' });
  }
  if (currentRank === 3) {
    return Object.freeze({ state: 'max_rank', currentRank });
  }

  const targetRank: CompanionRank = currentRank === 1 ? 2 : 3;
  return Object.freeze({
    state: 'upgradeable',
    currentRank,
    targetRank,
    cost: getCompanionUpgradeCost(companionId, targetRank)
  });
}

export function createCompanionRunSnapshot(progress: unknown): CompanionRunSnapshot | undefined {
  const normalized = normalizeCompanionProgress(progress);
  const companionId = normalized.active;
  if (companionId === undefined || !normalized.owned.includes(companionId)) return undefined;

  const rank = normalized.ranks[companionId];
  if (!isCompanionRank(rank)) return undefined;

  return Object.freeze({
    rulesVersion: COMPANION_RULES_VERSION,
    companionId,
    rank
  });
}

export function normalizeCompanionRunSnapshot(value: unknown): CompanionRunSnapshot | undefined {
  if (
    !isRecord(value) ||
    value.rulesVersion !== COMPANION_RULES_VERSION ||
    !isCompanionId(value.companionId) ||
    !isCompanionRank(value.rank)
  ) {
    return undefined;
  }

  return Object.freeze({
    rulesVersion: COMPANION_RULES_VERSION,
    companionId: value.companionId,
    rank: value.rank
  });
}

export function getCompanionAssistEffect(snapshot: unknown): CompanionAssistEffect {
  const normalized = normalizeCompanionRunSnapshot(snapshot);
  if (normalized === undefined) return NO_ASSIST_EFFECT;

  return getCompanionDefinition(normalized.companionId)!.assistEffects[normalized.rank];
}

export function getCompanionAssistStatus(snapshot: unknown): CompanionAssistStatus {
  const normalized = normalizeCompanionRunSnapshot(snapshot);
  if (normalized === undefined) {
    return Object.freeze({ active: false, effect: NO_ASSIST_EFFECT });
  }

  return Object.freeze({
    active: true,
    snapshot: normalized,
    effect: getCompanionAssistEffect(normalized)
  });
}
