// Headless contract gate for the ?gallery=2 layout styles.
//
// Scope here is the engine-agnostic contract every one of the ten styles must
// keep: it renders in both image tiers (empty library / fully stubbed library)
// with identical node structure, keeps the production semantic node counts,
// every press target stays >= 104x104 design px, frames remain cut-corner
// polygons, every label resolves to a painted surface at >= 4.5 contrast and
// the painter op budgets hold (sheet<=220, card<=120). Style 01 additionally
// proves byte-identical geometry and tokens versus the unguarded production
// render.
//
// Stage B agents run just their own files without touching the registry:
//   STYLE_FILES=abs/path/sheet-style-02.ts node headless/sheet-layout-gallery.self-check.mjs
// STYLE=03 restricts the run to one style id.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../../', import.meta.url));
const onlyStyle = process.env.STYLE;
const styleFiles = (process.env.STYLE_FILES ?? '')
  .split(/[,:]/)
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => {
    if (existsSync(value)) return value;
    const fromRepoRoot = `${root}/${value}`;
    if (existsSync(fromRepoRoot)) return fromRepoRoot;
    const fromCocos = `${root}/cocos/${value}`;
    if (existsSync(fromCocos)) return fromCocos;
    return value;
  });

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
  getScrollOffset() { return { x: 0, y: 0 }; }
}
export class Sprite { static SizeMode={CUSTOM:0,RAW:1,TRIMMED:2}; }
export class SpriteFrame { static createWithImage(image) { const frame = new SpriteFrame(); frame.texture = { __stub: true, image }; return frame; } }
export class Rect {} export class Vec2 {}
export const Input={EventType:{TOUCH_START:'touch-start',TOUCH_END:'touch-end'}};
export const KeyCode={}; export const input={}; export const game={}; export const Game={};
export const view={ getFrameSize(){ return {width:0,height:0}; } };
export const assetManager={ loadBundle() { throw new Error('gallery image preloader must not run in headless'); } };
export class JsonAsset {}
`;

const styleImports = styleFiles
  .map((file, index) => `import * as styleModule${index} from ${JSON.stringify(file)};`)
  .join('\n');
const styleArray = `[${styleFiles.map((_, index) => `styleModule${index}`).join(',')}]`;
const bundle = await build({
  stdin: {
    contents: `
      export { buildGameViewModel } from './packages/presentation/src/index.ts';
      export { createInitialState, ITEMS } from '@infinite-flow/core';
      export { reduceGameCommand } from '@infinite-flow/application';
      export { renderInfiniteFlowInfoSheet, PRODUCTION_SHEET_LAYOUT } from './cocos/assets/scripts/ui/InfiniteFlowInfoSheet.ts';
      export { SHEET_STYLE_01 } from './cocos/assets/scripts/ui/layouts/sheet-style-01.ts';
      export { SHEET_LAYOUT_STYLES } from './cocos/assets/scripts/ui/sheet-layout-styles.ts';
      export { DEFAULT_SHEET_THEME, sheetContrastRatio } from './cocos/assets/scripts/ui/sheet-theme.ts';
      export { DARK_UI } from './cocos/assets/scripts/ui/dark-ui.ts';
      export { EMPTY_SHEET_IMAGE_LIBRARY, SHEET_PORTRAIT_KEY, SHEET_SCENE_BANNER_KEY, SHEET_DUNGEON_BANNER_KEY, sheetEquipmentKey, sheetItemKey } from './cocos/assets/scripts/ui/sheet-kit.ts';
      export { BASELINE_LAYOUT_ID } from './cocos/assets/scripts/ui/sheet-layout.ts';
      export { Node, UITransform, Label, Graphics } from 'cc';
      ${styleImports}
      export const EXTRA_STYLE_MODULES = ${styleArray};
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
    name: 'sheet-layout-gallery-cc-stub',
    setup(builder) {
      builder.onResolve({ filter: /^cc$/ }, () => ({ path: 'cc', namespace: 'sheet-layout-cc' }));
      builder.onLoad({ filter: /.*/, namespace: 'sheet-layout-cc' }, () => ({ contents: ccStub }));
    },
  }],
});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

function stylesFromModules(modules) {
  const found = [];
  for (const module of modules) {
    if (module.default) found.push(module.default);
    for (const [name, value] of Object.entries(module)) {
      if (name.startsWith('SHEET_STYLE_') && value && typeof value === 'object' && 'layout' in value) {
        found.push(value);
      }
    }
  }
  return found;
}

// Bare runs verify the trunk-aggregated registry itself; STYLE_FILES lets an
// engine agent gate in-flight styles before the registry imports them.
const ALL_STYLES = styleFiles.length === 0
  ? [...api.SHEET_LAYOUT_STYLES]
  : [api.SHEET_STYLE_01, ...stylesFromModules(api.EXTRA_STYLE_MODULES)];
const seenIds = new Set();
for (const style of ALL_STYLES) {
  assert.ok(style.id && /^\d{2}$/.test(style.id), `${style.id ?? '<unknown>'}: two-digit style id`);
  assert.ok(!seenIds.has(style.id), `duplicate style id ${style.id}`);
  seenIds.add(style.id);
  assert.ok(style.name && style.reference, `${style.id}: gallery metadata present`);
  assert.ok(style.layout && style.theme && style.imagePolicy, `${style.id}: layout/theme/imagePolicy present`);
}
const STYLES = onlyStyle ? ALL_STYLES.filter((style) => style.id === onlyStyle) : ALL_STYLES;
assert.ok(STYLES.length > 0, `no styles to run${onlyStyle ? ` (STYLE=${onlyStyle})` : ''}`);

// --- authentic hub fixture (same enrichment as the on-device gallery) ------
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
  itemIds: ['healing_pill', 'dispel_talisman', 'gate_sigil'],
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

const allKeys = (() => {
  const keys = [api.SHEET_PORTRAIT_KEY, api.SHEET_SCENE_BANNER_KEY, api.SHEET_DUNGEON_BANNER_KEY];
  for (const id of ['training_blade', 'patched_headwrap', 'patched_coat', 'patched_gloves', 'patched_boots', 'patched_belt', 'plain_charm']) {
    keys.push(api.sheetEquipmentKey(id));
  }
  for (const id of ['healing_pill', 'thunder_talisman', 'dispel_talisman', 'gate_sigil', 'echo_coin', 'capture_net', 'spirit_bait', 'armor_patch', 'focus_incense']) {
    keys.push(api.sheetItemKey(id));
  }
  return keys;
})();
const fakeImage = { frame: { __fakeSpriteFrame: true }, width: 160, height: 200 };
const FAKE_LIBRARY = Object.freeze({ get: (key) => (allKeys.includes(key) ? fakeImage : undefined) });

function render(model, sheetState, style, images) {
  const rootNode = new api.Node('GalleryTest');
  const local = [];
  let nextState;
  api.renderInfiniteFlowInfoSheet(rootNode, model, sheetState, {
    chrome: { modeKind: 'preview', modeLabel: '版式画廊', modeDetail: '仅预览，不写入存档' },
    safeInsets, surfaceHeight: 1334,
    theme: style.theme, layout: style.layout, images,
    bindLocal: (node, callback) => { local.push({ node, callback }); },
    bindAction() {}, close() {}, setState(next) { nextState = next; }, openHelp() {},
  });
  return { rootNode, local, nextState: () => nextState };
}
const allNodes = (rootNode) => [rootNode, ...rootNode.children.flatMap(allNodes)];
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
const ICON_NODES = new Set(['MobileSheetHeaderIcon', 'CloseIcon', 'ActionIcon', 'HelpIcon', 'ShortcutIcon', 'GlyphIcon']);
let globalMinimumContrast = Infinity;

function renderProduction(model, sheetState) {
  const rootNode = new api.Node('GalleryTest');
  const local = [];
  let nextState;
  api.renderInfiniteFlowInfoSheet(rootNode, model, sheetState, {
    chrome: { modeKind: 'preview', modeLabel: '样式画廊', modeDetail: '仅预览，不写入存档' },
    safeInsets, surfaceHeight: 1334,
    bindLocal: (node, callback) => { local.push({ node, callback }); },
    bindAction() {}, close() {}, setState(next) { nextState = next; }, openHelp() {},
  });
  return { rootNode, local, nextState: () => nextState };
}

for (const [kind, model, sheetState] of KINDS) {
  const production = renderProduction(model, sheetState);
  const productionGeometry = geometryMap(production.rootNode);

  for (const style of STYLES) {
    const label = `${style.id}/${kind}`;
    const empty = render(model, sheetState, style, api.EMPTY_SHEET_IMAGE_LIBRARY);
    const fake = render(model, sheetState, style, FAKE_LIBRARY);
    const emptyGeometry = geometryMap(empty.rootNode);
    const fakeGeometry = geometryMap(fake.rootNode);

    // (1) both image tiers render the identical node tree and geometry.
    assert.equal(fakeGeometry.size, emptyGeometry.size, `${label}: node count identical across image tiers`);
    for (const [path, expected] of emptyGeometry) {
      const actual = fakeGeometry.get(path);
      assert.ok(actual, `${label}: tier path ${path} exists`);
      assert.equal(actual.name, expected.name, `${label}: tier node name at ${path}`);
      assert.deepEqual(
        { x: actual.x, y: actual.y, width: actual.width, height: actual.height },
        { x: expected.x, y: expected.y, width: expected.width, height: expected.height },
        `${label}: tier geometry at ${path}`,
      );
    }

    const nodes = allNodes(empty.rootNode);
    const names = new Set(nodes.map((node) => node.name));

    // (2) semantic node counts survive the re-layout.
    if (kind === 'character') {
      assert.equal(nodes.filter((node) => node.name.startsWith('MobileSheetEquip:')).length, 7,
        `${label}: seven equip slots`);
      for (const head of ['hp', 'power', 'attack', 'defense']) {
        assert.ok(names.has(`MobileSheetKpi:${head}`) || names.has(`MobileSheetMetric:${head}`),
          `${label}: ${head} head card`);
      }
    } else if (kind === 'menu') {
      assert.equal(nodes.filter((node) => node.name.startsWith('MobileSheetShortcut:')).length, 9,
        `${label}: nine shortcut tiles`);
    } else {
      assert.equal(nodes.filter((node) => node.name.startsWith('MobileSheetItem:')).length, 9,
        `${label}: nine tactical item cells`);
      assert.equal(nodes.filter((node) => node.name === 'ItemCarriedSeal').length, 3,
        `${label}: three prepared seals`);
    }

    // (3) every press target keeps the 104 design-px minimum in both axes.
    for (const { node } of empty.local) {
      const size = sizeOf(node);
      assert.ok(size, `${label}/${node.name}: bound node has geometry`);
      assert.ok(size.width >= 104 && size.height >= 104,
        `${label}/${node.name}: bound target ${size.width}x${size.height} >= 104x104`);
    }

    // (4) cut-corner discipline (scroll thumb is the sole roundRect user).
    for (const node of nodes) {
      const graphics = node.getComponent(api.Graphics);
      if (!graphics) continue;
      if (node.name === 'MobileSheetScrollThumb') {
        assert.ok(graphics.roundRectCalls >= 1, `${label}: scroll thumb is the sole roundRect user`);
        continue;
      }
      if (ICON_NODES.has(node.name) || CIRCLE_EXEMPT.has(node.name)) continue;
      assert.equal(graphics.roundRectCalls, 0, `${label}/${node.name}: no rounded paths`);
      assert.equal(graphics.circleCalls, 0, `${label}/${node.name}: no circular paths outside doll/seal`);
      if (graphics.fills.length > 0 && node.name !== 'MobileSheetBackdrop') {
        const fill = firstSurfaceFill(node);
        assert.ok(fill, `${label}/${node.name}: first fill is a full-size cut-corner polygon`);
        const points = fill.shape.points;
        assert.ok(fill.shape.closed || (points[0].x === points.at(-1).x && points[0].y === points.at(-1).y),
          `${label}/${node.name}: surface path closed`);
      }
    }

    // (5) every label resolves to a painted surface (art slots carry none) at >= 4.5.
    for (const node of nodes) {
      const component = node.getComponent(api.Label);
      if (!component?.string) continue;
      let ancestor = node.parent;
      while (ancestor && firstSurfaceFill(ancestor) === undefined) ancestor = ancestor.parent;
      assert.ok(ancestor, `${label}/${node.name}: label resolves to a painted scrim/surface`);
      const ratio = api.sheetContrastRatio(component.color, firstSurfaceFill(ancestor).color);
      globalMinimumContrast = Math.min(globalMinimumContrast, ratio);
      assert.ok(ratio >= 4.5, `${label}/${node.name}: contrast ${ratio.toFixed(3)} >= 4.5`);
    }

    // (6) painter op budgets.
    const sheetFrame = nodes.find((candidate) => candidate.name === `MobileInfoSheet:${kind}`);
    for (const node of nodes) {
      const graphics = node.getComponent(api.Graphics);
      if (!graphics || CIRCLE_EXEMPT.has(node.name)) continue;
      const ops = graphics.fills.length + graphics.strokes.length;
      const budget = node === sheetFrame ? 220 : 120;
      assert.ok(ops <= budget, `${label}/${node.name}: ${ops} paint ops <= ${budget}`);
    }

    // (8) style 01 is the unguarded production render, geometry and tokens alike.
    if (style.id === '01') {
      assert.equal(emptyGeometry.size, productionGeometry.size, `${label}: S01 node count matches production`);
      for (const [path, expected] of productionGeometry) {
        const actual = emptyGeometry.get(path);
        assert.ok(actual, `${label}: S01 path ${path} exists`);
        assert.equal(actual.name, expected.name, `${label}: S01 node name at ${path}`);
        assert.deepEqual(
          { x: actual.x, y: actual.y, width: actual.width, height: actual.height },
          { x: expected.x, y: expected.y, width: expected.width, height: expected.height },
          `${label}: S01 geometry at ${path}`,
        );
      }
      assert.equal(style.layout, api.PRODUCTION_SHEET_LAYOUT, 'S01 mounts the shared PRODUCTION_SHEET_LAYOUT');
      assert.equal(style.theme, api.DEFAULT_SHEET_THEME, 'S01 mounts the production DEFAULT theme');
      assert.deepEqual(
        Object.values(style.imagePolicy),
        [false, false, false, false],
        'S01 disables every raster image class',
      );
    }
  }
}

// Local contrast fallback removed: the canonical sheetContrastRatio comes
// from the theme module itself.

const ranIds = STYLES.map((style) => style.id).join(',');
console.log(`Sheet layout gate: ${STYLES.length} style(s) [${ranIds}] x ${KINDS.length} sheets x 2 image tiers; `
  + `semantic counts, 104px touch floor, cut-corner discipline, label contrast minimum ${globalMinimumContrast.toFixed(3)} (>=4.5), `
  + 'op budgets (sheet<=220, card<=120) green; S01 production geometry/token identity asserted.');
