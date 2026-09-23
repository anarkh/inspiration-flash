# 无限流 · 微信小游戏

这是 `infinite-flow/` 的 Cocos Creator 3.8.8 / 微信小游戏迁移工程。Web 版继续作为
行为 oracle；目标端通过独立 package、命令会话和平台端口复用规则，不把 Web DOM
组合层移入 Cocos。

当前默认界面为俯视角 2D 行走场景：大厅入场、房间探索、普通/首领战斗、
出口结算、回响归档、五态地图和 23 项完整帮助均由共享 ViewModel 驱动。大厅另有
物资、装备、灵宠、功法、血统、同伴和任务面板；兑换、成长、激活、携行、任务领取
及器魂共鸣均提交现有纯 reducer，不在 UI 复制规则。无 `wx` 的 Creator 预览使用明确
标记的内存存档与确定性 seed；检测到 `wx` 时，若没有显式注入真实设备持久性边界，
客户端会阻断写入而不是伪装成可发布状态。

## 2D 行走试玩

角色使用 4 方向 × 4 帧的全身透明图集。按住方向连续走动，松手停下；墙柱有碰撞，
可以沿边滑动，镜头跟随角色。宽屏试玩窗口等比显示完整竖屏界面，不裁掉操作区。

- 电脑：WASD / 方向键移动，E / 空格近距离互动。
- 手机：左下摇杆移动，右下按钮互动。
- 走近 NPC 打开整备弹层；传送门打开选章与配置，明确确认后入场；靠近怪物互动进入战斗。
- 战斗仍沿用原回合制规则；战斗中可以移动，但站位不改变命中、闪避或回合结算。
- 点击角色、背包、地图、目标或菜单打开手机弹层；关闭后回到原位置，弹层内不能继续走动。
- 陷阱、奖励、调查、共鸣和法则选择由现场物件打开选项，先看效果/风险，再明确执行。
- 装备、成长、掉落、章节解锁和存档结构不变；地图只查看已知区域，不能点击传送。

NPC 商品以带品质边框的图标网格展示，点击查看详情，购买与培养操作固定在详情右下角；
任务使者保留文字列表。购入后的装备、激活和出战配置在角色整备中进行，背包负责携行。
轮回之门先列出全部 19 个副本，点击后进入服务配置，确认入场按钮固定在右下角。
地图一次挂载完整区域，可上下左右拖动；“目标”首屏列出当前任务及简短进度，点击后
查看完整条件和奖励，返回列表保留滚动位置。

补给品（止血丹、护甲补片、定神香）不占携行槽，有库存即可在副本使用；特殊道具需要
入场携行或本局拾取。旧配置中的补给品在携行校验时剔除，不改变存档结构。

19 个副本均使用与章节介绍对应的独立俯视底图：积水地铁、废弃医院、陨矿洞穴、
灰烬竞技场、梦档案馆、方舟甲板、生物原型库和监察街道等，不再共用大厅地砖与图标柱。
底图由内置 imagegen 生成，源图及逐张提示词保存在 `art-source/dungeon-world/`，运行时
仅加载当前章节背景，探索与战斗按比例裁切。真实节点类型、六类待决选择、
精英与首领都有对应物件；已清理但仍可共鸣的节点保留共鸣台，不显示重复领奖。

Web 预览只保留内存进度，刷新后丢失。真实 Chrome 已覆盖 750×1334、320×568 下的
键盘/摇杆、停止、碰撞、镜头、NPC、传送门、战斗胜利以及探索中撤退结算回城；这不是
微信开发者工具、微信真机或发布验收。构建与检查命令见 [Cocos 说明](cocos/README.md)。

## 章节决策切片

Explore 现在投影五个由 selector 派生的章节决策面：章节法则、章节指令、有序路线
契约、压迫段位和追猎者。它们只读消费 ViewModel，不重算领域规则；presentation
聚焦测试覆盖 `metro_abyss`、`starfall_mine`、`rust_hospital` 三个回放副本、pending
装备供奉共存与 JSON/deep freeze 快照。默认行走界面通过“目标”中的“章规与探索”查看这五面，
地图、当前节点选择、装备记忆与菜单行动各自点开查看；邻近帮助只打开本地既有帮助，
headless 覆盖物理 320×568 与 390×844 两档。

诚实边界：章节语义由 headless 与包级测试覆盖。真实 Chrome 的自然路线覆盖首章，
另有19章真实 ViewModel 的隔离渲染图库；图库不代表自然解锁或逐章通关。
这些界面未冻结为 registry evidence，不得把本地覆盖当作发布或微信真机证据。

战斗状态区另有 selector 派生的章节上下文紧凑读数：法则标题/状态/计量与战斗相关
modifier（敌方全属性/防御/术攻、我方 force/art 输出、治疗、守御）和追兵名称/状态/
接触伤害/首领融合。危险法则与 stalking/fused 追兵追加为现有 combat risks；完整语义
仍由已有 law/pursuit help deck 承载。第 2、3、4 章真实 reducer combat 状态覆盖
law/pursuit/fail-closed/JSON/deep-freeze/动作不变，headless 覆盖 320×568 与 390×844。

本目录仍不是可发布候选。Creator 3.8.8 的真实导入、源码解析、metadata 审计、一条
390×844 设备档位的 Editor preview 自然路线，以及使用 sentinel AppID/HTTPS 地址的
真实 NON_RELEASE 微信远程 Bundle 构建已经完成；真实 AppID/CDN 的 production 构建、
微信开发者工具、真机持久性和 103 项正式验收证据尚未完成。

## 目录

- `packages/core/`：从 Web oracle 固定的 63 个领域/内容/规则模块。
- `packages/runtime/`：canonical hash、seed、`GameSession`、ledger 和三槽恢复协议。
- `packages/application/`：可序列化命令、校验和纯 reducer。
- `packages/save-codec/`：Web v1 原始存档的只读兼容解码器与 checksum fixture。
- `packages/client/`：唯一 session 编排、入场 seed、物理输入去重和生命周期绑定。
- `packages/presentation/`：四阶段只读 ViewModel、帮助语义和移动端设计令牌。
- `cocos/`：Cocos 3.8.8 场景、行走及详情 UI、223 个资源和微信平台适配。
- `acceptance/`：冻结的 103 项迁移验收登记；登记有效不等于 case PASS。
- `docs/`：迁移阶段、工具链、当前状态和风险。

## 本地验证

Node 26.7.0、npm 11.19.0、TypeScript 5.9.3 和构建顺序均由本工程锁定；不依赖
Web 项目的 `node_modules`：

```bash
npm ci
npm run toolchain:verify
npm run verify
```

`verify` 会核对精确 Node/npm/TypeScript 版本，按依赖顺序构建六个共享包，并检查
六包的 resolved `target/lib` 与发布 JavaScript 均满足 ES2020、源码目录无生成物
污染、223 项资源及 Creator metadata、Cocos 场景、headless
bootstrap/销毁/视觉资源与装备系统竞态、连续移动及手机详情检查、103 项 registry、验收 runner 合同、远程 bundle
配置/产物合同、全部
workspace 类型、90 项微信平台自检和包级测试。
`npm run typecheck` 与 `npm test` 也会先构建依赖，因此可在 clean clone 独立执行。

本机已用 Creator 3.8.8 完成首次导入，并提交其生成的稳定 `.meta` UUID；编辑器生成
的 `temp/` 声明仍是本机状态。每次真实 Creator 候选额外执行：

```bash
npm run typecheck:creator -w infinite-flow-wechat-cocos
```

headless `cc` shim 位于 `cocos/headless/`，不在 `assets/`，不会被 Creator 导入或与
真实引擎声明合并。

2026-08-11 已在真实 Creator 3.8.8 中通过“Developer → 清除代码缓存”后重新编译并
启动 Preview（`http://localhost:7456`）。配置 bundle 为 `config`，其 manifest UUID 为
`3d0842ec-43f7-4b5f-961f-39edb535ccd7`、revision 为
`sha256:91b2f75d946411a2ac16d0a313336ba97bd395f652e55aa625fa940c396525b2`；资源 bundle
为 `resources`。真实 UI/运行态依次确认：大厅 `scene:main_god_space`（开发预览就绪），
确认入场后探索 `dungeon:demon_tower_1`（revision 1），迎战后战斗
`monster:fog_lesser_demon`（revision 2）。三段 View 都有 SpriteFrame/Texture，
`lastVisualBootstrapFailure=null`，控制台无 warning/error，场景无 Missing Script。
此前真实回调成功态 `error===undefined` 被误判的问题已修复，headless 已增加
`undefined` 成功回归。以上仅是 Creator Preview 证据，不是发布或真机证据；共享 package
更新后仍须清除缓存、重编并新开预览，不能以刷新旧 preview 冒充当前候选。

同日较早的无状态注入新档自然路线还完成了：首章生存携行、入场、普通战斗、血字
阶梯“强行通过”、相邻地图移动、断符石盘/巡哨布袋/雾后暗格/雾草木匣奖励、雾锋
回响、Boss 封印→觉醒→击杀、出口结算、归档雾锋并返回大厅。该路线保留了未来迁移
所需的交互语义，但同样尚未冻结为 registry evidence；上面的三段复验专门证明当前视觉
bundle/manifest/ImageAsset 接线，不取代这条完整玩法路线的记录。

## 微信构建

生产构建只能使用 Creator 3.8.8。已下载并构建的官方 `cocos-cli` 4 alpha 是固定版本
的能力探针，不是生产构建器。

先从 Creator 3.8.8 构建面板分别导出选中 `config` 与 `resources` 的微信配置。官方导出
会保留各自的 opaque bundle `root`；先把两个 fragment 严格合并，再交给 renderer：

```bash
npm run wechat:editor-config:compose -- \
  --fragment /path/to/config-only.json \
  --fragment /path/to/resources-only.json \
  --output /path/to/wechat.editor-composed.local.json
```

composer 要求两个 fragment 除 `bundleConfigs` 外完全相同，重复 bundle 定义必须深等，
并固定 `config`/`resources` 的 root、UUID 和 output。renderer 会保留 Editor 未知字段和
opaque root，只覆盖 profile 管理的字段。无凭证模板可先用于检查配置形状并执行真实
NON_RELEASE 构建：

```bash
npm run wechat:config:render -- \
  --base /path/to/wechat.editor-composed.local.json \
  --output /path/to/wechat.remote.local.json \
  --mode remote \
  --template
```

```bash
export COCOS_CREATOR_BIN="/path/to/CocosCreator.app/Contents/MacOS/CocosCreator"
export COCOS_WECHAT_BUILD_CONFIG="/path/to/wechat.remote.local.json"
npm run build:wechat:template
```

2026-08-12 已用本机 Creator 3.8.8 完成上述模板构建。严格产物门禁确认 187 项资源都在
`remote/resources`，`assets/resources` 不存在，版本化资源脚本保留在主包
`src/bundle-scripts/resources`，`config` bundle 仍位于本地 `assets/config`；最终结果固定
为 `NON_RELEASE_TEMPLATE_BUILD_VALID`、`releaseEligible:false`。该结果证明真实 Creator
消费匿名配置 FD 和远程 Bundle 布局，不证明真实 AppID、CDN 可访问性或微信端运行。

生产配置只从环境读取 AppID 和 HTTPS CDN 基址；输出必须以 `.local.json` 结尾、权限
为 `0600`，且不会覆盖已有文件：

```bash
COCOS_WECHAT_APPID='真实 AppID' \
COCOS_WECHAT_REMOTE_BASE_URL='https://已备案并加入白名单的资源域名/基础路径/' \
npm run wechat:config:render -- \
  --base /path/to/wechat.editor-composed.local.json \
  --output /path/to/wechat.production.local.json \
  --mode remote \
  --production

npm run wechat:config:verify -- \
  --config /path/to/wechat.production.local.json \
  --mode remote \
  --production
```

验证通过后再执行真实构建：

```bash
export COCOS_CREATOR_BIN="/path/to/CocosCreator.app/Contents/MacOS/CocosCreator"
export COCOS_WECHAT_BUILD_CONFIG="/path/to/wechat.production.local.json"
npm run build:wechat
```

production 配置必须通过 release-eligible `remote` profile。`resources` 目录已静态绑定
Creator 的 `resources-remote-wechat-v1` preset；单一目录 metadata 不能安全切换为分包，
因此旧 `subpackage-smoke` 登记仅保留兼容说明，所有配置门禁都会明确拒绝它。本地配置
不得提交。构建命令先强制核对 Creator 实际版本、完整根验证、
Creator 类型检查和 production 配置，再绑定 clean Git `HEAD`、`HEAD^{tree}` 与包含全部
untracked 路径的完整 status；工作区不干净即拒绝调用 Editor。配置精确解析出的 output
leaf 在本轮前必须不存在，脚本不会替用户删除或覆盖旧产物。任何一步失败都不会产出候选。
最终调用保留 Creator 主 Mach-O 的只读 FD，并以
SHA-256/CDHash 绑定挂起子进程实际加载的签名镜像；含 AppID 的配置进入已 unlink 的
`0400` 匿名只读 FD，Editor 只收到 `/dev/fd/198`，日志也不输出 AppID。2026-08-12 的
真实模板构建已证明 Creator 3.8.8/Electron 能完整消费该 FD 合同；production 仍需用真实
AppID/CDN 重复同一门禁。该边界不声称冻结整个 `.app` bundle，也不抵抗可控制进程的
同 UID 主体或 root。Cocos 源码的 `@infinite-flow/*` bare imports 通过六个
workspace package 的 exports 解析到 `packages/*/dist`；这些被忽略的构建文件会按完整
regular-file tree、内容 hash 和文件 identity 单独绑定。Creator 返回成功码 `36` 后，脚本
还会核对 187 项资源输入、六包 dist、profile、配置、Creator 和 Git candidate 均未漂移，
且 output leaf 确为本轮从不存在变成真实目录；随后才核对资源 trace、`settings.assets`、
`game.json`、远程 bundle
布局、包体保守边界和三组树 hash；verifier 返回后再做一次完整输入复核。产物门禁也
通过才报告带非敏感 candidate identity 的成功结果。`32` 为参数错误、`34` 为构建失败。
`npm run toolchain:require` 可用于只做快速生产工具链诊断。

产物 verifier 先把 output root 解析为固定 canonical directory identity；每个 regular
file 都从原 pathname 以 `O_RDONLY|O_NOFOLLOW` 打开，在 FD 上取同一份 bytes/hash，
并在读取前后及关闭前后绑定 `fstat` 与 pathname `lstat`。所有 JSON/文本语义只消费这次
冻结的 bytes；目录 identity 也会记录并在扫描末尾复核。语义检查完成后再做一次完整
稳定扫描，只有 root identity、目录/文件 path set、每个 inode、bytes/hash 和原有
package/bundle/tree fingerprint 全部相同才返回。仓库侧 manifest、resource 和 `.meta`
trace 使用相同 no-follow 捕获并进行第二次 identity/hash 比对。`npm run
wechat:output:snapshot:self-check` 无需 Creator，覆盖 pathname 替换、symlink、增删、
内容、目录和 root identity 漂移。

Node 的文件系统 API 在这里提供的是逐文件 no-follow FD 与目录/root 双扫描，不是
内核级 `openat` 祖先锁定；该门禁不抵抗能控制 verifier 进程的同 UID 主体、扫描前已
持有写 FD 的主体、主动内核级进程控制或 root。

## 微信开发者工具本地试玩（NON_RELEASE smoke）

已验证构建可以派生一个**只用于本地 DevTools 试玩**的独立副本，不绑定真实 AppID、
不接 CDN：

```bash
npm run wechat:devtools-smoke:derive     # 已验证构建 -> cocos/build/wechatgame-devtools-smoke
npm run wechat:devtools-smoke:serve      # 127.0.0.1:8947 loopback 远程资源服务
npm run wechat:devtools-smoke:self-check # 正例 + 负例自检（36 项）
```

派生副本使用官方公开小游戏游客 AppID（DevTools 显示为 touristappid），
`assets.server` 指向 `http://127.0.0.1:8947/`，22MB 远程 bundle 仍由本地
fail-closed 静态服务提供，不进主包。副本根目录带 `NON_RELEASE_SMOKE.md` 与
`devtools-smoke.derived.json` 标记。导入时目录选 `wechatgame-devtools-smoke`
（不是 `wechatgame`），详见 [docs/04-devtools-smoke.md](docs/04-devtools-smoke.md)。

**DevTools 可玩 ≠ 真机/发布/持久性验收**：该纵切不证明真机行为、CDN/HTTPS、
弱网、缓存或存储持久化，不得作为 release evidence，不得上传。

## 不可破坏的边界

- 所有领域写入只经过 `GameSession.dispatch()`；Cocos 只消费 ViewModel 和提交事件。
- 领域层不访问 DOM、Cocos、微信 API、墙上时钟或隐式随机。
- 入场 seed 由 host 生成并先持久化；ViewModel 不携带 seed 或 command ID。
- 同一次物理触控只生成一次 intent；持久幂等继续由 session ledger 保证。
- 稳定 ID、Web v1 raw、canonical hash 和 187 个资源 key/revision 不因表现层改变。
- 复杂机制始终保留功能旁的 `?` 完整帮助，不以移动端空间为由删去语义。
