export const RUN_LANTERN_RULES_VERSION = 1 as const;

const RUN_LANTERN_DUNGEON_IDS = ['demon_tower_1'] as const;
const RUN_LANTERN_STATE_KEYS = ['rulesVersion', 'dungeonId', 'oil'] as const;

export type RunLanternDungeonId = (typeof RUN_LANTERN_DUNGEON_IDS)[number];

export type RunLanternDefinition = {
  readonly dungeonId: RunLanternDungeonId;
  readonly startOil: number;
  readonly supplyOil: number;
  readonly contactOilLoss: number;
  readonly supplyNodeIds: readonly string[];
};

/** Only chapters tuned for a lamp budget burn oil; every other run stays lantern-free. */
export const RUN_LANTERN_CATALOG = {
  demon_tower_1: {
    dungeonId: 'demon_tower_1',
    startOil: 12,
    supplyOil: 4,
    contactOilLoss: 2,
    supplyNodeIds: ['north_supply_niche', 'evac_supply_cache', 'last_blessing_reward', 'quiet_prayer_reward']
  }
} as const satisfies Readonly<Record<RunLanternDungeonId, RunLanternDefinition>>;

export type RunLanternState = {
  readonly rulesVersion: typeof RUN_LANTERN_RULES_VERSION;
  readonly dungeonId: RunLanternDungeonId;
  readonly oil: number;
};

export type RunLanternBurnResult = {
  readonly state: RunLanternState;
  readonly burned: number;
  /** True only on the burn that takes the lamp from lit to empty. */
  readonly exhausted: boolean;
};

export type RunLanternRefillResult = {
  readonly state: RunLanternState;
  readonly gained: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  return (
    actualKeys.length === sortedExpectedKeys.length &&
    actualKeys.every((key, index) => key === sortedExpectedKeys[index])
  );
}

function isRunLanternDungeonId(value: unknown): value is RunLanternDungeonId {
  return typeof value === 'string' && (RUN_LANTERN_DUNGEON_IDS as readonly string[]).includes(value);
}

function toSafeAmount(value: number): number {
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

export function getRunLanternDefinition(dungeonId: string): RunLanternDefinition | undefined {
  return isRunLanternDungeonId(dungeonId) ? RUN_LANTERN_CATALOG[dungeonId] : undefined;
}

export function createRunLanternState(dungeonId: string): RunLanternState | undefined {
  const definition = getRunLanternDefinition(dungeonId);
  if (!definition) return undefined;

  return {
    rulesVersion: RUN_LANTERN_RULES_VERSION,
    dungeonId: definition.dungeonId,
    oil: definition.startOil
  };
}

export function normalizeRunLanternState(value: unknown): RunLanternState | undefined {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, RUN_LANTERN_STATE_KEYS) ||
    value.rulesVersion !== RUN_LANTERN_RULES_VERSION ||
    !isRunLanternDungeonId(value.dungeonId) ||
    typeof value.oil !== 'number' ||
    !Number.isSafeInteger(value.oil) ||
    value.oil < 0
  ) {
    return undefined;
  }

  return {
    rulesVersion: RUN_LANTERN_RULES_VERSION,
    dungeonId: value.dungeonId,
    oil: value.oil
  };
}

export function isRunLanternState(value: unknown): value is RunLanternState {
  return normalizeRunLanternState(value) !== undefined;
}

export function burnRunLanternOil(state: RunLanternState, amount: number): RunLanternBurnResult {
  const burned = Math.min(state.oil, toSafeAmount(amount));
  if (burned === 0) return { state, burned: 0, exhausted: false };

  const oil = state.oil - burned;
  return {
    state: { ...state, oil },
    burned,
    exhausted: oil === 0
  };
}

export function isRunLanternSupplyNode(dungeonId: string, nodeId: string): boolean {
  return getRunLanternDefinition(dungeonId)?.supplyNodeIds.includes(nodeId) ?? false;
}

export function refillRunLanternAtNode(state: RunLanternState, nodeId: string): RunLanternRefillResult {
  const definition: RunLanternDefinition = RUN_LANTERN_CATALOG[state.dungeonId];
  if (!definition.supplyNodeIds.includes(nodeId)) return { state, gained: 0 };

  const gained = Math.min(definition.supplyOil, Number.MAX_SAFE_INTEGER - state.oil);
  return {
    state: { ...state, oil: state.oil + gained },
    gained
  };
}
