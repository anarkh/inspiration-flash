// The side-scrolling action battle on the real View, driven by a real reducer-backed harness that dispatches like
// InfiniteFlowApp (busy render, then the result): entry, declared art, touch play (drag, auto-combo, flick dodge),
// re-renders that keep the fight and pause it, the single commit and its replay, room <-> fight transitions that never
// reload art (leases held / released like the App), the boss opening shot and plate, defeat, escape, capture, a failed or
// refused commit and its retry, a reload restarting the fight, the timeout guard, keyboard, and the control layout
// (104-unit touch boxes, no overlaps, safe areas, the stick zone under the header and the controls).
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../../', import.meta.url));
const ccStub = `
class TestEvents {
  constructor() { this.listeners = new Map(); }
  on(type, handler, target) { const list = this.listeners.get(type) ?? []; list.push({ handler, target }); this.listeners.set(type, list); }
  off(type, handler) { this.listeners.set(type, (this.listeners.get(type) ?? []).filter(entry => entry.handler !== handler)); }
  emit(type, event) { for (const entry of [...(this.listeners.get(type) ?? [])]) entry.handler.call(entry.target, event); }
  count(type) { return (this.listeners.get(type) ?? []).length; }
}
export class Node {
  static EventType = { TOUCH_START: 'touch-start', TOUCH_MOVE: 'touch-move', TOUCH_END: 'touch-end', TOUCH_CANCEL: 'touch-cancel' };
  constructor(name = '') { this.name = name; this.children = []; this.components = []; this.events = new TestEvents(); this.parent = null;
    this.position = { x: 0, y: 0, z: 0 }; this.scale = { x: 1, y: 1, z: 1 }; this.angle = 0; this.active = true; this.layer = 0; this.destroyed = false; }
  get isValid() { return !this.destroyed; }
  addChild(child) { this.children.push(child); child.parent = this; }
  removeAllChildren() { for (const child of [...this.children]) child.destroy(); }
  setPosition(p, y, z = 0) { this.position = typeof p === 'number' ? { x: p, y, z } : { x: p.x, y: p.y, z: p.z ?? 0 }; }
  setScale(s) { this.scale = { x: s.x, y: s.y, z: s.z ?? 1 }; }
  setSiblingIndex(index) { const list = this.parent?.children; if (!list) return; list.splice(list.indexOf(this), 1); list.splice(Math.max(0, Math.min(index, list.length)), 0, this); }
  getChildByName(name) { return this.children.find(child => child.name === name) ?? null; }
  addComponent(Type) { const component = new Type(); component.node = this; this.components.push(component); return component; }
  getComponent(Type) { return this.components.find(component => component instanceof Type) ?? null; }
  on(type, handler, target) { this.events.on(type, handler, target); }
  off(type, handler) { this.events.off(type, handler); }
  emit(type, event) { this.events.emit(type, event); }
  destroy() { this.destroyed = true; for (const child of [...this.children]) child.destroy(); this.children = []; this.events = new TestEvents();
    if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); return true; }
}
export function worldOf(node) {
  const chain = [];
  for (let n = node; n; n = n.parent) chain.unshift(n);
  let x = 0, y = 0, sx = 1, sy = 1;
  for (const n of chain) { x += n.position.x * sx; y += n.position.y * sy; sx *= n.scale.x; sy *= n.scale.y; }
  return { x, y, sx, sy };
}
export class UITransform {
  constructor() { this._size = { width: 0, height: 0 }; }
  setContentSize(a, b) { this._size = typeof a === 'number' ? { width: a, height: b } : { width: a.width, height: a.height }; }
  get contentSize() { return this._size; }
  convertToNodeSpaceAR(point) { const w = worldOf(this.node); return new Vec3((point.x - w.x) / w.sx, (point.y - w.y) / w.sy, 0); }
}
export class Size { constructor(width = 0, height = 0) { this.width = width; this.height = height; } }
export class Vec3 { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } }
export class Vec2 { constructor(x = 0, y = 0) { this.x = x; this.y = y; } }
export class Rect { constructor(x = 0, y = 0, width = 0, height = 0) { Object.assign(this, { x, y, width, height }); } }
export class Color { constructor(r = 255, g = 255, b = 255, a = 255) { Object.assign(this, { r, g, b, a }); } }
export class Label {
  static HorizontalAlign = { LEFT: 0, CENTER: 1, RIGHT: 2 };
  static VerticalAlign = { TOP: 0, CENTER: 1, BOTTOM: 2 };
  static Overflow = { NONE: 0, CLAMP: 1, SHRINK: 2, RESIZE_HEIGHT: 3 };
  constructor() { this.string = ''; this.color = new Color(); }
}
export class Graphics {
  static LineCap = { ROUND: 1 }; static LineJoin = { ROUND: 1 };
  constructor() { this.ops = 0; this.fills = 0; this.strokes = 0; this.fillColor = new Color(); this.strokeColor = new Color(); this.lineWidth = 1; }
  clear() { this.ops = 0; this.fills = 0; this.strokes = 0; }
  rect() { this.ops += 1; } roundRect() { this.ops += 1; } circle() { this.ops += 1; } ellipse() { this.ops += 1; } arc() { this.ops += 1; }
  moveTo() { this.ops += 1; } lineTo() { this.ops += 1; } bezierCurveTo() { this.ops += 1; } quadraticCurveTo() { this.ops += 1; } close() {}
  fill() { this.fills += 1; } stroke() { this.strokes += 1; }
}
export class Sprite { static SizeMode = { CUSTOM: 0, RAW: 1, TRIMMED: 2 }; constructor() { this.spriteFrame = null; this.trim = true; this.color = new Color(); this.customMaterial = null; this.grayscale = false; } }
export class SpriteFrame {
  static createWithImage(image) { const frame = new SpriteFrame(); frame.image = image; frame.texture = { destroy() {} }; return frame; }
  constructor() { this.texture = null; this.destroyed = false; }
  destroy() { this.destroyed = true; return true; }
}
export class Mask { static Type = { GRAPHICS_RECT: 0, GRAPHICS_ELLIPSE: 1 }; }
export class BlockInputEvents {}
export class ScrollView {
  static EventType = { SCROLLING: 'scrolling' };
  getScrollOffset() { return { x: 0, y: 0 }; } scrollToOffset() {}
}
export class Material { initialize(info) { this.info = info; } }
export const builtinResMgr = { get(name) { return { effectAsset: { name } }; } };
export const gfx = { BlendFactor: { ZERO: 0, ONE: 1, SRC_ALPHA: 2, DST_ALPHA: 3, ONE_MINUS_SRC_ALPHA: 4 } };
export class EventTouch {} export class EventKeyboard {} export class ImageAsset {} export class Asset {}
export const Input = { EventType: { KEY_DOWN: 'key-down', KEY_UP: 'key-up' } };
export const KeyCode = { ESCAPE: 27, SPACE: 32, KEY_A: 65, KEY_D: 68, KEY_E: 69, KEY_I: 73, KEY_J: 74, KEY_K: 75, KEY_L: 76, KEY_S: 83, KEY_U: 85, KEY_W: 87, ARROW_LEFT: 37, ARROW_UP: 38, ARROW_RIGHT: 39, ARROW_DOWN: 40 };
export const input = globalThis.__actionInput = new TestEvents();
export const game = globalThis.__actionGame = new TestEvents();
export const Game = { EVENT_HIDE: 'game-hide' };
export const view = { getFrameSize() { return globalThis.__actionFrame ?? { width: 390, height: 844 }; } };
`;

const bundle = await build({
  stdin: {
    contents: `
      export { InfiniteFlowView } from './cocos/assets/scripts/ui/InfiniteFlowView.ts';
      export { configureInfiniteFlowBattleRenderer, getInfiniteFlowActionBattle, getInfiniteFlowActionBattleKey } from './cocos/assets/scripts/ui/battle-renderer.ts';
      export { getInfiniteFlowSceneVisualKeys, INFINITE_FLOW_DUNGEON_PROP_VISUAL_KEYS } from './cocos/assets/scripts/ui/scene-visuals.ts';
      export { getActionBattleLayout, actionSceneFromLogical, wantsAutoAttack } from './cocos/assets/scripts/ui/action-battle-logic.ts';
      export { ActionBattleController, ACTION_COMMIT_ACTION_ID } from './cocos/assets/scripts/ui/action-battle-controller.ts';
      export { HERO_ACTION_FRAME_IDS, HERO_ACTION_CANVAS } from './cocos/assets/scripts/ui/action-battle-art.ts';
      export { buildGameViewModel } from '@infinite-flow/presentation';
      export { reduceGameCommand } from '@infinite-flow/application';
      export { createChapterTrialState, createInitialState, canCaptureInActionWorld, DUNGEON_ORDER, DUNGEONS } from '@infinite-flow/core';
      export { replayActionCombat } from '@infinite-flow/core/action-combat';
      export { getBossDefinition } from '@infinite-flow/core/boss-system';
      export { competentBot } from './packages/core/test/action-combat/bots.ts';
      export { Node, Graphics, Label, Sprite, UITransform, worldOf } from 'cc';
    `,
    resolveDir: root,
    loader: 'ts',
  },
  absWorkingDir: root,
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  plugins: [{
    name: 'action-battle-cc',
    setup(builder) {
      builder.onResolve({ filter: /^cc$/ }, () => ({ path: 'cc', namespace: 'action-battle-cc' }));
      builder.onLoad({ filter: /.*/, namespace: 'action-battle-cc' }, () => ({ contents: ccStub, loader: 'js' }));
    },
  }],
});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
api.configureInfiniteFlowBattleRenderer('action');

let checks = 0;
const facts = {};
function check(label, run) {
  try { run(); checks += 1; } catch (error) { throw new Error(`Action battle: ${label}`, { cause: error }); }
}

// ---- Domain fixtures (real reducer) ----
function commit(state, command) {
  const result = api.reduceGameCommand(state, command);
  assert.equal(result.status, 'committed', `${command.type} must commit`);
  return result.state;
}
const ENTRY_SEEDS = { rulesVersion: 1, hiddenTaskSeed: 99 };
function fightIn(state, dungeonId, nodeId) {
  const entered = commit(state, { type: 'run/enter', dungeonId, protocolId: 'standard', seeds: ENTRY_SEEDS });
  return commit(entered, { type: 'run/select-node', nodeId: nodeId ?? entered.run.currentNodeId });
}
const trial = api.createChapterTrialState(1);
const netTrial = { ...trial, inventory: { ...trial.inventory, capture_net: 1 }, preparedItemIds: ['capture_net'] };

// ---- Harness: real View + a dispatcher shaped like InfiniteFlowApp.activate / finishDispatch ----
const SIZES = (key) => key === 'character:reincarnator_walk' ? [1254, 1254]
  : key === 'scene:battle_controls_ink' ? [1086, 362]
  : key === 'character:reincarnator_action' ? [1973, 1650]
  : key.startsWith('scene:action_stage_') ? [1774, 887]
  : key.startsWith('monster:') ? [512, 768]
  : key === 'character:reincarnator' ? [512, 512]
  : [1254, 1254];

let touchSerial = 1000;
function touchAt(id, x, y) { return { propagationStopped: false, getID: () => id, getUILocation: () => ({ x, y }) }; }

function createHarness(state, { frame = { width: 390, height: 844 }, cssInsets = { top: 0, right: 0, bottom: 0, left: 0 } } = {}) {
  globalThis.__actionFrame = frame;
  const surfaceHeight = Math.max(1334, 750 * frame.height / frame.width);
  const k = 750 / frame.width;
  const insets = { top: cssInsets.top * k, right: cssInsets.right * k, bottom: cssInsets.bottom * k, left: cssInsets.left * k };
  const canvas = new api.Node('Canvas');
  canvas.addComponent(api.UITransform).setContentSize(750, surfaceHeight);
  canvas.setPosition(375, surfaceHeight / 2);
  const h = {
    state, canvas, insets, surfaceHeight, busy: undefined, activity: undefined, pending: [], completed: new Map(), dispatched: [],
    held: new Set(), released: [], loads: [], failNext: undefined, blockLocal: false,
  };
  h.model = () => api.buildGameViewModel(h.state, {});
  h.chrome = (sceneAssets = 'ready') => ({ modeKind: 'preview', modeLabel: 'test', modeDetail: 'test', sceneAssets,
    ...(h.activity === undefined ? {} : { activityMessage: h.activity }), ...(h.busy === undefined ? {} : { busyActionId: h.busy }) });
  h.supply = (model) => {
    // The App's lease set: undeclared keys released, every declared key ready before the scene. A key that was not
    // already held is a fresh load: the App would show the loading overlay (sceneAssets 'loading') until it arrives.
    const wanted = new Set(Object.values(api.getInfiniteFlowSceneVisualKeys(model)));
    for (const key of Array.from(h.held)) if (!wanted.has(key)) { h.view.clearSceneVisualAsset(key); h.held.delete(key); h.released.push(key); }
    const fresh = Array.from(wanted).filter(key => !h.held.has(key));
    if (fresh.length > 0) h.loads.push({ phase: model.phase, keys: fresh });
    return fresh;
  };
  h.finishLoads = () => {
    for (const key of h.loads.at(-1)?.keys ?? []) {
      if (h.held.has(key)) continue;
      const [width, height] = SIZES(key);
      h.view.setSceneVisualAsset({ width, height }, { key, revision: 'action-battle-fixture' });
      h.held.add(key);
    }
  };
  /** As App.render: the loading overlay while any declared key is still loading, then the scene. */
  h.render = () => {
    const model = h.model();
    if (h.supply(model).length > 0) {
      h.view.render(model, h.chrome('loading'), insets);
      h.loadingTitles.push(labelText(h.node('SceneAssetTitle')));
      h.finishLoads();
    }
    h.view.render(model, h.chrome(), insets);
  };
  h.loadingTitles = [];
  h.view = new api.InfiniteFlowView(canvas, {
    activate: (physicalId, actionId, event) => {
      if (h.busy !== undefined) return;
      if (event.kind !== 'command') return;
      h.dispatched.push({ physicalId, actionId, command: event.command });
      h.busy = actionId;
      h.activity = `提交 ${actionId}`;
      h.render();
      h.pending.push({ physicalId, actionId, command: event.command });
    },
    retrySceneAssets() {},
    combatPlaybackSettled() {},
  });
  /** Complete the in-flight dispatch like App.finishDispatch (physical dedupe, committed / rejected / thrown). */
  h.flush = () => {
    const entry = h.pending.shift();
    assert.ok(entry, 'a dispatch is in flight');
    const mode = h.failNext;
    h.failNext = undefined;
    if (mode === 'throw') {
      h.activity = `${entry.actionId} 失败：network down`;
    } else if (h.completed.has(entry.physicalId)) {
      h.activity = `物理输入去重 ${entry.actionId}`;
    } else {
      const result = mode === 'reject' ? { status: 'rejected', state: h.state } : api.reduceGameCommand(h.state, entry.command);
      h.completed.set(entry.physicalId, result.status);
      if (result.status === 'committed') { h.state = result.state; h.activity = `已提交 ${entry.actionId}`; }
      else h.activity = `规则拒绝 ${entry.actionId} · 状态未改变`;
    }
    h.busy = undefined;
    h.render();
  };
  h.battle = () => h.view.actionBattle;
  h.tick = (frames = 1) => { for (let i = 0; i < frames; i += 1) h.view.tick(1 / 60); };
  h.nodes = (predicate) => {
    const out = [];
    const visit = (node) => { if (predicate(node)) out.push(node); node.children.forEach(visit); };
    visit(canvas);
    return out;
  };
  h.node = (name) => h.nodes(node => node.name === name)[0];
  h.tap = (node) => {
    assert.ok(node, 'tap target exists');
    const id = ++touchSerial;
    const w = api.worldOf(node);
    node.emit('touch-start', touchAt(id, w.x, w.y));
    node.emit('touch-end', touchAt(id, w.x, w.y));
  };
  h.layout = () => api.getActionBattleLayout({ surfaceHeight, viewportWidth: Math.min(frame.width, frame.height * 750 / surfaceHeight), safeInsets: insets,
    depth: h.battle().world.stage.depth });
  /** UI coordinates of a logical screen point (the stick zone converts them back). */
  h.ui = (sx, sy) => {
    const scene = h.node('WalkScene');
    const point = api.actionSceneFromLogical(h.layout(), sx, sy);
    const w = api.worldOf(scene);
    return { x: w.x + point.x, y: w.y + point.y };
  };
  h.touchZone = (type, id, sx, sy) => {
    const zone = h.node('ActionStickZone');
    assert.ok(zone, 'the stick zone exists');
    const p = h.ui(sx, sy);
    zone.emit(type, touchAt(id, p.x, p.y));
  };
  h.key = (type, keyCode) => globalThis.__actionInput.emit(type, { keyCode });
  h.render();
  return h;
}

function bounds(node) {
  const w = api.worldOf(node);
  const size = node.getComponent(api.UITransform).contentSize;
  return { left: w.x - size.width * Math.abs(w.sx) / 2, right: w.x + size.width * Math.abs(w.sx) / 2,
    bottom: w.y - size.height * Math.abs(w.sy) / 2, top: w.y + size.height * Math.abs(w.sy) / 2, width: size.width * Math.abs(w.sx), height: size.height * Math.abs(w.sy) };
}
const overlap = (a, b) => !(a.right <= b.left + 1e-6 || b.right <= a.left + 1e-6 || a.top <= b.bottom + 1e-6 || b.top <= a.bottom + 1e-6);
const labelText = (node) => node?.getComponent(api.Label)?.string;

/** Drive the fight with the core's competent bot through the real stick zone and the keyboard. */
function botStep(h, state) {
  const battle = h.battle();
  const world = battle.world;
  const bot = api.competentBot(world);
  const layout = h.layout();
  const radius = layout.stick.radius;
  if (state.id === undefined) {
    state.id = ++touchSerial;
    state.base = { ...layout.stick.rest };
    h.touchZone('touch-start', state.id, state.base.x, state.base.y);
  }
  const magnitude = Math.hypot(bot.moveX, bot.moveZ);
  const travel = magnitude > 0 ? 0.18 + 0.82 * Math.min(1, magnitude) : 0;
  const dx = magnitude > 0 ? bot.moveX / magnitude * travel * radius : 0;
  const dz = magnitude > 0 ? bot.moveZ / magnitude * travel * radius : 0;
  h.touchZone('touch-move', state.id, state.base.x + dx, state.base.y + dz);
  for (const [edge, code] of [['attack', 74], ['dodge', 75], ['skill', 76], ['spell', 85], ['item', 73]]) {
    if (!bot[edge]) continue;
    h.key('key-down', code);
    h.key('key-up', code);
  }
}

function playUntil(h, done, limitFrames = 60 * 150) {
  const bot = { id: undefined, base: undefined };
  for (let frame = 0; frame < limitFrames; frame += 1) {
    if (done()) return frame;
    if (h.battle()?.status === 'fighting') botStep(h, bot);
    h.tick();
  }
  throw new Error(`fight did not reach its goal in ${limitFrames} frames`);
}

// ---- 1. Entry, declared art, the scene ----
const fightState = fightIn(trial, 'demon_tower_1', 'fog_lesser_demon');
const main = createHarness(fightState);
check('chapter 1 fight shows the side-scrolling battle from declared art', () => {
  const model = main.model();
  const action = api.getInfiniteFlowActionBattle(model);
  assert.ok(action, 'the combat model carries the real-time fight');
  const keys = api.getInfiniteFlowSceneVisualKeys(model);
  assert.equal(keys.actionStage, 'scene:action_stage_demon_tower_1');
  assert.equal(keys.heroAction, 'character:reincarnator_action');
  assert.equal(keys.battleControls, 'scene:battle_controls_ink');
  assert.ok(action.roster.every(member => keys[`actionFoe_${member.archetype}`] === `monster:${member.monsterId}_world`), 'every roster world figure is declared');
  assert.ok(main.nodes(node => node.name.startsWith('ActionEnemyArt:')).every(node => node.name.endsWith('_world')) || main.battle().world.entities.length === 1,
    'enemies draw their world figures');
  for (const name of ['ActionBattleWorld', 'ActionStageBackdrop', 'ActionHero', 'ActionStickZone', 'ActionControl:skill', 'ActionControl:spell',
    'ActionControl:item', 'ActionControl:escape', 'WalkHud', 'SceneDetails', 'SceneHelp']) assert.ok(main.node(name), `${name} is drawn`);
  assert.equal(main.node('BattleStage'), undefined, 'no turn-based duel stage');
  for (const name of ['WalkCombatAuto', 'WalkCombatChoice:spells', 'WalkCombatChoice:medicines']) assert.equal(main.node(name), undefined, `${name} (turn-based extra) is hidden`);
  const battle = main.battle();
  assert.equal(battle.world.tick, 0);
  assert.equal(battle.key, api.getInfiniteFlowActionBattleKey(action));
  const frames = main.view.sceneVisuals.get('character:reincarnator_action').frames;
  assert.equal(frames.length, api.HERO_ACTION_FRAME_IDS.length, 'the hero atlas is cut into every pose');
  assert.ok(frames.every(frame => frame.originalSize.width === api.HERO_ACTION_CANVAS.width && frame.originalSize.height === api.HERO_ACTION_CANVAS.height),
    'every pose shares one foot-centred canvas');
});

check('a scene is never built before its art is ready', () => {
  const loading = createHarness(fightState);
  loading.view.render(loading.model(), { ...loading.chrome(), sceneAssets: 'loading' }, loading.insets);
  assert.equal(loading.node('ActionBattleWorld'), undefined, 'loading shows the loading overlay, not the battle');
  assert.ok(loading.node('SceneAssetLoading'));
  loading.view.clearSceneVisualAsset('character:reincarnator_action');
  assert.throws(() => loading.view.render(loading.model(), loading.chrome(), loading.insets), /not ready/u, 'undeclared or missing art fails loudly');
  loading.view.destroy();
});

// ---- 2. Touch play: drag, release into the auto-combo, flick dodge ----
check('drag runs, release near enemies chains the 1-2-3 combo, a flick dodges', () => {
  const battle = main.battle();
  const world = battle.world;
  const layout = main.layout();
  const rest = layout.stick.rest;
  const startX = world.hero.x;
  const id = ++touchSerial;
  main.touchZone('touch-start', id, rest.x, rest.y);
  main.touchZone('touch-move', id, rest.x + layout.stick.radius, rest.y);
  const states = new Set();
  let frames = 0;
  while (!api.wantsAutoAttack(world) && frames < 600) { main.tick(); states.add(world.hero.state); frames += 1; }
  assert.ok(states.has('run'), 'the stick runs the hero');
  assert.ok(world.hero.x > startX + 40, 'the hero moved right');
  assert.ok(api.wantsAutoAttack(world), 'an enemy came into reach');
  // Ease the knob back before letting go, so the release is not a flick.
  main.touchZone('touch-move', id, rest.x, rest.y);
  main.tick(2);
  main.touchZone('touch-end', id, rest.x, rest.y);
  const hitsBefore = world.stats.hits;
  const seen = new Set();
  for (let i = 0; i < 90; i += 1) { main.tick(); seen.add(world.hero.state); }
  assert.ok(seen.has('attack1') && seen.has('attack2') && seen.has('attack3'), `auto-combo chains 1-2-3 (saw ${Array.from(seen).join(',')})`);
  assert.ok(world.stats.hits > hitsBefore, 'the auto-combo lands hits');
  // Flick: past 70% of the radius and released within 180 ms.
  for (let i = 0; i < 40 && world.hero.dodgeCooldown > 0; i += 1) main.tick();
  const flick = ++touchSerial;
  main.touchZone('touch-start', flick, rest.x, rest.y);
  main.touchZone('touch-move', flick, rest.x - layout.stick.radius * 0.95, rest.y);
  main.tick();
  main.touchZone('touch-end', flick, rest.x - layout.stick.radius * 0.95, rest.y);
  let dodged = false;
  for (let i = 0; i < 20 && !dodged; i += 1) { main.tick(); dodged = world.hero.state === 'dodge'; }
  assert.ok(dodged, 'a flick dodges');
});

check('the header shows the live sim HP', () => {
  const battle = main.battle();
  const status = labelText(main.node('WalkPlayerStatus'));
  assert.equal(status, `${Math.max(0, Math.ceil(battle.world.hero.hp))}/${battle.world.hero.maxHp}`);
});

// ---- 3. Re-render mid-fight: 行囊 open pauses, closing resumes the same fight ----
check('opening 行囊 pauses the fight; closing keeps it exactly', () => {
  const battle = main.battle();
  const world = battle.world;
  main.tick(10);
  const snapshot = JSON.stringify({ ...world, events: [] });
  const tick = world.tick;
  main.tap(main.node('SceneDetails'));
  assert.ok(main.view.mobileSheet, 'the bag sheet is open');
  assert.equal(main.battle(), battle, 'the same controller survives the re-render');
  main.tick(45);
  assert.equal(world.tick, tick, 'the fight is paused while the sheet is open');
  assert.equal(JSON.stringify({ ...world, events: [] }), snapshot, 'the fight state is untouched');
  assert.equal(main.nodes(node => node.name === 'MobileSheetAction:combat.action:use_healing_pill').length, 0, 'the bag offers no turn-based pill use');
  main.tap(main.node('MobileSheetClose'));
  assert.equal(main.view.mobileSheet, undefined, 'the sheet closed');
  assert.equal(main.battle(), battle);
  assert.equal(JSON.stringify({ ...world, events: [] }), snapshot, 'closing changes nothing');
  main.tick(5);
  assert.ok(world.tick > tick, 'the fight resumes');
});

check('the menu lists no turn-based combat commands besides escape and retreat', () => {
  main.tap(main.node('SceneHelp'));
  main.tap(main.node('MobileSheetShortcut:actions'));
  const listed = main.nodes(node => node.name.startsWith('MobileSheetAction:')).map(node => node.name.slice('MobileSheetAction:'.length));
  assert.ok(listed.length > 0 && listed.every(id => id === 'combat.action:escape' || id === 'combat.retreat-run'), `listed: ${listed.join(', ')}`);
  main.view.mobileSheet = undefined;
  main.render();
});

// ---- 4. Victory: one commit, accepted by the reducer, room cleared, art released ----
check('victory commits once; the reducer replays it; the room is cleared and the battle art released', () => {
  const battle = main.battle();
  playUntil(main, () => battle.status !== 'fighting' && battle.status !== 'ending');
  assert.equal(battle.world.phase, 'won', 'the competent player wins');
  facts.victory = { simSeconds: Number(battle.world.time.toFixed(1)), ticks: battle.ticks, hits: battle.world.stats.hits, heroHp: Math.ceil(battle.world.hero.hp) };
  assert.equal(battle.status, 'dispatching');
  const commits = main.dispatched.filter(entry => entry.command.type === 'combat/resolve-action');
  assert.equal(commits.length, 1, 'exactly one commit');
  assert.equal(commits[0].actionId, api.ACTION_COMMIT_ACTION_ID);
  assert.ok(battle.world.time - battle.world.endedAt >= 0.9 - 1e-9, 'the ending played before the commit');
  const action = api.getInfiniteFlowActionBattle(main.model());
  const replay = api.replayActionCombat(action.config, commits[0].command.log, { maxTicks: action.maxTicks });
  assert.equal(replay.outcome.phase, 'won', 'the log replays to the same victory');
  assert.equal(replay.world.hero.hp, battle.world.hero.hp, 'and the same hero HP');
  const frozen = battle.world.tick;
  main.tick(30);
  assert.equal(battle.world.tick, frozen, 'the final frame holds while the commit is in flight');
  main.tick(30);
  assert.equal(main.dispatched.filter(entry => entry.command.type === 'combat/resolve-action').length, 1, 'no second dispatch');
  main.flush();
  assert.equal(main.state.phase, 'explore', 'the normal post-combat flow takes over');
  assert.ok(main.state.run.clearedNodeIds.includes('fog_lesser_demon'), 'the room is cleared');
  assert.equal(main.battle(), undefined, 'the controller is dropped');
  assert.equal(main.node('ActionBattleWorld'), undefined, 'the room replaces the battle');
  assert.ok(main.released.includes('monster:fog_lesser_demon_world'), 'the defeated monster figure is released after the fight');
  for (const key of ['character:reincarnator_action', 'scene:action_stage_demon_tower_1']) {
    assert.ok(main.held.has(key), `${key} stays warm while exploring the chapter`);
  }
  const committedHp = main.model().sections[1].metrics.find(metric => metric.id === 'hp')?.value;
  assert.ok(committedHp !== undefined && labelText(main.node('WalkPlayerStatus')) === committedHp, 'the header returns to the committed HP');
});
main.view.destroy();

// ---- 4b. Room -> fight -> room: leases and the loading overlay (after main is gone: keys are global) ----
check('room -> fight -> room never reloads art; the chapter keeps the battle art warm; the hub releases all of it', () => {
  const ACTION_ART = ['scene:action_stage_demon_tower_1', 'character:reincarnator_action', 'scene:battle_controls_ink'];
  const ROOM_ART = ['scene:dungeon_world_demon_tower_1', 'scene:dungeon_transition_gate', ...Object.values(api.INFINITE_FLOW_DUNGEON_PROP_VISUAL_KEYS)];
  const entered = commit(trial, { type: 'run/enter', dungeonId: 'demon_tower_1', protocolId: 'standard', seeds: ENTRY_SEEDS });
  const h = createHarness(entered);
  assert.equal(h.model().phase, 'explore');
  assert.deepEqual(h.loadingTitles, ['正在进入副本…'], 'entering the dungeon is the one load, under its own title');
  for (const key of [...ACTION_ART, ...ROOM_ART]) assert.ok(h.held.has(key), `${key} is held while exploring the chapter`);
  // Into the fight: the stage, the hero frames and the controls are already up; only the room's monster art is new
  // when the player was not standing in its room.
  const loadsBefore = h.loads.length;
  h.state = commit(h.state, { type: 'run/select-node', nodeId: 'fog_lesser_demon' });
  h.render();
  const battle = h.battle();
  assert.ok(battle, 'the fight is on');
  const entry = h.loads.slice(loadsBefore).flatMap(load => load.keys);
  assert.ok(entry.every(key => key.startsWith('monster:') && key.endsWith('_world')), `entering the fight loads only enemy figures (loaded ${entry.join(', ')})`);
  assert.ok(h.loadingTitles.slice(1).every(title => title === '正在进入战斗…'), `a fight's wait says so (saw ${h.loadingTitles.join(' / ')})`);
  facts.fightEntryLoads = entry;
  for (const key of ROOM_ART) assert.ok(h.held.has(key), `${key} stays held through the fight`);
  // Back to the room after the victory: nothing to load, no overlay.
  playUntil(h, () => battle.status === 'dispatching');
  assert.equal(battle.world.phase, 'won');
  const beforeReturn = h.loads.length;
  h.flush();
  assert.equal(h.model().phase, 'explore');
  assert.equal(h.loads.length, beforeReturn, `the room returns without a load (loaded ${h.loads.slice(beforeReturn).flatMap(load => load.keys).join(', ')})`);
  assert.ok(h.node('WalkScene') && !h.node('SceneAssetLoading'), 'the room is drawn at once');
  for (const key of [...ACTION_ART, ...ROOM_ART]) assert.ok(h.held.has(key), `${key} is still held in the room`);
  assert.ok(h.released.includes('monster:fog_lesser_demon_world'), 'the defeated monster figure is released');
  // Leaving the dungeon releases every dungeon and battle lease.
  h.state = trial;
  h.render();
  for (const key of [...ACTION_ART, ...ROOM_ART]) {
    assert.equal(h.held.has(key), false, `${key} is released in the hub`);
    assert.ok(h.released.includes(key));
  }
  h.view.destroy();
});

// ---- 4c. Boss room: the opening shot frames hero and boss, then follows; the plate leaves with the boss ----
check('the boss opening leans to the boss and frames the pair once they fit, then hands back to the follow; the plate goes when the boss falls', () => {
  // Stand in the boss room and fight it, as scripts/balance/action-calibrate.ts does: the real reducer starts the fight.
  const entered = commit(trial, { type: 'run/enter', dungeonId: 'demon_tower_1', protocolId: 'standard', seeds: ENTRY_SEEDS });
  const nodeId = api.getBossDefinition('demon_tower_1').nodeId;
  const bossFight = commit({ ...entered, run: { ...entered.run, currentNodeId: nodeId } }, { type: 'run/select-node', nodeId });
  const h = createHarness(bossFight);
  const battle = h.battle();
  assert.equal(battle.vm.rank, 'boss');
  const W = 390;
  const half = (body) => body.height * (body === hero ? 0.42 : 0.32) + 10;
  const whole = (body, tolerance = 0) => body.x - half(body) >= battle.camera.x - tolerance && body.x + half(body) <= battle.camera.x + W + tolerance;
  const boss = () => battle.world.entities.find(e => e.kind === 'enemy' && e.boss);
  const hero = battle.world.hero;
  const span = () => Math.max(hero.x + half(hero), boss().x + half(boss())) - Math.min(hero.x - half(hero), boss().x - half(boss()));
  h.tick();
  assert.ok(boss(), 'the boss is on the field from the first tick');
  facts.bossOpening = { heroX: hero.x, bossX: Math.round(boss().x), span: Math.round(span()), cameraX: Math.round(battle.camera.x) };
  assert.ok(battle.introFraming(), 'the opening shot is on');
  assert.ok(whole(hero), 'the opening frame holds the hero whole');
  if (span() > W) {
    assert.ok(Math.abs(battle.camera.x - (hero.x - half(hero))) < 1e-6,
      `while the pair does not fit, the camera leans as far toward the boss as keeps the hero whole (view ${battle.camera.x.toFixed(1)})`);
  } else {
    assert.ok(whole(boss()), 'the opening frame holds the boss whole');
  }
  const fresh = new api.ActionBattleController(battle.vm);
  fresh.advance(1 / 60);
  assert.ok(Math.abs(fresh.camera.x - battle.camera.x) < 1e-6, 'the opening frame is deterministic');
  // Untouched through the banner: as soon as the pair fits the view, both stay whole.
  let framed = 0;
  for (let frame = 0; frame < 90; frame += 1) {
    h.tick();
    if (span() > W - 24) continue;
    assert.ok(whole(hero, 2) && whole(boss(), 2), `frame ${frame}: the pair is framed (view ${battle.camera.x.toFixed(0)}, hero ${hero.x.toFixed(0)}, boss ${boss().x.toFixed(0)})`);
    framed += 1;
  }
  assert.ok(framed > 0, 'the pair came to fit during the intro');
  h.tick(60);
  assert.equal(battle.introFraming(), undefined, 'after the intro the ordinary follow leads');
  // The plate: on while the boss stands, off the moment it falls, even with the body still on the field.
  const plate = () => h.node('ActionBossPlate');
  assert.equal(plate().active, true, 'the plate shows the living boss');
  boss().hp = 0;
  h.tick();
  assert.ok(boss() && !boss().remove, 'the fallen boss is still on the field');
  assert.equal(plate().active, false, 'the plate is gone with the boss, not left at 0 HP');
  h.view.destroy();
});

// ---- 5. Defeat -> settlement; a failed and a refused commit retried ----
function lowHpFight(hp) {
  return fightIn({ ...trial, player: { ...trial.player, hp } }, 'demon_tower_1', 'fog_lesser_demon');
}
check('defeat commits once and settles; a thrown dispatch shows retry, which commits with a new physical input', () => {
  const h = createHarness(lowHpFight(3));
  const battle = h.battle();
  for (let i = 0; i < 60 * 60 && battle.status === 'fighting'; i += 1) h.tick();
  assert.equal(battle.world.phase, 'lost');
  for (let i = 0; i < 120 && battle.status === 'ending'; i += 1) h.tick();
  assert.equal(battle.status, 'dispatching');
  const first = h.dispatched.at(-1);
  h.failNext = 'throw';
  h.flush();
  assert.equal(h.battle(), battle, 'a failed commit keeps the fight on screen');
  assert.equal(battle.status, 'failed');
  assert.ok(h.node('ActionCommitPanel'), 'a clear message is shown');
  assert.match(labelText(h.node('ActionCommitDetail')), /行动失败/u);
  h.tick(30);
  assert.equal(h.dispatched.length, 1, 'never retried by itself');
  h.tap(h.node('ActionCommitRetry'));
  assert.equal(h.dispatched.length, 2, 'retry dispatches again');
  assert.notEqual(h.dispatched[1].physicalId, first.physicalId, 'as a new physical input');
  assert.deepEqual(h.dispatched[1].command.log, first.command.log, 'with the same log');
  h.flush();
  assert.equal(h.state.phase, 'result', 'defeat settlement');
  assert.equal(h.battle(), undefined);
  h.view.destroy();
});

check('a refused commit shows retry; retrying commits', () => {
  const h = createHarness(lowHpFight(3));
  const battle = h.battle();
  for (let i = 0; i < 60 * 60 && (battle.status === 'fighting' || battle.status === 'ending'); i += 1) h.tick();
  h.failNext = 'reject';
  h.flush();
  assert.equal(battle.status, 'failed');
  assert.match(labelText(h.node('ActionCommitDetail')), /不可执行/u);
  h.tap(h.node('ActionCommitRetry'));
  h.flush();
  assert.equal(h.state.phase, 'result');
  h.view.destroy();
});

check('a dispatch the App never picks up fails visibly instead of being dropped', () => {
  const h = createHarness(lowHpFight(3));
  const battle = h.battle();
  // The App is busy with something else (the View was not told): it ignores the commit, as InfiniteFlowApp.activate does.
  h.busy = 'other.action';
  for (let i = 0; i < 60 * 60 && (battle.status === 'fighting' || battle.status === 'ending'); i += 1) h.tick();
  assert.equal(battle.status, 'failed', 'an unpicked dispatch fails');
  assert.equal(h.dispatched.length, 0);
  assert.ok(h.node('ActionCommitPanel'), 'with its message');
  h.busy = undefined;
  h.tap(h.node('ActionCommitRetry'));
  assert.equal(h.dispatched.length, 1, 'retry dispatches');
  h.flush();
  assert.equal(h.state.phase, 'result');
  h.view.destroy();
});

// ---- 6. Escape: success leaves, failure restarts from the new encounter ----
function escapeOutcome(state) {
  const result = api.reduceGameCommand(state, { type: 'combat/act', action: 'escape' });
  return result.status === 'committed' ? result.state : undefined;
}
check('escape goes through the confirmation; success leaves, failure restarts the fight from the new encounter', () => {
  // Escape is a speed check: the chapter trial hero outruns the fog demon, a slow fresh hero does not.
  const initial = api.createInitialState();
  const slow = { ...initial, player: { ...initial.player, base: { ...initial.player.base, agility: 1, luck: 0 } } };
  const success = fightIn(trial, 'demon_tower_1', 'fog_lesser_demon');
  const failure = fightIn(slow, 'demon_tower_1', 'fog_lesser_demon');
  assert.equal(escapeOutcome(success)?.phase, 'explore', 'fixture: the escape succeeds');
  assert.equal(escapeOutcome(failure)?.phase, 'combat', 'fixture: the escape fails');
  for (const [state, expected] of [[success, 'explore'], [failure, 'combat']]) {
    const h = createHarness(state);
    const before = h.battle();
    h.tick(30);
    h.tap(h.node('ActionControl:escape'));
    assert.equal(h.view.mobileSheet?.tab, 'confirm-combat', 'escape asks for confirmation first');
    assert.equal(h.dispatched.length, 0);
    h.tap(h.node('MobileSheetExecute:combat.action:escape'));
    assert.equal(h.dispatched.length, 1);
    assert.deepEqual(h.dispatched[0].command, { type: 'combat/act', action: 'escape' }, 'the turn-based escape command');
    const loadsBefore = h.loads.length;
    h.flush();
    assert.equal(h.state.phase, expected);
    assert.equal(h.loads.length, loadsBefore, `${expected}: no art to load after the escape (loaded ${h.loads.slice(loadsBefore).flatMap(load => load.keys).join(', ')})`);
    if (expected === 'combat') {
      const after = h.battle();
      assert.ok(after && after !== before && after.key !== before.key, 'a failed escape exposes a new encounter');
      assert.equal(after.world.tick, 0, 'the fight restarts');
    } else {
      assert.equal(h.battle(), undefined);
    }
    h.view.destroy();
  }
});

// ---- 7. Capture: offered only while the replay allows it, committed with the capture ----
check('the capture control appears with the capture window and commits with the capture', () => {
  const h = createHarness(fightIn(netTrial, 'demon_tower_1', 'fog_lesser_demon'));
  const battle = h.battle();
  assert.ok(battle.vm.capture, 'the room offers a capture');
  assert.equal(h.node('ActionControl:capture').active, false, 'hidden until the target is weak');
  playUntil(h, () => battle.canCapture() || battle.world.phase !== 'fight');
  assert.ok(battle.canCapture(), 'the primary reached the capture line alive');
  facts.capture = { simSeconds: Number(battle.world.time.toFixed(1)), pet: battle.vm.capture.petId };
  h.tick();
  const control = h.node('ActionControl:capture');
  if (!battle.canCapture()) throw new Error('the capture window closed in one frame');
  assert.equal(control.active, true, 'the capture control is shown');
  h.tap(control);
  const sent = h.dispatched.at(-1);
  assert.equal(sent.command.type, 'combat/resolve-action');
  assert.equal(sent.command.capture, battle.vm.capture.petId, 'the commit carries the capture');
  const loadsBefore = h.loads.length;
  h.flush();
  assert.equal(h.loads.length, loadsBefore, `the room returns after a capture without a load (loaded ${h.loads.slice(loadsBefore).flatMap(load => load.keys).join(', ')})`);
  assert.ok(h.state.ownedPets.includes(battle.vm.capture.petId), 'the pet is captured');
  assert.notEqual(h.state.phase, 'combat');
  h.view.destroy();
});

// ---- 8. Reload restarts the fight ----
check('re-entering after a reload restarts the fight from the view model', () => {
  const first = createHarness(fightState);
  first.tick(240);
  const progressed = first.battle();
  assert.ok(progressed.world.tick > 200);
  const reloaded = createHarness(fightState);
  const fresh = reloaded.battle();
  assert.equal(fresh.key, progressed.key, 'the same encounter');
  assert.equal(fresh.world.tick, 0, 'starts over');
  assert.equal(fresh.world.hero.hp, fresh.vm.config.heroStart.hp, 'from the committed HP');
  first.view.destroy();
  reloaded.view.destroy();
});

// ---- 9. Timeout guard, keyboard, hide ----
check('a fight that hits maxTicks undecided is surfaced, never committed', () => {
  const vm = api.getInfiniteFlowActionBattle(api.buildGameViewModel(fightState, {}));
  const battle = new api.ActionBattleController({ ...vm, maxTicks: 40 });
  for (let i = 0; i < 80; i += 1) battle.advance(1 / 60);
  assert.equal(battle.status, 'timeout');
  assert.equal(battle.ticks, 40, 'the log never grows past the bound');
  assert.equal(battle.takeCommitRequest(), undefined, 'nothing to commit');
});

check('keyboard plays on desktop; hiding the game drops held input', () => {
  const h = createHarness(fightState);
  const battle = h.battle();
  h.key('key-down', 68);
  h.tick(20);
  assert.equal(battle.world.hero.state, 'run', 'D runs');
  h.key('key-up', 68);
  h.tick(10);
  h.key('key-down', 74);
  h.key('key-up', 74);
  let attacked = false;
  for (let i = 0; i < 10 && !attacked; i += 1) { h.tick(); attacked = battle.world.hero.state === 'attack1'; }
  assert.ok(attacked, 'J attacks');
  const id = ++touchSerial;
  const rest = h.layout().stick.rest;
  h.touchZone('touch-start', id, rest.x, rest.y);
  h.touchZone('touch-move', id, rest.x + 40, rest.y);
  assert.equal(battle.stickView.active, true);
  globalThis.__actionGame.emit('game-hide');
  assert.equal(battle.stickView.active, false, 'hide drops the touch');
  h.view.destroy();
  assert.equal(globalThis.__actionInput.count('key-down'), 0, 'listeners are released with the scene');
});

// ---- 10. Layout: touch boxes, overlaps, safe areas, the stick zone ----
check('controls keep 104-unit touch boxes without overlap at 750x1334, 320x568 and 390x844, with safe areas', () => {
  const cases = [
    [{ width: 375, height: 667 }, { top: 0, right: 0, bottom: 0, left: 0 }],
    [{ width: 320, height: 568 }, { top: 0, right: 0, bottom: 0, left: 0 }],
    [{ width: 390, height: 844 }, { top: 0, right: 0, bottom: 0, left: 0 }],
    [{ width: 390, height: 844 }, { top: 47, right: 0, bottom: 34, left: 0 }],
    [{ width: 320, height: 568 }, { top: 20, right: 0, bottom: 20, left: 0 }],
  ];
  for (const [frame, cssInsets] of cases) {
    const label = `${frame.width}x${frame.height} safe ${cssInsets.top}/${cssInsets.bottom}`;
    const h = createHarness(fightIn(netTrial, 'demon_tower_1', 'fog_lesser_demon'), { frame, cssInsets });
    const layout = h.layout();
    const controls = ['skill', 'spell', 'item', 'escape'].map(id => ({ id, node: h.node(`ActionControl:${id}`) }));
    const capture = layout.controls.capture;
    const boxes = controls.map(({ id, node }) => ({ id, box: bounds(node) }));
    boxes.push({ id: 'capture', box: { left: 375 + layout.shiftX + capture.x - capture.hit / 2, right: 375 + layout.shiftX + capture.x + capture.hit / 2,
      bottom: h.surfaceHeight / 2 + capture.y - capture.hit / 2, top: h.surfaceHeight / 2 + capture.y + capture.hit / 2, width: capture.hit, height: capture.hit } });
    const safeBottom = h.insets.bottom;
    for (const { id, box } of boxes) {
      assert.ok(box.width >= 104 - 1e-6 && box.height >= 104 - 1e-6, `${label}: ${id} touch box ${box.width.toFixed(1)} >= 104`);
      assert.ok(box.bottom >= safeBottom - 1e-6, `${label}: ${id} clears the safe bottom`);
      assert.ok(box.left >= h.insets.left - 1e-6 && box.right <= 750 - h.insets.right + 1e-6, `${label}: ${id} inside the safe width`);
    }
    boxes.forEach((a, index) => boxes.slice(index + 1).forEach(b => assert.ok(!overlap(a.box, b.box), `${label}: ${a.id} and ${b.id} do not overlap`)));
    const zone = h.node('ActionStickZone');
    const zoneBox = bounds(zone);
    for (const name of ['SceneDetails', 'SceneHelp', 'SceneCodex', 'SceneCharacter']) {
      const node = h.node(name);
      assert.ok(node, `${label}: ${name} exists`);
      assert.ok(!overlap(zoneBox, bounds(node)), `${label}: the stick zone stays clear of ${name}`);
    }
    const sceneNode = h.node('WalkScene');
    const order = (name) => sceneNode.children.indexOf(h.node(name));
    for (const name of ['ActionControl:skill', 'ActionControl:spell', 'ActionControl:item', 'ActionControl:escape', 'ActionControl:capture', 'WalkHud', 'SceneDetails', 'SceneHelp']) {
      assert.ok(order('ActionStickZone') < order(name), `${label}: ${name} draws (and hit-tests) above the stick zone`);
    }
    const plate = layout.bossPlate;
    assert.ok(h.surfaceHeight / 2 + plate.y + plate.height / 2 <= bounds(h.node('SceneCodex')).bottom + 1e-6, `${label}: the boss plate sits below 背包 / 菜单 / 目标`);
    assert.ok((layout.bandBottom - layout.bandTop) === 200 && layout.floorTop > 0, `${label}: the band fits`);
    h.view.destroy();
  }
});

console.log(JSON.stringify(facts));
console.log(`COCOS_ACTION_BATTLE_VALID ${checks} checks: declared art, touch play (drag, auto-combo, flick), pause on re-render, one commit + replay, room <-> fight leases without reloads, boss opening shot + plate, defeat, retry after failure / refusal, escape success / failure, capture, reload restart, timeout, keyboard, layout (5 viewports)`);
