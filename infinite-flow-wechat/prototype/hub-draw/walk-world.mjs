// All positions are world coordinates at the feet, with a top-left origin.
// The stage has a wide horizontal axis and a shallower, slower depth axis.
export const WORLD = Object.freeze({
  width: 1200,
  height: 720,
  bounds: Object.freeze({ x: 64, y: 420, width: 1072, height: 246 }),
  footRadius: 14,
  walkSpeedX: 260,
  walkSpeedY: 145,
});

const SERVICES = ['equipment', 'supplies', 'pets', 'methods', 'bloodlines', 'companions', 'tasks'];
const SERVICE_LABELS = ['军需官', '补给商', '灵宠师', '修行导师', '血脉祭司', '同行引路人', '任务使者'];
const VOID_STYLE_IDS = new Set([2, 4, 6, 7, 9]);
const LAYOUTS = [
  { name: '归墟圣殿', themeKey: 'sanctuary', people: [[170, 466], [290, 636], [440, 466], [560, 636], [710, 466], [830, 636], [980, 466]], portal: [1080, 636], props: [['pillar', 310, 480, 76, 170], ['pillar', 585, 480, 76, 170], ['altar', 695, 628, 118, 90], ['lamp', 1110, 480, 42, 95]] },
  { name: '星环议庭', themeKey: 'void', people: [[170, 636], [300, 466], [440, 636], [580, 466], [720, 636], [860, 466], [1000, 636]], portal: [1080, 466], props: [['altar', 580, 584, 140, 92], ['pillar', 440, 478, 58, 136], ['pillar', 715, 478, 58, 136], ['lamp', 1120, 584, 40, 92]] },
  { name: '灰烬营地', themeKey: 'camp', people: [[170, 466], [430, 466], [290, 636], [710, 466], [560, 636], [980, 466], [830, 636]], portal: [1080, 636], props: [['crate', 695, 628, 102, 65], ['crate', 310, 480, 76, 55], ['altar', 585, 482, 104, 68], ['lamp', 1110, 480, 44, 115]] },
  { name: '主神档案', themeKey: 'void', people: [[180, 636], [310, 466], [450, 636], [590, 466], [730, 636], [870, 466], [1000, 636]], portal: [1080, 466], props: [['crate', 450, 478, 120, 88], ['pillar', 590, 584, 62, 152], ['crate', 725, 478, 112, 88], ['lamp', 1120, 584, 42, 90]] },
  { name: '黑曜神龛', themeKey: 'sanctuary', people: [[180, 466], [300, 636], [450, 466], [570, 636], [720, 466], [840, 636], [990, 466]], portal: [1080, 636], props: [['altar', 320, 480, 122, 108], ['pillar', 595, 480, 76, 180], ['pillar', 705, 628, 76, 180], ['lamp', 1110, 480, 38, 125]] },
  { name: '青铜仪盘', themeKey: 'void', people: [[160, 636], [290, 466], [430, 636], [570, 466], [710, 636], [850, 466], [990, 636]], portal: [1080, 466], props: [['altar', 570, 584, 140, 108], ['lamp', 1120, 584, 48, 120], ['pillar', 430, 478, 64, 132], ['crate', 705, 478, 84, 58]] },
  { name: '虚空月台', themeKey: 'void', people: [[170, 466], [290, 636], [440, 466], [560, 636], [710, 466], [830, 636], [980, 466]], portal: [1080, 636], props: [['pillar', 310, 478, 58, 176], ['pillar', 585, 478, 58, 176], ['crate', 695, 584, 108, 72], ['lamp', 1110, 478, 44, 130]] },
  { name: '万象回廊', themeKey: 'sanctuary', people: [[170, 636], [300, 466], [440, 636], [580, 466], [720, 636], [860, 466], [1000, 636]], portal: [1080, 466], props: [['pillar', 440, 480, 62, 186], ['pillar', 580, 628, 62, 186], ['pillar', 715, 480, 62, 186], ['altar', 1120, 628, 104, 84]] },
  { name: '冷光终端', themeKey: 'void', people: [[180, 466], [300, 636], [450, 466], [570, 636], [720, 466], [840, 636], [990, 466]], portal: [1080, 636], props: [['crate', 320, 478, 98, 102], ['pillar', 595, 478, 60, 168], ['altar', 705, 584, 112, 102], ['lamp', 1110, 478, 40, 134]] },
  { name: '轮回庭院', themeKey: 'sanctuary', people: [[160, 636], [290, 466], [430, 636], [570, 466], [710, 636], [850, 466], [990, 636]], portal: [1080, 466], props: [['altar', 430, 480, 120, 84], ['lamp', 1120, 628, 46, 118], ['crate', 705, 480, 92, 68], ['pillar', 570, 628, 72, 150]] },
];

/** Props use a foot anchor; obstacles describe only their ground footprint. */
export function getWalkLayout(styleId) {
  const index = Number(styleId) - 1;
  const source = LAYOUTS[index];
  if (!source) throw new RangeError(`Unknown hub style: ${styleId}`);
  const voidStage = VOID_STYLE_IDS.has(index + 1);
  const bounds = voidStage ? { ...WORLD.bounds, height: 200 } : { ...WORLD.bounds };
  const stageY = (y) => voidStage ? Math.min(y, 596) : y;
  const props = source.props.map(([kind, x, y, width, height], i) => ({
    id: `prop:${String(index + 1).padStart(2, '0')}:${i}`,
    kind, x, y: stageY(y), width, height, solid: kind !== 'lamp',
  }));
  return {
    id: String(index + 1).padStart(2, '0'),
    name: source.name,
    themeKey: source.themeKey,
    bounds,
    spawn: { x: 600, y: 550 },
    targets: [
      ...SERVICES.map((service, i) => ({ id: `npc:${service}`, kind: 'npc', service, label: SERVICE_LABELS[i], x: source.people[i][0], y: stageY(source.people[i][1]), radius: 100 })),
      { id: 'portal:entry', kind: 'portal', label: '副本传送门', x: source.portal[0], y: stageY(source.portal[1]), radius: 120 },
    ],
    props,
    obstacles: props.filter((prop) => prop.solid).map((prop) => ({
      x: prop.x - prop.width * 0.36,
      y: prop.y - 14,
      width: prop.width * 0.72,
      height: 24,
    })),
  };
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function footBounds(layout) {
  const bounds = layout.bounds ?? WORLD.bounds;
  const { footRadius } = WORLD;
  return { left: bounds.x + footRadius, right: bounds.x + bounds.width - footRadius, top: bounds.y + footRadius, bottom: bounds.y + bounds.height - footRadius };
}

function freePoint(point, layout) {
  const b = footBounds(layout);
  if (point.x < b.left || point.x > b.right || point.y < b.top || point.y > b.bottom) return false;
  return !layout.obstacles.some((rect) => {
    const dx = point.x - clamp(point.x, rect.x, rect.x + rect.width);
    const dy = point.y - clamp(point.y, rect.y, rect.y + rect.height);
    return dx * dx + dy * dy < WORLD.footRadius ** 2 - 1e-8;
  });
}

// Sweep the complete foot circle along one axis. At this fixed depth, the
// rounded rectangle's exact collision interval prevents even thin-wall tunneling.
function stepAxis(point, axis, distance, layout) {
  if (!distance) return point;
  const b = footBounds(layout);
  const start = point[axis];
  let end = clamp(start + distance, axis === 'x' ? b.left : b.top, axis === 'x' ? b.right : b.bottom);
  const other = axis === 'x' ? 'y' : 'x';
  const size = axis === 'x' ? 'width' : 'height';
  const otherSize = axis === 'x' ? 'height' : 'width';
  for (const wall of layout.obstacles) {
    const perpendicular = point[other] - clamp(point[other], wall[other], wall[other] + wall[otherSize]);
    if (Math.abs(perpendicular) >= WORLD.footRadius) continue;
    const extension = Math.sqrt(WORLD.footRadius ** 2 - perpendicular ** 2);
    const lower = wall[axis] - extension;
    const upper = wall[axis] + wall[size] + extension;
    if (distance > 0 && start <= lower + 1e-8 && end > lower) end = Math.min(end, lower);
    if (distance < 0 && start >= upper - 1e-8 && end < upper) end = Math.max(end, upper);
  }
  return { ...point, [axis]: end };
}

/** Movement never dispatches interactions or chooses a service. */
export function stepPosition(position, input, dt, layout) {
  const magnitude = Math.hypot(input.x, input.y);
  if (!Number.isFinite(dt) || dt <= 0 || !Number.isFinite(magnitude) || magnitude === 0) return { ...position };
  const scale = Math.min(dt, 0.05) / Math.max(1, magnitude);
  const dx = input.x * WORLD.walkSpeedX * scale;
  const dy = input.y * WORLD.walkSpeedY * scale;
  // Small steps retain smooth sliding around the rounded footprint corners.
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (WORLD.footRadius / 2)));
  let next = position;
  for (let i = 0; i < steps; i += 1) {
    next = stepAxis(next, 'x', dx / steps, layout);
    next = stepAxis(next, 'y', dy / steps, layout);
  }
  return { x: next.x, y: next.y };
}

export function nearestTarget(position, targets) {
  let nearest;
  let nearestDistance = Infinity;
  for (const target of targets) {
    const distance = Math.hypot(position.x - target.x, position.y - target.y);
    if (distance <= target.radius && distance < nearestDistance) {
      nearest = target;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function pointSegmentDistanceSquared(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared, 0, 1);
  return (p.x - a.x - t * dx) ** 2 + (p.y - a.y - t * dy) ** 2;
}

function segmentCrossesRect(a, b, rect) {
  let low = 0;
  let high = 1;
  for (const [axis, size] of [['x', 'width'], ['y', 'height']]) {
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

function segmentRectDistanceSquared(a, b, rect) {
  if (segmentCrossesRect(a, b, rect)) return 0;
  const corners = [
    { x: rect.x, y: rect.y }, { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height }, { x: rect.x, y: rect.y + rect.height },
  ];
  let minimum = Infinity;
  for (let i = 0; i < 4; i += 1) {
    const c = corners[i];
    const d = corners[(i + 1) % 4];
    minimum = Math.min(minimum,
      pointSegmentDistanceSquared(a, c, d), pointSegmentDistanceSquared(b, c, d),
      pointSegmentDistanceSquared(c, a, b), pointSegmentDistanceSquared(d, a, b));
  }
  return minimum;
}

function clearSegment(a, b, layout) {
  // The walkable bounds are convex, so checking both feet also covers the segment.
  return freePoint(a, layout) && freePoint(b, layout)
    && !layout.obstacles.some((rect) => segmentRectDistanceSquared(a, b, rect) < WORLD.footRadius ** 2 - 1e-8);
}

function travelCost(a, b) {
  return Math.hypot((b.x - a.x) / WORLD.walkSpeedX, (b.y - a.y) / WORLD.walkSpeedY);
}

/** A small 32-pixel A* grid, with exact circle clearance and visible-path smoothing. */
export function findPath(start, destination, layout) {
  if (!freePoint(start, layout) || !freePoint(destination, layout)) return [];
  if (start.x === destination.x && start.y === destination.y) return [];
  if (clearSegment(start, destination, layout)) return [{ x: destination.x, y: destination.y }];
  const b = footBounds(layout);
  const cell = 32;
  const xs = [];
  const ys = [];
  for (let x = b.left; x < b.right; x += cell) xs.push(x);
  xs.push(b.right);
  for (let y = b.top; y < b.bottom; y += cell) ys.push(y);
  ys.push(b.bottom);
  const nodes = new Map();
  for (let row = 0; row < ys.length; row += 1) {
    for (let column = 0; column < xs.length; column += 1) {
      const point = { x: xs[column], y: ys[row], row, column };
      if (freePoint(point, layout)) nodes.set(row * xs.length + column, point);
    }
  }
  const startId = -1;
  const goalId = -2;
  const startLinks = [...nodes].filter(([, point]) => clearSegment(start, point, layout)).map(([id]) => id);
  nodes.set(startId, { ...start });
  nodes.set(goalId, { ...destination });
  const open = new Set([startId]);
  const closed = new Set();
  const cost = new Map([[startId, 0]]);
  const score = new Map([[startId, travelCost(start, destination)]]);
  const parents = new Map();
  while (open.size) {
    let currentId;
    let best = Infinity;
    for (const id of open) {
      if (score.get(id) < best) { currentId = id; best = score.get(id); }
    }
    if (currentId === goalId) {
      const raw = [];
      for (let id = goalId; id !== startId; id = parents.get(id)) {
        const { x, y } = nodes.get(id);
        raw.unshift({ x, y });
      }
      const smooth = [];
      let anchor = start;
      let next = 0;
      while (next < raw.length) {
        let farthest = raw.length - 1;
        while (farthest > next && !clearSegment(anchor, raw[farthest], layout)) farthest -= 1;
        smooth.push(raw[farthest]);
        anchor = raw[farthest];
        next = farthest + 1;
      }
      return smooth;
    }
    open.delete(currentId);
    closed.add(currentId);
    const current = nodes.get(currentId);
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
      if (clearSegment(current, destination, layout)) neighbors.push(goalId);
    }
    for (const id of neighbors) {
      if (closed.has(id)) continue;
      const neighbor = nodes.get(id);
      if (!clearSegment(current, neighbor, layout)) continue;
      const proposed = cost.get(currentId) + travelCost(current, neighbor);
      if (proposed >= (cost.get(id) ?? Infinity)) continue;
      cost.set(id, proposed);
      score.set(id, proposed + travelCost(neighbor, destination));
      parents.set(id, currentId);
      open.add(id);
    }
  }
  return [];
}

export function cameraXFor(playerX, viewWidth) {
  return clamp(playerX - viewWidth / 2, 0, Math.max(0, WORLD.width - viewWidth));
}

export function depthIndex(y) { return Math.round(y * 100); }
