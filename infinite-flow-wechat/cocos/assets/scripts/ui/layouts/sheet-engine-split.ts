// E2 — 左右分卷 (left-right split ledger). The 662px gallery body splits into
// a 254px left scroll and a 392px right ledger: the character page puts the
// 254×320 portrait card over a 2×2 KPI block on the left and runs one vertical
// equipment/metric ledger on the right; the menu page uses a 176px seal rail
// beside a 470px banner (or military plaque) plus the VM briefing pages; the
// inventory page racks 2×5 item cells on the left against inventory pages on
// the right. The factory switches only the menu header art (scene banner for
// the bamboo style, vector plaque for the military style), so both styles keep
// one engine.
import type { Node } from 'cc';
import type { StatusMetric } from '@infinite-flow/presentation';
import type { SheetKit } from '../sheet-kit';
import type { SheetLayout } from '../sheet-layout';
import {
  SHEET_GAP,
  SHEET_SCENE_BANNER_KEY,
  bindItemCell,
  bindMenuDestination,
  bindMetricCard,
  characterKpis,
  characterLoadout,
  defineSheetLayout,
  drawBanner,
  drawEquipSlot,
  drawKpiCard,
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

// --- split geometry (662 = 254 + 16 + 392) ---------------------------------

const LEFT_W = 254;
const RIGHT_W = 392;
const LEFT_X = -(RIGHT_W / 2 + SHEET_GAP / 2);
const RIGHT_X = LEFT_W / 2 + SHEET_GAP / 2;

// Menu shortcuts use a narrower 176px seal rail (176 + 16 + 470 = 662).
const RAIL_W = 176;
const MENU_RIGHT_W = 470;
const RAIL_X = -(MENU_RIGHT_W / 2 + SHEET_GAP / 2);
const MENU_RIGHT_X = RAIL_W / 2 + SHEET_GAP / 2;

const ROW_H = 104;
const PORTRAIT_H = 320;
const KPI_H = 104;
const MENU_HEADER_H = 140;

const EQUIP_ORDER = ['head', 'waist', 'weapon', 'armor', 'hands', 'feet', 'charm'] as const;

// --- character --------------------------------------------------------------

function renderSplitCharacter(kit: SheetKit): void {
  const { body, width, bodyHeight } = kit.context;
  const loadout = characterLoadout(kit);
  if (!loadout) {
    // Loadout-less phases keep the shared full-height metric grid.
    renderFullMetricFallback(kit, { body, width, bodyHeight });
    return;
  }

  // Left column: portrait card over a 2×2 KPI block.
  const portraitCard = kit.panel(body, 'MobileSheetDollStage',
    LEFT_X, bodyHeight / 2 - PORTRAIT_H / 2, LEFT_W, PORTRAIT_H,
    kit.palette.quiet, kit.palette.edgeStrong);
  drawPortrait(kit, portraitCard, 'DollPortrait', 0, 0, 240, 300);

  const kpiW = (LEFT_W - SHEET_GAP) / 2;
  const kpiTop = bodyHeight / 2 - PORTRAIT_H - SHEET_GAP;
  characterKpis(kit).forEach((kpi, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = LEFT_X - LEFT_W / 2 + kpiW / 2 + col * (kpiW + SHEET_GAP);
    const y = kpiTop - KPI_H / 2 - row * (KPI_H + SHEET_GAP);
    drawKpiCard(kit, body, kpi, x, y, kpiW, KPI_H);
  });

  // Right column: one vertical ledger — seven equipment rows then metric rows.
  const surface = kit.node(body, 'SplitLedgerSurface', RIGHT_X, 0, RIGHT_W, bodyHeight);
  const equipBySlot = new Map(loadout.equipment.map((entry) => [entry.slot, entry]));
  const equipment = EQUIP_ORDER.flatMap((slot) => {
    const entry = equipBySlot.get(slot);
    return entry ? [entry] : [];
  });
  const metrics = restCharacterMetrics(kit);
  const rowCount = equipment.length + metrics.length;
  const contentHeight = 8 + rowCount * ROW_H + (rowCount - 1) * SHEET_GAP + 8;
  const region = kit.scrollRegion({ body: surface, width: RIGHT_W, bodyHeight }, contentHeight);

  equipment.forEach((entry, index) => {
    const cursor = 8 + index * (ROW_H + SHEET_GAP);
    drawEquipSlot(kit, region.content, entry, 0,
      kit.scrollItemY(region, cursor, ROW_H), RIGHT_W, ROW_H, { icon: true, iconSize: 84 });
  });
  metrics.forEach((metric, index) => {
    const cursor = 8 + (equipment.length + index) * (ROW_H + SHEET_GAP);
    drawLedgerMetric(kit, region.content, metric, kit.scrollItemY(region, cursor, ROW_H));
  });
}

/** A 392×104 ledger row: 56px single-glyph symbol column, label and value. */
function drawLedgerMetric(kit: SheetKit, parent: Node, metric: StatusMetric, y: number): Node {
  const accent = kit.metricColor(metric);
  const card = kit.panel(parent, `MobileSheetMetric:${metric.id}`, 0, y, RIGHT_W, ROW_H,
    kit.palette.quiet, accent === kit.palette.danger ? kit.palette.dangerDark : kit.palette.edge);
  kit.text(card, 'MetricSymbol', metric.symbol, -RIGHT_W / 2 + 28, 0, 56, 44, 30, accent, true);
  kit.text(card, 'MetricLabel', kit.readable(metric.label), 26, 22, RIGHT_W - 88, 30, 20,
    kit.palette.textMuted, true);
  kit.text(card, 'MetricValue', kit.readable(metric.value), 26, -22, RIGHT_W - 88, 38, 26, accent, true);
  bindMetricCard(kit, card, metric);
  return card;
}

// --- menu -------------------------------------------------------------------

function renderSplitMenu(kit: SheetKit, banner: 'scene' | 'none'): void {
  const tabbed = menuTabs(kit, {
    body: kit.context.body, width: kit.context.width, bodyHeight: kit.context.bodyHeight,
  });
  if (tabbed.active === 'actions') {
    runActionList(kit, tabbed.surface, 'menu');
    return;
  }
  const tabBody = tabbed.surface.body;
  const height = tabbed.surface.bodyHeight;

  // Left seal rail: nine 176×104 scrolling destination rows in production order.
  const rail = kit.node(tabBody, 'SplitMenuRail', RAIL_X, 0, RAIL_W, height);
  const destinations = menuDestinations(kit);
  const railContentHeight = 8 + destinations.length * ROW_H
    + (destinations.length - 1) * SHEET_GAP + 8;
  const railRegion = kit.scrollRegion({ body: rail, width: RAIL_W, bodyHeight: height }, railContentHeight);
  destinations.forEach((destination, index) => {
    const cursor = 8 + index * (ROW_H + SHEET_GAP);
    const cell = kit.panel(railRegion.content, `MobileSheetShortcut:${destination.kind}`,
      0, kit.scrollItemY(railRegion, cursor, ROW_H), RAIL_W, ROW_H,
      kit.palette.quiet, destination.danger ? kit.palette.danger : kit.palette.edgeStrong, false, 'tile');
    kit.icon(cell, 'ShortcutIcon', destination.iconKind, 0, 20,
      destination.danger ? kit.palette.danger : kit.palette.accent);
    kit.text(cell, 'ShortcutTitle', destination.label, 0, -26, RAIL_W - 16, 30, 20,
      kit.palette.text, true);
    bindMenuDestination(kit, cell, destination);
  });

  // Right column: scene banner (bamboo) or vector plaque (military), then the
  // VM briefing pages below.
  const right = kit.node(tabBody, 'SplitMenuRight', MENU_RIGHT_X, 0, MENU_RIGHT_W, height);
  const headerY = height / 2 - MENU_HEADER_H / 2;
  const title = kit.readable(kit.context.model.sections[0].title);
  if (banner === 'scene') {
    const bannerNode = drawBanner(kit, right, 'SheetSceneBanner', SHEET_SCENE_BANNER_KEY,
      0, headerY, MENU_RIGHT_W, MENU_HEADER_H);
    const scrim = kit.scrimCard(bannerNode, 'BannerScrim',
      0, -MENU_HEADER_H / 2 + 30, MENU_RIGHT_W, 52);
    kit.text(scrim, 'BannerTitle', title, 0, 0, MENU_RIGHT_W - 32, 36, 22, kit.palette.text, true);
  } else {
    const plaque = kit.panel(right, 'SheetMenuPlaque', 0, headerY, MENU_RIGHT_W, MENU_HEADER_H,
      kit.palette.quiet, kit.palette.edgeStrong, false, 'card');
    kit.icon(plaque, 'GlyphIcon', 'menu', -MENU_RIGHT_W / 2 + 54, 0, kit.palette.accent);
    kit.text(plaque, 'PlaqueTitle', title, 36, 0, MENU_RIGHT_W - 160, 48, 26, kit.palette.text, true);
  }

  const docHeight = height - MENU_HEADER_H - SHEET_GAP;
  const doc = kit.node(right, 'SplitMenuDoc', 0, -(MENU_HEADER_H + SHEET_GAP) / 2,
    MENU_RIGHT_W, docHeight);
  kit.renderTextPages({ body: doc, width: MENU_RIGHT_W, bodyHeight: docHeight }, [
    {
      title: kit.context.model.sections[0].title,
      lines: [
        kit.context.model.sections[0].summary,
        '选择左侧印签进入对应功能。',
      ],
    },
  ]);
}

// --- inventory ---------------------------------------------------------------

function renderSplitInventory(kit: SheetKit): void {
  const tabbed = inventoryTabs(kit, {
    body: kit.context.body, width: kit.context.width, bodyHeight: kit.context.bodyHeight,
  });
  if (tabbed.active === 'actions') {
    runActionList(kit, tabbed.surface, 'inventory');
    return;
  }
  const ctx = tabbed.surface;
  const loadout = guardLoadout(kit, ctx);
  if (!loadout) return;

  // Left rack: 2×5 scrolling 119×104 item cells in loadout order.
  const rack = kit.panel(ctx.body, 'MobileSheetInventoryRack', LEFT_X, 0, LEFT_W, ctx.bodyHeight,
    kit.palette.quiet, kit.palette.edge, false, 'rack');
  const items = loadoutItems(kit);
  const cellW = (LEFT_W - SHEET_GAP) / 2;
  const rackRows = Math.max(1, Math.ceil(items.length / 2));
  const rackContentHeight = 8 + rackRows * ROW_H + (rackRows - 1) * SHEET_GAP + 8;
  const rackRegion = kit.scrollRegion({ body: rack, width: LEFT_W, bodyHeight: ctx.bodyHeight },
    rackContentHeight);
  items.forEach((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = -LEFT_W / 2 + cellW / 2 + col * (cellW + SHEET_GAP);
    const cursor = 8 + row * (ROW_H + SHEET_GAP);
    const cell = kit.panel(rackRegion.content, `MobileSheetItem:${item.itemId}`,
      x, kit.scrollItemY(rackRegion, cursor, ROW_H), cellW, ROW_H,
      kit.palette.raised, item.carried ? kit.palette.accent : kit.palette.edge, false, 'cell');
    itemFigure(kit, cell, item, 0, 16, 72, 72);
    kit.text(cell, 'ItemCount', `×${item.count}`, 0, -34, cellW - 14, 24, 18,
      item.count > 0 ? kit.palette.accent : kit.palette.textMuted, true);
    if (item.carried) itemSeal(kit, cell, cellW, ROW_H);
    bindItemCell(kit, cell);
  });

  // Right readout: the production inventory pages.
  const right = kit.node(ctx.body, 'SplitInventoryReadout', RIGHT_X, 0, RIGHT_W, ctx.bodyHeight);
  kit.renderTextPages({ body: right, width: RIGHT_W, bodyHeight: ctx.bodyHeight },
    kit.inventoryPages());
}

// --- factory -----------------------------------------------------------------

export function createSplitLayout(options: { menuBanner?: 'scene' | 'none' } = {}): SheetLayout {
  const menuBanner = options.menuBanner ?? 'none';
  return defineSheetLayout(menuBanner === 'scene' ? 'split-bamboo' : 'split-military', {
    renderCharacter: renderSplitCharacter,
    renderMenu: (kit) => renderSplitMenu(kit, menuBanner),
    renderInventory: renderSplitInventory,
  });
}

export const SPLIT_LAYOUT_MILITARY = createSplitLayout({ menuBanner: 'none' });
export const SPLIT_LAYOUT_BAMBOO = createSplitLayout({ menuBanner: 'scene' });
