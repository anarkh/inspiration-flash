# 状态与风险

核对日期：2026-11-10，游戏版本 0.1.31。本文描述当前工程证据，不是发布验收报告。

一句话：玩法和数值已迭代到 0.1.31，自动化检查全部通过；微信侧只完成了本地 NON_RELEASE 构建，
主包已压到上限以内，但真实 AppID 构建、CDN、真机和正式验收都还没有开始。发布状态保持 `BLOCKED`。

## 1. 当前状态

| 工作流 | 状态 | 当前可重复结果 | 尚未声明 |
| --- | --- | --- | --- |
| Web oracle | 已冻结 | 源 revision `2645f0232542684d27de1abc321bb26913320420`；迁移工作未改 `infinite-flow/src` | 2026-10-23 起玩法有意偏离 Web 基准（战后回血、术法耗战意、追兵与灯油、比例防御等），Web 不再是这些规则的对照；偏离的 20 个验收用例已显式废弃并由现行规则用例替代 |
| core | 包级完成 | 50 个规则模块加 19 章关卡数据；65 件装备、59 种怪物、19 个首领；显式 seed、DOM-free、Node ESM 与确定性 seed 门禁 | 未绑定正式 `AC-CONTENT` vectors |
| 玩法与数值 | 0.1.31 | 玩法评审 10 项改动（`docs/05`）与数值改造 5 个 PR（`docs/06`）已合入；`npm run balance:sim` 的典型玩家机器人与每章跳章存档都能一次通关 19 章 | 只有机器人数据和开发者短时试玩，没有完整真人通关记录；困难 / 炼狱协议未校准；选路取舍、音效、逐章引导未做（见 `docs/05`） |
| runtime | 包级完成 | canonical JSON/SHA-256、seed lineage、串行 session、ledger/state revision、tmp/formal/backup、256 receipt retention、suspend/resume 和故障注入自检 | generic/fake storage 不能证明微信真机 durable boundary |
| Web v1 codec | 包级完成 | 严格 UTF-8/BOM、原始 text/bytes 保留、兼容 sanitizer、legacy seed 报告、checksum fixture；新增存档字段（阶位、铭刻、淬炼、灵蕴兑换计数等）均有读回测试 | 仅 preview/decode；尚无 rejected payload/reason/index 三件套 durable commit |
| application/client | 19 章完成 | 54 种可序列化命令；phase guard；显式入场 seed；物理输入去重；生命周期注册失败与销毁均回滚清理；包级测试 40 个文件 | schema-v2 invariant/import 仍不完整 |
| presentation | 19 章完成 | 四 phase 单一 ViewModel；大厅 8 个面板、角色六页签、11 种手机弹层、五态地图、23 项帮助、章节法则 / 指令 / 路线契约 / 压力 / 追兵、战斗意图与伤害预览；动作全部由 reducer 预检 | 无 |
| Cocos scene/UI | Web 预览完成 | 庭院行走、19 章房间、独立战斗舞台与特效；headless 门禁：启动与生命周期 153 场景、行走 50 项、弹层 3652 个 ViewModel；每个 UI 改动在真实引擎（web-mobile，无头 Chrome）查看 320×568 与 390×844 | 0.1.19 起的版本没有在微信开发者工具或真机运行的记录；`cocos:web-mobile:smoke` 脚本已落后于现有界面，未修 |
| 微信平台适配 | 包级完成 | 双槽整键空间 journal、安全 seed 预填充、六个必需 lifecycle 能力、AssetPort/loader；137 项断言 / 4 个 suite | 默认 flush 明确 `durability-unattested`；真实 CDN/弱网/缓存/低内存与强杀/配额/延迟真机签核缺失 |
| 资源 | Creator 快照完成 | 324 key = 324 PNG；396 个 Creator metadata/UUID 一一对应；revision `sha256:66666c18678a4db1ca2b93db19265f911dfb44e4370b777d6d21348eebed747f`；`resources-remote-wechat-v1` 把微信资源固定为 remote，`config` 留在本地 | 源 PNG 共 344,175,419 bytes（怪物全身图 143 MB、房间底图 71 MB），未降采样或压缩纹理；无真实 CDN 上传、白名单或设备缓存 / 弱网验证 |
| 微信构建 | 本地 NON_RELEASE | 2026-11-10 Creator 3.8.8 命令行构建（`platform=wechatgame;debug=false`，游客 AppID）：主包 3,545,973 bytes（3.38 MiB），低于 4 MiB 上限；远程 resources 约 331 MB；已派生 DevTools 试玩副本，自检 38 项通过 | 派生副本尚未在微信开发者工具里打开；最近一次带凭证模板的严格构建（`build:wechat:template`）是 2026-08-12，早于现有资源与界面；无真实 AppID/CDN 的 production 构建 |
| 工具链 | 已固定 | Node 26.7.0、npm 11.19.0、TypeScript 5.9.3 精确门禁；六包 ES2020 语法 / 内建门禁；Creator 3.8.8 executable 取证与 36 项合同 gate；展开运算符降级门禁 | production 配置与 clean-candidate 构建；完整 `.app` bundle 取证 |
| 验收 | registry 与部分 runner | 123 = 114 leaf（20 个废弃，有效 94）+ 6 release-evidence + 2 attestation + 1 derived；48 个可执行 fixture；有效 leaf 中普通 runner 28 PASS / 66 BLOCKED；runner 合同 1289 项断言 / 21 个 suite | 普通执行不构成 evidence；正式 acceptance leaf PASS 仍为 0/94，下游 6 + 2 + 1 均未放行；无独立 CI/WORM、正式 smoke 或真机 evidence |

任何包级测试、机器人数据或 Web 预览成功都不得提升为正式 AC PASS。

## 2. 当前 P0 阻断

1. **目标平台落后**：0.1.19–0.1.31 只在电脑 Chrome 的 web-mobile 预览里验证过。下一步先在微信
   开发者工具导入 `cocos/build/wechatgame-devtools-smoke` 跑通首章，再做真机预览（需要测试号或
   真实 AppID；游客号不能真机预览）。
2. **资源交付**：远程资源约 331 MB，首次进入一章要下载该章底图和怪物全身图（单张约 2–4 MB）。
   上 CDN 前需要降采样或压缩纹理并定下每章下载预算；之后确定 CDN/HTTPS 域名与微信白名单，
   上传并核对远端树 hash，验证 revision 缓存、弱网、失败 fallback 和低内存释放。
3. **Creator 生产构建**：需要真实 AppID/CDN，在 clean candidate 上执行 `build:wechat` 并归档
   production 产物与日志。production 门禁会按 4 MiB 复核主包。
4. **持久性签核**：微信同步写入 + 读回只形成 candidate，不是强杀后 durable 证明。必须在真实设备
   完成强杀 / 空间不足 / 延迟矩阵后，才能注入具名 `WxDurabilityBoundary`；否则运行时保持阻断。
5. **存档迁移封口**：Web v1 codec 已能保真 decode，但 import/rejected index、raw
   payload/reason/index 三件套和完整 schema-v2 invariant gate 尚未实现。
6. **验收 evidence**：尚无 clean candidate 的正式 leaf evidence、release evidence、双签
   attestation 或最终只读 derived evidence；正式 leaf 仍为 0/94。

已解除：**主包体积**。2026-08-12 模板构建主包为 6,798,993 bytes，0.1.30 为 7,268,131 bytes。
0.1.31 把引擎裁剪到 2D 游戏实际使用的 9 个模块，并去掉场景里默认天空盒贴图的引用，主包降到
3,545,973 bytes。`npm run scene:verify` 固定这两项，防止回退。余量约 0.6 MiB，其中游戏代码
约 1.8 MB 且会继续增长；再超限时启用引擎分离插件（需要真实 AppID）或把游戏代码移入分包。

## 3. 风险登记

| ID | 严重度 | 风险 | 当前控制 | 关闭证据 |
| --- | --- | --- | --- | --- |
| R1 | P0 | 目标端形成第二套规则 | 规则只在共享包，Cocos 只消费 ViewModel；公开 package 边界 | 同 candidate 的现行规则 vectors |
| R2 | P0 | implicit random/seed 重启漂移 | core 删除 fallback；client host-on-confirm 生成并持久化 seed | `AC-SEED-001..009` 正式 fixture |
| R3 | P0 | 缓存读回被误报为 durable ack | journal `requires-flush`；无 attestation 默认阻断 | 真机强杀 / 配额 / 延迟证据与具名边界 |
| R4 | P0 | 原始坏档在拒绝前被改写或丢失 | codec 保留原 text/bytes；当前不执行导入提交 | `AC-SAVE-001..012` 与 rejected 三件套 |
| R5 | P0 | 344 MB 图片进入主包、revision 混用，或首次下载过大 | 324 项 checksum manifest、AssetPort 强制 revision、remote-only Creator preset；主包 4 MiB 门禁 | 降采样 / 压缩后的 production 输出、CDN hash 与弱网 / 缓存真机证据 |
| R6 | P0 | 微信构建或降级与 Web 预览行为不一致（曾出现展开运算符被降级成错误代码） | `spread:verify` 门禁；NON_RELEASE 构建与 DevTools 试玩副本 | 每个候选在 DevTools 和真机重跑首章 |
| R7 | P0 | 小屏遮挡、触控过小或只靠颜色表达 | host safe-area 换算；104 design-px 触控门禁；对比度断言；320×568 与 390×844 真实引擎截图 | 至少两台真机截图 / 触控 trace |
| R8 | P0 | “registry 有效”或“机器人通关”被误报为验收通过 | verifier 只输出 `MANIFEST_VALID`；状态表固定 0/94 正式 leaf PASS | 94 leaf → 6 release → 2 attestation → 1 derived 证据链 |
| R9 | P1 | 数值只由机器人校准，真人体验可能不同；困难 / 炼狱未覆盖 | `balance:sim` / `report --check` / `trial`；怪物数值只经 `balance:fit` 与 `balance:calibrate` 生成 | 真人完整通关记录；机器人覆盖困难与炼狱 |
| R10 | P1 | Node/TS/Creator/DevTools/基础库漂移 | Node/npm/TS 精确 lock + doctor；Creator executable 取证 | production 构建与 DevTools / 基础库候选矩阵 |
| R11 | P1 | 主包余量只有约 0.6 MiB，新增代码或引擎模块会再次超限 | `scene:verify` 固定引擎模块清单与天空盒；production 门禁复核 | 引擎分离或代码分包后的 production 构建 |

## 4. 下一道门禁

1. 在微信开发者工具导入 0.1.31 的试玩副本（步骤见 `docs/04-devtools-smoke.md`），跑通首章；
   取得测试号或真实 AppID 后做真机预览，记录加载时间、内存和触控问题。
2. 资源降采样 / 压缩纹理，定下每章下载预算，重新生成 manifest 与 revision。
3. 决定远程资源服务器，用 renderer 生成含真实 AppID 与版本化 HTTPS server 的 production 配置；
   在 clean candidate 上执行 `build:wechat`，冻结构建日志、产物 hash、工具版本、manifest revision
   和包体报告，并把 `remote/resources` 上传到已加入微信白名单的 CDN。
4. 用真机验证首章 trace、安全区、触控、强杀、弱网、缓存和低内存，完成持久性签核。
5. 把现有 runner 的 28 项 PASS 在 clean commit 后写入仓外独占 candidate evidence，并补
   content/persistence fixture。

在这些门禁完成前，发布状态保持 `BLOCKED`。
