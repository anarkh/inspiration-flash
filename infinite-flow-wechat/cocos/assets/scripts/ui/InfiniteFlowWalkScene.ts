import { BlockInputEvents, Color, Graphics, Input, KeyCode, Label, Mask, Node, Size, Sprite, UITransform, Vec2, Vec3, input } from 'cc';
import type { EventKeyboard, SpriteFrame } from 'cc';
import type { ExploreDetailViewModel, GameViewModel, RoomEventViewModel, RouteForecastViewModel, StatusMetric, ViewActionModel } from '@infinite-flow/presentation';
import { formatInfiniteFlowPlayerChrome, isInfiniteFlowPlayerActivityFailure } from './InfiniteFlowView';
import type { InfiniteFlowRuntimeChrome } from './InfiniteFlowView';
import { findWalkPath, nearestWalkTarget, stepWalkPosition, walkApproachPoint, walkAxisSpeed } from './walk-world';
import type { WalkWorldSpec, WorldPoint, WorldProp, WorldRect, WorldTarget } from './walk-world';
import { HUB_WORLD_THEME } from './dungeon-world-theme';
import type { WorldTint } from './dungeon-world-theme';
import { getInfiniteFlowMonsterWorldVisualKey, getInfiniteFlowNpcWorldVisualKey, getInfiniteFlowPursuerVisualKey, getInfiniteFlowRunRelicVisualKey, getInfiniteFlowSceneVisualKeys, INFINITE_FLOW_DUNGEON_PROP_VISUAL_KEYS, INFINITE_FLOW_DUNGEON_TRANSITION_GATE_VISUAL_KEY, INFINITE_FLOW_HUB_DUNGEON_PORTAL_VISUAL_KEY } from './scene-visuals';
import { DARK_UI, ROOM_SHEET, paintDarkFrame, paintDarkIcon, paintRoomSheetButton, paintRoomSheetFrame } from './dark-ui';
import { getWalkHudLayout } from './hud-layout';
import type { HudPopoverKind } from './hud-layout';
import { createInfiniteFlowCombatEffects } from './InfiniteFlowCombatEffects';
import type { CombatEffectKind, CombatEffectResult, CombatEffectStartOptions, CombatTimingGrade } from './InfiniteFlowCombatEffects';

export type { CombatEffectKind, CombatEffectResult, CombatEffectStartOptions, CombatTimingGrade } from './InfiniteFlowCombatEffects';

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
  /** An alarm banner across the room, such as the pursuer waking; `age` is how long it has already shown. */
  banner?: Readonly<{ title: string; line: string; age: number }>;
  /** Open while the room's own event sheet is shown; walking stays suspended until it closes. */
  roomEventSheet?: Readonly<{ close: () => void }>;
}>;

export type WalkSceneHandle = Readonly<{
  tick: (dt: number, axis: WorldPoint) => void;
  getPosition: () => WorldPoint;
  getFacing: () => 'down' | 'left' | 'right' | 'up';
  joystick: Node;
  joystickThumb: Node;
  startCombatAction: (kind: CombatEffectKind, onImpact: (grade: CombatTimingGrade) => void, options?: CombatEffectStartOptions) => boolean;
  /** Touch or Space during the parry window; also callable directly. */
  tapCombatTiming: () => boolean;
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
  // The hero stands about as tall as a doorway, so it reads at a glance beside gates and monsters.
  const artwork = { gateHeight: compact ? 60 : 90, monsterHeight: compact ? 108 : 158, heroVisibleHeight: compact ? 68 : 88, compact };
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
function drawTransitionGate(body: Node, target: WorldTarget, model: GameViewModel, options: ReadyWalkSceneOptions): void {
  const unavailable = target.disabledReason !== undefined;
  const threat = target.forecast?.threat?.level;
  if (threat !== undefined) {
    // A pursuer on the far side bleeds red light through the doorway; closer means brighter.
    const pixel = options.dungeonView?.worldPixel ?? 1;
    const gateHeight = (options.dungeonView?.gateHeight ?? 80) * pixel;
    const glow = makeNode(body, 'WalkTransitionThreatGlow', 0, gateHeight * 0.48, gateHeight * 1.5, gateHeight * 1.5).addComponent(Graphics);
    for (let ring = 6; ring > 0; ring -= 1) {
      const scale = ring / 6;
      ellipse(glow, 0, 0, gateHeight * 0.62 * scale, gateHeight * 0.7 * scale, new Color(214, 58, 40, threat === 'near' ? 30 : 16));
    }
  } else if (!unavailable) {
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
  const detail = model.sections[1].detail;
  if (threat === 'near' && detail.kind === 'explore' && options.dungeonView !== undefined) {
    // Only a silhouette shows in the doorway: the pursuer's chapter art, inked almost black.
    const lurker = options.visual(getInfiniteFlowPursuerVisualKey(detail.map.dungeonId));
    const lurkerHeight = height * 0.7;
    const lurkerWidth = lurker.width * lurkerHeight / lurker.height;
    const shade = makeNode(body, 'WalkTransitionLurker', 0, height * 0.06 + lurkerHeight / 2, lurkerWidth, lurkerHeight).addComponent(Sprite);
    shade.sizeMode = Sprite.SizeMode.CUSTOM;
    shade.spriteFrame = lurker.frame;
    shade.color = new Color(44, 10, 8, 236);
    options.trackSprite(shade);
  }
}

const RISK_COLORS: Readonly<Record<1 | 2 | 3, Color>> = {
  1: new Color(176, 206, 160, 255),
  2: new Color(232, 182, 98, 255),
  3: new Color(236, 112, 92, 255),
};

/** First caption line under a door: what kind of room waits behind it and how risky it reads. */
export function getRouteForecastCaption(forecast: RouteForecastViewModel): Readonly<{ text: string; color: Color }> {
  if (forecast.cleared && forecast.kind !== 'exit') return { text: '已清空', color: DARK_UI.muted };
  const pips = forecast.risk === undefined ? '' : ` ${'◆'.repeat(forecast.risk)}${'◇'.repeat(3 - forecast.risk)}`;
  const encounter = forecast.kind === 'monster' || forecast.kind === 'elite' || forecast.kind === 'boss';
  if (encounter || (forecast.kind === 'trap' && forecast.hint === undefined)) {
    return { text: `${forecast.kindLabel}${pips}`, color: forecast.risk === undefined ? DARK_UI.bone : RISK_COLORS[forecast.risk] };
  }
  const text = forecast.hint === undefined ? forecast.kindLabel : `${forecast.kindLabel} · ${forecast.hint}`;
  return { text, color: forecast.kind === 'reward' || forecast.kind === 'supply' ? GOLD : DARK_UI.bone };
}

/** Second caption line: the pursuer outranks a boss fusion warning, which outranks the seal. */
function forecastNotice(forecast: RouteForecastViewModel): Readonly<{ text: string; color: Color }> | undefined {
  if (forecast.threat !== undefined) return { text: forecast.threat.label, color: RISK_COLORS[3] };
  if (forecast.kind === 'boss' && forecast.hint !== undefined && !forecast.cleared) return { text: forecast.hint, color: RISK_COLORS[3] };
  if (forecast.containment !== undefined) return { text: forecast.containment.label, color: new Color(150, 214, 198, 255) };
  return undefined;
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
    if (target.purpose !== undefined) text(base, 'WalkTargetPurpose', target.purpose, 0, 204, 192, 22, 11, target.ready ? GOLD : new Color(206, 200, 183, 255));
    if (target.ready) {
      // As in WoW, a gold question mark over a quest giver means something is ready to turn in.
      inkDotTextShadow(text(base, 'WalkTargetReady', '?', 0, 258, 40, 40, 34, GOLD)).isBold = true;
    }
    if (target.kind === 'portal') text(base, 'WalkTargetPurpose', '进入副本', 0, 232, 192, 22, 11, new Color(180, 216, 210, 255));
    return { node: base, y: target.y };
  }
  // The duel's enemy card names the opponent; its feet stay clear of plates.
  if (model.phase === 'combat' && target.kind === 'monster' && pixel !== undefined) return { node: base, y: target.y };
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
    const forecast = target.forecast;
    const caption = forecast === undefined ? undefined : getRouteForecastCaption(forecast);
    // Forecast captions run a little wider; side doors lean inward to stay on screen.
    const captionWidth = pixel === undefined ? 192 : (caption === undefined ? compact ? 78 : 84 : compact ? 88 : 98) * pixel;
    const captionX = pixel === undefined || caption === undefined ? nameX
      : target.doorSide === 'west' ? (captionWidth - nameWidth) / 2 : target.doorSide === 'east' ? (nameWidth - captionWidth) / 2 : nameX;
    const captionHeight = pixel === undefined ? 24 : (compact ? 14 : 16) * pixel;
    const captionSize = pixel === undefined ? 16 : (compact ? 9 : 10) * pixel;
    text(base, 'WalkTransitionState', caption?.text ?? (target.action === undefined ? '封闭' : target.disabledReason === undefined ? '入口畅通' : '入口未开放'),
      captionX, stateY, captionWidth, captionHeight, captionSize,
      caption?.color ?? (target.disabledReason === undefined ? new Color(209, 225, 207, 255) : DARK_UI.muted));
    const notice = forecast === undefined ? undefined : forecastNotice(forecast);
    if (notice !== undefined && pixel !== undefined) {
      // The south door sits on the controls band, so its notice rides above the gate instead.
      const noticeY = target.doorSide === 'south' ? (options.dungeonView!.gateHeight + 8) * pixel : stateY - (compact ? 12 : 14) * pixel;
      inkDotTextShadow(text(base, 'WalkTransitionNotice', notice.text, captionX, noticeY, captionWidth, captionHeight, captionSize, notice.color));
    }
  }
  return { node: base, y: target.y };
}

function drawTargetObject(body: Node, base: Node, target: WorldTarget, model: GameViewModel, options: ReadyWalkSceneOptions): void {
  if (model.phase === 'hub' && target.kind === 'portal') {
    drawHubDungeonPortal(body, options);
    return;
  }
  if (target.kind === 'transition') {
    drawTransitionGate(body, target, model, options);
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
    // Room combat reads HP from the enemy card; only the legacy world keeps the overhead bar.
    if (detail.kind === 'combat' && pixel === undefined) {
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

function inkDotTextShadow(label: Label): Label {
  label.enableShadow = true;
  label.shadowColor = INK_DOT_HUD.shadow;
  label.shadowOffset = new Vec2(0, -1);
  label.shadowBlur = 2;
  return label;
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

const PRESSURE_FILLS: Readonly<Record<'stable' | 'hunted' | 'breach', Color>> = {
  stable: new Color(157, 178, 132, 255),
  hunted: new Color(219, 166, 84, 255),
  breach: new Color(214, 92, 72, 255),
};

/** Exit seal and law warnings ride on the pressure panel's foot instead of a separate strip. */
function routeRiskSuffix(metrics: readonly StatusMetric[]): string {
  return metrics.flatMap(({ id, severity }) => id === 'boss-seal' && severity !== 'positive' ? ['出口封印']
    : id === 'law' && (severity === 'danger' || severity === 'warning') ? [`法则${severity === 'danger' ? '危险' : '警戒'}`] : []).map(item => ` · ${item}`).join('');
}

/** Pressure tier, its three-stage bar and how many rooms remain until the next tier. */
function routePressurePanel(scene: Node, detail: ExploreDetailViewModel, metrics: readonly StatusMetric[], options: WalkSceneOptions, top: number): void {
  const pressure = detail.chapterDecision?.pressure;
  const px = 750 / (options.viewportWidth ?? 320);
  const width = Math.min((options.viewportWidth ?? 320) - 124, 244) * px;
  const height = 46 * px;
  const panel = makeNode(scene, 'WalkPressurePanel', -375 + 10 * px + width / 2, top - 84 * px - height / 2, width, height);
  const g = panel.addComponent(Graphics);
  rect(g, -width / 2, -height / 2, width, height, HUD_WASH);
  const tier = pressure?.present ? pressure.tier : undefined;
  if (pressure === undefined || tier === undefined) {
    const label = pressure?.legacyDisabled ? '侵蚀：旧档禁用' : '侵蚀：稳定';
    inkDotTextShadow(text(panel, 'WalkPressureFoot', `${label}${routeRiskSuffix(metrics)}`, 0, 0, width - 12 * px, 24 * px, 9 * px, DARK_UI.bone, false));
    return;
  }
  const inset = 8 * px;
  const tierLabel = inkDotTextShadow(text(panel, 'WalkPressureTier', pressure.label ?? tier, -width / 2 + inset + 15 * px, height / 2 - 11 * px, 30 * px, 18 * px, 12 * px, PRESSURE_FILLS[tier], false));
  tierLabel.isBold = true;
  const monster = (pressure.pressurePercent ?? 0) > 0 ? `+${pressure.pressurePercent}%` : '原始强度';
  const reward = (pressure.rewardBonusPercent ?? 0) > 0 ? `+${pressure.rewardBonusPercent}%` : '无加成';
  inkDotTextShadow(text(panel, 'WalkPressureEffect', `怪物 ${monster} · 奖励 ${reward}`, inset + 22 * px, height / 2 - 11 * px, width - inset * 2 - 44 * px, 16 * px, 9 * px, DARK_UI.bone, false));
  const count = pressure.clearedNodeCount ?? 0;
  const fills = [Math.min(1, count / 6), Math.min(1, Math.max(0, count - 6) / 6), tier === 'breach' ? 1 : 0];
  const gap = 3 * px;
  const segment = (width - inset * 2 - gap * 2) / 3;
  const barY = height / 2 - 24 * px;
  (['stable', 'hunted', 'breach'] as const).forEach((id, index) => {
    const x = -width / 2 + inset + index * (segment + gap);
    rect(g, x, barY - 2 * px, segment, 4 * px, new Color(12, 14, 11, 220));
    if (fills[index]! > 0) rect(g, x, barY - 2 * px, segment * fills[index]!, 4 * px, PRESSURE_FILLS[id]);
  });
  const next = pressure.nextTierAt;
  // A dormant pursuer is the nearer threat, so its wake countdown takes the line until it rises.
  const pursuit = detail.chapterDecision?.pursuit;
  const wakeIn = pursuit?.status === 'dormant' ? pursuit.progress?.clearsRemaining : undefined;
  const foot = pressure.breachForced ? '灯油耗尽，压力已直接进入破界'
    : wakeIn !== undefined && wakeIn > 0 ? `已清 ${count} 间，再清 ${wakeIn} 间${pursuit?.name ?? '追兵'}苏醒`
      : next === null || next === undefined ? `已清 ${count} 间，压力已到顶`
        : `已清 ${count} 间，再清 ${Math.max(0, next - count)} 间进入${tier === 'stable' ? '追猎' : '破界'}`;
  inkDotTextShadow(text(panel, 'WalkPressureFoot', `${foot}${routeRiskSuffix(metrics)}`, 0, -height / 2 + 10 * px, width - inset * 2, 14 * px, 8.5 * px,
    pressure.breachForced ? PRESSURE_FILLS.breach : DARK_UI.muted, false));
}

const TASK_TRACKER_TONES: Readonly<Record<'active' | 'done' | 'failed', Readonly<{ kicker: Color; text: Color }>>> = {
  active: { kicker: GOLD, text: WHITE },
  done: { kicker: PRESSURE_FILLS.stable, text: PRESSURE_FILLS.stable },
  failed: { kicker: PRESSURE_FILLS.breach, text: PRESSURE_FILLS.breach },
};

/**
 * The run's tasks under the pressure panel, one tagged line each; narrow enough to stay clear of
 * the north door. Tapping opens the full objectives sheet.
 */
function routeTaskTracker(scene: Node, tracker: NonNullable<ExploreDetailViewModel['taskTracker']>, options: WalkSceneOptions, top: number): void {
  const viewport = options.viewportWidth ?? 320;
  const px = 750 / viewport;
  const width = (viewport * 0.425 - 14) * px;
  // Wider phones leave room for a larger line; long lines still shrink to fit.
  const narrow = viewport <= 350;
  const pad = 4 * px;
  const lineHeight = (narrow ? 15 : 17) * px;
  const visibleHeight = tracker.lines.length * lineHeight + pad * 2;
  // The touch target never drops below 104 design units, even for a single line.
  const height = Math.max(visibleHeight, 104);
  const panel = makeNode(scene, 'WalkTaskTracker', -375 + 10 * px + width / 2, top - 134 * px - height / 2, width, height);
  rect(panel.addComponent(Graphics), -width / 2, height / 2 - visibleHeight, width, visibleHeight, HUD_WASH);
  const tagWidth = 22 * px;
  tracker.lines.forEach((line, index) => {
    const tone = TASK_TRACKER_TONES[line.tone];
    const row = makeNode(panel, `WalkTaskLine:${line.id}`, 0, height / 2 - pad - lineHeight * (index + 0.5), width, lineHeight);
    const tag = makeNode(row, 'WalkTaskKicker', -width / 2 + pad + tagWidth / 2, 0, tagWidth, 12 * px);
    const tagFrame = tag.addComponent(Graphics);
    tagFrame.lineWidth = Math.max(1, 0.8 * px);
    rect(tagFrame, -tagWidth / 2, -6 * px, tagWidth, 12 * px, new Color(12, 14, 11, 200), new Color(tone.kicker.r, tone.kicker.g, tone.kicker.b, 170));
    const kicker = text(tag, 'Label', line.kicker, 0, 0, tagWidth, 12 * px, (narrow ? 8 : 8.5) * px, tone.kicker);
    kicker.enableWrapText = false;
    const textLeft = -width / 2 + pad + tagWidth + 4 * px;
    const textWidth = width / 2 - pad - textLeft;
    const label = inkDotTextShadow(text(row, 'WalkTaskText', line.text, textLeft + textWidth / 2, 0, textWidth, lineHeight, (narrow ? 9 : 10.5) * px, tone.text, false));
    label.enableWrapText = false;
  });
  options.bindLocal(panel, () => options.openPanel === undefined ? options.openDetails() : options.openPanel('objectives'));
}

const LANTERN_PIP_LIMIT = 28;

/** Lamp oil under the header buttons: the count, plus one pip per step it still lights. */
function routeLanternChip(scene: Node, lantern: NonNullable<ExploreDetailViewModel['lantern']>, options: WalkSceneOptions, top: number): number {
  const px = 750 / (options.viewportWidth ?? 320);
  const width = 92 * px;
  const height = 28 * px;
  const chip = makeNode(scene, 'WalkLantern', 375 - 10 * px - width / 2, top - 98 * px - height / 2, width, height);
  const g = chip.addComponent(Graphics);
  const accent = lantern.level === 'out' ? PRESSURE_FILLS.breach : lantern.level === 'low' ? PRESSURE_FILLS.hunted : GOLD;
  g.lineWidth = px;
  rect(g, -width / 2, -height / 2, width, height, HUD_WASH, new Color(accent.r, accent.g, accent.b, 120));
  // The flame mirrors the prototype's 24×24 drop path.
  const flame = makeNode(chip, 'WalkLanternFlame', -width / 2 + 11 * px, 0, 14 * px, 14 * px).addComponent(Graphics);
  const k = 13 * px / 24;
  flame.moveTo(0, 9 * k);
  flame.bezierCurveTo(4 * k, 3.5 * k, 5 * k, 1 * k, 5 * k, -1 * k);
  flame.bezierCurveTo(5 * k, -6 * k, -5 * k, -6 * k, -5 * k, -1 * k);
  flame.bezierCurveTo(-5 * k, 1 * k, -4 * k, 3.5 * k, 0, 9 * k);
  flame.close();
  flame.fillColor = new Color(accent.r, accent.g, accent.b, lantern.level === 'out' ? 90 : 220);
  flame.fill();
  inkDotTextShadow(text(chip, 'WalkLanternLabel', '灯油', -width / 2 + 34 * px, 5 * px, 22 * px, 14 * px, 8 * px, DARK_UI.muted, false));
  const value = inkDotTextShadow(text(chip, 'WalkLanternValue', String(lantern.oil), -width / 2 + 58 * px, 5 * px, 28 * px, 16 * px, 13 * px, accent, false));
  value.isBold = true;
  // One pip per drop up to a fixed count; beyond it the strip shows the lit share, never more drawing.
  const total = Math.max(lantern.startOil, lantern.oil, 1);
  const pips = Math.min(total, LANTERN_PIP_LIMIT);
  const lit = pips === total ? lantern.oil : Math.round(lantern.oil / total * pips);
  const pipsLeft = -width / 2 + 22 * px;
  const pipsWidth = width - 22 * px - 6 * px;
  const pitch = pipsWidth / pips;
  for (let index = 0; index < pips; index += 1) {
    rect(g, pipsLeft + index * pitch, -height / 2 + 5 * px, Math.max(px, pitch - px), 3 * px,
      index < lit ? accent : new Color(60, 58, 48, 255));
  }
  return top - 98 * px - height;
}

/** The chapter grid, with the pursuer's red dot and the containment ring always in view. */
function routeMinimap(scene: Node, detail: ExploreDetailViewModel, options: WalkSceneOptions, top: number): void {
  const map = detail.map;
  if (map.width <= 0 || map.height <= 0) return;
  const px = 750 / (options.viewportWidth ?? 320);
  const cell = ((options.viewportWidth ?? 320) <= 350 ? 10 : 12) * px;
  const gap = 2 * px;
  const pad = 4 * px;
  const width = map.width * cell + (map.width - 1) * gap + pad * 2;
  const height = map.height * cell + (map.height - 1) * gap + pad * 2;
  const minimap = makeNode(scene, 'WalkRouteMinimap', 375 - 10 * px - width / 2, top - 6 * px - height / 2, width, height);
  const g = minimap.addComponent(Graphics);
  rect(g, -width / 2, -height / 2, width, height, HUD_WASH);
  const center = (x: number, y: number): WorldPoint => ({
    x: -width / 2 + pad + x * (cell + gap) + cell / 2,
    y: height / 2 - pad - y * (cell + gap) - cell / 2,
  });
  const typeColors: Readonly<Record<string, Color>> = {
    monster: new Color(196, 102, 84, 255), trap: new Color(214, 160, 82, 255), reward: GOLD,
    portal: new Color(118, 196, 196, 255), exit: new Color(236, 230, 210, 255),
  };
  const cellsById = new Map(map.nodes.map(node => [node.cellId, node]));
  for (const node of map.nodes) {
    const point = center(node.x, node.y);
    const known = node.state !== 'fogged';
    const fill = node.state === 'current' ? new Color(120, 104, 62, 255) : node.state === 'cleared' ? new Color(52, 58, 46, 230)
      : known ? new Color(44, 46, 38, 230) : new Color(20, 22, 18, 160);
    g.lineWidth = px;
    rect(g, point.x - cell / 2, point.y - cell / 2, cell, cell, fill, node.state === 'current' ? GOLD : undefined);
    const dot = typeColors[node.nodeType];
    if (known && node.state !== 'cleared' && node.state !== 'current' && dot !== undefined) ellipse(g, point.x, point.y, cell * 0.18, cell * 0.18, dot);
  }
  const pursuit = detail.chapterDecision?.pursuit;
  const containment = pursuit?.containmentCellId === undefined ? undefined : cellsById.get(pursuit.containmentCellId);
  if (containment !== undefined && (pursuit?.status === 'dormant' || pursuit?.status === 'stalking')) {
    const point = center(containment.x, containment.y);
    g.lineWidth = 1.2 * px;
    ellipse(g, point.x, point.y, cell * 0.42, cell * 0.42, undefined, new Color(150, 214, 198, 230));
  }
  const lair = pursuit?.status === 'dormant' && pursuit.lairCellId !== undefined ? cellsById.get(pursuit.lairCellId) : undefined;
  if (lair !== undefined) {
    // A dormant pursuer shows as a dim ember where it will wake.
    const point = center(lair.x, lair.y);
    g.lineWidth = 1.2 * px;
    ellipse(g, point.x, point.y, cell * 0.26, cell * 0.26, new Color(120, 40, 30, 200), new Color(214, 84, 62, 200));
  }
  const pursuer = pursuit?.status === 'stalking' && pursuit.currentCellId !== undefined ? cellsById.get(pursuit.currentCellId) : undefined;
  if (pursuer !== undefined) {
    const point = center(pursuer.x, pursuer.y);
    ellipse(g, point.x, point.y, cell * 0.46, cell * 0.46, new Color(214, 58, 40, 70));
    ellipse(g, point.x, point.y, cell * 0.26, cell * 0.26, new Color(236, 84, 62, 255), new Color(255, 214, 200, 255));
  }
  options.bindLocal(minimap, () => options.openPanel === undefined ? options.openDetails() : options.openPanel('map'));
}

function header(scene: Node, model: GameViewModel, options: ReadyWalkSceneOptions, top: number): void {
  sharedHeader(scene, model, options, top);
  // Combat shows the enemy card, ticker and intent callout instead of the risk strip.
  if (model.phase === 'hub' || model.phase === 'combat') return;
  const detail = model.sections[1].detail;
  const metrics = model.sections[1].metrics;
  if (detail.kind === 'explore' && options.dungeonView !== undefined) {
    routePressurePanel(scene, detail, metrics, options, top);
    if (detail.taskTracker !== undefined) routeTaskTracker(scene, detail.taskTracker, options, top);
    const below = detail.lantern === undefined ? top - 98 * (750 / (options.viewportWidth ?? 320))
      : routeLanternChip(scene, detail.lantern, options, top);
    routeMinimap(scene, detail, options, below);
    return;
  }
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

function roomEventArtKey(event: RoomEventViewModel): string {
  if (event.kind === 'encounter' && event.monsterId !== undefined) return getInfiniteFlowMonsterWorldVisualKey(event.monsterId);
  const keys = INFINITE_FLOW_DUNGEON_PROP_VISUAL_KEYS;
  return event.kind === 'trap' ? keys.propTrap : keys.propExit;
}

export const ALARM_BANNER_SECONDS = 2.8;

/** The route prototype's alarm banner: a dark band across the room that fades after a few seconds and never takes input. */
function alarmBanner(scene: Node, banner: Readonly<{ title: string; line: string }>, y: number, px: number): Readonly<{ node: Node; fade: (age: number) => void }> {
  const height = 66 * px;
  const node = makeNode(scene, 'WalkAlarmBanner', 0, y, 750, height);
  const g = node.addComponent(Graphics);
  // Solid in the middle, fading out over the outer 18% on both sides.
  const edge = 750 * 0.18;
  rect(g, -375 + edge, -height / 2, 750 - edge * 2, height, new Color(11, 8, 6, 238));
  for (let step = 0; step < 8; step += 1) {
    const alpha = Math.round(238 * (step + 0.5) / 8);
    const width = edge / 8;
    rect(g, -375 + step * width, -height / 2, width, height, new Color(11, 8, 6, alpha));
    rect(g, 375 - (step + 1) * width, -height / 2, width, height, new Color(11, 8, 6, alpha));
  }
  const title = text(node, 'WalkAlarmBannerTitle', banner.title, 0, 12 * px, 600, 30 * px, 22 * px, new Color(255, 107, 82, 255));
  title.isBold = true;
  const line = text(node, 'WalkAlarmBannerLine', banner.line, 0, -16 * px, 640, 30 * px, 11 * px, new Color(225, 220, 203, 255));
  return {
    node,
    fade: (age) => {
      const alpha = Math.max(0, Math.min(1, (ALARM_BANNER_SECONDS - age) / 0.5));
      title.color = new Color(255, 107, 82, Math.round(255 * alpha));
      line.color = new Color(225, 220, 203, Math.round(255 * alpha));
      if (alpha === 0) node.active = false;
    },
  };
}

/** The route prototype's bottom sheet: portrait, kicker, title, story, numbers, then one-tap buttons. */
function roomEventSheet(scene: Node, model: GameViewModel, event: RoomEventViewModel, options: ReadyWalkSceneOptions, bottom: number, close: () => void): number {
  const vw = options.viewportWidth ?? 320;
  const px = 750 / vw;
  const compact = vw <= 350;
  const width = 750 - options.safeInsets.left - options.safeInsets.right - 20 * px;
  const pad = 14 * px;
  const headerHeight = 56 * px;
  const descSize = (compact ? 11.5 : 12.5) * px;
  const descLines = Math.max(1, Math.ceil(event.description.length * descSize / (width - pad * 2)));
  const descHeight = descLines * descSize * 1.45;
  const rowHeight = (compact ? 26 : 29) * px;
  const buttonHeight = (compact ? 46 : 52) * px;
  const height = pad + headerHeight + 8 * px + descHeight + 8 * px + event.rows.length * rowHeight + 12 * px + buttonHeight + pad;
  const sheet = makeNode(scene, 'WalkRoomEventSheet', (options.safeInsets.left - options.safeInsets.right) / 2, bottom + 10 * px + height / 2, width, height);
  sheet.addComponent(BlockInputEvents);
  paintRoomSheetFrame(sheet.addComponent(Graphics), width, height, px);
  let cursor = height / 2 - pad;
  const left = -width / 2 + pad;
  // Header: framed portrait, then kicker and title beside it.
  const art = 52 * px;
  const frame = makeNode(sheet, 'WalkRoomEventArtFrame', left + art / 2, cursor - art / 2, art, art).addComponent(Graphics);
  frame.lineWidth = px;
  rect(frame, -art / 2, -art / 2, art, art, new Color(14, 12, 10, 255), DARK_UI.edgeLight);
  const visual = options.visual(roomEventArtKey(event));
  const fit = Math.min((art - 4 * px) / visual.width, (art - 4 * px) / visual.height);
  const portrait = makeNode(frame.node, 'WalkRoomEventArt', 0, 0, visual.width * fit, visual.height * fit).addComponent(Sprite);
  portrait.sizeMode = Sprite.SizeMode.CUSTOM;
  portrait.spriteFrame = visual.frame;
  portrait.color = new Color(255, 255, 255, 255);
  options.trackSprite(portrait);
  const textLeft = left + art + 12 * px;
  const textWidth = width / 2 - pad - textLeft;
  text(sheet, 'WalkRoomEventKicker', event.kicker, textLeft + textWidth / 2, cursor - 12 * px, textWidth, 16 * px, 11 * px, DARK_UI.gold, false);
  const title = text(sheet, 'WalkRoomEventTitle', event.title, textLeft + textWidth / 2, cursor - 36 * px, textWidth, 26 * px, (compact ? 17 : 19) * px, DARK_UI.bone, false);
  title.isBold = true;
  cursor -= headerHeight + 8 * px;
  const desc = text(sheet, 'WalkRoomEventDescription', event.description, 0, cursor - descHeight / 2, width - pad * 2, descHeight, descSize, DARK_UI.muted, false);
  desc.verticalAlign = Label.VerticalAlign.TOP;
  cursor -= descHeight + 8 * px;
  // Number rows: label on the left, the value right-aligned in its tone.
  const rules = makeNode(sheet, 'WalkRoomEventRules', 0, 0, width, height).addComponent(Graphics);
  rules.lineWidth = Math.max(1, 0.6 * px);
  rules.strokeColor = new Color(DARK_UI.edge.r, DARK_UI.edge.g, DARK_UI.edge.b, 150);
  event.rows.forEach((row, index) => {
    const y = cursor - rowHeight / 2;
    rules.moveTo(left, cursor); rules.lineTo(width / 2 - pad, cursor); rules.stroke();
    text(sheet, `WalkRoomEventRowLabel:${row.id}`, row.label, left + 30 * px, y, 60 * px, rowHeight, 12.5 * px, DARK_UI.muted, false);
    const value = text(sheet, `WalkRoomEventRowValue:${row.id}`, row.value, (left + 64 * px + width / 2 - pad) / 2, y, width / 2 - pad - left - 64 * px, rowHeight, 12.5 * px, ROOM_SHEET.tones[row.tone], false);
    value.horizontalAlign = Label.HorizontalAlign.RIGHT;
    if (index === event.rows.length - 1) { rules.moveTo(left, cursor - rowHeight); rules.lineTo(width / 2 - pad, cursor - rowHeight); rules.stroke(); }
    cursor -= rowHeight;
  });
  cursor -= 12 * px;
  // Buttons: 收起 first, then the room's existing actions with the primary one last.
  const actions = model.sections[2].actions;
  const buttons: readonly Readonly<{ id: string; label: string; caption?: string; primary: boolean; action?: ViewActionModel }>[] = [
    { id: 'close', label: '收起', caption: '先看看门', primary: false },
    ...event.buttons.map(button => ({ ...button, id: button.actionId, action: actions.find(action => action.actionId === button.actionId) })),
  ];
  const gap = 8 * px;
  const buttonWidth = (width - pad * 2 - gap * (buttons.length - 1)) / buttons.length;
  buttons.forEach((button, index) => {
    const x = left + buttonWidth / 2 + index * (buttonWidth + gap);
    const node = makeNode(sheet, `WalkRoomEventButton:${button.id}`, x, cursor - buttonHeight / 2, buttonWidth, buttonHeight);
    const enabled = button.action === undefined ? button.id === 'close' : button.action.enabled;
    const g = node.addComponent(Graphics);
    paintRoomSheetButton(g, buttonWidth, buttonHeight, px, button.primary, enabled);
    const ink = button.primary && enabled ? ROOM_SHEET.primaryInk : enabled ? DARK_UI.bone : DARK_UI.muted;
    const caption = button.caption;
    const label = text(node, `WalkRoomEventButtonLabel:${button.id}`, button.label, 0, caption === undefined ? 0 : 8 * px, buttonWidth - 8 * px, 22 * px, (compact ? 14 : 15) * px, ink);
    label.isBold = true;
    if (caption !== undefined) {
      text(node, `WalkRoomEventButtonCaption:${button.id}`, caption, 0, -12 * px, buttonWidth - 8 * px, 16 * px, 10 * px,
        button.primary && enabled ? ROOM_SHEET.primaryCaption : DARK_UI.muted);
    }
    if (button.id === 'close') options.bindLocal(node, close);
    else if (button.action !== undefined) options.bindAction(node, button.action);
  });
  return bottom + 10 * px + height;
}

/** Approved combat v2 prototype geometry, in scene coordinates. */
export type CombatDuelLayout = Readonly<{
  pixel: number;
  compact: boolean;
  hero: WorldPoint;
  heroHeight: number;
  enemy: WorldPoint;
  enemyHeight: number;
  card: WorldRect;
  ticker: WorldRect;
  intent: WorldRect;
  attack: Readonly<{ x: number; y: number; diameter: number }>;
  /** Guard, spells, talisman and medicines on an arc around the attack button; square touch boxes never overlap. */
  skills: readonly Readonly<{ x: number; y: number; diameter: number }>[];
  escape: Readonly<{ x: number; y: number; diameter: number }>;
}>;

/** Combat stands the hero and the enemy diagonally across the room; movement is suspended. */
export function getCombatDuelLayout(input: DungeonHtmlRoomInput): CombatDuelLayout {
  const px = 750 / input.viewportWidth;
  const compact = input.viewportWidth <= 350;
  const safeWidth = 750 - input.safeInsets.left - input.safeInsets.right;
  const left = -safeWidth / 2;
  const right = safeWidth / 2;
  const top = input.surfaceHeight / 2 - input.safeInsets.top;
  const bottom = -input.surfaceHeight / 2 + input.safeInsets.bottom;
  const attackSize = (compact ? 76 : 92) * px;
  const skillSize = (compact ? 48 : 56) * px;
  const radius = (compact ? 98 : 120) * px;
  const escapeSize = (compact ? 46 : 54) * px;
  // 30px below the button holds the focus readout inside the safe area.
  const attack = { x: right - 14 * px - attackSize / 2, y: bottom + 30 * px + attackSize / 2, diameter: attackSize };
  // Uneven spacing keeps each satellite's square touch box clear of its neighbours (>= 3.9px at 320px).
  const skills = [188, 157, 113, 82].map(degrees => ({
    x: attack.x + Math.cos(degrees * Math.PI / 180) * radius,
    y: attack.y + Math.sin(degrees * Math.PI / 180) * radius,
    diameter: skillSize,
  }));
  const cardHeight = (compact ? 42 : 46) * px;
  const cardTop = top - 98 * px;
  const card = { x: left + 10 * px, y: cardTop - cardHeight, width: safeWidth - 20 * px, height: cardHeight };
  const tickerHeight = 22 * px;
  const tickerWidth = Math.min(safeWidth - 24 * px, 340 * px);
  const ticker = { x: -tickerWidth / 2, y: card.y - 6 * px - tickerHeight, width: tickerWidth, height: tickerHeight };
  const stageTop = ticker.y - 8 * px;
  const stageBottom = bottom + 16 * px;
  const band = (stageTop - stageBottom) / px;
  const enemyHeight = Math.max(130, Math.min(260, band * 0.44)) * px;
  const heroHeight = Math.max(100, Math.min(200, band * 0.36)) * px;
  const enemy = { x: left + safeWidth * 0.7, y: stageTop - 6 * px - enemyHeight };
  const hero = { x: left + safeWidth * 0.27, y: stageBottom + band * 0.12 * px };
  const intentWidth = (compact ? 128 : 150) * px;
  const intentHeight = (compact ? 40 : 44) * px;
  const intentRight = enemy.x - enemyHeight * 0.17;
  const intent = { x: Math.max(left + 8 * px, intentRight - intentWidth), y: enemy.y + enemyHeight * 0.66 - intentHeight / 2, width: intentWidth, height: intentHeight };
  return {
    pixel: px, compact, hero, heroHeight, enemy, enemyHeight, card, ticker, intent, attack, skills,
    escape: { x: left + 12 * px + escapeSize / 2, y: bottom + 16 * px + escapeSize / 2, diameter: escapeSize },
  };
}

const DUEL = Object.freeze({
  face: new Color(42, 33, 21, 236),
  faceReady: new Color(98, 66, 25, 244),
  faceMuted: new Color(27, 25, 21, 224),
  rim: new Color(198, 163, 107, 255),
  rimReady: new Color(255, 224, 160, 255),
  rimMuted: new Color(86, 79, 63, 255),
  glow: new Color(242, 196, 117, 90),
  focusOff: new Color(59, 49, 34, 255),
  focusOn: new Color(242, 196, 117, 255),
  enemyFace: new Color(29, 15, 12, 236),
  enemyRim: new Color(122, 62, 46, 255),
  danger: new Color(229, 128, 111, 255),
  dangerFace: new Color(62, 22, 14, 238),
  chip: new Color(242, 196, 117, 255),
  chipText: new Color(42, 21, 5, 255),
  hp: new Color(205, 74, 56, 255),
  hpTrack: new Color(12, 10, 8, 255),
});

const INTENT_ACTION_LABELS: Readonly<Partial<Record<NonNullable<ViewActionModel['combatAction']>, string>>> = {
  guard: '防御', attack: '攻击', art: '法术', weapon_skill: '战技', use_thunder_talisman: '雷火符', use_healing_pill: '止血丹',
};

function duelCircle(node: Node, diameter: number, face: Color, rim: Color, rimWidth: number, glow?: Color): void {
  const g = node.addComponent(Graphics);
  if (glow !== undefined) {
    g.circle(0, 0, diameter / 2 + rimWidth * 2.5);
    g.fillColor = glow;
    g.fill();
  }
  g.circle(0, 0, diameter / 2);
  g.fillColor = face;
  g.fill();
  g.lineWidth = rimWidth;
  g.strokeColor = rim;
  g.stroke();
  g.circle(0, 0, diameter / 2 - rimWidth * 2.2);
  g.lineWidth = Math.max(1, rimWidth * 0.5);
  g.strokeColor = new Color(0, 0, 0, 90);
  g.stroke();
}

function duelIcon(parent: Node, name: string, icon: Parameters<typeof paintDarkIcon>[1], size: number, x: number, y: number, color: Color): void {
  const mark = makeNode(parent, name, x, y, 50, 50).addComponent(Graphics);
  paintDarkIcon(mark, icon, color);
  mark.node.setScale(new Vec3(size / 50, size / 50, 1));
}

function duelChip(parent: Node, name: string, value: string, x: number, y: number, px: number): void {
  const width = (value.length * 9 + 8) * px;
  const chip = makeNode(parent, name, x, y, width, 14 * px);
  rect(chip.addComponent(Graphics), -width / 2, -7 * px, width, 14 * px, DUEL.chip);
  text(chip, `${name}Label`, value, 0, 0, width, 14 * px, 9 * px, DUEL.chipText);
}

/** Round touch control; the real action binding and disabled reasons stay with the View. */
function duelButton(scene: Node, name: string, label: string, icon: Parameters<typeof paintDarkIcon>[1],
  slot: Readonly<{ x: number; y: number; diameter: number }>, state: 'ready' | 'muted' | 'recommended', px: number): Node {
  const base = makeNode(scene, name, slot.x, slot.y, slot.diameter, slot.diameter);
  const muted = state === 'muted';
  duelCircle(base, slot.diameter, muted ? DUEL.faceMuted : DUEL.face, state === 'recommended' ? DUEL.rimReady : muted ? DUEL.rimMuted : DUEL.rim,
    (state === 'recommended' ? 2.5 : 1.5) * px, state === 'recommended' ? DUEL.glow : undefined);
  duelIcon(base, `${name}Icon`, icon, slot.diameter * 0.36, 0, slot.diameter * 0.12, muted ? DARK_UI.muted : DUEL.focusOn);
  const title = text(base, `${name}Label`, label, 0, -slot.diameter * 0.24, slot.diameter * 0.9, 14 * px, (slot.diameter < 50 * px ? 9 : 10) * px,
    muted ? DARK_UI.muted : WALK_HUD.text);
  title.enableWrapText = false;
  return base;
}

function combatDuelControls(scene: Node, model: GameViewModel, options: WalkSceneOptions, duel: CombatDuelLayout): void {
  if (model.phase !== 'combat') return;
  const px = duel.pixel;
  const actions = model.sections[2].actions;
  const detail = model.sections[1].detail;
  const weapon = actions.find(action => action.combatAction === 'weapon_skill' && action.enabled && action.event !== undefined);
  const attack = weapon ?? actions.find(action => action.combatAction === 'attack');
  const busy = options.chrome.busyActionId !== undefined || options.chrome.modeKind === 'blocked';
  const stateOf = (action: ViewActionModel | undefined): 'ready' | 'muted' | 'recommended' =>
    action === undefined || !action.enabled || action.event === undefined || busy ? 'muted'
      : action.recommendation === 'recommended' ? 'recommended' : 'ready';
  const guard = actions.find(action => action.combatAction === 'guard');
  const talisman = actions.find(action => action.combatAction === 'use_thunder_talisman');
  const escape = actions.find(action => action.combatAction === 'escape');
  const slots = [
    { kind: 'action', action: guard, label: '防御', icon: 'guard' as const, slot: duel.skills[0]! },
    { kind: 'choice', group: 'spells' as const, label: '法术', icon: 'arcane' as const, slot: duel.skills[1]! },
    { kind: 'action', action: talisman, label: '雷火符', icon: 'arcane' as const, slot: duel.skills[2]! },
    { kind: 'choice', group: 'medicines' as const, label: '药品', icon: 'bag' as const, slot: duel.skills[3]! },
  ];
  for (const entry of slots) {
    if (entry.kind === 'choice') {
      const name = `WalkCombatChoice:${entry.group}`;
      const choice = duelButton(scene, name, entry.label, entry.icon, entry.slot, busy ? 'muted' : 'ready', px);
      if (!busy) options.bindLocal(choice, () => options.openCombatChoices(entry.group!));
      continue;
    }
    const action = entry.action;
    if (action === undefined) continue;
    const state = stateOf(action);
    const node = duelButton(scene, `WalkCombatAction:${action.actionId}`, entry.label, entry.icon, entry.slot, state, px);
    if (action.combatAction === 'guard' && (state === 'recommended' || action.parryEvent !== undefined) && !busy) {
      duelChip(node, 'WalkCombatGuardChip', action.parryEvent !== undefined ? '可格挡' : '推荐', -entry.slot.diameter * 0.18, entry.slot.diameter / 2 + 2 * px, px);
    }
    options.bindAction(node, action);
  }
  if (escape !== undefined) {
    const node = duelButton(scene, `WalkCombatAction:${escape.actionId}`, '脱离', 'left', duel.escape, stateOf(escape) === 'muted' ? 'muted' : 'ready', px);
    options.bindAction(node, escape);
  }
  if (attack === undefined) return;
  const ready = attack.enabled && attack.event !== undefined && !busy;
  const name = `WalkCombatAction:${attack.actionId}`;
  const slot = duel.attack;
  const base = makeNode(scene, name, slot.x, slot.y, slot.diameter, slot.diameter);
  const focus = detail.kind === 'combat' ? detail.focus : { current: 0, required: 3 };
  // Three focus segments circle the button; a full gauge turns it into the weapon skill.
  const ring = makeNode(base, 'WalkCombatFocusRing', 0, 0, slot.diameter + 18 * px, slot.diameter + 18 * px).addComponent(Graphics);
  ring.lineWidth = 6 * px;
  ring.lineCap = Graphics.LineCap.ROUND;
  const segmentRadius = slot.diameter / 2 + 9 * px;
  const segments = Math.max(1, focus.required);
  for (let index = 0; index < segments; index += 1) {
    const from = Math.PI / 2 - index * Math.PI * 2 / segments - 0.14;
    const to = Math.PI / 2 - (index + 1) * Math.PI * 2 / segments + 0.14;
    ring.strokeColor = index < focus.current ? DUEL.focusOn : DUEL.focusOff;
    for (let step = 0; step <= 12; step += 1) {
      const angle = from + (to - from) * step / 12;
      const x = Math.cos(angle) * segmentRadius;
      const y = Math.sin(angle) * segmentRadius;
      if (step === 0) ring.moveTo(x, y); else ring.lineTo(x, y);
    }
    ring.stroke();
  }
  duelCircle(base, slot.diameter, weapon !== undefined && ready ? DUEL.faceReady : ready ? DUEL.face : DUEL.faceMuted,
    weapon !== undefined && ready ? DUEL.rimReady : ready ? DUEL.rim : DUEL.rimMuted, 2.5 * px, weapon !== undefined && ready ? DUEL.glow : undefined);
  duelIcon(base, `${name}Icon`, 'sword', slot.diameter * 0.34, 0, slot.diameter * 0.16, ready ? DUEL.focusOn : DARK_UI.muted);
  const title = text(base, `${name}Label`, weapon === undefined ? '攻击' : '战技', 0, -slot.diameter * 0.12, slot.diameter * 0.8, 18 * px,
    (duel.compact ? 13 : 15) * px, ready ? WALK_HUD.text : DARK_UI.muted);
  title.enableWrapText = false;
  title.isBold = true;
  text(base, 'WalkCombatAttackMode', weapon === undefined ? '普攻' : '战意已满', 0, -slot.diameter * 0.29, slot.diameter * 0.8, 12 * px,
    (duel.compact ? 8 : 9) * px, ready ? DUEL.focusOn : DARK_UI.muted);
  text(base, 'WalkCombatFocus', `战意 ${focus.current} / ${focus.required}`, 0, -slot.diameter / 2 - 22 * px, slot.diameter + 20 * px, 12 * px,
    (duel.compact ? 8 : 9) * px, weapon === undefined ? DARK_UI.muted : DUEL.focusOn);
  options.bindAction(base, attack);
}

/** Enemy card, last log line and the intent callout that replace the exploration risk strip. */
function combatDuelHud(scene: Node, model: GameViewModel, options: ReadyWalkSceneOptions, duel: CombatDuelLayout): void {
  const detail = model.sections[1].detail;
  if (detail.kind !== 'combat') return;
  const px = duel.pixel;
  const monster = options.spec.targets.find(target => target.kind === 'monster');
  const rank = detail.pursuer ? '追兵 · ' : monster?.rank === 'boss' ? '首领 · ' : monster?.rank === 'elite' ? '精英 · ' : '';
  const card = makeNode(scene, 'WalkEnemyCard', duel.card.x + duel.card.width / 2, duel.card.y + duel.card.height / 2, duel.card.width, duel.card.height);
  paintDarkFrame(card.addComponent(Graphics), duel.card.width, duel.card.height, { fill: DUEL.enemyFace, edge: DUEL.enemyRim, accent: DUEL.danger, cut: 8 * px });
  const cardLeft = -duel.card.width / 2;
  const medalSize = duel.card.height - 10 * px;
  const medal = makeNode(card, 'WalkCombatTurn', cardLeft + 6 * px + medalSize / 2, 0, medalSize, medalSize);
  const diamond = medal.addComponent(Graphics);
  diamond.lineWidth = 1.5 * px;
  polygon(diamond, [[0, medalSize / 2], [medalSize / 2, 0], [0, -medalSize / 2], [-medalSize / 2, 0]], new Color(43, 34, 20, 255), DUEL.rim);
  text(medal, 'WalkCombatTurnCaption', '回合', 0, medalSize * 0.2, medalSize, 10 * px, 7 * px, DARK_UI.muted);
  text(medal, 'WalkCombatTurnValue', `${detail.turn}`, 0, -medalSize * 0.12, medalSize, 16 * px, 14 * px, DUEL.focusOn).isBold = true;
  const bodyLeft = cardLeft + 12 * px + medalSize;
  const bodyWidth = duel.card.width / 2 - 8 * px - bodyLeft;
  const name = text(card, 'WalkEnemyName', `${rank}${detail.enemy.name}`, bodyLeft + bodyWidth * 0.33, 8 * px, bodyWidth * 0.66, 16 * px,
    (duel.compact ? 11 : 12) * px, DARK_UI.bone, false);
  name.isBold = true;
  text(card, 'WalkEnemyHealthLabel', `${detail.enemy.hp} / ${detail.enemy.maxHp}`, bodyLeft + bodyWidth * 0.83, 8 * px, bodyWidth * 0.34, 16 * px,
    (duel.compact ? 10 : 11) * px, new Color(239, 214, 196, 255));
  const healthHeight = 9 * px;
  const health = makeNode(card, 'WalkEnemyHealth', bodyLeft + bodyWidth / 2, -9 * px, bodyWidth, healthHeight).addComponent(Graphics);
  paintEnemyHealth(health, detail.enemy.hpPercent / 100, bodyWidth, healthHeight);

  const latest = model.sections[5].lines[0];
  if (latest !== undefined) {
    const ticker = makeNode(scene, 'WalkCombatTicker', duel.ticker.x + duel.ticker.width / 2, duel.ticker.y + duel.ticker.height / 2, duel.ticker.width, duel.ticker.height);
    const backing = ticker.addComponent(Graphics);
    backing.lineWidth = px;
    rect(backing, -duel.ticker.width / 2, -duel.ticker.height / 2, duel.ticker.width, duel.ticker.height, new Color(14, 12, 9, 200), new Color(75, 61, 39, 255));
    const line = text(ticker, 'WalkCombatTickerText', latest, 0, 0, duel.ticker.width - 16 * px, duel.ticker.height, (duel.compact ? 10 : 11) * px, new Color(231, 217, 189, 255));
    line.enableWrapText = false;
  }

  // The callout steps aside while a turn plays out, like the prototype.
  if (options.chrome.busyActionId !== undefined) return;
  const parry = detail.intent.parryable;
  const danger = detail.intent.severity === 'danger' || parry;
  const intent = makeNode(scene, 'WalkEnemyIntent', duel.intent.x + duel.intent.width / 2, duel.intent.y + duel.intent.height / 2, duel.intent.width, duel.intent.height);
  const bubble = intent.addComponent(Graphics);
  bubble.lineWidth = 1.5 * px;
  const halfWidth = duel.intent.width / 2;
  const halfHeight = duel.intent.height / 2;
  polygon(bubble, [[-halfWidth, -halfHeight], [halfWidth, -halfHeight], [halfWidth, -6 * px], [halfWidth + 8 * px, 0], [halfWidth, 6 * px], [halfWidth, halfHeight], [-halfWidth, halfHeight]],
    danger ? DUEL.dangerFace : new Color(32, 26, 18, 240), danger ? DUEL.danger : new Color(139, 112, 70, 255));
  duelIcon(intent, 'WalkEnemyIntentIcon', parry ? 'guard' : 'sword', 22 * px, -halfWidth + 17 * px, 0, danger ? new Color(255, 180, 163, 255) : DUEL.focusOn);
  const recommended = detail.intent.recommendedActions.map(action => INTENT_ACTION_LABELS[action]).filter((label): label is string => label !== undefined);
  const summary = parry ? '重击 · 防御大减伤' : detail.intent.id === 'regular-pursuit' ? '行动后常规反击'
    : recommended.length > 0 ? `建议：${recommended.slice(0, 2).join('、')}` : '留意敌方机制';
  const textLeft = -halfWidth + 32 * px;
  const textWidth = duel.intent.width - 38 * px - (parry ? 34 * px : 0);
  const title = text(intent, 'WalkEnemyIntentName', detail.intent.name, textLeft + textWidth / 2, 7 * px, textWidth, 16 * px,
    (duel.compact ? 11 : 12) * px, danger ? new Color(255, 190, 175, 255) : DUEL.focusOn, false);
  title.isBold = true;
  text(intent, 'WalkEnemyIntentSummary', summary, textLeft + (duel.intent.width - 38 * px) / 2, -8 * px, duel.intent.width - 38 * px, 13 * px,
    (duel.compact ? 9 : 10) * px, danger ? new Color(243, 201, 188, 255) : DARK_UI.muted, false);
  if (parry) duelChip(intent, 'WalkEnemyIntentChip', '可格挡', halfWidth - 20 * px, 7 * px, px);
}

function paintEnemyHealth(g: Graphics, ratio: number, width: number, height: number): void {
  g.clear();
  rect(g, -width / 2, -height / 2, width, height, DUEL.hpTrack, new Color(63, 51, 34, 255));
  rect(g, -width / 2 + 1, -height / 2 + 1, (width - 2) * Math.max(0, Math.min(1, ratio)), height - 2, DUEL.hp);
}

/** Creates one persistent world. tick moves actors/camera and never recreates the root. */
export function renderInfiniteFlowWalkScene(root: Node, model: GameViewModel, sceneOptions: WalkSceneOptions): WalkSceneHandle {
  const readyOptions = readyWalkSceneOptions(sceneOptions, model);
  const roomFit = model.phase === 'explore' || model.phase === 'combat' ? getDungeonHtmlRoomLayout({
    worldWidth: readyOptions.spec.width, worldHeight: readyOptions.spec.height,
    surfaceHeight: readyOptions.surfaceHeight, viewportWidth: readyOptions.viewportWidth ?? 320, safeInsets: readyOptions.safeInsets,
  }) : undefined;
  const duel = roomFit !== undefined && model.phase === 'combat' ? getCombatDuelLayout({
    worldWidth: readyOptions.spec.width, worldHeight: readyOptions.spec.height,
    surfaceHeight: readyOptions.surfaceHeight, viewportWidth: readyOptions.viewportWidth ?? 320, safeInsets: readyOptions.safeInsets,
  }) : undefined;
  const fittedSpec = roomFit === undefined ? readyOptions.spec : fitDungeonHtmlTargets(readyOptions.spec, roomFit);
  // The duel only moves view-local feet; every target keeps its action, radius and identity.
  const stagedSpec = duel === undefined || roomFit === undefined ? fittedSpec : { ...fittedSpec, targets: fittedSpec.targets.map(target =>
    target.kind === 'monster' ? { ...target, ...roomFit.unproject(duel.enemy) } : target) };
  const options: ReadyWalkSceneOptions = roomFit === undefined ? readyOptions : { ...readyOptions, spec: stagedSpec, dungeonView: {
    worldPixel: roomFit.hudPixel, gateHeight: roomFit.artwork.gateHeight,
    monsterHeight: duel === undefined ? roomFit.artwork.monsterHeight : duel.enemyHeight / roomFit.hudPixel,
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
  // The duel stands the hero below the exploration controls band, so its clip reaches the safe bottom.
  const roomRect = roomFit === undefined ? undefined : duel === undefined ? roomFit.roomRect
    : { ...roomFit.roomRect, y: bottom, height: roomFit.roomRect.y + roomFit.roomRect.height - bottom };
  const viewportHeight = roomRect?.height ?? options.surfaceHeight;
  const viewportWidth = roomRect?.width ?? 750;
  const viewportCenter = roomRect === undefined ? { x: (options.safeInsets.right - options.safeInsets.left) / 2, y: 0 }
    : { x: roomRect.x + viewportWidth / 2, y: roomRect.y + viewportHeight / 2 };
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
    if (duel !== undefined && target.kind === 'transition') return;
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
    } else if (roomFit !== undefined && duel === undefined && options.roomEventSheet === undefined
      && target.kind === 'transition' && target.id.startsWith('door:')) {
      // As in the route prototype, tapping a door walks there and goes through on arrival;
      // a shut door stays put and says why instead.
      const pixel = roomFit.hudPixel;
      const gateHeight = roomFit.artwork.gateHeight * pixel;
      const touch = makeNode(actor.node, 'WalkTargetTouch', 0, (gateHeight - 30 * pixel) / 2, Math.max(104, 84 * pixel), gateHeight + 30 * pixel);
      options.bindLocal(touch, () => target.disabledReason === undefined ? approachTarget(target) : showNotice(target.disabledReason));
    }
  });

  const duelMark = duel === undefined || roomFit === undefined ? undefined : roomFit.unproject(duel.hero);
  const shownPosition = duelMark ?? options.position;
  const player = makeNode(actors, 'WalkPlayer', shownPosition.x, -shownPosition.y, 104, 108);
  if (actorScale !== undefined) player.setScale(new Vec3(actorScale.x, actorScale.y, 1));
  const playerSize = roomFit === undefined ? courtyard ? 172 : 104
    : (duel === undefined ? roomFit.artwork.heroVisibleHeight * hudPixel : duel.heroHeight) * 336 / 308;
  const playerBodyY = roomFit === undefined ? courtyard ? 78 : 47 : playerSize * (320.16 - 168) / 336;
  shadow(player, roomFit === undefined ? courtyard ? 31 : 24 : 15 * options.dungeonView!.worldPixel, roomFit === undefined ? courtyard ? 7.5 : 9 : 3 * options.dungeonView!.worldPixel);
  const body = makeNode(player, 'WalkPlayerBody', 0, 0, playerSize, playerSize);
  const walkerFrames = options.walkerFrames;
  body.setPosition(new Vec3(0, playerBodyY, 0));
  const playerSprite = body.addComponent(Sprite);
  playerSprite.sizeMode = Sprite.SizeMode.CUSTOM;
  // Keep the shared logical canvas so trimmed poses retain one ground point.
  playerSprite.trim = false;
  playerSprite.spriteFrame = walkerFrames[courtyard || duel !== undefined ? 8 : 0]!;
  playerSprite.color = new Color(255, 255, 255, 255);
  options.trackSprite(playerSprite);
  if (courtyard) text(player, 'WalkPlayerName', '轮回者', 0, 180, 150, 24, 12, new Color(190, 241, 217, 255));
  const playerDepth: DepthItem = { node: player, y: shownPosition.y };
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
  header(scene, model, options, top);
  const roomEvent = detail.kind === 'explore' && options.roomEventSheet !== undefined ? detail.roomEvent : undefined;
  let roomEventTop: number | undefined;
  if (roomEvent !== undefined) {
    // The sheet owns the controls band while it is open; walking resumes once it closes.
    joystick.active = false;
    interact.active = false;
    roomEventTop = roomEventSheet(scene, model, roomEvent, options, bottom, options.roomEventSheet!.close);
  }
  if (duel !== undefined) {
    // Combat suspends walking: the stage, not the joystick, positions both fighters.
    joystick.active = false;
    interact.active = false;
    combatDuelHud(scene, model, options, duel);
    combatDuelControls(scene, model, options, duel);
  }

  let position: WorldPoint = { x: options.position.x, y: options.position.y };
  let facing: Facing = courtyard || duel !== undefined ? 'right' : 'down';
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

  // Exploration keeps the band under the header for the pressure panel; its notices sit between the controls.
  const toastBand = model.phase === 'explore' && roomFit !== undefined ? {
    left: controlsLeft + ((roomFit.artwork.compact ? 17 : 18) + joystickSize + 6) * hudPixel,
    right: controlsRight - 17 * hudPixel - interactWidth - 6 * hudPixel,
  } : undefined;
  const destinationMarker = courtyard ? makeNode(camera, 'WalkDestinationMarker', 0, 0, 36, 17).addComponent(Graphics) : undefined;
  let path: WorldPoint[] = [];
  let pendingTarget: WorldTarget | undefined;
  let stuckTime = 0;
  const routeNotice = courtyard ? text(scene, 'WalkRouteNotice', '', 0, top - 155 * hudPixel, 310 * hudPixel, 26 * hudPixel, 11 * hudPixel, DARK_UI.gold)
    : toastBand !== undefined && options.roomEventSheet === undefined
      ? inkDotTextShadow(text(scene, 'WalkRouteNotice', '', (toastBand.left + toastBand.right) / 2, bottom + 60 * hudPixel,
        toastBand.right - toastBand.left, 34 * hudPixel, 10 * hudPixel, DARK_UI.gold))
      : undefined;
  let noticeExpires = 0;
  const showNotice = (message: string): void => {
    if (routeNotice === undefined) return;
    // In a room the notice shares the toast's band, so it replaces the fading toast.
    if (toastBand !== undefined && toast !== undefined) toast.node.active = false;
    routeNotice.string = message;
    noticeExpires = age + 3;
  };
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
      showNotice('此处无法到达，请从旁边绕行。');
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
  const approachTarget = (target: WorldTarget): void => beginRoute(walkApproachPoint(spec, target, position), target);
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
  const toast = feedbackText === undefined ? undefined : roomEventTop !== undefined
    ? inkDotTextShadow(text(scene, 'WalkFeedback', feedbackText, 0, roomEventTop + 16 * hudPixel, 600, 24 * hudPixel, 10 * hudPixel, failed ? DARK_UI.red : DARK_UI.gold))
    : toastBand !== undefined
    ? inkDotTextShadow(text(scene, 'WalkFeedback', feedbackText, (toastBand.left + toastBand.right) / 2, bottom + 60 * hudPixel,
      toastBand.right - toastBand.left, 34 * hudPixel, 10 * hudPixel, failed ? DARK_UI.red : DARK_UI.gold))
    : text(scene, 'WalkFeedback', feedbackText, -49, top - 124 * hudPixel, 554, 24 * hudPixel, 10 * hudPixel, failed ? DARK_UI.red : DARK_UI.gold);
  const banner = options.banner === undefined ? undefined : alarmBanner(scene, options.banner, top - safeHeight * 0.36, hudPixel);
  const bannerStart = options.banner?.age ?? 0;
  banner?.fade(bannerStart);
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
      const card = scene.getChildByName('WalkEnemyCard');
      const label = card?.getChildByName('WalkEnemyHealthLabel')?.getComponent(Label);
      if (label !== undefined && label !== null) label.string = `${values.enemyHp} / ${detail.enemy.maxHp}`;
      const health = card?.getChildByName('WalkEnemyHealth')?.getComponent(Graphics);
      if (health !== undefined && health !== null) {
        const size = health.node.getComponent(UITransform)!.contentSize;
        paintEnemyHealth(health, values.enemyHp / detail.enemy.maxHp, size.width, size.height);
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
  const enemySprite = enemyArt?.getComponent(Sprite) ?? undefined;
  const timingCatcher = duel === undefined ? undefined : makeNode(scene, 'WalkCombatTimingCatcher', 0, 0, 750, options.surfaceHeight);
  if (timingCatcher !== undefined) timingCatcher.active = false;
  // Busy renders dispose walking input, so the parry window owns its own Space
  // listener and releases it whenever the window closes, cancels or disposes.
  const timingKey = (event: EventKeyboard): void => { if (event.keyCode === KeyCode.SPACE) effects?.tap(); };
  let timingKeyBound = false;
  const bindTimingKey = (active: boolean): void => {
    if (active === timingKeyBound) return;
    timingKeyBound = active;
    if (active) input.on(Input.EventType.KEY_DOWN, timingKey);
    else input.off(Input.EventType.KEY_DOWN, timingKey);
  };
  const viewportRest = viewportCenter;
  const effects = effectsMask === undefined ? undefined : createInfiniteFlowCombatEffects(effectsMask, {
    pixel: hudPixel,
    ...(duel === undefined ? {} : { actorUnit: duel.heroHeight / 200, dashGap: duel.enemyHeight * 0.42 }),
    shakeWorld: offset => viewport.setPosition(new Vec3(viewportRest.x + offset.x, viewportRest.y + offset.y, 0)),
    tintPlayer: color => { playerSprite.color = color ?? new Color(255, 255, 255, 255); },
    tintEnemy: color => { if (enemySprite !== undefined) enemySprite.color = color ?? new Color(255, 255, 255, 255); },
    setTimingCatcher: active => {
      if (timingCatcher === undefined) return;
      timingCatcher.active = active;
      bindTimingKey(active);
    },
    getAnchors: () => {
      if (roomFit !== undefined) {
        const playerFoot = roomFit.project(duelMark ?? position);
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

  timingCatcher?.on(Node.EventType.TOUCH_START, (event: { propagationStopped?: boolean }) => {
    effects?.tap();
    event.propagationStopped = true;
  });

  const updateInteraction = (): void => {
    nearby = nearestWalkTarget(spec, position);
    if (interactionInitialized && targetId === nearby?.id) return;
    interactionInitialized = true;
    targetId = nearby?.id;
    for (const entry of transitionStates) {
      const forecast = entry.target.forecast;
      entry.label.string = forecast !== undefined
        ? entry.target.id === targetId && entry.target.disabledReason === undefined ? '已到达入口' : getRouteForecastCaption(forecast).text
        : entry.target.action === undefined ? '封闭' : entry.target.disabledReason !== undefined ? '入口未开放'
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
  if (duel === undefined) updateInteraction();

  return {
    joystick,
    joystickThumb,
    getPosition: () => ({ x: position.x, y: position.y }),
    getFacing: () => facing,
    cancelApproach,
    updateCombatReadout,
    isCombatAnimating: () => effects?.isPlaying() ?? false,
    startCombatAction: (kind, onImpact, startOptions) => {
      if (disposed || effects === undefined) return false;
      return effects.start(kind, onImpact, startOptions);
    },
    tapCombatTiming: () => !disposed && (effects?.tap() ?? false),
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
      const movingBlocked = busy || duel !== undefined || (effects?.isPlaying() ?? false);
      let movement = axis;
      let next = movingBlocked ? position : stepWalkPosition(spec, position, axis, elapsed);
      if (axis.x !== 0 || axis.y !== 0) cancelApproach();
      else if (path.length > 0 && !movingBlocked) {
        let remaining = elapsed;
        const speed = walkAxisSpeed(spec);
        // Reach each clear segment's endpoint before turning. Consume only its
        // actual travel time, so touching a tangent never cuts the foot corner
        // and crossing a waypoint cannot add movement to the current frame.
        while (path.length > 0 && remaining > 1e-10) {
          const waypoint = path[0]!;
          const dx = (waypoint.x - next.x) / speed.x;
          const dy = (waypoint.y - next.y) / speed.y;
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
        // Rooms walk at twice the original pace, so their 9 fps stride doubles to keep the feet planted.
        gait += elapsed * (courtyard ? 9 : 18);
      } else gait = 0;
      if (path.length > 0) {
        stuckTime = moved ? 0 : stuckTime + elapsed;
        if (stuckTime > 0.4) {
          cancelApproach();
          showNotice('前方有障碍，请从旁边绕行。');
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
      if (duel === undefined) updateInteraction();
      if (toast !== undefined && !failed) toast.color = new Color(DARK_UI.gold.r, DARK_UI.gold.g, DARK_UI.gold.b, Math.round(255 * Math.max(0, Math.min(1, 4 - age))));
      if (banner !== undefined && banner.node.active) banner.fade(bannerStart + age);
      effects?.tick(elapsed);
    },
    dispose: () => { disposed = true; cancelApproach(); effects?.dispose(); scene.destroy(); },
  };
}
