import { NODES } from './data.js';

// --- Rules -----------------------------------------------------------------
// Pressure, hunter, boss seal and post-combat recovery follow packages/core.
// Lamp oil, auto-resolved fights and the trap roll are prototype-only.
const ART = '../../cocos/assets/resources';
const ITEM_NAMES = {
  medicine_ash: '药炉灰', dispel_talisman: '破禁符', thunder_talisman: '雷火符', healing_pill: '止血丹',
  gate_sigil: '小界门符', demon_bone: '妖骨', hidden_stone: '雾后石', focus_incense: '定神香',
  capture_net: '缚灵网', spirit_bait: '灵饵', armor_patch: '护甲补片'
};
const MONSTERS = {
  fog_lesser_demon: { name: '雾中妖鬼', hp: 42, atk: 9, def: 2, points: 160, drop: { demon_bone: 1 }, art: 'monster-world/fog-lesser-demon-world-v1.png' },
  tower_butcher: { name: '剔骨塔卒', hp: 66, atk: 14, def: 6, points: 230, drop: { demon_bone: 2 }, art: 'monster-world/tower-butcher-world-v1.png', elite: true }
};
const PLAYER = { maxHp: 102, atk: 19, def: 8, trapCheck: 5 };
const BOSS = { nodeId: 'bone_lane_monster', title: '雾塔剔骨监斩官', hpRate: 1.25, atkBonus: 2, defBonus: 1, points: 140, lingyun: 1, items: { demon_bone: 2 } };
const HUNTER = { name: '血阶监猎者', spawn: 'tower_butcher_patrol', contain: 'sealed_cache', wakeAt: 6, fusePercent: 15, art: 'monster-world/tower-butcher-world-v1.png' };
const TIERS = {
  stable: { label: '稳定', monster: 0, reward: 15, next: 6 },
  hunted: { label: '追猎', monster: 10, reward: 5, next: 12 },
  breach: { label: '破界', monster: 20, reward: 0, next: null }
};
const OIL = { start: 12, supply: 4, contactLoss: 2 };
const SUPPLY = new Set(['north_supply_niche', 'evac_supply_cache', 'last_blessing_reward', 'quiet_prayer_reward']);
const START = 'fog_lesser_demon';
const EXIT = 'tower_exit';
const EXIT_REWARD = { points: 140, lingyun: 1 };
const PILL_HEAL = 36;
const TALISMAN_DAMAGE = 48;
const DIRS = { north: [0, -1, '北'], east: [1, 0, '东'], south: [0, 1, '南'], west: [-1, 0, '西'] };
const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };
const FACING = { south: 0, west: 1, east: 2, north: 3 };

const byId = new Map(NODES.map(node => [node.id, node]));
const at = (x, y) => NODES.find(node => node.x === x && node.y === y);
const neighbor = (node, dir) => at(node.x + DIRS[dir][0], node.y + DIRS[dir][1]);

// --- DOM -------------------------------------------------------------------
const $ = id => document.getElementById(id);
const stage = $('stage');
const room = $('room');
const hero = $('hero');
const sprite = $('hero-sprite');
const sheet = $('sheet');
const banner = $('banner');
const toastEl = $('toast');
const desktop = window.matchMedia('(min-width: 741px)');
// Measured walk-atlas rectangles from ui/hero-walk-atlas.ts (down / left / right / up rows).
const FRAMES = [
  [176, 8, 135, 306, 242, 311], [441, 10, 130, 305, 508, 313], [691, 9, 133, 306, 762, 314], [966, 10, 135, 305, 1034, 312],
  [183, 315, 126, 309, 235, 622], [417, 315, 171, 309, 499, 620], [698, 315, 135, 309, 758, 621], [952, 315, 163, 309, 1033, 621],
  [170, 624, 129, 305, 246, 927], [418, 625, 176, 304, 509, 928], [688, 624, 133, 305, 767, 927], [954, 625, 172, 304, 1042, 928],
  [175, 929, 139, 308, 243, 1233], [439, 929, 141, 309, 506, 1234], [693, 929, 146, 310, 762, 1235], [967, 929, 144, 309, 1034, 1235]
];

let s;
let selectedSize = '390';
let busy = false;
let toastTimer;
const bannerQueue = [];
let bannerActive = false;

function newRun() {
  s = {
    at: START, prev: null, hp: PLAYER.maxHp, oil: OIL.start, breachForced: false,
    visited: new Set([START]), cleared: new Set(), moves: 0,
    bag: { dispel_talisman: 0, gate_sigil: 0, armor_patch: 0, healing_pill: 0, thunder_talisman: 0 },
    loot: { points: 0, lingyun: 0, items: {} },
    hunter: { status: 'dormant', node: HUNTER.spawn, grace: 0, contacts: 0 },
    bossFused: false, over: null
  };
  bannerQueue.length = 0;
  closeSheet();
  renderAll();
  placeHero(centerSpot(), 3, true);
  openIntro();
}

// --- Derived state ---------------------------------------------------------
function tierId() {
  if (s.breachForced || s.cleared.size >= 12) return 'breach';
  return s.cleared.size >= 6 ? 'hunted' : 'stable';
}
const tier = () => TIERS[tierId()];
const scale = (value, percent) => (percent ? Math.max(value, Math.ceil(value * (100 + percent) / 100)) : value);
const node = () => byId.get(s.at);
const isBoss = n => n.id === BOSS.nodeId;
const isPending = n => !s.cleared.has(n.id) && ['monster', 'trap', 'reward'].includes(n.type);
const kindOf = n => (isBoss(n) ? 'boss' : SUPPLY.has(n.id) ? 'supply' : n.type);

function known(n) {
  if (s.visited.has(n.id)) return true;
  return [...s.visited].some(id => {
    const v = byId.get(id);
    return Math.abs(v.x - n.x) + Math.abs(v.y - n.y) === 1;
  });
}

function distances(fromId) {
  const dist = new Map([[fromId, 0]]);
  const queue = [byId.get(fromId)];
  while (queue.length) {
    const current = queue.shift();
    for (const dir of Object.keys(DIRS)) {
      const next = neighbor(current, dir);
      if (next && !dist.has(next.id)) { dist.set(next.id, dist.get(current.id) + 1); queue.push(next); }
    }
  }
  return dist;
}

function nextStepToward(fromId, toId) {
  const dist = distances(toId);
  const from = byId.get(fromId);
  let best;
  for (const dir of Object.keys(DIRS)) {
    const next = neighbor(from, dir);
    if (next && (!best || dist.get(next.id) < dist.get(best.id))) best = next;
  }
  return best?.id;
}

function monsterFor(n) {
  const base = MONSTERS[n.monsterId];
  const percent = tier().monster + (isBoss(n) && s.bossFused ? HUNTER.fusePercent : 0);
  const hp = scale(isBoss(n) ? Math.round(base.hp * BOSS.hpRate) : base.hp, percent);
  const atk = scale(base.atk + (isBoss(n) ? BOSS.atkBonus : 0), percent);
  const def = scale(base.def + (isBoss(n) ? BOSS.defBonus : 0), percent);
  return { ...base, hp, atk, def, percent };
}

function previewFight(n, opener = false) {
  const m = monsterFor(n);
  const dealt = Math.max(3, PLAYER.atk - Math.floor(m.def * 0.6));
  const taken = Math.max(3, m.atk - Math.floor(PLAYER.def * 0.6));
  const hpLeft = Math.max(0, m.hp - (opener ? TALISMAN_DAMAGE : 0));
  const hits = Math.ceil(hpLeft / dealt);
  const damage = Math.max(0, hits - 1) * taken;
  const pills = Math.min(s.bag.healing_pill, Math.max(0, Math.ceil((damage - s.hp + 1) / PILL_HEAL)));
  const survives = s.hp + pills * PILL_HEAL > damage;
  return { m, dealt, taken, hits, damage, pills, survives };
}

function trapFor(n) {
  const damage = scale(n.trap.damage, tier().monster);
  const need = Math.max(1, n.trap.dc - PLAYER.trapCheck);
  const chance = Math.max(0, Math.min(6, 7 - need)) / 6;
  return { damage, chance, counter: n.trap.counterItem, haveCounter: (s.bag[n.trap.counterItem] ?? 0) > 0 };
}

function danger(ratio) { return ratio < 0.15 ? 1 : ratio < 0.45 ? 2 : 3; }
function pips(level) { return `<span class="pips">${'◆'.repeat(level)}<span class="off">${'◆'.repeat(3 - level)}</span></span>`; }

// --- Rendering ---------------------------------------------------------------
const ICONS = {
  monster: '<path d="M6 9 4 4l5 3h6l5-3-2 5M6 9v4a6 6 0 0 0 12 0V9M10 13h.01M14 13h.01"/>',
  boss: '<path d="m4 8 4 3 4-6 4 6 4-3-2 10H6Z"/>',
  trap: '<path d="m4 19 3-9 3 9m1 0 3-12 3 12m1 0 2-6 2 6M3 19h18"/>',
  reward: '<path d="M4 9h16v10H4Zm0 0 2-4h12l2 4M10 13h4"/>',
  supply: '<path d="M12 3c3 4 5 6.5 5 10a5 5 0 0 1-10 0c0-3.5 2-6 5-10Z"/>',
  exit: '<path d="M6 21V9a6 6 0 0 1 12 0v12M4 21h16"/>',
  portal: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/>',
  cleared: '<path d="m5 12 4 4 10-10"/>',
  wall: '<path d="M4 6h16v12H4ZM4 12h16M10 6v6m4 0v6"/>'
};
const icon = kind => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[kind]}</svg>`;
const TYPE_LABEL = { monster: '怪物', boss: '首领', trap: '陷阱', reward: '宝箱', supply: '补给', exit: '出口', portal: '传送门' };
const OBJECT_ART = { trap: 'dungeon-world/trap-v1.png', reward: 'dungeon-world/chest-v1.png', supply: 'dungeon-world/shrine-v1.png', exit: 'dungeon-world/exit-v1.png', portal: 'dungeon-world/exit-v1.png' };

function renderAll() {
  renderHud();
  renderMinimap();
  renderRoom();
}

function renderHud() {
  const t = tierId();
  stage.dataset.tier = t;
  $('hp-text').innerHTML = `${Math.max(0, s.hp)}<span>/${PLAYER.maxHp}</span>`;
  $('hp-bar').style.width = `${Math.max(0, s.hp) / PLAYER.maxHp * 100}%`;
  $('hp-bar').classList.toggle('low', s.hp <= PLAYER.maxHp * 0.3);
  $('points').textContent = s.loot.points;
  const oil = $('oil');
  oil.dataset.state = s.oil <= 0 ? 'out' : s.oil <= 3 ? 'low' : 'ok';
  $('oil-value').textContent = s.oil;
  const total = Math.max(OIL.start, s.oil);
  $('oil-pips').innerHTML = Array.from({ length: total }, (_, i) => `<i class="${i < s.oil ? '' : 'spent'}"></i>`).join('');
  const pressure = $('pressure');
  pressure.dataset.tier = t;
  const info = TIERS[t];
  $('pressure-tier').textContent = info.label;
  $('pressure-effect').textContent = `怪物 ${info.monster ? `+${info.monster}%` : '原始强度'} · 奖励 ${info.reward ? `+${info.reward}%` : '无加成'}`;
  const count = s.cleared.size;
  $('fill-stable').style.width = `${Math.min(1, count / 6) * 100}%`;
  $('fill-hunted').style.width = `${Math.min(1, Math.max(0, count - 6) / 6) * 100}%`;
  $('fill-breach').style.width = t === 'breach' ? '100%' : '0%';
  $('pressure-foot').textContent = s.breachForced
    ? '灯油耗尽，压力已直接进入破界'
    : info.next ? `已清 ${count} 间，再清 ${info.next - count} 间进入${t === 'stable' ? '追猎' : '破界'}` : `已清 ${count} 间，压力已到顶`;
  $('reopen').hidden = Boolean(s.over) || !isPending(node()) || !sheet.hidden;
  $('retreat').disabled = Boolean(s.over);
}

function renderMinimap() {
  const cells = [];
  for (let y = 0; y < 5; y += 1) {
    for (let x = 0; x < 6; x += 1) {
      const n = at(x, y);
      const k = known(n);
      const hunterHere = s.hunter.node === n.id && ['stalking', 'dormant'].includes(s.hunter.status);
      cells.push(`<span class="cell" data-known="${k}" data-cleared="${s.cleared.has(n.id)}" data-current="${s.at === n.id}" data-kind="${k ? kindOf(n) : ''}" title="${k ? n.title : '未知'}">${k ? '<b></b>' : ''}${n.id === HUNTER.contain && s.hunter.status !== 'contained' ? '<i class="seal"></i>' : ''}${hunterHere ? `<i class="hunter ${s.hunter.status === 'dormant' ? 'dormant' : ''}"></i>` : ''}</span>`);
    }
  }
  $('minimap').innerHTML = cells.join('');
}

function doorBadge(n, dir, hunterDist, playerDist) {
  const kind = kindOf(n);
  const cleared = s.cleared.has(n.id);
  const visited = s.visited.has(n.id);
  let label = visited ? n.title : TYPE_LABEL[kind];
  let sub = '';
  if (cleared) sub = '已清空';
  else if (kind === 'monster' || kind === 'boss') {
    const p = previewFight(n);
    sub = `${MONSTERS[n.monsterId].elite && kind !== 'boss' ? '精英 ' : ''}${pips(p.survives ? danger(p.damage / s.hp) : 3)}`;
    if (kind === 'boss' && s.bossFused) sub += ' +15%';
  } else if (kind === 'trap') {
    const t = trapFor(n);
    sub = t.haveCounter ? `可用${ITEM_NAMES[t.counter]}` : `${pips(danger((t.damage * (1 - t.chance)) / s.hp + 0.1))}`;
  } else if (kind === 'reward') sub = tier().reward ? `奖励 +${tier().reward}%` : '无加成';
  else if (kind === 'supply') sub = `+${OIL.supply} 灯油`;
  else if (kind === 'exit') sub = s.cleared.has(BOSS.nodeId) ? '可撤离' : '首领封印中';
  else if (kind === 'portal') sub = '原型未开放';
  if (cleared && kind !== 'exit') label = n.title;
  let extra = '';
  if (n.id === HUNTER.contain && ['dormant', 'stalking'].includes(s.hunter.status)) {
    extra += `<span class="seal-note">${cleared ? '封印点 · 已就绪' : '封印点 · 先清空'}</span>`;
  }
  let threat;
  if (s.hunter.status === 'stalking') {
    if (s.hunter.node === n.id) { threat = 'near'; extra += '<span class="threat">监猎者就在门后</span>'; }
    else if (hunterDist === playerDist - 1 && playerDist <= 4) { threat = 'far'; extra += `<span class="threat">脚步声 · ${playerDist} 步</span>`; }
  }
  return {
    threat,
    html: `<span class="badge" data-kind="${kind}" data-cleared="${cleared}"><span class="badge-main">${icon(cleared ? 'cleared' : kind)}${label}</span>${sub ? `<span class="badge-sub">${sub}</span>` : ''}${extra}</span>`
  };
}

function renderRoom() {
  const here = node();
  const huntDist = s.hunter.status === 'stalking' ? distances(s.hunter.node) : null;
  const playerDist = huntDist?.get(here.id);
  const doors = Object.keys(DIRS).map(dir => {
    const n = neighbor(here, dir);
    const art = `<span class="door-art"><img src="${ART}/dungeon-world/ruined-stone-gate-v1.png" alt="" draggable="false"><img class="lurker" src="${ART}/${HUNTER.art}" alt="" draggable="false"></span>`;
    if (!n) return `<div class="door door-${dir}" data-closed="true">${art}<span class="badge"><span class="badge-main">${icon('wall')}石壁</span></span></div>`;
    const badge = doorBadge(n, dir, huntDist?.get(n.id), playerDist);
    return `<button type="button" class="door door-${dir}" data-dir="${dir}" ${badge.threat ? `data-threat="${badge.threat}"` : ''} aria-label="${DIRS[dir][2]}门：${n.title}">${art}${badge.html}</button>`;
  });
  const kind = kindOf(here);
  const done = s.cleared.has(here.id);
  let art = here.monsterId ? MONSTERS[here.monsterId].art : OBJECT_ART[kind];
  if (done && here.monsterId) art = 'dungeon-world/debris-v1.png';
  const name = here.monsterId && !done ? (isBoss(here) ? BOSS.title : MONSTERS[here.monsterId].name) : here.title;
  const state = done ? ({ monster: '已击败', boss: '已击败', trap: '已通过', reward: '已领取', supply: '已领取' }[kind] ?? '')
    : kind === 'exit' ? (s.cleared.has(BOSS.nodeId) ? '点击撤离' : '首领封印中') : kind === 'portal' ? '原型未开放' : '点击处理';
  room.innerHTML = `${doors.join('')}<button type="button" class="center" id="center" data-kind="${kind}" data-done="${done}"><img src="${ART}/${art}" alt="" draggable="false" ${kind === 'portal' ? 'style="filter:hue-rotate(150deg) saturate(1.6) drop-shadow(0 8px 5px #0009)"' : ''}><span class="center-name">${name}</span>${state ? `<span class="center-state">${state}</span>` : ''}</button>`;
  room.querySelectorAll('[data-dir]').forEach(door => door.addEventListener('click', () => tryMove(door.dataset.dir)));
  $('center').addEventListener('click', () => openRoomEvent(true));
}

// --- Hero ------------------------------------------------------------------
function heroFrame(direction, frame) {
  const [x, y, width, height, footX, footY] = FRAMES[direction * 4 + frame];
  const k = parseFloat(getComputedStyle(stage).getPropertyValue('--hero-height')) / 308;
  Object.assign(sprite.style, {
    width: `${width * k}px`, height: `${height * k}px`, left: `${-(footX - x) * k}px`, top: `${-(footY - y) * k}px`,
    backgroundSize: `${1254 * k}px ${1254 * k}px`, backgroundPosition: `${-x * k}px ${-y * k}px`
  });
}

function stagePoint(element, anchor) {
  const stageRect = stage.getBoundingClientRect();
  const k = stageRect.width / stage.clientWidth;
  const rect = element.getBoundingClientRect();
  const x = (rect.left + rect.width / 2 - stageRect.left) / k;
  const y = (anchor === 'top' ? rect.top : rect.bottom) - stageRect.top;
  return { x, y: y / k };
}

// The hero waits beside the room object's name plate, clear of the south door badge.
function centerSpot() {
  const center = stagePoint($('center'), 'bottom');
  return { x: center.x + (stage.dataset.size === '320' ? 62 : 74), y: center.y - 2 };
}

function doorSpot(dir) {
  const door = room.querySelector(`.door-${dir} .door-art`);
  const p = stagePoint(door, 'bottom');
  if (dir === 'north') return { x: p.x, y: p.y + 6 };
  if (dir === 'south') return { x: p.x, y: p.y - 8 };
  return { x: p.x + (dir === 'west' ? 18 : -18), y: p.y };
}

function placeHero(point, direction, instant) {
  hero.classList.toggle('instant', instant);
  hero.style.left = `${point.x}px`;
  hero.style.top = `${point.y}px`;
  heroFrame(direction, 0);
}

function walk(point, direction) {
  return new Promise(resolve => {
    let frame = 0;
    const timer = setInterval(() => { frame = (frame + 1) % 4; heroFrame(direction, frame); }, 95);
    placeHero(point, direction, false);
    setTimeout(() => { clearInterval(timer); heroFrame(direction, 0); resolve(); }, 400);
  });
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// --- Flow --------------------------------------------------------------------
async function tryMove(dir, force = false) {
  if (busy || s.over) return;
  const here = node();
  const target = neighbor(here, dir);
  if (!target) return;
  if (!force && isPending(here)) {
    toast('先处理这个房间的事件，才能离开。');
    openRoomEvent(true);
    return;
  }
  busy = true;
  closeSheet();
  await walk(doorSpot(dir), FACING[dir]);
  room.classList.add('fading');
  hero.style.opacity = '0';
  await wait(220);

  const tierBefore = tierId();
  s.prev = s.at;
  s.at = target.id;
  s.moves += 1;
  s.visited.add(target.id);
  if (s.oil > 0) {
    s.oil -= 1;
    if (s.oil === 0) runOutOfOil();
  }
  const contactFirst = s.hunter.status === 'stalking' && s.hunter.node === s.at;
  if (contactFirst) hunterContact();
  else advanceHunter();
  if (isBoss(target) && s.hunter.status === 'stalking') {
    s.hunter.status = 'fused';
    s.bossFused = true;
    queueBanner('hunter', '监猎者融入首领', `${HUNTER.name}没被甩掉，融进了塔主血甲：首领全属性 +${HUNTER.fusePercent}%`);
  }
  announceTier(tierBefore);

  renderAll();
  room.classList.remove('fading');
  placeHero(doorSpot(OPPOSITE[dir]), FACING[dir], true);
  hero.style.opacity = '1';
  await wait(30);
  await walk(centerSpot(), FACING[dir]);
  busy = false;
  if (s.hp <= 0) return finish('failed', `被${HUNTER.name}追上，伤势过重`);
  if (target.type === 'portal') toast('传送门通往地铁深渊，原型里不开放，可以当作通路。');
  else openRoomEvent(false);
}

function runOutOfOil() {
  s.breachForced = true;
  queueBanner('oil', '灯油耗尽', '黑暗里塔开始反扑：压力直接进入破界');
  wakeHunter('灯火熄灭，');
}

function wakeHunter(prefix = '') {
  if (s.hunter.status !== 'dormant') return;
  s.hunter.status = 'stalking';
  s.hunter.node = HUNTER.spawn;
  s.hunter.grace = 0;
  queueBanner('hunter', '血阶监猎者醒了', `${prefix}你走一步它走一步。先清空「雾后暗格」再把它引过去，可以封印它`);
}

function advanceHunter() {
  if (s.hunter.status !== 'stalking') return;
  if (s.hunter.grace) { s.hunter.grace = 0; return; }
  const next = nextStepToward(s.hunter.node, s.at);
  if (!next) return;
  if (next === HUNTER.contain && s.cleared.has(HUNTER.contain)) {
    s.hunter.status = 'contained';
    s.hunter.node = HUNTER.contain;
    queueBanner('seal', '监猎者被封印', '它踏进雾后暗格的阵纹被锁住了。成功撤离时额外带回妖骨 ×1');
    return;
  }
  if (next === s.at) return hunterContact();
  s.hunter.node = next;
}

function hunterContact() {
  const damage = Math.floor(PLAYER.maxHp * 15 / 100) + 1;
  s.hp -= damage;
  s.oil = Math.max(0, s.oil - OIL.contactLoss);
  s.hunter.contacts += 1;
  s.hunter.node = HUNTER.spawn;
  s.hunter.grace = 1;
  queueBanner('hunter', '被监猎者追上', `生命 -${damage}，灯油 -${OIL.contactLoss}。它退回巢穴，下一步不会动`);
  if (s.oil === 0 && !s.breachForced) runOutOfOil();
}

function announceTier(before) {
  const after = tierId();
  if (after === before) return;
  const info = TIERS[after];
  queueBanner(after, `压力：${info.label}`, `怪物 +${info.monster}%，奖励加成 ${info.reward ? `+${info.reward}%` : '取消'}`);
}

function clearRoom(n) {
  const before = tierId();
  s.cleared.add(n.id);
  announceTier(before);
  if (s.cleared.size >= HUNTER.wakeAt) wakeHunter(`你已清了 ${HUNTER.wakeAt} 间，`);
  renderAll();
}

function gain(points, lingyun, items) {
  const bonus = tier().reward;
  const total = Math.floor(points * (100 + bonus) / 100);
  s.loot.points += total;
  s.loot.lingyun += lingyun ?? 0;
  for (const [id, count] of Object.entries(items ?? {})) {
    s.loot.items[id] = (s.loot.items[id] ?? 0) + count;
    if (id in s.bag) s.bag[id] += count;
  }
  return { total, bonus };
}

function itemsText(items) {
  return Object.entries(items ?? {}).map(([id, count]) => `${ITEM_NAMES[id] ?? id} ×${count}`).join('、');
}

// --- Event sheets ------------------------------------------------------------
function openRoomEvent(manual) {
  if (busy || s.over) return;
  const n = node();
  const kind = kindOf(n);
  if (kind === 'exit') return openExit();
  if (kind === 'portal') return toast('传送门通往地铁深渊，原型里不开放。');
  if (!isPending(n)) { if (manual) toast(`${n.title}已经处理过了。`); return; }
  if (n.monsterId) return openFight(n);
  if (n.type === 'trap') return openTrap(n);
  return openReward(n);
}

function backAction() {
  if (!s.prev) return [];
  const dir = Object.keys(DIRS).find(d => neighbor(node(), d)?.id === s.prev);
  return [{ label: '退回上一间', sub: s.oil > 0 ? '耗 1 灯油' : '灯油已空', onClick: () => tryMove(dir, true) }];
}

function openFight(n) {
  const plain = previewFight(n);
  const opener = s.bag.thunder_talisman > 0 ? previewFight(n, true) : null;
  const m = plain.m;
  const outcome = p => (p.survives ? `预计受伤 ${p.damage}${p.pills ? `，自动服用止血丹 ×${p.pills}` : ''}` : `预计受伤 ${p.damage}，撑不住`);
  const rows = [
    ['敌人', `生命 ${m.hp} · 攻击 ${m.atk} · 防御 ${m.def}${m.percent ? ` <span class="bad">(+${m.percent}%)</span>` : ''}`],
    ['你', `生命 ${s.hp}/${PLAYER.maxHp} · 每击 ${plain.dealt}`],
    ['结果', `<span class="${plain.survives ? (plain.damage / s.hp > 0.45 ? 'bad' : 'good') : 'bad'}">${outcome(plain)}</span>`],
    ['奖励', `<span class="gold">${isBoss(n) ? m.points + BOSS.points : m.points} 轮回点${tier().reward ? ` +${tier().reward}%` : ''}</span>`]
  ];
  if (isBoss(n) && s.bossFused) rows.splice(1, 0, ['融合', `<span class="bad">监猎者融入，全属性 +${HUNTER.fusePercent}%</span>`]);
  showSheet({
    art: m.art,
    kicker: isBoss(n) ? '首领 · 白骨闭门阵' : m.elite ? '精英战' : '遭遇战',
    title: isBoss(n) ? BOSS.title : n.title === m.name ? n.title : `${n.title} · ${m.name}`,
    desc: n.desc,
    rows,
    actions: [
      ...backAction(),
      ...(opener ? [{ label: '雷火符开场', sub: outcome(opener), onClick: () => fight(n, true) }] : []),
      { label: '战斗', sub: '战后生命回满', primary: true, onClick: () => fight(n, false) }
    ],
    dismissible: true
  });
}

function fight(n, opener) {
  const p = previewFight(n, opener);
  if (opener) s.bag.thunder_talisman -= 1;
  s.bag.healing_pill -= p.pills;
  if (!p.survives) { s.hp = 0; return finish('failed', `倒在了${isBoss(n) ? BOSS.title : p.m.name}手下`); }
  const reward = gain(p.m.points + (isBoss(n) ? BOSS.points : 0), isBoss(n) ? BOSS.lingyun : 0, { ...p.m.drop, ...(isBoss(n) ? BOSS.items : {}) });
  s.hp = PLAYER.maxHp;
  clearRoom(n);
  showSheet({
    art: p.m.art, kicker: '胜利', title: `击败${isBoss(n) ? BOSS.title : p.m.name}`,
    desc: isBoss(n) ? '白骨闸松开了，白光裂口现在可以撤离。' : '战斗结束，生命回满。',
    rows: [['受伤', `${p.damage}${p.pills ? `（服用止血丹 ×${p.pills}）` : ''}`], ['获得', `<span class="gold">${reward.total} 轮回点</span>${reward.bonus ? `（含 +${reward.bonus}%）` : ''}，${itemsText(p.m.drop)}`]],
    actions: [{ label: '继续', primary: true, onClick: closeSheet }]
  });
}

function openTrap(n) {
  const t = trapFor(n);
  showSheet({
    art: OBJECT_ART.trap, kicker: '陷阱', title: n.title, desc: n.desc,
    rows: [
      ['伤害', `<span class="bad">${t.damage}</span>${tier().monster ? `（压力 +${tier().monster}%）` : ''}`],
      ['硬闯', `${Math.round(t.chance * 100)}% 无伤通过`],
      ['克制', `${ITEM_NAMES[t.counter]}（持有 ${s.bag[t.counter] ?? 0}）`]
    ],
    actions: [
      ...backAction(),
      { label: `用${ITEM_NAMES[t.counter]}`, sub: '无伤通过', disabled: !t.haveCounter, onClick: () => resolveTrap(n, 'counter') },
      { label: '硬闯', sub: `失败 -${t.damage} 生命`, primary: !t.haveCounter, onClick: () => resolveTrap(n, 'risk') }
    ],
    dismissible: true
  });
}

function resolveTrap(n, choice) {
  const t = trapFor(n);
  let line;
  if (choice === 'counter') { s.bag[t.counter] -= 1; line = `${ITEM_NAMES[t.counter]}压住了机关，无伤通过。`; }
  else if (Math.random() < t.chance) line = '你看准落脚点，无伤通过。';
  else { s.hp -= t.damage; line = `机关触发，生命 -${t.damage}。`; }
  if (s.hp <= 0) return finish('failed', `倒在了${n.title}`);
  clearRoom(n);
  showSheet({ art: OBJECT_ART.trap, kicker: '陷阱', title: n.title, desc: line, rows: [['生命', `${s.hp}/${PLAYER.maxHp}`]], actions: [{ label: '继续', primary: true, onClick: closeSheet }] });
}

function openReward(n) {
  const supply = SUPPLY.has(n.id);
  const r = n.reward;
  const bonus = tier().reward;
  showSheet({
    art: supply ? OBJECT_ART.supply : OBJECT_ART.reward, kicker: supply ? '补给' : '宝箱', title: n.title, desc: n.desc,
    rows: [
      ['轮回点', `<span class="gold">${Math.floor(r.rewardPoints * (100 + bonus) / 100)}</span>${bonus ? `（${tier().label}加成 +${bonus}%）` : '（破界无加成）'}`],
      ...(r.items || r.lingyun ? [['物品', [itemsText(r.items), r.lingyun ? `灵蕴 ×${r.lingyun}` : ''].filter(Boolean).join('、')]] : []),
      ...(supply ? [['灯油', `<span class="gold">+${OIL.supply}</span>`]] : [])
    ],
    actions: [{ label: '领取', primary: true, onClick: () => claim(n) }],
    dismissible: true
  });
}

function claim(n) {
  gain(n.reward.rewardPoints, n.reward.lingyun, n.reward.items);
  if (SUPPLY.has(n.id)) {
    s.oil += OIL.supply;
    $('oil').classList.remove('bump'); void $('oil').offsetWidth; $('oil').classList.add('bump');
  }
  clearRoom(n);
  closeSheet();
}

function openExit() {
  if (!s.cleared.has(BOSS.nodeId)) {
    return showSheet({
      art: OBJECT_ART.exit, kicker: '出口', title: '白光裂口', desc: '骨巷尽头的白骨闭门阵还没破，裂口被封住。先击败骨巷塔卒（首领），归路才会显形。',
      rows: [['首领位置', '骨巷塔卒（出口正北）']], actions: [{ label: '知道了', primary: true, onClick: closeSheet }]
    });
  }
  showSheet({
    art: OBJECT_ART.exit, kicker: '出口', title: '白光裂口', desc: '归路已经显形。现在撤离会结算本局收获；也可以继续探索，但灯油和追兵不会等你。',
    rows: [['撤离奖励', `<span class="gold">${EXIT_REWARD.points} 轮回点 · 灵蕴 ×${EXIT_REWARD.lingyun}</span>`], ['灯油', `${s.oil}`]],
    actions: [{ label: '再逛逛', onClick: closeSheet }, { label: '撤离', primary: true, onClick: () => finish('cleared') }]
  });
}

function openRetreat() {
  if (busy || s.over) return;
  showSheet({
    art: 'character/reincarnator-v2.png', kicker: '中途撤离', title: '放弃本层，立即离开',
    desc: '带走已经拿到的东西，但拿不到出口奖励；封印的监猎者妖骨也带不走。',
    rows: [['已获得', `<span class="gold">${s.loot.points} 轮回点</span>`]],
    actions: [{ label: '再想想', onClick: closeSheet }, { label: '撤离', primary: true, onClick: () => finish('retreat') }]
  });
}

function openIntro() {
  showSheet({
    art: 'dungeon-world/exit-v1.png', kicker: '妖塔一层 · 原型', title: '击败骨巷首领，从白光裂口撤离',
    desc: '点门走到隔壁房间。门上会预告下一间是什么、有多危险。',
    rows: [
      ['灯油', `${OIL.start}：每走一步耗 1，补给房 +${OIL.supply}，烧完压力直接进入破界`],
      ['压力', '清 6 间进入追猎、12 间进入破界：怪物变强，奖励加成变少'],
      ['追兵', `清 6 间后${HUNTER.name}苏醒，小地图上的红点就是它`]
    ],
    actions: [{ label: '开始', primary: true, onClick: () => { closeSheet(); openRoomEvent(false); } }]
  });
}

function finish(kind, reason = '') {
  s.over = kind;
  let points = s.loot.points;
  let lingyun = s.loot.lingyun;
  const items = { ...s.loot.items };
  const rows = [];
  if (kind === 'cleared') {
    points += EXIT_REWARD.points;
    lingyun += EXIT_REWARD.lingyun;
    rows.push(['出口奖励', `+${EXIT_REWARD.points} 轮回点、灵蕴 ×${EXIT_REWARD.lingyun}`]);
    if (s.hunter.status === 'contained') { items.demon_bone = (items.demon_bone ?? 0) + 1; rows.push(['封印监猎者', '<span class="good">妖骨 ×1</span>']); }
  }
  if (kind === 'failed') {
    points = Math.floor(points * 0.3);
    rows.push(['主神回收', '<span class="bad">只带回 30% 轮回点，物品全部遗失</span>']);
    for (const id of Object.keys(items)) delete items[id];
    lingyun = 0;
  }
  rows.unshift(['清理房间', `${s.cleared.size} / ${NODES.length}`], ['走了', `${s.moves} 步 · 剩余灯油 ${Math.max(0, s.oil)}`], ['最高压力', TIERS[tierId()].label]);
  rows.push(['监猎者', { dormant: '没有苏醒', stalking: `一直在追（被撞 ${s.hunter.contacts} 次）`, contained: `已封印（被撞 ${s.hunter.contacts} 次）`, fused: '融进了首领' }[s.hunter.status]]);
  rows.push(['带出', `<span class="gold">${points} 轮回点</span>${lingyun ? `、灵蕴 ×${lingyun}` : ''}${Object.keys(items).length ? `、${itemsText(items)}` : ''}`]);
  renderAll();
  showSheet({
    art: kind === 'failed' ? HUNTER.art : 'dungeon-world/exit-v1.png',
    kicker: '本局结算',
    title: { cleared: '成功撤离', retreat: '中途撤离', failed: '主神强制回收' }[kind],
    desc: reason || (kind === 'cleared' ? '你带着收获穿过白光裂口。' : '你放弃了本层，提前离开。'),
    rows,
    actions: [{ label: '再来一局', primary: true, onClick: newRun }]
  });
}

// --- Sheet / toast / banner --------------------------------------------------
let sheetActions = [];
function showSheet({ art, kicker, title, desc, rows = [], actions = [], dismissible = false }) {
  sheetActions = dismissible ? [{ label: '收起', sub: '先看看门', onClick: closeSheet }, ...actions] : actions;
  sheet.innerHTML = `
    <div class="sheet-head"><img src="${ART}/${art}" alt=""><div><p class="sheet-kicker">${kicker}</p><h2>${title}</h2></div></div>
    ${desc ? `<p class="sheet-desc">${desc}</p>` : ''}
    ${rows.length ? `<dl class="sheet-rows">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>` : ''}
    <div class="sheet-actions">${sheetActions.map((a, i) => `<button type="button" data-action="${i}" class="${a.primary ? 'primary' : ''}" ${a.disabled ? 'disabled' : ''}>${a.label}${a.sub ? `<small>${a.sub}</small>` : ''}</button>`).join('')}</div>`;
  sheet.hidden = false;
  sheet.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => sheetActions[Number(button.dataset.action)].onClick()));
  renderHud();
}

function closeSheet() {
  sheet.hidden = true;
  if (s) renderHud();
}

function toast(message, danger = false) {
  toastEl.textContent = message;
  toastEl.classList.toggle('toast-danger', danger);
  toastEl.hidden = false;
  $('desktop-status').textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2600);
}

function queueBanner(tone, title, line) {
  bannerQueue.push({ tone, title, line });
  if (!bannerActive) nextBanner();
}

function nextBanner() {
  const item = bannerQueue.shift();
  if (!item) { bannerActive = false; banner.hidden = true; return; }
  bannerActive = true;
  banner.dataset.tone = item.tone;
  banner.innerHTML = `<h2>${item.title}</h2><p>${item.line}</p>`;
  banner.hidden = false;
  banner.style.animation = 'none'; void banner.offsetWidth; banner.style.animation = '';
  $('desktop-status').textContent = `${item.title}：${item.line}`;
  if (item.tone === 'hunted' || item.tone === 'breach') { $('pressure').classList.remove('bump'); void $('pressure').offsetWidth; $('pressure').classList.add('bump'); }
  setTimeout(nextBanner, 2800);
}

// --- Size / notes --------------------------------------------------------------
function applySize() {
  const size = desktop.matches ? selectedSize : (window.innerWidth <= 350 ? '320' : '390');
  stage.dataset.size = size;
  document.documentElement.style.setProperty('--game-width', `${size}px`);
  document.documentElement.style.setProperty('--game-height', size === '320' ? '568px' : '844px');
  const designHeight = size === '320' ? 568 : 844;
  const fit = desktop.matches ? Math.min(1, (window.innerHeight - 64) / designHeight) : 1;
  document.documentElement.style.setProperty('--preview-scale', String(Math.max(0.35, fit)));
  if (s) { renderRoom(); placeHero(centerSpot(), 3, true); }
}

document.querySelectorAll('.size-switch button').forEach(button => button.addEventListener('click', () => {
  selectedSize = button.dataset.size;
  document.querySelectorAll('.size-switch button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  applySize();
}));
$('mobile-notes').addEventListener('click', () => $('notes').classList.add('is-open'));
$('close-notes').addEventListener('click', () => $('notes').classList.remove('is-open'));
$('restart').addEventListener('click', newRun);
$('retreat').addEventListener('click', openRetreat);
$('reopen').addEventListener('click', () => openRoomEvent(true));
window.addEventListener('resize', applySize);
window.addEventListener('keydown', event => {
  const dir = { ArrowUp: 'north', KeyW: 'north', ArrowDown: 'south', KeyS: 'south', ArrowLeft: 'west', KeyA: 'west', ArrowRight: 'east', KeyD: 'east' }[event.code];
  if (dir && sheet.hidden) tryMove(dir);
});

applySize();
newRun();
// Exposed for scripted screenshots.
window.__proto = { get state() { return s; }, tryMove, openRoomEvent, closeSheet, newRun, render: renderAll, finish };
