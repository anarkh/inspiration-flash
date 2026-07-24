import type { DungeonDefinition } from '../game';

export const rustHospitalDungeon: DungeonDefinition = {
  id: 'rust_hospital',
  name: '锈疫病院',
  tier: 4,
  recommendedPower: 265,
  theme: '废弃病院把治疗流程变成试炼，补给、毒性和精神压力同时考验玩家。',
  recommended: '推荐防御 14 或学会铁衣诀。',
  rewardPreview: '功法残页、裂隙尘、奖励点 320-780',
  grid: { width: 6, height: 5, startNodeId: 'triage_reward' },
  nodes: [
    {
      id: 'triage_reward',
      type: 'reward',
      title: '分诊台遗物',
      position: { x: 0, y: 0 },
      description: '分诊台上压着污染病区的路线牌，病历夹里夹着一支定神香。',
      reward: { rewardPoints: 120, items: { focus_incense: 1 } }
    },
    {
      id: 'medicine_cabinet',
      type: 'reward',
      title: '补给药柜',
      position: { x: 1, y: 0 },
      description: '药柜的玻璃已经发黄，仍有几格补给被护士贴纸标成安全剂量。',
      reward: { rewardPoints: 90, items: { healing_pill: 1 } }
    },
    {
      id: 'plague_orderly',
      type: 'monster',
      title: '锈疫护工',
      position: { x: 2, y: 0 },
      description: '护工推着空病床，床轮在地上碾出锈色血线，逼你先处理污染源。',
      monsterId: 'plague_orderly'
    },
    {
      id: 'rust_gurney_trap',
      type: 'trap',
      title: '翻倒病床',
      position: { x: 3, y: 0 },
      description: '病床突然弹出固定带，锈蚀金属扣像手术钳一样锁向脚踝。',
      trap: { damage: 34, dc: 10, counterItem: 'armor_patch' }
    },
    {
      id: 'isolation_chart_reward',
      type: 'reward',
      equipmentHuntClueId: 'equipment_hunt_rust_hospital',
      title: '隔离病历',
      position: { x: 4, y: 0 },
      description: '病历记录了污染病区的换班时间，能帮你避开最密集的医生巡逻路线。',
      reward: { rewardPoints: 110, items: { medicine_ash: 1 } }
    },
    {
      id: 'elevator_portal',
      type: 'portal',
      title: '下行病床电梯',
      position: { x: 5, y: 0 },
      description: '电梯门打开，病床轨道一路下沉，门后传来灰烬竞技场的欢呼。',
      portal: { targetDungeonId: 'ash_arena', targetNodeId: 'arena_gate', stableItem: 'gate_sigil' }
    },
    {
      id: 'contaminated_ward_reward',
      type: 'reward',
      title: '污染病区补给',
      position: { x: 0, y: 1 },
      description: '病房墙面长满锈斑，床头柜里却还有未开封的消毒符和零钱袋。',
      reward: { rewardPoints: 100, items: { dispel_talisman: 1 } }
    },
    {
      id: 'ward_orderly_patrol',
      type: 'monster',
      title: '巡房护工',
      position: { x: 1, y: 1 },
      description: '护工按病床编号巡逻，听见脚步声就把输液架当长枪平推过来。',
      monsterId: 'plague_orderly'
    },
    {
      id: 'sterile_corridor',
      type: 'trap',
      title: '无菌走廊',
      position: { x: 2, y: 1 },
      description: '消毒灯一盏盏亮起，皮肤像被锈针同时刺穿，定神香能稳住呼吸。',
      trap: { damage: 38, dc: 12, counterItem: 'focus_incense' }
    },
    {
      id: 'disinfectant_mist_trap',
      type: 'trap',
      title: '消毒陷阱',
      position: { x: 3, y: 1 },
      description: '喷头喷出的不是药雾，而是带电的消毒粉尘，越慌越容易吸入锈疫。',
      trap: { damage: 36, dc: 12, counterItem: 'dispel_talisman' }
    },
    {
      id: 'pulse_doctor',
      type: 'monster',
      title: '脉冲医师',
      position: { x: 4, y: 1 },
      description: '医师用心电图读你的灵力波峰，每三回合都会逼你处理一次术法爆发。',
      monsterId: 'pulse_doctor'
    },
    {
      id: 'bed_lift_portal',
      type: 'portal',
      title: '备用病床电梯',
      position: { x: 5, y: 1 },
      description: '备用电梯只运送病床，床垫下压着通往灰烬竞技场入口的界门刻度。',
      portal: { targetDungeonId: 'ash_arena', targetNodeId: 'arena_gate', stableItem: 'gate_sigil' }
    },
    {
      id: 'supply_cabinet_reward',
      type: 'reward',
      fieldSurveyId: 'survey_hospital_emergency_stock',
      title: '急救补给柜',
      position: { x: 0, y: 2 },
      description: '柜门内侧贴着手写警告：先拿补给，再穿过污染病区。',
      reward: { rewardPoints: 95, items: { healing_pill: 1, medicine_ash: 1 } }
    },
    {
      id: 'rusted_iv_trap',
      type: 'trap',
      title: '锈蚀输液阵',
      position: { x: 1, y: 2 },
      description: '输液袋垂成一排，针头会追着灵力热源摆动，像一场低声手术。',
      trap: { damage: 35, dc: 11, counterItem: 'focus_incense' }
    },
    {
      id: 'plague_orderly_rounds',
      type: 'monster',
      title: '夜班护工',
      position: { x: 2, y: 2 },
      description: '夜班护工把病区灯光全部拨暗，靠病床轮声判断你的站位。',
      monsterId: 'plague_orderly'
    },
    {
      id: 'pharmacy_reward',
      type: 'reward',
      title: '药房抽屉',
      position: { x: 3, y: 2 },
      description: '药房抽屉被锈锁卡住，撬开后能拿到净化粉和一枚回声钱。',
      reward: { rewardPoints: 130, items: { medicine_ash: 1, echo_coin: 1 } }
    },
    {
      id: 'doctor_patrol_route',
      type: 'monster',
      title: '巡诊医师',
      position: { x: 4, y: 2 },
      description: '巡诊医师沿固定路线校准脉冲仪，拖得越久，爆发节奏越难打断。',
      monsterId: 'pulse_doctor'
    },
    {
      id: 'telemetry_reward',
      type: 'reward',
      relicDraftId: 'rust_hospital:echo:1',
      title: '心电监测台',
      position: { x: 5, y: 2 },
      description: '监测台还亮着，屏幕把医生巡逻路线折成一张可读的波形图。',
      reward: { rewardPoints: 120, lingyun: 1 }
    },
    {
      id: 'quarantine_cache',
      type: 'reward',
      title: '隔离柜暗格',
      position: { x: 0, y: 3 },
      description: '隔离柜里藏着上一名试炼者的消毒清单和一小包裂隙尘。',
      reward: { rewardPoints: 115, items: { rift_dust: 1 } }
    },
    {
      id: 'pressure_door_trap',
      type: 'trap',
      soulRechargeId: 'soul_node_hospital_negative_pressure',
      title: '负压门廊',
      position: { x: 1, y: 3 },
      description: '负压门忽然合拢，锈疫气流从门缝倒灌，界门符能短暂稳住气压。',
      trap: { damage: 37, dc: 12, counterItem: 'gate_sigil' }
    },
    {
      id: 'pulse_doctor_round',
      type: 'monster',
      title: '会诊医师',
      position: { x: 2, y: 3 },
      description: '会诊医师把几台脉冲仪串联起来，试图用同频震荡逼你交出防御节奏。',
      monsterId: 'pulse_doctor'
    },
    {
      id: 'sterilizer_trap',
      type: 'trap',
      title: '高温灭菌柜',
      position: { x: 3, y: 3 },
      description: '灭菌柜门自动弹开，高温白雾贴地翻滚，防护补丁能挡住第一轮烫伤。',
      trap: { damage: 39, dc: 13, counterItem: 'armor_patch' }
    },
    {
      id: 'antidote_cabinet',
      type: 'reward',
      title: '解毒样本柜',
      position: { x: 4, y: 3 },
      description: '样本柜里有半管解毒剂和消毒记录，足够换来一次喘息。',
      reward: { rewardPoints: 125, items: { focus_incense: 1 } }
    },
    {
      id: 'surgical_theater_reward',
      type: 'reward',
      title: '手术室遗包',
      position: { x: 5, y: 3 },
      description: '无影灯下留着一只遗包，里面的功法页边缘被锈雨烧出孔洞。',
      reward: { rewardPoints: 150, items: { method_page: 1 } }
    },
    {
      id: 'morgue_reward',
      type: 'reward',
      equipmentHuntClueId: 'equipment_hunt_rust_hospital',
      relicDraftId: 'rust_hospital:echo:2',
      title: '停尸柜编号牌',
      position: { x: 0, y: 4 },
      description: '编号牌背面刻着撤离口方向，旁边压着一点仍有温度的灵蕴。',
      reward: { rewardPoints: 110, lingyun: 1 }
    },
    {
      id: 'plague_cart',
      type: 'monster',
      title: '推车护工',
      position: { x: 1, y: 4 },
      description: '护工推着装满废弃器械的车，车轮每转一圈都会甩出锈疫碎屑。',
      monsterId: 'plague_orderly'
    },
    {
      id: 'backup_generator_reward',
      type: 'reward',
      title: '备用发电机',
      position: { x: 2, y: 4 },
      description: '发电机还能供一次电，足够启动通往天台的指示灯。',
      reward: { rewardPoints: 130, items: { gate_sigil: 1 } }
    },
    {
      id: 'roof_access_trap',
      type: 'trap',
      title: '天台消毒闸',
      position: { x: 3, y: 4 },
      description: '通往天台的闸门先喷消毒雾再开锁，净化符能削掉最刺痛的一波。',
      trap: { damage: 40, dc: 13, counterItem: 'dispel_talisman' }
    },
    {
      id: 'chief_pulse_doctor',
      type: 'monster',
      title: '主治脉冲医师',
      position: { x: 4, y: 4 },
      description: '主治医师守在停机坪前，脉冲仪已经调到与心跳同频的危险区间。',
      monsterId: 'pulse_doctor'
    },
    {
      id: 'hospital_exit',
      type: 'exit',
      title: '天台停机坪',
      position: { x: 5, y: 4 },
      description: '停机坪的白光被锈雨打散，你必须顶着污染撤离，把病院奖励带回主神空间。',
      reward: { rewardPoints: 260, lingyun: 1, items: { method_page: 1 } }
    }
  ]
};
