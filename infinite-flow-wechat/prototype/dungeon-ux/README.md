# 副本体验调整

[两项原型总览](http://127.0.0.1:8125/prototype/dungeon-ux/index.html) 将区域通道与地图并排展示。手机上纵向排列；“单独查看”可打开各自完整工作台。

原型的链接与 iframe 明确指向 `index.html`，两个子页面使用普通脚本和随页面提供的地图数据，支持直接打开本地 HTML；无需通过 `fetch` 读取本地文件。“打开实际游戏”使用 HTTP 预览服务，因为 Cocos 游戏需要该服务。

入口修复已通过 HTTP 浏览器显示与交互验证；本地文件方式仅通过路径与脚本静态检查，浏览器工具不允许导航到 `file://`。详见 [入口修复验证](proof/link-fix-validation.json) 和 [实际画面](proof/link-fix-overview.jpg)。

1. **副本移动提示：已接入游戏。** 删除“摇杆移动 · 靠近目标互动”文字、背板及更新引用，保留摇杆和近身交互。Cocos 类型检查、96 个场景检查、Creator 3.8.8 Web Mobile 构建和 320×568 完整游戏流程通过。浏览器失败数为 0，战斗胜利后可结算回城。
2. **区域入口：HTML 原型。** 透明石质残门，微光/静默两种显示；妖塔、地铁、矿井背景及未解锁/可前往/已近身状态均可操作。新 PNG 保留生成工具原字节及完整提示词。
3. **区域地图：HTML 原型。** 默认先看当前位置与相邻出口，全图保留真实网格连线；可点选详情、放大名称、定位自己及标记方向。使用 3 章 × 2 个真实规则投影快照，未知区域保持匿名。

2026-09-30 后续确认：第二项的微光石门已接入 Cocos；第三项采用用户选定的图标全图，
点击后在下方显示详情，去掉附近路线切换和名称放大。上面两个 HTML 保留原提案的
对比控件，用于设计记录；最新行为请打开 [实际游戏](http://127.0.0.1:8125/cocos/build/web-mobile/index.html)。
原型不写游戏存档；微信真机和发布不在本次验收范围。

正式接入的 [验证记录](proof/cocos-dungeon-integration-validation.json)：320×568 完整 Web
流程与 390×844 副本流程均完成，浏览器失败数为 0，战斗后可经过石门、查看地图详情、
结算回城。普通与炼狱地图共 76 张通过手机布局检查。实际画面：
[320 地图](proof/cocos-dungeon-map-320.png)、[390 地图](proof/cocos-dungeon-map-390.png)、
[320 石门](proof/cocos-dungeon-transition-320.png)、[390 石门](proof/cocos-dungeon-transition-390.png)。

验证记录：[提示删除](proof/hint-removal-validation.json)、[原型浏览器验证](proof/prototypes-validation.json)。320×568 与 390×844 视口均无横向溢出、操作区至少44px；320×568 的四个相邻出口已同屏可见。

截图：[实际副本](proof/dungeon-without-movement-hint.png)、[并排总览](proof/overview.jpg)、[通道手机画面](proof/transition-mobile-390.png)、[地图手机画面](proof/map-mobile-390.png)。手机 PNG 按真实 CSS 内容区域捕获，浏览器滚动条占15px，因此内容宽分别为305px、375px。
