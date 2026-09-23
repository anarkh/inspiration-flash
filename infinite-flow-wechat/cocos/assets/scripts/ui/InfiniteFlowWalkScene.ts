import { Color, Graphics, Label, Mask, Node, Size, Sprite, UITransform, Vec3 } from 'cc';
import type { SpriteFrame } from 'cc';
import type { GameViewModel, ViewActionModel } from '@infinite-flow/presentation';
import { formatInfiniteFlowPlayerChrome } from './InfiniteFlowView';
import type { InfiniteFlowRuntimeChrome } from './InfiniteFlowView';
import { nearestWalkTarget, stepWalkPosition } from './walk-world';
import type { WalkWorldSpec, WorldPoint, WorldRect, WorldTarget } from './walk-world';
import { HUB_WORLD_THEME } from './dungeon-world-theme';
import type { DungeonWorldTheme, WorldTint } from './dungeon-world-theme';
import { getInfiniteFlowSceneVisualKeys } from './scene-visuals';
import { DARK_UI, paintDarkFrame, paintDarkIcon } from './dark-ui';

export type WalkSceneOptions = Readonly<{
  spec: WalkWorldSpec;
  position: WorldPoint;
  safeInsets: Readonly<{ top: number; right: number; bottom: number; left: number }>;
  /** Real visible fixed-width design surface height (>= 1334 on tall phones). */
  surfaceHeight: number;
  visual: (key: string) => Readonly<{ frame: SpriteFrame; width: number; height: number }> | undefined;
  walkerFrames?: readonly SpriteFrame[];
  trackSprite: (sprite: Sprite) => void;
  bindAction: (node: Node, action: ViewActionModel) => void;
  bindLocal: (node: Node, callback: () => void) => void;
  bindHelp: (node: Node) => void;
  bindInteract: (node: Node, getTarget: () => WorldTarget | undefined) => void;
  openDetails: () => void;
  openCodex: () => void;
  openPanel?: (panel: 'character' | 'inventory' | 'map' | 'objectives' | 'log' | 'menu') => void;
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
  dispose: () => void;
}>;

type Facing = ReturnType<WalkSceneHandle['getFacing']>;
type DepthItem = { node: Node; y: number };
type Flame = Readonly<{ graphics: Graphics; offset: number }>;

const WORLD_ZOOM = 1.1;
const WHITE = new Color(244, 235, 211, 255);
const MUTED = new Color(184, 172, 150, 255);
const GOLD = new Color(236, 195, 117, 255);
// 玄黑金箓: actors and interaction magic read as red-gold bronze rather than teal.
const TEAL = new Color(197, 168, 106, 255);
const RED = new Color(214, 100, 82, 255);
const INK = new Color(18, 15, 12, 255);
const EDGE = new Color(96, 82, 62, 255);
const SKIN = new Color(217, 174, 131, 255);

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

function rounded(g: Graphics, x: number, y: number, width: number, height: number, radius: number, color: Color): void {
  g.fillColor = color;
  g.roundRect(x, y, width, height, radius);
  g.fill();
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

/** Every limb shares the feet anchor; the fallback remains a walking full-body actor. */
function drawHuman(g: Graphics, facing: Facing, stride: number, npc = false, palette = TEAL): void {
  g.clear();
  const side = facing === 'left' ? -1 : facing === 'right' ? 1 : 0;
  const up = facing === 'up';
  const step = Math.sin(stride * Math.PI / 2) * 4;
  const coat = npc ? new Color(palette.r * 0.53, palette.g * 0.53, palette.b * 0.53, 255) : new Color(58, 46, 32, 255);
  const dark = new Color(30, 26, 21, 255);
  const hair = new Color(48, 43, 43, 255);
  const shoulder = side === 0 ? 16 : 12;
  rounded(g, -11, 2 + step, 9, 20, 3, dark);
  rounded(g, 3, 2 - step, 9, 20, 3, dark);
  rounded(g, -13 + side * 2, 0 + step, 12, 8, 3, new Color(61, 47, 38, 255));
  rounded(g, 2 + side * 2, 0 - step, 13, 8, 3, new Color(61, 47, 38, 255));
  polygon(g, [[-13, 45], [-18, 18], [0, 12], [18, 18], [13, 45]], coat, dark);
  rounded(g, -shoulder - 7, 23 - step, 10, 21, 4, coat);
  rounded(g, shoulder - 3, 23 + step, 10, 21, 4, coat);
  rounded(g, -shoulder - 6, 19 - step, 8, 9, 3, SKIN);
  rounded(g, shoulder - 2, 19 + step, 8, 9, 3, SKIN);
  rect(g, -14, 24, 28, 4, new Color(103, 75, 48, 255));
  rect(g, -3, 23, 6, 6, GOLD);
  if (up) {
    polygon(g, [[-10, 44], [-12, 26], [11, 26], [10, 44]], new Color(77, 61, 47, 255), dark);
    rect(g, -10, 40, 20, 3, new Color(173, 148, 106, 255));
  } else {
    polygon(g, [[-11, 43], [-1, 35], [11, 43], [5, 48], [-6, 48]], palette);
    rect(g, -4, 30, 5, 8, palette);
  }
  ellipse(g, side * 3, 55, side === 0 ? 12 : 10, 14, SKIN, dark);
  polygon(g, [[-12 + side * 3, 54], [-12 + side * 3, 65], [-5 + side * 3, 71], [10 + side * 3, 67], [13 + side * 3, 54], [7 + side * 3, 61], [-6 + side * 3, 61]], hair);
  if (up) ellipse(g, 0, 58, 12, 12, hair);
  else if (side === 0) {
    rect(g, -6, 54, 3, 3, dark);
    rect(g, 4, 54, 3, 3, dark);
    rect(g, -2, 48, 5, 2, new Color(138, 99, 76, 255));
  } else {
    rect(g, side < 0 ? -6 : 7, 55, 3, 3, dark);
    rounded(g, side < 0 ? -13 : 11, 49, 5, 5, 2, SKIN);
  }
  if (!npc) {
    polygon(g, [[16, 14], [21, 15], [24, 39], [19, 37]], new Color(188, 196, 183, 255), dark);
    rect(g, 15, 34, 12, 4, GOLD);
  }
}

function floor(parent: Node, spec: WalkWorldSpec, phase: GameViewModel['phase']): void {
  const theme = spec.theme ?? HUB_WORLD_THEME;
  const surface = makeNode(parent, 'WalkStoneFloor', 0, 0, spec.width, spec.height);
  const g = surface.addComponent(Graphics);
  g.lineWidth = 1;
  rect(g, 0, -spec.height, spec.width, spec.height, tint(theme.ground, theme.floor === 'sand' ? 0 : -14));
  const tileWidth = theme.floor === 'wood' ? 150 : theme.floor === 'metal' ? 112 : theme.floor === 'tile' ? 64 : 86;
  const tileHeight = theme.floor === 'wood' ? 34 : theme.floor === 'metal' ? 96 : theme.floor === 'tile' ? 64 : 52;
  for (let row = 0; row * tileHeight < spec.height; row += 1) {
    for (let column = -1; column * tileWidth < spec.width; column += 1) {
      const x = column * tileWidth + (theme.floor === 'tile' || theme.floor === 'metal' ? 0 : (row % 2) * tileWidth / 2);
      const y = row * tileHeight;
      const variation = (row * 13 + column * 7 + 41) % 6;
      if (theme.floor === 'sand' || theme.floor === 'void') {
        if (x > 10 && y > 10 && x + 60 < spec.width && y + 40 < spec.height) {
          const grainX = x + 13 + variation * 7;
          const grainY = -y - 12 - variation * 4;
          ellipse(g, grainX, grainY, theme.floor === 'sand' ? 9 + variation : 1 + variation % 2, theme.floor === 'sand' ? 2 : 1 + variation % 2,
            theme.floor === 'sand' ? tint(theme.ground, variation - 12, 160) : tint(theme.accent, 10, 100 + variation * 20));
          if (theme.floor === 'sand') rect(g, grainX + 18, grainY + 11, 3, 2, tint(theme.accent, -75, 150));
        }
        continue;
      }
      const offset = theme.floor === 'tile' ? (row + column) % 2 * 9 : variation * 2;
      rect(g, Math.max(0, x + 1), -Math.min(spec.height, y + tileHeight - 1), Math.min(tileWidth - 2, spec.width - Math.max(0, x + 1)), Math.min(tileHeight - 3, spec.height - y), tint(theme.ground, offset));
      if (theme.floor === 'metal' && x > 0 && x + tileWidth < spec.width && y + tileHeight < spec.height) {
        rect(g, x + 8, -y - 11, 4, 4, tint(theme.wall, 12));
        rect(g, x + tileWidth - 12, -y - tileHeight + 12, 4, 4, tint(theme.wall, 12));
      } else if (theme.floor === 'wood') {
        rect(g, x + 13, -y - 18, tileWidth - 28, 1, tint(theme.ground, -8));
      } else if (variation === 2 && x > 0 && x + 68 < spec.width && y + 50 < spec.height) {
        g.strokeColor = tint(theme.ground, -14, 200);
        g.moveTo(x + 19, -y - 2); g.lineTo(x + 24, -y - 14); g.lineTo(x + 18, -y - 22); g.stroke();
      }
    }
  }
  const cx = spec.width / 2;
  const cy = spec.height * (phase === 'hub' ? 0.54 : 0.50);
  g.lineWidth = 4;
  ellipse(g, cx, -cy, phase === 'hub' ? 176 : 218, phase === 'hub' ? 176 : 218, tint(theme.wall, -10, 85), tint(theme.accent, -25, 115));
  g.lineWidth = 2;
  ellipse(g, cx, -cy, phase === 'hub' ? 161 : 202, phase === 'hub' ? 161 : 202, undefined, tint(theme.accent, 0, 70));
  for (let i = 0; i < 12; i += 1) {
    const a = i * Math.PI / 6;
    const r = phase === 'hub' ? 168 : 210;
    g.strokeColor = tint(theme.accent, 0, 120);
    g.moveTo(cx + Math.cos(a) * (r - 5), -cy + Math.sin(a) * (r - 5));
    g.lineTo(cx + Math.cos(a) * (r + 5), -cy + Math.sin(a) * (r + 5));
    g.stroke();
  }
  const emblem = makeNode(parent, `WalkFloorMotif:${theme.id}`, cx, -cy, 420, 420).addComponent(Graphics);
  drawFloorMotif(emblem, theme);
  rect(g, 24, -spec.height + 24, spec.width - 48, 9, tint(theme.wall, 10));
  if (theme.motif === 'rails' || theme.motif === 'keel') {
    for (const x of [110, spec.width - 146]) {
      rect(g, x, -spec.height + 45, 8, spec.height - 90, tint(theme.accent, -40, 180));
      rect(g, x + 28, -spec.height + 45, 8, spec.height - 90, tint(theme.accent, -40, 180));
      for (let y = 70; y < spec.height - 40; y += 38) rect(g, x - 8, -y, 52, 8, tint(theme.wall, -10));
    }
  }
  if (theme.motif === 'ward' || theme.motif === 'shelter' || theme.motif === 'replay') {
    for (let y = 80; y < spec.height - 70; y += 76) {
      rect(g, 174, -y, 10, 45, tint(theme.accent, -15, 155));
      rect(g, spec.width - 184, -y, 10, 45, tint(theme.accent, -15, 155));
    }
  }
}

/** One real environment fills the complete world; cover clips excess art without stretching it. */
function dungeonFloor(parent: Node, model: GameViewModel, options: WalkSceneOptions): boolean {
  const { spec } = options;
  const theme = spec.theme ?? HUB_WORLD_THEME;
  const backing = makeNode(parent, 'WalkDungeonFloor', 0, 0, spec.width, spec.height).addComponent(Graphics);
  rect(backing, 0, -spec.height, spec.width, spec.height, tint(theme.ground, -10));
  const key = getInfiniteFlowSceneVisualKeys(model).background;
  const visual = key === undefined ? undefined : options.visual(key);
  if (key === undefined || visual === undefined || visual.width <= 0 || visual.height <= 0) {
    makeNode(parent, 'WalkDungeonBackdropPending', spec.width / 2, -spec.height / 2, spec.width, spec.height);
    return false;
  }
  const window = makeNode(parent, `WalkDungeonBackdropWindow:${key}`, spec.width / 2, -spec.height / 2, spec.width, spec.height);
  window.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
  const coverScale = Math.max(spec.width / visual.width, spec.height / visual.height);
  const artwork = makeNode(window, `WalkDungeonBackdrop:${key}`, 0, 0, visual.width * coverScale, visual.height * coverScale);
  const sprite = artwork.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = visual.frame;
  sprite.color = new Color(255, 255, 255, 255);
  options.trackSprite(sprite);
  return true;
}

/** Low debris identifies the exact solid footprints without obscuring the chapter environment. */
function dungeonObstacle(parent: Node, obstacle: WorldRect, index: number, theme: DungeonWorldTheme): DepthItem {
  const foot = obstacle.y + obstacle.height;
  const item = makeNode(parent, `WalkObstacleFootprint:${index}`, obstacle.x + obstacle.width / 2, -foot, obstacle.width, obstacle.height + 8);
  const g = item.addComponent(Graphics);
  const w = obstacle.width;
  const h = obstacle.height;
  if (w > 140 || h > 140) {
    // A subdued edge on the world boundary, not an opaque wall laid over the illustration.
    rect(g, -w / 2, 0, w, h, new Color(7, 12, 17, 115));
    return { node: item, y: foot };
  }
  g.lineWidth = 1;
  polygon(g, [[-w / 2, 0], [w / 2, 0], [w / 2, h], [-w / 2, h]], new Color(8, 7, 6, 72), tint(theme.wall, 20, 180));
  const metal = theme.floor === 'metal';
  const paper = theme.motif === 'archive' || theme.motif === 'redaction' || theme.motif === 'evidence';
  for (let row = 0; row < 3; row += 1) {
    const x = row % 2 === 0 ? -w * 0.22 : w * 0.15;
    const y = 12 + row * (h - 25) / 3;
    const rw = w * (row === 1 ? 0.43 : 0.56);
    if (metal || paper) {
      polygon(g, [[x - rw / 2, y], [x + rw / 2, y + 2], [x + rw / 2 - 3, y + 20], [x - rw / 2 + 3, y + 24]], tint(theme.wall, paper ? 18 : -4, 235), tint(theme.wall, 40));
      rect(g, x - rw / 3, y + 11, rw * 0.6, 2, tint(theme.wall, metal ? 25 : -18));
    } else {
      polygon(g, [[x - rw / 2, y + 5], [x - rw * 0.25, y + 24], [x + rw * 0.35, y + 26], [x + rw / 2, y + 8], [x + rw * 0.15, y]], tint(theme.wall, row * 7 - 10, 235), tint(theme.wall, 22));
      polygon(g, [[x - rw * 0.25, y + 24], [x + rw * 0.35, y + 26], [x + rw * 0.2, y + 17], [x - rw * 0.4, y + 15]], tint(theme.wall, 22, 220));
    }
  }
  return { node: item, y: foot };
}

/** Chapter-specific inlaid diagrams are painted beneath actors, never used as domain state. */
function drawFloorMotif(g: Graphics, theme: DungeonWorldTheme): void {
  const ink = tint(theme.accent, -10, 145);
  const dim = tint(theme.accent, -25, 55);
  g.lineWidth = 4;
  g.strokeColor = ink;
  const line = (points: readonly (readonly [number, number])[]): void => {
    const first = points[0];
    if (first === undefined) return;
    g.moveTo(first[0], first[1]);
    for (const [x, y] of points.slice(1)) g.lineTo(x, y);
    g.stroke();
  };
  switch (theme.motif) {
    case 'sigil':
      polygon(g, [[0, 145], [106, -90], [-106, -90]], dim, ink);
      polygon(g, [[0, -145], [106, 90], [-106, 90]], dim, ink);
      ellipse(g, 0, 0, 61, 61, undefined, ink); break;
    case 'rails':
      for (const x of [-65, 65]) rect(g, x - 4, -150, 8, 300, ink);
      for (let y = -140; y < 150; y += 42) rect(g, -95, y, 190, 12, dim);
      for (const y of [-77, 39, 103]) ellipse(g, 0, y, 127, 14, undefined, dim); break;
    case 'crystal':
      for (const [x, y, s] of [[0, 0, 1], [-102, 57, 0.6], [99, -60, 0.7]] as const) {
        polygon(g, [[x, y + 116 * s], [x + 47 * s, y + 36 * s], [x + 27 * s, y - 93 * s], [x - 33 * s, y - 67 * s], [x - 46 * s, y + 30 * s]], dim, ink);
        line([[x, y + 116 * s], [x + 6 * s, y + 11 * s], [x + 27 * s, y - 93 * s]]);
      } break;
    case 'ward':
      rect(g, -28, -128, 56, 256, dim, ink); rect(g, -128, -28, 256, 56, dim, ink);
      line([[-168, -146], [-113, -146], [-97, -108], [-76, -175], [-45, -146], [170, -146]]); break;
    case 'arena':
      ellipse(g, 0, 0, 149, 149, undefined, ink);
      for (const direction of [-1, 1]) { polygon(g, [[-85 * direction, -119], [-111 * direction, -91], [91 * direction, 122], [123 * direction, 142], [104 * direction, 106]], dim, ink); line([[-121 * direction, -72], [-69 * direction, -123]]); }
      break;
    case 'archive':
      polygon(g, [[-143, -103], [0, -124], [143, -103], [143, 122], [0, 103], [-143, 122]], dim, ink);
      line([[0, -124], [0, 103]]);
      for (const y of [-57, -18, 21, 60]) { line([[-114, y + 10], [-27, y]]); line([[27, y], [114, y + 10]]); } break;
    case 'rift':
      for (let i = 0; i < 5; i += 1) polygon(g, [[-165 + i * 18, 140 - i * 17], [18 - i * 4, 59], [-32 + i * 8, -22], [156 - i * 21, -143]], i % 2 === 0 ? dim : new Color(10, 15, 31, 110), ink);
      break;
    case 'clock':
      ellipse(g, 0, 0, 150, 150, undefined, ink); ellipse(g, 0, 0, 125, 125, undefined, dim);
      for (let i = 0; i < 12; i += 1) { const a = i * Math.PI / 6; line([[Math.cos(a) * 110, Math.sin(a) * 110], [Math.cos(a) * 139, Math.sin(a) * 139]]); }
      line([[0, 108], [0, 0], [84, -53]]); ellipse(g, 0, 0, 12, 12, ink); break;
    case 'balance':
      line([[0, -136], [0, 141]]); line([[-129, 79], [129, 79]]); line([[-65, -139], [65, -139]]);
      for (const x of [-98, 98]) { line([[x, 79], [x - 43, -25], [x + 43, -25], [x, 79]]); ellipse(g, x, -29, 46, 23, dim, ink); } break;
    case 'keel':
      polygon(g, [[0, 163], [101, 56], [76, -126], [-76, -126], [-101, 56]], dim, ink);
      line([[0, 158], [0, -138]]); for (const y of [-86, -39, 8, 55]) line([[-71, y], [71, y]]);
      ellipse(g, 0, 26, 130, 37, undefined, dim); break;
    case 'mirror':
      for (const x of [-78, 78]) { polygon(g, [[x, 136], [x + 63, 59], [x + 47, -122], [x - 47, -122], [x - 63, 59]], dim, ink); line([[x + 21, 82], [x - 25, -58]]); }
      line([[0, -160], [0, 160]]); break;
    case 'redaction':
      rect(g, -112, -142, 224, 284, dim, ink);
      for (const y of [-93, -42, 9, 60, 111]) rect(g, -86, y, y === 9 ? 172 : 119, 9, ink);
      polygon(g, [[-145, -91], [-127, -110], [156, 112], [139, 132]], tint(theme.accent, -15, 190)); break;
    case 'auction':
      ellipse(g, 0, -106, 120, 30, dim, ink);
      polygon(g, [[-82, -45], [-69, -58], [72, 74], [59, 87]], ink);
      polygon(g, [[18, 72], [48, 112], [130, 44], [99, 6]], dim, ink);
      for (const x of [-133, 0, 133]) ellipse(g, x, 137, 21, 21, dim, ink); break;
    case 'helix':
      for (let y = -140; y <= 140; y += 28) { const x = Math.sin(y / 55) * 79; line([[-x, y], [x, y]]); ellipse(g, x, y, 11, 11, ink); ellipse(g, -x, y, 11, 11, dim, ink); } break;
    case 'antenna':
      polygon(g, [[-62, -137], [0, 102], [62, -137]], dim, ink); line([[-45, -89], [43, -36], [-25, 20], [18, 64]]);
      for (const r of [48, 92, 136]) ellipse(g, 0, 87, r, r * 0.64, undefined, dim);
      ellipse(g, 0, 87, 14, 14, ink); break;
    case 'shelter':
      polygon(g, [[-134, 45], [0, 149], [134, 45], [105, 45], [105, -137], [-105, -137], [-105, 45]], dim, ink);
      rect(g, -26, -61, 52, 132, ink); rect(g, -66, -21, 132, 52, ink); break;
    case 'evidence':
      for (const [x, y] of [[-90, 68], [86, 68], [0, -92]] as const) { rect(g, x - 42, y - 47, 84, 94, dim, ink); for (let l = -20; l <= 20; l += 20) rect(g, x - 25, y + l, 50, 4, ink); }
      line([[-90, 13], [0, -39], [86, 13]]); line([[-45, 72], [41, 72]]); break;
    case 'replay':
      rect(g, -165, -111, 330, 222, dim, ink);
      for (let x = -143; x < 150; x += 44) { rect(g, x, 84, 23, 13, ink); rect(g, x, -97, 23, 13, ink); }
      polygon(g, [[-44, 59], [63, 0], [-44, -59]], dim, ink); break;
    case 'surveillance':
      polygon(g, [[-171, 0], [-103, 69], [0, 96], [103, 69], [171, 0], [103, -69], [0, -96], [-103, -69]], dim, ink);
      ellipse(g, 0, 0, 65, 65, undefined, ink); ellipse(g, 0, 0, 27, 27, ink);
      for (const y of [-150, 150]) line([[-86, y], [86, y]]); break;
  }
}

function wall(parent: Node, obstacle: WorldRect, index: number, theme: DungeonWorldTheme): DepthItem {
  const foot = obstacle.y + obstacle.height;
  const item = makeNode(parent, `WalkWall:${index}`, obstacle.x + obstacle.width / 2, -foot, obstacle.width, obstacle.height + 34);
  const g = item.addComponent(Graphics);
  const w = obstacle.width;
  const h = obstacle.height;
  g.lineWidth = 2;
  rect(g, -w / 2 + 7, -8, w + 3, h + 26, new Color(16, 13, 10, 80));
  rect(g, -w / 2, 0, w, h + 27, tint(theme.wall, -20), tint(theme.wall, -45));
  rect(g, -w / 2, h + 15, w, 21, tint(theme.wall, 22), tint(theme.wall, -25));
  rect(g, -w / 2 + 4, h + 26, w - 8, 5, tint(theme.wall, 48));
  g.lineWidth = 1;
  for (let y = 0; y < h + 16; y += 29) {
    g.strokeColor = tint(theme.wall, -38);
    g.moveTo(-w / 2, y); g.lineTo(w / 2, y); g.stroke();
    for (let x = -w / 2 + ((Math.floor(y / 29) % 2) * 34); x < w / 2; x += 68) {
      g.moveTo(x, y); g.lineTo(x, Math.min(y + 29, h + 16)); g.stroke();
    }
  }
  if (w <= 130 && h <= 140) {
    rect(g, -w / 2 - 5, 1, w + 10, 10, tint(theme.wall, 10), tint(theme.wall, -30));
    rect(g, -w / 2 - 5, h + 29, w + 10, 11, tint(theme.wall, 40), tint(theme.wall, -20));
    const prop = makeNode(item, `WalkChapterProp:${theme.motif}`, 0, 0, w + 25, h + 90).addComponent(Graphics);
    drawChapterProp(prop, w, h, theme);
  }
  return { node: item, y: foot };
}

/** Furnish the existing solid column footprints: no decorative obstacle changes the walk rules. */
function drawChapterProp(g: Graphics, w: number, h: number, theme: DungeonWorldTheme): void {
  const a = tint(theme.accent);
  const dark = tint(theme.wall, -35);
  const face = tint(theme.wall, 20);
  g.lineWidth = 2;
  if (theme.motif === 'crystal' || theme.motif === 'rift' || theme.motif === 'mirror') {
    const shift = theme.motif === 'rift' ? 12 : 0;
    polygon(g, [[-w / 2, 18], [-w / 2 + 8, h + 40], [shift, h + 82], [w / 2 - 5, h + 37], [w / 2, 18]], tint(theme.accent, -90), a);
    polygon(g, [[shift, h + 82], [7, 35], [w / 2, 18], [w / 2 - 5, h + 37]], tint(theme.accent, -35, 190));
    g.strokeColor = tint(theme.accent, 50);
    g.moveTo(-17, h + 28); g.lineTo(10, 56); g.stroke();
  } else if (theme.motif === 'archive' || theme.motif === 'redaction' || theme.motif === 'evidence') {
    rect(g, -w / 2 + 4, 13, w - 8, h + 26, dark, a);
    for (let y = 24; y < h + 17; y += 34) {
      rect(g, -w / 2 + 6, y - 4, w - 12, 5, face);
      for (let x = -w / 2 + 9; x < w / 2 - 8; x += 12) {
        rect(g, x, y, 8, 23, theme.motif === 'redaction' ? tint(theme.accent, -50) : tint(theme.accent, Math.floor(x / 12) % 2 * -35));
        rect(g, x + 1, y + 16, 6, 2, dark);
      }
    }
    if (theme.motif === 'evidence') { rect(g, -12, h + 12, 24, 32, WHITE, EDGE); rect(g, -8, h + 26, 16, 3, a); }
  } else if (theme.motif === 'ward' || theme.motif === 'shelter') {
    rect(g, -w / 2 + 3, 10, w - 6, h + 27, tint(theme.wall, 18), dark);
    rect(g, -w / 2 + 10, h - 5, w - 20, 31, tint(theme.accent, -20), dark);
    rect(g, -8, 28, 16, 47, a); rect(g, -23, 43, 46, 16, a);
    if (theme.motif === 'shelter') { rect(g, -w / 2 + 8, 14, w - 16, 7, GOLD); rect(g, w / 2 - 15, 79, 5, 13, GOLD); }
  } else if (theme.motif === 'helix') {
    rounded(g, -w / 2 + 1, 12, w - 2, h + 40, 23, new Color(46, 62, 50, 230));
    ellipse(g, 0, h + 42, w / 2 - 1, 13, face, a);
    ellipse(g, 0, 18, w / 2 - 1, 12, face, a);
    for (let y = 34; y < h + 31; y += 13) { const x = Math.sin(y / 17) * 17; ellipse(g, x, y, 5, 5, a); ellipse(g, -x, y, 5, 5, tint(theme.accent, -55)); g.strokeColor = tint(theme.accent, -30); g.moveTo(-x, y); g.lineTo(x, y); g.stroke(); }
  } else if (theme.motif === 'antenna' || theme.motif === 'surveillance') {
    rect(g, -w / 2 + 8, 10, w - 16, h + 14, dark, a);
    for (let y = 21; y < h; y += 17) rect(g, -w / 2 + 15, y, w - 30, 4, face);
    rect(g, -4, h + 18, 8, 43, face);
    if (theme.motif === 'antenna') {
      for (let y = h + 36; y < h + 78; y += 14) rect(g, -25 + (y - h - 36) / 2, y, 50 - (y - h - 36), 4, a);
      ellipse(g, 0, h + 80, 5, 5, RED);
    } else {
      rounded(g, -28, h + 40, 56, 34, 9, face); ellipse(g, 6, h + 57, 11, 11, dark, a); ellipse(g, 6, h + 57, 5, 5, a);
    }
  } else if (theme.motif === 'clock' || theme.motif === 'balance' || theme.motif === 'auction') {
    rect(g, -w / 2 + 7, 17, w - 14, h + 10, dark, a);
    if (theme.motif === 'clock') {
      ellipse(g, 0, h + 28, 35, 35, face, a); g.strokeColor = a; g.lineWidth = 4; g.moveTo(0, h + 51); g.lineTo(0, h + 28); g.lineTo(18, h + 17); g.stroke();
    } else if (theme.motif === 'balance') {
      rect(g, -3, h + 8, 6, 65, a); rect(g, -36, h + 59, 72, 5, a);
      for (const x of [-28, 28]) { g.strokeColor = a; g.moveTo(x, h + 60); g.lineTo(x, h + 27); g.stroke(); ellipse(g, x, h + 23, 15, 7, face, a); }
    } else {
      ellipse(g, 0, h + 24, 32, 13, face, a); rect(g, -4, h + 35, 8, 39, a); rect(g, -26, h + 63, 46, 20, tint(theme.wall, 35), a);
    }
  } else if (theme.motif === 'replay' || theme.motif === 'keel' || theme.motif === 'rails') {
    rect(g, -w / 2 + 4, 15, w - 8, h + 22, dark, face);
    rect(g, -w / 2 + 10, h - 13, w - 20, 43, tint(theme.accent, -80), a);
    if (theme.motif === 'replay') polygon(g, [[-12, h - 6], [-12, h + 22], [15, h + 8]], a);
    else for (let y = h - 4; y < h + 21; y += 9) rect(g, -w / 2 + 17, y, w - 34, 3, a);
    for (const x of [-18, 0, 18]) ellipse(g, x, 52, 4, 4, a);
  } else {
    // Ritual banners in the tower; scorched shield standards in the arena.
    rect(g, -3, 30, 6, h + 27, face);
    polygon(g, [[-27, h + 46], [27, h + 46], [23, 58], [0, 41], [-23, 58]], tint(theme.accent, -100), a);
    if (theme.motif === 'arena') polygon(g, [[0, h + 33], [15, h + 8], [0, 66], [-15, h + 8]], a);
    else { rect(g, -2, 65, 4, h - 27, a); rect(g, -15, h + 7, 30, 4, a); }
  }
}

function drawFlame(g: Graphics, time: number): void {
  g.clear();
  const flicker = Math.sin(time * 11) * 3;
  ellipse(g, 0, 10, 25 + flicker, 31, new Color(246, 152, 58, 18));
  polygon(g, [[-12, 0], [-15, 13], [-6, 30 + flicker], [-2, 20], [5, 41 - flicker], [13, 21], [14, 8], [7, 0]], new Color(227, 114, 47, 235));
  polygon(g, [[-7, 1], [-8, 12], [-2, 24 + flicker], [2, 16], [6, 28], [8, 8], [3, 0]], new Color(255, 204, 93, 255));
  polygon(g, [[-4, 1], [0, 14], [5, 1]], new Color(255, 241, 183, 255));
}

function brazier(parent: Node, x: number, y: number, index: number, flames: Flame[]): DepthItem {
  const base = makeNode(parent, `WalkBrazier:${index}`, x, -y, 62, 97);
  shadow(base, 31, 11);
  const g = base.addComponent(Graphics);
  rect(g, -21, 0, 42, 9, new Color(100, 98, 84, 255), new Color(34, 43, 46, 255));
  rect(g, -10, 9, 20, 27, new Color(60, 69, 69, 255), EDGE);
  polygon(g, [[-24, 42], [-15, 29], [15, 29], [24, 42]], new Color(45, 49, 46, 255), new Color(153, 123, 77, 255));
  const flame = makeNode(base, 'BrazierFire', 0, 40, 64, 80).addComponent(Graphics);
  drawFlame(flame, index);
  flames.push({ graphics: flame, offset: index });
  return { node: base, y };
}

function drawDoor(g: Graphics, target: WorldTarget): void {
  const magic = target.kind === 'portal' || target.kind === 'exit';
  const glow = magic ? TEAL : GOLD;
  rect(g, -61, -8, 122, 10, new Color(91, 105, 101, 255), EDGE);
  rect(g, -54, 2, 108, 12, new Color(117, 126, 111, 255), EDGE);
  rect(g, -46, 14, 92, 8, new Color(148, 151, 127, 255));
  rounded(g, -39, 21, 78, 100, 35, new Color(13, 35, 41, 255));
  if (magic) {
    ellipse(g, 0, 65, 29, 46, new Color(58, 139, 145, 140), glow);
    g.lineWidth = 2;
    ellipse(g, 0, 65, 22, 36, new Color(83, 183, 176, 80), new Color(164, 243, 211, 185));
    rect(g, -3, 28, 6, 73, new Color(181, 248, 221, 112));
  } else {
    for (let x = -31; x < 32; x += 16) rect(g, x, 20, 13, 80, new Color(53, 65, 66, 255));
    rect(g, -29, 47, 57, 8, new Color(41, 50, 54, 255));
    rect(g, 18, 59, 5, 7, GOLD);
  }
  rect(g, -54, 17, 18, 101, new Color(103, 112, 105, 255), new Color(42, 58, 61, 255));
  rect(g, 36, 17, 18, 101, new Color(82, 97, 94, 255), new Color(42, 58, 61, 255));
  rect(g, -57, 107, 114, 23, new Color(120, 130, 116, 255), new Color(51, 70, 70, 255));
  polygon(g, [[-61, 130], [0, 155], [61, 130]], new Color(137, 140, 122, 255), new Color(52, 71, 73, 255));
  polygon(g, [[0, 120], [7, 131], [0, 142], [-7, 131]], glow);
}

function drawMonster(g: Graphics, theme: DungeonWorldTheme): void {
  const fur = tint(theme.wall, -5);
  const rim = new Color(41, 35, 44, 255);
  if (theme.enemy === 'human') {
    drawHuman(g, 'down', 0, true, tint(theme.accent));
    rect(g, -17, 51, 34, 9, rim);
    rect(g, -11, 53, 9, 4, RED); rect(g, 4, 53, 9, 4, RED);
    polygon(g, [[26, 23], [33, 19], [45, 72], [38, 80]], tint(theme.wall, 80), rim);
    rect(g, 20, 26, 26, 5, GOLD);
    return;
  }
  if (theme.enemy === 'machine') {
    for (const x of [-29, 15]) { rect(g, x, 2, 17, 41, fur, rim); rect(g, x - 4, 0, 25, 10, tint(theme.wall, 30), rim); }
    polygon(g, [[-35, 73], [35, 73], [28, 27], [-28, 27]], tint(theme.wall, 10), rim);
    for (const x of [-54, 36]) { rect(g, x, 26, 18, 43, fur, rim); ellipse(g, x + 9, 69, 12, 12, tint(theme.wall, 30), rim); }
    rounded(g, -29, 75, 58, 38, 12, tint(theme.wall, 35));
    rect(g, -23, 85, 46, 12, rim); rect(g, -17, 89, 34, 5, RED);
    ellipse(g, 0, 51, 15, 15, rim, tint(theme.accent)); ellipse(g, 0, 51, 8, 8, tint(theme.accent));
    return;
  }
  if (theme.enemy === 'specter') {
    polygon(g, [[0, 117], [-30, 92], [-36, 57], [-64, 8], [-22, 22], [0, 2], [21, 22], [66, 8], [35, 57], [30, 92]], tint(theme.accent, -105, 225), tint(theme.accent, -25));
    ellipse(g, 0, 84, 22, 25, rim, tint(theme.accent));
    rect(g, -13, 83, 9, 4, RED); rect(g, 5, 83, 9, 4, RED);
    polygon(g, [[-13, 69], [0, 47], [13, 69]], tint(theme.accent, -45));
    return;
  }
  polygon(g, [[-27, 36], [-35, 18], [-41, 3], [-19, 1], [-12, 30]], fur, rim);
  polygon(g, [[27, 36], [35, 18], [41, 3], [19, 1], [12, 30]], fur, rim);
  polygon(g, [[-29, 69], [-49, 55], [-55, 24], [-44, 13], [-32, 26], [-28, 42]], fur, rim);
  polygon(g, [[29, 69], [49, 55], [55, 24], [44, 13], [32, 26], [28, 42]], fur, rim);
  ellipse(g, 0, 49, 33, 39, fur, rim);
  polygon(g, [[-19, 69], [-13, 30], [0, 23], [13, 30], [19, 69]], new Color(133, 100, 96, 255));
  polygon(g, [[-26, 77], [-38, 106], [-14, 94], [14, 94], [38, 106], [26, 77]], new Color(145, 129, 115, 255), rim);
  ellipse(g, 0, 82, 26, 24, new Color(106, 80, 79, 255), rim);
  polygon(g, [[-18, 86], [-5, 82], [-10, 78], [-20, 80]], RED);
  polygon(g, [[18, 86], [5, 82], [10, 78], [20, 80]], RED);
  polygon(g, [[-14, 71], [0, 64], [14, 71], [9, 57], [-9, 57]], rim);
  polygon(g, [[-11, 70], [-6, 58], [-3, 67]], WHITE);
  polygon(g, [[11, 70], [6, 58], [3, 67]], WHITE);
  for (const x of [-46, -39, -32, 32, 39, 46]) polygon(g, [[x - 2, 6], [x, -2], [x + 3, 6]], new Color(196, 184, 157, 255));
  if (theme.enemy === 'armored') {
    polygon(g, [[-27, 65], [0, 74], [27, 65], [20, 31], [0, 22], [-20, 31]], tint(theme.wall, 55), rim);
    polygon(g, [[0, 67], [13, 50], [0, 32], [-13, 50]], tint(theme.accent), rim);
  }
}

function drawRoomObject(g: Graphics, kind: WorldTarget['kind'], theme: DungeonWorldTheme): void {
  const a = tint(theme.accent);
  if (kind === 'trap') {
    ellipse(g, 0, 9, 66, 27, new Color(84, 35, 35, 205), RED);
    for (const [x, y] of [[-38, 5], [-14, 17], [14, 4], [38, 16], [0, -5]] as const) polygon(g, [[x - 9, y], [x, y + 38], [x + 9, y]], new Color(169, 174, 159, 255), INK);
    polygon(g, [[0, 89], [-21, 51], [21, 51]], new Color(77, 34, 29, 255), RED);
    rect(g, -2, 61, 4, 12, GOLD); rect(g, -2, 55, 4, 4, GOLD);
  } else if (kind === 'event') {
    rect(g, -8, 0, 16, 62, tint(theme.wall), INK);
    rect(g, -45, 53, 90, 64, new Color(176, 153, 106, 255), INK);
    rect(g, -48, 49, 96, 8, GOLD); rect(g, -48, 113, 96, 8, GOLD);
    for (let y = 66; y < 109; y += 13) rect(g, -29, y, 56, 3, tint(theme.wall, -30));
    ellipse(g, 35, 54, 12, 12, RED, GOLD);
  } else if (kind === 'survey') {
    polygon(g, [[-48, 3], [48, 3], [56, 61], [-56, 61]], tint(theme.wall, 15), EDGE);
    polygon(g, [[-51, 62], [-31, 88], [33, 82], [51, 62]], tint(theme.wall, 45), a);
    ellipse(g, -3, 80, 19, 17, undefined, a); rect(g, 10, 46, 8, 24, GOLD);
    rect(g, -31, 28, 39, 3, a); rect(g, -31, 17, 24, 3, a);
  } else if (kind === 'relic') {
    ellipse(g, 0, 7, 54, 19, tint(theme.wall), GOLD);
    rect(g, -28, 10, 56, 23, tint(theme.wall, 20), GOLD);
    for (const x of [-35, 0, 35]) polygon(g, [[x, 105], [x + 14, 75], [x, 47], [x - 14, 75]], tint(theme.accent, x === 0 ? 10 : -45), GOLD);
    ellipse(g, 0, 60, 63, 17, undefined, tint(theme.accent, -20, 120));
  } else if (kind === 'shrine') {
    ellipse(g, 0, 5, 54, 20, tint(theme.wall, 25), a);
    polygon(g, [[-29, 10], [-21, 69], [21, 69], [29, 10]], tint(theme.wall), a);
    ellipse(g, 0, 87, 29, 29, tint(theme.accent, -95, 180), a);
    polygon(g, [[0, 115], [10, 88], [0, 59], [-10, 88]], tint(theme.accent, 40));
    ellipse(g, 0, 87, 39, 15, undefined, a);
  } else if (kind === 'law') {
    rect(g, -48, 4, 96, 13, tint(theme.wall, 20), a);
    polygon(g, [[-36, 17], [36, 17], [30, 77], [-30, 77]], tint(theme.wall, -15), EDGE);
    polygon(g, [[-43, 76], [0, 65], [43, 76], [43, 115], [0, 104], [-43, 115]], new Color(194, 180, 138, 255), GOLD);
    rect(g, -2, 69, 4, 39, GOLD);
    for (const y of [81, 94]) { rect(g, -34, y, 24, 3, tint(theme.wall)); rect(g, 10, y, 24, 3, tint(theme.wall)); }
  }
}

function targetActor(parent: Node, target: WorldTarget, model: GameViewModel, theme: DungeonWorldTheme): DepthItem {
  const base = makeNode(parent, `WalkTarget:${target.id}`, target.x, -target.y, 150, 190);
  shadow(base, target.kind === 'monster' ? 56 : target.kind === 'npc' ? 26 : 61, target.kind === 'npc' ? 10 : 16);
  const g = makeNode(base, 'WorldObjectBody', 0, 0, 150, 175).addComponent(Graphics);
  g.lineWidth = 2;
  if (target.kind === 'npc') {
    const palette = target.id.includes('supplies') ? GOLD : target.id.includes('bloodlines') ? RED : TEAL;
    drawHuman(g, 'down', 0, true, palette);
    if (target.id.includes('equipment')) {
      polygon(g, [[27, 1], [36, 1], [36, 37], [27, 37]], new Color(116, 92, 59, 255));
      polygon(g, [[19, 37], [44, 37], [44, 48], [19, 48]], new Color(173, 181, 175, 255), INK);
    } else if (target.id.includes('methods') || target.id.includes('tasks')) {
      rect(g, 20, 24, 20, 26, new Color(191, 165, 111, 255), new Color(76, 70, 53, 255));
      rect(g, 24, 29, 12, 2, new Color(89, 103, 84, 255));
      rect(g, 24, 35, 12, 2, new Color(89, 103, 84, 255));
    } else if (target.id.includes('supplies')) {
      ellipse(g, 31, 21, 10, 14, new Color(124, 84, 65, 255), GOLD);
      rect(g, 27, 31, 8, 9, new Color(144, 131, 86, 255));
    }
  } else if (target.kind === 'monster') {
    drawMonster(g, theme);
    if (target.rank === 'boss' || target.rank === 'elite') {
      const rank = makeNode(base, 'WalkEnemyRank', 0, target.rank === 'boss' ? 139 : 124, 112, 48).addComponent(Graphics);
      if (target.rank === 'boss') polygon(rank, [[-28, -10], [-36, 20], [-16, 7], [0, 30], [16, 7], [36, 20], [28, -10]], GOLD, RED);
      else polygon(rank, [[0, 19], [15, 0], [0, -19], [-15, 0]], GOLD, INK);
      bodyRankScale(g.node, target.rank);
    }
    const detail = model.sections[1].detail;
    if (detail.kind === 'combat') {
      const health = makeNode(base, 'WalkEnemyHealth', 0, 183, 142, 12).addComponent(Graphics);
      rect(health, -71, -6, 142, 12, INK, EDGE);
      rect(health, -68, -3, 136 * detail.enemy.hpPercent / 100, 6, RED);
      text(base, 'WalkEnemyHealthLabel', `${detail.enemy.hp} / ${detail.enemy.maxHp}`, 0, 203, 174, 25, 18, WHITE);
    }
  } else if (target.kind === 'chest') {
    rect(g, -38, 0, 76, 32, new Color(92, 65, 45, 255), INK);
    rounded(g, -38, 23, 76, 24, 9, new Color(132, 91, 53, 255));
    rect(g, -29, 0, 8, 44, new Color(183, 145, 78, 255));
    rect(g, 21, 0, 8, 44, new Color(183, 145, 78, 255));
    rect(g, -38, 26, 76, 5, GOLD);
    rect(g, -7, 18, 14, 16, GOLD, INK);
    rect(g, -2, 22, 4, 8, INK);
  } else if (target.kind === 'portal' || target.kind === 'exit' || target.kind === 'transition') drawDoor(g, target);
  else drawRoomObject(g, target.kind, theme);
  if (model.phase === 'explore' || model.phase === 'combat') {
    const nameWidth = target.kind === 'monster' ? 260 : 192;
    const nameBacking = makeNode(base, 'WalkTargetNameBacking', 0, -26, nameWidth, 35).addComponent(Graphics);
    nameBacking.lineWidth = 1;
    polygon(nameBacking, [[-nameWidth / 2 + 5, -17.5], [nameWidth / 2 - 5, -17.5], [nameWidth / 2, -12.5], [nameWidth / 2, 12.5], [nameWidth / 2 - 5, 17.5], [-nameWidth / 2 + 5, 17.5], [-nameWidth / 2, 12.5], [-nameWidth / 2, -12.5]], new Color(16, 13, 10, 200), DARK_UI.edge);
  }
  text(base, 'WalkTargetName', `${target.rank === 'boss' ? '首领 · ' : target.rank === 'elite' ? '精英 · ' : ''}${target.label}`, 0, -26, target.kind === 'monster' ? 260 : 192, 35, 21, target.disabledReason === undefined ? DARK_UI.bone : DARK_UI.muted);
  return { node: base, y: target.y };
}

function bodyRankScale(body: Node, rank: 'boss' | 'elite'): void {
  const scale = rank === 'boss' ? 1.3 : 1.12;
  body.setScale(new Vec3(scale, scale, 1));
}

function button(parent: Node, name: string, label: string, x: number, y: number, diameter: number, enabled = true, accent = DARK_UI.edgeLight, icon?: Parameters<typeof paintDarkIcon>[1]): Node {
  const base = makeNode(parent, name, x, y, diameter, diameter);
  const g = base.addComponent(Graphics);
  paintDarkFrame(g, diameter, diameter, { fill: enabled ? DARK_UI.raised : DARK_UI.quiet, edge: enabled ? DARK_UI.edgeLight : DARK_UI.edge, accent: enabled ? accent : DARK_UI.edge, cut: 11 });
  const title = text(base, `${name}Label`, label, 0, icon === undefined ? 0 : -29, diameter - 12, icon === undefined ? diameter - 20 : 30, 22, enabled ? DARK_UI.bone : DARK_UI.muted);
  title.enableWrapText = false;
  if (icon !== undefined) {
    const mark = makeNode(base, `${name}Icon`, 0, label.length === 0 ? 0 : 12, 55, 46).addComponent(Graphics);
    paintDarkIcon(mark, icon, enabled ? accent : DARK_UI.muted);
  }
  return base;
}

function informationButton(parent: Node, name: string, label: string, icon: 'character' | 'bag' | 'map' | 'target' | 'menu', x: number, y: number): Node {
  const base = button(parent, name, label, x, y, 104, true, DARK_UI.gold, icon);
  const labelNode = base.getChildByName(`${name}Label`);
  if (labelNode !== null) {
    labelNode.setPosition(new Vec3(0, -29, 0));
    labelNode.getComponent(UITransform)?.setContentSize(new Size(90, 29));
    const component = labelNode.getComponent(Label);
    if (component !== null) component.fontSize = 21;
  }
  return base;
}

function header(scene: Node, model: GameViewModel, options: WalkSceneOptions, top: number): void {
  const detail = model.sections[1].detail;
  const title = detail.kind === 'hub' ? '主神空间' : detail.kind === 'explore' ? detail.map.dungeonName : detail.kind === 'combat' ? detail.chapterContext?.dungeonName ?? '遭遇战' : '本轮结算';
  const hud = makeNode(scene, 'WalkHud', 0, top - 60, 750, 120);
  const g = hud.addComponent(Graphics);
  paintDarkFrame(g, 750, 120, { fill: DARK_UI.panel, edge: DARK_UI.edge, accent: DARK_UI.goldDark, cut: 8, ornate: true });
  const location = text(hud, 'WalkLocationName', title, -4, 28, 460, 36, 26, DARK_UI.bone, false);
  location.enableWrapText = false;
  const metrics = model.sections[1].metrics;
  const hp = detail.kind === 'combat' ? `${detail.player.hp}/${detail.player.maxHp}` : metrics.find(({ id }) => id === 'hp')?.value;
  text(hud, 'WalkPlayerStatus', hp === undefined ? '生命 —' : `生命 ${hp}`, -95, -12, 278, 31, 21, DARK_UI.bone, false);
  const split = hp?.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (split !== undefined && split !== null && Number(split[2]) > 0) {
    const fillWidth = 262 * Math.min(1, Number(split[1]) / Number(split[2]));
    rect(g, -235, -44, 266, 10, DARK_UI.ink, DARK_UI.edge);
    rect(g, -233, -42, fillWidth, 6, DARK_UI.redDark);
    rect(g, -233, -40, fillWidth, 3, DARK_UI.red);
  }
  const mode = options.chrome.busyActionId !== undefined ? '行动中…' : options.chrome.modeKind === 'preview' || options.chrome.modeKind === 'wx-devtools' ? '临时试玩' : '';
  text(hud, 'WalkMode', mode, 150, -11, 155, 28, 19, DARK_UI.gold);
  if (mode === '临时试玩') text(hud, 'WalkStorageNotice', '刷新丢失进度', 150, -40, 163, 25, 17, DARK_UI.muted);
  const character = informationButton(scene, 'SceneCharacter', '角色', 'character', -309, top - 59);
  options.bindLocal(character, () => options.openPanel === undefined ? options.openDetails() : options.openPanel('character'));
  const menu = informationButton(scene, 'SceneHelp', '菜单', 'menu', 309, top - 59);
  if (options.openPanel === undefined) options.bindHelp(menu);
  else options.bindLocal(menu, () => options.openPanel?.('menu'));

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
    const strip = makeNode(scene, 'WalkRiskSummary', -49, top - 157, 554, 58);
    paintDarkFrame(strip.addComponent(Graphics), 554, 58, { fill: DARK_UI.panel, edge: DARK_UI.edge, accent: danger ? DARK_UI.red : DARK_UI.goldDark, cut: 6, ornate: false });
    text(strip, 'WalkRiskReadout', riskReadouts.join(' · '), 0, 0, 526, 48, 20, danger ? DARK_UI.red : DARK_UI.bone, false);
  }
}

function combatControls(scene: Node, model: GameViewModel, options: WalkSceneOptions, bottom: number): void {
  if (model.phase !== 'combat') return;
  const actions = model.sections[2].actions;
  const pages = Math.max(1, Math.ceil(actions.length / 4));
  const page = Math.max(0, Math.min(pages - 1, Math.trunc(options.page)));
  const busy = options.chrome.busyActionId !== undefined || options.chrome.modeKind === 'blocked';
  actions.slice(page * 4, page * 4 + 4).forEach((action, index) => {
    const ready = action.enabled && action.event !== undefined && !busy;
    const accent = action.emphasis === 'danger' ? DARK_UI.red : action.recommendation === 'recommended' ? DARK_UI.gold : DARK_UI.muted;
    const icon = action.combatAction === 'guard' ? 'guard' : action.combatAction === 'attack' || action.combatAction === 'weapon_skill' ? 'sword'
      : action.combatAction === 'art' || action.combatAction === 'use_thunder_talisman' ? 'arcane'
        : action.combatAction === 'use_healing_pill' ? 'bag' : action.combatAction === 'escape' ? 'left' : 'target';
    const actionNode = button(scene, `WalkCombatAction:${action.actionId}`, action.label, index % 2 === 0 ? 166 : 291, bottom + 331 - Math.floor(index / 2) * 121, 112, ready, accent, icon);
    options.bindAction(actionNode, action);
  });
  if (pages > 1) {
    const previous = button(scene, 'WalkCombatPagePrevious', '', -285, bottom + 287, 104, page > 0, DARK_UI.gold, 'left');
    const next = button(scene, 'WalkCombatPageNext', '', -172, bottom + 287, 104, page + 1 < pages, DARK_UI.gold, 'right');
    if (page > 0) options.bindLocal(previous, () => options.setPage(page - 1));
    if (page + 1 < pages) options.bindLocal(next, () => options.setPage(page + 1));
    text(scene, 'WalkCombatPage', `${page + 1} / ${pages}`, -226, bottom + 362, 164, 32, 20, DARK_UI.muted);
  }
}

/** Creates one persistent world. tick moves actors/camera and never recreates the root. */
export function renderInfiniteFlowWalkScene(root: Node, model: GameViewModel, options: WalkSceneOptions): WalkSceneHandle {
  const { spec } = options;
  const halfSurface = options.surfaceHeight / 2;
  const scene = makeNode(root, 'WalkScene', (options.safeInsets.left - options.safeInsets.right) / 2, 0, 750, options.surfaceHeight);
  const top = halfSurface - options.safeInsets.top;
  const bottom = -halfSurface + options.safeInsets.bottom;
  const viewportHeight = options.surfaceHeight - options.safeInsets.top - options.safeInsets.bottom - 122;
  const viewport = makeNode(scene, 'WalkViewport', 0, top - 122 - viewportHeight / 2, 750, viewportHeight);
  viewport.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
  const theme = spec.theme ?? HUB_WORLD_THEME;
  const backdrop = viewport.addComponent(Graphics);
  // Match the floor painter's own backing tint so a tall-screen viewport that
  // extends past a smaller world map reads as shadowed ground, never a black band.
  const viewportGroundTint = model.phase === 'hub'
    ? (theme.floor === 'sand' ? 0 : -14)
    : -10;
  rect(backdrop, -375, -viewportHeight / 2, 750, viewportHeight, tint(theme.ground, viewportGroundTint));
  const camera = makeNode(viewport, 'WalkCamera', 0, 0, spec.width, spec.height);
  camera.setScale(new Vec3(WORLD_ZOOM, WORLD_ZOOM, 1));
  let environmentReady = true;
  if (model.phase === 'hub') floor(camera, spec, model.phase);
  else environmentReady = dungeonFloor(camera, model, options);
  const marker = makeNode(camera, 'WalkTargetMarker', 0, 0, 152, 58);
  const markerGraphics = marker.addComponent(Graphics);
  const actors = makeNode(camera, 'WalkDepthObjects', 0, 0, spec.width, spec.height);
  const depth = spec.obstacles.map((obstacle, index) => model.phase === 'hub'
    ? wall(actors, obstacle, index, theme)
    : dungeonObstacle(actors, obstacle, index, theme));
  const flames: Flame[] = [];
  if (model.phase === 'hub') {
    const torchPoints = [[96, 245], [spec.width - 96, 245], [96, spec.height - 180], [spec.width - 96, spec.height - 180]] as const;
    torchPoints.forEach(([x, y], index) => depth.push(brazier(actors, x, y, index, flames)));
  }
  spec.targets.forEach((target) => depth.push(targetActor(actors, target, model, theme)));

  const player = makeNode(actors, 'WalkPlayer', options.position.x, -options.position.y, 104, 108);
  shadow(player, 24, 9);
  const body = makeNode(player, 'WalkPlayerBody', 0, 0, 104, 104);
  const walkerFrames = options.walkerFrames;
  let playerSprite: Sprite | undefined;
  let playerGraphics: Graphics | undefined;
  if (walkerFrames !== undefined && walkerFrames.length >= 16) {
    body.setPosition(new Vec3(0, 47, 0));
    playerSprite = body.addComponent(Sprite);
    playerSprite.sizeMode = Sprite.SizeMode.CUSTOM;
    playerSprite.spriteFrame = walkerFrames[0] ?? null;
    playerSprite.color = new Color(255, 255, 255, 255);
    options.trackSprite(playerSprite);
  } else {
    playerGraphics = body.addComponent(Graphics);
    playerGraphics.lineWidth = 2;
    drawHuman(playerGraphics, 'down', 0);
  }
  const playerDepth: DepthItem = { node: player, y: options.position.y };
  depth.push(playerDepth);
  const sortDepth = (): void => {
    depth.sort((a, b) => a.y - b.y);
    depth.forEach((entry, index) => entry.node.setSiblingIndex(index));
  };
  sortDepth();

  const joystick = makeNode(scene, 'WalkJoystick', -230, bottom + 128, 200, 200);
  const joystickGraphic = joystick.addComponent(Graphics);
  joystickGraphic.lineWidth = 2;
  ellipse(joystickGraphic, 0, -3, 96, 96, DARK_UI.ink);
  ellipse(joystickGraphic, 0, 0, 96, 96, DARK_UI.panel, DARK_UI.edgeLight);
  ellipse(joystickGraphic, 0, 0, 90, 90, undefined, DARK_UI.goldDark);
  ellipse(joystickGraphic, 0, 0, 66, 66, DARK_UI.ink, DARK_UI.edge);
  for (const [x, y, dx, dy] of [[0, 78, 5, 0], [0, -78, 5, 0], [78, 0, 0, 5], [-78, 0, 0, 5]]) {
    joystickGraphic.strokeColor = DARK_UI.gold;
    joystickGraphic.moveTo((x ?? 0) - (dx ?? 0), (y ?? 0) - (dy ?? 0));
    joystickGraphic.lineTo((x ?? 0) + (dx ?? 0), (y ?? 0) + (dy ?? 0));
    joystickGraphic.stroke();
  }
  const joystickThumb = makeNode(joystick, 'WalkJoystickThumb', 0, 0, 84, 84);
  const thumb = joystickThumb.addComponent(Graphics);
  thumb.lineWidth = 2;
  ellipse(thumb, 0, -2, 40, 40, DARK_UI.ink);
  ellipse(thumb, 0, 0, 40, 40, DARK_UI.raised, DARK_UI.edgeLight);
  ellipse(thumb, 0, 0, 31, 31, undefined, DARK_UI.goldDark);
  polygon(thumb, [[0, 8], [6, 0], [0, -8], [-6, 0]], DARK_UI.goldDark, DARK_UI.gold);
  const interact = button(scene, 'WalkInteract', '靠近互动', 290, bottom + 79, 120, false, DARK_UI.gold, 'interact');
  const interactLabel = interact.getChildByName('WalkInteractLabel')?.getComponent(Label);
  const interactIcon = interact.getChildByName('WalkInteractIcon')?.getComponent(Graphics);
  const interactGraphics = interact.getComponent(Graphics);
  if (model.phase === 'explore' || model.phase === 'combat') {
    const hintBacking = makeNode(scene, 'WalkInteractionHintBacking', 0, bottom + (model.phase === 'combat' ? 416 : 253), 685, 51).addComponent(Graphics);
    hintBacking.lineWidth = 1;
    polygon(hintBacking, [[-334.5, -25.5], [334.5, -25.5], [342.5, -17.5], [342.5, 17.5], [334.5, 25.5], [-334.5, 25.5], [-342.5, 17.5], [-342.5, -17.5]], new Color(16, 13, 10, 200), DARK_UI.edge);
  }
  const targetHint = text(scene, 'WalkInteractionHint', '拖动摇杆移动 · 靠近人物或门互动', 0, bottom + (model.phase === 'combat' ? 416 : 253), 685, 51, 22, DARK_UI.bone);
  const details = informationButton(scene, 'SceneDetails', '背包', 'bag', 309, top - 182);
  options.bindLocal(details, () => options.openPanel === undefined ? options.openDetails() : options.openPanel('inventory'));
  const detail = model.sections[1].detail;
  if (detail.kind === 'explore') {
    const map = informationButton(scene, 'SceneMap', '地图', 'map', 309, top - 294);
    options.bindLocal(map, () => options.openPanel === undefined ? options.openDetails() : options.openPanel('map'));
  }
  if (detail.kind !== 'hub') {
    const codex = informationButton(scene, 'SceneCodex', '目标', 'target', 309, top - (detail.kind === 'explore' ? 406 : 294));
    options.bindLocal(codex, () => options.openPanel === undefined ? options.openCodex() : options.openPanel('objectives'));
  }
  combatControls(scene, model, options, bottom);
  header(scene, model, options, top);
  if (!environmentReady) {
    text(scene, 'WalkEnvironmentLoading', '场景加载中…', -49, top - 302, 330, 39, 23, DARK_UI.gold);
  }

  let position: WorldPoint = { x: options.position.x, y: options.position.y };
  let facing: Facing = 'down';
  let previousFacing: Facing = facing;
  let frameIndex = 0;
  let gait = 0;
  let age = 0;
  let flameFrame = -1;
  let disposed = false;
  let nearby: WorldTarget | undefined;
  let targetId: string | undefined;
  let interactionInitialized = false;
  const busy = options.chrome.busyActionId !== undefined || options.chrome.modeKind === 'blocked';
  options.bindInteract(interact, () => {
    const target = nearestWalkTarget(spec, position);
    return busy ? undefined : target;
  });

  const halfWidth = 375 / WORLD_ZOOM;
  const halfHeight = viewportHeight / WORLD_ZOOM / 2;
  const clampCamera = (point: WorldPoint): WorldPoint => ({
    x: spec.width <= halfWidth * 2 ? spec.width / 2 : Math.max(halfWidth, Math.min(spec.width - halfWidth, point.x + (model.phase === 'combat' ? 120 : 0))),
    y: spec.height <= halfHeight * 2 ? spec.height / 2 : Math.max(halfHeight, Math.min(spec.height - halfHeight, point.y + 65)),
  });
  let cameraPoint = clampCamera(position);
  camera.setPosition(new Vec3(-cameraPoint.x * WORLD_ZOOM, cameraPoint.y * WORLD_ZOOM, 0));

  const activity = formatInfiniteFlowPlayerChrome(options.chrome, model.phase).activityMessage;
  const failed = activity !== undefined && /不可执行|失败|异常|无效|内存紧张|暂不可用/.test(activity);
  const feedbackText = failed ? activity : options.feedback?.text;
  const toast = feedbackText === undefined ? undefined
    : text(scene, 'WalkFeedback', feedbackText, -49, top - 234, 554, 61, 23, failed ? DARK_UI.red : DARK_UI.gold);
  const monster = spec.targets.find((target) => target.kind === 'monster');
  const damageTarget = monster ?? { x: position.x, y: position.y };
  const feedbackNode = makeNode(camera, 'WalkCombatEffects', damageTarget.x, -damageTarget.y, 200, 210);
  const slash = feedbackNode.addComponent(Graphics);
  const damageLabel = failed || options.feedback?.damage === undefined ? undefined
    : text(feedbackNode, 'WalkDamage', `−${options.feedback.damage}`, 0, 136, 200, 73, 48, RED);

  const updateInteraction = (): void => {
    nearby = nearestWalkTarget(spec, position);
    if (interactionInitialized && targetId === nearby?.id) return;
    interactionInitialized = true;
    targetId = nearby?.id;
    const ready = !busy && nearby !== undefined;
    if (interactLabel !== null && interactLabel !== undefined) {
      interactLabel.string = nearby === undefined ? '靠近互动' : nearby.disabledReason !== undefined ? '查看' : nearby.interactionLabel ?? '互动';
      interactLabel.color = ready ? DARK_UI.bone : DARK_UI.muted;
    }
    if (interactGraphics !== null) {
      paintDarkFrame(interactGraphics, 120, 120, { fill: ready ? DARK_UI.raised : DARK_UI.quiet, edge: ready ? DARK_UI.edgeLight : DARK_UI.edge, accent: ready ? DARK_UI.gold : DARK_UI.edge, cut: 11 });
    }
    if (interactIcon !== null && interactIcon !== undefined) paintDarkIcon(interactIcon, 'interact', ready ? DARK_UI.gold : DARK_UI.muted);
    targetHint.string = nearby === undefined ? '摇杆移动 · 靠近目标互动'
      : nearby.disabledReason === undefined ? `${nearby.label} · ${nearby.interactionLabel ?? '互动'}` : `${nearby.label} · 查看条件`;
    targetHint.color = nearby?.disabledReason !== undefined ? DARK_UI.red : DARK_UI.bone;
    markerGraphics.clear();
    if (nearby !== undefined) {
      marker.setPosition(new Vec3(nearby.x, -nearby.y, 0));
      markerGraphics.lineWidth = 3;
      ellipse(markerGraphics, 0, 0, nearby.kind === 'npc' ? 36 : 69, nearby.kind === 'npc' ? 15 : 24, new Color(197, 168, 106, 25), ready ? TEAL : RED);
    }
  };
  updateInteraction();

  return {
    joystick,
    joystickThumb,
    getPosition: () => ({ x: position.x, y: position.y }),
    getFacing: () => facing,
    tick: (dt, axis) => {
      if (disposed) return;
      const elapsed = Math.min(Math.max(dt, 0), 0.1);
      age += elapsed;
      const next = busy ? position : stepWalkPosition(spec, position, axis, elapsed);
      const moved = Math.abs(next.x - position.x) + Math.abs(next.y - position.y) > 0.01;
      if (axis.x !== 0 || axis.y !== 0) facing = Math.abs(axis.x) > Math.abs(axis.y)
        ? axis.x < 0 ? 'left' : 'right' : axis.y < 0 ? 'up' : 'down';
      position = next;
      if (moved) {
        player.setPosition(new Vec3(position.x, -position.y, 0));
        playerDepth.y = position.y;
        sortDepth();
        gait += elapsed * 9;
      } else gait = 0;
      const nextFrame = Math.floor(gait) % 4;
      if (frameIndex !== nextFrame || previousFacing !== facing) {
        frameIndex = nextFrame;
        previousFacing = facing;
        if (playerSprite !== undefined && walkerFrames !== undefined) {
          const row = facing === 'down' ? 0 : facing === 'left' ? 1 : facing === 'right' ? 2 : 3;
          playerSprite.spriteFrame = walkerFrames[row * 4 + frameIndex] ?? null;
        } else if (playerGraphics !== undefined) drawHuman(playerGraphics, facing, frameIndex);
      }
      const desired = clampCamera(position);
      const smoothing = 1 - Math.exp(-elapsed * 9);
      cameraPoint = { x: cameraPoint.x + (desired.x - cameraPoint.x) * smoothing, y: cameraPoint.y + (desired.y - cameraPoint.y) * smoothing };
      camera.setPosition(new Vec3(-cameraPoint.x * WORLD_ZOOM, cameraPoint.y * WORLD_ZOOM, 0));
      updateInteraction();
      const nextFlameFrame = Math.floor(age * 10);
      if (flameFrame !== nextFlameFrame) {
        flameFrame = nextFlameFrame;
        flames.forEach((flame) => drawFlame(flame.graphics, age + flame.offset));
      }
      if (toast !== undefined && !failed) toast.color = new Color(DARK_UI.gold.r, DARK_UI.gold.g, DARK_UI.gold.b, Math.round(255 * Math.max(0, Math.min(1, 4 - age))));
      if (damageLabel !== undefined) {
        damageLabel.node.setPosition(new Vec3(0, 136 + Math.min(age, 1) * 35, 0));
        damageLabel.color = new Color(RED.r, RED.g, RED.b, Math.round(255 * Math.max(0, 1 - age / 1.2)));
      }
      slash.clear();
      if (!failed && options.feedback?.damage !== undefined && options.feedback.damage > 0 && age < 0.34) {
        slash.lineWidth = 9 * (1 - age / 0.34);
        slash.strokeColor = new Color(255, 241, 194, Math.round(255 * (1 - age / 0.34)));
        slash.moveTo(-57, 101); slash.lineTo(-7, 40); slash.lineTo(55, 12); slash.stroke();
        slash.lineWidth = 3;
        slash.strokeColor = GOLD;
        slash.moveTo(-48, 14); slash.lineTo(9, 58); slash.lineTo(34, 96); slash.stroke();
      }
    },
    dispose: () => { disposed = true; scene.destroy(); },
  };
}
