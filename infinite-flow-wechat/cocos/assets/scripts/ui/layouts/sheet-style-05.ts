// Style 05 — 镇屉抽屉: E3 bottom drawer in the 乌皮铠甲 black lamellar
// theme. Equipment and tactical items ride horizontal carry strips; the menu
// hangs a dungeon raster banner over the nine tiles. Every raster class is
// enabled (portrait, equipment icons, item icons, banners).
import { GALLERY_SHEET_THEMES } from '../sheet-styles';
import type { SheetLayoutStyle } from '../sheet-layout';
import { DRAWER_LAYOUT_ARMOR } from './sheet-engine-drawer';

export const SHEET_STYLE_05: SheetLayoutStyle = Object.freeze({
  id: '05',
  name: '镇屉抽屉',
  reference: '黑甲札页成屉 · 横带携行自下而展',
  layout: DRAWER_LAYOUT_ARMOR,
  theme: GALLERY_SHEET_THEMES[7]!,
  imagePolicy: Object.freeze({
    portrait: true,
    equipmentIcons: true,
    itemIcons: true,
    banners: true,
  }),
});
