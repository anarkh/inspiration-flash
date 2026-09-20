# 工具链与验证

## 1. 工具链分层

首阶段同时面对三套环境，不能把其中一套的通过结果替代另一套：

| 层 | 用途 | 首阶段要求 |
| --- | --- | --- |
| Node.js | registry 校验、TypeScript 自检和自动 fixture | 命令可在仓库内重复执行，不依赖全局 CLI |
| Cocos Creator | 场景、组件、资源导入和小游戏构建 | 版本、构建参数、插件和 package revision 必须固定 |
| 微信开发者工具/真机 | 分包、生命周期、存储、触控和发布包验证 | 工具版本、基础库、设备/系统与包 revision 必须进入证据 |

生产构建已在 `toolchain/cocos-toolchain.lock.json` 固定 Cocos Creator 3.8.8 与 `wechatgame` 平台；新版 `cocos/cocos-cli` 只用于能力探测，不能替代 Creator 3.8.8 的生产构建。探针固定为提交 `0a29db2afb3b21e22cc7e614d9e99d4fe215131b` / `0.0.1-alpha.38`，默认安装在 `~/.local/share/cocos-cli`。本次实现环境已从该提交完成引擎编译、CLI build、13 项工具下载，并用 `node dist/cli.js --version`/`--help` 验证可执行入口；`npm run toolchain:check` 会报告提交与构建版本，但探针缺失/漂移只作为诊断，不阻断 Node/headless 或生产 Creator 构建。

目标工程拥有自己的锁文件和 TypeScript 工具链，不依赖 Web 项目的 `node_modules`。
本次可重复验证固定为 Node 26.7.0、npm 11.19.0、TypeScript 5.9.3；微信开发者工具
和基础库版本仍须在第一个真实候选中固定。

## 2. 首阶段命令

从 `infinite-flow-wechat/` 执行本地与 manifest 门禁：

```bash
node --experimental-strip-types scripts/verify-acceptance-manifest.ts
node --experimental-strip-types scripts/verify-acceptance-manifest.ts --list
node --experimental-strip-types scripts/verify-acceptance-manifest.ts --ac AC-RELEASE-001
npm run toolchain:verify
npm run wechat:bundle:self-check
npm run wechat:output:snapshot:self-check
npm run build
npm run dist:es2020:verify
npm run source:verify
npm run typecheck
npm run platform:verify
npm run cocos:race:test
npm run test:migration:self-check
npm test
npm run verify
```

首次检出先用精确锁文件执行 `npm ci`。只有在修复安装本身时，才可临时使用同仓
Web 项目的已锁定二进制作 bootstrap 诊断：

```bash
../infinite-flow/node_modules/.bin/tsc -p packages/core/tsconfig.json
../infinite-flow/node_modules/.bin/tsc -p packages/runtime/tsconfig.json
../infinite-flow/node_modules/.bin/tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler --lib ES2022 scripts/verify-acceptance-manifest.ts
```

不要调用全局 `tsc`，也不要假设开发者机器上的 Cocos CLI 或微信开发者工具版本与
构建机一致。`toolchain:verify` 会对 Node/npm/TypeScript 精确版本和 Creator 版本解析
合同做门禁。根 `build` 按 core → runtime → application → save-codec → client →
presentation 的依赖顺序执行；`dist:es2020:verify` 从 Cocos 入口递归发现这六个运行时
依赖，检查其 resolved `target/lib`、全部 export target、所有构建后 JavaScript 的
ES2020 语法以及 ES2021+ 内建调用。根 `verify` 在构建后和包测试后各运行一次该门禁，
再运行源码边界、资源/验收清单、类型和平台自检，避免 clean clone 因缺少 `dist` 得到
伪失败。`cocos/headless` 中使用 Node 26/ES2022 的平台自检只属于测试 harness，不进入
Creator assets 或发布依赖图；产品侧六包与 Cocos headless 编译合同均为 ES2020。各包
若提供 `self-check` 或 package-local 脚本，应以包内 README/`package.json` 为准，并把
实际命令与 exit code 归档。

Creator 3.8.8 构建面板会按当前选择分别导出 bundle fragment。先分别导出 `config` 与
`resources`，再严格合成完整 base config；不要手写 bundle `root` 或删除不认识的
Editor 字段：

```bash
npm run wechat:editor-config:compose -- \
  --fragment /path/to/config-only.json \
  --fragment /path/to/resources-only.json \
  --output /path/to/wechat.editor-composed.local.json
```

composer 要求至少两个 fragment、除 `bundleConfigs` 外完全深等，并核对 Creator
3.8.8/微信平台、`config`/`resources` root、UUID 和 output；输出采用 `0600` 独占写入。
renderer 保留合成配置，只覆盖 pinned profile 字段。可先生成无真实凭证模板：

```bash
npm run wechat:config:render -- \
  --base /path/to/wechat.editor-composed.local.json \
  --output /path/to/wechat.remote.local.json \
  --mode remote \
  --template
```

模板配置可用真实 Creator 构建，但结果永远不可发布：

```bash
export COCOS_CREATOR_BIN="/path/to/CocosCreator.app/Contents/MacOS/CocosCreator"
export COCOS_WECHAT_BUILD_CONFIG="/path/to/wechat.remote.local.json"
npm run build:wechat:template
```

2026-08-12 本机 Creator 3.8.8 已执行该路径并返回成功协议；严格 verifier 复核了 425
个输出文件，其中主包 49 个文件/6,798,993 bytes，远程 resources Bundle 376 个文件/
22,354,964 bytes，187 项资源全部可追踪。`remoteBundles` 精确为 `resources`，本地主包
不存在 `assets/resources`，只保留版本化 bundle 脚本；`config` 保持本地。报告固定为
`NON_RELEASE_TEMPLATE_BUILD_VALID`、`releaseEligible:false`，不能替代真实 AppID/CDN。

生产 remote 配置只从环境读取 AppID 和 CDN 基址，并将 manifest revision 固定进 HTTPS
路径。`resources` metadata 已静态绑定 remote-only Creator preset；旧
`subpackage-smoke` 只保留兼容登记，并由所有配置门禁以项目策略不兼容拒绝。仓库的
4 MiB 数值只是保守证据边界，不代表当前微信平台限制：

```bash
COCOS_WECHAT_APPID='真实 AppID' \
COCOS_WECHAT_REMOTE_BASE_URL='https://已加入微信白名单的资源域名/基础路径/' \
npm run wechat:config:render -- \
  --base /path/to/wechat.editor-composed.local.json \
  --output /path/to/wechat.production.local.json \
  --mode remote \
  --production

npm run wechat:config:verify -- \
  --config /path/to/wechat.production.local.json \
  --mode remote \
  --production
```

随后显式提供 Creator 可执行文件和已验证配置：

```bash
export COCOS_CREATOR_BIN="/path/to/CocosCreator.app/Contents/MacOS/CocosCreator"
export COCOS_WECHAT_BUILD_CONFIG="/path/to/wechat.production.local.json"
npm run build:wechat
```

构建脚本从 macOS App bundle 的 `CFBundleShortVersionString`（其他平台回退到受限
`--version` 探针）读取实际 Creator 版本；不可验证或不等于 3.8.8 时 fail closed。
它随后执行根 `verify`、真实 Creator declarations 类型检查，并要求配置通过
release-eligible remote profile：真实非 sentinel AppID、版本化 HTTPS server、187 资源
revision 和保留的 Editor bundle root。调用 Creator 前还必须绑定 clean Git candidate：
`HEAD`、`HEAD^{tree}` 和 `git status --porcelain=v1 -z --untracked-files=all`；任意 tracked、
staged 或 untracked 变化都会 fail closed。配置精确解析出的 output leaf 必须预先不存在，
脚本不会自动删除旧产物。Cocos bare workspace imports 根据六个 package 的 exports 实际
解析到 `packages/{core,runtime,application,save-codec,client,presentation}/dist`；由于 dist
被 Git 忽略，构建脚本另行绑定其中全部 regular files 的相对路径、字节 hash、文件 identity
以及 package resolution，symlink 和特殊对象直接拒绝。macOS 启动桥保留已取证 Creator
主 Mach-O 的
只读 FD，重验完整 SHA-256 并从该 FD 取得 active-architecture CDHash；桥源码以锁定
SHA-256 捕获后作为 `-c` 字节交给 root-owned Python，解释器以 `-I -S -E` 运行，且
解释器、标准库搜索目录及其父目录都必须 root-owned 且不可 group/other 写。启动环境
会移除 `DYLD_*`、`LD_*`、`PYTHON*`、`NODE_OPTIONS`、`NODE_PATH`、
`ELECTRON_RUN_AS_NODE` 与本地配置路径变量。

构建配置复制到一个已 unlink、`0400` 且仅保留只读 FD 的匿名对象；Creator 只收到
`configPath=/dev/fd/198`。最终 FD hash 后，桥以 `POSIX_SPAWN_START_SUSPENDED` 按
canonical path 创建尚未执行用户态指令的子进程，再用 `csops` 要求已加载主镜像的
CDHash 与保留 FD 一致且同时具有 `CS_VALID|CS_KILL`；不一致即先杀死、再返回固定
错误。构建配置在匿名 snapshot 前完成 production 验证，验证 SHA 必须与 snapshot 的
源 attestation SHA 相同。合同测试在“最终校验完成、`posix_spawn` 尚未解析路径”的精确测试缝替换原
executable 与源配置：替代 executable 的 `main` 不会执行，Creator fixture 仍只读到
匿名 FD 的原配置；成功 interposition + exit 0 也单独覆盖。最后按 Creator 3.8.8 的
退出码协议处理 `36`（成功）、`32`（参数错误）和 `34`（构建失败）。`36` 后仍须通过
第二次 candidate/profile/resource/config/Creator attestation，并确认同一 output leaf 在本轮
由不存在变为真实目录；之后才运行产物门禁：远程/分包布局、`settings.assets`、
`game.json`、187 条资源 trace、native payload、包体保守边界以及
package/bundle/tree SHA-256。只有全部通过才报告带 HEAD/tree/status digest 的成功。
产物 verifier 返回后还会重复同一组 candidate/profile/resource/dist/config/Creator 复核，
避免 verifier 读取窗口内的输入漂移被成功日志遗漏。
本地微信配置不得提交，日志和边界错误不得输出 AppID 或 CDN URL。

output tree 的语义检查只读取首次稳定捕获的 bytes：每个 regular file 从原 pathname
使用 `O_RDONLY|O_NOFOLLOW` FD，读取前后 `fstat` 必须稳定，且关闭前后 pathname
`lstat` 必须仍与该 FD identity 一致；symlink 和特殊对象直接拒绝。canonical root 与
全部目录 identity 同样被记录并在扫描末尾复核。语义检查之后，verifier 完整执行第二次
稳定扫描，root identity、目录/文件 path set、inode、bytes/hash 和既有
package/bundle/tree fingerprint 任一漂移都会 fail closed。仓库 manifest、187 个 resource
及对应 `.meta` trace 也以稳定 no-follow 捕获，并在返回前进行第二次 identity/hash 比对。

该实现受 Node 文件系统 API 边界限制：它提供逐文件 no-follow FD 和目录/root 双扫描，
不声称具有内核 `openat` 式祖先目录锁定，也不抵抗同 UID 主体预先持有的写 FD、对
verifier 的调试/进程控制或 root。无需 Creator 的
`npm run wechat:output:snapshot:self-check` 覆盖正向 fixture、file/root symlink、三个
冻结 JSON pathname 的同长度 inode 替换、冻结 bytes 语义，以及末次复扫时的 path
增删、内容、目录和 canonical root identity 漂移。

该边界只绑定当前构建的**主签名 Mach-O/CDHash**与**匿名配置 FD**，不声称冻结整个
`.app` bundle 或其资源。它阻断的是当前构建进程内最终校验后的 pathname/config
替换；不抵抗能控制/调试该 Node、Python 或子进程的同 UID 主体（包括 signal、
`ptrace`/task control）、创建匿名快照前已持有写 FD 的主体或 root。真实 Creator
3.8.8/Electron 已在 2026-08-12 的 NON_RELEASE 模板构建中完整消费 `/dev/fd/198`；
production 仍必须用真实 AppID/CDN 重复同一边界。模板成功不扩大该威胁模型。

## 3. manifest 校验语义

校验器执行以下只读检查：

- 文件存在且为合法 JSON，根 schema/acceptance version 和 ID pattern 与冻结协议一致。
- 原始文件 SHA-256 与源快照一致，防止稳定 ID、fixture 或精确预期静默改义。
- 恰有 103 个唯一 case，全部为 P0，字段非空且 kind 与 ID 规则一致。
- 分区与 case 顺序逐项一致，数量为 94/6/2/1。
- `--ac` 恰好选择一个稳定 ID；未知或零结果失败。

它不运行领域 reducer、Cocos smoke 或真机步骤，因此输出使用 `MANIFEST_VALID`，不使用 `PASS`。

独立 runner 使用 `npm run test:migration -- --ac <ID>` 执行单个稳定 ID；全部 103 项
都有显式 registration，未实现项固定返回 `BLOCKED/2`。当前只有 `AC-HASH-001`、
`AC-SEED-002` 和 `AC-ASSET-002` 拥有完整自动 fixture。普通 PASS 不构成正式 evidence；
带 `--evidence` 的执行要求 clean Git identity 与仓外独占 evidence 目录，并从该 HEAD 的
Git blobs 在另一个仓外 `0700` 临时目录重建 core/runtime/application/save-codec/client/
presentation。六个 output root 必须从不存在开始；构建固定使用已绑定 realpath、版本、
内容 hash 与 identity 的 Node/npm/TypeScript，资产 case 另绑定实际 esbuild 平台 binary 的
realpath/version/content/identity，并拒绝 binary override。
候选 ignored `dist` 只有在完整 path/bytes/hash 与 workspace resolution 都和隔离重建一致、
且全部是无 symlink 的 regular files 时才可进入 import；实际 case import 隔离重建产物，
不会执行任意已有 `dist`。runner 在 import 前后、case 后、case evidence 写入后和 identity
seal 写入后重复 HEAD/tree/status、固定 materialized build-input path/content/identity、
工具链、执行/候选 dist content/identity/resolution 和闭合 import graph 复核。可信系统 Git
使用绝对路径和净化环境，禁用 replace objects、复算 blob OID 并做 strict reachable-object
检查；Node loader/preload/import/conditions flags 与 `NODE_OPTIONS`/`NODE_PATH` fail closed。
`case-evidence.json` 与 `identity-attestation.json` 绑定 source/toolchain/dist 三个
canonical hash；构建失败或任一窗口漂移都撤销 release eligibility，且
`identity-drift.json` 会使已经写出的 seal 失效。隐藏 provisional hardlink 完成双 dist/Git/
toolchain 复核后，临时构建目录必须清理成功，才发布最终 seal；不覆盖候选产物。自检 override
只产生 `SELF_TEST_ONLY`/`releaseEligible:false` 的 synthetic 文件。

build-input 闭包是已审查的固定 tsconfig、六包 `src/**`、package metadata、core
postprocessor、已取证 TypeScript 与 sibling dist 图；它不是执行恶意 config/postprocessor 的
OS sandbox。本地 evidence 与 marker 都是 owner-writable，不能抵抗同 UID/受控进程、恶意
candidate code、自隐藏 preload、动态代码加载或瞬时 swap/restore。正式交付必须由独立 CI
生成，并转存至不同所有者的 WORM/签名存储后再作为不可变证据引用。

## 4. Cocos 与微信构建约束

- Cocos 脚本只能通过共享包公开入口消费领域类型与规则，不能相对穿透到 Web `src/`。
- 平台 API 只能出现在适配层；core/runtime 的纯协议测试不得需要 Cocos 全局对象或微信 API。
- 资源按稳定 key 和不可变 `manifestRevision` 寻址；Cocos UUID、bundle 路径和远端 URL 是适配细节。
- 微信分包、缓存和弱网失败必须得到带 key/revision/code 的可诊断结果，fallback 不改变领域结算。
- `onHide`/`onShow` 不能充当唯一保存机制。每条已确认命令需要先越过正式 key 的 durable commit point。
- UI 输入先归一为 `InputAction`；同一 `physicalId` 只生成一次领域 intent，持久幂等由 session 的 `commandId`/ledger 负责。

## 5. 可复现构建记录

每个候选至少记录：

```text
candidateId=
gitSha=
packageVersion=
nodeVersion=
typescriptVersion=
cocosCreatorVersion=
wechatDevtoolsVersion=
wechatBaseLibraryVersion=
schemaVersion=
contentVersion=
rulesVersion=
hashRulesVersion=
manifestRevision=
acceptanceManifestSha256=
```

版本字段、构建日志、产物 hash 和测试输出先写入独占 candidate 目录，再整体转存到不同
所有者的 WORM/签名存储；本地 owner-writable 目录本身不称为不可变。仅在聊天中贴一张
运行截图不构成迁移证据。

## 6. 验证层级

1. 静态层：core/runtime 类型检查、禁止 API 扫描、manifest 校验。
2. 纯规则层：同 seed/命令向量、canonical JSON/hash、存档 codec 与故障注入。
3. 引擎层：Cocos 场景 smoke、资源加载/释放、输入与 UI 状态映射。
4. 平台层：微信开发者工具与真实设备上的前后台、强杀、配额、弱网、低内存、安全区和触控。
5. 发布层：冻结 leaf/release/attestation 证据后，只读派生最终结果。

上层通过不能补偿下层缺失；例如 Cocos 场景能启动不能证明领域一致，纯规则测试通过也不能证明真机生命周期安全。
