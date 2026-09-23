// Style 08 — 走马灯匣 (revolving lantern casket): the E4 hero carousel. One
// 620×560 showcase card per page with a decorative cut-diamond index rail
// flanking the character cover (360² portrait over four KPI cards). Palette
// is the 朱砂符箓 cinnabar talisman theme; every raster class is enabled.
import { GALLERY_SHEET_THEMES } from '../sheet-styles';
import type { SheetLayoutStyle } from '../sheet-layout';
import { CAROUSEL_LAYOUT_HERO } from './sheet-engine-carousel';

export const SHEET_STYLE_08: SheetLayoutStyle = Object.freeze({
  id: '08',
  name: '走马灯匣',
  reference: '朱砂符箓 · 一卡一转的走马灯',
  layout: CAROUSEL_LAYOUT_HERO,
  theme: GALLERY_SHEET_THEMES[3]!,
  imagePolicy: Object.freeze({
    portrait: true,
    equipmentIcons: true,
    itemIcons: true,
    banners: true,
  }),
});
