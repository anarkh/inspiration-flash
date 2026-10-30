# 战斗特效与出手姿势

梦幻式战斗演出要用的美术：12 张特效图和 6 张出手姿势图。`prompts.json` 是用途、参考图、
提示词和文件名的权威清单；`priority` 为 1 的先做，2 的随后。

## 规格

- 特效（`group: effect`）：1024×1024 PNG（雷火符为 1024×1536），RGBA 真透明背景；
  效果居中，四边至少留 8%，光晕要淡到完全透明，不要黑底或暗色光圈；不要人物、文字、数字。
  游戏里会对它做缩放、旋转、淡入淡出，所以只要一张定格的最佳瞬间，不要序列帧。
- 姿势（`group: pose`）：1024×1536 PNG，RGBA 真透明背景；规格同 `art-source/party-world/`：
  头顶约 7%，支撑脚脚底在 93%，左右至少留 10%。人物都朝画面右侧转成四分之三侧身，游戏里需要时再镜像。

## 生成方法

每张单独生成，不要拼图：

1. 提示词用 `sharedPrompts.effect` 或 `sharedPrompts.pose`（按 `group` 选择），后接该条的 `subject`；
2. 姿势图把 `reference` 指向的图作为参考图；
3. 打开透明背景；
4. 原图按 `sourceFile` 的文件名保存到本目录（`infinite-flow-wechat/art-source/battle-fx/`），
   不要转换或抠图。生成记录可以像 `party-world` 一样另存 `generation-record.json`。

## 接入（图到位后由开发完成）

逐张核对尺寸、透明度和内容后，按 `art-source/party-world/README.md` 的接入步骤登记为资源。
没有图的特效继续用程序绘制的效果；姿势图缺失时用待机立绘加前冲、后仰等补间代替。

## 现状

游戏里的战斗特效已按 `prototype/combat-v3/` 的发光粒子用程序绘制并叠加混合
（`cocos/assets/scripts/ui/combat-vfx.ts`、`additive-blend.ts`），本目录的特效图仍未生成；
实机截图在 `proof-in-game/`。
