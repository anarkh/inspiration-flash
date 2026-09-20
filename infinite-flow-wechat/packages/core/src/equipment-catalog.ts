import type { EquipmentDefinition, EquipmentId } from './game';

/**
 * Authoritative equipment catalog.
 *
 * This module is a runtime leaf: it imports only types from './game', so the
 * Cocos/SystemJS bundle cannot form a game.ts <-> equipment-system.ts runtime
 * cycle through the EQUIPMENT binding. game.ts re-exports EQUIPMENT to keep the
 * public @infinite-flow/core API stable.
 */
export const EQUIPMENT: Record<EquipmentId, EquipmentDefinition> = {
  training_blade: {
    id: 'training_blade',
    name: '训练短刃',
    slot: 'weapon',
    description: '主神免费发放的基础武器。',
    cost: {},
    base: { attack: 4 },
    perLevel: {},
    maxLevel: 1
  },
  patched_headwrap: {
    id: 'patched_headwrap',
    name: '拼缝头巾',
    slot: 'head',
    description: '最基础的头部防护，能挡住飞溅碎片。',
    cost: {},
    base: {},
    perLevel: {},
    maxLevel: 1
  },
  patched_coat: {
    id: 'patched_coat',
    name: '拼缝护衣',
    slot: 'armor',
    description: '勉强能挡住第一波撕咬。',
    cost: {},
    base: { maxHp: 10, defense: 2 },
    perLevel: {},
    maxLevel: 1
  },
  patched_gloves: {
    id: 'patched_gloves',
    name: '拼缝护手',
    slot: 'hands',
    description: '粗布和旧皮缝成的护手，至少能握稳武器。',
    cost: {},
    base: {},
    perLevel: {},
    maxLevel: 1
  },
  patched_boots: {
    id: 'patched_boots',
    name: '拼缝短靴',
    slot: 'feet',
    description: '鞋底贴了薄铁片，跑过碎石地时不至于立刻见血。',
    cost: {},
    base: {},
    perLevel: {},
    maxLevel: 1
  },
  patched_belt: {
    id: 'patched_belt',
    name: '拼缝束带',
    slot: 'waist',
    description: '把补给和护片束在腰间，提供一点稳定承伤。',
    cost: {},
    base: {},
    perLevel: {},
    maxLevel: 1
  },
  plain_charm: {
    id: 'plain_charm',
    name: '空白护符',
    slot: 'charm',
    description: '没有刻纹，但能稳定心神。',
    cost: {},
    base: { artPower: 1 },
    perLevel: {},
    maxLevel: 1
  },
  armor_piercing_sword: {
    id: 'armor_piercing_sword',
    name: '破甲剑',
    slot: 'weapon',
    description: '对厚甲怪和矿壳守卫有额外威慑。',
    cost: { rewardPoints: 260 },
    base: { attack: 9, speed: 1 },
    perLevel: { attack: 4 },
    maxLevel: 3
  },
  bone_spear: {
    id: 'bone_spear',
    name: '白骨长矛',
    slot: 'weapon',
    description: '用妖骨磨成的长兵器，牺牲稳定性换取速度。',
    cost: { rewardPoints: 340, items: { demon_bone: 1 } },
    base: { attack: 8, speed: 4 },
    perLevel: { attack: 3, speed: 1 },
    maxLevel: 3
  },
  ember_staff: {
    id: 'ember_staff',
    name: '灰烬短杖',
    slot: 'weapon',
    description: '药炉灰压进杖芯，强化术法输出。',
    cost: { rewardPoints: 360, items: { medicine_ash: 1 } },
    base: { attack: 4, artPower: 9 },
    perLevel: { artPower: 4 },
    maxLevel: 3
  },
  mist_hood: {
    id: 'mist_hood',
    name: '雾行兜帽',
    slot: 'head',
    description: '兜帽内侧缝着雾后石粉，能提前感到陷阱风向。',
    cost: { rewardPoints: 280 },
    base: { spirit: 1, speed: 1, trapCheck: 3 },
    perLevel: { speed: 1, trapCheck: 2 },
    maxLevel: 3
  },
  spirit_robe: {
    id: 'spirit_robe',
    name: '灵纹软甲',
    slot: 'armor',
    description: '把术法余波导入地面，适合探索陷阱密集的副本。',
    cost: { rewardPoints: 300 },
    base: { maxHp: 18, defense: 3, artPower: 2 },
    perLevel: { maxHp: 8, defense: 2 },
    maxLevel: 3
  },
  guardian_plate: {
    id: 'guardian_plate',
    name: '界卫胸甲',
    slot: 'armor',
    description: '沉重但可靠的胸甲，专门应对中后期高攻击怪物。',
    cost: { rewardPoints: 520, items: { star_iron: 1 } },
    base: { maxHp: 28, defense: 7, speed: -1 },
    perLevel: { maxHp: 10, defense: 3 },
    maxLevel: 3
  },
  guardian_gauntlets: {
    id: 'guardian_gauntlets',
    name: '界卫臂铠',
    slot: 'hands',
    description: '界卫胸甲同源的臂铠，格挡时会把冲击导向地面。',
    cost: { rewardPoints: 420 },
    base: { maxHp: 10, attack: 3, defense: 4 },
    perLevel: { attack: 2, defense: 2 },
    maxLevel: 3
  },
  cloudstep_boots: {
    id: 'cloudstep_boots',
    name: '云隙步靴',
    slot: 'feet',
    description: '鞋跟挂着轻响足铃，帮助你在裂隙边缘抢到先手。',
    cost: { rewardPoints: 380, lingyun: 1 },
    base: { agility: 1, speed: 5, trapCheck: 1 },
    perLevel: { speed: 3, trapCheck: 1 },
    maxLevel: 3
  },
  rift_belt: {
    id: 'rift_belt',
    name: '裂隙束带',
    slot: 'waist',
    description: '束带上的银色粉尘会在传送门附近发热。',
    cost: { rewardPoints: 460, items: { hidden_stone: 1 } },
    base: { spirit: 1, artPower: 3, defense: 2 },
    perLevel: { artPower: 2, defense: 1 },
    maxLevel: 3
  },
  cloudstep_charm: {
    id: 'cloudstep_charm',
    name: '云隙足铃',
    slot: 'charm',
    description: '让撤离和先手更可靠，适合高风险探索。',
    cost: { rewardPoints: 420, lingyun: 1 },
    base: { agility: 1, speed: 5 },
    perLevel: { speed: 3 },
    maxLevel: 3
  },
  rift_charm: {
    id: 'rift_charm',
    name: '裂隙护符',
    slot: 'charm',
    description: '让传送门奖励更稳定。',
    cost: { rewardPoints: 360, items: { hidden_stone: 1 } },
    base: { spirit: 1, artPower: 4 },
    perLevel: { artPower: 3 },
    maxLevel: 3
  },
  starforged_edge: {
    id: 'starforged_edge',
    name: '淬星剑胚',
    slot: 'weapon',
    description: '星坠矿井的目标装备，首版先作为高阶预览。',
    cost: { rewardPoints: 540, items: { star_iron: 1, method_page: 1 } },
    base: { attack: 15, artPower: 4 },
    perLevel: { attack: 5, artPower: 2 },
    maxLevel: 3
  },
  void_lantern: {
    id: 'void_lantern',
    name: '虚界灯',
    slot: 'charm',
    description: '高阶护符，稳定虚空副本中的观察和术法爆发。',
    cost: { rewardPoints: 680, lingyun: 2, items: { cracked_core: 1, rift_dust: 1 } },
    base: { spirit: 2, artPower: 10, defense: 2 },
    perLevel: { artPower: 5, defense: 1 },
    maxLevel: 3
  },
  chronal_edge: {
    id: 'chronal_edge',
    name: '时序刃',
    slot: 'weapon',
    description: '以时序玻璃校准锋线，让斩击同时落在目标的前一瞬与后一瞬。',
    cost: { rewardPoints: 720, lingyun: 2, items: { chronal_glass: 1, star_iron: 1 } },
    base: { attack: 17, artPower: 5 },
    perLevel: { attack: 5, artPower: 2 },
    maxLevel: 3
  },
  chronal_aegis: {
    id: 'chronal_aegis',
    name: '时序盾',
    slot: 'armor',
    description: '把承受的冲击延后分散，在观测庭的高压战斗中维持稳定。',
    cost: { rewardPoints: 700, lingyun: 2, items: { chronal_glass: 1, cracked_core: 1 } },
    base: { maxHp: 32, defense: 8 },
    perLevel: { maxHp: 12, defense: 3 },
    maxLevel: 3
  },
  chronal_lens: {
    id: 'chronal_lens',
    name: '时序透镜',
    slot: 'charm',
    description: '折叠近未来的观测结果，为术法落点提供一瞬先机。',
    cost: { rewardPoints: 760, lingyun: 2, items: { chronal_glass: 1, rift_dust: 1 } },
    base: { spirit: 2, artPower: 12, defense: 3 },
    perLevel: { artPower: 5, defense: 1 },
    maxLevel: 3
  },
  causal_visor: {
    id: 'causal_visor',
    name: '因果视镜',
    slot: 'head',
    description: '入场时冻结被动：本轮首次透支获得收益与治疗，但不会增加因果债务。',
    cost: { rewardPoints: 820, lingyun: 2, items: { causal_seal: 1, chronal_glass: 1 } },
    base: { spirit: 1, defense: 2, trapCheck: 4 },
    perLevel: { artPower: 2, trapCheck: 1 },
    maxLevel: 3
  },
  echo_breaker_gauntlets: {
    id: 'echo_breaker_gauntlets',
    name: '断响拳套',
    slot: 'hands',
    description: '入场时冻结被动：零和审计官锁定债务时少生成一枚追缴印。',
    cost: { rewardPoints: 840, lingyun: 2, items: { causal_seal: 1, rift_dust: 1 } },
    base: { attack: 4, artPower: 4, defense: 3 },
    perLevel: { attack: 2, artPower: 1 },
    maxLevel: 3
  },
  return_anchor_belt: {
    id: 'return_anchor_belt',
    name: '归航锚带',
    slot: 'waist',
    description: '入场时冻结被动：偿还因果债务的生命代价由最大生命 15% 降至 8%。',
    cost: { rewardPoints: 800, lingyun: 2, items: { causal_seal: 1, star_iron: 1 } },
    base: { maxHp: 16, defense: 4, speed: 1 },
    perLevel: { maxHp: 8, defense: 1 },
    maxLevel: 3
  },
  entropy_compass: {
    id: 'entropy_compass',
    name: '熵航罗盘',
    slot: 'charm',
    description: '入场时冻结被动：本局第一次由普通怪物或陷阱首次清理触发的自动升熵免除；玩家主动选择 rush/抢航产生的 +1 熵不免除。',
    cost: { rewardPoints: 920, lingyun: 3, items: { entropy_crystal: 1, chronal_glass: 1 } },
    base: { spirit: 2, artPower: 13, defense: 3 },
    perLevel: { artPower: 5, speed: 1 },
    maxLevel: 3
  },
  dissipation_mantle: {
    id: 'dissipation_mantle',
    name: '耗散披甲',
    slot: 'armor',
    description: '入场时冻结被动：稳航结算时降熵效果更强。',
    cost: { rewardPoints: 900, lingyun: 3, items: { entropy_crystal: 1, rift_dust: 1 } },
    base: { maxHp: 36, artPower: 4, defense: 8 },
    perLevel: { maxHp: 12, artPower: 2, defense: 2 },
    maxLevel: 3
  },
  ark_keel_boots: {
    id: 'ark_keel_boots',
    name: '方舟龙骨靴',
    slot: 'feet',
    description: '入场时冻结被动：Boss 战开始时崩解层数 -1。',
    cost: { rewardPoints: 880, lingyun: 3, items: { entropy_crystal: 1, star_iron: 1 } },
    base: { agility: 1, maxHp: 12, defense: 4, speed: 3 },
    perLevel: { maxHp: 8, defense: 2, speed: 1 },
    maxLevel: 3
  },
  parallax_visor: {
    id: 'parallax_visor',
    name: '视差面甲',
    slot: 'head',
    description: '入场时冻结被动：当前相位的错误伤害类型不再承受 -6% 输出惩罚。',
    cost: { rewardPoints: 980, lingyun: 3, items: { phase_glass: 1, chronal_glass: 1 } },
    base: { spirit: 2, defense: 4, trapCheck: 6 },
    perLevel: { artPower: 3, defense: 1, trapCheck: 2 },
    maxLevel: 3
  },
  phaseweave_mantle: {
    id: 'phaseweave_mantle',
    name: '相织披风',
    slot: 'armor',
    description: '入场时冻结被动：现实与镜像相位切换的生命代价由最大生命 10% 降至 5%。',
    cost: { rewardPoints: 1000, lingyun: 3, items: { phase_glass: 1, rift_dust: 1 } },
    base: { maxHp: 40, artPower: 6, defense: 9 },
    perLevel: { maxHp: 14, artPower: 2, defense: 3 },
    maxLevel: 3
  },
  homecoming_prism: {
    id: 'homecoming_prism',
    name: '归真棱镜',
    slot: 'charm',
    description: '入场时冻结被动：无名镜王生成的镜壳数量减少 1。',
    cost: { rewardPoints: 1020, lingyun: 3, items: { phase_glass: 1, star_iron: 1 } },
    base: { spirit: 2, artPower: 14, defense: 4 },
    perLevel: { artPower: 6, defense: 1 },
    maxLevel: 3
  },
  redline_edge: {
    id: 'redline_edge',
    name: '朱批断章刃',
    slot: 'weapon',
    description: '以朱批切开废稿边界，入场时冻结其与删界条款联动的终稿被动。',
    cost: { rewardPoints: 1100, lingyun: 4, items: { redaction_ink: 1, phase_glass: 1 } },
    base: { attack: 20, artPower: 6 },
    perLevel: { attack: 6, artPower: 2 },
    maxLevel: 3
  },
  palimpsest_mantle: {
    id: 'palimpsest_mantle',
    name: '覆页披甲',
    slot: 'armor',
    description: '多层覆页把承伤记录分散到旧稿，入场时冻结其与删界条款联动的终稿被动。',
    cost: { rewardPoints: 1080, lingyun: 4, items: { redaction_ink: 1, rift_dust: 1 } },
    base: { maxHp: 44, artPower: 7, defense: 10 },
    perLevel: { maxHp: 15, artPower: 2, defense: 3 },
    maxLevel: 3
  },
  final_proof_seal: {
    id: 'final_proof_seal',
    name: '终校印玺',
    slot: 'charm',
    description: '终校印面认证唯一有效版本，入场时冻结其与删界条款联动的终稿被动。',
    cost: { rewardPoints: 1120, lingyun: 4, items: { redaction_ink: 1, star_iron: 1 } },
    base: { spirit: 2, artPower: 16, defense: 5 },
    perLevel: { artPower: 6, defense: 2 },
    maxLevel: 3
  },
  legacy_gavel: {
    id: 'legacy_gavel',
    name: '亡队落槌',
    slot: 'weapon',
    description: '旧队长的落槌仍会替最后一次有效报价定音，入场时冻结其拍卖庭被动。',
    cost: { rewardPoints: 1240, lingyun: 4, items: { legacy_scrip: 1, star_iron: 1 } },
    base: { attack: 22, defense: 4 },
    perLevel: { attack: 6, defense: 2 },
    maxLevel: 3
  },
  anonymous_veil: {
    id: 'anonymous_veil',
    name: '无名竞标面',
    slot: 'head',
    description: '面纱抹去竞标者的旧队身份，入场时冻结其拍卖庭被动。',
    cost: { rewardPoints: 1200, lingyun: 4, items: { legacy_scrip: 1, phase_glass: 1 } },
    base: { spirit: 2, artPower: 12, speed: 2, trapCheck: 5 },
    perLevel: { artPower: 4, speed: 2, trapCheck: 1 },
    maxLevel: 3
  },
  escrow_plate: {
    id: 'escrow_plate',
    name: '托管契甲',
    slot: 'armor',
    description: '契甲把承伤权暂存于无人认领的遗产名下，入场时冻结其拍卖庭被动。',
    cost: { rewardPoints: 1260, lingyun: 4, items: { legacy_scrip: 1, rift_dust: 1 } },
    base: { maxHp: 48, defense: 12, speed: -1 },
    perLevel: { maxHp: 16, defense: 4 },
    maxLevel: 3
  },
  final_lot_bell: {
    id: 'final_lot_bell',
    name: '终场号钟',
    slot: 'charm',
    description: '号钟只为最后一件无人继承的拍品鸣响，入场时冻结其拍卖庭被动。',
    cost: { rewardPoints: 1220, lingyun: 4, items: { legacy_scrip: 1, chronal_glass: 1 } },
    base: { spirit: 2, artPower: 18, speed: 3 },
    perLevel: { artPower: 6, speed: 1 },
    maxLevel: 3
  },
  helix_cleaver: {
    id: 'helix_cleaver',
    name: '螺旋断链斧',
    slot: 'weapon',
    description: '斧刃沿双螺旋弱点展开，以原型血清维持断链锋面。',
    cost: { rewardPoints: 1420, lingyun: 5, items: { genesis_serum: 1, star_iron: 1 } },
    base: { attack: 25, artPower: 5 },
    perLevel: { attack: 7, artPower: 2 },
    maxLevel: 3
  },
  symbiote_cowl: {
    id: 'symbiote_cowl',
    name: '共生冠膜',
    slot: 'head',
    description: '冠膜读取宿主神经脉冲，在危机发生前调整感知与施法节律。',
    cost: { rewardPoints: 1380, lingyun: 5, items: { genesis_serum: 1, phase_glass: 1 } },
    base: { spirit: 3, artPower: 15, speed: 3, trapCheck: 6 },
    perLevel: { artPower: 5, speed: 2, trapCheck: 1 },
    maxLevel: 3
  },
  carapace_harness: {
    id: 'carapace_harness',
    name: '原型甲壳',
    slot: 'armor',
    description: '活性甲片会沿受击方向增生，把裂隙冲击分散到整副外壳。',
    cost: { rewardPoints: 1460, lingyun: 5, items: { genesis_serum: 1, rift_dust: 1 } },
    base: { maxHp: 56, defense: 14 },
    perLevel: { maxHp: 18, defense: 4 },
    maxLevel: 3
  },
  rebirth_amulet: {
    id: 'rebirth_amulet',
    name: '复燃胚核',
    slot: 'charm',
    description: '胚核保存一次尚未定型的生命节律，为术法与防护持续提供复燃余量。',
    cost: { rewardPoints: 1400, lingyun: 5, items: { genesis_serum: 1, chronal_glass: 1 } },
    base: { spirit: 3, artPower: 20, defense: 4 },
    perLevel: { artPower: 7, defense: 2 },
    maxLevel: 3
  },
  hushblade: {
    id: 'hushblade',
    name: '断频长刃',
    slot: 'weapon',
    description: '入场时冻结寂声法则被动：抵消本局首次战斗或陷阱清理的增噪，跨门后仍沿用本局快照。',
    cost: { rewardPoints: 1600, lingyun: 6, items: { silence_core: 1, star_iron: 1 } },
    base: { attack: 28, artPower: 6 },
    perLevel: { attack: 8, artPower: 2 },
    maxLevel: 3
  },
  dead_air_headset: {
    id: 'dead_air_headset',
    name: '死频耳罩',
    slot: 'head',
    description: '入场时冻结寂声法则被动：静默中继额外降低 1 点噪声，跨门后仍沿用本局快照。',
    cost: { rewardPoints: 1540, lingyun: 6, items: { silence_core: 1, phase_glass: 1 } },
    base: { spirit: 3, artPower: 18, speed: 4, trapCheck: 7 },
    perLevel: { artPower: 5, speed: 2, trapCheck: 2 },
    maxLevel: 3
  },
  anechoic_mantle: {
    id: 'anechoic_mantle',
    name: '消声披甲',
    slot: 'armor',
    description: '入场时冻结寂声法则被动：敌方与陷阱的正向噪声惩罚减半，跨门后仍沿用本局快照。',
    cost: { rewardPoints: 1620, lingyun: 6, items: { silence_core: 1, rift_dust: 1 } },
    base: { maxHp: 62, defense: 16 },
    perLevel: { maxHp: 20, defense: 5 },
    maxLevel: 3
  },
  last_channel_beacon: {
    id: 'last_channel_beacon',
    name: '末路断播器',
    slot: 'charm',
    description: '入场时冻结寂声法则被动：首领战锁定的噪声快照降低 1 点，跨门后仍沿用本局快照。',
    cost: { rewardPoints: 1580, lingyun: 6, items: { silence_core: 1, chronal_glass: 1 } },
    base: { spirit: 3, artPower: 23, defense: 5 },
    perLevel: { artPower: 8, defense: 2 },
    maxLevel: 3
  },
  rescue_carbine: {
    id: 'rescue_carbine',
    name: '救援卡宾枪',
    slot: 'weapon',
    description: '入场时冻结失联避难所护送被动：救援火力只读取本轮入场装备快照，跨门后仍沿用该快照。',
    cost: { rewardPoints: 1780, lingyun: 7, items: { rescue_badge: 1, star_iron: 1 } },
    base: { attack: 31, artPower: 7 },
    perLevel: { attack: 9, artPower: 2 },
    maxLevel: 3
  },
  breach_shotgun: {
    id: 'breach_shotgun',
    name: '破门霰弹枪',
    slot: 'weapon',
    description: '星炉专精；为近距突入与压制齐射设计的现代破门武器，专属战技可大幅降低目标防御影响。',
    cost: { rewardPoints: 1820, lingyun: 7, items: { rescue_badge: 1, star_iron: 1 } },
    base: { attack: 35, defense: 2 },
    perLevel: { attack: 10, defense: 1 },
    maxLevel: 3
  },
  triage_visor: {
    id: 'triage_visor',
    name: '分诊目镜',
    slot: 'head',
    description: '入场时冻结失联避难所护送被动：分诊判断只读取本轮入场装备快照，跨门后仍沿用该快照。',
    cost: { rewardPoints: 1720, lingyun: 7, items: { rescue_badge: 1, phase_glass: 1 } },
    base: { spirit: 3, artPower: 21, speed: 4, trapCheck: 8 },
    perLevel: { artPower: 6, speed: 2, trapCheck: 2 },
    maxLevel: 3
  },
  evacuation_plate: {
    id: 'evacuation_plate',
    name: '撤离护甲',
    slot: 'armor',
    description: '入场时冻结失联避难所护送被动：撤离防护只读取本轮入场装备快照，跨门后仍沿用该快照。',
    cost: { rewardPoints: 1800, lingyun: 7, items: { rescue_badge: 1, rift_dust: 1 } },
    base: { maxHp: 70, defense: 18 },
    perLevel: { maxHp: 22, defense: 5 },
    maxLevel: 3
  },
  blackbox_beacon: {
    id: 'blackbox_beacon',
    name: '黑匣信标',
    slot: 'charm',
    description: '入场时冻结失联避难所护送被动：黑匣定位只读取本轮入场装备快照，跨门后仍沿用该快照。',
    cost: { rewardPoints: 1760, lingyun: 7, items: { rescue_badge: 1, chronal_glass: 1 } },
    base: { spirit: 3, artPower: 26, defense: 6 },
    perLevel: { artPower: 9, defense: 2 },
    maxLevel: 3
  },
  cross_examiner_sabre: {
    id: 'cross_examiner_sabre',
    name: '诘问裁刃',
    slot: 'weapon',
    description: 'forge 专精；入场时冻结裁定法则被动，交叉诘问可当场拆穿敌意证人的矛盾，跨门后仍沿用该快照。',
    cost: { rewardPoints: 1960, lingyun: 8, items: { truth_fragment: 1, star_iron: 1 } },
    base: { attack: 34, artPower: 8 },
    perLevel: { attack: 10, artPower: 2 },
    maxLevel: 3
  },
  forensic_visor: {
    id: 'forensic_visor',
    name: '溯证目镜',
    slot: 'head',
    description: 'mist 专精；入场时冻结裁定法则被动，可识别证据污染与删录封签，跨门后仍沿用该快照。',
    cost: { rewardPoints: 1900, lingyun: 8, items: { truth_fragment: 1, phase_glass: 1 } },
    base: { spirit: 4, artPower: 24, speed: 5, trapCheck: 9 },
    perLevel: { artPower: 7, speed: 2, trapCheck: 2 },
    maxLevel: 3
  },
  custody_shell: {
    id: 'custody_shell',
    name: '封证护甲',
    slot: 'armor',
    description: 'rift 专精；入场时冻结裁定法则被动，封存污染证据并压低伪证压力，跨门后仍沿用该快照。',
    cost: { rewardPoints: 1980, lingyun: 8, items: { truth_fragment: 1, rift_dust: 1 } },
    base: { maxHp: 78, defense: 20 },
    perLevel: { maxHp: 24, defense: 6 },
    maxLevel: 3
  },
  appeal_seal: {
    id: 'appeal_seal',
    name: '翻案印玺',
    slot: 'charm',
    description: 'chronal 专精；入场时冻结裁定法则被动，可对一次原始错判发起翻案但不补发原始裁决奖励，跨门后仍沿用该快照。',
    cost: { rewardPoints: 1940, lingyun: 8, items: { truth_fragment: 1, chronal_glass: 1 } },
    base: { spirit: 4, artPower: 29, defense: 7 },
    perLevel: { artPower: 10, defense: 2 },
    maxLevel: 3
  },
  frame_engraver: {
    id: 'frame_engraver',
    name: '定帧刻刀',
    slot: 'weapon',
    description: '将直接动作刻入战斗母带的高阶武器；复演被动按入场装备冻结。',
    cost: { rewardPoints: 2140, lingyun: 9, items: { combat_reel: 1, star_iron: 1 } },
    base: { attack: 37, artPower: 9 },
    perLevel: { attack: 11, artPower: 2 },
    maxLevel: 3
  },
  cue_visor: {
    id: 'cue_visor',
    name: '起拍目镜',
    slot: 'head',
    description: '校准每场第一次实际复演的起拍增幅；复演被动按入场装备冻结。',
    cost: { rewardPoints: 2080, lingyun: 9, items: { combat_reel: 1, phase_glass: 1 } },
    base: { spirit: 4, artPower: 27, speed: 5, trapCheck: 10 },
    perLevel: { artPower: 8, speed: 2, trapCheck: 2 },
    maxLevel: 3
  },
  buffer_plate: {
    id: 'buffer_plate',
    name: '缓冲叠甲',
    slot: 'armor',
    description: '令守势复演生成的缓冲跨越两次反击；复演被动按入场装备冻结。',
    cost: { rewardPoints: 2160, lingyun: 9, items: { combat_reel: 1, rift_dust: 1 } },
    base: { maxHp: 86, defense: 22 },
    perLevel: { maxHp: 26, defense: 6 },
    maxLevel: 3
  },
  thaw_metronome: {
    id: 'thaw_metronome',
    name: '解冻节拍器',
    slot: 'charm',
    description: '首领开战时提前解冻第一段母带；复演被动按入场装备冻结。',
    cost: { rewardPoints: 2120, lingyun: 9, items: { combat_reel: 1, chronal_glass: 1 } },
    base: { spirit: 4, artPower: 32, defense: 8 },
    perLevel: { artPower: 11, defense: 2 },
    maxLevel: 3
  },
  blindline_cutter: {
    id: 'blindline_cutter',
    name: '断视切线刃',
    slot: 'weapon',
    description: '入场时冻结监察城被动；Boss 战按冻结曝光与折光充能提高武力和术法伤害，最高 15%。',
    cost: { rewardPoints: 2260, lingyun: 10, items: { observation_shard: 1, star_iron: 1 } },
    base: { attack: 40, artPower: 10 },
    perLevel: { attack: 12, artPower: 3 },
    maxLevel: 3
  },
  phase_coil_rifle: {
    id: 'phase_coil_rifle',
    name: '相位线圈步枪',
    slot: 'weapon',
    description: '时序专精；以交替相位线圈切换实弹与术式输出，专属战技可贯穿动态护盾并进行攻术合流。',
    cost: { rewardPoints: 2320, lingyun: 10, items: { observation_shard: 1, chronal_glass: 1 } },
    base: { attack: 43, artPower: 12, speed: 2 },
    perLevel: { attack: 13, artPower: 3, speed: 1 },
    maxLevel: 3
  },
  predictive_visor: {
    id: 'predictive_visor',
    name: '先见目镜',
    slot: 'head',
    description: '入场时冻结监察城被动；每个扫描相位第一次曝光各闪避一次，并记录已经使用的保护相位。',
    cost: { rewardPoints: 2200, lingyun: 10, items: { observation_shard: 1, phase_glass: 1 } },
    base: { spirit: 5, artPower: 30, speed: 6, trapCheck: 11 },
    perLevel: { artPower: 9, speed: 2, trapCheck: 2 },
    maxLevel: 3
  },
  matte_shell: {
    id: 'matte_shell',
    name: '消光披甲',
    slot: 'armor',
    description: '入场时冻结监察城被动；所有最终三相扫描伤害再次减半。',
    cost: { rewardPoints: 2280, lingyun: 10, items: { observation_shard: 1, rift_dust: 1 } },
    base: { maxHp: 94, defense: 24 },
    perLevel: { maxHp: 28, defense: 7 },
    maxLevel: 3
  },
  inverse_prism: {
    id: 'inverse_prism',
    name: '逆观棱镜',
    slot: 'charm',
    description: '入场时冻结监察城被动；Boss 快照曝光数减少 1，折光路线额外获得 1 点充能。',
    cost: { rewardPoints: 2240, lingyun: 10, items: { observation_shard: 1, chronal_glass: 1 } },
    base: { spirit: 5, artPower: 35, defense: 9 },
    perLevel: { artPower: 12, defense: 3 },
    maxLevel: 3
  }
};
