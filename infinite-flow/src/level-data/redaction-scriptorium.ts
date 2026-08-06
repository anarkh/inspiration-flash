import type { DungeonDefinition } from '../game';

export const redactionScriptoriumDungeon: DungeonDefinition = {
  id: 'redaction_scriptorium',
  name: '删界终稿院',
  tier: 12,
  genre: 'anomaly',
  recommendedPower: 700,
  theme: '终稿院把现实拆成正文、覆页与删界批注，只有保住可核验的句子，才能带着未被删除的自己离开。',
  recommended: '推荐战力 700、终盘套装、稳定界门补给与足以支付删改代价的生命储备。',
  rewardPreview: '删界墨、终局材料、奖励点 1020-2500',
  grid: { width: 6, height: 5, startNodeId: 'folio_gate' },
  nodes: [
    {
      id: 'memory_survey_archive',
      type: 'reward',
      fieldSurveyId: 'survey_redaction_memory_archive',
      title: '记忆勘校档案',
      position: { x: 0, y: 0 },
      description: '档案保留被删去姓名的笔压与停顿，逐页勘校后仍能还原一段未经改写的记忆。',
      reward: { rewardPoints: 300, items: { redaction_ink: 1 } }
    },
    {
      id: 'north_clue_cache',
      type: 'reward',
      equipmentHuntClueId: 'equipment_hunt_redaction_scriptorium',
      title: '北卷线索匣',
      position: { x: 1, y: 0 },
      description: '匣内的装备批注仍带着原主人的温度，与南卷对读后才能锁定终稿院中的追猎目标。',
      reward: { rewardPoints: 240, items: { redaction_ink: 1 } }
    },
    {
      id: 'erasure_copyist_north',
      type: 'monster',
      title: '北廊删界抄写员',
      position: { x: 2, y: 0 },
      description: '抄写员把重复动作登记成可删除的赘句，第二次出现时便沿原笔迹反向追杀。',
      monsterId: 'erasure_copyist'
    },
    {
      id: 'body_relic_gallery',
      type: 'reward',
      relicDraftId: 'redaction_scriptorium:body:1',
      title: '正文遗珍廊',
      position: { x: 3, y: 0 },
      description: '正文遗珍保存尚未被批注污染的能力草案，取走一页就会让其余版本归入废稿。',
      reward: { rewardPoints: 320, items: { redaction_ink: 1, method_page: 1 } }
    },
    {
      id: 'palimpsest_censor_alpha',
      type: 'monster',
      title: '覆页裁定者·初稿',
      position: { x: 4, y: 0 },
      description: '裁定者在奇偶页之间轮换审稿标准，把落在错误页型上的伤害改写成无效批注。',
      monsterId: 'palimpsest_censor'
    },
    {
      id: 'body_proof_vault',
      type: 'reward',
      title: '正文校样库',
      position: { x: 5, y: 0 },
      description: '校样库封存正文最终核验结果，印泥与轮回刻痕证明这一版现实曾被正式接受。',
      reward: { rewardPoints: 360, lingyun: 1, items: { redaction_ink: 2, cycle_imprint: 1 } }
    },
    {
      id: 'upper_supply_margin',
      type: 'reward',
      title: '上栏补给边注',
      position: { x: 0, y: 1 },
      description: '边注夹层藏着校稿人未领走的应急药剂，墨迹仍能固定一小段完整生命记录。',
      reward: { rewardPoints: 250, items: { redaction_ink: 1, healing_pill: 1 } }
    },
    {
      id: 'body_clause_desk',
      type: 'reward',
      title: '正文条款案',
      position: { x: 1, y: 1 },
      description: '条款案要求探索者为当前正文作出删改裁定，落笔前任何离席都会被视为拒绝终稿。',
      reward: { rewardPoints: 280, items: { redaction_ink: 1 } }
    },
    {
      id: 'severed_sentence_trap',
      type: 'trap',
      title: '断句删截阵',
      position: { x: 2, y: 1 },
      description: '删截阵把动作拆成失去主语的半句，定神香能维持意识直到完整句意重新接合。',
      trap: { damage: 128, dc: 30, counterItem: 'focus_incense' }
    },
    {
      id: 'erasure_copyist_alpha',
      type: 'monster',
      title: '正文删界抄写员',
      position: { x: 3, y: 1 },
      description: '抄写员逐字追踪同类攻势，只要连续落下相同笔画，删界墨便会沿动作反噬。',
      monsterId: 'erasure_copyist'
    },
    {
      id: 'boss_north_lock',
      type: 'trap',
      title: '终审北锁',
      position: { x: 4, y: 1 },
      description: '北锁不断撤回已经生效的通行批文，小界门符可以把一次许可锚定为正式版本。',
      trap: { damage: 136, dc: 31, counterItem: 'gate_sigil' }
    },
    {
      id: 'upper_revision_portal',
      type: 'portal',
      title: '上栏修订门',
      position: { x: 5, y: 1 },
      description: '修订门通向妖塔封存暗格，稳定界门可以避免旅途中的段落顺序再次被改写。',
      portal: { targetDungeonId: 'legacy_auction_court', targetNodeId: 'estate_gate', stableItem: 'gate_sigil' }
    },
    {
      id: 'folio_gate',
      type: 'reward',
      title: '终稿院卷门',
      position: { x: 0, y: 2 },
      description: '卷门为来访者登记唯一正文身份，并发下一滴足以见证后续裁定的删界墨。',
      reward: { rewardPoints: 330, items: { redaction_ink: 1, gate_sigil: 1 } }
    },
    {
      id: 'margin_scribe_spine',
      type: 'monster',
      title: '书脊边注抄写员',
      position: { x: 1, y: 2 },
      description: '书脊抄写员贴着装订线移动，把连续重复的攻击抄进同一条致命边注。',
      monsterId: 'erasure_copyist'
    },
    {
      id: 'memory_clause_desk',
      type: 'reward',
      title: '记忆条款案',
      position: { x: 2, y: 2 },
      description: '条款案要求证明哪一段记忆属于正文，裁定完成前所有离开动作都会保持待决。',
      reward: { rewardPoints: 280, items: { redaction_ink: 1 } }
    },
    {
      id: 'final_proof_nexus',
      type: 'reward',
      title: '终校事件枢纽',
      position: { x: 3, y: 2 },
      description: '枢纽并列呈现互相矛盾的终校记录，选择保留哪一版会决定废稿如何追索正文。',
      reward: { rewardPoints: 380, items: { redaction_ink: 1, cycle_imprint: 1 } }
    },
    {
      id: 'last_redactor',
      type: 'monster',
      title: '终稿删界官',
      position: { x: 4, y: 2 },
      description: '删界官守在唯一终稿前，将每次未获认证的改动写成足以抹除现实的正式裁定。',
      monsterId: 'last_redactor'
    },
    {
      id: 'boss_side_lock',
      type: 'trap',
      title: '终审侧锁',
      position: { x: 5, y: 2 },
      description: '侧锁用多层伪造签章封死退路，破禁符可以烧穿最外层批注并恢复原始门缝。',
      trap: { damage: 140, dc: 32, counterItem: 'dispel_talisman' }
    },
    {
      id: 'lower_supply_margin',
      type: 'reward',
      title: '下栏补给边注',
      position: { x: 0, y: 3 },
      description: '下栏仍保留退稿人留下的净化补给，边缘墨迹可以抵住一次错误版本的侵入。',
      reward: { rewardPoints: 250, items: { redaction_ink: 1, dispel_talisman: 1 } }
    },
    {
      id: 'return_clause_desk',
      type: 'reward',
      title: '归返条款案',
      position: { x: 1, y: 3 },
      description: '条款案审查探索者是否仍与入场正文一致，裁定完成后才允许继续书写归途。',
      reward: { rewardPoints: 280, items: { redaction_ink: 1 } }
    },
    {
      id: 'palimpsest_censor_omega',
      type: 'monster',
      title: '覆页裁定者·终稿',
      position: { x: 2, y: 3 },
      description: '终稿裁定者精确轮换覆页标准，错误类型的攻势会在落笔瞬间被降格为旁注。',
      monsterId: 'palimpsest_censor'
    },
    {
      id: 'errata_event_stage',
      type: 'reward',
      title: '勘误事件台',
      position: { x: 3, y: 3 },
      description: '事件台展示终稿公布后的全部勘误，承认或否认错误都会留下可被追责的版本记录。',
      reward: { rewardPoints: 340, items: { redaction_ink: 1, cracked_core: 1 } }
    },
    {
      id: 'boss_south_lock',
      type: 'trap',
      title: '终审南锁',
      position: { x: 4, y: 3 },
      description: '南锁把每道承压裂缝标成非法修改，护甲补片能固定结构直到校验程序结束。',
      trap: { damage: 136, dc: 31, counterItem: 'armor_patch' }
    },
    {
      id: 'lower_revision_portal',
      type: 'portal',
      title: '下栏修订门',
      position: { x: 5, y: 3 },
      description: '修订门回到妖塔最初的雾鬼遭遇，稳定界门能保住跨页传送时的正文身份。',
      portal: { targetDungeonId: 'legacy_auction_court', targetNodeId: 'lower_bid_supply', stableItem: 'gate_sigil' }
    },
    {
      id: 'return_revision_portal',
      type: 'portal',
      title: '归返修订门',
      position: { x: 0, y: 4 },
      description: '归返门通向妖塔静祷余页，门符可以阻止返程记录被终稿院判定为无效版本。',
      portal: { targetDungeonId: 'legacy_auction_court', targetNodeId: 'archive_survey_gallery', stableItem: 'gate_sigil' }
    },
    {
      id: 'south_clue_cache',
      type: 'reward',
      equipmentHuntClueId: 'equipment_hunt_redaction_scriptorium',
      title: '南卷线索匣',
      position: { x: 1, y: 4 },
      description: '南卷保存装备被退回重写的全部痕迹，与北卷合读后可还原追猎目标的完整经历。',
      reward: { rewardPoints: 240, items: { redaction_ink: 1 } }
    },
    {
      id: 'erasure_copyist_south',
      type: 'monster',
      title: '南廊删界抄写员',
      position: { x: 2, y: 4 },
      description: '南廊抄写员擅长从归返动作中寻找重复句式，并用同一笔反复删去承伤余地。',
      monsterId: 'erasure_copyist'
    },
    {
      id: 'return_relic_gallery',
      type: 'reward',
      relicDraftId: 'redaction_scriptorium:return:2',
      title: '归返遗珍廊',
      position: { x: 3, y: 4 },
      description: '归返遗珍收纳所有被退稿的能力版本，重选一页可以让其中一种可能重新成为正文。',
      reward: { rewardPoints: 320, items: { redaction_ink: 1, cracked_core: 1 } }
    },
    {
      id: 'soul_recharge_scriptorium',
      type: 'trap',
      soulRechargeId: 'soul_node_redaction_rebind',
      title: '器魂重订室',
      position: { x: 4, y: 4 },
      description: '重订室拆开器魂技的旧版装订，护甲补片能让装备在重新成册前保持完整外壳。',
      trap: { damage: 132, dc: 31, counterItem: 'armor_patch' }
    },
    {
      id: 'scriptorium_exit',
      type: 'exit',
      title: '终稿院定版门',
      position: { x: 5, y: 4 },
      description: '定版门将正文、覆页与归返批注装订成唯一现实，结算所有成功带出的终稿资源。',
      reward: {
        rewardPoints: 1020,
        lingyun: 8,
        items: { redaction_ink: 4, method_page: 2, cracked_core: 1, cycle_imprint: 1 }
      }
    }
  ]
};
