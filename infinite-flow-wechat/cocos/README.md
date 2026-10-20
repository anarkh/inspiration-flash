# Cocos Creator 3.8.8 target

本目录是微信小游戏生产目标工程。入口场景为
`assets/InfiniteFlow.scene.scene`，Canvas 只挂载一个 `InfiniteFlowApp`；运行时 UI
节点由表现层 ViewModel 构建，不持有可写领域状态。

## 2D 行走模式

大厅、探索和战斗默认显示可操控的全身人物。`ui/walk-world.ts` 投影当前房间及原有
动作，处理连续移动、碰撞和互动范围；`InfiniteFlowWalkInput` 绑定键盘/摇杆；
`InfiniteFlowWalkScene` 绘制房间、精灵动画、景物遮挡、镜头和触控按钮。
`InfiniteFlowApp.update` 每帧推进本地坐标，不发送移动领域命令；只有主动互动才
透传既有事件。`InfiniteFlowInfoSheet` 承载角色、背包、地图、目标、记录、菜单、
NPC、入场、现场选择、帮助目录和结算明细；打开时暂停移动，关闭保留位置。
`dungeon-world-theme.ts` 只存19章美术元数据，不参与规则、解锁或存档。

探索和战斗按 `prototype/dungeon-room-fullscreen-v2/` 布局。原背景独立等比覆盖
整个游戏区域，不受房间遮罩或镜头投影影响；HUD 下方与底部 120px 操作区之间
固定四向门和中央目标。世界 X/Y 分别映射到可用空间，演员抵消坐标缩放，图片
保持原始比例；镜头不随人物移动。世界边界、出生点、当前人物坐标及互动半径
保留，目标只在 View 内重排，互动、标记和特效共用重排后的脚点。
缺少真实邻居的方向显示封闭门，战斗期间四门封闭；同方向多个真实分支全部保留，
通路和禁用原因读取原有动作。六个战斗入口仍位于底部两排。窄屏南门状态文字
置于门图内侧；安全区压缩高度时，战斗血条让出北门文字区域。
320×568 / 390×844 的实际探索与战斗、真实摇杆和普攻，以及当前进度十项回读
已通过，见[HTML 布局整合验收](validation/room-html-20261014/README.md)。

上述 11 类 sheet 已按 `prototype/modal-system-v1/` 整合到 Cocos，并覆盖独立机制
帮助、场景加载、运行阻断、HUD 提示和物品提示。统一采用暖棕暗金配色，图片保持
原始比例；弹框宽度上限 304px、高度上限 464px，内容滚动区上限 300px。按钮视觉
高度为 32px、触控高度至少 44px，宽度上限 148px；空间不足时由内容区滚动承载。
这次调整保留玩法、存档、既有命令与禁用规则，角色速度仅投影已有派生值。

本次已完成 `npm run build`、Cocos 与 Creator 类型检查、presentation 测试、
`cocos:sheet:test`（2028 个真实 ViewModel）、`cocos:race:test`（145 个场景）、
`source:verify`、`scene:verify`、`platform:verify`、主题检查（33 组）与布局检查（60 组）。
320×568 / 390×844 两种尺寸共验证 54 个实际 Cocos 场景与 6 个浮层场景，当前完整
进度回读一致，详见[全弹框整合验收](validation/modal-system-20261013/README.md)。
同时修复已缓存封面转为结算背景时漏挂场景，以及缓存图片在 `await` 前后交接资源
租约的竞态。最新实际重试后场景为 `ready`，雾锋、聚念两图的原生资源均为 `valid`，
存档 revision 仍为 9。

精英装备候选出现时自动打开三选一面板，同屏展示三张装备图卡，点选后更新下方属性。
关闭后重新打开同一份候选会保留选中项；点击唯一的「收入背包」按钮提交，处理中
显示「正在收入背包」并锁定选择和关闭。成功后直接回到探索，显示已入库的装备名，
不再弹出第二层确认或结果面板。
领取即永久拥有，并在「行囊 → 装备」显示全部已拥有装备和当前穿戴状态；领取不会
自动换装。点击装备查看属性，在主神空间或探索中可手动穿戴，战斗中不能换装。
穿戴动作沿用 `hub/equip-equipment`，副本内不提供强化等主神空间服务。
撤退或失败都保留已领取装备；奖励点、灵蕴和补给品等其他收益继续按原规则结算。

主神空间采用已确认的「轮回庭院」：1200×720 的浅纵深横向场景，出生点为
`(600,550)`，相机固定纵向、仅跟随横向。角色使用左右侧身帧，纵向移动保留
最后左右朝向；横向/纵向移速分别为 260/145。副本仍使用原四向行走与镜头。
点击地面可绕行至目标点；点击 NPC 或传送门会步行靠近并打开原有面板，普通经过
不会自动交谈。手动移动、弹层、隐藏应用或销毁场景取消尚未完成的路线。

庭院背景、石柱、箱子、祭坛和石灯位于 `assets/resources/hub-courtyard/`，逐字节
复制自 `prototype/hub-draw/assets/` 的已确认素材，生成记录及完整提示词仍保存在
原型目录。4 件景物按透明主体边界等比绘制、底边对齐脚点；碰撞仅使用石柱、
箱子和祭坛的地面足印，石灯不阻挡。资源继续归属既有远程 `resources` bundle。
庭院手机 HUD 使用 64px 角色栏、44px 背包/菜单按钮、紧贴按钮下方 6px 的小地图及
64×44px 交谈按钮；不显示场景标题、摇杆上方状态、E 提示、跳跃、奔跑或寻找 NPC。

大厅、探索与战斗共用庭院顶部布局：左上角色头像、角色名、生命值、灰青色血条及
奖励点/灵韵余额，右上并排背包和菜单。三阶段在相同视口下使用一致的尺寸、位置、
字体和无边框透明底；文字使用小幅阴影。角色头像入口为 49×53 屏幕像素，裁剪为
47×51，生命条随角色信息区宽度自适应、高度为 4 屏幕像素。40 设计像素线描图标
沿用 `prototype/hud-menu-draw/`。大厅、探索和战斗共用 `character:reincarnator`
真实头像及资源租约；头像与其他场景素材一起就绪后才显示场景。
副本地图/目标入口使用同款带文字图标，位于背包/菜单下方；战斗保留目标入口。
副本状态条位于角色信息区下方，小地图与状态条仅保留较轻的半透明底。
探索与战斗余额来自账户实际余额，袋中战利品独立呈现；战斗扣血仍原位更新同一生命条。
实际触摸区域在 320/390 宽屏均不少于 44px；打开面板沿用原绑定并保持角色位置。
副本 HUD 不绘制副本名称或临时试玩提示。原 04 接入证据位于
`prototype/hud-menu-draw/proof/applied-04/`，已撤回的边框试版保存在
`prototype/hud-menu-draw/proof/shared-frames/`，无边框与真实头像证据位于
`prototype/hud-menu-draw/proof/borderless-portrait/`，当前三阶段统一顶部证据位于
`prototype/hud-menu-draw/proof/shared-header/`。

世界视口铺满整个画布，安全区只用于 HUD 和操作按钮避让。大厅及副本的背景窗口
覆盖可见世界范围，图片等比 cover 裁切；地图边界、碰撞坐标、角色缩放和相机移动范围
保持不变。逻辑边界保留碰撞，但不再绘制横跨背景的半透明条带。长屏不再露出
安全区黑边或地图外的纯色带。实测证据位于
`prototype/hud-menu-draw/proof/fullscreen-world/`。

进入大厅、探索或战斗时，先显示场景 loading，等当前所需背景、人物和物件的
SpriteFrame 全部就绪再统一展示。失败时显示「重新加载」，保留当前游戏进度；
自动重试、过期回包释放和内存告警后的资源重载沿用原生命周期管理。
已删除被新素材替代的矢量人物、怪物、门、道具及无入口的地板、墙体、火盆绘制。
资源盘点仍为 305 项；章节横幅、详情头像和历史设计源图仍有独立用途，继续保留。
首次加载、延迟最后一张图片、失败重试和恢复后战斗的真实引擎证据见
`prototype/hud-menu-draw/proof/scene-loading/validation.json`。

主神空间东侧副本入口使用已选定的第 7 款「万象画门」：
`scene:hub_dungeon_portal` → `assets/resources/hub-courtyard/wanxiang-scroll-portal-v1.png`，
逐字节复制自 `prototype/hub-portals-ten/assets/hub-portal-07.png`，保留
1018×1545 RGBA 原图。Sprite 在原 `WorldObjectBody` 下预补偿既有非均匀缩放，
保持原图比例、原脚点与 160×220 触控范围；加载期间由场景 loading 统一承接。
该资源仅在主神空间加载，进入副本后释放；完整提示词、生成记录与接入证据
保存在 `prototype/hub-portals-ten/`。

移动端入场面板采用 `prototype/dungeon-entry-v1/` 已确认的紧凑横向图文卡片，
在同一页选择副本并查看章节、推荐战力与解锁状态。底部固定入场协议摘要和统一
“进入副本”按钮，协议设置向上展开；三种回响随选择仅显示一行方向说明：
强攻“偏向输出与战斗收益”、守御“偏向防御、恢复与陷阱减伤”、寻路“偏向探索、传送与节点收益”。
副本门槛与操作仍沿用表现层的既有状态和命令；锁定章节可选中查看要求，但不能确认入场。

2026-10-12 宝箱领取已接入 `prototype/chest-claim-v1/` 确认的紧凑面板：宝箱图、实际
奖励图卡和唯一领取按钮同屏呈现。表现层使用真实 reducer 纯试算奖励预览，不写入
状态；确认领取仍执行既有命令。带回响的节点在同面板展示已领物资与真实 1–3 个候选，
选卡只更新选择，确认才生效，关闭重开同一份候选保留选择；普通物资领取后直接回到探索。
勘探、封存、事件等特殊节点保留原动作，本局物资与离场结算规则不变。

最终 Creator 3.8.8 Web-Mobile 构建为 `web-mobile-relic-style-20261012`。
回响卡图片按原始比例完整显示，顶部提示同行、选中标记有独立底色；单卡居中限宽，
双/三卡同高，文字换行保留数值与尾随标点。样式证据见 `prototype/chest-claim-v1/proof/style-fix/`。
实际浏览器 320×568 / 390×844 已跑通巡哨布袋领取奖励点 +70、药炉灰 ×1 后确认雾锋
（攻击 +6、术法 +4），以及北墙补给龛领取奖励点 +80、破禁符 ×1 后直接关闭面板。
这与独立 HTML 原型的固定内存样例分开记录，详见[宝箱正式接入与截图](../prototype/chest-claim-v1/README.md#cocos-正式接入--2026-10-12)。
可打开[本地游戏预览](http://127.0.0.1:8125/cocos/build/web-mobile-relic-style-20261012/index.html)；本轮未进行微信真机或发布验收。

区域通道石门使用 `scene:dungeon_transition_gate`，资源为
`assets/resources/dungeon-world/ruined-stone-gate-v1.png`。它逐字节复制自已确认的
`prototype/dungeon-transition/assets/ruined-stone-gate-v1.png`，保留 1073×1465 RGBA、
透明 alpha 和独立 Creator UUID；完整提示词与生成记录仍保存在原型目录，归属既有
远程 `resources` bundle。

生产地图由 `InfiniteFlowInfoSheet` 展示圆形类型节点、已知数量、真实已知连线和状态
图例。点击节点仅更新下方详情，不移动角色；普通 6×5 地图保留 44px 点击区域并同屏
展示，炼狱更宽地图按需横滚。`MapViewModel.knownEdges` 只包含两端已知的连接，普通
副本按物理网格、炼狱按持久化 `connectionIds` 投影；可达与门禁仍读取原有移动规则。
详情的出口方向与场景通道一致，无名称放大、分页或附近路线切换。

大厅七位 NPC 使用独立的全身立绘资源 `npc:*_world`，原有头像继续供详情面板使用。
全身立绘源文件位于 `art-source/npc-world/`，1024×1536 PNG 逐字节复制到
`assets/resources/npc/*-world-v1.png`；manifest 固定来源、尺寸和 SHA-256，Creator
生成稳定 `.meta`。

59 种怪物使用 `monster:<id>_world` 独立世界图，探索和战斗沿用相同怪物身份，原有
头像资源继续保留。`art-source/monster-world/` 中的 1024×1536 RGBA 源图逐字节复制到
`assets/resources/monster-world/`，每张图有独立稳定 UUID、透明 alpha 和来源哈希。
资源总数为 305；怪物图加载失败时显示场景重试入口，玩法、位置和碰撞规则保持原样。

2026-10-08 已确认的风格原型接入正式资源：9 件副本物件（宝箱、出口、事件牌、
陷阱、勘探、遗物台、祭坛、法则书台、碎石）使用 `scene:dungeon_prop_*`；另外
17 张功法、血统、装备、肖像和镜像城横幅保持资源 key，更新为 v2 原图。
26 张 PNG 均逐字节复制自 `prototype/style-refresh/assets/`，保留完整提示词与来源记录。
旧图及 metadata 留档于 `art-source/style-refresh/before/`，不再随正式资源打包。
物件按透明主体边界等比绘制并对齐既有脚点，沿用原碰撞和动作绑定；加载中或失败
使用统一场景 loading 或重试页面。主城与副本 HUD 统一暖黑、旧金、灰青配色和半透明摇杆，保留布局与触控尺寸。
接入记录与实测证据见 [素材接入说明](../prototype/style-refresh/README.md)。

主角行走已切换到 `character/reincarnator-walk-v2`：采用新全身设定的成年比例、
灰青围巾与旧铜单肩甲。原 PNG 保留，通过 16 个实测矩形和统一逻辑脚点绘制，
不再按等分网格切图；保留原 9 fps、角色尺寸、移动、碰撞及交互坐标。
原图、提示词、帧定义与接入记录见 [主角素材说明](../art-source/hero-redesign/README.md)。

从迁移工程根目录检查：

```bash
npm run cocos:walk:test
npm run cocos:race:test
npm run cocos:sheet:test
```

用 Creator 3.8.8 构建 Web Mobile 到 `cocos/build/web-mobile` 后，可用静态服务器
预览；这只是内存试玩，不是微信发布构建。双档真实输入检查会拒绝旧构建，并将
人物位置、图集帧、镜头、物理输入和截图写入 `cocos/build/web-mobile-canvas-smoke/`：

```bash
npm run cocos:web-mobile:smoke -- --viewport=750x1334
npm run cocos:web-mobile:smoke -- --viewport=320x568
```

该脚本分开记录物理输入自然路线与 `dungeonRendererGallery`：前者验证移动、弹层、
19章入口切换和首章战斗；后者用真实 reducer 入场生成的19个隔离 ViewModel 验证
渲染主题，前后断言客户端领域状态不变。图库不是逐章通关或微信真机证据。

2026-09-30 庭院接入验证：Creator 3.8.8 Web Mobile 构建、两类 Cocos 类型检查、
96 个场景检查和 44 个世界检查通过。320×568、750×1334 的完整物理输入流程均
自然退出码 0；每档保存 40 张流程截图、验证 19 章入口和 19 个副本渲染样本，
浏览器失败数为 0。两档各验证 30 张面板布局截图；750px 档另验证 30 张主题截图。
记录见 [庭院接入验证](../prototype/hub-draw/proof/cocos-courtyard-integration-validation.json)，
实际引擎截图见 [320px](../prototype/hub-draw/proof/cocos-courtyard-mobile-320.jpg) /
[390px](../prototype/hub-draw/proof/cocos-courtyard-mobile-390.jpg)。本轮未做微信真机或发布验收。

试玩时确认：庭院左右侧身行走与松手停止、景物阻挡、横向镜头跟随、近距离交谈、传送入场、
遇敌战斗与结算回城。战斗中暂停行走；站位只是演出，不构成闪避或攻击距离规则。

## 战斗操作与动画

战斗按 `prototype/combat-v2/` 的对峙布局：`getCombatDuelLayout` 在同一房间投影内给出
主角与敌人的站位（只改 View 内脚点，世界数据与逻辑坐标不变），战斗时房间遮罩延伸到安全区
底部，四扇封闭门、摇杆和互动键收起。HUD 依次为敌方卡片（回合菱形、阶级、名字、血条）、
最新战报和敌人身侧的意图气泡；蓄力重击时气泡与防御键都挂「可格挡」。
操作区为右下大攻击键（外圈战意环）加防御、法术、雷火符、药品四个扇形圆钮，左下为脱离。
攻击从现有 ViewModel 选择可用武器战技，否则执行普通攻击；按钮显示当前模式和战意。
法术、药品使用底部透明背景小面板，点选卡片直接执行，灰态卡片显示不可用原因。
已配置的功法、同伴、血统、器魂可直接选择；放弃本轮在菜单中确认。

`InfiniteFlowCombatEffects.ts` 用原生 Graphics 和帧更新播放前摇、命中与反击：近战冲刺到
敌前出招，命中顿帧、震屏、受击泛红和放大的伤害数字；重击反击更重，完美格挡显示冰蓝护盾。
命中时只提交一次真实命令；成功后消费 `combat.presentation-resolved` 的真实中间 HP，
按顺序刷新伤害、回血和反击，动画结束才切换胜负场景。播放期间关闭重复输入和移动，
销毁或运行阻断会取消动画。

重击回合的防御带 `parryEvent`：动作先播放约 0.9s 的收缩判定圈，全屏透明接收层（或空格）
接住点击，圈落在目标带内提交 `parryEvent`（`timing: 'perfect'`），否则提交原 `event`；
是否完美格挡由领域层结算，反击帧的 `perfectParry` 决定是否播放完美格挡效果。

```bash
node cocos/headless/combat-effects.self-check.mjs
npm run cocos:sheet:test
npm run cocos:race:test
```

## 两类 TypeScript 检查

clean clone 在没有 Creator 的情况下，从迁移工程根目录执行：

```bash
npm ci
npm run typecheck
```

它使用 `tsconfig.headless.json` 和 `headless/cc.d.ts` 的最小声明。shim 位于
`assets/` 之外，Creator 不会导入它。若只想重复 Cocos workspace 检查，须先在根
目录执行 `npm run build` 生成共享包 declarations，再执行
`npm run typecheck -w infinite-flow-wechat-cocos`。

`npm run cocos:race:test` 会用虚拟 `cc`/host 运行 105 个 headless 场景，覆盖 preview/wx
生命周期 handoff、异步动作与销毁 generation fencing、缺失 lifecycle `off*` 时
fail closed，以及 config/resources manifest、ImageAsset 精确引用释放、memory warning、
revision mismatch、普通 Creator 错误分类、bootstrap/per-key 隔离的 offline/timeout
错误状态与 250/1000/3000/10000/30000ms 封顶持续退避恢复，以及场景加载门禁、手动重试与恢复。
其中新增 9 个微信开发者工具 NON_RELEASE 场景：仅当 `wx` 存在、未注入持久边界且
`getDeviceInfo()`（缺失时才回退 `getSystemInfoSync()`）报告 `platform === 'devtools'`
时，运行时用 `InMemoryStoragePort` 建立独立 NON_RELEASE 客户端——存档只在内存，
刷新或关闭即丢失，界面永久标注“微信开发者工具 · NON_RELEASE / 内存存档 / 关闭或
刷新即丢失”，生命周期诊断（含 durable resume）永不升级为已签核持久模式。ios/
android/ohos/mac/windows/unknown 或畸形/抛错的 `getDeviceInfo` 在无边界时于任何可写
状态前 fail closed，绝不被当作 preview；真机仍必须显式注入已签核持久边界
（`configureInfiniteFlowWxDurabilityBoundary`）才能获得持久存档，注入的边界即使在
devtools 也优先于 NON_RELEASE 内存路径。每个 NON_RELEASE 场景还断言
`wx.getStorageSync`/`wx.setStorageSync` 零调用——epoch 与 save 只写入内存存储，
绝不触碰 wx journal；销毁后才 settle 的 devtools 命令（成功或失败）同样不回写 UI、
不读状态、不补 seed、不触碰 wx storage。
入场构筑回归还验证路线契约只属于当前副本、切章清除而协议/炼狱层级切换保留合法
契约，以及归档遗物种子只桥接为一条 `hub/configure-relic` 客户端命令且不触发入场
seed 补充；该命令在销毁后的成功/失败延续都不会回写宿主状态。
装备封存委托的本地选择以 presentation 产出的完整 draft 替换宿主快照，Cocos 不重复
实现两件装备或材料规则；启动/召回沿用统一物理 command 通道，仅在存活请求返回
`committed`/`duplicate` 后清除 draft，拒绝、无效输入和持久化阻断均保留。headless
回归覆盖 replacement、两种成功去重结果、失败保留、销毁后的成功/失败延续，以及
idle/draft/active/推进/完成五态 formatter。状态卡专门显示两件装备、目标材料、不同
副本进度、召回损失和结算读数，邻近 `?` 直达机制帮助；通用动作卡仍由表现层动作
集合统一渲染。
现代装备记忆库没有 Cocos 本地规则或新 handler：`hub/activate-equipment-memory` 由
通用物理 command 通道原样发送并执行正常 seed refill。装备面板把记忆库与封存委托
并列呈现，读取 presentation 给出的 supported/owned/equipped、unlocked/active、自动
收录条件与下一循环项；两个 104×104 的邻近 `?` 分别打开各自帮助，单次触控只发出
一次 local event。现代探索没有狩猎 VM 时不绘制虚构任务；恢复的 legacy 狩猎才显示
display、节点/事件双信号精确 ID、下一目标、冻结铭刻和故障。战斗卡显示激活记忆、
匹配装备、overflow 储存/恢复，legacy 缺快照或畸形状态明确 fail-closed。结算卡允许
封存委托与装备记忆同时存在：legacy 保留原狩猎结果，现代只称“本章已收录/激活”或
“本章尚未收录”，不声称本次新获得。headless 还覆盖精确激活 command、正常 refill、
两种帮助点击、销毁后的成功/失败延续，以及上述 Hub/Explore/Combat/Result formatter。
Result 阶段的所有 detail（包括只有 outcome 的历史存档）都进入同一个 Result pager，
不再走 `renderSimpleStatus` 旁路；总览页始终存在。总览把 core `lastOutcome` 机器串
安全地转成中文概览（只提取已知的 outcome/score/multiplier/reward 字段并中文化，
未知值降级为中性文案），UI 绝不泄漏 `outcome=`、`score=`、`multiplier=`、`reward=`
等 raw token；状态卡的 outcome 指标同样经过净化。稳定页序为：结果总览、回响归档
详情/动作上下文、装备状态/掉落、装备封存委托、装备记忆、装备铭刻、协议结算、主神指令、
路线契约、侵蚀压力、破界追兵；无数据页省略。回响页解释 pending/archived/skipped/lost/
none 与可用的 archive/return 动作上下文，但实际动作仍由既有 Deck 统一渲染，不丢失。
页 ID 与顺序确定，完整 page-set signature 变化时回到第一页，phase/detail 变化时 reset
或 clamp。可见的“上一页/下一页”控件触控区各为 108×116 design px（≥104），边界显式
禁用，没有隐形 forward-only 热区。中文/ASCII 长行由可复用纯函数按 CJK=1、ASCII=0.55
单位确定性折行，每页最多 6 行，超出时把一个逻辑页切成稳定续页（标题标注“续 n/m”），
320x568 与 390x844 映射到 750x1334 设计空间时不溢出、不重叠，导航可达，不依赖 Label
shrink。所有结算文案只来自 `ResultDetail` 的 `last*Settlement` 权威字段，Cocos 不重算
结算规则；历史存档缺少结算快照时只显示已有字段，不虚构奖励。指令结算状态行只
读 `directiveSettlement.statusLabel`（如“进行中”），绝不读 `status` 原始 enum。
headless 覆盖每一类页、只有 outcome 的结果、回响 pending/archived 动作上下文、
前后边界禁用、page-set 变化 reset/clamp、malformed invalid 卡、320x568 与 390x844、
超长中文/ASCII 折行子页、导航触控尺寸、无 raw IDs/enums（raw-token 断言覆盖归档/
铭刻/协议/指令/契约/侵蚀/追兵全部结算状态 enum，并对每个翻页后的页面运行；指令
结算 fixture 只提供 `statusLabel:'进行中'` 而不提供 `status:'active'`，指令页精确
断言 `状态 进行中 · 3/3 已满足` 中文状态行并拒绝 raw `active`，杜绝 fixture 与
View 同错假阳性），以及销毁后触控惰性。
探索状态卡右侧新增分页的章节决策区：地图、当前节点、待处理选择/装备记忆卡、动作、
焦点与既有分页全部保留，装备记忆卡仍为第 1 页，其后五页依次为场域法则、主神指令、
路线契约、侵蚀段位、破界追兵。所有文案只来自 `ExploreDetail.chapterDecision` 的 VM
字段（法则计量/修正、指令目标完成度、契约 0/2→1/2→2/2 与失败原因、侵蚀段位/出口加成、
追兵状态/接触/苏醒进度），Cocos 不重算领域规则；法则/指令/侵蚀/追兵页的邻近 `?`
复用既有 `help/open` 本地事件与 `law`/`directive`/`pressure`/`pursuit` 帮助条目，路线
契约没有对应帮助 ID，只展示 VM 提供的说明文案，不发明规则。headless 覆盖
metro_abyss/starfall_mine/rust_hospital 三副本的法则严重度与计量、指令目标状态、
契约 0/2/1/2/2/2/failed、侵蚀三段位、追兵 dormant/stalking、与 pending 选择共存、
320x568 与 390x844 下五页可达、渲染不增删不改序动作、帮助仅本地事件、输出无 undefined、
销毁后触控保持惰性。
战斗状态卡在既有 HP 条/意图/Boss 读数旁新增 selector 派生的章节上下文紧凑读数：法则
标题/状态/计量与战斗相关 modifier（敌方全属性/防御/术攻、我方 force/art 输出、治疗、
守御）一行，追兵名称/状态/接触伤害/首领融合在 stalking/fused 时追加一行；危险法则与
stalking/fused 追兵同时追加为现有 combat risks。完整语义仍由既有 law/pursuit help deck
承载，不新增命令或动作。headless 覆盖 dormant/stalking/fused 追兵、danger 法则、
fail-closed 缺律、320x568 与 390x844 可达、输出无 undefined、无非战斗命令。
某个 disposer 抛错时其余资源仍会清理；销毁后不会调用已 dispose 的 client、刷新 UI
或重新挂回平台资源。它只证明虚拟宿主合同，不是 Editor Preview、真实 CDN、微信
开发者工具或真机证据。

Creator 3.8.8 首次打开工程后会生成 `temp/tsconfig.cocos.json`。此后执行真实引擎
类型检查：

```bash
npm run typecheck:creator -w infinite-flow-wechat-cocos
```

根 `tsconfig.json` 只扩展 Creator 生成的配置；在首次导入前该命令预期阻断。
平台纯 TypeScript 自检与其专用配置位于 `headless/`，不会进入 Creator 的运行时
资源图；`assets/scripts/` 内只保留游戏运行所需模块。

## 运行模式

- 无 `wx`：清楚标记为“开发预览 / 内存存档”，使用 `InMemoryStoragePort` 和固定
  `SequenceSeedPort`，关闭预览即丢失。
- 有 `wx` 且已注入具名 `WxDurabilityBoundary`：读取真实 safe area、预填充微信
  安全随机池并使用 journal storage；注入的边界优先于一切平台探测结果。
- 有 `wx`、未注入边界且 `getDeviceInfo()`（缺失时才回退 `getSystemInfoSync()`）
  报告 `platform === 'devtools'`：诚实的 NON_RELEASE smoke 模式。客户端使用
  `InMemoryStoragePort`（关闭或刷新即丢失），仍复用 wx 安全随机池、生命周期与
  safe-area；界面稳定标注 `wx-devtools` 模式与“微信开发者工具 · NON_RELEASE /
  内存存档 / 关闭或刷新即丢失”，绝不把 readback、同步写或字符串 ID 描述为真机
  durable，也绝不调用 `WxJournalStoragePort` 或读写 wx storage。
- 有 `wx`、未注入边界且宿主未精确报告 `platform === 'devtools'`（真机或探测
  异常）：在创建 client、消耗 seed、写任何持久候选之前稳定阻断，显示阻断诊断，
  不降级成内存存档，也不声称同步读回等于 durable。

布局按 750×1334 design-px 编写；host viewport inset 会按
`design-px = viewport-px * 750 / viewport-width` 换算。320 宽设备的交互高度至少
104 design-px（44 viewport-px）。地图/动作状态同时使用文字、符号和边框模式，
常用文字与边界颜色在模块载入时执行 WCAG ratio 断言。

## Creator 导入与预览门禁

1. 只用 Creator 3.8.8 打开本目录；不要用已下载的 Cocos 4 alpha CLI 打开或升级工程。
2. 首次导入已完成：187 个 PNG、scene、运行脚本和 212 个 metadata UUID 通过审计；
   新一轮 prerequisite import 不含 headless self-check，Creator 项目日志无新的解析错误。
3. `typecheck:creator` 已通过；2026-08-11 在真实 Creator 3.8.8 执行“Developer →
   清除代码缓存”后重编，Preview 为 `http://localhost:7456`。config bundle 的 manifest
   UUID 是 `3d0842ec-43f7-4b5f-961f-39edb535ccd7`，revision 是
   `sha256:91b2f75d946411a2ac16d0a313336ba97bd395f652e55aa625fa940c396525b2`；resources
   bundle 为 `resources`。真实 UI 依次观察到大厅 `scene:main_god_space`（开发预览
   就绪）、确认入场后的探索 `dungeon:demon_tower_1`（revision 1）、迎战后的战斗
   `monster:fog_lesser_demon`（revision 2）。三段 View 均含 SpriteFrame/Texture，
   `lastVisualBootstrapFailure=null`，控制台无 warning/error，场景无 Missing Script。
   真实回调的 `error===undefined` 成功态误判已修复，并已加入 headless `undefined`
   成功回归。
   同日较早的无状态注入新档自然路线还完成了携行配置、普通战斗、血字阶梯“强行
   通过”、相邻地图与四处奖励、雾锋回响、Boss 封印/觉醒、出口结算、归档并返回
   大厅；该记录用于保留完整玩法语义，尚未冻结为 registry evidence。
4. 每次候选都要重复真实 declarations 类型检查、清除代码缓存后的重编、场景预览和
   资源/脚本错误审计。共享 package 重建后单纯刷新旧 preview 可能继续运行旧 bundle；
   必须新开预览并完成关键 trace。该 Preview 不替代真实 AppID 微信构建、CDN/HTTPS
   remote、微信开发者工具或真机验证。
5. `resources` 已通过 `resources-remote-wechat-v1` Creator preset 固定为微信远程
   `merge_dep` Bundle；`config` 保持本地。2026-08-12 的真实 3.8.8 NON_RELEASE 模板
   构建确认产物只在 `remote/resources` 保存资源数据，主包只保留版本化 bundle 脚本，
   `assets/resources` 不存在。该模板使用 sentinel AppID/HTTPS 地址，不能上传或冒充
   production；发布前仍须提供已备案且加入微信白名单的真实 CDN 地址并重复构建/验收。

`library/`、`local/`、`temp/`、`profiles/` 和 `build/` 是生成态并已忽略。Editor 生成
的源资源 `.meta` 已提交以固定 clean clone 的 scene/script/image UUID；资源门禁要求其
与对应文件或目录严格一一配对、UUID 唯一且 207 个图片 redirect 有效。不得手工替换
这些 UUID 并称为 Creator 验证。

根 `npm run build:wechat:template` 与 `npm run build:wechat` 都会重新执行完整 headless
验证、强制读取 Creator 安装包的实际版本（必须为 3.8.8）并运行
`typecheck:creator`。前者允许对当前完整脏候选做内容/身份绑定，但永远输出
`releaseEligible:false`；后者还要求 clean Git candidate 和真实 production 配置。这些
自动门禁不替代 Editor preview、真实 CDN、微信开发者工具或真机验收。
