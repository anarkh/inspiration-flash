// Style 01 — 赤金铁券·中轴: the production baseline. It does not fork the
// production bodies; it mounts PRODUCTION_SHEET_LAYOUT under the production
// DEFAULT theme with all raster images disabled, so the headless gate can
// prove byte-identical geometry versus the unguarded production render.
import { DEFAULT_SHEET_THEME } from '../sheet-theme';
import { PRODUCTION_SHEET_LAYOUT } from '../InfiniteFlowInfoSheet';
import { NO_SHEET_IMAGES, type SheetLayoutStyle } from '../sheet-layout';

export const SHEET_STYLE_01: SheetLayoutStyle = Object.freeze({
  id: '01',
  name: '赤金铁券·中轴',
  reference: '现行版 · 中轴卷轴 · 无立绘',
  layout: PRODUCTION_SHEET_LAYOUT,
  theme: DEFAULT_SHEET_THEME,
  imagePolicy: NO_SHEET_IMAGES,
});
