// Isolated combat v2 fixture. No game runtime, saves, network calls, or persistence.
// Numbers below only make the interface observable; the real game reads domain results.
const $ = selector => document.querySelector(selector);
const params = new URLSearchParams(location.search);
if (params.has('shot')) document.body.classList.add('shot');
if (params.get('scenario')) $('#scenario').value = params.get('scenario');
if (params.has('assist')) $('#assist').checked = true;

const ICONS = {
  bag: '<path d="M4 8h16v12H4ZM8 8V4h8v4M4 12h16M10 10h4v5h-4Z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  spell: '<path d="m12 2 9 10-9 10L3 12ZM12 6l5 6-5 6-5-6ZM12 2v20M3 12h18"/>',
  attack: '<path d="m6 18 12-13 3-2-1 5L8 20M4 14l7 7M3 21l3-3"/>',
  weapon: '<path d="M8 22 18 3l3-1-1 5L10 24M6 15l8 4M3 6l3 1M5 2l1 3M2 11l3-1"/>',
  guard: '<path d="m12 2 8 3v8c0 4-8 9-8 9s-8-5-8-9V5ZM12 5v13M7 8h10"/>',
  bottle: '<path d="M9 3h6v4l4 5v9H5v-9l4-5ZM8 2h8M9 6h6M5 13h14M10 16h4M12 14v5"/>',
  talisman: '<path d="M6 2h12v20H6ZM9 5h6M12 7l-3 5h5l-3 5M9 19h6"/>',
  escape: '<path d="M10 3H4v18h6M8 12h14M16 6l6 6-6 6"/>',
  claw: '<path d="M6 3c1 6 3 10 7 13M11 2c1 6 3 10 7 13M16 3c1 5 2 8 5 10M4 20l4-3"/>',
  heavy: '<path d="M12 2v6M12 22l-4-6h8ZM5 9l7 3 7-3M3 14l3-2M21 14l-3-2"/><circle cx="12" cy="13" r="2"/>',
  shield: '<path d="m12 2 8 3v8c0 4-8 9-8 9s-8-5-8-9V5Z"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] ?? ICONS.spell}</svg>`;
const paintIcons = (root = document) => root.querySelectorAll('[data-icon]').forEach(node => { node.innerHTML = icon(node.dataset.icon); });
paintIcons();

// Right-facing frames from cocos/assets/scripts/ui/hero-walk-atlas.ts (shared 336px canvas).
const ATLAS = { size: 1254, canvas: 336, footX: 168, footY: 320.16 };
const FRAMES = {
  8: { rect: [170, 624, 129, 305], foot: [246, 927] },
  9: { rect: [418, 625, 176, 304], foot: [509, 928] },
  10: { rect: [688, 624, 133, 305], foot: [767, 927] },
  11: { rect: [954, 625, 172, 304], foot: [1042, 928] },
};
const game = $('#game');
const world = $('#world-layer');
const fx = $('#fx');
const heroEl = $('#hero');
const enemyEl = $('#enemy');
const heroSprite = $('#hero-sprite');
const sheet = $('#sheet');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function setHeroFrame(index) {
  const frame = FRAMES[index];
  const scale = heroSprite.clientWidth / ATLAS.canvas;
  const [x, y, w, h] = frame.rect;
  const style = $('#hero-frame').style;
  style.width = `${w * scale}px`; style.height = `${h * scale}px`;
  style.left = `${(ATLAS.footX - (frame.foot[0] - x)) * scale}px`;
  style.top = `${(ATLAS.footY - (frame.foot[1] - y)) * scale}px`;
  style.backgroundSize = `${ATLAS.size * scale}px ${ATLAS.size * scale}px`;
  style.backgroundPosition = `${-x * scale}px ${-y * scale}px`;
}

const CANCELLED = Symbol('cancelled');
const MAX_HP = 116;
const DAMAGE = { attack: 18, weapon: 32, art: 24, talisman: 30 };
const CRIT_RATE = 1.5;
const OFFENSIVE = new Set(['attack', 'weapon', 'art', 'talisman']);
const NAMES = { attack: '普攻', weapon: '战技·裂空斩', art: '术法', talisman: '雷火符', guard: '防御', pill: '止血丹', mist: '归息', iron: '镇岳' };
let state;
let generation = 0;
let walkTimer;

function reset() {
  generation++;
  clearInterval(walkTimer);
  fx.innerHTML = '';
  document.querySelectorAll('.number').forEach(node => node.remove());
  [heroEl, enemyEl, world, heroSprite].forEach(node => node.getAnimations().forEach(animation => animation.cancel()));
  heroEl.style.transform = ''; enemyEl.style.transform = '';
  enemyEl.classList.remove('flash', 'windup'); heroEl.classList.remove('hurt');
  enemyEl.style.opacity = '';
  $('#banner').className = 'banner';
  hideHint();
  game.classList.remove('qte');
  const scenario = $('#scenario').value;
  const boss = scenario === 'boss';
  state = {
    hp: scenario === 'danger' ? 22 : 78, enemyHp: boss ? 96 : 42, maxEnemyHp: boss ? 96 : 42,
    enemyName: boss ? '雾锋妖将' : '雾中妖鬼', boss,
    turn: scenario === 'heavy' ? 2 : 1, focus: scenario === 'focus' ? 3 : scenario === 'heavy' ? 1 : 0,
    pills: 2, talismans: scenario === 'talisman' ? 2 : 0, used: new Set(), guarded: false, breath: false,
    busy: false, ended: false, log: [],
  };
  enemyEl.querySelector('.enemy-art').style.height = boss ? 'calc(var(--enemy-h) * 1.12)' : '';
  if (sheet.open) sheet.close();
  setHeroFrame(8);
  ticker(`迎战<em>${state.enemyName}</em> · 战技与重击回合可把握时机`);
  render();
}

function enemyIntent() {
  const heavy = state.turn % 3 === 2 || (state.boss && state.turn % 2 === 0);
  const damage = heavy ? 30 : 12;
  const guarded = heavy ? 8 : 6;
  return { heavy, name: heavy ? '蓄力重击' : '常规追击', damage, guarded, perfect: Math.ceil(guarded / 2) };
}

function render() {
  const intent = enemyIntent();
  $('#turn').textContent = state.turn;
  $('#hero-hp').textContent = `${state.hp}/${MAX_HP}`;
  $('#enemy-hp').textContent = `${state.enemyHp}/${state.maxEnemyHp}`;
  setBar('hero', state.hp / MAX_HP);
  setBar('enemy', state.enemyHp / state.maxEnemyHp);
  $('#hero-hp-track').classList.toggle('low', state.hp / MAX_HP <= .25);
  $('#enemy-name').textContent = state.enemyName;
  $('#encounter-kind').textContent = state.boss ? '首领遭遇' : '普通遭遇';
  $('#enemy-rank').textContent = state.boss ? '首领' : '普通';
  $('#enemy-rank').classList.toggle('boss', state.boss);
  $('#hero-chips').innerHTML = [state.guarded && '守势', state.breath && '蓄息']
    .filter(Boolean).map(chip => `<span>${chip}</span>`).join('');

  const bubble = $('#intent');
  bubble.classList.toggle('danger', intent.heavy && !state.ended);
  bubble.classList.toggle('guarded', state.guarded);
  bubble.hidden = state.ended;
  $('#intent-icon').dataset.icon = intent.heavy ? 'heavy' : 'claw';
  paintIcons(bubble);
  $('#intent-detail').textContent = state.guarded
    ? `守势中 · 预计承伤 ${intent.guarded}`
    : `${intent.heavy ? '重击' : '反击'} ${intent.damage} · 防御 ${intent.guarded}`;
  $('#intent-name').innerHTML = `${intent.name}${intent.heavy && !state.guarded ? '<em class="qte-chip">可格挡</em>' : ''}`;

  const ready = state.focus >= 3;
  const attack = $('#attack');
  attack.classList.toggle('ready', ready);
  $('#attack-icon').dataset.icon = ready ? 'weapon' : 'attack';
  paintIcons(attack);
  $('#attack-label').textContent = ready ? '战技' : '攻击';
  $('#attack-mode').textContent = ready ? '裂空斩 · 可会心' : `普攻 · 战意 ${state.focus}/3`;
  attack.querySelectorAll('.seg').forEach((seg, index) => seg.classList.toggle('on', index < state.focus));
  attack.setAttribute('aria-label', ready ? '释放武器战技裂空斩' : `普通攻击，战意 ${state.focus}/3`);

  const recommendGuard = intent.heavy && !state.guarded && !state.ended;
  const guard = document.querySelector('[data-action="guard"]');
  guard.classList.toggle('recommended', recommendGuard);
  guard.querySelector('.badge').hidden = !recommendGuard;
  const talisman = document.querySelector('[data-action="talisman"]');
  talisman.classList.toggle('muted', state.talismans === 0);
  $('#talisman-count').textContent = state.talismans || '';
  $('#talisman-count').hidden = state.talismans === 0;
  $('#pill-count').textContent = state.pills;
  document.querySelector('[data-group="medicines"]').classList.toggle('muted', state.pills === 0);

  game.classList.toggle('busy', state.busy);
  const locked = state.busy || state.ended;
  game.querySelectorAll('.skill, .attack, .flee').forEach(button => { button.disabled = locked; });
  game.querySelectorAll('.tool').forEach(button => { button.disabled = state.busy; });
}

function setBar(side, ratio) {
  const width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
  $(`#${side}-hp-fill`).style.width = width;
  $(`#${side}-hp-lag`).style.width = width;
}
function ticker(html) { $('#ticker').innerHTML = html; }

// Geometry helpers in game-local pixels.
function local(element) {
  const box = game.getBoundingClientRect();
  const rect = element.getBoundingClientRect();
  return { x: rect.left - box.left, y: rect.top - box.top };
}
const heroH = () => heroSprite.clientWidth;
const enemyH = () => enemyEl.querySelector('.enemy-art').clientHeight;
const heroFoot = () => local(heroEl);
const enemyFoot = () => local(enemyEl);
const heroChest = () => { const foot = heroFoot(); return { x: foot.x, y: foot.y - heroH() * .55 }; };
const enemyChest = () => { const foot = enemyFoot(); return { x: foot.x, y: foot.y - enemyH() * .6 }; };

function guardGen(gen) { if (gen !== generation) throw CANCELLED; }
function wait(ms, gen) {
  return new Promise((resolve, reject) => setTimeout(() => (gen === generation ? resolve() : reject(CANCELLED)), ms));
}
async function animate(element, keyframes, options, gen) {
  const animation = element.animate(keyframes, { fill: 'forwards', ...options });
  await animation.finished.catch(() => {});
  guardGen(gen);
  return animation;
}
function svg(tag, attrs) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  fx.append(node);
  return node;
}
function fade(node, ms, delay = 0) {
  node.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, delay, fill: 'forwards' }).finished.then(() => node.remove(), () => node.remove());
}
function number(text, point, kind = '') {
  const node = document.createElement('div');
  node.className = `number ${kind}`;
  node.textContent = text;
  node.style.left = `${point.x}px`;
  node.style.top = `${point.y}px`;
  game.append(node);
  setTimeout(() => node.remove(), 950);
}
function banner(text, kind = '', point) {
  const node = $('#banner');
  node.className = 'banner';
  void node.offsetWidth;
  node.textContent = text;
  node.style.left = point ? `${Math.max(110, Math.min(game.clientWidth - 110, point.x))}px` : '';
  node.style.top = point ? `${point.y}px` : '';
  node.className = `banner show ${kind}`;
}
function shake(strength, gen) {
  if (reducedMotion) return Promise.resolve();
  const s = strength;
  return animate(world, [
    { transform: 'translate(0,0)' }, { transform: `translate(${-s}px,${s * .6}px)` }, { transform: `translate(${s * .8}px,${-s * .4}px)` },
    { transform: `translate(${-s * .5}px,${-s * .5}px)` }, { transform: 'translate(0,0)' },
  ], { duration: 220, fill: 'none' }, gen);
}

// ---------- Hero / enemy motion ----------
let heroOffset = { x: 0, y: 0 };
function walkFrames(on) {
  clearInterval(walkTimer);
  if (!on) { setHeroFrame(8); return; }
  const cycle = [9, 10, 11, 10];
  let index = 0;
  walkTimer = setInterval(() => setHeroFrame(cycle[index++ % cycle.length]), 70);
}
async function moveHero(to, ms, gen, easing = 'cubic-bezier(.3,.0,.2,1)') {
  const from = heroOffset;
  heroOffset = to;
  await animate(heroEl, [
    { transform: `translate(${from.x}px,${from.y}px)` },
    { transform: `translate(${to.x}px,${to.y}px)` },
  ], { duration: ms, easing }, gen);
}
async function dashIn(gen) {
  const hero = heroFoot();
  const enemy = enemyFoot();
  const target = { x: enemy.x - enemyH() * .42 - hero.x + heroOffset.x, y: enemy.y + 10 - hero.y + heroOffset.y };
  walkFrames(true);
  for (let i = 0; i < 3; i++) afterimage(i * 45);
  await moveHero(target, 230, gen);
  walkFrames(false);
}
async function dashOut(gen) {
  walkFrames(true);
  heroSprite.style.transform = 'scaleX(-1)';
  try { await moveHero({ x: 0, y: 0 }, 260, gen, 'ease-in-out'); }
  finally { heroSprite.style.transform = ''; walkFrames(false); }
}
function afterimage(delay) {
  setTimeout(() => {
    const ghost = heroSprite.cloneNode(true);
    ghost.removeAttribute('id');
    ghost.querySelector('[id]')?.removeAttribute('id');
    ghost.style.opacity = '.35';
    ghost.style.filter = 'brightness(2) sepia(1) hue-rotate(140deg)';
    heroEl.append(ghost);
    ghost.animate([{ opacity: .35 }, { opacity: 0 }], { duration: 260, fill: 'forwards' }).finished.then(() => ghost.remove());
  }, delay);
}
async function lean(element, degrees, ms, gen) {
  await animate(element, [{ transform: 'rotate(0deg)' }, { transform: `rotate(${degrees}deg)` }], { duration: ms, easing: 'ease-out', composite: 'add' }, gen);
}

// ---------- Timing check ----------
// The ring shrinks at a constant speed; overlapping the gold band when tapped is "perfect".
function timing(mode, gen) {
  const strike = mode === 'strike';
  const center = strike ? enemyChest() : heroChest();
  const unit = strike ? enemyH() / 262 : heroH() / 200;
  const start = 128 * unit;
  const end = 10 * unit;
  const target = (strike ? 44 : 50) * unit;
  const half = 11 * unit;
  const duration = ($('#assist').checked ? 1.7 : 1) * (strike ? 950 : 900);
  const color = strike ? '#f2c475' : '#ff7a62';
  const band = svg('circle', { cx: center.x, cy: center.y, r: target, fill: 'none', stroke: color, 'stroke-width': half * 2, opacity: .22 });
  const guide = svg('circle', { cx: center.x, cy: center.y, r: target, fill: 'none', stroke: color, 'stroke-width': 2, opacity: .9 });
  const ring = svg('circle', { cx: center.x, cy: center.y, r: start, fill: 'none', stroke: '#fff', 'stroke-width': 3 });
  showHint(strike ? '金圈重合时点击 · 会心' : '红圈收拢时点击 · 完美格挡', strike ? center.y + start + 8 : center.y - start - 40, !strike);
  game.classList.add('qte');
  $('#attack').classList.toggle('aiming', strike);
  return new Promise((resolve, reject) => {
    const begun = performance.now();
    let done = false;
    const radius = now => start + (end - start) * Math.min(1, (now - begun) / duration);
    const finish = grade => {
      if (done) return;
      done = true;
      window.removeEventListener('pointerdown', onTap, true);
      window.removeEventListener('keydown', onKey, true);
      game.classList.remove('qte');
      $('#attack').classList.remove('aiming');
      hideHint();
      window.__qte = { active: false, grade };
      ring.setAttribute('stroke', grade === 'perfect' ? color : '#888');
      [band, guide, ring].forEach(node => fade(node, 220));
      if (grade === 'perfect') burst(center, color, target);
      if (gen !== generation) reject(CANCELLED); else resolve(grade);
    };
    const onTap = event => {
      if (event.target.closest('.preview-tools, dialog')) return;
      event.preventDefault();
      const r = radius(performance.now());
      finish(Math.abs(r - target) <= half ? 'perfect' : 'normal');
    };
    const onKey = event => { if (event.code === 'Space' || event.code === 'KeyJ') onTap(event); };
    window.addEventListener('pointerdown', onTap, true);
    window.addEventListener('keydown', onKey, true);
    const frame = now => {
      if (done) return;
      if (gen !== generation) { finish('normal'); return; }
      const r = radius(now);
      ring.setAttribute('r', r);
      const inBand = Math.abs(r - target) <= half;
      guide.setAttribute('stroke-width', inBand ? 4 : 2);
      window.__qte = { active: true, mode, r, target, half, inBand };
      if (now - begun >= duration) finish('normal');
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}
function showHint(text, y, defend) {
  const hint = $('#qte-hint');
  hint.textContent = text;
  hint.style.top = `${Math.max(120, Math.min(y, game.clientHeight - 260))}px`;
  hint.classList.toggle('defend', defend);
  hint.classList.add('show');
}
function hideHint() { $('#qte-hint').classList.remove('show'); }

// ---------- Effects ----------
function burst(center, color, radius) {
  const ring = svg('circle', { cx: center.x, cy: center.y, r: radius * .6, fill: 'none', stroke: color, 'stroke-width': 6 });
  ring.animate([{ r: radius * .6, opacity: 1, strokeWidth: 6 }, { r: radius * 1.9, opacity: 0, strokeWidth: 1 }], { duration: 380, easing: 'ease-out', fill: 'forwards' })
    .finished.then(() => ring.remove(), () => ring.remove());
}
function sparks(center, color, count = 10, reach = 60) {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * .4;
    const length = reach * (.6 + Math.random() * .6);
    const line = svg('line', { x1: center.x, y1: center.y, x2: center.x, y2: center.y, stroke: color, 'stroke-width': 3, 'stroke-linecap': 'round' });
    const x = center.x + Math.cos(angle) * length;
    const y = center.y + Math.sin(angle) * length;
    line.animate([
      { x1: center.x, y1: center.y, x2: center.x, y2: center.y, opacity: 1 },
      { x1: center.x + (x - center.x) * .6, y1: center.y + (y - center.y) * .6, x2: x, y2: y, opacity: 0 },
    ], { duration: 360, easing: 'ease-out', fill: 'forwards' }).finished.then(() => line.remove(), () => line.remove());
  }
}
function slash(center, { color = '#f2c475', width = 9, size = 1, reverse = false } = {}) {
  const f = reverse ? -1 : 1;
  const d = `M ${center.x - 66 * size * f} ${center.y - 52 * size} Q ${center.x + 34 * size * f} ${center.y - 40 * size} ${center.x + 50 * size * f} ${center.y + 66 * size}`;
  const glow = svg('path', { d, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', opacity: .9 });
  const core = svg('path', { d, fill: 'none', stroke: '#fffbe8', 'stroke-width': width * .35, 'stroke-linecap': 'round' });
  [glow, core].forEach(path => {
    const length = path.getTotalLength();
    path.style.strokeDasharray = length;
    path.animate([{ strokeDashoffset: length }, { strokeDashoffset: 0 }], { duration: 110, easing: 'ease-out', fill: 'forwards' });
    fade(path, 260, 140);
  });
}
function shieldMark(center, color, perfect) {
  const r = heroH() * .3;
  const points = Array.from({ length: 6 }, (_, i) => {
    const angle = Math.PI / 6 + i * Math.PI / 3;
    return `${center.x + Math.cos(angle) * r},${center.y + Math.sin(angle) * r * 1.1}`;
  }).join(' ');
  const shield = svg('polygon', { points, fill: perfect ? '#bdf4ff33' : '#f2c47522', stroke: color, 'stroke-width': perfect ? 5 : 3 });
  fade(shield, 420, 200);
}
function claws(center) {
  for (let i = -1; i <= 1; i++) {
    const x = center.x + i * 16;
    const path = svg('path', { d: `M ${x + 18} ${center.y - 40} Q ${x + 4} ${center.y - 4} ${x - 16} ${center.y + 38}`, fill: 'none', stroke: '#ff5a43', 'stroke-width': 5, 'stroke-linecap': 'round' });
    const length = path.getTotalLength();
    path.style.strokeDasharray = length;
    path.animate([{ strokeDashoffset: length }, { strokeDashoffset: 0 }], { duration: 100, fill: 'forwards' });
    fade(path, 300, 140);
  }
}
async function projectile(from, to, color, gen) {
  const orb = svg('circle', { cx: from.x, cy: from.y, r: 10, fill: '#ffffff', stroke: color, 'stroke-width': 6 });
  const trail = svg('line', { x1: from.x, y1: from.y, x2: from.x, y2: from.y, stroke: color, 'stroke-width': 6, 'stroke-linecap': 'round', opacity: .6 });
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * 30;
    orb.setAttribute('cx', x); orb.setAttribute('cy', y);
    trail.setAttribute('x2', x); trail.setAttribute('y2', y);
    trail.setAttribute('x1', from.x + (x - from.x) * .55); trail.setAttribute('y1', from.y + (y - from.y) * .55);
    await wait(16, gen);
  }
  orb.remove(); fade(trail, 120);
}
function lightning(center) {
  const top = { x: center.x + 20, y: center.y - 260 };
  const points = [top];
  for (let i = 1; i < 6; i++) points.push({ x: center.x + (i % 2 ? -22 : 18) + Math.random() * 10, y: top.y + (center.y - top.y) * i / 6 });
  points.push(center);
  const d = points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
  const bolt = svg('path', { d, fill: 'none', stroke: '#ffe6a3', 'stroke-width': 7, 'stroke-linejoin': 'round' });
  const core = svg('path', { d, fill: 'none', stroke: '#fff', 'stroke-width': 2.5 });
  fade(bolt, 300, 80); fade(core, 300, 80);
}
function healMotes(center) {
  for (let i = 0; i < 10; i++) {
    const x = center.x + (i % 5 - 2) * 14;
    const mote = svg('circle', { cx: x, cy: center.y + 30, r: 3.5, fill: '#b6f2a8' });
    mote.animate([{ cy: center.y + 30, opacity: 0 }, { cy: center.y + 10, opacity: 1, offset: .25 }, { cy: center.y - 60 - (i % 3) * 14, opacity: 0 }],
      { duration: 640, delay: i * 30, fill: 'forwards' }).finished.then(() => mote.remove(), () => mote.remove());
  }
}

// ---------- Turn resolution ----------
async function perform(kind) {
  if (state.busy || state.ended) return;
  if (kind === 'attack' && state.focus >= 3) kind = 'weapon';
  if (kind === 'talisman' && state.talismans === 0) { openTalismanInfo(); return; }
  if (kind === 'pill' && (state.pills === 0 || state.hp >= MAX_HP)) return;
  if ((kind === 'mist' || kind === 'iron') && state.used.has(kind)) return;
  if (sheet.open) sheet.close();
  const gen = ++generation;
  const intent = enemyIntent();
  state.busy = true;
  render();
  try {
    if (kind === 'mist' || kind === 'iron') {
      await methodTechnique(kind, gen);
      return;
    }
    let grade = 'none';
    let dealt = 0;
    let dashed = false;
    if (OFFENSIVE.has(kind)) {
      if (kind === 'attack' || kind === 'weapon') { dashed = true; await dashIn(gen); }
      else await castCharge(kind, gen);
      // Only the weapon skill (a full focus gauge) earns a timing check; everything else strikes at once.
      if (kind === 'weapon') grade = await timing('strike', gen);
      dealt = await strike(kind, grade, gen);
    } else if (kind === 'guard') {
      shieldMark(heroChest(), '#f2c475', false);
      // Only a telegraphed heavy blow can be parried; an ordinary guard resolves immediately.
      if (intent.heavy) {
        enemyEl.classList.add('windup');
        lean(enemyEl, 4, 300, gen).catch(() => {});
        grade = await timing('parry', gen);
      }
    } else if (kind === 'pill') {
      await drinkPill(gen);
    }
    let taken = 0;
    if (state.enemyHp > 0) taken = await counterAttack(kind, grade, intent, gen);
    enemyEl.classList.remove('windup');
    enemyEl.getAnimations().forEach(animation => animation.cancel());
    if (dashed && state.enemyHp > 0) await dashOut(gen);
    const focusGain = kind === 'weapon' ? -state.focus
      : kind === 'guard' ? (intent.heavy ? 2 : 1) + (grade === 'perfect' ? 1 : 0)
        : 1;
    state.focus = Math.max(0, Math.min(3, state.focus + focusGain));
    state.turn++;
    report(kind, grade, dealt, taken, intent);
    if (state.enemyHp <= 0) await victory(gen);
    else if (state.hp <= 0) defeat();
  } catch (error) {
    if (error !== CANCELLED) { console.error(error); ticker('动作演示中断，请点击「重置」。'); }
    return;
  } finally {
    if (gen === generation) { state.busy = false; render(); }
  }
}

async function castCharge(kind, gen) {
  const color = kind === 'art' ? '#8fe0d2' : '#f2c475';
  const chest = heroChest();
  const rune = svg('circle', { cx: chest.x, cy: chest.y + heroH() * .5, r: heroH() * .3, fill: 'none', stroke: color, 'stroke-width': 2.5, 'stroke-dasharray': '6 5' });
  rune.setAttribute('transform', `translate(0 0)`);
  rune.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: 'forwards' });
  setTimeout(() => fade(rune, 200), 420);
  await lean(heroSprite, -4, 220, gen);
}

async function strike(kind, grade, gen) {
  const perfect = grade === 'perfect';
  const base = kind === 'art' && state.breath ? 32 : DAMAGE[kind];
  const damage = Math.min(state.enemyHp, perfect ? Math.round(base * CRIT_RATE) : base);
  const target = enemyChest();
  const color = kind === 'art' ? '#8fe0d2' : '#f2c475';
  heroSprite.getAnimations().forEach(animation => animation.cancel());
  if (kind === 'attack' || kind === 'weapon') {
    setHeroFrame(9);
    animate(heroSprite, [{ transform: 'rotate(0)' }, { transform: 'rotate(8deg) translateX(8px)' }, { transform: 'rotate(0)' }], { duration: 220, fill: 'none' }, gen).catch(() => {});
    slash(target, { color, size: kind === 'weapon' ? 1.25 : 1, width: kind === 'weapon' ? 13 : 9 });
    if (kind === 'weapon' || perfect) { await wait(80, gen); slash(target, { color: perfect ? '#ffd36b' : color, size: 1.15, width: 11, reverse: true }); }
  } else if (kind === 'art') {
    await projectile(heroChest(), target, color, gen);
  } else if (kind === 'talisman') {
    lightning(target);
  }
  // Impact: hit-stop, flash, shake, number.
  enemyEl.classList.add('flash');
  sparks(target, color, perfect ? 16 : 10, perfect ? 90 : 60);
  if (perfect) burst(target, '#ffd36b', 50);
  state.enemyHp -= damage;
  if (kind === 'art') state.breath = false;
  if (kind === 'talisman') state.talismans--;
  number(`${damage}`, { x: target.x, y: target.y - enemyH() * .2 }, perfect ? 'crit' : '');
  render();
  const stop = perfect ? 110 : 70;
  await wait(stop, gen);
  enemyEl.classList.remove('flash');
  const push = perfect ? 18 : 10;
  animate(enemyEl, [{ transform: 'translate(0,0)' }, { transform: `translate(${push}px,-2px)` }, { transform: 'translate(0,0)' }], { duration: 240, fill: 'none' }, gen).catch(() => {});
  await shake(perfect ? 9 : 5, gen);
  setHeroFrame(8);
  return damage;
}

async function counterAttack(kind, grade, intent, gen) {
  const guarding = kind === 'guard' || state.guarded;
  const perfect = kind === 'guard' && grade === 'perfect';
  const amount = perfect ? intent.perfect : guarding ? intent.guarded : intent.damage;
  const hero = heroFoot();
  const enemy = enemyFoot();
  // Enemy lunges toward the hero, strikes, and returns to its mark.
  enemyEl.classList.add('windup');
  if (grade === 'none') await wait(intent.heavy ? 260 : 160, gen);
  const reach = { x: hero.x + heroH() * .52 - enemy.x, y: hero.y - 10 - enemy.y };
  await animate(enemyEl, [{ transform: 'translate(0,0)' }, { transform: `translate(${reach.x}px,${reach.y}px)` }], { duration: 150, easing: 'ease-in' }, gen);
  const chest = heroChest();
  if (guarding) {
    shieldMark(chest, perfect ? '#bdf4ff' : '#f2c475', perfect);
    sparks(chest, perfect ? '#bdf4ff' : '#f2c475', perfect ? 14 : 8, perfect ? 80 : 50);
    if (perfect) { burst(chest, '#bdf4ff', 46); banner('完美格挡', 'parry', { x: chest.x + heroH() * .25, y: chest.y - heroH() * .75 }); }
  } else {
    claws(chest);
  }
  if (!perfect) heroEl.classList.add('hurt');
  state.hp = Math.max(0, state.hp - amount);
  if (kind === 'guard' || state.guarded) state.guarded = false;
  number(`${amount}`, { x: chest.x, y: chest.y - heroH() * .25 }, `hurt ${perfect ? 'small' : ''}`);
  render();
  await wait(perfect ? 120 : 80, gen);
  heroEl.classList.remove('hurt');
  const knock = perfect ? 0 : guarding ? -6 : -14;
  if (knock) animate(heroEl, [{ transform: `translate(${heroOffset.x}px,${heroOffset.y}px)` }, { transform: `translate(${heroOffset.x + knock}px,${heroOffset.y}px)` }, { transform: `translate(${heroOffset.x}px,${heroOffset.y}px)` }], { duration: 200, fill: 'none' }, gen).catch(() => {});
  await shake(intent.heavy && !perfect ? 8 : 4, gen);
  enemyEl.classList.remove('windup');
  await animate(enemyEl, [{ transform: `translate(${reach.x}px,${reach.y}px)` }, { transform: 'translate(0,0)' }], { duration: perfect ? 320 : 240, easing: 'ease-out' }, gen);
  enemyEl.getAnimations().forEach(animation => animation.cancel());
  return amount;
}

async function drinkPill(gen) {
  const heal = Math.min(36, MAX_HP - state.hp);
  const chest = heroChest();
  healMotes(chest);
  await wait(280, gen);
  state.hp += heal;
  state.pills--;
  number(`+${heal}`, { x: chest.x, y: chest.y - heroH() * .3 }, 'heal');
  render();
  await wait(260, gen);
}

async function methodTechnique(kind, gen) {
  const chest = heroChest();
  if (kind === 'mist') { sparks(chest, '#8fe0d2', 12, 50); burst(chest, '#8fe0d2', 40); state.breath = true; }
  else { shieldMark(chest, '#f2c475', false); burst(chest, '#f2c475', 46); state.guarded = true; }
  state.used.add(kind);
  ticker(`<em>${NAMES[kind]}</em> · ${kind === 'mist' ? '获得 1 层蓄息，下一次术法增伤' : '进入守势，本回合承伤按防御计算'} · 不耗回合`);
  await wait(420, gen);
}

function report(kind, grade, dealt, taken, intent) {
  const perfect = grade === 'perfect';
  const parts = [`第 ${state.turn - 1} 回合`];
  if (OFFENSIVE.has(kind)) parts.push(`${NAMES[kind]} ${perfect ? '<span class="crit">会心</span> ' : ''}<em>${dealt}</em>`);
  else if (kind === 'guard') parts.push(perfect ? '<span class="crit">完美格挡</span>' : '防御');
  else parts.push(NAMES[kind]);
  if (state.enemyHp > 0) parts.push(`<span class="hurt">${intent.heavy ? '重击' : '反击'} ${taken}</span>`);
  ticker(parts.join(' · '));
  state.log.unshift($('#ticker').textContent);
}

async function victory(gen) {
  state.ended = true;
  await animate(enemyEl, [{ opacity: 1, filter: 'brightness(1)' }, { opacity: 0, filter: 'brightness(3) blur(4px)' }], { duration: 520 }, gen);
  banner('胜利', 'victory');
  if (heroOffset.x || heroOffset.y) await dashOut(gen);
  ticker(`<em>${state.enemyName}</em> 已被击败。`);
  render();
  await wait(700, gen);
  outcome('战斗胜利', `${state.enemyName}已被击败。`);
}
function defeat() {
  state.ended = true;
  render();
  outcome('濒死回收', '生命归零。演示可重新开始。');
}

// ---------- Sheets ----------
function openSheet(title, hint = '') {
  $('#sheet-title').textContent = title;
  $('#sheet-hint').textContent = hint;
  $('#sheet-content').className = 'sheet-content';
  $('#sheet-content').innerHTML = '';
  $('#sheet-footer').innerHTML = '';
  if (!sheet.open) sheet.showModal();
}
function footButton(text, onClick, className = '') {
  const button = document.createElement('button');
  button.type = 'button'; button.textContent = text; button.className = className;
  button.addEventListener('click', onClick);
  $('#sheet-footer').append(button);
}
function card({ id, name, effect, timing, reason }) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'card'; button.disabled = Boolean(reason);
  button.innerHTML = `<strong>${name}</strong><p>${effect}</p><small>${reason || timing}</small>`;
  button.addEventListener('click', () => perform(id));
  $('#sheet-content').append(button);
}
function openGroup(group) {
  if (state.busy || state.ended) return;
  if (group === 'spells') {
    openSheet('法术', '点选即释放');
    $('#sheet-content').classList.add('cols');
    card({ id: 'art', name: '术法攻击', effect: `术法伤害 ${state.breath ? 32 : 24}`, timing: '1 回合 · 敌人反击' });
    card({ id: 'mist', name: '归息', effect: '获得 1 层蓄息', timing: '每场一次 · 不耗回合', reason: state.used.has('mist') ? '本场已使用' : '' });
    card({ id: 'iron', name: '镇岳', effect: '进入守势', timing: '每场一次 · 不耗回合', reason: state.used.has('iron') ? '本场已使用' : '' });
  } else {
    openSheet('药品', '点选即使用');
    card({ id: 'pill', name: `止血丹 ×${state.pills}`, effect: '回复 36 生命', timing: '1 回合 · 敌人反击', reason: state.pills === 0 ? '库存不足' : state.hp >= MAX_HP ? '生命已满' : '' });
  }
  footButton('返回战斗', () => sheet.close(), 'wide');
}
function openTalismanInfo() {
  openSheet('雷火符');
  $('#sheet-content').innerHTML = '<div class="info"><h2>雷火符</h2><p>落雷造成术法伤害。</p><p>本轮未携行雷火符，库存 0。</p></div>';
  footButton('返回战斗', () => sheet.close(), 'wide');
}
function openFlee() {
  if (state.busy || state.ended) return;
  openSheet('脱离战斗');
  $('#sheet-content').innerHTML = '<div class="info"><h2>脱离当前战斗</h2><p>退出当前遭遇，继续本轮探索。</p></div>';
  footButton('返回战斗', () => sheet.close());
  footButton('确认脱离', () => { sheet.close(); state.ended = true; render(); ticker('已脱离当前战斗。'); outcome('脱离战斗', '已脱离当前战斗。'); }, 'primary');
}
function openPanel(panel) {
  if (panel === 'menu') {
    openSheet('菜单');
    $('#sheet-content').innerHTML = `<div class="info"><h2>战斗记录</h2><ol>${state.log.length ? state.log.map(line => `<li>${line}</li>`).join('') : '<li>尚未采取行动。</li>'}</ol></div>
      <div class="info"><h2>时机操作</h2><p>只在两个关键时刻出现：战意攒满释放战技时，白圈与金圈重合点击打出会心（伤害 ×1.5）；敌人预告重击时按防御，红圈收拢点击完美格挡（承伤减半，战意额外 +1）。</p><p>普通攻击、普通防御、术法、符箓、药品都直接结算。不点或点偏按普通结算。</p></div>`;
  } else {
    openSheet('背包');
    $('#sheet-content').innerHTML = `<div class="info"><p>止血丹 × ${state.pills}</p><p>雷火符 × ${state.talismans}</p></div>`;
  }
  footButton('返回战斗', () => sheet.close(), 'wide');
}
function outcome(title, text) {
  openSheet(title);
  $('#sheet-content').innerHTML = `<div class="info"><h2>${title}</h2><p>${text}</p><ol>${state.log.slice(0, 5).map(line => `<li>${line}</li>`).join('')}</ol></div>`;
  footButton('重新演示', reset, 'primary wide');
}

// ---------- Wiring ----------
const SEGMENT = (index) => {
  const toPoint = deg => { const rad = (deg - 90) * Math.PI / 180; return `${50 + Math.cos(rad) * 46} ${50 + Math.sin(rad) * 46}`; };
  const from = index * 120 + 8;
  const to = (index + 1) * 120 - 8;
  return `M ${toPoint(from)} A 46 46 0 0 1 ${toPoint(to)}`;
};
document.querySelectorAll('.focus-ring .seg').forEach((seg, index) => seg.setAttribute('d', SEGMENT(index)));
$('#attack').addEventListener('click', () => perform('attack'));
document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => perform(button.dataset.action)));
document.querySelectorAll('[data-group]').forEach(button => button.addEventListener('click', () => openGroup(button.dataset.group)));
document.querySelectorAll('[data-panel]').forEach(button => button.addEventListener('click', () => openPanel(button.dataset.panel)));
$('#intent').addEventListener('click', () => {
  const intent = enemyIntent();
  openSheet('敌方意图');
  $('#sheet-content').innerHTML = `<div class="info"><h2>${intent.name}</h2><p>你的行动结束后，${state.enemyName}发动${intent.heavy ? '蓄力重击' : '常规反击'}：承伤 ${intent.damage}，防御 ${intent.guarded}，完美格挡 ${intent.perfect}。</p>${intent.heavy ? '<p>重击回合用防御应对，战意 +2。</p>' : ''}</div>`;
  footButton('返回战斗', () => sheet.close(), 'wide');
});
$('#flee').addEventListener('click', openFlee);
$('#close-sheet').addEventListener('click', () => sheet.close());
$('#scenario').addEventListener('change', reset);
$('#reset').addEventListener('click', reset);
window.addEventListener('keydown', event => {
  if (sheet.open || state.busy || event.target.matches('select,input')) return;
  if (event.code === 'KeyJ' || event.code === 'Space') { event.preventDefault(); perform('attack'); }
  if (event.code === 'KeyK') perform('guard');
});
window.addEventListener('resize', () => setHeroFrame(8));
reset();
