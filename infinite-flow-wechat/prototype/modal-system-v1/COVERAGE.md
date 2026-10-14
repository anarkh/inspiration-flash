# 当前游戏弹框 → 紧凑原型覆盖矩阵

覆盖范围以 [InfiniteFlowInfoSheet.ts](../../cocos/assets/scripts/ui/InfiniteFlowInfoSheet.ts) 的 `MobilePanelKind` 和当前使用的嵌套 UI 为准；运行与结果浮层另外追溯至 [InfiniteFlowView.ts](../../cocos/assets/scripts/ui/InfiniteFlowView.ts)。`InfoSheet` / `View` 在下表分别指这两个文件，行号指本原型建立时的源码位置。

原型的 **133 个 route** 是界面、内容页和状态样例的总数。正式主类仍为 **11 类**，不是 133 类原生弹框。每条 route 的完整来源同时保存在对应 `data-*.js` 的 `source` 字段。

## 主类与嵌套范围

| 正式主类 | 原型 family | 必需覆盖 |
| --- | --- | --- |
| `character` | `player-*`、玩家装备 / 养成配置 | 人物、有效属性、携行、已拥有能力、可调整与副本只读。 |
| `inventory` | `bag-*`、`tip-*` | 补给、装备、本局遗物；已装备 / 可穿戴 / 战斗禁换装；携行与槽满。 |
| `map` | `map-*` | 完整区域、当前位置、已知 / 未知节点、节点详情、未入副本。 |
| `objectives` | `task-*` | 任务列表、详情、章规与探索规则。 |
| `log` | `log-records` | 事件与冒险记录，长内容在窗内滚动。 |
| `menu` | `menu-*`、`combat-*` | 探索和战斗菜单、行动、直接使用法术 / 药品、风险与撤退确认。 |
| `interaction` | `interaction-*`、`reward-*`、`relic-*`、`loot-*` | 节点现场、行动与详情、奖励领取、装备 / 回响选择和完成状态。 |
| `entry` | `entry-*` | 章节选择、锁定、设置、协议 / 炼狱、回响种子、路线契约。 |
| `npc` | `npc-*`、`hub-detail-*`、服务与确认 | 七类 NPC、未靠近 NPC、商品 / 能力详情、服务与更多操作。 |
| `help` | `help-*` | 指南目录与完整规则正文。 |
| `result` | `result-*` | 总览、全部 11 个结算分区、归档 / 跳过 / 遗失 / 无回响与回城。 |
| 主类外的当前浮层 | `hud-*`、`system-*` | HUD 提示；加载 / 失败、初始化 / 阻断。 |

## 角色、行囊与记录

| 原正式弹框类型 / 子状态 | 原型 route | source | 必需状态 / 契约 |
| --- | --- | --- | --- |
| 角色信息 | [player-character](./index.html#player-character) | InfoSheet:657；`game.ts:5067,5247` | 初始人物、七个装备槽、战力与资源；槽位可打开已穿戴详情。 |
| 携行配置 | [player-carry](./index.html#player-carry)、[player-carry-readonly](./index.html#player-carry-readonly) | InfoSheet:1325；`tactical-loadout.ts:47`；`view-model.ts:1103` | 主神空间可调整；副本内只读；补给不占槽，特殊道具按种类占槽。 |
| 我的装备与养成 | [player-loadout](./index.html#player-loadout)、[hub-equipment](./index.html#hub-equipment)、[hub-owned-equipment-detail](./index.html#hub-owned-equipment-detail)、[hub-growth](./index.html#hub-growth) | InfoSheet:658,2873–2980；`hub-shop.ts:118–146,429–475` | 只管理已拥有内容；选中后手动穿戴；与 NPC 兑换分开。 |
| 玩家能力配置详情 | [hub-config-pet](./index.html#hub-config-pet)、[hub-config-method](./index.html#hub-config-method)、[hub-config-bloodline](./index.html#hub-config-bloodline)、[hub-config-companion](./index.html#hub-config-companion) | `hub-shop.ts:429–475`；`pet-system.ts`；`bloodline-system.ts`；`companion-system.ts` | 出战宠物 / 同伴、常用功法和激活血统有明确状态与操作。 |
| 属性 / 战力详情 | [player-attributes](./index.html#player-attributes) | InfoSheet:802；`game.ts:5067,5247`；`progression.ts:54` | 有效装配属性、战力构成；未穿戴 / 未出战的内容不计入有效战力。 |
| 行囊补给 | [bag-supplies](./index.html#bag-supplies) | InfoSheet:1425；`tactical-loadout.ts:63` | 库存数字、空格、物品详情；长行囊在窗内滚动。 |
| 行囊装备 | [bag-equipment](./index.html#bag-equipment) | InfoSheet:1550；`view-model.ts:1570` | 永久拥有、手动穿戴、当前已装备标记；换下物品仍在背包。 |
| 本局遗物 | [bag-relics](./index.html#bag-relics)、[bag-relics-empty](./index.html#bag-relics-empty) | InfoSheet:1508,1516；`run-relics.ts:63` | 自动生效、仅本局有效；有遗物和空状态。 |
| 装备 tips | [tip-equipment-owned](./index.html#tip-equipment-owned)、[tip-equipment-combat](./index.html#tip-equipment-combat) | InfoSheet:2175；`equipment-catalog.ts:101`；`equipment-system.ts:142`；`view-model.ts:1570,1579` | 基础属性、成长和固定词缀；探索可穿戴，战斗按钮禁用且说明原因。 |
| 已穿戴装备 tips | [tip-equipped-training-blade](./index.html#tip-equipped-training-blade)、[tip-equipped-patched-headwrap](./index.html#tip-equipped-patched-headwrap)、[tip-equipped-patched-coat](./index.html#tip-equipped-patched-coat)、[tip-equipped-patched-gloves](./index.html#tip-equipped-patched-gloves)、[tip-equipped-patched-boots](./index.html#tip-equipped-patched-boots)、[tip-equipped-patched-belt](./index.html#tip-equipped-patched-belt)、[tip-equipped-plain-charm](./index.html#tip-equipped-plain-charm) | InfoSheet:2175；`equipment-catalog.ts:12–72`；`equipment-system.ts:132` | 七个初始槽位均能进入匹配物品详情，不误跳至另一个装备的 tips。 |
| 物品 tips | [tip-item-supply](./index.html#tip-item-supply)、[tip-item-carry](./index.html#tip-item-carry)、[tip-item-carry-full](./index.html#tip-item-carry-full) | InfoSheet:2224,2272；`game.ts:1350,1357,1378`；`tactical-loadout.ts:47,63,72` | 补给效果 / 库存、特殊道具携行状态、槽满禁用与原因。 |
| 区域地图 | [map-region](./index.html#map-region)、[map-node](./index.html#map-node)、[map-empty](./index.html#map-empty) | InfoSheet:877,879,989；`level-data/demon-tower.ts` | 已知 / 未知、当前位置、邻接和已侦察；详情与未入副本；地图只供查看。 |
| 任务目标与章规 | [task-list](./index.html#task-list)、[task-detail](./index.html#task-detail)、[task-rules](./index.html#task-rules) | InfoSheet:1069,1082,1096；`task-system.ts:196,305`；`dungeon-feature-help.ts:72,183` | 任务条件、进度、奖励与章节规则可读；保留详情与返回入口。 |
| 冒险记录 | [log-records](./index.html#log-records) | InfoSheet:2985；`game.ts:5303,5558,7966` | 真实记录样例与长文本滚动。 |

## 主神空间与轮回入场

| 原正式弹框类型 / 子状态 | 原型 route | source | 必需状态 / 契约 |
| --- | --- | --- | --- |
| 七类 NPC 目录 | [npc-merchant](./index.html#npc-merchant)、[npc-supplies](./index.html#npc-supplies)、[npc-pets](./index.html#npc-pets)、[npc-methods](./index.html#npc-methods)、[npc-bloodlines](./index.html#npc-bloodlines)、[npc-companions](./index.html#npc-companions)、[npc-tasks](./index.html#npc-tasks) | InfoSheet:2775；`hub-shop.ts:48–54,202–363` | 装备 / 物资 / 灵宠 / 功法 / 血统 / 同伴 / 任务均有真实目录；操作语义保留。 |
| 未靠近 NPC | [npc-empty](./index.html#npc-empty) | InfoSheet:2990–2993 | 显示走近 NPC 的条件，不把空状态变成远程商店。 |
| NPC 商品 / 能力详情 | [hub-detail-equipment](./index.html#hub-detail-equipment)、[hub-detail-supply](./index.html#hub-detail-supply)、[hub-detail-pet](./index.html#hub-detail-pet)、[hub-detail-method](./index.html#hub-detail-method)、[hub-detail-bloodline](./index.html#hub-detail-bloodline)、[hub-detail-companion](./index.html#hub-detail-companion)、[hub-detail-task](./index.html#hub-detail-task) | InfoSheet:2635；`hub-shop.ts:90–117,239–363`；各能力目录 | 兑换 / 签约 / 培养 / 学习 / 精研 / 觉醒 / 晋升 / 招募 / 训练 / 领取；条件和成本可见，展示反馈。 |
| 封存委托服务与确认 | [hub-services](./index.html#hub-services)、[hub-confirm](./index.html#hub-confirm) | InfoSheet:2630–2650；`hub-shop.ts:376–419`；`view-model.ts:1224–1432` | 委托条件、启动操作；撤回前确认，可取消返回。 |
| 休整服务 | [hub-recover](./index.html#hub-recover) | `view-model.ts:1108–1110`；`hub-shop.ts:376–380` | 恢复生命的条件与成本，点击后仅原型反馈。 |
| 装备更多操作 | [hub-more-actions](./index.html#hub-more-actions) | InfoSheet:2659–2771；`view-model.ts:1630–1669` | 原装备详情的更多操作子层，不新增独立玩法。 |
| 章节入场列表 / 锁定 | [entry-root](./index.html#entry-root)、[entry-locked](./index.html#entry-locked) | InfoSheet:2401,2412–2475；`view-model.ts:894–926` | 默认无候选预选；锁定章节禁入并显示解锁条件；已解锁章节可演示入场。 |
| 入场设置总览 | [entry-settings](./index.html#entry-settings) | InfoSheet:2461,2479–2560；`view-model.ts:928–1065` | 设置是章节列表上的嵌套层，完成后返回章节。 |
| 协议与炼狱 | [entry-protocol](./index.html#entry-protocol) | `run-protocols.ts:123–143,848–878`；`view-model.ts:928–963` | 候选初始未选；选择协议；炼狱状态与代价可读。 |
| 回响 / 归档种子 | [entry-relic](./index.html#entry-relic) | `run-relics.ts:14–18`；`view-model.ts:993–1065` | 回响方向与归档种子说明，选择后确认。 |
| 路线契约 | [entry-contract](./index.html#entry-contract) | `route-contracts.ts:114–119`；`view-model.ts:964–992` | 候选未选 / 选中，条件、目标与奖励可读。 |

## 探索、奖励与战斗菜单

| 原正式弹框类型 / 子状态 | 原型 route | source | 必需状态 / 契约 |
| --- | --- | --- | --- |
| 节点现场与行动 | [interaction-root](./index.html#interaction-root)、[interaction-actions](./index.html#interaction-actions)、[interaction-action-detail](./index.html#interaction-action-detail)、[interaction-risk](./index.html#interaction-risk)、[interaction-soul-action](./index.html#interaction-soul-action) | InfoSheet:520–620,3016–3020；`view-model.ts:2687–2695` | 现场 / 行动切换；效果、消耗、风险和器魂技详情；确认执行。 |
| 界门行动 | [interaction-portal](./index.html#interaction-portal)、[interaction-portal-detail](./index.html#interaction-portal-detail)、[interaction-portal-risk](./index.html#interaction-portal-risk) | `level-data/demon-tower.ts:57–63`；`view-model.ts:2697–2702` | 道具稳定与强闯反噬分别可读；风险确认。 |
| 副本事件 | [interaction-event](./index.html#interaction-event)、[interaction-event-detail](./index.html#interaction-event-detail) | `dungeon-events.ts:108–148`；`view-model.ts:2540–2573` | 事件分支、满足条件和条件不足；禁用原因与行动详情。 |
| 宝箱 / 普通奖励领取 | [reward-claim](./index.html#reward-claim)、[reward-collecting](./index.html#reward-collecting)、[reward-ordinary](./index.html#reward-ordinary)、[reward-completed](./index.html#reward-completed) | InfoSheet:1713,1690–1758；`level-data/demon-tower.ts:15–21,40–46` | 奖励预览、处理中防重复、带回响 / 不带回响、完成。领取按钮使用紧凑尺寸。 |
| 回响选择 | [relic-choice](./index.html#relic-choice)、[relic-choice-one](./index.html#relic-choice-one)、[relic-choice-three](./index.html#relic-choice-three) | InfoSheet:1804,1778–1885；`run-relics.ts:62–103` | 1 / 2 / 3 候选；初始未选、选中后确认；仅本局生效。 |
| 装备掉落选择 / 详情 | [loot-equipment](./index.html#loot-equipment)、[loot-equipment-detail](./index.html#loot-equipment-detail)、[loot-hood-detail](./index.html#loot-hood-detail)、[loot-robe-detail](./index.html#loot-robe-detail)、[loot-owned](./index.html#loot-owned) | InfoSheet:1638,1617–1688；`view-model.ts:2463–2483`；`equipment-catalog.ts:92–131` | 初始未选；候选属性与词缀；统一收入背包；永久拥有且不自动替换当前装备。 |
| 奖励节点其他行动 | [reward-services](./index.html#reward-services) | InfoSheet:3004–3013；`view-model.ts:2576–2600` | 奖励领取之外的原行动列表，返回领取页面。 |
| 铭刻勘探 | [interaction-survey](./index.html#interaction-survey)、[interaction-survey-detail](./index.html#interaction-survey-detail)、[interaction-survey-risk](./index.html#interaction-survey-risk) | `field-surveys.ts:44`；`view-model.ts:2576–2600` | 分支、详情和风险，条件不足时不可执行。 |
| 裂隙封存 | [reward-seal](./index.html#reward-seal) | `equipment-soul-skills.ts:111–120`；`view-model.ts:2607–2641` | 选择所封存物品，初始未选，确认后反馈。 |
| 器魂共鸣 | [interaction-soul-recharge](./index.html#interaction-soul-recharge) | `view-model.ts:2520–2533`；`equipment-soul-skills.ts` | 选择要恢复的器魂；取消或确认。 |
| 场域法则 / 回放冻结 | [interaction-law](./index.html#interaction-law)、[interaction-law-replay](./index.html#interaction-law-replay) | `view-model.ts:2375–2460` | 分支候选、当前条件与确认；回放路线冻结是现有行动。 |
| 出口 / 封印出口 | [interaction-exit](./index.html#interaction-exit)、[interaction-exit-locked](./index.html#interaction-exit-locked) | `view-model.ts:2704–2708` | 可结算出口；未完成要求时结算禁用并保留任务入口。 |
| 探索菜单与进阶行动 | [menu-root](./index.html#menu-root)、[menu-actions](./index.html#menu-actions)、[menu-retreat](./index.html#menu-retreat) | InfoSheet:1249–1320；`view-model.ts:2602–2644,3106–3109` | 主菜单入口、行动、探索撤退确认与取消。 |
| 战斗菜单 / 进阶行动 | [combat-menu](./index.html#combat-menu)、[combat-actions](./index.html#combat-actions) | InfoSheet:1249–1304；`view-model.ts:3191–3199,3362` | 战斗状态中的可用入口与行动，不提供换装。 |
| 法术 / 药品直接使用 | [combat-spells](./index.html#combat-spells)、[combat-medicines](./index.html#combat-medicines)、[combat-medicines-empty](./index.html#combat-medicines-empty) | InfoSheet:487–495,1218–1246；`view-model.ts:3209–3213` | 点击可用法术 / 药品直接反馈；资源不足 / 无库存显示禁用原因。 |
| 战斗行动详情 | [combat-action-detail](./index.html#combat-action-detail)、[combat-defense-detail](./index.html#combat-defense-detail)、[combat-weapon-detail](./index.html#combat-weapon-detail)、[combat-thunder-detail](./index.html#combat-thunder-detail) | InfoSheet:537–550；`view-model.ts:3204–3217,3288–3320` | 攻击、防御、武器战技、雷火符的效果与消耗，确认执行。 |
| 脱离 / 放弃本轮 | [combat-escape](./index.html#combat-escape)、[combat-retreat](./index.html#combat-retreat) | InfoSheet:1252–1255；`view-model.ts:3198,3362`；View:3330 | 高风险操作确认、继续战斗 / 取消与结果入口。 |

## 完整结算、帮助与系统浮层

| 原正式弹框类型 / 子状态 | 原型 route | source | 必需状态 / 契约 |
| --- | --- | --- | --- |
| 本轮结果总览 | [result-root](./index.html#result-root)、[result-retreat](./index.html#result-retreat)、[result-failed](./index.html#result-failed) | InfoSheet:2994；View:2630–2665,2740–2798 | 正常结果、撤退、失败；实际奖励 / 损失明细的分区入口。 |
| 回响结算分区 | [result-echo](./index.html#result-echo) | View:2678–2730 | 本局回响、归档状态与归档入口。 |
| 装备状态与掉落分区 | [result-loot](./index.html#result-loot) | View:2142–2168；`view-model.ts:2463–2483` | 带回 / 损失与装备状态；不改变永久领取规则。 |
| 封存委托分区 | [result-commission](./index.html#result-commission) | View:2085–2101,2760–2770 | 委托完成状态与结算。 |
| 装备记忆分区 | [result-memory](./index.html#result-memory) | View:2102–2106,2771–2781 | 记忆收录状态与结算。 |
| 装备铭刻分区 | [result-equipment-roll](./index.html#result-equipment-roll) | View:2170–2189 | 铭刻结果与装备明细。 |
| 协议分区 | [result-protocol](./index.html#result-protocol) | View:2194–2213 | 协议与炼狱状态、等级和奖励。 |
| 主神指令分区 | [result-directive](./index.html#result-directive) | View:2224–2237 | 指令状态、目标进度和实际奖励。 |
| 路线契约分区 | [result-route-contract](./index.html#result-route-contract) | View:2248–2260 | 完成状态、目标进度、奖励和结果原因。 |
| 侵蚀压力分区 | [result-pressure](./index.html#result-pressure) | View:2271–2279 | 压力段位及奖励加成。 |
| 破界追兵分区 | [result-pursuit](./index.html#result-pursuit) | View:2284–2295 | 追兵结果、原因和奖励 / 无奖励。 |
| 回响归档与回城 | [result-archive](./index.html#result-archive)、[result-archive-done](./index.html#result-archive-done)、[result-archive-skipped](./index.html#result-archive-skipped)、[result-archive-lost](./index.html#result-archive-lost)、[result-archive-none](./index.html#result-archive-none) | View:2678–2731；`view-model.ts:3966–3979` | 初始未选且不能直接回城；归档或明确跳过后可回城；遗失 / 无回响独立状态。 |
| 冒险指南 / 完整帮助正文 | [help-root](./index.html#help-root)、[help-detail](./index.html#help-detail) | InfoSheet:382,1201；View:6422,6567；`dungeon-feature-help.ts` | 目录与规则正文；长内容在窗内滚动、返回入口保留。 |
| HUD popover | [hud-points](./index.html#hud-points)、[hud-lingyun](./index.html#hud-lingyun)、[hud-relics](./index.html#hud-relics) | InfoSheet:1914；`game.ts:5251–5252`；`run-relics.ts:63` | 奖励点、灵蕴与遗物的紧凑说明；遗物可进入行囊。 |
| 场景资源加载 | [system-loading](./index.html#system-loading)、[system-load-error](./index.html#system-load-error) | View:3427 | 加载中阻断操作；失败时保留进度说明与重新加载入口。 |
| 初始化 / 运行阻断 | [system-initializing](./index.html#system-initializing)、[system-blocked](./index.html#system-blocked) | View:3756 | 初始化等待；实际阻断信息的显示位置。原型仅示意状态，不制造真实运行错误。 |

## 排除与复用

| 源 UI | 处理 | 原因 |
| --- | --- | --- |
| 旧章册 / 卷轴（View:4899） | 规则内容复用 `task-rules` | 当前规则来源已覆盖，不另计为当前独立弹框类型。 |
| legacy 结算（View:4260） | 不另做一套 legacy 弹框 | 当前结果总览和全部分区已覆盖；旧兼容分支不作为新样式入口。 |
| 全屏结果场景（`InfiniteFlowScene.ts:403`） | 排除全屏场景重设计 | 它不是弹框；本次请求保持在弹框原型范围。 |
| 调试 gallery 与 legacy gallery 布局 | 排除 | 用于 UI 引擎 / 历史基线调试，不是玩家当前的独立弹框。 |
| 抽卡 | 不新增 | 当前游戏没有该玩法，本次统一样式不扩充功能。 |

## 验证记录

2026-10-13 的验收对象为本地 HTML 原型：

| 验证 | 结果 | 记录 |
| --- | --- | --- |
| route 与覆盖矩阵 | 四个数据模块共 133 个唯一 route，本表覆盖全部；所有导航 target 与 `source` 文件存在。 | 数据模块与本表的逐项链接。 |
| 布局 | 133 routes × 320 / 390 = 266 项全部通过；窗体、标题 / 页签 / 底部操作在舞台内，无横向溢出，图片加载正常。主按钮视觉高 32px、触控高 44px、最大宽 148px。 | [layout-validation.json](./proof/layout-validation.json) |
| 交互 | 32 项全部通过：候选初始未选、同窗选中、嵌套关闭返回、行囊滚动、NPC 更多与服务确认、入场锁定、法术 / 药品直接反馈、归档完成 / 跳过后回城、加载态不可关闭。 | [functional-validation.json](./proof/functional-validation.json) |
| 控制台 | 两份浏览器记录 `consoleErrors` 均为空。 | 同上两份 JSON。 |
| 视觉 | 12 张 320px 代表截图逐张检查。角色装备槽图标缩至 28px，维持 44px 触控区；普通横行 / 候选小图仍为 40–48px。 | [代表截图目录与逐项链接](./README.md#文件与验证边界)；[回响](./proof/relic-320.jpg)、[角色](./proof/character-320.jpg)、[结算](./proof/result-320.jpg)。 |
| 文档 | 相对链接回读与 `git diff --check` 通过。 | README 与 COVERAGE。 |

源码行号用于追溯内容与玩法契约，不等于原型执行过相应生产路径。本次采纳源码盘点、内容校准和原型实现结果；没有修改 Cocos 生产 UI，也没有进行正式 Cocos 或微信开发者工具验收。原型只演示本页交互，不读取或修改玩家存档。
