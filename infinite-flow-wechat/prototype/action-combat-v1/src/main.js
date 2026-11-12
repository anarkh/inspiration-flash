// Entry: URL params, demo bar, phone-frame sizing (with safe-area insets), the fixed-step loop, and the headless hooks
// (window.__action). The sim advances in fixed 1/60 s ticks from an accumulator; the view renders once per animation
// frame. While world.slowMo > 0 (after a perfect dodge) the sim runs at SLOWMO_RATE of real time.
import { createWorld, stepWorld, DT, HERO_TUNING, ENEMY_ARCHETYPES, ENEMY_RULES, STAGE_DEMON_TOWER } from './sim/world.js?v=6';
import { EDGE_KEYS, combineInputs, createEdgeLatch, emptyInput } from './input/input-struct.js?v=6';
import { createKeyboard } from './input/keyboard.js?v=6';
import { createTouchDual } from './input/touch-dual.js?v=6';
import { createTouchOnehand } from './input/touch-onehand.js?v=6';
import { LOGICAL_W, createRenderer } from './view/renderer.js?v=6';
import { loadSpriteBank } from './view/sprites.js?v=6';
import { HERO_ART_DEFAULT } from './view/hero-anim.js?v=6';
import { createVfx } from './view/vfx.js?v=6';
import { createHud } from './view/hud.js?v=6';

const $ = selector => document.querySelector(selector);
const params = new URLSearchParams(location.search);

/** Control schemes, selected by ?controls=. assist = the sim's attack auto-aim / slide multiplier for that scheme. */
const SCHEMES = {
  dual: { create: createTouchDual, assist: 1 },
  onehand: { create: createTouchOnehand, assist: 2 },
};
const DEFAULT_SCHEME = 'onehand';
const VIEWPORTS = { auto: null, '390x844': [390, 844], '320x568': [320, 568] };
/** Wider-than-this windows are letterboxed instead of squeezing the layout. */
const MIN_LOGICAL_H = 640;
const MAX_STEPS_PER_FRAME = 8;
/** Sim speed while world.slowMo > 0. */
const SLOWMO_RATE = 0.3;
const EVENT_LOG_SIZE = 200;

/** ?safe=top,bottom simulates safe-area insets (CSS px) where env(safe-area-inset-*) is 0, e.g. desktop Chrome. */
function parseSafe(value) {
  if (value === null) return null;
  const [top = 0, bottom = 0] = value.split(',').map(Number);
  return Number.isFinite(top) && Number.isFinite(bottom) ? { top, right: 0, bottom, left: 0 } : null;
}

const options = {
  // One-hand is the default scheme; ?controls=dual (or the demo bar) switches to the two-thumb layout.
  controls: params.get('controls') in SCHEMES ? params.get('controls') : DEFAULT_SCHEME,
  /** Hero art: 'action' (the drawn action atlas) or 'standin' (built from the walk sheet); see view/hero-anim.js. */
  hero: params.get('hero') ?? HERO_ART_DEFAULT,
  viewport: params.get('viewport') in VIEWPORTS ? params.get('viewport') : 'auto',
  slowmo: params.has('slowmo'),
  debug: params.has('debug'),
  shot: params.has('shot'),
  seed: Number.parseInt(params.get('seed') ?? '1', 10) || 1,
  safe: parseSafe(params.get('safe')),
};
const config = {
  seed: options.seed, stage: STAGE_DEMON_TOWER, hero: HERO_TUNING, enemies: ENEMY_ARCHETYPES, rules: ENEMY_RULES,
  assist: SCHEMES[options.controls].assist,
};

const demoBar = $('#demo-bar');
const frameEl = $('#frame');
const root = $('#root');
const canvas = $('#view');
const controlsLayer = $('#controls');
const safeProbe = $('#safe-probe');

let world = createWorld(config);
let renderer;
let vfx;
let hud;
let keyboard;
let scheme;
let layout;
let running = true;
let accumulator = 0;
let last = performance.now();
const eventLog = [];

// Inputs injected through window.__action.setInput: held fields persist, press edges fire on the next tick only.
const override = { moveX: 0, moveZ: 0, attackHeld: false };
const overrideEdges = createEdgeLatch();

function setInput(partial) {
  for (const [key, value] of Object.entries(partial)) {
    if (EDGE_KEYS.includes(key)) { if (value) overrideEdges.press(key); }
    else if (key in override) override[key] = value;
    else throw new Error(`Unknown input field: ${key}`);
  }
}

function readOverride() {
  return overrideEdges.drainInto(Object.assign(emptyInput(), override));
}

const getWorld = () => world;
const simRate = () => (world.slowMo > 0 ? SLOWMO_RATE : 1);

function tick() {
  stepWorld(world, combineInputs(keyboard.read(), scheme.read(), readOverride()));
}

/** Drain the sim's events once and fan them out (vfx, HUD, controls), then render. viewDt is in sim-speed seconds. */
function draw(viewDt, realDt = viewDt) {
  const events = world.events.splice(0);
  if (events.length > 0) {
    eventLog.push(...events);
    if (eventLog.length > EVENT_LOG_SIZE) eventLog.splice(0, eventLog.length - EVENT_LOG_SIZE);
  }
  vfx.consume(events, world);
  hud.handleEvents(events, world);
  scheme.handleEvents?.(events, world);
  const frozen = world.hitStop > 0;
  vfx.update(viewDt, frozen);
  renderer.render(world, vfx, { debug: options.debug, dt: viewDt, frozen });
  hud.update(world, realDt);
  scheme.render(world);
}

function frame(now) {
  const elapsed = Math.min(0.1, (now - last) / 1000);
  last = now;
  const demoRate = options.slowmo ? 0.25 : 1;
  const live = running && !document.hidden;
  let viewDt = 0;
  if (live) {
    // The accumulator holds demo-scaled real time; one tick costs DT at full speed and DT / SLOWMO_RATE in slow motion.
    accumulator += elapsed * demoRate;
    let steps = 0;
    while (steps < MAX_STEPS_PER_FRAME && accumulator >= DT / simRate()) {
      accumulator -= DT / simRate();
      tick();
      steps += 1;
    }
    if (steps === MAX_STEPS_PER_FRAME) accumulator = 0;
    viewDt = elapsed * demoRate * simRate();
  }
  draw(viewDt, live ? elapsed : 0);
  requestAnimationFrame(frame);
}

function restart() {
  config.assist = SCHEMES[options.controls].assist;
  world = createWorld(config);
  accumulator = 0;
  eventLog.length = 0;
  vfx.clear();
  hud.reset();
  renderer.reset();
  keyboard.reset();
  scheme.reset();
  draw(0);
}

/** Safe-area insets that fall on the frame, in logical px. */
function safeInsets(scale) {
  let inset = options.safe;
  if (!inset) {
    const style = getComputedStyle(safeProbe);
    inset = { top: parseFloat(style.paddingTop), right: parseFloat(style.paddingRight), bottom: parseFloat(style.paddingBottom), left: parseFloat(style.paddingLeft) };
  }
  const rect = frameEl.getBoundingClientRect();
  const over = (value, gap) => Math.max(0, (value || 0) - gap) / scale;
  return {
    top: over(inset.top, rect.top),
    right: over(inset.right, window.innerWidth - rect.right),
    bottom: over(inset.bottom, window.innerHeight - rect.bottom),
    left: over(inset.left, rect.left),
  };
}

/** Size the phone frame (CSS px) and the logical layer (390 wide, height from the frame's aspect). */
function fit() {
  const barH = options.shot ? 0 : demoBar.offsetHeight;
  const fixed = VIEWPORTS[options.viewport];
  const phoneLike = !fixed && window.innerWidth <= 600;
  // A framed phone keeps a small margin for its outline and shadow.
  const margin = phoneLike || options.shot ? 0 : 10;
  const availW = window.innerWidth - margin * 2;
  const availH = window.innerHeight - barH - margin;
  let [w, h] = fixed ?? (phoneLike ? [availW, availH] : [390, 844]);
  const shrink = Math.min(1, availW / w, availH / h);
  w *= shrink;
  h *= shrink;
  const logicalH = Math.max(MIN_LOGICAL_H, (LOGICAL_W * h) / w);
  const scale = h / logicalH;
  frameEl.style.width = `${LOGICAL_W * scale}px`;
  frameEl.style.height = `${h}px`;
  frameEl.classList.toggle('framed', !phoneLike && !options.shot);
  root.style.height = `${logicalH}px`;
  root.style.transform = `scale(${scale})`;
  const screen = renderer.resize(scale, logicalH, Math.min(3, window.devicePixelRatio || 1));
  layout = { ...screen, safe: safeInsets(scale) };
  scheme.setLayout(layout);
  hud.setLayout(layout);
  draw(0);
}

function applyScheme() {
  scheme?.destroy();
  scheme = SCHEMES[options.controls].create(controlsLayer, { layout, getWorld });
  document.body.dataset.controls = options.controls;
}

/** Switch the control scheme at runtime: new controls, the matching assist, and a fresh fight. */
function setScheme(name) {
  if (!(name in SCHEMES)) throw new Error(`Unknown control scheme: ${name}`);
  options.controls = name;
  $('#opt-controls').value = name;
  applyScheme();
  restart();
  syncUrl();
}

function syncUrl() {
  const next = new URLSearchParams(location.search);
  const set = (key, value) => (value === null ? next.delete(key) : next.set(key, value));
  set('controls', options.controls === DEFAULT_SCHEME ? null : options.controls);
  set('hero', options.hero === HERO_ART_DEFAULT ? null : options.hero);
  set('viewport', options.viewport === 'auto' ? null : options.viewport);
  set('slowmo', options.slowmo ? '' : null);
  set('debug', options.debug ? '' : null);
  const query = next.toString().replace(/=(?=&|$)/g, '');
  history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}`);
}

function wireDemoBar() {
  const controls = $('#opt-controls');
  const viewport = $('#opt-viewport');
  const slowmo = $('#opt-slowmo');
  const debug = $('#opt-debug');
  controls.value = options.controls;
  viewport.value = options.viewport;
  slowmo.checked = options.slowmo;
  debug.checked = options.debug;
  document.body.classList.toggle('debug', options.debug);
  controls.addEventListener('change', () => {
    setScheme(controls.value);
    controls.blur();
  });
  viewport.addEventListener('change', () => {
    options.viewport = viewport.value;
    fit();
    syncUrl();
    viewport.blur();
  });
  slowmo.addEventListener('change', () => { options.slowmo = slowmo.checked; syncUrl(); slowmo.blur(); });
  debug.addEventListener('change', () => {
    options.debug = debug.checked;
    document.body.classList.toggle('debug', options.debug);
    syncUrl();
    debug.blur();
  });
  $('#opt-restart').addEventListener('click', event => { restart(); event.currentTarget.blur(); });
}

/** A load failure covers the whole page (it may happen before the phone frame is sized). */
function showFatal(message) {
  const node = document.createElement('div');
  node.className = 'fatal';
  node.textContent = message;
  document.body.append(node);
}

async function main() {
  if (options.shot) document.body.classList.add('shot');
  const art = STAGE_DEMON_TOWER.art;
  const extra = { backdrop: art.backdrop.src };
  if (art.backdrop.floorFraction === 0) extra.floor = art.floor.src;
  let bank;
  try {
    bank = await loadSpriteBank(extra, { heroArt: options.hero });
  } catch (error) {
    $('#loading')?.remove();
    showFatal(error.message);
    throw error;
  }
  $('#loading')?.remove();
  renderer = createRenderer(canvas, { bank, stage: STAGE_DEMON_TOWER });
  layout = renderer.layout;
  vfx = createVfx();
  hud = createHud(root, { onRestart: restart });
  keyboard = createKeyboard(window, { getWorld });
  applyScheme();
  wireDemoBar();
  fit();
  window.addEventListener('resize', fit);
  frameEl.addEventListener('contextmenu', event => event.preventDefault());
  document.addEventListener('gesturestart', event => event.preventDefault());
  // A hidden tab pauses the fight; held keys and touches are dropped and the clock restarts on return (no catch-up).
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      keyboard.reset();
      scheme.reset();
    } else {
      last = performance.now();
      accumulator = 0;
    }
  });
  window.__action = {
    get world() { return world; },
    config,
    options,
    /** Active control scheme name ('dual' | 'onehand'). */
    get scheme() { return options.controls; },
    /** The last EVENT_LOG_SIZE sim events, oldest first. */
    events: eventLog,
    layout: () => layout,
    pause() { running = false; },
    resume() { running = true; last = performance.now(); },
    /** Advance exactly n sim ticks (works while paused), then draw once. */
    step(n = 1) {
      for (let i = 0; i < n; i++) tick();
      draw(n * DT);
      return world;
    },
    setInput,
    setScheme,
    restart,
    /** World (x, z, y) -> logical screen px, as the renderer draws it this frame. */
    project: (x, z, y = 0) => renderer.project(x, z, y),
  };
  last = performance.now();
  requestAnimationFrame(frame);
}

main();
