import { BlockInputEvents, Color, Graphics, Label, Mask, Node, ScrollView, Size, Sprite, SpriteFrame, UITransform, Vec2, Vec3, view } from 'cc';
import { EQUIPMENT, ITEMS, getGameAsset, type ItemId } from '@infinite-flow/core';
import type { GameViewModel, HelpEntryViewModel, HubPanel, HubOwnedLoadoutViewModel, HubShopCatalogViewModel, HubShopRowViewModel, MapNodeViewModel, StatusMetric, ViewActionModel } from '@infinite-flow/presentation';
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

export type MobilePanelKind = 'character' | 'inventory' | 'map' | 'objectives' | 'log' | 'menu' | 'interaction' | 'entry' | 'npc' | 'help' | 'result';
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
  /** Expanded service in the reincarnation gate's configuration list. */
  entryServiceId?: string;
  entryView?: 'configuration';
  entryDungeonScrollOffset?: number;
  mapDungeonId?: string;
  /** Positive distances from the complete map's top-left corner. */
  mapScrollOffset?: Readonly<{ x: number; y: number }>;
  taskId?: string;
  taskScrollOffset?: number;
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
  /** Gallery-only sheet theme; production call sites omit it and render DEFAULT. */
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
let activeTheme: SheetTheme = DEFAULT_SHEET_THEME;
const palette = (): SheetPalette => activeTheme.palette;
const TITLES: Readonly<Record<MobilePanelKind, string>> = Object.freeze({
  character: '角色信息', inventory: '行囊', map: '区域地图', objectives: '任务目标',
  log: '冒险记录', menu: '主菜单', interaction: '当前交互', entry: '轮回之门',
  npc: '整备交谈', help: '冒险指南', result: '本轮结算',
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

/** Capture before the host replaces its Cocos tree, including command/asset refreshes. */
export function captureInfiniteFlowInfoSheetState(root: Node | undefined, state: MobileSheetState): MobileSheetState {
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
    || saved.state.entryServiceId !== state.entryServiceId || saved.state.entryView !== state.entryView) return state;
  if (state.kind === 'objectives') {
    if (saved.state.taskId !== state.taskId) return state;
    return { ...state, taskScrollOffset: Math.max(0, saved.scroll.getScrollOffset().y) };
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
  const effectiveSize = Math.round(size * activeTheme.typeScale[typeRole(size, centered)]);
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
  const result = panel(parent, name, x, y, width, TOUCH, fill, edge, false, 'control');
  text(result, 'Label', label, 0, 0, width - 20, 78, 27, enabled ? colors.text : colors.textMuted, true);
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
  const width = (context.width - GAP * (choices.length - 1)) / choices.length;
  // The touch floor stays 104 design px (44 physical px at the 320px viewport),
  // but the plate is transparent: the visible tab is a compact 60px visual
  // pinned to its top edge so the strip reads as a WoW tab row, not buttons.
  const TAB_VISUAL_H = 60;
  for (let index = 0; index < choices.length; index += 1) {
    const choice = choices[index]!;
    const tabRole: SheetFrameRole = choice.id === active ? 'tabActive' : 'tabIdle';
    const child = panel(context.body, `MobileSheetTab:${choice.id}`, -context.width / 2 + width / 2 + index * (width + GAP), context.bodyHeight / 2 - TOUCH / 2, width, TOUCH, withAlpha(palette().surface, 0), withAlpha(palette().surface, 0), false, tabRole);
    const tabVisual = panel(child, 'TabVisual', 0, 0, width, TAB_VISUAL_H, choice.id === active ? palette().accentDark : palette().quiet, choice.id === active ? palette().accent : palette().edge, false, tabRole);
    text(tabVisual, 'Label', choice.title, 0, 0, width - 16, 40, 26, choice.id === active ? palette().accent : palette().text, true);
    context.options.bindLocal(child, () => context.options.setState({ kind: context.state.kind, page: 0, tab: choice.id }));
  }
  const bodyHeight = context.bodyHeight - TOUCH - GAP;
  const body = node(context.body, 'MobileSheetTabBody', 0, -(TOUCH + GAP) / 2, context.width, bodyHeight);
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
  const viewHeight = top === undefined ? context.bodyHeight - reserve : Math.max(120, top + context.bodyHeight / 2 - 24);
  const centerY = top === undefined ? reserve / 2 : top - viewHeight / 2;
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
    const barWidth = thumbSpec.width;
    thumbHeight = Math.max(72, Math.round(viewHeight * viewHeight / contentHeight));
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
function wrapDocSection(context: SheetContext, section: DocSection): DocSection {
  const maxUnits = Math.max(8, Math.floor((context.width - 72) / 28));
  const lines = section.lines.map((entry) => readable(entry)).flatMap((entry) => {
    if (entry.length === 0) return [''];
    return entry.split('\n').flatMap((logical) => wrapInfiniteFlowLine(logical, maxUnits));
  });
  return { ...section, lines: lines.length === 0 ? ['暂无记录。'] : lines };
}

function docCardHeight(section: DocSection): number {
  return 104 + section.lines.length * 38 + 18;
}

/** Lay all logical sections out as cut-corner cards in one vertical scroll document. */
function drawScrollDoc(context: SheetContext, logical: readonly SheetPage[], reserve: number): void {
  const sections = (logical.length === 0 ? [{ title: '当前信息', lines: ['暂无可显示内容。'] }] : logical).map((section) => wrapDocSection(context, section));
  const contentHeight = sections.reduce((sum, section) => sum + docCardHeight(section) + GAP, 8) - GAP + 8;
  const region = scrollRegion(context, contentHeight, reserve);
  const content = scrollContentNode(region);
  let cursor = 8;
  sections.forEach((section) => {
    const cardHeight = docCardHeight(section);
    const card = panel(content, 'MobileSheetReadout', 0, scrollItemY(region, cursor, cardHeight), region.width, cardHeight, palette().quiet, palette().edge);
    text(card, 'ReadoutTitle', readable(section.title), 0, cardHeight / 2 - 39, region.width - 64, 50, 29, palette().accent);
    section.lines.forEach((entry, index) => text(card, `ReadoutLine:${index}`, entry, 0, cardHeight / 2 - 97 - index * 38, region.width - 64, 38, 28));
    cursor += cardHeight + GAP;
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
  supplies: ['hub/buy-item', 'hub/configure-tactical-loadout', 'hub/recover'],
  equipment: ['hub/buy-equipment', 'hub/equip-equipment', 'hub/upgrade-equipment', 'hub/attune-equipment', 'hub/temper-equipment', 'hub/activate-equipment-memory', 'hub/start-equipment-commission', 'hub/recall-equipment-commission'],
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
      || (action.event.kind === 'command' && ['run/retreat', 'node/use-soul-skill', 'combat/use-method-technique', 'combat/use-companion-assist', 'combat/use-bloodline-surge'].includes(action.event.command.type))
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
  if (kind === 'inventory') return actions.filter((action) => {
    if (action.placement === 'preparation' && action.event?.kind === 'local' && action.event.action.type === 'hub/select-panel') return action.event.action.panel === 'supplies' || action.event.action.panel === 'equipment';
    return (detail.activePanel === 'supplies' || detail.activePanel === 'equipment') && hubPanelAction(action, detail.activePanel);
  });
  return [];
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
  const lines: string[] = [];
  const detail = context.model.sections[1].detail;
  if (context.state.kind === 'npc' && detail.kind === 'hub') lines.push(`当前查看：${detail.panelSummary}`);
  if (action.readout) lines.push(`效果与消耗：${readable(action.readout)}`);
  if (action.riskReason) lines.push(`风险：${readable(action.riskReason)}`);
  if (action.disabledReason) lines.push(`不可用原因：${context.model.phase === 'hub' ? formatInfiniteFlowHubActionLockedReason(action) : readable(action.disabledReason)}`);
  if (lines.length === 0) lines.push(actionSummary(context.model, action));
  if (context.options.chrome.busyActionId !== undefined) lines.push('当前行动正在处理，请稍候。');
  if (context.options.chrome.blockingMessage !== undefined) lines.push(readable(context.options.chrome.blockingMessage));
  return lines;
}

function canExecute(context: SheetContext, action: ViewActionModel): boolean {
  return action.enabled && action.event !== undefined && context.options.chrome.busyActionId === undefined && context.options.chrome.modeKind !== 'blocked';
}

function renderActionDetail(context: SheetContext, action: ViewActionModel): void {
  const reserve = TOUCH + GAP;
  drawScrollDoc(context, [{ title: actionLabel(context.model, action), lines: actionLines(context, action) }], reserve);
  const width = (context.width - GAP) / 2;
  const y = -context.bodyHeight / 2 + TOUCH / 2;
  button(context.body, 'MobileSheetActionBack', '返回选项', -(width + GAP) / 2, y, width, true, () => context.options.setState({ kind: context.state.kind, tab: context.state.tab, page: 0 }), context.options);
  const enabled = canExecute(context, action);
  const confirmLabel = action.event?.kind === 'local' && action.event.action.type === 'entry/request-enter' ? '确认入场' : '确认执行';
  const execute = button(context.body, `MobileSheetExecute:${action.actionId}`, enabled ? confirmLabel : '当前不可用', (width + GAP) / 2, y, width, enabled, undefined, context.options, action.riskReason || action.emphasis === 'danger' ? palette().danger : palette().accent);
  if (enabled) context.options.bindAction(execute, action);
}

function directNavigation(action: ViewActionModel): boolean {
  if (action.event?.kind !== 'local') return false;
  return ['hub/select-panel', 'hub/select-catalog-entry', 'entry/select-dungeon'].includes(action.event.action.type);
}

const ACTION_CARD_HEIGHT = 188;

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

function renderActions(context: SheetContext, actions: readonly ViewActionModel[], empty = '当前没有可执行选项。'): void {
  const selected = actions.find((action) => action.actionId === context.state.selectedActionId);
  if (selected !== undefined) { renderActionDetail(context, selected); return; }
  if (actions.length === 0) { renderTextPages(context, [{ title: '当前状态', lines: [empty] }]); return; }
  const detail = context.model.sections[1].detail;
  const npc = context.state.kind === 'npc' && detail.kind === 'hub' ? detail : undefined;
  // Catalog browsing is local navigation, not an upgrade or purchase. Keep it
  // separate while preserving the exact VM actions and their host bindings.
  const navigation = npc ? actions.filter(directNavigation) : [];
  const choices = npc ? actions.filter((action) => !directNavigation(action)) : actions;
  const current = npc ? wrapDocSection(context, {
    title: '当前查看',
    lines: [npc.panelSummary],
  }) : undefined;
  const currentHeight = current ? 76 + current.lines.length * 38 : 0;
  const navigationRows = Math.ceil(navigation.length / 2);
  const introHeight = npc ? currentHeight + GAP + navigationRows * (TOUCH + GAP) + 52 : 0;
  const cardHeight = npc ? ACTION_CARD_HEIGHT + 38 : ACTION_CARD_HEIGHT;
  const contentHeight = 8 + introHeight + choices.length * (cardHeight + GAP) - GAP + 8;
  const region = scrollRegion(context, contentHeight);
  const content = scrollContentNode(region);
  if (current) {
    const card = panel(content, 'MobileSheetNpcSelection', 0, scrollItemY(region, 8, currentHeight), region.width, currentHeight, palette().quiet, palette().edge);
    text(card, 'NpcSelectionTitle', current.title, 0, currentHeight / 2 - 30, region.width - 64, 44, 26, palette().accent);
    current.lines.forEach((entry, index) => text(card, `NpcSelectionLine:${index}`, entry, 0, currentHeight / 2 - 75 - index * 38, region.width - 64, 38, 28));
    const width = (region.width - GAP) / 2;
    navigation.forEach((action, index) => {
      const enabled = canExecute(context, action);
      const cursor = 8 + currentHeight + GAP + Math.floor(index / 2) * (TOUCH + GAP);
      const control = button(content, `MobileSheetAction:${action.actionId}`, actionLabel(context.model, action), (index % 2 === 0 ? -1 : 1) * (width + GAP) / 2, scrollItemY(region, cursor, TOUCH), width, enabled, undefined, context.options);
      if (enabled) context.options.bindAction(control, action);
    });
    const heading = panel(content, 'MobileSheetNpcActionHint', 0, scrollItemY(region, 8 + introHeight - 52, 44), region.width, 44, palette().quiet, palette().edge);
    text(heading, 'NpcActionHint', '选择下方操作，先看用途与消耗，再确认', 0, 0, region.width - 24, 38, 24, palette().textMuted, true);
  }
  choices.forEach((action, index) => {
    const enabled = canExecute(context, action);
    const accent = !action.enabled ? palette().textMuted : action.riskReason || action.emphasis === 'danger' ? palette().danger : palette().accent;
    const cursor = 8 + introHeight + index * (cardHeight + GAP);
    const card = panel(content, `MobileSheetAction:${action.actionId}`, 0, scrollItemY(region, cursor, cardHeight), region.width, cardHeight, palette().quiet, accent === palette().danger ? palette().dangerDark : palette().edge);
    icon(card, 'ActionIcon', action.riskReason ? 'danger' : context.state.kind, -context.width / 2 + 43, cardHeight / 2 - 47, accent);
    text(card, 'ActionTitle', actionLabel(context.model, action), 33, cardHeight / 2 - 42, context.width - 112, 66, 28, action.enabled ? palette().text : palette().textMuted);
    const units = Math.max(8, Math.floor((context.width - 34) / 24));
    const summary = npc && action.readout ? formatInfiniteFlowHubActionShortCopy(action) : actionSummary(context.model, action);
    const preview = wrapInfiniteFlowLine(summary, units);
    const lineCount = npc ? 3 : 2;
    text(card, 'ActionReadoutPreview', `${preview.slice(0, lineCount).join('\n')}${preview.length > lineCount ? '…' : ''}`, 0, -8, context.width - 34, npc ? 106 : 68, 24, palette().textMuted);
    text(card, 'ActionAffordance', directNavigation(action) && enabled ? '点击切换' : !action.enabled ? npc ? '暂不可用 · 查看条件  ›' : '查看不可用原因  ›' : npc ? '查看用途与消耗  ›' : '查看详情  ›', 0, -cardHeight / 2 + 21, context.width - 34, 34, 22, accent);
    if (directNavigation(action) && enabled) context.options.bindAction(card, action);
    else context.options.bindLocal(card, () => context.options.setState({ ...context.state, page: 0, selectedActionId: action.actionId }));
  });
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
const DOLL_ROW_Y = [198, 66, -66, -198] as const;
const DOLL_SLOT_X = 255;
const DOLL_STAGE_HEIGHT = 560;
const DOLL_PORTRAIT_W = 240;
const DOLL_PORTRAIT_H = 370;
const STAT_BOX_HEIGHT = 246;

function metricAccent(metric: StatusMetric | undefined): Color {
  if (metric?.severity === 'danger') return palette().danger;
  if (metric?.severity === 'warning') return palette().accent;
  if (metric?.severity === 'positive') return palette().positive;
  return palette().text;
}

function renderCharacter(context: SheetContext): void {
  if (context.model.phase === 'hub') {
    const tabbed = tabs(context, [{ id: 'overview', title: '角色' }, { id: 'loadout', title: '整备' }], 'overview');
    if (tabbed.active === 'loadout') {
      const owned = context.options.ownedLoadout?.();
      if (owned) renderHubCatalog(tabbed.context, {
        rows: owned.rows, title: '我的装备与养成', npcName: '出发前整备',
        greeting: '在这里穿戴装备、选择出战伙伴和激活已拥有的能力。', services: [],
      });
      else renderTextPages(tabbed.context, [{ title: '整备', lines: ['当前没有可配置的装备或能力。'] }]);
      return;
    }
    context = tabbed.context;
  }
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
  const contentHeight = 8 + DOLL_STAGE_HEIGHT + GAP + STAT_BOX_HEIGHT + 8;
  const region = scrollRegion(context, contentHeight);
  const content = scrollContentNode(region);
  const stage = panel(content, 'MobileSheetDollStage', 0, scrollItemY(region, 8, DOLL_STAGE_HEIGHT),
    context.width, DOLL_STAGE_HEIGHT, palette().quiet, palette().edgeStrong);
  // Centered reincarnator portrait (WoW CharacterPaperdoll), glyph-fallback twin.
  figureNode(context, stage, 'DollPortrait', SHEET_PORTRAIT_KEY, 0, 10, DOLL_PORTRAIT_W, DOLL_PORTRAIT_H,
    { iconKind: 'character', glyphColor: palette().accent }, context.images);
  const badge = panel(stage, 'DollLevelBadge', 0, -DOLL_PORTRAIT_H / 2 - 14, 150, 36, palette().accentDark, palette().edgeStrong, false, 'cell');
  text(badge, 'Label', '转生者 Lv.1', 0, 0, 140, 30, 20, palette().accent, true);
  for (const entry of loadout.equipment) {
    const layout = DOLL_SLOT_LAYOUT.find((candidate) => candidate.slot === entry.slot);
    if (!layout) continue;
    const x = layout.side * DOLL_SLOT_X;
    const y = DOLL_ROW_Y[layout.row]!;
    // WoW paper-doll: slot frame carries the equipped item's rarity edge.
    const slotEdge = qualityEdgeColor(equipmentQuality(entry.equipmentId), palette().edgeStrong);
    const slot = panel(stage, `MobileSheetEquip:${entry.slot}`, x, y, TOUCH, TOUCH, palette().raised, slotEdge, false, 'cell');
    // Slot name floats above the slot in the prototype; the level stays inside.
    text(slot, 'SlotLabel', entry.slotLabel, 0, 68, 96, 24, 18, palette().textMuted, true);
    figureNode(context, slot, `EquipIcon:${entry.slot}`, sheetEquipmentKey(entry.equipmentId), 0, 6, 76, 76,
      { glyph: entry.name.charAt(entry.name.length - 1), glyphSize: 30, glyphColor: palette().textMuted }, context.images);
    text(slot, 'SlotLevel', `Lv${entry.level}`, 0, -40, 60, 24, 18, palette().accent, true);
    // Equipment tips are always read-only; opening works in every phase.
    context.options.bindLocal(slot, () => context.options.setState({ ...context.state, tip: { kind: 'equip', id: entry.equipmentId } }));
  }

  const boxCursor = 8 + DOLL_STAGE_HEIGHT + GAP;
  const box = panel(content, 'MobileSheetStatBox', 0, scrollItemY(region, boxCursor, STAT_BOX_HEIGHT), context.width, STAT_BOX_HEIGHT, palette().quiet, palette().edge);
  const metricValue = (id: string): string => metrics.find((metric) => metric.id === id)?.value ?? '—';
  const heading = (value: string, y: number): void => {
    text(box, `StatHeading:${value}`, value, -context.width / 2 + 28 + 52, y, 120, 30, 20, palette().accent);
    const rule = node(box, `StatRule:${value}`, 0, y - 18, context.width - 56, 2).addComponent(Graphics);
    rule.strokeColor = palette().edge; rule.lineWidth = 2;
    rule.moveTo(-(context.width - 56) / 2, 0); rule.lineTo((context.width - 56) / 2, 0); rule.stroke();
  };
  heading('属性', 96);
  const rows: readonly Readonly<{ name: string; label: string; value: string; color?: Color }>[] = [
    { name: 'MobileSheetKpi:power', label: '战力', value: String(loadout.power), color: palette().danger },
    { name: 'MobileSheetMetric:hp', label: '生命', value: `${loadout.hp}/${loadout.maxHp}` },
    { name: 'MobileSheetKpi:attack', label: '攻击', value: String(loadout.attack) },
    { name: 'MobileSheetKpi:artPower', label: '术法强度', value: String(loadout.artPower) },
    { name: 'MobileSheetKpi:defense', label: '防御', value: String(loadout.defense) },
    { name: 'MobileSheetKpi:speed', label: '速度', value: '—' },
  ];
  // Two columns of label/value pairs with a 24px gutter; value keeps its framed
  // semantic node (gate contract) but the cell is compact like the prototype.
  const columnW = (context.width - 48 - 24) / 2;
  const statYs = [46, 10, -26] as const;
  rows.forEach((row, index) => {
    const col = index % 2 === 0 ? -1 : 1;
    const left = col < 0 ? -context.width / 2 + 24 : 24;
    statPair(box, `StatLabel:${index}`, row.name, row.label, row.value, left, statYs[Math.floor(index / 2)]!, columnW, row.color ?? palette().text);
  });
  heading('货币', -72);
  const currencies: readonly Readonly<{ name: string; label: string; id: string; color: Color }>[] = [
    { name: 'MobileSheetMetric:reward-points', label: '奖励点', id: 'reward-points', color: palette().text },
    { name: 'MobileSheetMetric:lingyun', label: '灵蕴', id: 'lingyun', color: palette().positive },
  ];
  currencies.forEach((currency, index) => {
    const col = index === 0 ? -1 : 1;
    const left = col < 0 ? -context.width / 2 + 24 : 24;
    statPair(box, `MoneyLabel:${currency.id}`, currency.name, currency.label, metricValue(currency.id), left, -106, columnW, currency.color);
  });
}

/**
 * Prototype-style "标签  值" row: pure text on the shared stat-box surface, no
 * per-value background. The semantic KPI/Metric name stays on a transparent
 * cut-corner node so the gate's framed-node contract and cut discipline hold.
 */
function statPair(parent: Node, labelName: string, valueName: string, label: string, value: string, left: number, y: number, columnW: number, color: Color): void {
  text(parent, labelName, label, left + 44, y, 96, 28, 19, palette().textMuted);
  const cellLeft = left + 96;
  const cellW = left + columnW - cellLeft;
  const cell = panel(parent, valueName, cellLeft + cellW / 2, y, cellW, 30, withAlpha(palette().surface, 0), withAlpha(palette().surface, 0), false, 'cell');
  text(cell, 'Value', value, 0, 0, cellW - 8, 26, 19, color, true);
  // Pin values to the column's right edge (prototype space-between stat rows).
  const valueLabel = cell.getChildByName('Value')?.getComponent(Label);
  if (valueLabel) valueLabel.horizontalAlign = Label.HorizontalAlign.RIGHT;
}

const METRIC_CARD_HEIGHT = 172;

/** Compact metric cards in a scrolling two-column grid beneath the paper-doll stage. */
function renderMetricGrid(context: SheetContext, metrics: readonly StatusMetric[], top: number, regionHeight: number, minColumns: number): void {
  if (metrics.length === 0) return;
  const fullBody = regionHeight >= context.bodyHeight - 24;
  const columns = 2;
  const rows = Math.ceil(metrics.length / columns);
  const contentHeight = 8 + rows * METRIC_CARD_HEIGHT + (rows - 1) * GAP + 8;
  const region = fullBody
    ? scrollRegion(context, contentHeight)
    : scrollRegion(context, contentHeight, 0, top);
  const content = scrollContentNode(region);
  const width = (region.width - GAP * (columns - 1)) / columns;
  metrics.forEach((metric, index) => {
    const accent = metricAccent(metric);
    const col = index % columns;
    const gridRow = Math.floor(index / columns);
    const cursor = 8 + gridRow * (METRIC_CARD_HEIGHT + GAP);
    const x = -region.width / 2 + width / 2 + col * (width + GAP);
    const card = panel(content, `MobileSheetMetric:${metric.id}`, x, scrollItemY(region, cursor, METRIC_CARD_HEIGHT), width, METRIC_CARD_HEIGHT, palette().quiet, accent === palette().danger ? palette().dangerDark : palette().edge);
    text(card, 'MetricLabel', readable(metric.label), 0, METRIC_CARD_HEIGHT / 2 - 30, width - 24, 34, 23, palette().textMuted, true);
    text(card, 'MetricValue', readable(metric.value), 0, -8, width - 26, 64, 30, accent, true);
    context.options.bindLocal(card, () => context.options.setState({ ...context.state, tab: 'metric', selectedActionId: metric.id, page: 0 }));
  });
}

function renderMetricDetail(context: SheetContext, metric: StatusMetric): void {
  const reserve = TOUCH + GAP;
  drawScrollDoc(context, [{ title: metric.label, lines: [metric.value] }], reserve);
  button(context.body, 'MobileSheetMetricBack', '返回角色状态', 0, -context.bodyHeight / 2 + TOUCH / 2, context.width, true, () => context.options.setState({ kind: 'character', page: 0 }), context.options);
}

function mapTitle(cell: MapNodeViewModel): string { return cell.state === 'fogged' ? '迷雾区域' : cell.title; }

function renderMap(context: SheetContext): void {
  const detail = context.model.sections[1].detail;
  if (detail.kind !== 'explore') { renderTextPages(context, [{ title: '区域地图', lines: ['进入副本探索后，可在此查看已知区域。'] }]); return; }
  const map = detail.map;
  const selected = map.nodes.find((cell) => cell.state !== 'fogged' && `map:${cell.cellId}` === context.state.selectedActionId);
  if (selected !== undefined) {
    const reserve = TOUCH + GAP;
    drawScrollDoc(context, [{ title: mapTitle(selected), lines: [selected.stateLabel, ...(selected.nodeId === detail.currentNode.nodeId ? [detail.currentNode.description] : []), ...(selected.disabledReason ? [selected.disabledReason] : []), '地图用于查看位置。关闭地图后，走近场景中的通道继续探索。'] }], reserve);
    button(context.body, 'MobileSheetMapBack', '返回地图', 0, -context.bodyHeight / 2 + TOUCH / 2, context.width, true, () => context.options.setState({ ...context.state, selectedActionId: undefined }), context.options);
    return;
  }
  const u = catalogUnit(context);
  const introHeight = 58 * u, legendHeight = 48 * u;
  const viewHeight = context.bodyHeight - introHeight - legendHeight;
  const gap = 8 * u, pad = 4 * u;
  const cellWidth = Math.max(64 * u, (context.width - 3 * gap - 2 * pad) / 4);
  const cellHeight = 72 * u;
  const contentWidth = Math.max(context.width, 2 * pad + map.width * (cellWidth + gap) - gap);
  const contentHeight = Math.max(viewHeight, 2 * pad + map.height * (cellHeight + gap) - gap);
  catalogText(context, context.body, 'MobileSheetMapTitle', readable(map.dungeonName), 0,
    context.bodyHeight / 2 - 14 * u, context.width, 24 * u, 14, palette().accent, true);
  catalogText(context, context.body, 'MobileSheetMapHint', '拖动查看完整地图 · 点击已知区域查看详情', 0,
    context.bodyHeight / 2 - 39 * u, context.width, 20 * u, 11, palette().textMuted, true);
  const holder = node(context.body, 'MobileSheetMapScroll', 0, (legendHeight - introHeight) / 2, context.width, viewHeight);
  holder.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
  const content = node(holder, 'MobileSheetMapContent', (contentWidth - context.width) / 2,
    (viewHeight - contentHeight) / 2, contentWidth, contentHeight);
  const scroll = holder.addComponent(ScrollView);
  scroll.content = content;
  scroll.horizontal = true;
  scroll.vertical = true;
  scroll.inertia = true;
  scroll.brake = 0.75;
  scroll.elastic = true;
  scroll.cancelInnerEvents = true;
  mapScrollByFrame.set(context.panel, { dungeonId: map.dungeonId, scroll });
  for (const cell of map.nodes) {
    const fogged = cell.state === 'fogged';
    const accent = cell.state === 'current' ? palette().accent : cell.state === 'adjacent' || cell.state === 'cleared' ? palette().text : palette().textMuted;
    const tile = panel(content, fogged ? `MobileSheetFog:${cell.x}:${cell.y}` : `MobileSheetMapCell:${cell.cellId}`,
      -contentWidth / 2 + pad + cellWidth / 2 + cell.x * (cellWidth + gap),
      contentHeight / 2 - pad - cellHeight / 2 - cell.y * (cellHeight + gap),
      cellWidth, cellHeight, cell.state === 'current' ? palette().accentDark : fogged ? palette().ink : palette().raised,
      cell.state === 'current' ? palette().accent : palette().edge, false, fogged ? 'fog' : 'tile');
    const g = node(tile, 'MapStateIcon', 0, 16 * u, 24 * u, 24 * u).addComponent(Graphics);
    g.strokeColor = accent; g.fillColor = palette().textMuted; g.lineWidth = 1.5 * u;
    if (fogged) { for (const dx of [-6, 0, 6]) { g.circle(dx * u, 0, u); g.fill(); } }
    else if (cell.state === 'current') { g.circle(0, 0, 8 * u); g.stroke(); g.circle(0, 0, 3 * u); g.stroke(); }
    else if (cell.state === 'cleared') line(g, [-7, 0, -2, -5, 8, 7].map(value => value * u));
    else if (cell.state === 'adjacent') line(g, [-8, 0, 8, 0, 3, 5].map(value => value * u));
    else line(g, [0, 8, 8, 0, 0, -8, -8, 0, 0, 8].map(value => value * u));
    catalogText(context, tile, 'MapCellTitle', mapTitle(cell), 0, -14 * u, cellWidth - 8 * u,
      36 * u, 11, fogged ? palette().textMuted : palette().text, true);
    // Fog tiles have no title/nodeId readout or action binding of any kind.
    if (!fogged) context.options.bindLocal(tile, () => {
      const offset = scroll.getScrollOffset();
      context.options.setState({ ...context.state, selectedActionId: `map:${cell.cellId}`, mapDungeonId: map.dungeonId,
        mapScrollOffset: { x: Math.max(0, -offset.x), y: Math.max(0, offset.y) } });
    });
  }
  const maxX = contentWidth - context.width, maxY = contentHeight - viewHeight;
  const thumbSpec = activeTheme.thumb;
  const thumbs: { axis: 'x' | 'y'; node: Node; length: number }[] = [];
  for (const axis of ['x', 'y'] as const) {
    const extent = axis === 'x' ? context.width : viewHeight;
    const total = axis === 'x' ? contentWidth : contentHeight;
    if (total <= extent) continue;
    const length = Math.max(32 * u, (extent - 4 * u) * extent / total);
    const thumb = node(holder, `MobileSheetMapThumb:${axis}`, 0, 0, axis === 'x' ? length : 2 * u, axis === 'y' ? length : 2 * u);
    const graphics = thumb.addComponent(Graphics);
    graphics.fillColor = withAlpha(thumbSpec.color, thumbSpec.alpha);
    graphics.roundRect(axis === 'x' ? -length / 2 : -u, axis === 'y' ? -length / 2 : -u,
      axis === 'x' ? length : 2 * u, axis === 'y' ? length : 2 * u, u);
    graphics.fill();
    thumbs.push({ axis, node: thumb, length });
  }
  const updateThumbs = (): void => {
    const offset = scroll.getScrollOffset();
    for (const thumb of thumbs) {
      const horizontal = thumb.axis === 'x';
      const ratio = Math.max(0, Math.min(1, horizontal ? -offset.x / maxX : offset.y / maxY));
      thumb.node.setPosition(new Vec3(horizontal
        ? -context.width / 2 + 2 * u + thumb.length / 2 + ratio * (context.width - 4 * u - thumb.length)
        : context.width / 2 - 2 * u,
      horizontal ? -viewHeight / 2 + 2 * u
        : viewHeight / 2 - 2 * u - thumb.length / 2 - ratio * (viewHeight - 4 * u - thumb.length), 0));
    }
  };
  scroll.node.on(ScrollView.EventType.SCROLLING, updateThumbs);
  const current = map.nodes.find(cell => cell.state === 'current');
  const saved = context.state.mapDungeonId === map.dungeonId ? context.state.mapScrollOffset : undefined;
  const offsetX = saved?.x ?? (current ? pad + current.x * (cellWidth + gap) + cellWidth / 2 - context.width / 2 : 0);
  const offsetY = saved?.y ?? (current ? pad + current.y * (cellHeight + gap) + cellHeight / 2 - viewHeight / 2 : 0);
  scroll.scrollToOffset(new Vec2(Math.max(0, Math.min(maxX, offsetX)), Math.max(0, Math.min(maxY, offsetY))), 0);
  updateThumbs();
  catalogText(context, context.body, 'MobileSheetMapLegend', '金环：当前位置    浅灰：相邻 / 已清理\n灰色：已侦察    三点：迷雾未知', 0,
    -context.bodyHeight / 2 + legendHeight / 2, context.width, 36 * u, 11, palette().textMuted, true);
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
  const footerHeight = 54 * u;
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
      const title = wrap(section.title, 14, width);
      const lines = section.lines.flatMap(line => wrap(line, 12, width));
      return { title, lines, height: (24 + title.length * 22 + lines.length * 19) * u };
    });
    const region = scrollRegion(detailContext, facts.reduce((sum, fact) => sum + fact.height, 0));
    const content = scrollContentNode(region);
    let cursor = 0;
    facts.forEach((fact, index) => {
      const item = node(content, `MobileSheetTaskFact:${index}`, 0, scrollItemY(region, cursor, fact.height), context.width, fact.height);
      catalogText(context, item, 'TaskFactTitle', fact.title.join('\n'), 0,
        fact.height / 2 - (10 + fact.title.length * 11) * u, width, fact.title.length * 22 * u, 14, palette().accent);
      catalogText(context, item, 'TaskFactText', fact.lines.join('\n'), 0,
        fact.height / 2 - (14 + fact.title.length * 22 + fact.lines.length * 9.5) * u,
        width, fact.lines.length * 19 * u, 12);
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
    const title = wrap(task.title, 14, titleWidth);
    const progress = task.objectives.flatMap(line => wrap(line, 12, progressWidth));
    return { task, title, progress, height: Math.max(64, 22 + title.length * 22 + progress.length * 19) * u };
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
      height / 2 - (10 + title.length * 11) * u, titleWidth, title.length * 22 * u, 14, palette().accent);
    row.getChildByName('TaskTitle')!.getComponent(Label)!.isBold = true;
    catalogText(context, row, 'TaskStatus', task.status === 'completed' ? '待领取' : task.kind === 'mainline' ? '主线' : '支线',
      context.width / 2 - 38 * u, height / 2 - 21 * u, 54 * u, 20 * u, 11,
      task.status === 'completed' ? palette().positive : palette().textMuted, true);
    catalogText(context, row, 'TaskProgress', progress.join('\n'), -6 * u,
      height / 2 - (14 + title.length * 22 + progress.length * 9.5) * u,
      progressWidth, progress.length * 19 * u, 12);
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

const HELP_CARD_HEIGHT = 168;

function renderHelp(context: SheetContext): void {
  const entries = context.model.sections[4].entries;
  if (entries.length === 0) { drawScrollDoc(context, [{ title: '冒险指南', lines: ['当前没有指南条目。'] }], 0); return; }
  const contentHeight = 8 + entries.length * HELP_CARD_HEIGHT + (entries.length - 1) * GAP + 8;
  const region = scrollRegion(context, contentHeight);
  const content = scrollContentNode(region);
  entries.forEach((entry, index) => {
    const cursor = 8 + index * (HELP_CARD_HEIGHT + GAP);
    const card = panel(content, `MobileSheetHelp:${entry.id}`, 0, scrollItemY(region, cursor, HELP_CARD_HEIGHT), region.width, HELP_CARD_HEIGHT, palette().quiet, palette().edge);
    icon(card, 'HelpIcon', 'help', -context.width / 2 + 44, 31, palette().accent);
    text(card, 'HelpTitle', entry.title, 33, 42, context.width - 108, 58, 29, palette().text);
    const preview = wrapInfiniteFlowLine(readable(entry.summary), Math.floor((context.width - 38) / 25));
    text(card, 'HelpSummary', `${preview.slice(0, 2).join('\n')}${preview.length > 2 ? '…' : ''}`, 0, -27, context.width - 38, 76, 25, palette().textMuted);
    context.options.bindLocal(card, () => context.options.openHelp(entry));
  });
}

function renderMenu(context: SheetContext): void {
  // The advanced/combat action list is a state-level view with its own back
  // button; the prototype-style menu carries no permanent tab strip.
  if (context.state.tab === 'actions') {
    renderSheetActionView(context, 'menu', '返回主菜单', 'MobileSheetTab:shortcuts');
    return;
  }
  const ctx = context;
  // WoW ESC menu: a vertical run of slim centered gold buttons. The bound node
  // stays a full-width 104px transparent touch plate; the visible button inside
  // is 76px tall and inset on both sides like the prototype menu panel.
  const MENU_VISUAL_H = 76;
  const MENU_BUTTON_INSET = 48;
  const tiles: readonly Readonly<{ kind: MobilePanelKind | 'actions' | 'close'; label: string; danger: boolean }>[] = [
    { kind: 'character', label: '角色信息', danger: false },
    { kind: 'inventory', label: '行囊装备', danger: false },
    { kind: 'map', label: '世界地图', danger: false },
    { kind: 'objectives', label: '任务目标', danger: false },
    { kind: 'log', label: '战斗记录', danger: false },
    { kind: 'help', label: '帮助', danger: false },
    { kind: 'entry', label: '轮回之门', danger: false },
    { kind: 'actions', label: ctx.model.phase === 'combat' ? '战斗行动' : '进阶行动', danger: true },
    { kind: 'close', label: '收起', danger: false },
  ];
  const rowHeight = TOUCH;
  const headingHeight = 48;
  const contentHeight = 16 + headingHeight + 12 + tiles.length * rowHeight + (tiles.length - 1) * 12 + 16;
  const region = scrollRegion(ctx, contentHeight);
  const content = scrollContentNode(region);
  text(content, 'MobileSheetMenuHeading', '随身菜单', 0, scrollItemY(region, 16, headingHeight), ctx.width - 16, headingHeight, 24, palette().accent, true);
  tiles.forEach((tile, index) => {
    const cursor = 16 + headingHeight + 12 + index * (rowHeight + 12);
    const y = scrollItemY(region, cursor, rowHeight);
    // Transparent full-size plate keeps the 104px touch floor and frame name.
    const cell = panel(content, `MobileSheetShortcut:${tile.kind}`, 0, y, ctx.width, rowHeight, withAlpha(palette().surface, 0), withAlpha(palette().surface, 0), false, 'tile');
    const visualWidth = ctx.width - MENU_BUTTON_INSET * 2;
    const visual = panel(cell, 'ShortcutButton', 0, 0, visualWidth, MENU_VISUAL_H, tile.danger ? palette().dangerDark : palette().quiet, tile.danger ? palette().danger : palette().edgeStrong, false, 'tile');
    text(visual, 'ShortcutTitle', tile.label, 0, 0, visualWidth - 40, 44, 23, tile.kind === 'close' ? palette().textMuted : tile.danger ? palette().danger : palette().text, true);
    if (tile.kind === 'close') ctx.options.bindLocal(cell, () => ctx.options.close());
    else if (tile.kind === 'actions') ctx.options.bindLocal(cell, () => ctx.options.setState({ kind: 'menu', tab: 'actions', page: 0 }));
    else {
      const kind: MobilePanelKind = tile.kind;
      ctx.options.bindLocal(cell, () => ctx.options.setState({ kind, page: 0, tip: undefined }));
    }
  });
}

/**
 * Full-body action list reached from a sheet destination tile rather than a
 * permanent tab strip. The list scrolls above a fixed 104px back button.
 */
function renderSheetActionView(context: SheetContext, kind: MobilePanelKind, backLabel: string, backName: string): void {
  const shiftedBody = node(context.body, 'MobileSheetTabBody', 0, (TOUCH + GAP) / 2, context.width, context.bodyHeight - TOUCH - GAP);
  const shifted: SheetContext = { ...context, body: shiftedBody, bodyHeight: context.bodyHeight - TOUCH - GAP };
  renderActions(shifted, getInfiniteFlowMobilePanelActions(context.model, kind));
  if (context.state.selectedActionId === undefined) {
    button(context.body, backName, backLabel, 0, -context.bodyHeight / 2 + TOUCH / 2, context.width, true,
      () => context.options.setState({ kind, page: 0 }), context.options);
  }
}

const INVENTORY_COLUMNS = 5;
const INVENTORY_CELL_SIZE = 116;
const INVENTORY_CELL_GAP = 12;
const INVENTORY_TOTAL_SLOTS = 100;

/** WoW ContainerFrame: currency/carry header plus a 5×100 scrolling slot grid. */
type InventoryBagTab = 'items' | 'carry';

function renderInventoryBag(context: SheetContext, loadout: NonNullable<GameViewModel['sections'][1]['loadout']>, activeTab: InventoryBagTab): void {
  const palette0 = palette();
  const metrics = context.model.sections[1].metrics;
  const metricValue = (id: string): string => metrics.find((metric) => metric.id === id)?.value ?? '—';

  // Header row: tab-specific carry wording hugs the left edge; reward points +
  // lingyun ride the right.
  const headerHeight = 48;
  const headerY = context.bodyHeight / 2 - headerHeight / 2 - 4;
  const carryLine = activeTab === 'carry'
    ? `◆ 携行槽 ${loadout.carriedCount} / 3`
    : '◇ 补给品 · 不占携行槽';
  text(context.body, 'MobileSheetMoneyCarry', carryLine, -context.width / 2 + 8 + 120, headerY, 280, headerHeight, 22, palette0.accent);
  const rewardLabelW = 150;
  const rewardLabelX = context.width / 2 - 8 - rewardLabelW / 2;
  const rewardTokenX = rewardLabelX - rewardLabelW / 2 - 8 - 14;
  const lingyunLabelW = 120;
  const lingyunLabelX = rewardTokenX - 14 - 16 - lingyunLabelW / 2;
  const lingyunTokenX = lingyunLabelX - lingyunLabelW / 2 - 8 - 14;
  panel(context.body, 'MoneyTokenReward', rewardTokenX, headerY, 28, 28, palette0.accentDark, palette0.accent, false, 'cell');
  text(context.body, 'MobileSheetMoney:reward', `${metricValue('reward-points')} 奖励点`, rewardLabelX, headerY, rewardLabelW, headerHeight, 20, palette0.accent);
  panel(context.body, 'MoneyTokenLingyun', lingyunTokenX, headerY, 28, 28, palette0.quiet, palette0.positive, false, 'cell');
  text(context.body, 'MobileSheetMoney:lingyun', `${metricValue('lingyun')} 灵蕴`, lingyunLabelX, headerY, lingyunLabelW, headerHeight, 20, palette0.positive);

  const hintY = headerY - headerHeight / 2 - 12 - 10;
  const hintCopy = activeTab === 'carry'
    ? '携行特殊道具 6 种 · 仅主神空间配置 · 5 列 × 100 格'
    : '补给品 3 种 · 上下滑动浏览 · 点击钉住详情';
  text(context.body, 'MobileSheetBagHint', hintCopy, 0, hintY, context.width, 24, 20, palette0.textMuted, true);

  const gridWidth = INVENTORY_COLUMNS * INVENTORY_CELL_SIZE + (INVENTORY_COLUMNS - 1) * INVENTORY_CELL_GAP;
  const gridTop = hintY - 14 - 12;
  const gridHeight = Math.max(120, gridTop + context.bodyHeight / 2);
  const backing = panel(context.body, 'MobileSheetInventoryRack', 0, gridTop - gridHeight / 2, context.width, gridHeight, palette0.quiet, palette0.edge, false, 'rack');

  // Each tab owns a full 5×100 slot grid: the 道具 tab lists the 3 supplies,
  // the 携行 tab lists the 6 carried special items; every tab pads to 100.
  const entries = loadout.items.filter((entry) =>
    activeTab === 'items' ? entry.itemGroup === 'supply' : entry.itemGroup === 'carry');

  const gridRows = INVENTORY_TOTAL_SLOTS / INVENTORY_COLUMNS;
  // Top pad 16, 20 full rows (incl. gap), 16px bottom pad.
  const contentHeight = 16 + gridRows * (INVENTORY_CELL_SIZE + INVENTORY_CELL_GAP) - INVENTORY_CELL_GAP + 16;
  const regionContext = surfaceContext(context, { body: backing, width: context.width, bodyHeight: gridHeight });
  const region = scrollRegion(regionContext, contentHeight);
  const content = scrollContentNode(region);

  const cellX = (col: number): number =>
    -gridWidth / 2 + INVENTORY_CELL_SIZE / 2 + col * (INVENTORY_CELL_SIZE + INVENTORY_CELL_GAP);
  let blankIndex = entries.length;
  const renderBlank = (col: number, cursor: number): void => {
    const y = scrollItemY(region, cursor, INVENTORY_CELL_SIZE);
    // Purely decorative empty slot: no label, no data, no interaction.
    panel(content, `MobileSheetBlank:${blankIndex}`, cellX(col), y, INVENTORY_CELL_SIZE, INVENTORY_CELL_SIZE, palette0.ink, palette0.edge, false, 'cell');
    blankIndex += 1;
  };
  const renderItemCell = (entry: typeof loadout.items[number], col: number, cursor: number): void => {
    const y = scrollItemY(region, cursor, INVENTORY_CELL_SIZE);
    const empty = entry.count === 0 && !entry.carried;
    // Rarity edge (WoW item-button tint); the gold carried seal/edge wins when
    // the item is pinned to a carry slot.
    const qualityEdge = qualityEdgeColor(itemQuality(entry.itemId), palette0.edge);
    const cell = panel(content, `MobileSheetItem:${entry.itemId}`, cellX(col), y, INVENTORY_CELL_SIZE, INVENTORY_CELL_SIZE, palette0.raised, entry.carried ? palette0.accent : qualityEdge, false, 'cell');
    figureNode(context, cell, `ItemIcon:${entry.itemId}`, sheetItemKey(entry.itemId), 0, 6, 80, 80,
      { glyph: entry.name.charAt(entry.name.length - 1), glyphSize: 32, glyphColor: empty ? palette0.textMuted : palette0.text }, context.images);
    text(cell, 'ItemCount', `×${entry.count}`, INVENTORY_CELL_SIZE / 2 - 30, -INVENTORY_CELL_SIZE / 2 + 18, 56, 24, 18, entry.count > 0 ? palette0.text : palette0.textMuted, true);
    if (entry.carried) sealNode(cell, 'ItemCarriedSeal', INVENTORY_CELL_SIZE / 2 - 18, INVENTORY_CELL_SIZE / 2 - 18);
    context.options.bindLocal(cell, () => context.options.setState({ ...context.state, tip: { kind: 'item', id: entry.itemId } }));
  };

  let cursor = 16;
  let col = 0;
  for (const entry of entries) {
    renderItemCell(entry, col, cursor);
    col += 1;
    if (col === INVENTORY_COLUMNS) {
      col = 0;
      cursor += INVENTORY_CELL_SIZE + INVENTORY_CELL_GAP;
    }
  }
  // Pad the last partial row, then fill the rest of the 5×100 grid.
  const placedCells = entries.length;
  for (let blankSlot = placedCells; blankSlot < INVENTORY_TOTAL_SLOTS; blankSlot += 1) {
    renderBlank(blankSlot % INVENTORY_COLUMNS, cursor);
    if (blankSlot % INVENTORY_COLUMNS === INVENTORY_COLUMNS - 1) {
      cursor += INVENTORY_CELL_SIZE + INVENTORY_CELL_GAP;
    }
  }
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
  // WoW bag with two slot categories: 道具 (supplies, unrestricted) opens by
  // default; 携行 (the 6 carried special items) is the configured loadout.
  const tabbed = tabs(context, [
    { id: 'items', title: '道具' },
    { id: 'carry', title: '携行' }
  ], 'items');
  const activeTab: InventoryBagTab = tabbed.active === 'carry' ? 'carry' : 'items';
  renderInventoryBag(tabbed.context, loadout, activeTab);
}


function renderTabbedActions(context: SheetContext, pages: readonly SheetPage[], titles: readonly [string, string], initial: 'overview' | 'actions' = 'overview'): void {
  const tabbed = tabs(context, [{ id: 'overview', title: titles[0] }, { id: 'actions', title: titles[1] }], initial);
  if (tabbed.active === 'overview') renderTextPages(tabbed.context, pages);
  else renderActions(tabbed.context, getInfiniteFlowMobilePanelActions(context.model, context.state.kind));
}

/**
 * WoW-style content-height frame metrics. The three redesigned panels size to
 * their content (centered, scrolling inside); the other kinds keep the taller
 * reading surface. The gallery baseline delegates here live, so per-kind
 * geometry shifts S01 and every theme without re-recording a golden.
 */
const SHEET_BAND_HEIGHT = 72;
const SHEET_KIND_HEIGHT: Readonly<Record<MobilePanelKind, number>> = Object.freeze({
  character: 1000,
  menu: 1000,
  inventory: 880,
  map: 1040,
  objectives: 1040,
  log: 1040,
  interaction: 1040,
  entry: 1040,
  npc: 1040,
  help: 1040,
  result: 1040,
});

/** Production frame metrics; extracted verbatim so the baseline layout can delegate to them. */
export function productionFrameGeometry(safeInsets: InfiniteFlowInfoSheetOptions['safeInsets'], surfaceHeight: number, kind: MobilePanelKind = 'entry'): SheetFrameGeometry {
  const width = Math.min(702, 750 - safeInsets.left - safeInsets.right - 32);
  const available = surfaceHeight - safeInsets.top - safeInsets.bottom - 32;
  const height = Math.min(SHEET_KIND_HEIGHT[kind], available);
  const centerX = (safeInsets.left - safeInsets.right) / 2;
  const centerY = (safeInsets.bottom - safeInsets.top) / 2;
  return { centerX, centerY, width, height, bodyWidth: width - 40, bodyHeight: height - SHEET_BAND_HEIGHT - 24 };
}

function buildBackdrop(root: Node, surfaceHeight: number): Node {
  const backdrop = node(root, 'MobileSheetBackdrop', 0, 0, 750, surfaceHeight);
  const shade = backdrop.addComponent(Graphics);
  shade.fillColor = palette().backdrop;
  shade.rect(-375, -surfaceHeight / 2, 750, surfaceHeight);
  shade.fill();
  backdrop.addComponent(BlockInputEvents);
  return backdrop;
}

export function productionRenderChrome(input: SheetChromeInput): SheetLayoutChrome {
  const { root, model, state, options, geometry } = input;
  const { centerX, centerY, width, height, bodyWidth, bodyHeight } = geometry;
  const bandY = height / 2 - SHEET_BAND_HEIGHT / 2;
  const frame = panel(root, `MobileInfoSheet:${state.kind}`, centerX, centerY, width, height, palette().surface, palette().edgeStrong, true, 'sheet');
  frame.addComponent(BlockInputEvents);
  // WoW-style gold lacquer title band; the theme accent keeps it per-skin.
  panel(frame, 'MobileSheetTitleBand', 0, bandY, width - 20, SHEET_BAND_HEIGHT, palette().accentDark, palette().edgeStrong, false, 'titleBand');
  icon(frame, 'MobileSheetHeaderIcon', state.kind, -width / 2 + 52, bandY, palette().accent, 48);
  const detail = model.sections[1].detail;
  const title = state.kind === 'npc' && detail.kind === 'hub' ? detail.shop?.title ?? detail.activePanelLabel
    : state.kind === 'interaction' && detail.kind === 'explore' ? detail.pending?.title ?? detail.currentNode.title : TITLES[state.kind];
  text(frame, 'MobileSheetTitle', readable(title), -16, bandY, width - 220, 60, 27, palette().accent);
  // WoW close affordance: a full 104px invisible touch plate flush with the
  // frame top (keeps the 44px physical target) while only a small gold ✕ is
  // painted, vertically centered on the thinner title band.
  const close = panel(frame, 'MobileSheetClose', width / 2 - 70, height / 2 - TOUCH / 2, TOUCH, TOUCH, withAlpha(palette().surface, 0), withAlpha(palette().surface, 0), false, 'iconButton');
  const closeGlyph = node(close, 'CloseIcon', 0, TOUCH / 2 - SHEET_BAND_HEIGHT / 2, 44, 44).addComponent(Graphics);
  closeGlyph.strokeColor = palette().accent;
  closeGlyph.lineWidth = 3;
  closeGlyph.moveTo(-13, -13); closeGlyph.lineTo(13, 13);
  closeGlyph.moveTo(-13, 13); closeGlyph.lineTo(13, -13);
  closeGlyph.stroke();
  options.bindLocal(close, options.close);
  const body = node(frame, 'MobileSheetBody', 0, -SHEET_BAND_HEIGHT / 2, bodyWidth, bodyHeight);
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
    : state.kind === 'interaction' && detail.kind === 'explore' ? detail.pending?.title ?? detail.currentNode.title : TITLES[state.kind];
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

const TIP_WIDTH = 460;
const TIP_PAD = 24;
const TIP_LINE = 32;
const TIP_TITLE_LINE = 40;
const TIP_BUTTON_H = 60;

type TipLine = Readonly<{ text: string; size: number; color: Color; italic?: boolean }>;

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
  const loadout = context.model.sections[1].loadout;
  const lines: TipLine[] = [];
  let carryAction: ViewActionModel | undefined;
  let carried = false;
  let carriedCount = loadout?.carriedCount ?? 0;

  if (tip.kind === 'equip') {
    const equipped = loadout?.equipment.find((entry) => entry.equipmentId === tip.id);
    const definition = EQUIPMENT[tip.id as keyof typeof EQUIPMENT];
    const quality = equipmentQuality(tip.id);
    lines.push({ text: equipped?.name ?? definition?.name ?? tip.id, size: 28, color: qualityNameColor(quality, palette0.text) });
    if (equipped) lines.push({ text: `${equipped.slotLabel} · ${QUALITY_LABEL[quality]} · 等阶 Lv.${equipped.level}/${equipped.maxLevel} · 已装备`, size: 22, color: palette0.textMuted });
    if (definition) {
      for (const [key, value] of Object.entries(definition.base)) {
        if (typeof value !== 'number' || value === 0) continue;
        const label = EQUIP_STAT_LABELS[key] ?? key;
        lines.push({ text: `${label} ${value > 0 ? '+' : ''}${value}`, size: 23, color: palette0.positive });
      }
      lines.push({ text: definition.description, size: 23, color: palette0.positive });
      const flavor = getGameAsset('equipment', tip.id)?.alt;
      if (flavor) lines.push({ text: flavor, size: 22, color: palette0.accent, italic: true });
      const cost = definition.cost.rewardPoints;
      if (cost !== undefined) lines.push({ text: `兑换价：${cost} 奖励点 · 等阶上限 ${definition.maxLevel}`, size: 20, color: palette0.textMuted });
    }
  } else {
    const entry = loadout?.items.find((item) => item.itemId === tip.id);
    const definition = ITEMS[tip.id as keyof typeof ITEMS];
    const quality = itemQuality(tip.id);
    const isSupply = entry?.itemGroup === 'supply';
    carried = entry?.carried ?? false;
    lines.push({ text: entry?.name ?? definition?.name ?? tip.id, size: 28, color: qualityNameColor(quality, palette0.text) });
    if (isSupply) {
      lines.push({ text: '补给品 · 随库存可用，无需携行', size: 22, color: palette0.textMuted });
    } else {
      lines.push({ text: `${ITEM_CATEGORY_LABELS[entry?.category ?? ''] ?? '战术道具'} · ${QUALITY_LABEL[quality]}`, size: 22, color: palette0.textMuted });
    }
    if (entry) lines.push({ text: isSupply
      ? `库存 ${entry.count} · 补给品`
      : `库存 ${entry.count} · ${entry.carried ? '已携行' : '未携行'}`, size: 22, color: palette0.textMuted });
    if (definition) {
      lines.push({ text: `使用：${definition.description}`, size: 23, color: palette0.positive });
      const flavor = getGameAsset('item', tip.id)?.alt;
      if (flavor) lines.push({ text: flavor, size: 22, color: palette0.accent, italic: true });
      lines.push({ text: `兑换价：${definition.cost?.rewardPoints ?? '—'} 奖励点`, size: 20, color: palette0.textMuted });
    }
    if (context.model.phase === 'hub' && entry) carryAction = resolveCarryToggle(context, entry.itemId);
  }

  // The toggle action is projected even when the domain rejects it (e.g. the
  // 3-slot cap): render the button disabled and let the action's own
  // enabled/disabledReason stay authoritative instead of hiding the seam.
  const showCarry = tip.kind === 'item' && carryAction !== undefined;
  const capNote = tip.kind === 'item' && showCarry && !carried && carriedCount >= 3
    ? '通用携行槽已满（3 / 3）' : undefined;
  if (capNote) lines.push({ text: capNote, size: 20, color: palette0.danger });

  const linesHeight = TIP_TITLE_LINE + (lines.length - 1) * TIP_LINE;
  // The 104px button row (close, optionally plus carry) is always present.
  const tipHeight = Math.max(260, TIP_PAD * 2 + linesHeight + 12 + TOUCH);
  const halfH = context.height / 2;
  let y: number;
  if (tip.anchor) {
    y = tip.anchor.y - tip.anchor.h / 2 - tipHeight / 2 - 12;
    if (y - tipHeight / 2 < -halfH + 12) y = tip.anchor.y + tip.anchor.h / 2 + tipHeight / 2 + 12;
  } else {
    y = halfH - 104 - tipHeight / 2 - 12;
  }
  y = Math.min(halfH - 104 - tipHeight / 2 - 8, Math.max(-halfH + tipHeight / 2 + 12, y));
  const xMax = context.width / 2 - TIP_WIDTH / 2;
  const x = tip.anchor ? Math.max(-xMax, Math.min(xMax, tip.anchor.x)) : 0;

  const card = panel(context.panel, 'MobileSheetTip', x, y, TIP_WIDTH, tipHeight, palette0.quiet, palette0.accent, false, 'card');
  card.addComponent(BlockInputEvents);
  let topCursor = TIP_PAD;
  lines.forEach((line, index) => {
    const lineHeight = index === 0 ? TIP_TITLE_LINE : TIP_LINE;
    text(card, `TipLine:${index}`, line.text, 0, tipHeight / 2 - topCursor - lineHeight / 2, TIP_WIDTH - TIP_PAD * 2, lineHeight, line.size, line.color);
    if (line.italic) {
      const component = card.getChildByName(`TipLine:${index}`)?.getComponent(Label);
      if (component) component.isItalic = true;
    }
    topCursor += lineHeight;
  });

  const buttonY = -tipHeight / 2 + TIP_PAD + TOUCH / 2;
  const buttonWidth = showCarry ? (TIP_WIDTH - TIP_PAD * 2 - 12) / 2 : TIP_WIDTH - TIP_PAD * 2;
  // Bound node keeps the 104px touch floor (and gate contract); the visible
  // button is a compact 60px child, matching the prototype's small tip buttons.
  const closeButton = panel(card, 'MobileSheetTipClose', showCarry ? -TIP_WIDTH / 2 + TIP_PAD + buttonWidth / 2 + 6 : 0, buttonY, buttonWidth, TOUCH,
    withAlpha(palette0.surface, 0), withAlpha(palette0.surface, 0), false, 'control');
  const closeVisual = panel(closeButton, 'TipButtonVisual', 0, 0, buttonWidth, TIP_BUTTON_H, palette0.raised, palette0.edgeStrong, false, 'control');
  text(closeVisual, 'Label', '关闭', 0, 0, buttonWidth - 16, 40, 22, palette0.textMuted, true);
  context.options.bindLocal(closeButton, () => context.options.setState({ ...context.state, tip: undefined }));
  if (showCarry && carryAction) {
    const enabled = canExecute(context, carryAction);
    const carryButton = panel(card, `MobileSheetTipCarry:${tip.id}`, TIP_WIDTH / 2 - TIP_PAD - buttonWidth / 2, buttonY, buttonWidth, TOUCH,
      withAlpha(palette0.surface, 0), withAlpha(palette0.surface, 0), false, 'control');
    const carryVisual = panel(carryButton, 'TipButtonVisual', 0, 0, buttonWidth, TIP_BUTTON_H,
      enabled ? palette0.accentDark : palette0.quiet, enabled ? palette0.accent : palette0.edge, false, 'control');
    text(carryVisual, 'Label', carried ? '取消携行' : '设为携行', 0, 0, buttonWidth - 16, 40, 22, enabled ? palette0.accent : palette0.textMuted, true);
    if (enabled) context.options.bindAction(carryButton, carryAction);
  }

  // Tap outside the frame dismisses only while a tip is pinned.
  context.options.bindLocal(backdrop, () => context.options.setState({ ...context.state, tip: undefined }));
}

type HubCatalogSurface = Pick<HubShopCatalogViewModel, 'rows' | 'npcName' | 'title' | 'greeting' | 'portraitAssetKey' | 'services' | 'serviceTitle'>;

/** Match the HTML prototype's CSS pixels even when the game canvas is letterboxed. */
function catalogUnit(context: SheetContext): number {
  const frame = view.getFrameSize();
  // Headless renderers have no browser frame; use the prototype's 390px phone preset.
  const screenWidth = frame.width > 0 && frame.height > 0
    ? Math.min(frame.width, frame.height * 750 / context.options.surfaceHeight) : 390;
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
  return (Math.max(24, catalogTextWidth(label, 12), Math.min(130, catalogTextWidth(price ?? '', 10))) + 20) * u;
}

/** Compact content-width button: title and price have independent type scales. */
function catalogButton(context: SheetContext, parent: Node, name: string, label: string, x: number, y: number,
  width: number, enabled: boolean, price?: string, primary = false, danger = false): Node {
  const u = catalogUnit(context);
  const colors = palette();
  const control = catalogPanel(context, parent, name, x, y, width, 44 * u,
    !enabled ? colors.quiet : danger ? colors.dangerDark : primary ? colors.accentDark : colors.raised,
    !enabled ? colors.edge : danger ? colors.danger : primary ? colors.accent : colors.edgeStrong);
  catalogText(context, control, 'Label', label, 0, price ? 7 * u : 0, width - 16 * u, 20 * u, 12,
    enabled ? colors.text : colors.textMuted, true);
  if (price) {
    const maxUnits = Math.max(4, (width / u - 20) / 10);
    const lines = wrapInfiniteFlowLine(price, maxUnits);
    catalogText(context, control, 'Price', lines.length > 1 ? `${lines[0]}…` : price,
      0, -10 * u, width - 12 * u, 15 * u, 10, enabled ? colors.text : colors.textMuted, true);
  }
  return control;
}

/** Every chapter is visible at the gate; selecting a row opens that chapter's configuration. */
function renderEntryDungeons(context: SheetContext): void {
  const detail = context.model.sections[1].detail;
  if (detail.kind !== 'hub') return;
  const choices = detail.entryServices?.find(service => service.id === 'dungeon')?.options ?? [];
  const u = catalogUnit(context);
  const introHeight = 30 * u;
  catalogText(context, context.body, 'MobileSheetEntryHint', `共 ${choices.length} 个副本 · 点击查看入场配置`,
    0, context.bodyHeight / 2 - 12 * u, context.width - 8 * u, 24 * u, 11, palette().textMuted);
  const bodyHeight = context.bodyHeight - introHeight;
  const body = node(context.body, 'MobileSheetEntryBody', 0, -introHeight / 2, context.width, bodyHeight);
  const copyWidth = context.width - 34 * u;
  const rows = choices.map(option => {
    const lines = wrapInfiniteFlowLine(option.description, Math.max(8, Math.floor(copyWidth / (11 * u))));
    const description = lines.slice(0, 2);
    if (lines.length > 2) description[1] += '…';
    return { option, description, height: (38 + description.length * 17) * u };
  });
  const region = scrollRegion({ ...context, body, bodyHeight }, rows.reduce((sum, row) => sum + row.height, 0));
  region.holder.name = 'MobileSheetEntryDungeonScroll';
  catalogScrollByFrame.set(context.panel, region.scrollView);
  region.scrollView.scrollToOffset(new Vec2(0, Math.min(Math.max(0, context.state.catalogScrollOffset ?? 0),
    Math.max(0, region.contentHeight - region.height))), 0);
  const content = scrollContentNode(region);
  let cursor = 0;
  for (const { option, description, height } of rows) {
    const row = node(content, `MobileSheetEntryDungeon:${option.id}`, 0, scrollItemY(region, cursor, height), context.width, height);
    catalogRule(row, 'EntryDungeonRule', height / 2, context.width - 4 * u);
    catalogText(context, row, 'EntryDungeonName', option.name, -13 * u, height / 2 - 16 * u,
      copyWidth, 22 * u, 14, palette().accent);
    catalogText(context, row, 'EntryDungeonDescription', description.join('\n'), -13 * u,
      height / 2 - (31 + description.length * 8.5) * u, copyWidth, description.length * 17 * u, 11, palette().textMuted);
    catalogText(context, row, 'EntryDungeonOpen', '›', context.width / 2 - 12 * u, 0,
      20 * u, 24 * u, 18, palette().textMuted, true);
    if (option.selected) context.options.bindLocal(row, () => context.options.setState({ ...context.state,
      entryView: 'configuration', entryServiceId: undefined,
      entryDungeonScrollOffset: Math.max(0, region.scrollView.getScrollOffset().y), catalogScrollOffset: 0,
    }));
    else if (canExecute(context, option.action)) context.options.bindAction(row, option.action);
    cursor += height;
  }
}

/** Selected chapter configuration; only its fixed footer enters a run. */
function renderEntryServices(context: SheetContext): void {
  const detail = context.model.sections[1].detail;
  if (detail.kind !== 'hub') {
    renderTextPages(context, [{ title: '轮回之门', lines: ['回到主神空间后可选择下一次冒险。'] }]);
    return;
  }
  const u = catalogUnit(context);
  const title = context.panel.getChildByName('MobileSheetTitle')?.getComponent(Label);
  if (title) {
    title.string = context.state.entryView === 'configuration' ? `${detail.selectedDungeonName} · 入场配置` : '轮回之门';
    title.fontSize = Math.round(14 * u); title.lineHeight = Math.ceil(21 * u);
  }
  if (detail.entryServices && context.state.entryView !== 'configuration') { renderEntryDungeons(context); return; }
  const services = detail.entryServices?.filter(service => service.id !== 'dungeon') ?? [];
  const action = getInfiniteFlowMobilePanelActions(context.model, 'entry').find(candidate =>
    candidate.actionId === (detail.activePanel === 'entry' ? 'hub.entry.confirm' : 'hub.panel:entry'));
  const enabled = action !== undefined && canExecute(context, action);
  const wrap = (value: string, size: number, width: number): string[] => value.split('\n')
    .flatMap(line => wrapInfiniteFlowLine(readable(line), Math.max(8, Math.floor(width / (size * u)))));
  const notice = [action?.disabledReason, context.options.chrome.blockingMessage,
    context.options.chrome.busyActionId === undefined ? undefined : '当前行动正在处理，请稍候。'].filter(Boolean).join('\n');
  const noticeLines = notice ? wrap(notice, 11, context.width - 8 * u) : [];
  const footerHeight = (62 + noticeLines.length * 17) * u;
  const introHeight = services.length ? 58 * u : 30 * u;
  if (services.length) {
    const backWidth = catalogButtonWidth(context, '返回副本列表');
    const back = catalogButton(context, context.body, 'MobileSheetEntryBack', '返回副本列表',
      -context.width / 2 + backWidth / 2, context.bodyHeight / 2 - 24 * u, backWidth, true);
    context.options.bindLocal(back, () => context.options.setState({ ...context.state, entryView: undefined,
      entryServiceId: undefined, catalogScrollOffset: context.state.entryDungeonScrollOffset ?? 0 }));
  } else catalogText(context, context.body, 'MobileSheetEntryHint', '打开副本列表，选择下一次冒险。',
    0, context.bodyHeight / 2 - 12 * u, context.width - 8 * u, 24 * u, 11, palette().textMuted);
  const bodyHeight = context.bodyHeight - introHeight - footerHeight;
  const body = node(context.body, 'MobileSheetEntryBody', 0, (footerHeight - introHeight) / 2, context.width, bodyHeight);
  const list = { ...context, body, bodyHeight };
  const copyWidth = context.width - 34 * u;
  const rows = services.map(service => {
    const summary = wrap(service.summary, 12, copyWidth);
    const height = (38 + summary.length * 18) * u;
    const expanded = context.state.entryServiceId === service.id;
    const description = expanded && service.description ? wrap(service.description, 11, copyWidth) : [];
    const options = expanded ? service.options.map(option => {
      const name = wrap(option.name, 13, copyWidth - 36 * u);
      const reason = option.action.disabledReason;
      const description = wrap([option.description, reason && !option.description.includes(reason) ? reason : undefined]
        .filter(Boolean).join('\n'), 11, copyWidth);
      return { option, name, description, height: (20 + name.length * 20 + description.length * 17) * u };
    }) : [];
    return { service, summary, height, expanded, description, options,
      totalHeight: height + (description.length ? description.length * 17 + 12 : 0) * u
        + options.reduce((sum, option) => sum + option.height, 0) };
  });
  const contentHeight = rows.reduce((sum, row) => sum + row.totalHeight, 0);
  const region = scrollRegion(list, contentHeight);
  region.holder.name = 'MobileSheetEntryScroll';
  catalogScrollByFrame.set(context.panel, region.scrollView);
  region.scrollView.scrollToOffset(new Vec2(0, Math.min(Math.max(0, context.state.catalogScrollOffset ?? 0),
    Math.max(0, region.contentHeight - region.height))), 0);
  const content = scrollContentNode(region);
  let cursor = 0;
  let collapsedCursor = 0;
  for (const { service, summary, height, expanded, description, options } of rows) {
    const rowStart = collapsedCursor;
    collapsedCursor += height;
    const row = node(content, `MobileSheetEntryService:${service.id}`, 0, scrollItemY(region, cursor, height), context.width, height);
    catalogRule(row, 'EntryServiceRule', height / 2, context.width - 4 * u);
    catalogText(context, row, 'EntryServiceName', service.name, -13 * u, height / 2 - 16 * u, copyWidth, 22 * u, 14, palette().accent);
    catalogText(context, row, 'EntryServiceSummary', summary.join('\n'), -13 * u,
      height / 2 - (31 + summary.length * 9) * u, copyWidth, summary.length * 18 * u, 12);
    catalogText(context, row, 'EntryServiceExpand', expanded ? '−' : '+', context.width / 2 - 12 * u,
      0, 20 * u, 24 * u, 16, palette().textMuted, true);
    context.options.bindLocal(row, () => context.options.setState({ ...context.state,
      entryServiceId: expanded ? undefined : service.id,
      // Bring the chosen service to the top instead of leaving its options below the fold.
      catalogScrollOffset: expanded ? Math.min(rowStart, region.scrollView.getScrollOffset().y) : rowStart,
    }));
    cursor += height;
    if (description.length) {
      const descriptionHeight = (description.length * 17 + 12) * u;
      catalogText(context, content, `EntryServiceDescription:${service.id}`, description.join('\n'), -13 * u,
        scrollItemY(region, cursor, descriptionHeight), copyWidth, description.length * 17 * u, 11, palette().textMuted);
      cursor += descriptionHeight;
    }
    for (const { option, name, description, height } of options) {
      const optionRow = node(content, `MobileSheetEntryOption:${option.action.actionId}`, 0,
        scrollItemY(region, cursor, height), context.width, height);
      catalogRule(optionRow, 'EntryOptionRule', -height / 2, context.width - 16 * u);
      catalogText(context, optionRow, 'EntryOptionName', name.join('\n'), -18 * u,
        height / 2 - (10 + name.length * 10) * u, copyWidth - 36 * u, name.length * 20 * u, 13,
        option.selected ? palette().positive : palette().text);
      catalogText(context, optionRow, 'EntryOptionState', option.selected ? '已选' : option.action.enabled ? '选择' : '不可选',
        context.width / 2 - 28 * u, height / 2 - 20 * u, 44 * u, 20 * u, 10,
        option.selected ? palette().positive : palette().textMuted, true);
      catalogText(context, optionRow, 'EntryOptionDescription', description.join('\n'), 0,
        height / 2 - (10 + name.length * 20 + description.length * 8.5) * u,
        copyWidth, description.length * 17 * u, 11, palette().textMuted);
      if (canExecute(context, option.action)) context.options.bindAction(optionRow, option.action);
      cursor += height;
    }
  }
  const footer = node(context.body, 'MobileSheetEntryFooter', 0,
    -context.bodyHeight / 2 + footerHeight / 2, context.width, footerHeight);
  catalogRule(footer, 'EntryFooterRule', footerHeight / 2, context.width);
  if (noticeLines.length) catalogText(context, footer, 'EntryConfirmNotice', noticeLines.join('\n'), 0,
    footerHeight / 2 - (6 + noticeLines.length * 8.5) * u, context.width - 8 * u,
    noticeLines.length * 17 * u, 11, palette().textMuted);
  if (action) {
    const label = detail.activePanel === 'entry' ? '确认入场' : '选择入场配置';
    const width = catalogButtonWidth(context, label);
    const confirm = catalogButton(context, footer, 'MobileSheetEntryConfirm', label,
      context.width / 2 - width / 2, -footerHeight / 2 + 28 * u, width, enabled, undefined, true);
    if (enabled) context.options.bindAction(confirm, action);
    const summaryWidth = context.width - width - 12 * u;
    const destination = wrap(detail.selectedDungeonName, 12, summaryWidth).slice(0, 2);
    catalogText(context, footer, 'EntryDestination', destination.join('\n'), -context.width / 2 + summaryWidth / 2,
      -footerHeight / 2 + 28 * u, summaryWidth, 40 * u, 12, palette().textMuted);
  }
}

function catalogActionButton(context: SheetContext, parent: Node, action: ViewActionModel, row: HubShopRowViewModel | undefined,
  x: number, y: number, width: number, update: (patch: Partial<MobileSheetState>) => void, confirmed = false): void {
  const enabled = canExecute(context, action);
  const danger = action.emphasis === 'danger' || action.recommendation === 'high-risk';
  const label = `${confirmed ? '确认' : ''}${catalogActionLabel(action, row)}`;
  const control = catalogButton(context, parent, `MobileSheetShopAction:${action.actionId}`, label, x, y, width,
    enabled, catalogPrice(action), action.emphasis === 'primary' || action.recommendation === 'recommended', danger);
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
  const width = Math.min(context.width, 480 * u);
  const innerWidth = width - 28 * u;
  const sections = row ? [{ label: '', value: row.description }, ...row.details]
    : actions.map(action => ({ label: catalogActionLabel(action), value: action.readout ?? action.disabledReason ?? action.label }));
  if (confirm && selected) sections.push({
    label: `确认${catalogActionLabel(selected, row)}`,
    value: [selected.readout, selected.disabledReason, selected.riskReason,
      context.options.chrome.busyActionId === undefined ? undefined : '当前行动正在处理，请稍候。',
      context.options.chrome.blockingMessage].filter(Boolean).join('\n'),
  });
  const facts = sections.map(section => {
    const lines = section.value.split('\n').flatMap(line => wrapInfiniteFlowLine(readable(line), Math.max(8, Math.floor(innerWidth / (12 * u)))));
    return { ...section, lines, height: (18 + (section.label ? 18 : 0) + lines.length * 18) * u };
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
  const notice = selected && !confirm ? [selected.disabledReason, context.options.chrome.blockingMessage,
    context.options.chrome.busyActionId === undefined ? undefined : '当前行动正在处理，请稍候。'].filter(Boolean).join('\n') : '';
  const noticeLines = notice.split('\n').filter(Boolean).flatMap(line => wrapInfiniteFlowLine(readable(line), Math.max(8, Math.floor(innerWidth / (11 * u)))));
  const noticeHeight = noticeLines.length ? (noticeLines.length * 17 + 8) * u : 0;
  const footerHeight = controls.length ? packed.height + 20 * u + noticeHeight : 0;
  const headerHeight = (row?.rarity ? 92 : 78) * u;
  const contentHeight = facts.reduce((sum, fact) => sum + fact.height, 12 * u);
  const height = Math.min(context.height - 24 * u, contentHeight + headerHeight + footerHeight + 8 * u);
  const shade = panel(context.panel, 'MobileSheetCatalogBackdrop', 0, 0, context.width + 40, context.height,
    withAlpha(palette().surface, 225), palette().edge);
  shade.addComponent(BlockInputEvents);
  context.options.bindLocal(shade, clear);
  const card = catalogPanel(context, shade, 'MobileSheetCatalogDetail', 0, 0, width, height, palette().surface, palette().accent);
  card.addComponent(BlockInputEvents);
  if (row) {
    const image = catalogPanel(context, card, 'CatalogDetailIconFrame', -width / 2 + 40 * u,
      height / 2 - 40 * u, 52 * u, 52 * u, palette().quiet, catalogRarityEdge(row), 2);
    figureNode(context, image, 'CatalogDetailIcon', row.visualAssetKey ?? '', 0, 0, 46 * u, 46 * u,
      { iconKind: 'inventory', glyphColor: palette().accent }, context.images);
  }
  const titleLeft = -width / 2 + (row ? 78 : 14) * u;
  const titleWidth = width - (row ? 138 : 74) * u;
  catalogText(context, card, 'CatalogDetailTitle', row?.name ?? catalog.serviceTitle ?? '可选服务',
    titleLeft + titleWidth / 2, height / 2 - 26 * u, titleWidth, 24 * u, 16, palette().accent);
  catalogText(context, card, 'CatalogDetailStatus', row ? `${row.category} · ${row.status}` : catalog.npcName,
    titleLeft + titleWidth / 2, height / 2 - 48 * u, titleWidth, 18 * u, 11, palette().textMuted);
  if (row?.rarity) catalogText(context, card, 'CatalogDetailRarity', QUALITY_LABEL[row.rarity],
    titleLeft + titleWidth / 2, height / 2 - 67 * u, titleWidth, 18 * u, 11, qualityNameColor(row.rarity, palette().text));
  const close = catalogButton(context, card, 'MobileSheetCatalogDetailClose', '×', width / 2 - 32 * u, height / 2 - 36 * u, 44 * u, true);
  context.options.bindLocal(close, clear);
  catalogRule(card, 'CatalogHeaderRule', height / 2 - headerHeight, width - 2 * u);
  const bodyHeight = height - headerHeight - footerHeight;
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
    catalogText(context, item, 'FactValue', fact.lines.join('\n'), 0,
      fact.height / 2 - (9 + (fact.label ? 18 : 0) + fact.lines.length * 9) * u,
      innerWidth, fact.lines.length * 18 * u, 12, fact.label ? palette().text : palette().positive);
    catalogRule(item, 'FactRule', -fact.height / 2, innerWidth);
    cursor += fact.height;
  });
  if (footerHeight > 0) {
    const footer = node(card, 'MobileSheetCatalogFooter', 0, -height / 2 + footerHeight / 2, innerWidth, footerHeight);
    catalogRule(footer, 'CatalogFooterRule', footerHeight / 2, width - 2 * u);
    if (noticeLines.length) catalogText(context, footer, 'CatalogActionNotice', noticeLines.join('\n'), 0,
      footerHeight / 2 - (8 + noticeLines.length * 8.5) * u, innerWidth, noticeLines.length * 17 * u, 11, palette().textMuted);
    for (const control of packed.positions) {
      const x = -innerWidth / 2 + control.x + control.width / 2;
      const y = footerHeight / 2 - noticeHeight - 10 * u - control.line * 50 * u - 22 * u;
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
    const menuWidth = Math.min(innerWidth, 330 * u);
    const menuHeight = Math.min(bodyHeight - 8 * u, (extra.length * 50 + 10) * u);
    const menu = catalogPanel(context, card, 'MobileSheetCatalogActionMenu',
      width / 2 - 14 * u - menuWidth / 2, -height / 2 + footerHeight + 6 * u + menuHeight / 2,
      menuWidth, menuHeight, palette().surface, palette().edgeStrong);
    menu.addComponent(BlockInputEvents);
    const menuContext = { ...context, panel: card, body: menu, width: menuWidth - 10 * u, bodyHeight: menuHeight - 10 * u };
    const menuRegion = scrollRegion(menuContext, extra.length * 50 * u);
    const menuContent = scrollContentNode(menuRegion);
    extra.forEach((action, index) => catalogActionButton(context, menuContent, action, row, 0,
      scrollItemY(menuRegion, index * 50 * u, 44 * u), menuContext.width, update));
  }
}

type CatalogControl = Readonly<{ action?: ViewActionModel; label: string; width: number }>;

/** Flex-like packing keeps short actions together and wraps only when necessary. */
function catalogControlPositions(controls: readonly CatalogControl[], available: number, u: number, alignEnd = false) {
  let x = 0, line = 0;
  const positions = controls.map(control => {
    const width = Math.min(available, control.width);
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

/** NPC storefront: icon-only goods, with a separate readable task list. */
function renderNpcGridCatalog(context: SheetContext, catalog: HubCatalogSurface): void {
  const u = catalogUnit(context);
  const detail = context.model.sections[1].detail;
  const tasks = detail.kind === 'hub' && detail.activePanel === 'tasks';
  const introHeight = 86 * u;
  const footerHeight = catalog.services.length ? 58 * u : 0;
  const introWidth = context.width - 60 * u;
  figureNode(context, context.body, 'MobileSheetNpcPortrait', catalog.portraitAssetKey ?? '',
    -context.width / 2 + 22 * u, context.bodyHeight / 2 - 28 * u, 40 * u, 48 * u,
    { glyph: catalog.npcName.slice(0, 1), glyphSize: 21 * u, glyphColor: palette().accent }, context.images);
  catalogText(context, context.body, 'MobileSheetNpcName', catalog.npcName, 30 * u,
    context.bodyHeight / 2 - 14 * u, introWidth, 24 * u, 16, palette().accent);
  const greeting = wrapInfiniteFlowLine(catalog.greeting, Math.floor(introWidth / (11 * u))).slice(0, 2).join('\n');
  catalogText(context, context.body, 'MobileSheetNpcGreeting', greeting, 30 * u,
    context.bodyHeight / 2 - 42 * u, introWidth, 36 * u, 11, palette().textMuted);
  catalogText(context, context.body, 'MobileSheetCatalogCount', `共 ${catalog.rows.length} 项`,
    -context.width / 2 + 40 * u, context.bodyHeight / 2 - 72 * u, 80 * u, 18 * u, 10, palette().textMuted);
  catalogText(context, context.body, 'MobileSheetCatalogHint', tasks ? '点击任务查看详情' : '点击图标查看详情',
    context.width / 2 - 60 * u, context.bodyHeight / 2 - 72 * u, 120 * u, 18 * u, 10, palette().textMuted);
  const bodyHeight = context.bodyHeight - introHeight - footerHeight;
  const body = node(context.body, 'MobileSheetCatalogBody', 0, (footerHeight - introHeight) / 2, context.width, bodyHeight);
  const list = { ...context, body, bodyHeight };
  const gap = 7 * u;
  const gridWidth = context.width - 8 * u;
  const columns = Math.max(1, Math.floor((gridWidth + gap) / (58 * u + gap)));
  const tileSize = (gridWidth - gap * (columns - 1)) / columns;
  const taskRows = tasks ? catalog.rows.map(row => {
    const controls = catalogControlPositions(row.actions.map(action => ({ action,
      label: catalogActionLabel(action, row), width: catalogButtonWidth(context, catalogActionLabel(action, row), catalogPrice(action)) })), 84 * u, u, true);
    const copyWidth = context.width - (controls.positions.length ? 96 : 8) * u;
    const description = wrapInfiniteFlowLine(readable(row.description), Math.max(8, Math.floor(copyWidth / (12 * u)))).slice(0, 2);
    const progress = row.details.find(fact => fact.label === '当前进度')?.value ?? '';
    const progressLines = wrapInfiniteFlowLine(`${row.status}  ${progress}`, Math.max(8, Math.floor(copyWidth / (11 * u))));
    const height = Math.max(controls.height + 24 * u, (72 + description.length * 18 + progressLines.length * 17) * u);
    return { row, controls, copyWidth, description, progressLines, height };
  }) : [];
  const contentHeight = tasks ? taskRows.reduce((sum, item) => sum + item.height, 0)
    : Math.ceil(catalog.rows.length / columns) * (tileSize + gap) + 4 * u;
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
  if (tasks) {
    let cursor = 0;
    for (const { row, controls, copyWidth, description, progressLines, height } of taskRows) {
      const item = node(content, `MobileSheetShopRow:${row.id}`, 0, scrollItemY(region, cursor, height), context.width, height);
      catalogRule(item, 'ShopRowRule', height / 2, context.width - 4 * u);
      const info = node(item, `MobileSheetShopInfo:${row.id}`, -context.width / 2 + copyWidth / 2, 0, copyWidth, height);
      catalogText(context, info, 'ShopRowName', row.name, 0, height / 2 - 21 * u, copyWidth, 24 * u, 14);
      catalogText(context, info, 'ShopRowCategory', row.category, 0, height / 2 - 42 * u, copyWidth, 16 * u, 10, palette().textMuted);
      catalogText(context, info, 'ShopRowDescription', description.join('\n'), 0,
        height / 2 - (54 + description.length * 9) * u, copyWidth, description.length * 18 * u, 12, palette().textMuted);
      catalogText(context, info, 'ShopRowStatus', progressLines.join('\n'), 0,
        -height / 2 + (12 + progressLines.length * 8.5) * u, copyWidth, progressLines.length * 17 * u, 11,
        row.status === '可领取' ? palette().positive : palette().textMuted);
      context.options.bindLocal(info, () => open(row));
      for (const control of controls.positions) catalogActionButton(context, item, control.action!, row,
        context.width / 2 - 84 * u + control.x + control.width / 2,
        controls.height / 2 - control.line * 50 * u - 22 * u, control.width, update);
      cursor += height;
    }
  } else catalog.rows.forEach((row, index) => {
    const tile = catalogPanel(context, content, `MobileSheetShopTile:${row.id}`,
      -context.width / 2 + 2 * u + (index % columns) * (tileSize + gap) + tileSize / 2,
      scrollItemY(region, 2 * u + Math.floor(index / columns) * (tileSize + gap), tileSize),
      tileSize, tileSize, palette().quiet, catalogRarityEdge(row));
    const border = tile.getComponent(Graphics)!;
    border.strokeColor = catalogRarityEdge(row); border.lineWidth = 2 * u;
    border.roundRect(-tileSize / 2 + u, -tileSize / 2 + u, tileSize - 2 * u, tileSize - 2 * u, 3 * u); border.stroke();
    const selected = (context.state.catalogRowId ?? context.state.catalogSelectedRowId) === row.id;
    if (selected) {
      border.roundRect(-tileSize / 2 + 4 * u, -tileSize / 2 + 4 * u, tileSize - 8 * u, tileSize - 8 * u, 2 * u); border.stroke();
      border.fillColor = palette().text;
      const x = tileSize / 2 - 7 * u, y = -tileSize / 2 + 7 * u;
      border.moveTo(x, y + 3 * u); border.lineTo(x + 3 * u, y); border.lineTo(x, y - 3 * u); border.lineTo(x - 3 * u, y); border.close(); border.fill();
    }
    figureNode(context, tile, `ShopIcon:${row.id}`, row.visualAssetKey ?? '', 0, 0, tileSize - 14 * u, tileSize - 14 * u,
      { iconKind: 'inventory', glyphColor: palette().accent }, context.images);
    context.options.bindLocal(tile, () => open(row));
  });
  if (footerHeight) {
    catalogRule(context.body, 'CatalogFooterRule', -context.bodyHeight / 2 + footerHeight, context.width);
    const label = `${catalog.serviceTitle ?? '其他服务'} ↗`;
    const width = Math.min(context.width, catalogButtonWidth(context, label));
    const control = catalogButton(context, context.body, 'MobileSheetShopServices', label,
      context.width / 2 - width / 2, -context.bodyHeight / 2 + 28 * u, width, true);
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
  if (context.state.kind === 'npc') { renderNpcGridCatalog(context, catalog); return; }
  const introHeight = 96 * u;
  const footerHeight = catalog.services.length > 0 ? 56 * u : 0;
  const portraitX = -context.width / 2 + 24 * u;
  figureNode(context, context.body, 'MobileSheetNpcPortrait', catalog.portraitAssetKey ?? '', portraitX, context.bodyHeight / 2 - 30 * u, 40 * u, 48 * u,
    { glyph: catalog.npcName.slice(0, 1), glyphSize: 21 * u, glyphColor: palette().accent }, context.images);
  const introWidth = context.width - 62 * u;
  catalogText(context, context.body, 'MobileSheetNpcName', catalog.npcName, 29 * u, context.bodyHeight / 2 - 15 * u, introWidth, 24 * u, 16, palette().accent);
  const greeting = wrapInfiniteFlowLine(catalog.greeting, Math.floor(introWidth / (11 * u))).slice(0, 2).join('\n');
  catalogText(context, context.body, 'MobileSheetNpcGreeting', greeting, 29 * u, context.bodyHeight / 2 - 45 * u, introWidth, 36 * u, 11, palette().textMuted);
  catalogText(context, context.body, 'MobileSheetCatalogCount', `共 ${catalog.rows.length} 项`, -context.width / 2 + 40 * u, context.bodyHeight / 2 - 81 * u, 80 * u, 18 * u, 10, palette().textMuted);
  catalogText(context, context.body, 'MobileSheetCatalogHint', '点图标或名称查看详情', context.width / 2 - 70 * u, context.bodyHeight / 2 - 81 * u, 140 * u, 18 * u, 10, palette().textMuted);
  const bodyHeight = context.bodyHeight - introHeight - footerHeight;
  const body = node(context.body, 'MobileSheetCatalogBody', 0, (footerHeight - introHeight) / 2, context.width, bodyHeight);
  const list: SheetContext = { ...context, body, bodyHeight };
  const textLeft = -context.width / 2 + 64 * u;
  const inlineActions = context.width / u > 510;
  const copyWidth = context.width - (inlineActions ? 315 : 72) * u;
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
    const actions = catalogControlPositions(controls, actionWidth, u, inlineActions);
    const extras = catalogControlPositions(expanded ? extra.map(control) : [], context.width - 24 * u, u);
    const description = wrapInfiniteFlowLine(readable(row.description), Math.max(8, Math.floor(copyWidth / (12 * u))));
    const descriptionLines = description.slice(0, 2);
    if (description.length > 2) descriptionLines[1] += '…';
    const infoHeight = (48 + descriptionLines.length * 19) * u;
    const extraHeight = expanded && extra.length ? extras.height + 46 * u : 0;
    const mainHeight = inlineActions ? Math.max(infoHeight, actions.height) : infoHeight + actions.height;
    return { row, expanded, actions, extras, descriptionLines, infoHeight, height: mainHeight + 28 * u + extraHeight };
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
    const info = node(item, `MobileSheetShopInfo:${row.id}`, 0, height / 2 - 10 * u - infoHeight / 2, region.width, infoHeight);
    const figure = catalogPanel(context, info, 'ShopIconFrame', -region.width / 2 + 26 * u, 0, 52 * u, 52 * u, palette().quiet, palette().edgeStrong);
    figureNode(context, figure, `ShopIcon:${row.id}`, row.visualAssetKey ?? '', 0, 0, 46 * u, 46 * u,
      { glyph: row.name.slice(0, 1), glyphSize: 24 * u, glyphColor: palette().accent }, context.images);
    const titleWidth = Math.min(copyWidth, catalogTextWidth(row.name, 15) * u + 4 * u);
    catalogText(context, info, 'ShopRowName', row.name, textLeft + titleWidth / 2, infoHeight / 2 - 12 * u, titleWidth, 24 * u, 15);
    info.getChildByName('ShopRowName')!.getComponent(Label)!.isBold = true;
    const categoryWidth = copyWidth - titleWidth - 6 * u;
    if (categoryWidth > 24 * u) catalogText(context, info, 'ShopRowCategory', row.category, textLeft + titleWidth + 6 * u + categoryWidth / 2,
      infoHeight / 2 - 13 * u, categoryWidth, 20 * u, 11, palette().textMuted);
    catalogText(context, info, 'ShopRowStatus', row.status, textLeft + copyWidth / 2, infoHeight / 2 - 36 * u, copyWidth, 20 * u, 12, palette().positive);
    catalogText(context, info, 'ShopRowDescription', descriptionLines.join('\n'), textLeft + copyWidth / 2,
      infoHeight / 2 - (48 + descriptionLines.length * 9.5) * u, copyWidth, descriptionLines.length * 19 * u, 12, palette().textMuted);
    context.options.bindLocal(info, () => update({ catalogRowId: row.id, selectedActionId: undefined, catalogServiceOpen: undefined }));
    for (const control of actions.positions) {
      const x = (inlineActions ? context.width / 2 - actionWidth - 12 * u : textLeft) + control.x + control.width / 2;
      const top = inlineActions ? 10 * u + (Math.max(infoHeight, actions.height) - actions.height) / 2 : infoHeight + 18 * u;
      const y = height / 2 - top - control.line * 50 * u - 22 * u;
      if (control.action) catalogActionButton(context, item, control.action, row, x, y, control.width, update);
      else {
        const more = catalogButton(context, item, `MobileSheetShopMore:${row.id}`, control.label, x, y, control.width, true);
        context.options.bindLocal(more, () => update({ catalogExpandedIds: expanded ? expandedIds.filter(id => id !== row.id) : [...expandedIds, row.id] }));
      }
    }
    if (extras.positions.length) {
      const extraHeight = extras.height + 36 * u;
      const extra = panel(item, 'CatalogExtraActions', 0, -height / 2 + extraHeight / 2 + 8 * u, context.width, extraHeight, palette().quiet, palette().edge, false, 'card');
      catalogText(context, extra, 'ExtraLabel', `${row.name} · 强化与委托`, 0, extraHeight / 2 - 14 * u, context.width - 24 * u, 20 * u, 11, palette().textMuted);
      for (const control of extras.positions) catalogActionButton(context, extra, control.action!, row,
        -context.width / 2 + 12 * u + control.x + control.width / 2, extraHeight / 2 - 32 * u - control.line * 50 * u - 22 * u, control.width, update);
    }
    cursor += height;
  }
  if (!rows.length) catalogText(context, content, 'MobileSheetCatalogEmpty', '购入装备或解锁能力后，可以在这里配置。', 0, region.contentHeight / 2 - 48 * u, context.width - 24 * u, 72 * u, 13, palette().textMuted, true);
  if (footerHeight > 0) {
    catalogRule(context.body, 'CatalogFooterRule', -context.bodyHeight / 2 + footerHeight, context.width);
    const label = `${catalog.serviceTitle ?? '其他服务'} ↗`;
    const width = Math.min(context.width, catalogButtonWidth(context, label));
    const control = catalogButton(context, context.body, 'MobileSheetShopServices', label,
      context.width / 2 - width / 2, -context.bodyHeight / 2 + 28 * u, width, true);
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
  else if (state.kind === 'result') renderTabbedActions(context, detail.kind === 'result' ? buildInfiniteFlowResultPages(detail) : [], ['结算明细', '归档与回城']);
  else if (state.kind === 'interaction') {
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
  if (image) sprite.spriteFrame = image.frame as SpriteFrame;
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
  frameGeometry: (input: SheetLayoutFrameInput) => productionFrameGeometry(input.safeInsets, input.surfaceHeight, input.kind),
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
  const previousTheme = activeTheme;
  activeTheme = options.theme ?? DEFAULT_SHEET_THEME;
  try {
    renderInfiniteFlowInfoSheetBody(root, model, state, options);
  } finally {
    activeTheme = previousTheme;
  }
}

function renderInfiniteFlowInfoSheetBody(root: Node, model: GameViewModel, state: MobileSheetState, options: InfiniteFlowInfoSheetOptions): void {
  const surfaceHeight = Math.max(1334, options.surfaceHeight);
  const backdrop = buildBackdrop(root, surfaceHeight);
  const activeLayout = options.layout && options.layout.id !== BASELINE_LAYOUT_ID ? options.layout : undefined;
  const geometry = activeLayout
    ? activeLayout.frameGeometry({ safeInsets: options.safeInsets, surfaceHeight, kind: state.kind })
    : productionFrameGeometry(options.safeInsets, surfaceHeight, state.kind);
  const chrome = activeLayout
    ? activeLayout.renderChrome({ root: backdrop, model, state, options, surfaceHeight, geometry })
    : productionRenderChrome({ root: backdrop, model, state, options, surfaceHeight, geometry });
  // Gallery tiers pass images explicitly (EMPTY/FAKE); production reads the
  // module-level registry populated by the app's best-effort preload.
  const images = options.images ?? getSheetFigures();
  const context: SheetContext = { model, state, options, panel: chrome.frame, body: chrome.body, width: chrome.width, height: geometry.height, bodyHeight: chrome.bodyHeight, images };
  if (!activeLayout) {
    renderSheetKind(context);
    const scroll = catalogScrollByFrame.get(context.panel);
    if (scroll) sheetScrollCaptures.set(root, { state, scroll, detailScroll: catalogDetailScrollByFrame.get(context.panel) });
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
