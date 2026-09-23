// Style 04 — 玉简对册: E2 left-right split ledger with the 玄墨玉简 bamboo
// theme. The left scroll carries portrait/KPIs (or the 176px menu seal rail,
// or the 2×5 item rack) while the right column opens with the scene banner
// over a scrim title and reads as paired bamboo-slip pages; every raster
// image class is enabled.
import { GALLERY_SHEET_THEMES } from '../sheet-styles';
import type { SheetLayoutStyle } from '../sheet-layout';
import { SPLIT_LAYOUT_BAMBOO } from './sheet-engine-split';

export const SHEET_STYLE_04: SheetLayoutStyle = Object.freeze({
  id: '04',
  name: '玉简对册',
  reference: '玄墨排简 · 左右对册共读',
  layout: SPLIT_LAYOUT_BAMBOO,
  theme: GALLERY_SHEET_THEMES[1]!,
  imagePolicy: Object.freeze({
    portrait: true,
    equipmentIcons: true,
    itemIcons: true,
    banners: true,
  }),
});
