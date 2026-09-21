/**
 * World of Warcraft Map Data - Complete Expansion Roster (1.0 -> 11.0)
 * Includes true stitched continent composites AND individual 4K detailed regional zone maps
 */

const WOW_MAP_DATA = {
    // 1. Continents
    continents: {
        'eastern-kingdoms': {
            id: 'eastern-kingdoms',
            name: '东部王国',
            englishName: 'Eastern Kingdoms',
            era: '1.0 经典旧世',
            description: '东部王国完整无缝拼接大地图 (4500x6500 超高清)。涵盖全境 32 个区域。',
            bounds: [[0, 0], [6500, 4500]],
            center: [3250, 2250],
            minZoom: -2,
            maxZoom: 3,
            initialZoom: -1,
            compositeMapUrl: 'assets/composites/eastern-kingdoms-composite.jpg',
            overviewMapUrl: 'assets/maps/eastern-kingdoms.jpg',
            pois: [
                { id: 'sw', name: '暴风城', en: 'Stormwind City', type: 'capital', faction: 'alliance', pos: [2380, 1550], level: '联盟主城', desc: '人类王国辉煌的心脏，光明大教堂与英雄谷。', targetZone: 'stormwind-city' },
                { id: 'if', name: '铁炉堡', en: 'Ironforge', type: 'capital', faction: 'alliance', pos: [3050, 1920], level: '联盟主城', desc: '铜须矮人坚不可摧的山中地下都城。', targetZone: 'dun-morogh' },
                { id: 'uc', name: '幽暗城', en: 'Undercity', type: 'capital', faction: 'horde', pos: [4950, 1600], level: '部落主城', desc: '洛丹伦地下的深邃迷宫，被遗忘者都城。', targetZone: 'tirisfal' },
                { id: 'smc', name: '银月城', en: 'Silvermoon City', type: 'capital', faction: 'horde', pos: [6050, 2900], level: '部落主城', desc: '血精灵金红魔法都城。' },
                { id: 'mc', name: '黑石山 (MC / BWL)', en: 'Blackrock Mountain', type: 'raid', faction: 'raid', pos: [2600, 2100], level: '60级 (40人)', desc: '熔火之心拉格纳罗斯与黑翼之巢奈法利安。' },
                { id: 'kara', name: '卡拉赞', en: 'Karazhan', type: 'raid', faction: 'raid', pos: [1880, 2220], level: '70级 (10人)', desc: '逆风小径麦迪文的高塔。' }
            ]
        },

        'kalimdor': {
            id: 'kalimdor',
            name: '卡利姆多',
            englishName: 'Kalimdor',
            era: '1.0 经典旧世',
            description: '卡利姆多完整无缝拼接大地图 (3480x5027 超高清)。',
            bounds: [[0, 0], [5027, 3480]],
            center: [2513, 1740],
            minZoom: -2,
            maxZoom: 3,
            initialZoom: -1,
            compositeMapUrl: 'assets/composites/kalimdor-composite.jpg',
            overviewMapUrl: 'assets/maps/kalimdor.jpg',
            pois: [
                { id: 'org', name: '奥格瑞玛', en: 'Orgrimmar', type: 'capital', faction: 'horde', pos: [2820, 2320], level: '部落主城', desc: '钢铁石堡大门与格罗玛什要塞。', targetZone: 'orgrimmar-city' },
                { id: 'tb', name: '雷霆崖', en: 'Thunder Bluff', type: 'capital', faction: 'horde', pos: [2320, 1420], level: '部落主城', desc: '莫高雷风蚀台地上的牛头人主城。', targetZone: 'mulgore' },
                { id: 'dar', name: '达纳苏斯', en: 'Darnassus', type: 'capital', faction: 'alliance', pos: [4620, 880], level: '联盟主城', desc: '世界之树顶端的暗夜精灵都城。' },
                { id: 'crossroads', name: '十字路口', en: 'The Crossroads', type: 'capital', faction: 'horde', pos: [2650, 1780], level: '贫瘠之地', desc: '连接卡利姆多四方的传奇中枢要道。', targetZone: 'the-barrens' },
                { id: 'aq40', name: '安其拉神殿 (TAQ)', en: 'Temple of Ahn\'Qiraj', type: 'raid', faction: 'raid', pos: [650, 1120], level: '60 (40人)', desc: '希利苏斯南端的其拉古神要塞，千眼克苏恩。', targetZone: 'silithus' }
            ]
        },

        'outland': {
            id: 'outland',
            name: '外域',
            englishName: 'Outland',
            era: '2.0 燃烧的远征',
            description: '外域星界浮岛完整无缝拼接大地图 (4500x3340 超高清)。',
            bounds: [[0, 0], [3340, 4500]],
            center: [1670, 2250],
            minZoom: -2,
            maxZoom: 3,
            initialZoom: -1,
            compositeMapUrl: 'assets/composites/outland-composite.jpg',
            overviewMapUrl: 'assets/maps/outland.jpg',
            pois: [
                { id: 'shatt', name: '沙塔斯城', en: 'Shattrath City', type: 'capital', faction: 'neutral', pos: [1550, 1900], level: '中立主城', desc: '纳鲁圣光避难所，占星者与奥尔多。' },
                { id: 'bt', name: '黑暗神殿 (BT)', en: 'Black Temple', type: 'raid', faction: 'raid', pos: [1100, 3750], level: '70 (25人)', desc: '影月谷最东侧，伊利丹·怒风与埃辛诺斯战刃。', targetZone: 'shadowmoon' },
                { id: 'dark-portal-out', name: '黑暗之门 (外域端)', en: 'The Dark Portal', type: 'landmark', faction: 'neutral', pos: [1800, 3350], level: '58-60级', desc: '踏入外域直面燃烧军团炮火的前线。', targetZone: 'hellfire' }
            ]
        },

        'northrend': {
            id: 'northrend',
            name: '诺森德',
            englishName: 'Northrend',
            era: '3.0 巫妖王之怒',
            description: '诺森德极北严寒完整拼接大地图 (5000x3712 超高清)。',
            bounds: [[0, 0], [3712, 5000]],
            center: [1856, 2500],
            minZoom: -2,
            maxZoom: 3,
            initialZoom: -1,
            compositeMapUrl: 'assets/composites/northrend-composite.jpg',
            overviewMapUrl: 'assets/maps/northrend.jpg',
            pois: [
                { id: 'dala', name: '达拉然 (浮空城)', en: 'Dalaran', type: 'capital', faction: 'neutral', pos: [1850, 2480], level: '中立主城', desc: '悬浮在晶歌森林上空的紫罗兰魔法之都。', targetZone: 'dalaran-city' },
                { id: 'icc', name: '冰冠堡垒 (ICC)', en: 'Icecrown Citadel', type: 'raid', faction: 'raid', pos: [2250, 1950], level: '80 (10/25人)', desc: '萨隆邪铁天灾巅峰要塞，巫妖王阿尔萨斯冰封王座。', targetZone: 'icecrown' },
                { id: 'ulduar', name: '奥杜尔', en: 'Ulduar', type: 'raid', faction: 'raid', pos: [2750, 3100], level: '80 (10/25人)', desc: '风暴峭壁泰坦监牢，上古之神尤格-萨隆。' }
            ]
        },

        'pandaria': {
            id: 'pandaria',
            name: '潘达利亚',
            englishName: 'Pandaria',
            era: '5.0 熊猫人之谜',
            description: '潘达利亚迷雾古陆完整无缝拼接图 (5000x3712 超高清)。',
            bounds: [[0, 0], [3712, 5000]],
            center: [1856, 2500],
            minZoom: -2,
            maxZoom: 3,
            initialZoom: -1,
            compositeMapUrl: 'assets/composites/pandaria-composite.jpg',
            overviewMapUrl: 'assets/maps/pandaria.jpg',
            pois: [
                { id: 'vale-poi', name: '锦绣谷 (双月殿/七星殿)', en: 'Vale of Eternal Blossoms', type: 'capital', faction: 'neutral', pos: [2050, 2450], level: '85-90', desc: '潘达利亚魔法圣泉核心。' },
                { id: 'tot', name: '雷电王座', en: 'Throne of Thunder', type: 'raid', faction: 'raid', pos: [3150, 1300], level: '90 (团本)', desc: '雷神岛上魔古皇帝雷神统领的要塞。' }
            ]
        },

        'draenor': {
            id: 'draenor',
            name: '德拉诺',
            englishName: 'Draenor',
            era: '6.0 德拉诺之王',
            description: '未破碎的德拉诺世界完整拼接图 (4500x3340 超高清)。',
            bounds: [[0, 0], [3340, 4500]],
            center: [1670, 2250],
            minZoom: -2,
            maxZoom: 3,
            initialZoom: -1,
            compositeMapUrl: 'assets/composites/draenor-composite.jpg',
            overviewMapUrl: 'assets/composites/draenor-composite.jpg',
            pois: [
                { id: 'karabor', name: '卡拉波神殿', en: 'Temple of Karabor', type: 'capital', faction: 'alliance', pos: [850, 3750], level: '德莱尼圣地', desc: '未被污染的原初宏伟圣殿，先知维纶驻地。' },
                { id: 'blackrock-foundry', name: '黑石铸造厂', en: 'Blackrock Foundry', type: 'raid', faction: 'raid', pos: [2750, 2350], level: '100级 (团本)', desc: '钢铁部落制造灭世战争机械的重型熔炉工厂。' },
                { id: 'highmaul', name: '悬槌堡', en: 'Highmaul', type: 'raid', faction: 'raid', pos: [1750, 600], level: '100级 (团本)', desc: '食人魔皇帝元首马尔高克的要塞。' },
                { id: 'hellfire-citadel-wod', name: '地狱火堡垒', en: 'Hellfire Citadel', type: 'raid', faction: 'raid', pos: [1750, 3150], level: '100级 (团本)', desc: '古尔丹召来燃烧军团阿克蒙德降临。' }
            ]
        },

        'broken-isles': {
            id: 'broken-isles',
            name: '破碎群岛',
            englishName: 'Broken Isles',
            era: '7.0 军团再临',
            description: '破碎群岛完整拼接图 (4500x5750 超高清)。',
            bounds: [[0, 0], [5750, 4500]],
            center: [2875, 2250],
            minZoom: -2,
            maxZoom: 3,
            initialZoom: -1,
            compositeMapUrl: 'assets/composites/broken-isles-composite.jpg',
            overviewMapUrl: 'assets/composites/broken-isles-composite.jpg',
            pois: [
                { id: 'tomb-sargeras', name: '萨格拉斯之墓', en: 'Tomb of Sargeras', type: 'raid', faction: 'raid', pos: [1250, 2750], level: '110级 (团本)', desc: '恶魔传送门核心，基尔加丹与堕落化身。' },
                { id: 'nighthold', name: '暗夜要塞', en: 'The Nighthold', type: 'raid', faction: 'raid', pos: [2650, 2050], level: '110级 (团本)', desc: '苏拉玛暗夜井核心，大魔导师艾利桑德与古尔丹之死。' },
                { id: 'emerald-nightmare', name: '翡翠梦魇', en: 'The Emerald Nightmare', type: 'raid', faction: 'raid', pos: [2950, 1100], level: '110级 (团本)', desc: '萨维斯腐化的世界之树沙达希尔心核。' }
            ]
        },

        // --- 8.0 库尔提拉斯 ---
        'kul-tiras': {
            id: 'kul-tiras',
            name: '库尔提拉斯',
            englishName: 'Kul Tiras',
            era: '8.0 争霸艾泽拉斯',
            description: '库尔提拉斯 4K 官方区域精细拼接大地图 (3840x2560)。德鲁斯瓦、斯托颂谷地、提拉加德海峡高清无缝拼接。点击各区域可加载 4K 详细地区详图。',
            bounds: [[0, 0], [2560, 3840]],
            center: [1280, 1920],
            minZoom: -2,
            maxZoom: 3,
            initialZoom: -1,
            compositeMapUrl: 'assets/composites/kul-tiras-composite.jpg',
            overviewMapUrl: 'assets/maps/kul-tiras.jpg',
            pois: [
                { id: 'boralus-poi', name: '伯拉勒斯 (主城详图)', en: 'Boralus', type: 'capital', faction: 'alliance', pos: [1550, 2350], level: '联盟主城', desc: '库尔提拉斯大舰队母港，吉安娜与凯瑟琳总督王座。点击进入伯拉勒斯内景详图。', targetZone: 'boralus-city' },
                { id: 'tiragarde-poi', name: '提拉加德海峡 (地区详图)', en: 'Tiragarde Sound', type: 'zone-portal', faction: 'alliance', pos: [1400, 2100], level: '110-120级', desc: '自由镇海盗港与狮鹫营地。点击进入 4K 详细地图。', targetZone: 'tiragarde' },
                { id: 'drustvar-poi', name: '德鲁斯瓦 (地区详图)', en: 'Drustvar', type: 'zone-portal', faction: 'alliance', pos: [1100, 1100], level: '110-120级', desc: '阿罗姆之台与维克雷斯庄园女巫古宅。点击进入 4K 详细地图。', targetZone: 'drustvar' },
                { id: 'stormsong-poi', name: '斯托颂谷地 (地区详图)', en: 'Stormsong Valley', type: 'zone-portal', faction: 'alliance', pos: [1950, 2050], level: '110-120级', desc: '风暴海贤造船厂与风暴神殿。点击进入 4K 详细地图。', targetZone: 'stormsong' },
                { id: 'mechagon-poi', name: '麦卡贡岛 (机械侏儒详图)', en: 'Mechagon Island', type: 'zone-portal', faction: 'neutral', pos: [2150, 750], level: '120级 (大秘境)', desc: '机械侏儒地下城与锈栓镇。点击进入 4K 详细地图。', targetZone: 'mechagon' },
                { id: 'nazjatar-poi', name: '纳沙塔尔 (艾萨拉女王海床)', en: 'Nazjatar', type: 'zone-portal', faction: 'neutral', pos: [1280, 3400], level: '120级 (团本)', desc: '艾萨拉永恒王宫沉没大洋海底。点击进入 4K 详细地图。', targetZone: 'nazjatar' }
            ]
        },

        // --- 8.0 赞达拉 ---
        'zandalar': {
            id: 'zandalar',
            name: '赞达拉',
            englishName: 'Zandalar',
            era: '8.0 争霸艾泽拉斯',
            description: '赞达拉 4K 官方区域精细拼接大地图 (3840x2560)。祖达萨、纳兹米尔、沃顿高清无缝拼接。点击各区域可加载 4K 详细地区详图。',
            bounds: [[0, 0], [2560, 3840]],
            center: [1280, 1920],
            minZoom: -2,
            maxZoom: 3,
            initialZoom: -1,
            compositeMapUrl: 'assets/composites/zandalar-composite.jpg',
            overviewMapUrl: 'assets/maps/zandalar.jpg',
            pois: [
                { id: 'dazaralor-poi', name: '达萨罗巨型金字塔', en: 'Dazar\'alor', type: 'capital', faction: 'horde', pos: [1100, 2250], level: '部落主城', desc: '赞达拉巨魔始祖帝国黄金王座与翼手龙平台。', targetZone: 'zuldazar' },
                { id: 'zuldazar-poi', name: '祖达萨 (地区详图)', en: 'Zuldazar', type: 'zone-portal', faction: 'horde', pos: [1150, 2200], level: '110-120级', desc: '赞达拉原初密林、阿塔达萨与诸王之眠。点击进入 4K 详细地图。', targetZone: 'zuldazar' },
                { id: 'nazmir-poi', name: '纳兹米尔 (地区详图)', en: 'Nazmir', type: 'zone-portal', faction: 'horde', pos: [1750, 2300], level: '110-120级', desc: '地渊孢林与泰坦人工古神监牢奥迪尔。点击进入 4K 详细地图。', targetZone: 'nazmir' },
                { id: 'voldun-poi', name: '沃顿沙漠 (地区详图)', en: 'Vol\'dun', type: 'zone-portal', faction: 'horde', pos: [1800, 1200], level: '110-120级', desc: '狐人游牧沙漠与塞塔里斯神庙。点击进入 4K 详细地图。', targetZone: 'voldun' }
            ]
        },

        // --- 9.0 暗影国度 ---
        'shadowlands': {
            id: 'shadowlands',
            name: '暗影界',
            englishName: 'The Shadowlands',
            era: '9.0 暗影国度',
            description: '暗影界 4K 官方区域精细合成大地图 (3840x2560)。四大盟约圣所、噬渊与扎雷殁提斯高清特写无缝融合。点击四大盟约与噬渊各区域可加载 4K 详细地区详图。',
            bounds: [[0, 0], [2560, 3840]],
            center: [1280, 1920],
            minZoom: -2,
            maxZoom: 3,
            initialZoom: -1,
            compositeMapUrl: 'assets/composites/shadowlands-composite.jpg',
            overviewMapUrl: 'assets/maps/shadowlands.jpg',
            pois: [
                { id: 'oribos-poi', name: '奥利波斯 (永恒之城内景详图)', en: 'Oribos', type: 'capital', faction: 'neutral', pos: [1280, 1920], level: '中立审判都城', desc: '暗影界灵魂流转命运之环。点击进入内景详图。', targetZone: 'oribos' },
                { id: 'bastion-poi', name: '晋升堡垒 (格里恩盟约详图)', en: 'Bastion', type: 'zone-portal', faction: 'alliance', pos: [850, 2800], level: '50-60级', desc: '格里恩极乐圣所与晋升高塔。点击进入 4K 详细地图。', targetZone: 'bastion' },
                { id: 'maldraxxus-poi', name: '玛卓克萨斯 (通灵盟约详图)', en: 'Maldraxxus', type: 'zone-portal', faction: 'horde', pos: [1850, 2550], level: '50-60级', desc: '通灵战勋领主、伤逝剧场与兵主王座。点击进入 4K 详细地图。', targetZone: 'maldraxxus' },
                { id: 'ardenweald-poi', name: '炽蓝仙野 (法夜盟约详图)', en: 'Ardenweald', type: 'zone-portal', faction: 'neutral', pos: [850, 1050], level: '50-60级', desc: '冬之女王自然灵境与彼界神殿。点击进入 4K 详细地图。', targetZone: 'ardenweald' },
                { id: 'revendreth-poi', name: '雷文德斯 (温西尔盟约详图)', en: 'Revendreth', center: [1850, 1250], type: 'zone-portal', faction: 'neutral', pos: [1850, 1250], level: '50-60级', desc: '德纳修斯大帝纳斯利亚堡哥特吸血鬼城堡。点击进入 4K 详细地图。', targetZone: 'revendreth' },
                { id: 'the-maw-poi', name: '噬渊 (罪魂之塔详图)', en: 'The Maw', type: 'zone-portal', faction: 'raid', pos: [1280, 1920], level: '满级炼狱', desc: '典狱长统御圣所与托加斯特罪魂之塔。点击进入 4K 详细地图。', targetZone: 'the-maw' },
                { id: 'zereth-mortis-poi', name: '扎雷殁提斯 (初诞者圣墓)', en: 'Zereth Mortis', type: 'zone-portal', faction: 'raid', pos: [1280, 3350], level: '宇宙造物圣殿', desc: '初诞者圣墓终战所在地。点击进入 4K 详细地图。', targetZone: 'zereth-mortis' }
            ]
        },

        // --- 10.0 巨龙时代 ---
        'dragon-isles': {
            id: 'dragon-isles',
            name: '巨龙群岛',
            englishName: 'Dragon Isles',
            era: '10.0 巨龙时代',
            description: '巨龙群岛 4K 官方区域精细拼接大地图 (3840x2560)。觉醒海岸、欧恩哈拉平原、碧蓝林海、索德拉苏斯高清无缝拼接。点击各区域可加载 4K 详细地区详图。',
            bounds: [[0, 0], [2560, 3840]],
            center: [1280, 1920],
            minZoom: -2,
            maxZoom: 3,
            initialZoom: -1,
            compositeMapUrl: 'assets/composites/dragon-isles-composite.jpg',
            overviewMapUrl: 'assets/maps/dragon-isles.jpg',
            pois: [
                { id: 'valdrakken-poi', name: '瓦德拉肯 (五色守护巨龙都城详图)', en: 'Valdrakken', type: 'capital', faction: 'neutral', pos: [1280, 2050], level: '中立巨龙主城', desc: '守护巨龙之座议会大殿。点击进入城内 4K 详图。', targetZone: 'valdrakken' },
                { id: 'waking-shores-poi', name: '觉醒海岸 (地区详图)', en: 'The Waking Shores', type: 'zone-portal', faction: 'neutral', pos: [1850, 2550], level: '60-62级', desc: '红玉新生圣所与化生巨龙牢窟。点击进入 4K 详细地图。', targetZone: 'waking-shores' },
                { id: 'ohnahran-poi', name: '欧恩哈拉平原 (地区详图)', en: 'Ohn\'ahran Plains', type: 'zone-portal', faction: 'neutral', pos: [1100, 1300], level: '62-65级', desc: '半人马大平原与诺库德阻击战。点击进入 4K 详细地图。', targetZone: 'ohnahran-plains' },
                { id: 'azure-span-poi', name: '碧蓝林海 (地区详图)', en: 'The Azure Span', type: 'zone-portal', faction: 'neutral', pos: [650, 1950], level: '65-68级', desc: '蓝龙魔枢松林与碧蓝魔馆。点击进入 4K 详细地图。', targetZone: 'azure-span' },
                { id: 'thaldraszus-poi', name: '索德拉苏斯 (地区详图)', en: 'Thaldraszus', type: 'zone-portal', faction: 'neutral', pos: [1280, 2500], level: '68-70级', desc: '时光合流要塞与艾杰斯亚学院。点击进入 4K 详细地图。', targetZone: 'thaldraszus' },
                { id: 'forbidden-reach-poi', name: '禁忌离岛 (地区详图)', en: 'The Forbidden Reach', type: 'zone-portal', faction: 'neutral', pos: [2100, 3350], level: '龙希尔诞生圣地', desc: '奈萨里奥沉眠要塞。点击进入 4K 详细地图。', targetZone: 'forbidden-reach' }
            ]
        },

        // --- 11.0 地心之战 (最新资料片) ---
        'khaz-algar': {
            id: 'khaz-algar',
            name: '卡兹阿加 (地心之战)',
            englishName: 'Khaz Algar',
            era: '11.0 地心之战 (最新版本)',
            description: '卡兹阿加 4K 官方区域精细合成大地图 (3840x2560)。涵盖多恩岛、多恩诺嘉尔主城内景及深渊空洞入口。点击各区域可加载 4K 详细地区详图。',
            bounds: [[0, 0], [2560, 3840]],
            center: [1280, 1920],
            minZoom: -2,
            maxZoom: 3,
            initialZoom: -1,
            compositeMapUrl: 'assets/composites/khaz-algar-composite.jpg',
            overviewMapUrl: 'assets/maps/khaz-algar.jpg',
            pois: [
                { id: 'dornogal-poi', name: '多恩诺嘉尔 (土灵主城内景详图)', en: 'Dornogal', type: 'capital', faction: 'neutral', pos: [1550, 2250], level: '11.0 主城', desc: '土灵石头建筑大师构筑的地表辉煌大都城。点击进入城内 4K 详图。', targetZone: 'dornogal' },
                { id: 'isle-dorn-poi', name: '多恩岛 (地表领土详图)', en: 'Isle of Dorn', type: 'zone-portal', faction: 'neutral', pos: [1350, 2050], level: '70-73级', desc: '驭雷栖巢与土灵海岸森林。点击进入 4K 详细地图。', targetZone: 'isle-of-dorn' },
                { id: 'ringing-deeps-poi', name: '鸣响深渊 (地心水利详图)', en: 'The Ringing Deeps', type: 'zone-portal', faction: 'neutral', pos: [1100, 1650], level: '73-75级', desc: '矶石宝库与驭水枢纽深渊工坊。点击进入 4K 详细地图。', targetZone: 'ringing-deeps' },
                { id: 'hallowfall-poi', name: '陨圣峪 (圣光大空洞详图)', en: 'Hallowfall', type: 'zone-portal', faction: 'neutral', pos: [850, 2350], level: '75-78级', desc: '悬挂巨大水晶贝雷达尔的圣光空洞，圣焰隐修院与破晓号。点击进入 4K 详细地图。', targetZone: 'hallowfall' },
                { id: 'azj-kahet-poi', name: '艾基-卡赫特 (蛛魔千丝之城详图)', en: 'Azj-Kahet', type: 'zone-portal', faction: 'raid', pos: [600, 1550], level: '78-80级', desc: '蛛魔帝国千丝之城与尼鲁巴尔王宫。点击进入 4K 详细地图。', targetZone: 'azj-kahet' }
            ]
        },

        'azeroth': {
            id: 'azeroth',
            name: '艾泽拉斯全貌',
            englishName: 'Azeroth World',
            era: '世界总览',
            description: '官方原版艾泽拉斯世界全图 (3840x2560)。',
            bounds: [[0, 0], [2560, 3840]],
            center: [1280, 1920],
            minZoom: -2,
            maxZoom: 2,
            initialZoom: -1,
            compositeMapUrl: 'assets/maps/azeroth.jpg',
            overviewMapUrl: 'assets/maps/azeroth.jpg',
            pois: [
                { id: 'az-kalimdor', name: '卡利姆多大陆', en: 'Kalimdor', type: 'continent', faction: 'neutral', pos: [1300, 950], level: '1-85', desc: '西方神秘大陆。点击进入完整大地图。', targetContinent: 'kalimdor' },
                { id: 'az-ek', name: '东部王国', en: 'Eastern Kingdoms', type: 'continent', faction: 'neutral', pos: [1250, 2900], level: '1-85', desc: '东方古老王国。点击进入完整大地图。', targetContinent: 'eastern-kingdoms' },
                { id: 'az-northrend', name: '诺森德大陆', en: 'Northrend', type: 'continent', faction: 'neutral', pos: [1980, 1900], level: '68-80', desc: '极北冰冠大陆。点击进入完整大地图。', targetContinent: 'northrend' },
                { id: 'az-pandaria', name: '潘达利亚大陆', en: 'Pandaria', type: 'continent', faction: 'neutral', pos: [520, 1850], level: '85-90', desc: '迷雾散去的古老南方大陆。点击进入完整大地图。', targetContinent: 'pandaria' },
                { id: 'az-broken-isles', name: '破碎群岛 (7.0)', en: 'Broken Isles', type: 'continent', faction: 'neutral', pos: [1420, 2050], level: '100-110', desc: '军团再临萨格拉斯之墓。点击进入完整大地图。', targetContinent: 'broken-isles' },
                { id: 'az-dragon-isles', name: '巨龙群岛 (10.0)', en: 'Dragon Isles', type: 'continent', faction: 'neutral', pos: [1850, 2550], level: '60-70', desc: '巨龙时代守护巨龙始源故土。点击进入完整大地图。', targetContinent: 'dragon-isles' },
                { id: 'az-kul-tiras', name: '库尔提拉斯 (8.0)', en: 'Kul Tiras', type: 'continent', faction: 'alliance', pos: [1200, 2350], level: '110-120', desc: '争霸艾泽拉斯人类航海帝国。点击进入完整大地图。', targetContinent: 'kul-tiras' },
                { id: 'az-zandalar', name: '赞达拉 (8.0)', en: 'Zandalar', type: 'continent', faction: 'horde', pos: [750, 1650], level: '110-120', desc: '争霸艾泽拉斯巨魔黄金帝国。点击进入完整大地图。', targetContinent: 'zandalar' },
                { id: 'az-khaz-algar', name: '卡兹阿加 (11.0最新)', en: 'Khaz Algar', type: 'continent', faction: 'neutral', pos: [650, 2400], level: '70-80', desc: '地心之战土灵与深渊世界。点击进入完整大地图。', targetContinent: 'khaz-algar' }
            ]
        }
    },

    // 2. High-Resolution In-Game Regional Zone Maps (7.0, 8.0, 9.0, 10.0, 11.0 详细地区详图库)
    zones: {
        // --- 11.0 地心之战 (The War Within 最新版本详细地区地图) ---
        'hallowfall': {
            id: 'hallowfall',
            name: '陨圣峪',
            englishName: 'Hallowfall',
            era: '11.0 地心之战',
            parentContinent: 'khaz-algar',
            bounds: [[0, 0], [2560, 3840]],
            center: [1280, 1920],
            minZoom: -2,
            maxZoom: 3,
            localMapUrl: 'assets/maps/zones/hallowfall.jpg',
            description: '悬挂巨大发光神圣水晶“贝雷达尔”的地底宏伟空洞，阿拉希远征军在此坚守圣光信念。',
            pois: [
                { id: 'priory-flame-z', name: '圣焰隐修院', en: 'Priory of the Sacred Flame', type: 'dungeon', faction: 'dungeon', pos: [1450, 2550], level: '80级地下城', desc: '崇奉贝雷达尔圣焰的大修道院。' },
                { id: 'dawnbreaker-z', name: '破晓号圣光旗舰', en: 'The Dawnbreaker', type: 'dungeon', faction: 'dungeon', pos: [1150, 2150], level: '80级空中战舰', desc: '在幽暗深渊空洞高空对抗蛛魔突袭的圣光主力旗舰。' },
                { id: 'mereldar', name: '米雷达尔 (远征军大本营)', en: 'Mereldar', type: 'capital', faction: 'neutral', pos: [1350, 2050], level: '阿拉希据点', desc: '贝雷达尔水晶光芒照耀下的圣光要塞城镇。' }
            ]
        },

        'ringing-deeps': {
            id: 'ringing-deeps',
            name: '鸣响深渊',
            englishName: 'The Ringing Deeps',
            era: '11.0 地心之战',
            parentContinent: 'khaz-algar',
            bounds: [[0, 0], [2560, 3840]],
            center: [1280, 1920],
            minZoom: -2,
            maxZoom: 3,
            localMapUrl: 'assets/maps/zones/ringing-deeps.jpg',
            description: '土灵开凿的地底巨型工业与水利管道枢纽，泰坦遗留的宏伟机械工程。',
            pois: [
                { id: 'stonevault-z', name: '矶石宝库', en: 'The Stonevault', type: 'dungeon', faction: 'dungeon', pos: [1650, 1950], level: '80级地下城', desc: '失控疯癫的高阶工头霸占的巨大采矿机械深井。' },
                { id: 'gundargaz', name: '冈达加兹 (土灵枢纽营地)', en: 'Gundargaz', type: 'capital', faction: 'neutral', pos: [1300, 2100], level: '深渊要冲', desc: '机巧土灵维护地底大管道与铁轨的前哨重镇。' }
            ]
        },

        'azj-kahet': {
            id: 'azj-kahet',
            name: '艾基-卡赫特',
            englishName: 'Azj-Kahet',
            era: '11.0 地心之战',
            parentContinent: 'khaz-algar',
            bounds: [[0, 0], [2560, 3840]],
            center: [1280, 1920],
            minZoom: -2,
            maxZoom: 3,
            localMapUrl: 'assets/maps/zones/azj-kahet.jpg',
            description: '黑暗地底古老而繁华的蛛魔帝国首都，千丝万缕的深渊暗影王都。',
            pois: [
                { id: 'nerubar-z', name: '尼鲁巴尔王宫', en: 'Nerub-ar Palace', type: 'raid', faction: 'raid', pos: [1100, 2200], level: '80级 (11.0团本)', desc: '萨拉塔斯指使安苏雷克女王变异升级黑血的巅峰要塞。' },
                { id: 'ara-kara-z', name: '艾拉-卡拉 (回响之城)', en: 'Ara-Kara', type: 'dungeon', faction: 'dungeon', pos: [1450, 2350], level: '80级地下城', desc: '蛛魔古城残骸与毒丝实验室。' },
                { id: 'city-threads-z', name: '千丝之城', en: 'City of Threads', type: 'dungeon', faction: 'dungeon', pos: [1250, 1750], level: '80级地下城', desc: '蛛魔大贵族勾心斗角刺杀的核心街区。' }
            ]
        },

        'dornogal': {
            id: 'dornogal',
            name: '多恩诺嘉尔 (都城详图)',
            englishName: 'Dornogal City',
            era: '11.0 地心之战',
            parentContinent: 'khaz-algar',
            bounds: [[0, 0], [2560, 3840]],
            center: [1280, 1920],
            minZoom: -2,
            maxZoom: 3,
            localMapUrl: 'assets/maps/zones/dornogal-city.jpg',
            description: '土灵巨构石头大师建造的宏伟地表主城，包含理事大殿、工艺区与核心要冲。',
            pois: [
                { id: 'council-ascent', name: '理事之升 (最高会议)', en: 'Foundation Hall', type: 'capital', faction: 'neutral', pos: [1350, 2150], level: '政治核心', desc: '保民官与机巧土灵四阶理事会会议厅。' },
                { id: 'rampart-way', name: '多恩城门高墙', en: 'The Coreway', type: 'capital', faction: 'neutral', pos: [1150, 1850], level: '地心大通道', desc: '穿通地表直通地心鸣响深渊与陨圣峪的巨型垂直通道。' }
            ]
        },

        'isle-of-dorn': {
            id: 'isle-of-dorn',
            name: '多恩岛',
            englishName: 'Isle of Dorn',
            era: '11.0 地心之战',
            parentContinent: 'khaz-algar',
            bounds: [[0, 0], [2560, 3840]],
            center: [1280, 1920],
            minZoom: -2,
            maxZoom: 3,
            localMapUrl: 'assets/maps/zones/isle-of-dorn.jpg',
            description: '耸立在海面之上的翠绿高地，土灵驭雷兽栖息之所。',
            pois: [
                { id: 'rookery-z', name: '驭雷栖巢', en: 'The Rookery', type: 'dungeon', faction: 'dungeon', pos: [1450, 2600], level: '70-72级', desc: '狂风肆虐的高原孵化飞禽圣地。' },
                { id: 'dal-oaz', name: '达尔奥兹村', en: 'Dhar Ozar', type: 'landmark', faction: 'neutral', pos: [1200, 1800], level: '土灵农耕村', desc: '种植奇异发光根茎作物的宁静村落。' }
            ]
        },

        // --- 10.0 巨龙时代 (Dragonflight 详细地区地图) ---
        'valdrakken': {
            id: 'valdrakken',
            name: '瓦德拉肯 (五色巨龙主城详图)',
            englishName: 'Valdrakken',
            era: '10.0 巨龙时代',
            parentContinent: 'dragon-isles',
            bounds: [[0, 0], [2560, 3840]],
            center: [1280, 1920],
            minZoom: -2,
            maxZoom: 3,
            localMapUrl: 'assets/maps/zones/valdrakken.jpg',
            description: '五色守护巨龙齐聚的万年璀璨都城，守护巨龙之座与驭龙竞速起飞点。',
            pois: [
                { id: 'aspect-seat-z', name: '守护巨龙之座', en: 'Seat of the Aspects', type: 'capital', faction: 'neutral', pos: [1450, 1950], level: '巨龙议政厅', desc: '阿莱克斯塔萨、卡雷苟斯、诺兹多姆与拉希奥集聚的高台。' },
                { id: 'rostrum-trans', name: '驭龙术变身圣坛', en: 'Rostrum of Transformation', type: 'capital', faction: 'neutral', pos: [1250, 2150], level: '巨龙定制', desc: '自定义巨龙坐骑外观与鳞片颜色的圣坛。' }
            ]
        },

        'waking-shores': {
            id: 'waking-shores',
            name: '觉醒海岸',
            englishName: 'The Waking Shores',
            era: '10.0 巨龙时代',
            parentContinent: 'dragon-isles',
            bounds: [[0, 0], [2560, 3840]],
            center: [1280, 1920],
            minZoom: -2,
            maxZoom: 3,
            localMapUrl: 'assets/maps/zones/waking-shores.jpg',
            description: '五色巨龙重返巨龙群岛的第一站，熔岩翻滚与红玉圣泉交织之地。',
            pois: [
                { id: 'ruby-pools-z', name: '红玉新生池', en: 'Ruby Life Pools', type: 'dungeon', faction: 'dungeon', pos: [1550, 2350], level: '60-63级', desc: '生命誓缚者阿莱克斯塔萨守护的纯净龙蛋池。' },
                { id: 'neltharus-z', name: '奈萨鲁斯 (黑龙军工厂)', en: 'Neltharus', type: 'dungeon', faction: 'dungeon', pos: [1750, 2550], level: '70级地下城', desc: '查拉拉克贾拉丁巨人霸占的黑龙熔岩要塞。' },
                { id: 'vault-inc-z', name: '化生巨龙牢窟 (莱萨杰丝)', en: 'Vault of the Incarnates', type: 'raid', faction: 'raid', pos: [1150, 2800], level: '70级 (10.0团本)', desc: '始祖暴风龙王破封而出的大决战。' }
            ]
        },

        'azure-span': {
            id: 'azure-span',
            name: '碧蓝林海',
            englishName: 'The Azure Span',
            era: '10.0 巨龙时代',
            parentContinent: 'dragon-isles',
            bounds: [[0, 0], [2560, 3840]],
            center: [1280, 1920],
            minZoom: -2,
            maxZoom: 3,
            localMapUrl: 'assets/maps/zones/azure-span.jpg',
            description: '艾泽拉斯最高的红杉与蓝龙古老魔枢高塔，冰雪与温带森林并存。',
            pois: [
                { id: 'azure-vault-z', name: '碧蓝魔馆', en: 'The Azure Vault', type: 'dungeon', faction: 'dungeon', pos: [1450, 2150], level: '65-68级', desc: '玛里苟斯珍藏无尽奥术实验知识的晶石高塔。' },
                { id: 'brackenhide-z', name: '蕨皮山谷', en: 'Brackenhide Hollow', type: 'dungeon', faction: 'dungeon', pos: [1200, 1550], level: '70级地下城', desc: '腐朽巫毒豺狼人的危险烂泥部落。' }
            ]
        },

        'thaldraszus': {
            id: 'thaldraszus',
            name: '索德拉苏斯',
            englishName: 'Thaldraszus',
            era: '10.0 巨龙时代',
            parentContinent: 'dragon-isles',
            bounds: [[0, 0], [2560, 3840]],
            center: [1280, 1920],
            minZoom: -2,
            maxZoom: 3,
            localMapUrl: 'assets/maps/zones/thaldraszus.jpg',
            description: '泰坦秩序守护者与时光青铜龙执掌的巍峨崇山，瓦德拉肯所在地。',
            pois: [
                { id: 'infusion-z', name: '注能大厅', en: 'Halls of Infusion', type: 'dungeon', faction: 'dungeon', pos: [1300, 2450], level: '70级地下城', desc: '泰坦守护者提尔建造的抽取活水注能的泰坦设施。' },
                { id: 'algethar-z', name: '艾杰斯亚学院', en: 'Algeth\'ar Academy', type: 'dungeon', faction: 'dungeon', pos: [1650, 2250], level: '70级地下城', desc: '幼龙与古代龙类研究学术的魔法学府。' }
            ]
        },

        'ohnahran-plains': {
            id: 'ohnahran-plains',
            name: '欧恩哈拉平原',
            englishName: 'Ohn\'ahran Plains',
            era: '10.0 巨龙时代',
            parentContinent: 'dragon-isles',
            bounds: [[0, 0], [2560, 3840]],
            center: [1280, 1920],
            minZoom: -2,
            maxZoom: 3,
            localMapUrl: 'assets/maps/zones/ohnahran-plains.jpg',
            description: '半人马部族自由驰骋的广袤平原，风之神灵欧恩哈拉守护的圣地。',
            pois: [
                { id: 'nokhud-z', name: '诺库德阻击战', en: 'The Nokhud Offensive', type: 'dungeon', faction: 'dungeon', pos: [1450, 2150], level: '70级地下城', desc: '叛变半人马部族席卷大平原的决战。' },
                { id: 'maruukai', name: '马鲁凯 (半人马大营)', en: 'Maruukai', type: 'capital', faction: 'neutral', pos: [1250, 1850], level: '马鲁克部族', desc: '四大半人马氏族举行大会的核心大营。' }
            ]
        },

        'forbidden-reach': {
            id: 'forbidden-reach',
            name: '禁忌离岛',
            englishName: 'The Forbidden Reach',
            era: '10.0 巨龙时代',
            parentContinent: 'dragon-isles',
            bounds: [[0, 0], [2560, 3840]],
            center: [1280, 1920],
            minZoom: -2,
            maxZoom: 3,
            localMapUrl: 'assets/maps/zones/forbidden-reach.jpg',
            description: '大地守护者奈萨里奥曾用来训练终极战士的隐秘离岛，龙希尔苏醒之地。',
            pois: [
                { id: 'zskera-vaults', name: '仄斯克拉宝库', en: 'Zskera Vaults', type: 'landmark', faction: 'neutral', pos: [1350, 2050], level: '探索宝库', desc: '奈萨里奥封存无数泰坦黑科技造物的宝库。' }
            ]
        },

        // --- 9.0 暗影国度 (Shadowlands 详细地区地图) ---
        'bastion': {
            id: 'bastion',
            name: '晋升堡垒',
            englishName: 'Bastion',
            era: '9.0 暗影国度',
            parentContinent: 'shadowlands',
            bounds: [[0, 0], [2560, 3840]],
            center: [1280, 1920],
            minZoom: -2,
            maxZoom: 3,
            localMapUrl: 'assets/maps/zones/bastion.jpg',
            description: '格里恩盟约长眠圣地，蔚蓝晴空与金色殿堂，灵魂引渡者的极乐故土。',
            pois: [
                { id: 'spires-asc-z', name: '晋升高塔', en: 'Spires of Ascension', type: 'dungeon', faction: 'dungeon', pos: [1650, 2450], level: '60级地下城', desc: '德沃斯弃誓者叛乱冲击长空执政官圣殿。' },
                { id: 'elysian-hold', name: '极乐堡 (格里恩圣所)', en: 'Elysian Hold', type: 'capital', faction: 'alliance', pos: [1250, 1950], level: '盟约大本营', desc: '晋升堡垒执政官阿格斯蒂亚圣座。' }
            ]
        },

        'revendreth': {
            id: 'revendreth',
            name: '雷文德斯',
            englishName: 'Revendreth',
            era: '9.0 暗影国度',
            parentContinent: 'shadowlands',
            bounds: [[0, 0], [2560, 3840]],
            center: [1280, 1920],
            minZoom: -2,
            maxZoom: 3,
            localMapUrl: 'assets/maps/zones/revendreth.jpg',
            description: '温西尔赎罪国度，暗红暮光、哥特式尖顶大教堂与无尽的赎罪仪式。',
            pois: [
                { id: 'castle-nathria-z', name: '纳斯利亚堡 (德纳修斯大帝)', en: 'Castle Nathria', type: 'raid', faction: 'raid', pos: [1450, 1950], level: '60级 (9.0团本)', desc: '德纳修斯大帝秘密将心能输送至噬渊的哥特宏伟城堡。' },
                { id: 'halls-atonement-z', name: '赎罪大厅', en: 'Halls of Atonement', type: 'dungeon', faction: 'dungeon', pos: [1750, 2450], level: '60级地下城', desc: '石像鬼与贪婪温西尔榨取灵魂心能的大殿。' }
            ]
        },

        'maldraxxus': {
            id: 'maldraxxus',
            name: '玛卓克萨斯',
            englishName: 'Maldraxxus',
            era: '9.0 暗影国度',
            parentContinent: 'shadowlands',
            bounds: [[0, 0], [2560, 3840]],
            center: [1280, 1920],
            minZoom: -2,
            maxZoom: 3,
            localMapUrl: 'assets/maps/zones/maldraxxus.jpg',
            description: '通灵领主不死军团的大本营，死灵法术与白骨要塞。',
            pois: [
                { id: 'theater-pain-z', name: '伤逝剧场', en: 'Theater of Pain', type: 'dungeon', faction: 'dungeon', pos: [1350, 2050], level: '60级地下城', desc: '亡灵角斗士决出胜负的残暴生死决斗场。' },
                { id: 'plaguefall-z', name: '凋魂之殇', en: 'Plaguefall', type: 'dungeon', faction: 'dungeon', pos: [1650, 1750], level: '60级地下城', desc: '凋零密院制造毁灭瘟疫软泥怪的毒水池。' }
            ]
        },

        'ardenweald': {
            id: 'ardenweald',
            name: '炽蓝仙野',
            englishName: 'Ardenweald',
            era: '9.0 暗影国度',
            parentContinent: 'shadowlands',
            bounds: [[0, 0], [2560, 3840]],
            center: [1280, 1920],
            minZoom: -2,
            maxZoom: 3,
            localMapUrl: 'assets/maps/zones/ardenweald.jpg',
            description: '冬之女王执掌的永恒星夜森林，自然半神沉睡与重生的梦境仙所。',
            pois: [
                { id: 'de-other-side-z', name: '彼界 (死神邦桑迪神殿)', en: 'De Other Side', type: 'dungeon', faction: 'dungeon', pos: [1150, 2350], level: '60级地下城', desc: '死神邦桑迪藏匿洛阿灵魂的秘密彼岸世界。' },
                { id: 'heart-forest', name: '森林之心 (法夜圣所)', en: 'Heart of the Forest', type: 'capital', faction: 'neutral', pos: [1350, 1950], level: '盟约大本营', desc: '冬之女王古树王座。' }
            ]
        },

        'oribos': {
            id: 'oribos',
            name: '奥利波斯 (永恒之城内景详图)',
            englishName: 'Oribos City',
            era: '9.0 暗影国度',
            parentContinent: 'shadowlands',
            bounds: [[0, 0], [668, 1002]],
            center: [334, 501],
            minZoom: -1,
            maxZoom: 3,
            localMapUrl: 'assets/maps/zones/oribos-main.jpg',
            description: '暗影界所有亡者灵魂的中转枢纽，仲裁官注视下的命运之环与转移之环。',
            pois: [
                { id: 'ring-fates', name: '命运之环 (主厅)', en: 'Ring of Fates', type: 'capital', faction: 'neutral', pos: [334, 501], level: '枢纽大厅', desc: '四大盟约代表与冒险者汇聚的圆环都城。' }
            ]
        },

        'the-maw': {
            id: 'the-maw',
            name: '噬渊',
            englishName: 'The Maw',
            era: '9.0 暗影国度',
            parentContinent: 'shadowlands',
            bounds: [[0, 0], [2560, 3840]],
            center: [1280, 1920],
            minZoom: -2,
            maxZoom: 3,
            localMapUrl: 'assets/maps/zones/the-maw.jpg',
            description: '最邪恶堕落灵魂遭受永恒惩戒的无光炼狱，典狱长的禁锢地牢。',
            pois: [
                { id: 'torghast-z', name: '托加斯特 (罪魂之塔)', en: 'Torghast, Tower of the Damned', type: 'dungeon', faction: 'raid', pos: [1450, 1950], level: '无尽爬塔', desc: '典狱长关押艾泽拉斯领袖灵魂的万劫高塔。' },
                { id: 'sanctum-dom-z', name: '统御圣所', en: 'Sanctum of Domination', type: 'raid', faction: 'raid', pos: [1650, 2450], level: '60级 (9.1团本)', desc: '直面希尔瓦娜斯·风行者与典狱长军团。' }
            ]
        },

        'zereth-mortis': {
            id: 'zereth-mortis',
            name: '扎雷殁提斯',
            englishName: 'Zereth Mortis',
            era: '9.0 暗影国度',
            parentContinent: 'shadowlands',
            bounds: [[0, 0], [2560, 3840]],
            center: [1280, 1920],
            minZoom: -2,
            maxZoom: 3,
            localMapUrl: 'assets/maps/zones/zereth-mortis.jpg',
            description: '初诞者构筑生死宇宙规则与来世模型的原初造物工坊。',
            pois: [
                { id: 'sepulcher-z', name: '初诞者圣墓', en: 'Sepulcher of the First Ones', type: 'raid', faction: 'raid', pos: [1350, 2650], level: '60级 (9.2终战团本)', desc: '典狱长企图重塑宇宙法则的最终战场。' }
            ]
        },

        // --- 8.0 库尔提拉斯与赞达拉 (Battle for Azeroth 详细地区地图) ---
        'boralus-city': {
            id: 'boralus-city',
            name: '伯拉勒斯 (都城内景详图)',
            englishName: 'City of Boralus',
            era: '8.0 争霸艾泽拉斯',
            parentContinent: 'kul-tiras',
            bounds: [[0, 0], [2560, 3840]],
            center: [1280, 1920],
            minZoom: -2,
            maxZoom: 3,
            localMapUrl: 'assets/maps/zones/boralus-city.jpg',
            description: '人类航海大帝国首都内部高清图，包含汇帆市场、风港水手酒馆与普罗德摩尔要塞。',
            pois: [
                { id: 'proudmoore-keep', name: '普罗德摩尔要塞', en: 'Proudmoore Keep', type: 'capital', faction: 'alliance', pos: [1550, 2050], level: '至高权力', desc: '吉安娜与凯瑟琳·普罗德摩尔坐镇的海滨城堡。' },
                { id: 'siege-boralus-z', name: '围攻伯拉勒斯大门', en: 'Siege of Boralus', type: 'dungeon', faction: 'dungeon', pos: [1250, 2250], level: '120级地下城', desc: '艾什凡叛徒与海怪围攻运河港口的决战。' }
            ]
        },

        'tiragarde': {
            id: 'tiragarde',
            name: '提拉加德海峡',
            englishName: 'Tiragarde Sound',
            era: '8.0 争霸艾泽拉斯',
            parentContinent: 'kul-tiras',
            bounds: [[0, 0], [2560, 3840]],
            center: [1280, 1920],
            minZoom: -2,
            maxZoom: 3,
            localMapUrl: 'assets/maps/zones/tiragarde.jpg',
            description: '库尔提拉斯中央海湾，伯拉勒斯母港与自由镇海盗聚集区。',
            pois: [
                { id: 'freehold-z', name: '自由镇', en: 'Freehold', type: 'dungeon', faction: 'dungeon', pos: [1150, 2650], level: '120级地下城', desc: '铁潮海盗团狂欢的港口城镇。' }
            ]
        },

        'drustvar': {
            id: 'drustvar',
            name: '德鲁斯瓦',
            englishName: 'Drustvar',
            era: '8.0 争霸艾泽拉斯',
            parentContinent: 'kul-tiras',
            bounds: [[0, 0], [2560, 3840]],
            center: [1280, 1920],
            minZoom: -2,
            maxZoom: 3,
            localMapUrl: 'assets/maps/zones/drustvar.jpg',
            description: '终年冰雪覆盖的高山与黑魔法蔓延的古老雪峰森林。',
            pois: [
                { id: 'waycrest-z', name: '维克雷斯庄园', en: 'Waycrest Manor', type: 'dungeon', faction: 'dungeon', pos: [1450, 1650], level: '120级地下城', desc: '女巫集会与扭曲荆棘怪物横行的古宅。' }
            ]
        },

        'zuldazar': {
            id: 'zuldazar',
            name: '祖达萨',
            englishName: 'Zuldazar',
            era: '8.0 争霸艾泽拉斯',
            parentContinent: 'zandalar',
            bounds: [[0, 0], [2560, 3840]],
            center: [1280, 1920],
            minZoom: -2,
            maxZoom: 3,
            localMapUrl: 'assets/maps/zones/zuldazar.jpg',
            description: '赞达拉巨魔黄金帝国始祖雨林，达萨罗巨大金字塔耸立核心。',
            pois: [
                { id: 'atal-dazar-z', name: '阿塔达萨', en: 'Atal\'Dazar', type: 'dungeon', faction: 'dungeon', pos: [1650, 1850], level: '120级地下城', desc: '崇山金顶赞达拉先王黄金神庙。' },
                { id: 'kings-rest-z', name: '诸王之眠', en: 'Kings\' Rest', type: 'dungeon', faction: 'dungeon', pos: [1750, 1750], level: '120级大秘境', desc: '神王达萨始祖黄金灵寝禁地。' }
            ]
        },

        'nazmir': {
            id: 'nazmir',
            name: '纳兹米尔',
            englishName: 'Nazmir',
            era: '8.0 争霸艾泽拉斯',
            parentContinent: 'zandalar',
            bounds: [[0, 0], [2560, 3840]],
            center: [1280, 1920],
            minZoom: -2,
            maxZoom: 3,
            localMapUrl: 'assets/maps/zones/nazmir.jpg',
            description: '鲜血巨魔与腐化暗影笼罩的剧毒泥沼，古神封印核心。',
            pois: [
                { id: 'uldir-z', name: '奥迪尔 (泰坦封印)', en: 'Uldir', type: 'raid', faction: 'raid', pos: [1450, 2250], level: '120级 (8.0团本)', desc: '第五古神戈霍恩腐蚀源泉。' },
                { id: 'underrot-z', name: '地渊孢林', en: 'The Underrot', type: 'dungeon', faction: 'dungeon', pos: [1550, 2150], level: '120级地下城', desc: '纳兹米尔地下血肉腐化母体。' }
            ]
        },

        'voldun': {
            id: 'voldun',
            name: '沃顿',
            englishName: 'Vol\'dun',
            era: '8.0 争霸艾泽拉斯',
            parentContinent: 'zandalar',
            bounds: [[0, 0], [2560, 3840]],
            center: [1280, 1920],
            minZoom: -2,
            maxZoom: 3,
            localMapUrl: 'assets/maps/zones/voldun.jpg',
            description: '曾经繁荣的原野如今化为烈日黄沙，狐人与蛇人无信者角逐的荒漠。',
            pois: [
                { id: 'sethriss-temple', name: '塞塔里斯神庙', en: 'Temple of Sethraliss', type: 'dungeon', faction: 'dungeon', pos: [1550, 2150], level: '120级地下城', desc: '洛阿雷霆巨蛇塞塔里斯沉睡的长眠神庙。' }
            ]
        },

        'stormsong': {
            id: 'stormsong',
            name: '斯托颂谷地',
            englishName: 'Stormsong Valley',
            era: '8.0 争霸艾泽拉斯',
            parentContinent: 'kul-tiras',
            bounds: [[0, 0], [2560, 3840]],
            center: [1280, 1920],
            minZoom: -2,
            maxZoom: 3,
            localMapUrl: 'assets/maps/zones/stormsong.jpg',
            description: '水草丰美的绿色丘陵与风暴海贤造船大港，但暗影低语已渗入神殿。',
            pois: [
                { id: 'shrine-storm-z', name: '风暴神殿', en: 'Shrine of the Storm', type: 'dungeon', faction: 'dungeon', pos: [1850, 2450], level: '120级地下城', desc: '风暴海贤被古神恩佐斯虚空腐化的海边圣殿。' }
            ]
        },

        'mechagon': {
            id: 'mechagon',
            name: '麦卡贡岛',
            englishName: 'Mechagon Island',
            era: '8.0 争霸艾泽拉斯',
            parentContinent: 'kul-tiras',
            bounds: [[0, 0], [2560, 3840]],
            center: [1280, 1920],
            minZoom: -2,
            maxZoom: 3,
            localMapUrl: 'assets/maps/zones/mechagon.jpg',
            description: '机械侏儒隐秘的齿轮科技岛，麦卡贡国王在此推行全机械化改造。',
            pois: [
                { id: 'operation-mechagon', name: '麦卡贡行动 (狂欢要塞)', en: 'Operation: Mechagon', type: 'dungeon', faction: 'dungeon', pos: [1350, 2050], level: '120级大秘境', desc: '阻止麦卡贡国王净化光束机械化艾泽拉斯生灵。' }
            ]
        },

        'nazjatar': {
            id: 'nazjatar',
            name: '纳沙塔尔',
            englishName: 'Nazjatar',
            era: '8.0 争霸艾泽拉斯',
            parentContinent: 'kul-tiras',
            bounds: [[0, 0], [2560, 3840]],
            center: [1280, 1920],
            minZoom: -2,
            maxZoom: 3,
            localMapUrl: 'assets/maps/zones/nazjatar.jpg',
            description: '娜迦女王艾萨拉将大洋分开露出的海底深渊帝国，永恒王宫所在地。',
            pois: [
                { id: 'eternal-palace-z', name: '永恒王宫 (艾萨拉女王)', en: 'The Eternal Palace', type: 'raid', faction: 'raid', pos: [1450, 2350], level: '120级 (8.2团本)', desc: '娜迦一万年统治的心脏要塞，恩佐斯封印解开之地。' }
            ]
        },

        // --- 1.0 - 5.0 经典区域保留 ---
        'elwynn': {
            id: 'elwynn',
            name: '艾尔文森林',
            englishName: 'Elwynn Forest',
            parentContinent: 'eastern-kingdoms',
            bounds: [[0, 0], [668, 1002]],
            center: [334, 501],
            minZoom: -1,
            maxZoom: 3,
            localMapUrl: 'assets/maps/zones/elwynn.jpg',
            description: '人类新手起始区域，闪金镇与北郡修道院所在地。',
            pois: [
                { id: 'northshire', name: '北郡修道院', en: 'Northshire Abbey', type: 'landmark', faction: 'alliance', pos: [510, 480], level: '1-5级', desc: '人类冒险者最初苏醒受训的圣光修道院。' },
                { id: 'goldshire', name: '闪金镇', en: 'Goldshire', type: 'capital', faction: 'alliance', pos: [360, 425], level: '狮王之傲旅店', desc: '艾泽拉斯最具传奇色彩的城镇。' }
            ]
        },

        'stormwind-city': {
            id: 'stormwind-city',
            name: '暴风城 (都城详图)',
            englishName: 'Stormwind City',
            parentContinent: 'eastern-kingdoms',
            bounds: [[0, 0], [668, 1002]],
            center: [334, 501],
            minZoom: -1,
            maxZoom: 3,
            localMapUrl: 'assets/maps/zones/stormwind-city.jpg',
            description: '人类王国雄伟的都城内部详细平面图。',
            pois: [
                { id: 'sw-trade', name: '贸易区', en: 'Trade District', type: 'capital', faction: 'alliance', pos: [310, 540], level: '商业核心', desc: '银行与拍卖行所在地。' }
            ]
        },

        'durotar': {
            id: 'durotar',
            name: '杜隆塔尔',
            englishName: 'Durotar',
            parentContinent: 'kalimdor',
            bounds: [[0, 0], [668, 1002]],
            center: [334, 501],
            minZoom: -1,
            maxZoom: 3,
            localMapUrl: 'assets/maps/zones/durotar.jpg',
            description: '兽人与暗矛巨魔赤红红岩家园，试炼谷与剃刀岭。',
            pois: [
                { id: 'trials', name: '试炼谷', en: 'Valley of Trials', type: 'landmark', faction: 'horde', pos: [220, 440], level: '1-5级', desc: '兽人与巨魔新兵受训磨砺之地。' }
            ]
        },

        'icecrown': {
            id: 'icecrown',
            name: '冰冠冰川',
            englishName: 'Icecrown',
            parentContinent: 'northrend',
            bounds: [[0, 0], [668, 1002]],
            center: [334, 501],
            minZoom: -1,
            maxZoom: 3,
            localMapUrl: 'assets/maps/zones/icecrown.jpg',
            description: '萨隆邪铁天灾巅峰要塞，巫妖王阿尔萨斯冰封王座。',
            pois: [
                { id: 'icc-zone-z', name: '冰冠堡垒 (ICC)', en: 'Icecrown Citadel', type: 'raid', faction: 'raid', pos: [220, 520], level: '80 (10/25人)', desc: '冰封王座之门。' }
            ]
        }
    },

    poiCategories: {
        'all': { label: '全部显示', icon: '🌐' },
        'capital': { label: '都城/要塞', icon: '🏰', color: '#ffd100' },
        'zone-portal': { label: '地区详图', icon: '🗺️', color: '#00ffcc' },
        'raid': { label: '团队副本', icon: '💀', color: '#ff3b30' },
        'dungeon': { label: '地下城', icon: '🛡️', color: '#ff9500' },
        'landmark': { label: '名胜圣所', icon: '⭐', color: '#5ac8fa' },
        'flight': { label: '交通/港口', icon: '🦅', color: '#34c759' },
        'continent': { label: '大陆通道', icon: '🌀', color: '#af52de' }
    },

    factions: {
        alliance: {
            name: '联盟',
            color: '#0078ff',
            badgeBg: 'linear-gradient(135deg, #002244 0%, #0078ff 100%)',
            icon: '🛡️'
        },
        horde: {
            name: '部落',
            color: '#c41e3a',
            badgeBg: 'linear-gradient(135deg, #440000 0%, #c41e3a 100%)',
            icon: '🪓'
        },
        neutral: {
            name: '中立',
            color: '#f8b700',
            badgeBg: 'linear-gradient(135deg, #2b2310 0%, #c89b3c 100%)',
            icon: '⚖️'
        },
        raid: {
            name: '大型团本',
            color: '#e63946',
            badgeBg: 'linear-gradient(135deg, #330000 0%, #a80c0c 100%)',
            icon: '💀'
        },
        dungeon: {
            name: '地下城',
            color: '#d4af37',
            badgeBg: 'linear-gradient(135deg, #222222 0%, #886b1b 100%)',
            icon: '🏰'
        }
    }
};

window.WOW_MAP_DATA = WOW_MAP_DATA;
