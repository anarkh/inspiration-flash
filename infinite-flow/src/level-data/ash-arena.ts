import type { DungeonDefinition } from '../game';

export const ashArenaDungeon: DungeonDefinition = {
  id: 'ash_arena',
  name: '灰烬竞技场',
  tier: 5,
  recommendedPower: 305,
  theme: '竞技场把每一次行动都公开审判，玩家必须管理爆发、承伤和节奏。',
  recommended: '推荐一件 +1 装备和至少一只宠物。',
  rewardPreview: '星铁、裂核、奖励点 380-920',
  grid: { width: 6, height: 5, startNodeId: 'arena_gate' },
  nodes: [
    {
      id: 'arena_gate',
      type: 'reward',
      title: '观众席押注',
      position: { x: 0, y: 0 },
      description: '空无一人的观众席仍在下注，先领押注筹码能打开上路盘口，也能攒下穿过裁决火线的资源。',
      reward: { rewardPoints: 90, lingyun: 1 }
    },
    {
      id: 'odds_marker',
      type: 'reward',
      title: '赔率铜牌',
      position: { x: 1, y: 0 },
      description: '铜牌把每条路线标成赔率，压低风险的走法给补给，贪冠军门支路则把后续惩罚抬高。',
      reward: { rewardPoints: 70, items: { armor_patch: 1 } }
    },
    {
      id: 'ash_duelist',
      type: 'monster',
      title: '灰烬斗士',
      position: { x: 2, y: 0 },
      description: '斗士拖着燃尽的长刀，等待你先露出破绽；如果连续强攻，观众席会把你的节奏卖给下一道火线。',
      monsterId: 'ash_duelist'
    },
    {
      id: 'judgement_flame',
      type: 'trap',
      title: '裁决火线',
      position: { x: 3, y: 0 },
      description: '地面火线按你上一回合的站位追踪，重复行动会被判定为贪招，护甲补片能挡住最烫的一段。',
      trap: { damage: 42, dc: 13, counterItem: 'armor_patch' }
    },
    {
      id: 'champion_portal',
      type: 'portal',
      title: '冠军门',
      position: { x: 4, y: 0 },
      description: '冠军门挂在上路尽头，愿意绕支路证明连胜的人，会被观众席推向梦档案馆的索引柜。',
      portal: { targetDungeonId: 'dream_archive', targetNodeId: 'index_reward', stableItem: 'gate_sigil' }
    },
    {
      id: 'champion_purse',
      type: 'reward',
      relicDraftId: 'ash_arena:echo:1',
      title: '冠军袋',
      position: { x: 5, y: 0 },
      description: '袋口还烫着炉灰，里面是观众席提前押给胜者的星铁边角。',
      reward: { rewardPoints: 80, items: { star_iron: 1 } }
    },
    {
      id: 'spectator_cache',
      type: 'reward',
      title: '观众席暗格',
      position: { x: 0, y: 1 },
      description: '座椅下塞着没领走的补给，适合在进入中线搏斗前补一口气。',
      reward: { rewardPoints: 60, items: { healing_pill: 1 } }
    },
    {
      id: 'repeat_brazier',
      type: 'trap',
      title: '复招火盆',
      position: { x: 1, y: 1 },
      description: '火盆记录你刚才的选择，连续走同一种打法时会喷出灰焰，逼你在攻击、防御和术法间换节奏。',
      trap: { damage: 36, dc: 12, counterItem: 'focus_incense' }
    },
    {
      id: 'ember_pit_duelist',
      type: 'monster',
      title: '坑边斗士',
      position: { x: 2, y: 1 },
      description: '斗士守在灰坑边，专挑被火盆逼退的人补刀。',
      monsterId: 'ash_duelist'
    },
    {
      id: 'side_bench_supplies',
      type: 'reward',
      equipmentHuntClueId: 'equipment_hunt_ash_arena',
      title: '侧席补给',
      position: { x: 3, y: 1 },
      description: '侧席的水壶和绷带被炉灰封住，撬开后能让你多承受一次裁决。',
      reward: { rewardPoints: 55, items: { armor_patch: 1 } }
    },
    {
      id: 'cinder_snare',
      type: 'trap',
      title: '灰绳陷阵',
      position: { x: 4, y: 1 },
      description: '灰绳从地缝里弹起，试图把你拖回冠军门前反复接受喝彩和惩罚。',
      trap: { damage: 34, dc: 12, counterItem: 'armor_patch' }
    },
    {
      id: 'backer_portal',
      type: 'portal',
      title: '押注人暗门',
      position: { x: 5, y: 1 },
      description: '暗门藏在冠军袋后方，押中冷门路线的人能提前离场，直接落到梦档案馆的索引柜。',
      portal: { targetDungeonId: 'dream_archive', targetNodeId: 'index_reward', stableItem: 'gate_sigil' }
    },
    {
      id: 'ash_purse',
      type: 'reward',
      title: '灰币小袋',
      position: { x: 0, y: 2 },
      description: '小袋里全是被烧黑的筹码，换成奖励点后刚好够你再赌一段中线。',
      reward: { rewardPoints: 75 }
    },
    {
      id: 'cinder_lancer',
      type: 'monster',
      title: '余烬枪手',
      position: { x: 1, y: 2 },
      description: '枪手在观众席阴影里横刺，逼你先处理支线威胁再进裁判区。',
      monsterId: 'ash_duelist'
    },
    {
      id: 'oath_cinders',
      type: 'trap',
      title: '誓词余火',
      position: { x: 2, y: 2 },
      description: '地上的胜者誓词仍在燃烧，踩错节拍就会把上一轮动作重演成伤害。',
      trap: { damage: 38, dc: 13, counterItem: 'focus_incense' }
    },
    {
      id: 'furnace_judge',
      type: 'monster',
      title: '炉心裁判',
      position: { x: 3, y: 2 },
      description: '裁判会记录上一回合动作，重复贪攻会被炉火点名，防御和术法轮换更稳。',
      monsterId: 'furnace_judge'
    },
    {
      id: 'chant_cache',
      type: 'reward',
      title: '喝彩回声',
      position: { x: 4, y: 2 },
      description: '喝彩声凝成一点灵蕴，拿走它会让冠军门支路的压力稍微可控。',
      reward: { rewardPoints: 65, lingyun: 1 }
    },
    {
      id: 'sentence_line',
      type: 'trap',
      title: '判词红线',
      position: { x: 5, y: 2 },
      description: '红线写着上一名挑战者的判词，越急着冲向暗门，越容易踩进同样的结局。',
      trap: { damage: 40, dc: 14, counterItem: 'armor_patch' }
    },
    {
      id: 'judge_token_reward',
      type: 'reward',
      relicDraftId: 'ash_arena:echo:2',
      title: '裁判筹码',
      position: { x: 0, y: 3 },
      description: '筹码上刻着火纹，带在身上能换来一次观众席的短暂沉默。',
      reward: { rewardPoints: 85, items: { gate_sigil: 1 } }
    },
    {
      id: 'ringbreaker_duelist',
      type: 'monster',
      title: '破环斗士',
      position: { x: 1, y: 3 },
      description: '斗士故意打碎护栏，把你逼进更窄的路线。',
      monsterId: 'ash_duelist'
    },
    {
      id: 'ember_sentinel',
      type: 'monster',
      title: '余火看台卫',
      position: { x: 2, y: 3 },
      description: '看台卫会拖长战斗，让炉心裁判的重复行动惩罚更容易追上你。',
      monsterId: 'ash_duelist'
    },
    {
      id: 'smoke_gutter',
      type: 'trap',
      soulRechargeId: 'soul_node_arena_smoke_verdict',
      title: '烟沟',
      position: { x: 3, y: 3 },
      description: '烟沟压低视野，若没有定神香，下一次选择路线就像在赌盲注。',
      trap: { damage: 35, dc: 12, counterItem: 'focus_incense' }
    },
    {
      id: 'champion_branch_reward',
      type: 'reward',
      title: '支路奖杯',
      position: { x: 4, y: 3 },
      description: '冠军门支路的奖杯不大，但刻着你的连续胜场，拿走后观众席会重新计算赔率。',
      reward: { rewardPoints: 95, lingyun: 1 }
    },
    {
      id: 'penalty_fire',
      type: 'trap',
      title: '惩戒火舌',
      position: { x: 5, y: 3 },
      description: '火舌专烧犹豫的脚步，绕暗门回来的人要在这里付清支路代价。',
      trap: { damage: 44, dc: 14, counterItem: 'armor_patch' }
    },
    {
      id: 'ration_cache',
      type: 'reward',
      equipmentHuntClueId: 'equipment_hunt_ash_arena',
      title: '斗士口粮',
      position: { x: 0, y: 4 },
      description: '口粮混着药粉，味道糟糕但足够支撑你穿过最后一排看台。',
      reward: { rewardPoints: 50, items: { healing_pill: 1 } }
    },
    {
      id: 'judge_shadow',
      type: 'monster',
      title: '裁判影身',
      position: { x: 1, y: 4 },
      description: '影身模仿炉心裁判的手势，提醒你最后阶段仍不能把同一动作按到底。',
      monsterId: 'furnace_judge'
    },
    {
      id: 'final_duelist',
      type: 'monster',
      title: '终席斗士',
      position: { x: 2, y: 4 },
      description: '终席斗士守着白阶前的最后一格，低血量时会把所有喝彩都换成爆发。',
      monsterId: 'ash_duelist'
    },
    {
      id: 'cracked_core_prize',
      type: 'reward',
      fieldSurveyId: 'survey_arena_cracked_prize',
      title: '裂核奖品',
      position: { x: 3, y: 4 },
      description: '奖品盒里躺着一枚裂核，像是炉心裁判故意留下的复盘证据。',
      reward: { rewardPoints: 100, items: { cracked_core: 1 } }
    },
    {
      id: 'white_step_tax',
      type: 'trap',
      title: '白阶税火',
      position: { x: 4, y: 4 },
      description: '白阶前的火焰会清算重复路线，没准备好就冲刺的人会先付一笔胜者税。',
      trap: { damage: 46, dc: 15, counterItem: 'armor_patch' }
    },
    {
      id: 'arena_exit',
      type: 'exit',
      title: '胜者白阶',
      position: { x: 5, y: 4 },
      description: '白阶升起，观众席同时熄灭，再停留就会触发新一轮押注。',
      reward: { rewardPoints: 260, lingyun: 2, items: { star_iron: 1 } }
    }
  ]
};
