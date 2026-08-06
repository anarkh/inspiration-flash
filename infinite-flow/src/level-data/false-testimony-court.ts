import type { DungeonDefinition } from '../game';

export const falseTestimonyCourtDungeon: DungeonDefinition = {
  id: 'false_testimony_court',
  name: '伪证裁定庭',
  tier: 17,
  genre: 'modern',
  recommendedPower: 1140,
  theme: '三份证据被伪证裁定庭拆成声纹、时间线与残留物，探索者必须逐一揭示并净证，在翻案前锁定真正的伪证者。',
  recommended: '推荐战力 1140、完整终盘套装、定神香、破禁符与护甲补片，以及足以完成三证诘问和终审裁定的恢复储备。',
  rewardPreview: '真证碎片、终局材料、奖励点 1690-4100',
  grid: { width: 6, height: 5, startNodeId: 'verdict_gate' },
  nodes: [
    {
      id: 'truth_archive', type: 'reward', relicDraftId: 'false_testimony_court:truth:1', title: '真证封存库', position: { x: 0, y: 0 },
      description: '封存库保留最早入庭的未经剪裁证词，完整链条可以固化为一份真证遗珍草案。',
      reward: { rewardPoints: 470, items: { truth_fragment: 1, method_page: 1 } }
    },
    {
      id: 'voice_evidence', type: 'reward', title: '声纹证据台', position: { x: 1, y: 0 },
      description: '证据台循环播放证人原声与替换片段，揭示声纹断口后才能确认第一份真证。',
      reward: { rewardPoints: 450, items: { truth_fragment: 1, focus_incense: 1 } }
    },
    {
      id: 'voice_filter_trap', type: 'trap', title: '声纹滤伪阵', position: { x: 2, y: 0 },
      description: '滤伪阵会把熟悉的声线放大成自证循环，定神香能够隔绝诱导并保留原始声纹。',
      trap: { damage: 190, dc: 45, counterItem: 'focus_incense' }
    },
    {
      id: 'north_entry', type: 'reward', title: '北侧证人入口', position: { x: 3, y: 0 },
      description: '来自避难所上层的队伍在此入庭，书记箱留下定神香与稳定跨庭通道的小界门符。',
      reward: { rewardPoints: 410, items: { focus_incense: 1, healing_pill: 1, gate_sigil: 1 } }
    },
    {
      id: 'hostile_witness_north', type: 'monster', title: '北席敌意证人', position: { x: 4, y: 0 },
      description: '敌意证人反复修改口供，并把每次追问曲解成对探索者不利的新证词。',
      monsterId: 'hostile_witness'
    },
    {
      id: 'upper_return_portal', type: 'portal', title: '上层归返门', position: { x: 5, y: 0 },
      description: '归返门回接妖塔封存暗格，小界门符可以保护真证链条不被跨境裁定删改。',
      portal: { targetDungeonId: 'combat_replay_stage', targetNodeId: 'upper_entry', stableItem: 'gate_sigil' }
    },
    {
      id: 'records_stacks', type: 'reward', equipmentHuntClueId: 'equipment_hunt_false_testimony', title: '卷宗高架', position: { x: 0, y: 1 },
      description: '高架卷宗保存第一条裁定装备流转记录，与证物补给箱合并后即可定位完整成品。',
      reward: { rewardPoints: 420, items: { armor_patch: 1 } }
    },
    {
      id: 'testimony_hall', type: 'reward', title: '公开证言厅', position: { x: 1, y: 1 },
      description: '匿名线报被投入公开证言厅，只有核对叙述中的矛盾，才能判断它是提醒还是诱供。',
      reward: { rewardPoints: 440, lingyun: 1 }
    },
    {
      id: 'timeline_evidence', type: 'reward', title: '时间线证据台', position: { x: 2, y: 1 },
      description: '时间线证据台并列展示原始时间戳与删改记录，揭示错位即可取得第二份真证。',
      reward: { rewardPoints: 460, items: { truth_fragment: 1, dispel_talisman: 1 } }
    },
    {
      id: 'timeline_checksum_trap', type: 'trap', title: '时间戳校验阱', position: { x: 3, y: 1 },
      description: '校验阱会把错误时间戳反写进调查记录，破禁符可以切断回写并恢复原始次序。',
      trap: { damage: 198, dc: 46, counterItem: 'dispel_talisman' }
    },
    {
      id: 'archive_censor_alpha', type: 'monster', title: '首席档案删录官', position: { x: 4, y: 1 },
      description: '首席删录官用红笔抹去证据交接人，再把空白责任追加到仍在追查的人身上。',
      monsterId: 'archive_censor'
    },
    {
      id: 'swift_judgment_armory', type: 'reward', relicDraftId: 'false_testimony_court:swift:2', title: '速裁军械库', position: { x: 5, y: 1 },
      description: '军械库封存历次速裁失败后留下的反诘方案，可以固化第二份裁定遗珍草案。',
      reward: { rewardPoints: 490, items: { truth_fragment: 1, armor_patch: 1 } }
    },
    {
      id: 'verdict_gate', type: 'reward', title: '裁定庭正门', position: { x: 0, y: 2 },
      description: '正门登记三证调查并发放首轮反制物资，证据台、净证陷阱与终审席同时亮起。',
      reward: { rewardPoints: 540, items: { focus_incense: 1, dispel_talisman: 1, armor_patch: 1, gate_sigil: 1 } }
    },
    {
      id: 'residue_sterility_trap', type: 'trap', title: '残留物灭菌阱', position: { x: 1, y: 2 },
      description: '灭菌阱试图连同污染与原始残留一起碾碎，护甲补片能够固定证物袋并挡住高压冲洗。',
      trap: { damage: 205, dc: 47, counterItem: 'armor_patch' }
    },
    {
      id: 'verdict_chamber', type: 'reward', title: '合议裁定室', position: { x: 2, y: 2 },
      description: '三份证据在合议桌上互相校验，只有净证记录足够完整，正确指控才不会被伪证覆盖。',
      reward: { rewardPoints: 500, lingyun: 2, items: { truth_fragment: 1 } }
    },
    {
      id: 'false_testimony_judge', type: 'monster', title: '伪证主审', position: { x: 3, y: 2 },
      description: '伪证主审把三份删改证据合成唯一判词，并准备在终审中将调查者改写成真正的伪证人。',
      monsterId: 'false_testimony_judge'
    },
    {
      id: 'judgment_lock', type: 'reward', title: '终审判词锁', position: { x: 4, y: 2 },
      description: '判词锁保存开战前冻结的三证裁定，也是深层协议与追兵收容共同核验的稳定门。',
      reward: { rewardPoints: 490, lingyun: 1, items: { truth_fragment: 1 } }
    },
    {
      id: 'verdict_exit', type: 'exit', title: '裁定庭结案门', position: { x: 5, y: 2 },
      description: '结案门封存本轮揭证、净证、指控与终审记录，并将真证链和裁定凭证交还主神空间结算。',
      reward: { rewardPoints: 1690, lingyun: 13, items: { truth_fragment: 4, method_page: 2, cycle_imprint: 1 } }
    },
    {
      id: 'lower_entry', type: 'reward', title: '下侧证物入口', position: { x: 0, y: 3 },
      description: '来自避难所下层的队伍在此入庭，证物箱留下护甲补片与稳定跨庭通道的小界门符。',
      reward: { rewardPoints: 410, items: { armor_patch: 1, healing_pill: 1, gate_sigil: 1 } }
    },
    {
      id: 'residue_evidence', type: 'reward', title: '残留物证据台', position: { x: 1, y: 3 },
      description: '残留物证据台保存封袋纤维与交接指纹，揭示灭菌痕迹后即可取得第三份真证。',
      reward: { rewardPoints: 460, items: { truth_fragment: 1, armor_patch: 1 } }
    },
    {
      id: 'perjury_hound_omega', type: 'monster', title: '终段伪证猎犬', position: { x: 2, y: 3 },
      description: '伪证猎犬循着口供矛盾扑咬目标，重复同一种辩解只会让它更快锁定破绽。',
      monsterId: 'perjury_hound'
    },
    {
      id: 'appeal_desk', type: 'reward', title: '翻案申诉席', position: { x: 3, y: 3 },
      description: '申诉席允许重开一次裁定，却会把已经确认的正确指控重新暴露给删录官。',
      reward: { rewardPoints: 470, lingyun: 1, items: { truth_fragment: 1 } }
    },
    {
      id: 'cross_exam_stage', type: 'reward', title: '交叉诘问台', position: { x: 4, y: 3 },
      description: '封存证言在诘问台逐句展开，坚持追问可以让装备记住未被删改的真实回答。',
      reward: { rewardPoints: 500, lingyun: 1, items: { truth_fragment: 1 } }
    },
    {
      id: 'lower_return_portal', type: 'portal', title: '下层归返门', position: { x: 5, y: 3 },
      description: '归返门回接妖塔最初的雾鬼遭遇，小界门符能避免证物编号在跨境时被重置。',
      portal: { targetDungeonId: 'combat_replay_stage', targetNodeId: 'lower_entry', stableItem: 'gate_sigil' }
    },
    {
      id: 'field_survey_archive', type: 'reward', fieldSurveyId: 'survey_false_testimony_archive', title: '伪证调查档案', position: { x: 0, y: 4 },
      description: '调查档案汇总历次错误裁定的证据链，可还原四件裁定装备参与揭证与翻案的完整路径。',
      reward: { rewardPoints: 470, items: { truth_fragment: 1 } }
    },
    {
      id: 'hostile_witness', type: 'monster', title: '敌意证人', position: { x: 1, y: 4 },
      description: '敌意证人躲在候审席不断修改证词，等待调查者重复问题后制造新的口供冲突。',
      monsterId: 'hostile_witness'
    },
    {
      id: 'return_testimony_portal', type: 'portal', title: '归返证言门', position: { x: 2, y: 4 },
      description: '证言门回接妖塔静祷余页，小界门符能保护封存证言不被主审重新改判。',
      portal: { targetDungeonId: 'combat_replay_stage', targetNodeId: 'stage_gate', stableItem: 'gate_sigil' }
    },
    {
      id: 'evidence_supply_cache', type: 'reward', equipmentHuntClueId: 'equipment_hunt_false_testimony', title: '证物补给箱', position: { x: 3, y: 4 },
      description: '补给箱内的交接单保存第二条裁定装备轨迹，与卷宗记录共同指向四件成熟装备。',
      reward: { rewardPoints: 420, items: { dispel_talisman: 1 } }
    },
    {
      id: 'soul_recharge_verdict', type: 'monster', soulRechargeId: 'soul_node_verdict_recharge', title: '器魂裁定充能席', position: { x: 4, y: 4 },
      description: '充能席被一名删录官接管，只有击退看守并封存伪造交接链，器魂才能完成安全续接。',
      monsterId: 'archive_censor'
    },
    {
      id: 'false_verdict_vault', type: 'reward', title: '伪判封存库', position: { x: 5, y: 4 },
      description: '封存库保留所有被推翻的错误判词，为终审前的正确指控提供不可删改的反面索引。',
      reward: { rewardPoints: 520, lingyun: 2, items: { truth_fragment: 2, healing_pill: 1 } }
    }
  ]
};
