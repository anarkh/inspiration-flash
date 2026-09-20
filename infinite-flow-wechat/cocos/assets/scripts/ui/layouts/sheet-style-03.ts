// Style 03 — 兵甲左右卷: E2 left-right split ledger. The reincarnator plate
// and KPI block hold the left scroll while seven equipment tallies and the
// remaining metrics read as a right-hand account book; the menu replaces the
// scene banner with a vector tiger-tally plaque. Palette is the 兵符虎节
// inlaid-bronze theme; no raster banners.
import { GALLERY_SHEET_THEMES } from '../sheet-styles';
import type { SheetLayoutStyle } from '../sheet-layout';
import { SPLIT_LAYOUT_MILITARY } from './sheet-engine-split';

export const SHEET_STYLE_03: SheetLayoutStyle = Object.freeze({
  id: '03',
  name: '兵甲左右卷',
  reference: '虎节错金 · 左右分卷账册',
  layout: SPLIT_LAYOUT_MILITARY,
  theme: GALLERY_SHEET_THEMES[5]!,
  imagePolicy: Object.freeze({
    portrait: true,
    equipmentIcons: true,
    itemIcons: true,
    banners: false,
  }),
});
