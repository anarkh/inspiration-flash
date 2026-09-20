import type { DungeonDefinition } from '../game';

export const dreamArchiveDungeon: DungeonDefinition = {
  id: 'dream_archive',
  name: '梦档案馆',
  tier: 6,
  genre: 'anomaly',
  recommendedPower: 345,
  theme: '档案馆记录玩家失败过的每一种路线，并把它们折成新的幻觉。',
  recommended: '推荐虚心诀或灵力 7。',
  rewardPreview: '功法残页、隐藏石、奖励点 430-1040',
  grid: { width: 6, height: 5, startNodeId: 'index_reward' },
  // 满铺 6x5 网格，保证所有节点都能通过曼哈顿相邻路径互相抵达。
  nodes: [
    {
      id: 'index_reward',
      type: 'reward',
      title: '索引柜',
      position: { x: 0, y: 0 },
      description: '索引卡写着你的名字，背面列出还没发生的失败路线。',
      reward: {
        rewardPoints: 160,
        items: { method_page: 1 },
        methodBonus: {
          methodId: 'void_heart',
          text: '虚心诀让你读完失败索引而不被拖入梦境。',
          reward: { rewardPoints: 160, lingyun: 1, items: { hidden_stone: 1 } }
        }
      }
    },
    {
      id: 'failed_file_reward',
      type: 'reward',
      title: '失败档案甲',
      position: { x: 1, y: 0 },
      description: '抽屉里压着一份失败档案，批注把错误路线改写成功法残页。',
      reward: { rewardPoints: 90, items: { method_page: 1 } }
    },
    {
      id: 'paper_librarian',
      type: 'monster',
      title: '纸面馆主',
      position: { x: 2, y: 0 },
      description: '馆主从书页里站起来，指尖翻动你的战斗记录。',
      monsterId: 'paper_librarian'
    },
    {
      id: 'margin_snare_trap',
      type: 'trap',
      title: '页边夹缝',
      position: { x: 3, y: 0 },
      description: '页边批注忽然合拢，把贪快的脚步夹进重复的梦句里。',
      trap: { damage: 38, dc: 14, counterItem: 'focus_incense' }
    },
    {
      id: 'method_fragment_reward',
      type: 'reward',
      equipmentHuntClueId: 'equipment_hunt_dream_archive',
      title: '功法残页匣',
      position: { x: 4, y: 0 },
      description: '匣中残页只写半招，另一半藏在你刚刚避开的幻觉里。',
      reward: { rewardPoints: 110, lingyun: 1, items: { method_page: 1 } }
    },
    {
      id: 'archive_portal',
      type: 'portal',
      title: '空白书门',
      position: { x: 5, y: 0 },
      description: '空白书页卷成门洞，门后是主神残响所在的虚界城。',
      portal: { targetDungeonId: 'void_citadel', targetNodeId: 'citadel_gate', stableItem: 'gate_sigil' }
    },
    {
      id: 'rejected_strategy_reward',
      type: 'reward',
      title: '废案抽屉',
      position: { x: 0, y: 1 },
      description: '抽屉里全是被你放弃的配装草稿，边角还留着可用的奖励点。',
      reward: { rewardPoints: 120, items: { focus_incense: 1 } }
    },
    {
      id: 'hallucination_patrol',
      type: 'monster',
      title: '幻觉巡逻',
      position: { x: 1, y: 1 },
      description: '一排纸面馆员沿书架巡逻，反复询问你为什么输在同一页。',
      monsterId: 'paper_librarian'
    },
    {
      id: 'memory_loop_trap',
      type: 'trap',
      title: '记忆回环',
      position: { x: 2, y: 1 },
      description: '走廊重复出现三次，每次都少一段呼吸。',
      trap: { damage: 46, dc: 15, counterItem: 'focus_incense' }
    },
    {
      id: 'blank_shelf_reward',
      type: 'reward',
      equipmentHuntClueId: 'equipment_hunt_dream_archive',
      title: '空架批注',
      position: { x: 3, y: 1 },
      description: '空书架没有藏书，只留下批注：承认失败也算完成一次阅读。',
      reward: { rewardPoints: 95, lingyun: 1 }
    },
    {
      id: 'dream_jailer',
      type: 'monster',
      title: '梦牢看守',
      position: { x: 4, y: 1 },
      description: '看守会暂时锁住一个道具位，迫使你依靠功法、宠物或基础属性打完残局。',
      monsterId: 'dream_jailer'
    },
    {
      id: 'side_branch_portal',
      type: 'portal',
      title: '空白书门支路',
      position: { x: 5, y: 1 },
      description: '支路书门比正门更窄，翻过去仍会落在虚界城门前，只是多带一阵纸灰。',
      portal: { targetDungeonId: 'void_citadel', targetNodeId: 'citadel_gate', stableItem: 'gate_sigil' }
    },
    {
      id: 'broken_save_trap',
      type: 'trap',
      title: '坏档回声',
      position: { x: 0, y: 2 },
      description: '失败档案突然播放旧战斗的最后一秒，逼你重新承受那次失误。',
      trap: { damage: 42, dc: 15, counterItem: 'dispel_talisman' }
    },
    {
      id: 'footnote_cache_reward',
      type: 'reward',
      title: '页脚暗格',
      position: { x: 1, y: 2 },
      description: '页脚暗格藏着一枚隐石，像是有人替未来的你留了路标。',
      reward: { rewardPoints: 105, items: { hidden_stone: 1 } }
    },
    {
      id: 'paper_librarian_echo',
      type: 'monster',
      title: '纸面馆主残影',
      position: { x: 2, y: 2 },
      description: '残影只会复述馆主的问题，但每个问题都附着一道纸刃。',
      monsterId: 'paper_librarian'
    },
    {
      id: 'ink_sleep_trap',
      type: 'trap',
      title: '墨睡陷阱',
      position: { x: 3, y: 2 },
      description: '墨迹从地面升起，把视线涂黑，只剩失败标题在耳边翻页。',
      trap: { damage: 44, dc: 16, counterItem: 'focus_incense' }
    },
    {
      id: 'forgotten_method_reward',
      type: 'reward',
      title: '忘形残页',
      position: { x: 4, y: 2 },
      description: '残页记录的是你曾经没学会的一式，如今反而能补上空缺。',
      reward: { rewardPoints: 130, items: { method_page: 1 } }
    },
    {
      id: 'jailer_log_reward',
      type: 'reward',
      relicDraftId: 'dream_archive:echo:1',
      title: '看守日志',
      position: { x: 5, y: 2 },
      description: '日志写满被锁道具后的通关尝试，最后一行标出安全出口的方向。',
      reward: { rewardPoints: 115, items: { rift_dust: 1 } }
    },
    {
      id: 'jailer_patrol',
      type: 'monster',
      title: '梦牢巡卫',
      position: { x: 0, y: 3 },
      description: '巡卫拖着钥匙串走过长廊，每一把钥匙都刻着一种失败原因。',
      monsterId: 'dream_jailer'
    },
    {
      id: 'overwritten_record_trap',
      type: 'trap',
      soulRechargeId: 'soul_node_archive_overwrite',
      title: '覆写档案',
      position: { x: 1, y: 3 },
      description: '档案页把胜利记录覆写成失败版本，稍一迟疑就会被拉回上一格梦境。',
      trap: { damage: 48, dc: 16, counterItem: 'dispel_talisman' }
    },
    {
      id: 'incense_reward',
      type: 'reward',
      title: '稳神香案',
      position: { x: 2, y: 3 },
      description: '香案上压着一束定神香，烟线绕开记忆陷阱的薄弱处。',
      reward: { rewardPoints: 85, items: { focus_incense: 1 } }
    },
    {
      id: 'hallucination_patrol_two',
      type: 'monster',
      title: '幻觉巡逻',
      position: { x: 3, y: 3 },
      description: '第二队巡逻从书脊背面绕出，专门追逐贪图捷径的读者。',
      monsterId: 'paper_librarian'
    },
    {
      id: 'cracked_core_index_reward',
      type: 'reward',
      title: '裂核索引',
      position: { x: 4, y: 3 },
      description: '索引页提前记录虚界材料的位置，纸面微微透出裂核的白光。',
      reward: { rewardPoints: 150, items: { cracked_core: 1 } }
    },
    {
      id: 'white_page_reward',
      type: 'reward',
      title: '门后白页',
      position: { x: 5, y: 3 },
      description: '白页没有文字，只有一行可撕下的余白，适合重写下一段路线。',
      reward: { rewardPoints: 100, lingyun: 1 }
    },
    {
      id: 'sealed_footnote_reward',
      type: 'reward',
      relicDraftId: 'dream_archive:echo:2',
      title: '封底脚注',
      position: { x: 0, y: 4 },
      description: '封底脚注把几个小胜利夹在失败档案后面，等你自己翻出来。',
      reward: { rewardPoints: 125, items: { echo_coin: 1 } }
    },
    {
      id: 'paper_cut_trap',
      type: 'trap',
      title: '纸刃雨',
      position: { x: 1, y: 4 },
      description: '书页碎成细刃落下，越想硬闯，越会被自己的旧批注割伤。',
      trap: { damage: 50, dc: 17, counterItem: 'armor_patch' }
    },
    {
      id: 'dream_jailer_second',
      type: 'monster',
      title: '梦牢副钥',
      position: { x: 2, y: 4 },
      description: '副钥看守不说话，只把你的道具栏影子一格格扣进锁孔。',
      monsterId: 'dream_jailer'
    },
    {
      id: 'void_map_reward',
      type: 'reward',
      fieldSurveyId: 'survey_archive_void_map',
      title: '虚界残图',
      position: { x: 3, y: 4 },
      description: '残图标出虚界城门的轮廓，墨线却像梦一样不断偏移。',
      reward: { rewardPoints: 140, items: { rift_dust: 1, method_page: 1 } }
    },
    {
      id: 'afterimage_bookmark_reward',
      type: 'reward',
      title: '余像书签',
      position: { x: 4, y: 4 },
      description: '书签夹住最后一个失败余像，让它不再追进下一层。',
      reward: { rewardPoints: 100, lingyun: 1, items: { focus_incense: 1 } }
    },
    {
      id: 'archive_exit',
      type: 'exit',
      title: '归档白光',
      position: { x: 5, y: 4 },
      description: '白光像书签一样插入档案，把这一轮结果固定下来。',
      reward: { rewardPoints: 360, lingyun: 2, items: { method_page: 1 } }
    }
  ]
};
