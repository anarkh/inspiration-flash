import type { DungeonDefinition } from '../game';

export const demonTowerDungeon: DungeonDefinition = {
  id: 'demon_tower_1',
  name: '妖塔一层',
  tier: 1,
  recommendedPower: 150,
  theme: '妖雾封住石阶，塔内每一层都在测试准备是否足够。',
  recommended: '入门副本，无硬门槛。',
  rewardPreview: '妖骨、雾后石、奖励点 160-370',
  grid: { width: 6, height: 5, startNodeId: 'fog_lesser_demon' },
  nodes: [
    {
      id: 'watch_post_cache',
      type: 'reward',
      relicDraftId: 'demon_tower_1:echo:1',
      title: '巡哨布袋',
      position: { x: 0, y: 0 },
      description: '北侧岔路挂着旧布袋，里面是前一批试炼者没来得及带走的药灰。',
      reward: { rewardPoints: 70, items: { medicine_ash: 1 } }
    },
    {
      id: 'upper_fog_patrol',
      type: 'monster',
      soulRechargeId: 'soul_node_demon_mist_watch',
      title: '巡雾小卒',
      position: { x: 1, y: 0 },
      description: '妖鬼沿着上层回廊巡逻，脚步声忽远忽近，适合先手清掉再摸资源点。',
      monsterId: 'fog_lesser_demon'
    },
    {
      id: 'loose_tile_trap',
      type: 'trap',
      title: '松动石砖',
      position: { x: 2, y: 0 },
      description: '石砖下埋着倒钩，贪走上路捷径会换来一次硬吃的穿刺。',
      trap: { damage: 18, dc: 7, counterItem: 'dispel_talisman' }
    },
    {
      id: 'north_supply_niche',
      type: 'reward',
      title: '北墙补给龛',
      position: { x: 3, y: 0 },
      description: '墙龛里压着干净布条和一枚驱邪残符，是绕开主路陷阱后的补偿。',
      reward: { rewardPoints: 80, items: { dispel_talisman: 1 } }
    },
    {
      id: 'butcher_turn',
      type: 'monster',
      title: '剔骨转角',
      position: { x: 4, y: 0 },
      description: '剔骨塔卒守在转角，铁钩拖地的声音提醒你这里不是纯资源线。',
      monsterId: 'tower_butcher'
    },
    {
      id: 'side_gate_portal',
      type: 'portal',
      title: '偏门石环',
      position: { x: 5, y: 0 },
      description: '石环通向下一层潮湿站台，是避开主门后仍能推进的备用传送门。',
      portal: { targetDungeonId: 'metro_abyss', targetNodeId: 'platform_arrival', stableItem: 'gate_sigil' }
    },
    {
      id: 'broken_sigil_reward',
      type: 'reward',
      equipmentHuntClueId: 'equipment_hunt_demon_tower_1',
      title: '断符石盘',
      position: { x: 0, y: 1 },
      description: '石盘裂成两半，符灰还带热，可以换成一点可用的雷火符引线。',
      reward: { rewardPoints: 75, items: { thunder_talisman: 1 } }
    },
    {
      id: 'left_watch_trap',
      type: 'trap',
      title: '窥视符眼',
      position: { x: 1, y: 1 },
      description: '岔路墙缝睁开血色符眼，盯得越久越容易被雾气拖慢判断。',
      trap: { damage: 20, dc: 7, counterItem: 'dispel_talisman' }
    },
    {
      id: 'fog_patrol_pair',
      type: 'monster',
      title: '双影巡逻',
      position: { x: 2, y: 1 },
      description: '两只雾中妖鬼轮流探路，给主路制造压力，也保护着后方资源点。',
      monsterId: 'fog_lesser_demon'
    },
    {
      id: 'mist_herb_cache',
      type: 'reward',
      title: '雾草木匣',
      position: { x: 3, y: 1 },
      description: '木匣被潮雾泡软，里面的疗伤丹还能用，适合在进门前补给。',
      reward: { rewardPoints: 85, items: { healing_pill: 1 } }
    },
    {
      id: 'bone_lane_monster',
      type: 'monster',
      title: '骨巷塔卒',
      position: { x: 4, y: 1 },
      description: '塔卒在骨巷来回巡查，逼你在快速推进和多拿战利品之间取舍。',
      monsterId: 'tower_butcher'
    },
    {
      id: 'unstable_floor_trap',
      type: 'trap',
      title: '下陷塔砖',
      position: { x: 5, y: 1 },
      description: '靠近偏门的塔砖已经空心，脚步太急会被整排石阶吞下半身。',
      trap: { damage: 22, dc: 8, counterItem: 'gate_sigil' }
    },
    // Keep this smoke-critical route adjacent: start -> trap -> portal -> cache -> exit.
    {
      id: 'fog_lesser_demon',
      type: 'monster',
      title: '雾中妖鬼',
      position: { x: 0, y: 2 },
      description: '雾里有东西贴着地面爬行，爪尖在石阶上刮出细响。',
      monsterId: 'fog_lesser_demon'
    },
    {
      id: 'blood_rune_trap',
      type: 'trap',
      title: '血字阶梯',
      position: { x: 1, y: 2 },
      description: '阶梯上反复浮出同一句血字：后来者以血开门。',
      trap: { damage: 24, dc: 7, counterItem: 'dispel_talisman' }
    },
    {
      id: 'cracked_portal',
      type: 'portal',
      title: '裂缝石门',
      position: { x: 2, y: 2 },
      description: '石门背后不是塔，而是潮湿的站台灯光，风里带着列车刹车声。',
      portal: { targetDungeonId: 'metro_abyss', targetNodeId: 'platform_arrival', stableItem: 'gate_sigil' }
    },
    {
      id: 'sealed_cache',
      type: 'reward',
      title: '雾后暗格',
      position: { x: 3, y: 2 },
      description: '暗格被雾压住。呼吸一乱，石缝就会重新合拢。',
      reward: {
        rewardPoints: 120,
        items: { medicine_ash: 1 },
        methodBonus: {
          methodId: 'mist_breathing',
          text: '吐纳诀让你看清暗格后方还有一块阵石。',
          reward: { rewardPoints: 120, lingyun: 1, items: { hidden_stone: 1 } }
        }
      }
    },
    {
      id: 'tower_exit',
      type: 'exit',
      title: '白光裂口',
      position: { x: 4, y: 2 },
      description: '主神空间的白光从裂口灌进塔内，等待你带着战利品撤离。',
      reward: { rewardPoints: 140, lingyun: 1 }
    },
    {
      id: 'evac_supply_cache',
      type: 'reward',
      title: '裂口补给',
      position: { x: 5, y: 2 },
      description: '白光边缘堆着几枚尚未烧尽的界门符，可为下一层站台留一手。',
      reward: { rewardPoints: 90, items: { gate_sigil: 1 } }
    },
    {
      id: 'ash_pit_trap',
      type: 'trap',
      title: '灰坑回声',
      position: { x: 0, y: 3 },
      description: '灰坑里回响着自己的脚步，走错节奏会被热灰扑进护甲缝。',
      trap: { damage: 19, dc: 7, counterItem: 'armor_patch' }
    },
    {
      id: 'demon_bone_cache',
      type: 'reward',
      fieldSurveyId: 'survey_demon_bone_marrow',
      title: '妖骨堆',
      position: { x: 1, y: 3 },
      description: '骨堆散着腥甜气味，翻找会拖慢路线，但能补上一份强化素材。',
      reward: { rewardPoints: 95, items: { demon_bone: 1 } }
    },
    {
      id: 'lower_fog_lesser',
      type: 'monster',
      title: '伏雾妖鬼',
      position: { x: 2, y: 3 },
      description: '这只妖鬼伏在下层台阶，等你从主门回头时扑出截断退路。',
      monsterId: 'fog_lesser_demon'
    },
    {
      id: 'sealed_side_cache',
      type: 'reward',
      title: '侧墙暗匣',
      position: { x: 3, y: 3 },
      description: '侧墙暗匣藏在回头路上，适合风险承受高的玩家顺手开走。',
      reward: { rewardPoints: 100, items: { hidden_stone: 1 } }
    },
    {
      id: 'blood_pool_trap',
      type: 'trap',
      title: '血池倒影',
      position: { x: 4, y: 3 },
      description: '血池映出下一层站台的光，越想确认路线，越容易被倒影割伤。',
      trap: { damage: 23, dc: 8, counterItem: 'dispel_talisman' }
    },
    {
      id: 'last_blessing_reward',
      type: 'reward',
      title: '撤离香火',
      position: { x: 5, y: 3 },
      description: '靠近撤离点的小香炉还亮着，拿走香灰能让下一场战斗更稳。',
      reward: { rewardPoints: 90, items: { focus_incense: 1 } }
    },
    {
      id: 'fallen_pack_reward',
      type: 'reward',
      equipmentHuntClueId: 'equipment_hunt_demon_tower_1',
      title: '坠落行囊',
      position: { x: 0, y: 4 },
      description: '行囊从高处摔裂，里面有捕兽网和一点零钱，明显是给绕路者的奖励。',
      reward: { rewardPoints: 85, items: { capture_net: 1 } }
    },
    {
      id: 'tower_butcher_patrol',
      type: 'monster',
      title: '剔骨巡卒',
      position: { x: 1, y: 4 },
      description: '剔骨塔卒按固定路线巡逻，击败它能清出下层安全通道。',
      monsterId: 'tower_butcher'
    },
    {
      id: 'risky_font_trap',
      type: 'trap',
      title: '咒水井',
      position: { x: 2, y: 4 },
      description: '井口浮着黑水，想抄近路就要承受一次不确定的咒水反噬。',
      trap: { damage: 21, dc: 8, counterItem: 'dispel_talisman' }
    },
    {
      id: 'hidden_stone_cache',
      type: 'reward',
      relicDraftId: 'demon_tower_1:echo:2',
      title: '阵石暗袋',
      position: { x: 3, y: 4 },
      description: '暗袋缝在破旗背面，里面的雾后石正好能解释塔内阵路。',
      reward: { rewardPoints: 110, items: { hidden_stone: 1 } }
    },
    {
      id: 'gate_sigil_cache',
      type: 'reward',
      title: '石门备用符',
      position: { x: 4, y: 4 },
      description: '备用符压在碎砖下，说明这座塔本就允许谨慎者多带一条退路。',
      reward: { rewardPoints: 105, items: { gate_sigil: 1 } }
    },
    {
      id: 'quiet_prayer_reward',
      type: 'reward',
      title: '静默香案',
      position: { x: 5, y: 4 },
      description: '香案没有供奉神像，只留下适合诱捕妖鬼的灵饵和一点灵蕴。',
      reward: { rewardPoints: 95, lingyun: 1, items: { spirit_bait: 1 } }
    }
  ]
};
