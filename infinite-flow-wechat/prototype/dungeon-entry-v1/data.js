// Static prototype data from the current core catalog and a fresh-game campaign gate.
export const dungeons = [
  {
    "id": "demon_tower_1",
    "name": "妖塔一层",
    "power": 150,
    "chapter": 1,
    "cover": "../../cocos/assets/resources/dungeon/demon-tower-1-v1.png",
    "alt": "青雾沿黑石回廊蔓延的妖塔一层",
    "available": true,
    "requirement": ""
  },
  {
    "id": "metro_abyss",
    "name": "镜潮地铁",
    "power": 185,
    "chapter": 2,
    "cover": "../../cocos/assets/resources/dungeon/metro-abyss-v1.png",
    "alt": "黑潮倒映破损列车的镜潮地铁",
    "available": false,
    "requirement": "完成并领取「妖塔一层主线」"
  },
  {
    "id": "starfall_mine",
    "name": "星坠矿井",
    "power": 230,
    "chapter": 3,
    "cover": "../../cocos/assets/resources/dungeon/starfall-mine-v1.png",
    "alt": "星铁矿脉照亮深井的星坠矿井",
    "available": false,
    "requirement": "完成并领取「镜潮地铁主线」"
  },
  {
    "id": "rust_hospital",
    "name": "锈疫病院",
    "power": 265,
    "chapter": 4,
    "cover": "../../cocos/assets/resources/dungeon/rust-hospital-v1.png",
    "alt": "隔离帘与锈蚀病床交错的锈疫病院",
    "available": false,
    "requirement": "完成并领取「星坠矿井主线」"
  },
  {
    "id": "ash_arena",
    "name": "灰烬竞技场",
    "power": 305,
    "chapter": 5,
    "cover": "../../cocos/assets/resources/dungeon/ash-arena-v1.png",
    "alt": "余烬环绕中央决斗场的灰烬竞技场",
    "available": false,
    "requirement": "完成并领取「锈疫病院主线」"
  },
  {
    "id": "dream_archive",
    "name": "梦档案馆",
    "power": 345,
    "chapter": 6,
    "cover": "../../cocos/assets/resources/dungeon/dream-archive-v1.png",
    "alt": "空白书页悬于无尽书架间的梦档案馆",
    "available": false,
    "requirement": "完成并领取「灰烬竞技场主线」"
  },
  {
    "id": "void_citadel",
    "name": "虚界城",
    "power": 390,
    "chapter": 7,
    "cover": "../../cocos/assets/resources/dungeon/void-citadel-v1.png",
    "alt": "界隙裂光贯穿黑曜长廊的虚界城",
    "available": false,
    "requirement": "完成并领取「梦档案馆主线」"
  },
  {
    "id": "temporal_observatory",
    "name": "时序观测庭",
    "power": 435,
    "chapter": 8,
    "cover": "../../cocos/assets/resources/dungeon/temporal-observatory-v1.png",
    "alt": "时序环围绕冻结星图的时序观测庭",
    "available": false,
    "requirement": "完成并领取「虚界城主线」"
  },
  {
    "id": "causal_clearinghouse",
    "name": "因果清算所",
    "power": 500,
    "chapter": 9,
    "cover": "../../cocos/assets/resources/dungeon/causal-clearinghouse-v1.png",
    "alt": "双侧机轨汇入裁决核心的因果清算所",
    "available": false,
    "requirement": "完成并领取「时序观测庭主线」"
  },
  {
    "id": "entropy_ark",
    "name": "熵海方舟",
    "power": 565,
    "chapter": 10,
    "cover": "../../cocos/assets/resources/dungeon/entropy-ark-v1.png",
    "alt": "航迹在熵海上逐渐崩解的熵海方舟",
    "available": false,
    "requirement": "完成并领取「因果清算所主线」"
  },
  {
    "id": "mirror_cycle_city",
    "name": "镜海轮回城",
    "power": 630,
    "chapter": 11,
    "cover": "../../cocos/assets/resources/dungeon/mirror-cycle-city-v2.png",
    "alt": "轮回城现实与镜像双相街区",
    "available": false,
    "requirement": "完成并领取「熵海方舟主线」"
  },
  {
    "id": "redaction_scriptorium",
    "name": "删界终稿院",
    "power": 700,
    "chapter": 12,
    "cover": "../../cocos/assets/resources/dungeon/redaction-scriptorium-v2.png",
    "alt": "红色删改光束贯穿黑色数据档案库的删界终稿院",
    "available": false,
    "requirement": "完成并领取「镜海轮回城主线」"
  },
  {
    "id": "legacy_auction_court",
    "name": "亡队遗产拍卖庭",
    "power": 780,
    "chapter": 13,
    "cover": "../../cocos/assets/resources/dungeon/legacy-auction-court-v2.png",
    "alt": "军事机库内悬挂武器箱与亡队遗物的拍卖庭",
    "available": false,
    "requirement": "完成并领取「删界终稿院主线」"
  },
  {
    "id": "genesis_vault",
    "name": "众生原型库",
    "power": 860,
    "chapter": 14,
    "cover": "../../cocos/assets/resources/dungeon/genesis-vault-v2.png",
    "alt": "生物罐、机械臂与发光基因核心环绕的众生原型库",
    "available": false,
    "requirement": "完成并领取「亡队遗产拍卖庭主线」"
  },
  {
    "id": "silent_broadcast_tower",
    "name": "寂声广播塔",
    "power": 950,
    "chapter": 15,
    "cover": "../../cocos/assets/resources/dungeon/silent-broadcast-tower-v2.png",
    "alt": "雷雨中三座中继阵列围绕现代应急广播塔",
    "available": false,
    "requirement": "完成并领取「众生原型库主线」"
  },
  {
    "id": "lost_shelter",
    "name": "失联避难所",
    "power": 1040,
    "chapter": 16,
    "cover": "../../cocos/assets/resources/dungeon/lost-shelter-v2.png",
    "alt": "担架、枪械箱与自动哨戒炮散落的现代地下避难所",
    "available": false,
    "requirement": "完成并领取「寂声广播塔主线」"
  },
  {
    "id": "false_testimony_court",
    "name": "伪证裁定庭",
    "power": 1140,
    "chapter": 17,
    "cover": "../../cocos/assets/resources/dungeon/false-testimony-court-v2.png",
    "alt": "三座未来取证实验室围绕全息审讯台的裁定庭",
    "available": false,
    "requirement": "完成并领取「失联避难所主线」"
  },
  {
    "id": "combat_replay_stage",
    "name": "战痕复演场",
    "power": 1240,
    "chapter": 18,
    "cover": "../../cocos/assets/resources/dungeon/combat-replay-stage-v2.png",
    "alt": "三面全息战术回放屏环绕未来军事模拟场",
    "available": false,
    "requirement": "完成并领取「伪证裁定庭主线」"
  },
  {
    "id": "panopticon_city",
    "name": "天幕监察城",
    "power": 1350,
    "chapter": 19,
    "cover": "../../cocos/assets/resources/dungeon/panopticon-city-v2.png",
    "alt": "无人机与机甲巡逻在轨道扫描天幕下的未来监察城",
    "available": false,
    "requirement": "完成并领取「战痕复演场主线」"
  }
];
