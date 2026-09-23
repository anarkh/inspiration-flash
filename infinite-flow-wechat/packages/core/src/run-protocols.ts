import { getBossDefinition } from './boss-system';
import { DUNGEONS, DUNGEON_ORDER } from './level-content';
import type { DungeonId, DungeonNode, ItemId, MonsterDefinition } from './game';

export const RUN_PROTOCOL_IDS = ['standard', 'imprint', 'deep'] as const;

export type RunProtocolId = (typeof RUN_PROTOCOL_IDS)[number];
export type RunProtocolTrap = NonNullable<DungeonNode['trap']>;
export type CycleImprintId =
  | 'mist_reverse_mark'
  | 'last_train_tide_mark'
  | 'star_vein_plumb_mark'
  | 'redline_triage_mark'
  | 'ember_verdict_mark'
  | 'lost_page_index_mark'
  | 'echo_balance_mark'
  | 'chronometer_entry_mark'
  | 'causal_docket_mark'
  | 'entropy_manifest_mark'
  | 'mirror_cycle_mark'
  | 'final_proof_mark'
  | 'hammer_chain_mark'
  | 'genesis_mosaic_mark'
  | 'last_broadcast_mark'
  | 'survivor_roll_call_mark'
  | 'cross_exam_verdict_mark'
  | 'script_projection_mark'
  | 'inverse_observation_mark';

export type CycleImprintDefinition = {
  readonly id: CycleImprintId;
  readonly name: string;
  readonly description: string;
};

export type RunProtocolModifiers = {
  readonly enemyStatMultiplierPercent: number;
  readonly trapDamageMultiplierPercent: number;
  readonly trapDcMultiplierPercent: number;
  readonly unmetAnchorBossMultiplierPercent: number;
  readonly clearRewardPointMultiplierPercent: number;
};

type RunProtocolDefinitionBase = {
  readonly id: RunProtocolId;
  readonly dungeonId: DungeonId;
  readonly name: string;
  readonly description: string;
  readonly modifiers: RunProtocolModifiers;
};

export type StandardRunProtocolDefinition = RunProtocolDefinitionBase & {
  readonly id: 'standard';
};

export type ImprintRunProtocolDefinition = RunProtocolDefinitionBase & {
  readonly id: 'imprint';
  readonly requiredNodeId: string;
  readonly objectiveText: string;
  readonly imprint: CycleImprintDefinition;
};

export type DeepRunProtocolDefinition = RunProtocolDefinitionBase & {
  readonly id: 'deep';
  readonly requiredNodeIds: readonly [string, string];
  readonly objectiveText: string;
  readonly mutationName: string;
  readonly materialReward: {
    readonly itemId: ItemId;
    readonly amount: 2;
  };
};

export type RunProtocolDefinition =
  | StandardRunProtocolDefinition
  | ImprintRunProtocolDefinition
  | DeepRunProtocolDefinition;

export type RunProtocolMonsterContext = {
  readonly isBoss?: boolean;
  readonly anchorCompletedBeforeBoss?: boolean;
};

export type RunProtocolRewardEvaluationInput = {
  readonly dungeonId: DungeonId;
  readonly protocolId: RunProtocolId;
  readonly clearedNodeIds: readonly string[];
  readonly baseRewardPoints: number;
};

export type RunProtocolRewardEvaluation = {
  readonly bossDefeated: boolean;
  readonly anchorCompletedBeforeBoss: boolean;
  readonly completedAnchorCount: number;
  readonly requiredAnchorCount: number;
  readonly canGrantProtocolReward: boolean;
  readonly rewardPoints: number;
  readonly imprint?: CycleImprintDefinition;
  readonly materialReward?: DeepRunProtocolDefinition['materialReward'];
};

const IDENTITY_MODIFIERS: RunProtocolModifiers = {
  enemyStatMultiplierPercent: 100,
  trapDamageMultiplierPercent: 100,
  trapDcMultiplierPercent: 100,
  unmetAnchorBossMultiplierPercent: 100,
  clearRewardPointMultiplierPercent: 100
};

const IMPRINT_PROTOCOLS: Readonly<Record<DungeonId, ImprintRunProtocolDefinition>> = {
  demon_tower_1: {
    id: 'imprint',
    dungeonId: 'demon_tower_1',
    name: '逆阶镇雾协议',
    description: '妖雾沿旧阶倒灌，必须先绕行塔底镇住咒水，再迎战白骨闸前的监斩官。',
    requiredNodeId: 'risky_font_trap',
    objectiveText: '先绕至塔底咒水井并镇住咒水，再挑战雾塔监斩官。',
    modifiers: {
      enemyStatMultiplierPercent: 112,
      trapDamageMultiplierPercent: 118,
      trapDcMultiplierPercent: 108,
      unmetAnchorBossMultiplierPercent: 124,
      clearRewardPointMultiplierPercent: 132
    },
    imprint: {
      id: 'mist_reverse_mark',
      name: '雾阶逆行印',
      description: '记录逆着妖雾重走旧阶、再封白骨闸的轮回。'
    }
  },
  metro_abyss: {
    id: 'imprint',
    dungeonId: 'metro_abyss',
    name: '末班回潮协议',
    description: '镜潮淹没近路，先去废线深处取得回声凭证，才能让蛛后的倒影失去先机。',
    requiredNodeId: 'echo_coin_vendor',
    objectiveText: '先绕到检修层启动回声贩卖机，再返回末班站台讨伐蛛后。',
    modifiers: {
      enemyStatMultiplierPercent: 114,
      trapDamageMultiplierPercent: 121,
      trapDcMultiplierPercent: 110,
      unmetAnchorBossMultiplierPercent: 127,
      clearRewardPointMultiplierPercent: 136
    },
    imprint: {
      id: 'last_train_tide_mark',
      name: '末班潮汐印',
      description: '保留废线回声，令每次归站都记得真正的末班方向。'
    }
  },
  starfall_mine: {
    id: 'imprint',
    dungeonId: 'starfall_mine',
    name: '星脉垂准协议',
    description: '错乱重力把矿脉折向北壁，先校准星铁脉，才能稳定裂门蜕王周围的界面。',
    requiredNodeId: 'north_star_vein',
    objectiveText: '先绕往北壁星铁脉完成垂准，再下井挑战裂门蜕王。',
    modifiers: {
      enemyStatMultiplierPercent: 117,
      trapDamageMultiplierPercent: 123,
      trapDcMultiplierPercent: 113,
      unmetAnchorBossMultiplierPercent: 130,
      clearRewardPointMultiplierPercent: 141
    },
    imprint: {
      id: 'star_vein_plumb_mark',
      name: '星脉垂准印',
      description: '把颠倒矿井的重力基准烙进轮回，使星脉不再漂移。'
    }
  },
  rust_hospital: {
    id: 'imprint',
    dungeonId: 'rust_hospital',
    name: '逆行终诊协议',
    description: '病院把撤离者重新列入诊疗队列，必须先取回手术室遗包，再接受天台终诊。',
    requiredNodeId: 'surgical_theater_reward',
    objectiveText: '先绕至手术室取回遗包并注销病历，再迎战终诊主治。',
    modifiers: {
      enemyStatMultiplierPercent: 119,
      trapDamageMultiplierPercent: 126,
      trapDcMultiplierPercent: 115,
      unmetAnchorBossMultiplierPercent: 134,
      clearRewardPointMultiplierPercent: 145
    },
    imprint: {
      id: 'redline_triage_mark',
      name: '红线分诊印',
      description: '将被病院抹去的出院次序重新写回红线病历。'
    }
  },
  ash_arena: {
    id: 'imprint',
    dungeonId: 'ash_arena',
    name: '支路改判协议',
    description: '竞技场封存了被忽略的支路奖杯，先夺回它，才能迫使裁判承认新的胜负条件。',
    requiredNodeId: 'champion_branch_reward',
    objectiveText: '先绕入烟沟后的支路夺回奖杯，再回到炉心接受终审。',
    modifiers: {
      enemyStatMultiplierPercent: 122,
      trapDamageMultiplierPercent: 129,
      trapDcMultiplierPercent: 118,
      unmetAnchorBossMultiplierPercent: 137,
      clearRewardPointMultiplierPercent: 151
    },
    imprint: {
      id: 'ember_verdict_mark',
      name: '余烬改判印',
      description: '保存一次由挑战者亲手改写的熔炉判词。'
    }
  },
  dream_archive: {
    id: 'imprint',
    dungeonId: 'dream_archive',
    name: '失页追索协议',
    description: '档案馆删去了关键索引，先从远端书架找回裂核目录，才能锁定梦牢典守的真名。',
    requiredNodeId: 'cracked_core_index_reward',
    objectiveText: '先绕至裂核索引架补全目录，再前往封底梦牢击败典守。',
    modifiers: {
      enemyStatMultiplierPercent: 124,
      trapDamageMultiplierPercent: 132,
      trapDcMultiplierPercent: 120,
      unmetAnchorBossMultiplierPercent: 141,
      clearRewardPointMultiplierPercent: 156
    },
    imprint: {
      id: 'lost_page_index_mark',
      name: '失页索引印',
      description: '让被覆写的关键页在下一次梦境里仍可被检索。'
    }
  },
  void_citadel: {
    id: 'imprint',
    dungeonId: 'void_citadel',
    name: '全域回声协议',
    description: '主神残响监听最短路径，先横穿城门支路封存旧回声，才能切断它的全域同调。',
    requiredNodeId: 'echo_branch_cache',
    objectiveText: '先绕至回声门尽头封存旧回声，再返回核心挑战主神残响。',
    modifiers: {
      enemyStatMultiplierPercent: 127,
      trapDamageMultiplierPercent: 135,
      trapDcMultiplierPercent: 123,
      unmetAnchorBossMultiplierPercent: 145,
      clearRewardPointMultiplierPercent: 162
    },
    imprint: {
      id: 'echo_balance_mark',
      name: '回声均衡印',
      description: '封存一次跨越全城的均衡校准，使终局回声无法只追随最强一面。'
    }
  },
  temporal_observatory: {
    id: 'imprint',
    dungeonId: 'temporal_observatory',
    name: '入庭定序协议',
    description: '入口计时器把来访者锁进错误刻度，先校准入庭时标，才能让零时摄政显露当前纪元。',
    requiredNodeId: 'entry_chronometer',
    objectiveText: '先校准入口计时器并固定当前时标，再前往零时王座挑战零时摄政。',
    modifiers: {
      enemyStatMultiplierPercent: 129,
      trapDamageMultiplierPercent: 138,
      trapDcMultiplierPercent: 125,
      unmetAnchorBossMultiplierPercent: 149,
      clearRewardPointMultiplierPercent: 168
    },
    imprint: {
      id: 'chronometer_entry_mark',
      name: '入庭定序印',
      description: '将进入观测庭的第一刻固定在轮回中，避免归途被改写到错误纪元。'
    }
  },
  causal_clearinghouse: {
    id: 'imprint',
    dungeonId: 'causal_clearinghouse',
    name: '入案定因协议',
    description: '清算所会在入庭时倒置因果债权，先核验入口案票，才能让终局判词承认你的原始身份。',
    requiredNodeId: 'entry_docket',
    objectiveText: '先在入口案票处完成身份核验，再前往清算庭挑战因果主审。',
    modifiers: {
      enemyStatMultiplierPercent: 132,
      trapDamageMultiplierPercent: 141,
      trapDcMultiplierPercent: 128,
      unmetAnchorBossMultiplierPercent: 153,
      clearRewardPointMultiplierPercent: 174
    },
    imprint: {
      id: 'causal_docket_mark',
      name: '入案因果印',
      description: '保存最初入案时的因果顺序，使复刷中的债权倒置无法抹去来路。'
    }
  },
  entropy_ark: {
    id: 'imprint',
    dungeonId: 'entropy_ark',
    name: '熵舱清单协议',
    description: '方舟会持续改写仍在航行的舱室清单，先核对显化锚点，才能让末舵手承认本轮航线。',
    requiredNodeId: 'ark_manifest',
    objectiveText: '先在方舟清单锚点核验熵舱清单，再前往末舵台挑战末舵手。',
    modifiers: {
      enemyStatMultiplierPercent: 135,
      trapDamageMultiplierPercent: 144,
      trapDcMultiplierPercent: 131,
      unmetAnchorBossMultiplierPercent: 157,
      clearRewardPointMultiplierPercent: 180
    },
    imprint: {
      id: 'entropy_manifest_mark',
      name: '熵舱清单印',
      description: '把核验后的熵舱清单烙进轮回，使耗散航迹无法再次注销已显化的舱室。'
    }
  },
  mirror_cycle_city: {
    id: 'imprint',
    dungeonId: 'mirror_cycle_city',
    name: '现实定相协议',
    description: '镜城会把未被承认的现实折回镜海，先在现实相位完成锚定，才能让无名镜王显出可归名的本体。',
    requiredNodeId: 'real_anchor',
    objectiveText: '先在现实相位激活现实锚，再前往镜海王座挑战无名镜王。',
    modifiers: {
      enemyStatMultiplierPercent: 138,
      trapDamageMultiplierPercent: 147,
      trapDcMultiplierPercent: 134,
      unmetAnchorBossMultiplierPercent: 161,
      clearRewardPointMultiplierPercent: 186
    },
    imprint: {
      id: 'mirror_cycle_mark',
      name: '镜海轮回印',
      description: '保存现实锚确认过的本体轮廓，使下一次轮回不再从无名倒影开始。'
    }
  },
  redaction_scriptorium: {
    id: 'imprint',
    dungeonId: 'redaction_scriptorium',
    name: '终校定版协议',
    description: '终稿院会撤回未经终校的现实，先在终校枢纽固定三证合稿，才能让删界官承认唯一正文。',
    requiredNodeId: 'final_proof_nexus',
    objectiveText: '先在终校事件枢纽固定最终校样，再前往终稿席挑战删界官。',
    modifiers: {
      enemyStatMultiplierPercent: 141,
      trapDamageMultiplierPercent: 150,
      trapDcMultiplierPercent: 137,
      unmetAnchorBossMultiplierPercent: 165,
      clearRewardPointMultiplierPercent: 192
    },
    imprint: {
      id: 'final_proof_mark',
      name: '终校定版印',
      description: '保存三证合稿的终校身份，使下一次轮回不再从可删除的草稿开始。'
    }
  },
  legacy_auction_court: {
    id: 'imprint',
    dungeonId: 'legacy_auction_court',
    name: '执槌链验真协议',
    description: '拍卖庭会替换历任执槌者的来源记录，先在来源争议台核验执槌链，才能证明最终落槌并非伪造继承。',
    requiredNodeId: 'provenance_event_stage',
    objectiveText: '先在来源争议台核验完整执槌链，再前往终拍台挑战遗产执槌人。',
    modifiers: {
      enemyStatMultiplierPercent: 144,
      trapDamageMultiplierPercent: 153,
      trapDcMultiplierPercent: 140,
      unmetAnchorBossMultiplierPercent: 169,
      clearRewardPointMultiplierPercent: 198
    },
    imprint: {
      id: 'hammer_chain_mark',
      name: '执槌链印',
      description: '保存历任执槌者的完整传承链，使下一次轮回无法把真实落槌改写成匿名出价。'
    }
  },
  genesis_vault: {
    id: 'imprint',
    dungeonId: 'genesis_vault',
    name: '嵌合验真协议',
    description: '原型库会把未经证明的嵌合片段标成污染，先在嵌合基因库完成校准，才能让典藏官承认本轮序列。',
    requiredNodeId: 'mosaic_gene_vault',
    objectiveText: '先在嵌合基因库完成原型校准，再前往归档厅挑战原型典藏官。',
    modifiers: {
      enemyStatMultiplierPercent: 147,
      trapDamageMultiplierPercent: 156,
      trapDcMultiplierPercent: 143,
      unmetAnchorBossMultiplierPercent: 173,
      clearRewardPointMultiplierPercent: 204
    },
    imprint: {
      id: 'genesis_mosaic_mark',
      name: '嵌合原型印',
      description: '保存一次通过嵌合证明的原型序列，使下一次轮回不会把稳定片段误判为污染。'
    }
  },
  silent_broadcast_tower: {
    id: 'imprint',
    dungeonId: 'silent_broadcast_tower',
    name: '最后人声留印协议',
    description: '广播塔会把未经见证的人声抹成底噪，先在播音记忆台听见最后广播，才能让播音主无法否认停播前的真实听众。',
    requiredNodeId: 'broadcast_memory_stage',
    objectiveText: '先在播音记忆台保存最后一段人声，再前往主播播间挑战末频道播音主。',
    modifiers: {
      enemyStatMultiplierPercent: 150,
      trapDamageMultiplierPercent: 159,
      trapDcMultiplierPercent: 146,
      unmetAnchorBossMultiplierPercent: 177,
      clearRewardPointMultiplierPercent: 210
    },
    imprint: {
      id: 'last_broadcast_mark',
      name: '末段人声印',
      description: '保存停播前最后一段被听见的人声，使下一次轮回无法把同伴确认改写为空白频道。'
    }
  },
  lost_shelter: {
    id: 'imprint',
    dungeonId: 'lost_shelter',
    name: '幸存点名留印协议',
    description: '避难所会把未经回应的姓名写入失联名单，先在幸存者点名台完成确认，才能让失联总控无法否认仍然活着的人。',
    requiredNodeId: 'survivor_memory_stage',
    objectiveText: '先在幸存者点名台保存最后一次回应，再前往总控室挑战失联总控。',
    modifiers: {
      enemyStatMultiplierPercent: 153,
      trapDamageMultiplierPercent: 162,
      trapDcMultiplierPercent: 149,
      unmetAnchorBossMultiplierPercent: 181,
      clearRewardPointMultiplierPercent: 216
    },
    imprint: {
      id: 'survivor_roll_call_mark',
      name: '幸存点名印',
      description: '保存撤离前最后一次被确认的回应，使下一次轮回无法把活人改写成无人应答编号。'
    }
  },
  false_testimony_court: {
    id: 'imprint',
    dungeonId: 'false_testimony_court',
    name: '交叉诘问留印协议',
    description: '裁定庭会把未经坚持的追问删成诱导证词，先在交叉诘问台保存真实回答，才能让伪证主审无法否认完整证言。',
    requiredNodeId: 'cross_exam_stage',
    objectiveText: '先在交叉诘问台保存封存证言的最后回答，再前往终审席挑战伪证主审。',
    modifiers: {
      enemyStatMultiplierPercent: 156,
      trapDamageMultiplierPercent: 165,
      trapDcMultiplierPercent: 152,
      unmetAnchorBossMultiplierPercent: 185,
      clearRewardPointMultiplierPercent: 222
    },
    imprint: {
      id: 'cross_exam_verdict_mark',
      name: '诘问裁定印',
      description: '保存封存证言最后一次未经删改的回答，使下一次轮回无法把真实追问改写成诱供。'
    }
  },
  combat_replay_stage: {
    id: 'imprint',
    dungeonId: 'combat_replay_stage',
    name: '剧本投映留印协议',
    description: '复演场会把未经投映核验的战斗剪成无效镜头，先在剧本投映台保存真实动作，才能让终剪导演无法否认三段录制。',
    requiredNodeId: 'script_projection_stage',
    objectiveText: '先在剧本投映台保存三段战斗的真实动作，再前往终剪台挑战终剪导演。',
    modifiers: {
      enemyStatMultiplierPercent: 159,
      trapDamageMultiplierPercent: 168,
      trapDcMultiplierPercent: 155,
      unmetAnchorBossMultiplierPercent: 189,
      clearRewardPointMultiplierPercent: 228
    },
    imprint: {
      id: 'script_projection_mark',
      name: '剧本投映印',
      description: '保存三段战斗与预写剧本的差异，使下一次轮回无法把真实胜利剪成无效镜头。'
    }
  },
  panopticon_city: {
    id: 'imprint',
    dungeonId: 'panopticon_city',
    name: '逆向观测留印协议',
    description: '监察城会把未经过逆向观测的行动并入预测模型，先在逆观测台保存视线外的真实轨迹，才能让全视监察官失去绝对先手。',
    requiredNodeId: 'inverse_observation_stage',
    objectiveText: '先在逆向观测台保存视线外轨迹，再前往全视核心挑战全视监察官。',
    modifiers: {
      enemyStatMultiplierPercent: 162,
      trapDamageMultiplierPercent: 171,
      trapDcMultiplierPercent: 158,
      unmetAnchorBossMultiplierPercent: 193,
      clearRewardPointMultiplierPercent: 234
    },
    imprint: {
      id: 'inverse_observation_mark',
      name: '逆观测留痕印',
      description: '保存一次未被天幕预测模型收录的真实行动，使下一轮监察无法提前完成锁定。'
    }
  }
};

const DEEP_PROTOCOLS: Readonly<Record<DungeonId, DeepRunProtocolDefinition>> = {
  demon_tower_1: {
    id: 'deep',
    dungeonId: 'demon_tower_1',
    name: '深层回响',
    description: '妖雾令咒水与阵石彼此复鸣，必须封住两处回响，监斩官才会显出真正的骨相。',
    requiredNodeIds: ['risky_font_trap', 'hidden_stone_cache'],
    objectiveText: '在挑战雾塔监斩官前，镇住咒水井并取回阵石暗袋。',
    mutationName: '雾骨复鸣',
    materialReward: { itemId: 'demon_bone', amount: 2 },
    modifiers: {
      enemyStatMultiplierPercent: 126,
      trapDamageMultiplierPercent: 132,
      trapDcMultiplierPercent: 132,
      unmetAnchorBossMultiplierPercent: 148,
      clearRewardPointMultiplierPercent: 158
    }
  },
  metro_abyss: {
    id: 'deep',
    dungeonId: 'metro_abyss',
    name: '深层回响',
    description: '废线凭证与镜贝巢同时映出末班潮位，任一回响未收束都会强化蛛后的倒影。',
    requiredNodeIds: ['echo_coin_vendor', 'mirror_shell_nest'],
    objectiveText: '在挑战末班蛛后前，启动回声贩卖机并清点镜贝巢。',
    mutationName: '镜潮叠影',
    materialReward: { itemId: 'mirror_shell', amount: 2 },
    modifiers: {
      enemyStatMultiplierPercent: 130,
      trapDamageMultiplierPercent: 136,
      trapDcMultiplierPercent: 136,
      unmetAnchorBossMultiplierPercent: 153,
      clearRewardPointMultiplierPercent: 163
    }
  },
  starfall_mine: {
    id: 'deep',
    dungeonId: 'starfall_mine',
    name: '深层回响',
    description: '北壁星脉与井底裂尘形成双重引力源，只有同时校准，裂门周围的界面才会稳定。',
    requiredNodeIds: ['north_star_vein', 'rift_dust_reward'],
    objectiveText: '在挑战裂门蜕王前，校准北壁星铁脉并收拢裂尘沉淀池。',
    mutationName: '星脉共振',
    materialReward: { itemId: 'star_iron', amount: 2 },
    modifiers: {
      enemyStatMultiplierPercent: 134,
      trapDamageMultiplierPercent: 140,
      trapDcMultiplierPercent: 140,
      unmetAnchorBossMultiplierPercent: 158,
      clearRewardPointMultiplierPercent: 168
    }
  },
  rust_hospital: {
    id: 'deep',
    dungeonId: 'rust_hospital',
    name: '深层回响',
    description: '手术室遗包与停尸柜编号彼此改写病历，必须完成双重注销，才能终止天台会诊。',
    requiredNodeIds: ['surgical_theater_reward', 'morgue_reward'],
    objectiveText: '在挑战终诊主治前，取回手术室遗包并核销停尸柜编号牌。',
    mutationName: '终诊回返',
    materialReward: { itemId: 'medicine_ash', amount: 2 },
    modifiers: {
      enemyStatMultiplierPercent: 138,
      trapDamageMultiplierPercent: 144,
      trapDcMultiplierPercent: 144,
      unmetAnchorBossMultiplierPercent: 163,
      clearRewardPointMultiplierPercent: 173
    }
  },
  ash_arena: {
    id: 'deep',
    dungeonId: 'ash_arena',
    name: '深层回响',
    description: '支路奖杯与裂核奖品同时质疑旧判词，收回两件证物才能迫使炉心重新裁决。',
    requiredNodeIds: ['champion_branch_reward', 'cracked_core_prize'],
    objectiveText: '在挑战炉心裁判前，夺回支路奖杯并取得裂核奖品。',
    mutationName: '炉心复判',
    materialReward: { itemId: 'cracked_core', amount: 2 },
    modifiers: {
      enemyStatMultiplierPercent: 142,
      trapDamageMultiplierPercent: 148,
      trapDcMultiplierPercent: 148,
      unmetAnchorBossMultiplierPercent: 168,
      clearRewardPointMultiplierPercent: 178
    }
  },
  dream_archive: {
    id: 'deep',
    dungeonId: 'dream_archive',
    name: '深层回响',
    description: '裂核索引与封底脚注互相证明被删去的篇章，必须找齐两页才能锁定典守真名。',
    requiredNodeIds: ['cracked_core_index_reward', 'sealed_footnote_reward'],
    objectiveText: '在挑战梦牢典守前，补全裂核索引并取出封底脚注。',
    mutationName: '失页互证',
    materialReward: { itemId: 'hidden_stone', amount: 2 },
    modifiers: {
      enemyStatMultiplierPercent: 146,
      trapDamageMultiplierPercent: 152,
      trapDcMultiplierPercent: 152,
      unmetAnchorBossMultiplierPercent: 173,
      clearRewardPointMultiplierPercent: 183
    }
  },
  void_citadel: {
    id: 'deep',
    dungeonId: 'void_citadel',
    name: '深层回响',
    description: '城门余烬与终奖裂核构成全域回声的两端，必须封存两处信号才能切断主神同调。',
    requiredNodeIds: ['echo_branch_cache', 'cracked_core_reward'],
    objectiveText: '在挑战主神残响前，封存回声门余烬并回收裂核终奖。',
    mutationName: '虚界重响',
    materialReward: { itemId: 'rift_dust', amount: 2 },
    modifiers: {
      enemyStatMultiplierPercent: 150,
      trapDamageMultiplierPercent: 156,
      trapDcMultiplierPercent: 156,
      unmetAnchorBossMultiplierPercent: 178,
      clearRewardPointMultiplierPercent: 188
    }
  },
  temporal_observatory: {
    id: 'deep',
    dungeonId: 'temporal_observatory',
    name: '深层回响',
    description: '过去与未来的校准锚同时争夺当前刻度，任一端未归准都会让零时摄政跨纪元重叠。',
    requiredNodeIds: ['past_calibration_anchor', 'future_calibration_anchor'],
    objectiveText: '在挑战零时摄政前，依次校准过去与未来两座时序锚。',
    mutationName: '纪元叠校',
    materialReward: { itemId: 'chronal_glass', amount: 2 },
    modifiers: {
      enemyStatMultiplierPercent: 154,
      trapDamageMultiplierPercent: 160,
      trapDcMultiplierPercent: 160,
      unmetAnchorBossMultiplierPercent: 183,
      clearRewardPointMultiplierPercent: 193
    }
  },
  causal_clearinghouse: {
    id: 'deep',
    dungeonId: 'causal_clearinghouse',
    name: '深层回响',
    description: '因证与果证分别占据账本两端，必须完成双重存证，才能阻止主审把结果反写成罪因。',
    requiredNodeIds: ['cause_deposition', 'effect_deposition'],
    objectiveText: '在挑战因果主审前，依次完成因证存录与果证存录。',
    mutationName: '因果倒证',
    materialReward: { itemId: 'causal_seal', amount: 2 },
    modifiers: {
      enemyStatMultiplierPercent: 158,
      trapDamageMultiplierPercent: 164,
      trapDcMultiplierPercent: 164,
      unmetAnchorBossMultiplierPercent: 188,
      clearRewardPointMultiplierPercent: 198
    }
  },
  entropy_ark: {
    id: 'deep',
    dungeonId: 'entropy_ark',
    name: '深层回响',
    description: '左右压舱核心被熵潮推向不同航向，必须同时稳住两侧，才能阻止方舟在终局前解体。',
    requiredNodeIds: ['port_ballast_core', 'starboard_ballast_core'],
    objectiveText: '在挑战末舵手前，依次稳定左舷与右舷压舱核心。',
    mutationName: '熵潮失稳',
    materialReward: { itemId: 'entropy_crystal', amount: 2 },
    modifiers: {
      enemyStatMultiplierPercent: 162,
      trapDamageMultiplierPercent: 168,
      trapDcMultiplierPercent: 168,
      unmetAnchorBossMultiplierPercent: 193,
      clearRewardPointMultiplierPercent: 203
    }
  },
  mirror_cycle_city: {
    id: 'deep',
    dungeonId: 'mirror_cycle_city',
    name: '深层回响',
    description: '现实锚与镜相锚争夺同一份身份，必须让两侧都承认来者，才能阻止镜王借未锚定相位增殖。',
    requiredNodeIds: ['real_anchor', 'mirror_anchor'],
    objectiveText: '在挑战无名镜王前，依次完成现实锚与镜相锚的相位认证。',
    mutationName: '双相无名',
    materialReward: { itemId: 'phase_glass', amount: 2 },
    modifiers: {
      enemyStatMultiplierPercent: 166,
      trapDamageMultiplierPercent: 172,
      trapDcMultiplierPercent: 172,
      unmetAnchorBossMultiplierPercent: 198,
      clearRewardPointMultiplierPercent: 208
    }
  },
  redaction_scriptorium: {
    id: 'deep',
    dungeonId: 'redaction_scriptorium',
    name: '深层回响',
    description: '正文校样与记忆档案互相证明被删除的原句，必须让两份深层证据同时成立，才能阻止终稿反向删界。',
    requiredNodeIds: ['body_proof_vault', 'memory_survey_archive'],
    objectiveText: '在挑战删界官前，依次取得正文校样并复原记忆档案。',
    mutationName: '三证反删',
    materialReward: { itemId: 'redaction_ink', amount: 2 },
    modifiers: {
      enemyStatMultiplierPercent: 170,
      trapDamageMultiplierPercent: 176,
      trapDcMultiplierPercent: 176,
      unmetAnchorBossMultiplierPercent: 203,
      clearRewardPointMultiplierPercent: 213
    }
  },
  legacy_auction_court: {
    id: 'deep',
    dungeonId: 'legacy_auction_court',
    name: '深层回响',
    description: '武力认领与归返认领分别控制遗产估价的起点和终点，必须让两份深层权证同时成立，才能阻止全场落槌抬高追缴价。',
    requiredNodeIds: ['force_claim_vault', 'return_claim_vault'],
    objectiveText: '在挑战遗产执槌人前，依次取得武力认领权证与归返认领权证。',
    mutationName: '四席追价',
    materialReward: { itemId: 'legacy_scrip', amount: 2 },
    modifiers: {
      enemyStatMultiplierPercent: 174,
      trapDamageMultiplierPercent: 180,
      trapDcMultiplierPercent: 180,
      unmetAnchorBossMultiplierPercent: 208,
      clearRewardPointMultiplierPercent: 218
    }
  },
  genesis_vault: {
    id: 'deep',
    dungeonId: 'genesis_vault',
    name: '深层回响',
    description: '嵌合基因库与谱系演化台分别保存原型的横向组合和纵向分化，必须让两份记录同时成立，才能阻止始祖回写吞并本轮选择。',
    requiredNodeIds: ['mosaic_gene_vault', 'lineage_event_stage'],
    objectiveText: '在挑战原型典藏官前，依次完成嵌合证明并承认祖型谱系回声。',
    mutationName: '始祖并序',
    materialReward: { itemId: 'genesis_serum', amount: 2 },
    modifiers: {
      enemyStatMultiplierPercent: 178,
      trapDamageMultiplierPercent: 184,
      trapDcMultiplierPercent: 184,
      unmetAnchorBossMultiplierPercent: 213,
      clearRewardPointMultiplierPercent: 223
    }
  },
  silent_broadcast_tower: {
    id: 'deep',
    dungeonId: 'silent_broadcast_tower',
    name: '深层回响',
    description: '播音记忆台与全消声室分别保存最后的人声和绝对静默，必须让两份深层证据同时成立，才能阻止全城共振吞没真实频道。',
    requiredNodeIds: ['broadcast_memory_stage', 'anechoic_chamber'],
    objectiveText: '在挑战末频道播音主前，依次保存最后广播并完成全消声室校准。',
    mutationName: '全城死频',
    materialReward: { itemId: 'silence_core', amount: 2 },
    modifiers: {
      enemyStatMultiplierPercent: 182,
      trapDamageMultiplierPercent: 188,
      trapDcMultiplierPercent: 188,
      unmetAnchorBossMultiplierPercent: 218,
      clearRewardPointMultiplierPercent: 228
    }
  },
  lost_shelter: {
    id: 'deep',
    dungeonId: 'lost_shelter',
    name: '深层回响',
    description: '幸存者点名台与失联收容舱分别保存活人回应和接管样本，必须让两份深层记录同时成立，才能阻止全员接管抹除本轮护送。',
    requiredNodeIds: ['survivor_memory_stage', 'containment_bay'],
    objectiveText: '在挑战失联总控前，依次保存最后一次点名并完成失联收容舱封闭。',
    mutationName: '全员失联',
    materialReward: { itemId: 'rescue_badge', amount: 2 },
    modifiers: {
      enemyStatMultiplierPercent: 186,
      trapDamageMultiplierPercent: 192,
      trapDcMultiplierPercent: 192,
      unmetAnchorBossMultiplierPercent: 223,
      clearRewardPointMultiplierPercent: 233
    }
  },
  false_testimony_court: {
    id: 'deep',
    dungeonId: 'false_testimony_court',
    name: '深层回响',
    description: '交叉诘问台与终审判词锁分别保存真实回答和冻结裁定，必须让两份深层证据同时成立，才能阻止终审翻案覆盖三证。',
    requiredNodeIds: ['cross_exam_stage', 'judgment_lock'],
    objectiveText: '在挑战伪证主审前，依次保存封存证言并锁定终审判词。',
    mutationName: '三证倒判',
    materialReward: { itemId: 'truth_fragment', amount: 2 },
    modifiers: {
      enemyStatMultiplierPercent: 190,
      trapDamageMultiplierPercent: 196,
      trapDcMultiplierPercent: 196,
      unmetAnchorBossMultiplierPercent: 228,
      clearRewardPointMultiplierPercent: 238
    }
  },
  combat_replay_stage: {
    id: 'deep',
    dungeonId: 'combat_replay_stage',
    name: '深层回响',
    description: '剧本投映台与终剪封片锁分别保存真实动作和冻结版本，必须让两份深层记录同时成立，才能阻止删镜杀青覆盖三段录制。',
    requiredNodeIds: ['script_projection_stage', 'final_cut_lock'],
    objectiveText: '在挑战终剪导演前，依次完成剧本投映并锁定终剪封片版本。',
    mutationName: '三段倒剪',
    materialReward: { itemId: 'combat_reel', amount: 2 },
    modifiers: {
      enemyStatMultiplierPercent: 194,
      trapDamageMultiplierPercent: 200,
      trapDcMultiplierPercent: 200,
      unmetAnchorBossMultiplierPercent: 233,
      clearRewardPointMultiplierPercent: 243
    }
  },
  panopticon_city: {
    id: 'deep',
    dungeonId: 'panopticon_city',
    name: '深层回响',
    description: '盲线档案与全视封锁分别保存监察盲区和冻结权限，必须让两份深层记录同时成立，才能阻止全景锁定覆盖本轮逃逸轨迹。',
    requiredNodeIds: ['blindline_archive', 'all_sight_lock'],
    objectiveText: '在挑战全视监察官前，依次封存盲线档案并关闭全视封锁。',
    mutationName: '全景锁定',
    materialReward: { itemId: 'observation_shard', amount: 2 },
    modifiers: {
      enemyStatMultiplierPercent: 198,
      trapDamageMultiplierPercent: 204,
      trapDcMultiplierPercent: 204,
      unmetAnchorBossMultiplierPercent: 238,
      clearRewardPointMultiplierPercent: 248
    }
  }
};

function toPositiveInteger(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(1, Math.round(value)));
}

function toNonNegativeInteger(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.round(value)));
}

function scalePositiveInteger(value: number, multiplierPercent: number): number {
  const base = toPositiveInteger(value);
  const multiplier = toPositiveInteger(multiplierPercent);
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(1, Math.ceil((base * multiplier) / 100)));
}

function scaleNonNegativeInteger(value: number, multiplierPercent: number): number {
  const base = toNonNegativeInteger(value);
  const multiplier = toPositiveInteger(multiplierPercent);
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.ceil((base * multiplier) / 100)));
}

export function getRunProtocolRequiredNodeIds(definition: RunProtocolDefinition): readonly string[] {
  if (definition.id === 'standard') return [];
  if (definition.id === 'imprint') return [definition.requiredNodeId];
  return definition.requiredNodeIds;
}

export function getRunProtocolDefinition(
  dungeonId: DungeonId,
  protocolId: RunProtocolId
): RunProtocolDefinition | undefined {
  if (!DUNGEONS[dungeonId]) return undefined;

  if (protocolId === 'standard') {
    return {
      id: 'standard',
      dungeonId,
      name: '标准探索',
      description: '按原始副本规则探索，不追加烙印压力或协议奖励。',
      modifiers: IDENTITY_MODIFIERS
    };
  }

  if (protocolId === 'imprint') return IMPRINT_PROTOCOLS[dungeonId];
  return protocolId === 'deep' ? DEEP_PROTOCOLS[dungeonId] : undefined;
}

export function getImprintRunProtocolDefinitions(): readonly ImprintRunProtocolDefinition[] {
  return DUNGEON_ORDER.map((dungeonId) => IMPRINT_PROTOCOLS[dungeonId]);
}

export function isRunProtocolAvailable(
  dungeonId: DungeonId,
  protocolId: RunProtocolId,
  completedDungeonIds: readonly DungeonId[] | null | undefined = []
): boolean {
  if (!getRunProtocolDefinition(dungeonId, protocolId)) return false;
  return protocolId === 'standard' || Boolean(completedDungeonIds?.includes(dungeonId));
}

export function scaleMonsterForRunProtocol(
  monster: MonsterDefinition,
  protocolId: RunProtocolId,
  context: RunProtocolMonsterContext = {}
): MonsterDefinition {
  const definition = getRunProtocolDefinition(monster.dungeonId, protocolId);
  if (!definition || definition.id === 'standard') return monster;

  const baseMultiplier = definition.modifiers.enemyStatMultiplierPercent;
  const breachApplies = context.isBoss === true && context.anchorCompletedBeforeBoss !== true;
  const breachMultiplier = breachApplies ? definition.modifiers.unmetAnchorBossMultiplierPercent : 100;
  const scaleStat = (value: number) => scalePositiveInteger(scalePositiveInteger(value, baseMultiplier), breachMultiplier);

  return {
    ...monster,
    maxHp: scaleStat(monster.maxHp),
    attack: scaleStat(monster.attack),
    artPower: scaleStat(monster.artPower),
    defense: scaleStat(monster.defense),
    speed: scaleStat(monster.speed)
  };
}

export function scaleTrapForRunProtocol<T extends RunProtocolTrap>(
  trap: T,
  dungeonId: DungeonId,
  protocolId: RunProtocolId
): T {
  const definition = getRunProtocolDefinition(dungeonId, protocolId);
  if (!definition || definition.id === 'standard') return trap;

  return {
    ...trap,
    damage: scalePositiveInteger(trap.damage, definition.modifiers.trapDamageMultiplierPercent),
    dc: scalePositiveInteger(trap.dc, definition.modifiers.trapDcMultiplierPercent)
  };
}

export function scaleRunProtocolRewardPoints(
  baseRewardPoints: number,
  dungeonId: DungeonId,
  protocolId: RunProtocolId
): number {
  const definition = getRunProtocolDefinition(dungeonId, protocolId);
  if (!definition || definition.id === 'standard') return baseRewardPoints;
  return scaleNonNegativeInteger(baseRewardPoints, definition.modifiers.clearRewardPointMultiplierPercent);
}

export function evaluateRunProtocolReward({
  dungeonId,
  protocolId,
  clearedNodeIds,
  baseRewardPoints
}: RunProtocolRewardEvaluationInput): RunProtocolRewardEvaluation {
  const definition = getRunProtocolDefinition(dungeonId, protocolId);
  const completedInOrder = Array.isArray(clearedNodeIds) ? clearedNodeIds : [];
  const bossDefinition = definition ? getBossDefinition(dungeonId) : undefined;
  const bossIndex = bossDefinition ? completedInOrder.indexOf(bossDefinition.nodeId) : -1;
  const bossDefeated = bossIndex >= 0;

  if (!definition || definition.id === 'standard') {
    return {
      bossDefeated,
      anchorCompletedBeforeBoss: definition?.id === 'standard' && bossDefeated,
      completedAnchorCount: 0,
      requiredAnchorCount: 0,
      canGrantProtocolReward: false,
      rewardPoints: baseRewardPoints
    };
  }

  const requiredNodeIds = getRunProtocolRequiredNodeIds(definition);
  const completedAnchorCount = requiredNodeIds.filter((nodeId) => completedInOrder.includes(nodeId)).length;
  const requiredAnchorCount = requiredNodeIds.length;
  const anchorCompletedBeforeBoss = bossDefeated && requiredNodeIds.every((nodeId) => {
    const anchorIndex = completedInOrder.indexOf(nodeId);
    return anchorIndex >= 0 && anchorIndex < bossIndex;
  });
  const canGrantProtocolReward = anchorCompletedBeforeBoss && bossDefeated;
  const evaluation = {
    bossDefeated,
    anchorCompletedBeforeBoss,
    completedAnchorCount,
    requiredAnchorCount,
    canGrantProtocolReward,
    rewardPoints: canGrantProtocolReward
      ? scaleRunProtocolRewardPoints(baseRewardPoints, dungeonId, protocolId)
      : toNonNegativeInteger(baseRewardPoints)
  };

  if (definition.id === 'imprint') {
    return {
      ...evaluation,
      imprint: canGrantProtocolReward ? definition.imprint : undefined
    };
  }

  return {
    ...evaluation,
    materialReward: canGrantProtocolReward ? definition.materialReward : undefined
  };
}
