// E1 — 中轴卷轴 (central-axis scroll). Style 01 is the production layout
// itself; this module provides the 旗楼 variant used by style 02: a taller
// 416 stage with a 220×340 reincarnator portrait flanked by two flag columns
// of seven 112×104 equipment slots carrying 84² raster icons, an ornament
// flag band over the menu, and 72² item icons in the inventory rack.
import { Graphics } from 'cc';
import type { StatusMetric } from '@infinite-flow/presentation';
import type { SheetKit } from '../sheet-kit';
import {
  SHEET_GAP,
  bindItemCell,
  bindMenuDestination,
  characterKpis,
  defineSheetLayout,
  drawEquipSlot,
  drawKpiCard,
  drawMetricCard,
  drawPortrait,
  guardLoadout,
  inventoryTabs,
  itemFigure,
  itemSeal,
  loadoutItems,
  menuDestinations,
  menuTabs,
  renderFullMetricFallback,
  restCharacterMetrics,
  runActionList,
} from './sheet-engine-base';

const STAGE_HEIGHT = 416;
const KPI_HEIGHT = 104;
const FLAG_COLUMN_X = 250;
const FLAG_ROW_Y = [150, 50, -50, -150] as const;

/** Left column carries four slots (head/armor/feet/waist), right carries three. */
const FLAG_COLUMNS: Readonly<Record<string, { side: -1 | 1; row: number }>> = {
  head: { side: -1, row: 0 },
  armor: { side: -1, row: 1 },
  feet: { side: -1, row: 2 },
  waist: { side: -1, row: 3 },
  weapon: { side: 1, row: 0 },
  hands: { side: 1, row: 1 },
  charm: { side: 1, row: 2 },
};

function renderScrollCharacter(kit: SheetKit): void {
  const loadout = kit.context.model.sections[1].loadout;
  const body = kit.context.body;
  const width = kit.context.width;
  const bodyHeight = kit.context.bodyHeight;
  if (!loadout) {
    // Loadout-less phases keep the production full-height metric grid.
    renderFullMetricFallback(kit, { body, width, bodyHeight });
    return;
  }

  const stage = kit.panel(kit.context.body, 'MobileSheetDollStage', 0, bodyHeight / 2 - STAGE_HEIGHT / 2,
    width, STAGE_HEIGHT, kit.palette.quiet, kit.palette.edgeStrong);
  drawPortrait(kit, stage, 'DollPortrait', 0, 0, 220, 340);

  for (const entry of loadout.equipment) {
    const position = FLAG_COLUMNS[entry.slot];
    if (!position) continue;
    drawEquipSlot(kit, stage, entry, position.side * FLAG_COLUMN_X, FLAG_ROW_Y[position.row]!,
      112, 104, { icon: true, iconSize: 84 });
  }

  const kpiWidth = (width - SHEET_GAP * 3) / 4;
  const kpiY = bodyHeight / 2 - STAGE_HEIGHT - SHEET_GAP - KPI_HEIGHT / 2;
  characterKpis(kit).forEach((kpi, index) => {
    const x = -width / 2 + kpiWidth / 2 + index * (kpiWidth + SHEET_GAP);
    drawKpiCard(kit, kit.context.body, kpi, x, kpiY, kpiWidth, KPI_HEIGHT);
  });

  const regionTop = bodyHeight / 2 - STAGE_HEIGHT - SHEET_GAP - KPI_HEIGHT - SHEET_GAP;
  renderMetricGrid(kit, restCharacterMetrics(kit), regionTop);
}

const METRIC_CARD_HEIGHT = 172;

/** Two-column scrolling metric grid sharing the production card geometry. */
function renderMetricGrid(kit: SheetKit, metrics: readonly StatusMetric[], top?: number): void {
  if (metrics.length === 0) return;
  const target = { body: kit.context.body, width: kit.context.width, bodyHeight: kit.context.bodyHeight };
  const rows = Math.ceil(metrics.length / 2);
  const contentHeight = 8 + rows * METRIC_CARD_HEIGHT + (rows - 1) * SHEET_GAP + 8;
  // No `top`: the region fills the body (loadout-less phase); otherwise the
  // region hangs just under the KPI row exactly like production.
  const region = top === undefined
    ? kit.scrollRegion(target, contentHeight)
    : kit.scrollRegion(target, contentHeight, 0, top);
  const columnWidth = (region.width - SHEET_GAP) / 2;
  metrics.forEach((metric, index) => {
    const col = index % 2;
    const gridRow = Math.floor(index / 2);
    const cursor = 8 + gridRow * (METRIC_CARD_HEIGHT + SHEET_GAP);
    const x = -region.width / 2 + columnWidth / 2 + col * (columnWidth + SHEET_GAP);
    drawMetricCard(kit, region.content, metric, x, kit.scrollItemY(region, cursor, METRIC_CARD_HEIGHT), columnWidth, METRIC_CARD_HEIGHT);
  });
}

const FLAG_BAND_HEIGHT = 64;

function renderScrollMenu(kit: SheetKit): void {
  const tabbed = menuTabs(kit, { body: kit.context.body, width: kit.context.width, bodyHeight: kit.context.bodyHeight });
  if (tabbed.active === 'actions') {
    runActionList(kit, tabbed.surface, 'menu');
    return;
  }
  const body = tabbed.surface.body;
  const width = tabbed.surface.width;
  const bodyHeight = tabbed.surface.bodyHeight;

  const band = kit.panel(body, 'SheetFlagBand', 0, bodyHeight / 2 - FLAG_BAND_HEIGHT / 2,
    width, FLAG_BAND_HEIGHT, kit.palette.quiet, kit.palette.accent, true);
  const bg = band.addComponent(Graphics);
  bg.strokeColor = kit.palette.accent;
  bg.lineWidth = 2;
  for (let i = 0; i < 4; i += 1) {
    const x = -width / 2 + 40 + i * ((width - 80) / 3);
    bg.moveTo(x, -16); bg.lineTo(x + 18, 0); bg.lineTo(x, 16); bg.stroke();
  }
  kit.text(band, 'FlagBandTitle', '随身印绶', 0, 0, width - 120, 40, 26, kit.palette.accent, true);

  const tileArea = bodyHeight - FLAG_BAND_HEIGHT - SHEET_GAP;
  const tileHeight = Math.min(210, (tileArea - SHEET_GAP * 2) / 3);
  const tileWidth = (width - SHEET_GAP * 2) / 3;
  menuDestinations(kit).forEach((destination, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = -width / 2 + tileWidth / 2 + col * (tileWidth + SHEET_GAP);
    const y = bodyHeight / 2 - FLAG_BAND_HEIGHT - SHEET_GAP - tileHeight / 2 - row * (tileHeight + SHEET_GAP);
    const cell = kit.panel(body, `MobileSheetShortcut:${destination.kind}`, x, y, tileWidth, tileHeight,
      kit.palette.quiet, destination.danger ? kit.palette.danger : kit.palette.edgeStrong, false, 'tile');
    kit.icon(cell, 'ShortcutIcon', destination.iconKind, 0, tileHeight / 2 - 58,
      destination.danger ? kit.palette.danger : kit.palette.accent);
    kit.text(cell, 'ShortcutTitle', destination.label, 0, -tileHeight / 2 + 40, tileWidth - 20, 50, 27, kit.palette.text, true);
    bindMenuDestination(kit, cell, destination);
  });
}

const RACK_COLUMNS = 5;
const RACK_CELL_HEIGHT = 104;

function renderScrollInventory(kit: SheetKit): void {
  const tabTarget = { body: kit.context.body, width: kit.context.width, bodyHeight: kit.context.bodyHeight };
  const tabbed = inventoryTabs(kit, tabTarget);
  if (tabbed.active === 'actions') {
    runActionList(kit, tabbed.surface, 'inventory');
    return;
  }
  const ctx = tabbed.surface;
  const loadout = guardLoadout(kit, ctx);
  if (!loadout) return;

  const regionHeight = 40 + RACK_CELL_HEIGHT * 2 + SHEET_GAP;
  const backing = kit.panel(ctx.body, 'MobileSheetInventoryRack', 0, ctx.bodyHeight / 2 - regionHeight / 2,
    ctx.width, regionHeight, kit.palette.quiet, kit.palette.edge, false, 'rack');
  kit.text(backing, 'RackCaption', `战术携行 ${loadout.carriedCount} 类 · 点击格子查看可用行动`,
    18, regionHeight / 2 - 24, ctx.width - 60, 30, 22, kit.palette.textMuted);
  const cellWidth = (ctx.width - 36 - SHEET_GAP * (RACK_COLUMNS - 1)) / RACK_COLUMNS;
  loadoutItems(kit).slice(0, RACK_COLUMNS * 2).forEach((item, index) => {
    const col = index % RACK_COLUMNS;
    const row = Math.floor(index / RACK_COLUMNS);
    const x = -ctx.width / 2 + 18 + cellWidth / 2 + col * (cellWidth + SHEET_GAP);
    const y = regionHeight / 2 - 40 - RACK_CELL_HEIGHT / 2 - row * (RACK_CELL_HEIGHT + SHEET_GAP);
    const cell = kit.panel(backing, `MobileSheetItem:${item.itemId}`, x, y, cellWidth, RACK_CELL_HEIGHT,
      kit.palette.raised, item.carried ? kit.palette.accent : kit.palette.edge, false, 'cell');
    itemFigure(kit, cell, item, 0, 16, 72, 72);
    kit.text(cell, 'ItemCount', `×${item.count}`, 0, -34, cellWidth - 14, 24, 18,
      item.count > 0 ? kit.palette.accent : kit.palette.textMuted, true);
    if (item.carried) itemSeal(kit, cell, cellWidth, RACK_CELL_HEIGHT);
    bindItemCell(kit, cell);
  });

  const gridHeight = regionHeight + SHEET_GAP;
  const readoutBody = kit.node(ctx.body, 'MobileSheetInventoryReadout', 0, -gridHeight / 2,
    ctx.width, ctx.bodyHeight - gridHeight);
  kit.renderTextPages({ body: readoutBody, width: ctx.width, bodyHeight: ctx.bodyHeight - gridHeight },
    kit.inventoryPages());
}

export const SCROLL_FLAG_LAYOUT = defineSheetLayout('scroll-flag-tower', {
  renderCharacter: renderScrollCharacter,
  renderMenu: renderScrollMenu,
  renderInventory: renderScrollInventory,
});
