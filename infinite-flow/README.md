# Infinite Flow Prototype

Standalone browser prototype for an original infinite-flow game. The top-level
`game/` Cocos project is intentionally untouched.

## Current Demo Loop

This slice now covers a playable preparation and dungeon loop:

Catalog totals are exact: 19 chapters, 56 mature equipment items, 19 equipment memories, 1064 equipment-memory combinations, 57 route contracts, 19 mainline tasks, and 44 side tasks. The 63 tasks award 5560 reward points in total.

1. Manage a character sheet and claim 63 tasks: 19 chapter mainlines and 44 side tasks, including global progression tasks.
2. Choose an assault, bulwark, or wayfinder relic frame, then optionally seed its first draft with a previously archived relic.
3. Equip and level matching relic-conduit gear to expand each run draft from two choices to three; frame, seed, and conduit sources freeze on entry.
4. Configure nine tactical items across three general carry slots and equipment-provided field-rig slots before entering a dungeon.
5. Buy combat tools, trap counters, portal tools, and capture supplies.
6. Buy, equip, and upgrade gear, including field rigs, relic conduits, two-rank boss-material tempering, two-way max-level equipment attunements, and three-piece same-branch weapon resonance.
7. Seal two idle max-level high-tier items into an equipment commission for 300 reward points and 1 lingyun, then clear three different dungeons to earn two of the chosen temper material.
8. Unlock six non-weapon soul skills by raising their source gear to Lv.3 and Temper I; equipped skills and up to two shared charges freeze on entry.
9. Learn and refine seven cultivation methods from R1 to R3, mark one as the preferred display order, and use every learned method's frozen technique once per combat.
10. Buy or capture pets, then choose an active pet for stat growth.
11. Enter one of nineteen tiered dungeons with readiness shown from player power and a distinct field law whose route sectors report open, partial, or closed gate coverage.
12. Navigate a tactical node map through monster, trap, portal, reward, boss, and exit encounters, choosing explicit counter/risk or stabilize/force actions at tactical nodes.
13. Advance cycle erosion only when a non-exit node is cleared for the first time, trading rising encounter pressure against a shrinking base exit reward.
14. Use context-specific soul skills to cleanse or interrupt combat, bypass or retreat from traps, offset portal landings, and retain a reward item without spending a combat turn.
15. After clearing each dungeon's resonance host, use its one-shot resonance station to restore one spent soul skill and one shared charge; selecting a restoration temporarily locks route movement, while retreat remains available.
16. Resolve reward-node relic drafts to add run-only effects, while unresolved drafts pause route movement.
17. Counter enemy intent to build weapon focus from 0/3 to 3/3, spend it on a weapon skill, and recharge during longer fights.
18. Break each dungeon boss's awakening phase, secure its equipment drop, and unlock the sealed exit.
19. Replay cleared dungeons under unique imprint protocols, complete their required anchors before the boss, and earn cycle imprints plus bonus reward points.
20. Spend one cycle imprint on a deep protocol, clear both marked anchors before the boss, and earn its dungeon material x2 plus a larger protocol bonus without re-granting the entry imprint.
21. During exploration, a chapter-specific hidden task may appear without an entry-time selection; complete its objectives strictly 1 -> 2 and bank its reward at the exit, while failure never blocks the main clear.
22. Clear a chapter to unlock its equipment catalog and bring back its chapter material, then exchange that material for the desired equipment at the hub equipment merchant.
23. On a successful clear, archive one acquired relic as a future seed or skip the archive; retreat and defeat lose run relics.
24. Bring reward points, lingyun, cycle imprints, pets, chosen loot, and materials back into the next upgrade cycle.

## MVP 机制说明契约

副本页面只常驻显示当前状态、数值和下一步目标；机制背景统一放在功能名称旁的圆形 `?` 中，鼠标悬停、键盘聚焦或点击均可查看，触屏端点击后以底部说明层展示。说明层不会改写存档或副本状态。

`src/dungeon-feature-help.ts` 是面向后续 App、小程序和其他客户端的版本化单一资料源。稳定 help id 下固定保存 `summary`（是什么）、`mechanic`（怎样影响本局）、`guidance`（现在怎么做）、`readout`（界面怎么看）和检索关键词；迁移时应复用这些数据，只替换平台渲染层。被替换的 MVP 规则不能直接删除，必须像 `equipmentHunt` 一样保留“现行规则 + 旧档兼容背景”，避免未来按过期界面反推规则。

## 轮回侵蚀

每局从稳定段开始；非出口节点仅在首次清理时计数，重复经过与出口都不增加计数。累计清理会依次推进稳定、追猎、破界三段压力：稳定段保持基准，后两段分别使遭遇强度提高 10% 和 20%。三段对应的出口基础经济奖励加成依次为 15%、5%、0%，继续深入会以更高强度和更低保底换取沿途收益。

## 轮回小队

主神空间的“小队”面板可招募秦彻、周映雪和陆观澜，并消耗各自材料晋升至 R3、指定下一局出战成员。进入副本时，同伴身份与位阶会冻结为本局快照；每场战斗可发动一次对应助战，提供守势、战意或生命回复。旧档中缺失或异常的本局快照只会禁用该局助战，不会从当前小队回填或重置其他进度。

## 功法修行

主神空间的“功法”面板集中展示七门功法的学习成本、R1-R3 战技和常用排序。已学功法默认从 R1 开始；晋升 R2 固定消耗 420 奖励点、1 灵蕴和功法残页 x1，晋升 R3 固定消耗 760 奖励点、2 灵蕴和功法残页 x2。进入副本时会冻结全部已学功法及其当时位阶；常用功法只决定展示顺序，不限制其他功法。局中修改主神空间字段不会改写本局功法库。

每门冻结功法的战技在每场战斗中都可免费发动一次，不消耗回合、普通行动、敌方反击、战意结算或物品。归息与纳星积累呼吸并回复生命，镇岳提供守势并在高阶清除锈毒，踏隙清除镜慢并获得战意，定门获得战意，护主需要出战宠物，空明清除锈毒与镜慢并获得战意。梦档案馆封存功法时，全部功法战技保持禁用。

存档版本仍为 v1。旧档中每门已学功法迁移为 R1，但不会猜测常用排序；旧版单功法 `methodSnapshot` 会作为仅含一门功法的本局库继续读取，不会从主神空间补入其他功法。新版使用 `methodSnapshots` 冻结整套功法库，并以 `methodTechniqueUsedIds` 逐门记录本场使用状态；缺失或异常快照只影响当前副本，不会重置其他进度。

## 破界追兵

复刷已通关副本时，首次清理 6 个非出口节点会唤醒本章追兵；此后每移动一步，它都会沿真实路线逼近。与追兵接触会受伤，追兵随后回到本章出生点，并给你 1 次移动宽限。先清理地图标出的收容点，再把追兵引入其中并击败 Boss、从出口撤离，可带回对应材料 x1；若先接战 Boss，追兵会与首领融合并使其强化 15%，且不再掉落收容材料。稳定传送门可驱退仍在潜伏或追猎的追兵；强制传送会把追猎中的追兵带到目标副本出生点，并给予 1 次移动宽限。

## 因果账本

第九章“因果清算所”会在首次清理普通怪物或陷阱后暂停移动，要求当场结算该节点。平衡不会改动账目；透支会回复最大生命的 10%、获得 108 本局奖励点并增加 1 点债务；偿还会承受非致命的最大生命 15% 伤害并减少 1 点债务。债务上限为 4，部分审判路线要求债务足够低。零和审计官开战时会把当前债务冻结为追缴印，之后每枚追缴印会把一次有效攻击减半。三件本章装备的入场快照分别可免除首次透支债务、减少一枚 Boss 追缴印，或把偿还代价降至最大生命 8%。

## 熵潮航向

第十章“熵海方舟”以 0 至 4 的熵位控制双舷航区。三座航向台在领取节点奖励后要求当场选择：稳航降低熵位并开启低熵路线，抢航提高熵位并开启高熵路线；选择期间只锁定相邻地图移动，角色、任务与撤回仍可使用。终末舵手开战时会冻结当前熵位，并把偏离平衡值的幅度折算为方舟崩解层。

## 镜城相位

第十一章“镜海轮回城”在现实与镜像间布置三面相位镜。领取镜面奖励后必须选择“落实现”或“入镜像”：保持相位无代价，切换默认消耗最大生命 10%，并改变力伤与术伤倾向；只锁相邻地图移动，角色、任务、小队与撤回仍可使用。现实与镜像锚点会削减无名镜王的镜壳，三次抉择全部完成后才开放终局路线。视差面甲消除错误伤害类型惩罚，相织披风把切换代价降至 5%，归真棱镜再减少一枚镜壳；三件被动均在入场时冻结。

## 删界终稿

第十二章“删界终稿院”在正文、记忆与归返三张条款案上要求一次性裁定。“核准原文”不消耗生命，会开放对应可选区域，但会写入封印态与觉醒态终稿效果：肉身和记忆条款强化首领，归返条款降低玩家治疗与防御效果；“删去条款”固定支付最大生命 8%，永久关闭对应区域，同时移除该项终稿效果。裁定期间只锁相邻地图移动，角色、任务、小队、功法与撤回仍可使用；三份条款全部落定后开放首领路线，开战时冻结终稿快照。

朱批断章刃、覆页披甲与终校印玺分别把肉身、记忆与归返条款对应的终稿效果减半。三项被动只按入场装备冻结，局中或重载后的主神空间装备变化不会改写本局快照。

## 亡队遗产拍卖

第十三章“亡队遗产拍卖庭”在武力、守备、术法与归返四座拍品台上进行一次性竞标。每座拍品台都可选择“竞得拍品”“焚契毁标”或“放弃竞标”：竞得会消耗本局遗产筹码，基础价格为 1 加此前竞得次数，匹配的入场装备可减免 1 点且最低仍为 1；竞得后开放对应角落库房，并把拍品增益带入首领战。焚契固定消耗 1 枚遗产筹码，永久关闭对应库房并使双方都失去该拍品；放弃免费，但首领会继承拍品且库房同样永久关闭。四座拍品台全部落定后，首领会按封印态与觉醒态分别冻结玩家与首领的拍品效果。

亡队落槌、无名竞标面、托管契甲与终场号钟分别冻结 `legacyGavel`、`anonymousVeil`、`escrowPlate` 与 `finalLotBell` 入场被动，只影响各自匹配拍品的竞标价格或放弃投影。局中修改主神空间装备或重载存档都不会重新推断、补写或改变本局快照。

## 血统与众生原型库

主神空间的“血统”面板展示巨灵骨髓、虚界共生体、界壁甲质和涅槃余烬四条谱系。每条血统从 R1 觉醒，并可晋升至 R3；面板同时列出精确成本、常驻属性和每场一次的血统爆发。当前血统会在进入副本时冻结，局中面板只读，后续切换或晋升不会回填当前 run。血统爆发分别提供武力直伤、术法直伤、屏障或生命回复，每场战斗只能使用一次。

第十四章“众生原型库”在三座控制台依序完成基因拼接。武力、术法、守势、归返四种基因只消耗本局携带的原型血清，匹配入场装备会降低对应选择成本；主神空间库存存在但 run bag 不足时仍不可支付。三槽有序序列、多样性和当前血清始终显示在法则状态中，首领开战后冻结 Boss 基因组，不能再改写。

存档继续使用 v1。`bloodlineRanks` 与 `activeBloodline` 会经过血统规则归一化；旧档默认空血统。只有显式且合法的 `bloodlineSnapshot` 才会启用当前 run，缺失或畸形快照不会从主神空间回填。战斗字段 `bloodlineSurgeUsed` 与 `bloodlineBarrier` 只在快照有效时保留并按合法范围恢复。

## 寂声广播塔

第十五章“寂声广播塔”是 Tier 15、推荐战力 950 的 6x5 高阶地图。领取北段、中央与南段中继台奖励后，必须在节点面板选择“静默频道”或“转播频道”：静默默认使 noise -1，死频耳罩将其强化为 -2；转播使 noise +1，并一次性获得 180 本局奖励点。三次选择的顺序、静默/转播计数与最终 noise 会共同开放寂声档案库、共振储备库或均衡配线盘。选择期间只锁地图移动，角色、任务、血统、小队、功法和撤回仍可使用。

断频长刃、死频耳罩、消声披甲与末路断播器的法则被动在入场时冻结。断频长刃抵消首次战斗或陷阱增噪，死频耳罩强化静默降噪，消声披甲削弱正向噪声惩罚，末路断播器降低首领 noise snapshot。末频道播音主开战后仍会在战斗界面保留可读 snapshot。存档继续使用 v1：缺失的静默晶核按 0 恢复；缺失或畸形的本局法则只局部恢复，绝不根据主神空间装备回填入场快照。

## 失联避难所

第十六章“失联避难所”是 Tier 16、推荐战力 1040 的 6x5 地图。三处护送检查点会在节点面板要求当场选择“治疗幸存者”或“强行推进”：治疗消耗当前 run 携带的止血丹，基础回复幸存者 25 HP；陆观澜 R2 让本局首次治疗免费并额外回复 10 HP，分诊目镜再额外回复 10 HP。强行推进获得 200 本局奖励点，但会扣除幸存者 HP，周映雪可让本局首次强推免伤。选择期间只锁地图移动，角色、任务、血统、小队、功法与撤回始终可用；主神空间库存有药而当前 run 无药时仍不能治疗。

救援卡宾枪、分诊目镜、撤离护甲与黑匣信标的法则被动，以及秦彻、周映雪、陆观澜的职责和位阶，都在入场时冻结。幸存者从 100 HP 开始，三次选择、职责 used 状态与失联总控的 Boss snapshot 会保持紧凑可读，并在首领战和重载后继续显示。存档继续使用 v1：救援铭牌、本章装备与怪物、法则及 `mimicHesitation`、`shelterWardKind`、`evacuationPanicStacks` 都会严格校验；异常子字段只局部恢复，旧 run 不从主神空间装备或同伴回填，重开会完全清除本章状态。

## 伪证裁定庭

第十七章“伪证裁定庭”是 Tier 17、推荐战力 1140 的 6x5 精确 30 节点地图。三份证据可按任意顺序取得，并可能保持净证或被陷阱污染；抵达裁决室或翻案席时，节点面板会以非模态“证据裁定”要求从四名嫌疑人中作出选择。裁定期间只锁地图移动，角色、任务、小队、功法、血统与撤回仍可使用。

诘问裁刃、溯证目镜、封证护甲与翻案印玺的法则能力在入场时冻结：护甲只保护首次证据污染，目镜提供基线排除，印玺决定一次翻案资格。真证档案库与速裁武库严格按原始裁决瞬间冻结的净证数分流：原始正确且恰好 3 份净证才进入真证档案库；原始正确、冻结净证为 1 至 2 且未翻案才进入速裁武库。后来补收证据不会改写分流或奖励，翻案正确也不会进入这两处奖励区。

法则栏紧凑展示四件冻结装备、封证是否已使用、原始裁决、翻案状态与伪证主审的 Boss snapshot；战斗界面继续显示该 snapshot。存档继续使用 v1：真证碎片、本章装备与怪物、法则及 `witnessContradiction`、`censorSealKind`、`perjuryPressureStacks` 都严格校验。`witnessContradiction` 仅接受布尔值，`censorSealKind` 仅接受 `attack`、`art` 或 `talisman`，`perjuryPressureStacks` 仅接受 0 至 2 的整数；数组伪枚举会被拒绝，异常子字段只局部恢复，旧 run 不从主神空间回填，重开会完全清除本章状态。

## 战痕复演场

第十八章“战痕复演场”是 Tier 18、推荐战力 1240 的 6x5 精确 30 节点地图。三段战斗母带分别记录一次攻击、功法或防御动作及其实际值；全部录制后，可在节点面板选择顺序复演、爆发复演或余拍复演路线。法则栏以紧凑状态持续显示三段母带、当前路线、Boss 快照、复演游标与 buffer，不占用剧情区，角色与任务继续沿用原有弹窗。

定帧刻刀、起拍目镜、缓冲叠甲与解冻节拍器的法则能力在入场时冻结。终剪导演开战时冻结本局母带与路线快照，战斗中继续展示复演游标及 buffer；击败首领并从出口结算可获得战斗母带。存档继续使用 v1：缺失或异常的复演子字段会按契约局部归一化，不从主神空间装备回填，也不会重置其他进度；重开会完全清除本章状态。

## 天幕监察城

第十九章“天幕监察城”是 Tier 19、推荐战力 1350 的 6x5 精确 30 节点地图。每次移动都会推进 0/1/2 三相扫描，并按目标节点所属扫描区记录曝光；北部、中央与南部三座盲区中继全部激活后，当前节点面板以非模态方式要求从影行、诱饵与折光三条路线中锁定唯一选择。等待路线期间只封锁地图移动，角色、任务、小队、功法、血统与撤回仍然可用。

断视切线刃、预判目镜、消光披甲与逆观棱镜的法则能力在入场时冻结，但紧凑法则栏只显示冻结数量，不展开长装备名。法则栏以四格持续展示扫描相位与移动数、三座中继、路线、曝光、折光充能和万目监察者快照；地图只用约 18px 角标和边框标出扫描区、中继、路线与首领。击败万目监察者并从盲晓离城门结算可获得观测棱片。存档继续使用 v1：旧档缺失 `observation_shard` 时按 0 恢复，异常的本章法则子字段只在核心归一化边界内局部恢复，绝不从主神空间装备回填入场快照。

## 章节材料兑换与旧版装备追猎

现行 MVP 不再要求入场时选择目标装备。首次通关某章会解锁该章装备的兑换目录，成功通关同时带回对应章节材料；玩家在主神空间的装备商人处自行选择要兑换的装备。普通、困难、炼狱分别影响本次可获得的材料数量。

旧版“装备追猎”仍只为兼容已有存档保留：旧档可能含目标装备、两处线索、首个精英报价和通关入架状态，但新开的简化入场不会生成这套选择。缺失快照视为未启用，异常字段只局部删除，不会重置整档或从当前准备回填；这段背景同时保存在 `DUNGEON_FEATURE_HELP.equipmentHunt`，供旧档提示和未来迁移核对。

## 铭刻勘探

满级且已铭刻的在装备位装备会在入场协议中冻结为本局勘探来源。装备商店会在每个铭刻分支下标出它能解锁的十二关勘探取舍；抵达对应奖励节点时，普通“收取奖励”仍可使用，也可改选一条已冻结的勘探方案。旧档或格式异常的勘探快照只会禁用本局勘探，绝不会按当前装备回填，普通奖励与后续新入场不受影响。

## 铭刻记忆狩猎

十九章各有一段可恢复记忆，共 19 段记忆；56 件成熟装备共组成 1064 个收录格。同时完成目标事件与目标节点的双信号狩猎，才能把记忆带回并设为该装备的 active memory。active memory 会暂存 1 点溢出的战意，并在下一次武器技后回补 1 点战意。

## 装备封存委托

在主神空间可将两件满级、高阶、未装备且未被其他系统占用的装备封存，支付 300 奖励点与 1 灵蕴后指定一种淬炼材料。委托期间每个不同副本只在首次成功从出口结算时计入进度；重复通关同一副本、中途撤回或战败均不计数。完成三个不同副本后获得目标材料 x2，提前召回只会解封装备，不退还已支付资源。

## Commands

```bash
npm install
npm run dev
npm test -- --run
npm run typecheck
npm run build
SMOKE_SUITE=genesis npm run smoke:ui
SMOKE_SUITE=broadcast npm run smoke:ui
SMOKE_SUITE=shelter npm run smoke:ui
SMOKE_SUITE=verdict npm run smoke:ui
SMOKE_SUITE=replay npm run smoke:ui
SMOKE_SUITE=panopticon npm run smoke:ui
```

## Scope

- Browser-first TypeScript app.
- No backend or account persistence.
- Local save v1 preserves tactical, relic, equipment-hunt, companion, cultivation, and bloodline preparation, treats missing legacy `phase_glass`, `redaction_ink`, `legacy_scrip`, `genesis_serum`, `silence_core`, `rescue_badge`, `truth_fragment`, `combat_reel`, or `observation_shard` as 0, then freezes tactical, relic, conduit, soul-skill, equipment-hunt, companion, cultivation, bloodline, mirror-city, redaction, legacy-auction, genesis-vault, silent-broadcast, lost-shelter, false-testimony, combat-replay, and panopticon entry state for each new run.
- Legacy runs without a tactical snapshot remain unrestricted; missing relic, soul-skill, or equipment-hunt snapshots remain explicitly disabled for that run and are never rebuilt from current equipment or hub preparation.
- No engine migration.
- Six-column tactical dungeon maps use adjacent-node pathfinding and pointer-driven movement.
- Data tables drive dungeons, items, equipment, methods, monsters, pets, and nodes.
- Progression helpers calculate player power and dungeon readiness from real stats.
