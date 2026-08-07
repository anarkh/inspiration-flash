import type { DerivedStats } from './game';

export const RUN_RELIC_RULES_VERSION = 1 as const;

export const RUN_RELIC_FRAMES = ['assault', 'bulwark', 'wayfinder'] as const;
export type RunRelicFrame = (typeof RUN_RELIC_FRAMES)[number];
export type RunRelicFrameId = RunRelicFrame;

export type RunRelicFrameDefinition = {
  readonly id: RunRelicFrameId;
  readonly name: string;
};

export const RUN_RELIC_FRAME_DEFINITIONS = {
  assault: { id: 'assault', name: '强攻' },
  bulwark: { id: 'bulwark', name: '守御' },
  wayfinder: { id: 'wayfinder', name: '寻路' }
} as const satisfies Readonly<Record<RunRelicFrameId, RunRelicFrameDefinition>>;

export const RUN_RELIC_IDS = [
  'mist_edge',
  'focus_prism',
  'hunter_clock',
  'bone_shell',
  'mending_thread',
  'iron_echo',
  'rift_step',
  'gate_anchor',
  'lucky_map'
] as const;
export type RunRelicId = (typeof RUN_RELIC_IDS)[number];

export const RUN_RELIC_IDS_BY_FRAME = {
  assault: ['mist_edge', 'focus_prism', 'hunter_clock'],
  bulwark: ['bone_shell', 'mending_thread', 'iron_echo'],
  wayfinder: ['rift_step', 'gate_anchor', 'lucky_map']
} as const satisfies Readonly<Record<RunRelicFrame, readonly RunRelicId[]>>;

export const RUN_RELIC_STAT_KEYS = ['attack', 'artPower', 'defense', 'speed', 'trapCheck'] as const;
export type RunRelicStatKey = (typeof RUN_RELIC_STAT_KEYS)[number];
export type RunRelicStatBonuses = Readonly<Pick<DerivedStats, RunRelicStatKey>>;

export type RunRelicEffectContribution = {
  readonly statBonuses?: Readonly<Partial<RunRelicStatBonuses>>;
  readonly combatStartFocusBonus?: number;
  readonly combatRewardPointsBonusPercent?: number;
  readonly rewardNodeHealing?: number;
  readonly trapDamageReductionPercent?: number;
  readonly forcedPortalBacklashReductionPercent?: number;
  readonly rewardNodeRewardPointsBonusPercent?: number;
};

export type RunRelicDefinition = {
  readonly id: RunRelicId;
  readonly frame: RunRelicFrame;
  readonly name: string;
  readonly description: string;
  readonly effects: RunRelicEffectContribution;
};

export const RUN_RELIC_DEFINITIONS = {
  mist_edge: {
    id: 'mist_edge',
    frame: 'assault',
    name: '雾锋',
    description: '攻击 +6，术法 +4。',
    effects: { statBonuses: { attack: 6, artPower: 4 } }
  },
  focus_prism: {
    id: 'focus_prism',
    frame: 'assault',
    name: '聚念棱镜',
    description: '每场战斗开始时战意 +1。',
    effects: { combatStartFocusBonus: 1 }
  },
  hunter_clock: {
    id: 'hunter_clock',
    frame: 'assault',
    name: '猎时钟',
    description: '战斗奖励点 +20%。',
    effects: { combatRewardPointsBonusPercent: 20 }
  },
  bone_shell: {
    id: 'bone_shell',
    frame: 'bulwark',
    name: '骨壳',
    description: '防御 +4。',
    effects: { statBonuses: { defense: 4 } }
  },
  mending_thread: {
    id: 'mending_thread',
    frame: 'bulwark',
    name: '缝生线',
    description: '选择后，后续每次领取奖励节点回复 12 生命。',
    effects: { rewardNodeHealing: 12 }
  },
  iron_echo: {
    id: 'iron_echo',
    frame: 'bulwark',
    name: '铁回响',
    description: '陷阱伤害 -25%。',
    effects: { trapDamageReductionPercent: 25 }
  },
  rift_step: {
    id: 'rift_step',
    frame: 'wayfinder',
    name: '裂隙步',
    description: '速度 +4，陷阱判定 +4。',
    effects: { statBonuses: { speed: 4, trapCheck: 4 } }
  },
  gate_anchor: {
    id: 'gate_anchor',
    frame: 'wayfinder',
    name: '门锚',
    description: '强闯传送反噬 -35%。',
    effects: { forcedPortalBacklashReductionPercent: 35 }
  },
  lucky_map: {
    id: 'lucky_map',
    frame: 'wayfinder',
    name: '幸运地图',
    description: '奖励节点奖励点 +20%。',
    effects: { rewardNodeRewardPointsBonusPercent: 20 }
  }
} as const satisfies Readonly<Record<RunRelicId, RunRelicDefinition>>;

export type RunRelicEffects = {
  readonly statBonuses: RunRelicStatBonuses;
  readonly combatStartFocusBonus: number;
  readonly combatRewardPointsBonusPercent: number;
  readonly combatRewardPointsMultiplier: number;
  readonly rewardNodeHealing: number;
  readonly trapDamageReductionPercent: number;
  readonly trapDamageMultiplier: number;
  readonly forcedPortalBacklashReductionPercent: number;
  readonly forcedPortalBacklashMultiplier: number;
  readonly rewardNodeRewardPointsBonusPercent: number;
  readonly rewardNodeRewardPointsMultiplier: number;
};

export const RUN_RELIC_EFFECT_STACKING = {
  duplicateRelicsStack: false,
  percentageBonuses: 'additive',
  percentageReductions: 'additive',
  maximumReductionPercent: 100
} as const;

export const RUN_RELIC_DRAFT_CANDIDATE_COUNTS = {
  ordinary: 2,
  matchingEquipmentConduit: 3
} as const;

export const DEFAULT_RUN_RELIC_EFFECTS: RunRelicEffects = Object.freeze({
  statBonuses: Object.freeze({ attack: 0, artPower: 0, defense: 0, speed: 0, trapCheck: 0 }),
  combatStartFocusBonus: 0,
  combatRewardPointsBonusPercent: 0,
  combatRewardPointsMultiplier: 1,
  rewardNodeHealing: 0,
  trapDamageReductionPercent: 0,
  trapDamageMultiplier: 1,
  forcedPortalBacklashReductionPercent: 0,
  forcedPortalBacklashMultiplier: 1,
  rewardNodeRewardPointsBonusPercent: 0,
  rewardNodeRewardPointsMultiplier: 1
});

export type RunRelicPendingDraft = {
  readonly draftId: string;
  readonly nodeId: string;
  readonly candidateIds: readonly RunRelicId[];
};

export type RunRelicState = {
  readonly rulesVersion: typeof RUN_RELIC_RULES_VERSION;
  readonly frame: RunRelicFrame;
  readonly seed?: number;
  readonly seedRelicId?: RunRelicId;
  readonly acquiredIds: readonly RunRelicId[];
  readonly processedDraftIds: readonly string[];
  readonly pendingDraft?: RunRelicPendingDraft;
};

export type RunRelicDraftRequest = {
  readonly draftId: string;
  readonly nodeId: string;
  readonly matchingEquipmentConduit?: boolean;
};

export type RunRelicArchiveSettlement = {
  readonly rulesVersion: typeof RUN_RELIC_RULES_VERSION;
  readonly frame: RunRelicFrame;
  readonly seed?: number;
  readonly seedRelicId?: RunRelicId;
  readonly acquiredIds: readonly RunRelicId[];
  readonly processedDraftIds: readonly string[];
  readonly abandonedDraftId?: string;
  readonly effects: RunRelicEffects;
};

const RUN_RELIC_FRAME_SET = new Set<string>(RUN_RELIC_FRAMES);
const RUN_RELIC_ID_SET = new Set<string>(RUN_RELIC_IDS);
const MAX_RUN_RELIC_SEED = 0xffffffff;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isNonEmptyString))];
}

function safeAdd(current: number, addition: number): number {
  const next = current + addition;
  return Number.isSafeInteger(next) ? next : Number.MAX_SAFE_INTEGER;
}

function getFrameRelicIds(frame: RunRelicFrame): readonly RunRelicId[] {
  return RUN_RELIC_IDS_BY_FRAME[frame];
}

function belongsToFrame(relicId: RunRelicId, frame: RunRelicFrame): boolean {
  return RUN_RELIC_DEFINITIONS[relicId].frame === frame;
}

function normalizeRelicIds(value: unknown, frame: RunRelicFrame): RunRelicId[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<RunRelicId>();
  const normalized: RunRelicId[] = [];
  for (const entry of value) {
    if (!isRunRelicId(entry) || !belongsToFrame(entry, frame) || seen.has(entry)) continue;
    seen.add(entry);
    normalized.push(entry);
  }
  return normalized;
}

function normalizeSeedRelicId(value: unknown, frame: RunRelicFrame): RunRelicId | undefined {
  return isRunRelicId(value) && belongsToFrame(value, frame) ? value : undefined;
}

function normalizePendingDraft(
  value: unknown,
  frame: RunRelicFrame,
  acquiredIds: readonly RunRelicId[],
  processedDraftIds: readonly string[],
  seedRelicId: RunRelicId | undefined
): RunRelicPendingDraft | undefined {
  if (!isRecord(value) || !isNonEmptyString(value.draftId) || !isNonEmptyString(value.nodeId)) {
    return undefined;
  }
  if (processedDraftIds.includes(value.draftId)) return undefined;
  if (!Array.isArray(value.candidateIds) || value.candidateIds.length === 0) return undefined;

  const acquired = new Set(acquiredIds);
  const candidateLimit = Math.min(
    value.candidateIds.length,
    RUN_RELIC_DRAFT_CANDIDATE_COUNTS.matchingEquipmentConduit
  );
  let candidateIds = normalizeRelicIds(value.candidateIds, frame)
    .filter((relicId) => !acquired.has(relicId));

  if (processedDraftIds.length === 0 && seedRelicId && !acquired.has(seedRelicId)) {
    candidateIds = [seedRelicId, ...candidateIds.filter((relicId) => relicId !== seedRelicId)];
  }
  candidateIds = candidateIds.slice(0, candidateLimit);
  if (candidateIds.length === 0) return undefined;

  return { draftId: value.draftId, nodeId: value.nodeId, candidateIds };
}

export function isRunRelicFrame(value: unknown): value is RunRelicFrame {
  return typeof value === 'string' && RUN_RELIC_FRAME_SET.has(value);
}

export function isRunRelicId(value: unknown): value is RunRelicId {
  return typeof value === 'string' && RUN_RELIC_ID_SET.has(value);
}

export function isValidRunRelicSeed(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_RUN_RELIC_SEED;
}

export function stableRunRelicHash(value: string): number {
  // FNV-1a with 32-bit arithmetic is deterministic across JavaScript runtimes.
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function deriveRunRelicSeed(frame: RunRelicFrame, draftId: string, nodeId: string): number {
  const hash = stableRunRelicHash(`run-relic:v${RUN_RELIC_RULES_VERSION}:${frame}:${draftId}:${nodeId}`);
  return hash === 0 ? 1 : hash;
}

export function createRunRelicState(
  frame: RunRelicFrame,
  seed?: number,
  seedRelicId?: RunRelicId
): RunRelicState {
  if (!isRunRelicFrame(frame)) throw new TypeError(`Unknown run relic frame: ${String(frame)}`);
  if (seed !== undefined && !isValidRunRelicSeed(seed)) {
    throw new TypeError(`Invalid run relic seed: ${String(seed)}`);
  }
  if (seedRelicId !== undefined && normalizeSeedRelicId(seedRelicId, frame) === undefined) {
    throw new TypeError(`Invalid seed relic for ${frame}: ${String(seedRelicId)}`);
  }

  return {
    rulesVersion: RUN_RELIC_RULES_VERSION,
    frame,
    ...(seed === undefined ? {} : { seed }),
    ...(seedRelicId === undefined ? {} : { seedRelicId }),
    acquiredIds: [],
    processedDraftIds: []
  };
}

export function aggregateRunRelicEffects(relicIds: readonly string[]): RunRelicEffects {
  const seen = new Set<RunRelicId>();
  const statBonuses: Record<RunRelicStatKey, number> = {
    attack: 0,
    artPower: 0,
    defense: 0,
    speed: 0,
    trapCheck: 0
  };
  let combatStartFocusBonus = 0;
  let combatRewardPointsBonusPercent = 0;
  let rewardNodeHealing = 0;
  let trapDamageReductionPercent = 0;
  let forcedPortalBacklashReductionPercent = 0;
  let rewardNodeRewardPointsBonusPercent = 0;

  for (const relicId of relicIds) {
    if (!isRunRelicId(relicId) || seen.has(relicId)) continue;
    seen.add(relicId);
    const contribution: RunRelicEffectContribution = RUN_RELIC_DEFINITIONS[relicId].effects;

    for (const statKey of RUN_RELIC_STAT_KEYS) {
      statBonuses[statKey] = safeAdd(statBonuses[statKey], contribution.statBonuses?.[statKey] ?? 0);
    }
    combatStartFocusBonus = safeAdd(combatStartFocusBonus, contribution.combatStartFocusBonus ?? 0);
    combatRewardPointsBonusPercent = safeAdd(
      combatRewardPointsBonusPercent,
      contribution.combatRewardPointsBonusPercent ?? 0
    );
    rewardNodeHealing = safeAdd(rewardNodeHealing, contribution.rewardNodeHealing ?? 0);
    trapDamageReductionPercent = Math.min(
      RUN_RELIC_EFFECT_STACKING.maximumReductionPercent,
      safeAdd(trapDamageReductionPercent, contribution.trapDamageReductionPercent ?? 0)
    );
    forcedPortalBacklashReductionPercent = Math.min(
      RUN_RELIC_EFFECT_STACKING.maximumReductionPercent,
      safeAdd(
        forcedPortalBacklashReductionPercent,
        contribution.forcedPortalBacklashReductionPercent ?? 0
      )
    );
    rewardNodeRewardPointsBonusPercent = safeAdd(
      rewardNodeRewardPointsBonusPercent,
      contribution.rewardNodeRewardPointsBonusPercent ?? 0
    );
  }

  return {
    statBonuses,
    combatStartFocusBonus,
    combatRewardPointsBonusPercent,
    combatRewardPointsMultiplier: (100 + combatRewardPointsBonusPercent) / 100,
    rewardNodeHealing,
    trapDamageReductionPercent,
    trapDamageMultiplier: (100 - trapDamageReductionPercent) / 100,
    forcedPortalBacklashReductionPercent,
    forcedPortalBacklashMultiplier: (100 - forcedPortalBacklashReductionPercent) / 100,
    rewardNodeRewardPointsBonusPercent,
    rewardNodeRewardPointsMultiplier: (100 + rewardNodeRewardPointsBonusPercent) / 100
  };
}

export function generateRunRelicDraft(
  state: RunRelicState,
  request: RunRelicDraftRequest
): RunRelicState {
  if (!isRunRelicState(state)) return state;
  if (!isNonEmptyString(request.draftId) || !isNonEmptyString(request.nodeId)) return state;
  if (state.pendingDraft || state.processedDraftIds.includes(request.draftId)) return state;

  const acquired = new Set(state.acquiredIds);
  const availableIds = getFrameRelicIds(state.frame).filter((relicId) => !acquired.has(relicId));
  if (availableIds.length === 0) return state;

  const seed = state.seed ?? deriveRunRelicSeed(state.frame, request.draftId, request.nodeId);
  const canonicalIndex = new Map(RUN_RELIC_IDS.map((relicId, index) => [relicId, index]));
  const rolledIds = [...availableIds].sort((left, right) => {
    const leftHash = stableRunRelicHash(`${seed}:${request.draftId}:${request.nodeId}:${left}`);
    const rightHash = stableRunRelicHash(`${seed}:${request.draftId}:${request.nodeId}:${right}`);
    return leftHash - rightHash || (canonicalIndex.get(left) ?? 0) - (canonicalIndex.get(right) ?? 0);
  });
  let orderedIds = rolledIds;
  const seedRelicId = state.seedRelicId;
  if (state.processedDraftIds.length === 0 && seedRelicId && !acquired.has(seedRelicId)) {
    orderedIds = [seedRelicId, ...rolledIds.filter((relicId) => relicId !== seedRelicId)];
  }
  const candidateIds = orderedIds.slice(
    0,
    request.matchingEquipmentConduit === true
      ? RUN_RELIC_DRAFT_CANDIDATE_COUNTS.matchingEquipmentConduit
      : RUN_RELIC_DRAFT_CANDIDATE_COUNTS.ordinary
  );

  return {
    ...state,
    seed,
    pendingDraft: {
      draftId: request.draftId,
      nodeId: request.nodeId,
      candidateIds
    }
  };
}

export function selectRunRelic(
  state: RunRelicState,
  draftId: string,
  relicId: string
): RunRelicState {
  if (!isRunRelicState(state)) return state;
  const pending = state.pendingDraft;
  if (
    !pending ||
    pending.draftId !== draftId ||
    state.processedDraftIds.includes(draftId) ||
    !isRunRelicId(relicId) ||
    !pending.candidateIds.includes(relicId) ||
    state.acquiredIds.includes(relicId)
  ) {
    return state;
  }

  return {
    rulesVersion: RUN_RELIC_RULES_VERSION,
    frame: state.frame,
    ...(state.seed === undefined ? {} : { seed: state.seed }),
    ...(state.seedRelicId === undefined ? {} : { seedRelicId: state.seedRelicId }),
    acquiredIds: [...state.acquiredIds, relicId],
    processedDraftIds: [...state.processedDraftIds, draftId]
  };
}

export function normalizeRunRelicState(
  value: unknown,
  expectedFrame?: RunRelicFrame
): RunRelicState {
  if (expectedFrame !== undefined && !isRunRelicFrame(expectedFrame)) {
    throw new TypeError(`Unknown run relic frame: ${String(expectedFrame)}`);
  }

  const candidate = isRecord(value) ? value : {};
  const frame = expectedFrame ?? (isRunRelicFrame(candidate.frame) ? candidate.frame : 'assault');
  const seedRelicId = normalizeSeedRelicId(candidate.seedRelicId, frame);
  const acquiredIds = normalizeRelicIds(candidate.acquiredIds, frame);
  const processedDraftIds = uniqueStrings(candidate.processedDraftIds);
  const pendingDraft = normalizePendingDraft(
    candidate.pendingDraft,
    frame,
    acquiredIds,
    processedDraftIds,
    seedRelicId
  );
  const validSeed = isValidRunRelicSeed(candidate.seed) ? candidate.seed : undefined;
  const seed = validSeed ?? (
    pendingDraft === undefined
      ? undefined
      : deriveRunRelicSeed(frame, pendingDraft.draftId, pendingDraft.nodeId)
  );

  return {
    rulesVersion: RUN_RELIC_RULES_VERSION,
    frame,
    ...(seed === undefined ? {} : { seed }),
    ...(seedRelicId === undefined ? {} : { seedRelicId }),
    acquiredIds,
    processedDraftIds,
    ...(pendingDraft === undefined ? {} : { pendingDraft })
  };
}

export function isRunRelicState(value: unknown): value is RunRelicState {
  if (!isRecord(value) || value.rulesVersion !== RUN_RELIC_RULES_VERSION || !isRunRelicFrame(value.frame)) {
    return false;
  }
  if (value.seed !== undefined && !isValidRunRelicSeed(value.seed)) return false;
  const seedRelicId = normalizeSeedRelicId(value.seedRelicId, value.frame);
  if (value.seedRelicId !== undefined && seedRelicId === undefined) return false;
  if (!Array.isArray(value.acquiredIds) || !Array.isArray(value.processedDraftIds)) return false;

  const acquiredIds = normalizeRelicIds(value.acquiredIds, value.frame);
  const processedDraftIds = uniqueStrings(value.processedDraftIds);
  if (
    acquiredIds.length !== value.acquiredIds.length ||
    processedDraftIds.length !== value.processedDraftIds.length
  ) {
    return false;
  }

  if (value.pendingDraft === undefined) return true;
  if (!isValidRunRelicSeed(value.seed)) return false;
  const rawPendingDraft = value.pendingDraft;
  if (!isRecord(rawPendingDraft)) return false;
  const rawCandidateIds = rawPendingDraft.candidateIds;
  if (!Array.isArray(rawCandidateIds)) return false;
  const pendingDraft = normalizePendingDraft(
    rawPendingDraft,
    value.frame,
    acquiredIds,
    processedDraftIds,
    seedRelicId
  );
  if (!pendingDraft) return false;

  return (
    pendingDraft.draftId === rawPendingDraft.draftId &&
    pendingDraft.nodeId === rawPendingDraft.nodeId &&
    pendingDraft.candidateIds.length === rawCandidateIds.length &&
    pendingDraft.candidateIds.every((relicId, index) => relicId === rawCandidateIds[index])
  );
}

export function archiveRunRelicState(
  value: unknown,
  expectedFrame?: RunRelicFrame
): RunRelicArchiveSettlement {
  const normalized = normalizeRunRelicState(value, expectedFrame);
  return {
    rulesVersion: RUN_RELIC_RULES_VERSION,
    frame: normalized.frame,
    ...(normalized.seed === undefined ? {} : { seed: normalized.seed }),
    ...(normalized.seedRelicId === undefined ? {} : { seedRelicId: normalized.seedRelicId }),
    acquiredIds: [...normalized.acquiredIds],
    processedDraftIds: [...normalized.processedDraftIds],
    ...(normalized.pendingDraft === undefined ? {} : { abandonedDraftId: normalized.pendingDraft.draftId }),
    effects: aggregateRunRelicEffects(normalized.acquiredIds)
  };
}
