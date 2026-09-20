// Optional, gallery-only layout seam for the mobile sheet.
//
// A SheetLayout owns frame geometry, the outer chrome (frame/header/body) and
// the bodies of exactly the three gallery kinds (character/menu/inventory).
// Production never supplies a layout: the renderer then uses its own inline
// geometry/chrome/bodies. PRODUCTION_SHEET_LAYOUT (defined in the sheet
// module) wraps those exact same production functions, so the gallery's
// baseline style renders the production path itself rather than a copy.
//
// This module holds only types/sentinels and must never import engine/style
// implementations, so none of the gallery code enters production bundles.
import type { Node } from 'cc';
import type { GameViewModel } from '@infinite-flow/presentation';
import type { InfiniteFlowInfoSheetOptions, MobilePanelKind, MobileSheetState } from './InfiniteFlowInfoSheet';
import type { SheetKit } from './sheet-kit';
import type { SheetTheme } from './sheet-theme';

export const BASELINE_LAYOUT_ID = 'production-default' as const;

export interface SheetFrameGeometry {
  readonly centerX: number;
  readonly centerY: number;
  readonly width: number;
  readonly height: number;
  readonly bodyWidth: number;
  readonly bodyHeight: number;
}

export interface SheetLayoutFrameInput {
  readonly safeInsets: InfiniteFlowInfoSheetOptions['safeInsets'];
  readonly surfaceHeight: number;
  /** Panel kind; gallery engines ignore it, the production baseline sizes per kind. */
  readonly kind: MobilePanelKind;
}

export interface SheetLayoutChrome {
  readonly frame: Node;
  readonly body: Node;
  /** Usable content width inside the frame. */
  readonly width: number;
  readonly bodyHeight: number;
}

export interface SheetChromeInput {
  /** Backdrop node the frame is mounted into. */
  readonly root: Node;
  readonly model: GameViewModel;
  readonly state: MobileSheetState;
  readonly options: InfiniteFlowInfoSheetOptions;
  readonly surfaceHeight: number;
  readonly geometry: SheetFrameGeometry;
}

export interface SheetLayout {
  readonly id: string;
  frameGeometry(input: SheetLayoutFrameInput): SheetFrameGeometry;
  renderChrome(input: SheetChromeInput): SheetLayoutChrome;
  renderCharacter(kit: SheetKit): void;
  renderMenu(kit: SheetKit): void;
  renderInventory(kit: SheetKit): void;
}

/**
 * Which registered image classes a style consumes. Engines must read only
 * through this policy so a style never references a key set it has disabled
 * (the baseline policy keeps every figure structurally present but empty).
 */
export interface SheetImagePolicy {
  /** The reincarnator 768² portrait. */
  readonly portrait: boolean;
  /** The seven starting equipment icons (160×200). */
  readonly equipmentIcons: boolean;
  /** The nine tactical item icons (160×200). */
  readonly itemIcons: boolean;
  /** Wide banners (`scene:main_god_space`, `dungeon:demon_tower_1`). */
  readonly banners: boolean;
}

export const NO_SHEET_IMAGES: SheetImagePolicy = Object.freeze({
  portrait: false,
  equipmentIcons: false,
  itemIcons: false,
  banners: false,
});

export interface SheetLayoutStyle {
  /** Two-digit gallery key, e.g. '01'. */
  readonly id: string;
  readonly name: string;
  readonly reference: string;
  readonly layout: SheetLayout;
  readonly theme: SheetTheme;
  readonly imagePolicy: SheetImagePolicy;
}
