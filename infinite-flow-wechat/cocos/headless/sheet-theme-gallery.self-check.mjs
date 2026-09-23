import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// Style-gate for the ten gallery themes: palette WCAG contract, geometry/node
// invariance versus the production DEFAULT theme, cut-corner frame discipline,
// per-label contrast >= 4.5, structural counts and painter op budgets.
const root = fileURLToPath(new URL('../../', import.meta.url));

const ccStub = `
export class Node {
  static EventType = { TOUCH_START:'touch-start', TOUCH_END:'touch-end', TOUCH_CANCEL:'touch-cancel' };
  constructor(name='') { this.name=name; this.children=[]; this.components=[]; this.parent=null; this.listeners=new Map(); this.activeInHierarchy=true; this.layer=0; }
  addChild(child) { this.children.push(child); child.parent=this; }
  setPosition(position) { this.position=position; }
  setScale() {} setSiblingIndex() {}
  destroy() { this.destroyed=true; if(this.parent){ this.parent.children=this.parent.children.filter(c=>c!==this); this.parent=null; } }
  removeAllChildren() { for(const child of this.children) child.parent=null; this.children=[]; }
  getChildByName(name) { return this.children.find(child=>child.name===name) ?? null; }
  addComponent(Type) { const component=new Type(); component.node=this; this.components.push(component); return component; }
  getComponent(Type) { return this.components.find(component=>component instanceof Type) ?? null; }
  hasEventListener(type) { return this.listeners.has(type); }
  on(type, handler) {
    const list = this.listeners.get(type) ?? [];
    list.push(handler);
    this.listeners.set(type, list);
  }
  off(type, handler) {
    const list = this.listeners.get(type);
    if (!list) return;
    this.listeners.set(type, list.filter((entry) => entry !== handler));
  }
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
  getScrollOffset() { return this.offset ?? new Vec2(0, 0); }
  scrollToOffset(offset) { this.offset=new Vec2(offset.x, offset.y); for(const handler of this.node.listeners.get(ScrollView.EventType.SCROLLING) ?? []) handler(); }
}
export class Rect {} export class Sprite { static SizeMode={CUSTOM:0,RAW:1,TRIMMED:2}; } export class SpriteFrame {} export class Vec2 { constructor(x=0,y=0) { Object.assign(this,{x,y}); } }
export const Input={EventType:{TOUCH_START:'touch-start',TOUCH_END:'touch-end'}};
export const KeyCode={}; export const input={}; export const game={}; export const Game={};
export const view={ getFrameSize(){ return {width:0,height:0}; } };
`;

const bundle = await build({
  stdin: {
    contents: `
      export { buildGameViewModel } from './packages/presentation/src/index.ts';
      export { createInitialState, ITEMS } from '@infinite-flow/core';
      export { reduceGameCommand } from '@infinite-flow/application';
      export { renderInfiniteFlowInfoSheet } from './cocos/assets/scripts/ui/InfiniteFlowInfoSheet.ts';
      export { GALLERY_SHEET_THEMES } from './cocos/assets/scripts/ui/sheet-styles.ts';
      export { startInfiniteFlowSheetGallery, sheetGalleryRequested } from './cocos/assets/scripts/ui/InfiniteFlowSheetGallery.ts';
      export { assertSheetThemeContract, sheetContrastRatio, DEFAULT_SHEET_THEME } from './cocos/assets/scripts/ui/sheet-theme.ts';
      export { DARK_UI } from './cocos/assets/scripts/ui/dark-ui.ts';
      export { Node, UITransform, Label, Graphics } from 'cc';
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
    name: 'sheet-gallery-cc-stub',
    setup(builder) {
      builder.onResolve({ filter: /^cc$/ }, () => ({ path: 'cc', namespace: 'sheet-gallery-cc' }));
      builder.onLoad({ filter: /.*/, namespace: 'sheet-gallery-cc' }, () => ({ contents: ccStub }));
    },
  }],
});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

// --- palettes: 10/10 pass the WCAG contract --------------------------------
const themes = api.GALLERY_SHEET_THEMES;
assert.equal(themes.length, 10, 'gallery exposes exactly ten themes');
const ids = new Set();
for (const theme of themes) {
  assert.ok(!ids.has(theme.id), `unique theme id: ${theme.id}`);
  ids.add(theme.id);
  assert.ok(theme.name && theme.reference, `${theme.id}: gallery metadata present`);
  assertSheetContract(theme);
}
function assertSheetContract(theme) {
  const pairs = api.assertSheetThemeContract(theme);
  // Contract pairs carry their own minimum (4.5 text, 3 boundaries).
  const margins = pairs.map((pair) =>
    api.sheetContrastRatio(pair.foreground, pair.background) / pair.minimum);
  assert.ok(Math.min(...margins) >= 1, `${theme.id}: every palette pair meets its WCAG minimum`);
}
assert.equal(themes[0], api.DEFAULT_SHEET_THEME, 'gallery index 0 is the production default');

// --- authentic hub fixtures (real client command path, enrichments best-effort) ---
function commitOrCurrent(current, command) {
  const result = api.reduceGameCommand(current, command);
  return result.status === 'committed' ? result.state : current;
}
let galleryState = {
  ...api.createInitialState(),
  rewardPoints: 50_000,
  inventory: Object.fromEntries(Object.keys(api.ITEMS).map((id) => [id, 50])),
};
for (const itemId of ['healing_pill', 'dispel_talisman', 'gate_sigil', 'thunder_talisman']) {
  galleryState = commitOrCurrent(galleryState, { type: 'hub/buy-item', itemId, count: 5 });
}
galleryState = commitOrCurrent(galleryState, {
  type: 'hub/configure-tactical-loadout',
  itemIds: ['thunder_talisman', 'dispel_talisman', 'gate_sigil'],
});
galleryState = commitOrCurrent(galleryState, { type: 'hub/learn-method', methodId: 'mist_breathing' });
const hubModel = api.buildGameViewModel(galleryState, { hubPanel: 'supplies' });
const menuModel = api.buildGameViewModel(galleryState, {});
assert.equal(hubModel.sections[1].loadout.carriedCount, 3, 'fixture keeps exactly three prepared seals');
const KINDS = [
  ['character', hubModel, { kind: 'character', page: 0 }],
  ['menu', menuModel, { kind: 'menu', page: 0 }],
  ['inventory', hubModel, { kind: 'inventory', page: 0 }],
];
const safeInsets = { top: 323, right: 0, bottom: 66, left: 0 };
function render(model, sheetState, theme) {
  const rootNode = new api.Node('GalleryTest');
  const local = new Map();
  let nextState;
  api.renderInfiniteFlowInfoSheet(rootNode, model, sheetState, {
    chrome: { modeKind: 'preview', modeLabel: '样式画廊', modeDetail: '仅预览，不写入存档' },
    safeInsets, surfaceHeight: 1334, theme,
    bindLocal: (node, callback) => {
      if (!local.has(node.name)) local.set(node.name, callback);
    },
    bindAction() {}, close() {}, setState(next) { nextState = next; }, openHelp() {},
  });
  return { rootNode, local, nextState: () => nextState };
}
const allNodes = (rootNode) => [rootNode, ...rootNode.children.flatMap(allNodes)];
const rgba = (color) => [color.r, color.g, color.b, color.a];
const sizeOf = (node) => node.getComponent(api.UITransform)?.contentSize;
function firstSurfaceFill(node) {
  const graphics = node.getComponent(api.Graphics);
  const size = sizeOf(node);
  const shape = graphics?.fills[0]?.shape;
  if (shape?.kind !== 'path' || shape.points.length < 8 || !size) return undefined;
  const xs = shape.points.map(({ x }) => x);
  const ys = shape.points.map(({ y }) => y);
  return Math.max(...xs) - Math.min(...xs) === size.width && Math.max(...ys) - Math.min(...ys) === size.height
    ? graphics.fills[0]
    : undefined;
}

// Index-path geometry map (font sizes are exempt by design; node UITransform boxes must match).
function geometryMap(rootNode) {
  const map = new Map();
  const walk = (node, path) => {
    const size = sizeOf(node);
    map.set(path, {
      name: node.name,
      x: node.position?.x ?? 0,
      y: node.position?.y ?? 0,
      width: size?.width ?? 0,
      height: size?.height ?? 0,
    });
    node.children.forEach((child, index) => walk(child, `${path}/${index}:${child.name}`));
  };
  walk(rootNode, '0');
  return map;
}

const CIRCLE_EXEMPT = new Set(['DollAura', 'DollFigure', 'ItemCarriedSeal', 'MapStateIcon']);
// Glyph-only Graphics nodes: no enclosing surface, and glyphs may include dot circles.
const ICON_NODES = new Set(['MobileSheetHeaderIcon', 'CloseIcon', 'ActionIcon', 'HelpIcon', 'ShortcutIcon', 'GlyphIcon']);
let globalMinimumContrast = Infinity;

for (const [kind, model, sheetState] of KINDS) {
  const baseline = render(model, sheetState, undefined);
  const baselineGeometry = geometryMap(baseline.rootNode);
  const baselineNodes = allNodes(baseline.rootNode);

  for (const theme of themes) {
    const view = render(model, sheetState, theme);
    const nodes = allNodes(view.rootNode);
    const label = `${theme.id}/${kind}`;

    // (b) geometry + node tree invariance.
    const styledGeometry = geometryMap(view.rootNode);
    assert.equal(styledGeometry.size, baselineGeometry.size, `${label}: node count identical`);
    for (const [path, expected] of baselineGeometry) {
      const actual = styledGeometry.get(path);
      assert.ok(actual, `${label}: node path ${path} exists`);
      assert.equal(actual.name, expected.name, `${label}: node name at ${path}`);
      assert.deepEqual(
        { x: actual.x, y: actual.y, width: actual.width, height: actual.height },
        { x: expected.x, y: expected.y, width: expected.width, height: expected.height },
        `${label}: geometry at ${path}`,
      );
      if (expected.height === 104) {
        assert.equal(actual.height, 104, `${label}: 104 design-px touch preserved at ${path}`);
      }
    }

    // (c) frame discipline: full-size cut-corner surface first; no round/circular enclosing paths.
    for (const node of nodes) {
      const graphics = node.getComponent(api.Graphics);
      if (!graphics) continue;
      if (node.name === 'MobileSheetScrollThumb') {
        assert.ok(graphics.roundRectCalls >= 1, `${label}: scroll thumb is the sole roundRect user`);
        continue;
      }
      if (ICON_NODES.has(node.name)) continue;
      if (CIRCLE_EXEMPT.has(node.name)) continue;
      assert.equal(graphics.roundRectCalls, 0, `${label}/${node.name}: no rounded paths`);
      assert.equal(graphics.circleCalls, 0, `${label}/${node.name}: no circular paths outside doll/seal`);
      if (graphics.fills.length > 0 && node.name !== 'MobileSheetBackdrop') {
        const fill = firstSurfaceFill(node);
        assert.ok(fill, `${label}/${node.name}: first fill is a full-size cut-corner polygon`);
        const points = fill.shape.points;
        assert.ok(fill.shape.closed || (points[0].x === points.at(-1).x && points[0].y === points.at(-1).y),
          `${label}/${node.name}: surface path closed`);
        assert.ok(points.some((point, index) => {
          const next = points[(index + 1) % points.length];
          return point.x !== next.x && point.y !== next.y;
        }), `${label}/${node.name}: corners are diagonal cuts`);
      }
    }

    // (d) every label passes 4.5:1 against its nearest painted surface.
    for (const node of nodes) {
      const component = node.getComponent(api.Label);
      if (!component?.string) continue;
      let ancestor = node.parent;
      while (ancestor && firstSurfaceFill(ancestor) === undefined) ancestor = ancestor.parent;
      assert.ok(ancestor, `${label}/${node.name}: label resolves to a painted surface`);
      const ratio = api.sheetContrastRatio(component.color, firstSurfaceFill(ancestor).color);
      globalMinimumContrast = Math.min(globalMinimumContrast, ratio);
      assert.ok(ratio >= 4.5, `${label}/${node.name}: contrast ${ratio.toFixed(3)} >= 4.5`);
    }

    // (f) painter op budgets keep redraw cheap during rapid style switches.
    const sheetFrame = nodes.find((candidate) => candidate.name === `MobileInfoSheet:${kind}`);
    for (const node of nodes) {
      const graphics = node.getComponent(api.Graphics);
      if (!graphics || CIRCLE_EXEMPT.has(node.name)) continue;
      const ops = graphics.fills.length + graphics.strokes.length;
      const budget = node === sheetFrame ? 140 : 80;
      assert.ok(ops <= budget, `${label}/${node.name}: ${ops} paint ops <= ${budget}`);
    }
  }

  // (e) structural counts on the DEFAULT render are the invariant every style shares.
  const names = new Set(baselineNodes.map((node) => node.name));
  if (kind === 'character') {
    assert.ok(names.has('MobileSheetDollStage'), 'character: doll stage');
    assert.equal(baselineNodes.filter((node) => node.name.startsWith('MobileSheetEquip:')).length, 7, 'character: seven equip slots');
    for (const head of ['hp', 'power', 'attack', 'defense']) {
      assert.ok(names.has(`MobileSheetKpi:${head}`) || names.has(`MobileSheetMetric:${head}`), `character: ${head} head card`);
    }
    assert.ok(baselineNodes.some((node) => node.name.startsWith('MobileSheetMetric:') && !['hp'].some((id) => node.name.endsWith(`:${id}`)) && node.name !== 'MobileSheetMetric:hp'),
      'character: scrolling metric grid');
    assert.ok(names.has('MobileSheetScroll'), 'character: metric scroll view');
  } else if (kind === 'menu') {
    assert.equal(baselineNodes.filter((node) => node.name.startsWith('MobileSheetShortcut:')).length, 9, 'menu: nine shortcut tiles');
  } else {
    // Default 道具 tab: 3 supply cells.
    assert.ok(names.has('MobileSheetInventoryRack'), 'inventory: loadout rack');
    assert.equal(baselineNodes.filter((node) => node.name.startsWith('MobileSheetItem:')).length, 3, 'inventory 道具 tab: three supply cells');
    assert.ok(names.has('MobileSheetTab:items'), 'inventory: 道具 tab mounted');
    assert.ok(names.has('MobileSheetTab:carry'), 'inventory: 携行 tab mounted');
    // The 携行 tab carries the six special items with three prepared seals.
    const carryView = render(model, { ...sheetState, tab: 'carry' }, undefined);
    const carryNodes = allNodes(carryView.rootNode);
    assert.equal(carryNodes.filter((node) => node.name.startsWith('MobileSheetItem:')).length, 6, 'inventory 携行 tab: six carried item cells');
    const carriedSeals = carryNodes.filter((node) => node.name === 'ItemCarriedSeal');
    assert.equal(carriedSeals.length, 3, 'inventory 携行 tab: three default carried seals');
    // The legacy actions state view still renders the real inventory action
    // list for state-level fixtures/engines.
    const actionsView = render(model, { ...sheetState, tab: 'actions' }, undefined);
    assert.ok(allNodes(actionsView.rootNode).some((node) => node.name.startsWith('MobileSheetAction:')),
      'inventory: actions state lists real sheet actions');
  }
}

// (g) DEFAULT with no theme option keeps the exact production palette tokens.
const defaultView = render(hubModel, { kind: 'character', page: 0 }, undefined);
const defaultNodes = allNodes(defaultView.rootNode);
const sheetFrame = defaultNodes.find((node) => node.name === 'MobileInfoSheet:character');
assert.deepEqual(rgba(firstSurfaceFill(sheetFrame).color), rgba(api.DARK_UI.panel), 'DEFAULT sheet surface is DARK_UI.panel');
const equip = defaultNodes.find((node) => node.name.startsWith('MobileSheetEquip:'));
assert.deepEqual(rgba(firstSurfaceFill(equip).color), rgba(api.DARK_UI.raised), 'DEFAULT cell surface is DARK_UI.raised');
const rackModel = render(hubModel, { kind: 'inventory', page: 0 }, undefined);
const rack = allNodes(rackModel.rootNode).find((node) => node.name === 'MobileSheetInventoryRack');
assert.deepEqual(rgba(firstSurfaceFill(rack).color), rgba(api.DARK_UI.quiet), 'DEFAULT card surface is DARK_UI.quiet');
const labelTokens = [api.DARK_UI.bone, api.DARK_UI.muted, api.DARK_UI.gold, api.DARK_UI.red, api.DARK_UI.green]
  .map((color) => JSON.stringify([color.r, color.g, color.b]));
for (const node of defaultNodes) {
  const component = node.getComponent(api.Label);
  if (!component?.string) continue;
  assert.ok(labelTokens.includes(JSON.stringify([component.color.r, component.color.g, component.color.b])),
    `DEFAULT label ${node.name} uses a production palette token`);
}

const themeMins = themes.map((theme) => {
  const pairs = api.assertSheetThemeContract(theme);
  const textPairs = pairs.filter((pair) => pair.minimum === 4.5);
  return Math.min(...textPairs.map((pair) => api.sheetContrastRatio(pair.foreground, pair.background)));
});
const boundaryMins = themes.map((theme) => {
  const pairs = api.assertSheetThemeContract(theme);
  const boundaryPairs = pairs.filter((pair) => pair.minimum === 3);
  return Math.min(...boundaryPairs.map((pair) => api.sheetContrastRatio(pair.foreground, pair.background)));
});
console.log(`Sheet style gate: ${themes.length} themes x ${KINDS.length} sheets = ${themes.length * KINDS.length} combos; `
  + `text-pair minimums ${themeMins.map((value) => value.toFixed(2)).join('/')} (>=4.5); `
  + `boundary minimums ${boundaryMins.map((value) => value.toFixed(2)).join('/')} (>=3); `
  + `rendered label contrast minimum ${globalMinimumContrast.toFixed(3)}; `
  + `geometry, cut-corner discipline, structure and op budgets (sheet<=140, card<=80) green; DEFAULT tokens identical.`);

// --- gallery controller: guard, switcher bar, remounts, touch binding, exit ---
function setLocationSearch(search) {
  globalThis.location = { search };
  delete globalThis.wx;
}
setLocationSearch('?gallery=1');
assert.equal(api.sheetGalleryRequested(), true, 'gallery=1 enables the gallery');
globalThis.wx = {};
assert.equal(api.sheetGalleryRequested(), false, 'wx runtime never enters the gallery');
delete globalThis.wx;
setLocationSearch('');
assert.equal(api.sheetGalleryRequested(), false, 'plain preview URL does not enter the gallery');
setLocationSearch('?gallery=1');

function findNode(root, name) {
  return allNodes(root).find((node) => node.name === name);
}
function findNodes(root, name) {
  return allNodes(root).filter((node) => node.name === name);
}
function firePress(root, name) {
  const target = findNode(root, name);
  assert.ok(target, `press target ${name} exists`);
  const event = { propagationStopped: false };
  for (const handler of target.listeners.get('touch-start') ?? []) handler(event);
  for (const handler of target.listeners.get('touch-end') ?? []) handler(event);
  return target;
}

const canvas = new api.Node('Canvas');
canvas.addComponent(api.UITransform).setContentSize({ width: 750, height: 1334 });
const handle = await api.startInfiniteFlowSheetGallery(canvas);
const barControls = ['SheetGalleryPrevTheme', 'SheetGalleryNextTheme',
  'SheetGalleryKind:character', 'SheetGalleryKind:menu', 'SheetGalleryKind:inventory', 'SheetGalleryExit'];

assert.equal(canvas.children.length, 1, 'gallery attaches one persistent host under canvas');
assert.equal(canvas.children[0].name, 'SheetGalleryHost');
assert.ok(findNode(handle.root, 'SheetGalleryRoot'), 'overlay root mounted');
assert.ok(findNode(handle.root, 'SheetGalleryBar'), 'switcher bar mounted');
assert.ok(findNode(handle.root, 'MobileInfoSheet:character'), 'character sheet initially mounted');
assert.equal(findNode(handle.root, 'CaptionTitle').getComponent(api.Label).string, '1 / 10 · 赤金铁券', 'theme caption');
assert.equal(findNode(handle.root, 'CaptionReference').getComponent(api.Label).string, themes[0].reference, 'reference caption');

for (const name of barControls) {
  const control = findNode(handle.root, name);
  assert.ok(control, `bar control ${name} exists`);
  assert.equal(control.getComponent(api.UITransform).contentSize.height, 104, `${name}: 104 design-px touch height`);
}
// First style: previous is disabled (no touch listeners); the other five arm on START and fire on END.
assert.equal(findNode(handle.root, 'SheetGalleryPrevTheme').hasEventListener('touch-start'), false, 'prev disabled at first style');
for (const name of barControls.slice(1)) {
  assert.equal(findNode(handle.root, name).hasEventListener('touch-start'), true, `${name}: touch-start bound`);
  assert.equal(findNode(handle.root, name).hasEventListener('touch-end'), true, `${name}: touch-end bound`);
}

// Walk every style via next; each press fully remounts exactly one host child and updates the caption.
for (let index = 1; index < themes.length; index += 1) {
  firePress(handle.root, 'SheetGalleryNextTheme');
  assert.equal(canvas.children.length, 1, `style ${index + 1}: single host persists after remount`);
  assert.equal(findNode(handle.root, 'CaptionTitle').getComponent(api.Label).string,
    `${index + 1} / 10 · ${themes[index].name}`, `style ${index + 1}: caption advances`);
  assert.ok(findNode(handle.root, `MobileInfoSheet:character`), `style ${index + 1}: sheet remounted`);
}
assert.equal(findNode(handle.root, 'SheetGalleryNextTheme').hasEventListener('touch-start'), false, 'next disabled at last style');
assert.equal(findNode(handle.root, 'SheetGalleryPrevTheme').hasEventListener('touch-start'), true, 'prev enabled at last style');

// Kind switching mounts the other two sheets.
firePress(handle.root, 'SheetGalleryKind:menu');
assert.ok(findNode(handle.root, 'MobileInfoSheet:menu'), 'menu sheet mounted');
assert.equal(findNodes(handle.root, 'MobileSheetShortcut:character').length, 1, 'menu keeps its nine-tile shortcut grid');
const shortcutCount = allNodes(handle.root).filter((node) => node.name.startsWith('MobileSheetShortcut:')).length;
assert.equal(shortcutCount, 9, 'menu: nine shortcut tiles');
firePress(handle.root, 'SheetGalleryKind:inventory');
assert.ok(findNode(handle.root, 'MobileInfoSheet:inventory'), 'inventory sheet mounted');
// The bag opens on the 道具 tab: the bought healing pill shows there; the
// prepared seals live on the 携行 tab.
assert.equal(findNodes(handle.root, 'MobileSheetItem:healing_pill').length, 1, 'enriched fixture shows the bought item on 道具 tab');
assert.equal(findNodes(handle.root, 'ItemCarriedSeal').length, 0, '道具 tab carries no prepared seals');

// In-sheet navigation rebuilds only the sheet subtree: from the menu the
// 进阶行动 destination tile opens the real action list (the bag has no tabs).
firePress(handle.root, 'SheetGalleryKind:menu');
firePress(handle.root, 'MobileSheetShortcut:actions');
assert.ok(findNode(handle.root, 'MobileSheetTab:shortcuts')
  ?? allNodes(handle.root).some((node) => node.name.startsWith('MobileSheetAction:')),
  'actions destination lists real actions after touch; bar stays mounted');
assert.ok(findNode(handle.root, 'SheetGalleryBar'), 'switcher bar survives in-sheet navigation');

// Exit tears the host out of the canvas.
firePress(handle.root, 'SheetGalleryExit');
assert.equal(canvas.children.length, 0, 'exit removes the gallery host');

console.log('Gallery controller: guard (gallery=1 / wx / bare URL), six 104px bar controls with dual touch listeners, '
  + '10-style walkthrough captions, first/last disabled ends, kind switching, in-sheet tab remount, tabbed bag fixture (道具 pill / 携行 seals), exit teardown green.');
