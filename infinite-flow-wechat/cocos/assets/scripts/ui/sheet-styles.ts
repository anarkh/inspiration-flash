import { Color, Graphics } from 'cc';
import {
  DEFAULT_SHEET_THEME,
  fillChamfer,
  strokeChamfer,
  rule,
  withAlpha,
  type SheetDollParts,
  type SheetFrameInput,
  type SheetPalette,
  type SheetTheme,
} from './sheet-theme';

/**
 * The ten gallery styles. Every frame remains a centered cut-corner octagon and
 * every painter starts with the full-size reading-surface fill; ornaments only
 * ever follow. No roundRect/circle enclosing paths are emitted here.
 */

type Pt = readonly [number, number];

function polyline(g: Graphics, points: readonly Pt[], color: Color, lineWidth: number, close = false): void {
  const first = points[0]!;
  g.strokeColor = color;
  g.lineWidth = lineWidth;
  g.moveTo(first[0], first[1]);
  for (const point of points.slice(1)) g.lineTo(point[0], point[1]);
  if (close) g.close();
  g.stroke();
}

function fillPoly(g: Graphics, points: readonly Pt[], color: Color): void {
  const first = points[0]!;
  g.fillColor = color;
  g.moveTo(first[0], first[1]);
  for (const point of points.slice(1)) g.lineTo(point[0], point[1]);
  g.close();
  g.fill();
}

function chamferRectPoints(cx: number, cy: number, width: number, height: number, cut: number): Pt[] {
  const x0 = cx - width / 2;
  const x1 = cx + width / 2;
  const y0 = cy - height / 2;
  const y1 = cy + height / 2;
  return [
    [x0 + cut, y0], [x1 - cut, y0], [x1, y0 + cut], [x1, y1 - cut],
    [x1 - cut, y1], [x0 + cut, y1], [x0, y1 - cut], [x0, y0 + cut],
  ];
}

function diamond(g: Graphics, x: number, y: number, radius: number, color: Color): void {
  g.fillColor = color;
  g.moveTo(x, y + radius);
  g.lineTo(x + radius, y);
  g.lineTo(x, y - radius);
  g.lineTo(x - radius, y);
  g.close();
  g.fill();
}

function rectPoly(g: Graphics, x0: number, y0: number, x1: number, y1: number, color: Color): void {
  g.fillColor = color;
  g.moveTo(x0, y0);
  g.lineTo(x1, y0);
  g.lineTo(x1, y1);
  g.lineTo(x0, y1);
  g.close();
  g.fill();
}

type ScratchKind = 'tick' | 'dash' | 'dot' | 'none';
type CornerKind = 'none' | 'bracket' | 'slipCap' | 'cloud' | 'nail' | 'tally' | 'stitch' | 'fuFoot';
type CrestKind = 'diamond' | 'slips' | 'taotie' | 'talisman' | 'casketLock'
  | 'tigerTally' | 'ribbonSeal' | 'lamellar' | 'cloudTriad' | 'ironPlate';

interface CraftSpec {
  readonly edgeWidth: number;
  readonly brightRim: boolean;
  readonly highlight: boolean;
  readonly sheetHairlineAlpha: number;
  readonly cardHairline: boolean;
  readonly innerPlate: boolean;
  readonly scratches: ScratchKind;
  readonly scratchCount: number;
  readonly corner: CornerKind;
  readonly crest: CrestKind;
  /** Cinnabar inset rule on cards (style 4). */
  readonly cinnabarCardRule: boolean;
  /** Stitched dashes replace plain card/tile edges (style 8). */
  readonly stitchCardEdges: boolean;
}

// --- corner motifs -----------------------------------------------------------

function cornerMotif(g: Graphics, kind: CornerKind, width: number, height: number, color: Color): void {
  if (kind === 'none') return;
  for (const sx of [-1, 1] as const) {
    for (const sy of [-1, 1] as const) {
      // Talisman fork strokes only hang from the bottom two corners.
      if (kind === 'fuFoot' && sy !== -1) continue;
      const x = sx * (width / 2 - 13);
      const y = sy * (height / 2 - 13);
      if (kind === 'bracket') {
        polyline(g, [[x - sx * 24, y], [x - sx * 7, y], [x, y - sy * 7], [x, y - sy * 24]], color, 2);
      } else if (kind === 'slipCap') {
        rule(g, x - sx * 22, y, x - sx * 4, y, color, 1.5);
        rule(g, x - sx * 22, y - sy * 6, x - sx * 4, y - sy * 6, color, 1.5);
      } else if (kind === 'nail') {
        diamond(g, x - sx * 8, y - sy * 8, 2.5, color);
        diamond(g, x - sx * 20, y - sy * 3, 2.5, color);
      } else if (kind === 'tally') {
        polyline(g, [
          [x - sx * 22, y], [x - sx * 14, y], [x - sx * 14, y - sy * 8],
          [x - sx * 7, y - sy * 8], [x - sx * 7, y - sy * 16], [x, y - sy * 16],
        ], color, 1.5);
      } else if (kind === 'stitch') {
        rule(g, x - sx * 16, y - sy * 16, x - sx * 4, y - sy * 4, color, 1.5);
        rule(g, x - sx * 16, y - sy * 4, x - sx * 4, y - sy * 16, color, 1.5);
      } else if (kind === 'fuFoot') {
        // 符脚岔笔: forking brush strokes dropping from the top corners.
        polyline(g, [[x - sx * 16, y - sy * 2], [x - sx * 4, y - sy * 10], [x - sx * 14, y - sy * 20]], color, 1.5);
        rule(g, x - sx * 2, y - sy * 18, x - sx * 10, y - sy * 26, color, 1.5);
      } else if (kind === 'cloud') {
        // 云雷: nested rectilinear three-turn hook.
        const px = (dx: number, dy: number): Pt => [x - sx * dx, y - sy * dy];
        polyline(g, [
          px(2, 2), px(16, 2), px(16, 16), px(6, 16), px(6, 8), px(11, 8), px(11, 12),
        ], color, 1.5);
      }
    }
  }
}

// --- header crests (top band only) ------------------------------------------

function crestPainter(g: Graphics, kind: CrestKind, height: number, accent: Color, danger: Color): void {
  const top = height / 2;
  if (kind === 'diamond') {
    diamond(g, 0, top - 6, 5, accent);
  } else if (kind === 'slips') {
    for (const dy of [6, 12, 18]) rule(g, -13, top - dy, 13, top - dy, accent, 2);
    rule(g, 0, top - 4, 0, top - 24, accent, 1.5);
    diamond(g, 0, top - 27, 3, accent);
  } else if (kind === 'taotie') {
    polyline(g, [[-30, top - 8], [-16, top - 20], [0, top - 13], [16, top - 20], [30, top - 8]], accent, 2);
    rectPoly(g, -22, top - 22, -12, top - 14, accent);
    rectPoly(g, 12, top - 22, 22, top - 14, accent);
    rule(g, 0, top - 13, 0, top - 27, accent, 2);
  } else if (kind === 'talisman') {
    diamond(g, 0, top - 10, 8, accent);
    polyline(g, [[-4, top - 16], [-7, top - 26], [-3, top - 30]], danger, 1.5);
    polyline(g, [[4, top - 16], [7, top - 26], [3, top - 30]], danger, 1.5);
  } else if (kind === 'casketLock') {
    fillPoly(g, chamferRectPoints(0, top - 11, 30, 18, 4), accent);
    polyline(g, [[-8, top - 18], [-8, top - 25], [8, top - 25], [8, top - 18]], accent, 2);
  } else if (kind === 'tigerTally') {
    polyline(g, [[-26, top - 8], [-26, top - 20], [-14, top - 20], [-14, top - 14], [-2, top - 14]], accent, 2);
    polyline(g, [[26, top - 8], [26, top - 20], [14, top - 20], [14, top - 14], [2, top - 14]], accent, 2);
    rule(g, 0, top - 8, 0, top - 24, accent, 1.5);
  } else if (kind === 'ribbonSeal') {
    strokeChamfer(g, 20, 20, 4, accent, 1.5);
    polyline(g, [[-5, top - 18], [-9, top - 30], [-3, top - 28]], accent, 1.5);
    polyline(g, [[5, top - 18], [9, top - 30], [3, top - 28]], accent, 1.5);
    diamond(g, 0, top - 10, 3, accent);
  } else if (kind === 'lamellar') {
    const scale = (cx: number, cy: number, w: number): void => {
      g.fillColor = accent;
      g.moveTo(cx - w / 2, cy);
      g.lineTo(cx, cy - 11);
      g.lineTo(cx + w / 2, cy);
      g.lineTo(cx + w / 2 - 3, cy);
      g.lineTo(cx, cy - 6);
      g.lineTo(cx - w / 2 + 3, cy);
      g.close();
      g.fill();
    };
    scale(-16, top - 4, 22);
    scale(0, top - 2, 26);
    scale(16, top - 4, 22);
  } else if (kind === 'cloudTriad') {
    const scroll = (cx: number, cy: number): void => {
      polyline(g, [[cx - 9, cy + 5], [cx + 7, cy + 5], [cx + 7, cy - 7], [cx - 3, cy - 7], [cx - 3, cy + 1], [cx + 2, cy + 1]], accent, 1.5);
    };
    scroll(-20, top - 8);
    scroll(0, top - 14);
    scroll(20, top - 8);
  } else if (kind === 'ironPlate') {
    fillPoly(g, chamferRectPoints(0, top - 14, 64, 14, 4), withAlpha(accent, 60));
    polyline(g, chamferRectPoints(0, top - 14, 64, 14, 4), accent, 1.5, true);
    diamond(g, -22, top - 14, 2, accent);
    diamond(g, 22, top - 14, 2, accent);
  }
}

// --- wear fields -------------------------------------------------------------

function scratchField(g: Graphics, kind: ScratchKind, count: number, width: number, height: number, color: Color): void {
  if (kind === 'none' || count <= 0) return;
  const max = Math.min(count, Math.max(1, Math.floor(width / 56)));
  for (let i = 0; i < max; i += 1) {
    const x = -width / 2 + 22 + i * 57;
    if (kind === 'tick') {
      rule(g, x, height / 2 - 9, x + 12, height / 2 - 10, withAlpha(color, 35), 1);
    } else if (kind === 'dash') {
      rule(g, x, height / 2 - 9, x + 20, height / 2 - 12, withAlpha(color, 30), 1.5);
    } else {
      diamond(g, x + 6, height / 2 - 10, 1.6, withAlpha(color, 45));
    }
  }
}

/** Stitched dashes along the top and bottom card edges. */
function stitchEdges(g: Graphics, width: number, height: number, color: Color): void {
  const c = withAlpha(color, 150);
  for (let x = -width / 2 + 14; x <= width / 2 - 14; x += 26) {
    rule(g, x, height / 2 - 5, x + 10, height / 2 - 5, c, 1.5);
    rule(g, x, -height / 2 + 5, x + 10, -height / 2 + 5, c, 1.5);
  }
}

// --- crafted frame factory ---------------------------------------------------

function craftFrame(palette: SheetPalette, spec: CraftSpec) {
  return (g: Graphics, width: number, height: number, input: SheetFrameInput): void => {
    // Contract: first fill is always the full-size cut-corner reading surface.
    fillChamfer(g, width, height, input.cut, input.fill);
    strokeChamfer(g, width, height, input.cut, input.edge, spec.edgeWidth);
    if (spec.brightRim) strokeChamfer(g, width - 2, height - 2, Math.max(2, input.cut - 1), withAlpha(palette.edgeStrong, 190), 1);
    const isSheet = input.role === 'sheet';
    const isCardLike = input.role === 'card' || input.role === 'tile' || input.role === 'rack';
    if (spec.innerPlate) {
      strokeChamfer(g, width - 8, height - 8, Math.max(2, input.cut - 3), withAlpha(palette.edge, 120), 1);
    }
    if (isSheet) {
      strokeChamfer(g, width - 8, height - 8, Math.max(2, input.cut - 3), withAlpha(palette.edgeStrong, spec.sheetHairlineAlpha), 1);
      if (spec.highlight) {
        rule(g, -width / 2 + input.cut + 4, height / 2 - 3, width / 2 - input.cut - 4, height / 2 - 3, withAlpha(palette.edgeStrong, 168), 1);
        rule(g, -width / 2 + input.cut + 4, -height / 2 + 3, width / 2 - input.cut - 4, -height / 2 + 3, new Color(7, 8, 10, 200), 1);
      }
      scratchField(g, spec.scratches, spec.scratchCount, width, height, palette.edgeStrong);
      cornerMotif(g, spec.corner, width, height, palette.edgeStrong);
      crestPainter(g, spec.crest, height, palette.accent, palette.danger);
    } else if (isCardLike) {
      if (spec.cardHairline) {
        strokeChamfer(g, width - 10, height - 10, Math.max(2, input.cut - 3), withAlpha(palette.edgeStrong, 90), 1);
      }
      if (spec.cinnabarCardRule) {
        rule(g, -width / 2 + 18, height / 2 - 10, width / 2 - 18, height / 2 - 10, withAlpha(palette.danger, 150), 1.5);
      }
      if (spec.stitchCardEdges) stitchEdges(g, width, height, palette.edgeStrong);
      scratchField(g, spec.scratches, spec.scratchCount, width, height, palette.edgeStrong);
    }
  };
}

// --- dolls -------------------------------------------------------------------

type AuraKind = 'rings' | 'square' | 'squareMeander' | 'octagon' | 'sealGrid' | 'mandorla' | 'none';
type CoatKind = 'soft' | 'square' | 'wide' | 'straight' | 'lamellar';

interface DollSpec {
  readonly aura: AuraKind;
  readonly coat: CoatKind;
  readonly coatColor: Color;
  readonly cuffs: boolean;
  readonly collarScale: number;
  readonly pedestal: boolean;
}

function craftDoll(parts: SheetDollParts, palette: SheetPalette, spec: DollSpec): void {
  const { aura, figure } = parts;
  const gold = palette.accent;
  if (spec.aura === 'rings') {
    aura.strokeColor = withAlpha(gold, 96);
    aura.lineWidth = 3;
    aura.circle(0, 0, 84);
    aura.stroke();
    aura.strokeColor = withAlpha(gold, 48);
    aura.lineWidth = 2;
    aura.circle(0, 0, 66);
    aura.stroke();
  } else if (spec.aura === 'square' || spec.aura === 'squareMeander') {
    aura.strokeColor = withAlpha(gold, 96);
    aura.lineWidth = 3;
    strokeChamfer(aura, 168, 168, 18, withAlpha(gold, 96), 3);
    strokeChamfer(aura, 132, 132, 12, withAlpha(gold, 48), 2);
    if (spec.aura === 'squareMeander') {
      for (const [rx, ry] of [[-60, 0], [60, 0], [0, 60], [0, -60]] as const) {
        polyline(aura, [[rx - 8, ry - 8], [rx + 8, ry - 8], [rx + 8, ry + 8], [rx - 4, ry + 8]], withAlpha(gold, 70), 1.5);
      }
    }
  } else if (spec.aura === 'octagon' || spec.aura === 'mandorla') {
    const cut = spec.aura === 'mandorla' ? 44 : 30;
    strokeChamfer(aura, 168, 168, cut, withAlpha(gold, 80), 3);
    strokeChamfer(aura, 134, 134, Math.round(cut * 0.8), withAlpha(gold, 40), 2);
  } else if (spec.aura === 'sealGrid') {
    strokeChamfer(aura, 168, 168, 12, withAlpha(gold, 70), 2);
    for (const x of [-30, 30]) rule(aura, x, -60, x, 60, withAlpha(gold, 32), 1);
    for (const y of [-30, 30]) rule(aura, -60, y, 60, y, withAlpha(gold, 32), 1);
  }

  if (spec.pedestal) {
    rectPoly(figure, -54, -96, 54, -84, palette.accentDark);
    fillPoly(figure, [[-44, -84], [44, -84], [38, -74], [-38, -74]], withAlpha(gold, 180));
  }

  figure.fillColor = spec.coatColor;
  figure.strokeColor = palette.edgeStrong;
  figure.lineWidth = 3;
  if (spec.coat === 'soft') {
    figure.moveTo(-34, 10); figure.lineTo(-27, -28); figure.lineTo(-19, -88);
    figure.lineTo(19, -88); figure.lineTo(27, -28); figure.lineTo(34, 10);
    figure.lineTo(12, 2); figure.lineTo(-12, 2); figure.close();
  } else if (spec.coat === 'square') {
    figure.moveTo(-40, 12); figure.lineTo(-38, -30); figure.lineTo(-22, -88);
    figure.lineTo(22, -88); figure.lineTo(38, -30); figure.lineTo(40, 12);
    figure.lineTo(14, 4); figure.lineTo(-14, 4); figure.close();
  } else if (spec.coat === 'wide') {
    figure.moveTo(-42, 12); figure.lineTo(-32, -34); figure.lineTo(-26, -88);
    figure.lineTo(26, -88); figure.lineTo(32, -34); figure.lineTo(42, 12);
    figure.lineTo(12, 2); figure.lineTo(-12, 2); figure.close();
  } else if (spec.coat === 'straight') {
    figure.moveTo(-31, 10); figure.lineTo(-26, -88); figure.lineTo(26, -88);
    figure.lineTo(31, 10); figure.lineTo(11, 2); figure.lineTo(-11, 2); figure.close();
  } else {
    figure.moveTo(-36, 10); figure.lineTo(-29, -28); figure.lineTo(-21, -88);
    figure.lineTo(21, -88); figure.lineTo(29, -28); figure.lineTo(36, 10);
    figure.lineTo(12, 2); figure.lineTo(-12, 2); figure.close();
  }
  figure.fill();
  figure.stroke();

  if (spec.coat === 'square' || spec.coat === 'lamellar') {
    rectPoly(figure, -42, 14, -18, -2, withAlpha(palette.edgeStrong, 60));
    rectPoly(figure, 18, 14, 42, -2, withAlpha(palette.edgeStrong, 60));
  }
  if (spec.coat === 'lamellar') {
    for (let y = -18; y >= -72; y -= 14) rule(figure, -20, y, 20, y, withAlpha(palette.edgeStrong, 130), 2);
  }
  const collar = 9 * spec.collarScale;
  figure.fillColor = palette.danger;
  figure.moveTo(-collar, 8);
  figure.lineTo(collar, 8);
  figure.lineTo(0, -10 - (spec.collarScale - 1) * 8);
  figure.close();
  figure.fill();
  if (spec.cuffs) {
    rule(figure, -31, -24, -20, -22, palette.danger, 3);
    rule(figure, 20, -22, 31, -24, palette.danger, 3);
  }
  figure.fillColor = new Color(217, 174, 131, 255);
  figure.strokeColor = new Color(90, 70, 48, 255);
  figure.lineWidth = 3;
  figure.circle(0, 34, 21);
  figure.fill();
  figure.stroke();
}

type SealKind = 'dot' | 'diamond' | 'square';

function craftSeal(kind: SealKind) {
  return (g: Graphics, palette: SheetPalette): void => {
    if (kind === 'dot') {
      g.fillColor = palette.accent;
      g.circle(0, 0, 7);
      g.fill();
    } else if (kind === 'diamond') {
      diamond(g, 0, 0, 8, palette.accent);
    } else {
      fillChamfer(g, 14, 14, 3, palette.accent);
    }
  };
}

// --- style definitions -------------------------------------------------------

interface StyleSeed {
  readonly id: string;
  readonly name: string;
  readonly reference: string;
  readonly paletteColors: {
    readonly text?: Color;
    readonly textMuted?: Color;
    readonly surface: Color;
    readonly raised: Color;
    readonly quiet: Color;
    readonly ink?: Color;
    readonly edge: Color;
    readonly edgeStrong: Color;
    readonly accent: Color;
    readonly accentDark: Color;
    readonly danger?: Color;
    readonly dangerDark?: Color;
    readonly positive?: Color;
  };
  readonly cut: SheetTheme['framePolicy']['cut'];
  readonly spec: CraftSpec;
  readonly doll: DollSpec;
  readonly seal: SealKind;
  readonly typeScale: SheetTheme['typeScale'];
  readonly iconLineWidth?: number;
}

const c = (r: number, g: number, b: number): Color => new Color(r, g, b, 255);

function buildPalette(seed: StyleSeed['paletteColors']): SheetPalette {
  return {
    text: seed.text ?? DEFAULT_SHEET_THEME.palette.text,
    textMuted: seed.textMuted ?? DEFAULT_SHEET_THEME.palette.textMuted,
    surface: seed.surface,
    raised: seed.raised,
    quiet: seed.quiet,
    ink: seed.ink ?? DEFAULT_SHEET_THEME.palette.ink,
    edge: seed.edge,
    edgeStrong: seed.edgeStrong,
    accent: seed.accent,
    accentDark: seed.accentDark,
    danger: seed.danger ?? DEFAULT_SHEET_THEME.palette.danger,
    dangerDark: seed.dangerDark ?? DEFAULT_SHEET_THEME.palette.dangerDark,
    positive: seed.positive ?? DEFAULT_SHEET_THEME.palette.positive,
    backdrop: DEFAULT_SHEET_THEME.palette.backdrop,
    severity: {
      danger: seed.danger ?? DEFAULT_SHEET_THEME.palette.danger,
      warning: seed.accent,
      positive: seed.positive ?? DEFAULT_SHEET_THEME.palette.positive,
      neutral: seed.text ?? DEFAULT_SHEET_THEME.palette.text,
    },
  };
}

const BASELINE_CRAFT: CraftSpec = {
  edgeWidth: 2,
  brightRim: false,
  highlight: true,
  sheetHairlineAlpha: 108,
  cardHairline: false,
  innerPlate: false,
  scratches: 'tick',
  scratchCount: 8,
  corner: 'bracket',
  crest: 'diamond',
  cinnabarCardRule: false,
  stitchCardEdges: false,
};

function buildStyle(seed: StyleSeed): SheetTheme {
  const paletteColors = buildPalette(seed.paletteColors);
  return {
    id: seed.id,
    name: seed.name,
    reference: seed.reference,
    palette: paletteColors,
    framePolicy: { cut: seed.cut },
    iconPen: { lineWidth: seed.iconLineWidth ?? 4 },
    typeScale: seed.typeScale,
    thumb: { color: paletteColors.accent, alpha: 140, width: 6, radius: 3 },
    paintFrame: craftFrame(paletteColors, seed.spec),
    paintIcon: DEFAULT_SHEET_THEME.paintIcon,
    paintDoll: (parts, palette) => craftDoll(parts, palette, seed.doll),
    paintSeal: craftSeal(seed.seal),
  };
}

const SCALE_ONE: SheetTheme['typeScale'] = { title: 1, section: 1, body: 1, micro: 1, value: 1 };

export const GALLERY_SHEET_THEMES: readonly SheetTheme[] = [
  // 1. Baseline production theme (kept here so the gallery owns an ordered list).
  DEFAULT_SHEET_THEME,
  // 2. 玄墨玉简 — bound bamboo slips.
  buildStyle({
    id: 'xuan-mo-yu-jian',
    name: '玄墨玉简',
    reference: '《代号鸢》式排简礼器 · 细简边规',
    paletteColors: {
      surface: c(18, 20, 17), raised: c(26, 29, 25), quiet: c(22, 25, 22),
      edge: c(74, 88, 72), edgeStrong: c(132, 140, 108),
      accent: c(206, 178, 118), accentDark: c(48, 46, 26),
    },
    cut: { sheet: 10, card: 4, control: 6, tile: 4, cell: 4 },
    spec: {
      ...BASELINE_CRAFT, edgeWidth: 2, sheetHairlineAlpha: 90,
      cardHairline: true, scratches: 'none', scratchCount: 0,
      corner: 'slipCap', crest: 'slips',
    },
    doll: {
      aura: 'square', coat: 'straight', coatColor: c(40, 46, 38),
      cuffs: false, collarScale: 1, pedestal: false,
    },
    seal: 'square',
    typeScale: { ...SCALE_ONE, section: 0.98, micro: 1.04 },
  }),
  // 3. 云雷彝器 — heavy bronze ritual vessel.
  buildStyle({
    id: 'yun-lei-yi-qi',
    name: '云雷彝器',
    reference: '《原神》璃月铜器重器 · 云雷回纹',
    paletteColors: {
      surface: c(20, 17, 12), raised: c(34, 28, 18), quiet: c(27, 22, 15),
      edge: c(96, 74, 42), edgeStrong: c(166, 128, 66),
      accent: c(210, 170, 96), accentDark: c(58, 42, 18),
    },
    cut: { sheet: 14, card: 10, control: 8, tile: 10, cell: 8 },
    spec: {
      ...BASELINE_CRAFT, edgeWidth: 3, sheetHairlineAlpha: 120,
      innerPlate: true, scratches: 'dash', scratchCount: 8,
      corner: 'cloud', crest: 'taotie',
    },
    doll: {
      aura: 'squareMeander', coat: 'square', coatColor: c(46, 38, 24),
      cuffs: false, collarScale: 1, pedestal: false,
    },
    seal: 'square',
    typeScale: { ...SCALE_ONE, title: 1.02, micro: 0.98 },
    iconLineWidth: 3,
  }),
  // 4. 朱砂符箓 — cinnabar talisman paper.
  buildStyle({
    id: 'zhu-sha-fu-lu',
    name: '朱砂符箓',
    reference: '《道士出观》黄纸朱砂 · 符头批命',
    paletteColors: {
      surface: c(24, 17, 15), raised: c(36, 24, 20), quiet: c(30, 20, 17),
      edge: c(96, 58, 44), edgeStrong: c(178, 86, 64),
      accent: c(205, 164, 100), accentDark: c(70, 44, 24),
      danger: c(226, 112, 88), dangerDark: c(58, 22, 18),
    },
    cut: { sheet: 10, card: 8, control: 8, tile: 8, cell: 6 },
    spec: {
      ...BASELINE_CRAFT, sheetHairlineAlpha: 96, cardHairline: false,
      cinnabarCardRule: true, scratches: 'dot', scratchCount: 8,
      corner: 'fuFoot', crest: 'talisman',
    },
    doll: {
      aura: 'octagon', coat: 'soft', coatColor: c(64, 40, 32),
      cuffs: true, collarScale: 1.4, pedestal: false,
    },
    seal: 'diamond',
    typeScale: { ...SCALE_ONE, title: 1.04, section: 1.02 },
  }),
  // 5. 鎏金宝匣 — gilt tribute casket.
  buildStyle({
    id: 'liu-jin-bao-xia',
    name: '鎏金宝匣',
    reference: '《鸣潮》贵重贡匣 · 双层金沿',
    paletteColors: {
      text: c(238, 230, 214),
      surface: c(16, 13, 10), raised: c(30, 24, 15), quiet: c(24, 19, 12),
      edge: c(110, 84, 44), edgeStrong: c(196, 158, 84),
      accent: c(226, 190, 120), accentDark: c(58, 42, 18),
    },
    cut: { sheet: 12, card: 8, control: 8, tile: 8, cell: 6 },
    spec: {
      ...BASELINE_CRAFT, brightRim: true, sheetHairlineAlpha: 120,
      cardHairline: true, scratches: 'tick', scratchCount: 6,
      corner: 'nail', crest: 'casketLock',
    },
    doll: {
      aura: 'rings', coat: 'soft', coatColor: c(58, 46, 32),
      cuffs: false, collarScale: 1.2, pedestal: true,
    },
    seal: 'dot',
    typeScale: { ...SCALE_ONE, section: 1.02 },
  }),
  // 6. 兵符虎节 — inlaid bronze tiger tally.
  buildStyle({
    id: 'bing-fu-hu-jie',
    name: '兵符虎节',
    reference: '《率土》军令符节 · 错金咬合',
    paletteColors: {
      surface: c(17, 16, 15), raised: c(28, 26, 24), quiet: c(23, 22, 20),
      edge: c(82, 74, 64), edgeStrong: c(138, 124, 100),
      accent: c(196, 158, 96), accentDark: c(58, 46, 30),
    },
    cut: { sheet: 6, card: 6, control: 5, tile: 6, cell: 5 },
    spec: {
      ...BASELINE_CRAFT, edgeWidth: 3, sheetHairlineAlpha: 80,
      highlight: false, scratches: 'dash', scratchCount: 4,
      corner: 'tally', crest: 'tigerTally',
    },
    doll: {
      aura: 'square', coat: 'lamellar', coatColor: c(44, 42, 38),
      cuffs: false, collarScale: 0.9, pedestal: false,
    },
    seal: 'square',
    typeScale: { ...SCALE_ONE, title: 0.98, micro: 1.02 },
  }),
  // 7. 瓦当印绶 — Han eave-tile and seal ribbons.
  buildStyle({
    id: 'wa-dang-yin-shou',
    name: '瓦当印绶',
    reference: '《物华弥新》器物印信 · 印矩双规',
    paletteColors: {
      surface: c(23, 20, 17), raised: c(33, 29, 24), quiet: c(27, 24, 20),
      edge: c(92, 76, 56), edgeStrong: c(152, 126, 88),
      accent: c(208, 172, 110), accentDark: c(62, 50, 30),
    },
    cut: { sheet: 12, card: 8, control: 8, tile: 8, cell: 6 },
    spec: {
      ...BASELINE_CRAFT, sheetHairlineAlpha: 100, cardHairline: true,
      scratches: 'tick', scratchCount: 6,
      corner: 'nail', crest: 'ribbonSeal',
    },
    doll: {
      aura: 'sealGrid', coat: 'straight', coatColor: c(52, 46, 36),
      cuffs: false, collarScale: 1.25, pedestal: false,
    },
    seal: 'square',
    typeScale: SCALE_ONE,
  }),
  // 8. 乌皮铠甲 — black leather lamellar armor.
  buildStyle({
    id: 'wu-pi-kai-jia',
    name: '乌皮铠甲',
    reference: '军阵黑皮札甲 · 缝线铆钉',
    paletteColors: {
      surface: c(15, 14, 13), raised: c(27, 25, 23), quiet: c(21, 20, 18),
      edge: c(74, 66, 58), edgeStrong: c(128, 114, 96),
      accent: c(198, 160, 102), accentDark: c(52, 42, 28),
    },
    cut: { sheet: 12, card: 10, control: 8, tile: 10, cell: 8 },
    spec: {
      ...BASELINE_CRAFT, sheetHairlineAlpha: 90, innerPlate: true,
      cardHairline: false, stitchCardEdges: true,
      scratches: 'dash', scratchCount: 12,
      corner: 'stitch', crest: 'lamellar',
    },
    doll: {
      aura: 'none', coat: 'lamellar', coatColor: c(38, 36, 33),
      cuffs: false, collarScale: 0.9, pedestal: false,
    },
    seal: 'diamond',
    typeScale: { ...SCALE_ONE, micro: 1.02 },
  }),
  // 9. 金箓天书 — gilded celestial writ.
  buildStyle({
    id: 'jin-lu-tian-shu',
    name: '金箓天书',
    reference: '《一念逍遥》金色法箓 · 三重细线',
    paletteColors: {
      text: c(238, 232, 220),
      surface: c(21, 18, 15), raised: c(33, 29, 23), quiet: c(28, 24, 20),
      edge: c(96, 78, 52), edgeStrong: c(168, 138, 90),
      accent: c(216, 186, 128), accentDark: c(58, 44, 24),
    },
    cut: { sheet: 8, card: 6, control: 6, tile: 6, cell: 5 },
    spec: {
      ...BASELINE_CRAFT, edgeWidth: 1.5, sheetHairlineAlpha: 110,
      cardHairline: true, scratches: 'none', scratchCount: 0,
      corner: 'bracket', crest: 'cloudTriad',
    },
    doll: {
      aura: 'mandorla', coat: 'wide', coatColor: c(54, 44, 30),
      cuffs: false, collarScale: 1, pedestal: false,
    },
    seal: 'dot',
    typeScale: { ...SCALE_ONE, title: 1.06, section: 1.04 },
    iconLineWidth: 3,
  }),
  // 10. 玄铁素章 — restrained plain iron seal.
  buildStyle({
    id: 'xuan-tie-su-zhang',
    name: '玄铁素章',
    reference: '冷峻军务风 · 极简官造',
    paletteColors: {
      textMuted: c(174, 172, 168),
      surface: c(16, 16, 17), raised: c(29, 29, 30), quiet: c(23, 23, 24),
      edge: c(84, 86, 90), edgeStrong: c(150, 152, 158),
      accent: c(201, 168, 106), accentDark: c(58, 52, 40),
    },
    cut: { sheet: 5, card: 5, control: 4, tile: 5, cell: 4 },
    spec: {
      ...BASELINE_CRAFT, sheetHairlineAlpha: 70,
      cardHairline: false, scratches: 'none', scratchCount: 0,
      corner: 'none', crest: 'ironPlate',
    },
    doll: {
      aura: 'none', coat: 'straight', coatColor: c(52, 52, 56),
      cuffs: false, collarScale: 0.8, pedestal: false,
    },
    seal: 'square',
    typeScale: { ...SCALE_ONE, title: 0.98, micro: 1.04 },
  }),
];
