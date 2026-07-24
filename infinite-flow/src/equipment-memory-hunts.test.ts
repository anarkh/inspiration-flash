import { describe, expect, it } from 'vitest';

import { resolveCombatFocus, type CombatFocusIntent } from './combat-focus';
import { getDungeonEvents } from './dungeon-events';
import { EQUIPMENT } from './game';
import { DUNGEONS, DUNGEON_ORDER } from './level-content';
import {
  EMPTY_EQUIPMENT_MEMORY_MAP,
  EQUIPMENT_MEMORY_ATTUNEMENT_IDS,
  EQUIPMENT_MEMORY_CATALOG,
  EQUIPMENT_MEMORY_EQUIPMENT_CATALOG,
  EQUIPMENT_MEMORY_HUNT_CATALOG,
  EQUIPMENT_MEMORY_HUNT_COMBINATION_COUNT,
  EQUIPMENT_MEMORY_RULES_VERSION,
  activateEquipmentMemory,
  applyEquipmentMemoryCombatFocusResolution,
  createEquipmentMemoryCombatState,
  createEquipmentMemoryHuntRunState,
  createEquipmentMemoryRunSnapshot,
  createPreparedEquipmentMemoryHunt,
  getEquipmentMemoryById,
  getEquipmentMemoryForDungeon,
  getEquipmentMemoryHuntDisplayStatus,
  getEquipmentMemoryHuntProgress,
  getEquipmentMemoryRunSnapshotMatch,
  getPreparedEquipmentMemoryHunt,
  hasMatchingEquipmentMemory,
  isEquipmentMemoryHuntRunState,
  isEquipmentMemoryRunSnapshot,
  listEquipmentMemories,
  listEquipmentMemoriesForDungeon,
  listEquipmentMemoryEquipmentIds,
  listMatchingEquipmentMemorySnapshotEntries,
  listPreparedEquipmentMemoryHunts,
  normalizeEquipmentMemoryCombatState,
  normalizeEquipmentMemoryHuntRunState,
  normalizeEquipmentMemoryMap,
  normalizeEquipmentMemoryRunSnapshot,
  normalizePreparedEquipmentMemoryHunt,
  sanitizeEquipmentMemoryMap,
  settleEquipmentMemoryHuntRun,
  transitionEquipmentMemoryHuntEventOutcome,
  transitionEquipmentMemoryHuntNodeClear,
  transitionEquipmentMemoryHuntRun,
  unlockEquipmentMemory,
  type EquipmentMemoryCombatState,
  type EquipmentMemoryHuntRunState,
  type EquipmentMemoryMap,
  type EquipmentMemoryRunSnapshot,
  type PreparedEquipmentMemoryHunt
} from './equipment-memory-hunts';

const EXPECTED_MEMORIES = [
  ['demon_tower_1', 'equipment_memory_demon_tower_1', '血阶余息', 'blood_rune_stair', 'blood_rune_trap'],
  ['metro_abyss', 'equipment_memory_metro_abyss', '镜潮借路', 'mirror_tide_crossing', 'mirror_tide_trap'],
  ['starfall_mine', 'equipment_memory_starfall_mine', '线圈余鸣', 'coil_resonance_salvage', 'coil_burst_trap'],
  ['rust_hospital', 'equipment_memory_rust_hospital', '无菌复诊', 'sterile_light_calibration', 'sterile_corridor'],
  ['ash_arena', 'equipment_memory_ash_arena', '火线改判', 'judgement_line_reversal', 'judgement_flame'],
  ['dream_archive', 'equipment_memory_dream_archive', '缺息回环', 'missing_breath_corridor', 'memory_loop_trap'],
  ['void_citadel', 'equipment_memory_void_citadel', '身份重组', 'identity_reassembly', 'identity_trap'],
  ['temporal_observatory', 'equipment_memory_temporal_observatory', '零时预演', 'future_calibration_echo', 'future_calibration_anchor'],
  ['causal_clearinghouse', 'equipment_memory_causal_clearinghouse', '因果倒账', 'causal_debt_reversal', 'effect_deposition'],
  ['entropy_ark', 'equipment_memory_entropy_ark', '熵潮余航', 'entropy_wake_inversion', 'starboard_ballast_core'],
  ['mirror_cycle_city', 'equipment_memory_mirror_cycle_city', '双相自证', 'identity_rehearsal', 'mirror_anchor'],
  ['redaction_scriptorium', 'equipment_memory_redaction_scriptorium', '未删句', 'palimpsest_testimony', 'final_proof_nexus'],
  ['legacy_auction_court', 'equipment_memory_legacy_auction_court', '未落之槌', 'dead_team_testimony', 'provenance_event_stage'],
  ['genesis_vault', 'equipment_memory_genesis_vault', '未定之祖', 'ancestor_echo', 'mosaic_gene_vault'],
  ['silent_broadcast_tower', 'equipment_memory_silent_broadcast_tower', '最后一段人声', 'last_broadcast', 'broadcast_memory_stage'],
  ['lost_shelter', 'equipment_memory_lost_shelter', '仍有人回应', 'last_roll_call', 'survivor_memory_stage'],
  ['false_testimony_court', 'equipment_memory_false_testimony', '证词之外', 'sealed_deposition', 'cross_exam_stage'],
  ['combat_replay_stage', 'equipment_memory_combat_replay_stage', '镜头以外', 'last_retake', 'script_projection_stage'],
  ['panopticon_city', 'equipment_memory_panopticon_city', '视界之外', 'blindspot_theater', 'inverse_observation_stage']
] as const;

const REGULAR_INTENT = {
  id: 'regular-pursuit',
  severity: 'normal',
  recommendedActions: [],
  dangerousActions: []
} as const satisfies CombatFocusIntent;

const RECOMMENDED_GUARD_INTENT = {
  id: 'test-warning' as CombatFocusIntent['id'],
  severity: 'warning',
  recommendedActions: ['guard'],
  dangerousActions: []
} as const satisfies CombatFocusIntent;

function requirePrepared(index = 0): PreparedEquipmentMemoryHunt {
  const prepared = EQUIPMENT_MEMORY_HUNT_CATALOG[index];
  if (!prepared) throw new Error(`Missing prepared equipment memory hunt ${index}.`);
  return prepared;
}

function requireRunState(
  prepared = requirePrepared(),
  attunementId = EQUIPMENT_MEMORY_ATTUNEMENT_IDS[0]
): EquipmentMemoryHuntRunState {
  const state = createEquipmentMemoryHuntRunState(prepared, attunementId);
  if (!state) throw new Error('Expected a valid equipment memory hunt state.');
  return state;
}

function secureRun(state = requireRunState()): EquipmentMemoryHuntRunState {
  const afterNode = transitionEquipmentMemoryHuntNodeClear(state, state.nodeId);
  const secured = transitionEquipmentMemoryHuntEventOutcome(afterNode, state.eventId, { success: true });
  if (!secured) throw new Error('Expected the equipment memory hunt to secure.');
  return secured;
}

function createMatchingSnapshot(): EquipmentMemoryRunSnapshot {
  let memoryMap: EquipmentMemoryMap = EMPTY_EQUIPMENT_MEMORY_MAP;
  memoryMap = unlockEquipmentMemory(
    memoryMap,
    'armor_piercing_sword',
    'equipment_memory_demon_tower_1'
  );
  memoryMap = unlockEquipmentMemory(
    memoryMap,
    'bone_spear',
    'equipment_memory_demon_tower_1'
  );
  memoryMap = unlockEquipmentMemory(
    memoryMap,
    'ember_staff',
    'equipment_memory_metro_abyss'
  );
  const snapshot = createEquipmentMemoryRunSnapshot(
    ['bone_spear', 'training_blade', 'armor_piercing_sword', 'bone_spear', 'ember_staff'],
    memoryMap
  );
  if (!snapshot) throw new Error('Expected a valid equipment memory snapshot.');
  return snapshot;
}

function requireCombatState(
  snapshot: unknown = createMatchingSnapshot(),
  dungeonId = 'demon_tower_1'
): EquipmentMemoryCombatState {
  const state = createEquipmentMemoryCombatState(snapshot, dungeonId);
  if (!state) throw new Error('Expected matching memory combat state.');
  return state;
}

describe('equipment memory catalogs', () => {
  it('covers the nineteen dungeons in canonical order with explicit ids and copy', () => {
    expect(EQUIPMENT_MEMORY_RULES_VERSION).toBe(1);
    expect(DUNGEON_ORDER).toHaveLength(19);
    expect(EQUIPMENT_MEMORY_CATALOG).toHaveLength(19);
    expect(listEquipmentMemories()).toBe(EQUIPMENT_MEMORY_CATALOG);
    expect(EQUIPMENT_MEMORY_CATALOG.map(({ dungeonId }) => dungeonId)).toEqual(DUNGEON_ORDER);
    expect(
      EQUIPMENT_MEMORY_CATALOG.map(({ dungeonId, id, name, eventId, nodeId }) => {
        return [dungeonId, id, name, eventId, nodeId];
      })
    ).toEqual(EXPECTED_MEMORIES);

    for (const definition of EQUIPMENT_MEMORY_CATALOG) {
      expect(Object.isFrozen(definition)).toBe(true);
      expect(definition.description.length).toBeGreaterThan(0);
      expect(definition.effectDescription.length).toBeGreaterThan(0);
      expect(getEquipmentMemoryById(definition.id)).toBe(definition);
      expect(getEquipmentMemoryForDungeon(definition.dungeonId)).toBe(definition);
      expect(listEquipmentMemoriesForDungeon(definition.dungeonId)).toEqual([definition]);
      expect(Object.isFrozen(listEquipmentMemoriesForDungeon(definition.dungeonId))).toBe(true);
    }
    expect(Object.isFrozen(EQUIPMENT_MEMORY_CATALOG)).toBe(true);
    expect(getEquipmentMemoryById('unknown_memory')).toBeUndefined();
    expect(getEquipmentMemoryForDungeon('unknown_dungeon')).toBeUndefined();
    expect(listEquipmentMemoriesForDungeon('unknown_dungeon')).toEqual([]);
  });

  it('points every memory at a real dungeon event and a real target node', () => {
    for (const definition of EQUIPMENT_MEMORY_CATALOG) {
      const event = getDungeonEvents(definition.dungeonId).find(({ id }) => id === definition.eventId);
      const node = DUNGEONS[definition.dungeonId].nodes.find(({ id }) => id === definition.nodeId);
      expect(event).toBeDefined();
      expect(node).toBeDefined();
      expect(event?.dungeonId).toBe(definition.dungeonId);
      expect(
        DUNGEONS[definition.dungeonId].nodes.some(({ id }) => id === event?.nodeId)
      ).toBe(true);
    }
  });

  it('explicitly lists all fifty-six non-starter temperable equipment ids', () => {
    const temperableEquipmentIds = Object.values(EQUIPMENT)
      .filter(({ maxLevel }) => maxLevel > 1)
      .map(({ id }) => id);

    expect(EQUIPMENT_MEMORY_EQUIPMENT_CATALOG).toHaveLength(56);
    expect(listEquipmentMemoryEquipmentIds()).toBe(EQUIPMENT_MEMORY_EQUIPMENT_CATALOG);
    expect([...EQUIPMENT_MEMORY_EQUIPMENT_CATALOG]).toEqual(temperableEquipmentIds);
    expect(new Set(EQUIPMENT_MEMORY_EQUIPMENT_CATALOG).size).toBe(56);
    expect(Object.isFrozen(EQUIPMENT_MEMORY_EQUIPMENT_CATALOG)).toBe(true);
  });

  it('exposes exactly 1064 immutable, strict dungeon-equipment combinations', () => {
    expect(EQUIPMENT_MEMORY_HUNT_COMBINATION_COUNT).toBe(19 * 56);
    expect(EQUIPMENT_MEMORY_HUNT_CATALOG).toHaveLength(EQUIPMENT_MEMORY_HUNT_COMBINATION_COUNT);
    expect(Object.isFrozen(EQUIPMENT_MEMORY_HUNT_CATALOG)).toBe(true);
    expect(new Set(EQUIPMENT_MEMORY_HUNT_CATALOG.map(({ dungeonId, equipmentId }) => {
      return `${dungeonId}:${equipmentId}`;
    })).size).toBe(1064);

    for (const dungeonId of DUNGEON_ORDER) {
      const options = listPreparedEquipmentMemoryHunts(dungeonId);
      const memory = getEquipmentMemoryForDungeon(dungeonId);
      expect(options).toHaveLength(56);
      expect(Object.isFrozen(options)).toBe(true);
      expect(options.every((option) => option.memoryId === memory?.id)).toBe(true);
      expect(options.every(Object.isFrozen)).toBe(true);
    }
    expect(listPreparedEquipmentMemoryHunts()).toBe(EQUIPMENT_MEMORY_HUNT_CATALOG);
    expect(listPreparedEquipmentMemoryHunts('unknown_dungeon')).toEqual([]);

    for (const equipmentId of EQUIPMENT_MEMORY_EQUIPMENT_CATALOG) {
      expect(EQUIPMENT_MEMORY_HUNT_CATALOG.filter((option) => option.equipmentId === equipmentId)).toHaveLength(19);
    }
  });

  it('binds 仍有人回应 to the last roll call and all four Tier-16 pieces', () => {
    const definition = getEquipmentMemoryForDungeon('lost_shelter');
    const event = getDungeonEvents('lost_shelter').find(({ id }) => id === 'last_roll_call');

    expect(definition).toMatchObject({
      id: 'equipment_memory_lost_shelter',
      dungeonId: 'lost_shelter',
      name: '仍有人回应',
      eventId: 'last_roll_call',
      nodeId: 'survivor_memory_stage'
    });
    expect(definition?.description).toContain('点名册最后不是死亡名单');
    expect(definition?.description).toContain('有人持续回应同伴姓名');
    expect(event).toBeDefined();

    for (const equipmentId of [
      'rescue_carbine',
      'triage_visor',
      'evacuation_plate',
      'blackbox_beacon'
    ] as const) {
      expect(createPreparedEquipmentMemoryHunt(
        'lost_shelter',
        equipmentId,
        'equipment_memory_lost_shelter'
      )).toEqual({
        dungeonId: 'lost_shelter',
        equipmentId,
        memoryId: 'equipment_memory_lost_shelter'
      });
    }
  });

  it('binds 证词之外 to the sealed deposition and all four Tier-17 pieces', () => {
    const definition = getEquipmentMemoryForDungeon('false_testimony_court');
    const event = getDungeonEvents('false_testimony_court').find(({ id }) => id === 'sealed_deposition');

    expect(definition).toMatchObject({
      id: 'equipment_memory_false_testimony',
      dungeonId: 'false_testimony_court',
      name: '证词之外',
      eventId: 'sealed_deposition',
      nodeId: 'cross_exam_stage',
      effectDescription: '伪证裁定庭战斗中可暂存 1 点溢出战意，并在下一次武器技能后恢复 1 点战意。'
    });
    expect(definition?.description).toContain(
      '真正的证词不是某个人说了什么，而是三份互不相识的证据仍指向同一处空白'
    );
    expect(event).toBeDefined();

    for (const equipmentId of [
      'cross_examiner_sabre',
      'forensic_visor',
      'custody_shell',
      'appeal_seal'
    ] as const) {
      expect(createPreparedEquipmentMemoryHunt(
        'false_testimony_court',
        equipmentId,
        'equipment_memory_false_testimony'
      )).toEqual({
        dungeonId: 'false_testimony_court',
        equipmentId,
        memoryId: 'equipment_memory_false_testimony'
      });
    }
  });

  it('binds 镜头以外 to the last retake and all four Tier-18 pieces', () => {
    const definition = getEquipmentMemoryForDungeon('combat_replay_stage');
    const event = getDungeonEvents('combat_replay_stage').find(({ id }) => id === 'last_retake');

    expect(definition).toEqual({
      id: 'equipment_memory_combat_replay_stage',
      dungeonId: 'combat_replay_stage',
      name: '镜头以外',
      description: '最后一次重拍结束后，镜头以外仍有人在完成那场战斗；装备记住了没有被剪辑留下的战意。',
      effectDescription: '战痕复演场战斗中可暂存 1 点溢出战意，并在下一次武器技能后恢复 1 点战意。',
      eventId: 'last_retake',
      nodeId: 'script_projection_stage'
    });
    expect(event).toBeDefined();
    expect(event?.options.some(({ outcome }) => outcome.success)).toBe(true);
    for (const equipmentId of [
      'frame_engraver',
      'cue_visor',
      'buffer_plate',
      'thaw_metronome'
    ] as const) {
      expect(createPreparedEquipmentMemoryHunt(
        'combat_replay_stage',
        equipmentId,
        'equipment_memory_combat_replay_stage'
      )).toEqual({
        dungeonId: 'combat_replay_stage',
        equipmentId,
        memoryId: 'equipment_memory_combat_replay_stage'
      });
    }
  });

  it('binds 视界之外 to the blindspot event plus inverse-observation node and all four Tier-19 pieces', () => {
    const definition = getEquipmentMemoryForDungeon('panopticon_city');
    const event = getDungeonEvents('panopticon_city').find(({ id }) => id === 'blindspot_theater');

    expect(definition).toEqual({
      id: 'equipment_memory_panopticon_city',
      dungeonId: 'panopticon_city',
      name: '视界之外',
      description: '盲区剧场证明天幕只能记录被允许进入视界的行动；逆向观测台则让装备记住那条从未被监察承认的真实轨迹。',
      effectDescription: '天幕监察城战斗中可暂存 1 点溢出战意，并在下一次武器技能后恢复 1 点战意。',
      eventId: 'blindspot_theater',
      nodeId: 'inverse_observation_stage'
    });
    expect(event?.nodeId).toBe('blindspot_theater');
    expect(DUNGEONS.panopticon_city.nodes.some(({ id }) => id === 'inverse_observation_stage')).toBe(true);
    for (const equipmentId of [
      'blindline_cutter',
      'predictive_visor',
      'matte_shell',
      'inverse_prism'
    ] as const) {
      expect(createPreparedEquipmentMemoryHunt(
        'panopticon_city',
        equipmentId,
        'equipment_memory_panopticon_city'
      )).toEqual({
        dungeonId: 'panopticon_city',
        equipmentId,
        memoryId: 'equipment_memory_panopticon_city'
      });
    }
    expect(EQUIPMENT_MEMORY_HUNT_COMBINATION_COUNT).toBe(1064);
  });

  it('binds the clearinghouse memory to all three mature Tier-9 pieces without new attunements', () => {
    const definition = getEquipmentMemoryForDungeon('causal_clearinghouse');

    expect(definition).toMatchObject({
      id: 'equipment_memory_causal_clearinghouse',
      eventId: 'causal_debt_reversal',
      nodeId: 'effect_deposition'
    });
    for (const equipmentId of [
      'causal_visor',
      'echo_breaker_gauntlets',
      'return_anchor_belt'
    ] as const) {
      expect(createPreparedEquipmentMemoryHunt(
        'causal_clearinghouse',
        equipmentId,
        'equipment_memory_causal_clearinghouse'
      )).toEqual({
        dungeonId: 'causal_clearinghouse',
        equipmentId,
        memoryId: 'equipment_memory_causal_clearinghouse'
      });
    }
    expect(EQUIPMENT_MEMORY_ATTUNEMENT_IDS).toHaveLength(8);
  });

  it('binds 熵潮余航 to the entropy event and all three Tier-10 pieces', () => {
    const definition = getEquipmentMemoryForDungeon('entropy_ark');

    expect(definition).toMatchObject({
      id: 'equipment_memory_entropy_ark',
      name: '熵潮余航',
      eventId: 'entropy_wake_inversion',
      nodeId: 'starboard_ballast_core'
    });
    for (const equipmentId of ['entropy_compass', 'dissipation_mantle', 'ark_keel_boots'] as const) {
      expect(createPreparedEquipmentMemoryHunt('entropy_ark', equipmentId, 'equipment_memory_entropy_ark')).toEqual({
        dungeonId: 'entropy_ark',
        equipmentId,
        memoryId: 'equipment_memory_entropy_ark'
      });
    }
    expect(EQUIPMENT_MEMORY_ATTUNEMENT_IDS).toHaveLength(8);
  });

  it('binds 双相自证 to the identity rehearsal and all three Tier-11 pieces', () => {
    const definition = getEquipmentMemoryForDungeon('mirror_cycle_city');

    expect(definition).toEqual({
      id: 'equipment_memory_mirror_cycle_city',
      dungeonId: 'mirror_cycle_city',
      name: '双相自证',
      description: '身份排演后留下的双相证词，让装备在现实与镜像之间记住同一次战意回响。',
      effectDescription: '镜海轮回城战斗中可暂存 1 点溢出战意，并在下一次武器技能后恢复 1 点战意。',
      eventId: 'identity_rehearsal',
      nodeId: 'mirror_anchor'
    });
    for (const equipmentId of ['parallax_visor', 'phaseweave_mantle', 'homecoming_prism'] as const) {
      expect(createPreparedEquipmentMemoryHunt(
        'mirror_cycle_city',
        equipmentId,
        'equipment_memory_mirror_cycle_city'
      )).toEqual({
        dungeonId: 'mirror_cycle_city',
        equipmentId,
        memoryId: 'equipment_memory_mirror_cycle_city'
      });
    }
    expect(EQUIPMENT_MEMORY_ATTUNEMENT_IDS).toHaveLength(8);
  });

  it('binds 未删句 to the testimony and all three Tier-12 pieces', () => {
    const definition = getEquipmentMemoryForDungeon('redaction_scriptorium');

    expect(definition).toEqual({
      id: 'equipment_memory_redaction_scriptorium',
      dungeonId: 'redaction_scriptorium',
      name: '未删句',
      description: '终稿证词中幸存的一句原文，让装备记住删改前溢出的战意。',
      effectDescription: '删界终稿院战斗中可暂存 1 点溢出战意，并在下一次武器技能后恢复 1 点战意。',
      eventId: 'palimpsest_testimony',
      nodeId: 'final_proof_nexus'
    });
    for (const equipmentId of ['redline_edge', 'palimpsest_mantle', 'final_proof_seal'] as const) {
      expect(createPreparedEquipmentMemoryHunt(
        'redaction_scriptorium',
        equipmentId,
        'equipment_memory_redaction_scriptorium'
      )).toEqual({
        dungeonId: 'redaction_scriptorium',
        equipmentId,
        memoryId: 'equipment_memory_redaction_scriptorium'
      });
    }
    expect(EQUIPMENT_MEMORY_ATTUNEMENT_IDS).toHaveLength(8);
  });

  it('binds 未落之槌 to the dead-team testimony and all four Tier-13 pieces', () => {
    const definition = getEquipmentMemoryForDungeon('legacy_auction_court');

    expect(definition).toEqual({
      id: 'equipment_memory_legacy_auction_court',
      dungeonId: 'legacy_auction_court',
      name: '未落之槌',
      description: '死队证词落槌前留下的一次未决举牌，让装备记住未能成交的战意。',
      effectDescription: '亡队遗产拍卖庭战斗中可暂存 1 点溢出战意，并在下一次武器技能后恢复 1 点战意。',
      eventId: 'dead_team_testimony',
      nodeId: 'provenance_event_stage'
    });
    for (const equipmentId of [
      'legacy_gavel',
      'anonymous_veil',
      'escrow_plate',
      'final_lot_bell'
    ] as const) {
      expect(createPreparedEquipmentMemoryHunt(
        'legacy_auction_court',
        equipmentId,
        'equipment_memory_legacy_auction_court'
      )).toEqual({
        dungeonId: 'legacy_auction_court',
        equipmentId,
        memoryId: 'equipment_memory_legacy_auction_court'
      });
    }
    expect(EQUIPMENT_MEMORY_ATTUNEMENT_IDS).toHaveLength(8);
  });

  it('binds 未定之祖 to the ancestor echo and all four Tier-14 pieces', () => {
    const definition = getEquipmentMemoryForDungeon('genesis_vault');
    const event = getDungeonEvents('genesis_vault').find(({ id }) => id === 'ancestor_echo');

    expect(definition).toEqual({
      id: 'equipment_memory_genesis_vault',
      dungeonId: 'genesis_vault',
      name: '未定之祖',
      description: '祖先回声没有宣告唯一血统，只让装备记住每次主动选择：原型不是出身，而是仍可重写的决定。',
      effectDescription: '众生原型库战斗中可暂存 1 点溢出战意，并在下一次武器技能后恢复 1 点战意；这份回响名为「未定之祖」。',
      eventId: 'ancestor_echo',
      nodeId: 'mosaic_gene_vault'
    });
    expect(event).toBeDefined();
    expect(event?.options.some(({ outcome }) => outcome.success)).toBe(true);
    for (const equipmentId of [
      'helix_cleaver',
      'symbiote_cowl',
      'carapace_harness',
      'rebirth_amulet'
    ] as const) {
      expect(createPreparedEquipmentMemoryHunt(
        'genesis_vault',
        equipmentId,
        'equipment_memory_genesis_vault'
      )).toEqual({
        dungeonId: 'genesis_vault',
        equipmentId,
        memoryId: 'equipment_memory_genesis_vault'
      });
    }
    expect(EQUIPMENT_MEMORY_ATTUNEMENT_IDS).toHaveLength(8);
  });

  it('binds 最后一段人声 to last_broadcast and all four Tier-15 pieces', () => {
    const definition = getEquipmentMemoryForDungeon('silent_broadcast_tower');
    const event = getDungeonEvents('silent_broadcast_tower').find(({ id }) => id === 'last_broadcast');

    expect(definition).toEqual({
      id: 'equipment_memory_silent_broadcast_tower',
      dungeonId: 'silent_broadcast_tower',
      name: '最后一段人声',
      description: '广播里最后留下的不是求救，而是有人确认队友仍然活着；这段人声让装备记住战意没有被寂静吞没。',
      effectDescription: '寂声广播塔战斗中可暂存 1 点溢出战意，并在下一次武器技能后恢复 1 点战意。',
      eventId: 'last_broadcast',
      nodeId: 'broadcast_memory_stage'
    });
    expect(event).toBeDefined();
    expect(event?.options.some(({ outcome }) => outcome.success)).toBe(true);
    for (const equipmentId of [
      'hushblade',
      'dead_air_headset',
      'anechoic_mantle',
      'last_channel_beacon'
    ] as const) {
      expect(createPreparedEquipmentMemoryHunt(
        'silent_broadcast_tower',
        equipmentId,
        'equipment_memory_silent_broadcast_tower'
      )).toEqual({
        dungeonId: 'silent_broadcast_tower',
        equipmentId,
        memoryId: 'equipment_memory_silent_broadcast_tower'
      });
    }
    expect(EQUIPMENT_MEMORY_ATTUNEMENT_IDS).toHaveLength(8);
  });
});

describe('equipment memory map', () => {
  it('keeps pre-Tier-15 memory maps unchanged without backfilling new equipment', () => {
    const normalized = normalizeEquipmentMemoryMap({
      final_proof_seal: {
        unlockedIds: ['equipment_memory_redaction_scriptorium'],
        activeId: 'equipment_memory_redaction_scriptorium'
      }
    });

    expect(normalized).toEqual({
      final_proof_seal: {
        unlockedIds: ['equipment_memory_redaction_scriptorium'],
        activeId: 'equipment_memory_redaction_scriptorium'
      }
    });
    expect(normalized?.hushblade).toBeUndefined();
    expect(createEquipmentMemoryRunSnapshot(['hushblade'], normalized)).toEqual({
      rulesVersion: 1,
      activeEntries: []
    });
  });

  it('strictly normalizes valid entries and rejects whole-map contract violations', () => {
    const raw = {
      bone_spear: {
        unlockedIds: ['equipment_memory_metro_abyss', 'equipment_memory_demon_tower_1'],
        activeId: 'equipment_memory_metro_abyss'
      },
      armor_piercing_sword: {
        unlockedIds: ['equipment_memory_demon_tower_1']
      }
    };
    const normalized = normalizeEquipmentMemoryMap(raw);
    expect(normalized).toEqual({
      armor_piercing_sword: { unlockedIds: ['equipment_memory_demon_tower_1'] },
      bone_spear: {
        unlockedIds: ['equipment_memory_demon_tower_1', 'equipment_memory_metro_abyss'],
        activeId: 'equipment_memory_metro_abyss'
      }
    });
    expect(normalized).not.toBe(raw);
    expect(Object.isFrozen(normalized)).toBe(true);
    expect(Object.isFrozen(normalized?.bone_spear)).toBe(true);
    expect(Object.isFrozen(normalized?.bone_spear?.unlockedIds)).toBe(true);

    const malformed = [
      undefined,
      [],
      { unknown_equipment: raw.bone_spear },
      { training_blade: raw.bone_spear },
      { bone_spear: { unlockedIds: ['unknown_memory'] } },
      { bone_spear: { unlockedIds: ['equipment_memory_demon_tower_1', 'equipment_memory_demon_tower_1'] } },
      { bone_spear: { unlockedIds: ['equipment_memory_demon_tower_1'], activeId: 'equipment_memory_metro_abyss' } },
      { bone_spear: { unlockedIds: ['equipment_memory_demon_tower_1'], extra: true } }
    ];
    for (const value of malformed) expect(normalizeEquipmentMemoryMap(value)).toBeUndefined();
  });

  it('sanitizes unknowns, duplicates, and illegal active ids per equipment entry', () => {
    const sanitized = sanitizeEquipmentMemoryMap({
      armor_piercing_sword: {
        unlockedIds: [
          'equipment_memory_demon_tower_1',
          'unknown_memory',
          'equipment_memory_demon_tower_1'
        ],
        activeId: 'equipment_memory_metro_abyss'
      },
      bone_spear: {
        unlockedIds: ['equipment_memory_metro_abyss'],
        activeId: 'equipment_memory_metro_abyss'
      },
      ember_staff: { unlockedIds: 'not-an-array', activeId: 'equipment_memory_starfall_mine' },
      unknown_equipment: {
        unlockedIds: ['equipment_memory_starfall_mine'],
        activeId: 'equipment_memory_starfall_mine'
      }
    });

    expect(sanitized).toEqual({
      armor_piercing_sword: { unlockedIds: ['equipment_memory_demon_tower_1'] },
      bone_spear: {
        unlockedIds: ['equipment_memory_metro_abyss'],
        activeId: 'equipment_memory_metro_abyss'
      }
    });
    expect(normalizeEquipmentMemoryMap(sanitized)).toEqual(sanitized);
    expect(sanitizeEquipmentMemoryMap(null)).toBe(EMPTY_EQUIPMENT_MEMORY_MAP);
  });

  it('unlocks in canonical order, auto-activates, and activates only unlocked memories', () => {
    let memoryMap = unlockEquipmentMemory(
      EMPTY_EQUIPMENT_MEMORY_MAP,
      'armor_piercing_sword',
      'equipment_memory_metro_abyss'
    );
    expect(memoryMap.armor_piercing_sword).toEqual({
      unlockedIds: ['equipment_memory_metro_abyss'],
      activeId: 'equipment_memory_metro_abyss'
    });

    memoryMap = unlockEquipmentMemory(
      memoryMap,
      'armor_piercing_sword',
      'equipment_memory_demon_tower_1'
    );
    expect(memoryMap.armor_piercing_sword).toEqual({
      unlockedIds: ['equipment_memory_demon_tower_1', 'equipment_memory_metro_abyss'],
      activeId: 'equipment_memory_demon_tower_1'
    });

    const lockedActivation = activateEquipmentMemory(
      memoryMap,
      'armor_piercing_sword',
      'equipment_memory_starfall_mine'
    );
    expect(lockedActivation).toBe(memoryMap);

    const activated = activateEquipmentMemory(
      memoryMap,
      'armor_piercing_sword',
      'equipment_memory_metro_abyss'
    );
    expect(activated.armor_piercing_sword?.activeId).toBe('equipment_memory_metro_abyss');
    expect(activateEquipmentMemory(
      activated,
      'armor_piercing_sword',
      'equipment_memory_metro_abyss'
    )).toBe(activated);
    expect(unlockEquipmentMemory(
      activated,
      'armor_piercing_sword',
      'equipment_memory_metro_abyss'
    )).toBe(activated);
  });

  it('contains invalid mutations locally and never binds collected memories to attunement', () => {
    const original = unlockEquipmentMemory(
      EMPTY_EQUIPMENT_MEMORY_MAP,
      'bone_spear',
      'equipment_memory_demon_tower_1'
    );
    expect(unlockEquipmentMemory(original, 'training_blade', 'equipment_memory_metro_abyss')).toBe(original);
    expect(unlockEquipmentMemory(original, 'bone_spear', 'unknown_memory')).toBe(original);
    expect(activateEquipmentMemory(original, 'unknown_equipment', 'equipment_memory_demon_tower_1')).toBe(original);

    const prepared = createPreparedEquipmentMemoryHunt(
      'demon_tower_1',
      'bone_spear',
      'equipment_memory_demon_tower_1'
    );
    const firstBranch = createEquipmentMemoryHuntRunState(prepared, 'mist_vanguard');
    const secondBranch = createEquipmentMemoryHuntRunState(prepared, 'chronal_stasis');
    expect(firstBranch?.attunementId).toBe('mist_vanguard');
    expect(secondBranch?.attunementId).toBe('chronal_stasis');
    expect(original.bone_spear).toEqual({
      unlockedIds: ['equipment_memory_demon_tower_1'],
      activeId: 'equipment_memory_demon_tower_1'
    });
  });
});

describe('prepared equipment memory hunts', () => {
  it('requires a catalog equipment and the memory owned by the selected dungeon', () => {
    const prepared = createPreparedEquipmentMemoryHunt(
      'metro_abyss',
      'bone_spear',
      'equipment_memory_metro_abyss'
    );
    expect(prepared).toEqual({
      dungeonId: 'metro_abyss',
      equipmentId: 'bone_spear',
      memoryId: 'equipment_memory_metro_abyss'
    });
    expect(Object.isFrozen(prepared)).toBe(true);
    expect(getPreparedEquipmentMemoryHunt(
      prepared?.dungeonId,
      prepared?.equipmentId,
      prepared?.memoryId
    )).toEqual(prepared);

    expect(createPreparedEquipmentMemoryHunt(
      'metro_abyss',
      'bone_spear',
      'equipment_memory_demon_tower_1'
    )).toBeUndefined();
    expect(createPreparedEquipmentMemoryHunt(
      'metro_abyss',
      'training_blade',
      'equipment_memory_metro_abyss'
    )).toBeUndefined();
    expect(createPreparedEquipmentMemoryHunt(
      'unknown_dungeon',
      'bone_spear',
      'equipment_memory_metro_abyss'
    )).toBeUndefined();
  });

  it('strictly normalizes exact prepared records only', () => {
    const prepared = requirePrepared(EQUIPMENT_MEMORY_EQUIPMENT_CATALOG.length);
    const normalized = normalizePreparedEquipmentMemoryHunt({ ...prepared });
    expect(normalized).toEqual(prepared);
    expect(normalized).not.toBe(prepared);
    expect(Object.isFrozen(normalized)).toBe(true);
    expect(normalizePreparedEquipmentMemoryHunt({ ...prepared, extra: true })).toBeUndefined();
    expect(normalizePreparedEquipmentMemoryHunt({
      ...prepared,
      memoryId: 'equipment_memory_demon_tower_1'
    })).toBeUndefined();
  });
});

describe('equipment memory hunt run state', () => {
  it('freezes the prepared target and one of the eight known attunement ids', () => {
    const prepared = requirePrepared();
    for (const attunementId of EQUIPMENT_MEMORY_ATTUNEMENT_IDS) {
      const state = createEquipmentMemoryHuntRunState(prepared, attunementId);
      expect(state).toMatchObject({
        rulesVersion: 1,
        ...prepared,
        attunementId,
        eventId: 'blood_rune_stair',
        nodeId: 'blood_rune_trap',
        nodeCleared: false,
        eventSucceeded: false,
        status: 'active'
      });
      expect(Object.isFrozen(state)).toBe(true);
      expect(isEquipmentMemoryHuntRunState(state)).toBe(true);
    }
    expect(createEquipmentMemoryHuntRunState(prepared, 'unknown_attunement')).toBeUndefined();
    expect(createEquipmentMemoryHuntRunState({ ...prepared, memoryId: 'unknown_memory' }, 'mist_vanguard')).toBeUndefined();
  });

  it('strictly normalizes only canonical frozen targets and valid state combinations', () => {
    const state = requireRunState();
    const normalized = normalizeEquipmentMemoryHuntRunState({ ...state });
    expect(normalized).toEqual(state);
    expect(normalized).not.toBe(state);
    expect(Object.isFrozen(normalized)).toBe(true);

    const malformed = [
      undefined,
      { ...state, rulesVersion: 0 },
      { ...state, attunementId: 'unknown_attunement' },
      { ...state, eventId: 'other_event' },
      { ...state, nodeId: 'other_node' },
      { ...state, status: 'secured' },
      { ...state, status: 'active', nodeCleared: true, eventSucceeded: true },
      { ...state, status: 'failed', reason: 'event_failure', eventSucceeded: true },
      { ...state, status: 'lost', reason: 'event_failure' },
      { ...state, reason: undefined },
      { ...state, extra: true }
    ];
    for (const value of malformed) {
      expect(normalizeEquipmentMemoryHuntRunState(value)).toBeUndefined();
      expect(isEquipmentMemoryHuntRunState(value)).toBe(false);
    }
  });

  it('secures after node then event and ignores unrelated or duplicate signals', () => {
    const initial = requireRunState();
    expect(transitionEquipmentMemoryHuntNodeClear(initial, 'other_node')).toBe(initial);
    expect(transitionEquipmentMemoryHuntEventOutcome(initial, 'other_event', { success: false })).toBe(initial);

    const afterNode = transitionEquipmentMemoryHuntNodeClear(initial, initial.nodeId);
    expect(afterNode).toMatchObject({ nodeCleared: true, eventSucceeded: false, status: 'active' });
    expect(transitionEquipmentMemoryHuntNodeClear(afterNode, initial.nodeId)).toBe(afterNode);

    const secured = transitionEquipmentMemoryHuntEventOutcome(afterNode, initial.eventId, { success: true });
    expect(secured).toMatchObject({ nodeCleared: true, eventSucceeded: true, status: 'secured' });
    expect(transitionEquipmentMemoryHuntEventOutcome(secured, initial.eventId, { success: true })).toBe(secured);
    expect(transitionEquipmentMemoryHuntNodeClear(secured, initial.nodeId)).toBe(secured);
  });

  it('secures after event then node and treats the resolved event as idempotent', () => {
    const initial = requireRunState();
    const afterEvent = transitionEquipmentMemoryHuntRun(initial, {
      type: 'event_resolved',
      eventId: initial.eventId,
      outcome: { success: true }
    });
    expect(afterEvent).toMatchObject({ nodeCleared: false, eventSucceeded: true, status: 'active' });
    expect(transitionEquipmentMemoryHuntEventOutcome(
      afterEvent,
      initial.eventId,
      { success: false }
    )).toBe(afterEvent);

    const secured = transitionEquipmentMemoryHuntRun(afterEvent, {
      type: 'node_cleared',
      nodeId: initial.nodeId
    });
    expect(secured).toMatchObject({ nodeCleared: true, eventSucceeded: true, status: 'secured' });
  });

  it('secures 未定之祖 in either condition order and banks it exactly once', () => {
    const prepared = createPreparedEquipmentMemoryHunt(
      'genesis_vault',
      'helix_cleaver',
      'equipment_memory_genesis_vault'
    );
    const initial = createEquipmentMemoryHuntRunState(prepared, 'chronal_stasis');
    if (!initial) throw new Error('Expected a valid genesis memory hunt state.');

    expect(initial).toMatchObject({
      dungeonId: 'genesis_vault',
      equipmentId: 'helix_cleaver',
      memoryId: 'equipment_memory_genesis_vault',
      attunementId: 'chronal_stasis',
      eventId: 'ancestor_echo',
      nodeId: 'mosaic_gene_vault',
      nodeCleared: false,
      eventSucceeded: false,
      status: 'active'
    });
    expect(transitionEquipmentMemoryHuntNodeClear(initial, 'genome_repair_station')).toBe(initial);
    expect(transitionEquipmentMemoryHuntEventOutcome(initial, 'ancestor_echo', { success: false })).toMatchObject({
      status: 'failed',
      reason: 'event_failure'
    });

    const eventFirst = transitionEquipmentMemoryHuntEventOutcome(initial, 'ancestor_echo', { success: true });
    expect(eventFirst).toMatchObject({ nodeCleared: false, eventSucceeded: true, status: 'active' });
    const securedEventFirst = transitionEquipmentMemoryHuntNodeClear(eventFirst, 'mosaic_gene_vault');
    expect(securedEventFirst).toMatchObject({ nodeCleared: true, eventSucceeded: true, status: 'secured' });

    const nodeFirst = transitionEquipmentMemoryHuntNodeClear(initial, 'mosaic_gene_vault');
    const securedNodeFirst = transitionEquipmentMemoryHuntEventOutcome(nodeFirst, 'ancestor_echo', { success: true });
    expect(securedNodeFirst).toMatchObject({ nodeCleared: true, eventSucceeded: true, status: 'secured' });

    const settlement = settleEquipmentMemoryHuntRun(securedNodeFirst, 'successful_exit');
    expect(settlement).toMatchObject({ granted: true, state: { status: 'banked' } });
    const unlocked = unlockEquipmentMemory(
      EMPTY_EQUIPMENT_MEMORY_MAP,
      'helix_cleaver',
      'equipment_memory_genesis_vault'
    );
    expect(unlocked.helix_cleaver).toEqual({
      unlockedIds: ['equipment_memory_genesis_vault'],
      activeId: 'equipment_memory_genesis_vault'
    });
    expect(settleEquipmentMemoryHuntRun(settlement.state, 'successful_exit')).toEqual({
      state: settlement.state,
      granted: false
    });
  });

  it('rejects illegal and old genesis memory hunt snapshots', () => {
    const prepared = createPreparedEquipmentMemoryHunt(
      'genesis_vault',
      'rebirth_amulet',
      'equipment_memory_genesis_vault'
    );
    const state = createEquipmentMemoryHuntRunState(prepared, 'rift_anchor');
    if (!state) throw new Error('Expected a valid genesis memory hunt state.');

    for (const stale of [
      { ...state, rulesVersion: 0 },
      { ...state, dungeonId: 'legacy_auction_court' },
      { ...state, equipmentId: 'training_blade' },
      { ...state, memoryId: 'equipment_memory_legacy_auction_court' },
      { ...state, eventId: 'dead_team_testimony' },
      { ...state, nodeId: 'provenance_event_stage' },
      { ...state, legacyQualified: true }
    ]) {
      expect(normalizeEquipmentMemoryHuntRunState(stale)).toBeUndefined();
      expect(isEquipmentMemoryHuntRunState(stale)).toBe(false);
    }
  });

  it('secures 最后一段人声 in either condition order and banks it on Tier-15 gear', () => {
    const prepared = createPreparedEquipmentMemoryHunt(
      'silent_broadcast_tower',
      'hushblade',
      'equipment_memory_silent_broadcast_tower'
    );
    const initial = createEquipmentMemoryHuntRunState(prepared, 'forge_overdrive');
    if (!initial) throw new Error('Expected a valid silent broadcast memory hunt state.');

    expect(initial).toMatchObject({
      dungeonId: 'silent_broadcast_tower',
      equipmentId: 'hushblade',
      memoryId: 'equipment_memory_silent_broadcast_tower',
      attunementId: 'forge_overdrive',
      eventId: 'last_broadcast',
      nodeId: 'broadcast_memory_stage',
      status: 'active'
    });
    const eventFirst = transitionEquipmentMemoryHuntEventOutcome(initial, 'last_broadcast', { success: true });
    const securedEventFirst = transitionEquipmentMemoryHuntNodeClear(eventFirst, 'broadcast_memory_stage');
    expect(securedEventFirst).toMatchObject({ nodeCleared: true, eventSucceeded: true, status: 'secured' });

    const nodeFirst = transitionEquipmentMemoryHuntNodeClear(initial, 'broadcast_memory_stage');
    const securedNodeFirst = transitionEquipmentMemoryHuntEventOutcome(nodeFirst, 'last_broadcast', { success: true });
    expect(securedNodeFirst).toMatchObject({ nodeCleared: true, eventSucceeded: true, status: 'secured' });
    expect(settleEquipmentMemoryHuntRun(securedNodeFirst, 'successful_exit')).toMatchObject({
      granted: true,
      state: { status: 'banked' }
    });

    const unlocked = unlockEquipmentMemory(
      EMPTY_EQUIPMENT_MEMORY_MAP,
      'last_channel_beacon',
      'equipment_memory_silent_broadcast_tower'
    );
    expect(unlocked.last_channel_beacon).toEqual({
      unlockedIds: ['equipment_memory_silent_broadcast_tower'],
      activeId: 'equipment_memory_silent_broadcast_tower'
    });
  });

  it('rejects illegal and old silent broadcast memory hunt snapshots', () => {
    const prepared = createPreparedEquipmentMemoryHunt(
      'silent_broadcast_tower',
      'last_channel_beacon',
      'equipment_memory_silent_broadcast_tower'
    );
    const state = createEquipmentMemoryHuntRunState(prepared, 'chronal_stasis');
    if (!state) throw new Error('Expected a valid silent broadcast memory hunt state.');

    for (const stale of [
      { ...state, rulesVersion: 0 },
      { ...state, dungeonId: 'genesis_vault' },
      { ...state, equipmentId: 'training_blade' },
      { ...state, memoryId: 'equipment_memory_genesis_vault' },
      { ...state, eventId: 'ancestor_echo' },
      { ...state, nodeId: 'mosaic_gene_vault' },
      { ...state, legacyQualified: true }
    ]) {
      expect(normalizeEquipmentMemoryHuntRunState(stale)).toBeUndefined();
      expect(isEquipmentMemoryHuntRunState(stale)).toBe(false);
    }
  });

  it('requires the exact combat-replay event and node, then banks 镜头以外 exactly once', () => {
    const prepared = createPreparedEquipmentMemoryHunt(
      'combat_replay_stage',
      'frame_engraver',
      'equipment_memory_combat_replay_stage'
    );
    const initial = createEquipmentMemoryHuntRunState(prepared, 'forge_overdrive');
    if (!initial) throw new Error('Expected a valid combat replay memory hunt state.');

    expect(initial).toMatchObject({
      dungeonId: 'combat_replay_stage',
      equipmentId: 'frame_engraver',
      memoryId: 'equipment_memory_combat_replay_stage',
      eventId: 'last_retake',
      nodeId: 'script_projection_stage',
      nodeCleared: false,
      eventSucceeded: false,
      status: 'active'
    });
    expect(transitionEquipmentMemoryHuntNodeClear(initial, 'film_supply_cache')).toBe(initial);
    expect(transitionEquipmentMemoryHuntEventOutcome(initial, 'sealed_deposition', { success: true }))
      .toBe(initial);

    const afterEvent = transitionEquipmentMemoryHuntEventOutcome(initial, 'last_retake', { success: true });
    expect(afterEvent).toMatchObject({ nodeCleared: false, eventSucceeded: true, status: 'active' });
    expect(transitionEquipmentMemoryHuntEventOutcome(afterEvent, 'last_retake', { success: false }))
      .toBe(afterEvent);
    const secured = transitionEquipmentMemoryHuntNodeClear(afterEvent, 'script_projection_stage');
    expect(secured).toMatchObject({ nodeCleared: true, eventSucceeded: true, status: 'secured' });
    expect(transitionEquipmentMemoryHuntNodeClear(secured, 'script_projection_stage')).toBe(secured);

    const settlement = settleEquipmentMemoryHuntRun(secured, 'successful_exit');
    expect(settlement).toMatchObject({ granted: true, state: { status: 'banked' } });
    expect(settleEquipmentMemoryHuntRun(settlement.state, 'successful_exit')).toEqual({
      state: settlement.state,
      granted: false
    });

    const unlocked = unlockEquipmentMemory(
      EMPTY_EQUIPMENT_MEMORY_MAP,
      'frame_engraver',
      'equipment_memory_combat_replay_stage'
    );
    expect(unlocked.frame_engraver).toEqual({
      unlockedIds: ['equipment_memory_combat_replay_stage'],
      activeId: 'equipment_memory_combat_replay_stage'
    });
    expect(unlockEquipmentMemory(
      unlocked,
      'frame_engraver',
      'equipment_memory_combat_replay_stage'
    )).toBe(unlocked);
  });

  it('rejects cross-chapter and stale combat-replay memory hunt snapshots', () => {
    const prepared = createPreparedEquipmentMemoryHunt(
      'combat_replay_stage',
      'thaw_metronome',
      'equipment_memory_combat_replay_stage'
    );
    const state = createEquipmentMemoryHuntRunState(prepared, 'chronal_stasis');
    if (!state) throw new Error('Expected a valid combat replay memory hunt state.');

    for (const stale of [
      { ...state, rulesVersion: 0 },
      { ...state, dungeonId: 'false_testimony_court' },
      { ...state, equipmentId: 'training_blade' },
      { ...state, memoryId: 'equipment_memory_false_testimony' },
      { ...state, eventId: 'sealed_deposition' },
      { ...state, nodeId: 'cross_exam_stage' },
      { ...state, legacyQualified: true }
    ]) {
      expect(normalizeEquipmentMemoryHuntRunState(stale)).toBeUndefined();
      expect(isEquipmentMemoryHuntRunState(stale)).toBe(false);
    }
  });

  it('fails immediately on the first target event failure and never recovers', () => {
    const initial = requireRunState();
    const failed = transitionEquipmentMemoryHuntEventOutcome(initial, initial.eventId, { success: false });
    expect(failed).toMatchObject({
      nodeCleared: false,
      eventSucceeded: false,
      status: 'failed',
      reason: 'event_failure'
    });
    expect(transitionEquipmentMemoryHuntNodeClear(failed, initial.nodeId)).toBe(failed);
    expect(transitionEquipmentMemoryHuntEventOutcome(failed, initial.eventId, { success: true })).toBe(failed);

    const nodeFirst = transitionEquipmentMemoryHuntNodeClear(initial, initial.nodeId);
    expect(transitionEquipmentMemoryHuntEventOutcome(
      nodeFirst,
      initial.eventId,
      { success: false }
    )).toMatchObject({
      nodeCleared: true,
      eventSucceeded: false,
      status: 'failed',
      reason: 'event_failure'
    });
  });

  it('settles successful exits once and fails incomplete successful exits', () => {
    const secured = secureRun();
    const settlement = settleEquipmentMemoryHuntRun(secured, 'successful_exit');
    expect(settlement).toMatchObject({ granted: true, state: { status: 'banked' } });
    expect(Object.isFrozen(settlement)).toBe(true);
    expect(Object.isFrozen(settlement.state)).toBe(true);

    const repeated = settleEquipmentMemoryHuntRun(settlement.state, 'successful_exit');
    expect(repeated).toEqual({ state: settlement.state, granted: false });
    expect(repeated.state).toBe(settlement.state);

    for (const active of [
      requireRunState(),
      transitionEquipmentMemoryHuntNodeClear(requireRunState(), requireRunState().nodeId),
      transitionEquipmentMemoryHuntEventOutcome(
        requireRunState(),
        requireRunState().eventId,
        { success: true }
      )
    ]) {
      expect(settleEquipmentMemoryHuntRun(active, 'successful_exit')).toMatchObject({
        granted: false,
        state: { status: 'failed', reason: 'incomplete_exit' }
      });
    }

    const prefailed = transitionEquipmentMemoryHuntEventOutcome(
      requireRunState(),
      requireRunState().eventId,
      { success: false }
    );
    const prefailedSettlement = settleEquipmentMemoryHuntRun(prefailed, 'successful_exit');
    expect(prefailedSettlement).toEqual({ state: prefailed, granted: false });
    expect(prefailedSettlement.state).toBe(prefailed);
  });

  it.each(['retreat', 'failure', 'cross_dungeon'] as const)(
    'marks active and secured hunts lost on %s without granting',
    (outcome) => {
      for (const state of [requireRunState(), secureRun()]) {
        const settlement = settleEquipmentMemoryHuntRun(state, outcome);
        expect(settlement).toMatchObject({
          granted: false,
          state: { status: 'lost', reason: outcome }
        });
      }

      const failed = transitionEquipmentMemoryHuntEventOutcome(
        requireRunState(),
        requireRunState().eventId,
        { success: false }
      );
      expect(settleEquipmentMemoryHuntRun(failed, outcome)).toEqual({ state: failed, granted: false });
    }
  );

  it('provides frozen progress and display values for UI without changing state', () => {
    const initial = requireRunState();
    expect(getEquipmentMemoryHuntProgress(initial)).toMatchObject({
      enabled: true,
      status: 'active',
      completedConditionCount: 0,
      totalConditionCount: 2,
      grantAvailable: false,
      granted: false,
      attunementId: initial.attunementId
    });
    expect(getEquipmentMemoryHuntDisplayStatus(initial).key).toBe('active');

    const secured = secureRun(initial);
    expect(getEquipmentMemoryHuntProgress(secured)).toMatchObject({
      completedConditionCount: 2,
      grantAvailable: true,
      granted: false
    });
    expect(getEquipmentMemoryHuntDisplayStatus(secured).key).toBe('secured');

    const banked = settleEquipmentMemoryHuntRun(secured, 'successful_exit').state;
    expect(getEquipmentMemoryHuntProgress(banked)).toMatchObject({ granted: true, grantAvailable: false });
    expect(getEquipmentMemoryHuntDisplayStatus(banked).key).toBe('banked');
    expect(getEquipmentMemoryHuntProgress({ invalid: true })).toMatchObject({
      enabled: false,
      status: 'disabled'
    });
    expect(getEquipmentMemoryHuntDisplayStatus({ invalid: true }).key).toBe('disabled');
    expect(Object.isFrozen(getEquipmentMemoryHuntProgress(initial))).toBe(true);
    expect(Object.isFrozen(getEquipmentMemoryHuntDisplayStatus(initial))).toBe(true);
  });
});

describe('equipment memory run snapshots', () => {
  it('freezes active equipped entries, ignores starters, and deduplicates equipment ids', () => {
    const snapshot = createMatchingSnapshot();
    expect(snapshot).toEqual({
      rulesVersion: 1,
      activeEntries: [
        {
          equipmentId: 'armor_piercing_sword',
          memoryId: 'equipment_memory_demon_tower_1'
        },
        {
          equipmentId: 'bone_spear',
          memoryId: 'equipment_memory_demon_tower_1'
        },
        {
          equipmentId: 'ember_staff',
          memoryId: 'equipment_memory_metro_abyss'
        }
      ]
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.activeEntries)).toBe(true);
    expect(snapshot.activeEntries.every(Object.isFrozen)).toBe(true);
    expect(isEquipmentMemoryRunSnapshot(snapshot)).toBe(true);
  });

  it('strictly creates and normalizes snapshots without admitting corrupt map state', () => {
    const snapshot = createMatchingSnapshot();
    const raw = {
      rulesVersion: 1,
      activeEntries: snapshot.activeEntries.map((entry) => ({ ...entry })).reverse()
    };
    const normalized = normalizeEquipmentMemoryRunSnapshot(raw);
    expect(normalized).toEqual(snapshot);
    expect(normalized).not.toBe(raw);
    expect(Object.isFrozen(normalized)).toBe(true);

    expect(createEquipmentMemoryRunSnapshot(['unknown_equipment'], {})).toBeUndefined();
    expect(createEquipmentMemoryRunSnapshot(['bone_spear'], {
      bone_spear: {
        unlockedIds: ['equipment_memory_demon_tower_1', 'equipment_memory_demon_tower_1']
      }
    })).toBeUndefined();
    expect(normalizeEquipmentMemoryRunSnapshot({
      activeEntries: snapshot.activeEntries
    })).toBeUndefined();
    expect(normalizeEquipmentMemoryRunSnapshot({
      ...snapshot,
      rulesVersion: 0
    })).toBeUndefined();
    expect(normalizeEquipmentMemoryRunSnapshot({
      rulesVersion: 1,
      activeEntries: [snapshot.activeEntries[0], snapshot.activeEntries[0]]
    })).toBeUndefined();
    expect(normalizeEquipmentMemoryRunSnapshot({
      rulesVersion: 1,
      activeEntries: [{ equipmentId: 'bone_spear', memoryId: 'unknown_memory' }]
    })).toBeUndefined();
    expect(normalizeEquipmentMemoryRunSnapshot({ ...snapshot, extra: true })).toBeUndefined();
  });

  it('allows multiple same-chapter entries while collapsing their combat effect to one', () => {
    const snapshot = createMatchingSnapshot();
    const towerEntries = listMatchingEquipmentMemorySnapshotEntries(snapshot, 'demon_tower_1');
    expect(towerEntries).toHaveLength(2);
    expect(Object.isFrozen(towerEntries)).toBe(true);
    expect(hasMatchingEquipmentMemory(snapshot, 'demon_tower_1')).toBe(true);
    expect(getEquipmentMemoryRunSnapshotMatch(snapshot, 'demon_tower_1')).toMatchObject({
      matched: true,
      effectCount: 1,
      entries: towerEntries
    });
    expect(getEquipmentMemoryRunSnapshotMatch(snapshot, 'metro_abyss')).toMatchObject({
      matched: true,
      effectCount: 1
    });
    expect(getEquipmentMemoryRunSnapshotMatch(snapshot, 'starfall_mine')).toMatchObject({
      matched: false,
      effectCount: 0,
      entries: []
    });
    expect(hasMatchingEquipmentMemory(undefined, 'demon_tower_1')).toBe(false);
    expect(getEquipmentMemoryRunSnapshotMatch(snapshot, 'unknown_dungeon')).toBeUndefined();
  });

  it('snapshots only active memories and keeps later hub changes out of the frozen run', () => {
    let memoryMap = unlockEquipmentMemory(
      EMPTY_EQUIPMENT_MEMORY_MAP,
      'bone_spear',
      'equipment_memory_demon_tower_1'
    );
    memoryMap = unlockEquipmentMemory(
      memoryMap,
      'bone_spear',
      'equipment_memory_metro_abyss'
    );
    const snapshot = createEquipmentMemoryRunSnapshot(['bone_spear'], memoryMap);
    expect(snapshot?.activeEntries[0]?.memoryId).toBe('equipment_memory_metro_abyss');

    const changedAtHub = activateEquipmentMemory(
      memoryMap,
      'bone_spear',
      'equipment_memory_demon_tower_1'
    );
    expect(changedAtHub.bone_spear?.activeId).toBe('equipment_memory_demon_tower_1');
    expect(snapshot?.activeEntries[0]?.memoryId).toBe('equipment_memory_metro_abyss');

    const noActive = normalizeEquipmentMemoryMap({
      bone_spear: { unlockedIds: ['equipment_memory_demon_tower_1'] }
    });
    expect(createEquipmentMemoryRunSnapshot(['bone_spear'], noActive)).toEqual({
      rulesVersion: 1,
      activeEntries: []
    });
  });
});

describe('equipment memory combat focus', () => {
  it('creates one combat state only for a matching chapter snapshot', () => {
    const snapshot = createMatchingSnapshot();
    const state = createEquipmentMemoryCombatState(snapshot, 'demon_tower_1');
    expect(state).toEqual({
      rulesVersion: 1,
      dungeonId: 'demon_tower_1',
      memoryId: 'equipment_memory_demon_tower_1',
      overflowFocus: 0,
      restored: false
    });
    expect(Object.isFrozen(state)).toBe(true);
    expect(createEquipmentMemoryCombatState(snapshot, 'starfall_mine')).toBeUndefined();
    expect(createEquipmentMemoryCombatState(undefined, 'demon_tower_1')).toBeUndefined();
    expect(normalizeEquipmentMemoryCombatState({ ...state })).toEqual(state);
    expect(normalizeEquipmentMemoryCombatState({
      dungeonId: state?.dungeonId,
      memoryId: state?.memoryId,
      overflowFocus: state?.overflowFocus,
      restored: state?.restored
    })).toBeUndefined();
    expect(normalizeEquipmentMemoryCombatState({ ...state, rulesVersion: 0 })).toBeUndefined();
    expect(normalizeEquipmentMemoryCombatState({ ...state, memoryId: 'equipment_memory_metro_abyss' })).toBeUndefined();
    expect(normalizeEquipmentMemoryCombatState({ ...state, overflowFocus: 2 })).toBeUndefined();
    expect(normalizeEquipmentMemoryCombatState({ ...state, overflowFocus: 1, restored: true })).toBeUndefined();
  });

  it('applies the standard overflow-focus effect to a Tier-11 equipment memory snapshot', () => {
    const memoryMap = unlockEquipmentMemory(
      EMPTY_EQUIPMENT_MEMORY_MAP,
      'homecoming_prism',
      'equipment_memory_mirror_cycle_city'
    );
    const snapshot = createEquipmentMemoryRunSnapshot(['homecoming_prism'], memoryMap);
    const state = createEquipmentMemoryCombatState(snapshot, 'mirror_cycle_city');
    const cappedGain = resolveCombatFocus({
      currentFocus: 3,
      action: 'attack',
      intent: REGULAR_INTENT,
      combatContinues: true
    });
    const stored = applyEquipmentMemoryCombatFocusResolution(state, cappedGain);
    const weaponSpend = resolveCombatFocus({
      currentFocus: 3,
      action: 'weapon_skill',
      intent: REGULAR_INTENT,
      combatContinues: true
    });
    const restored = applyEquipmentMemoryCombatFocusResolution(stored.state, weaponSpend);

    expect(snapshot).toEqual({
      rulesVersion: 1,
      activeEntries: [{
        equipmentId: 'homecoming_prism',
        memoryId: 'equipment_memory_mirror_cycle_city'
      }]
    });
    expect(state).toEqual({
      rulesVersion: 1,
      dungeonId: 'mirror_cycle_city',
      memoryId: 'equipment_memory_mirror_cycle_city',
      overflowFocus: 0,
      restored: false
    });
    expect(stored).toMatchObject({ stored: true, state: { overflowFocus: 1, restored: false } });
    expect(restored).toMatchObject({
      restored: true,
      state: { overflowFocus: 0, restored: true },
      resolution: { after: 1 }
    });
  });

  it('applies the standard overflow-focus effect to the required Tier-12 memory', () => {
    const memoryMap = unlockEquipmentMemory(
      EMPTY_EQUIPMENT_MEMORY_MAP,
      'final_proof_seal',
      'equipment_memory_redaction_scriptorium'
    );
    const snapshot = createEquipmentMemoryRunSnapshot(['final_proof_seal'], memoryMap);
    const state = createEquipmentMemoryCombatState(snapshot, 'redaction_scriptorium');
    const cappedGain = resolveCombatFocus({
      currentFocus: 3,
      action: 'attack',
      intent: REGULAR_INTENT,
      combatContinues: true
    });
    const stored = applyEquipmentMemoryCombatFocusResolution(state, cappedGain);
    const weaponSpend = resolveCombatFocus({
      currentFocus: 3,
      action: 'weapon_skill',
      intent: REGULAR_INTENT,
      combatContinues: true
    });
    const restored = applyEquipmentMemoryCombatFocusResolution(stored.state, weaponSpend);

    expect(state).toMatchObject({
      dungeonId: 'redaction_scriptorium',
      memoryId: 'equipment_memory_redaction_scriptorium',
      overflowFocus: 0,
      restored: false
    });
    expect(stored).toMatchObject({ stored: true, state: { overflowFocus: 1 } });
    expect(restored).toMatchObject({
      restored: true,
      state: { overflowFocus: 0, restored: true },
      resolution: { after: 1 }
    });
  });

  it('applies the standard overflow-focus effect to the required Tier-13 memory', () => {
    const memoryMap = unlockEquipmentMemory(
      EMPTY_EQUIPMENT_MEMORY_MAP,
      'final_lot_bell',
      'equipment_memory_legacy_auction_court'
    );
    const snapshot = createEquipmentMemoryRunSnapshot(['final_lot_bell'], memoryMap);
    const state = createEquipmentMemoryCombatState(snapshot, 'legacy_auction_court');
    const cappedGain = resolveCombatFocus({
      currentFocus: 3,
      action: 'attack',
      intent: REGULAR_INTENT,
      combatContinues: true
    });
    const stored = applyEquipmentMemoryCombatFocusResolution(state, cappedGain);
    const weaponSpend = resolveCombatFocus({
      currentFocus: 3,
      action: 'weapon_skill',
      intent: REGULAR_INTENT,
      combatContinues: true
    });
    const restored = applyEquipmentMemoryCombatFocusResolution(stored.state, weaponSpend);

    expect(state).toMatchObject({
      dungeonId: 'legacy_auction_court',
      memoryId: 'equipment_memory_legacy_auction_court',
      overflowFocus: 0,
      restored: false
    });
    expect(stored).toMatchObject({ stored: true, state: { overflowFocus: 1 } });
    expect(restored).toMatchObject({
      restored: true,
      state: { overflowFocus: 0, restored: true },
      resolution: { after: 1 }
    });
  });

  it('applies the unchanged active-memory focus effect to Tier-15 equipment', () => {
    const memoryMap = unlockEquipmentMemory(
      EMPTY_EQUIPMENT_MEMORY_MAP,
      'hushblade',
      'equipment_memory_silent_broadcast_tower'
    );
    const snapshot = createEquipmentMemoryRunSnapshot(['hushblade'], memoryMap);
    const state = createEquipmentMemoryCombatState(snapshot, 'silent_broadcast_tower');
    const cappedGain = resolveCombatFocus({
      currentFocus: 3,
      action: 'attack',
      intent: REGULAR_INTENT,
      combatContinues: true
    });
    const stored = applyEquipmentMemoryCombatFocusResolution(state, cappedGain);
    const weaponSpend = resolveCombatFocus({
      currentFocus: 3,
      action: 'weapon_skill',
      intent: REGULAR_INTENT,
      combatContinues: true
    });
    const restored = applyEquipmentMemoryCombatFocusResolution(stored.state, weaponSpend);

    expect(state).toMatchObject({
      dungeonId: 'silent_broadcast_tower',
      memoryId: 'equipment_memory_silent_broadcast_tower',
      overflowFocus: 0,
      restored: false
    });
    expect(stored).toMatchObject({ stored: true, state: { overflowFocus: 1 } });
    expect(restored).toMatchObject({
      restored: true,
      state: { overflowFocus: 0, restored: true },
      resolution: { after: 1 }
    });
  });

  it('applies the unchanged active-memory focus effect to Tier-16 equipment', () => {
    const memoryMap = unlockEquipmentMemory(
      EMPTY_EQUIPMENT_MEMORY_MAP,
      'rescue_carbine',
      'equipment_memory_lost_shelter'
    );
    const snapshot = createEquipmentMemoryRunSnapshot(['rescue_carbine'], memoryMap);
    const state = createEquipmentMemoryCombatState(snapshot, 'lost_shelter');
    const cappedGain = resolveCombatFocus({
      currentFocus: 3,
      action: 'attack',
      intent: REGULAR_INTENT,
      combatContinues: true
    });
    const stored = applyEquipmentMemoryCombatFocusResolution(state, cappedGain);
    const weaponSpend = resolveCombatFocus({
      currentFocus: 3,
      action: 'weapon_skill',
      intent: REGULAR_INTENT,
      combatContinues: true
    });
    const restored = applyEquipmentMemoryCombatFocusResolution(stored.state, weaponSpend);

    expect(state).toMatchObject({
      dungeonId: 'lost_shelter',
      memoryId: 'equipment_memory_lost_shelter',
      overflowFocus: 0,
      restored: false
    });
    expect(stored).toMatchObject({ stored: true, state: { overflowFocus: 1 } });
    expect(restored).toMatchObject({
      restored: true,
      state: { overflowFocus: 0, restored: true },
      resolution: { after: 1 }
    });
  });

  it('applies the unchanged active-memory focus effect to Tier-17 equipment', () => {
    const memoryMap = unlockEquipmentMemory(
      EMPTY_EQUIPMENT_MEMORY_MAP,
      'cross_examiner_sabre',
      'equipment_memory_false_testimony'
    );
    const snapshot = createEquipmentMemoryRunSnapshot(['cross_examiner_sabre'], memoryMap);
    const state = createEquipmentMemoryCombatState(snapshot, 'false_testimony_court');
    const cappedGain = resolveCombatFocus({
      currentFocus: 3,
      action: 'attack',
      intent: REGULAR_INTENT,
      combatContinues: true
    });
    const stored = applyEquipmentMemoryCombatFocusResolution(state, cappedGain);
    const weaponSpend = resolveCombatFocus({
      currentFocus: 3,
      action: 'weapon_skill',
      intent: REGULAR_INTENT,
      combatContinues: true
    });
    const restored = applyEquipmentMemoryCombatFocusResolution(stored.state, weaponSpend);

    expect(state).toMatchObject({
      dungeonId: 'false_testimony_court',
      memoryId: 'equipment_memory_false_testimony',
      overflowFocus: 0,
      restored: false
    });
    expect(stored).toMatchObject({ stored: true, state: { overflowFocus: 1 } });
    expect(restored).toMatchObject({
      restored: true,
      state: { overflowFocus: 0, restored: true },
      resolution: { after: 1 }
    });
  });

  it('stores regular-action overflow only when focus was already three', () => {
    const state = requireCombatState();
    const cappedGain = resolveCombatFocus({
      currentFocus: 3,
      action: 'attack',
      intent: REGULAR_INTENT,
      combatContinues: true
    });
    const stored = applyEquipmentMemoryCombatFocusResolution(state, cappedGain);
    expect(cappedGain).toMatchObject({ before: 3, after: 3, reason: 'regular-action-gain' });
    expect(stored).toMatchObject({
      stored: true,
      restored: false,
      state: { overflowFocus: 1, restored: false },
      resolution: cappedGain
    });
    expect(Object.isFrozen(stored)).toBe(true);
    expect(Object.isFrozen(stored.state)).toBe(true);
    expect(Object.isFrozen(stored.resolution)).toBe(true);

    const ordinaryGain = resolveCombatFocus({
      currentFocus: 2,
      action: 'attack',
      intent: REGULAR_INTENT,
      combatContinues: true
    });
    expect(applyEquipmentMemoryCombatFocusResolution(state, ordinaryGain)).toMatchObject({
      stored: false,
      state: { overflowFocus: 0 }
    });
  });

  it.each([2, 3])('stores recommended-action overflow when focus was %s', (before) => {
    const gain = resolveCombatFocus({
      currentFocus: before,
      action: 'guard',
      intent: RECOMMENDED_GUARD_INTENT,
      combatContinues: true
    });
    expect(gain.reason).toBe('recommended-action-gain');
    expect(applyEquipmentMemoryCombatFocusResolution(requireCombatState(), gain)).toMatchObject({
      stored: true,
      state: { overflowFocus: 1, restored: false }
    });
  });

  it('does not store recommended overflow below two focus', () => {
    const gain = resolveCombatFocus({
      currentFocus: 1,
      action: 'guard',
      intent: RECOMMENDED_GUARD_INTENT,
      combatContinues: true
    });
    expect(applyEquipmentMemoryCombatFocusResolution(requireCombatState(), gain)).toMatchObject({
      stored: false,
      state: { overflowFocus: 0, restored: false }
    });
  });

  it('restores focus from zero to one after a continuing weapon skill and only once', () => {
    const cappedGain = resolveCombatFocus({
      currentFocus: 3,
      action: 'attack',
      intent: REGULAR_INTENT,
      combatContinues: true
    });
    const stored = applyEquipmentMemoryCombatFocusResolution(requireCombatState(), cappedGain);
    const weaponSpend = resolveCombatFocus({
      currentFocus: 3,
      action: 'weapon_skill',
      intent: REGULAR_INTENT,
      combatContinues: true
    });
    const restored = applyEquipmentMemoryCombatFocusResolution(stored.state, weaponSpend);
    expect(weaponSpend).toMatchObject({
      before: 3,
      after: 0,
      delta: -3,
      reason: 'weapon-skill-spent',
      spent: true
    });
    expect(restored).toMatchObject({
      stored: false,
      restored: true,
      state: { overflowFocus: 0, restored: true },
      resolution: { before: 3, after: 1, delta: -2, readyAfter: false }
    });

    const noSecondStore = applyEquipmentMemoryCombatFocusResolution(restored.state, cappedGain);
    expect(noSecondStore).toMatchObject({
      stored: false,
      restored: false,
      state: { overflowFocus: 0, restored: true }
    });
    const noSecondRestore = applyEquipmentMemoryCombatFocusResolution(noSecondStore.state, weaponSpend);
    expect(noSecondRestore).toMatchObject({
      restored: false,
      resolution: { after: 0 },
      state: { restored: true }
    });
  });

  it('does not restore when combat ends or when no matching combat state exists', () => {
    const cappedGain = resolveCombatFocus({
      currentFocus: 3,
      action: 'attack',
      intent: REGULAR_INTENT,
      combatContinues: true
    });
    const stored = applyEquipmentMemoryCombatFocusResolution(requireCombatState(), cappedGain);
    const weaponSpend = resolveCombatFocus({
      currentFocus: 3,
      action: 'weapon_skill',
      intent: REGULAR_INTENT,
      combatContinues: true
    });
    expect(applyEquipmentMemoryCombatFocusResolution(stored.state, weaponSpend, false)).toMatchObject({
      restored: false,
      resolution: { after: 0 },
      state: { overflowFocus: 1, restored: false }
    });

    const noMemory = applyEquipmentMemoryCombatFocusResolution(undefined, cappedGain);
    expect(noMemory).toMatchObject({
      state: undefined,
      stored: false,
      restored: false,
      resolution: cappedGain
    });
  });
});
