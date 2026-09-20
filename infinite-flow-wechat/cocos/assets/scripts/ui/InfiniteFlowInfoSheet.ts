import { BlockInputEvents, Color, Graphics, Label, Mask, Node, ScrollView, Size, Sprite, SpriteFrame, UITransform, Vec3 } from 'cc';
import { EQUIPMENT, ITEMS, getGameAsset } from '@infinite-flow/core';
import type { GameViewModel, HelpEntryViewModel, HubPanel, MapNodeViewModel, StatusMetric, ViewActionModel } from '@infinite-flow/presentation';
import {
  buildInfiniteFlowChapterCodexPages,
  buildInfiniteFlowResultPages,
  formatInfiniteFlowCombatChapterContext,
  formatInfiniteFlowEntryBuildDetail,
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
  supplyActions?: () => readonly ViewActionModel[];
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
  character: '角色状态', inventory: '行囊与装备', map: '区域地图', objectives: '任务与章规',
  log: '冒险记录', menu: '随身菜单', interaction: '当前交互', entry: '轮回之门',
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
function icon(parent: Node, name: string, kind: string, x: number, y: number, color = palette().accent): Node {
  const holder = node(parent, name, x, y, 64, 64);
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
  for (let index = 0; index < choices.length; index += 1) {
    const choice = choices[index]!;
    const tabRole: SheetFrameRole = choice.id === active ? 'tabActive' : 'tabIdle';
    const child = panel(context.body, `MobileSheetTab:${choice.id}`, -context.width / 2 + width / 2 + index * (width + GAP), context.bodyHeight / 2 - TOUCH / 2, width, TOUCH, choice.id === active ? palette().accentDark : palette().quiet, choice.id === active ? palette().accent : palette().edge, false, tabRole);
    text(child, 'Label', choice.title, 0, 0, width - 16, 76, 28, choice.id === active ? palette().accent : palette().text, true);
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
    ? actions.filter((action) => hubPanelAction(action, 'entry'))
    : actions.filter((action) => action.placement === 'preparation' && action.event?.kind === 'local' && action.event.action.type === 'hub/select-panel' && action.event.action.panel === 'entry');
  if (kind === 'npc') return detail.activePanel === 'entry' ? [] : actions.filter((action) => hubPanelAction(action, detail.activePanel));
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

function renderActions(context: SheetContext, actions: readonly ViewActionModel[], empty = '当前没有可执行选项。'): void {
  const selected = actions.find((action) => action.actionId === context.state.selectedActionId);
  if (selected !== undefined) { renderActionDetail(context, selected); return; }
  if (actions.length === 0) { renderTextPages(context, [{ title: '当前状态', lines: [empty] }]); return; }
  const contentHeight = 8 + actions.length * ACTION_CARD_HEIGHT + (actions.length - 1) * GAP + 8;
  const region = scrollRegion(context, contentHeight);
  const content = scrollContentNode(region);
  actions.forEach((action, index) => {
    const enabled = canExecute(context, action);
    const accent = !action.enabled ? palette().textMuted : action.riskReason || action.emphasis === 'danger' ? palette().danger : palette().accent;
    const cursor = 8 + index * (ACTION_CARD_HEIGHT + GAP);
    const card = panel(content, `MobileSheetAction:${action.actionId}`, 0, scrollItemY(region, cursor, ACTION_CARD_HEIGHT), region.width, ACTION_CARD_HEIGHT, palette().quiet, accent === palette().danger ? palette().dangerDark : palette().edge);
    icon(card, 'ActionIcon', action.riskReason ? 'danger' : context.state.kind, -context.width / 2 + 43, ACTION_CARD_HEIGHT / 2 - 47, accent);
    text(card, 'ActionTitle', actionLabel(context.model, action), 33, ACTION_CARD_HEIGHT / 2 - 42, context.width - 112, 66, 28, action.enabled ? palette().text : palette().textMuted);
    const units = Math.max(8, Math.floor((context.width - 34) / 24));
    const preview = wrapInfiniteFlowLine(actionSummary(context.model, action), units);
    text(card, 'ActionReadoutPreview', `${preview.slice(0, 2).join('\n')}${preview.length > 2 ? '…' : ''}`, 0, -8, context.width - 34, 68, 24, palette().textMuted);
    text(card, 'ActionAffordance', directNavigation(action) && enabled ? '点击切换' : action.enabled ? '查看详情  ›' : '查看不可用原因  ›', 0, -ACTION_CARD_HEIGHT / 2 + 21, context.width - 34, 34, 22, accent);
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
const DOLL_ROW_Y = [196, 68, -60, -188] as const;
const DOLL_SLOT_X = 267;
const DOLL_STAGE_HEIGHT = 504;
const DOLL_KPI_HEIGHT = 104;

function metricAccent(metric: StatusMetric | undefined): Color {
  if (metric?.severity === 'danger') return palette().danger;
  if (metric?.severity === 'warning') return palette().accent;
  if (metric?.severity === 'positive') return palette().positive;
  return palette().text;
}

function renderCharacter(context: SheetContext): void {
  const loadout = context.model.sections[1].loadout;
  const metrics = context.model.sections[1].metrics;
  if (!loadout) {
    renderMetricGrid(context, metrics, context.bodyHeight / 2, context.bodyHeight, 4);
    return;
  }
  const stage = panel(context.body, 'MobileSheetDollStage', 0, context.bodyHeight / 2 - DOLL_STAGE_HEIGHT / 2, context.width, DOLL_STAGE_HEIGHT, palette().quiet, palette().edgeStrong);
  // Centered reincarnator portrait (WoW CharacterPaperdoll), glyph-fallback twin.
  figureNode(context, stage, 'DollPortrait', SHEET_PORTRAIT_KEY, 0, 0, 280, 440,
    { iconKind: 'character', glyphColor: palette().accent }, context.images);
  for (const entry of loadout.equipment) {
    const layout = DOLL_SLOT_LAYOUT.find((candidate) => candidate.slot === entry.slot);
    if (!layout) continue;
    const x = layout.side * DOLL_SLOT_X;
    const y = DOLL_ROW_Y[layout.row]!;
    const slot = panel(stage, `MobileSheetEquip:${entry.slot}`, x, y, TOUCH, TOUCH, palette().raised, palette().edgeStrong, false, 'cell');
    figureNode(context, slot, `EquipIcon:${entry.slot}`, sheetEquipmentKey(entry.equipmentId), 0, 8, 76, 76,
      { glyph: entry.name.charAt(entry.name.length - 1), glyphSize: 30, glyphColor: palette().textMuted }, context.images);
    text(slot, 'SlotLabel', entry.slotLabel, -20, -39, 58, 24, 18, palette().textMuted, true);
    text(slot, 'SlotLevel', `Lv${entry.level}`, 27, -39, 44, 24, 18, palette().accent, true);
    // Equipment tips are always read-only; opening works in every phase.
    context.options.bindLocal(slot, () => context.options.setState({ ...context.state, tip: { kind: 'equip', id: entry.equipmentId } }));
  }

  const hpMetric = metrics.find((metric) => metric.id === 'hp' || metric.id === 'player-hp');
  const attackMetric = metrics.find((metric) => metric.id === 'attack');
  const kpiWidth = (context.width - GAP * 3) / 4;
  const kpiY = context.bodyHeight / 2 - DOLL_STAGE_HEIGHT - GAP - DOLL_KPI_HEIGHT / 2;
  const kpis: readonly Readonly<{ name: string; label: string; value: string; metric?: StatusMetric; accent: Color }>[] = [
    { name: 'MobileSheetKpi:power', label: '战力', value: String(loadout.power), accent: palette().danger },
    { name: 'MobileSheetMetric:hp', label: '生命', value: `${loadout.hp}/${loadout.maxHp}`, metric: hpMetric, accent: metricAccent(hpMetric) },
    { name: 'MobileSheetKpi:attack', label: '攻击/术强', value: `${loadout.attack}/${loadout.artPower}`, metric: attackMetric, accent: metricAccent(attackMetric) },
    { name: 'MobileSheetKpi:defense', label: '防御', value: String(loadout.defense), accent: palette().text },
  ];
  kpis.forEach((kpi, index) => {
    const x = -context.width / 2 + kpiWidth / 2 + index * (kpiWidth + GAP);
    const card = panel(context.body, kpi.name, x, kpiY, kpiWidth, DOLL_KPI_HEIGHT, palette().quiet, kpi.accent === palette().danger ? palette().dangerDark : palette().edge);
    text(card, 'KpiLabel', kpi.label, 0, 26, kpiWidth - 12, 30, 21, palette().textMuted, true);
    text(card, 'KpiValue', kpi.value, 0, -16, kpiWidth - 12, 44, 28, kpi.accent, true);
    if (kpi.metric) context.options.bindLocal(card, () => context.options.setState({ ...context.state, tab: 'metric', selectedActionId: kpi.metric!.id, page: 0 }));
  });

  // Phase-specific run metrics remain below the doll; hp/power already head the KPI row.
  const hidden = context.model.phase === 'hub'
    ? new Set(['hp', 'power'])
    : context.model.phase === 'combat'
      ? new Set(['player-hp', 'attack'])
      : new Set(['hp']);
  const rest = metrics.filter((metric) => !hidden.has(metric.id));
  const regionTop = context.bodyHeight / 2 - DOLL_STAGE_HEIGHT - GAP - DOLL_KPI_HEIGHT - GAP;
  const regionHeight = Math.max(120, regionTop + context.bodyHeight / 2 - 24);
  renderMetricGrid(context, rest, regionTop, regionHeight, 2);
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
    button(context.body, 'MobileSheetMapBack', '返回地图', 0, -context.bodyHeight / 2 + TOUCH / 2, context.width, true, () => context.options.setState({ kind: 'map', page: 0 }), context.options);
    return;
  }
  const columns = 4;
  const rows = Math.max(1, Math.min(3, Math.floor((context.bodyHeight - 188) / 136)));
  const windowsAcross = Math.max(1, Math.ceil(map.width / columns));
  const windowsDown = Math.max(1, Math.ceil(map.height / rows));
  const page = pager(context, windowsAcross * windowsDown);
  const originX = (page % windowsAcross) * columns;
  const originY = Math.floor(page / windowsAcross) * rows;
  text(context.body, 'MobileSheetMapTitle', readable(map.dungeonName), 0, context.bodyHeight / 2 - 27, context.width, 50, 29, palette().accent, true);
  text(context.body, 'MobileSheetMapHint', '点亮区域可查看 · 走近通道移动', 0, context.bodyHeight / 2 - 77, context.width, 54, 24, palette().textMuted, true);
  const cellWidth = (context.width - GAP * 3) / 4;
  const cellHeight = 120;
  for (const cell of map.nodes) {
    if (cell.x < originX || cell.x >= originX + columns || cell.y < originY || cell.y >= originY + rows) continue;
    const fogged = cell.state === 'fogged';
    const accent = cell.state === 'current' ? palette().accent : cell.state === 'adjacent' || cell.state === 'cleared' ? palette().text : palette().textMuted;
    const tile = panel(context.body, fogged ? `MobileSheetFog:${cell.x}:${cell.y}` : `MobileSheetMapCell:${cell.cellId}`, -context.width / 2 + cellWidth / 2 + (cell.x - originX) * (cellWidth + GAP), context.bodyHeight / 2 - 134 - cellHeight / 2 - (cell.y - originY) * (cellHeight + GAP), cellWidth, cellHeight, cell.state === 'current' ? palette().accentDark : fogged ? palette().ink : palette().raised, cell.state === 'current' ? palette().accent : palette().edge, false, fogged ? 'fog' : 'tile');
    const g = node(tile, 'MapStateIcon', 0, 25, 42, 42).addComponent(Graphics);
    g.strokeColor = accent; g.fillColor = palette().textMuted; g.lineWidth = 3;
    if (fogged) { for (const dx of [-10, 0, 10]) { g.circle(dx, 0, 2); g.fill(); } }
    else if (cell.state === 'current') { g.circle(0, 0, 14); g.stroke(); g.circle(0, 0, 6); g.stroke(); }
    else if (cell.state === 'cleared') line(g, [-12, 0, -3, -9, 13, 11]);
    else if (cell.state === 'adjacent') line(g, [-14, 0, 14, 0, 5, 9]);
    else line(g, [0, 14, 14, 0, 0, -14, -14, 0, 0, 14]);
    text(tile, 'MapCellTitle', mapTitle(cell), 0, -27, cellWidth - 12, 52, 23, fogged ? palette().textMuted : palette().text, true);
    // Fog tiles have no title/nodeId readout or action binding of any kind.
    if (!fogged) context.options.bindLocal(tile, () => context.options.setState({ kind: 'map', page: 0, selectedActionId: `map:${cell.cellId}` }));
  }
  text(context.body, 'MobileSheetMapLegend', '金环：当前位置    浅灰：相邻 / 已清理\n灰色：已侦察    三点：迷雾未知', 0, -context.bodyHeight / 2 + 47, context.width, 84, 23, palette().textMuted, true);
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

function entryPages(model: GameViewModel): readonly SheetPage[] {
  const detail = model.sections[1].detail;
  if (detail.kind !== 'hub') return [{ title: '轮回之门', lines: ['回到主神空间后可选择下一次冒险。'] }];
  const pages: SheetPage[] = [{ title: detail.selectedDungeonName, lines: [detail.activePanel === 'entry' ? detail.panelSummary : `当前选择：${detail.selectedDungeonName}`, `共 ${detail.dungeonCount} 个副本；在入场选项中使用上一章、下一章切换。`, formatInfiniteFlowEntryBuildDetail(detail) ?? '打开入场选择后查看协议与配置。'] }];
  for (const option of detail.entryBuild.routeContract.options) pages.push({ title: `路线契约 · ${option.name}`, lines: [option.description, ...(option.orderedTargets.length ? [option.orderedTargets.map((target) => `${target.order} ${target.nodeTitle}`).join(' → ')] : []), `奖励点 ${option.rewardPoints}`, option.selected ? '当前已选择' : option.disabledReason ?? '可在入场选项中切换选择。'] });
  for (const option of detail.entryBuild.relic.seedOptions) pages.push({ title: `归档种子 · ${option.name}`, lines: [option.description, option.selected ? '当前已选择' : option.disabledReason ?? '可在入场选项中切换选择。'] });
  return pages;
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
  const tabbed = tabs(context, [{ id: 'shortcuts', title: '随身功能' }, { id: 'actions', title: context.model.phase === 'combat' ? '战斗行动' : '进阶行动' }], 'shortcuts');
  if (tabbed.active === 'actions') { renderActions(tabbed.context, getInfiniteFlowMobilePanelActions(context.model, 'menu')); return; }
  const ctx = tabbed.context;
  // WoW ESC menu: a vertical run of full-width gold-edged buttons.
  const tiles: readonly Readonly<{ kind: MobilePanelKind | 'actions' | 'close'; label: string; iconKind: string; accent: Color }>[] = [
    { kind: 'character', label: '角色状态', iconKind: 'character', accent: palette().accent },
    { kind: 'inventory', label: '背包装备', iconKind: 'inventory', accent: palette().accent },
    { kind: 'map', label: '区域地图', iconKind: 'map', accent: palette().accent },
    { kind: 'objectives', label: '任务与章规', iconKind: 'objectives', accent: palette().accent },
    { kind: 'log', label: '冒险记录', iconKind: 'log', accent: palette().accent },
    { kind: 'help', label: '冒险指南', iconKind: 'help', accent: palette().accent },
    { kind: 'entry', label: '轮回之门', iconKind: 'entry', accent: palette().accent },
    { kind: 'actions', label: ctx.model.phase === 'combat' ? '战斗行动' : '进阶行动', iconKind: 'menu', accent: palette().danger },
    { kind: 'close', label: '收起菜单', iconKind: 'close', accent: palette().textMuted },
  ];
  const rowHeight = TOUCH;
  const headingHeight = 56;
  const contentHeight = 16 + headingHeight + 12 + tiles.length * rowHeight + (tiles.length - 1) * 12 + 16;
  const region = scrollRegion(ctx, contentHeight);
  const content = scrollContentNode(region);
  text(content, 'MobileSheetMenuHeading', '随身菜单', 0, scrollItemY(region, 16, headingHeight), ctx.width - 16, headingHeight, 30, palette().accent, true);
  tiles.forEach((tile, index) => {
    const cursor = 16 + headingHeight + 12 + index * (rowHeight + 12);
    const y = scrollItemY(region, cursor, rowHeight);
    const cell = panel(content, `MobileSheetShortcut:${tile.kind}`, 0, y, ctx.width, rowHeight, palette().quiet, tile.accent === palette().danger ? palette().danger : palette().edgeStrong, false, 'tile');
    icon(cell, 'ShortcutIcon', tile.iconKind, -ctx.width / 2 + 56, 0, tile.accent);
    text(cell, 'ShortcutTitle', tile.label, 24, 0, ctx.width - 160, 52, 27, tile.accent === palette().textMuted ? palette().textMuted : palette().text);
    if (tile.kind === 'close') ctx.options.bindLocal(cell, () => ctx.options.close());
    else if (tile.kind === 'actions') ctx.options.bindLocal(cell, () => ctx.options.setState({ kind: 'menu', tab: 'actions', page: 0 }));
    else {
      const kind: MobilePanelKind = tile.kind;
      ctx.options.bindLocal(cell, () => ctx.options.setState({ kind, page: 0, tip: undefined }));
    }
  });
}

const INVENTORY_COLUMNS = 5;
const INVENTORY_CELL_SIZE = 116;
const INVENTORY_CELL_GAP = 12;
const INVENTORY_TOTAL_SLOTS = 100;

/** WoW ContainerFrame: currency/carry header plus a 5×100 scrolling slot grid. */
function renderInventoryBag(context: SheetContext, loadout: NonNullable<GameViewModel['sections'][1]['loadout']>): void {
  const palette0 = palette();
  const metrics = context.model.sections[1].metrics;
  const metricValue = (id: string): string => metrics.find((metric) => metric.id === id)?.value ?? '—';

  // Header row: carry slots on the left, reward points + lingyun on the right.
  const headerHeight = 56;
  const headerY = context.bodyHeight / 2 - headerHeight / 2;
  text(context.body, 'MobileSheetMoneyCarry', `◆ 携行槽 ${loadout.carriedCount} / 3`, -context.width / 2 + 130, headerY, 240, headerHeight, 24, palette0.accent);
  panel(context.body, 'MoneyTokenLingyun', 76, headerY, 24, 24, palette0.quiet, palette0.positive, false, 'cell');
  text(context.body, 'MobileSheetMoney:lingyun', metricValue('lingyun'), 140, headerY, 92, headerHeight, 22, palette0.positive);
  panel(context.body, 'MoneyTokenReward', 207, headerY, 24, 24, palette0.accentDark, palette0.accent, false, 'cell');
  text(context.body, 'MobileSheetMoney:reward', metricValue('reward-points'), 271, headerY, 110, headerHeight, 22, palette0.accent);

  const hintY = headerY - headerHeight / 2 - 14 - 10;
  text(context.body, 'MobileSheetBagHint', '5 列 × 100 格 · 上下滑动浏览 · 点击格子查看详情', 0, hintY, context.width, 24, 20, palette0.textMuted, true);

  const gridWidth = INVENTORY_COLUMNS * INVENTORY_CELL_SIZE + (INVENTORY_COLUMNS - 1) * INVENTORY_CELL_GAP;
  const gridTop = hintY - 14 - 12;
  const gridHeight = Math.max(120, gridTop + context.bodyHeight / 2);
  const backing = panel(context.body, 'MobileSheetInventoryRack', 0, gridTop - gridHeight / 2, context.width, gridHeight, palette0.quiet, palette0.edge, false, 'rack');

  const contentHeight = 16 + INVENTORY_TOTAL_SLOTS / INVENTORY_COLUMNS * INVENTORY_CELL_SIZE
    + (INVENTORY_TOTAL_SLOTS / INVENTORY_COLUMNS - 1) * INVENTORY_CELL_GAP + 16;
  const regionContext = surfaceContext(context, { body: backing, width: context.width, bodyHeight: gridHeight });
  const region = scrollRegion(regionContext, contentHeight);
  const content = scrollContentNode(region);

  for (let index = 0; index < INVENTORY_TOTAL_SLOTS; index += 1) {
    const col = index % INVENTORY_COLUMNS;
    const row = Math.floor(index / INVENTORY_COLUMNS);
    const x = -gridWidth / 2 + INVENTORY_CELL_SIZE / 2 + col * (INVENTORY_CELL_SIZE + INVENTORY_CELL_GAP);
    const cursor = 16 + row * (INVENTORY_CELL_SIZE + INVENTORY_CELL_GAP);
    const y = scrollItemY(region, cursor, INVENTORY_CELL_SIZE);
    const entry = loadout.items[index];
    if (!entry) {
      // Purely decorative empty slot: no label, no data, no interaction.
      panel(content, `MobileSheetBlank:${index}`, x, y, INVENTORY_CELL_SIZE, INVENTORY_CELL_SIZE, palette0.ink, palette0.edge, false, 'cell');
      continue;
    }
    const empty = entry.count === 0 && !entry.carried;
    const cell = panel(content, `MobileSheetItem:${entry.itemId}`, x, y, INVENTORY_CELL_SIZE, INVENTORY_CELL_SIZE, palette0.raised, entry.carried ? palette0.accent : palette0.edge, false, 'cell');
    figureNode(context, cell, `ItemIcon:${entry.itemId}`, sheetItemKey(entry.itemId), 0, 6, 80, 80,
      { glyph: entry.name.charAt(entry.name.length - 1), glyphSize: 32, glyphColor: empty ? palette0.textMuted : palette0.text }, context.images);
    text(cell, 'ItemCount', `×${entry.count}`, INVENTORY_CELL_SIZE / 2 - 30, -INVENTORY_CELL_SIZE / 2 + 18, 56, 24, 18, entry.count > 0 ? palette0.text : palette0.textMuted, true);
    if (entry.carried) sealNode(cell, 'ItemCarriedSeal', INVENTORY_CELL_SIZE / 2 - 18, INVENTORY_CELL_SIZE / 2 - 18);
    context.options.bindLocal(cell, () => context.options.setState({ ...context.state, tip: { kind: 'item', id: entry.itemId } }));
  }
}

function renderInventory(context: SheetContext): void {
  const actionTitle = context.model.sections[1].detail.kind === 'hub' ? '物资 / 装备' : '可用道具';
  const tabbed = tabs(context, [{ id: 'bag', title: '行囊' }, { id: 'actions', title: actionTitle }], 'bag');
  if (tabbed.active === 'actions') { renderActions(tabbed.context, getInfiniteFlowMobilePanelActions(context.model, 'inventory')); return; }
  const ctx = tabbed.context;
  const loadout = ctx.model.sections[1].loadout;
  if (!loadout) { renderTextPages(ctx, inventoryPages(ctx.model)); return; }
  renderInventoryBag(ctx, loadout);
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
const SHEET_BAND_HEIGHT = 104;
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
  icon(frame, 'MobileSheetHeaderIcon', state.kind, -width / 2 + 56, bandY);
  const detail = model.sections[1].detail;
  const title = state.kind === 'npc' && detail.kind === 'hub' ? detail.activePanelLabel
    : state.kind === 'interaction' && detail.kind === 'explore' ? detail.pending?.title ?? detail.currentNode.title : TITLES[state.kind];
  text(frame, 'MobileSheetTitle', readable(title), -12, bandY, width - 228, 84, 34, palette().accent);
  const close = panel(frame, 'MobileSheetClose', width / 2 - 70, bandY, TOUCH, TOUCH, palette().raised, palette().edgeStrong, false, 'iconButton');
  icon(close, 'CloseIcon', 'close', 0, 0, palette().text);
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
  const title = state.kind === 'npc' && detail.kind === 'hub' ? detail.activePanelLabel
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

const TIP_WIDTH = 460;
const TIP_PAD = 24;
const TIP_LINE = 32;
const TIP_TITLE_LINE = 40;

type TipLine = Readonly<{ text: string; size: number; color: Color; italic?: boolean }>;

/** Resolve the hub supplies toggle action even when another hub panel is active. */
function resolveCarryToggle(context: SheetContext, itemId: string): ViewActionModel | undefined {
  const actionId = `hub.supplies.toggle:${itemId}`;
  const local = context.model.sections[2].actions.find((action) => action.actionId === actionId);
  if (local) return local;
  return context.options.supplyActions?.().find((action) => action.actionId === actionId);
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
    lines.push({ text: equipped?.name ?? definition?.name ?? tip.id, size: 28, color: palette0.text });
    if (equipped) lines.push({ text: `${equipped.slotLabel} · 等阶 Lv.${equipped.level}/${equipped.maxLevel} · 已装备`, size: 22, color: palette0.textMuted });
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
    carried = entry?.carried ?? false;
    lines.push({ text: entry?.name ?? definition?.name ?? tip.id, size: 28, color: palette0.text });
    lines.push({ text: ITEM_CATEGORY_LABELS[entry?.category ?? ''] ?? '战术道具', size: 22, color: palette0.textMuted });
    if (entry) lines.push({ text: `库存 ${entry.count} · ${entry.carried ? '已携行' : '未携行'}`, size: 22, color: palette0.textMuted });
    if (definition) {
      lines.push({ text: `使用：${definition.description}`, size: 23, color: palette0.positive });
      const flavor = getGameAsset('item', tip.id)?.alt;
      if (flavor) lines.push({ text: flavor, size: 22, color: palette0.accent, italic: true });
      lines.push({ text: `兑换价：${definition.cost?.rewardPoints ?? '—'} 奖励点`, size: 20, color: palette0.textMuted });
    }
    if (context.model.phase === 'hub') carryAction = resolveCarryToggle(context, tip.id);
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
  const closeButton = panel(card, 'MobileSheetTipClose', showCarry ? -TIP_WIDTH / 2 + TIP_PAD + buttonWidth / 2 + 6 : 0, buttonY, buttonWidth, TOUCH, palette0.raised, palette0.edgeStrong, false, 'control');
  text(closeButton, 'Label', '关闭', 0, 0, buttonWidth - 16, 60, 26, palette0.text, true);
  context.options.bindLocal(closeButton, () => context.options.setState({ ...context.state, tip: undefined }));
  if (showCarry && carryAction) {
    const enabled = canExecute(context, carryAction);
    const carryButton = panel(card, `MobileSheetTipCarry:${tip.id}`, TIP_WIDTH / 2 - TIP_PAD - buttonWidth / 2, buttonY, buttonWidth, TOUCH,
      enabled ? palette0.accentDark : palette0.quiet, enabled ? palette0.accent : palette0.edge, false, 'control');
    text(carryButton, 'Label', carried ? '取消携行' : '设为携行', 0, 0, buttonWidth - 16, 60, 26, enabled ? palette0.accent : palette0.textMuted, true);
    if (enabled) context.options.bindAction(carryButton, carryAction);
  }

  // Tap outside the frame dismisses only while a tip is pinned.
  context.options.bindLocal(backdrop, () => context.options.setState({ ...context.state, tip: undefined }));
}

function renderSheetKind(context: SheetContext): void {
  const { model, state } = context;
  const detail = model.sections[1].detail;
  if (state.kind === 'character') {
    const selected = model.sections[1].metrics.find((metric) => metric.id === state.selectedActionId);
    if (selected) renderMetricDetail(context, selected); else renderCharacter(context);
  } else if (state.kind === 'map') renderMap(context);
  else if (state.kind === 'objectives') renderTextPages(context, objectivePages(model));
  else if (state.kind === 'log') renderTextPages(context, model.sections[5].lines.length === 0 ? [{ title: '冒险记录', lines: ['本轮还没有新的记录。'] }] : model.sections[5].lines.map((entry, index) => ({ title: `冒险记录 · ${index + 1}`, lines: [entry] })));
  else if (state.kind === 'help') renderHelp(context);
  else if (state.kind === 'menu') renderMenu(context);
  else if (state.kind === 'entry') renderTabbedActions(context, entryPages(model), ['副本与配置', '入场选项']);
  else if (state.kind === 'inventory') renderInventory(context);
  else if (state.kind === 'npc') renderTabbedActions(context, hubPages(model), ['交谈与详情', '整备选项']);
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
