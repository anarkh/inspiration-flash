import type {
  ExploreDetailViewModel,
  GameViewModel,
  HubCatalogPanel,
  MapNodeViewModel,
  ViewActionModel,
} from '@infinite-flow/presentation';
import { DUNGEON_WORLD_THEMES, HUB_WORLD_THEME } from './dungeon-world-theme';
import type { DungeonWorldTheme } from './dungeon-world-theme';
import { getInfiniteFlowMonsterWorldVisualKey } from './scene-visuals';

/** World coordinates use a top-left origin; positions refer to the character's feet. */
export type WorldPoint = Readonly<{ x: number; y: number }>;
export type WorldRect = Readonly<{ x: number; y: number; width: number; height: number }>;
export type WorldProp = Readonly<{
  id: string;
  kind: 'pillar' | 'crate' | 'altar' | 'lamp';
  x: number;
  y: number;
  width: number;
  height: number;
  visualAssetKey: string;
}>;
export type WorldTarget = Readonly<{
  id: string;
  label: string;
  x: number;
  y: number;
  radius: number;
  kind: 'npc' | 'portal' | 'monster' | 'chest' | 'exit' | 'transition' | 'trap' | 'event' | 'survey' | 'relic' | 'shrine' | 'law';
  interactionLabel?: string;
  purpose?: string;
  rank?: 'normal' | 'elite' | 'boss';
  visualAssetKey?: string;
  action?: ViewActionModel;
  destinationNodeId?: string;
  disabledReason?: string;
  doorSide?: 'north' | 'south' | 'west' | 'east';
}>;
export type WalkWorldSpec = Readonly<{
  key: string;
  width: number;
  height: number;
  spawn: WorldPoint;
  bounds?: WorldRect;
  props?: readonly WorldProp[];
  obstacles: readonly WorldRect[];
  targets: readonly WorldTarget[];
  theme?: DungeonWorldTheme;
  rooms?: readonly (WorldRect & Readonly<{ label: string }>)[];
}>;

const FOOT_RADIUS = 14;
const WALK_SPEED = 220;
const MAX_FRAME_SECONDS = 0.1;
const MAX_STEP_DISTANCE = FOOT_RADIUS / 2;

const HUB_PEOPLE: readonly Readonly<{
  panel: HubCatalogPanel;
  label: string;
  purpose: string;
  x: number;
  y: number;
}>[] = [
  { panel: 'equipment', label: '军需官', purpose: '装备与强化', x: 160, y: 636 },
  { panel: 'supplies', label: '补给商', purpose: '药品与道具', x: 290, y: 466 },
  { panel: 'pets', label: '灵宠师', purpose: '灵宠培养', x: 430, y: 636 },
  { panel: 'methods', label: '修行导师', purpose: '功法修行', x: 570, y: 466 },
  { panel: 'bloodlines', label: '血脉祭司', purpose: '血统觉醒', x: 710, y: 636 },
  { panel: 'companions', label: '同行引路人', purpose: '同伴招募', x: 850, y: 466 },
  { panel: 'tasks', label: '任务使者', purpose: '任务与奖励', x: 990, y: 636 },
];

const HUB_PROPS: readonly WorldProp[] = [
  { id: 'prop:courtyard_altar', kind: 'altar', x: 430, y: 480, width: 120, height: 84, visualAssetKey: 'scene:courtyard_altar' },
  { id: 'prop:courtyard_lamp', kind: 'lamp', x: 1120, y: 628, width: 46, height: 118, visualAssetKey: 'scene:courtyard_lamp' },
  { id: 'prop:courtyard_crate', kind: 'crate', x: 705, y: 480, width: 92, height: 68, visualAssetKey: 'scene:courtyard_crate' },
  { id: 'prop:courtyard_pillar', kind: 'pillar', x: 570, y: 628, width: 72, height: 150, visualAssetKey: 'scene:courtyard_pillar' },
];

function uniqueAction(actions: readonly ViewActionModel[], actionId: string): ViewActionModel | undefined {
  const matches = actions.filter((action) => action.actionId === actionId);
  return matches.length === 1 ? matches[0] : undefined;
}

function perimeter(width: number, height: number): WorldRect[] {
  return [
    { x: 0, y: 0, width, height: 40 },
    { x: 0, y: height - 40, width, height: 40 },
    { x: 0, y: 40, width: 40, height: height - 80 },
    { x: width - 40, y: 40, width: 40, height: height - 80 },
  ];
}

function targetAction(action: ViewActionModel | undefined): Pick<WorldTarget, 'action' | 'disabledReason'> {
  return action === undefined ? {} : {
    action,
    ...(action.disabledReason === undefined ? {} : { disabledReason: action.disabledReason }),
  };
}

function hubWorld(model: GameViewModel): WalkWorldSpec {
  const actions = model.sections[2].actions;
  // The entry confirmation exists only while the entry panel is selected.
  const entry = uniqueAction(actions, 'hub.entry.confirm') ?? uniqueAction(actions, 'hub.panel:entry');
  return {
    key: 'hub',
    theme: HUB_WORLD_THEME,
    width: 1200,
    height: 720,
    spawn: { x: 600, y: 550 },
    bounds: { x: 64, y: 420, width: 1072, height: 246 },
    props: HUB_PROPS,
    obstacles: HUB_PROPS.filter((prop) => prop.kind !== 'lamp').map((prop) => ({
      x: prop.x - prop.width * 0.36, y: prop.y - 14, width: prop.width * 0.72, height: 24,
    })),
    targets: [
      { id: 'portal:entry', label: '副本传送门', kind: 'portal', interactionLabel: '进入', x: 1080, y: 466, radius: 120, ...(entry === undefined ? {} : { action: entry }) },
      ...HUB_PEOPLE.map((person): WorldTarget => ({
        id: `npc:${person.panel}`,
        label: person.label,
        purpose: person.purpose,
        kind: 'npc',
        interactionLabel: '交谈',
        x: person.x,
        y: person.y,
        radius: 100,
        ...targetAction(uniqueAction(actions, `hub.panel:${person.panel}`)),
      })),
    ],
  };
}

type DoorSide = 'north' | 'south' | 'west' | 'east';

function closedRoomDoor(side: DoorSide, width: number, height: number, disabledReason: string): WorldTarget {
  const labels: Record<DoorSide, string> = { north: '北侧封闭门', south: '南侧封闭门', west: '西侧封闭门', east: '东侧封闭门' };
  const point = side === 'north' ? { x: width / 2, y: 125 }
    : side === 'south' ? { x: width / 2, y: height - 125 }
      : side === 'west' ? { x: 125, y: height / 2 } : { x: width - 125, y: height / 2 };
  return {
    id: `closed-door:${side}`,
    label: labels[side],
    kind: 'transition',
    doorSide: side,
    interactionLabel: '封闭',
    ...point,
    radius: 110,
    disabledReason,
  };
}

function doorSide(node: MapNodeViewModel, current: MapNodeViewModel): DoorSide {
  const dx = node.x - current.x;
  const dy = node.y - current.y;
  return Math.abs(dx) > Math.abs(dy)
    ? dx < 0 ? 'west' : 'east'
    : dy < 0 ? 'north' : 'south';
}

function roomDoors(detail: ExploreDetailViewModel, actions: readonly ViewActionModel[]): WorldTarget[] {
  const current = detail.map.nodes.find((node) => node.nodeId === detail.map.currentNodeId);
  if (current === undefined) return [];
  const grouped: Record<DoorSide, MapNodeViewModel[]> = { north: [], south: [], west: [], east: [] };
  for (const node of detail.map.nodes) {
    if (node.isAdjacent && node.cellId !== current.cellId) grouped[doorSide(node, current)].push(node);
  }
  return (Object.entries(grouped) as [DoorSide, MapNodeViewModel[]][]).flatMap(([side, nodes]) =>
    nodes.length === 0 ? [closedRoomDoor(side, 1000, 1000, '此方向没有相邻区域。')] : nodes.map((node, index): WorldTarget => {
      const offset = 260 + 480 * (index + 1) / (nodes.length + 1);
      const point = side === 'north' ? { x: offset, y: 125 }
        : side === 'south' ? { x: offset, y: 875 }
          : side === 'west' ? { x: 125, y: offset } : { x: 875, y: offset };
      const visible = node.state !== 'fogged' && node.nodeId !== undefined;
      const candidate = node.moveActionId === undefined ? undefined : uniqueAction(actions, node.moveActionId);
      // Never construct a command or substitute another destination's map action.
      const action = visible && node.canMove && candidate?.enabled
        && candidate.event?.kind === 'command'
        && candidate.event.command.type === 'run/move'
        && candidate.event.command.nodeId === node.nodeId
        ? candidate : undefined;
      return {
        id: `door:${node.cellId}`,
        label: visible ? node.title : '未知区域',
        kind: 'transition',
        doorSide: side,
        interactionLabel: '前往',
        ...point,
        radius: 110,
        ...(visible ? { destinationNodeId: node.nodeId } : {}),
        ...(action === undefined
          ? { disabledReason: visible ? node.disabledReason ?? '当前入口没有可用的移动操作。' : '尚未发现此区域。' }
          : { action }),
      };
    }));
}

function currentRoomTarget(detail: ExploreDetailViewModel, actions: readonly ViewActionModel[]): WorldTarget[] {
  const pending = detail.pending;
  const choices = pending === undefined
    ? actions.filter((action) => action.placement === 'node'
      && ((!detail.currentNode.cleared && action.actionId.startsWith('node.')) || action.actionId.startsWith('soul-recharge.activate:')))
    : actions.filter((action) => pending.actionIds.includes(action.actionId));
  if (detail.currentNode.cleared && pending === undefined && choices.length === 0) return [];
  // A branch or trap choice is opened in the existing action sheet, never chosen by proximity.
  const action = pending === undefined && choices.length === 1 ? choices[0] : undefined;
  const type = detail.currentNode.nodeType;
  const pendingKinds: Record<NonNullable<ExploreDetailViewModel['pending']>['kind'], WorldTarget['kind']> = {
    'equipment-offer': 'chest', 'relic-draft': 'relic', 'soul-recharge': 'shrine',
    'dungeon-event': 'event', 'field-survey': 'survey', law: 'law',
  };
  const kind: WorldTarget['kind'] = pending !== undefined ? pendingKinds[pending.kind]
    : detail.currentNode.cleared ? 'shrine'
      : type === 'reward' ? 'chest' : type;
  const theme = DUNGEON_WORLD_THEMES[detail.map.dungeonId];
  const rank = kind === 'monster'
    ? detail.currentNode.nodeId === theme.bossNodeId ? 'boss' : theme.eliteNodeIds.includes(detail.currentNode.nodeId) ? 'elite' : 'normal'
    : undefined;
  const verbs: Readonly<Record<WorldTarget['kind'], string>> = {
    npc: '交谈', portal: '传送', monster: rank === 'boss' ? '挑战' : '迎战', chest: pending === undefined ? '领取' : '选装备',
    exit: '结算', transition: '前往', trap: '拆陷阱', event: '调查', survey: '勘探', relic: '选遗物', shrine: '共鸣', law: '作抉择',
  };
  return [{
    id: `node:${detail.currentNode.nodeId}`,
    label: pending?.title ?? detail.currentNode.title,
    kind,
    interactionLabel: verbs[kind],
    ...(rank === undefined ? {} : { rank }),
    ...(kind === 'monster' && detail.currentNode.monsterId !== undefined
      ? { visualAssetKey: getInfiniteFlowMonsterWorldVisualKey(detail.currentNode.monsterId) } : {}),
    x: 500,
    y: 400,
    radius: 115,
    ...targetAction(action),
  }];
}

function exploreWorld(model: GameViewModel, detail: ExploreDetailViewModel): WalkWorldSpec {
  const actions = model.sections[2].actions;
  return {
    key: `explore:${detail.map.dungeonId}:${detail.map.currentNodeId}`,
    theme: DUNGEON_WORLD_THEMES[detail.map.dungeonId],
    width: 1000,
    height: 1000,
    // Stand inside the room, clear of the southern doorway's raised lintel.
    spawn: { x: 500, y: 700 },
    rooms: [{ x: 40, y: 40, width: 920, height: 920, label: detail.currentNode.title }],
    obstacles: perimeter(1000, 1000),
    targets: [...currentRoomTarget(detail, actions), ...roomDoors(detail, actions)],
  };
}

/** Projects only public, currently visible presentation data into a small playable room. */
export function buildWalkWorld(model: GameViewModel): WalkWorldSpec {
  const detail = model.sections[1].detail;
  if (detail.kind === 'hub') return hubWorld(model);
  if (detail.kind === 'explore') return exploreWorld(model, detail);
  if (detail.kind === 'combat') {
    const theme = detail.chapterContext === undefined ? HUB_WORLD_THEME : DUNGEON_WORLD_THEMES[detail.chapterContext.dungeonId];
    return {
      key: `combat:${detail.chapterContext?.dungeonId ?? 'arena'}:${detail.enemy.id}`,
      theme,
      width: 1280,
      height: 1000,
      spawn: { x: 440, y: 700 },
      rooms: [{ x: 40, y: 40, width: 1200, height: 920, label: '战斗区域' }],
      obstacles: perimeter(1280, 1000),
      targets: [{
        id: `monster:${detail.enemy.id}`,
        label: detail.enemy.name,
        kind: 'monster',
        visualAssetKey: getInfiniteFlowMonsterWorldVisualKey(detail.enemy.id),
        interactionLabel: '攻击',
        rank: detail.boss !== undefined ? 'boss' : detail.enemy.id === theme.eliteMonsterId ? 'elite' : 'normal',
        x: 820,
        y: 340,
        radius: 115,
        ...targetAction(uniqueAction(model.sections[2].actions, 'combat.action:attack')),
      }, ...(['north', 'south', 'west', 'east'] as const).map((side) => closedRoomDoor(side, 1280, 1000, '战斗中无法通过房门。'))],
    };
  }
  return { key: 'result', width: 1280, height: 1000, spawn: { x: 640, y: 700 }, obstacles: [], targets: [] };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function overlapsWall(spec: WalkWorldSpec, position: WorldPoint): boolean {
  return spec.obstacles.some((wall) => {
    const dx = position.x - clamp(position.x, wall.x, wall.x + wall.width);
    const dy = position.y - clamp(position.y, wall.y, wall.y + wall.height);
    return dx * dx + dy * dy < FOOT_RADIUS * FOOT_RADIUS - 1e-8;
  });
}

function stepAxis(spec: WalkWorldSpec, position: WorldPoint, axis: 'x' | 'y', distance: number): WorldPoint {
  if (distance === 0) return position;
  const bounds = spec.bounds ?? { x: 0, y: 0, width: spec.width, height: spec.height };
  const minimum = bounds[axis] + FOOT_RADIUS;
  const maximum = bounds[axis] + (axis === 'x' ? bounds.width : bounds.height) - FOOT_RADIUS;
  const next = { ...position, [axis]: clamp(position[axis] + distance, minimum, maximum) };
  if (!overlapsWall(spec, next)) return next;
  let clear = 0;
  let blocked = 1;
  for (let iteration = 0; iteration < 16; iteration += 1) {
    const fraction = (clear + blocked) / 2;
    const candidate = { ...position, [axis]: position[axis] + (next[axis] - position[axis]) * fraction };
    if (overlapsWall(spec, candidate)) blocked = fraction;
    else clear = fraction;
  }
  return { ...position, [axis]: position[axis] + (next[axis] - position[axis]) * clear };
}

/** Continuous walking only: movement and proximity never dispatch game events. */
export function stepWalkPosition(spec: WalkWorldSpec, position: WorldPoint, axis: WorldPoint, dt: number): WorldPoint {
  const magnitude = Math.hypot(axis.x, axis.y);
  if (!Number.isFinite(dt) || dt <= 0 || !Number.isFinite(magnitude) || magnitude === 0) return { ...position };
  const courtyard = spec.key === 'hub';
  const scale = Math.min(dt, courtyard ? 0.05 : MAX_FRAME_SECONDS) / Math.max(1, magnitude);
  const dx = axis.x * (courtyard ? 260 : WALK_SPEED) * scale;
  const dy = axis.y * (courtyard ? 145 : WALK_SPEED) * scale;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / MAX_STEP_DISTANCE));
  let next = position;
  for (let index = 0; index < steps; index += 1) {
    next = stepAxis(spec, next, 'x', dx / steps);
    next = stepAxis(spec, next, 'y', dy / steps);
  }
  return { x: next.x, y: next.y };
}

export function nearestWalkTarget(spec: WalkWorldSpec, position: WorldPoint): WorldTarget | undefined {
  let nearest: WorldTarget | undefined;
  let nearestDistance = Infinity;
  for (const target of spec.targets) {
    const distance = Math.hypot(target.x - position.x, target.y - position.y);
    if (distance <= target.radius && distance < nearestDistance) {
      nearest = target;
      nearestDistance = distance;
    }
  }
  return nearest;
}

export function isWalkPointClear(point: WorldPoint, spec: WalkWorldSpec): boolean {
  const b = spec.bounds ?? { x: 0, y: 0, width: spec.width, height: spec.height };
  return point.x >= b.x + FOOT_RADIUS && point.x <= b.x + b.width - FOOT_RADIUS
    && point.y >= b.y + FOOT_RADIUS && point.y <= b.y + b.height - FOOT_RADIUS
    && !overlapsWall(spec, point);
}

function pointSegmentDistanceSquared(p: WorldPoint, a: WorldPoint, b: WorldPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared, 0, 1);
  return (p.x - a.x - t * dx) ** 2 + (p.y - a.y - t * dy) ** 2;
}

function segmentCrossesRect(a: WorldPoint, b: WorldPoint, rect: WorldRect): boolean {
  let low = 0;
  let high = 1;
  for (const [axis, size] of [['x', 'width'], ['y', 'height']] as const) {
    const delta = b[axis] - a[axis];
    if (delta === 0) {
      if (a[axis] < rect[axis] || a[axis] > rect[axis] + rect[size]) return false;
    } else {
      let t0 = (rect[axis] - a[axis]) / delta;
      let t1 = (rect[axis] + rect[size] - a[axis]) / delta;
      if (t0 > t1) [t0, t1] = [t1, t0];
      low = Math.max(low, t0);
      high = Math.min(high, t1);
      if (low > high) return false;
    }
  }
  return true;
}

export function isWalkSegmentClear(a: WorldPoint, b: WorldPoint, spec: WalkWorldSpec): boolean {
  if (!isWalkPointClear(a, spec) || !isWalkPointClear(b, spec)) return false;
  return !spec.obstacles.some((rect) => {
    if (segmentCrossesRect(a, b, rect)) return true;
    const corners: readonly WorldPoint[] = [
      { x: rect.x, y: rect.y }, { x: rect.x + rect.width, y: rect.y },
      { x: rect.x + rect.width, y: rect.y + rect.height }, { x: rect.x, y: rect.y + rect.height },
    ];
    return corners.some((c, i) => {
      const d = corners[(i + 1) % 4]!;
      return Math.min(pointSegmentDistanceSquared(a, c, d), pointSegmentDistanceSquared(b, c, d),
        pointSegmentDistanceSquared(c, a, b), pointSegmentDistanceSquared(d, a, b)) < FOOT_RADIUS ** 2 - 1e-8;
    });
  });
}

function travelCost(a: WorldPoint, b: WorldPoint): number {
  return Math.hypot((b.x - a.x) / 260, (b.y - a.y) / 145);
}

/** Courtyard click navigation uses exact foot clearance and a small visibility-smoothed A* grid. */
export function findWalkPath(spec: WalkWorldSpec, start: WorldPoint, destination: WorldPoint): WorldPoint[] {
  if (!isWalkPointClear(start, spec) || !isWalkPointClear(destination, spec)) return [];
  if (start.x === destination.x && start.y === destination.y) return [];
  if (isWalkSegmentClear(start, destination, spec)) return [{ ...destination }];
  const bounds = spec.bounds ?? { x: 0, y: 0, width: spec.width, height: spec.height };
  const right = bounds.x + bounds.width - FOOT_RADIUS;
  const bottom = bounds.y + bounds.height - FOOT_RADIUS;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let x = bounds.x + FOOT_RADIUS; x < right; x += 32) xs.push(x);
  xs.push(right);
  for (let y = bounds.y + FOOT_RADIUS; y < bottom; y += 32) ys.push(y);
  ys.push(bottom);
  type PathNode = WorldPoint & Readonly<{ row: number; column: number }>;
  const nodes = new Map<number, PathNode>();
  for (let row = 0; row < ys.length; row += 1) {
    for (let column = 0; column < xs.length; column += 1) {
      const point = { x: xs[column]!, y: ys[row]!, row, column };
      if (isWalkPointClear(point, spec)) nodes.set(row * xs.length + column, point);
    }
  }
  const startId = -1;
  const goalId = -2;
  const startLinks = [...nodes].filter(([, point]) => isWalkSegmentClear(start, point, spec)).map(([id]) => id);
  nodes.set(startId, { ...start, row: -1, column: -1 });
  nodes.set(goalId, { ...destination, row: -1, column: -1 });
  const open = new Set([startId]);
  const closed = new Set<number>();
  const cost = new Map([[startId, 0]]);
  const score = new Map([[startId, travelCost(start, destination)]]);
  const parents = new Map<number, number>();
  while (open.size > 0) {
    let currentId = startId;
    let best = Infinity;
    for (const id of open) {
      const estimate = score.get(id)!;
      if (estimate < best) { currentId = id; best = estimate; }
    }
    if (currentId === goalId) {
      const raw: WorldPoint[] = [];
      for (let id = goalId; id !== startId; id = parents.get(id)!) {
        const point = nodes.get(id)!;
        raw.unshift({ x: point.x, y: point.y });
      }
      const smooth: WorldPoint[] = [];
      let anchor = start;
      let next = 0;
      while (next < raw.length) {
        let farthest = raw.length - 1;
        while (farthest > next && !isWalkSegmentClear(anchor, raw[farthest]!, spec)) farthest -= 1;
        const point = raw[farthest]!;
        smooth.push(point);
        anchor = point;
        next = farthest + 1;
      }
      return smooth;
    }
    open.delete(currentId);
    closed.add(currentId);
    const current = nodes.get(currentId)!;
    const neighbors = currentId === startId ? [...startLinks] : [];
    if (currentId !== startId) {
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const row = current.row + dy;
        const column = current.column + dx;
        if (row < 0 || row >= ys.length || column < 0 || column >= xs.length) continue;
        const id = row * xs.length + column;
        if (nodes.has(id)) neighbors.push(id);
      }
      if (isWalkSegmentClear(current, destination, spec)) neighbors.push(goalId);
    }
    for (const id of neighbors) {
      if (closed.has(id)) continue;
      const neighbor = nodes.get(id)!;
      if (!isWalkSegmentClear(current, neighbor, spec)) continue;
      const proposed = cost.get(currentId)! + travelCost(current, neighbor);
      if (proposed >= (cost.get(id) ?? Infinity)) continue;
      cost.set(id, proposed);
      score.set(id, proposed + travelCost(neighbor, destination));
      parents.set(id, currentId);
      open.add(id);
    }
  }
  return [];
}
