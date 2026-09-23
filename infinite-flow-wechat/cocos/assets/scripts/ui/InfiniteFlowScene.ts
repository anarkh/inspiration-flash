import { Color, Graphics, Label, Mask, Node, Size, Sprite, UITransform, Vec3 } from 'cc';
import type { SpriteFrame } from 'cc';
import type {
  CombatDetailViewModel,
  ExploreDetailViewModel,
  GameViewModel,
  HubDetailViewModel,
  HubPanel,
  ResultDetailViewModel,
  ViewActionModel,
} from '@infinite-flow/presentation';
import {
  formatInfiniteFlowExploreResultActionLabel,
  formatInfiniteFlowExploreResultActionSummary,
  formatInfiniteFlowHubActionLabel,
  formatInfiniteFlowHubActionLockedReason,
  formatInfiniteFlowHubActionShortCopy,
  formatInfiniteFlowHubPlayerCopy,
  formatInfiniteFlowPlayerChrome,
  formatInfiniteFlowResultAltar,
  layoutInfiniteFlowMapWindow,
  matchInfiniteFlowMapMoveAction,
  orderActionsForCompactReachability,
} from './InfiniteFlowView';
import type { InfiniteFlowRuntimeChrome } from './InfiniteFlowView';
import { getInfiniteFlowSceneVisualKeys } from './scene-visuals';
import { DARK_UI, paintDarkFrame } from './dark-ui';

export type InfiniteFlowSceneOptions = Readonly<{
  safeInsets: Readonly<{ top: number; right: number; bottom: number; left: number }>;
  /** Real visible fixed-width design surface height (>= 1334 on tall phones). */
  surfaceHeight: number;
  chrome: InfiniteFlowRuntimeChrome;
  visual: (key: string) => Readonly<{ frame: SpriteFrame; width: number; height: number }> | undefined;
  trackSprite: (sprite: Sprite) => void;
  bindAction: (node: Node, action: ViewActionModel) => void;
  bindLocal: (node: Node, callback: () => void) => void;
  openDetails: () => void;
  bindHelp: (node: Node) => void;
  openCodex: () => void;
  page: number;
  setPage: (page: number) => void;
  mapOrigin?: Readonly<{ x: number; y: number }>;
  setMapOrigin: (origin: Readonly<{ x: number; y: number }>) => void;
  feedback?: Readonly<{ text: string; damage?: number }>;
}>;

const INK = DARK_UI.ink;
const STONE = DARK_UI.panel;
const SOFT = DARK_UI.quiet;
const LINE = DARK_UI.edge;
const WHITE = DARK_UI.bone;
const MUTED = DARK_UI.muted;
const GOLD = DARK_UI.gold;
const TEAL = DARK_UI.gold;
const RED = DARK_UI.red;
const DARK_RED = DARK_UI.redDark;

type SceneContext = Readonly<{
  root: Node;
  model: GameViewModel;
  options: InfiniteFlowSceneOptions;
  top: number;
  halfSurface: number;
  // Tall phones gain vertical space; the fixed 1334 composition is centred in it
  // (the ink backdrop fills the whole surface), so every proven offset is retained.
  contentShift: number;
  xOffset: number;
}>;

function node(parent: Node, name: string, x: number, y: number, width: number, height: number): Node {
  const result = new Node(name);
  result.layer = 1 << 25;
  parent.addChild(result);
  result.setPosition(new Vec3(x, y, 0));
  result.addComponent(UITransform).setContentSize(new Size(width, height));
  return result;
}

function at(context: SceneContext, name: string, centerX: number, top: number, width: number, height: number): Node {
  return node(context.root, name, centerX - 375 + context.xOffset, context.halfSurface - context.contentShift - context.top - top - height / 2, width, height);
}

function plate(target: Node, width: number, height: number, fill = SOFT, stroke = LINE, radius = 8): Graphics {
  const graphics = target.addComponent(Graphics);
  paintDarkFrame(graphics, width, height, { fill, edge: stroke, cut: radius });
  return graphics;
}

function words(
  parent: Node, name: string, text: string, x: number, y: number,
  width: number, height: number, fontSize = 25, color = WHITE, centered = true,
): void {
  const target = node(parent, name, x, y, width, height);
  const label = target.addComponent(Label);
  label.string = text;
  label.fontSize = fontSize;
  label.lineHeight = Math.round(fontSize * 1.23);
  label.color = color;
  label.horizontalAlign = centered ? Label.HorizontalAlign.CENTER : Label.HorizontalAlign.LEFT;
  label.verticalAlign = Label.VerticalAlign.CENTER;
  label.enableWrapText = true;
  label.overflow = Label.Overflow.SHRINK;
}

function caption(context: SceneContext, name: string, text: string, centerX: number, top: number, width: number, height: number, fontSize = 25, color = WHITE): Node {
  const target = at(context, name, centerX, top, width, height);
  words(target, `${name}Label`, text, 0, 0, width, height, fontSize, color);
  return target;
}

/** All source portraits are rectangular illustrations; preserve their complete original framing. */
function picture(
  context: SceneContext, name: string, key: string | undefined,
  centerX: number, top: number, boxWidth: number, boxHeight: number,
): Node | undefined {
  if (key === undefined) return undefined;
  const image = context.options.visual(key);
  if (image === undefined || image.width <= 0 || image.height <= 0) return undefined;
  const scale = Math.min(boxWidth / image.width, boxHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const target = at(context, name, centerX, top + (boxHeight - height) / 2, width, height);
  const sprite = target.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = image.frame;
  sprite.color = new Color(255, 255, 255, 255);
  context.options.trackSprite(sprite);
  return target;
}

/** Scene environments fill their viewport without stretching; portraits continue to use contain. */
function background(context: SceneContext, key: string | undefined, top: number, width: number, height: number): void {
  if (key === undefined) return;
  const image = context.options.visual(key);
  if (image === undefined || image.width <= 0 || image.height <= 0) return;
  const viewport = at(context, `WorldBackgroundWindow:${key}`, 375, top, width, height);
  viewport.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
  const scale = Math.max(width / image.width, height / image.height);
  const target = node(viewport, `WorldBackground:${key}`, 0, 0, image.width * scale, image.height * scale);
  const sprite = target.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = image.frame;
  sprite.color = new Color(255, 255, 255, 255);
  context.options.trackSprite(sprite);
}

function localButton(context: SceneContext, name: string, title: string, centerX: number, top: number, width: number, height: number, callback: () => void, enabled = true): Node {
  const target = at(context, name, centerX, top, width, height);
  plate(target, width, height, SOFT, enabled ? LINE : STONE);
  words(target, `${name}Label`, title, 0, 0, width - 14, height - 12, 23, enabled ? WHITE : MUTED);
  if (enabled) context.options.bindLocal(target, callback);
  return target;
}

function oval(graphics: Graphics, radiusX: number, radiusY: number): void {
  graphics.moveTo(radiusX, 0);
  for (let step = 1; step <= 40; step += 1) {
    const angle = step * Math.PI / 20;
    graphics.lineTo(Math.cos(angle) * radiusX, Math.sin(angle) * radiusY);
  }
  graphics.close();
}

function sceneFloor(context: SceneContext, centerY: number, width: number): void {
  const floor = at(context, 'WorldFloor', 375, centerY - 62, width, 124);
  const graphics = floor.addComponent(Graphics);
  graphics.lineWidth = 2;
  graphics.strokeColor = LINE;
  graphics.fillColor = new Color(STONE.r, STONE.g, STONE.b, 110);
  oval(graphics, width / 2, 60);
  graphics.fill();
  graphics.stroke();
  oval(graphics, width / 2 - 22, 46);
  graphics.stroke();
}

function actorSilhouette(context: SceneContext, name: string, centerX: number, top: number, width: number, height: number, opponent = false): Node {
  const target = at(context, name, centerX, top, width, height);
  const graphics = target.addComponent(Graphics);
  const color = opponent ? RED : TEAL;
  graphics.fillColor = opponent ? new Color(52, 36, 42, 255) : new Color(24, 49, 53, 255);
  graphics.strokeColor = color;
  graphics.lineWidth = 3;
  graphics.circle(0, height * 0.21, width * 0.13);
  graphics.fill();
  graphics.stroke();
  graphics.moveTo(-width * 0.1, height * 0.07);
  graphics.lineTo(-width * 0.26, -height * 0.03);
  graphics.lineTo(-width * 0.36, -height * 0.4);
  graphics.lineTo(width * 0.36, -height * 0.4);
  graphics.lineTo(width * 0.26, -height * 0.03);
  graphics.lineTo(width * 0.1, height * 0.07);
  graphics.close();
  graphics.fill();
  graphics.stroke();
  if (opponent) {
    graphics.moveTo(-width * 0.09, height * 0.28);
    graphics.lineTo(-width * 0.19, height * 0.41);
    graphics.moveTo(width * 0.09, height * 0.28);
    graphics.lineTo(width * 0.19, height * 0.41);
    graphics.stroke();
  }
  return target;
}

function renderHeader(context: SceneContext): void {
  const { model } = context;
  const phaseNames = { hub: '主神空间', explore: '异界探索', combat: '遭遇战', result: '轮回结算' };
  const detail = model.sections[1].detail;
  const heading = detail.kind === 'hub' ? phaseNames.hub : detail.kind === 'explore'
    ? detail.map.dungeonName : detail.kind === 'combat' ? phaseNames.combat : phaseNames.result;
  const title = at(context, 'SceneHeading', 375, 0, 700, 35);
  words(title, 'SceneHeadingLabel', heading, -96, 0, 490, 34, 29, GOLD, false);
  words(title, 'SceneActivityLabel', context.options.chrome.busyActionId === undefined ? phaseNames[model.phase] : '行动中…', 252, 0, 176, 32, 20, MUTED);
  if (context.options.chrome.modeKind === 'preview' || context.options.chrome.modeKind === 'wx-devtools') {
    const notice = context.options.chrome.modeKind === 'preview'
      ? '试玩模式 · 关闭或刷新后进度会丢失'
      : '微信工具临时试玩 · 不可发布 · 关闭后进度会丢失';
    caption(context, 'SceneStorageNotice', notice, 375, 38, 690, 22, 20, MUTED);
  }
  const useful = model.sections[1].metrics.filter(({ id }) => detail.kind === 'combat'
    ? ['turn', 'attack', 'boss-phase'].includes(id)
    : detail.kind === 'explore' ? ['hp', 'loot', 'boss-seal'].includes(id)
      : ['hp', 'reward-points', 'lingyun'].includes(id)).slice(0, 3);
  const band = at(context, 'SceneResourceBand', 375, 64, 702, 40);
  plate(band, 702, 40, INK, LINE, 0);
  useful.forEach((metric, index) => {
    words(band, `Resource:${metric.id}`, `${metric.label}  ${metric.value}`, (index - 1) * 228, 0, 222, 40, 21, metric.severity === 'danger' ? RED : WHITE);
  });
}

const FACILITIES: readonly Readonly<{ panel: HubPanel; label: string; symbol: string; x: number; top: number }>[] = [
  { panel: 'entry', label: '异界之门', symbol: '门', x: 375, top: 140 },
  { panel: 'supplies', label: '物资商人', symbol: '药', x: 122, top: 280 },
  { panel: 'equipment', label: '装备工坊', symbol: '锻', x: 628, top: 280 },
  { panel: 'pets', label: '灵宠栖所', symbol: '灵', x: 122, top: 425 },
  { panel: 'methods', label: '功法传承', symbol: '卷', x: 628, top: 425 },
  { panel: 'bloodlines', label: '血统觉醒', symbol: '血', x: 122, top: 570 },
  { panel: 'companions', label: '轮回同伴', symbol: '伴', x: 375, top: 637 },
  { panel: 'tasks', label: '主神任务', symbol: '契', x: 628, top: 570 },
];

function renderHub(context: SceneContext, detail: HubDetailViewModel): void {
  const keys = getInfiniteFlowSceneVisualKeys(context.model);
  background(context, keys.background, 140, 750, 600);
  sceneFloor(context, 520, 370);
  const portal = at(context, 'WorldPortal', 375, 144, 138, 160);
  const arch = portal.addComponent(Graphics);
  arch.strokeColor = new Color(123, 234, 219, 235);
  arch.fillColor = new Color(75, 157, 158, 75);
  arch.lineWidth = 7;
  oval(arch, 59, 76);
  arch.fill();
  arch.stroke();
  arch.lineWidth = 2;
  oval(arch, 45, 62);
  arch.stroke();

  picture(context, `WorldPlayer:${keys.player}`, keys.player, 359, 337, 162, 162);
  caption(context, 'WorldPlayerName', '轮回者', 359, 505, 150, 32, 23, WHITE);
  if (keys.opponent !== undefined) {
    picture(context, `WorldOpponent:${keys.opponent}`, keys.opponent, 431, 522, 68, 102);
    caption(context, 'WorldSelectedFacility', detail.activePanelLabel, 322, 570, 143, 36, 23, GOLD);
  } else {
    caption(context, 'WorldEntryDestination', detail.selectedDungeonName, 375, 566, 350, 45, 26, GOLD);
  }

  for (const facility of FACILITIES) {
    const selected = detail.activePanel === facility.panel;
    const action = context.model.sections[2].actions.find(({ actionId }) => actionId === `hub.panel:${facility.panel}`);
    const hotspot = at(context, selected ? `WorldFacility:${facility.panel}` : `WorldAction:hub.panel:${facility.panel}`, facility.x, facility.top, 168, 112);
    const graphics = hotspot.addComponent(Graphics);
    graphics.strokeColor = selected ? GOLD : LINE;
    graphics.fillColor = new Color(19, 34, 40, facility.panel === 'entry' ? 120 : 222);
    graphics.lineWidth = selected ? 3 : 2;
    graphics.moveTo(-76, -48);
    graphics.lineTo(-82, -14);
    graphics.lineTo(-61, 20);
    graphics.lineTo(61, 20);
    graphics.lineTo(82, -14);
    graphics.lineTo(76, -48);
    graphics.close();
    graphics.fill();
    graphics.stroke();
    words(hotspot, 'FacilitySymbol', facility.symbol, 0, 17, 68, 51, 37, selected ? GOLD : TEAL);
    words(hotspot, 'FacilityName', facility.label, 0, -31, 152, 35, 24, selected ? GOLD : WHITE);
    if (selected) context.options.bindLocal(hotspot, context.options.openDetails);
    else if (action !== undefined) context.options.bindAction(hotspot, action);
  }
}

function renderExplore(context: SceneContext, detail: ExploreDetailViewModel): void {
  const keys = getInfiniteFlowSceneVisualKeys(context.model);
  background(context, keys.background, 128, 750, 630);
  const titleBand = at(context, 'WorldCurrentLocation', 375, 118, 568, 74);
  plate(titleBand, 568, 74, SOFT, LINE);
  words(titleBand, 'CurrentNodeTitle', detail.currentNode.title, 0, 13, 540, 36, 27, WHITE);
  words(titleBand, 'CurrentNodeState', detail.pending?.title ?? (detail.currentNode.cleared ? '此处已清理' : '探索当前区域'), 0, -20, 540, 25, 20, GOLD);
  const { map } = detail;
  const current = map.nodes.find((entry) => entry.state === 'current' && entry.nodeId === map.currentNodeId);
  const valid = current !== undefined && Number.isInteger(current.x) && Number.isInteger(current.y)
    && current.x >= 0 && current.x < map.width && current.y >= 0 && current.y < map.height
    && detail.currentNode.nodeId === map.currentNodeId;
  const layout = layoutInfiniteFlowMapWindow(map.width, map.height, current?.x, current?.y, context.options.mapOrigin);
  const visible = map.nodes.filter((entry) => Number.isInteger(entry.x) && Number.isInteger(entry.y)
    && entry.x >= layout.originX && entry.x < layout.originX + 3
    && entry.y >= layout.originY && entry.y < layout.originY + 3);
  const cellX = (x: number) => 199 + (x - layout.originX) * 176;
  const cellTop = (y: number) => 216 + (y - layout.originY) * 152;
  if (valid && current !== undefined && visible.includes(current)) {
    const connections = at(context, 'WorldMapConnections', 375, 200, 704, 456);
    const graphics = connections.addComponent(Graphics);
    graphics.strokeColor = TEAL;
    graphics.lineWidth = 5;
    for (const entry of visible) {
      if (!entry.isAdjacent || entry === current) continue;
      graphics.moveTo(cellX(current.x) - 375, 428 - cellTop(current.y) - 66);
      graphics.lineTo(cellX(entry.x) - 375, 428 - cellTop(entry.y) - 66);
    }
    graphics.stroke();
  }
  for (const entry of visible) {
    const match = matchInfiniteFlowMapMoveAction(entry, context.model.sections[2].actions, {
      busy: context.options.chrome.busyActionId !== undefined,
      blocked: context.options.chrome.modeKind === 'blocked', projectionValid: valid,
    });
    const hidden = entry.state === 'fogged';
    const here = entry.state === 'current';
    const color = here ? GOLD : match.status === 'ready' ? TEAL : LINE;
    const cell = at(context, `WorldMapCell:${entry.x}:${entry.y}`, cellX(entry.x), cellTop(entry.y), 152, 132);
    const graphics = plate(cell, 152, 132, hidden ? INK : STONE, color, 3);
    graphics.strokeColor = new Color(59, 80, 80, 255);
    graphics.lineWidth = 1;
    graphics.rect(-65, -56, 130, 112);
    graphics.stroke();
    if (hidden) {
      words(cell, 'MapFog', '?', 0, 10, 98, 62, 50, MUTED);
      words(cell, 'MapFogState', match.status === 'ready' ? '可探索' : '迷雾', 0, -40, 134, 28, 20, MUTED);
    } else if (here) {
      picture(context, `WorldPlayer:${keys.player}`, keys.player, cellX(entry.x), cellTop(entry.y) + 8, 65, 65);
      words(cell, 'CurrentRoomLabel', entry.title, 0, -28, 132, 36, 20, GOLD);
      words(cell, 'CurrentRoomState', '所在位置', 0, -53, 132, 18, 15, MUTED);
    } else {
      const symbols: Readonly<Record<string, string>> = { monster: '敌', trap: '险', portal: '门', reward: '宝', exit: '出' };
      words(cell, 'MapRoomSymbol', entry.state === 'cleared' ? '✓' : symbols[entry.nodeType] ?? '◇', 0, 26, 100, 44, 35, color);
      words(cell, 'MapRoomTitle', entry.title, 0, -14, 132, 39, 20, WHITE);
      words(cell, 'MapRoomState', match.status === 'ready' ? '可前往' : entry.stateLabel, 0, -49, 132, 24, 18, color);
    }
    if (match.status === 'ready') context.options.bindAction(cell, match.action);
    else if (here) context.options.bindLocal(cell, context.options.openDetails);
  }
  const controls = [
    { name: 'Left', label: '← 西', x: -1, y: 0, enabled: layout.canPanLeft },
    { name: 'Up', label: '↑ 北', x: 0, y: -1, enabled: layout.canPanUp },
    { name: 'Down', label: '↓ 南', x: 0, y: 1, enabled: layout.canPanDown },
    { name: 'Right', label: '东 →', x: 1, y: 0, enabled: layout.canPanRight },
  ];
  controls.forEach((direction, index) => localButton(context, `SceneMap${direction.name}`, direction.label, 111 + index * 176, 658, 152, 104,
    () => context.options.setMapOrigin({ x: layout.originX + direction.x, y: layout.originY + direction.y }), direction.enabled));
}

function healthBar(context: SceneContext, name: string, label: string, hp: number, maxHp: number, percentage: number, centerX: number, top: number, color: Color): void {
  const target = at(context, name, centerX, top, 298, 72);
  words(target, `${name}Name`, label, 0, 23, 290, 28, 25, WHITE);
  const graphics = target.addComponent(Graphics);
  graphics.fillColor = INK;
  graphics.strokeColor = LINE;
  graphics.rect(-148, -18, 296, 24);
  graphics.fill();
  graphics.stroke();
  graphics.fillColor = color;
  graphics.rect(-146, -16, 292 * Math.max(0, Math.min(1, percentage / 100)), 20);
  graphics.fill();
  words(target, `${name}Value`, `${hp} / ${maxHp}`, 0, -29, 285, 20, 18, WHITE);
}

function renderCombat(context: SceneContext, detail: CombatDetailViewModel): void {
  const keys = getInfiniteFlowSceneVisualKeys(context.model);
  background(context, keys.background, 123, 750, 520);
  caption(context, 'WorldCombatRound', `第 ${detail.turn} 回合${detail.boss === undefined ? '' : ` · ${detail.boss.phaseLabel}`}`, 375, 118, 620, 36, 24, GOLD);
  healthBar(context, 'WorldPlayerHealth', '轮回者', detail.player.hp, detail.player.maxHp, detail.player.hpPercent, 193, 173, TEAL);
  healthBar(context, 'WorldOpponentHealth', detail.enemy.name, detail.enemy.hp, detail.enemy.maxHp, detail.enemy.hpPercent, 557, 173, RED);
  sceneFloor(context, 609, 676);
  if (picture(context, `WorldPlayer:${keys.player}`, keys.player, 190, 307, 264, 264) === undefined) {
    actorSilhouette(context, `WorldPlayer:${keys.player}`, 190, 307, 264, 264);
  }
  const opponent = picture(context, `WorldOpponent:${keys.opponent}`, keys.opponent, 554, 264, 270, 360)
    ?? actorSilhouette(context, `WorldOpponent:${keys.opponent ?? detail.enemy.id}`, 554, 264, 270, 360, true);
  context.options.bindLocal(opponent, context.options.openDetails);
  caption(context, 'WorldCombatVersus', '对峙', 375, 406, 95, 40, 26, GOLD);
  const intent = at(context, 'WorldEnemyIntent', 375, 646, 694, 70);
  plate(intent, 694, 70, detail.intent.severity === 'danger' ? DARK_RED : SOFT, detail.intent.severity === 'danger' ? RED : GOLD);
  words(intent, 'EnemyIntentName', detail.intent.name, 0, 16, 664, 32, 25, GOLD);
  words(intent, 'EnemyIntentConsequence', detail.intent.consequence, 0, -19, 664, 31, 20, WHITE);
  const latest = context.options.feedback?.text ?? context.model.sections[5].lines[0] ?? detail.enemy.ability;
  caption(context, 'WorldCombatLog', latest, 375, 723, 684, 38, 21, MUTED);
  if (context.options.feedback?.damage !== undefined && context.options.feedback.damage > 0) {
    caption(context, 'WorldDamage', `−${context.options.feedback.damage}`, 554, 272, 220, 82, 59, RED);
  }
}

function renderResult(context: SceneContext, detail: ResultDetailViewModel): void {
  const keys = getInfiniteFlowSceneVisualKeys(context.model);
  background(context, keys.background, 143, 750, 600);
  sceneFloor(context, 513, 568);
  const readout = formatInfiniteFlowResultAltar(detail, context.model.sections[1].metrics);
  const seal = at(context, 'WorldResultSeal', 375, 242, 270, 270);
  const graphics = seal.addComponent(Graphics);
  graphics.strokeColor = GOLD;
  graphics.fillColor = STONE;
  graphics.lineWidth = 3;
  graphics.circle(0, 0, 125);
  graphics.fill();
  graphics.stroke();
  graphics.lineWidth = 1;
  graphics.circle(0, 0, 113);
  graphics.stroke();
  words(seal, 'ResultSealMark', detail.relicArchiveStatus === 'pending' ? '响' : '归', 0, 22, 140, 130, 91, GOLD);
  words(seal, 'ResultSealOutcome', readout.outcome, 0, -68, 220, 49, 26, WHITE);
  caption(context, 'WorldResultDungeon', detail.dungeonName ?? '主神回收', 375, 156, 680, 52, 31, WHITE);
  const resources = readout.metrics.slice(0, 3).map(({ label, value }) => `${label} ${value}`).join('   ');
  caption(context, 'WorldResultResources', resources, 375, 543, 674, 54, 25, GOLD);
  const loot = readout.loot.state === 'valid' ? [readout.loot.retained, readout.loot.loss].filter(Boolean).join('\n')
    : readout.loot.state === 'invalid' ? readout.loot.diagnostic : '本轮战利品已完成清算';
  caption(context, 'WorldResultLoot', loot, 375, 605, 662, 87, 23, WHITE);
  caption(context, 'WorldArchivePrompt', detail.relicArchiveStatus === 'pending' ? '选择一件回响，带回主神空间' : '本轮经历已记录', 375, 710, 674, 43, 24, TEAL);
}

function actionText(model: GameViewModel, action: ViewActionModel): Readonly<{ label: string; summary: string }> {
  if (model.phase === 'hub') return {
    label: formatInfiniteFlowHubActionLabel(action),
    summary: action.enabled ? formatInfiniteFlowHubActionShortCopy(action) : formatInfiniteFlowHubActionLockedReason(action),
  };
  if (model.phase === 'explore' || model.phase === 'result') return {
    label: formatInfiniteFlowExploreResultActionLabel(model.phase, action),
    summary: action.disabledReason ?? formatInfiniteFlowExploreResultActionSummary(model.phase, action),
  };
  return { label: action.label, summary: action.disabledReason ?? action.riskReason ?? action.readout ?? (action.recommendation === 'recommended' ? '应对当前敌方意图' : '') };
}

function sceneActions(model: GameViewModel): readonly ViewActionModel[] {
  const all = model.sections[2].actions;
  return orderActionsForCompactReachability(model.phase === 'hub'
    ? all.filter(({ actionId }) => !actionId.startsWith('hub.panel:'))
    : model.phase === 'explore' ? all.filter(({ placement }) => placement !== 'map') : all);
}

function renderActionDock(context: SceneContext): void {
  const actions = sceneActions(context.model);
  const count = Math.max(1, Math.ceil(actions.length / 4));
  const page = Math.max(0, Math.min(count - 1, Math.trunc(context.options.page)));
  const detail = context.model.sections[1].detail;
  const heading = detail.kind === 'hub' ? `${detail.activePanelLabel} · ${page + 1}/${count}`
    : detail.kind === 'explore' ? `${detail.pending?.title ?? '当前区域行动'} · ${page + 1}/${count}`
      : detail.kind === 'combat' ? `选择行动 · ${page + 1}/${count}` : `结算选择 · ${page + 1}/${count}`;
  const feedback = context.options.feedback;
  const activity = formatInfiniteFlowPlayerChrome(context.options.chrome, context.model.phase).activityMessage;
  const failed = activity !== undefined && /不可执行|失败|异常|无效|内存紧张|暂不可用/.test(activity);
  caption(context, 'SceneActionHeading', failed ? activity : feedback !== undefined && detail.kind !== 'combat'
    ? formatInfiniteFlowHubPlayerCopy(feedback.text) : heading, 375, 774, 680, 28, 22, failed ? RED : MUTED);
  const visible = actions.slice(page * 4, page * 4 + 4);
  visible.forEach((action, index) => {
    const width = 340;
    const height = 108;
    const target = at(context, `WorldAction:${action.actionId}`, index % 2 === 0 ? 196 : 554, 810 + Math.floor(index / 2) * 118, width, height);
    const busy = context.options.chrome.busyActionId !== undefined || context.options.chrome.modeKind === 'blocked';
    const ready = action.enabled && action.event !== undefined && !busy;
    const risky = action.recommendation === 'high-risk' || action.emphasis === 'danger';
    const recommended = action.recommendation === 'recommended' || action.emphasis === 'primary';
    plate(target, width, height, risky ? DARK_RED : STONE, !ready ? LINE : risky ? RED : recommended ? GOLD : TEAL);
    const copy = actionText(context.model, action);
    words(target, 'ActionTitle', copy.label, 0, 24, width - 24, 38, 30, ready ? WHITE : MUTED);
    words(target, 'ActionReadout', copy.summary, 0, -23, width - 24, 43, 22, action.disabledReason !== undefined || risky ? RED : MUTED);
    context.options.bindAction(target, action);
  });
  if (visible.length === 0) {
    caption(context, 'SceneNoActions', detail.kind === 'explore' ? '点击相邻区域继续探索' : '打开详情查看当前状态', 375, 843, 670, 88, 27, MUTED);
  }
  localButton(context, 'ScenePagePrevious', '‹', 84, 1042, 116, 104, () => context.options.setPage(page - 1), page > 0);
  localButton(context, 'SceneDetails', detail.kind === 'result' ? '完整结算' : '详情', 230, 1042, 140, 104, context.options.openDetails);
  const help = at(context, 'SceneHelp', 375, 1042, 126, 104);
  plate(help, 126, 104);
  words(help, 'SceneHelpLabel', '帮助', 0, 0, 112, 92, 23);
  context.options.bindHelp(help);
  if (detail.kind === 'explore' && detail.chapterDecision !== undefined) {
    localButton(context, 'SceneCodex', '章册', 520, 1042, 126, 104, context.options.openCodex);
  } else {
    caption(context, 'ScenePageReadout', `${page + 1} / ${count}`, 520, 1042, 126, 104, 23, MUTED);
  }
  localButton(context, 'ScenePageNext', '›', 666, 1042, 116, 104, () => context.options.setPage(page + 1), page + 1 < count);
}

export function renderInfiniteFlowScene(root: Node, model: GameViewModel, options: InfiniteFlowSceneOptions): void {
  const surfaceHeight = Math.max(1334, options.surfaceHeight);
  const halfSurface = surfaceHeight / 2;
  const world = node(root, 'SceneWorld', 0, 0, 750, surfaceHeight);
  const context: SceneContext = {
    root: world, model, options,
    top: options.safeInsets.top,
    halfSurface,
    contentShift: halfSurface - 667,
    xOffset: (options.safeInsets.left - options.safeInsets.right) / 2,
  };
  const backdrop = node(world, 'SceneBackdrop', 0, 0, 750, surfaceHeight);
  plate(backdrop, 750, surfaceHeight, INK, INK, 0);
  const detail = model.sections[1].detail;
  if (detail.kind === 'hub') renderHub(context, detail);
  else if (detail.kind === 'explore') renderExplore(context, detail);
  else if (detail.kind === 'combat') renderCombat(context, detail);
  else renderResult(context, detail);
  renderHeader(context);
  renderActionDock(context);
}
