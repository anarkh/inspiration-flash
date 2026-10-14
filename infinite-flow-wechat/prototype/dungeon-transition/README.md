# 副本区域通道 · HTML 外观原型

预览：[区域通道](http://127.0.0.1:8125/prototype/dungeon-transition/index.html) · [副本体验总览](http://127.0.0.1:8125/prototype/dungeon-ux/index.html)

也可直接打开本目录 `index.html`；页面使用普通脚本，返回总览的链接明确指向 HTML 文件。

把副本的几何木门改为有纵深的风化石门：青灰石块、旧金镶线、门后低亮暖光。目的地名称置于门上方，交互动作留在屏幕下缘。门体是独立透明 PNG，无矩形牌底、粒子或旋涡。

此目录是独立 HTML 外观原型。没有修改 Cocos 生产代码、领域规则、地图、正式资源登记或存档。主方案「微光石门」带少量地面引光；「静默石门」复用同一 PNG 并关闭额外地面引光，方便比较克制程度，不是另一张生成图片。

## 可操作内容

| 控件 | 实际行为 |
| --- | --- |
| 微光石门 / 静默石门 | 切换额外地面引光；保留原始石门 PNG |
| 妖塔 / 地铁 / 矿井 | 切换三个真实副本背景、当前位置与相邻目的地 |
| 未解锁 | 显示未知区域、弱化门体；点击弹出未开放原因 |
| 可前往 | 角色回到出生点；点门或底部按钮播放走近，再弹出演示结果 |
| 已近身 | 角色放在门前 110 的交互半径内，可直接演示前往 |
| 石门 / 屏幕下缘按钮 | 根据入口状态执行以上交互 |
| 返回场景 | 关闭结果弹层；Escape 也可关闭 |
| 重置演示 | 回到妖塔、微光石门、可前往状态 |
| 外观与接入说明 | 展开或收起外观、素材与正式接入约束 |
| 返回总览 | 返回另一项地图原型的并列入口 |

所有普通控制的触控高度至少 44px。最短场景高度 420px 时，门体本身点击区域约 51 × 70px，另有屏幕下缘按钮。键盘 Tab/Enter 可操作；焦点有旧金描边；走近动画尊重 reduced-motion。

## 与游戏现状的对应关系

读取自 `../../cocos/assets/scripts/ui/walk-world.ts` 和 `InfiniteFlowWalkScene.ts`，只用于展示，不导入或复制 reducer：

- 副本房间为 1000 × 1000，出生点 `(500, 700)`；本页采用东侧单门 `(875, 500)`，交互半径 `110`。
- 演示角色近身点 `(790, 530)` 距离门约 `90.14`，确实位于半径内。可前往状态先移动约 1.45 秒，使用真实步行图集的向右行、4 帧、9fps。
- 玩家 body 按副本实际 `104 × 104`；门 PNG 画布显示为 `122 × 167`，可见门体高度接近旧门的 `155`，不改变门与人物的尺寸关系。
- 真实 transition 来源为相邻地图节点。正式可前往动作必须引用该目标已有的 `run/move`，并匹配 `nodeId`；本原型不构建命令。
- 正式近身后继续触发该目标原有「前往」动作。未开放入口仍由现有地图显示原因。本页弹层仅演示结果，不连接地图和存档。

| 背景 | 展示的真实相邻节点 | 原资源 |
| --- | --- | --- |
| 妖塔一层 | 窥视符眼 → 双影巡逻 | `dungeon-world/demon_tower_1-v1.png` |
| 镜潮地铁 | 倒影岔路 → 轨道巡逻 | `dungeon-world/metro_abyss-v1.png` |
| 星坠矿井 | 重力岔路闸 → 跳火小鬼巢 | `dungeon-world/starfall_mine-v1.png` |

三个背景及玩家图集均从 `../../cocos/assets/resources/` 直接引用，没有拷贝或重编码。原图都是 1254 × 1254，人物图集 4 × 4。

## 新素材来源

- 最终文件：[assets/ruined-stone-gate-v1.png](assets/ruined-stone-gate-v1.png)
- 完整提示词：[assets/ruined-stone-gate-v1.prompt.txt](assets/ruined-stone-gate-v1.prompt.txt)
- 完整生成记录：[assets/ruined-stone-gate-v1-result.json](assets/ruined-stone-gate-v1-result.json)
- 工具：内置 `image_gen.imagegen`，`transparent_background: true`。一次生成，未用 CLI/API 路径。
- 输出：1073 × 1465、RGBA、2,322,022 bytes，alpha 完全透明像素占 31.886%。
- SHA-256：`48aa094175451317d0a44d18dc6dabafd245f646dff1c578ec76bcab10dd6e69`。
- 原始文件：`/Users/bytedance/.codex/generated_images/01a0f19f-2b43-79d2-bd9f-caa6cbd96ba5/exec-774fc517-232a-4e42-91d4-a1ebe753acce.png`。
- 最终 PNG 是工具输出的逐字节复制，无裁切、抠图、缩放重编码或像素后处理。浏览器只做显示缩放；未解锁的灰暗效果为 CSS 状态；独立地面引光为 CSS 展示层。

## 验证

`node --check app.js` 通过。页面、CSS、JS、石门、玩家图集、三个背景和总览 9 个资源均 HTTP 200；没有 localStorage、sessionStorage、IndexedDB 或存档写入。记录见 [proof/static-checks.json](proof/static-checks.json)。

主代理使用 CUA 进行实际浏览器验收并记录 320/390px 视口、资源加载和全部控制行为；详细结论见 [浏览器验证](proof/browser-validation.json)，截图见 [320px](../dungeon-ux/proof/transition-mobile-320.png) / [390px](../dungeon-ux/proof/transition-mobile-390.png)。微信真机与 Cocos 正式接入均不属于本目录的验证结果。
