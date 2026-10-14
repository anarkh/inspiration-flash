# 十款副本传送门 · HTML 原型

[打开 HTML 对比页](http://127.0.0.1:8125/prototype/dungeon-portals-ten/index.html)

针对现用石门的正视透视、亮边与副本场景不协调的问题，制作十款独立透明 PNG。页面复用实际妖塔、地铁、矿井背景与人物图集，支持统一切换背景、场景 / 素材模式、畅通 / 未开放状态。点击任一方案可与现用门对比，支持上一款 / 下一款循环、Escape 关闭与焦点返回。

## 方案与完整提示词

全部使用内置 `image_gen.imagegen`，每款独立生成一次，要求透明背景。原始生成文件逐字节复制到 `assets/`，没有裁切、抠图、调色或重编码。各文件对应的 `.result.json` 记录源路径、SHA-256、尺寸与透明度检查。

| 编号 | 方案 | 主要差异 | 原图 | 完整提示词 |
| --- | --- | --- | --- | --- |
| 01 | 残檐石阙 | 中式残檐、宽石柱 | [PNG](assets/portal-01.png) | [prompt](assets/portal-01.prompt.txt) |
| 02 | 无顶双碑 | 无梁无拱、高低断碑 | [PNG](assets/portal-02.png) | [prompt](assets/portal-02.prompt.txt) |
| 03 | 地面符环 | 贴地石环、低亮刻痕 | [PNG](assets/portal-03.png) | [prompt](assets/portal-03.prompt.txt) |
| 04 | 断阶下行 | 下行阶梯、残破矮栏 | [PNG](assets/portal-04.png) | [prompt](assets/portal-04.prompt.txt) |
| 05 | 斜裂石隙 | 不规则残壁、裂隙入口 | [PNG](assets/portal-05.png) | [prompt](assets/portal-05.prompt.txt) |
| 06 | 铁栅雾门 | 方形门框、半抬铁栅 | [PNG](assets/portal-06.png) | [prompt](assets/portal-06.prompt.txt) |
| 07 | 悬符结界 | 木柱、悬符、灰白雾幕 | [PNG](assets/portal-07.png) | [prompt](assets/portal-07.prompt.txt) |
| 08 | 枯木山门 | 朽木横梁、扭曲断根 | [PNG](assets/portal-08.png) | [prompt](assets/portal-08.prompt.txt) |
| 09 | 玄镜通路 | 八角旧铜镜、暗水镜心 | [PNG](assets/portal-09.png) | [prompt](assets/portal-09.prompt.txt) |
| 10 | 残壁暗口 | 方形门洞、厚重断墙 | [PNG](assets/portal-10.png) | [prompt](assets/portal-10.prompt.txt) |

02 和 07 的雾较明显，保留生成结果用于比较；03、04 为贴地入口，06、07、08 为宽轮廓。场景模式统一使用 `122 × 167` 门体容纳框和 `104 × 104` 人物基准，图片按底部中心 contain，因此宽轮廓的可见高度会更低。素材模式放大观察形制，不代表正式游戏尺寸。场景背景截取相同区域用于比较，不连接游戏的坐标、移动或门禁逻辑。

## 范围

新增内容仅在本目录。未替换当前 Cocos 素材、修改资源清单、运行逻辑或存档。页面无外部依赖、无持久化写入，采用普通脚本和相对资源路径。以 HTTP 链接预览；未验证浏览器的 `file://` 模式。

现有本地静态服务需以 `infinite-flow-wechat/` 为根目录。如需独立启动，可在此项目目录运行 `python3 -m http.server 8125 --bind 127.0.0.1`（已有同端口服务时直接复用）。

## 验证

- `node --check app.js` 通过。
- 十张 PNG 均为 RGBA、哈希互异，均与对应生成原始文件 SHA-256 一致。
- 页面、脚本、样式、十款 PNG、三个背景、人物和现用门，共 18 个资源 HTTP 200。
- 实际浏览器验证十款切换与原图链接、首尾循环、三个背景、入口状态、素材模式、新旧对比、Escape 关闭和焦点返回。
- 320 × 568、390 × 844、默认桌面 1280 × 720 无水平溢出，设置按钮高 44px，浏览器警告 / 错误记录为空。移动端对比上下排列并可滚动。
- 修正了手机设置组的额外空行后复查布局；临时视口已恢复，展示页保留打开。

[资源检查](proof/static-validation.json) · [浏览器检查](proof/browser-validation.json)

[场景总览](proof/scene-overview.jpg) · [素材总览](proof/assets-overview.jpg) · [新旧对比](proof/comparison-desktop.jpg) · [手机 320](proof/mobile-320.jpg) · [手机 390](proof/mobile-390.jpg)
