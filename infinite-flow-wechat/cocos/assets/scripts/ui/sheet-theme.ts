import { Color, Graphics } from 'cc';
import { DARK_UI, paintDarkFrame, paintDarkIcon } from './dark-ui';

/**
 * Sheet-scoped theming seam for the mobile info sheet (InfiniteFlowInfoSheet).
 * 玄黑金箓 stays the only visual language: a theme varies frame craft, ornaments,
 * typography scale and palette tokens, never layout or node structure.
 *
 * A theme's frame painter MUST issue the full-size cut-corner octagon fill first
 * (headless contrast attribution treats the first fill as the reading surface)
 * and MUST NOT emit rounded/circular enclosing paths.
 */

/** Semantic palette roles. Every recurring text/fill pairing is contrast-audited. */
export interface SheetPalette {
  /** Body text (was BONE). */
  readonly text: Color;
  /** Secondary text (was MUTED). */
  readonly textMuted: Color;
  /** Main sheet reading surface (was DARK_UI.panel). */
  readonly surface: Color;
  /** Cells and controls (was DARK_UI.raised). */
  readonly raised: Color;
  /** Cards (was DARK_UI.quiet). */
  readonly quiet: Color;
  /** Deepest fill, e.g. fog of war (was DARK_UI.ink). */
  readonly ink: Color;
  /** 2px iron edge (was DARK_UI.edge). */
  readonly edge: Color;
  /** Highlighted edge (was DARK_UI.edgeLight). */
  readonly edgeStrong: Color;
  /** 赤金 accent (was GOLD). */
  readonly accent: Color;
  /** Dark gold wash behind accent text (was GOLD_DARK). */
  readonly accentDark: Color;
  /** Cinnabar danger, never decorative (was RED). */
  readonly danger: Color;
  readonly dangerDark: Color;
  /** Jade positive status (was GREEN). */
  readonly positive: Color;
  /** Modal backdrop shade. */
  readonly backdrop: Color;
  /** Status metric accent roles. */
  readonly severity: Readonly<{
    danger: Color;
    warning: Color;
    positive: Color;
    neutral: Color;
  }>;
}

export type SheetFrameRole =
  | 'sheet'
  | 'titleBand'
  | 'card'
  | 'control'
  | 'iconButton'
  | 'tabActive'
  | 'tabIdle'
  | 'tile'
  | 'cell'
  | 'rack'
  | 'fog';

export interface SheetFrameInput {
  readonly role: SheetFrameRole;
  readonly fill: Color;
  readonly edge: Color;
  readonly accent: Color;
  /** Chamfer cut in design px; always > 0 so corners stay diagonal. */
  readonly cut: number;
  readonly ornate: boolean;
}

export type SheetTypographyRole = 'title' | 'section' | 'body' | 'micro' | 'value';

/** The two pre-created paper-doll Graphics (nodes and sizes are owned by the sheet). */
export interface SheetDollParts {
  readonly aura: Graphics;
  readonly figure: Graphics;
}

export interface SheetTheme {
  readonly id: string;
  readonly name: string;
  /** One-line market/reference caption shown by the style gallery. */
  readonly reference: string;
  readonly palette: SheetPalette;
  paintFrame(g: Graphics, width: number, height: number, input: SheetFrameInput): void;
  /** Full replacement of icon()'s glyph switch; pen color/width are already configured. */
  paintIcon(g: Graphics, kind: string, color: Color): void;
  /** Paper-doll figure drawn onto the two existing stage Graphics. */
  paintDoll(parts: SheetDollParts, palette: SheetPalette): void;
  /** Carried-item seal drawn inside the existing 18x18 node. */
  paintSeal(g: Graphics, palette: SheetPalette): void;
  readonly iconPen: Readonly<{ lineWidth: number }>;
  /** Font-size multipliers per inferred role; 1 keeps the baseline metrics. */
  readonly typeScale: Readonly<Record<SheetTypographyRole, number>>;
  readonly thumb: Readonly<{ color: Color; alpha: number; width: number; radius: number }>;
  /** Structural frame policy consumed when the sheet resolves panel geometry. */
  readonly framePolicy: Readonly<{
    cut: Readonly<{ sheet: number; card: number; control: number; tile: number; cell: number }>;
  }>;
}

/** Resolve the chamfer cut for a role; rack/tab/icon-button inherit the nearest family. */
export function sheetRoleCut(
  cut: SheetTheme['framePolicy']['cut'],
  role: SheetFrameRole,
): number {
  switch (role) {
    case 'sheet':
      return cut.sheet;
    case 'titleBand':
      return cut.card;
    case 'tile':
    case 'fog':
      return cut.tile;
    case 'cell':
      return cut.cell;
    case 'control':
    case 'iconButton':
    case 'tabActive':
    case 'tabIdle':
      return cut.control;
    case 'card':
    case 'rack':
    default:
      return cut.card;
  }
}

// --- Graphics-only painter primitives (the headless cc stub implements all of these) ---

export function withAlpha(color: Color, alpha: number): Color {
  return new Color(color.r, color.g, color.b, alpha);
}

/** Centered cut-corner octagon path; the only legal enclosing silhouette. */
export function chamferPath(g: Graphics, width: number, height: number, cut: number): void {
  const c = Math.max(1, Math.min(cut, width / 2 - 1, height / 2 - 1));
  g.moveTo(-width / 2 + c, -height / 2);
  g.lineTo(width / 2 - c, -height / 2);
  g.lineTo(width / 2, -height / 2 + c);
  g.lineTo(width / 2, height / 2 - c);
  g.lineTo(width / 2 - c, height / 2);
  g.lineTo(-width / 2 + c, height / 2);
  g.lineTo(-width / 2, height / 2 - c);
  g.lineTo(-width / 2, -height / 2 + c);
  g.close();
}

export function fillChamfer(g: Graphics, width: number, height: number, cut: number, color: Color): void {
  g.fillColor = color;
  chamferPath(g, width, height, cut);
  g.fill();
}

export function strokeChamfer(g: Graphics, width: number, height: number, cut: number, color: Color, lineWidth: number): void {
  g.strokeColor = color;
  g.lineWidth = lineWidth;
  chamferPath(g, width, height, cut);
  g.stroke();
}

/** One straight hairline. */
export function rule(g: Graphics, x1: number, y1: number, x2: number, y2: number, color: Color, lineWidth = 1): void {
  g.strokeColor = color;
  g.lineWidth = lineWidth;
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}

function strokeLine(g: Graphics, coordinates: readonly number[]): void {
  if (coordinates.length < 4) return;
  g.moveTo(coordinates[0]!, coordinates[1]!);
  for (let i = 2; i < coordinates.length; i += 2) g.lineTo(coordinates[i]!, coordinates[i + 1]!);
  g.stroke();
}

/**
 * Baseline 赤金铁券 theme. Palette reuses the exact DARK_UI Color instances and
 * every painter delegates to the pre-theme rendering, so the default is provably
 * identical to the production sheet.
 */
export const DEFAULT_SHEET_THEME: SheetTheme = {
  id: 'chi-jin-tie-quan',
  name: '赤金铁券',
  reference: '现行版 · 修仙铁券弹窗',
  palette: {
    text: DARK_UI.bone,
    textMuted: DARK_UI.muted,
    surface: DARK_UI.panel,
    raised: DARK_UI.raised,
    quiet: DARK_UI.quiet,
    ink: DARK_UI.ink,
    edge: DARK_UI.edge,
    edgeStrong: DARK_UI.edgeLight,
    accent: DARK_UI.gold,
    accentDark: DARK_UI.goldDark,
    danger: DARK_UI.red,
    dangerDark: DARK_UI.redDark,
    positive: DARK_UI.green,
    backdrop: new Color(5, 5, 7, 172),
    severity: {
      danger: DARK_UI.red,
      warning: DARK_UI.gold,
      positive: DARK_UI.green,
      neutral: DARK_UI.bone,
    },
  },
  framePolicy: { cut: { sheet: 18, card: 8, control: 8, tile: 8, cell: 8 } },
  iconPen: { lineWidth: 4 },
  typeScale: { title: 1, section: 1, body: 1, micro: 1, value: 1 },
  thumb: { color: DARK_UI.gold, alpha: 140, width: 6, radius: 3 },

  paintFrame(g, width, height, input) {
    paintDarkFrame(g, width, height, {
      fill: input.fill,
      edge: input.edge,
      accent: input.accent,
      cut: input.cut,
      ornate: input.ornate,
    });
  },

  paintIcon(g, kind, color) {
    if (kind === 'close') {
      paintDarkIcon(g, 'close', color);
    } else if (kind === 'character' || kind === 'npc') {
      paintDarkIcon(g, 'character', color);
    } else if (kind === 'inventory') {
      paintDarkIcon(g, 'bag', color);
    } else if (kind === 'map') {
      paintDarkIcon(g, 'map', color);
    } else if (kind === 'objectives') {
      paintDarkIcon(g, 'target', color);
    } else if (kind === 'entry') {
      strokeLine(g, [-23, -26, -23, 25, 23, 25, 23, -26]);
      strokeLine(g, [-15, -26, -15, 17, 15, 17, 15, -26]);
      strokeLine(g, [-7, -3, 9, -3, 3, 4]);
    } else if (kind === 'result') {
      strokeLine(g, [-18, 21, 18, 21, 13, -2, 0, -11, -13, -2, -18, 21]);
      strokeLine(g, [0, -11, 0, -24]);
      strokeLine(g, [-15, -25, 15, -25]);
      strokeLine(g, [-18, 14, -28, 14, -25, 1, -13, -5]);
      strokeLine(g, [18, 14, 28, 14, 25, 1, 13, -5]);
    } else if (kind === 'menu') {
      paintDarkIcon(g, 'menu', color);
    } else if (kind === 'interaction') {
      paintDarkIcon(g, 'interact', color);
    } else if (kind === 'danger') {
      strokeLine(g, [0, 26, 27, -22, -27, -22, 0, 26]);
      strokeLine(g, [0, 11, 0, -4]);
      g.circle(0, -13, 2);
      g.fill();
    } else if (kind === 'hp') {
      strokeLine(g, [-25, 0, -12, 0, -5, 17, 3, -17, 11, 0, 25, 0]);
    } else {
      strokeLine(g, [-22, -25, -22, 25, 13, 25, 22, 16, 22, -25, -22, -25]);
      strokeLine(g, [13, 25, 13, 16, 22, 16]);
      strokeLine(g, [-12, 13, 12, 13]);
      strokeLine(g, [-12, 0, 12, 0]);
      strokeLine(g, [-12, -13, 6, -13]);
    }
  },

  paintDoll(parts, palette) {
    const { aura, figure } = parts;
    aura.strokeColor = new Color(palette.accent.r, palette.accent.g, palette.accent.b, 96);
    aura.lineWidth = 3;
    aura.circle(0, 0, 84);
    aura.stroke();
    aura.strokeColor = new Color(palette.accent.r, palette.accent.g, palette.accent.b, 48);
    aura.lineWidth = 2;
    aura.circle(0, 0, 66);
    aura.stroke();
    // Coat torso first, head second, keeping the silhouette readable at small sizes.
    figure.fillColor = new Color(58, 46, 32, 255);
    figure.strokeColor = palette.edgeStrong;
    figure.lineWidth = 3;
    figure.moveTo(-34, 10);
    figure.lineTo(-27, -28);
    figure.lineTo(-19, -88);
    figure.lineTo(19, -88);
    figure.lineTo(27, -28);
    figure.lineTo(34, 10);
    figure.lineTo(12, 2);
    figure.lineTo(-12, 2);
    figure.close();
    figure.fill();
    figure.stroke();
    figure.fillColor = palette.danger;
    figure.moveTo(-9, 8);
    figure.lineTo(9, 8);
    figure.lineTo(0, -10);
    figure.close();
    figure.fill();
    figure.fillColor = new Color(217, 174, 131, 255);
    figure.strokeColor = new Color(90, 70, 48, 255);
    figure.lineWidth = 3;
    figure.circle(0, 34, 21);
    figure.fill();
    figure.stroke();
  },

  paintSeal(g, palette) {
    g.fillColor = palette.accent;
    g.circle(0, 0, 7);
    g.fill();
  },
};

// --- WCAG palette contract (same math as the InfiniteFlowView module audit) ---

function linearChannel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function relativeLuminance(color: Color): number {
  return 0.2126 * linearChannel(color.r)
    + 0.7152 * linearChannel(color.g)
    + 0.0722 * linearChannel(color.b);
}

export function sheetContrastRatio(foreground: Color, background: Color): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

type ContrastPair = Readonly<{ id: string; foreground: Color; background: Color; minimum: number }>;

/** Recurring text/surface pairings the sheet actually renders. */
export function sheetPaletteContrastPairs(palette: SheetPalette): readonly ContrastPair[] {
  return [
    { id: 'text/surface', foreground: palette.text, background: palette.surface, minimum: 4.5 },
    { id: 'text/raised', foreground: palette.text, background: palette.raised, minimum: 4.5 },
    { id: 'text/quiet', foreground: palette.text, background: palette.quiet, minimum: 4.5 },
    { id: 'text/dangerDark', foreground: palette.text, background: palette.dangerDark, minimum: 4.5 },
    { id: 'muted/surface', foreground: palette.textMuted, background: palette.surface, minimum: 4.5 },
    { id: 'muted/raised', foreground: palette.textMuted, background: palette.raised, minimum: 4.5 },
    { id: 'muted/quiet', foreground: palette.textMuted, background: palette.quiet, minimum: 4.5 },
    { id: 'muted/accentDark', foreground: palette.textMuted, background: palette.accentDark, minimum: 4.5 },
    { id: 'accent/accentDark', foreground: palette.accent, background: palette.accentDark, minimum: 4.5 },
    { id: 'accent/raised', foreground: palette.accent, background: palette.raised, minimum: 4.5 },
    { id: 'accent/quiet', foreground: palette.accent, background: palette.quiet, minimum: 4.5 },
    { id: 'danger/dangerDark', foreground: palette.danger, background: palette.dangerDark, minimum: 4.5 },
    { id: 'danger/quiet', foreground: palette.danger, background: palette.quiet, minimum: 4.5 },
    { id: 'positive/quiet', foreground: palette.positive, background: palette.quiet, minimum: 4.5 },
    { id: 'boundary-accent/raised', foreground: palette.accent, background: palette.raised, minimum: 3 },
    { id: 'boundary-danger/quiet', foreground: palette.danger, background: palette.quiet, minimum: 3 },
    { id: 'boundary-edgeStrong/surface', foreground: palette.edgeStrong, background: palette.surface, minimum: 3 },
  ];
}

/** Throws on the first pairing below its WCAG minimum; headless gate for every theme. */
export function assertSheetThemeContract(theme: SheetTheme): readonly ContrastPair[] {
  const pairs = sheetPaletteContrastPairs(theme.palette);
  const failures: string[] = [];
  for (const pair of pairs) {
    const ratio = sheetContrastRatio(pair.foreground, pair.background);
    if (ratio < pair.minimum) failures.push(`${pair.id}: ${ratio.toFixed(3)} < ${pair.minimum}`);
  }
  if (failures.length > 0) {
    throw new Error(`Sheet theme "${theme.id}" palette contract failed: ${failures.join('; ')}`);
  }
  return pairs;
}
