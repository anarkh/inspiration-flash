import type { DerivedStats, DungeonId, EquipmentId, ItemId, MethodId, PetId } from './game';
import type { EquipmentSetTag } from './equipment-system';
import type { PetPassiveTag } from './pet-system';

export type DungeonEventRisk = 'low' | 'medium' | 'high';

export type DungeonEventRequirement =
  | { type: 'none'; description: string }
  | { type: 'method'; methodId: MethodId; description: string }
  | { type: 'equipment'; equipmentId: EquipmentId; description: string }
  | { type: 'equipmentSet'; setTag: EquipmentSetTag; description: string }
  | { type: 'petPassive'; passiveTag: PetPassiveTag; description: string }
  | { type: 'pet'; petId: PetId; description: string }
  | { type: 'item'; itemId: ItemId; count: number; description: string }
  | { type: 'stat'; stat: keyof DerivedStats; min: number; description: string };

export type DungeonEventOutcome = {
  success: boolean;
  rewardPoints?: number;
  lingyun?: number;
  items?: Partial<Record<ItemId, number>>;
  damage?: number;
  temporaryLog: string;
};

export type DungeonEventOption = {
  id: string;
  label: string;
  description: string;
  risk: DungeonEventRisk;
  requirements: DungeonEventRequirement[];
  outcome: DungeonEventOutcome;
  failureOutcome?: DungeonEventOutcome;
};

export type DungeonEvent = {
  id: string;
  dungeonId: DungeonId;
  nodeId: string;
  title: string;
  description: string;
  options: DungeonEventOption[];
};

export type DungeonEventContext = {
  learnedMethods: readonly MethodId[];
  ownedEquipment: readonly EquipmentId[];
  equipped: readonly EquipmentId[];
  activeEquipmentSetTags?: readonly EquipmentSetTag[];
  ownedPets: readonly PetId[];
  activePetPassiveTags: readonly PetPassiveTag[];
  inventory: Partial<Record<ItemId, number>>;
  stats: DerivedStats;
};

export type EvaluatedDungeonEventOption = DungeonEventOption & {
  available: boolean;
  unmetRequirements: DungeonEventRequirement[];
};

const sharedFailure = (temporaryLog: string, damage: number): DungeonEventOutcome => ({
  success: false,
  damage,
  temporaryLog
});

const DUNGEON_EVENTS: Record<DungeonId, DungeonEvent[]> = {
  demon_tower_1: [
    {
      id: 'blood_rune_stair',
      dungeonId: 'demon_tower_1',
      nodeId: 'blood_rune_trap',
      title: '血字阶梯的呼吸',
      description: '妖塔把每一步都刻成血字，急着冲上去会让雾反咬气脉。',
      options: [
        {
          id: 'breathe_through_runes',
          label: '按吐纳节奏踩字',
          description: '用吐纳诀把血字当成呼吸拍点，慢但能拆掉雾里的暗格。',
          risk: 'low',
          requirements: [{ type: 'method', methodId: 'mist_breathing', description: '学会吐纳诀' }],
          outcome: {
            success: true,
            rewardPoints: 180,
            lingyun: 1,
            items: { hidden_stone: 1 },
            temporaryLog: '吐纳诀压住血字阶梯，雾后石从暗格里松动。'
          },
          failureOutcome: sharedFailure('没有吐纳节奏，血字反灌气脉，只能硬吃一段雾蚀。', 18)
        },
        {
          id: 'send_pet_first',
          label: '让灵宠先探阶',
          description: '让擅长嗅陷阱的灵宠贴地前行，换取更快通过。',
          risk: 'medium',
          requirements: [{ type: 'petPassive', passiveTag: 'trap_scout', description: '激活陷阱侦测灵宠' }],
          outcome: {
            success: true,
            rewardPoints: 120,
            items: { demon_bone: 1 },
            temporaryLog: '灵宠提前嗅出血字断点，你顺手折下一截妖骨阵钉。'
          },
          failureOutcome: sharedFailure('没有陷阱侦测的灵宠，血字阶梯误判为安全路线。', 20)
        }
      ]
    },
    {
      id: 'mist_sealed_cache',
      dungeonId: 'demon_tower_1',
      nodeId: 'sealed_cache',
      title: '雾后暗格的第二层',
      description: '石缝随呼吸开合，浅层药灰触手可及，更深处的阵石却会引来整面雾墙。',
      options: [
        {
          id: 'match_cache_breath',
          label: '按吐纳节奏取药灰',
          description: '跟随暗格开合缓慢取物，不惊动深处的妖雾。',
          risk: 'low',
          requirements: [{ type: 'method', methodId: 'mist_breathing', description: '学会吐纳诀' }],
          outcome: {
            success: true,
            rewardPoints: 150,
            items: { medicine_ash: 1 },
            temporaryLog: '吐纳节奏与石缝重合，你稳稳取出一包未受潮的药灰。'
          },
          failureOutcome: sharedFailure('呼吸乱了半拍，暗格合拢时喷出一股蚀骨妖雾。', 16)
        },
        {
          id: 'probe_deep_mist_seam',
          label: '追踪雾流撬开深层',
          description: '凭陷阱感知追到活动石缝，带伤抢出更稀有的阵石。',
          risk: 'high',
          requirements: [{ type: 'stat', stat: 'trapCheck', min: 9, description: '陷阱感知至少 9' }],
          outcome: {
            success: true,
            rewardPoints: 260,
            items: { hidden_stone: 1 },
            damage: 10,
            temporaryLog: '你顶着合拢的石缝扯出隐藏石，手臂也被妖雾擦伤。'
          },
          failureOutcome: sharedFailure('你误判雾流方向，整面暗格把妖雾压进经脉。', 30)
        }
      ]
    }
  ],
  metro_abyss: [
    {
      id: 'last_train_reflection',
      dungeonId: 'metro_abyss',
      nodeId: 'rail_portal',
      title: '末班车倒影',
      description: '逆行列车停在黑水里，车门和倒影只会同时打开一次。',
      options: [
        {
          id: 'anchor_last_train',
          label: '用小界门符锚定车门',
          description: '把符压进车门缝，阻止倒影把你送回站台入口。',
          risk: 'low',
          requirements: [{ type: 'item', itemId: 'gate_sigil', count: 1, description: '携带 1 枚小界门符' }],
          outcome: {
            success: true,
            rewardPoints: 150,
            items: { rift_dust: 1 },
            temporaryLog: '小界门符钉住末班车门，倒影列车被迫留下裂隙尘。'
          },
          failureOutcome: sharedFailure('没有锚点的车门在倒影里闭合，黑水冲走一段生命。', 24)
        },
        {
          id: 'follow_mirror_moth',
          label: '跟随镜翼轨迹',
          description: '让熟悉传送锚点的灵宠在灯箱倒影间找真出口。',
          risk: 'medium',
          requirements: [{ type: 'petPassive', passiveTag: 'portal_anchor', description: '激活传送锚点灵宠' }],
          outcome: {
            success: true,
            rewardPoints: 210,
            lingyun: 1,
            items: { mirror_shell: 1 },
            temporaryLog: '灵宠沿着真实灯影飞行，镜潮退去后露出一枚镜潮贝。'
          },
          failureOutcome: sharedFailure('倒影路线无人校准，你在重复站台间损失了太多时间。', 22)
        }
      ]
    },
    {
      id: 'mirror_tide_crossing',
      dungeonId: 'metro_abyss',
      nodeId: 'mirror_tide_trap',
      title: '镜潮借路',
      description: '黑水同时映出干燥站台和沉没车厢，选错倒影就会被潮声拖进旧轨。',
      options: [
        {
          id: 'skim_mirror_wake',
          label: '踏云隙掠过潮面',
          description: '只踩倒影破碎的瞬间，拿走潮线边缘的镜潮贝。',
          risk: 'low',
          requirements: [{ type: 'method', methodId: 'cloud_step', description: '学会云隙步' }],
          outcome: {
            success: true,
            rewardPoints: 170,
            items: { mirror_shell: 1 },
            temporaryLog: '云隙步踩碎错误倒影，你从退潮线拾起一枚镜潮贝。'
          },
          failureOutcome: sharedFailure('脚步没能抢过倒影，镜潮从膝下骤然翻高。', 24)
        },
        {
          id: 'dive_with_mirror_moth',
          label: '让镜翼蛾引入沉车',
          description: '跟随镜翼蛾潜入沉没车厢，换取更深处的裂隙藏品。',
          risk: 'high',
          requirements: [{ type: 'pet', petId: 'mirror_moth', description: '拥有镜翼蛾' }],
          outcome: {
            success: true,
            rewardPoints: 300,
            lingyun: 1,
            items: { rift_dust: 1 },
            damage: 12,
            temporaryLog: '镜翼蛾认出真实车窗，你带着裂隙尘冲出沉车，也呛进一口黑水。'
          },
          failureOutcome: sharedFailure('没有镜翼引路，沉车倒影锁死车门，黑水挤压胸口。', 34)
        }
      ]
    }
  ],
  starfall_mine: [
    {
      id: 'star_iron_heart',
      dungeonId: 'starfall_mine',
      nodeId: 'star_core_reward',
      title: '星铁心脉',
      description: '星铁矿脉像心脏一样收缩，普通刀刃会被磁暴直接拖走。',
      options: [
        {
          id: 'split_star_vein',
          label: '用破甲剑劈开矿脉',
          description: '沿矿壳守卫留下的裂纹下剑，风险稳定，产出可靠。',
          risk: 'medium',
          requirements: [{ type: 'equipment', equipmentId: 'armor_piercing_sword', description: '拥有破甲剑' }],
          outcome: {
            success: true,
            rewardPoints: 260,
            items: { star_iron: 1 },
            temporaryLog: '破甲剑卡进星铁心脉，磁暴断开后掉下一块星铁。'
          },
          failureOutcome: sharedFailure('没有破甲锋线，矿壳回弹把武器震回胸口。', 28)
        },
        {
          id: 'read_gravity_pulse',
          label: '观门法读取重力脉冲',
          description: '等裂隙换向的瞬间抽取星核粉尘，收益更高但容错更低。',
          risk: 'high',
          requirements: [{ type: 'method', methodId: 'gate_sense', description: '学会观门法' }],
          outcome: {
            success: true,
            rewardPoints: 340,
            lingyun: 1,
            items: { star_iron: 1, rift_dust: 1 },
            damage: 12,
            temporaryLog: '观门法抓住重力换向，你带伤取出星铁和裂隙尘。'
          },
          failureOutcome: sharedFailure('你没读出重力换向，星铁心脉把整条矿道翻了过来。', 36)
        }
      ]
    },
    {
      id: 'coil_resonance_salvage',
      dungeonId: 'starfall_mine',
      nodeId: 'coil_burst_trap',
      title: '爆鸣线圈拆解',
      description: '废线圈仍在积蓄磁暴，包住导线能安全取尘，反向灌注则可能震出完整星铁。',
      options: [
        {
          id: 'wrap_live_coil',
          label: '用护甲补片包住导线',
          description: '牺牲拆解速度压住放电，只回收线圈外层的裂隙沉积。',
          risk: 'low',
          requirements: [{ type: 'item', itemId: 'armor_patch', count: 1, description: '携带 1 份护甲补片' }],
          outcome: {
            success: true,
            rewardPoints: 190,
            items: { rift_dust: 1 },
            temporaryLog: '护甲补片隔开带电导线，你从线圈外壳刮下一份裂隙尘。'
          },
          failureOutcome: sharedFailure('没有绝缘补片，磁暴沿着武器护手打进肩膀。', 28)
        },
        {
          id: 'reverse_coil_pulse',
          label: '以术法反灌线圈',
          description: '把磁暴顶回矿壁，赌一次完整星铁脱落。',
          risk: 'high',
          requirements: [{ type: 'stat', stat: 'artPower', min: 22, description: '术法强度至少 22' }],
          outcome: {
            success: true,
            rewardPoints: 340,
            lingyun: 1,
            items: { star_iron: 1 },
            damage: 14,
            temporaryLog: '术法逆转线圈极性，一块星铁被震出矿壁，余电也灼伤了掌心。'
          },
          failureOutcome: sharedFailure('术法压不住回流，线圈与矿轨同时爆出磁光。', 40)
        }
      ]
    }
  ],
  rust_hospital: [
    {
      id: 'triage_ward',
      dungeonId: 'rust_hospital',
      nodeId: 'triage_reward',
      title: '锈疫分诊',
      description: '分诊台要求你选择治疗顺序，错一次就会把污染推进血液。',
      options: [
        {
          id: 'sterilize_with_iron_body',
          label: '铁衣诀硬抗消毒灯',
          description: '先稳住肉身再取药，牺牲速度换污染控制。',
          risk: 'low',
          requirements: [{ type: 'method', methodId: 'iron_body', description: '学会铁衣诀' }],
          outcome: {
            success: true,
            rewardPoints: 220,
            items: { medicine_ash: 1 },
            temporaryLog: '铁衣诀挡住锈疫针雨，你从药柜里取出药灰。'
          },
          failureOutcome: sharedFailure('没有铁衣护体，消毒灯把锈疫压进皮肤。', 30)
        },
        {
          id: 'burn_focus_incense',
          label: '点燃定神香改写病历',
          description: '用香雾稳住精神污染，换取更安全的功法残页。',
          risk: 'medium',
          requirements: [{ type: 'item', itemId: 'focus_incense', count: 1, description: '携带 1 支定神香' }],
          outcome: {
            success: true,
            rewardPoints: 180,
            lingyun: 1,
            items: { method_page: 1 },
            temporaryLog: '定神香盖过病历低语，空白页浮出一段功法残文。'
          },
          failureOutcome: sharedFailure('没有定神香，病历把你的名字写进观察名单。', 26)
        }
      ]
    },
    {
      id: 'sterile_light_calibration',
      dungeonId: 'rust_hospital',
      nodeId: 'sterile_corridor',
      title: '无菌灯校准',
      description: '走廊消毒灯把锈疫和药性一并烧亮，稳住心跳能取药，导走余波则能读出隐藏病历。',
      options: [
        {
          id: 'cross_under_incense',
          label: '借定神香穿过灯阵',
          description: '用香雾固定呼吸，趁消毒灯熄灭间隙取走药灰。',
          risk: 'low',
          requirements: [{ type: 'item', itemId: 'focus_incense', count: 1, description: '携带 1 支定神香' }],
          outcome: {
            success: true,
            rewardPoints: 180,
            items: { medicine_ash: 1 },
            temporaryLog: '定神香标出灯阵间隙，你从无菌柜里取回一份药灰。'
          },
          failureOutcome: sharedFailure('没有香雾稳住呼吸，锈疫粉尘随消毒光灌入口鼻。', 30)
        },
        {
          id: 'ground_lights_with_robe',
          label: '用灵纹软甲导走灯压',
          description: '让软甲承接术法余波，读取灯光里闪过的实验病历。',
          risk: 'high',
          requirements: [{ type: 'equipment', equipmentId: 'spirit_robe', description: '拥有灵纹软甲' }],
          outcome: {
            success: true,
            rewardPoints: 320,
            items: { method_page: 1 },
            damage: 12,
            temporaryLog: '灵纹软甲把灯压导入地面，你带着灼痕抄下一页实验功法。'
          },
          failureOutcome: sharedFailure('没有导流软甲，整排消毒灯把术法余波压回体内。', 42)
        }
      ]
    }
  ],
  ash_arena: [
    {
      id: 'furnace_wager',
      dungeonId: 'ash_arena',
      nodeId: 'furnace_judge',
      title: '炉心押注',
      description: '裁判把你的爆发写进赔率，高收益路线会要求你先承受炉火点名。',
      options: [
        {
          id: 'accept_judge_wager',
          label: '接受裁判的终结押注',
          description: '用高速爆发压过裁判读招，赢下高额奖励，但必定吃一次炉火余波。',
          risk: 'high',
          requirements: [
            { type: 'stat', stat: 'attack', min: 24, description: '攻击至少 24' },
            { type: 'stat', stat: 'speed', min: 14, description: '速度至少 14' },
            { type: 'petPassive', passiveTag: 'combat_assist', description: '激活战斗协助灵宠' }
          ],
          outcome: {
            success: true,
            rewardPoints: 620,
            lingyun: 2,
            items: { cracked_core: 1 },
            damage: 18,
            temporaryLog: '你顶着炉火完成终结押注，裁判把裂核和双倍灵蕴推上台面。'
          },
          failureOutcome: sharedFailure('爆发或协助不足，裁判读中你的动作并反判炉火。', 44)
        },
        {
          id: 'defensive_rotation',
          label: '防御和术法轮换',
          description: '按裁判规则打满三个回合，不贪赔率，只拿稳定结算。',
          risk: 'medium',
          requirements: [{ type: 'stat', stat: 'defense', min: 13, description: '防御至少 13' }],
          outcome: {
            success: true,
            rewardPoints: 300,
            lingyun: 1,
            items: { star_iron: 1 },
            temporaryLog: '你没有给裁判连续读招的机会，观众席吐出一块星铁。'
          },
          failureOutcome: sharedFailure('防御不足以承接轮换，裁决火线追上脚步。', 32)
        }
      ]
    },
    {
      id: 'judgement_line_reversal',
      dungeonId: 'ash_arena',
      nodeId: 'judgement_flame',
      title: '裁决火线改判',
      description: '火线正在复写上一名挑战者的败招，遮住判词可以安全通过，逆着判词冲刺则能夺走冷门赔率。',
      options: [
        {
          id: 'patch_judgement_mark',
          label: '用护甲补片盖住判词',
          description: '放弃高赔率，把最烫的判词压在护片下面稳步过线。',
          risk: 'low',
          requirements: [{ type: 'item', itemId: 'armor_patch', count: 1, description: '携带 1 份护甲补片' }],
          outcome: {
            success: true,
            rewardPoints: 220,
            items: { medicine_ash: 1 },
            temporaryLog: '护甲补片盖住追踪火纹，你从冷却灰烬里收起一份药灰。'
          },
          failureOutcome: sharedFailure('没有护片压住判词，裁决火线沿着旧败招追上身体。', 34)
        },
        {
          id: 'outrun_judgement_script',
          label: '以云隙步逆跑判词',
          description: '在火线完成改判前跑完整条赔率轨，抢走裁判预留的裂核。',
          risk: 'high',
          requirements: [{ type: 'method', methodId: 'cloud_step', description: '学会云隙步' }],
          outcome: {
            success: true,
            rewardPoints: 400,
            lingyun: 1,
            items: { cracked_core: 1 },
            damage: 16,
            temporaryLog: '云隙步抢在判词前冲线，你夺走裂核，也被最后一道火舌扫中。'
          },
          failureOutcome: sharedFailure('脚步没能跳出判词节奏，整条火线完成了一次反向裁决。', 46)
        }
      ]
    }
  ],
  dream_archive: [
    {
      id: 'failure_index',
      dungeonId: 'dream_archive',
      nodeId: 'index_reward',
      title: '失败索引柜',
      description: '每张索引卡都写着一条失败路线，读错会把旧失误变成新陷阱。',
      options: [
        {
          id: 'empty_self_with_void_heart',
          label: '以虚心诀读完索引',
          description: '放空自我，不让档案馆抓到最高恐惧。',
          risk: 'low',
          requirements: [{ type: 'method', methodId: 'void_heart', description: '学会虚心诀' }],
          outcome: {
            success: true,
            rewardPoints: 300,
            lingyun: 1,
            items: { hidden_stone: 1 },
            temporaryLog: '虚心诀让失败索引无处着墨，柜底滚出一块隐藏石。'
          },
          failureOutcome: sharedFailure('没有虚心诀，索引卡把上一条失败路线折成梦牢。', 34)
        },
        {
          id: 'decode_with_spirit',
          label: '用灵识重排档案',
          description: '直接重写索引顺序，适合灵力成长路线。',
          risk: 'medium',
          requirements: [{ type: 'stat', stat: 'spirit', min: 7, description: '灵识至少 7' }],
          outcome: {
            success: true,
            rewardPoints: 360,
            items: { method_page: 1 },
            temporaryLog: '灵识重排档案页码，功法残页从未来失败里滑出。'
          },
          failureOutcome: sharedFailure('灵识不足，档案顺序反向锁住你的记忆。', 38)
        }
      ]
    },
    {
      id: 'missing_breath_corridor',
      dungeonId: 'dream_archive',
      nodeId: 'memory_loop_trap',
      title: '少了一息的走廊',
      description: '同一段书架重复出现，每轮都删掉一口呼吸，也把更深的失败批注推到眼前。',
      options: [
        {
          id: 'count_loop_breaths',
          label: '用吐纳诀补回缺息',
          description: '逐轮补齐被删掉的呼吸，安全找到走廊原稿。',
          risk: 'low',
          requirements: [{ type: 'method', methodId: 'mist_breathing', description: '学会吐纳诀' }],
          outcome: {
            success: true,
            rewardPoints: 230,
            items: { focus_incense: 1 },
            temporaryLog: '吐纳诀补回第三次循环缺失的呼吸，原稿里掉出一支定神香。'
          },
          failureOutcome: sharedFailure('你没找回缺失的呼吸，记忆回环把胸口越收越紧。', 36)
        },
        {
          id: 'follow_moth_first_draft',
          label: '让镜翼蛾追第一版倒影',
          description: '越过后续循环，直取尚未删改的第一版档案。',
          risk: 'high',
          requirements: [{ type: 'pet', petId: 'mirror_moth', description: '拥有镜翼蛾' }],
          outcome: {
            success: true,
            rewardPoints: 390,
            lingyun: 1,
            items: { hidden_stone: 1, method_page: 1 },
            damage: 14,
            temporaryLog: '镜翼蛾带你撞进第一版走廊，你抢出隐藏石和残页，也被改稿纸刃划伤。'
          },
          failureOutcome: sharedFailure('没有镜翼辨认初稿，你被夹在两版互相覆盖的走廊之间。', 48)
        }
      ]
    }
  ],
  void_citadel: [
    {
      id: 'echo_core_trial',
      dungeonId: 'void_citadel',
      nodeId: 'main_god_echo',
      title: '残响核心审问',
      description: '主神残响询问你靠哪一种成长抵达终点，回答越偏科越危险。',
      options: [
        {
          id: 'balance_void_sets',
          label: '用裂隙套装校准残响',
          description: '把成长来源压进裂隙校准，让残响复制到更低的波峰。',
          risk: 'medium',
          requirements: [{ type: 'equipmentSet', setTag: 'rift', description: '激活裂隙 2 件套' }],
          outcome: {
            success: true,
            rewardPoints: 480,
            lingyun: 2,
            items: { rift_dust: 2 },
            temporaryLog: '裂隙套装把残响拆成低频回声，你收走两份裂隙尘。'
          },
          failureOutcome: sharedFailure('没有裂隙套装校准，残响复制了你最高的破绽。', 42)
        },
        {
          id: 'offer_void_whelp_memory',
          label: '让虚空幼蜥吞掉错误倒影',
          description: '用终盘灵宠处理错误倒影，换取裂核奖励。',
          risk: 'high',
          requirements: [{ type: 'pet', petId: 'void_whelp', description: '拥有虚空幼蜥' }],
          outcome: {
            success: true,
            rewardPoints: 560,
            lingyun: 2,
            items: { cracked_core: 2 },
            damage: 20,
            temporaryLog: '虚空幼蜥吞掉错误倒影，你带着裂核从残响核心中脱身。'
          },
          failureOutcome: sharedFailure('没有虚空幼蜥承接倒影，残响核心直接啃掉一段生命。', 48)
        }
      ]
    },
    {
      id: 'identity_reassembly',
      dungeonId: 'void_citadel',
      nodeId: 'identity_trap',
      title: '身份碎片重组',
      description: '剥离陷阱把功法、装备和灵宠记忆拆成白色碎片，你必须决定靠自我还是完整成长把它们拼回去。',
      options: [
        {
          id: 'hold_name_with_void_heart',
          label: '以虚心诀守住本名',
          description: '放弃追逐所有碎片，只保住不会被残响改写的核心记忆。',
          risk: 'low',
          requirements: [{ type: 'method', methodId: 'void_heart', description: '学会虚心诀' }],
          outcome: {
            success: true,
            rewardPoints: 360,
            items: { method_page: 1 },
            temporaryLog: '虚心诀守住本名，散落的身份碎片重新拼成一页功法批注。'
          },
          failureOutcome: sharedFailure('没有虚心诀维持自我，残响替你写下一个错误名字。', 44)
        },
        {
          id: 'prove_balanced_identity',
          label: '用四项成长证明身份',
          description: '同时唤醒攻、术、防、速四组碎片，换取完整终盘校准。',
          risk: 'high',
          requirements: [
            { type: 'stat', stat: 'attack', min: 28, description: '攻击至少 28' },
            { type: 'stat', stat: 'artPower', min: 24, description: '术法强度至少 24' },
            { type: 'stat', stat: 'defense', min: 16, description: '防御至少 16' },
            { type: 'stat', stat: 'speed', min: 15, description: '速度至少 15' }
          ],
          outcome: {
            success: true,
            rewardPoints: 680,
            lingyun: 2,
            items: { cracked_core: 1 },
            damage: 18,
            temporaryLog: '四组成长碎片同时响应，你完成身份校准，也承受了核心重组的撕裂。'
          },
          failureOutcome: sharedFailure('四项成长没能同时响应，身份碎片在体内反向剥离。', 56)
        }
      ]
    }
  ],
  temporal_observatory: [
    {
      id: 'past_calibration_echo',
      dungeonId: 'temporal_observatory',
      nodeId: 'past_calibration_anchor',
      title: '旧刻度回声',
      description: '观测庭把你走过的路线压成重叠刻度，校准失误会让旧伤在同一瞬间重演。',
      options: [
        {
          id: 'read_past_with_chronal_lens',
          label: '用时序透镜核对旧刻度',
          description: '逐层比对残留轨迹，稳定收束过去锚点的偏差。',
          risk: 'medium',
          requirements: [{ type: 'equipment', equipmentId: 'chronal_lens', description: '拥有时序透镜' }],
          outcome: {
            success: true,
            rewardPoints: 620,
            lingyun: 2,
            items: { chronal_glass: 1 },
            temporaryLog: '时序透镜拆开重叠刻度，你从凝固的旧轨迹中取出一片时序玻璃。'
          },
          failureOutcome: sharedFailure('没有透镜分辨旧刻度，过去的伤势在校准台上同时复现。', 56)
        },
        {
          id: 'overwrite_past_drift',
          label: '以陷阱感知覆写偏移',
          description: '在锚点跳秒前强行改写错误刻度，争取更完整的观测样本。',
          risk: 'high',
          requirements: [{ type: 'stat', stat: 'trapCheck', min: 18, description: '陷阱感知至少 18' }],
          outcome: {
            success: true,
            rewardPoints: 860,
            lingyun: 3,
            items: { chronal_glass: 2 },
            damage: 24,
            temporaryLog: '你抢在跳秒前覆写偏移，带着两片时序玻璃脱离，也承受了旧伤回灌。'
          },
          failureOutcome: sharedFailure('你误判锚点跳秒，整段旧路线折回体内。', 68)
        }
      ]
    },
    {
      id: 'future_calibration_echo',
      dungeonId: 'temporal_observatory',
      nodeId: 'future_calibration_anchor',
      title: '零时预演',
      description: '未来锚点同时放出数条零时路线，越靠近正确答案，错误结局的冲击也越集中。',
      options: [
        {
          id: 'brace_future_with_chronal_aegis',
          label: '以时序盾承接预演',
          description: '让护盾逐条熄灭错误结局，保住一份稳定的未来样本。',
          risk: 'low',
          requirements: [{ type: 'equipment', equipmentId: 'chronal_aegis', description: '拥有时序盾' }],
          outcome: {
            success: true,
            rewardPoints: 650,
            lingyun: 2,
            items: { chronal_glass: 1 },
            temporaryLog: '时序盾依次挡下错误结局，最后一条未来凝成一片时序玻璃。'
          },
          failureOutcome: sharedFailure('没有时序盾分担预演，数条失败结局同时压向现在。', 58)
        },
        {
          id: 'cut_to_zero_hour',
          label: '持时序刃抢入零时',
          description: '在未来分岔闭合前切入唯一正确路线，夺取完整的零时观测记录。',
          risk: 'high',
          requirements: [
            { type: 'equipment', equipmentId: 'chronal_edge', description: '拥有时序刃' },
            { type: 'stat', stat: 'speed', min: 20, description: '速度至少 20' }
          ],
          outcome: {
            success: true,
            rewardPoints: 920,
            lingyun: 3,
            items: { chronal_glass: 2 },
            damage: 28,
            temporaryLog: '时序刃切开零时分岔，你夺下完整记录，也被闭合的未来擦过身体。'
          },
          failureOutcome: sharedFailure('速度跟不上分岔闭合，时序刃把错误未来一并带回现在。', 72)
        }
      ]
    }
  ],
  causal_clearinghouse: [
    {
      id: 'causal_debt_reversal',
      dungeonId: 'causal_clearinghouse',
      nodeId: 'contradiction_line',
      title: '倒置债权的副本',
      description: '法则账本正在把同一笔债务反复倒置，原件与复制件都声称自己先于因果成立。',
      options: [
        {
          id: 'copy_reversal_clause',
          label: '复制逆转条款',
          description: '只复制已经显形的逆转条款，不读取或改写法则账本的当前状态。',
          risk: 'medium',
          requirements: [{ type: 'none', description: '逆转条款已经显形' }],
          outcome: {
            success: true,
            rewardPoints: 720,
            lingyun: 2,
            items: { causal_seal: 1 },
            temporaryLog: '你复制了独立的逆转条款，原账本未被触碰，副本凝成一枚因果印章。'
          },
          failureOutcome: sharedFailure('条款在复制完成前自行倒置，回写的债权压向你的因果链。', 64)
        },
        {
          id: 'break_reversal_echo',
          label: '击碎债务回声',
          description: '以断响拳套截断原件与副本之间的复写回声，带走完整封签。',
          risk: 'high',
          requirements: [{ type: 'equipment', equipmentId: 'echo_breaker_gauntlets', description: '拥有断响拳套' }],
          outcome: {
            success: true,
            rewardPoints: 1080,
            lingyun: 3,
            items: { causal_seal: 2 },
            damage: 32,
            temporaryLog: '断响拳套击穿复写回声，两份债权同时失效，留下两枚因果印章。'
          },
          failureOutcome: sharedFailure('没有断响拳套隔绝回声，两份债权同时落在你身上。', 82)
        }
      ]
    },
    {
      id: 'entry_docket_appeal',
      dungeonId: 'causal_clearinghouse',
      nodeId: 'entry_docket',
      title: '入案票据的原始签名',
      description: '入口案票要求你承认一份尚未发生的判决，否则就把来路登记为逃逸。',
      options: [
        {
          id: 'anchor_original_docket',
          label: '锚定原始案票',
          description: '以归航锚带固定入案时刻，让未来判决无法抢先成为原因。',
          risk: 'low',
          requirements: [{ type: 'equipment', equipmentId: 'return_anchor_belt', description: '拥有归航锚带' }],
          outcome: {
            success: true,
            rewardPoints: 760,
            lingyun: 2,
            items: { causal_seal: 1 },
            temporaryLog: '归航锚带固定了原始签名，案票吐出一枚未被倒置的因果印章。'
          },
          failureOutcome: sharedFailure('没有锚点固定签名，未来判决沿案票倒灌回入口。', 66)
        },
        {
          id: 'cross_examine_entry_stamp',
          label: '反诘入案印章',
          description: '在印章落下前找出判词矛盾，以更高风险换取完整的双份存证。',
          risk: 'high',
          requirements: [{ type: 'stat', stat: 'trapCheck', min: 22, description: '陷阱感知至少 22' }],
          outcome: {
            success: true,
            rewardPoints: 1020,
            lingyun: 3,
            items: { causal_seal: 2 },
            damage: 28,
            temporaryLog: '你在印章落下前指出矛盾，案票被迫交出两枚因果印章，也留下反诘灼痕。'
          },
          failureOutcome: sharedFailure('反诘晚了一步，入案印章把矛盾烙进你的因果链。', 86)
        }
      ]
    }
  ],
  entropy_ark: [
    {
      id: 'entropy_wake_inversion',
      dungeonId: 'entropy_ark',
      nodeId: 'wake_inversion',
      title: '熵潮航迹逆转',
      description: '方舟尾迹突然翻到船首，稳住航向可以截下一枚熵晶，追入逆流则可能打捞完整晶簇。',
      options: [
        {
          id: 'stabilize_inverted_wake',
          label: '以熵航罗盘稳住尾迹',
          description: '让罗盘固定当前船首，等待逆流自行掠过再回收一枚稳定熵晶。',
          risk: 'low',
          requirements: [{ type: 'equipment', equipmentId: 'entropy_compass', description: '拥有熵航罗盘' }],
          outcome: {
            success: true,
            rewardPoints: 820,
            lingyun: 2,
            items: { entropy_crystal: 1 },
            temporaryLog: '熵航罗盘锁住船首，逆转尾迹在舷侧凝成一枚稳定熵晶。'
          },
          failureOutcome: sharedFailure('没有罗盘固定航向，逆转尾迹把你撞回耗散航道。', 72)
        },
        {
          id: 'ride_entropy_backwash',
          label: '抢入逆流打捞晶簇',
          description: '在尾迹闭合前沿逆流突进，以更高承伤换取两枚熵晶。',
          risk: 'high',
          requirements: [{ type: 'stat', stat: 'speed', min: 23, description: '速度至少 23' }],
          outcome: {
            success: true,
            rewardPoints: 1180,
            lingyun: 3,
            items: { entropy_crystal: 2 },
            damage: 34,
            temporaryLog: '你沿逆流抢入尾迹核心，带回两枚熵晶，也被闭合航迹重重擦过。'
          },
          failureOutcome: sharedFailure('速度没能赶上尾迹闭合，熵潮从两个方向同时压向身体。', 94)
        }
      ]
    },
    {
      id: 'ark_manifest_reconciliation',
      dungeonId: 'entropy_ark',
      nodeId: 'ark_manifest',
      title: '方舟清单对账',
      description: '熵舱清单把同一舱室登记成两种状态，保守核验能留下凭证，强行合账则会承受清单反噬。',
      options: [
        {
          id: 'shield_manifest_reconciliation',
          label: '以耗散披甲隔离清单',
          description: '隔离两份清单的耗散回写，逐项核验并收下一枚对账熵晶。',
          risk: 'low',
          requirements: [{ type: 'equipment', equipmentId: 'dissipation_mantle', description: '拥有耗散披甲' }],
          outcome: {
            success: true,
            rewardPoints: 860,
            lingyun: 2,
            items: { entropy_crystal: 1 },
            temporaryLog: '耗散披甲挡住清单回写，你完成逐项核验并取得一枚对账熵晶。'
          },
          failureOutcome: sharedFailure('没有披甲隔离回写，两份清单同时把你登记为待耗散货物。', 76)
        },
        {
          id: 'force_manifest_convergence',
          label: '强制双清单合流',
          description: '凭陷阱感知找出冲突字段，在清单重写前强行完成合账。',
          risk: 'high',
          requirements: [{ type: 'stat', stat: 'trapCheck', min: 24, description: '陷阱感知至少 24' }],
          outcome: {
            success: true,
            rewardPoints: 1240,
            lingyun: 3,
            items: { entropy_crystal: 2 },
            damage: 36,
            temporaryLog: '你锁定冲突字段强制合账，两份清单塌缩成两枚熵晶，反噬也灼穿了防线。'
          },
          failureOutcome: sharedFailure('冲突字段在落款前再次漂移，整份清单沿神经重写舱位。', 98)
        }
      ]
    }
  ],
  mirror_cycle_city: [
    {
      id: 'faceless_procession',
      dungeonId: 'mirror_cycle_city',
      nodeId: 'cycle_manifest',
      title: '无面巡游的相位税',
      description: '无面队列沿现实与镜相的交界反复巡游，稳定识别队首可以截下一枚相位镜晶，追进队列则能夺走完整晶簇。',
      options: [
        {
          id: 'identify_procession_parallax',
          label: '以视差面甲辨认队首',
          description: '让面甲滤去错误相位的重影，只截取队首携带的一枚稳定镜晶。',
          risk: 'low',
          requirements: [{ type: 'equipment', equipmentId: 'parallax_visor', description: '拥有视差面甲' }],
          outcome: {
            success: true,
            rewardPoints: 940,
            lingyun: 3,
            items: { phase_glass: 1 },
            temporaryLog: '视差面甲锁住唯一真实的步频，无面队首在错位中留下了一枚相位镜晶。'
          },
          failureOutcome: sharedFailure('重影掩住了队首，无面巡游从两个相位同时踏过你的防线。', 80)
        },
        {
          id: 'cut_through_faceless_ranks',
          label: '切入队列夺取晶簇',
          description: '读出巡游换相的空隙后直穿队列，以更高承伤换取两枚相位镜晶。',
          risk: 'high',
          requirements: [{ type: 'stat', stat: 'speed', min: 26, description: '速度至少 26' }],
          outcome: {
            success: true,
            rewardPoints: 1300,
            lingyun: 4,
            items: { phase_glass: 2 },
            damage: 38,
            temporaryLog: '你穿过巡游换相的唯一空拍，夺下两枚相位镜晶，也被闭合的队列擦伤。'
          },
          failureOutcome: sharedFailure('换相空拍提前闭合，无面队列把现实与镜相的冲击一并压回身体。', 104)
        }
      ]
    },
    {
      id: 'identity_rehearsal',
      dungeonId: 'mirror_cycle_city',
      nodeId: 'reflection_event_stage',
      title: '归名之前的身份排演',
      description: '镜台要求你排演一个可被两种相位同时承认的身份，保守缝合能够固化镜晶，强行定名则会引来所有失败倒影。',
      options: [
        {
          id: 'weave_identity_between_phases',
          label: '以相织披风缝合台词',
          description: '让披风承接两侧镜台的相位切换，逐句完成稳定排演。',
          risk: 'low',
          requirements: [{ type: 'equipment', equipmentId: 'phaseweave_mantle', description: '拥有相织披风' }],
          outcome: {
            success: true,
            rewardPoints: 980,
            lingyun: 3,
            items: { phase_glass: 1 },
            temporaryLog: '相织披风把两套台词缝成同一段归名词，镜台析出一枚相位镜晶。'
          },
          failureOutcome: sharedFailure('缺少相位缓冲，两套身份在换幕时同时撕扯你的意识。', 84)
        },
        {
          id: 'name_every_failed_reflection',
          label: '为所有失败倒影定名',
          description: '在镜台重置前识破每个倒影的破绽，以正面承伤换取完整归名晶簇。',
          risk: 'high',
          requirements: [{ type: 'stat', stat: 'trapCheck', min: 27, description: '陷阱感知至少 27' }],
          outcome: {
            success: true,
            rewardPoints: 1360,
            lingyun: 4,
            items: { phase_glass: 2 },
            damage: 42,
            temporaryLog: '你逐一说出失败倒影的破绽，镜台交出两枚相位镜晶，反诘裂痕也留在身上。'
          },
          failureOutcome: sharedFailure('最后一面倒影先说出了你的名字，整座镜台沿身份裂缝反向定名。', 110)
        }
      ]
    }
  ],
  redaction_scriptorium: [
    {
      id: 'first_erratum',
      dungeonId: 'redaction_scriptorium',
      nodeId: 'final_proof_nexus',
      title: '第一条勘误',
      description: '终校枢纽同时呈上原句与删改稿，保住原句需要交出删界墨作证，强行改判则会让红线沿武器反噬。',
      options: [
        {
          id: 'authenticate_first_erratum',
          label: '以删界墨验明原句',
          description: '用观门法辨认版本缝隙，再消耗一滴删界墨固定第一条勘误的原始笔迹。',
          risk: 'low',
          requirements: [
            { type: 'method', methodId: 'gate_sense', description: '学会观门法' },
            { type: 'item', itemId: 'redaction_ink', count: 1, description: '持有删界墨 1' }
          ],
          outcome: {
            success: true,
            rewardPoints: 1060,
            lingyun: 4,
            items: { redaction_ink: 1 },
            temporaryLog: '观门法找出版本缝隙，删界墨把原句固定为可核验的第一条勘误。'
          },
          failureOutcome: sharedFailure('缺少原句凭证，终校枢纽把你的记忆列为未经核验的旁注。', 88)
        },
        {
          id: 'redline_first_erratum',
          label: '以朱批断章刃强制改判',
          description: '用足够锋利的攻势沿红线切开伪稿，以正面承伤换取两滴终校删界墨。',
          risk: 'high',
          requirements: [
            { type: 'equipment', equipmentId: 'redline_edge', description: '拥有朱批断章刃' },
            { type: 'stat', stat: 'attack', min: 34, description: '攻击至少 34' }
          ],
          outcome: {
            success: true,
            rewardPoints: 1480,
            lingyun: 5,
            items: { redaction_ink: 2 },
            damage: 46,
            temporaryLog: '朱批断章刃把伪稿切回废页，你夺下两滴终校墨，也承受了反向删改留下的创口。'
          },
          failureOutcome: sharedFailure('红线没有被一次斩断，伪稿沿未完成的笔画反向删去你的防线。', 116)
        }
      ]
    },
    {
      id: 'palimpsest_testimony',
      dungeonId: 'redaction_scriptorium',
      nodeId: 'errata_event_stage',
      title: '覆页证词',
      description: '勘误台要求装备替被覆盖的旧稿作证；保留一句未删原文能固定记忆，追索全部覆页则会唤醒每次失败改稿。',
      options: [
        {
          id: 'preserve_unredacted_testimony',
          label: '让随身装备保存未删句',
          description: '以虚心诀稳住意识，再用一滴删界墨让随身装备承接覆页剥离时留下的原文。',
          risk: 'low',
          requirements: [
            { type: 'method', methodId: 'void_heart', description: '学会虚心诀' },
            { type: 'item', itemId: 'redaction_ink', count: 1, description: '持有删界墨 1' }
          ],
          outcome: {
            success: true,
            rewardPoints: 1120,
            lingyun: 4,
            items: { redaction_ink: 1 },
            temporaryLog: '删界墨接住剥离的覆页，随身装备记住了一句终稿无法删除的原文。'
          },
          failureOutcome: sharedFailure('意识先于覆页失去锚点，旧稿证词在重写时把伤痕一并覆回身体。', 92)
        },
        {
          id: 'cross_examine_every_palimpsest',
          label: '以终校印反诘全部覆页',
          description: '消耗一滴删界墨启动终校印，在勘误台重置前找出每份证词的改写断点。',
          risk: 'high',
          requirements: [
            { type: 'equipment', equipmentId: 'final_proof_seal', description: '拥有终校印' },
            { type: 'item', itemId: 'redaction_ink', count: 1, description: '持有删界墨 1' },
            { type: 'stat', stat: 'trapCheck', min: 31, description: '陷阱感知至少 31' }
          ],
          outcome: {
            success: true,
            rewardPoints: 1540,
            lingyun: 5,
            items: { redaction_ink: 3 },
            damage: 50,
            temporaryLog: '终校印逐份驳回伪证，全部覆页凝成三滴删界墨，装备也留下未删句的战意回响。'
          },
          failureOutcome: sharedFailure('最后一份覆页抢先盖印，所有被驳回的版本同时向你的正文追责。', 122)
        }
      ]
    }
  ],
  legacy_auction_court: [
    {
      id: 'provenance_dispute',
      dungeonId: 'legacy_auction_court',
      nodeId: 'provenance_event_stage',
      title: '执槌链来源争议',
      description: '四席同时质疑遗产槌的传承记录；逐份验真能保住筹码，强行击碎匿名竞价链则会招来全席追价。',
      options: [
        {
          id: 'certify_hammer_chain_provenance',
          label: '逐环核验执槌来源',
          description: '以观门法辨认每次转手留下的界门残痕，再用一枚遗产筹码为真实传承链保价。',
          risk: 'low',
          requirements: [
            { type: 'method', methodId: 'gate_sense', description: '学会观门法' },
            { type: 'item', itemId: 'legacy_scrip', count: 1, description: '持有遗产筹码 1' }
          ],
          outcome: {
            success: true,
            rewardPoints: 1180,
            lingyun: 5,
            items: { legacy_scrip: 1 },
            temporaryLog: '观门法逐环复原执槌链，保价席承认筹码来自真实遗产。'
          },
          failureOutcome: sharedFailure('来源记录缺少保价凭证，四席把你的身份一并列为可疑拍品。', 96)
        },
        {
          id: 'break_anonymous_bid_chain',
          label: '以遗产槌击碎匿名竞价链',
          description: '正面敲断伪造传承的每次加价，以更高承伤夺回被匿名报价扣押的两枚筹码。',
          risk: 'high',
          requirements: [
            { type: 'equipment', equipmentId: 'legacy_gavel', description: '拥有遗产槌' },
            { type: 'stat', stat: 'attack', min: 37, description: '攻击至少 37' }
          ],
          outcome: {
            success: true,
            rewardPoints: 1620,
            lingyun: 6,
            items: { legacy_scrip: 2 },
            damage: 54,
            temporaryLog: '遗产槌砸断匿名竞价链，两枚被扣筹码落回真名账册，追价余震也贯穿手臂。'
          },
          failureOutcome: sharedFailure('伪造报价先一步闭环，四席追加的落槌价同时压向你的防线。', 128)
        }
      ]
    },
    {
      id: 'dead_team_testimony',
      dungeonId: 'legacy_auction_court',
      nodeId: 'dead_team_testimony_stage',
      title: '亡队遗产证词',
      description: '旧队员的装备依次陈述最后一战；保存一份真证能稳住遗产归属，唤醒全部证词则会重演整场团灭。',
      options: [
        {
          id: 'preserve_dead_team_reserve',
          label: '为亡队保留一份底价证词',
          description: '以虚心诀承接旧队记忆，再用一枚遗产筹码让匿名帷幕保存未被竞价改写的证词。',
          risk: 'low',
          requirements: [
            { type: 'method', methodId: 'void_heart', description: '学会虚心诀' },
            { type: 'equipment', equipmentId: 'anonymous_veil', description: '拥有匿名帷幕' },
            { type: 'item', itemId: 'legacy_scrip', count: 1, description: '持有遗产筹码 1' }
          ],
          outcome: {
            success: true,
            rewardPoints: 1240,
            lingyun: 5,
            items: { legacy_scrip: 1 },
            temporaryLog: '匿名帷幕隔开竞价噪声，亡队最后一份真实证词以底价凭证留存。'
          },
          failureOutcome: sharedFailure('意识与亡队记忆失去边界，最后一战的伤势沿证词覆回身体。', 100)
        },
        {
          id: 'ring_final_lot_for_all_testimony',
          label: '敲响终拍铃唤醒全部证词',
          description: '以筹码启动终拍铃，在证词被再次估价前识破每件遗物的伪造死因。',
          risk: 'high',
          requirements: [
            { type: 'equipment', equipmentId: 'final_lot_bell', description: '拥有终拍铃' },
            { type: 'item', itemId: 'legacy_scrip', count: 1, description: '持有遗产筹码 1' },
            { type: 'stat', stat: 'trapCheck', min: 34, description: '陷阱感知至少 34' }
          ],
          outcome: {
            success: true,
            rewardPoints: 1700,
            lingyun: 6,
            items: { legacy_scrip: 3 },
            damage: 58,
            temporaryLog: '终拍铃让全部遗物同时作证，三枚筹码从伪造死因中析出，团灭回响也留下沉重伤痕。'
          },
          failureOutcome: sharedFailure('最后一件遗物抢先接受伪价，整支亡队的失败同时向你追缴。', 134)
        }
      ]
    }
  ],
  genesis_vault: [
    {
      id: 'mosaic_proof',
      dungeonId: 'genesis_vault',
      nodeId: 'mosaic_gene_vault',
      title: '嵌合证明',
      description: '嵌合池要求来者证明片段能够稳定共存；按谱系校准可以保住样本，直接切取活性片段则会引发原型排异。',
      options: [
        {
          id: 'calibrate_mosaic_lineage',
          label: '按谱系稳定校准',
          description: '以观门法读取片段边界，再用足够的陷阱感知逐段排除互斥表达。',
          risk: 'low',
          requirements: [
            { type: 'method', methodId: 'gate_sense', description: '学会观门法' },
            { type: 'stat', stat: 'trapCheck', min: 36, description: '陷阱感知至少 36' }
          ],
          outcome: {
            success: true,
            rewardPoints: 1320,
            lingyun: 5,
            items: { genesis_serum: 1 },
            temporaryLog: '你逐段校准互斥表达，嵌合池交出一份稳定原型血清。'
          },
          failureOutcome: sharedFailure('一段隐性排异逃过校准，嵌合组织沿接触面反向增生。', 118)
        },
        {
          id: 'sample_live_mosaic',
          label: '冒险切取活性样本',
          description: '用螺旋断链斧切开正在重组的原型链，在排异闭合前夺取两份活性血清。',
          risk: 'high',
          requirements: [
            { type: 'equipment', equipmentId: 'helix_cleaver', description: '拥有螺旋断链斧' },
            { type: 'stat', stat: 'attack', min: 40, description: '攻击至少 40' }
          ],
          outcome: {
            success: true,
            rewardPoints: 1840,
            lingyun: 6,
            items: { genesis_serum: 2 },
            damage: 64,
            temporaryLog: '断链斧抢在排异闭合前取出两份活性样本，失稳组织也在手臂留下增生创口。'
          },
          failureOutcome: sharedFailure('切口未能一次断开，活性原型把你的攻势识别成可复制组织。', 146)
        }
      ]
    },
    {
      id: 'ancestor_echo',
      dungeonId: 'genesis_vault',
      nodeId: 'lineage_event_stage',
      title: '祖型回声',
      description: '演化台放出尚未分化的祖型回声；承认它能留下完整谱系记忆，切断污染则可保住当前自我。',
      options: [
        {
          id: 'acknowledge_ancestor_echo',
          label: '凝神承认祖型回声',
          description: '燃起定神香，以灵识分辨祖型记忆与当前自我，让随身装备记住完整回声。',
          risk: 'medium',
          requirements: [
            { type: 'item', itemId: 'focus_incense', count: 1, description: '携带 1 支定神香' },
            { type: 'stat', stat: 'spirit', min: 10, description: '灵识至少 10' }
          ],
          outcome: {
            success: true,
            rewardPoints: 1460,
            lingyun: 6,
            items: { genesis_serum: 1, method_page: 1 },
            temporaryLog: '你承认祖型回声却没有交出自我，随身装备记住了谱系从未分化的第一声脉动。'
          },
          failureOutcome: sharedFailure('专注先于谱系回放崩解，祖型记忆沿灵识裂口覆写当前感官。', 126)
        },
        {
          id: 'sever_tainted_ancestor_echo',
          label: '以驱邪符切断污染',
          description: '消耗一枚驱邪符烧断污染谱系，只保存未被侵染的短段原型记录。',
          risk: 'low',
          requirements: [
            { type: 'item', itemId: 'dispel_talisman', count: 1, description: '携带 1 枚驱邪符' }
          ],
          outcome: {
            success: true,
            rewardPoints: 1240,
            lingyun: 5,
            items: { genesis_serum: 1 },
            temporaryLog: '驱邪符烧断污染枝条，演化台留下一段可安全归档的祖型记录。'
          },
          failureOutcome: sharedFailure('驱邪符不足以封住全部分支，污染回声沿断口同时反扑。', 112)
        }
      ]
    }
  ],
  silent_broadcast_tower: [
    {
      id: 'borrowed_voice',
      dungeonId: 'silent_broadcast_tower',
      nodeId: 'dead_air_gallery',
      title: '借来的队友声音',
      description: '死频陈列廊借用队友的声音呼唤你的名字；回应可能找回一段人声，也可能让频道顺着意识钻入。',
      options: [
        {
          id: 'answer_borrowed_voice',
          label: '凝神回应队友声音',
          description: '用灵识辨认语气中的真实记忆，并保持专注直到借声频道自行暴露。',
          risk: 'medium',
          requirements: [
            { type: 'stat', stat: 'spirit', min: 12, description: '灵识至少 12' },
            { type: 'stat', stat: 'trapCheck', min: 39, description: '陷阱检定至少 39' }
          ],
          outcome: {
            success: true,
            rewardPoints: 1540,
            lingyun: 6,
            items: { silence_core: 1 },
            temporaryLog: '你从借来的声线中分离出队友真正留下的停顿，死频凝成一枚静默晶核。'
          },
          failureOutcome: sharedFailure('回应被死频抢先接管，借声频道沿意识回路灌入一整段错误记忆。', 172)
        },
        {
          id: 'sever_borrowed_voice',
          label: '以驱邪符切断频道',
          description: '消耗一枚驱邪符烧断借声回路，只保留未被污染的短段频谱。',
          risk: 'low',
          requirements: [
            { type: 'item', itemId: 'dispel_talisman', count: 1, description: '携带 1 枚驱邪符' }
          ],
          outcome: {
            success: true,
            rewardPoints: 1320,
            lingyun: 5,
            items: { silence_core: 1 },
            temporaryLog: '驱邪符烧穿借声频道，残余频谱失去模仿能力并凝成安全样本。'
          },
          failureOutcome: sharedFailure('驱邪符不足，断开的频道从两端同时回灌，伪声在陈列廊内反复叠响。', 168)
        }
      ]
    },
    {
      id: 'last_broadcast',
      dungeonId: 'silent_broadcast_tower',
      nodeId: 'broadcast_memory_stage',
      title: '最后一段人声',
      description: '记忆台放出停播前最后一段广播；听完它能让装备记住人声，也会把探索者暴露给整座塔的噪声。',
      options: [
        {
          id: 'listen_to_last_broadcast',
          label: '坚持听完最后广播',
          description: '承受全部死频噪声，以灵识辨认广播结尾确认队友生还的最后一句话。',
          risk: 'high',
          requirements: [
            { type: 'stat', stat: 'spirit', min: 13, description: '灵识至少 13' }
          ],
          outcome: {
            success: true,
            rewardPoints: 1980,
            lingyun: 8,
            items: { silence_core: 2, method_page: 1 },
            damage: 72,
            temporaryLog: '你听完最后广播，随身装备记住了确认队友仍然活着的最后一段人声。'
          },
          failureOutcome: sharedFailure('灵识在结尾前失守，最后广播把所有空白频道同时压入意识。', 178)
        },
        {
          id: 'overwrite_last_broadcast_noise',
          label: '以定神香覆写噪声',
          description: '消耗一支定神香，以稳定心念覆写底噪，并保存足以触发装备记忆的清晰人声。',
          risk: 'low',
          requirements: [
            { type: 'item', itemId: 'focus_incense', count: 1, description: '携带 1 支定神香' }
          ],
          outcome: {
            success: true,
            rewardPoints: 1480,
            lingyun: 6,
            items: { silence_core: 1 },
            temporaryLog: '定神香覆写底噪，随身装备在干净频道里记住了最后一段人声。'
          },
          failureOutcome: sharedFailure('定神香不足，覆写频率反被广播捕获，噪声沿专注回路骤然放大。', 170)
        }
      ]
    }
  ],
  lost_shelter: [
    {
      id: 'false_survivor_call',
      dungeonId: 'lost_shelter',
      nodeId: 'survivor_cell',
      title: '隔离舱里的求救',
      description: '隔离舱用失联队员的声音反复求救，真正的生命体征却藏在每次呼吸之间的空白里。',
      options: [
        {
          id: 'discern_false_survivor_call',
          label: '以灵识辨认呼吸',
          description: '保持沉默并逐段核对呼吸与点名记录，用灵识找出伪装频道的循环接缝。',
          risk: 'medium',
          requirements: [
            { type: 'stat', stat: 'spirit', min: 14, description: '灵识至少 14' }
          ],
          outcome: {
            success: true,
            rewardPoints: 1650,
            lingyun: 6,
            items: { rescue_badge: 1 },
            temporaryLog: '你从重复呼吸中找出循环接缝，伪装求救坍缩成一枚真实的救援铭牌。'
          },
          failureOutcome: sharedFailure('灵识被熟悉的求救声牵走，隔离舱沿意识回路注入一整段伪造濒死记忆。', 185)
        },
        {
          id: 'sever_false_survivor_call',
          label: '以破禁符切断求救',
          description: '消耗一枚破禁符切断隔离舱的拟声回路，只保留未经总控接管的身份凭证。',
          risk: 'low',
          requirements: [
            { type: 'item', itemId: 'dispel_talisman', count: 1, description: '携带 1 枚破禁符' }
          ],
          outcome: {
            success: true,
            rewardPoints: 1420,
            lingyun: 5,
            items: { rescue_badge: 1 },
            temporaryLog: '破禁符烧断拟声回路，隔离舱吐出一枚未被总控改写的救援铭牌。'
          },
          failureOutcome: sharedFailure('破禁符不足，断开的求救从两端同时回灌，伪声在隔离舱内完成接管。', 182)
        }
      ]
    },
    {
      id: 'last_roll_call',
      dungeonId: 'lost_shelter',
      nodeId: 'survivor_memory_stage',
      title: '最后一次点名',
      description: '点名台按失联名单逐个呼唤姓名；坚持听见回应能让装备记住活人，也会暴露护送队的真实位置。',
      options: [
        {
          id: 'persist_last_roll_call',
          label: '坚持完成全员点名',
          description: '承受总控的定位扫描，以灵识确认每一道回应来自仍然活着的幸存者。',
          risk: 'high',
          requirements: [
            { type: 'stat', stat: 'spirit', min: 15, description: '灵识至少 15' }
          ],
          outcome: {
            success: true,
            rewardPoints: 2140,
            lingyun: 8,
            items: { rescue_badge: 1, method_page: 1 },
            damage: 78,
            temporaryLog: '你坚持完成最后一次点名，随身装备记住了黑暗中仍有人回应的声音。'
          },
          failureOutcome: sharedFailure('灵识在最后几个姓名前失守，总控把全部无人应答记录同时压入意识。', 190)
        },
        {
          id: 'confirm_last_roll_call_identity',
          label: '以定神香确认身份',
          description: '消耗一支定神香隔绝定位扫描，逐一确认回应者身份并保存清晰的点名记录。',
          risk: 'low',
          requirements: [
            { type: 'item', itemId: 'focus_incense', count: 1, description: '携带 1 支定神香' }
          ],
          outcome: {
            success: true,
            rewardPoints: 1580,
            lingyun: 6,
            items: { rescue_badge: 1 },
            temporaryLog: '定神香隔绝总控扫描，随身装备在清晰点名中记住了仍然活着的回应。'
          },
          failureOutcome: sharedFailure('定神香不足，点名频率被总控接管，错误身份沿专注回路覆盖自我。', 184)
        }
      ]
    }
  ],
  false_testimony_court: [
    {
      id: 'anonymous_tip',
      dungeonId: 'false_testimony_court',
      nodeId: 'testimony_hall',
      title: '匿名线报的第四句话',
      description: '匿名线报声称掌握三证缺口，第四句话却使用了只有删录官才知道的交接编号。',
      options: [
        {
          id: 'cross_check_anonymous_tip',
          label: '逐句交叉核验',
          description: '以灵识对照声纹、时间戳与交接编号，从第四句话中拆出删录官留下的真实痕迹。',
          risk: 'medium',
          requirements: [
            { type: 'stat', stat: 'spirit', min: 16, description: '灵识至少 16' }
          ],
          outcome: {
            success: true,
            rewardPoints: 1780,
            lingyun: 7,
            items: { truth_fragment: 1 },
            temporaryLog: '你把第四句话与三份卷宗逐字对齐，匿名伪装剥落，只剩一枚未经删改的真证碎片。'
          },
          failureOutcome: sharedFailure('线报中的诱导顺序抢先闭合，错误交接编号沿意识回路被写成了亲历记忆。', 198)
        },
        {
          id: 'seal_anonymous_tip_channel',
          label: '以破禁符封存线报',
          description: '消耗一枚破禁符切断匿名频道，保留提交时间与原始声纹作为可核验的旁证。',
          risk: 'low',
          requirements: [
            { type: 'item', itemId: 'dispel_talisman', count: 1, description: '携带 1 枚破禁符' }
          ],
          outcome: {
            success: true,
            rewardPoints: 1510,
            lingyun: 6,
            items: { truth_fragment: 1 },
            temporaryLog: '破禁符封住匿名频道，原始提交时间与声纹被完整写入证物袋。'
          },
          failureOutcome: sharedFailure('破禁符不足，匿名频道在封存瞬间反向扩散，整段线报被改写成针对你的证词。', 194)
        }
      ]
    },
    {
      id: 'sealed_deposition',
      dungeonId: 'false_testimony_court',
      nodeId: 'cross_exam_stage',
      title: '封存证言的最后追问',
      description: '证言只允许再开启一次；继续追问能让装备记住真实回答，也会让主审提前锁定诘问者。',
      options: [
        {
          id: 'press_sealed_deposition',
          label: '坚持完成最后追问',
          description: '承受终审席的反向注视，以灵识逐句追问证言中被删去的交接责任。',
          risk: 'high',
          requirements: [
            { type: 'stat', stat: 'spirit', min: 17, description: '灵识至少 17' }
          ],
          outcome: {
            success: true,
            rewardPoints: 2260,
            lingyun: 9,
            items: { truth_fragment: 1, method_page: 1 },
            damage: 84,
            temporaryLog: '你完成最后追问，封存证言给出未被删改的回答，随身装备记住了这次真实诘问。'
          },
          failureOutcome: sharedFailure('灵识在最后追问前失守，主审把未完成的句子反写成一份完整伪证。', 205)
        },
        {
          id: 'stabilize_sealed_deposition',
          label: '以定神香稳定证言',
          description: '消耗一支定神香隔绝终审注视，保存足以触发装备记忆的清晰回答。',
          risk: 'low',
          requirements: [
            { type: 'item', itemId: 'focus_incense', count: 1, description: '携带 1 支定神香' }
          ],
          outcome: {
            success: true,
            rewardPoints: 1640,
            lingyun: 7,
            items: { truth_fragment: 1 },
            temporaryLog: '定神香隔绝终审注视，随身装备记住了封存证言中未经删改的最后回答。'
          },
          failureOutcome: sharedFailure('定神香不足，证言封套沿专注回路骤然收紧，真实回答被压成空白。', 200)
        }
      ]
    }
  ],
  combat_replay_stage: [
    {
      id: 'uncredited_take',
      dungeonId: 'combat_replay_stage',
      nodeId: 'rehearsal_hall',
      title: '未署名试演',
      description: '排演厅循环播放一段没有演员署名的胜利镜头，动作细节却与探索者尚未开始的录制完全一致。',
      options: [
        {
          id: 'trace_uncredited_take',
          label: '逐帧追查未署名镜头',
          description: '以灵识对照场记板和动作残影，从无名镜头中找出真实拍摄者留下的战痕。',
          risk: 'medium',
          requirements: [
            { type: 'stat', stat: 'spirit', min: 18, description: '灵识至少 18' }
          ],
          outcome: {
            success: true,
            rewardPoints: 1900,
            lingyun: 8,
            items: { combat_reel: 1 },
            temporaryLog: '你逐帧对齐动作残影，未署名试演剥落成一段未经终剪的战斗母带。'
          },
          failureOutcome: sharedFailure('镜头先一步认出你的动作，未发生的失败沿意识回路被写成亲历记忆。', 212)
        },
        {
          id: 'seal_uncredited_take',
          label: '以破禁符封存试演',
          description: '消耗一枚破禁符切断循环放映，只保留原始帧号与未经署名的动作轨迹。',
          risk: 'low',
          requirements: [
            { type: 'item', itemId: 'dispel_talisman', count: 1, description: '携带 1 枚破禁符' }
          ],
          outcome: {
            success: true,
            rewardPoints: 1620,
            lingyun: 7,
            items: { combat_reel: 1 },
            temporaryLog: '破禁符烧断循环放映，原始帧号和动作轨迹被完整封进母带盒。'
          },
          failureOutcome: sharedFailure('破禁符不足，放映环在封存瞬间反向加速，未署名镜头把你拖进重复试演。', 208)
        }
      ]
    },
    {
      id: 'last_retake',
      dungeonId: 'combat_replay_stage',
      nodeId: 'script_projection_stage',
      title: '最后一次重拍',
      description: '剧本投映台只允许再重拍一次；坚持完成能让装备记住真实动作，也会让终剪导演提前锁定镜头。',
      options: [
        {
          id: 'perform_last_retake',
          label: '坚持完成最后重拍',
          description: '承受终剪台的反向注视，以灵识把三段战斗重新演到真实胜利的最后一帧。',
          risk: 'high',
          requirements: [
            { type: 'stat', stat: 'spirit', min: 19, description: '灵识至少 19' }
          ],
          outcome: {
            success: true,
            rewardPoints: 2400,
            lingyun: 10,
            items: { combat_reel: 1, method_page: 1 },
            damage: 90,
            temporaryLog: '你完成最后重拍，剧本投映出未经删改的胜利，随身装备记住了真实动作。'
          },
          failureOutcome: sharedFailure('灵识在最后一帧前失守，终剪导演把未完成动作剪成一段完整败局。', 220)
        },
        {
          id: 'stabilize_last_retake',
          label: '以定神香稳定重拍',
          description: '消耗一支定神香隔绝终剪注视，保存足以触发装备记忆的清晰动作。',
          risk: 'low',
          requirements: [
            { type: 'item', itemId: 'focus_incense', count: 1, description: '携带 1 支定神香' }
          ],
          outcome: {
            success: true,
            rewardPoints: 1760,
            lingyun: 8,
            items: { combat_reel: 1 },
            temporaryLog: '定神香隔绝终剪注视，随身装备记住了最后重拍中未经删改的胜利动作。'
          },
          failureOutcome: sharedFailure('定神香不足，投映光沿专注回路骤然收紧，真实动作被压成空白帧。', 216)
        }
      ]
    }
  ],
  panopticon_city: [
    {
      id: 'blindspot_theater',
      dungeonId: 'panopticon_city',
      nodeId: 'blindspot_theater',
      title: '盲区剧场的缺席观众',
      description: '监控幕墙把每个动作都提前投向观众席，只有未被镜头承认的空位仍保留真实视角。',
      options: [
        {
          id: 'trace_blindspot_audience',
          label: '沿空席反查观测链',
          description: '以灵识追踪镜头主动避开的座位，在全景合拢前取回未经登记的观测棱片。',
          risk: 'medium',
          requirements: [
            { type: 'stat', stat: 'spirit', min: 20, description: '灵识至少 20' }
          ],
          outcome: {
            success: true,
            rewardPoints: 2020,
            lingyun: 9,
            items: { observation_shard: 1, dispel_talisman: 1 },
            temporaryLog: '你沿空席反查观测链，幕墙剥落出一枚观测棱片与可切断追踪的破禁符。'
          },
          failureOutcome: sharedFailure('全景镜头先一步补齐空席，你的行动被写进下一轮预判并遭到集中照射。', 224)
        },
        {
          id: 'blackout_blindspot_theater',
          label: '以定神香制造认知熄灯',
          description: '消耗一支定神香压低意识回声，让剧场短暂失去可供追踪的观众画像。',
          risk: 'low',
          requirements: [
            { type: 'item', itemId: 'focus_incense', count: 1, description: '携带 1 支定神香' }
          ],
          outcome: {
            success: true,
            rewardPoints: 1740,
            lingyun: 8,
            items: { observation_shard: 1, armor_patch: 1 },
            temporaryLog: '认知熄灯让剧场失去你的观众画像，你带走观测棱片与一块消光护甲补片。'
          },
          failureOutcome: sharedFailure('定神香不足，剧场把熄灯意图反标为异常信号，所有镜头同时转向你。', 220)
        }
      ]
    },
    {
      id: 'spectrum_switchyard',
      dungeonId: 'panopticon_city',
      nodeId: 'spectrum_switchyard',
      title: '全谱道岔的反向折光',
      description: '全谱道岔会把任何逃逸光路重新并入天幕；反向拨轨能留下反制品，也会暴露操作者的完整轮廓。',
      options: [
        {
          id: 'invert_spectrum_switchyard',
          label: '逆拨全谱道岔',
          description: '顶住全谱照射，把三条观测光路折回监察阵列，抢出用于反制锁定的棱片与符箓。',
          risk: 'high',
          requirements: [
            { type: 'stat', stat: 'trapCheck', min: 21, description: '陷阱感知至少 21' }
          ],
          outcome: {
            success: true,
            rewardPoints: 2540,
            lingyun: 11,
            items: { observation_shard: 2, dispel_talisman: 1 },
            damage: 96,
            temporaryLog: '你逆拨全谱道岔，三束观测光反切天幕，留下两枚观测棱片和一枚反制破禁符。'
          },
          failureOutcome: sharedFailure('道岔在反向闭合前锁定你的完整轮廓，全谱灼光沿每条退路同时落下。', 232)
        },
        {
          id: 'shroud_spectrum_switchyard',
          label: '以消光补片遮蔽道岔',
          description: '消耗一块护甲补片覆盖高反射枢轴，换取一条不会回传轮廓的安全折线路径。',
          risk: 'low',
          requirements: [
            { type: 'item', itemId: 'armor_patch', count: 1, description: '携带 1 块护甲补片' }
          ],
          outcome: {
            success: true,
            rewardPoints: 1880,
            lingyun: 9,
            items: { observation_shard: 1, focus_incense: 1 },
            temporaryLog: '消光补片遮住枢轴回光，你从安全折线取回观测棱片与一支反追踪定神香。'
          },
          failureOutcome: sharedFailure('护甲补片不足，枢轴回光把遮蔽动作放大成醒目标记，监察阵列立刻完成锁定。', 228)
        }
      ]
    }
  ]
};

function meetsRequirement(requirement: DungeonEventRequirement, context: DungeonEventContext): boolean {
  switch (requirement.type) {
    case 'none':
      return true;
    case 'method':
      return context.learnedMethods.includes(requirement.methodId);
    case 'equipment':
      return context.ownedEquipment.includes(requirement.equipmentId) || context.equipped.includes(requirement.equipmentId);
    case 'equipmentSet':
      return context.activeEquipmentSetTags?.includes(requirement.setTag) ?? false;
    case 'petPassive':
      return context.activePetPassiveTags.includes(requirement.passiveTag);
    case 'pet':
      return context.ownedPets.includes(requirement.petId);
    case 'item':
      return (context.inventory[requirement.itemId] ?? 0) >= requirement.count;
    case 'stat':
      return context.stats[requirement.stat] >= requirement.min;
  }
}

export function getDungeonEvents(dungeonId: DungeonId): DungeonEvent[] {
  return DUNGEON_EVENTS[dungeonId];
}

export function evaluateEventOptions(event: DungeonEvent, context: DungeonEventContext): EvaluatedDungeonEventOption[] {
  return event.options.map((option) => {
    const unmetRequirements = option.requirements.filter((requirement) => !meetsRequirement(requirement, context));

    return {
      ...option,
      available: unmetRequirements.length === 0,
      unmetRequirements
    };
  });
}

export function resolveDungeonEventChoice(
  event: DungeonEvent,
  optionId: string,
  context: DungeonEventContext
): DungeonEventOutcome {
  const option = event.options.find((eventOption) => eventOption.id === optionId);

  if (!option) {
    return sharedFailure('这个事件选项不存在，主神空间没有结算任何收益。', 0);
  }

  const evaluated = evaluateEventOptions(event, context).find((eventOption) => eventOption.id === optionId);
  if (!evaluated?.available) {
    return option.failureOutcome ?? sharedFailure(`${option.label} 的条件不足，事件转为失败结算。`, 12);
  }

  return option.outcome;
}
