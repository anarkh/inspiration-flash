import type { EquipmentId } from './game';

/**
 * Mechanic keywords on gear first offered from chapter 9 on: a combat rule that works in every chapter, unlike the
 * entry-frozen passives that only act in their own chapter. Each piece carries one keyword. The value grows with the
 * piece's level and with the chapter it is first offered in (x1.0 at chapter 9 up to x1.5 at chapter 19). Wearing two
 * pieces with the same keyword counts only the higher value, so a build mixes keywords instead of stacking one.
 */
export type EquipmentKeywordId =
  | 'execute'
  | 'pierce'
  | 'opening'
  | 'skill_mastery'
  | 'bulwark'
  | 'riposte'
  | 'renewal'
  | 'foresight'
  | 'composure'
  | 'art_mastery'
  | 'talisman_mastery'
  | 'potency';

type EquipmentKeywordDefinition = Readonly<{
  name: string;
  /** Percent at levels 1, 2 and 3 for gear first offered in chapter 9. */
  base: readonly [number, number, number];
  describe: (value: number) => string;
}>;

export const EQUIPMENT_KEYWORDS: Readonly<Record<EquipmentKeywordId, EquipmentKeywordDefinition>> = Object.freeze({
  execute: { name: '斩杀', base: [15, 20, 25], describe: (value) => `敌人生命不高于 30% 时，攻击、术法和武器战技伤害 +${value}%` },
  pierce: { name: '破甲', base: [15, 20, 25], describe: (value) => `攻击、术法和武器战技无视敌人 ${value}% 防御` },
  opening: { name: '先手', base: [25, 35, 45], describe: (value) => `每场战斗第 1 回合，攻击、术法和武器战技伤害 +${value}%` },
  skill_mastery: { name: '战技精通', base: [12, 16, 20], describe: (value) => `武器战技伤害 +${value}%` },
  bulwark: { name: '坚壁', base: [10, 14, 18], describe: (value) => `防御时，承受的伤害再降低 ${value}%` },
  riposte: { name: '反震', base: [20, 27, 35], describe: (value) => `防御时，把敌人这次攻击原本伤害的 ${value}% 反弹给它` },
  renewal: { name: '回春', base: [3, 4, 5], describe: (value) => `防御后回复最大生命的 ${value}%` },
  foresight: { name: '预判', base: [12, 16, 20], describe: (value) => `受到的重击伤害降低 ${value}%` },
  composure: { name: '凝神', base: [12, 16, 20], describe: (value) => `战意满时，攻击和术法伤害 +${value}%` },
  art_mastery: { name: '术法精通', base: [10, 14, 18], describe: (value) => `术法伤害 +${value}%` },
  talisman_mastery: { name: '符咒精通', base: [15, 20, 25], describe: (value) => `雷火符伤害 +${value}%` },
  potency: { name: '药效', base: [15, 20, 25], describe: (value) => `止血丹回复量 +${value}%` }
});

/** The keyword and first-offered chapter of every piece from chapter 9 on (the chapter is checked against the loot pools). */
export const EQUIPMENT_KEYWORD_ASSIGNMENTS: Readonly<Partial<Record<EquipmentId, Readonly<{ keyword: EquipmentKeywordId; chapter: number }>>>> = Object.freeze({
  // Weapons strike harder.
  redline_edge: { keyword: 'execute', chapter: 12 },
  legacy_gavel: { keyword: 'opening', chapter: 13 },
  helix_cleaver: { keyword: 'pierce', chapter: 14 },
  hushblade: { keyword: 'execute', chapter: 15 },
  rescue_carbine: { keyword: 'opening', chapter: 16 },
  breach_shotgun: { keyword: 'skill_mastery', chapter: 16 },
  cross_examiner_sabre: { keyword: 'pierce', chapter: 17 },
  frame_engraver: { keyword: 'execute', chapter: 18 },
  blindline_cutter: { keyword: 'pierce', chapter: 19 },
  phase_coil_rifle: { keyword: 'skill_mastery', chapter: 19 },
  // Armor turns a guard into more.
  dissipation_mantle: { keyword: 'bulwark', chapter: 10 },
  phaseweave_mantle: { keyword: 'renewal', chapter: 11 },
  palimpsest_mantle: { keyword: 'riposte', chapter: 12 },
  escrow_plate: { keyword: 'bulwark', chapter: 13 },
  carapace_harness: { keyword: 'riposte', chapter: 14 },
  anechoic_mantle: { keyword: 'bulwark', chapter: 15 },
  evacuation_plate: { keyword: 'renewal', chapter: 16 },
  custody_shell: { keyword: 'riposte', chapter: 17 },
  buffer_plate: { keyword: 'bulwark', chapter: 18 },
  matte_shell: { keyword: 'renewal', chapter: 19 },
  // Headgear reads the enemy and the focus gauge.
  causal_visor: { keyword: 'foresight', chapter: 9 },
  parallax_visor: { keyword: 'composure', chapter: 11 },
  anonymous_veil: { keyword: 'foresight', chapter: 13 },
  symbiote_cowl: { keyword: 'composure', chapter: 14 },
  dead_air_headset: { keyword: 'foresight', chapter: 15 },
  triage_visor: { keyword: 'composure', chapter: 16 },
  forensic_visor: { keyword: 'foresight', chapter: 17 },
  cue_visor: { keyword: 'composure', chapter: 18 },
  predictive_visor: { keyword: 'foresight', chapter: 19 },
  // Charms strengthen arts and supplies.
  entropy_compass: { keyword: 'art_mastery', chapter: 10 },
  homecoming_prism: { keyword: 'art_mastery', chapter: 11 },
  final_proof_seal: { keyword: 'talisman_mastery', chapter: 12 },
  final_lot_bell: { keyword: 'talisman_mastery', chapter: 13 },
  rebirth_amulet: { keyword: 'potency', chapter: 14 },
  last_channel_beacon: { keyword: 'talisman_mastery', chapter: 15 },
  blackbox_beacon: { keyword: 'art_mastery', chapter: 16 },
  appeal_seal: { keyword: 'potency', chapter: 17 },
  thaw_metronome: { keyword: 'potency', chapter: 18 },
  inverse_prism: { keyword: 'art_mastery', chapter: 19 },
  // The last hands, waist and feet pieces.
  echo_breaker_gauntlets: { keyword: 'opening', chapter: 9 },
  return_anchor_belt: { keyword: 'bulwark', chapter: 9 },
  ark_keel_boots: { keyword: 'foresight', chapter: 10 }
});

export type EquipmentKeyword = Readonly<{
  id: EquipmentKeywordId;
  name: string;
  value: number;
  readout: string;
}>;

export function getEquipmentKeyword(equipmentId: EquipmentId, level: number): EquipmentKeyword | undefined {
  const assignment = EQUIPMENT_KEYWORD_ASSIGNMENTS[equipmentId];
  if (!assignment) return undefined;
  const definition = EQUIPMENT_KEYWORDS[assignment.keyword];
  const index = Math.max(0, Math.min(2, Math.floor(level) - 1));
  const value = Math.round(definition.base[index]! * (1 + 0.05 * (assignment.chapter - 9)));
  return Object.freeze({ id: assignment.keyword, name: definition.name, value, readout: `${definition.name}：${definition.describe(value)}` });
}

/** The keywords a worn set brings, each at the highest value among the pieces that carry it. */
export function getWornEquipmentKeywords(
  equippedIds: readonly (EquipmentId | undefined)[],
  levels: Readonly<Partial<Record<EquipmentId, number>>>
): Readonly<Partial<Record<EquipmentKeywordId, number>>> {
  const values: Partial<Record<EquipmentKeywordId, number>> = {};
  for (const equipmentId of equippedIds) {
    if (equipmentId === undefined) continue;
    const keyword = getEquipmentKeyword(equipmentId, levels[equipmentId] ?? 1);
    if (keyword && keyword.value > (values[keyword.id] ?? 0)) values[keyword.id] = keyword.value;
  }
  return Object.freeze(values);
}
