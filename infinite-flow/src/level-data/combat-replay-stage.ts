import type { DungeonDefinition } from '../game';

export const combatReplayStageDungeon: DungeonDefinition = {
  id: 'combat_replay_stage',
  name: '战痕复演场',
  tier: 18,
  recommendedPower: 1240,
  theme: '战痕复演场把同一场战斗拆成三次录制，探索者必须在镜头路线中保留有效片段，并阻止终剪导演删去真实胜利。',
  recommended: '推荐战力 1240、完整终盘套装、定神香、破禁符与护甲补片，以及足以完成三段录制和终剪挑战的恢复储备。',
  rewardPreview: '战斗母带、终局材料、奖励点 1800-4400',
  grid: { width: 6, height: 5, startNodeId: 'stage_gate' },
  nodes: [
    {
      id: 'projection_gallery', type: 'reward', relicDraftId: 'combat_replay_stage:sequence:1', title: '镜头投映廊', position: { x: 1, y: 3 },
      description: '投映廊并列保存三段录制的原始走位，未被终剪的战痕可以固化为遗珍草案。',
      reward: { rewardPoints: 500, items: { combat_reel: 1, method_page: 1 } }
    },
    {
      id: 'take_alpha', type: 'monster', title: '甲段录制战', position: { x: 1, y: 1 },
      description: '第一台摄影机记录正面交锋，场记潜猎者会沿重复动作追踪下一次攻击。',
      monsterId: 'cue_stalker'
    },
    {
      id: 'opening_cue_trap', type: 'trap', title: '开场提示陷阱', position: { x: 2, y: 0 },
      description: '错误开场提示会把意识锁在第一次出手前，定神香能够隔绝强制提示。',
      trap: { damage: 212, dc: 48, counterItem: 'focus_incense' }
    },
    {
      id: 'upper_entry', type: 'reward', title: '上层入场口', position: { x: 3, y: 0 },
      description: '来自裁定庭上层归返门的队伍在此入场，道具箱保留开场反制物资与小界门符。',
      reward: { rewardPoints: 440, items: { focus_incense: 1, healing_pill: 1, gate_sigil: 1 } }
    },
    {
      id: 'cue_stalker_north', type: 'monster', title: '北机位场记潜猎者', position: { x: 4, y: 0 },
      description: '北机位的潜猎者专门截取重复攻势，并把失误片段送往终剪台。',
      monsterId: 'cue_stalker'
    },
    {
      id: 'upper_return_portal', type: 'portal', title: '上层归返门', position: { x: 5, y: 0 },
      description: '归返门向上接入天幕监察城，小界门符可以保护战斗母带不被跨境扫描改写。',
      portal: { targetDungeonId: 'panopticon_city', targetNodeId: 'upper_entry', stableItem: 'gate_sigil' }
    },
    {
      id: 'opening_prop_cache', type: 'reward', title: '开场道具箱', position: { x: 1, y: 0 },
      description: '道具箱保存第一条复演装备流转记录，与终场补给单合并后即可定位完整成品。',
      reward: { rewardPoints: 450, items: { focus_incense: 1, armor_patch: 1 } }
    },
    {
      id: 'rehearsal_hall', type: 'reward', relicDraftId: 'combat_replay_stage:afterbeat:2', title: '排演厅', position: { x: 2, y: 2 },
      description: '排演厅保留未署名的试演和每一次动作修改，可固化第二份复演遗珍草案。',
      reward: { rewardPoints: 510, lingyun: 1, items: { combat_reel: 1 } }
    },
    {
      id: 'take_beta', type: 'monster', title: '乙段录制战', position: { x: 3, y: 1 },
      description: '第二台摄影机要求保持动作连续，连续性剪辑师会把不一致的姿态改成破绽。',
      monsterId: 'continuity_editor'
    },
    {
      id: 'continuity_break_trap', type: 'trap', title: '连续性断裂陷阱', position: { x: 2, y: 1 },
      description: '断裂陷阱把前后镜头强行叠在同一时刻，破禁符可以切断错误连续性。',
      trap: { damage: 220, dc: 49, counterItem: 'dispel_talisman' }
    },
    {
      id: 'continuity_editor_alpha', type: 'monster', title: '首席连续性剪辑师', position: { x: 4, y: 1 },
      description: '首席剪辑师逐帧核验动作差异，把任何未经承认的改动登记成重拍理由。',
      monsterId: 'continuity_editor'
    },
    {
      id: 'sequence_route', type: 'reward', title: '顺剪复核台', position: { x: 0, y: 0 },
      description: '复核台保存按顺序完成的镜头记录，为终剪前的路线核验提供完整时间轴。',
      reward: { rewardPoints: 520, items: { combat_reel: 1 } }
    },
    {
      id: 'stage_gate', type: 'reward', title: '复演场正门', position: { x: 0, y: 2 },
      description: '正门登记三段录制并发放首轮反制物资，三台摄影机与终剪锁同时亮起。',
      reward: { rewardPoints: 580, items: { focus_incense: 1, dispel_talisman: 1, armor_patch: 1, gate_sigil: 1 } }
    },
    {
      id: 'blank_frame_trap', type: 'trap', title: '空白帧压片阱', position: { x: 1, y: 2 },
      description: '压片阱试图把承伤过程抹成空白帧，护甲补片能够固定防护层并挡住剪切冲击。',
      trap: { damage: 228, dc: 50, counterItem: 'armor_patch' }
    },
    {
      id: 'script_projection_stage', type: 'reward', title: '剧本投映台', position: { x: 3, y: 3 },
      description: '投映台把三段录制与预写剧本逐帧对照，是留印协议与最后一次重拍共同核验的锚点。',
      reward: { rewardPoints: 540, lingyun: 2, items: { combat_reel: 1 } }
    },
    {
      id: 'final_cut_director', type: 'monster', title: '终剪导演', position: { x: 4, y: 2 },
      description: '终剪导演把三段录制拼成唯一版本，准备删去所有不服从预写结局的胜利镜头。',
      monsterId: 'final_cut_director'
    },
    {
      id: 'final_cut_lock', type: 'reward', title: '终剪封片锁', position: { x: 4, y: 3 },
      description: '封片锁保存开战前冻结的三段与路线快照，也是深层协议和追兵收容共同核验的稳定门。',
      reward: { rewardPoints: 530, lingyun: 1, items: { combat_reel: 1 } }
    },
    {
      id: 'theater_exit', type: 'exit', title: '复演场杀青门', position: { x: 5, y: 2 },
      description: '杀青门封存三段录制、路线选择与终剪结果，并将战斗母带交还主神空间结算。',
      reward: { rewardPoints: 1800, lingyun: 14, items: { combat_reel: 4, method_page: 2, cycle_imprint: 1 } }
    },
    {
      id: 'lower_entry', type: 'reward', title: '下层入场口', position: { x: 0, y: 3 },
      description: '来自裁定庭下层归返门的队伍在此入场，补给箱留下护甲补片与小界门符。',
      reward: { rewardPoints: 440, items: { armor_patch: 1, healing_pill: 1, gate_sigil: 1 } }
    },
    {
      id: 'take_gamma', type: 'monster', title: '丙段录制战', position: { x: 3, y: 2 },
      description: '第三台摄影机只接受一次完成，重拍替身会复刻此前两段最危险的动作。',
      monsterId: 'retake_double'
    },
    {
      id: 'retake_double_omega', type: 'monster', title: '终段重拍替身', position: { x: 2, y: 3 },
      description: '终段替身带着全部废弃镜头回场，等待把探索者替换进失败版本。',
      monsterId: 'retake_double'
    },
    {
      id: 'afterbeat_route', type: 'reward', title: '余拍复核台', position: { x: 5, y: 4 },
      description: '余拍复核台把迟到的动作保留在主镜头之后，避免终剪以节奏偏差为名删片。',
      reward: { rewardPoints: 180, items: { combat_reel: 2 } }
    },
    {
      id: 'burst_route', type: 'reward', title: '爆发复核台', position: { x: 5, y: 1 },
      description: '爆发复核台保存一次高强度剪接，灵蕴缓冲能阻止母带在快速切换中烧毁。',
      reward: { rewardPoints: 340, lingyun: 2, items: { combat_reel: 1 } }
    },
    {
      id: 'lower_return_portal', type: 'portal', title: '下层归返门', position: { x: 5, y: 3 },
      description: '归返门向下接入天幕监察城，小界门符能避免母带编号在跨境时重置。',
      portal: { targetDungeonId: 'panopticon_city', targetNodeId: 'lower_entry', stableItem: 'gate_sigil' }
    },
    {
      id: 'field_survey_cutting_room', type: 'reward', fieldSurveyId: 'survey_combat_replay_cutting_room', title: '剪辑室战痕调查', position: { x: 0, y: 4 },
      description: '剪辑室汇总历次失败复演的装备轨迹，可还原终剪装备参与三段录制的完整路径。',
      reward: { rewardPoints: 510, items: { combat_reel: 1 } }
    },
    {
      id: 'cue_stalker', type: 'monster', title: '场记潜猎者', position: { x: 1, y: 4 },
      description: '潜猎者躲在场记板后记录动作，等待探索者重复同一种进攻后扑入镜头。',
      monsterId: 'cue_stalker'
    },
    {
      id: 'return_rehearsal_portal', type: 'portal', title: '归返排演门', position: { x: 2, y: 4 },
      description: '排演门接入天幕监察城正门，小界门符能保护未署名镜头不被扫描改写。',
      portal: { targetDungeonId: 'panopticon_city', targetNodeId: 'panopticon_gate', stableItem: 'gate_sigil' }
    },
    {
      id: 'film_supply_cache', type: 'reward', equipmentHuntClueId: 'equipment_hunt_combat_replay_stage', title: '胶片补给箱', position: { x: 4, y: 4 },
      description: '补给箱内的胶片单保存第二条复演装备轨迹，与开场道具记录共同指向完整成品。',
      reward: { rewardPoints: 450, items: { dispel_talisman: 1, combat_reel: 1 } }
    },
    {
      id: 'soul_recharge_stage', type: 'monster', soulRechargeId: 'soul_node_combat_replay_recharge', title: '器魂复演充能台', position: { x: 3, y: 4 },
      description: '充能台被一名连续性剪辑师接管，只有击退看守并锁定真实动作，器魂才能安全续接。',
      monsterId: 'continuity_editor'
    },
    {
      id: 'script_stacks', type: 'reward', equipmentHuntClueId: 'equipment_hunt_combat_replay_stage', title: '剧本高架', position: { x: 0, y: 1 },
      description: '剧本高架保存所有被终剪淘汰的版本，也留下第一条复演装备流转记录。',
      reward: { rewardPoints: 560, lingyun: 2, items: { combat_reel: 2, healing_pill: 1 } }
    }
  ]
};
