# 宝箱领取 · 紧凑弹窗原型

本目录保留独立 HTML / CSS / JavaScript 可点击原型，用于确认宝箱领取的布局与交互。沿用游戏黑金配色与现有素材，将节点说明、明确的奖励预览和唯一主操作放进紧凑弹窗，去掉「现场说明 / 选择行动 / 查看详情」的多层跳转。已确认方案于 2026-10-12 接入 Cocos 游戏，见文末接入记录。

独立原型页仍仅演示本页内存中的状态，不读取用户存档，不调用游戏命令；刷新页面可重新演示。下述固定样例与原型验收不替代实际游戏接入验收。

## 操作流程

1. **待领取**：展示宝箱图、节点名称、地点和奖励清单。点击底部「领取奖励」。
2. **领取中**：禁用重复提交，显示处理反馈；同一节点的基础奖励只计入一次。
3. **回响选择**：有回响的节点在同一弹窗展示「已领取」摘要和两个候选。点击卡片只选中，底部「获得[名字]」才提交选择；尚未选中时不可提交。
4. **已完成**：回响确认后回到地图并反馈所得；不含回响的节点直接回到地图显示收获。可点击「查看收获」回看，完成节点不可再次领取。

关闭弹窗保留当前流程；在回响阶段关闭不会跳过选择，再次打开仍回到待选状态。奖励属于本局战利品，领取节点不等于离场结算。

页面外的演示控件提供两个节点样例及 390 / 320 宽度切换；这些控件不属于游戏 UI。样例用于比较两条领取流程，不代表用户当前进度或存档。

## 样例与素材依据

| 节点 | 基础奖励 | 回响流程 |
| --- | --- | --- |
| 巡哨布袋 `watch_post_cache` | 奖励点 +70，药炉灰 ×1 | 雾锋 / 聚念棱镜二选一 |
| 北墙补给龛 `north_supply_niche` | 奖励点 +80，破禁符 ×1 | 无回响，直接完成 |

节点与奖励来自 [demon-tower.ts](../../packages/core/src/level-data/demon-tower.ts)；物品名称来自 [game.ts](../../packages/core/src/game.ts)。北墙补给龛描述中的「驱邪残符」对应 `dispel_talisman`，正式物品名称为「破禁符」，奖励清单使用正式名称。

回响示例使用 [run-relics.ts](../../packages/core/src/run-relics.ts) 中的真实定义：雾锋为「攻击 +6，术法 +4」，聚念棱镜为「每场战斗开始时战意 +1」。候选组合为固定演示数据。

素材均复用 `cocos/assets/resources/` 下的现有图片：

- 宝箱：`dungeon-world/chest-v1.png`
- 药炉灰：`item/medicine-ash-v1.png`
- 破禁符：`item/dispel-talisman-v1.png`
- 雾锋：`run-relic/mist_edge-v1.png`
- 聚念棱镜：`run-relic/focus_prism-v1.png`

## 原型与接入边界

原型阶段只演示固定样例；正式游戏接入使用真实状态生成奖励和候选，并保留以下规则：

- 实际候选受剩余候选池与装备导体等条件影响，可能为 1–3 个，不能固定为二选一。
- 已获得回响产生的奖励点加成、治疗等效果按现有逻辑结算，预览需对应实际所得。
- 当前探索奖励规则下，每清理 3 个非出口节点追加一次补给；原型固定奖励不覆盖该分支，依据见 [exploration-rewards.ts](../../packages/core/src/exploration-rewards.ts)。
- 待处理回响、节点防重复领取、本局战利品与离场结算的边界不变；原型完成反馈不代表永久背包已经结算。

## 独立原型验收记录

2026-10-12 通过浏览器实际点击验证。390×844 和 320×568 下，待领取与回响选择弹窗均完整可见，无横向或纵向溢出；弹窗按钮触控高度至少 44px。图片均正确显示，浏览器错误日志为空。

连续两次点击领取只增加 70 奖励点；选卡不立即提交，关闭后重开保留回响选择与已领物资。确认回响后回到场景，重开只能查看收获。普通物资一次领取后直接返回场景，奖励点增加 80；正式物品名为破禁符。两个完成状态均无重复领取入口。

原型阶段仅新增此原型目录，未操作当时已有游戏页或游戏状态。该阶段结果不代表 Cocos 或微信真机验证。

- [验证记录](proof/validation.json)
- [390 待领取](proof/claim-390.png) / [390 回响选择](proof/relic-390.png)
- [320 待领取](proof/claim-320.png) / [320 回响选择](proof/relic-320.png)
- [回响完成](proof/complete-320.png) / [普通物资完成](proof/ordinary-complete-320.png)
- [完整原型看板](proof/prototype-board.png)

## Cocos 正式接入 · 2026-10-12

已确认布局现已接入 `InfiniteFlowInfoSheet` 与 `InfiniteFlowView`。实际游戏显示紧凑宝箱图、真实奖励图卡和唯一「领取奖励」按钮；奖励预览由表现层调用真实 reducer 纯试算得到，试算不写入游戏状态。领取仍提交既有命令，沿用防重复处理和本局物资结算规则。

带回响的节点领取后在同一面板保留已领物资摘要，候选来自真实 `pendingDraft`，数量为 1–3 个。点击卡片只更新选中项，确认后才生效；关闭后重开同一份候选保留选择，关闭不会跳过待处理回响。普通物资领取成功后直接返回探索。勘探、封存、事件等特殊节点仍保留原有动作入口。

Creator 3.8.8 已完成最终 Web-Mobile 构建 `web-mobile-chest-claim-20261012`，可打开[本地游戏预览](http://127.0.0.1:8125/cocos/build/web-mobile-chest-claim-20261012/index.html)。实际浏览器已在 320×568 和 390×844 下使用真实命令生成的存档跑通两条流程：巡哨布袋领取奖励点 +70、药炉灰 ×1，随后确认雾锋，攻击 +6、术法 +4 生效；北墙补给龛领取奖励点 +80、破禁符 ×1，无回响并直接关闭面板。本轮未进行微信真机或发布验收。

实际游戏截图：

| 状态 | 320×568 | 390×844 |
| --- | --- | --- |
| 巡哨布袋待领取 | [320](proof/production-sync/claim-320.jpg) | [390](proof/production-sync/claim-390.jpg) |
| 已领物资与回响选择 | [320](proof/production-sync/relic-320.jpg) | [390](proof/production-sync/relic-390.jpg) |
| 回响确认完成 | [320](proof/production-sync/complete-320.jpg) | [390](proof/production-sync/complete-390.jpg) |
| 普通物资待领取 | [320](proof/production-sync/ordinary-claim-320.jpg) | [390](proof/production-sync/ordinary-claim-390.jpg) |
| 普通物资领取完成 | [320](proof/production-sync/ordinary-complete-320.jpg) | [390](proof/production-sync/ordinary-complete-390.jpg) |

完整结果见 [正式游戏验证记录](proof/production-sync/validation.json)。表现层测试、类型检查、构建及 source / scene 校验通过；sheet 自检覆盖双尺寸 8 个奖励样本与 12 张候选图卡，race 自检的 112 个场景全部通过，包含忙碌锁定、防重复提交和关闭重开保选。

用户当前存档经正式恢复入口迁移到新构建，状态、存储内容、剩余随机种子、角色位置和 revision 全部一致，未代选回响。当前真实进度画面见 [新版待选回响](proof/production-sync/live-preserved-relic-390.jpg)。本轮只有本地源码与本地 Cocos 浏览器构建，未发布微信版本。

### 回响图片比例与布局修正

正式接入后的回响图片曾直接填充横向图框，导致原图变形。本次仅在回响卡中按素材原始宽高等比完整显示，统一图片与文字内边距；单候选卡限制宽度并居中，双/三候选卡保持同高。已领取提示与候选数量并排，奖励明细按需另起一行；选中勾使用独立底色。效果文案换行保留数值与尾随标点，避免句号单独成行。

最新本地构建：`http://127.0.0.1:8125/cocos/build/web-mobile-relic-style-20261012/index.html`。图片缩放仅影响回响卡，领取命令和结算规则不变。

最终 Cocos 浏览器实测通过 [320×568](proof/style-fix/selected-320.jpg) / [390×844](proof/style-fix/selected-390.jpg)，原图与 Sprite 宽高比一致，关闭重开仍保留选择，确认获得后属性与正式存档均正常更新。实际用户进度及选中的雾锋已保留，未代为领取，见[当前游戏画面](proof/style-fix/live-selected-390.jpg)。类型检查、sheet 的 12 张候选卡布局检查与 race 的 112 场景通过；完整证据见[样式修复验证记录](proof/style-fix/validation.json)。
