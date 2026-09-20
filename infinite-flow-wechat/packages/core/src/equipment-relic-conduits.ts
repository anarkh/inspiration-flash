import type { EquipmentId, EquipmentSlot } from './game';
import type { RunRelicFrameId } from './run-relics';

export type RelicConduitEquipmentId =
  | 'armor_piercing_sword'
  | 'starforged_edge'
  | 'spirit_robe'
  | 'guardian_plate'
  | 'cloudstep_boots'
  | 'void_lantern';

export type RelicConduitSourceSlot = Extract<EquipmentSlot, 'weapon' | 'armor' | 'feet' | 'charm'>;

export type EquipmentRelicConduitDefinition = Readonly<{
  equipmentId: RelicConduitEquipmentId;
  sourceSlot: RelicConduitSourceSlot;
  frameId: RunRelicFrameId;
  minimumLevel: 2;
}>;

export type EquipmentRelicConduitFrameMatch = Readonly<{
  frameId: RunRelicFrameId;
  matched: boolean;
  extraCandidateCount: 0 | 1;
  sourceEquipmentIds: readonly RelicConduitEquipmentId[];
}>;

export const EQUIPMENT_RELIC_CONDUITS = Object.freeze([
  Object.freeze({
    equipmentId: 'armor_piercing_sword',
    sourceSlot: 'weapon',
    frameId: 'assault',
    minimumLevel: 2
  }),
  Object.freeze({
    equipmentId: 'starforged_edge',
    sourceSlot: 'weapon',
    frameId: 'assault',
    minimumLevel: 2
  }),
  Object.freeze({
    equipmentId: 'spirit_robe',
    sourceSlot: 'armor',
    frameId: 'bulwark',
    minimumLevel: 2
  }),
  Object.freeze({
    equipmentId: 'guardian_plate',
    sourceSlot: 'armor',
    frameId: 'bulwark',
    minimumLevel: 2
  }),
  Object.freeze({
    equipmentId: 'cloudstep_boots',
    sourceSlot: 'feet',
    frameId: 'wayfinder',
    minimumLevel: 2
  }),
  Object.freeze({
    equipmentId: 'void_lantern',
    sourceSlot: 'charm',
    frameId: 'wayfinder',
    minimumLevel: 2
  })
] as const) satisfies readonly EquipmentRelicConduitDefinition[];

export function getEquipmentRelicConduitByEquipmentId(
  equipmentId: EquipmentId
): EquipmentRelicConduitDefinition | undefined {
  return EQUIPMENT_RELIC_CONDUITS.find((definition) => definition.equipmentId === equipmentId);
}

export function getActiveEquipmentRelicConduits(
  equipped: Readonly<Record<EquipmentSlot, EquipmentId>>,
  equipmentLevels: Readonly<Partial<Record<EquipmentId, number>>> = {}
): EquipmentRelicConduitDefinition[] {
  return EQUIPMENT_RELIC_CONDUITS.filter((definition) => {
    return (
      equipped[definition.sourceSlot] === definition.equipmentId &&
      (equipmentLevels[definition.equipmentId] ?? 1) >= definition.minimumLevel
    );
  });
}

export function getEquipmentRelicConduitFrameMatch(
  frameId: RunRelicFrameId,
  activeConduits: readonly EquipmentRelicConduitDefinition[]
): EquipmentRelicConduitFrameMatch {
  const activeEquipmentIds = new Set(
    activeConduits
      .filter((definition) => definition.frameId === frameId)
      .map((definition) => definition.equipmentId)
  );
  // Re-scan the catalog so caller order and duplicates cannot change UI source order.
  const sourceEquipmentIds = EQUIPMENT_RELIC_CONDUITS.filter((definition) => {
    return definition.frameId === frameId && activeEquipmentIds.has(definition.equipmentId);
  }).map((definition) => definition.equipmentId);
  const matched = sourceEquipmentIds.length > 0;

  return {
    frameId,
    matched,
    extraCandidateCount: matched ? 1 : 0,
    sourceEquipmentIds
  };
}
