import type { EquipmentId, EquipmentSlot } from './game';
import type { TacticalItemCategory, TacticalRigSlot } from './tactical-loadout';

const FIELD_RIG_SOURCE_SLOTS = [
  'weapon',
  'head',
  'armor',
  'hands',
  'feet',
  'waist',
  'charm'
] as const satisfies readonly EquipmentSlot[];

export type EquipmentFieldRigId =
  | 'rift_belt_portal_rig'
  | 'cloudstep_charm_capture_rig'
  | 'rift_charm_ward_rig'
  | 'void_lantern_any_rig'
  | 'frame_engraver_combat_rig'
  | 'cue_visor_capture_rig'
  | 'buffer_plate_ward_rig'
  | 'thaw_metronome_any_rig';

export type FieldRigEquipmentId =
  | 'rift_belt'
  | 'cloudstep_charm'
  | 'rift_charm'
  | 'void_lantern'
  | 'frame_engraver'
  | 'cue_visor'
  | 'buffer_plate'
  | 'thaw_metronome';

export type EquipmentFieldRigDefinition = Readonly<
  TacticalRigSlot & {
    id: EquipmentFieldRigId;
    equipmentId: FieldRigEquipmentId;
    category: TacticalItemCategory | 'any';
    name: string;
    description: string;
    sourceSlot: EquipmentSlot;
  }
>;

export const EQUIPMENT_FIELD_RIGS = [
  {
    id: 'rift_belt_portal_rig',
    equipmentId: 'rift_belt',
    category: 'portal',
    name: '传送专用槽',
    description: '裂隙束带提供的专用携行槽，仅可挂载传送类战术道具。',
    sourceSlot: 'waist'
  },
  {
    id: 'cloudstep_charm_capture_rig',
    equipmentId: 'cloudstep_charm',
    category: 'capture',
    name: '捕获专用槽',
    description: '云隙足铃提供的专用携行槽，仅可挂载捕获类战术道具。',
    sourceSlot: 'charm'
  },
  {
    id: 'rift_charm_ward_rig',
    equipmentId: 'rift_charm',
    category: 'ward',
    name: '防护专用槽',
    description: '裂隙护符提供的专用携行槽，仅可挂载防护类战术道具。',
    sourceSlot: 'charm'
  },
  {
    id: 'void_lantern_any_rig',
    equipmentId: 'void_lantern',
    category: 'any',
    name: '通用挂载槽',
    description: '虚界灯提供的通用型专用携行槽，可挂载任意类别的战术道具。',
    sourceSlot: 'charm'
  },
  {
    id: 'frame_engraver_combat_rig',
    equipmentId: 'frame_engraver',
    category: 'combat',
    name: '战斗专用槽',
    description: '帧刻器将武器轨迹留在复演帧中，仅可挂载战斗类战术道具。',
    sourceSlot: 'weapon'
  },
  {
    id: 'cue_visor_capture_rig',
    equipmentId: 'cue_visor',
    category: 'capture',
    name: '捕获专用槽',
    description: '提词面罩标记目标出场时机，仅可挂载捕获类战术道具。',
    sourceSlot: 'head'
  },
  {
    id: 'buffer_plate_ward_rig',
    equipmentId: 'buffer_plate',
    category: 'ward',
    name: '防护专用槽',
    description: '缓冲护甲将防护物资固定在承压层外侧，仅可挂载防护类战术道具。',
    sourceSlot: 'armor'
  },
  {
    id: 'thaw_metronome_any_rig',
    equipmentId: 'thaw_metronome',
    category: 'any',
    name: '通用挂载槽',
    description: '解冻节拍器在重拍间隙重置携行节奏，可挂载任意类别的战术道具。',
    sourceSlot: 'charm'
  }
] as const satisfies readonly EquipmentFieldRigDefinition[];

export function getEquipmentFieldRigByEquipmentId(
  equipmentId: EquipmentId
): EquipmentFieldRigDefinition | undefined {
  return EQUIPMENT_FIELD_RIGS.find((definition) => definition.equipmentId === equipmentId);
}

export function getActiveEquipmentFieldRigs(
  equipped: Readonly<Record<EquipmentSlot, EquipmentId>>
): EquipmentFieldRigDefinition[] {
  const activeRigs: EquipmentFieldRigDefinition[] = [];

  for (const sourceSlot of FIELD_RIG_SOURCE_SLOTS) {
    const definition = getEquipmentFieldRigByEquipmentId(equipped[sourceSlot]);
    if (definition?.sourceSlot === sourceSlot) activeRigs.push(definition);
  }

  return activeRigs;
}

export function getEquipmentFieldRigLabel(equipmentId: EquipmentId): string | undefined {
  return getEquipmentFieldRigByEquipmentId(equipmentId)?.name;
}

export function getEquipmentFieldRigDescription(equipmentId: EquipmentId): string | undefined {
  return getEquipmentFieldRigByEquipmentId(equipmentId)?.description;
}
