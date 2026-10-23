/* Merchant-specific layouts. Reuses the real ViewModel through the npc-dialogue adapter; never touches game saves. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  if (!window.NpcDemo) { $('#catalog').textContent = '演示数据未加载：先运行 node prototype/npc-shops-v2/build-adapter.mjs'; return; }
  const { panels, createDemo } = window.NpcDemo;
  const shops = panels.filter(panel => panel.id !== 'tasks');
  let preset = 'prepared';
  let demo = createDemo(preset);
  let active = shops.some(panel => panel.id === location.hash.slice(1)) ? location.hash.slice(1) : 'supplies';
  let slot = '武器';
  let detailId = null;
  let toastTimer;

  const ART = {
    methods: { mist_breathing: 'mist-breathing', iron_body: 'iron-body', cloud_step: 'cloud-step', gate_sense: 'gate-sense', star_core_method: 'star-core-method', beast_taming: 'beast-taming', void_heart: 'void-heart' },
    bloodlines: { titan_marrow: 'titan-marrow', void_symbiote: 'void-symbiote', bastion_chitin: 'bastion-chitin', phoenix_ember: 'phoenix-ember' },
    companions: { qin_che: 'qin-che', zhou_yingxue: 'zhou-yingxue', lu_guanlan: 'lu-guanlan' }
  };
  const NPC_ART = { bloodlines: '../npc-grid/assets/npc/bloodline-priest-v1.png', companions: '../npc-grid/assets/npc/companion-guide-v1.png' };
  // Display-only grades, the same mapping the game already shows on its grid.
  const GRADE = {
    methods: { mist_breathing: 'common', iron_body: 'uncommon', cloud_step: 'uncommon', gate_sense: 'rare', beast_taming: 'rare', star_core_method: 'epic', void_heart: 'legendary' },
    pets: { contract_sprite: 'common', mist_kitten: 'uncommon', ash_hound: 'rare', mirror_moth: 'rare', starling_drone: 'epic', void_whelp: 'legendary' },
    bloodlines: { titan_marrow: 'epic', void_symbiote: 'legendary', bastion_chitin: 'epic', phoenix_ember: 'legendary' },
    companions: { qin_che: 'rare', zhou_yingxue: 'epic', lu_guanlan: 'legendary' }
  };
  const GREETING = {
    equipment: '按部位挑装备，已拥有的可以直接升级。',
    supplies: '补给品有库存就能用；携行道具要先装进携行槽。',
    pets: '只有出战的灵宠生效，出战在「角色 → 灵宠」更换。',
    methods: '学会即得被动；战技在战斗「法术」里使用。',
    bloodlines: '同时只激活一种血统，在「角色 → 血统」激活。',
    companions: '每次带一位同伴，在「角色 → 同伴」设为出战。'
  };
  const SLOTS = ['武器', '头部', '护甲', '护手', '足部', '腰部', '护符'];

  const fact = (row, label) => row.details.find(item => item.label === label)?.value;
  const cost = action => action?.description.split(' · 消耗 ')[1];
  const icon = row => row.icon ?? (ART[active]?.[row.id] ? `../npc-grid/assets/${active}/${ART[active][row.id]}-v1.png` : '');
  const grade = row => row.rarity ?? GRADE[active]?.[row.id];
  const find = (row, pattern) => row.actions.find(action => pattern.test(action.label));
  const acquire = row => find(row, /^(兑换|签约|学习|招募|觉醒)/);
  const upgrade = row => find(row, /^(升级|培养|精研|训练|晋升)/);
  const owned = row => !/未拥有|未学习|未觉醒|未解锁|可招募|可兑换|未兑换/.test(row.status) && !acquire(row)?.enabled;
  const isActive = row => /出战中|已激活|已装备/.test(row.status);
  const level = row => row.status.match(/(\d+)\s*(级|阶)/)?.[1];

  // Merchants only sell and train; who goes along is chosen on the character sheet.
  function primary(row) {
    return owned(row) ? upgrade(row) : acquire(row);
  }
  function shortLabel(action, row) {
    return action.label.replace(row.name, '').replace(/[：:]\s*$/, '').replace(/灵宠|同伴/, '').trim() || action.label;
  }
  function actButton(action, row, { primaryStyle = false } = {}) {
    if (!action) return '';
    const price = cost(action);
    return `<button type="button" class="act${primaryStyle ? ' primary' : ''}" data-action="${esc(action.id)}" ${action.enabled ? '' : 'disabled'} title="${esc(action.enabled ? price ?? '' : action.reason ?? '')}">${esc(shortLabel(action, row))}</button>`;
  }
  function pips(row, max = 3) {
    const value = Number(level(row) ?? 0);
    return `<span class="pips">${'◆'.repeat(Math.min(value, max))}<i>${'◇'.repeat(Math.max(0, max - value))}</i></span>`;
  }
  function chip(text, kind = '') { return text ? `<span class="chip ${kind}">${esc(text)}</span>` : ''; }
  function usage(row) {
    switch (active) {
      case 'supplies': return row.category === '补给品' ? '副本战斗「药品」里使用，不占携行槽。' : '在「角色 → 携行」装入后，副本战斗中可用。';
      case 'equipment': return '在「背包 → 装备」手动穿戴后属性生效，同部位只穿一件。';
      case 'pets': return '在「角色 → 灵宠」设为出战后，属性常驻，特性在战斗、陷阱、传送中自动触发；副本里血条下显示头像。';
      case 'methods': return `被动学会即生效；战技在副本战斗「法术 → 功法」里，每场一次：${fact(row, '主动战技') ?? ''}`;
      case 'bloodlines': return `在「角色 → 血统」激活后属性常驻；副本战斗「法术 → 血统」可发动爆发，每场一次：${fact(row, '血统爆发') ?? ''}`;
      case 'companions': return `在「角色 → 同伴」设为出战后，副本战斗「法术 → 同伴」里援护，每场一次：${fact(row, '援助技能') ?? ''}`;
      default: return '';
    }
  }

  function supplyRow(row) {
    const buy = acquire(row);
    const stock = row.status.match(/库存\s*(\d+)/)?.[1] ?? '0';
    const carry = row.status.includes('已携行') ? chip('已携行', 'on') : row.status.includes('未携行') ? chip('未携行', 'lock') : '';
    return `<div class="row" data-detail="${esc(row.id)}" data-rarity="${esc(grade(row))}">
      <img class="icon" src="${esc(icon(row))}" alt="">
      <div class="row-main"><div class="row-head"><span class="name">${esc(row.name)}</span>${carry}<span class="row-line">持有 ${esc(stock)}</span></div>
        <div class="row-line effect">${esc(row.description)}</div></div>
      <div class="row-side"><span class="price">${esc((fact(row, '兑换单价') ?? '').replace(' 奖励点', ''))}</span>${actButton(buy, row)}</div></div>`;
  }
  function equipmentRow(row) {
    const have = owned(row);
    const up = upgrade(row);
    const buy = acquire(row);
    const state = isActive(row) ? chip('已装备', 'on') : have ? chip(`Lv${level(row) ?? 1}`) : buy?.enabled ? chip('可兑换') : chip('未解锁', 'lock');
    const [current, max] = (fact(row, '等级') ?? '').split('/').map(value => Number(value.trim()));
    const maxed = have && current !== undefined && current === max;
    const sub = have ? (up?.enabled ? `升级：${cost(up)}` : maxed ? '已满级' : up?.reason ?? '') : buy?.enabled ? `兑换：${cost(buy) ?? ''}` : buy?.reason ?? '';
    const action = have ? (up?.enabled ? up : null) : (buy?.enabled ? buy : null);
    return `<div class="row${!have && !buy?.enabled ? ' dim' : ''}" data-detail="${esc(row.id)}" data-rarity="${esc(grade(row))}">
      <img class="icon" src="${esc(icon(row))}" alt="">
      <div class="row-main"><div class="row-head"><span class="name">${esc(row.name)}</span>${state}</div>
        <div class="row-line effect">${esc(fact(row, '基础属性') ?? '')}</div><div class="row-line">${esc(sub)}</div></div>
      <div class="row-side">${actButton(action, row)}</div></div>`;
  }
  function methodRow(row) {
    const learned = owned(row);
    const action = learned ? upgrade(row) : acquire(row);
    return `<div class="row${learned ? '' : ' '}" data-detail="${esc(row.id)}" data-rarity="${esc(grade(row))}">
      <img class="icon" src="${esc(icon(row))}" alt="">
      <div class="row-main"><div class="row-head"><span class="name">${esc(row.name)}</span>${learned ? pips(row) : chip('未学习', 'lock')}${row.status.includes('常用') ? chip('常用') : ''}</div>
        <div class="row-line effect">被动：${esc(fact(row, '功法被动') ?? '')}</div>
        <div class="row-line">战技：${esc(fact(row, '主动战技') ?? '')}</div></div>
      <div class="row-side"><span class="price">${esc((cost(action) ?? '').split('、')[0])}</span>${actButton(action, row, { primaryStyle: !learned && action?.enabled })}</div></div>`;
  }
  function badge(row) {
    if (isActive(row)) return chip(active === 'bloodlines' ? '★已激活' : '★出战', 'on');
    if (owned(row)) return chip('已拥有');
    return chip(/未解锁/.test(row.status) ? '未解锁' : active === 'bloodlines' ? '未觉醒' : '未拥有', 'lock');
  }
  function cardEffect(row) {
    if (active === 'pets') return `${fact(row, '当前等级加成') ?? ''}${owned(row) ? '' : ` · ${fact(row, '获得途径') ?? ''}`}`;
    if (active === 'bloodlines') return `${fact(row, '1 阶属性') ?? ''}`;
    return row.description;
  }
  function cardUse(row) {
    if (active === 'pets') return isActive(row) ? '副本中自动生效' : owned(row) ? '在「角色 → 灵宠」设为出战' : row.category === '副本捕获' ? '在副本战斗中捕获获得' : '';
    if (active === 'bloodlines') return owned(row) && !isActive(row) ? '在「角色 → 血统」激活' : `爆发：${fact(row, '血统爆发') ?? ''}`;
    return '';
  }
  function card(row) {
    // Capture-only pets are met in a run, not bought: say so instead of showing a dead button.
    const captureOnly = active === 'pets' && !owned(row) && row.category === '副本捕获';
    const action = captureOnly ? undefined : primary(row);
    return `<div class="card${isActive(row) ? ' active' : ''}${owned(row) ? '' : ' dim'}" data-detail="${esc(row.id)}" data-rarity="${esc(grade(row))}">
      <img class="portrait" src="${esc(icon(row))}" alt="">
      <span class="badge">${badge(row)}</span>
      <span class="name">${esc(row.name)}</span>
      <span class="meta"><span>${esc(row.category)}</span>${owned(row) ? pips(row) : ''}</span>
      <span class="effect">${esc(cardEffect(row))}</span>
      <span class="use">${esc(cardUse(row))}</span>
      ${actButton(action, row, { primaryStyle: action?.enabled })}</div>`;
  }
  function companionCard(row) {
    const action = primary(row);
    const locked = /未解锁/.test(row.status);
    return `<div class="wide-card${isActive(row) ? ' active' : ''}${owned(row) ? '' : ' dim'}" data-detail="${esc(row.id)}" data-rarity="${esc(grade(row))}">
      <img src="${esc(icon(row))}" alt="">
      <div class="body"><div class="head"><span class="name">${esc(row.name)}</span>${badge(row)}</div>
        <span class="row-line">${esc(row.category)}${owned(row) ? ` · ${level(row) ?? 1} 阶` : ''}</span>
        <span class="row-line effect">援护：${esc(fact(row, '援助技能') ?? '')}</span>
        <span class="row-line">${esc(locked ? `条件：${fact(row, '招募条件') ?? ''}` : isActive(row) ? '战斗「法术 → 同伴」里使用，每场一次' : owned(row) ? '在「角色 → 同伴」设为出战' : `招募：${fact(row, '招募消耗') ?? ''}`)}</span>
        <div class="foot">${owned(row) ? pips(row) : '<span></span>'}${actButton(action, row, { primaryStyle: action?.enabled })}</div></div></div>`;
  }

  function renderCatalog(rows) {
    const catalog = $('#catalog');
    $('#tabs').hidden = active !== 'equipment';
    if (active === 'supplies') {
      const supply = rows.filter(row => row.category === '补给品');
      const carry = rows.filter(row => row.category !== '补给品');
      catalog.innerHTML = `<div class="section-label">补给品<span>不占携行，有库存即可用</span></div>${supply.map(supplyRow).join('')}
        <div class="section-label">携行道具<span>需装入携行槽</span></div>${carry.map(supplyRow).join('')}`;
    } else if (active === 'equipment') {
      $('#tabs').innerHTML = SLOTS.map(name => {
        const inSlot = rows.filter(row => row.category === name);
        return `<button type="button" class="tab" role="tab" data-slot="${name}" aria-selected="${name === slot}">${name.slice(0, 2)}<small>${inSlot.filter(owned).length}</small></button>`;
      }).join('');
      const order = row => isActive(row) ? 0 : owned(row) ? 1 : acquire(row)?.enabled ? 2 : 3;
      catalog.innerHTML = rows.filter(row => row.category === slot).sort((a, b) => order(a) - order(b)).map(equipmentRow).join('');
    } else if (active === 'methods') {
      const order = row => owned(row) ? 0 : 1;
      catalog.innerHTML = rows.slice().sort((a, b) => order(a) - order(b)).map(methodRow).join('');
    } else if (active === 'companions') {
      catalog.innerHTML = `<div class="wide-cards">${rows.map(companionCard).join('')}</div>`;
    } else {
      catalog.innerHTML = `<div class="cards">${rows.map(card).join('')}</div>`;
    }
  }

  function renderDetail(rows) {
    const node = $('#detail');
    const row = rows.find(candidate => candidate.id === detailId);
    if (!row) { node.hidden = true; return; }
    const disabledReason = row.actions.find(action => !action.enabled && action.reason)?.reason;
    node.hidden = false;
    node.innerHTML = `<div class="detail-head" data-rarity="${esc(grade(row))}"><img class="icon" src="${esc(icon(row))}" alt="">
        <div><span class="name">${esc(row.name)}</span><p>${esc(row.category)} · ${esc(row.status)}</p></div>
        <button type="button" class="close" data-close-detail aria-label="返回列表">×</button></div>
      <div class="detail-body"><div class="where">在哪里用：${esc(usage(row))}</div>
        <dl>${row.details.filter(item => item.label !== '生效方式' && item.value !== row.description).map(item => `<div><dt>${esc(item.label)}</dt><dd>${esc(item.value)}</dd></div>`).join('')}</dl></div>
      <div class="detail-foot">${row.actions.filter(action => action.enabled).map(action => `${actButton(action, row, { primaryStyle: action === primary(row) })}`).join('')}
        ${row.actions.some(action => action.enabled) ? '' : `<span class="reason">${esc(disabledReason ?? '暂无可执行操作')}</span>`}</div>`;
  }

  function render() {
    const panel = shops.find(candidate => candidate.id === active);
    const rows = demo.getRows(active);
    const wallet = demo.getWallet();
    $('#npc-nav').innerHTML = shops.map(candidate => `<button type="button" class="npc-link" data-panel="${candidate.id}" ${candidate.id === active ? 'aria-current="page"' : ''}>
      <img src="${esc(candidate.portrait ?? NPC_ART[candidate.id])}" alt=""><span><strong>${esc(candidate.name)}</strong><small>${esc(candidate.title)}</small></span></button>`).join('');
    $('#wallet').textContent = `◈ ${wallet.rewardPoints}  灵蕴 ${wallet.lingyun}`;
    $('#window-title').textContent = panel.title;
    $('#window-wallet').textContent = `◈${wallet.rewardPoints} · 蕴${wallet.lingyun}`;
    $('#npc-intro').innerHTML = `<img src="${esc(panel.portrait ?? NPC_ART[active])}" alt=""><div><strong>${esc(panel.name)}</strong><p>${esc(GREETING[active])}</p></div>`;
    const services = demo.getGlobalActions(active).filter(action => !/选择材料/.test(action.label));
    $('#services').hidden = services.length === 0;
    $('#services').innerHTML = services.slice(0, 2).map(action => `<button type="button" class="act" data-action="${esc(action.id)}" ${action.enabled ? '' : 'disabled'} title="${esc(action.reason ?? '')}">${esc(action.label)}</button>`).join('');
    renderCatalog(rows);
    renderDetail(rows);
  }

  function toast(message) {
    const node = $('#toast');
    node.textContent = message; node.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { node.hidden = true; }, 2600);
  }

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-action],[data-detail],[data-panel],[data-slot],[data-close-detail]');
    if (!target) return;
    if (target.dataset.action) {
      const action = [...demo.getRows(active).flatMap(row => row.actions), ...demo.getGlobalActions(active)].find(candidate => candidate.id === target.dataset.action);
      if (action) toast(demo.execute(action).message);
    } else if (target.dataset.panel) {
      active = target.dataset.panel; detailId = null; location.hash = active;
    } else if (target.dataset.slot) {
      slot = target.dataset.slot;
    } else if (target.dataset.closeDetail !== undefined) {
      detailId = null;
    } else if (target.dataset.detail) {
      detailId = target.dataset.detail;
    }
    render();
  });
  $('#viewport').addEventListener('change', event => { $('#phone').dataset.width = event.target.value; });
  const requestedWidth = new URLSearchParams(location.search).get('w');
  if (requestedWidth === '320' || requestedWidth === '390') { $('#viewport').value = requestedWidth; $('#phone').dataset.width = requestedWidth; }
  $('#preset').addEventListener('change', event => { preset = event.target.value; demo = createDemo(preset); detailId = null; render(); });
  $('#reset').addEventListener('click', () => { demo = createDemo(preset); detailId = null; render(); toast('已重置演示进度。'); });
  render();
})();
