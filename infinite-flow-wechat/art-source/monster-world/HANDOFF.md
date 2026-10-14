# 59 个怪物世界造型替换 · 会话交接

## 用户最新授权与当前任务

用户要求：开启多个子 agent 替换游戏内怪物模型，以符合现有暗黑无限流游戏风格；随后明确要求至少 30 个子 agent 加速；最后要求添加并发配置并把当前任务迁移到新会话，确保上下文连续且配置生效。此文档记录迁移边界，不表示怪物任务已完成。

必须继续使用工作目录 `/Users/bytedance/.codex/worktrees/108c/inspiration-flash`，游戏目录为其 `infinite-flow-wechat/`。不要切换到 `/Users/bytedance/git/inspiration-flash`，不要新建 checkout，不要覆盖当前脏改动。无需再次询问是否开始生成、集成或验证。

用户配置 `/Users/bytedance/.codex/config.toml` 已添加：

```toml
[agents]
max_concurrent_threads_per_session = 30
```

备份：`/Users/bytedance/.codex/config.toml.before-monster-agents-20260929-180916.bak`。
已以本机 Codex CLI 0.154.0 启动临时 `app-server --stdio --strict-config`，initialize 后 `config/read`（cwd 为此 checkout），确认 effective agents.max_concurrent_threads_per_session=30，origin 为上述用户文件；临时服务已退出。尚须在新会话验证真正可启动的并发数量。旧会话注入上限含主 agent 共 4，第四个子 agent spawn 实测返回 agent thread limit reached；不能把文件读取成功说成旧会话并发已改变。

新会话应第一时间核对实际可用并发，并按用户要求启动至少 30 个子 agent：剩余 32 只可由 28 人各做 1 只、2 人各做 2 只，主 agent 负责集成、验收。为每人指定互不重叠 entityId 与文件所有权，说明不是独自在代码库、不可回退他人改动。若仍受低上限约束，向用户如实说明，保留进度并定位配置覆盖，不反复空跑也不伪称已有 30 个。

## 已完成素材

`prompts.json` 是 59 怪物的身份、参考图、统一英文 prompt、目标文件名权威清单。`handoff-status.json` 给出 27 个已完成 SHA256、32 个待生成 ID。`batch-1-results.json` / `batch-2-results.json` / `batch-3-results.json` 每批各完成 9 个；旧 workers 均已停止且无在途图像任务。**不要重复生成这 27 个。**

现有 27 图均为内置 imagegen 输出原图，1024×1536 RGBA，逐图检查了完整形体与真实透明 alpha。工具预览的透明区 RGB 可能呈黑灰色，但 alpha 检验为透明，不要用 Python 抠图。图源和结果记录都在本目录。只读图像像素/尺寸检查可以用 Pillow；创意生成/编辑必须使用 imagegen。源图不能仅留在 `$CODEX_HOME/generated_images`。

生成流程：读 imagegen SKILL.md → view_image 对应旧 portrait → imagegen prompt=sharedPrompt+subject，referenced_image_paths 传已看过的旧 portrait，transparent_background=true → 保存到 sourceFile 精确文件名。每怪独立出图，禁止用同一通用怪/拼图替代。可并行独立调用。生成后原图直接保存此目录，透明 alpha、身份、完整足/角/肢体和风格逐图验证。只在确实需要时再让 imagegen 修正；不要自行切换付费 API/CLI。

风格：写实手绘、成年比例、略俯视约25°、深炭灰旧铜金、骨白边缘、少量氧化青色光、克制复古科幻，保留各章不同怪物身份。旧怪物 portrait 为 59 个 288×384 RGB 无透明图；世界原先只绘制5种矢量占位，根因是没有消费已有 portrait。新世界图保留原 portrait 与领域规则。

## 当前代码修改（未全部验证、未重建页面）

本次已修改并通过 `npm run build` 与 `npm run typecheck:creator -w infinite-flow-wechat-cocos`：

- packages/presentation/src/types.ts：Explore.currentNode 可选 monsterId。
- packages/presentation/src/view-model.ts：直接投影 currentNode.monsterId，不能按 nodeId 猜怪物（例如 upper_fog_patrol 实际是 fog_lesser_demon）。
- cocos/assets/scripts/ui/scene-visuals.ts：导出 getInfiniteFlowMonsterWorldVisualKey(id)，战斗 opponent=`monster:<enemy.id>_world`；探索仅未清理、无pending的monster节点请求 currentNode.monsterId 对应世界图。
- cocos/assets/scripts/ui/walk-world.ts：WorldTarget 可选 visualAssetKey，探索/战斗使用同一身份。
- cocos/assets/scripts/ui/InfiniteFlowWalkScene.ts：怪物优先渲染 WorldObjectBody → WalkMonsterSprite:<worldKey>；body父节点脚底保持0,0以兼容战斗受击位移复位；透明全图等比contain到156×156，子节点中心height×0.43（按约7%足底留白）；精英1.12、首领1.3；血条/等级标记上移；资源未就绪或失败保留旧drawMonster。

渲染与身份修改尚未通过新的 headless 回归，尚未导入59个资源；旧浏览器仍为上一轮已完成的战斗动画构建（URL http://127.0.0.1:8124/?ui=combat-animation）。不能声称目前网页已换怪物。

## 待完成集成与验证

1. 生成余下32图并核对59/59无重复身份与透明alpha。
2. 新建 cocos/assets/resources/monster-world/，将完整源图导入并维护 .png.meta/目录.meta（仿npc world，新的稳定UUID、hasAlpha=true）。保留59张旧monster portrait；不改共享核心玩法、数值、位置、碰撞、动作绑定。
3. 更新 asset-manifest.json：新增59条 monster:<id>_world；entityId=<id>_world；sourceFile=infinite-flow-wechat/art-source/monster-world/<slug>-world-v1.png，resourceFile=monster-world/<slug>-world-v1.png，role=portrait/fit=contain/sourceRevision=1，按实际尺寸、source/target SHA与transformation登记。总数230→289；kindCounts/formatCounts/derivedAssetCount按现有语义维护，manifestRevision按verify-assets的revisionPayload重算。
4. scripts/verify-assets.mjs 的冻结188条保留：只从originalAssets过滤新增monster-world；添加精确59身份覆盖、RGBA/meta、路径、哈希/尺寸校验。同步 scripts/verify-wechat-build-config.mjs、scripts/wechat-bundle-contract.self-check.mjs、toolchain/wechat-bundle-profiles.json 的289数量/真实总字节/新revision。README/cocos README/platform README当前230要按最终状态同步，不改历史证据段。
5. tests：walk-world.self-check.mjs的570真实节点遍历可添加 monsterId→worldKey、一致探索/战斗断言；bootstrap-race.self-check.mjs需把validManifest加monster world、补fake combat.detail.enemy.id（目前有4处只给kind/chapterContext）、新增world图请求归为supplemental，调整从原3图变为肖像+世界图+玩家+背景4图的加载/释放断言。其中scene-three-images、scene-independent-retries、scene-stale-callbacks、scene-pending-destroy/memory-warning，以及最尾19章background测试opponent断言需更新。别为了绕过新逻辑保持错误fixture。加入真实View脚底、独立形象、首领比例与血条、加载失败fallback、frame释放、战斗动画受击归位检查。
6. 跑 `npm run build`、`typecheck:packages`、`typecheck:creator -w infinite-flow-wechat-cocos`、`assets:verify`、`source:verify`、`cocos:walk:test`、`cocos:race:test`、`wechat:bundle:self-check`。适当复验combat effects及sheet，不需要为纯美术重跑所有领域长测除非改变相关边界。
7. 使用已安装Creator3.8.8重建Web Mobile（成功退出码36，尾部machport错误是已知退出噪声，必须看buildtask finished）：

```sh
'/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator' --project '/Users/bytedance/.codex/worktrees/108c/inspiration-flash/infinite-flow-wechat/cocos' --build 'configPath=/Users/bytedance/.codex/worktrees/108c/inspiration-flash/infinite-flow-wechat/cocos/temp/npc-web-mobile-build.json' > cocos/temp/monster-world-web-build.log 2>&1
```

现有Python server的8124服务cocos/build/web-mobile，无需重复启动。8125服务原HTML prototype，用户原型tab必须保留。
8. CUA浏览器测试实际资源：先读cuadocs；当前IAB browser1，game tab7与prototype tab6（请先清点确认），原viewport已reset。测试320×568首章普通怪/精英/首领以及若干非人形（蛛、炮、无人机）实际加载，不只做HTML图库；可新增静态怪物总览便于59种校验，但不替代游戏。保存实际截图并在最终回复嵌入，标明Web已验证、微信真机未验证。只在明确用户授权迁移的新会话做工作，旧根agent将停止游戏修改。

## 此前已完成内容要保留

战斗六键3×2、不分页、攻击自动普攻/战技、法术/药品两步小面板、原生Graphics攻击/施法/用药动画、基于真实结算帧的回血/反击/死亡时序已全部实现并通过上一轮构建测试。NPC7个world全身形象、carry整備两区切换等都是既有脏改动，勿覆盖。git status大量修改是正常延续；无需commit/PR/版本升级。

上一轮游戏构建与测试结果只属于旧候选；本轮怪物的生成资源尚未注册，不能沿用旧结果冒充完成。
