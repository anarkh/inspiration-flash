// E3 — 底部抽屉引擎 (bottom-anchored drawer). The 720×929 frame, grip,
// title row and close button come from the shared drawer chrome; this engine
// owns only the 676×753 body:
//   character — a solid 676×150 band (150² portrait + four KPI cards), a
//     seven-slot equipment carry (1×7 horizontal strip or a static 4+3 grid),
//     and a two-column scrolling metric region beneath;
//   menu      — a 676×150 raster banner with captions on a cut-corner scrim,
//     then the 3×3 production shortcut tiles;
//   inventory — a nine-cell carry rack (1×9 horizontal strip or a static 5×2
//     grid) over the scrolling inventory readout.
import type { SheetKit } from '../sheet-kit';
import type { SheetLayout } from '../sheet-layout';
import {
  SHEET_DUNGEON_BANNER_KEY,
  SHEET_GAP,
  SHEET_SCENE_BANNER_KEY,
  bindItemCell,
  bindMenuDestination,
  characterKpis,
  characterLoadout,
  defineSheetLayout,
  drawBanner,
  drawCategoryTag,
  drawEquipSlot,
  drawKpiCard,
  drawMetricCard,
  drawPortrait,
  drawerChrome,
  drawerFrameGeometry,
  guardLoadout,
  itemFigure,
  itemSeal,
  loadoutItems,
  menuDestinations,
  renderActionsWithReturn,
  renderFullMetricFallback,
  restCharacterMetrics,
  stripItemX,
} from './sheet-engine-base';

const BODY_WIDTH = 676;
const BODY_HEIGHT = 753;

const BAND_HEIGHT = 150;
const PORTRAIT_SIZE = 150;
const KPI_HEIGHT = 104;
const KPI_GAP = 12;

const EQUIP_HEIGHT = 104;
const EQUIP_CHIP_WIDTH = 120;
const EQUIP_STRIP_GAP = 16;
const EQUIP_ICON_SIZE = 84;
const GRID_CELL_WIDTH = 160;
const GRID_GAP = 12;

const MENU_BANNER_HEIGHT = 150;
const MENU_SCRIM_HEIGHT = 72;
const TILE_WIDTH = 214;
const TILE_HEIGHT = 185;
const TILE_GAP_X = 17;
const TILE_GAP_Y = 16;

const RACK_STRIP_HEIGHT = 150;
const RACK_GRID_HEIGHT = 264;
const ITEM_CELL_HEIGHT = 104;
const ITEM_CHIP_WIDTH = 120;
const ITEM_FIGURE_SIZE = 84;
const ITEM_GRID_COLUMNS = 5;
const ITEM_GRID_GAP = 12;

const METRIC_CARD_HEIGHT = 172;

// --- character -------------------------------------------------------------

function renderDrawerMetrics(kit: SheetKit, top: number): void {
  const metrics = restCharacterMetrics(kit);
  if (metrics.length === 0) return;
  const target = { body: kit.context.body, width: BODY_WIDTH, bodyHeight: BODY_HEIGHT };
  const rows = Math.ceil(metrics.length / 2);
  const contentHeight = 8 + rows * METRIC_CARD_HEIGHT + (rows - 1) * SHEET_GAP + 8;
  const region = kit.scrollRegion(target, contentHeight, 0, top);
  const columnWidth = (region.width - SHEET_GAP) / 2;
  metrics.forEach((metric, index) => {
    const col = index % 2;
    const gridRow = Math.floor(index / 2);
    const cursor = 8 + gridRow * (METRIC_CARD_HEIGHT + SHEET_GAP);
    const x = -region.width / 2 + columnWidth / 2 + col * (columnWidth + SHEET_GAP);
    drawMetricCard(kit, region.content, metric, x,
      kit.scrollItemY(region, cursor, METRIC_CARD_HEIGHT), columnWidth, METRIC_CARD_HEIGHT);
  });
}

function renderDrawerCharacter(kit: SheetKit, equipmentMode: 'strip' | 'grid'): void {
  const body = kit.context.body;
  const target = { body, width: BODY_WIDTH, bodyHeight: BODY_HEIGHT };
  const loadout = characterLoadout(kit);
  if (!loadout) {
    renderFullMetricFallback(kit, target);
    return;
  }

  // Solid (never raster) head band: portrait left, four KPI cards right.
  const band = kit.panel(body, 'MobileSheetDollStage', 0, BODY_HEIGHT / 2 - BAND_HEIGHT / 2,
    BODY_WIDTH, BAND_HEIGHT, kit.palette.quiet, kit.palette.edgeStrong);
  drawPortrait(kit, band, 'DollPortrait', -BODY_WIDTH / 2 + PORTRAIT_SIZE / 2, 0,
    PORTRAIT_SIZE, BAND_HEIGHT);
  const kpiWidth = (BODY_WIDTH - PORTRAIT_SIZE - 16 - 3 * KPI_GAP) / 4;
  const kpiLeft = -BODY_WIDTH / 2 + PORTRAIT_SIZE + 16;
  characterKpis(kit).forEach((kpi, index) => {
    drawKpiCard(kit, band, kpi, kpiLeft + kpiWidth / 2 + index * (kpiWidth + KPI_GAP),
      0, kpiWidth, KPI_HEIGHT);
  });

  let metricTop: number;
  if (equipmentMode === 'strip') {
    // 1×7 horizontal carry band; every slot stays mounted inside one content.
    const contentWidth = 8 + 7 * EQUIP_CHIP_WIDTH + 6 * EQUIP_STRIP_GAP + 8;
    const stripTop = BODY_HEIGHT / 2 - BAND_HEIGHT - SHEET_GAP;
    const surface = kit.node(body, 'MobileSheetEquipStrip', 0, stripTop - EQUIP_HEIGHT / 2,
      BODY_WIDTH, EQUIP_HEIGHT);
    const region = kit.hScrollRegion(
      { body: surface, width: BODY_WIDTH, bodyHeight: EQUIP_HEIGHT },
      EQUIP_HEIGHT, contentWidth,
    );
    loadout.equipment.forEach((entry, index) => {
      const cursor = 8 + index * (EQUIP_CHIP_WIDTH + EQUIP_STRIP_GAP);
      drawEquipSlot(kit, region.content, entry,
        stripItemX(region.contentWidth, cursor, EQUIP_CHIP_WIDTH), 0,
        EQUIP_CHIP_WIDTH, EQUIP_HEIGHT, { icon: true, iconSize: EQUIP_ICON_SIZE });
    });
    metricTop = stripTop - EQUIP_HEIGHT - SHEET_GAP;
  } else {
    // Static 4+3 grid; the three-slot second row sits centred.
    const rowZeroY = BODY_HEIGHT / 2 - BAND_HEIGHT - SHEET_GAP - EQUIP_HEIGHT / 2;
    loadout.equipment.forEach((entry, index) => {
      const row = index < 4 ? 0 : 1;
      const col = index < 4 ? index : index - 4;
      const columns = row === 0 ? 4 : 3;
      const rowWidth = columns * GRID_CELL_WIDTH + (columns - 1) * GRID_GAP;
      const x = -rowWidth / 2 + GRID_CELL_WIDTH / 2 + col * (GRID_CELL_WIDTH + GRID_GAP);
      const y = rowZeroY - row * (EQUIP_HEIGHT + GRID_GAP);
      drawEquipSlot(kit, body, entry, x, y, GRID_CELL_WIDTH, EQUIP_HEIGHT,
        { icon: true, iconSize: EQUIP_ICON_SIZE });
    });
    metricTop = rowZeroY - (EQUIP_HEIGHT + GRID_GAP) - EQUIP_HEIGHT / 2 - SHEET_GAP;
  }

  renderDrawerMetrics(kit, metricTop);
}

// --- menu ------------------------------------------------------------------

function renderDrawerMenu(kit: SheetKit, bannerKey: string): void {
  const body = kit.context.body;
  const target = { body, width: BODY_WIDTH, bodyHeight: BODY_HEIGHT };
  if (renderActionsWithReturn(kit, target, 'menu', 'shortcuts', '返回随身功能')) return;

  const bannerY = BODY_HEIGHT / 2 - MENU_BANNER_HEIGHT / 2;
  drawBanner(kit, body, 'MenuBanner', bannerKey, 0, bannerY, BODY_WIDTH, MENU_BANNER_HEIGHT);
  // Banner copy always rides a solid cut-corner ink scrim, never raw raster.
  const bannerBottom = bannerY - MENU_BANNER_HEIGHT / 2;
  const scrim = kit.scrimCard(body, 'MenuBannerScrim', 0,
    bannerBottom + 12 + MENU_SCRIM_HEIGHT / 2, BODY_WIDTH - 32, MENU_SCRIM_HEIGHT);
  kit.text(scrim, 'MenuBannerTitle', '随身功能', 0, 16, BODY_WIDTH - 64, 30,
    22, kit.palette.text, true);
  kit.text(scrim, 'MenuBannerSubtitle', '九格直达角色、行囊、地图、簿录与轮回之门',
    0, -16, BODY_WIDTH - 64, 26, 18, kit.palette.textMuted, true);

  const tilesTop = BODY_HEIGHT / 2 - MENU_BANNER_HEIGHT - SHEET_GAP;
  menuDestinations(kit).forEach((destination, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = -BODY_WIDTH / 2 + TILE_WIDTH / 2 + col * (TILE_WIDTH + TILE_GAP_X);
    const y = tilesTop - TILE_HEIGHT / 2 - row * (TILE_HEIGHT + TILE_GAP_Y);
    const cell = kit.panel(body, `MobileSheetShortcut:${destination.kind}`, x, y,
      TILE_WIDTH, TILE_HEIGHT, kit.palette.quiet,
      destination.danger ? kit.palette.danger : kit.palette.edgeStrong, false, 'tile');
    kit.icon(cell, 'ShortcutIcon', destination.iconKind, 0, TILE_HEIGHT / 2 - 58,
      destination.danger ? kit.palette.danger : kit.palette.accent);
    kit.text(cell, 'ShortcutTitle', destination.label, 0, -TILE_HEIGHT / 2 + 40,
      TILE_WIDTH - 20, 50, 27, kit.palette.text, true);
    bindMenuDestination(kit, cell, destination);
  });
}

// --- inventory -------------------------------------------------------------

/** Shared item chip: 84² figure, stock badge, category plate, carried seal. */
function drawItemChip(
  kit: SheetKit,
  parent: ReturnType<SheetKit['node']>,
  item: ReturnType<typeof loadoutItems>[number],
  x: number,
  y: number,
  width: number,
): void {
  const cell = kit.panel(parent, `MobileSheetItem:${item.itemId}`, x, y, width, ITEM_CELL_HEIGHT,
    kit.palette.raised, item.carried ? kit.palette.accent : kit.palette.edge, false, 'cell');
  itemFigure(kit, cell, item, 0, 6, ITEM_FIGURE_SIZE, ITEM_FIGURE_SIZE);
  drawCategoryTag(kit, cell, item, 0, -32);
  if (item.carried) itemSeal(kit, cell, width, ITEM_CELL_HEIGHT);
  // Stock reads as the upper-left badge; the carried seal owns the upper-right.
  kit.text(cell, 'ItemCount', `×${item.count}`, -(width / 2 - 30), 38, 52, 24, 18,
    item.count > 0 ? kit.palette.accent : kit.palette.textMuted, true);
  bindItemCell(kit, cell);
}

function renderDrawerInventory(kit: SheetKit, equipmentMode: 'strip' | 'grid'): void {
  const body = kit.context.body;
  const target = { body, width: BODY_WIDTH, bodyHeight: BODY_HEIGHT };
  if (renderActionsWithReturn(kit, target, 'inventory', 'overview', '返回持有与效果')) return;
  const loadout = guardLoadout(kit, target);
  if (!loadout) return;

  let rackHeight: number;
  if (equipmentMode === 'strip') {
    rackHeight = RACK_STRIP_HEIGHT;
    const rack = kit.panel(body, 'MobileSheetInventoryRack', 0, BODY_HEIGHT / 2 - rackHeight / 2,
      BODY_WIDTH, rackHeight, kit.palette.quiet, kit.palette.edge, false, 'rack');
    kit.text(rack, 'RackCaption',
      `战术携行 ${loadout.carriedCount} 类 · 点击格子查看可用行动`,
      18, rackHeight / 2 - 24, BODY_WIDTH - 60, 30, 22, kit.palette.textMuted);
    const contentWidth = 8 + 9 * ITEM_CHIP_WIDTH + 8 * EQUIP_STRIP_GAP + 8;
    const surface = kit.node(rack, 'DrawerItemStripSurface', 0, -17,
      BODY_WIDTH - 32, ITEM_CELL_HEIGHT);
    const region = kit.hScrollRegion(
      { body: surface, width: BODY_WIDTH - 32, bodyHeight: ITEM_CELL_HEIGHT },
      ITEM_CELL_HEIGHT, contentWidth,
    );
    loadoutItems(kit).forEach((item, index) => {
      const cursor = 8 + index * (ITEM_CHIP_WIDTH + EQUIP_STRIP_GAP);
      drawItemChip(kit, region.content, item,
        stripItemX(region.contentWidth, cursor, ITEM_CHIP_WIDTH), 0, ITEM_CHIP_WIDTH);
    });
  } else {
    rackHeight = RACK_GRID_HEIGHT;
    const rack = kit.panel(body, 'MobileSheetInventoryRack', 0, BODY_HEIGHT / 2 - rackHeight / 2,
      BODY_WIDTH, rackHeight, kit.palette.quiet, kit.palette.edge, false, 'rack');
    kit.text(rack, 'RackCaption',
      `战术携行 ${loadout.carriedCount} 类 · 点击格子查看可用行动`,
      18, rackHeight / 2 - 24, BODY_WIDTH - 60, 30, 22, kit.palette.textMuted);
    const cellWidth = (BODY_WIDTH - 32 - (ITEM_GRID_COLUMNS - 1) * ITEM_GRID_GAP) / ITEM_GRID_COLUMNS;
    loadoutItems(kit).forEach((item, index) => {
      const col = index % ITEM_GRID_COLUMNS;
      const row = Math.floor(index / ITEM_GRID_COLUMNS);
      const x = -BODY_WIDTH / 2 + 16 + cellWidth / 2 + col * (cellWidth + ITEM_GRID_GAP);
      const y = rackHeight / 2 - 40 - ITEM_CELL_HEIGHT / 2 - row * (ITEM_CELL_HEIGHT + ITEM_GRID_GAP);
      drawItemChip(kit, rack, item, x, y, cellWidth);
    });
  }

  const consumedHeight = rackHeight + SHEET_GAP;
  const readoutBody = kit.node(body, 'MobileSheetInventoryReadout', 0, -consumedHeight / 2,
    BODY_WIDTH, BODY_HEIGHT - consumedHeight);
  kit.renderTextPages(
    { body: readoutBody, width: BODY_WIDTH, bodyHeight: BODY_HEIGHT - consumedHeight },
    kit.inventoryPages(),
  );
}

// --- factory ---------------------------------------------------------------

export function createDrawerLayout(options: {
  equipmentMode: 'strip' | 'grid';
  bannerKey?: string;
}): SheetLayout {
  const { equipmentMode, bannerKey = '' } = options;
  return defineSheetLayout(`drawer-${equipmentMode}`, {
    renderCharacter: (kit) => renderDrawerCharacter(kit, equipmentMode),
    renderMenu: (kit) => renderDrawerMenu(kit, bannerKey),
    renderInventory: (kit) => renderDrawerInventory(kit, equipmentMode),
  }, { frameGeometry: drawerFrameGeometry, renderChrome: drawerChrome });
}

export const DRAWER_LAYOUT_ARMOR = createDrawerLayout({
  equipmentMode: 'strip',
  bannerKey: SHEET_DUNGEON_BANNER_KEY,
});

export const DRAWER_LAYOUT_CASKET = createDrawerLayout({
  equipmentMode: 'grid',
  bannerKey: SHEET_SCENE_BANNER_KEY,
});
