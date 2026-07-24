export type RunReadiness = 'ready' | 'hard' | 'deadly';
export type RunExitStatus = 'cleared' | 'retreated' | 'failed';
export type RunOutcome = 'clean_clear' | 'normal_clear' | 'retreat' | 'failed_recovered';

export type RunEconomyInput = {
  baseRewardPoints: number;
  clearedNodes: number;
  totalNodes: number;
  damageTaken: number;
  captures: number;
  readiness: RunReadiness;
  dungeonTier: number;
  exitStatus: RunExitStatus;
};

export type RunEconomyResult = {
  outcome: RunOutcome;
  score: number;
  rewardMultiplier: number;
  rewardPoints: number;
};

export type RunLootBag<ItemId extends string = string, EquipmentId extends string = string> = {
  readonly rewardPoints: number;
  readonly lingyun: number;
  readonly items: Readonly<Partial<Record<ItemId, number>>>;
  readonly equipmentIds: readonly EquipmentId[];
};

export type RunLootAddition<ItemId extends string = string, EquipmentId extends string = string> = {
  readonly rewardPoints?: number;
  readonly lingyun?: number;
  readonly items?: Readonly<Partial<Record<ItemId, number>>>;
  readonly equipmentIds?: readonly EquipmentId[];
};

export type RunLootItemConsumption<ItemId extends string = string, EquipmentId extends string = string> = {
  readonly bag: RunLootBag<ItemId, EquipmentId>;
  readonly consumed: number;
  readonly remaining: number;
};

export type RunLootSettlement<ItemId extends string = string, EquipmentId extends string = string> = {
  readonly retained: RunLootBag<ItemId, EquipmentId>;
  readonly lost: RunLootBag<ItemId, EquipmentId>;
};

const READINESS_RISK_BONUS: Record<RunReadiness, number> = {
  ready: 0,
  hard: 0.12,
  deadly: 0.24
};

const READINESS_SCORE_BONUS: Record<RunReadiness, number> = {
  ready: 0,
  hard: 70,
  deadly: 140
};

const OUTCOME_SCORE_BONUS: Record<RunOutcome, number> = {
  clean_clear: 250,
  normal_clear: 190,
  retreat: 110,
  failed_recovered: 45
};

const MAX_CAPTURE_REWARD_COUNT = 3;
const FAILED_RECOVERY_FLOOR = 0.12;
const FAILED_RECOVERY_CAP = 0.42;

function getOutcome(input: RunEconomyInput): RunOutcome {
  if (input.exitStatus === 'failed') return 'failed_recovered';
  if (input.exitStatus === 'retreated') return 'retreat';
  if (input.damageTaken <= 0 && input.clearedNodes >= input.totalNodes) return 'clean_clear';

  return 'normal_clear';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundMultiplier(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeLootAmount(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return 0;

  return Math.floor(value);
}

function createEmptyLootItems<ItemId extends string>(): Partial<Record<ItemId, number>> {
  return {} as Partial<Record<ItemId, number>>;
}

function normalizeLootItems<ItemId extends string>(
  items: Readonly<Partial<Record<ItemId, number>>>
): Partial<Record<ItemId, number>> {
  const normalized = createEmptyLootItems<ItemId>();

  for (const [itemId, value] of Object.entries(items) as Array<[ItemId, number | undefined]>) {
    const amount = normalizeLootAmount(value);
    if (amount > 0) normalized[itemId] = amount;
  }

  return normalized;
}

function dedupeEquipmentIds<EquipmentId extends string>(equipmentIds: readonly EquipmentId[]): EquipmentId[] {
  return [...new Set(equipmentIds)];
}

function normalizeRunLootBag<ItemId extends string, EquipmentId extends string>(
  bag: RunLootBag<ItemId, EquipmentId>
): RunLootBag<ItemId, EquipmentId> {
  return {
    rewardPoints: normalizeLootAmount(bag.rewardPoints),
    lingyun: normalizeLootAmount(bag.lingyun),
    items: normalizeLootItems(bag.items),
    equipmentIds: dedupeEquipmentIds(bag.equipmentIds)
  };
}

export function createEmptyRunLootBag<
  ItemId extends string = string,
  EquipmentId extends string = string
>(): RunLootBag<ItemId, EquipmentId> {
  return {
    rewardPoints: 0,
    lingyun: 0,
    items: createEmptyLootItems<ItemId>(),
    equipmentIds: []
  };
}

export function addRunLoot<ItemId extends string, EquipmentId extends string>(
  bag: RunLootBag<ItemId, EquipmentId>,
  addition: RunLootAddition<ItemId, EquipmentId>
): RunLootBag<ItemId, EquipmentId> {
  const normalizedBag = normalizeRunLootBag(bag);
  const items = normalizeLootItems(normalizedBag.items);
  const additionItems = addition.items ?? createEmptyLootItems<ItemId>();

  for (const [itemId, amount] of Object.entries(normalizeLootItems(additionItems)) as Array<[ItemId, number]>) {
    items[itemId] = normalizeLootAmount((items[itemId] ?? 0) + amount);
  }

  return {
    rewardPoints: normalizeLootAmount(normalizedBag.rewardPoints + normalizeLootAmount(addition.rewardPoints)),
    lingyun: normalizeLootAmount(normalizedBag.lingyun + normalizeLootAmount(addition.lingyun)),
    items,
    equipmentIds: dedupeEquipmentIds([...normalizedBag.equipmentIds, ...(addition.equipmentIds ?? [])])
  };
}

export function getRunLootItemCount<ItemId extends string, EquipmentId extends string>(
  bag: RunLootBag<ItemId, EquipmentId>,
  itemId: ItemId
): number {
  return normalizeLootAmount(bag.items[itemId]);
}

export function consumeRunLootItem<ItemId extends string, EquipmentId extends string>(
  bag: RunLootBag<ItemId, EquipmentId>,
  itemId: ItemId,
  amount: number
): RunLootItemConsumption<ItemId, EquipmentId> {
  const normalizedBag = normalizeRunLootBag(bag);
  const requested = normalizeLootAmount(amount);
  const available = getRunLootItemCount(normalizedBag, itemId);
  const consumed = Math.min(available, requested);
  const items = normalizeLootItems(normalizedBag.items);

  if (consumed > 0) {
    const nextAmount = available - consumed;
    if (nextAmount > 0) items[itemId] = nextAmount;
    else delete items[itemId];
  }

  return {
    bag: { ...normalizedBag, items },
    consumed,
    remaining: requested - consumed
  };
}

export function settleRunLoot<ItemId extends string, EquipmentId extends string>(
  bag: RunLootBag<ItemId, EquipmentId>,
  exitStatus: RunExitStatus
): RunLootSettlement<ItemId, EquipmentId> {
  const normalizedBag = normalizeRunLootBag(bag);
  if (exitStatus === 'cleared') {
    return {
      retained: normalizedBag,
      lost: createEmptyRunLootBag<ItemId, EquipmentId>()
    };
  }

  // Retreat keeps half of stackable loot, while failure only recovers 20% of reward points.
  const rewardPointRatio = exitStatus === 'retreated' ? 0.5 : 0.2;
  const stackableRatio = exitStatus === 'retreated' ? 0.5 : 0;
  const retainedItems = createEmptyLootItems<ItemId>();
  const lostItems = createEmptyLootItems<ItemId>();

  for (const [itemId, amount] of Object.entries(normalizedBag.items) as Array<[ItemId, number]>) {
    const retainedAmount = Math.floor(amount * stackableRatio);
    const lostAmount = amount - retainedAmount;
    if (retainedAmount > 0) retainedItems[itemId] = retainedAmount;
    if (lostAmount > 0) lostItems[itemId] = lostAmount;
  }

  const retainedRewardPoints = Math.floor(normalizedBag.rewardPoints * rewardPointRatio);
  const retainedLingyun = Math.floor(normalizedBag.lingyun * stackableRatio);

  return {
    retained: {
      rewardPoints: retainedRewardPoints,
      lingyun: retainedLingyun,
      items: retainedItems,
      equipmentIds: []
    },
    lost: {
      rewardPoints: normalizedBag.rewardPoints - retainedRewardPoints,
      lingyun: normalizedBag.lingyun - retainedLingyun,
      items: lostItems,
      equipmentIds: [...normalizedBag.equipmentIds]
    }
  };
}

export function calculateRunEconomy(input: RunEconomyInput): RunEconomyResult {
  const outcome = getOutcome(input);
  const totalNodes = Math.max(1, Math.floor(input.totalNodes));
  const clearedNodes = clamp(Math.floor(input.clearedNodes), 0, totalNodes);
  const clearedRatio = clearedNodes / totalNodes;
  const dungeonTier = clamp(Math.floor(input.dungeonTier), 1, 10);
  const damageTaken = Math.max(0, input.damageTaken);
  const captureCount = Math.max(0, Math.floor(input.captures));
  // Captures are valuable once per distinct pet route, but cannot be farmed into uncapped payout growth.
  const paidCaptureCount = Math.min(captureCount, MAX_CAPTURE_REWARD_COUNT);
  const tierRiskBonus = (dungeonTier - 1) * 0.05;
  const damagePenalty = Math.min(0.28, damageTaken / (160 + dungeonTier * 24));
  const clearDepthBonus = clearedRatio * 0.35;
  const captureRewardBonus = paidCaptureCount * 0.04;
  const clearBaseMultiplier =
    0.85 + tierRiskBonus + READINESS_RISK_BONUS[input.readiness] + clearDepthBonus + captureRewardBonus - damagePenalty;
  let rewardMultiplier = clearBaseMultiplier;

  if (outcome === 'clean_clear') {
    rewardMultiplier = clearBaseMultiplier + 0.18;
  } else if (outcome === 'retreat') {
    rewardMultiplier = Math.max(0.18, clearBaseMultiplier * (0.32 + clearedRatio * 0.35));
  } else if (outcome === 'failed_recovered') {
    rewardMultiplier = clamp(
      FAILED_RECOVERY_FLOOR +
        clearedRatio * 0.14 +
        tierRiskBonus * 0.2 +
        READINESS_RISK_BONUS[input.readiness] * 0.1 +
        captureRewardBonus * 0.5 -
        damagePenalty * 0.15,
      FAILED_RECOVERY_FLOOR,
      FAILED_RECOVERY_CAP
    );
  }

  const score = Math.max(
    0,
    Math.round(
      dungeonTier * 80 +
        clearedRatio * 420 +
        READINESS_SCORE_BONUS[input.readiness] +
        paidCaptureCount * 55 +
        OUTCOME_SCORE_BONUS[outcome] -
        damagePenalty * 220
    )
  );
  const roundedMultiplier = roundMultiplier(Math.max(0, rewardMultiplier));

  return {
    outcome,
    score,
    rewardMultiplier: roundedMultiplier,
    rewardPoints: Math.floor(Math.max(0, input.baseRewardPoints) * roundedMultiplier)
  };
}
