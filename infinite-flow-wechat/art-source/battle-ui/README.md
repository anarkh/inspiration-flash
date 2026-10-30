# 战斗底部指令区美术

## 现状（2026-10-30）

游戏战斗底部用「黑白水墨」透明控件条：`style-exploration-v6/ink-muted-palettes/black-white-overlay.png`
（2172×724 RGBA）。左侧上下两个小钮是逃跑和自动，接着是法术、道具、防御，右下是带三颗战意珠的大攻击；没有底板，不写名字。
它由白墨透明控件条 `style-exploration-v6/01-ink-wash-transparent.png` 逐像素去色得到（Rec. 601 亮度，透明度不变），
记录在 `black-white-overlay.derivation.json`。最早定下的「黑红」版（`black-red-overlay.png`，全屏参考
`black-red-in-game.png`）也是由同一张白墨图改色而来，因与暗色战场太接近、按钮看不清而换下，保留作对照。

游戏资源是 `cocos/assets/resources/scene/battle-controls-ink-v1.png`（key `scene:battle_controls_ink`，`sips` 缩到一半），
裁切框见 `cocos/assets/scripts/ui/battle-controls-atlas.ts`；实机截图在 `proof-in-game/`。

## 仓库里保留的文件

只提交游戏用到的素材链和定稿记录：本文件、`prompts.json`、`style-exploration-v6/01-ink-wash-transparent.png`（及其生成记录）、
`ink-muted-palettes/` 下的黑白版（及去色记录）和黑红版（素材、全屏参考及生成记录）、`proof-in-game/`。
下文提到的概念图（兽首、门楣、锁链、庭院、v4、v5）、v6 其余方案与灰墨/暗金配色、以及几十 MB 的对比页 `index.html`
只留在本机作探索留档，没有提交。

## 探索过程（留档）

`prompts.json` 是概念图阶段的用途、参考图、提示词和文件名清单。

### 已定方向（2026-10-29 与用户确认，后被水墨方案取代）

- 整体：华丽、重质感；要解决前几版「质感廉价、太像系统面板、和场景割裂」。
- 材质：赤金乌铁——发黑的旧铁嵌赤金纹、包金边、带磨损，与游戏现有铁券弹窗同一家族，但做成精雕。
- 结构：一体底座横贯屏幕底部，上沿用纹饰和阴影融进场景，而不是一条直边面板。
- 纹章：剑、法印、行囊、盾重新画成与底座同材质的浮雕，不再用物品图。
- 流程：先出 2～3 张整屏概念图，用户选定方向，再拆成可接入的素材。

### 第一步：概念图

三张都用 `sharedPrompts.concept` 加该条的 `subject`，并附参考图 `reference-battle-390x844.png`（现在的战斗原型，
底部指令区留空）。概念图不需要透明背景，1024×1536 PNG。三张的区别：

| 文件 | 方向 | 攻击座位置 |
| --- | --- | --- |
| `battle-ui-concept-beast-v1.png` | 兽首底座：两端是咬住铁座的狴犴兽首，上沿是短铁刺 | 右侧拇指处 |
| `battle-ui-concept-lintel-v1.png` | 云纹门楣：像古庙铁门楣，两端祥云托架，上沿垂一排小铁坠 | 正中 |
| `battle-ui-concept-chains-v1.png` | 锁链符印：粗铁链和朱砂符封住的铁座，攻击座是带符纹的锁扣 | 右侧拇指处 |

生成后原图按文件名放进本目录，不要裁剪或修图。名字牌、战报条都要求留空，字由游戏里显示。

### 第一步之二：兽首底座简化

三张概念图出来后用户觉得「有点复杂」，确认（2026-10-29）：

- 以兽首底座为基础，轻度减法：保留底座和两端兽首，去掉上沿铁刺、所有名字牌和战报条，底座压矮到约屏幕下方 15%。
- 不显示指令名字，只靠纹章识别。
- 只有攻击座保留红底；法术、道具、防御改成暗铁底配金色纹章、边框更简洁。
- 逃跑、自动仍是左端两个小铁钮，加小浮雕标记（奔跑的人形、循环箭头）。

生成 `battle-ui-concept-beast-v2.png`：提示词用 `sharedPrompts.revise` 加 `concept-beast-v2` 的 `subject`，
参考图依次附 `battle-ui-concept-beast-v1.png` 和 `reference-battle-390x844.png`，1024×1536，不需要透明。

### 第一步之三：换成主神空间的主题

v2 用户确认「整体布局没问题」，但兽首（龙形）和红色主体不符合「主神轮回修仙空间」。参照游戏里轮回庭院的石供台、
石柱、石灯（风化青石、古铜金浮雕、莲花与卷云纹，几乎不用红）和主神空间的主神核心（发青光的菱形核心绕轨道环），
确认（2026-10-29）：

- 主题：底座和小座用轮回庭院的石雕语言（莲花、卷云），攻击座做成主神核心。
- 两端：古金卷云纹收头，代替兽首。
- 材质：青石配古金，不用亮黄金，也不用红。
- 攻击座：主神青光——发青光的菱形核心、两道古金轨道环、前面一把古金剑纹章；战意是轨道环上的三颗珠，亮的是淡青。
- 布局完全沿用 v2。

生成 `battle-ui-concept-courtyard-v3.png`：提示词用 `sharedPrompts.retheme`（不要用 `revise`，它要求保留兽首和红金）加 `concept-courtyard-v3` 的 `subject`，
参考图依次附 `battle-ui-concept-beast-v2.png`、`cocos/assets/resources/hub-courtyard/altar-v1.png`、
`cocos/assets/resources/hub-courtyard/pillar-v1.png`、`cocos/assets/resources/scene/main-god-space.png`，1024×1536，不需要透明。

### 已确定：黑红透明水墨（2026-10-29，2026-10-30 换成黑白）

v3～v6 之后，用户确定战斗技能 UI 使用 `style-exploration-v6/ink-muted-palettes/` 的「黑红」版：

- `black-red-overlay.png`：透明技能控件素材（2172×724 RGBA），六个控件——左侧上下两个小钮（逃跑、自动）、法术、道具、防御、
  右侧带三颗战意珠的大攻击；没有底板，不写名字。
- `black-red-in-game.png`：已确认的全屏效果参考。

2026-10-30 起游戏改用黑白水墨版 `black-white-overlay.png`（由同一套白墨控件条 `01-ink-wash-transparent.png` 去色得到，记录见 `black-white-overlay.derivation.json`），因为黑红版在暗色战场里看不清；下面的接入方式不变，只是来源换成黑白版。

接入（已完成）：源图原样保留在本目录；游戏资源 `cocos/assets/resources/scene/battle-controls-ink-v1.png` 是它用 `sips`
缩到一半的版本（key `scene:battle_controls_ink`），裁切框见 `cocos/assets/scripts/ui/battle-controls-atlas.ts`。
战意珠、战技就绪和可格挡的晕光、自动的转动、回合中变暗都由战斗舞台在引擎里绘制，不另出图。
本目录其余概念图和 `style-exploration-v6/` 的其他方案只作探索留档，不进游戏。

### 第二步：拆素材（不再需要）

选定的水墨版本身就是一张透明控件素材，直接按裁切框使用，下面的拆分计划作废，仅留档。

#### 原计划

按选定的概念图拆成可接入的独立 PNG（RGBA 真透明）：底座中段（可横向平铺或拉伸）和左右两端、普通指令座、
攻击座、四个纹章、战意宝石的亮与暗、逃跑和自动的小铁钮。按下、禁用、推荐发光由游戏里调色和叠光实现，
不用每种状态各出一张图。
