import type { DungeonDefinition } from '../game';

export const legacyAuctionCourtDungeon: DungeonDefinition = {
  id: 'legacy_auction_court',
  name: '亡队遗产拍卖庭',
  tier: 13,
  genre: 'modern',
  recommendedPower: 780,
  theme: '无人归还的队伍遗产在此重新估价，竞标者必须用本轮筹码证明自己有资格继承亡者留下的力量。',
  recommended: '推荐战力 780、满级终盘装备、稳定界门补给，以及能承受连续竞价反噬的生命储备。',
  rewardPreview: '遗产筹码、终局材料、奖励点 1180-2800',
  grid: { width: 6, height: 5, startNodeId: 'estate_gate' },
  nodes: [
    {
      id: 'force_claim_vault', type: 'reward', title: '武力认领库', position: { x: 0, y: 0 },
      description: '旧队前锋的认领凭证仍压在重锁之下，只有活着抵达的人能继承它的正面强攻。',
      reward: { rewardPoints: 480, lingyun: 2, items: { legacy_scrip: 1, star_iron: 1 } }
    },
    {
      id: 'force_relic_gallery', type: 'reward', relicDraftId: 'legacy_auction_court:force:1', title: '武力遗珍廊', position: { x: 1, y: 0 },
      description: '遗珍廊陈列着亡队未能带回的强攻方案，每次取样都会封存其余竞标版本。',
      reward: { rewardPoints: 360, items: { legacy_scrip: 1 } }
    },
    {
      id: 'north_scrip_cache', type: 'reward', equipmentHuntClueId: 'equipment_hunt_legacy_auction_court', title: '北侧筹码匣', position: { x: 2, y: 0 },
      description: '北侧筹码记录了遗产装备第一次流拍的原因，与南侧记录合并后才能追索原主。',
      reward: { rewardPoints: 280, items: { legacy_scrip: 1 } }
    },
    {
      id: 'reserve_bailiff_north', type: 'monster', title: '北席底价执役', position: { x: 3, y: 0 },
      description: '执役把第一击登记为保留价，任何更低的后续报价都会被折价并招来反拍。', monsterId: 'reserve_bailiff'
    },
    {
      id: 'inheritance_mimic_north', type: 'monster', title: '北席遗产拟形体', position: { x: 4, y: 0 },
      description: '拟形体嗅探战斗道具的来源，并把那段使用记录复制成一次性的防护外壳。', monsterId: 'inheritance_mimic'
    },
    {
      id: 'guard_claim_vault', type: 'reward', title: '守势认领库', position: { x: 5, y: 0 },
      description: '旧队守卫把最后一面未碎的盾牌托管于此，库门只承认完成清算的幸存者。',
      reward: { rewardPoints: 460, lingyun: 1, items: { legacy_scrip: 1, rift_dust: 1 } }
    },
    {
      id: 'archive_survey_gallery', type: 'reward', fieldSurveyId: 'survey_legacy_auction_archive', title: '遗产勘验档案', position: { x: 0, y: 1 },
      description: '档案保存每件遗物的磨损、血迹与最后持有人，可据此重建亡队撤离前的真实队形。',
      reward: { rewardPoints: 320, items: { legacy_scrip: 1 } }
    },
    {
      id: 'force_lot_dais', type: 'reward', title: '武力拍品台', position: { x: 1, y: 1 },
      description: '拍品台要求为亡队的正面攻势出价、焚契或弃权，选择落定前不得离席。',
      reward: { rewardPoints: 300, items: { legacy_scrip: 1 } }
    },
    {
      id: 'hammerfall_trap', type: 'trap', title: '落槌追价阵', position: { x: 2, y: 1 },
      description: '巨槌沿上一位竞标者的报价轨迹砸落，破禁符可以烧断追价铭文。',
      trap: { damage: 148, dc: 33, counterItem: 'dispel_talisman' }
    },
    {
      id: 'inheritance_mimic_alpha', type: 'monster', title: '首轮遗产拟形体', position: { x: 3, y: 1 },
      description: '这团遗产残影专门复制药丹与符箓的流转凭据，并用凭据抵消下一次直接攻势。', monsterId: 'inheritance_mimic'
    },
    {
      id: 'guard_lot_dais', type: 'reward', title: '守势拍品台', position: { x: 4, y: 1 },
      description: '拍品台托管亡队最后一次掩护行动，竞标结果会被写入本轮终场清算。',
      reward: { rewardPoints: 300, items: { legacy_scrip: 1 } }
    },
    {
      id: 'upper_auction_portal', type: 'portal', title: '上席回拍门', position: { x: 5, y: 1 },
      description: '回拍门通向众生原型库正门，稳定门符能让拍卖记录随竞标者完整过境。',
      portal: { targetDungeonId: 'genesis_vault', targetNodeId: 'genesis_gate', stableItem: 'gate_sigil' }
    },
    {
      id: 'estate_gate', type: 'reward', title: '遗产庭正门', position: { x: 0, y: 2 },
      description: '正门登记本轮竞标身份，并发放只在本次探索中具有购买力的无记名遗产筹码。',
      reward: { rewardPoints: 380, items: { legacy_scrip: 2, gate_sigil: 1 } }
    },
    {
      id: 'catalog_bailiff', type: 'monster', title: '目录底价执役', position: { x: 1, y: 2 },
      description: '目录执役逐笔核对伤害报价，降价出手会被当成恶意压价并立刻追偿。', monsterId: 'reserve_bailiff'
    },
    {
      id: 'provenance_event_stage', type: 'trap', title: '来源争议台', position: { x: 2, y: 2 },
      description: '互相冲突的持有记录在台上撕扯竞标者，定神香能守住自己的记忆来源。',
      trap: { damage: 152, dc: 34, counterItem: 'focus_incense' }
    },
    {
      id: 'estate_auctioneer', type: 'monster', title: '遗产执槌人', position: { x: 3, y: 2 },
      description: '执槌人掌握全部流拍记录，并把四类拍品的清算结果压入觉醒后的终场槌击。', monsterId: 'estate_auctioneer'
    },
    {
      id: 'boss_side_rostrum', type: 'trap', title: '终场侧席槌阵', position: { x: 4, y: 2 },
      description: '侧席机械槌封锁竞标退路，护甲补片能固定承压结构直到槌阵停机。',
      trap: { damage: 156, dc: 35, counterItem: 'armor_patch' }
    },
    {
      id: 'auction_exit', type: 'exit', title: '遗产庭清算门', position: { x: 5, y: 2 },
      description: '清算门核销本轮全部竞标、拍品与亡队证词，并将成功带出的遗产转交主神空间。',
      reward: { rewardPoints: 1180, lingyun: 9, items: { legacy_scrip: 4, method_page: 2, cracked_core: 1, cycle_imprint: 1 } }
    },
    {
      id: 'lower_bid_supply', type: 'reward', title: '下席竞标补给', position: { x: 0, y: 3 },
      description: '流拍箱里留下止血药与一枚无主筹码，足以让低价起拍者重新组织节奏。',
      reward: { rewardPoints: 260, items: { legacy_scrip: 1, healing_pill: 1 } }
    },
    {
      id: 'art_lot_dais', type: 'reward', title: '术法拍品台', position: { x: 1, y: 3 },
      description: '拍品台封存亡队术士未完成的最后仪式，竞标选择将决定它以何种形式留档。',
      reward: { rewardPoints: 300, items: { legacy_scrip: 1 } }
    },
    {
      id: 'inheritance_mimic_omega', type: 'monster', title: '终轮遗产拟形体', position: { x: 2, y: 3 },
      description: '终轮拟形体已学会辨认所有战斗道具来源，却仍只能抵消一次直接伤害。', monsterId: 'inheritance_mimic'
    },
    {
      id: 'dead_team_testimony_stage', type: 'reward', title: '亡队证词台', position: { x: 3, y: 3 },
      description: '四份互相矛盾的临终证词在台上循环播放，承认其中一份就会改变遗产归属。',
      reward: { rewardPoints: 340, items: { legacy_scrip: 1, cracked_core: 1 } }
    },
    {
      id: 'return_lot_dais', type: 'reward', title: '归返拍品台', position: { x: 4, y: 3 },
      description: '拍品台出售亡队未能兑现的归返承诺，所有选择都会被终场号钟记账。',
      reward: { rewardPoints: 300, items: { legacy_scrip: 1 } }
    },
    {
      id: 'lower_auction_portal', type: 'portal', title: '下席回拍门', position: { x: 5, y: 3 },
      description: '回拍门落向原型库下层血清补给，门符可以稳定跨副本的竞标身份。',
      portal: { targetDungeonId: 'genesis_vault', targetNodeId: 'lower_serum_supply', stableItem: 'gate_sigil' }
    },
    {
      id: 'art_claim_vault', type: 'reward', title: '术法认领库', position: { x: 0, y: 4 },
      description: '旧队术士的认领库仍保持低温，封存的灵力与时序玻璃等待新的继承者。',
      reward: { rewardPoints: 460, lingyun: 2, items: { legacy_scrip: 1, chronal_glass: 1 } }
    },
    {
      id: 'art_relic_gallery', type: 'reward', relicDraftId: 'legacy_auction_court:art:2', title: '术法遗珍廊', position: { x: 1, y: 4 },
      description: '遗珍廊把未完成的术法方案折成拍品草案，取走一份便会注销其余版本。',
      reward: { rewardPoints: 360, items: { legacy_scrip: 1 } }
    },
    {
      id: 'return_auction_portal', type: 'portal', title: '归返回拍门', position: { x: 2, y: 4 },
      description: '归返门通向原型库血统调查档案，稳定门符能防止遗产清单在过境时失真。',
      portal: { targetDungeonId: 'genesis_vault', targetNodeId: 'bloodline_survey_archive', stableItem: 'gate_sigil' }
    },
    {
      id: 'south_scrip_cache', type: 'reward', equipmentHuntClueId: 'equipment_hunt_legacy_auction_court', title: '南侧筹码匣', position: { x: 3, y: 4 },
      description: '南侧筹码保留遗产装备最后一次成交记录，与北侧线索合读后可定位真正拍品。',
      reward: { rewardPoints: 280, items: { legacy_scrip: 1 } }
    },
    {
      id: 'soul_recharge_auction', type: 'trap', soulRechargeId: 'soul_node_auction_reprice', title: '器魂重估席', position: { x: 4, y: 4 },
      description: '重估席强行拆分器魂旧价，护甲补片能在重新定价期间保护装备本体。',
      trap: { damage: 152, dc: 34, counterItem: 'armor_patch' }
    },
    {
      id: 'return_claim_vault', type: 'reward', title: '归返认领库', position: { x: 5, y: 4 },
      description: '亡队领航员的归返凭证仍指向主神空间，库内资源足以为幸存者校准最后航向。',
      reward: { rewardPoints: 440, lingyun: 2, items: { legacy_scrip: 1, phase_glass: 1 } }
    }
  ]
};
