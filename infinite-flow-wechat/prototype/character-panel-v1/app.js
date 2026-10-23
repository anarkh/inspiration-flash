/* Character sheet: 角色 / 携行 / 出战, driven by the real ViewModel through adapter.ts; never touches game saves. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  if (!window.CharacterDemo) { $('#body').textContent = '演示数据未加载：先运行 node prototype/character-panel-v1/build-adapter.mjs'; return; }
  let preset = 'prepared';
  let demo = window.CharacterDemo.createDemo(preset);
  let tab = 'overview';
  let sub = null;
  let toastTimer;

  const LEFT = ['head', 'charm', 'armor', 'feet'];
  const RIGHT = ['weapon', 'hands', 'waist'];
  // One tab each: what it is, how many go along, which facts a card shows, and where to get one.
  const PARTY = {
    pets: { category: '灵宠', kind: 'pet', rule: '同时 1 只出战，出战的属性与特性在副本中自动生效',
      facts: ['当前等级加成', '特性'], on: '★ 出战中', pick: '点击设为出战', empty: '尚未拥有灵宠', where: '可在灵宠师处签约，或在副本战斗中捕获' },
    companions: { category: '同伴', kind: 'companion', rule: '同时带 1 位，援护在战斗「法术 → 同伴」里使用',
      facts: ['援助技能'], on: '★ 出战中', pick: '点击设为出战', empty: '尚未招募同伴', where: '首通对应副本后，可在同行引路人处招募' },
    bloodlines: { category: '血统', kind: 'bloodline', rule: '同时激活 1 种，爆发在战斗「法术 → 血统」里使用',
      facts: ['1 阶属性', '血统爆发'], on: '★ 已激活', pick: '点击激活', empty: '尚未觉醒血统', where: '可在血脉祭司处觉醒' },
    methods: { category: '功法', kind: undefined, rule: '已学的全部生效；常用的战技排在「法术」首位',
      facts: ['功法被动', '主动战技'], on: '★ 常用', pick: '点击设为常用', empty: '尚未学习功法', where: '可在修行导师处学习' }
  };
  const TABS = [['overview', '角色'], ['carry', '携行'], ['pets', '灵宠'], ['companions', '同伴'], ['bloodlines', '血统'], ['methods', '功法']];
  const CATEGORY = { combat: '战斗', ward: '防护', portal: '传送', capture: '捕获' };

  function slot(entry) {
    return `<div class="slot">${entry?.icon ? `<img src="${esc(entry.icon)}" alt="">` : ''}<b>Lv${esc(entry?.level ?? '')}</b><small>${esc(entry?.slotLabel ?? '')}</small></div>`;
  }
  function renderOverview(view) {
    const loadout = view.loadout;
    const bySlot = slotId => loadout.equipment.find(entry => entry.slot === slotId);
    const metric = id => view.metrics.find(entry => entry.id === id)?.value;
    const stats = [['战力', loadout.power, 'power'], ['生命', `${loadout.hp}/${loadout.maxHp}`], ['攻击', loadout.attack], ['术法强度', loadout.artPower],
      ['防御', loadout.defense], ['速度', loadout.speed]];
    return `<div class="doll">
        <div class="doll-col">${LEFT.map(id => slot(bySlot(id))).join('')}</div>
        <div class="doll-center"><img src="${esc(view.portrait)}" alt=""><span class="badge-lv">转生者 Lv.1</span>
          ${view.phase === 'hub' ? '<button type="button" class="act" data-sub="equipment">装备与养成</button>' : ''}</div>
        <div class="doll-col">${RIGHT.map(id => slot(bySlot(id))).join('')}</div></div>
      <div class="stats"><h3>属性</h3><dl>${stats.map(([label, value, kind]) => `<div class="${kind ?? ''}"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}
        ${metric('reward-points') ? `<div><dt>奖励点</dt><dd>${esc(metric('reward-points'))}</dd></div>` : ''}</dl></div>`;
  }
  function renderEquipment(view) {
    const rows = view.owned.filter(row => row.equip !== undefined);
    return `<p class="proposal">只列装备；灵宠、同伴、血统、功法各在自己的页签更换。</p>
      <div class="equip-list">${rows.map(row => {
        const on = row.status.startsWith('已装备');
        return `<div class="sheet-card${on ? ' on' : ''}"><img src="${esc(row.icon ?? '')}" alt="">
          <div><div class="name">${esc(row.name)} <span class="line">${esc(row.category)}</span></div>
          <div class="state">${esc(row.status)}</div>
          ${on ? '' : `<button type="button" class="act" data-command='${esc(JSON.stringify(row.equip.command ?? null))}' ${row.equip.enabled ? '' : 'disabled'} title="${esc(row.equip.reason ?? '')}">穿戴</button>`}</div></div>`;
      }).join('')}</div>
      <button type="button" class="back" data-sub="">返回角色</button>`;
  }
  function renderCarry(view) {
    const loadout = view.loadout;
    const hub = view.phase === 'hub';
    const items = loadout.items.filter(entry => entry.itemGroup === 'carry');
    const byId = new Map(items.map(entry => [entry.itemId, entry]));
    return `<div class="group-head"><strong>携行槽</strong><span>${loadout.carriedCount} / ${loadout.carrySlots.length}</span></div>
      <div class="carry-slots">${loadout.carrySlots.map(slotEntry => {
        const entry = slotEntry.itemId ? byId.get(slotEntry.itemId) : undefined;
        return `<div class="carry-slot${entry ? ' filled' : ''}"><span>${esc(slotEntry.label)}</span>${entry ? `<img src="${esc(entry.icon ?? '')}" alt=""><span>${esc(entry.name)}</span>` : '<span>◇ 待装入</span>'}</div>`;
      }).join('')}</div>
      <div class="hint">${hub ? '点击道具装备 · 再次点击卸下' : '副本内不可调整携行'}</div>
      <div class="group-head"><strong>携行道具</strong><span>全部 ${items.length} 种</span></div>
      ${items.map(entry => {
        const action = view.carryActions[entry.itemId];
        const usable = hub && action?.enabled && (entry.carried || entry.count > 0);
        const label = entry.carried ? (hub ? '已装备 · 卸下' : '已装备') : entry.count <= 0 ? '未持有' : !hub ? '未装备' : usable ? '装备 ＋' : '无可用槽位';
        return `<button type="button" class="sheet-card${entry.carried ? ' on' : ''}${usable ? '' : ' locked'}" ${usable ? `data-command='${esc(JSON.stringify(action.command))}'` : ''}>
          <img src="${esc(entry.icon ?? '')}" alt=""><div><div class="name">${esc(entry.name)}</div>
          <div class="state">${esc(CATEGORY[entry.category] ?? '')} · 库存 ${esc(entry.count)} · ${esc(label)}</div></div></button>`;
      }).join('')}`;
  }
  function renderParty(view, section) {
    const hub = view.phase === 'hub';
    const intro = `<div class="tab-rule">${esc(section.rule)}</div>`;
    if (!hub && section.kind === undefined) {
      return `${intro}<div class="empty">副本中按入场时已学的全部功法生效，战技在战斗「法术 → 功法」里使用。</div>`;
    }
    const cards = hub
      ? view.owned.filter(row => row.category === section.category).map(row => {
        const active = /出战中|已激活|常用/.test(row.status);
        const usable = !active && row.activate?.enabled;
        const level = row.status.split('·').map(part => part.trim()).filter(part => !/^(出战中|已激活|常用|未出战|未激活|已拥有)$/.test(part)).join(' · ');
        const facts = section.facts.map(label => [label, row.details.find(item => item.label === label)?.value]).filter(([, value]) => value);
        return `<button type="button" class="sheet-card${active ? ' on' : ''}${usable ? '' : ' locked'}" ${usable ? `data-command='${esc(JSON.stringify(row.activate.command))}'` : ''}>
          <img src="${esc(row.icon ?? '')}" alt=""><div><div class="name">${esc(row.name)} <span class="line">${esc(level)}</span></div>
          <div class="state">${esc(active ? section.on : usable ? section.pick : row.activate?.reason ?? '暂不可更换')}</div>
          ${facts.map(([label, value]) => `<div class="line">${esc(label.replace(/^\d 阶属性$/, '属性'))}：${esc(value)}</div>`).join('')}</div></button>`;
      })
      : view.loadout.runParty.filter(member => member.kind === section.kind).map(member => `<div class="sheet-card on locked">
          <img src="${esc(member.icon ?? '')}" alt=""><div><div class="name">${esc(member.name)}</div>
          <div class="state">本局${esc(section.on.replace('★ ', ''))}</div><div class="line">${esc(member.description)}</div></div></div>`);
    return `${intro}${cards.length ? cards.join('') : `<div class="empty"><strong>${esc(hub ? section.empty : '本局未带')}</strong>${hub ? `<br>${esc(section.where)}` : ''}</div>`}`;
  }

  function render() {
    const view = demo.view();
    const hub = view.phase === 'hub';
    $('#wallet').textContent = view.dungeonName ? `副本中 · ${view.dungeonName}` : `◈ ${view.metrics.find(metric => metric.id === 'reward-points')?.value ?? ''}`;
    $('#tabs').innerHTML = TABS.map(([id, title]) =>
      `<button type="button" class="tab" role="tab" data-tab="${id}" aria-selected="${id === tab}">${title}</button>`).join('');
    $('#tabs').hidden = sub !== null;
    let body = '';
    let foot = '';
    if (sub === 'equipment') { body = renderEquipment(view); foot = '穿戴后属性立即生效'; }
    else if (tab === 'overview') { body = renderOverview(view); foot = hub ? '' : '副本中不能换装'; }
    else if (tab === 'carry') { body = renderCarry(view); foot = hub ? '下次入场生效 · 补给品不占槽' : '返回主神空间后可调整携行'; }
    else { body = renderParty(view, PARTY[tab]); foot = hub ? '点卡片更换 · 下次入场生效' : '副本中不能更换 · 返回主神空间后调整'; }
    $('#body').innerHTML = body;
    $('#footer').textContent = foot;
    $('#footer').hidden = foot === '';
  }
  function toast(message) {
    const node = $('#toast');
    node.textContent = message; node.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { node.hidden = true; }, 2600);
  }

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-tab],[data-sub],[data-command]');
    if (!target || target.disabled) return;
    if (target.dataset.tab) { tab = target.dataset.tab; sub = null; }
    else if (target.dataset.sub !== undefined) { sub = target.dataset.sub || null; }
    else if (target.dataset.command) {
      const command = JSON.parse(target.dataset.command);
      if (command) toast(demo.execute(command).message);
    }
    render();
  });
  $('#viewport').addEventListener('change', event => { $('#phone').dataset.width = event.target.value; });
  $('#preset').addEventListener('change', event => { preset = event.target.value; demo = window.CharacterDemo.createDemo(preset); sub = null; render(); });
  $('#reset').addEventListener('click', () => { demo = window.CharacterDemo.createDemo(preset); sub = null; render(); toast('已重置演示进度。'); });
  const params = new URLSearchParams(location.search);
  if (params.get('w') === '320') { $('#viewport').value = '320'; $('#phone').dataset.width = '320'; }
  if (['prepared', 'new', 'run'].includes(params.get('preset'))) { preset = params.get('preset'); $('#preset').value = preset; demo = window.CharacterDemo.createDemo(preset); }
  if (TABS.some(([id]) => id === location.hash.slice(1))) tab = location.hash.slice(1);
  if (location.hash === '#equipment') sub = 'equipment';
  render();
})();
