(() => {
  'use strict';
  const concepts = [
    { id: '01', name: '残檐石阙', subtitle: '残破横檐与宽石柱，让门体接近妖塔建筑。', material: '中式残檐 / 青黑旧石', detail: '用横向残檐替代规整圆拱，保留清楚的暗色通路。门后的光收在门槛附近，优先比较它与妖塔屋檐、石柱的关系。' },
    { id: '02', name: '无顶双碑', subtitle: '拿掉横梁，让两座断碑界定出口。', material: '开放轮廓 / 断碑薄雾', detail: '高低不同的两座断碑之间形成通路，减少建筑体量与遮挡。重点观察小尺寸下，开放的轮廓是否仍能清楚表达入口。' },
    { id: '03', name: '地面符环', subtitle: '把入口压低到地面，以破石环标记路径。', material: '贴地入口 / 微弱刻痕', detail: '用俯视石环替代直立的门，破碎石块与地面直接衔接。观察低亮刻痕是否足够可见，以及它与附近地面纹理能否分开。' },
    { id: '04', name: '断阶下行', subtitle: '一段向下的石阶，把“前往”变成空间。', material: '下行通路 / 台阶纵深', detail: '通过地面破口和向下延伸的石阶表达离开当前区域。入口依靠台阶的明暗与纵深辨识，重点比较它在三种背景里的落地感。' },
    { id: '05', name: '斜裂石隙', subtitle: '两片残壁之间的裂口，像场景自然断开。', material: '不规则残壁 / 灰雾裂隙', detail: '用不对称的破石边缘削弱独立道具的感觉，裂隙内部留暗。观察竖向缺口在手机尺寸下是否明确，轮廓是否与场景石材协调。' },
    { id: '06', name: '铁栅雾门', subtitle: '半抬的旧铁栅，让遗迹与设施场景共用。', material: '粗铁方框 / 半抬栅门', detail: '用方形门框和半抬的锈铁栅表达可穿过的入口。对比妖塔与地铁时，重点看石材与铁件能否同时融入环境。' },
    { id: '07', name: '悬符结界', subtitle: '旧木柱、符纸与薄雾，保留东方辨识。', material: '木柱绳结 / 旧符结界', detail: '以两根木柱和悬挂符纸形成轻量边界。减少厚重门框，重点观察符纸在小尺寸下的识别度，以及雾幕是否过于抢眼。' },
    { id: '08', name: '枯木山门', subtitle: '扭曲朽木形成不对称入口，偏荒败自然感。', material: '朽木断根 / 自然通路', detail: '用枯木与残根构成门洞，轮廓不规整、材质偏暗。比较它与场景的人工建筑语言是否协调，适合作为更荒败区域的备选方向。' },
    { id: '09', name: '玄镜通路', subtitle: '古铜碎框与暗水镜心，保留异界意味。', material: '八角古镜 / 低亮镜面', detail: '把传送的意味收在暗镜内部，外缘采用旧铜与破损轮廓。重点比较它是否足够克制，避免镜面亮度压过角色和周围场景。' },
    { id: '10', name: '残壁暗口', subtitle: '一段残墙里的方形出口，光藏在门后。', material: '宽矮残墙 / 暗色门洞', detail: '用最直接的残墙与方形门洞接续环境，减少象征和装饰。重点观察门洞的辨识度、残墙与背景的融合，以及脚下的接触关系。' }
  ];
  const backgrounds = { demon_tower_1: '妖塔', metro_abyss: '地铁', starfall_mine: '矿井' };
  const state = { background: 'demon_tower_1', mode: 'scene', entrance: 'available', selected: 0 };
  const gallery = document.querySelector('#gallery');
  const dialog = document.querySelector('#detail');
  const status = document.querySelector('#page-status');
  const failures = new Set();
  const currentAsset = '../dungeon-transition/assets/ruined-stone-gate-v1.png';
  let opener = null;

  function imagePath(concept) { return `assets/portal-${concept.id}.png`; }
  function makeStage(src, name) {
    const stage = document.createElement('div');
    stage.className = 'stage';
    stage.innerHTML = '<span class="stage-caption"></span><span class="gate"><img draggable="false"></span><span class="player" aria-hidden="true"></span><span class="gate-label">下一处区域<span></span></span><span class="image-error" hidden></span>';
    const img = stage.querySelector('img');
    img.alt = name;
    img.addEventListener('error', () => {
      failures.add(src);
      const message = stage.querySelector('.image-error');
      message.hidden = false;
      message.textContent = `${name}素材未能加载，请刷新重试。`;
      status.textContent = `${failures.size} 张素材未能加载，请检查页面资源后重试。`;
    });
    img.src = src;
    updateStage(stage);
    return stage;
  }

  function updateStage(stage) {
    stage.dataset.mode = state.mode;
    stage.dataset.state = state.entrance;
    stage.style.setProperty('--scene-image', `url('../../cocos/assets/resources/dungeon-world/${state.background}-v1.png')`);
    stage.querySelector('.stage-caption').textContent = state.mode === 'asset' ? '素材细节' : `${backgrounds[state.background]} · 场景比例`;
    stage.querySelector('.gate-label > span').textContent = state.entrance === 'locked' ? '入口未开放' : '入口畅通';
  }

  for (const [index, concept] of concepts.entries()) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'concept';
    card.dataset.concept = concept.id;
    card.setAttribute('aria-label', `${concept.id} ${concept.name}，打开与现用门的对比`);
    card.setAttribute('aria-haspopup', 'dialog');
    card.append(makeStage(imagePath(concept), concept.name));
    const body = document.createElement('span');
    body.className = 'concept-body';
    body.style.display = 'block';
    body.innerHTML = `<span class="card-heading"><span class="card-number">${concept.id}</span><strong class="card-name">${concept.name}</strong></span><span class="card-subtitle">${concept.subtitle}</span><span class="card-bottom"><span>${concept.material}</span><span class="card-arrow" aria-hidden="true">↗</span></span>`;
    card.append(body);
    card.addEventListener('click', () => {
      opener = card;
      state.selected = index;
      renderDetail();
      dialog.showModal();
    });
    gallery.append(card);
  }

  function renderDetail() {
    const concept = concepts[state.selected];
    document.querySelector('#detail-number').textContent = `方案 ${concept.id} / 10`;
    document.querySelector('#detail-title').textContent = concept.name;
    document.querySelector('#new-label').textContent = concept.name;
    document.querySelector('#detail-description').textContent = concept.detail;
    document.querySelector('#new-stage').replaceChildren(makeStage(imagePath(concept), concept.name));
    document.querySelector('#old-stage').replaceChildren(makeStage(currentAsset, '现用微光石门'));
    document.querySelector('#detail-position').textContent = `${concept.id} / 10`;
    document.querySelector('#asset-link').href = imagePath(concept);
    document.querySelector('#detail-note').textContent = state.mode === 'scene' ? '两侧使用同一背景与同一容纳尺寸，人物作为比例参照。' : '放大查看原始素材，透明区域由展示底色衬托。';
    for (const card of gallery.querySelectorAll('.concept')) {
      card.setAttribute('aria-current', String(card.dataset.concept === concept.id));
    }
  }

  function syncControls() {
    for (const button of document.querySelectorAll('[data-background]')) button.setAttribute('aria-pressed', String(button.dataset.background === state.background));
    for (const button of document.querySelectorAll('[data-mode]')) {
      if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode));
    }
    for (const button of document.querySelectorAll('button[data-state]')) button.setAttribute('aria-pressed', String(button.dataset.state === state.entrance));
    for (const stage of document.querySelectorAll('.stage')) updateStage(stage);
    document.querySelector('#view-description').textContent = `${backgrounds[state.background]} · ${state.mode === 'scene' ? '场景比例' : '素材细节'} · ${state.entrance === 'locked' ? '未开放' : '入口畅通'}`;
  }

  for (const button of document.querySelectorAll('button[data-background]')) button.addEventListener('click', () => { state.background = button.dataset.background; syncControls(); });
  for (const button of document.querySelectorAll('button[data-mode]')) button.addEventListener('click', () => { state.mode = button.dataset.mode; syncControls(); });
  for (const button of document.querySelectorAll('button[data-state]')) button.addEventListener('click', () => { state.entrance = button.dataset.state; syncControls(); });
  document.querySelector('#previous').addEventListener('click', () => { state.selected = (state.selected + 9) % 10; renderDetail(); });
  document.querySelector('#next').addEventListener('click', () => { state.selected = (state.selected + 1) % 10; renderDetail(); });
  document.querySelector('#close-detail').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { if (opener) opener.focus({ preventScroll: true }); });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
  syncControls();
})();
