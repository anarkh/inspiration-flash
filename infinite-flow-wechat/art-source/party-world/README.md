# 同伴与灵宠战斗立绘

战斗中出战的同伴和灵宠站在主角身旁。这里是 9 张全身立绘（3 位同伴、6 只灵宠）的源图；
`prompts.json` 是身份、参考图、提示词和文件名的权威清单。

状态（2026-10-27）：9 张已生成并接入游戏。`generation-record.json` 记录每张的提示词和选用的生成结果，
`validation.json` 记录尺寸、透明度和 SHA-256；源图未经任何像素处理，按字节复制到 `cocos/assets/resources/`。

## 规格

- 1024×1536 PNG，RGBA 真透明背景；不要地面、背景、边框、文字和装饰阴影。
- 人物与站地灵宠：顶部约在 7% 高度，脚底在 93% 高度；左右至少留 10–12%。
- 悬浮灵宠（契约小灵、星棱机、镜翼蛾）：顶部约 7%，最低点约 80%，下方留空。
- 都朝画面右侧转成四分之三侧身（敌人在右上），脸或眼睛清楚可见。
- 灵宠在手机上只显示约 60 像素高，轮廓要简单清楚，光效保持小。

## 生成方法

每张单独生成，不要拼图，也不要用一张通用图代替：

1. 查看 `reference` 指向的旧头像或卡面；
2. 提示词用 `sharedPrompts.companion` 或 `sharedPrompts.pet`，后接该条的 `subject`，按 `group` 选择；
3. 把旧图作为参考图，打开透明背景；
4. 原图按 `sourceFile` 的文件名保存到本目录，不要转换或抠图。

旧头像和卡面保持不变：全身图是新增资源，不覆盖它们。

## 接入步骤（新增或替换立绘时照做）

1. 逐张核对尺寸、alpha 真透明、身份、完整肢体，以及脚底或最低点的位置；
2. 复制到 `cocos/assets/resources/<resourceFile>`，新建唯一 UUID 的 `.meta`；
3. 在 `cocos/assets/config/asset-manifest.json` 登记 `key`，同步数量、revision 和 SHA-256；
4. 在 `packages/core/src/game-assets.ts` 登记同名 key。presentation 查到后才给出战成员带上
   `figureAssetKey`，战斗舞台随之换成全身立绘；没登记的成员继续显示金框头像；
5. 同步 `scripts/verify-assets.mjs`、微信 bundle profile 和相关校验，最后在真机尺寸
   320×568、390×844 截图核对站位，确认没有被按钮遮住。

战斗里站位和显示高度在 `cocos/assets/scripts/ui/InfiniteFlowWalkScene.ts` 的
`ALLY_FIGURE` 中，以主角身高为单位。生成图的脚底不一定正好在 93%：人物实测约 96.5%，
站地灵宠 92–95%，实测值登记在同文件的 `ALLY_FIGURE_FEET`；悬浮灵宠保持 93%，让它们浮在影子上方。
