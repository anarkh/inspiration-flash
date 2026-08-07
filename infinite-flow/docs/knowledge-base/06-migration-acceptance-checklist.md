# 小游戏迁移验收清单

本清单是 v2 发布门禁，不是当前 Web v1 已完成功能的声明。每个 `AC-*` 是永久、不可复用的稳定验收 ID；语义变化时新增 ID 并废弃旧 ID，禁止让同一 ID 悄悄改义。本文所有条目均为 **P0 阻断**，任一失败、跳过、无证据或仅凭“画面看起来一致”都不得宣布迁移完成。

## 0. 范围、执行方式与证据协议

### 0.1 Web v1 与 v2 的边界

- **Web v1 当前兼容范围**：作为内容、规则结果和 UI 行为 oracle；运行现有 Vitest、资源审计与浏览器 smoke；从历史 `infinite-flow:save:v1` 提取 raw fixture。
- **Web v1 已知不满足 v2 的部分**：领域入场/传送仍可能隐式随机；没有唯一 `GameSession`、`commandId`、state/ledger 双 revision、持久化 ack、三 key 强杀恢复和跨平台 raw 转移端口。
- **v2 目标范围**：共享 model/content/rules/save-codec/session，加目标端适配器与语义等价 UI。表中 `test:migration`、`smoke:minigame` 和设备 fixture 是必须新增的目标门禁；脚本或 fixture 尚不存在本身就是失败，不能用 Web v1 测试代替。

### 0.2 验证方式

| 方法 | 执行命令/动作 | 通过条件 |
| --- | --- | --- |
| `A-WEB` | `cd infinite-flow && npm test -- --run && npm run typecheck && npm run build && npm run assets:audit && npm run smoke:ui:all` | 当前 Web oracle 全绿，原始日志归档 |
| `A-AC` | `cd infinite-flow && npm run test:migration -- --ac <AC-ID>` | 指定 AC 的双端/golden/fault fixture 全绿；未知 AC 或 0 用例必须非零退出 |
| `A-LEAF` | `cd infinite-flow && npm run test:migration -- --leaf-manifest docs/knowledge-base/migration-acceptance-manifest.json --evidence artifacts/migration/<candidate>/` | 编排 leaf 的自动子方法并核验已有 A-SMOKE/M-DEVICE 证据，不能替代人工执行；94 个 leaf 全部 PASS 后冻结唯一 `leaf-evidence.json` |
| `A-RELEASE` | `cd infinite-flow && npm run test:migration -- --release <AC-ID> --leaf-evidence artifacts/migration/<candidate>/leaf-evidence.json` | 只执行指定 release-evidence/attestation case，绑定已冻结 leaf 证据，不枚举或验证自身 |
| `A-DERIVE` | `cd infinite-flow && npm run test:migration -- --derive-final --evidence artifacts/migration/<candidate>/` | 只读 registry、leaf/release/attestation 三份冻结输入，验证其余 102 项并原子生成独立、不可变的 `final-evidence.json`；它只含派生的 `AC-RELEASE-001` 与输入 hash，不执行或检查自身，也不修改任何输入 |
| `A-SMOKE` | `cd infinite-flow && npm run smoke:minigame -- --ac <AC-ID> --device <profile>` | 目标端可重复脚本通过，保留视频/截图、输入轨迹和状态 hash |
| `M-DEVICE` | 按 fixture 文档在真实设备执行，双人复核 | 步骤、设备/系统/包 revision、期望/实际、截图或视频齐全 |
| `R-REVIEW` | 产品、规则、存档、UI/无障碍责任人对固定 subject digest 签名 | 四视角无未关闭 P0/P1；签名不写回被签的 leaf/release 证据 |

每行的“fixture”是稳定 fixture ID，不要求等同文件名；实现时在 `test:migration --list` 中一一注册。稳定 ID 的独立注册表是 [migration-acceptance-manifest.json](migration-acceptance-manifest.json)：它固定 94 个 leaf、6 个 release-evidence、2 个 attestation 和 1 个 derived ID。本文表格与 registry 的 ID、优先级、分区、方法、fixture 和精确预期必须逐项一致，不能只从本文自动发现一个变小后的集合。

自动项证据至少记录 `AC ID / git SHA / package version / contentVersion / rulesVersion / manifestRevision / fixture ID / command / exit code / canonical before+after hash / stdout+stderr 路径`。人工项至少记录前述版本字段、设备型号/系统/分辨率、执行人和复核人、时间、逐步期望/实际、截图/视频路径。所有证据写入 `artifacts/migration/<candidate>/<AC-ID>/`；证据不得只存在聊天、口头结论或会过期的临时链接中。

证据按不可变阶段生成：

1. `A-LEAF` 只执行 94 个 leaf，输出唯一 `leaf-evidence.json`，绑定 `acceptanceManifestSha256` 和完整 candidate identity。每次重跑创建新 candidate 目录，不能用“最新时间”覆盖旧证据。
2. `AC-RELEASE-002..007` 只读上述 leaf hash，全部完成后冻结 `release-evidence.json`；它恰含 6 个 PASS，并绑定同一 candidate/spec/leaf hash。
3. 四视角签署固定 subject：`candidate + acceptanceManifestSha256 + leafEvidenceSha256 + releaseEvidenceSha256`。只有 `AC-RELEASE-008/009` 及签名写入独立 `attestation.json`，随后冻结；签名不会改变被签的 leaf/release 输入。
4. `A-DERIVE` 只读 registry 和上述三份冻结证据，复算各 hash 后原子创建唯一 `final-evidence.json`。该文件只记录 `AC-RELEASE-001`、四个输入 hash、candidate identity 与派生结果，绝不回写 `attestation.json`；其自身 hash 由发布系统外部记录。

### 0.3 结果规则

- `PASS`：期望完全满足且证据完整；`FAIL`：行为不符；`BLOCKED`：环境/脚本/fixture 缺失；`SKIPPED`：未执行。只有 `PASS` 可放行。
- 单个 AC 需要多种方法时必须全部通过。修复后重跑受影响 AC 和其依赖项，并生成新的 leaf/release/attestation/final 证据链；旧证据保留但标记 superseded。
- fixture 必须断言领域状态/事件/持久化 raw/hash；UI smoke 不得取代规则断言，单测也不得取代真实设备生命周期与触控验证。

## 1. 内容、历史兼容与稳定身份

| AC ID | 验收项 | 方法 | fixture | 精确预期 |
| --- | --- | --- | --- | --- |
| `AC-CONTENT-001` | 19 章目录 | A-AC | `catalog-19-dungeons` | `DungeonId` 与 `DUNGEON_ORDER` 恰含 19 章且顺序一致 |
| `AC-CONTENT-002` | 章节元数据与地图 | A-AC | `catalog-chapter-metadata` | 每章名称、题材、推荐战力、主题、起点、节点和真实相邻边与 oracle 相同 |
| `AC-CONTENT-003` | Boss 与出口 | A-AC | `catalog-boss-exit` | 每章 Boss、双阶段、掉落、Boss 门与出口封印一致 |
| `AC-CONTENT-004` | 全内容数量 | A-AC | `catalog-counts` | 30 道具、65 装备、59 怪物、6 宠物、7 功法、4 血统、3 同伴、9 回响均可按稳定 ID 读取 |
| `AC-CONTENT-005` | 装备记忆组合 | A-AC | `equipment-memory-matrix` | 19 记忆、58 可承载装备、1102 组合完整一致 |
| `AC-CONTENT-006` | 隐藏路线契约 | A-AC | `route-contract-catalog` | 57 契约完整且每章恰为 3 个 |
| `AC-CONTENT-007` | 任务与指令 | A-AC | `task-directive-catalog` | 63 主神任务与 19 主神指令完整 |
| `AC-CONTENT-008` | 稳定 ID | A-AC | `stable-id-localization-rename` | 改显示名/本地化/文件名不改变任何持久化 ID |
| `AC-COMPAT-001` | 遭遇替换 | A-AC | `web-v1-two-encounter-aliases` | 两个旧遭遇 ID 均迁到指定新遭遇，奖励/清理状态不重复 |
| `AC-COMPAT-002` | 旧装备追猎 | A-AC | `web-v1-equipment-hunt` | 旧追猎状态可解释、恢复并按旧语义结算 |
| `AC-COMPAT-003` | 旧单功法快照 | A-AC | `web-v1-methodSnapshot` | `methodSnapshot` 迁移到兼容视图，不从大厅重抓 rank |
| `AC-COMPAT-004` | 缺失冻结快照 | A-AC | `web-v1-missing-run-snapshots` | 仅禁用本局对应系统，永久进度和其他 run 状态不重置 |
| `AC-COMPAT-005` | 历史 key/未来版本 | A-AC | `key-scan-v1-and-future` | 能发现 `save:v1`；未知未来版本被拒绝且原文不覆盖 |

## 2. 状态、session 与入场冻结

| AC ID | 验收项 | 方法 | fixture | 精确预期 |
| --- | --- | --- | --- | --- |
| `AC-STATE-001` | phase 组合 | A-AC | `state-phase-matrix` | `phase/run/combat/lastOutcome` 及 combat 所属 encounter node 的所有可达组合合法，非法命令无状态变化 |
| `AC-STATE-002` | 数值不变量 | A-AC | `state-numeric-boundaries` | HP 在 `0...派生 maxHp`；货币、库存、材料为非负安全整数；所有等级/品阶在各自 `1...catalog max` |
| `AC-STATE-003` | 装备不变量 | A-AC | `state-equipped-owned` | 已装备项均已拥有且等级合法 |
| `AC-STATE-004` | 恰好一次领取 | A-AC | `state-idempotent-rewards` | 节点、任务、指令、候选和结算不能重复领取 |
| `AC-STATE-005` | 派生战力 | A-AC | `state-power-oracle` | 全套边界 fixture 与 Web oracle 数值一致 |
| `AC-STATE-006` | UI 无领域副本 | A-AC,A-SMOKE | `ui-no-writable-domain-copy` | 路线门、法则、任务完成态只来自 session state |
| `AC-SESSION-001` | 唯一写入口 | A-AC | `session-only-dispatch` | 客户端领域修改只经 `GameSession.dispatch(): Promise<DispatchResult>` |
| `AC-SESSION-002` | 串行与去重 | A-AC | `session-commandid-race` | session 是 ID 唯一生成方；快速输入串行；拒绝后序号连续；有 receipt 的重复返回原 revision，已淘汰但不高于 watermark 的重复返回当前 durable revision 且 events 为空；跳号、异 epoch、坏格式和重启重试均不重跑 reducer |
| `AC-SESSION-003` | revision | A-AC | `session-revision-monotonic` | 成功状态变更的 `stateRevision` 恰好 `+1`；首次 committed/rejected 的 `ledgerRevision` 恰好 `+1`；rejected 不增 stateRevision，duplicate 两者都不增；旧 revision 不覆盖新 revision |
| `AC-SESSION-004` | hub-only 双守卫 | A-AC | `session-hub-command-phase-matrix` | 购买、装备、整备、升级、领奖、入场在 session 与 reducer 两层拒绝非 hub 调用 |
| `AC-FREEZE-001` | 协议与地图 | A-AC | `freeze-protocol-inferno` | 难度、协议、炼狱层、seed lineage 和地图入场冻结 |
| `AC-FREEZE-002` | 携行与战利品 | A-AC | `freeze-tactical-loadout` | 大厅库存变化不改变当前 run 可用类型，携行与战利品分离 |
| `AC-FREEZE-003` | 回响与导管 | A-AC | `freeze-relic-conduit` | 框架、种子、导管、pending draft、器魂与共享 charge 可恢复且不回填 |
| `AC-FREEZE-004` | 成长快照 | A-AC | `freeze-growth-snapshots` | 同伴/功法/血统及各 rank 入场冻结 |
| `AC-FREEZE-005` | 装备来源 | A-AC | `freeze-equipment-sources` | 铭刻勘探、装备记忆、章节被动与 Boss 快照不从大厅回填 |
| `AC-FREEZE-006` | 宠物实时语义 | A-AC | `pet-live-active-and-capture` | 宠物不臆造 run 快照；战斗读取顶层 `activePet/petLevels`，局内捕获切 active 后可在本局后续战斗即时生效 |

## 3. 探索、地图与 19 章法则

| AC ID | 验收项 | 方法 | fixture | 精确预期 |
| --- | --- | --- | --- | --- |
| `AC-MAP-001` | 合法移动与可见性 | A-AC,A-SMOKE | `map-edge-visibility` | 只能沿合法边；当前位置/相邻/侦察/清理/未侦察五态可区分，相邻名称和类型可见 |
| `AC-MAP-002` | 路线门 | A-AC,A-SMOKE | `map-route-gate-reason` | 关闭时显示真实原因而非迷雾；Boss 门与出口封印分别结算 |
| `AC-MAP-003` | 侦察与 pending | A-AC,A-SMOKE | `map-scout-pending` | 已侦察不退回问号；pending 只锁移动，不锁帮助、角色、任务和撤退 |
| `AC-MAP-004` | 侵蚀与追兵 | A-AC | `map-pressure-pursuit` | 侵蚀仅在非出口首次清理推进；追兵路径、接触、宽限、收容、Boss 融合一致 |
| `AC-MAP-005` | 隐藏契约顺序 | A-AC | `map-route-contract-order` | 契约必须 1→2，失败不阻主线且不重复奖励 |
| `AC-LAW-01` | 第 1 章妖塔 | A-AC,A-SMOKE | `law-01-demon-tower` | 雾压、恢复地标、高雾侧路和门禁与 oracle 状态/事件一致 |
| `AC-LAW-02` | 第 2 章地铁 | A-AC,A-SMOKE | `law-02-metro` | 潮序循环和信号校准一致 |
| `AC-LAW-03` | 第 3 章矿井 | A-AC,A-SMOKE | `law-03-mine` | 重力切换、陷阱与防御修正一致 |
| `AC-LAW-04` | 第 4 章病院 | A-AC,A-SMOKE | `law-04-hospital` | 污染、治疗削弱与净化路线一致 |
| `AC-LAW-05` | 第 5 章竞技场 | A-AC,A-SMOKE | `law-05-arena` | 力/术/守记录、重复受罚与三式改判一致 |
| `AC-LAW-06` | 第 6 章梦档案馆 | A-AC,A-SMOKE | `law-06-dream` | 道具/功法/宠物封存及重置一致 |
| `AC-LAW-07` | 第 7 章虚界城 | A-AC,A-SMOKE | `law-07-virtual` | 战斗开局分布冻结并正确克制偏科 |
| `AC-LAW-08` | 第 8 章时序 | A-AC,A-SMOKE | `law-08-chronal` | 双锚分别与共同开放路线一致 |
| `AC-LAW-09` | 第 9 章因果账本 | A-AC,A-SMOKE | `law-09-causal` | 平衡/透支/偿还与追缴印一致 |
| `AC-LAW-10` | 第 10 章熵海 | A-AC,A-SMOKE | `law-10-entropy` | 三航向、熵值和崩解层一致 |
| `AC-LAW-11` | 第 11 章镜城 | A-AC,A-SMOKE | `law-11-mirror` | 三相位、切换生命代价、锚点和镜壳一致 |
| `AC-LAW-12` | 第 12 章删界 | A-AC,A-SMOKE | `law-12-redaction` | 三条款核准/删去、关区与 Boss 快照一致 |
| `AC-LAW-13` | 第 13 章拍卖 | A-AC,A-SMOKE | `law-13-auction` | 四拍品竞得/焚毁/放弃、动态价格与继承一致 |
| `AC-LAW-14` | 第 14 章原型库 | A-AC,A-SMOKE | `law-14-genesis` | 三槽有序基因、血清支付、专精/万象分流一致 |
| `AC-LAW-15` | 第 15 章广播塔 | A-AC,A-SMOKE | `law-15-broadcast` | 三中继、noise、奖励与区域分流一致 |
| `AC-LAW-16` | 第 16 章避难所 | A-AC,A-SMOKE | `law-16-shelter` | 幸存者 100 HP、治疗/强推、同伴与奖励分流一致 |
| `AC-LAW-17` | 第 17 章裁定庭 | A-AC,A-SMOKE | `law-17-verdict` | 证据污染、嫌疑人、原始裁决冻结与翻案一致 |
| `AC-LAW-18` | 第 18 章复演场 | A-AC,A-SMOKE | `law-18-replay` | 三段真实动作值、路线与 Boss 复演一致 |
| `AC-LAW-19` | 第 19 章监察城 | A-AC,A-SMOKE | `law-19-panopticon` | 三相扫描、曝光、中继、路线与 Boss 快照一致 |

## 4. 战斗、战利品与结算

| AC ID | 验收项 | 方法 | fixture | 精确预期 |
| --- | --- | --- | --- | --- |
| `AC-COMBAT-001` | 回合与输入 | A-AC,A-SMOKE | `combat-one-action-one-turn` | 一个主要动作只推进一回合；同 physicalId 一次，不同动作可快速连续执行 |
| `AC-COMBAT-002` | 意图与公式 | A-AC | `combat-oracle-vectors` | 意图/推荐基于当前动作；伤害、治疗、防御、效果、取整与 oracle 一致 |
| `AC-COMBAT-003` | 战意与次数 | A-AC | `combat-resource-counters` | 战意 0/3→3/3、武器技消费/回补；器魂、同伴、各功法、血统次数独立 |
| `AC-COMBAT-004` | Boss 与捕获 | A-AC | `combat-boss-capture` | 觉醒一次，阶段属性/日志一致；捕获条件、消耗和归属一致 |
| `AC-COMBAT-005` | 战斗强杀 | A-AC,M-DEVICE | `combat-kill-after-each-action` | 每种动作 ack 边界强杀后恢复到同一已结算回合，不重复敌我行动 |
| `AC-SETTLE-001` | 首次奖励 | A-AC | `settle-first-clear-only` | 节点奖励只发一次；首次通关、目录、材料兑换一致 |
| `AC-SETTLE-002` | 通关/撤退/濒死 | A-AC | `settle-exit-matrix` | 通关全带回；≥3 非出口节点撤退 50%、濒死 20% 且无装备；<3 不固化收益 |
| `AC-SETTLE-003` | 子系统结算 | A-AC | `settle-subsystem-matrix` | 协议、指令、隐藏任务、追兵、委托、装备记忆、回响分别恰好结算一次 |
| `AC-SETTLE-004` | 跨副本传送 | A-AC | `settle-cross-dungeon-portal` | 普通/稳定/强闯/错位传送不丢失或复制临时战利品、快照和结算 |

## 5. 存档、raw 转移与生命周期

| AC ID | 验收项 | 方法 | fixture | 精确预期 |
| --- | --- | --- | --- | --- |
| `AC-SAVE-001` | Web v1 raw 导入 | A-AC,M-DEVICE | `save-web-v1-import` | 历史 key、文件及平台 transfer 的 raw 走同一 codec，迁移后状态一致且保留 import backup |
| `AC-SAVE-002` | 生命周期往返 | A-AC | `save-phase-roundtrip` | 新档、整备、探索、pending、普通战斗、Boss、结果页 encode/decode 后 canonical hash 不变 |
| `AC-SAVE-003` | 顺序保持 | A-AC | `save-order-roundtrip` | 地图、任务、回响、词条和所有数组顺序不漂移 |
| `AC-SAVE-004` | 局部修复 | A-AC | `save-repairable-fields` | 可修复字段局部降级，不丢整档或永久进度 |
| `AC-SAVE-005` | 坏档原文安全 | A-AC | `save-rejected-backup-faults` | payload/reason/index 按 adapter 完成 durable 校验后才可删原 key：requires-flush 必须 flush 后再全部回读；任一点失败时唯一原文仍逐字节存在 |
| `AC-SAVE-006` | 非法活动局 | A-AC | `save-invalid-inferno-run` | 仅丢临时收益，永久进度保留；HP 0 走真实失败结算 |
| `AC-SAVE-007` | command ledger/revision envelope | A-AC | `save-envelope-ledger-revisions` | envelope 含合法 `stateRevision/ledgerRevision/commandLedger/checksum`；拒绝也推进连续 ledger，最近至少 256 条 outcome receipt；checksum 覆盖除自身外的完整 JCS envelope |
| `AC-SAVE-008` | 三 key 原子提交 | A-AC | `save-tmp-formal-backup-fault-grid` | 在 reducer 后首写 tmp 前、tmp 回读、备份、promote、flush、正式回读、公开/ack、清 tmp 各边界强杀；正式回读前保持旧可见状态，正式回读后即使公开前强杀、cleanup 失败或 ack 丢失也恢复已提交 revision，同 ID 不重跑 reducer/events |
| `AC-SAVE-009` | ack 与重试语义 | A-AC | `save-ack-storage-failure` | 只有正式 key 回读持久后才原子公开 state/events 并 ack；失败以同 command/candidate 续提，不重跑 reducer、不再次取 seed、不重复发事件；已淘汰 receipt 仍由 watermark 阻止重跑 |
| `AC-SAVE-010` | pause/hide flush | A-AC,M-DEVICE | `save-pause-hide-deadline` | write-through 与 requires-flush 两类 adapter 均覆盖；停止新输入并 drain；durable/recoverable-timeout/blocked 分别报告 durable 与 candidate revision，超时保留 recoveryKey，resume 恢复完成前不开放输入 |
| `AC-SAVE-011` | 强杀选择顺序 | A-AC,M-DEVICE | `save-recovery-candidate-matrix` | 覆盖纯有效、有效+无效、未来 formal+有效 tmp、无效 tmp+有效 formal；任何将覆盖的非候选 raw 先验证 rejected 三件套，未来 formal 不自动覆盖；同 ledgerRevision 仅逐字节相同可按位置去重，内容不同按 split-brain 阻断 |
| `AC-SAVE-012` | raw 导入导出端口 | A-AC,M-DEVICE | `save-transfer-capabilities` | localStorage 保持 JS code unit，外部 payload 保持 bytes且端口不解码；非法 UTF-8 由 codec 拒绝并原样备份；rejected/import 的 payload、reason/meta、index 均越过 adapter durable 边界且最终回读，重启可发现、逐字节导出且只能显式删除 |

## 6. seed、确定性与 canonical hash

| AC ID | 验收项 | 方法 | fixture | 精确预期 |
| --- | --- | --- | --- | --- |
| `AC-SEED-001` | 入场 seed 必填 | A-AC | `seed-enter-bundle-validation` | 新入场 bundle 普通含 hidden、炼狱另含 inferno且只接受 version 1；0/缺失/越界/未知版本均拒绝且不取随机；codec 可为历史活动 run 生成判别式 version 0 lineage |
| `AC-SEED-002` | root 派生 | A-AC | `seed-root-label-golden-v1` | version 1 固定标签派生的 nonzero uint32 与跨语言 vectors 逐项一致 |
| `AC-SEED-003` | 隐藏契约 | A-AC | `seed-hidden-contract` | 同 seed/rulesVersion/命令序列得到同一隐藏路线契约 |
| `AC-SEED-004` | 炼狱地图 | A-AC | `seed-inferno-topology` | 同 seed 得到完全相同拓扑、起点、Boss、优先节点与门 |
| `AC-SEED-005` | 其他随机链 | A-AC | `seed-relic-affix-tiebreak` | 回响候选、装备 affix/品质、同分排序、奖励取整一致 |
| `AC-SEED-006` | 恢复不取随机 | A-AC | `seed-resume-random-spy` | 活动局恢复、保存重试、重复 commandId 时 `SeedPort` 调用数为 0 |
| `AC-SEED-007` | 全传送与 legacy 覆盖 | A-AC | `seed-portal-mode-and-legacy-v0-matrix` | v1 普通/稳定/强闯/错位/跨副本共享持久 lineage，hop 一次一增且可重放；导入中的 Web v1 活动 run 使用 rulesVersion 0 与旧 `previousSeed + tier * 0x9e3779b1` 向量直到结算 |
| `AC-SEED-008` | 领域无隐式随机 | A-AC | `seed-forbidden-api-spy` | rules/codec 内 `Math.random`、平台 RNG、时钟和设备熵均不可达；缺 seed 明确拒绝 |
| `AC-SEED-009` | 低层算法 vectors | A-AC | `seed-cross-language-primitives` | uint32、`Math.imul`、UTF-16 hash、stable sort、round/floor/ceil 与 vectors 一致 |
| `AC-HASH-001` | canonical 编码 | A-AC | `hash-canonical-json-v1` | JCS/UTF-8 规则、key 排序、数组顺序和非法数拒绝符合协议，保存 canonical JSON 证据 |
| `AC-HASH-002` | payload 边界 | A-AC | `hash-domain-projection-v1` | 全领域 state/snapshot/pending/settlement/seed 纳入；UI、savedAt、envelope checksum、stateRevision、ledgerRevision 和完整 commandLedger 排除 |
| `AC-HASH-003` | 双端 SHA-256 | A-AC | `hash-cross-client-golden` | 规定的大厅/入场/炼狱/pending/Boss/传送/结算/迁移 fixture 输出相同 64 位小写 hash |

## 7. 资源、UI 与触控

| AC ID | 验收项 | 方法 | fixture | 精确预期 |
| --- | --- | --- | --- | --- |
| `AC-ASSET-001` | manifest 完整 | A-WEB,A-AC | `asset-manifest-187` | 187 key 可解析；59 怪物、65 装备、30 道具、6 宠物、19 副本都有资源 |
| `AC-ASSET-002` | 稳定 key 与 revision | A-AC | `asset-key-revision-cache` | key 不由显示名/文件名推导；handle、cache、报告携带同一 manifestRevision，不混版 |
| `AC-ASSET-003` | 错误分类 | A-AC | `asset-error-taxonomy` | 九类错误及 retryable 与协议一致，诊断包含 key/revision/code |
| `AC-ASSET-004` | fallback 与生命周期 | A-AC,A-SMOKE | `asset-failure-release-retry` | 缺图可见且不阻规则；章节按需 preload/release；弱网/分包/低内存正确重试或降级 |
| `AC-UI-001` | 响应式可达 | A-SMOKE,M-DEVICE | `ui-390x844-320x568` | 390×844 无全局横溢；320×568 核心动作可达；安全区/放大字体/手势区不遮挡 |
| `AC-UI-002` | 触控与返回 | A-SMOKE,M-DEVICE | `ui-touch-back-focus` | 主要目标与 `?` ≥44×44；返回先关顶层；关闭帮助回原入口/等价选中态 |
| `AC-UI-003` | 非颜色信息 | A-SMOKE,M-DEVICE | `ui-noncolor-status` | 推荐、高风险、锁定、完成均有文字/图形辅助 |
| `AC-UI-004` | 信息完整 | A-SMOKE,M-DEVICE | `ui-help-and-mechanics` | 帮助保留 title、summary、mechanic、guidance、readout 与 keywords；法则、战利品、携行、路线说明不因小屏删除 |

## 8. 发布门禁闭合

| AC ID | 验收项 | 方法 | fixture/输入 | 精确预期 |
| --- | --- | --- | --- | --- |
| `AC-RELEASE-001` | 全阻断项闭合 | A-DERIVE | `acceptance-derived-final` | 只读派生其余 102 个稳定 ID：94 leaf、release 002–007、attestation 008–009 全部且仅有 PASS，三份冻结证据绑定同一 candidate/spec 且 hash 可复算；只原子生成独立 final-evidence，不检查自身或修改输入 |
| `AC-RELEASE-002` | 19 章完整结算 | A-RELEASE | `release-19-full-settlements` | 每章至少一条从入场到合法结算的命令 fixture，最终 hash/events/settlement 与 oracle 一致，并绑定 leafEvidenceSha256 |
| `AC-RELEASE-003` | 自然试玩 | A-RELEASE,M-DEVICE | `release-chapter-1-natural-play` | 第一章不使用调试跳转完成自然整备、探索、Boss、出口、回大厅和重启恢复，并绑定 leafEvidenceSha256 |
| `AC-RELEASE-004` | 终章恢复 | A-RELEASE,A-SMOKE,M-DEVICE | `release-chapter-17-19-restart` | 17–19 章各完成法则选择、Boss，并在 pending/战斗后强杀恢复，绑定同一候选与 leafEvidenceSha256 |
| `AC-RELEASE-005` | 历史档矩阵 | A-RELEASE,M-DEVICE | `release-save-compat-matrix` | Web v1 正常、旧快照、局部坏、完全坏、未来版本及 rejected-backup 失败全部得到规定结果 |
| `AC-RELEASE-006` | 平台故障矩阵 | A-RELEASE,M-DEVICE | `release-platform-fault-matrix` | pause/hide、强杀、空间不足、弱网、分包失败、低内存、快速输入均无重复结算或唯一 raw 丢失 |
| `AC-RELEASE-007` | 双端与资源总门禁 | A-RELEASE,A-WEB,A-SMOKE | `release-oracle-hash-assets-ui` | 引用冻结 leaf 结果；另执行 Web 基线、全状态 hash、资源 revision 审计和目标端 UI smoke，全部绑定同一候选，不调用全量自发现 |
| `AC-RELEASE-008` | 四视角独立签核 | R-REVIEW | `release-four-owner-signoff` | 产品、规则、存档、UI/无障碍分别签署 candidate + spec/leaf/release 三个 hash 的固定 subject digest，意见闭合；签名存于独立 attestation |
| `AC-RELEASE-009` | 版本与发布可追溯 | A-RELEASE,R-REVIEW | `release-version-trace` | 包版本、git SHA、schema/content/rules/hash/manifest revision 与发布物、固定 subject 完全一致，结果写入 attestation 但不修改被签输入 |

### 最终放行判定

发布负责人只读独立 registry、冻结的 `leaf-evidence.json`、`release-evidence.json`、`attestation.json` 与派生后不可变的 `final-evidence.json` 作决定：

```text
可发布 = 94 个 leaf ID 全部且仅有 PASS
       && AC-RELEASE-002..007 全部 PASS
       && AC-RELEASE-008..009 全部 PASS
       && final-evidence 中 AC-RELEASE-001 由上述 102 项派生为 PASS
       && 三份输入证据与 final-evidence 绑定同一 candidate/spec digest，文件 hash 可复算
       && 待发布二进制与 candidate identity 完全一致
```

不存在“非关键失败”“已知问题放行”或用后续补测关闭本清单的路径。确需改变范围时，必须显式修改独立 registry 与本文、增加新 ID 或登记 tombstone、重新生成整条证据链；不得直接删表格行或从报告里删除失败项。
