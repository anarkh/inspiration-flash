# 主神空间 · 十款副本门 HTML 原型

[打开主神空间副本门对比页](http://127.0.0.1:8125/prototype/hub-portals-ten/index.html)

本页对应当前已采用的 **10 号轮回庭院，东侧进入副本的传送门**。背景、人物比例与材质参考均来自主神空间；第 7 款「万象画门」已接入游戏的主神空间入口。本 HTML 页保留十款选型对比；游戏位置、碰撞与进入副本的原有规则不变。

## 使用

- 「庭院效果」：十款同时放进当前庭院背景，显示真实人物作比例参照。
- 「素材大图」：放大各款独立透明图，观察形制与材质。
- 点任一方案：新方案与主神空间替换前的门并列对比，手机上下排列。
- 「上一款 / 下一款」：循环查看十款；Escape 或关闭按钮返回，并恢复卡片焦点。
- 「打开透明原图」：查看该款原始 PNG。

## 十种形制与生成来源

每款使用内置 `image_gen.imagegen` 独立生成，要求真正透明背景。PNG 均为生成原图的逐字节复制，没有裁切、重编码、调色或抠图。下表给出完整提示词；对应 `.result.json` 保存生成源路径、SHA256、尺寸与透明度数据。

| 编号 | 方案 | 形制 | 原图 | 完整提示词 |
| --- | --- | --- | --- | --- |
| 01 | 云阙界门 | 中式单檐、莲云石柱 | [PNG](assets/hub-portal-01.png) | [prompt](assets/hub-portal-01.prompt.txt) |
| 02 | 轮回月门 | 圆形石环、旧金云纹 | [PNG](assets/hub-portal-02.png) | [prompt](assets/hub-portal-02.prompt.txt) |
| 03 | 星环天仪 | 古铜双环、弧形支座 | [PNG](assets/hub-portal-03.png) | [prompt](assets/hub-portal-03.prompt.txt) |
| 04 | 莲台光隙 | 莲瓣外框、香槟薄光 | [PNG](assets/hub-portal-04.png) | [prompt](assets/hub-portal-04.prompt.txt) |
| 05 | 双碑云界 | 对称双碑、开放雾帘 | [PNG](assets/hub-portal-05.png) | [prompt](assets/hub-portal-05.prompt.txt) |
| 06 | 悬镜玄关 | 八角古镜、远山云景 | [PNG](assets/hub-portal-06.png) | [prompt](assets/hub-portal-06.prompt.txt) |
| 07 | 万象画门 | 立式画卷、画内山水 | [PNG](assets/hub-portal-07.png) | [prompt](assets/hub-portal-07.prompt.txt) |
| 08 | 鎏金重扉 | 开启双门、莲纹浮雕 | [PNG](assets/hub-portal-08.png) | [prompt](assets/hub-portal-08.prompt.txt) |
| 09 | 天阶引渡 | 三阶低台、无框云路 | [PNG](assets/hub-portal-09.png) | [prompt](assets/hub-portal-09.prompt.txt) |
| 10 | 龙纹天枢 | 龙云弧柱、灰金界面 | [PNG](assets/hub-portal-10.png) | [prompt](assets/hub-portal-10.prompt.txt) |

## 与当前游戏对应

- 正式庭院背景：`cocos/assets/resources/hub-courtyard/walk-sanctuary-v1.png`；石柱、祭台、灯具作为莲云纹与黑金材质参考。
- 当前主神空间世界为 `1200 × 720`，入口脚点 `(1080,466)`、交互半径 `120`，角色 `172 × 172`。
- 替换前的门由 `InfiniteFlowWalkScene.ts` 的 `drawDoor` 绘制，经 `(1.25,1.42)` 缩放，主要轮廓约 `152.5 × 231.5`；本页 `current-hub-portal.svg` 按这些几何形状与颜色作展示还原，不是生成的新候选，也不是引擎截图。
- 新款统一容纳在 `220 × 236` 的展示框中，保留原图宽高比、底部中心对齐；圆环允许比现用窄门更宽。人物使用正式行走图集的朝右帧。场景局部取自同一庭院东侧区域，背景使用与现有庭院接近的 CSS 去饱和显示，原图未变。
- 本 HTML 页不执行进入副本、移动或存档操作。第 7 款正式接入沿用原入口脚点、交互半径与触控范围；其余九款仍是选型原型。

## 选型注意

01 的开口偏竖长；03 偏宽且中心通透；04、05、09 的门心较明亮；08 的门扇视觉偏向外开启。这些生成结果保留用于横向比较，没有通过后处理掩盖差异。文字描述按实际成图说明。

## 验证记录

`node --check app.js`、项目范围的 `git diff --check` 通过。十张 PNG 哈希互异，RGBA 格式与源文件逐字节一致；16 个页面与图像资源均 HTTP 200。浏览器验证十款逐一切换、原图链接、首尾循环、素材模式、现用门对比、Escape 关闭和焦点返回。320 / 390px 手机、930px 默认桌面及 1280px 五列断点无横向溢出，设置按钮高 44px，浏览器无警告与报错；临时视口已恢复。

静态资源检查与浏览器交互记录保存在 `proof/`。完整结果见 [资源检查](proof/static-validation.json) 和 [浏览器检查](proof/browser-validation.json)。浏览器截图：[庭院总览](proof/courtyard-overview.jpg)、[素材总览](proof/assets-overview.jpg)、[新旧对比](proof/comparison-desktop.jpg)。

本页无外部依赖，采用普通脚本与相对资源路径，未写浏览器存储。通过项目现有 `127.0.0.1:8125` 静态服务访问；没有进行 `file://` 或微信真机验收；第 7 款正式接入的 Web 验证另见下方记录。

## 第 7 款接入游戏（2026-10-08）

「万象画门」透明原图逐字节复制到 `cocos/assets/resources/hub-courtyard/wanxiang-scroll-portal-v1.png`，通过 `scene:hub_dungeon_portal` 在主神空间加载。保留原入口位置、触控范围和进入副本规则；显示尺寸保持原图比例，进入副本后释放庭院门资源。资源清单为 296 项，原有 295 项内容未变。

Cocos Creator 3.8.8 构建、资源校验、类型检查与场景回归均通过。320 × 568、390 × 844 两档 Web 实测分别完成 21 个流程检查，包括走近入口、选择副本、战斗、地图、结算及返回庭院，浏览器错误均为 0；未进行微信真机或发布验收。

[打开更新后的游戏](http://127.0.0.1:8125/cocos/build/web-mobile/index.html) · [接入验证记录](proof/cocos-hub-portal-integration-validation.json) · [320px Web 渲染截图](proof/cocos-hub-portal-320.png) · [390px Web 渲染截图](proof/cocos-hub-portal-390.png)
