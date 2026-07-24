import type { CombatFocusResolution } from './combat-focus';
import type { EquipmentAttunementId } from './equipment-system';
import type { DungeonId, EquipmentId } from './game';

export const EQUIPMENT_MEMORY_RULES_VERSION = 1 as const;

export type EquipmentMemoryId =
  | 'equipment_memory_demon_tower_1'
  | 'equipment_memory_metro_abyss'
  | 'equipment_memory_starfall_mine'
  | 'equipment_memory_rust_hospital'
  | 'equipment_memory_ash_arena'
  | 'equipment_memory_dream_archive'
  | 'equipment_memory_void_citadel'
  | 'equipment_memory_temporal_observatory'
  | 'equipment_memory_causal_clearinghouse'
  | 'equipment_memory_entropy_ark'
  | 'equipment_memory_mirror_cycle_city'
  | 'equipment_memory_redaction_scriptorium'
  | 'equipment_memory_legacy_auction_court'
  | 'equipment_memory_genesis_vault'
  | 'equipment_memory_silent_broadcast_tower'
  | 'equipment_memory_lost_shelter'
  | 'equipment_memory_false_testimony'
  | 'equipment_memory_combat_replay_stage'
  | 'equipment_memory_panopticon_city';

export type EquipmentMemoryEquipmentId =
  | 'armor_piercing_sword'
  | 'bone_spear'
  | 'ember_staff'
  | 'mist_hood'
  | 'spirit_robe'
  | 'guardian_plate'
  | 'guardian_gauntlets'
  | 'cloudstep_boots'
  | 'rift_belt'
  | 'cloudstep_charm'
  | 'rift_charm'
  | 'starforged_edge'
  | 'void_lantern'
  | 'chronal_edge'
  | 'chronal_aegis'
  | 'chronal_lens'
  | 'causal_visor'
  | 'echo_breaker_gauntlets'
  | 'return_anchor_belt'
  | 'entropy_compass'
  | 'dissipation_mantle'
  | 'ark_keel_boots'
  | 'parallax_visor'
  | 'phaseweave_mantle'
  | 'homecoming_prism'
  | 'redline_edge'
  | 'palimpsest_mantle'
  | 'final_proof_seal'
  | 'legacy_gavel'
  | 'anonymous_veil'
  | 'escrow_plate'
  | 'final_lot_bell'
  | 'helix_cleaver'
  | 'symbiote_cowl'
  | 'carapace_harness'
  | 'rebirth_amulet'
  | 'hushblade'
  | 'dead_air_headset'
  | 'anechoic_mantle'
  | 'last_channel_beacon'
  | 'rescue_carbine'
  | 'triage_visor'
  | 'evacuation_plate'
  | 'blackbox_beacon'
  | 'cross_examiner_sabre'
  | 'forensic_visor'
  | 'custody_shell'
  | 'appeal_seal'
  | 'frame_engraver'
  | 'cue_visor'
  | 'buffer_plate'
  | 'thaw_metronome'
  | 'blindline_cutter'
  | 'predictive_visor'
  | 'matte_shell'
  | 'inverse_prism';

export type EquipmentMemoryDefinition = Readonly<{
  id: EquipmentMemoryId;
  dungeonId: DungeonId;
  name: string;
  description: string;
  effectDescription: string;
  eventId: string;
  nodeId: string;
}>;

function defineMemory(
  id: EquipmentMemoryId,
  dungeonId: DungeonId,
  name: string,
  description: string,
  effectDescription: string,
  eventId: string,
  nodeId: string
): EquipmentMemoryDefinition {
  return Object.freeze({ id, dungeonId, name, description, effectDescription, eventId, nodeId });
}

export const EQUIPMENT_MEMORY_CATALOG = Object.freeze([
  defineMemory(
    'equipment_memory_demon_tower_1',
    'demon_tower_1',
    '血阶余息',
    '血字阶梯留下的呼吸余韵，能把战意满溢的一瞬暂时铭在装备上。',
    '妖塔战斗中可暂存 1 点溢出战意，并在下一次武器技能后恢复 1 点战意。',
    'blood_rune_stair',
    'blood_rune_trap'
  ),
  defineMemory(
    'equipment_memory_metro_abyss',
    'metro_abyss',
    '镜潮借路',
    '镜潮退去前留下的一线倒影，让装备记住战意本应流向的位置。',
    '地铁深渊战斗中可暂存 1 点溢出战意，并在下一次武器技能后恢复 1 点战意。',
    'mirror_tide_crossing',
    'mirror_tide_trap'
  ),
  defineMemory(
    'equipment_memory_starfall_mine',
    'starfall_mine',
    '线圈余鸣',
    '爆鸣线圈熄灭后的残余共振，会替持有者留住一次过载冲动。',
    '星坠矿井战斗中可暂存 1 点溢出战意，并在下一次武器技能后恢复 1 点战意。',
    'coil_resonance_salvage',
    'coil_burst_trap'
  ),
  defineMemory(
    'equipment_memory_rust_hospital',
    'rust_hospital',
    '无菌复诊',
    '无菌灯校准后的冷白回光，把一次过量战意封存在复诊刻度里。',
    '锈蚀医院战斗中可暂存 1 点溢出战意，并在下一次武器技能后恢复 1 点战意。',
    'sterile_light_calibration',
    'sterile_corridor'
  ),
  defineMemory(
    'equipment_memory_ash_arena',
    'ash_arena',
    '火线改判',
    '裁决火线逆转时留下的判词，允许装备改写一次战意结算。',
    '灰烬斗技场战斗中可暂存 1 点溢出战意，并在下一次武器技能后恢复 1 点战意。',
    'judgement_line_reversal',
    'judgement_flame'
  ),
  defineMemory(
    'equipment_memory_dream_archive',
    'dream_archive',
    '缺息回环',
    '缺失的一次呼吸被梦境首尾相接，替装备保存本应消散的战意。',
    '梦境档案馆战斗中可暂存 1 点溢出战意，并在下一次武器技能后恢复 1 点战意。',
    'missing_breath_corridor',
    'memory_loop_trap'
  ),
  defineMemory(
    'equipment_memory_void_citadel',
    'void_citadel',
    '身份重组',
    '身份陷阱拆解后的空白片段，能为战意保留一个临时位置。',
    '虚空城塞战斗中可暂存 1 点溢出战意，并在下一次武器技能后恢复 1 点战意。',
    'identity_reassembly',
    'identity_trap'
  ),
  defineMemory(
    'equipment_memory_temporal_observatory',
    'temporal_observatory',
    '零时预演',
    '未来校准锚回传的一次预演，让装备提前记住即将溢出的战意。',
    '时序观测庭战斗中可暂存 1 点溢出战意，并在下一次武器技能后恢复 1 点战意。',
    'future_calibration_echo',
    'future_calibration_anchor'
  ),
  defineMemory(
    'equipment_memory_causal_clearinghouse',
    'causal_clearinghouse',
    '因果倒账',
    '逆转债务流水后留下的倒账凭证，让装备记住一次本应被追缴的战意。',
    '因果清算所战斗中可暂存 1 点溢出战意，并在下一次武器技能后恢复 1 点战意。',
    'causal_debt_reversal',
    'effect_deposition'
  ),
  defineMemory(
    'equipment_memory_entropy_ark',
    'entropy_ark',
    '熵潮余航',
    '航迹逆转后留下的一段余航，让装备记住本应被耗散抹去的战意。',
    '熵舱方舟战斗中可暂存 1 点溢出战意，并在下一次武器技能后恢复 1 点战意。',
    'entropy_wake_inversion',
    'starboard_ballast_core'
  ),
  defineMemory(
    'equipment_memory_mirror_cycle_city',
    'mirror_cycle_city',
    '双相自证',
    '身份排演后留下的双相证词，让装备在现实与镜像之间记住同一次战意回响。',
    '镜海轮回城战斗中可暂存 1 点溢出战意，并在下一次武器技能后恢复 1 点战意。',
    'identity_rehearsal',
    'mirror_anchor'
  ),
  defineMemory(
    'equipment_memory_redaction_scriptorium',
    'redaction_scriptorium',
    '未删句',
    '终稿证词中幸存的一句原文，让装备记住删改前溢出的战意。',
    '删界终稿院战斗中可暂存 1 点溢出战意，并在下一次武器技能后恢复 1 点战意。',
    'palimpsest_testimony',
    'final_proof_nexus'
  ),
  defineMemory(
    'equipment_memory_legacy_auction_court',
    'legacy_auction_court',
    '未落之槌',
    '死队证词落槌前留下的一次未决举牌，让装备记住未能成交的战意。',
    '亡队遗产拍卖庭战斗中可暂存 1 点溢出战意，并在下一次武器技能后恢复 1 点战意。',
    'dead_team_testimony',
    'provenance_event_stage'
  ),
  defineMemory(
    'equipment_memory_genesis_vault',
    'genesis_vault',
    '未定之祖',
    '祖先回声没有宣告唯一血统，只让装备记住每次主动选择：原型不是出身，而是仍可重写的决定。',
    '众生原型库战斗中可暂存 1 点溢出战意，并在下一次武器技能后恢复 1 点战意；这份回响名为「未定之祖」。',
    'ancestor_echo',
    'mosaic_gene_vault'
  ),
  defineMemory(
    'equipment_memory_silent_broadcast_tower',
    'silent_broadcast_tower',
    '最后一段人声',
    '广播里最后留下的不是求救，而是有人确认队友仍然活着；这段人声让装备记住战意没有被寂静吞没。',
    '寂声广播塔战斗中可暂存 1 点溢出战意，并在下一次武器技能后恢复 1 点战意。',
    'last_broadcast',
    'broadcast_memory_stage'
  ),
  defineMemory(
    'equipment_memory_lost_shelter',
    'lost_shelter',
    '仍有人回应',
    '点名册最后不是死亡名单，而是有人持续回应同伴姓名；这份回应让装备记住战意从未中断。',
    '失联避难所战斗中可暂存 1 点溢出战意，并在下一次武器技能后恢复 1 点战意。',
    'last_roll_call',
    'survivor_memory_stage'
  ),
  defineMemory(
    'equipment_memory_false_testimony',
    'false_testimony_court',
    '证词之外',
    '真正的证词不是某个人说了什么，而是三份互不相识的证据仍指向同一处空白。',
    '伪证裁定庭战斗中可暂存 1 点溢出战意，并在下一次武器技能后恢复 1 点战意。',
    'sealed_deposition',
    'cross_exam_stage'
  ),
  defineMemory(
    'equipment_memory_combat_replay_stage',
    'combat_replay_stage',
    '镜头以外',
    '最后一次重拍结束后，镜头以外仍有人在完成那场战斗；装备记住了没有被剪辑留下的战意。',
    '战痕复演场战斗中可暂存 1 点溢出战意，并在下一次武器技能后恢复 1 点战意。',
    'last_retake',
    'script_projection_stage'
  ),
  defineMemory(
    'equipment_memory_panopticon_city',
    'panopticon_city',
    '视界之外',
    '盲区剧场证明天幕只能记录被允许进入视界的行动；逆向观测台则让装备记住那条从未被监察承认的真实轨迹。',
    '天幕监察城战斗中可暂存 1 点溢出战意，并在下一次武器技能后恢复 1 点战意。',
    'blindspot_theater',
    'inverse_observation_stage'
  )
] as const) satisfies readonly EquipmentMemoryDefinition[];

export const EQUIPMENT_MEMORY_EQUIPMENT_CATALOG = Object.freeze([
  'armor_piercing_sword',
  'bone_spear',
  'ember_staff',
  'mist_hood',
  'spirit_robe',
  'guardian_plate',
  'guardian_gauntlets',
  'cloudstep_boots',
  'rift_belt',
  'cloudstep_charm',
  'rift_charm',
  'starforged_edge',
  'void_lantern',
  'chronal_edge',
  'chronal_aegis',
  'chronal_lens',
  'causal_visor',
  'echo_breaker_gauntlets',
  'return_anchor_belt',
  'entropy_compass',
  'dissipation_mantle',
  'ark_keel_boots',
  'parallax_visor',
  'phaseweave_mantle',
  'homecoming_prism',
  'redline_edge',
  'palimpsest_mantle',
  'final_proof_seal',
  'legacy_gavel',
  'anonymous_veil',
  'escrow_plate',
  'final_lot_bell',
  'helix_cleaver',
  'symbiote_cowl',
  'carapace_harness',
  'rebirth_amulet',
  'hushblade',
  'dead_air_headset',
  'anechoic_mantle',
  'last_channel_beacon',
  'rescue_carbine',
  'triage_visor',
  'evacuation_plate',
  'blackbox_beacon',
  'cross_examiner_sabre',
  'forensic_visor',
  'custody_shell',
  'appeal_seal',
  'frame_engraver',
  'cue_visor',
  'buffer_plate',
  'thaw_metronome',
  'blindline_cutter',
  'predictive_visor',
  'matte_shell',
  'inverse_prism'
] as const) satisfies readonly EquipmentMemoryEquipmentId[];

export const EQUIPMENT_MEMORY_ATTUNEMENT_IDS = Object.freeze([
  'mist_vanguard',
  'mist_veilguard',
  'forge_overdrive',
  'forge_channeling',
  'rift_resonance',
  'rift_anchor',
  'chronal_acceleration',
  'chronal_stasis'
] as const) satisfies readonly EquipmentAttunementId[];

export const EQUIPMENT_MEMORY_HUNT_COMBINATION_COUNT = 1064 as const;

const EQUIPMENT_MEMORY_IDS = Object.freeze(
  EQUIPMENT_MEMORY_CATALOG.map((definition) => definition.id)
) as readonly EquipmentMemoryId[];
const MEMORY_BY_ID = new Map(EQUIPMENT_MEMORY_CATALOG.map((definition) => [definition.id, definition]));
const MEMORY_BY_DUNGEON = new Map(
  EQUIPMENT_MEMORY_CATALOG.map((definition) => [definition.dungeonId, definition])
);
const MEMORY_EQUIPMENT_IDS = new Set<EquipmentId>(EQUIPMENT_MEMORY_EQUIPMENT_CATALOG);
const ATTUNEMENT_IDS = new Set<EquipmentAttunementId>(EQUIPMENT_MEMORY_ATTUNEMENT_IDS);

const INITIAL_EQUIPMENT_IDS = Object.freeze([
  'training_blade',
  'patched_headwrap',
  'patched_coat',
  'patched_gloves',
  'patched_boots',
  'patched_belt',
  'plain_charm'
] as const) satisfies readonly EquipmentId[];
const ALL_EQUIPMENT_IDS = new Set<EquipmentId>([
  ...INITIAL_EQUIPMENT_IDS,
  ...EQUIPMENT_MEMORY_EQUIPMENT_CATALOG
]);

const EMPTY_MEMORY_DEFINITIONS: readonly EquipmentMemoryDefinition[] = Object.freeze([]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const actualKeys = Object.keys(value);
  return actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function isEquipmentMemoryId(value: unknown): value is EquipmentMemoryId {
  return typeof value === 'string' && MEMORY_BY_ID.has(value as EquipmentMemoryId);
}

export function isEquipmentMemoryEquipmentId(value: unknown): value is EquipmentMemoryEquipmentId {
  return typeof value === 'string' && MEMORY_EQUIPMENT_IDS.has(value as EquipmentId);
}

export function isEquipmentMemoryAttunementId(value: unknown): value is EquipmentAttunementId {
  return typeof value === 'string' && ATTUNEMENT_IDS.has(value as EquipmentAttunementId);
}

export function listEquipmentMemories(): readonly EquipmentMemoryDefinition[] {
  return EQUIPMENT_MEMORY_CATALOG;
}

export function listEquipmentMemoryEquipmentIds(): readonly EquipmentMemoryEquipmentId[] {
  return EQUIPMENT_MEMORY_EQUIPMENT_CATALOG;
}

export function getEquipmentMemoryById(memoryId: unknown): EquipmentMemoryDefinition | undefined {
  return isEquipmentMemoryId(memoryId) ? MEMORY_BY_ID.get(memoryId) : undefined;
}

export function getEquipmentMemoryForDungeon(dungeonId: unknown): EquipmentMemoryDefinition | undefined {
  return typeof dungeonId === 'string'
    ? MEMORY_BY_DUNGEON.get(dungeonId as DungeonId)
    : undefined;
}

export function listEquipmentMemoriesForDungeon(
  dungeonId: unknown
): readonly EquipmentMemoryDefinition[] {
  const definition = getEquipmentMemoryForDungeon(dungeonId);
  return definition ? Object.freeze([definition]) : EMPTY_MEMORY_DEFINITIONS;
}

export type PreparedEquipmentMemoryHunt = Readonly<{
  dungeonId: DungeonId;
  equipmentId: EquipmentMemoryEquipmentId;
  memoryId: EquipmentMemoryId;
}>;

function freezePreparedEquipmentMemoryHunt(
  dungeonId: DungeonId,
  equipmentId: EquipmentMemoryEquipmentId,
  memoryId: EquipmentMemoryId
): PreparedEquipmentMemoryHunt {
  return Object.freeze({ dungeonId, equipmentId, memoryId });
}

export function createPreparedEquipmentMemoryHunt(
  dungeonId: unknown,
  equipmentId: unknown,
  memoryId: unknown
): PreparedEquipmentMemoryHunt | undefined {
  const definition = getEquipmentMemoryForDungeon(dungeonId);
  if (!definition || !isEquipmentMemoryEquipmentId(equipmentId) || memoryId !== definition.id) {
    return undefined;
  }
  return freezePreparedEquipmentMemoryHunt(definition.dungeonId, equipmentId, definition.id);
}

export function normalizePreparedEquipmentMemoryHunt(
  value: unknown
): PreparedEquipmentMemoryHunt | undefined {
  if (!isRecord(value) || !hasExactKeys(value, ['dungeonId', 'equipmentId', 'memoryId'])) {
    return undefined;
  }
  return createPreparedEquipmentMemoryHunt(value.dungeonId, value.equipmentId, value.memoryId);
}

export function isPreparedEquipmentMemoryHunt(value: unknown): value is PreparedEquipmentMemoryHunt {
  return normalizePreparedEquipmentMemoryHunt(value) !== undefined;
}

export const EQUIPMENT_MEMORY_HUNT_CATALOG = Object.freeze(
  EQUIPMENT_MEMORY_CATALOG.flatMap((definition) => {
    return EQUIPMENT_MEMORY_EQUIPMENT_CATALOG.map((equipmentId) => {
      return freezePreparedEquipmentMemoryHunt(definition.dungeonId, equipmentId, definition.id);
    });
  })
) satisfies readonly PreparedEquipmentMemoryHunt[];

export function listPreparedEquipmentMemoryHunts(
  dungeonId?: unknown
): readonly PreparedEquipmentMemoryHunt[] {
  if (dungeonId === undefined) return EQUIPMENT_MEMORY_HUNT_CATALOG;
  const definition = getEquipmentMemoryForDungeon(dungeonId);
  if (!definition) return Object.freeze([]);
  return Object.freeze(
    EQUIPMENT_MEMORY_HUNT_CATALOG.filter((prepared) => prepared.dungeonId === definition.dungeonId)
  );
}

export function getPreparedEquipmentMemoryHunt(
  dungeonId: unknown,
  equipmentId: unknown,
  memoryId: unknown
): PreparedEquipmentMemoryHunt | undefined {
  const normalized = createPreparedEquipmentMemoryHunt(dungeonId, equipmentId, memoryId);
  if (!normalized) return undefined;
  return EQUIPMENT_MEMORY_HUNT_CATALOG.find((prepared) => {
    return prepared.dungeonId === normalized.dungeonId &&
      prepared.equipmentId === normalized.equipmentId;
  });
}

export type EquipmentMemoryEntry = Readonly<{
  unlockedIds: readonly EquipmentMemoryId[];
  activeId?: EquipmentMemoryId;
}>;

export type EquipmentMemoryMap = Readonly<Partial<Record<EquipmentId, EquipmentMemoryEntry>>>;

export const EMPTY_EQUIPMENT_MEMORY_MAP: EquipmentMemoryMap = Object.freeze({});

function freezeMemoryEntry(
  unlockedIds: readonly EquipmentMemoryId[],
  activeId?: EquipmentMemoryId
): EquipmentMemoryEntry {
  return Object.freeze({
    unlockedIds: Object.freeze([...unlockedIds]),
    ...(activeId === undefined ? {} : { activeId })
  });
}

function freezeMemoryMap(
  entries: Readonly<Partial<Record<EquipmentMemoryEquipmentId, EquipmentMemoryEntry>>>
): EquipmentMemoryMap {
  const ordered: Partial<Record<EquipmentId, EquipmentMemoryEntry>> = {};
  for (const equipmentId of EQUIPMENT_MEMORY_EQUIPMENT_CATALOG) {
    const entry = entries[equipmentId];
    if (entry) ordered[equipmentId] = entry;
  }
  return Object.freeze(ordered);
}

function orderMemoryIds(memoryIds: ReadonlySet<EquipmentMemoryId>): readonly EquipmentMemoryId[] {
  return EQUIPMENT_MEMORY_IDS.filter((memoryId) => memoryIds.has(memoryId));
}

/** Strictly validates the whole persisted map; one malformed entry rejects the value. */
export function normalizeEquipmentMemoryMap(value: unknown): EquipmentMemoryMap | undefined {
  if (!isRecord(value)) return undefined;
  if (Object.keys(value).some((equipmentId) => !isEquipmentMemoryEquipmentId(equipmentId))) {
    return undefined;
  }

  const normalized: Partial<Record<EquipmentMemoryEquipmentId, EquipmentMemoryEntry>> = {};
  for (const equipmentId of EQUIPMENT_MEMORY_EQUIPMENT_CATALOG) {
    if (!hasOwn(value, equipmentId)) continue;
    const rawEntry = value[equipmentId];
    if (!isRecord(rawEntry)) return undefined;

    const hasActiveId = hasOwn(rawEntry, 'activeId');
    const expectedKeys = hasActiveId ? ['unlockedIds', 'activeId'] : ['unlockedIds'];
    if (!hasExactKeys(rawEntry, expectedKeys) || !Array.isArray(rawEntry.unlockedIds)) {
      return undefined;
    }

    const unlockedIds = new Set<EquipmentMemoryId>();
    for (const memoryId of rawEntry.unlockedIds) {
      if (!isEquipmentMemoryId(memoryId) || unlockedIds.has(memoryId)) return undefined;
      unlockedIds.add(memoryId);
    }

    let activeId: EquipmentMemoryId | undefined;
    if (hasActiveId) {
      if (!isEquipmentMemoryId(rawEntry.activeId) || !unlockedIds.has(rawEntry.activeId)) {
        return undefined;
      }
      activeId = rawEntry.activeId;
    }

    if (unlockedIds.size > 0) {
      normalized[equipmentId] = freezeMemoryEntry(orderMemoryIds(unlockedIds), activeId);
    }
  }
  return freezeMemoryMap(normalized);
}

/** Repairs entries independently so corrupt save data cannot discard another equipment's memories. */
export function sanitizeEquipmentMemoryMap(value: unknown): EquipmentMemoryMap {
  if (!isRecord(value)) return EMPTY_EQUIPMENT_MEMORY_MAP;

  const sanitized: Partial<Record<EquipmentMemoryEquipmentId, EquipmentMemoryEntry>> = {};
  for (const equipmentId of EQUIPMENT_MEMORY_EQUIPMENT_CATALOG) {
    const rawEntry = value[equipmentId];
    if (!isRecord(rawEntry) || !Array.isArray(rawEntry.unlockedIds)) continue;

    const unlockedIds = new Set<EquipmentMemoryId>();
    for (const memoryId of rawEntry.unlockedIds) {
      if (isEquipmentMemoryId(memoryId)) unlockedIds.add(memoryId);
    }
    if (unlockedIds.size === 0) continue;

    const activeId = isEquipmentMemoryId(rawEntry.activeId) && unlockedIds.has(rawEntry.activeId)
      ? rawEntry.activeId
      : undefined;
    sanitized[equipmentId] = freezeMemoryEntry(orderMemoryIds(unlockedIds), activeId);
  }
  return freezeMemoryMap(sanitized);
}

export const normalizeEquipmentMemoryMapStrict = normalizeEquipmentMemoryMap;
export const safeNormalizeEquipmentMemoryMap = sanitizeEquipmentMemoryMap;

function isDeeplyFrozenMemoryMap(value: EquipmentMemoryMap): boolean {
  return Object.isFrozen(value) && EQUIPMENT_MEMORY_EQUIPMENT_CATALOG.every((equipmentId) => {
    const entry = value[equipmentId];
    return !entry || (Object.isFrozen(entry) && Object.isFrozen(entry.unlockedIds));
  });
}

function stableSanitizedMemoryMap(value: unknown): EquipmentMemoryMap {
  const strict = normalizeEquipmentMemoryMap(value);
  if (strict && isDeeplyFrozenMemoryMap(value as EquipmentMemoryMap)) {
    return value as EquipmentMemoryMap;
  }
  return strict ?? sanitizeEquipmentMemoryMap(value);
}

function replaceMemoryEntry(
  memoryMap: EquipmentMemoryMap,
  equipmentId: EquipmentMemoryEquipmentId,
  entry: EquipmentMemoryEntry
): EquipmentMemoryMap {
  const entries: Partial<Record<EquipmentMemoryEquipmentId, EquipmentMemoryEntry>> = {};
  for (const candidateId of EQUIPMENT_MEMORY_EQUIPMENT_CATALOG) {
    const candidate = candidateId === equipmentId ? entry : memoryMap[candidateId];
    if (candidate) entries[candidateId] = candidate;
  }
  return freezeMemoryMap(entries);
}

export function unlockEquipmentMemory(
  value: unknown,
  equipmentId: unknown,
  memoryId: unknown
): EquipmentMemoryMap {
  const memoryMap = stableSanitizedMemoryMap(value);
  if (!isEquipmentMemoryEquipmentId(equipmentId) || !isEquipmentMemoryId(memoryId)) {
    return memoryMap;
  }

  const current = memoryMap[equipmentId];
  const unlockedIds = new Set(current?.unlockedIds ?? []);
  unlockedIds.add(memoryId);
  if (current?.activeId === memoryId && unlockedIds.size === current.unlockedIds.length) {
    return memoryMap;
  }
  return replaceMemoryEntry(
    memoryMap,
    equipmentId,
    freezeMemoryEntry(orderMemoryIds(unlockedIds), memoryId)
  );
}

export function activateEquipmentMemory(
  value: unknown,
  equipmentId: unknown,
  memoryId: unknown
): EquipmentMemoryMap {
  const memoryMap = stableSanitizedMemoryMap(value);
  if (!isEquipmentMemoryEquipmentId(equipmentId) || !isEquipmentMemoryId(memoryId)) {
    return memoryMap;
  }

  const current = memoryMap[equipmentId];
  if (!current || !current.unlockedIds.includes(memoryId) || current.activeId === memoryId) {
    return memoryMap;
  }
  return replaceMemoryEntry(
    memoryMap,
    equipmentId,
    freezeMemoryEntry(current.unlockedIds, memoryId)
  );
}

export type EquipmentMemoryHuntStatus = 'active' | 'secured' | 'failed' | 'lost' | 'banked';
export type EquipmentMemoryHuntFailureReason = 'event_failure' | 'incomplete_exit';
export type EquipmentMemoryHuntLossReason = 'retreat' | 'failure' | 'cross_dungeon';
export type EquipmentMemoryHuntReason = EquipmentMemoryHuntFailureReason | EquipmentMemoryHuntLossReason;
export type EquipmentMemoryHuntRunOutcome = 'successful_exit' | EquipmentMemoryHuntLossReason;

export type EquipmentMemoryHuntRunState = Readonly<{
  rulesVersion: typeof EQUIPMENT_MEMORY_RULES_VERSION;
  dungeonId: DungeonId;
  equipmentId: EquipmentMemoryEquipmentId;
  memoryId: EquipmentMemoryId;
  attunementId: EquipmentAttunementId;
  eventId: string;
  nodeId: string;
  nodeCleared: boolean;
  eventSucceeded: boolean;
  status: EquipmentMemoryHuntStatus;
  reason?: EquipmentMemoryHuntReason;
}>;

function freezeHuntRunState(
  prepared: PreparedEquipmentMemoryHunt,
  attunementId: EquipmentAttunementId,
  nodeCleared: boolean,
  eventSucceeded: boolean,
  status: EquipmentMemoryHuntStatus,
  reason?: EquipmentMemoryHuntReason
): EquipmentMemoryHuntRunState {
  const definition = MEMORY_BY_ID.get(prepared.memoryId);
  if (!definition) throw new Error(`Missing equipment memory definition ${prepared.memoryId}.`);
  return Object.freeze({
    rulesVersion: EQUIPMENT_MEMORY_RULES_VERSION,
    dungeonId: prepared.dungeonId,
    equipmentId: prepared.equipmentId,
    memoryId: prepared.memoryId,
    attunementId,
    eventId: definition.eventId,
    nodeId: definition.nodeId,
    nodeCleared,
    eventSucceeded,
    status,
    ...(reason === undefined ? {} : { reason })
  });
}

export function createEquipmentMemoryHuntRunState(
  prepared: unknown,
  attunementId: unknown
): EquipmentMemoryHuntRunState | undefined {
  const normalized = normalizePreparedEquipmentMemoryHunt(prepared);
  if (!normalized || !isEquipmentMemoryAttunementId(attunementId)) return undefined;
  return freezeHuntRunState(normalized, attunementId, false, false, 'active');
}

function isValidHuntStateCombination(
  status: EquipmentMemoryHuntStatus,
  nodeCleared: boolean,
  eventSucceeded: boolean,
  reason: unknown
): reason is EquipmentMemoryHuntReason | undefined {
  if (status === 'active') return !(nodeCleared && eventSucceeded) && reason === undefined;
  if (status === 'secured' || status === 'banked') {
    return nodeCleared && eventSucceeded && reason === undefined;
  }
  if (status === 'failed') {
    if (reason === 'event_failure') return !eventSucceeded;
    return reason === 'incomplete_exit' && !(nodeCleared && eventSucceeded);
  }
  return reason === 'retreat' || reason === 'failure' || reason === 'cross_dungeon';
}

export function normalizeEquipmentMemoryHuntRunState(
  value: unknown
): EquipmentMemoryHuntRunState | undefined {
  if (!isRecord(value) || value.rulesVersion !== EQUIPMENT_MEMORY_RULES_VERSION) return undefined;
  if (value.status !== 'active' && value.status !== 'secured' && value.status !== 'failed' &&
    value.status !== 'lost' && value.status !== 'banked') {
    return undefined;
  }

  const expectsReason = value.status === 'failed' || value.status === 'lost';
  const expectedKeys = [
    'rulesVersion',
    'dungeonId',
    'equipmentId',
    'memoryId',
    'attunementId',
    'eventId',
    'nodeId',
    'nodeCleared',
    'eventSucceeded',
    'status',
    ...(expectsReason ? ['reason'] : [])
  ];
  if (!hasExactKeys(value, expectedKeys)) return undefined;

  const prepared = createPreparedEquipmentMemoryHunt(
    value.dungeonId,
    value.equipmentId,
    value.memoryId
  );
  const definition = prepared ? MEMORY_BY_ID.get(prepared.memoryId) : undefined;
  if (!prepared || !definition || !isEquipmentMemoryAttunementId(value.attunementId)) {
    return undefined;
  }
  if (value.eventId !== definition.eventId || value.nodeId !== definition.nodeId ||
    typeof value.nodeCleared !== 'boolean' || typeof value.eventSucceeded !== 'boolean') {
    return undefined;
  }
  if (!isValidHuntStateCombination(
    value.status,
    value.nodeCleared,
    value.eventSucceeded,
    value.reason
  )) {
    return undefined;
  }

  return freezeHuntRunState(
    prepared,
    value.attunementId,
    value.nodeCleared,
    value.eventSucceeded,
    value.status,
    value.reason
  );
}

export function isEquipmentMemoryHuntRunState(value: unknown): value is EquipmentMemoryHuntRunState {
  return normalizeEquipmentMemoryHuntRunState(value) !== undefined;
}

function stableHuntRunState(value: unknown): EquipmentMemoryHuntRunState | undefined {
  const normalized = normalizeEquipmentMemoryHuntRunState(value);
  if (!normalized) return undefined;
  return Object.isFrozen(value) ? value as EquipmentMemoryHuntRunState : normalized;
}

function transitionHuntProgress(
  state: EquipmentMemoryHuntRunState,
  nodeCleared: boolean,
  eventSucceeded: boolean
): EquipmentMemoryHuntRunState {
  const prepared = freezePreparedEquipmentMemoryHunt(
    state.dungeonId,
    state.equipmentId,
    state.memoryId
  );
  return freezeHuntRunState(
    prepared,
    state.attunementId,
    nodeCleared,
    eventSucceeded,
    nodeCleared && eventSucceeded ? 'secured' : 'active'
  );
}

export function transitionEquipmentMemoryHuntNodeClear(
  value: unknown,
  nodeId: unknown
): EquipmentMemoryHuntRunState | undefined {
  const state = stableHuntRunState(value);
  if (!state || state.status !== 'active' || nodeId !== state.nodeId || state.nodeCleared) {
    return state;
  }
  return transitionHuntProgress(state, true, state.eventSucceeded);
}

export type EquipmentMemoryHuntEventOutcome = Readonly<{ success: boolean }>;

export function transitionEquipmentMemoryHuntEventOutcome(
  value: unknown,
  eventId: unknown,
  outcome: unknown
): EquipmentMemoryHuntRunState | undefined {
  const state = stableHuntRunState(value);
  if (!state || state.status !== 'active' || eventId !== state.eventId || state.eventSucceeded) {
    return state;
  }
  if (!isRecord(outcome) || typeof outcome.success !== 'boolean') return state;

  if (!outcome.success) {
    const prepared = freezePreparedEquipmentMemoryHunt(
      state.dungeonId,
      state.equipmentId,
      state.memoryId
    );
    return freezeHuntRunState(
      prepared,
      state.attunementId,
      state.nodeCleared,
      false,
      'failed',
      'event_failure'
    );
  }
  return transitionHuntProgress(state, state.nodeCleared, true);
}

export type EquipmentMemoryHuntSignal =
  | Readonly<{ type: 'node_cleared'; nodeId: string }>
  | Readonly<{ type: 'event_resolved'; eventId: string; outcome: EquipmentMemoryHuntEventOutcome }>;

export function transitionEquipmentMemoryHuntRun(
  value: unknown,
  signal: EquipmentMemoryHuntSignal
): EquipmentMemoryHuntRunState | undefined {
  return signal.type === 'node_cleared'
    ? transitionEquipmentMemoryHuntNodeClear(value, signal.nodeId)
    : transitionEquipmentMemoryHuntEventOutcome(value, signal.eventId, signal.outcome);
}

export const signalEquipmentMemoryHuntNodeClear = transitionEquipmentMemoryHuntNodeClear;
export const resolveEquipmentMemoryHuntEvent = transitionEquipmentMemoryHuntEventOutcome;

export type EquipmentMemoryHuntProgress = Readonly<{
  enabled: boolean;
  status: EquipmentMemoryHuntStatus | 'disabled';
  nodeCleared: boolean;
  eventSucceeded: boolean;
  completedConditionCount: 0 | 1 | 2;
  totalConditionCount: 2;
  grantAvailable: boolean;
  granted: boolean;
  definition?: EquipmentMemoryDefinition;
  equipmentId?: EquipmentMemoryEquipmentId;
  attunementId?: EquipmentAttunementId;
  reason?: EquipmentMemoryHuntReason;
}>;

export function getEquipmentMemoryHuntProgress(value: unknown): EquipmentMemoryHuntProgress {
  const state = normalizeEquipmentMemoryHuntRunState(value);
  if (!state) {
    return Object.freeze({
      enabled: false,
      status: 'disabled',
      nodeCleared: false,
      eventSucceeded: false,
      completedConditionCount: 0,
      totalConditionCount: 2,
      grantAvailable: false,
      granted: false
    });
  }

  const completedConditionCount = Number(state.nodeCleared) + Number(state.eventSucceeded) as 0 | 1 | 2;
  return Object.freeze({
    enabled: true,
    status: state.status,
    nodeCleared: state.nodeCleared,
    eventSucceeded: state.eventSucceeded,
    completedConditionCount,
    totalConditionCount: 2,
    grantAvailable: state.status === 'secured',
    granted: state.status === 'banked',
    definition: MEMORY_BY_ID.get(state.memoryId),
    equipmentId: state.equipmentId,
    attunementId: state.attunementId,
    ...(state.reason === undefined ? {} : { reason: state.reason })
  });
}

export type EquipmentMemoryHuntDisplayKey =
  | 'disabled'
  | 'active'
  | 'secured'
  | 'failed'
  | 'lost'
  | 'banked';

export type EquipmentMemoryHuntDisplayStatus = Readonly<{
  key: EquipmentMemoryHuntDisplayKey;
  label: string;
  detail: string;
}>;

export function getEquipmentMemoryHuntDisplayStatus(
  value: unknown
): EquipmentMemoryHuntDisplayStatus {
  const progress = getEquipmentMemoryHuntProgress(value);
  if (!progress.enabled || !progress.definition) {
    return Object.freeze({ key: 'disabled', label: '未准备', detail: '本轮没有铭刻记忆狩猎。' });
  }
  if (progress.status === 'active') {
    return Object.freeze({
      key: 'active',
      label: `记忆狩猎 ${progress.completedConditionCount}/2`,
      detail: `清理目标节点并成功完成「${progress.definition.name}」事件。`
    });
  }
  if (progress.status === 'secured') {
    return Object.freeze({ key: 'secured', label: '记忆已保全', detail: '从当前副本成功撤离即可收录。' });
  }
  if (progress.status === 'banked') {
    return Object.freeze({ key: 'banked', label: '记忆已收录', detail: `${progress.definition.name}已写入目标装备。` });
  }
  if (progress.status === 'failed') {
    const detail = progress.reason === 'event_failure'
      ? '目标事件失败，本轮记忆无法恢复。'
      : '成功离开时目标尚未全部完成，本轮记忆失效。';
    return Object.freeze({ key: 'failed', label: '记忆狩猎失败', detail });
  }

  const lossDetails: Record<EquipmentMemoryHuntLossReason, string> = {
    retreat: '主动撤退使本轮记忆遗失。',
    failure: '挑战失败使本轮记忆遗失。',
    cross_dungeon: '跨越副本后，原章节记忆无法带回。'
  };
  return Object.freeze({
    key: 'lost',
    label: '记忆已遗失',
    detail: lossDetails[progress.reason as EquipmentMemoryHuntLossReason]
  });
}

export type EquipmentMemoryHuntSettlement = Readonly<{
  state: EquipmentMemoryHuntRunState | undefined;
  granted: boolean;
}>;

export function settleEquipmentMemoryHuntRun(
  value: unknown,
  outcome: EquipmentMemoryHuntRunOutcome
): EquipmentMemoryHuntSettlement {
  const state = stableHuntRunState(value);
  if (!state) return Object.freeze({ state: undefined, granted: false });

  const prepared = freezePreparedEquipmentMemoryHunt(
    state.dungeonId,
    state.equipmentId,
    state.memoryId
  );
  if (outcome === 'successful_exit') {
    if (state.status === 'secured') {
      return Object.freeze({
        state: freezeHuntRunState(prepared, state.attunementId, true, true, 'banked'),
        granted: true
      });
    }
    if (state.status === 'active') {
      return Object.freeze({
        state: freezeHuntRunState(
          prepared,
          state.attunementId,
          state.nodeCleared,
          state.eventSucceeded,
          'failed',
          'incomplete_exit'
        ),
        granted: false
      });
    }
    return Object.freeze({ state, granted: false });
  }

  if (state.status === 'active' || state.status === 'secured') {
    return Object.freeze({
      state: freezeHuntRunState(
        prepared,
        state.attunementId,
        state.nodeCleared,
        state.eventSucceeded,
        'lost',
        outcome
      ),
      granted: false
    });
  }
  return Object.freeze({ state, granted: false });
}

export function settleEquipmentMemoryHuntExit(value: unknown): EquipmentMemoryHuntSettlement {
  return settleEquipmentMemoryHuntRun(value, 'successful_exit');
}

export function markEquipmentMemoryHuntLost(
  value: unknown,
  reason: EquipmentMemoryHuntLossReason
): EquipmentMemoryHuntRunState | undefined {
  return settleEquipmentMemoryHuntRun(value, reason).state;
}

export type EquipmentMemoryRunSnapshotEntry = Readonly<{
  equipmentId: EquipmentMemoryEquipmentId;
  memoryId: EquipmentMemoryId;
}>;

export type EquipmentMemoryRunSnapshot = Readonly<{
  rulesVersion: typeof EQUIPMENT_MEMORY_RULES_VERSION;
  activeEntries: readonly EquipmentMemoryRunSnapshotEntry[];
}>;

const EMPTY_MEMORY_SNAPSHOT_ENTRIES: readonly EquipmentMemoryRunSnapshotEntry[] = Object.freeze([]);

function freezeSnapshot(
  entries: readonly EquipmentMemoryRunSnapshotEntry[]
): EquipmentMemoryRunSnapshot {
  return Object.freeze({
    rulesVersion: EQUIPMENT_MEMORY_RULES_VERSION,
    activeEntries: Object.freeze([...entries])
  });
}

function normalizeEquippedEquipmentIds(value: unknown): ReadonlySet<EquipmentId> | undefined {
  if (!Array.isArray(value)) return undefined;
  const equippedIds = new Set<EquipmentId>();
  for (const equipmentId of value) {
    if (typeof equipmentId !== 'string' || !ALL_EQUIPMENT_IDS.has(equipmentId as EquipmentId)) {
      return undefined;
    }
    equippedIds.add(equipmentId as EquipmentId);
  }
  return equippedIds;
}

export function createEquipmentMemoryRunSnapshot(
  equippedEquipmentIds: unknown,
  memoryMapValue: unknown
): EquipmentMemoryRunSnapshot | undefined {
  const equippedIds = normalizeEquippedEquipmentIds(equippedEquipmentIds);
  const memoryMap = normalizeEquipmentMemoryMap(memoryMapValue);
  if (!equippedIds || !memoryMap) return undefined;

  const entries: EquipmentMemoryRunSnapshotEntry[] = [];
  for (const equipmentId of EQUIPMENT_MEMORY_EQUIPMENT_CATALOG) {
    const activeId = memoryMap[equipmentId]?.activeId;
    if (equippedIds.has(equipmentId) && activeId) {
      entries.push(Object.freeze({ equipmentId, memoryId: activeId }));
    }
  }
  return freezeSnapshot(entries);
}

export function normalizeEquipmentMemoryRunSnapshot(
  value: unknown
): EquipmentMemoryRunSnapshot | undefined {
  if (!isRecord(value) || value.rulesVersion !== EQUIPMENT_MEMORY_RULES_VERSION ||
    !hasExactKeys(value, ['rulesVersion', 'activeEntries']) || !Array.isArray(value.activeEntries)) {
    return undefined;
  }

  const entriesByEquipment = new Map<EquipmentMemoryEquipmentId, EquipmentMemoryRunSnapshotEntry>();
  for (const rawEntry of value.activeEntries) {
    if (!isRecord(rawEntry) || !hasExactKeys(rawEntry, ['equipmentId', 'memoryId']) ||
      !isEquipmentMemoryEquipmentId(rawEntry.equipmentId) || !isEquipmentMemoryId(rawEntry.memoryId) ||
      entriesByEquipment.has(rawEntry.equipmentId)) {
      return undefined;
    }
    entriesByEquipment.set(
      rawEntry.equipmentId,
      Object.freeze({ equipmentId: rawEntry.equipmentId, memoryId: rawEntry.memoryId })
    );
  }

  const entries = EQUIPMENT_MEMORY_EQUIPMENT_CATALOG.flatMap((equipmentId) => {
    const entry = entriesByEquipment.get(equipmentId);
    return entry ? [entry] : [];
  });
  return freezeSnapshot(entries);
}

export function isEquipmentMemoryRunSnapshot(value: unknown): value is EquipmentMemoryRunSnapshot {
  return normalizeEquipmentMemoryRunSnapshot(value) !== undefined;
}

export function listMatchingEquipmentMemorySnapshotEntries(
  snapshotValue: unknown,
  dungeonId: unknown
): readonly EquipmentMemoryRunSnapshotEntry[] {
  const snapshot = normalizeEquipmentMemoryRunSnapshot(snapshotValue);
  const definition = getEquipmentMemoryForDungeon(dungeonId);
  if (!snapshot || !definition) return EMPTY_MEMORY_SNAPSHOT_ENTRIES;
  return Object.freeze(
    snapshot.activeEntries.filter((entry) => entry.memoryId === definition.id)
  );
}

export function hasMatchingEquipmentMemory(
  snapshotValue: unknown,
  dungeonId: unknown
): boolean {
  return listMatchingEquipmentMemorySnapshotEntries(snapshotValue, dungeonId).length > 0;
}

export type EquipmentMemoryRunSnapshotMatch = Readonly<{
  dungeonId: DungeonId;
  matched: boolean;
  effectCount: 0 | 1;
  entries: readonly EquipmentMemoryRunSnapshotEntry[];
}>;

export function getEquipmentMemoryRunSnapshotMatch(
  snapshotValue: unknown,
  dungeonId: unknown
): EquipmentMemoryRunSnapshotMatch | undefined {
  const definition = getEquipmentMemoryForDungeon(dungeonId);
  if (!definition) return undefined;
  const entries = listMatchingEquipmentMemorySnapshotEntries(snapshotValue, definition.dungeonId);
  const matched = entries.length > 0;
  return Object.freeze({
    dungeonId: definition.dungeonId,
    matched,
    effectCount: matched ? 1 : 0,
    entries
  });
}

export type EquipmentMemoryCombatState = Readonly<{
  rulesVersion: typeof EQUIPMENT_MEMORY_RULES_VERSION;
  dungeonId: DungeonId;
  memoryId: EquipmentMemoryId;
  overflowFocus: 0 | 1;
  restored: boolean;
}>;

function freezeCombatState(
  dungeonId: DungeonId,
  memoryId: EquipmentMemoryId,
  overflowFocus: 0 | 1,
  restored: boolean
): EquipmentMemoryCombatState {
  return Object.freeze({
    rulesVersion: EQUIPMENT_MEMORY_RULES_VERSION,
    dungeonId,
    memoryId,
    overflowFocus,
    restored
  });
}

export function createEquipmentMemoryCombatState(
  snapshotValue: unknown,
  dungeonId: unknown
): EquipmentMemoryCombatState | undefined {
  const definition = getEquipmentMemoryForDungeon(dungeonId);
  if (!definition || !hasMatchingEquipmentMemory(snapshotValue, definition.dungeonId)) return undefined;
  return freezeCombatState(definition.dungeonId, definition.id, 0, false);
}

export function normalizeEquipmentMemoryCombatState(
  value: unknown
): EquipmentMemoryCombatState | undefined {
  if (!isRecord(value) || value.rulesVersion !== EQUIPMENT_MEMORY_RULES_VERSION ||
    !hasExactKeys(value, ['rulesVersion', 'dungeonId', 'memoryId', 'overflowFocus', 'restored'])) {
    return undefined;
  }
  const definition = getEquipmentMemoryForDungeon(value.dungeonId);
  if (!definition || value.memoryId !== definition.id ||
    (value.overflowFocus !== 0 && value.overflowFocus !== 1) ||
    typeof value.restored !== 'boolean' || (value.restored && value.overflowFocus !== 0)) {
    return undefined;
  }
  return freezeCombatState(
    definition.dungeonId,
    definition.id,
    value.overflowFocus,
    value.restored
  );
}

function stableCombatState(value: unknown): EquipmentMemoryCombatState | undefined {
  const normalized = normalizeEquipmentMemoryCombatState(value);
  if (!normalized) return undefined;
  return Object.isFrozen(value) ? value as EquipmentMemoryCombatState : normalized;
}

export type EquipmentMemoryCombatFocusResult = Readonly<{
  state: EquipmentMemoryCombatState | undefined;
  resolution: CombatFocusResolution;
  stored: boolean;
  restored: boolean;
}>;

function freezeFocusResolution(resolution: CombatFocusResolution): CombatFocusResolution {
  return Object.freeze({ ...resolution });
}

export function applyEquipmentMemoryCombatFocusResolution(
  stateValue: unknown,
  resolution: CombatFocusResolution,
  combatContinues = resolution.reason !== 'combat-ended'
): EquipmentMemoryCombatFocusResult {
  const state = stableCombatState(stateValue);
  if (!state) {
    return Object.freeze({
      state: undefined,
      resolution: freezeFocusResolution(resolution),
      stored: false,
      restored: false
    });
  }

  if (state.overflowFocus === 1 && !state.restored && combatContinues &&
    resolution.reason === 'weapon-skill-spent' && resolution.spent && resolution.after === 0) {
    const restoredResolution = freezeFocusResolution({
      ...resolution,
      after: 1,
      delta: 1 - resolution.before,
      readyAfter: false
    });
    return Object.freeze({
      state: freezeCombatState(state.dungeonId, state.memoryId, 0, true),
      resolution: restoredResolution,
      stored: false,
      restored: true
    });
  }

  const storesRegularOverflow = resolution.reason === 'regular-action-gain' && resolution.before === 3;
  const storesRecommendedOverflow = resolution.reason === 'recommended-action-gain' && resolution.before >= 2;
  if (!state.restored && state.overflowFocus === 0 &&
    (storesRegularOverflow || storesRecommendedOverflow)) {
    return Object.freeze({
      state: freezeCombatState(state.dungeonId, state.memoryId, 1, false),
      resolution: freezeFocusResolution(resolution),
      stored: true,
      restored: false
    });
  }

  return Object.freeze({
    state,
    resolution: freezeFocusResolution(resolution),
    stored: false,
    restored: false
  });
}

export const applyEquipmentMemoryCombatFocus = applyEquipmentMemoryCombatFocusResolution;
