const resources = '../../cocos/assets/resources/';

export const services = Object.freeze([
  { id: 'equipment', name: '军需官', purpose: '装备与强化', icon: 'sword', art: 'equipment-quartermaster', note: '挑选装备，强化你的作战配置。' },
  { id: 'supplies', name: '补给商', purpose: '药品与道具', icon: 'bottle', art: 'supply-trader', note: '补足药品，准备下一次副本探索。' },
  { id: 'pets', name: '灵宠师', purpose: '灵宠培养', icon: 'beast', art: 'pet-keeper', note: '查看灵宠和培养选项。' },
  { id: 'methods', name: '修行导师', purpose: '功法修行', icon: 'scroll', art: 'method-master', note: '学习功法，查看已经掌握的招式。' },
  { id: 'bloodlines', name: '血脉祭司', purpose: '血统觉醒', icon: 'drop', art: 'bloodline-priest', note: '查看血统与觉醒条件。' },
  { id: 'companions', name: '同行引路人', purpose: '同伴招募', icon: 'compass', art: 'companion-guide', note: '结识同伴，安排下一次同行。' },
  { id: 'tasks', name: '任务使者', purpose: '任务与奖励', icon: 'ledger', art: 'main-god-projection', note: '查看主线任务，领取已完成的奖励。' },
]);

const paths = {
  sword: '<path d="m15 3 6 0 0 6-10 10-6-6 10-10Z M4 14l6 6 M7 17l-4 4 M15 3l6 6"/>',
  bottle: '<path d="M9 3h6v4l4 5v8H5v-8l4-5V3Z M9 6h6 M5 13h14 M10 16h4"/>',
  beast: '<path d="m4 5 4 3 4-2 4 2 4-3-1 10-7 6-7-6L4 5Z M8 12h1 M15 12h1 M10 16h4"/>',
  scroll: '<path d="M7 4h13v16H7 M7 4v16H4V4h3Z M10 8h7 M10 12h7 M10 16h4"/>',
  drop: '<path d="M12 3C9 8 5 11 5 15a7 7 0 0 0 14 0c0-4-4-7-7-12Z M8 15a4 4 0 0 0 4 4"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6 6-2Z M12 1v2 M12 21v2 M1 12h2 M21 12h2"/>',
  ledger: '<path d="M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3V4Z M12 6v16 M6 9h3 M15 9h3 M6 13h3 M15 13h3"/>',
  bag: '<path d="M4 8h16v13H4V8Z M8 8V3h8v5 M4 12h16 M10 12v4h4v-4"/>',
  user: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-3a8 8 0 0 1 16 0v3H4Z"/>',
  menu: '<path d="M4 6h16 M4 12h16 M4 18h16"/>',
  arrow: '<path d="M4 12h15 M13 5l7 7-7 7"/>',
  close: '<path d="m5 5 14 14 M19 5 5 19"/>',
  star: '<path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z"/>',
  heart: '<path d="M12 21 3 12a5 5 0 0 1 9-6 5 5 0 0 1 9 6l-9 9Z"/>',
  gate: '<path d="M5 21V3h14v18 M8 21V6h8v15 M3 21h18 M12 10v6 M9 13h6"/>',
  dice: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 7h.1 M17 7h.1 M12 12h.1 M7 17h.1 M17 17h.1"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
};

export function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.compass}</svg>`;
}

function service(id, options = {}) {
  const person = services.find(entry => entry.id === id);
  if (!person) throw new Error(`Unknown prototype NPC: ${id}`);
  const art = options.art ?? 'world';
  const src = resources + (art === 'portrait' ? `npc/${person.art}-v1.png` : `npc/${person.art}-world-v1.png`);
  return `<button type="button" class="service service-${id} ${options.className ?? ''}" data-action="service" data-service="${id}" aria-label="${person.name} · ${person.purpose}">
    ${art === 'none' ? '' : `<img class="svc-art" src="${src}" alt="" loading="lazy" draggable="false">`}
    <span class="svc-copy"><span class="svc-title">${person.name}</span><span class="svc-purpose">${person.purpose}</span></span>
    <span class="svc-icon">${icon(person.icon)}</span></button>`;
}

function header(title = '主神空间', options = {}) {
  return `<header class="scene-header ${options.className ?? ''}">
    <button type="button" class="avatar-button" data-action="character" aria-label="角色信息"><img src="${resources}character/reincarnator-v1.png" alt=""/><span>角色</span></button>
    <div class="scene-identity"><span class="scene-place">${title}</span><span class="scene-health">生命 <b>102</b><span>/ 102</span></span><span class="hp-track" aria-hidden="true"><i></i></span></div>
    <button type="button" class="scene-menu" data-action="menu" aria-label="打开菜单">${icon('menu')}</button>
  </header>`;
}

function portal(options = {}) {
  return `<button type="button" class="portal ${options.className ?? ''}" data-action="portal" aria-label="副本传送门 · 选择副本">
    <span class="portal-symbol" aria-hidden="true"><i></i><i></i><i></i><b></b></span>
    <span class="portal-copy"><span class="portal-eyebrow">${options.eyebrow ?? '下一次轮回'}</span><strong>${options.title ?? '副本传送门'}</strong><span class="portal-hint">${options.hint ?? '妖塔一层 · 标准探索'}</span></span>
    <span class="portal-arrow">${icon('arrow')}</span></button>`;
}

function utility(action, label, glyph = action, className = '') {
  return `<button type="button" class="scene-utility ${className}" data-action="${action}" aria-label="${label}">${icon(glyph)}<span>${label}</span></button>`;
}

function backdrop(kind = 'sanctuary', className = '') {
  if (!['sanctuary', 'camp', 'void'].includes(kind)) throw new Error(`Unknown backdrop ${kind}`);
  return `<img class="scene-background ${className}" src="assets/${kind}-v1.png" alt="" draggable="false">`;
}

function player(className = '') {
  return `<button class="scene-player ${className}" type="button" data-action="character" aria-label="轮回者 · 角色信息"><span class="walker-art" aria-hidden="true"></span><span class="player-name">轮回者</span></button>`;
}

function resourcesLine(className = '') {
  return `<div class="scene-resources ${className}" aria-label="资源"><span>奖励点 <b>1,280</b></span><span>灵韵 <b>36</b></span></div>`;
}

export const helpers = Object.freeze({ service, header, portal, utility, backdrop, player, resources: resourcesLine, icon, services });
