import type { DungeonDefinition } from '../game';

export const panopticonCityDungeon: DungeonDefinition = {
  id: 'panopticon_city',
  name: '天幕监察城',
  tier: 19,
  genre: 'science_fiction',
  recommendedPower: 1350,
  theme: '轨道监察天幕、巡猎无人机与自动机甲以三相扫描覆盖未来城每一条街巷；探索者必须校准三座盲区中继，在被观测的代价中锁定唯一潜入路线。',
  recommended: '推荐战力 1350、完整终盘套装、稳定传送物资，以及能承受多次最大生命比例扫描伤害的恢复储备。',
  rewardPreview: '观测棱片、终局材料、奖励点 2000-4800',
  grid: { width: 6, height: 5, startNodeId: 'panopticon_gate' },
  nodes: [
    {
      id: 'shadow_route', type: 'reward', title: '影路潜行台', position: { x: 0, y: 0 },
      description: '影路潜行台切断后续扫描曝光，但只有三座盲区中继完成并锁定影路后才能进入。',
      reward: { rewardPoints: 560, items: { observation_shard: 1 } }
    },
    {
      id: 'blindline_archive', type: 'reward', relicDraftId: 'panopticon_city:blindline:1', title: '盲线档案库', position: { x: 1, y: 0 },
      description: '档案库保存天幕扫描无法闭合的盲线记录，可将其中一段固化为监察城遗珍草案。',
      reward: { rewardPoints: 570, items: { observation_shard: 1, method_page: 1 } }
    },
    {
      id: 'north_blind_relay', type: 'reward', title: '北部盲区中继', position: { x: 2, y: 0 },
      description: '北部中继向天幕回传一段伪造空白视野，是完成三相盲区闭环的第一处固定锚点。',
      reward: { rewardPoints: 480, items: { observation_shard: 1 } }
    },
    {
      id: 'upper_entry', type: 'reward', title: '上层入场口', position: { x: 3, y: 0 },
      description: '来自复演场上层归返门的队伍在此入场，补给箱保留扫描反制物资与小界门符。',
      reward: { rewardPoints: 450, items: { focus_incense: 1, healing_pill: 1, gate_sigil: 1 } }
    },
    {
      id: 'sweep_sentinel_north', type: 'monster', title: '北廊相位猎杀号', position: { x: 4, y: 0 },
      description: '猎杀号无人机在物理与术法相位盾间逐轮切换，沿北廊追踪无法及时变招的目标。',
      monsterId: 'phase_hunter_drone'
    },
    {
      id: 'upper_return_portal', type: 'portal', title: '上层归返门', position: { x: 5, y: 0 },
      description: '归返门回接妖塔封存暗格，小界门符可以保护观测快照不被跨境扫描重写。',
      portal: { targetDungeonId: 'demon_tower_1', targetNodeId: 'sealed_cache', stableItem: 'gate_sigil' }
    },
    {
      id: 'all_sight_lock', type: 'reward', title: '万目总锁', position: { x: 0, y: 1 },
      description: '总锁汇总三座中继的盲区证明，只有已冻结的潜入路线能够令其中一组目镜闭合。',
      reward: { rewardPoints: 540, items: { observation_shard: 1 } }
    },
    {
      id: 'blindspot_theater', type: 'reward', title: '盲区剧场', position: { x: 1, y: 1 },
      description: '剧场以不断换景制造移动假象，墙后保存着监察城无法确认真伪的完整行动记录。',
      reward: { rewardPoints: 520, lingyun: 1, items: { observation_shard: 1 } }
    },
    {
      id: 'scan_lattice_trap', type: 'trap', title: '扫描晶格阱', position: { x: 2, y: 1 },
      description: '晶格阱在三种相位间高速切换并灼烧被锁定的轮廓，定神香能够短暂稳定视觉边界。',
      trap: { damage: 236, dc: 51, counterItem: 'focus_incense' }
    },
    {
      id: 'central_blind_relay', type: 'reward', title: '中央盲区中继', position: { x: 3, y: 1 },
      description: '中央中继把城市主扫描轴折向虚假街区，是完成三相盲区闭环的第二处固定锚点。',
      reward: { rewardPoints: 490, lingyun: 1, items: { observation_shard: 1 } }
    },
    {
      id: 'blindspot_auditor_north', type: 'monster', title: '北区盲区审计官', position: { x: 4, y: 1 },
      description: '盲区审计官逐格核验移动记录，专门追查扫描日志中突然消失又重新出现的目标。',
      monsterId: 'blindspot_auditor'
    },
    {
      id: 'decoy_route', type: 'reward', title: '替身诱导台', position: { x: 5, y: 1 },
      description: '替身诱导台把曝光改写成可结算的诱饵记录，只有三座中继完成并锁定诱饵路线后才能进入。',
      reward: { rewardPoints: 420, lingyun: 2, items: { observation_shard: 1 } }
    },
    {
      id: 'panopticon_gate', type: 'reward', title: '监察城正门', position: { x: 0, y: 2 },
      description: '正门启动三相扫描并冻结入场装备，三座盲区中继与万目总锁同时亮起。',
      reward: { rewardPoints: 620, items: { focus_incense: 1, dispel_talisman: 1, armor_patch: 1, gate_sigil: 1 } }
    },
    {
      id: 'watchglass_cache', type: 'reward', equipmentHuntClueId: 'equipment_hunt_panopticon_city', title: '监镜秘藏', position: { x: 1, y: 2 },
      description: '秘藏记录断视切线刃第一次切开天幕视锥的轨迹，与消光补给单共同指向完整成品。',
      reward: { rewardPoints: 500, items: { observation_shard: 1, armor_patch: 1 } }
    },
    {
      id: 'exposure_double_patrol', type: 'monster', title: '曝光替身巡逻队', position: { x: 2, y: 2 },
      description: '曝光替身沿正门巡逻，复制最近一次被天幕捕捉的轮廓并反向封死原主人的退路。',
      monsterId: 'exposure_double'
    },
    {
      id: 'south_blind_relay', type: 'reward', title: '南部盲区中继', position: { x: 3, y: 2 },
      description: '南部中继完成最后一段盲区闭环；离开这里之前必须公开锁定影路、诱饵或折光路线。',
      reward: { rewardPoints: 500, items: { observation_shard: 1 } }
    },
    {
      id: 'all_sight_warden', type: 'monster', title: '万目监察者', position: { x: 4, y: 2 },
      description: '万目监察者冻结开战瞬间的路线、曝光与折光快照，把每一次被看见的移动化成终审火力。',
      monsterId: 'all_sight_warden'
    },
    {
      id: 'blind_dawn_exit', type: 'exit', title: '盲晓离城门', position: { x: 5, y: 2 },
      description: '离城门只在万目监察者倒下后开启，将冻结的观测记录与三相路线交还主神空间结算。',
      reward: { rewardPoints: 1950, lingyun: 15, items: { observation_shard: 4, method_page: 2, cycle_imprint: 1 } }
    },
    {
      id: 'lower_entry', type: 'reward', title: '下层入场口', position: { x: 0, y: 3 },
      description: '来自复演场下层归返门的队伍在此入场，消光补给箱留下护甲补片与小界门符。',
      reward: { rewardPoints: 450, items: { armor_patch: 1, healing_pill: 1, gate_sigil: 1 } }
    },
    {
      id: 'matte_supply', type: 'reward', equipmentHuntClueId: 'equipment_hunt_panopticon_city', title: '消光补给站', position: { x: 1, y: 3 },
      description: '补给站保存消光披甲的配发记录，与监镜秘藏中的切线轨迹共同锁定监察装备流转。',
      reward: { rewardPoints: 510, items: { observation_shard: 1, healing_pill: 1 } }
    },
    {
      id: 'blind_angle_trap', type: 'trap', title: '盲角折返阱', position: { x: 2, y: 3 },
      description: '折返阱把盲角出口重新映回扫描中心，破禁符可以切断错误的观察连线。',
      trap: { damage: 244, dc: 52, counterItem: 'dispel_talisman' }
    },
    {
      id: 'refraction_lab', type: 'reward', fieldSurveyId: 'survey_panopticon_refraction_lab', title: '折光实验室', position: { x: 3, y: 3 },
      description: '实验室将曝光压缩成折光充能，墙内保存逆观棱镜对万目快照的最后一次修正。',
      reward: { rewardPoints: 550, lingyun: 2, items: { observation_shard: 1, phase_glass: 1 } }
    },
    {
      id: 'spectrum_switchyard', type: 'reward', title: '光谱换轨场', position: { x: 4, y: 3 },
      description: '换轨场把三相扫描拆入不同街道，为影路、诱饵与折光路线提供正反向通行核验。',
      reward: { rewardPoints: 530, items: { observation_shard: 1 } }
    },
    {
      id: 'lower_return_portal', type: 'portal', title: '下层归返门', position: { x: 5, y: 3 },
      description: '归返门回接妖塔最初的雾鬼遭遇，小界门符能避免曝光编号在跨境时重置。',
      portal: { targetDungeonId: 'demon_tower_1', targetNodeId: 'fog_lesser_demon', stableItem: 'gate_sigil' }
    },
    {
      id: 'inverse_observation_stage', type: 'reward', relicDraftId: 'panopticon_city:inverse:2', title: '逆观演算台', position: { x: 0, y: 4 },
      description: '演算台从观察者视角反推城市盲点，可将一段逆观算法固化为第二份监察城遗珍草案。',
      reward: { rewardPoints: 590, lingyun: 2, items: { observation_shard: 1 } }
    },
    {
      id: 'sweep_sentinel', type: 'monster', title: '光栅扫视哨兵', position: { x: 1, y: 4 },
      description: '光栅哨兵贴地扫过整条南街，把任何与当前扫描相位重合的脚步烧成醒目标记。',
      monsterId: 'sweep_sentinel'
    },
    {
      id: 'refraction_return_portal', type: 'portal', title: '折光归返门', position: { x: 2, y: 4 },
      description: '折光门回接妖塔静祷余页，小界门符能保护未结算充能不被门后目光击穿。',
      portal: { targetDungeonId: 'demon_tower_1', targetNodeId: 'quiet_prayer_reward', stableItem: 'gate_sigil' }
    },
    {
      id: 'soul_recharge_panopticon', type: 'monster', soulRechargeId: 'soul_node_panopticon_recharge', title: '器魂逆观充能台', position: { x: 3, y: 4 },
      description: '充能台被一名盲区审计官接管，只有击退看守并反转观察方向，器魂才能安全续接。',
      monsterId: 'blindspot_auditor'
    },
    {
      id: 'exposure_double', type: 'monster', title: '终端曝光替身', position: { x: 4, y: 4 },
      description: '终端替身携带所有废弃曝光轮廓回场，等待在监察者开眼前取代真正的探索者。',
      monsterId: 'exposure_double'
    },
    {
      id: 'refraction_route', type: 'reward', title: '折光潜入台', position: { x: 5, y: 4 },
      description: '折光潜入台将扫描伤害与充能同时折半处理，只有三座中继完成并锁定折光路线后才能进入。',
      reward: { rewardPoints: 300, lingyun: 1, items: { observation_shard: 2 } }
    }
  ]
};
