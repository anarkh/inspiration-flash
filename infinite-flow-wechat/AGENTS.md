# 游戏项目协作规则

本文件适用于 `infinite-flow-wechat/`。沿用仓库根目录的协作与 PR 规则；这里补充
游戏专有的实现、资源和验证约束。

## 工作目录与代码边界

- 从本目录执行 npm 命令。工具链以 `package.json`、`package-lock.json` 和
  `toolchain/cocos-toolchain.lock.json` 为准，不借用其他项目的依赖或更改锁定版本来绕过检查。
- `../infinite-flow/` 是 Web 行为 oracle 和历史素材来源。除非任务明确包含 Web 工程，
  只读参考，不同步改写它；游戏原型放在 `prototype/`，生产表现放在 `cocos/`。
- 领域变更沿 `packages/client`、`packages/runtime` 的 session、
  `packages/application` / `packages/core` 执行。Cocos 消费 presentation 的只读
  ViewModel 并提交既有事件，不在 UI 重算购买、奖励、战斗或节点合法性。
- presentation 保持平台无关；微信和 Cocos 能力通过平台端口注入。生产模块不引入
  DOM、Node.js API、隐式随机或系统时间来代替既有 runtime 能力。
- 新输入保留 session 串行处理、物理输入去重和持久化后发布语义；写入阻断或待确认时，
  不提前修改可见领域状态，也不绕过 blocked 状态继续提交领域命令。
- 战斗动画消费 `combat.presentation-resolved` 的真实结算帧，不自算伤害、反击或
  重复派发回合动作；最终战后回血不能覆盖命中与反击过程的 HP 读数。

## 场景、动作与布局

- 世界坐标以左上角为原点，人物位置代表脚点。保留世界边界、碰撞、出生点和近距
  互动半径；普通视觉调整不改变移动速度或回合规则。
- 响应式布局可以调整视图内目标脚点，但不能修改原始 `WalkWorldSpec` 或 ViewModel。
  渲染、近距互动、目标标记与战斗特效必须使用同一投影；目标的 action、目的地、
  禁用原因和身份保持一致，同方向的多个真实分支不能因布局而丢失。
- 世界目标绑定当前公开 ViewModel 的原始 action。单纯移动和邻近检测不选择领域分支，
  地图查看不传送；用户主动选定目标后的走近与交互仍沿既有 action 链路执行。
- 角色、怪物和门图保持源图比例及脚点，身体动画沿 `WorldObjectBody` 锚点处理。
  主角帧表以 `cocos/assets/scripts/ui/hero-walk-atlas.ts` 及独立测量记录为准，
  不假定生成图严格等分；
  保留统一逻辑画布和 `trim=false`，避免每帧重新铺满造成跳动或变形。
- 背景覆盖与房间坐标投影分开处理。用户指定原型时，以原型为布局依据，同时保留
  真实动作、状态文字与禁用规则，不把原型演示数据写入游戏。

## 美术与资源生命周期

- 复用已有素材和已完成生成结果，保留原图、来源及处理记录。世界图与头像是不同资源，
  不用更新世界图的方式覆盖原有头像。
- 增加或替换资源时同步核对源文件、转换方式、尺寸/alpha、source/target SHA-256、
  manifest key/path/revision/count、正式 PNG 与 `.meta`、运行时固定值、微信 bundle
  profile 和相关校验器。保留已有资源身份；新增 UUID 必须唯一，相关 submeta 一致。
- 冻结 Web 原始素材与 Cocos 替代素材分别校验。视觉替换保留历史映射及来源，
  不通过减少冻结清单、修改原始 hash 或重生成 expected 让验收变绿。历史图和
  生成留档放在 `art-source/`，不作为未登记资源混入正式 resources。
- `ImageAsset` 的获取与释放必须匹配 `addRef/decRef`；保留租约、缓存 revision、
  过期回包和销毁逻辑。缓存命中、异步交接与失败重试都要覆盖，不能按路径强制
  release 其他消费者共享的资源或全局释放共享 bundle。
- 行走场景创建前，声明素材必须全部就绪；缺失素材沿现有加载、阻断和重试流程处理，
  不用静默占位或旧矢量回退掩盖失败。

## 预览与用户进度

- Web / Creator 开发预览使用内存进度，刷新或关闭会丢失。操作用户正在试玩的页面前，
  读取当前进度；需要重载或换构建时先备份，并通过原有 client/storage 接口恢复。
  回读核对领域状态、存储、持久性、revision、剩余 seed、UI 选择、弹框和人物位置。
- 验证使用独立页面及可追溯测试状态；不替用户确认遗物、领取奖励、购买、结算或
  其他待决选择，不把测试行为混入用户存档。
- 可见 UI 改动须重建当前 Cocos 候选，在真实引擎检查 320×568、390×844 与安全区。
  同时检查比例、裁切、触控范围、移动、交互及相应战斗反馈；HTML 原型、隔离图库
  和 headless 通过不能代替游戏运行验证。
- 构建命令返回、HTTP 200 或旧页面仍能打开都不是完整验收；核对实际候选路径、
  构建完成记录、引擎启动及素材状态，保存任务相关证据。Web 结果不等于微信
  开发者工具、真机持久性或发布证据，不注入假持久性边界来解除生产阻断。

## 按改动范围验证

共享包源码发生变化时先执行 `npm run build`；依赖其 `dist` 的 Cocos 检查不能使用旧产物。
从本目录选择对应检查：

| 改动范围 | 相关检查 |
| --- | --- |
| 领域、命令、存档、presentation | 对应 workspace 的 `test` / `typecheck`；`npm run test:packages`、`npm run typecheck:packages` |
| 场景、投影、行走、战斗反馈 | `npm run cocos:walk:test`、`npm run cocos:race:test` |
| 弹框、列表、按钮及现场选择 | `npm run cocos:sheet:test`、`npm run cocos:race:test`；主题改动加 `npm run cocos:gallery:test`，布局改动加 `npm run cocos:layout-gallery:test` |
| 图片、manifest、Creator metadata | `npm run assets:verify`、`npm run wechat:bundle:self-check`、`npm run scene:verify` |
| 平台端口、存储、seed、生命周期 | `npm run platform:verify` |
| Cocos 类型与真实候选 | `npm run typecheck:packages`；Creator 导入后执行 `npm run typecheck:creator -w infinite-flow-wechat-cocos` |
| 验收 registry / runner / 资产迁移 | `npm run acceptance:verify`、相关 `npm run test:migration -- --ac <AC-ID>`、`npm run test:migration:self-check` |

- 功能 PR 的最终候选运行 `npm run verify`；修复失败根因，不跳过检查或修改冻结预期。
  纯文档追加核对命令、路径、链接和 diff，无需重复整套游戏验证；说明实际检查范围。
- 不把生成的 JS / 声明写入 `packages/*/src` 或 `cocos/assets/scripts`；保留
  `source:verify` 门禁。`dist`、Creator 的 `build/library/temp`、本机凭据和真实设备配置
  沿 `.gitignore` 排除，headless 的 `cc` shim 不进入 Creator 的 `assets/`。
- 创建游戏 PR 时同步本目录 `package.json` 与 `package-lock.json` 的版本；向已包含
  版本升级的同一 PR 追加文档时不再额外升级。交付时区分本地通过、正式验收与发布状态。

构建与预览步骤见 [Cocos 说明](cocos/README.md)，冻结验收和正式证据规则见
[迁移验收说明](acceptance/README.md)。
