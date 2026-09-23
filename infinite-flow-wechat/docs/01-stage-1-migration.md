# 首阶段迁移说明

## 1. 目标

首阶段为 Cocos/微信小游戏建立一条可持续迁移的基线：保留 Web 版本作为行为 oracle，把可复用的 TypeScript 领域源码放入无浏览器依赖的核心包，建立平台运行时端口，并冻结完整验收合同。在该边界上，当前又完成了阶段二的首章代码竖切和一条 Creator 3.8.8 自然 UI 路线；它证明共享边界可组合命令、ViewModel、静态 Cocos 场景与真实预览交互，仍不构成完整视觉还原、微信真机或发布就绪证据。

## 2. 不可改变的原则

1. 同一初始状态、seed 和命令序列必须得到相同领域状态与结算。
2. 稳定 ID、内容目录、规则、冻结快照、存档兼容语义和资源 key 来自 Web 权威源；Cocos 组件不得复制路线门、奖励或章节法则。
3. DOM、CSS、`localStorage`、Blob、浏览器 `Image`、Vite URL 和点击事件细节属于 Web 壳，不进入共享规则。
4. 领域规则、codec 和 UI 不得用 `Math.random()`、时钟或设备信息补 seed；随机链由 session 注入且持久化。
5. 迁移 scaffold、类型检查或可启动场景都不是验收 PASS。只有对应 AC 的行为、故障和设备证据完整才可放行。

## 3. 首阶段工程边界

```text
infinite-flow-wechat/
  packages/
    core/          Web 领域源码的可追溯快照；无 DOM、无平台写入口
    runtime/       端口、seed、canonical JSON、durable session 与测试适配器
    application/   可序列化命令、phase guard 与纯 reducer
    save-codec/    Web v1 raw 的保真兼容解码
    client/        session/seed/输入/生命周期的唯一编排边界
    presentation/  四 phase 只读 ViewModel、完整帮助与移动端令牌
  acceptance/      103 项稳定验收 registry 的独立冻结副本
  scripts/         工具链、Creator 构建、源码/资源/场景/平台与 registry 门禁
  docs/            迁移、工具链、状态与风险
  cocos/           Cocos Creator 3.8.8 场景、首章表现层与微信适配
```

`packages/core` 的首批快照机械迁入 Web 的 63 个非测试运行时模块（含 `level-data`），排除 DOM 入口 `main.ts`、平衡模拟入口和浏览器输入守卫；对外索引、无 DOM TypeScript 配置与来源说明由目标包单独维护。快照不是永久 fork：后续应通过来源指纹或明确同步记录审计差异。

`packages/runtime` 现已提供零运行时依赖的 ESM TypeScript 基础：平台端口、版本化 seed 派生、canonical JSON/SHA-256、串行 session、state/ledger 双 revision、tmp/formal/backup 恢复、最新 256 条 receipt 和内存/故障注入存储。相邻的 `save-codec` 已完成 Web v1 保真 decode，但 rejected/import 三件套 durable commit 与完整 schema-v2 invariant 仍未闭合。

`application` 已提供首章命令面，并用 reducer/headless 脚本演练主要阶段；该自动演练会直接注入部分玩家/怪物 HP 和回响候选，本身不是自然平衡路线。`client` 独立验证唯一 session、显式入场 seed 和物理输入去重。另有一条 Creator 3.8.8 预览通过真实 client/session 与 UI、无状态注入完成新档大厅到归档返回；它仍是人工 smoke，尚未冻结为可复算的端到端 runner 或 registry evidence。`presentation` 生成只读 ViewModel，Cocos 静态场景只消费该边界；领域规则不复制到组件。

`cocos/assets/resources` 的首批资源快照恰含 187 个稳定 key 对应文件，并以 checksum-bearing manifest 绑定来源和目标路径。185 个 PNG 与 Web 源逐字节一致；`dungeon:mirror_cycle_city` 与 `scene:main_god_space` 的两个权威 SVG 已生成可重复、带来源/目标 checksum 与工具版本的 PNG 派生物。目标目录现为 187 个 PNG，权威 SVG 仍只保留在 Web 源中，没有被静默覆盖。

## 4. 来源到目标的映射

| Web 权威源 | 首阶段目标 | 规则 |
| --- | --- | --- |
| `src/game.ts` 与领域模块 | `packages/core/src/` | 机械快照优先；只为消除平台依赖做可审计改动 |
| `src/level-content.ts`、`src/level-data/*.ts` | `packages/core/src/` | 保持章节顺序、稳定 ID、节点和真实边 |
| `src/dungeon-feature-help.ts` | core/content 导出 | 保留完整字段，不因小屏删语义 |
| `src/game-assets.ts` | core 元数据，后续接 `AssetPort` | key 与 revision 稳定，路径由 Cocos 适配 |
| `main.ts` 的存档/动作/UI 混合逻辑 | `save-codec`、runtime、application/client、presentation/Cocos | 不整体复制，不让组件持有可写领域副本 |
| `docs/knowledge-base/migration-acceptance-manifest.json` | `acceptance/` | 独立复制 103 项，保持 ID、fixture 与精确预期 |

## 5. 首阶段工作流

### 5.1 冻结并核对 oracle

- 记录 Web 基线的 git SHA、package/content/rules/help/asset revision。
- 复用现有 Web 单测、类型检查、构建、资源审计和 UI smoke 日志。
- 把历史 `infinite-flow:save:v1` raw、关键状态和确定性向量列为后续 fixture 输入。

### 5.2 建立无平台核心

- 核心 TypeScript 不可达 `window`、`document`、DOM、Vite、微信 API、时钟和隐式随机。
- 保留稳定 ID 与数组顺序；不得从显示名、资源文件名或 Cocos 节点路径推导身份。
- 任何为 Cocos 编译所做的源码改动都要能说明与 Web oracle 的差异，并补双端向量。

### 5.3 建立运行时协议

- 端口应覆盖 storage、seed、asset、input、lifecycle 与 legacy raw transfer 的目标协议。
- session 是未来领域修改和 `commandId` 生成的唯一入口；UI 只发送不带持久 ID 的 intent。
- canonical hash 与 envelope checksum 是两个协议；不得混用或删字段求相等。

### 5.4 建立验收合同

- registry 固定 94 个 leaf、6 个 release-evidence、2 个 attestation、1 个 derived。
- 校验器必须在 manifest 缺失、JSON 损坏、零 case、计数/分区错误、重复 ID、未知 `--ac` 时失败。
- 首阶段不生成 `leaf-evidence.json` 或 `final-evidence.json`；没有 runner/fixture 的 AC 保持未执行。

## 6. 退出条件

首阶段需同时满足：

- 目标项目与 Web 项目互不覆盖，Web oracle 仍可独立运行。
- core 可在无 DOM TypeScript 配置下通过编译，并有来源/漂移说明。
- runtime 基础自检通过，且文档明确尚未闭合的 v2 协议。
- Cocos/微信壳能引用共享包时，不把平台对象泄漏进领域层。
- 187 项目标资源与 Web manifest 一一对应；两个 SVG 的 PNG 派生链路可审计、可重复，所有目标文件都可进入 Cocos 图片导入。
- manifest 校验正向通过，`--list` 得到 103 项，已知 ID 可选中；未知 ID、缺文件和零 case 均非零退出。
- [状态与风险](03-status-and-risks.md) 与实际工作区一致，不把 scaffold 写成发布结论。

Web v1 codec、`GameSession` 持久化基础，以及覆盖新档大厅 → 妖塔整备 → 入场 → 探索 → 普通战斗 → Boss 双阶段 → 出口结算 → 回响归档 → 返回大厅各阶段的分层代码竖切已经建立；同日较早的无状态注入新档也通过真实 UI 完成了携行、普通战斗、血字阶梯基础解法、相邻地图与四处奖励、雾锋回响、Boss 封印/觉醒、出口、归档及返回大厅的完整路线。2026-08-11 的真实 Creator 3.8.8 视觉接线取证在“Developer → 清除代码缓存”后重编并启动 `http://localhost:7456`：config bundle manifest UUID 为 `3d0842ec-43f7-4b5f-961f-39edb535ccd7`、revision 为 `sha256:91b2f75d946411a2ac16d0a313336ba97bd395f652e55aa625fa940c396525b2`，resources bundle 为 `resources`；本轮三段视觉接线复验依次为开发预览就绪的 `scene:main_god_space`、确认入场后的 `dungeon:demon_tower_1`（revision 1）、迎战后的 `monster:fog_lesser_demon`（revision 2）。三段 View 均有 SpriteFrame/Texture，`lastVisualBootstrapFailure=null`，控制台无 warning/error，且无 Missing Script；它只证明当前 bundle/manifest/ImageAsset 接线，不替代前述完整玩法路线。真实回调的 `error===undefined` 成功态误判已修复，headless 已补成功回归。2026-08-12 又用两个官方 Editor fragment 合成配置并完成真实 Creator 3.8.8 NON_RELEASE 微信构建：187 项资源只进入 `remote/resources`，本地主包不存在 `assets/resources`，版本脚本留在 `src/bundle-scripts/resources`，`config` 保持本地；模板 sentinel 仍不构成 production。下一道门禁是真实 AppID/CDN 的 clean-candidate 构建、微信开发者工具及真机强杀/配额/延迟/安全区/触控/弱网/低内存验证。人工 Preview 与模板构建均尚未绑定 registry case，正式 acceptance leaf PASS 为 0/94；不得将其称为发布或真机证据。
