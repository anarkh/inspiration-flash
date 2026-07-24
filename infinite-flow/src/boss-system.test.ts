import { describe, expect, it } from 'vitest';

import type { DungeonId, ItemId, MonsterId } from './game';
import {
  getBossCombatStats,
  getBossDefinition,
  getBossDefinitionForNode,
  getBossPhaseTransition,
  getBossSealProgress
} from './boss-system';

const BOSS_CASES = [
  { dungeonId: 'demon_tower_1', nodeId: 'bone_lane_monster', monsterId: 'tower_butcher' },
  { dungeonId: 'metro_abyss', nodeId: 'mirror_thread_spider', monsterId: 'mirror_thread_spider' },
  { dungeonId: 'starfall_mine', nodeId: 'molt_beast_den', monsterId: 'portal_molt_beast' },
  { dungeonId: 'rust_hospital', nodeId: 'chief_pulse_doctor', monsterId: 'pulse_doctor' },
  { dungeonId: 'ash_arena', nodeId: 'furnace_judge', monsterId: 'furnace_judge' },
  { dungeonId: 'dream_archive', nodeId: 'dream_jailer_second', monsterId: 'dream_jailer' },
  { dungeonId: 'void_citadel', nodeId: 'main_god_echo', monsterId: 'main_god_echo' },
  { dungeonId: 'temporal_observatory', nodeId: 'zero_hour_regent', monsterId: 'zero_hour_regent' },
  { dungeonId: 'causal_clearinghouse', nodeId: 'zero_sum_auditor', monsterId: 'zero_sum_auditor' },
  { dungeonId: 'entropy_ark', nodeId: 'last_helmsman', monsterId: 'last_helmsman' },
  { dungeonId: 'mirror_cycle_city', nodeId: 'nameless_reflection', monsterId: 'nameless_reflection' },
  { dungeonId: 'redaction_scriptorium', nodeId: 'last_redactor', monsterId: 'last_redactor' },
  { dungeonId: 'legacy_auction_court', nodeId: 'estate_auctioneer', monsterId: 'estate_auctioneer' },
  { dungeonId: 'genesis_vault', nodeId: 'primal_curator', monsterId: 'primal_curator' },
  { dungeonId: 'silent_broadcast_tower', nodeId: 'last_broadcaster', monsterId: 'last_broadcaster' },
  { dungeonId: 'lost_shelter', nodeId: 'shelter_overseer', monsterId: 'shelter_overseer' },
  { dungeonId: 'false_testimony_court', nodeId: 'false_testimony_judge', monsterId: 'false_testimony_judge' },
  { dungeonId: 'combat_replay_stage', nodeId: 'final_cut_director', monsterId: 'final_cut_director' },
  { dungeonId: 'panopticon_city', nodeId: 'all_sight_warden', monsterId: 'all_sight_warden' }
] as const satisfies ReadonlyArray<{ dungeonId: DungeonId; nodeId: string; monsterId: MonsterId }>;

const ITEM_IDS = [
  'healing_pill',
  'thunder_talisman',
  'dispel_talisman',
  'gate_sigil',
  'echo_coin',
  'capture_net',
  'spirit_bait',
  'armor_patch',
  'focus_incense',
  'demon_bone',
  'hidden_stone',
  'medicine_ash',
  'mirror_shell',
  'star_iron',
  'method_page',
  'cracked_core',
  'rift_dust',
  'cycle_imprint',
  'chronal_glass',
  'causal_seal',
  'entropy_crystal',
  'phase_glass',
  'redaction_ink',
  'legacy_scrip',
  'genesis_serum',
  'silence_core',
  'rescue_badge',
  'truth_fragment',
  'combat_reel',
  'observation_shard'
] as const satisfies readonly ItemId[];

describe('boss system', () => {
  it('defines exactly one unique boss mapping for every dungeon', () => {
    const definitions = BOSS_CASES.map(({ dungeonId }) => getBossDefinition(dungeonId));

    expect(
      definitions.map(({ dungeonId, nodeId, monsterId }) => ({ dungeonId, nodeId, monsterId }))
    ).toEqual([...BOSS_CASES]);
    expect(new Set(definitions.map(({ dungeonId }) => dungeonId)).size).toBe(19);
    expect(new Set(definitions.map(({ nodeId }) => nodeId)).size).toBe(19);
    expect(new Set(definitions.map(({ monsterId }) => monsterId)).size).toBe(19);
    expect(new Set(definitions.map(({ bossTitle }) => bossTitle)).size).toBe(19);
    expect(new Set(definitions.map(({ awakenedPhaseName }) => awakenedPhaseName)).size).toBe(19);
  });

  it('matches only the exact configured node inside the same dungeon', () => {
    for (const [index, bossCase] of BOSS_CASES.entries()) {
      const definition = getBossDefinition(bossCase.dungeonId);
      const otherNodeId = BOSS_CASES[(index + 1) % BOSS_CASES.length].nodeId;

      expect(getBossDefinitionForNode(bossCase.dungeonId, bossCase.nodeId)).toBe(definition);
      expect(getBossDefinitionForNode(bossCase.dungeonId, `${bossCase.nodeId}_copy`)).toBeUndefined();
      expect(getBossDefinitionForNode(bossCase.dungeonId, otherNodeId)).toBeUndefined();
    }

    expect(getBossDefinitionForNode('demon_tower_1', 'tower_butcher')).toBeUndefined();
    expect(getBossDefinitionForNode('dream_archive', 'dream_jailer')).toBeUndefined();
  });

  it('keeps tier scaling incremental and within the intended boss ranges', () => {
    const definitions = BOSS_CASES.map(({ dungeonId }) => getBossDefinition(dungeonId));

    expect(definitions.map(({ tier }) => tier)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect(definitions.map(({ maxHpMultiplier }) => maxHpMultiplier)).toEqual([
      1.25,
      1.3,
      1.36,
      1.42,
      1.48,
      1.54,
      1.6,
      1.66,
      1.72,
      1.78,
      1.84,
      1.9,
      1.95,
      2,
      2.05,
      2.1,
      2.2,
      2.3,
      2.4
    ]);
    expect(definitions[0].awakened.attackBonus).toBe(3);
    expect(definitions[12].awakened.attackBonus).toBe(18);
    expect(definitions[13].awakened.attackBonus).toBe(19);
    expect(definitions[14].awakened.attackBonus).toBe(20);
    expect(definitions[15].awakened.attackBonus).toBe(22);
    expect(definitions[16].awakened.attackBonus).toBe(23);
    expect(definitions[17].awakened.attackBonus).toBe(24);
    expect(definitions[18].awakened.attackBonus).toBe(25);
    expect(definitions[0].awakened.defenseBonus).toBe(1);
    expect(definitions[12].awakened.defenseBonus).toBe(12);
    expect(definitions[13].awakened.defenseBonus).toBe(13);
    expect(definitions[14].awakened.defenseBonus).toBe(14);
    expect(definitions[15].awakened.defenseBonus).toBe(15);
    expect(definitions[16].awakened.defenseBonus).toBe(16);
    expect(definitions[17].awakened.defenseBonus).toBe(17);
    expect(definitions[18].awakened.defenseBonus).toBe(18);

    for (let index = 1; index < definitions.length; index += 1) {
      const previous = definitions[index - 1];
      const current = definitions[index];

      expect(current.maxHpMultiplier).toBeGreaterThan(previous.maxHpMultiplier);
      expect(current.awakened.attackBonus).toBeGreaterThan(previous.awakened.attackBonus);
      expect(current.awakened.defenseBonus).toBeGreaterThanOrEqual(previous.awakened.defenseBonus);
      expect(current.bonusReward.rewardPoints).toBeGreaterThan(previous.bonusReward.rewardPoints ?? 0);
    }
  });

  it('returns finite integer combat stats and applies the selected phase bonuses', () => {
    for (const bossCase of BOSS_CASES) {
      const definition = getBossDefinition(bossCase.dungeonId);
      const sealed = getBossCombatStats(definition, { maxHp: 100, attack: 20, defense: 10 }, 'sealed');
      const awakened = getBossCombatStats(definition, { maxHp: 100, attack: 20, defense: 10 }, 'awakened');

      expect(sealed).toEqual({
        maxHp: Math.round(100 * definition.maxHpMultiplier),
        attack: 20 + definition.sealed.attackBonus,
        defense: 10 + definition.sealed.defenseBonus
      });
      expect(awakened).toEqual({
        maxHp: sealed.maxHp,
        attack: 20 + definition.awakened.attackBonus,
        defense: 10 + definition.awakened.defenseBonus
      });
      expect(Object.values(awakened).every((value) => Number.isInteger(value))).toBe(true);
      expect(awakened.attack).toBeGreaterThan(sealed.attack);
      expect(awakened.defense).toBeGreaterThanOrEqual(sealed.defense);
    }

    const definition = getBossDefinition('demon_tower_1');
    expect(getBossCombatStats(definition, { maxHp: 0, attack: Number.NaN, defense: -4.6 }, 'sealed')).toEqual({
      maxHp: 1,
      attack: definition.sealed.attackBonus,
      defense: definition.sealed.defenseBonus
    });
  });

  it('awakens at the half-health boundary and remains sealed above it', () => {
    const definition = getBossDefinition('rust_hospital');
    const aboveHalf = getBossPhaseTransition(definition, 'sealed', 51, 100);
    const atHalf = getBossPhaseTransition(definition, 'sealed', 50, 100);
    const belowHalf = getBossPhaseTransition(definition, 'sealed', 12, 100);

    expect(aboveHalf).toEqual({ phase: 'sealed', transitioned: false, statusLine: '' });
    expect(atHalf.phase).toBe('awakened');
    expect(atHalf.transitioned).toBe(true);
    expect(atHalf.statusLine).toContain(definition.awakenedPhaseName);
    expect(atHalf.statusLine).toContain(definition.awakeningLine);
    expect(belowHalf.phase).toBe('awakened');
    expect(belowHalf.transitioned).toBe(true);
  });

  it('gives the zero-hour regent a conservative Tier-8 phase and chronal bonus', () => {
    const previous = getBossDefinition('void_citadel');
    const definition = getBossDefinition('temporal_observatory');
    const sealed = getBossCombatStats(definition, { maxHp: 100, attack: 20, defense: 10 }, 'sealed');
    const awakened = getBossCombatStats(definition, { maxHp: 100, attack: 20, defense: 10 }, 'awakened');

    expect(definition).toMatchObject({
      tier: 8,
      nodeId: 'zero_hour_regent',
      monsterId: 'zero_hour_regent',
      maxHpMultiplier: 1.66,
      sealed: { attackBonus: 8, defenseBonus: 5 },
      awakened: { attackBonus: 11, defenseBonus: 7 },
      bonusReward: { rewardPoints: 520, lingyun: 5, items: { chronal_glass: 2 } }
    });
    expect(definition.maxHpMultiplier - previous.maxHpMultiplier).toBeCloseTo(0.06);
    expect(definition.awakened.attackBonus - previous.awakened.attackBonus).toBe(1);
    expect(definition.awakened.defenseBonus - previous.awakened.defenseBonus).toBe(1);
    expect(sealed).toEqual({ maxHp: 166, attack: 28, defense: 15 });
    expect(awakened).toEqual({ maxHp: 166, attack: 31, defense: 17 });
    expect(getBossPhaseTransition(definition, 'sealed', 84, awakened.maxHp).phase).toBe('sealed');

    const transition = getBossPhaseTransition(definition, 'sealed', 83, awakened.maxHp);
    expect(transition).toEqual({
      phase: 'awakened',
      transitioned: true,
      statusLine: `【${definition.awakenedPhaseName}】${definition.awakeningLine}`
    });
  });

  it('gives the zero-sum auditor the Tier-9 phase and causal-seal bonus', () => {
    const previous = getBossDefinition('temporal_observatory');
    const definition = getBossDefinition('causal_clearinghouse');
    const sealed = getBossCombatStats(definition, { maxHp: 100, attack: 20, defense: 10 }, 'sealed');
    const awakened = getBossCombatStats(definition, { maxHp: 100, attack: 20, defense: 10 }, 'awakened');

    expect(definition).toMatchObject({
      tier: 9,
      nodeId: 'zero_sum_auditor',
      monsterId: 'zero_sum_auditor',
      maxHpMultiplier: 1.72,
      sealed: { attackBonus: 9, defenseBonus: 6 },
      awakened: { attackBonus: 12, defenseBonus: 8 },
      bonusReward: { rewardPoints: 610, lingyun: 6, items: { causal_seal: 2 } }
    });
    expect(definition.maxHpMultiplier - previous.maxHpMultiplier).toBeCloseTo(0.06);
    expect(definition.awakened.attackBonus - previous.awakened.attackBonus).toBe(1);
    expect(definition.awakened.defenseBonus - previous.awakened.defenseBonus).toBe(1);
    expect(sealed).toEqual({ maxHp: 172, attack: 29, defense: 16 });
    expect(awakened).toEqual({ maxHp: 172, attack: 32, defense: 18 });
    expect(getBossPhaseTransition(definition, 'sealed', 87, awakened.maxHp).phase).toBe('sealed');

    const transition = getBossPhaseTransition(definition, 'sealed', 86, awakened.maxHp);
    expect(transition).toEqual({
      phase: 'awakened',
      transitioned: true,
      statusLine: `【${definition.awakenedPhaseName}】${definition.awakeningLine}`
    });
  });

  it('gives the last helmsman the Tier-10 phase and entropy-crystal bonus', () => {
    const previous = getBossDefinition('causal_clearinghouse');
    const definition = getBossDefinition('entropy_ark');
    const sealed = getBossCombatStats(definition, { maxHp: 100, attack: 20, defense: 10 }, 'sealed');
    const awakened = getBossCombatStats(definition, { maxHp: 100, attack: 20, defense: 10 }, 'awakened');

    expect(definition).toMatchObject({
      tier: 10,
      nodeId: 'last_helmsman',
      monsterId: 'last_helmsman',
      maxHpMultiplier: 1.78,
      sealed: { attackBonus: 10, defenseBonus: 7 },
      awakened: { attackBonus: 13, defenseBonus: 9 },
      bonusReward: { rewardPoints: 700, lingyun: 7, items: { entropy_crystal: 2 } }
    });
    expect(definition.maxHpMultiplier - previous.maxHpMultiplier).toBeCloseTo(0.06);
    expect(definition.awakened.attackBonus - previous.awakened.attackBonus).toBe(1);
    expect(definition.awakened.defenseBonus - previous.awakened.defenseBonus).toBe(1);
    expect(sealed).toEqual({ maxHp: 178, attack: 30, defense: 17 });
    expect(awakened).toEqual({ maxHp: 178, attack: 33, defense: 19 });
    expect(getBossPhaseTransition(definition, 'sealed', 90, awakened.maxHp).phase).toBe('sealed');

    const transition = getBossPhaseTransition(definition, 'sealed', 89, awakened.maxHp);
    expect(transition).toEqual({
      phase: 'awakened',
      transitioned: true,
      statusLine: `【${definition.awakenedPhaseName}】${definition.awakeningLine}`
    });
  });

  it('gives the nameless reflection the Tier-11 phase and phase-glass bonus', () => {
    const previous = getBossDefinition('entropy_ark');
    const definition = getBossDefinition('mirror_cycle_city');
    const sealed = getBossCombatStats(definition, { maxHp: 100, attack: 20, defense: 10 }, 'sealed');
    const awakened = getBossCombatStats(definition, { maxHp: 100, attack: 20, defense: 10 }, 'awakened');

    expect(definition).toMatchObject({
      tier: 11,
      nodeId: 'nameless_reflection',
      monsterId: 'nameless_reflection',
      bossTitle: '无名镜王',
      maxHpMultiplier: 1.84,
      sealed: { attackBonus: 11, defenseBonus: 8 },
      awakened: { attackBonus: 14, defenseBonus: 10 },
      bonusReward: { rewardPoints: 800, lingyun: 8, items: { phase_glass: 2 } }
    });
    expect(definition.maxHpMultiplier - previous.maxHpMultiplier).toBeCloseTo(0.06);
    expect(definition.awakened.attackBonus - previous.awakened.attackBonus).toBe(1);
    expect(definition.awakened.defenseBonus - previous.awakened.defenseBonus).toBe(1);
    expect(sealed).toEqual({ maxHp: 184, attack: 31, defense: 18 });
    expect(awakened).toEqual({ maxHp: 184, attack: 34, defense: 20 });
    expect(getBossPhaseTransition(definition, 'sealed', 93, awakened.maxHp).phase).toBe('sealed');
    expect(getBossPhaseTransition(definition, 'sealed', 92, awakened.maxHp)).toEqual({
      phase: 'awakened',
      transitioned: true,
      statusLine: `【${definition.awakenedPhaseName}】${definition.awakeningLine}`
    });
  });

  it('gives the last redactor the exact Tier-12 final-proof phase and ink bonus', () => {
    const previous = getBossDefinition('mirror_cycle_city');
    const definition = getBossDefinition('redaction_scriptorium');
    const sealed = getBossCombatStats(definition, { maxHp: 100, attack: 20, defense: 10 }, 'sealed');
    const awakened = getBossCombatStats(definition, { maxHp: 100, attack: 20, defense: 10 }, 'awakened');

    expect(definition).toMatchObject({
      tier: 12,
      dungeonId: 'redaction_scriptorium',
      nodeId: 'last_redactor',
      monsterId: 'last_redactor',
      bossTitle: '终稿删界官',
      sealName: '三证终稿封印',
      awakenedPhaseName: '反向删界',
      maxHpMultiplier: 1.9,
      sealed: { attackBonus: 12, defenseBonus: 9 },
      awakened: { attackBonus: 16, defenseBonus: 11 },
      bonusReward: { rewardPoints: 900, lingyun: 9, items: { redaction_ink: 2 } }
    });
    expect(definition.maxHpMultiplier - previous.maxHpMultiplier).toBeCloseTo(0.06);
    expect(sealed).toEqual({ maxHp: 190, attack: 32, defense: 19 });
    expect(awakened).toEqual({ maxHp: 190, attack: 36, defense: 21 });
    expect(getBossPhaseTransition(definition, 'sealed', 96, awakened.maxHp).phase).toBe('sealed');
    expect(getBossPhaseTransition(definition, 'sealed', 95, awakened.maxHp)).toEqual({
      phase: 'awakened',
      transitioned: true,
      statusLine: `【反向删界】${definition.awakeningLine}`
    });
  });

  it('gives the estate auctioneer the exact Tier-13 hammer phase and legacy-scrip bonus', () => {
    const previous = getBossDefinition('redaction_scriptorium');
    const definition = getBossDefinition('legacy_auction_court');
    const sealed = getBossCombatStats(definition, { maxHp: 100, attack: 20, defense: 10 }, 'sealed');
    const awakened = getBossCombatStats(definition, { maxHp: 100, attack: 20, defense: 10 }, 'awakened');

    expect(definition).toMatchObject({
      tier: 13,
      dungeonId: 'legacy_auction_court',
      nodeId: 'estate_auctioneer',
      monsterId: 'estate_auctioneer',
      bossTitle: '遗产执槌人',
      sealName: '四席保价封印',
      awakenedPhaseName: '全场落槌',
      maxHpMultiplier: 1.95,
      sealed: { attackBonus: 13, defenseBonus: 10 },
      awakened: { attackBonus: 18, defenseBonus: 12 },
      bonusReward: { rewardPoints: 1000, lingyun: 10, items: { legacy_scrip: 2 } }
    });
    expect(definition.maxHpMultiplier - previous.maxHpMultiplier).toBeCloseTo(0.05);
    expect(sealed).toEqual({ maxHp: 195, attack: 33, defense: 20 });
    expect(awakened).toEqual({ maxHp: 195, attack: 38, defense: 22 });
    expect(getBossPhaseTransition(definition, 'sealed', 98, awakened.maxHp).phase).toBe('sealed');
    expect(getBossPhaseTransition(definition, 'sealed', 97.5, awakened.maxHp)).toEqual({
      phase: 'awakened',
      transitioned: true,
      statusLine: `【全场落槌】${definition.awakeningLine}`
    });
  });

  it('gives the primal curator the exact Tier-14 genome phase and one bonus bundle', () => {
    const previous = getBossDefinition('legacy_auction_court');
    const definition = getBossDefinition('genesis_vault');
    const sealed = getBossCombatStats(definition, { maxHp: 100, attack: 20, defense: 10 }, 'sealed');
    const awakened = getBossCombatStats(definition, { maxHp: 100, attack: 20, defense: 10 }, 'awakened');

    expect(definition).toMatchObject({
      tier: 14,
      dungeonId: 'genesis_vault',
      nodeId: 'primal_curator',
      monsterId: 'primal_curator',
      bossTitle: '原型典藏官',
      sealName: '三序基因封印',
      awakenedPhaseName: '始祖回写',
      maxHpMultiplier: 2,
      sealed: { attackBonus: 14, defenseBonus: 11 },
      awakened: { attackBonus: 19, defenseBonus: 13 },
      bonusReward: { rewardPoints: 1100, lingyun: 11, items: { genesis_serum: 2 } }
    });
    expect(definition.maxHpMultiplier - previous.maxHpMultiplier).toBeCloseTo(0.05);
    expect(sealed).toEqual({ maxHp: 200, attack: 34, defense: 21 });
    expect(awakened).toEqual({ maxHp: 200, attack: 39, defense: 23 });
    expect(getBossPhaseTransition(definition, 'sealed', 101, awakened.maxHp).phase).toBe('sealed');
    expect(getBossPhaseTransition(definition, 'sealed', 100, awakened.maxHp)).toEqual({
      phase: 'awakened',
      transitioned: true,
      statusLine: `【始祖回写】${definition.awakeningLine}`
    });
    expect(getBossPhaseTransition(definition, 'awakened', 10, awakened.maxHp)).toEqual({
      phase: 'awakened',
      transitioned: false,
      statusLine: ''
    });
    expect(definition.bonusReward).toBe(getBossDefinition('genesis_vault').bonusReward);
  });

  it('gives the last broadcaster the exact Tier-15 phase and one immutable bonus bundle', () => {
    const previous = getBossDefinition('genesis_vault');
    const definition = getBossDefinition('silent_broadcast_tower');
    const sealed = getBossCombatStats(definition, { maxHp: 100, attack: 20, defense: 10 }, 'sealed');
    const awakened = getBossCombatStats(definition, { maxHp: 100, attack: 20, defense: 10 }, 'awakened');

    expect(definition).toMatchObject({
      tier: 15,
      dungeonId: 'silent_broadcast_tower',
      nodeId: 'last_broadcaster',
      monsterId: 'last_broadcaster',
      bossTitle: '末频道播音主',
      sealName: '三段静默封印',
      awakenedPhaseName: '全城共振',
      maxHpMultiplier: 2.05,
      sealed: { attackBonus: 15, defenseBonus: 12 },
      awakened: { attackBonus: 20, defenseBonus: 14 },
      bonusReward: { rewardPoints: 1200, lingyun: 12, items: { silence_core: 2 } }
    });
    expect(definition.maxHpMultiplier - previous.maxHpMultiplier).toBeCloseTo(0.05);
    expect(sealed).toEqual({ maxHp: 205, attack: 35, defense: 22 });
    expect(awakened).toEqual({ maxHp: 205, attack: 40, defense: 24 });
    expect(getBossPhaseTransition(definition, 'sealed', 103, awakened.maxHp).phase).toBe('sealed');
    expect(getBossPhaseTransition(definition, 'sealed', 102.5, awakened.maxHp)).toEqual({
      phase: 'awakened',
      transitioned: true,
      statusLine: `【全城共振】${definition.awakeningLine}`
    });
    expect(getBossPhaseTransition(definition, 'awakened', 1, awakened.maxHp)).toEqual({
      phase: 'awakened',
      transitioned: false,
      statusLine: ''
    });
    expect(definition.bonusReward).toBe(getBossDefinition('silent_broadcast_tower').bonusReward);
  });

  it('gives the shelter overseer the exact Tier-16 escort phase and one immutable bonus bundle', () => {
    const previous = getBossDefinition('silent_broadcast_tower');
    const definition = getBossDefinition('lost_shelter');
    const sealed = getBossCombatStats(definition, { maxHp: 100, attack: 20, defense: 10 }, 'sealed');
    const awakened = getBossCombatStats(definition, { maxHp: 100, attack: 20, defense: 10 }, 'awakened');

    expect(definition).toMatchObject({
      tier: 16,
      dungeonId: 'lost_shelter',
      nodeId: 'shelter_overseer',
      monsterId: 'shelter_overseer',
      bossTitle: '失联总控',
      sealName: '三站护送封印',
      awakenedPhaseName: '全员接管',
      maxHpMultiplier: 2.1,
      sealed: { attackBonus: 16, defenseBonus: 13 },
      awakened: { attackBonus: 22, defenseBonus: 15 },
      bonusReward: { rewardPoints: 1300, lingyun: 13, items: { rescue_badge: 2 } }
    });
    expect(definition.maxHpMultiplier - previous.maxHpMultiplier).toBeCloseTo(0.05);
    expect(sealed).toEqual({ maxHp: 210, attack: 36, defense: 23 });
    expect(awakened).toEqual({ maxHp: 210, attack: 42, defense: 25 });
    expect(getBossPhaseTransition(definition, 'sealed', 106, awakened.maxHp).phase).toBe('sealed');
    expect(getBossPhaseTransition(definition, 'sealed', 105, awakened.maxHp)).toEqual({
      phase: 'awakened',
      transitioned: true,
      statusLine: `【全员接管】${definition.awakeningLine}`
    });
    expect(getBossPhaseTransition(definition, 'awakened', 1, awakened.maxHp)).toEqual({
      phase: 'awakened',
      transitioned: false,
      statusLine: ''
    });
    expect(definition.bonusReward).toBe(getBossDefinition('lost_shelter').bonusReward);
  });

  it('gives the false testimony judge the exact Tier-17 verdict phase and bonus bundle', () => {
    const previous = getBossDefinition('lost_shelter');
    const definition = getBossDefinition('false_testimony_court');
    const sealed = getBossCombatStats(definition, { maxHp: 100, attack: 20, defense: 10 }, 'sealed');
    const awakened = getBossCombatStats(definition, { maxHp: 100, attack: 20, defense: 10 }, 'awakened');

    expect(definition).toMatchObject({
      tier: 17,
      dungeonId: 'false_testimony_court',
      nodeId: 'false_testimony_judge',
      monsterId: 'false_testimony_judge',
      bossTitle: '伪证主审',
      sealName: '三证裁决封印',
      awakenedPhaseName: '终审翻案',
      maxHpMultiplier: 2.2,
      sealed: { attackBonus: 17, defenseBonus: 14 },
      awakened: { attackBonus: 23, defenseBonus: 16 },
      bonusReward: { rewardPoints: 1400, lingyun: 14, items: { truth_fragment: 2 } }
    });
    expect(definition.maxHpMultiplier - previous.maxHpMultiplier).toBeCloseTo(0.1);
    expect(sealed).toEqual({ maxHp: 220, attack: 37, defense: 24 });
    expect(awakened).toEqual({ maxHp: 220, attack: 43, defense: 26 });
    expect(getBossPhaseTransition(definition, 'sealed', 111, awakened.maxHp).phase).toBe('sealed');
    expect(getBossPhaseTransition(definition, 'sealed', 110, awakened.maxHp)).toEqual({
      phase: 'awakened',
      transitioned: true,
      statusLine: `【终审翻案】${definition.awakeningLine}`
    });
    expect(definition.bonusReward).toBe(getBossDefinition('false_testimony_court').bonusReward);
  });

  it('gives the final cut director the Tier-18 replay phase and bonus bundle', () => {
    const previous = getBossDefinition('false_testimony_court');
    const definition = getBossDefinition('combat_replay_stage');
    const sealed = getBossCombatStats(definition, { maxHp: 100, attack: 20, defense: 10 }, 'sealed');
    const awakened = getBossCombatStats(definition, { maxHp: 100, attack: 20, defense: 10 }, 'awakened');

    expect(definition).toMatchObject({
      tier: 18,
      dungeonId: 'combat_replay_stage',
      nodeId: 'final_cut_director',
      monsterId: 'final_cut_director',
      bossTitle: '终剪导演',
      sealName: '三段封片锁',
      awakenedPhaseName: '删镜杀青',
      maxHpMultiplier: 2.3,
      sealed: { attackBonus: 18, defenseBonus: 15 },
      awakened: { attackBonus: 24, defenseBonus: 17 },
      bonusReward: { rewardPoints: 1500, lingyun: 15, items: { combat_reel: 2 } }
    });
    expect(definition.maxHpMultiplier - previous.maxHpMultiplier).toBeCloseTo(0.1);
    expect(sealed).toEqual({ maxHp: 230, attack: 38, defense: 25 });
    expect(awakened).toEqual({ maxHp: 230, attack: 44, defense: 27 });
    expect(getBossPhaseTransition(definition, 'sealed', 116, awakened.maxHp).phase).toBe('sealed');
    expect(getBossPhaseTransition(definition, 'sealed', 115, awakened.maxHp)).toEqual({
      phase: 'awakened',
      transitioned: true,
      statusLine: `【删镜杀青】${definition.awakeningLine}`
    });
  });

  it('gives the all-sight warden the Tier-19 scan phase and bonus bundle', () => {
    const previous = getBossDefinition('combat_replay_stage');
    const definition = getBossDefinition('panopticon_city');
    const sealed = getBossCombatStats(definition, { maxHp: 100, attack: 20, defense: 10 }, 'sealed');
    const awakened = getBossCombatStats(definition, { maxHp: 100, attack: 20, defense: 10 }, 'awakened');

    expect(definition).toMatchObject({
      tier: 19,
      dungeonId: 'panopticon_city',
      nodeId: 'all_sight_warden',
      monsterId: 'all_sight_warden',
      bossTitle: '万目监察者',
      sealName: '三相盲区锁',
      awakenedPhaseName: '万目齐睁',
      maxHpMultiplier: 2.4,
      sealed: { attackBonus: 19, defenseBonus: 16 },
      awakened: { attackBonus: 25, defenseBonus: 18 },
      bonusReward: { rewardPoints: 1600, lingyun: 16, items: { observation_shard: 2 } }
    });
    expect(definition.maxHpMultiplier - previous.maxHpMultiplier).toBeCloseTo(0.1);
    expect(sealed).toEqual({ maxHp: 240, attack: 39, defense: 26 });
    expect(awakened).toEqual({ maxHp: 240, attack: 45, defense: 28 });
    expect(getBossPhaseTransition(definition, 'sealed', 121, awakened.maxHp).phase).toBe('sealed');
    expect(getBossPhaseTransition(definition, 'sealed', 120, awakened.maxHp)).toEqual({
      phase: 'awakened',
      transitioned: true,
      statusLine: `【万目齐睁】${definition.awakeningLine}`
    });
  });

  it('keeps awakening idempotent and rejects invalid health snapshots safely', () => {
    const definition = getBossDefinition('void_citadel');

    expect(getBossPhaseTransition(definition, 'awakened', 100, 100)).toEqual({
      phase: 'awakened',
      transitioned: false,
      statusLine: ''
    });

    const invalidSnapshots: Array<[number, number]> = [
      [Number.NaN, 100],
      [Number.POSITIVE_INFINITY, 100],
      [Number.NEGATIVE_INFINITY, 100],
      [40, Number.NaN],
      [40, Number.POSITIVE_INFINITY],
      [40, Number.NEGATIVE_INFINITY],
      [0, 0]
    ];

    for (const [monsterHp, bossMaxHp] of invalidSnapshots) {
      expect(getBossPhaseTransition(definition, 'sealed', monsterHp, bossMaxHp)).toEqual({
        phase: 'sealed',
        transitioned: false,
        statusLine: ''
      });
    }
  });

  it('reports the exact boss node as the single exit-seal requirement', () => {
    const before = getBossSealProgress('dream_archive', ['dream_jailer']);
    const after = getBossSealProgress('dream_archive', ['paper_librarian', 'dream_jailer_second']);

    expect(before.definition.nodeId).toBe('dream_jailer_second');
    expect(before.cleared).toBe(false);
    expect(before.requirementText).toContain('0/1');
    expect(before.requirementText).toContain(before.definition.bossTitle);
    expect(after.cleared).toBe(true);
    expect(after.requirementText).toContain('1/1');
    expect(after.requirementText).toContain(after.definition.sealName);
  });

  it('uses only legal item ids and non-negative integral bonus rewards', () => {
    const allowedItemIds = new Set<string>(ITEM_IDS);

    for (const bossCase of BOSS_CASES) {
      const reward = getBossDefinition(bossCase.dungeonId).bonusReward;
      const itemEntries = Object.entries(reward.items ?? {});
      const quantities = itemEntries.map(([, quantity]) => quantity ?? 0);
      const values = [reward.rewardPoints ?? 0, reward.lingyun ?? 0, ...quantities];

      expect(reward.rewardPoints).toBeGreaterThan(0);
      expect(itemEntries.length).toBeGreaterThan(0);
      expect(itemEntries.every(([itemId]) => allowedItemIds.has(itemId))).toBe(true);
      expect(values.every((value) => Number.isFinite(value) && Number.isInteger(value) && value >= 0)).toBe(true);
    }
  });
});
