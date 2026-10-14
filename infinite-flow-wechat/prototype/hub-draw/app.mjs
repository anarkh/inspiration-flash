import { services, icon } from './helpers.mjs';
import { getWalkLayout } from './walk-world.mjs';
import { renderWalkScene } from './walk-view.mjs';
import { WalkController } from './walk-controller.mjs';

const byId = id => document.getElementById(id);
const scene = byId('scene');
const frame = byId('device-frame');
const stage = byId('preview-stage');
const sheet = byId('scene-sheet');
const sheetContent = byId('sheet-content');
const draw = byId('draw');
const keep = byId('keep');
const list = byId('style-list');
const overview = byId('overview');
const overviewGrid = byId('overview-grid');
const seen = new Set();
const favorites = new Set();
const favoriteStorageKey = 'infinite-flow-hub-draw-favorites-v1';
const resources = '../../cocos/assets/resources/';
let walkController;
let styles = [];
let current;
let remaining = [];
let onlyFavorites = false;
let fullSize = false;
let sheetReturnFocus;
let toastTimer;

// These readouts illustrate the hub interaction. They neither execute commands
// nor use the live game's state, client, saves, or purchase rules.
const catalogs = {
  equipment: [
    { title: '装备目录', note: '武器、护具与当前配置', image: 'equipment/bone-spear-v1.png', detail: '在军需官处挑选武器与护具。装备条目应显示属性、获得条件与当前状态。' },
    { title: '装备强化', note: '查看强化材料与提升', image: 'item/star-iron-v1.png', detail: '强化入口展示当前装备、下一阶提升和所需材料，便于出发前完成准备。' },
  ],
  supplies: [
    { title: '止血丹', note: '常用生命补给', image: 'item/healing-pill-v1.png', detail: '止血丹用于恢复生命。补给品与携行道具分开展示，具体消耗以游戏中的物品说明为准。' },
    { title: '雷火符', note: '需要装入携行槽', image: 'item/thunder-talisman-v1.png', detail: '雷火符属于携行道具。出发前在角色界面配置，战斗中从道具入口使用。' },
  ],
  pets: [
    { title: '契约小灵', note: '查看契约与培养', image: 'pet/contract-sprite-v1.png', detail: '灵宠详情集中展示特性、培养材料与出战状态。出发前选择你的灵宠。' },
    { title: '星铁浮蜂', note: '查看灵宠特性', image: 'pet/starling-drone-v1.png', detail: '灵宠列表保留已拥有与未拥有的状态，让培养和出战入口容易找到。' },
  ],
  methods: [
    { title: '功法目录', note: '查看已学与可学习功法', image: 'item/method-page-v1.png', detail: '功法详情展示被动、战技、阶位和学习条件；战斗时可直接选择对应招式。' },
    { title: '精研功法', note: '查看下一阶修行条件', image: 'item/focus-incense-v1.png', detail: '把修行结果与材料要求放在同一个界面，方便出发前判断是否精研。' },
  ],
  bloodlines: [
    { title: '血统目录', note: '查看觉醒与激活状态', detail: '展示血统能力、觉醒条件与当前激活状态。每个条目说明带来的变化。' },
    { title: '血统爆发', note: '查看已觉醒的能力', detail: '展示当前血统在战斗中的爆发能力及使用条件。' },
  ],
  companions: [
    { title: '同伴名册', note: '查看招募条件与援护', image: 'character/zhou-yingxue-v1.png', detail: '同伴名册按角色展示招募条件、援护技能和当前同行状态。' },
    { title: '同行配置', note: '安排下一次同行', image: 'character/qin-che-v1.png', detail: '选择下次进入副本的同伴，并清楚展示他的援护能力。' },
  ],
  tasks: [
    { title: '妖塔一层主线', note: '当前任务 · 完成妖塔一层', detail: '任务页同时显示目标、当前进度与奖励。已完成时在原位置出现领取入口。' },
    { title: '支线任务', note: '查看探索目标与奖励', detail: '支线任务以文字列表呈现，避免让任务目标淹没在场景装饰中。' },
  ],
};

function notify(message) {
  const toast = byId('scene-toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2400);
}

function scalePreview() {
  walkController?.resize();
}

function closeSheet() {
  if (!sheet.open) return;
  sheet.close();
  walkController?.setPaused(false);
  if (sheetReturnFocus?.isConnected) sheetReturnFocus.focus({ preventScroll: true });
}

function sheetHeader(title, subtitle = '', person) {
  return `<header class="sheet-header">${person ? `<img class="sheet-person" src="${resources}npc/${person.art}-world-v1.png" alt="">` : ''}<div><h2 id="sheet-title">${title}</h2>${subtitle ? `<p class="sheet-subtitle">${subtitle}</p>` : ''}</div><button type="button" class="sheet-close" data-action="close-sheet" aria-label="关闭面板">${icon('close')}</button></header>`;
}

function showSheet(content, source) {
  walkController?.setPaused(true);
  if (!sheet.open) sheetReturnFocus = source;
  sheetContent.innerHTML = content;
  if (!sheet.open) sheet.show();
  sheet.querySelector('.sheet-close')?.focus({ preventScroll: true });
}

function showService(id, source) {
  const person = services.find(entry => entry.id === id);
  if (!person) throw new Error(`Missing hub service: ${id}`);
  showSheet(`${sheetHeader(person.name, person.purpose, person)}<p class="sheet-note">${person.note}</p><div class="sheet-rows">${catalogs[id].map((row, index) => `<button type="button" class="sheet-row" data-action="inspect" data-service="${id}" data-index="${index}">${row.image ? `<img src="${resources}${row.image}" alt="">` : icon(person.icon)}<span class="sheet-row-copy"><span class="sheet-row-title">${row.title}</span><span class="sheet-row-note">${row.note}</span></span><span class="sheet-row-tail">查看 ›</span></button>`).join('')}</div>`, source);
}

function inspectService(id, index, source) {
  const person = services.find(entry => entry.id === id);
  const row = catalogs[id]?.[index];
  if (!person || !row) throw new Error(`Missing prototype readout ${id}/${index}`);
  showSheet(`${sheetHeader(row.title, person.purpose)}<p class="sheet-note">${row.detail}</p><div class="sheet-bottom"><button type="button" class="sheet-action" data-action="service" data-service="${id}">返回${person.name}</button></div>`, source);
}

function openPortal(source) {
  showSheet(`${sheetHeader('副本传送门', '选择下一次轮回')}<div class="sheet-rows"><button type="button" class="sheet-row" data-action="enter-demo"><span class="sheet-row-copy"><span class="sheet-row-title">妖塔一层</span><span class="sheet-row-note">已解锁 · 标准探索</span></span><span class="sheet-row-tail">选择 ›</span></button><button class="sheet-row" disabled><span class="sheet-row-copy"><span class="sheet-row-title">镜湖地铁</span><span class="sheet-row-note">完成并领取妖塔一层主线后解锁</span></span><span class="sheet-row-tail">未解锁</span></button><button class="sheet-row" disabled><span class="sheet-row-copy"><span class="sheet-row-title">星坠矿井</span><span class="sheet-row-note">后续章节</span></span><span class="sheet-row-tail">未解锁</span></button></div>`, source);
}

function openCharacter(source) {
  showSheet(`${sheetHeader('轮回者', '角色信息 · 演示配置')}<div class="sheet-stat-grid"><div><span>生命</span><b>102 / 102</b></div><div><span>奖励点</span><b>1,280</b></div><div><span>灵韵</span><b>36</b></div></div><div class="sheet-rows"><button class="sheet-row" data-action="inventory"><span class="sheet-row-copy"><span class="sheet-row-title">携行道具</span><span class="sheet-row-note">查看背包与出发准备</span></span><span class="sheet-row-tail">查看 ›</span></button></div>`, source);
}

function openInventory(source) {
  showSheet(`${sheetHeader('背包', '本页演示物品')}<div class="sheet-rows"><button class="sheet-row" data-action="inspect" data-service="supplies" data-index="0"><img src="${resources}item/healing-pill-v1.png" alt=""><span class="sheet-row-copy"><span class="sheet-row-title">止血丹</span><span class="sheet-row-note">补给品 · 不占携行槽</span></span><span class="sheet-row-tail">× 3</span></button><button class="sheet-row" data-action="inspect" data-service="supplies" data-index="1"><img src="${resources}item/thunder-talisman-v1.png" alt=""><span class="sheet-row-copy"><span class="sheet-row-title">雷火符</span><span class="sheet-row-note">携行道具</span></span><span class="sheet-row-tail">× 1</span></button></div>`, source);
}

frame.addEventListener('click', event => {
  const source = event.target.closest('[data-action]');
  if (!source || source.disabled) return;
  const action = source.dataset.action;
  if (action === 'service') showService(source.dataset.service, source);
  else if (action === 'portal') openPortal(source);
  else if (action === 'character') openCharacter(source);
  else if (action === 'inventory') openInventory(source);
  else if (action === 'inspect') inspectService(source.dataset.service, Number(source.dataset.index), source);
  else if (action === 'close-sheet') closeSheet();
  else if (action === 'enter-demo') showSheet(`${sheetHeader('妖塔一层', '标准探索')}<p class="sheet-note">主神空间原型的出发入口已走通。可以继续查看已完成的战斗页面原型。</p><div class="sheet-bottom"><a class="sheet-action" href="../combat/" target="_blank" rel="noopener">打开战斗原型</a></div>`, source);
  else if (action === 'menu') showSheet(`${sheetHeader('菜单', '主神空间')}<div class="sheet-rows"><button class="sheet-row" data-action="character"><span class="sheet-row-copy"><span class="sheet-row-title">角色信息</span><span class="sheet-row-note">生命、资源与携行配置</span></span><span class="sheet-row-tail">查看 ›</span></button><button class="sheet-row" data-action="service" data-service="tasks"><span class="sheet-row-copy"><span class="sheet-row-title">任务</span><span class="sheet-row-note">当前目标与奖励</span></span><span class="sheet-row-tail">查看 ›</span></button></div>`, source);
  else if (!['walk-interact', 'walk-jump', 'walk-run'].includes(action)) throw new Error(`Unimplemented prototype action: ${action}`);
});

sheet.addEventListener('cancel', event => { event.preventDefault(); closeSheet(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && sheet.open) { event.preventDefault(); closeSheet(); } });

function updateDeck() {
  const displayed = onlyFavorites ? styles.filter(style => favorites.has(style.id)) : styles;
  list.innerHTML = displayed.length ? displayed.map(style => `<button class="style-choice" type="button" data-style="${style.id}" aria-current="${style.id === current.id}"><span class="choice-number">${style.id}</span><span class="choice-name">${style.name}</span>${seen.has(style.id) ? '<span class="choice-seen" title="已看过"></span>' : ''}${favorites.has(style.id) ? '<span class="choice-mark" aria-label="已留牌">✦</span>' : ''}</button>`).join('') : '<p class="empty-favorites">还没有留牌。找到喜欢的方案后，点击「留这张」。</p>';
  keep.setAttribute('aria-pressed', String(favorites.has(current.id)));
  keep.innerHTML = icon('star') + (favorites.has(current.id) ? '已留牌' : '留这张');
  byId('draw-progress').textContent = remaining.length ? `还可抽 ${remaining.length} 张` : '10 款都看过了';
  draw.innerHTML = icon('dice') + (remaining.length ? '抽一张' : '再抽一轮');
  for (const card of overviewGrid.querySelectorAll('[data-style]')) card.setAttribute('aria-current', String(card.dataset.style === current.id));
  for (const marker of overviewGrid.querySelectorAll('[data-favorite]')) marker.textContent = favorites.has(marker.dataset.favorite) ? '✦' : '';
}

function selectStyle(id, options = {}) {
  const style = styles.find(entry => entry.id === id);
  if (!style) throw new Error(`Unknown style: ${id}`);
  closeSheet();
  walkController?.destroy();
  clearTimeout(toastTimer);
  byId('scene-toast').hidden = true;
  current = style;
  seen.add(id);
  remaining = remaining.filter(value => value !== id);
  const layout = getWalkLayout(id);
  scene.className = `walk-scene walk-theme-${id}`;
  scene.innerHTML = renderWalkScene(style, layout);
  walkController = new WalkController(scene, layout, {
    onNotice: notify,
    onInteract(target, source) {
      if (target.kind === 'portal') openPortal(source);
      else showService(target.service, source);
    },
  });
  frame.style.setProperty('--accent', style.accent ?? '#cfb06b');
  byId('card-number').textContent = id;
  byId('card-mood').textContent = style.mood;
  byId('style-name').textContent = style.name;
  byId('style-description').textContent = style.description;
  byId('preview-label').textContent = `${id} / 10 · ${style.name}`;
  if (location.hash !== `#${id}`) history.replaceState(null, '', `#${id}`);
  updateDeck();
  scalePreview();
  byId('saved-note').textContent = options.animate ? `抽到了 ${id} · ${style.name}` : '';
}

function renderOverview() {
  if (overviewGrid.childElementCount) return;
  overviewGrid.innerHTML = styles.map(style => `<article class="overview-card" data-style="${style.id}" aria-current="${style.id === current.id}"><div class="overview-thumb walk-thumb" aria-hidden="true"><div class="walk-thumb-frame" inert style="--accent:${style.accent ?? '#cfb06b'}"><div class="walk-scene walk-theme-${style.id}">${renderWalkScene(style, getWalkLayout(style.id), { thumbnail: true })}</div></div></div><button class="overview-select" type="button" data-style="${style.id}"><span class="overview-card-title"><b>${style.id}</b><span>${style.name}</span><span data-favorite="${style.id}"></span></span></button><p class="overview-card-desc">${style.mood}</p></article>`).join('');
  const resizeThumbnails = () => { for (const thumb of overviewGrid.querySelectorAll('.overview-thumb')) thumb.firstElementChild.style.transform = `scale(${thumb.clientWidth / 390})`; };
  const observer = new ResizeObserver(resizeThumbnails);
  observer.observe(overviewGrid);
  resizeThumbnails();
  updateDeck();
}

draw.addEventListener('click', () => {
  if (!remaining.length) { seen.clear(); remaining = styles.map(style => style.id); }
  const candidates = remaining.filter(id => id !== current.id);
  const pool = candidates.length ? candidates : remaining;
  selectStyle(pool[Math.floor(Math.random() * pool.length)], { animate: true });
});
list.addEventListener('click', event => {
  const choice = event.target.closest('[data-style]');
  if (!choice) return;
  selectStyle(choice.dataset.style);
  stage.scrollIntoView({ block: matchMedia('(max-width:730px)').matches ? 'start' : 'center', behavior: 'instant' });
});
overviewGrid.addEventListener('click', event => {
  const choice = event.target.closest('[data-style]');
  if (!choice) return;
  selectStyle(choice.dataset.style);
  stage.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth', block: 'center' });
});
byId('show-all').addEventListener('click', () => {
  overview.hidden = !overview.hidden;
  byId('show-all').setAttribute('aria-expanded', String(!overview.hidden));
  if (!overview.hidden) { renderOverview(); overview.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth', block: 'start' }); }
});
byId('close-overview').addEventListener('click', () => { overview.hidden = true; byId('show-all').setAttribute('aria-expanded', 'false'); byId('show-all').focus({ preventScroll: true }); stage.scrollIntoView({ block: 'center' }); });
keep.addEventListener('click', () => {
  if (favorites.has(current.id)) favorites.delete(current.id); else favorites.add(current.id);
  try { localStorage.setItem(favoriteStorageKey, JSON.stringify([...favorites])); }
  catch (error) { byId('saved-note').textContent = `本轮留牌可用，浏览器未保存：${error.name}`; updateDeck(); return; }
  byId('saved-note').textContent = favorites.has(current.id) ? `已留下 ${current.id} · ${current.name}` : '已取消留牌';
  updateDeck();
});
byId('favorites-only').addEventListener('click', () => { onlyFavorites = !onlyFavorites; byId('favorites-only').setAttribute('aria-pressed', String(onlyFavorites)); updateDeck(); });
byId('size-toggle').addEventListener('click', () => { fullSize = !fullSize; stage.classList.toggle('full-size', fullSize); byId('size-toggle').setAttribute('aria-pressed', String(fullSize)); byId('size-toggle').textContent = fullSize ? '收起舞台' : '放大舞台'; scalePreview(); stage.scrollIntoView({ block: 'center', behavior: 'instant' }); });
window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (styles.some(style => style.id === id) && current.id !== id) selectStyle(id); });
frame.addEventListener('error', event => {
  if (event.target instanceof HTMLImageElement && !frame.querySelector('.scene-error')) {
    const alert = document.createElement('p'); alert.className = 'scene-error'; alert.setAttribute('role', 'alert');
    alert.textContent = '部分场景素材未加载，请通过本地预览服务打开本页。'; frame.append(alert);
  }
}, true);

async function initialize() {
  try {
    styles = await Promise.all(Array.from({ length: 10 }, (_, index) => {
      const id = String(index + 1).padStart(2, '0');
      return import(`./variants/${id}.mjs`).then(module => module.default);
    }));
    const descriptions = {
      '01': '沿圣殿长街走动，拜访七位引路人；金色轮回之门位于东侧。',
      '02': '漫游虚空议庭，前后错位的星环席位与横向地面共同构成整备区。',
      '03': '穿行灰烬营地，补给摊与修行棚沿街展开，前往东侧的出发点。',
      '04': '走进主神档案长廊，拜访分散在街道两侧的六位整备者与任务使者。',
      '05': '穿过黑曜神龛的祭坛与立柱，在金色轮回之门前完成出发准备。',
      '06': '沿青铜仪盘的横向平台探索，穿行于前后错位的整备席位之间。',
      '07': '在悬浮月台上前后走动；左右穿行时，镜头跟随角色展开站台。',
      '08': '行走于万象回廊，人物按脚下位置互相遮挡，经过石柱时从旁绕行。',
      '09': '沿冷光终端的虚空廊道移动，靠近整备者后交谈，准备下一次轮回。',
      '10': '漫步寂静庭院，绕过石灯与祭坛，拜访引路人并走向副本传送门。',
    };
    styles = styles.map(style => ({ ...style, description: descriptions[style.id] }));
    if (new Set(styles.map(style => style.id)).size !== 10 || styles.some(style => typeof style.render !== 'function')) throw new Error('10 种方案的定义不完整');
    try {
      const saved = JSON.parse(localStorage.getItem(favoriteStorageKey) ?? '[]');
      if (!Array.isArray(saved)) throw new Error('留牌格式错误');
      for (const id of saved) if (styles.some(style => style.id === id)) favorites.add(id);
    } catch (error) { byId('saved-note').textContent = `留牌读取失败，本轮仍可使用：${error.message}`; }
    remaining = styles.map(style => style.id);
    const hashId = location.hash.slice(1);
    selectStyle(styles.some(style => style.id === hashId) ? hashId : '01');
    draw.disabled = false; keep.disabled = false;
  } catch (error) {
    scene.innerHTML = '';
    const notice = document.createElement('p'); notice.className = 'load-message'; notice.setAttribute('role', 'alert'); notice.textContent = `原型加载失败：${error.message}。请检查本地预览服务。`; scene.append(notice);
    byId('style-description').textContent = '请通过 http://127.0.0.1:8125/prototype/hub-draw/ 打开。';
    console.error('Hub prototype initialization failed', error);
  }
}

await initialize();
