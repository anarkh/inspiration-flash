import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, getWalkLayout, stepPosition, nearestTarget, findPath, cameraXFor, depthIndex } from './walk-world.mjs';

const empty = { obstacles: [], targets: [] };
const close = (actual, expected, epsilon = 1e-6) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} differs from ${expected}`);

function validFoot(point, layout) {
  const r = WORLD.footRadius;
  const b = layout.bounds ?? WORLD.bounds;
  assert.ok(point.x >= b.x + r - 1e-7 && point.x <= b.x + b.width - r + 1e-7);
  assert.ok(point.y >= b.y + r - 1e-7 && point.y <= b.y + b.height - r + 1e-7);
  for (const wall of layout.obstacles) {
    const dx = point.x - Math.max(wall.x, Math.min(point.x, wall.x + wall.width));
    const dy = point.y - Math.max(wall.y, Math.min(point.y, wall.y + wall.height));
    assert.ok(dx * dx + dy * dy >= r * r - 1e-6, `foot intersects ${JSON.stringify(wall)} at ${JSON.stringify(point)}`);
  }
}

function validPath(start, path, layout) {
  let from = start;
  for (const to of path) {
    const samples = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 2));
    for (let i = 0; i <= samples; i += 1) validFoot({ x: from.x + (to.x - from.x) * i / samples, y: from.y + (to.y - from.y) * i / samples }, layout);
    from = to;
  }
}

test('diagonal input is normalized while half-amplitude joystick input stays analog', () => {
  const origin = { x: 600, y: 560 };
  const straight = stepPosition(origin, { x: 1, y: 0 }, 0.05, empty);
  const diagonal = stepPosition(origin, { x: 1, y: 1 }, 0.05, empty);
  const analog = stepPosition(origin, { x: 0.5, y: 0 }, 0.05, empty);
  close(straight.x - origin.x, 13);
  close(diagonal.x - origin.x, 13 / Math.sqrt(2));
  close(diagonal.y - origin.y, 7.25 / Math.sqrt(2));
  close(Math.hypot((diagonal.x - origin.x) / WORLD.walkSpeedX, (diagonal.y - origin.y) / WORLD.walkSpeedY), 0.05);
  close(analog.x - origin.x, 6.5);
});

test('depth is slower than lateral walking and frame stalls are clamped', () => {
  const origin = { x: 600, y: 560 };
  close(stepPosition(origin, { x: 0, y: 1 }, 0.05, empty).y - origin.y, 7.25);
  close(stepPosition(origin, { x: 1, y: 0 }, 10, empty).x - origin.x, 13);
  assert.deepEqual(stepPosition(origin, { x: 1, y: 0 }, -1, empty), origin);
});

test('complete circular footprint stops at a wall and continues sliding in depth', () => {
  const layout = { obstacles: [{ x: 650, y: 500, width: 50, height: 100 }] };
  let position = { x: 630, y: 550 };
  for (let i = 0; i < 8; i += 1) position = stepPosition(position, { x: 1, y: 1 }, 0.05, layout);
  close(position.x, 636);
  assert.ok(position.y > 590);
  validFoot(position, layout);
  // At a rounded corner, the circle is allowed closer than a bounding square.
  const corner = stepPosition({ x: 630, y: 492 }, { x: 1, y: 0 }, 0.05, layout);
  close(corner.x, 650 - Math.sqrt(14 ** 2 - 8 ** 2));
});

test('continuous axis sweep catches thin walls in both directions', () => {
  const layout = { obstacles: [{ x: 650, y: 500, width: 0.01, height: 120 }] };
  const right = stepPosition({ x: 634, y: 550 }, { x: 1, y: 0 }, 0.05, layout);
  const left = stepPosition({ x: 667, y: 550 }, { x: -1, y: 0 }, 0.05, layout);
  close(right.x, 636);
  close(left.x, 664.01);
  validFoot(right, layout);
  validFoot(left, layout);
});

test('all four boundaries contain the whole foot circle', () => {
  for (const [position, input, expected] of [
    [{ x: 80, y: 500 }, { x: -1, y: 0 }, { x: 78, y: 500 }],
    [{ x: 1120, y: 500 }, { x: 1, y: 0 }, { x: 1122, y: 500 }],
    [{ x: 500, y: 435 }, { x: 0, y: -1 }, { x: 500, y: 434 }],
    [{ x: 500, y: 651 }, { x: 0, y: 1 }, { x: 500, y: 652 }],
  ]) assert.deepEqual(stepPosition(position, input, 0.05, empty), expected);
});

test('nearest target is only offered inside its own interaction radius', () => {
  const a = { id: 'near', x: 500, y: 550, radius: 100 };
  const b = { id: 'far', x: 520, y: 550, radius: 100 };
  assert.equal(nearestTarget({ x: 480, y: 550 }, [b, a]), a);
  assert.equal(nearestTarget({ x: 400, y: 550 }, [a]), a);
  assert.equal(nearestTarget({ x: 399, y: 550 }, [a]), undefined);
});

test('pathfinding goes around a blocked direct path and preserves the exact free destination', () => {
  const layout = { obstacles: [{ x: 600, y: 490, width: 110, height: 100 }] };
  const start = { x: 350, y: 550 };
  const destination = { x: 1021.4, y: 551.7 };
  const path = findPath(start, destination, layout);
  assert.ok(path.length > 1);
  assert.deepEqual(path.at(-1), destination);
  assert.ok(!path.some((point) => point.x === start.x && point.y === start.y));
  validPath(start, path, layout);
});

test('pathfinding rejects a sealed corridor and blocked or out-of-bounds destinations', () => {
  const layout = { obstacles: [{ x: 900, y: 420, width: 20, height: 246 }] };
  assert.deepEqual(findPath({ x: 600, y: 550 }, { x: 1100, y: 550 }, layout), []);
  assert.deepEqual(findPath({ x: 600, y: 550 }, { x: 905, y: 550 }, layout), []);
  assert.deepEqual(findPath({ x: 600, y: 550 }, { x: 60, y: 550 }, empty), []);
});

test('all ten layouts have distinct staging and all seven services plus the portal are reachable', () => {
  const signatures = new Set();
  const backdrops = ['sanctuary', 'void', 'camp', 'void', 'sanctuary', 'void', 'void', 'sanctuary', 'void', 'sanctuary'];
  for (let style = 1; style <= 10; style += 1) {
    const layout = getWalkLayout(String(style).padStart(2, '0'));
    assert.equal(layout.themeKey, backdrops[style - 1], `Style ${style}: backdrop metadata mismatch`);
    assert.equal(layout.targets.length, 8);
    assert.deepEqual(layout.targets.filter((target) => target.kind === 'npc').map((target) => target.service).sort(), ['bloodlines', 'companions', 'equipment', 'methods', 'pets', 'supplies', 'tasks']);
    assert.equal(layout.targets.filter((target) => target.kind === 'portal').length, 1);
    assert.equal(WORLD.width, 1200);
    assert.deepEqual(layout.spawn, { x: 600, y: 550 });
    const people = layout.targets.filter((target) => target.kind === 'npc');
    for (let i = 0; i < people.length; i += 1) for (let j = i + 1; j < people.length; j += 1) {
      assert.ok(Math.hypot(people[i].x - people[j].x, people[i].y - people[j].y) >= 170, `Style ${style}: NPCs are crowded`);
    }
    validFoot(layout.spawn, layout);
    signatures.add(JSON.stringify([layout.targets, layout.props]));
    for (const target of layout.targets) {
      validFoot(target, layout);
      const path = findPath(layout.spawn, target, layout);
      assert.ok(path.length, `Style ${style}: ${target.id} unreachable`);
      assert.deepEqual(path.at(-1), { x: target.x, y: target.y });
      validPath(layout.spawn, path, layout);
      assert.equal(nearestTarget(path.at(-1), layout.targets), target);
    }
  }
  assert.equal(signatures.size, 10);
});

test('central-spawn walking reaches every interaction within two seconds', (t) => {
  let slowestNear = { seconds: 0 };
  let longestFullPath = { seconds: 0 };
  for (let style = 1; style <= 10; style += 1) {
    const layout = getWalkLayout(style);
    for (const target of layout.targets) {
      const path = findPath(layout.spawn, target, layout);
      let from = layout.spawn;
      let fullPathSeconds = 0;
      for (const point of path) {
        fullPathSeconds += Math.hypot((point.x - from.x) / WORLD.walkSpeedX, (point.y - from.y) / WORLD.walkSpeedY);
        from = point;
      }
      if (fullPathSeconds > longestFullPath.seconds) longestFullPath = { style, target: target.id, seconds: fullPathSeconds };
      // Match tap-to-walk: anisotropic direction, final 14px slowdown, 6px waypoint threshold.
      let position = { ...layout.spawn };
      const dt = 1 / 60;
      let frames = 0;
      while (nearestTarget(position, layout.targets) !== target && frames < 600) {
        while (path.length && Math.hypot(path[0].x - position.x, path[0].y - position.y) < 6) path.shift();
        assert.ok(path.length, `Style ${style}: ${target.id} stopped before reaching interaction range`);
        const point = path[0];
        const dx = (point.x - position.x) / WORLD.walkSpeedX;
        const dy = (point.y - position.y) / WORLD.walkSpeedY;
        const length = Math.hypot(dx, dy);
        const amplitude = Math.min(1, Math.hypot(point.x - position.x, point.y - position.y) / 14);
        position = stepPosition(position, { x: dx / length * amplitude, y: dy / length * amplitude }, dt, layout);
        validFoot(position, layout);
        frames += 1;
      }
      const seconds = frames * dt;
      assert.ok(seconds <= 2, `Style ${style}: ${target.id} takes ${seconds.toFixed(3)}s to approach`);
      if (seconds > slowestNear.seconds) slowestNear = { style, target: target.id, seconds };
    }
  }
  t.diagnostic(`Slowest interaction approach: ${slowestNear.seconds.toFixed(3)}s, style ${slowestNear.style} ${slowestNear.target}; longest complete foot-point path: ${longestFullPath.seconds.toFixed(3)}s, style ${longestFullPath.style} ${longestFullPath.target}.`);
});

test('void stages keep every character foot on the platform, above its front face', () => {
  for (const id of ['02', '04', '06', '07', '09']) {
    const layout = getWalkLayout(id);
    assert.equal(layout.bounds.y + layout.bounds.height, 620);
    let position = { ...layout.spawn, x: WORLD.bounds.x + WORLD.footRadius };
    for (let i = 0; i < 12; i += 1) position = stepPosition(position, { x: 0, y: 1 }, 0.05, layout);
    close(position.y, 606);
    assert.ok(layout.targets.every((target) => target.y <= 596));
    assert.deepEqual(findPath(layout.spawn, { x: 600, y: 610 }, layout), []);
  }
});

test('camera clamps at both stage ends and larger depth sorts in front', () => {
  assert.equal(cameraXFor(200, 1000), 0);
  assert.equal(cameraXFor(600, 1000), 100);
  assert.equal(cameraXFor(1100, 1000), 200);
  assert.equal(cameraXFor(600, 1300), 0);
  assert.ok(Number.isInteger(depthIndex(550.125)));
  assert.ok(depthIndex(600) > depthIndex(500));
});
