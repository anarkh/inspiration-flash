# 精英装备三选一 · 游戏背包一致性演示

本页演示三选一领取与即时穿戴。装备领取后永久拥有，领取面板直接关闭；背包的布局与操作以真实游戏 `InfiniteFlowInfoSheet.ts` 为准。

## 背包交互

- 与游戏相同的「行囊」标题和三个分页：补给品、装备、本局遗物。每次重新打开默认进入补给品。
- 补给品使用五列物品格子、数量、余额和空槽；点击物品打开详情。当前示例为探索阶段，详情只提供关闭，与游戏一致。
- 装备使用四列格子，完整展示七件初始装备；领取后增加所选装备。图片、名称、部位、等级和穿戴状态来自真实 ViewModel。
- 点击装备打开独立属性浮层，显示基础属性、每级成长与固定词缀。在浮层内点击「装备」执行真实游戏命令；浮层保留并更新为「已装备」。换下的装备继续留在原格子中。
- 关闭浮层或点击背包面板外收起详情；点击其他格子直接切换详情，切换分页收起详情。标题关闭按钮关闭整个背包，重新打开重置为补给品页。当前示例没有本局遗物，使用游戏的空状态说明。
- 领取仍为原有的三张图片卡、就地属性、一个领取按钮；没有放弃操作和第二个领取结果弹窗。

## 数据与规则复用

`game-model-entry.js` 从生产 `core`、`application` 和 `presentation` 导入初始状态、装备和物品定义、ViewModel 与 reducer；`game-model.js` 是该入口的浏览器构建产物。页面不单独维护装备属性或换装规则。

布局对照：

- `cocos/assets/scripts/ui/InfiniteFlowInfoSheet.ts`：`renderInventory`、`renderInventoryEquipment`、`renderInventoryBag`、`renderRunRelics`、`renderSheetTip`。
- `cocos/assets/scripts/ui/dark-ui.ts`：颜色。
- HTML 样式按相同的 750 单位画布比例实现：背包 702 × 880、属性浮层宽 460；装备格子图片、间距与字级跟随生产实现。

生产模型变更后，在 `infinite-flow-wechat/` 重建：

```sh
./node_modules/.bin/esbuild prototype/equipment-loot-v1/game-model-entry.js \
  --bundle --format=esm --platform=browser --target=es2020 --minify \
  --alias:@infinite-flow/core=./packages/core/src \
  --alias:@infinite-flow/application=./packages/application/src \
  --alias:@infinite-flow/presentation=./packages/presentation/src \
  --outfile=prototype/equipment-loot-v1/game-model.js
```

## 演示边界

演示创建独立的探索 fixture，并预置雾行兜帽、灵纹软甲、破甲剑三件待选奖励。领取、装备与属性均经过生产模型；页面只保存内存状态，不读取或修改用户实际游戏存档，也不代表 Cocos 或微信端的发布验收。

支持 390 × 844 与 320 × 568 舞台；重置演示会清空本页进度。`proof/` 中此前版本的截图属于历史记录，本次一致性验证单独记录。

[打开演示](http://127.0.0.1:8125/prototype/equipment-loot-v1/)

## 本次一致性验收

390 × 844 与 320 × 568 的浏览器实测通过：领取后装备从 7 件增加到 8 件、四列完整展示、属性浮层内穿戴与换回、分页切换、面板外关闭详情、标题关闭背包及重新打开重置分页均已验证。两种宽度下装备图片全部加载，无横向溢出，浏览器无警告或错误。

[验收记录](proof/game-backpack-validation.json) · [390px 背包](proof/game-backpack-390.png) · [320px 背包](proof/game-backpack-320.png) · [320px 穿戴浮层](proof/game-backpack-equipped-320.png)

## 真实游戏接入与验收

已将三选一交互同步至生产 Cocos：精英候选出现时自动打开；三张图卡本页切选，关闭后重开保留选择；唯一「收入背包」按钮提交，忙碌时锁定卡片、关闭和重复领取；成功直接回探索并显示新装备入库提示。背包沿用现有三分页、装备格子和穿戴浮层实现。

本次真实引擎在 320 × 568 和 390 × 844 下均完成：击败剔骨塔卒自然生成三选一 → 选灵纹软甲 → 领取 → 背包查看 → 穿戴 → 换回。装备由 7 件增至 8 件，换装不额外回血，原装备和等级全部保留；正式存档回读及重新创建客户端恢复结果一致。320px 另验证关闭后移动不会重弹、走近重新交互仍保留选择。

使用隔离测试存档，初始角色 body=40、agility=20，用于缩短战斗；准备路线经过 8 次真实客户端命令。测试包停在精英最后一击前，装备候选和领取结果均由实际游戏生成，没有注入候选或所有权。未修改用户原存档。验证范围为本地 Web Mobile，未进行微信端发布或真机验收；试玩页刷新会重置内存进度。

[真实游戏试玩](http://127.0.0.1:8125/cocos/build/web-mobile-equipment-claim-20261012/index.html) · [完整验收](proof/production-sync/validation.json) · [320px 三选一](proof/production-sync/offer-320.png) · [320px 已穿戴](proof/production-sync/equipped-320.png) · [隔离测试存档](proof/production-sync/natural-offer-packet.json)
