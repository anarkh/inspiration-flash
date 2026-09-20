import type { DungeonDefinition } from '../game';

export const genesisVaultDungeon: DungeonDefinition = {
  id: 'genesis_vault',
  name: '众生原型库',
  tier: 14,
  genre: 'science_fiction',
  recommendedPower: 860,
  theme: '原型库保存众生尚未分化的生命蓝本，探索者必须用本轮血清完成三次基因拼接，才能面对掌管全部原型的典藏官。',
  recommended: '推荐战力 860、满级终盘装备、稳定界门补给，以及足以应对适应性甲壳和原型觉醒的续航能力。',
  rewardPreview: '原型血清、终局材料、奖励点 1320-3200',
  grid: { width: 6, height: 5, startNodeId: 'genesis_gate' },
  nodes: [
    {
      id: 'force_gene_vault', type: 'reward', title: '武力基因库', position: { x: 0, y: 0 },
      description: '库内封存高密度肌纤维与爆发神经原型，可供正面强攻路线完成最后一次定型。',
      reward: { rewardPoints: 520, lingyun: 2, items: { genesis_serum: 1, star_iron: 1 } }
    },
    {
      id: 'force_sample_gallery', type: 'reward', relicDraftId: 'genesis_vault:force:1', title: '武力样本廊', position: { x: 1, y: 0 },
      description: '历代强攻原型被切成仍有活性的薄片，选取一份遗珍草案便会封存其余样本。',
      reward: { rewardPoints: 390, items: { genesis_serum: 1 } }
    },
    {
      id: 'north_serum_cache', type: 'reward', equipmentHuntClueId: 'equipment_hunt_genesis_vault', title: '北侧血清匣', position: { x: 2, y: 0 },
      description: '北侧匣记录终盘装备第一次原型培育的失败读数，与南侧记录合并可追踪成品。',
      reward: { rewardPoints: 340, items: { genesis_serum: 1 } }
    },
    {
      id: 'gene_stalker_north', type: 'monster', title: '北廊基因猎犬', position: { x: 3, y: 0 },
      description: '猎犬沿重复的战斗表达追踪入侵者，连续使用同类攻势会让它迅速完成适应。', monsterId: 'gene_stalker'
    },
    {
      id: 'mutation_guardian_north', type: 'monster', title: '北库变异守库体', position: { x: 4, y: 0 },
      description: '守库体交替增生武力与术法甲壳，错误的攻击节律只会替它补全防护原型。', monsterId: 'mutation_guardian'
    },
    {
      id: 'art_gene_vault', type: 'reward', title: '术法基因库', position: { x: 5, y: 0 },
      description: '灵识腺体与术式回路悬浮在培养液中，为高阶施法者保存尚未固化的原型结构。',
      reward: { rewardPoints: 510, lingyun: 2, items: { genesis_serum: 1, phase_glass: 1 } }
    },
    {
      id: 'bloodline_survey_archive', type: 'reward', fieldSurveyId: 'survey_genesis_bloodline_archive', title: '血统调查档案', position: { x: 0, y: 1 },
      description: '档案逐层比对泰坦、虚空、壁垒与凤凰血统的稳定片段，可据此还原原型库的分化路径。',
      reward: { rewardPoints: 360, items: { genesis_serum: 1 } }
    },
    {
      id: 'first_splice_console', type: 'reward', title: '第一拼接台', position: { x: 1, y: 1 },
      description: '第一座控制台等待注入本轮取得的原型血清，选择会写入典藏官读取的基因序列。',
      reward: { rewardPoints: 320, items: { genesis_serum: 1 } }
    },
    {
      id: 'helix_collapse_trap', type: 'trap', title: '螺旋坍缩阱', position: { x: 2, y: 1 },
      description: '失稳双螺旋沿走廊反复折叠，破禁符可以切断维持坍缩的标记酶回路。',
      trap: { damage: 158, dc: 36, counterItem: 'dispel_talisman' }
    },
    {
      id: 'gene_stalker_alpha', type: 'monster', title: '首代基因猎犬', position: { x: 3, y: 1 },
      description: '首代猎犬保留完整学习能力，会把连续重复的攻势标成最易捕获的遗传特征。', monsterId: 'gene_stalker'
    },
    {
      id: 'second_splice_console', type: 'reward', title: '第二拼接台', position: { x: 4, y: 1 },
      description: '第二座控制台校验前一段序列并要求继续定型，血清不足时不会写入任何残缺选择。',
      reward: { rewardPoints: 340, items: { genesis_serum: 1 } }
    },
    {
      id: 'upper_genesis_portal', type: 'portal', title: '上层返生门', position: { x: 5, y: 1 },
      description: '返生门连接妖塔封存暗格，小界门符能让本局原型记录在跨境时保持稳定。',
      portal: { targetDungeonId: 'silent_broadcast_tower', targetNodeId: 'north_entry', stableItem: 'gate_sigil' }
    },
    {
      id: 'genesis_gate', type: 'reward', title: '原型库正门', position: { x: 0, y: 2 },
      description: '正门冻结入场装备与血统快照，并发放完成本轮三次拼接所需的第一批活性介质。',
      reward: { rewardPoints: 420, items: { genesis_serum: 2, gate_sigil: 1 } }
    },
    {
      id: 'sample_corridor_guard', type: 'trap', title: '样本廊防护阵', position: { x: 1, y: 2 },
      description: '高压培养液横扫样本走廊，护甲补片可以固定外层密封并分散冲击。',
      trap: { damage: 160, dc: 37, counterItem: 'armor_patch' }
    },
    {
      id: 'mosaic_gene_vault', type: 'reward', title: '嵌合基因库', position: { x: 2, y: 2 },
      description: '数百条物种原型在培养池中短暂嵌合，选择稳定片段可换取血清与稀有终盘材料。',
      reward: { rewardPoints: 450, lingyun: 2, items: { genesis_serum: 1, cracked_core: 1 } }
    },
    {
      id: 'primal_curator', type: 'monster', title: '原型典藏官', position: { x: 3, y: 2 },
      description: '典藏官读取入场血统与三段拼接序列，把本轮留下的全部生命选择压入觉醒形态。', monsterId: 'primal_curator'
    },
    {
      id: 'boss_side_lock', type: 'trap', title: '典藏侧锁', position: { x: 4, y: 2 },
      description: '侧锁以灵识扫描强行剥离外来组织，定神香能维持自我边界直到扫描结束。',
      trap: { damage: 166, dc: 38, counterItem: 'focus_incense' }
    },
    {
      id: 'genesis_exit', type: 'exit', title: '原型库归档门', position: { x: 5, y: 2 },
      description: '归档门封存本轮拼接与典藏官战斗记录，并把成功带出的活性原型交还主神空间。',
      reward: { rewardPoints: 1320, lingyun: 10, items: { genesis_serum: 4, method_page: 2, cracked_core: 1, cycle_imprint: 1 } }
    },
    {
      id: 'lower_serum_supply', type: 'reward', title: '下层血清补给', position: { x: 0, y: 3 },
      description: '低温补给柜保存一份活性血清与止血丹，可让从拍卖庭转入的探索者迅速整备。',
      reward: { rewardPoints: 300, items: { genesis_serum: 1, healing_pill: 1 } }
    },
    {
      id: 'third_splice_console', type: 'reward', title: '第三拼接台', position: { x: 1, y: 3 },
      description: '最后一座控制台将三段选择闭合为完整序列，确认前仍允许探索者处理其他副本事务。',
      reward: { rewardPoints: 360, items: { genesis_serum: 1 } }
    },
    {
      id: 'mutation_guardian_omega', type: 'monster', title: '终代变异守库体', position: { x: 2, y: 3 },
      description: '终代守库体能按回合切换成熟甲壳，只有反向轮换伤害类型才能持续穿透。', monsterId: 'mutation_guardian'
    },
    {
      id: 'lineage_event_stage', type: 'reward', title: '谱系演化台', position: { x: 3, y: 3 },
      description: '演化台投映四条血统从原型到成熟的分支，观测结果会改变本轮资源取舍。',
      reward: { rewardPoints: 400, lingyun: 1, items: { genesis_serum: 1, method_page: 1 } }
    },
    {
      id: 'genome_repair_station', type: 'reward', title: '基因修复站', position: { x: 4, y: 3 },
      description: '修复站剔除坍缩片段并补齐稳定序列，留下可供后续拼接使用的纯化血清。',
      reward: { rewardPoints: 330, items: { genesis_serum: 1, healing_pill: 1 } }
    },
    {
      id: 'lower_genesis_portal', type: 'portal', title: '下层返生门', position: { x: 5, y: 3 },
      description: '返生门落向妖塔最初的雾鬼遭遇，小界门符能稳定携带本局冻结的原型记录。',
      portal: { targetDungeonId: 'silent_broadcast_tower', targetNodeId: 'lower_entry', stableItem: 'gate_sigil' }
    },
    {
      id: 'guard_gene_vault', type: 'reward', title: '守御基因库', position: { x: 0, y: 4 },
      description: '厚壁细胞与缓冲骨架在库中持续增生，为终盘承伤方案提供最稳定的防御原型。',
      reward: { rewardPoints: 530, lingyun: 2, items: { genesis_serum: 1, rift_dust: 1 } }
    },
    {
      id: 'guard_relic_gallery', type: 'reward', relicDraftId: 'genesis_vault:guard:2', title: '守御遗珍廊', position: { x: 1, y: 4 },
      description: '防护原型被保存为可替换草案，取走其中一份便会令其余增生结构进入休眠。',
      reward: { rewardPoints: 390, items: { genesis_serum: 1 } }
    },
    {
      id: 'return_genesis_portal', type: 'portal', title: '归返原型门', position: { x: 2, y: 4 },
      description: '归返门连接妖塔静祷余页，小界门符能防止拼接序列在跨境时发生自发突变。',
      portal: { targetDungeonId: 'silent_broadcast_tower', targetNodeId: 'broadcast_gate', stableItem: 'gate_sigil' }
    },
    {
      id: 'south_serum_cache', type: 'reward', equipmentHuntClueId: 'equipment_hunt_genesis_vault', title: '南侧血清匣', position: { x: 3, y: 4 },
      description: '南侧匣保存终盘装备的成熟读数，与北侧线索共同指向四件完成定型的装备。',
      reward: { rewardPoints: 340, items: { genesis_serum: 1 } }
    },
    {
      id: 'soul_recharge_genesis', type: 'trap', soulRechargeId: 'soul_node_genesis_recharge', title: '器魂复育槽', position: { x: 4, y: 4 },
      description: '复育槽以活性介质重置器魂疲劳，护甲补片能在重组期间保护装备外壳。',
      trap: { damage: 162, dc: 37, counterItem: 'armor_patch' }
    },
    {
      id: 'renewal_gene_vault', type: 'reward', title: '复生基因库', position: { x: 5, y: 4 },
      description: '再生腺体与时序胚核维持着未熄灭的生命脉冲，为恢复路线提供完整复生原型。',
      reward: { rewardPoints: 500, lingyun: 2, items: { genesis_serum: 1, chronal_glass: 1 } }
    }
  ]
};
