// E5 — 列账长卷 (ledger scroll). One full-length vertical ScrollView carries
// every ledger row of a sheet: the hero banner (imperial only), KPI cards,
// seven equipment rows, the rest-metric rows, the menu destinations, the
// inventory rack and the same-scroll readout cards. Rows are flush 662px
// cut-corner plates separated by hairline rules drawn from a single Graphics
// node; the secret style keeps plain iron plates without banner or portrait.
import { Graphics } from 'cc';
import type { StatusMetric } from '@infinite-flow/presentation';
import type { MobileSheetPage, SheetKit, SheetScrollRegion, SheetTarget } from '../sheet-kit';
import {
  SHEET_GAP,
  SHEET_SCENE_BANNER_KEY,
  bindEquipSlot,
  bindItemCell,
  bindMenuDestination,
  bindMetricCard,
  characterKpis,
  characterLoadout,
  characterMetrics,
  defineSheetLayout,
  drawBanner,
  drawCategoryTag,
  drawKpiCard,
  drawPortrait,
  guardLoadout,
  itemFigure,
  itemSeal,
  loadoutItems,
  menuDestinations,
  renderActionsWithReturn,
  restCharacterMetrics,
  sheetEquipmentKey,
} from './sheet-engine-base';

const SHEET_WIDTH = 662;
const HALF = SHEET_WIDTH / 2;
const PAD = 8;
const RULE_INSET = 12;

export interface LedgerLayoutOptions {
  readonly rowHeight: 104 | 120;
  readonly banner: boolean;
  readonly portraitSize: number;
  readonly iconSize: number;
  readonly alternating: boolean;
}

type LedgerLoadout = NonNullable<ReturnType<typeof characterLoadout>>;
type EquipEntry = LedgerLoadout['equipment'][number];
type ItemEntry = LedgerLoadout['items'][number];

interface LedgerReadout {
  readonly title: string;
  readonly lines: readonly string[];
}

// --- row primitives --------------------------------------------------------

function rowFill(kit: SheetKit, options: LedgerLayoutOptions, index: number) {
  return options.alternating && index % 2 === 1 ? kit.palette.quiet : kit.palette.raised;
}

/** 662×rowHeight equipment ledger row: raster figure left, text stack right. */
function drawEquipRow(
  kit: SheetKit,
  parent: SheetScrollRegion['content'],
  entry: EquipEntry,
  y: number,
  options: LedgerLayoutOptions,
  index: number,
): void {
  const h = options.rowHeight;
  const row = kit.panel(parent, `MobileSheetEquip:${entry.slot}`, 0, y, SHEET_WIDTH, h,
    rowFill(kit, options, index), kit.palette.edge, false, 'cell');
  const figureW = options.iconSize;
  const figureH = Math.min(options.iconSize + 16, h - 16);
  const figureX = -HALF + 24 + figureW / 2;
  kit.figure(row, 'SlotFigure', sheetEquipmentKey(entry.equipmentId), figureX, 0, figureW, figureH,
    { glyph: entry.name.charAt(entry.name.length - 1), glyphSize: 26, glyphColor: kit.palette.textMuted });
  const blockLeft = -HALF + 44 + options.iconSize;
  const blockWidth = HALF - 24 - blockLeft;
  const textX = blockLeft + blockWidth / 2;
  kit.text(row, 'SlotLabel', entry.slotLabel, textX, h / 2 - 26, blockWidth, 26, 19, kit.palette.textMuted);
  kit.text(row, 'SlotName', entry.name, textX, 0, blockWidth, 36, 22, kit.palette.text);
  kit.text(row, 'SlotLevel', `Lv.${entry.level}`, textX, -h / 2 + 22, blockWidth, 26, 18, kit.palette.accent);
  bindEquipSlot(kit, row);
}

/** 662×rowHeight metric ledger row with the 64px symbol column. */
function drawMetricRow(
  kit: SheetKit,
  parent: SheetScrollRegion['content'],
  metric: StatusMetric,
  y: number,
  options: LedgerLayoutOptions,
  index: number,
): void {
  const h = options.rowHeight;
  const row = kit.panel(parent, `MobileSheetMetric:${metric.id}`, 0, y, SHEET_WIDTH, h,
    rowFill(kit, options, index), kit.palette.edge, false, 'cell');
  kit.text(row, 'MetricSymbol', metric.symbol, -HALF + 24 + 32, 0, 64, 64, 30, kit.metricColor(metric), true);
  const blockLeft = -HALF + 44 + 64;
  const blockWidth = HALF - 24 - blockLeft;
  const textX = blockLeft + blockWidth / 2;
  kit.text(row, 'MetricLabel', kit.readable(metric.label), textX, h / 2 - 26, blockWidth, 30, 21, kit.palette.textMuted);
  kit.text(row, 'MetricValue', kit.readable(metric.value), textX, -h / 2 + 24, blockWidth, 36, 26, kit.metricColor(metric));
  bindMetricCard(kit, row, metric);
}

/** 662×rowHeight menu ledger row with the vector icon and 入卷 hint. */
function drawMenuRow(
  kit: SheetKit,
  parent: SheetScrollRegion['content'],
  destination: ReturnType<typeof menuDestinations>[number],
  y: number,
  options: LedgerLayoutOptions,
  index: number,
): void {
  const h = options.rowHeight;
  const row = kit.panel(parent, `MobileSheetShortcut:${destination.kind}`, 0, y, SHEET_WIDTH, h,
    rowFill(kit, options, index), destination.danger ? kit.palette.danger : kit.palette.edge, false, 'cell');
  kit.icon(row, 'ShortcutIcon', destination.iconKind, -HALF + 24 + options.iconSize / 2, 0,
    destination.danger ? kit.palette.danger : kit.palette.accent);
  const blockLeft = -HALF + 44 + options.iconSize;
  const blockWidth = HALF - 24 - 96 - blockLeft - 12;
  kit.text(row, 'ShortcutTitle', destination.label, blockLeft + blockWidth / 2, 0, blockWidth, 36, 23, kit.palette.text);
  kit.text(row, 'ShortcutHint', '入卷 ›', HALF - 24 - 48, 0, 96, 30, 18, kit.palette.textMuted, true);
  bindMenuDestination(kit, row, destination);
}

/** 662×rowHeight tactical item ledger row with tag and carried seal. */
function drawItemRow(
  kit: SheetKit,
  parent: SheetScrollRegion['content'],
  item: ItemEntry,
  y: number,
  options: LedgerLayoutOptions,
  index: number,
): void {
  const h = options.rowHeight;
  const row = kit.panel(parent, `MobileSheetItem:${item.itemId}`, 0, y, SHEET_WIDTH, h,
    rowFill(kit, options, index), item.carried ? kit.palette.accent : kit.palette.edge, false, 'cell');
  const figureW = options.banner ? 96 : 84;
  const figureH = Math.min(figureW, h - 16);
  itemFigure(kit, row, item, -HALF + 24 + figureW / 2, 0, figureW, figureH);
  const blockLeft = -HALF + 44 + figureW;
  const blockWidth = HALF - 24 - 116 - blockLeft;
  const textX = blockLeft + blockWidth / 2;
  const empty = item.count === 0 && !item.carried;
  kit.text(row, 'ItemName', item.name, textX, h / 2 - 26, blockWidth, 30, 21,
    empty ? kit.palette.textMuted : kit.palette.text);
  kit.text(row, 'ItemCount', `×${item.count}`, textX, -h / 2 + 22, blockWidth, 26, 18,
    item.count > 0 ? kit.palette.accent : kit.palette.textMuted);
  drawCategoryTag(kit, row, item, HALF - 24 - 48, -h / 2 + 30);
  if (item.carried) itemSeal(kit, row, SHEET_WIDTH, h);
  bindItemCell(kit, row);
}

// --- banners ----------------------------------------------------------------

/** Imperial character banner: scene art, clamped portrait, scrim + 2×2 KPIs. */
function drawHeroBanner(
  kit: SheetKit,
  parent: SheetScrollRegion['content'],
  y: number,
  options: LedgerLayoutOptions,
): void {
  const banner = kit.panel(parent, 'LedgerHeroBanner', 0, y, SHEET_WIDTH, 260,
    kit.palette.quiet, kit.palette.edgeStrong, false, 'card');
  drawBanner(kit, banner, 'LedgerHeroArt', SHEET_SCENE_BANNER_KEY, 0, 0, SHEET_WIDTH, 260);
  const portraitW = Math.min(200, Math.round((options.portraitSize * 5) / 8));
  const portraitH = Math.min(260, Math.round(portraitW * 1.3));
  drawPortrait(kit, banner, 'DollPortrait', HALF - 8 - portraitW / 2, 0, portraitW, portraitH);
  const scrim = kit.scrimCard(banner, 'HeroBannerScrim', -101, 0, 460, 256);
  kit.text(scrim, 'HeroBannerTitle', '随身武备', 0, 108, 460 - 48, 32, 26, kit.palette.text, true);
  const kpis = characterKpis(kit);
  const cardW = 207;
  const cardH = 104;
  kpis.forEach((kpi, index) => {
    const col = index % 2;
    const gridRow = Math.floor(index / 2);
    drawKpiCard(kit, scrim, kpi, col === 0 ? -111.5 : 111.5, gridRow === 0 ? 36 : -76, cardW, cardH);
  });
}

/** Imperial menu banner with the title carried on a scrim plate. */
function drawMenuBanner(kit: SheetKit, parent: SheetScrollRegion['content'], y: number): void {
  const banner = kit.panel(parent, 'MenuBanner', 0, y, SHEET_WIDTH, 140,
    kit.palette.quiet, kit.palette.edgeStrong, false, 'card');
  drawBanner(kit, banner, 'MenuBannerArt', SHEET_SCENE_BANNER_KEY, 0, 0, SHEET_WIDTH, 140);
  const scrim = kit.scrimCard(banner, 'MenuBannerScrim', -91, 0, 440, 92);
  kit.text(scrim, 'MenuBannerTitle', '随身功能', 0, 0, 440 - 48, 44, 28, kit.palette.text, true);
}

// --- shared scroll scaffolding ----------------------------------------------

function paintRules(kit: SheetKit, content: SheetScrollRegion['content'], region: SheetScrollRegion, boundaries: readonly number[]): void {
  if (boundaries.length === 0) return;
  const rules = kit.node(content, 'LedgerRowRules', 0, 0, SHEET_WIDTH, region.contentHeight);
  const g = rules.addComponent(Graphics);
  g.strokeColor = kit.palette.edge;
  g.lineWidth = 1;
  for (const boundary of boundaries) {
    const y = region.contentHeight / 2 - boundary;
    g.moveTo(-HALF + RULE_INSET, y);
    g.lineTo(HALF - RULE_INSET, y);
    g.stroke();
  }
}

function wrapPages(kit: SheetKit, pages: readonly MobileSheetPage[]): readonly LedgerReadout[] {
  const maxUnits = Math.max(8, Math.floor((SHEET_WIDTH - 72) / 28));
  return pages.map((page) => ({
    title: kit.readable(page.title),
    lines: page.lines
      .map((line) => kit.readable(line))
      .flatMap((entry) => (entry.length === 0 ? [''] : entry.split('\n').flatMap((logical) => kit.wrapLine(logical, maxUnits)))),
  }));
}

// --- factory ----------------------------------------------------------------

export function createLedgerLayout(options: LedgerLayoutOptions) {
  const h = options.rowHeight;

  function renderCharacter(kit: SheetKit): void {
    const target: SheetTarget = { body: kit.context.body, width: kit.context.width, bodyHeight: kit.context.bodyHeight };
    const loadout = characterLoadout(kit);

    // Loadout-less phases: no banner, the complete metric set as ledger rows.
    if (!loadout) {
      const metrics = characterMetrics(kit);
      const contentHeight = PAD + metrics.length * h + PAD;
      const region = kit.scrollRegion(target, contentHeight);
      const boundaries: number[] = [];
      let cursor = PAD;
      metrics.forEach((metric, index) => {
        drawMetricRow(kit, region.content, metric, kit.scrollItemY(region, cursor, h), options, index);
        cursor += h;
        if (index < metrics.length - 1) boundaries.push(cursor);
      });
      paintRules(kit, region.content, region, boundaries);
      return;
    }

    const bannerH = options.banner ? 260 : 0;
    const bandH = options.banner ? 0 : 224;
    const restMetrics = restCharacterMetrics(kit);
    const contentHeight = PAD + bannerH + bandH + 7 * h + restMetrics.length * h + PAD;
    const region = kit.scrollRegion(target, contentHeight);
    const content = region.content;
    const boundaries: number[] = [];
    let cursor = PAD;

    if (options.banner) {
      drawHeroBanner(kit, content, kit.scrollItemY(region, cursor, 260), options);
      cursor += 260;
      boundaries.push(cursor);
    } else {
      const band = kit.panel(content, 'MobileSheetKpiBand', 0, kit.scrollItemY(region, cursor, bandH),
        SHEET_WIDTH, bandH, kit.palette.surface, kit.palette.edge, false, 'rack');
      const cardW = (SHEET_WIDTH - SHEET_GAP) / 2;
      characterKpis(kit).forEach((kpi, index) => {
        const col = index % 2;
        const gridRow = Math.floor(index / 2);
        drawKpiCard(kit, band, kpi, col === 0 ? -(cardW / 2 + SHEET_GAP / 2) : cardW / 2 + SHEET_GAP / 2,
          gridRow === 0 ? 56 : -56, cardW, 104);
      });
      cursor += bandH;
      boundaries.push(cursor);
    }

    loadout.equipment.forEach((entry, index) => {
      drawEquipRow(kit, content, entry, kit.scrollItemY(region, cursor, h), options, index);
      cursor += h;
      boundaries.push(cursor);
    });
    restMetrics.forEach((metric, index) => {
      drawMetricRow(kit, content, metric, kit.scrollItemY(region, cursor, h), options, index);
      cursor += h;
      if (index < restMetrics.length - 1) boundaries.push(cursor);
    });
    paintRules(kit, content, region, boundaries);
  }

  function renderMenu(kit: SheetKit): void {
    const target: SheetTarget = { body: kit.context.body, width: kit.context.width, bodyHeight: kit.context.bodyHeight };
    if (renderActionsWithReturn(kit, target, 'menu', 'shortcuts', '返回随身功能')) return;

    const bannerH = options.banner ? 140 : 0;
    const destinations = menuDestinations(kit);
    const contentHeight = PAD + bannerH + destinations.length * h + PAD;
    const region = kit.scrollRegion(target, contentHeight);
    const content = region.content;
    const boundaries: number[] = [];
    let cursor = PAD;

    if (options.banner) {
      drawMenuBanner(kit, content, kit.scrollItemY(region, cursor, 140));
      cursor += 140;
      boundaries.push(cursor);
    }
    destinations.forEach((destination, index) => {
      drawMenuRow(kit, content, destination, kit.scrollItemY(region, cursor, h), options, index);
      cursor += h;
      if (index < destinations.length - 1) boundaries.push(cursor);
    });
    paintRules(kit, content, region, boundaries);
  }

  function renderInventory(kit: SheetKit): void {
    const target: SheetTarget = { body: kit.context.body, width: kit.context.width, bodyHeight: kit.context.bodyHeight };
    if (renderActionsWithReturn(kit, target, 'inventory', 'overview', '返回持有与效果')) return;
    const loadout = guardLoadout(kit, target);
    if (!loadout) return;

    const items = loadoutItems(kit);
    const logical = kit.inventoryPages();
    const readouts = wrapPages(kit, logical.length === 0
      ? [{ title: '当前信息', lines: ['暂无可显示内容。'] }]
      : logical);
    const cardHeights = readouts.map((readout) => 104 + readout.lines.length * 38 + 18);
    const readoutsHeight = cardHeights.reduce((sum, height) => sum + height + SHEET_GAP, 0) - SHEET_GAP;
    const contentHeight = PAD + 88 + items.length * h + SHEET_GAP + readoutsHeight + PAD;
    const region = kit.scrollRegion(target, contentHeight);
    const content = region.content;
    const boundaries: number[] = [];
    let cursor = PAD;

    const rack = kit.panel(content, 'MobileSheetInventoryRack', 0, kit.scrollItemY(region, cursor, 88),
      SHEET_WIDTH, 88, kit.palette.quiet, kit.palette.edge, false, 'rack');
    kit.text(rack, 'RackCaption', `战术携行 ${loadout.carriedCount} 类`, 24, 0, SHEET_WIDTH - 48, 34, 23, kit.palette.textMuted);
    cursor += 88;
    boundaries.push(cursor);

    items.forEach((item, index) => {
      drawItemRow(kit, content, item, kit.scrollItemY(region, cursor, h), options, index);
      cursor += h;
      boundaries.push(cursor);
    });

    cursor += SHEET_GAP;
    readouts.forEach((readout, index) => {
      const cardHeight = cardHeights[index]!;
      const card = kit.panel(content, 'MobileSheetReadout', 0, kit.scrollItemY(region, cursor, cardHeight),
        SHEET_WIDTH, cardHeight, kit.palette.quiet, kit.palette.edge);
      kit.text(card, 'ReadoutTitle', readout.title, 0, cardHeight / 2 - 39, SHEET_WIDTH - 64, 50, 29, kit.palette.accent);
      readout.lines.forEach((line, lineIndex) => {
        kit.text(card, `ReadoutLine:${lineIndex}`, line, 0, cardHeight / 2 - 97 - lineIndex * 38, SHEET_WIDTH - 64, 38, 28);
      });
      cursor += cardHeight + SHEET_GAP;
    });
    paintRules(kit, content, region, boundaries);
  }

  return defineSheetLayout(options.banner ? 'ledger-imperial' : 'ledger-secret', {
    renderCharacter,
    renderMenu,
    renderInventory,
  });
}

export const LEDGER_LAYOUT_SECRET = createLedgerLayout({
  rowHeight: 104,
  banner: false,
  portraitSize: 0,
  iconSize: 72,
  alternating: false,
});

export const LEDGER_LAYOUT_IMPERIAL = createLedgerLayout({
  rowHeight: 120,
  banner: true,
  portraitSize: 320,
  iconSize: 96,
  alternating: true,
});
