// E4 — 卡片轮播引擎 (card carousel). Every section is one horizontal pager
// (MobileSheetPager): all cards for every page live in a single wide content
// node so the semantic node count is constant regardless of scroll position or
// image tier. Two density variants share the same machinery:
//  - triple (S07 金箓天书): three 206-wide cards per page with 12px gutters,
//  - hero   (S08 朱砂符箓): one 620-wide showcase card per page.
// The character sheet has no tab strip (560px stage); menu/inventory share the
// base tabs and the carousel occupies the remaining 460px surface.
import { Graphics, Node } from 'cc';
import type { SheetKit, SheetTarget } from '../sheet-kit';
import type { SheetLayout } from '../sheet-layout';
import { fillChamfer, withAlpha } from '../sheet-theme';
import {
  bindEquipSlot,
  bindItemCell,
  bindMenuDestination,
  characterKpis,
  characterLoadout,
  defineSheetLayout,
  drawCategoryTag,
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
  sheetEquipmentKey,
} from './sheet-engine-base';

const PAGE_GAP = 12;
const CHARACTER_STAGE_HEIGHT = 560;
const SURFACE_STAGE_HEIGHT = 460;
const TRIPLE_CARD_WIDTH = 206;
const HERO_CARD_WIDTH = 620;
const METRIC_CARD_HEIGHT = 560;

// --- pager decoration ------------------------------------------------------

/** Small cut-corner diamond; the only legal non-chamfer polygon in the engine. */
function cutDiamond(g: Graphics, cx: number, cy: number, radius: number): void {
  g.moveTo(cx, cy + radius);
  g.lineTo(cx + radius, cy);
  g.lineTo(cx, cy - radius);
  g.lineTo(cx - radius, cy);
  g.close();
  g.fill();
}

/**
 * The kit paints page dots as bare diamonds whose first fill is not a
 * full-size cut-corner surface. Repaint the node: a full-width chamfered track
 * first (gate discipline), then one diamond per page.
 */
function paintPagerDots(kit: SheetKit, dots: Node, pageCount: number): void {
  const g = dots.getComponent(Graphics);
  if (!g) return;
  g.clear();
  const width = Math.max(60, pageCount * 24);
  fillChamfer(g, width, 12, 3, withAlpha(kit.palette.edge, 120));
  g.fillColor = kit.palette.accent;
  const origin = -((pageCount - 1) * 24) / 2;
  for (let i = 0; i < pageCount; i += 1) cutDiamond(g, origin + i * 24, 0, 5);
}

/**
 * Hero-only decorative vertical index rail: a full-size chamfered spine with
 * one cut diamond per equipment slot followed by one per run metric. Strictly
 * ornamental — no events, no circles.
 */
function paintIndexRail(kit: SheetKit, parent: Node, x: number, y: number, metricCount: number): void {
  const rail = kit.node(parent, 'CarouselIndexRail', x, y, 12, 400);
  const g = rail.addComponent(Graphics);
  fillChamfer(g, 12, 400, 3, withAlpha(kit.palette.edge, 110));
  const marks = 7 + metricCount;
  for (let i = 0; i < marks; i += 1) {
    g.fillColor = i < 7 ? kit.palette.accent : withAlpha(kit.palette.accent, 140);
    cutDiamond(g, 0, 180 - i * 40, 5);
  }
}

interface CarouselStage {
  readonly content: Node;
  readonly pageWidth: number;
  readonly pageCount: number;
  readonly centerX: (page: number) => number;
}

function openCarousel(kit: SheetKit, target: SheetTarget, regionHeight: number, pageCount: number): CarouselStage {
  const pager = kit.pagerRegion(target, regionHeight, pageCount * target.width, pageCount);
  paintPagerDots(kit, pager.dots, pageCount);
  return {
    content: pager.content,
    pageWidth: target.width,
    pageCount,
    centerX: (page) => (page - (pageCount - 1) / 2) * target.width,
  };
}

type EquipEntry = NonNullable<ReturnType<typeof characterLoadout>>['equipment'][number];
type ItemEntry = ReturnType<typeof loadoutItems>[number];
type MenuDestination = ReturnType<typeof menuDestinations>[number];

/** Centered slot x for `index` of `count` items sharing one triple page. */
function tripleLocalX(index: number, count: number, cardWidth: number): number {
  const startSlot = (3 - count) / 2;
  return (startSlot + index - 1) * (cardWidth + PAGE_GAP);
}

/** Centered slot x for `index` of `count` (1 or 2) wide cards per triple page. */
function pairedLocalX(index: number, count: number, cardWidth: number): number {
  const startSlot = (2 - count) / 2;
  return (startSlot + index - 0.5) * (cardWidth + PAGE_GAP);
}

// --- character -------------------------------------------------------------

function drawCharacterCover(kit: SheetKit, content: Node, x: number, triple: boolean, metricCount: number): void {
  if (triple) {
    drawPortrait(kit, content, 'DollPortrait', x, 62, 420, 420);
    const kpiWidth = 156;
    characterKpis(kit).forEach((kpi, index) => {
      const kx = x - 330 + kpiWidth / 2 + index * (kpiWidth + PAGE_GAP);
      drawKpiCard(kit, content, kpi, kx, -208, kpiWidth, 104);
    });
    return;
  }
  drawPortrait(kit, content, 'DollPortrait', x, 92, 360, 360);
  paintIndexRail(kit, content, x - 322, 0, metricCount);
  paintIndexRail(kit, content, x + 322, 0, metricCount);
  // 142px cards keep the KPI row (half-width 311) clear of the 322px rails.
  const kpiWidth = 142;
  const kpiGap = 18;
  characterKpis(kit).forEach((kpi, index) => {
    const kx = x - 331 + kpiWidth / 2 + index * (kpiWidth + kpiGap);
    drawKpiCard(kit, content, kpi, kx, -152, kpiWidth, 104);
  });
}

/** Tall equipment showcase card; always named MobileSheetEquip:${slot}. */
function drawEquipmentCard(
  kit: SheetKit,
  parent: Node,
  entry: EquipEntry,
  x: number,
  y: number,
  width: number,
  height: number,
  triple: boolean,
): void {
  const card = kit.panel(parent, `MobileSheetEquip:${entry.slot}`, x, y, width, height,
    kit.palette.quiet, kit.palette.accent, false, 'card');
  const glyph = entry.name.charAt(entry.name.length - 1);
  if (triple) {
    kit.figure(card, 'SlotFigure', sheetEquipmentKey(entry.equipmentId), 0, 116, 160, 200,
      { glyph, glyphSize: 26, glyphColor: kit.palette.textMuted });
    kit.text(card, 'SlotLabel', entry.slotLabel, 0, -16, width - 24, 28, 19, kit.palette.textMuted, true);
    kit.text(card, 'SlotName', entry.name, 0, -66, width - 24, 42, 21, kit.palette.text, true);
  } else {
    kit.figure(card, 'SlotFigure', sheetEquipmentKey(entry.equipmentId), 0, 96, 240, 300,
      { glyph, glyphSize: 30, glyphColor: kit.palette.textMuted });
    kit.text(card, 'SlotLabel', entry.slotLabel, 0, -84, width - 32, 30, 21, kit.palette.textMuted, true);
    kit.text(card, 'SlotName', entry.name, 0, -146, width - 32, 46, 24, kit.palette.text, true);
  }
  kit.text(card, 'SlotLevel', `Lv.${entry.level}`, 0, -height / 2 + 34, width - 24, 28, 20, kit.palette.accent, true);
  bindEquipSlot(kit, card);
}

function renderCarouselCharacter(kit: SheetKit, triple: boolean): void {
  const target: SheetTarget = {
    body: kit.context.body,
    width: kit.context.width,
    bodyHeight: kit.context.bodyHeight,
  };
  const loadout = characterLoadout(kit);
  if (!loadout) {
    renderFullMetricFallback(kit, target);
    return;
  }
  const metrics = restCharacterMetrics(kit);
  const perEquipPage = triple ? 3 : 1;
  const perMetricPage = triple ? 2 : 1;
  const equipPages = Math.ceil(loadout.equipment.length / perEquipPage);
  const metricPages = Math.ceil(metrics.length / perMetricPage);
  const pageCount = 1 + equipPages + metricPages;
  const stage = openCarousel(kit, target, CHARACTER_STAGE_HEIGHT, pageCount);
  const { content } = stage;

  drawCharacterCover(kit, content, stage.centerX(0), triple, metrics.length);

  loadout.equipment.forEach((entry, index) => {
    const page = 1 + Math.floor(index / perEquipPage);
    const onPage = index % perEquipPage;
    const pageStart = (page - 1) * perEquipPage;
    const countOnPage = Math.min(perEquipPage, loadout.equipment.length - pageStart);
    const localX = triple
      ? tripleLocalX(onPage, countOnPage, TRIPLE_CARD_WIDTH)
      : 0;
    drawEquipmentCard(kit, content, entry, stage.centerX(page) + localX, 0,
      triple ? TRIPLE_CARD_WIDTH : HERO_CARD_WIDTH, CHARACTER_STAGE_HEIGHT, triple);
  });

  metrics.forEach((metric, index) => {
    const page = 1 + equipPages + Math.floor(index / perMetricPage);
    const onPage = index % perMetricPage;
    const pageStart = (Math.floor(index / perMetricPage)) * perMetricPage;
    const countOnPage = Math.min(perMetricPage, metrics.length - pageStart);
    let localX: number;
    let cardWidth: number;
    if (triple) {
      cardWidth = 300;
      localX = pairedLocalX(onPage, countOnPage, cardWidth);
    } else {
      cardWidth = 420;
      localX = 0;
    }
    drawMetricCard(kit, content, metric, stage.centerX(page) + localX, 0, cardWidth, METRIC_CARD_HEIGHT);
  });
}

// --- menu ------------------------------------------------------------------

function drawShortcutCard(
  kit: SheetKit,
  parent: Node,
  destination: MenuDestination,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const cell = kit.panel(parent, `MobileSheetShortcut:${destination.kind}`, x, y, width, height,
    kit.palette.quiet, destination.danger ? kit.palette.danger : kit.palette.edgeStrong, false, 'tile');
  kit.icon(cell, 'ShortcutIcon', destination.iconKind, 0, height / 2 - 96,
    destination.danger ? kit.palette.danger : kit.palette.accent);
  kit.text(cell, 'ShortcutTitle', destination.label, 0, -height / 2 + 72, width - 28, 46, 25, kit.palette.text, true);
  bindMenuDestination(kit, cell, destination);
}

function renderCarouselMenu(kit: SheetKit, triple: boolean): void {
  const tabbed = menuTabs(kit, {
    body: kit.context.body,
    width: kit.context.width,
    bodyHeight: kit.context.bodyHeight,
  });
  if (tabbed.active === 'actions') {
    runActionList(kit, tabbed.surface, 'menu');
    return;
  }
  const target: SheetTarget = {
    body: tabbed.surface.body,
    width: tabbed.surface.width,
    bodyHeight: tabbed.surface.bodyHeight,
  };
  const destinations = menuDestinations(kit);
  const perPage = triple ? 3 : 1;
  const pageCount = Math.ceil(destinations.length / perPage);
  const stage = openCarousel(kit, target, SURFACE_STAGE_HEIGHT, pageCount);
  const cardWidth = triple ? TRIPLE_CARD_WIDTH : HERO_CARD_WIDTH;
  destinations.forEach((destination, index) => {
    const page = Math.floor(index / perPage);
    const onPage = index % perPage;
    const localX = triple ? tripleLocalX(onPage, perPage, cardWidth) : 0;
    drawShortcutCard(kit, stage.content, destination, stage.centerX(page) + localX, 0,
      cardWidth, SURFACE_STAGE_HEIGHT);
  });
}

// --- inventory -------------------------------------------------------------

function drawItemCard(
  kit: SheetKit,
  parent: Node,
  item: ItemEntry,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const empty = item.count === 0 && !item.carried;
  const card = kit.panel(parent, `MobileSheetItem:${item.itemId}`, x, y, width, height,
    kit.palette.raised, item.carried ? kit.palette.accent : kit.palette.edge, false, 'cell');
  itemFigure(kit, card, item, 0, 120, 160, 200);
  kit.text(card, 'ItemName', item.name, 0, -10, width - 28, 40, 22,
    empty ? kit.palette.textMuted : kit.palette.text, true);
  kit.text(card, 'ItemCount', `×${item.count}`, 0, -66, width - 28, 30, 20,
    item.count > 0 ? kit.palette.accent : kit.palette.textMuted, true);
  drawCategoryTag(kit, card, item, 0, -height / 2 + 44);
  if (item.carried) itemSeal(kit, card, width, height);
  bindItemCell(kit, card);
}

/**
 * The closing readout page. Triple lets the production MobileSheetReadout
 * cards fill a full-page vertical scroll; hero seats them inside one 620-wide
 * showcase plate with its own clipped scroll body.
 */
function drawReadoutPage(kit: SheetKit, stage: CarouselStage, page: number, triple: boolean): void {
  const pageNode = kit.node(stage.content, 'CarouselReadoutPage', stage.centerX(page), 0,
    stage.pageWidth, SURFACE_STAGE_HEIGHT);
  if (triple) {
    kit.drawScrollDoc(
      { body: pageNode, width: stage.pageWidth, bodyHeight: SURFACE_STAGE_HEIGHT },
      kit.inventoryPages(),
    );
    return;
  }
  const plate = kit.panel(pageNode, 'CarouselReadoutPlate', 0, 0, HERO_CARD_WIDTH, SURFACE_STAGE_HEIGHT,
    kit.palette.quiet, kit.palette.edge, false, 'card');
  const inner = kit.node(plate, 'CarouselReadoutBody', 0, 0, HERO_CARD_WIDTH - 32, SURFACE_STAGE_HEIGHT - 24);
  kit.drawScrollDoc(
    { body: inner, width: HERO_CARD_WIDTH - 32, bodyHeight: SURFACE_STAGE_HEIGHT - 24 },
    kit.inventoryPages(),
  );
}

function renderCarouselInventory(kit: SheetKit, triple: boolean): void {
  const tabbed = inventoryTabs(kit, {
    body: kit.context.body,
    width: kit.context.width,
    bodyHeight: kit.context.bodyHeight,
  });
  if (tabbed.active === 'actions') {
    runActionList(kit, tabbed.surface, 'inventory');
    return;
  }
  const target: SheetTarget = {
    body: tabbed.surface.body,
    width: tabbed.surface.width,
    bodyHeight: tabbed.surface.bodyHeight,
  };
  const loadout = guardLoadout(kit, target);
  if (!loadout) return;

  const items = loadoutItems(kit);
  const perPage = triple ? 3 : 1;
  const itemPages = Math.ceil(items.length / perPage);
  const pageCount = itemPages + 1;
  const stage = openCarousel(kit, target, SURFACE_STAGE_HEIGHT, pageCount);
  const cardWidth = triple ? TRIPLE_CARD_WIDTH : HERO_CARD_WIDTH;
  items.forEach((item, index) => {
    const page = Math.floor(index / perPage);
    const onPage = index % perPage;
    const pageStart = page * perPage;
    const countOnPage = Math.min(perPage, items.length - pageStart);
    const localX = triple ? tripleLocalX(onPage, countOnPage, cardWidth) : 0;
    drawItemCard(kit, stage.content, item, stage.centerX(page) + localX, 0,
      cardWidth, SURFACE_STAGE_HEIGHT);
  });
  drawReadoutPage(kit, stage, itemPages, triple);
}

// --- factory ---------------------------------------------------------------

export function createCarouselLayout(options: { readonly cardsPerPage: 3 | 1; readonly hero: boolean }): SheetLayout {
  const triple = options.cardsPerPage === 3;
  return defineSheetLayout(options.hero ? 'carousel-hero' : 'carousel-triple', {
    renderCharacter: (kit) => renderCarouselCharacter(kit, triple),
    renderMenu: (kit) => renderCarouselMenu(kit, triple),
    renderInventory: (kit) => renderCarouselInventory(kit, triple),
  });
}

export const CAROUSEL_LAYOUT_TRIPLE = createCarouselLayout({ cardsPerPage: 3, hero: false });
export const CAROUSEL_LAYOUT_HERO = createCarouselLayout({ cardsPerPage: 1, hero: true });
