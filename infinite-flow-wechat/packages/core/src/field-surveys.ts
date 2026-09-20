import { EQUIPMENT, type EquipmentId, type ItemId, type RewardBundle } from './game';
import { getEquipmentAttunementOptions, type EquipmentAttunementId, type EquipmentAttunementMap } from './equipment-system';

export const FIELD_SURVEY_RULES_VERSION = 1 as const;

export type FieldSurveyOption = Readonly<{
  id: string;
  attunementId: EquipmentAttunementId;
  name: string;
  rewardPointsPercent: number;
  cost?: Readonly<Partial<Record<ItemId, number>>>;
  itemDelta?: Readonly<Partial<Record<ItemId, number>>>;
  lingyunDelta?: number;
  hpPercent?: number;
}>;

export type FieldSurveyDefinition = Readonly<{
  id: string;
  nodeId: string;
  options: readonly [FieldSurveyOption, FieldSurveyOption, ...FieldSurveyOption[]];
}>;

export type FieldSurveyFrozenSource = Readonly<{
  equipmentId: EquipmentId;
  attunementId: EquipmentAttunementId;
}>;

export type FieldSurveyResolution = Readonly<{ surveyId: string; optionId: string }>;
export type FieldSurveyRunState = Readonly<{
  rulesVersion: typeof FIELD_SURVEY_RULES_VERSION;
  frozenSources: readonly FieldSurveyFrozenSource[];
  resolvedSurveys: readonly FieldSurveyResolution[];
}>;

const option = (
  id: string,
  attunementId: EquipmentAttunementId,
  name: string,
  rewardPointsPercent: number,
  extra: Omit<FieldSurveyOption, 'id' | 'attunementId' | 'name' | 'rewardPointsPercent'> = {}
): FieldSurveyOption => ({ id, attunementId, name, rewardPointsPercent, ...extra });

export const FIELD_SURVEY_CATALOG = Object.freeze([
  { id: 'survey_demon_bone_marrow', nodeId: 'demon_bone_cache', options: [option('mist_vanguard_fast_search', 'mist_vanguard', '雾痕速搜', 70, { itemDelta: { focus_incense: 1 } }), option('forge_overdrive_crush_bone', 'forge_overdrive', '炉压碎骨', 125, { itemDelta: { demon_bone: 1 }, hpPercent: -12 })] },
  { id: 'survey_metro_lost_property', nodeId: 'lost_locker_reward', options: [option('rift_resonance_mirror_recast', 'rift_resonance', '镜潮复刻', 150, { itemDelta: { mirror_shell: 1 }, hpPercent: -10 }), option('rift_anchor_lost_property', 'rift_anchor', '失物定锚', 80, { cost: { echo_coin: 1 }, itemDelta: { gate_sigil: 1 }, hpPercent: 10 })] },
  { id: 'survey_mine_resonant_vein', nodeId: 'resonant_pick_reward', options: [option('forge_overdrive_overload_vein', 'forge_overdrive', '超载震矿', 130, { itemDelta: { cracked_core: 1 }, hpPercent: -18 }), option('forge_channeling_heat_refine', 'forge_channeling', '余热提纯', 70, { itemDelta: { cracked_core: -1 }, lingyunDelta: 3 })] },
  { id: 'survey_hospital_emergency_stock', nodeId: 'supply_cabinet_reward', options: [option('mist_veilguard_isolation_pack', 'mist_veilguard', '隔离封装', 85, { hpPercent: 25 }), option('rift_anchor_ward_anchor', 'rift_anchor', '病区定锚', 80, { cost: { dispel_talisman: 1 }, itemDelta: { gate_sigil: 1, medicine_ash: 1 } })] },
  { id: 'survey_arena_cracked_prize', nodeId: 'cracked_core_prize', options: [option('forge_overdrive_core_break', 'forge_overdrive', '炉心强拆', 140, { itemDelta: { cracked_core: 1 }, hpPercent: -20 }), option('mist_vanguard_odds_quick_take', 'mist_vanguard', '赔率快取', 75, { itemDelta: { focus_incense: 1, armor_patch: 1 } })] },
  { id: 'survey_archive_void_map', nodeId: 'void_map_reward', options: [option('forge_channeling_fragment_infusion', 'forge_channeling', '残图熔注', 70, { itemDelta: { rift_dust: -1 }, lingyunDelta: 2 }), option('rift_resonance_void_recast', 'rift_resonance', '虚页复刻', 155, { itemDelta: { method_page: -1, rift_dust: 1 }, hpPercent: -10 })] },
  { id: 'survey_citadel_final_cache', nodeId: 'cracked_core_reward', options: [option('mist_veilguard_final_guard', 'mist_veilguard', '终盘回护', 85, { hpPercent: 30 }), option('forge_channeling_core_calculation', 'forge_channeling', '裂核熔算', 65, { itemDelta: { cracked_core: -1, star_iron: -1 }, lingyunDelta: 5 })] },
  { id: 'survey_temporal_observatory_deck', nodeId: 'field_observation_deck', options: [option('chronal_acceleration_future_refraction', 'chronal_acceleration', '未来折射', 170, { itemDelta: { chronal_glass: 1 }, hpPercent: -22 }), option('chronal_stasis_past_calibration', 'chronal_stasis', '过去定标', 80, { cost: { gate_sigil: 1 }, lingyunDelta: 4, hpPercent: 15 })] },
  { id: 'survey_causal_evidence_dais', nodeId: 'evidence_survey_dais', options: [option('chronal_acceleration_causal_projection', 'chronal_acceleration', '因果投影', 180, { itemDelta: { causal_seal: 1 }, hpPercent: -24 }), option('rift_anchor_evidence_recovery', 'rift_anchor', '证据回锚', 85, { lingyunDelta: 4, hpPercent: 18 })] },
  { id: 'survey_entropy_ballast_deck', nodeId: 'entropy_ballast_deck', options: [option('chronal_acceleration_entropy_forecast', 'chronal_acceleration', '熵潮预报', 190, { itemDelta: { entropy_crystal: 1 }, hpPercent: -26 }), option('forge_channeling_ballast_recovery', 'forge_channeling', '压舱回收', 90, { lingyunDelta: 5, hpPercent: 20 })] },
  { id: 'survey_mirror_city_parallax', nodeId: 'mirror_city_survey', options: [option('rift_resonance_parallax_refraction', 'rift_resonance', '视差折取', 200, { itemDelta: { phase_glass: 1 }, hpPercent: -28 }), option('chronal_stasis_mirror_alignment', 'chronal_stasis', '镜相定标', 95, { cost: { gate_sigil: 1 }, lingyunDelta: 6, hpPercent: 22 })] },
  { id: 'survey_redaction_memory_archive', nodeId: 'memory_survey_archive', options: [option('chronal_stasis_restore_deleted_line', 'chronal_stasis', '定序复原删句', 100, { cost: { gate_sigil: 1 }, lingyunDelta: 7, hpPercent: 24 }), option('rift_resonance_extract_redaction_ink', 'rift_resonance', '裂隙析取删界墨', 210, { itemDelta: { redaction_ink: 2 }, hpPercent: -30 })] },
  { id: 'survey_legacy_auction_archive', nodeId: 'archive_survey_gallery', options: [option('chronal_stasis_verify_hammer_chain', 'chronal_stasis', '定序核验执槌链', 105, { cost: { legacy_scrip: 1 }, lingyunDelta: 8, hpPercent: 26 }), option('forge_resonance_melt_counterfeit_lot', 'forge_overdrive', '炉鸣熔验伪拍品', 220, { itemDelta: { legacy_scrip: 2 }, hpPercent: -32 })] },
  {
    id: 'survey_genesis_bloodline_archive',
    nodeId: 'bloodline_survey_archive',
    options: [
      option('forge_overdrive_helix_source_sample', 'forge_overdrive', '断链斧源型取样', 230, { itemDelta: { genesis_serum: 2 }, hpPercent: -34 }),
      option('mist_veilguard_symbiote_archive', 'mist_veilguard', '冠膜血统归档', 115, { itemDelta: { method_page: 1 }, lingyunDelta: 9, hpPercent: 26 }),
      option('rift_anchor_carapace_safe_sample', 'rift_anchor', '甲壳安全取样', 110, { cost: { genesis_serum: 1 }, itemDelta: { rift_dust: 1 }, hpPercent: 30 }),
      option('chronal_stasis_rebirth_snapshot', 'chronal_stasis', '胚核来源快照', 108, { cost: { genesis_serum: 1 }, itemDelta: { chronal_glass: 1 }, lingyunDelta: 5 })
    ]
  },
  {
    id: 'survey_silent_broadcast_archive',
    nodeId: 'field_survey_archive',
    options: [
      option('forge_overdrive_hushblade_frequency_cut', 'forge_overdrive', '断频长刃炉压切谱', 240, { itemDelta: { silence_core: 2 }, hpPercent: -36 }),
      option('mist_veilguard_dead_air_listening', 'mist_veilguard', '死频耳罩静听归档', 122, { itemDelta: { method_page: 1 }, lingyunDelta: 10, hpPercent: 28 }),
      option('rift_anchor_anechoic_pressure_sample', 'rift_anchor', '消声披甲定锚取样', 118, { cost: { silence_core: 1 }, itemDelta: { rift_dust: 1 }, hpPercent: 32 }),
      option('chronal_stasis_last_channel_snapshot', 'chronal_stasis', '末路断播器定频快照', 116, { cost: { silence_core: 1 }, itemDelta: { chronal_glass: 1 }, lingyunDelta: 6 })
    ]
  },
  {
    id: 'survey_shelter_rescue_archive',
    nodeId: 'field_survey_archive',
    options: [
      option('forge_overdrive_rescue_carbine_breach', 'forge_overdrive', '救援卡宾枪炉压破门', 250, { itemDelta: { rescue_badge: 2 }, hpPercent: -38 }),
      option('mist_veilguard_triage_roster', 'mist_veilguard', '分诊目镜雾护点名', 128, { itemDelta: { method_page: 1 }, lingyunDelta: 11, hpPercent: 30 }),
      option('rift_anchor_evacuation_plate_recovery', 'rift_anchor', '撤离护甲裂隙回收', 124, { cost: { rescue_badge: 1 }, itemDelta: { rift_dust: 1 }, hpPercent: 34 }),
      option('chronal_stasis_blackbox_snapshot', 'chronal_stasis', '黑匣信标时序快照', 122, { cost: { rescue_badge: 1 }, itemDelta: { chronal_glass: 1 }, lingyunDelta: 7 })
    ]
  },
  {
    id: 'survey_false_testimony_archive',
    nodeId: 'field_survey_archive',
    options: [
      option('forge_overdrive_cross_examiner_chain', 'forge_overdrive', '诘问裁刃炉压验链', 260, { itemDelta: { truth_fragment: 2 }, hpPercent: -40 }),
      option('mist_veilguard_forensic_review', 'mist_veilguard', '溯证目镜雾护复核', 134, { itemDelta: { method_page: 1 }, lingyunDelta: 12, hpPercent: 32 }),
      option('rift_anchor_custody_bank_sample', 'rift_anchor', '封证护甲定锚取样', 130, { cost: { truth_fragment: 1 }, itemDelta: { rift_dust: 1 }, hpPercent: 36 }),
      option('chronal_stasis_appeal_snapshot', 'chronal_stasis', '翻案印玺终审快照', 128, { cost: { truth_fragment: 1 }, itemDelta: { chronal_glass: 1 }, lingyunDelta: 8 })
    ]
  },
  {
    id: 'survey_combat_replay_cutting_room',
    nodeId: 'field_survey_cutting_room',
    options: [
      option('forge_overdrive_frame_engraver_cut', 'forge_overdrive', '刻帧器炉压拆片', 270, { itemDelta: { combat_reel: 2 }, hpPercent: -42 }),
      option('mist_veilguard_cue_visor_review', 'mist_veilguard', '场记目镜雾护复核', 140, { itemDelta: { method_page: 1 }, lingyunDelta: 13, hpPercent: 34 }),
      option('rift_anchor_buffer_plate_sample', 'rift_anchor', '缓冲护甲定锚取样', 136, { cost: { combat_reel: 1 }, itemDelta: { rift_dust: 1 }, hpPercent: 38 }),
      option('chronal_stasis_thaw_metronome_snapshot', 'chronal_stasis', '解冻节拍器终剪快照', 134, { cost: { combat_reel: 1 }, itemDelta: { chronal_glass: 1 }, lingyunDelta: 9 })
    ]
  },
  {
    id: 'survey_panopticon_refraction_lab',
    nodeId: 'refraction_lab',
    options: [
      option('forge_overdrive_blindline_cutter_test', 'forge_overdrive', '盲线切割器炉压断视', 280, { itemDelta: { observation_shard: 2 }, hpPercent: -44 }),
      option('mist_veilguard_predictive_visor_audit', 'mist_veilguard', '预判目镜雾护逆读', 146, { itemDelta: { method_page: 1 }, lingyunDelta: 14, hpPercent: 36 }),
      option('rift_anchor_matte_prism_refraction', 'rift_anchor', '消光护壳与逆向棱镜联合折射', 142, { cost: { observation_shard: 1 }, itemDelta: { rift_dust: 1, chronal_glass: 1 }, lingyunDelta: 10, hpPercent: 40 })
    ]
  }
] as const) satisfies readonly FieldSurveyDefinition[];

const ATTUNEMENT_IDS = new Set<EquipmentAttunementId>(['mist_vanguard', 'mist_veilguard', 'forge_overdrive', 'forge_channeling', 'rift_resonance', 'rift_anchor', 'chronal_acceleration', 'chronal_stasis']);

export function getFieldSurveyById(id: string): FieldSurveyDefinition | undefined {
  return FIELD_SURVEY_CATALOG.find((survey) => survey.id === id);
}

export function getFieldSurveyByNode(nodeId: string): FieldSurveyDefinition | undefined {
  return FIELD_SURVEY_CATALOG.find((survey) => survey.nodeId === nodeId);
}

function cloneState(state: FieldSurveyRunState): FieldSurveyRunState {
  return { rulesVersion: 1, frozenSources: state.frozenSources.map((source) => ({ ...source })), resolvedSurveys: state.resolvedSurveys.map((resolution) => ({ ...resolution })) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeFieldSurveyRunState(value: unknown): FieldSurveyRunState | undefined {
  if (!isRecord(value) || value.rulesVersion !== 1 || !Array.isArray(value.frozenSources) || !Array.isArray(value.resolvedSurveys)) return undefined;
  const frozenSources: FieldSurveyFrozenSource[] = [];
  const sourceEquipmentIds = new Set<EquipmentId>();
  for (const raw of value.frozenSources) {
    if (!isRecord(raw) || typeof raw.equipmentId !== 'string' || !ATTUNEMENT_IDS.has(raw.attunementId as EquipmentAttunementId) || !EQUIPMENT[raw.equipmentId as EquipmentId]) return undefined;
    const source = { equipmentId: raw.equipmentId as EquipmentId, attunementId: raw.attunementId as EquipmentAttunementId };
    if (sourceEquipmentIds.has(source.equipmentId) || !getEquipmentAttunementOptions(source.equipmentId).some((item) => item.id === source.attunementId)) return undefined;
    sourceEquipmentIds.add(source.equipmentId);
    frozenSources.push(source);
  }
  const resolvedSurveys: FieldSurveyResolution[] = [];
  const surveyKeys = new Set<string>();
  for (const raw of value.resolvedSurveys) {
    if (!isRecord(raw) || typeof raw.surveyId !== 'string' || typeof raw.optionId !== 'string') return undefined;
    const survey = getFieldSurveyById(raw.surveyId);
    const selected = survey?.options.find((item) => item.id === raw.optionId);
    const key = raw.surveyId;
    if (!survey || !selected || surveyKeys.has(key) || !frozenSources.some((source) => source.attunementId === selected.attunementId)) return undefined;
    surveyKeys.add(key);
    resolvedSurveys.push({ surveyId: raw.surveyId, optionId: raw.optionId });
  }
  return { rulesVersion: 1, frozenSources, resolvedSurveys };
}

export function isFieldSurveyRunState(value: unknown): value is FieldSurveyRunState {
  return normalizeFieldSurveyRunState(value) !== undefined;
}

type EquippedInput = readonly EquipmentId[] | Readonly<Record<string, EquipmentId>>;
export function createFieldSurveyRunState(
  equipped: EquippedInput,
  equipmentLevels: Readonly<Partial<Record<EquipmentId, number>>> = {},
  attunements: EquipmentAttunementMap = {}
): FieldSurveyRunState {
  const ids: readonly EquipmentId[] = Array.isArray(equipped) ? equipped : Object.values(equipped) as EquipmentId[];
  const seen = new Set<EquipmentId>();
  const frozenSources: FieldSurveyFrozenSource[] = [];
  for (const equipmentId of ids) {
    if (seen.has(equipmentId) || !EQUIPMENT[equipmentId]) continue;
    seen.add(equipmentId);
    if (equipmentLevels[equipmentId] !== EQUIPMENT[equipmentId].maxLevel) continue;
    const attunementId = attunements[equipmentId];
    if (attunementId && getEquipmentAttunementOptions(equipmentId).some((item) => item.id === attunementId)) frozenSources.push({ equipmentId, attunementId });
  }
  return { rulesVersion: 1, frozenSources, resolvedSurveys: [] };
}

export type FieldSurveyOptionStatus = Readonly<{ surveyId: string; optionId: string; available: boolean; frozen: boolean; resolved: boolean; reason?: 'unknown' | 'not_frozen' | 'resolved' }>;
export function getFieldSurveyOptionStatus(state: FieldSurveyRunState, surveyId: string, optionId: string): FieldSurveyOptionStatus {
  const survey = getFieldSurveyById(surveyId);
  const selected = survey?.options.find((item) => item.id === optionId);
  if (!survey || !selected) return { surveyId, optionId, available: false, frozen: false, resolved: false, reason: 'unknown' };
  const frozen = state.frozenSources.some((source) => source.attunementId === selected.attunementId);
  const resolved = state.resolvedSurveys.some((item) => item.surveyId === surveyId);
  return { surveyId, optionId, available: frozen && !resolved, frozen, resolved, reason: resolved ? 'resolved' : frozen ? undefined : 'not_frozen' };
}

export function resolveFieldSurveyReward(base: RewardBundle, surveyId: string, optionId: string): RewardBundle | undefined {
  const selected = getFieldSurveyById(surveyId)?.options.find((item) => item.id === optionId);
  if (!selected) return undefined;
  const items: Partial<Record<ItemId, number>> = {};
  for (const [itemId, amount] of Object.entries(base.items ?? {})) {
    if ((amount ?? 0) > 0) items[itemId as ItemId] = amount;
  }
  for (const [itemId, delta] of Object.entries(selected.itemDelta ?? {})) {
    const next = Math.max(0, (items[itemId as ItemId] ?? 0) + (delta ?? 0));
    if (next === 0) delete items[itemId as ItemId]; else items[itemId as ItemId] = next;
  }
  return { rewardPoints: Math.floor((base.rewardPoints ?? 0) * selected.rewardPointsPercent / 100), lingyun: (base.lingyun ?? 0) + (selected.lingyunDelta ?? 0), ...(Object.keys(items).length ? { items } : {}) };
}

export function getFieldSurveyHpDelta(maxHp: number, surveyId: string, optionId: string): number {
  const percent = getFieldSurveyById(surveyId)?.options.find((item) => item.id === optionId)?.hpPercent ?? 0;
  if (!percent || !Number.isFinite(maxHp)) return 0;
  const amount = Math.max(1, Math.floor(Math.abs(maxHp) * Math.abs(percent) / 100));
  return percent > 0 ? amount : -amount;
}

export function markFieldSurveyResolved(state: FieldSurveyRunState, surveyId: string, optionId: string): FieldSurveyRunState {
  if (!getFieldSurveyOptionStatus(state, surveyId, optionId).available) return state;
  return { ...cloneState(state), resolvedSurveys: [...state.resolvedSurveys, { surveyId, optionId }] };
}
