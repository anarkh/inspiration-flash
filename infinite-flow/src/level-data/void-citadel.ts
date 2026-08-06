import type { DungeonDefinition } from '../game';

export const voidCitadelDungeon: DungeonDefinition = {
  id: 'void_citadel',
  name: '虚界城',
  tier: 7,
  genre: 'science_fiction',
  recommendedPower: 390,
  theme: '主神空间的残响在虚界城回放，终盘副本要求玩家均衡成长。',
  recommended: '推荐战力 390、淬星剑胚、虚心诀或高阶宠物。',
  rewardPreview: '裂核、终盘材料、奖励点 540-1260',
  grid: { width: 6, height: 5, startNodeId: 'citadel_gate' },
  // 满铺 6x5 网格，让身份试炼、巡逻线和回声门支路都保持相邻可达。
  nodes: [
    {
      id: 'citadel_gate',
      type: 'reward',
      title: '虚界城门',
      position: { x: 0, y: 0 },
      description: '城门没有守卫，只有一行问题：你靠哪一种成长走到这里？门缝里落着一撮裂隙尘。',
      reward: { rewardPoints: 180, lingyun: 1, items: { rift_dust: 1 } }
    },
    {
      id: 'gate_oath_cache',
      type: 'reward',
      equipmentHuntClueId: 'equipment_hunt_void_citadel',
      title: '入城誓印',
      position: { x: 1, y: 0 },
      description: '誓印要求你确认本轮核心路线，选定后才会吐出一枚稳定回声门的小界门符。',
      reward: { rewardPoints: 120, items: { gate_sigil: 1 } }
    },
    {
      id: 'void_knight',
      type: 'monster',
      title: '虚界骑士',
      position: { x: 2, y: 0 },
      description: '骑士的盔甲里没有身体，只有你曾经放弃过的路线；它会用这些空缺挡下第一次终结。',
      monsterId: 'void_knight'
    },
    {
      id: 'identity_trap',
      type: 'trap',
      title: '身份剥离',
      position: { x: 3, y: 0 },
      description: '陷阱不伤肉体，只试图剥掉你从功法、装备和宠物里得到的成长。',
      trap: { damage: 52, dc: 17, counterItem: 'focus_incense' }
    },
    {
      id: 'echo_portal',
      type: 'portal',
      title: '主神回声门',
      position: { x: 4, y: 0 },
      description: '门内不断复制主神空间，支路会把你抛向时序观测庭，校验已经完成的终盘选择。',
      portal: { targetDungeonId: 'temporal_observatory', targetNodeId: 'past_clue_cache', stableItem: 'gate_sigil' }
    },
    {
      id: 'echo_branch_cache',
      type: 'reward',
      title: '回声门余烬',
      position: { x: 5, y: 0 },
      description: '回声门边缘烧着白色余烬，愿意检查支路的人能带走一份终盘补给。',
      reward: { rewardPoints: 130, items: { focus_incense: 1 } }
    },
    {
      id: 'identity_trial_reward',
      type: 'reward',
      title: '身份试炼刻痕',
      position: { x: 0, y: 1 },
      description: '墙上刻着装备、功法和灵宠三列刻痕，均衡路线会在其中找到额外的灵蕴。',
      reward: { rewardPoints: 145, lingyun: 1 }
    },
    {
      id: 'first_echo_patrol',
      type: 'monster',
      title: '残响巡逻甲',
      position: { x: 1, y: 1 },
      description: '巡逻骑士沿外墙反复确认你的称号，回答越急，越容易被它逼进身份试炼。',
      monsterId: 'void_knight'
    },
    {
      id: 'growth_mirror_trap',
      type: 'trap',
      title: '成长镜像',
      position: { x: 2, y: 1 },
      description: '镜面复制最高派生属性，再把最低的成长短板放大成伤害，偏科者会先被照出来。',
      trap: { damage: 54, dc: 18, counterItem: 'focus_incense' }
    },
    {
      id: 'mirror_supply',
      type: 'reward',
      title: '镜后补给',
      position: { x: 3, y: 1 },
      description: '镜后藏着上一轮失败者留下的护甲补片，像是主神允许你临时修正短板。',
      reward: { rewardPoints: 110, items: { armor_patch: 1 } }
    },
    {
      id: 'echo_gate_guard',
      type: 'monster',
      title: '回声门守卫',
      position: { x: 4, y: 1 },
      description: '守卫只守回声门支路，盔甲内回放着你在妖塔第一次败退时的脚步声。',
      monsterId: 'void_knight'
    },
    {
      id: 'echo_loop_trap',
      type: 'trap',
      title: '回声折返',
      position: { x: 5, y: 1 },
      description: '支路尽头的脚印忽然倒退，若没有小界门符锚定，会被折回最痛的一次选择。',
      trap: { damage: 50, dc: 17, counterItem: 'gate_sigil' }
    },
    {
      id: 'terminal_cache',
      type: 'reward',
      relicDraftId: 'void_citadel:echo:1',
      title: '终盘资源匣',
      position: { x: 0, y: 2 },
      description: '资源匣按最终副本规格封存，里面的裂核碎片足够支撑一次装备冲刺。',
      reward: { rewardPoints: 150, items: { cracked_core: 1 } }
    },
    {
      id: 'broken_name_trap',
      type: 'trap',
      title: '断名铭牌',
      position: { x: 1, y: 2 },
      description: '铭牌刮掉你的名字后开始倒数，定神香能让你记住自己为什么进入虚界城。',
      trap: { damage: 56, dc: 18, counterItem: 'focus_incense' }
    },
    {
      id: 'main_god_echo',
      type: 'monster',
      title: '主神残响',
      position: { x: 2, y: 2 },
      description: '残响会读取最高派生属性，单点堆攻会被复制，均衡成长反而更容易收束它。',
      monsterId: 'main_god_echo'
    },
    {
      id: 'balance_reward',
      type: 'reward',
      title: '均衡校准台',
      position: { x: 3, y: 2 },
      description: '校准台把装备、功法和灵宠的记录摆成三角，完成身份试炼后能取走一页功法残片。',
      reward: { rewardPoints: 160, lingyun: 1, items: { method_page: 1 } }
    },
    {
      id: 'return_echo_portal',
      type: 'portal',
      title: '回声门支路',
      position: { x: 4, y: 2 },
      description: '这道窄门通向时序观测庭的未来线索，让终盘角色继续追踪主神残响之外的时间波动。',
      portal: { targetDungeonId: 'temporal_observatory', targetNodeId: 'future_clue_cache', stableItem: 'gate_sigil' }
    },
    {
      id: 'sealed_echo_reward',
      type: 'reward',
      relicDraftId: 'void_citadel:echo:2',
      title: '封存回声',
      position: { x: 5, y: 2 },
      description: '封存回声像一枚旧硬币，轻轻一敲就响起妖塔暗格被打开时的声音。',
      reward: { rewardPoints: 125, items: { echo_coin: 1 } }
    },
    {
      id: 'rift_dust_cache',
      type: 'reward',
      equipmentHuntClueId: 'equipment_hunt_void_citadel',
      title: '裂隙尘堆',
      position: { x: 0, y: 3 },
      description: '裂隙尘堆沿巡逻路线撒开，说明这里既是补给点，也是残响骑士的换防标记。',
      reward: { rewardPoints: 135, items: { rift_dust: 2 } }
    },
    {
      id: 'second_echo_patrol',
      type: 'monster',
      title: '残响巡逻乙',
      position: { x: 1, y: 3 },
      description: '第二队巡逻不追击，只把你的成长路径念给主神残响听，逼你先清掉后顾之忧。',
      monsterId: 'void_knight'
    },
    {
      id: 'self_shadow_trap',
      type: 'trap',
      soulRechargeId: 'soul_node_citadel_self_shadow',
      title: '自影审判',
      position: { x: 2, y: 3 },
      description: '你的影子从脚下站起来，专挑最低防线下手，护甲补片能挡住第一轮撕扯。',
      trap: { damage: 55, dc: 18, counterItem: 'armor_patch' }
    },
    {
      id: 'method_page_reward',
      type: 'reward',
      title: '残响批注',
      position: { x: 3, y: 3 },
      description: '批注写着虚心诀如何压低残响波峰，读完后能把失败经验换成功法残页。',
      reward: { rewardPoints: 155, items: { method_page: 1 } }
    },
    {
      id: 'echo_core_shard',
      type: 'monster',
      title: '残响核心碎影',
      position: { x: 4, y: 3 },
      description: '碎影没有完整意志，却会模拟主神残响的复制逻辑，为终点核心预演压力。',
      monsterId: 'main_god_echo'
    },
    {
      id: 'final_sigil_reward',
      type: 'reward',
      title: '终局界门符',
      position: { x: 5, y: 3 },
      description: '界门符被压在终局资源点旁，适合在撤离前稳定最后一次回声门波动。',
      reward: { rewardPoints: 120, items: { gate_sigil: 1 } }
    },
    {
      id: 'fallback_medicine_reward',
      type: 'reward',
      title: '终盘药灰',
      position: { x: 0, y: 4 },
      description: '药灰已经被白光烤成银色，是给资源不足路线留下的最后一次恢复机会。',
      reward: { rewardPoints: 115, items: { medicine_ash: 1, healing_pill: 1 } }
    },
    {
      id: 'armor_memory_trap',
      type: 'trap',
      title: '甲胄记忆',
      position: { x: 1, y: 4 },
      description: '旧甲胄记住每一次硬吃伤害的选择，若不净化，它会把账一次性算到终点前。',
      trap: { damage: 58, dc: 19, counterItem: 'dispel_talisman' }
    },
    {
      id: 'knight_afterimage',
      type: 'monster',
      title: '骑士余像',
      position: { x: 2, y: 4 },
      description: '余像守着撤离前的横线，逼你确认虚界骑士的保命机制已经有稳定答案。',
      monsterId: 'void_knight'
    },
    {
      id: 'cracked_core_reward',
      type: 'reward',
      fieldSurveyId: 'survey_citadel_final_cache',
      title: '裂核终奖',
      position: { x: 3, y: 4 },
      description: '终奖盒里并排放着裂核和星铁，像是给最后一轮装备成长的明确回报。',
      reward: { rewardPoints: 170, items: { cracked_core: 1, star_iron: 1 } }
    },
    {
      id: 'last_resource_point',
      type: 'reward',
      title: '终盘资源点',
      position: { x: 4, y: 4 },
      description: '资源点把灵蕴、裂隙尘和回声钱压在一起，提醒你结算前仍能微调成长结构。',
      reward: { rewardPoints: 165, lingyun: 1, items: { rift_dust: 1, echo_coin: 1 } }
    },
    {
      id: 'citadel_exit',
      type: 'exit',
      title: '残响核心',
      position: { x: 5, y: 4 },
      description: '核心像一颗白色心脏跳动，等待你把本轮成长写入结算。',
      reward: { rewardPoints: 520, lingyun: 3, items: { cracked_core: 2, method_page: 1 } }
    }
  ]
};
