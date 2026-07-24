import type { Cost, MethodId } from './game';

export const METHOD_CULTIVATION_RULES_VERSION = 1 as const;

export type MethodRank = 1 | 2 | 3;

export type MethodCultivationProgress = Readonly<{
  rulesVersion: typeof METHOD_CULTIVATION_RULES_VERSION;
  ranks: Readonly<Partial<Record<MethodId, MethodRank>>>;
  activeMethod?: MethodId;
}>;

export type MethodRunSnapshot = Readonly<{
  rulesVersion: typeof METHOD_CULTIVATION_RULES_VERSION;
  methodId: MethodId;
  rank: MethodRank;
}>;

export type MethodTechniqueEffect = Readonly<{
  guarding: boolean;
  clearsRustPoison: boolean;
  clearsMirrorSlow: boolean;
  focusGain: number;
  breathGain: number;
  healPercent: number;
}>;

export type MethodTechniqueDefinition = Readonly<{
  methodId: MethodId;
  name: string;
  requiresActivePet: boolean;
  effects: Readonly<Record<MethodRank, MethodTechniqueEffect>>;
}>;

export type MethodUpgradeState = 'not_learned' | 'upgradeable' | 'max_rank';

export type MethodUpgradeStatus = Readonly<{
  state: MethodUpgradeState;
  currentRank?: MethodRank;
  targetRank?: MethodRank;
  cost?: Readonly<Cost>;
}>;

function freezeEffect(
  guarding: boolean,
  clearsRustPoison: boolean,
  clearsMirrorSlow: boolean,
  focusGain: number,
  breathGain: number,
  healPercent: number
): MethodTechniqueEffect {
  return Object.freeze({
    guarding,
    clearsRustPoison,
    clearsMirrorSlow,
    focusGain,
    breathGain,
    healPercent
  });
}

function freezeEffects(
  rank1: MethodTechniqueEffect,
  rank2: MethodTechniqueEffect,
  rank3: MethodTechniqueEffect
): Readonly<Record<MethodRank, MethodTechniqueEffect>> {
  return Object.freeze({ 1: rank1, 2: rank2, 3: rank3 });
}

export const METHOD_TECHNIQUE_CATALOG = Object.freeze([
  Object.freeze({
    methodId: 'mist_breathing',
    name: '归息',
    requiresActivePet: false,
    effects: freezeEffects(
      freezeEffect(false, false, false, 0, 1, 0),
      freezeEffect(false, false, false, 0, 1, 6),
      freezeEffect(false, false, false, 0, 2, 10)
    )
  }),
  Object.freeze({
    methodId: 'iron_body',
    name: '镇岳',
    requiresActivePet: false,
    effects: freezeEffects(
      freezeEffect(true, false, false, 0, 0, 0),
      freezeEffect(true, true, false, 0, 0, 0),
      freezeEffect(true, true, false, 0, 0, 8)
    )
  }),
  Object.freeze({
    methodId: 'cloud_step',
    name: '踏隙',
    requiresActivePet: false,
    effects: freezeEffects(
      freezeEffect(false, false, true, 1, 0, 0),
      freezeEffect(false, false, true, 2, 0, 0),
      freezeEffect(false, false, true, 3, 0, 0)
    )
  }),
  Object.freeze({
    methodId: 'gate_sense',
    name: '定门',
    requiresActivePet: false,
    effects: freezeEffects(
      freezeEffect(false, false, false, 1, 0, 0),
      freezeEffect(false, false, false, 2, 0, 0),
      freezeEffect(false, false, false, 3, 0, 0)
    )
  }),
  Object.freeze({
    methodId: 'star_core_method',
    name: '纳星',
    requiresActivePet: false,
    effects: freezeEffects(
      freezeEffect(false, false, false, 0, 1, 4),
      freezeEffect(false, false, false, 0, 2, 8),
      freezeEffect(false, false, false, 0, 3, 12)
    )
  }),
  Object.freeze({
    methodId: 'beast_taming',
    name: '护主',
    requiresActivePet: true,
    effects: freezeEffects(
      freezeEffect(true, false, false, 0, 0, 0),
      freezeEffect(true, false, false, 1, 0, 0),
      freezeEffect(true, false, false, 2, 0, 8)
    )
  }),
  Object.freeze({
    methodId: 'void_heart',
    name: '空明',
    requiresActivePet: false,
    effects: freezeEffects(
      freezeEffect(false, true, true, 1, 0, 0),
      freezeEffect(false, true, true, 2, 0, 6),
      freezeEffect(false, true, true, 3, 0, 10)
    )
  })
] as const) satisfies readonly MethodTechniqueDefinition[];

const METHOD_IDS = new Set<string>(
  METHOD_TECHNIQUE_CATALOG.map((definition) => definition.methodId)
);

const METHOD_UPGRADE_COST_R2: Readonly<Cost> = Object.freeze({
  rewardPoints: 420,
  lingyun: 1,
  items: Object.freeze({ method_page: 1 })
});

const METHOD_UPGRADE_COST_R3: Readonly<Cost> = Object.freeze({
  rewardPoints: 760,
  lingyun: 2,
  items: Object.freeze({ method_page: 2 })
});

export const METHOD_UPGRADE_COSTS: Readonly<Partial<Record<MethodRank, Readonly<Cost>>>> =
  Object.freeze({
    2: METHOD_UPGRADE_COST_R2,
    3: METHOD_UPGRADE_COST_R3
  });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expectedKeys.length && keys.every((key) => expectedKeys.includes(key));
}

function isKnownMethodId(value: unknown): value is MethodId {
  return typeof value === 'string' && METHOD_IDS.has(value);
}

function normalizeLearnedMethods(value: unknown): MethodId[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<MethodId>();
  const normalized: MethodId[] = [];

  for (const candidate of value) {
    if (!isKnownMethodId(candidate) || seen.has(candidate)) continue;
    seen.add(candidate);
    normalized.push(candidate);
  }

  return normalized;
}

export function isMethodRank(value: unknown): value is MethodRank {
  return value === 1 || value === 2 || value === 3;
}

export function normalizeMethodCultivationProgress(
  learnedMethods: unknown,
  value: unknown
): MethodCultivationProgress {
  const learned = normalizeLearnedMethods(learnedMethods);
  const learnedSet = new Set(learned);
  const currentValue = isRecord(value) && value.rulesVersion === METHOD_CULTIVATION_RULES_VERSION
    ? value
    : undefined;
  const rawRanks = currentValue && isRecord(currentValue.ranks) ? currentValue.ranks : {};
  const ranks: Partial<Record<MethodId, MethodRank>> = {};

  for (const methodId of learned) {
    const rawRank = rawRanks[methodId];
    ranks[methodId] = isMethodRank(rawRank) ? rawRank : 1;
  }

  const activeCandidate = isRecord(value) ? value.activeMethod : undefined;
  const activeMethod = isKnownMethodId(activeCandidate) && learnedSet.has(activeCandidate)
    ? activeCandidate
    : undefined;
  const normalized: MethodCultivationProgress = activeMethod === undefined
    ? {
        rulesVersion: METHOD_CULTIVATION_RULES_VERSION,
        ranks: Object.freeze(ranks)
      }
    : {
        rulesVersion: METHOD_CULTIVATION_RULES_VERSION,
        ranks: Object.freeze(ranks),
        activeMethod
      };

  return Object.freeze(normalized);
}

export function getMethodRank(
  methodId: unknown,
  progress: unknown
): MethodRank | undefined {
  if (
    !isKnownMethodId(methodId) ||
    !isRecord(progress) ||
    progress.rulesVersion !== METHOD_CULTIVATION_RULES_VERSION ||
    !isRecord(progress.ranks)
  ) {
    return undefined;
  }

  const rank = progress.ranks[methodId];
  return isMethodRank(rank) ? rank : undefined;
}

export function getMethodUpgradeCost(
  methodId: unknown,
  targetRank: unknown
): Readonly<Cost> | undefined {
  if (!isKnownMethodId(methodId) || !isMethodRank(targetRank)) return undefined;
  return METHOD_UPGRADE_COSTS[targetRank];
}

export function getMethodUpgradeStatus(
  methodId: unknown,
  progress: unknown
): MethodUpgradeStatus | undefined {
  if (!isKnownMethodId(methodId)) return undefined;

  const currentRank = getMethodRank(methodId, progress);
  if (currentRank === undefined) {
    return Object.freeze({ state: 'not_learned' });
  }
  if (currentRank === 3) {
    return Object.freeze({ state: 'max_rank', currentRank });
  }

  const targetRank: MethodRank = currentRank === 1 ? 2 : 3;
  return Object.freeze({
    state: 'upgradeable',
    currentRank,
    targetRank,
    cost: getMethodUpgradeCost(methodId, targetRank)
  });
}

export function createMethodRunSnapshot(progress: unknown): MethodRunSnapshot | undefined {
  if (
    !isRecord(progress) ||
    progress.rulesVersion !== METHOD_CULTIVATION_RULES_VERSION ||
    !isKnownMethodId(progress.activeMethod)
  ) {
    return undefined;
  }

  const rank = getMethodRank(progress.activeMethod, progress);
  if (rank === undefined) return undefined;

  return Object.freeze({
    rulesVersion: METHOD_CULTIVATION_RULES_VERSION,
    methodId: progress.activeMethod,
    rank
  });
}

export function createMethodRunSnapshots(progress: unknown): readonly MethodRunSnapshot[] {
  if (
    !isRecord(progress) ||
    progress.rulesVersion !== METHOD_CULTIVATION_RULES_VERSION ||
    !isRecord(progress.ranks)
  ) {
    return Object.freeze([]);
  }

  const snapshots = METHOD_TECHNIQUE_CATALOG.flatMap(({ methodId }) => {
    const rank = getMethodRank(methodId, progress);
    return rank === undefined
      ? []
      : [Object.freeze({
          rulesVersion: METHOD_CULTIVATION_RULES_VERSION,
          methodId,
          rank
        })];
  });
  if (isKnownMethodId(progress.activeMethod)) {
    const activeIndex = snapshots.findIndex(({ methodId }) => methodId === progress.activeMethod);
    if (activeIndex > 0) snapshots.unshift(...snapshots.splice(activeIndex, 1));
  }

  return Object.freeze(snapshots);
}

export function normalizeMethodRunSnapshot(value: unknown): MethodRunSnapshot | undefined {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['rulesVersion', 'methodId', 'rank']) ||
    value.rulesVersion !== METHOD_CULTIVATION_RULES_VERSION ||
    !isKnownMethodId(value.methodId) ||
    !isMethodRank(value.rank)
  ) {
    return undefined;
  }

  return Object.freeze({
    rulesVersion: METHOD_CULTIVATION_RULES_VERSION,
    methodId: value.methodId,
    rank: value.rank
  });
}

export function normalizeMethodRunSnapshots(
  value: unknown
): readonly MethodRunSnapshot[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const methodIds = new Set<MethodId>();
  const snapshots: MethodRunSnapshot[] = [];
  for (const candidate of value) {
    const snapshot = normalizeMethodRunSnapshot(candidate);
    if (!snapshot || methodIds.has(snapshot.methodId)) return undefined;
    methodIds.add(snapshot.methodId);
    snapshots.push(snapshot);
  }

  return Object.freeze(snapshots);
}

export function getMethodTechniqueDefinition(
  methodId: unknown
): MethodTechniqueDefinition | undefined {
  return isKnownMethodId(methodId)
    ? METHOD_TECHNIQUE_CATALOG.find((definition) => definition.methodId === methodId)
    : undefined;
}

export function getMethodTechniqueEffect(snapshot: unknown): MethodTechniqueEffect | undefined {
  const normalized = normalizeMethodRunSnapshot(snapshot);
  if (normalized === undefined) return undefined;

  return getMethodTechniqueDefinition(normalized.methodId)!.effects[normalized.rank];
}
