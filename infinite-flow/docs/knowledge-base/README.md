# 《无限流》迁移知识库

这套知识库服务于两个目标：

1. 让后续开发者快速理解当前 MVP 的产品语义、玩法规则、内容目录和状态边界。
2. 将来迁移到小游戏、App 或其他客户端时，只替换平台与表现层，不因界面简化而丢失设计背景、稳定 ID、存档兼容和局内快照语义。

## 当前基线

| 项目 | 当前值 |
| --- | --- |
| 知识库核对日期 | 2026-07-31 |
| 应用 | `infinite-flow` |
| 技术栈 | TypeScript、Vite、Vitest、浏览器 DOM |
| 主流程阶段 | `hub` → `explore` → `combat` → `result` |
| 章节 | 19 |
| 道具 | 30 |
| 装备 | 65（7 件初始装备 + 58 件成熟装备） |
| 怪物 | 59 |
| 宠物 | 6 |
| 功法 | 7 |
| 血统 | 4 |
| 同伴 | 3 |
| 局内回响遗物 | 9 |
| 装备记忆 | 19 × 58 = 1102 个组合 |
| 隐藏路线契约 | 57 |
| 主神任务 | 63（19 主线 + 44 支线） |
| 主神指令 | 19 |
| 任务奖励点总计 | 5560 |
| 存档 envelope | `version: 1` |
| 机制帮助版本 | `DUNGEON_FEATURE_HELP_VERSION = 17` |
| 机制帮助条目 | 23 |
| 资源清单版本 | `GAME_ASSET_MANIFEST_VERSION = 1` |
| 运行时资源 | 187 |

这些数字已通过当前源码、测试约束和资源审计交叉核对。历史文档中的 56/63 件装备、57 个怪物、1064 个装备记忆组合或 183 个资源，只代表当时版本。

## 按问题找文档

| 想回答的问题 | 文档 |
| --- | --- |
| 这个游戏为什么这样设计，哪些语义不能删？ | [01-product-semantics.md](01-product-semantics.md) |
| 永久状态、本局状态、战斗状态和派生状态如何区分？ | [02-domain-state-and-save.md](02-domain-state-and-save.md) |
| 19 章、稳定 ID、成长系统和内容目录有哪些？ | [03-content-catalog.md](03-content-catalog.md) |
| 美术、资源 key、帮助弹层和移动端交互要保留什么？ | [04-assets-and-ui-contract.md](04-assets-and-ui-contract.md) |
| 怎样拆包并迁移到小游戏？ | [05-mini-game-migration-plan.md](05-mini-game-migration-plan.md) |
| 怎样证明迁移后没有丢内容或改规则？ | [06-migration-acceptance-checklist.md](06-migration-acceptance-checklist.md) |
| 哪些迁移验收 ID 被固定登记？ | [migration-acceptance-manifest.json](migration-acceptance-manifest.json) |
| 业务域和流程的机器可读图在哪里？ | [../../.understand-anything/domain-graph.json](../../.understand-anything/domain-graph.json) |

## 信息权威顺序

发生冲突时按以下顺序判断：

1. 当前 UI/命令入口可达的新局创建、状态转移和结算路径，以及直接覆盖这些路径的当前回归测试。
2. 当前源码中的稳定类型、目录与规则函数；它们解释现行数据和规则，但“被导出”不等于“当前入口会调用”。
3. `src/dungeon-feature-help.ts` 的跨端机制文案。
4. `src/game-assets.ts` 的资源 key 与运行时映射。
5. legacy 存档解码、归一化分支、历史目录和兼容测试；它们只对“旧数据如何被读取”权威，不得单独用来推导现代新局的菜单、默认值或流程。
6. 本知识库。
7. 根目录 `README.md`。
8. `PLAYTEST-*.md` 历史试玩报告。
9. `dist/` 构建产物或某次运行截图。

判定“现行流程”时必须从入口做可达性核对，不得把静态扫描到的旧函数、可选字段或 legacy 测试当成现代玩法。反之，`legacy_auction_court` 这类名称含 legacy 的稳定内容 ID 仍可能是现行内容，不能按字面名称排除。也不要从显示名、CSS 类名、图片文件名或旧试玩报告反推稳定 ID。

## 迁移时的单一真源

| 内容 | 权威源 |
| --- | --- |
| 当前产品入口与现行流程 | `src/main.ts` 的当前 UI/命令绑定 + 被调用的领域函数 + 对应新局回归测试 |
| 核心 ID、`GameState`、`DungeonRun`、`CombatState` | `src/game.ts` |
| 章节顺序、章节聚合、怪物目录 | `src/level-content.ts` |
| 19 章地图与叙事原文 | `src/level-data/*.ts` |
| 章节法则、地标、选择、Boss 快照 | `src/dungeon-laws.ts` |
| 路线门、区段与动态边 | `src/dungeon-routes.ts` |
| Boss 定义、阶段与出口封印 | `src/boss-system.ts` |
| 章节事件与风险选项 | `src/dungeon-events.ts` |
| 机制帮助 | `src/dungeon-feature-help.ts` |
| 资源 key、路径、尺寸、裁切、来源 | `src/game-assets.ts` |
| 存档校验、归一化、坏档备份 | `src/main.ts`，迁移前应抽成独立 codec |
| legacy 兼容 API 与历史目录 | 存档 codec/归一化分支及其兼容测试；仅用于旧档恢复，不作为新局入口 |
| 回归事实 | `src/*.test.ts`、`scripts/smoke-ui.mjs`、`src/balance-sim.ts` |

`../../.understand-anything/domain-graph.json` 是业务域与主流程的机器可读导航图，用于定位领域、步骤和源码落点；它不是所有稳定 ID、目录条目、帮助文案或资源的完整 manifest，不得用节点数量替代上述单一真源的内容计数。

## 知识库更新规则

以下改动必须同步更新本知识库：

- 增删稳定 ID、章节、目录内容或任务。
- 修改 `GameState`、`DungeonRun`、`CombatState` 或存档 envelope。
- 新增、删除或改变入场冻结快照。
- 修改章节法则、Boss 门禁、出口结算、撤退或濒死结算。
- 修改帮助 ID 或帮助字段含义。
- 更换资源 revision、尺寸、裁切规则或 manifest key。
- 改变小游戏迁移边界或平台适配接口。

更新时至少执行：

```bash
npm run knowledge:verify
npm test -- --run
npm run typecheck
npm run assets:audit
npm run smoke:ui:all
```

如果只改文档，可用链接和事实核验代替完整 UI 回归，但不能在未验证源码的情况下更新目录数字。

文档事实核验至少包含：

- Markdown 相对链接：遍历 `docs/knowledge-base/**/*.md` 中的相对链接，以链接所在文档为基准解析路径；目标文件必须存在，带锚点时还必须命中目标 Markdown 的实际标题锚点。
- 内容计数：从权威导出或可执行审计中重新计算章节、道具、装备、怪物、宠物、功法、血统、同伴、回响、装备记忆、隐藏路线契约、主神任务、主神指令、任务奖励点总数、help ID 和资源 kind；逐项比对本页基线、根 README 以及 03/04 文档中的可枚举明细，不用文件名或 legacy 符号的文本出现次数代替业务计数。
- 领域图 schema：`domain-graph.json` 根对象必须包含 `version`、`project`、`nodes`、`edges`、`layers`、`tour`；节点 ID 必须唯一，类型和必填字段必须符合 schema，每条边的 `source`/`target` 必须引用存在的节点。
- 领域图源码定位：每个带源码落点的 step 必须有相对项目根的 `filePath` 和两个正整数组成的包含式 `lineRange: [start, end]`，且 `start <= end`、文件存在、`end` 不超过实际行数；该行段应仍能定位节点所描述的符号或行为。
- 领域图新鲜度：`project.analyzedAt`、`project.gitCommitHash` 与 `project.description` 中的 `sourceFingerprint=sha256:...` 必须可解释。记录的提交必须是当前 HEAD 的祖先，源码指纹覆盖所有节点引用文件；任一被引用源码发生业务修改，都必须重新生成或修订领域图、刷新指纹并重跑 schema、边引用和 `lineRange` 校验；仅修改文档排版可不刷新。
- 验收 ID：`06-migration-acceptance-checklist.md` 中的表格 ID 必须与独立的 `migration-acceptance-manifest.json` 完全一致，leaf/release 分组、顺序、总数和唯一性都由门禁核对，防止删掉一行后“自动发现”仍然误绿。

`npm run knowledge:verify` 已把递归 Markdown 链接、精确源码内容计数、根 README 与 03/04 明细、验收 ID registry、领域图完整结构、边引用、源码行号、祖先提交基线与源码指纹编排为统一门禁。源码段是否完整表达节点摘要仍需独立人工复核；测试、资源审计和真实 UI smoke 也按上方命令独立执行。

## 历史文档如何使用

- `PLAYTEST-IMPROVEMENTS-2026-07-24.md`：可复用渐进披露、触控面积、状态解释等验收原则；其中问题清单不是当前 backlog。
- `PLAYTEST-ROUNDS-2026-07-29.md`：可了解缺陷如何收敛；端口、服务状态、旧资源数量和当时基线不是当前事实。
- `art-source/README.md` 与 `art-source/prompts/*.md`：仍是美术生产背景和重新出图的重要资料源。
- `dist/`：只用于运行验证，不是迁移输入。

## 维护者快速上手

建议按以下顺序阅读：

1. 本索引和产品语义。
2. 状态与存档模型。
3. 只阅读当前要迁移的章节或系统目录。
4. 阅读平台迁移计划和验收清单。
5. 再进入源码实施，避免先看 `src/main.ts` 的 DOM 细节而误把 Web 实现当成产品规则。
