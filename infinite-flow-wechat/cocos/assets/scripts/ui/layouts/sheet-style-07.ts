// Style 07 — 翻页卡匣 (gilded leaf casket): the E4 triple-card carousel.
// Three tall 206×560 cards peek through each page with 12px gutters; the
// character cover keeps a 420² portrait above four KPI cards, equipment and
// run metrics paginate behind it. Palette is the 金箓天书 gilded celestial
// writ theme; every raster class is enabled.
import { GALLERY_SHEET_THEMES } from '../sheet-styles';
import type { SheetLayoutStyle } from '../sheet-layout';
import { CAROUSEL_LAYOUT_TRIPLE } from './sheet-engine-carousel';

export const SHEET_STYLE_07: SheetLayoutStyle = Object.freeze({
  id: '07',
  name: '翻页卡匣',
  reference: '金箓法箓 · 三卡一翻的页匣',
  layout: CAROUSEL_LAYOUT_TRIPLE,
  theme: GALLERY_SHEET_THEMES[8]!,
  imagePolicy: Object.freeze({
    portrait: true,
    equipmentIcons: true,
    itemIcons: true,
    banners: true,
  }),
});
