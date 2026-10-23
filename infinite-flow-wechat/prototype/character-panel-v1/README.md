# 角色面板原型 v1

游戏「角色信息」面板的交互原型：角色（纸娃娃 + 属性）、携行、灵宠、同伴、血统、功法六个页签，以及「装备与养成」子页。数据和操作来自游戏真实 ViewModel 与 reducer（`adapter.ts`），图标取自 Cocos 资源清单，只影响本页演示进度。

```sh
node prototype/character-panel-v1/build-adapter.mjs   # 用当前游戏源码重建演示数据
python3 -m http.server 8762 --bind 127.0.0.1           # 在 infinite-flow-wechat 根目录
```

<http://127.0.0.1:8762/prototype/character-panel-v1/index.html#pets>

- 进度：`?preset=prepared`（主神空间·整备中，多只灵宠/同伴/血统/功法）、`new`（初入空间）、`run`（副本中，只读）。
- 宽度：`?w=320` 切到小屏；`#overview`、`#carry`、`#pets`、`#companions`、`#bloodlines`、`#methods` 选页签，`#equipment` 直接打开「装备与养成」。

| 页签 | 内容 |
| --- | --- |
| 角色 | 左右七个装备槽围绕立绘，下方属性框；主神空间里有「装备与养成」入口 |
| 携行 | 携行槽 n/3 与六种携行道具，点卡片装入或卸下；副本中只读 |
| 灵宠 / 同伴 / 血统 / 功法 | 各占一个页签：顶部写明同时可带几个、在哪里生效；卡片列出已拥有的条目与关键属性，点卡片设为出战 / 激活 / 常用，下次入场生效；未拥有时写明去哪里获得；副本中只读显示本局阵容 |

「装备与养成」只列装备；养成类（灵宠、同伴、血统、功法）各在自己的页签更换。游戏已按此实现，入口改名「更换装备」。
