// Shared substrate for the five gallery layout engines. It owns only:
//  - VM selection (the sections[1] hub/status projection),
//  - interaction semantics identical to production (drill/tab/navigation),
//  - the standard/drawer outer chrome,
//  - the shared tabs + actions composites,
//  - a few figure primitives (portrait/banner/category tag).
// Geometry and arrangement stay with each engine. Gallery-only: imported by
// layout engine modules, never by the production renderer.
import { BlockInputEvents, Color, Graphics, Label, Node, Size, UITransform, Vec3 } from 'cc';
import type { GameViewModel, StatusMetric } from '@infinite-flow/presentation';
import {
  legacyGalleryFrameGeometry,
  legacyGalleryRenderChrome,
  type InfiniteFlowInfoSheetOptions,
  type MobilePanelKind,
  type MobileSheetState,
} from '../InfiniteFlowInfoSheet';
import { sheetRoleCut, type SheetPalette, type SheetTheme } from '../sheet-theme';
import {
  SHEET_DUNGEON_BANNER_KEY,
  SHEET_GAP,
  SHEET_PORTRAIT_KEY,
  SHEET_SCENE_BANNER_KEY,
  SHEET_TOUCH,
  sheetEquipmentKey,
  sheetItemKey,
  type SheetKit,
  type SheetTabSurface,
  type SheetTarget,
} from '../sheet-kit';
import {
  type SheetChromeInput,
  type SheetFrameGeometry,
  type SheetLayout,
  type SheetLayoutChrome,
} from '../sheet-layout';
import { itemCategoryLabel } from './sheet-layout-labels';

export { SHEET_DUNGEON_BANNER_KEY, SHEET_GAP, SHEET_PORTRAIT_KEY, SHEET_SCENE_BANNER_KEY, SHEET_TOUCH };
export { sheetEquipmentKey, sheetItemKey };

type Loadout = NonNullable<GameViewModel['sections'][1]['loadout']>;
type EquipEntry = Loadout['equipment'][number];
type ItemEntry = Loadout['items'][number];

// --- VM selection ----------------------------------------------------------

export function characterLoadout(kit: SheetKit): Loadout | undefined {
  return kit.context.model.sections[1].loadout ?? undefined;
}

export function characterMetrics(kit: SheetKit): readonly StatusMetric[] {
  return kit.context.model.sections[1].metrics;
}

/** The metric ids production hides from the scrolling grid per phase. */
export function restCharacterMetrics(kit: SheetKit): readonly StatusMetric[] {
  const phase = kit.context.model.phase;
  const hidden = phase === 'hub'
    ? new Set(['hp', 'power'])
    : phase === 'combat'
      ? new Set(['player-hp', 'attack'])
      : new Set(['hp']);
  return characterMetrics(kit).filter((metric) => !hidden.has(metric.id));
}

export interface CharacterKpi {
  readonly name: string;
  readonly label: string;
  readonly value: string;
  readonly metric?: StatusMetric;
  readonly accent: Color;
}

/** The four production head cards (power/hp/attack/defense). */
export function characterKpis(kit: SheetKit): readonly CharacterKpi[] {
  const loadout = characterLoadout(kit);
  if (!loadout) return [];
  const metrics = characterMetrics(kit);
  const hpMetric = metrics.find((metric) => metric.id === 'hp' || metric.id === 'player-hp');
  const attackMetric = metrics.find((metric) => metric.id === 'attack');
  return [
    { name: 'MobileSheetKpi:power', label: '战力', value: String(loadout.power), accent: kit.palette.danger },
    { name: 'MobileSheetMetric:hp', label: '生命', value: `${loadout.hp}/${loadout.maxHp}`, metric: hpMetric, accent: kit.metricColor(hpMetric) },
    { name: 'MobileSheetKpi:attack', label: '攻击/术强', value: `${loadout.attack}/${loadout.artPower}`, metric: attackMetric, accent: kit.metricColor(attackMetric) },
    { name: 'MobileSheetKpi:defense', label: '防御', value: String(loadout.defense), accent: kit.palette.text },
  ];
}

export function loadoutItems(kit: SheetKit): readonly ItemEntry[] {
  return characterLoadout(kit)?.items ?? [];
}

// --- interaction semantics (must stay identical to production) -------------

function setState(kit: SheetKit, next: MobileSheetState): void {
  kit.context.options.setState(next);
}

/** Equipment slots only drill into the inventory actions list while in the hub. */
export function bindEquipSlot(kit: SheetKit, node: Node): void {
  if (kit.context.model.phase === 'hub') {
    kit.context.options.bindLocal(node, () => setState(kit, { kind: 'inventory', tab: 'actions', page: 0 }));
  }
}

export function bindMetricCard(kit: SheetKit, node: Node, metric: StatusMetric): void {
  kit.context.options.bindLocal(node, () =>
    setState(kit, { ...kit.context.state, tab: 'metric', selectedActionId: metric.id, page: 0 }));
}

export function bindItemCell(kit: SheetKit, node: Node): void {
  kit.context.options.bindLocal(node, () => setState(kit, { kind: 'inventory', tab: 'actions', page: 0 }));
}

export interface MenuDestination {
  readonly kind: MobilePanelKind | 'actions' | 'close';
  readonly label: string;
  readonly iconKind: string;
  readonly danger: boolean;
}

/** The production nine-tile menu, in production order. */
export function menuDestinations(kit: SheetKit): readonly MenuDestination[] {
  const combat = kit.context.model.phase === 'combat';
  return [
    { kind: 'character', label: '角色', iconKind: 'character', danger: false },
    { kind: 'inventory', label: '背包', iconKind: 'inventory', danger: false },
    { kind: 'map', label: '地图', iconKind: 'map', danger: false },
    { kind: 'objectives', label: '目标', iconKind: 'objectives', danger: false },
    { kind: 'log', label: '记录', iconKind: 'log', danger: false },
    { kind: 'help', label: '帮助', iconKind: 'help', danger: false },
    { kind: 'entry', label: '轮回之门', iconKind: 'entry', danger: false },
    { kind: 'actions', label: combat ? '战斗行动' : '进阶行动', iconKind: 'menu', danger: true },
    { kind: 'close', label: '收起', iconKind: 'close', danger: false },
  ];
}

export function bindMenuDestination(kit: SheetKit, node: Node, destination: MenuDestination): void {
  if (destination.kind === 'close') {
    kit.context.options.bindLocal(node, () => kit.context.options.close());
  } else if (destination.kind === 'actions') {
    kit.context.options.bindLocal(node, () => setState(kit, { kind: 'menu', tab: 'actions', page: 0 }));
  } else {
    const kind = destination.kind as MobilePanelKind;
    kit.context.options.bindLocal(node, () => setState(kit, { kind, page: 0 }));
  }
}

// --- shared tabs + actions composites --------------------------------------

export interface MenuTabs {
  readonly surface: SheetTabSurface;
  readonly active: 'shortcuts' | 'actions';
}

export function menuTabs(kit: SheetKit, target: SheetTarget): MenuTabs {
  const surface = kit.tabs(target, [
    { id: 'shortcuts', title: '随身功能' },
    { id: 'actions', title: kit.context.model.phase === 'combat' ? '战斗行动' : '进阶行动' },
  ], 'shortcuts');
  return { surface, active: surface.active === 'actions' ? 'actions' : 'shortcuts' };
}

export interface InventoryTabs {
  readonly surface: SheetTabSurface;
  readonly active: 'overview' | 'actions';
}

export function inventoryTabs(kit: SheetKit, target: SheetTarget): InventoryTabs {
  const second = kit.context.model.sections[1].detail.kind === 'hub' ? '物资 / 装备' : '可用道具';
  const surface = kit.tabs(target, [
    { id: 'overview', title: '持有与效果' },
    { id: 'actions', title: second },
  ], 'overview');
  return { surface, active: surface.active === 'actions' ? 'actions' : 'overview' };
}

/** X coordinate of the left-anchored i-th item in a horizontal strip content. */
export function stripItemX(contentWidth: number, cursor: number, itemWidth: number): number {
  return -contentWidth / 2 + cursor + itemWidth / 2;
}

export function runActionList(kit: SheetKit, surface: SheetTarget, kind: MobilePanelKind): void {  kit.renderActions(surface, kit.panelActions(kind));
}

/**
 * Engines without the shared tab strip (drawer/ledger) still have to honor
 * `state.tab === 'actions'`: render the real action list under a 104px return
 * tab named exactly like the production tab it replaces. Returns true when it
 * drew the actions page.
 */
export function renderActionsWithReturn(
  kit: SheetKit,
  target: SheetTarget,
  kind: MobilePanelKind,
  returnTab: 'shortcuts' | 'overview',
  returnLabel: string,
): boolean {
  if (kit.context.state.tab !== 'actions') return false;
  kit.button(target.body, `MobileSheetTab:${returnTab}`, returnLabel,
    0, target.bodyHeight / 2 - SHEET_TOUCH / 2, target.width, true,
    () => kit.context.options.setState({ kind, page: 0 }));
  const surfaceBody = kit.node(target.body, 'MobileSheetTabBody', 0,
    -(SHEET_TOUCH + SHEET_GAP) / 2, target.width, target.bodyHeight - SHEET_TOUCH - SHEET_GAP);
  kit.renderActions(
    { body: surfaceBody, width: target.width, bodyHeight: target.bodyHeight - SHEET_TOUCH - SHEET_GAP },
    kit.panelActions(kind),
  );
  return true;
}

/** Renders the loadout-less readout; returns undefined when there is no loadout. */
export function guardLoadout(kit: SheetKit, target: SheetTarget): Loadout | undefined {
  const loadout = characterLoadout(kit);
  if (!loadout) {
    kit.drawScrollDoc(target, kit.inventoryPages());
    return undefined;
  }
  return loadout;
}

const FALLBACK_METRIC_CARD_HEIGHT = 172;

/**
 * Loadout-less character fallback: the complete metric set in a full-height
 * two-column scrolling grid (same cards production renders in that phase).
 * Every engine starts its character body with this when loadout is absent.
 */
export function renderFullMetricFallback(kit: SheetKit, target: SheetTarget): void {
  const metrics = characterMetrics(kit);
  if (metrics.length === 0) return;
  const rows = Math.ceil(metrics.length / 2);
  const contentHeight = 8 + rows * FALLBACK_METRIC_CARD_HEIGHT + (rows - 1) * SHEET_GAP + 8;
  const region = kit.scrollRegion(target, contentHeight);
  const columnWidth = (region.width - SHEET_GAP) / 2;
  metrics.forEach((metric, index) => {
    const col = index % 2;
    const gridRow = Math.floor(index / 2);
    const cursor = 8 + gridRow * (FALLBACK_METRIC_CARD_HEIGHT + SHEET_GAP);
    const x = -region.width / 2 + columnWidth / 2 + col * (columnWidth + SHEET_GAP);
    drawMetricCard(kit, region.content, metric, x,
      kit.scrollItemY(region, cursor, FALLBACK_METRIC_CARD_HEIGHT), columnWidth, FALLBACK_METRIC_CARD_HEIGHT);
  });
}

// --- ready-made semantic cards ---------------------------------------------

export function drawKpiCard(kit: SheetKit, parent: Node, kpi: CharacterKpi, x: number, y: number, width: number, height: number): Node {
  const card = kit.panel(parent, kpi.name, x, y, width, height, kit.palette.quiet,
    kpi.accent === kit.palette.danger ? kit.palette.dangerDark : kit.palette.edge);
  kit.text(card, 'KpiLabel', kpi.label, 0, height / 2 - 30, width - 12, 30, 21, kit.palette.textMuted, true);
  kit.text(card, 'KpiValue', kpi.value, 0, -16, width - 12, 44, 28, kpi.accent, true);
  if (kpi.metric) bindMetricCard(kit, card, kpi.metric);
  return card;
}

export function drawMetricCard(kit: SheetKit, parent: Node, metric: StatusMetric, x: number, y: number, width: number, height: number): Node {
  const accent = kit.metricColor(metric);
  const card = kit.panel(parent, `MobileSheetMetric:${metric.id}`, x, y, width, height, kit.palette.quiet,
    accent === kit.palette.danger ? kit.palette.dangerDark : kit.palette.edge);
  kit.text(card, 'MetricLabel', kit.readable(metric.label), 0, height / 2 - 30, width - 24, 34, 23, kit.palette.textMuted, true);
  kit.text(card, 'MetricValue', kit.readable(metric.value), 0, -8, width - 26, 64, 30, accent, true);
  bindMetricCard(kit, card, metric);
  return card;
}

/** Equipment slot with the production label stack; optional raster icon. */
export function drawEquipSlot(
  kit: SheetKit,
  parent: Node,
  entry: EquipEntry,
  x: number,
  y: number,
  width: number,
  height: number,
  options: { icon?: boolean; iconSize?: number } = {},
): Node {
  const slot = kit.panel(parent, `MobileSheetEquip:${entry.slot}`, x, y, width, height, kit.palette.raised, kit.palette.accent, false, 'cell');
  if (options.icon) {
    const size = options.iconSize ?? Math.min(84, height - 20);
    kit.figure(slot, 'SlotFigure', sheetEquipmentKey(entry.equipmentId), 0, 8, size, Math.min(size + 16, height - 28),
      { glyph: entry.name.charAt(entry.name.length - 1), glyphSize: 26, glyphColor: kit.palette.textMuted });
  }
  kit.text(slot, 'SlotLabel', entry.slotLabel, 0, height / 2 - 18, width - 12, 24, 19, kit.palette.textMuted, true);
  kit.text(slot, 'SlotName', entry.name, 0, options.icon ? -height / 2 + 22 : 0, width - 12, 40, 21, kit.palette.text, true);
  kit.text(slot, 'SlotLevel', `Lv.${entry.level}`, 0, -height / 2 + 18, width - 12, 24, 18, kit.palette.accent, true);
  bindEquipSlot(kit, slot);
  return slot;
}

/** Item glyph/portrait slot (the structural fallback is handled inside the kit). */
export function itemFigure(kit: SheetKit, parent: Node, item: ItemEntry, x: number, y: number, size: number, height = size): Node {
  const empty = item.count === 0 && !item.carried;
  return kit.figure(parent, 'ItemFigure', sheetItemKey(item.itemId), x, y, size, height,
    { glyph: item.name.charAt(item.name.length - 1), glyphSize: Math.round(size * 0.4), glyphColor: empty ? kit.palette.textMuted : kit.palette.text });
}

/** Item name/count label stack; `compact` shrinks the count onto one line. */
export function drawItemLabels(kit: SheetKit, parent: Node, item: ItemEntry, width: number, height: number, compact = false): void {
  const empty = item.count === 0 && !item.carried;
  kit.text(parent, 'ItemName', item.name, 0, compact ? height / 2 - 24 : 10, width - 16, compact ? 28 : 40, 21, empty ? kit.palette.textMuted : kit.palette.text, true);
  kit.text(parent, 'ItemCount', `×${item.count}`, 0, -height / 2 + 22, width - 16, 26, 18, item.count > 0 ? kit.palette.accent : kit.palette.textMuted, true);
}

/** Carried seal at a cell corner; uses the shared 18×18 seal primitive. */
export function itemSeal(kit: SheetKit, parent: Node, cellWidth: number, cellHeight: number): Node {
  return kit.seal(parent, 'ItemCarriedSeal', cellWidth / 2 - 18, cellHeight / 2 - 18, 18);
}

/** 96×32 category plate (战用/防护/门钥/捕伏); decorative, never a touch target. */
export function drawCategoryTag(kit: SheetKit, parent: Node, item: ItemEntry, x: number, y: number): Node {
  const tag = kit.panel(parent, `ItemCategory:${item.itemId}`, x, y, 96, 32, kit.palette.accentDark, kit.palette.accent, false, 'control');
  kit.text(tag, 'ItemCategoryLabel', itemCategoryLabel(item.category), 0, 0, 88, 26, 18, kit.palette.accent, true);
  return tag;
}

/** Full-width raster banner slot with a blank structural fallback. */
export function drawBanner(kit: SheetKit, parent: Node, name: string, imageKey: string, x: number, y: number, width: number, height: number): Node {
  return kit.figure(parent, name, imageKey, x, y, width, height, { glyph: '' });
}

/** The reincarnator portrait with the vector character glyph as fallback. */
export function drawPortrait(kit: SheetKit, parent: Node, name: string, x: number, y: number, width: number, height: number): Node {
  return kit.figure(parent, name, SHEET_PORTRAIT_KEY, x, y, width, height,
    { iconKind: 'character', glyphColor: kit.palette.accent });
}

// --- chrome + layout factory -----------------------------------------------

/** Standard 702×893 centered frame with production header/close/body. */
export function standardFrameGeometry(input: { safeInsets: InfiniteFlowInfoSheetOptions['safeInsets']; surfaceHeight: number }): SheetFrameGeometry {
  return legacyGalleryFrameGeometry(input.safeInsets, input.surfaceHeight);
}

export function standardChrome(input: SheetChromeInput): SheetLayoutChrome {
  return legacyGalleryRenderChrome(input);
}

/** Bottom-anchored 720×929 drawer frame geometry (E3). */
export function drawerFrameGeometry(input: { safeInsets: InfiniteFlowInfoSheetOptions['safeInsets']; surfaceHeight: number }): SheetFrameGeometry {
  return {
    centerX: (input.safeInsets.left - input.safeInsets.right) / 2,
    centerY: (input.safeInsets.bottom - input.safeInsets.top) / 2 - 30,
    width: 720,
    height: 929,
    bodyWidth: 676,
    bodyHeight: 753,
  };
}

const DRAWER_TITLES: Readonly<Record<MobilePanelKind, string>> = Object.freeze({
  character: '角色状态', inventory: '行囊与装备', map: '区域地图', objectives: '任务与章规',
  log: '冒险记录', menu: '随身菜单', interaction: '当前交互', entry: '轮回之门',
  npc: '整备交谈', help: '冒险指南', result: '本轮结算',
});

function place(parent: Node, name: string, x: number, y: number, width: number, height: number): Node {
  const child = new Node(name);
  child.layer = 1 << 25;
  parent.addChild(child);
  child.setPosition(new Vec3(x, y, 0));
  child.addComponent(UITransform).setContentSize(new Size(width, height));
  return child;
}

function drawThemedFrame(theme: SheetTheme, parent: Node, name: string, x: number, y: number, width: number, height: number, ornate: boolean): Node {
  const child = place(parent, name, x, y, width, height);
  const g = child.addComponent(Graphics);
  const palette = theme.palette;
  const role = ornate ? 'sheet' : 'iconButton';
  const cut = sheetRoleCut(theme.framePolicy.cut, role);
  theme.paintFrame(g, width, height, {
    role, fill: palette.surface, edge: palette.edgeStrong,
    accent: palette.edgeStrong, cut: ornate ? theme.framePolicy.cut.sheet : cut, ornate,
  });
  return child;
}

function paintThemedIcon(theme: SheetTheme, parent: Node, name: string, kind: string, x: number, y: number): Node {
  const holder = place(parent, name, x, y, 64, 64);
  const g = holder.addComponent(Graphics);
  g.strokeColor = theme.palette.accent;
  g.fillColor = theme.palette.accent;
  g.lineWidth = theme.iconPen.lineWidth;
  theme.paintIcon(g, kind, theme.palette.accent);
  return holder;
}

/**
 * Drawer chrome: a decorative 96×10 grip (no events), an 88px title row with
 * the semantic header icon/title/close nodes, and the 676×753 body.
 */
export function drawerChrome(input: SheetChromeInput): SheetLayoutChrome {
  const { root, state, options, geometry } = input;
  const theme = options.theme!;
  const { width, height, bodyWidth, bodyHeight } = geometry;
  const frame = drawThemedFrame(theme, root, `MobileInfoSheet:${state.kind}`, geometry.centerX, geometry.centerY, width, height, true);
  frame.addComponent(BlockInputEvents);

  // Decorative grip only — explicitly no touch binding.
  const grip = place(frame, 'SheetDrawerGrip', 0, height / 2 - 24, 96, 10);
  const gg = grip.addComponent(Graphics);
  gg.fillColor = theme.palette.edgeStrong;
  const cut = 5;
  gg.moveTo(-48 + cut, 5); gg.lineTo(48 - cut, 5); gg.lineTo(48, 0); gg.lineTo(48, -5);
  gg.lineTo(48 - cut, -5); gg.lineTo(-48 + cut, -5); gg.lineTo(-48, 0); gg.lineTo(-48, 5);
  gg.close(); gg.fill();

  const titleY = height / 2 - 88;
  paintThemedIcon(theme, frame, 'MobileSheetHeaderIcon', state.kind, -width / 2 + 56, titleY);
  const titleNode = place(frame, 'MobileSheetTitle', -12, titleY, width - 228, 84);
  const title = titleNode.addComponent(Label);
  title.string = DRAWER_TITLES[state.kind];
  title.fontSize = 34;
  title.lineHeight = 46;
  title.color = theme.palette.text;
  title.horizontalAlign = Label.HorizontalAlign.LEFT;
  title.verticalAlign = Label.VerticalAlign.CENTER;
  title.enableWrapText = true;
  title.overflow = Label.Overflow.SHRINK;

  const close = drawThemedFrame(theme, frame, 'MobileSheetClose', width / 2 - 70, titleY, SHEET_TOUCH, SHEET_TOUCH, false);
  paintThemedIcon(theme, close, 'CloseIcon', 'close', 0, 0);
  options.bindLocal(close, options.close);

  // The title row (top 88+grip) is chrome; the body starts below it.
  const body = place(frame, 'MobileSheetBody', 0, -24, bodyWidth, bodyHeight);
  return { frame, body, width: bodyWidth, bodyHeight };
}

export interface SheetEngineBodies {
  renderCharacter(kit: SheetKit): void;
  renderMenu(kit: SheetKit): void;
  renderInventory(kit: SheetKit): void;
}

export function defineSheetLayout(
  id: string,
  bodies: SheetEngineBodies,
  options: {
    frameGeometry?(input: { safeInsets: InfiniteFlowInfoSheetOptions['safeInsets']; surfaceHeight: number }): SheetFrameGeometry;
    renderChrome?(input: SheetChromeInput): SheetLayoutChrome;
  } = {},
): SheetLayout {
  return {
    id,
    frameGeometry: options.frameGeometry ?? standardFrameGeometry,
    renderChrome: options.renderChrome ?? standardChrome,
    renderCharacter: bodies.renderCharacter,
    renderMenu: bodies.renderMenu,
    renderInventory: bodies.renderInventory,
  };
}

export type { SheetFrameGeometry, SheetPalette };
