/* Standalone grid prototype. Reuses the existing in-memory demo adapter, never game saves. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  if (!window.NpcDemo) {
    $('#catalog').innerHTML = '<div class="empty-state"><strong>演示数据未加载</strong>请构建 npc-dialogue 的数据脚本后刷新。</div>';
    return;
  }
  const { panels, createDemo } = window.NpcDemo;
  let demo = createDemo('prepared');
  let activePanel = panels.some(panel => panel.id === location.hash.slice(1)) ? location.hash.slice(1) : 'equipment';
  let rows = [];
  let globals = [];
  let actionRefs = new Map();
  let selectedId = null;
  let detail = null;
  let detailOpener = null;
  let toastTimer;
  const dialog = $('#detail-dialog');
  const itemArtwork = {
    methods: {
      mist_breathing: 'assets/methods/mist-breathing-v1.png',
      iron_body: 'assets/methods/iron-body-v1.png',
      cloud_step: 'assets/methods/cloud-step-v1.png',
      gate_sense: 'assets/methods/gate-sense-v1.png',
      star_core_method: 'assets/methods/star-core-method-v1.png',
      beast_taming: 'assets/methods/beast-taming-v1.png',
      void_heart: 'assets/methods/void-heart-v1.png'
    },
    bloodlines: {
      titan_marrow: 'assets/bloodlines/titan-marrow-v1.png',
      void_symbiote: 'assets/bloodlines/void-symbiote-v1.png',
      bastion_chitin: 'assets/bloodlines/bastion-chitin-v1.png',
      phoenix_ember: 'assets/bloodlines/phoenix-ember-v1.png'
    },
    companions: {
      qin_che: 'assets/companions/qin-che-v1.png',
      zhou_yingxue: 'assets/companions/zhou-yingxue-v1.png',
      lu_guanlan: 'assets/companions/lu-guanlan-v1.png'
    }
  };
  const npcArtwork = { bloodlines: 'assets/npc/bloodline-priest-v1.png', companions: 'assets/npc/companion-guide-v1.png' };
  function rowArtwork(row) { return row?.icon ?? itemArtwork[activePanel]?.[row?.id]; }
  const rarityLabels = { poor: '粗糙', common: '普通', uncommon: '优秀', rare: '精良', epic: '史诗', legendary: '传说' };
  // Visual fixtures only: these catalogs do not define rarity in the game.
  // Keep them outside the adapter/domain and label them as examples in details.
  const previewRarities = {
    methods: { mist_breathing: 'common', iron_body: 'uncommon', cloud_step: 'uncommon', gate_sense: 'rare', beast_taming: 'rare', star_core_method: 'epic', void_heart: 'legendary' },
    pets: { contract_sprite: 'common', mist_kitten: 'uncommon', ash_hound: 'rare', mirror_moth: 'rare', starling_drone: 'epic', void_whelp: 'legendary' },
    bloodlines: { titan_marrow: 'epic', void_symbiote: 'legendary', bastion_chitin: 'epic', phoenix_ember: 'legendary' },
    companions: { qin_che: 'rare', zhou_yingxue: 'epic', lu_guanlan: 'legendary' }
  };
  function rarityFor(row) {
    if (row?.rarity) return { id: row.rarity, example: false };
    const id = row && previewRarities[activePanel]?.[row.id];
    return id ? { id, example: true } : null;
  }
  function rarityAttributes(rarity) { return rarity ? ` data-rarity="${rarity.id}"` : ''; }

  // Tasks and non-item service details retain small graphic symbols.
  const symbols = {
    methods: '<path d="M10 9h17v27H10a4 4 0 0 1-4-4V13a4 4 0 0 1 4-4Z M27 9h5v27h-5 M11 15h10 M11 20h10 M11 25h7 M6 31h21"/>',
    bloodlines: '<path d="M20 5c-2 8-12 13-12 22a12 12 0 0 0 24 0C32 18 22 13 20 5Z M15 25c-3 5 0 8 4 9"/>',
    companions: '<circle cx="20" cy="14" r="7"/><path d="M7 36v-5c0-7 6-10 13-10s13 3 13 10v5 M13 24l7 9 7-9 M11 36h18"/>',
    tasks: '<path d="M10 6h19v23a6 6 0 0 1-6 6H11a5 5 0 0 1-5-5V12a6 6 0 0 1 4-6Z M29 6h3a4 4 0 0 1 4 4v4h-7 M6 28h19v2a5 5 0 0 1-5 5 M13 14h9 M13 19h9 M13 24h5"/>',
    service: '<path d="m23 6 4 7-5 6-5-1-9 14 4 3 10-13 5 1 7-6-1-9-5 6-5-2Z"/>',
    equipment: '<path d="m10 32 7-9-4-4 15-13 5 1v5L20 27l-4-4-8 10 M9 22l10 10"/>',
    supplies: '<path d="M15 6h10v6l5 8v13H10V20l5-8Z M14 6h12 M11 23h18 M16 29h8"/>',
    pets: '<path d="M10 15 7 5l12 7 13-7-2 13c5 15-2 19-10 19S4 30 10 15Z M13 22h2 M25 22h2 M17 28l3 2 3-2"/>'
  };
  function icon(src, kind, className = 'item-icon') {
    return src ? `<img class="${className}" src="${escape(src)}" alt="" loading="lazy">`
      : `<svg class="${className} icon-symbol" viewBox="0 0 40 40" aria-hidden="true">${symbols[kind] ?? symbols.service}</svg>`;
  }
  function shortLabel(action, row) {
    return (row ? action.label.replaceAll(row.name, '').replace(/[：:·]\s*$/, '').trim() : action.label) || action.label;
  }
  function actionButton(action, row, { secondary = false, confirm = false } = {}) {
    const key = `${row?.id ?? '@service'}|${action.id}`;
    actionRefs.set(key, { action, rowId: row?.id });
    const label = `${confirm ? '确认' : ''}${shortLabel(action, row)}`;
    return `<button type="button" class="action-button${secondary ? ' secondary' : ''}${action.dangerous ? ' danger' : ''}"
      data-action="${escape(key)}" ${confirm ? 'data-confirm="true"' : ''} aria-disabled="${!action.enabled}"
      aria-label="${escape(`${label}${action.enabled ? '' : '，查看条件'}`)}" title="${escape(action.enabled ? action.description : action.reason)}">
      ${escape(label)}${action.costLabel ? `<span class="action-price">${escape(action.costLabel.replace(/^消耗\s*/, ''))}</span>` : ''}</button>`;
  }
  function renderNav() {
    $('#npc-nav').innerHTML = panels.map(panel => `<a class="npc-link" href="#${panel.id}" ${panel.id === activePanel ? 'aria-current="page"' : ''}>
      ${icon(panel.portrait ?? npcArtwork[panel.id], panel.id, 'nav-portrait')}<span><strong>${escape(panel.name)}</strong><small>${escape(panel.title)}</small></span></a>`).join('');
    const panel = panels.find(panel => panel.id === activePanel);
    const greeting = panel.id === 'equipment' ? '先挑合适的装备，再决定如何强化。' : panel.greeting;
    $('#window-title').textContent = panel.title;
    $('#npc-intro').innerHTML = `${icon(panel.portrait ?? npcArtwork[panel.id], panel.id, 'npc-portrait')}<div><h2 id="npc-name">${escape(panel.name)}</h2><p>${escape(greeting)}</p></div>`;
    $('#catalog').setAttribute('aria-label', activePanel === 'tasks' ? '任务列表' : `${panel.name}的物品网格`);
    $('#catalog-hint').textContent = activePanel === 'tasks' ? '点击任务查看详情' : '点击图标查看详情';
  }
  function serviceTitle() { return activePanel === 'equipment' ? '装备封存委托' : '恢复生命'; }
  function restoreActionFocus(key) {
    const scope = detail ? dialog : $('#catalog');
    const action = scope.querySelector(`[data-action="${CSS.escape(key)}"]`);
    const target = action?.getClientRects().length ? action : scope.querySelector('[data-more], .detail-actions button');
    target?.focus({ preventScroll: true });
  }
  function renderTask(row) {
    const progress = row.details.find(item => item.label === '当前进度')?.value;
    return `<article class="task-row${selectedId === row.id ? ' selected' : ''}">
      <button type="button" class="task-info" data-detail="${escape(row.id)}" aria-label="查看${escape(row.name)}详情" aria-haspopup="dialog">
        <span class="task-heading"><strong>${escape(row.name)}</strong><small>${escape(row.category)}</small></span>
        <span class="task-description">${escape(row.description)}</span>
        <span class="task-progress"><span class="task-status" data-status="${escape(row.status)}">${escape(row.status)}</span>${escape(progress ?? row.summary)}</span>
      </button><div class="task-actions">${row.actions.map(action => actionButton(action, row, { secondary: !action.enabled })).join('')}</div>
    </article>`;
  }
  function render() {
    const focusedKey = document.activeElement?.dataset.action;
    const scroll = $('#catalog').scrollTop;
    rows = demo.getRows(activePanel);
    if (activePanel === 'tasks') {
      const priority = { '可领取': 0, '进行中': 1, '未解锁': 2, '已领取': 3 };
      rows = [...rows].sort((a, b) => priority[a.status] - priority[b.status]);
    }
    globals = demo.getGlobalActions(activePanel);
    actionRefs = new Map();
    $('#result-count').textContent = `共 ${rows.length} 项`;
    $('#catalog').classList.toggle('task-list', activePanel === 'tasks');
    $('#catalog').innerHTML = rows.length ? rows.map(row => {
      if (activePanel === 'tasks') return renderTask(row);
      const rarity = rarityFor(row);
      return `<button type="button" class="item-tile${selectedId === row.id ? ' selected' : ''}"${rarityAttributes(rarity)} data-detail="${escape(row.id)}" aria-label="查看${escape(row.name)}详情${rarity ? `，${rarityLabels[rarity.id]}${rarity.example ? '（原型示例）' : ''}` : ''}" aria-haspopup="dialog">${icon(rowArtwork(row), activePanel)}</button>`;
    }).join('') : '<div class="empty-state">暂无条目</div>';
    $('#catalog').scrollTop = scroll;
    $('#global-actions').hidden = !globals.length;
    $('#global-actions').innerHTML = globals.length ? `<button class="action-button secondary" type="button" data-service>${serviceTitle()} ↗</button>` : '';
    if (detail) renderDetail();
    if (focusedKey) restoreActionFocus(focusedKey);
  }
  function renderDetail() {
    const row = detail.rowId ? rows.find(item => item.id === detail.rowId) : null;
    const actions = row ? row.actions : globals;
    const name = row?.name ?? serviceTitle();
    const rarity = rarityFor(row);
    const currentScroll = $('.detail-scroll')?.scrollTop ?? 0;
    const confirmation = actions.find(action => action.id === detail.confirmId);
    const common = actions.slice(0, 2);
    const extra = actions.slice(2);
    $('#detail-content').innerHTML = `<header class="detail-header">
      <span class="detail-icon"${rarityAttributes(rarity)}>${icon(rowArtwork(row), row ? activePanel : 'service')}</span><div><h2 id="detail-title">${escape(name)}</h2><p>${escape(row ? `${row.category} · ${row.status}` : panels.find(panel => panel.id === activePanel).name)}</p>${rarity ? `<p class="rarity-label"${rarityAttributes(rarity)}>${rarityLabels[rarity.id]}${rarity.example ? ' · 原型示例' : ''}</p>` : ''}</div>
      <button type="button" class="close-button" data-close aria-label="关闭详情" autofocus>×</button>
    </header><div class="detail-scroll">
      <p class="detail-description">${escape(row?.description ?? (activePanel === 'equipment' ? '选择闲置满级装备作为封存来源，再选择目标材料并启动委托。' : '在补给商处恢复当前生命。'))}</p>
      ${row ? `<dl class="detail-facts">${row.details.map(item => `<div><dt>${escape(item.label)}</dt><dd>${escape(item.value)}</dd></div>`).join('')}</dl>` : `<dl class="detail-facts">${actions.map(action => `<div><dt>${escape(shortLabel(action))}</dt><dd>${escape(action.description)}</dd></div>`).join('')}</dl>`}
      ${confirmation ? `<div class="confirmation"><strong>${escape(shortLabel(confirmation, row))}</strong><p>${escape(confirmation.description)}</p><p>确认后执行，请核对消耗与结果。</p></div>` : ''}
    </div><footer class="detail-footer">
      ${detail.message ? `<p class="action-notice ${detail.error ? 'error' : 'success'}" role="status">${escape(detail.message)}</p>` : ''}
      ${extra.length && !confirmation ? `<div id="action-menu" class="action-menu" aria-label="更多操作" ${detail.more ? '' : 'hidden'}>${extra.map(action => actionButton(action, row, { secondary: true })).join('')}</div>` : ''}
      <div class="detail-actions">${confirmation ? `<button type="button" class="action-button secondary" data-cancel-confirm>取消</button>${actionButton(confirmation, row, { confirm: true })}` : `${extra.length ? `<button type="button" class="more-button" data-more aria-expanded="${Boolean(detail.more)}" aria-controls="action-menu">更多操作 ${detail.more ? '−' : '+'}</button>` : ''}${common.map((action, i) => actionButton(action, row, { secondary: i > 0 })).join('')}`}</div>
    </footer>`;
    $('.detail-scroll').scrollTop = currentScroll;
    if (confirmation) dialog.querySelector('.confirmation').scrollIntoView({ block: 'nearest' });
  }
  function openDetail(rowId) {
    detailOpener = document.activeElement;
    selectedId = rowId;
    detail = { rowId, more: false };
    render();
    $('.detail-scroll').scrollTop = 0;
    dialog.showModal();
  }
  function showToast(message, error = false) {
    clearTimeout(toastTimer);
    $('#toast').textContent = message;
    $('#toast').classList.toggle('error', error);
    $('#toast').hidden = false;
    toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4200);
  }
  function runAction(key, confirmed) {
    const ref = actionRefs.get(key);
    if (!ref) { showToast('此操作已变化，请重新打开物品。', true); return; }
    if (detail) detail.more = false;
    if (!ref.action.enabled) {
      if (!detail) openDetail(ref.rowId);
      detail.message = ref.action.reason || ref.action.description;
      detail.error = true;
      renderDetail();
      restoreActionFocus(key);
      return;
    }
    if (ref.action.dangerous && !confirmed) {
      if (!detail) openDetail(ref.rowId);
      detail.confirmId = ref.action.id;
      detail.message = null;
      renderDetail();
      dialog.querySelector('[data-cancel-confirm]').focus({ preventScroll: true });
      return;
    }
    const result = demo.execute(ref.action);
    if (detail) {
      detail.confirmId = null;
      detail.message = result.message;
      detail.error = !result.ok;
    } else showToast(result.message, !result.ok);
    render();
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button?.dataset.action !== undefined) runAction(button.dataset.action, button.dataset.confirm === 'true');
    else if (button?.dataset.detail !== undefined) openDetail(button.dataset.detail);
    else if (button?.dataset.service !== undefined) openDetail(null);
    else if (button?.dataset.close !== undefined) dialog.close();
    else if (button?.dataset.more !== undefined) {
      detail.more = !detail.more;
      renderDetail();
      dialog.querySelector('[data-more]').focus({ preventScroll: true });
    } else if (button?.dataset.cancelConfirm !== undefined) {
      detail.confirmId = null;
      renderDetail();
      dialog.querySelector('.detail-actions button').focus({ preventScroll: true });
    } else if (detail?.more && !event.target.closest('.action-menu')) {
      detail.more = false;
      renderDetail();
    }
  });
  dialog.addEventListener('cancel', event => {
    if (detail?.more) {
      event.preventDefault();
      detail.more = false;
      renderDetail();
      dialog.querySelector('[data-more]').focus({ preventScroll: true });
    }
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    const rowId = detail?.rowId;
    detail = null;
    const fallback = rowId ? $('#catalog').querySelector(`[data-detail="${CSS.escape(rowId)}"]`) : $('#global-actions button');
    (detailOpener?.isConnected ? detailOpener : fallback)?.focus({ preventScroll: true });
    detailOpener = null;
  });
  $('#viewport').addEventListener('change', event => {
    const width = event.target.value === 'auto' ? '680px' : `${event.target.value}px`;
    document.documentElement.style.setProperty('--preview-width', width);
    document.documentElement.style.setProperty('--detail-width', event.target.value === 'auto' ? '480px' : `calc(${width} - 24px)`);
  });
  function reset() {
    if (dialog.open) dialog.close();
    detail = null;
    selectedId = null;
    demo = createDemo($('#preset').value);
    render();
    showToast('演示进度已重置。');
  }
  $('#preset').addEventListener('change', reset);
  $('#reset').addEventListener('click', reset);
  window.addEventListener('hashchange', () => {
    const next = location.hash.slice(1);
    if (!panels.some(panel => panel.id === next) || next === activePanel) return;
    if (dialog.open) dialog.close();
    detail = null;
    selectedId = null;
    activePanel = next;
    $('#catalog').scrollTop = 0;
    renderNav();
    render();
  });
  renderNav();
  render();
})();
