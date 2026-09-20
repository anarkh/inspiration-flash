// Style 09 — 点将长账: E5 ledger scroll in the plain-iron 玄铁素章 theme.
// No banner or portrait; equipment and item figures stay on. Every section is
// one full-length vertical ledger of flush 104px cut-corner rows.
import { GALLERY_SHEET_THEMES } from '../sheet-styles';
import type { SheetLayoutStyle } from '../sheet-layout';
import { LEDGER_LAYOUT_SECRET } from './sheet-engine-ledger';

export const SHEET_STYLE_09: SheetLayoutStyle = Object.freeze({
  id: '09',
  name: '点将长账',
  reference: '玄铁军务长账 · 无饰素面逐行点验',
  layout: LEDGER_LAYOUT_SECRET,
  theme: GALLERY_SHEET_THEMES[9]!,
  imagePolicy: Object.freeze({
    portrait: false,
    equipmentIcons: true,
    itemIcons: true,
    banners: false,
  }),
});
