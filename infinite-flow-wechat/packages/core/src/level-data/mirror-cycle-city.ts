import type { DungeonDefinition } from '../game';

export const mirrorCycleCityDungeon: DungeonDefinition = {
  id: 'mirror_cycle_city',
  name: '镜海轮回城',
  tier: 11,
  genre: 'anomaly',
  recommendedPower: 630,
  theme: '镜海把整座城折成现实与镜像两层，探索者必须三次校准相位、辨认真伪锚点，才能直面无名镜王。',
  recommended: '推荐战力 630、相位防护、充足的界门补给与能交替输出武力和术法的完整配装。',
  rewardPreview: '相位镜晶、终章材料、奖励点 840-2280',
  grid: { width: 6, height: 5, startNodeId: 'cycle_gate' },
  nodes: [
    {
      id: 'real_clue_vault',
      type: 'reward',
      equipmentHuntClueId: 'equipment_hunt_mirror_cycle_city',
      title: '现实线索库',
      position: { x: 0, y: 0 },
      description: '现实侧卷宗保留三件相位装备的初始登记，镜晶刻痕指向尚未被倒影改写的追猎路径。',
      reward: { rewardPoints: 230, items: { phase_glass: 1 } }
    },
    {
      id: 'parallax_hunter_real',
      type: 'monster',
      title: '现实侧视差猎手',
      position: { x: 1, y: 0 },
      description: '猎手同时瞄准身体与倒影，任何迟疑都会让两条射线在现实侧交汇。',
      monsterId: 'parallax_hunter'
    },
    {
      id: 'first_phase_mirror',
      type: 'reward',
      title: '第一相位镜',
      position: { x: 2, y: 0 },
      description: '第一面轮回镜要求在离开前选定现实或镜像，相位一经落定便重写之后的伤害倾向。',
      reward: { rewardPoints: 250, items: { phase_glass: 1 } }
    },
    {
      id: 'real_relic_gallery',
      type: 'reward',
      relicDraftId: 'mirror_cycle_city:real:1',
      title: '现实遗珍廊',
      position: { x: 3, y: 0 },
      description: '陈列廊封存未被镜海复制的遗珍原型，选定草案后，其余可能会沉入倒影。',
      reward: { rewardPoints: 240, items: { phase_glass: 1, method_page: 1 } }
    },
    {
      id: 'shard_rain_trap',
      type: 'trap',
      title: '镜晶骤雨阵',
      position: { x: 4, y: 0 },
      description: '破碎楼面把镜晶倒悬成雨，护甲补片可以封住第一轮贯穿防线的裂口。',
      trap: { damage: 106, dc: 28, counterItem: 'armor_patch' }
    },
    {
      id: 'upper_return_portal',
      type: 'portal',
      title: '上层终稿门',
      position: { x: 5, y: 0 },
      description: '上层界门沿真实刻痕进入删界终稿院卷门，小界门符能避免正文身份被镜海复制。',
      portal: { targetDungeonId: 'redaction_scriptorium', targetNodeId: 'folio_gate', stableItem: 'gate_sigil' }
    },
    {
      id: 'real_supply_alcove',
      type: 'reward',
      title: '现实补给凹室',
      position: { x: 0, y: 1 },
      description: '未被倒影碰触的补给箱仍保持原始封条，药丸与镜晶都能直接投入后续探索。',
      reward: { rewardPoints: 210, items: { phase_glass: 1, healing_pill: 1 } }
    },
    {
      id: 'mirror_chorus_real',
      type: 'monster',
      title: '现实侧镜群合唱者',
      position: { x: 1, y: 1 },
      description: '合唱者用重叠声线把现实命令唱成镜像回声，持续作战会让判断逐渐错位。',
      monsterId: 'mirror_chorus'
    },
    {
      id: 'real_anchor',
      type: 'reward',
      title: '现实相位锚',
      position: { x: 2, y: 1 },
      description: '相位锚只承认处于现实层的触碰，正确校准会为镜王战固定一条真实坐标。',
      reward: { rewardPoints: 270, lingyun: 1, items: { phase_glass: 1, cycle_imprint: 1 } }
    },
    {
      id: 'mirror_city_survey',
      type: 'reward',
      fieldSurveyId: 'survey_mirror_city_parallax',
      title: '镜城视差测绘台',
      position: { x: 3, y: 1 },
      description: '测绘台对照两层街区的偏移量，完整调查能从重叠坐标中筛出稳定镜晶。',
      reward: { rewardPoints: 260, items: { phase_glass: 1 } }
    },
    {
      id: 'parallax_corridor_trap',
      type: 'trap',
      title: '视差回廊',
      position: { x: 4, y: 1 },
      description: '回廊让落脚点比目测位置偏移半步，定神香可以锁住身体而非倒影的方向感。',
      trap: { damage: 110, dc: 28, counterItem: 'focus_incense' }
    },
    {
      id: 'mirror_chorus_upper',
      type: 'monster',
      title: '上层镜群合唱者',
      position: { x: 5, y: 1 },
      description: '上层合唱者借归塔门放大回声，让每一次错误应答都变成围攻的起拍。',
      monsterId: 'mirror_chorus'
    },
    {
      id: 'cycle_gate',
      type: 'reward',
      title: '轮回城门',
      position: { x: 0, y: 2 },
      description: '城门把来者投在现实与镜像的交界线上，第一枚相位镜晶仍保留进入前的温度。',
      reward: { rewardPoints: 320, lingyun: 1, items: { phase_glass: 1 } }
    },
    {
      id: 'parallax_hunter_spine',
      type: 'monster',
      title: '中轴视差猎手',
      position: { x: 1, y: 2 },
      description: '猎手占据轮回中轴，射击会沿现实与镜像之间最短的错位距离追踪目标。',
      monsterId: 'parallax_hunter'
    },
    {
      id: 'second_phase_mirror',
      type: 'reward',
      title: '第二相位镜',
      position: { x: 2, y: 2 },
      description: '第二面轮回镜再次要求明确选择相位，未作答时整条中轴都会拒绝继续通行。',
      reward: { rewardPoints: 275, items: { phase_glass: 1, focus_incense: 1 } }
    },
    {
      id: 'cycle_manifest',
      type: 'reward',
      title: '轮回名册',
      position: { x: 3, y: 2 },
      description: '无面队列逐页经过名册，留下可被追认的身份空位与一段尚未闭合的轮回记录。',
      reward: { rewardPoints: 285, lingyun: 1, items: { phase_glass: 1, cycle_imprint: 1 } }
    },
    {
      id: 'nameless_reflection',
      type: 'monster',
      title: '无名镜王',
      position: { x: 4, y: 2 },
      description: '镜王用被遗忘的姓名铸成外壳，在现实与镜像之间持续重写自己受到的伤害。',
      monsterId: 'nameless_reflection'
    },
    {
      id: 'boss_side_trap',
      type: 'trap',
      title: '镜王侧殿折光阵',
      position: { x: 5, y: 2 },
      description: '侧殿把镜王余光折成贯穿射线，小界门符可以把其中一束导向已经闭合的坐标。',
      trap: { damage: 116, dc: 29, counterItem: 'gate_sigil' }
    },
    {
      id: 'mirror_supply_alcove',
      type: 'reward',
      title: '镜像补给凹室',
      position: { x: 0, y: 3 },
      description: '倒影补给箱会复制取走物品的轮廓，但只有镜晶与药丸能够离开凹室。',
      reward: { rewardPoints: 210, items: { phase_glass: 1, healing_pill: 1 } }
    },
    {
      id: 'mirror_chorus_mirror',
      type: 'monster',
      title: '镜像侧镜群合唱者',
      position: { x: 1, y: 3 },
      description: '镜像合唱者先唱出攻击的回声，再逼迫现实中的动作追上已经发生的结果。',
      monsterId: 'mirror_chorus'
    },
    {
      id: 'mirror_anchor',
      type: 'reward',
      title: '镜像相位锚',
      position: { x: 2, y: 3 },
      description: '相位锚只承认处于镜像层的触碰，正确校准会为镜王战固定一条倒影坐标。',
      reward: { rewardPoints: 270, lingyun: 1, items: { phase_glass: 1, cycle_imprint: 1 } }
    },
    {
      id: 'soul_recharge_mirror',
      type: 'monster',
      soulRechargeId: 'soul_node_mirror_recharge',
      title: '器魂复调镜像',
      position: { x: 3, y: 3 },
      description: '失控镜像攫取器魂技能的残响，击破它后可以选择让一件已耗尽的装备重新共鸣。',
      monsterId: 'mirror_chorus'
    },
    {
      id: 'third_phase_mirror',
      type: 'reward',
      title: '第三相位镜',
      position: { x: 4, y: 3 },
      description: '第三面轮回镜给出镜王战前最后一次相位选择，答案必须在迈步前彻底落定。',
      reward: { rewardPoints: 300, items: { phase_glass: 1, armor_patch: 1 } }
    },
    {
      id: 'lower_return_portal',
      type: 'portal',
      title: '下层终稿门',
      position: { x: 5, y: 3 },
      description: '下层界门沿归返批注进入终稿院下栏补给，小界门符能让出口避开镜像重叠。',
      portal: { targetDungeonId: 'redaction_scriptorium', targetNodeId: 'lower_supply_margin', stableItem: 'gate_sigil' }
    },
    {
      id: 'mirror_clue_vault',
      type: 'reward',
      equipmentHuntClueId: 'equipment_hunt_mirror_cycle_city',
      title: '镜像线索库',
      position: { x: 0, y: 4 },
      description: '镜像卷宗保留装备经历过的所有错误版本，与现实刻痕合读后才能锁定真正猎物。',
      reward: { rewardPoints: 230, items: { phase_glass: 1 } }
    },
    {
      id: 'parallax_hunter_mirror',
      type: 'monster',
      title: '镜像侧视差猎手',
      position: { x: 1, y: 4 },
      description: '镜像猎手把真实弹道藏在倒影之后，只有主动改变节奏才能避开两次命中。',
      monsterId: 'parallax_hunter'
    },
    {
      id: 'reflection_event_stage',
      type: 'reward',
      title: '身份排演台',
      position: { x: 2, y: 4 },
      description: '舞台反复排演探索者归来后的身份，接受或撕毁剧本都会留下可结算的真实代价。',
      reward: { rewardPoints: 290, items: { phase_glass: 1, hidden_stone: 1 } }
    },
    {
      id: 'mirror_relic_gallery',
      type: 'reward',
      relicDraftId: 'mirror_cycle_city:mirror:2',
      title: '镜像遗珍廊',
      position: { x: 3, y: 4 },
      description: '倒影遗珍保存所有被放弃的能力草案，取走一份便会让对应现实永远沉默。',
      reward: { rewardPoints: 240, items: { phase_glass: 1, cracked_core: 1 } }
    },
    {
      id: 'identity_fracture_trap',
      type: 'trap',
      title: '身份碎裂阵',
      position: { x: 4, y: 4 },
      description: '碎裂阵把姓名拆成互不承认的倒影，净化符可以烧掉最先反咬本体的伪名。',
      trap: { damage: 122, dc: 29, counterItem: 'dispel_talisman' }
    },
    {
      id: 'mirror_cycle_exit',
      type: 'exit',
      title: '轮回城归真门',
      position: { x: 5, y: 4 },
      description: '归真门把三次相位选择、双锚坐标与镜王残片压回唯一现实，结算终章带出的全部资源。',
      reward: {
        rewardPoints: 920,
        lingyun: 7,
        items: { phase_glass: 4, method_page: 2, cracked_core: 1, cycle_imprint: 1 }
      }
    }
  ]
};
