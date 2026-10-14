# 轮回者主角素材设计

2026-10-08 · 新主角行走图集已接入本地 Cocos 游戏；已重建 Web Mobile 预览。

## 设计方向

以游戏现用 `reincarnator-v2` 肖像为身份依据，将旧行走素材偏大的头身比例改成修长的成年身形。保留黑发束髻、灰青围巾、玄黑短袍、皮带与腰包、左肩旧铜护甲和背侧短剑。使用与庭院 NPC 接近的绘画质感，以粗布、旧皮革、暗铜的明暗区分层次。

保留现有肖像与角色身份，更新 Cocos 行走资源。角色尺寸、物理脚点、碰撞、动作绑定、移动速度与玩法保持原样。

## 文件

| 文件 | 用途 | 规格 |
| --- | --- | --- |
| [reincarnator-fullbody-v1.png](reincarnator-fullbody-v1.png) | 全身形象与材质设定 | 1024 × 1536，RGBA |
| [reincarnator-walk-v2-candidate.png](reincarnator-walk-v2-candidate.png) | 四方向、16 帧步态草图 | 1254 × 1254，RGBA |
| [reincarnator-walk-v2.png](reincarnator-walk-v2.png) | 游戏使用的四向行走图集，补齐侧向收腿帧 | 1254 × 1254，RGBA |
| [交互预览](../../prototype/hero-redesign/index.html) | 现有肖像、全身设定、新旧场景对照、逐帧检查 | 独立 HTML |
| [完整设定提示词](prompts/fullbody-v1.txt) | 内置 imagegen 使用的提示词 | 原文 |
| [行走草图最终提示词](prompts/walk-v2-candidate-revision.txt) | 以全身设定为唯一参考的修订提示词 | 原文 |
| [游戏图集修订提示词](prompts/walk-v2-production.txt) | 保持人物设计，修整行走姿势 | 原文 |

三张 PNG 均由内置 `image_gen.imagegen` 生成，逐字节复制到本目录；未做像素后处理。生成来源与 SHA-256 在 `proof/fullbody-v1.json`、`proof/walk-v2-candidate.json`、`proof/walk-v2-production.json`。首版行走图因比例及单侧肩甲不一致而放弃，其原因在 `proof/rejected-atlas-attempt.json`。

## 预览与接入边界

预览为现有庭院／镇妖塔背景上的 HTML 合成，并非游戏运行截图。支持四向切换、9 fps 播放／暂停、逐帧查看、96／144 像素帧窗与脚点参考。

行走草图按朝下、朝左、朝右、朝上排列，但生成画布的行列间距并不均匀，**不能直接作为等分 4 × 4 图集交给现有运行时**。预览依据实测行列位置取窗，并在透明行间裁去相邻行；这是展示原图所需的 CSS 取窗，不代表已完成生产图集整理。取窗参数和 16 帧 alpha 边界见 [atlas-measurements.json](proof/atlas-measurements.json)。

## 已完成的游戏接入

- v2 修订图补齐左右朝向的收腿经过姿势，保留已确认的人物外观。
- 保留原始 PNG，用 16 个显式 SpriteFrame 矩形取样，共享 336 × 336 逻辑画布、`(168, 320.16)` 脚点；启用 `trim=false`，避免每帧铺满导致比例变形。此方案不依赖生成图严格等分，也不修改像素。
- 帧表在 [hero-walk-atlas.ts](../../cocos/assets/scripts/ui/hero-walk-atlas.ts)，独立测量记录在 [production-frame-layout.json](proof/production-frame-layout.json)。
- 四向顺序仍为下／左／右／上，每方向四帧、9 fps；庭院身体仍为 172 × 172、y=78，副本仍为 104 × 104、y=47。可见脚点与物理原点误差小于 0.3 世界单位。
- `character:reincarnator_walk` 更新到 `character/reincarnator-walk-v2`，UUID 保持；原 v1 PNG 与 metadata 在 `before/` 留档，历史原型继续引用原图。

正式资源是修订图，设计页保留原版／首版草图对照。原草图的取窗参数与限制仅适用于设计留档。

## 验证

通过资源及 Bundle 契约、两套 Cocos 类型检查、101 项启动与资源生命周期场景检查、44 项行走世界检查、源码边界检查。Creator 3.8.8 Web Mobile 新构建成功。

390 × 844 完整真实输入流程及 320 × 568 副本流程均自然退出 0，包含移动、碰撞、传送、战斗胜利、退回庭院，浏览器失败数均为 0。另用真实 Cocos SpriteFrame 临时渲染了 [16 帧检查图](proof/cocos-frame-gallery.png)，检查发髻、脚点、比例和相邻帧边缘；临时图层已移除，未作为游戏功能保留。

详细验证记录见 [cocos-integration-validation.json](proof/cocos-integration-validation.json)。这次验证限于本地 Web Mobile，未执行微信发布或真机验收。
