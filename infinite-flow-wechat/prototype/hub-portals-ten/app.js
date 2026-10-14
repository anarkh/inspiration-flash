(() => {
  'use strict';
  const concepts = [
    { id: '01', name: '云阙界门', subtitle: '莲云石柱托起单檐，延续庭院的建筑语言。', material: '中式石阙 / 门后云路', detail: '让副本入口成为庭院建筑的一部分：黑石与旧金莲云纹接续现有石柱，单檐形成明确的门形，门后保留低亮云路。' },
    { id: '02', name: '轮回月门', subtitle: '圆形月洞与厚石环，用完整轮廓表达轮回。', material: '圆形月门 / 旧金云纹', detail: '中式月洞门以完整圆环表达轮回，厚石框与低石座呼应庭院。重点比较圆形入口与场景里的月轮、莲花构件是否协调。' },
    { id: '03', name: '星环天仪', subtitle: '古铜双环与弧形支座，像一件主神仪器。', material: '古铜双环 / 暗星通道', detail: '把入口做成古代天仪的形制，双环与弧形支座围出可穿行的空间。旧铜和少量金星保留神秘感，重点观察宽轮廓与人物的比例。' },
    { id: '04', name: '莲台光隙', subtitle: '黑金莲瓣环抱薄光，集中呈现仪式感。', material: '竖向莲瓣 / 香槟薄光', detail: '从庭院现有莲纹石座发展出完整的莲瓣外框，门心为柔和薄光。光面比其他方案更明显，可以比较它对角色和周边摆设的视觉影响。' },
    { id: '05', name: '双碑云界', subtitle: '两根莲云石柱之间，以雾帘界定通路。', material: '对称双碑 / 金灰雾帘', detail: '去掉顶部横梁，用对称的完整石碑与雾帘构成入口。轮廓开放、庄严，重点观察门心亮度与庭院石柱的材质一致性。' },
    { id: '06', name: '悬镜玄关', subtitle: '旧铜八角镜中浮现山云，异界收在镜内。', material: '八角古镜 / 山云纵深', detail: '完整八角镜框采用黑金莲云装饰，镜心呈现暗色远山与云雾。入口依靠镜面纵深表达传送，而非强烈发光，整体偏沉静。' },
    { id: '07', name: '万象画门', subtitle: '展开一卷山水，画中道路延伸向副本。', material: '独立画卷 / 画中通路', detail: '以竖向绢画、黑金卷轴和细立架取代石门框，画内山水形成通路。轮廓差异最大，保留古典材质，重点看它在庭院里的辨识度。' },
    { id: '08', name: '鎏金重扉', subtitle: '厚重双扉敞开，门后露出暗金云路。', material: '莲纹双扉 / 厚重铜门', detail: '采用已开启的中式双门，莲纹浮雕与旧铜表面呼应庭院石雕。门扇提供明确的空间厚度，适合比较实体入口的稳重感。' },
    { id: '09', name: '天阶引渡', subtitle: '低阶与莲柱之上，一条云路向远处展开。', material: '三阶石台 / 无框云路', detail: '三阶低台和矮莲柱作为落点，上方直接展开通向异界的薄雾道路。暖白门心更明亮，重点比较无高门框的轮廓是否清楚。' },
    { id: '10', name: '龙纹天枢', subtitle: '龙云弧柱围合成门，旧金线条带出气势。', material: '龙云弧柱 / 灰金界面', detail: '两侧抽象龙云石雕向内卷合，形成椭圆通路。旧金嵌线和低莲座延续庭院雕饰，整体比单檐石门更具主神空间的仪式感。' }
  ];
  const state = { mode: 'scene', selected: 0 };
  const gallery = document.querySelector('#gallery');
  const dialog = document.querySelector('#detail');
  const status = document.querySelector('#page-status');
  const failures = new Set();
  let opener = null;
  const imagePath = concept => `assets/hub-portal-${concept.id}.png`;

  function updateStage(stage) {
    stage.dataset.mode = state.mode;
    stage.querySelector('.stage-caption').textContent = state.mode === 'asset' ? '素材细节' : '主神空间 · 轮回庭院';
  }
  function makeStage(src, name, current = false) {
    const stage = document.createElement('div');
    stage.className = 'stage';
    stage.innerHTML = '<span class="stage-caption"></span><span class="gate"><img draggable="false"></span><span class="player" aria-hidden="true"></span><span class="gate-label">副本传送门<span>进入副本</span></span><span class="image-error" hidden></span>';
    if (current) stage.classList.add('current-portal');
    const img = stage.querySelector('img');
    img.alt = name;
    img.addEventListener('error', () => {
      failures.add(src);
      const error = stage.querySelector('.image-error');
      error.hidden = false;
      error.textContent = `${name}素材加载失败，请刷新重试。`;
      status.textContent = `${failures.size} 张素材未能加载，请检查页面资源后重试。`;
    });
    img.src = src;
    updateStage(stage);
    return stage;
  }
  for (const [index, concept] of concepts.entries()) {
    const card = document.createElement('button');
    card.type = 'button'; card.className = 'concept'; card.dataset.concept = concept.id;
    card.setAttribute('aria-label', `${concept.id} ${concept.name}，对比主神空间替换前的门`);
    card.setAttribute('aria-haspopup', 'dialog');
    card.append(makeStage(imagePath(concept), concept.name));
    const body = document.createElement('span');
    body.className = 'concept-body';
    body.style.display = 'block';
    body.innerHTML = `<span class="card-heading"><span class="card-number">${concept.id}</span><strong class="card-name">${concept.name}</strong></span><span class="card-subtitle">${concept.subtitle}</span><span class="card-bottom"><span>${concept.material}</span><span class="card-arrow" aria-hidden="true">↗</span></span>`;
    card.append(body);
    card.addEventListener('click', () => { opener = card; state.selected = index; renderDetail(); dialog.showModal(); });
    gallery.append(card);
  }
  function renderDetail() {
    const concept = concepts[state.selected];
    document.querySelector('#detail-number').textContent = `方案 ${concept.id} / 10`;
    document.querySelector('#detail-title').textContent = concept.name;
    document.querySelector('#new-label').textContent = concept.name;
    document.querySelector('#detail-description').textContent = concept.detail;
    document.querySelector('#new-stage').replaceChildren(makeStage(imagePath(concept), concept.name));
    document.querySelector('#old-stage').replaceChildren(makeStage('assets/current-hub-portal.svg', '主神空间替换前的几何副本门', true));
    document.querySelector('#detail-position').textContent = `${concept.id} / 10`;
    document.querySelector('#asset-link').href = imagePath(concept);
    document.querySelector('#detail-note').textContent = state.mode === 'scene' ? '同一庭院与人物比例。右侧根据接入前的游戏几何绘制还原旧样式。' : '放大观察形制与材质；右侧为接入前的游戏几何绘制样式。';
    for (const card of gallery.querySelectorAll('.concept')) card.setAttribute('aria-current', String(card.dataset.concept === concept.id));
  }
  for (const button of document.querySelectorAll('button[data-mode]')) {
    button.addEventListener('click', () => {
      state.mode = button.dataset.mode;
      for (const control of document.querySelectorAll('button[data-mode]')) control.setAttribute('aria-pressed', String(control.dataset.mode === state.mode));
      for (const stage of document.querySelectorAll('.stage')) updateStage(stage);
      document.querySelector('#view-description').textContent = state.mode === 'scene' ? '真实庭院背景 · 人物比例参照' : '独立透明素材 · 放大查看形制';
    });
  }
  document.querySelector('#previous').addEventListener('click', () => { state.selected = (state.selected + 9) % 10; renderDetail(); });
  document.querySelector('#next').addEventListener('click', () => { state.selected = (state.selected + 1) % 10; renderDetail(); });
  document.querySelector('#close-detail').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { if (opener) opener.focus({ preventScroll: true }); });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
})();
