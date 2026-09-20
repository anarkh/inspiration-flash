// The ten layout gallery styles in gallery order. Trunk-owned registry: the
// five engine/style modules never register themselves.
import type { SheetLayoutStyle } from './sheet-layout';
import { SHEET_STYLE_01 } from './layouts/sheet-style-01';
import { SHEET_STYLE_02 } from './layouts/sheet-style-02';
import { SHEET_STYLE_03 } from './layouts/sheet-style-03';
import { SHEET_STYLE_04 } from './layouts/sheet-style-04';
import { SHEET_STYLE_05 } from './layouts/sheet-style-05';
import { SHEET_STYLE_06 } from './layouts/sheet-style-06';
import { SHEET_STYLE_07 } from './layouts/sheet-style-07';
import { SHEET_STYLE_08 } from './layouts/sheet-style-08';
import { SHEET_STYLE_09 } from './layouts/sheet-style-09';
import { SHEET_STYLE_10 } from './layouts/sheet-style-10';

export const SHEET_LAYOUT_STYLES: readonly SheetLayoutStyle[] = Object.freeze([
  SHEET_STYLE_01,
  SHEET_STYLE_02,
  SHEET_STYLE_03,
  SHEET_STYLE_04,
  SHEET_STYLE_05,
  SHEET_STYLE_06,
  SHEET_STYLE_07,
  SHEET_STYLE_08,
  SHEET_STYLE_09,
  SHEET_STYLE_10,
]);
