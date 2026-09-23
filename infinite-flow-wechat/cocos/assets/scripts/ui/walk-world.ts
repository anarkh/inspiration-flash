import type {
  ExploreDetailViewModel,
  GameViewModel,
  HubCatalogPanel,
  MapNodeViewModel,
  ViewActionModel,
} from '@infinite-flow/presentation';
import { DUNGEON_WORLD_THEMES, HUB_WORLD_THEME } from './dungeon-world-theme';
import type { DungeonWorldTheme } from './dungeon-world-theme';

/** World coordinates use a top-left origin; positions refer to the character's feet. */
export type WorldPoint = Readonly<{ x: number; y: number }>;
export type WorldRect = Readonly<{ x: number; y: number; width: number; height: number }>;
export type WorldTarget = Readonly<{
  id: string;
  label: string;
  x: number;
  y: number;
  radius: number;
  kind: 'npc' | 'portal' | 'monster' | 'chest' | 'exit' | 'transition' | 'trap' | 'event' | 'survey' | 'relic' | 'shrine' | 'law';
  interactionLabel?: string;
  rank?: 'normal' | 'elite' | 'boss';
  action?: ViewActionModel;
  destinationNodeId?: string;
  disabledReason?: string;
}>;
export type WalkWorldSpec = Readonly<{
  key: string;
  width: number;
  height: number;
  spawn: WorldPoint;
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
  x: number;
  y: number;
}>[] = [
  { panel: 'equipment', label: '军需官', x: 280, y: 350 },
  { panel: 'supplies', label: '补给商', x: 1000, y: 350 },
  { panel: 'pets', label: '灵宠师', x: 280, y: 580 },
  { panel: 'methods', label: '修行导师', x: 1000, y: 580 },
  { panel: 'bloodlines', label: '血脉祭司', x: 280, y: 850 },
  { panel: 'companions', label: '同行引路人', x: 1000, y: 850 },
  { panel: 'tasks', label: '任务使者', x: 640, y: 1020 },
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
    width: 1280,
    height: 1150,
    spawn: { x: 640, y: 820 },
    rooms: [{ x: 40, y: 40, width: 1200, height: 1070, label: '主神空间' }],
    obstacles: [
      ...perimeter(1280, 1150),
      { x: 435, y: 305, width: 70, height: 90 },
      { x: 775, y: 305, width: 70, height: 90 },
      { x: 435, y: 620, width: 70, height: 90 },
      { x: 775, y: 620, width: 70, height: 90 },
    ],
    targets: [
      { id: 'portal:entry', label: '副本传送门', kind: 'portal', interactionLabel: '选副本', x: 640, y: 160, radius: 110, ...(entry === undefined ? {} : { action: entry }) },
      ...HUB_PEOPLE.map((person): WorldTarget => ({
        id: `npc:${person.panel}`,
        label: person.label,
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
    nodes.map((node, index): WorldTarget => {
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
    obstacles: [
      ...perimeter(1000, 1000),
      { x: 235, y: 260, width: 70, height: 100 },
      { x: 695, y: 260, width: 70, height: 100 },
      { x: 235, y: 620, width: 70, height: 100 },
      { x: 695, y: 620, width: 70, height: 100 },
    ],
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
      obstacles: [
        ...perimeter(1280, 1000),
        { x: 220, y: 270, width: 85, height: 120 },
        { x: 975, y: 620, width: 85, height: 120 },
      ],
      targets: [{
        id: `monster:${detail.enemy.id}`,
        label: detail.enemy.name,
        kind: 'monster',
        interactionLabel: '攻击',
        rank: detail.boss !== undefined ? 'boss' : detail.enemy.id === theme.eliteMonsterId ? 'elite' : 'normal',
        x: 820,
        y: 340,
        radius: 115,
        ...targetAction(uniqueAction(model.sections[2].actions, 'combat.action:attack')),
      }],
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
  const limit = axis === 'x' ? spec.width : spec.height;
  const next = { ...position, [axis]: clamp(position[axis] + distance, FOOT_RADIUS, limit - FOOT_RADIUS) };
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
  const distance = WALK_SPEED * Math.min(dt, MAX_FRAME_SECONDS);
  const scale = distance / Math.max(1, magnitude);
  const dx = axis.x * scale;
  const dy = axis.y * scale;
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
