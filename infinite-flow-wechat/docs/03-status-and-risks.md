# 状态与风险

核对日期：2026-08-14。本文描述当前工程证据，不是发布验收报告。

## 1. 当前状态

| 工作流 | 状态 | 当前可重复结果 | 尚未声明 |
| --- | --- | --- | --- |
| Web oracle | 已冻结 | 源 revision `2645f0232542684d27de1abc321bb26913320420`；迁移开始前 1403 tests、typecheck/build、187 资源审计、19/19 UI smoke、知识库校验通过；迁移工作未改 `infinite-flow/src` | 不是本次 Cocos candidate 的跨端对照证据 |
| core | 包级完成 | 63 个运行时模块；显式 seed；DOM-free typecheck；Node ESM 与确定性 seed gate | 未绑定正式 `AC-CONTENT/LAW` vectors |
| runtime | 包级完成 | canonical JSON/SHA-256、seed lineage、串行 session、ledger/state revision、tmp/formal/backup、256 receipt retention、suspend/resume 和故障注入自检 | generic/fake storage 不能证明微信真机 durable boundary |
| Web v1 codec | 包级完成 | 严格 UTF-8/BOM、原始 text/bytes 保留、兼容 sanitizer、legacy seed 报告、checksum fixture | 仅 preview/decode；尚无 rejected payload/reason/index 三件套 durable commit |
| application/client | 首章基础完成 | 62 个可序列化命令；phase guard；显式入场 seed；pending physicalId 不受 completed retention 淘汰；生命周期注册失败与正常销毁均穷尽回滚/清理并稳定聚合异常；reducer/headless 脚本覆盖首章主要阶段；真实 preview 通过 client/session 完成一条无状态注入自然路线；真实回调 `error===undefined` 成功态误判已修复，headless 已补该成功回归 | 自动演练仍含 HP/回响状态注入；人工路线尚未成为可复算 runner；不是 19 章完整玩法 UI；schema-v2 invariant/import 仍不完整 |
| presentation | 首章与大厅经营切片完成 | 四 phase、五态地图、pending、战斗 intent/风险、Boss/出口/回响、23 个 core 帮助加 1 个委托本地帮助、单事件动作、320/390 触控与对比度 contract；8 个稳定大厅面板已覆盖物资、装备、灵宠、功法、血统、同伴、任务及器魂共鸣入口，领域动作均由 reducer 预检；入场构筑已补齐当前章节的 3 个路线契约、有序目标/独立奖励、归档遗物种子及导器 `2 → 3` 候选语义；未拥有装备仅能按 core selector 选定的已解锁章节配方兑换，命令显式携带 `sourceDungeonId`；装备页已接入两件装备/目标材料的封存委托草案、成本与 3 个不同成功副本进度、召回及结果结算，也接入现代装备记忆库的单槽循环激活，探索/战斗/结果保留 legacy 双信号与 fail-closed 兼容读数；委托与记忆并存时动作仍严格 `<20`；Explore 新投影五个 selector 派生的章节决策面（法则、指令、有序路线契约、压迫、追猎），只读消费 ViewModel 不重算规则，聚焦测试覆盖 metro_abyss、starfall_mine、rust_hospital、pending 共存与 JSON/deep freeze；Combat 新投影 selector 派生的章节上下文（法则标题/状态/严重度/计量与战斗相关 modifier、追兵名称/状态/接触伤害/首领融合），危险法则与 stalking/fused 追兵追加为现有 combat risks，第 2/3/4 章真实 reducer combat 状态覆盖 law/pursuit/fail-closed/JSON/deep-freeze/动作不变 | 现代 flow v2 明确不暴露旧式 equipment/memory hunt-prep；章节专属 dashboard 与后续章节完整 UI 尚未投影，legacy 事件标题因 core 无公开 selector 仅显示精确 `eventId`；章节决策五面与战斗章节上下文均只有 headless/包级证据，未在真实 Creator/DevTools 复验，未冻结为 registry evidence |
| Cocos scene/UI | 真实导入与首章 Preview 完成 | 2026-08-11 在真实 Creator 3.8.8 通过“Developer → 清除代码缓存”后重编，Preview URL `http://localhost:7456`；config bundle manifest UUID `3d0842ec-43f7-4b5f-961f-39edb535ccd7`、revision `sha256:91b2f75d946411a2ac16d0a313336ba97bd395f652e55aa625fa940c396525b2`，resources bundle `resources`；本轮三段视觉接线复验依次为 `scene:main_god_space`（开发预览就绪）、`dungeon:demon_tower_1`（确认入场后，revision 1）、`monster:fog_lesser_demon`（迎战后，revision 2）。三段 View 都有 SpriteFrame/Texture，`lastVisualBootstrapFailure=null`，控制台无 warning/error，scene 无 Missing Script；另有单 Canvas/单 App、83 场 headless race（含契约跨章拒绝、遗物种子桥接、封存委托草案/派发/销毁边界、现代记忆激活与 legacy Explore/Combat/Result 共存投影、章节决策五面分页渲染与 pending/记忆共存、战斗章节上下文紧凑读数与 320×568/390×844 物理档位、本地帮助与销毁后惰性）、safe-area、≥44 viewport-px 触控、邻近机制帮助、非颜色状态与 WCAG ratio 自动 gate | 三段视觉复验早于本轮委托/记忆状态卡，只证明当时 bundle/manifest/ImageAsset 接线，不替代较早完成的完整自然玩法路线；这些新增状态仍需下一次真实 Preview 复验，且均未冻结为 registry evidence。章节决策五面同样只有 headless 证据；当前代码尚未在真实 Creator Preview/微信开发者工具重跑（本机锁定，验证未执行），重跑前不得把旧 Preview 证据当作当前候选。无真实 AppID 微信构建、CDN/HTTPS remote、微信开发者工具、真机截图/交互 trace，以及强杀/配额/延迟/安全区/触控/弱网/低内存验证；不得将 Creator Preview 作为发布或真机证据 |
| 微信平台适配 | 包级完成 | 双槽整键空间 journal、安全 seed 预填充、六个必需 lifecycle on/off 能力与 exact-handler 清理、AssetPort/loader 和 90 项断言/4 个 suite 环境无关自检；headless 覆盖资源错误分类、精确引用生命周期、确定性退避恢复与诊断脱敏 | 默认 flush 明确 `durability-unattested`；真实 CDN/弱网/缓存/低内存与强杀/配额/延迟真机签核仍缺失 |
| 资源 | Creator 快照、远程 preset 与真实模板构建完成 | 187 key = 187 PNG；185 源文件逐字节一致，2 个 SVG 确定性栅格化；212 个 Creator metadata/UUID 一一对应且唯一；revision `sha256:91b2f75d946411a2ac16d0a313336ba97bd395f652e55aa625fa940c396525b2`；`resources-remote-wechat-v1` 将微信资源固定为 remote `merge_dep`、`config` 保持本地；2026-08-12 真实 Creator 3.8.8 NON_RELEASE 构建通过，425 个输出文件中主包 49 个/6,798,993 bytes、远程 Bundle 376 个/22,354,964 bytes，187 项 trace 完整，`assets/resources` 缺失且版本脚本位于主包 | 模板使用 sentinel AppID/HTTPS 地址；尚无真实 CDN 上传/hash、微信白名单、开发者工具或设备缓存/弱网验证。静态 preset 不支持同一 metadata 切换 subpackage，旧 smoke 模式由门禁拒绝 |
| 工具链 | 本机 3.8.8 与真实模板构建已取证/production 待实参 | Node 26.7.0、npm 11.19.0、TypeScript 5.9.3 精确门禁；六个 Cocos 运行依赖的 resolved `target/lib` 与 86 份发布 JavaScript 通过 ES2020 语法/内建门禁；本机 Creator 3.8.8 executable/plist/SHA 与运行态 CDHash/`CS_VALID|CS_KILL` 已核对；主 Mach-O FD/CDHash、挂起子进程与匿名 config FD 的 36 项合同 gate；两个官方 Editor fragment 已严格合成；真实模板构建已证明 Creator/Electron 消费 `/dev/fd/198`、返回成功协议，并在产物 verifier 前后保持 candidate identity 稳定 | 尚无真实 AppID/CDN 的 production 配置与 clean-candidate 构建；Creator 导入后在自身 bundle 新增 `engine-native`/import-map cache，当前整包 `codesign --deep --strict` 不再通过；主 executable SHA/CDHash 未变，既有边界不覆盖完整 `.app` bundle、受控进程、预持写 FD 或 root |
| 验收 | registry 与首批 runner 完成 | 103 = 94 leaf + 6 release-evidence + 2 attestation + 1 derived；全部 ID 显式注册；`AC-CONTENT-001`、`AC-COMPAT-001..004`、`AC-HASH-001`、`AC-SEED-002`、`AC-ASSET-002..003` 共 9 个普通 A-AC、41 个冻结 scenario 可复算，runner 合同 923 项断言/19 个 suite 固定计数自检通过；正式 runner 以 clean HEAD 在仓外重建并实际导入 core/runtime/application/save-codec/client/presentation 六包，逐字节匹配候选 ignored dist，并在 import/case/evidence/seal 窗口绑定可信 Git、materialized source/import graph、toolchain、执行 dist/候选 dist 的 content、identity 与 resolution；每个 required method 独立判定，in-process implementation 仅允许标记 `A-AC`，未执行的 Web/smoke/真机方法保持 BLOCKED；普通 runner 口径为 9 PASS / 94 BLOCKED，另有一条尚未绑定 case 的 Creator 自然 smoke | 当前 dirty candidate 下普通执行不构成 evidence，9 份报告均为 `formalEvidence:false`、`releaseEligible:false`；本地 evidence 仍由同一 owner 可写，不抵抗同 UID/恶意候选代码/自隐藏 preload/swap-restore 竞态；正式 acceptance leaf PASS 仍为 0/94，下游 6 release + 2 attestation + 1 derived 均未放行，且无独立 CI/WORM、正式 Creator smoke 或真机 evidence |

部分 case 已有尚未绑定 ID 的 package unit/static 断言，但仓内还没有可复算的
case-ID 映射、已转存到外部 WORM/签名存储的 candidate 或所需的平台证据。任何包级测试成功都不得提升为
正式 AC PASS。

## 2. 当前 P0 阻断

1. **Creator 生产构建**：3.8.8 导入、metadata、源码解析、无 Missing Script、首章自然
   preview，以及 sentinel 配置的真实 remote 模板构建均已通过；仍须提供真实 AppID/CDN，
   在 clean candidate 上执行 `build:wechat` 并归档 production 产物与日志。
2. **资源交付策略**：`assets/resources` 约 22 MB。remote preset、两个官方 fragment 的
   合成、template/production renderer 和真实模板输出门禁已通过；仍需确定 CDN/HTTPS
   域名与微信白名单，上传并核对远端树 hash，再验证 revision 缓存、弱网、失败 fallback
   和低内存释放。
3. **持久性签核**：微信同步写入+读回只形成 candidate，不是强杀后 durable 证明。
   必须在真实设备完成强杀/空间不足/延迟矩阵后，才能注入具名
   `WxDurabilityBoundary`；否则运行时保持阻断。
4. **存档迁移封口**：Web v1 codec 已能保真 decode，但 import/rejected index、raw
   payload/reason/index 三件套和完整 schema-v2 invariant gate 尚未实现。
5. **验收 evidence**：`test:migration -- --ac` 已覆盖全部 ID 的显式注册并实现 9 项
   fixture，但尚无 clean candidate 的正式 leaf evidence、release evidence、双签
   attestation 或最终只读 derived evidence；正式 leaf 仍为 0/94。

## 3. 风险登记

| ID | 严重度 | 风险 | 当前控制 | 关闭证据 |
| --- | --- | --- | --- | --- |
| R1 | P0 | 目标端形成第二套规则或与 Web oracle 漂移 | 来源 SHA、63 文件快照、公开 package 边界、Web source diff gate | 同 candidate 跨端 golden vectors |
| R2 | P0 | implicit random/seed 重启漂移 | core 删除 fallback；client host-on-confirm 生成并持久化 seed | `AC-SEED-001..009` 正式 fixture |
| R3 | P0 | 缓存读回被误报为 durable ack | journal `requires-flush`；无 attestation 默认阻断 | 真机强杀/配额/延迟证据与具名边界 |
| R4 | P0 | 原始坏档在拒绝前被改写或丢失 | codec 保留原 text/bytes；当前不执行导入提交 | `AC-SAVE-001..012` 与 rejected 三件套 |
| R5 | P0 | 22 MB 图片进入主包或 revision 混用 | 187 项 checksum manifest、AssetPort 强制 revision、资源审计；remote-only Creator preset；真实 NON_RELEASE Creator 输出已通过布局/trace/tree-hash 门禁，确认资源不进入 `assets/resources` | production Creator output、CDN hash 与弱网/缓存真机证据 |
| R6 | P0 | scene/meta 与 3.8.8 序列化或运行装配不兼容，或 package 更新后旧 preview bundle 被误当成当前候选 | 真实 Creator 生成的 212 metadata；UUID/压缩 class ID/唯一 Canvas 自动校验；真实 prerequisite import 无解析错误；shim 不进入 assets；干净重开后无 Missing Script 且自然 preview 通过 | 真实 AppID build；每个候选重开工程并重新生成 preview，禁止用单纯刷新旧端口作为证据 |
| R7 | P0 | 小屏遮挡、触控过小或只靠颜色表达 | host safe-area 换算；104 design-px compact gate；浅色 accent 对比度断言；符号/标签/图案；390×844 设备档位自然 trace | 320 档位与至少两台真机截图/触控 trace |
| R8 | P0 | “registry 有效”被误报为迁移通过 | verifier 只输出 `MANIFEST_VALID`；状态表固定 0/94 正式 leaf PASS | 94 leaf→6 release→2 attestation→1 derived 证据链 |
| R9 | P1 | 委托/记忆/章节专属 UI 被首章与大厅切片掩盖 | 8 个聚焦大厅面板已接真实 reducer；presentation `COVERAGE.md` 明列仍未投影功能 | 后续屏幕逐项 runner/UX 验收 |
| R10 | P1 | Node/TS/Creator/DevTools/基础库漂移或最终校验后路径替换 | Node/npm/TS 精确 lock + doctor；主 Mach-O 保留 FD/SHA/CDHash；`START_SUSPENDED` 后核对 loaded CDHash 与 `CS_VALID|CS_KILL`；匿名只读 config FD；真实模板构建已消费 `/dev/fd/198`；确定性 interposition gate；不把导入后已产生额外缓存、当前 deep-strict 失败的完整 bundle 冒充已冻结边界 | production 构建、完整 bundle 资源取证与 DevTools/基础库候选矩阵 |

## 4. 下一道门禁

1. Creator 3.8.8 导入、`typecheck:creator`、无 Missing Script、首章自然 preview、两个
   Editor fragment 合成和真实 NON_RELEASE remote 构建已完成；但这些证据早于章节决策
   切片，当前代码尚未在真实 Creator Preview/微信开发者工具重跑（本机锁定，验证未
   执行），解锁后须先清缓存重编重跑，再决定远程资源服务器，使用 renderer 生成含
   真实 AppID 与版本化 HTTPS server 的 production 配置。
2. 在 clean candidate 上执行 `build:wechat`，冻结构建日志、产物 hash、工具版本、manifest
   revision 和包体报告，并把 `remote/resources` 精确上传到已加入微信白名单的 CDN。
3. 用微信开发者工具与真机验证首章 trace、安全区、触控、强杀、弱网、缓存和低内存。
4. 将 Creator preview/template build 绑定到 registry case；在现有
   `test:migration -- --ac` 基础上补 content/law/persistence fixture，并在 clean commit 后
   把首批 9 项 PASS 写入仓外独占
   candidate evidence，再立即转存到不同 owner 的 WORM/签名存储。

在这些门禁完成前，发布状态保持 `BLOCKED`。
