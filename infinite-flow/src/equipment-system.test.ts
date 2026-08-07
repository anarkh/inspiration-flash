import { describe, expect, it } from 'vitest';

import {
  getEquipmentAttunementResonanceProgress,
  getEquipmentAttunementDefinition,
  getEquipmentAttunementOptions,
  getEquipmentScore,
  getEquipmentSetTags,
  getEquipmentSwapPreview,
  getEquipmentSystemBonus,
  getEquipmentTemperDefinition,
  getEquipmentTemperProgress,
  type EquipmentAttunementId,
  type EquipmentAttunementMap,
  type EquipmentSetTag,
  type EquipmentTemperMap,
  type EquipmentTemperRankBonuses
} from './equipment-system';
import {
  EQUIPMENT,
  EQUIPMENT_ATTUNEMENT_COST,
  createInitialState,
  upgradeEquipment,
  type DerivedStats,
  type EquipmentId,
  type EquipmentSlot,
  type ItemId
} from './game';

const BASIC_EQUIPMENT = {
  weapon: 'training_blade',
  head: 'patched_headwrap',
  armor: 'patched_coat',
  hands: 'patched_gloves',
  feet: 'patched_boots',
  waist: 'patched_belt',
  charm: 'plain_charm'
} as const satisfies Record<EquipmentSlot, EquipmentId>;

const ADVANCED_EQUIPMENT_BY_SET = {
  mist: [
    'bone_spear',
    'mist_hood',
    'spirit_robe',
    'cloudstep_boots',
    'cloudstep_charm',
    'phaseweave_mantle',
    'redline_edge',
    'anonymous_veil',
    'symbiote_cowl',
    'dead_air_headset',
    'triage_visor',
    'forensic_visor',
    'cue_visor',
    'predictive_visor'
  ],
  forge: [
    'armor_piercing_sword',
    'guardian_plate',
    'guardian_gauntlets',
    'starforged_edge',
    'return_anchor_belt',
    'ark_keel_boots',
    'homecoming_prism',
    'legacy_gavel',
    'helix_cleaver',
    'hushblade',
    'rescue_carbine',
    'breach_shotgun',
    'cross_examiner_sabre',
    'frame_engraver',
    'blindline_cutter'
  ],
  rift: [
    'ember_staff',
    'rift_belt',
    'rift_charm',
    'void_lantern',
    'echo_breaker_gauntlets',
    'dissipation_mantle',
    'palimpsest_mantle',
    'escrow_plate',
    'carapace_harness',
    'anechoic_mantle',
    'evacuation_plate',
    'custody_shell',
    'buffer_plate',
    'matte_shell'
  ],
  chronal: [
    'chronal_edge',
    'chronal_aegis',
    'chronal_lens',
    'causal_visor',
    'entropy_compass',
    'parallax_visor',
    'final_proof_seal',
    'final_lot_bell',
    'rebirth_amulet',
    'last_channel_beacon',
    'blackbox_beacon',
    'appeal_seal',
    'thaw_metronome',
    'inverse_prism',
    'phase_coil_rifle'
  ]
} as const satisfies Record<EquipmentSetTag, readonly EquipmentId[]>;

const ATTUNEMENT_IDS_BY_SET = {
  mist: ['mist_vanguard', 'mist_veilguard'],
  forge: ['forge_overdrive', 'forge_channeling'],
  rift: ['rift_resonance', 'rift_anchor'],
  chronal: ['chronal_acceleration', 'chronal_stasis']
} as const satisfies Record<EquipmentSetTag, readonly [EquipmentAttunementId, EquipmentAttunementId]>;

type AdvancedEquipmentId = (typeof ADVANCED_EQUIPMENT_BY_SET)[EquipmentSetTag][number];

const EXPECTED_TEMPER_DEFINITIONS = {
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
  breach_shotgun: {
    materialId: 'rescue_badge',
    rankBonuses: { 1: { attack: 2, defense: 1 }, 2: { attack: 2, speed: 1 } }
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
  phase_coil_rifle: {
    materialId: 'observation_shard',
    rankBonuses: { 1: { attack: 1, artPower: 2 }, 2: { attack: 2, speed: 1 } }
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
} as const satisfies Record<
  AdvancedEquipmentId,
  { materialId: ItemId; rankBonuses: EquipmentTemperRankBonuses }
>;

const TEMPER_SCORE_WEIGHTS: Record<keyof DerivedStats, number> = {
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

function getWeightedTemperBonus(stats: Readonly<Partial<DerivedStats>>): number {
  return Object.entries(stats).reduce((total, [key, value]) => {
    return total + value * TEMPER_SCORE_WEIGHTS[key as keyof DerivedStats];
  }, 0);
}

function combineStats(
  ...bonuses: ReadonlyArray<Readonly<Partial<DerivedStats>>>
): Partial<DerivedStats> {
  const combined: Partial<DerivedStats> = {};

  for (const bonus of bonuses) {
    for (const [key, value] of Object.entries(bonus) as Array<[keyof DerivedStats, number]>) {
      combined[key] = (combined[key] ?? 0) + value;
    }
  }

  return combined;
}

describe('equipment system', () => {
  it('defines all 58 mature items with balanced set distribution and weighted rank bonuses', () => {
    const advancedEquipmentIds = Object.values(ADVANCED_EQUIPMENT_BY_SET).flat();
    const setCounts = Object.fromEntries(
      Object.entries(ADVANCED_EQUIPMENT_BY_SET).map(([setTag, equipmentIds]) => [
        setTag,
        equipmentIds.length
      ])
    );
    const distribution = Object.values(setCounts);

    expect(advancedEquipmentIds).toHaveLength(58);
    expect(new Set(advancedEquipmentIds).size).toBe(58);
    expect(setCounts).toEqual({ mist: 14, forge: 15, rift: 14, chronal: 15 });
    expect(Math.max(...distribution) - Math.min(...distribution)).toBeLessThanOrEqual(1);
    expect(new Set(Object.keys(EXPECTED_TEMPER_DEFINITIONS))).toEqual(new Set(advancedEquipmentIds));

    for (const equipmentId of advancedEquipmentIds) {
      const expected = EXPECTED_TEMPER_DEFINITIONS[equipmentId];

      expect(getEquipmentTemperDefinition(equipmentId)).toEqual({
        equipmentId,
        eligible: true,
        maxRank: 2,
        ...expected
      });
      for (const rank of [1, 2] as const) {
        const weightedBonus = getWeightedTemperBonus(expected.rankBonuses[rank]);

        expect(weightedBonus).toBeGreaterThanOrEqual(8);
        expect(weightedBonus).toBeLessThanOrEqual(12);
      }
    }
  });

  it('integrates the four auction items as max-level-3 set gear with locked costs and swap previews', () => {
    expect(EQUIPMENT.legacy_gavel).toMatchObject({
      slot: 'weapon', maxLevel: 3, base: { attack: 22, defense: 4 }, perLevel: { attack: 6, defense: 2 },
      cost: { rewardPoints: 1240, lingyun: 4, items: { legacy_scrip: 1, star_iron: 1 } }
    });
    expect(EQUIPMENT.anonymous_veil).toMatchObject({ slot: 'head', maxLevel: 3, base: { spirit: 2, artPower: 12, speed: 2, trapCheck: 5 } });
    expect(EQUIPMENT.escrow_plate).toMatchObject({ slot: 'armor', maxLevel: 3, base: { maxHp: 48, defense: 12, speed: -1 } });
    expect(EQUIPMENT.final_lot_bell).toMatchObject({ slot: 'charm', maxLevel: 3, base: { spirit: 2, artPower: 18, speed: 3 } });

    expect(getEquipmentAttunementOptions('legacy_gavel').map((option) => option.id)).toEqual(ATTUNEMENT_IDS_BY_SET.forge);
    expect(getEquipmentAttunementOptions('anonymous_veil').map((option) => option.id)).toEqual(ATTUNEMENT_IDS_BY_SET.mist);
    expect(getEquipmentAttunementOptions('escrow_plate').map((option) => option.id)).toEqual(ATTUNEMENT_IDS_BY_SET.rift);
    expect(getEquipmentAttunementOptions('final_lot_bell').map((option) => option.id)).toEqual(ATTUNEMENT_IDS_BY_SET.chronal);

    const preview = getEquipmentSwapPreview(BASIC_EQUIPMENT, 'legacy_gavel', { legacy_gavel: 3 });
    expect(preview.replacedEquipmentId).toBe('training_blade');
    expect(preview.candidateEquipmentId).toBe('legacy_gavel');
    expect(preview.scoreDelta).toBeGreaterThan(0);
    expect(preview.afterSetCounts.forge).toBe(1);
  });

  it('integrates the four genesis items with exact costs, growth, sets, attunement, and tempering', () => {
    const cases = [
      ['helix_cleaver', 'forge', 'weapon', { rewardPoints: 1420, lingyun: 5, items: { genesis_serum: 1, star_iron: 1 } }, { attack: 25, artPower: 5 }, { attack: 7, artPower: 2 }],
      ['symbiote_cowl', 'mist', 'head', { rewardPoints: 1380, lingyun: 5, items: { genesis_serum: 1, phase_glass: 1 } }, { spirit: 3, artPower: 15, speed: 3, trapCheck: 6 }, { artPower: 5, speed: 2, trapCheck: 1 }],
      ['carapace_harness', 'rift', 'armor', { rewardPoints: 1460, lingyun: 5, items: { genesis_serum: 1, rift_dust: 1 } }, { maxHp: 56, defense: 14 }, { maxHp: 18, defense: 4 }],
      ['rebirth_amulet', 'chronal', 'charm', { rewardPoints: 1400, lingyun: 5, items: { genesis_serum: 1, chronal_glass: 1 } }, { spirit: 3, artPower: 20, defense: 4 }, { artPower: 7, defense: 2 }]
    ] as const satisfies ReadonlyArray<readonly [EquipmentId, EquipmentSetTag, EquipmentSlot, object, object, object]>;

    for (const [equipmentId, setTag, slot, cost, base, perLevel] of cases) {
      expect(EQUIPMENT[equipmentId]).toMatchObject({ slot, maxLevel: 3, cost, base, perLevel });
      expect(getEquipmentSetTags(equipmentId)).toEqual([setTag]);
      expect(getEquipmentAttunementOptions(equipmentId).map((option) => option.id)).toEqual(ATTUNEMENT_IDS_BY_SET[setTag]);
      expect(getEquipmentTemperDefinition(equipmentId)).toMatchObject({
        equipmentId, eligible: true, maxRank: 2, materialId: 'genesis_serum'
      });
      expect(getEquipmentSwapPreview(BASIC_EQUIPMENT, equipmentId, { [equipmentId]: 3 }).scoreDelta).toBeGreaterThan(0);
    }
  });

  it('integrates the four silent broadcast items as mature set gear with real growth paths', () => {
    const cases = [
      ['hushblade', 'forge', 'weapon', { rewardPoints: 1600, lingyun: 6, items: { silence_core: 1, star_iron: 1 } }, { attack: 28, artPower: 6 }, { attack: 8, artPower: 2 }],
      ['dead_air_headset', 'mist', 'head', { rewardPoints: 1540, lingyun: 6, items: { silence_core: 1, phase_glass: 1 } }, { spirit: 3, artPower: 18, speed: 4, trapCheck: 7 }, { artPower: 5, speed: 2, trapCheck: 2 }],
      ['anechoic_mantle', 'rift', 'armor', { rewardPoints: 1620, lingyun: 6, items: { silence_core: 1, rift_dust: 1 } }, { maxHp: 62, defense: 16 }, { maxHp: 20, defense: 5 }],
      ['last_channel_beacon', 'chronal', 'charm', { rewardPoints: 1580, lingyun: 6, items: { silence_core: 1, chronal_glass: 1 } }, { spirit: 3, artPower: 23, defense: 5 }, { artPower: 8, defense: 2 }]
    ] as const satisfies ReadonlyArray<readonly [EquipmentId, EquipmentSetTag, EquipmentSlot, object, object, object]>;

    for (const [equipmentId, setTag, slot, cost, base, perLevel] of cases) {
      expect(EQUIPMENT[equipmentId]).toMatchObject({ slot, maxLevel: 3, cost, base, perLevel });
      expect(getEquipmentSetTags(equipmentId)).toEqual([setTag]);
      expect(getEquipmentAttunementOptions(equipmentId).map((option) => option.id)).toEqual(
        ATTUNEMENT_IDS_BY_SET[setTag]
      );
      expect(getEquipmentAttunementOptions(equipmentId).every((option) =>
        option.name.length > 0 && option.description.length > 0 && Object.keys(option.bonus).length > 0
      )).toBe(true);
      expect(getEquipmentTemperDefinition(equipmentId)).toMatchObject({
        equipmentId,
        eligible: true,
        maxRank: 2,
        materialId: 'silence_core'
      });
      expect(getEquipmentSwapPreview(BASIC_EQUIPMENT, equipmentId, { [equipmentId]: 3 }).scoreDelta).toBeGreaterThan(0);
    }
  });

  it('integrates the five lost shelter items with two real inscriptions and two badge tempers', () => {
    const cases = [
      ['rescue_carbine', 'forge', 'weapon'],
      ['breach_shotgun', 'forge', 'weapon'],
      ['triage_visor', 'mist', 'head'],
      ['evacuation_plate', 'rift', 'armor'],
      ['blackbox_beacon', 'chronal', 'charm']
    ] as const satisfies ReadonlyArray<readonly [EquipmentId, EquipmentSetTag, EquipmentSlot]>;

    expect(EQUIPMENT.breach_shotgun).toMatchObject({
      name: '破门霰弹枪',
      cost: { rewardPoints: 1820, lingyun: 7, items: { rescue_badge: 1, star_iron: 1 } },
      base: { attack: 35, defense: 2 },
      perLevel: { attack: 10, defense: 1 }
    });

    for (const [equipmentId, setTag, slot] of cases) {
      expect(EQUIPMENT[equipmentId]).toMatchObject({ slot, maxLevel: 3 });
      expect(getEquipmentSetTags(equipmentId)).toEqual([setTag]);
      const attunements = getEquipmentAttunementOptions(equipmentId);
      expect(attunements.map(({ id }) => id)).toEqual(ATTUNEMENT_IDS_BY_SET[setTag]);
      expect(attunements).toHaveLength(2);
      expect(attunements.every(({ description, bonus }) =>
        description.length > 0 && Object.keys(bonus).length > 0
      )).toBe(true);
      const uninscribedScore = getEquipmentScore(equipmentId, 3);
      for (const { id } of attunements) {
        expect(getEquipmentScore(equipmentId, 3, id)).toBeGreaterThan(uninscribedScore);
      }

      expect(getEquipmentTemperDefinition(equipmentId)).toEqual({
        equipmentId,
        eligible: true,
        maxRank: 2,
        ...EXPECTED_TEMPER_DEFINITIONS[equipmentId]
      });
      expect(getEquipmentTemperProgress(equipmentId, 0).nextCost?.items).toEqual({ rescue_badge: 1 });
      expect(getEquipmentTemperProgress(equipmentId, 1).nextCost?.items).toEqual({ rescue_badge: 2 });
      expect(getEquipmentTemperProgress(equipmentId, 2).nextCost).toBeUndefined();
      expect(getEquipmentSwapPreview(BASIC_EQUIPMENT, equipmentId, { [equipmentId]: 3 }).scoreDelta).toBeGreaterThan(0);
    }
  });

  it('integrates the four false-testimony items with two real inscriptions and two truth-fragment tempers', () => {
    const cases = [
      ['cross_examiner_sabre', '诘问裁刃', 'forge', 'weapon'],
      ['forensic_visor', '溯证目镜', 'mist', 'head'],
      ['custody_shell', '封证护甲', 'rift', 'armor'],
      ['appeal_seal', '翻案印玺', 'chronal', 'charm']
    ] as const satisfies ReadonlyArray<readonly [EquipmentId, string, EquipmentSetTag, EquipmentSlot]>;

    for (const [equipmentId, name, setTag, slot] of cases) {
      expect(EQUIPMENT[equipmentId]).toMatchObject({ name, slot, maxLevel: 3 });
      expect(EQUIPMENT[equipmentId].cost.items?.truth_fragment).toBe(1);
      expect(getEquipmentSetTags(equipmentId)).toEqual([setTag]);

      const attunements = getEquipmentAttunementOptions(equipmentId);
      expect(attunements.map(({ id }) => id)).toEqual(ATTUNEMENT_IDS_BY_SET[setTag]);
      expect(attunements).toHaveLength(2);
      expect(attunements.every(({ description, bonus }) =>
        description.length > 0 && Object.keys(bonus).length > 0
      )).toBe(true);
      for (const { id } of attunements) {
        expect(getEquipmentScore(equipmentId, 3, id)).toBeGreaterThan(
          getEquipmentScore(equipmentId, 3)
        );
      }

      expect(getEquipmentTemperDefinition(equipmentId)).toEqual({
        equipmentId,
        eligible: true,
        maxRank: 2,
        ...EXPECTED_TEMPER_DEFINITIONS[equipmentId]
      });
      expect(getEquipmentTemperProgress(equipmentId, 0).nextCost?.items).toEqual({ truth_fragment: 1 });
      expect(getEquipmentTemperProgress(equipmentId, 1).nextCost?.items).toEqual({ truth_fragment: 2 });
      expect(getEquipmentTemperProgress(equipmentId, 2).nextCost).toBeUndefined();
    }
  });

  it('locks the four combat-replay purchase costs', () => {
    const cases = [
      ['frame_engraver', 'forge', 'weapon', 2140, 'star_iron'],
      ['cue_visor', 'mist', 'head', 2080, 'phase_glass'],
      ['buffer_plate', 'rift', 'armor', 2160, 'rift_dust'],
      ['thaw_metronome', 'chronal', 'charm', 2120, 'chronal_glass']
    ] as const satisfies ReadonlyArray<
      readonly [EquipmentId, EquipmentSetTag, EquipmentSlot, number, ItemId]
    >;

    for (const [equipmentId, , slot, rewardPoints, branchMaterialId] of cases) {
      expect(EQUIPMENT[equipmentId]).toMatchObject({
        slot,
        maxLevel: 3,
        cost: {
          rewardPoints,
          lingyun: 9,
          items: { combat_reel: 1, [branchMaterialId]: 1 }
        }
      });
    }
  });

  it('integrates the four combat-replay items with exact upgrade, inscription, and temper paths', () => {
    const cases = [
      ['frame_engraver', 'forge', 'weapon'],
      ['cue_visor', 'mist', 'head'],
      ['buffer_plate', 'rift', 'armor'],
      ['thaw_metronome', 'chronal', 'charm']
    ] as const satisfies ReadonlyArray<readonly [EquipmentId, EquipmentSetTag, EquipmentSlot]>;

    expect(EQUIPMENT_ATTUNEMENT_COST).toEqual({
      rewardPoints: 480,
      lingyun: 1,
      items: { cycle_imprint: 1 }
    });

    for (const [equipmentId, setTag, slot] of cases) {
      expect(EQUIPMENT[equipmentId]).toMatchObject({ slot, maxLevel: 3 });
      expect(getEquipmentSetTags(equipmentId)).toEqual([setTag]);
      expect(getEquipmentAttunementOptions(equipmentId).map(({ id }) => id)).toEqual(
        ATTUNEMENT_IDS_BY_SET[setTag]
      );
      expect(getEquipmentTemperDefinition(equipmentId)).toEqual({
        equipmentId,
        eligible: true,
        maxRank: 2,
        ...EXPECTED_TEMPER_DEFINITIONS[equipmentId]
      });
      expect(getEquipmentTemperProgress(equipmentId, 0).nextCost).toEqual({
        rewardPoints: 300,
        items: { combat_reel: 1 }
      });
      expect(getEquipmentTemperProgress(equipmentId, 1).nextCost).toEqual({
        rewardPoints: 500,
        lingyun: 1,
        items: { combat_reel: 2 }
      });
      expect(getEquipmentSwapPreview(BASIC_EQUIPMENT, equipmentId, { [equipmentId]: 3 }).scoreDelta)
        .toBeGreaterThan(0);
    }

    const upgradeReady = {
      ...createInitialState(),
      rewardPoints: 580,
      lingyun: 1,
      ownedEquipment: ['frame_engraver'] as EquipmentId[],
      equipmentLevels: { frame_engraver: 1 },
      inventory: { ...createInitialState().inventory, cracked_core: 1 }
    };
    const levelTwo = upgradeEquipment(upgradeReady, 'frame_engraver');
    expect(levelTwo).toMatchObject({ rewardPoints: 360, lingyun: 1 });
    expect(levelTwo.equipmentLevels.frame_engraver).toBe(2);
    const levelThree = upgradeEquipment(levelTwo, 'frame_engraver');
    expect(levelThree).toMatchObject({ rewardPoints: 0, lingyun: 0 });
    expect(levelThree.inventory.cracked_core).toBe(0);
    expect(levelThree.equipmentLevels.frame_engraver).toBe(3);
  });

  it('integrates the five Tier-19 items through the shared set, inscription, temper, and score contracts', () => {
    const cases = [
      ['blindline_cutter', 'forge', 'weapon'],
      ['phase_coil_rifle', 'chronal', 'weapon'],
      ['predictive_visor', 'mist', 'head'],
      ['matte_shell', 'rift', 'armor'],
      ['inverse_prism', 'chronal', 'charm']
    ] as const satisfies ReadonlyArray<readonly [EquipmentId, EquipmentSetTag, EquipmentSlot]>;

    expect(EQUIPMENT.phase_coil_rifle).toMatchObject({
      name: '相位线圈步枪',
      cost: { rewardPoints: 2320, lingyun: 10, items: { observation_shard: 1, chronal_glass: 1 } },
      base: { attack: 43, artPower: 12, speed: 2 },
      perLevel: { attack: 13, artPower: 3, speed: 1 }
    });
    expect(getEquipmentScore('phase_coil_rifle', 3)).toBeGreaterThan(
      getEquipmentScore('blindline_cutter', 3)
    );

    for (const [equipmentId, setTag, slot] of cases) {
      expect(EQUIPMENT[equipmentId]).toMatchObject({ slot, maxLevel: 3 });
      expect(getEquipmentSetTags(equipmentId)).toEqual([setTag]);
      expect(getEquipmentAttunementOptions(equipmentId).map(({ id }) => id)).toEqual(
        ATTUNEMENT_IDS_BY_SET[setTag]
      );
      expect(getEquipmentTemperDefinition(equipmentId)).toEqual({
        equipmentId,
        eligible: true,
        maxRank: 2,
        ...EXPECTED_TEMPER_DEFINITIONS[equipmentId]
      });
      expect(getEquipmentTemperProgress(equipmentId, 0).nextCost).toEqual({
        rewardPoints: 300,
        items: { observation_shard: 1 }
      });
      expect(getEquipmentTemperProgress(equipmentId, 1).nextCost).toEqual({
        rewardPoints: 500,
        lingyun: 1,
        items: { observation_shard: 2 }
      });
      expect(getEquipmentTemperProgress(equipmentId, 99)).toMatchObject({
        equipmentId,
        currentRank: 2,
        nextRank: undefined,
        nextCost: undefined
      });
      expect(getEquipmentSwapPreview(BASIC_EQUIPMENT, equipmentId, { [equipmentId]: 3 }).scoreDelta)
        .toBeGreaterThan(0);
    }

    expect(getEquipmentTemperDefinition('frame_engraver').materialId).toBe('combat_reel');
    expect(getEquipmentSetTags('thaw_metronome')).toEqual(['chronal']);
  });

  it('keeps every starter item ineligible even when a positive rank is supplied', () => {
    for (const equipmentId of Object.values(BASIC_EQUIPMENT)) {
      expect(getEquipmentTemperDefinition(equipmentId)).toEqual({
        equipmentId,
        eligible: false,
        maxRank: 0,
        materialId: undefined,
        rankBonuses: { 1: {}, 2: {} }
      });
      expect(getEquipmentTemperProgress(equipmentId, 2)).toMatchObject({
        eligible: false,
        currentRank: 0,
        maxRank: 0,
        nextRank: undefined,
        materialId: undefined,
        cumulativeBonus: {},
        nextCost: undefined
      });
    }
  });

  it('reports rank zero, one, and two bonuses with their exact next costs', () => {
    for (const [equipmentId, expected] of Object.entries(EXPECTED_TEMPER_DEFINITIONS) as Array<
      [AdvancedEquipmentId, (typeof EXPECTED_TEMPER_DEFINITIONS)[AdvancedEquipmentId]]
    >) {
      const rankZero = getEquipmentTemperProgress(equipmentId, {});
      const rankOne = getEquipmentTemperProgress(equipmentId, 1);
      const rankTwo = getEquipmentTemperProgress(equipmentId, { [equipmentId]: 2 } as EquipmentTemperMap);

      expect(rankZero).toMatchObject({
        currentRank: 0,
        nextRank: 1,
        cumulativeBonus: {},
        nextCost: {
          rewardPoints: 300,
          items: { [expected.materialId]: 1 }
        }
      });
      expect(rankOne).toMatchObject({
        currentRank: 1,
        nextRank: 2,
        cumulativeBonus: expected.rankBonuses[1],
        nextCost: {
          rewardPoints: 500,
          lingyun: 1,
          items: { [expected.materialId]: 2 }
        }
      });
      expect(rankTwo).toMatchObject({
        currentRank: 2,
        nextRank: undefined,
        cumulativeBonus: combineStats(expected.rankBonuses[1], expected.rankBonuses[2]),
        nextCost: undefined
      });
    }
  });

  it('clamps malformed numeric ranks without mutating a supplied rank map', () => {
    const ranks = { bone_spear: 1 } as const satisfies EquipmentTemperMap;
    const snapshot = { ...ranks };

    expect(getEquipmentTemperProgress('bone_spear', -4).currentRank).toBe(0);
    expect(getEquipmentTemperProgress('bone_spear', Number.NaN).currentRank).toBe(0);
    expect(getEquipmentTemperProgress('bone_spear', 1.9).currentRank).toBe(1);
    expect(getEquipmentTemperProgress('bone_spear', 99).currentRank).toBe(2);
    expect(getEquipmentTemperProgress('bone_spear', Number.POSITIVE_INFINITY).currentRank).toBe(2);
    expect(getEquipmentTemperProgress('bone_spear', ranks).currentRank).toBe(1);
    expect(ranks).toEqual(snapshot);
  });

  it('threads temper bonuses through item score, system power, and swap deltas', () => {
    const equipmentId = 'armor_piercing_sword' as const;
    const levels = { [equipmentId]: 3 };
    const rankTwo = { [equipmentId]: 2 } as const satisfies EquipmentTemperMap;
    const baseScore = getEquipmentScore(equipmentId, 3);
    const rankOneScore = getEquipmentScore(equipmentId, 3, undefined, 1);
    const rankTwoScore = getEquipmentScore(equipmentId, 3, undefined, 2);
    const baseSystem = getEquipmentSystemBonus([equipmentId], levels);
    const temperedSystem = getEquipmentSystemBonus([equipmentId], levels, {}, rankTwo);
    const baseSwap = getEquipmentSwapPreview(BASIC_EQUIPMENT, equipmentId, levels);
    const temperedSwap = getEquipmentSwapPreview(BASIC_EQUIPMENT, equipmentId, levels, {}, rankTwo);

    expect(rankOneScore - baseScore).toBe(8);
    expect(rankTwoScore - rankOneScore).toBe(8);
    expect(getEquipmentScore(equipmentId, 3, undefined, rankTwo)).toBe(rankTwoScore);
    expect((temperedSystem.bonus.attack ?? 0) - (baseSystem.bonus.attack ?? 0)).toBe(4);
    expect(temperedSystem.totalScore - baseSystem.totalScore).toBe(16);
    expect(temperedSwap.beforeScore).toBe(baseSwap.beforeScore);
    expect(temperedSwap.afterScore - baseSwap.afterScore).toBe(16);
    expect(temperedSwap.scoreDelta - baseSwap.scoreDelta).toBe(16);
    expect(temperedSwap.statDelta.attack - baseSwap.statDelta.attack).toBe(4);
  });

  it('does not let tempering change sets, mastery, attunement validity, resonance, or levels', () => {
    const equipmentIds = ['bone_spear', 'mist_hood', 'spirit_robe'] as const;
    const levels = { bone_spear: 3, mist_hood: 3, spirit_robe: 3 } as const;
    const attunements = {
      bone_spear: 'mist_vanguard',
      mist_hood: 'mist_vanguard',
      spirit_robe: 'mist_vanguard'
    } as const satisfies EquipmentAttunementMap;
    const ranks = { bone_spear: 2, mist_hood: 2, spirit_robe: 2 } as const satisfies EquipmentTemperMap;
    const levelsSnapshot = { ...levels };
    const baseline = getEquipmentSystemBonus(equipmentIds, levels, attunements);
    const resonance = getEquipmentAttunementResonanceProgress(
      'bone_spear',
      equipmentIds,
      levels,
      attunements
    );
    const tempered = getEquipmentSystemBonus(equipmentIds, levels, attunements, ranks);
    const underLevelTempered = getEquipmentSystemBonus(
      ['bone_spear'],
      { bone_spear: 2 },
      { bone_spear: 'mist_vanguard' },
      { bone_spear: 2 }
    );

    expect(tempered.setCounts).toEqual(baseline.setCounts);
    expect(tempered.activeSets).toEqual(baseline.activeSets);
    expect(tempered.activeMasteries).toEqual(baseline.activeMasteries);
    expect(
      getEquipmentAttunementResonanceProgress('bone_spear', equipmentIds, levels, attunements)
    ).toEqual(resonance);
    expect(tempered.descriptions.filter((description) => description.includes('铭刻：'))).toHaveLength(3);
    expect(underLevelTempered.descriptions.some((description) => description.includes('铭刻：'))).toBe(false);
    expect(levels).toEqual(levelsSnapshot);
  });

  it('exposes eight stable attunement definitions with Chinese copy and bonuses', () => {
    const allIds = Object.values(ATTUNEMENT_IDS_BY_SET).flat();

    expect(new Set(allIds).size).toBe(8);
    for (const [setTag, attunementIds] of Object.entries(ATTUNEMENT_IDS_BY_SET) as Array<
      [EquipmentSetTag, readonly EquipmentAttunementId[]]
    >) {
      for (const attunementId of attunementIds) {
        const definition = getEquipmentAttunementDefinition(attunementId);

        expect(definition).toMatchObject({ id: attunementId, setTag });
        expect(definition.name).toMatch(/[\u4e00-\u9fff]/);
        expect(definition.description).toMatch(/[\u4e00-\u9fff]/);
        expect(Object.keys(definition.bonus).length).toBeGreaterThan(0);
      }
    }
  });

  it('offers the matching pair to every advanced item and none to basic equipment', () => {
    for (const [setTag, equipmentIds] of Object.entries(ADVANCED_EQUIPMENT_BY_SET) as Array<
      [EquipmentSetTag, readonly EquipmentId[]]
    >) {
      for (const equipmentId of equipmentIds) {
        expect(getEquipmentAttunementOptions(equipmentId).map(({ id }) => id)).toEqual(
          ATTUNEMENT_IDS_BY_SET[setTag]
        );
      }
    }

    for (const equipmentId of Object.values(BASIC_EQUIPMENT)) {
      expect(getEquipmentAttunementOptions(equipmentId)).toEqual([]);
    }
  });

  it('applies the exact chronal set, branch, and chronal-glass temper contracts', () => {
    const equipmentIds = ['chronal_edge', 'chronal_aegis', 'chronal_lens'] as const;
    const result = getEquipmentSystemBonus(equipmentIds);

    for (const equipmentId of equipmentIds) {
      expect(getEquipmentSetTags(equipmentId)).toEqual(['chronal']);
      expect(getEquipmentAttunementOptions(equipmentId).map(({ id }) => id)).toEqual([
        'chronal_acceleration',
        'chronal_stasis'
      ]);
      expect(getEquipmentTemperDefinition(equipmentId).materialId).toBe('chronal_glass');
      expect(getEquipmentTemperProgress(equipmentId, 0).nextCost?.items).toEqual({ chronal_glass: 1 });
      expect(getEquipmentTemperProgress(equipmentId, 1).nextCost?.items).toEqual({ chronal_glass: 2 });
    }

    expect(getEquipmentAttunementDefinition('chronal_acceleration').bonus).toEqual({
      attack: 1,
      artPower: 2,
      speed: 2
    });
    expect(getEquipmentAttunementDefinition('chronal_stasis').bonus).toEqual({ maxHp: 24, defense: 2 });
    expect(result.activeSets).toEqual(['chronal']);
    expect(result.activeMasteries).toEqual(['chronal']);
    expect(result.setCounts.chronal).toBe(3);
    expect(result.bonus).toMatchObject({ maxHp: 16, attack: 4, artPower: 4, defense: 4, speed: 3 });
    expect(result.descriptions).toContain('时序2件套：速度 +2，防御 +2。');
    expect(result.descriptions).toContain('时序3件专精：攻击 +2，术法 +2。');
  });

  it('integrates the three Tier-9 pieces into existing sets, affixes, and attunement branches', () => {
    const cases = [
      {
        equipmentId: 'causal_visor',
        setTag: 'chronal',
        attunementIds: ['chronal_acceleration', 'chronal_stasis'],
        affixBonus: { artPower: 2, trapCheck: 2 },
        masteryLoadout: ['chronal_edge', 'chronal_lens', 'causal_visor']
      },
      {
        equipmentId: 'echo_breaker_gauntlets',
        setTag: 'rift',
        attunementIds: ['rift_resonance', 'rift_anchor'],
        affixBonus: { attack: 1, artPower: 2 },
        masteryLoadout: ['ember_staff', 'rift_charm', 'echo_breaker_gauntlets']
      },
      {
        equipmentId: 'return_anchor_belt',
        setTag: 'forge',
        attunementIds: ['forge_overdrive', 'forge_channeling'],
        affixBonus: { maxHp: 16, defense: 2 },
        masteryLoadout: ['armor_piercing_sword', 'guardian_plate', 'return_anchor_belt']
      }
    ] as const satisfies ReadonlyArray<{
      equipmentId: EquipmentId;
      setTag: EquipmentSetTag;
      attunementIds: readonly [EquipmentAttunementId, EquipmentAttunementId];
      affixBonus: Readonly<Partial<DerivedStats>>;
      masteryLoadout: readonly EquipmentId[];
    }>;

    for (const { equipmentId, setTag, attunementIds, affixBonus, masteryLoadout } of cases) {
      expect(getEquipmentSetTags(equipmentId)).toEqual([setTag]);
      expect(getEquipmentAttunementOptions(equipmentId).map(({ id }) => id)).toEqual(attunementIds);
      expect(getEquipmentSystemBonus([equipmentId]).bonus).toEqual(affixBonus);

      const mastery = getEquipmentSystemBonus(masteryLoadout);
      expect(mastery.setCounts[setTag]).toBe(3);
      expect(mastery.activeSets).toContain(setTag);
      expect(mastery.activeMasteries).toContain(setTag);
    }

    expect(getEquipmentSystemBonus(['causal_visor'], { causal_visor: 3 }).bonus).toEqual({
      artPower: 2,
      trapCheck: 4
    });
    expect(new Set(Object.values(ATTUNEMENT_IDS_BY_SET).flat()).size).toBe(8);
  });

  it('tempers every Tier-9 piece exclusively with causal seals', () => {
    for (const equipmentId of [
      'causal_visor',
      'echo_breaker_gauntlets',
      'return_anchor_belt'
    ] as const) {
      expect(getEquipmentTemperDefinition(equipmentId)).toMatchObject({
        equipmentId,
        eligible: true,
        maxRank: 2,
        materialId: 'causal_seal'
      });
      expect(getEquipmentTemperProgress(equipmentId, 0).nextCost).toEqual({
        rewardPoints: 300,
        items: { causal_seal: 1 }
      });
      expect(getEquipmentTemperProgress(equipmentId, 1).nextCost).toEqual({
        rewardPoints: 500,
        lingyun: 1,
        items: { causal_seal: 2 }
      });
    }
  });

  it('integrates the three entropy gear pieces with exact affixes, inherited branches, and temper costs', () => {
    const cases = [
      {
        equipmentId: 'entropy_compass',
        setTag: 'chronal',
        affixName: '熵潮测绘',
        affixBonus: { artPower: 3, speed: 1 },
        maxLevelAffixBonus: { artPower: 3, speed: 1, trapCheck: 2 }
      },
      {
        equipmentId: 'dissipation_mantle',
        setTag: 'rift',
        affixName: '耗散护层',
        affixBonus: { maxHp: 16, artPower: 2 },
        maxLevelAffixBonus: { maxHp: 16, artPower: 2 }
      },
      {
        equipmentId: 'ark_keel_boots',
        setTag: 'forge',
        affixName: '龙骨定向',
        affixBonus: { attack: 1, defense: 2 },
        maxLevelAffixBonus: { attack: 1, defense: 2 }
      }
    ] as const satisfies ReadonlyArray<{
      equipmentId: EquipmentId;
      setTag: EquipmentSetTag;
      affixName: string;
      affixBonus: Readonly<Partial<DerivedStats>>;
      maxLevelAffixBonus: Readonly<Partial<DerivedStats>>;
    }>;

    for (const { equipmentId, setTag, affixName, affixBonus, maxLevelAffixBonus } of cases) {
      const expectedTemper = EXPECTED_TEMPER_DEFINITIONS[equipmentId];

      expect(getEquipmentSetTags(equipmentId)).toEqual([setTag]);
      expect(getEquipmentSystemBonus([equipmentId]).bonus).toEqual(affixBonus);
      expect(getEquipmentSystemBonus([equipmentId], { [equipmentId]: 3 }).bonus).toEqual(
        maxLevelAffixBonus
      );
      expect(getEquipmentSystemBonus([equipmentId]).descriptions).toContain(
        `${EQUIPMENT[equipmentId].name}词条：${affixName}。`
      );
      expect(getEquipmentAttunementOptions(equipmentId).map(({ id }) => id)).toEqual(
        ATTUNEMENT_IDS_BY_SET[setTag]
      );
      expect(getEquipmentTemperDefinition(equipmentId)).toEqual({
        equipmentId,
        eligible: true,
        maxRank: 2,
        ...expectedTemper
      });
      expect(getEquipmentTemperProgress(equipmentId, 0).nextCost).toEqual({
        rewardPoints: 300,
        items: { entropy_crystal: 1 }
      });
      expect(getEquipmentTemperProgress(equipmentId, 1).nextCost).toEqual({
        rewardPoints: 500,
        lingyun: 1,
        items: { entropy_crystal: 2 }
      });
    }

    expect(new Set(Object.values(ATTUNEMENT_IDS_BY_SET).flat()).size).toBe(8);
  });

  it('integrates the three Tier-11 phase pieces with exact sets, affixes, branches, and tempers', () => {
    const cases = [
      {
        equipmentId: 'parallax_visor',
        setTag: 'chronal',
        attunementIds: ['chronal_acceleration', 'chronal_stasis'],
        levelOneBonus: { artPower: 2, trapCheck: 2 },
        maxLevelBonus: { artPower: 2, trapCheck: 4 }
      },
      {
        equipmentId: 'phaseweave_mantle',
        setTag: 'mist',
        attunementIds: ['mist_vanguard', 'mist_veilguard'],
        levelOneBonus: { maxHp: 16, defense: 2 },
        maxLevelBonus: { maxHp: 16, defense: 2 }
      },
      {
        equipmentId: 'homecoming_prism',
        setTag: 'forge',
        attunementIds: ['forge_overdrive', 'forge_channeling'],
        levelOneBonus: { attack: 1, artPower: 2 },
        maxLevelBonus: { attack: 1, artPower: 2 }
      }
    ] as const satisfies ReadonlyArray<{
      equipmentId: EquipmentId;
      setTag: EquipmentSetTag;
      attunementIds: readonly [EquipmentAttunementId, EquipmentAttunementId];
      levelOneBonus: Readonly<Partial<DerivedStats>>;
      maxLevelBonus: Readonly<Partial<DerivedStats>>;
    }>;

    for (const { equipmentId, setTag, attunementIds, levelOneBonus, maxLevelBonus } of cases) {
      expect(getEquipmentSetTags(equipmentId)).toEqual([setTag]);
      expect(getEquipmentAttunementOptions(equipmentId).map(({ id }) => id)).toEqual(attunementIds);
      expect(getEquipmentSystemBonus([equipmentId]).bonus).toEqual(levelOneBonus);
      expect(getEquipmentSystemBonus([equipmentId], { [equipmentId]: 3 }).bonus).toEqual(maxLevelBonus);
      expect(getEquipmentTemperDefinition(equipmentId).materialId).toBe('phase_glass');
      expect(getEquipmentTemperProgress(equipmentId, 0).nextCost?.items).toEqual({ phase_glass: 1 });
      expect(getEquipmentTemperProgress(equipmentId, 1).nextCost?.items).toEqual({ phase_glass: 2 });
    }
  });

  it('integrates the three Tier-12 proof pieces with exact sets, affixes, ink tempers, and swap previews', () => {
    const cases = [
      {
        equipmentId: 'redline_edge',
        setTag: 'mist',
        attunementIds: ['mist_vanguard', 'mist_veilguard'],
        affixBonus: { attack: 2, artPower: 1 }
      },
      {
        equipmentId: 'palimpsest_mantle',
        setTag: 'rift',
        attunementIds: ['rift_resonance', 'rift_anchor'],
        affixBonus: { maxHp: 16, defense: 2 }
      },
      {
        equipmentId: 'final_proof_seal',
        setTag: 'chronal',
        attunementIds: ['chronal_acceleration', 'chronal_stasis'],
        affixBonus: { artPower: 3, defense: 1 }
      }
    ] as const satisfies ReadonlyArray<{
      equipmentId: EquipmentId;
      setTag: EquipmentSetTag;
      attunementIds: readonly [EquipmentAttunementId, EquipmentAttunementId];
      affixBonus: Readonly<Partial<DerivedStats>>;
    }>;

    for (const { equipmentId, setTag, attunementIds, affixBonus } of cases) {
      expect(getEquipmentSetTags(equipmentId)).toEqual([setTag]);
      expect(getEquipmentSystemBonus([equipmentId]).bonus).toEqual(affixBonus);
      expect(getEquipmentAttunementOptions(equipmentId).map(({ id }) => id)).toEqual(attunementIds);
      expect(getEquipmentTemperDefinition(equipmentId)).toEqual({
        equipmentId,
        eligible: true,
        maxRank: 2,
        ...EXPECTED_TEMPER_DEFINITIONS[equipmentId]
      });
      expect(getEquipmentTemperProgress(equipmentId, 0).nextCost).toEqual({
        rewardPoints: 300,
        items: { redaction_ink: 1 }
      });
      expect(getEquipmentTemperProgress(equipmentId, 1).nextCost).toEqual({
        rewardPoints: 500,
        lingyun: 1,
        items: { redaction_ink: 2 }
      });

      const preview = getEquipmentSwapPreview(BASIC_EQUIPMENT, equipmentId, {
        [equipmentId]: EQUIPMENT[equipmentId].maxLevel
      }, {
        [equipmentId]: attunementIds[0]
      }, {
        [equipmentId]: 2
      });
      expect(preview.candidateEquipmentId).toBe(equipmentId);
      expect(preview.replacedEquipmentId).toBe(BASIC_EQUIPMENT[EQUIPMENT[equipmentId].slot]);
      expect(preview.afterSetCounts[setTag]).toBe(1);
      expect(preview.scoreDelta).toBeGreaterThan(0);
    }
  });

  it('keeps each set pair distinct while giving both branches similar score value', () => {
    for (const [setTag, equipmentIds] of Object.entries(ADVANCED_EQUIPMENT_BY_SET) as Array<
      [EquipmentSetTag, readonly EquipmentId[]]
    >) {
      const equipmentId = equipmentIds[0];
      const maxLevel = EQUIPMENT[equipmentId].maxLevel;
      const options = getEquipmentAttunementOptions(equipmentId);
      const baseScore = getEquipmentScore(equipmentId, maxLevel);
      const scoreBonuses = options.map(({ id }) => getEquipmentScore(equipmentId, maxLevel, id) - baseScore);

      expect(options.map(({ id }) => id)).toEqual(ATTUNEMENT_IDS_BY_SET[setTag]);
      expect(options[0]?.bonus).not.toEqual(options[1]?.bonus);
      expect(scoreBonuses.every((scoreBonus) => scoreBonus > 0)).toBe(true);
      expect(Math.abs((scoreBonuses[0] ?? 0) - (scoreBonuses[1] ?? 0))).toBeLessThanOrEqual(2);
    }
  });

  it('only applies a valid attunement to an equipped item at max level', () => {
    const maxLevelBaseline = getEquipmentSystemBonus(['bone_spear'], { bone_spear: 3 });
    const active = getEquipmentSystemBonus(
      ['bone_spear'],
      { bone_spear: 3 },
      { bone_spear: 'mist_vanguard' }
    );

    expect(active.bonus.speed).toBe((maxLevelBaseline.bonus.speed ?? 0) + 2);
    expect(active.bonus.trapCheck).toBe((maxLevelBaseline.bonus.trapCheck ?? 0) + 2);
    expect(active.descriptions).toContain(
      '白骨长矛铭刻：追雾先机。强化雾行装备的先手与探路定位：速度 +2，陷阱判定 +2。'
    );
    expect(getEquipmentSystemBonus(['bone_spear'], { bone_spear: 2 }, { bone_spear: 'mist_vanguard' })).toEqual(
      getEquipmentSystemBonus(['bone_spear'], { bone_spear: 2 })
    );
    expect(getEquipmentScore('bone_spear', 2, 'mist_vanguard')).toBe(getEquipmentScore('bone_spear', 2));
  });

  it('ignores mismatched, unknown, and unequipped attunement mappings', () => {
    const levels = { bone_spear: 3, guardian_plate: 3 };
    const baseline = getEquipmentSystemBonus(['bone_spear'], levels);

    expect(
      getEquipmentSystemBonus(['bone_spear'], levels, {
        bone_spear: 'forge_overdrive',
        guardian_plate: 'forge_overdrive'
      })
    ).toEqual(baseline);
    expect(
      getEquipmentSystemBonus(['bone_spear'], levels, {
        bone_spear: 'unknown_attunement' as EquipmentAttunementId
      })
    ).toEqual(baseline);
    expect(getEquipmentScore('bone_spear', 3, 'rift_anchor')).toBe(getEquipmentScore('bone_spear', 3));
  });

  it('does not let attunements change set counts, set activation, or mastery activation', () => {
    const equipmentIds = ['bone_spear', 'mist_hood', 'spirit_robe'] as const;
    const levels = { bone_spear: 3, mist_hood: 3, spirit_robe: 3 };
    const baseline = getEquipmentSystemBonus(equipmentIds, levels);
    const attuned = getEquipmentSystemBonus(equipmentIds, levels, {
      bone_spear: 'mist_vanguard',
      mist_hood: 'mist_veilguard',
      spirit_robe: 'mist_vanguard'
    });

    expect(attuned.setCounts).toEqual(baseline.setCounts);
    expect(attuned.activeSets).toEqual(baseline.activeSets);
    expect(attuned.activeMasteries).toEqual(baseline.activeMasteries);
    expect(attuned.totalScore).toBeGreaterThan(baseline.totalScore);
    expect(attuned.descriptions.filter((description) => description.includes('铭刻：'))).toHaveLength(3);
  });

  it('includes a candidate attunement in score and swap preview deltas', () => {
    const levels = { ember_staff: 3 };
    const baseline = getEquipmentSwapPreview(BASIC_EQUIPMENT, 'ember_staff', levels);
    const attuned = getEquipmentSwapPreview(BASIC_EQUIPMENT, 'ember_staff', levels, {
      ember_staff: 'rift_resonance'
    });
    const attunementScore =
      getEquipmentScore('ember_staff', 3, 'rift_resonance') - getEquipmentScore('ember_staff', 3);

    expect(attuned.afterScore - baseline.afterScore).toBe(attunementScore);
    expect(attuned.scoreDelta - baseline.scoreDelta).toBe(attunementScore);
    expect(attuned.statDelta.artPower - baseline.statDelta.artPower).toBe(4);
  });

  it('preserves exact legacy output when optional attunement and temper data are omitted', () => {
    const levels = { bone_spear: 3, mist_hood: 2 };
    const equipped = { ...BASIC_EQUIPMENT, weapon: 'bone_spear' } as const;

    expect(getEquipmentSystemBonus(['bone_spear'], { bone_spear: 1 })).toEqual({
      bonus: { speed: 1 },
      descriptions: ['白骨长矛词条：雾影疾刺。'],
      activeSets: [],
      activeMasteries: [],
      setCounts: { mist: 1, forge: 0, rift: 0, chronal: 0 },
      equipmentScores: { bone_spear: 42 },
      totalScore: 42
    });
    expect(getEquipmentSystemBonus(['bone_spear', 'mist_hood'], levels)).toEqual(
      getEquipmentSystemBonus(['bone_spear', 'mist_hood'], levels, {})
    );
    expect(getEquipmentSystemBonus(['bone_spear', 'mist_hood'], levels)).toEqual(
      getEquipmentSystemBonus(['bone_spear', 'mist_hood'], levels, {}, {})
    );
    expect(getEquipmentSystemBonus(['bone_spear', 'mist_hood'], levels)).toEqual(
      getEquipmentSystemBonus(['bone_spear', 'mist_hood'], levels, {}, { bone_spear: 0 })
    );
    expect(getEquipmentScore('bone_spear', 3)).toBe(getEquipmentScore('bone_spear', 3, undefined));
    expect(getEquipmentScore('bone_spear', 3)).toBe(
      getEquipmentScore('bone_spear', 3, undefined, 0)
    );
    expect(getEquipmentSwapPreview(equipped, 'armor_piercing_sword', levels)).toEqual(
      getEquipmentSwapPreview(equipped, 'armor_piercing_sword', levels, {})
    );
    expect(getEquipmentSwapPreview(equipped, 'armor_piercing_sword', levels)).toEqual(
      getEquipmentSwapPreview(equipped, 'armor_piercing_sword', levels, {}, {})
    );
  });

  it('activates all eight resonance branches with three matching max-level equipped items', () => {
    for (const [setTag, branchIds] of Object.entries(ATTUNEMENT_IDS_BY_SET) as Array<
      [EquipmentSetTag, readonly EquipmentAttunementId[]]
    >) {
      const equipmentIds = ADVANCED_EQUIPMENT_BY_SET[setTag].slice(0, 3);
      const weaponId = equipmentIds.find((equipmentId) => EQUIPMENT[equipmentId].slot === 'weapon');

      expect(weaponId).toBeDefined();
      if (!weaponId) continue;

      const levels = Object.fromEntries(
        equipmentIds.map((equipmentId) => [equipmentId, EQUIPMENT[equipmentId].maxLevel])
      ) as Partial<Record<EquipmentId, number>>;

      for (const branchId of branchIds) {
        const attunements = Object.fromEntries(
          equipmentIds.map((equipmentId) => [equipmentId, branchId])
        ) as EquipmentAttunementMap;
        const baseline = getEquipmentSystemBonus(equipmentIds, levels, attunements);
        const progress = getEquipmentAttunementResonanceProgress(
          weaponId,
          equipmentIds,
          levels,
          attunements
        );

        expect(progress).toMatchObject({
          weaponId,
          setTag,
          branchId,
          attunedCount: 3,
          requiredCount: 3,
          active: true
        });
        expect(progress.name).toMatch(/[\u4e00-\u9fff]/);
        expect(progress.effectDescription).toMatch(/[\u4e00-\u9fff]/);
        expect(getEquipmentSystemBonus(equipmentIds, levels, attunements)).toEqual(baseline);
      }
    }
  });

  it('reports the actual count and rejects insufficient, mixed, cross-set, or under-level loadouts', () => {
    const mistItems = ['bone_spear', 'mist_hood', 'spirit_robe', 'cloudstep_boots'] as const;
    const maxLevels = {
      bone_spear: 3,
      mist_hood: 3,
      spirit_robe: 3,
      cloudstep_boots: 3,
      armor_piercing_sword: 3
    } as const;
    const allVanguard = {
      bone_spear: 'mist_vanguard',
      mist_hood: 'mist_vanguard',
      spirit_robe: 'mist_vanguard',
      cloudstep_boots: 'mist_vanguard'
    } as const satisfies EquipmentAttunementMap;

    expect(
      getEquipmentAttunementResonanceProgress('bone_spear', mistItems, maxLevels, allVanguard)
    ).toMatchObject({ attunedCount: 4, requiredCount: 3, active: true });

    expect(
      getEquipmentAttunementResonanceProgress('bone_spear', mistItems.slice(0, 2), maxLevels, allVanguard)
    ).toMatchObject({ attunedCount: 2, active: false });

    expect(
      getEquipmentAttunementResonanceProgress('bone_spear', mistItems.slice(0, 3), maxLevels, {
        ...allVanguard,
        spirit_robe: 'mist_veilguard'
      })
    ).toMatchObject({ attunedCount: 2, active: false });

    expect(
      getEquipmentAttunementResonanceProgress(
        'armor_piercing_sword',
        ['armor_piercing_sword', 'mist_hood', 'spirit_robe', 'cloudstep_boots'],
        maxLevels,
        { ...allVanguard, armor_piercing_sword: 'forge_overdrive' }
      )
    ).toMatchObject({ setTag: 'forge', branchId: 'forge_overdrive', attunedCount: 1, active: false });

    expect(
      getEquipmentAttunementResonanceProgress('bone_spear', mistItems.slice(0, 3), {
        ...maxLevels,
        spirit_robe: 2
      }, allVanguard)
    ).toMatchObject({ attunedCount: 2, active: false });

    expect(
      getEquipmentAttunementResonanceProgress('bone_spear', mistItems, {
        ...maxLevels,
        bone_spear: 2
      }, allVanguard)
    ).toMatchObject({ attunedCount: 3, active: false });

    expect(
      getEquipmentAttunementResonanceProgress(
        'bone_spear',
        ['mist_hood', 'spirit_robe', 'cloudstep_boots'],
        maxLevels,
        allVanguard
      )
    ).toMatchObject({ attunedCount: 3, active: false });
  });

  it('does not mutate loadout, level, attunement, or temper inputs while calculating bonuses', () => {
    const equippedIds: EquipmentId[] = ['bone_spear', 'mist_hood'];
    const levels = { bone_spear: 3, mist_hood: 3 };
    const attunements = {
      bone_spear: 'mist_vanguard',
      mist_hood: 'mist_veilguard'
    } as const satisfies EquipmentAttunementMap;
    const temperRanks = { bone_spear: 2, mist_hood: 1 } as const satisfies EquipmentTemperMap;
    const equippedSnapshot = [...equippedIds];
    const levelsSnapshot = { ...levels };
    const attunementsSnapshot = { ...attunements };
    const temperRanksSnapshot = { ...temperRanks };

    getEquipmentSystemBonus(equippedIds, levels, attunements, temperRanks);

    expect(equippedIds).toEqual(equippedSnapshot);
    expect(levels).toEqual(levelsSnapshot);
    expect(attunements).toEqual(attunementsSnapshot);
    expect(temperRanks).toEqual(temperRanksSnapshot);
  });

  it('does not activate a two-piece set with only one tagged item equipped', () => {
    const result = getEquipmentSystemBonus(['bone_spear'], { bone_spear: 1 });

    expect(getEquipmentSetTags('bone_spear')).toEqual<EquipmentSetTag[]>(['mist']);
    expect(result.activeSets).toEqual([]);
    expect(result.activeMasteries).toEqual([]);
    expect(result.bonus).toMatchObject({ speed: 1 });
    expect(result.descriptions.some((description) => description.includes('2件套'))).toBe(false);
    expect(result.descriptions.some((description) => description.includes('3件专精'))).toBe(false);
  });

  it('activates the mist two-piece set when two mist items are equipped', () => {
    const result = getEquipmentSystemBonus(['bone_spear', 'spirit_robe'], {
      bone_spear: 1,
      spirit_robe: 1
    });

    expect(result.activeSets).toEqual(['mist']);
    expect(result.setCounts.mist).toBe(2);
    expect(result.bonus).toMatchObject({ speed: 3, trapCheck: 5 });
    expect(result.descriptions).toContain('雾行2件套：速度 +2，陷阱判定 +3。');
  });

  it('raises equipment score when an item is upgraded', () => {
    expect(getEquipmentScore('armor_piercing_sword', 3)).toBeGreaterThan(getEquipmentScore('armor_piercing_sword', 1));
  });

  it('stacks affixes and set bonuses from different slot combinations', () => {
    const result = getEquipmentSystemBonus(['ember_staff', 'spirit_robe', 'rift_charm'], {
      ember_staff: 2,
      spirit_robe: 1,
      rift_charm: 1
    });

    expect(result.activeSets).toEqual(['rift']);
    expect(result.bonus).toMatchObject({
      artPower: 8,
      spirit: 1,
      trapCheck: 2
    });
    expect(result.totalScore).toBeGreaterThan(result.equipmentScores.rift_charm ?? 0);
  });

  it('scores new defense slots and lets them complete equipment sets', () => {
    const head = 'mist_hood' as EquipmentId;
    const feet = 'cloudstep_boots' as EquipmentId;

    expect(EQUIPMENT[head]?.slot).toBe('head');
    expect(EQUIPMENT[feet]?.slot).toBe('feet');
    expect(getEquipmentSetTags(head)).toEqual<EquipmentSetTag[]>(['mist']);
    expect(getEquipmentScore(feet, 2)).toBeGreaterThan(getEquipmentScore(feet, 1));

    const result = getEquipmentSystemBonus([head, feet], {
      [head]: 1,
      [feet]: 2
    });

    expect(result.activeSets).toEqual(['mist']);
    expect(result.setCounts.mist).toBe(2);
    expect(result.totalScore).toBeGreaterThan(result.equipmentScores[head] ?? 0);
    expect(result.bonus.speed).toBeGreaterThanOrEqual(3);
  });

  it.each([
    {
      setTag: 'mist' as const,
      equipmentIds: ['bone_spear', 'mist_hood', 'spirit_robe'] as EquipmentId[],
      expectedBonus: { speed: 4, trapCheck: 9 },
      masteryDescription: '雾行3件专精：速度 +1，陷阱判定 +2。'
    },
    {
      setTag: 'forge' as const,
      equipmentIds: ['armor_piercing_sword', 'guardian_plate', 'guardian_gauntlets'] as EquipmentId[],
      expectedBonus: { attack: 8, defense: 7 },
      masteryDescription: '星炉3件专精：攻击 +2，防御 +1。'
    },
    {
      setTag: 'rift' as const,
      equipmentIds: ['ember_staff', 'rift_belt', 'rift_charm'] as EquipmentId[],
      expectedBonus: { spirit: 2, artPower: 12 },
      masteryDescription: '裂隙3件专精：术法 +3。'
    },
    {
      setTag: 'chronal' as const,
      equipmentIds: ['chronal_edge', 'chronal_aegis', 'chronal_lens'] as EquipmentId[],
      expectedBonus: { maxHp: 16, attack: 4, artPower: 4, defense: 4, speed: 3 },
      masteryDescription: '时序3件专精：攻击 +2，术法 +2。'
    }
  ])('activates the $setTag three-piece mastery with a restrained bonus', ({ setTag, equipmentIds, expectedBonus, masteryDescription }) => {
    const result = getEquipmentSystemBonus(equipmentIds);

    expect(result.activeSets).toEqual([setTag]);
    expect(result.activeMasteries).toEqual([setTag]);
    expect(result.setCounts[setTag]).toBe(3);
    expect(result.bonus).toMatchObject(expectedBonus);
    expect(result.descriptions).toContain(masteryDescription);
  });

  it('previews a swap that activates a two-piece set and deactivates a three-piece mastery', () => {
    const equipped = {
      ...BASIC_EQUIPMENT,
      weapon: 'bone_spear',
      head: 'mist_hood',
      armor: 'spirit_robe',
      hands: 'guardian_gauntlets'
    } as const satisfies Record<EquipmentSlot, EquipmentId>;

    const preview = getEquipmentSwapPreview(equipped, 'guardian_plate', {});

    expect(preview.replacedEquipmentId).toBe('spirit_robe');
    expect(preview.candidateEquipmentId).toBe('guardian_plate');
    expect(preview.scoreDelta).toBe(getEquipmentScore('guardian_plate', 1) - getEquipmentScore('spirit_robe', 1));
    expect(preview.afterScore - preview.beforeScore).toBe(preview.scoreDelta);
    expect(preview.statDelta).toEqual({
      body: 0,
      spirit: 0,
      agility: 0,
      luck: 0,
      maxHp: 10,
      attack: 3,
      artPower: -2,
      defense: 9,
      speed: -2,
      trapCheck: -4
    });
    expect(preview.activatedSets).toEqual(['forge']);
    expect(preview.deactivatedSets).toEqual([]);
    expect(preview.activatedMasteries).toEqual([]);
    expect(preview.deactivatedMasteries).toEqual(['mist']);
    expect(preview.beforeSetCounts).toEqual({ mist: 3, forge: 1, rift: 0, chronal: 0 });
    expect(preview.afterSetCounts).toEqual({ mist: 2, forge: 2, rift: 0, chronal: 0 });
  });

  it('previews a swap that deactivates a two-piece set', () => {
    const equipped = {
      ...BASIC_EQUIPMENT,
      weapon: 'bone_spear',
      head: 'mist_hood'
    } as const satisfies Record<EquipmentSlot, EquipmentId>;

    const preview = getEquipmentSwapPreview(equipped, 'armor_piercing_sword');

    expect(preview.statDelta).toEqual({
      body: 0,
      spirit: 0,
      agility: 0,
      luck: 0,
      maxHp: 0,
      attack: 3,
      artPower: 0,
      defense: 0,
      speed: -6,
      trapCheck: -3
    });
    expect(preview.activatedSets).toEqual([]);
    expect(preview.deactivatedSets).toEqual(['mist']);
    expect(preview.activatedMasteries).toEqual([]);
    expect(preview.deactivatedMasteries).toEqual([]);
    expect(preview.beforeSetCounts).toEqual({ mist: 2, forge: 0, rift: 0, chronal: 0 });
    expect(preview.afterSetCounts).toEqual({ mist: 1, forge: 1, rift: 0, chronal: 0 });
  });

  it('includes candidate upgrades and affixes when a swap activates a mastery', () => {
    const equipped = {
      ...BASIC_EQUIPMENT,
      waist: 'rift_belt',
      charm: 'rift_charm'
    } as const satisfies Record<EquipmentSlot, EquipmentId>;

    const preview = getEquipmentSwapPreview(equipped, 'ember_staff', { ember_staff: 3 });

    expect(preview.scoreDelta).toBe(getEquipmentScore('ember_staff', 3) - getEquipmentScore('training_blade', 1));
    expect(preview.afterScore - preview.beforeScore).toBe(preview.scoreDelta);
    expect(preview.statDelta).toEqual({
      body: 0,
      spirit: 0,
      agility: 0,
      luck: 0,
      maxHp: 0,
      attack: 0,
      artPower: 22,
      defense: 0,
      speed: 0,
      trapCheck: 0
    });
    expect(preview.activatedMasteries).toEqual(['rift']);
    expect(preview.deactivatedMasteries).toEqual([]);
    expect(preview.beforeSetCounts.rift).toBe(2);
    expect(preview.afterSetCounts.rift).toBe(3);
  });

  it('does not mutate equipped ids, levels, attunements, or temper ranks while previewing a swap', () => {
    const equipped = {
      ...BASIC_EQUIPMENT,
      weapon: 'bone_spear',
      head: 'mist_hood'
    } as const satisfies Record<EquipmentSlot, EquipmentId>;
    const equipmentLevels = { bone_spear: 2, guardian_plate: 3 };
    const attunements = {
      bone_spear: 'mist_vanguard',
      guardian_plate: 'forge_overdrive'
    } as const satisfies EquipmentAttunementMap;
    const temperRanks = {
      bone_spear: 1,
      guardian_plate: 2
    } as const satisfies EquipmentTemperMap;
    const equippedSnapshot = { ...equipped };
    const levelsSnapshot = { ...equipmentLevels };
    const attunementsSnapshot = { ...attunements };
    const temperRanksSnapshot = { ...temperRanks };

    getEquipmentSwapPreview(equipped, 'guardian_plate', equipmentLevels, attunements, temperRanks);

    expect(equipped).toEqual(equippedSnapshot);
    expect(equipmentLevels).toEqual(levelsSnapshot);
    expect(attunements).toEqual(attunementsSnapshot);
    expect(temperRanks).toEqual(temperRanksSnapshot);
  });
});
