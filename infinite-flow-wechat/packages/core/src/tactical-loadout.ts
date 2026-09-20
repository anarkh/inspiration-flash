export const TACTICAL_ITEM_IDS = [
  'healing_pill',
  'thunder_talisman',
  'dispel_talisman',
  'gate_sigil',
  'echo_coin',
  'capture_net',
  'spirit_bait',
  'armor_patch',
  'focus_incense'
] as const;

export type TacticalItemId = (typeof TACTICAL_ITEM_IDS)[number];

export const TACTICAL_ITEM_CATEGORIES = ['combat', 'ward', 'portal', 'capture'] as const;

export type TacticalItemCategory = (typeof TACTICAL_ITEM_CATEGORIES)[number];
export type TacticalRigSlotCategory = TacticalItemCategory | 'any';

export type TacticalRigSlot = {
  readonly category: TacticalRigSlotCategory;
};

export type TacticalLoadoutSnapshot = {
  readonly rulesVersion: 1;
  readonly itemIds: readonly TacticalItemId[];
};

export type TacticalLoadoutNormalization = {
  readonly normalizedItemIds: readonly TacticalItemId[];
  readonly invalidItemIds: readonly string[];
  readonly duplicateItemIds: readonly string[];
};

export type TacticalRigSlotAssignment = {
  readonly slotIndex: number;
  readonly category: TacticalRigSlotCategory;
  readonly itemId: TacticalItemId;
};

export type TacticalLoadoutValidation = TacticalLoadoutNormalization & {
  readonly isValid: boolean;
  readonly specializedSlotAssignments: readonly TacticalRigSlotAssignment[];
  readonly generalSlotItemIds: readonly TacticalItemId[];
  readonly generalSlotsUsed: number;
  readonly generalSlotsAvailable: number;
  readonly overflowItemIds: readonly TacticalItemId[];
  readonly reasons: readonly string[];
};

export const DEFAULT_GENERAL_TACTICAL_SLOTS = 3;

export const TACTICAL_ITEM_CATEGORY_BY_ID: Readonly<Record<TacticalItemId, TacticalItemCategory>> = {
  healing_pill: 'combat',
  thunder_talisman: 'combat',
  dispel_talisman: 'ward',
  armor_patch: 'ward',
  focus_incense: 'ward',
  gate_sigil: 'portal',
  echo_coin: 'portal',
  capture_net: 'capture',
  spirit_bait: 'capture'
};

const TACTICAL_ITEM_ID_SET = new Set<string>(TACTICAL_ITEM_IDS);

export function isTacticalItemId(itemId: string): itemId is TacticalItemId {
  return TACTICAL_ITEM_ID_SET.has(itemId);
}

export function getTacticalItemCategory(itemId: string): TacticalItemCategory | undefined {
  return isTacticalItemId(itemId) ? TACTICAL_ITEM_CATEGORY_BY_ID[itemId] : undefined;
}

export function normalizeTacticalLoadout(itemIds: readonly string[]): TacticalLoadoutNormalization {
  const seenItemIds = new Set<string>();
  const reportedDuplicateIds = new Set<string>();
  const normalizedItemIds: TacticalItemId[] = [];
  const invalidItemIds: string[] = [];
  const duplicateItemIds: string[] = [];

  for (const itemId of itemIds) {
    if (seenItemIds.has(itemId)) {
      if (!reportedDuplicateIds.has(itemId)) {
        duplicateItemIds.push(itemId);
        reportedDuplicateIds.add(itemId);
      }
      continue;
    }

    seenItemIds.add(itemId);
    if (isTacticalItemId(itemId)) {
      normalizedItemIds.push(itemId);
    } else {
      invalidItemIds.push(itemId);
    }
  }

  return { normalizedItemIds, invalidItemIds, duplicateItemIds };
}

export function validateTacticalLoadout(
  itemIds: readonly string[],
  rigSlots: readonly TacticalRigSlot[] = []
): TacticalLoadoutValidation {
  const normalization = normalizeTacticalLoadout(itemIds);
  const matchedItemIds = new Set<TacticalItemId>();
  const assignments: Array<TacticalRigSlotAssignment | undefined> = new Array(rigSlots.length);

  // Reserve exact-category slots first so an earlier `any` slot cannot strand a later exact slot.
  for (let slotIndex = 0; slotIndex < rigSlots.length; slotIndex += 1) {
    const slot = rigSlots[slotIndex];
    if (slot.category === 'any') continue;

    const itemId = normalization.normalizedItemIds.find(
      (candidate) => !matchedItemIds.has(candidate) && getTacticalItemCategory(candidate) === slot.category
    );
    if (!itemId) continue;

    matchedItemIds.add(itemId);
    assignments[slotIndex] = { slotIndex, category: slot.category, itemId };
  }

  for (let slotIndex = 0; slotIndex < rigSlots.length; slotIndex += 1) {
    const slot = rigSlots[slotIndex];
    if (slot.category !== 'any') continue;

    const itemId = normalization.normalizedItemIds.find((candidate) => !matchedItemIds.has(candidate));
    if (!itemId) continue;

    matchedItemIds.add(itemId);
    assignments[slotIndex] = { slotIndex, category: slot.category, itemId };
  }

  const unmatchedItemIds = normalization.normalizedItemIds.filter((itemId) => !matchedItemIds.has(itemId));
  const generalSlotItemIds = unmatchedItemIds.slice(0, DEFAULT_GENERAL_TACTICAL_SLOTS);
  const overflowItemIds = unmatchedItemIds.slice(DEFAULT_GENERAL_TACTICAL_SLOTS);
  const reasons: string[] = [];

  if (normalization.invalidItemIds.length > 0) {
    reasons.push(
      `以下 ID 不是战术道具（材料或未知道具）：${normalization.invalidItemIds.join('、')}。`
    );
  }
  if (overflowItemIds.length > 0) {
    reasons.push(
      `专用槽匹配后仍超出 ${DEFAULT_GENERAL_TACTICAL_SLOTS} 个通用槽，溢出：${overflowItemIds.join('、')}。`
    );
  }

  return {
    ...normalization,
    isValid: reasons.length === 0,
    specializedSlotAssignments: assignments.filter(
      (assignment): assignment is TacticalRigSlotAssignment => assignment !== undefined
    ),
    generalSlotItemIds,
    generalSlotsUsed: generalSlotItemIds.length,
    generalSlotsAvailable: DEFAULT_GENERAL_TACTICAL_SLOTS,
    overflowItemIds,
    reasons
  };
}

export function createTacticalLoadoutSnapshot(itemIds: readonly string[]): TacticalLoadoutSnapshot {
  const normalization = normalizeTacticalLoadout(itemIds);
  if (normalization.invalidItemIds.length > 0) {
    throw new TypeError(`无法为非战术道具创建携行快照：${normalization.invalidItemIds.join('、')}。`);
  }

  return {
    rulesVersion: 1,
    itemIds: [...normalization.normalizedItemIds]
  };
}

export function isTacticalItemCarried(
  snapshot: TacticalLoadoutSnapshot | undefined,
  itemId: string
): boolean {
  if (!isTacticalItemId(itemId)) return false;
  return snapshot === undefined || snapshot.itemIds.includes(itemId);
}
