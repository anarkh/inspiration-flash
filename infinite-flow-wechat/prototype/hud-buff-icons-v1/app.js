const relics = [
  { id: 'mist_edge', frame: 'assault', name: '雾锋', description: '攻击 +6，术法 +4。', summary: '攻击 / 术法', stats: [['攻击', '+6'], ['术法', '+4']] },
  { id: 'focus_prism', frame: 'assault', name: '聚念棱镜', description: '每场战斗开始时战意 +1。', summary: '开场战意' },
  { id: 'hunter_clock', frame: 'assault', name: '猎时钟', description: '战斗奖励点 +20%。', summary: '战斗收益' },
  { id: 'bone_shell', frame: 'bulwark', name: '骨壳', description: '防御 +4。', summary: '防御', stats: [['防御', '+4']] },
  { id: 'mending_thread', frame: 'bulwark', name: '缝生线', description: '选择后，后续每次领取奖励节点回复 12 生命。', summary: '奖励节点回复' },
  { id: 'iron_echo', frame: 'bulwark', name: '铁回响', description: '陷阱伤害 -25%。', summary: '陷阱减伤' },
  { id: 'rift_step', frame: 'wayfinder', name: '裂隙步', description: '速度 +4，陷阱判定 +4。', summary: '速度 / 判定', stats: [['速度', '+4'], ['陷阱判定', '+4']] },
  { id: 'gate_anchor', frame: 'wayfinder', name: '门锚', description: '强闯传送反噬 -35%。', summary: '反噬减免' },
  { id: 'lucky_map', frame: 'wayfinder', name: '幸运地图', description: '奖励节点奖励点 +20%。', summary: '节点收益' },
];
const frames = [
  { id: 'assault', name: '强攻', subtitle: '锋芒与战意' },
  { id: 'bulwark', name: '守御', subtitle: '守护与续生' },
  { id: 'wayfinder', name: '寻路', subtitle: '穿行与机缘' },
];
const $ = selector => document.querySelector(selector);
const popover = $('#relic-popover');
const strip = $('#buff-strip');
const stage = $('#game-stage');
let opener = null;
let currentRelic = null;
let empty = false;

function imageMarkup(relic) {
  return `<img class="relic-image" src="assets/${relic.id}.png" alt="${relic.name}专属图标" width="64" height="64">`;
}

function getOwnedRelics() {
  return empty ? [] : relics.filter(relic => relic.frame === 'assault');
}

function renderBuffs() {
  const owned = getOwnedRelics();
  strip.hidden = owned.length === 0;
  strip.classList.toggle('empty', owned.length === 0);
  strip.setAttribute('aria-expanded', 'false');
  strip.setAttribute('aria-label', `本局回响，已获得 ${owned.length} 项${owned.length ? `：${owned.map(relic => relic.name).join('、')}` : ''}。点击查看全部效果`);
  strip.innerHTML = owned.map(relic => `<span class="buff-slot" aria-hidden="true">${imageMarkup(relic)}</span>`).join('');
  observeImages(strip);
}

$('#icon-atlas').innerHTML = frames.map(frame => `<section class="atlas-group" data-frame="${frame.id}" aria-label="${frame.name}流派"><h3 class="atlas-group-title">${frame.name} <span>· ${frame.subtitle}</span></h3><div class="atlas-items">${relics.filter(relic => relic.frame === frame.id).map(relic => `<button type="button" class="atlas-item" data-relic="${relic.id}" aria-label="预览${relic.name}，${relic.description}" aria-haspopup="dialog" aria-expanded="false" aria-controls="relic-popover">${imageMarkup(relic)}<span><span class="atlas-item-name">${relic.name}</span><small class="atlas-item-type">${relic.summary}</small></span></button>`).join('')}</div></section>`).join('');

function observeImages(root = document) {
  for (const image of root.querySelectorAll('.relic-image')) {
    image.addEventListener('load', () => image.classList.add('ready'), { once: true });
    image.addEventListener('error', () => {
      image.classList.remove('ready');
      // Preserve the touch target and readable details while an illustration is unavailable.
      image.dataset.unavailable = 'true';
    }, { once: true });
    if (image.complete && image.naturalWidth > 0) image.classList.add('ready');
  }
}

function setExpanded(id) {
  strip.setAttribute('aria-expanded', String(id === 'owned'));
  for (const button of document.querySelectorAll('button.atlas-item[data-relic]')) button.setAttribute('aria-expanded', String(button.dataset.relic === id));
}

function closePopover({ restoreFocus = true } = {}) {
  if (popover.hidden) return;
  popover.hidden = true;
  currentRelic = null;
  setExpanded(null);
  if (restoreFocus && opener?.isConnected) opener.focus({ preventScroll: true });
  opener = null;
}

function positionPopover(trigger) {
  const stageBounds = stage.getBoundingClientRect();
  const triggerBounds = trigger.closest('.game-stage')
    ? trigger.getBoundingClientRect()
    : (strip.hidden ? $('.health-track') : strip).getBoundingClientRect();
  const anchor = triggerBounds.left - stageBounds.left + (trigger.closest('.game-stage') ? triggerBounds.width / 2 : 12);
  const left = Math.max(12, Math.min(anchor - 24, stageBounds.width - 276));
  popover.style.left = `${left}px`;
  popover.style.top = `${Math.round(triggerBounds.bottom - stageBounds.top + 5)}px`;
  $('.popover-arrow').style.left = `${Math.max(12, Math.min(anchor - left - 5, 243))}px`;
}

function showOwnedRelics({ focusClose = true } = {}) {
  if (currentRelic === 'owned' && opener === strip && !popover.hidden) {
    closePopover();
    return;
  }
  const owned = getOwnedRelics();
  opener = strip;
  currentRelic = 'owned';
  $('#popover-icon').hidden = true;
  $('#popover-category').textContent = `已获得 · ${owned.length} 项`;
  $('#popover-title').textContent = '本局回响';
  const effect = $('#popover-effect');
  effect.replaceChildren();
  effect.classList.add('relic-list');
  effect.setAttribute('role', 'list');
  for (const relic of owned) {
    const item = document.createElement('div');
    item.className = 'relic-list-item';
    item.setAttribute('role', 'listitem');
    const icon = document.createElement('img');
    icon.className = 'relic-image';
    icon.src = `assets/${relic.id}.png`;
    icon.alt = `${relic.name}专属图标`;
    icon.width = 30;
    icon.height = 30;
    const copy = document.createElement('div');
    copy.className = 'relic-list-copy';
    const name = document.createElement('h3');
    name.textContent = relic.name;
    const description = document.createElement('p');
    description.textContent = relic.description;
    copy.append(name, description);
    item.append(icon, copy);
    effect.append(item);
  }
  observeImages(effect);
  $('#popover-lifetime').textContent = '自动生效 · 仅本局有效';
  setExpanded('owned');
  popover.hidden = false;
  positionPopover(strip);
  $('#interaction-status').textContent = `已展开本局 ${owned.length} 项回响；再次点击回响区域、点外部、关闭或按 Esc 收起。`;
  if (focusClose) $('#close-popover').focus({ preventScroll: true });
}

function showRelic(id, trigger, { focusClose = true } = {}) {
  const relic = relics.find(item => item.id === id);
  if (!relic) throw new Error(`Unknown prototype relic: ${id}`);
  if (currentRelic === id && opener === trigger && !popover.hidden) {
    closePopover();
    return;
  }
  opener = trigger;
  currentRelic = id;
  const icon = $('#popover-icon');
  icon.hidden = false;
  icon.classList.remove('ready');
  icon.src = `assets/${id}.png`;
  icon.alt = `${relic.name}专属图标`;
  if (icon.complete && icon.naturalWidth > 0) icon.classList.add('ready');
  icon.onload = () => icon.classList.add('ready');
  $('#popover-category').textContent = `回响遗物 · ${frames.find(frame => frame.id === relic.frame).name}`;
  $('#popover-title').textContent = relic.name;
  const effect = $('#popover-effect');
  effect.classList.remove('relic-list');
  effect.removeAttribute('role');
  effect.replaceChildren();
  if (relic.stats) {
    const group = document.createElement('div');
    group.className = 'effect-stats';
    group.setAttribute('aria-label', relic.description);
    for (const [label, value] of relic.stats) {
      const stat = document.createElement('div');
      stat.className = 'effect-stat';
      const labelNode = document.createElement('span');
      const valueNode = document.createElement('strong');
      labelNode.textContent = label;
      valueNode.textContent = value;
      stat.append(labelNode, valueNode);
      group.append(stat);
    }
    effect.append(group);
  } else effect.textContent = relic.description;
  $('#popover-lifetime').textContent = '自动生效 · 仅本局有效';
  setExpanded(id);
  popover.hidden = false;
  positionPopover(trigger);
  $('#interaction-status').textContent = `已展开「${relic.name}」；点外部、关闭或按 Esc 收起。`;
  if (focusClose) $('#close-popover').focus({ preventScroll: true });
  const stageBounds = stage.getBoundingClientRect();
  if (!trigger.closest('.game-stage') && (stageBounds.top < -80 || stageBounds.top > window.innerHeight - 300)) {
    stage.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
}

function showResource(kind, trigger) {
  opener = trigger;
  currentRelic = null;
  setExpanded(null);
  $('#popover-icon').hidden = true;
  $('#popover-category').textContent = '角色资源';
  $('#popover-title').textContent = kind === 'reward' ? '奖励点' : '灵蕴';
  const effect = $('#popover-effect');
  effect.classList.remove('relic-list');
  effect.removeAttribute('role');
  effect.textContent = kind === 'reward' ? '当前持有 1155 奖励点。' : '当前持有 1 灵蕴。';
  $('#popover-lifetime').textContent = '显示当前余额';
  popover.hidden = false;
  positionPopover(trigger);
  $('#interaction-status').textContent = `正在查看${kind === 'reward' ? '奖励点' : '灵蕴'}余额说明。`;
  $('#close-popover').focus({ preventScroll: true });
}

document.addEventListener('click', event => {
  if (event.target.closest('#buff-strip')) {
    showOwnedRelics();
    return;
  }
  const relicButton = event.target.closest('button.atlas-item[data-relic]');
  if (relicButton) {
    showRelic(relicButton.dataset.relic, relicButton);
    return;
  }
  const resourceButton = event.target.closest('[data-resource]');
  if (resourceButton) {
    showResource(resourceButton.dataset.resource, resourceButton);
    return;
  }
  if (!popover.hidden && !popover.contains(event.target)) closePopover({ restoreFocus: false });
  const interfaceButton = event.target.closest('[data-interface]');
  if (interfaceButton) $('#interaction-status').textContent = `「${interfaceButton.dataset.interface}」保持原有入口位置；本原型演示回响与资源查看。`;
});

$('#close-popover').addEventListener('click', () => closePopover());
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !popover.hidden) {
    event.preventDefault();
    closePopover();
  }
});

for (const button of document.querySelectorAll('[data-size]')) {
  button.addEventListener('click', () => {
    document.documentElement.style.setProperty('--stage-width', `${button.dataset.size}px`);
    for (const option of document.querySelectorAll('[data-size]')) option.setAttribute('aria-pressed', String(option === button));
    closePopover({ restoreFocus: false });
    $('#interaction-status').textContent = `已切换至 ${button.dataset.size}px 预览。点击回响区域查看本局列表。`;
  });
}

$('#empty-toggle').addEventListener('click', () => {
  empty = !empty;
  closePopover({ restoreFocus: false });
  renderBuffs();
  $('#empty-toggle').textContent = empty ? '恢复三枚回响' : '查看未获得状态';
  $('#empty-toggle').setAttribute('aria-pressed', String(empty));
  $('#interaction-status').textContent = empty ? '尚未获得回响时不显示图标，也不出现空槽。' : '已恢复强攻流派的三枚回响。';
});

window.addEventListener('resize', () => {
  if (!popover.hidden && opener) positionPopover(opener);
});

renderBuffs();
observeImages();
const initialRelic = new URLSearchParams(location.search).get('detail');
if (initialRelic === 'owned') {
  showOwnedRelics({ focusClose: false });
} else if (initialRelic && relics.some(relic => relic.id === initialRelic)) {
  const button = document.querySelector(`.atlas-item[data-relic="${initialRelic}"]`);
  showRelic(initialRelic, button, { focusClose: false });
}
