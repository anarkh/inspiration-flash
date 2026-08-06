import { describe, expect, it } from 'vitest';
import { DUNGEON_ORDER, EQUIPMENT, createInitialState, learnMethod, type GameState } from './game';
import { EQUIPMENT_MEMORY_EQUIPMENT_CATALOG } from './equipment-memory-hunts';
import { getEquipmentPurchaseAdvice, getItemAdvice, getMethodAdvice } from './shop-advice';

function withResources(state: GameState): GameState {
  return {
    ...state,
    rewardPoints: 5000,
    lingyun: 20,
    inventory: {
      ...state.inventory,
      demon_bone: 2,
      medicine_ash: 2,
      hidden_stone: 2,
      star_iron: 2,
      method_page: 2,
      cracked_core: 2,
      rift_dust: 2,
      chronal_glass: 2,
      causal_seal: 2,
      entropy_crystal: 2,
      phase_glass: 2,
      redaction_ink: 2,
      legacy_scrip: 2,
      genesis_serum: 2,
      silence_core: 2,
      rescue_badge: 2,
      truth_fragment: 2,
      combat_reel: 2,
      observation_shard: 2
    }
  };
}

describe('shop advice', () => {
  it('shows power gain and early dungeon recommendations for buying and equipping armor-piercing sword', () => {
    const advice = getEquipmentPurchaseAdvice(createInitialState(), 'armor_piercing_sword');

    expect(advice.powerDelta).toBeGreaterThan(0);
    expect(advice.recommendedForDungeonIds.length).toBeGreaterThanOrEqual(1);
    expect(advice.recommendedForDungeonIds).toContain('starfall_mine');
    expect(advice.reasonText).toContain('破甲剑');
    expect(advice.affordabilityText).toContain('可兑换');
  });

  it('explains method purpose through power delta or route text', () => {
    const advice = getMethodAdvice(createInitialState(), 'mist_breathing');

    expect(advice.affordabilityText).toContain('可学习');
    expect(advice.powerDelta > 0 || advice.reasonText.includes('隐藏路线')).toBe(true);
    expect(advice.reasonText).toContain('吐纳诀');
  });

  it('recommends capture-route consumables even when they do not directly increase power', () => {
    const netAdvice = getItemAdvice(createInitialState(), 'capture_net');
    const baitAdvice = getItemAdvice(createInitialState(), 'spirit_bait');

    expect(netAdvice.powerDelta).toBe(0);
    expect(netAdvice.reasonText).toContain('捕获');
    expect(netAdvice.recommendedForDungeonIds).toContain('demon_tower_1');
    expect(baitAdvice.reasonText).toContain('捕获');
    expect(baitAdvice.recommendedForDungeonIds).toContain('starfall_mine');
  });

  it('distinguishes unaffordable and already learned states', () => {
    const broke = {
      ...createInitialState(),
      rewardPoints: 0,
      lingyun: 0
    };
    const unaffordable = getEquipmentPurchaseAdvice(broke, 'armor_piercing_sword');
    const learned = getMethodAdvice(learnMethod(createInitialState(), 'mist_breathing'), 'mist_breathing');

    expect(unaffordable.affordabilityText).toContain('不足');
    expect(unaffordable.reasonText).toContain('暂时买不起');
    expect(learned.affordabilityText).toContain('已学习');
    expect(learned.powerDelta).toBe(0);
  });

  it('reports readiness improvements from deadly or hard in a constructed state', () => {
    const advice = getEquipmentPurchaseAdvice(withResources(createInitialState()), 'starforged_edge');

    expect(
      advice.readinessChanges.some(
        (change) => (change.before === 'deadly' || change.before === 'hard') && change.before !== change.after
      )
    ).toBe(true);
  });

  it('targets the temporal observatory for all chronal equipment and its drop-only material', () => {
    const state = withResources(createInitialState());

    for (const equipmentId of ['chronal_edge', 'chronal_aegis', 'chronal_lens'] as const) {
      const advice = getEquipmentPurchaseAdvice(state, equipmentId);

      expect(advice.recommendedForDungeonIds[0]).toBe('temporal_observatory');
      expect(advice.reasonText).toContain('时序观测庭');
      expect(advice.affordabilityText).toContain('可兑换');
    }

    const materialAdvice = getItemAdvice(state, 'chronal_glass');
    expect(materialAdvice.recommendedForDungeonIds[0]).toBe('temporal_observatory');
    expect(materialAdvice.reasonText).toContain('时序观测庭');
    expect(materialAdvice.affordabilityText).toContain('商店不直接售卖');
  });

  it('targets the causal clearinghouse for all Tier-9 equipment and causal seals', () => {
    const state = withResources(createInitialState());

    for (const equipmentId of [
      'causal_visor',
      'echo_breaker_gauntlets',
      'return_anchor_belt'
    ] as const) {
      const advice = getEquipmentPurchaseAdvice(state, equipmentId);

      expect(advice.recommendedForDungeonIds[0]).toBe('causal_clearinghouse');
      expect(advice.reasonText).toContain('因果清算所');
      expect(advice.affordabilityText).toContain('可兑换');
    }

    const materialAdvice = getItemAdvice(state, 'causal_seal');
    expect(materialAdvice.recommendedForDungeonIds[0]).toBe('causal_clearinghouse');
    expect(materialAdvice.reasonText).toContain('因果清算所');
    expect(materialAdvice.reasonText).toContain('Tier 9');
    expect(materialAdvice.affordabilityText).toContain('商店不直接售卖');
  });

  it('targets the entropy ark first for all Tier-10 equipment and entropy crystals', () => {
    const state = withResources(createInitialState());

    for (const equipmentId of ['entropy_compass', 'dissipation_mantle', 'ark_keel_boots'] as const) {
      const advice = getEquipmentPurchaseAdvice(state, equipmentId);

      expect(advice.recommendedForDungeonIds[0]).toBe('entropy_ark');
      expect(advice.reasonText).toContain('熵海方舟');
      expect(advice.affordabilityText).toContain('可兑换');
    }

    const materialAdvice = getItemAdvice(state, 'entropy_crystal');
    expect(materialAdvice.recommendedForDungeonIds[0]).toBe('entropy_ark');
    expect(materialAdvice.reasonText).toContain('Tier 10');
    expect(materialAdvice.reasonText).toContain('淬炼');
    expect(materialAdvice.reasonText).toContain('熵海方舟');
    expect(materialAdvice.affordabilityText).toContain('商店不直接售卖');
  });

  it('targets the mirror cycle city first for all Tier-11 equipment and phase glass', () => {
    const state = withResources(createInitialState());

    for (const equipmentId of ['parallax_visor', 'phaseweave_mantle', 'homecoming_prism'] as const) {
      const advice = getEquipmentPurchaseAdvice(state, equipmentId);

      expect(advice.recommendedForDungeonIds[0]).toBe('mirror_cycle_city');
      expect(advice.reasonText).toContain('镜海轮回城');
      expect(advice.affordabilityText).toContain('可兑换');
    }

    const materialAdvice = getItemAdvice(state, 'phase_glass');
    expect(materialAdvice.recommendedForDungeonIds[0]).toBe('mirror_cycle_city');
    expect(materialAdvice.reasonText).toContain('Tier 11');
    expect(materialAdvice.reasonText).toContain('淬炼');
    expect(materialAdvice.reasonText).toContain('镜海轮回城');
    expect(materialAdvice.affordabilityText).toContain('商店不直接售卖');
  });

  it('targets the redaction scriptorium first for all Tier-12 equipment and redaction ink', () => {
    const state = withResources(createInitialState());

    for (const equipmentId of ['redline_edge', 'palimpsest_mantle', 'final_proof_seal'] as const) {
      const advice = getEquipmentPurchaseAdvice(state, equipmentId);

      expect(advice.recommendedForDungeonIds[0]).toBe('redaction_scriptorium');
      expect(advice.reasonText).toContain('删界终稿院');
      expect(advice.affordabilityText).toContain('可兑换');
    }

    const materialAdvice = getItemAdvice(state, 'redaction_ink');
    expect(materialAdvice.recommendedForDungeonIds[0]).toBe('redaction_scriptorium');
    expect(materialAdvice.reasonText).toContain('Tier 12');
    expect(materialAdvice.reasonText).toContain(EQUIPMENT.redline_edge.name);
    expect(materialAdvice.reasonText).toContain(EQUIPMENT.palimpsest_mantle.name);
    expect(materialAdvice.reasonText).toContain(EQUIPMENT.final_proof_seal.name);
    expect(materialAdvice.reasonText).toContain('删界终稿院');
    expect(materialAdvice.affordabilityText).toContain('商店不直接售卖');
  });

  it('targets the legacy auction court first for all Tier-13 equipment and legacy scrip', () => {
    const state = withResources(createInitialState());

    for (const equipmentId of [
      'legacy_gavel',
      'anonymous_veil',
      'escrow_plate',
      'final_lot_bell'
    ] as const) {
      const advice = getEquipmentPurchaseAdvice(state, equipmentId);

      expect(advice.recommendedForDungeonIds[0]).toBe('legacy_auction_court');
      expect(advice.reasonText).toContain('亡队遗产拍卖庭');
      expect(advice.affordabilityText).toContain('可兑换');
    }

    const materialAdvice = getItemAdvice(state, 'legacy_scrip');
    expect(materialAdvice.recommendedForDungeonIds[0]).toBe('legacy_auction_court');
    expect(materialAdvice.reasonText).toContain('Tier 13');
    expect(materialAdvice.reasonText).toContain(EQUIPMENT.legacy_gavel.name);
    expect(materialAdvice.reasonText).toContain(EQUIPMENT.anonymous_veil.name);
    expect(materialAdvice.reasonText).toContain(EQUIPMENT.escrow_plate.name);
    expect(materialAdvice.reasonText).toContain(EQUIPMENT.final_lot_bell.name);
    expect(materialAdvice.reasonText).toContain('亡队遗产拍卖庭');
    expect(materialAdvice.affordabilityText).toContain('商店不直接售卖');
  });

  it('targets the genesis vault for Tier-14 equipment, bloodline serum, and existing supplies', () => {
    const state = withResources(createInitialState());

    for (const equipmentId of [
      'helix_cleaver',
      'symbiote_cowl',
      'carapace_harness',
      'rebirth_amulet'
    ] as const) {
      const advice = getEquipmentPurchaseAdvice(state, equipmentId);
      expect(advice.recommendedForDungeonIds[0]).toBe('genesis_vault');
      expect(advice.reasonText).toContain('众生原型库');
      expect(advice.affordabilityText).toContain('可兑换');
    }

    const serumAdvice = getItemAdvice(state, 'genesis_serum');
    expect(serumAdvice.recommendedForDungeonIds[0]).toBe('genesis_vault');
    expect(serumAdvice.reasonText).toContain('Tier 14');
    expect(serumAdvice.reasonText).toContain('血统养成');
    expect(serumAdvice.reasonText).toContain('失控原型');
    expect(serumAdvice.reasonText).toContain('众生原型库');
    expect(serumAdvice.affordabilityText).toContain('商店不直接售卖');
    expect(serumAdvice.affordabilityText).not.toContain('可兑换');

    for (const itemId of ['armor_patch', 'focus_incense'] as const) {
      expect(getItemAdvice(state, itemId).recommendedForDungeonIds).toContain('genesis_vault');
    }
  });

  it('targets the silent broadcast tower for Tier-15 gear and supplies without selling silence cores', () => {
    const state = withResources(createInitialState());

    for (const equipmentId of [
      'hushblade',
      'dead_air_headset',
      'anechoic_mantle',
      'last_channel_beacon'
    ] as const) {
      const advice = getEquipmentPurchaseAdvice(state, equipmentId);
      expect(advice.recommendedForDungeonIds[0]).toBe('silent_broadcast_tower');
      expect(advice.reasonText).toContain('寂声广播塔');
      expect(advice.affordabilityText).toContain('可兑换');
    }

    for (const itemId of ['armor_patch', 'focus_incense'] as const) {
      expect(getItemAdvice(state, itemId).recommendedForDungeonIds).toContain('silent_broadcast_tower');
    }

    const materialAdvice = getItemAdvice(state, 'silence_core');
    expect(materialAdvice.recommendedForDungeonIds[0]).toBe('silent_broadcast_tower');
    expect(materialAdvice.reasonText).toContain('Tier 15');
    expect(materialAdvice.reasonText).toContain(EQUIPMENT.hushblade.name);
    expect(materialAdvice.reasonText).toContain(EQUIPMENT.dead_air_headset.name);
    expect(materialAdvice.reasonText).toContain(EQUIPMENT.anechoic_mantle.name);
    expect(materialAdvice.reasonText).toContain(EQUIPMENT.last_channel_beacon.name);
    expect(materialAdvice.affordabilityText).toContain('商店不直接售卖');
    expect(materialAdvice.affordabilityText).not.toContain('可兑换');
  });

  it('targets the lost shelter for Tier-16 gear and supplies without selling rescue badges', () => {
    const state = withResources(createInitialState());

    for (const equipmentId of [
      'rescue_carbine',
      'breach_shotgun',
      'triage_visor',
      'evacuation_plate',
      'blackbox_beacon'
    ] as const) {
      const advice = getEquipmentPurchaseAdvice(state, equipmentId);
      expect(advice.recommendedForDungeonIds[0]).toBe('lost_shelter');
      expect(advice.reasonText).toContain('失联避难所');
      expect(advice.affordabilityText).toContain('可兑换');
    }

    for (const itemId of ['healing_pill', 'armor_patch', 'focus_incense', 'dispel_talisman'] as const) {
      expect(getItemAdvice(state, itemId).recommendedForDungeonIds).toContain('lost_shelter');
    }

    const materialAdvice = getItemAdvice(state, 'rescue_badge');
    expect(materialAdvice.recommendedForDungeonIds[0]).toBe('lost_shelter');
    expect(materialAdvice.reasonText).toContain('Tier 16');
    expect(materialAdvice.reasonText).toContain(EQUIPMENT.rescue_carbine.name);
    expect(materialAdvice.reasonText).toContain(EQUIPMENT.breach_shotgun.name);
    expect(materialAdvice.reasonText).toContain(EQUIPMENT.triage_visor.name);
    expect(materialAdvice.reasonText).toContain(EQUIPMENT.evacuation_plate.name);
    expect(materialAdvice.reasonText).toContain(EQUIPMENT.blackbox_beacon.name);
    expect(materialAdvice.affordabilityText).toContain('商店不直接售卖');
    expect(materialAdvice.affordabilityText).not.toContain('可兑换');
  });

  it('targets the false-testimony court for Tier-17 gear and evidence supplies without selling truth fragments', () => {
    const state = withResources(createInitialState());

    for (const equipmentId of [
      'cross_examiner_sabre',
      'forensic_visor',
      'custody_shell',
      'appeal_seal'
    ] as const) {
      const advice = getEquipmentPurchaseAdvice(state, equipmentId);
      expect(advice.recommendedForDungeonIds[0]).toBe('false_testimony_court');
      expect(advice.reasonText).toContain('伪证裁定庭');
      expect(advice.affordabilityText).toContain('可兑换');
    }

    for (const itemId of ['healing_pill', 'armor_patch', 'focus_incense', 'dispel_talisman'] as const) {
      expect(getItemAdvice(state, itemId).recommendedForDungeonIds).toContain('false_testimony_court');
    }

    const materialAdvice = getItemAdvice(state, 'truth_fragment');
    expect(materialAdvice.recommendedForDungeonIds[0]).toBe('false_testimony_court');
    expect(materialAdvice.reasonText).toContain('Tier 17');
    expect(materialAdvice.reasonText).toContain(EQUIPMENT.cross_examiner_sabre.name);
    expect(materialAdvice.reasonText).toContain(EQUIPMENT.forensic_visor.name);
    expect(materialAdvice.reasonText).toContain(EQUIPMENT.custody_shell.name);
    expect(materialAdvice.reasonText).toContain(EQUIPMENT.appeal_seal.name);
    expect(materialAdvice.affordabilityText).toContain('商店不直接售卖');
    expect(materialAdvice.affordabilityText).not.toContain('可兑换');
  });

  it('targets 战痕复演场 for Tier-18 gear and supplies without selling combat reels', () => {
    const state = withResources(createInitialState());

    for (const equipmentId of [
      'frame_engraver',
      'cue_visor',
      'buffer_plate',
      'thaw_metronome'
    ] as const) {
      const advice = getEquipmentPurchaseAdvice(state, equipmentId);
      expect(advice.recommendedForDungeonIds[0]).toBe('combat_replay_stage');
      expect(advice.reasonText).toContain('战痕复演场');
      expect(advice.reasonText).toContain(EQUIPMENT[equipmentId].description);
      expect(advice.affordabilityText).toContain('可兑换');
    }

    const materialAdvice = getItemAdvice(state, 'combat_reel');
    expect(materialAdvice.recommendedForDungeonIds[0]).toBe('combat_replay_stage');
    expect(materialAdvice.reasonText).toContain('Tier 18');
    expect(materialAdvice.reasonText).toContain('战斗母带');
    expect(materialAdvice.reasonText).toContain(EQUIPMENT.frame_engraver.name);
    expect(materialAdvice.reasonText).toContain(EQUIPMENT.cue_visor.name);
    expect(materialAdvice.reasonText).toContain(EQUIPMENT.buffer_plate.name);
    expect(materialAdvice.reasonText).toContain(EQUIPMENT.thaw_metronome.name);
    expect(materialAdvice.affordabilityText).toContain('商店不直接售卖');
    expect(materialAdvice.affordabilityText).not.toContain('可兑换');
  });

  it('targets 天幕监察城 for Tier-19 gear and supplies without selling observation shards', () => {
    const state = withResources(createInitialState());

    for (const equipmentId of [
      'blindline_cutter',
      'phase_coil_rifle',
      'predictive_visor',
      'matte_shell',
      'inverse_prism'
    ] as const) {
      const advice = getEquipmentPurchaseAdvice(state, equipmentId);
      expect(advice.recommendedForDungeonIds[0]).toBe('panopticon_city');
      expect(advice.reasonText).toContain('天幕监察城');
      expect(advice.reasonText).toContain(EQUIPMENT[equipmentId].description);
      expect(advice.affordabilityText).toContain('可兑换');
    }

    for (const itemId of ['healing_pill', 'armor_patch', 'focus_incense', 'dispel_talisman'] as const) {
      expect(getItemAdvice(state, itemId).recommendedForDungeonIds).toContain('panopticon_city');
    }

    const materialAdvice = getItemAdvice(state, 'observation_shard');
    expect(materialAdvice.recommendedForDungeonIds[0]).toBe('panopticon_city');
    expect(materialAdvice.reasonText).toContain('Tier 19');
    expect(materialAdvice.reasonText).toContain('观测棱片');
    expect(materialAdvice.reasonText).toContain(EQUIPMENT.blindline_cutter.name);
    expect(materialAdvice.reasonText).toContain(EQUIPMENT.phase_coil_rifle.name);
    expect(materialAdvice.reasonText).toContain(EQUIPMENT.predictive_visor.name);
    expect(materialAdvice.reasonText).toContain(EQUIPMENT.matte_shell.name);
    expect(materialAdvice.reasonText).toContain(EQUIPMENT.inverse_prism.name);
    expect(materialAdvice.affordabilityText).toContain('商店不直接售卖');
    expect(materialAdvice.affordabilityText).not.toContain('可兑换');
    expect(getItemAdvice(state, 'combat_reel').reasonText).toContain('Tier 18');
  });

  it('exhaustively covers nineteen chapters and affordability for all fifty-eight mature equipment', () => {
    const rich = withResources(createInitialState());
    const broke = {
      ...createInitialState(),
      rewardPoints: 0,
      lingyun: 0
    };

    expect(DUNGEON_ORDER).toHaveLength(19);
    expect(EQUIPMENT_MEMORY_EQUIPMENT_CATALOG).toHaveLength(58);
    const coveredDungeonIds = new Set<string>();
    for (const equipmentId of EQUIPMENT_MEMORY_EQUIPMENT_CATALOG) {
      const affordable = getEquipmentPurchaseAdvice(rich, equipmentId);
      const unaffordable = getEquipmentPurchaseAdvice(broke, equipmentId);
      expect(affordable.recommendedForDungeonIds.length).toBeGreaterThan(0);
      affordable.recommendedForDungeonIds.forEach((dungeonId) => coveredDungeonIds.add(dungeonId));
      expect(affordable.affordabilityText).toContain('可兑换');
      expect(unaffordable.affordabilityText).toContain('不足');
      expect(unaffordable.reasonText).toContain('暂时买不起');
    }
    expect(new Set(EQUIPMENT_MEMORY_EQUIPMENT_CATALOG).size).toBe(58);
    expect(coveredDungeonIds).toEqual(new Set(DUNGEON_ORDER));
  });
});
