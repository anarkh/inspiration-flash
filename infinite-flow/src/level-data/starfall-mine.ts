import type { DungeonDefinition } from '../game';

export const starfallMineDungeon: DungeonDefinition = {
  id: 'starfall_mine',
  name: '星坠矿井',
  tier: 3,
  genre: 'science_fiction',
  recommendedPower: 230,
  theme: '陨星砸穿旧矿井，矿壳怪物在错乱重力里巡逻。',
  recommended: '推荐破甲剑或灵力 4。',
  rewardPreview: '星铁、功法残页、奖励点 260-700',
  grid: { width: 6, height: 5, startNodeId: 'mine_arrival' },
  nodes: [
    {
      id: 'rail_chain_cache',
      type: 'reward',
      relicDraftId: 'starfall_mine:echo:1',
      title: '断链补给箱',
      position: { x: 0, y: 0 },
      description: '升降链旁的补给箱被星尘封住，撬开后还能找到旧矿工留下的界门粉末。',
      reward: { rewardPoints: 80, items: { rift_dust: 1 } }
    },
    {
      id: 'tilted_gravity_switch',
      type: 'trap',
      title: '重力岔路闸',
      position: { x: 1, y: 0 },
      description: '岔路闸门突然横转，脚下轨枕变成井壁，把没有锚定的行囊甩向深坑。',
      trap: { damage: 28, dc: 10, counterItem: 'gate_sigil' }
    },
    {
      id: 'spark_imp_roost',
      type: 'monster',
      title: '跳火小鬼巢',
      position: { x: 2, y: 0 },
      description: '成群小鬼扒在电缆上啃火星，等你经过时把整段矿灯点成爆鸣。',
      monsterId: 'spark_imp'
    },
    {
      id: 'north_star_vein',
      type: 'reward',
      equipmentHuntClueId: 'equipment_hunt_starfall_mine',
      title: '北壁星铁脉',
      position: { x: 3, y: 0 },
      description: '北壁裂缝里露出细碎星铁，敲下来的矿砂会短暂漂浮，像被陨星召回。',
      reward: { rewardPoints: 110, items: { star_iron: 1 } }
    },
    {
      id: 'backup_gravity_well',
      type: 'portal',
      title: '备用重力井',
      position: { x: 4, y: 0 },
      description: '备用井口的风向倒灌，井底白灯拼成病院分诊台的影子，可以提前撤入下一层。',
      portal: { targetDungeonId: 'rust_hospital', targetNodeId: 'triage_reward', stableItem: 'gate_sigil' }
    },
    {
      id: 'hanging_lamp_cache',
      type: 'reward',
      title: '倒悬矿灯',
      position: { x: 5, y: 0 },
      description: '矿灯倒挂在空中不肯落下，灯罩里沉着一撮能安定裂隙的灰烬。',
      reward: { rewardPoints: 90, items: { medicine_ash: 1 } }
    },
    {
      id: 'shell_patrol_alpha',
      type: 'monster',
      title: '矿壳巡哨',
      position: { x: 0, y: 1 },
      description: '矿壳巡哨沿断轨敲击铁镐，用回声确认每一条重力岔路是否有人闯入。',
      monsterId: 'mine_shell_guard'
    },
    {
      id: 'gravity_branch_reward',
      type: 'reward',
      title: '重力岔路矿袋',
      position: { x: 1, y: 1 },
      description: '岔路尽头的矿袋贴在墙面，你顺着反重力爬过去，摸到一枚完好的星铁扣。',
      reward: { rewardPoints: 100, items: { star_iron: 1 } }
    },
    {
      id: 'coil_burst_trap',
      type: 'trap',
      title: '线圈爆鸣',
      position: { x: 2, y: 1 },
      description: '废旧线圈吸住护腕后猛然放电，磁暴沿铁轨追着脚步向前滚。',
      trap: { damage: 30, dc: 10, counterItem: 'armor_patch' }
    },
    {
      id: 'molt_beast_patrol',
      type: 'monster',
      title: '裂隙怪巡逻',
      position: { x: 3, y: 1 },
      description: '裂隙怪巡逻在矿柱之间换皮，每经过一处传送裂缝都会留下新的空间鳞屑。',
      monsterId: 'portal_molt_beast'
    },
    {
      id: 'rail_map_reward',
      type: 'reward',
      title: '磁轨旧图',
      position: { x: 4, y: 1 },
      description: '旧图把磁暴陷阱的放电间隔标成红线，图角还夹着一页功法残纸。',
      reward: { rewardPoints: 105, items: { method_page: 1 } }
    },
    {
      id: 'falling_ore_trap',
      type: 'trap',
      title: '落星矿雨',
      position: { x: 5, y: 1 },
      description: '井顶的星铁碎矿被重力反复抛起又砸落，像一场只对铁器有仇的暴雨。',
      trap: { damage: 32, dc: 11, counterItem: 'gate_sigil' }
    },
    {
      id: 'mine_arrival',
      type: 'reward',
      title: '断轨升降台',
      position: { x: 0, y: 2 },
      description: '半截铁链吊着升降台，井底闪着星铁蓝光，断轨把你送进错乱重力的矿区。',
      reward: { rewardPoints: 90, items: { rift_dust: 1 } }
    },
    {
      id: 'mine_shell_guard',
      type: 'monster',
      title: '矿壳守卫',
      position: { x: 1, y: 2 },
      description: '守卫胸口嵌着星铁，普通刀刃砍上去只会溅出火星，它把升降台出口完全堵住。',
      monsterId: 'mine_shell_guard'
    },
    {
      id: 'magnetic_rail_trap',
      type: 'trap',
      title: '磁暴轨道',
      position: { x: 2, y: 2 },
      description: '废轨突然通电，所有铁器都被吸向黑暗深处，磁暴陷阱逼你贴着墙面前进。',
      trap: { damage: 34, dc: 11, counterItem: 'gate_sigil' }
    },
    {
      id: 'mine_deep_portal',
      type: 'portal',
      title: '斜重力井',
      position: { x: 3, y: 2 },
      description: '矿井竖壁变成地面，远处病院的白灯在重力井里倒悬，像一条通往分诊台的斜坡。',
      portal: { targetDungeonId: 'rust_hospital', targetNodeId: 'triage_reward', stableItem: 'gate_sigil' }
    },
    {
      id: 'rift_beast',
      type: 'monster',
      title: '裂门蜕兽',
      position: { x: 4, y: 2 },
      description: '它从传送门里换下一层旧皮，新皮还带着空间裂纹，巡逻路线绕着星核矿脉打转。',
      monsterId: 'portal_molt_beast'
    },
    {
      id: 'east_ore_cache',
      type: 'reward',
      relicDraftId: 'starfall_mine:echo:2',
      title: '东侧星铁筐',
      position: { x: 5, y: 2 },
      description: '矿筐被磁力钉在墙上，里面的星铁矿脉碎片还保留着微弱脉冲。',
      reward: { rewardPoints: 120, items: { star_iron: 1 } }
    },
    {
      id: 'inverted_shaft_trap',
      type: 'trap',
      title: '倒井坠落',
      position: { x: 0, y: 3 },
      description: '看似平直的矿道忽然翻成竖井，重力把人往侧壁拖去，只能靠界门符稳住步伐。',
      trap: { damage: 31, dc: 10, counterItem: 'gate_sigil' }
    },
    {
      id: 'star_core_reward',
      type: 'reward',
      title: '星核矿脉',
      position: { x: 1, y: 3 },
      description: '矿脉像心脏一样跳动，每敲一下主神空间都会短暂闪烁，星铁矿脉深处藏着功法残文。',
      reward: {
        rewardPoints: 220,
        lingyun: 1,
        items: { star_iron: 1 },
        methodBonus: {
          methodId: 'gate_sense',
          text: '观门法让你避开裂隙反冲，抄下一页功法残文。',
          reward: { rewardPoints: 120, items: { method_page: 1 } }
        }
      }
    },
    {
      id: 'spark_imp_switchback',
      type: 'monster',
      title: '折返电火鬼',
      position: { x: 2, y: 3 },
      description: '小鬼沿折返轨道来回跃迁，第三次火星爆开前会故意把你引向磁暴轨道。',
      monsterId: 'spark_imp'
    },
    {
      id: 'resonant_pick_reward',
      type: 'reward',
      fieldSurveyId: 'survey_mine_resonant_vein',
      title: '共振矿镐',
      position: { x: 3, y: 3 },
      description: '矿镐插在会发光的石缝里，轻敲三下就能震落一枚裂隙核心碎片。',
      reward: { rewardPoints: 130, items: { cracked_core: 1 } }
    },
    {
      id: 'static_dust_trap',
      type: 'trap',
      title: '静电尘幕',
      position: { x: 4, y: 3 },
      description: '星尘在空气里结成薄幕，穿过去时会把灵力拖慢，连呼吸都带着铁锈味。',
      trap: { damage: 29, dc: 10, counterItem: 'focus_incense' }
    },
    {
      id: 'triage_light_portal',
      type: 'portal',
      title: '病院白灯裂缝',
      position: { x: 5, y: 3 },
      description: '裂缝里透出病院白灯和药水味，备用路线同样会把你送到锈疫病院的分诊台。',
      portal: { targetDungeonId: 'rust_hospital', targetNodeId: 'triage_reward', stableItem: 'gate_sigil' }
    },
    {
      id: 'lower_rail_reward',
      type: 'reward',
      equipmentHuntClueId: 'equipment_hunt_starfall_mine',
      title: '下层轨枕储物格',
      position: { x: 0, y: 4 },
      description: '轨枕下的储物格藏着矿工避险物资，虽然潮湿，仍有几件能派上用场。',
      reward: { rewardPoints: 95, items: { armor_patch: 1 } }
    },
    {
      id: 'shell_guard_beta',
      type: 'monster',
      soulRechargeId: 'soul_node_mine_load_bearing',
      title: '负重矿壳兵',
      position: { x: 1, y: 4 },
      description: '矿壳兵背着整块星铁矿脉行走，重步声让附近的重力岔路一起震颤。',
      monsterId: 'mine_shell_guard'
    },
    {
      id: 'rift_dust_reward',
      type: 'reward',
      title: '裂尘沉淀池',
      position: { x: 2, y: 4 },
      description: '沉淀池里漂着蓝黑色裂尘，收拢时能听见下一层病院走廊的回声。',
      reward: { rewardPoints: 115, items: { rift_dust: 1 } }
    },
    {
      id: 'molt_beast_den',
      type: 'monster',
      title: '蜕皮兽穴',
      position: { x: 3, y: 4 },
      description: '兽穴铺满透明旧皮，裂门蜕兽在里面守着出口前最后一段巡逻线。',
      monsterId: 'portal_molt_beast'
    },
    {
      id: 'exit_anchor_reward',
      type: 'reward',
      title: '井口锚钉',
      position: { x: 4, y: 4 },
      description: '锚钉扎住最后一段轨道，拔出时能稳定身后的空间裂纹，免得矿井继续坍缩。',
      reward: { rewardPoints: 125, items: { gate_sigil: 1 } }
    },
    {
      id: 'mine_exit',
      type: 'exit',
      title: '井口白光',
      position: { x: 5, y: 4 },
      description: '白光挂在井口，你只需要最后一次跳跃，磁暴还在脚下追赶，裂隙怪的脚步声被甩在身后。',
      reward: { rewardPoints: 260, lingyun: 1 }
    }
  ]
};
