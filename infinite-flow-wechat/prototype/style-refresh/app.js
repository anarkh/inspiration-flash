/* Standalone art comparison. No game imports, saves, or production mutations. */
(() => {
  'use strict';
  const resource = '../../cocos/assets/resources/';
  const proposed = id => `assets/${id}-proposed.png`;
  // Preserve the approved before/after comparison after production resources move to v2.
  const archivedOriginals = new Set([
    'item/mist-breathing', 'item/iron-body', 'item/cloud-step', 'item/gate-sense',
    'item/star-core-method', 'item/beast-taming', 'item/void-heart',
    'item/titan-marrow', 'item/void-symbiote', 'item/bastion-chitin', 'item/phoenix-ember',
    'equipment/triage-visor', 'equipment/forensic-visor', 'equipment/rebirth-amulet',
    'character/reincarnator', 'npc/companion-guide',
  ]);
  const before = '../../art-source/style-refresh/before/';
  const original = (folder, id) => `${archivedOriginals.has(`${folder}/${id}`) ? before : resource}${folder}/${id}-v1.png`;
  const backgrounds = [
    { id: 'demon_tower_1', name: '妖塔一层', source: original('dungeon-world', 'demon_tower_1') },
    { id: 'starfall_mine', name: '星坠矿井', source: original('dungeon-world', 'starfall_mine') },
    { id: 'dream_archive', name: '梦境档案馆', source: original('dungeon-world', 'dream_archive') },
  ];
  const props = [
    { id: 'chest', name: '副本宝箱', type: '奖励物件', note: '木材与包铜，替代平涂箱体', change: '保留清楚的箱盖、锁扣与开启方向。用磨损木材和旧铜包角连接庭院与副本的实物质感。', current: '替换前程序形状复现：矩形箱体、金色锁扣。' },
    { id: 'exit', name: '副本出口', type: '撤离物件', note: '风化石拱与克制雾光', change: '独立石构出口，以灰青雾气和古旧石雕标出可交互区域；区别于已采用的万象画门与房间切换石门。', current: '替换前程序形状复现：多层椭圆与发光中心。' },
    { id: 'event', name: '事件牌', type: '事件物件', note: '立式告示，保留远距离识别', change: '以木框、旧纸与封缄形成完整实体，保留事件牌的竖向轮廓与可读留白。', current: '替换前程序形状复现：几何牌架与平面纸张。' },
    { id: 'trap', name: '陷阱装置', type: '危险物件', note: '压低轮廓，金属触发结构', change: '用锈铁尖刺与触发机构保留危险辨识。地面机关保持低矮，不遮住行走角色与通路。', current: '替换前程序形状复现：尖角与红色几何标识。' },
    { id: 'survey', name: '勘探装置', type: '勘探物件', note: '旧铜仪器、矿石与石台', change: '用旧铜仪器、石材底座与零散矿石保留勘探辨识度，适配不同章节的地面。', current: '替换前程序形状复现：支架与菱形勘探标识。' },
    { id: 'relic', name: '遗物台', type: '遗物物件', note: '古旧容器，主体集中', change: '在石台上保留单一可辨识的遗物主体，让金属、石材和少量微光承担层次。', current: '替换前程序形状复现：几何底座与悬浮遗物。' },
    { id: 'shrine', name: '共鸣祭坛', type: '祭坛物件', note: '风化石刻，克制共鸣微光', change: '围绕圆形核心组织祭坛，保留仪式感，减少大面积发光造成的悬浮贴纸感。', current: '替换前程序形状复现：平涂台座与共鸣环。' },
    { id: 'law', name: '法则书台', type: '法则物件', note: '实体书页、旧铜与石台', change: '保留打开的书本轮廓，用纸张厚度、铜件磨损和台面阴影接入当前写实场景。', current: '替换前程序形状复现：梯形书台与折页多边形。' },
  ];
  const methodDefinitions = [
    ['mist-breathing', '吐纳诀', '功法', '旧石静坐像，克制吐息'],
    ['iron-body', '铁衣诀', '功法', '旧铁拳甲与磨损边缘'],
    ['cloud-step', '云隙步', '功法', '旧布靴与薄雾'],
    ['gate-sense', '观门法', '功法', '旧门印与裂隙线索'],
    ['star-core-method', '星核炼息', '功法', '星铁核心与局部微光'],
    ['beast-taming', '御灵印', '功法', '旧印与驭灵纹样'],
    ['void-heart', '虚心诀', '功法', '暗色核心与封缄'],
    ['titan-marrow', '巨灵骨髓', '血统', '旧骨质与暗金髓心'],
    ['void-symbiote', '虚界共生体', '血统', '共生体与微弱紫光'],
    ['bastion-chitin', '界壁甲质', '血统', '风化甲质与层叠边缘'],
    ['phoenix-ember', '涅槃余烬', '血统', '灰烬与余温火种'],
  ];
  const methods = methodDefinitions.map(([id, name, type, note]) => ({ id, name, type, note, original: original('item', id), change: '统一为低饱和、可触摸的实体物件；保留原有能力识别色，降低高亮外轮廓与发光面积。请同时检查大图与 48 px 图标的辨识度。', current: '替换前注册原图：亮色描边与插画质感较强。' }));
  const equipment = [
    { id: 'triage-visor', name: '分诊目镜', type: '装备', note: '清除下缘残片', change: '重绘为一件完整的分诊目镜，保留警示灯和镜片层次；原图下缘的相邻物件残片不再保留。', current: '当前源图下缘可见其他物件残片。' },
    { id: 'forensic-visor', name: '溯证目镜', type: '装备', note: '清除下缘残片', change: '保留双镜片与取证用途，整理为完整单物件；收敛扫描光，并清除下缘不属于目镜的片段。', current: '当前源图下缘存在相邻素材片段。' },
    { id: 'rebirth-amulet', name: '复燃胚核', type: '装备', note: '清除右下角残片', change: '保持黑曜外壳与暗红胚心的身份，以完整轮廓替代污染边界，减少外溢光效。', current: '当前源图右下角可见不属于主体的残片。' },
  ].map(item => ({ ...item, original: original('equipment', item.id) }));
  const portraits = [
    { id: 'hero-portrait', name: '轮回者', type: '主角 · 代表方案', note: '与场景束发、青灰衣保持一致', original: original('character', 'reincarnator'), change: '以当前行走形象为准，采用黑发束髻、青灰衣和旧金肩甲，统一皮肤、衣料和背景的绘画质感。此主角肖像已接入游戏；其他角色保留原有素材。', current: '替换前主角原图：暗色战术肖像，偏摄影质感。', identity: '黑发束髻 · 青灰衣 · 旧金肩甲' },
    { id: 'guide-portrait', name: '同行引路人', type: 'NPC · 代表方案', note: '保留灰白长辫与年长引路人身份', original: original('npc', 'companion-guide'), change: '保留年长引路人的灰白长辫、旧褐披袍和旅人身份，收敛摄影景深，增加与当前场景一致的笔触和材质。此处仅提供一个 NPC 示例。', current: '替换前 NPC 原图：写实摄影式肖像。', identity: '灰白长辫 · 旧褐披袍 · 年长旅人' },
  ];
  const groups = [
    { id: 'props', name: '副本物件', number: '01', priority: 'P1 · 补齐实体素材', title: '让副本物件回到同一个世界', description: '宝箱、出口与六种事件物件，统一为低饱和写实实体。切换背景，观察材质、光照与脚点是否融入当前场景。', items: props, mode: 'world' },
    { id: 'debris', name: '碎石障碍', number: '02', priority: 'P1 · 地面融合', title: '把平面多边形换成有重量的碎石', description: '保留低矮、可绕行的障碍轮廓，以灰青石材和自然落地阴影连接现有地面。碰撞范围仍需正式接入时验证。', mode: 'world', items: [{ id: 'debris', name: '副本碎石', type: '障碍物', note: '风化石块与自然落地阴影', current: '替换前程序形状复现：灰绿色平涂多边形。', change: '用风化石块、大小错落与接地阴影替代平面碎石。当前提供一组通用石堆方向；其他章节可按地面材质继续衍生。' }] },
    { id: 'mirror', name: '镜像城', number: '03', priority: 'P1 · 结算横幅', title: '现实与镜像，统一在灰青旧金之中', description: '保留双相城市题材，重做旧横幅。上方显示完整构图，下方模拟结算中的居中 cover 裁切，检查窄画面是否仍然成立。', mode: 'banner', items: [{ id: 'mirror-banner', name: '轮回城镜像', type: '结算横幅', note: '完整横幅与结算裁切', original: `${before}dungeon/mirror-cycle-city.png`, current: '当前原图：青粉底色、几何楼房与亮黄轮廓。', change: '采用同章的写实城市方向，保留现实与镜像的结构对应；主体集中于画面中部，兼顾结算界面的居中裁切。' }] },
    { id: 'methods', name: '功法血统', number: '04', priority: 'P1 · 图标风格', title: '保留能力身份，统一实物质感', description: '7 张功法与 4 张血统，以旧卷、甲片、印章和核心等实体承载原有能力，统一主体比例并收敛发光。', items: methods, mode: 'icon' },
    { id: 'equipment', name: '装备修复', number: '05', priority: 'P1 · 源图质量', title: '每张图，只保留一件完整装备', description: '先处理已确认的三张污染源图。左右完整显示原始 PNG，直接对照下缘与右下角残片；不靠遮罩隐藏问题。', items: equipment, mode: 'icon' },
    { id: 'portraits', name: '人物肖像', number: '06', priority: 'P2 · 两张代表方案', title: '保留角色身份，协调人物画法', description: '先看主角与同行引路人两个示例。以当前全身造型为准，保留年龄、服饰与身份特征，统一皮肤、衣料和背景的写实绘画质感。', items: portraits, mode: 'portrait' },
    { id: 'hud', name: 'HUD 统一', number: '07', priority: 'P2 · 界面规范', title: '主城与副本，使用同一套暖黑旧金界面', description: '用现有背景对照界面方向：低透明度暖黑面板、细旧金边界、灰青状态色与半透明摇杆。布局为 HTML 示意，不增加玩法。', mode: 'hud', items: [{ id: 'hub', name: '主神空间', type: '主城 HUD', note: '蓝灰面板 → 暖黑旧金', change: '将主城的蓝灰面板与摇杆统一为暖黑旧金，用灰青保留生命状态信息。减少边框反差，让视线留在庭院和角色。', current: '替换前样式概括：主城蓝灰面板与蓝色摇杆。' }, { id: 'dungeon', name: '副本探索', type: '副本 HUD', note: '暖色面板与摇杆一致', change: '副本保留暖色方向，统一面板与摇杆的材质、边框和透明度，保证主城到副本的操作区域一致。', current: '替换前样式概括：暖黑面板与金色实心摇杆。' }] },
  ];
  const state = { group: 'props', item: 'chest', background: 'demon_tower_1', guide: false, layout: null, layoutError: null };
  const $ = selector => document.querySelector(selector);
  const elements = { categories: $('#categories'), comparison: $('#comparison'), list: $('#asset-list'), controls: $('#view-controls'), detail: $('#detail-strip'), dialog: $('#image-dialog') };
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const getGroup = () => groups.find(group => group.id === state.group);
  const getItem = () => getGroup().items.find(item => item.id === state.item);
  const getBackground = () => backgrounds.find(background => background.id === state.background);
  const img = (source, alt, className = '', attributes = '') => `<img src="${source}" alt="${escapeHtml(alt)}" class="${className}" ${attributes}>`;
  const previewButton = (source, name, kind) => `<button class="preview-button" data-preview="${source}" data-name="${escapeHtml(name)}" data-kind="${kind}">查看原图 ↗</button>`;
  let lastDialogTrigger = null;
  let sceneObserver;

  function showImageError(event) {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || image.dataset.failed) return;
    image.dataset.failed = 'true';
    const notice = document.createElement('p');
    notice.className = 'error-notice';
    notice.textContent = `图片加载失败：${image.getAttribute('src')}`;
    image.replaceWith(notice);
  }
  document.addEventListener('error', showImageError, true);

  function readHash() {
    const [groupId, itemId] = location.hash.slice(1).split('/');
    if (!groupId) return;
    const group = groups.find(candidate => candidate.id === groupId);
    if (!group) return;
    state.group = group.id;
    state.item = group.items.some(item => item.id === itemId) ? itemId : group.items[0].id;
  }
  function setSelection(groupId, itemId) {
    const group = groups.find(candidate => candidate.id === groupId);
    if (!group) throw new Error(`Unknown prototype group: ${groupId}`);
    state.group = groupId;
    state.item = itemId || group.items[0].id;
    history.replaceState(null, '', `#${state.group}/${state.item}`);
    render();
    $('#live-status').textContent = `已切换至${group.name}，${getItem().name}。`;
  }
  function renderCategories() {
    elements.categories.innerHTML = groups.map(group => `<button class="category-button ${group.id === state.group ? 'active' : ''}" data-group="${group.id}" aria-pressed="${group.id === state.group}"><span class="nav-number">${group.number}</span>${group.name}<span class="nav-count">${group.items.length}</span></button>`).join('');
  }
  function renderList(group, item) {
    $('#asset-count').textContent = group.mode === 'hud' ? '2 个场景' : `${group.items.length} 项`;
    elements.list.innerHTML = group.items.map(candidate => {
      const thumb = group.mode === 'hud' ? (candidate.id === 'hub' ? original('hub-courtyard', 'walk-sanctuary') : backgrounds[0].source) : proposed(candidate.id);
      return `<button class="asset-choice ${candidate.id === item.id ? 'active' : ''}" data-item="${candidate.id}" aria-pressed="${candidate.id === item.id}"><span class="asset-thumb">${img(thumb, '', '', 'loading="lazy"')}</span><span><strong>${candidate.name}</strong><small>${candidate.note}</small></span><span class="choice-arrow" aria-hidden="true">›</span></button>`;
    }).join('');
    $('#note-title').textContent = item.note;
    $('#note-body').textContent = item.change;
  }
  function renderControls(group, item) {
    if (group.mode === 'world') {
      elements.controls.innerHTML = `<label class="control-label">场景背景<select id="background-choice">${backgrounds.map(background => `<option value="${background.id}" ${background.id === state.background ? 'selected' : ''}>${background.name}</option>`).join('')}</select></label><label class="toggle"><input id="foot-guide-choice" type="checkbox" ${state.guide ? 'checked' : ''}>脚点参考</label>`;
    } else if (group.mode === 'hud') {
      elements.controls.innerHTML = `<div class="hud-tab-buttons" role="group" aria-label="HUD 场景">${group.items.map(candidate => `<button data-item="${candidate.id}" class="${candidate.id === item.id ? 'active' : ''}" aria-pressed="${candidate.id === item.id}">${candidate.name}</button>`).join('')}</div>`;
    } else {
      elements.controls.innerHTML = '<span class="control-label">完整 PNG 对照 · 点击查看原图</span>';
    }
  }
  function cardHeader(isProposed, subtitle) {
    return `<div class="compare-heading"><strong>${isProposed ? '<span class="new-dot"></span>已采用' : '替换前'}</strong><small>${subtitle}</small></div>`;
  }
  function cardCaption(isProposed, item, source, description) {
    return `<div class="compare-caption"><p>${description}</p>${source ? previewButton(source, `${item.name} · ${isProposed ? '提案' : '现用'}`, isProposed ? '新生成素材' : '替换前注册原图') : ''}</div>`;
  }
  function worldCard(item, isProposed) {
    const source = isProposed ? proposed(item.id) : null;
    const object = isProposed ? img(source, `${item.name}提案`, 'prop-image', `data-layout="${item.id}-proposed.png"`) : `<canvas class="legacy-canvas" data-legacy="${item.id}" aria-label="${item.name}替换前程序形状复现"></canvas>`;
    return `<article class="compare-card ${isProposed ? 'proposed' : ''}">${cardHeader(isProposed, isProposed ? '新生成透明 PNG' : '替换前程序形状复现')}<div class="scene ${state.guide ? 'show-guide' : ''}">${img(getBackground().source, `${getBackground().name}现有游戏背景`, 'scene-background')}<div class="scene-topline"><span>${getBackground().name}</span><span>场景融合预览</span></div><div class="walker" role="img" aria-label="现用轮回者行走单帧"></div><div class="scene-ground" data-kind="${item.id}">${object}<div class="foot-guide" aria-hidden="true"></div></div><div class="prop-label">${item.name}</div><div class="scene-bottomline"><span>${isProposed ? '新素材与现有场景合成' : '按正式绘制代码复现，非游戏截图'}</span><div class="scene-mark" aria-hidden="true">⌖</div></div></div>${cardCaption(isProposed, item, source, isProposed ? '低饱和实体材质，保留原有物件身份。' : item.current)}</article>`;
  }
  function iconCard(item, isProposed) {
    const source = isProposed ? proposed(item.id) : item.original;
    return `<article class="compare-card ${isProposed ? 'proposed' : ''}">${cardHeader(isProposed, isProposed ? '单件物品 · 新 PNG' : '替换前注册原图')}<div class="icon-stage">${img(source, `${item.name}${isProposed ? '提案' : '现用'}`, 'icon-hero')}<div class="icon-stage-label">${item.name}</div><div class="icon-stage-type">${item.type} · ${isProposed ? '写实绘画提案' : '当前素材'}</div><div class="icon-slot-row"><div class="icon-slot">${img(source, `${item.name}48像素图标`)}</div><div class="icon-slot-text">48 px 物品栏<br>观察缩小后的轮廓识别</div></div></div>${cardCaption(isProposed, item, source, isProposed ? item.note : item.current)}</article>`;
  }
  function portraitCard(item, isProposed) {
    const source = isProposed ? proposed(item.id) : item.original;
    return `<article class="compare-card ${isProposed ? 'proposed' : ''}">${cardHeader(isProposed, isProposed ? '代表方案 · 新 PNG' : '替换前注册肖像')}<div class="portrait-stage">${img(source, `${item.name}${isProposed ? '新肖像' : '当前肖像'}`, 'portrait-hero')}<div class="portrait-info"><strong>${item.name}</strong><span>${item.identity}</span></div></div>${cardCaption(isProposed, item, source, isProposed ? '保留人物身份与服饰方向，协调绘画质感。' : item.current)}</article>`;
  }
  function bannerCard(item, isProposed) {
    const source = isProposed ? proposed(item.id) : item.original;
    return `<article class="compare-card ${isProposed ? 'proposed' : ''}">${cardHeader(isProposed, isProposed ? '写实城市 · 新 PNG' : '旧扁平插画')}<div class="banner-stage"><div class="banner-label"><span>完整横幅</span><span>保留全部构图</span></div>${img(source, `${item.name}完整横幅`, 'full-banner')}<div class="banner-label"><span>结算构图 · 5:4</span><span>居中裁切</span></div><div class="result-preview">${img(source, '结算中间裁切预览')}<div class="result-content"><small>轮回城镜像 · 结算预览</small><strong>本轮探索结束</strong><span>在居中裁切后，检查城市主体与镜面仍然可辨。</span></div></div></div>${cardCaption(isProposed, item, source, isProposed ? '压低饱和度与建筑描边，集中中部叙事。' : item.current)}</article>`;
  }
  function hudCard(item, isProposed) {
    const isHub = item.id === 'hub';
    const source = isHub ? original('hub-courtyard', 'walk-sanctuary') : backgrounds[0].source;
    return `<article class="compare-card ${isProposed ? 'proposed' : ''}">${cardHeader(isProposed, isProposed ? '统一方案 · HTML 示意' : '替换前样式概括 · HTML 示意')}<div class="hud-stage ${isProposed ? 'hud-proposed' : 'hud-old'} ${item.id}">${img(source, isHub ? '现有庭院背景' : '现有副本背景', 'scene-background')}<div class="hud-top">${img(isProposed ? proposed('hero-portrait') : original('character', 'reincarnator'), isProposed ? '轮回者肖像提案' : '现用轮回者头像', 'hud-avatar')}<div class="hud-profile"><b>轮回者</b><small>${isHub ? '主神空间 · 整备' : '镇妖塔 · 探索中'}</small><div class="hud-health"><i></i></div></div><span class="hud-menu" aria-label="菜单外观示意">☰</span></div><div class="hud-location">${isHub ? '轮回庭院' : '镇妖塔 · 第一层'}</div><div class="walker" role="img" aria-label="现用轮回者行走单帧"></div><div class="hud-explore-strip">${isHub ? '靠近设施，查看可用操作' : '移动探索，靠近目标后交互'}</div><div class="hud-lower"><div class="joystick" aria-label="摇杆外观示意"><i></i></div><div class="hud-actions"><span class="hud-action">角色</span><span class="hud-action">背包</span><span class="hud-action interact">${isHub ? '查看设施' : '交互'}</span></div></div></div>${cardCaption(isProposed, item, null, isProposed ? '暖黑面板、细旧金边界、灰青状态与半透明摇杆。' : item.current)}</article>`;
  }
  function renderDetail(group, item) {
    if (group.mode === 'hud') {
      elements.detail.innerHTML = '<div class="detail-copy"><h4>界面颜色与透明度方向</h4><p>主城、副本共用面板与摇杆样式；保留状态信息的对比度。这里仅检查视觉，示意控件不触发游戏功能。</p></div><div class="swatches"><span class="swatch"><i style="background:#1a1c13e8"></i>暖黑面板</span><span class="swatch"><i style="background:#b29b62"></i>旧金边界</span><span class="swatch"><i style="background:#9daa84"></i>灰青状态</span></div>';
      return;
    }
    if (group.mode === 'banner') {
      elements.detail.innerHTML = '<div class="detail-copy"><h4>同时检查横幅与结算裁切</h4><p>完整图展示全景构图，结算预览按现有 750 × 600 背景区域的比例居中裁切。正式接入时仍需核对文字和印章的遮挡。</p></div><a class="button" href="../../cocos/assets/resources/dungeon-world/mirror_cycle_city-v1.png" target="_blank" rel="noopener">现有同章背景 ↗</a>';
      return;
    }
    const world = group.mode === 'world';
    const description = world ? '尺寸示例观察缩小后的主体与材质。场景内按可见主体对齐脚点，原始 PNG 保持不变；实际交互与碰撞仍沿用游戏逻辑。' : group.mode === 'portrait' ? '头像与人物面板应使用一致身份。以下尺寸检查面部与服饰线索；此处仅提供两个示例，不代表整批人物已完成。' : '在物品栏实际小尺寸下检查轮廓与能力识别色。大图干净只是第一步，48 px 仍应能分清不同物件。';
    elements.detail.innerHTML = `<div class="detail-copy"><h4>${world ? '落地与缩放检查' : group.mode === 'portrait' ? '身份与头像尺寸检查' : '48 px 辨识度检查'}</h4><p>${description}</p>${state.layoutError && world ? `<p class="error-notice">${escapeHtml(state.layoutError)}</p>` : ''}</div><div class="size-samples">${[48, 72, 96].map(size => `<div class="size-example"><div class="size-frame s${size}">${img(proposed(item.id), `${item.name}提案${size}像素`)}</div><span>${size} px · 提案</span></div>`).join('')}</div>`;
  }
  function layoutWorldImages() {
    if (sceneObserver) sceneObserver.disconnect();
    const images = [...document.querySelectorAll('[data-layout]')];
    const layoutOne = image => {
      const record = state.layout && state.layout[image.dataset.layout];
      if (!record) return;
      const parent = image.parentElement;
      const [left, top, right, bottom] = record.bounds;
      const width = right - left;
      const height = bottom - top;
      if (width <= 0 || height <= 0 || !record.width || !record.height) throw new Error(`Invalid alpha bounds for ${image.dataset.layout}`);
      const scale = Math.min(parent.clientWidth / width, parent.clientHeight / height);
      image.style.width = `${record.width * scale}px`;
      image.style.height = `${record.height * scale}px`;
      image.style.left = `${(parent.clientWidth - width * scale) / 2 - left * scale}px`;
      image.style.bottom = `${-(record.height - bottom) * scale}px`;
      image.style.objectFit = 'fill';
    };
    for (const image of images) layoutOne(image);
    sceneObserver = new ResizeObserver(() => images.forEach(layoutOne));
    images.forEach(image => sceneObserver.observe(image.parentElement));
    document.querySelectorAll('[data-legacy]').forEach(canvas => {
      try {
        if (typeof window.drawLegacyProp !== 'function') throw new Error('现用物件绘制模块未加载');
        window.drawLegacyProp(canvas, canvas.dataset.legacy);
      } catch (error) {
        const notice = document.createElement('p');
        notice.className = 'error-notice';
        notice.textContent = `现用形状加载失败：${error.message}`;
        canvas.replaceWith(notice);
      }
    });
  }
  function render() {
    const group = getGroup();
    const item = getItem();
    renderCategories();
    $('#section-eyebrow').textContent = `${group.number} / 07 · ${group.priority}`;
    $('#section-title').textContent = group.title;
    $('#section-description').textContent = group.description;
    $('#asset-title').textContent = item.name;
    $('#asset-type').textContent = item.type;
    renderList(group, item);
    renderControls(group, item);
    const renderers = { world: worldCard, icon: iconCard, banner: bannerCard, portrait: portraitCard, hud: hudCard };
    elements.comparison.innerHTML = [false, true].map(isProposed => renderers[group.mode](item, isProposed)).join('');
    renderDetail(group, item);
    if (group.mode === 'world') layoutWorldImages();
    else if (sceneObserver) sceneObserver.disconnect();
  }
  function openPreview(button) {
    lastDialogTrigger = button;
    $('#dialog-title').textContent = button.dataset.name;
    $('#dialog-caption').textContent = `${button.dataset.kind} · 完整 PNG · Escape 可关闭`;
    $('#dialog-image-container').innerHTML = img(button.dataset.preview, button.dataset.name);
    $('#dialog-original').href = button.dataset.preview;
    elements.dialog.showModal();
    $('#close-dialog').focus();
  }
  document.addEventListener('click', event => {
    const groupButton = event.target.closest('[data-group]');
    const itemButton = event.target.closest('[data-item]');
    const preview = event.target.closest('[data-preview]');
    if (groupButton) {
      const groupId = groupButton.dataset.group;
      setSelection(groupId);
      document.querySelector(`[data-group="${groupId}"]`).focus({ preventScroll: true });
    } else if (itemButton) {
      const itemId = itemButton.dataset.item;
      setSelection(state.group, itemId);
      document.querySelector(`.asset-list [data-item="${itemId}"]`).focus({ preventScroll: true });
    }
    else if (preview) openPreview(preview);
  });
  document.addEventListener('change', event => {
    if (event.target.id === 'background-choice') {
      state.background = event.target.value;
      render();
      $('#background-choice').focus();
    } else if (event.target.id === 'foot-guide-choice') {
      state.guide = event.target.checked;
      document.querySelectorAll('.scene').forEach(scene => scene.classList.toggle('show-guide', state.guide));
    }
  });
  $('#close-dialog').addEventListener('click', () => elements.dialog.close());
  elements.dialog.addEventListener('click', event => {
    if (event.target === elements.dialog) {
      const bounds = elements.dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) elements.dialog.close();
    }
  });
  elements.dialog.addEventListener('close', () => { if (lastDialogTrigger && lastDialogTrigger.isConnected) lastDialogTrigger.focus(); });
  window.addEventListener('hashchange', () => { readHash(); render(); });
  readHash();
  render();
  fetch('asset-layout.json', { cache: 'no-store' }).then(response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }).then(layout => {
    state.layout = layout;
    if (getGroup().mode === 'world') layoutWorldImages();
  }).catch(error => {
    state.layoutError = `主体边界数据未加载（${error.message}），场景暂以完整 PNG 对齐；原图仍可独立检查。`;
    if (getGroup().mode === 'world') renderDetail(getGroup(), getItem());
  });
})();
