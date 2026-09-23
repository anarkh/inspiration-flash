/* Interaction layer for the standalone NPC prototype. No game storage is used. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  if (!window.NpcDemo) {
    $('#catalog').innerHTML = '<div class="empty-state"><strong>演示数据未加载</strong>请在本目录运行 node build-adapter.mjs 后刷新。</div>';
    return;
  }

  const { panels, createDemo } = window.NpcDemo;
  let demo = createDemo('prepared');
  let activePanel = panels.some(panel => panel.id === location.hash.slice(1)) ? location.hash.slice(1) : 'equipment';
  let rows = [];
  let globals = [];
  let actionRefs = new Map();
  let expanded = new Set();
  let detail = null;
  let detailOpener = null;
  let toastTimer;
  const dialog = $('#detail-dialog');

  function portrait(src, name, className) {
    return src ? `<img class="${className}" src="${escape(src)}" alt="" loading="lazy">`
      : `<span class="${className} initial" aria-hidden="true">${escape(name.slice(0, 1))}</span>`;
  }

  function shortLabel(action, row) {
    const label = row ? action.label.replaceAll(row.name, '').replace(/[：:·]\s*$/, '').trim() : action.label;
    return label.replace('设为出战灵宠', '出战').replace('设为出战同伴', '出战').replace('设为常用', '常用') || action.label;
  }

  function actionButton(action, row, options = {}) {
    const key = `${row?.id ?? '@service'}|${action.id}`;
    actionRefs.set(key, { action, rowId: row?.id });
    const label = options.confirm ? `确认${shortLabel(action, row)}` : shortLabel(action, row);
    return `<button type="button" class="action-button${options.secondary ? ' secondary' : ''}${action.dangerous ? ' danger' : ''}"
      data-action="${escape(key)}" ${options.confirm ? 'data-confirm="true"' : ''}
      aria-disabled="${!action.enabled}" aria-label="${escape(`${row ? `${row.name}：` : ''}${label}${action.enabled ? '' : '，查看条件'}`)}"
      title="${escape(action.enabled ? action.description : action.reason)}">
      ${escape(label)}${action.costLabel ? `<span class="action-price">${escape(action.costLabel.replace(/^消耗\s*/, ''))}</span>` : ''}
    </button>`;
  }

  function renderNav() {
    $('#npc-nav').innerHTML = panels.map(panel => `<a class="npc-link" href="#${panel.id}" ${panel.id === activePanel ? 'aria-current="page"' : ''}>
      ${portrait(panel.portrait, panel.name, 'nav-portrait')}<span><strong>${escape(panel.name)}</strong><small>${escape(panel.title)}</small></span>
    </a>`).join('');
    const panel = panels.find(panel => panel.id === activePanel);
    $('#window-title').textContent = panel.title;
    $('#npc-intro').innerHTML = `${portrait(panel.portrait, panel.name, 'npc-portrait')}<div><h2 id="npc-name">${escape(panel.name)}</h2><p>${escape(panel.greeting)}</p></div>`;
    $('#catalog').setAttribute('aria-label', `${panel.name}的物品与服务列表`);
  }

  function renderRows() {
    const scroll = $('#catalog').scrollTop;
    $('#result-count').textContent = `共 ${rows.length} 项`;
    $('#catalog').innerHTML = rows.length ? rows.map(row => {
      const commonCount = activePanel === 'equipment' ? 2 : 3;
      const common = row.actions.slice(0, commonCount);
      const extra = row.actions.slice(commonCount);
      const open = expanded.has(row.id);
      return `<article class="item-row" data-row="${escape(row.id)}">
        <button type="button" class="row-info" data-detail="${escape(row.id)}" aria-label="查看${escape(row.name)}详情">
          ${portrait(row.icon, row.name, 'item-icon')}<span class="row-copy">
            <span class="item-heading"><span class="item-name">${escape(row.name)}</span><span class="item-category">${escape(row.category)}</span></span>
            <span class="item-status">${escape(row.status)}</span><span class="item-description">${escape(row.description)}</span>
          </span>
        </button>
        <div class="row-actions">${common.map((action, index) => actionButton(action, row, { secondary: index > 0 })).join('')}
          ${extra.length ? `<button type="button" class="more-button" data-more="${escape(row.id)}" aria-expanded="${open}" aria-controls="extra-${escape(row.id)}">${open ? '收起' : '更多操作'} <span aria-hidden="true">${open ? '−' : '+'}</span></button>` : ''}
        </div>
        ${extra.length ? `<div class="extra-actions" id="extra-${escape(row.id)}" ${open ? '' : 'hidden'}><span class="extra-label">${escape(row.name)} · 强化与委托</span>${extra.map(action => actionButton(action, row, { secondary: true })).join('')}</div>` : ''}
      </article>`;
    }).join('') : '<div class="empty-state"><strong>暂无条目</strong></div>';
    $('#catalog').scrollTop = scroll;
  }

  function serviceTitle() {
    return activePanel === 'equipment' ? '装备封存委托' : '恢复生命';
  }

  function renderGlobals() {
    const footer = $('#global-actions');
    footer.hidden = globals.length === 0;
    footer.innerHTML = globals.length ? `<span class="global-label">${activePanel === 'equipment' ? '满级闲置装备可用于委托' : '出发前也可以在这里整备'}</span><button class="action-button secondary" type="button" data-service>${serviceTitle()} ↗</button>` : '';
  }

  function render() {
    const focusedKey = document.activeElement?.dataset.action;
    rows = demo.getRows(activePanel);
    if (activePanel === 'tasks') {
      const priority = { '可领取': 0, '进行中': 1, '未解锁': 2, '已领取': 3 };
      rows = [...rows].sort((left, right) => priority[left.status] - priority[right.status]);
    }
    globals = demo.getGlobalActions(activePanel);
    actionRefs = new Map();
    renderRows();
    renderGlobals();
    if (detail) renderDetail();
    if (focusedKey) {
      const scope = dialog.open ? dialog : $('#catalog');
      scope.querySelector(`[data-action="${CSS.escape(focusedKey)}"]`)?.focus({ preventScroll: true });
    }
  }

  function renderDetail() {
    const row = detail.rowId ? rows.find(row => row.id === detail.rowId) : null;
    // Item details are informational; a row action can reveal only its own condition or confirmation.
    const actions = row ? row.actions.filter(action => action.id === detail.actionId) : globals;
    const name = row?.name ?? serviceTitle();
    const currentScroll = $('.detail-scroll')?.scrollTop ?? 0;
    $('#detail-content').innerHTML = `<header class="detail-header">
      ${portrait(row?.icon, name, 'item-icon')}<div><h2 id="detail-title">${escape(name)}</h2><p>${escape(row ? `${row.category} · ${row.status}` : panels.find(panel => panel.id === activePanel).name)}</p></div>
      <button type="button" class="close-button" data-close aria-label="关闭详情" autofocus>×</button>
    </header>${detail.message ? `<p class="detail-feedback${detail.error ? ' error' : ''}" role="status">${escape(detail.message)}</p>` : ''}<div class="detail-scroll">
      <p class="detail-description">${escape(row?.description ?? (activePanel === 'equipment' ? '先在装备条目中选择用于委托的装备，再设置目标材料并启动。' : '在补给商处恢复当前生命。'))}</p>
      ${row ? `<dl class="detail-facts">${row.details.map(item => `<div><dt>${escape(item.label)}</dt><dd>${escape(item.value)}</dd></div>`).join('')}</dl>` : ''}
      ${actions.map(action => `<div class="detail-action${detail.actionId === action.id ? ' highlight' : ''}" data-detail-action="${escape(action.id)}">
        ${action.enabled ? actionButton(action, row, { confirm: detail.confirm && detail.actionId === action.id }) : `<strong>${escape(shortLabel(action, row))}</strong>`}
        <p>${escape(action.description)}</p>${!action.enabled && action.reason ? `<p class="condition">${escape(action.reason)}</p>` : ''}
        ${detail.confirm && detail.actionId === action.id ? '<p class="condition">请核对上面的消耗与结果，再点击确认。</p>' : ''}
      </div>`).join('')}
      <p class="detail-note">关闭详情后，列表会保留当前浏览位置。</p>
    </div>`;
    $('.detail-scroll').scrollTop = currentScroll;
  }

  function openDetail(rowId, actionId, confirm = false) {
    if (!dialog.open) detailOpener = document.activeElement;
    detail = { rowId, actionId, confirm };
    renderDetail();
    if (!dialog.open) dialog.showModal();
    if (actionId) {
      dialog.querySelector(`[data-detail-action="${CSS.escape(actionId)}"]`)?.scrollIntoView({ block: 'nearest' });
    } else {
      $('.detail-scroll').scrollTop = 0;
    }
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
    if (!ref) {
      showToast('此操作已变化，请重新打开条目。', true);
      return;
    }
    if (!ref.action.enabled || (ref.action.dangerous && !confirmed)) {
      openDetail(ref.rowId, ref.action.id, ref.action.enabled && ref.action.dangerous);
      return;
    }
    const result = demo.execute(ref.action);
    if (detail) {
      detail.confirm = false;
      detail.actionId = null;
      detail.message = result.message;
      detail.error = !result.ok;
    }
    render();
    showToast(result.message, !result.ok);
    if (result.ok && ref.rowId) $('#catalog').querySelector(`[data-row="${CSS.escape(ref.rowId)}"]`)?.classList.add('changed');
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.action !== undefined) runAction(button.dataset.action, button.dataset.confirm === 'true');
    else if (button.dataset.detail !== undefined) openDetail(button.dataset.detail);
    else if (button.dataset.service !== undefined) openDetail(null);
    else if (button.dataset.close !== undefined) dialog.close();
    else if (button.dataset.more !== undefined) {
      const id = button.dataset.more;
      expanded.has(id) ? expanded.delete(id) : expanded.add(id);
      renderRows();
      $('#catalog').querySelector(`[data-more="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
    }
  });

  // Native dialog supplies focus trapping and Escape; backdrop clicks also close it.
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
    document.documentElement.style.setProperty('--preview-width', event.target.value === 'auto' ? '740px' : `${event.target.value}px`);
  });
  function reset() {
    if (dialog.open) dialog.close();
    detail = null;
    demo = createDemo($('#preset').value);
    expanded.clear();
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
    activePanel = next;
    $('#catalog').scrollTop = 0;
    expanded.clear();
    renderNav();
    render();
  });
  renderNav();
  render();
})();
