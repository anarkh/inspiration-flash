# Cocos Creator 3.8.8 target

本目录是微信小游戏生产目标工程。入口场景为
`assets/InfiniteFlow.scene.scene`，Canvas 只挂载一个 `InfiniteFlowApp`；运行时 UI
节点由表现层 ViewModel 构建，不持有可写领域状态。

## 2D 行走模式

大厅、探索和战斗默认显示可操控的全身人物。`ui/walk-world.ts` 投影当前房间及原有
动作，处理连续移动、碰撞和互动范围；`InfiniteFlowWalkInput` 绑定键盘/摇杆；
`InfiniteFlowWalkScene` 绘制房间、精灵动画、景物遮挡、镜头和触控按钮。
`InfiniteFlowApp.update` 每帧推进本地坐标，不发送移动领域命令；只有主动互动才
透传既有事件。`InfiniteFlowInfoSheet` 承载角色、背包、地图、目标、记录、菜单、
NPC、入场、现场选择、帮助目录和结算明细；打开时暂停移动，关闭保留位置。
`dungeon-world-theme.ts` 只存19章美术元数据，不参与规则、解锁或存档。

从迁移工程根目录检查：

```bash
npm run cocos:walk:test
npm run cocos:race:test
npm run cocos:sheet:test
```

用 Creator 3.8.8 构建 Web Mobile 到 `cocos/build/web-mobile` 后，可用静态服务器
预览；这只是内存试玩，不是微信发布构建。双档真实输入检查会拒绝旧构建，并将
人物位置、图集帧、镜头、物理输入和截图写入 `cocos/build/web-mobile-canvas-smoke/`：

```bash
npm run cocos:web-mobile:smoke -- --viewport=750x1334
npm run cocos:web-mobile:smoke -- --viewport=320x568
```

该脚本分开记录物理输入自然路线与 `dungeonRendererGallery`：前者验证移动、弹层、
19章入口切换和首章战斗；后者用真实 reducer 入场生成的19个隔离 ViewModel 验证
渲染主题，前后断言客户端领域状态不变。图库不是逐章通关或微信真机证据。

试玩时确认：四向行走与松手停止、墙柱阻挡、镜头跟随、近距离交谈、传送入场、
遇敌战斗与结算回城。战斗保留原回合规则，不把走位解释为新增的闪避或攻击距离规则。

## 两类 TypeScript 检查

clean clone 在没有 Creator 的情况下，从迁移工程根目录执行：

```bash
npm ci
npm run typecheck
```

它使用 `tsconfig.headless.json` 和 `headless/cc.d.ts` 的最小声明。shim 位于
`assets/` 之外，Creator 不会导入它。若只想重复 Cocos workspace 检查，须先在根
目录执行 `npm run build` 生成共享包 declarations，再执行
`npm run typecheck -w infinite-flow-wechat-cocos`。

`npm run cocos:race:test` 会用虚拟 `cc`/host 运行 89 个 headless 场景，覆盖 preview/wx
生命周期 handoff、异步动作与销毁 generation fencing、缺失 lifecycle `off*` 时
fail closed，以及 config/resources manifest、ImageAsset 精确引用释放、memory warning、
revision mismatch、普通 Creator 错误分类、bootstrap/per-key 隔离的 offline/timeout
fallback 与 250/1000/3000/10000/30000ms 封顶持续退避恢复。
其中新增 9 个微信开发者工具 NON_RELEASE 场景：仅当 `wx` 存在、未注入持久边界且
`getDeviceInfo()`（缺失时才回退 `getSystemInfoSync()`）报告 `platform === 'devtools'`
时，运行时用 `InMemoryStoragePort` 建立独立 NON_RELEASE 客户端——存档只在内存，
刷新或关闭即丢失，界面永久标注“微信开发者工具 · NON_RELEASE / 内存存档 / 关闭或
刷新即丢失”，生命周期诊断（含 durable resume）永不升级为已签核持久模式。ios/
android/ohos/mac/windows/unknown 或畸形/抛错的 `getDeviceInfo` 在无边界时于任何可写
状态前 fail closed，绝不被当作 preview；真机仍必须显式注入已签核持久边界
（`configureInfiniteFlowWxDurabilityBoundary`）才能获得持久存档，注入的边界即使在
devtools 也优先于 NON_RELEASE 内存路径。每个 NON_RELEASE 场景还断言
`wx.getStorageSync`/`wx.setStorageSync` 零调用——epoch 与 save 只写入内存存储，
绝不触碰 wx journal；销毁后才 settle 的 devtools 命令（成功或失败）同样不回写 UI、
不读状态、不补 seed、不触碰 wx storage。
入场构筑回归还验证路线契约只属于当前副本、切章清除而协议/炼狱层级切换保留合法
契约，以及归档遗物种子只桥接为一条 `hub/configure-relic` 客户端命令且不触发入场
seed 补充；该命令在销毁后的成功/失败延续都不会回写宿主状态。
装备封存委托的本地选择以 presentation 产出的完整 draft 替换宿主快照，Cocos 不重复
实现两件装备或材料规则；启动/召回沿用统一物理 command 通道，仅在存活请求返回
`committed`/`duplicate` 后清除 draft，拒绝、无效输入和持久化阻断均保留。headless
回归覆盖 replacement、两种成功去重结果、失败保留、销毁后的成功/失败延续，以及
idle/draft/active/推进/完成五态 formatter。状态卡专门显示两件装备、目标材料、不同
副本进度、召回损失和结算读数，邻近 `?` 直达机制帮助；通用动作卡仍由表现层动作
集合统一渲染。
现代装备记忆库没有 Cocos 本地规则或新 handler：`hub/activate-equipment-memory` 由
通用物理 command 通道原样发送并执行正常 seed refill。装备面板把记忆库与封存委托
并列呈现，读取 presentation 给出的 supported/owned/equipped、unlocked/active、自动
收录条件与下一循环项；两个 104×104 的邻近 `?` 分别打开各自帮助，单次触控只发出
一次 local event。现代探索没有狩猎 VM 时不绘制虚构任务；恢复的 legacy 狩猎才显示
display、节点/事件双信号精确 ID、下一目标、冻结铭刻和故障。战斗卡显示激活记忆、
匹配装备、overflow 储存/恢复，legacy 缺快照或畸形状态明确 fail-closed。结算卡允许
封存委托与装备记忆同时存在：legacy 保留原狩猎结果，现代只称“本章已收录/激活”或
“本章尚未收录”，不声称本次新获得。headless 还覆盖精确激活 command、正常 refill、
两种帮助点击、销毁后的成功/失败延续，以及上述 Hub/Explore/Combat/Result formatter。
Result 阶段的所有 detail（包括只有 outcome 的历史存档）都进入同一个 Result pager，
不再走 `renderSimpleStatus` 旁路；总览页始终存在。总览把 core `lastOutcome` 机器串
安全地转成中文概览（只提取已知的 outcome/score/multiplier/reward 字段并中文化，
未知值降级为中性文案），UI 绝不泄漏 `outcome=`、`score=`、`multiplier=`、`reward=`
等 raw token；状态卡的 outcome 指标同样经过净化。稳定页序为：结果总览、回响归档
详情/动作上下文、装备状态/掉落、装备封存委托、装备记忆、装备铭刻、协议结算、主神指令、
路线契约、侵蚀压力、破界追兵；无数据页省略。回响页解释 pending/archived/skipped/lost/
none 与可用的 archive/return 动作上下文，但实际动作仍由既有 Deck 统一渲染，不丢失。
页 ID 与顺序确定，完整 page-set signature 变化时回到第一页，phase/detail 变化时 reset
或 clamp。可见的“上一页/下一页”控件触控区各为 108×116 design px（≥104），边界显式
禁用，没有隐形 forward-only 热区。中文/ASCII 长行由可复用纯函数按 CJK=1、ASCII=0.55
单位确定性折行，每页最多 6 行，超出时把一个逻辑页切成稳定续页（标题标注“续 n/m”），
320x568 与 390x844 映射到 750x1334 设计空间时不溢出、不重叠，导航可达，不依赖 Label
shrink。所有结算文案只来自 `ResultDetail` 的 `last*Settlement` 权威字段，Cocos 不重算
结算规则；历史存档缺少结算快照时只显示已有字段，不虚构奖励。指令结算状态行只
读 `directiveSettlement.statusLabel`（如“进行中”），绝不读 `status` 原始 enum。
headless 覆盖每一类页、只有 outcome 的结果、回响 pending/archived 动作上下文、
前后边界禁用、page-set 变化 reset/clamp、malformed invalid 卡、320x568 与 390x844、
超长中文/ASCII 折行子页、导航触控尺寸、无 raw IDs/enums（raw-token 断言覆盖归档/
铭刻/协议/指令/契约/侵蚀/追兵全部结算状态 enum，并对每个翻页后的页面运行；指令
结算 fixture 只提供 `statusLabel:'进行中'` 而不提供 `status:'active'`，指令页精确
断言 `状态 进行中 · 3/3 已满足` 中文状态行并拒绝 raw `active`，杜绝 fixture 与
View 同错假阳性），以及销毁后触控惰性。
探索状态卡右侧新增分页的章节决策区：地图、当前节点、待处理选择/装备记忆卡、动作、
焦点与既有分页全部保留，装备记忆卡仍为第 1 页，其后五页依次为场域法则、主神指令、
路线契约、侵蚀段位、破界追兵。所有文案只来自 `ExploreDetail.chapterDecision` 的 VM
字段（法则计量/修正、指令目标完成度、契约 0/2→1/2→2/2 与失败原因、侵蚀段位/出口加成、
追兵状态/接触/苏醒进度），Cocos 不重算领域规则；法则/指令/侵蚀/追兵页的邻近 `?`
复用既有 `help/open` 本地事件与 `law`/`directive`/`pressure`/`pursuit` 帮助条目，路线
契约没有对应帮助 ID，只展示 VM 提供的说明文案，不发明规则。headless 覆盖
metro_abyss/starfall_mine/rust_hospital 三副本的法则严重度与计量、指令目标状态、
契约 0/2/1/2/2/2/failed、侵蚀三段位、追兵 dormant/stalking、与 pending 选择共存、
320x568 与 390x844 下五页可达、渲染不增删不改序动作、帮助仅本地事件、输出无 undefined、
销毁后触控保持惰性。
战斗状态卡在既有 HP 条/意图/Boss 读数旁新增 selector 派生的章节上下文紧凑读数：法则
标题/状态/计量与战斗相关 modifier（敌方全属性/防御/术攻、我方 force/art 输出、治疗、
守御）一行，追兵名称/状态/接触伤害/首领融合在 stalking/fused 时追加一行；危险法则与
stalking/fused 追兵同时追加为现有 combat risks。完整语义仍由既有 law/pursuit help deck
承载，不新增命令或动作。headless 覆盖 dormant/stalking/fused 追兵、danger 法则、
fail-closed 缺律、320x568 与 390x844 可达、输出无 undefined、无非战斗命令。
某个 disposer 抛错时其余资源仍会清理；销毁后不会调用已 dispose 的 client、刷新 UI
或重新挂回平台资源。它只证明虚拟宿主合同，不是 Editor Preview、真实 CDN、微信
开发者工具或真机证据。

Creator 3.8.8 首次打开工程后会生成 `temp/tsconfig.cocos.json`。此后执行真实引擎
类型检查：

```bash
npm run typecheck:creator -w infinite-flow-wechat-cocos
```

根 `tsconfig.json` 只扩展 Creator 生成的配置；在首次导入前该命令预期阻断。
平台纯 TypeScript 自检与其专用配置位于 `headless/`，不会进入 Creator 的运行时
资源图；`assets/scripts/` 内只保留游戏运行所需模块。

## 运行模式

- 无 `wx`：清楚标记为“开发预览 / 内存存档”，使用 `InMemoryStoragePort` 和固定
  `SequenceSeedPort`，关闭预览即丢失。
- 有 `wx` 且已注入具名 `WxDurabilityBoundary`：读取真实 safe area、预填充微信
  安全随机池并使用 journal storage；注入的边界优先于一切平台探测结果。
- 有 `wx`、未注入边界且 `getDeviceInfo()`（缺失时才回退 `getSystemInfoSync()`）
  报告 `platform === 'devtools'`：诚实的 NON_RELEASE smoke 模式。客户端使用
  `InMemoryStoragePort`（关闭或刷新即丢失），仍复用 wx 安全随机池、生命周期与
  safe-area；界面稳定标注 `wx-devtools` 模式与“微信开发者工具 · NON_RELEASE /
  内存存档 / 关闭或刷新即丢失”，绝不把 readback、同步写或字符串 ID 描述为真机
  durable，也绝不调用 `WxJournalStoragePort` 或读写 wx storage。
- 有 `wx`、未注入边界且宿主未精确报告 `platform === 'devtools'`（真机或探测
  异常）：在创建 client、消耗 seed、写任何持久候选之前稳定阻断，显示阻断诊断，
  不降级成内存存档，也不声称同步读回等于 durable。

布局按 750×1334 design-px 编写；host viewport inset 会按
`design-px = viewport-px * 750 / viewport-width` 换算。320 宽设备的交互高度至少
104 design-px（44 viewport-px）。地图/动作状态同时使用文字、符号和边框模式，
常用文字与边界颜色在模块载入时执行 WCAG ratio 断言。

## Creator 导入与预览门禁

1. 只用 Creator 3.8.8 打开本目录；不要用已下载的 Cocos 4 alpha CLI 打开或升级工程。
2. 首次导入已完成：187 个 PNG、scene、运行脚本和 212 个 metadata UUID 通过审计；
   新一轮 prerequisite import 不含 headless self-check，Creator 项目日志无新的解析错误。
3. `typecheck:creator` 已通过；2026-08-11 在真实 Creator 3.8.8 执行“Developer →
   清除代码缓存”后重编，Preview 为 `http://localhost:7456`。config bundle 的 manifest
   UUID 是 `3d0842ec-43f7-4b5f-961f-39edb535ccd7`，revision 是
   `sha256:91b2f75d946411a2ac16d0a313336ba97bd395f652e55aa625fa940c396525b2`；resources
   bundle 为 `resources`。真实 UI 依次观察到大厅 `scene:main_god_space`（开发预览
   就绪）、确认入场后的探索 `dungeon:demon_tower_1`（revision 1）、迎战后的战斗
   `monster:fog_lesser_demon`（revision 2）。三段 View 均含 SpriteFrame/Texture，
   `lastVisualBootstrapFailure=null`，控制台无 warning/error，场景无 Missing Script。
   真实回调的 `error===undefined` 成功态误判已修复，并已加入 headless `undefined`
   成功回归。
   同日较早的无状态注入新档自然路线还完成了携行配置、普通战斗、血字阶梯“强行
   通过”、相邻地图与四处奖励、雾锋回响、Boss 封印/觉醒、出口结算、归档并返回
   大厅；该记录用于保留完整玩法语义，尚未冻结为 registry evidence。
4. 每次候选都要重复真实 declarations 类型检查、清除代码缓存后的重编、场景预览和
   资源/脚本错误审计。共享 package 重建后单纯刷新旧 preview 可能继续运行旧 bundle；
   必须新开预览并完成关键 trace。该 Preview 不替代真实 AppID 微信构建、CDN/HTTPS
   remote、微信开发者工具或真机验证。
5. `resources` 已通过 `resources-remote-wechat-v1` Creator preset 固定为微信远程
   `merge_dep` Bundle；`config` 保持本地。2026-08-12 的真实 3.8.8 NON_RELEASE 模板
   构建确认产物只在 `remote/resources` 保存资源数据，主包只保留版本化 bundle 脚本，
   `assets/resources` 不存在。该模板使用 sentinel AppID/HTTPS 地址，不能上传或冒充
   production；发布前仍须提供已备案且加入微信白名单的真实 CDN 地址并重复构建/验收。

`library/`、`local/`、`temp/`、`profiles/` 和 `build/` 是生成态并已忽略。Editor 生成
的源资源 `.meta` 已提交以固定 clean clone 的 scene/script/image UUID；资源门禁要求其
与对应文件或目录严格一一配对、UUID 唯一且 207 个图片 redirect 有效。不得手工替换
这些 UUID 并称为 Creator 验证。

根 `npm run build:wechat:template` 与 `npm run build:wechat` 都会重新执行完整 headless
验证、强制读取 Creator 安装包的实际版本（必须为 3.8.8）并运行
`typecheck:creator`。前者允许对当前完整脏候选做内容/身份绑定，但永远输出
`releaseEligible:false`；后者还要求 clean Git candidate 和真实 production 配置。这些
自动门禁不替代 Editor preview、真实 CDN、微信开发者工具或真机验收。
