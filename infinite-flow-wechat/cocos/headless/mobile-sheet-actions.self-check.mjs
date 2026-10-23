import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../../', import.meta.url));
const captureKey = '__INFINITE_FLOW_MOBILE_ACTION_MODELS__';
const captureStateKey = `${captureKey}_STATES`;
const ccStub = `
export class Node {
  static EventType={TOUCH_START:'touch-start',TOUCH_MOVE:'touch-move',TOUCH_END:'touch-end',TOUCH_CANCEL:'touch-cancel'};
  constructor(name='') { this.name=name; this.children=[]; this.components=[]; this.events=new Map(); }
  addChild(child) { this.children.push(child); child.parent=this; }
  setPosition(position) { this.position=position; }
  setScale() {} setSiblingIndex() {}
  getChildByName(name) { return this.children.find(child=>child.name===name) ?? null; }
  addComponent(Type) { const component=new Type(); component.node=this; this.components.push(component); return component; }
  getComponent(Type) { return this.components.find(component=>component instanceof Type) ?? null; }
  on(event, callback) { const list=this.events.get(event) ?? []; list.push(callback); this.events.set(event,list); }
  off(event, callback) { this.events.set(event,(this.events.get(event) ?? []).filter(candidate=>candidate!==callback)); }
  emit(event, payload) { for(const callback of this.events.get(event) ?? []) callback(payload); }
  destroy() { this.destroyed=true; for(const child of [...this.children]) child.destroy(); this.children=[]; this.events.clear(); if(this.parent) this.parent.children=this.parent.children.filter(child=>child!==this); }
}
export class UITransform { setContentSize(sizeOrWidth,height) { this.contentSize=typeof sizeOrWidth==='number' ? {width:sizeOrWidth,height} : sizeOrWidth; } }
export class Size { constructor(width,height) { Object.assign(this,{width,height}); } }
export class Vec3 { constructor(x,y,z) { Object.assign(this,{x,y,z}); } }
export class Color { constructor(r,g,b,a=255) { Object.assign(this,{r,g,b,a}); } }
export class Label {
  static HorizontalAlign={LEFT:0,CENTER:1,RIGHT:2};
  static VerticalAlign={TOP:0,CENTER:1,BOTTOM:2};
  static Overflow={SHRINK:0,CLAMP:1};
}
export class Graphics {
  static LineCap={ROUND:1}; static LineJoin={ROUND:1};
  constructor() { this.clear(); }
  roundRect(x,y,width,height,radius) { this.roundRectCalls+=1; this.shape={kind:'roundRect',x,y,width,height,radius}; }
  rect(x,y,width,height) { this.shape={kind:'rect',x,y,width,height}; }
  circle(x,y,radius) { this.circleCalls+=1; this.shape={kind:'circle',x,y,radius}; }
  moveTo(x,y) { this.shape={kind:'path',points:[{x,y}],closed:false}; }
  lineTo(x,y) { if(this.shape?.kind==='path') this.shape.points.push({x,y}); }
  bezierCurveTo(c1x,c1y,c2x,c2y,x,y) { if(this.shape?.kind==='path') this.shape.points.push({x:c1x,y:c1y},{x:c2x,y:c2y},{x,y}); }
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
export class Rect { constructor(x,y,width,height) { Object.assign(this,{x,y,width,height}); } }
export class Sprite { static SizeMode={CUSTOM:0,RAW:1,TRIMMED:2}; constructor() { this.spriteFrame=null; this.trim=true; } }
export class SpriteFrame {
  static createWithImage(image) { return new SpriteFrame(image); }
  constructor(image) { this.image=image; this.texture={destroy(){}}; }
  destroy() {}
}
export class Vec2 { constructor(x=0,y=0) { Object.assign(this,{x,y}); } }
export const Input={EventType:{KEY_DOWN:'key-down',KEY_UP:'key-up'}}; export const KeyCode={};
export const input={on(){},off(){}}; export const game={on(){},off(){}}; export const Game={EVENT_HIDE:'hide'};
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
      export { RUN_RELIC_IDS, RUN_RELIC_DEFINITIONS, RUN_RELIC_FRAME_DEFINITIONS, generateRunRelicDraft } from '@infinite-flow/core/run-relics';
      export { renderInfiniteFlowInfoSheet, captureInfiniteFlowInfoSheetState, getInfiniteFlowMobilePanelActions, getInfiniteFlowCombatChoiceActions, productionFrameGeometry } from './cocos/assets/scripts/ui/InfiniteFlowInfoSheet.ts';
      export { renderInfiniteFlowWalkScene, fitDungeonHtmlTargets, getDungeonHtmlRoomLayout, getRouteForecastCaption } from './cocos/assets/scripts/ui/InfiniteFlowWalkScene.ts';
      export { buildWalkWorld } from './cocos/assets/scripts/ui/walk-world.ts';
      export { getInfiniteFlowSceneVisualKeys } from './cocos/assets/scripts/ui/scene-visuals.ts';
      export { HERO_WALK_ATLAS } from './cocos/assets/scripts/ui/hero-walk-atlas.ts';
      export { InfiniteFlowView, formatInfiniteFlowHubActionLockedReason, formatInfiniteFlowHubPlayerCopy } from './cocos/assets/scripts/ui/InfiniteFlowView.ts';
      export { DARK_UI } from './cocos/assets/scripts/ui/dark-ui.ts';
      export { COMPACT_SHEET_THEME } from './cocos/assets/scripts/ui/sheet-theme.ts';
      export { Node, UITransform, Label, Graphics, BlockInputEvents, Mask, ScrollView, Sprite, Vec2, view } from 'cc';
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
const propLayout = JSON.parse(await readFile(new URL('../../prototype/style-refresh/asset-layout.json', import.meta.url), 'utf8'));
function supplySceneVisualFixtures(controller, model) {
  for (const key of new Set(Object.values(api.getInfiniteFlowSceneVisualKeys(model)))) {
    if (key === undefined || controller.sceneVisuals.has(key)) continue;
    const prop = key.startsWith('scene:dungeon_prop_') ? propLayout[`${key.slice('scene:dungeon_prop_'.length)}-proposed.png`] : undefined;
    const dimensions = key === 'character:reincarnator_walk' ? api.HERO_WALK_ATLAS
      : prop ?? { width: 1024, height: 1536 };
    controller.setSceneVisualAsset({ width: dimensions.width, height: dimensions.height }, { key, revision: 'complete-mobile-sheet-fixture' });
  }
}
function createWalkArtFixtures(model, overrides = new Map()) {
  const controller = new api.InfiniteFlowView(new api.Node('SceneArtFixture'), { activate() {} });
  supplySceneVisualFixtures(controller, model);
  const visuals = new Map(controller.sceneVisuals);
  for (const [key, visual] of overrides) visuals.set(key, visual);
  const walkerFrames = controller.sceneVisuals.get('character:reincarnator_walk').frames;
  assert.equal(walkerFrames.length, 16, 'scene fixture uses the actual measured 16-frame player atlas');
  return { walkerFrames, visual: key => visuals.get(key), dispose: () => controller.destroy() };
}
function sceneWalkWorld(model, world) {
  if (model.phase !== 'explore' && model.phase !== 'combat') return world;
  return api.fitDungeonHtmlTargets(world, api.getDungeonHtmlRoomLayout({
    worldWidth: world.width, worldHeight: world.height,
    surfaceHeight: 1334, viewportWidth: 320, safeInsets,
  }));
}
function assertSceneTarget(actual, original, fitted, message) {
  assert.ok(actual, `${message}: target remains reachable at its rendered feet`);
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(original).sort(), `${message}: target fields are preserved`);
  for (const key of Object.keys(original).filter(key => key !== 'x' && key !== 'y')) {
    assert.equal(actual[key], original[key], `${message}: original ${key} identity is preserved`);
  }
  assert.deepEqual({ x: actual.x, y: actual.y }, { x: fitted.x, y: fitted.y }, `${message}: coordinates follow the scene layout`);
  if (fitted === original) assert.equal(actual, original, `${message}: unprojected world keeps the original target`);
  else assert.notEqual(actual, original, `${message}: dungeon layout uses a view-local target`);
}
function render(model, state, insets = safeInsets, extras = {}) {
  const rootNode = new api.Node('MobileActionTest');
  const local = new Map();
  const actions = new Map();
  let nextState;
  let closes = 0;
  const shop = model.sections[1].detail.shop;
  const services = model.sections[1].detail.entryServices ?? [];
  const equipmentActions = model.sections[1].loadout?.ownedEquipment?.map(entry => entry.equipAction) ?? [];
  const pool = [...services.flatMap(service => service.options.map(option => option.action)), ...equipmentActions, ...(extras.actionPool ?? []), ...(shop?.rows.flatMap(row => row.actions) ?? []), ...(shop?.services ?? [])];
  api.renderInfiniteFlowInfoSheet(rootNode, model, state, {
    chrome: extras.chrome ?? chrome, safeInsets: insets, surfaceHeight: 1334,
    viewportWidth: 750 / catalogCssUnit(),
    bindLocal: (node, callback) => local.set(node.name, callback),
    bindAction: (node, action) => {
      assert.ok(model.sections[2].actions.includes(action) || pool.includes(action),
        `${node.name}: exact original action object (model or declared auxiliary pool)`);
      actions.set(node.name, action);
    },
    ...(extras.supplyActions === undefined ? {} : { supplyActions: extras.supplyActions }),
    ...(extras.ownedLoadout === undefined ? {} : { ownedLoadout: extras.ownedLoadout }),
    ...(extras.images === undefined ? {} : { images: extras.images }),
    ...(extras.rewardReceipt === undefined ? {} : { rewardReceipt: extras.rewardReceipt }),
    close() { closes += 1; }, setState(next) { nextState = next; }, openHelp() {},
  });
  const labels = [];
  const visit = (node) => {
    const label = node.getComponent(api.Label);
    if (label !== null) labels.push({ name: node.name, text: label.string });
    for (const child of node.children) visit(child);
  };
  visit(rootNode);
  return { rootNode, local, actions, labels, nextState: () => nextState, closes: () => closes };
}

function renderCombatHud(model, page = 0, runtime = chrome) {
  const rootNode = new api.Node('CombatHudTest');
  const world = api.buildWalkWorld(model);
  const local = new Map();
  const actions = new Map();
  let choiceGroup;
  const art = createWalkArtFixtures(model);
  api.renderInfiniteFlowWalkScene(rootNode, model, {
    spec: world, position: world.spawn, safeInsets, surfaceHeight: 1334, chrome: runtime, page,
    walkerFrames: art.walkerFrames, visual: art.visual, trackSprite() {}, bindHelp() {}, bindInteract() {},
    openDetails() {}, openCodex() {}, setPage() {},
    bindLocal(node, callback) { local.set(node.name, callback); },
    openCombatChoices(group) { choiceGroup = group; },
    bindAction(node, action) {
      assert.ok(model.sections[2].actions.includes(action), 'combat HUD preserves original actions');
      actions.set(node.name, action);
    },
  });
  return { rootNode, local, actions, choiceGroup: () => choiceGroup };
}

// The warm stone gate is presentation only: art loading and proximity must
// preserve the world's target semantics and command at the scene's fitted feet.
let checkedStoneGates = 0;
{
  const key = 'scene:dungeon_transition_gate';
  const candidates = models.filter(model => model.phase === 'explore');
  const blockedModel = candidates.find(model => api.buildWalkWorld(model).targets.some(target => target.kind === 'transition' && target.disabledReason));
  const allowedModel = candidates.find(model => api.buildWalkWorld(model).targets.some(target => target.kind === 'transition' && target.action));
  assert.ok(blockedModel && allowedModel, 'real projections cover blocked and available region entrances');
  for (const model of [blockedModel, allowedModel]) {
    const originalModel = JSON.stringify(model);
    const world = api.buildWalkWorld(model);
    const originalWorld = JSON.stringify(world);
    const sceneWorld = sceneWalkWorld(model, world);
    const doors = world.targets.filter(target => target.kind === 'transition');
    const selectedDoor = doors.find(target => Boolean(target.action) === (model === allowedModel));
    const selectedSceneDoor = sceneWorld.targets.find(target => target.id === selectedDoor.id);
    for (const loaded of [false, true]) {
      const rootNode = new api.Node('StoneGateTest');
      const frame = { source: 'approved-stone-gate-test-frame' };
      const tracked = [];
      let getInteractionTarget;
      const art = createWalkArtFixtures(model, new Map([[key, loaded ? { frame, width: 804, height: 1104 } : undefined]]));
      const options = {
        spec: world, position: selectedSceneDoor, safeInsets, surfaceHeight: 1334, chrome, page: 0,
        walkerFrames: art.walkerFrames, visual: art.visual,
        trackSprite(sprite) { tracked.push(sprite); }, bindHelp() {},
        bindInteract(_node, getTarget) { getInteractionTarget = getTarget; },
        openDetails() {}, openCodex() {}, setPage() {}, bindLocal() {}, openCombatChoices() {},
        bindAction(_node, action) { assert.ok(model.sections[2].actions.includes(action), 'gate art cannot forge commands'); },
      };
      if (!loaded) {
        assert.throws(() => api.renderInfiniteFlowWalkScene(rootNode, model, options),
          { message: `Walk scene required art is not ready: ${key}` }, 'missing gate art rejects the incomplete scene');
        assert.equal(rootNode.children.length, 0, 'missing gate art creates no scene or interaction controls');
        assert.equal(JSON.stringify(world), originalWorld, 'missing gate art never changes the original world');
        assert.equal(JSON.stringify(model), originalModel, 'missing gate art never changes the public model');
        art.dispose();
        continue;
      }
      const rendered = api.renderInfiniteFlowWalkScene(rootNode, model, options);
      assertSceneTarget(getInteractionTarget(), selectedDoor, selectedSceneDoor, 'nearby stone gate interaction');
      for (const target of doors) {
        const node = nodesIn(rootNode).find(node => node.name === `WalkTarget:${target.id}`);
        const fittedTarget = sceneWorld.targets.find(candidate => candidate.id === target.id);
        assert.deepEqual({ x: node.position.x, y: node.position.y }, { x: fittedTarget.x, y: -fittedTarget.y },
          'stone gate artwork uses the same fitted feet as interaction');
        const body = node.getChildByName('WorldObjectBody');
        const artwork = body.getChildByName('WalkTransitionGateSprite');
        const status = node.getChildByName('WalkTransitionState').getComponent(api.Label).string;
        // A door with a route forecast previews the room behind it; arrival still reads as such.
        assert.equal(status, target.forecast !== undefined
          ? target.id === selectedDoor.id && target.disabledReason === undefined ? '已到达入口' : api.getRouteForecastCaption(target.forecast).text
          : target.action === undefined ? '封闭' : target.disabledReason !== undefined ? '入口未开放'
            : target.id === selectedDoor.id ? '已到达入口' : '入口畅通');
        assert.ok(node.getChildByName('WalkTargetName').getComponent(api.Label).string.includes(target.label),
          'stone gate retains its original visible destination title');
        const sprite = artwork?.getComponent(api.Sprite);
        assert.equal(sprite?.spriteFrame, frame, 'gate renders the approved acquired frame');
        assert.ok(tracked.includes(sprite), 'gate participates in the existing sprite lifecycle');
        assert.equal(sprite.grayscale, Boolean(target.disabledReason), 'blocked artwork has a distinct unavailable treatment');
        assert.equal(Boolean(body.getChildByName('WalkTransitionGroundLight')), !target.disabledReason,
          'only available gates receive the warm ground light');
        checkedStoneGates += 1;
      }
      rendered.dispose();
      art.dispose();
      assert.equal(JSON.stringify(world), originalWorld, 'rendering art and proximity never change the original world');
      assert.equal(JSON.stringify(model), originalModel, 'rendering art and proximity never change the public model');
    }
  }
}

// Selecting a courtyard portal cannot replace an in-dungeon portal or exit.
for (const [phase, kind] of [['explore', 'portal'], ['explore', 'exit'], ['hub', 'portal']]) {
  const context = `${phase}/${kind}`;
  const model = models.find(model => model.phase === phase && api.buildWalkWorld(model).targets.some(target => target.kind === kind));
  assert.ok(model, `real projections include ${context}`);
  const world = api.buildWalkWorld(model);
  const originalWorld = JSON.stringify(world);
  const target = world.targets.find(target => target.kind === kind);
  const sceneTarget = sceneWalkWorld(model, world).targets.find(candidate => candidate.id === target.id);
  const before = JSON.stringify(model);
  const rootNode = new api.Node('UnchangedDungeonDoorTest');
  const requested = [];
  const art = createWalkArtFixtures(model);
  let getInteractionTarget;
  const rendered = api.renderInfiniteFlowWalkScene(rootNode, model, {
    spec: world, position: sceneTarget, safeInsets, surfaceHeight: 1334, chrome, page: 0,
    walkerFrames: art.walkerFrames,
    visual(key) {
      requested.push(key);
      return art.visual(key);
    },
    trackSprite() {}, bindHelp() {}, bindInteract(_node, getTarget) { getInteractionTarget = getTarget; },
    openDetails() {}, openCodex() {}, setPage() {}, bindLocal() {}, openCombatChoices() {},
    bindAction(_node, action) { assert.ok(model.sections[2].actions.includes(action)); },
  });
  assertSceneTarget(getInteractionTarget(), target, sceneTarget, context);
  const actor = nodesIn(rootNode).find(node => node.name === `WalkTarget:${target.id}`);
  assert.deepEqual({ x: actor.position.x, y: actor.position.y }, { x: sceneTarget.x, y: -sceneTarget.y }, `${context}: artwork and interaction share their feet`);
  const body = actor.getChildByName('WorldObjectBody');
  assert.equal(body.getChildByName('WalkTransitionGateSprite'), null);
  if (phase === 'hub') {
    assert.equal(body.getChildByName('WalkHubDungeonPortalSprite')?.getComponent(api.Sprite)?.spriteFrame,
      art.visual('scene:hub_dungeon_portal').frame, 'hub portal keeps its declared courtyard artwork');
    assert.equal(body.getChildByName('WalkDungeonPropSprite:exit'), null);
  } else {
    assert.equal(body.getChildByName('WalkHubDungeonPortalSprite'), null);
    assert.equal(body.getChildByName('WalkDungeonPropSprite:exit')?.getComponent(api.Sprite)?.spriteFrame,
      art.visual('scene:dungeon_prop_exit').frame, `in-dungeon ${kind} uses its declared dungeon exit artwork`);
    assert.equal(requested.includes('scene:hub_dungeon_portal'), false, `in-dungeon ${kind} never requests the hub-only asset`);
  }
  rendered.dispose();
  art.dispose();
  assert.equal(JSON.stringify(world), originalWorld, `${context}: rendering leaves its original world unchanged`);
  assert.equal(JSON.stringify(model), before, `${context}: rendering leaves its public model unchanged`);
}

// Approved dungeon objects change only presentation. Exercise each object against
// actual projections so pending choices and legal actions retain their identity.
const propKinds = ['chest', 'exit', 'event', 'trap', 'survey', 'relic', 'shrine', 'law'];
let checkedDungeonProps = 0;
{
  const allPropKeys = [...propKinds, 'debris'].map(kind => `scene:dungeon_prop_${kind}`);
  for (const model of models.filter(model => ['hub', 'result'].includes(model.phase))) {
    assert.ok(Object.values(api.getInfiniteFlowSceneVisualKeys(model)).every(key => !allPropKeys.includes(key)),
      `${model.phase}: dungeon-only props have no scene-resource intent`);
  }
  for (const kind of propKinds) {
    const model = models.find(model => model.phase === 'explore' && api.buildWalkWorld(model).targets.some(target => target.kind === kind));
    assert.ok(model, `${kind}: real projected dungeon object fixture exists`);
    const world = api.buildWalkWorld(model);
    const target = world.targets.find(target => target.kind === kind);
    const originalModel = JSON.stringify(model);
    const originalWorld = JSON.stringify(world);
    const sceneTarget = sceneWalkWorld(model, world).targets.find(candidate => candidate.id === target.id);
    const key = `scene:dungeon_prop_${kind}`;
    assert.ok(Object.values(api.getInfiniteFlowSceneVisualKeys(model)).includes(key), `${kind}: requested via the existing App resource lifecycle`);
    const layout = propLayout[`${kind}-proposed.png`];
    for (const loadState of ['pending', 'ready', 'invalid']) {
      const rootNode = new api.Node(`DungeonPropTest:${kind}:${loadState}`);
      const frame = { kind, loadState };
      const tracked = [];
      let getInteractionTarget;
      const requested = [];
      const art = createWalkArtFixtures(model, new Map([[key, loadState === 'pending' ? undefined
        : { frame, width: loadState === 'invalid' ? 0 : layout.width, height: layout.height }]]));
      const options = {
        spec: world, position: sceneTarget, safeInsets, surfaceHeight: 1334, chrome, page: 0,
        walkerFrames: art.walkerFrames,
        visual(requestedKey) {
          requested.push(requestedKey);
          return art.visual(requestedKey);
        },
        trackSprite(sprite) { tracked.push(sprite); }, bindHelp() {},
        bindInteract(_node, getTarget) { getInteractionTarget = getTarget; },
        openDetails() {}, openCodex() {}, setPage() {}, bindLocal() {}, openCombatChoices() {},
        bindAction(_node, action) { assert.ok(model.sections[2].actions.includes(action), 'prop art cannot forge commands'); },
      };
      if (loadState !== 'ready') {
        assert.throws(() => api.renderInfiniteFlowWalkScene(rootNode, model, options),
          { message: `Walk scene required art is not ready: ${key}` }, `${kind}/${loadState}: incomplete scene art fails explicitly`);
        assert.equal(rootNode.children.length, 0, `${kind}/${loadState}: incomplete art creates no scene nodes`);
        assert.ok(requested.includes(key), `${kind}/${loadState}: renderer validates its own object identity`);
        assert.equal(JSON.stringify(world), originalWorld, `${kind}/${loadState}: original world is immutable`);
        assert.equal(JSON.stringify(api.buildWalkWorld(model)), originalWorld, `${kind}/${loadState}: collisions, radii and actions remain unchanged`);
        assert.equal(JSON.stringify(model), originalModel, `${kind}/${loadState}: public model is immutable`);
        art.dispose();
        checkedDungeonProps += 1;
        continue;
      }
      const rendered = api.renderInfiniteFlowWalkScene(rootNode, model, options);
      assertSceneTarget(getInteractionTarget(), target, sceneTarget, `${kind}/${loadState}`);
      const actor = nodesIn(rootNode).find(node => node.name === `WalkTarget:${target.id}`);
      assert.deepEqual({ x: actor.position.x, y: actor.position.y }, { x: sceneTarget.x, y: -sceneTarget.y }, `${kind}: artwork and interaction share their fitted feet`);
      const body = actor.getChildByName('WorldObjectBody');
      const artwork = body.getChildByName(`WalkDungeonPropSprite:${kind}`);
      const sprite = artwork?.getComponent(api.Sprite);
      assert.equal(sprite?.spriteFrame, frame, `${kind}: approved acquired frame renders`);
      assert.ok(tracked.includes(sprite), `${kind}: participates in frame cleanup`);
      assert.equal(body.getComponent(api.Graphics), null, `${kind}: ready art needs no geometric placeholder`);
      const size = artwork.getComponent(api.UITransform).contentSize;
      assert.ok(Math.abs(size.width / size.height - layout.width / layout.height) < 1e-10, `${kind}: full image preserves its aspect ratio`);
      const scale = size.width / layout.width;
      const [left, , right, bottom] = layout.bounds;
      assert.ok(Math.abs(artwork.position.x + ((left + right) / 2 - layout.width / 2) * scale) < 1e-8,
        `${kind}: visible alpha body is centered on the fitted target`);
      assert.ok(Math.abs(artwork.position.y + (layout.height / 2 - bottom) * scale) < 1e-8,
        `${kind}: visible alpha feet stay on the fitted foot origin`);
      assert.ok(requested.includes(key), `${kind}: renderer requests its own object identity`);
      assert.ok(!requested.includes('scene:hub_dungeon_portal'), `${kind}: cannot use courtyard-only portal artwork`);
      assert.equal(JSON.stringify(world), originalWorld, `${kind}/${loadState}: original world is immutable`);
      assert.equal(JSON.stringify(api.buildWalkWorld(model)), originalWorld, `${kind}/${loadState}: collisions, radii and actions remain unchanged`);
      assert.equal(JSON.stringify(model), originalModel, `${kind}/${loadState}: public model is immutable`);
      rendered.dispose();
      art.dispose();
      checkedDungeonProps += 1;
    }
  }

  // The fixed HTML room keeps its perimeter collisions without interior debris.
  for (const phase of ['explore', 'combat']) {
    const model = models.find(model => model.phase === phase);
    assert.ok(model, `${phase}: real room fixture exists`);
    const world = api.buildWalkWorld(model);
    const snapshot = JSON.stringify(world);
    const originalModel = JSON.stringify(model);
    assert.ok(world.obstacles.length > 0 && world.obstacles.every(obstacle => obstacle.width >= 140 || obstacle.height >= 140),
      `${phase}: fixed room contains only perimeter obstacles`);
    const layout = propLayout['debris-proposed.png'];
    const frame = { source: 'approved-debris' };
    const rootNode = new api.Node(`DebrisTest:${phase}`);
    const tracked = [];
    const art = createWalkArtFixtures(model, new Map([['scene:dungeon_prop_debris', { frame, width: layout.width, height: layout.height }]]));
    const rendered = api.renderInfiniteFlowWalkScene(rootNode, model, {
      spec: world, position: world.spawn, safeInsets, surfaceHeight: 1334, chrome, page: 0,
      walkerFrames: art.walkerFrames, visual: art.visual,
      trackSprite(sprite) { tracked.push(sprite); }, bindHelp() {}, bindInteract() {},
      openDetails() {}, openCodex() {}, setPage() {}, bindLocal() {}, openCombatChoices() {}, bindAction() {},
    });
    for (const [index, obstacle] of world.obstacles.entries()) {
      const footprint = nodesIn(rootNode).find(node => node.name === `WalkObstacleFootprint:${index}`);
      assert.deepEqual({ x: footprint.position.x, y: footprint.position.y },
        { x: obstacle.x + obstacle.width / 2, y: -(obstacle.y + obstacle.height) }, `${phase}: obstacle foot anchor is preserved`);
      assert.equal(footprint.getChildByName('WalkDungeonPropSprite:debris'), null,
        `${phase}: room boundary remains its original visible wall footprint`);
    }
    assert.equal(nodesIn(rootNode).filter(node => node.name === 'WalkDungeonPropSprite:debris').length, 0,
      `${phase}: fixed room never reintroduces interior debris`);
    assert.ok(tracked.every(sprite => sprite.spriteFrame !== frame), `${phase}: perimeter does not acquire a debris sprite`);
    assert.equal(JSON.stringify(world), snapshot, `${phase}: rendering leaves original collisions unchanged`);
    assert.equal(JSON.stringify(api.buildWalkWorld(model)), snapshot, `${phase}: room presentation does not change collisions`);
    assert.equal(JSON.stringify(model), originalModel, `${phase}: room presentation leaves its public model unchanged`);
    rendered.dispose();
    art.dispose();
  }
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
function assertCompactCombatPicker(view, model, group, insets = safeInsets) {
  const nodes = nodesIn(view.rootNode);
  const frame = nodes.find(node => node.name === 'MobileInfoSheet:menu');
  const size = frame.getComponent(api.UITransform).contentSize;
  const unit = catalogCssUnit();
  assert.ok(size.height / unit <= 464 + 0.6 && size.height <= 1334 - insets.top - insets.bottom - 88 * unit + 0.6,
    `${group}: picker uses the compact safe-surface height cap`);
  assert.equal(frame.position.y, (insets.bottom - insets.top) / 2,
    `${group}: compact picker stays centered inside the safe surface`);
  const backdrop = nodes.find(node => node.name === 'MobileSheetBackdrop');
  assert.equal(backdrop.getComponent(api.Graphics).fills[0].color.a, 0, `${group}: backdrop leaves the battlefield visible`);
  assert.ok(backdrop.getComponent(api.BlockInputEvents), `${group}: backdrop blocks accidental world actions`);
  assert.ok(view.local.has('MobileSheetClose') && view.local.has('MobileSheetBackdrop'), `${group}: close and outside tap both dismiss locally`);
  assert.ok(!nodes.some(node => /^MobileSheet(?:Previous$|Next$|PageCount$|CombatReturn$|ActionBack$|Execute:)/.test(node.name)),
    `${group}: picker has no paging or extra confirmation layer`);
  const choices = api.getInfiniteFlowCombatChoiceActions(model, group);
  const cards = nodes.filter(node => node.name.startsWith('MobileSheetAction:'));
  assert.equal(cards.length, choices.length, `${group}: all choices exist in one scrolling list`);
  for (const action of choices) {
    const key = `MobileSheetAction:${action.actionId}`;
    const card = cards.find(node => node.name === key);
    assert.ok(card, `${group}: ${action.actionId} remains visible`);
    assert.ok(!view.local.has(key), `${group}: choosing ${action.actionId} never opens another detail layer`);
    if (action.enabled) assert.equal(view.actions.get(key), action, `${group}: a second tap dispatches the exact original action`);
    else {
      assert.ok(!view.actions.has(key), `${group}: disabled ${action.actionId} has no command binding`);
      const readout = nodesIn(card).find(node => node.name === 'ActionReadoutPreview')?.getComponent(api.Label)?.string;
      assert.ok(readout?.replace(/\s/gu, '').includes(action.disabledReason.replace(/\s/gu, '')),
        `${group}: disabled reason remains fully available on its card`);
    }
  }
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
const isCatalogSurface = (node) => /^(?:MobileSheetShop(?:Action:.*|More:.*|Services)|MobileSheetCatalogDetailClose|MobileSheetCatalogDetail|MobileSheetCatalogMore|MobileSheetCatalogCancelAction|MobileSheetCatalogActionMenu|MobileSheetEntryConfirm|ShopIconFrame)$/.test(node.name);
function catalogFrame(node) {
  if (!isCatalogSurface(node)) return undefined;
  return nativeFrame(node.getChildByName('ButtonVisual') ?? node);
}
function readingFrame(node) {
  return isCatalogSurface(node) ? catalogFrame(node)
    : nativeFrame(node.getChildByName('ButtonVisual') ?? node);
}
function assertCatalogSurfaces(view) {
  for (const node of nodesIn(view.rootNode).filter(isCatalogSurface)) {
    const frame = catalogFrame(node);
    assert.ok(frame, `${node.name}: catalog uses the shared compact reading surface`);
    assertNativeFrame(node.getChildByName('ButtonVisual') ?? node, node.name);
    for (const child of nodesIn(node)) {
      const label = child.getComponent(api.Label);
      if (label?.string) assert.ok(contrast(label.color, frame.color) >= 4.5,
        `${node.name}/${child.name}: readable against its actual catalog fill`);
    }
  }
}
function assertWindowSheetFrame(view, get, panel, kind, insets, unit) {
  const viewportWidth = 750 / unit;
  const expected = api.productionFrameGeometry(insets, 1334, kind, viewportWidth);
  const width = expected.width;
  const height = panel.getComponent(api.UITransform).contentSize.height;
  assert.ok(height > 0 && height <= expected.height + 0.6,
    `${kind}: content fits the compact safe-surface height cap`);
  assert.ok(width / unit <= 304 + 1e-6 && width <= 750 - insets.left - insets.right - 40 * unit + 1e-6,
    `${kind}: panel leaves the accepted 20px side margins`);
  assert.ok(height / unit <= 464 + 1e-6 && height <= 1334 - insets.top - insets.bottom - 88 * unit + 0.6,
    `${kind}: panel leaves space around both safe edges`);
  const frame = assertNativeFrame(panel, kind);
  assert.deepEqual(rgb(frame.color), rgb(api.COMPACT_SHEET_THEME.palette.surface), `${kind}: shared warm reading surface`);
  assert.deepEqual({ ...panel.position }, { x: expected.centerX, y: expected.centerY, z: 0 });
  assert.deepEqual({ ...panel.getComponent(api.UITransform).contentSize }, { width, height });
  assert.ok(panel.getComponent(api.BlockInputEvents), `${kind}: the modal still blocks world input`);
  assert.ok(get('MobileSheetBackdrop').getComponent(api.BlockInputEvents));
  const band = get('MobileSheetTitleBand');
  const padding = (viewportWidth <= 350 ? 11 : 12) * unit;
  assert.deepEqual({ ...band.getComponent(api.UITransform).contentSize }, { width: width - 2 * padding, height: 48 * unit });
  assert.ok(band.getComponent(api.Graphics)?.strokes.length > 0, `${kind}: header retains its quiet divider`);
  const close = get('MobileSheetClose');
  assert.deepEqual({ ...close.getComponent(api.UITransform).contentSize }, { width: 44 * unit, height: 44 * unit });
  assert.deepEqual({ ...close.position }, { x: width / 2 - padding - 22 * unit, y: height / 2 - padding - 24 * unit, z: 0 });
  assert.ok(view.local.has('MobileSheetClose'), `${kind}: original close callback remains available`);
  const headerIcon = get('MobileSheetHeaderIcon');
  if (headerIcon) {
    const headerGraphics = headerIcon.getComponent(api.Graphics);
    assert.ok(headerGraphics.strokes.length + headerGraphics.fills.length > 0,
      `${kind}: header uses native vector artwork`);
  } else assert.ok(get('RewardChestImage'), `${kind}: reward header uses its acquired chest figure`);
  return { width, height };
}
// Explore room interactions dock at the bottom like the route prototype's room sheet.
function assertRoomSheetFrame(view, get, panel, insets, unit) {
  const viewportWidth = 750 / unit;
  const { width, height } = panel.getComponent(api.UITransform).contentSize;
  // The 10px bottom margin and 44px under the safe top stay clear, as around the replaced window.
  const cap = 1334 - insets.top - insets.bottom - 54 * unit;
  assert.ok(Math.abs(width - (750 - insets.left - insets.right - 20 * unit)) < 1e-6, 'interaction: room sheet spans the safe width less 10px margins');
  assert.ok(height > 0 && height <= cap + 0.6, 'interaction: room sheet stays within its height cap');
  assert.ok(Math.abs(panel.position.x - (insets.left - insets.right) / 2) < 1e-6, 'interaction: room sheet is centered between the safe edges');
  assert.ok(Math.abs(panel.position.y - height / 2 - (-1334 / 2 + insets.bottom + 10 * unit)) < 1e-6,
    'interaction: room sheet docks 10px above the safe bottom');
  const frame = assertNativeFrame(panel, 'interaction');
  assert.deepEqual(rgb(frame.color), [28, 23, 17], 'interaction: room sheet shares the room event sheet surface');
  assert.ok(panel.getComponent(api.BlockInputEvents), 'interaction: the sheet blocks world input');
  const backdrop = get('MobileSheetBackdrop');
  assert.ok(backdrop.getComponent(api.BlockInputEvents), 'interaction: walking stays suspended while it is open');
  assert.equal(backdrop.getComponent(api.Graphics).fills[0].color.a, 0, 'interaction: the room stays visible above the sheet');
  for (const name of ['MobileSheetRoomArt', 'MobileSheetRoomArtFigure', 'MobileSheetKicker', 'MobileSheetTitle', 'MobileSheetBody']) {
    assert.ok(get(name), `interaction: room sheet renders ${name}`);
  }
  assert.ok(!get('MobileSheetTitleBand') && !get('MobileSheetTab:overview') && !get('MobileSheetTab:actions'),
    'interaction: no centered window band or tabs');
  const first = get('MobileSheetClose') ?? get('MobileSheetRewardBack');
  assert.ok(first && view.local.has(first.name), 'interaction: the button row starts with a local 收起 or 返回');
  if (first.name === 'MobileSheetClose') assert.ok(nodesIn(first).some(node => node.getComponent(api.Label)?.string === '收起'), 'interaction: 收起 wording');
  const row = get('MobileSheetBody').children.filter(node => /^MobileSheet(?:Close|RewardBack|RewardServices|RewardClaim|RelicClaim|EquipmentClaim|Execute:)/.test(node.name));
  assert.ok(row.length >= 1 && row[0] === first, 'interaction: 收起 or 返回 leads the button row');
  for (const button of row) {
    assert.ok(Math.abs(button.getComponent(api.UITransform).contentSize.height / unit - (viewportWidth <= 350 ? 46 : 52)) < 0.6,
      `interaction/${button.name}: room sheet buttons keep the prototype height`);
    assert.ok(Math.abs(button.position.y - button.getComponent(api.UITransform).contentSize.height / 2
      + get('MobileSheetBody').getComponent(api.UITransform).contentSize.height / 2) < 1e-6, `interaction/${button.name}: buttons sit on the body's bottom edge`);
  }
  return { width, height };
}
function assertDarkSheet(view, kind, insets) {
  const nodes = nodesIn(view.rootNode);
  assertCatalogSurfaces(view);
  const get = (name) => nodes.find((node) => node.name === name);
  const panel = get(`MobileInfoSheet:${kind}`);
  const unit = catalogCssUnit();
  const viewportWidth = 750 / unit;
  const { width, height } = kind === 'interaction' ? assertRoomSheetFrame(view, get, panel, insets, unit)
    : assertWindowSheetFrame(view, get, panel, kind, insets, unit);
  for (const name of new Set([...view.local.keys(), ...view.actions.keys()])) {
    const target = get(name);
    assert.ok(target, `${kind}/${name}: a binding owns an actual rendered node`);
    const size = target.getComponent(api.UITransform).contentSize;
    assert.ok(size.width / unit >= 43.99 && size.height / unit >= 43.99,
      `${kind}/${name}: executable and local controls keep a 44px physical touch floor`);
  }
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
    } else if (/^MobileSheetCarry(?:Item|Slot):/.test(name)) {
      assert.ok(kind === 'character' || kind === 'inventory', 'carry controls belong to the character sheet or its legacy route');
      assert.ok(action.enabled && action.event?.kind === 'command', 'carry binds only executable original commands');
      assert.equal(action.event.command.type, 'hub/configure-tactical-loadout', 'carry controls configure the actual domain loadout');
    } else if (name.startsWith('MobileSheetShopAction:')) {
      assert.ok(kind === 'npc' || kind === 'character', 'catalog direct action stays on its owning sheet');
      assert.ok(action.enabled && action.event, 'catalog directly binds only executable original actions');
      assert.ok(Math.abs(get(name).getComponent(api.UITransform).contentSize.height / catalogCssUnit() - 44) < 0.6,
        'catalog actions retain the prototype 44 CSS-pixel height');
    } else if (name.startsWith('MobileSheetTipEquip:')) {
      assert.equal(kind, 'inventory', 'wearing equipment belongs to its inventory tooltip');
      assert.ok(action.enabled && action.event?.kind === 'command', 'inventory equipment binds only executable projected commands');
      assert.equal(action.event.command.type, 'hub/equip-equipment', 'inventory wears the actual owned equipment');
    } else if (name === 'MobileSheetEquipmentClaim') {
      assert.equal(kind, 'interaction', 'equipment claims stay on the pending interaction');
      assert.ok(action.enabled && action.event?.kind === 'command', 'equipment claims bind only executable original commands');
      assert.equal(action.event.command.type, 'node/resolve-equipment-loot', 'equipment claim resolves the actual offer');
    } else if (name === 'MobileSheetRewardClaim' || name === 'MobileSheetRelicClaim') {
      assert.equal(kind, 'interaction', 'reward and relic claims stay on the current interaction');
      assert.ok(action.enabled && action.event?.kind === 'command', 'loot claims bind only executable original commands');
      assert.equal(action.event.command.type, name === 'MobileSheetRewardClaim' ? 'node/collect-reward' : 'node/resolve-relic-draft',
        'loot CTA executes its actual projected domain command');
    } else {
      assert.ok(name.startsWith('MobileSheetExecute:'), `${kind}/${name}: an action must use the explicit confirmation control`);
      const confirm = action.event?.kind === 'local' && action.event.action.type === 'entry/request-enter' ? '确认入场' : '确认执行';
      assert.ok(nodesIn(get(name)).some((node) => node.getComponent(api.Label)?.string === confirm), `${kind}/${name}: explicit confirmation wording is preserved`);
    }
  }
  const panelNodes = new Set(nodesIn(panel));
  for (const node of nodes) {
    if (/^(MobileSheet(?:Previous|Next|ActionBack|MetricBack|MapBack|RelatedHelp|TipClose)$|MobileSheet(?:Execute|Tab|Action|Metric|Help|Shortcut|TipCarry):)/.test(node.name)) {
      const surface = node.getChildByName('ButtonVisual') ?? node;
      if (surface.getComponent(api.Graphics)?.fills.length) assertNativeFrame(surface, `${kind}/${node.name}`);
    }
    if (kind !== 'interaction' && /^MobileSheet(?:Previous$|Next$|ActionBack$|MetricBack$|MapBack$|RelatedHelp$|Execute:|TipClose$|TipCarry:)/.test(node.name)) {
      assert.ok(Math.abs(node.getComponent(api.UITransform).contentSize.height / unit - 44) < 0.6,
        `${kind}/${node.name}: original action keeps a 44px touch target`);
    }
    const visual = node.getChildByName('ButtonVisual');
    if (visual) {
      const targetSize = node.getComponent(api.UITransform).contentSize;
      const visualSize = visual.getComponent(api.UITransform).contentSize;
      assert.ok(Math.abs(targetSize.height / unit - 44) < 0.6 && targetSize.width / unit <= 148 + 0.6,
        `${kind}/${node.name}: compact button retains its complete touch region`);
      assert.ok(Math.abs(visualSize.height / unit - 32) < 0.6 && visualSize.width <= targetSize.width + 0.6,
        `${kind}/${node.name}: visible plate stays compact inside the touch region`);
      assert.deepEqual({ ...visual.position }, { x: 0, y: 0, z: 0 }, `${kind}/${node.name}: button plate is centered in its touch region`);
    }
    const scroll = node.getComponent(api.ScrollView);
    if (scroll && panelNodes.has(node)) {
      const size = node.getComponent(api.UITransform).contentSize;
      const box = boundsRelativeTo(node, panel);
      assert.ok(size.height / unit <= 300 + 0.6, `${kind}/${node.name}: scroll viewport is bounded to 300px`);
      assert.ok(node.getComponent(api.Mask), `${kind}/${node.name}: overflow is clipped inside the window`);
      assert.ok(box.left >= -width / 2 - 0.6 && box.right <= width / 2 + 0.6
        && box.bottom >= -height / 2 - 0.6 && box.top <= height / 2 + 0.6,
        `${kind}/${node.name}: scrolling remains inside the modal frame`);
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
      const semanticColor = api.COMPACT_SHEET_THEME.palette[semantic === 'red' ? 'danger' : 'positive'];
      if (rgb(label.color).every((value, index) => value === rgb(semanticColor)[index])) darkSemanticText.add(semantic);
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
let checkedCompactSheetFamilies = 0;
const sheetFixtureFrame = api.view.frameSize;
try {
  for (const frame of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
    api.view.frameSize = frame;
    for (const [kind, model] of sheetFixtures) {
      assert.ok(model, `${kind}: reuse an existing authentic presentation fixture`);
      const snapshot = JSON.stringify(model);
      for (const insets of [safeInsets, { top: 160, right: 28, bottom: 110, left: 18 }]) {
        assertDarkSheet(render(model, { kind, page: 0 }, insets), kind, insets);
        checkedCompactSheetFamilies += 1;
      }
      const action = api.getInfiniteFlowMobilePanelActions(model, kind).find((candidate) => candidate.enabled);
      if (action && ['interaction', 'inventory', 'result'].includes(kind)) {
        const detail = render(model, { kind, page: 0, tab: 'actions', selectedActionId: action.actionId });
        assertDarkSheet(detail, kind, safeInsets);
        assert.equal(detail.actions.get(`MobileSheetExecute:${action.actionId}`), action,
          `${kind}: compact confirmation keeps the original event object`);
      }
      assert.equal(JSON.stringify(model), snapshot, `${frame.width}px/${kind}: rendering all subpages preserves the public model`);
    }
  }
} finally {
  api.view.frameSize = sheetFixtureFrame;
}
for (const [severity, semantic] of [['danger', 'red'], ['positive', 'green']]) {
  const model = models.find((entry) => entry.sections[1].metrics.some((metric) => metric.severity === severity));
  assert.ok(model, `${severity}: authentic status fixture exists`);
  const metricIndex = model.sections[1].metrics.findIndex((metric) => metric.severity === severity);
  assertDarkSheet(render(model, { kind: 'character', page: Math.floor(metricIndex / 4) }), 'character', safeInsets);
  assert.ok(darkSemanticText.has(semantic), `${severity}: actual ${semantic} status text passes body contrast`);
}

// Non-square source fixtures make accidental stretching or cover-cropping
// visible across the shared figure path, rather than testing square placeholders.
let checkedCompactRasterFigures = 0;
{
  const sourceByFrame = new Map();
  const imagesByKey = new Map();
  const images = { get(key) {
    if (!key) return undefined;
    if (!imagesByKey.has(key)) {
      const source = { frame: { key }, width: key.startsWith('character:') ? 1024 : 160,
        height: key.startsWith('character:') ? 1536 : 200 };
      imagesByKey.set(key, source);
      sourceByFrame.set(source.frame, source);
    }
    return imagesByKey.get(key);
  } };
  const characterModel = sheetFixtures.find(([kind]) => kind === 'character')[1];
  const npcModel = models.find(model => model.sections[1].detail.kind === 'hub'
    && model.sections[1].detail.activePanel === 'equipment');
  assert.ok(characterModel.sections[1].loadout && npcModel.sections[1].detail.shop,
    'compact art fixtures retain real equipped slots and the equipment catalog');
  const previousFrame = api.view.frameSize;
  try {
    for (const frame of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
      api.view.frameSize = frame;
      const unit = catalogCssUnit();
      const cases = [
        render(characterModel, { kind: 'character', page: 0 }, safeInsets, { images }),
        render(hubSuppliesModel, { kind: 'inventory', page: 0 }, safeInsets, { images }),
        render(characterModel, { kind: 'inventory', tab: 'equipment', page: 0 }, safeInsets, { images }),
        render(npcModel, { kind: 'npc', page: 0 }, safeInsets, { images }),
      ];
      for (const view of cases) {
        for (const spriteNode of nodesIn(view.rootNode)) {
          const sprite = spriteNode.getComponent(api.Sprite);
          const source = sprite && sourceByFrame.get(sprite.spriteFrame);
          if (!source) continue;
          const size = spriteNode.getComponent(api.UITransform).contentSize;
          const slot = spriteNode.parent;
          const slotSize = slot.getComponent(api.UITransform).contentSize;
          assert.ok(Math.abs(size.width / size.height - source.width / source.height) < 1e-8,
            `${frame.width}px/${slot.name}: original art aspect ratio is preserved`);
          assert.ok(size.width <= slotSize.width + 1e-6 && size.height <= slotSize.height + 1e-6,
            `${slot.name}: the complete image is contained inside its own slot`);
          assert.ok(Math.abs(size.width - slotSize.width) < 1e-6 || Math.abs(size.height - slotSize.height) < 1e-6,
            `${slot.name}: contained art fills one available dimension`);
          assert.deepEqual({ ...spriteNode.position }, { x: 0, y: 0, z: 0 }, `${slot.name}: art stays centered`);
          assert.equal(sprite.trim, false, `${slot.name}: loaded art keeps its complete source image`);
          assert.equal(slot.getChildByName(`${slot.name}:Glyph`)?.active, false,
            `${slot.name}: loaded art hides its placeholder glyph`);
          checkedCompactRasterFigures += 1;
        }
      }
      const characterNodes = nodesIn(cases[0].rootNode);
      const portrait = characterNodes.find(node => node.name === 'DollPortrait');
      const portraitSize = portrait.getComponent(api.UITransform).contentSize;
      assert.ok(Math.abs(portraitSize.width / unit - 80) < 0.6 && Math.abs(portraitSize.height / unit - 96) < 0.6,
        `${frame.width}px: character portrait uses the accepted compact image slot`);
      const stage = characterNodes.find(node => node.name === 'MobileSheetDollStage');
      const equipmentSlots = characterNodes.filter(node => node.name.startsWith('MobileSheetEquip:'));
      assert.equal(equipmentSlots.length, characterModel.sections[1].loadout.equipment.length, 'all equipped slots remain available');
      equipmentSlots.forEach((slot, index) => {
        const size = slot.getComponent(api.UITransform).contentSize;
        assert.ok(Math.abs(size.width / unit - 44) < 0.6 && Math.abs(size.height / unit - 44) < 0.6,
          `${slot.name}: compact equipped slot retains the touch floor`);
        const box = boundsRelativeTo(slot, stage);
        for (const other of equipmentSlots.slice(index + 1)) {
          const otherBox = boundsRelativeTo(other, stage);
          assert.ok(Math.min(box.right, otherBox.right) - Math.max(box.left, otherBox.left) <= 0
            || Math.min(box.top, otherBox.top) - Math.max(box.bottom, otherBox.bottom) <= 0,
            'neighboring equipment slots never overlap');
        }
      });
      const bagSlots = nodesIn(cases[1].rootNode).filter(node => /^MobileSheet(?:Item|Blank):/.test(node.name));
      assert.equal(bagSlots.length, 100, 'compact supplies retain the complete bag');
      assert.equal(new Set(bagSlots.map(slot => slot.position.x)).size, 5, 'supplies use five columns at both phone widths');
      const npcSlots = nodesIn(cases[3].rootNode).filter(node => node.name.startsWith('MobileSheetShopTile:'));
      assert.equal(new Set(npcSlots.map(slot => slot.position.x)).size, Math.min(5, npcSlots.length),
        'NPC goods use five columns at both phone widths');
    }
  } finally {
    api.view.frameSize = previousFrame;
  }
}

// --- Bag keeps supplies; character carry owns the six tactical items ---
const carriedThree = commit(rich, {
  type: 'hub/configure-tactical-loadout',
  itemIds: ['thunder_talisman', 'dispel_talisman', 'gate_sigil'],
});
const carriedThreeSupplies = add(carriedThree, {
  hubPanel: 'supplies',
  hubSelections: { supplies: 'thunder_talisman' },
});
{
  // The bag defaults to supplies: 3 supply cells + 97 blanks, no seals.
  const view = render(carriedThreeSupplies, { kind: 'inventory', page: 0 });
  assertDarkSheet(view, 'inventory', safeInsets);
  const nodes = nodesIn(view.rootNode);
  assert.deepEqual(nodes.filter(node => node.name.startsWith('MobileSheetTab:')).map(node => node.name),
    ['MobileSheetTab:bag', 'MobileSheetTab:equipment', 'MobileSheetTab:run-relics'], 'bag: supplies, owned equipment and run relics have separate tabs');
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

  // Existing inventory/carry state restores the new compact carry surface.
  const carryView = render(carriedThreeSupplies, { kind: 'inventory', page: 0, tab: 'carry' });
  assertDarkSheet(carryView, 'character', safeInsets);
  const carryNodes = nodesIn(carryView.rootNode);
  assert.equal(carryNodes.filter((node) => /^MobileSheetCarryItem:/.test(node.name)).length, 6, 'legacy carry route: six tactical cards');
  assert.equal(carryNodes.filter((node) => /^MobileSheetCarrySlot:/.test(node.name)).length, 3, 'legacy carry route: three general slots');
  assert.equal(carryNodes.filter((node) => /^MobileSheetBlank:/.test(node.name)).length, 0, 'carry no longer pads a 100-cell bag');
  assert.ok(carryView.labels.some(({ name, text }) => name === 'MobileSheetCarryCount' && text === '3 / 3'), 'legacy carry route: real capacity');
}

// Relics are read-only run effects. Exercise the real selection command and
// projection before checking local sheet navigation and the complete catalog.
let checkedRunRelicLists = 0;
let checkedRunRelicCards = 0;
{
  const compactRelicText = value => value.replace(/\s/gu, '');
  const seededHub = commit({ ...rich, archivedRelicIds: ['mist_edge'] }, {
    type: 'hub/configure-relic', frame: 'assault', seedRelicId: 'mist_edge',
  });
  const entered = enter(seededHub);
  const awaiting = {
    ...entered,
    run: { ...entered.run, relicState: api.generateRunRelicDraft(entered.run.relicState, {
      draftId: 'run-relic-sheet-first', nodeId: entered.run.currentNodeId,
    }) },
  };
  const awaitingModel = add(awaiting);
  const choice = awaitingModel.sections[2].actions.find(action => action.event?.kind === 'command'
    && action.event.command.type === 'node/resolve-relic-draft' && action.event.command.relicId === 'mist_edge');
  assert.ok(choice?.enabled && choice.event?.kind === 'command', 'seeded mist edge is an actual pending draft choice');
  const acquired = commit(awaiting, choice.event.command);
  const acquiredModel = add(acquired);
  const combat = commit(acquired, { type: 'run/select-node', nodeId: acquired.run.currentNodeId });
  assert.equal(combat.phase, 'combat', 'selected relic persists into an actual battle');
  const combatModel = add(combat);
  const resultModel = models.find(model => model.phase === 'result' && stateByModel.get(model)?.run?.relicState?.acquiredIds.length);
  assert.ok(resultModel, 'settled relic fixture remains available to verify the run boundary');

  for (const [model, emptyText] of [
    [add(seededHub), '进入副本后可获得本局遗物'],
    [awaitingModel, '本局尚未获得遗物'],
    [add(trainedCombat), '本局尚未获得遗物'],
    [resultModel, '进入副本后可获得本局遗物'],
  ]) {
    const original = JSON.stringify(model);
    const view = render(model, { kind: 'inventory', page: 0, tab: 'run-relics' });
    assertDarkSheet(view, 'inventory', safeInsets);
    assert.ok(view.labels.some(({ name, text }) => name === 'MobileSheetRunRelicEmpty' && text === emptyText),
      `${model.phase}: relic empty state explains when effects become available`);
    assert.equal(nodesIn(view.rootNode).filter(node => node.name.startsWith('MobileSheetRunRelic:')).length, 0,
      `${model.phase}: pending candidates, archive seeds and settlements cannot become active relic cards`);
    assert.ok(view.labels.some(({ text }) => text === '本局遗物 0'), 'empty relic tab shows its real count');
    assert.equal(view.actions.size, 0, 'reading empty relics cannot dispatch a command');
    assert.equal(JSON.stringify(model), original, 'reading empty relics preserves the model');
    checkedRunRelicLists += 1;
  }

  // Each legal frame contributes its own three real projected effects. Combine
  // only their public rows to stress the scroll view without inventing an
  // impossible domain run that owns relics from multiple frozen frames.
  const allRelics = [];
  for (const frame of Object.keys(api.RUN_RELIC_FRAME_DEFINITIONS)) {
    let state = enter(commit(seededHub, { type: 'hub/configure-relic', frame }));
    for (let index = 0; index < 3; index += 1) {
      state = { ...state, run: { ...state.run, relicState: api.generateRunRelicDraft(state.run.relicState, {
        draftId: `run-relic-sheet-${frame}-${index}`, nodeId: state.run.currentNodeId,
      }) } };
      const action = api.buildGameViewModel(state, {}).sections[2].actions.find(action => action.actionId.startsWith('pending.relic:'));
      assert.ok(action?.enabled && action.event?.kind === 'command', `${frame}: remaining relic is selectable`);
      state = commit(state, action.event.command);
    }
    allRelics.push(...api.buildGameViewModel(state, {}).sections[1].loadout.runRelics);
  }
  assert.deepEqual(allRelics.map(relic => relic.relicId).sort(), [...api.RUN_RELIC_IDS].sort(), 'all nine real relics are covered');
  const withRelics = runRelics => ({
    ...acquiredModel,
    sections: acquiredModel.sections.map((section, index) => index === 1
      ? { ...section, loadout: { ...section.loadout, runRelics } } : section),
  });
  const longDescription = `${api.RUN_RELIC_DEFINITIONS.mending_thread.description} `.repeat(40).trim();
  const cases = [acquiredModel, combatModel, withRelics(allRelics), withRelics([
    { ...allRelics.find(relic => relic.relicId === 'mending_thread'), description: longDescription },
  ])];
  const previousFrame = api.view.frameSize;
  try {
    for (const frame of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
      api.view.frameSize = frame;
      for (const model of cases) {
        const original = JSON.stringify(model);
        const bag = render(model, { kind: 'inventory', page: 0 });
        assert.equal(bag.actions.size, 0, 'opening supplies is local');
        bag.local.get('MobileSheetTab:run-relics')();
        assert.deepEqual(bag.nextState(), { kind: 'inventory', page: 0, tab: 'run-relics' }, 'relic tab opens locally');
        const view = render(model, bag.nextState());
        assertDarkSheet(view, 'inventory', safeInsets);
        const nodes = nodesIn(view.rootNode);
        const relics = model.sections[1].loadout.runRelics;
        const list = nodes.find(node => node.name === 'MobileSheetRunRelicList');
        const scroll = list?.getComponent(api.ScrollView);
        assert.ok(scroll?.vertical && !scroll.horizontal && scroll.cancelInnerEvents, 'relic list scrolls vertically and cancels dragged taps');
        assert.ok(list.getComponent(api.Mask), 'relic list clips its long content');
        assert.ok(view.labels.some(({ name, text }) => name === 'MobileSheetRunRelicIntro'
          && compactRelicText(text) === '选中后自动生效，无需装备；仅本局有效。'), 'automatic application and run duration are explicit');
        assert.ok(view.labels.some(({ text }) => text === `本局遗物 ${relics.length}`), 'tab count follows acquired relics');
        assert.equal(nodes.filter(node => node.name.startsWith('MobileSheetRunRelic:')).length, relics.length);
        assert.equal(view.actions.size, 0, 'relic list never binds an equip, consume or domain command');
        assert.ok(!nodes.some(node => /^MobileSheetItem:|^MobileSheetBlank:/.test(node.name)), 'supply slots do not appear in the relic tab');
        for (const id of ['bag', 'run-relics']) {
          const tab = nodes.find(node => node.name === `MobileSheetTab:${id}`);
          assert.ok(tab.getComponent(api.UITransform).contentSize.height / catalogCssUnit() >= 43.99,
            `${frame.width}px: tabs retain the 44px minimum touch height`);
          assert.ok(!nodesIn(list).includes(tab), 'tabs stay outside the scrolling region');
        }
        for (const relic of relics) {
          const card = nodes.find(node => node.name === `MobileSheetRunRelic:${relic.relicId}`);
          assert.ok(nodesIn(scroll.content).includes(card), `${relic.relicId}: card belongs to scroll content`);
          assert.ok(!view.local.has(card.name), 'passive relic cards do not imply an equip interaction');
          const name = card.getChildByName('RunRelicName');
          const frameLabel = card.getChildByName('RunRelicFrame');
          const effect = card.getChildByName('RunRelicEffect');
          assert.equal(name?.getComponent(api.Label)?.string, relic.name);
          assert.equal(frameLabel?.getComponent(api.Label)?.string, `${relic.frameName}回响`);
          assert.equal(compactRelicText(effect?.getComponent(api.Label)?.string ?? ''), compactRelicText(relic.description),
            `${relic.relicId}: complete effect description survives wrapping`);
          const size = card.getComponent(api.UITransform).contentSize;
          for (const label of [name, frameLabel, effect]) {
            const box = boundsRelativeTo(label, card);
            assert.ok(box.left >= -size.width / 2 && box.right <= size.width / 2
              && box.bottom >= -size.height / 2 && box.top <= size.height / 2,
            `${relic.relicId}: all text fits its card at ${frame.width}px`);
          }
          assert.ok(boundsRelativeTo(name, card).bottom >= boundsRelativeTo(effect, card).top,
            `${relic.relicId}: name and effect do not overlap`);
          assert.ok(boundsRelativeTo(name, card).bottom >= boundsRelativeTo(frameLabel, card).top
            && boundsRelativeTo(frameLabel, card).bottom >= boundsRelativeTo(effect, card).top,
            `${relic.relicId}: name, frame and effect occupy separate rows`);
          checkedRunRelicCards += 1;
        }
        if (relics.length === 9 || relics[0].description === longDescription) {
          const viewportHeight = list.getComponent(api.UITransform).contentSize.height;
          const contentHeight = scroll.content.getComponent(api.UITransform).contentSize.height;
          assert.ok(contentHeight > viewportHeight, 'all-nine and long-description fixtures need scrolling');
          const thumb = nodes.find(node => node.name === 'MobileSheetScrollThumb');
          const initialThumbY = thumb.position.y;
          scroll.scrollToOffset(new api.Vec2(0, contentHeight - viewportHeight));
          assert.equal(scroll.getScrollOffset().y, contentHeight - viewportHeight, 'final effects are reachable at the end of the list');
          assert.ok(thumb.position.y < initialThumbY, 'scroll progress updates the visible thumb');
          const last = nodes.find(node => node.name === `MobileSheetRunRelic:${relics.at(-1).relicId}`);
          const effectBox = boundsRelativeTo(last.getChildByName('RunRelicEffect'), scroll.content);
          assert.ok(effectBox.bottom >= -contentHeight / 2, 'last description ends inside reachable content');
        }
        view.local.get('MobileSheetTab:bag')();
        assert.deepEqual(view.nextState(), { kind: 'inventory', page: 0, tab: 'bag' }, 'supply tab returns locally');
        const returned = render(model, view.nextState());
        assert.equal(nodesIn(returned.rootNode).filter(node => node.name.startsWith('MobileSheetItem:')).length, 3, 'returning restores the three supply cells');
        assert.equal(returned.actions.size, 0, 'returning to supplies dispatches no command');
        assert.equal(JSON.stringify(model), original, 'browsing and scrolling preserve run and model state');
        checkedRunRelicLists += 1;
      }
    }
  } finally {
    api.view.frameSize = previousFrame;
  }
}

// Carry cards execute the real configure command directly; the same card
// removes its item after the host rebuilds the view model from committed state.
const tacticalIds = ['thunder_talisman', 'dispel_talisman', 'gate_sigil', 'echo_coin', 'capture_net', 'spirit_bait'];
function renderCarry(state, sheetState = { kind: 'character', page: 0, tab: 'carry' }, extras = {}) {
  const model = add(state, { hubPanel: 'entry' });
  const byItem = new Map(tacticalIds.map(itemId => [itemId, api.buildGameViewModel(state, {
    hubPanel: 'supplies', hubSelections: { supplies: itemId },
  }).sections[2].actions]));
  return render(model, sheetState, safeInsets, {
    supplyActions: itemId => byItem.get(itemId),
    actionPool: [...byItem.values()].flat(),
    ...extras,
  });
}
{
  const view = renderCarry(rich);
  assertDarkSheet(view, 'character', safeInsets);
  const cards = nodesIn(view.rootNode).filter(node => node.name.startsWith('MobileSheetCarryItem:'));
  assert.equal(cards.length, 6, 'carry shows the complete six-item tactical catalog');
  assert.equal(new Set(cards.map(node => node.position.x)).size, 1, 'carry descriptions share a full-width reading column');
  for (let index = 1; index < cards.length; index += 1) {
    assert.ok(boundsRelativeTo(cards[index - 1], cards[index].parent).bottom >= boundsRelativeTo(cards[index], cards[index].parent).top,
      'complete carry descriptions do not overlap their neighbors');
  }
  const toggle = view.actions.get('MobileSheetCarryItem:gate_sigil');
  assert.ok(toggle?.enabled, 'owned gate sigil is directly executable from the entry panel');
  const equipped = commit(rich, toggle.event.command);
  assert.ok(equipped.preparedItemIds.includes('gate_sigil'), 'first card press equips');
  assert.deepEqual(equipped.inventory, rich.inventory, 'equipping does not consume any inventory');
  const equippedView = renderCarry(equipped);
  const slotActions = [...equippedView.actions].filter(([name]) => name.startsWith('MobileSheetCarrySlot:'));
  assert.equal(slotActions.length, 1, 'only the occupied slot binds removal');
  const remove = equippedView.actions.get('MobileSheetCarryItem:gate_sigil');
  assert.ok(remove?.enabled, 'equipped card stays executable for the second press');
  assert.equal(slotActions[0][1], remove, 'slot and item card share the same original removal command');
  const removed = commit(equipped, remove.event.command);
  assert.ok(!removed.preparedItemIds.includes('gate_sigil'), 'second card press removes');
  assert.deepEqual(removed.inventory, rich.inventory, 'removal does not consume any inventory');
  assert.ok(!view.labels.some(({ text }) => /库存不变|不消耗库存/.test(text)), 'carry omits the removed inventory hint');
}
{
  const fakeImages = { get: () => ({ frame: {}, width: 160, height: 200 }) };
  const empty = renderCarry(initial, undefined, { images: fakeImages });
  assert.equal(empty.actions.size, 0, 'unowned items have no equip action even if domain preconfiguration is valid');
  for (const card of nodesIn(empty.rootNode).filter(node => node.name.startsWith('MobileSheetCarryItem:'))) {
    const sprites = nodesIn(card).map(node => node.getComponent(api.Sprite)).filter(Boolean);
    assert.ok(sprites.length > 0 && sprites.every(sprite => sprite.grayscale), 'unowned item artwork is gray');
  }
  const stale = commit(initial, { type: 'hub/configure-tactical-loadout', itemIds: ['gate_sigil'] });
  const staleView = renderCarry(stale);
  const remove = staleView.actions.get('MobileSheetCarryItem:gate_sigil');
  assert.ok(remove?.enabled, 'already equipped stock-zero item can still be removed');
  assert.deepEqual(commit(stale, remove.event.command).preparedItemIds, [], 'legacy zero-stock configuration is removable');
}
{
  const full = renderCarry(carriedThree);
  assert.ok(full.labels.some(({ name, text }) => name === 'MobileSheetCarryCount' && text === '3 / 3'), 'filled general slots report real usage');
  for (const id of tacticalIds) {
    assert.equal(full.actions.has(`MobileSheetCarryItem:${id}`), carriedThree.preparedItemIds.includes(id),
      `${id}: full slots allow removal while disallowing another item`);
  }
  const rigState = commit({ ...rich, equipped: { ...rich.equipped, waist: 'rift_belt' } }, {
    type: 'hub/configure-tactical-loadout', itemIds: ['thunder_talisman', 'dispel_talisman', 'capture_net'],
  });
  const rigView = renderCarry(rigState);
  assert.equal(nodesIn(rigView.rootNode).filter(node => node.name.startsWith('MobileSheetCarrySlot:')).length, 4, 'equipment contributes its real extra slot');
  const fourth = rigView.actions.get('MobileSheetCarryItem:gate_sigil');
  assert.ok(fourth?.enabled, 'compatible equipment slot accepts a fourth item after three general slots fill');
  const configured = commit(rigState, fourth.event.command);
  const refreshed = renderCarry(configured);
  assert.ok(refreshed.labels.some(({ name, text }) => name === 'MobileSheetCarryCount' && text === '4 / 4'), 'equipped slot appears in the capacity count');
  assert.ok(refreshed.actions.has('MobileSheetCarrySlot:rift_belt_portal_rig'), 'equipment slot receives the gate sigil removal command');
}
{
  const run = enter(carriedThree);
  const view = renderCarry(run);
  assert.equal(nodesIn(view.rootNode).filter(node => node.name.startsWith('MobileSheetCarryItem:')).length, 6, 'run carry remains inspectable');
  assert.equal(nodesIn(view.rootNode).filter(node => node.name.startsWith('MobileSheetCarrySlot:')).length, 3, 'run retains carried slots');
  assert.equal(view.actions.size, 0, 'outside the hub no card or slot can configure carry');
  for (const runtime of [{ ...chrome, busyActionId: 'pending-action' }, { ...chrome, modeKind: 'blocked', blockingMessage: 'storage unavailable' }]) {
    const locked = renderCarry(carriedThree, undefined, { chrome: runtime });
    assert.equal(locked.actions.size, 0, 'pending or blocked runtime cannot equip or remove a carried item');
  }
}
{
  const state = { kind: 'character', page: 0, tab: 'carry' };
  const view = renderCarry(rich, state);
  const nodes = nodesIn(view.rootNode);
  const list = nodes.find(node => node.name === 'MobileSheetCarryList');
  const scroll = list.getComponent(api.ScrollView);
  assert.ok(scroll?.vertical && !scroll.horizontal, 'carry overview scrolls vertically');
  const slots = nodes.filter(node => node.name.startsWith('MobileSheetCarrySlot:'));
  assert.ok(slots.every(slot => nodesIn(scroll.content).includes(slot)), 'slots and complete descriptions share one compact scroll surface');
  assert.equal(new Set(slots.map(slot => slot.position.y)).size, 1, 'the three general slots fit one row');
  const firstItem = nodes.find(node => node.name.startsWith('MobileSheetCarryItem:'));
  assert.ok(slots.every(slot => boundsRelativeTo(slot, scroll.content).bottom >= boundsRelativeTo(firstItem, scroll.content).top),
    'carry slots remain above the item descriptions');
  scroll.scrollToOffset(new api.Vec2(0, 80));
  const captured = api.captureInfiniteFlowInfoSheetState(view.rootNode, state);
  assert.equal(captured.carryScrollOffset, 80, 'host refresh captures the carry list position');
  const refreshed = renderCarry(rich, captured);
  const restored = nodesIn(refreshed.rootNode).find(node => node.name === 'MobileSheetCarryList').getComponent(api.ScrollView);
  assert.equal(restored.getScrollOffset().y, 80, 'action and asset rerenders preserve carry list position');
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
    const view = render(current, { kind: 'inventory', page: 0, tip: { kind: 'item', id: 'gate_sigil' } }, safeInsets, {
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

// --- Combat medicine is reachable through its persistent picker and inventory tip ---
{
  const injured = { ...trainedCombat, player: { ...trainedCombat.player, hp: trainedCombat.player.maxHp - 10 } };
  const combatModel = add(injured);
  const medicine = api.getInfiniteFlowCombatChoiceActions(combatModel, 'medicines')[0];
  assert.ok(medicine.enabled, 'injured fixture has an available healing action');
  const tipState = { kind: 'inventory', page: 0, tip: { kind: 'item', id: 'healing_pill' } };
  const view = render(combatModel, tipState);
  assert.ok(nodesIn(view.rootNode).some((node) => node.name === 'MobileSheetTip'), 'combat tip: card mounted');
  assert.equal(view.actions.get('MobileSheetTipUse:healing_pill'), medicine, 'combat tip binds the exact healing action');
  assert.ok(!view.actions.has('MobileSheetTipCarry:healing_pill'), 'combat tip never configures carry');
  view.local.get('MobileSheetTipClose')();
  assert.equal(view.nextState().tip, undefined, 'medicine tooltip closes locally');

  for (const [reason, state] of [
    ['no stock', { ...injured, inventory: { ...injured.inventory, healing_pill: 0 } }],
    ['full HP', { ...trainedCombat, player: { ...trainedCombat.player, hp: trainedCombat.player.maxHp } }],
  ]) {
    const unavailableModel = add(state);
    const unavailable = api.getInfiniteFlowCombatChoiceActions(unavailableModel, 'medicines')[0];
    assert.equal(unavailable.enabled, false, `${reason}: healing stays disabled`);
    assert.ok(unavailable.disabledReason, `${reason}: explains why healing is unavailable`);
    const tip = render(unavailableModel, tipState);
    assert.ok(nodesIn(tip.rootNode).some(node => node.name === 'MobileSheetTipUse:healing_pill'), `${reason}: retains the disabled medicine button`);
    assert.ok(!tip.actions.has('MobileSheetTipUse:healing_pill'), `${reason}: tooltip cannot consume medicine`);
    const picker = render(unavailableModel, { kind: 'menu', tab: 'medicines', page: 0 });
    assertCompactCombatPicker(picker, unavailableModel, 'medicines');
  }
  for (const runtime of [{ ...chrome, busyActionId: medicine.actionId }, { ...chrome, modeKind: 'blocked', blockingMessage: 'storage unavailable' }]) {
    const tip = render(combatModel, tipState, safeInsets, { chrome: runtime });
    assert.ok(!tip.actions.has('MobileSheetTipUse:healing_pill'), 'busy/blocked tooltip cannot use medicine');
    const hud = renderCombatHud(combatModel, 0, runtime);
    for (const group of ['spells', 'medicines']) {
      assert.ok(!hud.local.has(`WalkCombatChoice:${group}`), 'busy/blocked HUD cannot open a combat picker');
      const action = api.getInfiniteFlowCombatChoiceActions(combatModel, group).find(choice => choice.enabled);
      assert.ok(action, `${group}: fixture covers a normally enabled action`);
      const picker = render(combatModel, { kind: 'menu', tab: group, page: 0 }, safeInsets, { chrome: runtime });
      assert.equal(picker.actions.size, 0, 'busy/blocked picker cannot execute any direct choice');
      assert.ok(nodesIn(picker.rootNode).some(node => node.name === `MobileSheetAction:${action.actionId}`), 'runtime locking retains the available choice readout');
    }
  }
  for (const id of ['armor_patch', 'focus_incense']) {
    const tip = render(combatModel, { ...tipState, tip: { kind: 'item', id } });
    assert.ok(!nodesIn(tip.rootNode).some(node => node.name.startsWith('MobileSheetTipUse:')), `${id}: automatic supplies are not manual medicine`);
  }
  const consumed = commit(injured, medicine.event.command);
  assert.equal(consumed.inventory.healing_pill, injured.inventory.healing_pill - 1, 'real medicine action consumes one dose');
  assert.equal(consumed.combat.turn, injured.combat.turn + 1, 'real medicine action consumes one combat turn');
}

// --- Two taps open a compact picker and dispatch the chosen original command ---
{
  const learned = commit(trained, { type: 'hub/learn-method', methodId: 'iron_body' });
  const run = enter(learned);
  const battle = commit(run, { type: 'run/select-node', nodeId: run.run.currentNodeId });
  const state = { ...battle, player: { ...battle.player, hp: battle.player.maxHp - 10 } };
  const model = add(state);
  const methods = api.getInfiniteFlowCombatChoiceActions(model, 'spells').filter(action => action.actionId.startsWith('combat.method:'));
  assert.deepEqual(methods.map(action => action.actionId).sort(), ['combat.method:iron_body', 'combat.method:mist_breathing'], 'both learned techniques appear in the default projection');
  for (const group of ['spells', 'medicines']) {
    const hud = renderCombatHud(model);
    assert.ok(hud.local.has(`WalkCombatChoice:${group}`), `${group}: persistent HUD entry exists`);
    assert.equal(hud.choiceGroup(), undefined, 'rendering the HUD does not open a picker');
    const before = JSON.stringify(state);
    hud.local.get(`WalkCombatChoice:${group}`)();
    assert.equal(hud.choiceGroup(), group, `${group}: HUD entry opens the requested local group`);
    const listState = { kind: 'menu', tab: group, page: 0 };
    const list = render(model, listState);
    assertCompactCombatPicker(list, model, group);
    assert.ok(list.labels.some(label => label.name === 'MobileSheetTitle' && label.text === (group === 'spells' ? '选择法术' : '战斗药品')),
      `${group}: picker title identifies its purpose`);
    list.local.get('MobileSheetClose')();
    assert.equal(list.closes(), 1, `${group}: cancellation returns to combat locally`);
    const outside = render(model, listState);
    outside.local.get('MobileSheetBackdrop')();
    assert.equal(outside.closes(), 1, `${group}: outside tap cancels without choosing an action`);
    assert.equal(list.nextState(), undefined, `${group}: opening and cancellation do not select a secondary detail screen`);
    assert.equal(JSON.stringify(state), before, `${group}: opening, browsing and cancelling leave combat state unchanged`);
    assertCompactCombatPicker(render(model, listState, { top: 160, right: 28, bottom: 110, left: 18 }),
      model, group, { top: 160, right: 28, bottom: 110, left: 18 });
  }
  for (const method of methods) {
    assert.equal(method.event.command.type, 'combat/use-method-technique');
    const methodId = method.actionId.slice('combat.method:'.length);
    assert.equal(method.event.command.methodId, methodId, 'each technique retains its own method command');
    const used = commit(state, method.event.command);
    const nextMethods = api.getInfiniteFlowCombatChoiceActions(add(used), 'spells');
    assert.equal(nextMethods.find(action => action.actionId === method.actionId).enabled, false, 'the selected technique is spent');
    assert.equal(nextMethods.find(action => action.actionId === methods.find(other => other !== method).actionId).enabled, true, 'the other technique remains independently available');
  }

  const soulState = { ...state, run: { ...state.run,
    soulSkillState: { rulesVersion: 1, frozenSkillIds: ['spirit_grounding'], readySkillIds: ['spirit_grounding'], chargesRemaining: 1, usedRechargeIds: [] } },
    combat: { ...state.combat, effects: { rustPoisonStacks: 1 } } };
  const soulModel = add(soulState);
  const spells = api.getInfiniteFlowCombatChoiceActions(soulModel, 'spells');
  for (const id of ['combat.companion-assist', 'combat.bloodline-surge', 'soul-skill:spirit_grounding:use']) {
    assert.ok(spells.some(action => action.actionId === id), `${id}: configured support appears in the spell picker`);
  }
  assert.ok(!spells.some(action => action.actionId.startsWith('soul-skill:gauntlet_breakbeat')), 'unconfigured soul ability is not shown');
  const soulAction = spells.find(action => action.actionId === 'soul-skill:spirit_grounding:use');
  const soulPicker = render(soulModel, { kind: 'menu', tab: 'spells', page: 0 });
  assertCompactCombatPicker(soulPicker, soulModel, 'spells');
  const consumedSoul = commit(soulState, soulPicker.actions.get(`MobileSheetAction:${soulAction.actionId}`).event.command);
  const consumedModel = add(consumedSoul);
  assert.ok(api.getInfiniteFlowCombatChoiceActions(consumedModel, 'spells').some(action => action.actionId === 'soul-skill:spirit_grounding' && !action.enabled),
    'spent configured soul ability remains greyed out in the picker');
  assertCompactCombatPicker(render(consumedModel, { kind: 'menu', tab: 'spells', page: 0 }), consumedModel, 'spells');

  const menu = render(model, { kind: 'menu', page: 0 });
  assert.ok(menu.local.has('MobileSheetShortcut:retreat'), 'combat menu always offers run retreat');
  menu.local.get('MobileSheetShortcut:retreat')();
  const retreat = model.sections[2].actions.find(action => action.actionId === 'combat.retreat-run');
  const confirmation = render(model, menu.nextState());
  assert.equal(confirmation.actions.get('MobileSheetExecute:combat.retreat-run'), retreat, 'retreat remains an explicit confirmed original command');
  // The starter blade has no signature skill; it must still release the generic charged strike.
  for (const [weapon, focus] of [['armor_piercing_sword', 0], ['armor_piercing_sword', 3], ['training_blade', 3]]) {
    const focusModel = add({ ...state, ownedEquipment: [...new Set([...state.ownedEquipment, weapon])],
      equipped: { ...state.equipped, weapon }, combat: { ...state.combat, weaponFocus: focus } });
    const hud = renderCombatHud(focusModel);
    const actionId = `combat.action:${focus === 3 ? 'weapon_skill' : 'attack'}`;
    const action = focusModel.sections[2].actions.find(candidate => candidate.actionId === actionId);
    assert.ok(action.enabled, `${weapon} ${actionId}: fixture reaches its usable core state`);
    assert.equal(hud.actions.get(`WalkCombatAction:${actionId}`), action, 'unified button switches between actual basic and weapon commands');
    const nodes = nodesIn(hud.rootNode);
    assert.equal(nodes.find(node => node.name === `WalkCombatAction:${actionId}Label`).getComponent(api.Label).string,
      focus === 3 ? '战技' : '攻击', 'the large attack button names the action that will be released');
    assert.equal(nodes.find(node => node.name === 'WalkCombatAttackMode').getComponent(api.Label).string,
      focus === 3 ? '战意已满' : '普攻', 'attack mode explains why the weapon skill is ready');
    assert.equal(nodes.find(node => node.name === 'WalkCombatFocus').getComponent(api.Label).string.replace(/\s/gu, ''),
      `战意${focus}/${focusModel.sections[1].detail.focus.required}`, 'HUD focus readout uses the projected core threshold');
  }
}

// --- Real View + native effects keep command dispatch and screen replacement in sync ---
let lifecycleTouches = 0;
function touch(node) {
  assert.ok(node, 'touch target exists');
  const event = { getID: () => ++lifecycleTouches, propagationStopped: false };
  const id = event.getID();
  event.getID = () => id;
  node.emit(api.Node.EventType.TOUCH_START, event);
  node.emit(api.Node.EventType.TOUCH_END, event);
  node.emit(api.Node.EventType.TOUCH_END, event);
}
{
  // Route prototype: stepping through a door opens the room's own sheet; only the sheet's buttons submit commands.
  const canvas = new api.Node('RouteArrivalCanvas');
  canvas.addComponent(api.UITransform).setContentSize({ width: 750, height: 1334 });
  const dispatched = [];
  const controller = new api.InfiniteFlowView(canvas, { activate(_physicalId, actionId) { dispatched.push(actionId); } });
  const named = name => nodesIn(canvas).find(node => node.name === name);
  const show = state => {
    const model = api.buildGameViewModel(state, {});
    supplySceneVisualFixtures(controller, model);
    controller.render(model, chrome, safeInsets);
  };
  // A replay of the opening chapter: its first clear carries no lamp, and these rooms read the lamp.
  const entered = api.reduceGameCommand({ ...api.createInitialState(), completedDungeonIds: ['demon_tower_1'] }, {
    type: 'run/enter', dungeonId: 'demon_tower_1', protocolId: 'standard', seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_abcd },
  }).state;
  const doorway = (from, cleared) => ({ ...entered, run: { ...entered.run, currentNodeId: from, clearedNodeIds: [from, ...cleared] } });
  const arrive = (from, cleared, nodeId) => {
    show(doorway(from, cleared));
    controller.mobileSheet = undefined;
    controller.roomEventOpen = false;
    const moved = api.reduceGameCommand(doorway(from, cleared), { type: 'run/move', nodeId });
    assert.equal(moved.status, 'committed', `${nodeId}: fixture move commits`);
    show(moved.state);
    return moved.state;
  };
  show(doorway('mist_herb_cache', []));
  assert.ok(controller.mobileSheet === undefined && !controller.roomEventOpen, 'the first room render opens nothing by itself');
  const monsterRoom = arrive('mist_herb_cache', [], 'fog_patrol_pair');
  assert.ok(controller.roomEventOpen && controller.mobileSheet === undefined, 'stepping into a monster room opens its prototype sheet');
  assert.ok(named('WalkRoomEventButton:node.select:fog_patrol_pair'), 'the sheet offers the room\'s own fight');
  assert.equal(named('WalkRoomEventRowLabel:outcome')?.getComponent(api.Label).string, '结果', 'the sheet shows the predicted outcome');
  assert.equal(named('WalkJoystick')?.active, false, 'the open sheet suspends the joystick');
  touch(named('WalkRoomEventButton:close'));
  assert.ok(!controller.roomEventOpen && !named('WalkRoomEventSheet'), '收起 closes the sheet');
  show(monsterRoom);
  assert.equal(controller.roomEventOpen, false, 'a closed sheet stays closed while the player remains in the room');
  assert.equal(dispatched.length, 0, 'opening and closing the sheet submit nothing');
  controller.roomEventOpen = true;
  show(monsterRoom);
  touch(named('WalkRoomEventButton:node.select:fog_patrol_pair'));
  assert.deepEqual(dispatched, ['node.select:fog_patrol_pair'], 'one tap on 战斗 submits the existing encounter action once');
  dispatched.length = 0;
  arrive('fog_patrol_pair', [], 'cracked_portal');
  assert.ok(controller.mobileSheet === undefined && !controller.roomEventOpen, 'portal rooms stay passages');
  arrive('fog_patrol_pair', ['mist_herb_cache'], 'mist_herb_cache');
  assert.ok(controller.mobileSheet === undefined && !controller.roomEventOpen, 'cleared rooms stay quiet');
  arrive('fog_patrol_pair', [], 'mist_herb_cache');
  assert.ok(controller.mobileSheet?.kind === 'interaction' && !controller.roomEventOpen, 'an unclaimed reward room opens its chest claim sheet');
  assert.equal(named('MobileSheetKicker')?.getComponent(api.Label).string, '宝箱', 'the chest claim names its room');
  assert.ok(named('MobileSheetRoomArt') && !named('MobileSheetTitleBand'), 'the chest claim docks as the room bottom sheet');
  arrive('mist_herb_cache', [], 'north_supply_niche');
  assert.equal(named('MobileSheetKicker')?.getComponent(api.Label).string, '补给', 'a lamp supply room reads as 补给');
  assert.equal(named('MobileSheetRewardItem:lantern-oil')?.getChildByName('RewardItemValue')?.getComponent(api.Label).string, '+4',
    'the supply sheet shows the oil its claim really adds');
  arrive('cracked_portal', [], 'blood_rune_trap');
  assert.ok(controller.mobileSheet?.kind === 'interaction' && !controller.roomEventOpen, 'pending choices open the room bottom sheet');
  assert.ok(named('MobileSheetRoomArt') && !named('MobileSheetTab:overview'), 'pending choices list straight under the room story');
  assert.equal(dispatched.length, 0, 'arrival never submits a command');

  // Entering from the hub counts as stepping into the dungeon's first room.
  const initial = api.createInitialState();
  const unlocked = { ...initial, rewardPoints: 50000, lingyun: 500, completedDungeonIds: [...api.DUNGEON_ORDER] };
  for (const [dungeonId, roomEvent] of [['demon_tower_1', true], ['metro_abyss', false]]) {
    controller.mobileSheet = undefined;
    controller.roomEventOpen = false;
    show(unlocked);
    // Every chapter is cleared here, so the hub may offer its claim sheet, but never a room sheet.
    assert.ok(controller.mobileSheet?.kind !== 'interaction' && !controller.roomEventOpen, `${dungeonId}: the hub opens no room sheet`);
    const run = api.reduceGameCommand(unlocked, { type: 'run/enter', dungeonId, protocolId: 'standard', seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_abcd } });
    assert.equal(run.status, 'committed', `${dungeonId}: fixture entry commits`);
    show(run.state);
    assert.ok(roomEvent ? controller.roomEventOpen && controller.mobileSheet === undefined
      : controller.mobileSheet?.kind === 'interaction' && !controller.roomEventOpen, `${dungeonId}: entering opens the first room's own sheet`);
  }
  assert.equal(dispatched.length, 0, 'entering opens sheets without submitting anything');

  // Tapping an open door walks there quickly and goes through; a shut door stays put and says why.
  const cleared = doorway('fog_patrol_pair', []);
  show(cleared);
  controller.mobileSheet = undefined;
  controller.roomEventOpen = false;
  show(cleared);
  const openDoor = api.buildWalkWorld(api.buildGameViewModel(cleared, {})).targets
    .find(target => target.id.startsWith('door:') && target.action !== undefined);
  assert.ok(openDoor, 'a cleared room has an open door');
  touch(named(`WalkTarget:${openDoor.id}`)?.getChildByName('WalkTargetTouch'));
  let frames = 0;
  while (dispatched.length === 0 && frames < 120) { controller.tick(1 / 60); frames += 1; }
  assert.deepEqual(dispatched, [openDoor.action.actionId], 'arriving at a tapped door submits its own move once');
  assert.ok(frames <= 90, `a tapped door is reached within 1.5 seconds (${frames} frames)`);
  dispatched.length = 0;
  show(entered);
  controller.roomEventOpen = false;
  show(entered);
  const shutDoor = api.buildWalkWorld(api.buildGameViewModel(entered, {})).targets
    .find(target => target.id.startsWith('door:') && target.disabledReason !== undefined);
  assert.ok(shutDoor, 'an uncleared fight shuts the room doors');
  const before = controller.walkScene.getPosition();
  touch(named(`WalkTarget:${shutDoor.id}`)?.getChildByName('WalkTargetTouch'));
  for (let frame = 0; frame < 30; frame += 1) controller.tick(1 / 60);
  assert.deepEqual(controller.walkScene.getPosition(), before, 'a shut door does not walk the hero');
  assert.equal(named('WalkRouteNotice')?.getComponent(api.Label).string, shutDoor.disabledReason, 'a shut door shows its own reason');
  assert.equal(dispatched.length, 0, 'a shut door submits nothing');

  // A first lamp run has a dormant pursuer: the pressure panel counts down, and the wake gets a one-time banner.
  const beforeWake = { ...entered, run: { ...entered.run, currentNodeId: 'broken_sigil_reward',
    clearedNodeIds: ['fog_lesser_demon', 'blood_rune_trap'], pressureState: { rulesVersion: 1, clearedNodeCount: 2 } } };
  show(beforeWake);
  controller.mobileSheet = undefined;
  controller.roomEventOpen = false;
  show(beforeWake);
  assert.ok(named('WalkPressureFoot')?.getComponent(api.Label).string.includes('再清 1 间血阶监猎者苏醒'),
    'the pressure panel counts down to the pursuer waking');
  const woke = api.reduceGameCommand(beforeWake, { type: 'node/collect-reward' });
  assert.equal(woke.status, 'committed', 'the third clear commits');
  assert.equal(woke.state.run.pursuitState.status, 'stalking', 'the third clear wakes the pursuer');
  show(woke.state);
  assert.equal(named('WalkAlarmBannerTitle')?.getComponent(api.Label).string, '血阶监猎者醒了', 'the wake gets its own banner');
  assert.ok(named('WalkAlarmBannerLine')?.getComponent(api.Label).string.includes('雾后暗格'), 'the banner names where to seal it');
  assert.equal(named('WalkAlarmBanner')?.getComponent(api.BlockInputEvents) ?? null, null, 'the banner never takes input');
  controller.mobileSheet = undefined;
  show(woke.state);
  assert.equal(named('WalkAlarmBannerTitle')?.getComponent(api.Label).string, '血阶监猎者醒了', 'an immediate re-render keeps the banner');
  controller.tick(5);
  show(woke.state);
  assert.equal(named('WalkAlarmBannerTitle')?.getComponent(api.Label).color.a, 255, 'one stalled frame (an art load) does not use up the banner');
  for (let frame = 0; frame < 30; frame += 1) controller.tick(0.1);
  show(woke.state);
  assert.equal(named('WalkAlarmBanner'), undefined, 'the banner is gone once its time has run out');

  // Walking into the pursuer starts a fight with it at once; the catch gets its own banner and the card names it.
  const besideHunter = { ...woke.state, run: { ...woke.state.run, currentNodeId: 'fog_lesser_demon',
    pursuitState: { ...woke.state.run.pursuitState, nodeId: 'blood_rune_trap', graceMoves: 0 } } };
  show(besideHunter);
  const caughtRun = api.reduceGameCommand(besideHunter, { type: 'run/move', nodeId: 'blood_rune_trap' });
  assert.equal(caughtRun.status, 'committed', 'the step into the pursuer commits');
  assert.ok(caughtRun.state.phase === 'combat' && caughtRun.state.combat.pursuer, 'being caught starts the pursuer fight');
  show(caughtRun.state);
  assert.equal(named('WalkAlarmBannerTitle')?.getComponent(api.Label).string, '血阶监猎者追上了你', 'the catch gets its own banner');
  assert.equal(named('WalkEnemyName')?.getComponent(api.Label).string, '追兵 · 血阶监猎者', 'the enemy card names the pursuer');
  for (let frame = 0; frame < 30; frame += 1) controller.tick(0.1);
  show(caughtRun.state);
  assert.equal(named('WalkAlarmBanner'), undefined, 'the catch banner leaves after its time');
  controller.destroy();
}
{
  // Task presence: the run's tracker and its notices, then the hub's claim sheet and turn-in mark.
  const canvas = new api.Node('TaskPresenceCanvas');
  canvas.addComponent(api.UITransform).setContentSize({ width: 750, height: 1334 });
  const dispatched = [];
  const controller = new api.InfiniteFlowView(canvas, { activate(_physicalId, actionId, event) { dispatched.push({ actionId, event }); } });
  const named = name => nodesIn(canvas).find(node => node.name === name);
  const trackerText = id => named(`WalkTaskLine:${id}`)?.getChildByName('WalkTaskText')?.getComponent(api.Label).string;
  const show = state => {
    const model = api.buildGameViewModel(state, {});
    supplySceneVisualFixtures(controller, model);
    controller.render(model, chrome, safeInsets);
  };
  const entered = api.reduceGameCommand(api.createInitialState(), {
    type: 'run/enter', dungeonId: 'demon_tower_1', protocolId: 'standard', seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_abcd },
  }).state;
  const exploring = (patch = {}, state = {}) => ({ ...entered, ...state, run: { ...entered.run, currentNodeId: 'fog_lesser_demon', clearedNodeIds: ['fog_lesser_demon'], ...patch } });
  show(exploring());
  controller.mobileSheet = undefined;
  controller.roomEventOpen = false;
  show(exploring());
  assert.equal(trackerText('mainline'), '通关妖塔一层', 'the tracker names the chapter\'s mainline');
  assert.equal(trackerText('directive'), '捕获雾爪幼兽 0/1 +2', 'the tracker leads with the directive step a player can forget');
  assert.equal(trackerText('claims'), '1 项 · 回主神空间领取', 'the tracker counts what waits in the hub');
  const tracker = named('WalkTaskTracker');
  const pressure = named('WalkPressurePanel');
  assert.ok(tracker && pressure && tracker.position.y < pressure.position.y, 'the tracker sits under the pressure panel');
  const trackerSize = tracker.getComponent(api.UITransform).contentSize;
  assert.ok(trackerSize.width >= 104 && trackerSize.height >= 104, 'the tracker keeps a full touch target');
  touch(tracker);
  assert.equal(controller.mobileSheet?.kind, 'objectives', 'tapping the tracker opens the full objectives');
  controller.mobileSheet = undefined;
  show(exploring({}, { ownedPets: ['mist_kitten'] }));
  assert.equal(named('WalkFeedback')?.getComponent(api.Label).string, '指令达成 · 捕获雾爪幼兽', 'meeting a directive condition is announced');
  show(exploring({ damageTaken: 25 }, { ownedPets: ['mist_kitten'] }));
  assert.equal(named('WalkFeedback')?.getComponent(api.Label).string, '指令失败 · 承伤不超过 20', 'breaking a directive limit is announced');
  assert.equal(trackerText('directive'), '承伤不超过 20 已失败', 'the tracker keeps the failure in view');
  const replay = { ...entered, completedDungeonIds: ['demon_tower_1'], claimedDirectiveIds: ['directive_demon_tower_1'],
    claimedTaskIds: ['mainline_clear_demon_tower_1', 'side_enter_demon_tower_1', 'side_directive_demon_tower_1'] };
  show(replay);
  assert.equal(named('WalkTaskTracker'), undefined, 'a run with nothing left to do shows no tracker');

  // Arriving in the hub with finished tasks opens the claim sheet; the envoy wears a gold question mark.
  const hub = { ...api.createInitialState(), completedDungeonIds: ['demon_tower_1'], enteredDungeonIds: ['demon_tower_1'] };
  show(exploring());
  show(hub);
  assert.equal(controller.mobileSheet?.kind, 'claims', 'arriving with finished tasks opens the claim sheet');
  assert.equal(named('MobileSheetTitle')?.getComponent(api.Label).string, '2 项任务可领取', 'the sheet counts the finished tasks');
  assert.ok(named('MobileSheetClaimTask:mainline_clear_demon_tower_1') && named('MobileSheetClaimTask:side_enter_demon_tower_1'), 'each finished task has a row');
  assert.equal(named('MobileSheetClaimTask:mainline_clear_demon_tower_1').getChildByName('ClaimTaskReward').getComponent(api.Label).string,
    '奖励 80 奖励点', 'each row shows its reward');
  const envoy = named('WalkTarget:npc:tasks');
  assert.ok(envoy?.getChildByName('WalkTargetReady'), 'the task envoy wears the turn-in mark');
  assert.equal(envoy.getChildByName('WalkTargetPurpose').getComponent(api.Label).string, '2 项已完成', 'the envoy says how many tasks are done');
  touch(named('MobileSheetClose'));
  show(hub);
  assert.equal(controller.mobileSheet, undefined, 'closing the sheet keeps it closed while staying in the hub');
  show(exploring());
  show(hub);
  const before = dispatched.length;
  touch(named('MobileSheetClaimAll'));
  assert.equal(dispatched.length, before + 1, 'claim all submits one command');
  assert.equal(dispatched.at(-1).event.command.type, 'hub/claim-all-tasks', 'claim all submits the claim-all command');
  const claimed = api.reduceGameCommand(hub, dispatched.at(-1).event.command);
  assert.equal(claimed.status, 'committed', 'the claim-all command commits');
  show(claimed.state);
  assert.equal(controller.mobileSheet, undefined, 'the sheet steps aside once everything is claimed');
  assert.equal(named('WalkFeedback')?.getComponent(api.Label).string, '已领取 2 项任务奖励', 'the claim is confirmed');
  assert.equal(named('WalkTarget:npc:tasks')?.getChildByName('WalkTargetReady'), null, 'the turn-in mark clears');

  // A burnt-out lamp refilled at a supply room lifts the forced breach; the pressure foot stops saying the lamp is out.
  // The opening chapter's first clear carries no lamp, so this runs on a replay.
  const lampRun = api.reduceGameCommand({ ...api.createInitialState(), completedDungeonIds: ['demon_tower_1'] }, {
    type: 'run/enter', dungeonId: 'demon_tower_1', protocolId: 'standard', seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_abcd },
  }).state;
  const dark = { ...lampRun, run: { ...lampRun.run, currentNodeId: 'north_supply_niche', clearedNodeIds: ['fog_lesser_demon', 'blood_rune_trap'],
    lanternState: { ...lampRun.run.lanternState, oil: 0 }, pressureState: { rulesVersion: 1, clearedNodeCount: 2, breachForced: true },
    // The dark already woke the pursuer.
    pursuitState: { ...lampRun.run.pursuitState, status: 'stalking', nodeId: 'tower_butcher_patrol' } } };
  show(dark);
  controller.mobileSheet = undefined;
  show(dark);
  assert.ok(named('WalkPressureFoot')?.getComponent(api.Label).string.startsWith('灯油耗尽'), 'an empty lamp says so');
  const refilled = api.reduceGameCommand(dark, { type: 'node/collect-reward' });
  assert.equal(refilled.status, 'committed', 'the supply claim commits');
  show(refilled.state);
  assert.ok(!named('WalkPressureFoot')?.getComponent(api.Label).string.includes('灯油耗尽'), 'a relit lamp no longer reports the lamp out');
  assert.equal(named('WalkFeedback')?.getComponent(api.Label).string, '重新点灯 · 破界解除，压力回到稳定', 'the relight is announced');
  controller.destroy();
}
function viewLifecycle(initialState, { resolve = true, reject = false } = {}) {
  const canvas = new api.Node('CombatLifecycleCanvas');
  canvas.addComponent(api.UITransform).setContentSize({ width: 750, height: 1334 });
  let state = initialState;
  let model = api.buildGameViewModel(state, {});
  let frames;
  const dispatched = [];
  const controller = new api.InfiniteFlowView(canvas, {
    activate(physicalId, actionId, event) {
      assert.equal(event.kind, 'command', 'native animation submits a domain command');
      dispatched.push({ physicalId, actionId, event });
      if (!reject) {
        const outcome = api.reduceGameCommand(state, event.command);
        assert.equal(outcome.status, 'committed', 'animated action commits in the real application reducer');
        state = outcome.state;
        model = api.buildGameViewModel(state, {});
        frames = outcome.events.find(entry => entry.type === 'combat.presentation-resolved')?.frames;
        assert.ok(frames?.length, 'committed animated action includes authoritative presentation frames');
      }
      supplySceneVisualFixtures(controller, model);
      controller.render(model, chrome, safeInsets);
      if (resolve) controller.resolveCombatPresentation(actionId, frames);
    }
  });
  supplySceneVisualFixtures(controller, model);
  controller.render(model, chrome, safeInsets);
  return {
    canvas, controller, dispatched,
    node: name => nodesIn(canvas).find(node => node.name === name),
    root: () => canvas.children[0],
    state: () => state,
    model: () => model,
    frames: () => frames,
    tick(count) { for (let step = 0; step < count; step += 1) controller.tick(0.1); }
  };
}
{
  const state = { ...trainedCombat, player: { ...trainedCombat.player, hp: trainedCombat.player.maxHp - 50 } };
  for (const [group, id, impactTicks] of [
    [undefined, 'combat.action:attack', 3],
    ['spells', 'combat.action:art', 6],
    ['spells', 'combat.method:mist_breathing', 3],
    ['medicines', 'combat.action:use_healing_pill', 5],
  ]) {
    // The basic art spends focus, so its run starts with one point banked.
    const flow = viewLifecycle(id === 'combat.action:art' ? { ...state, combat: { ...state.combat, weaponFocus: 1 } } : state);
    if (group) {
      touch(flow.node(`WalkCombatChoice:${group}`));
      assert.equal(flow.dispatched.length, 0, `${id}: opening the picker submits nothing`);
    }
    const target = flow.node(group ? `MobileSheetAction:${id}` : `WalkCombatAction:${id}`);
    touch(target);
    assert.equal(flow.dispatched.length, 0, `${id}: command waits for the animation impact`);
    assert.ok(!flow.node('MobileInfoSheet:menu'), `${id}: action closes the picker before its windup`);
    const lockedRoot = flow.root();
    const lockedControls = nodesIn(lockedRoot).filter(node => /^WalkCombat(?:Action|Choice):/.test(node.name));
    assert.ok(lockedControls.every(node => (node.events.get(api.Node.EventType.TOUCH_START) ?? []).length === 0),
      `${id}: all combat controls are unbound during playback`);
    touch(target);
    flow.tick(impactTicks);
    assert.equal(flow.dispatched.length, 1, `${id}: impact submits exactly once despite duplicate touch-end events`);
    assert.equal(flow.dispatched[0].actionId, id, `${id}: animated tap keeps its selected action`);
    assert.equal(flow.root(), lockedRoot, `${id}: committed render waits for the impact/counter timeline`);
    const impact = flow.frames().find(frame => frame.stage === 'impact');
    assert.equal(flow.node('WalkPlayerStatus').getComponent(api.Label).string, `${impact.playerHp}/${state.player.maxHp}`,
      `${id}: impact shows authoritative player HP before counterattack`);
    const resolveFrames = flow.frames();
    flow.controller.resolveCombatPresentation(id, resolveFrames);
    flow.tick(16);
    assert.equal(flow.dispatched.length, 1, `${id}: repeated resolution and later ticks cannot resubmit`);
    assert.notEqual(flow.root(), lockedRoot, `${id}: final view renders only after effects finish`);
    assert.ok(flow.node('WalkCombatChoice:spells').events.has(api.Node.EventType.TOUCH_START), `${id}: controls unlock on completion`);
    if (flow.state().phase === 'combat') {
      assert.equal(flow.node('WalkPlayerStatus').getComponent(api.Label).string, `${flow.state().player.hp}/${flow.state().player.maxHp}`,
        `${id}: final HP matches the reducer result`);
    }
    flow.controller.destroy();
    assert.equal(flow.canvas.children.length, 0, `${id}: destroy removes the rendered tree`);
  }

  const winning = { ...state, combat: { ...state.combat, monsterHp: 1 } };
  const terminal = viewLifecycle(winning, { resolve: false });
  touch(terminal.node('WalkCombatAction:combat.action:attack'));
  const battleRoot = terminal.root();
  terminal.tick(3);
  assert.equal(terminal.dispatched.length, 1, 'lethal hit dispatches exactly once');
  assert.notEqual(terminal.state().phase, 'combat', 'lethal fixture actually leaves the combat domain phase');
  assert.equal(terminal.root(), battleRoot, 'terminal screen is deferred while authoritative outcome is pending');
  terminal.tick(30);
  assert.equal(terminal.root(), battleRoot, 'waiting for an outcome does not invent a completion timer');
  terminal.controller.resolveCombatPresentation('wrong-action', terminal.frames());
  terminal.tick(10);
  assert.equal(terminal.root(), battleRoot, 'unrelated command outcomes cannot release the pending animation');
  terminal.controller.resolveCombatPresentation('combat.action:attack', terminal.frames());
  terminal.tick(3);
  assert.equal(terminal.root(), battleRoot, 'terminal view waits through the lethal impact animation');
  terminal.tick(5);
  assert.notEqual(terminal.root(), battleRoot, 'terminal view appears after the lethal animation completes');
  assert.ok(!terminal.node('WalkCombatAction:combat.action:attack'), 'finished encounter no longer exposes battle commands');
  terminal.controller.destroy();

  const cancelled = viewLifecycle(state);
  touch(cancelled.node('WalkCombatAction:combat.action:attack'));
  cancelled.tick(1);
  cancelled.controller.destroy();
  cancelled.tick(30);
  assert.equal(cancelled.dispatched.length, 0, 'destroy before impact cancels the uncommitted command');
  assert.equal(cancelled.canvas.children.length, 0, 'destroyed animation leaves no effect tree');

  const lateOutcome = viewLifecycle(winning, { resolve: false });
  touch(lateOutcome.node('WalkCombatAction:combat.action:attack'));
  lateOutcome.tick(3);
  lateOutcome.controller.destroy();
  lateOutcome.controller.resolveCombatPresentation('combat.action:attack', lateOutcome.frames());
  lateOutcome.tick(30);
  assert.equal(lateOutcome.dispatched.length, 1, 'destroy after commit never resubmits the completed command');
  assert.equal(lateOutcome.canvas.children.length, 0, 'late resolution cannot resurrect a destroyed terminal view');

  const blocked = viewLifecycle(state);
  touch(blocked.node('WalkCombatAction:combat.action:attack'));
  blocked.tick(1);
  blocked.controller.render(blocked.model(), { ...chrome, modeKind: 'blocked', blockingMessage: 'storage unavailable' }, safeInsets);
  blocked.tick(30);
  assert.equal(blocked.dispatched.length, 0, 'runtime blocking during windup cancels the uncommitted command');
  blocked.controller.destroy();

  const rejected = viewLifecycle(state, { reject: true });
  touch(rejected.node('WalkCombatAction:combat.action:attack'));
  rejected.tick(3);
  assert.equal(rejected.dispatched.length, 1, 'rejected command is not retried');
  assert.ok(rejected.node('WalkCombatChoice:spells').events.has(api.Node.EventType.TOUCH_START),
    'missing outcome frames cancel animation and restore unlocked controls');
  assert.equal(rejected.state(), state, 'rejected command leaves domain state unchanged');
  rejected.controller.destroy();
}

// --- Heavy-blow parry: the tap chooses between the two presentation events; the core decides ---
{
  const heavy = { ...trainedCombat, inventory: { ...trainedCombat.inventory, armor_patch: 0 },
    combat: { ...trainedCombat.combat, nodeId: 'butcher_turn', monsterId: 'tower_butcher', monsterHp: 1000, turn: 2, weaponFocus: 0 } };
  const heavyModel = api.buildGameViewModel(heavy, {});
  assert.equal(heavyModel.sections[1].detail.intent.parryable, true, 'fixture telegraphs a parryable heavy blow');
  const guard = heavyModel.sections[2].actions.find(action => action.actionId === 'combat.action:guard');
  assert.ok(guard?.parryEvent, 'guard carries the perfect-parry event');
  let parryCases = 0;
  // Ticks are 0.1s: two finish the shield windup, then the ring needs ~0.51-0.68s to reach its band.
  for (const [label, tapAfter, perfect] of [['on the ring', 6, true], ['too early', 2, false], ['untouched', undefined, false]]) {
    const flow = viewLifecycle(heavy);
    assert.ok(flow.node('WalkEnemyIntentChip'), `${label}: the intent callout marks the parry window`);
    assert.ok(flow.node('WalkCombatGuardChip'), `${label}: the guard control marks the parry window`);
    const shownGuard = flow.model().sections[2].actions.find(action => action.actionId === 'combat.action:guard');
    touch(flow.node('WalkCombatAction:combat.action:guard'));
    flow.tick(2);
    const catcher = flow.node('WalkCombatTimingCatcher');
    assert.equal(catcher.active, true, `${label}: the full-screen catcher opens with the ring`);
    assert.equal(flow.dispatched.length, 0, `${label}: nothing dispatches while the ring closes`);
    if (tapAfter === undefined) flow.tick(10);
    else { flow.tick(tapAfter); touch(catcher); }
    assert.equal(flow.dispatched.length, 1, `${label}: exactly one guard command`);
    assert.equal(flow.dispatched[0].event, perfect ? shownGuard.parryEvent : shownGuard.event, `${label}: the matching presentation event object is submitted`);
    const counter = flow.frames().find(frame => frame.stage === 'counter');
    assert.equal(counter?.perfectParry === true, perfect, `${label}: the core confirms the parry in its counter frame`);
    assert.equal(flow.state().combat.weaponFocus, perfect ? 3 : 2, `${label}: focus follows the authoritative result`);
    flow.tick(12);
    assert.equal(flow.controller.walkScene?.isCombatAnimating() ?? false, false, `${label}: playback completes`);
    flow.controller.destroy();
    parryCases += 1;
  }
  assert.equal(parryCases, 3);
}

// --- Character equipment tooltip stays read-only, even in hub ---
{
  const equipped = hubSuppliesModel.sections[1].loadout.equipment.find((entry) => entry.equipmentId);
  const view = render(hubSuppliesModel, { kind: 'character', page: 0, tip: { kind: 'equip', id: equipped.equipmentId } });
  const nodes = nodesIn(view.rootNode);
  assert.ok(nodes.some((node) => node.name === 'MobileSheetTip'), 'equip tip: card mounted');
  assert.ok(!nodes.some((node) => /^MobileSheetTipCarry:/.test(node.name)), 'equip tip: read-only');
  assert.ok(!nodes.some((node) => /^MobileSheetTipEquip:/.test(node.name)), 'character equipment tip cannot switch equipment');
  assert.ok(view.labels.map(({ text }) => text).some((text) => text.includes(equipped.slotLabel)), 'equip tip: slot line');
  view.local.get('MobileSheetBackdrop')();
  assert.deepEqual(view.nextState().tip, undefined, 'equip tip: backdrop closes');
}

const renderedSignatures = new Set();
let sheetLists = 0;
let checkedActionDetails = 0;
let disabledReadouts = 0;
const normalizeText = (value) => value.replace(/\s/gu, '');
let checkedEquipmentOfferChoices = 0;
let checkedRewardClaims = 0;
let checkedRelicDraftChoices = 0;
function assertSinglePageLootControls(view, claimName) {
  const nodes = nodesIn(view.rootNode);
  assert.equal(nodes.filter(node => node.name === claimName).length, 1, 'loot panel has one fixed primary claim CTA');
  for (const removed of ['MobileSheetTab:overview', 'MobileSheetTab:actions', 'MobileSheetPrevious', 'MobileSheetNext']) {
    assert.ok(!nodes.some(node => node.name === removed), `loot panel omits ${removed}`);
  }
  assert.ok(!nodes.some(node => /^MobileSheetAction:|^MobileSheetExecute:/.test(node.name)),
    'loot panel shows its real rewards or candidates without a second confirmation page');
}
function assertRewardClaimReachable(model, expected) {
  const snapshot = JSON.stringify(model);
  const preview = model.sections[1].detail.rewardPreview;
  const claim = expected.find(action => action.actionId === preview.actionId);
  assert.ok(claim?.enabled && claim.event?.command.type === 'node/collect-reward', 'reward preview identifies its original claim action');
  const view = render(model, { kind: 'interaction', page: 0 });
  assertDarkSheet(view, 'interaction', safeInsets);
  assertSinglePageLootControls(view, 'MobileSheetRewardClaim');
  assert.equal(view.actions.get('MobileSheetRewardClaim'), claim, 'the reward CTA directly binds the exact original claim');
  assert.ok(view.labels.some(({ text }) => text === '领取奖励'), 'reward CTA matches the confirmed prototype wording');
  for (const runtime of [{ ...chrome, busyActionId: claim.actionId }, { ...chrome, modeKind: 'blocked', blockingMessage: 'storage unavailable' }]) {
    const locked = render(model, { kind: 'interaction', page: 0 }, safeInsets, { chrome: runtime });
    assert.equal(locked.actions.size, 0, 'busy/blocked reward panel cannot execute a claim');
    if (runtime.busyActionId) assert.ok(locked.labels.some(({ text }) => text === '正在领取'), 'busy reward CTA explains the current claim');
  }
  const otherActions = expected.filter(action => action !== claim);
  if (otherActions.length) {
    assert.ok(view.local.has('MobileSheetRewardServices'), 'existing node services retain a separate local route');
    view.local.get('MobileSheetRewardServices')();
    assert.equal(view.nextState().tab, 'reward-services', 'other node actions open their existing action list locally');
    assertSheetReachable(model, 'interaction', otherActions, 'reward-services');
    const services = render(model, view.nextState());
    assert.ok(!nodesIn(services.rootNode).some(node => node.name === `MobileSheetAction:${claim.actionId}`),
      'secondary services do not recreate the reward claim in the old two-page flow');
    assert.ok(services.local.has('MobileSheetRewardBack'), 'secondary services retain a local route back to the reward cards');
    services.local.get('MobileSheetRewardBack')();
    assert.equal(render(model, services.nextState()).actions.get('MobileSheetRewardClaim'), claim,
      'returning from secondary actions restores the single original reward CTA');
  }
  assert.equal(JSON.stringify(model), snapshot, 'reading reward cards cannot change the projected state');
  checkedRewardClaims += 1;
  sheetLists += 1;
}
function assertRelicDraftReachable(model, expected) {
  const snapshot = JSON.stringify(model);
  const pending = model.sections[1].detail.pending;
  assert.ok(pending.relicOptions?.length, 'pending relic draft projects its actual candidate metadata');
  assert.deepEqual(pending.relicOptions.map(option => option.actionId), expected.map(action => action.actionId),
    'relic draft preserves the real pending candidate order and exact claim IDs');
  const view = render(model, { kind: 'interaction', page: 0 });
  assertDarkSheet(view, 'interaction', safeInsets);
  assertSinglePageLootControls(view, 'MobileSheetRelicClaim');
  assert.ok(view.labels.some(({ name, text }) => name === 'MobileSheetTitle' && text === '选择一份回响'), 'relic draft has its direct-choice title');
  assert.ok(view.labels.some(({ text }) => text === '请选择一份回响'), 'unselected relic draft explains the required selection');
  assert.ok(view.labels.some(({ name, text }) => name === 'RelicDraftFootnote'
    && text === '确认获得后立即生效，无需装备；仅本局有效。'), 'relic draft explains that confirmation activates the selected run effect');
  assert.equal(view.actions.size, 0, 'opening a relic draft cannot select or acquire a candidate');
  for (const option of pending.relicOptions) {
    const name = `MobileSheetRelicOffer:${option.relicId}`;
    const action = expected.find(candidate => candidate.actionId === option.actionId);
    assert.ok(view.local.has(name), `${name}: card selection stays local`);
    assert.ok(!view.actions.has(name), `${name}: selecting a card cannot acquire a relic`);
    view.local.get(name)();
    assert.equal(view.nextState().selectedActionId, option.actionId, 'relic selection retains the actual projected command ID');
    assert.equal(view.nextState().kind, 'interaction', 'relic choice stays on the same interaction panel');
    const selected = render(model, view.nextState());
    assertDarkSheet(selected, 'interaction', safeInsets);
    assertSinglePageLootControls(selected, 'MobileSheetRelicClaim');
    assert.equal(selected.actions.get('MobileSheetRelicClaim'), action, 'relic CTA binds the selected exact original action');
    assert.ok(selected.labels.some(({ text }) => text === `获得${option.name}`), 'selected relic names the sole acquisition CTA');
    for (const runtime of [{ ...chrome, busyActionId: action.actionId }, { ...chrome, modeKind: 'blocked', blockingMessage: 'storage unavailable' }]) {
      const locked = render(model, view.nextState(), safeInsets, { chrome: runtime });
      assert.equal(locked.actions.size, 0, 'busy/blocked draft cannot acquire a relic');
      if (runtime.busyActionId) assert.ok(locked.labels.some(({ text }) => text === '正在获得'), 'busy relic CTA explains the acquisition');
    }
    checkedRelicDraftChoices += 1;
  }
  assert.equal(JSON.stringify(model), snapshot, 'switching relic cards only changes local sheet selection');
  sheetLists += 1;
}
function assertEquipmentOfferReachable(model, expected) {
  const modelBeforeSelection = JSON.stringify(model);
  const pending = model.sections[1].detail.pending;
  assert.ok(pending.equipmentOptions?.length, 'equipment offer projects its complete card metadata');
  assert.deepEqual(pending.equipmentOptions.map(option => option.actionId), expected.map(action => action.actionId),
    'equipment offer has one original claim action for each card');
  const state = { kind: 'interaction', page: 0, tab: 'actions' };
  const view = render(model, state);
  assertDarkSheet(view, 'interaction', safeInsets);
  const nodes = nodesIn(view.rootNode);
  assert.ok(view.labels.some(({ name, text }) => name === 'MobileSheetTitle' && text === '选择一件装备'),
    'equipment offer matches the prototype title');
  assert.ok(view.labels.some(({ text }) => text === `精英战利品 · ${pending.equipmentOptions.length} 选 1`),
    'equipment offer heading reflects its actual candidate count');
  assert.equal(nodes.filter(node => node.name.startsWith('MobileSheetEquipmentOffer:')).length, pending.equipmentOptions.length,
    'equipment offer renders every choice on one screen');
  assert.equal(nodes.filter(node => node.name === 'MobileSheetEquipmentClaim').length, 1, 'equipment offer has one income-to-bag CTA');
  assert.ok(nodesIn(nodes.find(node => node.name === 'MobileSheetEquipmentClaim'))
    .some(node => node.getComponent(api.Label)?.string === '收入背包'), 'the only CTA matches the prototype wording');
  for (const removed of ['MobileSheetTab:overview', 'MobileSheetTab:actions', 'MobileSheetPrevious', 'MobileSheetNext']) {
    assert.ok(!nodes.some(node => node.name === removed), `equipment offer omits ${removed}`);
  }
  assert.ok(!nodes.some(node => /^MobileSheetAction:|^MobileSheetExecute:/.test(node.name)),
    'equipment offer uses cards and one claim button');
  for (const option of pending.equipmentOptions) {
    const action = expected.find(candidate => candidate.actionId === option.actionId);
    const name = `MobileSheetEquipmentOffer:${option.equipmentId}`;
    assert.ok(view.local.has(name), `${name}: card selects locally`);
    assert.ok(!view.actions.has(name), `${name}: selecting a card cannot claim equipment`);
    view.local.get(name)();
    assert.equal(view.nextState().kind, 'interaction', 'equipment selection stays on the current choice sheet');
    assert.equal(view.nextState().selectedActionId, action.actionId, 'card selection keeps the original projected action ID');
    const selected = render(model, view.nextState());
    assertDarkSheet(selected, 'interaction', safeInsets);
    assert.equal(selected.actions.get('MobileSheetEquipmentClaim'), action, 'claim binds the selected exact original action');
    for (const runtime of [{ ...chrome, busyActionId: action.actionId }, { ...chrome, modeKind: 'blocked', blockingMessage: 'storage unavailable' }]) {
      const locked = render(model, view.nextState(), safeInsets, { chrome: runtime });
      assert.equal(locked.actions.size, 0, 'busy/blocked offer is readable without executable claims');
      if (runtime.busyActionId !== undefined) {
        const claim = nodesIn(locked.rootNode).find(node => node.name === 'MobileSheetEquipmentClaim');
        assert.ok(nodesIn(claim).some(node => node.getComponent(api.Label)?.string === '正在收入背包'),
          'the busy CTA explains the in-flight inventory claim');
      }
    }
    checkedEquipmentOfferChoices += 1;
  }
  assert.equal(JSON.stringify(model), modelBeforeSelection, 'switching equipment cards only updates local selection');
  sheetLists += 1;
}
function assertSheetReachable(model, kind, expected, initialTab = 'actions') {
  const signature = JSON.stringify([kind, model.phase, expected, initialTab]);
  if (renderedSignatures.has(signature)) return;
  renderedSignatures.add(signature);
  if (kind === 'interaction' && model.sections[1].detail.pending?.kind === 'equipment-offer') {
    assertEquipmentOfferReachable(model, expected);
    return;
  }
  const detail = model.sections[1].detail;
  if (kind === 'interaction' && detail.pending?.kind === 'relic-draft' && detail.pending.relicOptions?.length) {
    assertRelicDraftReachable(model, expected);
    return;
  }
  if (kind === 'interaction' && initialTab !== 'reward-services' && detail.rewardPreview
    && (!detail.pending || detail.pending.kind === 'dungeon-event')) {
    assertRewardClaimReachable(model, expected);
    return;
  }
  const reached = new Set();
  for (let page = 0; page < 128; page += 1) {
    const view = render(model, { kind, page, tab: initialTab });
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
        textReadout += detail.labels.filter(({ name }) => name.startsWith('ReadoutLine:')
          || name === 'MobileSheetActionDetailReadout').map(({ text }) => text).join('');
        const execute = detail.actions.get(`MobileSheetExecute:${action.actionId}`);
        if (action.enabled) assert.equal(execute, action, `${kind}: ${action.actionId} can execute its original event`);
        else assert.equal(execute, undefined, `${kind}: disabled action never executes`);
        if (!detail.local.has('MobileSheetNext')) break;
        assert.ok(detailPage < 127, 'action details pagination terminates');
      }
      if (!action.enabled) {
        const reason = model.phase === 'hub' ? api.formatInfiniteFlowHubActionLockedReason(action) : action.disabledReason;
        assert.ok(normalizeText(textReadout).includes(normalizeText(reason)),
          `${kind}: ${action.actionId} disabled reason is fully readable (${JSON.stringify({ reason, readout: textReadout })})`);
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

// Claim through the real application reducer, then inspect the permanent bag
// in every phase. Metadata and equip commands come from the real projection.
let checkedOwnedEquipmentSheets = 0;
{
  const entered = enter(initial);
  const equipmentIds = ['mist_hood', 'spirit_robe', 'bone_spear'];
  const awaiting = { ...entered, run: { ...entered.run, pendingEquipmentOffer: {
    offerId: 'permanent-equipment-sheet', equipmentIds,
    equipmentRolls: { spirit_robe: {
      rulesVersion: 1, sourceTier: 3, seed: 19, itemPower: 3050, quality: 'rare',
      affixes: [{ stat: 'maxHp', value: 50, minimum: 1, maximum: 50, greater: false }],
    } },
  } } };
  const offeredModel = add(awaiting);
  const claim = offeredModel.sections[2].actions.find(action => action.event?.kind === 'command'
    && action.event.command.type === 'node/resolve-equipment-loot' && action.event.command.equipmentId === 'spirit_robe');
  assert.ok(claim?.enabled, 'permanent-equipment fixture uses an actual projected claim');
  const acquired = commit(awaiting, claim.event.command);
  assert.ok(acquired.ownedEquipment.includes('spirit_robe'), 'claim owns the selected equipment before leaving the run');
  assert.deepEqual(acquired.equipped, awaiting.equipped, 'claim does not automatically replace worn equipment');
  const exploreModel = add(acquired);
  const phases = [
    exploreModel,
    add({ ...acquired, phase: 'hub', run: undefined }),
    add(commit(acquired, { type: 'run/select-node', nodeId: acquired.run.currentNodeId })),
    add(commit(acquired, { type: 'run/retreat' })),
  ];
  const priorFrame = api.view.frameSize;
  try {
    for (const frame of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
      api.view.frameSize = frame;
      const options = offeredModel.sections[1].detail.pending.equipmentOptions;
      const offerImages = new Map(options.map(option => [`equipment:${option.equipmentId}`, { frame: { equipmentId: option.equipmentId }, width: 1024, height: 1536 }]));
      const offer = render(offeredModel, { kind: 'interaction', page: 0 }, safeInsets, { images: offerImages });
      const offerPanel = nodesIn(offer.rootNode).find(node => node.name === 'MobileInfoSheet:interaction');
      assert.equal(nodesIn(offer.rootNode).filter(node => node.name.startsWith('MobileSheetEquipmentOffer:')).length, 3,
        `${frame.width}px: all three equipment choices share one screen`);
      let selection = offer;
      for (const option of options) {
        const card = nodesIn(offer.rootNode).find(node => node.name === `MobileSheetEquipmentOffer:${option.equipmentId}`);
        const box = boundsRelativeTo(card, offerPanel);
        const panelSize = offerPanel.getComponent(api.UITransform).contentSize;
        assert.ok(box.left >= -panelSize.width / 2 && box.right <= panelSize.width / 2
          && box.bottom >= -panelSize.height / 2 && box.top <= panelSize.height / 2,
        `${frame.width}px/${option.equipmentId}: complete equipment card is on screen`);
        assert.ok(box.width * frame.width / 750 >= 44 && box.height * frame.width / 750 >= 44,
          `${frame.width}px/${option.equipmentId}: card meets the touch floor`);
        const cardText = normalizeText(nodesIn(card).map(node => node.getComponent(api.Label)?.string ?? '').join(''));
        for (const value of [option.name, option.slotLabel, `Lv.${option.level}`]) {
          assert.ok(cardText.includes(normalizeText(value)), `${option.equipmentId}: complete projected ${value} is readable`);
        }
        assert.equal(nodesIn(card).find(node => node.getComponent(api.Sprite))?.getComponent(api.Sprite).spriteFrame,
          offerImages.get(`equipment:${option.equipmentId}`).frame, 'equipment option displays its own supplied image');
        selection.local.get(card.name)();
        assert.equal(selection.nextState().kind, 'interaction', 'all three card choices remain on the same interaction page');
        const selected = render(offeredModel, selection.nextState(), safeInsets, { images: offerImages });
        const readout = normalizeText(selected.labels.map(({ text }) => text).join(''));
        for (const value of [option.baseStatsLabel, option.baseStatsReadout, option.affixReadout, option.rollReadout].filter(Boolean)) {
          assert.ok(readout.includes(normalizeText(value)), `${option.equipmentId}: selected equipment preserves its complete projected readout`);
        }
        const claimButton = nodesIn(selected.rootNode).find(node => node.name === 'MobileSheetEquipmentClaim');
        const claimSize = claimButton.getComponent(api.UITransform).contentSize;
        assert.ok(claimSize.width * frame.width / 750 >= 44 && claimSize.height * frame.width / 750 >= 44,
          `${frame.width}px: claim button meets the touch floor`);
        assert.equal(selected.actions.get(claimButton.name), offeredModel.sections[2].actions.find(action => action.actionId === option.actionId));
        selection = selected;
      }

      for (const model of phases) {
        const snapshot = JSON.stringify(model);
        const entries = model.sections[1].loadout.ownedEquipment;
        const owned = entries.find(entry => entry.equipmentId === 'spirit_robe');
        assert.ok(owned && !owned.equipped, `${model.phase}: claimed equipment is permanently visible without being worn`);
        const images = new Map(entries.map(entry => [`equipment:${entry.equipmentId}`, { frame: { equipmentId: entry.equipmentId }, width: 1024, height: 1536 }]));
        const bag = render(model, { kind: 'inventory', page: 0 }, safeInsets, { images });
        assert.equal(bag.actions.size, 0, 'opening the inventory does not execute an equipment action');
        bag.local.get('MobileSheetTab:equipment')();
        assert.equal(bag.nextState().tab, 'equipment', 'equipment tab selects locally');
        const inventory = render(model, bag.nextState(), safeInsets, { images });
        assertDarkSheet(inventory, 'inventory', safeInsets);
        const inventoryNodes = nodesIn(inventory.rootNode);
        assert.deepEqual(inventoryNodes.filter(node => node.name.startsWith('MobileSheetInventoryEquipment:')).map(node => node.name),
          entries.map(entry => `MobileSheetInventoryEquipment:${entry.equipmentId}`), 'inventory includes all owned equipment, including worn entries');
        for (const entry of entries) {
          const cell = inventoryNodes.find(node => node.name === `MobileSheetInventoryEquipment:${entry.equipmentId}`);
          const size = cell.getComponent(api.UITransform).contentSize;
          assert.ok(size.width * frame.width / 750 >= 44 && size.height * frame.width / 750 >= 44,
            `${frame.width}px: equipment inventory cells meet the touch floor`);
          assert.equal(nodesIn(cell).find(node => node.getComponent(api.Sprite))?.getComponent(api.Sprite).spriteFrame,
            images.get(`equipment:${entry.equipmentId}`).frame, 'owned equipment renders the supplied image');
        }
        inventory.local.get(`MobileSheetInventoryEquipment:${owned.equipmentId}`)();
        assert.deepEqual(inventory.nextState().tip, { kind: 'equip', id: owned.equipmentId }, 'owned icon opens its own local tooltip');
        const tip = render(model, inventory.nextState(), safeInsets, { images });
        assertDarkSheet(tip, 'inventory', safeInsets);
        const tipText = normalizeText(tip.labels.map(({ text }) => text).join(''));
        for (const value of [owned.name, owned.slotLabel, owned.baseStatsLabel, owned.baseStatsReadout, owned.affixReadout, owned.rollReadout].filter(Boolean)) {
          assert.ok(tipText.includes(normalizeText(value)), `${model.phase}: owned tooltip preserves its full projected readout`);
        }
        const actionName = `MobileSheetTipEquip:${owned.equipmentId}`;
        if (model.phase === 'hub' || model.phase === 'explore') {
          assert.equal(tip.actions.get(actionName), owned.equipAction, `${model.phase}: tooltip directly binds the owned entry's equip command`);
          const size = nodesIn(tip.rootNode).find(node => node.name === actionName).getComponent(api.UITransform).contentSize;
          assert.ok(size.width * frame.width / 750 >= 44 && size.height * frame.width / 750 >= 44,
            `${frame.width}px: immediate equip button meets the touch floor`);
          for (const runtime of [{ ...chrome, busyActionId: owned.equipAction.actionId }, { ...chrome, modeKind: 'blocked', blockingMessage: 'storage unavailable' }]) {
            assert.equal(render(model, inventory.nextState(), safeInsets, { images, chrome: runtime }).actions.size, 0,
              'busy/blocked inventory cannot equip equipment');
          }
        } else {
          assert.equal(tip.actions.has(actionName), false, `${model.phase}: equipment remains readable while switching is unavailable`);
          assert.ok(tipText.includes(normalizeText(owned.equipAction.disabledReason)), `${model.phase}: switching restriction is fully readable`);
        }
        assert.equal(JSON.stringify(model), snapshot, 'bag inspection preserves the model and run state');
        checkedOwnedEquipmentSheets += 1;
      }
    }
  } finally { api.view.frameSize = priorFrame; }
  const owned = exploreModel.sections[1].loadout.ownedEquipment.find(entry => entry.equipmentId === 'spirit_robe');
  const equipped = commit(acquired, owned.equipAction.event.command);
  assert.equal(equipped.equipped.armor, 'spirit_robe', 'exploration tooltip command equips the just-claimed item');
  assert.equal(equipped.player.hp, acquired.player.hp, 'manual equipment switching does not heal the player');
  assert.ok(equipped.ownedEquipment.includes(acquired.equipped.armor), 'replaced equipment remains permanently in the bag');
}

// The chest panel and relic cards use metadata from real claims. Candidate
// counts come from the remaining pool and a conduit frozen by actual entry.
let checkedChestViewports = 0;
let checkedRelicOfferCards = 0;
{
  const fixtureForCount = count => {
    const hub = count === 3 ? {
      ...initial,
      preparedRelicFrame: 'assault',
      ownedEquipment: [...initial.ownedEquipment, 'armor_piercing_sword'],
      equipmentLevels: { ...initial.equipmentLevels, armor_piercing_sword: 2 },
      equipped: { ...initial.equipped, weapon: 'armor_piercing_sword' },
    } : initial;
    const entered = enter(hub);
    if (count === 3) assert.ok(entered.run.relicConduitSourceEquipmentIds.includes('armor_piercing_sword'),
      'three-choice fixture freezes its actual owned and worn conduit on entry');
    return { ...entered, run: { ...entered.run, currentNodeId: 'watch_post_cache',
      relicState: { ...entered.run.relicState, acquiredIds: count === 1 ? ['focus_prism', 'hunter_clock'] : count === 2 ? ['hunter_clock'] : [] },
    } };
  };
  const assertInsidePanel = (node, panel, message) => {
    const box = boundsRelativeTo(node, panel);
    const size = panel.getComponent(api.UITransform).contentSize;
    assert.ok(box.left >= -size.width / 2 && box.right <= size.width / 2
      && box.bottom >= -size.height / 2 && box.top <= size.height / 2, message);
    return box;
  };
  const assertTouch = (node, message) => {
    const size = node.getComponent(api.UITransform).contentSize;
    assert.ok(size.width / catalogCssUnit() >= 44 && size.height / catalogCssUnit() >= 44, message);
  };
  const assertRelicCardLayout = (card, option, images) => {
    const parts = nodesIn(card);
    const slot = parts.find(node => node.name === `RelicOfferIcon:${option.relicId}`);
    const spriteNode = slot?.getChildByName(`${slot.name}:Sprite`);
    const name = parts.find(node => node.name === 'RelicOfferName');
    const effect = parts.find(node => node.name === 'RelicOfferEffect');
    assert.ok(slot && spriteNode && name && effect, 'relic card has its own image slot, sprite, name and effect');
    const source = images.get(option.visualAssetKey);
    const slotSize = slot.getComponent(api.UITransform).contentSize;
    const spriteSize = spriteNode.getComponent(api.UITransform).contentSize;
    const epsilon = 1e-6;
    assert.ok(Math.abs(slotSize.width - slotSize.height) < epsilon, 'relic artwork has a square image slot');
    assert.ok(Math.abs(spriteSize.width / spriteSize.height - source.width / source.height) < epsilon,
      'relic artwork preserves the source image aspect ratio');
    assert.ok(spriteSize.width <= slotSize.width + epsilon && spriteSize.height <= slotSize.height + epsilon,
      'contained relic artwork fits both image-slot dimensions without cropping');
    assert.ok(Math.abs(spriteSize.width - slotSize.width) < epsilon || Math.abs(spriteSize.height - slotSize.height) < epsilon,
      'contained relic artwork fills at least one image-slot dimension');
    assert.deepEqual({ ...spriteNode.position }, { x: 0, y: 0, z: 0 }, 'contained relic artwork stays centered in its slot');
    const imageBox = assertInsidePanel(slot, card, 'the complete relic image slot stays inside its card');
    const nameBox = assertInsidePanel(name, card, 'the complete relic name stays inside its card');
    const effectBox = assertInsidePanel(effect, card, 'the complete relic effect stays inside its card');
    assert.ok(imageBox.right <= nameBox.left + epsilon && imageBox.right <= effectBox.left + epsilon
      && nameBox.bottom >= effectBox.top - epsilon,
      'relic image stays beside separate name and effect rows');
    const effectLines = effect.getComponent(api.Label).string.split('\n');
    assert.ok(effectLines.every(line => !/^[\p{P}\s]+$/u.test(line)),
      `${api.view.getFrameSize().width}px/${option.relicId}: relic effects never wrap into a punctuation-only line (${JSON.stringify(effectLines)})`);
  };
  const previousFrame = api.view.frameSize;
  try {
    for (const count of [1, 2, 3]) {
      const awaiting = fixtureForCount(count);
      const rewardModel = add(awaiting);
      const preview = rewardModel.sections[1].detail.rewardPreview;
      const claim = rewardModel.sections[2].actions.find(action => action.actionId === preview.actionId);
      const collected = commit(awaiting, claim.event.command);
      const relicModel = add(collected);
      const options = relicModel.sections[1].detail.pending.relicOptions;
      assert.equal(options.length, count, 'actual reward claim generates the requested remaining-pool candidate count');
      const images = new Map([
        ['scene:dungeon_prop_chest', { frame: { chest: true }, width: 1024, height: 1024 }],
        ...preview.items.filter(item => item.visualAssetKey).map(item => [item.visualAssetKey, { frame: { itemId: item.itemId }, width: 1024, height: 1536 }]),
        ...options.map(option => [option.visualAssetKey, { frame: { relicId: option.relicId }, width: 1024, height: 1536 }]),
      ]);
      for (const frame of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
        api.view.frameSize = frame;
        const reward = render(rewardModel, { kind: 'interaction', page: 0 }, safeInsets, { images });
        assertDarkSheet(reward, 'interaction', safeInsets);
        assertSinglePageLootControls(reward, 'MobileSheetRewardClaim');
        assert.ok(!nodesIn(reward.rootNode).some(node => node.name === 'MobileSheetScrollThumb'),
          `${frame.width}px: a reward list that fits its room sheet shows no scrollbar`);
        const rewardNodes = nodesIn(reward.rootNode);
        const rewardPanel = rewardNodes.find(node => node.name === 'MobileInfoSheet:interaction');
        const chest = rewardNodes.find(node => node.name === 'MobileSheetRoomArtFigure');
        assert.equal(nodesIn(chest).find(node => node.getComponent(api.Sprite))?.getComponent(api.Sprite).spriteFrame,
          images.get('scene:dungeon_prop_chest').frame, 'reward panel renders the supplied chest image');
        for (const [id, name, value, visualKey] of [
          ...(preview.rewardPoints > 0 ? [['reward-points', '奖励点', `+${preview.rewardPoints}`]] : []),
          ...(preview.lingyun > 0 ? [['lingyun', '灵蕴', `+${preview.lingyun}`]] : []),
          ...preview.items.map(item => [item.itemId, item.name, `×${item.count}`, item.visualAssetKey]),
          ...(preview.healing > 0 ? [['healing', '生命恢复', `+${preview.healing}`]] : []),
        ]) {
          const card = rewardNodes.find(node => node.name === `MobileSheetRewardItem:${id}`);
          assert.ok(card, 'reward preview shows every actual gain');
          assertInsidePanel(card, rewardPanel, `${frame.width}px: reward card is fully visible`);
          const copy = normalizeText(nodesIn(card).map(node => node.getComponent(api.Label)?.string ?? '').join(''));
          assert.ok(copy.includes(normalizeText(name)) && copy.includes(normalizeText(value)), 'reward card shows its complete actual name and gain');
          if (visualKey) assert.equal(nodesIn(card).find(node => node.getComponent(api.Sprite))?.getComponent(api.Sprite).spriteFrame,
            images.get(visualKey).frame, 'reward card uses its actual item image');
        }
        const rewardCTA = rewardNodes.find(node => node.name === 'MobileSheetRewardClaim');
        assertTouch(rewardCTA, `${frame.width}px: reward CTA meets the touch floor`);
        assert.equal(reward.actions.get(rewardCTA.name), claim, 'reward button directly uses the original projected collect command');

        let selection = render(relicModel, { kind: 'interaction', page: 0 }, safeInsets, { images, rewardReceipt: preview });
        assertDarkSheet(selection, 'interaction', safeInsets);
        assertSinglePageLootControls(selection, 'MobileSheetRelicClaim');
        const relicNodes = nodesIn(selection.rootNode);
        const relicPanel = relicNodes.find(node => node.name === 'MobileInfoSheet:interaction');
        const relicCards = relicNodes.filter(node => node.name.startsWith('MobileSheetRelicOffer:'));
        assert.equal(relicCards.length, count,
          'relic panel renders exactly the actual 1–3 pending candidates');
        const stateBox = assertInsidePanel(relicNodes.find(node => node.name === 'RelicDraftReceiptState'), relicPanel,
          'the resource receipt state stays inside the relic panel');
        const headingBox = assertInsidePanel(relicNodes.find(node => node.name === 'RelicDraftHeading'), relicPanel,
          'the candidate heading stays inside the relic panel');
        assert.ok(Math.abs(stateBox.y - headingBox.y) < 1e-6 && stateBox.right <= headingBox.left,
          'receipt state and relic heading share one row without overlapping');
        const receiptValues = relicNodes.find(node => node.name === 'RelicDraftReceiptValues');
        const receiptBox = assertInsidePanel(receiptValues, relicPanel, 'actual receipt values stay inside the relic panel');
        assert.ok(receiptBox.top <= Math.min(stateBox.bottom, headingBox.bottom), 'actual receipt values occupy the next row');
        const cardBoxes = relicCards.map(card => boundsRelativeTo(card, relicPanel));
        assert.ok(cardBoxes.every(box => Math.abs(box.x) < 1e-6 && Math.abs(box.width - cardBoxes[0].width) < 1e-6),
          'all one to three relic choices share one complete reading column');
        for (let index = 1; index < cardBoxes.length; index += 1) {
          assert.ok(cardBoxes[index - 1].bottom >= cardBoxes[index].top, 'neighboring relic rows do not overlap');
        }
        assert.ok(cardBoxes.every(box => box.top <= receiptBox.bottom), 'relic cards begin below the resource receipt row');
        assert.equal(selection.actions.size, 0, 'unselected relic panel has no acquisition command');
        assert.ok(selection.labels.some(({ text }) => text === '✓ 物资已领取'), 'relic stage retains the completed resource claim');
        const receipt = normalizeText(selection.labels.find(({ name }) => name === 'RelicDraftReceiptValues')?.text ?? '');
        for (const value of [
          preview.rewardPoints > 0 ? `奖励点 +${preview.rewardPoints}` : '',
          preview.lingyun > 0 ? `灵蕴 +${preview.lingyun}` : '',
          ...preview.items.map(item => `${item.name} ×${item.count}`),
          preview.healing > 0 ? `生命 +${preview.healing}` : '',
        ].filter(Boolean)) assert.ok(receipt.includes(normalizeText(value)), 'same-panel receipt preserves the actual completed gains');
        for (const option of options) {
          const card = relicNodes.find(node => node.name === `MobileSheetRelicOffer:${option.relicId}`);
          const scroll = nodesIn(relicPanel).find(node => node.getComponent(api.ScrollView))?.getComponent(api.ScrollView);
          assert.ok(scroll && nodesIn(scroll.content).includes(card), 'every relic candidate is reachable through the same clipped list');
          assertInsidePanel(card, scroll.content, `${frame.width}px/${count} choices: complete relic row remains inside reachable content`);
          assertTouch(card, `${frame.width}px: relic selection card meets the touch floor`);
          assertRelicCardLayout(card, option, images);
          const copy = normalizeText(nodesIn(card).map(node => node.getComponent(api.Label)?.string ?? '').join(''));
          assert.ok(copy.includes(normalizeText(option.name)) && copy.includes(normalizeText(option.description)),
            'relic card preserves its full actual name and effect without a tooltip');
          assert.equal(nodesIn(card).find(node => node.getComponent(api.Sprite))?.getComponent(api.Sprite).spriteFrame,
            images.get(option.visualAssetKey).frame, 'relic card uses its actual candidate image');
          selection.local.get(card.name)();
          selection = render(relicModel, selection.nextState(), safeInsets, { images, rewardReceipt: preview });
          const action = relicModel.sections[2].actions.find(action => action.actionId === option.actionId);
          const relicCTA = nodesIn(selection.rootNode).find(node => node.name === 'MobileSheetRelicClaim');
          const selectedCard = nodesIn(selection.rootNode).find(node => node.name === card.name);
          const badge = nodesIn(selectedCard).find(node => node.name === 'RelicOfferSelected');
          assert.ok(badge && badge.parent !== selectedCard && nativeFrame(badge.parent),
            'the selected badge has its own painted reading surface');
          assertInsidePanel(badge.parent, selectedCard, 'the complete selected badge stays inside its card');
          assertTouch(relicCTA, `${frame.width}px: relic acquisition CTA meets the touch floor`);
          assert.equal(selection.actions.get(relicCTA.name), action, 'selected relic CTA binds the original pending-draft action');
          checkedRelicOfferCards += 1;
        }
        const restored = render(relicModel, { kind: 'interaction', page: 0 }, safeInsets, { images });
        assert.ok(restored.labels.some(({ text }) => text === '✓ 物资已领取'), 'restored pending draft can explain its completed resource stage');
        assert.ok(!restored.labels.some(({ name }) => name === 'RelicDraftReceiptValues'), 'restored draft without a cached receipt does not invent past gain amounts');
        checkedChestViewports += 1;
      }
    }
    const entered = enter(initial);
    const ordinary = { ...entered, run: { ...entered.run, currentNodeId: 'north_supply_niche' } };
    const ordinaryModel = add(ordinary);
    const ordinaryPreview = ordinaryModel.sections[1].detail.rewardPreview;
    assert.equal(ordinaryPreview.relicDraftId, undefined, 'ordinary resource preview does not promise a relic');
    const claim = ordinaryModel.sections[2].actions.find(action => action.actionId === ordinaryPreview.actionId);
    const complete = commit(ordinary, claim.event.command);
    assert.equal(complete.run.relicState.pendingDraft, undefined, 'actual ordinary claim has no pending relic');
    for (const frame of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
      api.view.frameSize = frame;
      const reward = render(ordinaryModel, { kind: 'interaction', page: 0 });
      assertDarkSheet(reward, 'interaction', safeInsets);
      assertSinglePageLootControls(reward, 'MobileSheetRewardClaim');
      assert.ok(reward.labels.some(({ text }) => text === '物资收入战利品袋'), 'ordinary reward names its actual run-loot boundary');
      checkedChestViewports += 1;
    }
  } finally {
    api.view.frameSize = previousFrame;
  }
}
assert.equal(checkedChestViewports, 8, 'both mobile widths cover all three actual candidate counts and the ordinary chest');
assert.equal(checkedRelicOfferCards, 12, 'every actual candidate is checked at both mobile widths');

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

// Compact region maps retain the complete icon graph above read-only inline details.
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
function assertMapInlineGeometry(view) {
  const { nodes, viewport } = mapParts(view);
  const panel = nodes.find(node => node.name === 'MobileInfoSheet:map');
  const detail = nodes.find(node => node.name === 'MobileSheetMapDetail');
  assert.ok(detail, 'region details always have a reserved surface below the map');
  const graphBox = boundsRelativeTo(viewport, panel);
  const detailBox = boundsRelativeTo(detail, panel);
  const panelSize = panel.getComponent(api.UITransform).contentSize;
  assert.ok(detailBox.top <= graphBox.bottom, 'inline details do not overlap the icon grid');
  assert.ok(detailBox.left >= -panelSize.width / 2 && detailBox.right <= panelSize.width / 2
    && detailBox.bottom >= -panelSize.height / 2, 'inline details stay inside the mobile panel');
  assert.ok(detailBox.height / catalogCssUnit() >= 85.5, 'detail area reserves readable height on small phones');
  const lines = ['MapDetailStatus', 'MapDetailTitle', 'MapDetailDescription', 'MapDetailGuidance']
    .map(name => nodes.find(node => node.name === name)).filter(Boolean);
  for (let index = 1; index < lines.length; index += 1) {
    assert.ok(boundsRelativeTo(lines[index - 1], detail).bottom >= boundsRelativeTo(lines[index], detail).top - 0.5,
      'region status, name, description and guidance do not overlap');
  }
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
        assert.equal(scroll.horizontal, contentSize.width > size.width + 0.5, 'map scrolls horizontally only when the full graph needs it');
        assert.equal(scroll.vertical, contentSize.height > size.height + 0.5, 'map scrolls vertically only when the full graph needs it');
        assert.equal(scroll.cancelInnerEvents, true, 'dragging the map cancels child tile clicks');
        assert.ok(nodesIn(viewport).some(node => node.getComponent(api.Mask)), 'map scrolling clips cells to a mask');
        assert.ok(!nodes.some(node => /^MobileSheet(?:Previous|Next|PageCount)$/.test(node.name)), 'full map has no previous/next pagination');
        assert.equal(view.actions.size, 0, 'inspecting the map never binds a domain movement command');
        assertMapInlineGeometry(view);
        assert.ok(!view.labels.some(({ text }) => /放大名称|附近出口|返回地图/u.test(text)),
          'compact map has no name enlargement, nearby tab or separate detail page');
        const renderedCells = nodes.filter(node => /^MobileSheet(?:MapCell|Fog):/.test(node.name));
        assert.equal(renderedCells.length, map.nodes.length, `${map.dungeonId}/${protocolId}: every region cell is rendered together`);
        for (const cell of map.nodes) {
          const name = cell.state === 'fogged' ? `MobileSheetFog:${cell.x}:${cell.y}` : `MobileSheetMapCell:${cell.cellId}`;
          const tile = renderedCells.find(node => node.name === name);
          assert.ok(tile && nodesIn(content).includes(tile), `${name}: cell is reachable by scrolling instead of paging`);
          const tileSize = tile.getComponent(api.UITransform).contentSize;
          assert.ok(tileSize.width / catalogCssUnit() >= 43.99 && tileSize.height / catalogCssUnit() >= 43.99, `${name}: map cell preserves 44 CSS-pixel touch dimensions at ${frame.width}px`);
          if (cell.state === 'fogged') {
            assert.equal(view.local.has(name), false, 'unknown cells have no detail callback');
            assert.equal(view.actions.has(name), false, 'unknown cells have no domain callback');
            assert.equal(cell.nodeId, undefined, 'fog projection omits the hidden domain node id');
            assert.ok(tile.getChildByName('MapUnknownIcon'), 'fog uses an anonymous unknown marker');
          } else assert.ok(view.local.has(name), 'every known cell opens read-only local details');
          assert.ok(!nodesIn(tile).some(node => node.getComponent(api.Label)?.string), 'graph cells are icons without name labels');
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
        const originalModel = JSON.stringify(model);
        for (const selectedCell of [current, ...map.nodes.filter(cell => cell.state !== 'fogged' && cell !== current && cell.isAdjacent)]) {
          view.local.get(`MobileSheetMapCell:${selectedCell.cellId}`)();
          const selectedState = view.nextState();
          assert.equal(selectedState.selectedActionId, `map:${selectedCell.cellId}`, 'click selects that region locally');
          const selected = render(model, selectedState);
          const selectedParts = mapParts(selected);
          assertMapInlineGeometry(selected);
          assert.equal(selectedParts.nodes.filter(node => /^MobileSheet(?:MapCell|Fog):/.test(node.name)).length, map.nodes.length,
            'selecting a region retains the entire map alongside its details');
          assert.equal(selected.actions.size, 0, 'inline map details never bind movement or any domain command');
          assert.equal(selected.labels.find(({ name }) => name === 'MapDetailTitle')?.text, selectedCell.title,
            'inline details name the selected region');
          if (selectedCell.isAdjacent && selectedCell !== current) {
            const door = api.buildWalkWorld(model).targets.find(target => target.id === `door:${selectedCell.cellId}`);
            assert.ok(door, 'an adjacent map region has a corresponding physical gate');
            const direction = door.x === 125 ? '左侧' : door.x === 875 ? '右侧' : door.y === 125 ? '上方' : '下方';
            assert.ok(selected.labels.find(({ name }) => name === 'MapDetailStatus')?.text.startsWith(direction),
              'inline direction agrees with the physical gate even for generated long or diagonal links');
          }
          const selectedTile = selectedParts.nodes.find(node => node.name === `MobileSheetMapCell:${selectedCell.cellId}`);
          assert.ok(selectedTile.getChildByName('MapSelectedRing'), 'selected region has its own visual focus');
          const currentCell = selectedParts.nodes.find(node => node.name === `MobileSheetMapCell:${current.cellId}`);
          assert.ok(currentCell.getChildByName('MapTypeIcon:current'), 'selection never displaces the current-location icon');
          assert.ok(!selected.local.has('MobileSheetMapBack'), 'inline details require no separate back step');
        }
        const fog = map.nodes.find(cell => cell.state === 'fogged');
        if (fog) {
          const forgedFogSelection = render(model, { ...state, selectedActionId: `map:${fog.cellId}` });
          assert.ok(!forgedFogSelection.labels.some(({ name }) => name === 'MapDetailTitle'), 'unknown selection cannot expose hidden details');
        }
        assert.equal(JSON.stringify(model), originalModel, 'selecting map details leaves the complete gameplay projection unchanged');
        checkedFullMaps += 1;
      }
    }
  } finally {
    api.view.frameSize = previousFrame;
  }
  try {
  api.view.frameSize = { width: 320, height: 568 };
  const { model, map } = mapCases.find(candidate => candidate.protocolId === 'deep');
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
  assert.ok(!detail.local.has('MobileSheetMapBack'), 'inline region details do not replace the map');
  assert.deepEqual(mapParts(detail).scroll.getScrollOffset(), { x: -offset.x, y: offset.y }, 'selecting details preserves both map axes');
  const detailScroll = nodesIn(detail.rootNode).find(node => node.name === 'MobileSheetMapDetailScroll').getComponent(api.ScrollView);
  detailScroll.scrollToOffset(new api.Vec2(0, 40));
  const detailCapture = api.captureInfiniteFlowInfoSheetState(detail.rootNode, selected);
  assert.deepEqual(detailCapture.mapScrollOffset, offset, 'detail text scrolling cannot overwrite the map offset');
  const returned = render(model, detailCapture);
  assert.deepEqual(mapParts(returned).scroll.getScrollOffset(), { x: -offset.x, y: offset.y }, 'host refresh with details open restores original map position');
  const other = mapCases.find(candidate => candidate.map.dungeonId !== map.dungeonId);
  const otherDefault = render(other.model, state);
  const otherRestored = render(other.model, captured);
  assert.deepEqual(mapParts(otherRestored).scroll.getScrollOffset(), mapParts(otherDefault).scroll.getScrollOffset(), 'a different dungeon ignores stale map offsets');
  const sections = [...model.sections];
  sections[1] = { ...sections[1], detail: { ...sections[1].detail, map: { ...map, width: 0, height: 0, nodes: [], knownEdges: [] } } };
  const empty = render({ ...model, sections }, state);
  assert.equal(nodesIn(empty.rootNode).some(node => node.name === 'MobileSheetMapScroll'), false, 'empty map never computes invalid grid geometry');
  assert.ok(empty.labels.some(({ text }) => text.includes('区域地图暂不可用')), 'invalid map has an explicit visible explanation');
  } finally {
    api.view.frameSize = previousFrame;
  }
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
      const price = nodesIn(control).find(node => node.name === 'Price')?.getComponent(api.Label);
      assert.ok(Math.abs(label.fontSize / unit - (price ? 12 : 13)) < 0.6,
        `${control.name}: operation label uses compact readable button text`);
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
      assert.ok(size.width / catalogCssUnit() >= 43.99, 'goods icons retain the 44px touch floor in the compact grid');
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
  assert.ok(overview.local.has('MobileSheetTab:overview') && overview.local.has('MobileSheetTab:carry'), 'hub character exposes overview and carry destinations');
  assert.ok(!overview.local.has('MobileSheetTab:loadout'), 'old preparation no longer occupies a character tab');
  overview.local.get('MobileSheetOwnedLoadout')();
  assert.equal(overview.nextState().tab, 'loadout', 'owned configuration remains reachable from the overview');
  const ownedView = render(characterModel, overview.nextState(), safeInsets, { ownedLoadout: () => owned, actionPool: owned.rows.flatMap(row => row.actions) });
  ownedView.local.get('MobileSheetOwnedLoadoutBack')();
  assert.equal(ownedView.nextState().tab, 'overview', 'owned configuration returns to the character overview');
  assertCatalogReachable(characterModel, 'character', owned, { ownedLoadout: () => owned, actionPool: owned.rows.flatMap(row => row.actions) });
  const combatCharacter = render(add(trainedCombat), { kind: 'character', page: 0 });
  assert.ok(combatCharacter.local.has('MobileSheetTab:carry'), 'combat character keeps carry inspection available');
  assert.ok(!combatCharacter.local.has('MobileSheetOwnedLoadout'), 'combat character does not offer hub configuration');
}

// The portal keeps the chapter directory and entry footer on one page. The
// upward settings overlay retains every projection-owned preparation action.
const entrySignatures = new Set();
let checkedEntryServices = 0;
let checkedEntryDungeons = 0;
let checkedEntryOptions = 0;
function entryNode(view, name) { return nodesIn(view.rootNode).find(node => node.name === name); }
function entryScroll(view, name) { return entryNode(view, name)?.getComponent(api.ScrollView); }
function assertEntryFooter(view, confirm) {
  const nodes = nodesIn(view.rootNode);
  assert.equal(nodes.filter(node => node.name === 'MobileSheetEntryConfirm').length, 1, 'portal has exactly one entry button');
  const footer = entryNode(view, 'MobileSheetEntryFooter');
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
}
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
  assert.equal(entryNode(directory, 'MobileSheetEntrySettings'), undefined, 'default portal keeps settings collapsed');
  assert.ok(directory.local.has('MobileSheetEntrySettingsToggle'), 'settings can expand from the same page');
  assertEntryFooter(directory, confirm);
  for (const option of dungeonOptions) {
    const name = `MobileSheetEntryDungeon:${option.id}`;
    const row = directoryNodes.find(node => node.name === name);
    assert.ok(row, `${option.id}: every chapter remains visible in the default list`);
    assert.ok(nodesIn(row).some(node => node.getComponent(api.Label)?.string?.includes(option.name)), 'chapter row displays its human-readable name');
    if (option.selected) {
      assert.equal(directory.actions.get(name), undefined, 'touching the current chapter does not dispatch a redundant selection');
      directory.local.get(name)?.();
      assert.ok(!directory.nextState()?.entrySettingsOpen, 'current chapter cannot open another page or settings');
    } else {
      assert.equal(directory.actions.get(name), option.action, 'chapter choice forwards the exact projected selection event, including locked chapters');
    }
    checkedEntryDungeons += 1;
  }
  directory.local.get('MobileSheetEntrySettingsToggle')();
  const state = directory.nextState();
  assert.equal(state.entrySettingsOpen, true, 'settings expands locally');
  const view = render(model, state);
  assertDarkSheet(view, 'entry', safeInsets);
  const nodes = nodesIn(view.rootNode);
  assert.ok(entryNode(view, 'MobileSheetEntrySettings'), 'settings lives in an overlay on the entry sheet');
  assert.equal(nodes.filter(node => node.name.startsWith('MobileSheetEntryDungeon:')).length, api.DUNGEON_ORDER.length, 'opening settings retains the chapter list');
  assert.ok(!nodes.some(node => node.name === 'MobileSheetEntryBack' || node.name === 'MobileSheetEntryService:dungeon'), 'entry has no second page or duplicate chapter selector');
  assert.ok(!nodes.some(node => /^MobileSheet(?:Previous$|Next$|Tab:|Action:|Execute:)/.test(node.name)), 'portal omits generic paged controls and second confirmation screens');
  assertEntryFooter(view, confirm);
  const frameService = services.find(service => service.id === 'relic-frame');
  const frameDescription = entryNode(view, 'MobileSheetEntryFrameDescription')?.getComponent(api.Label);
  assert.ok(frameDescription, 'selected echo direction has one compact description');
  assert.equal(frameDescription.string, frameService.options.find(option => option.selected).shortDescription, 'echo description follows the real selected direction');
  assert.equal(frameDescription.string.includes('\n'), false, 'echo description never becomes a multiline details list');
  assert.equal(frameDescription.enableWrapText, false, 'echo direction is rendered as a single line');
  for (const service of services) {
    const directOptions = service.options.every(option => entryNode(view, `MobileSheetEntryOption:${option.action.actionId}`));
    let expanded = view;
    if (!directOptions) {
      const row = entryNode(view, `MobileSheetEntryService:${service.id}`);
      assert.ok(row, `${service.id}: optional service has an expansion row`);
      const rowText = nodesIn(row).map(node => node.getComponent(api.Label)?.string ?? '').join('');
      assert.ok(rowText.includes(service.name) && rowText.includes(service.summary), `${service.id}: collapsed row names the service and current selection`);
      const open = view.local.get(row.name);
      assert.ok(open, `${service.id}: service can expand locally`);
      open();
      const selected = view.nextState();
      assert.equal(selected.entryServiceId, service.id, 'expansion belongs to the chosen service');
      assert.equal(selected.entrySettingsOpen, true, 'service expansion stays inside settings');
      assert.equal(selected.selectedActionId, undefined, 'service selection does not require an action confirmation screen');
      expanded = render(model, selected);
      assertDarkSheet(expanded, 'entry', safeInsets);
    }
    for (const option of service.options) {
      const node = entryNode(expanded, `MobileSheetEntryOption:${option.action.actionId}`);
      assert.ok(node, `${service.id}/${option.id}: projected option remains visible`);
      const action = expanded.actions.get(node.name);
      if (option.action.enabled && !option.selected) assert.equal(action, option.action, 'service choice executes the exact projection-owned event');
      else {
        assert.equal(action, undefined, 'selected or locked service choice cannot execute');
        if (!option.selected && option.action.disabledReason) {
          const explanation = service.id === 'protocol' || service.id === 'inferno-tier'
            ? entryNode(expanded, 'MobileSheetEntrySettings') : node;
          const description = nodesIn(explanation).map(child => child.getComponent(api.Label)?.string ?? '').join('');
          assert.ok(normalizeText(description).includes(normalizeText(option.action.disabledReason)), `${service.id}/${option.id}: complete disabled reason remains readable`);
        }
      }
      assert.notEqual(option.action.actionId, 'hub.entry.confirm', 'entry request is never repeated as a service choice');
      checkedEntryOptions += 1;
    }
    if (!directOptions) {
      expanded.local.get(`MobileSheetEntryService:${service.id}`)();
      assert.equal(expanded.nextState().entryServiceId, undefined, 'expanded service can collapse again');
    }
    checkedEntryServices += 1;
  }
  view.local.get('MobileSheetEntrySettingsToggle')();
  assert.equal(view.nextState().entrySettingsOpen, false, 'settings collapses back over the same chapter list');
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
      for (const entrySettingsOpen of [false, true]) {
        const view = render(model, { kind: 'entry', page: 0, entrySettingsOpen });
        const nodes = nodesIn(view.rootNode);
        const footer = entryNode(view, 'MobileSheetEntryFooter');
        const button = entryNode(view, 'MobileSheetEntryConfirm');
        const box = boundsRelativeTo(button, footer);
        const size = footer.getComponent(api.UITransform).contentSize;
        assert.ok(Math.abs(box.height / catalogCssUnit() - 44) < 0.6, 'entry button remains compact at both phone widths');
        assert.ok(box.left >= -size.width / 2 - 0.6 && box.right <= size.width / 2 + 0.6
          && box.bottom >= -size.height / 2 - 0.6 && box.top <= size.height / 2 + 0.6, 'entry button fits its footer');
        assert.ok(entryScroll(view, 'MobileSheetEntryDungeonScroll'), 'chapter choices have a dedicated scrolling region');
        const sheet = entryNode(view, 'MobileInfoSheet:entry');
        const footerBox = boundsRelativeTo(footer, sheet);
        const scrollBox = boundsRelativeTo(entryNode(view, 'MobileSheetEntryDungeonScroll'), sheet);
        assert.ok(footerBox.top <= scrollBox.bottom + 0.6, 'fixed entry footer never overlaps the scrolling chapter list');
        if (entrySettingsOpen) {
          assert.ok(entryScroll(view, 'MobileSheetEntrySettingsScroll'), 'settings has its own scrollable region');
          const settingsBox = boundsRelativeTo(entryNode(view, 'MobileSheetEntrySettings'), sheet);
          assert.ok(settingsBox.bottom >= footerBox.top - 0.6, 'settings expands upward without covering the entry footer');
        }
        assert.equal(nodes.filter(node => node.name.startsWith('MobileSheetEntryDungeon:')).length, 19, 'both phone widths retain every chapter');
      }
    }
  } finally {
    api.view.frameSize = previousFrame;
  }
  const directoryState = { kind: 'entry', page: 0 };
  const directory = render(model, directoryState);
  entryScroll(directory, 'MobileSheetEntryDungeonScroll').scrollToOffset(new api.Vec2(0, 180));
  const captured = api.captureInfiniteFlowInfoSheetState(directory.rootNode, directoryState);
  assert.equal(captured.entryDungeonScrollOffset, 180, 'portal captures chapter list position before a host refresh');
  const refreshed = render(model, captured);
  assert.equal(entryScroll(refreshed, 'MobileSheetEntryDungeonScroll').getScrollOffset().y, 180, 'host refresh restores the chapter list position');
  refreshed.local.get('MobileSheetEntrySettingsToggle')();
  const settingsState = refreshed.nextState();
  assert.equal(settingsState.entrySettingsOpen, true, 'settings opens on the same chapter page');
  assert.equal(settingsState.entryDungeonScrollOffset, 180, 'settings preserves the chapter list position');
  const settings = render(model, { ...settingsState, entryServiceId: 'route-contract' });
  assert.equal(entryScroll(settings, 'MobileSheetEntryDungeonScroll').getScrollOffset().y, 180, 'chapter list stays at the same position beneath settings');
  entryScroll(settings, 'MobileSheetEntrySettingsScroll').scrollToOffset(new api.Vec2(0, 80));
  const bothCaptured = api.captureInfiniteFlowInfoSheetState(settings.rootNode, { ...settingsState, entryServiceId: 'route-contract' });
  assert.equal(bothCaptured.entryDungeonScrollOffset, 180, 'capturing settings does not overwrite the chapter offset');
  assert.equal(bothCaptured.entrySettingsScrollOffset, 80, 'settings captures its own independent scroll offset');
  const refreshedSettings = render(model, bothCaptured);
  assert.equal(entryScroll(refreshedSettings, 'MobileSheetEntrySettingsScroll').getScrollOffset().y, 80, 'settings restores its own list position');
  refreshedSettings.local.get('MobileSheetEntrySettingsToggle')();
  const returned = render(model, refreshedSettings.nextState());
  assert.equal(entryNode(returned, 'MobileSheetEntrySettings'), undefined, 'collapsing settings leaves only the directory and footer');
  assert.equal(entryScroll(returned, 'MobileSheetEntryDungeonScroll').getScrollOffset().y, 180, 'closing settings resumes the original chapter position');
  const lockedModel = add(initial, { hubPanel: 'entry', entryDraft: { dungeonId: api.DUNGEON_ORDER.at(-1), protocolId: 'standard' } });
  const lockedConfirm = lockedModel.sections[2].actions.find(action => action.actionId === 'hub.entry.confirm');
  assert.equal(lockedConfirm.enabled, false, 'locked chapter fixture cannot enter');
  assertEntryFooter(render(lockedModel, directoryState), lockedConfirm);
  for (const runtime of [{ ...chrome, busyActionId: 'pending-action' }, { ...chrome, modeKind: 'blocked', blockingMessage: 'storage unavailable' }]) {
    const view = render(model, { kind: 'entry', page: 0, entrySettingsOpen: true, entryServiceId: 'route-contract' }, safeInsets, { chrome: runtime });
    assert.equal(view.actions.size, 0, 'busy/blocked runtime cannot change preparation or request entry');
    assert.ok(entryNode(view, 'MobileSheetEntryConfirm'), 'runtime locking retains the fixed entry button');
    assert.ok(entryNode(view, 'MobileSheetEntrySettings'), 'runtime locking keeps preparation readable');
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
    const hud = renderCombatHud(model);
    const hudNodes = nodesIn(hud.rootNode);
    assert.ok(!hudNodes.some(node => node.name.startsWith('WalkCombatPage')), 'combat HUD does not paginate');
    if (original.length > 0) {
      const fixedControl = node => /^WalkCombat(?:Choice:(?:spells|medicines)|Action:combat\.action:(?:attack|weapon_skill|guard|use_thunder_talisman|escape))$/.test(node.name);
      const controls = hudNodes.filter(fixedControl);
      assert.equal(controls.length, 6, 'combat HUD exposes exactly six fixed controls');
      // Combat v2: one large attack control, four equal satellites and a small escape control.
      const sizeOf = node => node.getComponent(api.UITransform).contentSize.width;
      const attackSize = sizeOf(controls.find(node => /combat\.action:(?:attack|weapon_skill)$/.test(node.name)));
      const satellites = controls.filter(node => /^WalkCombat(?:Choice:|Action:combat\.action:(?:guard|use_thunder_talisman)$)/.test(node.name));
      assert.equal(satellites.length, 4, 'guard, spells, talisman and medicines circle the attack control');
      assert.equal(new Set(satellites.map(sizeOf)).size, 1, 'the four satellites share one size');
      assert.ok(attackSize > sizeOf(satellites[0]) * 1.5, 'the attack control is the dominant target');
      for (const node of controls) {
        const { width, height } = node.getComponent(api.UITransform).contentSize;
        assert.equal(width, height, `${node.name}: round control keeps a square touch box`);
        assert.ok(width >= 44 * 750 / 390 - 1e-6, `${node.name}: touch target stays at least 44 visible pixels`);
      }
      const weapon = original.find(action => action.combatAction === 'weapon_skill' && action.enabled && action.event);
      const expectedAttack = weapon ?? original.find(action => action.combatAction === 'attack');
      const attackNodes = controls.filter(node => /combat\.action:(?:attack|weapon_skill)$/.test(node.name));
      assert.equal(attackNodes.length, 1, 'basic attack and weapon skill share one control');
      assert.equal(attackNodes[0].name, `WalkCombatAction:${expectedAttack.actionId}`, 'attack control uses the available weapon skill or actual basic attack');
      assert.equal(hud.actions.get(attackNodes[0].name), expectedAttack, 'unified attack binds its exact original action');
      const stalePage = renderCombatHud(model, 99);
      assert.deepEqual(nodesIn(stalePage.rootNode).filter(fixedControl).map(node => node.name),
        controls.map(node => node.name), 'legacy page state cannot hide or change fixed controls');
    }
    for (const group of ['spells', 'medicines']) {
      assert.ok(hud.local.has(`WalkCombatChoice:${group}`), `${group}: persistent picker entry remains available`);
      hud.local.get(`WalkCombatChoice:${group}`)();
      assert.equal(hud.choiceGroup(), group);
      const picker = render(model, { kind: 'menu', page: 0, tab: group });
      assertCompactCombatPicker(picker, model, group);
      for (const action of api.getInfiniteFlowCombatChoiceActions(model, group)) {
        assert.ok(original.includes(action), 'picker retains original action references');
        assert.ok(!hud.actions.has(`WalkCombatAction:${action.actionId}`), 'picker actions do not occupy a main HUD control');
      }
    }
    assert.ok(original.every(action => available.has(action)), 'generic combat menu retains every original command, including the alternate attack');
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

console.log(`Permanent equipment sheets: ${checkedOwnedEquipmentSheets} owned-bag phase/viewport cases, ${checkedEquipmentOfferChoices} original claim choices; 320/390px three-card selection, complete selected readouts, image frames, immediate exploration wearing and busy/blocked controls verified.`);
console.log(`Chest claims: ${checkedChestViewports} real 320/390px viewport cases, ${checkedRelicOfferCards} complete candidate image/effect cards; ${checkedRewardClaims} original reward CTAs and ${checkedRelicDraftChoices} original relic choices, one-page claims, actual 1–3 candidates and restored-draft receipt boundaries verified.`);
console.log(`Run relic sheets: ${checkedRunRelicLists} lists, ${checkedRunRelicCards} cards; all nine effects, pending/settled exclusion, local tab navigation and 320/390px scrolling verified.`);
console.log(`Compact modal layout: ${checkedCompactSheetFamilies} authentic family/viewport/safe-inset cases; all 11 families at 320/390px, 304px width and 464px height caps, 48px header, 44px touch/32px button plates and 300px clipped scroll bounds verified.`);
console.log(`Compact modal art: ${checkedCompactRasterFigures} non-square character/equipment/supply/NPC figures; contain fitting, full-source sprites, hidden glyph placeholders and five-column bag/goods layouts verified.`);
console.log(`Mobile sheet actions: ${models.length} real VMs (${sourceFixtureCount} existing fixtures), ${originalActions} original actions, ${enabledCommands} enabled commands; ${sheetLists} concrete paged lists, ${checkedActionDetails} action details, ${disabledReadouts} full disabled readouts; ${checkedMovement} original door movements, ${combatSignatures.size} combat HUD variants; ${lawCommands.size} law families and ${pendingKinds.size} pending kinds. Dark UI: ${sheetFixtures.length} sheet types, ${darkSheetVisualCases} visual cases, ${darkBodyLabels} body labels, minimum body contrast ${darkMinimumBodyContrast.toFixed(3)}, danger/positive contrast >= 4.5. Catalog entries: ${JSON.stringify(catalogEntries)}. Full NPC/owned lists: ${checkedCatalogs}, direct or targeted catalog actions: ${checkedCatalogActions}. Task lists: ${checkedTaskLists}, task rows: ${checkedTaskRows}, task details: ${checkedTaskDetails}, kinds: ${[...taskKinds].join(',')}. Full maps: ${checkedFullMaps}, map cells: ${checkedMapCells}, stone gates: ${checkedStoneGates}, dungeon prop states: ${checkedDungeonProps}. Entry chapters: ${checkedEntryDungeons}, services: ${checkedEntryServices}, projected entry options: ${checkedEntryOptions}.`);
