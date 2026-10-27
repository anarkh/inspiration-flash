import { BlockInputEvents, Color, Graphics, Label, Mask, Node, ScrollView, Size, Sprite, SpriteFrame, UITransform, Vec2, Vec3, view } from 'cc';
import { EQUIPMENT, ITEMS, getGameAsset, type ItemId } from '@infinite-flow/core';
import { INFINITE_FLOW_GAME_VERSION } from '@infinite-flow/presentation';
import type { ExploreDetailViewModel, GameViewModel, HelpEntryViewModel, HubPanel, HubOwnedLoadoutViewModel, HubShopCatalogViewModel, HubShopRowViewModel, MapNodeViewModel, RewardPreviewViewModel, StatusMetric, ViewActionModel } from '@infinite-flow/presentation';
import {
  buildInfiniteFlowChapterCodexPages,
  buildInfiniteFlowResultPages,
  formatInfiniteFlowCombatChapterContext,
  formatInfiniteFlowEquipmentHubDetail,
  formatInfiniteFlowEquipmentMemoryCombat,
  formatInfiniteFlowExploreEquipmentMemory,
  formatInfiniteFlowExploreResultActionLabel,
  formatInfiniteFlowExploreResultActionSummary,
  formatInfiniteFlowHubActionLabel,
  formatInfiniteFlowHubActionLockedReason,
  formatInfiniteFlowHubActionShortCopy,
  formatInfiniteFlowHubPlayerCopy,
  wrapInfiniteFlowLine,
} from './InfiniteFlowView';
import type { InfiniteFlowRuntimeChrome } from './InfiniteFlowView';
import {
  DEFAULT_SHEET_THEME,
  COMPACT_SHEET_THEME,
  sheetRoleCut,
  withAlpha,
  type SheetFrameRole,
  type SheetPalette,
  type SheetTheme,
  type SheetTypographyRole,
} from './sheet-theme';
import {
  BASELINE_LAYOUT_ID,
  type SheetChromeInput,
  type SheetLayout,
  type SheetLayoutChrome,
  type SheetLayoutFrameInput,
  type SheetFrameGeometry,
} from './sheet-layout';
import { EMPTY_SHEET_IMAGE_LIBRARY, SHEET_PORTRAIT_KEY, sheetEquipmentKey, sheetItemKey } from './sheet-kit';
import { getSheetFigures } from './sheet-figures';
import { getWalkHudLayout, getWalkHudStrips } from './hud-layout';
import { getInfiniteFlowRoomSheetArtKey, getInfiniteFlowRunRelicVisualKey, INFINITE_FLOW_TASK_ENVOY_PORTRAIT_KEY } from './scene-visuals';
import { DARK_UI, ROOM_SHEET, paintRoomSheetButton, paintRoomSheetFrame } from './dark-ui';
import type {
  MobileSheetPage,
  SheetFigureFallback,
  SheetImageLibrary,
  SheetKit,
  SheetPagerRegion,
  SheetScrollRegion,
  SheetStripRegion,
  SheetTabSurface,
  SheetTarget,
} from './sheet-kit';

export type MobilePanelKind = 'character' | 'inventory' | 'map' | 'objectives' | 'log' | 'menu' | 'interaction' | 'entry' | 'npc' | 'help' | 'result' | 'claims';
export type MobileSheetTip = Readonly<{
  kind: 'item' | 'equip';
  id: string;
  /** Anchor rect in frame coordinates (captured at tap time; optional). */
  anchor?: { x: number; y: number; w: number; h: number };
}>;
export type MobileSheetState = Readonly<{
  kind: MobilePanelKind;
  page: number;
  tab?: string;
  selectedActionId?: string;
  /** Pinned WoW-style GameTooltip; absent when closed. */
  tip?: MobileSheetTip;
  catalogRowId?: string;
  catalogSelectedRowId?: string;
  catalogMoreOpen?: boolean;
  catalogDetailScrollOffset?: number;
  catalogServiceOpen?: boolean;
  catalogExpandedIds?: readonly string[];
  catalogScrollOffset?: number;
  /** Optional settings overlay; chapter selection always remains on this sheet. */
  entrySettingsOpen?: boolean;
  /** The chapter whose test jump was armed by a first tap; a second tap jumps. */
  testJumpArmedChapter?: number;
  entryServiceId?: string;
  entryDungeonScrollOffset?: number;
  entrySettingsScrollOffset?: number;
  mapDungeonId?: string;
  /** Positive distances from the complete map's top-left corner. */
  mapScrollOffset?: Readonly<{ x: number; y: number }>;
  taskId?: string;
  taskScrollOffset?: number;
  carryScrollOffset?: number;
}>;
export type InfiniteFlowInfoSheetOptions = Readonly<{
  safeInsets: Readonly<{ top: number; right: number; bottom: number; left: number }>;
  /** Real visible fixed-width design surface height (>= 1334 on tall phones). */
  surfaceHeight: number;
  chrome: InfiniteFlowRuntimeChrome;
  bindLocal: (node: Node, callback: () => void) => void;
  bindAction: (node: Node, action: ViewActionModel) => void;
  close: () => void;
  setState: (next: MobileSheetState) => void;
  openHelp: (entry: HelpEntryViewModel) => void;
  /** Gallery-only sheet theme; production call sites omit it and render COMPACT. */
  theme?: SheetTheme;
  /** Gallery-only layout seam; production call sites omit it and render inline. */
  layout?: SheetLayout;
  /** Gallery-only best-effort raster figures; defaults to an empty library. */
  images?: SheetImageLibrary;
  /**
   * Production-only hub seam: returns the supplies-panel actions projected for
   * the current game state, so item tips can toggle carry even when the active
   * hub panel is not supplies. Gallery engines never supply it.
   */
  supplyActions?: (itemId: ItemId) => readonly ViewActionModel[];
  ownedLoadout?: () => HubOwnedLoadoutViewModel | undefined;
  /** Last successfully claimed reward in this room; absent after a fresh restore. */
  rewardReceipt?: RewardPreviewViewModel;
  /** CSS width of the fixed-width game surface, shared with the walk HUD. */
  viewportWidth?: number;
  /** Acquired HUD icons are loaded and leased by the active scene. */
  hudVisual?: (key: string) => Readonly<{ frame: SpriteFrame; width: number; height: number }> | undefined;
  trackHudSprite?: (sprite: Sprite) => void;
  /** Production-only hidden tester switch. */
  testMode?: boolean;
  toggleTestMode?: () => void;
}>;

// The existing 750px design space uses 104px controls to retain a 44px target
// at 320px viewport width. Shared iron-and-gold surfaces preserve that layout.
const TOUCH = 104;
const GAP = 16;

/**
 * The sheet renders synchronously, so a module-scoped active theme is safe:
 * every primitive below resolves colors/painters through it while one tree is
 * built. The ScrollView SCROLLING callback only repositions the thumb node.
 */
let activeTheme: SheetTheme = COMPACT_SHEET_THEME;
let activeCompact = true;
let activeUnit = 750 / 390;
const palette = (): SheetPalette => activeTheme.palette;
const TITLES: Readonly<Record<MobilePanelKind, string>> = Object.freeze({
  character: '角色信息', inventory: '行囊', map: '区域地图', objectives: '任务目标',
  log: '冒险记录', menu: '主菜单', interaction: '当前交互', entry: '轮回之门',
  npc: '整备交谈', help: '冒险指南', result: '本轮结算', claims: '主神任务',
});
type SheetPage = Readonly<{ title: string; lines: readonly string[]; helpId?: string }>;
type SheetContext = Readonly<{
  model: GameViewModel;
  state: MobileSheetState;
  options: InfiniteFlowInfoSheetOptions;
  panel: Node;
  body: Node;
  width: number;
  height: number;
  bodyHeight: number;
  images: SheetImageLibrary;
}>;

const catalogScrollByFrame = new WeakMap<Node, ScrollView>();
const catalogDetailScrollByFrame = new WeakMap<Node, ScrollView>();
const sheetScrollCaptures = new WeakMap<Node, Readonly<{ state: MobileSheetState; scroll: ScrollView; detailScroll?: ScrollView }>>();
type MapScrollCapture = Readonly<{ dungeonId: string; scroll: ScrollView }>;
const mapScrollByFrame = new WeakMap<Node, MapScrollCapture>();
const mapScrollCaptures = new WeakMap<Node, MapScrollCapture>();
type EntryScrollCapture = Readonly<{ state: MobileSheetState; dungeons: ScrollView; settings?: ScrollView }>;
const entryScrollByFrame = new WeakMap<Node, EntryScrollCapture>();
const entryScrollCaptures = new WeakMap<Node, EntryScrollCapture>();

/** Capture before the host replaces its Cocos tree, including command/asset refreshes. */
export function captureInfiniteFlowInfoSheetState(root: Node | undefined, state: MobileSheetState): MobileSheetState {
  if (state.kind === 'entry') {
    const saved = root === undefined ? undefined : entryScrollCaptures.get(root);
    if (!saved) return state;
    return { ...state, entryDungeonScrollOffset: Math.max(0, saved.dungeons.getScrollOffset().y),
      entrySettingsScrollOffset: saved.settings && saved.state.entrySettingsOpen === state.entrySettingsOpen
        && saved.state.entryServiceId === state.entryServiceId
        ? Math.max(0, saved.settings.getScrollOffset().y) : state.entrySettingsScrollOffset };
  }
  if (state.kind === 'map') {
    const savedMap = root === undefined ? undefined : mapScrollCaptures.get(root);
    if (!savedMap || (state.mapDungeonId !== undefined && state.mapDungeonId !== savedMap.dungeonId)) return state;
    const offset = savedMap.scroll.getScrollOffset();
    // Cocos reports content displacement (negative x), but scrollToOffset accepts positive distances.
    return { ...state, mapDungeonId: savedMap.dungeonId,
      mapScrollOffset: { x: Math.max(0, -offset.x), y: Math.max(0, offset.y) } };
  }
  const saved = root === undefined ? undefined : sheetScrollCaptures.get(root);
  if (!saved || saved.state.kind !== state.kind || saved.state.tab !== state.tab
    || saved.state.entryServiceId !== state.entryServiceId) return state;
  if (state.kind === 'objectives') {
    if (saved.state.taskId !== state.taskId) return state;
    return { ...state, taskScrollOffset: Math.max(0, saved.scroll.getScrollOffset().y) };
  }
  if (state.kind === 'character' && state.tab === 'carry') {
    return { ...state, carryScrollOffset: Math.max(0, saved.scroll.getScrollOffset().y) };
  }
  const sameDetail = saved.state.catalogRowId === state.catalogRowId
    && saved.state.catalogServiceOpen === state.catalogServiceOpen
    && saved.state.selectedActionId === state.selectedActionId;
  return { ...state, catalogScrollOffset: Math.max(0, saved.scroll.getScrollOffset().y),
    catalogDetailScrollOffset: sameDetail && saved.detailScroll
      ? Math.max(0, saved.detailScroll.getScrollOffset().y) : undefined };
}

function node(parent: Node, name: string, x: number, y: number, width: number, height: number): Node {
  const child = new Node(name);
  child.layer = 1 << 25;
  parent.addChild(child);
  child.setPosition(new Vec3(x, y, 0));
  child.addComponent(UITransform).setContentSize(new Size(width, height));
  return child;
}

function panel(parent: Node, name: string, x: number, y: number, width: number, height: number, fill = palette().raised, stroke = palette().edge, ornate = false, role: SheetFrameRole = 'card'): Node {
  const child = node(parent, name, x, y, width, height);
  const g = child.addComponent(Graphics);
  const cut = sheetRoleCut(activeTheme.framePolicy.cut, role);
  activeTheme.paintFrame(g, width, height, {
    role, fill, edge: stroke, accent: ornate ? palette().accent : stroke,
    cut: ornate ? activeTheme.framePolicy.cut.sheet : cut, ornate,
  });
  return child;
}

/** Infer the typography role from the existing size argument so call sites stay unchanged. */
function typeRole(size: number, centered: boolean): SheetTypographyRole {
  if (size >= 32) return 'title';
  if (size >= 27) return 'section';
  if (size <= 20) return 'micro';
  if (centered && size >= 28) return 'value';
  return 'body';
}

function text(parent: Node, name: string, value: string, x: number, y: number, width: number, height: number, size = 28, color = palette().text, centered = false): void {
  const label = node(parent, name, x, y, width, height).addComponent(Label);
  const effectiveSize = Math.round(activeCompact
    ? Math.min(17 * activeUnit, size >= 32 ? 16 * activeUnit : size >= 27 ? 13 * activeUnit : size <= 20 ? 10 * activeUnit : 12 * activeUnit)
    : size * activeTheme.typeScale[typeRole(size, centered)]);
  label.string = value;
  label.fontSize = effectiveSize;
  label.lineHeight = Math.ceil(effectiveSize * 1.35);
  label.color = color;
  label.horizontalAlign = centered ? Label.HorizontalAlign.CENTER : Label.HorizontalAlign.LEFT;
  label.verticalAlign = Label.VerticalAlign.CENTER;
  label.enableWrapText = true;
  label.overflow = Label.Overflow.SHRINK;
}

function line(g: Graphics, coordinates: readonly number[]): void {
  if (coordinates.length < 4) return;
  g.moveTo(coordinates[0]!, coordinates[1]!);
  for (let i = 2; i < coordinates.length; i += 2) g.lineTo(coordinates[i]!, coordinates[i + 1]!);
  g.stroke();
}

/** Vector icons remain legible without platform emoji or symbol font support. */
function icon(parent: Node, name: string, kind: string, x: number, y: number, color = palette().accent, size = 64): Node {
  const holder = node(parent, name, x, y, size, size);
  const g = holder.addComponent(Graphics);
  g.strokeColor = color;
  g.fillColor = color;
  g.lineWidth = activeTheme.iconPen.lineWidth;
  activeTheme.paintIcon(g, kind, color);
  return holder;
}

function button(parent: Node, name: string, label: string, x: number, y: number, width: number, enabled: boolean, activate: (() => void) | undefined, options: InfiniteFlowInfoSheetOptions, color = palette().textMuted): Node {
  const colors = palette();
  const fill = !enabled ? colors.quiet : color === colors.danger ? colors.dangerDark : color === colors.accent ? colors.accentDark : colors.raised;
  const edge = !enabled ? colors.edge : color === colors.danger ? colors.danger : color === colors.accent ? colors.accent : colors.edgeStrong;
  const actualWidth = activeCompact ? Math.min(width, 148 * activeUnit) : width;
  const targetHeight = activeCompact ? 44 * activeUnit : TOUCH;
  const result = activeCompact ? node(parent, name, x, y, actualWidth, targetHeight)
    : panel(parent, name, x, y, actualWidth, targetHeight, fill, edge, false, 'control');
  if (activeCompact) panel(result, 'ButtonVisual', 0, 0, actualWidth, 32 * activeUnit, fill, edge, false, 'control');
  text(result, 'Label', label, 0, 0, actualWidth - (activeCompact ? 16 * activeUnit : 20),
    activeCompact ? 26 * activeUnit : 78, activeCompact ? 13 * activeUnit : 27, enabled ? colors.text : colors.textMuted, true);
  if (activeCompact) {
    const labelComponent = result.getChildByName('Label')!.getComponent(Label)!;
    labelComponent.fontSize = Math.round(13 * activeUnit);
    labelComponent.lineHeight = Math.ceil(18 * activeUnit);
  }
  if (enabled && activate !== undefined) options.bindLocal(result, activate);
  return result;
}

function clampPage(page: number, count: number): number {
  return Math.max(0, Math.min(Number.isFinite(page) ? Math.floor(page) : 0, Math.max(0, count - 1)));
}

function pager(context: SheetContext, count: number): number {
  const index = clampPage(context.state.page, count);
  const y = -context.height / 2 + 72;
  const width = Math.min(190, (context.width - 184) / 2);
  const x = context.width / 2 - width / 2;
  button(context.panel, 'MobileSheetPrevious', '上一页', -x, y, width, index > 0, () => context.options.setState({ ...context.state, page: index - 1 }), context.options);
  button(context.panel, 'MobileSheetNext', '下一页', x, y, width, index + 1 < count, () => context.options.setState({ ...context.state, page: index + 1 }), context.options);
  text(context.panel, 'MobileSheetPageCount', `${index + 1} / ${Math.max(1, count)}`, 0, y, 148, 60, 26, palette().textMuted, true);
  return index;
}

function tabs(context: SheetContext, choices: readonly Readonly<{ id: string; title: string }>[], fallback: string): Readonly<{ context: SheetContext; active: string }> {
  const active = choices.some(({ id }) => id === context.state.tab) ? context.state.tab! : fallback;
  const u = catalogUnit(context);
  const hitHeight = activeCompact ? 44 * u : TOUCH;
  // Many tabs tighten the gap; when even that leaves a tab under the 44px touch floor, the strip wraps into balanced rows.
  const gap = activeCompact ? (choices.length > 4 ? 2 : 7) * u : GAP;
  const maxColumns = Math.max(1, Math.floor((context.width + gap) / (hitHeight + gap)));
  const rows = Math.ceil(choices.length / Math.min(maxColumns, choices.length));
  const columns = Math.ceil(choices.length / rows);
  const width = (context.width - gap * (columns - 1)) / columns;
  // The touch floor stays 104 design px (44 physical px at the 320px viewport),
  // but the plate is transparent: the visible tab is a compact 60px visual
  // pinned to its top edge so the strip reads as a WoW tab row, not buttons.
  const TAB_VISUAL_H = activeCompact ? 36 * u : 60;
  for (let index = 0; index < choices.length; index += 1) {
    const choice = choices[index]!;
    const tabRole: SheetFrameRole = choice.id === active ? 'tabActive' : 'tabIdle';
    const row = Math.floor(index / columns);
    const column = index % columns;
    const child = panel(context.body, `MobileSheetTab:${choice.id}`, -context.width / 2 + width / 2 + column * (width + gap),
      context.bodyHeight / 2 - hitHeight / 2 - row * (hitHeight + gap), width, hitHeight, withAlpha(palette().surface, 0), withAlpha(palette().surface, 0), false, tabRole);
    const tabVisual = panel(child, 'TabVisual', 0, 0, width, TAB_VISUAL_H, choice.id === active ? palette().accentDark : palette().quiet, choice.id === active ? palette().accent : palette().edge, false, tabRole);
    if (activeCompact) catalogText(context, tabVisual, 'Label', choice.title, 0, 0, width - 10 * u, 24 * u, 11, choice.id === active ? palette().accent : palette().text, true);
    else text(tabVisual, 'Label', choice.title, 0, 0, width - 16, 40, 26, choice.id === active ? palette().accent : palette().text, true);
    context.options.bindLocal(child, () => context.options.setState({ kind: context.state.kind, page: 0, tab: choice.id }));
  }
  const stripHeight = rows * (hitHeight + gap);
  const bodyHeight = context.bodyHeight - stripHeight;
  const body = node(context.body, 'MobileSheetTabBody', 0, -stripHeight / 2, context.width, bodyHeight);
  return { context: { ...context, body, bodyHeight }, active };
}

function readable(value: string | undefined, fallback = ''): string {
  return formatInfiniteFlowHubPlayerCopy(value, fallback);
}

type ScrollRegion = Readonly<{
  /** Parent that visually replaces context.body while a list is scrolled. */
  holder: Node;
  /** Vertical list space; lay items out top-down starting at scrollContentHeight/2. */
  width: number;
  height: number;
  contentHeight: number;
  scrollView: ScrollView;
}>;

/**
 * Regular display content scrolls instead of paging. The region is a native
 * ScrollView (vertical only, momentum + bounce) clipped by a Mask; the custom
 * scrollbar reflects the real scroll offset in the gold seal language.
 */
function scrollRegion(context: SheetContext, contentHeight: number, reserve = 0, top?: number): ScrollRegion {
  const availableHeight = top === undefined ? context.bodyHeight - reserve : top + context.bodyHeight / 2 - (activeCompact ? 8 * activeUnit : 24);
  const viewHeight = activeCompact ? Math.max(activeUnit, Math.min(300 * activeUnit, availableHeight)) : Math.max(120, availableHeight);
  // Keep the scroll viewport flush with the content's top; footer space stays fixed.
  const centerY = top === undefined ? activeCompact ? context.bodyHeight / 2 - viewHeight / 2 : reserve / 2 : top - viewHeight / 2;
  const holder = node(context.body, 'MobileSheetScroll', 0, centerY, context.width, viewHeight);
  holder.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
  // Cocos aligns scrolling from the view's top edge; with a centered anchor the
  // content starts at y=(viewHeight-contentHeight)/2 so its top is flush.
  const content = node(holder, 'MobileSheetScrollContent', 0, (viewHeight - Math.max(viewHeight, contentHeight)) / 2, context.width, Math.max(viewHeight, contentHeight));
  const scrollView = holder.addComponent(ScrollView);
  scrollView.content = content;
  scrollView.horizontal = false;
  scrollView.vertical = true;
  scrollView.inertia = true;
  scrollView.brake = 0.75;
  scrollView.elastic = true;
  scrollView.cancelInnerEvents = true;
  let thumb: Node | undefined;
  let thumbHeight = 0;
  if (contentHeight > viewHeight) {
    const thumbSpec = activeTheme.thumb;
    const barWidth = activeCompact ? 4 : thumbSpec.width;
    thumbHeight = Math.min(viewHeight - 4, Math.max(activeCompact ? 24 * activeUnit : 72, Math.round(viewHeight * viewHeight / contentHeight)));
    const travel = viewHeight - thumbHeight - 4;
    thumb = node(holder, 'MobileSheetScrollThumb', context.width / 2 - barWidth, viewHeight / 2 - 2 - thumbHeight / 2, barWidth, thumbHeight);
    const g = thumb.addComponent(Graphics);
    g.fillColor = new Color(thumbSpec.color.r, thumbSpec.color.g, thumbSpec.color.b, thumbSpec.alpha);
    g.roundRect(-barWidth / 2, -thumbHeight / 2, barWidth, thumbHeight, thumbSpec.radius);
    g.fill();
    scrollView.node.on(ScrollView.EventType.SCROLLING, () => {
      if (!thumb) return;
      const maxOffset = Math.max(1, contentHeight - viewHeight);
      const ratio = Math.max(0, Math.min(1, scrollView.getScrollOffset().y / maxOffset));
      thumb.setPosition(new Vec3(context.width / 2 - barWidth, viewHeight / 2 - 2 - thumbHeight / 2 - ratio * travel, 0));
    });
  }
  return { holder, width: context.width, height: viewHeight, contentHeight: Math.max(viewHeight, contentHeight), scrollView };
}

/** Scroll item coordinate: top-anchored y for an item of `itemHeight` with GAP above it. */
function scrollItemY(region: ScrollRegion, cursor: number, itemHeight: number): number {
  return region.contentHeight / 2 - cursor - itemHeight / 2;
}

function scrollContentNode(region: ScrollRegion): Node {
  return region.holder.getChildByName('MobileSheetScrollContent')!;
}

type DocSection = Readonly<{ title: string; lines: readonly string[]; helpId?: string }>;

/** Wrap every logical line once; the scroll document is no longer sliced into fixed pages. */
function wrapDocSection(context: Pick<SheetContext, 'width'>, section: DocSection): DocSection {
  const maxUnits = activeCompact
    ? Math.max(8, Math.floor((context.width / activeUnit - 16) / 12))
    : Math.max(8, Math.floor((context.width - 72) / 28));
  const lines = section.lines.map((entry) => readable(entry)).flatMap((entry) => {
    if (entry.length === 0) return [''];
    return entry.split('\n').flatMap((logical) => wrapInfiniteFlowLine(logical, maxUnits));
  });
  return { ...section, lines: lines.length === 0 ? ['暂无记录。'] : lines };
}

function docCardHeight(section: DocSection): number {
  return activeCompact ? (30 + section.lines.length * 20 + 8) * activeUnit : 104 + section.lines.length * 38 + 18;
}

/** Lay all logical sections out as cut-corner cards in one vertical scroll document. */
function drawScrollDoc(context: SheetContext, logical: readonly SheetPage[], reserve: number): void {
  const sections = (logical.length === 0 ? [{ title: '当前信息', lines: ['暂无可显示内容。'] }] : logical).map((section) => wrapDocSection(context, section));
  const u = catalogUnit(context), gap = activeCompact ? 9 * u : GAP;
  const inset = activeCompact ? 4 * u : 8;
  const contentHeight = sections.reduce((sum, section) => sum + docCardHeight(section) + gap, inset) - gap + inset;
  const region = scrollRegion(context, contentHeight, reserve);
  const content = scrollContentNode(region);
  let cursor = inset;
  sections.forEach((section) => {
    const cardHeight = docCardHeight(section);
    const card = activeCompact ? node(content, 'MobileSheetReadout', 0, scrollItemY(region, cursor, cardHeight), region.width, cardHeight)
      : panel(content, 'MobileSheetReadout', 0, scrollItemY(region, cursor, cardHeight), region.width, cardHeight, palette().quiet, palette().edge);
    if (activeCompact) {
      catalogText(context, card, 'ReadoutTitle', readable(section.title), 0, cardHeight / 2 - 12 * u, region.width - 16 * u, 20 * u, 11, palette().accent);
      catalogRule(card, 'ReadoutRule', cardHeight / 2 - 26 * u, region.width - 16 * u);
      section.lines.forEach((entry, index) => catalogText(context, card, `ReadoutLine:${index}`, entry, 0, cardHeight / 2 - (40 + index * 20) * u, region.width - 16 * u, 20 * u, 12));
    } else {
      text(card, 'ReadoutTitle', readable(section.title), 0, cardHeight / 2 - 39, region.width - 64, 50, 29, palette().accent);
      section.lines.forEach((entry, index) => text(card, `ReadoutLine:${index}`, entry, 0, cardHeight / 2 - 97 - index * 38, region.width - 64, 38, 28));
    }
    cursor += cardHeight + gap;
  });
}

function renderTextPages(context: SheetContext, logical: readonly SheetPage[]): void {
  const hasHelp = logical.some((page) => page.helpId !== undefined);
  const reserve = hasHelp ? TOUCH + GAP : 0;
  drawScrollDoc(context, logical, reserve);
  // One fixed footer rule entry for the first rule-linked section; the copy itself scrolls.
  const helpId = logical.find((page) => page.helpId !== undefined)?.helpId;
  const help = helpId === undefined ? undefined : context.model.sections[4].entries.find((entry) => entry.id === helpId);
  if (help !== undefined) button(context.body, 'MobileSheetRelatedHelp', '查看完整规则', 0, -context.bodyHeight / 2 + TOUCH / 2, context.width, true, () => context.options.openHelp(help), context.options);
}

const HUB_COMMANDS: Readonly<Record<HubPanel, readonly string[]>> = Object.freeze({
  entry: ['hub/configure-relic'],
  supplies: ['hub/buy-item', 'hub/configure-tactical-loadout', 'hub/recover', 'hub/exchange-lingyun'],
  equipment: ['hub/buy-equipment', 'hub/equip-equipment', 'hub/upgrade-equipment', 'hub/attune-equipment', 'hub/temper-equipment', 'hub/activate-equipment-memory', 'hub/start-equipment-commission', 'hub/recall-equipment-commission', 'hub/reforge-material'],
  pets: ['hub/buy-pet', 'hub/upgrade-pet', 'hub/activate-pet'],
  methods: ['hub/learn-method', 'hub/upgrade-method', 'hub/activate-method'],
  bloodlines: ['hub/unlock-bloodline', 'hub/upgrade-bloodline', 'hub/activate-bloodline'],
  companions: ['hub/recruit-companion', 'hub/upgrade-companion', 'hub/activate-companion'],
  tasks: ['hub/claim-task'],
});
const NODE_COMMANDS: readonly string[] = Object.freeze([
  'node/handle-trap', 'node/use-portal', 'node/collect-reward', 'node/resolve-event',
  'node/resolve-field-survey', 'node/resolve-equipment-loot', 'node/resolve-relic-draft',
  'node/activate-soul-recharge', 'node/resolve-soul-recharge', 'node/cancel-soul-recharge',
  'law/resolve-causal-ledger', 'law/resolve-entropy-heading', 'law/resolve-mirror-city-phase',
  'law/resolve-redaction-clause', 'law/resolve-auction-lot', 'law/resolve-genesis-splice',
  'law/resolve-broadcast-relay', 'law/resolve-escort-checkpoint', 'law/resolve-verdict',
  'law/select-combat-replay-route', 'law/select-panopticon-route', 'run/resolve-exit',
]);

function hubPanelAction(action: ViewActionModel, activePanel: HubPanel): boolean {
  if (action.placement !== 'preparation' && action.placement !== 'primary') return false;
  if (action.event?.kind === 'command') return HUB_COMMANDS[activePanel].includes(action.event.command.type);
  if (action.event?.kind === 'local') {
    const local = action.event.action;
    if (local.type === 'hub/select-catalog-entry') return local.panel === activePanel;
    if (local.type === 'hub/set-equipment-commission-draft') return activePanel === 'equipment';
    return activePanel === 'entry' && [
      'entry/select-dungeon', 'entry/select-protocol', 'entry/set-inferno-tier',
      'entry/select-route-contract', 'entry/select-relic-seed', 'entry/request-enter',
    ].includes(local.type);
  }
  // Disabled VM actions deliberately omit events; retain their real scoped IDs
  // solely for explanation, never to synthesize a command.
  return action.actionId.startsWith(`hub.${activePanel}.`)
    || (activePanel === 'supplies' && (action.actionId.startsWith('hub.loadout.') || action.actionId === 'hub.recover'))
    || (activePanel === 'entry' && action.actionId.startsWith('hub.relic-frame:'));
}

/** Original action references, filtered by their actual placement and event. */
export function getInfiniteFlowMobilePanelActions(model: GameViewModel, kind: MobilePanelKind): readonly ViewActionModel[] {
  const detail = model.sections[1].detail;
  const actions = model.sections[2].actions;
  if (kind === 'map' || kind === 'character' || kind === 'objectives' || kind === 'log' || kind === 'help') return [];
  if (kind === 'interaction') {
    if (detail.kind !== 'explore') return [];
    return actions.filter((action) => action.placement === 'node'
      && (detail.pending !== undefined && detail.pending.kind !== 'dungeon-event' ? detail.pending.actionIds.includes(action.actionId) : true)
      && (action.event === undefined || (action.event.kind === 'command' && (
        action.event.command.type === 'run/select-node'
          ? action.event.command.nodeId === detail.currentNode.nodeId
          : NODE_COMMANDS.includes(action.event.command.type)
      ))));
  }
  if (kind === 'result') return detail.kind === 'result' ? actions.filter((action) => action.placement === 'result' && (action.event === undefined || (action.event.kind === 'command' && ['result/archive-relic', 'result/return-hub'].includes(action.event.command.type)))) : [];
  if (kind === 'menu') return actions.filter((action) => (
    detail.kind === 'combat' && action.placement === 'combat' && (action.event === undefined
      || (action.event.kind === 'command' && ['combat/act', 'combat/capture'].includes(action.event.command.type)))
  ) || (action.placement === 'advanced' && (
    action.event === undefined
      || (action.event.kind === 'local' && action.event.action.type === 'combat/set-advanced-expanded')
      || (action.event.kind === 'command' && ['run/retreat', 'node/use-soul-skill', 'combat/use-method-technique'].includes(action.event.command.type))
  )));
  if (kind === 'inventory' && detail.kind === 'combat') return actions.filter((action) => action.placement === 'combat' && (action.event?.kind === 'command' && action.event.command.type === 'combat/act'
    ? ['use_healing_pill', 'use_thunder_talisman'].includes(action.event.command.action)
    : action.event === undefined && (action.combatAction === 'use_healing_pill' || action.combatAction === 'use_thunder_talisman')));
  if (detail.kind !== 'hub') return [];
  if (kind === 'entry') return detail.activePanel === 'entry'
    ? [...(detail.entryServices?.flatMap((service) => service.options.map((option) => option.action)) ?? []),
      ...actions.filter((action) => action.actionId === 'hub.entry.confirm')]
    : actions.filter((action) => action.placement === 'preparation' && action.event?.kind === 'local' && action.event.action.type === 'hub/select-panel' && action.event.action.panel === 'entry');
  if (kind === 'npc') return detail.shop ? [...detail.shop.rows.flatMap((row) => row.actions), ...detail.shop.services] : [];
  if (kind === 'claims') return detail.taskClaims ? [detail.taskClaims.action] : [];
  if (kind === 'inventory') return actions.filter((action) => {
    if (action.placement === 'preparation' && action.event?.kind === 'local' && action.event.action.type === 'hub/select-panel') return action.event.action.panel === 'supplies' || action.event.action.panel === 'equipment';
    return (detail.activePanel === 'supplies' || detail.activePanel === 'equipment') && hubPanelAction(action, detail.activePanel);
  });
  return [];
}

export type CombatChoiceGroup = 'spells' | 'medicines';

/** Preserve the projected commands and their availability in combat pickers. */
export function getInfiniteFlowCombatChoiceActions(model: GameViewModel, group: CombatChoiceGroup): readonly ViewActionModel[] {
  if (model.phase !== 'combat' || model.sections[1].detail.kind !== 'combat') return [];
  return model.sections[2].actions.filter((action) => group === 'spells'
    ? action.combatAction === 'art' || action.actionId.startsWith('combat.method:')
      || action.actionId.startsWith('soul-skill:')
    : action.combatAction === 'use_healing_pill');
}

function combatChoiceGroup(state: MobileSheetState): CombatChoiceGroup | undefined {
  return state.kind === 'menu' && (state.tab === 'spells' || state.tab === 'medicines') ? state.tab : undefined;
}

function combatChoiceTitle(state: MobileSheetState): string | undefined {
  const group = combatChoiceGroup(state);
  return group === 'spells' ? '选择法术' : group === 'medicines' ? '战斗药品' : undefined;
}

function actionLabel(model: GameViewModel, action: ViewActionModel): string {
  if (model.phase === 'hub') return formatInfiniteFlowHubActionLabel(action);
  if (model.phase === 'explore' || model.phase === 'result') return formatInfiniteFlowExploreResultActionLabel(model.phase, action);
  return readable(action.label, '当前行动');
}

function actionSummary(model: GameViewModel, action: ViewActionModel): string {
  if (!action.enabled) return model.phase === 'hub' ? formatInfiniteFlowHubActionLockedReason(action) : readable(action.disabledReason, '当前不可用。');
  if (model.phase === 'hub') return formatInfiniteFlowHubActionShortCopy(action);
  if (model.phase === 'explore' || model.phase === 'result') return formatInfiniteFlowExploreResultActionSummary(model.phase, action);
  return readable(action.riskReason ?? action.readout, '查看行动详情后执行。');
}

function actionLines(context: SheetContext, action: ViewActionModel): readonly string[] {
  return actionDetailLines(context.model, context.state, action, context.options.chrome);
}

function actionDetailLines(model: GameViewModel, state: MobileSheetState, action: ViewActionModel,
  chrome?: InfiniteFlowRuntimeChrome): readonly string[] {
  const lines: string[] = [];
  const detail = model.sections[1].detail;
  if (state.kind === 'npc' && detail.kind === 'hub') lines.push(`当前查看：${detail.panelSummary}`);
  if (action.readout) lines.push(`效果与消耗：${readable(action.readout)}`);
  if (action.riskReason) lines.push(`风险：${readable(action.riskReason)}`);
  if (action.disabledReason) lines.push(`不可用原因：${model.phase === 'hub' ? formatInfiniteFlowHubActionLockedReason(action) : readable(action.disabledReason)}`);
  if (lines.length === 0) lines.push(actionSummary(model, action));
  if (chrome?.busyActionId !== undefined) lines.push('当前行动正在处理，请稍候。');
  if (chrome?.blockingMessage !== undefined) lines.push(readable(chrome.blockingMessage));
  return lines;
}

function actionDetailContent(model: GameViewModel, state: MobileSheetState, width: number, u: number,
  chrome?: InfiniteFlowRuntimeChrome) {
  const action = model.sections[2].actions.find(candidate => candidate.actionId === state.selectedActionId);
  if (!action) return undefined;
  const lines = actionDetailLines(model, state, action, chrome);
  const maxUnits = Math.max(8, Math.floor((width / u - 16) / 12));
  const wrappedLines = lines.map(line => readable(line)).flatMap(line => line.split('\n')
    .flatMap(logical => wrapInfiniteFlowLine(logical, maxUnits)));
  const contentHeight = (38 + Math.max(1, wrappedLines.length) * 20 + 8) * u;
  return { action, lines, contentHeight, bodyHeight: contentHeight + 52 * u };
}

function canExecute(context: SheetContext, action: ViewActionModel): boolean {
  return action.enabled && action.event !== undefined && context.options.chrome.busyActionId === undefined && context.options.chrome.modeKind !== 'blocked';
}

function renderActionDetail(context: SheetContext, action: ViewActionModel): void {
  const u = catalogUnit(context);
  const reserve = 52 * u;
  const content = actionDetailContent(context.model, context.state, context.width, u, context.options.chrome);
  drawScrollDoc(context, [{ title: actionLabel(context.model, action), lines: content?.lines ?? actionLines(context, action) }], reserve);
  const gap = 7 * u;
  const width = Math.min(148 * u, (context.width - gap) / 2);
  const y = -context.bodyHeight / 2 + 22 * u;
  const group = combatChoiceGroup(context.state);
  const backLabel = context.state.tab === 'confirm-combat' ? '继续战斗' : group === 'spells' ? '返回法术' : group === 'medicines' ? '返回药品' : '返回选项';
  const back = catalogButton(context, context.body, 'MobileSheetActionBack', backLabel, -(width + gap) / 2, y, width, true);
  context.options.bindLocal(back, () => context.state.tab === 'confirm-combat' ? context.options.close()
    : context.options.setState({ ...context.state, selectedActionId: undefined, page: 0 }));
  const enabled = canExecute(context, action);
  const confirmLabel = group === 'spells' ? '释放法术' : group === 'medicines' ? '使用药品'
    : action.event?.kind === 'local' && action.event.action.type === 'entry/request-enter' ? '确认入场' : '确认执行';
  const execute = catalogButton(context, context.body, `MobileSheetExecute:${action.actionId}`, enabled ? confirmLabel : '当前不可用',
    (width + gap) / 2, y, width, enabled, undefined, true, Boolean(action.riskReason || action.emphasis === 'danger'));
  if (enabled) context.options.bindAction(execute, action);
}

function directNavigation(action: ViewActionModel): boolean {
  if (action.event?.kind !== 'local') return false;
  return ['hub/select-panel', 'hub/select-catalog-entry', 'entry/select-dungeon'].includes(action.event.action.type);
}

type SheetActionBack = Readonly<{ kind: MobilePanelKind; label: string; name: string }>;

/** The same measured rows are used for frame sizing and the live ScrollView. */
function actionContent(model: GameViewModel, state: MobileSheetState, width: number, u: number,
  actions = getInfiniteFlowMobilePanelActions(model, state.kind), chrome?: InfiniteFlowRuntimeChrome) {
  const detail = model.sections[1].detail;
  const npc = state.kind === 'npc' && detail.kind === 'hub' ? detail : undefined;
  const navigation = npc ? actions.filter(directNavigation) : [];
  const choices = npc ? actions.filter(action => !directNavigation(action)) : actions;
  const selected = choices.find(action => action.actionId === state.selectedActionId);
  const wrap = (value: string, size: number, inset = 16) => value.split('\n')
    .flatMap(line => wrapInfiniteFlowLine(readable(line), Math.max(6, Math.floor((width / u - inset) / size))));
  const introFont = npc ? 11 : 12;
  // The room sheet's header already carries the pending message.
  const room = roomSheetDetail(model, state) !== undefined;
  const intro = npc ? wrap(npc.panelSummary, introFont)
    : state.kind === 'interaction' && detail.kind === 'explore' && detail.pending && !room
      ? wrap(detail.pending.message, 12) : [];
  const introHeight = intro.length ? intro.length * 18 + 8 : 0;
  const rows = choices.map(action => {
    const title = wrap(actionLabel(model, action), 13, 38);
    const summary = wrap(actionSummary(model, action), 11, 38);
    return { action, title, summary, height: Math.max(48, 16 + title.length * 20 + summary.length * 17) };
  });
  const detailLines = selected ? [
    ...(selected.readout ? [`效果与消耗：${readable(selected.readout)}`] : []),
    ...(selected.riskReason ? [`风险：${readable(selected.riskReason)}`] : []),
    ...(selected.disabledReason ? [`不可用原因：${model.phase === 'hub' ? formatInfiniteFlowHubActionLockedReason(selected) : readable(selected.disabledReason)}`] : []),
    ...(!selected.readout && !selected.riskReason && !selected.disabledReason ? [actionSummary(model, selected)] : []),
    ...(chrome?.busyActionId !== undefined ? ['当前行动正在处理，请稍候。'] : []),
    ...(chrome?.blockingMessage !== undefined ? [readable(chrome.blockingMessage)] : []),
  ].flatMap(line => wrap(line, 12)) : [];
  const selectedTitle = selected ? wrap(actionLabel(model, selected), 13) : [];
  const detailHeight = selected ? 12 + selectedTitle.length * 20 + 4 + detailLines.length * 18 + 8 : 0;
  const navigationHeight = navigation.length * 44 + Math.max(0, navigation.length - 1) * 6;
  const contentHeight = Math.max(48, introHeight + navigationHeight + (navigation.length && rows.length ? 8 : 0)
    + rows.reduce((sum, row) => sum + row.height, 0) + Math.max(0, rows.length - 1) * 6 + detailHeight);
  const footerHeight = room ? roomSheetFooterHeight(u) / u : choices.length ? 52 : 0;
  return { selected, intro, introFont, introHeight, navigation, navigationHeight, rows, selectedTitle, detailLines, detailHeight,
    footerHeight: footerHeight * u, contentHeight: contentHeight * u, bodyHeight: (contentHeight + footerHeight) * u };
}

const NPC_ACTION_TAB_LABELS: Readonly<Record<HubPanel, string>> = Object.freeze({
  entry: '入场选项',
  supplies: '兑换与携行',
  equipment: '装备与强化',
  pets: '签约与培养',
  methods: '学习与精研',
  bloodlines: '觉醒与晋升',
  companions: '招募与出战',
  tasks: '领取奖励',
});

function renderActions(context: SheetContext, actions: readonly ViewActionModel[], empty = '当前没有可执行选项。', back?: SheetActionBack): void {
  const u = catalogUnit(context);
  const room = roomSheetDetail(context.model, context.state) !== undefined;
  const roomBack = (): RoomSheetButton => back === undefined ? roomSheetClose(context)
    : { name: back.name, label: back.label, enabled: true, activate: () => context.options.setState({ kind: back.kind, page: 0 }) };
  if (actions.length === 0) {
    drawScrollDoc(context, [{ title: '当前状态', lines: [empty] }], room ? roomSheetFooterHeight(u) : back ? 52 * u : 0);
    if (room) roomSheetFooter(context, [roomBack()]);
    else if (back) {
      const width = Math.min(148 * u, context.width);
      const control = catalogButton(context, context.body, back.name, back.label,
        context.width / 2 - width / 2, -context.bodyHeight / 2 + 22 * u, width, true);
      context.options.bindLocal(control, () => context.options.setState({ kind: back.kind, page: 0 }));
    }
    return;
  }
  const data = actionContent(context.model, context.state, context.width, u, actions, context.options.chrome);
  const reserve = room ? data.footerHeight : Math.max(data.footerHeight, back ? 52 * u : 0);
  const region = scrollRegion(context, data.contentHeight, reserve);
  const content = scrollContentNode(region);
  let cursor = 0;
  if (data.intro.length) {
    catalogText(context, content, 'MobileSheetNpcSelection', data.intro.join('\n'), 0,
      scrollItemY(region, 0, (data.introHeight - 8) * u), context.width - 16 * u, (data.introHeight - 8) * u, data.introFont, palette().textMuted);
    cursor += data.introHeight * u;
  }
  data.navigation.forEach(action => {
    const control = catalogButton(context, content, `MobileSheetAction:${action.actionId}`, actionLabel(context.model, action), 0,
      scrollItemY(region, cursor, 44 * u), Math.min(context.width, 148 * u), canExecute(context, action));
    if (canExecute(context, action)) context.options.bindAction(control, action);
    cursor += 50 * u;
  });
  if (data.navigation.length && data.rows.length) cursor += 2 * u;
  data.rows.forEach(({ action, title, summary, height }) => {
    const enabled = canExecute(context, action);
    const selected = data.selected?.actionId === action.actionId;
    const accent = !action.enabled ? palette().textMuted : action.riskReason || action.emphasis === 'danger' ? palette().danger : palette().accent;
    const card = panel(content, `MobileSheetAction:${action.actionId}`, 0, scrollItemY(region, cursor, height * u),
      context.width, height * u, selected ? palette().accentDark : palette().quiet,
      selected ? accent : accent === palette().danger ? palette().dangerDark : palette().edge);
    const copyWidth = context.width - 38 * u;
    catalogText(context, card, 'ActionTitle', title.join('\n'), -7 * u,
      (height / 2 - 8 - title.length * 10) * u, copyWidth, title.length * 20 * u, 13,
      action.enabled ? palette().text : palette().textMuted);
    catalogText(context, card, 'ActionReadoutPreview', summary.join('\n'), -7 * u,
      (height / 2 - 8 - title.length * 20 - summary.length * 8.5) * u, copyWidth, summary.length * 17 * u, 11, palette().textMuted);
    catalogText(context, card, 'ActionAffordance', selected ? '✓' : directNavigation(action) ? '›' : '○',
      context.width / 2 - 14 * u, 0, 20 * u, 22 * u, 13, accent, true);
    if (directNavigation(action) && enabled) context.options.bindAction(card, action);
    else context.options.bindLocal(card, () => context.options.setState({ ...context.state, page: 0, selectedActionId: action.actionId }));
    cursor += (height + 6) * u;
  });
  if (data.selected) {
    cursor -= 6 * u;
    catalogRule(content, 'MobileSheetActionDetailRule', scrollItemY(region, cursor + 6 * u, 0), context.width);
    cursor += 12 * u;
    const height = data.selectedTitle.length * 20 * u;
    catalogText(context, content, 'MobileSheetActionDetailTitle', data.selectedTitle.join('\n'), 0,
      scrollItemY(region, cursor, height), context.width - 16 * u, height, 13, palette().accent);
    cursor += height + 4 * u;
    catalogText(context, content, 'MobileSheetActionDetailReadout', data.detailLines.join('\n'), 0,
      scrollItemY(region, cursor, data.detailLines.length * 18 * u), context.width - 16 * u,
      data.detailLines.length * 18 * u, 12, palette().text);
  }
  if (room) {
    const action = data.selected;
    const enabled = action !== undefined && canExecute(context, action);
    roomSheetFooter(context, [roomBack(), ...(data.rows.length > 0 ? [{
      name: action ? `MobileSheetExecute:${action.actionId}` : 'MobileSheetExecute:none',
      label: context.options.chrome.busyActionId ? '正在处理' : action ? enabled ? '确认执行' : '当前不可用' : '请选择一项',
      primary: true, enabled, ...(enabled ? { action } : {}),
    }] : [])]);
  } else if (reserve > 0) {
    const gap = 7 * u;
    const executeWidth = Math.min(148 * u, back ? (context.width - gap) / 2 : context.width);
    const y = -context.bodyHeight / 2 + 22 * u;
    const x = context.width / 2 - executeWidth / 2;
    if (back) {
      const backWidth = Math.min(148 * u, (context.width - gap) / 2);
      const control = catalogButton(context, context.body, back.name, back.label,
        data.rows.length ? context.width / 2 - executeWidth - gap - backWidth / 2 : context.width / 2 - backWidth / 2,
        y, backWidth, true);
      context.options.bindLocal(control, () => context.options.setState({ kind: back.kind, page: 0 }));
    }
    if (data.rows.length) {
      const action = data.selected;
      const enabled = action !== undefined && canExecute(context, action);
      const label = context.options.chrome.busyActionId ? '正在处理' : action ? enabled ? '确认执行' : '当前不可用' : '请选择一项';
      const execute = catalogButton(context, context.body, action ? `MobileSheetExecute:${action.actionId}` : 'MobileSheetExecute:none',
        label, x, y, executeWidth, enabled, undefined, true, Boolean(action?.riskReason || action?.emphasis === 'danger'));
      if (enabled) context.options.bindAction(execute, action!);
    }
  }
}

function hubPages(model: GameViewModel): readonly SheetPage[] {
  const detail = model.sections[1].detail;
  if (detail.kind !== 'hub') return [];
  const pages: SheetPage[] = [{ title: detail.activePanelLabel, lines: [detail.panelSummary, model.sections[0].title, model.sections[0].summary] }];
  const equipment = formatInfiniteFlowEquipmentHubDetail(detail);
  if (equipment.commission) pages.push({ title: equipment.commission.title, lines: [equipment.commission.summary, equipment.commission.detail], helpId: 'equipmentCommission' });
  if (equipment.memory) pages.push({ title: equipment.memory.title, lines: [equipment.memory.summary, equipment.memory.detail], helpId: 'equipmentMemory' });
  return pages;
}

/**
 * WoW paper-doll slots: four on the left (head/charm/armor/feet), three on the
 * right (weapon/hands/waist), flanking the centered reincarnator portrait.
 */
const DOLL_SLOT_LAYOUT: readonly Readonly<{ slot: string; side: -1 | 1; row: number }>[] = [
  { slot: 'head', side: -1, row: 0 }, { slot: 'weapon', side: 1, row: 0 },
  { slot: 'charm', side: -1, row: 1 }, { slot: 'hands', side: 1, row: 1 },
  { slot: 'armor', side: -1, row: 2 }, { slot: 'waist', side: 1, row: 2 },
  { slot: 'feet', side: -1, row: 3 },
];
// Prototype dimensions are CSS pixels; convert at the live canvas boundary.
// Four distinct 44px slot targets fit in this stage without overlapping.
const DOLL_ROW_Y = [72, 24, -24, -72] as const;
const DOLL_STAGE_HEIGHT = 200;
const DOLL_PORTRAIT_W = 80;
const DOLL_PORTRAIT_H = 96;
const STAT_BOX_HEIGHT = 128;

function metricAccent(metric: StatusMetric | undefined): Color {
  if (metric?.severity === 'danger') return palette().danger;
  if (metric?.severity === 'warning') return palette().accent;
  if (metric?.severity === 'positive') return palette().positive;
  return palette().text;
}

function renderCharacter(context: SheetContext): void {
  const u = catalogUnit(context);
  if (context.model.phase === 'hub' && context.state.tab === 'loadout') {
    const bodyHeight = context.bodyHeight - TOUCH - GAP;
    const body = node(context.body, 'MobileSheetOwnedLoadoutBody', 0, (TOUCH + GAP) / 2, context.width, bodyHeight);
    const owned = context.options.ownedLoadout?.();
    const content = { ...context, body, bodyHeight };
    // Pets, companions, bloodlines and methods have their own tabs; this page only wears equipment.
    const partyCategories = new Set<string>(PARTY_SECTIONS.map(section => section.category));
    if (owned) renderHubCatalog(content, {
      rows: owned.rows.filter(row => !partyCategories.has(row.category)), title: '我的装备', npcName: '更换装备',
      greeting: '穿戴已拥有的装备，同部位只穿一件；升级在军需官处。', services: [],
    });
    else renderTextPages(content, [{ title: '更换装备', lines: ['当前没有可穿戴的装备。'] }]);
    button(context.body, 'MobileSheetOwnedLoadoutBack', '返回角色', 0, -context.bodyHeight / 2 + TOUCH / 2, context.width, true,
      () => context.options.setState({ kind: 'character', page: 0, tab: 'overview' }), context.options);
    return;
  }
  const tabbed = tabs(context, [{ id: 'overview', title: '角色' }, { id: 'carry', title: '携行' },
    ...PARTY_SECTIONS.map(section => ({ id: section.tab, title: section.category }))], 'overview');
  context = tabbed.context;
  if (tabbed.active === 'carry') { renderCarryLoadout(context); return; }
  const partySection = PARTY_SECTIONS.find(section => section.tab === tabbed.active);
  if (partySection) { renderPartyLoadout(context, partySection); return; }
  const loadout = context.model.sections[1].loadout;
  const metrics = context.model.sections[1].metrics;
  const selected = metrics.find((metric) => metric.id === context.state.selectedActionId);
  if (!loadout || selected) {
    if (selected) { renderMetricDetail(context, selected); return; }
    renderMetricGrid(context, metrics, context.bodyHeight / 2, context.bodyHeight, 4);
    return;
  }
  // WoW CharacterPaperdoll: the stage and one compact stat box live in a single
  // scroll document; on tall windows it fits without scrolling, while clipped
  // insets fall back to in-window scrolling.
  const stageHeight = DOLL_STAGE_HEIGHT * u;
  const statHeight = STAT_BOX_HEIGHT * u;
  const gap = 6 * u;
  const contentHeight = stageHeight + gap + statHeight;
  const region = scrollRegion(context, contentHeight);
  catalogScrollByFrame.set(context.panel, region.scrollView);
  region.scrollView.scrollToOffset(new Vec2(0, Math.min(Math.max(0, context.state.catalogScrollOffset ?? 0),
    Math.max(0, region.contentHeight - region.height))), 0);
  const content = scrollContentNode(region);
  const stage = panel(content, 'MobileSheetDollStage', 0, scrollItemY(region, 0, stageHeight),
    context.width, stageHeight, palette().quiet, palette().edgeStrong);
  // Centered reincarnator portrait (WoW CharacterPaperdoll), glyph-fallback twin.
  figureNode(context, stage, 'DollPortrait', SHEET_PORTRAIT_KEY, 0, 20 * u, DOLL_PORTRAIT_W * u, DOLL_PORTRAIT_H * u,
    { iconKind: 'character', glyphColor: palette().accent }, context.images);
  const badge = panel(stage, 'DollLevelBadge', 0, -41 * u, 98 * u, 20 * u, palette().accentDark, palette().edgeStrong, false, 'cell');
  catalogText(context, badge, 'Label', '转生者 Lv.1', 0, 0, 94 * u, 18 * u, 10, palette().accent, true);
  if (context.model.phase === 'hub') {
    button(stage, 'MobileSheetOwnedLoadout', '更换装备', 0, -75 * u, Math.min(110 * u, context.width - 120 * u), true,
      () => context.options.setState({ kind: 'character', page: 0, tab: 'loadout' }), context.options);
  }
  for (const entry of loadout.equipment) {
    const layout = DOLL_SLOT_LAYOUT.find((candidate) => candidate.slot === entry.slot);
    if (!layout) continue;
    const x = layout.side * (context.width / 2 - 30 * u);
    const y = DOLL_ROW_Y[layout.row]! * u;
    // WoW paper-doll: slot frame carries the equipped item's rarity edge.
    const slotEdge = qualityEdgeColor(equipmentQuality(entry.equipmentId), palette().edgeStrong);
    const slot = panel(stage, `MobileSheetEquip:${entry.slot}`, x, y, 44 * u, 44 * u, palette().raised, slotEdge, false, 'cell');
    // Slot name floats above the slot in the prototype; the level stays inside.
    catalogText(context, slot, 'SlotLabel', entry.slotLabel, 0, -15 * u, 42 * u, 12 * u, 9, palette().textMuted, true);
    figureNode(context, slot, `EquipIcon:${entry.slot}`, sheetEquipmentKey(entry.equipmentId), 0, 5 * u, 28 * u, 28 * u,
      { glyph: entry.name.charAt(entry.name.length - 1), glyphSize: 16 * u, glyphColor: palette().textMuted }, context.images);
    catalogText(context, slot, 'SlotLevel', `Lv${entry.level}`, 10 * u, 15 * u, 22 * u, 11 * u, 7, palette().accent, true);
    // Equipment tips are always read-only; opening works in every phase.
    context.options.bindLocal(slot, () => context.options.setState({ ...context.state,
      catalogScrollOffset: Math.max(0, region.scrollView.getScrollOffset().y), tip: { kind: 'equip', id: entry.equipmentId } }));
  }

  const boxCursor = stageHeight + gap;
  const box = panel(content, 'MobileSheetStatBox', 0, scrollItemY(region, boxCursor, statHeight), context.width, statHeight, palette().quiet, palette().edge);
  const metricValue = (id: string): string => metrics.find((metric) => metric.id === id)?.value ?? '—';
  const heading = (value: string, y: number): void => {
    catalogText(context, box, `StatHeading:${value}`, value, -context.width / 2 + 31 * u, y, 48 * u, 16 * u, 10, palette().accent);
    const rule = node(box, `StatRule:${value}`, 0, y - 10 * u, context.width - 16 * u, u).addComponent(Graphics);
    rule.strokeColor = palette().edge; rule.lineWidth = u;
    rule.moveTo(-(context.width - 16 * u) / 2, 0); rule.lineTo((context.width - 16 * u) / 2, 0); rule.stroke();
  };
  heading('属性', 52 * u);
  const rows: readonly Readonly<{ name: string; label: string; value: string; color?: Color }>[] = [
    { name: 'MobileSheetKpi:power', label: '战力', value: String(loadout.power), color: palette().danger },
    { name: 'MobileSheetMetric:hp', label: '生命', value: `${loadout.hp}/${loadout.maxHp}` },
    { name: 'MobileSheetKpi:attack', label: '攻击', value: String(loadout.attack) },
    { name: 'MobileSheetKpi:artPower', label: '术法强度', value: String(loadout.artPower) },
    { name: 'MobileSheetKpi:defense', label: '防御', value: String(loadout.defense) },
    { name: 'MobileSheetKpi:speed', label: '速度', value: String(loadout.speed) },
  ];
  // Two columns of label/value pairs with a 24px gutter; value keeps its framed
  // semantic node (gate contract) but the cell is compact like the prototype.
  const columnW = (context.width - 16 * u - 14 * u) / 2;
  const statYs = [29, 9, -11] as const;
  rows.forEach((row, index) => {
    const col = index % 2 === 0 ? -1 : 1;
    const left = col < 0 ? -context.width / 2 + 8 * u : 7 * u;
    statPair(context, box, `StatLabel:${index}`, row.name, row.label, row.value, left, statYs[Math.floor(index / 2)]! * u, columnW, row.color ?? palette().text);
  });
  heading('货币', -34 * u);
  const currencies: readonly Readonly<{ name: string; label: string; id: string; color: Color }>[] = [
    { name: 'MobileSheetMetric:reward-points', label: '奖励点', id: 'reward-points', color: palette().text },
    { name: 'MobileSheetMetric:lingyun', label: '灵蕴', id: 'lingyun', color: palette().positive },
  ];
  currencies.forEach((currency, index) => {
    const col = index === 0 ? -1 : 1;
    const left = col < 0 ? -context.width / 2 + 8 * u : 7 * u;
    statPair(context, box, `MoneyLabel:${currency.id}`, currency.name, currency.label, metricValue(currency.id), left, -53 * u, columnW, currency.color);
  });
}

/**
 * Prototype-style "标签  值" row: pure text on the shared stat-box surface, no
 * per-value background. The semantic KPI/Metric name stays on a transparent
 * cut-corner node so the gate's framed-node contract and cut discipline hold.
 */
function statPair(context: SheetContext, parent: Node, labelName: string, valueName: string, label: string, value: string, left: number, y: number, columnW: number, color: Color): void {
  const u = catalogUnit(context);
  const labelWidth = 48 * u;
  catalogText(context, parent, labelName, label, left + labelWidth / 2, y, labelWidth, 18 * u, 10, palette().textMuted);
  const cellLeft = left + labelWidth;
  const cellW = left + columnW - cellLeft;
  const cell = panel(parent, valueName, cellLeft + cellW / 2, y, cellW, 18 * u, withAlpha(palette().surface, 0), withAlpha(palette().surface, 0), false, 'cell');
  catalogText(context, cell, 'Value', value, 0, 0, cellW, 18 * u, 10, color, true);
  // Pin values to the column's right edge (prototype space-between stat rows).
  const valueLabel = cell.getChildByName('Value')?.getComponent(Label);
  if (valueLabel) valueLabel.horizontalAlign = Label.HorizontalAlign.RIGHT;
}

const METRIC_CARD_HEIGHT = 68;

/** Compact metric cards in a scrolling two-column grid beneath the paper-doll stage. */
function renderMetricGrid(context: SheetContext, metrics: readonly StatusMetric[], top: number, regionHeight: number, minColumns: number): void {
  if (metrics.length === 0) return;
  const fullBody = regionHeight >= context.bodyHeight - 24;
  const columns = 2;
  const rows = Math.ceil(metrics.length / columns);
  const u = catalogUnit(context);
  const cardHeight = METRIC_CARD_HEIGHT * u;
  const gap = 7 * u;
  const contentHeight = rows * cardHeight + (rows - 1) * gap;
  const region = fullBody
    ? scrollRegion(context, contentHeight)
    : scrollRegion(context, contentHeight, 0, top);
  const content = scrollContentNode(region);
  const width = (region.width - gap * (columns - 1)) / columns;
  metrics.forEach((metric, index) => {
    const accent = metricAccent(metric);
    const col = index % columns;
    const gridRow = Math.floor(index / columns);
    const cursor = gridRow * (cardHeight + gap);
    const x = -region.width / 2 + width / 2 + col * (width + gap);
    const card = panel(content, `MobileSheetMetric:${metric.id}`, x, scrollItemY(region, cursor, cardHeight), width, cardHeight, palette().quiet, accent === palette().danger ? palette().dangerDark : palette().edge);
    catalogText(context, card, 'MetricLabel', readable(metric.label), 0, cardHeight / 2 - 16 * u, width - 12 * u, 20 * u, 11, palette().textMuted, true);
    catalogText(context, card, 'MetricValue', readable(metric.value), 0, -8 * u, width - 12 * u, 30 * u, 15, accent, true);
    context.options.bindLocal(card, () => context.options.setState({ ...context.state, tab: 'metric', selectedActionId: metric.id, page: 0 }));
  });
}

function renderMetricDetail(context: SheetContext, metric: StatusMetric): void {
  const reserve = TOUCH + GAP;
  drawScrollDoc(context, [{ title: metric.label, lines: [metric.value] }], reserve);
  button(context.body, 'MobileSheetMetricBack', '返回角色状态', 0, -context.bodyHeight / 2 + TOUCH / 2, context.width, true, () => context.options.setState({ kind: 'character', page: 0 }), context.options);
}

function mapTitle(cell: MapNodeViewModel): string { return cell.state === 'fogged' ? '迷雾区域' : cell.title; }

const MAP_COLORS = Object.freeze({
  background: new Color(22, 25, 19), edge: new Color(93, 83, 58),
  disc: new Color(33, 34, 26), known: new Color(137, 127, 99),
  fog: new Color(107, 111, 91, 192), fogFill: new Color(25, 28, 21),
  gold: new Color(217, 188, 127), text: new Color(239, 232, 217),
  muted: new Color(179, 176, 155), green: new Color(193, 212, 181),
  danger: new Color(224, 170, 145), ink: new Color(23, 25, 19),
});

/** Shared small vectors keep node types recognizable without relying on emoji fonts. */
function paintMapGlyph(g: Graphics, kind: MapNodeViewModel['nodeType'] | 'current' | 'lock', size: number): void {
  const scale = size / 24;
  const path = (points: readonly number[]): void => line(g, points.map((value, index) => (
    (index % 2 === 0 ? value - 12 : 12 - value) * scale
  )));
  if (kind === 'current') {
    g.circle(0, 0, 7 * scale); g.stroke(); g.circle(0, 0, 2 * scale); g.stroke();
    path([12, 1, 12, 4]); path([12, 20, 12, 23]); path([1, 12, 4, 12]); path([20, 12, 23, 12]);
  } else if (kind === 'monster') {
    path([4, 6, 9, 8, 12, 3, 15, 8, 20, 6, 18, 18, 12, 21, 6, 18, 4, 6]);
    path([8, 12, 10, 13]); path([14, 13, 16, 12]); path([10, 17, 14, 17]);
  } else if (kind === 'trap') {
    path([12, 3, 22, 21, 2, 21, 12, 3]); path([12, 9, 12, 14]); path([12, 17, 12, 18]);
  } else if (kind === 'reward') {
    path([4, 8, 20, 8, 20, 20, 4, 20, 4, 8]); path([3, 4, 21, 4, 21, 9, 3, 9, 3, 4]);
    path([12, 4, 12, 20]); path([10, 12, 14, 12]);
  } else if (kind === 'portal') {
    path([5, 21, 5, 9, 6, 5, 9, 2, 15, 2, 18, 5, 19, 9, 19, 21]);
    path([3, 21, 21, 21]); path([9, 20, 9, 10, 10, 7, 14, 7, 15, 10, 15, 20]);
  } else if (kind === 'exit') {
    path([10, 3, 4, 3, 4, 21, 10, 21]); path([9, 12, 21, 12]); path([16, 7, 21, 12, 16, 17]);
  } else if (kind === 'lock') {
    path([5, 10, 19, 10, 19, 21, 5, 21, 5, 10]);
    path([8, 10, 8, 6, 9, 3, 15, 3, 16, 6, 16, 10]); path([12, 14, 12, 17]);
  } else {
    path([12, 2, 21, 12, 12, 22, 3, 12, 12, 2]); path([12, 8, 12, 13]); path([12, 16, 12, 17]);
  }
}

function paintMapDashedCircle(g: Graphics, radius: number): void {
  for (let dash = 0; dash < 12; dash += 1) {
    const start = dash * Math.PI / 6;
    g.moveTo(Math.cos(start) * radius, Math.sin(start) * radius);
    for (let step = 1; step <= 3; step += 1) {
      const angle = start + step * Math.PI / 36;
      g.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    g.stroke();
  }
}

function mapNodeStatus(cell: MapNodeViewModel): string {
  if (cell.state === 'current') return '当前位置';
  if (cell.isAdjacent && !cell.canMove) return '暂不可达';
  if (cell.state === 'cleared') return '已清理';
  if (cell.canMove) return '可前往';
  return cell.state === 'fogged' ? '未知区域' : '已知区域';
}

function mapNodeDirection(cell: MapNodeViewModel, current: MapNodeViewModel | undefined): string {
  if (!current) return '相邻';
  const dx = cell.x - current.x, dy = cell.y - current.y;
  // Match walk-world doorSide, including long and diagonal generated routes.
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? '右侧' : '左侧';
  return dy > 0 ? '下方' : '上方';
}

function renderMap(context: SheetContext): void {
  const detail = context.model.sections[1].detail;
  if (detail.kind !== 'explore') { renderTextPages(context, [{ title: '区域地图', lines: ['进入副本探索后，可在此查看已知区域。'] }]); return; }
  const map = detail.map;
  if (map.width <= 0 || map.height <= 0 || map.nodes.length === 0) {
    renderTextPages(context, [{ title: '区域地图暂不可用', lines: ['当前探索数据未包含有效地图。请关闭地图，检查当前冒险状态。'] }]);
    return;
  }
  const selected = context.state.mapDungeonId === undefined || context.state.mapDungeonId === map.dungeonId
    ? map.nodes.find((cell) => cell.state !== 'fogged' && `map:${cell.cellId}` === context.state.selectedActionId)
    : undefined;
  const current = map.nodes.find(cell => cell.state === 'current');
  const u = catalogUnit(context);
  const introHeight = 24 * u, legendHeight = 40 * u, detailMinimumHeight = 86 * u;
  const pad = 6 * u;
  // Six normal columns fit at 320px while retaining disjoint 44px touch plates.
  // Wider generated maps keep that target size and scroll horizontally instead.
  const stride = Math.max(44 * u, (context.width - 2 * pad) / map.width);
  const contentWidth = Math.max(context.width, 2 * pad + map.width * stride);
  const contentHeight = 2 * pad + map.height * stride;
  const viewHeight = Math.min(contentHeight, context.bodyHeight - introHeight - legendHeight - detailMinimumHeight);
  const graphTop = context.bodyHeight / 2 - introHeight;
  const graphY = graphTop - viewHeight / 2;
  const detailHeight = context.bodyHeight - introHeight - viewHeight - legendHeight;
  const knownCount = map.nodes.filter(cell => cell.state !== 'fogged').length;
  catalogText(context, context.body, 'MobileSheetMapTitle', `已知 ${knownCount} / ${map.nodes.length} 区域`,
    0, context.bodyHeight / 2 - introHeight / 2, context.width, introHeight, 11, MAP_COLORS.muted);
  const backing = node(context.body, 'MobileSheetMapFrame', 0, graphY, context.width, viewHeight).addComponent(Graphics);
  backing.fillColor = MAP_COLORS.background; backing.strokeColor = MAP_COLORS.edge; backing.lineWidth = u;
  backing.rect(-context.width / 2, -viewHeight / 2, context.width, viewHeight); backing.fill(); backing.stroke();
  const holder = node(context.body, 'MobileSheetMapScroll', 0, graphY, context.width, viewHeight);
  holder.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
  const content = node(holder, 'MobileSheetMapContent', (contentWidth - context.width) / 2,
    (viewHeight - contentHeight) / 2, contentWidth, contentHeight);
  const dots = node(content, 'MobileSheetMapDotGrid', 0, 0, contentWidth, contentHeight).addComponent(Graphics);
  dots.fillColor = new Color(85, 79, 56, 64);
  for (let x = -contentWidth / 2 + 6 * u; x < contentWidth / 2; x += 12 * u) {
    for (let y = -contentHeight / 2 + 6 * u; y < contentHeight / 2; y += 12 * u) {
      dots.circle(x, y, 0.7 * u); dots.fill();
    }
  }
  const scroll = holder.addComponent(ScrollView);
  scroll.content = content;
  scroll.horizontal = contentWidth > context.width + 0.5;
  scroll.vertical = contentHeight > viewHeight + 0.5;
  scroll.inertia = true;
  scroll.brake = 0.75;
  scroll.elastic = false;
  scroll.cancelInnerEvents = true;
  mapScrollByFrame.set(context.panel, { dungeonId: map.dungeonId, scroll });
  const point = (cell: MapNodeViewModel): Readonly<{ x: number; y: number }> => ({
    x: -contentWidth / 2 + pad + (cell.x + 0.5) * stride,
    y: contentHeight / 2 - pad - (cell.y + 0.5) * stride,
  });
  const known = new Map(map.nodes.filter(cell => cell.state !== 'fogged').map(cell => [cell.cellId, cell]));
  // Edges are projected from the actual dungeon topology. Never infer generated
  // map links from grid coordinates or connect to undiscovered identities.
  for (const [fromId, toId] of map.knownEdges) {
    const from = known.get(fromId), to = known.get(toId);
    if (!from || !to) continue;
    const a = point(from), b = point(to);
    const neighbor = from.state === 'current' ? to : to.state === 'current' ? from : undefined;
    const blocked = neighbor !== undefined && !neighbor.canMove;
    const edge = node(content, `MobileSheetMapEdge:${fromId}:${toId}`, 0, 0, contentWidth, contentHeight).addComponent(Graphics);
    edge.strokeColor = neighbor ? blocked ? MAP_COLORS.danger : MAP_COLORS.gold : new Color(89, 104, 88, 174);
    edge.lineWidth = (neighbor ? 2 : 1) * u;
    if (blocked) {
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      for (let start = 0; start < length; start += 6 * u) {
        const end = Math.min(start + 3 * u, length);
        line(edge, [a.x + (b.x - a.x) * start / length, a.y + (b.y - a.y) * start / length,
          a.x + (b.x - a.x) * end / length, a.y + (b.y - a.y) * end / length]);
      }
    } else line(edge, [a.x, a.y, b.x, b.y]);
  }
  for (const cell of map.nodes) {
    const fogged = cell.state === 'fogged';
    const isCurrent = cell.state === 'current';
    const blocked = !fogged && cell.isAdjacent && !cell.canMove;
    const accent = isCurrent ? MAP_COLORS.ink : blocked ? MAP_COLORS.danger
      : cell.state === 'cleared' ? MAP_COLORS.green : cell.canMove ? MAP_COLORS.gold : MAP_COLORS.muted;
    const border = isCurrent ? MAP_COLORS.gold : blocked ? MAP_COLORS.danger
      : cell.state === 'cleared' ? MAP_COLORS.green : cell.canMove ? MAP_COLORS.gold
        : fogged ? MAP_COLORS.fog : MAP_COLORS.known;
    const p = point(cell);
    const tile = node(content, fogged ? `MobileSheetFog:${cell.x}:${cell.y}` : `MobileSheetMapCell:${cell.cellId}`,
      p.x, p.y, 44 * u, 44 * u);
    const disc = node(tile, 'MapNodeDisc', 0, 0, 31 * u, 31 * u).addComponent(Graphics);
    disc.lineWidth = u; disc.strokeColor = border;
    disc.fillColor = isCurrent ? MAP_COLORS.gold : fogged ? MAP_COLORS.fogFill : MAP_COLORS.disc;
    disc.circle(0, 0, 15.5 * u); disc.fill();
    if (fogged) paintMapDashedCircle(disc, 15.5 * u); else disc.stroke();
    if (isCurrent || selected?.cellId === cell.cellId) {
      const ring = node(tile, selected?.cellId === cell.cellId ? 'MapSelectedRing' : 'MapCurrentRing',
        0, 0, 42 * u, 42 * u).addComponent(Graphics);
      ring.strokeColor = selected?.cellId === cell.cellId ? MAP_COLORS.text : MAP_COLORS.gold;
      ring.lineWidth = (selected?.cellId === cell.cellId ? 2 : 1) * u;
      ring.circle(0, 0, 20.5 * u); ring.stroke();
    }
    const glyphKind = isCurrent ? 'current' : blocked ? 'lock' : cell.nodeType;
    const glyph = node(tile, fogged ? 'MapUnknownIcon' : `MapTypeIcon:${glyphKind}`, 0, 0, 18 * u, 18 * u).addComponent(Graphics);
    glyph.strokeColor = accent; glyph.fillColor = MAP_COLORS.fog; glyph.lineWidth = 1.4 * u;
    if (fogged) {
      for (const dx of [-5, 0, 5]) { glyph.circle(dx * u, 0, u); glyph.fill(); }
    } else paintMapGlyph(glyph, glyphKind, 18 * u);
    if (cell.state === 'cleared' || cell.state === 'scouted') {
      const badge = node(tile, 'MapStateBadge', 11 * u, -11 * u, 15 * u, 15 * u).addComponent(Graphics);
      badge.strokeColor = new Color(91, 113, 85); badge.fillColor = new Color(26, 45, 34); badge.lineWidth = u;
      badge.circle(0, 0, 7.5 * u); badge.fill(); badge.stroke(); badge.strokeColor = MAP_COLORS.green;
      line(badge, (cell.state === 'cleared' ? [-3, 0, -0.5, -3, 4, 4]
        : [0, 4, 4, 0, 0, -4, -4, 0, 0, 4]).map(value => value * u));
    }
    // The graph is an inspection surface; it never binds a domain movement.
    // Fog has neither a real name/type in the tree nor a touch callback.
    if (!fogged) context.options.bindLocal(tile, () => {
      const offset = scroll.getScrollOffset();
      context.options.setState({ ...context.state, selectedActionId: `map:${cell.cellId}`, mapDungeonId: map.dungeonId,
        mapScrollOffset: { x: Math.max(0, -offset.x), y: Math.max(0, offset.y) } });
    });
  }
  const maxX = contentWidth - context.width, maxY = contentHeight - viewHeight;
  const saved = context.state.mapDungeonId === map.dungeonId ? context.state.mapScrollOffset : undefined;
  const focus = current ? point(current) : { x: -contentWidth / 2, y: contentHeight / 2 };
  const offsetX = saved?.x ?? contentWidth / 2 + focus.x - context.width / 2;
  const offsetY = saved?.y ?? contentHeight / 2 - focus.y - viewHeight / 2;
  scroll.scrollToOffset(new Vec2(Math.max(0, Math.min(maxX, offsetX)), Math.max(0, Math.min(maxY, offsetY))), 0);
  const legendTop = graphTop - viewHeight;
  const legends = [
    ['● 当前', MAP_COLORS.gold], ['○ 可达', MAP_COLORS.gold], ['✓ 已清理', MAP_COLORS.green],
    ['◇ 已知', MAP_COLORS.muted], ['··· 未知', MAP_COLORS.muted],
  ] as const;
  legends.forEach(([value, color], index) => {
    catalogText(context, context.body, `MobileSheetMapLegend:${index}`, value,
      -context.width / 2 + (index + 0.5) * context.width / 5, legendTop - 14 * u,
      context.width / 5, 22 * u, 10, color, true);
  });
  catalogText(context, context.body, 'MobileSheetMapHint', '连线表示区域相邻 · 点选区域查看详情', 0,
    legendTop - 31 * u, context.width, 18 * u, 9, MAP_COLORS.muted, true);
  const detailY = -context.bodyHeight / 2 + detailHeight / 2;
  const card = panel(context.body, 'MobileSheetMapDetail', 0, detailY, context.width, detailHeight,
    MAP_COLORS.disc, selected ? MAP_COLORS.gold : MAP_COLORS.edge);
  if (!selected) {
    catalogText(context, card, 'MapDetailEmpty', '点选上方已知区域，查看区域详情', 0, 0,
      context.width - 24 * u, 42 * u, 12, MAP_COLORS.muted, true);
    return;
  }
  const isHere = selected.state === 'current';
  const blocked = selected.isAdjacent && !selected.canMove;
  const direction = mapNodeDirection(selected, current);
  const typeLabels: Readonly<Record<string, string>> = {
    monster: '敌人', trap: '机关', reward: '物资', portal: '界门', exit: '撤离', event: '事件',
  };
  const status = `${isHere ? '当前位置' : selected.isAdjacent ? `${direction}出口` : '已知区域'} · ${isHere
    ? detail.currentNode.cleared ? '已清理' : typeLabels[selected.nodeType] ?? '区域'
    : mapNodeStatus(selected)}`;
  const description = isHere ? detail.currentNode.description : blocked
    ? selected.disabledReason ?? selected.stateLabel : selected.isAdjacent
      ? `从当前区域的${direction}通道可到达此处。`
      : '此处不与当前位置相邻，可在图中查看方位与连接。';
  const detailWidth = context.width - 24 * u;
  const wrappedDescription = wrapInfiniteFlowLine(readable(description), Math.max(8, Math.floor(detailWidth / (12 * u))));
  const footer = isHere ? '关闭地图，继续当前区域的探索。' : selected.isAdjacent && selected.canMove
    ? `关闭地图后，走近${direction}通道继续探索。` : blocked
      ? '满足通行条件后，再从场景中的通道前往。' : '沿已知相邻区域继续探索，可逐步抵达此处。';
  const wrappedFooter = wrapInfiniteFlowLine(footer, Math.max(8, Math.floor(detailWidth / (11 * u))));
  const copyHeight = (14 + 20 + 28 + wrappedDescription.length * 18 + 10 + wrappedFooter.length * 17 + 12) * u;
  const copyViewHeight = detailHeight - 2 * u;
  const copyContentHeight = Math.max(copyViewHeight, copyHeight);
  const copyHolder = node(card, 'MobileSheetMapDetailScroll', 0, 0, context.width - 2 * u, copyViewHeight);
  copyHolder.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
  const copy = node(copyHolder, 'MobileSheetMapDetailContent', 0, (copyViewHeight - copyContentHeight) / 2,
    detailWidth, copyContentHeight);
  const copyScroll = copyHolder.addComponent(ScrollView);
  copyScroll.content = copy; copyScroll.horizontal = false; copyScroll.vertical = copyHeight > copyViewHeight;
  copyScroll.inertia = true; copyScroll.elastic = false; copyScroll.brake = 0.75;
  let cursor = 14 * u;
  catalogText(context, copy, 'MapDetailStatus', status, 0, copyContentHeight / 2 - cursor - 10 * u,
    detailWidth, 20 * u, 11, blocked ? MAP_COLORS.danger : MAP_COLORS.gold);
  cursor += 20 * u;
  catalogText(context, copy, 'MapDetailTitle', mapTitle(selected), 0, copyContentHeight / 2 - cursor - 14 * u,
    detailWidth, 28 * u, 15, MAP_COLORS.text);
  cursor += 28 * u;
  const descriptionHeight = wrappedDescription.length * 18 * u;
  catalogText(context, copy, 'MapDetailDescription', wrappedDescription.join('\n'), 0,
    copyContentHeight / 2 - cursor - descriptionHeight / 2, detailWidth, descriptionHeight, 12,
    blocked ? MAP_COLORS.danger : MAP_COLORS.muted);
  cursor += descriptionHeight + 10 * u;
  const footerHeight = wrappedFooter.length * 17 * u;
  catalogText(context, copy, 'MapDetailGuidance', wrappedFooter.join('\n'), 0,
    copyContentHeight / 2 - cursor - footerHeight / 2, detailWidth, footerHeight, 11, MAP_COLORS.muted);
}

function objectivePages(model: GameViewModel): readonly SheetPage[] {
  const detail = model.sections[1].detail;
  const pages: SheetPage[] = [{ title: model.sections[0].title, lines: [model.sections[0].summary] }];
  if (detail.kind === 'explore') pages.push(...buildInfiniteFlowChapterCodexPages(detail).map((page) => ({ title: page.title, lines: page.lines, ...(page.helpId ? { helpId: page.helpId } : {}) })));
  if (detail.kind === 'combat' && detail.chapterContext !== undefined) {
    const chapter = formatInfiniteFlowCombatChapterContext(detail.chapterContext);
    pages.push({ title: `${detail.chapterContext.dungeonName} · 战斗章规`, lines: [chapter.lawLine, ...(chapter.pursuitLine ? [chapter.pursuitLine] : [])], helpId: 'law' });
  }
  for (const risk of model.sections[3].items) pages.push({ title: `风险 · ${risk.label}`, lines: [risk.reason] });
  return pages;
}

/** The first screen answers what to do; explanations live behind each task. */
function renderObjectives(context: SheetContext): void {
  const u = catalogUnit(context);
  const wrap = (value: string, size: number, width: number): string[] => value.split('\n')
    .flatMap(line => wrapInfiniteFlowLine(readable(line), Math.max(8, Math.floor(width / (size * u)))));
  const selected = context.model.tasks.find(task => task.id === context.state.taskId);
  const rules = context.state.tab === 'rules';
  const footerHeight = 48 * u;
  const footerY = -context.bodyHeight / 2 + footerHeight / 2;
  catalogRule(context.body, 'TaskFooterRule', -context.bodyHeight / 2 + footerHeight, context.width);
  if (selected || rules) {
    const backWidth = catalogButtonWidth(context, '返回任务列表');
    const back = catalogButton(context, context.body, 'MobileSheetTaskBack', '返回任务列表',
      context.width / 2 - backWidth / 2, footerY, backWidth, true);
    context.options.bindLocal(back, () => context.options.setState({ ...context.state, taskId: undefined, tab: undefined }));
    const bodyHeight = context.bodyHeight - footerHeight;
    const body = node(context.body, selected ? 'MobileSheetTaskDetail' : 'MobileSheetObjectiveRulesDetail',
      0, footerHeight / 2, context.width, bodyHeight);
    const detailContext = { ...context, body, bodyHeight };
    const sections: readonly SheetPage[] = selected ? [
      { title: selected.title, lines: [selected.kind === 'mainline' ? '主线任务' : '支线任务', ...(selected.detailObjectives ?? selected.objectives)] },
      { title: '任务说明', lines: [selected.description] },
      { title: '完成提示', lines: [selected.hint] },
      { title: '任务奖励', lines: [selected.rewardText, selected.status === 'completed' ? '已完成，返回主神空间领取奖励。' : '完成后返回主神空间领取奖励。'] },
    ] : objectivePages(context.model);
    const helpId = sections.find(section => section.helpId !== undefined)?.helpId;
    const help = context.model.sections[4].entries.find(entry => entry.id === helpId);
    if (help) {
      const width = catalogButtonWidth(context, '查看完整规则');
      const control = catalogButton(context, context.body, 'MobileSheetRelatedHelp', '查看完整规则',
        -context.width / 2 + width / 2, footerY, width, true);
      context.options.bindLocal(control, () => context.options.openHelp(help));
    }
    const width = context.width - 20 * u;
    const facts = sections.map(section => {
      const title = wrap(section.title, 13, width);
      const lines = section.lines.flatMap(line => wrap(line, 11, width));
      return { title, lines, height: (20 + title.length * 20 + lines.length * 18) * u };
    });
    const region = scrollRegion(detailContext, facts.reduce((sum, fact) => sum + fact.height, 0));
    const content = scrollContentNode(region);
    let cursor = 0;
    facts.forEach((fact, index) => {
      const item = node(content, `MobileSheetTaskFact:${index}`, 0, scrollItemY(region, cursor, fact.height), context.width, fact.height);
      catalogText(context, item, 'TaskFactTitle', fact.title.join('\n'), 0,
        fact.height / 2 - (8 + fact.title.length * 10) * u, width, fact.title.length * 20 * u, 13, palette().accent);
      catalogText(context, item, 'TaskFactText', fact.lines.join('\n'), 0,
        fact.height / 2 - (12 + fact.title.length * 20 + fact.lines.length * 9) * u,
        width, fact.lines.length * 18 * u, 11);
      catalogRule(item, 'TaskFactRule', -fact.height / 2, width);
      cursor += fact.height;
    });
    return;
  }

  const introHeight = 28 * u;
  const bodyHeight = context.bodyHeight - introHeight - footerHeight;
  catalogText(context, context.body, 'MobileSheetTaskHint', `当前任务 ${context.model.tasks.length} · 点击查看详情`,
    0, context.bodyHeight / 2 - 12 * u, context.width - 8 * u, 22 * u, 11, palette().textMuted);
  const body = node(context.body, 'MobileSheetTaskList', 0, (footerHeight - introHeight) / 2, context.width, bodyHeight);
  const list = { ...context, body, bodyHeight };
  const titleWidth = context.width - 94 * u;
  const progressWidth = context.width - 32 * u;
  const rows = context.model.tasks.map(task => {
    const title = wrap(task.title, 13, titleWidth);
    const progress = task.objectives.flatMap(line => wrap(line, 11, progressWidth));
    return { task, title, progress, height: Math.max(58, 20 + title.length * 20 + progress.length * 18) * u };
  });
  const region = scrollRegion(list, rows.reduce((sum, row) => sum + row.height, 0));
  region.holder.name = 'MobileSheetTaskScroll';
  catalogScrollByFrame.set(context.panel, region.scrollView);
  region.scrollView.scrollToOffset(new Vec2(0, Math.min(Math.max(0, context.state.taskScrollOffset ?? 0),
    Math.max(0, region.contentHeight - region.height))), 0);
  const content = scrollContentNode(region);
  let cursor = 0;
  for (const { task, title, progress, height } of rows) {
    const row = node(content, `MobileSheetTask:${task.id}`, 0, scrollItemY(region, cursor, height), context.width, height);
    catalogRule(row, 'TaskRule', -height / 2, context.width - 8 * u);
    catalogText(context, row, 'TaskTitle', title.join('\n'), -37 * u,
      height / 2 - (8 + title.length * 10) * u, titleWidth, title.length * 20 * u, 13, palette().accent);
    row.getChildByName('TaskTitle')!.getComponent(Label)!.isBold = true;
    catalogText(context, row, 'TaskStatus', task.status === 'completed' ? '待领取' : task.kind === 'mainline' ? '主线' : '支线',
      context.width / 2 - 38 * u, height / 2 - 21 * u, 54 * u, 20 * u, 11,
      task.status === 'completed' ? palette().positive : palette().textMuted, true);
    catalogText(context, row, 'TaskProgress', progress.join('\n'), -6 * u,
      height / 2 - (12 + title.length * 20 + progress.length * 9) * u,
      progressWidth, progress.length * 18 * u, 11);
    catalogText(context, row, 'TaskExpand', '›', context.width / 2 - 10 * u,
      -height / 2 + 24 * u, 16 * u, 24 * u, 14, palette().textMuted, true);
    context.options.bindLocal(row, () => context.options.setState({ ...context.state, taskId: task.id,
      taskScrollOffset: Math.max(0, region.scrollView.getScrollOffset().y) }));
    cursor += height;
  }
  if (!rows.length) catalogText(context, content, 'MobileSheetTasksEmpty', '暂无进行中的任务', 0,
    region.contentHeight / 2 - 32 * u, context.width - 20 * u, 40 * u, 13, palette().textMuted, true);
  const rulesWidth = catalogButtonWidth(context, '章规与探索');
  const control = catalogButton(context, context.body, 'MobileSheetObjectiveRules', '章规与探索',
    context.width / 2 - rulesWidth / 2, footerY, rulesWidth, true);
  context.options.bindLocal(control, () => context.options.setState({ ...context.state, tab: 'rules', taskId: undefined,
    taskScrollOffset: Math.max(0, region.scrollView.getScrollOffset().y) }));
}

function inventoryPages(model: GameViewModel): readonly SheetPage[] {
  const detail = model.sections[1].detail;
  if (detail.kind === 'hub' && (detail.activePanel === 'equipment' || detail.activePanel === 'supplies')) return hubPages(model);
  const pages: SheetPage[] = [{ title: '当前携行', lines: model.sections[1].metrics.filter((metric) => ['reward-points', 'lingyun', 'loot'].includes(metric.id)).map((metric) => `${metric.label}：${metric.value}`) }];
  if (detail.kind === 'hub') pages.push({ title: '物资与装备', lines: ['打开目录后，可查看当前物资库存、携行状态和装备。'] });
  else if (detail.kind === 'explore') {
    const memory = formatInfiniteFlowExploreEquipmentMemory(detail);
    if (memory) pages.push({ title: memory.title, lines: [memory.summary, memory.detail], helpId: 'equipmentMemory' });
    pages.push({ title: '探索携行', lines: ['道具破解、传送和奖励选择会在走近当前交互点后显示。', '回到主神空间可查看物资库存、调整携行与装备。'] });
  } else if (detail.kind === 'combat') {
    if (detail.equipmentMemory) { const memory = formatInfiniteFlowEquipmentMemoryCombat(detail.equipmentMemory); pages.push({ title: memory.title, lines: [memory.summary, memory.detail], helpId: 'equipmentMemory' }); }
    pages.push({ title: '战斗道具', lines: ['可用的消耗道具显示在道具页；使用前可查看效果和当前限制。'] });
  } else if (detail.kind === 'result') pages.push(...buildInfiniteFlowResultPages(detail).filter((page) => ['loot', 'equipmentRoll', 'memory'].includes(page.id)));
  return pages;
}

const HELP_CARD_HEIGHT = 54;

function renderHelp(context: SheetContext): void {
  const entries = context.model.sections[4].entries;
  if (entries.length === 0) { drawScrollDoc(context, [{ title: '冒险指南', lines: ['当前没有指南条目。'] }], 0); return; }
  const u = catalogUnit(context);
  const cardHeight = HELP_CARD_HEIGHT * u;
  const gap = 4 * u;
  const contentHeight = entries.length * cardHeight + (entries.length - 1) * gap;
  const region = scrollRegion(context, contentHeight);
  catalogScrollByFrame.set(context.panel, region.scrollView);
  region.scrollView.scrollToOffset(new Vec2(0, Math.min(Math.max(0, context.state.catalogScrollOffset ?? 0),
    Math.max(0, region.contentHeight - region.height))), 0);
  const content = scrollContentNode(region);
  entries.forEach((entry, index) => {
    const cursor = index * (cardHeight + gap);
    const card = panel(content, `MobileSheetHelp:${entry.id}`, 0, scrollItemY(region, cursor, cardHeight), region.width, cardHeight, palette().quiet, palette().edge);
    icon(card, 'HelpIcon', 'help', -context.width / 2 + 17 * u, 9 * u, palette().accent, 18 * u);
    const copyWidth = context.width - 46 * u;
    catalogText(context, card, 'HelpTitle', entry.title, 12 * u, 10 * u, copyWidth, 22 * u, 13, palette().text);
    const preview = wrapInfiniteFlowLine(readable(entry.summary), Math.floor(copyWidth / (11 * u)));
    catalogText(context, card, 'HelpSummary', `${preview[0] ?? ''}${preview.length > 1 ? '…' : ''}`,
      12 * u, -12 * u, copyWidth, 18 * u, 11, palette().textMuted);
    catalogText(context, card, 'HelpExpand', '›', context.width / 2 - 10 * u, 0, 14 * u, 24 * u, 14, palette().textMuted, true);
    context.options.bindLocal(card, () => context.options.openHelp(entry));
  });
}

function renderCombatPicker(context: SheetContext, group: CombatChoiceGroup): void {
  const u = catalogUnit(context);
  const actions = getInfiniteFlowCombatChoiceActions(context.model, group);
  const data = combatPickerContent(context.model, context.width, u, group);
  const hintHeight = 26 * u;
  catalogText(context, context.body, 'MobileSheetCombatHint', group === 'spells' ? '点选即释放' : '点选即使用', 0,
    context.bodyHeight / 2 - 9 * u, context.width, 18 * u, 11, palette().textMuted, true);
  const bodyHeight = context.bodyHeight - hintHeight;
  const body = node(context.body, 'MobileSheetCombatChoices', 0, -hintHeight / 2, context.width, bodyHeight);
  const region = scrollRegion({ ...context, body, bodyHeight }, data.contentHeight);
  const content = scrollContentNode(region);
  let cursor = 0;
  data.rows.forEach(({ action, title, summary, height }) => {
    const enabled = canExecute(context, action);
    const color = enabled ? palette().accent : palette().textMuted;
    const card = panel(content, `MobileSheetAction:${action.actionId}`, 0,
      scrollItemY(region, cursor, height * u), context.width, height * u,
      palette().quiet, enabled ? palette().edgeStrong : palette().edge);
    icon(card, 'ActionIcon', group === 'spells' ? 'help' : 'inventory', -context.width / 2 + 24 * u, 0, color, 30 * u);
    const copyWidth = context.width - 61 * u;
    catalogText(context, card, 'ActionTitle', title.join('\n'), 22 * u,
      (height / 2 - 8 - title.length * 10) * u, copyWidth, title.length * 20 * u, 13, color);
    catalogText(context, card, 'ActionReadoutPreview', summary.join('\n'), 22 * u,
      (height / 2 - 8 - title.length * 20 - summary.length * 8.5) * u, copyWidth, summary.length * 17 * u, 11,
      enabled ? palette().text : palette().textMuted);
    if (enabled) context.options.bindAction(card, action);
    cursor += (height + 6) * u;
  });
  if (!actions.length) catalogText(context, content, 'MobileSheetCombatEmpty', '当前没有可用选项', 0, 0, context.width, 48 * u, 13, palette().textMuted, true);
}

function combatPickerContent(model: GameViewModel, width: number, u: number, group: CombatChoiceGroup) {
  const rows = getInfiniteFlowCombatChoiceActions(model, group).map(action => {
    const wrap = (value: string, font: number) => value.split('\n').flatMap(line =>
      wrapInfiniteFlowLine(readable(line), Math.max(6, Math.floor((width / u - 61) / font))));
    const title = wrap(actionLabel(model, action), 13);
    const summary = wrap(!action.enabled ? action.disabledReason ?? '当前不可用'
      : action.readout ?? action.riskReason ?? '释放已配置的能力', 11);
    return { action, title, summary, height: Math.max(48, 16 + title.length * 20 + summary.length * 17) };
  });
  const contentHeight = Math.max(48, rows.reduce((sum, row) => sum + row.height, 0) + Math.max(0, rows.length - 1) * 6) * u;
  return { rows, contentHeight, bodyHeight: contentHeight + 26 * u };
}

function renderMenu(context: SheetContext): void {
  const group = combatChoiceGroup(context.state);
  if (group !== undefined) { renderCombatPicker(context, group); return; }
  if (context.state.tab === 'confirm-combat') {
    const action = context.model.sections[2].actions.find(candidate => candidate.actionId === context.state.selectedActionId);
    if (action) renderActionDetail(context, action);
    return;
  }
  // The advanced/combat action list is a state-level view with its own back
  // button; the prototype-style menu carries no permanent tab strip.
  if (context.state.tab === 'actions') {
    renderSheetActionView(context, 'menu', '返回主菜单', 'MobileSheetTab:shortcuts');
    return;
  }
  const ctx = context;
  const u = catalogUnit(context);
  const tiles: readonly Readonly<{ kind: MobilePanelKind | 'actions' | 'close' | 'retreat'; label: string; danger: boolean }>[] = [
    { kind: 'character', label: '角色信息', danger: false },
    { kind: 'inventory', label: '行囊装备', danger: false },
    { kind: 'map', label: '世界地图', danger: false },
    { kind: 'objectives', label: '任务目标', danger: false },
    { kind: 'log', label: '战斗记录', danger: false },
    { kind: 'help', label: '帮助', danger: false },
    { kind: 'entry', label: '轮回之门', danger: false },
    { kind: 'actions', label: ctx.model.phase === 'combat' ? '战斗行动' : '进阶行动', danger: true },
    ...(ctx.model.phase === 'combat' ? [{ kind: 'retreat' as const, label: '放弃本轮并回收', danger: true }] : []),
    { kind: 'close', label: '收起', danger: false },
  ];
  const rowHeight = 44 * u;
  const headingHeight = 22 * u;
  const contentHeight = headingHeight + 6 * u + (tiles.length + 1) * rowHeight + tiles.length * 6 * u;
  const region = scrollRegion(ctx, contentHeight);
  const content = scrollContentNode(region);
  catalogText(context, content, 'MobileSheetMenuHeading', '随身菜单', 0, scrollItemY(region, 0, headingHeight), ctx.width, headingHeight, 11, palette().accent, true);
  tiles.forEach((tile, index) => {
    const cursor = headingHeight + 6 * u + index * (rowHeight + 6 * u);
    const y = scrollItemY(region, cursor, rowHeight);
    const visualWidth = Math.min(148 * u, ctx.width);
    const cell = node(content, `MobileSheetShortcut:${tile.kind}`, 0, y, visualWidth, rowHeight);
    const visual = panel(cell, 'ShortcutButton', 0, 0, visualWidth, 32 * u,
      tile.danger ? palette().dangerDark : palette().quiet,
      tile.danger ? palette().danger : palette().edgeStrong, false, 'control');
    catalogText(ctx, visual, 'ShortcutTitle', tile.label, 0, 0, visualWidth - 16 * u, 24 * u, 13,
      tile.kind === 'close' ? palette().textMuted : tile.danger ? palette().danger : palette().text, true);
    if (tile.kind === 'close') ctx.options.bindLocal(cell, () => ctx.options.close());
    else if (tile.kind === 'retreat') ctx.options.bindLocal(cell, () => ctx.options.setState({ kind: 'menu', tab: 'confirm-combat', page: 0, selectedActionId: 'combat.retreat-run' }));
    else if (tile.kind === 'actions') ctx.options.bindLocal(cell, () => ctx.options.setState({ kind: 'menu', tab: 'actions', page: 0 }));
    else {
      const kind: MobilePanelKind = tile.kind;
      ctx.options.bindLocal(cell, () => ctx.options.setState({ kind, page: 0, tip: undefined }));
    }
  });
  // The version doubles as the hidden tester switch: seven taps in a row flip test mode.
  const versionTop = headingHeight + 6 * u + tiles.length * (rowHeight + 6 * u);
  const version = node(content, 'MobileSheetVersion', 0, scrollItemY(region, versionTop, rowHeight), ctx.width, rowHeight);
  catalogText(ctx, version, 'VersionLabel', `版本 ${INFINITE_FLOW_GAME_VERSION}${ctx.options.testMode ? ' · 测试模式' : ''}`,
    0, 0, ctx.width, 20 * u, 10, ctx.options.testMode ? palette().accent : palette().textMuted, true);
  const toggleTestMode = ctx.options.toggleTestMode;
  if (toggleTestMode) ctx.options.bindLocal(version, () => {
    // Counted outside sheet state: a re-render would scroll the menu back up between taps.
    const now = Date.now();
    versionTapRun = now - versionTapRun.at > VERSION_TAP_WINDOW_MS ? { count: 1, at: now } : { count: versionTapRun.count + 1, at: now };
    if (versionTapRun.count < VERSION_TAPS_TO_TOGGLE) return;
    versionTapRun = { count: 0, at: 0 };
    toggleTestMode();
  });
}

const VERSION_TAPS_TO_TOGGLE = 7;
const VERSION_TAP_WINDOW_MS = 1500;
let versionTapRun = { count: 0, at: 0 };

/**
 * Action choices reached from a destination tile scroll above one fixed footer.
 */
function renderSheetActionView(context: SheetContext, kind: MobilePanelKind, backLabel: string, backName: string): void {
  renderActions(context, getInfiniteFlowMobilePanelActions(context.model, kind), '当前没有可执行选项。',
    { kind, label: backLabel, name: backName });
}

const INVENTORY_COLUMNS = 5;
const INVENTORY_CELL_SIZE = 44;
const INVENTORY_CELL_GAP = 5;
const INVENTORY_TOTAL_SLOTS = 100;

/** Carry configuration uses real projected actions and domain-assigned slots. */
function renderCarryLoadout(context: SheetContext): void {
  const loadout = context.model.sections[1].loadout;
  if (!loadout) { renderTextPages(context, [{ title: '携行', lines: ['当前角色携行信息不可用。'] }]); return; }
  const u = catalogUnit(context);
  const entries = loadout.items.filter(entry => entry.itemGroup === 'carry');
  const categoryLabels = { combat: '战斗', ward: '防护', portal: '传送', capture: '捕获' };
  const hub = context.model.phase === 'hub';
  const entriesById = new Map(entries.map(entry => [entry.itemId, entry]));
  const actions = new Map(entries.map(entry => [entry.itemId, hub ? resolveCarryToggle(context, entry.itemId) : undefined]));
  const enabled = (entry: typeof entries[number]): boolean => {
    const action = actions.get(entry.itemId);
    return hub && (entry.carried || entry.count > 0) && action !== undefined && canExecute(context, action);
  };
  const columns = 5;
  const gap = 4 * u;
  const slotWidth = (context.width - gap * (columns - 1)) / columns;
  const slotHeight = 58 * u;
  const slotRows = Math.ceil(loadout.carrySlots.length / columns);
  const slotsHeight = slotRows * slotHeight + Math.max(0, slotRows - 1) * gap;
  const hint = !hub ? '副本内不可调整携行' : '点击道具装备 · 再次点击卸下';
  const upperHeight = 26 * u + slotsHeight + 30 * u + 26 * u;
  const footerHeight = 28 * u;
  const textWidth = context.width - 62 * u;
  const rows = entries.map(entry => {
    const action = actions.get(entry.itemId);
    const description = wrapInfiniteFlowLine(ITEMS[entry.itemId].description,
      Math.max(8, Math.floor(textWidth / (11 * u))));
    const reason = hub && action && !action.enabled && action.disabledReason
      ? wrapInfiniteFlowLine(readable(action.disabledReason), Math.max(8, Math.floor(textWidth / (10 * u)))) : [];
    return { entry, description, reason, height: Math.max(64, 54 + description.length * 17 + reason.length * 16) * u };
  });
  // Slots and items share one scroll document: expanded slot capacity cannot
  // squeeze the item list or footer out of the approved compact window.
  const contentHeight = upperHeight + rows.reduce((sum, row) => sum + row.height + gap, 0);
  const region = scrollRegion(context, contentHeight, footerHeight);
  region.holder.name = 'MobileSheetCarryList';
  catalogScrollByFrame.set(context.panel, region.scrollView);
  region.scrollView.scrollToOffset(new Vec2(0, Math.min(Math.max(0, context.state.carryScrollOffset ?? 0),
    Math.max(0, region.contentHeight - region.height))), 0);
  const content = scrollContentNode(region);
  const top = region.contentHeight / 2;
  catalogText(context, content, 'MobileSheetCarryHeading', '携行槽', -context.width / 2 + 45 * u,
    top - 12 * u, 90 * u, 24 * u, 13, palette().accent);
  catalogText(context, content, 'MobileSheetCarryCount', `${loadout.carriedCount} / ${loadout.carrySlots.length}`,
    context.width / 2 - 32 * u, top - 12 * u, 64 * u, 24 * u, 12, palette().accent, true);
  loadout.carrySlots.forEach((slot, index) => {
    const entry = slot.itemId === undefined ? undefined : entriesById.get(slot.itemId);
    const x = -context.width / 2 + slotWidth / 2 + (index % columns) * (slotWidth + gap);
    const cursor = 26 * u + Math.floor(index / columns) * (slotHeight + gap);
    const cell = panel(content, `MobileSheetCarrySlot:${slot.id}`, x, scrollItemY(region, cursor, slotHeight), slotWidth, slotHeight,
      entry ? palette().accentDark : palette().quiet, entry ? palette().accent : palette().edgeStrong, false, 'cell');
    catalogText(context, cell, 'CarrySlotType', slot.label, 0, slotHeight / 2 - 7 * u,
      slotWidth - 4 * u, 12 * u, 8, palette().textMuted, true);
    if (entry) {
      figureNode(context, cell, 'CarrySlotIcon', sheetItemKey(entry.itemId), 0, 0, 28 * u, 28 * u,
        { glyph: entry.name[0], glyphSize: 18 * u, glyphColor: palette().accent }, context.images);
      catalogText(context, cell, 'CarrySlotName', entry.name, 0, -slotHeight / 2 + 8 * u,
        slotWidth - 4 * u, 14 * u, 9, palette().text, true);
      const action = actions.get(entry.itemId);
      if (action && enabled(entry)) context.options.bindAction(cell, action);
    } else {
      catalogText(context, cell, 'CarrySlotEmpty', '◇', 0, 0, slotWidth, 28 * u, 20, palette().textMuted, true);
      catalogText(context, cell, 'CarrySlotName', '待装入', 0, -slotHeight / 2 + 8 * u,
        slotWidth - 4 * u, 14 * u, 9, palette().textMuted, true);
    }
  });
  const hintY = top - 26 * u - slotsHeight - 15 * u;
  catalogText(context, content, 'MobileSheetCarryHint', hint, 0, hintY, context.width, 24 * u, 11, palette().textMuted, true);
  catalogRule(content, 'MobileSheetCarryDivider', hintY - 15 * u, context.width);
  catalogText(context, content, 'MobileSheetCarryListHeading', '携行道具', -context.width / 2 + 45 * u,
    top - upperHeight + 13 * u, 90 * u, 26 * u, 13, palette().accent);
  catalogText(context, content, 'MobileSheetCarryListCount', `全部 ${entries.length} 种`, context.width / 2 - 35 * u,
    top - upperHeight + 13 * u, 70 * u, 26 * u, 11, palette().textMuted, true);
  let cursor = upperHeight;
  for (const { entry, description, reason, height } of rows) {
    const action = actions.get(entry.itemId);
    const usable = enabled(entry);
    const muted = !entry.carried && !usable;
    const foreground = muted ? palette().textMuted : palette().text;
    const card = panel(content, `MobileSheetCarryItem:${entry.itemId}`, 0, scrollItemY(region, cursor, height), context.width, height,
      entry.carried ? palette().accentDark : muted ? palette().quiet : palette().raised,
      entry.carried ? palette().accent : muted ? palette().edge : palette().edgeStrong, false, 'card');
    const figure = figureNode(context, card, 'CarryItemIcon', sheetItemKey(entry.itemId),
      -context.width / 2 + 25 * u, height / 2 - 29 * u, 36 * u, 40 * u,
      { glyph: entry.name[0], glyphSize: 22 * u, glyphColor: foreground }, context.images);
    const sprite = figure.getChildByName('CarryItemIcon:Sprite')?.getComponent(Sprite);
    if (sprite) {
      sprite.grayscale = muted;
      if (muted) sprite.color = new Color(145, 145, 145, 255);
    }
    const textX = 25 * u;
    catalogText(context, card, 'CarryItemName', entry.name, textX, height / 2 - 17 * u,
      textWidth, 22 * u, 13, foreground);
    let label: string;
    if (entry.carried) label = hub ? '已装备 · 卸下' : '已装备';
    else if (entry.count <= 0) label = '未持有';
    else if (!hub) label = '未装备';
    else if (usable) label = '装备 ＋';
    else label = action && !action.enabled ? '无可用槽位' : '暂不可操作';
    catalogText(context, card, 'CarryItemStock', `${categoryLabels[entry.category]} · 库存 ${entry.count} · ${label}`,
      textX, height / 2 - 36 * u, textWidth, 17 * u, 10, muted ? palette().textMuted : palette().accent);
    const descriptionHeight = description.length * 17 * u;
    catalogText(context, card, 'CarryItemDescription', description.join('\n'), textX,
      height / 2 - 46 * u - descriptionHeight / 2, textWidth, descriptionHeight, 11, palette().textMuted);
    if (reason.length > 0) {
      const reasonHeight = reason.length * 16 * u;
      catalogText(context, card, 'CarryItemDisabledReason', reason.join('\n'), textX,
        height / 2 - 46 * u - descriptionHeight - reasonHeight / 2, textWidth, reasonHeight, 10, palette().textMuted);
    }
    if (action && usable) context.options.bindAction(card, action);
    cursor += height + gap;
  }
  const footerTop = -context.bodyHeight / 2 + footerHeight;
  catalogRule(context.body, 'MobileSheetCarryFooterRule', footerTop, context.width);
  catalogText(context, context.body, 'MobileSheetCarryFooter', hub ? '下次入场生效 · 补给品不占槽' : '返回主神空间后可调整携行',
    0, footerTop - footerHeight / 2, context.width, footerHeight, 11, palette().textMuted, true);
}

// One character tab each: how many go along and where they act, which facts a card shows, and where to get one.
const PARTY_SECTIONS = [
  { tab: 'pets', category: '灵宠', kind: 'pet', rule: '同时 1 只出战，在你身旁辅助（不直接攻击），属性与特性自动生效',
    facts: ['战斗辅助', '特性'], on: '★ 出战中', pick: '点击设为出战', empty: '尚未拥有灵宠', where: '可在灵宠师处签约，或在副本战斗中捕获' },
  { tab: 'companions', category: '同伴', kind: 'companion', rule: '同时带 1 位，每回合在你身旁自动出手',
    facts: ['并肩作战'], on: '★ 出战中', pick: '点击设为出战', empty: '尚未招募同伴', where: '首通对应副本后，可在同行引路人处招募' },
  { tab: 'bloodlines', category: '血统', kind: 'bloodline', rule: '同时激活 1 种，属性常驻，命中时自动触发血统效果',
    facts: ['1 阶属性', '2 阶属性', '3 阶属性', '命中效果'], on: '★ 已激活', pick: '点击激活', empty: '尚未觉醒血统', where: '可在血脉祭司处觉醒' },
  { tab: 'methods', category: '功法', kind: undefined, rule: '已学的全部生效；常用的战技排在「法术」首位',
    facts: ['功法被动', '主动战技'], on: '★ 常用', pick: '点击设为常用', empty: '尚未学习功法', where: '可在修行导师处学习' },
] as const;

/** One kind of companion on the character sheet: chosen in the hub, read-only on a run. */
function renderPartyLoadout(context: SheetContext, section: typeof PARTY_SECTIONS[number]): void {
  const u = catalogUnit(context);
  const hub = context.model.phase === 'hub';
  const rows = hub ? (context.options.ownedLoadout?.()?.rows ?? []).filter(row => row.category === section.category) : [];
  const runParty = section.kind === undefined ? [] : (context.model.sections[1].loadout?.runParty ?? []).filter(member => member.kind === section.kind);
  const gap = 4 * u;
  const footerHeight = 28 * u;
  const textWidth = context.width - 62 * u;
  const units = (size: number) => Math.max(8, Math.floor(textWidth / (size * u)));
  const ruleLines = wrapInfiniteFlowLine(section.rule, Math.max(8, Math.floor((context.width - 16 * u) / (10.5 * u))));
  const ruleHeight = (ruleLines.length * 16 + 12) * u;
  type PartyCard = Readonly<{ id: string; name: string; level: string; status: string; lines: readonly string[]; active: boolean;
    visualAssetKey?: string; action?: ViewActionModel; height: number }>;
  const cards: PartyCard[] = hub
    ? rows.map(row => {
      const active = /出战中|已激活|常用/.test(row.status);
      const action = row.actions.find(candidate => candidate.actionId.includes('.activate:'));
      const usable = !active && action !== undefined && canExecute(context, action);
      const level = row.status.split('·').map(part => part.trim())
        .filter(part => !/^(出战中|已激活|常用|未出战|未激活|已拥有)$/.test(part)).join(' · ');
      const lines = section.facts.flatMap(label => {
        const value = row.details.find(item => item.label === label)?.value;
        return value === undefined ? [] : wrapInfiniteFlowLine(readable(`${label.replace(/^\d 阶属性$/, '属性')}：${value}`), units(11));
      }).slice(0, 4);
      return { id: row.id, name: row.name, level, lines, active, visualAssetKey: row.visualAssetKey,
        status: active ? section.on : usable ? section.pick : readable(action?.disabledReason ?? '暂不可更换'),
        ...(usable ? { action } : {}), height: Math.max(60, 46 + lines.length * 17) * u };
    })
    : runParty.map(member => {
      const lines = wrapInfiniteFlowLine(member.description, units(11)).slice(0, 4);
      return { id: `${member.kind}/${member.id}`, name: member.name, level: '', lines, active: true, visualAssetKey: member.visualAssetKey,
        status: `本局${section.on.replace('★ ', '')}`, height: Math.max(60, 46 + lines.length * 17) * u };
    });
  const emptyLines = section.kind === undefined && !hub
    ? wrapInfiniteFlowLine('副本中按入场时已学的全部功法生效，战技在战斗「法术 → 功法」里使用。', units(11))
    : [hub ? section.empty : '本局未带', ...(hub ? wrapInfiniteFlowLine(section.where, units(11)) : [])];
  const emptyHeight = (emptyLines.length * 18 + 12) * u;
  const contentHeight = ruleHeight + gap + (cards.length > 0 ? cards.reduce((sum, card) => sum + card.height + gap, 0) : emptyHeight);
  const region = scrollRegion(context, contentHeight, footerHeight);
  region.holder.name = 'MobileSheetPartyList';
  catalogScrollByFrame.set(context.panel, region.scrollView);
  const content = scrollContentNode(region);
  const rule = panel(content, `MobileSheetPartyRule:${section.tab}`, 0, scrollItemY(region, 0, ruleHeight), context.width, ruleHeight,
    palette().quiet, palette().accent, false, 'cell');
  catalogText(context, rule, 'PartyRuleText', ruleLines.join('\n'), 0, 0, context.width - 16 * u, ruleLines.length * 16 * u, 10.5, palette().text);
  let cursor = ruleHeight + gap;
  if (cards.length === 0) {
    catalogText(context, content, `MobileSheetPartyEmpty:${section.tab}`, emptyLines.join('\n'), 0,
      scrollItemY(region, cursor, emptyHeight), context.width, emptyHeight, 11, palette().textMuted, true);
  }
  for (const card of cards) {
    const node0 = panel(content, `MobileSheetPartyCard:${card.id}`, 0, scrollItemY(region, cursor, card.height), context.width, card.height,
      card.active ? palette().accentDark : palette().raised, card.active ? palette().accent : palette().edgeStrong, false, 'card');
    figureNode(context, node0, 'PartyCardIcon', card.visualAssetKey ?? '', -context.width / 2 + 25 * u, card.height / 2 - 27 * u, 36 * u, 40 * u,
      { glyph: card.name.slice(0, 1), glyphSize: 22 * u, glyphColor: palette().accent }, context.images);
    const textX = 25 * u;
    catalogText(context, node0, 'PartyCardName', card.level ? `${card.name}  ${card.level}` : card.name, textX, card.height / 2 - 15 * u,
      textWidth, 22 * u, 13, palette().text);
    catalogText(context, node0, 'PartyCardStatus', card.status, textX, card.height / 2 - 33 * u, textWidth, 16 * u, 10,
      card.active ? palette().positive : palette().accent);
    const linesHeight = card.lines.length * 17 * u;
    catalogText(context, node0, 'PartyCardEffect', card.lines.join('\n'), textX,
      card.height / 2 - 43 * u - linesHeight / 2, textWidth, linesHeight, 11, palette().textMuted);
    if (card.action) context.options.bindAction(node0, card.action);
    cursor += card.height + gap;
  }
  const footerTop = -context.bodyHeight / 2 + footerHeight;
  catalogRule(context.body, 'MobileSheetPartyFooterRule', footerTop, context.width);
  catalogText(context, context.body, 'MobileSheetPartyFooter', hub ? '点卡片更换 · 下次入场生效' : '副本中不能更换 · 返回主神空间后调整',
    0, footerTop - footerHeight / 2, context.width, footerHeight, 11, palette().textMuted, true);
}

/** Supply slots stay separate from carried items and passive run relics. */
function renderInventoryBag(context: SheetContext, loadout: NonNullable<GameViewModel['sections'][1]['loadout']>): void {
  const palette0 = palette();
  const u = catalogUnit(context);
  const metrics = context.model.sections[1].metrics;
  const metricValue = (id: string): string => metrics.find((metric) => metric.id === id)?.value ?? '—';

  // Header row: tab-specific carry wording hugs the left edge; reward points +
  // lingyun ride the right.
  const headerHeight = 20 * u;
  const headerY = context.bodyHeight / 2 - headerHeight / 2;
  const carryLine = '◇ 补给品 · 不占携行槽';
  catalogText(context, context.body, 'MobileSheetMoneyCarry', carryLine, 0, headerY, context.width, headerHeight, 11, palette0.accent);
  const currencyY = headerY - 20 * u;
  const currencyWidth = (context.width - 16 * u) / 2;
  const rewardLabelX = -context.width / 4;
  const lingyunLabelX = context.width / 4;
  catalogText(context, context.body, 'MobileSheetMoney:reward', `${metricValue('reward-points')} 奖励点`, rewardLabelX,
    currencyY, currencyWidth, 20 * u, 11, palette0.accent);
  catalogText(context, context.body, 'MobileSheetMoney:lingyun', `${metricValue('lingyun')} 灵蕴`, lingyunLabelX,
    currencyY, currencyWidth, 20 * u, 11, palette0.positive);

  const entries = loadout.items.filter((entry) => entry.itemGroup === 'supply');
  const hintY = currencyY - 22 * u;
  const hintCopy = `补给品 ${entries.length} 种 · 滑动浏览 · 点击查看详情`;
  catalogText(context, context.body, 'MobileSheetBagHint', hintCopy, 0, hintY, context.width, 20 * u, 10, palette0.textMuted, true);

  const cellGap = (context.width / u < 270 ? 4 : INVENTORY_CELL_GAP) * u;
  const cellSize = Math.max(INVENTORY_CELL_SIZE * u,
    (context.width - 8 * u - (INVENTORY_COLUMNS - 1) * cellGap) / INVENTORY_COLUMNS);
  const gridWidth = INVENTORY_COLUMNS * cellSize + (INVENTORY_COLUMNS - 1) * cellGap;
  const gridTop = hintY - 14 * u;
  const gridHeight = Math.max(44 * u, gridTop + context.bodyHeight / 2);
  const backing = panel(context.body, 'MobileSheetInventoryRack', 0, gridTop - gridHeight / 2, context.width, gridHeight, palette0.quiet, palette0.edge, false, 'rack');

  const gridRows = INVENTORY_TOTAL_SLOTS / INVENTORY_COLUMNS;
  // Top pad 16, 20 full rows (incl. gap), 16px bottom pad.
  const contentHeight = 8 * u + gridRows * (cellSize + cellGap) - cellGap;
  const regionContext = surfaceContext(context, { body: backing, width: context.width, bodyHeight: gridHeight });
  const region = scrollRegion(regionContext, contentHeight);
  catalogScrollByFrame.set(context.panel, region.scrollView);
  region.scrollView.scrollToOffset(new Vec2(0, Math.min(Math.max(0, context.state.catalogScrollOffset ?? 0),
    Math.max(0, region.contentHeight - region.height))), 0);
  const content = scrollContentNode(region);

  const cellX = (col: number): number =>
    -gridWidth / 2 + cellSize / 2 + col * (cellSize + cellGap);
  let blankIndex = entries.length;
  const renderBlank = (col: number, cursor: number): void => {
    const y = scrollItemY(region, cursor, cellSize);
    // Purely decorative empty slot: no label, no data, no interaction.
    panel(content, `MobileSheetBlank:${blankIndex}`, cellX(col), y, cellSize, cellSize, palette0.ink, palette0.edge, false, 'cell');
    blankIndex += 1;
  };
  const renderItemCell = (entry: typeof loadout.items[number], col: number, cursor: number): void => {
    const y = scrollItemY(region, cursor, cellSize);
    const empty = entry.count === 0 && !entry.carried;
    // Rarity edge (WoW item-button tint); the gold carried seal/edge wins when
    // the item is pinned to a carry slot.
    const qualityEdge = qualityEdgeColor(itemQuality(entry.itemId), palette0.edge);
    const cell = panel(content, `MobileSheetItem:${entry.itemId}`, cellX(col), y, cellSize, cellSize, palette0.raised, entry.carried ? palette0.accent : qualityEdge, false, 'cell');
    const iconSize = (context.width / u < 270 ? 32 : 36) * u;
    figureNode(context, cell, `ItemIcon:${entry.itemId}`, sheetItemKey(entry.itemId), 0, 2 * u, iconSize, iconSize,
      { glyph: entry.name.charAt(entry.name.length - 1), glyphSize: 20 * u, glyphColor: empty ? palette0.textMuted : palette0.text }, context.images);
    catalogText(context, cell, 'ItemCount', `×${entry.count}`, cellSize / 2 - 13 * u,
      -cellSize / 2 + 8 * u, 22 * u, 14 * u, 9, entry.count > 0 ? palette0.text : palette0.textMuted, true);
    if (entry.carried) sealNode(cell, 'ItemCarriedSeal', cellSize / 2 - 7 * u, cellSize / 2 - 7 * u, 10 * u);
    context.options.bindLocal(cell, () => context.options.setState({ ...context.state,
      catalogScrollOffset: Math.max(0, region.scrollView.getScrollOffset().y), tip: { kind: 'item', id: entry.itemId } }));
  };

  let cursor = 4 * u;
  let col = 0;
  for (const entry of entries) {
    renderItemCell(entry, col, cursor);
    col += 1;
    if (col === INVENTORY_COLUMNS) {
      col = 0;
      cursor += cellSize + cellGap;
    }
  }
  // Pad the last partial row, then fill the rest of the 5×100 grid.
  const placedCells = entries.length;
  for (let blankSlot = placedCells; blankSlot < INVENTORY_TOTAL_SLOTS; blankSlot += 1) {
    renderBlank(blankSlot % INVENTORY_COLUMNS, cursor);
    if (blankSlot % INVENTORY_COLUMNS === INVENTORY_COLUMNS - 1) {
      cursor += cellSize + cellGap;
    }
  }
}

function renderRunRelics(context: SheetContext, loadout: NonNullable<GameViewModel['sections'][1]['loadout']>): void {
  const u = catalogUnit(context);
  const intro = wrapInfiniteFlowLine('选中后自动生效，无需装备；仅本局有效。', Math.floor(context.width / u / 12));
  const introHeight = (intro.length * 18 + 20) * u;
  catalogText(context, context.body, 'MobileSheetRunRelicIntro', intro.join('\n'), 0,
    context.bodyHeight / 2 - introHeight / 2, context.width, introHeight, 12, palette().textMuted);
  const bodyHeight = context.bodyHeight - introHeight;
  const body = node(context.body, 'MobileSheetRunRelicBody', 0, -introHeight / 2, context.width, bodyHeight);
  if (loadout.runRelics.length === 0) {
    const inRun = context.model.phase === 'explore' || context.model.phase === 'combat';
    catalogText(context, body, 'MobileSheetRunRelicEmpty', inRun ? '本局尚未获得遗物' : '进入副本后可获得本局遗物',
      0, 0, context.width, 48 * u, 14, palette().textMuted, true);
    return;
  }
  const gap = 5 * u;
  const inset = 8 * u;
  const cardWidth = context.width;
  const effectWidth = cardWidth - 56 * u - inset;
  const entries = loadout.runRelics.map((relic) => {
    const lines = wrapInfiniteFlowLine(relic.description, Math.floor(effectWidth / u / 11));
    const names = wrapInfiniteFlowLine(relic.name, Math.floor(effectWidth / u / 13));
    return { relic, lines, names, height: Math.max(64, 29 + names.length * 20 + lines.length * 17) * u };
  });
  const region = scrollRegion({ ...context, body, bodyHeight },
    entries.reduce((total, entry) => total + entry.height + gap, gap));
  region.holder.name = 'MobileSheetRunRelicList';
  catalogScrollByFrame.set(context.panel, region.scrollView);
  region.scrollView.scrollToOffset(new Vec2(0, Math.min(Math.max(0, context.state.catalogScrollOffset ?? 0),
    Math.max(0, region.contentHeight - region.height))), 0);
  const content = scrollContentNode(region);
  let cursor = gap;
  for (const { relic, lines, names, height } of entries) {
    const card = panel(content, `MobileSheetRunRelic:${relic.relicId}`, 0, scrollItemY(region, cursor, height),
      cardWidth, height, palette().raised, palette().edgeStrong, false, 'card');
    const key = getInfiniteFlowRunRelicVisualKey(relic.relicId);
    const figure = figureNode(context, card, `RunRelicIcon:${relic.relicId}`, key,
      -cardWidth / 2 + 27 * u, height / 2 - 30 * u, 36 * u, 40 * u,
      { glyph: relic.name.slice(-1), glyphSize: 22 * u, glyphColor: palette().accent }, context.images);
    const visual = context.options.hudVisual?.(key);
    if (visual && context.options.trackHudSprite) {
      const spriteNode = figure.getChildByName(`RunRelicIcon:${relic.relicId}:Sprite`)!;
      const ratio = Math.min(36 * u / visual.width, 40 * u / visual.height);
      spriteNode.getComponent(UITransform)!.setContentSize(new Size(visual.width * ratio, visual.height * ratio));
      const sprite = spriteNode.getComponent(Sprite)!;
      sprite.spriteFrame = visual.frame;
      sprite.trim = false;
      figure.getChildByName(`RunRelicIcon:${relic.relicId}:Glyph`)!.active = false;
      context.options.trackHudSprite(sprite);
    }
    const copyX = (56 * u - inset) / 2;
    const nameHeight = names.length * 20 * u;
    catalogText(context, card, 'RunRelicName', names.join('\n'), copyX,
      height / 2 - 8 * u - nameHeight / 2, effectWidth, nameHeight, 13, palette().accent);
    catalogText(context, card, 'RunRelicFrame', `${relic.frameName}回响`, copyX,
      height / 2 - nameHeight - 17 * u, effectWidth, 16 * u, 10, palette().textMuted);
    const effectHeight = lines.length * 17 * u;
    catalogText(context, card, 'RunRelicEffect', lines.join('\n'), copyX,
      height / 2 - nameHeight - 26 * u - effectHeight / 2, effectWidth, effectHeight, 11);
    cursor += height + gap;
  }
}

function renderInventoryEquipment(context: SheetContext, loadout: NonNullable<GameViewModel['sections'][1]['loadout']>): void {
  const u = catalogUnit(context);
  const headerHeight = 30 * u;
  catalogText(context, context.body, 'MobileSheetEquipmentBagHint', '点击装备查看属性与穿戴', 0,
    context.bodyHeight / 2 - headerHeight / 2, context.width, headerHeight, 11, palette().textMuted, true);
  const bodyHeight = context.bodyHeight - headerHeight;
  const body = node(context.body, 'MobileSheetEquipmentBagBody', 0, -headerHeight / 2, context.width, bodyHeight);
  const columns = INVENTORY_COLUMNS;
  const gap = 4 * u;
  const width = (context.width - (columns - 1) * gap) / columns;
  const entries = loadout.ownedEquipment;
  const names = entries.map(entry => wrapInfiniteFlowLine(entry.name, Math.max(3, Math.floor((width / u - 6) / 9))));
  const nameRows = Math.max(1, ...names.map(lines => lines.length));
  const height = (60 + nameRows * 13) * u;
  const rows = Math.ceil(entries.length / columns);
  const region = scrollRegion({ ...context, body, bodyHeight }, Math.max(bodyHeight, rows * (height + gap)));
  region.holder.name = 'MobileSheetEquipmentBagScroll';
  catalogScrollByFrame.set(context.panel, region.scrollView);
  region.scrollView.scrollToOffset(new Vec2(0, Math.min(Math.max(0, context.state.catalogScrollOffset ?? 0),
    Math.max(0, region.contentHeight - region.height))), 0);
  const content = scrollContentNode(region);
  entries.forEach((entry, index) => {
    const col = index % columns;
    const x = -context.width / 2 + width / 2 + col * (width + gap);
    const cursor = Math.floor(index / columns) * (height + gap);
    const card = panel(content, `MobileSheetInventoryEquipment:${entry.equipmentId}`, x,
      scrollItemY(region, cursor, height), width, height, palette().raised,
      entry.equipped ? palette().accent : qualityEdgeColor(equipmentQuality(entry.equipmentId), palette().edge), false, 'cell');
    figureNode(context, card, `InventoryEquipmentIcon:${entry.equipmentId}`, sheetEquipmentKey(entry.equipmentId),
      0, height / 2 - 23 * u, 32 * u, 36 * u, { glyph: entry.name.slice(-1), glyphSize: 20 * u, glyphColor: palette().text }, context.images);
    catalogText(context, card, 'InventoryEquipmentName', names[index]!.join('\n'), 0,
      height / 2 - (43 + nameRows * 6.5) * u, width - 6 * u, nameRows * 13 * u, 9, palette().text, true);
    catalogText(context, card, 'InventoryEquipmentStatus', entry.equipped ? '已装备' : `Lv.${entry.level} · ${entry.slotLabel}`,
      0, -height / 2 + 9 * u, width - 4 * u, 14 * u, 8, entry.equipped ? palette().accent : palette().textMuted, true);
    context.options.bindLocal(card, () => context.options.setState({ ...context.state,
      catalogScrollOffset: Math.max(0, region.scrollView.getScrollOffset().y), tip: { kind: 'equip', id: entry.equipmentId } }));
  });
  if (entries.length === 0) catalogText(context, content, 'MobileSheetEquipmentBagEmpty', '尚未拥有装备', 0,
    region.contentHeight / 2 - 32 * u, context.width, 40 * u, 13, palette().textMuted, true);
}

function renderInventory(context: SheetContext): void {
  // A legacy tab:'actions' state renders the real action list for state-level
  // fixtures, reached from a destination tile in other engines.
  if (context.state.tab === 'actions') {
    renderSheetActionView(context, 'inventory', '返回行囊', 'MobileSheetTab:bag');
    return;
  }
  const loadout = context.model.sections[1].loadout;
  if (!loadout) { renderTextPages(context, inventoryPages(context.model)); return; }
  const tabbed = tabs(context, [
    { id: 'bag', title: '补给品' },
    { id: 'equipment', title: `装备 ${loadout.ownedEquipment.length}` },
    { id: 'run-relics', title: `本局遗物 ${loadout.runRelics.length}` },
  ], 'bag');
  if (tabbed.active === 'run-relics') renderRunRelics(tabbed.context, loadout);
  else if (tabbed.active === 'equipment') renderInventoryEquipment(tabbed.context, loadout);
  else renderInventoryBag(tabbed.context, loadout);
}


function renderTabbedActions(context: SheetContext, pages: readonly SheetPage[], titles: readonly [string, string], initial: 'overview' | 'actions' = 'overview'): void {
  const tabbed = tabs(context, [{ id: 'overview', title: titles[0] }, { id: 'actions', title: titles[1] }], initial);
  if (tabbed.active === 'overview') renderTextPages(tabbed.context, pages);
  else renderActions(tabbed.context, getInfiniteFlowMobilePanelActions(context.model, context.state.kind));
}

function equipmentOfferContent(model: GameViewModel, state: MobileSheetState, width: number, u: number) {
  const detail = model.sections[1].detail;
  const choices = detail.kind === 'explore' && detail.pending?.kind === 'equipment-offer'
    ? detail.pending.equipmentOptions : undefined;
  if (!choices?.length) return undefined;
  const selected = choices.find(entry => entry.actionId === state.selectedActionId);
  const wrap = (value: string) => wrapInfiniteFlowLine(value, Math.max(8, Math.floor((width / u - 16) / 12)));
  const selectedAction = model.sections[2].actions.find(action => action.actionId === selected?.actionId);
  const facts = selected ? [
    { name: 'EquipmentOfferBaseStats', lines: wrap(`${selected.baseStatsLabel}：${selected.baseStatsReadout}`) },
    { name: 'EquipmentOfferAffix', lines: wrap(`固定词缀：${selected.affixReadout}`) },
    ...(selected.rollReadout ? [{ name: 'EquipmentOfferRoll', lines: wrap(selected.rollReadout) }] : []),
    ...(selectedAction?.readout ? [{ name: 'EquipmentOfferClaimReadout', lines: wrap(selectedAction.readout) }] : []),
    ...(selectedAction?.disabledReason ? [{ name: 'EquipmentOfferDisabledReason', lines: wrap(`不可用：${selectedAction.disabledReason}`) }] : []),
  ] : [];
  const names = choices.map(entry => wrapInfiniteFlowLine(entry.name, Math.max(5, Math.floor((width / u - 89) / 13))));
  const previews = choices.map(entry => wrapInfiniteFlowLine(entry.baseStatsReadout, Math.max(5, Math.floor((width / u - 89) / 11))));
  const rowHeights = names.map((lines, index) => Math.max(64, 16 + lines.length * 20 + 17 + previews[index]!.length * 17));
  const rowsHeight = rowHeights.reduce((sum, height) => sum + height, 0) + Math.max(0, choices.length - 1) * 6;
  const selectedName = selected ? wrapInfiniteFlowLine(selected.name, Math.max(8, Math.floor((width / u - 16) / 13))) : [];
  const factsHeight = facts.reduce((sum, fact) => sum + fact.lines.length * 18 + 8, 0);
  const detailHeight = selected ? 14 + selectedName.length * 20 + 6 + factsHeight : 0;
  const contentHeight = (26 + rowsHeight + detailHeight) * u;
  return { choices, selected, names, previews, facts, rowHeights, selectedName, contentHeight,
    bodyHeight: contentHeight + 52 * u };
}

function renderEquipmentOffer(context: SheetContext): void {
  const u = catalogUnit(context);
  const offer = equipmentOfferContent(context.model, context.state, context.width, u);
  if (!offer) { renderActions(context, getInfiniteFlowMobilePanelActions(context.model, 'interaction')); return; }
  const title = context.panel.getChildByName('MobileSheetTitle')?.getComponent(Label);
  if (title) title.string = '选择一件装备';
  const room = roomSheetDetail(context.model, context.state) !== undefined;
  const footerHeight = room ? roomSheetFooterHeight(u) : 52 * u;
  const bodyHeight = context.bodyHeight - footerHeight;
  const body = node(context.body, 'MobileSheetEquipmentOfferBody', 0, footerHeight / 2, context.width, bodyHeight);
  const region = scrollRegion({ ...context, body, bodyHeight }, offer.contentHeight);
  const content = scrollContentNode(region);
  const width = context.width;
  catalogText(context, content, 'EquipmentOfferKicker', `精英战利品 · ${offer.choices.length} 选 1`, 0,
    scrollItemY(region, 2 * u, 18 * u), context.width, 18 * u, 10, palette().textMuted);
  let cursor = 26 * u;
  offer.choices.forEach((entry, index) => {
    const height = offer.rowHeights[index]! * u;
    const selected = entry.equipmentId === offer.selected?.equipmentId;
    const card = panel(content, `MobileSheetEquipmentOffer:${entry.equipmentId}`, 0, scrollItemY(region, cursor, height),
      width, height, selected ? palette().accentDark : palette().quiet, selected ? palette().accent : palette().edge);
    figureNode(context, card, `EquipmentOfferIcon:${entry.equipmentId}`, sheetEquipmentKey(entry.equipmentId),
      -width / 2 + 32 * u, 0, 48 * u, 48 * u,
      { glyph: entry.name.slice(-1), glyphSize: 24, glyphColor: palette().text }, context.images);
    const nameHeight = offer.names[index]!.length * 20 * u;
    catalogText(context, card, 'EquipmentOfferName', offer.names[index]!.join('\n'), 20.5 * u,
      height / 2 - 8 * u - nameHeight / 2, width - 89 * u, nameHeight, 13, palette().text);
    catalogText(context, card, 'EquipmentOfferSlot', `Lv.${entry.level} · ${entry.slotLabel}`, 20.5 * u,
      height / 2 - 8 * u - nameHeight - 8.5 * u, width - 89 * u, 17 * u, 11, palette().textMuted);
    const previewHeight = offer.previews[index]!.length * 17 * u;
    catalogText(context, card, 'EquipmentOfferPreview', offer.previews[index]!.join('\n'), 20.5 * u,
      height / 2 - 8 * u - nameHeight - 17 * u - previewHeight / 2,
      width - 89 * u, previewHeight, 11, palette().textMuted);
    if (selected) catalogText(context, card, 'EquipmentOfferSelected', '✓', width / 2 - 12 * u,
      0, 20 * u, 20 * u, 12, palette().accent, true);
    context.options.bindLocal(card, () => context.options.setState({ ...context.state, selectedActionId: entry.actionId }));
    cursor += height + 6 * u;
  });
  if (offer.selected) {
    cursor -= 6 * u;
    catalogRule(content, 'EquipmentOfferDetailRule', scrollItemY(region, cursor + 6 * u, 0), context.width);
    const nameHeight = offer.selectedName.length * 20 * u;
    catalogText(context, content, 'EquipmentOfferDetailName', offer.selectedName.join('\n'), 0,
      scrollItemY(region, cursor + 14 * u, nameHeight), context.width - 16 * u, nameHeight, 13, palette().accent);
    cursor += 14 * u + nameHeight + 6 * u;
    for (const fact of offer.facts) {
      const height = fact.lines.length * 18 * u;
      catalogText(context, content, fact.name, fact.lines.join('\n'), 0,
        scrollItemY(region, cursor, height), context.width - 16 * u, height, 12, palette().text);
      cursor += height + 8 * u;
    }
  }
  const action = context.model.sections[2].actions.find(entry => entry.actionId === offer.selected?.actionId);
  const enabled = action !== undefined && canExecute(context, action);
  if (room) {
    roomSheetFooter(context, [roomSheetClose(context), { name: 'MobileSheetEquipmentClaim',
      label: context.options.chrome.busyActionId ? '正在收入背包' : '收入背包', caption: offer.selected ? offer.selected.name : '先选一件',
      primary: true, enabled, ...(enabled ? { action } : {}) }]);
    return;
  }
  const claimWidth = Math.min(148 * u, context.width);
  const claim = catalogButton(context, context.body, 'MobileSheetEquipmentClaim',
    context.options.chrome.busyActionId ? '正在收入背包' : '收入背包', context.width / 2 - claimWidth / 2,
    -context.bodyHeight / 2 + 22 * u, claimWidth, enabled, undefined, true);
  if (enabled) context.options.bindAction(claim, action!);
}

function rewardClaimContent(model: GameViewModel, state: MobileSheetState, width: number, u: number) {
  const detail = model.sections[1].detail;
  if (detail.kind !== 'explore' || !detail.rewardPreview || state.tab === 'reward-services'
    || (detail.pending && detail.pending.kind !== 'dungeon-event')) return undefined;
  const reward = detail.rewardPreview;
  const entries = [
    ...(reward.rewardPoints > 0 ? [{ id: 'reward-points', name: '奖励点', value: `+${reward.rewardPoints}`, visualAssetKey: undefined }] : []),
    ...(reward.lingyun > 0 ? [{ id: 'lingyun', name: '灵蕴', value: `+${reward.lingyun}`, visualAssetKey: undefined }] : []),
    ...reward.items.map(item => ({ id: item.itemId, name: item.name, value: `×${item.count}`, visualAssetKey: item.visualAssetKey })),
    ...(reward.healing > 0 ? [{ id: 'healing', name: '生命恢复', value: `+${reward.healing}`, visualAssetKey: undefined }] : []),
  ];
  const extras = getInfiniteFlowMobilePanelActions(model, 'interaction').filter(action => action.actionId !== reward.actionId);
  const names = entries.map(entry => wrapInfiniteFlowLine(entry.name, Math.max(5, Math.floor((width / u - 65) / 13))));
  const rowHeights = names.map(lines => Math.max(56, 16 + lines.length * 20 + 17));
  const action = model.sections[2].actions.find(candidate => candidate.actionId === reward.actionId);
  const hint = action?.disabledReason ? `不可用：${action.disabledReason}` : reward.relicDraftId
    ? '领取后，可选择一份回响' : '物资收入战利品袋';
  const hintLines = wrapInfiniteFlowLine(hint, Math.max(8, Math.floor(width / u / 11)));
  const contentHeight = (rowHeights.reduce((sum, height) => sum + height, 0)
    + Math.max(0, entries.length - 1) * 6 + 8 + hintLines.length * 17) * u;
  const footerHeight = 52 * u;
  return { reward, entries, extras, names, rowHeights, hintLines, contentHeight, footerHeight,
    bodyHeight: contentHeight + footerHeight };
}

function renderRewardClaim(context: SheetContext): void {
  const u = catalogUnit(context);
  const contentModel = rewardClaimContent(context.model, context.state, context.width, u);
  if (!contentModel) return;
  const { reward, entries, extras, names, rowHeights, hintLines, footerHeight } = contentModel;
  const bodyHeight = context.bodyHeight - footerHeight;
  const body = node(context.body, 'MobileSheetRewardBody', 0, footerHeight / 2, context.width, bodyHeight);
  const region = scrollRegion({ ...context, body, bodyHeight }, contentModel.contentHeight);
  const content = scrollContentNode(region);
  const width = context.width;
  let cursor = 0;
  entries.forEach((entry, index) => {
    const height = rowHeights[index]! * u;
    const card = panel(content, `MobileSheetRewardItem:${entry.id}`, 0, scrollItemY(region, cursor, height),
      width, height, palette().quiet, palette().edge);
    const imageX = -width / 2 + 28 * u;
    if (entry.visualAssetKey) figureNode(context, card, `RewardItemIcon:${entry.id}`, entry.visualAssetKey,
      imageX, 0, 40 * u, 40 * u, { glyph: entry.name.slice(-1), glyphSize: 22, glyphColor: palette().accent }, context.images);
    else catalogText(context, card, 'RewardResourceGlyph', entry.id === 'healing' ? '+' : '◇',
      imageX, 0, 40 * u, 40 * u, 26, palette().accent, true);
    const copyWidth = width - 65 * u;
    const copyX = 24.5 * u;
    const nameHeight = names[index]!.length * 20 * u;
    catalogText(context, card, 'RewardItemName', names[index]!.join('\n'), copyX,
      height / 2 - 8 * u - nameHeight / 2, copyWidth, nameHeight, 13, palette().text);
    catalogText(context, card, 'RewardItemValue', entry.value, copyX,
      height / 2 - 8 * u - nameHeight - 8.5 * u, copyWidth, 17 * u, 11, palette().accent);
    cursor += height + 6 * u;
  });
  if (entries.length) cursor -= 6 * u;
  catalogText(context, content, 'RewardClaimHint', hintLines.join('\n'),
    0, scrollItemY(region, cursor + 8 * u, hintLines.length * 17 * u), context.width, hintLines.length * 17 * u, 11, palette().textMuted);
  const action = context.model.sections[2].actions.find(candidate => candidate.actionId === reward.actionId);
  const enabled = action !== undefined && canExecute(context, action);
  const gap = 7 * u;
  const claimWidth = Math.min(148 * u, extras.length ? (context.width - gap) / 2 : context.width);
  const claim = catalogButton(context, context.body, 'MobileSheetRewardClaim',
    context.options.chrome.busyActionId ? '正在领取' : '领取奖励', context.width / 2 - claimWidth / 2,
    -context.bodyHeight / 2 + 22 * u, claimWidth, enabled, undefined, true);
  if (enabled) context.options.bindAction(claim, action!);
  if (extras.length) {
    const moreWidth = Math.min(148 * u, (context.width - gap) / 2);
    const more = catalogButton(context, context.body, 'MobileSheetRewardServices', '其他行动',
      context.width / 2 - claimWidth - gap - moreWidth / 2, -context.bodyHeight / 2 + 22 * u, moreWidth, true);
    context.options.bindLocal(more, () => context.options.setState({ kind: 'interaction', tab: 'reward-services', page: 0 }));
  }
}

function relicDraftContent(model: GameViewModel, state: MobileSheetState, width: number, u: number, receipt?: RewardPreviewViewModel) {
  const detail = model.sections[1].detail;
  const choices = detail.kind === 'explore' && detail.pending?.kind === 'relic-draft' ? detail.pending.relicOptions : undefined;
  if (!choices?.length) return undefined;
  const selected = choices.find(choice => choice.actionId === state.selectedActionId);
  const copyWidth = width / u - 89;
  const nameFont = 13;
  const descriptionFont = 11;
  const wrap = (value: string, font: number): string[] => {
    // Keep numeric bonuses and closing punctuation with their preceding token.
    return value.split('\n').flatMap(paragraph => {
      const tokens = paragraph.match(/(?:[+-]?\d+(?:\.\d+)?%?|.)[，。！？、；：,.!?;:）】]?/gu) ?? [];
      const lines: string[] = [];
      let line = '';
      for (const token of tokens) {
        if (line && catalogTextWidth(line + token, font) > copyWidth) {
          lines.push(line.trimEnd());
          line = token.trimStart();
        } else line += token;
      }
      lines.push(line);
      return lines;
    });
  };
  const names = choices.map(choice => wrap(choice.name, nameFont));
  const descriptions = choices.map(choice => {
    const action = model.sections[2].actions.find(candidate => candidate.actionId === choice.actionId);
    return wrap(choice.description + (action?.disabledReason ? `\n不可用：${action.disabledReason}` : ''), descriptionFont);
  });
  const rowHeights = choices.map((_choice, index) => Math.max(64, 16 + names[index]!.length * 20 + descriptions[index]!.length * 18));
  const receiptValues = receipt ? [
    receipt.rewardPoints > 0 ? `奖励点 +${receipt.rewardPoints}` : '',
    receipt.lingyun > 0 ? `灵蕴 +${receipt.lingyun}` : '',
    ...receipt.items.map(item => `${item.name} ×${item.count}`),
    receipt.healing > 0 ? `生命 +${receipt.healing}` : '',
  ].filter(Boolean).join(' · ') : '';
  const receiptLines = receiptValues ? wrapInfiniteFlowLine(receiptValues, Math.max(8, Math.floor(width / u / 11))) : [];
  const receiptHeight = 24 + (receiptLines.length ? receiptLines.length * 18 + 4 : 0);
  const cardTop = receiptHeight + 8;
  const footnoteLines = wrapInfiniteFlowLine('确认获得后立即生效，无需装备；仅本局有效。', Math.max(8, Math.floor(width / u / 11)));
  const rowsHeight = rowHeights.reduce((sum, height) => sum + height, 0) + Math.max(0, choices.length - 1) * 6;
  const contentHeight = (cardTop + rowsHeight + 8 + footnoteLines.length * 17) * u;
  return { choices, selected, names, descriptions, nameFont, descriptionFont,
    rowHeights, cardTop, receiptLines, receiptHeight, footnoteLines, contentHeight,
    bodyHeight: contentHeight + 52 * u };
}

function renderRelicDraft(context: SheetContext): void {
  const u = catalogUnit(context);
  const draft = relicDraftContent(context.model, context.state, context.width, u, context.options.rewardReceipt);
  if (!draft) return;
  const title = context.panel.getChildByName('MobileSheetTitle')?.getComponent(Label);
  if (title) title.string = '选择一份回响';
  const room = roomSheetDetail(context.model, context.state) !== undefined;
  const footerHeight = room ? roomSheetFooterHeight(u) : 52 * u;
  const bodyHeight = context.bodyHeight - footerHeight;
  const body = node(context.body, 'MobileSheetRelicDraftBody', 0, footerHeight / 2, context.width, bodyHeight);
  const region = scrollRegion({ ...context, body, bodyHeight }, draft.contentHeight);
  const content = scrollContentNode(region);
  const detail = context.model.sections[1].detail;
  const fromReward = context.options.rewardReceipt !== undefined || detail.kind === 'explore' && detail.currentNode.nodeType === 'reward';
  const statusWidth = context.width * 0.42;
  const headingWidth = context.width - statusWidth - 8 * u;
  catalogText(context, content, 'RelicDraftReceiptState', fromReward ? '✓ 物资已领取' : '选择后本局生效',
    -context.width / 2 + statusWidth / 2, scrollItemY(region, 0, 24 * u), statusWidth, 24 * u, 11, palette().positive);
  if (draft.receiptLines.length) catalogText(context, content, 'RelicDraftReceiptValues', draft.receiptLines.join('\n'), 0,
    scrollItemY(region, 26 * u, draft.receiptLines.length * 18 * u), context.width, draft.receiptLines.length * 18 * u, 11, palette().textMuted);
  catalogText(context, content, 'RelicDraftHeading', `${draft.choices[0]!.frameName}回响 · ${draft.choices.length} 选 1`,
    context.width / 2 - headingWidth / 2, scrollItemY(region, 0, 24 * u), headingWidth, 24 * u, 11, palette().accent);
  content.getChildByName('RelicDraftHeading')!.getComponent(Label)!.horizontalAlign = Label.HorizontalAlign.RIGHT;
  const width = context.width;
  let cursor = draft.cardTop * u;
  draft.choices.forEach((choice, index) => {
    const selected = choice.actionId === draft.selected?.actionId;
    const height = draft.rowHeights[index]! * u;
    const card = panel(content, `MobileSheetRelicOffer:${choice.relicId}`, 0, scrollItemY(region, cursor, height),
      width, height, selected ? palette().accentDark : palette().quiet, selected ? palette().accent : palette().edge);
    const imageName = `RelicOfferIcon:${choice.relicId}`;
    figureNode(context, card, imageName, choice.visualAssetKey, -width / 2 + 32 * u, 0, 48 * u, 48 * u,
      { glyph: choice.name.slice(-1), glyphSize: 24, glyphColor: palette().accent }, context.images);
    const nameHeight = draft.names[index]!.length * 20 * u;
    const descriptionHeight = draft.descriptions[index]!.length * 18 * u;
    catalogText(context, card, 'RelicOfferName', draft.names[index]!.join('\n'), 20.5 * u,
      height / 2 - 8 * u - nameHeight / 2,
      width - 89 * u, nameHeight, draft.nameFont, palette().text);
    catalogText(context, card, 'RelicOfferEffect', draft.descriptions[index]!.join('\n'), 20.5 * u,
      height / 2 - 8 * u - nameHeight - descriptionHeight / 2,
      width - 89 * u, descriptionHeight, draft.descriptionFont, palette().textMuted);
    if (selected) {
      const badge = panel(card, 'RelicOfferSelectedBadge', width / 2 - 16 * u, 0,
        16 * u, 16 * u, palette().accent, palette().accent);
      catalogText(context, badge, 'RelicOfferSelected', '✓', 0, 0, 16 * u, 16 * u, 11, palette().ink, true);
    }
    context.options.bindLocal(card, () => context.options.setState({ ...context.state, selectedActionId: choice.actionId }));
    cursor += height + 6 * u;
  });
  cursor -= 6 * u;
  catalogText(context, content, 'RelicDraftFootnote', draft.footnoteLines.join('\n'), 0,
    scrollItemY(region, cursor + 8 * u, draft.footnoteLines.length * 17 * u), context.width,
    draft.footnoteLines.length * 17 * u, 11, palette().textMuted);
  const action = context.model.sections[2].actions.find(candidate => candidate.actionId === draft.selected?.actionId);
  const enabled = action !== undefined && canExecute(context, action);
  if (room) {
    roomSheetFooter(context, [roomSheetClose(context), { name: 'MobileSheetRelicClaim',
      label: context.options.chrome.busyActionId ? '正在获得' : draft.selected ? `获得${draft.selected.name}` : '请选择一份回响',
      caption: '本局立即生效', primary: true, enabled, ...(enabled ? { action } : {}) }]);
    return;
  }
  const confirmWidth = Math.min(148 * u, context.width);
  const confirm = catalogButton(context, context.body, 'MobileSheetRelicClaim', context.options.chrome.busyActionId ? '正在获得'
    : draft.selected ? `获得${draft.selected.name}` : '请选择一份回响', context.width / 2 - confirmWidth / 2,
    -context.bodyHeight / 2 + 22 * u, confirmWidth, enabled, undefined, true);
  if (enabled) context.options.bindAction(confirm, action!);
}

// --- Room bottom sheet ---------------------------------------------------------
// A room's own interactions dock at the bottom like the route prototype's room sheet:
// portrait, kicker, title and story above the room's content, then a button row that
// starts with 收起. The room stays visible above it; gallery engines keep their frames.

const ROOM_SHEET_PENDING_KICKERS: Readonly<Record<NonNullable<ExploreDetailViewModel['pending']>['kind'], string>> = Object.freeze({
  'equipment-offer': '精英战', 'relic-draft': '回响', 'soul-recharge': '共鸣',
  'dungeon-event': '事件', 'field-survey': '调查', law: '法则',
});
const ROOM_SHEET_NODE_KICKERS: Readonly<Record<ExploreDetailViewModel['currentNode']['nodeType'], string>> = Object.freeze({
  monster: '遭遇战', trap: '陷阱', portal: '传送门', reward: '宝箱', exit: '出口',
});

function roomSheetDetail(model: GameViewModel, state: MobileSheetState): ExploreDetailViewModel | undefined {
  const detail = model.sections[1].detail;
  return activeCompact && state.kind === 'interaction' && detail.kind === 'explore' ? detail : undefined;
}

function roomSheetCompact(u: number): boolean {
  return 750 / u <= 350;
}

/** Absorbs float drift in the content-fit frame, so a list that fits never shows a scrollbar. */
const ROOM_SHEET_FIT_SLACK = 0.01;

/** The button row's band: a 12px gap above 52px buttons (46px on the narrow phone). */
function roomSheetFooterHeight(u: number): number {
  return ((roomSheetCompact(u) ? 46 : 52) + 12) * u;
}

type RoomSheetHeading = Readonly<{
  kicker: string;
  title: string;
  description: readonly string[];
  descriptionSize: number;
  descriptionHeight: number;
  artKey: string;
}>;

/** Wraps like wrapInfiniteFlowLine, but a line never starts with closing punctuation: the character before it moves down too. */
function wrapKeepingPunctuation(line: string, maxUnits: number): readonly string[] {
  const lines: string[] = [];
  let rest = line;
  while (rest.length > 0) {
    let head = wrapInfiniteFlowLine(rest, maxUnits)[0]!;
    const characters = Array.from(head);
    if (/^[，。！？、；：,.!?;:）」』】》]/u.test(rest.slice(head.length)) && characters.length >= 2) head = characters.slice(0, -1).join('');
    lines.push(head);
    rest = rest.slice(head.length);
  }
  return lines.length > 0 ? lines : [''];
}

type RoomSheetHeadingOf = (bodyWidth: number, u: number) => RoomSheetHeading;

function roomSheetHeadingFrom(kicker: string, title: string, source: string, artKey: string, bodyWidth: number, u: number): RoomSheetHeading {
  const descriptionSize = roomSheetCompact(u) ? 11.5 : 12.5;
  const description = source.length === 0 ? []
    : source.split('\n').flatMap(line => wrapKeepingPunctuation(line, Math.max(8, Math.floor(bodyWidth / u / descriptionSize))));
  return {
    kicker,
    title,
    description,
    descriptionSize,
    descriptionHeight: description.length * Math.ceil(Math.round(descriptionSize * u) * 1.5),
    artKey,
  };
}

function roomSheetHeading(detail: ExploreDetailViewModel, bodyWidth: number, u: number): RoomSheetHeading {
  const pending = detail.pending;
  const kicker = pending !== undefined ? ROOM_SHEET_PENDING_KICKERS[pending.kind]
    : detail.rewardPreview !== undefined ? detail.rewardPreview.lanternOil === undefined ? '宝箱' : '补给'
      : detail.currentNode.cleared ? '共鸣台' : ROOM_SHEET_NODE_KICKERS[detail.currentNode.nodeType];
  return roomSheetHeadingFrom(kicker, readable(pending?.title ?? detail.currentNode.title),
    readable(pending?.message ?? detail.currentNode.description), getInfiniteFlowRoomSheetArtKey(detail), bodyWidth, u);
}

/** The hub's claim sheet lists the tasks that wait to be turned in; it only exists while one does. */
function claimSheetTasks(model: GameViewModel, state: MobileSheetState): readonly GameViewModel['tasks'][number][] | undefined {
  const detail = model.sections[1].detail;
  if (!activeCompact || state.kind !== 'claims' || detail.kind !== 'hub' || detail.taskClaims === undefined) return undefined;
  const ready = model.tasks.filter(task => task.status === 'completed');
  return ready.length > 0 ? ready : undefined;
}

function claimSheetHeading(tasks: readonly GameViewModel['tasks'][number][]): RoomSheetHeadingOf {
  return (bodyWidth, u) => roomSheetHeadingFrom('主神任务', `${tasks.length} 项任务可领取`,
    tasks.some(task => task.kind === 'mainline') ? '奖励领取后立即入账；领取主线奖励会开启下一章。' : '奖励领取后立即入账。',
    INFINITE_FLOW_TASK_ENVOY_PORTRAIT_KEY, bodyWidth, u);
}

/** Bottom-docked frame with 10px side and bottom margins; like the window it replaces, it keeps 44px clear below the safe top. */
export function roomSheetFrameGeometry(detail: ExploreDetailViewModel, safeInsets: InfiniteFlowInfoSheetOptions['safeInsets'],
  surfaceHeight: number, viewportWidth = 390): SheetFrameGeometry {
  return headedSheetFrameGeometry((bodyWidth, u) => roomSheetHeading(detail, bodyWidth, u), safeInsets, surfaceHeight, viewportWidth);
}

function headedSheetFrameGeometry(headingOf: RoomSheetHeadingOf, safeInsets: InfiniteFlowInfoSheetOptions['safeInsets'],
  surfaceHeight: number, viewportWidth: number): SheetFrameGeometry {
  const u = 750 / viewportWidth;
  const pad = 14 * u;
  const width = 750 - safeInsets.left - safeInsets.right - 20 * u;
  const heading = headingOf(width - 2 * pad, u);
  const chromeHeight = 2 * pad + 64 * u + heading.descriptionHeight + (heading.description.length > 0 ? 8 * u : 0);
  const height = surfaceHeight - safeInsets.top - safeInsets.bottom - 54 * u;
  return {
    centerX: (safeInsets.left - safeInsets.right) / 2,
    centerY: -surfaceHeight / 2 + safeInsets.bottom + 10 * u + height / 2,
    width, height, bodyWidth: width - 2 * pad, bodyHeight: height - chromeHeight,
  };
}

function roomText(context: SheetContext, parent: Node, name: string, value: string, x: number, y: number,
  width: number, height: number, size: number, color: Color, centered = false): Label {
  catalogText(context, parent, name, value, x, y, width, height, size, color, centered);
  const label = parent.getChildByName(name)!.getComponent(Label)!;
  label.lineHeight = Math.ceil(label.fontSize * 1.3);
  return label;
}

function renderRoomSheetChrome(input: SheetChromeInput, headingOf: RoomSheetHeadingOf, frameName = 'MobileInfoSheet:interaction'): SheetLayoutChrome {
  const { root, options, geometry } = input;
  const { centerX, centerY, width, height, bodyWidth, bodyHeight } = geometry;
  const context = { options } as SheetContext;
  const u = catalogUnit(context);
  const pad = 14 * u;
  const heading = headingOf(bodyWidth, u);
  const frame = node(root, frameName, centerX, centerY, width, height);
  paintRoomSheetFrame(frame.addComponent(Graphics), width, height, u);
  frame.addComponent(BlockInputEvents);
  const top = height / 2 - pad;
  const left = -width / 2 + pad;
  // Header: framed portrait, then kicker and title beside it.
  const art = 52 * u;
  const artFrame = node(frame, 'MobileSheetRoomArt', left + art / 2, top - art / 2, art, art);
  const backing = artFrame.addComponent(Graphics);
  backing.lineWidth = u;
  backing.fillColor = DARK_UI.ink;
  backing.strokeColor = DARK_UI.edgeLight;
  backing.rect(-art / 2, -art / 2, art, art);
  backing.fill(); backing.stroke();
  figureNode(context, artFrame, 'MobileSheetRoomArtFigure', heading.artKey, 0, 0, art - 4 * u, art - 4 * u,
    { glyph: heading.kicker.slice(0, 1), glyphSize: 22, glyphColor: DARK_UI.gold }, options.images ?? getSheetFigures());
  const textLeft = left + art + 12 * u;
  const textWidth = width / 2 - pad - textLeft;
  roomText(context, frame, 'MobileSheetKicker', heading.kicker, textLeft + textWidth / 2, top - 12 * u, textWidth, 16 * u, 11, DARK_UI.gold);
  roomText(context, frame, 'MobileSheetTitle', heading.title, textLeft + textWidth / 2, top - 36 * u, textWidth, 26 * u,
    roomSheetCompact(u) ? 17 : 19, DARK_UI.bone).isBold = true;
  let cursor = top - 64 * u;
  if (heading.description.length > 0) {
    const description = roomText(context, frame, 'MobileSheetDescription', heading.description.join('\n'), 0,
      cursor - heading.descriptionHeight / 2, bodyWidth, heading.descriptionHeight, heading.descriptionSize, DARK_UI.muted);
    description.lineHeight = Math.ceil(description.fontSize * 1.5);
    description.verticalAlign = Label.VerticalAlign.TOP;
    cursor -= heading.descriptionHeight + 8 * u;
  }
  const body = node(frame, 'MobileSheetBody', 0, cursor - bodyHeight / 2, bodyWidth, bodyHeight);
  return { frame, body, width: bodyWidth, bodyHeight };
}

type RoomSheetButton = Readonly<{
  name: string;
  label: string;
  caption?: string;
  primary?: boolean;
  enabled: boolean;
  action?: ViewActionModel;
  activate?: () => void;
}>;

/** The prototype's one-tap row along the sheet's bottom; only enabled buttons bind. */
function roomSheetFooter(context: SheetContext, buttons: readonly RoomSheetButton[]): void {
  const u = catalogUnit(context);
  const compact = roomSheetCompact(u);
  const height = (compact ? 46 : 52) * u;
  const gap = 8 * u;
  const width = (context.width - gap * (buttons.length - 1)) / buttons.length;
  buttons.forEach((button, index) => {
    const control = node(context.body, button.name, -context.width / 2 + width / 2 + index * (width + gap),
      -context.bodyHeight / 2 + height / 2, width, height);
    const lit = button.primary === true && button.enabled;
    paintRoomSheetButton(control.addComponent(Graphics), width, height, u, button.primary === true, button.enabled);
    roomText(context, control, 'Label', button.label, 0, button.caption === undefined ? 0 : 8 * u, width - 8 * u, 24 * u,
      compact ? 14 : 15, lit ? ROOM_SHEET.primaryInk : button.enabled ? DARK_UI.bone : DARK_UI.muted, true).isBold = true;
    if (button.caption !== undefined) {
      roomText(context, control, 'Caption', button.caption, 0, -12 * u, width - 8 * u, 16 * u, 10,
        lit ? ROOM_SHEET.primaryCaption : DARK_UI.muted, true);
    }
    if (!button.enabled) return;
    if (button.action !== undefined) context.options.bindAction(control, button.action);
    else if (button.activate !== undefined) context.options.bindLocal(control, button.activate);
  });
}

function roomSheetClose(context: SheetContext): RoomSheetButton {
  return { name: 'MobileSheetClose', label: '收起', caption: '先看看门', enabled: true, activate: () => context.options.close() };
}

type RoomRewardRow = Readonly<{ id: string; name: string; value: string; tone: keyof typeof ROOM_SHEET.tones; visualAssetKey?: string }>;

/** The claim's actual gains as label/value rows, lamp oil included for supply rooms. */
function roomRewardContent(model: GameViewModel, state: MobileSheetState, u: number) {
  const detail = model.sections[1].detail;
  if (detail.kind !== 'explore' || !detail.rewardPreview || state.tab === 'reward-services'
    || (detail.pending && detail.pending.kind !== 'dungeon-event')) return undefined;
  const reward = detail.rewardPreview;
  const rows: readonly RoomRewardRow[] = [
    ...(reward.rewardPoints > 0 ? [{ id: 'reward-points', name: '奖励点', value: `+${reward.rewardPoints}`, tone: 'gold' as const }] : []),
    ...(reward.lingyun > 0 ? [{ id: 'lingyun', name: '灵蕴', value: `+${reward.lingyun}`, tone: 'gold' as const }] : []),
    ...reward.items.map(item => ({ id: item.itemId, name: item.name, value: `×${item.count}`, tone: 'neutral' as const,
      ...(item.visualAssetKey === undefined ? {} : { visualAssetKey: item.visualAssetKey }) })),
    ...(reward.healing > 0 ? [{ id: 'healing', name: '生命恢复', value: `+${reward.healing}`, tone: 'good' as const }] : []),
    ...(reward.lanternOil === undefined ? [] : [{ id: 'lantern-oil', name: '灯油', value: `+${reward.lanternOil}`, tone: 'gold' as const }]),
  ];
  const rowHeight = (roomSheetCompact(u) ? 26 : 29) * u;
  const contentHeight = rows.length * rowHeight;
  return { reward, rows, rowHeight, contentHeight, bodyHeight: contentHeight + roomSheetFooterHeight(u) };
}

function renderRoomRewardClaim(context: SheetContext): void {
  const u = catalogUnit(context);
  const content = roomRewardContent(context.model, context.state, u);
  if (!content) return;
  const footerHeight = roomSheetFooterHeight(u);
  const listHeight = context.bodyHeight - footerHeight;
  const body = node(context.body, 'MobileSheetRewardBody', 0, footerHeight / 2, context.width, listHeight);
  const region = scrollRegion({ ...context, body, bodyHeight: listHeight }, content.contentHeight);
  const list = scrollContentNode(region);
  const width = context.width;
  const rules = node(list, 'MobileSheetRewardRules', 0, 0, width, region.contentHeight).addComponent(Graphics);
  rules.lineWidth = Math.max(1, 0.6 * u);
  rules.strokeColor = new Color(DARK_UI.edge.r, DARK_UI.edge.g, DARK_UI.edge.b, 150);
  content.rows.forEach((row, index) => {
    const y = scrollItemY(region, index * content.rowHeight, content.rowHeight);
    for (const edge of index === content.rows.length - 1 ? [1, -1] : [1]) {
      rules.moveTo(-width / 2, y + edge * content.rowHeight / 2);
      rules.lineTo(width / 2, y + edge * content.rowHeight / 2);
      rules.stroke();
    }
    const item = node(list, `MobileSheetRewardItem:${row.id}`, 0, y, width, content.rowHeight);
    let nameLeft = -width / 2;
    if (row.visualAssetKey !== undefined) {
      figureNode(context, item, `RewardItemIcon:${row.id}`, row.visualAssetKey, nameLeft + 10 * u, 0, 20 * u, 20 * u,
        { glyph: row.name.slice(-1), glyphSize: 22, glyphColor: palette().accent }, context.images);
      nameLeft += 26 * u;
    }
    const nameWidth = width * 0.6 - (nameLeft + width / 2);
    roomText(context, item, 'RewardItemName', row.name, nameLeft + nameWidth / 2, 0, nameWidth, content.rowHeight, 12.5, DARK_UI.muted);
    roomText(context, item, 'RewardItemValue', row.value, width * 0.3, 0, width * 0.4, content.rowHeight, 12.5,
      ROOM_SHEET.tones[row.tone]).horizontalAlign = Label.HorizontalAlign.RIGHT;
  });
  const reward = content.reward;
  const action = context.model.sections[2].actions.find(candidate => candidate.actionId === reward.actionId);
  const enabled = action !== undefined && canExecute(context, action);
  const extras = getInfiniteFlowMobilePanelActions(context.model, 'interaction').filter(candidate => candidate.actionId !== reward.actionId);
  roomSheetFooter(context, [
    roomSheetClose(context),
    ...(extras.length > 0 ? [{ name: 'MobileSheetRewardServices', label: '其他行动', enabled: true,
      activate: () => context.options.setState({ kind: 'interaction', tab: 'reward-services', page: 0 }) }] : []),
    { name: 'MobileSheetRewardClaim', label: context.options.chrome.busyActionId ? '正在领取' : '领取奖励',
      caption: action?.disabledReason ? readable(action.disabledReason) : reward.relicDraftId ? '领取后选一份回响' : '物资收入战利品袋',
      primary: true, enabled, ...(enabled ? { action } : {}) },
  ]);
}

function claimSheetContent(tasks: readonly GameViewModel['tasks'][number][], u: number) {
  const rowHeight = (roomSheetCompact(u) ? 38 : 42) * u;
  return { rowHeight, contentHeight: tasks.length * rowHeight };
}

/** Each finished task with its reward, then 收起 and one button that claims them all. */
function renderTaskClaims(context: SheetContext): void {
  const tasks = claimSheetTasks(context.model, context.state);
  if (!tasks) return;
  const u = catalogUnit(context);
  const content = claimSheetContent(tasks, u);
  const footerHeight = roomSheetFooterHeight(u);
  const listHeight = context.bodyHeight - footerHeight;
  const body = node(context.body, 'MobileSheetClaimBody', 0, footerHeight / 2, context.width, listHeight);
  const region = scrollRegion({ ...context, body, bodyHeight: listHeight }, content.contentHeight);
  const list = scrollContentNode(region);
  const width = context.width;
  const rules = node(list, 'MobileSheetClaimRules', 0, 0, width, region.contentHeight).addComponent(Graphics);
  rules.lineWidth = Math.max(1, 0.6 * u);
  rules.strokeColor = new Color(DARK_UI.edge.r, DARK_UI.edge.g, DARK_UI.edge.b, 150);
  const tagWidth = 30 * u;
  tasks.forEach((task, index) => {
    const y = scrollItemY(region, index * content.rowHeight, content.rowHeight);
    rules.moveTo(-width / 2, y - content.rowHeight / 2);
    rules.lineTo(width / 2, y - content.rowHeight / 2);
    rules.stroke();
    const row = node(list, `MobileSheetClaimTask:${task.id}`, 0, y, width, content.rowHeight);
    const mainline = task.kind === 'mainline';
    roomText(context, row, 'ClaimTaskKind', mainline ? '主线' : '支线', -width / 2 + tagWidth / 2, 8 * u, tagWidth, 18 * u, 10.5,
      mainline ? DARK_UI.gold : DARK_UI.muted, true);
    const textLeft = -width / 2 + tagWidth + 6 * u;
    const textWidth = width / 2 - textLeft;
    roomText(context, row, 'ClaimTaskTitle', readable(task.title), textLeft + textWidth / 2, 8 * u, textWidth, 20 * u, 13, DARK_UI.bone).isBold = true;
    roomText(context, row, 'ClaimTaskReward', readable(task.rewardText), textLeft + textWidth / 2, -10 * u, textWidth, 16 * u, 11, ROOM_SHEET.tones.gold);
  });
  const detail = context.model.sections[1].detail;
  const action = detail.kind === 'hub' ? detail.taskClaims?.action : undefined;
  const enabled = action !== undefined && canExecute(context, action);
  roomSheetFooter(context, [
    { name: 'MobileSheetClose', label: '收起', caption: '稍后找任务使者', enabled: true, activate: () => context.options.close() },
    { name: 'MobileSheetClaimAll', label: context.options.chrome.busyActionId ? '正在领取' : '全部领取',
      caption: action?.disabledReason ? readable(action.disabledReason) : '奖励立即入账', primary: true, enabled, ...(enabled ? { action } : {}) },
  ]);
}

/** Compact production frame limits, also used by the gallery baseline. */
export function productionFrameGeometry(safeInsets: InfiniteFlowInfoSheetOptions['safeInsets'], surfaceHeight: number, _kind: MobilePanelKind = 'entry', viewportWidth = 390): SheetFrameGeometry {
  const u = 750 / viewportWidth;
  const padding = (viewportWidth <= 350 ? 11 : 12) * u;
  const width = Math.min(304 * u, 750 - safeInsets.left - safeInsets.right - 40 * u);
  const available = surfaceHeight - safeInsets.top - safeInsets.bottom - 88 * u;
  const height = Math.min(464 * u, available);
  const centerX = (safeInsets.left - safeInsets.right) / 2;
  const centerY = (safeInsets.bottom - safeInsets.top) / 2;
  return { centerX, centerY, width, height, bodyWidth: width - 2 * padding, bodyHeight: height - 48 * u - 2 * padding };
}

function buildBackdrop(root: Node, surfaceHeight: number, transparent = false): Node {
  const backdrop = node(root, 'MobileSheetBackdrop', 0, 0, 750, surfaceHeight);
  const shade = backdrop.addComponent(Graphics);
  shade.fillColor = transparent ? withAlpha(palette().backdrop, 0) : palette().backdrop;
  shade.rect(-375, -surfaceHeight / 2, 750, surfaceHeight);
  shade.fill();
  backdrop.addComponent(BlockInputEvents);
  return backdrop;
}

/** Native scroll body shared only by HUD popovers and nested item tips. */
function overlayScroll(parent: Node, name: string, y: number, width: number, height: number,
  contentHeight: number, u: number): Readonly<{ content: Node; scrollView: ScrollView }> {
  const holder = node(parent, name, 0, y, width, height);
  holder.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
  const totalHeight = Math.max(height, contentHeight);
  const content = node(holder, `${name}Content`, 0, (height - totalHeight) / 2, width, totalHeight);
  const scrollView = holder.addComponent(ScrollView);
  scrollView.content = content;
  scrollView.horizontal = false;
  scrollView.vertical = true;
  scrollView.inertia = true;
  scrollView.brake = 0.75;
  scrollView.elastic = true;
  scrollView.bounceDuration = 0.15;
  if (contentHeight > height) {
    const thumbHeight = Math.min(height, Math.max(18 * u, height * height / contentHeight));
    const thumb = node(holder, `${name}Thumb`, width / 2 - 1.5 * u,
      height / 2 - thumbHeight / 2, 3 * u, thumbHeight);
    const paint = thumb.addComponent(Graphics);
    paint.fillColor = withAlpha(palette().accent, 160);
    paint.rect(-1.5 * u, -thumbHeight / 2, 3 * u, thumbHeight);
    paint.fill();
    holder.on(ScrollView.EventType.SCROLLING, () => {
      const progress = Math.max(0, Math.min(1, scrollView.getScrollOffset().y / (contentHeight - height)));
      thumb.setPosition(new Vec3(width / 2 - 1.5 * u,
        height / 2 - thumbHeight / 2 - progress * (height - thumbHeight), 0));
    });
  }
  return { content, scrollView };
}

/** Small HUD overlays share scene-owned art, but do not enter the full-sheet layout. */
function renderHudPopover(root: Node, model: GameViewModel, state: MobileSheetState,
  options: InfiniteFlowInfoSheetOptions, surfaceHeight: number): void {
  const viewportWidth = options.viewportWidth;
  if (viewportWidth === undefined || !Number.isFinite(viewportWidth) || viewportWidth <= 0) {
    throw new Error('HUD popover requires the current viewportWidth in CSS pixels.');
  }
  const layout = getWalkHudLayout(viewportWidth);
  const u = layout.pixel;
  const isRelics = state.tab === 'hud-relics';
  const isParty = state.tab === 'hud-party';
  const isList = isRelics || isParty;
  const relics = model.sections[1].loadout?.runRelics ?? [];
  const party = (model.sections[1].loadout?.runParty ?? []).filter(member => member.visualAssetKey !== undefined);
  const owned = isRelics
    ? relics.map(relic => ({ id: relic.relicId, name: relic.name, description: relic.description, key: getInfiniteFlowRunRelicVisualKey(relic.relicId) }))
    : isParty ? party.map(member => ({ id: member.kind, name: member.name, description: member.description, key: member.visualAssetKey! })) : [];
  const rowName = isParty ? 'HudParty' : 'HudRelic';
  const trackSprite = options.trackHudSprite;
  if (owned.length > 0 && trackSprite === undefined) {
    throw new Error('HUD relic popover requires trackHudSprite for scene-owned icon sprites.');
  }
  const colors = palette();
  const safeWidth = viewportWidth - (options.safeInsets.left + options.safeInsets.right) / u;
  const width = Math.min(264, 304, safeWidth - 40);
  const safeHeight = (surfaceHeight - options.safeInsets.top - options.safeInsets.bottom) / u;
  const maxHeight = Math.min(464, safeHeight - 88);
  if (width <= 0 || maxHeight <= 60) throw new Error('HUD popover does not fit the current safe viewport.');
  const innerWidth = width - 32;
  const wrap = (value: string, size: number, availableWidth: number): readonly string[] =>
    value.split('\n').flatMap(line => wrapInfiniteFlowLine(line, Math.floor(availableWidth / size)));
  // Resolve all required art before creating the backdrop, so a load failure
  // cannot leave a partially rendered popup with a silently missing icon.
  const rows = owned.map((relic, index) => {
    const key = relic.key;
    const visual = options.hudVisual?.(key);
    if (visual === undefined) throw new Error(`HUD relic icon is not loaded: ${key}`);
    const copyWidth = innerWidth - 44;
    const nameLines = wrap(relic.name, 13, copyWidth);
    const effectLines = wrap(relic.description, 11, copyWidth);
    const nameHeight = nameLines.length * 20;
    const effectHeight = effectLines.length * 18;
    const insetTop = index === 0 ? 0 : 8;
    const insetBottom = index === owned.length - 1 ? 0 : 8;
    const height = insetTop + Math.max(30, nameHeight + 3 + effectHeight) + insetBottom;
    return { relic, visual, copyWidth, nameLines, effectLines, nameHeight, effectHeight, insetTop, height };
  });
  const metricId = state.tab === 'hud-reward-points' ? 'reward-points' : 'lingyun';
  const metric = isList ? undefined : model.sections[1].metrics.find(entry => entry.id === metricId);
  if (!isList && metric === undefined) throw new Error(`HUD resource metric is unavailable: ${metricId}`);
  const resourceLines = metric === undefined ? [] : wrap(`${metric.label}：${metric.value}`, 13, innerWidth - 4);
  const contentHeight = isList ? Math.max(20, rows.reduce((total, row) => total + row.height, 0))
    : Math.max(20, resourceLines.length * 20);
  const headerHeight = 32;
  const bodyHeight = Math.min(contentHeight, 300, maxHeight - headerHeight - 28);
  const height = headerHeight + bodyHeight + 28;
  const strips = getWalkHudStrips(layout, relics.length, party.length);
  const anchorX = isRelics
    ? strips.relicLeft + strips.relicWidth / 2
    : isParty ? strips.partyLeft + strips.partyWidth / 2
    : state.tab === 'hud-reward-points'
      ? layout.rewardLeft + layout.rewardWidth / 2 : layout.jadeLeft + layout.jadeWidth / 2;
  const leftInset = options.safeInsets.left / u + 20;
  const popupLeft = Math.max(leftInset, Math.min(anchorX - 24,
    viewportWidth - options.safeInsets.right / u - 20 - width));
  const popupTop = Math.max(44, Math.min(isList ? 98 : 50, safeHeight - 44 - height));
  const surfaceTop = surfaceHeight / 2 - options.safeInsets.top;
  const backdrop = buildBackdrop(root, surfaceHeight, true);
  backdrop.name = 'HudPopoverBackdrop';
  options.bindLocal(backdrop, options.close);
  const card = panel(backdrop, isRelics ? 'HudRelicPopover' : isParty ? 'HudPartyPopover' : 'HudResourcePopover',
    -375 + (popupLeft + width / 2) * u, surfaceTop - (popupTop + height / 2) * u,
    width * u, height * u, colors.surface, colors.edgeStrong, true, 'sheet');
  card.addComponent(BlockInputEvents);
  const arrowX = Math.max(12, Math.min(anchorX - popupLeft, width - 12));
  const arrow = node(card, 'HudPopoverArrow', (arrowX - width / 2) * u, height * u / 2, 10 * u, 5 * u).addComponent(Graphics);
  arrow.fillColor = colors.surface;
  arrow.strokeColor = colors.edgeStrong;
  arrow.lineWidth = u;
  arrow.moveTo(-5 * u, 0); arrow.lineTo(0, 5 * u); arrow.lineTo(5 * u, 0);
  arrow.fill(); arrow.stroke();
  const label = (parent: Node, name: string, lines: readonly string[], x: number, y: number,
    labelWidth: number, labelHeight: number, size: number, lineHeight: number, color: Color): void => {
    const component = node(parent, name, x * u, y * u, labelWidth * u, labelHeight * u).addComponent(Label);
    component.string = lines.join('\n');
    component.fontSize = size * u;
    component.lineHeight = lineHeight * u;
    component.color = color;
    component.horizontalAlign = Label.HorizontalAlign.LEFT;
    component.verticalAlign = Label.VerticalAlign.TOP;
    component.enableWrapText = false;
    component.overflow = Label.Overflow.CLAMP;
  };
  label(card, 'HudPopoverTitle', [isRelics ? '本局遗物' : isParty ? '出战阵容' : metric!.label], -12,
    height / 2 - 26, innerWidth - 24, 20, 12, 20, colors.accent);
  const region = overlayScroll(card, 'HudPopoverScroll',
    (height / 2 - 16 - headerHeight - bodyHeight / 2) * u,
    innerWidth * u, bodyHeight * u, contentHeight * u, u);
  const totalHeight = Math.max(bodyHeight, contentHeight);
  let cursor = 0;
  for (const [index, row] of rows.entries()) {
    const rowWidth = innerWidth - 4;
    const holder = node(region.content, `${rowName}Row:${row.relic.id}`, -2 * u,
      (totalHeight / 2 - cursor - row.height / 2) * u, rowWidth * u, row.height * u);
    if (index > 0) {
      const divider = node(holder, `${rowName}Divider`, 0, row.height * u / 2, rowWidth * u, u).addComponent(Graphics);
      divider.strokeColor = withAlpha(colors.edge, 110);
      divider.lineWidth = u;
      divider.moveTo(-rowWidth * u / 2, 0); divider.lineTo(rowWidth * u / 2, 0); divider.stroke();
    }
    const contentTop = row.height / 2 - row.insetTop;
    const image = node(holder, `${rowName}Icon:${row.relic.id}`, (-rowWidth / 2 + 15) * u,
      (contentTop - 15) * u, 30 * u, 30 * u).addComponent(Sprite);
    const imageScale = Math.min(30 * u / row.visual.width, 30 * u / row.visual.height);
    image.node.getComponent(UITransform)!.setContentSize(new Size(row.visual.width * imageScale, row.visual.height * imageScale));
    image.sizeMode = Sprite.SizeMode.CUSTOM;
    image.trim = false;
    image.spriteFrame = row.visual.frame;
    trackSprite!(image);
    const textX = -rowWidth / 2 + 40 + row.copyWidth / 2;
    label(holder, `${rowName}Name`, row.nameLines, textX, contentTop - row.nameHeight / 2,
      row.copyWidth, row.nameHeight, 13, 20, colors.text);
    label(holder, `${rowName}Effect`, row.effectLines, textX, contentTop - row.nameHeight - 3 - row.effectHeight / 2,
      row.copyWidth, row.effectHeight, 11, 18, colors.textMuted);
    cursor += row.height;
  }
  if (!isList) label(region.content, 'HudResourceValue', resourceLines, -2,
    totalHeight / 2 - resourceLines.length * 10, innerWidth - 4,
    resourceLines.length * 20, 13, 20, colors.text);
  if (isRelics && rows.length === 0) label(region.content, 'HudRelicEmpty', ['本局尚未获得遗物。'], -2,
    0, innerWidth - 4, 20, 11, 20, colors.textMuted);
  const close = node(card, 'HudPopoverClose', (width / 2 - 24) * u, (height / 2 - 24) * u, 44 * u, 44 * u);
  const glyph = node(close, 'HudPopoverCloseGlyph', 0, 0, 24 * u, 24 * u).addComponent(Label);
  glyph.string = '×';
  glyph.fontSize = 18 * u;
  glyph.lineHeight = 24 * u;
  glyph.color = colors.accent;
  glyph.horizontalAlign = Label.HorizontalAlign.CENTER;
  glyph.verticalAlign = Label.VerticalAlign.CENTER;
  options.bindLocal(close, options.close);
}

export function productionRenderChrome(input: SheetChromeInput): SheetLayoutChrome {
  const { root, model, state, options, geometry } = input;
  const { centerX, centerY, width, height, bodyWidth, bodyHeight } = geometry;
  const u = 750 / (options.viewportWidth ?? 390);
  const headerHeight = 48 * u;
  const padding = (options.viewportWidth !== undefined && options.viewportWidth <= 350 ? 11 : 12) * u;
  const bandY = height / 2 - padding - headerHeight / 2;
  const frame = panel(root, `MobileInfoSheet:${state.kind}`, centerX, centerY, width, height, palette().surface, palette().edgeStrong, true, 'sheet');
  frame.addComponent(BlockInputEvents);
  const band = node(frame, 'MobileSheetTitleBand', 0, bandY, bodyWidth, headerHeight);
  const rule = band.addComponent(Graphics);
  rule.strokeColor = palette().edge; rule.lineWidth = u;
  rule.moveTo(-bodyWidth / 2, -headerHeight / 2 + 4 * u);
  rule.lineTo(bodyWidth / 2, -headerHeight / 2 + 4 * u); rule.stroke();
  const headerIcon = icon(frame, 'MobileSheetHeaderIcon', state.kind, -width / 2 + padding + 9 * u, bandY, palette().accent);
  headerIcon.setScale(new Vec3(18 * u / 64, 18 * u / 64, 1));
  const detail = model.sections[1].detail;
  const title = state.kind === 'npc' && detail.kind === 'hub' ? detail.shop?.title ?? detail.activePanelLabel
    : state.kind === 'interaction' && detail.kind === 'explore' ? detail.pending?.title ?? detail.currentNode.title
      : combatChoiceTitle(state) ?? TITLES[state.kind];
  const titleContext = { options } as SheetContext;
  const isChest = state.kind === 'interaction' && detail.kind === 'explore' && detail.rewardPreview !== undefined
    && detail.pending?.kind !== 'relic-draft' && detail.pending?.kind !== 'equipment-offer';
  if (isChest) {
    headerIcon.destroy();
    figureNode(titleContext, frame, 'RewardChestImage', 'scene:dungeon_prop_chest',
      -width / 2 + padding + 20 * u, bandY, 40 * u, 40 * u,
      { glyph: '箱', glyphSize: 16 * u, glyphColor: palette().accent }, options.images ?? getSheetFigures());
  }
  catalogText(titleContext, frame, 'MobileSheetTitle', readable(title), isChest ? 0 : -12 * u,
    bandY, bodyWidth - (isChest ? 94 : 66) * u, 27 * u, 16, palette().accent);
  const close = node(frame, 'MobileSheetClose', width / 2 - padding - 22 * u, bandY, 44 * u, 44 * u);
  const closeGlyph = node(close, 'CloseIcon', 0, 0, 18 * u, 24 * u);
  catalogText(titleContext, closeGlyph, 'CloseLabel', '×', 0, 0, 18 * u, 24 * u, 18, palette().accent, true);
  options.bindLocal(close, options.close);
  const body = node(frame, 'MobileSheetBody', 0, -headerHeight / 2, bodyWidth, bodyHeight);
  return { frame, body, width: bodyWidth, bodyHeight };
}

/**
 * Pre-WoW frame metrics for the gallery engines S02-S10. Their bodies were
 * authored against the 702×1080 canvas with a 284px chrome reserve; keeping the
 * legacy geometry here isolates the production redesign from those engines.
 * The baseline style S01 takes the inline production path instead and so
 * always renders the new geometry/chrome.
 */
export function legacyGalleryFrameGeometry(safeInsets: InfiniteFlowInfoSheetOptions['safeInsets'], surfaceHeight: number): SheetFrameGeometry {
  const width = Math.min(702, 750 - safeInsets.left - safeInsets.right - 32);
  const height = Math.min(1080, surfaceHeight - safeInsets.top - safeInsets.bottom - 52);
  const centerX = (safeInsets.left - safeInsets.right) / 2;
  const centerY = (safeInsets.bottom - safeInsets.top) / 2 - 12;
  return { centerX, centerY, width, height, bodyWidth: width - 40, bodyHeight: height - 284 };
}

/** Legacy chrome (no gold title band) matching legacyGalleryFrameGeometry. */
export function legacyGalleryRenderChrome(input: SheetChromeInput): SheetLayoutChrome {
  const { root, model, state, options, geometry } = input;
  const { centerX, centerY, width, height, bodyWidth, bodyHeight } = geometry;
  const frame = panel(root, `MobileInfoSheet:${state.kind}`, centerX, centerY, width, height, palette().surface, palette().edgeStrong, true, 'sheet');
  frame.addComponent(BlockInputEvents);
  icon(frame, 'MobileSheetHeaderIcon', state.kind, -width / 2 + 56, height / 2 - 66);
  const detail = model.sections[1].detail;
  const title = state.kind === 'npc' && detail.kind === 'hub' ? detail.shop?.title ?? detail.activePanelLabel
    : state.kind === 'interaction' && detail.kind === 'explore' ? detail.pending?.title ?? detail.currentNode.title
      : combatChoiceTitle(state) ?? TITLES[state.kind];
  text(frame, 'MobileSheetTitle', readable(title), -12, height / 2 - 66, width - 228, 84, 34, palette().text);
  const close = panel(frame, 'MobileSheetClose', width / 2 - 70, height / 2 - 66, TOUCH, TOUCH, palette().raised, palette().edgeStrong, false, 'iconButton');
  icon(close, 'CloseIcon', 'close', 0, 0, palette().text);
  options.bindLocal(close, options.close);
  const body = node(frame, 'MobileSheetBody', 0, 0, bodyWidth, bodyHeight);
  return { frame, body, width: bodyWidth, bodyHeight };
}

const ITEM_CATEGORY_LABELS: Readonly<Record<string, string>> = Object.freeze({
  combat: '战术道具 · 战用',
  ward: '战术道具 · 防护',
  portal: '战术道具 · 门钥',
  capture: '战术道具 · 捕伏',
});

const EQUIP_STAT_LABELS: Readonly<Record<string, string>> = Object.freeze({
  attack: '攻击', maxHp: '最大生命', defense: '防御', artPower: '术法强度',
  speed: '速度', agility: '身法', spirit: '心神', body: '体魄', luck: '气运', trapCheck: '陷阱感知',
});

// WoW rarity (UI-only projection; the domain model has no rarity field).
// Tiers follow the classic WoW quality ladder. Equipment rarity derives from
// the catalog price tier (reward points / lingyun cost); only the six free
// starter pieces are explicitly poor. Items follow the accepted prototype
// mapping (three utility pieces are uncommon).
type SheetQuality = 'poor' | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
const QUALITY_LABEL: Readonly<Record<SheetQuality, string>> = Object.freeze({
  poor: '粗糙', common: '普通', uncommon: '优秀', rare: '精良', epic: '史诗', legendary: '传说',
});
// Name colors: classic WoW tints, with rare/epic brightened so dark tooltips
// keep the >=4.5 contrast contract.
const QUALITY_NAME_COLORS: Readonly<Record<SheetQuality, Color | undefined>> = Object.freeze({
  poor: new Color(157, 157, 157, 255),       // #9d9d9d
  common: undefined,                          // palette text (white)
  uncommon: new Color(30, 255, 0, 255),      // #1eff00
  rare: new Color(89, 156, 255, 255),        // brighter #599cff (WoW #0070dd)
  epic: new Color(187, 119, 255, 255),       // brighter #bb77ff (WoW #a335ee)
  legendary: new Color(255, 128, 0, 255),    // #ff8000
});
// Border tints use the saturated classic WoW quality colors (edges are
// decorative, so the pure hues read as the familiar slot glow).
const QUALITY_EDGE_COLORS: Readonly<Record<SheetQuality, Color | undefined>> = Object.freeze({
  poor: new Color(106, 106, 106, 255),       // #6a6a6a
  common: undefined,                          // default iron edge
  uncommon: new Color(47, 158, 34, 255),     // #2f9e22
  rare: new Color(0, 112, 221, 255),         // #0070dd
  epic: new Color(163, 53, 238, 255),        // #a335ee
  legendary: new Color(255, 128, 0, 255),    // #ff8000
});
const POOR_EQUIPMENT = new Set<string>([
  'training_blade', 'patched_headwrap', 'patched_coat', 'patched_gloves',
  'patched_boots', 'patched_belt',
]);
const UNCOMMON_ITEMS = new Set<string>(['gate_sigil', 'capture_net', 'spirit_bait']);
function equipmentQuality(id: string): SheetQuality {
  if (POOR_EQUIPMENT.has(id)) return 'poor';
  const rewardPoints = EQUIPMENT[id as keyof typeof EQUIPMENT]?.cost.rewardPoints ?? 0;
  if (rewardPoints <= 540) return 'common';
  if (rewardPoints <= 1020) return 'uncommon';
  if (rewardPoints <= 1460) return 'rare';
  if (rewardPoints <= 1980) return 'epic';
  return 'legendary';
}
function itemQuality(id: string): SheetQuality {
  return UNCOMMON_ITEMS.has(id) ? 'uncommon' : 'common';
}
function qualityNameColor(quality: SheetQuality, fallback: Color): Color {
  return QUALITY_NAME_COLORS[quality] ?? fallback;
}
function qualityEdgeColor(quality: SheetQuality, fallback: Color): Color {
  return QUALITY_EDGE_COLORS[quality] ?? fallback;
}

// CSS-pixel measurements; the nested card always fits its parent frame.
const TIP_WIDTH = 304;
const TIP_PAD = 12;
const TIP_LINE = 17;
const TIP_TITLE_LINE = 18;
const TIP_BUTTON_H = 32;

type TipLine = Readonly<{ text: string; color: Color; italic?: boolean }>;

/** Resolve the hub supplies toggle action even when another hub panel is active. */
function resolveCarryToggle(context: SheetContext, itemId: ItemId): ViewActionModel | undefined {
  const actionId = `hub.supplies.toggle:${itemId}`;
  const local = context.model.sections[2].actions.find((action) => action.actionId === actionId);
  if (local) return local;
  return context.options.supplyActions?.(itemId).find((action) => action.actionId === actionId);
}

/** Pinned WoW GameTooltip; mounted as a frame child so scroll masks never clip it. */
function renderSheetTip(context: SheetContext, backdrop: Node): void {
  const tip = context.state.tip;
  if (!tip) return;
  const palette0 = palette();
  const u = catalogUnit(context);
  const frameWidth = context.panel.getComponent(UITransform)!.contentSize.width;
  const tipWidth = Math.min((750 / u <= 350 ? 278 : TIP_WIDTH) * u, frameWidth);
  const copyWidth = tipWidth - (TIP_PAD * 2 + 4) * u;
  const wrap = (value: string, size: number): readonly string[] => value.split('\n')
    .flatMap(line => wrapInfiniteFlowLine(line, Math.max(1, Math.floor(copyWidth / (size * u)))));
  const loadout = context.model.sections[1].loadout;
  const lines: TipLine[] = [];
  let carryAction: ViewActionModel | undefined;
  let medicineAction: ViewActionModel | undefined;
  let equipmentAction: ViewActionModel | undefined;
  let equipmentEquipped = false;
  let carried = false;
  let carriedCount = loadout?.carriedCount ?? 0;

  if (tip.kind === 'equip') {
    const owned = context.state.kind === 'inventory'
      ? loadout?.ownedEquipment.find(entry => entry.equipmentId === tip.id) : undefined;
    const equipped = loadout?.equipment.find((entry) => entry.equipmentId === tip.id);
    const definition = EQUIPMENT[tip.id as keyof typeof EQUIPMENT];
    const quality = equipmentQuality(tip.id);
    lines.push({ text: owned?.name ?? equipped?.name ?? definition?.name ?? tip.id, color: qualityNameColor(quality, palette0.text) });
    if (owned) {
      equipmentAction = owned.equipAction;
      equipmentEquipped = owned.equipped;
      const append = (value: string, color = palette0.textMuted): void => {
        lines.push({ text: value, color });
      };
      append(`${owned.slotLabel} · Lv.${owned.level}/${owned.maxLevel}${owned.equipped ? ' · 已装备' : ''}`);
      append(`${owned.baseStatsLabel}：${owned.baseStatsReadout}`, palette0.positive);
      if (owned.growthStatsReadout) append(`每级成长：${owned.growthStatsReadout}`);
      append(`固定词缀：${owned.affixReadout}`, palette0.accent);
      if (owned.rollReadout) append(owned.rollReadout, palette0.accent);
      if (!equipmentAction.enabled && equipmentAction.disabledReason && !owned.equipped) {
        append(equipmentAction.disabledReason, palette0.danger);
      }
    } else if (definition) {
      if (equipped) lines.push({ text: `${equipped.slotLabel} · ${QUALITY_LABEL[quality]} · 等阶 Lv.${equipped.level}/${equipped.maxLevel} · 已装备`, color: palette0.textMuted });
      for (const [key, value] of Object.entries(definition.base)) {
        if (typeof value !== 'number' || value === 0) continue;
        const label = EQUIP_STAT_LABELS[key] ?? key;
        lines.push({ text: `${label} ${value > 0 ? '+' : ''}${value}`, color: palette0.positive });
      }
      lines.push({ text: definition.description, color: palette0.positive });
      const flavor = getGameAsset('equipment', tip.id)?.alt;
      if (flavor) lines.push({ text: flavor, color: palette0.accent, italic: true });
      const cost = definition.cost.rewardPoints;
      if (cost !== undefined) lines.push({ text: `兑换价：${cost} 奖励点 · 等阶上限 ${definition.maxLevel}`, color: palette0.textMuted });
    }
  } else {
    const entry = loadout?.items.find((item) => item.itemId === tip.id);
    const definition = ITEMS[tip.id as keyof typeof ITEMS];
    const quality = itemQuality(tip.id);
    const isSupply = entry?.itemGroup === 'supply';
    carried = entry?.carried ?? false;
    lines.push({ text: entry?.name ?? definition?.name ?? tip.id, color: qualityNameColor(quality, palette0.text) });
    if (isSupply) {
      lines.push({ text: '补给品 · 随库存可用，无需携行', color: palette0.textMuted });
    } else {
      lines.push({ text: `${ITEM_CATEGORY_LABELS[entry?.category ?? ''] ?? '战术道具'} · ${QUALITY_LABEL[quality]}`, color: palette0.textMuted });
    }
    if (entry) lines.push({ text: isSupply
      ? `库存 ${entry.count} · 补给品`
      : `库存 ${entry.count} · ${entry.carried ? '已携行' : '未携行'}`, color: palette0.textMuted });
    if (definition) {
      lines.push({ text: `使用：${definition.description}`, color: palette0.positive });
      const flavor = getGameAsset('item', tip.id)?.alt;
      if (flavor) lines.push({ text: flavor, color: palette0.accent, italic: true });
      lines.push({ text: `兑换价：${definition.cost?.rewardPoints ?? '—'} 奖励点`, color: palette0.textMuted });
    }
    if (context.model.phase === 'hub' && entry) carryAction = resolveCarryToggle(context, entry.itemId);
    if (context.model.phase === 'combat' && tip.id === 'healing_pill') {
      medicineAction = getInfiniteFlowCombatChoiceActions(context.model, 'medicines')
        .find((action) => action.actionId === 'combat.action:use_healing_pill');
      if (medicineAction) {
        const readout = [medicineAction.readout, medicineAction.disabledReason,
          context.options.chrome.busyActionId !== undefined ? '当前行动正在处理，请稍候。' : undefined,
          context.options.chrome.blockingMessage].filter((line): line is string => Boolean(line));
        for (const line of readout) {
          lines.push({ text: readable(line), color: palette0.textMuted });
        }
      }
    }
  }

  // The toggle action is projected even when the domain rejects it (e.g. the
  // 3-slot cap): render the button disabled and let the action's own
  // enabled/disabledReason stay authoritative instead of hiding the seam.
  const showCarry = tip.kind === 'item' && carryAction !== undefined;
  const tipAction = equipmentAction ?? medicineAction ?? carryAction;
  const showAction = tipAction !== undefined;
  const capNote = tip.kind === 'item' && showCarry && !carried && carriedCount >= 3
    ? '通用携行槽已满（3 / 3）' : undefined;
  if (capNote) lines.push({ text: capNote, color: palette0.danger });

  const title = lines[0]!;
  const titleLines = wrap(title.text, 12);
  const titleHeight = titleLines.length * TIP_TITLE_LINE * u;
  const bodyLines = lines.slice(1).map((entry, index) => ({ ...entry, index: index + 1,
    parts: wrap(entry.text, 11) }));
  const contentHeight = bodyLines.reduce((total, entry) => total + (entry.parts.length * TIP_LINE + 3) * u, 0);
  const hitHeight = 44 * u;
  const gap = 8 * u;
  // Leave the underlying sheet's title band visible; only the nested body scrolls.
  const tipTop = context.height / 2 - 56 * u;
  const tipBottom = -context.height / 2 + 8 * u;
  const availableHeight = tipTop - tipBottom;
  const chromeHeight = TIP_PAD * 2 * u + titleHeight + gap * 2 + hitHeight;
  const maxBodyHeight = availableHeight - chromeHeight;
  if (tipWidth <= 0 || maxBodyHeight <= 0) throw new Error('Item tip does not fit its parent sheet frame.');
  const bodyHeight = Math.min(Math.max(TIP_LINE * u, contentHeight), 300 * u, maxBodyHeight);
  const tipHeight = chromeHeight + bodyHeight;
  let y: number;
  if (tip.anchor) {
    y = tip.anchor.y - tip.anchor.h / 2 - tipHeight / 2 - gap;
    if (y - tipHeight / 2 < tipBottom) y = tip.anchor.y + tip.anchor.h / 2 + tipHeight / 2 + gap;
  } else {
    y = tipTop - tipHeight / 2;
  }
  y = Math.min(tipTop - tipHeight / 2, Math.max(tipBottom + tipHeight / 2, y));
  const xMax = Math.max(0, (frameWidth - tipWidth) / 2);
  const x = tip.anchor ? Math.max(-xMax, Math.min(xMax, tip.anchor.x)) : 0;

  const card = panel(context.panel, 'MobileSheetTip', x, y, tipWidth, tipHeight,
    palette0.surface, palette0.edgeStrong, true, 'sheet');
  card.addComponent(BlockInputEvents);
  catalogText(context, card, 'TipLine:0', titleLines.join('\n'), -2 * u,
    tipHeight / 2 - TIP_PAD * u - titleHeight / 2, copyWidth, titleHeight, 12, title.color);
  const region = overlayScroll(card, 'MobileSheetTipScroll',
    tipHeight / 2 - TIP_PAD * u - titleHeight - gap - bodyHeight / 2,
    tipWidth - TIP_PAD * 2 * u, bodyHeight, contentHeight, u);
  let cursor = 0;
  for (const entry of bodyLines) {
    const lineHeight = entry.parts.length * TIP_LINE * u;
    catalogText(context, region.content, `TipLine:${entry.index}`, entry.parts.join('\n'), -2 * u,
      Math.max(bodyHeight, contentHeight) / 2 - cursor - lineHeight / 2,
      copyWidth, lineHeight, 11, entry.color);
    const component = region.content.getChildByName(`TipLine:${entry.index}`)!.getComponent(Label)!;
    component.overflow = Label.Overflow.CLAMP;
    component.isItalic = entry.italic ?? false;
    cursor += lineHeight + 3 * u;
  }

  const buttonY = -tipHeight / 2 + TIP_PAD * u + hitHeight / 2;
  const buttonWidth = Math.min(148 * u,
    (tipWidth - TIP_PAD * 2 * u - (showAction ? gap : 0)) / (showAction ? 2 : 1));
  const rightX = tipWidth / 2 - TIP_PAD * u - buttonWidth / 2;
  const closeButton = node(card, 'MobileSheetTipClose', showAction ? rightX - buttonWidth - gap : rightX,
    buttonY, buttonWidth, hitHeight);
  const closeVisual = panel(closeButton, 'TipButtonVisual', 0, 0, buttonWidth, TIP_BUTTON_H * u,
    palette0.raised, palette0.edgeStrong, false, 'control');
  catalogText(context, closeVisual, 'Label', '关闭', 0, 0, buttonWidth - 16 * u, 20 * u, 12, palette0.textMuted, true);
  context.options.bindLocal(closeButton, () => context.options.setState({ ...context.state, tip: undefined }));
  if (showAction && tipAction) {
    const enabled = canExecute(context, tipAction);
    const carryButton = node(card, `${equipmentAction ? 'MobileSheetTipEquip' : medicineAction ? 'MobileSheetTipUse' : 'MobileSheetTipCarry'}:${tip.id}`,
      rightX, buttonY, buttonWidth, hitHeight);
    const carryVisual = panel(carryButton, 'TipButtonVisual', 0, 0, buttonWidth, TIP_BUTTON_H * u,
      enabled ? palette0.accentDark : palette0.quiet, enabled ? palette0.accent : palette0.edge, false, 'control');
    catalogText(context, carryVisual, 'Label', equipmentAction ? equipmentEquipped ? '已装备' : '装备'
      : medicineAction ? '使用止血丹' : carried ? '取消携行' : '设为携行',
      0, 0, buttonWidth - 16 * u, 20 * u, 12, enabled ? palette0.accent : palette0.textMuted, true);
    if (enabled) context.options.bindAction(carryButton, tipAction);
  }

  // Tap outside the frame dismisses only while a tip is pinned.
  context.options.bindLocal(backdrop, () => context.options.setState({ ...context.state, tip: undefined }));
}

type HubCatalogSurface = Pick<HubShopCatalogViewModel, 'rows' | 'npcName' | 'title' | 'greeting' | 'portraitAssetKey' | 'services' | 'serviceTitle'>
  & Partial<Pick<HubShopCatalogViewModel, 'layout' | 'groups' | 'groupStyle'>>;

/** Match the HTML prototype's CSS pixels even when the game canvas is letterboxed. */
function catalogUnit(context: SheetContext): number {
  const frame = view.getFrameSize();
  // Headless renderers have no browser frame; use the prototype's 390px phone preset.
  const screenWidth = context.options.viewportWidth ?? (frame.width > 0 && frame.height > 0
    ? Math.min(frame.width, frame.height * 750 / context.options.surfaceHeight) : 390);
  return 750 / screenWidth;
}

function catalogText(context: SheetContext, parent: Node, name: string, value: string, x: number, y: number,
  width: number, height: number, size: number, color = palette().text, centered = false): void {
  text(parent, name, value, x, y, width, height, size * catalogUnit(context), color, centered);
  const label = parent.getChildByName(name)!.getComponent(Label)!;
  label.fontSize = Math.round(size * catalogUnit(context));
  label.lineHeight = Math.ceil(label.fontSize * 1.5);
}

function catalogRule(parent: Node, name: string, y: number, width: number): void {
  const rule = node(parent, name, 0, y, width, 1).addComponent(Graphics);
  rule.strokeColor = palette().edgeStrong;
  rule.lineWidth = 1;
  rule.moveTo(-width / 2, 0); rule.lineTo(width / 2, 0); rule.stroke();
}

function catalogTextWidth(value: string, size: number): number {
  return Array.from(value).reduce((sum, char) => sum + (/[^\x00-\xff]/.test(char) ? 1 : 0.56), 0) * size;
}

function catalogPanel(context: SheetContext, parent: Node, name: string, x: number, y: number,
  width: number, height: number, fill: Color, edge: Color, edgeWidth = 1): Node {
  if (activeCompact) return panel(parent, name, x, y, width, height, fill, edge, false, 'card');
  const control = node(parent, name, x, y, width, height);
  const graphics = control.addComponent(Graphics);
  graphics.fillColor = fill;
  graphics.strokeColor = edge;
  graphics.lineWidth = edgeWidth * catalogUnit(context);
  graphics.roundRect(-width / 2, -height / 2, width, height, 3 * catalogUnit(context));
  graphics.fill(); graphics.stroke();
  return control;
}

function catalogActionLabel(action: ViewActionModel, row?: HubShopRowViewModel): string {
  const label = row ? action.label.split(row.name).join('').replace(/[：:·]\s*$/, '').trim() : action.label;
  return readable(label || action.label);
}

function catalogPrice(action: ViewActionModel): string | undefined {
  return action.readout?.match(/消耗\s+([^。]+)/)?.[1];
}

function catalogButtonWidth(context: SheetContext, label: string, price?: string): number {
  const u = catalogUnit(context);
  return Math.min(148, Math.max(60, catalogTextWidth(label, 13), Math.min(124, catalogTextWidth(price ?? '', 10))) + 24) * u;
}

/** A 32px visual sits within an independent 44px physical hit target. */
function catalogButton(context: SheetContext, parent: Node, name: string, label: string, x: number, y: number,
  width: number, enabled: boolean, price?: string, primary = false, danger = false): Node {
  const u = catalogUnit(context), actualWidth = Math.min(width, 148 * u);
  const colors = palette();
  const fill = !enabled ? colors.quiet : danger ? colors.dangerDark : primary ? colors.accentDark : colors.raised;
  const edge = !enabled ? colors.edge : danger ? colors.danger : primary ? colors.accent : colors.edgeStrong;
  const control = node(parent, name, x, y, actualWidth, 44 * u);
  panel(control, 'ButtonVisual', 0, 0, actualWidth, 32 * u, fill, edge, false, 'control');
  catalogText(context, control, 'Label', label, 0, price ? 6 * u : 0, actualWidth - 16 * u, 20 * u,
    price ? 12 : 13, enabled ? colors.text : colors.textMuted, true);
  if (price) {
    const maxUnits = Math.max(4, (actualWidth / u - 20) / 10);
    const lines = wrapInfiniteFlowLine(price, maxUnits);
    catalogText(context, control, 'Price', lines.length > 1 ? `${lines[0]}…` : price,
      0, -9 * u, actualWidth - 12 * u, 15 * u, 10, enabled ? colors.text : colors.textMuted, true);
  }
  return control;
}

type EntryService = NonNullable<Extract<GameViewModel['sections'][1]['detail'], { kind: 'hub' }>['entryServices']>[number];

/** Compact, image-led chapter choices; the original projected action only changes the draft. */
function renderEntryDungeons(context: SheetContext, footerHeight: number): ScrollView {
  const detail = context.model.sections[1].detail;
  const choices = detail.kind === 'hub' ? detail.entryServices?.find(service => service.id === 'dungeon')?.options ?? [] : [];
  const u = catalogUnit(context);
  const narrow = 750 / u <= 350;
  const introHeight = 28 * u;
  catalogText(context, context.body, 'MobileSheetEntryHint', `选择世界  ${choices.length}`,
    -context.width / 4, context.bodyHeight / 2 - 12 * u, context.width / 2, 20 * u, 11, palette().textMuted);
  const power = context.model.sections[1].loadout?.power;
  if (power !== undefined) catalogText(context, context.body, 'MobileSheetEntryPower', `当前战力 ${power}`,
    context.width / 4, context.bodyHeight / 2 - 12 * u, context.width / 2, 20 * u, 11, palette().accent, true);
  const bodyHeight = Math.max(44 * u, context.bodyHeight - introHeight - footerHeight);
  const body = node(context.body, 'MobileSheetEntryBody', 0, (footerHeight - introHeight) / 2, context.width, bodyHeight);
  const gap = 6 * u;
  const width = context.width - 4 * u;
  const imageWidth = (narrow ? 40 : 48) * u;
  const copyWidth = width - imageWidth - 28 * u;
  const rows = choices.map(option => {
    const requirement = option.dungeon?.status === 'locked' ? option.dungeon.requirement : '';
    const lines = requirement ? wrapInfiniteFlowLine(readable(requirement), Math.max(8, Math.floor(copyWidth / (10 * u)))) : [];
    return { option, lines, rowHeight: (64 + lines.length * 15) * u };
  });
  const region = scrollRegion({ ...context, body, bodyHeight }, rows.reduce((height, row) => height + row.rowHeight + gap, 0));
  region.holder.name = 'MobileSheetEntryDungeonScroll';
  region.scrollView.scrollToOffset(new Vec2(0, Math.min(Math.max(0, context.state.entryDungeonScrollOffset ?? 0),
    Math.max(0, region.contentHeight - region.height))), 0);
  const content = scrollContentNode(region);
  let cursor = 0;
  rows.forEach(({ option, lines, rowHeight }) => {
    const chapter = option.dungeon;
    const row = panel(content, `MobileSheetEntryDungeon:${option.id}`, -2 * u,
      scrollItemY(region, cursor, rowHeight), width, rowHeight,
      option.selected ? palette().accentDark : palette().quiet, option.selected ? palette().accent : palette().edge);
    const cover = node(row, 'EntryDungeonCover', -width / 2 + 7 * u + imageWidth / 2,
      rowHeight / 2 - 32 * u, imageWidth, imageWidth);
    cover.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
    if (chapter) {
      figureNode(context, cover, 'EntryDungeonImage', chapter.visualAssetKey, 0, 0,
        imageWidth, imageWidth,
        { iconKind: 'entry' }, context.images);
      const shade = node(cover, 'EntryDungeonChapterShade', 0, -imageWidth / 2 + 8 * u, imageWidth, 16 * u).addComponent(Graphics);
      shade.fillColor = withAlpha(palette().surface, 215);
      shade.rect(-imageWidth / 2, -8 * u, imageWidth, 16 * u); shade.fill();
      catalogText(context, cover, 'EntryDungeonChapter', `${String(chapter.chapter).padStart(2, '0')} 章`,
        0, -imageWidth / 2 + 8 * u, imageWidth - 4 * u, 14 * u, 9, palette().text);
    }
    const copyX = -width / 2 + imageWidth + 16 * u + copyWidth / 2;
    catalogText(context, row, 'EntryDungeonName', option.name, copyX - 8 * u, rowHeight / 2 - 18 * u,
      copyWidth - 16 * u, 22 * u, 13, option.selected ? palette().accent : palette().text);
    if (option.selected) catalogText(context, row, 'EntryDungeonSelected', '✓', width / 2 - 13 * u,
      rowHeight / 2 - 18 * u, 16 * u, 22 * u, 12, palette().accent, true);
    if (chapter) {
      catalogText(context, row, 'EntryDungeonPower', `推荐 ${chapter.recommendedPower}`, copyX - copyWidth / 4, rowHeight / 2 - 43 * u,
        copyWidth / 2, 18 * u, 10, palette().textMuted);
      catalogText(context, row, 'EntryDungeonState', chapter.status === 'locked' ? '未解锁' : chapter.status === 'completed' ? '已通关' : '可进入',
        copyX + copyWidth / 4, rowHeight / 2 - 43 * u, copyWidth / 2, 18 * u, 10,
        chapter.status === 'locked' ? palette().textMuted : palette().accent, true);
    }
    if (lines.length) catalogText(context, row, 'EntryDungeonRequirement', lines.join('\n'), copyX,
      rowHeight / 2 - (61 + lines.length * 7.5) * u, copyWidth, lines.length * 15 * u, 10, palette().textMuted);
    if (canExecute(context, option.action)) context.options.bindAction(row, option.action);
    cursor += rowHeight + gap;
  });
  return region.scrollView;
}

/** Overlay settings retain every projected option while chapters stay in the same sheet. */
function renderEntrySettings(context: SheetContext, services: readonly EntryService[], footerHeight: number,
  dungeons: ScrollView): ScrollView {
  const u = catalogUnit(context);
  const blocks: Array<{ height: number; draw: (parent: Node, centerY: number) => void }> = [];
  const copyWidth = context.width - 16 * u;
  const wrap = (value: string, size: number, width = copyWidth): string[] => value.split('\n')
    .flatMap(line => wrapInfiniteFlowLine(readable(line), Math.max(8, Math.floor(width / (size * u)))));
  const addText = (name: string, value: string, size = 10, color = palette().textMuted, singleLine = false): void => {
    const lines = singleLine ? [value] : wrap(value, size);
    const height = (lines.length * (size * 1.5) + 8) * u;
    blocks.push({ height, draw: (parent, y) => {
      catalogText(context, parent, name, lines.join('\n'), 0, y, copyWidth, height - 8 * u, size, color);
      if (singleLine) parent.getChildByName(name)!.getComponent(Label)!.enableWrapText = false;
    } });
  };
  const addOptions = (service: EntryService): void => {
    blocks.push({ height: 50 * u, draw: (parent, y) => {
      const width = Math.min(148 * u, (copyWidth - (service.options.length - 1) * 6 * u) / service.options.length);
      const totalWidth = width * service.options.length + (service.options.length - 1) * 6 * u;
      service.options.forEach((option, index) => {
        const enabled = canExecute(context, option.action);
        const label = service.id === 'relic-frame' ? option.name.replace(/回响$/, '') : option.name;
        const control = catalogButton(context, parent, `MobileSheetEntryOption:${option.action.actionId}`, label,
          -totalWidth / 2 + width / 2 + index * (width + 6 * u), y, width, enabled || option.selected, undefined, option.selected);
        if (enabled) context.options.bindAction(control, option.action);
      });
    } });
  };
  let region: ScrollRegion;
  const order = ['protocol', 'inferno-tier', 'relic-frame', 'route-contract', 'relic-seed'];
  for (const service of services.slice().sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))) {
    if (service.id === 'protocol' || service.id === 'relic-frame' || service.id === 'inferno-tier') {
      addText(`MobileSheetEntryServiceHeading:${service.id}`,
        service.id === 'protocol' ? '入场协议' : service.id === 'relic-frame' ? '回响方向' : service.summary, 11, palette().accent);
      addOptions(service);
      if (service.id === 'relic-frame') {
        const selected = service.options.find(option => option.selected);
        if (selected?.shortDescription) addText('MobileSheetEntryFrameDescription', selected.shortDescription, 11, palette().text, true);
      } else {
        const selected = service.options.find(option => option.selected);
        if (selected && selected.id !== 'standard' && service.id === 'protocol') addText('MobileSheetEntryProtocolDescription', selected.description);
        const reasons = Array.from(new Set(service.options.filter(option => !option.selected && !option.action.enabled)
          .map(option => option.action.disabledReason).filter((reason): reason is string => Boolean(reason))));
        if (reasons.length) addText(`MobileSheetEntryDisabledReason:${service.id}`, reasons.join('\n'));
      }
      continue;
    }
    const expanded = context.state.entryServiceId === service.id;
    blocks.push({ height: 44 * u, draw: (parent, y) => {
      const row = node(parent, `MobileSheetEntryService:${service.id}`, 0, y, copyWidth, 44 * u);
      catalogRule(row, 'EntryServiceRule', 22 * u, copyWidth);
      catalogText(context, row, 'EntryServiceName', service.name, -copyWidth / 2 + 34 * u, 0, 68 * u, 20 * u, 11, palette().textMuted);
      catalogText(context, row, 'EntryServiceSummary', service.summary, 30 * u, 0,
        copyWidth - 90 * u, 34 * u, 10, palette().text);
      catalogText(context, row, 'EntryServiceExpand', expanded ? '−' : '+', copyWidth / 2 - 7 * u, 0,
        14 * u, 20 * u, 14, palette().accent, true);
      context.options.bindLocal(row, () => context.options.setState({ ...context.state,
        entryServiceId: expanded ? undefined : service.id,
        entryDungeonScrollOffset: Math.max(0, dungeons.getScrollOffset().y),
        entrySettingsScrollOffset: Math.max(0, region.scrollView.getScrollOffset().y),
      }));
    } });
    if (!expanded) continue;
    if (service.description) addText(`EntryServiceDescription:${service.id}`, service.description);
    for (const option of service.options) {
      const reason = !option.selected ? option.action.disabledReason : undefined;
      const descriptions = wrap([option.description, reason && !option.description.includes(reason) ? reason : undefined].filter(Boolean).join('\n'), 10);
      const names = wrap(option.name, 12, copyWidth - 45 * u);
      const height = Math.max(44, 14 + names.length * 18 + descriptions.length * 15) * u;
      blocks.push({ height, draw: (parent, y) => {
        const row = node(parent, `MobileSheetEntryOption:${option.action.actionId}`, 0, y, copyWidth, height);
        catalogRule(row, 'EntryOptionRule', -height / 2, copyWidth);
        catalogText(context, row, 'EntryOptionName', names.join('\n'), -22 * u,
          height / 2 - (7 + names.length * 9) * u, copyWidth - 44 * u, names.length * 18 * u, 12,
          option.selected ? palette().accent : palette().text);
        catalogText(context, row, 'EntryOptionState', option.selected ? '已选' : option.action.enabled ? '选择' : '不可选',
          copyWidth / 2 - 20 * u, height / 2 - 16 * u, 40 * u, 18 * u, 9, palette().textMuted, true);
        catalogText(context, row, 'EntryOptionDescription', descriptions.join('\n'), 0,
          height / 2 - (7 + names.length * 18 + descriptions.length * 7.5) * u,
          copyWidth, descriptions.length * 15 * u, 10, palette().textMuted);
        if (canExecute(context, option.action)) context.options.bindAction(row, option.action);
      } });
    }
  }
  const contentHeight = blocks.reduce((height, block) => height + block.height, 16 * u);
  const height = Math.max(44 * u, Math.min(contentHeight, context.bodyHeight - footerHeight - 8 * u, 300 * u));
  const overlay = panel(context.body, 'MobileSheetEntrySettings', 0, -context.bodyHeight / 2 + footerHeight + height / 2,
    context.width, height, palette().surface, palette().edgeStrong);
  overlay.addComponent(BlockInputEvents);
  region = scrollRegion({ ...context, body: overlay, bodyHeight: height }, contentHeight);
  region.holder.name = 'MobileSheetEntrySettingsScroll';
  region.scrollView.scrollToOffset(new Vec2(0, Math.min(Math.max(0, context.state.entrySettingsScrollOffset ?? 0),
    Math.max(0, region.contentHeight - region.height))), 0);
  const content = scrollContentNode(region);
  let cursor = 8 * u;
  for (const block of blocks) {
    block.draw(content, scrollItemY(region, cursor, block.height));
    cursor += block.height;
  }
  return region.scrollView;
}

/** One chapter selector, one fixed entry action, and an optional same-sheet settings overlay. */
function renderEntryServices(context: SheetContext): void {
  const detail = context.model.sections[1].detail;
  if (detail.kind !== 'hub') {
    renderTextPages(context, [{ title: '轮回之门', lines: ['回到主神空间后可选择下一次冒险。'] }]);
    return;
  }
  const u = catalogUnit(context);
  const title = context.panel.getChildByName('MobileSheetTitle')?.getComponent(Label);
  if (title) { title.string = '轮回之门'; title.fontSize = Math.round(17 * u); title.lineHeight = Math.ceil(24 * u); }
  const services = detail.entryServices?.filter(service => service.id !== 'dungeon') ?? [];
  const action = getInfiniteFlowMobilePanelActions(context.model, 'entry').find(candidate =>
    candidate.actionId === (detail.activePanel === 'entry' ? 'hub.entry.confirm' : 'hub.panel:entry'));
  const enabled = action !== undefined && canExecute(context, action);
  const buttonWidth = Math.min(110 * u, context.width / 2);
  const copyWidth = context.width - buttonWidth - 14 * u;
  const notice = [action?.disabledReason, context.options.chrome.blockingMessage,
    context.options.chrome.busyActionId === undefined ? undefined : '当前行动正在处理，请稍候。'].filter(Boolean).join('\n');
  const noticeLines = (notice || '已选择 · 可直接进入').split('\n')
    .flatMap(line => wrapInfiniteFlowLine(readable(line), Math.max(8, Math.floor(copyWidth / (10 * u)))));
  const actionHeight = Math.max(44, 22 + noticeLines.length * 15) * u;
  const testJump = detail.kind === 'hub' ? detail.testJump : undefined;
  const testHeight = testJump ? 44 * u : 0;
  const footerHeight = 44 * u + testHeight + actionHeight;
  const dungeons = renderEntryDungeons(context, footerHeight);
  const footer = node(context.body, 'MobileSheetEntryFooter', 0,
    -context.bodyHeight / 2 + footerHeight / 2, context.width, footerHeight);
  catalogRule(footer, 'EntryFooterRule', footerHeight / 2, context.width);
  const toggle = node(footer, 'MobileSheetEntrySettingsToggle', 0, footerHeight / 2 - 22 * u, context.width, 44 * u);
  const protocol = services.find(service => service.id === 'protocol');
  const frame = services.find(service => service.id === 'relic-frame')?.options.find(option => option.selected);
  catalogText(context, toggle, 'EntryPreparationSummary', `协议  ${protocol?.summary ?? detail.activePanelLabel} · ${frame?.name ?? ''}`,
    -25 * u, 0, context.width - 50 * u, 24 * u, 11, palette().text);
  catalogText(context, toggle, 'EntryPreparationToggleLabel', context.state.entrySettingsOpen ? '收起 ∨' : '调整 ∧',
    context.width / 2 - 23 * u, 0, 46 * u, 24 * u, 10, palette().accent, true);
  let settings: ScrollView | undefined;
  context.options.bindLocal(toggle, () => context.options.setState({ ...context.state,
    entrySettingsOpen: !context.state.entrySettingsOpen,
    entryDungeonScrollOffset: Math.max(0, dungeons.getScrollOffset().y),
    entrySettingsScrollOffset: settings ? Math.max(0, settings.getScrollOffset().y) : context.state.entrySettingsScrollOffset,
  }));
  const actionY = -footerHeight / 2 + actionHeight / 2;
  catalogText(context, footer, 'EntryDestination', detail.selectedDungeonName, -context.width / 2 + copyWidth / 2,
    actionY + actionHeight / 2 - 10 * u, copyWidth, 20 * u, 13, palette().accent);
  catalogText(context, footer, 'EntryConfirmNotice', noticeLines.join('\n'), -context.width / 2 + copyWidth / 2,
    actionY + actionHeight / 2 - (22 + noticeLines.length * 7.5) * u,
    copyWidth, noticeLines.length * 15 * u, 10, palette().textMuted);
  if (action) {
    const label = detail.activePanel !== 'entry' ? '选择副本' : context.options.chrome.busyActionId ? '处理中' : '进入副本';
    const control = catalogButton(context, footer, 'MobileSheetEntryConfirm', label, context.width / 2 - buttonWidth / 2,
      actionY, buttonWidth, enabled, undefined, true);
    if (enabled) context.options.bindAction(control, action);
  }
  if (testJump && testJump.event?.kind === 'command' && testJump.event.command.type === 'test/jump-to-chapter') {
    // Test mode only: the jump overwrites the save, so a first tap arms it and a second tap jumps.
    const chapter = testJump.event.command.chapter;
    const armed = context.state.testJumpArmedChapter === chapter;
    const rowY = footerHeight / 2 - 44 * u - 22 * u;
    const jumpWidth = Math.min(110 * u, context.width / 2);
    catalogText(context, footer, 'EntryTestJumpNotice', armed ? `将覆盖当前存档，再点一次跳到第 ${chapter} 章` : `测试 · ${testJump.label}`,
      -context.width / 2 + (context.width - jumpWidth - 14 * u) / 2, rowY, context.width - jumpWidth - 14 * u, 20 * u, 10,
      armed ? palette().danger : palette().accent);
    const control = catalogButton(context, footer, 'MobileSheetEntryTestJump', armed ? '确认覆盖' : '跳到此章',
      context.width / 2 - jumpWidth / 2, rowY, jumpWidth, canExecute(context, testJump), undefined, false, true);
    if (armed && canExecute(context, testJump)) context.options.bindAction(control, testJump);
    else context.options.bindLocal(control, () => context.options.setState({ ...context.state, testJumpArmedChapter: chapter }));
  }
  if (context.state.entrySettingsOpen) settings = renderEntrySettings(context, services, footerHeight, dungeons);
  entryScrollByFrame.set(context.panel, { state: context.state, dungeons, settings });
}

function catalogActionButton(context: SheetContext, parent: Node, action: ViewActionModel, row: HubShopRowViewModel | undefined,
  x: number, y: number, width: number, update: (patch: Partial<MobileSheetState>) => void, confirmed = false,
  price = catalogPrice(action)): void {
  const enabled = canExecute(context, action);
  const danger = action.emphasis === 'danger' || action.recommendation === 'high-risk';
  const label = `${confirmed ? '确认' : ''}${catalogActionLabel(action, row)}`;
  const control = catalogButton(context, parent, `MobileSheetShopAction:${action.actionId}`, label, x, y, width,
    enabled, price, action.emphasis === 'primary' || action.recommendation === 'recommended', danger);
  if (enabled && (!danger || confirmed)) context.options.bindAction(control, action);
  else context.options.bindLocal(control, () => update({
    catalogRowId: row?.id, catalogServiceOpen: row === undefined, selectedActionId: action.actionId, catalogMoreOpen: false, catalogDetailScrollOffset: undefined,
  }));
}

/** Item quality belongs to the frame, so selection never replaces its rarity color. */
function catalogRarityEdge(row: HubShopRowViewModel): Color {
  return row.rarity ? qualityEdgeColor(row.rarity, new Color(213, 213, 213, 255)) : palette().edgeStrong;
}

function renderCatalogPopup(context: SheetContext, catalog: HubCatalogSurface): void {
  const row = catalog.rows.find((entry) => entry.id === context.state.catalogRowId);
  const service = context.state.catalogServiceOpen === true;
  if (!row && !service) return;
  const u = catalogUnit(context);
  const update = (patch: Partial<MobileSheetState>): void => context.options.setState({ ...context.state, ...patch });
  const clear = (): void => update({ catalogRowId: undefined, catalogServiceOpen: undefined,
    selectedActionId: undefined, catalogMoreOpen: undefined, catalogDetailScrollOffset: undefined });
  const actions = row?.actions ?? catalog.services;
  const selected = actions.find((action) => action.actionId === context.state.selectedActionId);
  const confirm = selected !== undefined && canExecute(context, selected);
  const width = Math.min(context.width, 304 * u);
  const innerWidth = width - 24 * u;
  const sections = row ? [{ label: '', value: row.description }, ...row.details]
    : actions.map(action => ({ label: catalogActionLabel(action), value: action.readout ?? action.disabledReason ?? action.label }));
  if (confirm && selected) sections.push({
    label: `确认${catalogActionLabel(selected, row)}`,
    value: [selected.readout, selected.disabledReason, selected.riskReason,
      context.options.chrome.busyActionId === undefined ? undefined : '当前行动正在处理，请稍候。',
      context.options.chrome.blockingMessage].filter(Boolean).join('\n'),
  });
  const notice = selected && !confirm ? [selected.disabledReason, context.options.chrome.blockingMessage,
    context.options.chrome.busyActionId === undefined ? undefined : '当前行动正在处理，请稍候。'].filter(Boolean).join('\n') : '';
  if (notice) sections.push({ label: '行动条件', value: notice });
  const facts = sections.map(section => {
    const lines = section.value.split('\n').flatMap(line => wrapInfiniteFlowLine(readable(line), Math.max(8, Math.floor(innerWidth / (12 * u)))));
    return { ...section, lines, height: (12 + (section.label ? 18 : 0) + lines.length * 18) * u };
  });
  const common = actions.slice(0, 2);
  const extra = actions.slice(2);
  const controls: CatalogControl[] = confirm
    ? [{ label: '取消', width: catalogButtonWidth(context, '取消') },
      ...(confirm ? [{ action: selected, label: `确认${catalogActionLabel(selected, row)}`,
        width: catalogButtonWidth(context, `确认${catalogActionLabel(selected, row)}`, catalogPrice(selected)) }] : [])]
    : [...(extra.length ? [{ label: '更多操作', width: catalogButtonWidth(context, '更多操作 +') }] : []),
      ...common.map(action => ({ action, label: catalogActionLabel(action, row),
        width: catalogButtonWidth(context, catalogActionLabel(action, row), catalogPrice(action)) }))];
  const packed = catalogControlPositions(controls, innerWidth, u, true);
  const footerHeight = controls.length ? packed.height + 12 * u : 0;
  const headerHeight = (row?.rarity ? 74 : 64) * u;
  const contentHeight = facts.reduce((sum, fact) => sum + fact.height, 12 * u);
  const height = Math.min(context.height, 464 * u,
    Math.max(headerHeight + footerHeight + 44 * u, contentHeight + headerHeight + footerHeight + 8 * u));
  const shade = panel(context.panel, 'MobileSheetCatalogBackdrop', 0, 0, context.width + 40, context.height,
    withAlpha(palette().surface, 225), palette().edge);
  shade.addComponent(BlockInputEvents);
  context.options.bindLocal(shade, clear);
  const card = catalogPanel(context, shade, 'MobileSheetCatalogDetail', 0, 0, width, height, palette().surface, palette().accent);
  card.addComponent(BlockInputEvents);
  if (row) {
    const image = catalogPanel(context, card, 'CatalogDetailIconFrame', -width / 2 + 32 * u,
      height / 2 - 30 * u, 40 * u, 40 * u, palette().quiet, catalogRarityEdge(row), 1);
    figureNode(context, image, 'CatalogDetailIcon', row.visualAssetKey ?? '', 0, 0, 36 * u, 36 * u,
      { iconKind: 'inventory', glyphColor: palette().accent }, context.images);
  }
  const titleLeft = -width / 2 + (row ? 62 : 12) * u;
  const titleWidth = width - (row ? 110 : 60) * u;
  catalogText(context, card, 'CatalogDetailTitle', row?.name ?? catalog.serviceTitle ?? '可选服务',
    titleLeft + titleWidth / 2, height / 2 - 20 * u, titleWidth, 22 * u, 14, palette().accent);
  catalogText(context, card, 'CatalogDetailStatus', row ? `${row.category} · ${row.status}` : catalog.npcName,
    titleLeft + titleWidth / 2, height / 2 - 40 * u, titleWidth, 18 * u, 10, palette().textMuted);
  if (row?.rarity) catalogText(context, card, 'CatalogDetailRarity', QUALITY_LABEL[row.rarity],
    titleLeft + titleWidth / 2, height / 2 - 58 * u, titleWidth, 16 * u, 10, qualityNameColor(row.rarity, palette().text));
  const close = catalogButton(context, card, 'MobileSheetCatalogDetailClose', '×', width / 2 - 22 * u, height / 2 - 22 * u, 44 * u, true);
  context.options.bindLocal(close, clear);
  catalogRule(card, 'CatalogHeaderRule', height / 2 - headerHeight, width - 2 * u);
  const bodyHeight = Math.max(44 * u, height - headerHeight - footerHeight);
  const body = node(card, 'CatalogDetailBody', 0, (footerHeight - headerHeight) / 2, innerWidth, bodyHeight);
  const popup: SheetContext = { ...context, panel: card, body, width: innerWidth, height, bodyHeight };
  const region = scrollRegion(popup, contentHeight);
  catalogDetailScrollByFrame.set(context.panel, region.scrollView);
  const maxOffset = Math.max(0, region.contentHeight - region.height);
  region.scrollView.scrollToOffset(new Vec2(0, Math.min(maxOffset,
    context.state.catalogDetailScrollOffset ?? (confirm ? maxOffset : 0))), 0);
  const content = scrollContentNode(region);
  let cursor = 6 * u;
  facts.forEach((fact, index) => {
    const item = node(content, `CatalogFact:${index}`, 0, scrollItemY(region, cursor, fact.height), innerWidth, fact.height);
    if (fact.label) catalogText(context, item, 'FactLabel', fact.label, 0, fact.height / 2 - 13 * u, innerWidth, 18 * u, 11, palette().textMuted);
    catalogText(context, item, notice && index === facts.length - 1 ? 'CatalogActionNotice' : 'FactValue', fact.lines.join('\n'), 0,
      fact.height / 2 - (9 + (fact.label ? 18 : 0) + fact.lines.length * 9) * u,
      innerWidth, fact.lines.length * 18 * u, 12, fact.label ? palette().text : palette().positive);
    catalogRule(item, 'FactRule', -fact.height / 2, innerWidth);
    cursor += fact.height;
  });
  if (footerHeight > 0) {
    const footer = node(card, 'MobileSheetCatalogFooter', 0, -height / 2 + footerHeight / 2, innerWidth, footerHeight);
    catalogRule(footer, 'CatalogFooterRule', footerHeight / 2, width - 2 * u);
    for (const control of packed.positions) {
      const x = -innerWidth / 2 + control.x + control.width / 2;
      const y = footerHeight / 2 - 6 * u - control.line * 50 * u - 22 * u;
      if (control.action) catalogActionButton(context, footer, control.action, row, x, y, control.width, update, confirm);
      else {
        const name = confirm ? 'MobileSheetCatalogCancelAction' : 'MobileSheetCatalogMore';
        const label = confirm ? control.label : `更多操作 ${context.state.catalogMoreOpen ? '−' : '+'}`;
        const button = catalogButton(context, footer, name, label, x, y, control.width, true);
        context.options.bindLocal(button, () => update(confirm
          ? { selectedActionId: undefined, catalogMoreOpen: false, catalogDetailScrollOffset: undefined }
          : { catalogMoreOpen: !context.state.catalogMoreOpen }));
      }
    }
  }
  if (!confirm && extra.length && context.state.catalogMoreOpen) {
    const menuWidth = Math.min(innerWidth, 164 * u);
    const menuHeight = Math.max(54 * u, Math.min(bodyHeight - 8 * u, (extra.length * 50 + 10) * u));
    const menu = catalogPanel(context, card, 'MobileSheetCatalogActionMenu',
      width / 2 - 14 * u - menuWidth / 2, -height / 2 + footerHeight + 6 * u + menuHeight / 2,
      menuWidth, menuHeight, palette().surface, palette().edgeStrong);
    menu.addComponent(BlockInputEvents);
    const menuContext = { ...context, panel: card, body: menu, width: menuWidth - 16 * u, bodyHeight: menuHeight - 10 * u };
    const menuRegion = scrollRegion(menuContext, extra.length * 50 * u);
    const menuContent = scrollContentNode(menuRegion);
    extra.forEach((action, index) => catalogActionButton(context, menuContent, action, row, menuContext.width / 2 - Math.min(menuContext.width, 148 * u) / 2,
      scrollItemY(menuRegion, index * 50 * u, 44 * u), menuContext.width, update));
  }
}

type CatalogControl = Readonly<{ action?: ViewActionModel; label: string; width: number }>;

/** Flex-like packing keeps short actions together and wraps only when necessary. */
function catalogControlPositions(controls: readonly CatalogControl[], available: number, u: number, alignEnd = false) {
  let x = 0, line = 0;
  const positions = controls.map(control => {
    const width = Math.min(available, 148 * u, control.width);
    if (x > 0 && x + width > available) { x = 0; line += 1; }
    const result = { ...control, width, x, line };
    x += width + 6 * u;
    return result;
  });
  if (alignEnd) {
    const lineWidths = new Map<number, number>();
    for (const position of positions) lineWidths.set(position.line, position.x + position.width);
    for (const position of positions) position.x += available - lineWidths.get(position.line)!;
  }
  return { positions, height: controls.length ? (line + 1) * 50 * u - 6 * u : 0 };
}

/** The services entry along the bottom of a merchant sheet (rest, equipment commission). */
function renderCatalogServicesFooter(context: SheetContext, catalog: HubCatalogSurface, footerHeight: number,
  update: (patch: Partial<MobileSheetState>) => void): void {
  if (!footerHeight) return;
  const u = catalogUnit(context);
  catalogRule(context.body, 'CatalogFooterRule', -context.bodyHeight / 2 + footerHeight, context.width);
  const label = `${catalog.serviceTitle ?? '其他服务'} ↗`;
  const width = Math.min(context.width, catalogButtonWidth(context, label));
  const control = catalogButton(context, context.body, 'MobileSheetShopServices', label,
    context.width / 2 - width / 2, -context.bodyHeight / 2 + 25 * u, width, true);
  context.options.bindLocal(control, () => update({ catalogRowId: undefined, catalogServiceOpen: true,
    selectedActionId: undefined, catalogMoreOpen: false, catalogDetailScrollOffset: undefined }));
}

const LISTING_BADGE_COLORS = {
  on: () => ({ fill: palette().positive, edge: palette().positive, text: new Color(16, 20, 12, 255) }),
  info: () => ({ fill: withAlpha(palette().surface, 0), edge: palette().accent, text: palette().accent }),
  locked: () => ({ fill: withAlpha(palette().surface, 0), edge: palette().edge, text: palette().textMuted }),
} as const;

/** The entry whose detail was last opened keeps an inner outline in its own quality color, so closing it stays oriented. */
function outlineSelectedEntry(context: SheetContext, entry: Node, row: HubShopRowViewModel, width: number, height: number): void {
  if ((context.state.catalogRowId ?? context.state.catalogSelectedRowId) !== row.id) return;
  const u = catalogUnit(context);
  const graphics = entry.getComponent(Graphics)!;
  graphics.strokeColor = catalogRarityEdge(row); graphics.lineWidth = 1.5 * u;
  graphics.roundRect(-width / 2 + 3 * u, -height / 2 + 3 * u, width - 6 * u, height - 6 * u, 2 * u); graphics.stroke();
}

/** A compact status chip after an entry's name; returns its width. */
function listingBadge(context: SheetContext, parent: Node, name: string, badge: NonNullable<HubShopRowViewModel['listing']>['badge'],
  left: number, y: number): number {
  if (!badge) return 0;
  const u = catalogUnit(context);
  const width = (catalogTextWidth(badge.label, 9.5) + 8) * u;
  const colors = LISTING_BADGE_COLORS[badge.tone]();
  const chip = panel(parent, name, left + width / 2, y, width, 15 * u, colors.fill, colors.edge, false, 'cell');
  catalogText(context, chip, 'Label', badge.label, 0, 0, width, 15 * u, 9.5, colors.text, true);
  return width;
}

function listingPips(level: NonNullable<HubShopRowViewModel['listing']>['level']): string {
  return level ? `${'◆'.repeat(Math.min(level.current, level.max))}${'◇'.repeat(Math.max(0, level.max - level.current))}` : '';
}

/**
 * Merchant goods in the merchant's own layout (approved prototype npc-shops-v2): rows with the inline buy or train
 * action, two-column character cards, or wide companion cards. Tapping an entry still opens the full detail.
 */
function renderMerchantList(context: SheetContext, catalog: HubCatalogSurface): void {
  const u = catalogUnit(context);
  const update = (patch: Partial<MobileSheetState>): void => context.options.setState({ ...context.state, ...patch });
  const open = (row: HubShopRowViewModel): void => update({ catalogRowId: row.id, catalogSelectedRowId: row.id,
    selectedActionId: undefined, catalogServiceOpen: undefined, catalogMoreOpen: false, catalogDetailScrollOffset: undefined,
    catalogScrollOffset: Math.max(0, catalogScrollByFrame.get(context.panel)?.getScrollOffset().y ?? 0) });
  const introHeight = 46 * u;
  const footerHeight = catalog.services.length ? 50 * u : 0;
  const introWidth = context.width - 44 * u;
  figureNode(context, context.body, 'MobileSheetNpcPortrait', catalog.portraitAssetKey ?? '',
    -context.width / 2 + 15 * u, context.bodyHeight / 2 - 19 * u, 30 * u, 36 * u,
    { glyph: catalog.npcName.slice(0, 1), glyphSize: 18 * u, glyphColor: palette().accent }, context.images);
  catalogText(context, context.body, 'MobileSheetNpcName', catalog.npcName, 22 * u,
    context.bodyHeight / 2 - 9 * u, introWidth, 18 * u, 12, palette().accent);
  const greeting = wrapInfiniteFlowLine(catalog.greeting, Math.floor(introWidth / (10.5 * u))).slice(0, 2);
  catalogText(context, context.body, 'MobileSheetNpcGreeting', greeting.join('\n'), 22 * u,
    context.bodyHeight / 2 - 18 * u - greeting.length * 7 * u, introWidth, greeting.length * 14 * u, 10.5, palette().textMuted);
  catalogRule(context.body, 'MobileSheetNpcIntroRule', context.bodyHeight / 2 - introHeight + 2 * u, context.width);
  const bodyHeight = Math.max(44 * u, context.bodyHeight - introHeight - footerHeight);
  const body = node(context.body, 'MobileSheetCatalogBody', 0, (footerHeight - introHeight) / 2, context.width, bodyHeight);
  let list: SheetContext = { ...context, body, bodyHeight };
  const byId = new Map(catalog.rows.map(row => [row.id, row]));
  // Slot tabs show one group at a time; sections stack every group with a heading.
  let sections: readonly Readonly<{ id: string; title?: string; hint?: string; rows: readonly HubShopRowViewModel[] }>[];
  if (catalog.groupStyle === 'tabs' && catalog.groups?.length) {
    const tabbed = tabs(list, catalog.groups.map(group => ({ id: group.id, title: group.title })), catalog.groups[0]!.id);
    list = tabbed.context;
    const group = catalog.groups.find(candidate => candidate.id === tabbed.active)!;
    sections = [{ id: group.id, rows: group.rowIds.flatMap(id => byId.get(id) ?? []) }];
  } else if (catalog.groups?.length) {
    sections = catalog.groups.map(group => ({ id: group.id, title: group.title, ...(group.hint ? { hint: group.hint } : {}),
      rows: group.rowIds.flatMap(id => byId.get(id) ?? []) }));
  } else {
    sections = [{ id: 'all', rows: catalog.rows }];
  }
  const layout = catalog.layout ?? 'rows';
  const gap = 4 * u;
  const headingHeight = 22 * u;
  const inlineAction = (row: HubShopRowViewModel): ViewActionModel | undefined =>
    row.actions.find(action => action.actionId === row.listing?.primaryActionId);
  // Rows: icon, name + badge + meta, two short lines, the inline action on the right.
  const rowHeight = (row: HubShopRowViewModel): number => Math.max(54, 26 + Math.min(2, row.listing?.lines.length ?? 0) * 15) * u;
  const cardWidth = (list.width - 6 * u) / 2;
  const cardHeight = 196 * u;
  // A wide card only grows to hold its inline action when it has one.
  const wideHeight = (row: HubShopRowViewModel): number => (inlineAction(row) ? 112 : 88) * u;
  const sectionHeight = (section: typeof sections[number]): number => (section.title ? headingHeight : 0) + (layout === 'cards'
    ? Math.ceil(section.rows.length / 2) * (cardHeight + gap)
    : section.rows.reduce((sum, row) => sum + (layout === 'wide-cards' ? wideHeight(row) : rowHeight(row)) + gap, 0));
  const contentHeight = Math.max(20 * u, sections.reduce((sum, section) => sum + sectionHeight(section), 0));
  const region = scrollRegion(list, contentHeight);
  region.holder.name = 'MobileSheetCatalogScroll';
  catalogScrollByFrame.set(context.panel, region.scrollView);
  region.scrollView.scrollToOffset(new Vec2(0, Math.min(Math.max(0, context.state.catalogScrollOffset ?? 0),
    Math.max(0, region.contentHeight - region.height))), 0);
  const content = scrollContentNode(region);
  const lineUnits = (width: number, size: number) => Math.max(6, Math.floor(width / (size * u)));
  const firstLine = (value: string, width: number, size: number): string => {
    const lines = wrapInfiniteFlowLine(readable(value), lineUnits(width, size));
    return lines.length > 1 ? `${lines[0]!.replace(/[，。、；：,.;:]$/, '')}…` : lines[0] ?? '';
  };
  const actionWidth = (row: HubShopRowViewModel): number => {
    const action = inlineAction(row);
    return action ? Math.min(96 * u, catalogButtonWidth(context, catalogActionLabel(action, row), row.listing?.price)) : 0;
  };
  let cursor = 0;
  for (const section of sections) {
    if (section.title) {
      const top = region.contentHeight / 2 - cursor;
      catalogText(context, content, `MobileSheetShopSection:${section.id}`, section.title, -list.width / 2 + 40 * u, top - 11 * u,
        80 * u, headingHeight, 11, palette().accent);
      if (section.hint) catalogText(context, content, `MobileSheetShopSectionHint:${section.id}`, section.hint, list.width / 2 - 75 * u,
        top - 11 * u, 150 * u, headingHeight, 9.5, palette().textMuted, true);
      cursor += headingHeight;
    }
    if (layout === 'cards') {
      section.rows.forEach((row, index) => {
        const x = -list.width / 2 + cardWidth / 2 + (index % 2) * (cardWidth + 6 * u);
        const top = cursor + Math.floor(index / 2) * (cardHeight + gap);
        renderMerchantCard(context, content, row, x, scrollItemY(region, top, cardHeight), cardWidth, cardHeight, inlineAction(row), open, update, firstLine);
      });
      cursor += Math.ceil(section.rows.length / 2) * (cardHeight + gap);
      continue;
    }
    for (const row of section.rows) {
      const height = layout === 'wide-cards' ? wideHeight(row) : rowHeight(row);
      const item = panel(content, `MobileSheetShopRow:${row.id}`, 0, scrollItemY(region, cursor, height), list.width, height,
        layout === 'wide-cards' ? palette().raised : withAlpha(palette().surface, 0),
        layout === 'wide-cards' ? (row.listing?.badge?.tone === 'on' ? palette().positive : palette().edgeStrong) : withAlpha(palette().surface, 0),
        false, 'card');
      if (layout !== 'wide-cards') catalogRule(item, 'ShopRowRule', -height / 2, list.width - 4 * u);
      outlineSelectedEntry(context, item, row, list.width, height);
      const action = inlineAction(row);
      const buttonWidth = actionWidth(row);
      const portrait = layout === 'wide-cards' ? 54 * u : 36 * u;
      const iconX = -list.width / 2 + 4 * u + portrait / 2;
      const figure = figureNode(context, item, `ShopIcon:${row.id}`, row.visualAssetKey ?? '', iconX,
        layout === 'wide-cards' ? 0 : height / 2 - 6 * u - portrait / 2, portrait, layout === 'wide-cards' ? 68 * u : portrait,
        { glyph: row.name.slice(0, 1), glyphSize: 18 * u, glyphColor: palette().accent }, context.images);
      const sprite = figure.getChildByName(`ShopIcon:${row.id}:Sprite`)?.getComponent(Sprite);
      if (sprite && row.listing?.dim) { sprite.grayscale = true; sprite.color = new Color(150, 150, 150, 255); }
      const textLeft = -list.width / 2 + 10 * u + portrait;
      const textWidth = list.width / 2 - textLeft - (buttonWidth > 0 ? buttonWidth + 6 * u : 4 * u);
      // Everything left of the inline action opens the detail; the action keeps its own touch target.
      const reserved = buttonWidth > 0 ? buttonWidth + 6 * u : 0;
      const info = node(item, `MobileSheetShopInfo:${row.id}`, -reserved / 2, 0, list.width - reserved, height);
      const nameTop = height / 2 - (layout === 'wide-cards' ? 16 : 13) * u;
      const nameWidth = Math.min(textWidth, (catalogTextWidth(row.name, 12.5) + 4) * u);
      catalogText(context, item, 'ShopRowName', row.name, textLeft + nameWidth / 2, nameTop, nameWidth, 18 * u, 12.5,
        row.listing?.dim ? palette().textMuted : row.rarity ? qualityNameColor(row.rarity, palette().text) : palette().text);
      const badgeWidth = listingBadge(context, item, 'ShopRowBadge', row.listing?.badge, textLeft + nameWidth + 4 * u, nameTop);
      const meta = [row.listing?.meta, listingPips(row.listing?.level)].filter(Boolean).join(' ');
      const metaLeft = textLeft + nameWidth + badgeWidth + 8 * u;
      if (meta && metaLeft < textLeft + textWidth - 20 * u) {
        catalogText(context, item, 'ShopRowMeta', meta, (metaLeft + textLeft + textWidth) / 2, nameTop,
          textLeft + textWidth - metaLeft, 16 * u, 10, palette().textMuted);
      }
      (row.listing?.lines ?? []).slice(0, layout === 'wide-cards' ? 3 : 2).forEach((line, index) => {
        catalogText(context, item, `ShopRowLine:${index}`, firstLine(line, textWidth, 10.5), textLeft + textWidth / 2,
          nameTop - (18 + index * 15) * u, textWidth, 15 * u, 10.5, index === 0 ? palette().text : palette().textMuted);
      });
      context.options.bindLocal(info, () => open(row));
      if (action) catalogActionButton(context, item, action, row, list.width / 2 - buttonWidth / 2 - 2 * u,
        layout === 'wide-cards' ? -height / 2 + 26 * u : 0, buttonWidth, update, false, row.listing?.price);
      cursor += height + gap;
    }
  }
  renderCatalogServicesFooter(context, catalog, footerHeight, update);
  renderCatalogPopup(context, catalog);
}

/** A two-column character card: portrait, status chip, name, meta, two lines and the inline buy or train action. */
function renderMerchantCard(context: SheetContext, parent: Node, row: HubShopRowViewModel, x: number, y: number, width: number, height: number,
  action: ViewActionModel | undefined, open: (row: HubShopRowViewModel) => void, update: (patch: Partial<MobileSheetState>) => void,
  firstLine: (value: string, width: number, size: number) => string): void {
  const u = catalogUnit(context);
  const active = row.listing?.badge?.tone === 'on';
  const card = panel(parent, `MobileSheetShopRow:${row.id}`, x, y, width, height, palette().raised,
    active ? palette().positive : row.rarity ? qualityEdgeColor(row.rarity, palette().edgeStrong) : palette().edgeStrong, false, 'card');
  outlineSelectedEntry(context, card, row, width, height);
  const innerWidth = width - 12 * u;
  const figure = figureNode(context, card, `ShopIcon:${row.id}`, row.visualAssetKey ?? '', 0, height / 2 - 40 * u, innerWidth, 66 * u,
    { glyph: row.name.slice(0, 1), glyphSize: 26 * u, glyphColor: palette().accent }, context.images);
  const sprite = figure.getChildByName(`ShopIcon:${row.id}:Sprite`)?.getComponent(Sprite);
  if (sprite && row.listing?.dim) { sprite.grayscale = true; sprite.color = new Color(150, 150, 150, 255); }
  if (row.listing?.badge) {
    const badgeWidth = (catalogTextWidth(row.listing.badge.label, 9.5) + 8) * u;
    listingBadge(context, card, 'ShopCardBadge', row.listing.badge, width / 2 - 6 * u - badgeWidth, height / 2 - 14 * u);
  }
  catalogText(context, card, 'ShopRowName', row.name, 0, height / 2 - 84 * u, innerWidth, 18 * u, 12.5,
    row.listing?.dim ? palette().textMuted : row.rarity ? qualityNameColor(row.rarity, palette().text) : palette().text);
  const meta = [row.listing?.meta, listingPips(row.listing?.level)].filter(Boolean).join('  ');
  if (meta) catalogText(context, card, 'ShopRowMeta', meta, 0, height / 2 - 100 * u, innerWidth, 14 * u, 10, palette().textMuted);
  (row.listing?.lines ?? []).slice(0, 2).forEach((line, index) => {
    const lines = wrapInfiniteFlowLine(readable(line), Math.max(6, Math.floor(innerWidth / (10.5 * u)))).slice(0, index === 0 ? 2 : 1);
    catalogText(context, card, `ShopRowLine:${index}`, index === 0 ? lines.join('\n') : firstLine(line, innerWidth, 10.5), 0,
      height / 2 - (118 + index * 30) * u - (index === 0 ? (lines.length - 1) * 7 * u : 0), innerWidth, (index === 0 ? lines.length : 1) * 15 * u, 10.5,
      index === 0 ? palette().text : active ? palette().positive : palette().textMuted);
  });
  const info = node(card, `MobileSheetShopInfo:${row.id}`, 0, action ? 25 * u : 0, width, action ? height - 50 * u : height);
  context.options.bindLocal(info, () => open(row));
  if (action) catalogActionButton(context, card, action, row, 0, -height / 2 + 25 * u, innerWidth, update, false, row.listing?.price);
}

/** NPC storefront: each merchant's own goods list, with a separate readable task list. */
function renderNpcCatalog(context: SheetContext, catalog: HubCatalogSurface): void {
  const u = catalogUnit(context);
  const detail = context.model.sections[1].detail;
  if (detail.kind !== 'hub' || detail.activePanel !== 'tasks') { renderMerchantList(context, catalog); return; }
  const introHeight = 76 * u;
  const footerHeight = catalog.services.length ? 50 * u : 0;
  const introWidth = context.width - 56 * u;
  figureNode(context, context.body, 'MobileSheetNpcPortrait', catalog.portraitAssetKey ?? '',
    -context.width / 2 + 20 * u, context.bodyHeight / 2 - 24 * u, 40 * u, 40 * u,
    { glyph: catalog.npcName.slice(0, 1), glyphSize: 21 * u, glyphColor: palette().accent }, context.images);
  catalogText(context, context.body, 'MobileSheetNpcName', catalog.npcName, 28 * u,
    context.bodyHeight / 2 - 12 * u, introWidth, 22 * u, 13, palette().accent);
  const greeting = wrapInfiniteFlowLine(catalog.greeting, Math.floor(introWidth / (11 * u))).slice(0, 2).join('\n');
  catalogText(context, context.body, 'MobileSheetNpcGreeting', greeting, 28 * u,
    context.bodyHeight / 2 - 40 * u, introWidth, 32 * u, 11, palette().textMuted);
  catalogText(context, context.body, 'MobileSheetCatalogCount', `共 ${catalog.rows.length} 项`,
    -context.width / 2 + 40 * u, context.bodyHeight / 2 - 65 * u, 80 * u, 16 * u, 10, palette().textMuted);
  catalogText(context, context.body, 'MobileSheetCatalogHint', '点击任务查看详情',
    context.width / 2 - 60 * u, context.bodyHeight / 2 - 65 * u, 120 * u, 16 * u, 10, palette().textMuted);
  const bodyHeight = Math.max(44 * u, context.bodyHeight - introHeight - footerHeight);
  const body = node(context.body, 'MobileSheetCatalogBody', 0, (footerHeight - introHeight) / 2, context.width, bodyHeight);
  const list = { ...context, body, bodyHeight };
  const taskRows = catalog.rows.map(row => {
    const controls = catalogControlPositions(row.actions.map(action => ({ action,
      label: catalogActionLabel(action, row), width: catalogButtonWidth(context, catalogActionLabel(action, row), catalogPrice(action)) })), 84 * u, u, true);
    const copyWidth = context.width - (controls.positions.length ? 94 : 8) * u;
    const description = wrapInfiniteFlowLine(readable(row.description), Math.max(8, Math.floor(copyWidth / (11 * u)))).slice(0, 2);
    const progress = row.details.find(fact => fact.label === '当前进度')?.value ?? '';
    const progressLines = wrapInfiniteFlowLine(`${row.status}  ${progress}`, Math.max(8, Math.floor(copyWidth / (11 * u))));
    const height = Math.max(controls.height + 16 * u, (60 + description.length * 17 + progressLines.length * 16) * u);
    return { row, controls, copyWidth, description, progressLines, height };
  });
  const contentHeight = taskRows.reduce((sum, item) => sum + item.height, 0);
  const region = scrollRegion(list, contentHeight);
  region.holder.name = 'MobileSheetCatalogScroll';
  catalogScrollByFrame.set(context.panel, region.scrollView);
  region.scrollView.scrollToOffset(new Vec2(0, Math.min(Math.max(0, context.state.catalogScrollOffset ?? 0),
    Math.max(0, region.contentHeight - region.height))), 0);
  const update = (patch: Partial<MobileSheetState>): void => context.options.setState({ ...context.state,
    catalogScrollOffset: Math.max(0, region.scrollView.getScrollOffset().y), ...patch });
  const open = (row: HubShopRowViewModel): void => update({ catalogRowId: row.id, catalogSelectedRowId: row.id,
    selectedActionId: undefined, catalogServiceOpen: undefined, catalogMoreOpen: false, catalogDetailScrollOffset: undefined });
  const content = scrollContentNode(region);
  let cursor = 0;
  for (const { row, controls, copyWidth, description, progressLines, height } of taskRows) {
    const item = node(content, `MobileSheetShopRow:${row.id}`, 0, scrollItemY(region, cursor, height), context.width, height);
    catalogRule(item, 'ShopRowRule', height / 2, context.width - 4 * u);
    const info = node(item, `MobileSheetShopInfo:${row.id}`, -context.width / 2 + copyWidth / 2, 0, copyWidth, height);
    catalogText(context, info, 'ShopRowName', row.name, 0, height / 2 - 18 * u, copyWidth, 22 * u, 13);
    catalogText(context, info, 'ShopRowCategory', row.category, 0, height / 2 - 37 * u, copyWidth, 16 * u, 10, palette().textMuted);
    catalogText(context, info, 'ShopRowDescription', description.join('\n'), 0,
      height / 2 - (49 + description.length * 8.5) * u, copyWidth, description.length * 17 * u, 11, palette().textMuted);
    catalogText(context, info, 'ShopRowStatus', progressLines.join('\n'), 0,
      -height / 2 + (8 + progressLines.length * 8) * u, copyWidth, progressLines.length * 16 * u, 11,
      row.status === '可领取' ? palette().positive : palette().textMuted);
    context.options.bindLocal(info, () => open(row));
    for (const control of controls.positions) catalogActionButton(context, item, control.action!, row,
      context.width / 2 - 84 * u + control.x + control.width / 2,
      controls.height / 2 - control.line * 50 * u - 22 * u, control.width, update);
    cursor += height;
  }
  if (footerHeight) {
    catalogRule(context.body, 'CatalogFooterRule', -context.bodyHeight / 2 + footerHeight, context.width);
    const label = `${catalog.serviceTitle ?? '其他服务'} ↗`;
    const width = Math.min(context.width, catalogButtonWidth(context, label));
    const control = catalogButton(context, context.body, 'MobileSheetShopServices', label,
      context.width / 2 - width / 2, -context.bodyHeight / 2 + 25 * u, width, true);
    context.options.bindLocal(control, () => update({ catalogRowId: undefined, catalogServiceOpen: true,
      selectedActionId: undefined, catalogMoreOpen: false, catalogDetailScrollOffset: undefined }));
  }
  renderCatalogPopup(context, catalog);
}

/** The approved prototype's compact rows, reused for player-owned preparation. */
function renderHubCatalog(context: SheetContext, catalog: HubCatalogSurface): void {
  const u = catalogUnit(context);
  const title = context.panel.getChildByName('MobileSheetTitle')?.getComponent(Label);
  if (title) {
    title.fontSize = Math.round(14 * u);
    title.lineHeight = Math.ceil(21 * u);
  }
  if (context.state.kind === 'npc') { renderNpcCatalog(context, catalog); return; }
  const introHeight = 76 * u;
  const footerHeight = catalog.services.length > 0 ? 50 * u : 0;
  const portraitX = -context.width / 2 + 20 * u;
  figureNode(context, context.body, 'MobileSheetNpcPortrait', catalog.portraitAssetKey ?? '', portraitX, context.bodyHeight / 2 - 24 * u, 40 * u, 40 * u,
    { glyph: catalog.npcName.slice(0, 1), glyphSize: 21 * u, glyphColor: palette().accent }, context.images);
  const introWidth = context.width - 56 * u;
  catalogText(context, context.body, 'MobileSheetNpcName', catalog.npcName, 28 * u, context.bodyHeight / 2 - 12 * u, introWidth, 22 * u, 13, palette().accent);
  const greeting = wrapInfiniteFlowLine(catalog.greeting, Math.floor(introWidth / (11 * u))).slice(0, 2).join('\n');
  catalogText(context, context.body, 'MobileSheetNpcGreeting', greeting, 28 * u, context.bodyHeight / 2 - 40 * u, introWidth, 32 * u, 11, palette().textMuted);
  catalogText(context, context.body, 'MobileSheetCatalogCount', `共 ${catalog.rows.length} 项`, -context.width / 2 + 40 * u, context.bodyHeight / 2 - 65 * u, 80 * u, 16 * u, 10, palette().textMuted);
  catalogText(context, context.body, 'MobileSheetCatalogHint', '点图标或名称查看详情', context.width / 2 - 70 * u, context.bodyHeight / 2 - 65 * u, 140 * u, 16 * u, 10, palette().textMuted);
  const bodyHeight = Math.max(44 * u, context.bodyHeight - introHeight - footerHeight);
  const body = node(context.body, 'MobileSheetCatalogBody', 0, (footerHeight - introHeight) / 2, context.width, bodyHeight);
  const list: SheetContext = { ...context, body, bodyHeight };
  const textLeft = -context.width / 2 + 54 * u;
  const inlineActions = context.width / u > 510;
  const copyWidth = context.width - (inlineActions ? 315 : 62) * u;
  const actionWidth = inlineActions ? 235 * u : copyWidth;
  const expandedIds = context.state.catalogExpandedIds ?? [];
  const rows = catalog.rows.map(row => {
    const merchantEquipment = context.state.kind === 'npc' && row.actions.some(action => action.actionId.startsWith('hub.equipment.'));
    const common = merchantEquipment ? row.actions.filter(action => /^hub\.equipment\.(buy|upgrade):/.test(action.actionId)) : row.actions;
    const extra = row.actions.filter(action => !common.includes(action));
    const expanded = expandedIds.includes(row.id);
    const control = (action: ViewActionModel): CatalogControl => ({ action, label: catalogActionLabel(action, row), width: catalogButtonWidth(context, catalogActionLabel(action, row), catalogPrice(action)) });
    const controls: CatalogControl[] = common.map(control);
    if (extra.length) controls.push({ label: expanded ? '收起 −' : '更多操作 +', width: catalogButtonWidth(context, '更多操作 +') });
    const actions = catalogControlPositions(controls, actionWidth, u, true);
    const extras = catalogControlPositions(expanded ? extra.map(control) : [], context.width - 24 * u, u, true);
    const description = wrapInfiniteFlowLine(readable(row.description), Math.max(8, Math.floor(copyWidth / (11 * u))));
    const descriptionLines = description.slice(0, 2);
    if (description.length > 2) descriptionLines[1] += '…';
    const infoHeight = (44 + descriptionLines.length * 17) * u;
    const extraHeight = expanded && extra.length ? extras.height + 40 * u : 0;
    const mainHeight = inlineActions ? Math.max(infoHeight, actions.height) : infoHeight + actions.height;
    return { row, expanded, actions, extras, descriptionLines, infoHeight, height: mainHeight + 20 * u + extraHeight };
  });
  const region = scrollRegion(list, rows.reduce((sum, row) => sum + row.height, 0));
  region.holder.name = 'MobileSheetCatalogScroll';
  catalogScrollByFrame.set(context.panel, region.scrollView);
  const offset = Math.min(Math.max(0, context.state.catalogScrollOffset ?? 0), Math.max(0, region.contentHeight - region.height));
  region.scrollView.scrollToOffset(new Vec2(0, offset), 0);
  const update = (patch: Partial<MobileSheetState>): void => context.options.setState({
    ...context.state, catalogScrollOffset: Math.max(0, region.scrollView.getScrollOffset().y), ...patch,
  });
  const content = scrollContentNode(region);
  let cursor = 0;
  for (const { row, expanded, actions, extras, descriptionLines, infoHeight, height } of rows) {
    const item = node(content, `MobileSheetShopRow:${row.id}`, 0, scrollItemY(region, cursor, height), region.width, height);
    catalogRule(item, 'ShopRowRule', height / 2, region.width - 4 * u);
    const info = node(item, `MobileSheetShopInfo:${row.id}`, 0, height / 2 - 8 * u - infoHeight / 2, region.width, infoHeight);
    const figure = catalogPanel(context, info, 'ShopIconFrame', -region.width / 2 + 22 * u, infoHeight / 2 - 22 * u, 40 * u, 40 * u, palette().quiet, palette().edgeStrong);
    figureNode(context, figure, `ShopIcon:${row.id}`, row.visualAssetKey ?? '', 0, 0, 36 * u, 36 * u,
      { glyph: row.name.slice(0, 1), glyphSize: 24 * u, glyphColor: palette().accent }, context.images);
    const titleWidth = Math.min(copyWidth, catalogTextWidth(row.name, 13) * u + 4 * u);
    catalogText(context, info, 'ShopRowName', row.name, textLeft + titleWidth / 2, infoHeight / 2 - 11 * u, titleWidth, 22 * u, 13);
    info.getChildByName('ShopRowName')!.getComponent(Label)!.isBold = true;
    const categoryWidth = copyWidth - titleWidth - 6 * u;
    if (categoryWidth > 24 * u) catalogText(context, info, 'ShopRowCategory', row.category, textLeft + titleWidth + 6 * u + categoryWidth / 2,
      infoHeight / 2 - 11 * u, categoryWidth, 18 * u, 10, palette().textMuted);
    catalogText(context, info, 'ShopRowStatus', row.status, textLeft + copyWidth / 2, infoHeight / 2 - 30 * u, copyWidth, 18 * u, 11, palette().positive);
    catalogText(context, info, 'ShopRowDescription', descriptionLines.join('\n'), textLeft + copyWidth / 2,
      infoHeight / 2 - (44 + descriptionLines.length * 8.5) * u, copyWidth, descriptionLines.length * 17 * u, 11, palette().textMuted);
    context.options.bindLocal(info, () => update({ catalogRowId: row.id, selectedActionId: undefined, catalogServiceOpen: undefined }));
    for (const control of actions.positions) {
      const x = (inlineActions ? context.width / 2 - actionWidth - 12 * u : textLeft) + control.x + control.width / 2;
      const top = inlineActions ? 8 * u + (Math.max(infoHeight, actions.height) - actions.height) / 2 : infoHeight + 10 * u;
      const y = height / 2 - top - control.line * 50 * u - 22 * u;
      if (control.action) catalogActionButton(context, item, control.action, row, x, y, control.width, update);
      else {
        const more = catalogButton(context, item, `MobileSheetShopMore:${row.id}`, control.label, x, y, control.width, true);
        context.options.bindLocal(more, () => update({ catalogExpandedIds: expanded ? expandedIds.filter(id => id !== row.id) : [...expandedIds, row.id] }));
      }
    }
    if (extras.positions.length) {
      const extraHeight = extras.height + 32 * u;
      const extra = panel(item, 'CatalogExtraActions', 0, -height / 2 + extraHeight / 2 + 4 * u, context.width, extraHeight, palette().quiet, palette().edge, false, 'card');
      catalogText(context, extra, 'ExtraLabel', `${row.name} · 强化与委托`, 0, extraHeight / 2 - 14 * u, context.width - 24 * u, 20 * u, 11, palette().textMuted);
      for (const control of extras.positions) catalogActionButton(context, extra, control.action!, row,
        -context.width / 2 + 12 * u + control.x + control.width / 2, extraHeight / 2 - 26 * u - control.line * 50 * u - 22 * u, control.width, update);
    }
    cursor += height;
  }
  if (!rows.length) catalogText(context, content, 'MobileSheetCatalogEmpty', '购入装备或解锁能力后，可以在这里配置。', 0, region.contentHeight / 2 - 48 * u, context.width - 24 * u, 72 * u, 13, palette().textMuted, true);
  if (footerHeight > 0) {
    catalogRule(context.body, 'CatalogFooterRule', -context.bodyHeight / 2 + footerHeight, context.width);
    const label = `${catalog.serviceTitle ?? '其他服务'} ↗`;
    const width = Math.min(context.width, catalogButtonWidth(context, label));
    const control = catalogButton(context, context.body, 'MobileSheetShopServices', label,
      context.width / 2 - width / 2, -context.bodyHeight / 2 + 25 * u, width, true);
    context.options.bindLocal(control, () => update({ catalogRowId: undefined, catalogServiceOpen: true, selectedActionId: undefined }));
  }
  renderCatalogPopup(context, catalog);
}

function renderSheetKind(context: SheetContext): void {
  const { model, state } = context;
  const detail = model.sections[1].detail;
  if (state.kind === 'character') {
    const selected = model.sections[1].metrics.find((metric) => metric.id === state.selectedActionId);
    if (selected) renderMetricDetail(context, selected); else renderCharacter(context);
  } else if (state.kind === 'map') renderMap(context);
  else if (state.kind === 'objectives') renderObjectives(context);
  else if (state.kind === 'log') renderTextPages(context, model.sections[5].lines.length === 0 ? [{ title: '冒险记录', lines: ['本轮还没有新的记录。'] }] : model.sections[5].lines.map((entry, index) => ({ title: `冒险记录 · ${index + 1}`, lines: [entry] })));
  else if (state.kind === 'help') renderHelp(context);
  else if (state.kind === 'menu') renderMenu(context);
  else if (state.kind === 'entry') renderEntryServices(context);
  else if (state.kind === 'inventory') renderInventory(context);
  else if (state.kind === 'npc') {
    if (detail.kind === 'hub' && detail.shop) renderHubCatalog(context, detail.shop);
    else renderTextPages(context, [{ title: '交谈', lines: ['请在主神空间走近 NPC 后交谈。'] }]);
  }
  else if (state.kind === 'claims') renderTaskClaims(context);
  else if (state.kind === 'result') renderTabbedActions(context, detail.kind === 'result' ? buildInfiniteFlowResultPages(detail) : [], ['结算明细', '归档与回城']);
  else if (state.kind === 'interaction') {
    if (detail.kind === 'explore' && detail.pending?.kind === 'equipment-offer') {
      renderEquipmentOffer(context);
      return;
    }
    if (detail.kind === 'explore' && detail.pending?.kind === 'relic-draft' && detail.pending.relicOptions?.length) {
      renderRelicDraft(context);
      return;
    }
    if (detail.kind === 'explore' && detail.rewardPreview && (!detail.pending || detail.pending.kind === 'dungeon-event')) {
      if (state.tab === 'reward-services') {
        renderActions(context, getInfiniteFlowMobilePanelActions(model, 'interaction')
          .filter(action => action.actionId !== detail.rewardPreview!.actionId), '暂无其他行动。',
          { kind: 'interaction', label: '返回奖励', name: 'MobileSheetRewardBack' });
      } else if (roomSheetDetail(model, state)) renderRoomRewardClaim(context);
      else renderRewardClaim(context);
      return;
    }
    // The room sheet's header already tells the story, so its choices come straight away.
    if (roomSheetDetail(model, state)) {
      renderActions(context, getInfiniteFlowMobilePanelActions(model, 'interaction'));
      return;
    }
    const pages: readonly SheetPage[] = detail.kind === 'explore'
      ? [{ title: detail.pending?.title ?? detail.currentNode.title, lines: [detail.pending?.message ?? detail.currentNode.description] }]
      : [{ title: '当前交互', lines: ['走近场景中的交互点后查看。'] }];
    renderTabbedActions(context, pages, ['现场说明', '选择行动'], 'actions');
  }
}

function surfaceContext(base: SheetContext, target: SheetTarget): SheetContext {
  return { ...base, body: target.body, width: target.width, bodyHeight: target.bodyHeight };
}

/**
 * Horizontal paging region used by the carousel engine. All pages live in one
 * wide content node (every card stays in the tree); dots are decorative.
 */
function hPagerRegion(context: SheetContext, regionHeight: number, contentWidth: number, pageCount: number): SheetPagerRegion {
  const viewWidth = context.width;
  const holder = node(context.body, 'MobileSheetPager', 0, 0, viewWidth, regionHeight);
  holder.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
  // Mirror of scrollRegion's vertical convention: shift content RIGHT (positive
  // x) so its left edge is flush with the view — the pager opens on page one.
  const wide = Math.max(viewWidth, contentWidth);
  const content = node(holder, 'MobileSheetPagerContent', (wide - viewWidth) / 2, 0, wide, regionHeight);
  const scrollView = holder.addComponent(ScrollView);
  scrollView.content = content;
  scrollView.horizontal = true;
  scrollView.vertical = false;
  scrollView.inertia = true;
  scrollView.brake = 0.75;
  scrollView.elastic = true;
  scrollView.cancelInnerEvents = true;
  const dots = node(holder, 'MobileSheetPagerDots', 0, -regionHeight / 2 + 14, Math.max(60, pageCount * 24), 12);
  const dg = dots.addComponent(Graphics);
  dg.fillColor = palette().accent;
  for (let i = 0; i < pageCount; i += 1) {
    const cx = -((pageCount - 1) * 24) / 2 + i * 24;
    dg.moveTo(cx - 5, 0); dg.lineTo(cx, -5); dg.lineTo(cx + 5, 0); dg.lineTo(cx, 6); dg.lineTo(cx - 5, 6); dg.close(); dg.fill();
  }
  return { holder, content, dots, width: viewWidth, height: regionHeight };
}

/**
 * Horizontal free-scrolling strip for the drawer engine. Same single-wide-
 * content discipline as the pager (every item stays in the tree) but with no
 * dots and momentum scrolling across the whole content instead of paging.
 */
function hStripRegion(context: SheetContext, regionHeight: number, contentWidth: number): SheetStripRegion {
  const viewWidth = context.width;
  const holder = node(context.body, 'MobileSheetHStrip', 0, 0, viewWidth, regionHeight);
  holder.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
  const wide = Math.max(viewWidth, contentWidth);
  // Positive x: open scrolled to the LEFT edge (first chip), same convention
  // as hPagerRegion.
  const content = node(holder, 'MobileSheetHStripContent', (wide - viewWidth) / 2, 0, wide, regionHeight);
  const scrollView = holder.addComponent(ScrollView);
  scrollView.content = content;
  scrollView.horizontal = true;
  scrollView.vertical = false;
  scrollView.inertia = true;
  scrollView.brake = 0.75;
  scrollView.elastic = true;
  scrollView.cancelInnerEvents = true;
  return { holder, content, width: viewWidth, height: regionHeight, contentWidth: wide };
}

/**
 * Figure slot: the glyph fallback and the sprite child are both always
 * present, so node names/counts are identical whether or not the image
 * library contains the key. The sprite is simply frameless when art is absent.
 */
function figureNode(_context: SheetContext, parent: Node, name: string, imageKey: string, x: number, y: number, width: number, height: number, fallback: SheetFigureFallback | undefined, images: NonNullable<InfiniteFlowInfoSheetOptions['images']>): Node {
  const container = node(parent, name, x, y, width, height);
  const glyphNode = node(container, `${name}:Glyph`, 0, 0, width, height);
  if (fallback?.iconKind !== undefined) {
    icon(glyphNode, 'GlyphIcon', fallback.iconKind, 0, 0, fallback.glyphColor ?? palette().accent);
  } else {
    text(glyphNode, 'GlyphLabel', fallback?.glyph ?? '', 0, 0, width, height, fallback?.glyphSize ?? 28, fallback?.glyphColor ?? palette().text, true);
  }
  const spriteNode = node(container, `${name}:Sprite`, 0, 0, width, height);
  const sprite = spriteNode.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  const image = images.get(imageKey);
  if (image) {
    sprite.spriteFrame = image.frame as SpriteFrame;
    if (activeCompact && image.width > 0 && image.height > 0) {
      const scale = Math.min(width / image.width, height / image.height);
      spriteNode.getComponent(UITransform)!.setContentSize(new Size(image.width * scale, image.height * scale));
      sprite.trim = false;
      glyphNode.active = false;
    }
  }
  return container;
}

function scrimCardNode(parent: Node, name: string, x: number, y: number, width: number, height: number): Node {
  const ink = palette().ink;
  return panel(parent, name, x, y, width, height, new Color(ink.r, ink.g, ink.b, 224), palette().edge, false, 'card');
}

function sealNode(parent: Node, name: string, x: number, y: number, size = 18): Node {
  const seal = node(parent, name, x, y, size, size).addComponent(Graphics);
  activeTheme.paintSeal(seal, palette());
  return seal.node;
}

function dollNodes(parent: Node, x = 0, y = 0): { aura: Node; figure: Node } {
  const aura = node(parent, 'DollAura', x, y - 10, 180, 180).addComponent(Graphics);
  const figure = node(parent, 'DollFigure', x, y - 10, 150, 180).addComponent(Graphics);
  activeTheme.paintDoll({ aura, figure }, palette());
  return { aura: aura.node, figure: figure.node };
}

/** Bound kit engines render through; closes over the active theme/options/images. */
function createSheetKit(context: SheetContext, images: NonNullable<InfiniteFlowInfoSheetOptions['images']>): SheetKit {
  return {
    context: {
      model: context.model, state: context.state, options: context.options,
      frame: context.panel, body: context.body, width: context.width, height: context.height, bodyHeight: context.bodyHeight,
    },
    theme: activeTheme,
    palette: palette(),
    images,
    node,
    panel,
    text,
    icon,
    button: (parent, name, label, x, y, width, enabled, activate, color = palette().textMuted) =>
      button(parent, name, label, x, y, width, enabled, activate, context.options, color),
    tabs: (target, choices, fallback) => {
      const result = tabs(surfaceContext(context, target), choices, fallback);
      return { body: result.context.body, width: result.context.width, bodyHeight: result.context.bodyHeight, active: result.active };
    },
    scrollRegion: (target, contentHeight, reserve = 0, top?: number) => {
      const region = scrollRegion(surfaceContext(context, target), contentHeight, reserve, top);
      return { holder: region.holder, content: region.holder.getChildByName('MobileSheetScrollContent')!, width: region.width, height: region.height, contentHeight: region.contentHeight, scrollView: region.scrollView };
    },
    pagerRegion: (target, regionHeight, contentWidth, pageCount) =>
      hPagerRegion(surfaceContext(context, target), regionHeight, contentWidth, pageCount),
    hScrollRegion: (target, regionHeight, contentWidth) =>
      hStripRegion(surfaceContext(context, target), regionHeight, contentWidth),
    scrollItemY,
    figure: (parent, name, imageKey, x, y, width, height, fallback) =>
      figureNode(context, parent, name, imageKey, x, y, width, height, fallback, images),
    scrimCard: scrimCardNode,
    seal: sealNode,
    doll: (parent, x, y) => dollNodes(parent, x, y),
    panelActions: (kind) => getInfiniteFlowMobilePanelActions(context.model, kind),
    renderActions: (target, actions, empty) => renderActions(surfaceContext(context, target), actions, empty),
    renderTextPages: (target, pages) => renderTextPages(surfaceContext(context, target), pages),
    drawScrollDoc: (target, pages, reserve = 0) => drawScrollDoc(surfaceContext(context, target), pages, reserve),
    inventoryPages: () => inventoryPages(context.model),
    metricColor: metricAccent,
    readable,
    wrapLine: (value, maxUnits) => wrapInfiniteFlowLine(value, maxUnits),
  };
}

/**
 * Layout object that runs the exact production bodies. The gallery baseline
 * style passes this; the dispatcher also inlines any BASELINE id so style 01
 * is pixel-identical without crossing the layout boundary.
 */
export const PRODUCTION_SHEET_LAYOUT: SheetLayout = {
  id: BASELINE_LAYOUT_ID,
  frameGeometry: (input: SheetLayoutFrameInput) => productionFrameGeometry(input.safeInsets, input.surfaceHeight, input.kind, input.viewportWidth),
  renderChrome: productionRenderChrome,
  renderCharacter: (kit) => renderCharacter(sheetContextFromEngineKit(kit)),
  renderMenu: (kit) => renderMenu(sheetContextFromEngineKit(kit)),
  renderInventory: (kit) => renderInventory(sheetContextFromEngineKit(kit)),
};

function sheetContextFromEngineKit(kit: SheetKit): SheetContext {
  const engine = kit.context;
  return { model: engine.model, state: engine.state, options: engine.options, panel: engine.frame, body: engine.body, width: engine.width, height: engine.height, bodyHeight: engine.bodyHeight, images: kit.images };
}

/** Render one bounded mobile sheet over the still-visible game world. */
export function renderInfiniteFlowInfoSheet(root: Node, model: GameViewModel, state: MobileSheetState, options: InfiniteFlowInfoSheetOptions): void {
  const previousTheme = activeTheme, previousCompact = activeCompact, previousUnit = activeUnit;
  activeCompact = !options.layout || options.layout.id === BASELINE_LAYOUT_ID;
  activeTheme = options.theme ?? (activeCompact ? COMPACT_SHEET_THEME : DEFAULT_SHEET_THEME);
  const frame = view.getFrameSize();
  const viewportWidth = options.viewportWidth ?? (frame.width > 0 && frame.height > 0
    ? Math.min(frame.width, frame.height * 750 / options.surfaceHeight) : 390);
  activeUnit = 750 / viewportWidth;
  try {
    const current = state.kind === 'inventory' && state.tab === 'carry'
      ? { ...state, kind: 'character' as const, tip: undefined } : state;
    renderInfiniteFlowInfoSheetBody(root, model, current, options);
  } finally {
    activeTheme = previousTheme;
    activeCompact = previousCompact;
    activeUnit = previousUnit;
  }
}

function renderInfiniteFlowInfoSheetBody(root: Node, model: GameViewModel, state: MobileSheetState, options: InfiniteFlowInfoSheetOptions): void {
  const surfaceHeight = Math.max(1334, options.surfaceHeight);
  if (state.kind === 'inventory' && (state.tab === 'hud-relics' || state.tab === 'hud-party'
    || state.tab === 'hud-reward-points' || state.tab === 'hud-lingyun')) {
    renderHudPopover(root, model, state, options, surfaceHeight);
    return;
  }
  const compactCombat = model.phase === 'combat' && (combatChoiceGroup(state) !== undefined || state.tab === 'confirm-combat');
  // The room sheet leaves the room in view above it, like the room event sheet.
  const roomDetail = roomSheetDetail(model, state);
  const claimTasks = claimSheetTasks(model, state);
  const backdrop = buildBackdrop(root, surfaceHeight, compactCombat || roomDetail !== undefined || claimTasks !== undefined);
  if (compactCombat) options.bindLocal(backdrop, options.close);
  const activeLayout = options.layout && options.layout.id !== BASELINE_LAYOUT_ID ? options.layout : undefined;
  const baseGeometry = activeLayout
    ? activeLayout.frameGeometry({ safeInsets: options.safeInsets, surfaceHeight, kind: state.kind, viewportWidth: options.viewportWidth })
    : roomDetail ? roomSheetFrameGeometry(roomDetail, options.safeInsets, surfaceHeight, 750 / activeUnit)
      : claimTasks ? headedSheetFrameGeometry(claimSheetHeading(claimTasks), options.safeInsets, surfaceHeight, 750 / activeUnit)
        : productionFrameGeometry(options.safeInsets, surfaceHeight, state.kind, 750 / activeUnit);
  const u = 750 / (options.viewportWidth ?? 390);
  const group = combatChoiceGroup(state);
  const equipmentContent = state.kind === 'interaction'
    ? equipmentOfferContent(model, state, baseGeometry.bodyWidth, u) : undefined;
  const claimContent = state.kind === 'interaction'
    ? (roomDetail ? roomRewardContent(model, state, u) : rewardClaimContent(model, state, baseGeometry.bodyWidth, u))
      ?? relicDraftContent(model, state, baseGeometry.bodyWidth, u, options.rewardReceipt) : undefined;
  const actionSize = compactCombat
    ? group ? combatPickerContent(model, baseGeometry.bodyWidth, u, group)
      : actionDetailContent(model, state, baseGeometry.bodyWidth, u, options.chrome) : undefined;
  const detail = model.sections[1].detail;
  const documentHeight = (pages: readonly SheetPage[], reserve = 0): number => {
    const sections = (pages.length ? pages : [{ title: '当前信息', lines: ['暂无可显示内容。'] }])
      .map(section => wrapDocSection({ width: baseGeometry.bodyWidth }, section));
    const full = sections.reduce((sum, section) => sum + docCardHeight(section), 8 * u)
      + Math.max(0, sections.length - 1) * 9 * u;
    const helpReserve = pages.some(page => page.helpId !== undefined) ? 52 * u : 0;
    return Math.min(300 * u, full) + Math.max(reserve, helpReserve);
  };
  let generalBodyHeight: number | undefined;
  if (state.kind === 'character' && state.tab !== 'loadout') {
    generalBodyHeight = (300 + 51 + (state.tab === 'carry' ? 28 : 0)) * u;
  } else if (state.kind === 'help') generalBodyHeight = Math.max(48 * u, Math.min(300 * u,
    model.sections[4].entries.length * (HELP_CARD_HEIGHT + 4) * u));
  else if (state.kind === 'log') generalBodyHeight = documentHeight(model.sections[5].lines.map((entry, index) => ({ title: `冒险记录 · ${index + 1}`, lines: [entry] })));
  else if (state.kind === 'menu' && !compactCombat) {
    if (state.tab === 'actions') {
      const action = actionContent(model, state, baseGeometry.bodyWidth, u, undefined, options.chrome);
      generalBodyHeight = Math.min(300 * u, action.contentHeight) + Math.max(action.footerHeight, 52 * u);
    } else generalBodyHeight = 300 * u;
  } else if (state.kind === 'objectives') generalBodyHeight = 348 * u;
  else if (state.kind === 'interaction' && !equipmentContent && !claimContent) {
    if (roomDetail) {
      const rewardActionId = state.tab === 'reward-services' ? roomDetail.rewardPreview?.actionId : undefined;
      const actions = getInfiniteFlowMobilePanelActions(model, 'interaction').filter(action => action.actionId !== rewardActionId);
      generalBodyHeight = ROOM_SHEET_FIT_SLACK + (actions.length === 0 ? documentHeight([{ title: '当前状态', lines: ['当前没有可执行选项。'] }], roomSheetFooterHeight(u))
        : Math.min(300 * u, actionContent(model, state, baseGeometry.bodyWidth, u, actions, options.chrome).contentHeight) + roomSheetFooterHeight(u));
    } else if (state.tab === 'overview') generalBodyHeight = 51 * u + documentHeight(detail.kind === 'explore'
      ? [{ title: detail.pending?.title ?? detail.currentNode.title, lines: [detail.pending?.message ?? detail.currentNode.description] }]
      : [{ title: '当前交互', lines: ['走近场景中的交互点后查看。'] }]);
    else {
      const action = actionContent(model, state, baseGeometry.bodyWidth, u, undefined, options.chrome);
      generalBodyHeight = 51 * u + Math.min(300 * u, action.contentHeight) + action.footerHeight;
    }
  }
  const roomList = roomDetail ? equipmentContent ?? claimContent : claimTasks ? claimSheetContent(claimTasks, u) : undefined;
  const compactContent = roomList ? { bodyHeight: Math.min(300 * u, roomList.contentHeight) + roomSheetFooterHeight(u) + ROOM_SHEET_FIT_SLACK }
    : equipmentContent ?? claimContent ?? actionSize
      ?? (generalBodyHeight === undefined ? undefined : { bodyHeight: generalBodyHeight });
  const chromeHeight = baseGeometry.height - baseGeometry.bodyHeight;
  const height = !activeLayout && compactContent
    ? Math.min(baseGeometry.height, compactContent.bodyHeight + chromeHeight) : baseGeometry.height;
  // The room sheet keeps its bottom edge docked while its height follows the content.
  const geometry = { ...baseGeometry, height, bodyHeight: height - chromeHeight,
    ...(roomDetail || claimTasks ? { centerY: baseGeometry.centerY - (baseGeometry.height - height) / 2 } : {}) };
  const chrome = activeLayout
    ? activeLayout.renderChrome({ root: backdrop, model, state, options, surfaceHeight, geometry })
    : roomDetail ? renderRoomSheetChrome({ root: backdrop, model, state, options, surfaceHeight, geometry }, (bodyWidth, unit) => roomSheetHeading(roomDetail, bodyWidth, unit))
      : claimTasks ? renderRoomSheetChrome({ root: backdrop, model, state, options, surfaceHeight, geometry }, claimSheetHeading(claimTasks), 'MobileInfoSheet:claims')
        : productionRenderChrome({ root: backdrop, model, state, options, surfaceHeight, geometry });
  // Gallery tiers pass images explicitly (EMPTY/FAKE); production reads the
  // module-level registry populated by the app's best-effort preload.
  const images = options.images ?? getSheetFigures();
  const context: SheetContext = { model, state, options, panel: chrome.frame, body: chrome.body, width: chrome.width, height: geometry.height, bodyHeight: chrome.bodyHeight, images };
  if (!activeLayout) {
    renderSheetKind(context);
    const scroll = catalogScrollByFrame.get(context.panel);
    if (scroll) sheetScrollCaptures.set(root, { state, scroll, detailScroll: catalogDetailScrollByFrame.get(context.panel) });
    const entryScroll = entryScrollByFrame.get(context.panel);
    if (entryScroll) entryScrollCaptures.set(root, entryScroll);
    const mapScroll = mapScrollByFrame.get(context.panel);
    if (mapScroll) mapScrollCaptures.set(root, mapScroll);
    if (state.tip) renderSheetTip(context, backdrop);
    return;
  }
  // Gallery engines own the three bodies; the character metric drill stays a
  // shared production sub-state so the drill page never forks per engine.
  const kit = createSheetKit(context, options.images ?? EMPTY_SHEET_IMAGE_LIBRARY);
  if (state.kind === 'character') {
    const selected = model.sections[1].metrics.find((metric) => metric.id === state.selectedActionId);
    if (selected) { renderMetricDetail(context, selected); return; }
    activeLayout.renderCharacter(kit);
  } else if (state.kind === 'menu') {
    activeLayout.renderMenu(kit);
  } else if (state.kind === 'inventory') {
    activeLayout.renderInventory(kit);
  } else {
    renderSheetKind(context);
  }
}
