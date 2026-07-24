import { EQUIPMENT, type DerivedStats, type EquipmentId, type EquipmentSlot, type ItemId } from './game';

export type EquipmentSetTag = 'mist' | 'forge' | 'rift' | 'chronal';

export type EquipmentAttunementId =
  | 'mist_vanguard'
  | 'mist_veilguard'
  | 'forge_overdrive'
  | 'forge_channeling'
  | 'rift_resonance'
  | 'rift_anchor'
  | 'chronal_acceleration'
  | 'chronal_stasis';

export type EquipmentAttunementMap = Readonly<Partial<Record<EquipmentId, EquipmentAttunementId>>>;

export type EquipmentTemperRank = 0 | 1 | 2;

/** Missing entries and explicit zeroes both mean that an item has not been tempered. */
export type EquipmentTemperMap = Readonly<Partial<Record<EquipmentId, EquipmentTemperRank>>>;

export type EquipmentTemperCost = Readonly<{
  rewardPoints: number;
  lingyun?: number;
  items: Readonly<Partial<Record<ItemId, number>>>;
}>;

export type EquipmentTemperRankBonuses = Readonly<
  Record<1 | 2, Readonly<Partial<DerivedStats>>>
>;

export type EquipmentTemperDefinition = Readonly<{
  equipmentId: EquipmentId;
  eligible: boolean;
  maxRank: EquipmentTemperRank;
  materialId: ItemId | undefined;
  rankBonuses: EquipmentTemperRankBonuses;
}>;

export type EquipmentTemperProgress = EquipmentTemperDefinition &
  Readonly<{
    currentRank: EquipmentTemperRank;
    nextRank: 1 | 2 | undefined;
    cumulativeBonus: Readonly<Partial<DerivedStats>>;
    nextCost: EquipmentTemperCost | undefined;
  }>;

export type EquipmentAttunementDefinition = {
  readonly id: EquipmentAttunementId;
  readonly setTag: EquipmentSetTag;
  readonly name: string;
  readonly description: string;
  readonly bonus: Readonly<Partial<DerivedStats>>;
};

export type EquipmentAttunementResonanceProgress = Readonly<{
  weaponId: EquipmentId;
  setTag: EquipmentSetTag | undefined;
  branchId: EquipmentAttunementId | undefined;
  attunedCount: number;
  requiredCount: 3;
  active: boolean;
  name: string;
  effectDescription: string;
}>;

export type EquipmentSystemResult = {
  bonus: Partial<DerivedStats>;
  descriptions: string[];
  activeSets: EquipmentSetTag[];
  activeMasteries: EquipmentSetTag[];
  setCounts: Record<EquipmentSetTag, number>;
  equipmentScores: Partial<Record<EquipmentId, number>>;
  totalScore: number;
};

export type EquipmentSwapPreview = {
  replacedEquipmentId: EquipmentId;
  candidateEquipmentId: EquipmentId;
  statDelta: Record<keyof DerivedStats, number>;
  beforeScore: number;
  afterScore: number;
  scoreDelta: number;
  activatedSets: EquipmentSetTag[];
  deactivatedSets: EquipmentSetTag[];
  activatedMasteries: EquipmentSetTag[];
  deactivatedMasteries: EquipmentSetTag[];
  beforeSetCounts: Record<EquipmentSetTag, number>;
  afterSetCounts: Record<EquipmentSetTag, number>;
};

type EquipmentAffix = {
  name: string;
  bonus: Partial<DerivedStats>;
  perLevel?: Partial<DerivedStats>;
};

type EquipmentSystemDefinition = {
  setTags: EquipmentSetTag[];
  affixes: EquipmentAffix[];
};

type SetEffect = {
  name: string;
  pieces: 2;
  bonus: Partial<DerivedStats>;
  description: string;
  mastery: {
    pieces: 3;
    bonus: Partial<DerivedStats>;
    description: string;
  };
};

const SET_ORDER: EquipmentSetTag[] = ['mist', 'forge', 'rift', 'chronal'];
const DERIVED_STAT_KEYS: readonly (keyof DerivedStats)[] = [
  'body',
  'spirit',
  'agility',
  'luck',
  'maxHp',
  'attack',
  'artPower',
  'defense',
  'speed',
  'trapCheck'
];

const EQUIPMENT_SYSTEM: Record<EquipmentId, EquipmentSystemDefinition> = {
  training_blade: { setTags: [], affixes: [] },
  patched_headwrap: { setTags: [], affixes: [] },
  patched_coat: { setTags: [], affixes: [] },
  patched_gloves: { setTags: [], affixes: [] },
  patched_boots: { setTags: [], affixes: [] },
  patched_belt: { setTags: [], affixes: [] },
  plain_charm: { setTags: [], affixes: [] },
  armor_piercing_sword: {
    setTags: ['forge'],
    affixes: [{ name: '破甲锋线', bonus: { attack: 2 } }]
  },
  bone_spear: {
    setTags: ['mist'],
    affixes: [{ name: '雾影疾刺', bonus: { speed: 1 } }]
  },
  ember_staff: {
    setTags: ['rift'],
    affixes: [{ name: '余烬导流', bonus: { artPower: 2 } }]
  },
  mist_hood: {
    setTags: ['mist'],
    affixes: [{ name: '雾听预兆', bonus: { trapCheck: 2 }, perLevel: { trapCheck: 1 } }]
  },
  spirit_robe: {
    setTags: ['mist'],
    affixes: [{ name: '灵纹避险', bonus: { trapCheck: 2 } }]
  },
  guardian_plate: {
    setTags: ['forge'],
    affixes: [{ name: '界卫承压', bonus: { defense: 2 } }]
  },
  guardian_gauntlets: {
    setTags: ['forge'],
    affixes: [{ name: '界卫反震', bonus: { attack: 1, defense: 1 } }]
  },
  cloudstep_boots: {
    setTags: ['mist'],
    affixes: [{ name: '云隙疾行', bonus: { speed: 1, trapCheck: 1 }, perLevel: { speed: 1 } }]
  },
  rift_belt: {
    setTags: ['rift'],
    affixes: [{ name: '裂隙锚点', bonus: { spirit: 1, artPower: 1 } }]
  },
  cloudstep_charm: {
    setTags: ['mist'],
    affixes: [{ name: '云隙步法', bonus: { speed: 1, trapCheck: 1 } }]
  },
  rift_charm: {
    setTags: ['rift'],
    affixes: [{ name: '裂隙校准', bonus: { artPower: 2 } }]
  },
  starforged_edge: {
    setTags: ['forge'],
    affixes: [{ name: '淬星锋脉', bonus: { attack: 3 } }]
  },
  void_lantern: {
    setTags: ['rift'],
    affixes: [{ name: '虚界观测', bonus: { spirit: 1, artPower: 2 } }]
  },
  chronal_edge: {
    setTags: ['chronal'],
    affixes: [{ name: '逆时锋痕', bonus: { attack: 2 }, perLevel: { artPower: 1 } }]
  },
  chronal_aegis: {
    setTags: ['chronal'],
    affixes: [{ name: '停滞护域', bonus: { maxHp: 16, defense: 2 } }]
  },
  chronal_lens: {
    setTags: ['chronal'],
    affixes: [{ name: '观测校准', bonus: { artPower: 2, speed: 1 }, perLevel: { artPower: 1 } }]
  },
  causal_visor: {
    setTags: ['chronal'],
    affixes: [{ name: '因果校准', bonus: { artPower: 2, trapCheck: 2 }, perLevel: { trapCheck: 1 } }]
  },
  echo_breaker_gauntlets: {
    setTags: ['rift'],
    affixes: [{ name: '破响导流', bonus: { attack: 1, artPower: 2 } }]
  },
  return_anchor_belt: {
    setTags: ['forge'],
    affixes: [{ name: '归返固锚', bonus: { maxHp: 16, defense: 2 } }]
  },
  entropy_compass: {
    setTags: ['chronal'],
    affixes: [{ name: '熵潮测绘', bonus: { artPower: 3, speed: 1 }, perLevel: { trapCheck: 1 } }]
  },
  dissipation_mantle: {
    setTags: ['rift'],
    affixes: [{ name: '耗散护层', bonus: { maxHp: 16, artPower: 2 } }]
  },
  ark_keel_boots: {
    setTags: ['forge'],
    affixes: [{ name: '龙骨定向', bonus: { attack: 1, defense: 2 } }]
  },
  parallax_visor: {
    setTags: ['chronal'],
    affixes: [{ name: '视差校准', bonus: { artPower: 2, trapCheck: 2 }, perLevel: { trapCheck: 1 } }]
  },
  phaseweave_mantle: {
    setTags: ['mist'],
    affixes: [{ name: '相织回护', bonus: { maxHp: 16, defense: 2 } }]
  },
  homecoming_prism: {
    setTags: ['forge'],
    affixes: [{ name: '归真折光', bonus: { attack: 1, artPower: 2 } }]
  },
  redline_edge: {
    setTags: ['mist'],
    affixes: [{ name: '朱批断句', bonus: { attack: 2, artPower: 1 } }]
  },
  palimpsest_mantle: {
    setTags: ['rift'],
    affixes: [{ name: '覆页承稿', bonus: { maxHp: 16, defense: 2 } }]
  },
  final_proof_seal: {
    setTags: ['chronal'],
    affixes: [{ name: '终校定版', bonus: { artPower: 3, defense: 1 } }]
  },
  legacy_gavel: {
    setTags: ['forge'],
    affixes: [{ name: '遗槌定价', bonus: { attack: 3, defense: 1 } }]
  },
  anonymous_veil: {
    setTags: ['mist'],
    affixes: [{ name: '匿名藏价', bonus: { artPower: 2, speed: 1, trapCheck: 2 } }]
  },
  escrow_plate: {
    setTags: ['rift'],
    affixes: [{ name: '托管承契', bonus: { maxHp: 16, defense: 2 } }]
  },
  final_lot_bell: {
    setTags: ['chronal'],
    affixes: [{ name: '终场鸣价', bonus: { artPower: 3, speed: 1 } }]
  },
  helix_cleaver: {
    setTags: ['forge'],
    affixes: [{ name: '螺旋断链', bonus: { attack: 3, artPower: 1 } }]
  },
  symbiote_cowl: {
    setTags: ['mist'],
    affixes: [{ name: '共生预感', bonus: { artPower: 2, speed: 1, trapCheck: 2 } }]
  },
  carapace_harness: {
    setTags: ['rift'],
    affixes: [{ name: '原型增生', bonus: { maxHp: 16, defense: 2 } }]
  },
  rebirth_amulet: {
    setTags: ['chronal'],
    affixes: [{ name: '复燃律动', bonus: { artPower: 3, defense: 1 } }]
  },
  hushblade: {
    setTags: ['forge'],
    affixes: [{ name: '断频炉刃', bonus: { attack: 3, artPower: 1 } }]
  },
  dead_air_headset: {
    setTags: ['mist'],
    affixes: [{ name: '死频听界', bonus: { artPower: 2, speed: 1, trapCheck: 2 } }]
  },
  anechoic_mantle: {
    setTags: ['rift'],
    affixes: [{ name: '无响承压', bonus: { maxHp: 16, defense: 2 } }]
  },
  last_channel_beacon: {
    setTags: ['chronal'],
    affixes: [{ name: '末台定频', bonus: { artPower: 3, defense: 1 } }]
  },
  rescue_carbine: {
    setTags: ['forge'],
    affixes: [{ name: '救援点射', bonus: { attack: 3, artPower: 1 } }]
  },
  triage_visor: {
    setTags: ['mist'],
    affixes: [{ name: '分诊寻生', bonus: { artPower: 2, speed: 1, trapCheck: 2 } }]
  },
  evacuation_plate: {
    setTags: ['rift'],
    affixes: [{ name: '撤离承压', bonus: { maxHp: 16, defense: 2 } }]
  },
  blackbox_beacon: {
    setTags: ['chronal'],
    affixes: [{ name: '黑匣回应', bonus: { artPower: 3, defense: 1 } }]
  },
  cross_examiner_sabre: {
    setTags: ['forge'],
    affixes: [{ name: '诘问裁刃', bonus: { attack: 3, artPower: 1 } }]
  },
  forensic_visor: {
    setTags: ['mist'],
    affixes: [{ name: '溯证定位', bonus: { artPower: 2, speed: 1, trapCheck: 2 } }]
  },
  custody_shell: {
    setTags: ['rift'],
    affixes: [{ name: '封证承压', bonus: { maxHp: 16, defense: 2 } }]
  },
  appeal_seal: {
    setTags: ['chronal'],
    affixes: [{ name: '翻案定证', bonus: { artPower: 3, defense: 1 } }]
  },
  frame_engraver: {
    setTags: ['forge'],
    affixes: [{ name: '定格刻帧', bonus: { attack: 3, artPower: 1 } }]
  },
  cue_visor: {
    setTags: ['mist'],
    affixes: [{ name: '场记索引', bonus: { artPower: 2, speed: 1, trapCheck: 2 } }]
  },
  buffer_plate: {
    setTags: ['rift'],
    affixes: [{ name: '缓冲承压', bonus: { maxHp: 16, defense: 2 } }]
  },
  thaw_metronome: {
    setTags: ['chronal'],
    affixes: [{ name: '解冻拍点', bonus: { artPower: 3, defense: 1 } }]
  },
  blindline_cutter: {
    setTags: ['forge'],
    affixes: [{ name: '盲线断视', bonus: { attack: 3, artPower: 1 } }]
  },
  predictive_visor: {
    setTags: ['mist'],
    affixes: [{ name: '预判逆读', bonus: { artPower: 2, speed: 1, trapCheck: 2 } }]
  },
  matte_shell: {
    setTags: ['rift'],
    affixes: [{ name: '消光承压', bonus: { maxHp: 16, defense: 2 } }]
  },
  inverse_prism: {
    setTags: ['chronal'],
    affixes: [{ name: '逆棱回照', bonus: { artPower: 3, defense: 1 } }]
  }
};

type EligibleEquipmentTemperDefinition = Readonly<{
  materialId: ItemId;
  rankBonuses: EquipmentTemperRankBonuses;
}>;

const EQUIPMENT_TEMPER_DEFINITIONS = {
  training_blade: undefined,
  patched_headwrap: undefined,
  patched_coat: undefined,
  patched_gloves: undefined,
  patched_boots: undefined,
  patched_belt: undefined,
  plain_charm: undefined,
  armor_piercing_sword: {
    materialId: 'demon_bone',
    rankBonuses: { 1: { attack: 2 }, 2: { attack: 2 } }
  },
  bone_spear: {
    materialId: 'demon_bone',
    rankBonuses: { 1: { attack: 1, speed: 3 }, 2: { attack: 2, speed: 1 } }
  },
  ember_staff: {
    materialId: 'medicine_ash',
    rankBonuses: { 1: { artPower: 3 }, 2: { artPower: 3 } }
  },
  mist_hood: {
    materialId: 'hidden_stone',
    rankBonuses: { 1: { speed: 2, trapCheck: 4 }, 2: { speed: 1, trapCheck: 5 } }
  },
  spirit_robe: {
    materialId: 'medicine_ash',
    rankBonuses: { 1: { maxHp: 24, defense: 1 }, 2: { maxHp: 16, defense: 1, trapCheck: 2 } }
  },
  guardian_plate: {
    materialId: 'star_iron',
    rankBonuses: { 1: { maxHp: 24, defense: 1 }, 2: { maxHp: 32, defense: 1 } }
  },
  guardian_gauntlets: {
    materialId: 'star_iron',
    rankBonuses: { 1: { attack: 1, defense: 1 }, 2: { attack: 2, defense: 1 } }
  },
  cloudstep_boots: {
    materialId: 'mirror_shell',
    rankBonuses: { 1: { speed: 4, trapCheck: 2 }, 2: { speed: 5 } }
  },
  rift_belt: {
    materialId: 'hidden_stone',
    rankBonuses: { 1: { artPower: 2, defense: 1 }, 2: { artPower: 2, defense: 1 } }
  },
  cloudstep_charm: {
    materialId: 'mirror_shell',
    rankBonuses: { 1: { speed: 5 }, 2: { speed: 4, trapCheck: 2 } }
  },
  rift_charm: {
    materialId: 'rift_dust',
    rankBonuses: { 1: { artPower: 3 }, 2: { artPower: 3 } }
  },
  starforged_edge: {
    materialId: 'star_iron',
    rankBonuses: { 1: { attack: 2 }, 2: { attack: 1, artPower: 2 } }
  },
  void_lantern: {
    materialId: 'cracked_core',
    rankBonuses: { 1: { artPower: 2, defense: 1 }, 2: { artPower: 2, defense: 1 } }
  },
  chronal_edge: {
    materialId: 'chronal_glass',
    rankBonuses: { 1: { attack: 2 }, 2: { attack: 1, artPower: 2 } }
  },
  chronal_aegis: {
    materialId: 'chronal_glass',
    rankBonuses: { 1: { maxHp: 24, defense: 1 }, 2: { maxHp: 16, defense: 2 } }
  },
  chronal_lens: {
    materialId: 'chronal_glass',
    rankBonuses: { 1: { artPower: 2, defense: 1 }, 2: { artPower: 2, speed: 1 } }
  },
  causal_visor: {
    materialId: 'causal_seal',
    rankBonuses: { 1: { artPower: 2, trapCheck: 2 }, 2: { defense: 1, trapCheck: 4 } }
  },
  echo_breaker_gauntlets: {
    materialId: 'causal_seal',
    rankBonuses: { 1: { attack: 1, artPower: 2 }, 2: { attack: 1, artPower: 2 } }
  },
  return_anchor_belt: {
    materialId: 'causal_seal',
    rankBonuses: { 1: { maxHp: 24, defense: 1 }, 2: { maxHp: 16, defense: 1, speed: 1 } }
  },
  entropy_compass: {
    materialId: 'entropy_crystal',
    rankBonuses: { 1: { artPower: 2, speed: 1 }, 2: { defense: 1, trapCheck: 4 } }
  },
  dissipation_mantle: {
    materialId: 'entropy_crystal',
    rankBonuses: { 1: { maxHp: 24, artPower: 1 }, 2: { artPower: 2, defense: 1 } }
  },
  ark_keel_boots: {
    materialId: 'entropy_crystal',
    rankBonuses: { 1: { speed: 3, defense: 1 }, 2: { maxHp: 16, attack: 1, defense: 1 } }
  },
  parallax_visor: {
    materialId: 'phase_glass',
    rankBonuses: { 1: { artPower: 2, trapCheck: 2 }, 2: { defense: 1, trapCheck: 4 } }
  },
  phaseweave_mantle: {
    materialId: 'phase_glass',
    rankBonuses: { 1: { maxHp: 24, defense: 1 }, 2: { maxHp: 16, artPower: 2 } }
  },
  homecoming_prism: {
    materialId: 'phase_glass',
    rankBonuses: { 1: { artPower: 2, defense: 1 }, 2: { attack: 1, artPower: 2 } }
  },
  redline_edge: {
    materialId: 'redaction_ink',
    rankBonuses: { 1: { attack: 2 }, 2: { attack: 1, artPower: 2 } }
  },
  palimpsest_mantle: {
    materialId: 'redaction_ink',
    rankBonuses: { 1: { maxHp: 24, defense: 1 }, 2: { maxHp: 16, artPower: 2 } }
  },
  final_proof_seal: {
    materialId: 'redaction_ink',
    rankBonuses: { 1: { artPower: 2, defense: 1 }, 2: { artPower: 2, speed: 1 } }
  },
  legacy_gavel: {
    materialId: 'legacy_scrip',
    rankBonuses: { 1: { attack: 2, defense: 1 }, 2: { attack: 2, defense: 1 } }
  },
  anonymous_veil: {
    materialId: 'legacy_scrip',
    rankBonuses: { 1: { artPower: 2, speed: 1 }, 2: { artPower: 2, trapCheck: 2 } }
  },
  escrow_plate: {
    materialId: 'legacy_scrip',
    rankBonuses: { 1: { maxHp: 24, defense: 1 }, 2: { maxHp: 16, defense: 2 } }
  },
  final_lot_bell: {
    materialId: 'legacy_scrip',
    rankBonuses: { 1: { artPower: 2, speed: 1 }, 2: { artPower: 2, speed: 1 } }
  },
  helix_cleaver: {
    materialId: 'genesis_serum',
    rankBonuses: { 1: { attack: 2, artPower: 1 }, 2: { attack: 2, defense: 1 } }
  },
  symbiote_cowl: {
    materialId: 'genesis_serum',
    rankBonuses: { 1: { artPower: 2, speed: 1 }, 2: { speed: 1, trapCheck: 4 } }
  },
  carapace_harness: {
    materialId: 'genesis_serum',
    rankBonuses: { 1: { maxHp: 24, defense: 1 }, 2: { maxHp: 16, defense: 2 } }
  },
  rebirth_amulet: {
    materialId: 'genesis_serum',
    rankBonuses: { 1: { artPower: 2, defense: 1 }, 2: { artPower: 2, defense: 1 } }
  },
  hushblade: {
    materialId: 'silence_core',
    rankBonuses: { 1: { attack: 2, artPower: 1 }, 2: { attack: 2, defense: 1 } }
  },
  dead_air_headset: {
    materialId: 'silence_core',
    rankBonuses: { 1: { artPower: 2, speed: 1, trapCheck: 2 }, 2: { speed: 2, trapCheck: 4 } }
  },
  anechoic_mantle: {
    materialId: 'silence_core',
    rankBonuses: { 1: { maxHp: 24, defense: 1 }, 2: { maxHp: 16, defense: 2 } }
  },
  last_channel_beacon: {
    materialId: 'silence_core',
    rankBonuses: { 1: { artPower: 2, defense: 1 }, 2: { artPower: 2, speed: 1, trapCheck: 2 } }
  },
  rescue_carbine: {
    materialId: 'rescue_badge',
    rankBonuses: { 1: { attack: 2, artPower: 1 }, 2: { attack: 2, defense: 1 } }
  },
  triage_visor: {
    materialId: 'rescue_badge',
    rankBonuses: { 1: { artPower: 2, speed: 1, trapCheck: 2 }, 2: { speed: 2, trapCheck: 4 } }
  },
  evacuation_plate: {
    materialId: 'rescue_badge',
    rankBonuses: { 1: { maxHp: 24, defense: 1 }, 2: { maxHp: 16, defense: 2 } }
  },
  blackbox_beacon: {
    materialId: 'rescue_badge',
    rankBonuses: { 1: { artPower: 2, defense: 1 }, 2: { artPower: 2, speed: 1, trapCheck: 2 } }
  },
  cross_examiner_sabre: {
    materialId: 'truth_fragment',
    rankBonuses: { 1: { attack: 2, artPower: 1 }, 2: { attack: 2, defense: 1 } }
  },
  forensic_visor: {
    materialId: 'truth_fragment',
    rankBonuses: { 1: { artPower: 2, speed: 1, trapCheck: 2 }, 2: { speed: 2, trapCheck: 4 } }
  },
  custody_shell: {
    materialId: 'truth_fragment',
    rankBonuses: { 1: { maxHp: 24, defense: 1 }, 2: { maxHp: 16, defense: 2 } }
  },
  appeal_seal: {
    materialId: 'truth_fragment',
    rankBonuses: { 1: { artPower: 2, defense: 1 }, 2: { artPower: 2, speed: 1, trapCheck: 2 } }
  },
  frame_engraver: {
    materialId: 'combat_reel',
    rankBonuses: { 1: { attack: 2, artPower: 1 }, 2: { attack: 2, defense: 1 } }
  },
  cue_visor: {
    materialId: 'combat_reel',
    rankBonuses: { 1: { artPower: 2, speed: 1, trapCheck: 2 }, 2: { speed: 2, trapCheck: 4 } }
  },
  buffer_plate: {
    materialId: 'combat_reel',
    rankBonuses: { 1: { maxHp: 24, defense: 1 }, 2: { maxHp: 16, defense: 2 } }
  },
  thaw_metronome: {
    materialId: 'combat_reel',
    rankBonuses: { 1: { artPower: 2, defense: 1 }, 2: { artPower: 2, speed: 1, trapCheck: 2 } }
  },
  blindline_cutter: {
    materialId: 'observation_shard',
    rankBonuses: { 1: { attack: 2, artPower: 1 }, 2: { attack: 2, defense: 1 } }
  },
  predictive_visor: {
    materialId: 'observation_shard',
    rankBonuses: { 1: { artPower: 2, speed: 1, trapCheck: 2 }, 2: { speed: 2, trapCheck: 4 } }
  },
  matte_shell: {
    materialId: 'observation_shard',
    rankBonuses: { 1: { maxHp: 24, defense: 1 }, 2: { maxHp: 16, defense: 2 } }
  },
  inverse_prism: {
    materialId: 'observation_shard',
    rankBonuses: { 1: { artPower: 2, defense: 1 }, 2: { artPower: 2, speed: 1, trapCheck: 2 } }
  }
} as const satisfies Readonly<
  Record<EquipmentId, EligibleEquipmentTemperDefinition | undefined>
>;

const SET_EFFECTS: Record<EquipmentSetTag, SetEffect> = {
  mist: {
    name: '雾行',
    pieces: 2,
    bonus: { speed: 2, trapCheck: 3 },
    description: '雾行2件套：速度 +2，陷阱判定 +3。',
    mastery: {
      pieces: 3,
      bonus: { speed: 1, trapCheck: 2 },
      description: '雾行3件专精：速度 +1，陷阱判定 +2。'
    }
  },
  forge: {
    name: '星炉',
    pieces: 2,
    bonus: { attack: 3, defense: 3 },
    description: '星炉2件套：攻击 +3，防御 +3。',
    mastery: {
      pieces: 3,
      bonus: { attack: 2, defense: 1 },
      description: '星炉3件专精：攻击 +2，防御 +1。'
    }
  },
  rift: {
    name: '裂隙',
    pieces: 2,
    bonus: { spirit: 1, artPower: 4 },
    description: '裂隙2件套：灵识 +1，术法 +4。',
    mastery: {
      pieces: 3,
      bonus: { artPower: 3 },
      description: '裂隙3件专精：术法 +3。'
    }
  },
  chronal: {
    name: '时序',
    pieces: 2,
    bonus: { speed: 2, defense: 2 },
    description: '时序2件套：速度 +2，防御 +2。',
    mastery: {
      pieces: 3,
      bonus: { attack: 2, artPower: 2 },
      description: '时序3件专精：攻击 +2，术法 +2。'
    }
  }
};

const EQUIPMENT_ATTUNEMENTS: Record<EquipmentAttunementId, EquipmentAttunementDefinition> = {
  mist_vanguard: {
    id: 'mist_vanguard',
    setTag: 'mist',
    name: '追雾先机',
    description: '强化雾行装备的先手与探路定位：速度 +2，陷阱判定 +2。',
    bonus: { speed: 2, trapCheck: 2 }
  },
  mist_veilguard: {
    id: 'mist_veilguard',
    setTag: 'mist',
    name: '雾幕回护',
    description: '以攻防稳定性补足轻装取舍：攻击 +1，防御 +1。',
    bonus: { attack: 1, defense: 1 }
  },
  forge_overdrive: {
    id: 'forge_overdrive',
    setTag: 'forge',
    name: '星炉重铸',
    description: '强化星炉装备的正面压制定位：攻击 +2，防御 +2。',
    bonus: { attack: 2, defense: 2 }
  },
  forge_channeling: {
    id: 'forge_channeling',
    setTag: 'forge',
    name: '余热导流',
    description: '将炉火余热导向术法与机动，补足重装取舍：术法 +3，速度 +2。',
    bonus: { artPower: 3, speed: 2 }
  },
  rift_resonance: {
    id: 'rift_resonance',
    setTag: 'rift',
    name: '虚界共鸣',
    description: '强化裂隙装备的术法爆发定位：术法 +4。',
    bonus: { artPower: 4 }
  },
  rift_anchor: {
    id: 'rift_anchor',
    setTag: 'rift',
    name: '裂隙固锚',
    description: '以生存稳定性补足施法取舍：生命上限 +24，防御 +2。',
    bonus: { maxHp: 24, defense: 2 }
  },
  chronal_acceleration: {
    id: 'chronal_acceleration',
    setTag: 'chronal',
    name: '时序加速',
    description: '推动观测结果提前落定：攻击 +1，术法 +2，速度 +2。',
    bonus: { attack: 1, artPower: 2, speed: 2 }
  },
  chronal_stasis: {
    id: 'chronal_stasis',
    setTag: 'chronal',
    name: '时序停滞',
    description: '冻结承伤最重的一瞬：生命上限 +24，防御 +2。',
    bonus: { maxHp: 24, defense: 2 }
  }
};

const ATTUNEMENT_OPTIONS_BY_SET: Record<
  EquipmentSetTag,
  readonly [EquipmentAttunementId, EquipmentAttunementId]
> = {
  mist: ['mist_vanguard', 'mist_veilguard'],
  forge: ['forge_overdrive', 'forge_channeling'],
  rift: ['rift_resonance', 'rift_anchor'],
  chronal: ['chronal_acceleration', 'chronal_stasis']
};

const ATTUNEMENT_RESONANCE_REQUIRED_COUNT = 3 as const;
const ATTUNEMENT_RESONANCE_COPY: Record<
  EquipmentAttunementId,
  Readonly<{ name: string; effectDescription: string }>
> = {
  mist_vanguard: {
    name: '追雾先机·同源共鸣',
    effectDescription: '强化武器主动技由速度优势转化的特色伤害。'
  },
  mist_veilguard: {
    name: '雾幕回护·同源共鸣',
    effectDescription: '武器主动技结算时引回雾幕，立即回复少量生命。'
  },
  forge_overdrive: {
    name: '星炉重铸·同源共鸣',
    effectDescription: '强化武器主动技的破甲或攻术合炼特色伤害。'
  },
  forge_channeling: {
    name: '余热导流·同源共鸣',
    effectDescription: '武器主动技以攻击与术法中的优势值进行有界替代缩放。'
  },
  rift_resonance: {
    name: '虚界共鸣·同源铭刻',
    effectDescription: '强化武器主动技的术法爆发伤害。'
  },
  rift_anchor: {
    name: '裂隙固锚·同源共鸣',
    effectDescription: '武器主动技结算时稳定锚点，立即追加少量生命回复。'
  },
  chronal_acceleration: {
    name: '时序加速·同源共鸣',
    effectDescription: '武器主动技将速度优势压入逆转斩击，追加有界伤害。'
  },
  chronal_stasis: {
    name: '时序停滞·同源共鸣',
    effectDescription: '武器主动技冻结受创瞬间，结算后回复少量生命。'
  }
};

const INACTIVE_RESONANCE_COPY = {
  name: '同源铭刻共鸣',
  effectDescription: '当前武器满级并完成铭刻后，可与同套同分支装备形成共鸣。'
} as const;

const STAT_SCORE_WEIGHTS: Record<keyof DerivedStats, number> = {
  body: 18,
  spirit: 18,
  agility: 16,
  luck: 14,
  maxHp: 0.25,
  attack: 4,
  artPower: 3.5,
  defense: 4,
  speed: 2,
  trapCheck: 1.5
};

function addStats(target: Partial<DerivedStats>, source: Partial<DerivedStats>): void {
  for (const [key, value] of Object.entries(source) as Array<[keyof DerivedStats, number]>) {
    target[key] = (target[key] ?? 0) + value;
  }
}

function getSafeLevel(equipmentId: EquipmentId, level: number): number {
  const maxLevel = EQUIPMENT[equipmentId].maxLevel;

  return Math.max(1, Math.min(maxLevel, Math.floor(level)));
}

function getEquipmentBaseAndUpgradeBonus(equipmentId: EquipmentId, level: number): Partial<DerivedStats> {
  const safeLevel = getSafeLevel(equipmentId, level);
  const equipment = EQUIPMENT[equipmentId];
  const bonus: Partial<DerivedStats> = {};

  addStats(bonus, equipment.base);
  for (let i = 1; i < safeLevel; i += 1) {
    addStats(bonus, equipment.perLevel);
  }

  return bonus;
}

function getWeightedScore(stats: Partial<DerivedStats>): number {
  return Object.entries(stats).reduce((total, [key, value]) => {
    return total + value * STAT_SCORE_WEIGHTS[key as keyof DerivedStats];
  }, 0);
}

function getAffixBonus(equipmentId: EquipmentId, level: number): Partial<DerivedStats> {
  const bonus: Partial<DerivedStats> = {};

  for (const affix of EQUIPMENT_SYSTEM[equipmentId].affixes) {
    addStats(bonus, affix.bonus);
    if (affix.perLevel) {
      for (let i = 1; i < level; i += 1) {
        addStats(bonus, affix.perLevel);
      }
    }
  }

  return bonus;
}

function cloneAttunementDefinition(definition: EquipmentAttunementDefinition): EquipmentAttunementDefinition {
  return {
    ...definition,
    bonus: { ...definition.bonus }
  };
}

function getMatchingAttunement(
  equipmentId: EquipmentId,
  attunementId: EquipmentAttunementId | undefined
): EquipmentAttunementDefinition | undefined {
  if (!attunementId) return undefined;

  const definition = EQUIPMENT_ATTUNEMENTS[attunementId];

  // A saved or externally supplied ID only applies to equipment from its own set.
  if (!definition || !EQUIPMENT_SYSTEM[equipmentId].setTags.includes(definition.setTag)) return undefined;

  return definition;
}

function getActiveAttunement(
  equipmentId: EquipmentId,
  level: number,
  attunementId: EquipmentAttunementId | undefined
): EquipmentAttunementDefinition | undefined {
  if (!attunementId || level !== EQUIPMENT[equipmentId].maxLevel) return undefined;

  return getMatchingAttunement(equipmentId, attunementId);
}

function getSafeTemperRank(rank: unknown): EquipmentTemperRank {
  if (typeof rank !== 'number' || Number.isNaN(rank)) return 0;

  return Math.max(0, Math.min(2, Math.floor(rank))) as EquipmentTemperRank;
}

export function getEquipmentTemperDefinition(equipmentId: EquipmentId): EquipmentTemperDefinition {
  const definition = EQUIPMENT_TEMPER_DEFINITIONS[equipmentId];

  if (!definition || EQUIPMENT_SYSTEM[equipmentId].setTags.length === 0) {
    return {
      equipmentId,
      eligible: false,
      maxRank: 0,
      materialId: undefined,
      rankBonuses: {
        1: {},
        2: {}
      }
    };
  }

  return {
    equipmentId,
    eligible: true,
    maxRank: 2,
    materialId: definition.materialId,
    rankBonuses: {
      1: { ...definition.rankBonuses[1] },
      2: { ...definition.rankBonuses[2] }
    }
  };
}

export function getEquipmentTemperProgress(
  equipmentId: EquipmentId,
  ranksOrRank: EquipmentTemperMap | number = 0
): EquipmentTemperProgress {
  const definition = getEquipmentTemperDefinition(equipmentId);
  const requestedRank =
    typeof ranksOrRank === 'number' ? ranksOrRank : ranksOrRank?.[equipmentId] ?? 0;
  const currentRank = definition.eligible ? getSafeTemperRank(requestedRank) : 0;
  const nextRank = currentRank < definition.maxRank ? ((currentRank + 1) as 1 | 2) : undefined;
  const cumulativeBonus: Partial<DerivedStats> = {};

  for (let rank = 1; rank <= currentRank; rank += 1) {
    addStats(cumulativeBonus, definition.rankBonuses[rank as 1 | 2]);
  }

  let nextCost: EquipmentTemperCost | undefined;
  if (nextRank && definition.materialId) {
    nextCost = {
      rewardPoints: nextRank === 1 ? 300 : 500,
      ...(nextRank === 2 ? { lingyun: 1 } : {}),
      items: { [definition.materialId]: nextRank === 1 ? 1 : 2 }
    };
  }

  return {
    ...definition,
    currentRank,
    nextRank,
    cumulativeBonus,
    nextCost
  };
}

export function getEquipmentSetTags(equipmentId: EquipmentId): EquipmentSetTag[] {
  return [...EQUIPMENT_SYSTEM[equipmentId].setTags];
}

export function getEquipmentAttunementDefinition(
  attunementId: EquipmentAttunementId
): EquipmentAttunementDefinition {
  return cloneAttunementDefinition(EQUIPMENT_ATTUNEMENTS[attunementId]);
}

export function getEquipmentAttunementOptions(equipmentId: EquipmentId): EquipmentAttunementDefinition[] {
  return EQUIPMENT_SYSTEM[equipmentId].setTags.flatMap((setTag) => {
    return ATTUNEMENT_OPTIONS_BY_SET[setTag].map((attunementId) => {
      return getEquipmentAttunementDefinition(attunementId);
    });
  });
}

export function getEquipmentAttunementResonanceProgress(
  weaponId: EquipmentId,
  equippedIds: readonly EquipmentId[],
  equipmentLevels: Readonly<Partial<Record<EquipmentId, number>>> = {},
  attunements: EquipmentAttunementMap = {}
): EquipmentAttunementResonanceProgress {
  const branch = getMatchingAttunement(weaponId, attunements[weaponId]);
  const setTag = branch?.setTag ?? EQUIPMENT_SYSTEM[weaponId].setTags[0];

  if (!branch) {
    return {
      weaponId,
      setTag,
      branchId: undefined,
      attunedCount: 0,
      requiredCount: ATTUNEMENT_RESONANCE_REQUIRED_COUNT,
      active: false,
      ...INACTIVE_RESONANCE_COPY
    };
  }

  const uniqueEquippedIds = [...new Set(equippedIds)];
  // Only unique, max-level items with the exact same valid branch count toward the threshold.
  const matchingAttunedCount = uniqueEquippedIds.filter((equipmentId) => {
    const level = getSafeLevel(equipmentId, equipmentLevels[equipmentId] ?? 1);
    return getActiveAttunement(equipmentId, level, attunements[equipmentId])?.id === branch.id;
  }).length;
  const currentWeaponLevel = getSafeLevel(weaponId, equipmentLevels[weaponId] ?? 1);
  const currentWeaponReady =
    EQUIPMENT[weaponId].slot === 'weapon' &&
    uniqueEquippedIds.includes(weaponId) &&
    getActiveAttunement(weaponId, currentWeaponLevel, attunements[weaponId])?.id === branch.id;

  return {
    weaponId,
    setTag: branch.setTag,
    branchId: branch.id,
    attunedCount: matchingAttunedCount,
    requiredCount: ATTUNEMENT_RESONANCE_REQUIRED_COUNT,
    active: currentWeaponReady && matchingAttunedCount >= ATTUNEMENT_RESONANCE_REQUIRED_COUNT,
    ...ATTUNEMENT_RESONANCE_COPY[branch.id]
  };
}

export function getEquipmentScore(
  equipmentId: EquipmentId,
  level: number,
  attunementId?: EquipmentAttunementId,
  temperRanksOrRank: EquipmentTemperMap | number = 0
): number {
  const safeLevel = getSafeLevel(equipmentId, level);
  const stats = getEquipmentBaseAndUpgradeBonus(equipmentId, safeLevel);
  const attunement = getActiveAttunement(equipmentId, safeLevel, attunementId);
  const temperProgress = getEquipmentTemperProgress(equipmentId, temperRanksOrRank);

  addStats(stats, getAffixBonus(equipmentId, safeLevel));
  if (attunement) addStats(stats, attunement.bonus);
  if (temperProgress.currentRank > 0) addStats(stats, temperProgress.cumulativeBonus);

  return Math.round(getWeightedScore(stats));
}

export function getEquipmentSystemBonus(
  equippedIds: readonly EquipmentId[],
  equipmentLevels: Readonly<Partial<Record<EquipmentId, number>>> = {},
  attunements: EquipmentAttunementMap = {},
  temperRanks: EquipmentTemperMap = {}
): EquipmentSystemResult {
  const uniqueEquippedIds = [...new Set(equippedIds)];
  const bonus: Partial<DerivedStats> = {};
  const descriptions: string[] = [];
  const setCounts: Record<EquipmentSetTag, number> = { mist: 0, forge: 0, rift: 0, chronal: 0 };
  const equipmentScores: Partial<Record<EquipmentId, number>> = {};

  for (const equipmentId of uniqueEquippedIds) {
    const safeLevel = getSafeLevel(equipmentId, equipmentLevels[equipmentId] ?? 1);
    const affixBonus = getAffixBonus(equipmentId, safeLevel);
    const attunement = getActiveAttunement(equipmentId, safeLevel, attunements[equipmentId]);
    const temperProgress = getEquipmentTemperProgress(equipmentId, temperRanks);

    addStats(bonus, affixBonus);
    if (attunement) addStats(bonus, attunement.bonus);
    if (temperProgress.currentRank > 0) addStats(bonus, temperProgress.cumulativeBonus);
    equipmentScores[equipmentId] = getEquipmentScore(
      equipmentId,
      safeLevel,
      attunements[equipmentId],
      temperProgress.currentRank
    );

    for (const affix of EQUIPMENT_SYSTEM[equipmentId].affixes) {
      descriptions.push(`${EQUIPMENT[equipmentId].name}词条：${affix.name}。`);
    }
    if (attunement) {
      descriptions.push(`${EQUIPMENT[equipmentId].name}铭刻：${attunement.name}。${attunement.description}`);
    }
    for (const setTag of EQUIPMENT_SYSTEM[equipmentId].setTags) {
      setCounts[setTag] += 1;
    }
  }

  const activeSets: EquipmentSetTag[] = [];
  const activeMasteries: EquipmentSetTag[] = [];
  for (const setTag of SET_ORDER) {
    const effect = SET_EFFECTS[setTag];
    if (setCounts[setTag] >= effect.pieces) {
      activeSets.push(setTag);
      addStats(bonus, effect.bonus);
      descriptions.push(effect.description);
    }
    if (setCounts[setTag] >= effect.mastery.pieces) {
      activeMasteries.push(setTag);
      addStats(bonus, effect.mastery.bonus);
      descriptions.push(effect.mastery.description);
    }
  }

  return {
    bonus,
    descriptions,
    activeSets,
    activeMasteries,
    setCounts,
    equipmentScores,
    totalScore: Object.values(equipmentScores).reduce((total, score) => total + (score ?? 0), 0)
  };
}

function getLoadoutStats(
  equippedIds: readonly EquipmentId[],
  equipmentLevels: Readonly<Partial<Record<EquipmentId, number>>>,
  systemResult: EquipmentSystemResult
): Partial<DerivedStats> {
  const stats: Partial<DerivedStats> = {};

  for (const equipmentId of new Set(equippedIds)) {
    addStats(stats, getEquipmentBaseAndUpgradeBonus(equipmentId, equipmentLevels[equipmentId] ?? 1));
  }
  addStats(stats, systemResult.bonus);

  return stats;
}

function getActivatedTags(before: readonly EquipmentSetTag[], after: readonly EquipmentSetTag[]): EquipmentSetTag[] {
  return SET_ORDER.filter((setTag) => !before.includes(setTag) && after.includes(setTag));
}

function getDeactivatedTags(before: readonly EquipmentSetTag[], after: readonly EquipmentSetTag[]): EquipmentSetTag[] {
  return SET_ORDER.filter((setTag) => before.includes(setTag) && !after.includes(setTag));
}

export function getEquipmentSwapPreview(
  equipped: Readonly<Record<EquipmentSlot, EquipmentId>>,
  candidateEquipmentId: EquipmentId,
  equipmentLevels: Readonly<Partial<Record<EquipmentId, number>>> = {},
  attunements: EquipmentAttunementMap = {},
  temperRanks: EquipmentTemperMap = {}
): EquipmentSwapPreview {
  const candidateSlot = EQUIPMENT[candidateEquipmentId].slot;
  const replacedEquipmentId = equipped[candidateSlot];
  const afterEquipped: Record<EquipmentSlot, EquipmentId> = {
    ...equipped,
    [candidateSlot]: candidateEquipmentId
  };
  const beforeIds = Object.values(equipped);
  const afterIds = Object.values(afterEquipped);
  const beforeSystem = getEquipmentSystemBonus(beforeIds, equipmentLevels, attunements, temperRanks);
  const afterSystem = getEquipmentSystemBonus(afterIds, equipmentLevels, attunements, temperRanks);
  const beforeStats = getLoadoutStats(beforeIds, equipmentLevels, beforeSystem);
  const afterStats = getLoadoutStats(afterIds, equipmentLevels, afterSystem);
  const statDelta = Object.fromEntries(
    DERIVED_STAT_KEYS.map((key) => [key, (afterStats[key] ?? 0) - (beforeStats[key] ?? 0)])
  ) as Record<keyof DerivedStats, number>;

  return {
    replacedEquipmentId,
    candidateEquipmentId,
    statDelta,
    beforeScore: beforeSystem.totalScore,
    afterScore: afterSystem.totalScore,
    scoreDelta: afterSystem.totalScore - beforeSystem.totalScore,
    activatedSets: getActivatedTags(beforeSystem.activeSets, afterSystem.activeSets),
    deactivatedSets: getDeactivatedTags(beforeSystem.activeSets, afterSystem.activeSets),
    activatedMasteries: getActivatedTags(beforeSystem.activeMasteries, afterSystem.activeMasteries),
    deactivatedMasteries: getDeactivatedTags(beforeSystem.activeMasteries, afterSystem.activeMasteries),
    beforeSetCounts: { ...beforeSystem.setCounts },
    afterSetCounts: { ...afterSystem.setCounts }
  };
}
