// Isolated combat v3 fixture: two sides face off; the enemy side holds a formation of up to five.
// No game runtime, saves, network calls, or persistence. Numbers only make the interface observable;
// the real game reads every outcome from the domain's frames. Today's rules have one enemy per fight:
// the multi-enemy scenarios only show how the layout scales.
const $ = selector => document.querySelector(selector);
const params = new URLSearchParams(location.search);
if (params.has('shot')) document.body.classList.add('shot');
for (const id of ['layout', 'scenario', 'skin']) if (params.get(id)) $(`#${id}`).value = params.get(id);

const ICONS = {
  bag: '<path d="M4 8h16v12H4ZM8 8V4h8v4M4 12h16M10 10h4v5h-4Z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
};
document.querySelectorAll('[data-icon]').forEach(node => { node.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[node.dataset.icon]}</svg>`; });
const RES = '../../cocos/assets/resources';

// Hero frames from cocos/assets/scripts/ui/hero-walk-atlas.ts (shared 336px canvas): row 0 faces the viewer, row 3 shows the back.
const ATLAS = { size: 1254, canvas: 336, footX: 168, footY: 320.16 };
const FRAMES = [
  [176, 8, 135, 306, 242, 311], [441, 10, 130, 305, 508, 313], [691, 9, 133, 306, 762, 314], [966, 10, 135, 305, 1034, 312],
  [175, 929, 139, 308, 243, 1233], [439, 929, 141, 309, 506, 1234], [693, 929, 146, 310, 762, 1235], [967, 929, 144, 309, 1034, 1235],
];
const BACK = [4, 5, 6, 7];
const FRONT = [0, 1, 2, 3];
const game = $('#game');
const field = $('#field');
const fx = $('#fx');
const heroEl = $('#hero');
const heroSprite = $('#hero-sprite');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
// `?slowmo` plays everything four times slower, to study the effects frame by frame.
const SLOW = params.has('slowmo') ? 4 : 1;

function setHeroFrame(index) {
  const [x, y, w, h, fx0, fy0] = FRAMES[index];
  const scale = heroSprite.clientWidth / ATLAS.canvas;
  const style = $('#hero-frame').style;
  style.width = `${w * scale}px`; style.height = `${h * scale}px`;
  style.left = `${(ATLAS.footX - (fx0 - x)) * scale}px`;
  style.top = `${(ATLAS.footY - (fy0 - y)) * scale}px`;
  style.backgroundSize = `${ATLAS.size * scale}px ${ATLAS.size * scale}px`;
  style.backgroundPosition = `${-x * scale}px ${-y * scale}px`;
}

// ---------- Formations (feet as fractions of the field) ----------
const LAYOUTS = {
  // Classic turn-based: the enemy side upper left, the party lower right, both lines running "/" and facing each other.
  diagonal: {
    single: [[.3, .46]],
    // Front row along "/", back row a step behind (up and left) between them.
    enemies: [[.17, .6], [.38, .48], [.59, .36], [.2, .42], [.41, .3]],
    hero: [.64, .84], companion: [.42, .92], pet: [.85, .74],
    intent: [.98, .5],
  },
  // Straight face-off: the enemy rows above, the party in a row below.
  vertical: {
    single: [[.5, .44]],
    enemies: [[.2, .48], [.5, .48], [.8, .48], [.35, .3], [.65, .3]],
    hero: [.5, .9], companion: [.22, .88], pet: [.78, .88],
    intent: [.98, .6],
  },
};

// ---------- Scenarios (demonstration values only) ----------
const ENEMY = {
  bailiff: { name: '悖论法警', rank: '◆', art: 'paradox-bailiff', hp: 196, scale: 1.15 },
  imp: { name: '火花小鬼', rank: '', art: 'spark-imp', hp: 60, scale: 1 },
  sentry: { name: '叛序哨兵', rank: '', art: 'rogue-sentry', hp: 80, scale: 1 },
  drone: { name: '相位猎机', rank: '', art: 'phase-hunter-drone', hp: 70, scale: 1 },
  scout: { name: '发条斥候', rank: '', art: 'clockwork-scout', hp: 60, scale: 1 },
};
const SCENARIOS = {
  elite: { enemies: ['bailiff'], heavy: false },
  three: { enemies: ['imp', 'bailiff', 'sentry'], heavy: false },
  five: { enemies: ['imp', 'bailiff', 'sentry', 'drone', 'scout'], heavy: false },
  heavy: { enemies: ['bailiff'], heavy: true },
  solo: { enemies: ['bailiff'], heavy: false, solo: true },
};
const INTENT_ICON = { claw: `${RES}/item/demon-bone-v1.png`, heavy: `${RES}/item/cracked-core-v1.png` };
// Commands and their in-game art. Quick slots show the real skills and items directly, like 梦幻's favourite skills.
const COMMANDS = {
  attack: { name: '攻击', art: 'run-relic/mist_edge-v1.png' },
  guard: { name: '防御', art: 'run-relic/iron_echo-v1.png' },
  escape: { name: '逃跑', art: 'run-relic/rift_step-v1.png' },
  art: { name: '术法', art: 'run-relic/focus_prism-v1.png', cost: 1, note: '耗 1 战意 · 术法伤害' },
  mist: { name: '吐纳诀', art: 'item/mist-breathing-v2.png', once: true, note: '回复少量生命 · 每场一次' },
  iron: { name: '铁衣诀', art: 'item/iron-body-v2.png', once: true, note: '本回合减伤并反震 · 每场一次' },
  pill: { name: '止血丹', art: 'item/healing-pill-v1.png', stock: true, note: '回复一半生命' },
  thunder: { name: '雷火符', art: 'item/thunder-talisman-v1.png', stock: true, note: '固定雷火伤害' },
};
const SPELLS = ['art', 'mist', 'iron'];
const ITEMS = ['pill', 'thunder'];
let state;
let generation = 0;
let auto = false;
const CANCELLED = Symbol('cancelled');

function reset() {
  generation += 1;
  const scenario = SCENARIOS[$('#scenario').value] ?? SCENARIOS.elite;
  const enemies = scenario.enemies.map((id, index) => ({ ...ENEMY[id], id: `${id}-${index}`, maxHp: ENEMY[id].hp, element: undefined }));
  state = {
    scenario, enemies, target: enemies.find(enemy => enemy.rank) ?? enemies[0],
    heroHp: 224, maxHp: 224, focus: Math.min(3, Math.max(0, Number(params.get('focus')) || 0)), turn: 1, busy: false, heavy: scenario.heavy,
    stock: { pill: 4, thunder: 3 }, used: { mist: false, iron: false },
  };
  game.classList.toggle('solo', scenario.solo === true);
  game.dataset.skin = $('#skin').value;
  const holder = $('#enemies');
  holder.innerHTML = '';
  for (const enemy of enemies) {
    const element = document.createElement('div');
    element.className = 'unit enemy';
    element.innerHTML = `<div class="plate"><div class="plate-line">${enemy.rank ? `<span class="rank">${enemy.rank}</span>` : ''}<strong>${enemy.rank ? '精英 · ' : ''}${enemy.name}</strong></div>`
      + `<div class="bar enemy-bar"><span class="lag"></span><span class="fill"></span></div></div>`
      + `<div class="ring"></div><img class="art enemy-art" src="${RES}/monster-world/${enemy.art}-world-v1.png" alt="${enemy.name}">`;
    // Tapping an enemy makes it the target and attacks it, as in classic turn-based battles.
    element.querySelector('.enemy-art').addEventListener('click', () => { if (enemy.hp > 0 && !state.busy) { state.target = enemy; paint(); takeTurn('attack'); } });
    holder.append(element);
    enemy.element = element;
  }
  ['hero', 'companion', 'pet'].forEach(id => { $(`#${id}`).style.translate = ''; });
  fx.innerHTML = ''; $('#numbers').innerHTML = '';
  vfx.clear();
  closeSheet();
  requestAnimationFrame(() => {
    renderDock();
    place();
    setHeroFrame(BACK[0]);
    paint();
  });
  ticker(enemies.length > 1 ? `${enemies.length} 个敌人出现；点哪个就打哪个。` : '悖论法警出现：先宣判结果再追认原因。');
}

function setFoot(element, [x, y]) { element.style.left = `${x}px`; element.style.top = `${y}px`; }
function place() {
  const layout = LAYOUTS[$('#layout').value] ?? LAYOUTS.diagonal;
  game.classList.toggle('diagonal', layout === LAYOUTS.diagonal);
  game.classList.toggle('vertical', layout === LAYOUTS.vertical);
  const W = field.clientWidth, H = field.clientHeight;
  // Smaller fighters leave room for a whole formation; a single elite stands a little taller.
  const base = Math.max(72, Math.min(140, H * .22));
  const heroH = Math.max(72, Math.min(116, H * .19));
  game.style.setProperty('--hero-h', `${heroH}px`);
  const slots = state.enemies.length === 1 ? layout.single : layout.enemies;
  // Back-row enemies stand a step farther away, so a touch smaller.
  state.enemies.forEach((enemy, index) => {
    const [x, y] = slots[index];
    const depth = index >= 3 ? .88 : 1;
    enemy.element.style.setProperty('--h', `${base * enemy.scale * depth}px`);
    enemy.element.style.zIndex = String(Math.round(y * 100));
    setFoot(enemy.element, [W * x, H * y]);
  });
  // The intent callout takes the open space on the right, between the two sides.
  const intent = $('#intent');
  intent.style.left = 'auto'; intent.style.right = `${W * (1 - layout.intent[0])}px`; intent.style.top = `${H * layout.intent[1] - intent.offsetHeight / 2}px`;
  setFoot(heroEl, [W * layout.hero[0], H * layout.hero[1]]);
  setFoot($('#companion'), [W * layout.companion[0], H * layout.companion[1]]);
  setFoot($('#pet'), [W * layout.pet[0], H * layout.pet[1]]);
  vfx.resize();
}

// ---------- The game's frame and glyphs (ported from cocos/assets/scripts/ui/dark-ui.ts) ----------
// paintDarkFrame: a cut-corner plate with a 2-unit edge, an inner hairline, a lit upper lip and a dark lower lip.
// One CSS px is about two design units at 390 wide, so the edge is 1px and the hairline half that.
const octagon = (x, y, w, h, c) => [[x + c, y], [x + w - c, y], [x + w, y + c], [x + w, y + h - c], [x + w - c, y + h], [x + c, y + h], [x, y + h - c], [x, y + c]]
  .map(point => point.map(value => value.toFixed(1)).join(',')).join(' ');
function frameSvg(w, h, { fill, edge, accent, cut = 6, glow }) {
  const c = Math.min(cut, w / 6, h / 6);
  const parts = [];
  if (glow) parts.push(`<rect x="-3" y="-3" width="${w + 6}" height="${h + 6}" fill="${glow}"/>`);
  parts.push(`<polygon points="${octagon(.5, .5, w - 1, h - 1, c)}" fill="${fill}" stroke="${edge}" stroke-width="1"/>`);
  parts.push(`<polygon points="${octagon(2.5, 2.5, w - 5, h - 5, Math.max(1, c - 1.5))}" fill="none" stroke="${accent}" stroke-opacity=".42" stroke-width=".6"/>`);
  parts.push(`<line x1="${c + 2}" y1="1.8" x2="${w - c - 2}" y2="1.8" stroke="${accent}" stroke-opacity=".66" stroke-width=".6"/>`);
  parts.push(`<line x1="${c + 2}" y1="${h - 1.8}" x2="${w - c - 2}" y2="${h - 1.8}" stroke="#07080a" stroke-opacity=".78" stroke-width=".6"/>`);
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${parts.join('')}</svg>`;
}
/** Paint (or repaint) a node's frame to its current size. */
function paintFrame(node, options) {
  let holder = node.querySelector(':scope > .frame');
  if (!holder) { holder = el('span', 'frame'); node.prepend(holder); }
  holder.innerHTML = frameSvg(node.offsetWidth, node.offsetHeight, options);
}
// The plate palettes: battle-scene.ts BATTLE for commands, dark-ui.ts ROOM_SHEET for the lit primary and the sheet.
const PLATE = {
  ready: { fill: 'rgba(40,31,20,.93)', edge: '#c6a36b', accent: '#f2c475' },
  recommended: { fill: 'rgba(96,64,24,.96)', edge: '#ffe0a0', accent: '#f2c475', glow: 'rgba(242,196,117,.27)' },
  muted: { fill: 'rgba(26,24,20,.89)', edge: '#564f3f', accent: '#564f3f' },
  primary: { fill: '#c4a05c', edge: '#ecce8c', accent: '#ffecbe' },
  primaryMuted: { fill: 'rgba(26,24,20,.89)', edge: '#564f3f', accent: '#564f3f' },
  sheet: { fill: 'rgba(28,23,17,.965)', edge: '#967648', accent: '#c9a86a', cut: 10 },
  bar: { fill: 'rgba(26,22,16,.94)', edge: '#c6a36b', accent: '#f2c475' },
};
// paintDarkIcon's glyphs, y flipped for SVG. A shape is an open polyline, or `{ closed, fill, points }`.
const GLYPHS = {
  sword: [{ closed: true, fill: true, points: [[-5, -9], [10, 19], [20, 24], [20, 12], [4, -13]] }, [[-14, -6], [8, -18]], [[-6, -12], [-14, -24]], [[-18, -21], [-10, -27]], [[1, -6], [15, 18]]],
  guard: [{ closed: true, fill: true, points: [[0, 24], [-21, 15], [-18, -9], [-10, -19], [0, -26], [10, -19], [18, -9], [21, 15]] }, [[0, 17], [0, -18]], [[-12, 8], [12, 8]]],
  arcane: [{ closed: true, points: [[0, 25], [18, 0], [0, -25], [-18, 0]] }, { closed: true, points: [[0, 15], [8, 0], [0, -15], [-8, 0]] }, [[-25, 0], [-20, 0]], [[20, 0], [25, 0]]],
  bag: [{ closed: true, fill: true, points: [[-18, 11], [-22, -18], [-15, -23], [15, -23], [22, -18], [18, 11]] }, [[-10, 11], [-10, 22], [10, 22], [10, 11]], [[-18, 9], [18, 9]],
    [[-18, -3], [-5, -6], [5, -6], [18, -3]], { closed: true, points: [[-3, -3], [-3, -12], [3, -12], [3, -3]] }],
  left: [[[7, 15], [-9, 0], [7, -15]], [[20, 0], [-8, 0]]],
};
function glyphSvg(kind) {
  const shapes = GLYPHS[kind].map(shape => {
    const { closed = false, fill = false, points } = Array.isArray(shape) ? { points: shape } : shape;
    const coordinates = points.map(point => point.join(',')).join(' ');
    return closed ? `<polygon points="${coordinates}"${fill ? ' fill="currentColor" fill-opacity=".125"' : ''}/>` : `<polyline points="${coordinates}"/>`;
  }).join('');
  return `<svg viewBox="-28 -28 56 56" aria-hidden="true"><g transform="scale(1,-1)" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round">${shapes}</g></svg>`;
}

// ---------- The dock: four commands; each skin arranges and dresses them differently (style.css) ----------
const dock = { buttons: new Map(), seams: [] };
function el(tag, className, html = '') { const node = document.createElement(tag); node.className = className; node.innerHTML = html; return node; }
const DOCK = [
  { id: 'spells', label: '法术', art: COMMANDS.art.art, icon: 'arcane' },
  { id: 'items', label: '道具', art: COMMANDS.pill.art, icon: 'bag' },
  { id: 'guard', label: '防御', art: COMMANDS.guard.art, icon: 'guard' },
  { id: 'attack', label: '攻击', art: COMMANDS.attack.art, icon: 'sword', primary: true },
];
// gold keeps the earlier round art buttons (size [390-class, 320-class], side margin). The others use the game's plates:
// `row` four equal plates, `wide` three compact plates and a wide attack, `rows` the room sheet with the attack as its
// full-width lit button, `tabs` one bar split into segments.
const SKINS = {
  gold: { size: [58, 50], pad: 10 },
  plates: { layout: 'row' },
  wide: { layout: 'wide' },
  sheet: { layout: 'rows' },
  tabs: { layout: 'tabs' },
};
function renderDock() {
  const body = $('#dock-body');
  body.innerHTML = '';
  dock.buttons.clear();
  dock.seams = [];
  const W = body.clientWidth, H = body.clientHeight;
  const compact = W <= 340;
  const skin = SKINS[$('#skin').value] ?? SKINS.gold;
  const nodes = DOCK.map(command => {
    const node = el('button', `cmd${command.primary ? ' primary' : ''}`,
      `<span class="face"><span class="art-box"><img src="${RES}/${command.art}" alt=""></span></span>`
      + (command.primary ? '<svg class="focus-ring" viewBox="0 0 100 100"></svg>' : '')
      + `<span class="icon">${glyphSvg(command.icon)}</span>`
      + `<span class="text"><span class="label">${command.label}</span><span class="sub"></span>${command.primary ? '<span class="pips"><i></i><i></i><i></i></span>' : ''}</span>`);
    node.type = 'button';
    node.dataset.id = command.id;
    node.addEventListener('click', () => (command.id === 'spells' || command.id === 'items' ? openSheet(command.id) : takeTurn(command.id)));
    dock.buttons.set(command.id, node);
    body.append(node);
    return node;
  });
  if (!skin.layout) {
    const S = skin.size[compact ? 1 : 0];
    nodes.forEach(node => node.style.setProperty('--size', `${node.classList.contains('primary') ? S + 6 : S}px`));
    layRow(nodes, W, H, skin.pad ?? 0);
  } else {
    const place = (node, x, y, w, h) => Object.assign(node.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
    const pad = compact ? 8 : 10, gap = compact ? 5 : 6;
    if (skin.layout === 'row') {
      const h = compact ? 50 : 56, w = (W - pad * 2 - gap * 3) / 4;
      nodes.forEach((node, index) => place(node, pad + index * (w + gap), H - 8 - h, w, h));
    } else if (skin.layout === 'wide') {
      const h = compact ? 52 : 58, small = compact ? 50 : 62, wide = W - pad * 2 - gap * 3 - small * 3;
      nodes.forEach((node, index) => place(node, pad + index * (small + gap), H - 8 - h, index === 3 ? wide : small, h));
    } else if (skin.layout === 'rows') {
      // Inside the sheet: three plates over the full-width lit attack, the way the room sheet ends in 「战斗」.
      const inset = 16, top = compact ? 8 : 10, h1 = compact ? 34 : 40, h2 = compact ? 38 : 44, w = (W - inset * 2 - gap * 2) / 3;
      nodes.forEach((node, index) => (index < 3 ? place(node, inset + index * (w + gap), top, w, h1) : place(node, inset, top + h1 + gap, W - inset * 2, h2)));
    } else {
      // One bar: the attack segment is half again as wide; seams divide the rest.
      const h = compact ? 52 : 58, bar = el('div', 'bar-frame'), unit = (W - pad * 2) / 4.5;
      place(bar, pad, H - 8 - h, W - pad * 2, h);
      bar.style.position = 'absolute';
      body.prepend(bar);
      dock.bar = bar;
      let x = pad;
      nodes.forEach((node, index) => {
        const w = index === 3 ? unit * 1.5 : unit;
        place(node, x, H - 8 - h, w, h);
        if (index > 0 && index < 3) { const seam = el('i', 'seam'); place(seam, x, H - 8 - h + 10, 1, h - 20); body.append(seam); }
        x += w;
      });
    }
  }
  const panel = $('#dock-panel');
  if (skin.layout === 'rows') paintFrame(panel, PLATE.sheet);
  $('#escape-mini').onclick = () => takeTurn('escape');
  $('#auto-mini').onclick = () => { auto = !auto; paint(); scheduleAuto(); };
}
/** gold: one row whose faces share one centre line, as low as the tallest button (face plus label) allows. */
function layRow(nodes, W, H, pad) {
  const boxes = nodes.map(node => {
    const face = node.querySelector('.face');
    const above = face.offsetTop + face.offsetHeight / 2;
    return { above, below: node.offsetHeight - above };
  });
  const cy = Math.min(...boxes.map(box => H - 4 - box.below));
  nodes.forEach((node, index) => {
    node.style.left = `${pad + (W - pad * 2) * (index + .5) / nodes.length - node.offsetWidth / 2}px`;
    node.style.top = `${cy - boxes[index].above}px`;
  });
}

function paint() {
  for (const enemy of state.enemies) {
    const ratio = `${100 * enemy.hp / enemy.maxHp}%`;
    enemy.element.querySelector('.fill').style.width = ratio;
    enemy.element.querySelector('.lag').style.width = ratio;
    enemy.element.classList.toggle('target', enemy === state.target && enemy.hp > 0 && state.enemies.length > 1);
  }
  const hp = `${100 * state.heroHp / state.maxHp}%`;
  $('#hud-hp').textContent = `${state.heroHp}/${state.maxHp}`;
  $('#hud-fill').style.width = hp; $('#hero-fill').style.width = hp;
  $('#turn').textContent = state.turn;
  const target = state.target;
  $('#intent').classList.toggle('danger', state.heavy);
  $('#intent-name').textContent = `${state.enemies.length > 1 ? `${target.name} · ` : ''}${state.heavy ? '蓄力重击' : '常规追击'}`;
  $('#intent-detail').textContent = state.heavy ? '重击 · 防御大减伤' : '行动后常规反击';
  $('#intent-icon').style.backgroundImage = `url('${state.heavy ? INTENT_ICON.heavy : INTENT_ICON.claw}')`;
  const over = state.enemies.every(enemy => enemy.hp <= 0);
  const locked = state.busy || over;
  const ready = state.focus >= 3;
  for (const [id, node] of dock.buttons) {
    node.disabled = locked;
    node.querySelector('.chip')?.remove();
    node.classList.toggle('recommended', id === 'guard' && state.heavy && !locked);
    if (id === 'guard' && state.heavy) node.append(el('span', 'chip', '可格挡'));
  }
  // Captions read the same demo state as the lists; narrow plates get the short form.
  const skin = SKINS[$('#skin').value] ?? SKINS.gold;
  const roomy = skin.layout === 'wide' || skin.layout === 'rows';
  const usable = id => { const command = COMMANDS[id]; return !((command.cost && state.focus < command.cost) || (command.once && state.used[id]) || (command.stock && state.stock[id] <= 0)); };
  const subs = {
    spells: `${SPELLS.filter(usable).length} 种可用`,
    items: `${ITEMS.filter(usable).length} 种可用`,
    guard: state.heavy ? (roomy ? '可格挡重击' : '可格挡') : roomy ? '本回合减伤' : '减伤',
  };
  for (const [id, text] of Object.entries(subs)) { const sub = dock.buttons.get(id)?.querySelector('.sub'); if (sub) sub.textContent = text; }
  const attack = dock.buttons.get('attack');
  if (attack) {
    attack.classList.toggle('ready', ready && !locked);
    attack.querySelector('.label').textContent = ready ? '战技' : '攻击';
    attack.querySelectorAll('.pips i').forEach((pip, index) => pip.classList.toggle('on', index < state.focus));
    attack.querySelector('.sub').textContent = ready ? '战意已满' : roomy ? `普攻 · 战意 ${state.focus}/3` : '普攻';
    const ring = attack.querySelector('svg.focus-ring');
    if (ring) {
      const point = deg => [50 + 47 * Math.cos(deg * Math.PI / 180), 50 + 47 * Math.sin(deg * Math.PI / 180)];
      ring.innerHTML = [0, 1, 2].map(index => {
        const from = -90 + index * 120 + 8, to = from + 104;
        const [x0, y0] = point(from), [x1, y1] = point(to);
        const on = index < state.focus;
        return `<path d="M${x0} ${y0}A47 47 0 0 1 ${x1} ${y1}" fill="none" stroke="${on ? '#f2d49a' : '#3e3020'}" stroke-width="5" stroke-linecap="round"${on ? ' style="filter:drop-shadow(0 0 3px #f2d49a)"' : ''}/>`;
      }).join('');
    }
  }
  // The plates: the lit attack like 「战斗」, the recommended plate brightened as in battle-scene.ts, all muted while busy.
  if (skin.layout) {
    const tabs = skin.layout === 'tabs';
    if (tabs && dock.bar) paintFrame(dock.bar, PLATE.bar);
    for (const [id, node] of dock.buttons) {
      const primary = id === 'attack';
      const look = locked ? (primary ? PLATE.primaryMuted : PLATE.muted) : primary ? PLATE.primary : node.classList.contains('recommended') ? PLATE.recommended : PLATE.ready;
      // In the bar only the lit and the recommended segments get their own plate.
      if (tabs && !primary && !node.classList.contains('recommended')) node.querySelector(':scope > .frame')?.remove();
      else paintFrame(node, look);
    }
  }
  $('#auto-mini').setAttribute('aria-pressed', String(auto));
  $('#auto-mini').lastChild.textContent = auto ? '自动中' : '自动';
  $('#escape-mini').disabled = locked;
  paintFrame($('#escape-mini'), locked ? PLATE.muted : { ...PLATE.ready, cut: 4 });
  paintFrame($('#auto-mini'), auto ? { ...PLATE.primary, cut: 4 } : { ...PLATE.ready, cut: 4 });
}
function ticker(text) { $('#ticker').textContent = text; }

// ---------- VFX: a glowing particle canvas over the whole screen ----------
const vfx = (() => {
  const canvas = $('#vfx');
  const ctx = canvas.getContext('2d');
  let particles = [], shapes = [], frozenUntil = 0, last = 0, running = false;
  const glowCache = new Map();
  const dpr = Math.min(2, devicePixelRatio || 1);
  /** A soft glow dot, pre-rendered once per colour, drawn additively. */
  function glow(color) {
    if (glowCache.has(color)) return glowCache.get(color);
    const size = 64, c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d'), grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(.18, color); grad.addColorStop(1, '#0000');
    g.fillStyle = grad; g.fillRect(0, 0, size, size);
    glowCache.set(color, c);
    return c;
  }
  function resize() {
    canvas.width = game.clientWidth * dpr; canvas.height = game.clientHeight * dpr;
  }
  function start() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } }
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000) / SLOW; last = now;
    const step = now < frozenUntil ? 0 : dt;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'lighter';
    shapes = shapes.filter(shape => (shape.t += step) < shape.life);
    for (const shape of shapes) shape.draw(ctx, shape.t / shape.life, shape);
    particles = particles.filter(p => (p.t += step) < p.life);
    for (const p of particles) {
      p.vx *= Math.pow(p.drag, step * 60); p.vy = p.vy * Math.pow(p.drag, step * 60) + p.gravity * step;
      p.x += p.vx * step; p.y += p.vy * step;
      const k = 1 - p.t / p.life;
      const size = p.size * (p.shrink ? k : 1);
      if (p.streak) {
        ctx.strokeStyle = p.color; ctx.globalAlpha = k; ctx.lineWidth = size * .35; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .035, p.y - p.vy * .035); ctx.stroke();
      }
      ctx.globalAlpha = k;
      ctx.drawImage(glow(p.color), p.x - size, p.y - size, size * 2, size * 2);
    }
    ctx.globalAlpha = 1;
    if (particles.length || shapes.length) requestAnimationFrame(frame);
    else { running = false; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }
  const api = {
    resize,
    clear() { particles = []; shapes = []; },
    freeze(ms) { frozenUntil = performance.now() + (reducedMotion ? 0 : ms * SLOW); },
    burst(x, y, { color = '#ffcf6a', count = 24, speed = 320, life = .5, size = 6, gravity = 260, drag = .92, streak = true } = {}) {
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + (i % 3) * .37;
        const v = speed * (.45 + ((i * 37) % 10) / 16);
        particles.push({ x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v - speed * .15, t: 0, life: life * (.6 + ((i * 13) % 10) / 22), size: size * (.6 + (i % 4) * .2), color, gravity, drag, streak, shrink: true });
      }
      start();
    },
    rise(x, y, { color = '#9fe68e', count = 16, spread = 40, life = .9, size = 7 } = {}) {
      for (let i = 0; i < count; i++) {
        particles.push({ x: x + ((i * 29) % spread) - spread / 2, y: y + ((i * 17) % 20), vx: 0, vy: -60 - (i % 5) * 18, t: 0, life: life * (.6 + (i % 4) * .15), size, color, gravity: -20, drag: .98, streak: false, shrink: true });
      }
      start();
    },
    flash(x, y, { radius = 70, color = '#ffe7a8', life = .22 } = {}) {
      shapes.push({ t: 0, life, draw(c, k) {
        const r = radius * (.4 + k * .9);
        c.globalAlpha = 1 - k;
        c.drawImage(glow(color), x - r, y - r, r * 2, r * 2);
      } });
      start();
    },
    shockwave(x, y, { radius = 80, color = '#ffd36a', life = .35, width = 4, flat = 1 } = {}) {
      shapes.push({ t: 0, life, draw(c, k) {
        c.globalAlpha = (1 - k) * .7; c.strokeStyle = color; c.lineWidth = width * (1 - k * .8);
        c.shadowColor = color; c.shadowBlur = 14;
        c.beginPath(); c.ellipse(x, y, radius * (.2 + k), radius * (.2 + k) * flat, 0, 0, Math.PI * 2); c.stroke();
        c.shadowBlur = 0;
      } });
      start();
    },
    /** A tapered crescent swept across the target: thick in the middle, sharp at both tips, with a white-hot core. */
    crescent(x, y, { radius = 60, angle = -.6, arc = 2.2, thickness = 16, color = '#ffc24a', life = .32, flip = false } = {}) {
      shapes.push({ t: 0, life, draw(c, k) {
        const sweep = Math.min(1, k / .35);
        const fade = k < .35 ? 1 : 1 - (k - .35) / .65;
        const dir = flip ? -1 : 1;
        const a0 = angle - dir * arc / 2, a1 = a0 + dir * arc * sweep;
        const steps = 24;
        const edge = (inner) => Array.from({ length: steps + 1 }, (_, i) => {
          const t = i / steps, a = a0 + (a1 - a0) * t;
          const w = Math.sin(t * Math.PI) * thickness * (inner ? 0 : 1);
          const r = radius + (inner ? -thickness * .25 : 0) + w * .5;
          return [x + Math.cos(a) * r, y + Math.sin(a) * r];
        });
        const outer = edge(false), inner = edge(true).reverse();
        // Glowing body: clear at the inner edge, the colour through the middle, white-hot along the cutting edge.
        const body = c.createRadialGradient(x, y, Math.max(1, radius - thickness * .4), x, y, radius + thickness * .7);
        body.addColorStop(0, '#0000'); body.addColorStop(.4, `${color}88`); body.addColorStop(.78, color); body.addColorStop(.92, '#fffbe8'); body.addColorStop(1, '#0000');
        c.globalAlpha = fade;
        c.fillStyle = body;
        c.beginPath(); [...outer, ...inner].forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.closePath(); c.fill();
        // Motion streaks trail the swing just inside the blade's path.
        c.lineCap = 'round';
        for (const [shrink, alpha, width] of [[.82, .45, 2], [.68, .3, 1.5], [.55, .18, 1]]) {
          c.globalAlpha = fade * alpha; c.strokeStyle = color; c.lineWidth = width;
          c.beginPath(); c.arc(x, y, radius * shrink, Math.min(a0, a1) + .15, Math.max(a0, a1) - .1); c.stroke();
        }
        c.globalAlpha = fade * .95;
        c.strokeStyle = '#fffbe8'; c.lineWidth = 2; c.shadowColor = color; c.shadowBlur = 10;
        c.beginPath(); outer.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.stroke();
        c.shadowBlur = 0;
      } });
      start();
    },
    /** A jagged bolt from the top of the screen to the target. */
    bolt(x, y, { color = '#ffd36a', life = .4 } = {}) {
      const points = [[x + 18, 0]];
      for (let i = 1; i < 8; i++) points.push([x + (i % 2 ? -20 : 16) + (i * 7 % 9), y * i / 8]);
      points.push([x, y]);
      shapes.push({ t: 0, life, draw(c, k) {
        c.globalAlpha = k < .15 ? 1 : 1 - (k - .15) / .85;
        for (const [w, col] of [[14, color], [4, '#ffffff']]) {
          c.strokeStyle = col; c.lineWidth = w; c.shadowColor = color; c.shadowBlur = 20; c.lineJoin = 'round';
          c.beginPath(); points.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.stroke();
        }
        c.shadowBlur = 0;
      } });
      start();
    },
    /** A glowing orb flying on an arc with a continuous tapering tail. */
    comet(from, to, { color = '#8fe0d2', life = .32, lift = 30 } = {}) {
      const at = t => [from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * lift];
      shapes.push({ t: 0, life, draw(c, k) {
        const head = Math.min(1, k * 1.05);
        const tail = Math.max(0, head - .38);
        const steps = 14;
        c.lineCap = 'round';
        for (let i = 0; i < steps; i++) {
          const t0 = tail + (head - tail) * i / steps, t1 = tail + (head - tail) * (i + 1) / steps;
          const [x0, y0] = at(t0), [x1, y1] = at(t1);
          c.globalAlpha = (i + 1) / steps; c.strokeStyle = color; c.lineWidth = 2 + 10 * (i + 1) / steps;
          c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
        }
        const [hx, hy] = at(head);
        c.globalAlpha = 1;
        c.drawImage(glow(color), hx - 26, hy - 26, 52, 52);
        c.drawImage(glow('#ffffff'), hx - 10, hy - 10, 20, 20);
      } });
      start();
    },
    /** Rotating rune circles where a spell lands. */
    runes(x, y, { radius = 46, color = '#8fe0d2', life = .6 } = {}) {
      shapes.push({ t: 0, life, draw(c, k) {
        c.globalAlpha = 1 - k; c.strokeStyle = color; c.shadowColor = color; c.shadowBlur = 12;
        for (const [r, w, dash, spin] of [[radius, 2.5, [6, 6], 1], [radius * .72, 1.5, [2, 5], -1.6]]) {
          c.lineWidth = w; c.setLineDash(dash); c.lineDashOffset = k * 60 * spin;
          c.beginPath(); c.ellipse(x, y, r * (.8 + k * .3), r * (.8 + k * .3) * .55, 0, 0, Math.PI * 2); c.stroke();
        }
        c.setLineDash([]); c.shadowBlur = 0;
      } });
      start();
    },
    /** A hexagonal ward in front of the hero. */
    ward(x, y, { radius = 40, color = '#ffd36a', life = .5 } = {}) {
      shapes.push({ t: 0, life, draw(c, k) {
        c.globalAlpha = (k < .2 ? k / .2 : 1 - (k - .2) / .8) * .9; c.strokeStyle = color; c.lineWidth = 3; c.shadowColor = color; c.shadowBlur = 16;
        c.fillStyle = `${color}22`;
        c.beginPath();
        for (let i = 0; i <= 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; const px = x + Math.cos(a) * radius, py = y + Math.sin(a) * radius * 1.1; i ? c.lineTo(px, py) : c.moveTo(px, py); }
        c.fill(); c.stroke(); c.shadowBlur = 0;
      } });
      start();
    },
  };
  return api;
})();

// ---------- Geometry and timing helpers (game-local pixels) ----------
function foot(element) {
  const box = game.getBoundingClientRect();
  const rect = element.getBoundingClientRect();
  return { x: rect.left - box.left + rect.width / 2, y: rect.top - box.top + rect.height / 2 };
}
const heroH = () => heroSprite.clientWidth * 308 / 336;
const heightOf = enemy => parseFloat(enemy.element.style.getPropertyValue('--h'));
const chest = (element, height) => { const point = foot(element); return { x: point.x, y: point.y - height * .55 }; };
function guardGen(gen) { if (gen !== generation) throw CANCELLED; }
const wait = (ms, gen) => new Promise((resolve, reject) => setTimeout(() => (gen === generation ? resolve() : reject(CANCELLED)), reducedMotion ? 1 : ms * SLOW));
async function move(element, to, ms, gen, easing = 'cubic-bezier(.35,0,.25,1)') {
  const from = element.style.translate || '0px 0px';
  const target = `${to.x}px ${to.y}px`;
  const animation = element.animate([{ translate: from }, { translate: target }], { duration: reducedMotion ? 1 : ms * SLOW, easing, fill: 'forwards' });
  await animation.finished.catch(() => {});
  guardGen(gen);
  element.style.translate = target;
  animation.cancel();
}
function svg(tag, attrs) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  fx.append(node);
  return node;
}
function number(text, point, kind = '', tag = '') {
  const node = document.createElement('div');
  node.className = `num ${kind}`;
  node.innerHTML = `${text}${tag ? `<span class="tag-skill">${tag}</span>` : ''}`;
  node.style.left = `${point.x}px`; node.style.top = `${point.y}px`;
  $('#numbers').append(node);
  node.animate([
    { transform: 'translate(-50%,-50%) scale(2)', opacity: 0 },
    { transform: 'translate(-50%,-50%) scale(.88)', opacity: 1, offset: .1 },
    { transform: 'translate(-50%,-58%) scale(1.04)', opacity: 1, offset: .2 },
    { transform: 'translate(-50%,-62%) scale(1)', opacity: 1, offset: .55 },
    { transform: 'translate(-50%,-150%) scale(1)', opacity: 0 },
  ], { duration: (kind === 'note' ? 800 : 1100) * SLOW, easing: 'ease-out', fill: 'forwards' }).finished.then(() => node.remove());
}
function banner(text) {
  const node = $('#banner');
  const box = game.getBoundingClientRect(), area = field.getBoundingClientRect();
  node.style.top = `${area.top - box.top + area.height * .62}px`;
  node.className = 'banner'; void node.offsetWidth;
  node.textContent = text; node.className = 'banner show';
}
function shake(strength) {
  if (reducedMotion) return;
  game.animate([{ translate: '0 0' }, { translate: `${-strength}px ${strength * .6}px` }, { translate: `${strength * .8}px ${-strength * .4}px` }, { translate: `${-strength * .4}px ${strength * .3}px` }, { translate: '0 0' }], { duration: 260 * SLOW });
}
/** The camera leans in toward the blow for a beat. */
function punch(point, strength) {
  if (reducedMotion) return;
  const box = field.getBoundingClientRect(), gbox = game.getBoundingClientRect();
  field.style.transformOrigin = `${point.x - (box.left - gbox.left)}px ${point.y - (box.top - gbox.top)}px`;
  field.animate([{ scale: '1' }, { scale: `${1 + strength}` }, { scale: '1' }], { duration: 260 * SLOW, easing: 'ease-out' });
}
function screenFlash(point, red = false) {
  const node = $('#screen-flash');
  node.className = `screen-flash${red ? ' red' : ''}`;
  node.style.setProperty('--fx', `${point.x}px`); node.style.setProperty('--fy', `${point.y}px`);
  node.animate([{ opacity: red ? .9 : .55 }, { opacity: 0 }], { duration: (red ? 380 : 220) * SLOW, easing: 'ease-out' });
}
function flash(element, cls, ms) { element.classList.add(cls); setTimeout(() => element.classList.remove(cls), ms * SLOW); }
/** Fading copies of a runner, left behind along its path. */
function afterimages(element, ms, gen) {
  const timer = setInterval(() => {
    if (gen !== generation) { clearInterval(timer); return; }
    const ghost = element.cloneNode(true);
    ghost.removeAttribute('id'); ghost.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
    ghost.classList.add('ghost');
    if (element.classList.contains('enemy')) ghost.classList.add('foe');
    ghost.style.translate = getComputedStyle(element).translate;
    field.append(ghost);
    ghost.animate([{ opacity: .4 }, { opacity: 0 }], { duration: 240 * SLOW, fill: 'forwards' }).finished.then(() => ghost.remove());
  }, 55 * SLOW);
  setTimeout(() => clearInterval(timer), ms * SLOW);
}
/** The hit itself: freeze a beat, flash the target white, jolt it back and tilt it, shake and lean the camera in. */
async function impact(enemy, point, { strong = false, color = '#ffc24a', gen }) {
  vfx.freeze(strong ? 110 : 70);
  vfx.flash(point.x, point.y, { radius: strong ? 110 : 76, color });
  vfx.shockwave(point.x, point.y + heightOf(enemy) * .45, { radius: strong ? 90 : 60, color, flat: .35 });
  vfx.burst(point.x, point.y, { color, count: strong ? 36 : 24, speed: strong ? 420 : 320 });
  vfx.burst(point.x, point.y, { color: '#fff4d6', count: 10, speed: 220, size: 4, life: .3 });
  flash(enemy.element, 'flash', 90); setTimeout(() => flash(enemy.element, 'hurt', 180), 90);
  if (strong) screenFlash(point);
  shake(strong ? 9 : 5);
  punch(point, strong ? .045 : .025);
  enemy.element.animate([{ rotate: '0deg' }, { rotate: '6deg' }, { rotate: '0deg' }], { duration: 300 * SLOW, easing: 'ease-out' });
  await wait(strong ? 110 : 70, gen);
  await knock(enemy.element, { x: -8, y: -14 }, gen);
}

// ---------- One turn: player, allies, then each living enemy ----------
let walkTimer;
function stride(frames) {
  clearInterval(walkTimer);
  if (frames === undefined) { setHeroFrame(BACK[0]); return; }
  let index = 0;
  walkTimer = setInterval(() => setHeroFrame(frames[index++ % frames.length]), 70 * SLOW);
}
const alive = () => state.enemies.filter(enemy => enemy.hp > 0);
/** The offset that brings a unit to just in front of an enemy. */
function approach(element, enemy, height) {
  const from = foot(element), to = foot(enemy.element);
  const gap = heightOf(enemy) * .16 + height * .12;
  const length = Math.max(1, Math.hypot(to.x - from.x, to.y - from.y));
  return { x: to.x - from.x - (to.x - from.x) / length * gap, y: to.y - from.y - (to.y - from.y) / length * gap };
}
async function knock(element, offset, gen) {
  await move(element, offset, 90, gen, 'ease-out');
  await move(element, { x: 0, y: 0 }, 170, gen);
}
function hurtEnemy(enemy, damage) {
  enemy.hp = Math.max(0, enemy.hp - damage);
  if (enemy.hp <= 0) {
    enemy.element.classList.add('defeated');
    const at = chest(enemy.element, heightOf(enemy));
    vfx.burst(at.x, at.y, { color: '#8a7a6a', count: 26, speed: 160, gravity: -40, life: .9, size: 9, streak: false });
    vfx.rise(at.x, at.y + 20, { color: '#6a5a4a', count: 18, spread: 60, size: 10 });
    if (state.target === enemy) state.target = alive()[0] ?? enemy;
  }
  paint();
}
async function heroStrike(kind, gen) {
  const enemy = state.target;
  const strong = kind === 'weapon';
  stride(BACK);
  await move(heroEl, { x: 0, y: 8 }, 90, gen);
  afterimages(heroEl, 240, gen);
  await move(heroEl, approach(heroEl, enemy, heroH()), 250, gen);
  stride();
  const hit = chest(enemy.element, heightOf(enemy));
  const radius = heightOf(enemy) * .46;
  vfx.crescent(hit.x, hit.y, { radius, angle: -.7, thickness: strong ? 32 : 24 });
  if (strong) {
    setTimeout(() => vfx.crescent(hit.x, hit.y, { radius: radius * 1.1, angle: 2.4, thickness: 28, color: '#ffe08a', flip: true }), 80 * SLOW);
    vfx.shockwave(hit.x, hit.y + heightOf(enemy) * .45, { radius: 140, color: '#ffd36a', flat: .3, width: 8, life: .5 });
  }
  const damage = strong ? 142 : enemy.rank ? 83 : 46;
  number(`−${damage}`, { x: hit.x, y: hit.y - 18 }, strong ? 'big' : '', strong ? '战技' : '');
  await impact(enemy, hit, { strong, gen });
  hurtEnemy(enemy, damage);
  // Turn and run straight back to the spot.
  stride(FRONT);
  await move(heroEl, { x: 0, y: 0 }, 230, gen);
  stride();
  return damage;
}
async function castArt(gen) {
  const enemy = state.target;
  const from = chest(heroEl, heroH()), to = chest(enemy.element, heightOf(enemy));
  vfx.runes(from.x, from.y + heroH() * .5, { radius: 36 });
  await wait(220, gen);
  // An orb with a trailing light, then runes and a burst where it lands.
  vfx.comet(from, to, { life: .3 });
  await wait(300, gen);
  vfx.runes(to.x, to.y, { radius: 52 });
  vfx.burst(to.x, to.y, { color: '#8fe0d2', count: 30, speed: 300 });
  number('−96', { x: to.x, y: to.y - 18 });
  await impact(enemy, to, { color: '#8fe0d2', gen });
  hurtEnemy(enemy, 96);
}
async function thunder(gen) {
  const enemy = state.target;
  const to = chest(enemy.element, heightOf(enemy));
  vfx.bolt(to.x, to.y);
  screenFlash(to);
  vfx.burst(to.x, to.y, { color: '#ff9a3a', count: 30, speed: 340 });
  vfx.rise(to.x, to.y + 20, { color: '#ff7a2a', count: 14, spread: 50 });
  number('−120', { x: to.x, y: to.y - 18 }, 'big');
  await impact(enemy, to, { strong: true, color: '#ffb24a', gen });
  hurtEnemy(enemy, 120);
}
async function companionStrike(gen) {
  const companion = $('#companion');
  const enemy = state.target;
  if (game.classList.contains('solo') || enemy.hp <= 0) return 0;
  $('#card-companion')?.classList.add('acting');
  afterimages(companion, 220, gen);
  await move(companion, approach(companion, enemy, heroH()), 230, gen);
  const hit = chest(enemy.element, heightOf(enemy));
  vfx.crescent(hit.x, hit.y, { radius: heightOf(enemy) * .36, angle: 2.4, thickness: 12, color: '#ffd88a', flip: true });
  number('−9', { x: hit.x - 40, y: hit.y }, 'small');
  await impact(enemy, hit, { gen });
  hurtEnemy(enemy, 9);
  await move(companion, { x: 0, y: 0 }, 220, gen);
  $('#card-companion')?.classList.remove('acting');
  return 9;
}
async function petSupport(gen) {
  const pet = $('#pet');
  if (game.classList.contains('solo')) return;
  $('#card-pet')?.classList.add('acting');
  await move(pet, { x: 0, y: -14 }, 120, gen, 'ease-out');
  const point = chest(pet, heroH() * .5);
  vfx.shockwave(point.x, point.y + heroH() * .25, { radius: 36, color: '#9fe68e', flat: .35 });
  vfx.rise(point.x, point.y, { color: '#9fe68e', count: 10, spread: 30 });
  number('助攻 +12%', { x: point.x, y: point.y - 26 }, 'note');
  await move(pet, { x: 0, y: 0 }, 140, gen);
  $('#card-pet')?.classList.remove('acting');
}
async function enemyCounter(enemy, guarded, gen) {
  const heavy = state.heavy && enemy === state.target;
  enemy.element.classList.add('windup');
  await wait(heavy ? 300 : 120, gen);
  enemy.element.classList.remove('windup');
  // The enemy charges over to the hero, strikes, and walks back to its slot.
  const from = foot(enemy.element), to = foot(heroEl);
  const length = Math.max(1, Math.hypot(to.x - from.x, to.y - from.y));
  const stop = heroH() * .4;
  const reach = { x: (to.x - from.x) * (1 - stop / length), y: (to.y - from.y) * (1 - stop / length) };
  afterimages(enemy.element, 200, gen);
  await move(enemy.element, reach, heavy ? 220 : 240, gen);
  const hit = chest(heroEl, heroH());
  const damage = guarded ? (heavy ? 9 : 4) : heavy ? 38 : enemy.rank ? 12 : 6;
  // Three red tears across the hero; a guard throws up a golden ward instead.
  for (let i = -1; i <= 1; i++) setTimeout(() => vfx.crescent(hit.x + i * 14, hit.y, { radius: heroH() * .34, angle: .9, arc: 1.4, thickness: heavy ? 12 : 8, color: '#ff4a2a', life: .28 }), (i + 1) * 40 * SLOW);
  vfx.freeze(heavy ? 100 : 60);
  if (guarded) { vfx.ward(hit.x, hit.y, { radius: heroH() * .38 }); number('格挡', { x: hit.x, y: hit.y - 60 }, 'note'); }
  else { flash(heroEl, 'hurt', 200); screenFlash(hit, true); }
  vfx.burst(hit.x, hit.y, { color: '#ff5a3a', count: heavy ? 28 : 16, speed: 260 });
  shake(heavy ? 11 : 6);
  number(`−${damage}`, { x: hit.x, y: hit.y - 18 }, 'hurt');
  state.heroHp = Math.max(1, state.heroHp - damage);
  paint();
  await move(heroEl, { x: 6, y: 10 }, 90, gen, 'ease-out');
  await move(heroEl, { x: 0, y: 0 }, 150, gen);
  await move(enemy.element, { x: 0, y: 0 }, 280, gen);
  return damage;
}
async function takeTurn(action) {
  if (state.busy || alive().length === 0) return;
  const gen = generation;
  closeSheet();
  state.busy = true; paint();
  try {
    const kind = action === 'attack' && state.focus >= 3 ? 'weapon' : action;
    let line = `第 ${state.turn} 回合 · `;
    let guarded = false;
    if (kind === 'attack' || kind === 'weapon') {
      const damage = await heroStrike(kind, gen);
      state.focus = kind === 'weapon' ? 0 : Math.min(3, state.focus + 1);
      line += `${kind === 'weapon' ? '战技' : '普攻'} ${damage}`;
    } else if (kind === 'art') { await castArt(gen); state.focus = Math.max(0, state.focus - 1); line += '术法 96'; }
    else if (kind === 'thunder') { await thunder(gen); state.stock.thunder -= 1; line += '雷火符 120'; }
    else if (kind === 'pill' || kind === 'mist') {
      const point = chest(heroEl, heroH());
      const heal = kind === 'pill' ? 112 : 40;
      vfx.rise(point.x, point.y + heroH() * .4, { count: 22, spread: 50 });
      vfx.flash(point.x, point.y, { radius: 60, color: '#9fe68e', life: .4 });
      number(`+${heal}`, point, 'heal');
      state.heroHp = Math.min(state.maxHp, state.heroHp + heal);
      if (kind === 'pill') state.stock.pill -= 1; else state.used.mist = true;
      paint(); line += `${COMMANDS[kind].name} +${heal}`; await wait(320, gen);
    } else if (kind === 'guard' || kind === 'iron') {
      const point = chest(heroEl, heroH());
      vfx.ward(point.x, point.y, { radius: heroH() * .38, life: .6 });
      guarded = true;
      if (kind === 'iron') state.used.iron = true;
      state.focus = Math.min(3, state.focus + 1); line += COMMANDS[kind].name; await wait(260, gen);
    } else if (kind === 'escape') { ticker('原型不演示逃跑：正式游戏会先弹出确认。'); return; }
    paint();
    if (alive().length > 0) line += ` · 秦彻 ${await companionStrike(gen)}`;
    if (alive().length > 0) await petSupport(gen);
    let taken = 0;
    for (const enemy of alive()) taken += await enemyCounter(enemy, guarded, gen);
    if (taken > 0) line += ` · 受到 ${taken}`;
    ticker(line);
    if (alive().length === 0) { banner('胜 利'); return; }
    state.turn += 1;
    state.heavy = state.scenario.heavy ? !state.heavy : (state.turn % 3 === 2 && state.target.rank !== '');
    paint();
    banner(`第 ${state.turn} 回合`);
  } catch (error) {
    if (error !== CANCELLED) throw error;
  } finally {
    if (gen === generation) { state.busy = false; stride(); paint(); scheduleAuto(); }
  }
}

// ---------- Auto battle: after a short pause, take the recommended command ----------
let autoTimer;
function scheduleAuto() {
  clearTimeout(autoTimer);
  if (!auto || state.busy || alive().length === 0) return;
  autoTimer = setTimeout(() => takeTurn(state.heavy ? 'guard' : 'attack'), 700);
}

// ---------- Pickers: every skill or item, with its art ----------
function openSheet(kind) {
  const ids = kind === 'spells' ? SPELLS : ITEMS;
  $('#sheet-title').textContent = kind === 'spells' ? '全部法术' : '全部道具';
  $('#sheet-list').innerHTML = '';
  for (const id of ids) {
    const command = COMMANDS[id];
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'option';
    const extra = command.stock ? ` ×${state.stock[id]}` : command.once && state.used[id] ? '（已用）' : '';
    button.innerHTML = `<img src="${RES}/${command.art}" alt=""><b>${command.name}${extra}</b><small>${command.note}</small>`;
    button.disabled = (command.cost && state.focus < command.cost) || (command.once && state.used[id]) || (command.stock && state.stock[id] <= 0);
    button.addEventListener('click', () => takeTurn(id));
    $('#sheet-list').append(button);
  }
  $('#sheet').hidden = false;
  paintFrame($('#sheet'), PLATE.sheet);
  $('#sheet-list').querySelectorAll('.option').forEach(option => paintFrame(option, option.disabled ? PLATE.muted : PLATE.ready));
}
function closeSheet() { $('#sheet').hidden = true; }
$('#sheet-close').addEventListener('click', closeSheet);

for (const id of ['scenario', 'layout', 'skin']) $(`#${id}`).addEventListener('change', reset);
$('#reset').addEventListener('click', reset);
addEventListener('resize', () => { renderDock(); place(); paint(); setHeroFrame(BACK[0]); });
window.__combat = { takeTurn, openSheet, state: () => state, setFocus: value => { state.focus = value; paint(); } };
reset();
