import { describe, expect, it } from 'vitest';

import { DUNGEON_EQUIPMENT_POOLS, getDungeonLootOffer } from './dungeon-loot';
import { DUNGEONS } from './level-content';
import {
  EQUIPMENT_HUNT_DEFINITIONS,
  EQUIPMENT_HUNT_RULES_VERSION,
  createEquipmentHuntRunState,
  getEquipmentHuntDefinition,
  getEquipmentHuntProgress,
  getEquipmentHuntTargetIds,
  isEquipmentHuntRunState,
  markEquipmentHuntPortalCrossed,
  normalizeEquipmentHuntRunState,
  normalizePreparedEquipmentHunt
} from './equipment-hunts';

describe('equipment hunts', () => {
  it('defines one two-clue hunt for every dungeon', () => {
    expect(EQUIPMENT_HUNT_RULES_VERSION).toBe(1);
    expect(Object.keys(EQUIPMENT_HUNT_DEFINITIONS)).toHaveLength(19);
    expect(EQUIPMENT_HUNT_DEFINITIONS).toEqual({
      demon_tower_1: {
        id: 'equipment_hunt_demon_tower_1',
        dungeonId: 'demon_tower_1',
        clueNodeIds: ['broken_sigil_reward', 'fallen_pack_reward']
      },
      metro_abyss: {
        id: 'equipment_hunt_metro_abyss',
        dungeonId: 'metro_abyss',
        clueNodeIds: ['coin_turnstile', 'maintenance_ladder']
      },
      starfall_mine: {
        id: 'equipment_hunt_starfall_mine',
        dungeonId: 'starfall_mine',
        clueNodeIds: ['north_star_vein', 'lower_rail_reward']
      },
      rust_hospital: {
        id: 'equipment_hunt_rust_hospital',
        dungeonId: 'rust_hospital',
        clueNodeIds: ['isolation_chart_reward', 'morgue_reward']
      },
      ash_arena: {
        id: 'equipment_hunt_ash_arena',
        dungeonId: 'ash_arena',
        clueNodeIds: ['side_bench_supplies', 'ration_cache']
      },
      dream_archive: {
        id: 'equipment_hunt_dream_archive',
        dungeonId: 'dream_archive',
        clueNodeIds: ['method_fragment_reward', 'blank_shelf_reward']
      },
      void_citadel: {
        id: 'equipment_hunt_void_citadel',
        dungeonId: 'void_citadel',
        clueNodeIds: ['gate_oath_cache', 'rift_dust_cache']
      },
      temporal_observatory: {
        id: 'equipment_hunt_temporal_observatory',
        dungeonId: 'temporal_observatory',
        clueNodeIds: ['past_clue_cache', 'future_clue_cache']
      },
      causal_clearinghouse: {
        id: 'equipment_hunt_causal_clearinghouse',
        dungeonId: 'causal_clearinghouse',
        clueNodeIds: ['cause_clue_cache', 'effect_clue_cache']
      },
      entropy_ark: {
        id: 'equipment_hunt_entropy_ark',
        dungeonId: 'entropy_ark',
        clueNodeIds: ['port_clue_cache', 'starboard_clue_cache'],
        equipmentPool: ['entropy_compass', 'dissipation_mantle', 'ark_keel_boots'],
        eliteMonsterId: 'dissipation_navigator',
        soldOutRecoveryRewardPoints: 280
      },
      mirror_cycle_city: {
        id: 'equipment_hunt_mirror_cycle_city',
        dungeonId: 'mirror_cycle_city',
        clueNodeIds: ['real_clue_vault', 'mirror_clue_vault'],
        equipmentPool: ['parallax_visor', 'phaseweave_mantle', 'homecoming_prism'],
        eliteMonsterId: 'mirror_chorus',
        soldOutRecoveryRewardPoints: 300
      },
      redaction_scriptorium: {
        id: 'equipment_hunt_redaction_scriptorium',
        dungeonId: 'redaction_scriptorium',
        clueNodeIds: ['north_clue_cache', 'south_clue_cache'],
        equipmentPool: ['redline_edge', 'palimpsest_mantle', 'final_proof_seal'],
        eliteMonsterId: 'palimpsest_censor',
        soldOutRecoveryRewardPoints: 320
      },
      legacy_auction_court: {
        id: 'equipment_hunt_legacy_auction_court',
        dungeonId: 'legacy_auction_court',
        clueNodeIds: ['north_scrip_cache', 'south_scrip_cache'],
        equipmentPool: ['legacy_gavel', 'anonymous_veil', 'escrow_plate', 'final_lot_bell'],
        eliteMonsterId: 'inheritance_mimic',
        soldOutRecoveryRewardPoints: 360
      },
      genesis_vault: {
        id: 'equipment_hunt_genesis_vault',
        dungeonId: 'genesis_vault',
        clueNodeIds: ['north_serum_cache', 'south_serum_cache'],
        equipmentPool: ['helix_cleaver', 'symbiote_cowl', 'carapace_harness', 'rebirth_amulet'],
        eliteMonsterId: 'mutation_guardian',
        soldOutRecoveryRewardPoints: 400
      },
      silent_broadcast_tower: {
        id: 'equipment_hunt_silent_broadcast_tower',
        dungeonId: 'silent_broadcast_tower',
        clueNodeIds: ['north_signal_cache', 'south_signal_cache'],
        equipmentPool: ['hushblade', 'dead_air_headset', 'anechoic_mantle', 'last_channel_beacon'],
        eliteMonsterId: 'broadcast_warden',
        soldOutRecoveryRewardPoints: 400
      },
      lost_shelter: {
        id: 'equipment_hunt_lost_shelter',
        dungeonId: 'lost_shelter',
        clueNodeIds: ['north_supply_cache', 'south_supply_cache'],
        equipmentPool: ['rescue_carbine', 'triage_visor', 'evacuation_plate', 'blackbox_beacon'],
        eliteMonsterId: 'shelter_enforcer',
        soldOutRecoveryRewardPoints: 440
      },
      false_testimony_court: {
        id: 'equipment_hunt_false_testimony',
        dungeonId: 'false_testimony_court',
        clueNodeIds: ['records_stacks', 'evidence_supply_cache'],
        equipmentPool: ['cross_examiner_sabre', 'forensic_visor', 'custody_shell', 'appeal_seal'],
        eliteMonsterId: 'archive_censor',
        soldOutRecoveryRewardPoints: 480
      },
      combat_replay_stage: {
        id: 'equipment_hunt_combat_replay_stage',
        dungeonId: 'combat_replay_stage',
        clueNodeIds: ['script_stacks', 'film_supply_cache'],
        equipmentPool: ['frame_engraver', 'cue_visor', 'buffer_plate', 'thaw_metronome'],
        eliteMonsterId: 'continuity_editor',
        soldOutRecoveryRewardPoints: 520
      },
      panopticon_city: {
        id: 'equipment_hunt_panopticon_city',
        dungeonId: 'panopticon_city',
        clueNodeIds: ['watchglass_cache', 'matte_supply'],
        equipmentPool: ['blindline_cutter', 'predictive_visor', 'matte_shell', 'inverse_prism'],
        eliteMonsterId: 'blindspot_auditor',
        soldOutRecoveryRewardPoints: 560
      }
    });
    expect(getEquipmentHuntDefinition('dream_archive')).toBe(
      EQUIPMENT_HUNT_DEFINITIONS.dream_archive
    );
    expect(getEquipmentHuntDefinition('temporal_observatory')).toBe(
      EQUIPMENT_HUNT_DEFINITIONS.temporal_observatory
    );
    expect(getEquipmentHuntDefinition('causal_clearinghouse')).toBe(
      EQUIPMENT_HUNT_DEFINITIONS.causal_clearinghouse
    );
    expect(getEquipmentHuntDefinition('entropy_ark')).toBe(
      EQUIPMENT_HUNT_DEFINITIONS.entropy_ark
    );
    expect(getEquipmentHuntDefinition('mirror_cycle_city')).toBe(
      EQUIPMENT_HUNT_DEFINITIONS.mirror_cycle_city
    );
    expect(getEquipmentHuntDefinition('redaction_scriptorium')).toBe(
      EQUIPMENT_HUNT_DEFINITIONS.redaction_scriptorium
    );
    expect(getEquipmentHuntDefinition('legacy_auction_court')).toBe(
      EQUIPMENT_HUNT_DEFINITIONS.legacy_auction_court
    );
    expect(getEquipmentHuntDefinition('genesis_vault')).toBe(
      EQUIPMENT_HUNT_DEFINITIONS.genesis_vault
    );
    expect(getEquipmentHuntDefinition('silent_broadcast_tower')).toBe(
      EQUIPMENT_HUNT_DEFINITIONS.silent_broadcast_tower
    );
    expect(getEquipmentHuntDefinition('lost_shelter')).toBe(
      EQUIPMENT_HUNT_DEFINITIONS.lost_shelter
    );
    expect(getEquipmentHuntDefinition('false_testimony_court')).toBe(
      EQUIPMENT_HUNT_DEFINITIONS.false_testimony_court
    );
    expect(getEquipmentHuntDefinition('combat_replay_stage')).toBe(
      EQUIPMENT_HUNT_DEFINITIONS.combat_replay_stage
    );
    expect(getEquipmentHuntDefinition('panopticon_city')).toBe(
      EQUIPMENT_HUNT_DEFINITIONS.panopticon_city
    );
  });

  it('binds exactly thirty-eight unique reward hosts across the nineteen hunts', () => {
    const hosts = Object.values(DUNGEONS).flatMap((dungeon) => {
      return dungeon.nodes
        .filter((node) => node.equipmentHuntClueId !== undefined)
        .map((node) => `${dungeon.id}:${node.id}`);
    });

    expect(hosts).toHaveLength(38);
    expect(new Set(hosts).size).toBe(38);
    for (const [dungeonId, definition] of Object.entries(EQUIPMENT_HUNT_DEFINITIONS)) {
      const dungeon = DUNGEONS[dungeonId as keyof typeof DUNGEONS];
      const chapterHosts = dungeon.nodes.filter(
        (node) => node.equipmentHuntClueId === definition.id
      );
      expect(chapterHosts.map(({ id }) => id)).toEqual(
        expect.arrayContaining([...definition.clueNodeIds])
      );
      expect(chapterHosts).toHaveLength(2);
      expect(chapterHosts.every(({ type, reward }) => type === 'reward' && reward !== undefined)).toBe(true);
    }
  });

  it('returns only unowned targets from the current dungeon pool', () => {
    expect(getEquipmentHuntTargetIds('demon_tower_1', ['bone_spear', 'spirit_robe'])).toEqual([
      'armor_piercing_sword',
      'mist_hood'
    ]);
    expect(getEquipmentHuntTargetIds('void_citadel', ['training_blade'])).toEqual([
      'starforged_edge',
      'guardian_plate',
      'rift_belt',
      'cloudstep_charm',
      'void_lantern'
    ]);

    const temporalTargets = getEquipmentHuntTargetIds('temporal_observatory', []);
    expect(temporalTargets).toEqual([...DUNGEON_EQUIPMENT_POOLS.temporal_observatory]);
    expect(temporalTargets).toEqual(
      expect.arrayContaining(['chronal_edge', 'chronal_aegis', 'chronal_lens'])
    );
    expect(getEquipmentHuntTargetIds('temporal_observatory', ['chronal_edge'])).toEqual(
      DUNGEON_EQUIPMENT_POOLS.temporal_observatory.filter(
        (equipmentId) => equipmentId !== 'chronal_edge'
      )
    );
    expect(getEquipmentHuntTargetIds('panopticon_city', ['blindline_cutter', 'matte_shell'])).toEqual([
      'predictive_visor',
      'inverse_prism'
    ]);
  });

  it('strictly normalizes prepared hunts and run snapshots', () => {
    const prepared = {
      dungeonId: 'demon_tower_1',
      targetEquipmentId: 'mist_hood'
    } as const;
    const normalizedPrepared = normalizePreparedEquipmentHunt(prepared);
    expect(normalizedPrepared).toEqual(prepared);
    expect(normalizedPrepared).not.toBe(prepared);
    expect(() => normalizePreparedEquipmentHunt({ ...prepared, extra: true })).toThrow(TypeError);
    expect(() =>
      normalizePreparedEquipmentHunt({ ...prepared, targetEquipmentId: 'void_lantern' })
    ).toThrow(TypeError);

    const snapshot = {
      rulesVersion: 1,
      dungeonId: 'demon_tower_1',
      targetEquipmentId: 'mist_hood',
      clueNodeIds: ['broken_sigil_reward', 'fallen_pack_reward'],
      crossedDungeonPortal: false
    };
    const normalizedSnapshot = normalizeEquipmentHuntRunState(snapshot);
    expect(normalizedSnapshot).toEqual(snapshot);
    expect(normalizedSnapshot).not.toBe(snapshot);
    expect(normalizedSnapshot.clueNodeIds).not.toBe(snapshot.clueNodeIds);
    expect(isEquipmentHuntRunState(normalizedSnapshot)).toBe(true);

    const malformedStates = [
      { ...snapshot, rulesVersion: 2 },
      { ...snapshot, targetEquipmentId: 'void_lantern' },
      { ...snapshot, clueNodeIds: ['fallen_pack_reward', 'broken_sigil_reward'] },
      { ...snapshot, crossedDungeonPortal: 0 },
      { ...snapshot, extra: true }
    ];
    for (const malformed of malformedStates) {
      expect(() => normalizeEquipmentHuntRunState(malformed)).toThrow(TypeError);
      expect(isEquipmentHuntRunState(malformed)).toBe(false);
    }
  });

  it('freezes a valid prepared target and rejects owned or wrong-dungeon targets', () => {
    const prepared = {
      dungeonId: 'demon_tower_1',
      targetEquipmentId: 'mist_hood'
    } as const;
    expect(createEquipmentHuntRunState(prepared, 'demon_tower_1', [])).toEqual({
      rulesVersion: 1,
      dungeonId: 'demon_tower_1',
      targetEquipmentId: 'mist_hood',
      clueNodeIds: ['broken_sigil_reward', 'fallen_pack_reward'],
      crossedDungeonPortal: false
    });
    expect(() => createEquipmentHuntRunState(prepared, 'metro_abyss', [])).toThrow(TypeError);
    expect(() => createEquipmentHuntRunState(prepared, 'demon_tower_1', ['mist_hood'])).toThrow(
      TypeError
    );
    expect(createEquipmentHuntRunState(undefined, 'demon_tower_1', [])).toBeUndefined();
  });

  it('qualifies from either clue but not from unrelated nodes or another dungeon', () => {
    const snapshot = createEquipmentHuntRunState(
      { dungeonId: 'demon_tower_1', targetEquipmentId: 'mist_hood' },
      'demon_tower_1',
      []
    );

    for (const clueNodeId of snapshot.clueNodeIds) {
      expect(getEquipmentHuntProgress(snapshot, 'demon_tower_1', [clueNodeId], 0)).toEqual({
        targetEquipmentId: 'mist_hood',
        clearedClueNodeIds: [clueNodeId],
        qualifiedByNodeId: clueNodeId,
        qualified: true,
        crossedDungeonPortal: false
      });
    }
    expect(getEquipmentHuntProgress(snapshot, 'demon_tower_1', ['unrelated_reward'], 0)).toEqual({
      targetEquipmentId: 'mist_hood',
      clearedClueNodeIds: [],
      qualified: false,
      crossedDungeonPortal: false
    });
    expect(
      getEquipmentHuntProgress(snapshot, 'metro_abyss', ['broken_sigil_reward'], 0)
    ).toMatchObject({ qualified: false });
  });

  it('does not qualify after an offer or after crossing a dungeon portal', () => {
    const snapshot = createEquipmentHuntRunState(
      { dungeonId: 'demon_tower_1', targetEquipmentId: 'mist_hood' },
      'demon_tower_1',
      []
    );
    expect(
      getEquipmentHuntProgress(snapshot, 'demon_tower_1', ['broken_sigil_reward'], 1)
    ).toEqual({
      targetEquipmentId: 'mist_hood',
      clearedClueNodeIds: ['broken_sigil_reward'],
      qualified: false,
      crossedDungeonPortal: false
    });

    const crossed = markEquipmentHuntPortalCrossed(snapshot);
    expect(crossed.crossedDungeonPortal).toBe(true);
    expect(markEquipmentHuntPortalCrossed(crossed)).toBe(crossed);
    expect(
      getEquipmentHuntProgress(crossed, 'demon_tower_1', ['broken_sigil_reward'], 0)
    ).toEqual({
      targetEquipmentId: 'mist_hood',
      clearedClueNodeIds: ['broken_sigil_reward'],
      qualified: false,
      crossedDungeonPortal: true
    });
  });

  it('qualifies the temporal hunt from either calibration cache', () => {
    const snapshot = createEquipmentHuntRunState(
      { dungeonId: 'temporal_observatory', targetEquipmentId: 'chronal_edge' },
      'temporal_observatory',
      []
    );

    expect(snapshot.clueNodeIds).toEqual(['past_clue_cache', 'future_clue_cache']);
    for (const clueNodeId of snapshot.clueNodeIds) {
      expect(
        getEquipmentHuntProgress(snapshot, 'temporal_observatory', [clueNodeId], 0)
      ).toMatchObject({
        targetEquipmentId: 'chronal_edge',
        clearedClueNodeIds: [clueNodeId],
        qualifiedByNodeId: clueNodeId,
        qualified: true
      });
    }
  });

  it('qualifies a clearinghouse Tier-9 target from either causal clue cache', () => {
    const snapshot = createEquipmentHuntRunState(
      { dungeonId: 'causal_clearinghouse', targetEquipmentId: 'causal_visor' },
      'causal_clearinghouse',
      []
    );

    expect(getEquipmentHuntTargetIds('causal_clearinghouse', [])).toEqual([
      'causal_visor',
      'echo_breaker_gauntlets',
      'return_anchor_belt'
    ]);
    expect(snapshot.clueNodeIds).toEqual(['cause_clue_cache', 'effect_clue_cache']);
    for (const clueNodeId of snapshot.clueNodeIds) {
      expect(
        getEquipmentHuntProgress(snapshot, 'causal_clearinghouse', [clueNodeId], 0)
      ).toMatchObject({
        targetEquipmentId: 'causal_visor',
        clearedClueNodeIds: [clueNodeId],
        qualifiedByNodeId: clueNodeId,
        qualified: true
      });
    }
  });

  it('qualifies the entropy hunt with the fixed clues, pool, elite, and sold-out recovery', () => {
    const definition = getEquipmentHuntDefinition('entropy_ark');
    const snapshot = createEquipmentHuntRunState(
      { dungeonId: 'entropy_ark', targetEquipmentId: 'entropy_compass' },
      'entropy_ark',
      []
    );

    expect(definition).toEqual({
      id: 'equipment_hunt_entropy_ark',
      dungeonId: 'entropy_ark',
      clueNodeIds: ['port_clue_cache', 'starboard_clue_cache'],
      equipmentPool: ['entropy_compass', 'dissipation_mantle', 'ark_keel_boots'],
      eliteMonsterId: 'dissipation_navigator',
      soldOutRecoveryRewardPoints: 280
    });
    expect(getEquipmentHuntTargetIds('entropy_ark', [])).toEqual(definition.equipmentPool);
    expect(snapshot.clueNodeIds).toEqual(definition.clueNodeIds);
    for (const clueNodeId of snapshot.clueNodeIds) {
      expect(getEquipmentHuntProgress(snapshot, 'entropy_ark', [clueNodeId], 0)).toMatchObject({
        targetEquipmentId: 'entropy_compass',
        qualifiedByNodeId: clueNodeId,
        qualified: true
      });
    }
  });

  it('qualifies the mirror city hunt with its locked clues, pool, elite, and recovery', () => {
    const definition = getEquipmentHuntDefinition('mirror_cycle_city');
    const snapshot = createEquipmentHuntRunState(
      { dungeonId: 'mirror_cycle_city', targetEquipmentId: 'parallax_visor' },
      'mirror_cycle_city',
      []
    );

    expect(definition).toEqual({
      id: 'equipment_hunt_mirror_cycle_city',
      dungeonId: 'mirror_cycle_city',
      clueNodeIds: ['real_clue_vault', 'mirror_clue_vault'],
      equipmentPool: ['parallax_visor', 'phaseweave_mantle', 'homecoming_prism'],
      eliteMonsterId: 'mirror_chorus',
      soldOutRecoveryRewardPoints: 300
    });
    expect(getEquipmentHuntTargetIds('mirror_cycle_city', [])).toEqual(definition.equipmentPool);
    expect(getEquipmentHuntTargetIds('mirror_cycle_city', ['parallax_visor'])).toEqual([
      'phaseweave_mantle',
      'homecoming_prism'
    ]);
    for (const clueNodeId of snapshot.clueNodeIds) {
      expect(getEquipmentHuntProgress(snapshot, 'mirror_cycle_city', [clueNodeId], 0)).toMatchObject({
        targetEquipmentId: 'parallax_visor',
        qualifiedByNodeId: clueNodeId,
        qualified: true
      });
    }
    expect(() => normalizePreparedEquipmentHunt({
      dungeonId: 'mirror_cycle_city',
      targetEquipmentId: 'entropy_compass'
    })).toThrow(TypeError);
  });

  it('qualifies the redaction hunt with its locked clues, pool, elite, and recovery', () => {
    const definition = getEquipmentHuntDefinition('redaction_scriptorium');
    const snapshot = createEquipmentHuntRunState(
      { dungeonId: 'redaction_scriptorium', targetEquipmentId: 'redline_edge' },
      'redaction_scriptorium',
      []
    );

    expect(definition).toEqual({
      id: 'equipment_hunt_redaction_scriptorium',
      dungeonId: 'redaction_scriptorium',
      clueNodeIds: ['north_clue_cache', 'south_clue_cache'],
      equipmentPool: ['redline_edge', 'palimpsest_mantle', 'final_proof_seal'],
      eliteMonsterId: 'palimpsest_censor',
      soldOutRecoveryRewardPoints: 320
    });
    expect(getEquipmentHuntTargetIds('redaction_scriptorium', [])).toEqual(definition.equipmentPool);
    expect(getEquipmentHuntTargetIds('redaction_scriptorium', ['redline_edge'])).toEqual([
      'palimpsest_mantle',
      'final_proof_seal'
    ]);
    for (const clueNodeId of snapshot.clueNodeIds) {
      expect(getEquipmentHuntProgress(
        snapshot,
        'redaction_scriptorium',
        [clueNodeId],
        0
      )).toMatchObject({
        targetEquipmentId: 'redline_edge',
        qualifiedByNodeId: clueNodeId,
        qualified: true
      });
    }
    expect(() => normalizePreparedEquipmentHunt({
      dungeonId: 'redaction_scriptorium',
      targetEquipmentId: 'homecoming_prism'
    })).toThrow(TypeError);
  });

  it('qualifies the legacy auction hunt with its locked clues, pool, elite, and recovery', () => {
    const definition = getEquipmentHuntDefinition('legacy_auction_court');
    const snapshot = createEquipmentHuntRunState(
      { dungeonId: 'legacy_auction_court', targetEquipmentId: 'legacy_gavel' },
      'legacy_auction_court',
      []
    );

    expect(definition).toEqual({
      id: 'equipment_hunt_legacy_auction_court',
      dungeonId: 'legacy_auction_court',
      clueNodeIds: ['north_scrip_cache', 'south_scrip_cache'],
      equipmentPool: ['legacy_gavel', 'anonymous_veil', 'escrow_plate', 'final_lot_bell'],
      eliteMonsterId: 'inheritance_mimic',
      soldOutRecoveryRewardPoints: 360
    });
    expect(getEquipmentHuntTargetIds('legacy_auction_court', [])).toEqual(definition.equipmentPool);
    expect(getEquipmentHuntTargetIds('legacy_auction_court', ['legacy_gavel'])).toEqual([
      'anonymous_veil',
      'escrow_plate',
      'final_lot_bell'
    ]);
    for (const clueNodeId of snapshot.clueNodeIds) {
      expect(getEquipmentHuntProgress(
        snapshot,
        'legacy_auction_court',
        [clueNodeId],
        0
      )).toMatchObject({
        targetEquipmentId: 'legacy_gavel',
        qualifiedByNodeId: clueNodeId,
        qualified: true
      });
    }
    expect(() => normalizePreparedEquipmentHunt({
      dungeonId: 'legacy_auction_court',
      targetEquipmentId: 'final_proof_seal'
    })).toThrow(TypeError);
  });

  it('freezes and qualifies the genesis vault hunt with either serum clue', () => {
    const definition = getEquipmentHuntDefinition('genesis_vault');
    const prepared = normalizePreparedEquipmentHunt({
      dungeonId: 'genesis_vault',
      targetEquipmentId: 'helix_cleaver'
    });
    const snapshot = createEquipmentHuntRunState(prepared, 'genesis_vault', []);

    expect(definition).toEqual({
      id: 'equipment_hunt_genesis_vault',
      dungeonId: 'genesis_vault',
      clueNodeIds: ['north_serum_cache', 'south_serum_cache'],
      equipmentPool: ['helix_cleaver', 'symbiote_cowl', 'carapace_harness', 'rebirth_amulet'],
      eliteMonsterId: 'mutation_guardian',
      soldOutRecoveryRewardPoints: 400
    });
    expect(getEquipmentHuntTargetIds('genesis_vault', [])).toEqual(definition.equipmentPool);
    expect(getEquipmentHuntTargetIds('genesis_vault', ['helix_cleaver'])).toEqual([
      'symbiote_cowl',
      'carapace_harness',
      'rebirth_amulet'
    ]);

    for (const clueNodeId of snapshot.clueNodeIds) {
      expect(getEquipmentHuntProgress(snapshot, 'genesis_vault', [clueNodeId], 0)).toEqual({
        targetEquipmentId: 'helix_cleaver',
        clearedClueNodeIds: [clueNodeId],
        qualifiedByNodeId: clueNodeId,
        qualified: true,
        crossedDungeonPortal: false
      });
    }
    expect(getEquipmentHuntProgress(snapshot, 'genesis_vault', [], 0).qualified).toBe(false);
    expect(getEquipmentHuntProgress(snapshot, 'genesis_vault', snapshot.clueNodeIds, 1).qualified).toBe(false);

    const crossed = markEquipmentHuntPortalCrossed(snapshot);
    expect(getEquipmentHuntProgress(crossed, 'genesis_vault', snapshot.clueNodeIds, 0).qualified).toBe(false);
    expect(() => createEquipmentHuntRunState(prepared, 'genesis_vault', ['helix_cleaver'])).toThrow(TypeError);
    expect(() => normalizePreparedEquipmentHunt({
      dungeonId: 'genesis_vault',
      targetEquipmentId: 'legacy_gavel'
    })).toThrow(TypeError);
  });

  it('rejects illegal and pre-rules genesis hunt snapshots', () => {
    const snapshot = createEquipmentHuntRunState(
      { dungeonId: 'genesis_vault', targetEquipmentId: 'rebirth_amulet' },
      'genesis_vault',
      []
    );

    for (const stale of [
      { ...snapshot, rulesVersion: 0 },
      { ...snapshot, clueNodeIds: ['south_serum_cache', 'north_serum_cache'] },
      { ...snapshot, targetEquipmentId: 'final_lot_bell' },
      { ...snapshot, crossedDungeonPortal: 'false' },
      { ...snapshot, legacyQualified: true }
    ]) {
      expect(() => normalizeEquipmentHuntRunState(stale)).toThrow(TypeError);
      expect(isEquipmentHuntRunState(stale)).toBe(false);
    }
  });

  it('freezes the silent tower target, qualifies from either clue, and gates its guarantee', () => {
    const definition = getEquipmentHuntDefinition('silent_broadcast_tower');
    const prepared = normalizePreparedEquipmentHunt({
      dungeonId: 'silent_broadcast_tower',
      targetEquipmentId: 'hushblade'
    });
    const snapshot = createEquipmentHuntRunState(prepared, 'silent_broadcast_tower', []);
    const lootInput = {
      dungeonId: 'silent_broadcast_tower' as const,
      monsterId: 'broadcast_warden' as const,
      nodeId: 'broadcast_warden_alpha',
      ownedEquipmentIds: [],
      carriedEquipmentIds: [],
      offersMade: 0
    };

    expect(definition).toEqual({
      id: 'equipment_hunt_silent_broadcast_tower',
      dungeonId: 'silent_broadcast_tower',
      clueNodeIds: ['north_signal_cache', 'south_signal_cache'],
      equipmentPool: ['hushblade', 'dead_air_headset', 'anechoic_mantle', 'last_channel_beacon'],
      eliteMonsterId: 'broadcast_warden',
      soldOutRecoveryRewardPoints: 400
    });
    expect(getEquipmentHuntTargetIds('silent_broadcast_tower', [])).toEqual(definition.equipmentPool);
    expect(getEquipmentHuntTargetIds('silent_broadcast_tower', ['hushblade'])).toEqual([
      'dead_air_headset',
      'anechoic_mantle',
      'last_channel_beacon'
    ]);

    const beforeClue = getEquipmentHuntProgress(snapshot, 'silent_broadcast_tower', [], 0);
    expect(beforeClue.qualified).toBe(false);
    expect(getDungeonLootOffer({
      ...lootInput,
      guaranteedEquipmentId: beforeClue.qualified ? snapshot.targetEquipmentId : undefined
    })).not.toHaveProperty('guaranteedEquipmentId');

    for (const clueNodeId of snapshot.clueNodeIds) {
      const progress = getEquipmentHuntProgress(snapshot, 'silent_broadcast_tower', [clueNodeId], 0);
      expect(progress).toMatchObject({
        targetEquipmentId: 'hushblade',
        qualifiedByNodeId: clueNodeId,
        qualified: true
      });
      const offer = getDungeonLootOffer({
        ...lootInput,
        guaranteedEquipmentId: progress.qualified ? snapshot.targetEquipmentId : undefined
      });
      expect(offer).toHaveProperty('equipmentIds');
      if (offer && 'equipmentIds' in offer) {
        expect(offer.equipmentIds[0]).toBe('hushblade');
        expect(offer.guaranteedEquipmentId).toBe('hushblade');
      }
    }

    expect(getDungeonLootOffer({
      ...lootInput,
      ownedEquipmentIds: [...DUNGEON_EQUIPMENT_POOLS.silent_broadcast_tower],
      guaranteedEquipmentId: snapshot.targetEquipmentId
    })).toEqual({
      offerId: 'dungeon-loot:silent_broadcast_tower:broadcast_warden_alpha',
      salvageRewardPoints: 440
    });
  });

  it('rejects illegal and old silent tower hunt snapshots', () => {
    const snapshot = createEquipmentHuntRunState(
      { dungeonId: 'silent_broadcast_tower', targetEquipmentId: 'last_channel_beacon' },
      'silent_broadcast_tower',
      []
    );

    for (const stale of [
      { ...snapshot, rulesVersion: 0 },
      { ...snapshot, dungeonId: 'genesis_vault' },
      { ...snapshot, targetEquipmentId: 'rebirth_amulet' },
      { ...snapshot, clueNodeIds: ['south_signal_cache', 'north_signal_cache'] },
      { ...snapshot, crossedDungeonPortal: 0 },
      { ...snapshot, legacyQualified: true }
    ]) {
      expect(() => normalizeEquipmentHuntRunState(stale)).toThrow(TypeError);
      expect(isEquipmentHuntRunState(stale)).toBe(false);
    }
  });

  it('freezes the lost shelter target order, guarantees from either clue, and recovers sold-out hunts', () => {
    const definition = getEquipmentHuntDefinition('lost_shelter');
    const prepared = normalizePreparedEquipmentHunt({
      dungeonId: 'lost_shelter',
      targetEquipmentId: 'rescue_carbine'
    });
    const snapshot = createEquipmentHuntRunState(prepared, 'lost_shelter', []);
    const lootInput = {
      dungeonId: 'lost_shelter' as const,
      monsterId: 'shelter_enforcer' as const,
      nodeId: 'shelter_enforcer_alpha',
      ownedEquipmentIds: [],
      carriedEquipmentIds: [],
      offersMade: 0
    };

    expect(definition).toEqual({
      id: 'equipment_hunt_lost_shelter',
      dungeonId: 'lost_shelter',
      clueNodeIds: ['north_supply_cache', 'south_supply_cache'],
      equipmentPool: ['rescue_carbine', 'triage_visor', 'evacuation_plate', 'blackbox_beacon'],
      eliteMonsterId: 'shelter_enforcer',
      soldOutRecoveryRewardPoints: 440
    });
    expect(getEquipmentHuntTargetIds('lost_shelter', [])).toEqual(definition.equipmentPool);
    expect(getEquipmentHuntTargetIds('lost_shelter', ['rescue_carbine'])).toEqual([
      'triage_visor',
      'evacuation_plate',
      'blackbox_beacon'
    ]);

    expect(getEquipmentHuntProgress(snapshot, 'lost_shelter', [], 0).qualified).toBe(false);
    for (const clueNodeId of snapshot.clueNodeIds) {
      const progress = getEquipmentHuntProgress(snapshot, 'lost_shelter', [clueNodeId], 0);
      expect(progress).toMatchObject({
        targetEquipmentId: 'rescue_carbine',
        qualifiedByNodeId: clueNodeId,
        qualified: true
      });
      const offer = getDungeonLootOffer({
        ...lootInput,
        guaranteedEquipmentId: progress.qualified ? snapshot.targetEquipmentId : undefined
      });
      expect(offer).toHaveProperty('equipmentIds');
      if (offer && 'equipmentIds' in offer) {
        expect(offer.equipmentIds[0]).toBe('rescue_carbine');
        expect(offer.guaranteedEquipmentId).toBe('rescue_carbine');
      }
    }

    const crossed = markEquipmentHuntPortalCrossed(snapshot);
    expect(getEquipmentHuntProgress(crossed, 'lost_shelter', ['north_supply_cache'], 0)).toMatchObject({
      qualified: false,
      crossedDungeonPortal: true
    });
    expect(getDungeonLootOffer({
      ...lootInput,
      ownedEquipmentIds: [...DUNGEON_EQUIPMENT_POOLS.lost_shelter],
      guaranteedEquipmentId: snapshot.targetEquipmentId
    })).toEqual({
      offerId: 'dungeon-loot:lost_shelter:shelter_enforcer_alpha',
      salvageRewardPoints: 480
    });
  });

  it('rejects illegal and old lost shelter hunt snapshots', () => {
    const snapshot = createEquipmentHuntRunState(
      { dungeonId: 'lost_shelter', targetEquipmentId: 'blackbox_beacon' },
      'lost_shelter',
      []
    );

    for (const stale of [
      { ...snapshot, rulesVersion: 0 },
      { ...snapshot, dungeonId: 'silent_broadcast_tower' },
      { ...snapshot, targetEquipmentId: 'last_channel_beacon' },
      { ...snapshot, clueNodeIds: ['south_supply_cache', 'north_supply_cache'] },
      { ...snapshot, crossedDungeonPortal: 0 },
      { ...snapshot, legacyQualified: true }
    ]) {
      expect(() => normalizeEquipmentHuntRunState(stale)).toThrow(TypeError);
      expect(isEquipmentHuntRunState(stale)).toBe(false);
    }
  });

  it('freezes the false-testimony order, guarantees from either clue, and recovers sold-out hunts', () => {
    const definition = getEquipmentHuntDefinition('false_testimony_court');
    const prepared = normalizePreparedEquipmentHunt({
      dungeonId: 'false_testimony_court',
      targetEquipmentId: 'cross_examiner_sabre'
    });
    const snapshot = createEquipmentHuntRunState(prepared, 'false_testimony_court', []);
    const lootInput = {
      dungeonId: 'false_testimony_court' as const,
      monsterId: 'archive_censor' as const,
      nodeId: 'archive_censor_alpha',
      ownedEquipmentIds: [],
      carriedEquipmentIds: [],
      offersMade: 0
    };

    expect(definition).toEqual({
      id: 'equipment_hunt_false_testimony',
      dungeonId: 'false_testimony_court',
      clueNodeIds: ['records_stacks', 'evidence_supply_cache'],
      equipmentPool: ['cross_examiner_sabre', 'forensic_visor', 'custody_shell', 'appeal_seal'],
      eliteMonsterId: 'archive_censor',
      soldOutRecoveryRewardPoints: 480
    });
    expect(Object.isFrozen(definition)).toBe(true);
    expect(Object.isFrozen(definition.clueNodeIds)).toBe(true);
    expect(Object.isFrozen(definition.equipmentPool)).toBe(true);
    expect(getEquipmentHuntTargetIds('false_testimony_court', [])).toEqual(definition.equipmentPool);
    expect(getEquipmentHuntTargetIds('false_testimony_court', ['cross_examiner_sabre'])).toEqual([
      'forensic_visor',
      'custody_shell',
      'appeal_seal'
    ]);

    for (const clueNodeId of snapshot.clueNodeIds) {
      const progress = getEquipmentHuntProgress(snapshot, 'false_testimony_court', [clueNodeId], 0);
      expect(progress).toMatchObject({
        targetEquipmentId: 'cross_examiner_sabre',
        qualifiedByNodeId: clueNodeId,
        qualified: true
      });
      const offer = getDungeonLootOffer({
        ...lootInput,
        guaranteedEquipmentId: progress.qualified ? snapshot.targetEquipmentId : undefined
      });
      expect(offer).toHaveProperty('equipmentIds');
      if (offer && 'equipmentIds' in offer) {
        expect(offer.equipmentIds[0]).toBe('cross_examiner_sabre');
        expect(offer.guaranteedEquipmentId).toBe('cross_examiner_sabre');
      }
    }

    const crossed = markEquipmentHuntPortalCrossed(snapshot);
    expect(getEquipmentHuntProgress(crossed, 'false_testimony_court', ['records_stacks'], 0)).toMatchObject({
      qualified: false,
      crossedDungeonPortal: true
    });
    expect(getDungeonLootOffer({
      ...lootInput,
      ownedEquipmentIds: [...DUNGEON_EQUIPMENT_POOLS.false_testimony_court],
      guaranteedEquipmentId: snapshot.targetEquipmentId
    })).toEqual({
      offerId: 'dungeon-loot:false_testimony_court:archive_censor_alpha',
      salvageRewardPoints: 520
    });
  });

  it('rejects illegal and old false-testimony hunt snapshots', () => {
    const snapshot = createEquipmentHuntRunState(
      { dungeonId: 'false_testimony_court', targetEquipmentId: 'appeal_seal' },
      'false_testimony_court',
      []
    );

    for (const stale of [
      { ...snapshot, rulesVersion: 0 },
      { ...snapshot, dungeonId: 'lost_shelter' },
      { ...snapshot, targetEquipmentId: 'blackbox_beacon' },
      { ...snapshot, clueNodeIds: ['evidence_supply_cache', 'records_stacks'] },
      { ...snapshot, crossedDungeonPortal: 0 },
      { ...snapshot, legacyQualified: true }
    ]) {
      expect(() => normalizeEquipmentHuntRunState(stale)).toThrow(TypeError);
      expect(isEquipmentHuntRunState(stale)).toBe(false);
    }
  });

  it('freezes the combat-replay order, qualifies from either clue, and recovers sold-out hunts', () => {
    const definition = getEquipmentHuntDefinition('combat_replay_stage');
    const prepared = normalizePreparedEquipmentHunt({
      dungeonId: 'combat_replay_stage',
      targetEquipmentId: 'frame_engraver'
    });
    const snapshot = createEquipmentHuntRunState(prepared, 'combat_replay_stage', []);
    const lootInput = {
      dungeonId: 'combat_replay_stage' as const,
      monsterId: 'continuity_editor' as const,
      nodeId: 'continuity_editor_alpha',
      ownedEquipmentIds: [],
      carriedEquipmentIds: [],
      offersMade: 0
    };

    expect(definition).toEqual({
      id: 'equipment_hunt_combat_replay_stage',
      dungeonId: 'combat_replay_stage',
      clueNodeIds: ['script_stacks', 'film_supply_cache'],
      equipmentPool: ['frame_engraver', 'cue_visor', 'buffer_plate', 'thaw_metronome'],
      eliteMonsterId: 'continuity_editor',
      soldOutRecoveryRewardPoints: 520
    });
    expect(Object.isFrozen(definition)).toBe(true);
    expect(Object.isFrozen(definition.clueNodeIds)).toBe(true);
    expect(Object.isFrozen(definition.equipmentPool)).toBe(true);
    expect(getEquipmentHuntTargetIds('combat_replay_stage', [])).toEqual(definition.equipmentPool);
    expect(getEquipmentHuntTargetIds('combat_replay_stage', ['frame_engraver'])).toEqual([
      'cue_visor',
      'buffer_plate',
      'thaw_metronome'
    ]);

    for (const clueNodeId of snapshot.clueNodeIds) {
      const progress = getEquipmentHuntProgress(snapshot, 'combat_replay_stage', [clueNodeId], 0);
      expect(progress).toMatchObject({
        targetEquipmentId: 'frame_engraver',
        qualifiedByNodeId: clueNodeId,
        qualified: true
      });
      const offer = getDungeonLootOffer({
        ...lootInput,
        guaranteedEquipmentId: progress.qualified ? snapshot.targetEquipmentId : undefined
      });
      expect(offer).toHaveProperty('equipmentIds');
      if (offer && 'equipmentIds' in offer) {
        expect(offer.equipmentIds[0]).toBe('frame_engraver');
        expect(offer.guaranteedEquipmentId).toBe('frame_engraver');
      }
    }

    const crossed = markEquipmentHuntPortalCrossed(snapshot);
    expect(getEquipmentHuntProgress(crossed, 'combat_replay_stage', ['script_stacks'], 0)).toMatchObject({
      qualified: false,
      crossedDungeonPortal: true
    });
    expect(getDungeonLootOffer({
      ...lootInput,
      ownedEquipmentIds: [...DUNGEON_EQUIPMENT_POOLS.combat_replay_stage],
      guaranteedEquipmentId: snapshot.targetEquipmentId
    })).toEqual({
      offerId: 'dungeon-loot:combat_replay_stage:continuity_editor_alpha',
      salvageRewardPoints: 560
    });
  });

  it('rejects illegal and old combat-replay hunt snapshots', () => {
    const snapshot = createEquipmentHuntRunState(
      { dungeonId: 'combat_replay_stage', targetEquipmentId: 'thaw_metronome' },
      'combat_replay_stage',
      []
    );

    for (const stale of [
      { ...snapshot, rulesVersion: 0 },
      { ...snapshot, dungeonId: 'false_testimony_court' },
      { ...snapshot, targetEquipmentId: 'appeal_seal' },
      { ...snapshot, clueNodeIds: ['film_supply_cache', 'script_stacks'] },
      { ...snapshot, crossedDungeonPortal: 0 },
      { ...snapshot, legacyQualified: true }
    ]) {
      expect(() => normalizeEquipmentHuntRunState(stale)).toThrow(TypeError);
      expect(isEquipmentHuntRunState(stale)).toBe(false);
    }
  });
});
