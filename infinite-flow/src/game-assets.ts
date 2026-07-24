export const GAME_ASSET_MANIFEST_VERSION = 1;

export type GameAssetKind =
  | 'character'
  | 'npc'
  | 'monster'
  | 'equipment'
  | 'pet'
  | 'item'
  | 'dungeon'
  | 'scene';

export type GameAssetRole = 'portrait' | 'icon' | 'banner' | 'scene';
export type GameAssetSource = 'project-original-generated' | 'project-original-svg';

export type GameAssetDefinition = Readonly<{
  key: `${GameAssetKind}:${string}`;
  kind: GameAssetKind;
  entityId: string;
  src: `/${string}`;
  alt: string;
  role: GameAssetRole;
  width: number;
  height: number;
  fit: 'cover' | 'contain';
  source: GameAssetSource;
  sourceRevision: 1;
}>;

function defineAsset(
  kind: GameAssetKind,
  entityId: string,
  src: `/${string}`,
  alt: string,
  role: GameAssetRole,
  width: number,
  height: number,
  fit: 'cover' | 'contain',
  source: GameAssetSource
): GameAssetDefinition {
  return Object.freeze({
    key: `${kind}:${entityId}`,
    kind,
    entityId,
    src,
    alt,
    role,
    width,
    height,
    fit,
    source,
    sourceRevision: 1
  });
}

const characterAssets = [
  defineAsset(
    'character',
    'reincarnator',
    '/assets/characters/reincarnator-v1.png',
    '身穿修补战术护甲、携带符箓与短刃的轮回者',
    'portrait',
    768,
    768,
    'cover',
    'project-original-generated'
  )
];

const npcAssets = [
  ['pet_keeper', 'pet-keeper', '照料契约灵宠的宠物商人'],
  ['supply_trader', 'supply-trader', '携带药箱与符包的补给商人'],
  ['equipment_quartermaster', 'equipment-quartermaster', '管理模块武器的装备商人'],
  ['forge_smith', 'forge-smith', '手持符文锤的锻造商人'],
  ['method_master', 'method-master', '手持功法玉简的功法大师'],
  ['main_god_projection', 'main-god-projection', '由旧金扫描线构成的主神投影']
].map(([entityId, fileName, alt]) => defineAsset(
  'npc',
  entityId,
  `/assets/npcs/${fileName}-v1.png`,
  alt,
  'portrait',
  320,
  480,
  'cover',
  'project-original-generated'
));

const petAssets = [
  ['contract_sprite', 'contract-sprite', '由折叠符光构成的契约小灵'],
  ['mist_kitten', 'mist-kitten', '雾气缠绕四爪的雾爪幼兽'],
  ['ash_hound', 'ash-hound', '炭黑皮毛下透出火星的烬火犬'],
  ['mirror_moth', 'mirror-moth', '双翼映出青红倒影的镜翼蛾'],
  ['starling_drone', 'starling-drone', '由星铁与旧铜打造的星铁浮蜂'],
  ['void_whelp', 'void-whelp', '背部裂开青色界隙的虚空幼蜥']
].map(([entityId, fileName, alt]) => defineAsset(
  'pet',
  entityId,
  `/assets/pets/${fileName}-v1.png`,
  alt,
  'portrait',
  320,
  480,
  'contain',
  'project-original-generated'
));

const monsterAssets = [
  ['fog_lesser_demon', 'fog-lesser-demon', '从灰雾中显形的雾中妖鬼'],
  ['tower_butcher', 'tower-butcher', '披挂骨甲与重刃的剔骨塔卒'],
  ['tide_boatman', 'tide-boatman', '提灯涉水而来的潮影船夫'],
  ['mirror_thread_spider', 'mirror-thread-spider', '以镜面长足织出银丝的镜丝织蛛'],
  ['rail_wraith', 'rail-wraith', '断轨与电弧环绕的断轨怨影'],
  ['mine_shell_guard', 'mine-shell-guard', '披覆星矿晶壳的矿壳守卫'],
  ['spark_imp', 'spark-imp', '由炭火与恶意凝成的跳火小鬼'],
  ['portal_molt_beast', 'portal-molt-beast', '甲壳沿界隙裂开的裂门蜕兽'],
  ['plague_orderly', 'plague-orderly', '携带锈蚀医疗工具的锈疫护工'],
  ['pulse_doctor', 'pulse-doctor', '操纵脉冲器械的脉冲医师'],
  ['ash_duelist', 'ash-duelist', '甲片间燃着余烬的灰烬斗士'],
  ['furnace_judge', 'furnace-judge', '执掌炽热裁决刃的炉心裁判'],
  ['paper_librarian', 'paper-librarian', '空白书页环绕的无面纸面馆主'],
  ['dream_jailer', 'dream-jailer', '拖曳梦锁与封存笼的梦牢看守'],
  ['void_knight', 'void-knight', '甲片悬浮于界隙之间的虚界骑士'],
  ['main_god_echo', 'main-god-echo', '由黑曜碎面与扫描环构成的主神残响'],
  ['clockwork_scout', 'clockwork-scout', '拖曳时序残影的发条侦察兵'],
  ['epoch_sentinel', 'epoch-sentinel', '背负纪元环与冲击残响的纪元哨卫'],
  ['zero_hour_regent', 'zero-hour-regent', '过去与未来重影交叠的零时摄政'],
  ['verdict_usher', 'verdict-usher', '手持悬浮裁决武器的裁决执事'],
  ['paradox_bailiff', 'paradox-bailiff', '因果位置彼此倒置的悖论法警'],
  ['zero_sum_auditor', 'zero-sum-auditor', '双侧衡臂汇入黑曜核心的零和审计官'],
  ['entropy_deckhand', 'entropy-deckhand', '失序结晶缠身的熵舱水手'],
  ['dissipation_navigator', 'dissipation-navigator', '与破损星盘融合的耗散领航员'],
  ['last_helmsman', 'last-helmsman', '与崩解舵轮融为一体的终末舵手'],
  ['parallax_hunter', 'parallax-hunter', '本体与镜像彼此错位的视差猎手'],
  ['mirror_chorus', 'mirror-chorus', '多重镜像躯干交叠的镜群合唱者'],
  ['nameless_reflection', 'nameless-reflection', '身披黑曜镜甲的无名镜王'],
  ['erasure_copyist', 'erasure-copyist', '空白书页环绕的删界抄写员'],
  ['palimpsest_censor', 'palimpsest-censor', '以覆写书页作盾的覆页裁定者'],
  ['last_redactor', 'last-redactor', '手持巨型删界笔的终稿删界官'],
  ['reserve_bailiff', 'reserve-bailiff', '账本锁链缠腕的底价执役'],
  ['inheritance_mimic', 'inheritance-mimic', '遗物与面孔不断变形的遗产拟形体'],
  ['estate_auctioneer', 'estate-auctioneer', '巨槌与手臂融合的遗产执槌人'],
  ['gene_stalker', 'gene-stalker', '血清瓶嵌入肋骨的基因猎犬'],
  ['mutation_guardian', 'mutation-guardian', '活性甲壳与血清罐共生的变异守库体'],
  ['primal_curator', 'primal-curator', '托起螺旋样本架的原型典藏官'],
  ['frequency_leech', 'frequency-leech', '波形触须贯穿胸口的频段寄生体'],
  ['dead_air_mimic', 'dead-air-mimic', '磁带环缠绕玻璃耳面的死频拟声体'],
  ['broadcast_warden', 'broadcast-warden', '以锁频盾护身的广播守卫'],
  ['last_broadcaster', 'last-broadcaster', '与三座中继桅杆融合的末频道播音主'],
  ['mimic_survivor', 'mimic-survivor', '皮下浮现第二张脸的拟声幸存者'],
  ['shelter_enforcer', 'shelter-enforcer', '路障与注射器构成双臂的避难所执行体'],
  ['evacuation_horror', 'evacuation-horror', '担架与撤离束带扭结成的撤离畸变体'],
  ['shelter_overseer', 'shelter-overseer', '监控屏与警报号角组成的失联总控'],
  ['hostile_witness', 'hostile-witness', '被锁在证词架上的敌意证人'],
  ['archive_censor', 'archive-censor', '档案盒吞没空白证页的档案删录官'],
  ['perjury_hound', 'perjury-hound', '由案卷与铁骨缝合的伪证猎犬'],
  ['false_testimony_judge', 'false-testimony-judge', '胸嵌三盏裁定灯的伪证主审'],
  ['cue_stalker', 'cue-stalker', '沿起拍光束扑出的场记潜猎者'],
  ['continuity_editor', 'continuity-editor', '双手形似剪刀的连续性剪辑师'],
  ['retake_double', 'retake-double', '双躯共用一条脊柱的重拍替身'],
  ['final_cut_director', 'final-cut-director', '冻结画框环绕头部的终剪导演'],
  ['sweep_sentinel', 'sweep-sentinel', '扇形视锥扫过黑甲的扫视哨兵'],
  ['blindspot_auditor', 'blindspot-auditor', '以空白账本覆面的盲区审计官'],
  ['exposure_double', 'exposure-double', '正反重影同时过曝的曝光替身'],
  ['all_sight_warden', 'all-sight-warden', '观测透镜环绕核心的万目监察者']
].map(([entityId, fileName, alt]) => defineAsset(
  'monster',
  entityId,
  `/assets/monsters/${fileName}-v1.png`,
  alt,
  'portrait',
  288,
  384,
  'contain',
  'project-original-generated'
));

const equipmentAssets = [
  ['training_blade', 'training-blade', '带有使用痕迹的训练短刃'],
  ['patched_headwrap', 'patched-headwrap', '缝有金属额片的拼缝头巾'],
  ['patched_coat', 'patched-coat', '经过多次修补的黑色外套'],
  ['patched_gloves', 'patched-gloves', '带护片的拼缝手套'],
  ['patched_boots', 'patched-boots', '鞋底加装薄铁片的拼缝短靴'],
  ['patched_belt', 'patched-belt', '悬挂补给袋的拼缝束带'],
  ['plain_charm', 'plain-charm', '尚未刻纹的空白护符'],
  ['armor_piercing_sword', 'armor-piercing-sword', '剑锋狭长的破甲剑'],
  ['bone_spear', 'bone-spear', '以妖骨磨制的白骨长矛'],
  ['ember_staff', 'ember-staff', '核心封存余火的烬火法杖'],
  ['mist_hood', 'mist-hood', '边缘缝着青线的雾行兜帽'],
  ['spirit_robe', 'spirit-robe', '以灵线固定衣片的凝神法袍'],
  ['guardian_plate', 'guardian-plate', '厚重的镇岳胸甲'],
  ['guardian_gauntlets', 'guardian-gauntlets', '成对的镇岳护手'],
  ['cloudstep_boots', 'cloudstep-boots', '轻量化的云隙行靴'],
  ['rift_belt', 'rift-belt', '装有界隙锚扣的裂隙束带'],
  ['cloudstep_charm', 'cloudstep-charm', '形似窄翼的云隙护符'],
  ['rift_charm', 'rift-charm', '中央石片裂开的虚界护符'],
  ['starforged_edge', 'starforged-edge', '剑身浮现金色星裂的淬星剑胚'],
  ['void_lantern', 'void-lantern', '封存青色虚火的虚界灯'],
  ['chronal_edge', 'chronal-edge', '刃脊拖出逆行时痕的时序刃'],
  ['chronal_aegis', 'chronal-aegis', '层叠甲片环抱停滞核心的时序盾'],
  ['chronal_lens', 'chronal-lens', '黄铜环悬起青色镜片的时序透镜'],
  ['causal_visor', 'causal-visor', '双重视路汇于金色铰点的因果视镜'],
  ['echo_breaker_gauntlets', 'echo-breaker-gauntlets', '装有回响阻尼器的断响拳套'],
  ['return_anchor_belt', 'return-anchor-belt', '收纳界锚与牵引索的归航锚带'],
  ['entropy_compass', 'entropy-compass', '指针悬于失序漩涡上的熵航罗盘'],
  ['dissipation_mantle', 'dissipation-mantle', '边缘散作青色微尘的耗散披甲'],
  ['ark_keel_boots', 'ark-keel-boots', '以方舟龙骨加固的重型短靴'],
  ['parallax_visor', 'parallax-visor', '两层视面彼此错位的视差面甲'],
  ['phaseweave_mantle', 'phaseweave-mantle', '实体织物与相位纤维重叠的相织披风'],
  ['homecoming_prism', 'homecoming-prism', '内部封存归航暖光的归真棱镜'],
  ['redline_edge', 'redline-edge', '刃身留有暗红断章线的朱批断章刃'],
  ['palimpsest_mantle', 'palimpsest-mantle', '旧轮廓覆压于多层甲片下的覆页披甲'],
  ['final_proof_seal', 'final-proof-seal', '底面无字的黑金终校印玺'],
  ['legacy_gavel', 'legacy-gavel', '经战斗加固的亡队落槌'],
  ['anonymous_veil', 'anonymous-veil', '以金属细肋固定的无名竞标面'],
  ['escrow_plate', 'escrow-plate', '双锁扣封住青色核心的托管契甲'],
  ['final_lot_bell', 'final-lot-bell', '内悬暗红钟舌的终场号钟'],
  ['helix_cleaver', 'helix-cleaver', '双股斧刃交缠成螺旋的断链斧'],
  ['symbiote_cowl', 'symbiote-cowl', '神经光脉游走其上的共生冠膜'],
  ['carapace_harness', 'carapace-harness', '活性甲片沿冲击方向增生的原型甲壳'],
  ['rebirth_amulet', 'rebirth-amulet', '黑曜外壳包裹暗红胚心的复燃胚核'],
  ['hushblade', 'hushblade', '装有青色消声鳍的断频长刃'],
  ['dead_air_headset', 'dead-air-headset', '耳杯环绕死频波光的死频耳罩'],
  ['anechoic_mantle', 'anechoic-mantle', '表面铺满消声鳞纹的消声披甲'],
  ['last_channel_beacon', 'last-channel-beacon', '天线弯折并亮起急停灯的末路断播器'],
  ['rescue_carbine', 'rescue-carbine', '配有信标纹与青色导轨的救援卡宾枪'],
  ['triage_visor', 'triage-visor', '分光镜片映出警示灯的分诊目镜'],
  ['evacuation_plate', 'evacuation-plate', '肩灯与撤离信标点亮的撤离护甲'],
  ['blackbox_beacon', 'blackbox-beacon', '定位天线伸出黑匣外壳的黑匣信标'],
  ['cross_examiner_sabre', 'cross-examiner-sabre', '金色交叉线贯穿刃面的诘问裁刃'],
  ['forensic_visor', 'forensic-visor', '双镜片投射取证扫描线的溯证目镜'],
  ['custody_shell', 'custody-shell', '金色锁扣封住青色核心的封证护甲'],
  ['appeal_seal', 'appeal-seal', '底面无字的黑金翻案印玺'],
  ['frame_engraver', 'frame-engraver', '刃身嵌有母带槽的定帧刻刀'],
  ['cue_visor', 'cue-visor', '相位环包围单眼镜筒的起拍目镜'],
  ['buffer_plate', 'buffer-plate', '多层甲板分散冲击的缓冲叠甲'],
  ['thaw_metronome', 'thaw-metronome', '摆杆亮起解冻光的解冻节拍器'],
  ['blindline_cutter', 'blindline-cutter', '折光刃口划出切线的断视切线刃'],
  ['predictive_visor', 'predictive-visor', '多相扫描镜片重叠的先见目镜'],
  ['matte_shell', 'matte-shell', '吸收光线的黑色消光披甲'],
  ['inverse_prism', 'inverse-prism', '青色折光逆行汇入红核的逆观棱镜']
].map(([entityId, fileName, alt]) => defineAsset(
  'equipment',
  entityId,
  `/assets/equipment/${fileName}-v1.png`,
  alt,
  'icon',
  160,
  200,
  'contain',
  'project-original-generated'
));

const itemAssets = [
  ['healing_pill', 'healing-pill', '装有红色止血丹的黑陶药瓶'],
  ['thunder_talisman', 'thunder-talisman', '缠绕细小雷火的符箓束'],
  ['dispel_talisman', 'dispel-talisman', '置于破裂封印环上的破禁符'],
  ['gate_sigil', 'gate-sigil', '嵌有青色界石的小界门符'],
  ['echo_coin', 'echo-coin', '刻有同心回波的回响铜币'],
  ['capture_net', 'capture-net', '折叠在符文握柄上的捕灵网'],
  ['spirit_bait', 'spirit-bait', '封在玻璃诱饵瓶中的灵质'],
  ['armor_patch', 'armor-patch', '带铆钉的黑色护甲补片'],
  ['focus_incense', 'focus-incense', '置于金属香座中的定神香'],
  ['demon_bone', 'demon-bone', '带有磨损血痕的弯曲妖骨'],
  ['hidden_stone', 'hidden-stone', '矿缝形似眼睛的隐匿石'],
  ['medicine_ash', 'medicine-ash', '装在焦黑小瓶中的药灰'],
  ['mirror_shell', 'mirror-shell', '映出青红光泽的镜壳碎片'],
  ['star_iron', 'star-iron', '表面带银色断面的星铁锭'],
  ['method_page', 'method-page', '留有抽象墨痕的残缺功法页'],
  ['cracked_core', 'cracked-core', '外壳破裂并露出青光的裂核'],
  ['rift_dust', 'rift-dust', '装在三角玻璃瓶中的裂隙尘'],
  ['chronal_glass', 'chronal-glass', '内部嵌有轮刻的时序玻璃'],
  ['causal_seal', 'causal-seal', '三枚因果环扣合而成的因果印'],
  ['entropy_crystal', 'entropy-crystal', '裂缝透出金光的熵晶'],
  ['cycle_imprint', 'cycle-imprint', '刻有同心轮槽与金色游标的轮回刻印'],
  ['phase_glass', 'phase-glass', '内部映出双重轮廓的相位镜晶'],
  ['redaction_ink', 'redaction-ink', '封存吞光黑液的删界墨瓶'],
  ['legacy_scrip', 'legacy-scrip', '刻有抽象筹线的黑金遗产筹码'],
  ['genesis_serum', 'genesis-serum', '青红螺旋液体交叠的原型血清'],
  ['silence_core', 'silence-core', '以消声鳍片包裹青光的静默晶核'],
  ['rescue_badge', 'rescue-badge', '带有抽象信标纹的磨损救援铭牌'],
  ['truth_fragment', 'truth-fragment', '锁住一道金色真光的真证碎片'],
  ['combat_reel', 'combat-reel', '外壳留有暗红刻度的战斗母带'],
  ['observation_shard', 'observation-shard', '多层镜面汇聚扫描线的观测棱片']
].map(([entityId, fileName, alt]) => defineAsset(
  'item',
  entityId,
  `/assets/items/${fileName}-v1.png`,
  alt,
  'icon',
  160,
  200,
  'contain',
  'project-original-generated'
));

const dungeonAssets = [
  ['mirror_cycle_city', 'mirror-cycle-city', '轮回城现实与镜像双相街区'],
  ['redaction_scriptorium', 'redaction-scriptorium', '被裁去部分书页的终稿院档案库'],
  ['legacy_auction_court', 'legacy-auction-court', '悬挂亡队遗物的拍卖庭'],
  ['genesis_vault', 'genesis-vault', '排列原型罐与螺旋档案的众生原型库'],
  ['silent_broadcast_tower', 'silent-broadcast-tower', '波形灯断裂的寂声播音塔'],
  ['lost_shelter', 'lost-shelter', '停电后仍有拟声影徘徊的失联避难所'],
  ['false_testimony_court', 'false-testimony-court', '证据灯箱照亮嫌疑人剪影的伪证裁定庭'],
  ['combat_replay_stage', 'combat-replay-stage', '架设母带机与动作胶片窗的战痕复演场'],
  ['panopticon_city', 'panopticon-city', '扫描天幕横跨街区的天幕监察城']
].map(([entityId, fileName, alt]) => defineAsset(
  'dungeon',
  entityId,
  `/${fileName}.svg`,
  alt,
  'banner',
  720,
  180,
  'cover',
  'project-original-svg'
));

const generatedDungeonAssets = [
  ['demon_tower_1', 'demon-tower-1', '青雾沿黑石回廊蔓延的妖塔一层'],
  ['metro_abyss', 'metro-abyss', '黑潮倒映破损列车的镜潮地铁'],
  ['starfall_mine', 'starfall-mine', '星铁矿脉照亮深井的星坠矿井'],
  ['rust_hospital', 'rust-hospital', '隔离帘与锈蚀病床交错的锈疫病院'],
  ['ash_arena', 'ash-arena', '余烬环绕中央决斗场的灰烬竞技场'],
  ['dream_archive', 'dream-archive', '空白书页悬于无尽书架间的梦档案馆'],
  ['void_citadel', 'void-citadel', '界隙裂光贯穿黑曜长廊的虚界城'],
  ['temporal_observatory', 'temporal-observatory', '时序环围绕冻结星图的时序观测庭'],
  ['causal_clearinghouse', 'causal-clearinghouse', '双侧机轨汇入裁决核心的因果清算所'],
  ['entropy_ark', 'entropy-ark', '航迹在熵海上逐渐崩解的熵海方舟']
].map(([entityId, fileName, alt]) => defineAsset(
  'dungeon',
  entityId,
  `/assets/dungeons/${fileName}-v1.png`,
  alt,
  'banner',
  720,
  180,
  'cover',
  'project-original-generated'
));

const sceneAssets = [
  defineAsset(
    'scene',
    'main_god_space',
    '/main-god-space.svg',
    '黑曜石环形主神空间与中央光核',
    'scene',
    1600,
    900,
    'cover',
    'project-original-svg'
  )
];

const assets = [
  ...characterAssets,
  ...npcAssets,
  ...petAssets,
  ...monsterAssets,
  ...equipmentAssets,
  ...itemAssets,
  ...dungeonAssets,
  ...generatedDungeonAssets,
  ...sceneAssets
];

export const GAME_ASSET_MANIFEST: Readonly<Record<string, GameAssetDefinition>> = Object.freeze(
  Object.fromEntries(assets.map((asset) => [asset.key, asset]))
);

export function getGameAsset(kind: GameAssetKind, entityId: string): GameAssetDefinition | undefined {
  return GAME_ASSET_MANIFEST[`${kind}:${entityId}`];
}

export function listGameAssets(kind?: GameAssetKind): readonly GameAssetDefinition[] {
  return kind ? assets.filter((asset) => asset.kind === kind) : assets;
}

export function getGameAssetCoverage(kind: GameAssetKind, entityIds: readonly string[]): {
  covered: number;
  total: number;
  missingIds: string[];
} {
  const missingIds = entityIds.filter((entityId) => !getGameAsset(kind, entityId));
  return { covered: entityIds.length - missingIds.length, total: entityIds.length, missingIds };
}
