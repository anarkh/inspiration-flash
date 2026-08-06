# 美术、资源与跨端 UI 契约

## 1. 美术方向

权威生产背景位于：

```text
art-source/README.md
art-source/prompts/*.md
art-source/generated/*
```

核心方向：

- 原创深色中文无限流生存 RPG。
- 写实磨损材质，克制的复古科幻和暗黑奇幻。
- 炭黑与中性黑为底，氧化青边光、旧金主光、少量警示红。
- 清晰轮廓，避免 Q 版、玻璃质感抽卡框、紫色渐变、文字、Logo、水印、散景和画内 UI。
- 角色/怪物为手绘 2D 概念图；装备/道具为三分之四视角图标。

画幅：

| 类型 | 目标 |
| --- | --- |
| 角色/NPC/怪物肖像 | 2:3 或 manifest 指定 portrait |
| 装备/道具 | 4:5 |
| 副本横幅 | 4:1 |
| 主神空间场景 | 16:9 |

小游戏重新出图时应从原始 atlas 和 prompt 生成目标分辨率，不要从 Web 截图或已经缩放的 DOM 图像反推。

## 2. 资源 manifest 是单一真源

权威：

```text
src/game-assets.ts
GAME_ASSET_MANIFEST_VERSION = 1
```

稳定 key 形式：

```text
<kind>:<entityId>
```

示例：

```text
character:reincarnator
monster:fog_lesser_demon
equipment:training_blade
dungeon:demon_tower_1
scene:main_god_space
```

每条 `GameAssetDefinition` 保存：

- `key`
- `kind`
- `entityId`
- `src`
- `alt`
- `role`
- `width` / `height`
- `fit`
- `source`
- `sourceRevision`

小游戏应保留 key 和元数据，把 `src` 适配为纹理、图集、远程包或分包资源 ID。不能按中文显示名或文件名动态推导 key。

## 3. 当前资源数量

当前 manifest 共 187 条：

| kind | 数量 |
| --- | ---: |
| character | 1 |
| npc | 6 |
| monster | 59 |
| equipment | 65 |
| pet | 6 |
| item | 30 |
| dungeon | 19 |
| scene | 1 |

完整性验证：

```bash
npm run assets:audit
```

脚本会核对：

- 怪物、装备、道具、宠物和副本目录是否都有资源。
- manifest 中每个 runtime 文件是否真实存在。

## 4. 资源 revision 规则

- 大多数生成型运行时资源的文件名带 `-v1`、`-v2` 等后缀，用于创建可并存的 revision sibling；这是当前命名惯例，不是所有 `src` 必须满足的正则约束。
- 当前明确例外是 `dungeon:mirror_cycle_city` 的 `/mirror-cycle-city.svg` 和 `scene:main_god_space` 的 `/main-god-space.svg`；它们没有文件名 revision 后缀，仍是 manifest 内的合法资源。
- `sourceRevision` 是来源追溯契约，文件名中的 `-v2` 是运行时资产命名维度，两者不可互相推导。例如当前晚期章节横幅的文件名为 `-v2.png`，但 manifest 中的 `sourceRevision` 仍为 `1`；上述两个 SVG 没有文件名后缀，`sourceRevision` 也仍为 `1`。
- 更换已发布资源时，对使用后缀命名的资源优先创建 revision sibling，再显式更新 manifest 的 `src` 和来源元数据；不要在不提升任何可识别 revision 的情况下静默覆盖旧资产。
- 验证器应校验 manifest key、`src`、`source`、`sourceRevision` 与实际文件的一致性，不应用“所有路径都以 `-vN` 结尾”作为通用审计条件。
- Tier 12–19 横幅和后续新增现代/未来内容有独立生成 brief，见：

```text
art-source/prompts/dungeon-banners-late-v2.md
art-source/prompts/modern-future-content-v1.md
```

## 5. Atlas 裁切契约

普通规则：

```text
left   = round(column * sourceWidth / columns)
right  = round((column + 1) * sourceWidth / columns)
top    = round(row * sourceHeight / rows)
bottom = round((row + 1) * sourceHeight / rows)
```

不要使用固定整数单元宽高累加，否则非整除尺寸会漂移。

当前运行时目标：

| 类型 | 尺寸 | fit |
| --- | --- | --- |
| item / equipment | 160 × 200 | contain，底色 `#090b0d` |
| monster | 288 × 384 | contain |
| dungeon | 720 × 180 | centered cover |

`dungeon-atlas-early-v1.png` 是例外。源图 `1983 × 793` 使用：

```text
x = [0, 991, 1983]
y = [0, 194, 367, 535, 687, 793]
```

不能按等分五行裁切。

## 6. 目标端资源适配

`AssetPort` 的唯一 v2 接口、`manifestRevision`、`AssetResult`、错误分类与加载报告定义见 [05-mini-game-migration-plan.md](05-mini-game-migration-plan.md)。本文件只规定资源内容和表现行为，不复制第二套接口签名。成功 handle、fallback、缓存 key 和错误报告都必须绑定同一个 manifest revision，避免灰度期间混用两版资源。

推荐预加载组：

- `hub-core`：主神空间、固定角色、6 NPC、常用初始装备。
- `chapter-<id>`：章节横幅、章节怪物、Boss、章节装备和材料。
- `combat-common`：战斗通用图形、状态和效果。
- `codex-page`：图鉴当前分页，不一次加载全部 187 张。

规则运行不能依赖图片加载成功。资源失败应显示可见占位并允许重试，但不能阻塞状态转移。

## 7. UI 信息层级

每个功能界面按以下顺序组织：

1. 当前目标。
2. 当前状态和关键数值。
3. 可执行动作。
4. 风险或不可执行原因。
5. 完整机制帮助。
6. 历史日志和审计细节。

不要把第 5、6 层全部常驻展开，也不要为了缩短页面删除它们。

## 8. `?` 帮助跨端表现

Web 当前支持 hover、键盘焦点、点击和 Escape。小游戏没有 hover，应采用：

- 短按 `?` 打开底部说明层或轻量弹层。
- 长按功能名可作为冗余入口，但不能替代可见 `?`。
- 关闭后把输入焦点或手柄选中态还给原入口。
- 层内显示 title、summary、mechanic、guidance 和 readout。
- 长内容可滚动；关闭动作在滚动后仍应容易触达。

触控口径：

- 所有主要按钮至少 44 × 44。
- `?` 视觉圆点可以保持 28px，但透明命中区至少 44 × 44。
- 关闭按钮命中区至少 44 × 44。
- 不只依赖颜色表达推荐、高风险、锁定或完成。

## 9. 地图表现契约

当前地图是 6 列逻辑网格，但小游戏表现可以：

- 维持 6 列并允许平移/缩放。
- 在窄屏改为卡片化局部地图。
- 只显示当前位置周围窗口，同时保留完整逻辑坐标。

无论表现如何，必须保留：

- 节点 `id` 与逻辑坐标。
- 显式相邻边和路线门。
- 当前、相邻、已侦察、已清理、未侦察五类状态。
- Boss、出口、法则地标、恢复点和路线目标的不同标记。
- 非邻接节点不可直接移动。

迷雾状态应由 `exploration-visibility.ts` 的规则派生，不能由某个 UI 组件是否曾渲染决定。

## 10. 战斗表现契约

战斗 UI 可以重新设计镜头、卡面和动画，但应保留：

- 敌我双方生命、关键状态和 Boss 阶段。
- 敌方意图、推荐动作、高风险动作和原因。
- 普通攻击、术法、防御、武器技及关键数值。
- 道具库存与本局可用性。
- 进阶战术中的器魂、同伴、功法和血统。
- 当前战报与可展开历史。
- 捕获条件、撤退结果和无法执行原因。

完整公式放在帮助层，主卡只显示决策需要的即时数值。

## 11. 安全区、生命周期与可访问性

小游戏需适配：

- 刘海、圆角、底部手势区和动态安全区。
- 320×568 级别窄屏和 390×844 主验收屏。
- 字体放大与中文换行。
- 前后台切换、系统返回键和来电中断。
- 触摸、键盘或手柄焦点所有权。
- 减少动态效果偏好。

Web 的 ARIA、DOM focus trap 和 CSS media query 不能直接迁移，但其业务结果必须保留：

- 弹层打开时输入属于弹层。
- Escape/返回优先关闭最上层帮助，再关闭所在面板。
- 关闭后回到发起入口。
- 不出现隐藏按钮接收输入或重复提交。
