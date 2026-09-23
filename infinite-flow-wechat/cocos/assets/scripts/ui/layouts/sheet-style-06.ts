// Style 06 — 宝匣出函: E3 bottom drawer in the 鎏金宝匣 gilt casket theme.
// Equipment rests in a static 4+3 grid and tactical items in a 5×2 rack; the
// menu is headed by the god-space scene banner. Every raster class is enabled
// (portrait, equipment icons, item icons, banners).
import { GALLERY_SHEET_THEMES } from '../sheet-styles';
import type { SheetLayoutStyle } from '../sheet-layout';
import { DRAWER_LAYOUT_CASKET } from './sheet-engine-drawer';

export const SHEET_STYLE_06: SheetLayoutStyle = Object.freeze({
  id: '06',
  name: '宝匣出函',
  reference: '鎏金贡匣启函 · 静格列阵画卷当头',
  layout: DRAWER_LAYOUT_CASKET,
  theme: GALLERY_SHEET_THEMES[4]!,
  imagePolicy: Object.freeze({
    portrait: true,
    equipmentIcons: true,
    itemIcons: true,
    banners: true,
  }),
});
