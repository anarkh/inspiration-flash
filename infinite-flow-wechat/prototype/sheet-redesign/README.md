# 弹窗精修原型（独立静态页，不接入游戏）

基于已选样式 **S02 玄戎旗楼** 的独立 web 原型，本轮按用户要求将
**装备（角色）与背包的布局、交互完全对标《魔兽世界》**（经典旧世 1.x 版 UI），
用于快速迭代信息密度与 tips 交互。**不依赖、不修改任何游戏代码**；
满意后再把结论落回 Cocos 实现
（`cocos/assets/scripts/ui/layouts/sheet-style-02.ts` / `sheet-engine-scroll.ts`）。

## 运行

```
python3 -m http.server 8124 --bind 127.0.0.1 --directory prototype/sheet-redesign
# http://127.0.0.1:8124/index.html
```

直接双击打开也可以（无构建、无外部依赖）。窄屏点右上角 320/375 切换
（也可 `?w=320`）。

## 三个窗口（全部为魔兽式窗框：金漆标题栏 + 暗金斜边框 + 厚内阴影）

1. **角色信息 = 纸娃娃面板（CharacterFrame）**：角色立绘居中，7 个已装备槽位
   分两列夹持（头/颈/胸/足在左，主手/手/腰在右），底部属性卡（战力/生命/
   攻击/术强/防御 + 货币）。
2. **行囊 = 经典背包窗口（ContainerFrame）**：右上角货币行（金币式奖励点 +
   灵石式灵蕴），左侧「携行槽 n/3」解释金菱形标记；**5 列 × 100 格**
   （格子收紧、窗口仅内容高，纵向滚动浏览全部 100 格）；物品图标右下角白色
   堆叠数（0 为暗色）、品质色描边（白/绿，魔兽品质色）、已携行格右上角
   金色菱形标记。无独立背包子袋栏（原底部装饰栏语义不清，已去掉）。
3. **主菜单 = ESC 主菜单**：竖排金边大按钮，朱砂仅用于「进阶行动」。

三个窗口均为**内容定高、垂直居中**，不再铺满整屏；超高内容（100 格背包）
在窗口内滚动。

窗口切换靠底部 micro button 条（角色 C / 行囊 B / 菜单 ESC，对标魔兽主菜单
条按钮）。

## Tooltip（对标 GameTooltip）

- **悬停即出**，跟随光标，自动避开窗口边缘；**点击格子钉住**（再点空白关闭），
  触屏无 hover 时点击即看。
- 内容自上而下：**品质色物品名**（粗糙灰 / 普通白 / 优秀绿）、槽位/类别行、
  绑定/库存行、**绿色「装备/使用」效果行**、**黄色斜体风味文本**
  （取自 `game-assets.ts` 的视觉描述 + 物品/装备说明）、暗金分隔线 +
  兑换价/等阶尾注。
- 物品 tips 带「设为携行 / 取消携行」按钮（通用携行槽 3/3 上限，纯前端模拟；
  满槽时其余物品按钮禁用并红字提示）。

> 注：游戏数据模型目前**没有稀有度字段**，原型里的品质色仅为视觉 mock，
> 方便评估效果，落回游戏时不会新增数据字段。

## 深链

- `#/menu`、`#/inventory`、`#/character`：直达菜单 / 背包 / 角色页
- `#/item/<id>`：直达背包并钉住物品 tips（如 `#/item/healing_pill`、`#/item/gate_sigil`）
- `#/equip/<id>`：直达角色页并钉住装备 tips（如 `#/equip/training_blade`）

物品 id 与游戏一致：healing_pill / thunder_talisman / dispel_talisman /
gate_sigil / echo_coin / capture_net / spirit_bait / armor_patch / focus_incense。
装备 id：training_blade / patched_headwrap / patched_coat / patched_gloves /
patched_boots / patched_belt / plain_charm。

## 文案与素材来源

- 数值/文案：`packages/core/src/game.ts`（ITEMS）、
  `packages/core/src/equipment-catalog.ts`（装备槽位与基础属性）。
- 风味描述：`packages/core/src/game-assets.ts`（itemAssets / equipmentAssets）。
- 图片为游戏在册 PNG 的副本（character/item/equipment，共 17 张，未新增美术）。
