# HUD 抽卡 · 第二轮设计约定

用户明确否定第一轮全部方案：图标偏大；角色/血量区域不需要背景。这一轮重新设计，避免大块材质面板。
只修改 prototype/hud-menu-draw。保留卡组交互与现有真实游戏背景，不改正式游戏。

## 必须遵守

- 全部10款的 .hud-top 和 .hud-vitals 必须 background:none、border:0、box-shadow:none；不要用伪元素或大渐变伪装另一块背景。
- 角色按钮本身也无填色底板，不使用大圆章/大头像/方形块。
- 顶部信息直接落在场景上，以 1~3px 细暗 text-shadow 保证字可读；禁止宽大黑色底板、阴影块或模糊玻璃。
- 所有 SVG 图标可见尺寸统一40逻辑像素（上次30~34，稍微放大），物理390px时约21px。角色与右侧四入口都只展示居中的图标，不显示名称；按钮保留aria-label便于辅助技术识别。
- 角色按钮透明点击区域仍 >=110×110 逻辑像素；右侧四入口连续排列，行高 max(86 逻辑像素, 44 实际像素)，缩短间距时保留实际至少44px的点击高度。不能把透明热区做成可见块。
- 顶部不展示区名、“临时试玩”和“刷新丢失进度”；只保留角色图标、生命数字和细血条。血量24~26逻辑像素。
- 五入口维持角色、菜单、背包、地图、目标名称和交互；可以改变图标/文字的相对排布和位置。
- 三组交付分别覆盖01–03、04–06、07–10；每款应有视觉组织差异，不能仅改色。
- 限定 .hud-layer[data-design="xx"] 作用域。各组仅写原有group.css与group.js，覆盖旧内容。
- 入口名称在原型中不可见，五个图标居中；底层通用CSS由主代理维护。

## DOM

舞台 .game-stage 750×1334，窄屏下最小实际宽305px。
```
.hud-layer.is-compact[data-design="01"]
 header.hud-top
  button.hud-btn.hud-character[data-ui="character"]
   span.hud-glyph > svg (viewBox48, currentColor)
   span.hud-btn-label 角色
  div.hud-vitals
   div.hud-hp-line > span 生命 + strong.hud-hp-text 102 > small /102
   div.hud-hp-track > i width:var(--health)
 nav.hud-rail
  button.hud-btn.hud-menu[data-ui="menu"] > span.hud-glyph > svg + span.hud-btn-label 菜单
  button.hud-btn.hud-bag[data-ui="bag"] > glyph+label
  button.hud-btn.hud-map[data-ui="map"] > glyph+label
  button.hud-btn.hud-quests[data-ui="quests"] > glyph+label
```
.hud-top absolute top20 left20 right20 height120；character左0 top0；vitals top24。03/10保留生命数字与血条横排，其余保留各款血条形状。
.hud-rail absolute top20 right6；四入口同列、gap0、宽132，行高随舞台缩放保留实际44px点击高度；图标统一40×40居中，label隐藏，不增加背景或外框。09也显示图标。整组比上一版右移12逻辑像素，在390px预览中约6px。
通用.is-compact布局仅作用于01–10，包括单张、对比和总览；现用current基线保留原样。

## 元数据

export const variants=[{id:'01',name:'...',material:'一句短风格',description:'一句设计描述',features:['两三条具体特点'],tradeoff:'具体取舍',recommended:false},...]
不在用户文案里解释CSS、逻辑像素或实现。可标记1个推荐。
