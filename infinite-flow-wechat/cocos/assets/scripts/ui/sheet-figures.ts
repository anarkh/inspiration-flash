// Production raster-figure registry for the mobile sheet.
//
// This module holds no loading code and no platform awareness: the app prime
// step (InfiniteFlowApp) leases ImageAssets through the pinned manifest
// pipeline, builds SpriteFrames and registers them here. The sheet renderer
// reads the registry synchronously; missing keys fall back to glyph/vector
// drawing, so renders stay identical in shape whether art is present.
import { EMPTY_SHEET_IMAGE_LIBRARY, type SheetImageLibrary } from './sheet-kit';

let registry: SheetImageLibrary = EMPTY_SHEET_IMAGE_LIBRARY;

/** The currently registered sheet figures (empty library before the app prime settles). */
export function getSheetFigures(): SheetImageLibrary {
  return registry;
}

/** Replace the active library (e.g. once the best-effort sheet preload settles). */
export function registerSheetFigures(library: SheetImageLibrary): void {
  registry = library;
}

/** Drop back to the empty library; the caller owns the SpriteFrame/ImageAsset leases. */
export function releaseSheetFigures(): void {
  registry = EMPTY_SHEET_IMAGE_LIBRARY;
}
