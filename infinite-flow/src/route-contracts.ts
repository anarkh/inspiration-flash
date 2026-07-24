import type { DungeonId } from './game';
import { DUNGEONS } from './level-content';

export const ROUTE_CONTRACT_RULES_VERSION = 1 as const;
export const HIDDEN_ROUTE_CONTRACT_TRIGGER_PROBABILITY = 0.35 as const;

const HIDDEN_ROUTE_CONTRACT_MIN_CLEARS = 2;
const HIDDEN_ROUTE_CONTRACT_MAX_CLEARS = 6;
const UINT32_RANGE = 0x1_0000_0000;
const UINT32_MAX = 0xffff_ffff;

export type RouteContractDefinition = Readonly<{
  id: string;
  dungeonId: DungeonId;
  name: string;
  description: string;
  targetNodeIds: readonly [string, string];
  rewardPoints: number;
}>;

export type RouteContractRunStatus = 'active' | 'secured' | 'failed' | 'lost' | 'banked';
export type RouteContractFailureReason = 'out_of_order' | 'incomplete_exit';
export type RouteContractLossReason = 'retreat' | 'failure' | 'cross_dungeon';
export type RouteContractReason = RouteContractFailureReason | RouteContractLossReason;
export type RouteContractCompletedTargetCount = 0 | 1 | 2;

export type RouteContractRunState = Readonly<{
  rulesVersion: typeof ROUTE_CONTRACT_RULES_VERSION;
  contractId: string;
  dungeonId: DungeonId;
  completedTargetCount: RouteContractCompletedTargetCount;
  status: RouteContractRunStatus;
  reason?: RouteContractReason;
}>;

export type RouteContractProgress = Readonly<{
  enabled: boolean;
  status: RouteContractRunStatus | 'disabled';
  completedTargetCount: RouteContractCompletedTargetCount;
  totalTargetCount: 2;
  potentialRewardPoints: number;
  bankedRewardPoints: number;
  definition?: RouteContractDefinition;
  nextTargetNodeId?: string;
  reason?: RouteContractReason;
}>;

export type RouteContractDisplayKey =
  | 'disabled'
  | 'pending_first'
  | 'pending_second'
  | 'secured'
  | 'failed'
  | 'lost'
  | 'banked';

export type RouteContractDisplayStatus = Readonly<{
  key: RouteContractDisplayKey;
  label: string;
  detail: string;
}>;

export type RouteContractRunOutcome = 'successful_exit' | RouteContractLossReason;

export type RouteContractSettlement = Readonly<{
  state: RouteContractRunState | undefined;
  rewardPoints: number;
  rewarded: boolean;
}>;

export type HiddenRouteContractDiscoveryInput = Readonly<{
  dungeonId: DungeonId;
  seed: number;
  clearedNodeIds: readonly string[];
}>;

function defineContract(
  dungeonId: DungeonId,
  id: string,
  name: string,
  description: string,
  targetNodeIds: readonly [string, string],
  rewardPoints: number
): RouteContractDefinition {
  return Object.freeze({
    id,
    dungeonId,
    name,
    description,
    targetNodeIds: Object.freeze([targetNodeIds[0], targetNodeIds[1]]) as readonly [string, string],
    rewardPoints
  });
}

function contractSet(
  first: RouteContractDefinition,
  second: RouteContractDefinition,
  third: RouteContractDefinition
): readonly [RouteContractDefinition, RouteContractDefinition, RouteContractDefinition] {
  return Object.freeze([first, second, third]);
}

const ROUTE_CONTRACTS_BY_DUNGEON = Object.freeze({
  demon_tower_1: contractSet(
    defineContract('demon_tower_1', 'tower_mist_watch', '巡雾问井', '先肃清上层雾巡，再下行封住咒水井，让雾契沿正确次序闭合。', ['upper_fog_patrol', 'risky_font_trap'], 135),
    defineContract('demon_tower_1', 'tower_ash_blade', '灰坑引刃', '先踏灭塔底灰坑的伏火，再登北阶截住屠刀手，逆走一次杀阵。', ['ash_pit_trap', 'butcher_turn'], 135),
    defineContract('demon_tower_1', 'tower_lower_hunt', '底层回猎', '先在塔底击退巡猎屠夫，再返回高层拆除松砖机关，封死追兵退路。', ['tower_butcher_patrol', 'loose_tile_trap'], 135)
  ),
  metro_abyss: contractSet(
    defineContract('metro_abyss', 'metro_wraith_return', '亡轨返潮', '先清理北线轨道游魂，再追至南站击碎船夫倒影，校正末班方向。', ['rail_patrol_wraith', 'tide_boatman_reflection'], 170),
    defineContract('metro_abyss', 'metro_flood_reflection', '淹梯照影', '先穿过东侧淹水扶梯，再回收西北岔口的错误倒影，阻断镜潮回灌。', ['flooded_escalator_trap', 'reflection_fork'], 170),
    defineContract('metro_abyss', 'metro_relay_floodgate', '废线封潮', '先拔除废线中继游魂，再赶往北端关闭涨潮闸，截断潮序循环。', ['rail_wraith_relay', 'north_floodgate_trap'], 170)
  ),
  starfall_mine: contractSet(
    defineContract('starfall_mine', 'mine_roost_inversion', '星巢倒井', '先清除北壁火花巢，再下到西侧倒悬井解除坠落机关，重定矿井引力。', ['spark_imp_roost', 'inverted_shaft_trap'], 205),
    defineContract('starfall_mine', 'mine_ore_shell', '坠矿追壳', '先穿过东端落矿带，再横越井底击退甲壳守卫，收束两端震源。', ['falling_ore_trap', 'shell_guard_beta'], 205),
    defineContract('starfall_mine', 'mine_dust_switch', '静尘复位', '先压住东南静电尘暴，再返回北壁扳动倾斜重力闸，完成逆向复位。', ['static_dust_trap', 'tilted_gravity_switch'], 205)
  ),
  rust_hospital: contractSet(
    defineContract('rust_hospital', 'hospital_orderly_sterilizer', '病历焚净', '先终止门诊勤务员巡查，再启动深层灭菌器，销毁污染病历。', ['plague_orderly', 'sterilizer_trap'], 240),
    defineContract('rust_hospital', 'hospital_roof_rounds', '天台回诊', '先解除天台通道机关，再折返旧病房截停巡诊勤务员，取消回诊队列。', ['roof_access_trap', 'ward_orderly_patrol'], 240),
    defineContract('rust_hospital', 'hospital_patrol_gurney', '终诊逆推', '先击退东翼医生巡查，再回到北廊拆除锈蚀推床，逆推终诊路线。', ['doctor_patrol_route', 'rust_gurney_trap'], 240)
  ),
  ash_arena: contractSet(
    defineContract('ash_arena', 'arena_duelist_gutter', '余烬潜判', '先战胜北席灰烬斗士，再潜入南侧烟沟熄灭暗火，迫使赛场改判。', ['ash_duelist', 'smoke_gutter'], 275),
    defineContract('ash_arena', 'arena_penalty_ringbreaker', '罚火追擂', '先闯过东侧罚火，再折返西侧击败破擂斗士，夺回被扣下的胜场。', ['penalty_fire', 'ringbreaker_duelist'], 275),
    defineContract('ash_arena', 'arena_lancer_white_step', '枪阵缴税', '先击败西侧烬枪手，再横穿下层拆除白阶税火，终止赛场抽成。', ['cinder_lancer', 'white_step_tax'], 275)
  ),
  dream_archive: contractSet(
    defineContract('dream_archive', 'archive_librarian_record', '馆主覆页', '先击退北馆纸页馆主，再到西南销毁覆写记录，夺回原始页序。', ['paper_librarian', 'overwritten_record_trap'], 310),
    defineContract('dream_archive', 'archive_paper_jailer', '纸刃寻牢', '先穿过封底纸刃，再返回东馆锁定梦牢看守，补全被删去的索引。', ['paper_cut_trap', 'dream_jailer'], 310),
    defineContract('dream_archive', 'archive_afterimage_margin', '幻巡收边', '先清除南馆幻觉巡逻，再回到北馆封住页边陷阱，阻止梦境外溢。', ['hallucination_patrol_two', 'margin_snare_trap'], 310)
  ),
  void_citadel: contractSet(
    defineContract('void_citadel', 'citadel_knight_shadow', '骑士照影', '先击败北门虚空骑士，再深入南侧斩断自我影像，拒绝身份复制。', ['void_knight', 'self_shadow_trap'], 345),
    defineContract('void_citadel', 'citadel_memory_guard', '甲忆回门', '先清除西南甲胄记忆，再横越城塞击败回声门卫，封存旧身份。', ['armor_memory_trap', 'echo_gate_guard'], 345),
    defineContract('void_citadel', 'citadel_shard_name', '碎核除名', '先击碎东南回声核卫，再返回西廊抹除残缺姓名，切断全域同调。', ['echo_core_shard', 'broken_name_trap'], 345)
  ),
  temporal_observatory: contractSet(
    defineContract('temporal_observatory', 'temporal_epoch_recharge', '旧纪充能', '先击退往昔纪元哨兵，再抵达未来侧共鸣室完成充能，接续两段时间。', ['epoch_sentinel_alpha', 'soul_recharge_chamber'], 380),
    defineContract('temporal_observatory', 'temporal_unborn_erased', '未生追删', '先拆除未来未生齿轮，再追返往昔击败抹除巡逻，修复因果缺口。', ['unborn_gear_trap', 'erased_patrol'], 380),
    defineContract('temporal_observatory', 'temporal_north_acceleration', '北锁加速', '先解除王庭北侧时锁，再折向未来线击退加速巡逻，固定零点前序。', ['boss_north_lock', 'accelerated_patrol'], 380)
  ),
  causal_clearinghouse: contractSet(
    defineContract('causal_clearinghouse', 'causal_alpha_recharge', '始警归因', '先击退因端悖论法警，再抵达器魂归因室完成充能，把追缴记录写回正确起因。', ['paradox_bailiff_alpha', 'soul_recharge_chamber'], 415),
    defineContract('causal_clearinghouse', 'causal_sentence_bailiff', '预判追因', '先拆除果端预期判罚阵，再折返因端质询裁决执事，撤销尚未成立的罪因。', ['prospective_sentence_trap', 'cause_bailiff'], 415),
    defineContract('causal_clearinghouse', 'causal_effect_verdict', '果证解锁', '先击退果端裁决执事，再穿过递卷桥解除北侧判词锁，让结果取得有效落款。', ['effect_bailiff', 'north_verdict_lock'], 415)
  ),
  entropy_ark: contractSet(
    defineContract('entropy_ark', 'entropy_deckhand_recharge', '熵舱续魂', '先击退熵舱水手，再抵达器魂充能舱完成续接，让耗散航线重新获得动力。', ['entropy_deckhand', 'soul_recharge_chamber'], 450),
    defineContract('entropy_ark', 'entropy_wake_ballast', '逆迹压舱', '先穿过航迹逆转区，再稳定左舷压舱核心，把翻卷的熵潮压回船腹。', ['wake_inversion', 'port_ballast_core'], 450),
    defineContract('entropy_ark', 'entropy_navigator_lock', '耗散锁舵', '先击退左舷耗散领航员，再前往末舵台锁定末舵手，截断弃航指令。', ['dissipation_navigator_alpha', 'last_helmsman'], 450)
  ),
  mirror_cycle_city: contractSet(
    defineContract('mirror_cycle_city', 'mirror_hunter_recharge', '实猎续相', '先击退现实侧视差猎手，再转入镜相抵达器魂充能点，让两侧追猎节奏彼此错开。', ['parallax_hunter_real', 'soul_recharge_mirror'], 485),
    defineContract('mirror_cycle_city', 'mirror_shard_fracture', '晶雨断名', '先穿过上层碎晶雨，再深入镜底拆除身份裂解阵，阻止伤痕被复制成新的姓名。', ['shard_rain_trap', 'identity_fracture_trap'], 485),
    defineContract('mirror_cycle_city', 'mirror_chorus_rehearsal', '合唱归名', '先终止上层镜群合唱，再前往镜台完成身份排演，让归名词只保留一个声部。', ['mirror_chorus_upper', 'reflection_event_stage'], 485)
  ),
  redaction_scriptorium: contractSet(
    defineContract('redaction_scriptorium', 'redaction_copyist_recharge', '北抄重订', '先击退北廊删界抄写员，再抵达器魂重订室完成续接，让被删动作重新获得正式装订。', ['erasure_copyist_north', 'soul_recharge_scriptorium'], 520),
    defineContract('redaction_scriptorium', 'redaction_sentence_south_lock', '断句验锁', '先穿过正文断句删截阵，再前往终审南锁核验承压批注，证明残句仍能抵达终稿。', ['severed_sentence_trap', 'boss_south_lock'], 520),
    defineContract('redaction_scriptorium', 'redaction_censor_errata', '覆页勘误', '先击退覆页裁定者初稿，再到勘误事件台提交证词，让被覆盖的句子取得正式版本号。', ['palimpsest_censor_alpha', 'errata_event_stage'], 520)
  ),
  legacy_auction_court: contractSet(
    defineContract('legacy_auction_court', 'legacy_reserve_recharge', '北席保价', '先击退北席保价执事，再抵达器魂竞拍台完成续接，让被扣押的器魂重新取得出价资格。', ['reserve_bailiff_north', 'soul_recharge_auction'], 560),
    defineContract('legacy_auction_court', 'legacy_hammerfall_rostrum', '落槌登席', '先穿过落槌追价阵，再登上终拍侧席封住追加报价，迫使执槌人公开最终保价。', ['hammerfall_trap', 'boss_side_rostrum'], 560),
    defineContract('legacy_auction_court', 'legacy_mimic_testimony', '伪产作证', '先识破首席遗产拟态，再前往亡队证词台核对原主记录，让伪造拍品失去继承资格。', ['inheritance_mimic_alpha', 'dead_team_testimony_stage'], 560)
  ),
  genesis_vault: contractSet(
    defineContract('genesis_vault', 'genesis_stalker_recharge', '北猎复育', '先击退北廊基因猎犬，再抵达器魂复育槽完成重组，让装备免于被重复战斗表达同化。', ['gene_stalker_north', 'soul_recharge_genesis'], 600),
    defineContract('genesis_vault', 'genesis_helix_side_lock', '螺旋验锁', '先穿过螺旋坍缩阱，再前往典藏侧锁完成自我校验，证明外来组织未污染归档序列。', ['helix_collapse_trap', 'boss_side_lock'], 600),
    defineContract('genesis_vault', 'genesis_guardian_lineage', '终代溯祖', '先击退终代变异守库体，再到谱系演化台承认祖型回声，让成熟变异取得可核验的来源。', ['mutation_guardian_omega', 'lineage_event_stage'], 600)
  ),
  silent_broadcast_tower: contractSet(
    defineContract('silent_broadcast_tower', 'broadcast_leech_recharge', '寄频续魂', '先清除北廊频段寄生体，再抵达器魂静默充能舱完成净频，让器魂不再被重复攻势啃噬。', ['frequency_leech_north', 'soul_recharge_broadcast'], 650),
    defineContract('silent_broadcast_tower', 'broadcast_tripwire_studio_lock', '声纹验锁', '先穿过声纹绊线阵，再前往主播播间侧锁完成意识校准，证明借声频道未能复制本次通行频谱。', ['acoustic_tripwire', 'studio_side_lock'], 650),
    defineContract('silent_broadcast_tower', 'broadcast_warden_anechoic', '终卫归静', '先击退终段广播守卫，再进入全消声室封存残余频道，让守卫的反击脉冲失去广播出口。', ['broadcast_warden_omega', 'anechoic_chamber'], 650)
  ),
  lost_shelter: contractSet(
    defineContract('lost_shelter', 'shelter_patrol_recharge', '北巡续援', '先识破北区拟声巡救者，再抵达器魂救援充能舱切断接管回路，让救援装备保持真实回应。', ['north_rescue_patrol', 'soul_recharge_shelter'], 700),
    defineContract('lost_shelter', 'shelter_collapse_command', '坍廊验权', '先穿过坍塌走廊压锁，再前往总控身份锁完成自我核验，证明护送队未被伪造口令接管。', ['collapsed_hall_trap', 'command_lock'], 700),
    defineContract('lost_shelter', 'shelter_horror_containment', '终撤收容', '先击退终段撤离畸变体，再进入失联收容舱封闭接管样本，让畸变撤离记录无法回写幸存者。', ['evacuation_horror_omega', 'containment_bay'], 700)
  ),
  false_testimony_court: contractSet(
    defineContract('false_testimony_court', 'testimony_witness_recharge', '北证续魂', '先击退北席敌意证人，再抵达器魂裁定充能席封存口供冲突，让器魂不被重复证词改写。', ['hostile_witness_north', 'soul_recharge_verdict'], 760),
    defineContract('false_testimony_court', 'testimony_voice_judgment', '声证锁判', '先穿过声纹滤伪阵，再前往终审判词锁固定原始声纹，阻止替换证言取得终审落款。', ['voice_filter_trap', 'judgment_lock'], 760),
    defineContract('false_testimony_court', 'testimony_hound_hall', '猎伪归厅', '先击退终段伪证猎犬，再返回公开证言厅核对匿名线报，让矛盾气味无法覆盖原始证词。', ['perjury_hound_omega', 'testimony_hall'], 760)
  ),
  combat_replay_stage: contractSet(
    defineContract('combat_replay_stage', 'replay_stalker_recharge', '北场续片', '先击退北机位场记潜猎者，再抵达器魂复演充能台锁定动作，让器魂不被重复镜头改写。', ['cue_stalker_north', 'soul_recharge_stage'], 820),
    defineContract('combat_replay_stage', 'replay_opening_final_lock', '开场锁片', '先穿过开场提示陷阱，再前往终剪封片锁固定真实开场，阻止错误提示取得最终剪辑权。', ['opening_cue_trap', 'final_cut_lock'], 820),
    defineContract('combat_replay_stage', 'replay_double_prop_cache', '替身归箱', '先击退终段重拍替身，再返回开场道具箱核对场记单，让废弃镜头无法替换原始动作。', ['retake_double_omega', 'opening_prop_cache'], 820)
  ),
  panopticon_city: contractSet(
    defineContract('panopticon_city', 'panopticon_north_recharge', '北盲续界', '先关闭北盲区中继，再抵达器魂监察充能台完成续接，让器魂脱离全景预测序列。', ['north_blind_relay', 'soul_recharge_panopticon'], 880),
    defineContract('panopticon_city', 'panopticon_central_lock', '中盲锁视', '先关闭中央盲区中继，再前往全视封锁台冻结监察权限，阻止天幕重新拼合全景。', ['central_blind_relay', 'all_sight_lock'], 880),
    defineContract('panopticon_city', 'panopticon_south_inverse', '南盲逆观', '先关闭南盲区中继，再进入逆向观测台保存视线外轨迹，让监察模型失去最后一段预测依据。', ['south_blind_relay', 'inverse_observation_stage'], 880)
  )
} satisfies Readonly<Record<DungeonId, readonly [RouteContractDefinition, RouteContractDefinition, RouteContractDefinition]>>);

export const ROUTE_CONTRACT_CATALOG: readonly RouteContractDefinition[] = Object.freeze(
  Object.values(ROUTE_CONTRACTS_BY_DUNGEON).flat()
);

const EMPTY_CONTRACT_LIST: readonly RouteContractDefinition[] = Object.freeze([]);
const CONTRACTS_BY_ID = new Map(ROUTE_CONTRACT_CATALOG.map((definition) => [definition.id, definition]));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const actualKeys = Object.keys(value);
  return actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function freezeState(
  contractId: string,
  dungeonId: DungeonId,
  completedTargetCount: RouteContractCompletedTargetCount,
  status: RouteContractRunStatus,
  reason?: RouteContractReason
): RouteContractRunState {
  return Object.freeze({
    rulesVersion: ROUTE_CONTRACT_RULES_VERSION,
    contractId,
    dungeonId,
    completedTargetCount,
    status,
    ...(reason === undefined ? {} : { reason })
  });
}

function isValidStateCombination(
  status: RouteContractRunStatus,
  completedTargetCount: RouteContractCompletedTargetCount,
  reason: unknown
): reason is RouteContractReason | undefined {
  if (status === 'active') return (completedTargetCount === 0 || completedTargetCount === 1) && reason === undefined;
  if (status === 'secured' || status === 'banked') return completedTargetCount === 2 && reason === undefined;
  if (status === 'failed') {
    return (reason === 'out_of_order' && completedTargetCount === 0) ||
      (reason === 'incomplete_exit' && completedTargetCount < 2);
  }
  return (reason === 'retreat' || reason === 'failure' || reason === 'cross_dungeon');
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function isPositiveUint32(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= UINT32_MAX;
}

export function discoverHiddenRouteContract({
  dungeonId,
  seed,
  clearedNodeIds
}: HiddenRouteContractDiscoveryInput): RouteContractRunState | undefined {
  if (!isPositiveUint32(seed)) return undefined;

  const dungeon = DUNGEONS[dungeonId];
  if (!dungeon) return undefined;

  const nodeById = new Map(dungeon.nodes.map((node) => [node.id, node]));
  const uniqueClearedNodeIds = [...new Set(clearedNodeIds)];
  const clearedNonExitNodeIds = uniqueClearedNodeIds.filter((nodeId) => {
    const node = nodeById.get(nodeId);
    return node !== undefined && node.type !== 'exit';
  });
  if (
    clearedNonExitNodeIds.length < HIDDEN_ROUTE_CONTRACT_MIN_CLEARS ||
    clearedNonExitNodeIds.length > HIDDEN_ROUTE_CONTRACT_MAX_CLEARS
  ) {
    return undefined;
  }

  const pathKey = clearedNonExitNodeIds.join('>');
  const triggerRoll = stableHash(
    `hidden-route-contract:v1:trigger:${dungeonId}:${seed}:${pathKey}`
  ) / UINT32_RANGE;
  if (triggerRoll >= HIDDEN_ROUTE_CONTRACT_TRIGGER_PROBABILITY) return undefined;

  const clearedNodeSet = new Set(uniqueClearedNodeIds);
  const candidates = listRouteContracts(dungeonId).filter((definition) =>
    definition.dungeonId === dungeonId &&
    definition.targetNodeIds.every((nodeId) =>
      nodeById.has(nodeId) && !clearedNodeSet.has(nodeId)
    )
  );
  if (candidates.length === 0) return undefined;

  const selectionHash = stableHash(
    `hidden-route-contract:v1:selection:${dungeonId}:${seed}:${pathKey}`
  );
  return createRouteContractRunState(candidates[selectionHash % candidates.length]);
}

export function listRouteContracts(dungeonId: DungeonId): readonly RouteContractDefinition[] {
  return ROUTE_CONTRACTS_BY_DUNGEON[dungeonId] ?? EMPTY_CONTRACT_LIST;
}

export function getRouteContractById(
  contractId: string,
  dungeonId: DungeonId
): RouteContractDefinition | undefined {
  const definition = CONTRACTS_BY_ID.get(contractId);
  return definition?.dungeonId === dungeonId ? definition : undefined;
}

export function isRouteContractDefinition(value: unknown): value is RouteContractDefinition {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.dungeonId !== 'string') return false;
  const canonical = getRouteContractById(value.id, value.dungeonId as DungeonId);
  return canonical !== undefined &&
    value.name === canonical.name &&
    value.description === canonical.description &&
    value.rewardPoints === canonical.rewardPoints &&
    Array.isArray(value.targetNodeIds) &&
    value.targetNodeIds.length === 2 &&
    value.targetNodeIds[0] === canonical.targetNodeIds[0] &&
    value.targetNodeIds[1] === canonical.targetNodeIds[1];
}

export function createRouteContractRunState(
  definition: RouteContractDefinition | undefined
): RouteContractRunState | undefined {
  if (!isRouteContractDefinition(definition)) return undefined;
  return freezeState(definition.id, definition.dungeonId, 0, 'active');
}

export function normalizeRouteContractRunState(
  value: unknown,
  currentDungeonId: DungeonId
): RouteContractRunState | undefined {
  if (!isRecord(value) || value.rulesVersion !== ROUTE_CONTRACT_RULES_VERSION) return undefined;
  if (typeof value.contractId !== 'string' || value.dungeonId !== currentDungeonId) return undefined;
  if (!getRouteContractById(value.contractId, currentDungeonId)) return undefined;
  if (value.completedTargetCount !== 0 && value.completedTargetCount !== 1 && value.completedTargetCount !== 2) return undefined;
  if (value.status !== 'active' && value.status !== 'secured' && value.status !== 'failed' && value.status !== 'lost' && value.status !== 'banked') return undefined;

  const expectsReason = value.status === 'failed' || value.status === 'lost';
  const expectedKeys = expectsReason
    ? ['rulesVersion', 'contractId', 'dungeonId', 'completedTargetCount', 'status', 'reason']
    : ['rulesVersion', 'contractId', 'dungeonId', 'completedTargetCount', 'status'];
  if (!hasExactKeys(value, expectedKeys)) return undefined;
  if (!isValidStateCombination(value.status, value.completedTargetCount, value.reason)) return undefined;

  return freezeState(
    value.contractId,
    currentDungeonId,
    value.completedTargetCount,
    value.status,
    value.reason
  );
}

export function isRouteContractRunState(
  value: unknown,
  currentDungeonId: DungeonId
): value is RouteContractRunState {
  return normalizeRouteContractRunState(value, currentDungeonId) !== undefined;
}

function stableNormalizedState(value: unknown, currentDungeonId: DungeonId): RouteContractRunState | undefined {
  const normalized = normalizeRouteContractRunState(value, currentDungeonId);
  if (!normalized) return undefined;
  return Object.isFrozen(value) ? value as RouteContractRunState : normalized;
}

export function transitionRouteContractFirstClear(
  value: unknown,
  currentDungeonId: DungeonId,
  nodeId: string
): RouteContractRunState | undefined {
  const state = stableNormalizedState(value, currentDungeonId);
  if (!state || state.status !== 'active') return state;

  const definition = getRouteContractById(state.contractId, currentDungeonId);
  if (!definition) return undefined;
  const [firstTargetNodeId, secondTargetNodeId] = definition.targetNodeIds;

  if (nodeId === firstTargetNodeId) {
    return state.completedTargetCount === 0
      ? freezeState(state.contractId, state.dungeonId, 1, 'active')
      : state;
  }
  if (nodeId === secondTargetNodeId) {
    return state.completedTargetCount === 1
      ? freezeState(state.contractId, state.dungeonId, 2, 'secured')
      : freezeState(state.contractId, state.dungeonId, 0, 'failed', 'out_of_order');
  }
  return state;
}

export function getRouteContractProgress(
  value: unknown,
  currentDungeonId: DungeonId
): RouteContractProgress {
  const state = normalizeRouteContractRunState(value, currentDungeonId);
  if (!state) {
    return Object.freeze({
      enabled: false,
      status: 'disabled',
      completedTargetCount: 0,
      totalTargetCount: 2,
      potentialRewardPoints: 0,
      bankedRewardPoints: 0
    });
  }

  const definition = getRouteContractById(state.contractId, currentDungeonId);
  if (!definition) {
    return Object.freeze({
      enabled: false,
      status: 'disabled',
      completedTargetCount: 0,
      totalTargetCount: 2,
      potentialRewardPoints: 0,
      bankedRewardPoints: 0
    });
  }

  const nextTargetNodeId = state.status === 'active'
    ? state.completedTargetCount === 0
      ? definition.targetNodeIds[0]
      : definition.targetNodeIds[1]
    : undefined;
  return Object.freeze({
    enabled: true,
    status: state.status,
    completedTargetCount: state.completedTargetCount,
    totalTargetCount: 2,
    potentialRewardPoints: definition.rewardPoints,
    bankedRewardPoints: state.status === 'banked' ? definition.rewardPoints : 0,
    definition,
    ...(nextTargetNodeId === undefined ? {} : { nextTargetNodeId }),
    ...(state.reason === undefined ? {} : { reason: state.reason })
  });
}

export function getRouteContractDisplayStatus(
  value: unknown,
  currentDungeonId: DungeonId
): RouteContractDisplayStatus {
  const progress = getRouteContractProgress(value, currentDungeonId);
  if (!progress.enabled || !progress.definition) {
    return Object.freeze({ key: 'disabled', label: '未启用', detail: '本轮未选择路线契约。' });
  }

  const definition = progress.definition;
  if (progress.status === 'active' && progress.completedTargetCount === 0) {
    return Object.freeze({ key: 'pending_first', label: '路线契约 0/2', detail: `先完成「${definition.name}」的第一目标。` });
  }
  if (progress.status === 'active') {
    return Object.freeze({ key: 'pending_second', label: '路线契约 1/2', detail: `第一目标已完成，继续前往第二目标。` });
  }
  if (progress.status === 'secured') {
    return Object.freeze({ key: 'secured', label: '契约已保全', detail: `从本副本出口结算可获得 ${definition.rewardPoints} 奖励点。` });
  }
  if (progress.status === 'banked') {
    return Object.freeze({ key: 'banked', label: '契约已入账', detail: `已获得 ${definition.rewardPoints} 奖励点。` });
  }
  if (progress.status === 'failed') {
    const detail = progress.reason === 'out_of_order'
      ? '第二目标先于第一目标完成，契约次序已不可恢复。'
      : '离开副本时目标尚未全部完成，契约失败。';
    return Object.freeze({ key: 'failed', label: '契约失败', detail });
  }

  const lossDetails: Record<RouteContractLossReason, string> = {
    retreat: '撤退导致本轮路线契约遗失。',
    failure: '本轮挑战失败，路线契约遗失。',
    cross_dungeon: '跨越副本界门后，原副本路线契约遗失。'
  };
  return Object.freeze({
    key: 'lost',
    label: '契约遗失',
    detail: lossDetails[progress.reason as RouteContractLossReason]
  });
}

export function settleRouteContractRun(
  value: unknown,
  currentDungeonId: DungeonId,
  outcome: RouteContractRunOutcome
): RouteContractSettlement {
  const state = stableNormalizedState(value, currentDungeonId);
  if (!state) return Object.freeze({ state: undefined, rewardPoints: 0, rewarded: false });

  if (outcome === 'successful_exit') {
    if (state.status === 'secured') {
      const definition = getRouteContractById(state.contractId, currentDungeonId);
      if (!definition) return Object.freeze({ state: undefined, rewardPoints: 0, rewarded: false });
      return Object.freeze({
        state: freezeState(state.contractId, state.dungeonId, 2, 'banked'),
        rewardPoints: definition.rewardPoints,
        rewarded: true
      });
    }
    if (state.status === 'active') {
      return Object.freeze({
        state: freezeState(state.contractId, state.dungeonId, state.completedTargetCount, 'failed', 'incomplete_exit'),
        rewardPoints: 0,
        rewarded: false
      });
    }
    return Object.freeze({ state, rewardPoints: 0, rewarded: false });
  }

  if (state.status === 'active' || state.status === 'secured') {
    return Object.freeze({
      state: freezeState(state.contractId, state.dungeonId, state.completedTargetCount, 'lost', outcome),
      rewardPoints: 0,
      rewarded: false
    });
  }
  return Object.freeze({ state, rewardPoints: 0, rewarded: false });
}

export function settleRouteContractExit(
  value: unknown,
  currentDungeonId: DungeonId
): RouteContractSettlement {
  return settleRouteContractRun(value, currentDungeonId, 'successful_exit');
}

export function markRouteContractLost(
  value: unknown,
  currentDungeonId: DungeonId,
  reason: RouteContractLossReason
): RouteContractRunState | undefined {
  return settleRouteContractRun(value, currentDungeonId, reason).state;
}
