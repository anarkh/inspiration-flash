export const EQUIPMENT_COMMISSION_COST = { rewardPoints: 300, lingyun: 1 } as const;
export const EQUIPMENT_COMMISSION_REQUIRED_DUNGEONS = 3;
export const EQUIPMENT_COMMISSION_MATERIAL_REWARD = 2;

export type EquipmentCommissionState<
  EquipmentId extends string = string,
  ItemId extends string = string,
  DungeonId extends string = string
> = Readonly<{
  rulesVersion: 1;
  equipmentIds: readonly [EquipmentId, EquipmentId];
  targetMaterialId: ItemId;
  completedDungeonIds: readonly DungeonId[];
}>;

export type EquipmentCommissionValidators<
  EquipmentId extends string = string,
  ItemId extends string = string,
  DungeonId extends string = string
> = Readonly<{
  isEquipmentId: (value: unknown) => value is EquipmentId;
  isItemId: (value: unknown) => value is ItemId;
  isDungeonId: (value: unknown) => value is DungeonId;
}>;

type EquipmentCommissionAdvanceResult<
  EquipmentId extends string,
  ItemId extends string,
  DungeonId extends string
> = Readonly<{
  commission?: EquipmentCommissionState<EquipmentId, ItemId, DungeonId>;
  completedDungeonIds: readonly DungeonId[];
  advanced: boolean;
  completed: boolean;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createEquipmentCommission<
  EquipmentId extends string,
  ItemId extends string,
  DungeonId extends string = string
>(
  equipmentIds: readonly [EquipmentId, EquipmentId],
  targetMaterialId: ItemId
): EquipmentCommissionState<EquipmentId, ItemId, DungeonId> {
  if (equipmentIds[0] === equipmentIds[1]) {
    throw new TypeError('Equipment commission requires two distinct equipment IDs.');
  }

  return {
    rulesVersion: 1,
    equipmentIds: [equipmentIds[0], equipmentIds[1]],
    targetMaterialId,
    completedDungeonIds: []
  };
}

export function isEquipmentCommissionSealed<
  EquipmentId extends string,
  ItemId extends string,
  DungeonId extends string
>(
  commission: EquipmentCommissionState<EquipmentId, ItemId, DungeonId> | undefined,
  equipmentId: EquipmentId
): boolean {
  return (
    commission !== undefined &&
    (commission.equipmentIds[0] === equipmentId || commission.equipmentIds[1] === equipmentId)
  );
}

export function advanceEquipmentCommission<
  EquipmentId extends string,
  ItemId extends string,
  DungeonId extends string
>(
  commission: EquipmentCommissionState<EquipmentId, ItemId, DungeonId>,
  dungeonId: DungeonId
): EquipmentCommissionAdvanceResult<EquipmentId, ItemId, DungeonId> {
  if (commission.completedDungeonIds.includes(dungeonId)) {
    return {
      commission,
      completedDungeonIds: commission.completedDungeonIds,
      advanced: false,
      completed: false
    };
  }

  const completedDungeonIds = [...commission.completedDungeonIds, dungeonId];
  if (completedDungeonIds.length >= EQUIPMENT_COMMISSION_REQUIRED_DUNGEONS) {
    return {
      completedDungeonIds,
      advanced: true,
      completed: true
    };
  }

  const nextCommission: EquipmentCommissionState<EquipmentId, ItemId, DungeonId> = {
    rulesVersion: 1,
    equipmentIds: [commission.equipmentIds[0], commission.equipmentIds[1]],
    targetMaterialId: commission.targetMaterialId,
    completedDungeonIds
  };
  return {
    commission: nextCommission,
    completedDungeonIds: nextCommission.completedDungeonIds,
    advanced: true,
    completed: false
  };
}

export function normalizeEquipmentCommission<
  EquipmentId extends string,
  ItemId extends string,
  DungeonId extends string
>(
  value: unknown,
  validators: EquipmentCommissionValidators<EquipmentId, ItemId, DungeonId>
): EquipmentCommissionState<EquipmentId, ItemId, DungeonId> | undefined {
  if (
    !isRecord(value) ||
    value.rulesVersion !== 1 ||
    !Array.isArray(value.equipmentIds) ||
    value.equipmentIds.length !== 2 ||
    !validators.isEquipmentId(value.equipmentIds[0]) ||
    !validators.isEquipmentId(value.equipmentIds[1]) ||
    value.equipmentIds[0] === value.equipmentIds[1] ||
    !validators.isItemId(value.targetMaterialId) ||
    !Array.isArray(value.completedDungeonIds) ||
    value.completedDungeonIds.length >= EQUIPMENT_COMMISSION_REQUIRED_DUNGEONS
  ) {
    return undefined;
  }

  const completedDungeonIds: DungeonId[] = [];
  const seenDungeonIds = new Set<DungeonId>();
  for (const dungeonId of value.completedDungeonIds) {
    if (!validators.isDungeonId(dungeonId) || seenDungeonIds.has(dungeonId)) {
      return undefined;
    }
    seenDungeonIds.add(dungeonId);
    completedDungeonIds.push(dungeonId);
  }

  return {
    rulesVersion: 1,
    equipmentIds: [value.equipmentIds[0], value.equipmentIds[1]],
    targetMaterialId: value.targetMaterialId,
    completedDungeonIds
  };
}
