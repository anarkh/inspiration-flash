import type { DungeonDefinition } from '../game';

export const metroAbyssDungeon: DungeonDefinition = {
  id: 'metro_abyss',
  name: '镜潮地铁',
  tier: 2,
  recommendedPower: 185,
  theme: '退潮后的废站台映出另一个玩家，倒影会复制错误选择。',
  recommended: '建议学会吐纳诀，或至少有一件升级装备。',
  rewardPreview: '镜潮贝、裂隙尘、奖励点 210-520',
  grid: { width: 6, height: 5, startNodeId: 'platform_arrival' },
  nodes: [
    {
      id: 'lampbox_reward',
      type: 'reward',
      relicDraftId: 'metro_abyss:echo:1',
      title: '灯箱奖励',
      position: { x: 0, y: 0 },
      description: '坏掉的广告灯箱反复闪出补给清单，伸手时能摸到被潮气泡软的奖励点券。',
      reward: { rewardPoints: 35, items: { echo_coin: 1 } }
    },
    {
      id: 'reflection_fork',
      type: 'trap',
      title: '倒影岔路',
      position: { x: 1, y: 0 },
      description: '两条通道在水面里交叉，倒影会诱导你踏进反向站台，必须闭眼数步才能穿过。',
      trap: { damage: 24, dc: 9, counterItem: 'dispel_talisman' }
    },
    {
      id: 'rail_patrol_wraith',
      type: 'monster',
      title: '轨道巡逻',
      position: { x: 2, y: 0 },
      description: '断轨怨影沿着废线巡逻，车灯每扫过一次，它就从另一截铁轨上重新现身。',
      monsterId: 'rail_wraith'
    },
    {
      id: 'coin_turnstile',
      type: 'reward',
      equipmentHuntClueId: 'equipment_hunt_metro_abyss',
      title: '投币闸机',
      position: { x: 3, y: 0 },
      description: '闸机吞下旧车票后吐出回声硬币，像是在替上一位试炼者退还押金。',
      reward: { rewardPoints: 45, items: { echo_coin: 1 } }
    },
    {
      id: 'north_floodgate_trap',
      type: 'trap',
      title: '北闸潮水',
      position: { x: 4, y: 0 },
      description: '闸门忽然抬起，冰冷潮水从扶梯口倒灌下来，把脚步声全部推回身后。',
      trap: { damage: 26, dc: 10, counterItem: 'dispel_talisman' }
    },
    {
      id: 'signal_cache',
      type: 'reward',
      title: '信号箱暗格',
      position: { x: 5, y: 0 },
      description: '信号箱里夹着裂隙尘，红绿灯乱跳，却没有再召来新的列车。',
      reward: { rewardPoints: 40, items: { rift_dust: 1 } }
    },
    {
      id: 'platform_arrival',
      type: 'reward',
      title: '潮湿站台',
      position: { x: 0, y: 1 },
      description: '你从石门跌入站台。广告灯箱里浮着上一批试炼者留下的路线记号。',
      reward: { rewardPoints: 80, items: { mirror_shell: 1 } }
    },
    {
      id: 'tide_boatman',
      type: 'monster',
      title: '潮影船夫',
      position: { x: 1, y: 1 },
      description: '无脸船夫撑着破篙，影子比身体先一步压来，逼你在潮声里抢先出手。',
      monsterId: 'tide_boatman'
    },
    {
      id: 'mirror_tide_trap',
      type: 'trap',
      title: '镜面潮汐',
      position: { x: 2, y: 1 },
      description: '黑水倒映出另一个你，这是站台中央最危险的潮水陷阱，越盯着看越难分清方向。',
      trap: { damage: 28, dc: 9, counterItem: 'dispel_talisman' }
    },
    {
      id: 'rail_portal',
      type: 'portal',
      title: '逆行列车门',
      position: { x: 3, y: 1 },
      description: '列车门打开，门内是重力错乱的矿井轨道，车厢广播倒着报出下一站。',
      portal: { targetDungeonId: 'starfall_mine', targetNodeId: 'mine_arrival', stableItem: 'gate_sigil' }
    },
    {
      id: 'spare_train_portal',
      type: 'portal',
      title: '备用列车门',
      position: { x: 4, y: 1 },
      description: '检修门后的备用车厢没有座位，只有一条通往星坠矿井升降台的稳定裂缝。',
      portal: { targetDungeonId: 'starfall_mine', targetNodeId: 'mine_arrival', stableItem: 'gate_sigil' }
    },
    {
      id: 'wet_ticket_hall',
      type: 'reward',
      title: '湿票售票厅',
      position: { x: 5, y: 1 },
      description: '售票窗口里漂着空白车票，票面一擦就露出小界门符的残印。',
      reward: { rewardPoints: 30, items: { gate_sigil: 1 } }
    },
    {
      id: 'drainage_cache',
      type: 'reward',
      title: '排水渠补给',
      position: { x: 0, y: 2 },
      description: '排水渠里卡着密封药盒，潮水退下时刚好露出一枚还没泡坏的丹丸。',
      reward: { rewardPoints: 25, items: { healing_pill: 1 } }
    },
    {
      id: 'boatman_echo',
      type: 'monster',
      title: '撑篙回声',
      position: { x: 1, y: 2 },
      description: '船夫的回声从排水井里爬出，每一次挥篙都比本体慢半拍，却更难判断距离。',
      monsterId: 'tide_boatman'
    },
    {
      id: 'mirror_thread_spider',
      type: 'monster',
      title: '镜丝织蛛',
      position: { x: 2, y: 2 },
      description: '蛛丝吊住倒影，命中后会拖慢行动节奏，适合用位移或爆发抢先清掉。',
      monsterId: 'mirror_thread_spider'
    },
    {
      id: 'metro_exit',
      type: 'exit',
      title: '归航灯塔',
      position: { x: 3, y: 2 },
      description: '灯塔亮起时，所有倒影同时转头看你，选错光源会回到站台入口。',
      reward: { rewardPoints: 180, lingyun: 1, items: { rift_dust: 1 } }
    },
    {
      id: 'flooded_escalator_trap',
      type: 'trap',
      title: '倒灌扶梯',
      position: { x: 4, y: 2 },
      description: '扶梯逆向运转，潮水在台阶间咬住脚踝，越急着冲刺越容易被拖回低处。',
      trap: { damage: 30, dc: 10, counterItem: 'gate_sigil' }
    },
    {
      id: 'gate_sigil_kiosk',
      type: 'reward',
      title: '便民亭符盒',
      position: { x: 5, y: 2 },
      description: '便民亭被海盐封住，撬开后能找到给列车门校准坐标的小界门符。',
      reward: { rewardPoints: 35, items: { gate_sigil: 1 } }
    },
    {
      id: 'lampbox_supply',
      type: 'reward',
      title: '残亮灯箱',
      position: { x: 0, y: 3 },
      description: '灯箱里还剩半截光管，照亮下方的镜潮贝，也照出墙面上新的安全箭头。',
      reward: { rewardPoints: 55, items: { mirror_shell: 1 } }
    },
    {
      id: 'rail_wraith',
      type: 'monster',
      soulRechargeId: 'soul_node_metro_third_rail',
      title: '断轨怨影',
      position: { x: 1, y: 3 },
      description: '怨影贴着第三轨滑行，只有车轮声靠近时，才能看清它空洞的脸。',
      monsterId: 'rail_wraith'
    },
    {
      id: 'mirror_web_cache',
      type: 'reward',
      title: '镜网夹层',
      position: { x: 2, y: 3 },
      description: '织蛛留下的镜网裹着干燥布包，里面的驱邪符还能撕开倒影雾气。',
      reward: { rewardPoints: 45, items: { dispel_talisman: 1 } }
    },
    {
      id: 'thread_snare_trap',
      type: 'trap',
      title: '镜丝绊线',
      position: { x: 3, y: 3 },
      description: '细丝贴着膝盖高度横过通道，一旦触发，倒影会先替你走出错误的一步。',
      trap: { damage: 32, dc: 11, counterItem: 'dispel_talisman' }
    },
    {
      id: 'tide_boatman_reflection',
      type: 'monster',
      title: '船夫倒影',
      position: { x: 4, y: 3 },
      description: '倒影船夫没有船，只把站台水面当作河道，篙尖专门挑开防守空隙。',
      monsterId: 'tide_boatman'
    },
    {
      id: 'lost_locker_reward',
      type: 'reward',
      fieldSurveyId: 'survey_metro_lost_property',
      title: '失物柜',
      position: { x: 5, y: 3 },
      description: '失物柜编号全是反的，打开正确那格后，主神空间把遗失物折成奖励点。',
      reward: { rewardPoints: 60, items: { mirror_shell: 1 } }
    },
    {
      id: 'maintenance_ladder',
      type: 'reward',
      equipmentHuntClueId: 'equipment_hunt_metro_abyss',
      title: '检修梯平台',
      position: { x: 0, y: 4 },
      description: '检修梯上刻着短路线索，沿着水痕爬上去能避开一段怨影巡逻。',
      reward: { rewardPoints: 35, lingyun: 1 }
    },
    {
      id: 'echo_coin_vendor',
      type: 'reward',
      title: '回声贩卖机',
      position: { x: 1, y: 4 },
      description: '贩卖机只收回声硬币，按钮按下后滚出一张写着未来站名的旧票。',
      reward: { rewardPoints: 40, items: { echo_coin: 1 } }
    },
    {
      id: 'rail_wraith_relay',
      type: 'monster',
      title: '怨影接力',
      position: { x: 2, y: 4 },
      description: '两段断轨之间传来接力般的尖啸，怨影趁灯灭的瞬间换到你背后。',
      monsterId: 'rail_wraith'
    },
    {
      id: 'tideline_first_aid',
      type: 'reward',
      title: '潮线急救箱',
      position: { x: 3, y: 4 },
      description: '急救箱被固定在最高水位线上，里面的护甲贴片还带着防潮油味。',
      reward: { rewardPoints: 25, items: { armor_patch: 1 } }
    },
    {
      id: 'mirror_shell_nest',
      type: 'reward',
      title: '镜贝巢',
      position: { x: 4, y: 4 },
      description: '镜潮贝挤在轨枕下面，壳面映着矿井星光，像在提醒你下一层的方向。',
      reward: {
        rewardPoints: 70,
        items: { mirror_shell: 1 },
        methodBonus: {
          methodId: 'gate_sense',
          text: '观门法让你分辨出哪枚镜贝曾经贴近稳定门缝。',
          reward: { rewardPoints: 60, items: { rift_dust: 1 } }
        }
      }
    },
    {
      id: 'lighthouse_supply',
      type: 'reward',
      relicDraftId: 'metro_abyss:echo:2',
      title: '灯塔前补给',
      position: { x: 5, y: 4 },
      description: '归航灯塔前堆着被潮水送来的箱子，像是给不急着撤离的人最后一点胆量。',
      reward: { rewardPoints: 50, items: { capture_net: 1 } }
    }
  ]
};
