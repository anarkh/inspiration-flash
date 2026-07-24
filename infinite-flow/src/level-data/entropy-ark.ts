import type { DungeonDefinition } from '../game';

export const entropyArkDungeon: DungeonDefinition = {
  id: 'entropy_ark',
  name: '熵海方舟',
  tier: 10,
  recommendedPower: 565,
  theme: '方舟在热寂潮汐中持续失序，探索者必须校正双舷压载并重刻航迹，才能抵达终末舵轮。',
  recommended: '推荐战力 565、熵航装备、稳定的界门补给与足以承受崩解的持续防护。',
  rewardPreview: '熵晶、终局材料、奖励点 720-1980',
  grid: { width: 6, height: 5, startNodeId: 'ark_gate' },
  // 双舷与中轴甲板满铺 6x5 网格，压载锚、事件与回航门均有独立宿主。
  nodes: [
    {
      id: 'port_clue_cache',
      type: 'reward',
      equipmentHuntClueId: 'equipment_hunt_entropy_ark',
      title: '左舷线索匣',
      position: { x: 0, y: 0 },
      description: '匣中封存左舷装备的失序航迹，稳定刻线指向方舟深处的三件冻结装备。',
      reward: { rewardPoints: 205, items: { entropy_crystal: 1 } }
    },
    {
      id: 'dissipation_navigator_alpha',
      type: 'monster',
      title: '耗散领航员·左舷',
      position: { x: 1, y: 0 },
      description: '领航员把每次推进折算成不可逆的热损，迫使闯入者在航速与稳定之间取舍。',
      monsterId: 'dissipation_navigator'
    },
    {
      id: 'bow_heading_console',
      type: 'reward',
      title: '舰艏航向台',
      position: { x: 2, y: 0 },
      description: '航向台仍能辨认方舟驶入熵海前的基准星图，校正后析出一枚稳定熵晶。',
      reward: { rewardPoints: 220, items: { entropy_crystal: 1, gate_sigil: 1 } }
    },
    {
      id: 'port_relic_hold',
      type: 'reward',
      relicDraftId: 'entropy_ark:port:1',
      title: '左舷遗珍舱',
      position: { x: 3, y: 0 },
      description: '遗珍舱把尚未耗散的可能性压成草案，取走其中一页便会固定一段左舷航程。',
      reward: { rewardPoints: 215, items: { entropy_crystal: 1, method_page: 1 } }
    },
    {
      id: 'wake_shear_trap',
      type: 'trap',
      title: '尾迹剪切带',
      position: { x: 4, y: 0 },
      description: '两段反向尾迹在甲板上互相剪切，定神香可以让身体只跟随其中一条航线。',
      trap: { damage: 90, dc: 26, counterItem: 'focus_incense' }
    },
    {
      id: 'port_return_portal',
      type: 'portal',
      title: '左舷回航门',
      position: { x: 5, y: 0 },
      description: '跃迁门沿旧航迹驶入镜海轮回城的现实线索库，小界门符能防止途中航向再次失序。',
      portal: { targetDungeonId: 'mirror_cycle_city', targetNodeId: 'real_clue_vault', stableItem: 'gate_sigil' }
    },
    {
      id: 'port_supply',
      type: 'reward',
      title: '左舷补给舱',
      position: { x: 0, y: 1 },
      description: '补给舱的恒温层尚未完全失效，剩余物资和熵晶被固定在同一只耐压箱里。',
      reward: { rewardPoints: 190, items: { entropy_crystal: 1, healing_pill: 1 } }
    },
    {
      id: 'entropy_deckhand_port',
      type: 'monster',
      title: '左舷熵舱水手',
      position: { x: 1, y: 1 },
      description: '失序水手拖着断裂缆索巡舱，每一次挥击都会把周围甲板推向更高熵态。',
      monsterId: 'entropy_deckhand'
    },
    {
      id: 'port_ballast_core',
      type: 'reward',
      title: '左舷深层压载锚',
      position: { x: 2, y: 1 },
      description: '深层压载核心把左舷质量钉在稳定航线上，是深层协议必须先于舵手战完成的锚点。',
      reward: { rewardPoints: 235, lingyun: 1, items: { entropy_crystal: 1, cycle_imprint: 1 } }
    },
    {
      id: 'entropy_ballast_deck',
      type: 'reward',
      fieldSurveyId: 'survey_entropy_ballast_deck',
      title: '熵压载调查甲板',
      position: { x: 3, y: 1 },
      description: '调查甲板记录双舷压载的实时偏差，完整勘测能从失序读数中筛出稳定材料。',
      reward: { rewardPoints: 230, items: { entropy_crystal: 1 } }
    },
    {
      id: 'port_pressure_lock',
      type: 'trap',
      title: '左舷压差锁',
      position: { x: 4, y: 1 },
      description: '压差锁把舱内外的耗散同时释放，护甲补片可以暂时封住最先崩裂的接缝。',
      trap: { damage: 94, dc: 26, counterItem: 'armor_patch' }
    },
    {
      id: 'gate_sigil_locker',
      type: 'reward',
      title: '界门符储柜',
      position: { x: 5, y: 1 },
      description: '储柜专为两座回航门保留稳定符，柜底还凝着一枚未经登记的熵晶。',
      reward: { rewardPoints: 195, items: { gate_sigil: 1, entropy_crystal: 1 } }
    },
    {
      id: 'ark_gate',
      type: 'reward',
      title: '方舟舷门',
      position: { x: 0, y: 2 },
      description: '舷门在熵潮中维持最后一道有序边界，为登舰者留下第一枚校准航迹的结晶。',
      reward: { rewardPoints: 285, lingyun: 1, items: { entropy_crystal: 1 } }
    },
    {
      id: 'entropy_deckhand',
      type: 'monster',
      title: '中轴熵舱水手',
      position: { x: 1, y: 2 },
      description: '中轴水手守着主通道，把所有偏离航向的动作拖进持续扩散的失序浪涌。',
      monsterId: 'entropy_deckhand'
    },
    {
      id: 'wake_inversion',
      type: 'reward',
      title: '尾迹倒置仪',
      position: { x: 2, y: 2 },
      description: '事件仪器可以倒置刚刚留下的航迹，让探索者决定回收秩序还是抢航穿过熵潮。',
      reward: { rewardPoints: 240, items: { entropy_crystal: 1, chronal_glass: 1 } }
    },
    {
      id: 'ark_manifest',
      type: 'reward',
      title: '方舟航迹刻印锚',
      position: { x: 3, y: 2 },
      description: '航迹清单既是刻印协议锚点也是事件宿主，可把本轮选择重写为方舟承认的唯一航线。',
      reward: { rewardPoints: 250, lingyun: 1, items: { entropy_crystal: 1, cycle_imprint: 1 } }
    },
    {
      id: 'last_helmsman',
      type: 'monster',
      title: '终末舵手',
      position: { x: 4, y: 2 },
      description: '舵手守着通向热寂的最后航向，把方舟每一层崩解都叠进终末舵轮的反击。',
      monsterId: 'last_helmsman'
    },
    {
      id: 'starboard_pressure_lock',
      type: 'trap',
      title: '右舷压差锁',
      position: { x: 5, y: 2 },
      description: '右舷压力沿舱壁反向坍缩，小界门符可以锚定一段不被压差撕开的通路。',
      trap: { damage: 98, dc: 27, counterItem: 'gate_sigil' }
    },
    {
      id: 'starboard_supply',
      type: 'reward',
      title: '右舷补给舱',
      position: { x: 0, y: 3 },
      description: '右舷补给在热寂前被匆忙封存，药剂和稳定结晶仍保持着可用状态。',
      reward: { rewardPoints: 190, items: { entropy_crystal: 1, healing_pill: 1 } }
    },
    {
      id: 'entropy_deckhand_starboard',
      type: 'monster',
      title: '右舷熵舱水手',
      position: { x: 1, y: 3 },
      description: '右舷水手沿倾斜甲板逆流推进，用缆钩把目标拉回不断扩张的耗散区。',
      monsterId: 'entropy_deckhand'
    },
    {
      id: 'starboard_ballast_core',
      type: 'reward',
      title: '右舷深层压载锚',
      position: { x: 2, y: 3 },
      description: '深层压载核心校正右舷倾角，与左舷锚点共同构成深层协议的双锚航线。',
      reward: { rewardPoints: 235, lingyun: 1, items: { entropy_crystal: 1, cycle_imprint: 1 } }
    },
    {
      id: 'soul_recharge_chamber',
      type: 'trap',
      soulRechargeId: 'soul_node_entropy_recharge',
      title: '器魂稳航室',
      position: { x: 3, y: 3 },
      description: '稳航室抽走装备技能的耗散余热，护甲补片能在器魂重新凝聚时固定外壳。',
      trap: { damage: 94, dc: 26, counterItem: 'armor_patch' }
    },
    {
      id: 'stern_heading_console',
      type: 'reward',
      title: '舰艉航向台',
      position: { x: 4, y: 3 },
      description: '舰艉航向台保存最后一次完整转向记录，读取后可以收束一段扩散尾迹。',
      reward: { rewardPoints: 220, items: { entropy_crystal: 1, dispel_talisman: 1 } }
    },
    {
      id: 'starboard_return_portal',
      type: 'portal',
      title: '右舷回航门',
      position: { x: 5, y: 3 },
      description: '跃迁门沿镜像航迹驶入轮回城的倒影线索库，小界门符能让出口避开相位错位。',
      portal: { targetDungeonId: 'mirror_cycle_city', targetNodeId: 'mirror_clue_vault', stableItem: 'gate_sigil' }
    },
    {
      id: 'starboard_clue_cache',
      type: 'reward',
      equipmentHuntClueId: 'equipment_hunt_entropy_ark',
      title: '右舷线索匣',
      position: { x: 0, y: 4 },
      description: '匣中封存右舷装备的稳定读数，与左舷刻线共同指向同一场方舟装备追猎。',
      reward: { rewardPoints: 205, items: { entropy_crystal: 1 } }
    },
    {
      id: 'dissipation_navigator_omega',
      type: 'monster',
      title: '耗散领航员·右舷',
      position: { x: 1, y: 4 },
      description: '右舷领航员删去所有返航方案，只留下会让方舟更快滑向热寂的航线。',
      monsterId: 'dissipation_navigator'
    },
    {
      id: 'midship_heading_console',
      type: 'reward',
      title: '舰中航向台',
      position: { x: 2, y: 4 },
      description: '舰中航向台汇总双舷锚点的偏差，完成归零后吐出稳定航迹结晶。',
      reward: { rewardPoints: 225, items: { entropy_crystal: 1, armor_patch: 1 } }
    },
    {
      id: 'starboard_relic_hold',
      type: 'reward',
      relicDraftId: 'entropy_ark:starboard:2',
      title: '右舷遗珍舱',
      position: { x: 3, y: 4 },
      description: '遗珍舱收纳已经耗散的选择残片，草案能把其中一种结局重新固定为能力。',
      reward: { rewardPoints: 215, items: { entropy_crystal: 1, cracked_core: 1 } }
    },
    {
      id: 'heat_death_trap',
      type: 'trap',
      title: '热寂封舱阵',
      position: { x: 4, y: 4 },
      description: '封舱阵抽平区域内最后的温差，净化符可以短暂恢复能量流动并打开舱门。',
      trap: { damage: 102, dc: 27, counterItem: 'dispel_talisman' }
    },
    {
      id: 'entropy_ark_exit',
      type: 'exit',
      title: '方舟离航闸',
      position: { x: 5, y: 4 },
      description: '离航闸把双舷压载和终末舵轮重新锁进稳定航迹，结算本轮带出的全部方舟资源。',
      reward: { rewardPoints: 800, lingyun: 6, items: { entropy_crystal: 3, method_page: 1, cracked_core: 1 } }
    }
  ]
};
