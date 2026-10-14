import { variants as stoneMetal } from './variants/stone-metal.js';
import { variants as scrollJade } from './variants/scroll-jade.js';
import { variants as relicMinimal } from './variants/relic-minimal.js';

const variants = [...stoneMetal, ...scrollJade, ...relicMinimal].sort((a, b) => a.id.localeCompare(b.id));
if (variants.length !== 10 || new Set(variants.map(v => v.id)).size !== 10) throw new Error('HUD 卡组必须包含 10 个唯一方案。');
const $ = selector => document.querySelector(selector);
const resource = '../../cocos/assets/resources/';
const assets = {
  tower: `${resource}dungeon-world/demon_tower_1-v1.png`,
  mine: `${resource}dungeon-world/starfall_mine-v1.png`,
  archive: `${resource}dungeon-world/dream_archive-v1.png`,
  gate: `${resource}dungeon-world/ruined-stone-gate-v1.png`,
  monster: `${resource}monster-world/fog-lesser-demon-world-v1.png`,
  portrait: `${resource}character/reincarnator-v2.png`,
};
const sceneNames = { tower: '妖塔一层', mine: '星坠矿井', archive: '梦境档案馆' };
const icons = {
  character: '<path d="M21 9c-3-4 8-7 8-2M17 17c0-10 14-10 14 0v5c-1 7-13 7-14 0zM18 29l-7 5-3 8m22-13l7 5 3 8M17 33l7 6 7-6"/>',
  menu: '<path d="M24 11C18 8 12 7 6 9v31c6-2 12-1 18 2 6-3 12-4 18-2V9c-6-2-12-1-18 2zm0 0v31M12 17l6 2m-6 7l6 2m12-9l6-2m-6 11l6-2"/>',
  bag: '<path d="M17 13l-4-6 11 2 11-2-4 6M16 17h16M17 19C9 27 8 32 11 39c5 6 21 6 26 0 3-7 2-12-6-20M18 15l-7 4m19-4l7 5M24 18v10"/>',
  map: '<path d="M7 9l11 4 12-5 11 4v29l-11-4-12 5-11-4zM18 13v29M30 8v29M22 25l4-5 8 6"/><circle cx="26" cy="20" r="2"/>',
  quests: '<path d="M12 10h23v31H12zM16 10V6h15v4M17 20h13m-13 7h13m-13 7h8M9 15H6v27h23v-1"/>',
};
const labels = { character: '角色', menu: '菜单', bag: '背包', map: '地图', quests: '目标' };
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const knownId = value => variants.some(v => v.id === value);
const initialId = location.hash.slice(1);
let favorites = new Set();
let storageMessage = '';
try {
  const saved = JSON.parse(localStorage.getItem('infinite-flow-hud-menu-favorites-v2') || '[]');
  if (!Array.isArray(saved)) throw new Error('留牌记录格式不匹配');
  favorites = new Set(saved.filter(id => typeof id === 'string' && knownId(id)));
} catch (error) {
  storageMessage = `无法读取留牌记录，本次仍可正常选牌。${error instanceof SyntaxError ? '原记录不是有效数据。' : ''}`;
}
const state = { id: knownId(initialId) ? initialId : '01', scene: 'tower', hp: 102, size: 390, baseline: false, pin: null, overview: false, favoritesOnly: false, visited: new Set() };
state.visited.add(state.id);
const current = () => variants.find(v => v.id === state.id);
const announce = message => { $('#live-status').textContent = message; };
let opener = null;
const resizeObserver = new ResizeObserver(entries => {
  for (const entry of entries) {
    const stage = entry.target.querySelector('.game-stage');
    if (stage) {
      const scale = entry.contentRect.width / 750;
      stage.style.transform = `scale(${scale})`;
      stage.style.setProperty('--stage-scale', scale);
    }
  }
});

function button(action, extra, interactive) {
  const tag = interactive ? 'button' : 'div';
  return `<${tag} class="hud-btn hud-${extra}"${interactive ? ` type="button" data-ui="${action}" aria-label="${labels[action]}"` : ''}><span class="hud-glyph" aria-hidden="true"><svg viewBox="0 0 48 48">${icons[action]}</svg></span><span class="hud-btn-label">${labels[action]}</span></${tag}>`;
}
function stageHtml(id, interactive = true) {
  const compact = id !== 'current';
  return `<div class="game-stage" data-style="${id}"${!interactive ? ' aria-hidden="true"' : ''}>
    <div class="world" style="background-image:url('${assets[state.scene]}')"></div>
    <img class="scene-gate" src="${assets.gate}" alt=""><div class="scene-gate-label">断符石盘<span>入口未开放</span></div>
    <img class="scene-monster" src="${assets.monster}" alt=""><div class="scene-enemy-name">雾中妖鬼</div><div class="scene-hero"></div>
    <div class="scene-law">侵蚀：稳定 · 出口封印<br>法则：稳定</div>
    <div class="scene-bottom" aria-hidden="true"><div class="mock-stick"></div><div class="mock-interact">靠近互动</div></div>
    <div class="hud-layer${compact ? ' is-compact' : ''}" data-design="${id}" style="--health:${state.hp / 102 * 100}%">
      <header class="hud-top">${button('character', 'character', interactive)}
        <div class="hud-vitals">${compact ? '' : `<span class="hud-eyebrow">轮回者 · 妖塔</span><h3 class="hud-zone">${sceneNames[state.scene]}</h3>`}<div class="hud-hp-line"><span>生命</span><strong class="hud-hp-text">${state.hp}<small>/102</small></strong></div><div class="hud-hp-track"${interactive ? ` role="meter" aria-label="生命" aria-valuemin="0" aria-valuemax="102" aria-valuenow="${state.hp}"` : ''}><i></i></div></div>
        ${compact ? '' : `<div class="hud-preview"><span>临时试玩</span><small>刷新丢失进度</small></div>${button('menu', 'menu', interactive)}`}</header>
      <nav class="hud-rail"${interactive ? ' aria-label="快捷入口"' : ''}>${compact ? button('menu', 'menu', interactive) : ''}${button('bag', 'bag', interactive)}${button('map', 'map', interactive)}${button('quests', 'quests', interactive)}</nav>
    </div></div>`;
}
function observeStages() {
  resizeObserver.disconnect();
  document.querySelectorAll('.stage-slot').forEach(slot => resizeObserver.observe(slot));
}
function renderOverview() {
  $('#overview').hidden = !state.overview;
  $('#show-all').textContent = state.overview ? '收起十款' : '展开十款';
  $('#show-all').setAttribute('aria-expanded', String(state.overview));
  $('#only-favorites').setAttribute('aria-pressed', String(state.favoritesOnly));
  if (!state.overview) return;
  const filtered = variants.filter(v => !state.favoritesOnly || favorites.has(v.id));
  $('#overview-grid').innerHTML = filtered.map(v => `<button type="button" class="overview-card" data-pick="${v.id}" aria-label="选择 ${v.id} ${escapeHtml(v.name)}" aria-pressed="${v.id === state.id}"><div class="stage-slot">${stageHtml(v.id, false)}</div><strong>${v.id} ${escapeHtml(v.name)}${favorites.has(v.id) ? ' · 已留牌' : ''}</strong><small>${escapeHtml(v.material)}</small></button>`).join('');
  $('#empty-favorites').hidden = filtered.length > 0;
}
function render() {
  const selected = current();
  $('#card-number').textContent = selected.id;
  $('#card-title').textContent = selected.name;
  $('#material').textContent = selected.material;
  $('#description').textContent = selected.description;
  $('#features').innerHTML = selected.features.map(item => `<li>${escapeHtml(item)}</li>`).join('');
  $('#tradeoff').textContent = `取舍：${selected.tradeoff}`;
  $('#favorite').textContent = favorites.has(state.id) ? '已留这张 ✓' : '留这张';
  $('#favorite').setAttribute('aria-pressed', String(favorites.has(state.id)));
  $('#favorite').disabled = state.baseline;
  $('#pin').disabled = state.baseline;
  $('#pin').textContent = state.pin === state.id ? '已钉住 · 抽下一张' : '钉住对比';
  $('#draw-count').textContent = `已看 ${state.visited.size} / 10`;
  $('#stage-title').textContent = `${selected.id} / 10 · ${selected.name}`;
  $('#baseline').setAttribute('aria-pressed', String(state.baseline));
  $('#baseline').textContent = state.baseline ? '返回方案' : '看现用';
  $('#current-caption').textContent = state.baseline ? '现用样式 · HTML 复现' : `${selected.id} ${selected.name}${selected.recommended ? ' · 推荐' : ''}`;
  $('#main-stage').innerHTML = stageHtml(state.baseline ? 'current' : state.id);
  $('.stages').classList.toggle('is-comparing', Boolean(state.pin));
  $('.stages').style.setProperty('--preview-width', `${state.size}px`);
  $('#compare-column').hidden = !state.pin;
  if (state.pin) {
    const pinned = variants.find(v => v.id === state.pin);
    $('#compare-caption').textContent = `已钉住 · ${pinned.id} ${pinned.name}`;
    $('#compare-stage').innerHTML = stageHtml(pinned.id);
  } else $('#compare-stage').innerHTML = '';
  $('#deck').innerHTML = variants.map(v => `<button type="button" data-pick="${v.id}" class="${favorites.has(v.id) ? 'kept' : ''}" aria-label="${v.id} ${escapeHtml(v.name)}${favorites.has(v.id) ? ' 已留牌' : ''}" aria-pressed="${v.id === state.id && !state.baseline}" title="${escapeHtml(v.name)}">${v.id}</button>`).join('');
  document.querySelectorAll('[data-health]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.health) === state.hp)));
  document.querySelectorAll('[data-size]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.size) === state.size)));
  $('#save-notice').hidden = !storageMessage;
  $('#save-notice').textContent = storageMessage;
  renderOverview();
  observeStages();
}
function select(id, animate = false) {
  if (!knownId(id)) throw new Error(`未知方案 ${id}`);
  state.id = id;
  state.baseline = false;
  state.visited.add(id);
  history.replaceState(null, '', `#${id}`);
  render();
  announce(`已展开 ${id}，${current().name}。已看 ${state.visited.size} 款。`);
  if (animate) {
    $('#main-stage').classList.remove('is-drawing');
    requestAnimationFrame(() => $('#main-stage').classList.add('is-drawing'));
  }
}
function draw() {
  let candidates = variants.filter(v => !state.visited.has(v.id));
  if (!candidates.length) {
    state.visited = new Set([state.id]);
    candidates = variants.filter(v => v.id !== state.id);
  }
  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  select(chosen.id, true);
}
function storeFavorites() {
  try {
    localStorage.setItem('infinite-flow-hud-menu-favorites-v2', JSON.stringify([...favorites].sort()));
    storageMessage = '';
  } catch {
    storageMessage = '浏览器未允许保存留牌；本次留牌仍有效，刷新后可能丢失。';
  }
}
function openMenu(kind, trigger) {
  const styleId = trigger.closest('.hud-layer').dataset.design;
  const variant = variants.find(v => v.id === styleId);
  const dialog = $('#menu-dialog');
  opener = trigger;
  // A neutral dark sample panel isolates the five entry designs under evaluation.
  dialog.style.color = '#e9e3d3';
  $('#dialog-kicker').textContent = `${styleId === 'current' ? '现用样式' : variant.id + ' · ' + variant.name} / 入口交互`;
  $('#dialog-title').textContent = labels[kind];
  const views = {
    character: `<img class="sample-portrait" src="${assets.portrait}" alt="轮回者"><p>轮回者<br>体魄 12 · 身法 10</p><div class="sample-row"><span>生命</span><strong>${state.hp} / 102</strong></div><div class="sample-row"><span>功法</span><strong>吐纳诀</strong></div><div class="sample-row"><span>携行</span><strong>引路符 · 捕兽网</strong></div>`,
    menu: '<div class="sample-row"><span>所在区域</span><strong>妖塔一层</strong></div><div class="sample-row"><span>规则手册</span><strong>探索与战斗</strong></div><div class="sample-row"><span>本轮记录</span><strong>第 1 次轮回</strong></div><button type="button" data-close-panel style="margin-top:20px;width:100%">返回探索</button>',
    bag: `<div class="sample-tile"><span class="hud-glyph" aria-hidden="true"><svg viewBox="0 0 48 48">${icons.bag}</svg></span><div>止血丹 × 3<small>受伤时使用，恢复生命</small></div></div><div class="sample-row"><span>护甲补片</span><strong>× 1</strong></div><div class="sample-row"><span>引路符</span><strong>已携行</strong></div>`,
    map: '<p>妖塔一层 · 已知区域</p><div class="sample-map"><span>入口</span><span class="current">当前位置</span><span class="fog">迷雾</span><span>陷阱</span><span>石盘</span><span class="fog">迷雾</span><span class="fog">迷雾</span><span class="fog">迷雾</span><span class="fog">迷雾</span></div>',
    quests: '<div class="sample-row"><div>净除妖雾<br><span>击败本层的妖鬼</span></div><strong>0 / 3</strong></div><div class="sample-row"><div>寻得归途<br><span>解开出口的封印</span></div><strong>未完成</strong></div>',
  };
  $('#dialog-body').innerHTML = views[kind];
  dialog.showModal();
  $('#dialog-close').focus();
}
$('#draw').addEventListener('click', draw);
$('#show-all').addEventListener('click', () => { state.overview = !state.overview; renderOverview(); observeStages(); if(state.overview) $('#overview').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); });
$('#only-favorites').addEventListener('click', () => { state.favoritesOnly = !state.favoritesOnly; renderOverview(); observeStages(); });
$('#favorite').addEventListener('click', () => { favorites.has(state.id) ? favorites.delete(state.id) : favorites.add(state.id); storeFavorites(); render(); announce(favorites.has(state.id) ? `已留下 ${state.id} ${current().name}` : `已取消留牌 ${state.id}`); });
$('#pin').addEventListener('click', () => { state.pin = state.id; render(); announce(`已钉住 ${state.id}，继续抽卡即可并排比较。`); });
$('#unpin').addEventListener('click', () => { state.pin = null; render(); $('#pin').focus(); });
$('#baseline').addEventListener('click', () => { state.baseline = !state.baseline; render(); });
$('#scene').addEventListener('change', event => { state.scene = event.target.value; render(); });
$('#shuffle').addEventListener('click', () => { state.visited = new Set([state.id]); render(); announce('卡组已重洗，下一抽不会重复当前方案。'); });
$('#prev').addEventListener('click', () => select(variants[(variants.findIndex(v => v.id === state.id) + 9) % 10].id));
$('#next').addEventListener('click', () => select(variants[(variants.findIndex(v => v.id === state.id) + 1) % 10].id));
document.addEventListener('click', event => {
  const pick = event.target.closest('[data-pick]');
  if (pick) { const fromOverview = pick.classList.contains('overview-card'); select(pick.dataset.pick); if(fromOverview) { $('.workspace').scrollIntoView({block:'start',behavior:'instant'}); $('#draw').focus({preventScroll:true}); } }
  const health = event.target.closest('[data-health]');
  if (health) { state.hp = Number(health.dataset.health); render(); }
  const size = event.target.closest('[data-size]');
  if (size) { state.size = Number(size.dataset.size); render(); }
  const ui = event.target.closest('button[data-ui]');
  if (ui) openMenu(ui.dataset.ui, ui);
  if (event.target.closest('[data-close-panel]')) $('#menu-dialog').close();
});
$('#dialog-close').addEventListener('click', () => $('#menu-dialog').close());
$('#menu-dialog').addEventListener('close', () => { if(opener?.isConnected) opener.focus(); });
$('#menu-dialog').addEventListener('click', event => { if(event.target === $('#menu-dialog')) { const box=event.target.getBoundingClientRect(); if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom) event.target.close(); } });
window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if(knownId(id) && state.id !== id) select(id); });
document.addEventListener('error', event => { if(event.target instanceof HTMLImageElement) { event.target.alt = '图片加载失败'; storageMessage = '场景图片加载失败，请刷新页面后重试。'; $('#save-notice').hidden = false; $('#save-notice').textContent = storageMessage; } }, true);
render();
