import { DUNGEONS, DUNGEON_ORDER } from './level-content';
import type { DungeonId, EquipmentId, ItemId, MethodId, PetId, RewardBundle } from './game';
import { getBroadcastRelayStatus, getCombatReplayStatus, getEscortCheckpointStatus, getFalseTestimonyStatus, normalizeDungeonLawState } from './dungeon-laws';
import type { GenesisGene } from './dungeon-laws';

export type DirectiveStatus = 'locked' | 'active' | 'completed' | 'failed';

export type DirectiveObjectiveKind = 'low_damage' | 'capture' | 'no_item' | 'method' | 'equip' | 'hidden_clear' | 'active_pet' | 'route' | 'auction' | 'genesis_splice' | 'active_bloodline' | 'broadcast_relays' | 'broadcast_snapshot' | 'escort_checkpoints' | 'escort_snapshot' | 'false_testimony_verdict' | 'false_testimony_snapshot' | 'combat_replay_complete' | 'panopticon_complete';

export type DirectiveObjective = {
  id: string;
  kind: DirectiveObjectiveKind;
  label: string;
  description: string;
  damageLimit?: number;
  petId?: PetId;
  itemIds?: ItemId[];
  methodId?: MethodId;
  equipmentId?: EquipmentId;
  nodeIds?: string[];
  bidProofNodeIds?: string[];
  minimumBidCount?: number;
  requiredSpliceCount?: number;
  minimumUniqueGeneCount?: number;
  minimumMuteCount?: number;
  minimumBroadcastCount?: number;
  maximumBossNoiseSnapshot?: number;
  minimumTreatCount?: number;
  minimumPushCount?: number;
  requireSurvivorAlive?: boolean;
  minimumBossSurvivorSnapshot?: number;
  requiredEvidenceCount?: number;
  minimumTrustedEvidenceCount?: number;
  requireCorrectAccusation?: boolean;
  requireNoAppeal?: boolean;
};

export type MainGodDirective = {
  id: string;
  dungeonId: DungeonId;
  name: string;
  brief: string;
  requiredClears: number;
  optionalObjectives: DirectiveObjective[];
  reward: RewardBundle & {
    preview: string;
  };
};

export type DirectiveRunSummary = {
  dungeonId: DungeonId;
  clearedNodeIds: string[];
  totalNodes: number;
  damageTaken: number;
  captures: number | PetId[];
  ownedPetIds?: PetId[];
  usedItems: ItemId[];
  learnedMethods: MethodId[];
  equippedIds: EquipmentId[];
  activePet?: PetId;
  lawState?: unknown;
};

export type DirectiveObjectiveResult = {
  id: string;
  kind: DirectiveObjectiveKind;
  label: string;
  description: string;
  completed: boolean;
  progressText: string;
};

export type DirectiveEvaluation = {
  status: DirectiveStatus;
  progressText: string;
  rewardPreview: string;
  objectiveResults: DirectiveObjectiveResult[];
};

export const MAIN_GOD_DIRECTIVES: MainGodDirective[] = [
  {
    id: 'directive_demon_tower_1',
    dungeonId: 'demon_tower_1',
    name: '妖塔试炼令',
    brief: '本令提供可选额外奖励，不影响Boss、出口或主线通关；低承伤目标建议采用守势、护甲与其他减伤手段。',
    requiredClears: 3,
    optionalObjectives: [
      {
        ...lowDamage('demon_tower_1_low_damage', 20, '承伤不超过 20'),
        description: '可选额外奖励，不影响Boss、出口或主线通关。保持守势并优先使用护甲、格挡等减伤手段；本轮实际承伤会持续累计到出口结算，治疗不会回退累计值，结算时不超过 20。'
      },
      capturePet('demon_tower_1_capture_mist_kitten', 'mist_kitten', '捕获雾爪幼兽'),
      useMethod('demon_tower_1_mist_breathing', 'mist_breathing', '以吐纳诀读取雾后暗格')
    ],
    reward: { rewardPoints: 260, lingyun: 1, items: { hidden_stone: 1 }, preview: '奖励点 260、灵蕴 1、雾后石 1' }
  },
  {
    id: 'directive_metro_abyss',
    dungeonId: 'metro_abyss',
    name: '镜潮校准令',
    brief: '主神要求你处理倒影与传送门，避免用符咒硬解所有风险。',
    requiredClears: 4,
    optionalObjectives: [
      lowDamage('metro_abyss_low_damage', 26, '承伤不超过 26'),
      noItem('metro_abyss_no_talisman', ['thunder_talisman', 'dispel_talisman'], '不使用雷火符或驱邪符'),
      equipItem('metro_abyss_cloudstep_charm', 'cloudstep_charm', '装备云隙符应对镜潮迟缓')
    ],
    reward: { rewardPoints: 320, lingyun: 1, items: { mirror_shell: 2 }, preview: '奖励点 320、灵蕴 1、镜潮贝 2' }
  },
  {
    id: 'directive_starfall_mine',
    dungeonId: 'starfall_mine',
    name: '星坠破甲令',
    brief: '主神要求你针对高防矿壳选择装备，并清出深层矿脉。',
    requiredClears: 5,
    optionalObjectives: [
      equipItem('starfall_mine_armor_piercing_sword', 'armor_piercing_sword', '装备破甲剑击穿矿壳'),
      useMethod('starfall_mine_gate_sense', 'gate_sense', '以观门法读取星核矿脉'),
      hiddenClear('starfall_mine_full_clear', '清完矿井隐藏节点')
    ],
    reward: { rewardPoints: 420, lingyun: 1, items: { star_iron: 1, method_page: 1 }, preview: '奖励点 420、灵蕴 1、星铁 1、功法残页 1' }
  },
  {
    id: 'directive_rust_hospital',
    dungeonId: 'rust_hospital',
    name: '锈疫净化令',
    brief: '主神要求你减少污染消耗，用防御或心法扛过病院流程。',
    requiredClears: 4,
    optionalObjectives: [
      lowDamage('rust_hospital_low_damage', 34, '承伤不超过 34'),
      useMethod('rust_hospital_iron_body', 'iron_body', '以铁衣诀抵御锈疫'),
      noItem('rust_hospital_no_healing_pill', ['healing_pill'], '不使用回血丹完成分诊')
    ],
    reward: { rewardPoints: 460, lingyun: 2, items: { method_page: 1 }, preview: '奖励点 460、灵蕴 2、功法残页 1' }
  },
  {
    id: 'directive_ash_arena',
    dungeonId: 'ash_arena',
    name: '灰烬观战令',
    brief: '主神要求你带宠物打出节奏优势，而不是只靠数值硬拼。',
    requiredClears: 4,
    optionalObjectives: [
      lowDamage('ash_arena_low_damage', 38, '承伤不超过 38'),
      activePet('ash_arena_active_ash_hound', 'ash_hound', '携带烬火犬入场'),
      equipItem('ash_arena_guardian_plate', 'guardian_plate', '装备界卫甲承受裁决火线')
    ],
    reward: { rewardPoints: 520, lingyun: 2, items: { star_iron: 1, cracked_core: 1 }, preview: '奖励点 520、灵蕴 2、星铁 1、裂核 1' }
  },
  {
    id: 'directive_dream_archive',
    dungeonId: 'dream_archive',
    name: '梦档案归档令',
    brief: '主神要求你用心法和宠物绕开道具封锁，完整带回失败索引。',
    requiredClears: 4,
    optionalObjectives: [
      useMethod('dream_archive_void_heart', 'void_heart', '以虚心诀读完失败索引'),
      activePet('dream_archive_active_mirror_moth', 'mirror_moth', '携带镜翼蛾稳定幻觉路线'),
      hiddenClear('dream_archive_full_clear', '清完档案馆隐藏节点')
    ],
    reward: { rewardPoints: 580, lingyun: 2, items: { method_page: 2, hidden_stone: 1 }, preview: '奖励点 580、灵蕴 2、功法残页 2、隐藏石 1' }
  },
  {
    id: 'directive_void_citadel',
    dungeonId: 'void_citadel',
    name: '虚界王座',
    brief: '主神要求你用终盘装备、虚心诀和裂隙宠物完成均衡检定。',
    requiredClears: 4,
    optionalObjectives: [
      lowDamage('void_citadel_low_damage', 40, '承伤不超过 40'),
      equipItem('void_citadel_starforged_edge', 'starforged_edge', '装备淬星剑胚终结虚界骑士'),
      useMethod('void_citadel_void_heart', 'void_heart', '以虚心诀抵抗主神残响'),
      capturePet('void_citadel_capture_void_whelp', 'void_whelp', '捕获虚空幼蜥')
    ],
    reward: { rewardPoints: 760, lingyun: 3, items: { cracked_core: 2, method_page: 1 }, preview: '奖励点 760、灵蕴 3、裂核 2、功法残页 1' }
  },
  {
    id: 'directive_temporal_observatory',
    dungeonId: 'temporal_observatory',
    name: '时序校准令',
    brief: '主神要求你走完过去与未来两条校准路线，再以时序透镜闭合观测结果。',
    requiredClears: 5,
    optionalObjectives: [
      clearRouteAnchors(
        'temporal_observatory_calibration_route',
        ['past_calibration_anchor', 'future_calibration_anchor'],
        '校准过去与未来锚点'
      ),
      equipItem('temporal_observatory_chronal_lens', 'chronal_lens', '装备时序透镜闭合观测'),
      lowDamage('temporal_observatory_low_damage', 48, '承伤不超过 48')
    ],
    reward: { rewardPoints: 900, lingyun: 4, items: { chronal_glass: 2 }, preview: '奖励点 900、灵蕴 4、时序玻璃 2' }
  },
  {
    id: 'directive_causal_clearinghouse',
    dungeonId: 'causal_clearinghouse',
    name: '因果清算令',
    brief: '主神要求你完成因证与果证的双向存录，再以因果视镜核验清算结果。',
    requiredClears: 5,
    optionalObjectives: [
      clearRouteAnchors(
        'causal_clearinghouse_deposition_route',
        ['cause_deposition', 'effect_deposition'],
        '完成因证与果证存录'
      ),
      equipItem('causal_clearinghouse_causal_visor', 'causal_visor', '装备因果视镜核验账目'),
      lowDamage('causal_clearinghouse_low_damage', 56, '承伤不超过 56')
    ],
    reward: { rewardPoints: 1040, lingyun: 4, items: { causal_seal: 2 }, preview: '奖励点 1040、灵蕴 4、因果印章 2' }
  },
  {
    id: 'directive_entropy_ark',
    dungeonId: 'entropy_ark',
    name: '熵舟稳航令',
    brief: '主神要求你稳定方舟左右压舱核心，再以熵航罗盘锁定最终航向。',
    requiredClears: 5,
    optionalObjectives: [
      clearRouteAnchors(
        'entropy_ark_ballast_route',
        ['port_ballast_core', 'starboard_ballast_core'],
        '稳定左右舷压舱核心'
      ),
      equipItem('entropy_ark_entropy_compass', 'entropy_compass', '装备熵航罗盘锁定航向'),
      lowDamage('entropy_ark_low_damage', 64, '承伤不超过 64')
    ],
    reward: { rewardPoints: 1180, lingyun: 5, items: { entropy_crystal: 2 }, preview: '奖励点 1180、灵蕴 5、熵晶 2' }
  },
  {
    id: 'directive_mirror_cycle_city',
    dungeonId: 'mirror_cycle_city',
    name: '镜海归相令',
    brief: '主神要求你在现实与镜相中分别完成锚定，再以视差面甲确认归名路径。',
    requiredClears: 6,
    optionalObjectives: [
      clearRouteAnchors(
        'mirror_cycle_city_phase_anchor_route',
        ['real_anchor', 'mirror_anchor'],
        '分别锚定现实与镜相'
      ),
      equipItem('mirror_cycle_city_parallax_visor', 'parallax_visor', '装备视差面甲校正相位偏差'),
      lowDamage('mirror_cycle_city_low_damage', 70, '承伤不超过 70')
    ],
    reward: { rewardPoints: 1320, lingyun: 6, items: { phase_glass: 2 }, preview: '奖励点 1320、灵蕴 6、相位镜晶 2' }
  },
  {
    id: 'directive_redaction_scriptorium',
    dungeonId: 'redaction_scriptorium',
    name: '终稿三证令',
    brief: '主神要求你依次证明正文、记忆与归返三份条款，再以朱批断章刃完成终稿裁定。',
    requiredClears: 7,
    optionalObjectives: [
      clearRouteAnchors(
        'redaction_scriptorium_three_clause_route',
        ['body_clause_desk', 'memory_clause_desk', 'return_clause_desk'],
        '证明正文、记忆与归返三份条款'
      ),
      equipItem('redaction_scriptorium_redline_edge', 'redline_edge', '装备朱批断章刃裁定终稿'),
      lowDamage('redaction_scriptorium_low_damage', 76, '承伤不超过 76')
    ],
    reward: { rewardPoints: 1460, lingyun: 7, items: { redaction_ink: 2 }, preview: '奖励点 1460、灵蕴 7、删界墨 2' }
  },
  {
    id: 'directive_legacy_auction_court',
    dungeonId: 'legacy_auction_court',
    name: '遗产四席竞拍令',
    brief: '主神要求你证明武力、守备、术式与归返四席决断，完成至少两次有效出价，再由遗产槌裁定最终拍品。',
    requiredClears: 8,
    optionalObjectives: [
      proveAuctionDecisions(
        'legacy_auction_court_four_decisions_two_bids',
        ['force_lot_dais', 'guard_lot_dais', 'art_lot_dais', 'return_lot_dais'],
        ['force_claim_vault', 'guard_claim_vault', 'art_claim_vault', 'return_claim_vault'],
        2,
        '证明四席决断并完成至少两次出价'
      ),
      equipItem('legacy_auction_court_legacy_gavel', 'legacy_gavel', '装备遗产槌裁定最终拍品'),
      lowDamage('legacy_auction_court_low_damage', 82, '承伤不超过 82')
    ],
    reward: { rewardPoints: 1660, lingyun: 8, items: { legacy_scrip: 2 }, preview: '奖励点 1660、灵蕴 8、遗产筹码 2' }
  },
  {
    id: 'directive_genesis_vault',
    dungeonId: 'genesis_vault',
    name: '三序原型令',
    brief: '主神要求你完成三次基因拼接并保留至少两种表达，以本局冻结的有效血统样本通过典藏官核验。',
    requiredClears: 8,
    optionalObjectives: [
      completeGenesisSplices(
        'genesis_vault_three_splices_two_genes',
        3,
        2,
        '完成三次拼接且序列包含至少两种基因'
      ),
      activeBloodline('genesis_vault_active_bloodline', '本局冻结有效的活跃血统快照'),
      lowDamage('genesis_vault_low_damage', 88, '承伤不超过 88')
    ],
    reward: { rewardPoints: 760, lingyun: 3, items: { genesis_serum: 2 }, preview: '奖励点 760、灵蕴 3、原型血清 2' }
  },
  {
    id: 'directive_silent_broadcast_tower',
    dungeonId: 'silent_broadcast_tower',
    name: '三段静默令',
    brief: '主神要求你完成三座中继台的真实调谐，保留静默与广播两种选择，并以受控噪声快照面对播音主。',
    requiredClears: 8,
    optionalObjectives: [
      completeBroadcastRelays(
        'silent_broadcast_tower_three_relays_mixed',
        1,
        1,
        '结算三座中继且至少静默与广播各一次'
      ),
      limitBroadcastBossSnapshot(
        'silent_broadcast_tower_boss_snapshot',
        4,
        '播音主噪声快照不超过 4'
      ),
      lowDamage('silent_broadcast_tower_low_damage', 92, '承伤不超过 92')
    ],
    reward: { rewardPoints: 820, lingyun: 4, items: { silence_core: 2 }, preview: '奖励点 820、灵蕴 4、静默晶核 2' }
  },
  {
    id: 'directive_lost_shelter',
    dungeonId: 'lost_shelter',
    name: '三站救援令',
    brief: '主神要求你完成三处护送检查点，至少救治与强推各一次，并让幸存者以半数以上生命面对失联总控。',
    requiredClears: 8,
    optionalObjectives: [
      completeEscortCheckpoints(
        'lost_shelter_three_checkpoints_mixed',
        1,
        1,
        '结算三处检查点，至少救治与强推各一次且幸存者仍然存活'
      ),
      requireEscortBossSnapshot(
        'lost_shelter_boss_survivor_snapshot',
        50,
        '失联总控开战时幸存者生命快照至少 50'
      ),
      lowDamage('lost_shelter_low_damage', 98, '承伤不超过 98')
    ],
    reward: { rewardPoints: 880, lingyun: 4, items: { rescue_badge: 2 }, preview: '奖励点 880、灵蕴 4、救援铭牌 2' }
  },
  {
    id: 'directive_false_testimony_court',
    dungeonId: 'false_testimony_court',
    name: '三证裁定令',
    brief: '主神要求你揭示三份证据、至少净证两份，完成正确指控且不翻案，并以一致的终审快照面对伪证主审。',
    requiredClears: 8,
    optionalObjectives: [
      completeFalseTestimonyVerdict(
        'false_testimony_court_three_evidence_verdict',
        3,
        2,
        '揭示三证、至少净证两份并完成未翻案的正确指控'
      ),
      requireFalseTestimonyBossSnapshot(
        'false_testimony_court_boss_verdict_snapshot',
        2,
        '伪证主审开战时冻结正确且未翻案的三证裁定'
      ),
      lowDamage('false_testimony_court_low_damage', 105, '承伤不超过 105')
    ],
    reward: { rewardPoints: 950, lingyun: 4, items: { truth_fragment: 2 }, preview: '奖励点 950、灵蕴 4、真证碎片 2' }
  },
  {
    id: 'directive_combat_replay_stage',
    dungeonId: 'combat_replay_stage',
    name: '三段复演令',
    brief: '主神要求你完成甲、乙、丙三段录制，锁定一条复演路线，并以完整冻结母带击败终剪导演。',
    requiredClears: 8,
    optionalObjectives: [
      completeCombatReplay(
        'combat_replay_stage_three_takes_route_boss',
        '完成三段录制、选定复演路线并冻结 Boss 母带'
      ),
      lowDamage('combat_replay_stage_low_damage', 112, '承伤不超过 112')
    ],
    reward: { rewardPoints: 1020, lingyun: 4, items: { combat_reel: 2 }, preview: '奖励点 1020、灵蕴 4、战斗母带 2' }
  },
  {
    id: 'directive_panopticon_city',
    dungeonId: 'panopticon_city',
    name: '三盲区破幕令',
    brief: '主神要求你完成北、中、南三座盲区中继，锁定一条逃逸路线，并以冻结的全视快照击败监察官。',
    requiredClears: 8,
    optionalObjectives: [
      completePanopticonCity(
        'panopticon_city_three_relays_route_boss',
        '完成三座盲区中继、锁定逃逸路线并冻结 Boss 全视快照'
      ),
      lowDamage('panopticon_city_low_damage', 120, '承伤不超过 120')
    ],
    reward: { rewardPoints: 1090, lingyun: 5, items: { observation_shard: 2 }, preview: '奖励点 1090、灵蕴 5、观测棱片 2' }
  }
];

export function getDirectiveForDungeon(dungeonId: DungeonId): MainGodDirective {
  const directive = MAIN_GOD_DIRECTIVES.find((candidate) => candidate.dungeonId === dungeonId);
  if (!directive) throw new Error(`Missing main god directive for dungeon: ${dungeonId}`);

  return directive;
}

export function evaluateDirective(directive: MainGodDirective, summary: DirectiveRunSummary): DirectiveEvaluation {
  if (summary.dungeonId !== directive.dungeonId) {
    return {
      status: 'locked',
      progressText: `进入${directive.name}后开始记录`,
      rewardPreview: directive.reward.preview,
      objectiveResults: directive.optionalObjectives.map(getLockedObjectiveResult)
    };
  }

  const objectiveResults = directive.optionalObjectives.map((objective) => evaluateObjective(objective, summary));

  const clearedRequired = Math.min(summary.clearedNodeIds.length, directive.requiredClears);
  const progressText = `节点清理 ${clearedRequired}/${directive.requiredClears}`;
  const requiredComplete = summary.clearedNodeIds.length >= directive.requiredClears;
  const objectivesComplete = objectiveResults.every((objective) => objective.completed);

  return {
    status: !requiredComplete ? 'active' : objectivesComplete ? 'completed' : 'failed',
    progressText,
    rewardPreview: directive.reward.preview,
    objectiveResults
  };
}

function getLockedObjectiveResult(objective: DirectiveObjective): DirectiveObjectiveResult {
  return {
    id: objective.id,
    kind: objective.kind,
    label: objective.label,
    description: objective.description,
    completed: false,
    progressText: '尚未开始'
  };
}

function evaluateObjective(objective: DirectiveObjective, summary: DirectiveRunSummary): DirectiveObjectiveResult {
  let completed = false;
  let progressText = '尚未满足';

  if (objective.kind === 'low_damage' && objective.damageLimit !== undefined) {
    completed = summary.damageTaken <= objective.damageLimit;
    progressText = `承伤 ${summary.damageTaken}/${objective.damageLimit}`;
  } else if (objective.kind === 'capture') {
    const capturedThisRun = hasCapturedPet(summary.captures, objective.petId);
    const alreadyOwned = objective.petId !== undefined && summary.ownedPetIds?.includes(objective.petId) === true;
    completed = capturedThisRun || alreadyOwned;
    progressText = capturedThisRun
      ? '本轮已捕获'
      : alreadyOwned
        ? '已永久拥有'
        : getCaptureProgress(summary.captures);
  } else if (objective.kind === 'no_item') {
    completed = !objective.itemIds?.some((itemId) => summary.usedItems.includes(itemId));
    progressText = completed ? '未使用禁用道具' : '已使用禁用道具';
  } else if (objective.kind === 'method' && objective.methodId) {
    completed = summary.learnedMethods.includes(objective.methodId);
    progressText = completed ? '功法已掌握' : '缺少指定功法';
  } else if (objective.kind === 'equip' && objective.equipmentId) {
    completed = summary.equippedIds.includes(objective.equipmentId);
    progressText = completed ? '指定装备已生效' : '缺少指定装备';
  } else if (objective.kind === 'hidden_clear') {
    completed = summary.clearedNodeIds.length >= summary.totalNodes;
    progressText = `全图清理 ${summary.clearedNodeIds.length}/${summary.totalNodes}`;
  } else if (objective.kind === 'active_pet' && objective.petId) {
    completed = summary.activePet === objective.petId;
    progressText = completed ? '指定灵宠已出战' : '指定灵宠未出战';
  } else if (objective.kind === 'route' && objective.nodeIds) {
    const clearedAnchors = objective.nodeIds.filter((nodeId) => summary.clearedNodeIds.includes(nodeId)).length;
    completed = objective.nodeIds.length > 0 && clearedAnchors === objective.nodeIds.length;
    progressText = `路线锚点 ${clearedAnchors}/${objective.nodeIds.length}`;
  } else if (objective.kind === 'auction' && objective.nodeIds && objective.bidProofNodeIds && objective.minimumBidCount !== undefined) {
    const resolvedDecisions = objective.nodeIds.filter((nodeId) => summary.clearedNodeIds.includes(nodeId)).length;
    const bidCount = objective.bidProofNodeIds.filter((nodeId) => summary.clearedNodeIds.includes(nodeId)).length;
    completed = objective.nodeIds.length > 0 &&
      resolvedDecisions === objective.nodeIds.length &&
      bidCount >= objective.minimumBidCount;
    progressText = `拍卖决策 ${resolvedDecisions}/${objective.nodeIds.length}；竞价 ${Math.min(bidCount, objective.minimumBidCount)}/${objective.minimumBidCount}`;
  } else if (objective.kind === 'genesis_splice' && objective.requiredSpliceCount !== undefined && objective.minimumUniqueGeneCount !== undefined) {
    const law = getValidGenesisLawSnapshot(summary.lawState);
    const spliceCount = law?.spliceSequence.length ?? 0;
    const uniqueGeneCount = law ? new Set(law.spliceSequence).size : 0;
    completed = spliceCount === objective.requiredSpliceCount && uniqueGeneCount >= objective.minimumUniqueGeneCount;
    progressText = `拼接 ${spliceCount}/${objective.requiredSpliceCount}；不同基因 ${uniqueGeneCount}/${objective.minimumUniqueGeneCount}`;
  } else if (objective.kind === 'active_bloodline') {
    const law = getValidGenesisLawSnapshot(summary.lawState);
    completed = law !== undefined;
    progressText = completed ? '活性血脉快照有效' : '活性血脉快照缺失或无效';
  } else if (objective.kind === 'broadcast_relays' && objective.minimumMuteCount !== undefined && objective.minimumBroadcastCount !== undefined) {
    const status = getBroadcastDirectiveStatus(summary.lawState);
    completed = status.allRelaysResolved &&
      status.muteCount >= objective.minimumMuteCount &&
      status.broadcastCount >= objective.minimumBroadcastCount;
    progressText = `中继 ${status.resolvedCount}/3；静默 ${status.muteCount}/${objective.minimumMuteCount}；广播 ${status.broadcastCount}/${objective.minimumBroadcastCount}`;
  } else if (objective.kind === 'broadcast_snapshot' && objective.maximumBossNoiseSnapshot !== undefined) {
    const snapshot = getBroadcastDirectiveStatus(summary.lawState).bossNoiseSnapshot;
    completed = snapshot !== null && snapshot <= objective.maximumBossNoiseSnapshot;
    progressText = snapshot === null
      ? `首领噪声快照缺失（上限 ${objective.maximumBossNoiseSnapshot}）`
      : `首领噪声 ${snapshot}/${objective.maximumBossNoiseSnapshot}`;
  } else if (objective.kind === 'escort_checkpoints' && objective.minimumTreatCount !== undefined && objective.minimumPushCount !== undefined) {
    const status = getEscortDirectiveStatus(summary.lawState);
    completed = status.allCheckpointsResolved &&
      status.treatCount >= objective.minimumTreatCount &&
      status.pushCount >= objective.minimumPushCount &&
      (!objective.requireSurvivorAlive || status.survivorHp > 0);
    progressText = `检查点 ${status.resolvedCount}/3；救治 ${status.treatCount}/${objective.minimumTreatCount}；推进 ${status.pushCount}/${objective.minimumPushCount}；幸存者生命 ${status.survivorHp}`;
  } else if (objective.kind === 'escort_snapshot' && objective.minimumBossSurvivorSnapshot !== undefined) {
    const snapshot = getEscortDirectiveStatus(summary.lawState).bossSurvivorSnapshot;
    completed = snapshot !== null && snapshot >= objective.minimumBossSurvivorSnapshot;
    progressText = snapshot === null
      ? `首领战幸存者快照缺失（下限 ${objective.minimumBossSurvivorSnapshot}）`
      : `首领战幸存者生命 ${snapshot}/${objective.minimumBossSurvivorSnapshot}`;
  } else if (objective.kind === 'false_testimony_verdict' && objective.requiredEvidenceCount !== undefined && objective.minimumTrustedEvidenceCount !== undefined) {
    const status = getFalseTestimonyDirectiveStatus(summary.lawState);
    const revealedCount = status.evidence.filter(({ revealed }) => revealed).length;
    completed = revealedCount === objective.requiredEvidenceCount &&
      status.currentTrustedCount >= objective.minimumTrustedEvidenceCount &&
      (!objective.requireCorrectAccusation || status.accusationCorrect === true) &&
      (!objective.requireNoAppeal || !status.appealUsed);
    progressText = `证据 ${revealedCount}/${objective.requiredEvidenceCount}；可信 ${status.currentTrustedCount}/${objective.minimumTrustedEvidenceCount}；指控${status.accusationCorrect === true ? '正确' : '错误'}；${status.appealUsed ? '已申诉' : '未申诉'}`;
  } else if (objective.kind === 'false_testimony_snapshot' && objective.minimumTrustedEvidenceCount !== undefined) {
    const status = getFalseTestimonyDirectiveStatus(summary.lawState);
    const snapshot = status.bossVerdictSnapshot;
    completed = snapshot !== null &&
      snapshot.correct &&
      snapshot.trustedCount >= objective.minimumTrustedEvidenceCount &&
      !snapshot.appealed &&
      snapshot.suspect === status.accusedSuspect;
    progressText = snapshot === null
      ? '首领裁决快照缺失'
      : `首领战可信证据 ${snapshot.trustedCount}/${objective.minimumTrustedEvidenceCount}；裁决${snapshot.correct ? '正确' : '错误'}；${snapshot.appealed ? '已申诉' : '未申诉'}`;
  } else if (objective.kind === 'combat_replay_complete') {
    const status = getCombatReplayDirectiveStatus(summary.lawState);
    const bossCompleted = status.bossSnapshot !== null && summary.clearedNodeIds.includes('final_cut_director');
    completed = status.completedTakeCount === 3 && status.route !== null && bossCompleted;
    progressText = `镜次 ${status.completedTakeCount}/3；路线 ${status.route ?? '缺失'}；首领${bossCompleted ? '已完成' : '未完成'}`;
  } else if (objective.kind === 'panopticon_complete') {
    const status = getPanopticonDirectiveStatus(summary.lawState);
    const bossCompleted = status.bossSnapshotPresent && summary.clearedNodeIds.includes('all_sight_warden');
    completed = status.completedRelayCount === 3 && status.route !== null && bossCompleted;
    progressText = `中继 ${status.completedRelayCount}/3；路线 ${status.route ?? '缺失'}；首领${bossCompleted ? '已完成' : '未完成'}`;
  }

  return {
    id: objective.id,
    kind: objective.kind,
    label: objective.label,
    description: objective.description,
    completed,
    progressText
  };
}

type ValidGenesisLawSnapshot = Readonly<{
  spliceSequence: readonly GenesisGene[];
}>;

const GENESIS_GENES = new Set<GenesisGene>(['force', 'art', 'guard', 'renewal']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getValidGenesisLawSnapshot(value: unknown): ValidGenesisLawSnapshot | undefined {
  if (!isRecord(value) || value.rulesVersion !== 1 || value.dungeonId !== 'genesis_vault' || !isRecord(value.law)) return undefined;
  const law = value.law;
  if (law.kind !== 'genesis_vault' || !Array.isArray(law.spliceSequence) || !isRecord(law.entryBloodline)) return undefined;
  const spliceSequence = law.spliceSequence;
  if (spliceSequence.length > 3) return undefined;
  if (!spliceSequence.every((gene) => GENESIS_GENES.has(gene as GenesisGene))) return undefined;
  if (law.bossGenomeSnapshot !== null && law.bossGenomeSnapshot !== undefined) {
    if (!Array.isArray(law.bossGenomeSnapshot) || law.bossGenomeSnapshot.length !== 3) return undefined;
    if (!law.bossGenomeSnapshot.every((gene) => GENESIS_GENES.has(gene as GenesisGene))) return undefined;
    if (law.bossGenomeSnapshot.some((gene, index) => gene !== spliceSequence[index])) return undefined;
  }
  const { aspect, rank } = law.entryBloodline;
  if (!GENESIS_GENES.has(aspect as GenesisGene) || (rank !== 1 && rank !== 2 && rank !== 3)) return undefined;
  return { spliceSequence: spliceSequence as GenesisGene[] };
}

function lowDamage(id: string, damageLimit: number, label: string): DirectiveObjective {
  return {
    id,
    kind: 'low_damage',
    label,
    description: `本轮实际承伤会持续累计到出口结算；治疗不会回退累计值，结算时不超过 ${damageLimit}。`,
    damageLimit
  };
}

function capturePet(id: string, petId: PetId, label: string): DirectiveObjective {
  return {
    id,
    kind: 'capture',
    label,
    description: '在副本路线中完成指定灵宠捕获。',
    petId
  };
}

function noItem(id: string, itemIds: ItemId[], label: string): DirectiveObjective {
  return {
    id,
    kind: 'no_item',
    label,
    description: '完成本轮时不使用指定消耗品。',
    itemIds
  };
}

function useMethod(id: string, methodId: MethodId, label: string): DirectiveObjective {
  return {
    id,
    kind: 'method',
    label,
    description: '带着指定功法完成主神检定。',
    methodId
  };
}

function equipItem(id: string, equipmentId: EquipmentId, label: string): DirectiveObjective {
  return {
    id,
    kind: 'equip',
    label,
    description: '装备指定法器或武装完成路线。',
    equipmentId
  };
}

function hiddenClear(id: string, label: string): DirectiveObjective {
  return {
    id,
    kind: 'hidden_clear',
    label,
    description: '清完当前副本的全部节点，包含奖励和绕路节点。'
  };
}

function activePet(id: string, petId: PetId, label: string): DirectiveObjective {
  return {
    id,
    kind: 'active_pet',
    label,
    description: '携带指定灵宠完成主神检定。',
    petId
  };
}

function clearRouteAnchors(id: string, nodeIds: string[], label: string): DirectiveObjective {
  return {
    id,
    kind: 'route',
    label,
    description: '在同一轮路线中清理指定校准锚点。',
    nodeIds
  };
}

function proveAuctionDecisions(
  id: string,
  nodeIds: string[],
  bidProofNodeIds: string[],
  minimumBidCount: number,
  label: string
): DirectiveObjective {
  return {
    id,
    kind: 'auction',
    label,
    description: '在同一轮中裁定全部遗产拍品，并以竞得后才能进入的认领库证明最低出价次数。',
    nodeIds,
    bidProofNodeIds,
    minimumBidCount
  };
}

function completeGenesisSplices(
  id: string,
  requiredSpliceCount: number,
  minimumUniqueGeneCount: number,
  label: string
): DirectiveObjective {
  return {
    id,
    kind: 'genesis_splice',
    label,
    description: '从本局原型库法则快照核验完整拼接序列与基因多样性。',
    requiredSpliceCount,
    minimumUniqueGeneCount
  };
}

function activeBloodline(id: string, label: string): DirectiveObjective {
  return {
    id,
    kind: 'active_bloodline',
    label,
    description: '从本局入场法则快照核验有效的活跃血统与血统等级。'
  };
}

function completeBroadcastRelays(
  id: string,
  minimumMuteCount: number,
  minimumBroadcastCount: number,
  label: string
): DirectiveObjective {
  return {
    id,
    kind: 'broadcast_relays',
    label,
    description: '从本局寂声法则状态核验三座中继台均已结算，并同时保留静默与广播见证。',
    minimumMuteCount,
    minimumBroadcastCount
  };
}

function limitBroadcastBossSnapshot(
  id: string,
  maximumBossNoiseSnapshot: number,
  label: string
): DirectiveObjective {
  return {
    id,
    kind: 'broadcast_snapshot',
    label,
    description: '读取播音主战斗开始时由寂声法则冻结的真实噪声快照。',
    maximumBossNoiseSnapshot
  };
}

function completeEscortCheckpoints(
  id: string,
  minimumTreatCount: number,
  minimumPushCount: number,
  label: string
): DirectiveObjective {
  return {
    id,
    kind: 'escort_checkpoints',
    label,
    description: '从本局护送法则状态核验三处检查点、救治与强推选择，以及幸存者存活状态。',
    minimumTreatCount,
    minimumPushCount,
    requireSurvivorAlive: true
  };
}

function requireEscortBossSnapshot(
  id: string,
  minimumBossSurvivorSnapshot: number,
  label: string
): DirectiveObjective {
  return {
    id,
    kind: 'escort_snapshot',
    label,
    description: '读取失联总控战斗开始时由护送法则冻结的真实幸存者生命快照。',
    minimumBossSurvivorSnapshot
  };
}

function completeFalseTestimonyVerdict(
  id: string,
  requiredEvidenceCount: number,
  minimumTrustedEvidenceCount: number,
  label: string
): DirectiveObjective {
  return {
    id,
    kind: 'false_testimony_verdict',
    label,
    description: '从本局伪证法则状态核验三证揭示、净证数量、正确指控与未翻案状态。',
    requiredEvidenceCount,
    minimumTrustedEvidenceCount,
    requireCorrectAccusation: true,
    requireNoAppeal: true
  };
}

function requireFalseTestimonyBossSnapshot(
  id: string,
  minimumTrustedEvidenceCount: number,
  label: string
): DirectiveObjective {
  return {
    id,
    kind: 'false_testimony_snapshot',
    label,
    description: '读取伪证主审战斗开始时冻结的真实裁定快照，并核验正确指控、净证数量与未翻案状态。',
    minimumTrustedEvidenceCount,
    requireCorrectAccusation: true,
    requireNoAppeal: true
  };
}

function getBroadcastDirectiveStatus(value: unknown) {
  return getBroadcastRelayStatus(normalizeDungeonLawState(value, 'silent_broadcast_tower'));
}

function getEscortDirectiveStatus(value: unknown) {
  return getEscortCheckpointStatus(normalizeDungeonLawState(value, 'lost_shelter'), 0);
}

function getFalseTestimonyDirectiveStatus(value: unknown) {
  return getFalseTestimonyStatus(normalizeDungeonLawState(value, 'false_testimony_court'));
}

function getCombatReplayDirectiveStatus(value: unknown) {
  return getCombatReplayStatus(normalizeDungeonLawState(value, 'combat_replay_stage'));
}

function getPanopticonDirectiveStatus(value: unknown): {
  completedRelayCount: number;
  route: string | null;
  bossSnapshotPresent: boolean;
} {
  const normalized = normalizeDungeonLawState(value, 'panopticon_city');
  const law = normalized?.law;
  if (!law || law.kind !== 'panopticon_city') {
    return { completedRelayCount: 0, route: null, bossSnapshotPresent: false };
  }

  return {
    completedRelayCount: Object.values(law.relays).filter(Boolean).length,
    route: law.route,
    bossSnapshotPresent: law.bossSnapshot !== null
  };
}

function completeCombatReplay(id: string, label: string): DirectiveObjective {
  return {
    id,
    kind: 'combat_replay_complete',
    label,
    description: '从本局战斗复演法则状态核验三段录制、永久路线选择、Boss 冻结母带与终剪击破。'
  };
}

function completePanopticonCity(id: string, label: string): DirectiveObjective {
  return {
    id,
    kind: 'panopticon_complete',
    label,
    description: '从本局天幕监察法则状态核验三座盲区中继、永久路线选择、Boss 冻结快照与全视监察官击破。'
  };
}

function hasCapturedPet(captures: DirectiveRunSummary['captures'], petId?: PetId): boolean {
  if (Array.isArray(captures)) {
    return petId ? captures.includes(petId) : captures.length > 0;
  }

  return captures > 0;
}

function getCaptureProgress(captures: DirectiveRunSummary['captures']): string {
  return Array.isArray(captures) ? '尚未捕获指定灵宠' : `捕获 ${captures}/1`;
}

// Keep the catalog aligned with level content without making UI callers import level data.
for (const dungeonId of DUNGEON_ORDER) {
  getDirectiveForDungeon(dungeonId);
  DUNGEONS[dungeonId];
}
