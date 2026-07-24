import type { DungeonId, MonsterId, RewardBundle } from './game';

export type BossPhase = 'sealed' | 'awakened';

export type BossPhaseBonus = {
  readonly attackBonus: number;
  readonly defenseBonus: number;
};

export type BossDefinition = {
  readonly tier: number;
  readonly dungeonId: DungeonId;
  readonly nodeId: string;
  readonly monsterId: MonsterId;
  readonly bossTitle: string;
  readonly sealName: string;
  readonly openingLine: string;
  readonly awakenedPhaseName: string;
  readonly awakeningLine: string;
  readonly maxHpMultiplier: number;
  readonly sealed: BossPhaseBonus;
  readonly awakened: BossPhaseBonus;
  readonly bonusReward: RewardBundle;
};

export type BossCombatStats = {
  maxHp: number;
  attack: number;
  defense: number;
};

export type BossPhaseTransition = {
  phase: BossPhase;
  transitioned: boolean;
  statusLine: string;
};

export type BossSealProgress = {
  definition: BossDefinition;
  cleared: boolean;
  requirementText: string;
};

const BOSS_DEFINITIONS: Record<DungeonId, BossDefinition> = {
  demon_tower_1: {
    tier: 1,
    dungeonId: 'demon_tower_1',
    nodeId: 'bone_lane_monster',
    monsterId: 'tower_butcher',
    bossTitle: '雾塔剔骨监斩官',
    sealName: '白骨闭门阵',
    openingLine: '骨巷尽头，剔骨塔卒拖刀立在白骨闸前；只有它倒下，归路才会显形。',
    awakenedPhaseName: '血骨开铡',
    awakeningLine: '塔卒折断胸前骨锁，血雾灌入屠刀，白骨闸开始向内合拢。',
    maxHpMultiplier: 1.25,
    sealed: { attackBonus: 1, defenseBonus: 1 },
    awakened: { attackBonus: 3, defenseBonus: 1 },
    bonusReward: { rewardPoints: 140, lingyun: 1, items: { demon_bone: 2 } }
  },
  metro_abyss: {
    tier: 2,
    dungeonId: 'metro_abyss',
    nodeId: 'mirror_thread_spider',
    monsterId: 'mirror_thread_spider',
    bossTitle: '镜潮织命蛛后',
    sealName: '倒影缄默锁',
    openingLine: '末班站台的灯逐盏熄灭，织蛛把每一面倒影缝成封死出口的网。',
    awakenedPhaseName: '万镜结网',
    awakeningLine: '蛛腹映出成百上千条轨道，镜丝从所有错误的归途同时收紧。',
    maxHpMultiplier: 1.3,
    sealed: { attackBonus: 2, defenseBonus: 1 },
    awakened: { attackBonus: 4, defenseBonus: 2 },
    bonusReward: { rewardPoints: 180, lingyun: 1, items: { mirror_shell: 2 } }
  },
  starfall_mine: {
    tier: 3,
    dungeonId: 'starfall_mine',
    nodeId: 'molt_beast_den',
    monsterId: 'portal_molt_beast',
    bossTitle: '星脉裂门蜕王',
    sealName: '坠星矿脉封条',
    openingLine: '透明旧皮铺满矿井深处，蜕兽伏在星核上，用呼吸牵动整条裂隙。',
    awakenedPhaseName: '星核再蜕',
    awakeningLine: '蜕兽撕开旧壳吞下星屑，新生甲片把周围界门折成锋利棱面。',
    maxHpMultiplier: 1.36,
    sealed: { attackBonus: 3, defenseBonus: 2 },
    awakened: { attackBonus: 5, defenseBonus: 3 },
    bonusReward: { rewardPoints: 220, lingyun: 1, items: { star_iron: 1, cracked_core: 1 } }
  },
  rust_hospital: {
    tier: 4,
    dungeonId: 'rust_hospital',
    nodeId: 'chief_pulse_doctor',
    monsterId: 'pulse_doctor',
    bossTitle: '终诊脉冲主治',
    sealName: '红线隔离协议',
    openingLine: '停机坪前的心电屏齐声蜂鸣，主治医师把出口列为最后一张病床。',
    awakenedPhaseName: '心律过载',
    awakeningLine: '医师扯断限流导线，整层病院的脉冲与它的心跳重叠成一记重音。',
    maxHpMultiplier: 1.42,
    sealed: { attackBonus: 4, defenseBonus: 2 },
    awakened: { attackBonus: 6, defenseBonus: 4 },
    bonusReward: { rewardPoints: 260, lingyun: 2, items: { medicine_ash: 2, method_page: 1 } }
  },
  ash_arena: {
    tier: 5,
    dungeonId: 'ash_arena',
    nodeId: 'furnace_judge',
    monsterId: 'furnace_judge',
    bossTitle: '熔炉终审裁判',
    sealName: '冠军烙印门',
    openingLine: '裁判敲响炉心铁槌，观众席的余烬升起，等着给唯一的败者烙印。',
    awakenedPhaseName: '熔炉改判',
    awakeningLine: '裁判撕碎旧判词，炉火沿竞技场边线倒灌，把每次出手都列入终审。',
    maxHpMultiplier: 1.48,
    sealed: { attackBonus: 5, defenseBonus: 3 },
    awakened: { attackBonus: 7, defenseBonus: 4 },
    bonusReward: { rewardPoints: 310, lingyun: 2, items: { cracked_core: 1, star_iron: 1 } }
  },
  dream_archive: {
    tier: 6,
    dungeonId: 'dream_archive',
    nodeId: 'dream_jailer_second',
    monsterId: 'dream_jailer',
    bossTitle: '失名梦牢典守',
    sealName: '无眠索引锁',
    openingLine: '副钥看守翻开没有署名的档案，你的归途随页码一起被锁进梦牢。',
    awakenedPhaseName: '倒页审讯',
    awakeningLine: '档案从末页向前燃烧，看守把被遗忘的失败逐条钉回现实。',
    maxHpMultiplier: 1.54,
    sealed: { attackBonus: 6, defenseBonus: 3 },
    awakened: { attackBonus: 8, defenseBonus: 5 },
    bonusReward: { rewardPoints: 370, lingyun: 3, items: { method_page: 2, hidden_stone: 1 } }
  },
  void_citadel: {
    tier: 7,
    dungeonId: 'void_citadel',
    nodeId: 'main_god_echo',
    monsterId: 'main_god_echo',
    bossTitle: '失衡主神残响',
    sealName: '终局权限封印',
    openingLine: '王座上的残响读取你的每一项成长，空城出口随它的权限一同沉默。',
    awakenedPhaseName: '全域同调',
    awakeningLine: '残响舍弃人形，整座虚界城化为它的回声，开始同步你的最强一面。',
    maxHpMultiplier: 1.6,
    sealed: { attackBonus: 7, defenseBonus: 4 },
    awakened: { attackBonus: 10, defenseBonus: 6 },
    bonusReward: { rewardPoints: 440, lingyun: 4, items: { cracked_core: 2, rift_dust: 2 } }
  },
  temporal_observatory: {
    tier: 8,
    dungeonId: 'temporal_observatory',
    nodeId: 'zero_hour_regent',
    monsterId: 'zero_hour_regent',
    bossTitle: '零时摄政王',
    sealName: '双纪校准封印',
    openingLine: '过去与未来的刻度同时停摆，零时摄政王立于中央摆轮前，拒绝承认下一瞬的到来。',
    awakenedPhaseName: '零点改纪',
    awakeningLine: '摄政王击碎停摆的表盘，把两条时间线压进同一个无法回避的零点。',
    maxHpMultiplier: 1.66,
    sealed: { attackBonus: 8, defenseBonus: 5 },
    awakened: { attackBonus: 11, defenseBonus: 7 },
    bonusReward: { rewardPoints: 520, lingyun: 5, items: { chronal_glass: 2 } }
  },
  causal_clearinghouse: {
    tier: 9,
    dungeonId: 'causal_clearinghouse',
    nodeId: 'zero_sum_auditor',
    monsterId: 'zero_sum_auditor',
    bossTitle: '因果零和总审计官',
    sealName: '终审轧差封印',
    openingLine: '原因与结果的卷宗同时合拢，零和审计官坐在终审席上，要求所有收益立刻偿付等额代价。',
    awakenedPhaseName: '因果归零',
    awakeningLine: '审计官撕去账本的中间页，把尚未发生的原因与已经生效的结果强行轧进同一笔赤字。',
    maxHpMultiplier: 1.72,
    sealed: { attackBonus: 9, defenseBonus: 6 },
    awakened: { attackBonus: 12, defenseBonus: 8 },
    bonusReward: { rewardPoints: 610, lingyun: 6, items: { causal_seal: 2 } }
  },
  entropy_ark: {
    tier: 10,
    dungeonId: 'entropy_ark',
    nodeId: 'last_helmsman',
    monsterId: 'last_helmsman',
    bossTitle: '熵海终末舵手',
    sealName: '热寂离航封印',
    openingLine: '双舷压载停止响应，终末舵手握住崩解中的舵轮，把离航闸锁向热寂深处。',
    awakenedPhaseName: '方舟崩解',
    awakeningLine: '舵手折断最后一根稳航杆，方舟崩解层沿龙骨迸发，所有航迹开始滑向同一场热寂。',
    maxHpMultiplier: 1.78,
    sealed: { attackBonus: 10, defenseBonus: 7 },
    awakened: { attackBonus: 13, defenseBonus: 9 },
    bonusReward: { rewardPoints: 700, lingyun: 7, items: { entropy_crystal: 2 } }
  },
  mirror_cycle_city: {
    tier: 11,
    dungeonId: 'mirror_cycle_city',
    nodeId: 'nameless_reflection',
    monsterId: 'nameless_reflection',
    bossTitle: '无名镜王',
    sealName: '真伪归名封印',
    openingLine: '三次相位选择在王座前重叠，无名镜王从每一面未被锚定的倒影中同时起身。',
    awakenedPhaseName: '万相无名',
    awakeningLine: '镜王抹去最后一张面孔，现实与镜相的裂缝一齐映出没有归属的王冠。',
    maxHpMultiplier: 1.84,
    sealed: { attackBonus: 11, defenseBonus: 8 },
    awakened: { attackBonus: 14, defenseBonus: 10 },
    bonusReward: { rewardPoints: 800, lingyun: 8, items: { phase_glass: 2 } }
  },
  redaction_scriptorium: {
    tier: 12,
    dungeonId: 'redaction_scriptorium',
    nodeId: 'last_redactor',
    monsterId: 'last_redactor',
    bossTitle: '终稿删界官',
    sealName: '三证终稿封印',
    openingLine: '正文、记忆与归返三份校样在终稿席前合拢，删界官提笔裁定哪一个你有资格留下。',
    awakenedPhaseName: '反向删界',
    awakeningLine: '删界官倒转终稿红线，把已经获准存在的句子逐字改判为应删废文。',
    maxHpMultiplier: 1.9,
    sealed: { attackBonus: 12, defenseBonus: 9 },
    awakened: { attackBonus: 16, defenseBonus: 11 },
    bonusReward: { rewardPoints: 900, lingyun: 9, items: { redaction_ink: 2 } }
  },
  legacy_auction_court: {
    tier: 13,
    dungeonId: 'legacy_auction_court',
    nodeId: 'estate_auctioneer',
    monsterId: 'estate_auctioneer',
    bossTitle: '遗产执槌人',
    sealName: '四席保价封印',
    openingLine: '四席报价在终拍台前同时封存，遗产执槌人举起旧队长的槌，宣布所有来者都只是待估价的遗物。',
    awakenedPhaseName: '全场落槌',
    awakeningLine: '执槌人敲响最终拍铃，四席报价化作同一声裁定，整座拍卖庭开始追缴每一份未结遗产。',
    maxHpMultiplier: 1.95,
    sealed: { attackBonus: 13, defenseBonus: 10 },
    awakened: { attackBonus: 18, defenseBonus: 12 },
    bonusReward: { rewardPoints: 1000, lingyun: 10, items: { legacy_scrip: 2 } }
  },
  genesis_vault: {
    tier: 14,
    dungeonId: 'genesis_vault',
    nodeId: 'primal_curator',
    monsterId: 'primal_curator',
    bossTitle: '原型典藏官',
    sealName: '三序基因封印',
    openingLine: '三段基因序列在归档厅合拢，原型典藏官展开众生蓝本，拒绝放行任何未经定型的生命。',
    awakenedPhaseName: '始祖回写',
    awakeningLine: '典藏官将冻结序列回写进始祖原型，四类生命表达同时沿培养壁苏醒。',
    maxHpMultiplier: 2,
    sealed: { attackBonus: 14, defenseBonus: 11 },
    awakened: { attackBonus: 19, defenseBonus: 13 },
    bonusReward: { rewardPoints: 1100, lingyun: 11, items: { genesis_serum: 2 } }
  },
  silent_broadcast_tower: {
    tier: 15,
    dungeonId: 'silent_broadcast_tower',
    nodeId: 'last_broadcaster',
    monsterId: 'last_broadcaster',
    bossTitle: '末频道播音主',
    sealName: '三段静默封印',
    openingLine: '三座中继台的选择汇入主播播间，末频道播音主抬起无声话筒，准备把整座城市改写成最后一批听众。',
    awakenedPhaseName: '全城共振',
    awakeningLine: '播音主撕开最后一层静默封套，全城遗留的接收器同时震响，把每一道死频叠成同一段共振。',
    maxHpMultiplier: 2.05,
    sealed: { attackBonus: 15, defenseBonus: 12 },
    awakened: { attackBonus: 20, defenseBonus: 14 },
    bonusReward: { rewardPoints: 1200, lingyun: 12, items: { silence_core: 2 } }
  },
  lost_shelter: {
    tier: 16,
    dungeonId: 'lost_shelter',
    nodeId: 'shelter_overseer',
    monsterId: 'shelter_overseer',
    bossTitle: '失联总控',
    sealName: '三站护送封印',
    openingLine: '三处检查点的护送记录汇入总控室，失联总控展开无人应答名单，准备接管仍然存活的所有编号。',
    awakenedPhaseName: '全员接管',
    awakeningLine: '总控撕去最后一条人工撤离指令，把避难所内每个生命信号改写为等待接管的系统资源。',
    maxHpMultiplier: 2.1,
    sealed: { attackBonus: 16, defenseBonus: 13 },
    awakened: { attackBonus: 22, defenseBonus: 15 },
    bonusReward: { rewardPoints: 1300, lingyun: 13, items: { rescue_badge: 2 } }
  },
  false_testimony_court: {
    tier: 17,
    dungeonId: 'false_testimony_court',
    nodeId: 'false_testimony_judge',
    monsterId: 'false_testimony_judge',
    bossTitle: '伪证主审',
    sealName: '三证裁决封印',
    openingLine: '声纹、时间线与残留物三份证据在终审席前合拢，伪证主审展开预写判词，准备把调查者裁成唯一的伪证人。',
    awakenedPhaseName: '终审翻案',
    awakeningLine: '主审撕开已经落款的裁定，把每一处删改重新宣读为合法证词，整座裁定庭开始逆向翻案。',
    maxHpMultiplier: 2.2,
    sealed: { attackBonus: 17, defenseBonus: 14 },
    awakened: { attackBonus: 23, defenseBonus: 16 },
    bonusReward: { rewardPoints: 1400, lingyun: 14, items: { truth_fragment: 2 } }
  },
  combat_replay_stage: {
    tier: 18,
    dungeonId: 'combat_replay_stage',
    nodeId: 'final_cut_director',
    monsterId: 'final_cut_director',
    bossTitle: '终剪导演',
    sealName: '三段封片锁',
    openingLine: '甲、乙、丙三段战斗母带在终剪台前合拢，终剪导演展开预写结局，准备删去所有不服从剧本的胜利镜头。',
    awakenedPhaseName: '删镜杀青',
    awakeningLine: '导演撕开已经封片的母带，把每一处战痕重新剪成失败镜头，整座复演场开始逆向重拍。',
    maxHpMultiplier: 2.3,
    sealed: { attackBonus: 18, defenseBonus: 15 },
    awakened: { attackBonus: 24, defenseBonus: 17 },
    bonusReward: { rewardPoints: 1500, lingyun: 15, items: { combat_reel: 2 } }
  },
  panopticon_city: {
    tier: 19,
    dungeonId: 'panopticon_city',
    nodeId: 'all_sight_warden',
    monsterId: 'all_sight_warden',
    bossTitle: '万目监察者',
    sealName: '三相盲区锁',
    openingLine: '三座盲区中继同时倒转，万目监察者冻结路线、曝光与折光快照，整座城市的视线收束到唯一目标。',
    awakenedPhaseName: '万目齐睁',
    awakeningLine: '监察者撕开天幕总锁，所有被遮蔽的镜头同时睁眼，三相扫描开始逆向追溯每一步移动。',
    maxHpMultiplier: 2.4,
    sealed: { attackBonus: 19, defenseBonus: 16 },
    awakened: { attackBonus: 25, defenseBonus: 18 },
    bonusReward: { rewardPoints: 1600, lingyun: 16, items: { observation_shard: 2 } }
  }
};

function toNonNegativeInteger(value: number): number {
  // Simulation inputs may be malformed, so keep public combat stats finite and integral.
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.round(value)));
}

export function getBossDefinition(dungeonId: DungeonId): BossDefinition {
  return BOSS_DEFINITIONS[dungeonId];
}

export function getBossDefinitionForNode(dungeonId: DungeonId, nodeId: string): BossDefinition | undefined {
  const definition = getBossDefinition(dungeonId);
  return definition.nodeId === nodeId ? definition : undefined;
}

export function getBossCombatStats(
  definition: BossDefinition,
  baseStats: BossCombatStats,
  phase: BossPhase
): BossCombatStats {
  const phaseBonus = definition[phase];
  const baseMaxHp = toNonNegativeInteger(baseStats.maxHp);
  const baseAttack = toNonNegativeInteger(baseStats.attack);
  const baseDefense = toNonNegativeInteger(baseStats.defense);

  return {
    maxHp: Math.max(1, toNonNegativeInteger(baseMaxHp * definition.maxHpMultiplier)),
    attack: toNonNegativeInteger(baseAttack + phaseBonus.attackBonus),
    defense: toNonNegativeInteger(baseDefense + phaseBonus.defenseBonus)
  };
}

export function getBossPhaseTransition(
  definition: BossDefinition,
  currentPhase: BossPhase,
  monsterHp: number,
  bossMaxHp: number
): BossPhaseTransition {
  if (currentPhase === 'awakened') {
    return { phase: 'awakened', transitioned: false, statusLine: '' };
  }

  // Invalid HP snapshots must never fabricate a one-time awakening event.
  if (!Number.isFinite(monsterHp) || !Number.isFinite(bossMaxHp) || bossMaxHp <= 0) {
    return { phase: 'sealed', transitioned: false, statusLine: '' };
  }

  if (monsterHp > bossMaxHp / 2) {
    return { phase: 'sealed', transitioned: false, statusLine: '' };
  }

  return {
    phase: 'awakened',
    transitioned: true,
    statusLine: `【${definition.awakenedPhaseName}】${definition.awakeningLine}`
  };
}

export function getBossSealProgress(dungeonId: DungeonId, clearedNodeIds: readonly string[]): BossSealProgress {
  const definition = getBossDefinition(dungeonId);
  const cleared = clearedNodeIds.includes(definition.nodeId);

  return {
    definition,
    cleared,
    requirementText: cleared
      ? `出口封印 1/1：「${definition.sealName}」已解除。`
      : `出口封印 0/1：击败「${definition.bossTitle}」，解除「${definition.sealName}」。`
  };
}
