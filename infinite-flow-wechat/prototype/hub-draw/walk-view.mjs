import { services, icon } from './helpers.mjs';
import { WORLD, depthIndex } from './walk-world.mjs';

const resources = '../../cocos/assets/resources/';
const worldWidth = WORLD.width;
const worldHeight = WORLD.height;

// Original PNG dimensions and visible alpha >= 32 bounds. Fit the painted
// object to its existing size while keeping its base on the same world foot.
const courtyardPropSprites = {
  pillar: { width: 870, height: 1808, bounds: [22, 93, 866, 1795] },
  crate: { width: 1457, height: 1080, bounds: [143, 272, 1352, 931] },
  lamp: { width: 930, height: 1691, bounds: [163, 69, 770, 1633] },
  altar: { width: 1500, height: 1049, bounds: [42, 61, 1459, 980] },
};

const npcSizes = {
  equipment: { height: 190, trim: 7 },
  supplies: { height: 180, trim: 5 },
  pets: { height: 184, trim: 5 },
  methods: { height: 190, trim: 3 },
  bloodlines: { height: 187, trim: 6 },
  companions: { height: 188, trim: 7 },
  tasks: { height: 194, trim: 6 },
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function actorAttributes(entity) {
  return `data-entity="${escapeHtml(entity.id)}" data-foot-x="${entity.x}" data-foot-y="${entity.y}" style="left:${entity.x}px;top:${entity.y}px;z-index:${depthIndex(entity.y)}"`;
}

function renderNpc(target) {
  const person = services.find(entry => entry.id === (target.service ?? target.id));
  if (!person) throw new Error(`Unknown walking scene NPC: ${target.service ?? target.id}`);
  const size = npcSizes[person.id];
  return `<button type="button" class="walk-actor walk-npc walk-npc-${person.id}" ${actorAttributes(target)} data-world-target="${escapeHtml(target.id)}" data-service="${person.id}" aria-label="前往${person.name} · ${person.purpose}">
    <span class="walk-actor-shadow" aria-hidden="true"></span>
    <img class="walk-npc-art" src="${resources}npc/${person.art}-world-v1.png" alt="" draggable="false" style="--npc-height:${size.height}px;--npc-foot-trim:${size.trim}px">
    <span class="walk-npc-copy"><span class="walk-npc-name">${person.name}</span><span class="walk-npc-purpose">${person.purpose}</span></span>
  </button>`;
}

function renderPortal(target) {
  return `<button type="button" class="walk-actor walk-portal" ${actorAttributes(target)} data-world-target="${escapeHtml(target.id)}" aria-label="前往副本传送门">
    <span class="walk-actor-shadow" aria-hidden="true"></span>
    <span class="walk-gate-base" aria-hidden="true"></span>
    <span class="walk-gate-frame" aria-hidden="true"><i class="walk-gate-core"></i><i class="walk-gate-rune rune-one"></i><i class="walk-gate-rune rune-two"></i><i class="walk-gate-keystone"></i></span>
    <span class="walk-gate-copy"><strong>副本传送门</strong><span>妖塔一层 · 标准探索</span></span>
  </button>`;
}

function renderProp(prop, styleId) {
  const shapes = {
    pillar: '<i class="walk-pillar-cap"></i><i class="walk-pillar-shaft"></i><i class="walk-pillar-foot"></i>',
    crate: '<i class="walk-crate-top"></i><i class="walk-crate-front"></i><i class="walk-crate-side"></i>',
    lamp: '<i class="walk-lamp-foot"></i><i class="walk-lamp-stem"></i><i class="walk-lamp-bowl"></i><i class="walk-lamp-flame"></i>',
    altar: '<i class="walk-altar-slab"></i><i class="walk-altar-plinth"></i><i class="walk-altar-light"></i>',
  };
  if (!shapes[prop.kind]) throw new Error(`Unknown walking scene prop: ${prop.kind}`);
  const sprite = styleId === '10' ? courtyardPropSprites[prop.kind] : undefined;
  if (sprite) {
    const [left, top, right, bottom] = sprite.bounds;
    const scale = Math.min(prop.width / (right - left), prop.height / (bottom - top));
    const imageLeft = (prop.width - (right - left) * scale) / 2 - left * scale;
    const imageBottom = -(sprite.height - bottom) * scale;
    return `<div class="walk-actor walk-prop walk-prop-${prop.kind}" ${actorAttributes(prop)} aria-hidden="true"><span class="walk-prop-shadow"></span><span class="walk-prop-art" style="--prop-width:${prop.width}px;--prop-height:${prop.height}px;--prop-sprite-width:${sprite.width * scale}px;--prop-sprite-height:${sprite.height * scale}px;--prop-sprite-left:${imageLeft}px;--prop-sprite-bottom:${imageBottom}px"><img class="walk-prop-sprite" src="assets/courtyard-props/${prop.kind}-v1.png" width="${sprite.width}" height="${sprite.height}" alt="" draggable="false"></span></div>`;
  }
  return `<div class="walk-actor walk-prop walk-prop-${prop.kind}" ${actorAttributes(prop)} aria-hidden="true"><span class="walk-prop-shadow"></span><span class="walk-prop-art" style="--prop-width:${prop.width}px;--prop-height:${prop.height}px">${shapes[prop.kind]}</span></div>`;
}

function renderPlayer(spawn) {
  return `<div class="walk-actor walk-player" data-player data-foot-x="${spawn.x}" data-foot-y="${spawn.y}" style="left:${spawn.x}px;top:${spawn.y}px;z-index:${depthIndex(spawn.y)}" aria-label="轮回者">
    <span class="walk-player-shadow" data-player-shadow aria-hidden="true"></span>
    <span class="walk-player-sprite" data-player-sprite aria-hidden="true"></span>
    <span class="walk-player-name">轮回者</span>
  </div>`;
}

function renderMinimap(layout) {
  const dots = layout.targets.map(target => {
    const person = services.find(entry => entry.id === (target.service ?? target.id));
    const name = target.kind === 'portal' ? '副本传送门' : person?.name ?? target.id;
    return `<i class="walk-mini-target walk-mini-${target.kind}" style="left:${target.x / worldWidth * 100}%;top:${target.y / worldHeight * 100}%" title="${escapeHtml(name)}"></i>`;
  }).join('');
  return `<div class="walk-map-wrap" aria-label="主神空间小地图"><div class="walk-mini-map" data-mini-map aria-hidden="true"><div class="walk-mini-lane"></div>${dots}<b class="walk-mini-player" data-mini-player style="left:${layout.spawn.x / worldWidth * 100}%;top:${layout.spawn.y / worldHeight * 100}%"></b></div></div>`;
}

function renderHud(layout) {
  return `<header class="walk-hud">
    <div class="walk-role-status"><button type="button" class="walk-avatar" data-action="character" aria-label="角色信息"><img src="${resources}character/reincarnator-v1.png" alt="" draggable="false"><span>角色</span></button><div class="walk-vitals"><div><strong>轮回者</strong><span>Lv. 1</span></div><span class="walk-health-label">生命 <b>102 / 102</b></span><i class="walk-health-track" aria-hidden="true"></i><p><span>奖励点<b>1,280</b></span><span>灵韵<b>36</b></span></p></div></div>
    <div class="walk-hud-tools"><button type="button" data-action="inventory" aria-label="打开背包">${icon('bag')}<span>背包</span></button><button type="button" data-action="menu" aria-label="打开菜单">${icon('menu')}<span>菜单</span></button></div>
  </header>
  ${renderMinimap(layout)}
  <div class="walk-joystick" data-joystick aria-label="移动摇杆" role="group"><i class="walk-joystick-cross" aria-hidden="true"></i><span data-stick aria-hidden="true"></span></div>
  <p class="walk-tutorial">触屏摇杆 移动 <span>· 点击地面或人物前往</span><br><span>靠近后点击交谈</span></p>
  <div class="walk-actions"><button type="button" class="walk-interact" data-interact data-action="walk-interact" disabled>${icon('compass')}<span>靠近</span></button></div>`;
}

export function renderWalkScene(style, layout, { thumbnail = false } = {}) {
  const thumbnailScale = 740 / worldHeight;
  const thumbnailViewWidth = 390 / thumbnailScale;
  const thumbnailCameraX = Math.max(0, Math.min(worldWidth - thumbnailViewWidth, layout.spawn.x - thumbnailViewWidth / 2));
  return `<div class="walk-scene walk-theme-${escapeHtml(style.id)} walk-backdrop-${escapeHtml(style.backdrop)}${thumbnail ? ' is-thumbnail' : ''}" style="--walk-accent:${escapeHtml(style.accent)}">
    <div class="walk-viewport" tabindex="${thumbnail ? '-1' : '0'}" role="application" aria-label="2.5D主神空间，可横向走动并靠近人物交谈">
      <div class="walk-world" data-world style="width:${worldWidth}px;height:${worldHeight}px${thumbnail ? `;transform:translate(${-thumbnailCameraX * thumbnailScale}px,0) scale(${thumbnailScale})` : ''}">
        <img class="walk-background" src="assets/walk-${escapeHtml(style.backdrop)}-v1.png" alt="" draggable="false">
        <div class="walk-distance-haze" aria-hidden="true"></div>
        <div class="walk-floor" aria-hidden="true"><i></i></div>
        <div class="walk-world-edge edge-left" aria-hidden="true"></div><div class="walk-world-edge edge-right" aria-hidden="true"></div>
        ${thumbnail ? '' : '<span class="walk-destination-marker" data-destination-marker hidden aria-hidden="true"></span>'}
        ${layout.props.map(prop => renderProp(prop, style.id)).join('')}
        ${layout.targets.map(target => target.kind === 'portal' ? renderPortal(target) : renderNpc(target)).join('')}
        ${renderPlayer(layout.spawn)}
        <div class="walk-foreground" aria-hidden="true"></div>
      </div>
    </div>
    ${thumbnail ? '' : renderHud(layout)}
  </div>`;
}
