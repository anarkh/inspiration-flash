import {
  BlockInputEvents,
  Color,
  EventTouch,
  Graphics,
  ImageAsset,
  Label,
  Mask,
  Node,
  Rect,
  ScrollView,
  Size,
  Sprite,
  SpriteFrame,
  UITransform,
  Vec2,
  Vec3,
  view,
} from 'cc';
import type { Asset } from 'cc';
import type { ItemId } from '@infinite-flow/core';
import { renderInfiniteFlowScene } from './InfiniteFlowScene';
import type { InfiniteFlowSceneOptions } from './InfiniteFlowScene';
import { renderInfiniteFlowWalkScene } from './InfiniteFlowWalkScene';
import type { WalkSceneHandle } from './InfiniteFlowWalkScene';
import { InfiniteFlowWalkInput } from './InfiniteFlowWalkInput';
import { captureInfiniteFlowInfoSheetState, renderInfiniteFlowInfoSheet } from './InfiniteFlowInfoSheet';
import type { MobilePanelKind, MobileSheetState } from './InfiniteFlowInfoSheet';
import { buildWalkWorld, nearestWalkTarget } from './walk-world';
import type { WorldPoint, WorldTarget } from './walk-world';
import { DARK_UI, paintDarkFrame } from './dark-ui';
import type {
  ChapterDecisionViewModel,
  ChapterDirectiveViewModel,
  ChapterLawCardViewModel,
  ChapterPressureViewModel,
  ChapterPursuitViewModel,
  ChapterRouteContractViewModel,
  CombatChapterContextViewModel,
  EquipmentCommissionDetailViewModel,
  EquipmentCommissionSettlementViewModel,
  EquipmentMemoryCombatViewModel,
  EquipmentMemoryHuntViewModel,
  EquipmentMemoryLibraryViewModel,
  EquipmentMemoryResultViewModel,
  GameViewModel,
  HelpSection,
  HubPanel,
  HubOwnedLoadoutViewModel,
  MapNodeViewModel,
  MapNodeState,
  MapViewModel,
  PhaseDetailViewModel,
  PresentationEvent,
  ResultDetailViewModel,
  ResultDirectiveSettlementViewModel,
  ResultEquipmentRollSettlementViewModel,
  ResultLootSettlementViewModel,
  ResultPursuitSettlementViewModel,
  ResultPressureSettlementViewModel,
  ResultProtocolSettlementViewModel,
  ResultRouteContractSettlementViewModel,
  StatusMetric,
  ViewActionModel,
} from '@infinite-flow/presentation';

const DESIGN_WIDTH = 750;
const DESIGN_HEIGHT = 1334;
const UI_LAYER = 1 << 25;

const CONTENT_WIDTH = 702;
const MINIMUM_TOUCH_HEIGHT = 104;
const PRIMARY_TOUCH_HEIGHT = 112;
const MODE_TOP = 0;
const MODE_HEIGHT = 48;
const TITLE_TOP = 52;
const TITLE_HEIGHT = 56;
const RAIL_TOP = 112;
const RAIL_HEIGHT = 34;
const OBJECTIVE_TOP = 152;
const OBJECTIVE_HEIGHT = 104;
const STATUS_TOP = 262;
const STATUS_HEIGHT = 224;
const VISUAL_STAGE_WIDTH = CONTENT_WIDTH - 8;
const VISUAL_STAGE_HEIGHT = STATUS_HEIGHT - 8;
const VISUAL_STAGE_INSET = 6;
const VISUAL_MONSTER_MAX_WIDTH = 292;
const VISUAL_HUD_HEIGHT = 144;
const COMBAT_VISUAL_HUD_HEIGHT = 88;
const DECK_TOP = 492;
const DECK_HEIGHT = 544;
const COMBAT_ACTION_PAGE_SIZE = 4;
const COMBAT_ACTION_CARD_WIDTH = 318;
const COMBAT_ACTION_CARD_HEIGHT = 160;
const COMBAT_ACTION_CARD_GAP_X = 14;
const COMBAT_ACTION_CARD_GAP_Y = 10;
const COMBAT_ACTION_CARD_TOP = 56;
const EXPLORE_MAP_COLUMNS = 3;
const EXPLORE_MAP_ROWS = 3;
const EXPLORE_MAP_CELL_SIZE = 104;
const EXPLORE_MAP_CELL_GAP = 6;
const EXPLORE_MAP_GRID_X = -171;
const EXPLORE_MAP_GRID_Y = 52;
const EXPLORE_MAP_CONTROL_WIDTH = 140;
const EXPLORE_MAP_CONTROL_HEIGHT = 104;
const EXPLORE_MAP_CONTROL_LEFT_X = 72;
const EXPLORE_MAP_CONTROL_RIGHT_X = 226;
const FOOTER_TOP = 1042;
const FOOTER_HEIGHT = 104;
// Result pager geometry inside the 702x224 status panel: the header and up to
// six pre-wrapped lines stay centered between the metric chips and the panel
// edge, while the 108x116 nav buttons flank the text column. Every control
// keeps at least a 104 design-px touch target.
const RESULT_PAGER_HEADER_Y = 9;
const RESULT_PAGER_HEADER_HEIGHT = 20;
const RESULT_PAGER_CONTENT_TOP_Y = -12;
const RESULT_PAGER_LINE_HEIGHT = 17;
const RESULT_PAGER_NAV_Y = -46;
const RESULT_PAGER_NAV_WIDTH = 108;
const RESULT_PAGER_NAV_HEIGHT = 116;
const RESULT_PAGER_PREV_X = -296;
const RESULT_PAGER_NEXT_X = 296;
const RESULT_ALTAR_WIDTH = 470;
const RESULT_ALTAR_HEIGHT = 208;
const RESULT_ALTAR_METRIC_WIDTH = 148;
const RESULT_ALTAR_METRIC_HEIGHT = 24;
const RESULT_ALTAR_METRIC_GAP_X = 6;

export type InfiniteFlowSafeInsets = Readonly<{
  top: number;
  right: number;
  bottom: number;
  left: number;
}>;

export const INFINITE_FLOW_SAFE_CONTENT_MINIMUM = Object.freeze({
  width: CONTENT_WIDTH,
  height: FOOTER_TOP + FOOTER_HEIGHT,
});

export const INFINITE_FLOW_PREVIEW_SAFE_INSETS: InfiniteFlowSafeInsets = Object.freeze({
  // Conservative maximum of the documented 320x568 and 390x844 fallback profiles,
  // converted with design-px = viewport-px * 750 / viewport-width.
  top: Math.ceil(47 * 750 / 390),
  right: 0,
  bottom: Math.ceil(34 * 750 / 390),
  left: 0,
});

type Rgb = readonly [red: number, green: number, blue: number];

const RGB = Object.freeze({
  background: [DARK_UI.panel.r, DARK_UI.panel.g, DARK_UI.panel.b] as const,
  raised: [DARK_UI.raised.r, DARK_UI.raised.g, DARK_UI.raised.b] as const,
  raisedQuiet: [DARK_UI.quiet.r, DARK_UI.quiet.g, DARK_UI.quiet.b] as const,
  tealLight: [DARK_UI.gold.r, DARK_UI.gold.g, DARK_UI.gold.b] as const,
  tealDark: [DARK_UI.goldDark.r, DARK_UI.goldDark.g, DARK_UI.goldDark.b] as const,
  goldLight: [DARK_UI.gold.r, DARK_UI.gold.g, DARK_UI.gold.b] as const,
  goldDark: [DARK_UI.goldDark.r, DARK_UI.goldDark.g, DARK_UI.goldDark.b] as const,
  redLight: [DARK_UI.red.r, DARK_UI.red.g, DARK_UI.red.b] as const,
  redDark: [DARK_UI.redDark.r, DARK_UI.redDark.g, DARK_UI.redDark.b] as const,
  bone: [DARK_UI.bone.r, DARK_UI.bone.g, DARK_UI.bone.b] as const,
  muted: [DARK_UI.muted.r, DARK_UI.muted.g, DARK_UI.muted.b] as const,
});

function linearChannel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function relativeLuminance(rgb: Rgb): number {
  return 0.2126 * linearChannel(rgb[0])
    + 0.7152 * linearChannel(rgb[1])
    + 0.0722 * linearChannel(rgb[2]);
}

function contrastRatio(foreground: Rgb, background: Rgb): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

const CONTRAST_PAIRS = Object.freeze([
  { id: 'teal-text-on-teal-dark', foreground: RGB.tealLight, background: RGB.tealDark, minimum: 4.5 },
  { id: 'gold-text-on-gold-dark', foreground: RGB.goldLight, background: RGB.goldDark, minimum: 4.5 },
  { id: 'red-text-on-red-dark', foreground: RGB.redLight, background: RGB.redDark, minimum: 4.5 },
  { id: 'bone-text-on-raised', foreground: RGB.bone, background: RGB.raised, minimum: 4.5 },
  { id: 'muted-text-on-raised-quiet', foreground: RGB.muted, background: RGB.raisedQuiet, minimum: 4.5 },
  { id: 'muted-text-on-teal-dark', foreground: RGB.muted, background: RGB.tealDark, minimum: 4.5 },
  { id: 'muted-text-on-red-dark', foreground: RGB.muted, background: RGB.redDark, minimum: 4.5 },
  { id: 'teal-boundary-on-raised', foreground: RGB.tealLight, background: RGB.raised, minimum: 3 },
  { id: 'gold-boundary-on-raised', foreground: RGB.goldLight, background: RGB.raised, minimum: 3 },
  { id: 'red-boundary-on-raised', foreground: RGB.redLight, background: RGB.raised, minimum: 3 },
] as const);

/** Headless-auditable WCAG ratios for every recurring text/boundary pairing. */
export const INFINITE_FLOW_CONTRAST_AUDIT = Object.freeze(
  CONTRAST_PAIRS.map((pair) => Object.freeze({
    id: pair.id,
    minimum: pair.minimum,
    ratio: contrastRatio(pair.foreground, pair.background),
  })),
);

for (const result of INFINITE_FLOW_CONTRAST_AUDIT) {
  if (result.ratio < result.minimum) {
    throw new Error(`Contrast audit failed for ${result.id}: ${result.ratio}`);
  }
}

const PALETTE = Object.freeze({
  background: new Color(...RGB.background, 255),
  backgroundOpaque: new Color(11, 14, 13, 250),
  raised: new Color(...RGB.raised, 255),
  raisedQuiet: new Color(...RGB.raisedQuiet, 255),
  teal: new Color(...RGB.tealLight, 255),
  tealDark: new Color(...RGB.tealDark, 255),
  gold: new Color(...RGB.goldLight, 255),
  goldDark: new Color(...RGB.goldDark, 255),
  red: new Color(...RGB.redLight, 255),
  redDark: new Color(...RGB.redDark, 255),
  bone: new Color(...RGB.bone, 255),
  muted: new Color(...RGB.muted, 255),
  disabled: new Color(...RGB.muted, 255),
  black: new Color(8, 10, 9, 255),
  visualBackdropShade: new Color(8, 10, 9, 168),
  visualSurface: new Color(...RGB.raised, 220),
  visualSurfaceQuiet: new Color(...RGB.raisedQuiet, 216),
  visualHud: new Color(8, 10, 9, 210),
});

const SECTION_LABELS = Object.freeze([
  '1 目标',
  '2 状态',
  '3 动作',
  '4 风险',
  '5 帮助',
  '6 日志',
]);

const DECK_LABELS = Object.freeze(['动作', '风险', '帮助', '日志']);
const MAP_STATES: readonly Readonly<{
  state: MapNodeState;
  symbol: string;
  label: string;
}>[] = Object.freeze([
  { state: 'current', symbol: '◎', label: '当前位置' },
  { state: 'adjacent', symbol: '→', label: '相邻可达' },
  { state: 'scouted', symbol: '◇', label: '已侦察' },
  { state: 'cleared', symbol: '✓', label: '已清理' },
  { state: 'fogged', symbol: '?', label: '迷雾未知' },
]);

type RuntimeModeKind = 'boot' | 'preview' | 'wx' | 'wx-devtools' | 'blocked';

export type InfiniteFlowRuntimeChrome = Readonly<{
  modeKind: RuntimeModeKind;
  modeLabel: string;
  modeDetail: string;
  activityMessage?: string;
  blockingMessage?: string;
  busyActionId?: string;
  /** Hub-only: supplies-panel actions for item-tip carry toggles (projected on demand). */
  supplyActions?: (itemId: ItemId) => readonly ViewActionModel[];
  ownedLoadout?: () => HubOwnedLoadoutViewModel | undefined;
}>;

export type InfiniteFlowPlayerChrome = Readonly<{
  modeLabel: string;
  modeDetail: string;
  activityMessage?: string;
}>;

function infiniteFlowPhaseActivity(phase: GameViewModel['phase'] | undefined): string {
  if (phase === 'hub') return '主神空间已就绪';
  if (phase === 'explore') return '探索进行中';
  if (phase === 'combat') return '战斗进行中';
  if (phase === 'result') return '结算已就绪';
  return '正在准备游戏';
}

function formatInfiniteFlowPlayerActivity(
  chrome: InfiniteFlowRuntimeChrome,
  phase: GameViewModel['phase'] | undefined,
): string {
  if (chrome.busyActionId !== undefined) return '行动处理中';
  const activity = chrome.activityMessage?.trim();
  if (activity === undefined || activity.length === 0) return infiniteFlowPhaseActivity(phase);

  if (/视觉资源恢复/u.test(activity)) return '画面资源已恢复 · 可继续游戏';
  if (/视觉资源回退/u.test(activity)) return '部分画面暂不可用 · 已切换文字模式，可继续游戏';
  if (/内存告警/u.test(activity)) return '设备内存紧张 · 已释放画面资源，请稍后继续';
  if (/安全随机池.*失败|随机源.*失败/iu.test(activity)) {
    return '安全随机源暂不可用 · 请稍后重试';
  }
  if (/生命周期|\b(?:resume|suspend|hide|show)\b/iu.test(activity)) {
    const succeeded = /完成|成功|[：:]\s*durable(?:\s|$)/iu.test(activity);
    return succeeded && !/失败|错误|异常|blocked|timeout|error|fail/iu.test(activity)
      ? '运行状态已同步'
      : '运行状态同步失败 · 请重新进入小游戏';
  }
  if (/^提交\s/u.test(activity)) return '行动处理中';
  if (/已提交\s|进度已更新/u.test(activity)) return '行动完成 · 进度已更新';
  if (/物理输入去重|重复触控|duplicate/iu.test(activity)) {
    return '重复触控已忽略 · 进度未改变';
  }
  if (/规则拒绝|本地输入拒绝|写入阻断/u.test(activity)) {
    return '当前行动不可执行 · 进度未改变';
  }
  if (/输入无效|invalid input/iu.test(activity)) return '当前输入无效 · 请重新选择';
  if (/本地界面/u.test(activity)) return '界面已切换';

  if (/^.+?\s+失败[：:]/u.test(activity)) return '行动失败 · 请稍后重试';
  if (/失败|错误|异常|blocked|error|fail/iu.test(activity)) {
    return '运行遇到异常 · 请稍后重试';
  }
  return infiniteFlowPhaseActivity(phase);
}

/** Player-facing chrome projection. The supplied diagnostic chrome stays untouched. */
export function formatInfiniteFlowPlayerChrome(
  chrome: InfiniteFlowRuntimeChrome,
  phase?: GameViewModel['phase'],
): InfiniteFlowPlayerChrome {
  if (chrome.modeKind === 'boot' || chrome.modeKind === 'blocked') {
    return Object.freeze({
      modeLabel: chrome.modeLabel,
      modeDetail: chrome.modeDetail,
      ...(chrome.activityMessage === undefined
        ? {}
        : { activityMessage: chrome.activityMessage }),
    });
  }

  const mode = chrome.modeKind === 'preview'
    ? {
        modeLabel: '∞ 无限流 · 试玩模式',
        modeDetail: '临时存档 · 关闭或刷新后进度会丢失',
      }
    : chrome.modeKind === 'wx-devtools'
      ? {
          modeLabel: '∞ 无限流 · 微信开发者工具 · NON_RELEASE',
          modeDetail: '临时存档 · 不可发布 · 关闭或刷新后进度会丢失',
        }
      : chrome.modeKind === 'wx'
        ? {
            modeLabel: '∞ 无限流 · 微信运行',
            modeDetail: '持久存档边界已连接',
          }
        : {
            modeLabel: '∞ 无限流',
            modeDetail: '运行边界已连接',
          };
  return Object.freeze({
    ...mode,
    activityMessage: formatInfiniteFlowPlayerActivity(chrome, phase),
  });
}

export function formatInfiniteFlowVisualFallbackDiagnostic(
  chrome: InfiniteFlowRuntimeChrome,
  diagnostic: string,
): string {
  return chrome.modeKind === 'boot' || chrome.modeKind === 'blocked'
    ? diagnostic
    : '部分画面暂不可用 · 已切换文字模式，可继续游戏';
}

export type InfiniteFlowVisualAssetStatus = Readonly<{
  key: string;
  revision: string;
  diagnostic?: string;
}>;

export type InfiniteFlowMapWindowLayout = Readonly<{
  columns: number;
  rows: number;
  cellSize: number;
  cellGap: number;
  originX: number;
  originY: number;
  maximumOriginX: number;
  maximumOriginY: number;
  canPanLeft: boolean;
  canPanRight: boolean;
  canPanUp: boolean;
  canPanDown: boolean;
}>;

export type InfiniteFlowCombatActionDeckLayout = Readonly<{
  pageSize: number;
  page: number;
  pageCount: number;
  visibleStart: number;
  visibleEnd: number;
  slots: readonly Readonly<{
    index: number;
    column: number;
    row: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>[];
}>;

export type InfiniteFlowHubControlDeckLayout = InfiniteFlowCombatActionDeckLayout;
export type InfiniteFlowHubEntryDeckLayout = InfiniteFlowHubControlDeckLayout;
export type InfiniteFlowExploreResultActionDeckLayout = InfiniteFlowCombatActionDeckLayout;

export type InfiniteFlowMapMoveMatchStatus =
  | 'ready'
  | 'node-disabled'
  | 'missing-action-id'
  | 'missing-action'
  | 'duplicate-action'
  | 'placement-mismatch'
  | 'adjacency-mismatch'
  | 'projection-mismatch'
  | 'action-disabled'
  | 'event-missing'
  | 'busy'
  | 'blocked';

type InfiniteFlowReadyMapMoveAction = ViewActionModel & Readonly<{
  enabled: true;
  placement: 'map';
  event: PresentationEvent;
}>;

export type InfiniteFlowMapMoveMatch =
  | Readonly<{
      status: 'ready';
      action: InfiniteFlowReadyMapMoveAction;
    }>
  | Readonly<{
      status: Exclude<InfiniteFlowMapMoveMatchStatus, 'ready'>;
      action?: ViewActionModel;
    }>;

function finiteInteger(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value)
    ? Math.trunc(value)
    : fallback;
}

/** Pure 2x2 tactical deck geometry with a clamped, never-empty pager domain. */
export function layoutInfiniteFlowCombatActionDeck(
  actionCount: number,
  requestedPage: number | undefined,
): InfiniteFlowCombatActionDeckLayout {
  const count = Math.max(0, finiteInteger(actionCount, 0));
  const pageCount = Math.max(1, Math.ceil(count / COMBAT_ACTION_PAGE_SIZE));
  const page = clamp(finiteInteger(requestedPage, 0), 0, pageCount - 1);
  const horizontalStep = COMBAT_ACTION_CARD_WIDTH + COMBAT_ACTION_CARD_GAP_X;
  const verticalStep = COMBAT_ACTION_CARD_HEIGHT + COMBAT_ACTION_CARD_GAP_Y;
  const slots = Object.freeze(Array.from({ length: COMBAT_ACTION_PAGE_SIZE }, (_, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    return Object.freeze({
      index,
      column,
      row,
      x: (column - 0.5) * horizontalStep,
      y: DECK_HEIGHT / 2
        - COMBAT_ACTION_CARD_TOP
        - row * verticalStep
        - COMBAT_ACTION_CARD_HEIGHT / 2,
      width: COMBAT_ACTION_CARD_WIDTH,
      height: COMBAT_ACTION_CARD_HEIGHT,
    });
  }));
  const visibleStart = page * COMBAT_ACTION_PAGE_SIZE;
  return Object.freeze({
    pageSize: COMBAT_ACTION_PAGE_SIZE,
    page,
    pageCount,
    visibleStart,
    visibleEnd: Math.min(count, visibleStart + COMBAT_ACTION_PAGE_SIZE),
    slots,
  });
}

/** Every legal Hub panel reuses the proven 2x2 geometry without changing combat rendering. */
export function layoutInfiniteFlowHubControlDeck(
  actionCount: number,
  requestedPage: number | undefined,
): InfiniteFlowHubControlDeckLayout {
  return layoutInfiniteFlowCombatActionDeck(actionCount, requestedPage);
}

/** Backward-compatible pure entry helper retained for existing consumers. */
export function layoutInfiniteFlowHubEntryActionDeck(
  actionCount: number,
  requestedPage: number | undefined,
): InfiniteFlowHubEntryDeckLayout {
  return layoutInfiniteFlowHubControlDeck(actionCount, requestedPage);
}

/** Normal Explore commands and Result choices share the proven 2x2 geometry. */
export function layoutInfiniteFlowExploreResultActionDeck(
  actionCount: number,
  requestedPage: number | undefined,
): InfiniteFlowExploreResultActionDeckLayout {
  return layoutInfiniteFlowCombatActionDeck(actionCount, requestedPage);
}

/** Pure clamped viewport layout; an omitted origin centers the current cell. */
export function layoutInfiniteFlowMapWindow(
  mapWidth: number,
  mapHeight: number,
  currentX: number | undefined,
  currentY: number | undefined,
  requestedOrigin?: Readonly<{ x: number; y: number }>,
): InfiniteFlowMapWindowLayout {
  const width = Math.max(1, finiteInteger(mapWidth, 1));
  const height = Math.max(1, finiteInteger(mapHeight, 1));
  const maximumOriginX = Math.max(0, width - EXPLORE_MAP_COLUMNS);
  const maximumOriginY = Math.max(0, height - EXPLORE_MAP_ROWS);
  const centeredX = finiteInteger(currentX, 0) - Math.floor(EXPLORE_MAP_COLUMNS / 2);
  const centeredY = finiteInteger(currentY, 0) - Math.floor(EXPLORE_MAP_ROWS / 2);
  const desiredX = requestedOrigin === undefined
    ? centeredX
    : finiteInteger(requestedOrigin.x, centeredX);
  const desiredY = requestedOrigin === undefined
    ? centeredY
    : finiteInteger(requestedOrigin.y, centeredY);
  const originX = clamp(desiredX, 0, maximumOriginX);
  const originY = clamp(desiredY, 0, maximumOriginY);
  return Object.freeze({
    columns: EXPLORE_MAP_COLUMNS,
    rows: EXPLORE_MAP_ROWS,
    cellSize: EXPLORE_MAP_CELL_SIZE,
    cellGap: EXPLORE_MAP_CELL_GAP,
    originX,
    originY,
    maximumOriginX,
    maximumOriginY,
    canPanLeft: originX > 0,
    canPanRight: originX < maximumOriginX,
    canPanUp: originY > 0,
    canPanDown: originY < maximumOriginY,
  });
}

/**
 * Resolves a map node through one exact moveActionId match. No node identity or
 * coordinates are converted into a command; every inconsistent projection is
 * intentionally non-interactive.
 */
export function matchInfiniteFlowMapMoveAction(
  node: MapNodeViewModel,
  actions: readonly ViewActionModel[],
  interaction: Readonly<{
    busy: boolean;
    blocked: boolean;
    projectionValid: boolean;
  }>,
): InfiniteFlowMapMoveMatch {
  if (!interaction.projectionValid) {
    return Object.freeze({ status: 'projection-mismatch' });
  }
  if (!node.canMove) return Object.freeze({ status: 'node-disabled' });
  if (node.disabledReason !== undefined) {
    return Object.freeze({ status: 'projection-mismatch' });
  }
  if (!node.isAdjacent) return Object.freeze({ status: 'adjacency-mismatch' });
  if (node.moveActionId === undefined) {
    return Object.freeze({ status: 'missing-action-id' });
  }
  const matches = actions.filter(({ actionId }) => actionId === node.moveActionId);
  if (matches.length === 0) return Object.freeze({ status: 'missing-action' });
  if (matches.length !== 1) return Object.freeze({ status: 'duplicate-action' });
  const action = matches[0];
  if (action === undefined) return Object.freeze({ status: 'missing-action' });
  if (action.placement !== 'map') {
    return Object.freeze({ status: 'placement-mismatch', action });
  }
  if (!action.enabled) return Object.freeze({ status: 'action-disabled', action });
  if (action.disabledReason !== undefined) {
    return Object.freeze({ status: 'projection-mismatch', action });
  }
  if (action.event === undefined) return Object.freeze({ status: 'event-missing', action });
  if (interaction.busy) return Object.freeze({ status: 'busy', action });
  if (interaction.blocked) return Object.freeze({ status: 'blocked', action });
  return Object.freeze({
    status: 'ready',
    action: action as InfiniteFlowReadyMapMoveAction,
  });
}

export type InfiniteFlowExploreCompassDirection = 'north' | 'east' | 'south' | 'west';

export type InfiniteFlowExploreCompassReadout = Readonly<{
  projectionValid: boolean;
  centerSymbol: string;
  directions: readonly Readonly<{
    direction: InfiniteFlowExploreCompassDirection;
    symbol: string;
    state?: MapNodeState;
  }>[];
}>;

const EXPLORE_COMPASS_OFFSETS: readonly Readonly<{
  direction: InfiniteFlowExploreCompassDirection;
  x: number;
  y: number;
}>[] = Object.freeze([
  Object.freeze({ direction: 'north', x: 0, y: -1 }),
  Object.freeze({ direction: 'east', x: 1, y: 0 }),
  Object.freeze({ direction: 'south', x: 0, y: 1 }),
  Object.freeze({ direction: 'west', x: -1, y: 0 }),
]);

/**
 * A privacy-preserving four-way projection of the detached map VM. It returns
 * no node identity or descriptive fields, and a fogged neighbor is always `?`
 * even when a malformed VM supplies a revealing stateSymbol.
 */
export function formatInfiniteFlowExploreCompass(
  map: MapViewModel,
): InfiniteFlowExploreCompassReadout {
  const currentMatches = map.nodes.filter((node) => (
    node.state === 'current'
    && node.nodeId === map.currentNodeId
    && Number.isInteger(node.x)
    && Number.isInteger(node.y)
  ));
  const current = currentMatches.length === 1 ? currentMatches[0] : undefined;
  const projectionValid = current !== undefined
    && current.x >= 0
    && current.y >= 0
    && current.x < map.width
    && current.y < map.height;
  const directions = EXPLORE_COMPASS_OFFSETS.map(({ direction, x, y }) => {
    if (!projectionValid || current === undefined) {
      return Object.freeze({ direction, symbol: '·' });
    }
    const matches = map.nodes.filter((node) => (
      node.x === current.x + x && node.y === current.y + y
    ));
    if (matches.length !== 1 || matches[0] === undefined) {
      return Object.freeze({ direction, symbol: matches.length > 1 ? '?' : '·' });
    }
    const neighbor = matches[0];
    return Object.freeze({
      direction,
      symbol: neighbor.state === 'fogged' ? '?' : neighbor.stateSymbol,
      state: neighbor.state,
    });
  });
  return Object.freeze({
    projectionValid,
    // The centre is semantic chrome, not VM copy. A malformed `stateSymbol`
    // therefore cannot smuggle a node identity into the compact HUD.
    centerSymbol: projectionValid ? '◎' : '×',
    directions: Object.freeze(directions),
  });
}

export type InfiniteFlowVisualStageLayout = Readonly<{
  role: 'scene' | 'monster';
  mode: 'contain';
  renderable: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type InfiniteFlowVisualBackdropLayout = Readonly<{
  role: 'scene' | 'monster';
  mode: 'cover';
  renderable: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}>;

function positiveFinite(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

/**
 * Aspect-ratio-safe layout for the full-screen atmosphere layer. Invalid or
 * unrepresentable source dimensions fail closed with finite frame geometry.
 */
export function layoutInfiniteFlowVisualBackdrop(
  kind: PhaseDetailViewModel['kind'],
  sourceWidth: number | undefined,
  sourceHeight: number | undefined,
  frameWidth = DESIGN_WIDTH,
  frameHeight = DESIGN_HEIGHT,
): InfiniteFlowVisualBackdropLayout {
  const safeFrameWidth = positiveFinite(frameWidth, DESIGN_WIDTH);
  const safeFrameHeight = positiveFinite(frameHeight, DESIGN_HEIGHT);
  const role = kind === 'combat' ? 'monster' : 'scene';
  const fallback = (): InfiniteFlowVisualBackdropLayout => Object.freeze({
    role,
    mode: 'cover',
    renderable: false,
    x: 0,
    y: 0,
    width: safeFrameWidth,
    height: safeFrameHeight,
  });
  if (
    sourceWidth === undefined
    || sourceHeight === undefined
    || !Number.isFinite(sourceWidth)
    || !Number.isFinite(sourceHeight)
    || sourceWidth <= 0
    || sourceHeight <= 0
  ) return fallback();

  const sourceAspect = sourceWidth / sourceHeight;
  const frameAspect = safeFrameWidth / safeFrameHeight;
  if (!Number.isFinite(sourceAspect) || sourceAspect <= 0) return fallback();
  const width = sourceAspect >= frameAspect
    ? safeFrameHeight * sourceAspect
    : safeFrameWidth;
  const height = sourceAspect >= frameAspect
    ? safeFrameHeight
    : safeFrameWidth / sourceAspect;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return fallback();
  const maximumHorizontalShift = Math.max(0, (width - safeFrameWidth) / 2);
  return Object.freeze({
    role,
    mode: 'cover',
    renderable: true,
    x: role === 'monster'
      ? Math.min(safeFrameWidth * 0.08, maximumHorizontalShift)
      : 0,
    y: 0,
    width,
    height,
  });
}

/**
 * Aspect-ratio-safe layout for the 2D status stage. Scene art is centered in
 * the full frame; combat portraits are contained and composed against the
 * right edge. Unknown source dimensions fail closed so CUSTOM mode can never
 * stretch an image whose aspect ratio is unavailable.
 */
export function layoutInfiniteFlowVisualStage(
  kind: PhaseDetailViewModel['kind'],
  sourceWidth: number | undefined,
  sourceHeight: number | undefined,
  frameWidth = VISUAL_STAGE_WIDTH,
  frameHeight = VISUAL_STAGE_HEIGHT,
): InfiniteFlowVisualStageLayout {
  const safeFrameWidth = positiveFinite(frameWidth, VISUAL_STAGE_WIDTH);
  const safeFrameHeight = positiveFinite(frameHeight, VISUAL_STAGE_HEIGHT);
  const role = kind === 'combat' ? 'monster' : 'scene';
  const maximumWidth = role === 'monster'
    ? Math.min(VISUAL_MONSTER_MAX_WIDTH, safeFrameWidth * 0.42)
    : safeFrameWidth;
  const fallbackX = role === 'monster'
    ? safeFrameWidth / 2 - maximumWidth / 2 - VISUAL_STAGE_INSET
    : 0;
  const sourceIsKnown = sourceWidth !== undefined
    && sourceHeight !== undefined
    && Number.isFinite(sourceWidth)
    && Number.isFinite(sourceHeight)
    && sourceWidth > 0
    && sourceHeight > 0;
  if (!sourceIsKnown) {
    return Object.freeze({
      role,
      mode: 'contain',
      renderable: false,
      x: fallbackX,
      y: 0,
      width: maximumWidth,
      height: safeFrameHeight,
    });
  }

  const scale = Math.min(maximumWidth / sourceWidth, safeFrameHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return Object.freeze({
    role,
    mode: 'contain',
    renderable: true,
    x: role === 'monster'
      ? safeFrameWidth / 2 - width / 2 - VISUAL_STAGE_INSET
      : 0,
    y: 0,
    width,
    height,
  });
}

export interface InfiniteFlowViewDelegate {
  activate(
    physicalId: string,
    actionId: string,
    event: PresentationEvent,
  ): void;
}

type TextOptions = Readonly<{
  fontSize?: number;
  color?: Color;
  horizontal?: number;
  vertical?: number;
  wrap?: boolean;
  shrink?: boolean;
  lineHeight?: number;
}>;

type PanelOptions = Readonly<{
  fill?: Color;
  stroke?: Color;
  lineWidth?: number;
  radius?: number;
}>;

function setLayer(node: Node): void {
  node.layer = UI_LAYER;
}

function addNode(
  parent: Node,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
): Node {
  const node = new Node(name);
  setLayer(node);
  parent.addChild(node);
  node.setPosition(new Vec3(x, y, 0));
  node.addComponent(UITransform).setContentSize(new Size(width, height));
  return node;
}

function addPanel(
  parent: Node,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options: PanelOptions = {},
): Node {
  const node = addNode(parent, name, x, y, width, height);
  const graphics = node.addComponent(Graphics);
  paintDarkFrame(graphics, width, height, {
    fill: options.fill ?? PALETTE.raised,
    edge: options.stroke ?? DARK_UI.edge,
    cut: options.radius ?? 8,
  });
  graphics.lineWidth = options.lineWidth ?? 2;
  return node;
}

function addText(
  parent: Node,
  name: string,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options: TextOptions = {},
): Label {
  const node = addNode(parent, name, x, y, width, height);
  const label = node.addComponent(Label);
  label.string = value;
  label.fontSize = options.fontSize ?? 26;
  label.lineHeight = options.lineHeight
    ?? Math.max(22, Math.round((options.fontSize ?? 26) * 1.25));
  label.color = options.color ?? PALETTE.bone;
  label.horizontalAlign = options.horizontal ?? Label.HorizontalAlign.LEFT;
  label.verticalAlign = options.vertical ?? Label.VerticalAlign.CENTER;
  label.enableWrapText = options.wrap ?? true;
  label.overflow = options.shrink === false
    ? Label.Overflow.CLAMP
    : Label.Overflow.SHRINK;
  return label;
}

function localY(containerHeight: number, top: number, height: number): number {
  return containerHeight / 2 - top - height / 2;
}

function stateColor(state: MapNodeState): Color {
  if (state === 'current') return PALETTE.gold;
  if (state === 'adjacent' || state === 'cleared') return PALETTE.teal;
  if (state === 'scouted') return PALETTE.muted;
  return PALETTE.disabled;
}

function mapNodeTypeLabel(nodeType: MapNodeViewModel['nodeType']): string {
  const labels: Readonly<Record<string, string>> = Object.freeze({
    monster: '妖物遭遇',
    trap: '陷阱',
    portal: '界门',
    reward: '奖励',
    exit: '出口',
    // Headless compatibility fixtures use these older presentation aliases.
    combat: '战斗遭遇',
    event: '事件',
    treasure: '宝藏',
    unknown: '未知遭遇',
  });
  return labels[nodeType] ?? '未知遭遇';
}

function mapMoveStatusLabel(status: InfiniteFlowMapMoveMatchStatus): string {
  if (status === 'ready') return '点击移动';
  if (status === 'busy') return '指令提交中';
  if (status === 'blocked') return '运行已阻断';
  if (status === 'action-disabled' || status === 'node-disabled') return '当前不可移动';
  return '移动映射异常';
}

function severityColor(severity: StatusMetric['severity']): Color {
  if (severity === 'danger') return PALETTE.red;
  if (severity === 'warning') return PALETTE.gold;
  if (severity === 'positive') return PALETTE.teal;
  return PALETTE.muted;
}

function deckPageCount(length: number, pageSize: number): number {
  return Math.max(1, Math.ceil(length / pageSize));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function actionMarker(action: ViewActionModel): string {
  if (!action.enabled) return '×';
  if (action.recommendation === 'high-risk') return '!';
  if (action.recommendation === 'recommended') return '★';
  return '•';
}

function actionTag(action: ViewActionModel): string {
  const labels: Readonly<Record<ViewActionModel['placement'], string>> = {
    primary: '首要',
    preparation: '整备',
    map: '地图',
    node: '节点',
    combat: '回合',
    advanced: '进阶',
    result: '结算',
  };
  return labels[action.placement];
}

const COMBAT_ACTION_GLYPHS: Readonly<
Partial<Record<NonNullable<ViewActionModel['combatAction']>, string>>
> = Object.freeze({
  attack: '斩',
  art: '术',
  guard: '守',
  weapon_skill: '技',
  use_healing_pill: '丹',
  use_thunder_talisman: '雷',
  escape: '退',
});

const HUB_PANEL_ACTION_GLYPHS = Object.freeze({
  entry: '门',
  supplies: '物',
  equipment: '锻',
  pets: '灵',
  methods: '诀',
  bloodlines: '血',
  companions: '伴',
  tasks: '令',
} as const);

const HUB_PANEL_PLAYER_LABELS: Readonly<Record<HubPanel, string>> = Object.freeze({
  entry: '入场',
  supplies: '物资与携行',
  equipment: '装备工坊',
  pets: '灵宠',
  methods: '功法',
  bloodlines: '血统',
  companions: '同伴',
  tasks: '任务',
});

/**
 * Hub-only player-copy boundary. The presentation VM deliberately keeps
 * host/domain diagnostics for non-Cocos consumers; the 2D lobby translates
 * those diagnostics without mutating their source values.
 */
export function formatInfiniteFlowHubPlayerCopy(
  value: string | undefined,
  fallback = '当前状态待确认。',
): string {
  const source = value?.trim();
  if (source === undefined || source.length === 0) return fallback;
  return source
    .replace(
      /宿主会先生成并持久化显式\s*seed，再提交唯一一次\s*run\/enter。?/giu,
      '确认后生成并保存本局命数，随后进入所选副本。',
    )
    .replace(/确认只产生一次宿主入场请求。?/gu, '确认后将进入所选副本。')
    .replace(
      /仅更新入场草案；确认入场前不会生成\s*seed。?/giu,
      '仅调整入场选择；确认入场前不会生成本局命数。',
    )
    .replace(
      /仅更新本地委托草稿，不提交领域命令。?/gu,
      '仅调整封存委托选择；启动前不会生效。',
    )
    .replace(/当前装备不在领域返回的可封存候选中/gu, '当前装备不在可封存候选中')
    .replace(/当前装备不在领域返回的装备记忆承载目录中/gu, '当前装备不能承载装备记忆')
    .replace(/当前委托草稿未通过领域校验/gu, '当前封存委托选择尚不完整')
    .replace(/当前装备记忆未通过领域激活校验/gu, '当前装备记忆尚未满足激活条件')
    .replace(/领域返回的?/gu, '当前')
    .replace(/领域激活校验|领域校验/gu, '启用条件')
    .replace(/领域命令/gu, '冒险行动')
    .replace(/本地委托草稿/gu, '封存委托选择')
    .replace(/入场草案/gu, '入场选择')
    .replace(/显式\s*seed/giu, '本局命数')
    .replace(/\bseed\b/giu, '本局命数')
    .replace(/\brun\/enter\b/giu, '确认入场')
    .replace(/宿主/gu, '持有者')
    .replace(/现代流程/gu, '当前规则')
    .replace(/现代\s*flowVersion\s*\d*/giu, '当前规则')
    .replace(/\blegacy\b/giu, '旧版');
}

function hubEntityName(
  name: string | undefined,
  internalId: string | null | undefined,
  fallback: string,
): string {
  const candidate = name?.trim();
  if (
    candidate === undefined
    || candidate.length === 0
    || (internalId !== undefined && internalId !== null && candidate === internalId)
  ) return fallback;
  return formatInfiniteFlowHubPlayerCopy(candidate, fallback);
}

function hubActionInternalTokens(action: ViewActionModel): readonly string[] {
  const tokens = [action.actionId];
  const visit = (value: unknown, key: string): void => {
    if (typeof value === 'string') {
      if (key === 'type' || /Ids?$/u.test(key)) tokens.push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item, key);
      return;
    }
    if (value === null || typeof value !== 'object') return;
    for (const [childKey, childValue] of Object.entries(value)) {
      visit(childValue, childKey);
    }
  };
  if (action.event !== undefined) visit(action.event, 'event');
  return Object.freeze(tokens.filter((token) => token.length > 0));
}

function hubCopyContainsInternalToken(copy: string, action: ViewActionModel): boolean {
  return hubActionInternalTokens(action).some((token) => copy.includes(token));
}

export function formatInfiniteFlowHubActionLockedReason(action: ViewActionModel): string {
  const fallback = '当前选项不可用。';
  const rawReason = action.disabledReason?.trim();
  if (rawReason !== undefined && hubCopyContainsInternalToken(rawReason, action)) {
    return fallback;
  }
  const playerReason = formatInfiniteFlowHubPlayerCopy(rawReason, fallback);
  return hubCopyContainsInternalToken(playerReason, action) ? fallback : playerReason;
}

function hubLocalActionFallbackLabel(action: ViewActionModel): string {
  if (action.event?.kind !== 'local') return '未知选项';
  switch (action.event.action.type) {
    case 'hub/select-panel':
      return `前往${HUB_PANEL_PLAYER_LABELS[action.event.action.panel]}`;
    case 'hub/select-catalog-entry':
      return `浏览${HUB_PANEL_PLAYER_LABELS[action.event.action.panel]}目录`;
    case 'entry/select-dungeon':
      return '切换挑战章节';
    case 'entry/select-protocol':
      return '切换探索协议';
    case 'entry/set-inferno-tier':
      return '调整炼狱层级';
    case 'entry/select-route-contract':
      return '切换路线契约';
    case 'entry/select-relic-seed':
      return '切换归档种子';
    case 'hub/set-equipment-commission-draft':
      return '调整封存委托选择';
    case 'entry/request-enter':
      return '确认入场';
    case 'help/open':
      return '打开完整帮助';
    case 'help/close':
      return '关闭完整帮助';
    case 'combat/set-advanced-expanded':
      return '调整进阶战术';
  }
}

/** Pure short-copy projection; it never rewrites or reconstructs the event. */
export function formatInfiniteFlowHubActionShortCopy(action: ViewActionModel): string {
  if (action.event?.kind !== 'local') {
    const copy = formatInfiniteFlowHubPlayerCopy(
      action.riskReason ?? action.readout,
      '点击确认。',
    );
    return hubCopyContainsInternalToken(copy, action)
      ? '查看此选项的当前效果。'
      : copy;
  }
  switch (action.event.action.type) {
    case 'hub/select-panel':
      return `前往${HUB_PANEL_PLAYER_LABELS[action.event.action.panel]}；不会执行兑换或养成。`;
    case 'hub/select-catalog-entry':
      return `浏览${HUB_PANEL_PLAYER_LABELS[action.event.action.panel]}目录；不会执行兑换或养成。`;
    case 'entry/select-dungeon':
      return '仅调整挑战章节；确认入场前不会生成本局命数。';
    case 'entry/select-protocol':
      return '仅调整探索协议；确认入场前不会生成本局命数。';
    case 'entry/set-inferno-tier':
      return '仅调整炼狱层级；确认入场前不会生成本局命数。';
    case 'entry/select-route-contract':
      return '仅调整路线契约；确认入场前不会生成本局命数。';
    case 'entry/select-relic-seed':
      return '仅调整归档种子；确认入场前不会生成本局命数。';
    case 'hub/set-equipment-commission-draft':
      return '仅调整封存委托选择；启动前不会生效。';
    case 'entry/request-enter':
      return '确认后生成并保存本局命数，随后进入所选副本。';
    case 'help/open':
      return '打开完整帮助。';
    case 'help/close':
      return '关闭完整帮助。';
    case 'combat/set-advanced-expanded':
      return '调整进阶战术显示。';
  }
}

export function formatInfiniteFlowHubActionLabel(action: ViewActionModel): string {
  if (
    action.event?.kind === 'local'
    && action.event.action.type === 'hub/select-panel'
  ) return `前往${HUB_PANEL_PLAYER_LABELS[action.event.action.panel]}`;
  const rawLabel = action.label?.trim() ?? '';
  if (hubCopyContainsInternalToken(rawLabel, action)) {
    return hubLocalActionFallbackLabel(action);
  }
  const label = formatInfiniteFlowHubPlayerCopy(action.label, '未命名选项');
  if (
    action.event?.kind === 'local'
    && action.event.action.type === 'entry/select-relic-seed'
  ) {
    const seedLabel = label.includes('归档种子')
      ? label
      : label.replace(/种子/gu, '归档种子');
    return hubCopyContainsInternalToken(seedLabel, action)
      ? hubLocalActionFallbackLabel(action)
      : seedLabel;
  }
  return hubCopyContainsInternalToken(label, action)
    ? hubLocalActionFallbackLabel(action)
    : label;
}

export type InfiniteFlowExploreResultActionPhase = 'explore' | 'result';

function compactActionMachineTokens(action: ViewActionModel): readonly string[] {
  const tokens = [action.actionId];
  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      tokens.push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (value === null || typeof value !== 'object') return;
    for (const childValue of Object.values(value)) visit(childValue);
  };
  if (action.event?.kind === 'command') visit(action.event.command);
  if (action.event?.kind === 'local') visit(action.event.action);
  return Object.freeze(Array.from(new Set(tokens.filter((token) => token.length > 1))));
}

const COMPACT_ACTION_MACHINE_COPY = /(?:[a-z][a-z0-9]*)(?:[._/:=-][a-z0-9]+)+|\b(?:undefined|unknown|legacy|pending|archived|skipped|lost|stable|warning|danger|neutral|recommended|secondary|high-risk|resolved|locked|active|completed|failed|disabled|primary|preparation|advanced|counter|stabilize|charge|flowVersion|v\d+)\b/iu;

function compactActionPlayerCopy(
  source: string | undefined,
  action: ViewActionModel,
  fallback: string,
): string {
  const copy = source?.trim();
  if (copy === undefined || copy.length === 0) return fallback;
  if (COMPACT_ACTION_MACHINE_COPY.test(copy)) return fallback;
  return compactActionMachineTokens(action).some((token) => copy.includes(token))
    ? fallback
    : copy;
}

export function classifyInfiniteFlowExploreResultActionGlyph(
  phase: InfiniteFlowExploreResultActionPhase,
  action: ViewActionModel,
): string {
  if (phase === 'result') {
    if (action.event?.kind === 'command') {
      const command = action.event.command;
      if (command.type === 'result/archive-relic') {
        return command.relicId === undefined ? '略' : '档';
      }
      if (command.type === 'result/return-hub') return '归';
    }
    if (action.actionId === 'result.archive-relic:skip') return '略';
    if (action.actionId.startsWith('result.archive-relic:')) return '档';
    if (action.actionId === 'result.return-hub') return '归';
    return '结';
  }
  if (action.event?.kind === 'command') {
    const command = action.event.command;
    if (command.type === 'run/move') return '路';
    if (command.type === 'node/resolve-equipment-loot') return '装';
    if (command.type === 'node/resolve-relic-draft') return '响';
    if (
      command.type === 'node/resolve-soul-recharge'
      || command.type === 'node/cancel-soul-recharge'
      || command.type === 'node/use-soul-skill'
      || command.type === 'node/activate-soul-recharge'
    ) return '魂';
    if (command.type === 'node/resolve-event') return '遇';
    if (command.type === 'node/resolve-field-survey') return '勘';
    if (command.type.startsWith('law/')) return '律';
    if (command.type === 'run/select-node' || command.type === 'combat/act') return '战';
    if (command.type === 'node/handle-trap') return '解';
    if (command.type === 'node/use-portal') return '门';
    if (command.type === 'node/collect-reward') return '获';
    if (command.type === 'run/resolve-exit') return '出';
    if (command.type === 'combat/use-method-technique') return '诀';
    if (command.type === 'run/retreat') return '退';
  }
  if (action.actionId.startsWith('map.move:')) return '路';
  if (action.actionId.startsWith('pending.equipment:')) return '装';
  if (action.actionId.startsWith('pending.relic:')) return '响';
  if (
    action.actionId.startsWith('pending.soul-recharge:')
    || action.actionId.startsWith('soul-recharge.activate:')
    || action.actionId.startsWith('soul-skill:')
  ) return '魂';
  if (action.actionId.startsWith('pending.event:')) return '遇';
  if (action.actionId.startsWith('pending.field-survey:')) return '勘';
  if (action.actionId.startsWith('law.')) return '律';
  if (action.actionId.startsWith('node.select:')) return '战';
  if (action.actionId.startsWith('node.trap:')) return '解';
  if (action.actionId.startsWith('node.portal:')) return '门';
  if (action.actionId.startsWith('node.reward:')) return '获';
  if (action.actionId.startsWith('node.exit:')) return '出';
  if (action.actionId.startsWith('combat.method:')) return '诀';
  if (action.actionId === 'run.retreat') return '退';
  return '•';
}

function compactActionFallbackLabel(
  phase: InfiniteFlowExploreResultActionPhase,
  action: ViewActionModel,
): string {
  if (action.event?.kind !== 'command') {
    return phase === 'result' ? '结算选项' : '探索选项';
  }
  const command = action.event.command;
  if (phase === 'result') {
    if (command.type === 'result/archive-relic') {
      return command.relicId === undefined ? '跳过回响归档' : '归档回响';
    }
    if (command.type === 'result/return-hub') return '返回主神空间';
    return '结算选项';
  }
  if (command.type === 'run/move') return '选择相邻路线';
  if (command.type === 'node/resolve-equipment-loot') {
    return command.equipmentId === undefined ? '放弃本次装备' : '选择一件装备';
  }
  if (command.type === 'node/resolve-relic-draft') return '选择回响遗物';
  if (command.type === 'node/resolve-soul-recharge') return '恢复器魂能力';
  if (command.type === 'node/cancel-soul-recharge') return '取消器魂共鸣';
  if (command.type === 'node/use-soul-skill') return '施展器魂能力';
  if (command.type === 'node/activate-soul-recharge') return '开启器魂共鸣';
  if (command.type === 'node/resolve-event') return '处理当前遭遇';
  if (command.type === 'node/resolve-field-survey') return '选择铭刻分支';
  if (command.type.startsWith('law/')) return '选择章规处理方式';
  if (command.type === 'run/select-node' || command.type === 'combat/act') return '迎战当前敌人';
  if (command.type === 'node/handle-trap') return '处理当前陷阱';
  if (command.type === 'node/use-portal') return '处理当前传送门';
  if (command.type === 'node/collect-reward') return '领取当前奖励';
  if (command.type === 'run/resolve-exit') return '出口结算';
  if (command.type === 'combat/use-method-technique') return '施展功法技';
  if (command.type === 'run/retreat') return '撤回主神空间';
  return '探索选项';
}

function compactActionFallbackSummary(
  phase: InfiniteFlowExploreResultActionPhase,
  action: ViewActionModel,
): string {
  if (action.event?.kind !== 'command') {
    return phase === 'result' ? '确认当前结算选项。' : '确认当前探索选项。';
  }
  const command = action.event.command;
  if (phase === 'result') {
    if (command.type === 'result/archive-relic') {
      return command.relicId === undefined
        ? '放弃本次回响归档。'
        : '将所选回响收入归档。';
    }
    if (command.type === 'result/return-hub') return '返回主神空间。';
    return '确认当前结算选项。';
  }
  if (command.type === 'run/move') return '前往可达的相邻区域。';
  if (command.type === 'node/resolve-equipment-loot') return '处理本次装备掉落。';
  if (command.type === 'node/resolve-relic-draft') return '选择一件本局回响后继续。';
  if (
    command.type === 'node/resolve-soul-recharge'
    || command.type === 'node/cancel-soul-recharge'
    || command.type === 'node/use-soul-skill'
    || command.type === 'node/activate-soul-recharge'
  ) return '调整当前器魂能力。';
  if (command.type === 'node/resolve-event') return '选择当前遭遇的处理方式。';
  if (command.type === 'node/resolve-field-survey') return '选择铭刻分支或普通领取。';
  if (command.type.startsWith('law/')) return '选择当前章规的处理方式。';
  if (command.type === 'run/select-node' || command.type === 'combat/act') return '进入当前战斗。';
  if (command.type === 'node/handle-trap') return '选择陷阱的通过方式。';
  if (command.type === 'node/use-portal') return '选择传送门的通过方式。';
  if (command.type === 'node/collect-reward') return '收取当前节点奖励。';
  if (command.type === 'run/resolve-exit') return '结束探索并进入结算。';
  if (command.type === 'combat/use-method-technique') return '施展当前功法技。';
  if (command.type === 'run/retreat') return '结束本轮探索并按撤退规则结算。';
  return '确认当前探索选项。';
}

export function formatInfiniteFlowExploreResultActionLabel(
  phase: InfiniteFlowExploreResultActionPhase,
  action: ViewActionModel,
): string {
  return compactActionPlayerCopy(
    action.label,
    action,
    compactActionFallbackLabel(phase, action),
  );
}

export function formatInfiniteFlowExploreResultActionSummary(
  phase: InfiniteFlowExploreResultActionPhase,
  action: ViewActionModel,
): string {
  return compactActionPlayerCopy(
    action.riskReason ?? action.readout,
    action,
    compactActionFallbackSummary(phase, action),
  );
}

const HUB_CONTROL_PANELS = Object.freeze(
  Object.keys(HUB_PANEL_ACTION_GLYPHS) as HubPanel[],
);

function isInfiniteFlowHubControlPanel(panel: string): panel is HubPanel {
  return HUB_CONTROL_PANELS.includes(panel as HubPanel);
}

function hubPanelActionGlyph(panel: string): string {
  return Object.prototype.hasOwnProperty.call(HUB_PANEL_ACTION_GLYPHS, panel)
    ? HUB_PANEL_ACTION_GLYPHS[panel as keyof typeof HUB_PANEL_ACTION_GLYPHS]
    : '•';
}

export function classifyInfiniteFlowHubActionGlyph(action: ViewActionModel): string {
  if (
    action.event?.kind === 'local'
    && action.event.action.type === 'hub/select-panel'
  ) {
    return hubPanelActionGlyph(action.event.action.panel);
  }
  if (action.actionId.startsWith('hub.panel:')) {
    return hubPanelActionGlyph(action.actionId.slice('hub.panel:'.length));
  }
  if (action.actionId.endsWith(':previous')) return '‹';
  if (action.actionId.endsWith(':next')) return '›';
  if (action.actionId === 'hub.entry.confirm') return '门';
  if (action.actionId.startsWith('hub.entry.dungeon:')) return '境';
  if (action.actionId.startsWith('hub.entry.protocol:')) return '协';
  if (action.actionId.startsWith('hub.entry.inferno-tier:')) return '炼';
  if (action.actionId.startsWith('hub.entry.route-contract:')) return '契';
  if (action.actionId.startsWith('hub.entry.relic-seed:')) return '种';
  if (action.actionId.startsWith('hub.relic-frame:')) return '响';
  if (action.actionId.startsWith('hub.supplies.buy:')) return '购';
  if (action.actionId.startsWith('hub.supplies.toggle:')) return '携';
  if (action.actionId.startsWith('hub.loadout.')) return '组';
  if (action.actionId === 'hub.recover') return '愈';
  if (action.actionId.startsWith('hub.equipment.buy:')) return '购';
  if (action.actionId.startsWith('hub.equipment.equip:')) return '装';
  if (action.actionId.startsWith('hub.equipment.upgrade:')) return '升';
  if (action.actionId.startsWith('hub.equipment.attune:')) return '铭';
  if (action.actionId.startsWith('hub.equipment.temper:')) return '炼';
  if (action.actionId.startsWith('hub.equipment.commission.')) return '封';
  if (action.actionId.startsWith('hub.equipment.memory.')) return '忆';
  if (action.actionId.startsWith('hub.pets.buy:')) return '契';
  if (action.actionId.startsWith('hub.pets.upgrade:')) return '育';
  if (action.actionId.startsWith('hub.pets.activate:')) return '战';
  if (action.actionId.startsWith('hub.methods.learn:')) return '学';
  if (action.actionId.startsWith('hub.methods.upgrade:')) return '研';
  if (action.actionId.startsWith('hub.methods.activate:')) return '修';
  if (action.actionId.startsWith('hub.bloodlines.unlock:')) return '醒';
  if (action.actionId.startsWith('hub.bloodlines.upgrade:')) return '升';
  if (action.actionId.startsWith('hub.bloodlines.activate:')) return '血';
  if (action.actionId.startsWith('hub.companions.recruit:')) return '募';
  if (action.actionId.startsWith('hub.companions.upgrade:')) return '训';
  if (action.actionId.startsWith('hub.companions.activate:')) return '伴';
  if (action.actionId.startsWith('hub.tasks.claim:')) return '领';
  if (action.actionId === 'hub.tasks.empty') return '空';
  return '•';
}

function combatActionGlyph(action: ViewActionModel): string {
  if (action.combatAction !== undefined) {
    return COMBAT_ACTION_GLYPHS[action.combatAction] ?? '战';
  }
  if (action.actionId.startsWith('combat.capture:')) return '缚';
  if (
    action.actionId === 'run.retreat'
    || action.actionId.startsWith('combat.retreat')
  ) return '退';
  return action.placement === 'advanced' ? '诀' : '战';
}

function actionReachabilityPriority(action: ViewActionModel): number {
  if (!action.enabled) return 100;
  if (action.placement === 'primary') return 0;
  if (action.recommendation === 'recommended') return 1;
  if (
    action.placement === 'node'
    || action.placement === 'combat'
    || action.placement === 'result'
  ) return 2;
  if (action.placement === 'map') return 3;
  if (action.placement === 'preparation') return 4;
  return 5;
}

/** Exported for headless reachability/order audits; the deck never re-sorts in place. */
export function orderActionsForCompactReachability(
  actions: readonly ViewActionModel[],
): readonly ViewActionModel[] {
  return actions
    .map((action, index) => ({ action, index }))
    .sort((left, right) => {
      const priority = actionReachabilityPriority(left.action)
        - actionReachabilityPriority(right.action);
      return priority === 0 ? left.index - right.index : priority;
    })
    .map(({ action }) => action);
}

function detailLine(detail: PhaseDetailViewModel): string {
  if (detail.kind === 'hub') {
    return formatInfiniteFlowHubPlayerCopy(
      `${detail.activePanelLabel} · ${detail.panelSummary}`,
      '主神空间 · 当前状态待确认。',
    );
  }
  if (detail.kind === 'explore') {
    return `${detail.currentNode.title} · ${detail.currentNode.nodeType} · ${
      detail.currentNode.cleared ? '已清理' : '待处理'
    }`;
  }
  if (detail.kind === 'combat') {
    return `第 ${detail.turn} 回合 · ${detail.intent.name}`;
  }
  return `${detail.dungeonName ?? '副本'} · ${detail.relicArchiveStatus}`;
}

export function formatInfiniteFlowEntryBuildDetail(
  detail: Extract<PhaseDetailViewModel, { kind: 'hub' }>,
): string | undefined {
  if (detail.activePanel !== 'entry') return undefined;
  const route = detail.entryBuild.routeContract.options.find(({ selected }) => selected);
  const seed = detail.entryBuild.relic.seedOptions.find(({ selected }) => selected);
  const seedName = seed?.seedRelicId === null
    ? '不携带'
    : hubEntityName(seed?.name, seed?.seedRelicId, '未知遗物');
  const relicLine = `${detail.entryBuild.relic.frameName}回响 ${detail.entryBuild.relic.candidateReadout} 候选 · 归档种子 ${seedName}`;
  if (!detail.entryBuild.routeContract.selectionValid) {
    return `契约异常：${detail.entryBuild.routeContract.issue ?? '所选契约不属于当前副本'}\n${relicLine}`;
  }
  const orderedTargets = route?.orderedTargets
    .map(({ order, nodeTitle }) => `${order} ${nodeTitle}`)
    .join(' → ');
  const routeLine = `契约 ${route?.name ?? '不接契约'}${orderedTargets ? ` · ${orderedTargets}` : ''}${route && route.rewardPoints > 0 ? ` · +${route.rewardPoints} 点` : ''}`;
  return `${routeLine}\n${relicLine}`;
}

export type InfiniteFlowEquipmentFeatureReadout = Readonly<{
  title: string;
  summary: string;
  detail: string;
}>;

export type InfiniteFlowEquipmentCommissionReadout =
  InfiniteFlowEquipmentFeatureReadout;

/** Stable, pure readout shared by the Creator renderer and headless checks. */
export function formatInfiniteFlowEquipmentCommissionDetail(
  commission:
    | EquipmentCommissionDetailViewModel
    | EquipmentCommissionSettlementViewModel,
): InfiniteFlowEquipmentCommissionReadout {
  if ('draft' in commission) {
    if (commission.status === 'active' && commission.active !== undefined) {
      const completedDungeons = commission.active.completedDungeonNames.length === 0
        ? '尚无'
        : commission.active.completedDungeonNames.join('、');
      const equipmentNames = commission.active.equipmentNames.map((name, index) => (
        hubEntityName(name, commission.active?.equipmentIds[index], '未知装备')
      ));
      const targetMaterialName = hubEntityName(
        commission.active.targetMaterialName,
        commission.active.targetMaterialId,
        '未知材料',
      );
      return Object.freeze({
        title: '封存委托 · 进行中',
        summary: `${equipmentNames.join(' + ')} · 目标 ${targetMaterialName} x${commission.materialReward}`,
        detail: `不同副本 ${commission.active.completedCount}/${commission.requiredDungeonCount}：${completedDungeons}；还需 ${commission.active.remainingCount} 个 · ${commission.active.recallLossReadout}`,
      });
    }

    const selectedNames = commission.draft.equipmentIds.map((equipmentId) => (
      hubEntityName(
        commission.candidates.find((candidate) => candidate.equipmentId === equipmentId)?.name,
        equipmentId,
        '未知装备',
      )
    ));
    const targetMaterial = commission.draft.targetMaterialId === null
      ? '未选择'
      : hubEntityName(
          commission.materialOptions.find(
            (option) => option.materialId === commission.draft.targetMaterialId,
          )?.materialName,
          commission.draft.targetMaterialId,
          '未知材料',
        );
    const cost = commission.cost.map(({ label, required, held, gap }) => (
      `${label} ${held}/${required}${gap > 0 ? `（缺 ${gap}）` : ''}`
    )).join(' · ');
    const readiness = commission.start?.enabled === true
      ? '可启动'
      : formatInfiniteFlowHubPlayerCopy(
          commission.start?.disabledReason,
          '待补全',
        );
    return Object.freeze({
      title: commission.status === 'idle'
        ? '封存委托 · 待选择'
        : '封存委托 · 草稿',
      summary: `装备 ${selectedNames.length}/2：${selectedNames.join(' + ') || '未选择'} · 材料 ${targetMaterial}`,
      detail: `${cost || '无需额外消耗'} · 不同副本 0/${commission.requiredDungeonCount} 后得材料 x${commission.materialReward} · ${readiness}`,
    });
  }

  const completedDungeons = commission.completedDungeonNames.length === 0
    ? '尚无'
    : commission.completedDungeonNames.join('、');
  const reward = commission.status === 'completed'
    ? `${commission.targetMaterialName} x${commission.rewardAmount}`
    : `目标 ${commission.targetMaterialName}`;
  return Object.freeze({
    title: commission.status === 'completed'
      ? '封存委托 · 已完成'
      : '封存委托 · 已推进',
    summary: `${commission.dungeonName} · ${commission.equipmentNames.join(' + ')} · ${reward}`,
    detail: `不同副本 ${commission.completedCount}/${commission.requiredDungeonCount}：${completedDungeons}；还需 ${commission.remainingCount} 个 · ${commission.rewardReadout}`,
  });
}

export function formatInfiniteFlowEquipmentMemoryLibrary(
  memory: EquipmentMemoryLibraryViewModel,
): InfiniteFlowEquipmentFeatureReadout {
  const support = memory.supported ? '支持' : '不支持';
  const ownership = memory.owned ? '已拥有' : '未拥有';
  const equipped = memory.equipped ? '已装备' : '未装备';
  const unlocked = memory.unlocked ? '已解锁' : '未解锁';
  const active = memory.active
    ? `已激活 ${hubEntityName(
        memory.activeMemory?.name,
        memory.activeMemory?.memoryId,
        '未知记忆',
      )}`
    : '未激活';
  const cycle = memory.cycle.enabled
    ? `下一项 ${hubEntityName(
        memory.cycle.nextMemoryName,
        memory.cycle.nextMemoryId,
        '未知记忆',
      )}`
    : formatInfiniteFlowHubPlayerCopy(
        memory.cycle.disabledReason,
        '当前不可切换',
      );
  return Object.freeze({
    title: `装备记忆 · ${support} · ${ownership} · ${equipped}`,
    summary: `${hubEntityName(memory.equipmentName, memory.equipmentId, '未知装备')} · ${unlocked} ${memory.unlockedCount} · ${active}`,
    detail: `${formatInfiniteFlowHubPlayerCopy(memory.acquisitionReadout)} · ${cycle}`,
  });
}

export function formatInfiniteFlowEquipmentMemoryHunt(
  hunt: EquipmentMemoryHuntViewModel,
): InfiniteFlowEquipmentFeatureReadout {
  const compatibility = hunt.compatibility === 'current-legacy-hunt'
    ? '本局旧版任务'
    : hunt.compatibility === 'imported-legacy-hunt'
      ? '继承旧版任务'
      : '任务数据异常';
  const targetIds = hunt.signals.map(({ targetId }) => targetId);
  const playerTarget = (label: string): string => {
    let projected = label;
    for (const targetId of targetIds) projected = projected.split(targetId).join('');
    projected = projected
      .replace(/(?:节点|事件)\s*ID\s*[·:：-]?\s*/giu, '')
      .replace(/[\s·:：-]+$/u, '')
      .trim();
    return projected.length > 0 ? projected : '目标已标记';
  };
  const playerDetail = playerTarget(
    hunt.display.detail
      .replace(/\blegacy\b/giu, '旧版')
      .replace(/\bunknown\b/giu, '未知'),
  );
  const signals = hunt.signals.length === 0
    ? '双信号不可用'
    : hunt.signals.map((signal) => (
      `${signal.completed ? '✓' : '·'}${signal.label} ${playerTarget(signal.targetName)}`
    )).join('；');
  const failureLabels: Readonly<Record<string, string>> = Object.freeze({
    event_failure: '目标事件失败',
    incomplete_exit: '条件未完成即离开',
    retreat: '主动撤退',
    failure: '探索失败',
    cross_dungeon: '进入了其他副本',
  });
  const failure = hunt.failureReason === undefined
    ? playerDetail
    : `任务异常：${failureLabels[hunt.failureReason] ?? '任务数据异常'} · ${playerDetail}`;
  return Object.freeze({
    title: `装备记忆狩猎 · ${hunt.display.label} · ${compatibility}`,
    summary: `${hunt.memory?.name ?? '未知记忆'} · ${hunt.equipment?.name ?? '未知装备'} · 双信号 ${hunt.completedConditionCount}/${hunt.totalConditionCount}：${signals}`,
    detail: `下一目标 ${playerTarget(hunt.nextTarget.label)} · 冻结铭刻 ${hunt.frozenAttunement?.name ?? '不可用'} · ${failure}`,
  });
}

export function formatInfiniteFlowExploreEquipmentMemory(
  detail: Pick<
    Extract<PhaseDetailViewModel, { kind: 'explore' }>,
    'equipmentMemoryHunt'
  >,
): InfiniteFlowEquipmentFeatureReadout | undefined {
  return detail.equipmentMemoryHunt === undefined
    ? undefined
    : formatInfiniteFlowEquipmentMemoryHunt(detail.equipmentMemoryHunt);
}

export type InfiniteFlowChapterSectionKind =
  | 'law'
  | 'directive'
  | 'route'
  | 'pressure'
  | 'pursuit';

export type InfiniteFlowChapterSectionReadout = Readonly<{
  kind: InfiniteFlowChapterSectionKind;
  title: string;
  /** Exact core help ID when one exists; route contract has none and uses `note` instead. */
  helpId?: 'law' | 'directive' | 'pressure' | 'pursuit';
  /** Ordered, undefined-free player lines copied from VM fields only. */
  lines: readonly string[];
  /** VM-provided explanatory copy for concepts without a help ID. */
  note?: string;
}>;

export type InfiniteFlowChapterDecisionReadout = Readonly<{
  dungeonId: string;
  dungeonName: string;
  sections: readonly InfiniteFlowChapterSectionReadout[];
}>;

const CHAPTER_SECTION_TITLES = Object.freeze({
  law: '场域法则',
  directive: '主神指令',
  route: '路线契约',
  pressure: '侵蚀段位',
  pursuit: '破界追兵',
} as const satisfies Record<InfiniteFlowChapterSectionKind, string>);

const CHAPTER_LAW_SEVERITY_LABELS: Readonly<Record<ChapterLawCardViewModel['severity'], string>> = Object.freeze({
  stable: '稳定',
  warning: '警戒',
  danger: '危险',
  resolved: '已解除',
});

const CHAPTER_DIRECTIVE_STATUS_LABELS: Readonly<Record<ChapterDirectiveViewModel['status'], string>> = Object.freeze({
  locked: '未解锁',
  active: '进行中',
  completed: '已完成',
  failed: '已失败',
});

const CHAPTER_PRESSURE_TIER_LABELS: Readonly<Record<NonNullable<ChapterPressureViewModel['tier']>, string>> = Object.freeze({
  stable: '稳定',
  hunted: '追猎',
  breach: '破界',
});

const CHAPTER_PURSUIT_STATUS_LABELS: Readonly<Record<NonNullable<ChapterPursuitViewModel['status']>, string>> = Object.freeze({
  disabled: '未启用',
  dormant: '潜伏',
  stalking: '追猎中',
  contained: '已封锁',
  fused: '已融合',
  repelled: '已击退',
});

const CHAPTER_ROUTE_REASON_LABELS: Readonly<Record<string, string>> = Object.freeze({
  out_of_order: '未按契约顺序完成',
  incomplete_exit: '条件未完成即离开',
  retreat: '主动撤退',
  failure: '探索失败',
  cross_dungeon: '进入了其他副本',
});

const CHAPTER_PURSUIT_REPELLED_REASON_LABELS: Readonly<Record<string, string>> = Object.freeze({
  stable_portal: '稳定出口已封锁追兵',
  successful_exit: '成功离开副本',
  retreat: '主动撤退',
  failure: '探索失败',
});

function signedPercent(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

export function formatInfiniteFlowChapterLaw(
  law: ChapterLawCardViewModel,
): InfiniteFlowChapterSectionReadout {
  if (!law.present) {
    return Object.freeze({
      kind: 'law',
      title: CHAPTER_SECTION_TITLES.law,
      helpId: 'law',
      lines: Object.freeze([`${law.title} · ${law.status || '本轮未记录场域律'}`]),
    });
  }
  const modifiers = law.modifiers;
  const lines = [
    `${law.title} · ${law.status}`,
    `严重度 ${CHAPTER_LAW_SEVERITY_LABELS[law.severity]} · 目标 ${law.targetReached ? '已达成' : '未达成'}${
      law.meter === undefined ? '' : ` · 计量 ${law.meter.value}/${law.meter.max}`
    }`,
    `遭遇 全属性${signedPercent(modifiers.encounter.allStatsPercent)}% 防御${signedPercent(modifiers.encounter.defensePercent)}% 术攻${signedPercent(modifiers.encounter.artPowerPercent)}%`,
    `陷阱 伤害${signedPercent(modifiers.trap.damagePercent)}% 检定${signedPercent(modifiers.trap.dcPercent)}% · 治疗${signedPercent(modifiers.healingPercent)}%`,
    `出伤 武力${signedPercent(modifiers.outgoingDamage.forcePercent)}% 术法${signedPercent(modifiers.outgoingDamage.artPercent)}% · 守御${signedPercent(modifiers.guardEffectPercent)}%`,
  ];
  return Object.freeze({
    kind: 'law',
    title: CHAPTER_SECTION_TITLES.law,
    helpId: 'law',
    lines: Object.freeze(lines),
  });
}

export function formatInfiniteFlowChapterDirective(
  directive: ChapterDirectiveViewModel,
): InfiniteFlowChapterSectionReadout {
  const lines = [
    `状态 ${CHAPTER_DIRECTIVE_STATUS_LABELS[directive.status]} · ${directive.progressText}`,
    ...directive.objectives.map((objective) => (
      `${objective.completed ? '✓' : '·'} ${objective.label} · ${objective.progressText}`
    )),
    `奖励 ${directive.rewardPreview}`,
  ];
  return Object.freeze({
    kind: 'directive',
    title: CHAPTER_SECTION_TITLES.directive,
    helpId: 'directive',
    lines: Object.freeze(lines),
  });
}

export function formatInfiniteFlowChapterRouteContract(
  route: ChapterRouteContractViewModel,
): InfiniteFlowChapterSectionReadout {
  const playerTarget = (nodeTitle: string, nodeId: string): string => {
    const projected = nodeTitle.split(nodeId).join('').replace(/[\s·:：-]+$/u, '').trim();
    return projected.length > 0 ? projected : '目标已标记';
  };
  const targetLine = route.orderedTargets.length === 0
    ? '目标 未接契约'
    : route.orderedTargets
      .map((target) => `${target.order} ${playerTarget(target.nodeTitle, target.nodeId)}`)
      .join(' → ');
  const reason = route.reason === undefined
    ? undefined
    : CHAPTER_ROUTE_REASON_LABELS[route.reason] ?? '原因未知';
  const lines = [
    `状态 ${route.display.label}`,
    `进度 ${route.completedReadout}${route.name === undefined ? '' : ` · ${route.name}`}`,
    targetLine,
    route.nextTarget === undefined
      ? `潜在 +${route.potentialRewardPoints} 点 · 下一目标 无`
      : `下一目标 ${route.nextTarget.order} ${playerTarget(route.nextTarget.nodeTitle, route.nextTarget.nodeId)} · 潜在 +${route.potentialRewardPoints} 点`,
    `已存 +${route.bankedRewardPoints} 点${reason === undefined ? '' : ` · 原因 ${reason}`}`,
  ];
  return Object.freeze({
    kind: 'route',
    title: CHAPTER_SECTION_TITLES.route,
    // No core help ID exists for route contracts: surface the VM explanation instead.
    note: route.display.detail,
    lines: Object.freeze(lines),
  });
}

export function formatInfiniteFlowChapterPressure(
  pressure: ChapterPressureViewModel,
): InfiniteFlowChapterSectionReadout {
  const rawLabel = pressure.label?.trim();
  const playerTierLabel = rawLabel !== undefined
    && rawLabel.length > 0
    && !Object.prototype.hasOwnProperty.call(CHAPTER_PRESSURE_TIER_LABELS, rawLabel)
    ? rawLabel.replace(/\bunknown\b/giu, '未知')
    : pressure.tier === undefined
      ? '未知'
      : CHAPTER_PRESSURE_TIER_LABELS[pressure.tier];
  const pressurePercent = pressure.pressurePercent === undefined
    ? '未知'
    : `${pressure.pressurePercent}%`;
  const rewardBonusPercent = pressure.rewardBonusPercent === undefined
    ? '未知'
    : `+${pressure.rewardBonusPercent}%`;
  const lines = pressure.present
    ? [
        `段位 ${playerTierLabel}`,
        `侵蚀 ${pressurePercent} · 出口加成 ${rewardBonusPercent}`,
        `下一段位 ${
          pressure.nextTierAt === undefined
            ? '未知'
            : pressure.nextTierAt === null
            ? '无'
            : `${pressure.nextTierAt} 节点`
        }`,
      ]
    : [`状态 ${pressure.legacyDisabled ? '旧档禁用' : '未提供'}`];
  return Object.freeze({
    kind: 'pressure',
    title: CHAPTER_SECTION_TITLES.pressure,
    helpId: 'pressure',
    lines: Object.freeze(lines),
  });
}

export function formatInfiniteFlowChapterPursuit(
  pursuit: ChapterPursuitViewModel,
): InfiniteFlowChapterSectionReadout {
  const progress = pursuit.progress;
  const rawStatusLabel = pursuit.statusLabel?.trim();
  const statusLabel = rawStatusLabel !== undefined
    && rawStatusLabel.length > 0
    && !Object.prototype.hasOwnProperty.call(CHAPTER_PURSUIT_STATUS_LABELS, rawStatusLabel)
    ? rawStatusLabel.replace(/\bunknown\b/giu, '未知')
    : pursuit.status === undefined
      ? '未知'
      : CHAPTER_PURSUIT_STATUS_LABELS[pursuit.status];
  const playerDescription = (pursuit.statusDescription ?? pursuit.flavorDescription ?? '状态描述未提供')
    .replace(/\bunknown\b/giu, '未知');
  const contactDamage = pursuit.contactDamagePercent === undefined
    ? '未知'
    : `${pursuit.contactDamagePercent}%`;
  const bossFusion = pursuit.bossFusionPercent === undefined
    ? '未知'
    : `${pursuit.bossFusionPercent}%`;
  const reward = pursuit.rewardAmount === undefined ? '未知' : `${pursuit.rewardAmount}`;
  const lines = pursuit.present
    ? [
        `${pursuit.name ?? '未知追兵'} · 状态 ${statusLabel}`,
        playerDescription,
        progress === undefined
          ? '进度未提供'
          : `活跃 ${progress.active ? '是' : '否'} · 接触 ${progress.contacts} · 宽限 ${progress.graceMoves} · 清理 ${progress.clearedNodeCount}/${progress.spawnClearCount} · 余 ${progress.clearsRemaining}`,
        `接触伤害 ${contactDamage} · 首领融合 ${bossFusion} · 奖励 ${reward}`,
        progress === undefined
          ? '位置未提供'
          : progress.repelledReason !== null
            ? `原因 ${CHAPTER_PURSUIT_REPELLED_REASON_LABELS[progress.repelledReason] ?? '未知'}`
            : progress.currentNodeId !== null
              ? '追兵位置已锁定'
              : `距苏醒 ${progress.clearsRemaining} 节点`,
      ]
    : [`状态 ${pursuit.legacyDisabled ? '旧档禁用' : '本章无追兵'}`];
  return Object.freeze({
    kind: 'pursuit',
    title: CHAPTER_SECTION_TITLES.pursuit,
    helpId: 'pursuit',
    lines: Object.freeze(lines),
  });
}

/**
 * Compact one-to-two-line combat chapter context. Built only from the detached
 * `CombatChapterContextViewModel`; the Cocos layer never recomputes law modifiers
 * or pursuit rules. The full semantics stay in the existing law/pursuit help deck.
 */
export type InfiniteFlowCombatChapterContextReadout = Readonly<{
  lawLine: string;
  pursuitLine?: string;
}>;

export function formatInfiniteFlowCombatChapterContext(
  context: CombatChapterContextViewModel,
): InfiniteFlowCombatChapterContextReadout {
  const law = context.law;
  const m = law.modifiers;
  const meterText = law.meter === undefined ? '' : ` ${law.meter.value}/${law.meter.max}`;
  const enemyText = m.enemyAllStatsPercent !== 0
    ? ` 敌${signedPercent(m.enemyAllStatsPercent)}%`
    : '';
  const outgoingText = m.outgoingForcePercent !== 0 || m.outgoingArtPercent !== 0
    ? ` 我${signedPercent(m.outgoingForcePercent)}%/${signedPercent(m.outgoingArtPercent)}%`
    : '';
  const lawLine = law.present
    ? `场域 ${law.title} ${law.status}${meterText}${enemyText}${outgoingText}`
    : `场域 ${law.title} ${law.status}`;
  const pursuit = context.pursuit;
  const pursuitActive = pursuit.present
    && pursuit.status !== undefined
    && pursuit.status !== 'disabled'
    && pursuit.status !== 'dormant';
  const pursuitLine = pursuitActive
    ? `追兵 ${pursuit.name ?? '未知'} ${pursuit.statusLabel ?? pursuit.status ?? ''} · 接触${pursuit.contactDamagePercent ?? 0}%${pursuit.status === 'fused' ? ` · 融合${pursuit.bossFusionPercent ?? 0}%` : ''}`
    : undefined;
  return Object.freeze({
    lawLine,
    ...(pursuitLine === undefined ? {} : { pursuitLine }),
  });
}

/**
 * The five ordered player-facing decision surfaces. Every line is built from
 * `ExploreDetail.chapterDecision` fields only; the Cocos layer never recomputes
 * domain rules and never invents hidden clauses.
 */
export function formatInfiniteFlowChapterDecision(
  decision: ChapterDecisionViewModel,
): InfiniteFlowChapterDecisionReadout {
  return Object.freeze({
    dungeonId: decision.dungeonId,
    dungeonName: decision.dungeonName,
    sections: Object.freeze([
      formatInfiniteFlowChapterLaw(decision.law),
      formatInfiniteFlowChapterDirective(decision.directive),
      formatInfiniteFlowChapterRouteContract(decision.routeContract),
      formatInfiniteFlowChapterPressure(decision.pressure),
      formatInfiniteFlowChapterPursuit(decision.pursuit),
    ]),
  });
}

export function formatInfiniteFlowEquipmentMemoryCombat(
  memory: EquipmentMemoryCombatViewModel,
): InfiniteFlowEquipmentFeatureReadout {
  const status = memory.status === 'active'
    ? `激活 ${memory.activeName ?? memory.memoryId ?? '未知记忆'}`
    : memory.status === 'legacy-disabled'
      ? 'legacy fail-closed'
      : '格式故障 fail-closed';
  const matching = memory.matchingEquipmentNames.length === 0
    ? '无匹配装备'
    : `匹配装备 ${memory.matchingEquipmentNames.join('、')}`;
  const overflow = memory.overflowState === 'stored'
    ? 'overflow 已储存'
    : memory.overflowState === 'restored'
      ? 'overflow 已恢复'
      : 'overflow 空';
  return Object.freeze({
    title: `装备记忆 · ${status}`,
    summary: matching,
    detail: memory.disabledReason === undefined
      ? overflow
      : `${overflow} · ${memory.disabledReason}`,
  });
}

export function formatInfiniteFlowEquipmentMemoryResult(
  memory: EquipmentMemoryResultViewModel,
): InfiniteFlowEquipmentFeatureReadout {
  const legacy = memory.legacyHunt;
  const modern = memory.modernLibrary;
  const legacySummary = legacy === undefined
    ? undefined
    : `legacy ${legacy.displayLabel} · ${legacy.equipmentName} · ${legacy.memoryName} · ${legacy.granted ? '已收录' : '未收录'}`;
  const legacyDetail = legacy === undefined
    ? undefined
    : `${legacy.displayDetail} · ${legacy.rewardReadout}`;
  const modernSummary = modern === undefined
    ? undefined
    : modern.status === 'active'
      ? `本章已收录并激活「${modern.memoryName}」`
      : modern.status === 'recorded'
        ? `本章已收录「${modern.memoryName}」`
        : `本章尚未收录「${modern.memoryName}」`;
  const modernDetail = modern === undefined
    ? undefined
    : `收录装备 ${modern.recordedEquipmentNames.join('、') || '无'} · 激活装备 ${modern.activeEquipmentNames.join('、') || '无'}`;
  return Object.freeze({
    title: legacy !== undefined && modern !== undefined
      ? '装备记忆 · legacy 结算 / 现代记忆库'
      : legacy !== undefined
        ? '装备记忆 · legacy 结算'
        : '装备记忆 · 现代记忆库',
    summary: [legacySummary, modernSummary].filter((value) => value !== undefined).join('；'),
    detail: [legacyDetail, modernDetail].filter((value) => value !== undefined).join('\n'),
  });
}

export type InfiniteFlowEquipmentHubReadout = Readonly<{
  commission?: InfiniteFlowEquipmentFeatureReadout;
  memory?: InfiniteFlowEquipmentFeatureReadout;
}>;

export function formatInfiniteFlowEquipmentHubDetail(
  detail: Pick<
    Extract<PhaseDetailViewModel, { kind: 'hub' }>,
    'equipmentCommission' | 'equipmentMemory'
  >,
): InfiniteFlowEquipmentHubReadout {
  return Object.freeze({
    ...(detail.equipmentCommission === undefined
      ? {}
      : {
          commission: formatInfiniteFlowEquipmentCommissionDetail(
            detail.equipmentCommission,
          ),
        }),
    ...(detail.equipmentMemory === undefined
      ? {}
      : { memory: formatInfiniteFlowEquipmentMemoryLibrary(detail.equipmentMemory) }),
  });
}

export function formatInfiniteFlowResultEquipmentDetail(
  detail: Pick<
    Extract<PhaseDetailViewModel, { kind: 'result' }>,
    'equipmentCommissionSettlement' | 'equipmentMemory'
  >,
): InfiniteFlowEquipmentHubReadout {
  return Object.freeze({
    ...(detail.equipmentCommissionSettlement === undefined
      ? {}
      : {
          commission: formatInfiniteFlowEquipmentCommissionDetail(
            detail.equipmentCommissionSettlement,
          ),
        }),
    ...(detail.equipmentMemory === undefined
      ? {}
      : { memory: formatInfiniteFlowEquipmentMemoryResult(detail.equipmentMemory) }),
  });
}

export type InfiniteFlowResultSettlementReadout = Readonly<{
  sections: readonly {
    readonly id: string;
    readonly title: string;
    readonly lines: readonly string[];
  }[];
}>;

const RESULT_SETTLEMENT_TITLES = Object.freeze({
  loot: '装备状态 / 掉落',
  equipmentRoll: '装备铭刻',
  protocol: '协议结算',
  directive: '主神指令',
  routeContract: '路线契约',
  pressure: '侵蚀压力',
  pursuit: '破界追兵',
} as const);

export function formatInfiniteFlowResultSettlement(
  detail: Pick<
    Extract<PhaseDetailViewModel, { kind: 'result' }>,
    | 'lootSettlement'
    | 'equipmentRollSettlement'
    | 'protocolSettlement'
    | 'directiveSettlement'
    | 'routeContractSettlement'
    | 'pressureSettlement'
    | 'pursuitSettlement'
  >,
): InfiniteFlowResultSettlementReadout {
  const sections: { id: string; title: string; lines: string[] }[] = [];

  if (detail.lootSettlement) {
    const loot = detail.lootSettlement;
    if (loot.state === 'valid') {
      sections.push({
        id: 'loot',
        title: RESULT_SETTLEMENT_TITLES.loot,
        lines: [
          `带回 奖励点+${loot.retainedRewardPoints} 灵蕴+${loot.retainedLingyun}`,
          `物品 ${loot.retainedItemCount} 件 · 装备 ${loot.retainedEquipmentCount} 件`,
          ...(loot.retainedEquipmentNames.length > 0
            ? [`装备 ${loot.retainedEquipmentNames.join('、')}`]
            : []),
          ...(loot.lostRewardPoints > 0 || loot.lostLingyun > 0 || loot.lostItemCount > 0 || loot.lostEquipmentCount > 0
            ? [
                `失去 奖励点${loot.lostRewardPoints} 灵蕴${loot.lostLingyun}`,
                `物品 ${loot.lostItemCount} 件 · 装备 ${loot.lostEquipmentCount} 件`,
                ...(loot.lostEquipmentNames.length > 0
                  ? [`失去装备 ${loot.lostEquipmentNames.join('、')}`]
                  : []),
              ]
            : ['无失去']),
        ],
      });
    } else {
      sections.push({
        id: 'loot',
        title: RESULT_SETTLEMENT_TITLES.loot,
        lines: [loot.diagnostic],
      });
    }
  }

  if (detail.equipmentRollSettlement) {
    const roll = detail.equipmentRollSettlement;
    if (roll.state === 'valid') {
      sections.push({
        id: 'equipmentRoll',
        title: RESULT_SETTLEMENT_TITLES.equipmentRoll,
        lines: [
          `${roll.equipmentName} · ${roll.outcomeLabel}`,
          ...(roll.previousItemPower !== undefined
            ? [`前物品强度 ${roll.previousItemPower}`]
            : []),
          ...(roll.salvageRewardPoints > 0
            ? [`分解 +${roll.salvageRewardPoints} 点`]
            : []),
        ],
      });
    } else {
      sections.push({
        id: 'equipmentRoll',
        title: RESULT_SETTLEMENT_TITLES.equipmentRoll,
        lines: [roll.diagnostic],
      });
    }
  }

  if (detail.protocolSettlement) {
    const protocol = detail.protocolSettlement;
    if (protocol.state === 'valid') {
      sections.push({
        id: 'protocol',
        title: RESULT_SETTLEMENT_TITLES.protocol,
        lines: [
          `${protocol.protocolName} · ${protocol.statusLabel}`,
          `Boss ${protocol.bossDefeated ? '已击败' : '未击败'}`,
          `基础 +${protocol.baseRewardPoints} · 协议 +${protocol.protocolRewardPoints} · 加成 +${protocol.rewardPointBonus}`,
          ...(protocol.cycleImprintGranted ? ['轮回刻印已授予'] : []),
          ...(protocol.materialRewardName
            ? [`材料 ${protocol.materialRewardName} x${protocol.materialRewardAmount}`]
            : []),
        ],
      });
    } else {
      sections.push({
        id: 'protocol',
        title: RESULT_SETTLEMENT_TITLES.protocol,
        lines: [protocol.diagnostic],
      });
    }
  }

  if (detail.directiveSettlement) {
    const directive = detail.directiveSettlement;
    if (directive.state === 'valid') {
      sections.push({
        id: 'directive',
        title: RESULT_SETTLEMENT_TITLES.directive,
        lines: [
          `状态 ${directive.statusLabel} · ${directive.progressText}`,
          ...directive.objectives.map((objective) =>
            `${objective.completed ? '✓' : '·'} ${objective.label} · ${objective.progressText}`,
          ),
          `奖励 ${directive.rewardPreview}`,
        ],
      });
    } else {
      sections.push({
        id: 'directive',
        title: RESULT_SETTLEMENT_TITLES.directive,
        lines: [directive.diagnostic],
      });
    }
  }

  if (detail.routeContractSettlement) {
    const route = detail.routeContractSettlement;
    if (route.state === 'valid') {
      sections.push({
        id: 'routeContract',
        title: RESULT_SETTLEMENT_TITLES.routeContract,
        lines: [
          `${route.contractName} · ${route.statusLabel}`,
          `进度 ${route.completedTargetCount}/${route.totalTargetCount}`,
          `奖励 +${route.rewardPoints} 点 · ${route.rewarded ? '已发放' : '未发放'}`,
          ...(route.reasonLabel ? [`原因 ${route.reasonLabel}`] : []),
        ],
      });
    } else {
      sections.push({
        id: 'routeContract',
        title: RESULT_SETTLEMENT_TITLES.routeContract,
        lines: [route.diagnostic],
      });
    }
  }

  if (detail.pressureSettlement) {
    const pressure = detail.pressureSettlement;
    if (pressure.state === 'valid') {
      sections.push({
        id: 'pressure',
        title: RESULT_SETTLEMENT_TITLES.pressure,
        lines: [
          `段位 ${pressure.tierLabel} · 奖励加成 +${pressure.rewardPointBonus}%`,
        ],
      });
    } else {
      sections.push({
        id: 'pressure',
        title: RESULT_SETTLEMENT_TITLES.pressure,
        lines: [pressure.diagnostic],
      });
    }
  }

  if (detail.pursuitSettlement) {
    const pursuit = detail.pursuitSettlement;
    if (pursuit.state === 'valid') {
      sections.push({
        id: 'pursuit',
        title: RESULT_SETTLEMENT_TITLES.pursuit,
        lines: [
          `${pursuit.name} · ${pursuit.reasonLabel}`,
          pursuit.rewarded && pursuit.materialName
            ? `奖励 ${pursuit.materialName}`
            : '无奖励',
        ],
      });
    } else {
      sections.push({
        id: 'pursuit',
        title: RESULT_SETTLEMENT_TITLES.pursuit,
        lines: [pursuit.diagnostic],
      });
    }
  }

  return Object.freeze({
    sections: Object.freeze(sections.map((section) => Object.freeze(section))),
  });
}

// ---- Result pager: deterministic text wrapping and safe readouts ----

const RESULT_PAGER_CONTENT_WIDTH = 470;
const RESULT_PAGER_MAX_TEXT_UNITS = 36;
const RESULT_PAGER_MAX_VISIBLE_LINES = 6;
const RESULT_PAGER_TEXT_WRAP = Object.freeze({
  maxUnitsPerLine: RESULT_PAGER_MAX_TEXT_UNITS,
  maxLinesPerPage: RESULT_PAGER_MAX_VISIBLE_LINES,
});

export type InfiniteFlowTextWrapOptions = Readonly<{
  /** Width budget in CJK em units; narrow (ASCII) glyphs count as 0.55. */
  maxUnitsPerLine: number;
  /** Display lines per subpage; overflow starts a stable continuation subpage. */
  maxLinesPerPage: number;
}>;

function isWideCodePoint(codePoint: number): boolean {
  return (codePoint >= 0x1100 && codePoint <= 0x115F)
    || (codePoint >= 0x2E80 && codePoint <= 0x303E)
    || (codePoint >= 0x3041 && codePoint <= 0x33FF)
    || (codePoint >= 0x3400 && codePoint <= 0x4DBF)
    || (codePoint >= 0x4E00 && codePoint <= 0x9FFF)
    || (codePoint >= 0xA000 && codePoint <= 0xA4CF)
    || (codePoint >= 0xAC00 && codePoint <= 0xD7A3)
    || (codePoint >= 0xF900 && codePoint <= 0xFAFF)
    || (codePoint >= 0xFE30 && codePoint <= 0xFE4F)
    || (codePoint >= 0xFF00 && codePoint <= 0xFF60)
    || (codePoint >= 0xFFE0 && codePoint <= 0xFFE6)
    || (codePoint >= 0x1F300 && codePoint <= 0x1FAFF);
}

function textUnitWidth(codePoint: number): number {
  return isWideCodePoint(codePoint) ? 1 : 0.55;
}

/**
 * Breaks one logical line into display lines no wider than `maxUnits` without
 * dropping glyphs. Pure and deterministic: the same line always wraps at the
 * same boundaries.
 */
export function wrapInfiniteFlowLine(line: string, maxUnits: number): readonly string[] {
  const wrapped: string[] = [];
  let current = '';
  let currentUnits = 0;
  for (const char of line) {
    const units = textUnitWidth(char.codePointAt(0) ?? 0);
    if (current.length > 0 && currentUnits + units > maxUnits) {
      wrapped.push(current);
      current = char;
      currentUnits = units;
    } else {
      current += char;
      currentUnits += units;
    }
  }
  wrapped.push(current);
  return wrapped;
}

/**
 * Wraps every logical line (splitting on '\n' first) and slices the result
 * into stable subpages of at most `maxLinesPerPage` display lines. The pager
 * relies on this instead of Label SHRINK so long Chinese/ASCII copy can never
 * overflow or overlap.
 */
export function paginateInfiniteFlowText(
  lines: readonly string[],
  options: InfiniteFlowTextWrapOptions,
): readonly (readonly string[])[] {
  const pages: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    for (const logicalLine of line.split('\n')) {
      for (const wrappedLine of wrapInfiniteFlowLine(logicalLine, options.maxUnitsPerLine)) {
        if (current.length >= options.maxLinesPerPage) {
          pages.push(current);
          current = [];
        }
        current.push(wrappedLine);
      }
    }
  }
  if (current.length > 0) pages.push(current);
  return pages;
}

const CHAPTER_CODEX_TEXT_WRAP = Object.freeze({
  maxUnitsPerLine: 17,
  maxLinesPerPage: 12,
});

export type InfiniteFlowChapterCodexPage = Readonly<{
  source: 'equipment-memory' | InfiniteFlowChapterSectionKind;
  title: string;
  lines: readonly string[];
  helpId?: 'equipmentMemory' | 'law' | 'directive' | 'pressure' | 'pursuit';
  continuation: number;
  continuationCount: number;
}>;

/**
 * Stable player-facing codex order. Typical content is exactly five pages, or
 * six with equipment memory; only genuinely long text adds continuation pages.
 */
export function buildInfiniteFlowChapterCodexPages(
  detail: Extract<PhaseDetailViewModel, { kind: 'explore' }>,
): readonly InfiniteFlowChapterCodexPage[] {
  if (detail.chapterDecision === undefined) return Object.freeze([]);
  const logicalSections: Readonly<{
    source: InfiniteFlowChapterCodexPage['source'];
    title: string;
    lines: readonly string[];
    helpId?: InfiniteFlowChapterCodexPage['helpId'];
  }>[] = [];
  const memory = formatInfiniteFlowExploreEquipmentMemory(detail);
  if (memory !== undefined) {
    const memoryHelpId = detail.equipmentMemoryHunt?.helpId;
    logicalSections.push(Object.freeze({
      source: 'equipment-memory',
      title: memory.title,
      lines: Object.freeze([memory.summary, memory.detail]),
      ...(memoryHelpId === undefined ? {} : { helpId: memoryHelpId }),
    }));
  }
  const decision = formatInfiniteFlowChapterDecision(detail.chapterDecision);
  for (const section of decision.sections) {
    logicalSections.push(Object.freeze({
      source: section.kind,
      title: section.title,
      lines: Object.freeze([
        ...section.lines,
        ...(section.note === undefined ? [] : [`章规说明：${section.note}`]),
      ]),
      ...(section.helpId === undefined ? {} : { helpId: section.helpId }),
    }));
  }

  const pages: InfiniteFlowChapterCodexPage[] = [];
  for (const section of logicalSections) {
    const textPages = paginateInfiniteFlowText(section.lines, CHAPTER_CODEX_TEXT_WRAP);
    const stablePages = textPages.length > 0 ? textPages : [Object.freeze(['内容未提供'])];
    for (let index = 0; index < stablePages.length; index += 1) {
      pages.push(Object.freeze({
        source: section.source,
        title: section.title,
        lines: Object.freeze([...(stablePages[index] ?? [])]),
        ...(section.helpId === undefined ? {} : { helpId: section.helpId }),
        continuation: index + 1,
        continuationCount: stablePages.length,
      }));
    }
  }
  return Object.freeze(pages);
}

function chapterCodexSignature(pages: readonly InfiniteFlowChapterCodexPage[]): string {
  return pages.map((page) => (
    `${page.source}\u001d${page.helpId ?? ''}\u001d${page.title}\u001d${page.continuation}/${page.continuationCount}\u001d${page.lines.join('\u001c')}`
  )).join('\u001e');
}

const RESULT_OUTCOME_LABELS: Readonly<Record<string, string>> = Object.freeze({
  clean_clear: '完美通关',
  normal_clear: '通关',
  retreat: '主动撤退',
  failed_recovered: '失败后回收',
});

/**
 * Reduces the core `lastOutcome` machine string to a short Chinese label.
 * Unknown or missing outcome values degrade to a neutral label; raw
 * `key=value` tokens never reach the UI through this path.
 */
export function formatInfiniteFlowOutcomeSummary(outcome: string): string {
  const match = /outcome=([a-z_]+)/.exec(outcome);
  if (match === null) return '本轮已结算';
  return RESULT_OUTCOME_LABELS[match[1] ?? ''] ?? '本轮已结算';
}

/**
 * Passes already-safe outcome copy through unchanged; replaces a core
 * machine string with its Chinese summary so status chips never leak
 * `outcome=`/`score=`/`multiplier=`/`reward=` tokens.
 */
export function formatInfiniteFlowOutcomeMetric(value: string): string {
  if (!/[a-zA-Z][a-zA-Z0-9_]*=/.test(value)) return value;
  return formatInfiniteFlowOutcomeSummary(value);
}

const RESULT_ARCHIVE_STATUS_LABELS: Readonly<
  Record<ResultDetailViewModel['relicArchiveStatus'], string>
> = Object.freeze({
  none: '无回响',
  pending: '待归档',
  archived: '已归档',
  skipped: '已跳过',
  lost: '已遗失',
});

const RESULT_ARCHIVE_ALTAR_STATE: Readonly<Record<
  ResultDetailViewModel['relicArchiveStatus'],
  Readonly<{ symbol: string; label: string; severity: StatusMetric['severity'] }>
>> = Object.freeze({
  none: Object.freeze({ symbol: '·', label: '无回响', severity: 'neutral' }),
  pending: Object.freeze({ symbol: '!', label: '待归档', severity: 'warning' }),
  archived: Object.freeze({ symbol: '✓', label: '已归档', severity: 'positive' }),
  skipped: Object.freeze({ symbol: '—', label: '已跳过', severity: 'neutral' }),
  lost: Object.freeze({ symbol: '×', label: '已遗失', severity: 'danger' }),
});

export type InfiniteFlowResultAltarMetric = Readonly<{
  id: string;
  symbol: string;
  label: string;
  value: string;
  severity: StatusMetric['severity'];
}>;

export type InfiniteFlowResultAltarLoot =
  | Readonly<{
      state: 'valid';
      retained: string;
      loss?: string;
    }>
  | Readonly<{
      state: 'invalid';
      diagnostic: string;
    }>
  | Readonly<{
      state: 'missing';
    }>;

export type InfiniteFlowResultAltarReadout = Readonly<{
  outcome: string;
  metrics: readonly InfiniteFlowResultAltarMetric[];
  loot: InfiniteFlowResultAltarLoot;
}>;

/** Pure result-overview readout: projection values are reformatted, never recalculated. */
export function formatInfiniteFlowResultAltar(
  detail: Pick<ResultDetailViewModel, 'outcome' | 'relicArchiveStatus' | 'lootSettlement'>,
  statusMetrics: readonly StatusMetric[],
): InfiniteFlowResultAltarReadout {
  const projected = statusMetrics.slice(0, 6);
  const outcomeMetric = projected.find(({ id }) => id === 'outcome');
  const archiveState = RESULT_ARCHIVE_ALTAR_STATE[detail.relicArchiveStatus];
  let archiveSeen = false;
  const metrics: InfiniteFlowResultAltarMetric[] = [];
  for (const metric of projected) {
    if (metric.id === 'outcome') continue;
    if (metric.id === 'relic-archive') {
      archiveSeen = true;
      metrics.push(Object.freeze({
        id: metric.id,
        symbol: archiveState.symbol,
        label: metric.label,
        value: archiveState.label,
        severity: archiveState.severity,
      }));
      continue;
    }
    metrics.push(Object.freeze({
      id: metric.id,
      symbol: metric.symbol,
      label: metric.label,
      value: metric.value,
      severity: metric.severity,
    }));
  }
  if (!archiveSeen) {
    if (metrics.length >= 6) metrics.pop();
    metrics.push(Object.freeze({
      id: 'relic-archive',
      symbol: archiveState.symbol,
      label: '回响归档',
      value: archiveState.label,
      severity: archiveState.severity,
    }));
  }

  const loot = detail.lootSettlement;
  let lootReadout: InfiniteFlowResultAltarLoot;
  if (loot === undefined) {
    lootReadout = Object.freeze({ state: 'missing' });
  } else if (loot.state === 'invalid') {
    lootReadout = Object.freeze({ state: 'invalid', diagnostic: loot.diagnostic });
  } else {
    const hasLoss = loot.lostRewardPoints > 0
      || loot.lostLingyun > 0
      || loot.lostItemCount > 0
      || loot.lostEquipmentCount > 0;
    lootReadout = Object.freeze({
      state: 'valid',
      retained: `带回 点 ${loot.retainedRewardPoints} · 蕴 ${loot.retainedLingyun} · 物 ${loot.retainedItemCount} · 装 ${loot.retainedEquipmentCount}`,
      ...(hasLoss
        ? { loss: `失去 点 ${loot.lostRewardPoints} · 蕴 ${loot.lostLingyun} · 物 ${loot.lostItemCount} · 装 ${loot.lostEquipmentCount}` }
        : {}),
    });
  }

  return Object.freeze({
    outcome: formatInfiniteFlowOutcomeMetric(outcomeMetric?.value ?? detail.outcome),
    metrics: Object.freeze(metrics),
    loot: lootReadout,
  });
}

export type InfiniteFlowResultOverviewReadout = Readonly<{
  title: string;
  lines: readonly string[];
}>;

/**
 * Builds the always-present result overview page from presentation VM fields
 * plus a sanitized translation of the core `lastOutcome` machine string.
 * Only known machine fields are extracted and rephrased in Chinese, and the
 * core-authored Chinese prefix is surfaced only when it carries no machine
 * tokens of its own.
 */
export function formatInfiniteFlowResultOverview(
  detail: Readonly<{
    dungeonName?: string;
    outcome: string;
    relicArchiveStatus: ResultDetailViewModel['relicArchiveStatus'];
  }>,
): InfiniteFlowResultOverviewReadout {
  const lines: string[] = [];
  if (detail.dungeonName !== undefined && detail.dungeonName.length > 0) {
    lines.push(`${detail.dungeonName} · 结算`);
  }
  const outcome = detail.outcome;
  const machineIndex = outcome.indexOf('outcome=');
  if (machineIndex > 0) {
    const prefix = outcome.slice(0, machineIndex).trim();
    if (prefix.length > 0 && !/[a-zA-Z][a-zA-Z0-9_]*=|;/.test(prefix)) {
      lines.push(prefix);
    }
  }
  lines.push(`结果：${formatInfiniteFlowOutcomeSummary(outcome)}`);
  const score = /score=(\d+)/.exec(outcome);
  const multiplier = /multiplier=([\d.]+)x?/.exec(outcome);
  const reward = /reward=(\d+)/.exec(outcome);
  if (score !== null || multiplier !== null || reward !== null) {
    const economy: string[] = [];
    if (score !== null) economy.push(`评分 ${score[1] ?? ''}`);
    if (multiplier !== null) economy.push(`倍率 ${multiplier[1] ?? ''}x`);
    if (reward !== null) economy.push(`出口奖励点 ${reward[1] ?? ''}`);
    lines.push(economy.join(' · '));
  }
  lines.push(`回响归档 · ${RESULT_ARCHIVE_STATUS_LABELS[detail.relicArchiveStatus]}`);
  lines.push('左右翻页查看归档、掉落、委托、记忆与各项结算。');
  return Object.freeze({
    title: '结果总览',
    lines: Object.freeze(lines),
  });
}

export type InfiniteFlowResultEchoReadout = Readonly<{
  title: string;
  lines: readonly string[];
}>;

/**
 * Explains the relic-archive state and which archive/return actions the
 * existing action deck currently offers. The actions themselves stay in the
 * deck; this page only narrates their context.
 */
export function formatInfiniteFlowResultEchoArchive(
  detail: Pick<ResultDetailViewModel, 'relicArchiveStatus'>,
): InfiniteFlowResultEchoReadout {
  if (detail.relicArchiveStatus === 'pending') {
    return Object.freeze({
      title: '回响归档 · 待归档',
      lines: Object.freeze([
        '本回合获得的回响可选择一件作为下轮种子。',
        '动作区：归档一件回响（推荐），或跳过回响归档。',
        '完成归档或跳过之后，才能返回主神空间。',
      ]),
    });
  }
  if (detail.relicArchiveStatus === 'archived') {
    return Object.freeze({
      title: '回响归档 · 已归档',
      lines: Object.freeze([
        '已选择一件回响作为下轮种子。',
        '动作区：返回主神空间。',
      ]),
    });
  }
  if (detail.relicArchiveStatus === 'skipped') {
    return Object.freeze({
      title: '回响归档 · 已跳过',
      lines: Object.freeze([
        '本回合未归档回响，下轮种子保持原样。',
        '动作区：返回主神空间。',
      ]),
    });
  }
  if (detail.relicArchiveStatus === 'lost') {
    return Object.freeze({
      title: '回响归档 · 已遗失',
      lines: Object.freeze([
        '本回合的回响在结算中遗失，无法归档。',
        '动作区：返回主神空间。',
      ]),
    });
  }
  return Object.freeze({
    title: '回响归档 · 无回响',
    lines: Object.freeze([
      '本回合没有可归档的回响。',
      '动作区：返回主神空间。',
    ]),
  });
}

export type InfiniteFlowResultPage = Readonly<{
  id: string;
  title: string;
  lines: readonly string[];
}>;

/**
 * The stable result pager order: overview, echo archive, equipment
 * status/drops, equipment commission, equipment memory, then the remaining
 * settlement cards (equipment roll, protocol, directive, route contract,
 * pressure, pursuit). Pages without data are omitted; the overview and echo
 * pages are always present.
 */
export function buildInfiniteFlowResultPages(
  detail: Extract<PhaseDetailViewModel, { kind: 'result' }>,
): readonly InfiniteFlowResultPage[] {
  const pages: InfiniteFlowResultPage[] = [];
  const overview = formatInfiniteFlowResultOverview(detail);
  pages.push(Object.freeze({ id: 'overview', title: overview.title, lines: overview.lines }));
  const echo = formatInfiniteFlowResultEchoArchive(detail);
  pages.push(Object.freeze({ id: 'echo', title: echo.title, lines: echo.lines }));

  const settlement = formatInfiniteFlowResultSettlement(detail);
  const sectionById = new Map(settlement.sections.map((section) => [section.id, section]));
  const pushSettlement = (id: string): void => {
    const section = sectionById.get(id);
    if (section === undefined) return;
    pages.push(Object.freeze({ id, title: section.title, lines: section.lines }));
  };

  pushSettlement('loot');

  const equipment = formatInfiniteFlowResultEquipmentDetail(detail);
  if (equipment.commission !== undefined) {
    pages.push(Object.freeze({
      id: 'commission',
      title: '装备封存委托',
      lines: Object.freeze([
        equipment.commission.title,
        equipment.commission.summary,
        equipment.commission.detail,
      ]),
    }));
  }
  if (equipment.memory !== undefined) {
    pages.push(Object.freeze({
      id: 'memory',
      title: '装备记忆',
      lines: Object.freeze([
        equipment.memory.title,
        equipment.memory.summary,
        equipment.memory.detail,
      ]),
    }));
  }

  pushSettlement('equipmentRoll');
  pushSettlement('protocol');
  pushSettlement('directive');
  pushSettlement('routeContract');
  pushSettlement('pressure');
  pushSettlement('pursuit');

  return Object.freeze(pages);
}

/**
 * Purely visual Cocos adapter. It consumes detached presentation view models and
 * never receives the writable domain state.
 */
export class InfiniteFlowView {
  private root: Node | undefined;
  private lastModel: GameViewModel | undefined;
  private lastChrome: InfiniteFlowRuntimeChrome | undefined;
  private lastSafeInsets: InfiniteFlowSafeInsets = INFINITE_FLOW_PREVIEW_SAFE_INSETS;
  private screenKey = '';
  private deckIndex = 0;
  private readonly pageByDeck = [0, 0, 0, 0];
  private chapterDecisionPage = 0;
  private chapterDecisionSignature = '';
  private chapterCodexOpen = false;
  private resultPage = 0;
  private resultPageSignature = '';
  private hubActionSignature = '';
  private exploreDeckMode: 'map' | 'commands' = 'map';
  private exploreMapOrigin: Readonly<{ x: number; y: number }> | undefined;
  private exploreMapCurrentCoordinate = '';
  private destroyed = false;
  private physicalSequence = 0;
  private visualFrame: SpriteFrame | undefined;
  private visualTexture: Asset | undefined;
  private readonly visualSprites = new Set<Sprite>();
  private visualStatus: InfiniteFlowVisualAssetStatus | undefined;
  private visualSourceWidth: number | undefined;
  private visualSourceHeight: number | undefined;
  private readonly sceneVisuals = new Map<string, {
    frame: SpriteFrame;
    texture: Asset;
    width: number;
    height: number;
    frames?: readonly SpriteFrame[];
  }>();
  private detailsOpen = false;
  private scenePage = 0;
  private sceneMapOrigin: Readonly<{ x: number; y: number }> | undefined;
  private sceneMapCurrentCoordinate = '';
  private sceneCombatSnapshot: { enemyId: string; playerHp: number; enemyHp: number } | undefined;
  private sceneFeedback: { text: string; damage?: number } | undefined;
  private walkScene: WalkSceneHandle | undefined;
  private walkInput: InfiniteFlowWalkInput | undefined;
  private walkWorldKey = '';
  private walkPosition: WorldPoint | undefined;
  private mobileSheet: MobileSheetState | undefined;
  private mobileRoomKey = '';
  private mobilePendingKey = '';
  private mobileNodeCleared = false;
  private surfaceHeight = DESIGN_HEIGHT;

  constructor(
    private readonly canvas: Node,
    private readonly delegate: InfiniteFlowViewDelegate,
  ) {}

  /**
   * The Canvas widget stretches to the visible fixed-width design surface. Prefer
   * its live size (tracks window/device rotation); fall back to the frame ratio in
   * contexts where the widget has not aligned yet.
   */
  private measureSurfaceHeight(): number {
    const canvasHeight = this.canvas.getComponent?.(UITransform)?.contentSize.height;
    if (canvasHeight !== undefined && canvasHeight > 0 && Number.isFinite(canvasHeight)) {
      return Math.max(DESIGN_HEIGHT, canvasHeight);
    }
    const frame = view.getFrameSize();
    return frame.width > 0
      ? Math.max(DESIGN_HEIGHT, DESIGN_WIDTH * frame.height / frame.width)
      : DESIGN_HEIGHT;
  }

  render(
    model: GameViewModel | undefined,
    chrome: InfiniteFlowRuntimeChrome,
    safeInsets: InfiniteFlowSafeInsets,
  ): void {
    if (this.destroyed) return;
    if (this.mobileSheet) this.mobileSheet = captureInfiniteFlowInfoSheetState(this.root, this.mobileSheet);
    this.stopWalking();
    this.lastModel = model;
    this.lastChrome = chrome;
    this.lastSafeInsets = safeInsets;
    const nextScreenKey = model === undefined ? chrome.modeKind : `${model.phase}:${model.screenTitle}`;
    if (nextScreenKey !== this.screenKey) {
      this.mobileSheet = undefined;
      if (this.walkWorldKey !== '') this.detailsOpen = false;
      this.screenKey = nextScreenKey;
      this.deckIndex = 0;
      this.pageByDeck.fill(0);
      this.chapterDecisionPage = 0;
      this.chapterDecisionSignature = '';
      this.chapterCodexOpen = false;
      this.resultPage = 0;
      this.hubActionSignature = '';
      this.exploreDeckMode = 'map';
      this.exploreMapOrigin = undefined;
      this.exploreMapCurrentCoordinate = '';
      this.scenePage = 0;
      this.sceneMapOrigin = undefined;
      this.sceneMapCurrentCoordinate = '';
      this.sceneCombatSnapshot = undefined;
      this.sceneFeedback = undefined;
    }

    const mobileDetail = model?.sections[1].detail;
    const roomKey = mobileDetail?.kind === 'explore'
      ? `${mobileDetail.map.dungeonId}:${mobileDetail.currentNode.nodeId}` : model?.phase ?? '';
    const pendingKey = mobileDetail?.kind === 'explore' && mobileDetail.pending !== undefined
      ? JSON.stringify(mobileDetail.pending) : '';
    const nodeCleared = mobileDetail?.kind === 'explore' && mobileDetail.currentNode.cleared;
    if (this.mobileSheet?.kind === 'interaction') {
      if (roomKey !== this.mobileRoomKey || (this.mobilePendingKey !== '' && pendingKey === '')
        || (!this.mobileNodeCleared && nodeCleared && (pendingKey === ''
          || (mobileDetail?.kind === 'explore' && mobileDetail.pending?.kind === 'dungeon-event')))) {
        this.mobileSheet = undefined;
      } else if (pendingKey !== this.mobilePendingKey) {
        this.mobileSheet = { kind: 'interaction', page: 0 };
      }
    }
    this.mobileRoomKey = roomKey;
    this.mobilePendingKey = pendingKey;
    this.mobileNodeCleared = nodeCleared;

    this.detachVisualSprites();
    this.root?.destroy();
    this.surfaceHeight = this.measureSurfaceHeight();
    const root = addNode(this.canvas, 'InfiniteFlowRuntimeView', 0, 0, DESIGN_WIDTH, this.surfaceHeight);
    this.root = root;
    this.fitWithinCanvas();
    addPanel(root, 'Backdrop', 0, 0, DESIGN_WIDTH, this.surfaceHeight, {
      fill: PALETTE.background,
      stroke: PALETTE.background,
      radius: 0,
      lineWidth: 0,
    });
    if (model === undefined) {
      this.renderChrome(root, model, chrome);
      this.renderBootOrBlocked(root, chrome);
      return;
    }

    if (this.detailsOpen) {
      this.renderVisualBackdrop(root, model.sections[1].detail.kind);
      this.renderChrome(root, model, chrome);
      this.renderInformationRail(root);
      this.renderObjective(root, model);
      this.renderStatus(root, model, chrome);
      this.renderDeck(root, model, chrome);
      this.renderFooter(root);
    } else {
      this.renderScene(root, model, chrome);
    }

    const phaseDetail = model.sections[1].detail;
    if (phaseDetail.kind !== 'explore' || phaseDetail.chapterDecision === undefined) {
      this.chapterCodexOpen = false;
      this.chapterDecisionPage = 0;
      this.chapterDecisionSignature = '';
    }

    if (chrome.modeKind === 'blocked' && chrome.blockingMessage !== undefined) {
      const blocker = addPanel(root, 'RuntimeBlockedOverlay', 0, 0, DESIGN_WIDTH, this.surfaceHeight, {
        fill: PALETTE.backgroundOpaque,
        stroke: PALETTE.backgroundOpaque,
        lineWidth: 0,
        radius: 0,
      });
      blocker.addComponent(BlockInputEvents);
      this.renderBootOrBlocked(blocker, chrome);
      return;
    }

    if (this.mobileSheet !== undefined && !this.detailsOpen) {
      const isCurrent = (): boolean => this.root === root && !this.destroyed;
      const enabled = chrome.busyActionId === undefined && chrome.modeKind !== 'blocked';
      renderInfiniteFlowInfoSheet(root, model, this.mobileSheet, {
        safeInsets,
        surfaceHeight: this.surfaceHeight,
        chrome,
        bindLocal: (node, callback) => this.bindPhysical(node, enabled, () => {
          if (isCurrent()) callback();
        }),
        bindAction: (node, action) => {
          const event = action.event;
          if (event === undefined) return;
          this.bindPhysical(node, enabled && action.enabled, (physicalId) => {
            if (!isCurrent()) return;
            if (node.name.startsWith('MobileSheetShopAction:') && this.mobileSheet) {
              this.mobileSheet = { ...captureInfiniteFlowInfoSheetState(root, this.mobileSheet),
                selectedActionId: undefined, catalogMoreOpen: false };
            }
            if (node.name.startsWith('MobileSheetEntryDungeon:') && this.mobileSheet) {
              const state = captureInfiniteFlowInfoSheetState(root, this.mobileSheet);
              this.mobileSheet = { ...state, entryView: 'configuration', entryServiceId: undefined,
                entryDungeonScrollOffset: state.catalogScrollOffset ?? 0, catalogScrollOffset: 0 };
            }
            this.delegate.activate(physicalId, action.actionId, event);
          });
        },
        close: () => { this.mobileSheet = undefined; this.renderAgain(); },
        setState: (next) => { this.mobileSheet = next; this.renderAgain(); },
        openHelp: (entry) => {
          this.physicalSequence += 1;
          this.delegate.activate(`cocos-help:${this.physicalSequence}`, entry.openAction.actionId, entry.openAction.event);
        },
        ...(chrome.supplyActions === undefined ? {} : { supplyActions: chrome.supplyActions }),
        ...(chrome.ownedLoadout === undefined ? {} : { ownedLoadout: chrome.ownedLoadout }),
      });
    }

    const help = model.sections[4];
    const detail = phaseDetail;
    if (
      this.chapterCodexOpen
      && detail.kind === 'explore'
      && detail.chapterDecision !== undefined
    ) {
      this.renderChapterCodexOverlay(root, detail, help, chrome);
    }
    if (help.active !== undefined) {
      this.renderHelpOverlay(root, help, chrome, phaseDetail.kind === 'hub');
    }
  }

  destroy(): void {
    const failures: unknown[] = [];
    this.destroyed = true;
    this.stopWalking();
    try {
      this.clearVisualAsset();
    } catch (error) {
      failures.push(error);
    }
    try {
      this.clearSceneVisualAsset();
    } catch (error) {
      failures.push(error);
    }
    try {
      this.root?.destroy();
    } catch (error) {
      failures.push(error);
    }
    this.root = undefined;
    this.lastModel = undefined;
    this.lastChrome = undefined;
    if (failures.length > 0) {
      throw new Error(`InfiniteFlowView cleanup failed (${failures.length})`);
    }
  }

  /** Stores only asset state; render() always creates fresh Sprite nodes. */
  setVisualAsset(
    image: ImageAsset,
    status: InfiniteFlowVisualAssetStatus,
  ): void {
    this.clearVisualAsset();
    const frame = SpriteFrame.createWithImage(image);
    const texture = frame.texture;
    if (texture === null) {
      frame.destroy();
      throw new Error('SpriteFrame.createWithImage produced no texture');
    }
    this.visualFrame = frame;
    this.visualTexture = texture;
    this.visualStatus = status;
    const measurableImage = image as ImageAsset & Readonly<{
      width?: unknown;
      height?: unknown;
    }>;
    this.visualSourceWidth = typeof measurableImage.width === 'number'
      ? measurableImage.width
      : undefined;
    this.visualSourceHeight = typeof measurableImage.height === 'number'
      ? measurableImage.height
      : undefined;
  }

  setVisualAssetFallback(status: InfiniteFlowVisualAssetStatus): void {
    this.clearVisualAsset();
    this.visualStatus = status;
  }

  /** Scene slots share App-owned image leases, but own their frames and textures. */
  setSceneVisualAsset(image: ImageAsset, status: InfiniteFlowVisualAssetStatus): void {
    this.clearSceneVisualAsset(status.key);
    const frame = SpriteFrame.createWithImage(image);
    const texture = frame.texture;
    if (texture === null) {
      frame.destroy();
      throw new Error('Scene SpriteFrame.createWithImage produced no texture');
    }
    this.sceneVisuals.set(status.key, {
      frame,
      texture,
      width: image.width,
      height: image.height,
      ...(status.key === 'character:reincarnator_walk'
        ? { frames: this.makeWalkerFrames(frame, image.width, image.height) }
        : {}),
    });
  }

  private makeWalkerFrames(atlas: SpriteFrame, width: number, height: number): readonly SpriteFrame[] {
    const frames: SpriteFrame[] = [];
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 4; column += 1) {
        const frame = new SpriteFrame();
        frame.texture = atlas.texture;
        frame.rect = new Rect(column * width / 4, row * height / 4, width / 4, height / 4);
        frame.originalSize = new Size(width / 4, height / 4);
        frame.offset = new Vec2(0, 0);
        frame.packable = false;
        frames.push(frame);
      }
    }
    return frames;
  }

  setSceneVisualAssetFallback(status: InfiniteFlowVisualAssetStatus): void {
    // Other loaded slots remain visible; the scene draws the missing role itself.
    this.clearSceneVisualAsset(status.key);
  }

  clearSceneVisualAsset(key?: string): void {
    const failures: unknown[] = [];
    const keys = key === undefined ? Array.from(this.sceneVisuals.keys()) : [key];
    for (const target of keys) {
      const visual = this.sceneVisuals.get(target);
      if (visual === undefined) continue;
      for (const sprite of this.visualSprites) {
        if (sprite.spriteFrame === visual.frame || (sprite.spriteFrame !== null && visual.frames?.includes(sprite.spriteFrame))) {
          sprite.spriteFrame = null;
          this.visualSprites.delete(sprite);
        }
      }
      this.sceneVisuals.delete(target);
      for (const child of visual.frames ?? []) {
        try { child.destroy(); } catch (error) { failures.push(error); }
      }
      try { visual.frame.destroy(); } catch (error) { failures.push(error); }
      try { visual.texture.destroy(); } catch (error) { failures.push(error); }
    }
    if (failures.length > 0) {
      throw new Error(`Scene visual cleanup failed (${failures.length})`);
    }
  }

  openDetails(): void {
    this.detailsOpen = true;
    this.renderAgain();
  }

  private openMobilePanel(kind: MobilePanelKind): void {
    this.mobileSheet = { kind, page: 0 };
    this.renderAgain();
  }

  private fitWithinCanvas(): void {
    const size = this.canvas.getComponent?.(UITransform)?.contentSize;
    if (size === undefined) return;
    // Phones match the 750-wide surface exactly (fixed-width policy); only
    // shorter desktop windows are letterboxed instead of cropping the HUD.
    const scale = Math.min(1, size.width / DESIGN_WIDTH, size.height / this.surfaceHeight);
    this.root?.setScale(new Vec3(scale, scale, 1));
  }

  tick(deltaTime: number): void {
    if (!this.destroyed) {
      const measured = this.measureSurfaceHeight();
      if (Math.abs(measured - this.surfaceHeight) > 0.5) {
        this.renderAgain();
        return;
      }
      this.fitWithinCanvas();
    }
    if (this.destroyed || this.detailsOpen || this.mobileSheet !== undefined || this.lastChrome?.busyActionId !== undefined
      || this.lastChrome?.modeKind === 'blocked' || this.chapterCodexOpen
      || this.lastModel?.sections[4].active !== undefined) return;
    this.walkScene?.tick(deltaTime, this.walkInput?.axis() ?? { x: 0, y: 0 });
  }

  private stopWalking(): void {
    if (this.walkScene !== undefined) this.walkPosition = this.walkScene.getPosition();
    this.walkInput?.dispose();
    this.walkInput = undefined;
    this.walkScene?.dispose();
    this.walkScene = undefined;
  }

  private renderScene(root: Node, model: GameViewModel, chrome: InfiniteFlowRuntimeChrome): void {
    const detail = model.sections[1].detail;
    if (detail.kind === 'explore') {
      const coordinate = `${detail.map.dungeonId}:${detail.map.currentNodeId}`;
      if (coordinate !== this.sceneMapCurrentCoordinate) {
        this.sceneMapOrigin = undefined;
        this.sceneMapCurrentCoordinate = coordinate;
      }
    }
    if (detail.kind === 'combat') {
      const previous = this.sceneCombatSnapshot;
      if (previous !== undefined && previous.enemyId === detail.enemy.id) {
        const damage = previous.enemyHp - detail.enemy.hp;
        const received = previous.playerHp - detail.player.hp;
        if (damage !== 0 || received !== 0) {
          this.sceneFeedback = {
            text: [
              damage > 0 ? `造成 ${damage} 伤害` : damage < 0 ? `敌人恢复 ${-damage}` : '',
              received > 0 ? `承受 ${received} 伤害` : received < 0 ? `恢复 ${-received} 生命` : '',
            ].filter(Boolean).join(' · '),
            ...(damage > 0 ? { damage } : {}),
          };
        }
      }
      this.sceneCombatSnapshot = {
        enemyId: detail.enemy.id,
        playerHp: detail.player.hp,
        enemyHp: detail.enemy.hp,
      };
    }
    const enabled = chrome.busyActionId === undefined && chrome.modeKind !== 'blocked';
    const isCurrent = (): boolean => this.root === root && !this.destroyed;
    const options: InfiniteFlowSceneOptions = {
      safeInsets: this.lastSafeInsets,
      surfaceHeight: this.surfaceHeight,
      chrome,
      visual: (key) => this.sceneVisuals.get(key),
      trackSprite: (sprite) => this.visualSprites.add(sprite),
      bindAction: (node, action) => {
        if (detail.kind === 'combat' && !action.enabled) {
          this.bindPhysical(node, enabled && this.mobileSheet === undefined, () => {
            if (!isCurrent()) return;
            this.mobileSheet = { kind: 'menu', tab: 'actions', page: 0, selectedActionId: action.actionId };
            this.renderAgain();
          });
          return;
        }
        const event = action.event;
        if (event === undefined) return;
        this.bindPhysical(node, enabled && this.mobileSheet === undefined && action.enabled, (physicalId) => {
          if (!isCurrent()) return;
          this.delegate.activate(physicalId, action.actionId, event);
        });
      },
      bindLocal: (node, activate) => {
        this.bindPhysical(node, enabled && this.mobileSheet === undefined, () => { if (isCurrent()) activate(); });
      },
      bindHelp: (node) => {
        const target = model.sections[4].entries[0];
        if (target === undefined) return;
        this.bindPhysical(node, enabled && this.mobileSheet === undefined, (physicalId) => {
          if (!isCurrent()) return;
          this.delegate.activate(physicalId, target.openAction.actionId, target.openAction.event);
        });
      },
      openDetails: () => this.openMobilePanel(detail.kind === 'result' ? 'result' : 'inventory'),
      openCodex: () => this.openMobilePanel('objectives'),
      page: this.scenePage,
      setPage: (page) => { this.scenePage = page; this.renderAgain(); },
      ...(this.sceneMapOrigin === undefined ? {} : { mapOrigin: this.sceneMapOrigin }),
      setMapOrigin: (origin) => { this.sceneMapOrigin = origin; this.renderAgain(); },
      ...(this.sceneFeedback === undefined ? {} : { feedback: this.sceneFeedback }),
    };
    if (detail.kind === 'result') {
      renderInfiniteFlowScene(root, model, options);
      return;
    }
    const spec = buildWalkWorld(model);
    if (this.walkWorldKey !== spec.key) {
      this.walkWorldKey = spec.key;
      this.walkPosition = spec.spawn;
    }
    const interact = (target: WorldTarget | undefined, physicalId: string): void => {
      if (!isCurrent() || !enabled || this.mobileSheet !== undefined || target === undefined) return;
      const action = target.action;
      if (detail.kind === 'hub' && target.kind === 'portal') {
        if (action?.actionId === 'hub.panel:entry' && action.enabled && action.event !== undefined) {
          this.delegate.activate(physicalId, action.actionId, action.event);
        }
        this.openMobilePanel('entry');
        return;
      }
      if (target.kind === 'npc') {
        if (action?.enabled && action.event !== undefined) this.delegate.activate(physicalId, action.actionId, action.event);
        this.openMobilePanel('npc');
        return;
      }
      if (target.disabledReason !== undefined) {
        this.openMobilePanel(target.kind === 'transition' ? 'map' : 'interaction');
        return;
      }
      if (action === undefined) {
        this.openMobilePanel('interaction');
        return;
      }
      if (!action.enabled || action.event === undefined) return;
      if (detail.kind === 'explore' && target.kind !== 'monster' && target.kind !== 'transition') {
        this.openMobilePanel('interaction');
        return;
      }
      // The spatial hotspot only chooses an existing action. The application
      // still owns entry, inventory, encounter, loot and persistence semantics.
      this.delegate.activate(physicalId, action.actionId, action.event);
    };
    const frames = this.sceneVisuals.get('character:reincarnator_walk')?.frames;
    this.walkScene = renderInfiniteFlowWalkScene(root, model, {
      ...options,
      openPanel: (panel) => this.openMobilePanel(panel),
      spec,
      position: this.walkPosition ?? spec.spawn,
      ...(frames === undefined ? {} : { walkerFrames: frames }),
      bindInteract: (node, getTarget) => {
        this.bindPhysical(node, enabled && this.mobileSheet === undefined, (physicalId) => interact(getTarget(), physicalId));
      },
    });
    if (enabled && this.mobileSheet === undefined && !this.chapterCodexOpen && model.sections[4].active === undefined) {
      this.walkInput = new InfiniteFlowWalkInput(this.walkScene.joystick, this.walkScene.joystickThumb, () => {
        if (this.walkScene === undefined) return;
        this.physicalSequence += 1;
        interact(nearestWalkTarget(spec, this.walkScene.getPosition()), `cocos-key:${this.physicalSequence}`);
      });
    }
  }

  /** Detaches every live Sprite before destroying frame and generated texture. */
  clearVisualAsset(): void {
    const frame = this.visualFrame;
    const texture = this.visualTexture;
    for (const sprite of this.visualSprites) {
      if (sprite.spriteFrame === frame) {
        sprite.spriteFrame = null;
        this.visualSprites.delete(sprite);
      }
    }
    this.visualFrame = undefined;
    this.visualTexture = undefined;
    this.visualStatus = undefined;
    this.visualSourceWidth = undefined;
    this.visualSourceHeight = undefined;
    const failures: unknown[] = [];
    try {
      frame?.destroy();
    } catch (error) {
      failures.push(error);
    }
    try {
      texture?.destroy();
    } catch (error) {
      failures.push(error);
    }
    if (failures.length > 0) {
      throw new Error(`Visual frame cleanup failed (${failures.length})`);
    }
  }

  focusPrimaryActions(): void {
    this.deckIndex = 0;
    this.pageByDeck[0] = 0;
    this.scenePage = 0;
  }

  private renderAgain(): void {
    if (this.lastChrome !== undefined) {
      this.render(this.lastModel, this.lastChrome, this.lastSafeInsets);
    }
  }

  private safeX(): number {
    return (this.lastSafeInsets.left - this.lastSafeInsets.right) / 2;
  }

  private safeY(top: number, height: number): number {
    return this.surfaceHeight / 2 - this.lastSafeInsets.top - top - height / 2;
  }

  private safeCenterY(): number {
    return (this.lastSafeInsets.bottom - this.lastSafeInsets.top) / 2;
  }

  private renderChrome(
    root: Node,
    model: GameViewModel | undefined,
    chrome: InfiniteFlowRuntimeChrome,
  ): void {
    const playerChrome = formatInfiniteFlowPlayerChrome(chrome, model?.phase);
    const modeColor = chrome.modeKind === 'blocked'
      ? PALETTE.red
      : chrome.modeKind === 'preview' || chrome.modeKind === 'wx-devtools'
        ? PALETTE.gold
        : chrome.modeKind === 'wx'
          ? PALETTE.teal
          : PALETTE.muted;
    const bandWidth = DESIGN_WIDTH - this.lastSafeInsets.left - this.lastSafeInsets.right;
    const band = addPanel(root, 'RuntimeModeBand', this.safeX(), this.safeY(MODE_TOP, MODE_HEIGHT), bandWidth, MODE_HEIGHT, {
      fill: chrome.modeKind === 'blocked' ? PALETTE.redDark : PALETTE.visualSurfaceQuiet,
      stroke: modeColor,
      radius: 0,
      lineWidth: 3,
    });
    addText(band, 'RuntimeMode', playerChrome.modeLabel, -218, 0, 278, 52, {
      fontSize: 23,
      color: modeColor,
      shrink: true,
    });
    addText(band, 'RuntimeDetail', playerChrome.modeDetail, 140, 0, 390, 50, {
      fontSize: 18,
      color: PALETTE.muted,
      horizontal: Label.HorizontalAlign.RIGHT,
      shrink: true,
    });

    const titlePanel = addPanel(root, 'TitlePanel', this.safeX(), this.safeY(TITLE_TOP, TITLE_HEIGHT), CONTENT_WIDTH, TITLE_HEIGHT, {
      fill: PALETTE.visualSurface,
      stroke: PALETTE.gold,
      lineWidth: 2,
    });
    addText(
      titlePanel,
      'ScreenTitle',
      model?.screenTitle ?? '无限流 · 运行时初始化',
      -116,
      5,
      430,
      42,
      { fontSize: 32, color: PALETTE.bone, shrink: true },
    );
    addText(
      titlePanel,
      'Activity',
      playerChrome.activityMessage ?? (model === undefined ? '正在建立存档与随机源边界' : infiniteFlowPhaseActivity(model.phase)),
      232,
      -2,
      205,
      38,
      {
        fontSize: 19,
        color: chrome.busyActionId ? PALETTE.gold : PALETTE.muted,
        horizontal: Label.HorizontalAlign.RIGHT,
        shrink: true,
      },
    );
  }

  private renderBootOrBlocked(
    root: Node,
    chrome: InfiniteFlowRuntimeChrome,
  ): void {
    const blocked = chrome.modeKind === 'blocked';
    const diagnosticHeight = Math.min(
      820,
      this.surfaceHeight - this.lastSafeInsets.top - this.lastSafeInsets.bottom - 80,
    );
    const panel = addPanel(root, 'RuntimeDiagnostic', this.safeX(), this.safeCenterY() - 30, CONTENT_WIDTH, diagnosticHeight, {
      fill: PALETTE.raised,
      stroke: blocked ? PALETTE.red : PALETTE.teal,
      lineWidth: 4,
      radius: 18,
    });
    addText(
      panel,
      'DiagnosticSymbol',
      blocked ? '×' : '…',
      0,
      300,
      160,
      120,
      {
        fontSize: 78,
        color: blocked ? PALETTE.red : PALETTE.gold,
        horizontal: Label.HorizontalAlign.CENTER,
      },
    );
    addText(
      panel,
      'DiagnosticTitle',
      blocked ? `运行已阻断 · ${chrome.modeLabel}` : '正在初始化',
      0,
      205,
      620,
      72,
      {
        fontSize: 38,
        color: blocked ? PALETTE.red : PALETTE.bone,
        horizontal: Label.HorizontalAlign.CENTER,
      },
    );
    addText(
      panel,
      'DiagnosticBody',
      chrome.blockingMessage ?? chrome.modeDetail,
      0,
      5,
      610,
      280,
      {
        fontSize: 27,
        color: PALETTE.bone,
        horizontal: Label.HorizontalAlign.CENTER,
        vertical: Label.VerticalAlign.TOP,
        wrap: true,
      },
    );
    addText(
      panel,
      'DiagnosticPolicy',
      blocked
        ? '不会降级为内存存档，也不会显示“已签核”。\n请按上方诊断补齐明确宿主边界后重新载入。'
        : '目标 → 状态 → 动作 → 风险 → 帮助 → 日志',
      0,
      -212,
      610,
      130,
      {
        fontSize: 24,
        color: blocked ? PALETTE.gold : PALETTE.teal,
        horizontal: Label.HorizontalAlign.CENTER,
        wrap: true,
      },
    );
  }

  private renderInformationRail(root: Node): void {
    const rail = addPanel(root, 'InformationOrder', this.safeX(), this.safeY(RAIL_TOP, RAIL_HEIGHT), CONTENT_WIDTH, RAIL_HEIGHT, {
      fill: PALETTE.visualSurfaceQuiet,
      stroke: PALETTE.teal,
      radius: 8,
    });
    const itemWidth = 112;
    for (let index = 0; index < SECTION_LABELS.length; index += 1) {
      const isStatic = index < 2;
      const isCurrent = index === this.deckIndex + 2;
      addText(
        rail,
        `Order${index}`,
        SECTION_LABELS[index] ?? '',
        -280 + index * itemWidth,
        0,
        108,
        30,
        {
          fontSize: 18,
          color: isCurrent ? PALETTE.gold : isStatic ? PALETTE.teal : PALETTE.muted,
          horizontal: Label.HorizontalAlign.CENTER,
          shrink: true,
        },
      );
    }
  }

  private renderObjective(root: Node, model: GameViewModel): void {
    const objective = model.sections[0];
    const title = model.phase === 'hub'
      ? formatInfiniteFlowHubPlayerCopy(objective.title, '当前目标')
      : objective.title;
    const summary = model.phase === 'hub'
      ? formatInfiniteFlowHubPlayerCopy(objective.summary)
      : objective.summary;
    const panel = addPanel(root, 'Objective', this.safeX(), this.safeY(OBJECTIVE_TOP, OBJECTIVE_HEIGHT), CONTENT_WIDTH, OBJECTIVE_HEIGHT, {
      fill: PALETTE.visualSurface,
      stroke: PALETTE.gold,
      lineWidth: 3,
    });
    addText(panel, 'ObjectiveEyebrow', `目标 / ${title}`, 0, 27, 650, 32, {
      fontSize: 25,
      color: PALETTE.gold,
      shrink: true,
    });
    addText(panel, 'ObjectiveSummary', summary, 0, -19, 650, 56, {
      fontSize: 21,
      color: PALETTE.bone,
      vertical: Label.VerticalAlign.TOP,
      wrap: true,
    });
  }

  private renderStatus(
    root: Node,
    model: GameViewModel,
    chrome: InfiniteFlowRuntimeChrome,
  ): void {
    const status = model.sections[1];
    const panel = addPanel(root, 'Status', this.safeX(), this.safeY(STATUS_TOP, STATUS_HEIGHT), CONTENT_WIDTH, STATUS_HEIGHT, {
      fill: PALETTE.visualSurface,
      stroke: PALETTE.teal,
      lineWidth: 3,
    });
    this.renderVisualStage(
      panel,
      model.sections[1].detail.kind,
      model.visualAssetKey,
    );
    const detail = status.detail;
    if (detail.kind === 'explore') {
      this.renderExploreMetrics(panel, status.metrics);
    } else if (detail.kind !== 'combat' && detail.kind !== 'result') {
      this.renderMetrics(panel, status.metrics);
    }
    if (detail.kind === 'explore') this.renderExploreStatus(panel, detail, chrome);
    else if (detail.kind === 'combat') this.renderCombatStatus(panel, detail, status.metrics);
    else if (
      detail.kind === 'hub'
      && (
        detail.equipmentCommission !== undefined
        || detail.equipmentMemory !== undefined
      )
    ) {
      this.renderEquipmentHubStatus(panel, detail, model.sections[4], chrome);
    } else if (detail.kind === 'result') {
      this.renderResultPager(panel, detail, status.metrics);
    } else this.renderSimpleStatus(panel, detail);
    if (this.visualStatus?.diagnostic !== undefined) {
      const diagnostic = addPanel(
        panel,
        'VisualAssetFallbackDiagnostic',
        0,
        -99,
        CONTENT_WIDTH - 24,
        24,
        {
          fill: PALETTE.backgroundOpaque,
          stroke: PALETTE.red,
          lineWidth: 1,
          radius: 4,
        },
      );
      addText(
        diagnostic,
        'VisualAssetFallbackText',
        formatInfiniteFlowVisualFallbackDiagnostic(chrome, this.visualStatus.diagnostic),
        0,
        0,
        CONTENT_WIDTH - 42,
        20,
        {
          fontSize: 14,
          color: PALETTE.red,
          horizontal: Label.HorizontalAlign.CENTER,
          shrink: true,
        },
      );
    }
  }

  private detachVisualSprites(): void {
    for (const sprite of this.visualSprites) sprite.spriteFrame = null;
    this.visualSprites.clear();
  }

  private renderVisualBackdrop(
    root: Node,
    kind: PhaseDetailViewModel['kind'],
  ): void {
    const layout = layoutInfiniteFlowVisualBackdrop(
      kind,
      this.visualSourceWidth,
      this.visualSourceHeight,
      DESIGN_WIDTH,
      this.surfaceHeight,
    );
    if (this.visualFrame === undefined || !layout.renderable) return;
    const visualNode = addNode(
      root,
      `VisualBackdrop:${layout.role}:${this.visualStatus?.key ?? 'unknown'}`,
      layout.x,
      layout.y,
      layout.width,
      layout.height,
    );
    const sprite = visualNode.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.color = new Color(255, 255, 255, 184);
    sprite.spriteFrame = this.visualFrame;
    this.visualSprites.add(sprite);
    addPanel(
      root,
      'VisualBackdropShade',
      0,
      0,
      DESIGN_WIDTH,
      this.surfaceHeight,
      {
        fill: PALETTE.visualBackdropShade,
        stroke: PALETTE.visualBackdropShade,
        lineWidth: 0,
        radius: 0,
      },
    );
  }

  private renderVisualStage(
    panel: Node,
    kind: PhaseDetailViewModel['kind'],
    expectedKey: GameViewModel['visualAssetKey'],
  ): void {
    const stage = addPanel(
      panel,
      `VisualStage:${kind}`,
      0,
      0,
      VISUAL_STAGE_WIDTH,
      VISUAL_STAGE_HEIGHT,
      {
        fill: PALETTE.black,
        stroke: PALETTE.tealDark,
        lineWidth: 1,
        radius: 9,
      },
    );
    const layout = layoutInfiniteFlowVisualStage(
      kind,
      this.visualSourceWidth,
      this.visualSourceHeight,
    );
    if (this.visualFrame !== undefined && layout.renderable) {
      const visualNode = addNode(
        stage,
        `VisualAsset:${layout.role}:${this.visualStatus?.key ?? 'unknown'}`,
        layout.x,
        layout.y,
        layout.width,
        layout.height,
      );
      const sprite = visualNode.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      sprite.color = new Color(255, 255, 255, 255);
      sprite.spriteFrame = this.visualFrame;
      this.visualSprites.add(sprite);
    } else {
      const assetUnavailable = expectedKey === undefined
        || this.visualFrame !== undefined
        || this.visualStatus?.diagnostic !== undefined;
      addText(
        stage,
        'VisualStageFallback',
        layout.role === 'monster'
          ? `怪物立绘${assetUnavailable ? '不可用' : '载入中'}`
          : `场景图${assetUnavailable ? '不可用' : '载入中'}`,
        layout.x,
        58,
        Math.min(layout.width, 280),
        30,
        {
          fontSize: 16,
          color: PALETTE.muted,
          horizontal: Label.HorizontalAlign.CENTER,
          shrink: true,
        },
      );
    }
    const hudHeight = kind === 'combat' ? COMBAT_VISUAL_HUD_HEIGHT : VISUAL_HUD_HEIGHT;
    addPanel(
      stage,
      'VisualHudScrim',
      0,
      -(VISUAL_STAGE_HEIGHT - hudHeight) / 2,
      VISUAL_STAGE_WIDTH,
      hudHeight,
      {
        fill: PALETTE.visualHud,
        stroke: PALETTE.visualHud,
        lineWidth: 0,
        radius: 7,
      },
    );
  }

  private renderExploreMetrics(panel: Node, metrics: readonly StatusMetric[]): void {
    const visible = metrics.slice(0, 6);
    const width = 212;
    for (let index = 0; index < visible.length; index += 1) {
      const metric = visible[index];
      if (metric === undefined) continue;
      const column = index % 3;
      const row = Math.floor(index / 3);
      // StatusMetric values are presentation-owned copy. Insert display-only
      // newlines without dropping a glyph so long seal/law readouts remain
      // readable instead of silently shrinking inside a narrow chip.
      const valueLines = wrapInfiniteFlowLine(metric.value, 4.3);
      const valueFontSize = valueLines.length === 1 ? 30 : 28;
      const chip = addPanel(
        panel,
        `ExploreMetric:${metric.id}`,
        -228 + column * 228,
        86 - row * 54,
        width,
        50,
        {
          fill: PALETTE.visualHud,
          stroke: severityColor(metric.severity),
          lineWidth: 2,
          radius: 9,
        },
      );
      addText(chip, 'MetricSymbol', metric.symbol, -92, 0, 24, 42, {
        fontSize: 30,
        color: severityColor(metric.severity),
        horizontal: Label.HorizontalAlign.CENTER,
        shrink: false,
      });
      addText(chip, 'MetricLabel', metric.label, -54, 0, 48, 44, {
        fontSize: 14,
        lineHeight: 17,
        color: PALETTE.muted,
        horizontal: Label.HorizontalAlign.CENTER,
        wrap: true,
        shrink: false,
      });
      addText(chip, 'MetricValue', valueLines.join('\n'), 38, 0, 132, 50, {
        fontSize: valueFontSize,
        lineHeight: valueLines.length === 1 ? 32 : 25,
        color: metric.severity === 'danger' ? PALETTE.red : PALETTE.bone,
        horizontal: Label.HorizontalAlign.CENTER,
        wrap: false,
        shrink: false,
      });
    }
  }

  private renderMetrics(panel: Node, metrics: readonly StatusMetric[]): void {
    const visible = metrics.slice(0, 6);
    const width = 211;
    for (let index = 0; index < visible.length; index += 1) {
      const metric = visible[index];
      if (metric === undefined) continue;
      const column = index % 3;
      const row = Math.floor(index / 3);
      const chip = addPanel(
        panel,
        `Metric:${metric.id}`,
        -224 + column * 224,
        localY(STATUS_HEIGHT, 10 + row * 42, 36),
        width,
        36,
        {
          fill: PALETTE.raisedQuiet,
          stroke: severityColor(metric.severity),
          lineWidth: 2,
          radius: 7,
        },
      );
      addText(
        chip,
        'MetricValue',
        `${metric.symbol} ${metric.label} ${metric.id === 'outcome' ? formatInfiniteFlowOutcomeMetric(metric.value) : metric.value}`,
        0,
        0,
        width - 16,
        30,
        {
          fontSize: 18,
          color: metric.severity === 'danger' ? PALETTE.red : PALETTE.bone,
          horizontal: Label.HorizontalAlign.CENTER,
          shrink: true,
        },
      );
    }
  }

  private renderSimpleStatus(panel: Node, detail: PhaseDetailViewModel): void {
    addText(panel, 'DetailKind', '大厅状态', -246, -8, 160, 36, {
      fontSize: 20,
      color: PALETTE.teal,
      shrink: true,
    });
    addText(panel, 'DetailLine', detailLine(detail), 46, -8, 420, 38, {
      fontSize: 23,
      color: PALETTE.bone,
      shrink: true,
    });
    if (detail.kind === 'hub') {
      const entryBuild = formatInfiniteFlowEntryBuildDetail(detail);
      addText(
        panel,
        'SeedBoundary',
        `${entryBuild === undefined ? '' : `${entryBuild}\n`}本局命数 · ${detail.seedStatus === 'host-on-confirm' ? '确认入场时生成并保存' : '状态待确认'}`,
        0,
        entryBuild === undefined ? -58 : -56,
        640,
        entryBuild === undefined ? 44 : 72,
        {
          fontSize: entryBuild === undefined ? 21 : 16,
          color: PALETTE.gold,
          horizontal: Label.HorizontalAlign.CENTER,
          wrap: true,
          shrink: true,
        },
      );
    }
  }

  private renderEquipmentHubStatus(
    panel: Node,
    detail: Extract<PhaseDetailViewModel, { kind: 'hub' }>,
    help: HelpSection,
    chrome: InfiniteFlowRuntimeChrome,
  ): void {
    const readouts = formatInfiniteFlowEquipmentHubDetail(detail);
    if (readouts.commission !== undefined && readouts.memory !== undefined) {
      this.renderCompactEquipmentFeature(
        panel,
        'EquipmentCommission',
        readouts.commission,
        -230,
        -62,
        detail.equipmentCommission?.helpId ?? 'equipmentCommission',
        help,
        chrome,
        detail.equipmentCommission?.status === 'active',
      );
      this.renderCompactEquipmentFeature(
        panel,
        'EquipmentMemory',
        readouts.memory,
        112,
        291,
        detail.equipmentMemory?.helpId ?? 'equipmentMemory',
        help,
        chrome,
        false,
      );
      return;
    }
    if (readouts.commission !== undefined && detail.equipmentCommission !== undefined) {
      this.renderFullEquipmentFeature(
        panel,
        'EquipmentCommission',
        readouts.commission,
        detail.equipmentCommission.helpId,
        help,
        chrome,
        detail.equipmentCommission.status === 'active',
        false,
      );
    } else if (readouts.memory !== undefined && detail.equipmentMemory !== undefined) {
      this.renderFullEquipmentFeature(
        panel,
        'EquipmentMemory',
        readouts.memory,
        detail.equipmentMemory.helpId,
        help,
        chrome,
        false,
        false,
      );
    }
  }

  private renderResultPager(
    panel: Node,
    detail: Extract<PhaseDetailViewModel, { kind: 'result' }>,
    metrics: readonly StatusMetric[],
  ): void {
    const pages = this.buildResultPagerPages(detail);
    if (pages.length === 0) return;
    const signature = pages.map((page) => page.id).join(',');
    if (this.resultPageSignature !== signature) {
      this.resultPageSignature = signature;
      this.resultPage = 0;
    }
    this.resultPage = clamp(this.resultPage, 0, pages.length - 1);
    const index = this.resultPage;
    const current = pages[index];
    if (current === undefined) return;

    if (index === 0) {
      this.renderResultAltar(panel, detail, metrics, pages.length, current.title);
    } else {
      this.renderMetrics(panel, metrics);
      addText(
        panel,
        'ResultPagerHeader',
        `结算 ${index + 1}/${pages.length} · ${current.title}`,
        0,
        RESULT_PAGER_HEADER_Y,
        RESULT_PAGER_CONTENT_WIDTH,
        RESULT_PAGER_HEADER_HEIGHT,
        {
          fontSize: 16,
          lineHeight: RESULT_PAGER_HEADER_HEIGHT,
          color: PALETTE.gold,
          horizontal: Label.HorizontalAlign.CENTER,
          shrink: true,
        },
      );

      current.lines.forEach((line, lineIndex) => {
        addText(
          panel,
          `ResultPagerLine:${lineIndex}`,
          line,
          0,
          RESULT_PAGER_CONTENT_TOP_Y - lineIndex * RESULT_PAGER_LINE_HEIGHT,
          RESULT_PAGER_CONTENT_WIDTH,
          RESULT_PAGER_LINE_HEIGHT,
          {
            fontSize: 13,
            lineHeight: RESULT_PAGER_LINE_HEIGHT,
            color: PALETTE.bone,
            horizontal: Label.HorizontalAlign.CENTER,
            wrap: false,
            shrink: false,
          },
        );
      });
    }

    if (pages.length > 1) {
      this.bindResultPagerNav(panel, index, pages.length);
    }
  }

  private renderResultAltar(
    panel: Node,
    detail: Extract<PhaseDetailViewModel, { kind: 'result' }>,
    metrics: readonly StatusMetric[],
    pageCount: number,
    pageTitle: string,
  ): void {
    const readout = formatInfiniteFlowResultAltar(detail, metrics);
    const altar = addPanel(panel, 'ResultAltar', 0, 0, RESULT_ALTAR_WIDTH, RESULT_ALTAR_HEIGHT, {
      fill: PALETTE.visualHud,
      stroke: PALETTE.gold,
      lineWidth: 2,
      radius: 10,
    });
    const graphics = altar.getComponent(Graphics);
    if (graphics !== null) {
      graphics.moveTo(-220, 78);
      graphics.lineTo(-206, 92);
      graphics.lineTo(-176, 92);
      graphics.moveTo(220, 78);
      graphics.lineTo(206, 92);
      graphics.lineTo(176, 92);
      graphics.moveTo(-220, -78);
      graphics.lineTo(-206, -92);
      graphics.lineTo(-176, -92);
      graphics.moveTo(220, -78);
      graphics.lineTo(206, -92);
      graphics.lineTo(176, -92);
      graphics.stroke();
    }
    addText(
      altar,
      'ResultAltarHeader',
      `结算 1/${pageCount} · ${pageTitle}`,
      0,
      92,
      RESULT_ALTAR_WIDTH - 32,
      18,
      {
        fontSize: 14,
        lineHeight: 18,
        color: PALETTE.gold,
        horizontal: Label.HorizontalAlign.CENTER,
        shrink: true,
      },
    );
    const outcome = addPanel(altar, 'ResultAltarOutcome', 0, 64, 190, 34, {
      fill: PALETTE.goldDark,
      stroke: PALETTE.gold,
      lineWidth: 2,
      radius: 12,
    });
    addText(outcome, 'ResultAltarOutcomeText', `结  结果：${readout.outcome}`, 0, 0, 176, 28, {
      fontSize: 18,
      color: PALETTE.gold,
      horizontal: Label.HorizontalAlign.CENTER,
      shrink: true,
    });

    readout.metrics.forEach((metric, metricIndex) => {
      const row = Math.floor(metricIndex / 3);
      const column = metricIndex % 3;
      const remaining = readout.metrics.length - row * 3;
      const columnsInRow = Math.min(3, remaining);
      const horizontalStep = RESULT_ALTAR_METRIC_WIDTH + RESULT_ALTAR_METRIC_GAP_X;
      const x = (column - (columnsInRow - 1) / 2) * horizontalStep;
      const chip = addPanel(
        altar,
        `ResultAltarMetric:${metric.id}`,
        x,
        row === 0 ? 27 : 0,
        RESULT_ALTAR_METRIC_WIDTH,
        RESULT_ALTAR_METRIC_HEIGHT,
        {
          fill: PALETTE.raisedQuiet,
          stroke: severityColor(metric.severity),
          lineWidth: 1,
          radius: 6,
        },
      );
      addText(chip, 'Value', `${metric.symbol} ${metric.label} ${metric.value}`, 0, 0, 140, 20, {
        fontSize: 13,
        lineHeight: 18,
        color: metric.severity === 'danger' ? PALETTE.red : PALETTE.bone,
        horizontal: Label.HorizontalAlign.CENTER,
        shrink: true,
      });
    });

    if (readout.loot.state === 'valid') {
      this.renderResultAltarBand(
        altar,
        'ResultAltarRetainedBand',
        readout.loot.retained,
        -32,
        PALETTE.tealDark,
        PALETTE.teal,
      );
      if (readout.loot.loss !== undefined) {
        this.renderResultAltarBand(
          altar,
          'ResultAltarLossBand',
          readout.loot.loss,
          -62,
          PALETTE.redDark,
          PALETTE.red,
        );
      }
    } else if (readout.loot.state === 'invalid') {
      this.renderResultAltarBand(
        altar,
        'ResultAltarInvalidBand',
        `× ${readout.loot.diagnostic}`,
        -42,
        PALETTE.redDark,
        PALETTE.red,
      );
    } else {
      this.renderResultAltarBand(
        altar,
        'ResultAltarMissingBand',
        '· 掉落明细未提供',
        -42,
        PALETTE.raisedQuiet,
        PALETTE.muted,
      );
    }
  }

  private renderResultAltarBand(
    altar: Node,
    name: string,
    value: string,
    y: number,
    fill: Color,
    stroke: Color,
  ): void {
    const band = addPanel(altar, name, 0, y, RESULT_ALTAR_WIDTH - 20, 24, {
      fill,
      stroke,
      lineWidth: 1,
      radius: 5,
    });
    addText(band, 'Value', value, 0, 0, RESULT_ALTAR_WIDTH - 34, 20, {
      fontSize: 14,
      lineHeight: 18,
      color: stroke,
      horizontal: Label.HorizontalAlign.CENTER,
      shrink: true,
    });
  }

  /**
   * Expands the stable logical pages into display pages, wrapping long
   * Chinese/ASCII lines and splitting overflowing pages into stable
   * continuation subpages. The full page-set signature drives reset/clamp.
   */
  private buildResultPagerPages(
    detail: Extract<PhaseDetailViewModel, { kind: 'result' }>,
  ): readonly { id: string; title: string; lines: readonly string[] }[] {
    const pages: { id: string; title: string; lines: readonly string[] }[] = [];
    for (const page of buildInfiniteFlowResultPages(detail)) {
      const subpages = paginateInfiniteFlowText(page.lines, RESULT_PAGER_TEXT_WRAP);
      const single = subpages.length === 1;
      subpages.forEach((lines, subpageIndex) => {
        pages.push({
          id: single ? page.id : `${page.id}#${subpageIndex + 1}`,
          title: single
            ? page.title
            : `${page.title}（续 ${subpageIndex + 1}/${subpages.length}）`,
          lines,
        });
      });
    }
    return pages;
  }

  private bindResultPagerNav(
    panel: Node,
    page: number,
    pageCount: number,
  ): void {
    this.renderResultPagerNavButton(
      panel,
      'ResultPagerPrev',
      '‹ 上一页',
      RESULT_PAGER_PREV_X,
      page > 0,
      () => {
        this.resultPage = Math.max(0, page - 1);
        this.renderAgain();
      },
    );
    this.renderResultPagerNavButton(
      panel,
      'ResultPagerNext',
      '下一页 ›',
      RESULT_PAGER_NEXT_X,
      page < pageCount - 1,
      () => {
        this.resultPage = Math.min(pageCount - 1, page + 1);
        this.renderAgain();
      },
    );
  }

  private renderResultPagerNavButton(
    panel: Node,
    name: string,
    label: string,
    x: number,
    enabled: boolean,
    activate: () => void,
  ): void {
    const button = addPanel(
      panel,
      name,
      x,
      RESULT_PAGER_NAV_Y,
      RESULT_PAGER_NAV_WIDTH,
      RESULT_PAGER_NAV_HEIGHT,
      {
        fill: enabled ? PALETTE.tealDark : PALETTE.raisedQuiet,
        stroke: enabled ? PALETTE.teal : PALETTE.disabled,
        lineWidth: enabled ? 3 : 2,
        radius: 12,
      },
    );
    addText(
      button,
      'Label',
      enabled ? label : `× ${label}`,
      0,
      0,
      RESULT_PAGER_NAV_WIDTH - 12,
      44,
      {
        fontSize: 18,
        color: enabled ? PALETTE.bone : PALETTE.disabled,
        horizontal: Label.HorizontalAlign.CENTER,
        shrink: true,
      },
    );
    if (enabled) {
      const renderedRoot = this.root;
      this.bindPhysical(button, true, () => {
        if (this.root !== renderedRoot) return;
        activate();
      });
    }
  }

  private renderFullEquipmentFeature(
    panel: Node,
    name: string,
    readout: InfiniteFlowEquipmentFeatureReadout,
    helpId:
      | EquipmentCommissionDetailViewModel['helpId']
      | EquipmentMemoryLibraryViewModel['helpId'],
    help: HelpSection,
    chrome: InfiniteFlowRuntimeChrome,
    danger: boolean,
    completed: boolean,
  ): void {
    addText(panel, `${name}Title`, readout.title, -46, -2, 554, 30, {
      fontSize: 21,
      color: completed ? PALETTE.gold : PALETTE.teal,
      shrink: true,
    });
    addText(panel, `${name}Summary`, readout.summary, -46, -32, 554, 30, {
      fontSize: 18,
      color: PALETTE.bone,
      shrink: true,
    });
    addText(panel, `${name}Detail`, readout.detail, -46, -76, 554, 54, {
      fontSize: 16,
      color: danger ? PALETTE.red : PALETTE.gold,
      horizontal: Label.HorizontalAlign.LEFT,
      vertical: Label.VerticalAlign.TOP,
      wrap: true,
      shrink: true,
    });
    this.renderEquipmentFeatureHelp(
      panel,
      `${name}Help`,
      291,
      helpId,
      help,
      chrome,
    );
  }

  private renderCompactEquipmentFeature(
    panel: Node,
    name: string,
    readout: InfiniteFlowEquipmentFeatureReadout,
    textX: number,
    helpX: number,
    helpId:
      | EquipmentCommissionDetailViewModel['helpId']
      | EquipmentMemoryLibraryViewModel['helpId'],
    help: HelpSection,
    chrome: InfiniteFlowRuntimeChrome,
    danger: boolean,
  ): void {
    addText(panel, `${name}Title`, readout.title, textX, -12, 220, 26, {
      fontSize: 17,
      color: danger ? PALETTE.red : PALETTE.teal,
      shrink: true,
    });
    addText(
      panel,
      `${name}Body`,
      `${readout.summary}\n${readout.detail}`,
      textX,
      -68,
      220,
      78,
      {
        fontSize: 14,
        color: PALETTE.bone,
        vertical: Label.VerticalAlign.TOP,
        wrap: true,
        shrink: true,
      },
    );
    this.renderEquipmentFeatureHelp(
      panel,
      `${name}Help`,
      helpX,
      helpId,
      help,
      chrome,
    );
  }

  private renderEquipmentFeatureHelp(
    panel: Node,
    name: string,
    x: number,
    helpId:
      | EquipmentCommissionDetailViewModel['helpId']
      | EquipmentMemoryLibraryViewModel['helpId'],
    help: HelpSection,
    chrome: InfiniteFlowRuntimeChrome,
  ): void {
    const entry = help.entries.find(({ id }) => id === helpId);
    const enabled = entry !== undefined
      && chrome.busyActionId === undefined
      && chrome.modeKind !== 'blocked';
    const button = addPanel(
      panel,
      name,
      x,
      -53,
      MINIMUM_TOUCH_HEIGHT,
      MINIMUM_TOUCH_HEIGHT,
      {
        fill: enabled ? PALETTE.goldDark : PALETTE.raisedQuiet,
        stroke: enabled ? PALETTE.gold : PALETTE.disabled,
        lineWidth: enabled ? 4 : 2,
        radius: 13,
      },
    );
    addText(button, 'Label', enabled ? '?' : '× ?', 0, 0, 72, 72, {
      fontSize: 36,
      color: enabled ? PALETTE.gold : PALETTE.disabled,
      horizontal: Label.HorizontalAlign.CENTER,
      shrink: true,
    });
    if (entry !== undefined) {
      this.bindPhysical(button, enabled, (physicalId) => {
        this.delegate.activate(
          physicalId,
          entry.openAction.actionId,
          entry.openAction.event,
        );
      });
    }
  }

  private renderExploreStatus(
    panel: Node,
    detail: Extract<PhaseDetailViewModel, { kind: 'explore' }>,
    chrome: InfiniteFlowRuntimeChrome,
  ): void {
    const encounter = addPanel(panel, 'ExploreEncounterCard', -241, -48, 190, 104, {
      fill: PALETTE.visualHud,
      stroke: detail.currentNode.cleared ? PALETTE.teal : PALETTE.gold,
      lineWidth: 3,
      radius: 12,
    });
    addText(encounter, 'EncounterKicker', '当前遭遇', 0, 31, 166, 22, {
      fontSize: 15,
      color: PALETTE.muted,
      horizontal: Label.HorizontalAlign.CENTER,
      shrink: false,
    });
    addText(encounter, 'CurrentNode', detail.currentNode.title, 0, 4, 166, 34, {
      fontSize: 23,
      color: PALETTE.gold,
      horizontal: Label.HorizontalAlign.CENTER,
      shrink: true,
    });
    addText(
      encounter,
      'EncounterState',
      `${mapNodeTypeLabel(detail.currentNode.nodeType)} · ${detail.currentNode.cleared ? '已清理' : '待处理'}`,
      0,
      -30,
      166,
      24,
      {
        fontSize: 15,
        color: detail.currentNode.cleared ? PALETTE.teal : PALETTE.bone,
        horizontal: Label.HorizontalAlign.CENTER,
        shrink: true,
      },
    );

    this.renderExploreCompass(panel, formatInfiniteFlowExploreCompass(detail.map));

    if (detail.chapterDecision !== undefined) {
      const decision = formatInfiniteFlowChapterDecision(detail.chapterDecision);
      const summary = addPanel(panel, 'ChapterCodexSummary', 88, -48, 230, 104, {
        fill: PALETTE.visualHud,
        stroke: PALETTE.gold,
        lineWidth: 2,
        radius: 12,
      });
      addText(summary, 'ChapterCodexSummaryTitle', `章规 · ${decision.dungeonName}`, 0, 24, 204, 30, {
        fontSize: 21,
        color: PALETTE.gold,
        horizontal: Label.HorizontalAlign.CENTER,
        shrink: true,
      });
      addText(
        summary,
        'ChapterCodexSummaryBody',
        decision.sections.map(({ title }) => title.replace(/^(?:主神|破界)/u, '')).join(' · '),
        0,
        -18,
        204,
        48,
        {
          fontSize: 16,
          lineHeight: 21,
          color: PALETTE.bone,
          horizontal: Label.HorizontalAlign.CENTER,
          wrap: true,
          shrink: true,
        },
      );
      this.renderChapterCodexOpen(panel, chrome);
      return;
    }

    const memoryReadout = formatInfiniteFlowExploreEquipmentMemory(detail);
    const info = addPanel(panel, 'ExploreStatusReadout', 151, -48, 380, 104, {
      fill: PALETTE.visualHud,
      stroke: memoryReadout === undefined ? PALETTE.tealDark : PALETTE.teal,
      lineWidth: 2,
      radius: 12,
    });
    if (detail.equipmentMemoryHunt !== undefined && memoryReadout !== undefined) {
      const danger = detail.equipmentMemoryHunt.malformedDisabled
        || detail.equipmentMemoryHunt.display.key === 'failed'
        || detail.equipmentMemoryHunt.display.key === 'lost';
      addText(info, 'EquipmentMemoryHuntTitle', memoryReadout.title, 0, 29, 354, 24, {
        fontSize: 18,
        color: danger ? PALETTE.red : PALETTE.teal,
        horizontal: Label.HorizontalAlign.CENTER,
        shrink: true,
      });
      addText(info, 'EquipmentMemoryHuntSummary', memoryReadout.summary, 0, 0, 354, 34, {
        fontSize: 15,
        lineHeight: 19,
        color: PALETTE.bone,
        horizontal: Label.HorizontalAlign.CENTER,
        wrap: true,
        shrink: true,
      });
      addText(info, 'EquipmentMemoryHuntDetail', memoryReadout.detail, 0, -34, 354, 28, {
        fontSize: 14,
        color: danger ? PALETTE.red : PALETTE.gold,
        horizontal: Label.HorizontalAlign.CENTER,
        wrap: true,
        shrink: true,
      });
      return;
    }
    addText(info, 'ExploreStatusEmptyTitle', '本章未提供额外章规', 0, 20, 340, 32, {
      fontSize: 21,
      color: PALETTE.teal,
      horizontal: Label.HorizontalAlign.CENTER,
      shrink: false,
    });
    addText(info, 'ExploreStatusEmptyLegend', '◎ 当前 · → 可达 · ? 迷雾 · 完整地图见下方', 0, -23, 340, 28, {
      fontSize: 17,
      color: PALETTE.bone,
      horizontal: Label.HorizontalAlign.CENTER,
      shrink: true,
    });
  }

  private renderExploreCompass(
    panel: Node,
    compass: InfiniteFlowExploreCompassReadout,
  ): void {
    const compassPanel = addPanel(panel, 'ExploreCompass', -91, -48, 104, 104, {
      fill: PALETTE.visualHud,
      stroke: compass.projectionValid ? PALETTE.teal : PALETTE.red,
      lineWidth: 3,
      radius: 52,
    });
    const placements: Readonly<Record<InfiniteFlowExploreCompassDirection, Readonly<{ x: number; y: number }>>> = Object.freeze({
      north: Object.freeze({ x: 0, y: 34 }),
      east: Object.freeze({ x: 34, y: 0 }),
      south: Object.freeze({ x: 0, y: -34 }),
      west: Object.freeze({ x: -34, y: 0 }),
    });
    for (const direction of compass.directions) {
      const placement = placements[direction.direction];
      addText(
        compassPanel,
        `Compass:${direction.direction}`,
        direction.symbol,
        placement.x,
        placement.y,
        28,
        28,
        {
          fontSize: 23,
          color: direction.state === undefined ? PALETTE.muted : stateColor(direction.state),
          horizontal: Label.HorizontalAlign.CENTER,
          shrink: false,
        },
      );
    }
    addText(compassPanel, 'CompassCenter', compass.centerSymbol, 0, 0, 34, 34, {
      fontSize: 27,
      color: compass.projectionValid ? PALETTE.gold : PALETTE.red,
      horizontal: Label.HorizontalAlign.CENTER,
      shrink: false,
    });
  }

  private renderChapterCodexOpen(
    panel: Node,
    chrome: InfiniteFlowRuntimeChrome,
  ): void {
    const enabled = chrome.busyActionId === undefined && chrome.modeKind !== 'blocked';
    const button = addPanel(panel, 'ChapterCodexOpen', 291, -48, 104, 104, {
      fill: enabled ? PALETTE.goldDark : PALETTE.raisedQuiet,
      stroke: enabled ? PALETTE.gold : PALETTE.disabled,
      lineWidth: enabled ? 4 : 2,
      radius: 13,
    });
    addText(button, 'Label', enabled ? '卷\n章规' : '×\n章规', 0, 0, 78, 76, {
      fontSize: 28,
      lineHeight: 32,
      color: enabled ? PALETTE.gold : PALETTE.disabled,
      horizontal: Label.HorizontalAlign.CENTER,
      shrink: false,
    });
    const renderedRoot = this.root;
    this.bindPhysical(button, enabled, () => {
      if (this.root !== renderedRoot) return;
      this.chapterCodexOpen = true;
      this.chapterDecisionPage = 0;
      this.chapterDecisionSignature = '';
      this.renderAgain();
    });
  }

  private renderChapterCodexOverlay(
    root: Node,
    detail: Extract<PhaseDetailViewModel, { kind: 'explore' }>,
    help: HelpSection,
    chrome: InfiniteFlowRuntimeChrome,
  ): void {
    const pages = buildInfiniteFlowChapterCodexPages(detail);
    if (pages.length === 0) {
      this.chapterCodexOpen = false;
      this.chapterDecisionPage = 0;
      this.chapterDecisionSignature = '';
      return;
    }
    const signature = chapterCodexSignature(pages);
    if (signature !== this.chapterDecisionSignature) {
      this.chapterDecisionSignature = signature;
      this.chapterDecisionPage = 0;
    }
    this.chapterDecisionPage = clamp(this.chapterDecisionPage, 0, pages.length - 1);
    const pageIndex = this.chapterDecisionPage;
    const page = pages[pageIndex];
    if (page === undefined) return;
    const overlay = addPanel(root, 'ChapterCodexOverlay', 0, 0, DESIGN_WIDTH, this.surfaceHeight, {
      fill: PALETTE.backgroundOpaque,
      stroke: PALETTE.backgroundOpaque,
      lineWidth: 0,
      radius: 0,
    });
    overlay.addComponent(BlockInputEvents);
    const dialogHeight = Math.min(
      1120,
      this.surfaceHeight - this.lastSafeInsets.top - this.lastSafeInsets.bottom,
    );
    const dialog = addPanel(overlay, 'ChapterCodexDialog', this.safeX(), this.safeCenterY(), CONTENT_WIDTH, dialogHeight, {
      fill: PALETTE.raised,
      stroke: PALETTE.gold,
      lineWidth: 5,
      radius: 20,
    });
    addText(dialog, 'ChapterCodexKicker', `章规卷轴 · ${pageIndex + 1} / ${pages.length}`, -70, dialogHeight / 2 - 43, 500, 34, {
      fontSize: 22,
      color: PALETTE.teal,
      horizontal: Label.HorizontalAlign.CENTER,
      shrink: false,
    });
    addText(
      dialog,
      'ChapterCodexTitle',
      `${page.title}${page.continuationCount > 1 ? ` · 续 ${page.continuation}/${page.continuationCount}` : ''}`,
      -38,
      dialogHeight / 2 - 101,
      520,
      76,
      {
        fontSize: 34,
        lineHeight: 38,
        color: PALETTE.gold,
        horizontal: Label.HorizontalAlign.CENTER,
        wrap: true,
        shrink: false,
      },
    );
    const content = addPanel(dialog, 'ChapterCodexParchment', 0, 18, 650, 720, {
      fill: PALETTE.visualHud,
      stroke: PALETTE.tealDark,
      lineWidth: 2,
      radius: 14,
    });
    addText(content, 'ChapterCodexDungeon', `副本 · ${detail.chapterDecision?.dungeonName ?? '未知'}`, 0, 316, 604, 38, {
      fontSize: 30,
      color: PALETTE.teal,
      horizontal: Label.HorizontalAlign.CENTER,
      shrink: false,
    });
    for (let index = 0; index < page.lines.length; index += 1) {
      const line = page.lines[index];
      if (line === undefined) continue;
      addText(content, `ChapterCodexLine:${index}`, line, 0, 260 - index * 42, 604, 42, {
        fontSize: 34,
        lineHeight: 40,
        color: line.startsWith('章规说明：') ? PALETTE.gold : PALETTE.bone,
        horizontal: Label.HorizontalAlign.LEFT,
        wrap: false,
        shrink: false,
      });
    }
    const renderedRoot = this.root;
    const controlsY = -dialogHeight / 2 + 70;
    this.renderChapterCodexControl(dialog, 'ChapterCodexPrevious', '‹ 上一页', -230, controlsY, 190, pageIndex > 0, renderedRoot, () => {
      this.chapterDecisionPage = pageIndex - 1;
      this.renderAgain();
    });
    this.renderChapterCodexControl(dialog, 'ChapterCodexClose', '关闭卷轴', 0, controlsY, 190, true, renderedRoot, () => {
      this.chapterCodexOpen = false;
      this.renderAgain();
    });
    this.renderChapterCodexControl(dialog, 'ChapterCodexNext', '下一页 ›', 230, controlsY, 190, pageIndex + 1 < pages.length, renderedRoot, () => {
      this.chapterDecisionPage = pageIndex + 1;
      this.renderAgain();
    });

    if (page.helpId !== undefined) {
      const entry = help.entries.find(({ id }) => id === page.helpId);
      const helpEnabled = entry !== undefined
        && chrome.busyActionId === undefined
        && chrome.modeKind !== 'blocked';
      const helpButton = addPanel(dialog, 'ChapterCodexHelp', 291, dialogHeight / 2 - 80, 104, 104, {
        fill: helpEnabled ? PALETTE.goldDark : PALETTE.raisedQuiet,
        stroke: helpEnabled ? PALETTE.gold : PALETTE.disabled,
        lineWidth: helpEnabled ? 4 : 2,
        radius: 13,
      });
      addText(helpButton, 'Label', helpEnabled ? '? 帮助' : '× 帮助', 0, 0, 86, 72, {
        fontSize: 28,
        color: helpEnabled ? PALETTE.gold : PALETTE.disabled,
        horizontal: Label.HorizontalAlign.CENTER,
        shrink: true,
      });
      if (entry !== undefined) {
        const actionId = entry.openAction.actionId;
        const event = entry.openAction.event;
        this.bindPhysical(helpButton, helpEnabled, (physicalId) => {
          if (this.root !== renderedRoot) return;
          this.delegate.activate(physicalId, actionId, event);
        });
      }
    }
  }

  private renderChapterCodexControl(
    parent: Node,
    name: string,
    label: string,
    x: number,
    y: number,
    width: number,
    enabled: boolean,
    renderedRoot: Node | undefined,
    activate: () => void,
  ): void {
    const button = addPanel(parent, name, x, y, width, MINIMUM_TOUCH_HEIGHT, {
      fill: enabled ? PALETTE.tealDark : PALETTE.raisedQuiet,
      stroke: enabled ? PALETTE.teal : PALETTE.disabled,
      lineWidth: enabled ? 3 : 2,
      radius: 13,
    });
    addText(button, 'Label', enabled ? label : `× ${label}`, 0, 0, width - 18, 76, {
      fontSize: 28,
      color: enabled ? PALETTE.bone : PALETTE.disabled,
      horizontal: Label.HorizontalAlign.CENTER,
      shrink: true,
    });
    this.bindPhysical(button, enabled, () => {
      if (this.root !== renderedRoot) return;
      activate();
    });
  }

  private renderCombatStatus(
    panel: Node,
    detail: Extract<PhaseDetailViewModel, { kind: 'combat' }>,
    metrics: readonly StatusMetric[],
  ): void {
    const memoryReadout = detail.equipmentMemory === undefined
      ? undefined
      : formatInfiniteFlowEquipmentMemoryCombat(detail.equipmentMemory);
    const contextReadout = detail.chapterContext === undefined
      ? undefined
      : formatInfiniteFlowCombatChapterContext(detail.chapterContext);
    const hasContext = contextReadout !== undefined;
    const projectedMetrics = metrics.filter(({ id }) => (
      id !== 'player-hp'
      && id !== 'enemy-hp'
      && id !== 'turn'
      && id !== 'intent'
      && id !== 'equipment-memory'
      && id !== 'boss-phase'
    ));
    if (projectedMetrics.length > 0) {
      const readout = projectedMetrics
        .map(({ symbol, label, value }) => `${symbol} ${label} ${value}`)
        .join(' · ');
      const projection = addPanel(panel, 'CombatProjectedMetrics', -150, 82, 360, 30, {
        fill: PALETTE.visualHud,
        stroke: PALETTE.tealDark,
        lineWidth: 1,
        radius: 7,
      });
      addText(projection, 'CombatProjectedMetricsReadout', readout, 0, 0, 338, 24, {
        fontSize: 15,
        color: PALETTE.bone,
        horizontal: Label.HorizontalAlign.CENTER,
        shrink: true,
      });
    }
    this.renderBar(panel, 'PlayerHp', -171, hasContext ? 4 : -8, 300, detail.player.hpPercent, PALETTE.teal, `我方 ${detail.player.hp}/${detail.player.maxHp}`);
    this.renderBar(panel, 'EnemyHp', 171, hasContext ? 4 : -8, 300, detail.enemy.hpPercent, PALETTE.red, `${detail.enemy.name} ${detail.enemy.hp}/${detail.enemy.maxHp}`);
    const intentY = hasContext
      ? (memoryReadout === undefined ? -36 : -30)
      : (memoryReadout === undefined ? -54 : -43);
    const intentSymbol = detail.intent.severity === 'danger' ? '!!' : detail.intent.severity === 'warning' ? '!' : '眼';
    addText(panel, 'CombatIntent', `第 ${detail.turn} 回合 · ${intentSymbol} ${detail.intent.name}：${detail.intent.consequence}`, 0, intentY, 650, memoryReadout === undefined ? 32 : 24, {
      fontSize: memoryReadout === undefined ? 19 : 16,
      color: detail.intent.severity === 'danger' ? PALETTE.red : PALETTE.gold,
      horizontal: Label.HorizontalAlign.CENTER,
      shrink: true,
    });
    const bossReadout = detail.boss === undefined
      ? `第 ${detail.turn} 回合 · ${detail.enemy.ability}`
      : `首领 ${detail.boss.title} · ${detail.boss.phaseLabel} · ${detail.boss.sealName}`;
    const bossY = hasContext
      ? (memoryReadout === undefined ? -66 : -58)
      : (memoryReadout === undefined ? -92 : -85);
    addText(
      panel,
      'BossReadout',
      memoryReadout === undefined
        ? bossReadout
        : `${bossReadout}\n${memoryReadout.title} · ${memoryReadout.summary} · ${memoryReadout.detail}`,
      0,
      bossY,
      650,
      memoryReadout === undefined ? 26 : 34,
      {
        fontSize: memoryReadout === undefined ? 17 : 13,
        color: detail.equipmentMemory?.enabled === false
          || detail.boss?.phase === 'awakened'
          ? PALETTE.red
          : memoryReadout === undefined
            ? PALETTE.muted
            : PALETTE.teal,
        horizontal: Label.HorizontalAlign.CENTER,
        wrap: true,
        shrink: true,
      },
    );
    if (contextReadout !== undefined) {
      const contextColor = detail.chapterContext?.law.severity === 'danger'
        ? PALETTE.red
        : detail.chapterContext?.law.severity === 'warning'
          ? PALETTE.gold
          : PALETTE.muted;
      addText(
        panel,
        'CombatChapterContextLaw',
        contextReadout.lawLine,
        0,
        -88,
        660,
        16,
        {
          fontSize: 12,
          color: contextColor,
          horizontal: Label.HorizontalAlign.CENTER,
          shrink: true,
        },
      );
      if (contextReadout.pursuitLine !== undefined) {
        addText(
          panel,
          'CombatChapterContextPursuit',
          contextReadout.pursuitLine,
          0,
          -102,
          660,
          14,
          {
            fontSize: 11,
            color: PALETTE.gold,
            horizontal: Label.HorizontalAlign.CENTER,
            shrink: true,
          },
        );
      }
    }
  }

  private renderBar(
    parent: Node,
    name: string,
    x: number,
    y: number,
    width: number,
    percent: number,
    fill: Color,
    text: string,
  ): void {
    const bar = addPanel(parent, name, x, y, width, 40, {
      fill: PALETTE.black,
      stroke: PALETTE.disabled,
      radius: 7,
    });
    const normalized = clamp(percent, 0, 100) / 100;
    if (normalized > 0) {
      addPanel(
        bar,
        'Fill',
        -(width - 8) / 2 + ((width - 8) * normalized) / 2,
        -11,
        (width - 8) * normalized,
        10,
        { fill, stroke: fill, lineWidth: 0, radius: 3 },
      );
    }
    addText(bar, 'Readout', text, 0, 7, width - 18, 22, {
      fontSize: 17,
      color: PALETTE.bone,
      horizontal: Label.HorizontalAlign.CENTER,
      shrink: true,
    });
  }

  private renderDeck(
    root: Node,
    model: GameViewModel,
    chrome: InfiniteFlowRuntimeChrome,
  ): void {
    const detail = model.sections[1].detail;
    const exploreDetail = model.phase === 'explore' && detail.kind === 'explore'
      ? detail
      : undefined;
    const hubDetail = model.phase === 'hub' && detail.kind === 'hub'
      ? detail
      : undefined;
    const hubControlDetail = hubDetail !== undefined
      && isInfiniteFlowHubControlPanel(hubDetail.activePanel)
      ? hubDetail
      : undefined;
    if (
      hubDetail !== undefined
      && hubControlDetail === undefined
      && this.hubActionSignature.length > 0
    ) {
      this.hubActionSignature = '';
      this.pageByDeck[0] = 0;
    }
    const showingExploreMap = this.deckIndex === 0
      && exploreDetail !== undefined
      && this.exploreDeckMode === 'map';
    const showingHubControlBoard = this.deckIndex === 0
      && hubControlDetail !== undefined;
    const showingCombatActions = this.deckIndex === 0
      && model.phase === 'combat'
      && detail.kind === 'combat';
    const exploreResultActionPhase: InfiniteFlowExploreResultActionPhase | undefined =
      this.deckIndex !== 0
        ? undefined
        : exploreDetail !== undefined && this.exploreDeckMode === 'commands'
          ? 'explore'
          : model.phase === 'result' && detail.kind === 'result'
            ? 'result'
            : undefined;
    const panel = addPanel(root, 'Deck', this.safeX(), this.safeY(DECK_TOP, DECK_HEIGHT), CONTENT_WIDTH, DECK_HEIGHT, {
      fill: PALETTE.visualSurface,
      stroke: this.deckIndex === 1 ? PALETTE.red : this.deckIndex === 2 ? PALETTE.gold : PALETTE.teal,
      lineWidth: 3,
    });
    const count = showingExploreMap
      ? exploreDetail.map.nodes.length
      : this.deckIndex === 0
      ? model.sections[2].actions.length
      : this.deckIndex === 1
        ? model.sections[3].items.length
        : this.deckIndex === 2
          ? model.sections[4].entries.length
          : model.sections[5].lines.length;
    const deckLabel = showingExploreMap
      ? '地图'
      : showingHubControlBoard
        ? hubControlDetail.activePanel === 'entry'
          ? '祭坛'
          : hubControlDetail.activePanelLabel
      : showingCombatActions
          ? '战术'
          : this.deckIndex === 0 && exploreDetail !== undefined
            ? '指令'
            : DECK_LABELS[this.deckIndex];
    addText(
      panel,
      'DeckTitle',
      `${this.deckIndex + 3} / 6 ${deckLabel} · ${count} 项`,
      -105,
      localY(DECK_HEIGHT, 6, 38),
      430,
      40,
      {
        fontSize: 25,
        color: this.deckIndex === 1 ? PALETTE.red : this.deckIndex === 2 ? PALETTE.gold : PALETTE.teal,
        shrink: true,
      },
    );
    addText(panel, 'DeckHint', showingExploreMap
      ? '3×3 视窗 · 仅绘真实邻边'
      : showingHubControlBoard
        ? hubControlDetail.activePanel === 'entry'
          ? `2×2 祭坛控制盘 · ${hubControlDetail.selectedDungeonName || '待选择副本'}`
          : `2×2 主神空间控制盘 · ${hubControlDetail.activePanelLabel}`
        : showingCombatActions
          ? '2×2 战术盘 · 单触控单指令'
          : exploreResultActionPhase === 'explore'
            ? '2×2 探索指令盘 · 单触控单指令'
            : exploreResultActionPhase === 'result'
              ? '2×2 结算抉择盘 · 单触控单指令'
          : '分页可达 · 核心动作优先', 220, localY(DECK_HEIGHT, 6, 38), 210, 34, {
      fontSize: 17,
      color: PALETTE.muted,
      horizontal: Label.HorizontalAlign.RIGHT,
      shrink: true,
    });

    if (this.deckIndex === 0) {
      if (showingExploreMap) {
        this.renderExploreMapDeck(
          panel,
          exploreDetail,
          model.sections[2].actions,
          chrome,
        );
      } else if (showingHubControlBoard) {
        this.renderHubActions(panel, hubControlDetail, model.sections[2].actions, chrome);
      } else if (showingCombatActions) {
        this.renderCombatActions(panel, model.sections[2].actions, chrome);
      } else if (exploreResultActionPhase !== undefined) {
        this.renderExploreResultActions(
          panel,
          exploreResultActionPhase,
          model.sections[2].actions,
          chrome,
          exploreResultActionPhase === 'explore'
            ? () => {
                this.exploreDeckMode = 'map';
                this.renderAgain();
              }
            : undefined,
        );
      } else {
        this.renderActions(
          panel,
          model.sections[2].actions,
          chrome,
          exploreDetail === undefined
            ? undefined
            : () => {
                this.exploreDeckMode = 'map';
                this.renderAgain();
              },
        );
      }
    } else if (this.deckIndex === 1) {
      this.renderRisks(panel, model.sections[3].items, model.phase === 'hub');
    } else if (this.deckIndex === 2) {
      this.renderHelpDirectory(panel, model.sections[4], chrome, model.phase === 'hub');
    } else {
      this.renderLogs(panel, model.sections[5].lines, model.phase === 'hub');
    }
  }

  private renderExploreMapDeck(
    panel: Node,
    detail: Extract<PhaseDetailViewModel, { kind: 'explore' }>,
    actions: readonly ViewActionModel[],
    chrome: InfiniteFlowRuntimeChrome,
  ): void {
    const map: MapViewModel = detail.map;
    const matchingCurrentNodes = map.nodes.filter((node) => (
      node.state === 'current' && node.nodeId === map.currentNodeId
    ));
    const current = matchingCurrentNodes.length === 1
      ? matchingCurrentNodes[0]
      : undefined;
    const currentCoordinatesValid = current !== undefined
      && Number.isInteger(current.x)
      && Number.isInteger(current.y)
      && current.x >= 0
      && current.y >= 0
      && current.x < map.width
      && current.y < map.height;
    const projectionValid = currentCoordinatesValid
      && detail.currentNode.nodeId === map.currentNodeId;
    const currentCoordinate = projectionValid && current !== undefined
      ? `${map.dungeonId}:${map.currentNodeId}:${current.x}:${current.y}`
      : `invalid:${map.dungeonId}`;
    const currentChanged = currentCoordinate !== this.exploreMapCurrentCoordinate;
    const layout = layoutInfiniteFlowMapWindow(
      map.width,
      map.height,
      projectionValid ? current?.x : undefined,
      projectionValid ? current?.y : undefined,
      currentChanged ? undefined : this.exploreMapOrigin,
    );
    this.exploreMapCurrentCoordinate = currentCoordinate;
    this.exploreMapOrigin = Object.freeze({
      x: layout.originX,
      y: layout.originY,
    });

    const gridSize = layout.columns * layout.cellSize
      + (layout.columns - 1) * layout.cellGap;
    const mapWindow = addPanel(
      panel,
      'ExploreMapWindow',
      EXPLORE_MAP_GRID_X,
      EXPLORE_MAP_GRID_Y,
      gridSize,
      gridSize,
      {
        fill: PALETTE.black,
        stroke: projectionValid ? PALETTE.teal : PALETTE.red,
        lineWidth: 3,
        radius: 12,
      },
    );
    const cellPosition = (column: number, row: number): Readonly<{ x: number; y: number }> => ({
      x: -gridSize / 2 + layout.cellSize / 2
        + column * (layout.cellSize + layout.cellGap),
      y: gridSize / 2 - layout.cellSize / 2
        - row * (layout.cellSize + layout.cellGap),
    });
    const visibleNodes = map.nodes.filter((node) => (
      Number.isInteger(node.x)
      && Number.isInteger(node.y)
      && node.x >= layout.originX
      && node.x < layout.originX + layout.columns
      && node.y >= layout.originY
      && node.y < layout.originY + layout.rows
    ));
    const visibleCurrent = projectionValid
      ? visibleNodes.find((node) => node === current)
      : undefined;
    if (visibleCurrent !== undefined) {
      const currentPosition = cellPosition(
        visibleCurrent.x - layout.originX,
        visibleCurrent.y - layout.originY,
      );
      const topology = addNode(mapWindow, 'ExploreMapTopology', 0, 0, gridSize, gridSize);
      const graphics = topology.addComponent(Graphics);
      graphics.strokeColor = PALETTE.teal;
      graphics.lineWidth = 3;
      for (const node of visibleNodes) {
        if (!node.isAdjacent || node === visibleCurrent) continue;
        const adjacentPosition = cellPosition(
          node.x - layout.originX,
          node.y - layout.originY,
        );
        graphics.moveTo(currentPosition.x, currentPosition.y);
        graphics.lineTo(adjacentPosition.x, adjacentPosition.y);
      }
      graphics.stroke();
    }

    for (let row = 0; row < layout.rows; row += 1) {
      for (let column = 0; column < layout.columns; column += 1) {
        const mapX = layout.originX + column;
        const mapY = layout.originY + row;
        const position = cellPosition(column, row);
        const node = visibleNodes.find((candidate) => (
          candidate.x === mapX && candidate.y === mapY
        ));
        if (node === undefined) {
          const empty = addPanel(
            mapWindow,
            `MapWindowEmpty:${mapX}:${mapY}`,
            position.x,
            position.y,
            layout.cellSize,
            layout.cellSize,
            {
              fill: PALETTE.raisedQuiet,
              stroke: PALETTE.raised,
              lineWidth: 1,
              radius: 9,
            },
          );
          addText(empty, 'Empty', '·', 0, 0, 70, 70, {
            fontSize: 28,
            color: PALETTE.muted,
            horizontal: Label.HorizontalAlign.CENTER,
          });
          continue;
        }

        const match = matchInfiniteFlowMapMoveAction(node, actions, {
          busy: chrome.busyActionId !== undefined,
          blocked: chrome.modeKind === 'blocked',
          projectionValid,
        });
        const hidden = node.state === 'fogged';
        const ready = match.status === 'ready';
        const currentNode = node.state === 'current';
        const cell = addPanel(
          mapWindow,
          `MapWindowCell:${mapX}:${mapY}`,
          position.x,
          position.y,
          layout.cellSize,
          layout.cellSize,
          {
            fill: currentNode
              ? PALETTE.goldDark
              : ready
                ? PALETTE.tealDark
                : PALETTE.raisedQuiet,
            stroke: node.canMove && !ready
              ? PALETTE.red
              : stateColor(node.state),
            lineWidth: currentNode || ready ? 4 : 2,
            radius: 11,
          },
        );
        const symbol = hidden ? '?' : node.stateSymbol;
        const stateLabel = currentNode
          ? '当前'
          : ready
            ? '可移动'
            : hidden
              ? '迷雾'
              : node.stateLabel;
        const title = hidden ? '未知区域' : node.title;
        const interactionLabel = hidden && !ready
          ? '不可移动'
          : mapMoveStatusLabel(match.status);
        addText(
          cell,
          'MapCellReadout',
          `${ready || currentNode ? symbol : '×'} ${stateLabel}\n${title}\n${interactionLabel}`,
          0,
          0,
          layout.cellSize - 10,
          layout.cellSize - 10,
          {
            fontSize: 16,
            lineHeight: 20,
            color: currentNode
              ? PALETTE.gold
              : ready
                ? PALETTE.bone
                : PALETTE.muted,
            horizontal: Label.HorizontalAlign.CENTER,
            vertical: Label.VerticalAlign.CENTER,
            wrap: true,
            shrink: true,
          },
        );
        if (match.status === 'ready') {
          const action = match.action;
          this.bindPhysical(cell, true, (physicalId) => {
            this.delegate.activate(physicalId, action.actionId, action.event);
          });
        }
      }
    }

    this.renderNavigationButton(
      panel,
      'ExploreMapPanUp',
      '↑ 上移',
      EXPLORE_MAP_CONTROL_LEFT_X,
      162,
      EXPLORE_MAP_CONTROL_WIDTH,
      layout.canPanUp,
      () => this.panExploreMap(layout.originX, layout.originY - 1),
    );
    this.renderNavigationButton(
      panel,
      'ExploreCommandsToggle',
      '指令',
      EXPLORE_MAP_CONTROL_RIGHT_X,
      162,
      EXPLORE_MAP_CONTROL_WIDTH,
      true,
      () => {
        this.exploreDeckMode = 'commands';
        this.renderAgain();
      },
    );
    this.renderNavigationButton(
      panel,
      'ExploreMapPanLeft',
      '← 左移',
      EXPLORE_MAP_CONTROL_LEFT_X,
      52,
      EXPLORE_MAP_CONTROL_WIDTH,
      layout.canPanLeft,
      () => this.panExploreMap(layout.originX - 1, layout.originY),
    );
    this.renderNavigationButton(
      panel,
      'ExploreMapPanRight',
      '右移 →',
      EXPLORE_MAP_CONTROL_RIGHT_X,
      52,
      EXPLORE_MAP_CONTROL_WIDTH,
      layout.canPanRight,
      () => this.panExploreMap(layout.originX + 1, layout.originY),
    );
    this.renderNavigationButton(
      panel,
      'ExploreMapPanDown',
      '↓ 下移',
      EXPLORE_MAP_CONTROL_LEFT_X,
      -58,
      EXPLORE_MAP_CONTROL_WIDTH,
      layout.canPanDown,
      () => this.panExploreMap(layout.originX, layout.originY + 1),
    );
    const viewport = addPanel(
      panel,
      'ExploreMapViewportReadout',
      EXPLORE_MAP_CONTROL_RIGHT_X,
      -58,
      EXPLORE_MAP_CONTROL_WIDTH,
      EXPLORE_MAP_CONTROL_HEIGHT,
      {
        fill: PALETTE.raisedQuiet,
        stroke: projectionValid ? PALETTE.gold : PALETTE.red,
        lineWidth: 2,
        radius: 12,
      },
    );
    addText(
      viewport,
      'Label',
      projectionValid
        ? `视窗\nX ${layout.originX + 1}–${Math.min(map.width, layout.originX + layout.columns)}\nY ${layout.originY + 1}–${Math.min(map.height, layout.originY + layout.rows)}`
        : '× 地图投影\n异常\n请使用指令',
      0,
      0,
      EXPLORE_MAP_CONTROL_WIDTH - 16,
      EXPLORE_MAP_CONTROL_HEIGHT - 12,
      {
        fontSize: 18,
        lineHeight: 24,
        color: projectionValid ? PALETTE.gold : PALETTE.red,
        horizontal: Label.HorizontalAlign.CENTER,
        vertical: Label.VerticalAlign.CENTER,
        wrap: true,
        shrink: true,
      },
    );
  }

  private panExploreMap(x: number, y: number): void {
    this.exploreMapOrigin = Object.freeze({ x, y });
    this.renderAgain();
  }

  private renderExploreResultActions(
    panel: Node,
    phase: InfiniteFlowExploreResultActionPhase,
    actions: readonly ViewActionModel[],
    chrome: InfiniteFlowRuntimeChrome,
    returnToExploreMap?: () => void,
  ): void {
    const orderedActions = orderActionsForCompactReachability(actions);
    const layout = layoutInfiniteFlowExploreResultActionDeck(
      orderedActions.length,
      this.pageByDeck[0],
    );
    this.pageByDeck[0] = layout.page;
    const visible = orderedActions.slice(layout.visibleStart, layout.visibleEnd);
    if (visible.length === 0) {
      addText(panel, 'NoActions', '当前没有可执行动作。×', 0, 38, 620, 180, {
        fontSize: 30,
        color: PALETTE.muted,
        horizontal: Label.HorizontalAlign.CENTER,
      });
    }
    for (let index = 0; index < visible.length; index += 1) {
      const action = visible[index];
      const slot = layout.slots[index];
      if (action === undefined || slot === undefined) continue;
      this.renderExploreResultActionButton(panel, phase, action, slot, chrome);
    }
    this.renderPageControls(
      panel,
      0,
      layout.page,
      layout.pageCount,
      returnToExploreMap === undefined
        ? undefined
        : {
            name: 'ExploreMapToggle',
            label: `地图 · ${layout.page + 1}/${layout.pageCount}`,
            activate: returnToExploreMap,
          },
      true,
    );
  }

  private renderExploreResultActionButton(
    panel: Node,
    phase: InfiniteFlowExploreResultActionPhase,
    action: ViewActionModel,
    slot: InfiniteFlowExploreResultActionDeckLayout['slots'][number],
    chrome: InfiniteFlowRuntimeChrome,
  ): void {
    const busy = chrome.busyActionId !== undefined;
    const blocked = chrome.modeKind === 'blocked';
    const enabled = action.enabled && action.event !== undefined && !busy && !blocked;
    const danger = enabled
      && (action.recommendation === 'high-risk' || action.emphasis === 'danger');
    const recommended = enabled && action.recommendation === 'recommended';
    const stroke = !enabled
      ? PALETTE.disabled
      : danger
        ? PALETTE.red
        : recommended
          ? PALETTE.gold
          : PALETTE.teal;
    const fill = !enabled
      ? PALETTE.raisedQuiet
      : danger
        ? PALETTE.redDark
        : recommended
          ? PALETTE.goldDark
          : PALETTE.tealDark;
    const stateLabel = !enabled
      ? '× 锁定'
      : danger
        ? '!! 危险'
        : recommended
          ? '★ 推荐'
          : '• 可用';
    const lockedReason = !action.enabled
      ? compactActionPlayerCopy(
          action.disabledReason,
          action,
          '当前选项不可用。',
        )
      : action.event === undefined
        ? '选项事件缺失。'
        : blocked
          ? '运行已阻断。'
          : busy
            ? '行动处理中。'
            : '当前选项不可用。';
    const readout = enabled
      ? formatInfiniteFlowExploreResultActionSummary(phase, action)
      : lockedReason;
    const button = addPanel(
      panel,
      `Action:${action.actionId}`,
      slot.x,
      slot.y,
      slot.width,
      slot.height,
      {
        fill,
        stroke,
        lineWidth: enabled && (danger || recommended) ? 4 : 2,
        radius: 13,
      },
    );
    addText(
      button,
      'ExploreResultActionGlyph',
      classifyInfiniteFlowExploreResultActionGlyph(phase, action),
      -127,
      39,
      48,
      52,
      {
        fontSize: 38,
        color: stroke,
        horizontal: Label.HorizontalAlign.CENTER,
        shrink: true,
      },
    );
    addText(
      button,
      'ActionLabel',
      formatInfiniteFlowExploreResultActionLabel(phase, action),
      15,
      44,
      220,
      42,
      {
        fontSize: 23,
        color: enabled ? PALETTE.bone : PALETTE.muted,
        shrink: true,
      },
    );
    addText(button, 'ActionState', stateLabel, -60, 7, 160, 28, {
      fontSize: 18,
      color: stroke,
      shrink: true,
    });
    addText(button, 'Placement', `[${actionTag(action)}]`, 103, 7, 92, 28, {
      fontSize: 16,
      color: stroke,
      horizontal: Label.HorizontalAlign.RIGHT,
      shrink: true,
    });
    addText(button, 'ActionReadout', readout, 0, -43, 286, 56, {
      fontSize: 16,
      color: !enabled ? PALETTE.muted : action.riskReason ? PALETTE.red : PALETTE.bone,
      vertical: Label.VerticalAlign.TOP,
      wrap: true,
      shrink: true,
    });
    if (enabled && action.event !== undefined) {
      const event = action.event;
      const renderedRoot = this.root;
      this.bindPhysical(button, true, (physicalId) => {
        if (this.root !== renderedRoot) return;
        this.delegate.activate(physicalId, action.actionId, event);
      });
    }
  }

  private renderActions(
    panel: Node,
    actions: readonly ViewActionModel[],
    chrome: InfiniteFlowRuntimeChrome,
    returnToExploreMap?: () => void,
  ): void {
    const orderedActions = orderActionsForCompactReachability(actions);
    const pageSize = 3;
    const pageCount = deckPageCount(orderedActions.length, pageSize);
    const page = clamp(this.pageByDeck[0] ?? 0, 0, pageCount - 1);
    this.pageByDeck[0] = page;
    const visible = orderedActions.slice(page * pageSize, page * pageSize + pageSize);
    if (visible.length === 0) {
      addText(panel, 'NoActions', '当前没有可执行动作。×', 0, 38, 620, 180, {
        fontSize: 30,
        color: PALETTE.muted,
        horizontal: Label.HorizontalAlign.CENTER,
      });
    }
    for (let index = 0; index < visible.length; index += 1) {
      const action = visible[index];
      if (action === undefined) continue;
      this.renderActionButton(panel, action, index, chrome);
    }
    this.renderPageControls(
      panel,
      0,
      page,
      pageCount,
      returnToExploreMap === undefined
        ? undefined
        : {
            name: 'ExploreMapToggle',
            label: `地图 · ${page + 1}/${pageCount}`,
            activate: returnToExploreMap,
          },
    );
  }

  private renderHubActions(
    panel: Node,
    detail: Extract<PhaseDetailViewModel, { kind: 'hub' }>,
    actions: readonly ViewActionModel[],
    chrome: InfiniteFlowRuntimeChrome,
  ): void {
    const signature = `${detail.activePanel}\u001e${actions.map(({ actionId }) => actionId).join('\u001f')}`;
    if (signature !== this.hubActionSignature) {
      this.hubActionSignature = signature;
      this.pageByDeck[0] = 0;
    }
    const orderedActions = orderActionsForCompactReachability(actions);
    const layout = layoutInfiniteFlowHubControlDeck(
      orderedActions.length,
      this.pageByDeck[0],
    );
    this.pageByDeck[0] = layout.page;
    const visible = orderedActions.slice(layout.visibleStart, layout.visibleEnd);
    if (visible.length === 0) {
      addText(panel, 'NoActions', `${detail.activePanelLabel}当前没有可用选项。×`, 0, 38, 620, 180, {
        fontSize: 30,
        color: PALETTE.muted,
        horizontal: Label.HorizontalAlign.CENTER,
      });
    }
    for (let index = 0; index < visible.length; index += 1) {
      const action = visible[index];
      const slot = layout.slots[index];
      if (action === undefined || slot === undefined) continue;
      this.renderHubActionButton(panel, action, slot, chrome);
    }
    this.renderPageControls(panel, 0, layout.page, layout.pageCount, undefined, true);
  }

  private renderHubActionButton(
    panel: Node,
    action: ViewActionModel,
    slot: InfiniteFlowHubControlDeckLayout['slots'][number],
    chrome: InfiniteFlowRuntimeChrome,
  ): void {
    const busy = chrome.busyActionId !== undefined;
    const blocked = chrome.modeKind === 'blocked';
    const enabled = action.enabled && action.event !== undefined && !busy && !blocked;
    const danger = enabled
      && (action.recommendation === 'high-risk' || action.emphasis === 'danger');
    const recommended = enabled && action.recommendation === 'recommended';
    const stroke = !enabled
      ? PALETTE.disabled
      : danger
        ? PALETTE.red
        : recommended
          ? PALETTE.gold
          : PALETTE.teal;
    const fill = !enabled
      ? PALETTE.raisedQuiet
      : danger
        ? PALETTE.redDark
        : recommended
          ? PALETTE.goldDark
          : PALETTE.tealDark;
    const stateLabel = !enabled
      ? '× 锁定'
      : danger
        ? '!! 危险'
        : recommended
          ? '★ 推荐'
          : '• 可用';
    const lockedReason = !action.enabled
      ? formatInfiniteFlowHubActionLockedReason(action)
      : action.event === undefined
        ? '选项事件缺失。'
        : blocked
          ? '运行已阻断。'
          : busy
            ? '行动处理中。'
            : '当前选项不可用。';
    const readout = enabled
      ? formatInfiniteFlowHubActionShortCopy(action)
      : lockedReason;
    const button = addPanel(
      panel,
      `Action:${action.actionId}`,
      slot.x,
      slot.y,
      slot.width,
      slot.height,
      {
        fill,
        stroke,
        lineWidth: enabled && (danger || recommended) ? 4 : 2,
        radius: 13,
      },
    );
    addText(button, 'HubActionGlyph', classifyInfiniteFlowHubActionGlyph(action), -127, 39, 48, 52, {
      fontSize: 38,
      color: stroke,
      horizontal: Label.HorizontalAlign.CENTER,
      shrink: true,
    });
    addText(button, 'ActionLabel', formatInfiniteFlowHubActionLabel(action), 15, 44, 220, 42, {
      fontSize: 23,
      color: enabled ? PALETTE.bone : PALETTE.muted,
      shrink: true,
    });
    addText(button, 'ActionState', stateLabel, -60, 7, 160, 28, {
      fontSize: 18,
      color: stroke,
      shrink: true,
    });
    addText(button, 'Placement', `[${actionTag(action)}]`, 103, 7, 92, 28, {
      fontSize: 16,
      color: stroke,
      horizontal: Label.HorizontalAlign.RIGHT,
      shrink: true,
    });
    addText(button, 'ActionReadout', readout, 0, -43, 286, 56, {
      fontSize: 16,
      color: !enabled ? PALETTE.muted : action.riskReason ? PALETTE.red : PALETTE.bone,
      vertical: Label.VerticalAlign.TOP,
      wrap: true,
      shrink: true,
    });
    if (enabled && action.event !== undefined) {
      const event = action.event;
      const renderedRoot = this.root;
      this.bindPhysical(button, true, (physicalId) => {
        if (this.root !== renderedRoot) return;
        this.delegate.activate(physicalId, action.actionId, event);
      });
    }
  }

  private renderCombatActions(
    panel: Node,
    actions: readonly ViewActionModel[],
    chrome: InfiniteFlowRuntimeChrome,
  ): void {
    const orderedActions = orderActionsForCompactReachability(actions);
    const layout = layoutInfiniteFlowCombatActionDeck(
      orderedActions.length,
      this.pageByDeck[0],
    );
    this.pageByDeck[0] = layout.page;
    const visible = orderedActions.slice(layout.visibleStart, layout.visibleEnd);
    if (visible.length === 0) {
      addText(panel, 'NoActions', '当前没有可执行战术。×', 0, 38, 620, 180, {
        fontSize: 30,
        color: PALETTE.muted,
        horizontal: Label.HorizontalAlign.CENTER,
      });
    }
    for (let index = 0; index < visible.length; index += 1) {
      const action = visible[index];
      const slot = layout.slots[index];
      if (action === undefined || slot === undefined) continue;
      this.renderCombatActionButton(panel, action, slot, chrome);
    }
    this.renderPageControls(panel, 0, layout.page, layout.pageCount);
  }

  private renderCombatActionButton(
    panel: Node,
    action: ViewActionModel,
    slot: InfiniteFlowCombatActionDeckLayout['slots'][number],
    chrome: InfiniteFlowRuntimeChrome,
  ): void {
    const busy = chrome.busyActionId !== undefined;
    const blocked = chrome.modeKind === 'blocked';
    const enabled = action.enabled && action.event !== undefined && !busy && !blocked;
    const danger = action.recommendation === 'high-risk' || action.emphasis === 'danger';
    const recommended = action.recommendation === 'recommended';
    const stroke = !enabled
      ? PALETTE.disabled
      : danger
        ? PALETTE.red
        : recommended
          ? PALETTE.gold
          : PALETTE.teal;
    const fill = !enabled
      ? PALETTE.raisedQuiet
      : danger
        ? PALETTE.redDark
        : recommended
          ? PALETTE.goldDark
          : PALETTE.tealDark;
    const stateLabel = !enabled
      ? '× 锁定'
      : danger
        ? '!! 危险'
        : recommended
          ? '★ 推荐'
          : '• 可用';
    const fallbackReadout = !action.enabled
      ? '当前动作不可用。'
      : action.event === undefined
        ? '动作事件缺失。'
        : blocked
          ? '运行已阻断。'
          : busy
            ? '指令提交中。'
            : '点击施放';
    const button = addPanel(
      panel,
      `Action:${action.actionId}`,
      slot.x,
      slot.y,
      slot.width,
      slot.height,
      {
        fill,
        stroke,
        lineWidth: enabled && (danger || recommended) ? 4 : 2,
        radius: 13,
      },
    );
    addText(button, 'CombatActionGlyph', combatActionGlyph(action), -127, 39, 48, 52, {
      fontSize: 38,
      color: stroke,
      horizontal: Label.HorizontalAlign.CENTER,
      shrink: true,
    });
    addText(button, 'ActionLabel', action.label, 15, 44, 220, 42, {
      fontSize: 23,
      color: enabled ? PALETTE.bone : PALETTE.muted,
      shrink: true,
    });
    addText(button, 'ActionState', stateLabel, -60, 7, 160, 28, {
      fontSize: 18,
      color: stroke,
      shrink: true,
    });
    addText(button, 'Placement', `[${actionTag(action)}]`, 103, 7, 92, 28, {
      fontSize: 16,
      color: stroke,
      horizontal: Label.HorizontalAlign.RIGHT,
      shrink: true,
    });
    addText(
      button,
      'ActionReadout',
      action.disabledReason ?? action.riskReason ?? action.readout ?? fallbackReadout,
      0,
      -43,
      286,
      56,
      {
        fontSize: 16,
        color: action.disabledReason || action.riskReason ? PALETTE.red : PALETTE.bone,
        vertical: Label.VerticalAlign.TOP,
        wrap: true,
        shrink: true,
      },
    );
    if (enabled && action.event !== undefined) {
      const event = action.event;
      const renderedRoot = this.root;
      this.bindPhysical(button, true, (physicalId) => {
        if (this.root !== renderedRoot) return;
        this.delegate.activate(physicalId, action.actionId, event);
      });
    }
  }

  private renderActionButton(
    panel: Node,
    action: ViewActionModel,
    index: number,
    chrome: InfiniteFlowRuntimeChrome,
  ): void {
    const isBusy = chrome.busyActionId !== undefined;
    const enabled = action.enabled && action.event !== undefined && !isBusy && chrome.modeKind !== 'blocked';
    const danger = action.recommendation === 'high-risk' || action.emphasis === 'danger';
    const recommended = action.recommendation === 'recommended';
    const stroke = !action.enabled ? PALETTE.disabled : danger ? PALETTE.red : recommended ? PALETTE.gold : PALETTE.teal;
    const fill = !action.enabled ? PALETTE.raisedQuiet : danger ? PALETTE.redDark : recommended ? PALETTE.goldDark : PALETTE.tealDark;
    const button = addPanel(
      panel,
      `Action:${action.actionId}`,
      0,
      localY(DECK_HEIGHT, 50 + index * 120, PRIMARY_TOUCH_HEIGHT),
      650,
      PRIMARY_TOUCH_HEIGHT,
      { fill, stroke, lineWidth: danger || recommended ? 4 : 2, radius: 13 },
    );
    const marker = actionMarker(action);
    addText(button, 'ActionLabel', `${marker} ${action.label}`, -66, 22, 470, 48, {
      fontSize: 27,
      color: !action.enabled ? PALETTE.muted : danger ? PALETTE.red : recommended ? PALETTE.gold : PALETTE.bone,
      shrink: true,
    });
    addText(button, 'Placement', `[${actionTag(action)}]`, 252, 22, 110, 40, {
      fontSize: 18,
      color: stroke,
      horizontal: Label.HorizontalAlign.RIGHT,
      shrink: true,
    });
    const readout = action.disabledReason
      ?? action.riskReason
      ?? action.readout
      ?? (chrome.busyActionId === action.actionId ? '提交中；本次物理触控只会发送一次。' : '点击执行');
    addText(button, 'ActionReadout', readout, 0, -29, 602, 44, {
      fontSize: 18,
      color: action.disabledReason ? PALETTE.muted : action.riskReason ? PALETTE.red : PALETTE.bone,
      vertical: Label.VerticalAlign.TOP,
      shrink: true,
    });
    if (danger) {
      const graphics = button.getComponent(Graphics);
      if (graphics !== null) {
        graphics.strokeColor = PALETTE.red;
        graphics.moveTo(-309, -47);
        graphics.lineTo(-315, -41);
        graphics.lineTo(-315, 41);
        graphics.lineTo(-309, 47);
        graphics.stroke();
      }
    }
    if (!action.enabled) {
      const graphics = button.getComponent(Graphics);
      if (graphics !== null) {
        graphics.moveTo(-310, -42);
        graphics.lineTo(-278, -10);
        graphics.moveTo(-278, -42);
        graphics.lineTo(-310, -10);
        graphics.stroke();
      }
    }
    if (enabled && action.event !== undefined) {
      const event = action.event;
      this.bindPhysical(button, true, (physicalId) => {
        this.delegate.activate(physicalId, action.actionId, event);
      });
    }
  }

  private renderRisks(
    panel: Node,
    risks: GameViewModel['sections'][3]['items'],
    hubPlayerCopy: boolean,
  ): void {
    const pageSize = 3;
    const pageCount = deckPageCount(risks.length, pageSize);
    const page = clamp(this.pageByDeck[1] ?? 0, 0, pageCount - 1);
    this.pageByDeck[1] = page;
    const visible = risks.slice(page * pageSize, page * pageSize + pageSize);
    if (visible.length === 0) {
      addText(panel, 'NoRisks', '✓ 暂无额外风险；仍需按动作读数判断。', 0, 36, 620, 150, {
        fontSize: 28,
        color: PALETTE.teal,
        horizontal: Label.HorizontalAlign.CENTER,
      });
    }
    for (let index = 0; index < visible.length; index += 1) {
      const risk = visible[index];
      if (risk === undefined) continue;
      const danger = risk.severity === 'danger';
      const card = addPanel(
        panel,
        `Risk:${risk.id}`,
        0,
        localY(DECK_HEIGHT, 50 + index * 120, PRIMARY_TOUCH_HEIGHT),
        650,
        PRIMARY_TOUCH_HEIGHT,
        {
          fill: danger ? PALETTE.redDark : PALETTE.raisedQuiet,
          stroke: danger ? PALETTE.red : risk.severity === 'warning' ? PALETTE.gold : PALETTE.muted,
          lineWidth: danger ? 4 : 2,
          radius: 12,
        },
      );
      const riskLabel = hubPlayerCopy
        ? formatInfiniteFlowHubPlayerCopy(risk.label, '未知风险')
        : risk.label;
      const riskReason = hubPlayerCopy
        ? formatInfiniteFlowHubPlayerCopy(risk.reason)
        : risk.reason;
      addText(card, 'RiskLabel', `${danger ? '!!' : risk.severity === 'warning' ? '!' : '△'} ${riskLabel}`, 0, 25, 610, 40, {
        fontSize: 25,
        color: danger ? PALETTE.red : risk.severity === 'warning' ? PALETTE.gold : PALETTE.bone,
        shrink: true,
      });
      addText(card, 'RiskReason', riskReason, 0, -23, 610, 48, {
        fontSize: 19,
        color: PALETTE.muted,
        vertical: Label.VerticalAlign.TOP,
        wrap: true,
      });
    }
    this.renderPageControls(panel, 1, page, pageCount);
  }

  private renderHelpDirectory(
    panel: Node,
    help: HelpSection,
    chrome: InfiniteFlowRuntimeChrome,
    hubPlayerCopy: boolean,
  ): void {
    const pageSize = 3;
    const pageCount = deckPageCount(help.entries.length, pageSize);
    const page = clamp(this.pageByDeck[2] ?? 0, 0, pageCount - 1);
    this.pageByDeck[2] = page;
    const visible = help.entries.slice(page * pageSize, page * pageSize + pageSize);
    for (let index = 0; index < visible.length; index += 1) {
      const entry = visible[index];
      if (entry === undefined) continue;
      const button = addPanel(
        panel,
        `HelpTopic:${entry.id}`,
        0,
        localY(DECK_HEIGHT, 50 + index * 120, PRIMARY_TOUCH_HEIGHT),
        650,
        PRIMARY_TOUCH_HEIGHT,
        { fill: PALETTE.goldDark, stroke: PALETTE.gold, lineWidth: 3, radius: 12 },
      );
      const helpTitle = hubPlayerCopy
        ? formatInfiniteFlowHubPlayerCopy(entry.title, '帮助')
        : entry.title;
      const helpSummary = hubPlayerCopy
        ? formatInfiniteFlowHubPlayerCopy(entry.summary)
        : entry.summary;
      addText(button, 'HelpTitle', `? ${helpTitle}`, 0, 25, 608, 42, {
        fontSize: 27,
        color: PALETTE.gold,
        shrink: true,
      });
      addText(button, 'HelpSummary', helpSummary, 0, -23, 608, 48, {
        fontSize: 18,
        color: PALETTE.bone,
        vertical: Label.VerticalAlign.TOP,
        wrap: true,
      });
      const enabled = chrome.busyActionId === undefined && chrome.modeKind !== 'blocked';
      this.bindPhysical(button, enabled, (physicalId) => {
        this.delegate.activate(physicalId, entry.openAction.actionId, entry.openAction.event);
      });
    }
    this.renderPageControls(panel, 2, page, pageCount);
  }

  private renderLogs(
    panel: Node,
    lines: readonly string[],
    hubPlayerCopy: boolean,
  ): void {
    const pageSize = 7;
    const pageCount = deckPageCount(lines.length, pageSize);
    const page = clamp(this.pageByDeck[3] ?? 0, 0, pageCount - 1);
    this.pageByDeck[3] = page;
    const visible = lines.slice(page * pageSize, page * pageSize + pageSize);
    if (visible.length === 0) {
      addText(panel, 'NoLogs', '日志为空。', 0, 42, 620, 140, {
        fontSize: 28,
        color: PALETTE.muted,
        horizontal: Label.HorizontalAlign.CENTER,
      });
    }
    for (let index = 0; index < visible.length; index += 1) {
      const line = visible[index];
      if (line === undefined) continue;
      const y = localY(DECK_HEIGHT, 52 + index * 49, 42);
      addText(
        panel,
        `Log:${page * pageSize + index}`,
        `· ${hubPlayerCopy ? formatInfiniteFlowHubPlayerCopy(line) : line}`,
        0,
        y,
        642,
        42,
        {
        fontSize: 19,
        color: index === 0 ? PALETTE.bone : PALETTE.muted,
        shrink: true,
        },
      );
    }
    this.renderPageControls(panel, 3, page, pageCount);
  }

  private renderPageControls(
    panel: Node,
    deckIndex: number,
    page: number,
    pageCount: number,
    centerControl?: Readonly<{
      name: string;
      label: string;
      activate: () => void;
    }>,
    currentRootOnly = false,
  ): void {
    const renderedRoot = this.root;
    const y = localY(DECK_HEIGHT, 428, MINIMUM_TOUCH_HEIGHT);
    const previous = this.renderNavigationButton(panel, 'PagePrevious', '‹ 上一页', -225, y, 190, page > 0, () => {
      if (currentRootOnly && this.root !== renderedRoot) return;
      this.pageByDeck[deckIndex] = page - 1;
      this.renderAgain();
    });
    const next = this.renderNavigationButton(panel, 'PageNext', '下一页 ›', 225, y, 190, page + 1 < pageCount, () => {
      if (currentRootOnly && this.root !== renderedRoot) return;
      this.pageByDeck[deckIndex] = page + 1;
      this.renderAgain();
    });
    if (centerControl === undefined) {
      addText(panel, 'PageCount', `${page + 1} / ${pageCount}`, 0, y, 190, MINIMUM_TOUCH_HEIGHT, {
        fontSize: 24,
        color: PALETTE.gold,
        horizontal: Label.HorizontalAlign.CENTER,
      });
    } else {
      this.renderNavigationButton(
        panel,
        centerControl.name,
        centerControl.label,
        0,
        y,
        190,
        true,
        () => {
          if (currentRootOnly && this.root !== renderedRoot) return;
          centerControl.activate();
        },
      );
    }
    void previous;
    void next;
  }

  private renderFooter(root: Node): void {
    const footer = addPanel(root, 'SectionNavigation', this.safeX(), this.safeY(FOOTER_TOP, FOOTER_HEIGHT), CONTENT_WIDTH, FOOTER_HEIGHT, {
      fill: PALETTE.visualSurfaceQuiet,
      stroke: PALETTE.teal,
      radius: 12,
    });
    this.renderNavigationButton(footer, 'PreviousSection', '‹ 上一栏', -237, 0, 218, this.deckIndex > 0, () => {
      this.deckIndex -= 1;
      this.renderAgain();
    });
    this.renderNavigationButton(footer, 'NextSection', '下一栏 ›', 0, 0, 218, this.deckIndex < 3, () => {
      this.deckIndex += 1;
      this.renderAgain();
    });

    this.renderNavigationButton(footer, 'SceneReturn', '返回场景', 237, 0, 218, true, () => {
      this.detailsOpen = false;
      this.renderAgain();
    });
  }

  private renderNavigationButton(
    parent: Node,
    name: string,
    label: string,
    x: number,
    y: number,
    width: number,
    enabled: boolean,
    activate: () => void,
  ): Node {
    const button = addPanel(parent, name, x, y, width, MINIMUM_TOUCH_HEIGHT, {
      fill: enabled ? PALETTE.tealDark : PALETTE.raisedQuiet,
      stroke: enabled ? PALETTE.teal : PALETTE.disabled,
      lineWidth: enabled ? 3 : 2,
      radius: 12,
    });
    addText(button, 'Label', enabled ? label : `× ${label}`, 0, 0, width - 18, 76, {
      fontSize: 24,
      color: enabled ? PALETTE.bone : PALETTE.disabled,
      horizontal: Label.HorizontalAlign.CENTER,
      shrink: true,
    });
    this.bindPhysical(button, enabled, () => activate());
    return button;
  }

  private renderHelpOverlay(
    root: Node,
    help: HelpSection,
    chrome: InfiniteFlowRuntimeChrome,
    hubPlayerCopy: boolean,
  ): void {
    const active = help.active;
    if (active === undefined) return;
    const overlay = addPanel(root, 'HelpOverlayBlocker', 0, 0, DESIGN_WIDTH, this.surfaceHeight, {
      fill: PALETTE.backgroundOpaque,
      stroke: PALETTE.backgroundOpaque,
      lineWidth: 0,
      radius: 0,
    });
    overlay.addComponent(BlockInputEvents);
    const helpHeight = Math.min(
      1140,
      this.surfaceHeight - this.lastSafeInsets.top - this.lastSafeInsets.bottom,
    );
    const panel = addPanel(overlay, 'HelpDialog', this.safeX(), this.safeCenterY(), CONTENT_WIDTH, helpHeight, {
      fill: PALETTE.raised,
      stroke: PALETTE.gold,
      lineWidth: 5,
      radius: 20,
    });
    const activeIndex = Math.max(0, help.entries.findIndex((entry) => entry.id === active.id));
    addText(panel, 'HelpKicker', `? 帮助 ${activeIndex + 1} / ${Math.max(1, help.entries.length)}`, -185, localY(helpHeight, 18, 42), 280, 40, {
      fontSize: 25,
      color: PALETTE.gold,
    });
    const playerCopy = (value: string, fallback?: string): string => (
      hubPlayerCopy
        ? formatInfiniteFlowHubPlayerCopy(value, fallback)
        : value
    );
    addText(panel, 'HelpTitle', playerCopy(active.title, '帮助'), 0, localY(helpHeight, 62, 60), 632, 56, {
      fontSize: 38,
      color: PALETTE.bone,
      horizontal: Label.HorizontalAlign.CENTER,
      shrink: true,
    });

    const sections = [
      {
        title: '概要',
        paragraphs: [
          playerCopy(active.summary),
          `关键词：${playerCopy(active.keywords.join(' · '))}`,
        ],
      },
      { title: '机制', paragraphs: [playerCopy(active.mechanic)] },
      { title: '行动建议', paragraphs: [playerCopy(active.guidance)] },
      { title: '界面读数', paragraphs: [playerCopy(active.readout)] },
    ];

    // Normal display copy scrolls as one cut-corner document instead of
    // splitting 概要/机制/行动建议/界面读数 across paged screens.
    const HELP_VIEW_TOP = 130;
    const HELP_VIEW_BOTTOM = 688;
    const HELP_VIEW_HEIGHT = helpHeight - HELP_VIEW_TOP - HELP_VIEW_BOTTOM;
    const HELP_SCROLL_WIDTH = 638;
    const holder = addNode(panel, 'HelpScroll', 0, localY(helpHeight, HELP_VIEW_TOP, HELP_VIEW_HEIGHT), HELP_SCROLL_WIDTH, HELP_VIEW_HEIGHT);
    holder.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;

    const HELP_CARD_SIDE = 20;
    const HELP_CARD_WIDTH = HELP_SCROLL_WIDTH - 2 * HELP_CARD_SIDE;
    const HELP_TITLE_FONT = 29;
    const HELP_BODY_FONT = 26;
    const HELP_LINE_HEIGHT = 38;
    const HELP_CARD_PAD = 24;
    const HELP_TITLE_GAP = 16;
    const HELP_CARD_FOOT = 22;
    const HELP_CARD_GAP = 16;
    const HELP_CARD_PAD_TOP = 8;
    const HELP_CARD_PAD_BOTTOM = 8;
    const HELP_TEXT_WIDTH = HELP_CARD_WIDTH - 48;
    const HELP_MAX_UNITS = Math.floor((HELP_TEXT_WIDTH - 12) / HELP_BODY_FONT);
    const laidCards = sections.map((section) => {
      const lines: string[] = [];
      section.paragraphs.forEach((paragraph, paragraphIndex) => {
        if (paragraphIndex > 0) lines.push('');
        for (const logicalLine of String(paragraph).split('\n')) {
          lines.push(...wrapInfiniteFlowLine(logicalLine, HELP_MAX_UNITS));
        }
      });
      const height = HELP_CARD_PAD + 40 + HELP_TITLE_GAP + lines.length * HELP_LINE_HEIGHT + HELP_CARD_FOOT;
      return { title: section.title, lines, height };
    });
    const contentHeight = HELP_CARD_PAD_TOP + laidCards.reduce((sum, card) => sum + card.height, 0)
      + (laidCards.length - 1) * HELP_CARD_GAP + HELP_CARD_PAD_BOTTOM;
    const content = addNode(holder, 'HelpScrollContent', 0, (HELP_VIEW_HEIGHT - Math.max(HELP_VIEW_HEIGHT, contentHeight)) / 2, HELP_SCROLL_WIDTH, Math.max(HELP_VIEW_HEIGHT, contentHeight));
    const scrollView = holder.addComponent(ScrollView);
    scrollView.content = content;
    scrollView.horizontal = false;
    scrollView.vertical = true;
    scrollView.inertia = true;
    scrollView.brake = 0.75;
    scrollView.elastic = true;
    scrollView.cancelInnerEvents = true;

    let cursor = HELP_CARD_PAD_TOP;
    laidCards.forEach((card, index) => {
      const cardNode = addPanel(content, `HelpScrollSection:${index}`, 0, contentHeight / 2 - cursor - card.height / 2, HELP_CARD_WIDTH, card.height, {
        fill: PALETTE.raisedQuiet,
        stroke: PALETTE.teal,
        lineWidth: 3,
        radius: 16,
      });
      addText(cardNode, 'HelpSectionTitle', card.title, 0, card.height / 2 - HELP_CARD_PAD - 20, HELP_TEXT_WIDTH, 40, {
        fontSize: HELP_TITLE_FONT,
        color: PALETTE.teal,
        horizontal: Label.HorizontalAlign.LEFT,
      });
      const bodyHeight = card.lines.length * HELP_LINE_HEIGHT;
      const bodyTop = card.height / 2 - HELP_CARD_PAD - 40 - HELP_TITLE_GAP;
      addText(cardNode, 'HelpSectionBody', card.lines.join('\n'), 0, bodyTop - bodyHeight / 2, HELP_TEXT_WIDTH, bodyHeight + 4, {
        fontSize: HELP_BODY_FONT,
        lineHeight: HELP_LINE_HEIGHT,
        color: PALETTE.bone,
        vertical: Label.VerticalAlign.TOP,
        horizontal: Label.HorizontalAlign.LEFT,
        wrap: true,
      });
      cursor += card.height + HELP_CARD_GAP;
    });

    if (contentHeight > HELP_VIEW_HEIGHT) {
      const barWidth = 6;
      const thumbHeight = Math.max(72, Math.round(HELP_VIEW_HEIGHT * HELP_VIEW_HEIGHT / contentHeight));
      const travel = HELP_VIEW_HEIGHT - thumbHeight - 4;
      const thumb = addNode(holder, 'HelpScrollThumb', HELP_SCROLL_WIDTH / 2 - 6, HELP_VIEW_HEIGHT / 2 - 2 - thumbHeight / 2, barWidth, thumbHeight);
      const thumbGraphics = thumb.addComponent(Graphics);
      thumbGraphics.fillColor = new Color(PALETTE.gold.r, PALETTE.gold.g, PALETTE.gold.b, 140);
      thumbGraphics.roundRect(-barWidth / 2, -thumbHeight / 2, barWidth, thumbHeight, 3);
      thumbGraphics.fill();
      scrollView.node.on(ScrollView.EventType.SCROLLING, () => {
        const maxOffset = Math.max(1, contentHeight - HELP_VIEW_HEIGHT);
        const ratio = Math.max(0, Math.min(1, scrollView.getScrollOffset().y / maxOffset));
        thumb.setPosition(new Vec3(HELP_SCROLL_WIDTH / 2 - 6, HELP_VIEW_HEIGHT / 2 - 2 - thumbHeight / 2 - ratio * travel, 0));
      });
    }

    const enabled = chrome.busyActionId === undefined && chrome.modeKind !== 'blocked';
    const previousTopic = help.entries[activeIndex - 1];
    const nextTopic = help.entries[activeIndex + 1];
    this.renderOverlayButton(panel, 'PreviousTopic', '‹ 上一主题', -166, localY(helpHeight, 704, MINIMUM_TOUCH_HEIGHT), 310, previousTopic !== undefined && enabled, (physicalId) => {
      if (previousTopic === undefined) return;
      this.delegate.activate(physicalId, previousTopic.openAction.actionId, previousTopic.openAction.event);
    });
    this.renderOverlayButton(panel, 'NextTopic', '下一主题 ›', 166, localY(helpHeight, 704, MINIMUM_TOUCH_HEIGHT), 310, nextTopic !== undefined && enabled, (physicalId) => {
      if (nextTopic === undefined) return;
      this.delegate.activate(physicalId, nextTopic.openAction.actionId, nextTopic.openAction.event);
    });
    this.renderOverlayButton(panel, 'CloseHelp', '× 关闭帮助', 0, localY(helpHeight, 824, PRIMARY_TOUCH_HEIGHT), 638, enabled, (physicalId) => {
      this.delegate.activate(physicalId, active.closeAction.actionId, active.closeAction.event);
    }, true);
  }

  private renderOverlayButton(
    parent: Node,
    name: string,
    text: string,
    x: number,
    y: number,
    width: number,
    enabled: boolean,
    activate: (physicalId: string) => void,
    danger = false,
  ): void {
    const button = addPanel(parent, name, x, y, width, name === 'CloseHelp' ? PRIMARY_TOUCH_HEIGHT : MINIMUM_TOUCH_HEIGHT, {
      fill: enabled ? (danger ? PALETTE.redDark : PALETTE.tealDark) : PALETTE.raisedQuiet,
      stroke: enabled ? (danger ? PALETTE.red : PALETTE.teal) : PALETTE.disabled,
      lineWidth: enabled ? 4 : 2,
      radius: 13,
    });
    addText(button, 'Label', enabled ? text : `× ${text}`, 0, 0, width - 20, 78, {
      fontSize: 26,
      color: enabled ? (danger ? PALETTE.red : PALETTE.bone) : PALETTE.disabled,
      horizontal: Label.HorizontalAlign.CENTER,
      shrink: true,
    });
    this.bindPhysical(button, enabled, activate);
  }

  private bindPhysical(
    node: Node,
    enabled: boolean,
    activate: (physicalId: string) => void,
  ): void {
    if (!enabled) return;
    const activeTouches = new Map<number, string>();
    node.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
      if (this.destroyed) return;
      const touchId = event.getID();
      event.propagationStopped = true;
      if (touchId === null) return;
      this.physicalSequence += 1;
      activeTouches.set(touchId, `cocos-touch:${this.physicalSequence}`);
    });
    node.on(Node.EventType.TOUCH_CANCEL, (event: EventTouch) => {
      if (this.destroyed) return;
      const touchId = event.getID();
      event.propagationStopped = true;
      if (touchId === null) return;
      activeTouches.delete(touchId);
    });
    node.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
      if (this.destroyed) return;
      const touchId = event.getID();
      event.propagationStopped = true;
      if (touchId === null) return;
      const physicalId = activeTouches.get(touchId);
      activeTouches.delete(touchId);
      if (physicalId === undefined) return;
      // Deleting before invoking guarantees one TOUCH_END can activate at most once.
      activate(physicalId);
    });
  }
}
