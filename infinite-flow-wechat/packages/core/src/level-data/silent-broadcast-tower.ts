import type { DungeonDefinition } from '../game';

export const silentBroadcastTowerDungeon: DungeonDefinition = {
  id: 'silent_broadcast_tower',
  name: '寂声广播塔',
  tier: 15,
  genre: 'modern',
  recommendedPower: 950,
  theme: '一座现代应急广播塔在停播后仍向所有轮回频道发送空白讯号；探索者必须重启三座模拟中继台，穿过死频伪声并终止末频道播音主。',
  recommended: '推荐战力 950、完整终盘套装、三类陷阱反制品，以及足以承受高频剥离和静默压制的恢复储备。',
  rewardPreview: '静默晶核、终局材料、奖励点 1450-3600',
  grid: { width: 6, height: 5, startNodeId: 'broadcast_gate' },
  nodes: [
    {
      id: 'silent_archive', type: 'reward', title: '寂声档案库', position: { x: 0, y: 0 },
      description: '停播前的节目底稿被封存在无声胶片中，残余批注记录着广播塔最后一次全域静默。',
      reward: { rewardPoints: 410, items: { silence_core: 1, method_page: 1 } }
    },
    {
      id: 'north_echo_cache', type: 'reward', relicDraftId: 'silent_broadcast_tower:echo:1', title: '北段回声匣', position: { x: 1, y: 0 },
      description: '回声匣保存被切除的听觉残片，可从中选择一份仍能抵抗死频侵蚀的遗珍草案。',
      reward: { rewardPoints: 390, items: { silence_core: 1 } }
    },
    {
      id: 'north_signal_cache', type: 'reward', equipmentHuntClueId: 'equipment_hunt_silent_broadcast_tower', title: '北段讯号匣', position: { x: 2, y: 0 },
      description: '匣内频谱标出第一条断播装备轨迹，与南段记录合并后即可定位完整成品。',
      reward: { rewardPoints: 360, items: { silence_core: 1 } }
    },
    {
      id: 'frequency_leech_north', type: 'monster', title: '北廊频段寄生体', position: { x: 3, y: 0 },
      description: '寄生体咬住探索者重复释放的频段，把熟悉的攻击节律转成持续吸取灵力的噪声。',
      monsterId: 'frequency_leech'
    },
    {
      id: 'broadcast_warden_north', type: 'monster', title: '北台广播守卫', position: { x: 4, y: 0 },
      description: '重甲守卫以交替频带封锁北侧机房，错误节律会让它获得更强的静默护盾。',
      monsterId: 'broadcast_warden'
    },
    {
      id: 'resonance_vault', type: 'reward', title: '共振储备库', position: { x: 5, y: 0 },
      description: '储备库收纳尚未被静默污染的共振介质，足以补充一次高阶战斗后的灵力损耗。',
      reward: { rewardPoints: 470, lingyun: 2, items: { silence_core: 1, phase_glass: 1 } }
    },
    {
      id: 'north_entry', type: 'reward', title: '北段接收口', position: { x: 0, y: 1 },
      description: '来自原型库上层的讯号在此落地，值守柜留下本局探索所需的基础稳定补给。',
      reward: { rewardPoints: 360, items: { silence_core: 1, healing_pill: 1, gate_sigil: 1 } }
    },
    {
      id: 'north_relay_console', type: 'reward', title: '北段中继台', position: { x: 1, y: 1 },
      description: '北段中继台校准高频广播方向，启动后会削弱主播间外围的第一层静默屏障。',
      reward: { rewardPoints: 350, items: { silence_core: 1 } }
    },
    {
      id: 'acoustic_tripwire', type: 'trap', title: '声纹绊线阵', position: { x: 2, y: 1 },
      description: '不可闻声纹在走廊内交叉切割，破禁符能够抹除维持绊线阵的频谱铭文。',
      trap: { damage: 170, dc: 40, counterItem: 'dispel_talisman' }
    },
    {
      id: 'dead_air_gallery', type: 'reward', title: '死频陈列廊', position: { x: 3, y: 1 },
      description: '陈列廊封存历次停播留下的空白片段，其中仍凝结着可供修复装备的静默晶核。',
      reward: { rewardPoints: 400, items: { silence_core: 1, rift_dust: 1 } }
    },
    {
      id: 'central_relay_console', type: 'reward', title: '中央中继台', position: { x: 4, y: 1 },
      description: '中央中继台负责拼合南北讯号，重启后可让末频道的伪装声源短暂显形。',
      reward: { rewardPoints: 370, items: { silence_core: 1 } }
    },
    {
      id: 'upper_return_portal', type: 'portal', title: '上层救援门', position: { x: 5, y: 1 },
      description: '救援门通往失联避难所北侧入口，小界门符可以维持本局已重启中继台的状态。',
      portal: { targetDungeonId: 'lost_shelter', targetNodeId: 'north_entry', stableItem: 'gate_sigil' }
    },
    {
      id: 'broadcast_gate', type: 'reward', title: '广播塔正门', position: { x: 0, y: 2 },
      description: '正门登记入场频谱并发放断播行动的首批物资，三座中继台的状态同时亮起。',
      reward: { rewardPoints: 460, items: { silence_core: 2, healing_pill: 1, gate_sigil: 1 } }
    },
    {
      id: 'static_screen_trap', type: 'trap', title: '静电幕墙', position: { x: 1, y: 2 },
      description: '压缩静电组成的幕墙反复扫过通道，雷火符可以引走堆积在屏幕边缘的电荷。',
      trap: { damage: 168, dc: 39, counterItem: 'thunder_talisman' }
    },
    {
      id: 'broadcast_memory_stage', type: 'reward', title: '播音记忆台', position: { x: 2, y: 2 },
      description: '记忆台循环播放末次播音事故，残缺录音会根据探索者的选择重组停播真相。',
      reward: { rewardPoints: 430, lingyun: 1, items: { silence_core: 1 } }
    },
    {
      id: 'last_broadcaster', type: 'monster', title: '末频道播音主', position: { x: 3, y: 2 },
      description: '最后的播音主把全部空白频道叠成王座，试图将探索者改写为下一段永久播音。',
      monsterId: 'last_broadcaster'
    },
    {
      id: 'studio_side_lock', type: 'trap', title: '主播播间侧锁', position: { x: 4, y: 2 },
      description: '侧锁用熟悉声音侵入意识并强制校准，定神香可以保持自我频率直到扫描结束。',
      trap: { damage: 176, dc: 41, counterItem: 'focus_incense' }
    },
    {
      id: 'broadcast_exit', type: 'exit', title: '末频道停播台', position: { x: 5, y: 2 },
      description: '停播台封存本轮中继与战斗记录，并将完整静默样本交还主神空间结算。',
      reward: { rewardPoints: 1450, lingyun: 11, items: { silence_core: 4, method_page: 2, cycle_imprint: 1 } }
    },
    {
      id: 'lower_entry', type: 'reward', title: '下层接收口', position: { x: 0, y: 3 },
      description: '来自原型库下层的讯号在此落地，应急柜备有抵抗广播侵蚀的本局补给。',
      reward: { rewardPoints: 350, items: { silence_core: 1, focus_incense: 1, gate_sigil: 1 } }
    },
    {
      id: 'south_relay_console', type: 'reward', title: '南段中继台', position: { x: 1, y: 3 },
      description: '南段中继台稳定低频回路，启动后会截断播音主召回守卫的备用频道。',
      reward: { rewardPoints: 350, items: { silence_core: 1 } }
    },
    {
      id: 'broadcast_warden_omega', type: 'monster', title: '终段广播守卫', position: { x: 2, y: 3 },
      description: '终段守卫同时监听中继与主频道，会把连续重复的攻势压缩成反击脉冲。',
      monsterId: 'broadcast_warden'
    },
    {
      id: 'emergency_shelter', type: 'reward', title: '停播应急舱', position: { x: 3, y: 3 },
      description: '应急舱仍保有一次完整医疗循环，可支撑探索者完成主播播间前的最后整备。',
      reward: { rewardPoints: 380, items: { healing_pill: 2, silence_core: 1 } }
    },
    {
      id: 'anechoic_chamber', type: 'reward', relicDraftId: 'silent_broadcast_tower:anechoic:2', title: '全消声室', position: { x: 4, y: 3 },
      description: '全消声室隔绝塔内所有频道，墙面残留的防护结构可固化为第二份遗珍草案。',
      reward: { rewardPoints: 410, items: { silence_core: 1 } }
    },
    {
      id: 'lower_return_portal', type: 'portal', title: '下层救援门', position: { x: 5, y: 3 },
      description: '救援门通往失联避难所下侧入口，小界门符能避免静默样本在跨境时失真。',
      portal: { targetDungeonId: 'lost_shelter', targetNodeId: 'lower_entry', stableItem: 'gate_sigil' }
    },
    {
      id: 'field_survey_archive', type: 'reward', fieldSurveyId: 'survey_silent_broadcast_archive', title: '广播调查档案', position: { x: 0, y: 4 },
      description: '调查档案汇总各轮回小队留下的停播记录，可还原静默晶核形成与扩散的完整路径。',
      reward: { rewardPoints: 390, items: { silence_core: 1 } }
    },
    {
      id: 'dead_air_mimic', type: 'monster', title: '死频拟声体', position: { x: 1, y: 4 },
      description: '拟声体复制队伍最依赖的战斗声响，并用延迟回放干扰下一次相同类型的行动。',
      monsterId: 'dead_air_mimic'
    },
    {
      id: 'return_broadcast_portal', type: 'portal', title: '避难所救援门', position: { x: 2, y: 4 },
      description: '救援门通往失联避难所正门，小界门符能保护已收集的静默晶核不被频道抽离。',
      portal: { targetDungeonId: 'lost_shelter', targetNodeId: 'shelter_gate', stableItem: 'gate_sigil' }
    },
    {
      id: 'south_signal_cache', type: 'reward', equipmentHuntClueId: 'equipment_hunt_silent_broadcast_tower', title: '南段讯号匣', position: { x: 3, y: 4 },
      description: '匣内频谱保存第二条断播装备轨迹，与北段记录共同指向四件成熟装备。',
      reward: { rewardPoints: 360, items: { silence_core: 1 } }
    },
    {
      id: 'soul_recharge_broadcast', type: 'trap', soulRechargeId: 'soul_node_broadcast_recharge', title: '器魂静默充能舱', position: { x: 4, y: 4 },
      description: '充能舱先抽空器魂杂讯再注入纯净频谱，护甲补片可以承受重启瞬间的外壳震裂。',
      trap: { damage: 178, dc: 40, counterItem: 'armor_patch' }
    },
    {
      id: 'balanced_switchboard', type: 'reward', title: '均衡配线盘', position: { x: 5, y: 4 },
      description: '配线盘把残余频率均匀导向各层，为挑战播音主保留一份不偏向单一体系的资源。',
      reward: { rewardPoints: 450, lingyun: 2, items: { silence_core: 1, cracked_core: 1 } }
    }
  ]
};
