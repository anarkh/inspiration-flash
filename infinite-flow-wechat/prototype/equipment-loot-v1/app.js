import { createEquipmentDemo, assetUrl } from './game-model.js?v=2';

const dialog = document.querySelector('#reward-dialog');
const stage = document.querySelector('#stage');
const world = document.querySelector('#world');
const scrim = document.querySelector('#scrim');
const caption = document.querySelector('#preview-caption');
const interact = document.querySelector('#interact');
const backpack = document.querySelector('#backpack');
const receipt = document.querySelector('#world-receipt');
let game = createEquipmentDemo();
let model = game.snapshot();
let choices = game.offerOptions();
const state = { phase: 'unclaimed', selectedId: 'armor_piercing_sword', claimedId: null, view: 'choice', opened: true, inventoryTab: 'bag', scrollOffset: 0, tip: null, error: '' };
let claimTimer = null;
let operation = 0;
let returnFocus = interact;
let tipReturnId = null;

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const loadout = () => model.sections[1].loadout;
const selectedEquipment = () => choices.find(item => item.equipmentId === state.selectedId);
const claimedEquipment = () => loadout().ownedEquipment.find(item => item.equipmentId === state.claimedId);
const busy = () => state.phase === 'collecting';
const header = (kicker, title, extraClass = '') => `<header class="dialog-header ${extraClass}"><p class="dialog-kicker">${escape(kicker)}</p><h2 id="dialog-title">${escape(title)}</h2><button type="button" class="dialog-close" data-action="close" aria-label="关闭面板" ${busy() ? 'disabled' : ''}>×</button></header>`;
const mainButton = (action, label, disabled = false) => `<button type="button" class="primary" data-action="${action}" ${disabled ? 'disabled' : ''}><span>${escape(label)}</span><span class="arrow" aria-hidden="true">${busy() ? '· · ·' : '→'}</span></button>`;
const figure = (kind, id, name) => {
  const image = assetUrl(kind, id);
  return image ? `<img src="${escape(image)}" alt="">` : `<span class="inventory-glyph" aria-hidden="true">${escape(name.slice(-1))}</span>`;
};

function attributes(item) {
  return `<section class="equipment-detail" aria-label="${escape(item.name)}属性" aria-live="polite"><div class="detail-heading"><h3>${escape(item.name)}</h3><span>Lv.${item.level} · ${escape(item.slotLabel)}</span></div><dl class="attribute-list"><dt>基础属性</dt><dd><span>${escape(item.baseStatsReadout)}</span></dd><dt>固定词缀</dt><dd><span class="affix-name">${escape(item.affixReadout)}</span></dd></dl></section>`;
}

function choiceView() {
  const selected = selectedEquipment();
  const cards = `<div class="equipment-grid" role="group" aria-label="三选一装备">${choices.map(item => `<button type="button" class="equipment-card" data-equipment="${item.equipmentId}" aria-pressed="${state.selectedId === item.equipmentId}" aria-label="选择${escape(item.name)}，Lv.${item.level}，${escape(item.slotLabel)}" ${busy() ? 'disabled' : ''}>${figure('equipment', item.equipmentId, item.name)}<strong>${escape(item.name)}</strong><small>Lv.${item.level} · ${escape(item.slotLabel)}</small></button>`).join('')}</div>`;
  return header('精英战利品 · 三选一', '选择一件装备') + cards + attributes(selected)
    + `<footer class="dialog-footer">${mainButton('claim', busy() ? '正在收入背包' : '收入背包', busy())}</footer>`;
}

function inventoryEquipmentView() {
  const entries = loadout().ownedEquipment;
  return '<p class="inventory-hint">点击装备查看属性与穿戴</p>'
    + `<div class="inventory-scroll"><div class="inventory-grid">${entries.map(entry => `<button type="button" class="inventory-cell inventory-equipment-cell${entry.equipped ? ' is-equipped' : ''}" data-inventory-equipment="${entry.equipmentId}" aria-label="${escape(entry.name)}，${entry.equipped ? '已装备' : `Lv.${entry.level}，${escape(entry.slotLabel)}`}" aria-haspopup="dialog">${figure('equipment', entry.equipmentId, entry.name)}<strong>${escape(entry.name)}</strong><small>${entry.equipped ? '已装备' : `Lv.${entry.level} · ${escape(entry.slotLabel)}`}</small></button>`).join('')}${entries.length ? '' : '<p class="inventory-empty">尚未拥有装备</p>'}</div></div>`;
}

function inventoryBagView() {
  const items = loadout().items.filter(entry => entry.itemGroup === 'supply');
  const metric = id => model.sections[1].metrics.find(entry => entry.id === id)?.value ?? '—';
  const blanks = Array.from({ length: Math.max(0, 100 - items.length) }, () => '<div class="inventory-cell inventory-blank" aria-hidden="true"></div>').join('');
  return `<div class="inventory-money"><span>◇ 补给品 · 不占携行槽</span><span class="lingyun">${escape(metric('lingyun'))} 灵蕴</span><span>${escape(metric('reward-points'))} 奖励点</span></div>`
    + `<p class="inventory-supply-hint">补给品 ${items.length} 种 · 上下滑动浏览 · 点击钉住详情</p><div class="inventory-scroll"><div class="inventory-grid inventory-supply-grid">${items.map(entry => `<button type="button" class="inventory-cell inventory-supply-cell" data-bag-item="${entry.itemId}" aria-label="${escape(entry.name)}，库存${entry.count}" aria-haspopup="dialog">${figure('item', entry.itemId, entry.name)}<small>×${entry.count}</small></button>`).join('')}${blanks}</div></div>`;
}

function inventoryRelicsView() {
  const relics = loadout().runRelics;
  const intro = '<p class="inventory-relic-intro">选中后自动生效，无需装备；仅本局有效。</p>';
  if (!relics.length) return intro + `<p class="inventory-empty">${['explore', 'combat'].includes(model.phase) ? '本局尚未获得遗物' : '进入副本后可获得本局遗物'}</p>`;
  return intro + `<div class="inventory-scroll"><div class="inventory-relic-grid">${relics.map(relic => `<article class="inventory-relic"><div><strong>${escape(relic.name)}</strong><small>${escape(relic.frameName)}回响</small></div><p>${escape(relic.description)}</p></article>`).join('')}</div></div>`;
}

function inventoryView() {
  const tabs = [{ id: 'bag', title: '补给品' }, { id: 'equipment', title: `装备 ${loadout().ownedEquipment.length}` }, { id: 'run-relics', title: `本局遗物 ${loadout().runRelics.length}` }];
  return `<div class="inventory-view">${header('角色物品', '行囊', 'inventory-header')}<div class="inventory-tabs" role="group" aria-label="背包分类">${tabs.map(tab => `<button type="button" data-inventory-tab="${tab.id}" aria-pressed="${state.inventoryTab === tab.id}">${tab.title}</button>`).join('')}</div><div class="inventory-body">${state.inventoryTab === 'equipment' ? inventoryEquipmentView() : state.inventoryTab === 'run-relics' ? inventoryRelicsView() : inventoryBagView()}</div></div>${state.tip ? inventoryTipView() : ''}`;
}

function inventoryTipView() {
  let name;
  let content;
  let action;
  let actionLabel;
  if (state.tip.kind === 'equip') {
    const entry = loadout().ownedEquipment.find(item => item.equipmentId === state.tip.id);
    if (!entry) throw new Error(`背包装备缺失：${state.tip.id}`);
    name = entry.name;
    action = entry.equipAction;
    actionLabel = entry.equipped ? '已装备' : '装备';
    content = `<p>${escape(entry.slotLabel)} · Lv.${entry.level}/${entry.maxLevel}${entry.equipped ? ' · 已装备' : ''}</p><p class="tip-base">${escape(entry.baseStatsLabel)}：${escape(entry.baseStatsReadout)}</p>`
      + (entry.growthStatsReadout ? `<p>每级成长：${escape(entry.growthStatsReadout)}</p>` : '')
      + `<p class="tip-affix">固定词缀：${escape(entry.affixReadout)}</p>`
      + (entry.rollReadout ? `<p class="tip-affix">${escape(entry.rollReadout)}</p>` : '')
      + (!action.enabled && !entry.equipped && action.disabledReason ? `<p class="tip-error">${escape(action.disabledReason)}</p>` : '');
  } else {
    const entry = game.itemDetail(state.tip.id);
    name = entry.name;
    action = game.itemAction(entry.itemId);
    actionLabel = '使用止血丹';
    content = `<p>补给品 · 随库存可用，无需携行</p><p>库存 ${entry.count} · 补给品</p><p class="tip-base">使用：${escape(entry.description)}</p>`
      + (entry.flavor ? `<p class="tip-affix"><em>${escape(entry.flavor)}</em></p>` : '')
      + `<p>兑换价：${entry.cost ?? '—'} 奖励点</p>`
      + (action?.readout ? `<p>${escape(action.readout)}</p>` : '')
      + (action?.disabledReason ? `<p class="tip-error">${escape(action.disabledReason)}</p>` : '');
  }
  return `<div class="sheet-tip-backdrop" data-action="close-tip" aria-hidden="true"></div><section class="inventory-tip" role="dialog" aria-modal="false" aria-labelledby="tip-title"><h3 id="tip-title">${escape(name)}</h3><div class="tip-content">${content}${state.error ? `<p class="tip-error" role="alert">${escape(state.error)}</p>` : ''}</div><div class="tip-actions"><button type="button" data-action="close-tip">关闭</button>${action ? `<button type="button" data-action="${state.tip.kind === 'equip' ? 'equip' : 'use-supply'}" data-model-action="${escape(action.actionId)}" ${action.enabled ? '' : 'disabled'}>${actionLabel}</button>` : ''}</div></section>`;
}

function render({ focus = false, focusId = null, captureScroll = true } = {}) {
  if (captureScroll && state.view === 'inventory') {
    const scroll = dialog.querySelector('.inventory-scroll');
    if (scroll) state.scrollOffset = scroll.scrollTop;
  }
  model = game.snapshot();
  world.inert = state.opened;
  scrim.hidden = !state.opened;
  dialog.hidden = !state.opened;
  dialog.classList.toggle('busy', busy());
  dialog.classList.toggle('inventory-dialog', state.view === 'inventory');
  dialog.classList.toggle('tip-open', Boolean(state.tip));
  dialog.setAttribute('aria-busy', String(busy()));
  interact.textContent = state.phase === 'claimed' ? '已领取' : '选装备';
  interact.disabled = state.phase === 'claimed';
  document.querySelector('.equipment-cache').hidden = state.phase === 'claimed';
  receipt.hidden = state.opened || state.phase !== 'claimed';
  if (state.phase === 'claimed') receipt.textContent = `已收入背包 · ${claimedEquipment().name}`;
  caption.textContent = state.error || (busy() ? '正在收入背包 · 请稍候，不能重复领取'
    : state.phase === 'claimed' ? `${claimedEquipment().name}已永久拥有 · 可在背包立即装备`
    : state.view === 'inventory' && state.opened ? '背包使用真实游戏数据 · 初始装备与补给均保留'
    : `${state.opened ? '待领取' : '已关闭，选择保留'} · 当前选中${selectedEquipment().name}`);
  if (!state.opened) {
    if (focus) returnFocus.focus({ preventScroll: true });
    return;
  }
  dialog.innerHTML = state.view === 'inventory' ? inventoryView() : choiceView();
  const scroll = dialog.querySelector('.inventory-scroll');
  if (scroll) scroll.scrollTop = state.scrollOffset;
  if (focus) {
    const focusTarget = state.tip ? dialog.querySelector('.inventory-tip button:not(:disabled)')
      : focusId ? dialog.querySelector(`[data-equipment="${focusId}"], [data-inventory-equipment="${focusId}"], [data-bag-item="${focusId}"], [data-inventory-tab="${focusId}"]`)
      : state.view === 'inventory' ? dialog.querySelector(`[data-inventory-tab="${state.inventoryTab}"]`)
      : dialog.querySelector('.primary:not(:disabled)');
    (focusTarget || dialog.querySelector('button:not(:disabled)'))?.focus({ preventScroll: true });
  }
}

function closeTip() {
  state.tip = null;
  state.error = '';
  render({ focus: true, focusId: tipReturnId });
}

function closeDialog() {
  if (busy()) return;
  state.opened = false;
  state.tip = null;
  state.error = '';
  render({ focus: true });
}

function dismissOutside() {
  if (state.tip) closeTip();
  else closeDialog();
}

function openDialog(view, trigger) {
  returnFocus = trigger;
  state.opened = true;
  state.view = view === 'choice' && state.phase === 'claimed' ? 'inventory' : view;
  state.inventoryTab = 'bag';
  state.scrollOffset = 0;
  state.tip = null;
  state.error = '';
  render({ focus: true, captureScroll: false });
}

function claim() {
  if (state.phase !== 'unclaimed') return;
  const chosen = selectedEquipment();
  state.phase = 'collecting';
  state.error = '';
  const token = ++operation;
  render();
  claimTimer = setTimeout(() => {
    if (token !== operation) return;
    claimTimer = null;
    const result = game.executeAction(chosen.actionId);
    if (!result.ok) {
      state.phase = 'unclaimed';
      state.error = `未能收入背包：${result.message}`;
      render({ focus: true });
      return;
    }
    state.phase = 'claimed';
    state.claimedId = chosen.equipmentId;
    state.opened = false;
    returnFocus = backpack;
    render({ focus: true });
  }, 420);
}

function reset() {
  if (claimTimer !== null) clearTimeout(claimTimer);
  claimTimer = null;
  operation += 1;
  game = createEquipmentDemo();
  choices = game.offerOptions();
  Object.assign(state, { phase: 'unclaimed', selectedId: 'armor_piercing_sword', claimedId: null, view: 'choice', opened: true, inventoryTab: 'bag', scrollOffset: 0, tip: null, error: '' });
  returnFocus = interact;
  tipReturnId = null;
  render({ focus: true, captureScroll: false });
}

function openTip(kind, id) {
  state.tip = { kind, id };
  tipReturnId = id;
  state.error = '';
  render({ focus: true });
}

function executeTipAction(actionId) {
  const result = game.executeAction(actionId);
  state.error = result.ok ? '' : result.message;
  render({ focus: true });
}

dialog.addEventListener('click', event => {
  const target = event.target.closest('button, [data-action="close-tip"]');
  if (!target || target.disabled || busy()) return;
  if (target.dataset.equipment && state.phase === 'unclaimed') {
    state.selectedId = target.dataset.equipment;
    render({ focus: true, focusId: state.selectedId });
    return;
  }
  if (target.dataset.inventoryTab) {
    state.inventoryTab = target.dataset.inventoryTab;
    state.scrollOffset = 0;
    state.tip = null;
    state.error = '';
    render({ focus: true, focusId: state.inventoryTab, captureScroll: false });
    return;
  }
  if (target.dataset.inventoryEquipment) { openTip('equip', target.dataset.inventoryEquipment); return; }
  if (target.dataset.bagItem) { openTip('item', target.dataset.bagItem); return; }
  switch (target.dataset.action) {
    case 'close': closeDialog(); break;
    case 'close-tip': closeTip(); break;
    case 'claim': claim(); break;
    case 'equip':
    case 'use-supply': executeTipAction(target.dataset.modelAction); break;
  }
});

interact.addEventListener('click', () => openDialog('choice', interact));
backpack.addEventListener('click', () => openDialog('inventory', backpack));
scrim.addEventListener('click', () => {
  // Production inventory blocks the world backdrop; only a pinned tip
  // attaches an outside-click handler. The sheet itself closes via its X.
  if (state.view === 'inventory' && state.tip) closeTip();
});
document.querySelector('#reset').addEventListener('click', reset);
document.querySelectorAll('[data-size]').forEach(button => button.addEventListener('click', () => {
  const size = Number(button.dataset.size);
  stage.style.setProperty('--stage-width', `${size}px`);
  stage.style.setProperty('--stage-height', size === 320 ? '568px' : '844px');
  document.querySelectorAll('[data-size]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
}));
document.addEventListener('keydown', event => {
  if (!state.opened) return;
  if (event.key === 'Escape' && !busy()) { event.preventDefault(); dismissOutside(); }
  if (event.key !== 'Tab' || !dialog.contains(document.activeElement)) return;
  const buttons = [...dialog.querySelectorAll('button:not(:disabled)')];
  const first = buttons[0];
  const last = buttons[buttons.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
});

render();
