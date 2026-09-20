import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../../', import.meta.url));
const captureKey = '__INFINITE_FLOW_MOBILE_ACTION_MODELS__';
const ccStub = `
export class Node {
  constructor(name='') { this.name=name; this.children=[]; this.components=[]; }
  addChild(child) { this.children.push(child); child.parent=this; }
  setPosition(position) { this.position=position; }
  setScale() {} setSiblingIndex() {}
  getChildByName(name) { return this.children.find(child=>child.name===name) ?? null; }
  addComponent(Type) { const component=new Type(); component.node=this; this.components.push(component); return component; }
  getComponent(Type) { return this.components.find(component=>component instanceof Type) ?? null; }
  on() {}
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
  getScrollOffset() { return { x: 0, y: 0 }; }
}
export class Rect {} export class Sprite { static SizeMode={CUSTOM:0,RAW:1,TRIMMED:2}; } export class SpriteFrame {} export class Vec2 {}
export const Input={EventType:{}}; export const KeyCode={}; export const input={}; export const game={}; export const Game={};
export const view={ getFrameSize(){ return {width:0,height:0}; } };
`;

// Reuse the repository's real presentation regression states (commissions,
// memory, growth, battle and settlements). The capture wrapper exists only in
// this in-memory bundle; no production or existing test source is changed.
globalThis[captureKey] = [];
const bundle = await build({
  stdin: {
    contents: `
      import './packages/presentation/test/view-model.test.ts';
      export { buildGameViewModel, HUB_PANELS } from './packages/presentation/src/index.ts';
      export { createInitialState, DUNGEONS, DUNGEON_ORDER, EQUIPMENT, ITEMS } from '@infinite-flow/core';
      export { reduceGameCommand } from '@infinite-flow/application';
      export { signalFirstNodeClear, recordCombatReplayTake, DUNGEON_LAW_LANDMARKS } from '@infinite-flow/core/dungeon-laws';
      export { EQUIPMENT_SOUL_SKILL_CATALOG } from '@infinite-flow/core/equipment-soul-skills';
      export { renderInfiniteFlowInfoSheet, getInfiniteFlowMobilePanelActions, productionFrameGeometry } from './cocos/assets/scripts/ui/InfiniteFlowInfoSheet.ts';
      export { renderInfiniteFlowWalkScene } from './cocos/assets/scripts/ui/InfiniteFlowWalkScene.ts';
      export { buildWalkWorld } from './cocos/assets/scripts/ui/walk-world.ts';
      export { formatInfiniteFlowHubActionLockedReason } from './cocos/assets/scripts/ui/InfiniteFlowView.ts';
      export { DARK_UI } from './cocos/assets/scripts/ui/dark-ui.ts';
      export { Node, UITransform, Label, Graphics, BlockInputEvents } from 'cc';
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
delete globalThis[captureKey];
assert.ok(models.length > 100, 'real presentation fixtures were captured');
const sourceFixtureCount = models.length;
const add = (state, local = {}) => {
  const model = api.buildGameViewModel(state, local);
  models.push(model);
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
  { type: 'hub/configure-tactical-loadout', itemIds: ['healing_pill', 'thunder_talisman'] },
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
  const pool = extras.actionPool ?? [];
  api.renderInfiniteFlowInfoSheet(rootNode, model, state, {
    chrome, safeInsets: insets, surfaceHeight: 1334,
    bindLocal: (node, callback) => local.set(node.name, callback),
    bindAction: (node, action) => {
      assert.ok(model.sections[2].actions.includes(action) || pool.includes(action),
        `${node.name}: exact original action object (model or declared auxiliary pool)`);
      actions.set(node.name, action);
    },
    ...(extras.supplyActions === undefined ? {} : { supplyActions: extras.supplyActions }),
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
function assertDarkSheet(view, kind, insets) {
  const nodes = nodesIn(view.rootNode);
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
  assert.deepEqual({ ...band.getComponent(api.UITransform).contentSize }, { width: width - 20, height: 104 });
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
    while (ancestor && nativeFrame(ancestor) === undefined) ancestor = ancestor.parent;
    assert.ok(ancestor, `${kind}/${node.name}: body label has a known reading surface`);
    const background = nativeFrame(ancestor).color;
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
  if (action && ['entry', 'npc', 'interaction', 'inventory', 'result'].includes(kind)) {
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

// --- WoW-style bag: 5x100 (9 real tactical items + 91 decorative blanks) ---
const carriedThree = commit(rich, {
  type: 'hub/configure-tactical-loadout',
  itemIds: ['healing_pill', 'thunder_talisman', 'dispel_talisman'],
});
const carriedThreeSupplies = add(carriedThree, {
  hubPanel: 'supplies',
  hubSelections: { supplies: 'thunder_talisman' },
});
{
  const view = render(carriedThreeSupplies, { kind: 'inventory', page: 0 });
  assertDarkSheet(view, 'inventory', safeInsets);
  const nodes = nodesIn(view.rootNode);
  assert.equal(nodes.filter((node) => /^MobileSheetItem:/.test(node.name)).length, 9, 'bag: nine real tactical cells');
  assert.equal(nodes.filter((node) => /^MobileSheetBlank:/.test(node.name)).length, 91, 'bag: ninety-one decorative blanks');
  assert.equal(nodes.filter((node) => node.name === 'ItemCarriedSeal').length, 3, 'bag: three carried seals');
  assert.ok(nodes.some((node) => node.name === 'MobileSheetInventoryRack'), 'bag: rack keeps its contract name');
  assert.ok(nodes.some((node) => node.name === 'MobileSheetScroll'), 'bag: rack scrolls in-window');
  for (const node of nodes) {
    if (/^MobileSheetBlank:/.test(node.name)) {
      assert.equal(node.getComponent(api.Label), null, 'blank: no label');
      assert.ok(!view.local.has(node.name), 'blank: no touch binding');
    }
  }
  const carryLine = view.labels.find(({ name }) => name === 'Label' || true) && view.labels.map(({ text }) => text).find((text) => text.includes('携行槽 3 / 3'));
  assert.ok(carryLine, 'bag: carry capacity line reads 3 / 3');
  const reward = view.labels.map(({ text }) => text).find((text) => text.includes('50000'));
  assert.ok(reward, 'bag: hub reward points shown');
}

// --- Item tooltip: hub supplies panel binds the REAL toggle command ---
{
  const view = render(hubSuppliesModel, { kind: 'inventory', page: 0, tip: { kind: 'item', id: 'healing_pill' } });
  const nodes = nodesIn(view.rootNode);
  assert.ok(nodes.some((node) => node.name === 'MobileSheetTip'), 'tip: card mounted');
  const texts = view.labels.map(({ text }) => text);
  assert.ok(texts.some((text) => text === api.ITEMS.healing_pill.name), 'tip: item name');
  assert.ok(texts.some((text) => text.includes('兑换价')), 'tip: catalog price line');
  const toggle = hubSuppliesModel.sections[2].actions.find((action) => action.actionId === 'hub.supplies.toggle:healing_pill');
  assert.ok(toggle, 'fixture: supplies projects the toggle action');
  assert.equal(view.actions.get('MobileSheetTipCarry:healing_pill'), toggle, 'tip: carry binds the exact VM action object');
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
  const view = render(hubOther, { kind: 'inventory', page: 0, tip: { kind: 'item', id: 'thunder_talisman' } },
    safeInsets, { supplyActions: () => suppliesActions, actionPool: suppliesActions });
  const toggle = suppliesActions.find((action) => action.actionId === 'hub.supplies.toggle:thunder_talisman');
  assert.equal(view.actions.get('MobileSheetTipCarry:thunder_talisman'), toggle, 'tip: seam resolves the real toggle action');
  assert.ok(view.labels.map(({ text }) => text).includes('取消携行'), 'tip: carried item offers unset wording');
}

// --- Full-slot advisory text on a non-carried item ---
{
  const suppliesFocus = add(carriedThree, {
    hubPanel: 'supplies',
    hubSelections: { supplies: 'focus_incense' },
  });
  const view = render(suppliesFocus, { kind: 'inventory', page: 0, tip: { kind: 'item', id: 'focus_incense' } });
  assert.ok(view.labels.map(({ text }) => text).includes('通用携行槽已满（3 / 3）'), 'tip: cap advisory at 3/3');
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
    for (const action of selected) { assert.ok(original.includes(action), `${kind} cannot forge actions`); available.add(action); }
    assertSheetReachable(model, kind, selected);
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

console.log(`Mobile sheet actions: ${models.length} real VMs (${sourceFixtureCount} existing fixtures), ${originalActions} original actions, ${enabledCommands} enabled commands; ${sheetLists} concrete paged lists, ${checkedActionDetails} action details, ${disabledReadouts} full disabled readouts; ${checkedMovement} original door movements, ${combatSignatures.size} combat HUD variants; ${lawCommands.size} law families and ${pendingKinds.size} pending kinds. Dark UI: ${sheetFixtures.length} sheet types, ${darkSheetVisualCases} visual cases, ${darkBodyLabels} body labels, minimum body contrast ${darkMinimumBodyContrast.toFixed(3)}, danger/positive contrast >= 4.5. Catalog entries: ${JSON.stringify(catalogEntries)}.`);
