export type RunPressureTier = 'stable' | 'hunted' | 'breach';

export type RunPressureState = {
  rulesVersion: 1;
  clearedNodeCount: number;
};

export type RunPressureStatus = {
  state: RunPressureState;
  tier: RunPressureTier;
  label: string;
  pressurePercent: number;
  rewardBonusPercent: number;
  nextTierAt: number | null;
};

type RunPressureMonster = {
  readonly maxHp: number;
  readonly attack: number;
  readonly artPower: number;
  readonly defense: number;
  readonly speed: number;
};

type RunPressureTrap = {
  readonly damage: number;
  readonly dc: number;
};

const HUNTED_AT = 6;
const BREACH_AT = 12;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function scaleNonNegativeNumber(value: number, pressurePercent: number): number {
  if (!Number.isFinite(value) || value < 0 || pressurePercent === 0) return value;

  // Pressure may round a stat upward, but must never weaken an existing non-negative value.
  return Math.max(value, Math.ceil((value * (100 + pressurePercent)) / 100));
}

export function createRunPressureState(): RunPressureState {
  return {
    rulesVersion: 1,
    clearedNodeCount: 0
  };
}

export function normalizeRunPressureState(value: unknown): RunPressureState | undefined {
  if (
    !isRecord(value) ||
    value.rulesVersion !== 1 ||
    typeof value.clearedNodeCount !== 'number' ||
    !Number.isSafeInteger(value.clearedNodeCount) ||
    value.clearedNodeCount < 0
  ) {
    return undefined;
  }

  return {
    rulesVersion: 1,
    clearedNodeCount: value.clearedNodeCount
  };
}

export function isRunPressureState(value: unknown): value is RunPressureState {
  return normalizeRunPressureState(value) !== undefined;
}

export function advanceRunPressureOnNodeClear(state: RunPressureState): RunPressureState;
export function advanceRunPressureOnNodeClear(state: undefined): undefined;
export function advanceRunPressureOnNodeClear(
  state: RunPressureState | undefined
): RunPressureState | undefined;
export function advanceRunPressureOnNodeClear(
  state: RunPressureState | undefined
): RunPressureState | undefined {
  const normalized = normalizeRunPressureState(state);
  if (!normalized) return undefined;

  return {
    rulesVersion: 1,
    clearedNodeCount: Math.min(Number.MAX_SAFE_INTEGER, normalized.clearedNodeCount + 1)
  };
}

export function getRunPressureStatus(state: RunPressureState): RunPressureStatus;
export function getRunPressureStatus(state: undefined): undefined;
export function getRunPressureStatus(
  state: RunPressureState | undefined
): RunPressureStatus | undefined;
export function getRunPressureStatus(
  state: RunPressureState | undefined
): RunPressureStatus | undefined {
  const normalized = normalizeRunPressureState(state);
  if (!normalized) return undefined;

  if (normalized.clearedNodeCount >= BREACH_AT) {
    return {
      state: normalized,
      tier: 'breach',
      label: '破界',
      pressurePercent: 20,
      rewardBonusPercent: 0,
      nextTierAt: null
    };
  }

  if (normalized.clearedNodeCount >= HUNTED_AT) {
    return {
      state: normalized,
      tier: 'hunted',
      label: '追猎',
      pressurePercent: 10,
      rewardBonusPercent: 5,
      nextTierAt: BREACH_AT
    };
  }

  return {
    state: normalized,
    tier: 'stable',
    label: '稳定',
    pressurePercent: 0,
    rewardBonusPercent: 15,
    nextTierAt: HUNTED_AT
  };
}

export function scaleMonsterForRunPressure<T extends RunPressureMonster>(
  monster: T,
  state: RunPressureState | undefined
): T {
  // Missing state belongs to a legacy run, where this ruleset remains completely disabled.
  const status = getRunPressureStatus(state);
  if (!status || status.pressurePercent === 0) return monster;

  return {
    ...monster,
    maxHp: scaleNonNegativeNumber(monster.maxHp, status.pressurePercent),
    attack: scaleNonNegativeNumber(monster.attack, status.pressurePercent),
    artPower: scaleNonNegativeNumber(monster.artPower, status.pressurePercent),
    defense: scaleNonNegativeNumber(monster.defense, status.pressurePercent),
    speed: scaleNonNegativeNumber(monster.speed, status.pressurePercent)
  };
}

export function scaleTrapForRunPressure<T extends RunPressureTrap>(
  trap: T,
  state: RunPressureState | undefined
): T {
  const status = getRunPressureStatus(state);
  if (!status || status.pressurePercent === 0) return trap;

  return {
    ...trap,
    damage: scaleNonNegativeNumber(trap.damage, status.pressurePercent),
    dc: scaleNonNegativeNumber(trap.dc, status.pressurePercent)
  };
}

export function calculateRunPressureBonus(
  baseRewardPoints: number,
  state: RunPressureState | undefined
): number {
  const status = getRunPressureStatus(state);
  if (
    !status ||
    !Number.isFinite(baseRewardPoints) ||
    baseRewardPoints <= 0 ||
    status.rewardBonusPercent === 0
  ) {
    return 0;
  }

  return Math.floor((baseRewardPoints * status.rewardBonusPercent) / 100);
}
