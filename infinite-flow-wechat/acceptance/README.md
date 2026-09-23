# 迁移验收 registry

`migration-acceptance-manifest.json` 是 Web 权威 registry 的独立冻结副本。它不是从 Markdown、代码扫描或已有测试自动生成的集合，因此删除实现或测试不会让验收范围跟着变小。

## 冻结合同

| 分区 | 数量 | 作用 |
| --- | ---: | --- |
| `leaf` | 94 | 自动、Cocos smoke、Web oracle 与真机方法的基础阻断项 |
| `releaseEvidence` | 6 | 绑定冻结 leaf 证据的发布场景 |
| `attestation` | 2 | 独立责任人签核与版本追溯 |
| `derived` | 1 | 只读其余 102 项派生最终闭合 |
| 总计 | 103 | 全部 P0，只有 PASS 可放行 |

来源：[Web migration acceptance manifest](../../infinite-flow/docs/knowledge-base/migration-acceptance-manifest.json)。冻结源文件 SHA-256：

```text
9c9da7e7f83c05422b3b1ac2ad77cc0260fd8dcd1b0df2d62f3b5556af4867c7
```

稳定 ID 不可复用；语义变化时新增 ID 并显式废弃旧 ID。不得直接修改 `name`、`methods`、`fixtureId` 或 `expected` 来让已有实现通过。

## 校验

从项目根目录执行：

```bash
node --experimental-strip-types scripts/verify-acceptance-manifest.ts
node --experimental-strip-types scripts/verify-acceptance-manifest.ts --list
node --experimental-strip-types scripts/verify-acceptance-manifest.ts --ac AC-SAVE-008
```

校验器成功只代表 registry 本身完整且选择器非空。AC 的执行状态与证据必须保存在仓外、尚不存在的独占 candidate 目录，不能写回本 manifest；只有在独立 CI 中生成并转存到不同所有者的 WORM/签名存储后，才可称为不可变证据。

## 按 AC-ID 执行

当前 runner 为全部 103 个稳定 ID 建立了显式注册，未实现的 case 会返回 `BLOCKED`
而不会被跳过或误报。每个实现按 method 显式登记；当前只有 `A-AC` 可以执行进程内
fixture。`A-WEB`、`A-SMOKE`、`M-DEVICE`、release/review/derive 方法必须由各自独立执行器
或同 candidate 的密封外部证据完成，给这些方法误填进程内函数会使 registry 失效。一个
`A-AC` PASS 不会提升同 case 中未执行的方法，aggregate 仍为 `BLOCKED` 且不能取得
release eligibility。已有二十八项纯自动 A-AC fixture（共 132 个完整 scenario），runner 自检固定覆盖
923 项合同：

```bash
npm run build
npm run test:migration -- --ac AC-CONTENT-001
npm run test:migration -- --ac AC-COMPAT-001
npm run test:migration -- --ac AC-COMPAT-002
npm run test:migration -- --ac AC-COMPAT-003
npm run test:migration -- --ac AC-COMPAT-004
npm run test:migration -- --ac AC-LAW-01
npm run test:migration -- --ac AC-LAW-02
npm run test:migration -- --ac AC-LAW-03
npm run test:migration -- --ac AC-LAW-04
npm run test:migration -- --ac AC-LAW-05
npm run test:migration -- --ac AC-LAW-06
npm run test:migration -- --ac AC-LAW-07
npm run test:migration -- --ac AC-LAW-08
npm run test:migration -- --ac AC-LAW-09
npm run test:migration -- --ac AC-LAW-10
npm run test:migration -- --ac AC-LAW-11
npm run test:migration -- --ac AC-LAW-12
npm run test:migration -- --ac AC-LAW-13
npm run test:migration -- --ac AC-LAW-14
npm run test:migration -- --ac AC-LAW-15
npm run test:migration -- --ac AC-LAW-16
npm run test:migration -- --ac AC-LAW-17
npm run test:migration -- --ac AC-LAW-18
npm run test:migration -- --ac AC-LAW-19
npm run test:migration -- --ac AC-HASH-001
npm run test:migration -- --ac AC-SEED-002
npm run test:migration -- --ac AC-ASSET-002
npm run test:migration -- --ac AC-ASSET-003
npm run test:migration:self-check
```

每项可执行 fixture 都在 `acceptance/fixtures/manifest.json` 中独立固定文件 SHA-256 与完整
scenario ID 集合。兼容性输入要么完整存于 acceptance fixture，要么引用已有 Web-v1 golden
的固定相对路径和原始 SHA-256；基于 golden 的 mutation 也作为静态输入数据写入 fixture。
预期值与 provenance 必须静态冻结，implementation 只能调用六包或目标适配器的公开 API
产生 actual，不能从候选实现、候选输出或运行时目录重新生成 expected。

- `0`：所选 case 的全部 required methods 为 `PASS`。
- `1`：断言或预期不匹配，状态为 `FAIL`。
- `2`：实现、依赖或所需平台证据缺失，状态为 `BLOCKED`。
- `64`：参数、未知 ID、零选择或 evidence 位置不合法。

普通执行即使返回 `PASS` 也不是正式发布证据；它读取前置 `npm run build` 生成的本地
`dist`，但不会取得 release eligibility。正式 runner 仍会独立执行 clean-HEAD rebuild，
不会信任这些现成产物；现成六包 `dist` 只作为必须与隔离重建逐字节一致的候选输入。
正式 evidence 只允许写入 Git 仓库外、尚不存在的独占目录，并要求执行前后 HEAD、
HEAD tree、index 和 worktree 都保持干净且一致：

```bash
mkdir -p /absolute/evidence-parent
npm run test:migration -- \
  --ac AC-HASH-001 \
  --candidate-id candidate-001 \
  --evidence /absolute/evidence-parent/AC-HASH-001
```

正式 runner 不把任意现有 ignored `dist` 当作 HEAD 的产物。它在仓外 `0700` 临时目录从
已捕获 clean HEAD 的 Git blobs 物化固定 build input，确认六个 `dist` root 预先不存在，
再用锁定并逐文件取证的 Node/npm/TypeScript 按固定依赖顺序重建六包；固定 build-input
path 集合、内容和 identity 会在 build/import/case/write/seal 窗口重复复核，新增 glob 输入也会
阻断。需要 esbuild 的 case 通过 registration capability 声明；当前 `AC-ASSET-002` 与
`AC-ASSET-003` 均声明 `esbuild`，因此 formal attestation 会绑定 capability 集合及实际平台 binary 的 realpath、
版本、内容和 identity，并拒绝 `ESBUILD_BINARY_PATH`。候选六包 `dist` 必须与隔离重建结果
在完整相对路径集合、字节数、SHA-256 和 workspace resolution 上一致，symlink、特殊对象、
增删改名和 stale output 均 fail closed。case 会固定 import 隔离重建的 core、runtime、
application、save-codec、client 和 presentation 六个入口，六个 entry path/hash 均进入
dist attestation，并向 A-AC implementation context 提供对应模块；import
前后、case 后、evidence 写入后及 identity seal 写入后都会复核 Git、工具链、执行 dist、
候选 dist 的 content/identity/resolution；TypeScript AST 枚举的静态/动态 import/export 图也
必须完全留在六包已取证 dist/workspace exports 内。任一步构建失败或漂移都不会 import
旧/部分产物。临时目录在最终 seal 发布前完成清理；清理失败会删除/拒绝 seal，不写回源码或
候选 `dist`。

稳定时目录含 `case-evidence.json`、stdout/stderr hash 和
`identity-attestation.json`；case evidence 与 identity seal 同时绑定可独立复算的
source/toolchain/dist canonical hash（case evidence 自身明确不做循环 self-hash）。任何
capture/import/case/write/seal 窗口漂移都会撤销 release eligibility，并由
`identity-drift.json` 使已有 seal 失效。`INFINITE_FLOW_MIGRATION_SELF_TEST=1` 的 synthetic
运行固定 `selfTestOnly:true`、`releaseEligible:false`，其 `SELF_TEST_ONLY` identity 文件不是
正式稳定 seal。

正式路径使用已绑定 realpath/content/identity/version 的系统 Git 绝对路径，净化 Git 环境、
禁用 replace objects、复算 blob object ID，并在基线/最终窗口执行 strict reachable-object
检查；同时拒绝 `NODE_OPTIONS`、`NODE_PATH` 以及任何 `process.execArgv` loader/import/
conditions 等 flag。evidence parent 与新目录的 realpath、directory identity 和权限也贯穿
写入与 seal 窗口复核，仓内目标继续被拒绝。

这些控制不把本地目录变成不可变存储：`0700/0600` 文件仍可由 owner 重写，且同 UID、受控
runner 进程、恶意候选 case、自删除/自隐藏 preload、动态 `eval`/`createRequire`、瞬时
swap-and-restore 或能删除 drift marker 的外部进程超出本地 attestation 威胁模型。正式结果
必须在独立 CI 的受信 checkout/runner 中生成，并立即把完整目录和 hash 转存到不同所有者的
WORM/签名存储；本地 seal 不能无条件称为不可变。当前工程尚未冻结 clean candidate，因此正式 leaf
PASS 仍为 0/94；二十八项可执行 fixture 不能替代其余 66 个 leaf 或 9 项
release/attestation/derived 链。
