// Shared, environment-agnostic contract for the pluggable sheet layout seam.
//
// This module must stay free of any preview-mode awareness: no URL access,
// platform-runtime checks, style/engine imports, theme mutation, or Cocos
// drawing. The production sheet renderer builds a SheetKit synchronously per
// render and the pluggable layout engines consume only that bound surface. The
// seam is optional end-to-end: production call sites never construct a layout.
import type { Color, Node, ScrollView } from 'cc';
import type { GameViewModel, StatusMetric, ViewActionModel } from '@infinite-flow/presentation';
import type { InfiniteFlowInfoSheetOptions, MobileSheetState, MobilePanelKind } from './InfiniteFlowInfoSheet';
import type { SheetFrameRole, SheetPalette, SheetTheme } from './sheet-theme';

// The existing 750px design space uses 104px controls to retain a 44px target
// at 320px viewport width. Engines inherit the same minimum touch geometry.
export const SHEET_TOUCH = 104;
export const SHEET_GAP = 16;

// Manifest asset keys (see cocos/assets/config/asset-manifest.json). VM ids
// are the manifest entity ids verbatim, so these are identity helpers, not a
// mapping table.
export const SHEET_PORTRAIT_KEY = 'character:reincarnator';
export const SHEET_SCENE_BANNER_KEY = 'scene:main_god_space';
export const SHEET_DUNGEON_BANNER_KEY = 'dungeon:demon_tower_1';
export const sheetEquipmentKey = (equipmentId: string): string => `equipment:${equipmentId}`;
export const sheetItemKey = (itemId: string): string => `item:${itemId}`;

/** A loaded raster figure (Cocos SpriteFrame kept opaque to stay engine-free). */
export interface SheetImage {
  readonly frame: unknown;
  readonly width: number;
  readonly height: number;
}

/** Best-effort image library; absent keys fall back to glyph/vector drawing. */
export interface SheetImageLibrary {
  get(key: string): SheetImage | undefined;
}

export const EMPTY_SHEET_IMAGE_LIBRARY: SheetImageLibrary = Object.freeze({
  get(): SheetImage | undefined { return undefined; },
});

/** A node surface the bound primitives render into. */
export interface SheetTarget {
  readonly body: Node;
  readonly width: number;
  readonly bodyHeight: number;
}

/** Geometry + channels every engine body is rendered against. */
export interface SheetEngineContext {
  readonly model: GameViewModel;
  readonly state: MobileSheetState;
  readonly options: InfiniteFlowInfoSheetOptions;
  /** Outer sheet frame node. */
  readonly frame: Node;
  readonly body: Node;
  readonly width: number;
  readonly height: number;
  readonly bodyHeight: number;
}

export interface MobileSheetPage {
  readonly title: string;
  readonly lines: readonly string[];
  readonly helpId?: string;
}

export interface SheetScrollRegion {
  readonly holder: Node;
  readonly content: Node;
  readonly width: number;
  readonly height: number;
  readonly contentHeight: number;
  readonly scrollView: ScrollView;
}

export interface SheetPagerRegion {
  readonly holder: Node;
  readonly content: Node;
  readonly dots: Node;
  readonly width: number;
  readonly height: number;
}

export interface SheetStripRegion {
  readonly holder: Node;
  readonly content: Node;
  readonly width: number;
  readonly height: number;
  readonly contentWidth: number;
}

export interface SheetTabSurface extends SheetTarget {
  readonly active: string;
}

export interface SheetFigureFallback {
  /** Last-character style Chinese glyph drawn under the sprite. */
  readonly glyph?: string;
  /** Named vector icon kind (paintIcon) drawn under the sprite. */
  readonly iconKind?: string;
  readonly glyphSize?: number;
  readonly glyphColor?: Color;
}

/**
 * Bound rendering surface for layout engines. Every member closes over the
 * production render's active theme/options, so engines never import the
 * production module or touch module-level state themselves.
 */
export interface SheetKit {
  readonly context: SheetEngineContext;
  readonly theme: SheetTheme;
  readonly palette: SheetPalette;
  readonly images: SheetImageLibrary;

  // Base primitives (same calls production uses).
  node(parent: Node, name: string, x: number, y: number, width: number, height: number): Node;
  panel(parent: Node, name: string, x: number, y: number, width: number, height: number, fill?: Color, stroke?: Color, ornate?: boolean, role?: SheetFrameRole): Node;
  text(parent: Node, name: string, value: string, x: number, y: number, width: number, height: number, size?: number, color?: Color, centered?: boolean): void;
  icon(parent: Node, name: string, kind: string, x: number, y: number, color?: Color): Node;
  button(parent: Node, name: string, label: string, x: number, y: number, width: number, enabled: boolean, activate: (() => void) | undefined, color?: Color): Node;

  // Composite layout primitives.
  tabs(target: SheetTarget, choices: readonly Readonly<{ id: string; title: string }>[], fallback: string): SheetTabSurface;
  scrollRegion(target: SheetTarget, contentHeight: number, reserve?: number, top?: number): SheetScrollRegion;
  /** Horizontal paging ScrollView; all cards live in one content node. */
  pagerRegion(target: SheetTarget, regionHeight: number, contentWidth: number, pageCount: number): SheetPagerRegion;
  /** Horizontal free-scrolling strip (no dots); all items live in one content node. */
  hScrollRegion(target: SheetTarget, regionHeight: number, contentWidth: number): SheetStripRegion;
  scrollItemY(region: SheetScrollRegion, cursor: number, itemHeight: number): number;

  /**
   * Figure slot: always creates `<name>:Glyph` (fallback) and `<name>:Sprite`
   * (empty Sprite node when the image is absent), so node names/counts are
   * identical whether or not the image library contains the key.
   */
  figure(parent: Node, name: string, imageKey: string, x: number, y: number, width: number, height: number, fallback?: SheetFigureFallback): Node;
  /** Full-size cut-corner ink plate (alpha ~224) backing text over art. */
  scrimCard(parent: Node, name: string, x: number, y: number, width: number, height: number): Node;
  /** Carried seal node (default 18×18) painted by the active theme. */
  seal(parent: Node, name: string, x: number, y: number, size?: number): Node;
  /** Standard DollAura(180²) + DollFigure(150×180) vector doll, painted by the theme. */
  doll(parent: Node, x?: number, y?: number): { aura: Node; figure: Node };

  // Shared composites (identical behavior across all five engines).
  panelActions(kind: MobilePanelKind): readonly ViewActionModel[];
  renderActions(target: SheetTarget, actions: readonly ViewActionModel[], empty?: string): void;
  renderTextPages(target: SheetTarget, pages: readonly MobileSheetPage[]): void;
  drawScrollDoc(target: SheetTarget, pages: readonly MobileSheetPage[], reserve?: number): void;
  inventoryPages(): readonly MobileSheetPage[];

  // Data helpers.
  metricColor(metric: StatusMetric | undefined): Color;
  readable(value: string | undefined, fallback?: string): string;
  wrapLine(value: string, maxUnits: number): readonly string[];
}
