import type { Cost, DerivedStats } from './game';

export const BLOODLINE_RULES_VERSION = 1 as const;

export type BloodlineId =
  | 'titan_marrow'
  | 'void_symbiote'
  | 'bastion_chitin'
  | 'phoenix_ember';

export type BloodlineAspect = 'force' | 'art' | 'guard' | 'renewal';
export type BloodlineRank = 1 | 2 | 3;

type BloodlineStatKey =
  | 'attack'
  | 'maxHp'
  | 'spirit'
  | 'artPower'
  | 'defense'
  | 'speed';

type BloodlineMaterialCost = Readonly<Partial<Record<'genesis_serum', number>>>;

export type BloodlineUpgradeCost = Readonly<Cost & {
  readonly items?: Cost['items'] & BloodlineMaterialCost;
}>;

export type BloodlineStatBonus = Readonly<Partial<Pick<DerivedStats, BloodlineStatKey>>>;

export type BloodlineSurgeEffect = Readonly<{
  forceDamage: number;
  artDamage: number;
  barrier: number;
  healPercent: number;
}>;

export type BloodlineDefinition = Readonly<{
  id: BloodlineId;
  name: string;
  title: string;
  aspect: BloodlineAspect;
  statBonuses: Readonly<Record<BloodlineRank, BloodlineStatBonus>>;
  surgeEffects: Readonly<Record<BloodlineRank, BloodlineSurgeEffect>>;
}>;

export type BloodlineProgress = Readonly<{
  rulesVersion: typeof BLOODLINE_RULES_VERSION;
  ranks: Readonly<Partial<Record<BloodlineId, BloodlineRank>>>;
  active?: BloodlineId;
}>;

export type BloodlineRunSnapshot = Readonly<{
  rulesVersion: typeof BLOODLINE_RULES_VERSION;
  bloodlineId: BloodlineId;
  aspect: BloodlineAspect;
  rank: BloodlineRank;
}>;

export type BloodlineUpgradeState = 'unlockable' | 'upgradeable' | 'max_rank';

export type BloodlineUpgradeStatus = Readonly<{
  state: BloodlineUpgradeState;
  currentRank?: BloodlineRank;
  targetRank?: BloodlineRank;
  cost?: BloodlineUpgradeCost;
}>;

function freezeRankValues<T>(
  rank1: T,
  rank2: T,
  rank3: T
): Readonly<Record<BloodlineRank, T>> {
  return Object.freeze({ 1: rank1, 2: rank2, 3: rank3 });
}

function freezeStatBonus(bonus: BloodlineStatBonus): BloodlineStatBonus {
  return Object.freeze({ ...bonus });
}

function freezeSurgeEffect(
  forceDamage: number,
  artDamage: number,
  barrier: number,
  healPercent: number
): BloodlineSurgeEffect {
  return Object.freeze({ forceDamage, artDamage, barrier, healPercent });
}

const TITAN_MARROW_DEFINITION: BloodlineDefinition = Object.freeze({
  id: 'titan_marrow',
  name: '巨灵骨髓',
  title: '力之始祖',
  aspect: 'force',
  statBonuses: freezeRankValues(
    freezeStatBonus({ attack: 6, maxHp: 12 }),
    freezeStatBonus({ attack: 12, maxHp: 24 }),
    freezeStatBonus({ attack: 20, maxHp: 40 })
  ),
  surgeEffects: freezeRankValues(
    freezeSurgeEffect(18, 0, 0, 0),
    freezeSurgeEffect(30, 0, 0, 0),
    freezeSurgeEffect(44, 0, 0, 0)
  )
});

const VOID_SYMBIOTE_DEFINITION: BloodlineDefinition = Object.freeze({
  id: 'void_symbiote',
  name: '虚界共生体',
  title: '术之共鸣',
  aspect: 'art',
  statBonuses: freezeRankValues(
    freezeStatBonus({ spirit: 1, artPower: 8 }),
    freezeStatBonus({ spirit: 2, artPower: 16 }),
    freezeStatBonus({ spirit: 3, artPower: 26 })
  ),
  surgeEffects: freezeRankValues(
    freezeSurgeEffect(0, 20, 0, 0),
    freezeSurgeEffect(0, 34, 0, 0),
    freezeSurgeEffect(0, 50, 0, 0)
  )
});

const BASTION_CHITIN_DEFINITION: BloodlineDefinition = Object.freeze({
  id: 'bastion_chitin',
  name: '界壁甲质',
  title: '守之原壳',
  aspect: 'guard',
  statBonuses: freezeRankValues(
    freezeStatBonus({ defense: 4, maxHp: 18 }),
    freezeStatBonus({ defense: 8, maxHp: 36 }),
    freezeStatBonus({ defense: 13, maxHp: 56 })
  ),
  surgeEffects: freezeRankValues(
    freezeSurgeEffect(0, 0, 20, 0),
    freezeSurgeEffect(0, 0, 34, 0),
    freezeSurgeEffect(0, 0, 50, 0)
  )
});

const PHOENIX_EMBER_DEFINITION: BloodlineDefinition = Object.freeze({
  id: 'phoenix_ember',
  name: '涅槃余烬',
  title: '归返火种',
  aspect: 'renewal',
  statBonuses: freezeRankValues(
    freezeStatBonus({ maxHp: 12, speed: 2 }),
    freezeStatBonus({ maxHp: 24, speed: 4 }),
    freezeStatBonus({ maxHp: 36, speed: 6 })
  ),
  surgeEffects: freezeRankValues(
    freezeSurgeEffect(0, 0, 0, 12),
    freezeSurgeEffect(0, 0, 0, 18),
    freezeSurgeEffect(0, 0, 0, 25)
  )
});

export const BLOODLINE_CATALOG = Object.freeze([
  TITAN_MARROW_DEFINITION,
  VOID_SYMBIOTE_DEFINITION,
  BASTION_CHITIN_DEFINITION,
  PHOENIX_EMBER_DEFINITION
] as const) satisfies readonly BloodlineDefinition[];

function freezeUpgradeCost(
  rewardPoints: number,
  lingyun: number,
  genesisSerum: number
): BloodlineUpgradeCost {
  if (genesisSerum === 0) return Object.freeze({ rewardPoints, lingyun });

  const items = Object.freeze({ genesis_serum: genesisSerum }) as NonNullable<
    BloodlineUpgradeCost['items']
  >;
  return Object.freeze({ rewardPoints, lingyun, items });
}

export const BLOODLINE_UPGRADE_COSTS: Readonly<
  Record<BloodlineRank, BloodlineUpgradeCost>
> = Object.freeze({
  1: freezeUpgradeCost(800, 2, 0),
  2: freezeUpgradeCost(1200, 3, 1),
  3: freezeUpgradeCost(1800, 4, 2)
});

const EMPTY_BLOODLINE_PROGRESS: BloodlineProgress = Object.freeze({
  rulesVersion: BLOODLINE_RULES_VERSION,
  ranks: Object.freeze({})
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expectedKeys.length && keys.every((key) => expectedKeys.includes(key));
}

export function isBloodlineId(value: unknown): value is BloodlineId {
  return value === 'titan_marrow' ||
    value === 'void_symbiote' ||
    value === 'bastion_chitin' ||
    value === 'phoenix_ember';
}

export function isBloodlineAspect(value: unknown): value is BloodlineAspect {
  return value === 'force' || value === 'art' || value === 'guard' || value === 'renewal';
}

export function isBloodlineRank(value: unknown): value is BloodlineRank {
  return value === 1 || value === 2 || value === 3;
}

export function getBloodlineDefinition(value: unknown): BloodlineDefinition | undefined {
  if (!isBloodlineId(value)) return undefined;

  switch (value) {
    case 'titan_marrow':
      return TITAN_MARROW_DEFINITION;
    case 'void_symbiote':
      return VOID_SYMBIOTE_DEFINITION;
    case 'bastion_chitin':
      return BASTION_CHITIN_DEFINITION;
    case 'phoenix_ember':
      return PHOENIX_EMBER_DEFINITION;
  }
}

export function createEmptyBloodlineProgress(): BloodlineProgress {
  return EMPTY_BLOODLINE_PROGRESS;
}

export function normalizeBloodlineProgress(value: unknown): BloodlineProgress {
  if (
    !isRecord(value) ||
    value.rulesVersion !== BLOODLINE_RULES_VERSION ||
    !isRecord(value.ranks)
  ) {
    return createEmptyBloodlineProgress();
  }

  const ranks: Partial<Record<BloodlineId, BloodlineRank>> = {};
  for (const definition of BLOODLINE_CATALOG) {
    const rank = value.ranks[definition.id];
    if (isBloodlineRank(rank)) ranks[definition.id] = rank;
  }

  const active = isBloodlineId(value.active) && ranks[value.active] !== undefined
    ? value.active
    : undefined;
  const normalized: BloodlineProgress = active === undefined
    ? {
        rulesVersion: BLOODLINE_RULES_VERSION,
        ranks: Object.freeze(ranks)
      }
    : {
        rulesVersion: BLOODLINE_RULES_VERSION,
        ranks: Object.freeze(ranks),
        active
      };

  return Object.freeze(normalized);
}

export function getBloodlineRank(
  bloodlineId: unknown,
  progress: unknown
): BloodlineRank | undefined {
  if (!isBloodlineId(bloodlineId)) return undefined;
  return normalizeBloodlineProgress(progress).ranks[bloodlineId];
}

export function getBloodlineUpgradeCost(
  bloodlineId: unknown,
  targetRank: unknown
): BloodlineUpgradeCost | undefined {
  if (!isBloodlineId(bloodlineId) || !isBloodlineRank(targetRank)) return undefined;
  return BLOODLINE_UPGRADE_COSTS[targetRank];
}

export function getBloodlineUpgradeStatus(
  bloodlineId: unknown,
  progress: unknown
): BloodlineUpgradeStatus | undefined {
  if (!isBloodlineId(bloodlineId)) return undefined;

  const currentRank = getBloodlineRank(bloodlineId, progress);
  if (currentRank === undefined) {
    return Object.freeze({
      state: 'unlockable',
      targetRank: 1,
      cost: BLOODLINE_UPGRADE_COSTS[1]
    });
  }
  if (currentRank === 3) {
    return Object.freeze({ state: 'max_rank', currentRank });
  }

  const targetRank: BloodlineRank = currentRank === 1 ? 2 : 3;
  return Object.freeze({
    state: 'upgradeable',
    currentRank,
    targetRank,
    cost: BLOODLINE_UPGRADE_COSTS[targetRank]
  });
}

export function createBloodlineRunSnapshot(progress: unknown): BloodlineRunSnapshot | undefined {
  const normalized = normalizeBloodlineProgress(progress);
  const bloodlineId = normalized.active;
  if (bloodlineId === undefined) return undefined;

  const definition = getBloodlineDefinition(bloodlineId);
  const rank = normalized.ranks[bloodlineId];
  if (definition === undefined || !isBloodlineRank(rank)) return undefined;

  return Object.freeze({
    rulesVersion: BLOODLINE_RULES_VERSION,
    bloodlineId,
    aspect: definition.aspect,
    rank
  });
}

export function normalizeBloodlineRunSnapshot(value: unknown): BloodlineRunSnapshot | undefined {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['rulesVersion', 'bloodlineId', 'aspect', 'rank']) ||
    value.rulesVersion !== BLOODLINE_RULES_VERSION ||
    !isBloodlineId(value.bloodlineId) ||
    !isBloodlineAspect(value.aspect) ||
    !isBloodlineRank(value.rank)
  ) {
    return undefined;
  }

  const definition = getBloodlineDefinition(value.bloodlineId);
  if (definition?.aspect !== value.aspect) return undefined;

  return Object.freeze({
    rulesVersion: BLOODLINE_RULES_VERSION,
    bloodlineId: value.bloodlineId,
    aspect: value.aspect,
    rank: value.rank
  });
}

export function getBloodlineStatBonus(snapshot: unknown): BloodlineStatBonus | undefined {
  const normalized = normalizeBloodlineRunSnapshot(snapshot);
  if (normalized === undefined) return undefined;
  return getBloodlineDefinition(normalized.bloodlineId)!.statBonuses[normalized.rank];
}

export function getBloodlineSurgeEffect(snapshot: unknown): BloodlineSurgeEffect | undefined {
  const normalized = normalizeBloodlineRunSnapshot(snapshot);
  if (normalized === undefined) return undefined;
  return getBloodlineDefinition(normalized.bloodlineId)!.surgeEffects[normalized.rank];
}
