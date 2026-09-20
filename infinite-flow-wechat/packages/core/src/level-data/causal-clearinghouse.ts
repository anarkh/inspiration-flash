import type { DungeonDefinition } from '../game';

export const causalClearinghouseDungeon: DungeonDefinition = {
  id: 'causal_clearinghouse',
  name: '因果清算所',
  tier: 9,
  genre: 'anomaly',
  recommendedPower: 500,
  theme: '原因与结果被拆成两份独立卷宗，只有完成双向核验，清算所才会承认同一条因果链。',
  recommended: '推荐战力 500、时序套装、界门补给与足以承受终审的稳定防护。',
  rewardPreview: '因果印章、终局材料、奖励点 650-1750',
  grid: { width: 6, height: 5, startNodeId: 'clearinghouse_gate' },
  // 原因、裁决与结果三条卷宗带满铺 6x5 网格，双侧证词始终可以交叉核验。
  nodes: [
    {
      id: 'cause_clue_cache',
      type: 'reward',
      equipmentHuntClueId: 'equipment_hunt_causal_clearinghouse',
      title: '因端线索匣',
      position: { x: 0, y: 0 },
      description: '匣中保存尚未产生结果的装备凭证，每一枚压痕都指向清算所的终审席。',
      reward: { rewardPoints: 175, items: { causal_seal: 1 } }
    },
    {
      id: 'paradox_bailiff_alpha',
      type: 'monster',
      title: '悖论法警·始',
      position: { x: 1, y: 0 },
      description: '法警先宣读判决再补写罪名，任何提前出手都会成为它追认责任的证据。',
      monsterId: 'paradox_bailiff'
    },
    {
      id: 'cause_deposition',
      type: 'reward',
      title: '原因证词台',
      position: { x: 2, y: 0 },
      description: '证词台收录所有尚未兑现的动机，完成签押后会吐出一枚可供核验的印章。',
      reward: { rewardPoints: 195, lingyun: 1, items: { causal_seal: 1, cycle_imprint: 1 } }
    },
    {
      id: 'cause_relic_archive',
      type: 'reward',
      relicDraftId: 'causal_clearinghouse:cause:1',
      title: '因端遗珍档案',
      position: { x: 3, y: 0 },
      description: '档案把未发生的选择封成遗珍草案，取走其中一页便会固定对应的起因。',
      reward: { rewardPoints: 190, items: { causal_seal: 1, method_page: 1 } }
    },
    {
      id: 'retroactive_sentence_trap',
      type: 'trap',
      title: '追溯判罚阵',
      position: { x: 4, y: 0 },
      description: '判罚阵把刚才避开的伤害追记到当前，定神香能阻止旧结果重新取得效力。',
      trap: { damage: 76, dc: 23, counterItem: 'focus_incense' }
    },
    {
      id: 'cause_echo_portal',
      type: 'portal',
      title: '因端回声门',
      position: { x: 5, y: 0 },
      description: '门内展示妖塔封印最初成立的原因，稳定后可回到那处未被领取的封存暗格。',
      portal: { targetDungeonId: 'entropy_ark', targetNodeId: 'port_clue_cache', stableItem: 'gate_sigil' }
    },
    {
      id: 'entry_docket',
      type: 'reward',
      title: '入所案卷',
      position: { x: 0, y: 1 },
      description: '案卷为本轮探索登记起因与预期结果，并预留一枚等待终审盖印的凭证。',
      reward: { rewardPoints: 170, items: { causal_seal: 1, cycle_imprint: 1 } }
    },
    {
      id: 'cause_foyer',
      type: 'reward',
      title: '因端前厅',
      position: { x: 1, y: 1 },
      description: '前厅堆着被驳回的动机陈述，夹层里仍留有一片可以加固护具的补片。',
      reward: { rewardPoints: 155, items: { armor_patch: 1 } }
    },
    {
      id: 'cause_bailiff',
      type: 'monster',
      title: '因端裁决执事',
      position: { x: 2, y: 1 },
      description: '执事逐条核对行动动机，只要证词前后不一，它就会立刻追加一轮质询。',
      monsterId: 'verdict_usher'
    },
    {
      id: 'evidence_survey_dais',
      type: 'reward',
      fieldSurveyId: 'survey_causal_evidence_dais',
      title: '证据调查台',
      position: { x: 3, y: 1 },
      description: '调查台并列展示因端与果端的物证，现场核验能换取额外的清算材料。',
      reward: { rewardPoints: 200, items: { causal_seal: 1 } }
    },
    {
      id: 'north_verdict_lock',
      type: 'trap',
      title: '北侧判词锁',
      position: { x: 4, y: 1 },
      description: '判词锁拒绝没有生效日期的证据，小界门符可以暂时锚定不断改写的落款。',
      trap: { damage: 80, dc: 24, counterItem: 'gate_sigil' }
    },
    {
      id: 'portal_warrant_cache',
      type: 'reward',
      title: '界门令状匣',
      position: { x: 5, y: 1 },
      description: '备用令状专供两座回声门查验，封蜡下还压着一枚未登记的因果印章。',
      reward: { rewardPoints: 165, items: { gate_sigil: 1, causal_seal: 1 } }
    },
    {
      id: 'clearinghouse_gate',
      type: 'reward',
      title: '清算所正门',
      position: { x: 0, y: 2 },
      description: '正门将来访者的第一步登记为原始原因，并发下一枚贯穿全案的核验印章。',
      reward: { rewardPoints: 250, lingyun: 1, items: { causal_seal: 1 } }
    },
    {
      id: 'verdict_usher',
      type: 'monster',
      title: '裁决执事',
      position: { x: 1, y: 2 },
      description: '执事守住中央递卷线，把玩家连续使用的同类动作归档为可重复定罪的惯例。',
      monsterId: 'verdict_usher'
    },
    {
      id: 'contradiction_line',
      type: 'trap',
      title: '矛盾界线',
      position: { x: 2, y: 2 },
      description: '界线要求身体同时站在两份互斥证词中，定神香能保留唯一可信的感知。',
      trap: { damage: 78, dc: 23, counterItem: 'focus_incense' }
    },
    {
      id: 'verdict_bridge',
      type: 'reward',
      title: '裁决递卷桥',
      position: { x: 3, y: 2 },
      description: '桥面把两侧卷宗送往同一终审席，散落的补给足以修正一次证据冲突。',
      reward: { rewardPoints: 205, items: { causal_seal: 1, armor_patch: 1 } }
    },
    {
      id: 'zero_sum_auditor',
      type: 'monster',
      title: '零和审计官',
      position: { x: 4, y: 2 },
      description: '审计官坚持所有收益都必须由另一条时间线偿付，并把差额直接写进挑战者的判决。',
      monsterId: 'zero_sum_auditor'
    },
    {
      id: 'east_verdict_lock',
      type: 'trap',
      title: '东侧判词锁',
      position: { x: 5, y: 2 },
      description: '东锁不断撤销已经完成的通行动作，只有界门锚点能让一次结果保持生效。',
      trap: { damage: 82, dc: 24, counterItem: 'gate_sigil' }
    },
    {
      id: 'effect_supply',
      type: 'reward',
      title: '果端补给箱',
      position: { x: 0, y: 3 },
      description: '补给箱只承认已经发生的损耗，清点完成后返还一枚印章与一颗疗伤丹。',
      reward: { rewardPoints: 180, items: { causal_seal: 1, healing_pill: 1 } }
    },
    {
      id: 'effect_foyer',
      type: 'reward',
      title: '果端前厅',
      position: { x: 1, y: 3 },
      description: '前厅陈列已经执行的判决，一张雷火符被夹在尚未结清的结果清单里。',
      reward: { rewardPoints: 155, items: { thunder_talisman: 1 } }
    },
    {
      id: 'effect_bailiff',
      type: 'monster',
      title: '果端裁决执事',
      position: { x: 2, y: 3 },
      description: '执事倒查每一道伤痕的来源，无法解释的结果会被它折算成额外攻击。',
      monsterId: 'verdict_usher'
    },
    {
      id: 'soul_recharge_chamber',
      type: 'trap',
      soulRechargeId: 'soul_node_causal_recharge',
      title: '器魂归因室',
      position: { x: 3, y: 3 },
      description: '归因室抽取装备技能留下的痕迹，护甲补片能稳住器魂重新连接时的裂口。',
      trap: { damage: 80, dc: 24, counterItem: 'armor_patch' }
    },
    {
      id: 'south_verdict_lock',
      type: 'trap',
      title: '南侧判词锁',
      position: { x: 4, y: 3 },
      description: '南锁将失败预判直接登记为既成结果，净化符可以撤销这份越权判词。',
      trap: { damage: 80, dc: 24, counterItem: 'dispel_talisman' }
    },
    {
      id: 'effect_echo_portal',
      type: 'portal',
      title: '果端回声门',
      position: { x: 5, y: 3 },
      description: '门内展示妖塔雾鬼现身后的结果，稳定后可回到那次最早的正面遭遇。',
      portal: { targetDungeonId: 'entropy_ark', targetNodeId: 'starboard_clue_cache', stableItem: 'gate_sigil' }
    },
    {
      id: 'effect_clue_cache',
      type: 'reward',
      equipmentHuntClueId: 'equipment_hunt_causal_clearinghouse',
      title: '果端线索匣',
      position: { x: 0, y: 4 },
      description: '匣中保存已经兑现的装备凭证，与因端压痕共同指向同一场清算追猎。',
      reward: { rewardPoints: 175, items: { causal_seal: 1 } }
    },
    {
      id: 'paradox_bailiff_omega',
      type: 'monster',
      title: '悖论法警·终',
      position: { x: 1, y: 4 },
      description: '终末法警先销毁原因再保留结果，迫使挑战者为一份不存在的卷宗负责。',
      monsterId: 'paradox_bailiff'
    },
    {
      id: 'effect_deposition',
      type: 'reward',
      title: '结果证词台',
      position: { x: 2, y: 4 },
      description: '证词台收录所有已经生效的结果，完成反向核验后会归还一枚循环印记。',
      reward: { rewardPoints: 195, lingyun: 1, items: { causal_seal: 1, cycle_imprint: 1 } }
    },
    {
      id: 'effect_relic_archive',
      type: 'reward',
      relicDraftId: 'causal_clearinghouse:effect:2',
      title: '果端遗珍档案',
      position: { x: 3, y: 4 },
      description: '档案把已经发生的结果封成遗珍草案，选择其中一页便会追认对应的代价。',
      reward: { rewardPoints: 190, items: { causal_seal: 1, cracked_core: 1 } }
    },
    {
      id: 'prospective_sentence_trap',
      type: 'trap',
      title: '预期判罚阵',
      position: { x: 4, y: 4 },
      description: '尚未宣读的判罚提前落在通道上，净化符能让这份未来判词失去依据。',
      trap: { damage: 84, dc: 25, counterItem: 'dispel_talisman' }
    },
    {
      id: 'clearinghouse_exit',
      type: 'exit',
      title: '清算所结案门',
      position: { x: 5, y: 4 },
      description: '结案门将原因与结果重新装订成同一卷宗，并结算本轮带出的全部核验凭证。',
      reward: { rewardPoints: 720, lingyun: 5, items: { causal_seal: 3, cracked_core: 1, method_page: 1 } }
    }
  ]
};
