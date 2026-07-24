import { describe, expect, it } from 'vitest';

import {
  EQUIPMENT,
  ITEM_IDS,
  ITEMS,
  createInitialState,
  type DungeonId,
  type EquipmentId,
  type ItemId,
  type MonsterId
} from './game';
import {
  DUNGEON_ELITE_MONSTERS,
  DUNGEON_EQUIPMENT_POOLS,
  DUNGEON_MATERIAL_REWARDS,
  DUNGEON_SALVAGE_REWARD_POINTS,
  getDungeonEquipmentRecipes,
  getEquipmentRecipe,
  getEquipmentRecipeDungeonIds,
  getDungeonLootOffer
} from './dungeon-loot';

const ELITE_CASES: Array<[DungeonId, MonsterId]> = [
  ['demon_tower_1', 'tower_butcher'],
  ['metro_abyss', 'mirror_thread_spider'],
  ['starfall_mine', 'portal_molt_beast'],
  ['rust_hospital', 'pulse_doctor'],
  ['ash_arena', 'furnace_judge'],
  ['dream_archive', 'dream_jailer'],
  ['void_citadel', 'main_god_echo'],
  ['temporal_observatory', 'epoch_sentinel'],
  ['causal_clearinghouse', 'paradox_bailiff'],
  ['entropy_ark', 'dissipation_navigator'],
  ['mirror_cycle_city', 'mirror_chorus'],
  ['redaction_scriptorium', 'palimpsest_censor'],
  ['legacy_auction_court', 'inheritance_mimic'],
  ['genesis_vault', 'mutation_guardian'],
  ['silent_broadcast_tower', 'broadcast_warden'],
  ['lost_shelter', 'shelter_enforcer'],
  ['false_testimony_court', 'archive_censor'],
  ['combat_replay_stage', 'continuity_editor'],
  ['panopticon_city', 'blindspot_auditor']
];

const NORMAL_CASES: Array<[DungeonId, MonsterId]> = [
  ['demon_tower_1', 'fog_lesser_demon'],
  ['metro_abyss', 'rail_wraith'],
  ['starfall_mine', 'spark_imp'],
  ['rust_hospital', 'plague_orderly'],
  ['ash_arena', 'ash_duelist'],
  ['dream_archive', 'paper_librarian'],
  ['void_citadel', 'void_knight'],
  ['temporal_observatory', 'clockwork_scout'],
  ['causal_clearinghouse', 'verdict_usher'],
  ['entropy_ark', 'entropy_deckhand'],
  ['mirror_cycle_city', 'parallax_hunter'],
  ['genesis_vault', 'gene_stalker'],
  ['silent_broadcast_tower', 'frequency_leech'],
  ['lost_shelter', 'mimic_survivor'],
  ['false_testimony_court', 'hostile_witness'],
  ['combat_replay_stage', 'cue_stalker'],
  ['panopticon_city', 'sweep_sentinel']
];

const MATERIAL_CASES: Array<[DungeonId, ItemId]> = [
  ['demon_tower_1', 'demon_bone'],
  ['metro_abyss', 'mirror_shell'],
  ['starfall_mine', 'star_iron'],
  ['rust_hospital', 'medicine_ash'],
  ['ash_arena', 'cracked_core'],
  ['dream_archive', 'hidden_stone'],
  ['void_citadel', 'rift_dust'],
  ['temporal_observatory', 'chronal_glass'],
  ['causal_clearinghouse', 'causal_seal'],
  ['entropy_ark', 'entropy_crystal'],
  ['mirror_cycle_city', 'phase_glass'],
  ['redaction_scriptorium', 'redaction_ink'],
  ['legacy_auction_court', 'legacy_scrip'],
  ['genesis_vault', 'genesis_serum'],
  ['silent_broadcast_tower', 'silence_core'],
  ['lost_shelter', 'rescue_badge'],
  ['false_testimony_court', 'truth_fragment'],
  ['combat_replay_stage', 'combat_reel'],
  ['panopticon_city', 'observation_shard']
];

describe('dungeon loot', () => {
  it('defines one material reward and complete equipment recipes for every dungeon', () => {
    expect(Object.keys(DUNGEON_MATERIAL_REWARDS)).toEqual(MATERIAL_CASES.map(([dungeonId]) => dungeonId));

    const recipes = MATERIAL_CASES.flatMap(([dungeonId, materialId]) => {
      expect(DUNGEON_MATERIAL_REWARDS[dungeonId]).toEqual({ itemId: materialId, amount: 1 });

      const dungeonRecipes = getDungeonEquipmentRecipes(dungeonId);
      expect(dungeonRecipes).toEqual(
        DUNGEON_EQUIPMENT_POOLS[dungeonId].map((equipmentId) => ({
          dungeonId,
          materialId,
          equipmentId,
          materialAmount: 1
        }))
      );
      return dungeonRecipes;
    });

    const starterEquipmentIds = new Set(createInitialState().ownedEquipment);
    const matureEquipmentIds = (Object.keys(EQUIPMENT) as EquipmentId[]).filter(
      (equipmentId) => !starterEquipmentIds.has(equipmentId)
    );
    expect(new Set(recipes.map(({ equipmentId }) => equipmentId))).toEqual(
      new Set(matureEquipmentIds)
    );
  });

  it('returns every dungeon recipe for equipment shared by overlapping pools', () => {
    expect(getEquipmentRecipeDungeonIds('rift_charm')).toEqual([
      'metro_abyss',
      'starfall_mine',
      'rust_hospital',
      'dream_archive'
    ]);
    expect(getEquipmentRecipeDungeonIds('starforged_edge')).toEqual([
      'starfall_mine',
      'ash_arena',
      'void_citadel',
      'temporal_observatory'
    ]);
    expect(getEquipmentRecipe('metro_abyss', 'rift_charm')).toEqual({
      dungeonId: 'metro_abyss',
      materialId: 'mirror_shell',
      equipmentId: 'rift_charm',
      materialAmount: 1
    });
    expect(getEquipmentRecipe('dream_archive', 'rift_charm')).toEqual({
      dungeonId: 'dream_archive',
      materialId: 'hidden_stone',
      equipmentId: 'rift_charm',
      materialAmount: 1
    });
  });

  it('returns no recipe for invalid dungeon-equipment combinations', () => {
    expect(getEquipmentRecipe('demon_tower_1', 'void_lantern')).toBeUndefined();
    expect(getEquipmentRecipe('panopticon_city', 'training_blade')).toBeUndefined();
    expect(getEquipmentRecipeDungeonIds('training_blade')).toEqual([]);
  });

  it('defines one triggering elite and a three-to-five item pool for every dungeon', () => {
    expect(Object.entries(DUNGEON_ELITE_MONSTERS)).toEqual(ELITE_CASES);

    for (const [dungeonId, monsterId] of ELITE_CASES) {
      const equipmentPool: readonly EquipmentId[] = DUNGEON_EQUIPMENT_POOLS[dungeonId];
      const offer = getDungeonLootOffer({
        dungeonId,
        monsterId,
        nodeId: 'elite-node',
        ownedEquipmentIds: [],
        carriedEquipmentIds: [],
        offersMade: 0
      });

      expect(equipmentPool.length).toBeGreaterThanOrEqual(3);
      expect(equipmentPool.length).toBeLessThanOrEqual(5);
      expect(offer?.offerId).toBe(`dungeon-loot:${dungeonId}:elite-node`);
      expect(offer).toHaveProperty('equipmentIds');
      if (offer && 'equipmentIds' in offer) {
        expect(offer.equipmentIds).toHaveLength(3);
        expect(offer.equipmentIds.every((equipmentId) => equipmentPool.includes(equipmentId))).toBe(true);
      }
    }
  });

  it('does not trigger for normal monsters in any dungeon', () => {
    for (const [dungeonId, monsterId] of NORMAL_CASES) {
      expect(
        getDungeonLootOffer({
          dungeonId,
          monsterId,
          nodeId: 'normal-node',
          ownedEquipmentIds: [],
          carriedEquipmentIds: [],
          offersMade: 0
        })
      ).toBeUndefined();
    }
  });

  it('distinguishes the observatory elite from its scout and boss', () => {
    const input = {
      dungeonId: 'temporal_observatory' as const,
      nodeId: 'epoch_sentinel_alpha',
      ownedEquipmentIds: [],
      carriedEquipmentIds: [],
      offersMade: 0
    };

    expect(getDungeonLootOffer({ ...input, monsterId: 'epoch_sentinel' })).toHaveProperty('equipmentIds');
    expect(getDungeonLootOffer({ ...input, monsterId: 'clockwork_scout' })).toBeUndefined();
    expect(getDungeonLootOffer({ ...input, monsterId: 'zero_hour_regent' })).toBeUndefined();
  });

  it('uses only the three Tier-9 pieces for the clearinghouse elite offer', () => {
    const expectedPool = [
      'causal_visor',
      'echo_breaker_gauntlets',
      'return_anchor_belt'
    ] as const satisfies readonly EquipmentId[];
    const input = {
      dungeonId: 'causal_clearinghouse' as const,
      nodeId: 'paradox_bailiff_alpha',
      ownedEquipmentIds: [],
      carriedEquipmentIds: [],
      offersMade: 0
    };
    const offer = getDungeonLootOffer({ ...input, monsterId: 'paradox_bailiff' });

    expect(DUNGEON_EQUIPMENT_POOLS.causal_clearinghouse).toEqual(expectedPool);
    expect(offer).toHaveProperty('equipmentIds');
    if (offer && 'equipmentIds' in offer) {
      expect(offer.equipmentIds).toHaveLength(3);
      expect(new Set(offer.equipmentIds)).toEqual(new Set(expectedPool));
    }
    expect(getDungeonLootOffer({ ...input, monsterId: 'verdict_usher' })).toBeUndefined();
    expect(getDungeonLootOffer({ ...input, monsterId: 'zero_sum_auditor' })).toBeUndefined();
  });

  it('uses the exact Tier-10 equipment definitions and ark elite pool', () => {
    const expectedPool = [
      'entropy_compass',
      'dissipation_mantle',
      'ark_keel_boots'
    ] as const satisfies readonly EquipmentId[];
    const input = {
      dungeonId: 'entropy_ark' as const,
      nodeId: 'dissipation_navigator_alpha',
      ownedEquipmentIds: [],
      carriedEquipmentIds: [],
      offersMade: 0
    };
    const offer = getDungeonLootOffer({ ...input, monsterId: 'dissipation_navigator' });

    expect(DUNGEON_EQUIPMENT_POOLS.entropy_ark).toEqual(expectedPool);
    expect(offer).toHaveProperty('equipmentIds');
    if (offer && 'equipmentIds' in offer) {
      expect(new Set(offer.equipmentIds)).toEqual(new Set(expectedPool));
    }
    expect(getDungeonLootOffer({ ...input, monsterId: 'entropy_deckhand' })).toBeUndefined();
    expect(getDungeonLootOffer({ ...input, monsterId: 'last_helmsman' })).toBeUndefined();

    expect(EQUIPMENT.entropy_compass).toMatchObject({
      id: 'entropy_compass',
      name: '熵航罗盘',
      slot: 'charm',
      cost: { rewardPoints: 920, lingyun: 3, items: { entropy_crystal: 1, chronal_glass: 1 } },
      base: { spirit: 2, artPower: 13, defense: 3 },
      perLevel: { artPower: 5, speed: 1 },
      maxLevel: 3
    });
    expect(EQUIPMENT.entropy_compass.description).toContain('普通怪物或陷阱首次清理触发的自动升熵免除');
    expect(EQUIPMENT.entropy_compass.description).toContain('rush/抢航产生的 +1 熵不免除');
    expect(EQUIPMENT.dissipation_mantle).toMatchObject({
      id: 'dissipation_mantle',
      name: '耗散披甲',
      slot: 'armor',
      cost: { rewardPoints: 900, lingyun: 3, items: { entropy_crystal: 1, rift_dust: 1 } },
      base: { maxHp: 36, artPower: 4, defense: 8 },
      perLevel: { maxHp: 12, artPower: 2, defense: 2 },
      maxLevel: 3
    });
    expect(EQUIPMENT.dissipation_mantle.description).toContain('稳航结算时降熵效果更强');
    expect(EQUIPMENT.ark_keel_boots).toMatchObject({
      id: 'ark_keel_boots',
      name: '方舟龙骨靴',
      slot: 'feet',
      cost: { rewardPoints: 880, lingyun: 3, items: { entropy_crystal: 1, star_iron: 1 } },
      base: { agility: 1, maxHp: 12, defense: 4, speed: 3 },
      perLevel: { maxHp: 8, defense: 2, speed: 1 },
      maxLevel: 3
    });
    expect(EQUIPMENT.ark_keel_boots.description).toContain('Boss 战开始时崩解层数 -1');
  });

  it('registers entropy crystal as a zeroed permanent inventory material', () => {
    expect(ITEM_IDS).toContain('entropy_crystal');
    expect(ITEMS.entropy_crystal).toEqual({
      id: 'entropy_crystal',
      name: '熵晶',
      kind: 'material',
      description: '方舟失序航迹析出的稳定结晶。'
    });
    expect(createInitialState().inventory.entropy_crystal).toBe(0);
  });

  it('uses the exact Tier-11 equipment definitions and mirror chorus elite pool', () => {
    const expectedPool = [
      'parallax_visor',
      'phaseweave_mantle',
      'homecoming_prism'
    ] as const satisfies readonly EquipmentId[];
    const input = {
      dungeonId: 'mirror_cycle_city' as const,
      nodeId: 'mirror_chorus_mirror',
      ownedEquipmentIds: [],
      carriedEquipmentIds: [],
      offersMade: 0
    };
    const offer = getDungeonLootOffer({ ...input, monsterId: 'mirror_chorus' });

    expect(DUNGEON_EQUIPMENT_POOLS.mirror_cycle_city).toEqual(expectedPool);
    expect(offer).toHaveProperty('equipmentIds');
    if (offer && 'equipmentIds' in offer) {
      expect(new Set(offer.equipmentIds)).toEqual(new Set(expectedPool));
    }
    expect(getDungeonLootOffer({ ...input, monsterId: 'parallax_hunter' })).toBeUndefined();
    expect(getDungeonLootOffer({ ...input, monsterId: 'nameless_reflection' })).toBeUndefined();

    expect(EQUIPMENT.parallax_visor).toMatchObject({
      id: 'parallax_visor',
      name: '视差面甲',
      slot: 'head',
      cost: { rewardPoints: 980, lingyun: 3, items: { phase_glass: 1, chronal_glass: 1 } },
      base: { spirit: 2, defense: 4, trapCheck: 6 },
      perLevel: { artPower: 3, defense: 1, trapCheck: 2 },
      maxLevel: 3
    });
    expect(EQUIPMENT.phaseweave_mantle).toMatchObject({
      id: 'phaseweave_mantle',
      name: '相织披风',
      slot: 'armor',
      cost: { rewardPoints: 1000, lingyun: 3, items: { phase_glass: 1, rift_dust: 1 } },
      base: { maxHp: 40, artPower: 6, defense: 9 },
      perLevel: { maxHp: 14, artPower: 2, defense: 3 },
      maxLevel: 3
    });
    expect(EQUIPMENT.homecoming_prism).toMatchObject({
      id: 'homecoming_prism',
      name: '归真棱镜',
      slot: 'charm',
      cost: { rewardPoints: 1020, lingyun: 3, items: { phase_glass: 1, star_iron: 1 } },
      base: { spirit: 2, artPower: 14, defense: 4 },
      perLevel: { artPower: 6, defense: 1 },
      maxLevel: 3
    });
  });

  it('registers phase glass as a zeroed permanent inventory material', () => {
    expect(ITEM_IDS).toContain('phase_glass');
    expect(ITEMS.phase_glass).toEqual({
      id: 'phase_glass',
      name: '相位镜晶',
      kind: 'material',
      description: '镜海轮回城中析出的双相锻材，只能在副本中获得。'
    });
    expect(createInitialState().inventory.phase_glass).toBe(0);
  });

  it('uses the exact Tier-12 redaction pool and converts a fully owned offer to salvage', () => {
    const expectedPool = [
      'redline_edge',
      'palimpsest_mantle',
      'final_proof_seal'
    ] as const satisfies readonly EquipmentId[];
    const input = {
      dungeonId: 'redaction_scriptorium' as const,
      monsterId: 'palimpsest_censor' as const,
      nodeId: 'palimpsest_censor_alpha',
      carriedEquipmentIds: [],
      offersMade: 0
    };

    expect(DUNGEON_ELITE_MONSTERS.redaction_scriptorium).toBe('palimpsest_censor');
    expect(DUNGEON_EQUIPMENT_POOLS.redaction_scriptorium).toEqual(expectedPool);
    expect(getDungeonLootOffer({ ...input, ownedEquipmentIds: [] })).toEqual({
      offerId: 'dungeon-loot:redaction_scriptorium:palimpsest_censor_alpha',
      equipmentIds: expectedPool
    });
    expect(getDungeonLootOffer({
      ...input,
      ownedEquipmentIds: expectedPool,
      guaranteedEquipmentId: 'redline_edge'
    })).toEqual({
      offerId: 'dungeon-loot:redaction_scriptorium:palimpsest_censor_alpha',
      salvageRewardPoints: 320
    });
  });

  it('uses the exact Tier-13 legacy pool without duplicate gear and salvages a fully owned offer', () => {
    const expectedPool = [
      'legacy_gavel',
      'anonymous_veil',
      'escrow_plate',
      'final_lot_bell'
    ] as const satisfies readonly EquipmentId[];
    const input = {
      dungeonId: 'legacy_auction_court' as const,
      monsterId: 'inheritance_mimic' as const,
      nodeId: 'inheritance_mimic_alpha',
      carriedEquipmentIds: [],
      offersMade: 0
    };

    expect(DUNGEON_ELITE_MONSTERS.legacy_auction_court).toBe('inheritance_mimic');
    expect(DUNGEON_EQUIPMENT_POOLS.legacy_auction_court).toEqual(expectedPool);
    expect(DUNGEON_SALVAGE_REWARD_POINTS.legacy_auction_court).toBe(360);

    const offer = getDungeonLootOffer({
      ...input,
      ownedEquipmentIds: [],
      guaranteedEquipmentId: 'legacy_gavel'
    });
    expect(offer).toHaveProperty('equipmentIds');
    if (offer && 'equipmentIds' in offer) {
      expect(offer.equipmentIds[0]).toBe('legacy_gavel');
      expect(offer.equipmentIds).toHaveLength(3);
      expect(new Set(offer.equipmentIds).size).toBe(offer.equipmentIds.length);
      const expectedEquipmentIds = new Set<EquipmentId>(expectedPool);
      expect(offer.equipmentIds.every((equipmentId) => expectedEquipmentIds.has(equipmentId))).toBe(true);
    }

    expect(getDungeonLootOffer({ ...input, ownedEquipmentIds: expectedPool })).toEqual({
      offerId: 'dungeon-loot:legacy_auction_court:inheritance_mimic_alpha',
      salvageRewardPoints: 360
    });
  });

  it('uses only the four mature Tier-14 pieces and preserves guarantee, filtering, and salvage', () => {
    const expectedPool = [
      'helix_cleaver',
      'symbiote_cowl',
      'carapace_harness',
      'rebirth_amulet'
    ] as const satisfies readonly EquipmentId[];
    const input = {
      dungeonId: 'genesis_vault' as const,
      monsterId: 'mutation_guardian' as const,
      nodeId: 'mutation_guardian_omega',
      offersMade: 0
    };

    expect(DUNGEON_ELITE_MONSTERS.genesis_vault).toBe('mutation_guardian');
    expect(DUNGEON_EQUIPMENT_POOLS.genesis_vault).toEqual(expectedPool);
    expect(DUNGEON_SALVAGE_REWARD_POINTS.genesis_vault).toBe(400);

    const guaranteed = getDungeonLootOffer({
      ...input,
      ownedEquipmentIds: [],
      carriedEquipmentIds: [],
      guaranteedEquipmentId: 'rebirth_amulet'
    });
    expect(guaranteed).toHaveProperty('equipmentIds');
    if (guaranteed && 'equipmentIds' in guaranteed) {
      const expectedEquipmentIds = new Set<EquipmentId>(expectedPool);
      expect(guaranteed.equipmentIds[0]).toBe('rebirth_amulet');
      expect(new Set(guaranteed.equipmentIds).size).toBe(guaranteed.equipmentIds.length);
      expect(guaranteed.equipmentIds.every((equipmentId) => expectedEquipmentIds.has(equipmentId))).toBe(true);
    }

    const filtered = getDungeonLootOffer({
      ...input,
      ownedEquipmentIds: ['helix_cleaver'],
      carriedEquipmentIds: ['symbiote_cowl'],
      guaranteedEquipmentId: 'helix_cleaver'
    });
    expect(filtered).toHaveProperty('equipmentIds');
    if (filtered && 'equipmentIds' in filtered) {
      expect(new Set(filtered.equipmentIds)).toEqual(new Set(['carapace_harness', 'rebirth_amulet']));
      expect(filtered).not.toHaveProperty('guaranteedEquipmentId');
    }

    expect(getDungeonLootOffer({
      ...input,
      ownedEquipmentIds: expectedPool,
      carriedEquipmentIds: [],
      guaranteedEquipmentId: 'helix_cleaver'
    })).toEqual({
      offerId: 'dungeon-loot:genesis_vault:mutation_guardian_omega',
      salvageRewardPoints: 400
    });
  });

  it('uses exactly the four Tier-15 pieces and preserves guarantee, filtering, and 440 RP salvage', () => {
    const expectedPool = [
      'hushblade',
      'dead_air_headset',
      'anechoic_mantle',
      'last_channel_beacon'
    ] as const satisfies readonly EquipmentId[];
    const input = {
      dungeonId: 'silent_broadcast_tower' as const,
      monsterId: 'broadcast_warden' as const,
      nodeId: 'broadcast_warden_alpha',
      offersMade: 0
    };

    expect(DUNGEON_ELITE_MONSTERS.silent_broadcast_tower).toBe('broadcast_warden');
    expect(DUNGEON_EQUIPMENT_POOLS.silent_broadcast_tower).toEqual(expectedPool);
    expect(DUNGEON_SALVAGE_REWARD_POINTS.silent_broadcast_tower).toBe(440);

    const guaranteed = getDungeonLootOffer({
      ...input,
      ownedEquipmentIds: [],
      carriedEquipmentIds: [],
      guaranteedEquipmentId: 'last_channel_beacon'
    });
    expect(guaranteed).toHaveProperty('equipmentIds');
    if (guaranteed && 'equipmentIds' in guaranteed) {
      const expectedEquipmentIds = new Set<EquipmentId>(expectedPool);
      expect(guaranteed.equipmentIds[0]).toBe('last_channel_beacon');
      expect(new Set(guaranteed.equipmentIds).size).toBe(guaranteed.equipmentIds.length);
      expect(guaranteed.equipmentIds.every((equipmentId) => expectedEquipmentIds.has(equipmentId))).toBe(true);
    }

    const filtered = getDungeonLootOffer({
      ...input,
      ownedEquipmentIds: ['hushblade'],
      carriedEquipmentIds: ['dead_air_headset'],
      guaranteedEquipmentId: 'hushblade'
    });
    expect(filtered).toHaveProperty('equipmentIds');
    if (filtered && 'equipmentIds' in filtered) {
      expect(new Set(filtered.equipmentIds)).toEqual(new Set(['anechoic_mantle', 'last_channel_beacon']));
      expect(filtered).not.toHaveProperty('guaranteedEquipmentId');
    }

    expect(getDungeonLootOffer({
      ...input,
      ownedEquipmentIds: expectedPool,
      carriedEquipmentIds: [],
      guaranteedEquipmentId: 'hushblade'
    })).toEqual({
      offerId: 'dungeon-loot:silent_broadcast_tower:broadcast_warden_alpha',
      salvageRewardPoints: 440
    });
    expect(getDungeonLootOffer({
      ...input,
      monsterId: 'frequency_leech',
      ownedEquipmentIds: [],
      carriedEquipmentIds: []
    })).toBeUndefined();
  });

  it('uses exactly the four Tier-16 pieces and preserves guarantee, filtering, and 480 RP salvage', () => {
    const expectedPool = [
      'rescue_carbine',
      'triage_visor',
      'evacuation_plate',
      'blackbox_beacon'
    ] as const satisfies readonly EquipmentId[];
    const input = {
      dungeonId: 'lost_shelter' as const,
      monsterId: 'shelter_enforcer' as const,
      nodeId: 'shelter_enforcer_alpha',
      offersMade: 0
    };

    expect(DUNGEON_ELITE_MONSTERS.lost_shelter).toBe('shelter_enforcer');
    expect(DUNGEON_EQUIPMENT_POOLS.lost_shelter).toEqual(expectedPool);
    expect(DUNGEON_SALVAGE_REWARD_POINTS.lost_shelter).toBe(480);

    const guaranteed = getDungeonLootOffer({
      ...input,
      ownedEquipmentIds: [],
      carriedEquipmentIds: [],
      guaranteedEquipmentId: 'blackbox_beacon'
    });
    expect(guaranteed).toHaveProperty('equipmentIds');
    if (guaranteed && 'equipmentIds' in guaranteed) {
      const expectedEquipmentIds = new Set<EquipmentId>(expectedPool);
      expect(guaranteed.equipmentIds[0]).toBe('blackbox_beacon');
      expect(new Set(guaranteed.equipmentIds).size).toBe(guaranteed.equipmentIds.length);
      expect(guaranteed.equipmentIds.every((equipmentId) => expectedEquipmentIds.has(equipmentId))).toBe(true);
    }

    const filtered = getDungeonLootOffer({
      ...input,
      ownedEquipmentIds: ['rescue_carbine'],
      carriedEquipmentIds: ['triage_visor'],
      guaranteedEquipmentId: 'rescue_carbine'
    });
    expect(filtered).toHaveProperty('equipmentIds');
    if (filtered && 'equipmentIds' in filtered) {
      expect(new Set(filtered.equipmentIds)).toEqual(new Set(['evacuation_plate', 'blackbox_beacon']));
      expect(filtered).not.toHaveProperty('guaranteedEquipmentId');
    }

    expect(getDungeonLootOffer({
      ...input,
      ownedEquipmentIds: expectedPool,
      carriedEquipmentIds: [],
      guaranteedEquipmentId: 'rescue_carbine'
    })).toEqual({
      offerId: 'dungeon-loot:lost_shelter:shelter_enforcer_alpha',
      salvageRewardPoints: 480
    });
    expect(getDungeonLootOffer({
      ...input,
      monsterId: 'mimic_survivor',
      ownedEquipmentIds: [],
      carriedEquipmentIds: []
    })).toBeUndefined();
  });

  it('uses exactly the four Tier-17 pieces and preserves guarantee, filtering, and 520 RP salvage', () => {
    const expectedPool = [
      'cross_examiner_sabre',
      'forensic_visor',
      'custody_shell',
      'appeal_seal'
    ] as const satisfies readonly EquipmentId[];
    const input = {
      dungeonId: 'false_testimony_court' as const,
      monsterId: 'archive_censor' as const,
      nodeId: 'archive_censor_alpha',
      offersMade: 0
    };

    expect(DUNGEON_ELITE_MONSTERS.false_testimony_court).toBe('archive_censor');
    expect(DUNGEON_EQUIPMENT_POOLS.false_testimony_court).toEqual(expectedPool);
    expect(DUNGEON_SALVAGE_REWARD_POINTS.false_testimony_court).toBe(520);

    const guaranteed = getDungeonLootOffer({
      ...input,
      ownedEquipmentIds: [],
      carriedEquipmentIds: [],
      guaranteedEquipmentId: 'appeal_seal'
    });
    expect(guaranteed).toHaveProperty('equipmentIds');
    if (guaranteed && 'equipmentIds' in guaranteed) {
      const expectedEquipmentIds = new Set<EquipmentId>(expectedPool);
      expect(guaranteed.equipmentIds[0]).toBe('appeal_seal');
      expect(new Set(guaranteed.equipmentIds).size).toBe(guaranteed.equipmentIds.length);
      expect(guaranteed.equipmentIds.every((equipmentId) => expectedEquipmentIds.has(equipmentId))).toBe(true);
    }

    const filtered = getDungeonLootOffer({
      ...input,
      ownedEquipmentIds: ['cross_examiner_sabre'],
      carriedEquipmentIds: ['forensic_visor'],
      guaranteedEquipmentId: 'cross_examiner_sabre'
    });
    expect(filtered).toHaveProperty('equipmentIds');
    if (filtered && 'equipmentIds' in filtered) {
      expect(new Set(filtered.equipmentIds)).toEqual(new Set(['custody_shell', 'appeal_seal']));
      expect(filtered).not.toHaveProperty('guaranteedEquipmentId');
    }

    expect(getDungeonLootOffer({
      ...input,
      ownedEquipmentIds: expectedPool,
      carriedEquipmentIds: [],
      guaranteedEquipmentId: 'cross_examiner_sabre'
    })).toEqual({
      offerId: 'dungeon-loot:false_testimony_court:archive_censor_alpha',
      salvageRewardPoints: 520
    });
    for (const monsterId of ['hostile_witness', 'perjury_hound', 'false_testimony_judge'] as const) {
      expect(getDungeonLootOffer({
        ...input,
        monsterId,
        ownedEquipmentIds: [],
        carriedEquipmentIds: []
      })).toBeUndefined();
    }
  });

  it('uses exactly the four Tier-18 pieces and preserves guarantee, filtering, and 560 RP salvage', () => {
    const expectedPool = [
      'frame_engraver',
      'cue_visor',
      'buffer_plate',
      'thaw_metronome'
    ] as const satisfies readonly EquipmentId[];
    const input = {
      dungeonId: 'combat_replay_stage' as const,
      monsterId: 'continuity_editor' as const,
      nodeId: 'continuity_editor_alpha',
      offersMade: 0
    };

    expect(DUNGEON_ELITE_MONSTERS.combat_replay_stage).toBe('continuity_editor');
    expect(DUNGEON_EQUIPMENT_POOLS.combat_replay_stage).toEqual(expectedPool);
    expect(DUNGEON_SALVAGE_REWARD_POINTS.combat_replay_stage).toBe(560);

    const guaranteed = getDungeonLootOffer({
      ...input,
      ownedEquipmentIds: [],
      carriedEquipmentIds: [],
      guaranteedEquipmentId: 'thaw_metronome'
    });
    expect(guaranteed).toHaveProperty('equipmentIds');
    if (guaranteed && 'equipmentIds' in guaranteed) {
      const expectedEquipmentIds = new Set<EquipmentId>(expectedPool);
      expect(guaranteed.equipmentIds[0]).toBe('thaw_metronome');
      expect(new Set(guaranteed.equipmentIds).size).toBe(guaranteed.equipmentIds.length);
      expect(guaranteed.equipmentIds.every((equipmentId) => expectedEquipmentIds.has(equipmentId))).toBe(true);
    }

    expect(getDungeonLootOffer({
      ...input,
      ownedEquipmentIds: expectedPool,
      carriedEquipmentIds: []
    })).toEqual({
      offerId: 'dungeon-loot:combat_replay_stage:continuity_editor_alpha',
      salvageRewardPoints: 560
    });
    for (const monsterId of ['cue_stalker', 'retake_double', 'final_cut_director'] as const) {
      expect(getDungeonLootOffer({
        ...input,
        monsterId,
        ownedEquipmentIds: [],
        carriedEquipmentIds: []
      })).toBeUndefined();
    }
  });

  it('does not make another offer after one has already been made', () => {
    expect(
      getDungeonLootOffer({
        dungeonId: 'demon_tower_1',
        monsterId: 'tower_butcher',
        nodeId: 'second-elite',
        ownedEquipmentIds: [],
        carriedEquipmentIds: [],
        offersMade: 1
      })
    ).toBeUndefined();
  });

  it('filters equipment that is already owned or carried in the current run', () => {
    const offer = getDungeonLootOffer({
      dungeonId: 'demon_tower_1',
      monsterId: 'tower_butcher',
      nodeId: 'filtered-elite',
      ownedEquipmentIds: ['armor_piercing_sword'],
      carriedEquipmentIds: ['bone_spear'],
      offersMade: 0
    });

    expect(offer).toHaveProperty('equipmentIds');
    if (offer && 'equipmentIds' in offer) {
      expect(offer.equipmentIds).toHaveLength(2);
      expect(new Set(offer.equipmentIds)).toEqual(new Set(['mist_hood', 'spirit_robe']));
    }
  });

  it('reproduces the same rotated order and offer id for the same node', () => {
    const input = {
      dungeonId: 'metro_abyss' as const,
      monsterId: 'mirror_thread_spider' as const,
      nodeId: 'mirror-platform-elite',
      ownedEquipmentIds: [],
      carriedEquipmentIds: [],
      offersMade: 0
    };

    const firstOffer = getDungeonLootOffer(input);
    const repeatedOffer = getDungeonLootOffer(input);
    const otherNodeOffer = getDungeonLootOffer({ ...input, nodeId: 'flooded-platform-elite' });

    expect(repeatedOffer).toEqual(firstOffer);
    expect(otherNodeOffer?.offerId).not.toBe(firstOffer?.offerId);
    if (firstOffer && 'equipmentIds' in firstOffer && otherNodeOffer && 'equipmentIds' in otherNodeOffer) {
      expect(otherNodeOffer.equipmentIds).not.toEqual(firstOffer.equipmentIds);
    }
  });

  it('keeps the observatory pool deterministic with only two Tier-7 transition pieces', () => {
    const expectedPool = [
      'chronal_edge',
      'chronal_aegis',
      'chronal_lens',
      'starforged_edge',
      'void_lantern'
    ] as const satisfies readonly EquipmentId[];
    const input = {
      dungeonId: 'temporal_observatory' as const,
      monsterId: 'epoch_sentinel' as const,
      nodeId: 'epoch_sentinel_alpha',
      ownedEquipmentIds: [],
      carriedEquipmentIds: [],
      offersMade: 0
    };
    const firstOffer = getDungeonLootOffer(input);
    const repeatedOffer = getDungeonLootOffer(input);

    expect(DUNGEON_EQUIPMENT_POOLS.temporal_observatory).toEqual(expectedPool);
    expect(firstOffer).toEqual({
      offerId: 'dungeon-loot:temporal_observatory:epoch_sentinel_alpha',
      equipmentIds: ['chronal_lens', 'starforged_edge', 'void_lantern']
    });
    expect(repeatedOffer).toEqual(firstOffer);

    const chronalIds = new Set<EquipmentId>(['chronal_edge', 'chronal_aegis', 'chronal_lens']);
    const transitionIds = expectedPool.filter((equipmentId) => !chronalIds.has(equipmentId));
    expect(transitionIds).toEqual(['starforged_edge', 'void_lantern']);
    expect(transitionIds.length).toBeLessThanOrEqual(2);
  });

  it('preserves the ordinary stable-rotation offer shape when no guarantee is supplied', () => {
    expect(
      getDungeonLootOffer({
        dungeonId: 'demon_tower_1',
        monsterId: 'tower_butcher',
        nodeId: 'elite-node',
        ownedEquipmentIds: [],
        carriedEquipmentIds: [],
        offersMade: 0
      })
    ).toEqual({
      offerId: 'dungeon-loot:demon_tower_1:elite-node',
      equipmentIds: ['spirit_robe', 'armor_piercing_sword', 'bone_spear']
    });
  });

  it('places an available guaranteed target first without duplicating it', () => {
    expect(
      getDungeonLootOffer({
        dungeonId: 'demon_tower_1',
        monsterId: 'tower_butcher',
        nodeId: 'guaranteed-elite',
        ownedEquipmentIds: [],
        carriedEquipmentIds: [],
        offersMade: 0,
        guaranteedEquipmentId: 'armor_piercing_sword'
      })
    ).toEqual({
      offerId: 'dungeon-loot:demon_tower_1:guaranteed-elite',
      equipmentIds: ['armor_piercing_sword', 'bone_spear', 'mist_hood'],
      guaranteedEquipmentId: 'armor_piercing_sword'
    });
  });

  it('keeps an available guarantee when fewer than three candidates remain', () => {
    expect(
      getDungeonLootOffer({
        dungeonId: 'demon_tower_1',
        monsterId: 'tower_butcher',
        nodeId: 'short-pool',
        ownedEquipmentIds: ['armor_piercing_sword', 'bone_spear', 'spirit_robe'],
        carriedEquipmentIds: [],
        offersMade: 0,
        guaranteedEquipmentId: 'mist_hood'
      })
    ).toEqual({
      offerId: 'dungeon-loot:demon_tower_1:short-pool',
      equipmentIds: ['mist_hood'],
      guaranteedEquipmentId: 'mist_hood'
    });
  });

  it('falls back field-for-field when the guarantee is invalid or unavailable', () => {
    const baseInput = {
      dungeonId: 'demon_tower_1' as const,
      monsterId: 'tower_butcher' as const,
      nodeId: 'guarantee-fallback',
      ownedEquipmentIds: ['bone_spear'] as EquipmentId[],
      carriedEquipmentIds: [] as EquipmentId[],
      offersMade: 0
    };
    const baseline = getDungeonLootOffer(baseInput);

    expect(getDungeonLootOffer({ ...baseInput, guaranteedEquipmentId: 'ember_staff' })).toEqual(
      baseline
    );
    expect(getDungeonLootOffer({ ...baseInput, guaranteedEquipmentId: 'bone_spear' })).toEqual(
      baseline
    );
  });

  it('converts fully collected pools into tiered salvage reward points', () => {
    const expectedSalvagePoints = [100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300, 320, 360, 400, 440, 480, 520, 560, 600];
    expect(Object.values(DUNGEON_SALVAGE_REWARD_POINTS)).toEqual(expectedSalvagePoints);

    for (const [dungeonId, monsterId] of ELITE_CASES) {
      expect(
        getDungeonLootOffer({
          dungeonId,
          monsterId,
          nodeId: 'fully-collected-elite',
          ownedEquipmentIds: DUNGEON_EQUIPMENT_POOLS[dungeonId],
          carriedEquipmentIds: [],
          offersMade: 0
        })
      ).toEqual({
        offerId: `dungeon-loot:${dungeonId}:fully-collected-elite`,
        salvageRewardPoints: DUNGEON_SALVAGE_REWARD_POINTS[dungeonId]
      });
    }

    expect(
      getDungeonLootOffer({
        dungeonId: 'demon_tower_1',
        monsterId: 'tower_butcher',
        nodeId: 'fully-collected-guaranteed-elite',
        ownedEquipmentIds: DUNGEON_EQUIPMENT_POOLS.demon_tower_1,
        carriedEquipmentIds: [],
        offersMade: 0,
        guaranteedEquipmentId: 'mist_hood'
      })
    ).toEqual({
      offerId: 'dungeon-loot:demon_tower_1:fully-collected-guaranteed-elite',
      salvageRewardPoints: DUNGEON_SALVAGE_REWARD_POINTS.demon_tower_1
    });
  });

  it('converts the collected observatory pool into Tier-8 salvage points', () => {
    expect(
      getDungeonLootOffer({
        dungeonId: 'temporal_observatory',
        monsterId: 'epoch_sentinel',
        nodeId: 'epoch_sentinel_alpha',
        ownedEquipmentIds: DUNGEON_EQUIPMENT_POOLS.temporal_observatory,
        carriedEquipmentIds: [],
        offersMade: 0
      })
    ).toEqual({
      offerId: 'dungeon-loot:temporal_observatory:epoch_sentinel_alpha',
      salvageRewardPoints: 240
    });
  });

  it('converts a fully collected clearinghouse pool into Tier-9 salvage points', () => {
    expect(
      getDungeonLootOffer({
        dungeonId: 'causal_clearinghouse',
        monsterId: 'paradox_bailiff',
        nodeId: 'paradox_bailiff_alpha',
        ownedEquipmentIds: DUNGEON_EQUIPMENT_POOLS.causal_clearinghouse,
        carriedEquipmentIds: [],
        offersMade: 0
      })
    ).toEqual({
      offerId: 'dungeon-loot:causal_clearinghouse:paradox_bailiff_alpha',
      salvageRewardPoints: 260
    });
  });

  it('converts a fully collected ark pool into Tier-10 salvage points', () => {
    expect(
      getDungeonLootOffer({
        dungeonId: 'entropy_ark',
        monsterId: 'dissipation_navigator',
        nodeId: 'dissipation_navigator_alpha',
        ownedEquipmentIds: DUNGEON_EQUIPMENT_POOLS.entropy_ark,
        carriedEquipmentIds: [],
        offersMade: 0
      })
    ).toEqual({
      offerId: 'dungeon-loot:entropy_ark:dissipation_navigator_alpha',
      salvageRewardPoints: 280
    });
  });

  it('converts a fully collected mirror city pool into Tier-11 salvage points', () => {
    expect(
      getDungeonLootOffer({
        dungeonId: 'mirror_cycle_city',
        monsterId: 'mirror_chorus',
        nodeId: 'mirror_chorus_mirror',
        ownedEquipmentIds: DUNGEON_EQUIPMENT_POOLS.mirror_cycle_city,
        carriedEquipmentIds: [],
        offersMade: 0
      })
    ).toEqual({
      offerId: 'dungeon-loot:mirror_cycle_city:mirror_chorus_mirror',
      salvageRewardPoints: 300
    });
  });

  it('locks the Tier-19 pool, guarantee filtering, and 600-point salvage without rewriting Tier-18', () => {
    expect(DUNGEON_EQUIPMENT_POOLS.panopticon_city).toEqual([
      'blindline_cutter',
      'predictive_visor',
      'matte_shell',
      'inverse_prism'
    ]);
    expect(DUNGEON_EQUIPMENT_POOLS.combat_replay_stage).toEqual([
      'frame_engraver',
      'cue_visor',
      'buffer_plate',
      'thaw_metronome'
    ]);
    expect(DUNGEON_SALVAGE_REWARD_POINTS.combat_replay_stage).toBe(560);
    expect(DUNGEON_SALVAGE_REWARD_POINTS.panopticon_city).toBe(600);

    expect(getDungeonLootOffer({
      dungeonId: 'panopticon_city',
      monsterId: 'blindspot_auditor',
      nodeId: 'blindspot_auditor_north',
      ownedEquipmentIds: ['blindline_cutter'],
      carriedEquipmentIds: ['predictive_visor'],
      offersMade: 0,
      guaranteedEquipmentId: 'inverse_prism'
    })).toEqual({
      offerId: 'dungeon-loot:panopticon_city:blindspot_auditor_north',
      equipmentIds: ['inverse_prism', 'matte_shell'],
      guaranteedEquipmentId: 'inverse_prism'
    });

    expect(getDungeonLootOffer({
      dungeonId: 'panopticon_city',
      monsterId: 'blindspot_auditor',
      nodeId: 'sold-out',
      ownedEquipmentIds: DUNGEON_EQUIPMENT_POOLS.panopticon_city,
      carriedEquipmentIds: [],
      offersMade: 0
    })).toEqual({
      offerId: 'dungeon-loot:panopticon_city:sold-out',
      salvageRewardPoints: 600
    });
  });
});
