# HTML 全屏房间整合验收

2026-10-14，按已确认的 `prototype/dungeon-room-fullscreen-v2/` 修正 Cocos 探索与战斗。
原妖塔背景文件及 HTML CSS/脚本的 SHA-256 保持一致。背景覆盖整个游戏区域，四向门
和中央目标按 HTML 脚点布局；HUD 和操作区保留预览安全区。怪物、门、角色图片不拉伸。

本次只修改 `InfiniteFlowWalkScene.ts`、对应的场景回归及说明文档。原 `walk-world.ts`、
`scene-visuals.ts`、世界回归文件保持本次开始时的字节内容。View 内重排目标仍保留动作、
目的地、禁用原因和半径，渲染与近距互动读取同一份目标。

已通过：

- `cocos:race:test`：153 场景、8 房间组合、4 特效锚点、10 HTML 坐标、8 实际近距动作、
  2 多邻居用例及 8 战斗血条间距检查；覆盖 59 怪物与 19 背景。
- `cocos:walk:test`：45 检查、570 原始节点及 1862 原始邻居绑定。
- Headless 与 Creator 类型检查、源码边界、场景结构和 diff 检查。
- Cocos Creator 3.8.8 Web Mobile 实际构建完成；输出 HTTP 200，运行场景
  `InfiniteFlow.scene`、素材状态 `ready`。Creator 命令退出码为 36，因此同时核对了
  日志中的构建 Finished、HTTP 输出和实际引擎，而未单凭退出码判定成功。

320×568 与 390×844 的实际探索、战斗和门图均已截图。真实摇杆可连续水平/纵向移动，
测试中的领域状态和存档版本保持一致。最终构建点击普攻后，怪物生命 42→24、玩家
生命 102→92、回合 1→2、revision 2→3，动画结束并重新开放输入。

原页面的当前进度迁移到默认视口的新页面，10 项回读全部一致：state、storage、
durableStorage、durability、revision、remainingSeeds、localUiState、ui、mobileSheet、
walk。生命 102、奖励点 1155、revision 9、人物位置和已选但未确认的雾锋均保留，
弹框仍关闭。完整存档备份仅留在任务临时目录，未加入本验收目录。

- [当前进度画面](current-progress.png)
- [390 探索](explore-390.png) / [320 探索](explore-320.png) / [320 摇杆移动](explore-320-moved.png)
- [390 战斗](combat-390.png) / [320 战斗](combat-320.png)
- [浏览器实测记录](browser-validation.json) / [源文件保留记录](unchanged-source-validation.json)
- [场景回归日志](race-final.log) / [世界回归日志](walk-final.log) / [类型检查日志](typecheck-final.log)

只完成本地 Web Mobile 构建与实机检查；未提交、推送或发布微信体验版。
