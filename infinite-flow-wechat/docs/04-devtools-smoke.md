# DevTools 本地试玩 Smoke 纵切（NON_RELEASE）

本文档记录 `wechatgame-devtools-smoke` 派生副本的边界、命令和证据口径。该纵切
只回答一个问题：**已验证的 NON_RELEASE 微信构建能否在本机微信开发者工具里跑起来**。

## 它不是什么

- 不是 release 构建，不是 release evidence，不得用于上传或发布。
- **DevTools 可玩 ≠ 真机/发布/持久性验收**：不证明真机行为、CDN/HTTPS、弱网、
  缓存、存储持久化、内存/性能或任何发布门禁。
- 不使用、不读取、不输出真实 AppID、CDN 或 token。
- 派生目录带有 `NON_RELEASE_SMOKE.md` 与 `devtools-smoke.derived.json` 标记，
  不得复用为 production evidence。

## AppID：小游戏游客号

派生副本的 `project.config.json` 使用微信官方**公开小游戏游客 AppID**
（DevTools 常量 `GAME_TOURIST_APPID`，UI 显示为 "touristappid"）。它不是任何
个人/企业的真实 AppID，不授予账户能力。

本机证据（DevTools Stable 2.01.2510290，`/Applications/wechatwebdevtools.app`）：

- `Contents/Resources/package.nw/core.wxvpkg` 常量：
  `TOURIST_APPID:"touristappid"`（小程序）、
  `GAME_TOURIST_APPID`（小游戏游客号）。
- `correspondingTouristAppId(devMode)` 对 `MINI_GAME`/`MINI_GAME_ENGINE`
  返回 `GAME_TOURIST_APPID`。
- `getAppId()` 对 game 编译类型在未填 AppID 时默认取 `GAME_TOURIST_APPID`。
- `isTouristAppId()` 同时接受两个游客常量；`createMiniGameProject` 对
  `GAME_TOURIST_APPID` 置 `isGameTourist`。

结论：当前小游戏 DevTools 版本支持游客模式，无需绑定测试号。

## 架构

```
已验证构建 cocos/build/wechatgame（只读，不改）
   │  npm run wechat:devtools-smoke:derive
   ▼
派生副本 cocos/build/wechatgame-devtools-smoke（NON_RELEASE 标记）
   ├─ project.config.json   appid=游客号, setting.urlCheck=false
   ├─ src/settings.*.json   assets.server=http://127.0.0.1:8947/
   ├─ 主包（不含 remote/）  与已验证构建一致
   └─ remote/               22MB 远程 bundle，由 loopback server 提供
                              ▲
                              │ npm run wechat:devtools-smoke:serve
              127.0.0.1:8947 （fail-closed 静态服务，仅 /remote/ 前缀）
```

Cocos 3.8.8 微信适配器对 remote bundle 的加载方式（见
`engine-adapter.js`）：config 从 `remoteServerAddress + "remote/<bundle>"`
拉取，bundle 脚本从主包 `src/bundle-scripts/<bundle>/index.<ver>.js` 本地加载。
因此 loopback server 只需服务 `remote/` 下的 config/import/native，22MB 不会
回到主包。

## 命令

```bash
# 1. 派生副本（幂等；已存在且带 NON_RELEASE 标记时直接重建）
npm run wechat:devtools-smoke:derive

# 2. 启动 loopback 远程资源服务（只监听 127.0.0.1:8947）
npm run wechat:devtools-smoke:serve

# 3. 自检（正例 + 负例，临时副本 + 临时端口，不碰正式副本）
npm run wechat:devtools-smoke:self-check

# 一步到位：派生 + 自检
npm run wechat:devtools-smoke:check
```

`serve` 启动后输出 `LOOPBACK_SERVER_LISTENING` JSON，Ctrl-C 退出。

## 导入微信开发者工具

1. 启动 `npm run wechat:devtools-smoke:serve`，保持运行。
2. 微信开发者工具 → 导入项目 → 目录选择
   `cocos/build/wechatgame-devtools-smoke`（**不是** `wechatgame`）。
3. AppID 选择"游客模式/测试号"（派生配置已写入官方小游戏游客 AppID，
   导入后详情面板应显示 touristappid）。
4. 导入后确认 详情 → 本地设置 → "不校验合法域名…" 已勾选
   （派生配置 `setting.urlCheck=false` 已写入）。
5. 编译试玩。远程资源全部来自 `http://127.0.0.1:8947`，不联网。

## 自检覆盖

`wechat:devtools-smoke:self-check` 在临时副本上断言（36 项）：

- 派生标记：`NON_RELEASE_SMOKE.md`、`devtools-smoke.derived.json`、
  `nonRelease/releaseEligible=false`。
- 配置：游客 AppID、`urlCheck=false`、`assets.server` 指向 loopback、
  `remoteBundles` 含 `resources`。
- 布局：`assets/resources` 不存在（22MB 不进主包）、`remote/resources` 存在、
  bundle 脚本在主包 `src/bundle-scripts/`。
- 正例：版本化 `config.<ver>.json`、一个 native PNG、一个 import JSON 经
  loopback 可读且字节一致。
- 负例：根路径、`/game.js`、编码/明文路径穿越、目录列举、符号链接、
  非 GET 方法全部被拒（403/404/405）。
- 源构建不变：派生前后已验证构建树哈希一致。

## 残余风险

- DevTools 模拟器 ≠ 真机：触控、生命周期、存储、弱网、内存均未验证。
- 游客号不能配置合法域名/上传/预览真机；`urlCheck=false` 仅本地生效。
- loopback server 是开发辅助，不是生产 CDN 替代；不做缓存、压缩或鉴权。
- 派生副本内容随已验证构建变化；重新构建后需重新 `derive`。
- 端口 8947 被占用时 `serve` 会失败；可用 `--port` 调整并同步重新 `derive`。
