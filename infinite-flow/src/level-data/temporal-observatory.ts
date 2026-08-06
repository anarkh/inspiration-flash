import type { DungeonDefinition } from '../game';

export const temporalObservatoryDungeon: DungeonDefinition = {
  id: 'temporal_observatory',
  name: '时序观测庭',
  tier: 8,
  genre: 'science_fiction',
  recommendedPower: 435,
  theme: '过去与未来在零点子午线上互相校准，只有同时稳定两枚时序锚点才能穿过观测庭。',
  recommended: '推荐战力 435、时序套装、虚心诀或稳定的界门补给。',
  rewardPreview: '时序玻璃、终局材料、奖励点 590-1480',
  grid: { width: 6, height: 5, startNodeId: 'temporal_gate' },
  // 按时间切片满铺 6x5 网格，过去、零点与未来三条路线始终相邻可达。
  nodes: [
    {
      id: 'past_clue_cache',
      type: 'reward',
      equipmentHuntClueId: 'equipment_hunt_temporal_observatory',
      title: '旧时线索匣',
      position: { x: 0, y: 0 },
      description: '匣中保存着时序装备的旧版校准记录，玻璃刻痕仍指向观测庭深处。',
      reward: { rewardPoints: 150, items: { chronal_glass: 1 } }
    },
    {
      id: 'epoch_sentinel_alpha',
      type: 'monster',
      title: '纪元哨卫·始',
      position: { x: 1, y: 0 },
      description: '哨卫记录所有已经发生的动作，并用厚重钟摆复演最危险的一次攻击。',
      monsterId: 'epoch_sentinel'
    },
    {
      id: 'past_calibration_anchor',
      type: 'reward',
      title: '过去校准锚',
      position: { x: 2, y: 0 },
      description: '锚点把褪色记录固定在同一刻度，完成校准后，过去时线不再向零点挤压。',
      reward: { rewardPoints: 175, lingyun: 1, items: { cycle_imprint: 1 } }
    },
    {
      id: 'past_relic_archive',
      type: 'reward',
      relicDraftId: 'temporal_observatory:past:1',
      title: '过去遗珍档案',
      position: { x: 3, y: 0 },
      description: '档案将已经失效的路线压成遗珍草案，允许你从旧选择中重新取回一项能力。',
      reward: { rewardPoints: 165, items: { chronal_glass: 1, method_page: 1 } }
    },
    {
      id: 'aged_gear_trap',
      type: 'trap',
      title: '老化齿轮阵',
      position: { x: 4, y: 0 },
      description: '齿轮会把装备磨损提前数年，定神香能让腐朽速度回到正常刻度。',
      trap: { damage: 62, dc: 20, counterItem: 'focus_incense' }
    },
    {
      id: 'past_echo_portal',
      type: 'portal',
      title: '过去回声门',
      position: { x: 5, y: 0 },
      description: '门内回放一份尚未产生结果的清算卷宗，稳定后可抵达因端线索匣。',
      portal: { targetDungeonId: 'causal_clearinghouse', targetNodeId: 'cause_clue_cache', stableItem: 'gate_sigil' }
    },
    {
      id: 'entry_chronometer',
      type: 'reward',
      title: '入庭计时仪',
      position: { x: 0, y: 1 },
      description: '计时仪为本轮探索建立基准时刻，并吐出一枚仍带温度的循环印记。',
      reward: { rewardPoints: 145, items: { cycle_imprint: 1 } }
    },
    {
      id: 'past_shortcut_foyer',
      type: 'reward',
      title: '过去捷径前厅',
      position: { x: 1, y: 1 },
      description: '前厅的脚印全部朝向过去，残留补给能帮助你承受捷径带来的时间落差。',
      reward: { rewardPoints: 135, items: { armor_patch: 1 } }
    },
    {
      id: 'erased_patrol',
      type: 'monster',
      title: '抹除巡逻队',
      position: { x: 2, y: 1 },
      description: '巡逻队每走一圈就从记录里消失一人，却仍保持着完整而精准的围攻节奏。',
      monsterId: 'clockwork_scout'
    },
    {
      id: 'field_observation_deck',
      type: 'reward',
      fieldSurveyId: 'survey_temporal_observatory_deck',
      title: '现场观测台',
      position: { x: 3, y: 1 },
      description: '观测台同时展示两条时间线的资源消耗，调查记录能换来额外的校准材料。',
      reward: { rewardPoints: 170, items: { chronal_glass: 1 } }
    },
    {
      id: 'boss_north_lock',
      type: 'trap',
      title: '零点北锁',
      position: { x: 4, y: 1 },
      description: '北锁把过早抵达的动作冻结在门前，小界门符能够重新对齐锁芯的刻度。',
      trap: { damage: 66, dc: 21, counterItem: 'gate_sigil' }
    },
    {
      id: 'past_portal_cache',
      type: 'reward',
      title: '旧门稳定匣',
      position: { x: 5, y: 1 },
      description: '匣内备用界门符专供过去回声门使用，边角还凝结着一片时序玻璃。',
      reward: { rewardPoints: 140, items: { gate_sigil: 1, chronal_glass: 1 } }
    },
    {
      id: 'temporal_gate',
      type: 'reward',
      title: '时序庭门',
      position: { x: 0, y: 2 },
      description: '庭门在过去与未来之间保持静止，入场刻度为探索者留下第一份校准材料。',
      reward: { rewardPoints: 220, lingyun: 1, items: { chronal_glass: 1 } }
    },
    {
      id: 'clockwork_scout',
      type: 'monster',
      title: '发条侦察兵',
      position: { x: 1, y: 2 },
      description: '侦察兵沿零点子午线往返巡查，任何迟疑都会被它换算成额外行动。',
      monsterId: 'clockwork_scout'
    },
    {
      id: 'zero_meridian',
      type: 'trap',
      title: '零点子午线',
      position: { x: 2, y: 2 },
      description: '跨越子午线时，两个时间切片会同时拉扯身体，定神香可以固定当前感知。',
      trap: { damage: 64, dc: 20, counterItem: 'focus_incense' }
    },
    {
      id: 'calibration_bridge',
      type: 'reward',
      title: '双时校准桥',
      position: { x: 3, y: 2 },
      description: '桥面刻度连接两枚校准锚，留下足够材料供探索者修正装备的时间偏差。',
      reward: { rewardPoints: 175, items: { chronal_glass: 1, armor_patch: 1 } }
    },
    {
      id: 'zero_hour_regent',
      type: 'monster',
      title: '零时摄政',
      position: { x: 4, y: 2 },
      description: '摄政者占据所有时间线的零点，轮流调用过去经验与未来预判压制挑战者。',
      monsterId: 'zero_hour_regent'
    },
    {
      id: 'east_time_lock',
      type: 'trap',
      title: '东侧时锁',
      position: { x: 5, y: 2 },
      description: '时锁不断将东侧走廊重置到开启前，只有界门锚点能保留已经完成的动作。',
      trap: { damage: 68, dc: 21, counterItem: 'gate_sigil' }
    },
    {
      id: 'future_supply',
      type: 'reward',
      title: '未来补给箱',
      position: { x: 0, y: 3 },
      description: '补给箱提前送达了尚未领取的物资，玻璃标签注明它们必须在本轮使用。',
      reward: { rewardPoints: 150, items: { chronal_glass: 1, healing_pill: 1 } }
    },
    {
      id: 'future_shortcut_foyer',
      type: 'reward',
      title: '未来捷径前厅',
      position: { x: 1, y: 3 },
      description: '前厅预演了捷径尽头的战斗，一张雷火符被留在最可能取胜的路线旁。',
      reward: { rewardPoints: 135, items: { thunder_talisman: 1 } }
    },
    {
      id: 'accelerated_patrol',
      type: 'monster',
      title: '加速巡逻队',
      position: { x: 2, y: 3 },
      description: '巡逻发条被拧到极限，侦察兵会把下一秒的动作提前压进当前回合。',
      monsterId: 'clockwork_scout'
    },
    {
      id: 'soul_recharge_chamber',
      type: 'trap',
      soulRechargeId: 'soul_node_temporal_recharge',
      title: '器魂回刻室',
      position: { x: 3, y: 3 },
      description: '回刻室会抽走装备刚刚经历的战斗片段，护甲补片能稳住共鸣时的裂纹。',
      trap: { damage: 66, dc: 21, counterItem: 'armor_patch' }
    },
    {
      id: 'boss_south_lock',
      type: 'trap',
      title: '零点南锁',
      position: { x: 4, y: 3 },
      description: '南锁把未来可能的失败提前投射到脚下，净化符能够擦除错误预演。',
      trap: { damage: 66, dc: 21, counterItem: 'dispel_talisman' }
    },
    {
      id: 'future_echo_portal',
      type: 'portal',
      title: '未来回声门',
      position: { x: 5, y: 3 },
      description: '门内展示一份已经生效的清算卷宗，稳定后可抵达果端线索匣。',
      portal: { targetDungeonId: 'causal_clearinghouse', targetNodeId: 'effect_clue_cache', stableItem: 'gate_sigil' }
    },
    {
      id: 'future_clue_cache',
      type: 'reward',
      equipmentHuntClueId: 'equipment_hunt_temporal_observatory',
      title: '未来线索匣',
      position: { x: 0, y: 4 },
      description: '匣中图纸标注了时序装备尚未完成的形态，与过去线索指向同一场追猎。',
      reward: { rewardPoints: 150, items: { chronal_glass: 1 } }
    },
    {
      id: 'epoch_sentinel_omega',
      type: 'monster',
      title: '纪元哨卫·终',
      position: { x: 1, y: 4 },
      description: '终末哨卫计算所有尚未发生的动作，再用最可能命中的一击封住退路。',
      monsterId: 'epoch_sentinel'
    },
    {
      id: 'future_calibration_anchor',
      type: 'reward',
      title: '未来校准锚',
      position: { x: 2, y: 4 },
      description: '锚点收束不断分叉的未来记录，完成校准后，预测不再干扰当前行动。',
      reward: { rewardPoints: 175, lingyun: 1, items: { cycle_imprint: 1 } }
    },
    {
      id: 'future_relic_archive',
      type: 'reward',
      relicDraftId: 'temporal_observatory:future:2',
      title: '未来遗珍档案',
      position: { x: 3, y: 4 },
      description: '档案记录尚未成形的遗珍分支，选择其中一页就会让其余可能性自动褪色。',
      reward: { rewardPoints: 165, items: { chronal_glass: 1, cracked_core: 1 } }
    },
    {
      id: 'unborn_gear_trap',
      type: 'trap',
      title: '未生齿轮阵',
      position: { x: 4, y: 4 },
      description: '尚未铸造的齿轮从未来咬住装备接缝，净化符能取消这次错误装配。',
      trap: { damage: 70, dc: 22, counterItem: 'dispel_talisman' }
    },
    {
      id: 'observatory_exit',
      type: 'exit',
      title: '观测庭归刻台',
      position: { x: 5, y: 4 },
      description: '归刻台将过去与未来重新写回同一条时间线，并结算本轮带出的全部观测成果。',
      reward: { rewardPoints: 620, lingyun: 4, items: { chronal_glass: 3, cracked_core: 1, method_page: 1 } }
    }
  ]
};
