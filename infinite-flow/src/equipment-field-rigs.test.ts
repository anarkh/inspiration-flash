import { describe, expect, it } from 'vitest';

import {
  EQUIPMENT_FIELD_RIGS,
  getActiveEquipmentFieldRigs,
  getEquipmentFieldRigByEquipmentId,
  getEquipmentFieldRigDescription,
  getEquipmentFieldRigLabel
} from './equipment-field-rigs';
import { FIELD_SURVEY_CATALOG } from './field-surveys';
import { EQUIPMENT, type EquipmentId, type EquipmentSlot } from './game';

const BASIC_EQUIPMENT = {
  weapon: 'training_blade',
  head: 'patched_headwrap',
  armor: 'patched_coat',
  hands: 'patched_gloves',
  feet: 'patched_boots',
  waist: 'patched_belt',
  charm: 'plain_charm'
} as const satisfies Record<EquipmentSlot, EquipmentId>;

const EXPECTED_FIELD_RIGS = [
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
] as const;

describe('equipment field rigs', () => {
  it('maps the eight field-rig equipment items to their exact categories and copy', () => {
    expect(EQUIPMENT_FIELD_RIGS).toEqual(EXPECTED_FIELD_RIGS);

    for (const expected of EXPECTED_FIELD_RIGS) {
      expect(getEquipmentFieldRigByEquipmentId(expected.equipmentId)).toEqual(expected);
      expect(getEquipmentFieldRigLabel(expected.equipmentId)).toBe(expected.name);
      expect(getEquipmentFieldRigDescription(expected.equipmentId)).toBe(expected.description);
    }
  });

  it('activates at most one waist rig before one charm rig and returns a fresh array', () => {
    const equipped = {
      ...BASIC_EQUIPMENT,
      waist: 'rift_belt',
      charm: 'cloudstep_charm'
    } as const satisfies Record<EquipmentSlot, EquipmentId>;

    const firstResult = getActiveEquipmentFieldRigs(equipped);
    const secondResult = getActiveEquipmentFieldRigs(equipped);

    expect(firstResult.map(({ id }) => id)).toEqual([
      'rift_belt_portal_rig',
      'cloudstep_charm_capture_rig'
    ]);
    expect(firstResult).not.toBe(secondResult);
    expect(secondResult).toEqual(firstResult);
  });

  it('activates all four combat-replay field rigs in stable equipment-slot order', () => {
    const equipped = {
      ...BASIC_EQUIPMENT,
      weapon: 'frame_engraver',
      head: 'cue_visor',
      armor: 'buffer_plate',
      charm: 'thaw_metronome'
    } as const satisfies Record<EquipmentSlot, EquipmentId>;

    expect(getActiveEquipmentFieldRigs(equipped).map(({ id, category, sourceSlot }) => ({
      id,
      category,
      sourceSlot
    }))).toEqual([
      { id: 'frame_engraver_combat_rig', category: 'combat', sourceSlot: 'weapon' },
      { id: 'cue_visor_capture_rig', category: 'capture', sourceSlot: 'head' },
      { id: 'buffer_plate_ward_rig', category: 'ward', sourceSlot: 'armor' },
      { id: 'thaw_metronome_any_rig', category: 'any', sourceSlot: 'charm' }
    ]);
  });

  it('keeps forty-nine field-survey options with exact combat-replay and Tier 19 equipment mappings', () => {
    const surveyOptions = FIELD_SURVEY_CATALOG.flatMap(({ options }) => options);
    const combatReplaySurvey = FIELD_SURVEY_CATALOG.find(
      ({ id }) => id === 'survey_combat_replay_cutting_room'
    );
    const tier19Survey = FIELD_SURVEY_CATALOG.find(
      ({ id }) => id === 'survey_panopticon_refraction_lab'
    );
    const tier19EquipmentMappings = [
      {
        id: 'forge_overdrive_blindline_cutter_test',
        attunementId: 'forge_overdrive',
        name: '盲线切割器炉压断视',
        equipmentIds: ['blindline_cutter']
      },
      {
        id: 'mist_veilguard_predictive_visor_audit',
        attunementId: 'mist_veilguard',
        name: '预判目镜雾护逆读',
        equipmentIds: ['predictive_visor']
      },
      {
        id: 'rift_anchor_matte_prism_refraction',
        attunementId: 'rift_anchor',
        name: '消光护壳与逆向棱镜联合折射',
        equipmentIds: ['matte_shell', 'inverse_prism']
      }
    ] as const;

    expect(surveyOptions).toHaveLength(49);
    expect(combatReplaySurvey?.options.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: 'forge_overdrive_frame_engraver_cut', name: '刻帧器炉压拆片' },
      { id: 'mist_veilguard_cue_visor_review', name: '场记目镜雾护复核' },
      { id: 'rift_anchor_buffer_plate_sample', name: '缓冲护甲定锚取样' },
      { id: 'chronal_stasis_thaw_metronome_snapshot', name: '解冻节拍器终剪快照' }
    ]);
    expect(tier19Survey?.options.map(({ id, attunementId, name }) => ({
      id,
      attunementId,
      name,
      equipmentIds: tier19EquipmentMappings.find((mapping) => mapping.id === id)?.equipmentIds
    }))).toEqual(tier19EquipmentMappings);
  });

  it('does not activate owned advanced items that are not equipped', () => {
    const ownedEquipmentIds = ['rift_belt', 'cloudstep_charm'] as const satisfies readonly EquipmentId[];

    expect(ownedEquipmentIds).toEqual(['rift_belt', 'cloudstep_charm']);
    expect(getActiveEquipmentFieldRigs(BASIC_EQUIPMENT)).toEqual([]);
  });

  it('gives every basic item no rig definition or active effect', () => {
    for (const equipmentId of Object.values(BASIC_EQUIPMENT)) {
      expect(getEquipmentFieldRigByEquipmentId(equipmentId)).toBeUndefined();
      expect(getEquipmentFieldRigLabel(equipmentId)).toBeUndefined();
      expect(getEquipmentFieldRigDescription(equipmentId)).toBeUndefined();
    }

    expect(getActiveEquipmentFieldRigs(BASIC_EQUIPMENT)).toEqual([]);
  });

  it('ignores duplicate equipment ids in impossible source slots and preserves stable order', () => {
    const equipped = {
      weapon: 'rift_belt',
      head: 'void_lantern',
      armor: 'cloudstep_charm',
      hands: 'rift_charm',
      feet: 'rift_belt',
      waist: 'rift_belt',
      charm: 'void_lantern'
    } as const satisfies Record<EquipmentSlot, EquipmentId>;
    const snapshot = { ...equipped };

    expect(getActiveEquipmentFieldRigs(equipped).map(({ id }) => id)).toEqual([
      'rift_belt_portal_rig',
      'void_lantern_any_rig'
    ]);
    expect(equipped).toEqual(snapshot);
  });

  it('rejects otherwise valid rig equipment when it is assigned to the wrong source slot', () => {
    const equipped = {
      ...BASIC_EQUIPMENT,
      waist: 'void_lantern',
      charm: 'rift_belt'
    } as const satisfies Record<EquipmentSlot, EquipmentId>;

    expect(getActiveEquipmentFieldRigs(equipped)).toEqual([]);
  });

  it('keeps the exported catalog complete, unique, and aligned with equipment slots', () => {
    expect(EQUIPMENT_FIELD_RIGS).toHaveLength(8);
    expect(new Set(EQUIPMENT_FIELD_RIGS.map(({ id }) => id)).size).toBe(8);
    expect(new Set(EQUIPMENT_FIELD_RIGS.map(({ equipmentId }) => equipmentId)).size).toBe(8);

    for (const definition of EQUIPMENT_FIELD_RIGS) {
      expect(EQUIPMENT[definition.equipmentId].slot).toBe(definition.sourceSlot);
    }

    const equipmentIdsWithRigs = (Object.keys(EQUIPMENT) as EquipmentId[]).filter(
      (equipmentId) => getEquipmentFieldRigByEquipmentId(equipmentId) !== undefined
    );
    expect(equipmentIdsWithRigs).toEqual(EXPECTED_FIELD_RIGS.map(({ equipmentId }) => equipmentId));
  });
});
