import { Color, Graphics, Label, Mask, Node, Size, Sprite, UITransform, Vec2, Vec3 } from 'cc';
import type { SpriteFrame } from 'cc';
import type { GameViewModel, ViewActionModel } from '@infinite-flow/presentation';
import { formatInfiniteFlowPlayerChrome, isInfiniteFlowPlayerActivityFailure } from './InfiniteFlowView';
import type { InfiniteFlowRuntimeChrome } from './InfiniteFlowView';
import { findWalkPath, nearestWalkTarget, stepWalkPosition } from './walk-world';
import type { WalkWorldSpec, WorldPoint, WorldProp, WorldRect, WorldTarget } from './walk-world';
import { HUB_WORLD_THEME } from './dungeon-world-theme';
import type { WorldTint } from './dungeon-world-theme';
import { getInfiniteFlowNpcWorldVisualKey, getInfiniteFlowRunRelicVisualKey, getInfiniteFlowSceneVisualKeys, INFINITE_FLOW_DUNGEON_PROP_VISUAL_KEYS, INFINITE_FLOW_DUNGEON_TRANSITION_GATE_VISUAL_KEY, INFINITE_FLOW_HUB_DUNGEON_PORTAL_VISUAL_KEY } from './scene-visuals';
import { DARK_UI, paintDarkFrame, paintDarkIcon } from './dark-ui';
import { getWalkHudLayout } from './hud-layout';
import type { HudPopoverKind } from './hud-layout';
import { createInfiniteFlowCombatEffects } from './InfiniteFlowCombatEffects';
import type { CombatEffectKind, CombatEffectResult } from './InfiniteFlowCombatEffects';

export type { CombatEffectKind, CombatEffectResult } from './InfiniteFlowCombatEffects';

export type WalkSceneOptions = Readonly<{
  spec: WalkWorldSpec;
  position: WorldPoint;
  safeInsets: Readonly<{ top: number; right: number; bottom: number; left: number }>;
  /** Real visible fixed-width design surface height (>= 1334 on tall phones). */
  surfaceHeight: number;
  /** Visible game width in screen pixels; keeps the approved HUD touch dimensions. */
  viewportWidth?: number;
  visual: (key: string) => Readonly<{ frame: SpriteFrame; width: number; height: number }> | undefined;
  walkerFrames?: readonly SpriteFrame[];
  trackSprite: (sprite: Sprite) => void;
  bindAction: (node: Node, action: ViewActionModel) => void;
  bindLocal: (node: Node, callback: () => void) => void;
  bindHelp: (node: Node) => void;
  bindInteract: (node: Node, getTarget: () => WorldTarget | undefined) => void;
  bindWorldTap?: (node: Node, callback: (point: WorldPoint) => void) => void;
  interactTarget?: (target: WorldTarget) => void;
  openDetails: () => void;
  openCodex: () => void;
  openPanel?: (panel: 'character' | 'inventory' | 'map' | 'objectives' | 'log' | 'menu') => void;
  openHudPopover?: (kind: HudPopoverKind) => void;
  activeHudPopover?: HudPopoverKind;
  openCombatChoices: (group: 'spells' | 'medicines') => void;
  page: number;
  setPage: (page: number) => void;
  chrome: InfiniteFlowRuntimeChrome;
  feedback?: Readonly<{ text: string; damage?: number }>;
}>;

export type WalkSceneHandle = Readonly<{
  tick: (dt: number, axis: WorldPoint) => void;
  getPosition: () => WorldPoint;
  getFacing: () => 'down' | 'left' | 'right' | 'up';
  joystick: Node;
  joystickThumb: Node;
  startCombatAction: (kind: CombatEffectKind, onImpact: () => void) => boolean;
  resolveCombatAction: (result: CombatEffectResult, onComplete: () => void) => boolean;
  cancelCombatAction: () => void;
  isCombatAnimating: () => boolean;
  updateCombatReadout: (values: Readonly<{ playerHp?: number; enemyHp?: number }>) => void;
  cancelApproach: () => void;
  dispose: () => void;
}>;

type Facing = ReturnType<WalkSceneHandle['getFacing']>;
type DepthItem = { node: Node; y: number };
type SceneVisual = NonNullable<ReturnType<WalkSceneOptions['visual']>>;
type ReadyWalkSceneOptions = Omit<WalkSceneOptions, 'visual' | 'walkerFrames'> & Readonly<{
  visual: (key: string) => SceneVisual;
  walkerFrames: readonly SpriteFrame[];
  dungeonView?: Readonly<{ worldPixel: number; gateHeight: number; monsterHeight: number; monsterHudTop: number; compactLabels: boolean }>;
}>;

type DungeonHtmlRoomInput = Readonly<{
  worldWidth: number;
  worldHeight: number;
  surfaceHeight: number;
  viewportWidth: number;
  safeInsets: Readonly<{ top: number; right: number; bottom: number; left: number }>;
}>;
type DungeonHtmlRoomLayout = Readonly<{
  roomRect: WorldRect;
  cameraPoint: WorldPoint;
  scale: WorldPoint;
  offset: WorldPoint;
  hudPixel: number;
  controlsHeight: number;
  artwork: Readonly<{ gateHeight: number; monsterHeight: number; heroVisibleHeight: number; compact: boolean }>;
  targetFeet: Readonly<Record<'north' | 'south' | 'west' | 'east' | 'main', WorldPoint>>;
  project: (point: WorldPoint) => WorldPoint;
  unproject: (point: WorldPoint) => WorldPoint;
}>;

/** The HTML room uses screen positions; movement still follows the original world axes. */
export function getDungeonHtmlRoomLayout(input: DungeonHtmlRoomInput): DungeonHtmlRoomLayout {
  const hudPixel = 750 / input.viewportWidth;
  const controlsHeight = 120 * hudPixel;
  const safeWidth = 750 - input.safeInsets.left - input.safeInsets.right;
  const compact = input.viewportWidth <= 350;
  const artwork = { gateHeight: compact ? 60 : 90, monsterHeight: compact ? 108 : 158, heroVisibleHeight: compact ? 50 : 65, compact };
  const safeTop = input.surfaceHeight / 2 - input.safeInsets.top;
  const safeBottom = -input.surfaceHeight / 2 + input.safeInsets.bottom;
  const roomRect = {
    x: -safeWidth / 2,
    y: safeBottom + controlsHeight,
    width: safeWidth,
    height: input.surfaceHeight - input.safeInsets.top - input.safeInsets.bottom - (136 + 120) * hudPixel,
  };
  const contentTop = safeTop - 142 * hudPixel;
  const contentBottom = safeBottom + (compact ? 126 : 144) * hudPixel;
  const contentHeight = contentTop - contentBottom;
  const footTop = contentTop - artwork.heroVisibleHeight * hudPixel;
  const footBottom = contentBottom + 13 * hudPixel;
  const scale = { x: (safeWidth - 48 * hudPixel) / input.worldWidth, y: (footTop - footBottom) / input.worldHeight };
  if (scale.x <= 0 || scale.y <= 0 || roomRect.height <= 0) throw new Error('Dungeon room requires space below the HUD and above the controls.');
  const cameraPoint = { x: input.worldWidth / 2, y: input.worldHeight / 2 };
  const offset = { x: 0, y: (footTop + footBottom) / 2 };
  const project = (point: WorldPoint): WorldPoint => ({ x: offset.x + (point.x - cameraPoint.x) * scale.x, y: offset.y + (cameraPoint.y - point.y) * scale.y });
  const unproject = (point: WorldPoint): WorldPoint => ({ x: cameraPoint.x + (point.x - offset.x) / scale.x, y: cameraPoint.y - (point.y - offset.y) / scale.y });
  // Bottom edges, including the HTML's caption height and -3px image overlap.
  const nameHeight = compact ? 23 : 25;
  const westStateHeight = compact ? 14 : 16;
  const sideCenter = (contentTop + contentBottom) / 2;
  return {
    roomRect,
    cameraPoint,
    scale,
    offset,
    hudPixel,
    controlsHeight,
    artwork,
    targetFeet: {
      north: { x: 0, y: contentTop - artwork.gateHeight * hudPixel },
      south: { x: 0, y: contentBottom + (nameHeight - 3) * hudPixel },
      west: { x: -safeWidth / 2 + (compact ? 40 : 42) * hudPixel, y: sideCenter - (artwork.gateHeight - nameHeight + 3 - westStateHeight) / 2 * hudPixel },
      east: { x: safeWidth / 2 - (compact ? 40 : 42) * hudPixel, y: sideCenter - (artwork.gateHeight - nameHeight + 3) / 2 * hudPixel },
      main: { x: 0, y: contentTop - contentHeight * (compact ? 0.71 : 0.54) + (nameHeight - 3) * hudPixel },
    },
    project,
    unproject,
  };
}

/** Only view-local feet change. Every target retains its action, radius and destination. */
export function fitDungeonHtmlTargets(spec: WalkWorldSpec, layout: DungeonHtmlRoomLayout): WalkWorldSpec {
  const sides = ['north', 'south', 'west', 'east'] as const;
  const groups = new Map(sides.map(side => [side, spec.targets.filter(target => target.doorSide === side)]));
  const central = spec.targets.filter(target => target.doorSide === undefined);
  const targets = spec.targets.map(target => {
    const side = target.doorSide;
    const group = side === undefined ? central : groups.get(side)!;
    const index = group.indexOf(target);
    const slot = side === undefined ? layout.targetFeet.main : layout.targetFeet[side];
    const maxHorizontal = Math.max(0, layout.roomRect.width / 2 - 44 * layout.hudPixel);
    const minVertical = layout.roomRect.y + 38 * layout.hudPixel;
    const maxVertical = layout.roomRect.y + layout.roomRect.height - layout.artwork.gateHeight * layout.hudPixel;
    const spacing = Math.min((side === 'west' || side === 'east' ? 96 : 92) * layout.hudPixel,
      group.length <= 1 ? Infinity : (side === 'west' || side === 'east' ? maxVertical - minVertical : maxHorizontal * 2) / (group.length - 1));
    const shift = (index - (group.length - 1) / 2) * spacing;
    const verticalHalfSpan = (group.length - 1) * spacing / 2;
    const verticalCenter = Math.max(minVertical + verticalHalfSpan, Math.min(maxVertical - verticalHalfSpan, slot.y));
    const foot = side === 'west' || side === 'east'
      ? { x: slot.x, y: verticalCenter - shift }
      : { x: Math.max(-maxHorizontal, Math.min(maxHorizontal, slot.x + shift)), y: slot.y };
    return { ...target, ...layout.unproject(foot) };
  });
  return { ...spec, targets };
}

/** App owns loading; no scene nodes are created until all declared art is available. */
function readyWalkSceneOptions(options: WalkSceneOptions, model: GameViewModel): ReadyWalkSceneOptions {
  const frames = options.walkerFrames;
  if (frames === undefined || frames.length < 16 || Array.from({ length: 16 }, (_, index) => frames[index]).some(frame => frame == null)) {
    throw new Error('Walk scene requires the complete 16-frame player atlas.');
  }
  const visuals = new Map<string, SceneVisual>();
  for (const key of Object.values(getInfiniteFlowSceneVisualKeys(model))) {
    if (key === undefined) continue;
    const visual = options.visual(key);
    if (visual === undefined || visual.width <= 0 || visual.height <= 0) {
      throw new Error(`Walk scene required art is not ready: ${key}`);
    }
    visuals.set(key, visual);
  }
  return { ...options, walkerFrames: frames, visual: (key) => {
    const visual = visuals.get(key);
    if (visual === undefined) throw new Error(`Walk scene art was not declared: ${key}`);
    return visual;
  } };
}

const WORLD_ZOOM = 1.1;
const HUB_PORTAL_BODY_SCALE = { x: 1.25, y: 1.42 } as const;
const WHITE = new Color(244, 235, 211, 255);
const GOLD = new Color(236, 195, 117, 255);
// 玄黑金箓: actors and interaction magic read as red-gold bronze rather than teal.
const TEAL = new Color(197, 168, 106, 255);
const RED = new Color(214, 100, 82, 255);
const INK = new Color(18, 15, 12, 255);
const EDGE = new Color(96, 82, 62, 255);
// Approved style-refresh HUD materials. Geometry and input regions remain unchanged.
const WALK_HUD = Object.freeze({
  panel: new Color(26, 28, 19, 232),
  raised: new Color(37, 43, 27, 221),
  quiet: new Color(27, 32, 20, 217),
  active: new Color(57, 59, 36, 230),
  edge: new Color(178, 155, 98, 110),
  edgeLight: new Color(187, 162, 105, 176),
  gold: new Color(218, 202, 154, 255),
  text: new Color(226, 213, 174, 255),
  muted: new Color(193, 196, 173, 255),
  healthTrack: new Color(60, 65, 48, 255),
  health: new Color(157, 170, 132, 255),
});
// Every scene shares the courtyard's compact, borderless header.
const INK_DOT_HUD = Object.freeze({
  icon: WALK_HUD.gold,
  shadow: new Color(11, 18, 13, 255),
});
const HUD_WASH = new Color(25, 31, 25, 152);

function tint(rgb: WorldTint, brightness = 0, alpha = 255): Color {
  return new Color(Math.max(0, Math.min(255, rgb[0] + brightness)), Math.max(0, Math.min(255, rgb[1] + brightness)), Math.max(0, Math.min(255, rgb[2] + brightness)), alpha);
}

function makeNode(parent: Node, name: string, x: number, y: number, width: number, height: number): Node {
  const result = new Node(name);
  result.layer = 1 << 25;
  parent.addChild(result);
  result.setPosition(new Vec3(x, y, 0));
  result.addComponent(UITransform).setContentSize(new Size(width, height));
  return result;
}

function text(parent: Node, name: string, value: string, x: number, y: number, width: number, height: number, size = 23, color = WHITE, centered = true): Label {
  const label = makeNode(parent, name, x, y, width, height).addComponent(Label);
  label.string = value;
  label.fontSize = size;
  label.lineHeight = Math.round(size * 1.2);
  label.horizontalAlign = centered ? Label.HorizontalAlign.CENTER : Label.HorizontalAlign.LEFT;
  label.verticalAlign = Label.VerticalAlign.CENTER;
  label.overflow = Label.Overflow.SHRINK;
  label.enableWrapText = true;
  label.color = color;
  return label;
}

function rect(g: Graphics, x: number, y: number, width: number, height: number, color: Color, stroke?: Color): void {
  g.fillColor = color;
  g.rect(x, y, width, height);
  g.fill();
  if (stroke !== undefined) {
    g.strokeColor = stroke;
    g.stroke();
  }
}

function ellipse(g: Graphics, x: number, y: number, width: number, height: number, fill?: Color, stroke?: Color): void {
  g.moveTo(x + width, y);
  for (let i = 1; i <= 32; i += 1) {
    const angle = i * Math.PI / 16;
    g.lineTo(x + Math.cos(angle) * width, y + Math.sin(angle) * height);
  }
  g.close();
  if (fill !== undefined) { g.fillColor = fill; g.fill(); }
  if (stroke !== undefined) { g.strokeColor = stroke; g.stroke(); }
}

function polygon(g: Graphics, points: readonly (readonly [number, number])[], fill: Color, stroke?: Color): void {
  const first = points[0];
  if (first === undefined) return;
  g.moveTo(first[0], first[1]);
  for (const point of points.slice(1)) g.lineTo(point[0], point[1]);
  g.close();
  g.fillColor = fill;
  g.fill();
  if (stroke !== undefined) { g.strokeColor = stroke; g.stroke(); }
}

function shadow(parent: Node, width: number, height: number): void {
  const g = makeNode(parent, 'GroundShadow', 0, -3, width * 2, height * 2).addComponent(Graphics);
  ellipse(g, 0, 0, width, height, new Color(8, 7, 6, 112));
  ellipse(g, 0, 0, width * 0.63, height * 0.65, new Color(5, 5, 4, 70));
}

/** Cover the visible world with one environment image, independently of gameplay bounds. */
function dungeonFloor(parent: Node, model: GameViewModel, options: ReadyWalkSceneOptions, viewportWidth: number, viewportHeight: number): void {
  const { spec } = options;
  const theme = spec.theme ?? HUB_WORLD_THEME;
  const width = Math.max(spec.width, viewportWidth);
  const height = Math.max(spec.height, viewportHeight);
  const backing = makeNode(parent, 'WalkDungeonFloor', spec.width / 2, -spec.height / 2, width, height).addComponent(Graphics);
  rect(backing, -width / 2, -height / 2, width, height, model.phase === 'hub' ? new Color(21, 23, 26, 255) : tint(theme.ground, -10));
  const key = getInfiniteFlowSceneVisualKeys(model).background;
  // Legacy combat without chapter context intentionally has only the plain backing.
  if (key === undefined) return;
  const visual = options.visual(key);
  const window = makeNode(parent, `WalkDungeonBackdropWindow:${key}`, spec.width / 2, -spec.height / 2, width, height);
  window.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
  const coverScale = Math.max(width / visual.width, height / visual.height);
  const artwork = makeNode(window, `WalkDungeonBackdrop:${key}`, 0, 0, visual.width * coverScale, visual.height * coverScale);
  const sprite = artwork.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = visual.frame;
  sprite.color = new Color(255, 255, 255, 255);
  options.trackSprite(sprite);
  if (model.phase === 'hub') {
    courtyardFilter(artwork, sprite, visual.frame, visual.width * coverScale, visual.height * coverScale, options);
    const atmosphere = makeNode(parent, 'WalkCourtyardAtmosphere', 0, 0, spec.width, spec.height).addComponent(Graphics);
    // Distant dark green haze and the shallow lane settle the art into the approved palette.
    for (let row = 0; row < 24; row += 1) {
      const y = row * 30;
      const opacity = y < 240 ? Math.round(25 * (1 - y / 240)) : y > 420 ? Math.round(18 + 52 * (y - 420) / 300) : 9;
      rect(atmosphere, 0, -y - 30, spec.width, 30, new Color(11, 21, 25, opacity));
    }
    rect(atmosphere, 0, -421, spec.width, 1, new Color(195, 184, 152, 9));
    for (let edge = 0; edge < 8; edge += 1) {
      const opacity = Math.round(100 * (1 - edge / 8));
      rect(atmosphere, edge * 8, -720, 8, 340, new Color(9, 14, 21, opacity));
      rect(atmosphere, spec.width - (edge + 1) * 8, -720, 8, 340, new Color(9, 14, 21, opacity));
    }
  }
}

/** The approved floor covers the entire surface, independently of room and camera. */
function fullscreenDungeonFloor(scene: Node, model: GameViewModel, options: ReadyWalkSceneOptions): void {
  const x = (options.safeInsets.right - options.safeInsets.left) / 2;
  const width = 750;
  const height = options.surfaceHeight;
  const theme = options.spec.theme ?? HUB_WORLD_THEME;
  const backing = makeNode(scene, 'WalkDungeonFloor', x, 0, width, height).addComponent(Graphics);
  rect(backing, -width / 2, -height / 2, width, height, tint(theme.ground, -10));
  const key = getInfiniteFlowSceneVisualKeys(model).background;
  if (key === undefined) return;
  const visual = options.visual(key);
  const window = makeNode(scene, `WalkDungeonBackdropWindow:${key}`, x, 0, width, height);
  window.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
  const scale = Math.max(width / visual.width, height / visual.height);
  const art = makeNode(window, `WalkDungeonBackdrop:${key}`, 0, 0, visual.width * scale, visual.height * scale);
  const sprite = art.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = visual.frame;
  options.trackSprite(sprite);
}

/** Built-in grayscale blending reproduces the courtyard's muted .54 saturation. */
function courtyardFilter(parent: Node, sprite: Sprite, frame: SpriteFrame, width: number, height: number, options: WalkSceneOptions): void {
  sprite.color = new Color(239, 240, 238, 255);
  const muted = makeNode(parent, 'WalkCourtyardDesaturation', 0, 0, width, height).addComponent(Sprite);
  muted.sizeMode = Sprite.SizeMode.CUSTOM;
  muted.spriteFrame = frame;
  muted.grayscale = true;
  muted.color = new Color(239, 240, 238, 117);
  options.trackSprite(muted);
}

const COURTYARD_PROP_ART: Readonly<Record<WorldProp['kind'], Readonly<{ width: number; height: number; bounds: readonly [number, number, number, number] }>>> = {
  pillar: { width: 870, height: 1808, bounds: [22, 93, 866, 1795] },
  crate: { width: 1457, height: 1080, bounds: [143, 272, 1352, 931] },
  lamp: { width: 930, height: 1691, bounds: [163, 69, 770, 1633] },
  altar: { width: 1500, height: 1049, bounds: [42, 61, 1459, 980] },
};

/** The visible alpha bounds, depth anchor, and solid foot box share one prop foot. */
function courtyardProp(parent: Node, prop: WorldProp, options: ReadyWalkSceneOptions): DepthItem {
  const base = makeNode(parent, `WalkCourtyardProp:${prop.kind}`, prop.x, -prop.y, prop.width, prop.height);
  shadow(base, prop.kind === 'altar' ? 70 : prop.kind === 'crate' ? 50 : 42.5, prop.kind === 'altar' ? 13 : 10);
  const visual = options.visual(prop.visualAssetKey);
  const source = COURTYARD_PROP_ART[prop.kind];
  const [left, top, right, bottom] = source.bounds;
  const scale = Math.min(prop.width / (right - left), prop.height / (bottom - top));
  const width = source.width * scale;
  const height = source.height * scale;
  const x = -(left + right - source.width) * scale / 2;
  const y = height / 2 - (source.height - bottom) * scale;
  const artwork = makeNode(base, `WalkCourtyardPropSprite:${prop.kind}`, x, y, width, height);
  const sprite = artwork.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = visual.frame;
  options.trackSprite(sprite);
  courtyardFilter(artwork, sprite, visual.frame, width, height, options);
  return { node: base, y: prop.y };
}

type DungeonPropKind = 'chest' | 'exit' | 'event' | 'trap' | 'survey' | 'relic' | 'shrine' | 'law' | 'debris';
type DungeonPropArt = Readonly<{
  key: string;
  width: number;
  height: number;
  bounds: readonly [number, number, number, number];
  display: readonly [number, number];
}>;

// Source alpha bounds and display boxes from the approved style-refresh prototype.
// Keeping full PNG dimensions avoids stretching or cropping the hand-painted art.
const DUNGEON_PROP_ART: Readonly<Record<DungeonPropKind, DungeonPropArt>> = {
  chest: { key: INFINITE_FLOW_DUNGEON_PROP_VISUAL_KEYS.propChest, width: 1254, height: 1254, bounds: [27, 222, 1230, 1146], display: [82, 72] },
  exit: { key: INFINITE_FLOW_DUNGEON_PROP_VISUAL_KEYS.propExit, width: 1145, height: 1374, bounds: [58, 48, 1085, 1321], display: [126, 171] },
  event: { key: INFINITE_FLOW_DUNGEON_PROP_VISUAL_KEYS.propEvent, width: 1254, height: 1254, bounds: [94, 8, 1144, 1245], display: [104, 127] },
  trap: { key: INFINITE_FLOW_DUNGEON_PROP_VISUAL_KEYS.propTrap, width: 1254, height: 1254, bounds: [22, 76, 1233, 1196], display: [108, 90] },
  survey: { key: INFINITE_FLOW_DUNGEON_PROP_VISUAL_KEYS.propSurvey, width: 1254, height: 1254, bounds: [68, 164, 1219, 1176], display: [111, 107] },
  relic: { key: INFINITE_FLOW_DUNGEON_PROP_VISUAL_KEYS.propRelic, width: 1254, height: 1254, bounds: [143, 68, 1123, 1209], display: [106, 122] },
  shrine: { key: INFINITE_FLOW_DUNGEON_PROP_VISUAL_KEYS.propShrine, width: 1254, height: 1254, bounds: [129, 110, 1125, 1114], display: [110, 132] },
  law: { key: INFINITE_FLOW_DUNGEON_PROP_VISUAL_KEYS.propLaw, width: 1254, height: 1254, bounds: [127, 23, 1164, 1231], display: [108, 128] },
  debris: { key: INFINITE_FLOW_DUNGEON_PROP_VISUAL_KEYS.propDebris, width: 1536, height: 1024, bounds: [34, 49, 1510, 955], display: [90, 93] },
};

/** Anchor visible alpha feet to the existing target/obstacle depth position. */
function drawDungeonProp(body: Node, kind: DungeonPropKind, options: ReadyWalkSceneOptions, display = DUNGEON_PROP_ART[kind].display): void {
  const source = DUNGEON_PROP_ART[kind];
  const visual = options.visual(source.key);
  const [left, top, right, bottom] = source.bounds;
  const scale = Math.min(display[0] / (right - left), display[1] / (bottom - top));
  const width = source.width * scale;
  const height = source.height * scale;
  const x = -(left + right - source.width) * scale / 2;
  const y = height / 2 - (source.height - bottom) * scale;
  const artwork = makeNode(body, `WalkDungeonPropSprite:${kind}`, x, y, width, height);
  const sprite = artwork.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = visual.frame;
  options.trackSprite(sprite);
}

/** Low debris stays within the existing solid footprints and shares their depth feet. */
function dungeonObstacle(parent: Node, obstacle: WorldRect, index: number, options: ReadyWalkSceneOptions): DepthItem {
  const foot = obstacle.y + obstacle.height;
  const item = makeNode(parent, `WalkObstacleFootprint:${index}`, obstacle.x + obstacle.width / 2, -foot, obstacle.width, obstacle.height + 8);
  const w = obstacle.width;
  const h = obstacle.height;
  if (w > 140 || h > 140) {
    // World bounds still block movement; their geometry must not stripe the full-screen art.
    return { node: item, y: foot };
  }
  drawDungeonProp(item, 'debris', options, [w, h]);
  return { node: item, y: foot };
}

/** Fit the selected artwork into the existing courtyard portal's world footprint. */
function drawHubDungeonPortal(body: Node, options: ReadyWalkSceneOptions): void {
  const visual = options.visual(INFINITE_FLOW_HUB_DUNGEON_PORTAL_VISUAL_KEY);
  const { x: scaleX, y: scaleY } = HUB_PORTAL_BODY_SCALE;
  const scale = Math.min(122 * scaleX / visual.width, 163 * scaleY / visual.height);
  // Compensate for the original body's uneven scale so the PNG stays proportional.
  const width = visual.width * scale / scaleX;
  const height = visual.height * scale / scaleY;
  const artwork = makeNode(body, 'WalkHubDungeonPortalSprite', 0, height / 2 - 8, width, height);
  const sprite = artwork.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = visual.frame;
  sprite.color = new Color(255, 255, 255, 255);
  options.trackSprite(sprite);
}

/** The recommended stone gate keeps the original transition's feet and footprint. */
function drawTransitionGate(body: Node, target: WorldTarget, options: ReadyWalkSceneOptions): void {
  const unavailable = target.disabledReason !== undefined;
  if (!unavailable) {
    const light = makeNode(body, 'WalkTransitionGroundLight', 0, -16, 116, 66).addComponent(Graphics);
    // Concentric translucent ellipses keep the warm guidance low on the floor.
    for (let ring = 5; ring > 0; ring -= 1) {
      const scale = ring / 5;
      ellipse(light, 0, 0, 58 * scale, 33 * scale, new Color(185, 155, 90, 10));
    }
  }
  const visual = options.visual(INFINITE_FLOW_DUNGEON_TRANSITION_GATE_VISUAL_KEY);
  const scale = options.dungeonView === undefined ? Math.min(122 / visual.width, 167 / visual.height)
    : options.dungeonView.gateHeight * options.dungeonView.worldPixel / visual.height;
  const width = visual.width * scale;
  const height = visual.height * scale;
  const artwork = makeNode(body, 'WalkTransitionGateSprite', 0, height / 2 - (options.dungeonView === undefined ? 8 : 0), width, height);
  const sprite = artwork.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = visual.frame;
  sprite.color = unavailable ? new Color(128, 128, 128, 255) : new Color(255, 255, 255, 255);
  sprite.grayscale = unavailable;
  options.trackSprite(sprite);
}

/** Keep the artwork's bottom on the same world feet used for depth and interaction. */
function drawNpcBody(body: Node, target: WorldTarget, options: ReadyWalkSceneOptions): void {
  const key = getInfiniteFlowNpcWorldVisualKey(target.id);
  if (key === undefined) throw new Error(`Walk scene NPC art is not declared: ${target.id}`);
  const visual = options.visual(key);
  const sizes: Readonly<Record<string, readonly [number, number]>> = {
    'npc:equipment': [190, 7], 'npc:supplies': [180, 5], 'npc:pets': [184, 5],
    'npc:methods': [190, 3], 'npc:bloodlines': [187, 6], 'npc:companions': [188, 7], 'npc:tasks': [194, 6],
  };
  const hubSize = options.spec.key === 'hub' ? sizes[target.id] : undefined;
  const scale = hubSize === undefined ? Math.min(104 / visual.width, 124 / visual.height) : hubSize[0] / visual.height;
  const width = visual.width * scale;
  const height = visual.height * scale;
  body.setPosition(new Vec3(0, height / 2 - (hubSize?.[1] ?? 0), 0));
  body.getComponent(UITransform)!.setContentSize(new Size(width, height));
  const sprite = body.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = visual.frame;
  sprite.color = new Color(255, 255, 255, 255);
  options.trackSprite(sprite);
}

function targetActor(parent: Node, target: WorldTarget, model: GameViewModel, options: ReadyWalkSceneOptions): DepthItem {
  const courtyard = model.phase === 'hub';
  const pixel = options.dungeonView?.worldPixel;
  const base = makeNode(parent, `WalkTarget:${target.id}`, target.x, -target.y, courtyard && target.kind === 'portal' ? 160 : 150, courtyard && target.kind === 'portal' ? 220 : 190);
  shadow(base, pixel === undefined ? target.kind === 'monster' ? 56 : target.kind === 'npc' ? courtyard ? 41 : 26 : courtyard ? 81 : 61
    : (target.kind === 'monster' ? 27 : 21) * pixel, pixel === undefined ? target.kind === 'npc' ? 10 : 16 : 3.5 * pixel);
  const body = makeNode(base, 'WorldObjectBody', 0, 0, 150, 175);
  if (target.kind === 'npc') drawNpcBody(body, target, options);
  else drawTargetObject(body, base, target, model, options);
  if (courtyard) {
    if (target.kind === 'portal') body.setScale(new Vec3(HUB_PORTAL_BODY_SCALE.x, HUB_PORTAL_BODY_SCALE.y, 1));
    text(base, 'WalkTargetName', target.label, 0, target.kind === 'portal' ? 255 : 222, 192, 26, target.kind === 'portal' ? 17 : 14, new Color(239, 222, 176, 255));
    if (target.purpose !== undefined) text(base, 'WalkTargetPurpose', target.purpose, 0, 204, 192, 22, 11, new Color(206, 200, 183, 255));
    if (target.kind === 'portal') text(base, 'WalkTargetPurpose', '进入副本', 0, 232, 192, 22, 11, new Color(180, 216, 210, 255));
    return { node: base, y: target.y };
  }
  const compact = options.dungeonView?.compactLabels ?? false;
  const nameWidth = pixel === undefined ? target.kind === 'monster' ? 260 : 192 : (target.kind === 'monster' ? compact ? 100 : 110 : compact ? 78 : 84) * pixel;
  const nameHeight = pixel === undefined ? 35 : (compact ? 23 : 25) * pixel;
  const nameY = pixel === undefined ? -26 : -(compact ? 8.5 : 9.5) * pixel;
  const nameX = 0;
  if (target.kind === 'npc' || model.phase === 'explore' || model.phase === 'combat') {
    const nameBacking = makeNode(base, 'WalkTargetNameBacking', nameX, nameY, nameWidth, nameHeight).addComponent(Graphics);
    nameBacking.lineWidth = 1;
    const cut = pixel === undefined ? 5 : 2 * pixel;
    polygon(nameBacking, [[-nameWidth / 2 + cut, -nameHeight / 2], [nameWidth / 2 - cut, -nameHeight / 2], [nameWidth / 2, -nameHeight / 2 + cut], [nameWidth / 2, nameHeight / 2 - cut], [nameWidth / 2 - cut, nameHeight / 2], [-nameWidth / 2 + cut, nameHeight / 2], [-nameWidth / 2, nameHeight / 2 - cut], [-nameWidth / 2, -nameHeight / 2 + cut]], new Color(16, 13, 10, 200), DARK_UI.edge);
  }
  text(base, 'WalkTargetName', `${target.rank === 'boss' ? '首领 · ' : target.rank === 'elite' ? '精英 · ' : ''}${target.label}`, nameX, nameY, nameWidth, nameHeight, pixel === undefined ? 21 : (compact ? 12 : 13) * pixel, target.disabledReason === undefined ? DARK_UI.bone : DARK_UI.muted);
  if (target.kind === 'transition') {
    const stateY = pixel === undefined ? -54 : compact && target.doorSide === 'south' ? 12 * pixel : -(compact ? 27 : 30) * pixel;
    text(base, 'WalkTransitionState', target.action === undefined ? '封闭' : target.disabledReason === undefined ? '入口畅通' : '入口未开放', nameX, stateY, pixel === undefined ? 192 : (compact ? 78 : 84) * pixel, pixel === undefined ? 24 : (compact ? 14 : 16) * pixel, pixel === undefined ? 16 : (compact ? 9 : 10) * pixel, target.disabledReason === undefined ? new Color(209, 225, 207, 255) : DARK_UI.muted);
  }
  return { node: base, y: target.y };
}

function drawTargetObject(body: Node, base: Node, target: WorldTarget, model: GameViewModel, options: ReadyWalkSceneOptions): void {
  if (model.phase === 'hub' && target.kind === 'portal') {
    drawHubDungeonPortal(body, options);
    return;
  }
  if (target.kind === 'transition') {
    drawTransitionGate(body, target, options);
    return;
  }
  if (target.kind === 'monster') {
    if (target.visualAssetKey === undefined) throw new Error(`Walk scene monster art is not declared: ${target.id}`);
    const visual = options.visual(target.visualAssetKey);
    const pixel = options.dungeonView?.worldPixel;
    const displaySize = pixel === undefined ? 156 : options.dungeonView!.monsterHeight * pixel;
    const scale = pixel === undefined ? Math.min(displaySize / visual.width, displaySize / visual.height) : displaySize / visual.height;
    const width = visual.width * scale;
    const height = visual.height * scale;
    // The body wrapper stays at the feet: combat recoil moves and resets it.
    const art = makeNode(body, `WalkMonsterSprite:${target.visualAssetKey}`, 0, height * (pixel === undefined ? 0.43 : 0.5), width, height);
    const sprite = art.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.spriteFrame = visual.frame;
    sprite.color = new Color(255, 255, 255, 255);
    options.trackSprite(sprite);
    if (target.rank === 'boss' || target.rank === 'elite') {
      const rank = makeNode(base, 'WalkEnemyRank', 0, pixel === undefined ? target.rank === 'boss' ? 186 : 161 : height * 0.93 + 5 * pixel, 112, 48).addComponent(Graphics);
      if (target.rank === 'boss') polygon(rank, [[-28, -10], [-36, 20], [-16, 7], [0, 30], [16, 7], [36, 20], [28, -10]], GOLD, RED);
      else polygon(rank, [[0, 19], [15, 0], [0, -19], [-15, 0]], GOLD, INK);
      if (pixel === undefined) bodyRankScale(body, target.rank);
      else {
        rank.node.setScale(new Vec3(0.22 * pixel, 0.22 * pixel, 1));
        rank.node.setPosition(new Vec3(width * 0.46, height * 0.82, 0));
      }
    }
    const detail = model.sections[1].detail;
    if (detail.kind === 'combat') {
      const healthY = pixel === undefined ? target.rank === 'boss' ? 231 : target.rank === 'elite' ? 205 : 183 : Math.min(height * 0.74, options.dungeonView!.monsterHudTop);
      const healthWidth = pixel === undefined ? 142 : 64 * pixel;
      const healthHeight = pixel === undefined ? 12 : 4 * pixel;
      const healthInset = pixel === undefined ? 3 : pixel;
      const health = makeNode(base, 'WalkEnemyHealth', 0, healthY, healthWidth, healthHeight).addComponent(Graphics);
      rect(health, -healthWidth / 2, -healthHeight / 2, healthWidth, healthHeight, INK, EDGE);
      rect(health, -healthWidth / 2 + healthInset, -healthHeight / 2 + healthInset, (healthWidth - healthInset * 2) * detail.enemy.hpPercent / 100, healthHeight - healthInset * 2, RED);
      // A tall boss reaches the round banner; keep its readout beside the bar.
      const bossReadout = pixel === undefined && target.rank === 'boss';
      text(base, 'WalkEnemyHealthLabel', `${detail.enemy.hp} / ${detail.enemy.maxHp}`,
        bossReadout ? -145 : 0, pixel === undefined ? bossReadout ? healthY - 15 : healthY + 20 : healthY + 9 * pixel,
        pixel === undefined ? bossReadout ? 140 : 174 : 90 * pixel, pixel === undefined ? 25 : 14 * pixel, pixel === undefined ? 18 : 10 * pixel, WHITE);
    }
    return;
  }
  const propKind = target.kind === 'portal' ? 'exit' : target.kind;
  if (!(propKind in DUNGEON_PROP_ART)) throw new Error(`Walk scene target art is not declared: ${target.kind}`);
  drawDungeonProp(body, propKind as DungeonPropKind, options);
  if (options.dungeonView !== undefined) {
    const prop = DUNGEON_PROP_ART[propKind as DungeonPropKind];
    const visibleHeight = Math.min(prop.display[0] / (prop.bounds[2] - prop.bounds[0]), prop.display[1] / (prop.bounds[3] - prop.bounds[1])) * (prop.bounds[3] - prop.bounds[1]);
    const presentationScale = (propKind === 'chest' ? 84 : propKind === 'trap' ? 80 : 108) * options.dungeonView.worldPixel / visibleHeight;
    body.setScale(new Vec3(presentationScale, presentationScale, 1));
  }
}

function bodyRankScale(body: Node, rank: 'boss' | 'elite'): void {
  const scale = rank === 'boss' ? 1.3 : 1.12;
  body.setScale(new Vec3(scale, scale, 1));
}

function button(parent: Node, name: string, label: string, x: number, y: number, diameter: number, enabled = true, accent = DARK_UI.edgeLight, icon?: Parameters<typeof paintDarkIcon>[1]): Node {
  const base = makeNode(parent, name, x, y, diameter, diameter);
  const g = base.addComponent(Graphics);
  paintDarkFrame(g, diameter, diameter, { fill: enabled ? WALK_HUD.raised : WALK_HUD.quiet, edge: enabled ? WALK_HUD.edgeLight : WALK_HUD.edge, accent: enabled ? accent : WALK_HUD.edge, cut: 11 });
  const title = text(base, `${name}Label`, label, 0, icon === undefined ? 0 : -29, diameter - 12, icon === undefined ? diameter - 20 : 30, 22, enabled ? WALK_HUD.text : WALK_HUD.muted);
  title.enableWrapText = false;
  if (icon !== undefined) {
    const mark = makeNode(base, `${name}Icon`, 0, label.length === 0 ? 0 : 12, 55, 46).addComponent(Graphics);
    paintDarkIcon(mark, icon, enabled ? accent : DARK_UI.muted);
  }
  return base;
}

/** Direct paths from hud-menu-draw/app.js, with its SVG 48×48 coordinates flipped for Cocos. */
function paintInkDotIcon(g: Graphics, icon: 'character' | 'bag' | 'map' | 'target' | 'menu', viewportWidth: number): void {
  const scale = (20 * 750 / viewportWidth) / 48;
  const x = (value: number): number => (value - 24) * scale;
  const y = (value: number): number => (24 - value) * scale;
  const move = (sx: number, sy: number): void => g.moveTo(x(sx), y(sy));
  const line = (sx: number, sy: number): void => g.lineTo(x(sx), y(sy));
  const curve = (c1x: number, c1y: number, c2x: number, c2y: number, sx: number, sy: number): void =>
    g.bezierCurveTo(x(c1x), y(c1y), x(c2x), y(c2y), x(sx), y(sy));
  g.clear();
  g.strokeColor = INK_DOT_HUD.icon;
  // Creator's stroke AA loses subpixel lines; preserve the SVG path at >= 1.5 screen pixels.
  g.lineWidth = Math.max(2 * scale, 1.5 * 750 / viewportWidth);
  g.lineCap = Graphics.LineCap.ROUND;
  g.lineJoin = Graphics.LineJoin.ROUND;
  if (icon === 'character') {
    move(21, 9); curve(18, 5, 29, 2, 29, 7);
    move(17, 17); curve(17, 7, 31, 7, 31, 17); line(31, 22); curve(30, 29, 18, 29, 17, 22); g.close();
    move(18, 29); line(11, 34); line(8, 42);
    move(30, 29); line(37, 34); line(40, 42);
    move(17, 33); line(24, 39); line(31, 33);
  } else if (icon === 'menu') {
    move(24, 11); curve(18, 8, 12, 7, 6, 9); line(6, 40);
    curve(12, 38, 18, 39, 24, 42); curve(30, 39, 36, 38, 42, 40); line(42, 9);
    curve(36, 7, 30, 8, 24, 11); g.close();
    move(24, 11); line(24, 42);
    move(12, 17); line(18, 19); move(12, 26); line(18, 28);
    move(30, 19); line(36, 17); move(30, 28); line(36, 26);
  } else if (icon === 'bag') {
    move(17, 13); line(13, 7); line(24, 9); line(35, 7); line(31, 13);
    move(16, 17); line(32, 17);
    move(17, 19); curve(9, 27, 8, 32, 11, 39); curve(16, 45, 32, 45, 37, 39); curve(40, 32, 39, 27, 31, 19);
    move(18, 15); line(11, 19); move(30, 15); line(37, 20); move(24, 18); line(24, 28);
  } else if (icon === 'map') {
    move(7, 9); line(18, 13); line(30, 8); line(41, 12); line(41, 41); line(30, 37); line(18, 42); line(7, 38); g.close();
    move(18, 13); line(18, 42); move(30, 8); line(30, 37); move(22, 25); line(26, 20); line(34, 26);
  } else {
    move(12, 10); line(35, 10); line(35, 41); line(12, 41); g.close();
    move(16, 10); line(16, 6); line(31, 6); line(31, 10);
    move(17, 20); line(30, 20); move(17, 27); line(30, 27); move(17, 34); line(25, 34);
    move(9, 15); line(6, 15); line(6, 42); line(29, 42); line(29, 41);
  }
  g.stroke();
  if (icon === 'map') {
    g.circle(x(26), y(20), 2 * scale);
    g.stroke();
  }
}

/** Main and dungeon-only shortcuts use the same icon, caption and touch geometry. */
function headerButton(scene: Node, name: string, label: string, icon: 'bag' | 'map' | 'target' | 'menu', column: number, row: number, options: WalkSceneOptions, top: number): Node {
  const px = 750 / (options.viewportWidth ?? 320);
  const narrow = (options.viewportWidth ?? 320) <= 350;
  const base = makeNode(scene, name, 375 - ((narrow ? 67 : 71) - (narrow ? 44 : 46) * column) * px, top - (27 + 44 * row) * px, 44 * px, 44 * px);
  const mark = makeNode(base, `${name}Icon`, 0, 5 * px, 20 * px, 20 * px).addComponent(Graphics);
  paintInkDotIcon(mark, icon, options.viewportWidth ?? 320);
  inkDotTextShadow(text(base, `${name}Label`, label, 0, -12 * px, 42 * px, 13 * px, 10 * px, WALK_HUD.gold));
  return base;
}

function paintPlayerHealth(g: Graphics, hp: number, maxHp: number, width: number, height: number): void {
  g.clear();
  rect(g, -width / 2, -height / 2, width, height, WALK_HUD.healthTrack, WALK_HUD.edge);
  rect(g, -width / 2, -height / 2, width * Math.max(0, Math.min(1, hp / maxHp)), height, WALK_HUD.health);
}

function inkDotTextShadow(label: Label): void {
  label.enableShadow = true;
  label.shadowColor = INK_DOT_HUD.shadow;
  label.shadowOffset = new Vec2(0, -1);
  label.shadowBlur = 2;
}

/** The same portrait crop is used in the courtyard, exploration, and combat. */
function hudPortrait(avatar: Node, options: ReadyWalkSceneOptions, width: number, height: number): void {
  const portrait = options.visual('character:reincarnator');
  const crop = makeNode(avatar, 'WalkAvatarCrop', 0, 0, width, height);
  crop.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
  const scale = Math.max(width / portrait.width, height / portrait.height);
  const artwork = makeNode(crop, 'WalkAvatarArt', 0, -(portrait.height * scale - height) * 0.33, portrait.width * scale, portrait.height * scale).addComponent(Sprite);
  // Set CUSTOM first: assigning a frame in TRIMMED mode resets the cover size.
  artwork.sizeMode = Sprite.SizeMode.CUSTOM;
  artwork.spriteFrame = portrait.frame;
  options.trackSprite(artwork);
}

/** Currency glyphs use the same 24×24 paths as the approved prototype. */
function paintHudCurrency(g: Graphics, kind: 'reward-points' | 'lingyun', pixel: number, color: Color): void {
  const scale = 13 * pixel / 24;
  const point = (x: number, y: number): readonly [number, number] => [(x - 12) * scale, (12 - y) * scale];
  const path = (points: readonly (readonly [number, number])[]): void => {
    g.moveTo(...point(...points[0]!));
    for (const value of points.slice(1)) g.lineTo(...point(...value));
    g.close();
  };
  g.strokeColor = color;
  g.fillColor = new Color(144, 129, 73, 38);
  g.lineWidth = 1.5 * scale;
  if (kind === 'reward-points') g.circle(0, 0, 8.5 * scale);
  else path([[12, 3], [18, 7], [19, 15], [12, 21], [5, 15], [6, 7]]);
  g.fill(); g.stroke();
  path(kind === 'reward-points' ? [[12, 7], [16, 12], [12, 17], [8, 12]] : [[12, 7], [15, 12], [12, 17], [9, 12]]);
  g.stroke();
}

function sharedHeader(scene: Node, model: GameViewModel, options: ReadyWalkSceneOptions, top: number): void {
  const layout = getWalkHudLayout(options.viewportWidth ?? 320);
  const px = layout.pixel;
  const roleLeft = 9;
  const roleWidth = (layout.infoLeft + layout.infoWidth - roleLeft) * px;
  const role = makeNode(scene, 'WalkHud', -375 + roleLeft * px + roleWidth / 2, top - 48 * px, roleWidth, 96 * px);
  const x = (left: number, width: number): number => (left + width / 2 - roleLeft) * px - roleWidth / 2;
  const y = (top: number, height: number): number => (48 - top - height / 2) * px;
  const avatar = makeNode(role, 'SceneCharacter', x(layout.portraitLeft, layout.portraitWidth), y(13, 61), 44 * px, 61 * px);
  const frame = avatar.addComponent(Graphics);
  frame.lineWidth = px;
  rect(frame, -layout.portraitWidth * px / 2, -30.5 * px, layout.portraitWidth * px, 61 * px,
    new Color(16, 25, 16, 255), new Color(138, 128, 80, 99));
  hudPortrait(avatar, options, (layout.portraitWidth - 2) * px, 59 * px);
  inkDotTextShadow(text(avatar, 'SceneCharacterLabel', '角色', 0, -21 * px, (layout.portraitWidth - 2) * px, 18 * px, 10 * px, WALK_HUD.gold));
  options.bindLocal(avatar, () => options.openPanel === undefined ? options.openDetails() : options.openPanel('character'));
  inkDotTextShadow(text(role, 'WalkRoleName', '轮回者', x(layout.infoLeft, layout.nameWidth), y(13, 20), layout.nameWidth * px, 20 * px,
    (layout.narrow ? 12 : 13) * px, new Color(237, 233, 212, 255), false));
  const metrics = model.sections[1].metrics;
  const detail = model.sections[1].detail;
  const hp = detail.kind === 'combat' ? `${detail.player.hp}/${detail.player.maxHp}` : metrics.find(({ id }) => id === 'hp')?.value;
  const captionWidth = layout.narrow ? 0 : 27;
  if (!layout.narrow) inkDotTextShadow(text(role, 'WalkHealthCaption', '生命', x(layout.infoLeft, 22), y(35, 16), 22 * px, 16 * px, 10 * px,
    new Color(216, 222, 198, 255), false));
  inkDotTextShadow(text(role, 'WalkPlayerStatus', hp ?? '—', x(layout.infoLeft + captionWidth, layout.healthWidth - captionWidth), y(35, 16),
    (layout.healthWidth - captionWidth) * px, 16 * px, (layout.narrow ? 11 : 12) * px, new Color(238, 229, 201, 255), false));
  const split = hp?.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (split !== undefined && split !== null && Number(split[2]) > 0) {
    const health = makeNode(role, 'WalkPlayerHealth', x(layout.infoLeft, layout.healthWidth), y(53, 3), layout.healthWidth * px, 3 * px).addComponent(Graphics);
    paintPlayerHealth(health, Number(split[1]), Number(split[2]), layout.healthWidth * px, 3 * px);
  }
  const currency = makeNode(role, 'WalkCurrencyReadout', 0, 0, roleWidth, 96 * px);
  for (const [kind, name, left, width, color] of [
    ['reward-points', 'WalkRewardPoints', layout.rewardLeft, layout.rewardWidth, new Color(224, 194, 127, 255)],
    ['lingyun', 'WalkLingyun', layout.jadeLeft, layout.jadeWidth, new Color(182, 208, 168, 255)],
  ] as const) {
    const metric = metrics.find(({ id }) => id === kind);
    // Invalid/legacy combat projections intentionally omit metrics. Show the
    // established unavailable marker, and do not expose a fabricated balance.
    const value = metric?.value ?? '—';
    const resource = makeNode(currency, name, x(left, width), y(1, 44), width * px, 44 * px);
    const size = layout.narrow ? 10 : 11;
    const valueWidth = Math.min(width - 18, value.length * size * 0.65);
    const contentWidth = 16 + valueWidth;
    const glyph = makeNode(resource, `${name}Icon`, (-contentWidth / 2 + 6.5) * px, 0, 13 * px, 13 * px).addComponent(Graphics);
    paintHudCurrency(glyph, kind, px, color);
    const label = text(resource, `${name}Value`, value, 8 * px, 0, valueWidth * px, 20 * px, size * px, color);
    label.enableWrapText = false;
    inkDotTextShadow(label);
    if (metric !== undefined) options.bindLocal(resource, () => options.openHudPopover?.(kind));
  }
  const owned = model.phase === 'explore' || model.phase === 'combat' ? model.sections[1].loadout?.runRelics ?? [] : [];
  if (owned.length > 0) {
    const width = Math.max(44, owned.length * 24);
    const strip = makeNode(role, 'WalkRunRelics', x(layout.infoLeft - 3, width), y(49, 44), width * px, 44 * px);
    const selected = options.activeHudPopover === 'relics';
    owned.forEach((relic, index) => {
      const tile = makeNode(strip, `WalkRunRelicIcon:${relic.relicId}`, (-width / 2 + 12 + index * 24) * px, 0, 18 * px, 18 * px);
      const edge = tile.addComponent(Graphics);
      edge.lineWidth = px;
      rect(edge, -9 * px, -9 * px, 18 * px, 18 * px, new Color(16, 19, 13, 255),
        selected ? new Color(242, 209, 151, 255) : new Color(188, 161, 107, 153));
      const sprite = makeNode(tile, `WalkRunRelicSprite:${relic.relicId}`, 0, 0, 16 * px, 16 * px).addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      sprite.trim = false;
      sprite.spriteFrame = options.visual(getInfiniteFlowRunRelicVisualKey(relic.relicId)).frame;
      options.trackSprite(sprite);
    });
    if (selected) {
      const marker = strip.addComponent(Graphics);
      polygon(marker, [[0, -17 * px], [1.5 * px, -18.5 * px], [0, -20 * px], [-1.5 * px, -18.5 * px]], new Color(227, 193, 123, 255));
    }
    options.bindLocal(strip, () => options.openHudPopover?.('relics'));
  }
  for (const [name, label, icon, column] of [
    ['SceneDetails', '背包', 'bag', 0], ['SceneHelp', '菜单', 'menu', 1],
  ] as const) {
    const base = headerButton(scene, name, label, icon, column, 0, options, top);
    if (name === 'SceneHelp' && options.openPanel === undefined) options.bindHelp(base);
    else options.bindLocal(base, () => name === 'SceneDetails'
      ? options.openPanel === undefined ? options.openDetails() : options.openPanel('inventory')
      : options.openPanel?.('menu'));
  }
  const mode = options.chrome.busyActionId !== undefined ? '行动中…' : options.chrome.modeKind === 'preview' || options.chrome.modeKind === 'wx-devtools' ? '临时试玩 · 刷新丢失进度' : '';
  if (model.phase === 'hub' && mode.length > 0) text(scene, 'WalkMode', mode, -375 + 10 * px + roleWidth / 2, top - 85 * px, roleWidth, 17 * px, 8 * px, DARK_UI.muted, false);
}

function courtyardMinimap(scene: Node, spec: WalkWorldSpec, options: WalkSceneOptions, top: number): Node {
  const px = 750 / (options.viewportWidth ?? 320);
  const width = ((options.viewportWidth ?? 320) <= 380 ? 94 : 108) * px;
  const height = 44 * px;
  const map = makeNode(scene, 'WalkMinimap', 375 - 10 * px - width / 2, top - 84 * px, width, height);
  const g = map.addComponent(Graphics);
  rect(g, -width / 2, -height / 2, width, height, HUD_WASH);
  g.lineWidth = px;
  const bounds = spec.bounds!;
  rect(g, -width / 2 + bounds.x / spec.width * width, height / 2 - (bounds.y + bounds.height) / spec.height * height,
    bounds.width / spec.width * width, bounds.height / spec.height * height, new Color(173, 188, 186, 11), new Color(159, 174, 164, 25));
  for (const target of spec.targets) {
    const x = -width / 2 + target.x / spec.width * width;
    const y = height / 2 - target.y / spec.height * height;
    if (target.kind === 'portal') polygon(g, [[x, y + 3 * px], [x + 3 * px, y], [x, y - 3 * px], [x - 3 * px, y]], new Color(152, 236, 223, 255));
    else ellipse(g, x, y, 2 * px, 2 * px, new Color(198, 184, 138, 255));
  }
  const player = makeNode(map, 'WalkMinimapPlayer', -width / 2 + options.position.x / spec.width * width, height / 2 - options.position.y / spec.height * height, 5 * px, 5 * px);
  const dot = player.addComponent(Graphics);
  ellipse(dot, 0, 0, 4.5 * px, 4.5 * px, new Color(220, 187, 86, 102));
  ellipse(dot, 0, 0, 2.5 * px, 2.5 * px, new Color(255, 245, 190, 255), new Color(255, 249, 223, 255));
  return player;
}

function header(scene: Node, model: GameViewModel, options: ReadyWalkSceneOptions, top: number): void {
  sharedHeader(scene, model, options, top);
  if (model.phase === 'hub') return;
  const detail = model.sections[1].detail;
  const metrics = model.sections[1].metrics;
  const px = 750 / (options.viewportWidth ?? 320);
  const roleWidth = Math.min((options.viewportWidth ?? 320) - 124, 244) * px;
  const riskReadouts = detail.kind === 'combat'
    ? [`第 ${detail.turn} 回合`, `意图：${detail.intent.name}`,
      ...(detail.chapterContext?.law.severity === 'danger' || detail.chapterContext?.law.severity === 'warning' ? [`法则${detail.chapterContext.law.severity === 'danger' ? '危险' : '警戒'}`] : []),
      ...(detail.chapterContext?.pursuit.status === 'fused' ? ['追兵融合'] : detail.chapterContext?.pursuit.status === 'stalking' ? ['追兵追踪'] : [])]
    : metrics.filter(({ id }) => ['pressure', 'boss-seal', 'law'].includes(id)).map((metric) => metric.id === 'boss-seal'
      ? metric.severity === 'positive' ? '封印已解' : '出口封印'
      : metric.id === 'law' ? `法则：${metric.severity === 'danger' ? '危险' : metric.severity === 'warning' ? '警戒' : metric.severity === 'positive' ? '已稳定' : '稳定'}`
        : `侵蚀：${metric.value}`);
  if (riskReadouts.length > 0) {
    const danger = detail.kind === 'combat' ? detail.intent.severity === 'danger' || detail.chapterContext?.law.severity === 'danger'
      : metrics.some(({ id, severity }) => ['hp', 'pressure', 'law'].includes(id) && severity === 'danger');
    const strip = makeNode(scene, 'WalkRiskSummary', -375 + 10 * px + roleWidth / 2, top - 94 * px, roleWidth, 24 * px);
    rect(strip.addComponent(Graphics), -roleWidth / 2, -12 * px, roleWidth, 24 * px, HUD_WASH);
    inkDotTextShadow(text(strip, 'WalkRiskReadout', riskReadouts.join(' · '), 0, 0, roleWidth - 12 * px, 24 * px, 9 * px, danger ? DARK_UI.red : DARK_UI.bone, false));
  }
}

function combatControls(scene: Node, model: GameViewModel, options: WalkSceneOptions, bottom: number): void {
  if (model.phase !== 'combat') return;
  const pixel = 750 / (options.viewportWidth ?? 320);
  const right = 375 - (options.safeInsets.left + options.safeInsets.right) / 2;
  const left = -right;
  const actions = model.sections[2].actions;
  const weapon = actions.find(action => action.combatAction === 'weapon_skill' && action.enabled && action.event !== undefined);
  const attack = weapon ?? actions.find(action => action.combatAction === 'attack');
  const busy = options.chrome.busyActionId !== undefined || options.chrome.modeKind === 'blocked';
  const x = (column: number): number => right - (130 - 50 * column) * pixel;
  const y = (row: number): number => bottom + (92 - 52 * row) * pixel;
  const decorate = (node: Node, name: string): void => {
    const mark = node.getChildByName(`${name}Icon`);
    mark?.setScale(new Vec3(16 * pixel / 46, 16 * pixel / 46, 1));
    mark?.setPosition(new Vec3(0, 8 * pixel, 0));
    const title = node.getChildByName(`${name}Label`);
    title?.setPosition(new Vec3(0, -10 * pixel, 0));
    const label = title?.getComponent(Label);
    if (label != null) {
      label.fontSize = 10 * pixel;
      label.lineHeight = 12 * pixel;
      title!.getComponent(UITransform)!.setContentSize(new Size(42 * pixel, 14 * pixel));
    }
  };
  // Six 44 CSS-pixel actions fit in two rows above the safe bottom edge.
  for (const [row, group] of (['spells', 'medicines'] as const).entries()) {
    const name = `WalkCombatChoice:${group}`;
    const choice = button(scene, name, group === 'spells' ? '法术' : '药品', x(0), y(row), 44 * pixel,
      !busy, DARK_UI.gold, group === 'spells' ? 'arcane' : 'bag');
    decorate(choice, name);
    if (!busy) options.bindLocal(choice, () => options.openCombatChoices(group));
  }
  const slots = [
    { action: attack, label: '攻击', column: 1, row: 0, icon: 'sword' as const },
    { action: actions.find(action => action.combatAction === 'guard'), label: '防御', column: 2, row: 0, icon: 'guard' as const },
    { action: actions.find(action => action.combatAction === 'use_thunder_talisman'), label: '雷火符', column: 1, row: 1, icon: 'arcane' as const },
    { action: actions.find(action => action.combatAction === 'escape'), label: '脱离战斗', column: 2, row: 1, icon: 'left' as const },
  ];
  for (const { action, label, column, row, icon } of slots) {
    if (action === undefined) continue;
    const ready = action.enabled && action.event !== undefined && !busy;
    const accent = action === weapon || action.recommendation === 'recommended' ? DARK_UI.gold
      : action.emphasis === 'danger' ? DARK_UI.red : DARK_UI.muted;
    const name = `WalkCombatAction:${action.actionId}`;
    const actionNode = button(scene, name, label, x(column), y(row), 44 * pixel, ready, accent, icon);
    decorate(actionNode, name);
    if (action === attack) {
      actionNode.getChildByName(`${name}Label`)?.setPosition(new Vec3(0, -5 * pixel, 0));
      text(actionNode, 'WalkCombatAttackMode', weapon === undefined ? '普攻' : '战技', 0, -16 * pixel, 40 * pixel, 12 * pixel, 8 * pixel, ready ? accent : DARK_UI.muted);
    }
    options.bindAction(actionNode, action);
  }
  const detail = model.sections[1].detail;
  if (detail.kind === 'combat') text(scene, 'WalkCombatFocus', `战意\n${detail.focus.current} / ${detail.focus.required}`,
    left + 134 * pixel, bottom + 88 * pixel, 60 * pixel, 38 * pixel, 10 * pixel, weapon === undefined ? DARK_UI.muted : DARK_UI.gold);
}

/** Creates one persistent world. tick moves actors/camera and never recreates the root. */
export function renderInfiniteFlowWalkScene(root: Node, model: GameViewModel, sceneOptions: WalkSceneOptions): WalkSceneHandle {
  const readyOptions = readyWalkSceneOptions(sceneOptions, model);
  const roomFit = model.phase === 'explore' || model.phase === 'combat' ? getDungeonHtmlRoomLayout({
    worldWidth: readyOptions.spec.width, worldHeight: readyOptions.spec.height,
    surfaceHeight: readyOptions.surfaceHeight, viewportWidth: readyOptions.viewportWidth ?? 320, safeInsets: readyOptions.safeInsets,
  }) : undefined;
  const options: ReadyWalkSceneOptions = roomFit === undefined ? readyOptions : { ...readyOptions, spec: fitDungeonHtmlTargets(readyOptions.spec, roomFit), dungeonView: {
    worldPixel: roomFit.hudPixel, gateHeight: roomFit.artwork.gateHeight, monsterHeight: roomFit.artwork.monsterHeight,
    monsterHudTop: roomFit.targetFeet.north.y - roomFit.targetFeet.main.y - (roomFit.artwork.compact ? 54 : 58) * roomFit.hudPixel,
    compactLabels: roomFit.artwork.compact,
  } };
  const { spec } = options;
  const courtyard = model.phase === 'hub';
  const hudPixel = 750 / (options.viewportWidth ?? 320);
  const halfSurface = options.surfaceHeight / 2;
  const scene = makeNode(root, 'WalkScene', (options.safeInsets.left - options.safeInsets.right) / 2, 0, 750, options.surfaceHeight);
  const top = halfSurface - options.safeInsets.top;
  const bottom = -halfSurface + options.safeInsets.bottom;
  const safeHeight = options.surfaceHeight - options.safeInsets.top - options.safeInsets.bottom;
  const viewportHeight = roomFit?.roomRect.height ?? options.surfaceHeight;
  const viewportWidth = roomFit?.roomRect.width ?? 750;
  const viewportCenter = roomFit === undefined ? { x: (options.safeInsets.right - options.safeInsets.left) / 2, y: 0 }
    : { x: roomFit.roomRect.x + viewportWidth / 2, y: roomFit.roomRect.y + viewportHeight / 2 };
  const cameraOffset = roomFit === undefined ? { x: 0, y: 0 } : { x: roomFit.offset.x - viewportCenter.x, y: roomFit.offset.y - viewportCenter.y };
  const worldZoom = courtyard ? safeHeight / spec.height : WORLD_ZOOM;
  const cameraScale = roomFit?.scale ?? { x: worldZoom, y: worldZoom };
  const actorScale = roomFit === undefined ? undefined : { x: 1 / cameraScale.x, y: 1 / cameraScale.y };
  if (roomFit !== undefined) fullscreenDungeonFloor(scene, model, options);
  const viewport = makeNode(scene, 'WalkViewport', viewportCenter.x, viewportCenter.y, viewportWidth, viewportHeight);
  viewport.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
  const theme = spec.theme ?? HUB_WORLD_THEME;
  const backdrop = makeNode(viewport, 'WalkViewportBackdrop', 0, 0, viewportWidth, viewportHeight).addComponent(Graphics);
  // Match the floor painter's own backing tint so a tall-screen viewport that
  // extends past a smaller world map reads as shadowed ground, never a black band.
  const viewportGroundTint = model.phase === 'hub'
    ? (theme.floor === 'sand' ? 0 : -14)
    : -10;
  if (roomFit === undefined) rect(backdrop, -viewportWidth / 2, -viewportHeight / 2, viewportWidth, viewportHeight, courtyard ? new Color(21, 23, 26, 255) : tint(theme.ground, viewportGroundTint));
  const camera = makeNode(viewport, 'WalkCamera', 0, 0, spec.width, spec.height);
  camera.setScale(new Vec3(cameraScale.x, cameraScale.y, 1));
  if (roomFit === undefined) dungeonFloor(camera, model, options, (viewportWidth + 2 * Math.abs(cameraOffset.x)) / worldZoom,
    (viewportHeight + 2 * Math.abs(cameraOffset.y)) / worldZoom);
  const marker = makeNode(camera, 'WalkTargetMarker', 0, 0, 152, 58);
  if (actorScale !== undefined) marker.setScale(new Vec3(actorScale.x, actorScale.y, 1));
  const markerGraphics = marker.addComponent(Graphics);
  const actors = makeNode(camera, 'WalkDepthObjects', 0, 0, spec.width, spec.height);
  const depth: DepthItem[] = courtyard ? (spec.props ?? []).map(prop => courtyardProp(actors, prop, options))
    : spec.obstacles.map((obstacle, index) => dungeonObstacle(actors, obstacle, index, options));
  if (actorScale !== undefined) depth.forEach(entry => entry.node.setScale(new Vec3(actorScale.x, actorScale.y, 1)));
  const transitionStates: { target: WorldTarget; label: Label }[] = [];
  spec.targets.forEach((target) => {
    const actor = targetActor(actors, target, model, options);
    if (actorScale !== undefined) actor.node.setScale(new Vec3(actorScale.x, actorScale.y, 1));
    depth.push(actor);
    const transitionState = actor.node.getChildByName('WalkTransitionState')?.getComponent(Label);
    if (transitionState != null) transitionStates.push({ target, label: transitionState });
    if (courtyard) {
      const begin = (): void => approachTarget(target);
      options.bindLocal(actor.node, begin);
      const touch = makeNode(actor.node, 'WalkTargetTouch', 0, target.kind === 'portal' ? 110 : 95, target.kind === 'portal' ? 160 : 148, target.kind === 'portal' ? 220 : 190);
      options.bindLocal(touch, begin);
    }
  });

  const player = makeNode(actors, 'WalkPlayer', options.position.x, -options.position.y, 104, 108);
  if (actorScale !== undefined) player.setScale(new Vec3(actorScale.x, actorScale.y, 1));
  const playerSize = roomFit === undefined ? courtyard ? 172 : 104 : roomFit.artwork.heroVisibleHeight * 336 / 308 * hudPixel;
  const playerBodyY = roomFit === undefined ? courtyard ? 78 : 47 : playerSize * (320.16 - 168) / 336;
  shadow(player, roomFit === undefined ? courtyard ? 31 : 24 : 15 * options.dungeonView!.worldPixel, roomFit === undefined ? courtyard ? 7.5 : 9 : 3 * options.dungeonView!.worldPixel);
  const body = makeNode(player, 'WalkPlayerBody', 0, 0, playerSize, playerSize);
  const walkerFrames = options.walkerFrames;
  body.setPosition(new Vec3(0, playerBodyY, 0));
  const playerSprite = body.addComponent(Sprite);
  playerSprite.sizeMode = Sprite.SizeMode.CUSTOM;
  // Keep the shared logical canvas so trimmed poses retain one ground point.
  playerSprite.trim = false;
  playerSprite.spriteFrame = walkerFrames[courtyard ? 8 : 0]!;
  playerSprite.color = new Color(255, 255, 255, 255);
  options.trackSprite(playerSprite);
  if (courtyard) text(player, 'WalkPlayerName', '轮回者', 0, 180, 150, 24, 12, new Color(190, 241, 217, 255));
  const playerDepth: DepthItem = { node: player, y: options.position.y };
  depth.push(playerDepth);
  const sortDepth = (): void => {
    depth.sort((a, b) => a.y - b.y);
    depth.forEach((entry, index) => entry.node.setSiblingIndex(index));
  };
  sortDepth();

  const controlsLeft = -375 + (options.safeInsets.left + options.safeInsets.right) / 2;
  const controlsRight = -controlsLeft;
  const joystickSize = roomFit?.artwork.compact ? 85 : 92;
  const joystick = makeNode(scene, 'WalkJoystick', roomFit !== undefined ? controlsLeft + (model.phase === 'combat' ? 54 : (roomFit.artwork.compact ? 17 : 18) + joystickSize / 2) * hudPixel
    : courtyard ? -375 + ((options.viewportWidth ?? 320) <= 340 ? 67 : 73) * hudPixel : -230,
    bottom + (roomFit !== undefined ? 60 * hudPixel : courtyard ? ((options.viewportWidth ?? 320) <= 340 ? 71 : 77) * hudPixel : 128), 200, 200);
  if (courtyard) joystick.setScale(new Vec3(110 * hudPixel / 200, 110 * hudPixel / 200, 1));
  else if (roomFit !== undefined) {
    const scale = joystickSize * hudPixel / 200;
    joystick.setScale(new Vec3(scale, scale, 1));
  }
  const joystickGraphic = joystick.addComponent(Graphics);
  joystickGraphic.lineWidth = 1.8;
  const joystickRadius = courtyard || roomFit !== undefined ? 100 : 96;
  ellipse(joystickGraphic, 0, 0, joystickRadius, joystickRadius, new Color(28, 36, 22, 122), new Color(188, 165, 111, 112));
  ellipse(joystickGraphic, 0, 0, joystickRadius - 7, joystickRadius - 7, undefined, new Color(189, 167, 106, 9));
  joystickGraphic.strokeColor = new Color(196, 171, 102, 41);
  joystickGraphic.moveTo(-71, 0); joystickGraphic.lineTo(71, 0); joystickGraphic.stroke();
  joystickGraphic.moveTo(0, -71); joystickGraphic.lineTo(0, 71); joystickGraphic.stroke();
  const joystickThumb = makeNode(joystick, 'WalkJoystickThumb', 0, 0, courtyard ? 80 : 84, courtyard ? 80 : 84);
  const thumb = joystickThumb.addComponent(Graphics);
  thumb.lineWidth = 1.8;
  ellipse(thumb, 0, -5, 40, 40, new Color(0, 0, 0, 35));
  ellipse(thumb, 0, 0, 40, 40, new Color(129, 115, 72, 112), new Color(203, 187, 132, 156));
  ellipse(thumb, 0, 0, 35, 35, undefined, new Color(37, 30, 25, 43));
  const compactInteract = courtyard || roomFit !== undefined;
  const htmlInteract = roomFit !== undefined && model.phase === 'explore';
  const interactWidth = htmlInteract ? (roomFit.artwork.compact ? 64 : 68) * hudPixel : compactInteract ? (model.phase === 'combat' ? 60 : 64) * hudPixel : 120;
  const interactHeight = htmlInteract ? (roomFit.artwork.compact ? 65 : 69) * hudPixel : compactInteract ? 44 * hudPixel : 120;
  const interact = roomFit !== undefined
    ? makeNode(scene, 'WalkInteract', model.phase === 'combat' ? controlsLeft + 134 * hudPixel : controlsRight - 17 * hudPixel - interactWidth / 2,
      bottom + (model.phase === 'combat' ? 24 : 60) * hudPixel, interactWidth, interactHeight)
    : courtyard
    ? makeNode(scene, 'WalkInteract', 375 - ((options.viewportWidth ?? 320) <= 340 ? 44 : 50) * hudPixel,
      bottom + ((options.viewportWidth ?? 320) <= 340 ? 38 : 46) * hudPixel, interactWidth, interactHeight)
    : button(scene, 'WalkInteract', '靠近互动', 290, bottom + 79, 120, false, DARK_UI.gold, 'interact');
  if (compactInteract) {
    paintDarkFrame(interact.addComponent(Graphics), interactWidth, interactHeight, { fill: WALK_HUD.quiet, edge: WALK_HUD.edge, accent: WALK_HUD.gold, cut: htmlInteract ? 9 * hudPixel : 0 });
    const icon = makeNode(interact, 'WalkInteractIcon', htmlInteract ? 0 : -17 * hudPixel, htmlInteract ? 10 * hudPixel : 0, 14 * hudPixel, 14 * hudPixel).addComponent(Graphics);
    paintDarkIcon(icon, 'interact', DARK_UI.gold);
    const iconSize = htmlInteract ? 24 : 14;
    icon.node.setScale(new Vec3(iconSize * hudPixel / 46, iconSize * hudPixel / 46, 1));
    const label = text(interact, 'WalkInteractLabel', htmlInteract ? '互动' : '靠近', htmlInteract ? 0 : 8 * hudPixel, htmlInteract ? -16 * hudPixel : 0, (htmlInteract ? 54 : 34) * hudPixel, 20 * hudPixel, (htmlInteract ? 14 : 11) * hudPixel, DARK_UI.muted);
    label.enableWrapText = false;
  }
  const interactLabel = interact.getChildByName('WalkInteractLabel')?.getComponent(Label);
  const interactIcon = interact.getChildByName('WalkInteractIcon')?.getComponent(Graphics);
  const interactGraphics = interact.getComponent(Graphics);
  const minimapPlayer = courtyard ? courtyardMinimap(scene, spec, options, top) : undefined;
  const detail = model.sections[1].detail;
  if (detail.kind === 'explore') {
    const map = headerButton(scene, 'SceneMap', '地图', 'map', 0, 1, options, top);
    options.bindLocal(map, () => options.openPanel === undefined ? options.openDetails() : options.openPanel('map'));
  }
  if (detail.kind !== 'hub') {
    const codex = headerButton(scene, 'SceneCodex', '目标', 'target', 1, 1, options, top);
    options.bindLocal(codex, () => options.openPanel === undefined ? options.openCodex() : options.openPanel('objectives'));
  }
  combatControls(scene, model, options, bottom);
  header(scene, model, options, top);

  let position: WorldPoint = { x: options.position.x, y: options.position.y };
  let facing: Facing = courtyard ? 'right' : 'down';
  let previousFacing: Facing = facing;
  let frameIndex = 0;
  let gait = 0;
  let age = 0;
  let disposed = false;
  let nearby: WorldTarget | undefined;
  let targetId: string | undefined;
  let interactionInitialized = false;
  const busy = options.chrome.busyActionId !== undefined || options.chrome.modeKind === 'blocked';
  options.bindInteract(interact, () => {
    cancelApproach();
    const target = nearestWalkTarget(spec, position);
    return busy ? undefined : target;
  });

  const halfWidth = 375 / worldZoom;
  const halfHeight = safeHeight / worldZoom / 2;
  const clampCamera = (point: WorldPoint): WorldPoint => ({
    x: roomFit !== undefined ? roomFit.cameraPoint.x : spec.width <= halfWidth * 2 ? spec.width / 2 : Math.max(halfWidth, Math.min(spec.width - halfWidth, point.x + (model.phase === 'combat' ? 220 : 0))),
    y: roomFit !== undefined ? roomFit.cameraPoint.y : courtyard || spec.height <= halfHeight * 2 ? spec.height / 2 : Math.max(halfHeight, Math.min(spec.height - halfHeight, point.y + 65)),
  });
  let cameraPoint = clampCamera(position);
  camera.setPosition(new Vec3(cameraOffset.x - cameraPoint.x * cameraScale.x, cameraOffset.y + cameraPoint.y * cameraScale.y, 0));

  const destinationMarker = courtyard ? makeNode(camera, 'WalkDestinationMarker', 0, 0, 36, 17).addComponent(Graphics) : undefined;
  let path: WorldPoint[] = [];
  let pendingTarget: WorldTarget | undefined;
  let stuckTime = 0;
  const routeNotice = courtyard ? text(scene, 'WalkRouteNotice', '', 0, top - 155 * hudPixel, 310 * hudPixel, 26 * hudPixel, 11 * hudPixel, DARK_UI.gold) : undefined;
  let noticeExpires = 0;
  const cancelApproach = (): void => {
    path = [];
    pendingTarget = undefined;
    stuckTime = 0;
    destinationMarker?.clear();
  };
  const beginRoute = (destination: WorldPoint, target?: WorldTarget): void => {
    cancelApproach();
    if (disposed || busy) return;
    if (target !== undefined && Math.hypot(target.x - position.x, target.y - position.y) <= target.radius) {
      options.interactTarget?.(target);
      return;
    }
    path = findWalkPath(spec, position, destination);
    if (path.length === 0) {
      if (routeNotice !== undefined) {
        routeNotice.string = '此处无法到达，请从旁边绕行。';
        noticeExpires = age + 3;
      }
      return;
    }
    pendingTarget = target;
    if (destinationMarker !== undefined) {
      destinationMarker.node.setPosition(new Vec3(destination.x, -destination.y, 0));
      destinationMarker.lineWidth = 1;
      ellipse(destinationMarker, 0, 0, 18, 8.5, new Color(223, 201, 138, 25), new Color(224, 210, 164, 173));
      rect(destinationMarker, -6, -0.5, 12, 1, new Color(224, 210, 164, 171));
      rect(destinationMarker, -0.5, -3, 1, 6, new Color(224, 210, 164, 171));
    }
  };
  const approachTarget = (target: WorldTarget): void => beginRoute({ x: target.x, y: target.y }, target);
  if (courtyard) options.bindWorldTap?.(viewport, (point) => {
    const bounds = spec.bounds!;
    beginRoute({
      x: Math.max(bounds.x + 14, Math.min(bounds.x + bounds.width - 14, point.x / worldZoom + cameraPoint.x)),
      y: Math.max(bounds.y + 14, Math.min(bounds.y + bounds.height - 14, cameraPoint.y - point.y / worldZoom)),
    });
  });

  const activity = formatInfiniteFlowPlayerChrome(options.chrome, model.phase).activityMessage;
  const failed = isInfiniteFlowPlayerActivityFailure(activity);
  const feedbackText = failed ? activity : options.feedback?.text;
  const toast = feedbackText === undefined ? undefined
    : text(scene, 'WalkFeedback', feedbackText, -49, top - 124 * hudPixel, 554, 24 * hudPixel, 10 * hudPixel, failed ? DARK_UI.red : DARK_UI.gold);
  const monster = spec.targets.find((target) => target.kind === 'monster');
  const enemyNode = monster === undefined ? undefined : actors.getChildByName(`WalkTarget:${monster.id}`);
  const enemyBody = enemyNode?.getChildByName('WorldObjectBody');
  const updateCombatReadout = (values: Readonly<{ playerHp?: number; enemyHp?: number }>): void => {
    if (disposed || detail.kind !== 'combat') return;
    if (values.playerHp !== undefined) {
      const hud = scene.getChildByName('WalkHud');
      const status = hud?.getChildByName('WalkPlayerStatus')?.getComponent(Label);
      if (status !== undefined && status !== null) status.string = `${values.playerHp}/${detail.player.maxHp}`;
      const health = hud?.getChildByName('WalkPlayerHealth')?.getComponent(Graphics);
      if (health !== undefined && health !== null) {
        const size = health.node.getComponent(UITransform)!.contentSize;
        paintPlayerHealth(health, values.playerHp, detail.player.maxHp, size.width, size.height);
      }
    }
    if (values.enemyHp !== undefined) {
      const label = enemyNode?.getChildByName('WalkEnemyHealthLabel')?.getComponent(Label);
      if (label !== undefined && label !== null) label.string = `${values.enemyHp} / ${detail.enemy.maxHp}`;
      const health = enemyNode?.getChildByName('WalkEnemyHealth')?.getComponent(Graphics);
      if (health !== undefined && health !== null) {
        const size = health.node.getComponent(UITransform)!.contentSize;
        const inset = roomFit === undefined ? 3 : options.dungeonView!.worldPixel;
        health.clear();
        rect(health, -size.width / 2, -size.height / 2, size.width, size.height, INK, EDGE);
        rect(health, -size.width / 2 + inset, -size.height / 2 + inset, (size.width - inset * 2) * Math.max(0, Math.min(1, values.enemyHp / detail.enemy.maxHp)), size.height - inset * 2, RED);
      }
    }
  };
  // A separate mask ends above the controls. It shares the world camera's
  // coordinate conversion while keeping particles and numbers off the HUD.
  const effectBottom = 394;
  const effectHeight = roomFit === undefined ? Math.max(1, viewportHeight - effectBottom) : viewportHeight;
  const effectCenterY = roomFit === undefined ? effectBottom / 2 : 0;
  const effectsMask = model.phase === 'combat'
    ? makeNode(viewport, 'WalkCombatEffectsViewport', 0, effectCenterY, viewportWidth, effectHeight) : undefined;
  if (effectsMask !== undefined) effectsMask.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
  const enemyArt = monster?.visualAssetKey === undefined ? undefined : enemyBody?.getChildByName(`WalkMonsterSprite:${monster.visualAssetKey}`);
  const enemyAnchorY = roomFit === undefined ? 66 : (enemyArt?.getComponent(UITransform)?.contentSize.height ?? 0) / 2;
  const effects = effectsMask === undefined ? undefined : createInfiniteFlowCombatEffects(effectsMask, {
    getAnchors: () => {
      if (roomFit !== undefined) {
        const playerFoot = roomFit.project(position);
        const enemyFoot = roomFit.project(monster ?? position);
        return {
          player: { x: playerFoot.x - viewportCenter.x, y: playerFoot.y - viewportCenter.y + playerBodyY - effectCenterY },
          enemy: { x: enemyFoot.x - viewportCenter.x, y: enemyFoot.y - viewportCenter.y + enemyAnchorY - effectCenterY },
        };
      }
      return {
        player: { x: cameraOffset.x + (position.x - cameraPoint.x) * worldZoom, y: cameraOffset.y + (cameraPoint.y - position.y + playerBodyY) * worldZoom - effectCenterY },
        enemy: { x: cameraOffset.x + ((monster?.x ?? position.x) - cameraPoint.x) * worldZoom, y: cameraOffset.y + (cameraPoint.y - (monster?.y ?? position.y) + enemyAnchorY) * worldZoom - effectCenterY },
      };
    },
    // Dungeon actor roots cancel both camera axes, so body positions are already screen units.
    movePlayer: offset => body.setPosition(new Vec3(offset.x / (roomFit === undefined ? worldZoom : 1), playerBodyY + offset.y / (roomFit === undefined ? worldZoom : 1), 0)),
    moveEnemy: offset => enemyBody?.setPosition(new Vec3(offset.x / (roomFit === undefined ? worldZoom : 1), offset.y / (roomFit === undefined ? worldZoom : 1), 0)),
  });

  const updateInteraction = (): void => {
    nearby = nearestWalkTarget(spec, position);
    if (interactionInitialized && targetId === nearby?.id) return;
    interactionInitialized = true;
    targetId = nearby?.id;
    for (const entry of transitionStates) {
      entry.label.string = entry.target.action === undefined ? '封闭' : entry.target.disabledReason !== undefined ? '入口未开放'
        : entry.target.id === targetId ? '已到达入口' : '入口畅通';
    }
    const ready = !busy && nearby !== undefined;
    if (interactLabel !== null && interactLabel !== undefined) {
      interactLabel.string = nearby === undefined ? htmlInteract ? '互动' : compactInteract ? '靠近' : '靠近互动' : nearby.disabledReason !== undefined ? '查看' : nearby.interactionLabel ?? '互动';
      interactLabel.color = ready ? WALK_HUD.text : WALK_HUD.muted;
    }
    if (interactGraphics !== null) {
      paintDarkFrame(interactGraphics, interactWidth, interactHeight, { fill: ready ? WALK_HUD.active : WALK_HUD.quiet, edge: ready ? WALK_HUD.edgeLight : WALK_HUD.edge, accent: ready ? WALK_HUD.gold : WALK_HUD.edge, cut: htmlInteract ? 9 * hudPixel : compactInteract ? 0 : 11 });
    }
    if (interactIcon !== null && interactIcon !== undefined) paintDarkIcon(interactIcon, 'interact', ready ? WALK_HUD.gold : WALK_HUD.muted);
    markerGraphics.clear();
    if (nearby !== undefined) {
      marker.setPosition(new Vec3(nearby.x, -nearby.y, 0));
      const pixel = options.dungeonView?.worldPixel;
      markerGraphics.lineWidth = pixel === undefined ? 3 : 1.5 * pixel;
      ellipse(markerGraphics, 0, 0, pixel === undefined ? nearby.kind === 'npc' ? 36 : 69 : 27 * pixel,
        pixel === undefined ? nearby.kind === 'npc' ? 15 : 24 : 9 * pixel, new Color(197, 168, 106, 25), ready ? TEAL : RED);
    }
  };
  updateInteraction();

  return {
    joystick,
    joystickThumb,
    getPosition: () => ({ x: position.x, y: position.y }),
    getFacing: () => facing,
    cancelApproach,
    updateCombatReadout,
    isCombatAnimating: () => effects?.isPlaying() ?? false,
    startCombatAction: (kind, onImpact) => {
      if (disposed || effects === undefined) return false;
      return effects.start(kind, onImpact);
    },
    resolveCombatAction: (result, onComplete) => {
      if (disposed || effects === undefined) return false;
      const accepted = effects.resolve({ ...result, onCounterImpact: () => {
        updateCombatReadout({ playerHp: result.playerHpAfterCounter, enemyHp: result.enemyHpAfterCounter });
        result.onCounterImpact?.();
      } }, onComplete);
      if (!accepted) return false;
      updateCombatReadout({ playerHp: result.playerHpAfterImpact, enemyHp: result.enemyHpAfterImpact });
      return true;
    },
    cancelCombatAction: () => { if (!disposed) effects?.cancel(); },
    tick: (dt, axis) => {
      if (disposed) return;
      const elapsed = Math.min(Math.max(dt, 0), courtyard ? 0.05 : 0.1);
      age += elapsed;
      const movingBlocked = busy || (effects?.isPlaying() ?? false);
      let movement = axis;
      let next = movingBlocked ? position : stepWalkPosition(spec, position, axis, elapsed);
      if (axis.x !== 0 || axis.y !== 0) cancelApproach();
      else if (courtyard && path.length > 0 && !movingBlocked) {
        let remaining = elapsed;
        // Reach each clear segment's endpoint before turning. Consume only its
        // actual travel time, so touching a tangent never cuts the foot corner
        // and crossing a waypoint cannot add movement to the current frame.
        while (path.length > 0 && remaining > 1e-10) {
          const waypoint = path[0]!;
          const dx = (waypoint.x - next.x) / 260;
          const dy = (waypoint.y - next.y) / 145;
          const magnitude = Math.hypot(dx, dy);
          if (magnitude < 1e-10) { path.shift(); continue; }
          movement = { x: dx / magnitude, y: dy / magnitude };
          const travelSeconds = Math.min(remaining, magnitude);
          next = stepWalkPosition(spec, next, movement, travelSeconds);
          remaining -= travelSeconds;
          if (Math.hypot(waypoint.x - next.x, waypoint.y - next.y) < 1e-7) path.shift();
          else break;
        }
        if (path.length === 0) destinationMarker?.clear();
      }
      const moved = Math.abs(next.x - position.x) + Math.abs(next.y - position.y) > 0.01;
      if (!movingBlocked && (movement.x !== 0 || movement.y !== 0)) {
        if (courtyard) { if (Math.abs(movement.x) > 0.04) facing = movement.x < 0 ? 'left' : 'right'; }
        else facing = Math.abs(movement.x) > Math.abs(movement.y)
          ? movement.x < 0 ? 'left' : 'right' : movement.y < 0 ? 'up' : 'down';
      }
      position = next;
      if (moved) {
        player.setPosition(new Vec3(position.x, -position.y, 0));
        playerDepth.y = position.y;
        sortDepth();
        gait += elapsed * 9;
      } else gait = 0;
      if (courtyard && path.length > 0) {
        stuckTime = moved ? 0 : stuckTime + elapsed;
        if (stuckTime > 0.4) {
          cancelApproach();
          if (routeNotice !== undefined) { routeNotice.string = '前方有障碍，请从旁边绕行。'; noticeExpires = age + 3; }
        }
      }
      if (!movingBlocked && pendingTarget !== undefined && Math.hypot(pendingTarget.x - position.x, pendingTarget.y - position.y) <= pendingTarget.radius) {
        const arrived = pendingTarget;
        cancelApproach();
        options.interactTarget?.(arrived);
        // Opening the real target panel can synchronously dispose this scene.
        return;
      }
      if (minimapPlayer !== undefined) {
        const size = minimapPlayer.parent!.getComponent(UITransform)!.contentSize;
        minimapPlayer.setPosition(new Vec3(-size.width / 2 + position.x / spec.width * size.width, size.height / 2 - position.y / spec.height * size.height, 0));
      }
      if (routeNotice !== undefined && age > noticeExpires) routeNotice.string = '';
      const nextFrame = Math.floor(gait) % 4;
      if (frameIndex !== nextFrame || previousFacing !== facing) {
        frameIndex = nextFrame;
        previousFacing = facing;
        const row = facing === 'down' ? 0 : facing === 'left' ? 1 : facing === 'right' ? 2 : 3;
        playerSprite.spriteFrame = walkerFrames[row * 4 + frameIndex]!;
      }
      if (roomFit === undefined) {
        const desired = clampCamera(position);
        const smoothing = 1 - Math.exp(-elapsed * 9);
        cameraPoint = { x: cameraPoint.x + (desired.x - cameraPoint.x) * smoothing, y: cameraPoint.y + (desired.y - cameraPoint.y) * smoothing };
        camera.setPosition(new Vec3(-cameraPoint.x * worldZoom, cameraPoint.y * worldZoom, 0));
      }
      updateInteraction();
      if (toast !== undefined && !failed) toast.color = new Color(DARK_UI.gold.r, DARK_UI.gold.g, DARK_UI.gold.b, Math.round(255 * Math.max(0, Math.min(1, 4 - age))));
      effects?.tick(elapsed);
    },
    dispose: () => { disposed = true; cancelApproach(); effects?.dispose(); scene.destroy(); },
  };
}
