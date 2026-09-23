import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../../', import.meta.url));
const captureKey = '__INFINITE_FLOW_MOBILE_ACTION_MODELS__';
const captureStateKey = `${captureKey}_STATES`;
const ccStub = `
export class Node {
  constructor(name='') { this.name=name; this.children=[]; this.components=[]; this.events=new Map(); }
  addChild(child) { this.children.push(child); child.parent=this; }
  setPosition(position) { this.position=position; }
  setScale() {} setSiblingIndex() {}
  getChildByName(name) { return this.children.find(child=>child.name===name) ?? null; }
  addComponent(Type) { const component=new Type(); component.node=this; this.components.push(component); return component; }
  getComponent(Type) { return this.components.find(component=>component instanceof Type) ?? null; }
  on(event, callback) { const list=this.events.get(event) ?? []; list.push(callback); this.events.set(event,list); }
  emit(event) { for(const callback of this.events.get(event) ?? []) callback(); }
}
export class UITransform { setContentSize(size) { this.contentSize=size; } }
export class Size { constructor(width,height) { Object.assign(this,{width,height}); } }
export class Vec3 { constructor(x,y,z) { Object.assign(this,{x,y,z}); } }
export class Color { constructor(r,g,b,a=255) { Object.assign(this,{r,g,b,a}); } }
export class Label {
  static HorizontalAlign={LEFT:0,CENTER:1,RIGHT:2};
  static VerticalAlign={TOP:0,CENTER:1,BOTTOM:2};
  static Overflow={SHRINK:0,CLAMP:1};
}
export class Graphics {
  constructor() { this.clear(); }
  roundRect(x,y,width,height,radius) { this.roundRectCalls+=1; this.shape={kind:'roundRect',x,y,width,height,radius}; }
  rect(x,y,width,height) { this.shape={kind:'rect',x,y,width,height}; }
  circle(x,y,radius) { this.circleCalls+=1; this.shape={kind:'circle',x,y,radius}; }
  moveTo(x,y) { this.shape={kind:'path',points:[{x,y}],closed:false}; }
  lineTo(x,y) { if(this.shape?.kind==='path') this.shape.points.push({x,y}); }
  close() { if(this.shape?.kind==='path') this.shape.closed=true; }
  fill() { this.fills.push({color:this.fillColor,shape:this.shape}); }
  stroke() { this.strokes.push({color:this.strokeColor,shape:this.shape}); }
  clear() { this.fills=[]; this.strokes=[]; this.shape=undefined; this.roundRectCalls=0; this.circleCalls=0; }
}
export class BlockInputEvents {} export class EventTouch {} export class ImageAsset {}
export class Mask { static Type={GRAPHICS_RECT:0}; }
export class ScrollView {
  static EventType={SCROLLING:'scrolling'};
  set content(node) { this._content = node; }
  get content() { return this._content; }
  getScrollOffset() { const offset=this.offset ?? { x: 0, y: 0 }; return { x: -offset.x, y: offset.y }; }
  scrollToOffset(offset) { this.offset={x:offset.x,y:offset.y}; this.node.emit('scrolling'); }
}
export class Rect {} export class Sprite { static SizeMode={CUSTOM:0,RAW:1,TRIMMED:2}; } export class SpriteFrame {} export class Vec2 { constructor(x=0,y=0) { Object.assign(this,{x,y}); } }
export const Input={EventType:{}}; export const KeyCode={}; export const input={}; export const game={}; export const Game={};
export const view={ frameSize:{width:0,height:0}, getFrameSize(){ return this.frameSize; } };
`;

// Reuse the repository's real presentation regression states (commissions,
// memory, growth, battle and settlements). The capture wrapper exists only in
// this in-memory bundle; no production or existing test source is changed.
globalThis[captureKey] = [];
globalThis[captureStateKey] = new Map();
const bundle = await build({
  stdin: {
    contents: `
      import './packages/presentation/test/view-model.test.ts';
      export { buildGameViewModel, buildHubOwnedLoadoutViewModel, HUB_PANELS } from './packages/presentation/src/index.ts';
      export { createInitialState, DUNGEONS, DUNGEON_ORDER, EQUIPMENT, ITEMS } from '@infinite-flow/core';
      export { reduceGameCommand } from '@infinite-flow/application';
      export { signalFirstNodeClear, recordCombatReplayTake, DUNGEON_LAW_LANDMARKS } from '@infinite-flow/core/dungeon-laws';
      export { EQUIPMENT_SOUL_SKILL_CATALOG } from '@infinite-flow/core/equipment-soul-skills';
      export { renderInfiniteFlowInfoSheet, captureInfiniteFlowInfoSheetState, getInfiniteFlowMobilePanelActions, productionFrameGeometry } from './cocos/assets/scripts/ui/InfiniteFlowInfoSheet.ts';
      export { renderInfiniteFlowWalkScene } from './cocos/assets/scripts/ui/InfiniteFlowWalkScene.ts';
      export { buildWalkWorld } from './cocos/assets/scripts/ui/walk-world.ts';
      export { formatInfiniteFlowHubActionLockedReason, formatInfiniteFlowHubPlayerCopy } from './cocos/assets/scripts/ui/InfiniteFlowView.ts';
      export { DARK_UI } from './cocos/assets/scripts/ui/dark-ui.ts';
      export { Node, UITransform, Label, Graphics, BlockInputEvents, Mask, ScrollView, Vec2, view } from 'cc';
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
    name: 'mobile-action-real-model-capture',
    setup(builder) {
      builder.onResolve({ filter: /^cc$/ }, () => ({ path: 'cc', namespace: 'mobile-cc-stub' }));
      builder.onLoad({ filter: /.*/, namespace: 'mobile-cc-stub' }, () => ({ contents: ccStub }));
      builder.onLoad({ filter: /packages\/presentation\/src\/view-model\.ts$/ }, async ({ path }) => {
        const source = await readFile(path, 'utf8');
        assert.equal(source.split('export function buildGameViewModel(').length, 2, 'one presentation builder to capture');
        return {
          contents: source.replace('export function buildGameViewModel(', 'function buildGameViewModelCaptured(') + `
            export function buildGameViewModel(...args: Parameters<typeof buildGameViewModelCaptured>) {
              const model = buildGameViewModelCaptured(...args);
              (globalThis as any)[${JSON.stringify(captureKey)}]?.push(model);
              (globalThis as any)[${JSON.stringify(captureStateKey)}]?.set(model, args[0]);
              return model;
            }
          `,
          loader: 'ts',
        };
      });
    },
  }],
});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const models = globalThis[captureKey];
const stateByModel = globalThis[captureStateKey];
delete globalThis[captureStateKey];
delete globalThis[captureKey];
assert.ok(models.length > 100, 'real presentation fixtures were captured');
const sourceFixtureCount = models.length;
const add = (state, local = {}) => {
  const model = api.buildGameViewModel(state, local);
  models.push(model);
  stateByModel.set(model, state);
  return model;
};
function commit(state, command) {
  const result = api.reduceGameCommand(state, command);
  assert.equal(result.status, 'committed', `${command.type}: ${result.reason?.message}`);
  return result.state;
}
function enter(state, dungeonId = api.DUNGEON_ORDER[0]) {
  return commit(state, { type: 'run/enter', dungeonId, protocolId: 'standard', seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_5678 } });
}

const initial = api.createInitialState();
const rich = {
  ...initial,
  rewardPoints: 50_000,
  lingyun: 500,
  inventory: Object.fromEntries(Object.keys(api.ITEMS).map((id) => [id, 50])),
  completedDungeonIds: [...api.DUNGEON_ORDER],
};
const hubSuppliesModel = add({ ...rich, player: { ...rich.player, hp: 1 } }, { hubPanel: 'supplies' });
let trained = rich;
for (const command of [
  { type: 'hub/learn-method', methodId: 'mist_breathing' },
  { type: 'hub/recruit-companion', companionId: 'qin_che' },
  { type: 'hub/unlock-bloodline', bloodlineId: 'titan_marrow' },
  { type: 'hub/configure-tactical-loadout', itemIds: ['thunder_talisman', 'dispel_talisman'] },
]) trained = commit(trained, command);
const trainedRun = enter(trained);
const trainedCombat = commit(trainedRun, { type: 'run/select-node', nodeId: trainedRun.run.currentNodeId });
add({ ...trainedCombat, player: { ...trainedCombat.player, hp: trainedCombat.player.maxHp - 10 } }, { advancedCombatExpanded: true });

// Walk every actual catalog through its original local "next" action. Both
// initial and funded saves cover unavailable explanations and payable commands.
const catalogEntries = {};
for (const hubPanel of api.HUB_PANELS.filter((panel) => panel !== 'entry')) {
  for (const state of [initial, rich]) {
    let selected;
    const seen = new Set();
    for (let iteration = 0; iteration < 256; iteration += 1) {
      const model = add(state, { hubPanel, hubSelections: { [hubPanel]: selected } });
      const next = model.sections[2].actions.find((action) => action.actionId === `hub.${hubPanel}.select:next`);
      if (next?.event?.kind !== 'local') break;
      assert.equal(next.event.action.type, 'hub/select-catalog-entry');
      const nextId = next.event.action.entityId;
      if (seen.has(nextId)) break;
      seen.add(nextId);
      selected = nextId;
      assert.ok(iteration < 255, `${hubPanel} catalog terminates`);
    }
    catalogEntries[hubPanel] = Math.max(catalogEntries[hubPanel] ?? 0, seen.size);
  }
}

// Concrete default-save regression: win the opening fight, then use the real
// movement action to reach the optional blood-rune event with no pet or method.
let defaultTrap = enter(initial);
defaultTrap = commit(defaultTrap, add(defaultTrap).sections[2].actions.find((action) => action.actionId === 'node.select:fog_lesser_demon').event.command);
for (let turn = 0; defaultTrap.phase === 'combat'; turn += 1) {
  assert.ok(turn < 10, 'default opening combat resolves');
  const combat = add(defaultTrap, { advancedCombatExpanded: true });
  defaultTrap = commit(defaultTrap, combat.sections[2].actions.find((action) => action.actionId === 'combat.action:attack').event.command);
}
const moveToTrap = add(defaultTrap).sections[2].actions.find((action) => action.event?.kind === 'command' && action.event.command.type === 'run/move' && action.event.command.nodeId === 'blood_rune_trap');
defaultTrap = commit(defaultTrap, moveToTrap.event.command);
const trapModel = add(defaultTrap);
assert.equal(trapModel.sections[1].detail.pending?.kind, 'dungeon-event');
const trapRisk = trapModel.sections[2].actions.find((action) => action.actionId === 'node.trap:blood_rune_trap:risk');
assert.equal(trapRisk.enabled, true);
assert.ok(api.getInfiniteFlowMobilePanelActions(trapModel, 'interaction').includes(trapRisk), 'default optional-event trap keeps its executable base risk branch');

// Project known nodes from valid entered runs. State fixtures vary the public
// domain snapshot; every action is still produced by the real VM builder.
// Applying the domain's clear signal creates each chapter's authentic pending
// law shape instead of constructing presentation actions by hand.
const allSkills = api.EQUIPMENT_SOUL_SKILL_CATALOG.map(({ id }) => id);
const enteredByDungeon = new Map();
for (const dungeonId of api.DUNGEON_ORDER) {
  const entered = enter(rich, dungeonId);
  enteredByDungeon.set(dungeonId, entered);
  add(rich, { hubPanel: 'entry', entryDraft: { dungeonId, protocolId: 'standard' } });
  for (const currentNode of api.DUNGEONS[dungeonId].nodes) {
    for (const cleared of [false, true]) {
      const lawState = cleared
        ? api.signalFirstNodeClear(entered.run.lawState, { node: currentNode, damageTaken: 0 })
        : entered.run.lawState;
      add({
        ...entered,
        run: {
          ...entered.run,
          currentNodeId: currentNode.id,
          clearedNodeIds: cleared ? [currentNode.id] : [],
          lawState,
          soulSkillState: { rulesVersion: 1, frozenSkillIds: allSkills, readySkillIds: allSkills, chargesRemaining: 2, usedRechargeIds: [] },
        },
      });
    }
  }
}

// These laws require several prior signals before their final choice appears.
for (const dungeonId of ['false_testimony_court', 'panopticon_city', 'combat_replay_stage']) {
  const entered = enteredByDungeon.get(dungeonId);
  let lawState = entered.run.lawState;
  let currentNodeId;
  const landmarks = api.DUNGEON_LAW_LANDMARKS[dungeonId];
  if (dungeonId === 'combat_replay_stage') {
    for (const nodeId of landmarks.takeNodeIds) {
      const resolution = api.recordCombatReplayTake(lawState, nodeId, 'attack', 12);
      assert.equal(resolution.recorded, true);
      lawState = resolution.state;
      currentNodeId = nodeId;
    }
  } else {
    const nodeIds = dungeonId === 'false_testimony_court'
      ? [...landmarks.evidenceNodeIds, 'verdict_chamber'] : landmarks.relayNodeIds;
    for (const nodeId of nodeIds) {
      const currentNode = api.DUNGEONS[dungeonId].nodes.find((node) => node.id === nodeId);
      lawState = api.signalFirstNodeClear(lawState, { node: currentNode, damageTaken: 0 });
      currentNodeId = nodeId;
    }
  }
  add({ ...entered, run: { ...entered.run, currentNodeId, clearedNodeIds: [...lawState.clearedNodeIds], lawState } });
}

const chrome = { modeKind: 'preview', modeLabel: '', modeDetail: '' };
const safeInsets = { top: 91, right: 0, bottom: 66, left: 0 };
function render(model, state, insets = safeInsets, extras = {}) {
  const rootNode = new api.Node('MobileActionTest');
  const local = new Map();
  const actions = new Map();
  let nextState;
  const shop = model.sections[1].detail.shop;
  const services = model.sections[1].detail.entryServices ?? [];
  const pool = [...services.flatMap(service => service.options.map(option => option.action)), ...(extras.actionPool ?? []), ...(shop?.rows.flatMap(row => row.actions) ?? []), ...(shop?.services ?? [])];
  api.renderInfiniteFlowInfoSheet(rootNode, model, state, {
    chrome: extras.chrome ?? chrome, safeInsets: insets, surfaceHeight: 1334,
    bindLocal: (node, callback) => local.set(node.name, callback),
    bindAction: (node, action) => {
      assert.ok(model.sections[2].actions.includes(action) || pool.includes(action),
        `${node.name}: exact original action object (model or declared auxiliary pool)`);
      actions.set(node.name, action);
    },
    ...(extras.supplyActions === undefined ? {} : { supplyActions: extras.supplyActions }),
    ...(extras.ownedLoadout === undefined ? {} : { ownedLoadout: extras.ownedLoadout }),
    close() {}, setState(next) { nextState = next; }, openHelp() {},
  });
  const labels = [];
  const visit = (node) => {
    const label = node.getComponent(api.Label);
    if (label !== null) labels.push({ name: node.name, text: label.string });
    for (const child of node.children) visit(child);
  };
  visit(rootNode);
  return { rootNode, local, actions, labels, nextState: () => nextState };
}

const rgb = (color) => [color.r, color.g, color.b];
function contrast(foreground, background) {
  const luminance = (color) => rgb(color).reduce((sum, value, index) => {
    const channel = value / 255;
    return sum + (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
      * [0.2126, 0.7152, 0.0722][index];
  }, 0);
  const values = [luminance(foreground), luminance(background)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}
function nodesIn(rootNode) {
  return [rootNode, ...rootNode.children.flatMap(nodesIn)];
}
function nativeFrame(node) {
  const graphics = node.getComponent(api.Graphics);
  const size = node.getComponent(api.UITransform)?.contentSize;
  // The first fill paints the reading surface. An ornate frame's last fill is
  // decorative gold, not the background behind its body text.
  const frame = graphics?.fills[0];
  const shape = frame?.shape;
  if (shape?.kind !== 'path' || shape.points.length < 8 || !size) return undefined;
  const xs = shape.points.map(({ x }) => x), ys = shape.points.map(({ y }) => y);
  return Math.max(...xs) - Math.min(...xs) === size.width && Math.max(...ys) - Math.min(...ys) === size.height ? frame : undefined;
}
function assertNativeFrame(node, name) {
  const graphics = node?.getComponent(api.Graphics);
  assert.ok(graphics, `${name}: native Graphics frame exists`);
  const frame = nativeFrame(node);
  assert.ok(frame, `${name}: full-size cut-corner polygon exists`);
  const points = frame.shape.points;
  assert.ok(frame.shape.closed || (points[0].x === points.at(-1).x && points[0].y === points.at(-1).y),
    `${name}: frame path is closed`);
  assert.ok(points.some((point, index) => {
    const next = points[(index + 1) % points.length];
    return point.x !== next.x && point.y !== next.y;
  }), `${name}: corners are cut diagonally`);
  assert.equal(graphics.roundRectCalls, 0, `${name}: no rounded surface`);
  assert.equal(graphics.circleCalls, 0, `${name}: no circular control`);
  return frame;
}

let darkSheetVisualCases = 0;
let darkBodyLabels = 0;
let darkMinimumBodyContrast = Infinity;
const darkSemanticText = new Set();
const directNavigationTypes = new Set(['hub/select-panel', 'hub/select-catalog-entry', 'entry/select-dungeon']);
function catalogCssUnit() {
  const frame = api.view.getFrameSize();
  return frame.width > 0 && frame.height > 0
    ? 1 / Math.min(frame.width / 750, frame.height / 1334)
    : 750 / 390;
}
const isCatalogSurface = (node) => /^(?:MobileSheetShop(?:Action:.*|More:.*|Services)|MobileSheetCatalogDetailClose|MobileSheetCatalogDetail|MobileSheetCatalogMore|MobileSheetCatalogCancelAction|MobileSheetCatalogActionMenu|MobileSheetEntryConfirm|MobileSheetEntryBack|ShopIconFrame)$/.test(node.name);
function catalogFrame(node) {
  if (!isCatalogSurface(node)) return undefined;
  const frame = node.getComponent(api.Graphics)?.fills[0];
  const shape = frame?.shape;
  const size = node.getComponent(api.UITransform)?.contentSize;
  return shape?.kind === 'roundRect' && size
    && shape.x === -size.width / 2 && shape.y === -size.height / 2
    && shape.width === size.width && shape.height === size.height ? frame : undefined;
}
function readingFrame(node) {
  return isCatalogSurface(node) ? catalogFrame(node) : nativeFrame(node);
}
function assertCatalogSurfaces(view) {
  const unit = catalogCssUnit();
  for (const node of nodesIn(view.rootNode).filter(isCatalogSurface)) {
    const graphics = node.getComponent(api.Graphics);
    const frame = catalogFrame(node);
    assert.ok(frame, `${node.name}: catalog paints its own full-size rounded reading surface`);
    assert.equal(graphics.roundRectCalls, 1, `${node.name}: one compact rounded frame`);
    assert.equal(graphics.circleCalls, 0, `${node.name}: no circular control`);
    assert.equal(graphics.fills.length, 1, `${node.name}: no decorative fill obscures the actual background`);
    assert.equal(graphics.strokes.length, 1, `${node.name}: one unobtrusive border`);
    assert.ok(Math.abs(frame.shape.radius / unit - 3) < 0.001, `${node.name}: prototype 3px corner radius`);
    assert.ok(Math.abs(graphics.lineWidth / unit - 1) < 0.001, `${node.name}: prototype 1px border`);
    for (const child of nodesIn(node)) {
      const label = child.getComponent(api.Label);
      if (label?.string) assert.ok(contrast(label.color, frame.color) >= 4.5,
        `${node.name}/${child.name}: readable against its actual catalog fill`);
    }
  }
}
function assertDarkSheet(view, kind, insets) {
  const nodes = nodesIn(view.rootNode);
  assertCatalogSurfaces(view);
  const get = (name) => nodes.find((node) => node.name === name);
  const panel = get(`MobileInfoSheet:${kind}`);
  const expected = api.productionFrameGeometry(insets, 1334, kind);
  const { width, height } = expected;
  const frame = assertNativeFrame(panel, kind);
  assert.deepEqual(rgb(frame.color), rgb(api.DARK_UI.panel), `${kind}: shared dark reading surface`);
  assert.deepEqual({ ...panel.position }, { x: expected.centerX, y: expected.centerY, z: 0 });
  assert.deepEqual({ ...panel.getComponent(api.UITransform).contentSize }, { width, height });
  assert.ok(panel.getComponent(api.BlockInputEvents), `${kind}: the modal still blocks world input`);
  assert.ok(get('MobileSheetBackdrop').getComponent(api.BlockInputEvents));
  const band = get('MobileSheetTitleBand');
  assertNativeFrame(band, `${kind}/title-band`);
  assert.deepEqual({ ...band.getComponent(api.UITransform).contentSize }, { width: width - 20, height: 72 });
  const close = get('MobileSheetClose');
  assertNativeFrame(close, `${kind}/close`);
  assert.deepEqual({ ...close.getComponent(api.UITransform).contentSize }, { width: 104, height: 104 });
  assert.deepEqual({ ...close.position }, { x: width / 2 - 70, y: height / 2 - 52, z: 0 });
  assert.ok(view.local.has('MobileSheetClose'), `${kind}: original close callback remains available`);
  const headerGraphics = get('MobileSheetHeaderIcon').getComponent(api.Graphics);
  assert.ok(headerGraphics.strokes.length + headerGraphics.fills.length > 0,
    `${kind}: header uses native vector artwork`);
  for (const [name, action] of view.actions) {
    if (name.startsWith('MobileSheetAction:')) {
      assert.equal(action.event?.kind, 'local', `${kind}/${name}: list shortcuts cannot execute domain commands`);
      assert.ok(directNavigationTypes.has(action.event.action.type), `${kind}/${name}: only original local navigation bypasses details`);
    } else if (name.startsWith('MobileSheetEntryOption:') || name.startsWith('MobileSheetEntryDungeon:') || name === 'MobileSheetEntryConfirm') {
      assert.equal(kind, 'entry', 'entry controls belong to the portal sheet');
      assert.ok(action.enabled && action.event, 'entry binds only executable projected actions');
      if (name === 'MobileSheetEntryConfirm') {
        assert.equal(action.actionId, 'hub.entry.confirm', 'only the original entry request appears in the footer');
        assert.ok(Math.abs(get(name).getComponent(api.UITransform).contentSize.height / catalogCssUnit() - 44) < 0.6, 'entry button has the compact 44 CSS-pixel height');
      } else {
        assert.notEqual(action.actionId, 'hub.entry.confirm', 'service choices never enter the dungeon');
      }
    } else if (name.startsWith('MobileSheetShopAction:')) {
      assert.ok(kind === 'npc' || kind === 'character', 'catalog direct action stays on its owning sheet');
      assert.ok(action.enabled && action.event, 'catalog directly binds only executable original actions');
      assert.ok(Math.abs(get(name).getComponent(api.UITransform).contentSize.height / catalogCssUnit() - 44) < 0.6,
        'catalog actions retain the prototype 44 CSS-pixel height');
    } else {
      assert.ok(name.startsWith('MobileSheetExecute:'), `${kind}/${name}: an action must use the explicit confirmation control`);
      const confirm = action.event?.kind === 'local' && action.event.action.type === 'entry/request-enter' ? '确认入场' : '确认执行';
      assert.ok(nodesIn(get(name)).some((node) => node.getComponent(api.Label)?.string === confirm), `${kind}/${name}: explicit confirmation wording is preserved`);
    }
  }
  for (const node of nodes) {
    if (/^(MobileSheet(?:Previous|Next|ActionBack|MetricBack|MapBack|RelatedHelp|Readout|TipClose)$|MobileSheet(?:Execute|Tab|Action|Metric|Help|Shortcut|MapCell|Fog|TipCarry):)/.test(node.name)) {
      assertNativeFrame(node, `${kind}/${node.name}`);
    }
    if (/^MobileSheet(?:Previous$|Next$|ActionBack$|MetricBack$|MapBack$|RelatedHelp$|Execute:|TipClose$|TipCarry:)/.test(node.name)) {
      assert.equal(node.getComponent(api.UITransform).contentSize.height, 104, `${kind}/${node.name}: original 104px touch height`);
    }
    const label = node.getComponent(api.Label);
    if (!label?.string) continue;
    let ancestor = node.parent;
    while (ancestor && readingFrame(ancestor) === undefined) ancestor = ancestor.parent;
    assert.ok(ancestor, `${kind}/${node.name}: body label has a known reading surface`);
    const background = readingFrame(ancestor).color;
    const ratio = contrast(label.color, background);
    darkMinimumBodyContrast = Math.min(darkMinimumBodyContrast, ratio);
    assert.ok(ratio >= 4.5, `${kind}/${node.name}: body contrast ${ratio.toFixed(2)} must be >= 4.5`);
    for (const semantic of ['red', 'green']) {
      if (rgb(label.color).every((value, index) => value === rgb(api.DARK_UI[semantic])[index])) darkSemanticText.add(semantic);
    }
    darkBodyLabels += 1;
  }
  darkSheetVisualCases += 1;
}

const sheetFixtures = [
  ['character', models.find((model) => model.phase === 'hub')],
  ['inventory', models.find((model) => model.phase === 'hub')],
  ['map', models.find((model) => model.phase === 'explore')],
  ['objectives', models.find((model) => model.phase === 'explore')],
  ['log', models.find((model) => model.phase === 'explore')],
  ['menu', models.find((model) => model.phase === 'combat')],
  ['interaction', trapModel],
  ['entry', models.find((model) => model.sections[1].detail.kind === 'hub' && model.sections[1].detail.activePanel === 'entry')],
  ['npc', models.find((model) => model.sections[1].detail.kind === 'hub' && model.sections[1].detail.activePanel !== 'entry')],
  ['help', models.find((model) => model.phase === 'explore')],
  ['result', models.find((model) => model.phase === 'result')],
];
assert.equal(sheetFixtures.length, 11);
for (const [kind, model] of sheetFixtures) {
  assert.ok(model, `${kind}: reuse an existing authentic presentation fixture`);
  for (const insets of [safeInsets, { top: 160, right: 28, bottom: 110, left: 18 }]) {
    assertDarkSheet(render(model, { kind, page: 0 }, insets), kind, insets);
  }
  const action = api.getInfiniteFlowMobilePanelActions(model, kind).find((candidate) => candidate.enabled);
  if (action && ['interaction', 'inventory', 'result'].includes(kind)) {
    const detail = render(model, { kind, page: 0, tab: 'actions', selectedActionId: action.actionId });
    assertDarkSheet(detail, kind, safeInsets);
    assert.equal(detail.actions.get(`MobileSheetExecute:${action.actionId}`), action,
      `${kind}: dark confirmation keeps the original event object`);
  }
}
for (const [severity, semantic] of [['danger', 'red'], ['positive', 'green']]) {
  const model = models.find((entry) => entry.sections[1].metrics.some((metric) => metric.severity === severity));
  assert.ok(model, `${severity}: authentic status fixture exists`);
  const metricIndex = model.sections[1].metrics.findIndex((metric) => metric.severity === severity);
  assertDarkSheet(render(model, { kind: 'character', page: Math.floor(metricIndex / 4) }), 'character', safeInsets);
  assert.ok(darkSemanticText.has(semantic), `${severity}: actual ${semantic} status text passes body contrast`);
}

// --- WoW-style bag: two tabs (道具 supplies / 携行 carried), each 5x100 ---
const carriedThree = commit(rich, {
  type: 'hub/configure-tactical-loadout',
  itemIds: ['thunder_talisman', 'dispel_talisman', 'gate_sigil'],
});
const carriedThreeSupplies = add(carriedThree, {
  hubPanel: 'supplies',
  hubSelections: { supplies: 'thunder_talisman' },
});
{
  // The bag defaults to the 道具 tab: 3 supply cells + 97 blanks, no seals.
  const view = render(carriedThreeSupplies, { kind: 'inventory', page: 0 });
  assertDarkSheet(view, 'inventory', safeInsets);
  const nodes = nodesIn(view.rootNode);
  assert.ok(nodes.some((node) => node.name === 'MobileSheetTab:items'), 'bag: 道具 tab mounted');
  assert.ok(nodes.some((node) => node.name === 'MobileSheetTab:carry'), 'bag: 携行 tab mounted');
  assert.deepEqual(
    nodes.filter((node) => /^MobileSheetItem:/.test(node.name)).map((node) => node.name),
    ['MobileSheetItem:healing_pill', 'MobileSheetItem:armor_patch', 'MobileSheetItem:focus_incense'],
    'bag 道具 tab: the three supply cells in catalog order'
  );
  assert.equal(nodes.filter((node) => /^MobileSheetBlank:/.test(node.name)).length, 97, 'bag 道具 tab: ninety-seven decorative blanks');
  assert.equal(nodes.filter((node) => node.name === 'ItemCarriedSeal').length, 0, 'bag 道具 tab: no carried seals');
  assert.ok(nodes.some((node) => node.name === 'MobileSheetInventoryRack'), 'bag: rack keeps its contract name');
  assert.ok(nodes.some((node) => node.name === 'MobileSheetScroll'), 'bag: rack scrolls in-window');
  for (const node of nodes) {
    if (/^MobileSheetBlank:/.test(node.name)) {
      assert.equal(node.getComponent(api.Label), null, 'blank: no label');
      assert.ok(!view.local.has(node.name), 'blank: no touch binding');
    }
  }
  const texts = view.labels.map(({ text }) => text);
  assert.ok(texts.find((text) => text.includes('补给品 · 不占携行槽')), 'bag 道具 tab: supply header line');
  assert.ok(texts.find((text) => text.includes('50000')), 'bag: hub reward points shown');

  // The 携行 tab owns its own 5×100 grid: 6 carried-item cells, 94 blanks,
  // three gold carry seals, and the capacity line.
  const carryView = render(carriedThreeSupplies, { kind: 'inventory', page: 0, tab: 'carry' });
  assertDarkSheet(carryView, 'inventory', safeInsets);
  const carryNodes = nodesIn(carryView.rootNode);
  assert.equal(carryNodes.filter((node) => /^MobileSheetItem:/.test(node.name)).length, 6, 'bag 携行 tab: six carried special item cells');
  assert.equal(carryNodes.filter((node) => /^MobileSheetBlank:/.test(node.name)).length, 94, 'bag 携行 tab: ninety-four decorative blanks');
  assert.equal(carryNodes.filter((node) => node.name === 'ItemCarriedSeal').length, 3, 'bag 携行 tab: three carried seals');
  assert.ok(carryView.labels.map(({ text }) => text).find((text) => text.includes('携行槽 3 / 3')), 'bag 携行 tab: carry capacity line reads 3 / 3');
}

// --- Item tooltip: hub supplies panel binds the REAL toggle command ---
{
  const echoSuppliesModel = add(rich, {
    hubPanel: 'supplies',
    hubSelections: { supplies: 'echo_coin' },
  });
  const view = render(echoSuppliesModel, { kind: 'inventory', page: 0, tip: { kind: 'item', id: 'echo_coin' } });
  const nodes = nodesIn(view.rootNode);
  assert.ok(nodes.some((node) => node.name === 'MobileSheetTip'), 'tip: card mounted');
  const texts = view.labels.map(({ text }) => text);
  assert.ok(texts.some((text) => text === api.ITEMS.echo_coin.name), 'tip: item name');
  assert.ok(texts.some((text) => text.includes('兑换价')), 'tip: catalog price line');
  const toggle = echoSuppliesModel.sections[2].actions.find((action) => action.actionId === 'hub.supplies.toggle:echo_coin');
  assert.ok(toggle, 'fixture: supplies projects the toggle action');
  assert.equal(view.actions.get('MobileSheetTipCarry:echo_coin'), toggle, 'tip: carry binds the exact VM action object');
  assert.ok(view.local.has('MobileSheetTipClose'), 'tip: close bound');
  assert.ok(view.local.has('MobileSheetBackdrop'), 'tip: backdrop dismiss bound while open');
  view.local.get('MobileSheetTipClose')();
  assert.deepEqual(view.nextState().tip, undefined, 'tip: close clears tip state');
  view.local.get('MobileSheetBackdrop')();
  assert.deepEqual(view.nextState().tip, undefined, 'tip: backdrop clears tip state');
}

// --- supplyActions seam: toggle reachable from any other hub panel ---
{
  const hubOther = add(carriedThree, { hubPanel: 'entry' });
  assert.ok(!hubOther.sections[2].actions.some((action) => action.actionId === 'hub.supplies.toggle:thunder_talisman'),
    'fixture: non-supplies panel does not project the toggle');
  const suppliesActions = carriedThreeSupplies.sections[2].actions;
  const requestedIds = [];
  const view = render(hubOther, { kind: 'inventory', page: 0, tip: { kind: 'item', id: 'thunder_talisman' } },
    safeInsets, { supplyActions: (itemId) => { requestedIds.push(itemId); return suppliesActions; }, actionPool: suppliesActions });
  assert.deepEqual(requestedIds, ['thunder_talisman'], 'tip requests the inspected item from the host seam');
  const toggle = suppliesActions.find((action) => action.actionId === 'hub.supplies.toggle:thunder_talisman');
  assert.equal(view.actions.get('MobileSheetTipCarry:thunder_talisman'), toggle, 'tip: seam resolves the real toggle action');
  assert.ok(view.labels.map(({ text }) => text).includes('取消携行'), 'tip: carried item offers unset wording');
}

// The selected shop item is unrelated to the bag tooltip. Both another NPC
// and the default healing-pill selection must still configure gate_sigil.
{
  const gateActions = api.buildGameViewModel(rich, {
    hubPanel: 'supplies', hubSelections: { supplies: 'gate_sigil' },
  }).sections[2].actions;
  const gateToggle = gateActions.find(action => action.actionId === 'hub.supplies.toggle:gate_sigil');
  assert.ok(gateToggle?.enabled && gateToggle.event?.kind === 'command', 'fixture gate toggle is executable');
  for (const hubPanel of ['equipment', 'supplies']) {
    const current = add(rich, { hubPanel, hubSelections: { supplies: 'healing_pill' } });
    assert.ok(!current.sections[2].actions.some(action => action.actionId === gateToggle.actionId), 'current NPC selection has no gate toggle of its own');
    const requestedIds = [];
    const view = render(current, { kind: 'inventory', page: 0, tab: 'carry', tip: { kind: 'item', id: 'gate_sigil' } }, safeInsets, {
      supplyActions: itemId => { requestedIds.push(itemId); return gateActions; }, actionPool: gateActions,
    });
    assert.deepEqual(requestedIds, ['gate_sigil'], `${hubPanel}: host projects the exact inspected gate_sigil`);
    const bound = view.actions.get('MobileSheetTipCarry:gate_sigil');
    assert.equal(bound, gateToggle, `${hubPanel}: tooltip binds the host's exact gate command`);
    assert.ok(view.labels.some(({ text }) => text === '设为携行'), 'unprepared gate offers its carry action');
    const configured = commit(rich, bound.event.command);
    assert.ok(configured.preparedItemIds.includes('gate_sigil'), 'bag configuration adds the inspected item');
  }
}

// --- Full-slot advisory text on a non-carried carried item ---
{
  const suppliesFocus = add(carriedThree, {
    hubPanel: 'supplies',
    hubSelections: { supplies: 'echo_coin' },
  });
  const view = render(suppliesFocus, { kind: 'inventory', page: 0, tip: { kind: 'item', id: 'echo_coin' } });
  assert.ok(view.labels.map(({ text }) => text).includes('通用携行槽已满（3 / 3）'), 'tip: cap advisory at 3/3');
}

// --- Supply item tooltip never carries a set/unset carry command ---
{
  const supplySuppliesModel = add(rich, {
    hubPanel: 'supplies',
    hubSelections: { supplies: 'healing_pill' },
  });
  assert.ok(!supplySuppliesModel.sections[2].actions.some((action) => action.actionId === 'hub.supplies.toggle:healing_pill'),
    'fixture: supplies panel projects no toggle for a supply item');
  const view = render(supplySuppliesModel, { kind: 'inventory', page: 0, tip: { kind: 'item', id: 'healing_pill' } });
  assert.ok(nodesIn(view.rootNode).some((node) => node.name === 'MobileSheetTip'), 'supply tip: card mounted');
  assert.ok(!view.actions.has('MobileSheetTipCarry:healing_pill'), 'supply tip: no carry command');
}

// --- Dungeon/combat item tooltip is strictly read-only ---
{
  const combatModel = add(trainedCombat);
  const view = render(combatModel, { kind: 'inventory', page: 0, tip: { kind: 'item', id: 'healing_pill' } });
  assert.ok(nodesIn(view.rootNode).some((node) => node.name === 'MobileSheetTip'), 'combat tip: card mounted');
  assert.ok(!view.actions.has('MobileSheetTipCarry:healing_pill'), 'combat tip: no carry command');
}

// --- Equipment tooltip is always read-only, even in hub ---
{
  const equipped = hubSuppliesModel.sections[1].loadout.equipment.find((entry) => entry.equipmentId);
  const view = render(hubSuppliesModel, { kind: 'character', page: 0, tip: { kind: 'equip', id: equipped.equipmentId } });
  const nodes = nodesIn(view.rootNode);
  assert.ok(nodes.some((node) => node.name === 'MobileSheetTip'), 'equip tip: card mounted');
  assert.ok(!nodes.some((node) => /^MobileSheetTipCarry:/.test(node.name)), 'equip tip: read-only');
  assert.ok(view.labels.map(({ text }) => text).some((text) => text.includes(equipped.slotLabel)), 'equip tip: slot line');
  view.local.get('MobileSheetBackdrop')();
  assert.deepEqual(view.nextState().tip, undefined, 'equip tip: backdrop closes');
}

const renderedSignatures = new Set();
let sheetLists = 0;
let checkedActionDetails = 0;
let disabledReadouts = 0;
const normalizeText = (value) => value.replace(/\s/gu, '');
function assertSheetReachable(model, kind, expected) {
  const signature = JSON.stringify([kind, model.phase, expected]);
  if (renderedSignatures.has(signature)) return;
  renderedSignatures.add(signature);
  const reached = new Set();
  for (let page = 0; page < 128; page += 1) {
    const view = render(model, { kind, page, tab: 'actions' });
    assertDarkSheet(view, kind, safeInsets);
    for (const action of view.actions.values()) reached.add(action);
    for (const action of expected) {
      const open = view.local.get(`MobileSheetAction:${action.actionId}`);
      if (open === undefined) continue;
      open();
      const selected = view.nextState();
      assert.equal(selected.selectedActionId, action.actionId, `${kind} selects original action`);
      let textReadout = '';
      for (let detailPage = 0; detailPage < 128; detailPage += 1) {
        const detail = render(model, { ...selected, page: detailPage });
        assertDarkSheet(detail, kind, safeInsets);
        textReadout += detail.labels.filter(({ name }) => name.startsWith('ReadoutLine:')).map(({ text }) => text).join('');
        const execute = detail.actions.get(`MobileSheetExecute:${action.actionId}`);
        if (action.enabled) assert.equal(execute, action, `${kind}: ${action.actionId} can execute its original event`);
        else assert.equal(execute, undefined, `${kind}: disabled action never executes`);
        if (!detail.local.has('MobileSheetNext')) break;
        assert.ok(detailPage < 127, 'action details pagination terminates');
      }
      if (!action.enabled) {
        const reason = model.phase === 'hub' ? api.formatInfiniteFlowHubActionLockedReason(action) : action.disabledReason;
        assert.ok(normalizeText(textReadout).includes(normalizeText(reason)), `${kind}: ${action.actionId} disabled reason is fully readable`);
        disabledReadouts += 1;
      }
      reached.add(action);
      checkedActionDetails += 1;
    }
    if (!view.local.has('MobileSheetNext')) break;
    assert.ok(page < 127, 'sheet action list pagination terminates');
  }
  for (const action of expected) assert.ok(reached.has(action), `${kind}: ${action.actionId} reachable by list -> details -> original action`);
  sheetLists += 1;
}

const catalogueSignatures = new Set();
const checkedCatalogConditions = new Set();
let checkedCatalogs = 0;
let checkedCatalogActions = 0;
const baseActionId = (action) => action.actionId.split('::')[0];
const popupNode = (view) => nodesIn(view.rootNode).find(node => node.name === 'MobileSheetCatalogDetail');
function popupText(view) {
  return nodesIn(popupNode(view)).map(node => node.getComponent(api.Label)?.string ?? '').join('');
}

function boundsRelativeTo(node, ancestor) {
  let x = 0, y = 0;
  let cursor = node;
  while (cursor !== ancestor) {
    assert.ok(cursor, `${node.name}: geometry must belong to ${ancestor.name}`);
    x += cursor.position?.x ?? 0;
    y += cursor.position?.y ?? 0;
    cursor = cursor.parent;
  }
  const { width, height } = node.getComponent(api.UITransform).contentSize;
  return { left: x - width / 2, right: x + width / 2, bottom: y - height / 2, top: y + height / 2, width, height, x, y };
}

// Objectives start with a compact task checklist. Reading task details and
// chapter rules is local navigation and must never execute a game command.
let checkedTaskLists = 0;
let checkedTaskRows = 0;
let checkedTaskDetails = 0;
const taskPhases = new Set();
const taskStatuses = new Set();
const taskKinds = new Set();
function taskParts(view) {
  const nodes = nodesIn(view.rootNode);
  const viewport = nodes.find(node => node.name === 'MobileSheetTaskScroll');
  const content = nodes.find(node => node.name === 'MobileSheetScrollContent');
  assert.ok(viewport && content, 'tasks have one continuous scrolling list');
  const scroll = viewport.getComponent(api.ScrollView);
  assert.ok(scroll, 'task viewport owns the ScrollView');
  return { nodes, viewport, content, scroll };
}
{
  const signatures = new Set();
  const taskModels = models.filter(model => {
    assert.ok(Array.isArray(model.tasks), 'every game phase projects its task list');
    const signature = JSON.stringify([model.phase, model.tasks]);
    if (signatures.has(signature)) return false;
    signatures.add(signature);
    return true;
  });
  const previousFrame = api.view.frameSize;
  try {
    for (const frame of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
      api.view.frameSize = frame;
      for (const model of taskModels) {
        taskPhases.add(model.phase);
        const state = { kind: 'objectives', page: 0 };
        const view = render(model, state);
        assertDarkSheet(view, 'objectives', safeInsets);
        const nodes = nodesIn(view.rootNode);
        assert.equal(view.actions.size, 0, 'task overview has no command bindings');
        assert.ok(!nodes.some(node => /^MobileSheet(?:Previous|Next|PageCount)$/.test(node.name)), 'task checklist has no pagination');
        assert.equal(nodes.filter(node => node.name.startsWith('MobileSheetTask:')).length, model.tasks.length, 'all current tasks appear in the list together');
        const rules = nodes.find(node => node.name === 'MobileSheetObjectiveRules');
        assert.ok(rules && view.local.has(rules.name), 'chapter information remains a separate local entry');
        assert.ok(Math.abs(rules.getComponent(api.UITransform).contentSize.height / catalogCssUnit() - 44) < 0.6, 'chapter information keeps a 44px touch target');
        assert.ok(!nodesIn(nodes.find(node => node.name === 'MobileSheetScrollContent') ?? new api.Node()).includes(rules), 'chapter rules stay outside the scrolling task list');
        if (model.tasks.length === 0) {
          assert.ok(nodes.some(node => node.name === 'MobileSheetTasksEmpty'), 'an empty task list has its explicit empty state');
          assert.ok(view.labels.some(({ text }) => text.includes('暂无进行中的任务')), 'empty task wording explains why no tasks are listed');
        } else {
          const { viewport, content, scroll } = taskParts(view);
          assert.equal(scroll.content, content, 'task rows belong to the one list scroll content');
          assert.equal(scroll.horizontal, false, 'task checklist does not scroll sideways');
          assert.equal(scroll.vertical, true, 'task checklist can scroll vertically');
          assert.equal(scroll.cancelInnerEvents, true, 'dragging the checklist cancels task row clicks');
          assert.ok(nodesIn(viewport).some(node => node.getComponent(api.Mask)), 'task rows clip to the list viewport');
          for (const task of model.tasks) {
            taskStatuses.add(task.status);
            taskKinds.add(task.kind);
            const row = nodes.find(node => node.name === `MobileSheetTask:${task.id}`);
            assert.ok(row && nodesIn(content).includes(row), `${task.id}: task belongs to the continuous list`);
            assert.ok(view.local.has(row.name), `${task.id}: whole row opens details`);
            const size = row.getComponent(api.UITransform).contentSize;
            assert.ok(size.height / catalogCssUnit() >= 44, `${task.id}: whole task row keeps a 44px touch floor at ${frame.width}px`);
            const title = row.getChildByName('TaskTitle')?.getComponent(api.Label);
            const progress = row.getChildByName('TaskProgress')?.getComponent(api.Label);
            const status = row.getChildByName('TaskStatus')?.getComponent(api.Label);
            assert.equal(normalizeText(title?.string ?? ''), normalizeText(task.title), `${task.id}: first screen names the accepted task`);
            for (const objective of task.objectives) assert.ok(normalizeText(progress?.string ?? '').includes(normalizeText(objective)), `${task.id}: every short condition and counter is directly readable`);
            assert.ok(status?.string, `${task.id}: task status is visible`);
            if (task.status === 'completed') assert.equal(status.string, '待领取', 'finished tasks are distinguished from active tasks');
            for (const label of [title, progress]) {
              assert.ok(label.fontSize / catalogCssUnit() >= 10 && label.fontSize / catalogCssUnit() <= 14.1, `${task.id}: overview text remains compact at ${frame.width}px`);
            }
            const titleBounds = boundsRelativeTo(row.getChildByName('TaskTitle'), row);
            const progressBounds = boundsRelativeTo(row.getChildByName('TaskProgress'), row);
            const statusBounds = boundsRelativeTo(row.getChildByName('TaskStatus'), row);
            for (const box of [titleBounds, progressBounds, statusBounds]) {
              assert.ok(box.left >= -size.width / 2 - 0.6 && box.right <= size.width / 2 + 0.6
                && box.bottom >= -size.height / 2 - 0.6 && box.top <= size.height / 2 + 0.6, `${task.id}: task text stays within its row at ${frame.width}px`);
            }
            assert.ok(titleBounds.bottom >= progressBounds.top && titleBounds.right <= statusBounds.left,
              `${task.id}: multiline title, condition and status do not overlap at ${frame.width}px`);
            const overviewText = normalizeText(nodesIn(row).map(node => node.getComponent(api.Label)?.string ?? '').join(''));
            for (const extra of [task.description, task.hint, task.rewardText].filter(Boolean)) {
              const normalized = normalizeText(extra);
              if (![task.title, ...task.objectives].some(value => normalizeText(value).includes(normalized))) {
                assert.ok(!overviewText.includes(normalized), `${task.id}: long description, hint and reward stay in details`);
              }
            }
            checkedTaskRows += 1;
          }
          const firstRow = nodes.find(node => node.name === `MobileSheetTask:${model.tasks[0].id}`);
          const firstBounds = boundsRelativeTo(firstRow, content);
          const contentHeight = content.getComponent(api.UITransform).contentSize.height;
          const viewportHeight = viewport.getComponent(api.UITransform).contentSize.height;
          assert.ok(firstBounds.top <= contentHeight / 2 + 0.6 && firstBounds.bottom >= contentHeight / 2 - viewportHeight - 0.6, 'initial viewport shows the first complete task without scrolling');
          for (const task of [model.tasks[0], model.tasks.find(task => task.status === 'completed')].filter((task, index, all) => task && all.indexOf(task) === index)) {
            view.local.get(`MobileSheetTask:${task.id}`)();
            const selected = view.nextState();
            assert.equal(selected.taskId, task.id, 'task row opens exactly its own local detail');
            const detail = render(model, selected);
            assertDarkSheet(detail, 'objectives', safeInsets);
            assert.equal(detail.actions.size, 0, 'task details cannot execute a game command');
            assert.ok(nodesIn(detail.rootNode).some(node => node.name === 'MobileSheetTaskDetail'), 'selected task has a dedicated detail surface');
            const detailText = normalizeText(detail.labels.map(({ text }) => text).join(''));
            for (const value of [task.title, ...(task.detailObjectives ?? task.objectives), task.description, task.hint, task.rewardText].filter(Boolean)) {
              assert.ok(detailText.includes(normalizeText(value)), `${task.id}: details retain all original task information`);
            }
            assert.ok(detail.local.has('MobileSheetTaskBack'), 'task detail offers a return to the checklist');
            const back = nodesIn(detail.rootNode).find(node => node.name === 'MobileSheetTaskBack');
            assert.ok(Math.abs(back.getComponent(api.UITransform).contentSize.height / catalogCssUnit() - 44) < 0.6, 'task detail return keeps a 44px touch target');
            detail.local.get('MobileSheetTaskBack')();
            assert.equal(detail.nextState().taskId, undefined, 'return clears the selected task');
            checkedTaskDetails += 1;
          }
        }
        view.local.get('MobileSheetObjectiveRules')();
        assert.equal(view.nextState().tab, 'rules', 'chapter rules open behind their explicit entry');
        const rulesView = render(model, view.nextState());
        assert.equal(rulesView.actions.size, 0, 'chapter information is read-only');
        assert.ok(rulesView.local.has('MobileSheetTaskBack'), 'chapter information can return to the checklist');
        rulesView.local.get('MobileSheetTaskBack')();
        assert.notEqual(rulesView.nextState().tab, 'rules', 'chapter information returns to the task overview');
        checkedTaskLists += 1;
      }
    }

    api.view.frameSize = { width: 320, height: 568 };
    const original = taskModels.find(model => model.tasks.length > 0);
    assert.ok(original, 'authentic fixtures contain accepted tasks');
    // Amplify real projected entries only to exercise scrolling beyond one
    // phone screen, without inventing any task action or domain transition.
    const longModel = { ...original, tasks: Array.from({ length: 30 }, (_, index) => ({ ...original.tasks[index % original.tasks.length], id: `scroll-case-${index}` })) };
    const state = { kind: 'objectives', page: 0 };
    const view = render(longModel, state);
    const { viewport, content, scroll } = taskParts(view);
    const maxOffset = content.getComponent(api.UITransform).contentSize.height - viewport.getComponent(api.UITransform).contentSize.height;
    assert.ok(maxOffset > 240, 'long task fixture genuinely overflows the phone viewport');
    const overscroll = render(longModel, { ...state, taskScrollOffset: 100_000 });
    assert.equal(taskParts(overscroll).scroll.getScrollOffset().y, maxOffset, 'restored list position clamps to its final task');
    scroll.scrollToOffset(new api.Vec2(0, 240));
    const captured = api.captureInfiniteFlowInfoSheetState(view.rootNode, state);
    assert.equal(captured.taskScrollOffset, 240, 'host refresh captures the task list position');
    const refreshed = render(longModel, captured);
    assert.equal(taskParts(refreshed).scroll.getScrollOffset().y, 240, 'host refresh restores the task list position');
    refreshed.local.get(`MobileSheetTask:${longModel.tasks[5].id}`)();
    const selected = refreshed.nextState();
    assert.equal(selected.taskScrollOffset, 240, 'opening a task preserves checklist scroll position');
    const detail = render(longModel, selected);
    const detailScroll = nodesIn(detail.rootNode).find(node => node.getComponent(api.ScrollView))?.getComponent(api.ScrollView);
    if (detailScroll) detailScroll.scrollToOffset(new api.Vec2(0, 80));
    assert.equal(api.captureInfiniteFlowInfoSheetState(detail.rootNode, selected).taskScrollOffset, 240, 'detail scrolling never overwrites the checklist position');
    detail.local.get('MobileSheetTaskBack')();
    assert.equal(taskParts(render(longModel, detail.nextState())).scroll.getScrollOffset().y, 240, 'return from task detail restores the list position');
    refreshed.local.get('MobileSheetObjectiveRules')();
    const rulesView = render(longModel, refreshed.nextState());
    rulesView.local.get('MobileSheetTaskBack')();
    assert.equal(taskParts(render(longModel, rulesView.nextState())).scroll.getScrollOffset().y, 240, 'return from chapter information restores the list position');
    const empty = render({ ...original, tasks: [] }, state);
    assert.ok(empty.labels.some(({ text }) => text.includes('暂无进行中的任务')), 'empty-list behavior is covered independently of save progress');
  } finally {
    api.view.frameSize = previousFrame;
  }
  assert.deepEqual([...taskPhases].sort(), ['combat', 'explore', 'hub', 'result'], 'task overview is covered in every game phase');
  assert.ok(taskStatuses.has('active') && taskStatuses.has('completed'), 'real task fixtures cover ongoing and finished objectives');
}

// Full region maps keep every known or fogged cell in one two-axis viewport.
// Offsets follow Cocos' signed getScrollOffset() x and positive scrollToOffset() x.
let checkedFullMaps = 0;
let checkedMapCells = 0;
const mapCases = [];
for (const dungeonId of api.DUNGEON_ORDER) {
  for (const protocolId of ['standard', 'deep']) {
    const entered = protocolId === 'standard' ? enteredByDungeon.get(dungeonId) : commit(rich, {
      type: 'run/enter', dungeonId, protocolId, infernoTier: 1,
      seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_5678, infernoMapSeed: 0x2345_6789 },
    });
    const model = add(entered);
    const map = model.sections[1].detail.map;
    assert.deepEqual([map.width, map.height, map.nodes.length], [protocolId === 'deep' ? 7 : 6, 5, 30], `${dungeonId}/${protocolId}: authentic complete map fixture`);
    mapCases.push({ model, map, protocolId });
  }
}
function mapParts(view) {
  const nodes = nodesIn(view.rootNode);
  const viewport = nodes.find(node => node.name === 'MobileSheetMapScroll');
  const content = nodes.find(node => node.name === 'MobileSheetMapContent');
  assert.ok(viewport && content, 'map has its dedicated full-region scrolling surface');
  const scroll = viewport.getComponent(api.ScrollView);
  assert.ok(scroll, 'map viewport owns the ScrollView');
  const size = viewport.getComponent(api.UITransform).contentSize;
  const contentSize = content.getComponent(api.UITransform).contentSize;
  return { nodes, viewport, content, scroll, size, contentSize };
}
function mapCellRect(cell, content) {
  const box = boundsRelativeTo(cell, content);
  const { width, height } = content.getComponent(api.UITransform).contentSize;
  return { left: box.left + width / 2, right: box.right + width / 2,
    top: height / 2 - box.top, bottom: height / 2 - box.bottom };
}
{
  const previousFrame = api.view.frameSize;
  try {
    for (const frame of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
      api.view.frameSize = frame;
      for (const { model, map, protocolId } of mapCases) {
        const state = { kind: 'map', page: 0 };
        const view = render(model, state);
        assertDarkSheet(view, 'map', safeInsets);
        const { nodes, viewport, content, scroll, size, contentSize } = mapParts(view);
        assert.equal(scroll.content, content, 'all region cells belong to the same scroll content');
        assert.equal(scroll.horizontal, true, 'map can scroll horizontally');
        assert.equal(scroll.vertical, true, 'map can scroll vertically');
        assert.equal(scroll.cancelInnerEvents, true, 'dragging the map cancels child tile clicks');
        assert.ok(nodesIn(viewport).some(node => node.getComponent(api.Mask)), 'map scrolling clips cells to a mask');
        assert.ok(!nodes.some(node => /^MobileSheet(?:Previous|Next|PageCount)$/.test(node.name)), 'full map has no previous/next pagination');
        assert.equal(view.actions.size, 0, 'inspecting the map never binds a domain movement command');
        const renderedCells = nodes.filter(node => /^MobileSheet(?:MapCell|Fog):/.test(node.name));
        assert.equal(renderedCells.length, map.nodes.length, `${map.dungeonId}/${protocolId}: every region cell is rendered together`);
        for (const cell of map.nodes) {
          const name = cell.state === 'fogged' ? `MobileSheetFog:${cell.x}:${cell.y}` : `MobileSheetMapCell:${cell.cellId}`;
          const tile = renderedCells.find(node => node.name === name);
          assert.ok(tile && nodesIn(content).includes(tile), `${name}: cell is reachable by scrolling instead of paging`);
          const tileSize = tile.getComponent(api.UITransform).contentSize;
          assert.ok(tileSize.width / catalogCssUnit() >= 44 && tileSize.height / catalogCssUnit() >= 44, `${name}: map cell preserves 44 CSS-pixel touch dimensions at ${frame.width}px`);
          if (cell.state === 'fogged') {
            assert.equal(view.local.has(name), false, 'unknown cells have no detail callback');
            assert.equal(view.actions.has(name), false, 'unknown cells have no domain callback');
            assert.equal(cell.nodeId, undefined, 'fog projection omits the hidden domain node id');
            assert.equal(tile.getChildByName('MapCellTitle').getComponent(api.Label).string, '迷雾区域', 'fog displays no real node title');
          } else assert.ok(view.local.has(name), 'every known cell opens read-only local details');
          checkedMapCells += 1;
        }
        const current = map.nodes.find(cell => cell.state === 'current');
        const currentTile = nodes.find(node => node.name === `MobileSheetMapCell:${current.cellId}`);
        const rect = mapCellRect(currentTile, content);
        const initial = scroll.getScrollOffset();
        const offset = { x: -initial.x, y: initial.y };
        assert.ok(rect.left >= offset.x - 0.6 && rect.right <= offset.x + size.width + 0.6
          && rect.top >= offset.y - 0.6 && rect.bottom <= offset.y + size.height + 0.6, 'initial viewport contains the entire current cell');
        const maxX = Math.max(0, contentSize.width - size.width);
        const maxY = Math.max(0, contentSize.height - size.height);
        assert.ok(offset.x >= 0 && offset.x <= maxX && offset.y >= 0 && offset.y <= maxY, 'initial current-cell focus is clamped to the full map bounds');
        const edge = render(model, { ...state, mapDungeonId: map.dungeonId, mapScrollOffset: { x: 100_000, y: 100_000 } });
        const edgeParts = mapParts(edge);
        const edgeOffset = edgeParts.scroll.getScrollOffset();
        assert.deepEqual({ x: -edgeOffset.x, y: edgeOffset.y }, { x: maxX, y: maxY }, 'restored overscroll clamps to both far edges');
        const rects = edgeParts.nodes.filter(node => /^MobileSheet(?:MapCell|Fog):/.test(node.name)).map(node => mapCellRect(node, edgeParts.content));
        assert.ok(Math.max(...rects.map(rect => rect.right)) <= maxX + size.width + 0.6, 'rightmost region cells are reachable at the horizontal edge');
        assert.ok(Math.max(...rects.map(rect => rect.bottom)) <= maxY + size.height + 0.6, 'bottommost region cells are reachable at the vertical edge');
        checkedFullMaps += 1;
      }
    }
  } finally {
    api.view.frameSize = previousFrame;
  }
  const { model, map } = mapCases[0];
  const state = { kind: 'map', page: 0 };
  const view = render(model, state);
  const { contentSize, size, scroll } = mapParts(view);
  const offset = { x: Math.min(80, Math.max(0, contentSize.width - size.width)), y: Math.min(40, Math.max(0, contentSize.height - size.height)) };
  assert.ok(offset.x > 0, 'fixture exercises the real Cocos horizontal offset sign');
  scroll.scrollToOffset(new api.Vec2(offset.x, offset.y));
  assert.equal(scroll.getScrollOffset().x, -offset.x, 'stub matches Cocos negative horizontal getScrollOffset semantics');
  const captured = api.captureInfiniteFlowInfoSheetState(view.rootNode, state);
  assert.equal(captured.mapDungeonId, map.dungeonId, 'map capture is associated with its dungeon');
  assert.deepEqual(captured.mapScrollOffset, offset, 'map capture converts horizontal offset back to positive left distance');
  const refreshed = render(model, captured);
  assert.deepEqual(mapParts(refreshed).scroll.getScrollOffset(), { x: -offset.x, y: offset.y }, 'host refresh restores both map axes');
  const current = map.nodes.find(cell => cell.state === 'current');
  refreshed.local.get(`MobileSheetMapCell:${current.cellId}`)();
  const selected = refreshed.nextState();
  assert.equal(selected.selectedActionId, `map:${current.cellId}`, 'map tile opens the chosen local detail');
  assert.deepEqual(selected.mapScrollOffset, offset, 'opening details retains the map position');
  const detail = render(model, selected);
  assert.equal(detail.actions.size, 0, 'map details cannot dispatch movement');
  assert.ok(detail.local.has('MobileSheetMapBack'), 'map details offer a return to the same map');
  const detailCapture = api.captureInfiniteFlowInfoSheetState(detail.rootNode, selected);
  assert.deepEqual(detailCapture.mapScrollOffset, offset, 'detail text scrolling cannot overwrite the map offset');
  detail.local.get('MobileSheetMapBack')();
  const returned = render(model, detail.nextState());
  assert.deepEqual(mapParts(returned).scroll.getScrollOffset(), { x: -offset.x, y: offset.y }, 'return from details restores the original two-axis position');
  const other = mapCases.find(candidate => candidate.map.dungeonId !== map.dungeonId);
  const otherDefault = render(other.model, state);
  const otherRestored = render(other.model, captured);
  assert.deepEqual(mapParts(otherRestored).scroll.getScrollOffset(), mapParts(otherDefault).scroll.getScrollOffset(), 'a different dungeon ignores stale map offsets');
}

function assertCatalogGeometry(view) {
  const unit = catalogCssUnit();
  assertCatalogSurfaces(view);
  for (const row of nodesIn(view.rootNode).filter(node => node.name.startsWith('MobileSheetShopRow:'))) {
    const size = row.getComponent(api.UITransform).contentSize;
    const controls = nodesIn(row).filter(node => /^MobileSheetShop(?:Action|More):/.test(node.name));
    const boxes = controls.map(control => boundsRelativeTo(control, row));
    controls.forEach((control, index) => {
      const box = boxes[index];
      assert.ok(Math.abs(box.height / unit - 44) < 0.6, `${control.name}: compact 44px prototype control`);
      assert.ok(box.left >= -size.width / 2 - 0.6 && box.right <= size.width / 2 + 0.6,
        `${control.name}: content-width button stays inside its row horizontally`);
      assert.ok(box.bottom >= -size.height / 2 - 0.6 && box.top <= size.height / 2 + 0.6,
        `${control.name}: wrapped button stays inside its row vertically`);
      const label = nodesIn(control).find(node => node.name === 'Label')?.getComponent(api.Label);
      assert.ok(label, `${control.name}: compact operation label exists`);
      assert.ok(Math.abs(label.fontSize / unit - 12) < 0.6, `${control.name}: operation label matches prototype 12px`);
      const price = nodesIn(control).find(node => node.name === 'Price')?.getComponent(api.Label);
      if (price) {
        assert.ok(price.fontSize < label.fontSize, `${control.name}: price is quieter than the operation label`);
        assert.ok(Math.abs(price.fontSize / unit - 10) < 0.6, `${control.name}: price matches prototype 10px`);
      }
      for (let next = index + 1; next < boxes.length; next += 1) {
        const other = boxes[next];
        const overlapX = Math.min(box.right, other.right) - Math.max(box.left, other.left);
        const overlapY = Math.min(box.top, other.top) - Math.max(box.bottom, other.bottom);
        assert.ok(overlapX <= 0.6 || overlapY <= 0.6, `${row.name}: buttons ${control.name} and ${controls[next].name} never overlap`);
      }
    });
  }
}

function assertCatalogReachable(model, kind, catalog, extras = {}) {
  const signature = JSON.stringify([kind, catalog]);
  if (catalogueSignatures.has(signature)) return;
  catalogueSignatures.add(signature);
  const state = { kind, page: 0, ...(kind === 'character' ? { tab: 'loadout' } : {}), catalogExpandedIds: catalog.rows.map(row => row.id) };
  const view = render(model, state, safeInsets, extras);
  assertDarkSheet(view, kind, safeInsets);
  assertCatalogGeometry(view);
  const nodes = nodesIn(view.rootNode);
  const grid = kind === 'npc' && model.sections[1].detail.activePanel !== 'tasks';
  const rowPrefix = grid ? 'MobileSheetShopTile:' : 'MobileSheetShopRow:';
  assert.equal(nodes.filter(node => node.name.startsWith(rowPrefix)).length, catalog.rows.length, 'catalog exposes every entry without pagination');
  if (grid) {
    assert.equal(view.actions.size, 0, 'goods grid has no commerce buttons');
    for (const tile of nodes.filter(node => node.name.startsWith(rowPrefix))) {
      assert.ok(!nodesIn(tile).some(node => node.getComponent(api.Label)), 'goods tile contains only image/vector artwork, never text');
      const size = tile.getComponent(api.UITransform).contentSize;
      assert.equal(size.width, size.height, 'goods tiles are square');
      assert.ok(size.width / catalogCssUnit() >= 58, 'goods icons match the prototype minimum size');
      assert.ok(view.local.has(tile.name), 'every icon opens its own detail');
    }
  } else if (kind === 'npc') {
    assert.ok(nodes.some(node => node.name === 'ShopRowDescription'), 'tasks remain readable text rows');
    assert.ok(!nodes.some(node => node.name.startsWith('MobileSheetShopTile:')), 'tasks are never a grid');
    for (const task of nodes.filter(node => node.name.startsWith('MobileSheetShopRow:'))) {
      const description = nodesIn(task).find(node => node.name === 'ShopRowDescription');
      const progress = nodesIn(task).find(node => node.name === 'ShopRowStatus');
      assert.ok(boundsRelativeTo(progress, task).top < boundsRelativeTo(description, task).bottom,
        'task progress stays below its description without overlapping');
    }
  }
  assert.ok(nodes.some(node => node.name === 'MobileSheetCatalogScroll'), 'catalog scrolls as one list');
  for (const removed of ['MobileSheetPrevious', 'MobileSheetNext', 'MobileSheetMoney:reward', 'MobileSheetTab:actions', 'NpcSelectionLine:']) {
    assert.ok(!nodes.some(node => node.name.startsWith(removed)), `${kind}: obsolete ${removed} is absent`);
  }
  assert.ok(!nodes.some(node => /Search|Filter|CategorySelect|MobileSheetMetric:reward-points/.test(node.name)), 'catalog has no search, filter, or reward-point resource card');
  assert.ok(!view.labels.some(({ text }) => /上一项|下一项|可以对它做什么|搜索名称|类别筛选/.test(text)), 'catalog omits removed browsing controls and operation heading');
  const serviceView = catalog.services?.length ? render(model, { ...state, catalogServiceOpen: true }, safeInsets, extras) : undefined;
  if (serviceView) assertCatalogSurfaces(serviceView);
  const actions = [...catalog.rows.flatMap(row => row.actions.map(action => ({ row, action }))), ...(catalog.services ?? []).map(action => ({ row: undefined, action }))];
  for (const { row, action } of actions) {
    const source = row && kind === 'character' ? view : render(model, { ...state, catalogRowId: row?.id, catalogServiceOpen: !row, catalogMoreOpen: true }, safeInsets, extras);
    const name = `MobileSheetShopAction:${action.actionId}`;
    const danger = action.emphasis === 'danger' || action.recommendation === 'high-risk';
    if (action.enabled && !danger) {
      assert.equal(source.actions.get(name), action, `${kind}: exact row/service action binds directly`);
    } else {
      const open = source.local.get(name);
      assert.ok(open, `${kind}: disabled or destructive action has a targeted readout`);
      open();
      const selected = source.nextState();
      assert.equal(selected.selectedActionId, action.actionId, 'condition targets the clicked action');
      assert.equal(selected.catalogRowId, row?.id, 'condition targets the clicked row');
      const conditionSignature = JSON.stringify([kind, row?.id, action]);
      if (!checkedCatalogConditions.has(conditionSignature)) {
        checkedCatalogConditions.add(conditionSignature);
        const detail = render(model, selected, safeInsets, extras);
        assertCatalogSurfaces(detail);
        const popup = popupNode(detail);
        assert.ok(popup, 'condition opens a catalog popup');
        const popupActions = nodesIn(popup).filter(node => node.name.startsWith('MobileSheetShopAction:'));
        if (!action.enabled) {
          assert.equal(detail.actions.get(name), undefined, 'disabled action never acquires an executable binding');
          assert.ok(nodesIn(popup).some(node => node.name === 'CatalogActionNotice'), 'disabled reason stays visible above the footer actions');
          assert.ok(normalizeText(popupText(detail)).includes(normalizeText(api.formatInfiniteFlowHubPlayerCopy(action.disabledReason))), `${action.actionId}: exact disabled reason is readable`);
          disabledReadouts += 1;
        } else {
          assert.equal(popupActions.length, 1, 'destructive action confirms only itself');
          assert.equal(detail.actions.get(name), action, 'confirmation retains the exact dangerous event');
        }
      }
    }
    checkedCatalogActions += 1;
  }
  // Read-only description popups do not duplicate the row's operations.
  const first = catalog.rows[0];
  if (first) {
    view.local.get(`${grid ? 'MobileSheetShopTile:' : 'MobileSheetShopInfo:'}${first.id}`)();
    assert.equal(view.nextState().catalogRowId, first.id, 'row info selects its own record');
    assert.equal(view.nextState().selectedActionId, undefined, 'ordinary details do not select an action');
    const detail = render(model, view.nextState(), safeInsets, extras);
    assertCatalogSurfaces(detail);
    assert.ok(popupNode(detail), 'row information opens a details popup');
    assert.ok(!nodesIn(popupNode(detail)).some(node => node.name === 'MobileSheetReadout'), 'ordinary catalog facts use compact label/value rows instead of large readout cards');
    assert.ok(nodesIn(popupNode(detail)).some(node => node.name === 'MobileSheetCatalogFooter'), 'details keep commerce actions in a fixed footer');
    assert.ok(normalizeText(popupText(detail)).includes(normalizeText(api.formatInfiniteFlowHubPlayerCopy(first.description))), 'item description remains readable');
    detail.local.get('MobileSheetCatalogDetailClose')();
    assert.equal(detail.nextState().catalogRowId, undefined, 'closing detail returns to the list');
  }
  checkedCatalogs += 1;
}

const ownedByModel = new WeakMap();
function ownedFor(model) {
  if (!ownedByModel.has(model)) ownedByModel.set(model, api.buildHubOwnedLoadoutViewModel(stateByModel.get(model)));
  return ownedByModel.get(model);
}
const replacedLegacyControls = new Set();
function assertNpcActionDestination(model, original) {
  const shop = model.sections[1].detail.shop;
  assert.ok(shop, 'NPC requires production shop projection');
  const merchant = [...shop.rows.flatMap(row => row.actions), ...shop.services].find(action => baseActionId(action) === original.actionId);
  if (merchant) {
    assert.equal(merchant.enabled, original.enabled, `${original.actionId}: shop preserves availability`);
    assert.deepEqual(merchant.event, original.event, `${original.actionId}: shop preserves the exact event payload`);
    return;
  }
  if (/\.select:/.test(original.actionId)) {
    replacedLegacyControls.add('catalog-cycle');
    if (original.event?.kind === 'local') assert.ok(shop.rows.some(row => row.id === original.event.action.entityId), 'old navigation target exists directly in the full list');
    return;
  }
  if (original.actionId === 'hub.equipment.commission.material') {
    replacedLegacyControls.add('material-cycle');
    if (original.event) assert.ok(shop.services.some(action => JSON.stringify(action.event) === JSON.stringify(original.event)), 'old material-cycle destination has a direct material service');
    return;
  }
  if (/^hub\.(supplies\.toggle:|loadout\.)/.test(original.actionId)) {
    replacedLegacyControls.add(original.actionId.startsWith('hub.loadout.') ? 'loadout-shortcuts' : 'bag-carry');
    assert.ok(!shop.rows.flatMap(row => row.actions).some(action => baseActionId(action) === original.actionId), 'carrying stays outside merchant services');
    // Actual per-item bag bindings, including non-supplies active panel, are
    // exercised above. The obsolete bulk presets have no merchant replacement.
    return;
  }
  if (/^hub\.(equipment\.(equip:|memory\.)|(?:pets|methods|bloodlines|companions)\.activate:)/.test(original.actionId)) {
    replacedLegacyControls.add('owned-configuration');
    const owned = ownedFor(model);
    const actions = owned.rows.flatMap(row => row.actions);
    const configured = actions.find(action => baseActionId(action) === original.actionId
      || (original.event && JSON.stringify(action.event) === JSON.stringify(original.event)));
    if (original.enabled) {
      assert.ok(configured, `${original.actionId}: usable configuration remains on the owned character page`);
      assert.deepEqual(configured.event, original.event, 'owned configuration preserves the actual command');
    }
    if (configured) assertCatalogReachable(model, 'character', owned, { ownedLoadout: () => owned, actionPool: actions });
    return;
  }
  assert.fail(`unclassified removed NPC action ${original.actionId}`);
}

// Seven production catalogues and one character destination, including list
// restoration across UI selections and external command/asset refreshes.
for (const [panel, count] of Object.entries({ equipment: 65, supplies: 9, pets: 6, methods: 7, bloodlines: 4, companions: 3, tasks: 63 })) {
  const model = add(rich, { hubPanel: panel });
  const shop = model.sections[1].detail.shop;
  assert.equal(shop.rows.length, count, `${panel}: complete catalogue`);
  catalogEntries[panel] = shop.rows.length;
  const forbidden = /equip-equipment|activate-|configure-tactical-loadout|use-item/;
  for (const action of shop.rows.flatMap(row => row.actions)) {
    if (action.event?.kind === 'command') assert.ok(!forbidden.test(action.event.command.type), `${panel}: shop omits use and loadout commands`);
  }
  assertCatalogReachable(model, 'npc', shop);
}
{
  const model = add(rich, { hubPanel: 'equipment' });
  const shop = model.sections[1].detail.shop;
  const previousFrame = api.view.frameSize;
  try {
    for (const frame of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 750, height: 1334 }]) {
      api.view.frameSize = frame;
      const view = render(model, { kind: 'npc', page: 0, catalogExpandedIds: shop.rows.map(row => row.id) });
      assertCatalogGeometry(view);
      const detail = render(model, { kind: 'npc', page: 0, catalogRowId: shop.rows.find(row => row.actions.some(action => /消耗\s/.test(action.readout ?? ''))).id });
      assertCatalogGeometry(detail);
      const footer = nodesIn(detail.rootNode).find(node => node.name === 'MobileSheetCatalogFooter');
      assert.ok(footer, 'commerce stays in a fixed detail footer');
      assert.ok(nodesIn(footer).some(node => node.name === 'Price' && node.getComponent(api.Label)?.string), 'prices appear in the detail footer');
      const controls = footer.children.filter(node => node.name.startsWith('MobileSheetShopAction:') || node.name === 'MobileSheetCatalogMore');
      assert.equal(controls.length, 3, 'equipment details expose two common actions and more');
      const boxes = controls.map(control => boundsRelativeTo(control, footer));
      const frameSize = footer.getComponent(api.UITransform).contentSize;
      boxes.forEach(box => {
        assert.ok(box.left >= -frameSize.width / 2 - 1 && box.right <= frameSize.width / 2 + 1, 'footer controls fit horizontally');
        assert.ok(box.bottom >= -frameSize.height / 2 - 1 && box.top <= frameSize.height / 2 + 1, 'footer controls fit vertically');
        assert.ok(Math.abs(box.height / catalogCssUnit() - 44) < 0.6, 'footer buttons match 44 CSS pixels');
      });
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        assert.ok(Math.min(a.right, b.right) - Math.max(a.left, b.left) < 0.6 || Math.min(a.top, b.top) - Math.max(a.bottom, b.bottom) < 0.6, 'footer buttons never overlap');
      }
      assert.ok(Math.abs(Math.max(...boxes.map(box => box.right)) - frameSize.width / 2) < 0.6, 'footer controls align to the right edge');
    }
  } finally {
    api.view.frameSize = previousFrame;
  }
}
{
  const model = add(rich, { hubPanel: 'equipment' });
  const shop = model.sections[1].detail.shop;
  const state = { kind: 'npc', page: 0 };
  const view = render(model, state);
  const scroll = nodesIn(view.rootNode).find(node => node.name === 'MobileSheetCatalogScroll').getComponent(api.ScrollView);
  scroll.scrollToOffset(new api.Vec2(0, 840));
  const captured = api.captureInfiniteFlowInfoSheetState(view.rootNode, state);
  assert.equal(captured.catalogScrollOffset, 840, 'host captures actual list offset before refresh');
  const refreshed = render(model, captured);
  assert.equal(nodesIn(refreshed.rootNode).find(node => node.name === 'MobileSheetCatalogScroll').getComponent(api.ScrollView).getScrollOffset().y, 840, 'external host refresh reapplies the captured offset');
  assert.equal(api.captureInfiniteFlowInfoSheetState(view.rootNode, { kind: 'inventory', page: 0 }).catalogScrollOffset, undefined, 'scroll is not copied to a different sheet');
  view.local.get(`MobileSheetShopTile:${shop.rows[3].id}`)();
  assert.equal(view.nextState().catalogScrollOffset, 840, 'details remember the list offset');
  const detail = render(model, view.nextState());
  detail.local.get('MobileSheetCatalogDetailClose')();
  const restored = render(model, detail.nextState());
  assert.equal(nodesIn(restored.rootNode).find(node => node.name === 'MobileSheetCatalogScroll').getComponent(api.ScrollView).getScrollOffset().y, 840, 'closing detail restores browsing position');
  assert.equal(detail.nextState().catalogSelectedRowId, shop.rows[3].id, 'closing detail keeps selected tile');
  const tile = nodesIn(restored.rootNode).find(node => node.name === `MobileSheetShopTile:${shop.rows[3].id}`);
  const strokes = tile.getComponent(api.Graphics).strokes;
  assert.ok(strokes.length >= 3, 'selected tile has an extra outline');
  assert.deepEqual(rgb(strokes[0].color), rgb(strokes[strokes.length - 1].color), 'selection preserves rarity color');
  const more = detail.local.get('MobileSheetCatalogMore');
  more();
  assert.ok(detail.nextState().catalogMoreOpen, 'more opens the detail menu');
  const expanded = render(model, detail.nextState());
  assert.ok(nodesIn(expanded.rootNode).some(node => node.name === 'MobileSheetCatalogActionMenu'), 'extra actions stay inside a bounded menu');
  const detailScroll = nodesIn(detail.rootNode).find(node => node.name === 'CatalogDetailBody').getChildByName('MobileSheetScroll').getComponent(api.ScrollView);
  detailScroll.scrollToOffset(new api.Vec2(0, 48));
  const detailCapture = api.captureInfiniteFlowInfoSheetState(detail.rootNode, view.nextState());
  assert.equal(detailCapture.catalogDetailScrollOffset, 48, 'image or command refresh captures detail scroll');
  for (const runtime of [{ ...chrome, busyActionId: 'pending-action' }, { ...chrome, modeKind: 'blocked', blockingMessage: 'storage unavailable' }]) {
    const row = shop.rows.find(row => row.actions.some(action => action.enabled));
    const action = row.actions.find(action => action.enabled);
    const blocked = render(model, { ...state, catalogRowId: row.id, catalogMoreOpen: true }, safeInsets, { chrome: runtime });
    assert.equal(blocked.actions.size, 0, 'busy/blocked runtime cannot execute merchant actions');
    blocked.local.get(`MobileSheetShopAction:${action.actionId}`)();
    const condition = render(model, blocked.nextState(), safeInsets, { chrome: runtime });
    assert.ok(popupNode(condition), 'runtime-blocked action remains inspectable');
    assert.equal(condition.actions.size, 0, 'runtime condition popup cannot bypass the execution lock');
  }
  const owned = api.buildHubOwnedLoadoutViewModel(trained);
  const characterModel = add(trained);
  const overview = render(characterModel, { kind: 'character', page: 0 }, safeInsets, { ownedLoadout: () => owned, actionPool: owned.rows.flatMap(row => row.actions) });
  assert.ok(overview.local.has('MobileSheetTab:overview') && overview.local.has('MobileSheetTab:loadout'), 'hub character exposes overview and preparation destinations');
  overview.local.get('MobileSheetTab:loadout')();
  assert.equal(overview.nextState().tab, 'loadout', 'preparation tab opens its full owned catalogue');
  assertCatalogReachable(characterModel, 'character', owned, { ownedLoadout: () => owned, actionPool: owned.rows.flatMap(row => row.actions) });
  const combatCharacter = render(add(trainedCombat), { kind: 'character', page: 0 });
  assert.ok(!combatCharacter.local.has('MobileSheetTab:loadout'), 'combat character does not offer hub configuration');
}

// The portal is a single service list. Choices retain projection-owned events,
// while the one entry request stays outside the scrolling region.
const entrySignatures = new Set();
let checkedEntryServices = 0;
let checkedEntryDungeons = 0;
let checkedEntryOptions = 0;
function assertEntryReachable(model) {
  const allServices = model.sections[1].detail.entryServices;
  const services = allServices?.filter(service => service.id !== 'dungeon');
  const confirm = model.sections[2].actions.find(action => action.actionId === 'hub.entry.confirm');
  assert.ok(services?.length && confirm, 'portal supplies real services and its original entry request');
  const signature = JSON.stringify([allServices, confirm]);
  if (entrySignatures.has(signature)) return;
  entrySignatures.add(signature);
  const directory = render(model, { kind: 'entry', page: 0 });
  assertDarkSheet(directory, 'entry', safeInsets);
  const dungeonOptions = allServices.find(service => service.id === 'dungeon').options;
  const directoryNodes = nodesIn(directory.rootNode);
  assert.equal(directoryNodes.filter(node => node.name.startsWith('MobileSheetEntryDungeon:')).length, api.DUNGEON_ORDER.length, 'default portal lists all 19 chapters immediately');
  assert.ok(!directoryNodes.some(node => node.name === 'MobileSheetEntryConfirm' || node.name.startsWith('MobileSheetEntryService:')), 'chapter directory has no premature entry button or service accordion');
  for (const option of dungeonOptions) {
    const name = `MobileSheetEntryDungeon:${option.id}`;
    const row = directoryNodes.find(node => node.name === name);
    assert.ok(row, `${option.id}: every chapter remains visible in the default list`);
    assert.ok(nodesIn(row).some(node => node.getComponent(api.Label)?.string?.includes(option.name)), 'chapter row displays its human-readable name');
    if (option.selected) {
      assert.equal(directory.actions.get(name), undefined, 'opening the current chapter does not dispatch a redundant selection');
      assert.ok(directory.local.has(name), 'current chapter can still open its preparation page');
      directory.local.get(name)();
      assert.equal(directory.nextState().entryView, 'configuration', 'current chapter opens configuration directly');
    } else {
      assert.equal(directory.actions.get(name), option.action, 'chapter choice forwards the exact projected selection event');
    }
    checkedEntryDungeons += 1;
  }
  const state = { kind: 'entry', page: 0, entryView: 'configuration' };
  const view = render(model, state);
  assertDarkSheet(view, 'entry', safeInsets);
  const nodes = nodesIn(view.rootNode);
  assert.equal(nodes.filter(node => node.name.startsWith('MobileSheetEntryService:')).length, services.length, 'configuration lists its services without repeating the chapter selector');
  assert.ok(!nodes.some(node => node.name === 'MobileSheetEntryService:dungeon'), 'chapter selection belongs to the directory');
  assert.ok(view.local.has('MobileSheetEntryBack'), 'configuration can return to the chapter directory');
  assert.ok(!nodes.some(node => /^MobileSheet(?:Previous$|Next$|Tab:|Action:|Execute:)/.test(node.name)), 'portal omits generic paged controls and second confirmation screens');
  assert.ok(!nodes.some(node => node.name.startsWith('MobileSheetEntryOption:')), 'service options start collapsed');
  assert.equal(nodes.filter(node => node.name === 'MobileSheetEntryConfirm').length, 1, 'portal has exactly one entry button');
  const footer = nodes.find(node => node.name === 'MobileSheetEntryFooter');
  assert.ok(footer && nodesIn(footer).some(node => node.name === 'MobileSheetEntryConfirm'), 'entry button belongs to its fixed footer');
  let ancestor = footer.parent;
  while (ancestor) {
    assert.equal(ancestor.getComponent(api.ScrollView), null, 'entry footer is outside every scrolling region');
    ancestor = ancestor.parent;
  }
  if (confirm.enabled) assert.equal(view.actions.get('MobileSheetEntryConfirm'), confirm, 'footer executes the one original entry request');
  else {
    assert.equal(view.actions.get('MobileSheetEntryConfirm'), undefined, 'disabled entry request cannot execute');
    const footerText = nodesIn(footer).map(node => node.getComponent(api.Label)?.string ?? '').join('');
    assert.ok(normalizeText(footerText).includes(normalizeText(confirm.disabledReason)), 'disabled entry reason is readable in the fixed footer');
  }
  for (const service of services) {
    const row = nodes.find(node => node.name === `MobileSheetEntryService:${service.id}`);
    const rowText = nodesIn(row).map(node => node.getComponent(api.Label)?.string ?? '').join('');
    assert.ok(rowText.includes(service.name) && rowText.includes(service.summary), `${service.id}: collapsed row names the service and current selection`);
    const open = view.local.get(row.name);
    assert.ok(open, `${service.id}: service can expand locally`);
    open();
    const selected = view.nextState();
    assert.equal(selected.entryServiceId, service.id, 'expansion belongs to the chosen service');
    assert.equal(selected.selectedActionId, undefined, 'service selection does not require an action confirmation screen');
    const expanded = render(model, selected);
    assertDarkSheet(expanded, 'entry', safeInsets);
    const options = nodesIn(expanded.rootNode).filter(node => node.name.startsWith('MobileSheetEntryOption:'));
    assert.equal(options.length, service.options.length, `${service.id}: expansion exposes every choice without paging`);
    for (const option of service.options) {
      const node = options.find(node => node.name === `MobileSheetEntryOption:${option.action.actionId}`);
      assert.ok(node, `${service.id}/${option.id}: projected option remains visible`);
      const action = expanded.actions.get(node.name);
      if (option.action.enabled && !option.selected) assert.equal(action, option.action, 'service choice executes the exact projection-owned event');
      else {
        assert.equal(action, undefined, 'selected or locked service choice cannot execute');
        if (option.action.disabledReason) {
          const description = nodesIn(node).filter(child => child.name === 'EntryOptionDescription').map(child => child.getComponent(api.Label)?.string ?? '').join('');
          assert.ok(normalizeText(description).includes(normalizeText(option.action.disabledReason)), `${service.id}/${option.id}: complete disabled reason remains readable`);
        }
      }
      assert.notEqual(option.action.actionId, 'hub.entry.confirm', 'entry request is never repeated as a service choice');
      checkedEntryOptions += 1;
    }
    expanded.local.get(row.name)();
    assert.equal(expanded.nextState().entryServiceId, undefined, 'expanded service can collapse again');
    checkedEntryServices += 1;
  }
}
function assertEntryActionDestination(model, original) {
  const services = model.sections[1].detail.entryServices;
  const actions = services.flatMap(service => service.options.map(option => option.action));
  if (original.actionId === 'hub.entry.confirm') return;
  if (original.event) {
    assert.ok(actions.some(action => JSON.stringify(action.event) === JSON.stringify(original.event)), `${original.actionId}: full service choices preserve the previous event`);
    return;
  }
  if (actions.some(action => action.actionId === original.actionId)) return;
  const replacedCycles = {
    'hub.entry.route-contract:next': 'route-contract',
    'hub.entry.relic-seed:next': 'relic-seed',
  };
  const service = services.find(service => service.id === replacedCycles[original.actionId]);
  assert.ok(service, `${original.actionId}: removed disabled cycle has an explicit service destination`);
  assert.ok(service.options.some(option => !option.action.enabled), `${original.actionId}: service retains the unavailable/selected state`);
}
{
  const model = add(rich, { hubPanel: 'entry' });
  const services = model.sections[1].detail.entryServices;
  const dungeon = services.find(service => service.id === 'dungeon');
  assert.equal(dungeon.options.length, api.DUNGEON_ORDER.length, 'the projection supplies all 19 chapters for the default directory');
  assert.deepEqual(services.map(service => service.id), ['dungeon', 'protocol', 'route-contract', 'relic-frame', 'relic-seed'], 'standard entry lists its five preparation services');
  assertEntryReachable(model);
  const deep = add(rich, { hubPanel: 'entry', entryDraft: { dungeonId: api.DUNGEON_ORDER[0], protocolId: 'deep', infernoTier: 1 } });
  assert.ok(deep.sections[1].detail.entryServices.some(service => service.id === 'inferno-tier'), 'deep exploration exposes its tier service');
  assertEntryReachable(deep);
  const previousFrame = api.view.frameSize;
  try {
    for (const frame of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
      api.view.frameSize = frame;
      for (const entryServiceId of [undefined, 'protocol']) {
        const view = render(model, { kind: 'entry', page: 0, entryView: 'configuration', entryServiceId });
        const nodes = nodesIn(view.rootNode);
        const footer = nodes.find(node => node.name === 'MobileSheetEntryFooter');
        const button = nodes.find(node => node.name === 'MobileSheetEntryConfirm');
        const box = boundsRelativeTo(button, footer);
        const size = footer.getComponent(api.UITransform).contentSize;
        assert.ok(Math.abs(box.height / catalogCssUnit() - 44) < 0.6, 'entry button remains compact at both phone widths');
        assert.ok(Math.abs(box.right - size.width / 2) < 0.6, 'entry button aligns with the footer right edge');
        assert.ok(box.left >= -size.width / 2 && box.bottom >= -size.height / 2 - 0.6 && box.top <= size.height / 2 + 0.6, 'entry button fits its footer');
        const scroll = nodes.find(node => node.getComponent(api.ScrollView));
        assert.ok(scroll, 'all portal service choices share a scrollable region');
        const sheet = nodes.find(node => node.name === 'MobileInfoSheet:entry');
        const footerBox = boundsRelativeTo(footer, sheet);
        const scrollBox = boundsRelativeTo(scroll, sheet);
        assert.ok(footerBox.top <= scrollBox.bottom + 0.6, 'fixed entry footer never overlaps the scrolling service list');
      }
    }
  } finally {
    api.view.frameSize = previousFrame;
  }
  const directoryState = { kind: 'entry', page: 0 };
  const directory = render(model, directoryState);
  const scroll = nodesIn(directory.rootNode).find(node => node.getComponent(api.ScrollView)).getComponent(api.ScrollView);
  scroll.scrollToOffset(new api.Vec2(0, 180));
  const captured = api.captureInfiniteFlowInfoSheetState(directory.rootNode, directoryState);
  assert.equal(captured.catalogScrollOffset, 180, 'portal captures chapter list position before a host refresh');
  const refreshed = render(model, captured);
  assert.equal(nodesIn(refreshed.rootNode).find(node => node.getComponent(api.ScrollView)).getComponent(api.ScrollView).getScrollOffset().y, 180, 'host refresh restores the chapter directory position');
  const current = dungeon.options.find(option => option.selected);
  refreshed.local.get(`MobileSheetEntryDungeon:${current.id}`)();
  const configurationState = refreshed.nextState();
  assert.equal(configurationState.entryView, 'configuration', 'current chapter opens its preparation page locally');
  assert.equal(configurationState.entryDungeonScrollOffset, 180, 'opening configuration stores the chapter directory position separately');
  assert.equal(configurationState.catalogScrollOffset, 0, 'configuration starts at its own list top');
  const transitioning = api.captureInfiniteFlowInfoSheetState(refreshed.rootNode, configurationState);
  assert.equal(transitioning.catalogScrollOffset, 0, 'cross-view capture does not overwrite the configuration scroll offset');
  const configuration = render(model, configurationState);
  configuration.local.get('MobileSheetEntryBack')();
  assert.equal(configuration.nextState().entryView, undefined, 'back returns to the default chapter directory');
  assert.equal(configuration.nextState().catalogScrollOffset, 180, 'back restores the directory offset, not the configuration offset');
  const returning = api.captureInfiniteFlowInfoSheetState(configuration.rootNode, configuration.nextState());
  assert.equal(returning.catalogScrollOffset, 180, 'cross-view capture does not overwrite the restored directory offset');
  const returned = render(model, returning);
  assert.equal(nodesIn(returned.rootNode).find(node => node.getComponent(api.ScrollView)).getComponent(api.ScrollView).getScrollOffset().y, 180, 'returned chapter directory resumes the original position');
  for (const runtime of [{ ...chrome, busyActionId: 'pending-action' }, { ...chrome, modeKind: 'blocked', blockingMessage: 'storage unavailable' }]) {
    const view = render(model, { kind: 'entry', page: 0, entryView: 'configuration', entryServiceId: 'protocol' }, safeInsets, { chrome: runtime });
    assert.equal(view.actions.size, 0, 'busy/blocked runtime cannot change preparation or request entry');
    assert.ok(nodesIn(view.rootNode).some(node => node.name === 'MobileSheetEntryConfirm'), 'runtime locking retains the fixed entry button');
  }
}

const commands = new Set();
const lawCommands = new Set();
const pendingKinds = new Set();
const soulSkills = new Set();
const combatSignatures = new Set();
let originalActions = 0;
let enabledCommands = 0;
let checkedMovement = 0;
for (const model of models) {
  const detail = model.sections[1].detail;
  const original = model.sections[2].actions;
  if (detail.kind === 'explore' && detail.pending) pendingKinds.add(detail.pending.kind);
  const surfaces = detail.kind === 'hub' ? [detail.activePanel === 'entry' ? 'entry' : 'npc']
    : detail.kind === 'combat' ? ['menu', 'inventory'] : detail.kind === 'explore' ? ['interaction', 'menu'] : ['result'];
  const available = new Set();
  for (const kind of surfaces) {
    const selected = api.getInfiniteFlowMobilePanelActions(model, kind);
    const sourceActions = kind === 'npc' ? [...detail.shop.rows.flatMap(row => row.actions), ...detail.shop.services]
      : kind === 'entry' ? [...original, ...detail.entryServices.flatMap(service => service.options.map(option => option.action))] : original;
    for (const action of selected) { assert.ok(sourceActions.includes(action), `${kind} cannot forge actions`); available.add(action); }
    if (kind === 'npc') assertCatalogReachable(model, kind, detail.shop);
    else if (kind === 'entry') assertEntryReachable(model);
    else assertSheetReachable(model, kind, selected);
  }
  const world = api.buildWalkWorld(model);
  for (const action of original) {
    originalActions += 1;
    if (action.event?.kind === 'command') {
      enabledCommands += 1;
      commands.add(action.event.command.type);
      if (action.event.command.type.startsWith('law/')) lawCommands.add(action.event.command.type);
      if (action.event.command.type === 'node/use-soul-skill') soulSkills.add(action.event.command.skillId);
    }
    if (action.placement === 'map') {
      if (action.enabled) {
        assert.ok(world.targets.some((target) => target.action === action), `${detail.kind}: ${action.actionId} retains its original nearby-door command`);
        checkedMovement += 1;
      }
      // Disabled nonadjacent/fog map choices intentionally have no execution
      // control. Known cells explain their state in the read-only map sheet.
      continue;
    }
    if (action.event?.kind === 'local' && action.event.action.type === 'hub/select-panel') {
      assert.ok(world.targets.some((target) => target.action === action), `${action.actionId} remains reachable at its actual NPC/portal`);
      continue;
    }
    if (detail.kind === 'hub' && detail.activePanel !== 'entry') {
      assertNpcActionDestination(model, action);
      continue;
    }
    if (detail.kind === 'hub' && detail.activePanel === 'entry') {
      assertEntryActionDestination(model, action);
      continue;
    }
    assert.ok(available.has(action), `${detail.kind}: missing ${action.enabled ? 'enabled' : 'disabled'} ${action.actionId}`);
  }
  if (detail.kind === 'combat') {
    const signature = JSON.stringify(original);
    if (combatSignatures.has(signature)) continue;
    combatSignatures.add(signature);
    const reached = new Set();
    for (let page = 0; page < Math.ceil(original.length / 4); page += 1) {
      api.renderInfiniteFlowWalkScene(new api.Node('CombatHudTest'), model, {
        spec: world, position: world.spawn, safeInsets, surfaceHeight: 1334, chrome, page,
        visual() {}, trackSprite() {}, bindLocal() {}, bindHelp() {}, bindInteract() {},
        openDetails() {}, openCodex() {}, setPage() {},
        bindAction(_node, action) { assert.ok(original.includes(action)); reached.add(action); },
      });
    }
    assert.equal(reached.size, original.length, 'normal combat HUD retains every original paged action');
  }
}

assertSheetReachable(trapModel, 'interaction', [trapRisk]);
assert.deepEqual([...replacedLegacyControls].sort(), ['bag-carry', 'catalog-cycle', 'loadout-shortcuts', 'material-cycle', 'owned-configuration'], 'every intentionally relocated NPC control is explicitly accounted for');
assert.deepEqual([...pendingKinds].sort(), ['dungeon-event', 'equipment-offer', 'field-survey', 'law', 'relic-draft', 'soul-recharge']);
assert.equal(lawCommands.size, 11, 'all eleven law command families occur in authentic chapter projections');
for (const required of [
  'hub/buy-item', 'hub/configure-tactical-loadout', 'hub/recover', 'hub/configure-relic',
  'hub/buy-equipment', 'hub/equip-equipment', 'hub/upgrade-equipment', 'hub/attune-equipment', 'hub/temper-equipment',
  'hub/start-equipment-commission', 'hub/recall-equipment-commission', 'hub/activate-equipment-memory',
  'hub/buy-pet', 'hub/upgrade-pet', 'hub/activate-pet', 'hub/learn-method', 'hub/upgrade-method', 'hub/activate-method',
  'hub/unlock-bloodline', 'hub/upgrade-bloodline', 'hub/activate-bloodline',
  'hub/recruit-companion', 'hub/upgrade-companion', 'hub/activate-companion', 'hub/claim-task',
  'combat/act', 'combat/use-method-technique', 'combat/use-companion-assist', 'combat/use-bloodline-surge',
  'node/activate-soul-recharge', 'node/resolve-soul-recharge', 'node/cancel-soul-recharge', 'node/use-soul-skill',
  'result/archive-relic', 'result/return-hub', 'run/retreat',
]) assert.ok(commands.has(required), `coverage includes enabled ${required}`);
assert.ok(soulSkills.has('mist_fixed_point'), 'enabled trap soul skill is covered');
assert.ok(soulSkills.has('rift_misalignment'), 'enabled portal soul-skill variants are covered');
assert.ok(soulSkills.has('rift_seal'), 'enabled reward soul-skill variants are covered');

console.log(`Mobile sheet actions: ${models.length} real VMs (${sourceFixtureCount} existing fixtures), ${originalActions} original actions, ${enabledCommands} enabled commands; ${sheetLists} concrete paged lists, ${checkedActionDetails} action details, ${disabledReadouts} full disabled readouts; ${checkedMovement} original door movements, ${combatSignatures.size} combat HUD variants; ${lawCommands.size} law families and ${pendingKinds.size} pending kinds. Dark UI: ${sheetFixtures.length} sheet types, ${darkSheetVisualCases} visual cases, ${darkBodyLabels} body labels, minimum body contrast ${darkMinimumBodyContrast.toFixed(3)}, danger/positive contrast >= 4.5. Catalog entries: ${JSON.stringify(catalogEntries)}. Full NPC/owned lists: ${checkedCatalogs}, direct or targeted catalog actions: ${checkedCatalogActions}. Task lists: ${checkedTaskLists}, task rows: ${checkedTaskRows}, task details: ${checkedTaskDetails}, kinds: ${[...taskKinds].join(',')}. Full maps: ${checkedFullMaps}, map cells: ${checkedMapCells}. Entry chapters: ${checkedEntryDungeons}, services: ${checkedEntryServices}, projected entry options: ${checkedEntryOptions}.`);
