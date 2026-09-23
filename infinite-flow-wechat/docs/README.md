# 《无限流》微信小游戏迁移文档

本目录记录 `infinite-flow-wechat` 的迁移边界、首阶段交付、工具链约束和状态风险。当前项目是现有 Web 游戏的同仓兄弟项目；迁移期间，`infinite-flow` 继续作为行为 oracle，不在目标端重新解释产品规则。

## 阅读顺序

1. [首阶段迁移说明](01-stage-1-migration.md)：本阶段迁什么、不迁什么，以及退出条件。
2. [工具链与验证](02-toolchain.md)：本地命令、Cocos/微信开发者工具边界和证据要求。
3. [状态与风险](03-status-and-risks.md)：当前完成度、非声明项、风险与下一道门禁。
4. [DevTools 本地试玩 Smoke](04-devtools-smoke.md)：无真实 AppID 的 NON_RELEASE 试玩纵切；DevTools 可玩 ≠ 真机/发布/持久性验收。
5. [验收 registry 说明](../acceptance/README.md)：103 个稳定 AC ID 的冻结副本和维护规则。

## 权威基线

本 candidate 以冻结 revision `2645f0232542684d27de1abc321bb26913320420`、验收 manifest 和资源 checksum 为基线。当前 Web HEAD 只用于发现漂移；若要吸收后续 Web 变化，必须显式重跑基线验证并更新冻结 revision/hash，不能静默覆盖本 candidate。本目录只记录迁移执行状态，不替代产品语义。

- [迁移知识库索引](../../infinite-flow/docs/knowledge-base/README.md)
- [小游戏迁移方案](../../infinite-flow/docs/knowledge-base/05-mini-game-migration-plan.md)
- [迁移验收清单](../../infinite-flow/docs/knowledge-base/06-migration-acceptance-checklist.md)
- [源验收 manifest](../../infinite-flow/docs/knowledge-base/migration-acceptance-manifest.json)

当前冻结事实包括 19 章、30 道具、65 装备、59 怪物、6 宠物、7 功法、4 血统、3 同伴、9 回响、57 隐藏路线契约、63 主神任务、19 主神指令与 187 个资源 key。发现差异时先回到权威源码和 Web 回归核对，不在小游戏 UI 中补一套旁路规则。

## 验收 manifest CLI

校验脚本只使用 Node.js 内置模块。以下命令都从 `infinite-flow-wechat/` 执行；Node 需要支持 TypeScript type stripping：

```bash
node --experimental-strip-types scripts/verify-acceptance-manifest.ts
node --experimental-strip-types scripts/verify-acceptance-manifest.ts --list
node --experimental-strip-types scripts/verify-acceptance-manifest.ts --ac AC-CONTENT-001
node --experimental-strip-types scripts/verify-acceptance-manifest.ts --manifest acceptance/migration-acceptance-manifest.json
```

- 无筛选参数：校验冻结摘要、103 个 case、字段、分区、顺序和源快照摘要。
- `--list`：以 TSV 列出全部登记项，供后续 runner 注册 fixture。
- `--ac <id>`：精确选择一个已登记项；未知 ID 或选择结果为 0 时非零退出。
- `--manifest <path>`：验证指定路径，便于做缺文件、损坏或零 case 的负向门禁。

`--ac` 的成功结果是 `MANIFEST_VALID`，不是该 AC 的行为 `PASS`。真正的发布证据仍需实现并执行 `A-AC`、`A-SMOKE`、`M-DEVICE`、`A-RELEASE`、`R-REVIEW` 和 `A-DERIVE` 对应流程。

## 当前阶段的完成定义

阶段一边界与阶段二首章代码竖切已经建立：根脚本可按依赖顺序构建并测试 core/runtime/application/codec/client/presentation，Cocos 场景、移动 UI 和微信平台适配可做 headless 验证；真实 Creator 3.8.8 Preview 和 sentinel 配置的 NON_RELEASE remote 模板构建也已通过。它不表示各包可在 pristine checkout 任意独立 emit，不表示 19 章 UI 已迁完，不表示 Web v1 存档已在真机完成 durable import，也不表示真实 AppID/CDN 的 production 构建、任何正式 leaf、release-evidence 或 attestation 已通过。实时状态以 [状态与风险](03-status-and-risks.md) 为准。
