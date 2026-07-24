import { describe, expect, it } from 'vitest';
import { getBossDefinition } from './boss-system';
import { DUNGEONS, DUNGEON_ORDER, MONSTERS } from './level-content';
import type { DungeonId, ItemId, MonsterDefinition } from './game';
import {
  RUN_PROTOCOL_IDS,
  evaluateRunProtocolReward,
  getImprintRunProtocolDefinitions,
  getRunProtocolDefinition,
  getRunProtocolRequiredNodeIds,
  isRunProtocolAvailable,
  scaleMonsterForRunProtocol,
  scaleRunProtocolRewardPoints,
  scaleTrapForRunProtocol,
  type DeepRunProtocolDefinition,
  type ImprintRunProtocolDefinition,
  type RunProtocolId
} from './run-protocols';

const COMBAT_STATS = ['maxHp', 'attack', 'artPower', 'defense', 'speed'] as const;
const MODIFIER_KEYS = [
  'enemyStatMultiplierPercent',
  'trapDamageMultiplierPercent',
  'trapDcMultiplierPercent',
  'unmetAnchorBossMultiplierPercent',
  'clearRewardPointMultiplierPercent'
] as const;

const DEEP_EXPECTATIONS = {
  demon_tower_1: {
    requiredNodeIds: ['risky_font_trap', 'hidden_stone_cache'],
    itemId: 'demon_bone'
  },
  metro_abyss: {
    requiredNodeIds: ['echo_coin_vendor', 'mirror_shell_nest'],
    itemId: 'mirror_shell'
  },
  starfall_mine: {
    requiredNodeIds: ['north_star_vein', 'rift_dust_reward'],
    itemId: 'star_iron'
  },
  rust_hospital: {
    requiredNodeIds: ['surgical_theater_reward', 'morgue_reward'],
    itemId: 'medicine_ash'
  },
  ash_arena: {
    requiredNodeIds: ['champion_branch_reward', 'cracked_core_prize'],
    itemId: 'cracked_core'
  },
  dream_archive: {
    requiredNodeIds: ['cracked_core_index_reward', 'sealed_footnote_reward'],
    itemId: 'hidden_stone'
  },
  void_citadel: {
    requiredNodeIds: ['echo_branch_cache', 'cracked_core_reward'],
    itemId: 'rift_dust'
  },
  temporal_observatory: {
    requiredNodeIds: ['past_calibration_anchor', 'future_calibration_anchor'],
    itemId: 'chronal_glass'
  },
  causal_clearinghouse: {
    requiredNodeIds: ['cause_deposition', 'effect_deposition'],
    itemId: 'causal_seal'
  },
  entropy_ark: {
    requiredNodeIds: ['port_ballast_core', 'starboard_ballast_core'],
    itemId: 'entropy_crystal'
  },
  mirror_cycle_city: {
    requiredNodeIds: ['real_anchor', 'mirror_anchor'],
    itemId: 'phase_glass'
  },
  redaction_scriptorium: {
    requiredNodeIds: ['body_proof_vault', 'memory_survey_archive'],
    itemId: 'redaction_ink'
  },
  legacy_auction_court: {
    requiredNodeIds: ['force_claim_vault', 'return_claim_vault'],
    itemId: 'legacy_scrip'
  },
  genesis_vault: {
    requiredNodeIds: ['mosaic_gene_vault', 'lineage_event_stage'],
    itemId: 'genesis_serum'
  },
  silent_broadcast_tower: {
    requiredNodeIds: ['broadcast_memory_stage', 'anechoic_chamber'],
    itemId: 'silence_core'
  },
  lost_shelter: {
    requiredNodeIds: ['survivor_memory_stage', 'containment_bay'],
    itemId: 'rescue_badge'
  },
  false_testimony_court: {
    requiredNodeIds: ['cross_exam_stage', 'judgment_lock'],
    itemId: 'truth_fragment'
  },
  combat_replay_stage: {
    requiredNodeIds: ['script_projection_stage', 'final_cut_lock'],
    itemId: 'combat_reel'
  },
  panopticon_city: {
    requiredNodeIds: ['blindline_archive', 'all_sight_lock'],
    itemId: 'observation_shard'
  }
} as const satisfies Record<
  DungeonId,
  { readonly requiredNodeIds: readonly [string, string]; readonly itemId: ItemId }
>;

function getImprint(dungeonId: DungeonId): ImprintRunProtocolDefinition {
  const definition = getRunProtocolDefinition(dungeonId, 'imprint');
  if (!definition || definition.id !== 'imprint') throw new Error(`Missing imprint protocol for ${dungeonId}`);
  return definition;
}

function getDeep(dungeonId: DungeonId): DeepRunProtocolDefinition {
  const definition = getRunProtocolDefinition(dungeonId, 'deep');
  if (!definition || definition.id !== 'deep') throw new Error(`Missing deep protocol for ${dungeonId}`);
  return definition;
}

function manhattanDistance(left: { x: number; y: number }, right: { x: number; y: number }): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

describe('run protocols', () => {
  it('defines standard, imprint, and deep for every dungeon', () => {
    const imprintDefinitions = getImprintRunProtocolDefinitions();

    expect(RUN_PROTOCOL_IDS).toEqual(['standard', 'imprint', 'deep']);
    expect(imprintDefinitions.map(({ dungeonId }) => dungeonId)).toEqual(DUNGEON_ORDER);
    expect(new Set(imprintDefinitions.map(({ dungeonId }) => dungeonId)).size).toBe(19);

    for (const dungeonId of DUNGEON_ORDER) {
      const standard = getRunProtocolDefinition(dungeonId, 'standard');
      const imprint = getImprint(dungeonId);
      const deep = getDeep(dungeonId);

      expect(standard).toMatchObject({ id: 'standard', dungeonId });
      expect(imprint).toMatchObject({ id: 'imprint', dungeonId });
      expect(deep).toMatchObject({ id: 'deep', dungeonId, name: '深层回响' });
      if (!standard) throw new Error(`Missing standard protocol for ${dungeonId}`);
      expect(getRunProtocolRequiredNodeIds(standard)).toEqual([]);
      expect(getRunProtocolRequiredNodeIds(imprint)).toEqual([imprint.requiredNodeId]);
      expect(getRunProtocolRequiredNodeIds(deep)).toEqual(deep.requiredNodeIds);
    }

    expect(getRunProtocolDefinition('missing' as DungeonId, 'standard')).toBeUndefined();
    expect(getRunProtocolDefinition('demon_tower_1', 'unknown' as RunProtocolId)).toBeUndefined();
  });

  it('defines the exact deep anchors and material reward for all nineteen dungeons', () => {
    for (const dungeonId of DUNGEON_ORDER) {
      const definition = getDeep(dungeonId);
      const expected = DEEP_EXPECTATIONS[dungeonId];

      expect(definition.requiredNodeIds).toEqual(expected.requiredNodeIds);
      expect(definition.materialReward).toEqual({ itemId: expected.itemId, amount: 2 });
      expect(definition.mutationName).toMatch(/[\u4e00-\u9fff]/);
      expect(definition.description).toMatch(/[\u4e00-\u9fff]/);
      expect(definition.objectiveText).toMatch(/[\u4e00-\u9fff]/);
    }
  });

  it('defines the Tier-8 temporal protocols and deep mutation on the expected curve', () => {
    const imprint = getImprint('temporal_observatory');
    const deep = getDeep('temporal_observatory');

    expect(imprint).toMatchObject({
      requiredNodeId: 'entry_chronometer',
      modifiers: {
        enemyStatMultiplierPercent: 129,
        trapDamageMultiplierPercent: 138,
        trapDcMultiplierPercent: 125,
        unmetAnchorBossMultiplierPercent: 149,
        clearRewardPointMultiplierPercent: 168
      },
      imprint: { id: 'chronometer_entry_mark' }
    });
    expect(deep).toMatchObject({
      requiredNodeIds: ['past_calibration_anchor', 'future_calibration_anchor'],
      mutationName: '纪元叠校',
      materialReward: { itemId: 'chronal_glass', amount: 2 },
      modifiers: {
        enemyStatMultiplierPercent: 154,
        trapDamageMultiplierPercent: 160,
        trapDcMultiplierPercent: 160,
        unmetAnchorBossMultiplierPercent: 183,
        clearRewardPointMultiplierPercent: 193
      }
    });
    expect(scaleRunProtocolRewardPoints(100, 'temporal_observatory', 'deep')).toBe(193);
  });

  it('defines the Tier-9 causal protocols with real non-terminal anchors on the next curve step', () => {
    const imprint = getImprint('causal_clearinghouse');
    const deep = getDeep('causal_clearinghouse');
    const dungeon = DUNGEONS.causal_clearinghouse;
    const bossNodeId = getBossDefinition('causal_clearinghouse').nodeId;

    expect(imprint).toMatchObject({
      requiredNodeId: 'entry_docket',
      modifiers: {
        enemyStatMultiplierPercent: 132,
        trapDamageMultiplierPercent: 141,
        trapDcMultiplierPercent: 128,
        unmetAnchorBossMultiplierPercent: 153,
        clearRewardPointMultiplierPercent: 174
      },
      imprint: { id: 'causal_docket_mark' }
    });
    expect(deep).toMatchObject({
      requiredNodeIds: ['cause_deposition', 'effect_deposition'],
      mutationName: '因果倒证',
      materialReward: { itemId: 'causal_seal', amount: 2 },
      modifiers: {
        enemyStatMultiplierPercent: 158,
        trapDamageMultiplierPercent: 164,
        trapDcMultiplierPercent: 164,
        unmetAnchorBossMultiplierPercent: 188,
        clearRewardPointMultiplierPercent: 198
      }
    });
    expect(scaleRunProtocolRewardPoints(100, 'causal_clearinghouse', 'deep')).toBe(198);

    for (const nodeId of ['entry_docket', 'cause_deposition', 'effect_deposition']) {
      const node = dungeon.nodes.find((candidate) => candidate.id === nodeId);
      expect(node).toBeDefined();
      expect(node?.id).not.toBe(bossNodeId);
      expect(node?.type).not.toBe('boss');
      expect(node?.type).not.toBe('exit');
      expect(node?.type).not.toBe('portal');
    }
  });

  it('defines the Tier-10 entropy protocols with the fixed manifest and ballast contracts', () => {
    const imprint = getImprint('entropy_ark');
    const deep = getDeep('entropy_ark');

    expect(imprint).toMatchObject({
      requiredNodeId: 'ark_manifest',
      modifiers: {
        enemyStatMultiplierPercent: 135,
        trapDamageMultiplierPercent: 144,
        trapDcMultiplierPercent: 131,
        unmetAnchorBossMultiplierPercent: 157,
        clearRewardPointMultiplierPercent: 180
      },
      imprint: { id: 'entropy_manifest_mark' }
    });
    expect(`${imprint.name}${imprint.objectiveText}${imprint.imprint.name}`).toContain('熵舱清单');
    expect(deep).toMatchObject({
      requiredNodeIds: ['port_ballast_core', 'starboard_ballast_core'],
      mutationName: '熵潮失稳',
      materialReward: { itemId: 'entropy_crystal', amount: 2 },
      modifiers: {
        enemyStatMultiplierPercent: 162,
        trapDamageMultiplierPercent: 168,
        trapDcMultiplierPercent: 168,
        unmetAnchorBossMultiplierPercent: 193,
        clearRewardPointMultiplierPercent: 203
      }
    });
    expect(scaleRunProtocolRewardPoints(100, 'entropy_ark', 'deep')).toBe(203);
  });

  it('defines the Tier-11 mirror protocols with real and mirror anchors', () => {
    const imprint = getImprint('mirror_cycle_city');
    const deep = getDeep('mirror_cycle_city');

    expect(imprint).toMatchObject({
      requiredNodeId: 'real_anchor',
      modifiers: {
        enemyStatMultiplierPercent: 138,
        trapDamageMultiplierPercent: 147,
        trapDcMultiplierPercent: 134,
        unmetAnchorBossMultiplierPercent: 161,
        clearRewardPointMultiplierPercent: 186
      },
      imprint: { id: 'mirror_cycle_mark' }
    });
    expect(deep).toMatchObject({
      requiredNodeIds: ['real_anchor', 'mirror_anchor'],
      mutationName: '双相无名',
      materialReward: { itemId: 'phase_glass', amount: 2 },
      modifiers: {
        enemyStatMultiplierPercent: 166,
        trapDamageMultiplierPercent: 172,
        trapDcMultiplierPercent: 172,
        unmetAnchorBossMultiplierPercent: 198,
        clearRewardPointMultiplierPercent: 208
      }
    });
    expect(scaleRunProtocolRewardPoints(100, 'mirror_cycle_city', 'deep')).toBe(208);
  });

  it('defines the Tier-12 final-proof imprint and deep evidence anchors on the next curve step', () => {
    const imprint = getImprint('redaction_scriptorium');
    const deep = getDeep('redaction_scriptorium');

    expect(imprint).toMatchObject({
      requiredNodeId: 'final_proof_nexus',
      modifiers: {
        enemyStatMultiplierPercent: 141,
        trapDamageMultiplierPercent: 150,
        trapDcMultiplierPercent: 137,
        unmetAnchorBossMultiplierPercent: 165,
        clearRewardPointMultiplierPercent: 192
      },
      imprint: {
        id: 'final_proof_mark',
        name: '终校定版印'
      }
    });
    expect(deep).toMatchObject({
      requiredNodeIds: ['body_proof_vault', 'memory_survey_archive'],
      mutationName: '三证反删',
      materialReward: { itemId: 'redaction_ink', amount: 2 },
      modifiers: {
        enemyStatMultiplierPercent: 170,
        trapDamageMultiplierPercent: 176,
        trapDcMultiplierPercent: 176,
        unmetAnchorBossMultiplierPercent: 203,
        clearRewardPointMultiplierPercent: 213
      }
    });
    expect(scaleRunProtocolRewardPoints(100, 'redaction_scriptorium', 'deep')).toBe(213);
  });

  it('defines the Tier-13 hammer-chain imprint and claim-vault deep anchors on the next curve step', () => {
    const imprint = getImprint('legacy_auction_court');
    const deep = getDeep('legacy_auction_court');

    expect(imprint).toMatchObject({
      requiredNodeId: 'provenance_event_stage',
      modifiers: {
        enemyStatMultiplierPercent: 144,
        trapDamageMultiplierPercent: 153,
        trapDcMultiplierPercent: 140,
        unmetAnchorBossMultiplierPercent: 169,
        clearRewardPointMultiplierPercent: 198
      },
      imprint: {
        id: 'hammer_chain_mark',
        name: '执槌链印'
      }
    });
    expect(deep).toMatchObject({
      requiredNodeIds: ['force_claim_vault', 'return_claim_vault'],
      mutationName: '四席追价',
      materialReward: { itemId: 'legacy_scrip', amount: 2 },
      modifiers: {
        enemyStatMultiplierPercent: 174,
        trapDamageMultiplierPercent: 180,
        trapDcMultiplierPercent: 180,
        unmetAnchorBossMultiplierPercent: 208,
        clearRewardPointMultiplierPercent: 218
      }
    });
    expect(scaleRunProtocolRewardPoints(100, 'legacy_auction_court', 'deep')).toBe(218);
  });

  it('defines the Tier-14 mosaic imprint and lineage deep anchors on the next curve step', () => {
    const imprint = getImprint('genesis_vault');
    const deep = getDeep('genesis_vault');

    expect(imprint).toMatchObject({
      requiredNodeId: 'mosaic_gene_vault',
      modifiers: {
        enemyStatMultiplierPercent: 147,
        trapDamageMultiplierPercent: 156,
        trapDcMultiplierPercent: 143,
        unmetAnchorBossMultiplierPercent: 173,
        clearRewardPointMultiplierPercent: 204
      },
      imprint: { id: 'genesis_mosaic_mark', name: '嵌合原型印' }
    });
    expect(deep).toMatchObject({
      requiredNodeIds: ['mosaic_gene_vault', 'lineage_event_stage'],
      mutationName: '始祖并序',
      materialReward: { itemId: 'genesis_serum', amount: 2 },
      modifiers: {
        enemyStatMultiplierPercent: 178,
        trapDamageMultiplierPercent: 184,
        trapDcMultiplierPercent: 184,
        unmetAnchorBossMultiplierPercent: 213,
        clearRewardPointMultiplierPercent: 223
      }
    });
    expect(scaleRunProtocolRewardPoints(100, 'genesis_vault', 'deep')).toBe(223);
  });

  it('defines the Tier-15 last-broadcast imprint and anechoic deep anchors on the next curve step', () => {
    const imprint = getImprint('silent_broadcast_tower');
    const deep = getDeep('silent_broadcast_tower');

    expect(imprint).toMatchObject({
      requiredNodeId: 'broadcast_memory_stage',
      modifiers: {
        enemyStatMultiplierPercent: 150,
        trapDamageMultiplierPercent: 159,
        trapDcMultiplierPercent: 146,
        unmetAnchorBossMultiplierPercent: 177,
        clearRewardPointMultiplierPercent: 210
      },
      imprint: { id: 'last_broadcast_mark', name: '末段人声印' }
    });
    expect(deep).toMatchObject({
      requiredNodeIds: ['broadcast_memory_stage', 'anechoic_chamber'],
      mutationName: '全城死频',
      materialReward: { itemId: 'silence_core', amount: 2 },
      modifiers: {
        enemyStatMultiplierPercent: 182,
        trapDamageMultiplierPercent: 188,
        trapDcMultiplierPercent: 188,
        unmetAnchorBossMultiplierPercent: 218,
        clearRewardPointMultiplierPercent: 228
      }
    });
    expect(scaleRunProtocolRewardPoints(100, 'silent_broadcast_tower', 'deep')).toBe(228);
  });

  it('defines the Tier-16 survivor imprint and containment deep anchors on the next curve step', () => {
    const imprint = getImprint('lost_shelter');
    const deep = getDeep('lost_shelter');

    expect(imprint).toMatchObject({
      requiredNodeId: 'survivor_memory_stage',
      modifiers: {
        enemyStatMultiplierPercent: 153,
        trapDamageMultiplierPercent: 162,
        trapDcMultiplierPercent: 149,
        unmetAnchorBossMultiplierPercent: 181,
        clearRewardPointMultiplierPercent: 216
      },
      imprint: { id: 'survivor_roll_call_mark', name: '幸存点名印' }
    });
    expect(deep).toMatchObject({
      requiredNodeIds: ['survivor_memory_stage', 'containment_bay'],
      mutationName: '全员失联',
      materialReward: { itemId: 'rescue_badge', amount: 2 },
      modifiers: {
        enemyStatMultiplierPercent: 186,
        trapDamageMultiplierPercent: 192,
        trapDcMultiplierPercent: 192,
        unmetAnchorBossMultiplierPercent: 223,
        clearRewardPointMultiplierPercent: 233
      }
    });
    expect(scaleRunProtocolRewardPoints(100, 'lost_shelter', 'deep')).toBe(233);
  });

  it('defines the Tier-17 testimony imprint and verdict-lock deep anchors', () => {
    const imprint = getImprint('false_testimony_court');
    const deep = getDeep('false_testimony_court');

    expect(imprint).toMatchObject({
      requiredNodeId: 'cross_exam_stage',
      imprint: { id: 'cross_exam_verdict_mark', name: '诘问裁定印' },
      modifiers: {
        enemyStatMultiplierPercent: 156,
        trapDamageMultiplierPercent: 165,
        trapDcMultiplierPercent: 152,
        unmetAnchorBossMultiplierPercent: 185,
        clearRewardPointMultiplierPercent: 222
      }
    });
    expect(deep).toMatchObject({
      requiredNodeIds: ['cross_exam_stage', 'judgment_lock'],
      mutationName: '三证倒判',
      materialReward: { itemId: 'truth_fragment', amount: 2 },
      modifiers: {
        enemyStatMultiplierPercent: 190,
        trapDamageMultiplierPercent: 196,
        trapDcMultiplierPercent: 196,
        unmetAnchorBossMultiplierPercent: 228,
        clearRewardPointMultiplierPercent: 238
      }
    });
    expect(scaleRunProtocolRewardPoints(100, 'false_testimony_court', 'deep')).toBe(238);
  });

  it('defines the exact Tier-18 combat replay protocol curve and anchors', () => {
    const imprint = getImprint('combat_replay_stage');
    const deep = getDeep('combat_replay_stage');

    expect(imprint).toMatchObject({
      requiredNodeId: 'script_projection_stage',
      modifiers: {
        enemyStatMultiplierPercent: 159,
        trapDamageMultiplierPercent: 168,
        trapDcMultiplierPercent: 155,
        unmetAnchorBossMultiplierPercent: 189,
        clearRewardPointMultiplierPercent: 228
      },
      imprint: { id: 'script_projection_mark' }
    });
    expect(deep).toMatchObject({
      requiredNodeIds: ['script_projection_stage', 'final_cut_lock'],
      materialReward: { itemId: 'combat_reel', amount: 2 },
      modifiers: {
        enemyStatMultiplierPercent: 194,
        trapDamageMultiplierPercent: 200,
        trapDcMultiplierPercent: 200,
        unmetAnchorBossMultiplierPercent: 233,
        clearRewardPointMultiplierPercent: 243
      }
    });
    expect(scaleRunProtocolRewardPoints(100, 'combat_replay_stage', 'deep')).toBe(243);
  });

  it('defines the Tier-19 inverse-observation imprint and all-sight deep curve without changing Tier-18', () => {
    const imprint = getImprint('panopticon_city');
    const deep = getDeep('panopticon_city');

    expect(imprint).toMatchObject({
      requiredNodeId: 'inverse_observation_stage',
      imprint: { id: 'inverse_observation_mark', name: '逆观测留痕印' },
      modifiers: {
        enemyStatMultiplierPercent: 162,
        trapDamageMultiplierPercent: 171,
        trapDcMultiplierPercent: 158,
        unmetAnchorBossMultiplierPercent: 193,
        clearRewardPointMultiplierPercent: 234
      }
    });
    expect(deep).toMatchObject({
      requiredNodeIds: ['blindline_archive', 'all_sight_lock'],
      mutationName: '全景锁定',
      materialReward: { itemId: 'observation_shard', amount: 2 },
      modifiers: {
        enemyStatMultiplierPercent: 198,
        trapDamageMultiplierPercent: 204,
        trapDcMultiplierPercent: 204,
        unmetAnchorBossMultiplierPercent: 238,
        clearRewardPointMultiplierPercent: 248
      }
    });
    expect(scaleRunProtocolRewardPoints(100, 'panopticon_city', 'deep')).toBe(248);
    expect(getImprint('combat_replay_stage').modifiers.clearRewardPointMultiplierPercent).toBe(228);
    expect(getDeep('combat_replay_stage').modifiers.clearRewardPointMultiplierPercent).toBe(243);
  });

  it('uses real non-boss branch nodes as anchors that require a detour', () => {
    for (const definition of getImprintRunProtocolDefinitions()) {
      const dungeon = DUNGEONS[definition.dungeonId];
      const anchor = dungeon.nodes.find(({ id }) => id === definition.requiredNodeId);
      const start = dungeon.nodes.find(({ id }) => id === dungeon.grid.startNodeId);
      const boss = dungeon.nodes.find(({ id }) => id === getBossDefinition(definition.dungeonId).nodeId);

      expect(anchor).toBeDefined();
      expect(start).toBeDefined();
      expect(boss).toBeDefined();
      expect(['trap', 'reward', 'portal']).toContain(anchor?.type);
      expect(anchor?.type).not.toBe('exit');
      expect(anchor?.id).not.toBe(boss?.id);

      if (!anchor || !start || !boss) throw new Error(`Invalid anchor route for ${definition.dungeonId}`);
      const directDistance = manhattanDistance(start.position, boss.position);
      const anchoredDistance = manhattanDistance(start.position, anchor.position) + manhattanDistance(anchor.position, boss.position);
      if (definition.dungeonId === 'entropy_ark' || definition.dungeonId === 'redaction_scriptorium' || definition.dungeonId === 'legacy_auction_court' || definition.dungeonId === 'genesis_vault' || definition.dungeonId === 'silent_broadcast_tower' || definition.dungeonId === 'lost_shelter') {
        expect(['ark_manifest', 'final_proof_nexus', 'provenance_event_stage', 'mosaic_gene_vault', 'broadcast_memory_stage', 'survivor_memory_stage']).toContain(definition.requiredNodeId);
        expect(anchoredDistance).toBe(directDistance);
      } else {
        expect(anchoredDistance).toBeGreaterThan(directDistance);
      }
    }
  });

  it('uses two distinct existing non-boss nodes for every deep detour', () => {
    for (const dungeonId of DUNGEON_ORDER) {
      const dungeon = DUNGEONS[dungeonId];
      const deep = getDeep(dungeonId);
      const bossNodeId = getBossDefinition(dungeonId).nodeId;

      expect(deep.requiredNodeIds).toHaveLength(2);
      expect(new Set(deep.requiredNodeIds).size).toBe(2);

      for (const nodeId of deep.requiredNodeIds) {
        const anchor = dungeon.nodes.find(({ id }) => id === nodeId);
        expect(anchor).toBeDefined();
        expect(['trap', 'reward', 'portal']).toContain(anchor?.type);
        expect(anchor?.type).not.toBe('exit');
        expect(nodeId).not.toBe(bossNodeId);
      }
    }
  });

  it('keeps every imprint distinct, integral, and strictly stronger than standard', () => {
    const definitions = getImprintRunProtocolDefinitions();

    expect(new Set(definitions.map(({ name }) => name)).size).toBe(19);
    expect(new Set(definitions.map(({ requiredNodeId }) => requiredNodeId)).size).toBe(19);
    expect(new Set(definitions.map(({ imprint }) => imprint.id)).size).toBe(19);
    expect(new Set(definitions.map(({ imprint }) => imprint.name)).size).toBe(19);

    for (const key of MODIFIER_KEYS) {
      const values = definitions.map(({ modifiers }) => modifiers[key]);
      expect(new Set(values).size).toBe(19);
      for (const value of values) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThan(100);
      }
    }

    for (const definition of definitions) {
      expect(definition.name).toMatch(/[\u4e00-\u9fff]/);
      expect(definition.description).toMatch(/[\u4e00-\u9fff]/);
      expect(definition.objectiveText).toMatch(/[\u4e00-\u9fff]/);
      expect(definition.imprint.description).toMatch(/[\u4e00-\u9fff]/);
    }
  });

  it('scales deep modifiers monotonically by tier above each imprint', () => {
    const definitions = DUNGEON_ORDER.map(getDeep);
    const expectedBounds = {
      enemyStatMultiplierPercent: [126, 198],
      trapDamageMultiplierPercent: [132, 204],
      trapDcMultiplierPercent: [132, 204],
      unmetAnchorBossMultiplierPercent: [148, 238],
      clearRewardPointMultiplierPercent: [158, 248]
    } as const;

    expect(new Set(definitions.map(({ mutationName }) => mutationName)).size).toBe(19);

    for (const key of MODIFIER_KEYS) {
      const values = definitions.map(({ modifiers }) => modifiers[key]);
      expect(values[0]).toBe(expectedBounds[key][0]);
      expect(values.at(-1)).toBe(expectedBounds[key][1]);

      for (let index = 0; index < values.length; index += 1) {
        expect(Number.isInteger(values[index])).toBe(true);
        expect(values[index]).toBeGreaterThan(getImprint(DUNGEON_ORDER[index]).modifiers[key]);
        if (index > 0) expect(values[index]).toBeGreaterThan(values[index - 1]);
      }
    }
  });

  it('unlocks imprint and deep only after that dungeon has been completed', () => {
    for (const dungeonId of DUNGEON_ORDER) {
      const otherDungeonIds = DUNGEON_ORDER.filter((candidate) => candidate !== dungeonId);
      expect(isRunProtocolAvailable(dungeonId, 'standard', [])).toBe(true);
      expect(isRunProtocolAvailable(dungeonId, 'imprint', undefined)).toBe(false);
      expect(isRunProtocolAvailable(dungeonId, 'imprint', otherDungeonIds)).toBe(false);
      expect(isRunProtocolAvailable(dungeonId, 'imprint', [...otherDungeonIds, dungeonId])).toBe(true);
      expect(isRunProtocolAvailable(dungeonId, 'deep', undefined)).toBe(false);
      expect(isRunProtocolAvailable(dungeonId, 'deep', otherDungeonIds)).toBe(false);
      expect(isRunProtocolAvailable(dungeonId, 'deep', [...otherDungeonIds, dungeonId])).toBe(true);
    }

    expect(isRunProtocolAvailable('missing' as DungeonId, 'standard', [])).toBe(false);
  });

  it('scales both nonstandard monster paths without mutation and applies boss breach only when anchors are unmet', () => {
    const monster = MONSTERS.tower_butcher;
    const snapshot = structuredClone(monster);
    const standard = scaleMonsterForRunProtocol(monster, 'standard');
    const regular = scaleMonsterForRunProtocol(monster, 'imprint');
    const anchoredBoss = scaleMonsterForRunProtocol(monster, 'imprint', {
      isBoss: true,
      anchorCompletedBeforeBoss: true
    });
    const breachedBoss = scaleMonsterForRunProtocol(monster, 'imprint', {
      isBoss: true,
      anchorCompletedBeforeBoss: false
    });
    const deepRegular = scaleMonsterForRunProtocol(monster, 'deep');
    const deepAnchoredBoss = scaleMonsterForRunProtocol(monster, 'deep', {
      isBoss: true,
      anchorCompletedBeforeBoss: true
    });
    const deepBreachedBoss = scaleMonsterForRunProtocol(monster, 'deep', {
      isBoss: true,
      anchorCompletedBeforeBoss: false
    });

    expect(standard).toBe(monster);
    expect(regular).not.toBe(monster);
    expect(anchoredBoss).toEqual(regular);
    expect(deepRegular).not.toBe(monster);
    expect(deepAnchoredBoss).toEqual(deepRegular);
    expect(monster).toEqual(snapshot);
    expect(regular.rewardPoints).toBe(monster.rewardPoints);
    expect(regular.drop).toBe(monster.drop);
    expect(deepRegular.rewardPoints).toBe(monster.rewardPoints);
    expect(deepRegular.drop).toBe(monster.drop);

    for (const stat of COMBAT_STATS) {
      expect(Number.isInteger(regular[stat])).toBe(true);
      expect(regular[stat]).toBeGreaterThan(monster[stat]);
      expect(breachedBoss[stat]).toBeGreaterThan(anchoredBoss[stat]);
      expect(deepRegular[stat]).toBeGreaterThanOrEqual(regular[stat]);
      expect(deepBreachedBoss[stat]).toBeGreaterThan(deepAnchoredBoss[stat]);
    }
    expect(COMBAT_STATS.some((stat) => deepRegular[stat] > regular[stat])).toBe(true);

    const malformed: MonsterDefinition = {
      ...monster,
      maxHp: Number.NaN,
      attack: Number.NEGATIVE_INFINITY,
      artPower: -4,
      defense: 0,
      speed: 1.4
    };
    const converged = scaleMonsterForRunProtocol(malformed, 'deep');
    for (const stat of COMBAT_STATS) {
      expect(Number.isSafeInteger(converged[stat])).toBe(true);
      expect(converged[stat]).toBeGreaterThan(0);
    }
  });

  it('scales trap damage and DC without mutation while standard remains identical', () => {
    const trap = DUNGEONS.demon_tower_1.nodes.find(({ id }) => id === 'risky_font_trap')?.trap;
    if (!trap) throw new Error('Missing demon tower protocol trap');
    const snapshot = { ...trap };

    expect(scaleTrapForRunProtocol(trap, 'demon_tower_1', 'standard')).toBe(trap);
    const imprint = scaleTrapForRunProtocol(trap, 'demon_tower_1', 'imprint');
    const deep = scaleTrapForRunProtocol(trap, 'demon_tower_1', 'deep');
    expect(imprint).not.toBe(trap);
    expect(imprint.damage).toBeGreaterThan(trap.damage);
    expect(imprint.dc).toBeGreaterThan(trap.dc);
    expect(deep.damage).toBeGreaterThan(imprint.damage);
    expect(deep.dc).toBeGreaterThan(imprint.dc);
    expect(deep.counterItem).toBe(trap.counterItem);
    expect(Number.isInteger(deep.damage)).toBe(true);
    expect(Number.isInteger(deep.dc)).toBe(true);
    expect(trap).toEqual(snapshot);

    const malformed = scaleTrapForRunProtocol({ damage: Number.NaN, dc: -8 }, 'demon_tower_1', 'deep');
    expect(Number.isSafeInteger(malformed.damage)).toBe(true);
    expect(Number.isSafeInteger(malformed.dc)).toBe(true);
    expect(malformed.damage).toBeGreaterThan(0);
    expect(malformed.dc).toBeGreaterThan(0);
  });

  it('grants protocol rewards only when the anchor precedes a defeated boss', () => {
    const dungeonId: DungeonId = 'starfall_mine';
    const definition = getImprint(dungeonId);
    const bossNodeId = getBossDefinition(dungeonId).nodeId;
    const successfulOrder = ['mine_arrival', definition.requiredNodeId, 'rift_dust_reward', bossNodeId];
    const successfulSnapshot = [...successfulOrder];

    const successful = evaluateRunProtocolReward({
      dungeonId,
      protocolId: 'imprint',
      clearedNodeIds: successfulOrder,
      baseRewardPoints: 101
    });
    expect(successful).toEqual({
      bossDefeated: true,
      anchorCompletedBeforeBoss: true,
      completedAnchorCount: 1,
      requiredAnchorCount: 1,
      canGrantProtocolReward: true,
      rewardPoints: scaleRunProtocolRewardPoints(101, dungeonId, 'imprint'),
      imprint: definition.imprint
    });
    expect(successful.rewardPoints).toBeGreaterThan(101);
    expect(successfulOrder).toEqual(successfulSnapshot);

    const lateAnchor = evaluateRunProtocolReward({
      dungeonId,
      protocolId: 'imprint',
      clearedNodeIds: [bossNodeId, definition.requiredNodeId],
      baseRewardPoints: 101
    });
    expect(lateAnchor).toMatchObject({
      bossDefeated: true,
      anchorCompletedBeforeBoss: false,
      completedAnchorCount: 1,
      requiredAnchorCount: 1,
      canGrantProtocolReward: false,
      rewardPoints: 101
    });
    expect(lateAnchor.imprint).toBeUndefined();

    const noBoss = evaluateRunProtocolReward({
      dungeonId,
      protocolId: 'imprint',
      clearedNodeIds: [definition.requiredNodeId],
      baseRewardPoints: 101
    });
    expect(noBoss).toMatchObject({
      bossDefeated: false,
      anchorCompletedBeforeBoss: false,
      completedAnchorCount: 1,
      requiredAnchorCount: 1,
      canGrantProtocolReward: false
    });
  });

  it('grants each deep material reward only when both distinct anchors precede the boss', () => {
    for (const dungeonId of DUNGEON_ORDER) {
      const definition = getDeep(dungeonId);
      const bossNodeId = getBossDefinition(dungeonId).nodeId;
      const clearedNodeIds = [...definition.requiredNodeIds].reverse().concat(bossNodeId);
      const snapshot = [...clearedNodeIds];
      const successful = evaluateRunProtocolReward({
        dungeonId,
        protocolId: 'deep',
        clearedNodeIds,
        baseRewardPoints: 101
      });

      expect(successful).toEqual({
        bossDefeated: true,
        anchorCompletedBeforeBoss: true,
        completedAnchorCount: 2,
        requiredAnchorCount: 2,
        canGrantProtocolReward: true,
        rewardPoints: scaleRunProtocolRewardPoints(101, dungeonId, 'deep'),
        materialReward: { itemId: DEEP_EXPECTATIONS[dungeonId].itemId, amount: 2 }
      });
      expect(successful.rewardPoints).toBeGreaterThan(
        scaleRunProtocolRewardPoints(101, dungeonId, 'imprint')
      );
      expect(successful.imprint).toBeUndefined();
      expect(clearedNodeIds).toEqual(snapshot);
    }
  });

  it('rejects deep rewards when one anchor is missing or any anchor follows the boss', () => {
    for (const dungeonId of DUNGEON_ORDER) {
      const definition = getDeep(dungeonId);
      const [firstAnchor, secondAnchor] = definition.requiredNodeIds;
      const bossNodeId = getBossDefinition(dungeonId).nodeId;

      const missingAnchor = evaluateRunProtocolReward({
        dungeonId,
        protocolId: 'deep',
        clearedNodeIds: [firstAnchor, firstAnchor, bossNodeId],
        baseRewardPoints: 101
      });
      expect(missingAnchor).toMatchObject({
        bossDefeated: true,
        anchorCompletedBeforeBoss: false,
        completedAnchorCount: 1,
        requiredAnchorCount: 2,
        canGrantProtocolReward: false,
        rewardPoints: 101
      });
      expect(missingAnchor.materialReward).toBeUndefined();

      const lateAnchor = evaluateRunProtocolReward({
        dungeonId,
        protocolId: 'deep',
        clearedNodeIds: [firstAnchor, bossNodeId, secondAnchor],
        baseRewardPoints: 101
      });
      expect(lateAnchor).toMatchObject({
        bossDefeated: true,
        anchorCompletedBeforeBoss: false,
        completedAnchorCount: 2,
        requiredAnchorCount: 2,
        canGrantProtocolReward: false,
        rewardPoints: 101
      });
      expect(lateAnchor.materialReward).toBeUndefined();

      const bossFirst = evaluateRunProtocolReward({
        dungeonId,
        protocolId: 'deep',
        clearedNodeIds: [bossNodeId, firstAnchor, secondAnchor],
        baseRewardPoints: 101
      });
      expect(bossFirst).toMatchObject({
        bossDefeated: true,
        anchorCompletedBeforeBoss: false,
        completedAnchorCount: 2,
        requiredAnchorCount: 2,
        canGrantProtocolReward: false,
        rewardPoints: 101
      });
      expect(bossFirst.materialReward).toBeUndefined();
    }
  });

  it('keeps standard reward and scaling behavior unchanged', () => {
    const dungeonId: DungeonId = 'metro_abyss';
    const bossNodeId = getBossDefinition(dungeonId).nodeId;

    expect(scaleRunProtocolRewardPoints(37.5, dungeonId, 'standard')).toBe(37.5);
    expect(scaleRunProtocolRewardPoints(Number.NaN, dungeonId, 'imprint')).toBe(0);
    expect(evaluateRunProtocolReward({
      dungeonId,
      protocolId: 'standard',
      clearedNodeIds: [bossNodeId],
      baseRewardPoints: 37.5
    })).toEqual({
      bossDefeated: true,
      anchorCompletedBeforeBoss: true,
      completedAnchorCount: 0,
      requiredAnchorCount: 0,
      canGrantProtocolReward: false,
      rewardPoints: 37.5
    });
  });

  it('bounds malformed and overflowing deep scaling inputs', () => {
    const malformedRewards = [
      scaleRunProtocolRewardPoints(Number.NaN, 'void_citadel', 'deep'),
      scaleRunProtocolRewardPoints(Number.NEGATIVE_INFINITY, 'void_citadel', 'deep'),
      scaleRunProtocolRewardPoints(Number.POSITIVE_INFINITY, 'void_citadel', 'deep'),
      scaleRunProtocolRewardPoints(Number.MAX_VALUE, 'void_citadel', 'deep')
    ];

    for (const reward of malformedRewards) {
      expect(Number.isSafeInteger(reward)).toBe(true);
      expect(reward).toBeGreaterThanOrEqual(0);
      expect(reward).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
    }

    const definition = getDeep('void_citadel');
    const bossNodeId = getBossDefinition('void_citadel').nodeId;
    const evaluation = evaluateRunProtocolReward({
      dungeonId: 'void_citadel',
      protocolId: 'deep',
      clearedNodeIds: [...definition.requiredNodeIds, bossNodeId],
      baseRewardPoints: Number.MAX_VALUE
    });
    expect(Number.isSafeInteger(evaluation.rewardPoints)).toBe(true);
    expect(evaluation.rewardPoints).toBe(Number.MAX_SAFE_INTEGER);
  });
});
