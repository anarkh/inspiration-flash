import type { Cost, DungeonId, ItemId } from './game';

export const COMPANION_RULES_VERSION = 1 as const;

export type CompanionId = 'qin_che' | 'zhou_yingxue' | 'lu_guanlan';
export type CompanionRank = 1 | 2 | 3;

/** How a companion fights beside the player every turn, plus its specialty. */
export type CompanionBattleEffect = Readonly<{
  /** The player stat the companion's own strike scales with, and the share of it. */
  strikeStat: 'attack' | 'artPower' | 'best';
  strikePercent: number;
  /** 秦彻: counterattack damage he blocks while you guard. */
  guardBlock: number;
  /** 周映雪: 战意 she hands you every few turns. */
  focusGain: number;
  focusEvery: number;
  /** 陆观澜: once per fight, heals this share of max HP when you drop below half. */
  emergencyHealPercent: number;
}>;

export type CompanionDefinition = Readonly<{
  id: CompanionId;
  name: string;
  title: string;
  unlockDungeonId: DungeonId;
  recruitCost: Readonly<Cost>;
  trainingMaterial: ItemId;
  assistName: string;
  battleEffects: Readonly<Record<CompanionRank, CompanionBattleEffect>>;
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

export type CompanionBattleStatus = Readonly<{
  active: boolean;
  snapshot?: CompanionRunSnapshot;
  effect?: CompanionBattleEffect;
}>;

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

function freezeBattle(
  strikeStat: CompanionBattleEffect['strikeStat'],
  strikePercent: number,
  specialty: Partial<Pick<CompanionBattleEffect, 'guardBlock' | 'focusGain' | 'focusEvery' | 'emergencyHealPercent'>>
): CompanionBattleEffect {
  return Object.freeze({ strikeStat, strikePercent, guardBlock: 0, focusGain: 0, focusEvery: 0, emergencyHealPercent: 0, ...specialty });
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
    battleEffects: Object.freeze({
      1: freezeBattle('attack', 15, { guardBlock: 4 }),
      2: freezeBattle('attack', 20, { guardBlock: 6 }),
      3: freezeBattle('attack', 25, { guardBlock: 9 })
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
    battleEffects: Object.freeze({
      1: freezeBattle('artPower', 15, { focusGain: 1, focusEvery: 3 }),
      2: freezeBattle('artPower', 20, { focusGain: 1, focusEvery: 3 }),
      3: freezeBattle('artPower', 25, { focusGain: 1, focusEvery: 3 })
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
    battleEffects: Object.freeze({
      1: freezeBattle('best', 10, { emergencyHealPercent: 12 }),
      2: freezeBattle('best', 13, { emergencyHealPercent: 18 }),
      3: freezeBattle('best', 16, { emergencyHealPercent: 25 })
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

export function getCompanionBattleEffect(snapshot: unknown): CompanionBattleEffect | undefined {
  const normalized = normalizeCompanionRunSnapshot(snapshot);
  return normalized === undefined ? undefined : getCompanionDefinition(normalized.companionId)!.battleEffects[normalized.rank];
}

export function getCompanionBattleStatus(snapshot: unknown): CompanionBattleStatus {
  const normalized = normalizeCompanionRunSnapshot(snapshot);
  if (normalized === undefined) return Object.freeze({ active: false });
  return Object.freeze({ active: true, snapshot: normalized, effect: getCompanionBattleEffect(normalized) });
}
