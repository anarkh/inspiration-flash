# 小游戏迁移方案

本方案不绑定 Cocos、Laya、Pixi、原生 Canvas 或某个具体小游戏平台。先保持领域包平台无关，再实现目标端适配。

## 1. 迁移原则

### 1.1 Web 版本继续作为行为 oracle

迁移期间不要同时重写规则和目标端 UI。对于同一初始状态、seed 和命令序列，Web 与小游戏应得到相同领域状态和结算。

### 1.2 复用纯规则，重写表现层

高复用价值：

- 稳定类型与 ID。
- 内容目录。
- 状态转移和 selectors。
- 存档 sanitize/normalize/migration 语义。
- 平衡模拟和测试 fixture。

低复用价值：

- HTML 字符串。
- CSS 和媒体查询。
- DOM 查询、焦点、ARIA、`inert`。
- localStorage、Blob 下载、`Image` 和 Vite 路径。
- 浏览器 pointer/click 事件细节。

### 1.3 先兼容存档，再制作完整 UI

旧档导入、活动 run 恢复、确定性 seed 和平台生命周期是基础设施，不能等 19 章 UI 都完成后再补。

### 1.4 区分 Web v1 基线和 v2 迁移目标

本文中的接口均为 **v2 目标协议**，不是对当前实现的完成声明。当前 Web v1 是行为 oracle，仍有以下已知边界：

- `main.ts` 直接持有可写状态并调用规则函数，尚无唯一 `GameSession` 写入口。
- `enterDungeon` 的 `hiddenTaskSeed`、炼狱 `infernoMapSeed` 缺失时会由领域函数调用 `Math.random()`；跨副本传送也在领域路径内补 seed。
- 当前主键为 `infinite-flow:save:v1`，没有 `commandId/stateRevision`、提交回执和临时/正式/备份三 key 恢复协议。
- Web v1 的文件导入导出、`localStorage` 和资源 URL 是浏览器实现，不是跨端端口契约。

迁移允许 Web v1 在冻结期继续承担 oracle，但发布 v2 前必须由验收清单证明上述边界已经消除。文中的“必须”“禁止”和示例类型描述目标契约；没有对应实现和证据时一律视为未通过。

## 2. 目标分层

```text
packages/
  model/          稳定 ID、类型、值对象、命令和事件
  content/        章节、目录、帮助、资源元数据
  rules/          状态转移、战斗、路线、法则、成长和结算
  save-codec/     v1 导入、校验、归一化、迁移和拒绝备份
  session/        GameSession、命令串行化、持久化触发

clients/
  web/            现有浏览器壳
  minigame/       场景、组件、动画和平台端口

platform/
  storage/
  assets/
  input/
  lifecycle/
  telemetry/
```

## 3. 当前文件到目标层的映射

| 当前来源 | 目标层 | 策略 |
| --- | --- | --- |
| `src/game.ts` 中的 ID、类型 | `model` | 先拆出，保留旧 re-export，减少一次性重构 |
| `level-content.ts`、`level-data/*.ts` | `content` | 原样数据化，禁止 UI 复制章节规则 |
| `dungeon-feature-help.ts` | `content/help` | 直接跨端复用 |
| `game-assets.ts` | `content/assets` | 保留 key 和元数据，路径交给 `AssetPort` |
| 战斗、路线、法则、成长模块 | `rules` | 复用纯函数并补跨语言 golden vectors |
| `main.ts` 的 `Saved*` 与 sanitize/normalize | `save-codec` | 从 UI 抽离；补历史 key 扫描和显式 migration |
| `main.ts` 的 `ViewAction` 闭包 | `session` 命令 | 转为可序列化 `GameCommand` |
| `main.ts` 的 `render*`、焦点和 DOM | `clients/web` | 保留 Web；小游戏完整重写 |
| `styles.css` | Web 专用 | 只提取 token 和验收口径 |
| `balance-sim.ts` 与测试 | QA/oracle | 保留并驱动双端状态对照 |
| `smoke-ui.mjs` | Web E2E | 提炼用例语义，在小游戏端建立对应 smoke |

## 4. 平台端口

### 4.1 StoragePort

```ts
interface StoragePort {
  readonly durability: 'write-through' | 'requires-flush';
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
  replaceAtomic(fromKey: string, toKey: string): Promise<void>;
  remove(key: string): Promise<void>;
  listKeys(prefix: string): Promise<string[]>;
  flush(): Promise<void>;
}
```

要求：

- 支持同步或异步平台存储。
- `replaceAtomic` 必须由平台适配器提供同存储域内的原子替换保证；无法保证的平台不得伪装支持，必须用经过强杀测试的事务/journal 实现等价语义。
- session 按第 6.4 节使用临时、正式、备份 key，不允许客户端自行发明不同提交顺序。
- `write-through` 表示 `write/replaceAtomic` 的 Promise 成功时数据已经越过易失缓存；其 `flush()` 可以是可验证的 no-op。`requires-flush` 表示每次 durable ack 前都必须成功执行 `flush()`。适配器必须二选一，不能把仅可读回的缓存写入冒充 durable。
- `flush` 的成功表示此前已确认写入被平台持久化，而不只是进入 JS/引擎缓存。
- 下文所称“durable 校验”统一指：完成写入/原子替换并逐 key 回读；`requires-flush` 适配器再执行 `flush()`，随后重新逐 key 回读；`write-through` 适配器则以写入 Promise 的持久保证和最终回读为准。所有期望 key 的 raw、checksum/元数据和索引必须同时匹配，才能越过该边界。
- rejected/import 原文保护同样受上述 durability 约束，不能把“缓存中可回读”当成已经安全备份。唯一原文所在 key 在 payload、reason/meta 与索引全部 durable 校验成功前不得删除或覆盖。
- 存储失败只改变持久化回执，不得让领域动作重新执行。

### 4.2 SeedPort

```ts
interface SeedPort {
  nextNonZeroUint32(): number;
}
```

`SeedPort` 只允许 session 在创建一条新随机链路前调用。规则函数、codec 和 UI 禁止访问 `Math.random`、平台随机 API、时钟或设备信息。活动局恢复、命令重试和跨副本传送不得重新请求平台随机数；具体入场与传送协议见第 5.2 节。

### 4.3 AssetPort

```ts
interface AssetPort {
  readonly manifestRevision: string;
  resolve(key: string): AssetResult<AssetHandle>;
  preload(group: string): Promise<AssetLoadReport>;
  release(group: string): void;
  fallback(kind: GameAssetKind): AssetHandle;
}

type AssetHandle = Readonly<{
  manifestRevision: string;
  nativeHandle: unknown;
}>;

type AssetErrorCode =
  | 'unknown-key'
  | 'revision-mismatch'
  | 'offline'
  | 'timeout'
  | 'integrity'
  | 'decode'
  | 'quota'
  | 'unsupported'
  | 'cancelled';

type AssetResult<T> =
  | { ok: true; value: T; key: string; revision: string }
  | { ok: false; key: string; revision: string; code: AssetErrorCode; retryable: boolean };

type AssetLoadReport = {
  group: string;
  revision: string;
  loadedKeys: string[];
  failures: Array<Extract<AssetResult<never>, { ok: false }>>;
};
```

`manifestRevision` 是本次构建所用 manifest 的不可变版本或内容 hash；每个成功 handle、fallback handle 和失败报告都必须携带同一 revision，缓存 key 也必须包含 revision。`unknown-key`、`revision-mismatch`、`integrity`、`decode`、`unsupported` 默认不可重试；`offline`、`timeout`、`quota` 默认可在释放/恢复后重试；`cancelled` 是否重试由调用方决定。资源失败进入可见 fallback 和诊断日志，但不得改变领域结果。保留 manifest key，不暴露 Web URL 假设给规则层。

### 4.4 LifecyclePort

```ts
type LifecycleSuspendContext = {
  reason: 'pause' | 'hide';
  remainingTimeMs?: number;
};

type LifecycleFlushResult =
  | { status: 'durable'; durableRevision: number; ledgerRevision: number }
  | {
      status: 'recoverable-timeout';
      durableRevision: number;
      candidateRevision: number;
      candidateLedgerRevision: number;
      recoveryKey: string;
    }
  | {
      status: 'blocked';
      durableRevision: number;
      candidateRevision?: number;
      candidateLedgerRevision?: number;
      error: PersistenceError;
    };

interface LifecyclePort {
  onSuspend(
    listener: (context: LifecycleSuspendContext) => Promise<LifecycleFlushResult>
  ): Unsubscribe;
  onResume(listener: () => void): Unsubscribe;
  onMemoryWarning(listener: () => void): Unsubscribe;
}
```

暂停/隐藏时适配器传入从回调开始计算的剩余毫秒数，并跟踪异步 flush 结果；平台不保证等待 Promise 时，session 仍必须依赖平时逐命令持久化以及可恢复的 tmp，不能把 `onSuspend` 当作唯一保存时机。恢复时先完成 candidate 选择与未 ack envelope 重试，再开放输入，不重复执行最近一条命令。

### 4.5 InputPort

目标不是复制 `MouseEvent.detail`，而是输出标准动作：

```ts
type InputAction =
  | { type: 'activate'; controlId: string; physicalId: string }
  | { type: 'back' }
  | { type: 'navigate'; direction: 'up' | 'down' | 'left' | 'right' };
```

同一 `physicalId` 只能生成一次领域命令。

`physicalId` 只用于一次前端手势内的瞬时去重，不是可跨重启的领域幂等键。适配器只把动作映射成不带 ID 的 `GameCommandIntent`；`GameSession` 是 `commandId` 的唯一生成方。保存重试和崩溃恢复按持久的 `commandId/ledgerRevision/stateRevision` 去重。

### 4.6 LegacySaveTransferPort

旧档交换必须传递 **未经解析、未经规范化、字节保持的 raw 文本**，解析、迁移和拒绝原因只由 `SaveCodec` 负责：

```ts
type LegacyTransferCapability = 'file' | 'clipboard' | 'share-sheet' | 'qr' | 'platform-cloud';

type RawSavePayload =
  | { kind: 'web-local-storage-text'; text: string }
  | { kind: 'external-bytes'; bytes: Uint8Array; encodingHint?: 'utf-8' };

interface LegacySaveTransferPort {
  readonly capability: LegacyTransferCapability;
  importRaw(): Promise<{ payload: RawSavePayload; sourceName?: string } | null>;
  exportRaw(payload: RawSavePayload, suggestedName: string): Promise<void>;
}
```

- Web 适配器优先选择文件选择器/下载；剪贴板只能作为显式降级，不得静默改写换行或编码。
- 小游戏适配器按平台能力选择分享面板、二维码或平台云文件；平台没有可靠双向能力时，发布 UI 必须明确显示“仅导入”或“仅导出”，不能声称互通。
- `importRaw` 返回取消时为 `null`；权限、配额和传输失败属于端口错误。端口不得解码 `external-bytes`，因此非法 UTF-8 不是端口错误。
- localStorage 来源以 JavaScript 字符串 code unit 原样保存为 `web-local-storage-text`；外部文件/分享来源必须先保存原始 bytes，再由 `SaveCodec` 用严格 UTF-8（允许并记录 UTF-8 BOM，拒绝非法字节序列）尝试解析。非法 UTF-8 是 codec 的 rejected save，必须逐字节备份并给出稳定 reason；拒绝备份必须保存 payload kind 与 text 或 base64 bytes，不能只保存解码后的字符串。
- 导出当前档时先从已确认的正式 key 读取 envelope 文本；导出被拒档时读取已经校验成功的 rejected payload。UI 不得先 decode 再 encode，以免丢失原文证据；`exportRaw` 必须按原 kind 输出同 code unit 或同 bytes。

## 5. 命令、seed 与事件层

当前 `main.ts` 大量动作直接：

```text
调用规则函数 → 修改全局 state → saveState → 全量 render
```

迁移时收敛为：

```ts
type DeepReadonly<T> =
  T extends (...args: never[]) => unknown ? T :
  T extends readonly (infer U)[] ? readonly DeepReadonly<U>[] :
  T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } :
  T;

interface GameSession {
  getState(): DeepReadonly<GameState>;
  dispatch(intent: GameCommandIntent): Promise<DispatchResult>;
  retryPendingPersistence(): Promise<PendingRetryResult>;
}

type PendingRetryResult =
  | DispatchResult
  | {
      status: 'no-pending-candidate';
      state: DeepReadonly<GameState>;
      events: readonly [];
    };

type DispatchResult =
  | {
      status: 'invalid-input';
      state: DeepReadonly<GameState>;
      events: readonly [];
      reason: InputValidationError;
    }
  | {
      status: 'committed';
      commandId: string;
      stateRevision: number;
      ledgerRevision: number;
      state: DeepReadonly<GameState>;
      events: readonly GameEvent[];
      persistence: {
        status: 'durable';
        ack: { commandId: string; stateRevision: number; ledgerRevision: number };
      };
    }
  | {
      status: 'duplicate';
      commandId: string;
      stateRevision: number;
      ledgerRevision: number;
      duplicateOfRevision?: number;
      state: DeepReadonly<GameState>;
      events: readonly [];
      persistence: {
        status: 'durable';
        ack: { commandId: string; stateRevision: number; ledgerRevision: number };
      };
    }
  | {
      status: 'rejected';
      commandId: string;
      stateRevision: number;
      ledgerRevision: number;
      state: DeepReadonly<GameState>;
      events: readonly GameEvent[];
      reason: CommandRejection;
      persistence: {
        status: 'durable';
        ack: { commandId: string; stateRevision: number; ledgerRevision: number };
      };
    }
  | {
      status: 'persistence-blocked';
      commandId: string;
      stateRevision: number;
      ledgerRevision: number;
      candidateStateRevision: number;
      candidateLedgerRevision: number;
      state: DeepReadonly<GameState>;
      events: readonly [];
      error: PersistenceError;
    };
```

这是客户端修改领域状态的唯一公开接口。`GameSession` 串行化所有 intent，并在队列内生成内部 `GameCommand = GameCommandIntent & { commandId }`。成功改变领域状态时 `stateRevision` 恰好加一；每个首次处理且得到 `committed` 或 `rejected` 结果的 command 都必须形成持久 receipt，使 `ledgerRevision` 恰好加一。重复 command 不增加任何 revision。返回的 state 必须递归只读，并通过冻结或防御性副本阻止调用方取得可写引用。

`GameCommandIntent` 是下列公开动作的可序列化判别联合，明确不含 `commandId`；内部 `GameCommand` 才在 intent 上附加 ID。`commandId` 只由 session 按 `<commandEpoch>:<monotonicSequence>` 生成；epoch 在安装/账号存档域创建一次并持久化，sequence 严格连续。结构不合法的 intent 在分配 ID 前返回 `invalid-input`，不进入领域队列。分配后的 phase/领域拒绝也必须持久化 outcome，不能留下序号空洞。

envelope 持久保存 `ledgerRevision` 和 `commandLedger = { epoch, highWatermark, receipts }`。`receipts` 至少保留最近 256 条 `{ commandId, outcome, stateRevision, ledgerRevision, eventDigest }`，按 sequence 排序；`highWatermark` 在 committed/rejected receipt 持久化后连续推进。恢复中收到 `sequence <= highWatermark` 的 ID 永远不得重跑 reducer：receipt 尚在时返回其中原 `stateRevision` 作为 `duplicateOfRevision`；receipt 已淘汰时省略该字段、返回当前 durable state/ledger revision，且 `events` 始终为空。持久候选出现跳号、其他 epoch、格式非法或 ledger/revision 不一致时视为坏档，不靠猜测修复。导入旧档时创建新 epoch、0 watermark 和 0 ledgerRevision。

只有正式 key 越过平台要求的 durable 边界并回读验证后，才返回 `committed`/`rejected` 和 durable ack。持久化失败返回 `persistence-blocked`、旧的可见 state 和空 events；session 暂停接受后续领域 intent。UI 的显式“重试保存”和 `onResume` 都只能调用 `retryPendingPersistence()`，由 session 从内存或 tmp 取回同一内部 command/envelope 继续提交；调用方不传 commandId，也不能重新 dispatch 原 intent。没有 pending 候选时返回 `no-pending-candidate`。该方法只完成已经计算的候选，不是第二个领域写入口。UI 不能把 candidate revision 当成已提交事实。

仅大厅可执行的购买、装备、整备、升级、任务领取和 `EnterDungeon`，既要由 session 在入队/分派边界检查，也要由纯领域 reducer 检查 `phase === 'hub' && run === undefined && combat === undefined`。session 守卫提供快速失败，领域守卫是不可绕过的最终约束；这类分配 ID 后的拒绝仍写入 ledger receipt。UI 隐藏按钮不构成守卫。探索、战斗和结果页命令同样由 reducer 校验合法 phase。

示例命令：

```text
BuyItem
EquipItem
PrepareTacticalLoadout
EnterDungeon
MoveToNode
ResolveEventChoice
ResolveLawChoice
PerformCombatAction
CapturePet
ResolveExit
RetreatRun
ClaimTaskReward
```

UI 不应直接：

- 修改 `GameState` 字段。
- 解析 raw `lawState` 决定路线。
- 自己扣货币或发奖励。
- 从当前大厅配置重建 run 快照。

领域事件用于表现：

```text
CombatStarted
DamageApplied
BossAwakened
NodeDiscovered
LawChoiceRequired
LootGranted
RunSettled
SaveRejected
```

动画可以丢帧，但事件对应的领域状态不能重复结算。

### 5.2 `EnterDungeon` 与传送 seed 协议

新接口不得保留可选 seed 的随机兜底。`EnterDungeon` 必须提供以下二选一输入：

```ts
type SeedRulesVersion = 1;
type NonZeroUint32 = number; // runtime 校验 1..0xffff_ffff 的安全整数

type SeedBundle = {
  rulesVersion: SeedRulesVersion;
  hiddenTaskSeed: NonZeroUint32;
  infernoMapSeed?: NonZeroUint32;
};

type RunSeedInput =
  | { kind: 'bundle'; seeds: SeedBundle }
  | { kind: 'root'; rulesVersion: SeedRulesVersion; rootSeed: NonZeroUint32 };

type SeedLineageV0 = {
  rulesVersion: 0;
  hiddenTaskSeed?: NonZeroUint32;
  infernoMapSeed?: NonZeroUint32;
};

type SeedLineageV1 =
  | {
      rulesVersion: 1;
      source: 'root';
      rootSeed: NonZeroUint32;
      hiddenTaskSeed: NonZeroUint32;
      infernoMapSeed?: NonZeroUint32;
      portalDerivationRoot: NonZeroUint32; // 必须等于 rootSeed
      portalHopIndex: number;
    }
  | {
      rulesVersion: 1;
      source: 'bundle';
      hiddenTaskSeed: NonZeroUint32;
      infernoMapSeed?: NonZeroUint32;
      portalDerivationRoot: NonZeroUint32; // infernoMapSeed ?? hiddenTaskSeed
      portalHopIndex: number;
    };

type SeedLineage = SeedLineageV0 | SeedLineageV1;

type EnterDungeon = {
  type: 'EnterDungeon';
  dungeonId: DungeonId;
  protocolId: RunProtocolId;
  seedInput: RunSeedInput;
};
```

现代公开入场命令不暴露 `routeContractId`：隐藏契约只能由 `hiddenTaskSeed` 在探索中发现。旧档中已有的路线契约由 codec 恢复到活动 run；legacy 内部兼容函数可以保留历史参数，但不得进入 v2 客户端 API。

规则如下：

1. 普通/困难入场的 bundle 必须有 `hiddenTaskSeed`，且不得带无意义的 `infernoMapSeed`；炼狱 bundle 两者都必须存在。新入场只接受 `rulesVersion: 1`；0、缺失、越界、非整数或未知版本均拒绝命令，不得补随机数。version 0 只允许由 Web v1 codec 在恢复活动 run 时产生。
2. root 模式使用固定的版本化标签派生：`entry:hidden-task:<dungeonId>` 与 `entry:inferno-map:<dungeonId>:tier:<infernoTier>`。version 1 的 `derive(root, label)` 精确定义为：`h = (2166136261 ^ root) >>> 0`；依次读取 UTF-8 编码的 `seed:v1:${label}` 每个 byte，执行 `h = Math.imul(h ^ byte, 16777619) >>> 0`；最终 `h === 0` 时返回 `1`，否则返回 `h`。任何实现语言必须使用同一 byte 序列和 uint32 溢出。
3. 实际使用的来源、`rulesVersion`、root（仅 root 模式）、`hiddenTaskSeed` 和炼狱 `infernoMapSeed` 必须写入 run 的 `seedLineage`。root 模式的 `portalDerivationRoot` 必须等于 `rootSeed`；bundle 模式固定为 `infernoMapSeed ?? hiddenTaskSeed`，因此炼狱 bundle 使用首次入场地图 seed，非炼狱 bundle 也有唯一的备用传送根。`seedLineage` 同时持久化 `portalHopIndex`（初值 0）。恢复只读快照，不重新派生或取随机。
4. 跨副本传送保留同一 `hiddenTaskSeed` 链。若目标仍为炼狱，使用 `seedLineage` 的 derivation root、递增且持久化的 `portalHopIndex` 和标签 `portal:inferno-map:<sourceDungeonId>:<sourceNodeId>:<targetDungeonId>:hop:<n>` 派生目标地图 seed。`n` 是命令提交后要写入的新 hop；重放同一 `commandId` 返回原结果，不得再次增加 hop。
5. 普通传送、稳定传送、强闯、错位落点和所有跨副本传送共用上述规则。传送 reducer 收不到合法 lineage 时必须拒绝/安全终止传送，不能调用随机源或按当前时间补值。
6. `rulesVersion` 改变意味着 seed 算法版本改变；旧 run 始终按其持久化版本恢复，不能用当前版本重算。
7. 导入时仍在进行的 Web v1 run 建成 `SeedLineageV0`。有 `hiddenTaskSeed` 时继续复用；缺失时只禁用本局隐藏契约，不从其他 seed 补值。有 `infernoMapSeed` 的炼狱局在每次跨副本后把结果写回该字段，并持续使用公式 `((previousInfernoMapSeed + targetDungeonTier * 0x9e3779b1) % 0xffff_ffff) || 1`；缺失时只安全终止依赖它的炼狱传送。version 0 只持续到该 run 结算，新局永远创建 `SeedLineageV1`。

Web v1 当前仍会在缺 seed 时调用 `Math.random()`；它只用于冻结行为对照。v2 的 session 负责从 `SeedPort` 取 root 或完整 bundle，再调用领域 reducer。

## 6. 存档迁移设计

### 6.1 先固化 Web v1 导入

建立：

```ts
decodeWebV1(payload: RawSavePayload): LoadResult
```

必须复制当前的：

- 字段级 sanitize。
- 装备/库存/快照归一化。
- 新材料默认 0。
- 遭遇替换映射。
- 炼狱地图修复。
- 非法活动 run 的安全回大厅。
- HP 0 活动局的失败结算。
- 坏档原文和原因保留。

### 6.2 使用稳定主键或历史扫描

推荐正式主键：

```text
infinite-flow:save
```

envelope 示例：

```json
{
  "schemaVersion": 2,
  "contentVersion": "2026.07.31",
  "checksumRulesVersion": 1,
  "savedAt": 0,
  "stateRevision": 0,
  "ledgerRevision": 0,
  "commandLedger": {
    "epoch": "install-or-account-epoch",
    "highWatermark": 0,
    "receipts": []
  },
  "checksum": "sha256:...",
  "state": {}
}
```

`envelope-checksum:v1` 与第 7.1 节的领域状态对照 hash 是两套用途不同的协议。checksum 输入是 envelope 中除 `checksum` 自身以外的全部字段，包含 schema/content/checksum version、`savedAt`、`stateRevision`、`ledgerRevision`、完整 `commandLedger` 和 `state`；按 RFC 8785/JCS canonical JSON 编码为 UTF-8 后计算 SHA-256，写成 `sha256:<64 位小写 hex>`。因此候选选择所依赖的 revision、epoch、watermark 和 receipts 都受保护，不能直接拿“排除这些字段”的 state hash 代替。

迁移链：

```text
Web save:v1
  → decode + normalize
  → schema v2
  → atomic save
  → 保留一次 import backup
```

未知未来版本不能降级读取后覆盖。

### 6.3 存档样本库

至少保存这些 golden fixtures：

- 新档大厅。
- 完成整备、尚未入场。
- 探索中，包含已侦察和已清理节点。
- 法则选择 pending。
- 普通战斗中。
- Boss 觉醒阶段。
- 结果页等待归档。
- 炼狱随机地图与隐藏契约。
- 旧无携行快照 run。
- 旧单功法 `methodSnapshot`。
- 缺失同伴、功法、血统等快照的 run。
- 两个遭遇替换前旧档。
- 可修复局部坏字段。
- 完全无法解析的坏档。

### 6.4 串行提交、回执与崩溃恢复

固定 key（均不得嵌入 schema 版本）：

```text
正式档    infinite-flow:save
临时档    infinite-flow:save:tmp
正常备份  infinite-flow:save:backup
拒绝原文  infinite-flow:save:rejected:<timestamp-or-commandId>
拒绝原因  infinite-flow:save:rejected:<timestamp-or-commandId>:reason
拒绝索引  infinite-flow:save:rejected:index
导入原文  infinite-flow:save:import:<importId>
导入元数据  infinite-flow:save:import:<importId>:meta
导入索引  infinite-flow:save:import:index
```

session 对每条命令执行同一串行协议：

1. session 在串行队列中分配下一 `commandId` 并查重；纯 reducer 对合法 command 只计算 tentative state/events/outcome。领域拒绝同样生成 tentative rejected outcome，但不改变 state。
2. tentative 结果尚不可由 `getState()`、订阅者或 UI 观察，也不得播放事件。新 command 的 `ledgerRevision + 1`；仅当状态改变时 `stateRevision + 1`，否则保持不变。为 committed/rejected outcome 新增 receipt 和 checksum，形成不可变候选 envelope。
3. 把完整候选 envelope 写入临时 key 并回读校验 raw、checksum、两种 revision 和 receipt。这是 reducer 后的第一个持久化点；在它之前强杀只会保留旧正式状态。
4. 若正式 key 存在且可校验，先将其写入正常备份并回读校验；正式档不可解析时先走拒绝原文协议，不得用它覆盖最后一份正常备份。
5. 通过 `replaceAtomic(tmp, formal)` 提升为正式档。`requires-flush` 适配器随后必须 `flush()`；`write-through` 已由 replace Promise 提供持久保证。完成所需 durable 边界后，再回读确认 checksum、两种 revision 和 receipt。**这个成功回读是唯一 commit point。**
6. commit point 前任一步失败都不公开 tentative state/events；保留可恢复 tmp（若已写入），返回 `persistence-blocked` 并锁住后续领域命令。同一内部 command 重试时先检查 tmp/正式 ledger：已有候选则继续 promote/确认，绝不重跑 reducer或重新消费 seed。
7. commit point 到达后，session 原子切换可见 state、发布首次 events 并返回 committed/rejected durable ack。临时 key 清理或事件订阅者异常只记诊断，不得回滚、降级为 blocked 或改变 ack；若在公开/ack 前强杀，重启从正式档恢复，同 ID 只返回 duplicate 且不重发 events。

`ack(commandId, stateRevision, ledgerRevision)` 的定义是正式 key 已持久包含该 outcome receipt；仅完成领域计算、写入临时 key 或读到尚未 flush 的缓存都不能 ack。dispatch 默认等待 durable，因此不会出现“内存连续提交多条、持久化落后多个 revision”的分叉状态。

启动/强杀恢复按以下确定顺序执行：

1. 分别读取临时、正式、正常备份，不在读取阶段删除任何 raw。
2. 校验 schema、checksum、`stateRevision`、`ledgerRevision` 和 `commandLedger`；未知未来版本不是候选，但必须视为受保护 raw。
3. 在覆盖或删除任何位置前，先把该位置所有无效/未知 raw 写成 rejected payload/reason/index，并按 4.1 节完成三者的 durable 校验：`requires-flush` 必须 flush 后再逐字节回读，`write-through` 也必须在持久写 Promise 后最终回读。任一写入、flush、备份或索引验证失败都阻断恢复并保留原 key。未知未来版本占据正式 key 时永不自动覆盖；即使 tmp 有效也必须先让用户导出并显式决定。
4. 有效候选按最高 `ledgerRevision` 选择，并验证 `stateRevision`、watermark 和 receipt 一致。同一 ledgerRevision 的多份 envelope 只有逐字节相同才可按“正式>临时>备份”去重；内容不同视为 split-brain 并阻断，不吞掉任一 raw。
5. winner 是较新的临时档时，用原子替换提升、满足对应 durability 要求并回读确认；正式无效且备份有效时，也只有在第 3 步的 rejected 备份完成后才可恢复备份。
6. 恢复后直接读取持久 `commandLedger`；下一条 sequence、ledgerRevision 和 stateRevision 从已确认值递增。任何 `sequence <= highWatermark` 的重试都不得执行 reducer。

`onPause/onHide` 的语义是：停止接收新领域命令，让当前 tentative 候选尽量完成上述提交，并调用 `StoragePort.flush()`。生命周期回调以 `durableRevision` 区分已确认正式档，以 `candidateRevision/candidateLedgerRevision` 描述尚在 tmp 的候选；超时必须留下可恢复 key 和诊断记录，普通存储失败返回 blocked。`onResume` 先完成候选恢复/同 command 重试，再开放输入。平时每条 dispatch 已等待对应适配器的 durable 边界，生命周期 flush 只是最后一道保证，不是主要保存路径。

拒绝记录以不可变 ID 成对保存 payload/reason，并在 `infinite-flow:save:rejected:index` 中记录 ID、payload kind、创建时间和两个 key。索引更新也必须写临时索引并原子替换；payload、reason、正式索引三者必须一起通过 4.1 节的 durable 校验后，记录才算 sealed，才允许覆盖或删除其来源 key。启动时用必选的 `listKeys('infinite-flow:save:rejected:')` 交叉修复索引，保证重启后仍能发现、配对和导出 rejected raw。删除拒绝记录必须是显式用户动作。

成功导入也必须先把原 payload 保存为不可变 `import:<importId>`，元数据记录 kind、来源、创建时间和迁移后正式 revision，并通过 `import:index` 持久索引；text 按 code unit、bytes 按 base64 可逆保存。payload、meta、正式索引必须一起通过 4.1 节的 durable 校验，之后才可提交 schema v2、报告导入完成或允许来源删除。import backup 默认长期保留，可由用户在成功导出或确认后显式删除；启动时以 `listKeys('infinite-flow:save:import:')` 修复索引。

### 6.5 Web v1 raw 迁移与转移端口

`LegacySaveTransferPort.importRaw()`、历史 key 扫描和显式粘贴得到的 `RawSavePayload` 都进入同一个 `decodeWebV1`。端口不解码 external bytes；严格 UTF-8/BOM 判断属于 codec，非法序列进入 rejected 协议。迁移成功后先按上述 import 协议持久保留 code-unit 或逐字节 backup，再按 6.4 节提交 schema v2；迁移失败时先让 rejected payload/reason/index 全部通过相应 adapter 的 durable 校验，原 Web v1 key 或外部文件绝不由 codec 删除。`exportRaw` 只负责交付原 payload，不承担 sanitize、migration 或 envelope 重写。

## 7. 跨语言确定性

如果核心仍运行 TypeScript，可直接共享算法。若迁到 C++、Lua 或其他语言，建立同输入同输出向量：

- FNV/hash 的 UTF-16 行为。
- `Math.imul`。
- uint32 溢出。
- seed 递推。
- 数组排序稳定性和同分 tie-break。
- 百分比、伤害、奖励和词条取整。

测试向量至少覆盖：

- 同 seed 的炼狱完整拓扑。
- 同 seed 的隐藏路线契约。
- 三轮回响候选。
- 装备随机词条。
- 重复装备的比较与分解结果。

### 7.1 canonical state hash

双端对照统一使用 `canonical-state-hash:v1`，禁止各客户端用“稳定 stringify”自行猜测：

1. 输入是 codec 已完成 migration/normalize 后的完整领域 `GameState`。客户端动画、焦点、资源 handle、时钟和 telemetry 不得进入 `GameState`；除此之外不允许为了让 hash 相等而临时删字段。
2. hash payload 固定为 `{ hashRulesVersion: 1, schemaVersion, contentVersion, state }`。所有稳定 ID、数组顺序、snapshot、pending、settlement 和 seed lineage 都保留；存储 envelope 的 `savedAt`、`checksum`、`stateRevision`、`ledgerRevision` 和 `commandLedger` 不进入 payload。
3. payload 只能包含 JSON 的 null/boolean/string/number/array/object。`undefined`、hole、NaN、Infinity、`-0`、BigInt、循环引用直接报错；不得静默转 null 或丢 key。领域数值必须是安全整数，若未来引入小数须先升级 hashRulesVersion。
4. 按 RFC 8785/JCS 生成 canonical JSON：对象 key 按 UTF-16 code unit 排序，数组保持原序，字符串按 JSON 转义，数字使用 ECMAScript JSON 表示。编码为 UTF-8，无 BOM、无尾随换行。
5. 对字节串计算 SHA-256，输出 64 位小写十六进制。fixture 同时保存 canonical JSON、UTF-8 byte length 和 hash，失败报告第一个结构差异路径，不能只报告 hash 不同。

至少提供空大厅、普通入场、炼狱地图、pending 法则、Boss 觉醒、跨副本传送、结算页和 Web v1 迁移档的跨语言 golden vectors。hash 算法或投影发生任何变化都必须提升 `hashRulesVersion` 并保留旧 fixture 解释器。

## 8. 迁移阶段

### 阶段 0：冻结基线

交付：

- 本知识库。
- Web v1 存档样本。
- 当前目录和资源 manifest 快照。
- 关键命令前后状态 fixture。
- 全量单测、UI smoke 和资源审计结果。

退出条件：

- 能说明当前每个稳定 ID 的来源。
- 能在 Web 上恢复关键生命周期状态。

### 阶段 1：拆出 model/content/rules

做法：

- 从 `game.ts` 拆 ID、值对象、状态类型。
- 规则模块只依赖 model/content。
- 让 `game.ts` 暂时 re-export，保持 Web 测试继续通过。
- 禁止新纯规则代码访问 `window`、DOM、Vite、时钟和隐式随机。

退出条件：

- Web 行为不变。
- 规则包可在无浏览器环境运行。

### 阶段 2：抽 save-codec 与 GameSession

做法：

- 把 `Saved*`、sanitize、normalize 和 migration 从 `main.ts` 抽出。
- 实现稳定 key 或历史 key 扫描。
- 实现 `LegacySaveTransferPort`，将平台 raw 交换与 codec 解耦。
- 将 UI 动作转为不带持久 ID 的 intent，由 `GameSession` 串行分配唯一 `commandId`，并只经 `dispatch` 修改状态。
- 按 state/ledger 双 revision 串行提交、持久化和 ack；补 pause/强杀/坏档备份故障注入。
- 将平台 seed 注入 session，删除领域层全部隐式随机兜底。

退出条件：

- 同命令不能重复结算。
- 活动 run/combat 可由 codec 往返。
- 坏档原文可导出，且 rejected backup 失败时唯一原文仍在。
- 强杀发生在 tmp、backup、promote、ack 任一边界时都恢复到唯一合法 revision。

### 阶段 3：小游戏最小竖切

路径：

```text
新档大厅
→ 妖塔整备
→ 入场
→ 地图移动
→ 普通战斗
→ Boss 双阶段
→ 出口结算
→ 返回大厅
→ 杀进程后恢复
```

先验证状态、存档、seed、资源和输入，不追求全部视觉精修。

### 阶段 4：接入共享系统

顺序建议：

1. 战术携行与战利品袋。
2. 任务、指令、宠物、功法、同伴、血统。
3. 装备成长、随机词条、器魂、铭刻和委托。
4. 回响、侵蚀、追兵、协议和隐藏路线契约。
5. 章节法则。

### 阶段 5：按章节批次迁移

建议批次：

- 1–4：环境状态与基础路线。
- 5–8：行为记录、封存和双锚。
- 9–13：pending 选择与 Boss 快照。
- 14–16：资源支付、同伴和幸存者状态。
- 17–19：证据、录制、扫描和动态路线。

每批结束都跑跨端状态对照，避免最后才发现 law 语义被 UI 复制错误。

### 阶段 6：平台硬化

覆盖：

- 前后台和强杀恢复。
- 存储失败与空间不足。
- 低内存资源释放。
- 分包、弱网和下载失败。
- 安全区、窄屏、字体放大。
- 多点触摸、快速连击和系统返回。
- 日志、崩溃和存档诊断。

## 9. 不要这样迁移

- 不要把 `src/main.ts` 整体复制后替换 DOM API。
- 不要在 UI 脚本中重写章节门禁和奖励公式。
- 不要把 localStorage JSON 当作“无需版本设计”的临时数据。
- 不要在读档时从当前大厅装备补全旧 run 快照。
- 不要依赖图片文件名、显示名或数组位置作为稳定身份。
- 不要一次性加载全部 187 张资源。
- 不要用平台实时随机替代已持久化 seed 链。
- 不要在领域函数中为缺失 seed 调用 `Math.random`、时钟或平台 API。
- 不要把写入临时 key 当成持久化 ack，也不要在重试保存时重跑命令。
- 不要在 rejected backup 回读成功前删除唯一坏档原文。
- 不要因移动端空间不足删除帮助背景。
- 不要只验证第一章就批量声明 19 章已迁移。

## 10. 最大风险排序

1. 存档版本号嵌入 key，未来版本可能看不到旧档。
2. `main.ts` 混合存档、命令、DOM 和焦点，直接移植会复制业务分支。
3. `game.ts` 与 `dungeon-laws.ts` 是大型聚合器，分包前需要稳定拆解策略。
4. 跨语言 PRNG、hash、排序和取整可能造成候选与地图漂移。
5. 小游戏生命周期下的异步保存可能与动作重复提交冲突。
6. 19 章冻结快照若被 UI 重推导，会产生读档作弊和状态漂移。
7. 浏览器无障碍与响应式行为必须重写，不能计入核心复用率。
8. 传送若在目标副本临时补 seed，会让恢复和跨端 hash 在同一命令序列下漂移。
9. 资源 revision 未进入缓存和错误报告时，灰度发布会混用两版 manifest。

## 11. 迁移完成定义

只有同时满足以下条件，才算“完成迁移”：

- 19 章内容、稳定 ID、帮助和资源都可访问。
- 相同 seed 与命令序列得到相同领域结果。
- Web v1 正常档可导入，坏档可保留原文。
- 所有领域随机均来自已持久化、带 rulesVersion 的 seed 输入，含跨副本传送。
- 命令由唯一 `GameSession` 串行提交，commandId、state/ledger 双 revision、ack 和强杀恢复协议通过故障注入。
- hub/explore/combat/result 均可在进程重启后合法恢复。
- 所有入场冻结语义保持。
- 完整通关、撤退、濒死、跨副本和失败结算一致。
- 目标端 UI 符合触控、安全区、可读性与渐进披露契约。
- canonical state hash 与资源 manifest revision 契约通过双端对照。
- 验收清单中的阻断项全部通过。
