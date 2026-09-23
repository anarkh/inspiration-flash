import { Color, Graphics } from 'cc';

/** Cocos presentation-only materials; no gameplay or persistent theme state.
 * 玄黑金箓: warm ink black, red-gold (赤金) edges and cinnabar danger accents. */
export const DARK_UI = Object.freeze({
  bone: new Color(232, 225, 210, 255),
  muted: new Color(168, 158, 140, 255),
  gold: new Color(201, 168, 106, 255),
  red: new Color(214, 100, 82, 255),
  green: new Color(156, 172, 138, 255),
  ink: new Color(14, 12, 10, 255),
  panel: new Color(22, 19, 15, 255),
  raised: new Color(31, 27, 21, 255),
  quiet: new Color(26, 23, 18, 255),
  edge: new Color(88, 70, 46, 255),
  edgeLight: new Color(150, 118, 72, 255),
  goldDark: new Color(66, 50, 28, 255),
  redDark: new Color(46, 24, 20, 255),
});

type Point = readonly [number, number];
type FrameOptions = Readonly<{ fill?: Color; edge?: Color; accent?: Color; cut?: number; ornate?: boolean }>;

function path(g: Graphics, points: readonly Point[], closed = false): void {
  const first = points[0];
  if (first === undefined) return;
  g.moveTo(first[0], first[1]);
  for (const point of points.slice(1)) g.lineTo(point[0], point[1]);
  if (closed) g.close();
}

function outline(g: Graphics, w: number, h: number, cut: number): void {
  path(g, [[-w / 2 + cut, -h / 2], [w / 2 - cut, -h / 2], [w / 2, -h / 2 + cut],
    [w / 2, h / 2 - cut], [w / 2 - cut, h / 2], [-w / 2 + cut, h / 2],
    [-w / 2, h / 2 - cut], [-w / 2, -h / 2 + cut]], true);
}

/** Static iron bevels with restrained wear. Keeps the owner's hit rectangle intact. */
export function paintDarkFrame(g: Graphics, width: number, height: number, options: FrameOptions = {}): void {
  const fill = options.fill ?? DARK_UI.panel;
  const edge = options.edge ?? DARK_UI.edge;
  const accent = options.accent ?? DARK_UI.edgeLight;
  const cut = Math.min(options.cut ?? 8, width / 6, height / 6);
  g.clear();
  g.fillColor = fill;
  g.strokeColor = edge;
  g.lineWidth = 2;
  outline(g, width, height, cut);
  g.fill();
  if (edge.a === 0) return;
  g.stroke();
  g.lineWidth = 1;
  g.strokeColor = new Color(accent.r, accent.g, accent.b, 108);
  outline(g, width - 8, height - 8, Math.max(2, cut - 3));
  g.stroke();
  // Short upper highlights and a dark lower lip give flat metal a physical edge.
  g.strokeColor = new Color(accent.r, accent.g, accent.b, 168);
  path(g, [[-width / 2 + cut + 4, height / 2 - 3], [width / 2 - cut - 4, height / 2 - 3]]);
  g.stroke();
  g.strokeColor = new Color(7, 8, 10, 200);
  path(g, [[-width / 2 + cut + 4, -height / 2 + 3], [width / 2 - cut - 4, -height / 2 + 3]]);
  g.stroke();
  // Low-contrast scratches stay at the rim, never behind readable text.
  g.strokeColor = new Color(accent.r, accent.g, accent.b, 35);
  for (let i = 0; i < Math.min(8, Math.floor(width / 60)); i += 1) {
    const x = -width / 2 + 22 + i * 57;
    path(g, [[x, height / 2 - 9], [x + 12, height / 2 - 10]]);
    g.stroke();
  }
  if (!options.ornate) return;
  g.strokeColor = accent;
  g.lineWidth = 2;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const x = sx * (width / 2 - 13);
    const y = sy * (height / 2 - 13);
    path(g, [[x - sx * 24, y], [x - sx * 7, y], [x, y - sy * 7], [x, y - sy * 24]]);
    g.stroke();
  }
  g.fillColor = accent;
  path(g, [[-5, height / 2 - 4], [0, height / 2 - 10], [5, height / 2 - 4], [0, height / 2 - 1]], true);
  g.fill();
}

export type DarkIcon = 'character' | 'bag' | 'map' | 'target' | 'menu' | 'sword' | 'guard' | 'arcane' | 'interact' | 'left' | 'right' | 'close';

/** One engraved glyph family, rendered by the existing Cocos Graphics pipeline. */
export function paintDarkIcon(g: Graphics, kind: DarkIcon, color: Color = DARK_UI.gold): void {
  g.clear();
  g.strokeColor = color;
  g.fillColor = new Color(color.r, color.g, color.b, 32);
  g.lineWidth = 2.5;
  const stroke = (points: readonly Point[], closed = false): void => { path(g, points, closed); g.stroke(); };
  if (kind === 'character') {
    path(g, [[0, 23], [-13, 16], [-12, -1], [-7, -8], [0, -13], [7, -8], [12, -1], [13, 16]], true); g.fill(); g.stroke();
    stroke([[-8, 5], [-3, 2]]); stroke([[8, 5], [3, 2]]); stroke([[0, 16], [0, -6]]);
    stroke([[-11, -8], [-22, -16], [-23, -24], [23, -24], [22, -16], [11, -8]]);
  } else if (kind === 'bag') {
    path(g, [[-18, 11], [-22, -18], [-15, -23], [15, -23], [22, -18], [18, 11]], true); g.fill(); g.stroke();
    stroke([[-10, 11], [-10, 22], [10, 22], [10, 11]]); stroke([[-18, 9], [18, 9]]);
    stroke([[-18, -3], [-5, -6], [5, -6], [18, -3]]); stroke([[-3, -3], [-3, -12], [3, -12], [3, -3]], true);
  } else if (kind === 'map') {
    stroke([[-23, -19], [-23, 20], [-8, 14], [8, 22], [23, 16], [23, -23], [8, -17], [-8, -25]], true);
    stroke([[-8, 14], [-8, -25]]); stroke([[8, 22], [8, -17]]);
    stroke([[-17, 1], [-13, 5], [-17, 9]]); stroke([[12, -5], [17, 0], [12, 5]]);
  } else if (kind === 'target') {
    stroke([[-17, -24], [-17, 24], [19, 19], [10, 6], [18, -6], [-17, -1]]);
    stroke([[-11, 17], [5, 14], [0, 7], [5, 1]]);
  } else if (kind === 'menu') {
    stroke([[-21, -24], [-21, 23], [-4, 21], [0, 16], [4, 21], [21, 23], [21, -24], [4, -21], [0, -16], [-4, -21]], true);
    stroke([[0, 16], [0, -16]]); stroke([[-15, 10], [-7, 8]]); stroke([[7, 8], [15, 10]]);
    stroke([[-15, 1], [-7, -1]]); stroke([[7, -1], [15, 1]]);
  } else if (kind === 'sword') {
    path(g, [[-5, -9], [10, 19], [20, 24], [20, 12], [4, -13]], true); g.fill(); g.stroke();
    stroke([[-14, -6], [8, -18]]); stroke([[-6, -12], [-14, -24]]); stroke([[-18, -21], [-10, -27]]);
    stroke([[1, -6], [15, 18]]);
  } else if (kind === 'guard') {
    path(g, [[0, 24], [-21, 15], [-18, -9], [-10, -19], [0, -26], [10, -19], [18, -9], [21, 15]], true); g.fill(); g.stroke();
    stroke([[0, 17], [0, -18]]); stroke([[-12, 8], [12, 8]]);
  } else if (kind === 'arcane') {
    stroke([[0, 25], [18, 0], [0, -25], [-18, 0]], true);
    stroke([[0, 15], [8, 0], [0, -15], [-8, 0]], true);
    stroke([[-25, 0], [-20, 0]]); stroke([[20, 0], [25, 0]]);
  } else if (kind === 'interact') {
    stroke([[-22, 18], [22, 18], [22, -7], [4, -7], [-10, -22], [-10, -7], [-22, -7]], true);
    stroke([[-11, 7], [11, 7]]); stroke([[-11, 0], [3, 0]]);
  } else if (kind === 'close') {
    stroke([[-15, -15], [15, 15]]); stroke([[-15, 15], [15, -15]]);
  } else {
    const direction = kind === 'left' ? -1 : 1;
    stroke([[-direction * 7, 15], [direction * 9, 0], [-direction * 7, -15]]);
    stroke([[-direction * 20, 0], [direction * 8, 0]]);
  }
}
