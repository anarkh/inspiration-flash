# 怪物素材对照原型

在 `infinite-flow-wechat/` 项目根静态服务下访问：

http://localhost:8125/prototype/monster-world/

页面只使用原生 HTML、CSS 和 JavaScript，无构建步骤、外部依赖或图片加工。

- 59 项来自 `art-source/monster-world/prompts.json`，保持原顺序；每项并列引用旧肖像和新全身 PNG。
- 支持中文名称、身份描述、英文 ID 搜索；空格分隔的关键词同时匹配，连字符和下划线视为空格。
- 新图可切换为 CSS 棋盘背景或真实 `dungeon-world/demon_tower_1-v1.png` 的中央地面片段。
- 全部项目在同一页，图片使用固定高度、`object-fit: contain` 和原生 lazy loading；点击图片可打开原 PNG。
- 不包含人工验收状态。图片读取失败时显示资源错误。

`index.html` 中的静态卡片是清单的 59 项快照；清单增删时应同步卡片。页面未写入其他运行时或游戏配置。

静态校验已核对 59 个唯一 ID、59 个旧图路径、59 个新图路径与清单一一对应且均存在。浏览器视觉验收由主任务统一执行。
