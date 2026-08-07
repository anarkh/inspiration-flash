# 内容目录与稳定 ID

本文件提供迁移导航，不替代源码目录。显示名可以本地化，稳定 ID 不能在没有 migration 的情况下修改。

## 1. 章节总表

章节顺序以 `src/level-content.ts:DUNGEON_ORDER` 为准，类型以 `src/game.ts:DungeonId` 为准。

| 章 | 稳定 ID | 名称 | 题材 | 推荐战力 | 场域法则 | Boss |
| --- | --- | --- | --- | ---: | --- | --- |
| 1 | `demon_tower_1` | 妖塔一层 | 修真异境 | 150 | 妖雾压境 | 雾塔剔骨监斩官 / `tower_butcher` |
| 2 | `metro_abyss` | 镜潮地铁 | 现代危机 | 185 | 末班潮序 | 镜潮织命蛛后 / `mirror_thread_spider` |
| 3 | `starfall_mine` | 星坠矿井 | 未来科技 | 230 | 重力极向 | 星脉裂门蜕王 / `portal_molt_beast` |
| 4 | `rust_hospital` | 锈疫病院 | 现代危机 | 265 | 锈疫污染 | 终诊脉冲主治 / `pulse_doctor` |
| 5 | `ash_arena` | 灰烬竞技场 | 规则异闻 | 305 | 熔炉判词 | 熔炉终审裁判 / `furnace_judge` |
| 6 | `dream_archive` | 梦档案馆 | 规则异闻 | 345 | 失败封存 | 失名梦牢典守 / `dream_jailer` |
| 7 | `void_citadel` | 虚界城 | 未来科技 | 390 | 终局回声 | 失衡主神残响 / `main_god_echo` |
| 8 | `temporal_observatory` | 时序观测庭 | 未来科技 | 435 | 时间校准 | 零时摄政王 / `zero_hour_regent` |
| 9 | `causal_clearinghouse` | 因果清算所 | 规则异闻 | 500 | 因果账本 | 因果零和总审计官 / `zero_sum_auditor` |
| 10 | `entropy_ark` | 熵海方舟 | 未来科技 | 565 | 方舟航态 | 熵海终末舵手 / `last_helmsman` |
| 11 | `mirror_cycle_city` | 镜海轮回城 | 规则异闻 | 630 | 镜海相位 | 无名镜王 / `nameless_reflection` |
| 12 | `redaction_scriptorium` | 删界终稿院 | 规则异闻 | 700 | 删界终稿 | 终稿删界官 / `last_redactor` |
| 13 | `legacy_auction_court` | 亡队遗产拍卖庭 | 现代危机 | 780 | 亡队遗产拍卖 | 遗产执槌人 / `estate_auctioneer` |
| 14 | `genesis_vault` | 众生原型库 | 未来科技 | 860 | 众生原型拼接 | 原型典藏官 / `primal_curator` |
| 15 | `silent_broadcast_tower` | 寂声广播塔 | 现代危机 | 950 | 寂声广播律 | 末频道播音主 / `last_broadcaster` |
| 16 | `lost_shelter` | 失联避难所 | 现代危机 | 1040 | 失联护送律 | 失联总控 / `shelter_overseer` |
| 17 | `false_testimony_court` | 伪证裁定庭 | 现代危机 | 1140 | 伪证裁定律 | 伪证主审 / `false_testimony_judge` |
| 18 | `combat_replay_stage` | 战痕复演场 | 未来科技 | 1240 | 战痕复演律 | 终剪导演 / `final_cut_director` |
| 19 | `panopticon_city` | 天幕监察城 | 未来科技 | 1350 | 三相监察律 | 万目监察者 / `all_sight_warden` |

题材枚举：

```text
cultivation       修真异境
modern            现代危机
science_fiction   未来科技
anomaly           规则异闻
```

## 2. 每章不可压平的独特机制

### 第 1–4 章：建立“环境状态会改变路线”

- 妖塔：危险节点推动雾压，恢复地标和事件降低雾压；高雾侧路、恢复和首领路线是不同对象。
- 地铁：退潮、涨潮、镜潮循环改变轨道；`signal_cache` 可校准回退潮。
- 矿井：上浮/下沉重力改变陷阱和敌人防御，并开放不同矿梯。
- 病院：承伤提高污染，药房/分诊降低污染；治疗效率和术法压力随污染变化。

### 第 5–8 章：建立“玩家行为会被章节记录”

- 竞技场：记录战斗开局的力/术/守；重复招式受罚，三式齐全改判。
- 梦档案馆：依次封存道具、功法、宠物；索引可解除封存。
- 虚界城：统计战斗开局分布；Boss 冻结并克制偏科，均衡分布关闭克制。
- 时序观测庭：过去、未来双锚独立校准；单锚和双锚打开不同捷径。

### 第 9–13 章：建立“局内选择、代价与 Boss 快照”

- 因果：每次普通战或陷阱后平衡、透支或偿还；债务冻结为 Boss 追缴印。
- 熵海：三座航向台稳航或抢航，熵值偏离平衡产生 Boss 崩解层。
- 镜城：现实/镜像相位改变输出倾向，切换付生命；锚点削镜壳。
- 删界：核准条款开放区域但强化 Boss；删去付生命并永久关区。
- 拍卖：竞得、焚毁、放弃四件拍品；玩家与 Boss 分别继承结果。

### 第 14–19 章：建立“构筑、证据、录制和路线冻结”

- 原型库：三槽有序拼接力/术/守/归返基因；多样性和重复基因打开不同库房。
- 广播塔：三中继静默或播送；noise 同时带来风险、输出和区域分流。
- 避难所：幸存者从 100 HP 开始，三检查点治疗或强推；最终 HP 分流奖励区。
- 裁定庭：三证可净证或污染，原始裁决瞬间的净证数冻结奖励分流；翻案不能改写原始分流。
- 复演场：三段母带记录攻击/战技/防御的真实值，再锁定顺序/爆发/余拍路线。
- 监察城：移动推进三相扫描并累计曝光，完成三中继后锁定影路/诱饵/折光。

章节实现来源：

```text
src/level-data/*.ts       地图、节点、主题和推荐文案
src/dungeon-laws.ts       law 状态、选择、入场被动、Boss 快照和显示
src/dungeon-routes.ts     手写路线门、区段和动态边
src/dungeon-events.ts     章节事件与风险选项
src/boss-system.ts        Boss、阶段、掉落和出口封印
src/directive-system.ts   每章额外指令
```

## 3. 三条共享路线层

每章不只有一套“路线”：

1. 章节法则路线门：属于主线路线拓扑。
2. 隐藏路线契约：每章 3 个，严格目标 1→2，失败不阻主线。
3. 复刷协议：`standard`、`imprint`、`deep`。

它们不能在迁移时合并成一个难度字段。

## 4. 道具

权威源：

```text
src/game.ts: ItemId, ITEMS
src/tactical-loadout.ts: TACTICAL_ITEM_IDS
src/dungeon-loot.ts: DUNGEON_MATERIAL_REWARDS
```

### 4.1 九种战术携行

```text
healing_pill
thunder_talisman
dispel_talisman
armor_patch
focus_incense
gate_sigil
echo_coin
capture_net
spirit_bait
```

### 4.2 二十一种材料或永久资源

```text
demon_bone
hidden_stone
medicine_ash
mirror_shell
star_iron
method_page
cracked_core
rift_dust
chronal_glass
cycle_imprint
causal_seal
entropy_crystal
phase_glass
redaction_ink
legacy_scrip
genesis_serum
silence_core
rescue_badge
truth_fragment
combat_reel
observation_shard
```

章节材料与章节映射必须从 `DUNGEON_MATERIAL_REWARDS` 读取，不能按显示名猜。

## 5. 装备

权威源：

```text
src/game.ts: EquipmentId, EQUIPMENT
src/dungeon-loot.ts: DUNGEON_EQUIPMENT_POOLS
src/equipment-system.ts
src/weapon-skills.ts
```

### 5.1 七件初始装备

```text
training_blade
patched_headwrap
patched_coat
patched_gloves
patched_boots
patched_belt
plain_charm
```

### 5.2 五十八件成熟装备

早期共享：

```text
armor_piercing_sword
bone_spear
ember_staff
mist_hood
spirit_robe
guardian_plate
guardian_gauntlets
cloudstep_boots
rift_belt
cloudstep_charm
rift_charm
starforged_edge
void_lantern
```

第 8–12 章：

```text
chronal_edge
chronal_aegis
chronal_lens
causal_visor
echo_breaker_gauntlets
return_anchor_belt
entropy_compass
dissipation_mantle
ark_keel_boots
parallax_visor
phaseweave_mantle
homecoming_prism
redline_edge
palimpsest_mantle
final_proof_seal
```

第 13–15 章：

```text
legacy_gavel
anonymous_veil
escrow_plate
final_lot_bell
helix_cleaver
symbiote_cowl
carapace_harness
rebirth_amulet
hushblade
dead_air_headset
anechoic_mantle
last_channel_beacon
```

第 16–19 章：

```text
rescue_carbine
breach_shotgun
triage_visor
evacuation_plate
blackbox_beacon
cross_examiner_sabre
forensic_visor
custody_shell
appeal_seal
frame_engraver
cue_visor
buffer_plate
thaw_metronome
blindline_cutter
phase_coil_rifle
predictive_visor
matte_shell
inverse_prism
```

`breach_shotgun` 与 `phase_coil_rifle` 是后续新增内容，旧试玩文档未包含。

### 5.3 装备子系统

装备槽：

```text
weapon | head | armor | hands | feet | waist | charm
```

铭刻分支 8 个：

```text
mist_vanguard
mist_veilguard
forge_overdrive
forge_channeling
rift_resonance
rift_anchor
chronal_acceleration
chronal_stasis
```

器魂 6 个：

```text
mist_fixed_point
spirit_grounding
gauntlet_breakbeat
cloudstep_retrace
rift_misalignment
rift_seal
```

携行挂载 8 个：

```text
rift_belt_portal_rig
cloudstep_charm_capture_rig
rift_charm_ward_rig
void_lantern_any_rig
frame_engraver_combat_rig
cue_visor_capture_rig
buffer_plate_ward_rig
thaw_metronome_any_rig
```

武器技稳定 ID：

```text
armor_sunder
bone_pursuit
ember_rekindle
starforged_finale
chronal_reversal
breach_salvo
phase_coil_acceleration
```

回响导管没有独立 ID，以 `equipmentId + frameId` 为身份。装备委托也没有 `commissionId`，其稳定身份由：

```text
rulesVersion
equipmentIds[2]
targetMaterialId
completedDungeonIds
```

共同组成。迁移时不要臆造会与历史存档冲突的新 ID。

## 6. 宠物、同伴、功法、血统和回响

### 宠物 6

```text
contract_sprite
mist_kitten
ash_hound
mirror_moth
starling_drone
void_whelp
```

权威：`src/pet-system.ts:PETS`。

宠物不同于同伴、功法和血统：当前模型没有宠物 run 快照。战斗读取聚合根顶层 `activePet/petLevels`；在局内低血量捕获成功后，新宠物会立即成为 active，并可参与本局后续战斗。迁移端不得擅自把它改成“下局才生效”。

### 同伴 3

```text
qin_che       秦彻
zhou_yingxue  周映雪
lu_guanlan    陆观澜
```

权威：`src/companion-system.ts:COMPANION_CATALOG`。

### 功法 7

```text
mist_breathing
iron_body
cloud_step
gate_sense
star_core_method
beast_taming
void_heart
```

权威：`src/game.ts:METHODS` 与 `src/method-cultivation.ts:METHOD_TECHNIQUE_CATALOG`。

所有已学功法在入场时冻结；每门功法战技每场各一次。“常用功法”只改变显示顺序。

### 血统 4

```text
titan_marrow
void_symbiote
bastion_chitin
phoenix_ember
```

权威：`src/bloodline-system.ts:BLOODLINE_CATALOG`。

### 局内回响 9

框架：

```text
assault | bulwark | wayfinder
```

遗物：

```text
assault:   mist_edge, focus_prism, hunter_clock
bulwark:   bone_shell, mending_thread, iron_echo
wayfinder: rift_step, gate_anchor, lucky_map
```

回响是 run-only。归档只影响未来首轮候选种子，不能迁移成永久装备属性。

## 7. 任务、指令与长期目标

### 7.1 主神任务 63

权威：`src/task-system.ts`。

- 19 主线：`mainline_clear_<DungeonId>`。
- 38 章节支线：每章 `side_enter_<DungeonId>` 与 `side_directive_<DungeonId>`。
- 6 全局支线：
- 63 个任务的奖励点合计为 **5560**；迁移时不能只保留任务数量而漏掉奖励。

```text
side_recruit_first_companion
side_train_companion_rank_2
side_refine_first_method_rank_2
side_master_first_method_rank_3
side_unlock_first_bloodline
side_master_first_bloodline_rank_3
```

旧领奖兼容 ID：

```text
clear_demon_tower
clear_metro_abyss
```

### 7.2 每章主神指令

稳定 ID：

```text
directive_<DungeonId>
```

权威：`src/directive-system.ts:MAIN_GOD_DIRECTIVES`。

当前恰有 **19** 条，每章一条。

### 7.3 装备追猎

权威：`src/equipment-hunts.ts:EQUIPMENT_HUNT_DEFINITIONS`。

现代新局不再预选追猎目标；历史目录继续服务旧档兼容。常规 ID 为：

```text
equipment_hunt_<DungeonId>
```

伪证章历史例外：

```text
equipment_hunt_false_testimony
```

### 7.4 装备记忆

权威：`src/equipment-memory-hunts.ts`。

- 19 段记忆。
- 58 件成熟装备可承载记忆。
- 1102 个稳定组合。
- 常规 ID：`equipment_memory_<DungeonId>`。
- 伪证章历史例外：`equipment_memory_false_testimony`。
- 现行 `entryFlowVersion = 2` 不再创建预选的装备记忆狩猎，并会在入场时清除历史准备字段；旧入口与旧档仍保留兼容恢复。
- 已经解锁并激活的装备记忆不是废弃内容：它仍会由 `equipmentMemorySnapshot` 冻结进本局并参与对应装备效果。

## 8. 五十七个隐藏路线契约

权威：`src/route-contracts.ts:ROUTE_CONTRACT_CATALOG`。

| 章节 | 三个稳定 contract ID |
| --- | --- |
| 妖塔 | `tower_mist_watch`、`tower_ash_blade`、`tower_lower_hunt` |
| 地铁 | `metro_wraith_return`、`metro_flood_reflection`、`metro_relay_floodgate` |
| 矿井 | `mine_roost_inversion`、`mine_ore_shell`、`mine_dust_switch` |
| 病院 | `hospital_orderly_sterilizer`、`hospital_roof_rounds`、`hospital_patrol_gurney` |
| 竞技场 | `arena_duelist_gutter`、`arena_penalty_ringbreaker`、`arena_lancer_white_step` |
| 档案馆 | `archive_librarian_record`、`archive_paper_jailer`、`archive_afterimage_margin` |
| 虚界城 | `citadel_knight_shadow`、`citadel_memory_guard`、`citadel_shard_name` |
| 时序 | `temporal_epoch_recharge`、`temporal_unborn_erased`、`temporal_north_acceleration` |
| 因果 | `causal_alpha_recharge`、`causal_sentence_bailiff`、`causal_effect_verdict` |
| 熵海 | `entropy_deckhand_recharge`、`entropy_wake_ballast`、`entropy_navigator_lock` |
| 镜城 | `mirror_hunter_recharge`、`mirror_shard_fracture`、`mirror_chorus_rehearsal` |
| 删界 | `redaction_copyist_recharge`、`redaction_sentence_south_lock`、`redaction_censor_errata` |
| 拍卖 | `legacy_reserve_recharge`、`legacy_hammerfall_rostrum`、`legacy_mimic_testimony` |
| 原型 | `genesis_stalker_recharge`、`genesis_helix_side_lock`、`genesis_guardian_lineage` |
| 广播 | `broadcast_leech_recharge`、`broadcast_tripwire_studio_lock`、`broadcast_warden_anechoic` |
| 避难所 | `shelter_patrol_recharge`、`shelter_collapse_command`、`shelter_horror_containment` |
| 伪证 | `testimony_witness_recharge`、`testimony_voice_judgment`、`testimony_hound_hall` |
| 复演 | `replay_stalker_recharge`、`replay_opening_final_lock`、`replay_double_prop_cache` |
| 监察 | `panopticon_north_recharge`、`panopticon_central_lock`、`panopticon_south_inverse` |

契约共同语义：

- 入场时按稳定概率与 seed 发现。
- 目标必须严格按 1→2 完成。
- 乱序、未完成出口、撤退、失败或跨副本会产生各自结算原因。
- 失败不阻止本章主线通关。

## 9. 版本化目录

目前主要规则版本：

```text
DUNGEON_FEATURE_HELP_VERSION = 17
GAME_ASSET_MANIFEST_VERSION = 1
DUNGEON_LAW_STATE_VERSION = 1
RUN_RELIC_RULES_VERSION = 1
RUN_PURSUIT_RULES_VERSION = 1
ROUTE_CONTRACT_RULES_VERSION = 1
FIELD_SURVEY_RULES_VERSION = 1
EQUIPMENT_MEMORY_RULES_VERSION = 1
EQUIPMENT_SOUL_SKILL_RULES_VERSION = 1
EQUIPMENT_ROLL_RULES_VERSION = 1
COMPANION_RULES_VERSION = 1
METHOD_CULTIVATION_RULES_VERSION = 1
BLOODLINE_RULES_VERSION = 1
```

`DUNGEON_FEATURE_HELP_IDS` 当前恰有 **23** 个稳定帮助 ID。帮助条目不是装饰文案；其
`title / summary / mechanic / guidance / readout / keywords` 是迁移后解释复杂机制的内容契约。

迁移后应继续让每个子系统自行版本化。不要只依赖一个全局 save version 判断所有嵌套状态都兼容。
