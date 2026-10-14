# 素材风格对照 HTML 原型

[打开原型](http://127.0.0.1:8125/prototype/style-refresh/index.html)

根据 2026-10-08 风格排查制作，覆盖七组对照：副本物件、碎石、镜像城、功法血统、装备修复、人物肖像、HUD。用户确认后，26 张素材与 HUD 配色已接入 Cocos 游戏；此页保留采用前后的 HTML 对照。

[打开更新后的游戏](http://127.0.0.1:8125/cocos/build/web-mobile/index.html)

## 内容与操作

- 26 张新素材：9 个世界物件、11 张功法血统图标、3 张装备、2 张代表性肖像、1 张镜像城横幅。
- 顶部切换分组，素材列表切换单项；桌面并排、手机上下对照。
- 世界物件支持妖塔、矿井、档案馆三种现有背景与脚点参考。
- 原图对话框完整显示 PNG，支持 Escape 关闭与焦点返回；下方可看 48 / 72 / 96 px 效果。
- 镜像城同时显示完整横幅与按现有 750 × 600 背景区域比例居中裁切的结算构图。
- HUD 是主城与副本界面的 HTML 风格示意，不触发游戏功能。

## 原图与出处

全部候选通过内置 `image_gen.imagegen` 生成或编辑，保存于 [assets](assets/)，逐字节复制生成原图，没有裁切、调色、抠图或重编码。完整提示词位于 [prompts](prompts/)，各组来源、SHA256、尺寸、透明度及迭代记录位于 [proof](proof/)。

[素材校验](proof/static-validation.json) · [浏览器验证](proof/browser-validation.json) · [原型图录](proof/asset-inspection.html)

`asset-layout.json` 记录 alpha ≥ 128 的主体边界，仅用于 CSS 场景摆位，不修改图片。`legacy-props.js` 按现有 Cocos 代码复现几何物件，页面已明确标注其并非游戏截图。新物件场景也是 HTML 合成，不能代替正式碰撞与交互验收。

## 验证与候选边界

桌面 28 个视图均能切换、图片正常加载；320 / 390 两档手机的七组页面无横向溢出，按钮和选择框高度不少于 44px。三种背景、脚点参考、原图链接、Escape 与焦点恢复已验证；浏览器无警告或报错，临时视口已恢复。两份 JS 语法检查通过。

两张肖像分别接入轮回者与同行引路人的原资源 key，其他人物没有重画。原图保留主角发髻贴近上边缘的构图与透明像素，不进行后处理。上方原型检查只证明 HTML 预览；正式游戏接入证据单独记录，不代表微信真机或发布验收。

## 正式接入

- 新增 9 个 `scene:dungeon_prop_*` 世界物件；在原脚点挂载等比 Sprite，沿用原触控目标、动作与碰撞。资源未就绪时使用既有几何表现。
- 17 个已有资源 key 保持不变，正式 PNG 路径升级为 v2，保留 Creator UUID。涵盖 11 张功法血统、3 张装备、2 张肖像和 1 张横幅。
- 主城与副本 HUD 统一暖黑面板、旧金边界、灰青状态色和半透明摇杆，保留既有布局与功能。
- 正式 manifest 共 305 项；旧图和 metadata 位于 `../../art-source/style-refresh/before/`。本页与排查报告引用这些留档文件，避免新旧对照随正式替换而失真。
- 本轮仅更新本地游戏与 Web Mobile 试玩产物，未上传微信体验版、发布或推送仓库。

### 接入验证

Creator 3.8.8 Web Mobile 重建通过；资产与 bundle 合同、两类 Cocos 类型检查、
44 项行走检查、100 项生命周期检查，以及 1,979 个真实 ViewModel 的手机界面检查通过。
新增检查覆盖 8 类交互物件各自的未加载、已加载、无效尺寸状态，以及碎石落地与原碰撞。
实际引擎还验证了主城头像 51px 显示尺寸，防止赋图时被 Cocos 默认尺寸模式重置。

320×568、390×844 两档浏览器流程均自然退出码 0，分别完成 21 步物理输入流程：
副本入口、通道门禁、战斗获胜、返回探索、地图详情、撤退结算与回城，浏览器失败数为 0。
每档另有 25 张隔离渲染样本覆盖全部 26 张新图，核对实际 ImageAsset UUID、尺寸和
SpriteFrame；镜像城结算验证 750×600 裁切区域与 1800×600 等比背景。
这些样本使用真实 ViewModel 与正式资源加载器，前后验证试玩数据未变，不能据此声称
完成了后期章节通关或微信真机验收。

[完整接入记录](proof/cocos-style-refresh-integration-validation.json) ·
[26 张素材映射](proof/cocos-asset-mapping.json) ·
[资产完整性记录](proof/cocos-asset-validation.json)

实际引擎截图：[主城 320px](proof/cocos-style-refresh-hub-320.png) /
[主城 390px](proof/cocos-style-refresh-hub-390.png) /
[副本实走 390px](proof/cocos-style-refresh-dungeon-390.png) /
[出口渲染样本](proof/cocos-style-refresh-exit-390.png) /
[镜像城结算样本](proof/cocos-style-refresh-mirror-390.png)。
