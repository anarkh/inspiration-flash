// Style 02 — 玄戎旗楼: E1 central-axis variant. The stage rises to 416 with
// a 220×340 reincarnator portrait and two flag columns of icon-bearing
// equipment slots; item cells gain 72² icons. Palette is the 云雷彝器
// bronze-vessel theme; no banners.
import { GALLERY_SHEET_THEMES } from '../sheet-styles';
import type { SheetLayoutStyle } from '../sheet-layout';
import { SCROLL_FLAG_LAYOUT } from './sheet-engine-scroll';

export const SHEET_STYLE_02: SheetLayoutStyle = Object.freeze({
  id: '02',
  name: '玄戎旗楼',
  reference: '中轴旗楼 · 立绘与武具列阵',
  layout: SCROLL_FLAG_LAYOUT,
  theme: GALLERY_SHEET_THEMES[2]!,
  imagePolicy: Object.freeze({
    portrait: true,
    equipmentIcons: true,
    itemIcons: true,
    banners: false,
  }),
});
