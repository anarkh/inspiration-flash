# 主神空间 · 竖屏可走动 2.5D 十款抽卡

本页采用竖屏 2.5D 舞台，支持行走和近身交互，保留十款主神空间的设计比较。已确认的第 10 款「轮回庭院」及最后一轮手机界面调整应用到 Cocos 游戏；背景和四件摆设逐字节复制并登记到正式资源 manifest。当前物品、任务、成长、副本等领域规则保持不变。本页仍使用演示数据，不连接正式游戏状态或存档；实际游戏入口见 [Cocos README](../../cocos/README.md)。

实际游戏试玩：[Cocos Web Mobile](http://127.0.0.1:8125/cocos/build/web-mobile/)。接入后的
构建、资源原字节核对和双档完整流程记录见 [庭院接入验证](proof/cocos-courtyard-integration-validation.json)，
原生浏览器交互记录见 [实际引擎验证](proof/cocos-courtyard-browser-validation.json)，
手机截图见 [320px](proof/cocos-courtyard-mobile-320.jpg) / [390px](proof/cocos-courtyard-mobile-390.jpg)。
这些是 Web 试玩证据，微信真机与发布尚未验收。

通过本地预览服务打开 [http://127.0.0.1:8125/prototype/hub-draw/](http://127.0.0.1:8125/prototype/hub-draw/)。舞台和十张总览卡面均采用 **390:740 竖屏比例**，按可用宽高等比适配；点击「放大舞台／收起舞台」切换为更大的竖屏舞台。桌面将卡组放在舞台右侧，手机将卡组放在下方。逻辑世界收紧为 **1200 × 720**，长度较前版减半；角色从中央中庭开始，七位 NPC 和传送门紧凑地前后错列。镜头随角色左右展开，保留原来的行走速度与地面纵深移动。

使用触屏摇杆，或点击地面与人物前往；打开服务面板时行走暂停。原型保留 WASD／方向键用于桌面行走验证，手机界面不显示键盘提示。

| 操作 | 行为 |
| --- | --- |
| WASD／方向键 | 左右走动；上下移动表示地面纵深。 |
| 近身交互按钮 | 与附近 NPC 交谈，或在附近传送门选择演示副本。 |
| 点击地面 | 自动沿避障路线走向目标位置。 |
| 点击 NPC 或传送门 | 自动走近，到达交互范围后打开面板；已经靠近时直接打开。 |
| 触屏拖动左下摇杆 | 控制方向，松开停止；靠近后点击交谈按钮。 |

跳跃、奔跑和寻找 NPC 功能已移除。E 快捷键和人物、传送门附近的 E 标记已删除。右下仅保留一个 **64 × 44px** 的近身交互按钮，显示「交谈」「进入」或「靠近」；完整交谈对象保留在无障碍名称和悬浮提示中。

角色栏的奖励点和灵韵固定在同一行，窄屏使用 6px 间距；当前默认舞台及 320px、390px 手机视口下，角色栏实测由 75px 降为 65px，资源完整显示，头像与生命条尺寸保持原样。记录见 [proof/role-currency-validation.json](proof/role-currency-validation.json)。

小地图已上移至背包、菜单按钮下方，右侧对齐并保留 6px 间隔。场景内的主神空间／方案名称／氛围标题、小地图标题，以及摇杆上方的状态灯、动作和方位文字已删除；NPC 名称与用途保留。默认舞台及 320px、390px 手机宽度的位置检查、行走和交谈验证通过，记录见 [proof/hud-cleanup-validation.json](proof/hud-cleanup-validation.json)。

操作精简的既有验证：12 项移动模型测试通过，十款场景均保留八个世界入口与一个近身按钮；键盘／摇杆行走、摇杆松手停止、小按钮交谈及点击人物自动走近通过。此前 88 × 44px 按钮的检查记录见 [proof/simple-controls-validation.json](proof/simple-controls-validation.json)。本轮手机交谈按钮与 E 提示移除的验证见 [proof/mobile-interaction-validation.json](proof/mobile-interaction-validation.json) 与 [proof/mobile-interaction-source-validation.json](proof/mobile-interaction-source-validation.json)。

镜头只沿水平方向跟随角色，并限制在世界两端。地面纵深移动速度低于横向移动（145／260）；角色、NPC、门与道具按脚底位置排序，靠近画面下方的对象显示在前。碰撞使用角色脚底与道具的地面占位，自动路线会绕开障碍。虚空方案单独收紧可走区域的下边界，角色不能走进平台底部的正面立面。

- **抽一张**：随机切换到本轮未看过的方案；10 款看完后可「再抽一轮」。
- **留牌**：点击「留这张」收藏当前方案，再点可取消；「只看留牌」筛选收藏。留牌保存在当前浏览器的本地存储中。
- **总览**：点击「看全部 10 款」摊开卡面，点击卡面返回该方案；「收起卡面」关闭总览。
- **编号选择**：点击卡组中的 01–10，或使用 URL 的 `#01`–`#10`。反馈时给出编号，也可说明希望组合的场景与布局，例如「01 的场景 + 06 的布局」。

| 编号 | 方案名称 | 当前横向底图 |
| --- | --- | --- |
| 01 | 归墟圣殿 | `walk-sanctuary-v1.png` |
| 02 | 星环议庭 | `walk-void-v1.png` |
| 03 | 灰烬营地 | `walk-camp-v1.png` |
| 04 | 主神档案 | `walk-void-v1.png` |
| 05 | 黑曜神龛 | `walk-sanctuary-v1.png` |
| 06 | 青铜仪盘 | `walk-void-v1.png` |
| 07 | 虚空月台 | `walk-void-v1.png` |
| 08 | 万象回廊 | `walk-sanctuary-v1.png` |
| 09 | 冷光终端 | `walk-void-v1.png` |
| 10 | 轮回庭院 | `walk-sanctuary-v1.png` |

当前三张底图位于 `assets/`，真实尺寸均为 **2172 × 724（3:1）**，使用内置 imagegen 生成后原样复制，没有像素后处理。营地经过第二次内置 imagegen 编辑，以扩大连续空旷的可走街道。[assets/prompts.json](assets/prompts.json) 按版本保留原三张竖屏背景和新三张横向背景，记录完整提示词、生成路径、最终保存路径、尺寸、哈希及素材来源；营地同时保留首次生成与最终编辑的完整提示词，`walk-*-result.json` 保留单张记录。

NPC 继续复用 `../../cocos/assets/resources/npc/` 下已有的世界立绘 `*-world-v1.png`，服务面板复用现有素材：军需官、补给商、灵宠师、修行导师、血脉祭司、同行引路人和任务使者。原型仅引用这些文件，没有替换正式 NPC 素材。

紧凑布局验证：12 项模型测试通过；十套场景从中央出生点前往八个入口的 80 条普通步行交互路线均通过，浏览器实测最慢约 1.65 秒。320px、390px 手机宽度的操作区及小地图检查通过，具体记录见 [proof/compact-validation.json](proof/compact-validation.json)。

轮回庭院（10）的四类地图道具已改为独立透明 PNG：风化莲云纹石柱、旧木铜饰储物箱、石质香炉祭台和暖光石灯。它们以当前庭院底图为风格参考，由内置 `image_gen.imagegen` 生成；石柱、祭台各经过一次内置编辑以调整比例。最终图片均为工具原始 PNG 的逐字节复制，没有像素后处理。

| 道具 | 最终保存路径 | 原图尺寸 |
| --- | --- | --- |
| 石柱 | [pillar-v1.png](assets/courtyard-props/pillar-v1.png) | 870 × 1808 |
| 储物箱 | [crate-v1.png](assets/courtyard-props/crate-v1.png) | 1457 × 1080 |
| 祭台 | [altar-v1.png](assets/courtyard-props/altar-v1.png) | 1500 × 1049 |
| 石灯 | [lamp-v1.png](assets/courtyard-props/lamp-v1.png) | 930 × 1691 |

[assets/prompts.json](assets/prompts.json) 的 `propVersions.courtyardPropsV1` 及 `courtyard-props/*-result.json` 保存完整生成／编辑提示词、来源、哈希、尺寸与透明轮廓边界。页面按 alpha≥32 的可见轮廓等比缩放、底部对齐，保留原来的道具位置和尺寸上限；人物站位、地面占位碰撞、脚底深度排序、移动与服务交互保持原样，其余九款方案继续使用原外观。

道具替换验证：轮回庭院八个入口的普通步行与近身交互通过；320px、390px 手机宽度下素材完整加载、操作区不小于 44px、无横向溢出；总览十张卡面无损坏图片，浏览器无警告和报错。其余九款方案的完整场景与缩略图渲染输出均与替换前一致，世界模型和移动控制器的文件字节保持一致。记录见 [proof/courtyard-validation.json](proof/courtyard-validation.json) 与 [proof/courtyard-source-validation.json](proof/courtyard-source-validation.json)。
