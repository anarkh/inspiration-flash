import type { DungeonDefinition } from '../game';

export const lostShelterDungeon: DungeonDefinition = {
  id: 'lost_shelter',
  name: '失联避难所',
  tier: 16,
  genre: 'modern',
  recommendedPower: 1040,
  theme: '现代城市防灾避难所仍按失效名单执行武装撤离；探索者必须利用枪械、掩体与急救物资护送最后一批幸存者穿过三处检查点，并终止失联总控。',
  recommended: '推荐战力 1040、完整终盘套装、三类机关反制品，以及足以维持幸存者护送与首领战的恢复储备。',
  rewardPreview: '救援铭牌、终局材料、奖励点 1580-3900',
  grid: { width: 6, height: 5, startNodeId: 'shelter_gate' },
  nodes: [
    {
      id: 'evacuation_cache', type: 'reward', relicDraftId: 'lost_shelter:evacuation:1', title: '撤离封存箱', position: { x: 0, y: 0 },
      description: '封存箱保存首轮撤离队留下的通行记录，残余编号可以固化为一份救援遗珍草案。',
      reward: { rewardPoints: 430, items: { rescue_badge: 1, method_page: 1 } }
    },
    {
      id: 'north_supply_cache', type: 'reward', equipmentHuntClueId: 'equipment_hunt_lost_shelter', title: '北区救援物资柜', position: { x: 1, y: 0 },
      description: '物资柜内的领用单标出第一条救援装备轨迹，与南区记录合并后即可定位完整成品。',
      reward: { rewardPoints: 390, items: { armor_patch: 1 } }
    },
    {
      id: 'north_rescue_patrol', type: 'monster', title: '北区失控哨戒炮', position: { x: 2, y: 0 },
      description: '失控的自动哨戒炮封锁北廊，每隔三轮完成一次压制齐射，迫使护送队寻找掩体。',
      monsterId: 'rogue_sentry'
    },
    {
      id: 'north_checkpoint', type: 'reward', title: '北区护送检查点', position: { x: 3, y: 0 },
      description: '北区闸门要求重新登记幸存者生命体征，可以选择停下救治或冒险加速推进。',
      reward: { rewardPoints: 400, items: { healing_pill: 1 } }
    },
    {
      id: 'shelter_enforcer_north', type: 'monster', title: '北闸避难所执行体', position: { x: 4, y: 0 },
      description: '执行体把所有未出现在旧名单上的生命标为伪装目标，并以封锁盾阵阻止任何逆向撤离。',
      monsterId: 'shelter_enforcer'
    },
    {
      id: 'upper_return_portal', type: 'portal', title: '上层归返门', position: { x: 5, y: 0 },
      description: '归返门转入伪证裁定庭北侧入口，小界门符可以保护救援记录不被新一轮证言审查删改。',
      portal: { targetDungeonId: 'false_testimony_court', targetNodeId: 'north_entry', stableItem: 'gate_sigil' }
    },
    {
      id: 'north_entry', type: 'reward', title: '北侧救援入口', position: { x: 0, y: 1 },
      description: '来自广播塔上层的队伍在此落地，值守箱留下止血丹与稳定跨区通道的小界门符。',
      reward: { rewardPoints: 380, items: { healing_pill: 1, gate_sigil: 1 } }
    },
    {
      id: 'collapsed_hall_trap', type: 'trap', title: '坍塌走廊压锁', position: { x: 1, y: 1 },
      description: '断裂顶梁会在护送队经过时连续下压，护甲补片能够撑住承重点并打开安全间隙。',
      trap: { damage: 182, dc: 42, counterItem: 'armor_patch' }
    },
    {
      id: 'survivor_cell', type: 'reward', title: '幸存者隔离舱', position: { x: 2, y: 1 },
      description: '隔离舱不断传出与失联者完全相同的呼救，门外记录却显示内部生命体征早已归零。',
      reward: { rewardPoints: 420, lingyun: 1 }
    },
    {
      id: 'central_checkpoint', type: 'reward', title: '中央护送检查点', position: { x: 3, y: 1 },
      description: '中央闸门重新核验队伍状态，短暂停留可以救治伤员，继续推进则能抢在封锁前通过。',
      reward: { rewardPoints: 420, items: { armor_patch: 1 } }
    },
    {
      id: 'mimic_survivor_alpha', type: 'monster', title: '首席拟声幸存者', position: { x: 4, y: 1 },
      description: '首席拟声体复制队伍中最虚弱者的声音与动作，试图让护送者在真假目标之间浪费火力。',
      monsterId: 'mimic_survivor'
    },
    {
      id: 'desperate_armory', type: 'reward', relicDraftId: 'lost_shelter:desperate:2', title: '绝境军械库', position: { x: 5, y: 1 },
      description: '军械库封存最后一次撤离失败后留下的加固方案，可以从中固化第二份救援遗珍草案。',
      reward: { rewardPoints: 450, items: { rescue_badge: 1 } }
    },
    {
      id: 'shelter_gate', type: 'reward', title: '避难所正门', position: { x: 0, y: 2 },
      description: '正门确认护送任务并发放首批急救物资，三座检查点与失联总控同时在平面图上亮起。',
      reward: { rewardPoints: 500, items: { healing_pill: 1, armor_patch: 1, gate_sigil: 1 } }
    },
    {
      id: 'alarm_grid_trap', type: 'trap', title: '撤离警报电网', position: { x: 1, y: 2 },
      description: '警报电网把奔跑脚步识别为感染扩散，雷火符可以反向引走闸门边缘积蓄的电荷。',
      trap: { damage: 186, dc: 43, counterItem: 'thunder_talisman' }
    },
    {
      id: 'survivor_memory_stage', type: 'reward', title: '幸存者点名台', position: { x: 2, y: 2 },
      description: '点名台循环播放最后一轮撤离名单，只有坚持确认每个身份，装备才能记住仍然活着的人。',
      reward: { rewardPoints: 470, lingyun: 1 }
    },
    {
      id: 'shelter_overseer', type: 'monster', title: '失联总控', position: { x: 3, y: 2 },
      description: '失联总控把幸存者视为待接管资源，试图在撤离完成前将整支队伍写入无人应答名单。',
      monsterId: 'shelter_overseer'
    },
    {
      id: 'command_lock', type: 'trap', title: '总控身份锁', position: { x: 4, y: 2 },
      description: '身份锁会用队友口令反复覆盖自我判断，定神香可以维持真实身份直到核验结束。',
      trap: { damage: 188, dc: 44, counterItem: 'focus_incense' }
    },
    {
      id: 'shelter_exit', type: 'exit', title: '最终撤离闸', position: { x: 5, y: 2 },
      description: '撤离闸封存本轮护送、调查与战斗记录，并将幸存者名单和救援凭证交还主神空间结算。',
      reward: { rewardPoints: 1580, lingyun: 12, items: { rescue_badge: 4, method_page: 2, cycle_imprint: 1 } }
    },
    {
      id: 'lower_entry', type: 'reward', title: '下侧救援入口', position: { x: 0, y: 3 },
      description: '来自广播塔下层的队伍在此落地，应急箱留下护甲补片与稳定撤离通道的小界门符。',
      reward: { rewardPoints: 380, items: { armor_patch: 1, gate_sigil: 1 } }
    },
    {
      id: 'south_checkpoint', type: 'reward', title: '南区护送检查点', position: { x: 1, y: 3 },
      description: '南区闸门是最后一次护送决策，救治可以保住伤员，强推则能避开正在闭合的隔离墙。',
      reward: { rewardPoints: 410, items: { healing_pill: 1 } }
    },
    {
      id: 'evacuation_horror_omega', type: 'monster', title: '终段撤离畸变体', position: { x: 2, y: 3 },
      description: '畸变体由多名未能撤离者黏合而成，会把队伍的治疗与推进选择扭成下一轮攻击节奏。',
      monsterId: 'evacuation_horror'
    },
    {
      id: 'emergency_medbay', type: 'reward', title: '紧急医疗舱', position: { x: 3, y: 3 },
      description: '医疗舱仍能完成一次快速止血循环，为护送队进入收容区前保留最后一份恢复余量。',
      reward: { rewardPoints: 410, items: { healing_pill: 2 } }
    },
    {
      id: 'containment_bay', type: 'reward', title: '失联收容舱', position: { x: 4, y: 3 },
      description: '收容舱可以封闭追随队伍的接管信号，也是深层协议核验幸存者记录的第二处锚点。',
      reward: { rewardPoints: 450, lingyun: 1 }
    },
    {
      id: 'lower_return_portal', type: 'portal', title: '下层归返门', position: { x: 5, y: 3 },
      description: '归返门转入伪证裁定庭下侧入口，小界门符能避免幸存者名单在跨庭质证时被重置。',
      portal: { targetDungeonId: 'false_testimony_court', targetNodeId: 'lower_entry', stableItem: 'gate_sigil' }
    },
    {
      id: 'field_survey_archive', type: 'reward', fieldSurveyId: 'survey_shelter_rescue_archive', title: '救援调查档案', position: { x: 0, y: 4 },
      description: '调查档案汇总历次失联救援留下的黑匣记录，可还原五件救援装备参与撤离的完整路径。',
      reward: { rewardPoints: 430, items: { rescue_badge: 1 } }
    },
    {
      id: 'mimic_survivor', type: 'monster', title: '拟声幸存者', position: { x: 1, y: 4 },
      description: '拟声幸存者躲在旧担架之间复制伤员呼吸，等待救援者放下武器进行错误分诊。',
      monsterId: 'mimic_survivor'
    },
    {
      id: 'return_shelter_portal', type: 'portal', title: '归返救援门', position: { x: 2, y: 4 },
      description: '救援门转入伪证裁定庭正门，小界门符能保护黑匣记录不被主审改写成错误证词。',
      portal: { targetDungeonId: 'false_testimony_court', targetNodeId: 'verdict_gate', stableItem: 'gate_sigil' }
    },
    {
      id: 'south_supply_cache', type: 'reward', equipmentHuntClueId: 'equipment_hunt_lost_shelter', title: '南区救援物资柜', position: { x: 3, y: 4 },
      description: '物资柜内的回收单保存第二条救援装备轨迹，与北区记录共同指向五件成熟装备。',
      reward: { rewardPoints: 390, items: { focus_incense: 1 } }
    },
    {
      id: 'soul_recharge_shelter', type: 'monster', soulRechargeId: 'soul_node_shelter_recharge', title: '器魂救援充能舱', position: { x: 4, y: 4 },
      description: '充能舱被一具执行体接管，只有击退看守并切断伪造求救信号，器魂才能完成安全续接。',
      monsterId: 'shelter_enforcer'
    },
    {
      id: 'balanced_medbay', type: 'reward', title: '均衡分诊舱', position: { x: 5, y: 4 },
      description: '分诊舱把剩余药械均匀分给护送队伍，为挑战失联总控保留不偏向单一体系的资源。',
      reward: { rewardPoints: 490, lingyun: 2, items: { healing_pill: 1, armor_patch: 1 } }
    }
  ]
};
