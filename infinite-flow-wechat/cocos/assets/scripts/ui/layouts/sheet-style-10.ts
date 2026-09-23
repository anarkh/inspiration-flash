// Style 10 — 天章御账: E5 ledger scroll in the Han eave-tile 瓦当印绶 theme.
// A 260px hero banner with the reincarnator portrait and a 140px menu banner
// open the imperial ledgers; rows rise to 120px with alternating quiet plates.
import { GALLERY_SHEET_THEMES } from '../sheet-styles';
import type { SheetLayoutStyle } from '../sheet-layout';
import { LEDGER_LAYOUT_IMPERIAL } from './sheet-engine-ledger';

export const SHEET_STYLE_10: SheetLayoutStyle = Object.freeze({
  id: '10',
  name: '天章御账',
  reference: '瓦当印绶御账 · 卷首天章立绘交替列行',
  layout: LEDGER_LAYOUT_IMPERIAL,
  theme: GALLERY_SHEET_THEMES[6]!,
  imagePolicy: Object.freeze({
    portrait: true,
    equipmentIcons: true,
    itemIcons: true,
    banners: true,
  }),
});
