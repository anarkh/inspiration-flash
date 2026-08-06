# 领域、状态与存档模型

## 1. 当前模块关系

```text
index.html
  └─ src/main.ts                 浏览器组合根、存档 codec、DOM 表现与输入
       └─ src/game.ts            领域模型、聚合状态转移与查询门面
            ├─ level-content.ts  章节与怪物聚合
            ├─ level-data/*.ts   19 章地图内容
            ├─ combat-*.ts       战斗意图、效果、战意与机制
            ├─ dungeon-*.ts      法则、路线、事件、战利品与帮助
            ├─ run-*.ts          协议、侵蚀、追兵、回响与经济
            └─ growth modules    装备、功法、同伴、宠物、血统与任务
```

`src/game.ts` 和大多数规则模块不访问 DOM，适合跨端复用。`src/main.ts` 同时承担存档、动作派发、HTML 字符串渲染、焦点、弹层和资源状态，是迁移时最需要拆分、而不是直接复制的文件。

## 2. 五个业务域

### 2.1 主神空间整备

负责：

- 任务领取和成长目标。
- 道具、装备、宠物的购买与培养。
- 功法、同伴、血统成长。
- 装备升级、铭刻、淬炼、委托、器魂和记忆。
- 下一局的携行、回响框架、种子与可选目标整备。

### 2.2 副本探索与章节法则

负责：

- 章节、地图、节点、迷雾与相邻移动。
- 侵蚀、追兵、隐藏路线契约和复刷协议。
- 章节独特 law、路线区段、事件、陷阱、传送、奖励、Boss 与出口。
- 战利品袋、本局回响、局内可选长期目标。

### 2.3 回合战斗

负责：

- 敌方意图、玩家主要行动、反击和效果。
- 武器战意与武器技。
- 器魂、同伴助战、功法战技、血统爆发。
- 捕获、Boss 双阶段、撤离和濒死。

### 2.4 成长与经济

负责：

- 奖励点、灵蕴、物品与章节材料。
- 装备取得、比较、自动装配、随机词条和定向兑换。
- 宠物、功法、同伴、血统的长期成长。
- 委托、任务、指令和各类结算奖励。

### 2.5 长期进度与存档

负责：

- 章节顺序、解锁、首通、炼狱层和历史结果。
- 正常存档、旧字段兼容、局部归一化、坏档备份和恢复提示。
- 保存活动副本和活动战斗，使刷新后可继续。

机器可读的领域、流程和步骤关系见：

```text
.understand-anything/domain-graph.json
```

## 3. 状态分层

### 3.1 定义数据

定义数据描述“游戏里有哪些东西”，不随玩家操作改变：

- 稳定 ID 与类型。
- 道具、装备、功法、怪物、宠物、同伴、血统目录。
- 章节、地图节点、事件、Boss、路线门和帮助。
- 资源 manifest。

迁移时应作为只读内容包加载。

### 3.2 存档聚合根：`GameState`

`GameState` 是一次完整可恢复游戏会话的**存档聚合根**，不是“永久状态”的同义词。它把永久档案、活动副本、活动战斗、阶段和结算结果一起持久化；纯派生值与 UI 临时值不应成为聚合内新的事实源。

| 层级 | `GameState` 中的主要字段 | 所有权与生命周期 |
| --- | --- | --- |
| 永久档案 | `player.base`、装备/功法/血统/宠物/同伴成长、下一局整备、战役进度、领取 ID | 跨局保留；只能由领域命令和结算修改 |
| 聚合级当前值与账本 | `phase`、`player.hp`、`rewardPoints`、`lingyun`、`inventory`、`lastOutcome`、`log` | 全部需要持久化，但不全等于已入账永久收益；活动局临时收益同时记在顶层总额和 `run.lootBag`，失败/撤退再按 bag 回滚 |
| 本局 | `run` | 入场创建，返回大厅清除；包含未结算收益和入场快照 |
| 战斗 | `combat` | 遭遇开始创建，战斗结束清除；从属于当前 `run` |
| 派生缓存 | `player.maxHp` | 读档后由 `getDerivedStats` 重算；`player.hp` 是真实当前值，但必须受派生 `maxHp` 约束 |
| 不在聚合内 | 弹层、焦点、搜索、折叠、滚动、动画进度 | UI 本地临时状态，可重建且不入正式存档 |

永久装备词条位于顶层 `equipmentRolls`。`getPermanentDerivedStats`/`getDerivedStats` 会按当前已装备 ID 实时读取它，因此即使已有活动 `run`，更改顶层装备、词条或宠物仍可能改变本局派生属性；这是 Web v1 的当前事实，不应误写成已经全面“入场冻结”。

`player.maxHp` 当前作为派生结果的持久缓存存在，`normalizeSavedState` 读档时会由 `getDerivedStats` 重算。迁移后应避免出现两个可独立写入的事实源；如果继续缓存，必须保持“载入后重算”的不变量。

### 3.3 本局状态：`DungeonRun`

`DungeonRun` 保存一次入场后的全部可恢复事实：

| 分类 | 主要字段 |
| --- | --- |
| 定位 | `dungeonId`、`currentNodeId` |
| 地图认知 | `clearedNodeIds`、`discoveredNodeIds` |
| 本局记录 | 捕获、已用道具、承伤、已结算事件和 `eventLog` |
| 未结算收益 | `lootBag`、装备候选和各类 settlement |
| 入场规则 | `protocol`、`infernoMap`、`tacticalLoadout` |
| 本局构筑 | `relicState`、器魂、回响导管、本局新掉落装备候选词条 |
| 长期目标快照 | 铭刻勘探、装备追猎、装备记忆、路线契约 |
| 压力与追兵 | `pressureState`、`pursuitState` |
| 章节规则 | `lawState` 及部分章节专用入场装备被动 |
| 成长快照 | `companionSnapshot`、`methodSnapshots`、`bloodlineSnapshot`；没有宠物快照 |
| 终盘专用 | `combatReplayState` 等章节状态 |

`carriedEquipmentRolls` 不是永久装备词条的入场副本。它初始为空，只在 `resolveEquipmentLoot` 选中本局炼狱词条装备时写入候选，成功结算时由 `settleRunLootState` 与顶层 `equipmentRolls` 比较，保留更强者或拆解，随后清空。

同伴、功法、血统有显式 run 快照；宠物没有。当前事件、战斗派生和效果通过 `getAvailableActivePet` 直接读取顶层 `activePet`，而 `capturePet` 会把局内新捕获宠物立即写入 `ownedPets`、`petLevels` 和 `activePet`，所以它能在同一局的后续战斗立即出战。这是有意保留的现状语义，迁移时不能凭空新增宠物入场快照。

除上述明确例外外，真正声明为入场冻结的配置都应在进入副本时写入 `run`，而不是战斗时再读取大厅配置。

### 3.4 战斗状态：`CombatState`

`CombatState` 是可持久化的回合运行态，不是临时动画状态：

- 当前节点与怪物。
- 怪物生命、回合数和防御状态。
- 战意、武器技、Boss 阶段。
- 同伴、功法、血统的一次性使用记录。
- 战斗效果、装备记忆和复演状态。
- 战斗日志。

小游戏切后台、被系统回收或重启后，应能恢复到同一回合事实。动画播放进度不必保存，但领域动作是否已结算必须保存。

宠物 ID 和等级不在 `CombatState` 内复制；战斗规则读取聚合根当前的 `activePet` 与 `petLevels`。同伴、功法、血统则读取 `run` 中的显式快照，二者不能混为同一种冻结策略。

### 3.5 纯派生状态

以下数据应通过查询函数实时派生，不应让 UI 复制一份可写状态：

- 角色实际属性和战力。
- 章节准备度与战役门禁。
- 当前可见节点、可达边和移动阻塞原因。
- 敌方意图、动作可用性、预估伤害和推荐。
- 章节法则展示、路线区段、任务进度。
- 商店建议、换装比较和结算预览。

常见来源：

```text
src/progression.ts
src/exploration-visibility.ts
src/exploration-guide.ts
src/shop-advice.ts
src/dungeon-laws.ts
src/dungeon-routes.ts
src/combat-intents.ts
src/game.ts 中的 get*Status / get*Preview
```

### 3.6 UI 临时状态

弹层是否打开、搜索词、详情折叠、焦点目标、帮助气泡位置和滚动位置不属于 `GameState`。它们可以在客户端内部重建。

不要把 Web 的 CSS 类、DOM 节点 ID 或 scrollTop 写进正式存档。

## 4. 入场冻结契约

| 系统 | 永久准备 | 本局冻结 | 缺失或异常旧快照 |
| --- | --- | --- | --- |
| 战术携行 | `preparedItemIds` | `run.tacticalLoadout` | 历史无快照局保持旧版不受限；不能从当前整备补写 |
| 回响 | frame、归档种子 | `run.relicState`、导管来源 | 本局禁用，不从当前装备补写 |
| 器魂 | 当前装备解锁 | `run.soulSkillState` | 本局禁用 |
| 铭刻勘探 | 已装备、满级、有效铭刻 | `run.fieldSurveyState` | 本局禁用，普通奖励仍可用 |
| 装备追猎 | 历史准备字段 | `run.equipmentHunt` | 仅兼容旧局，不创建现代新局目标 |
| 装备记忆 | 永久 active memory 与准备目标 | 快照和 hunt state | 局部禁用，不重置其他进度 |
| 同伴 | active companion 与 rank | `companionSnapshot` | 本局无助战 |
| 功法 | 所有已学功法与 rank | `methodSnapshots` | 兼容旧单 `methodSnapshot`；不补入其他功法 |
| 血统 | active bloodline 与 rank | `bloodlineSnapshot` | 本局无爆发 |
| 本局新掉落装备词条 | 无入场准备；永久现有词条仍在顶层 `equipmentRolls` | `pendingEquipmentOffer.equipmentRolls` → 选中后 `carriedEquipmentRolls` | 异常候选局部丢弃；绝不把顶层永久词条复制进来 |
| 章节法则装备 | 当前装备 | `lawState` 或章节入场被动 | 不从大厅回填 |
| 协议与炼狱 | 难度、协议、层级 | `protocol`、`infernoMap` | 非法活动局安全退回大厅 |

“缺失快照保持禁用”是兼容策略，不是错误。擅自从当前大厅状态回填，会改变一局已经开始时的历史事实。

宠物不适用这条“缺失快照禁用”规则，因为当前模型从未定义宠物 run snapshot；它按聚合根 `activePet` 实时生效，局内捕获也会即时切换 active。

### 4.1 命令阶段边界不是 UI 职责

Web 没有统一的命令阶段门：商店等入口依赖 `renderHub*` 只在大厅渲染，顶栏成长弹层则由各领域函数零散保护。若绕过 UI 直接调用，仍有多项大厅成长写操作缺少 `phase === 'hub'` guard：`buyItem`、普通分支的 `buyEquipment`、`equipEquipment`、`upgradeEquipment`、`learnMethod`、`buyPet`、`upgradePet`、`activatePet`、`claimTaskReward`，以及 `enterDungeon` 本身。相比之下，铭刻、淬炼、整备、同伴/血统/部分功法操作已经各自检查 phase；这种不一致不能由小游戏照搬。

小游戏 `GameSession.dispatch` 必须把所有大厅成长和入场命令统一声明为 `hub-only`，在调用具体规则前拒绝越阶段命令。UI 隐藏只负责可发现性，不是安全边界；领域函数后续是否补 guard，也不能替代 session 的集中校验。

负向验收至少覆盖下面的命令矩阵：

```text
for phase in [explore, combat, result]:
  for command in [
    BuyItem, BuyEquipment, EquipEquipment, UpgradeEquipment,
    LearnMethod, BuyPet, UpgradePet, ActivatePet,
    ClaimTaskReward, EnterDungeon
  ]:
    result = await session.dispatch(command)
    assert result.status == "rejected"
    assert result.events includes CommandRejected(code="phase_not_allowed")
    assert result.stateRevision == revisionBefore
    assert hash(result.state) == hash(stateBefore)
```

还必须以直接构造的合法 `explore`、`combat`、`result` fixture 运行，不能只点击当前 Web 中不存在的按钮；每类命令至少使用一个本来资源充足、目标合法、若在大厅会成功的参数，避免因“钱不够”或“已拥有”而假通过。

## 5. 存档 envelope

当前浏览器存档：

```text
STORAGE_VERSION = 1
主键     infinite-flow:save:v1
坏档原文 infinite-flow:save:v1:rejected
坏档原因 infinite-flow:save:v1:rejected:reason
```

JSON 外层：

```json
{
  "version": 1,
  "state": {}
}
```

权威实现当前位于 `src/main.ts`：

- 校验：`isSavedGameState`、`isSavedDungeonRun`、`isSavedCombatState`。
- 字段清洗：`sanitizeSaved*` 系列。
- 归一化：`normalizeSavedState`。
- 读取与写入：`loadSavedState`、`saveState`。
- 坏档：`preserveRejectedSave`、`loadRejectedSaveRecovery`、`clearRejectedSaveRecovery`。
- 非法活动局：`discardInvalidSavedRun`。
- 遭遇替换：`REPLACED_COMBAT_ENCOUNTER_MIGRATIONS`。

## 6. 当前 v1 内兼容策略

当前实现没有完整的 v1→v2 envelope 迁移链，而是在 v1 内：

1. 对已知可选字段做局部 sanitize。
2. 对整体结构、引用 ID、部分数值范围和部分状态组合做校验。
3. 为新增材料补 0。
4. 为旧装备槽、等级和持有关系补合法默认。
5. 归一化活动 run、combat 和各类快照。
6. 修复可修复的炼狱拓扑；若隐藏任务在新拓扑中不可达，则安全取消该任务。
7. 将非法或未解锁的炼狱活动局丢弃临时收益并送回大厅，永久进度保留。
8. 将 HP 已为 0 的活动局按真实失败流程结算。
9. 成功读取后立即写回归一化结果。

当前遭遇替换映射：

```text
lost_shelter:
  mimic_survivor → rogue_sentry

panopticon_city:
  sweep_sentinel → phase_hunter_drone
```

小游戏导入 Web v1 时必须执行等价迁移。

### 6.1 Web v1 实际数值接受范围与 v2 目标不变量

不能把当前 `isSaved*` 函数的名字理解成完整业务不变量。它们的实际接受范围如下：

| 字段族 | Web v1 当前接受 | 小游戏 v2 目标 |
| --- | --- | --- |
| `rewardPoints`、`lingyun` | 任意有限 number，负数、小数、超过安全整数都可通过 | `0...Number.MAX_SAFE_INTEGER` 的安全整数 |
| `player.hp`、`maxHp`、四项 `base` | 任意有限 number；读取后只会重算 `maxHp` 并 clamp HP | 基础属性为有界安全整数；`maxHp === getDerivedStats(state).maxHp`；`hp` 为 `0...maxHp` 的安全整数 |
| `inventory`、`lootBag` 的数量 | 非负 `Number.isInteger`，但未统一要求 safe integer | 非负安全整数，并对资源总量设置实现上限以防溢出 |
| `run.captures`、`run.damageTaken` | 任意有限 number | 非负安全整数；`captures === capturedPetIds.length` 等关联约束另行校验 |
| `run.lootOffersMade` | 非负整数，未要求 safe integer | 非负安全整数 |
| `combat.monsterHp`、`combat.turn` | 任意有限 number | `monsterHp` 为 `0...当前 encounter maxHp` 的安全整数；活动战斗 `turn >= 1` |
| `petLevels` | 已知宠物 key 到任意有限 number；`activePet` 只要求 ID 已知 | 等级为该宠物 `1...maxLevel` 的安全整数；key 必须已拥有；`activePet` 必须已拥有且有合法等级 |
| 装备等级、focus、barrier、seed 等 | 已有各自局部整数/上限校验 | 保留现有上限，并统一纳入安全整数与跨字段校验 |

Web v1 导入器需要先按当前兼容规则识别历史档，再显式迁移到 v2 不变量；不能直接用 v2 schema 拒掉所有过去能载入的值，也不能把负数、小数或超大数原样带入规则层。无法无歧义修复的永久数值应保留坏档原文并拒绝导入；仅活动局字段异常时按下节降级。

### 6.2 `phase/run/combat/outcome` 的当前弱点与目标矩阵

`isSavedGameState` 当前只保证：`explore` 有合法 run，`combat` 有合法 run 和 combat；它没有反向约束。因此 Web v1 会接受例如 `hub + run`、`hub + run + combat`、`explore + combat`、`result + run + combat`、任意 phase 携带 `lastOutcome`。`isSavedCombatState` 也没有要求 `combat.nodeId === run.currentNodeId`，`lastOutcome` 只检查为 string，不要求非空或只出现在 result。

v2 聚合必须满足唯一合法矩阵：

| `phase` | `run` | `combat` | `lastOutcome` | 额外约束 |
| --- | --- | --- | --- | --- |
| `hub` | 无 | 无 | 无 | 大厅命令才可执行 |
| `explore` | 有 | 无 | 无 | `run.currentNodeId` 属于当前副本 |
| `combat` | 有 | 有 | 无 | `combat.nodeId === run.currentNodeId`，怪物与节点定义一致 |
| `result` | 有 | 无 | 非空 | run 已结算；允许继续处理 pending 回响归档，随后 `returnToHub` 清除 run/outcome |

降级顺序必须确定且可测试：

1. 先做已知字段迁移和局部 sanitize，再判断矩阵，避免把可识别旧字段误判成整档损坏。
2. `explore + 合法且与当前节点一致的 combat` 可提升为 `combat`；非 result 中孤立的 `lastOutcome` 可删除。这两类修复都有唯一证据。
3. `result` 若 run 和非空 outcome 合法，只清除残留 combat，不重新结算；缺 run 或 outcome 时不得猜测已发过哪些奖励。
4. 其余非法活动组合调用与 `discardInvalidSavedRun` 等价的回收：扣除 `lootBag` 中尚未结算的临时收益，清除 run/combat/outcome，恢复到 hub，保留永久进度并写诊断日志。
5. 活动 run 的 HP 已为 0 时，继续沿真实 `resolveRunFailure` 结算，不能简单 clamp 后复活。完全无法验证永久档案时保留原文并拒绝整档。

矩阵校验必须同时用于 decode 后、每次 dispatch 后和 encode 前，防止运行时产生一种、读档器又接受另一种状态空间。

## 7. 坏档原则

- JSON 无法解析、版本不兼容或整体结构不合法时，先把原始文本和原因写入拒绝备份，并回读验证逐字节一致。
- 只有拒绝备份已经确认持久化，才允许清除活动主键并创建新档；备份失败时必须保留唯一原文并报告可重试阻断。
- 用户应能导出坏档原文供恢复或诊断。
- 可修复的局部字段不应导致整档丢失。
- 不可修复的活动 run 可以丢弃临时收益，但必须保留永久进度。
- 未知版本不能静默覆盖成新档。

当前 Web v1 的 rejected backup 是 best-effort：备份写入失败会被吞掉，主 key 随后仍可能被删除。这是已知迁移风险，不是应复刻的产品语义。当前导出坏档使用浏览器 Blob，也只是 UI 实现；v2 必须遵守“验证备份、保留原文、显示原因、显式清除”的跨端契约。

## 8. 已知版本风险

当前版本号嵌入存档主键。若直接改成 `STORAGE_VERSION = 2`，程序会读取 `save:v2`，默认看不到旧的 `save:v1`。

正式迁移前必须选择一种方案：

### 方案 A：稳定主键

```text
infinite-flow:save
```

envelope 内保留 `version`，通过显式 migration 链升级。

### 方案 B：扫描历史主键

按新到旧扫描：

```text
save:v3 → save:v2 → save:v1
```

读取后迁移并原子写入最新主键，同时保留一次可回退备份。

不要依赖当前“payload version 不同”的分支解决历史 key 不可见问题。

## 9. 随机与确定性

只有 session/平台适配层在创建全新随机链路时可以使用平台随机源；领域层不得直接取随机。入场后的结果应由显式 seed 和已持久化状态确定。

### 9.1 当前有两个独立入场 seed

现代入场 `DungeonEntryOptions` 同时定义 `hiddenTaskSeed` 与 `infernoMapSeed`，二者用途不同，不能合并或互相替代：

| seed | 当前消费方 | 当前持久化位置 |
| --- | --- | --- |
| `hiddenTaskSeed` | `discoverHiddenRouteContract`：在首次清理过程中稳定决定隐藏任务 | `run.hiddenTaskSeed` |
| `infernoMapSeed` | `createInfernoMapSnapshot`：生成炼狱拓扑，并继续影响装备候选/词条派生 | 输入后固化为 `run.infernoMap.seed` 和完整 `infernoMap` snapshot |

`enterDungeon` 对缺失或非法值会分别调用 `createHiddenTaskSeed`，即分别从 `Math.random` 取值；传入同一个数也只是调用方偶然令它们相等，不代表共享 seed 契约。跨副本传送时，当前实现保留 `hiddenTaskSeed`，而炼狱地图 seed 从上一张 `infernoMap.seed` 加目标章节 tier 与常数 `0x9e3779b1` 后映射回非零 uint32。迁移测试必须覆盖这条现有传送向量。

v2 目标把两个根 seed 一次性生成并先于状态转移持久化：

```ts
type NonZeroUint32 = number;

type SeedBundle = {
  rulesVersion: 1;
  hiddenTaskSeed: NonZeroUint32;
  infernoMapSeed?: NonZeroUint32;
};
```

派生规则必须满足：

1. 普通/困难只需要 `hiddenTaskSeed`，不得附带无意义的炼狱 seed；炼狱必须同时提供两个互相独立、位于 `1...0xffff_ffff` 的根 seed。它们由 `SeedPort.nextNonZeroUint32()` 取得，或从一个显式 root 按版本化标签派生。
2. 隐藏任务只从 `hiddenTaskSeed` 派生，炼狱拓扑、炼狱装备候选和词条只从 `infernoMapSeed` 或已持久化 `infernoMap.seed` 派生；禁止共享一个可变 PRNG cursor。
3. 子 seed 使用带命名空间的稳定输入，例如 `hash32(rulesVersion, domain, dungeonId, occurrence, rootSeed)`；domain、字符串编码、uint32 溢出和 0→1 规则必须写入测试向量。
4. 已经生成的 contract、pending offer、最终 affix 和完整地图继续直接持久化；恢复时优先使用持久化结果，不重新抽取。
5. Web v1 导入中的**活动 run** 不升级成新算法：以 `run.hiddenTaskSeed` 和 `run.infernoMap.seed` 建立 `seedLineage.rulesVersion = 0`。version 0 的跨副本炼狱 seed 必须继续执行 Web 公式 `((previousSeed + targetTier * 0x9e3779b1) % 0xffff_ffff) || 1`，直到该 run 结束；新开的 v2 run 才使用 version 1 标签派生。对应子系统启用时若任一 seed 缺失，只禁用或丢弃依赖它的活动子系统，不能拿另一个 seed 补位。

当前确定性来源：

| 系统 | 关键实现 | 必须持久化 |
| --- | --- | --- |
| 隐藏任务 | `route-contracts.ts` 稳定哈希 | seed、选中的 contract 与进度 |
| 炼狱地图 | `inferno-system.ts` 种子 PRNG | seed 与完整 `infernoMap` |
| 回响候选 | `run-relics.ts` 派生 seed | pending draft 与已处理 draft |
| 装备词条 | `equipment-rolls.ts` | seed、规则版本、最终 affix |
| 装备候选轮换 | `dungeon-loot.ts` 稳定哈希 | 已生成候选或足够的稳定输入 |

如果小游戏使用非 JavaScript 语言，需要锁定测试向量：

- 32 位无符号溢出。
- `Math.imul` 等价实现。
- UTF-16 code unit 的字符串哈希。
- 排序同分规则。
- 各种 floor/ceil/round 和百分比取整。

只复刻“算法思想”不能保证旧档和候选顺序兼容。

## 10. 跨端接口的唯一契约

`StoragePort`、`SeedPort`、`AssetPort`、`LifecyclePort`、`LegacySaveTransferPort`、`GameSession` 和 `DispatchResult` 的**唯一签名**见 [05-mini-game-migration-plan.md](05-mini-game-migration-plan.md)。本文不复制第二套简化接口，避免未来出现同步/异步、ack 或 revision 语义漂移。

本层只补充聚合与持久化不变量：

1. `dispatch(intent): Promise<DispatchResult>` 是 `GameState` 的唯一写入口；session 按接收顺序串行执行，并且是持久 `commandId` 的唯一生成方；`getState()` 只返回只读视图，UI 不直接改字段。
2. session 分配 ID 后做命令 phase guard，再运行一次领域转移并校验目标状态矩阵与数值不变量；领域拒绝返回结构化结果，不提交半成品 state，但也要持久化 rejected outcome receipt，避免序号空洞。
3. 一条首次处理且改变领域状态的命令只增加一次 `stateRevision`；首次 committed/rejected outcome 都只增加一次 `ledgerRevision`。查询、纯 UI 动作和重复命令不增加任一 revision。
4. 领域计算与持久化回执必须分开表达。只有正式 key 越过适配器要求的 durable 边界并回读确认后才返回 ack；存储失败继续提交同一内部 command envelope，不能伪造第二条领域命令。
5. 只有 durable outcome 的首次 events 才交给表现层；重复或恢复返回空 events。动画可重播或丢帧，不能反向驱动重复结算。
6. 启动时必须先 decode/migrate/validate，再创建 session；encode 前再次验证。坏档原文未经已验证备份不得删除。

规则包不能访问 DOM、Vite、平台存储、真实时钟或隐式随机；平台存储、生命周期 flush 和渲染时机仍由 05 所述宿主适配层负责。

## 11. 源码事实索引

本文的“当前事实”可从以下位置复核：

| 事实 | 权威源码 |
| --- | --- |
| 聚合根、run、combat、入场 options 字段 | `src/game.ts` 的 `GameState`、`DungeonRun`、`CombatState`、`DungeonEntryOptions` |
| 顶层词条参与派生属性 | `src/game.ts` 的 `getPermanentDerivedStats`、`getDerivedStats` |
| 候选词条写入、比较和结算 | `src/game.ts` 的 `resolveEquipmentLoot`、`evaluateEquipmentRollCandidate`、`settleRunLootState` |
| 宠物实时读取与局内捕获切 active | `src/game.ts` 的 `getAvailableActivePet`、`getCombatMechanicsContext`、`capturePet` |
| 同伴/功法/血统入场快照 | `src/game.ts` 的 `enterDungeon`、`getCurrentRunMethodSnapshots`、各战斗能力 status/use 函数 |
| Web v1 数值与组合校验 | `src/main.ts` 的 `isSavedGameState`、`isSavedDungeonRun`、`isSavedCombatState` 及数值 helper |
| 读档归一化与非法 run 回收 | `src/main.ts` 的 `normalizeSavedState`、`discardInvalidSavedRun`、`loadSavedState` |
| 两个 seed 的生成、消费和传送 | `src/game.ts` 的 `createHiddenTaskSeed`、`enterDungeon`、`markNodeCleared`、`usePortal`；`src/route-contracts.ts`；`src/inferno-system.ts` |
| Web 动作后持久化 | `src/main.ts` 的 `bindActions`、`saveState`、`render` |
