import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../../', import.meta.url));
const bundle = await build({
  stdin: {
    contents: `
      export * from './cocos/assets/scripts/ui/walk-world.ts';
      export { getInfiniteFlowSceneVisualKeys } from './cocos/assets/scripts/ui/scene-visuals.ts';
      export { createInitialState, DUNGEON_ORDER, DUNGEONS, MONSTERS } from '@infinite-flow/core';
      export { getBossDefinition } from '@infinite-flow/core/boss-system';
      export { DUNGEON_ELITE_MONSTERS } from './packages/core/src/dungeon-loot.ts';
      export { DUNGEON_WORLD_THEMES } from './cocos/assets/scripts/ui/dungeon-world-theme.ts';
      export { reduceGameCommand } from '@infinite-flow/application';
      export { buildGameViewModel } from '@infinite-flow/presentation';
    `,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  absWorkingDir: resolve(root),
});
const {
  buildWalkWorld, describeRouteChange, describeTaskChange, stepWalkPosition, nearestWalkTarget, findWalkPath, isWalkPointClear, isWalkSegmentClear, getInfiniteFlowSceneVisualKeys,
  walkApproachPoint, walkAxisSpeed,
  createInitialState, reduceGameCommand, buildGameViewModel,
  DUNGEON_ORDER, DUNGEONS, MONSTERS, getBossDefinition, DUNGEON_ELITE_MONSTERS, DUNGEON_WORLD_THEMES,
} = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

let checks = 0;
function check(label, run) {
  try { run(); checks += 1; }
  catch (error) { throw new Error(`Walk world: ${label}`, { cause: error }); }
}
function approximately(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 0.001, `${message}: expected ${expected}, received ${actual}`);
}
function emptyWorld(overrides = {}) {
  return { key: 'fixture', width: 1000, height: 1000, spawn: { x: 500, y: 500 }, obstacles: [], targets: [], ...overrides };
}
function walkFor(spec, position, axis, seconds) {
  let result = position;
  for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 60) {
    result = stepWalkPosition(spec, result, axis, Math.min(1 / 60, seconds - elapsed));
  }
  return result;
}
function withDetail(model, detail, actions = model.sections[2].actions) {
  const sections = [...model.sections];
  sections[1] = { ...sections[1], detail };
  sections[2] = { ...sections[2], actions };
  return { ...model, sections };
}
function commit(state, command) {
  const result = reduceGameCommand(state, command);
  assert.equal(result.status, 'committed', result.reason?.message);
  return result.state;
}
function requireMonsterVisual(world, view, monsterId, label) {
  assert.ok(MONSTERS[monsterId], `${label}: monster identity must exist in the real catalog`);
  const expectedKey = `monster:${monsterId}_world`;
  const monsters = world.targets.filter((target) => target.kind === 'monster');
  assert.equal(monsters.length, 1, `${label}: exactly one visible monster`);
  assert.equal(monsters[0].visualAssetKey, expectedKey, `${label}: world figure uses the real monster identity`);
  assert.equal(getInfiniteFlowSceneVisualKeys(view).opponent, expectedKey,
    `${label}: the scene requests the same world figure`);
}
function requireNoMonsterVisual(world, view, label) {
  assert.ok(world.targets.every((target) => !target.visualAssetKey?.startsWith('monster:')),
    `${label}: inactive or non-monster targets must not request monster art`);
  assert.equal(getInfiniteFlowSceneVisualKeys(view).opponent, undefined,
    `${label}: the scene must not request an inactive or non-monster opponent`);
}

const ROOM_SIDES = ['north', 'south', 'west', 'east'];
const EXPLORE_PERIMETER = [
  { x: 0, y: 0, width: 1000, height: 40 },
  { x: 0, y: 960, width: 1000, height: 40 },
  { x: 0, y: 40, width: 40, height: 920 },
  { x: 960, y: 40, width: 40, height: 920 },
];
const COMBAT_PERIMETER = [
  { x: 0, y: 0, width: 1280, height: 40 },
  { x: 0, y: 960, width: 1280, height: 40 },
  { x: 0, y: 40, width: 40, height: 920 },
  { x: 1240, y: 40, width: 40, height: 920 },
];

function requireFourRoomDirections(world, view, label) {
  const detail = view.sections[1].detail;
  const current = detail.map.nodes.find((node) => node.nodeId === detail.map.currentNodeId);
  assert.ok(current, `${label}: current public map cell exists`);
  const neighbors = detail.map.nodes.filter((node) => node.isAdjacent && node.cellId !== current.cellId);
  const doors = world.targets.filter((target) => target.kind === 'transition');
  const realDoors = doors.filter((target) => target.id.startsWith('door:'));
  assert.deepEqual(realDoors.map((target) => target.id).sort(), neighbors.map((node) => `door:${node.cellId}`).sort(),
    `${label}: every original adjacent cell is represented exactly once`);
  assert.deepEqual([...new Set(doors.map((target) => target.doorSide))].sort(), [...ROOM_SIDES].sort(),
    `${label}: north, south, west and east remain represented`);
  for (const side of ROOM_SIDES) {
    const sameSide = doors.filter((target) => target.doorSide === side);
    const closed = sameSide.filter((target) => target.id.startsWith('closed-door:'));
    assert.equal(closed.length, sameSide.some((target) => target.id.startsWith('door:')) ? 0 : 1,
      `${label}/${side}: a closed marker fills only an absent direction`);
    for (const target of closed) {
      assert.equal(target.id, `closed-door:${side}`);
      assert.equal(target.action, undefined, `${label}: a closed marker never creates an action`);
      assert.equal(target.destinationNodeId, undefined, `${label}: a closed marker never invents a destination`);
      assert.equal(target.disabledReason, '此方向没有相邻区域。');
      assert.equal(target.interactionLabel, '封闭');
    }
  }
  for (const target of realDoors) {
    const neighbor = neighbors.find((node) => `door:${node.cellId}` === target.id);
    assert.ok(neighbor.x === current.x || neighbor.y === current.y,
      `${label}: a real grid neighbor lies on one original cardinal axis`);
    const expectedSide = neighbor.x === current.x ? neighbor.y < current.y ? 'north' : 'south'
      : neighbor.x < current.x ? 'west' : 'east';
    assert.equal(target.doorSide, expectedSide, `${label}: gate direction matches the actual public neighbor coordinates`);
    const sideCoordinate = target.doorSide === 'north' ? target.y
      : target.doorSide === 'south' ? target.y : target.x;
    assert.equal(sideCoordinate, target.doorSide === 'north' || target.doorSide === 'west' ? 125 : 875,
      `${label}: original gate feet remain on the original side anchor`);
    assert.equal(target.radius, 110, `${label}: original interaction range remains`);
    if (doors.filter((door) => door.doorSide === target.doorSide).length === 1) {
      assert.equal(target.doorSide === 'north' || target.doorSide === 'south' ? target.x : target.y, 500,
        `${label}: a single original neighbor keeps the original side midpoint`);
    }
    const visible = neighbor.state !== 'fogged' && neighbor.nodeId !== undefined;
    assert.equal(target.destinationNodeId, visible ? neighbor.nodeId : undefined);
    const candidates = view.sections[2].actions.filter((action) => action.actionId === neighbor.moveActionId);
    const candidate = candidates.length === 1 ? candidates[0] : undefined;
    const legal = visible && neighbor.canMove && candidate?.enabled && candidate.event?.kind === 'command'
      && candidate.event.command.type === 'run/move' && candidate.event.command.nodeId === neighbor.nodeId;
    assert.equal(target.action, legal ? candidate : undefined,
      `${label}: the original exact-destination action controls gate availability`);
    if (target.action) assert.equal(target.action.event, candidate.event, `${label}: no synthetic move event`);
    else assert.ok(target.disabledReason, `${label}: every unavailable gate explains its state`);
  }
}

function requireClosedCombatDirections(world, label) {
  const doors = world.targets.filter((target) => target.kind === 'transition');
  assert.equal(doors.length, 4, `${label}: combat has four closed direction markers`);
  assert.deepEqual(doors.map((target) => target.doorSide).sort(), [...ROOM_SIDES].sort());
  for (const target of doors) {
    assert.equal(target.id, `closed-door:${target.doorSide}`);
    assert.equal(target.action, undefined, `${label}: combat gates cannot dispatch movement`);
    assert.equal(target.destinationNodeId, undefined);
    assert.equal(target.disabledReason, '战斗中无法通过房门。');
  }
  assert.deepEqual(doors.map(({ doorSide, x, y }) => [doorSide, x, y]), [
    ['north', 640, 125], ['south', 640, 875], ['west', 125, 500], ['east', 1155, 500],
  ], `${label}: gates use the original arena edges`);
}

check('up, down, left and right are continuous and reversible', () => {
  const spec = emptyWorld();
  const start = spec.spawn;
  const up = walkFor(spec, start, { x: 0, y: -1 }, 1);
  const down = walkFor(spec, up, { x: 0, y: 1 }, 1);
  approximately(up.y, 60, 'up moves towards the top');
  approximately(down.y, start.y, 'down restores the original position');
  approximately(walkFor(spec, start, { x: -1, y: 0 }, 1).x, 60, 'left');
  approximately(walkFor(spec, start, { x: 1, y: 0 }, 1).x, 940, 'right');
  approximately(stepWalkPosition(spec, start, { x: 0, y: -1 }, 0.007).y, 496.92, 'no grid snapping');
});

check('diagonal walking has the same speed, with proportional joystick input', () => {
  const spec = emptyWorld();
  const start = spec.spawn;
  const diagonal = walkFor(spec, start, { x: 1, y: 1 }, 1);
  approximately(Math.hypot(diagonal.x - start.x, diagonal.y - start.y), 440, 'diagonal speed');
  approximately(diagonal.x, diagonal.y, 'diagonal axes');
  const half = walkFor(spec, start, { x: 0.5, y: 0 }, 1);
  approximately(half.x - start.x, 220, 'joystick magnitude');
});

check('rooms walk evenly at twice the original pace while the courtyard keeps its depth', () => {
  assert.deepEqual(walkAxisSpeed(emptyWorld()), { x: 440, y: 440 });
  assert.deepEqual(walkAxisSpeed({ ...emptyWorld(), key: 'hub' }), { x: 260, y: 145 });
});

check('a door standing in the wall is approached from the nearest walkable point in reach', () => {
  const spec = emptyWorld({ obstacles: [{ x: 960, y: 0, width: 40, height: 1000 }] });
  const door = { id: 'door:east', label: '东', kind: 'transition', x: 975, y: 500, radius: 110 };
  const from = { x: 500, y: 500 };
  const point = walkApproachPoint(spec, door, from);
  assert.ok(isWalkPointClear(point, spec), 'the approach point is walkable');
  assert.ok(Math.hypot(point.x - door.x, point.y - door.y) <= door.radius, 'the approach point is within the door reach');
  assert.ok(findWalkPath(spec, from, point).length > 0, 'the door can be reached');
  assert.deepEqual(walkApproachPoint(spec, { ...door, x: 800 }, from), { x: 800, y: 500 }, 'walkable feet stay the destination');
});

check('frame stalls are clamped and zero or invalid time does not move', () => {
  const spec = emptyWorld();
  approximately(stepWalkPosition(spec, spec.spawn, { x: 1, y: 0 }, 10).x, 544, 'frame clamp');
  for (const dt of [0, -1, NaN, Infinity]) {
    assert.deepEqual(stepWalkPosition(spec, spec.spawn, { x: 1, y: 0 }, dt), spec.spawn);
  }
  assert.deepEqual(stepWalkPosition(spec, spec.spawn, { x: 0, y: 0 }, 0.1), spec.spawn);
});

check('the circular feet stop at thin walls and slide along their face', () => {
  const spec = emptyWorld({ obstacles: [{ x: 100, y: 0, width: 1, height: 300 }] });
  const stopped = stepWalkPosition(spec, { x: 80, y: 100 }, { x: 1, y: 0 }, 100);
  approximately(stopped.x, 86, 'foot radius at a one-pixel wall');
  const slid = stepWalkPosition(spec, { x: 85, y: 100 }, { x: 1, y: 1 }, 0.1);
  approximately(slid.x, 86, 'horizontal wall contact');
  approximately(slid.y, 100 + 44 / Math.SQRT2, 'vertical sliding');
  assert.ok(stopped.x < 100, 'a long frame cannot tunnel through the wall');
});

check('collision uses a circle around corners and obeys world bounds', () => {
  const corner = emptyWorld({ obstacles: [{ x: 100, y: 100, width: 50, height: 50 }] });
  const next = stepWalkPosition(corner, { x: 80, y: 80 }, { x: 1, y: 1 }, 0.1);
  assert.ok(next.x > 86 && next.y > 86, 'the circle may enter the empty corner of an expanded rectangle');
  assert.ok(Math.hypot(100 - next.x, 100 - next.y) >= 14 - 0.001, 'circle must remain outside the wall');
  assert.deepEqual(stepWalkPosition(emptyWorld(), { x: 15, y: 15 }, { x: -1, y: -1 }, 0.1), { x: 14, y: 14 });
  assert.deepEqual(stepWalkPosition(emptyWorld(), { x: 985, y: 985 }, { x: 1, y: 1 }, 0.1), { x: 986, y: 986 });
});

check('target proximity uses the target radius and closest in-range target', () => {
  const one = { id: 'one', label: '一', kind: 'npc', x: 200, y: 200, radius: 100 };
  const two = { id: 'two', label: '二', kind: 'chest', x: 260, y: 200, radius: 100 };
  const spec = emptyWorld({ targets: [one, two] });
  assert.equal(nearestWalkTarget(spec, { x: 99.9, y: 200 }), undefined);
  assert.equal(nearestWalkTarget(spec, { x: 100, y: 200 }), one);
  assert.equal(nearestWalkTarget(spec, { x: 251, y: 200 }), two);
});

const initial = createInitialState();
const hubView = buildGameViewModel(initial, {});
const hub = buildWalkWorld(hubView);
const confirm = hubView.sections[2].actions.find((action) => action.actionId === 'hub.entry.confirm');

check('approved courtyard keeps the exact final layout and original seeded entry request', () => {
  assert.deepEqual([hub.width, hub.height, hub.spawn.x, hub.spawn.y], [1200, 720, 600, 550]);
  assert.deepEqual(hub.bounds, { x: 64, y: 420, width: 1072, height: 246 });
  assert.equal(hub.targets.filter((target) => target.kind === 'npc').length, 7);
  const portal = hub.targets.find((target) => target.id === 'portal:entry');
  assert.equal(portal.action, confirm);
  assert.equal(portal.action.event.kind, 'local');
  assert.equal(portal.action.event.action.type, 'entry/request-enter');
  for (const npc of hub.targets.filter((target) => target.kind === 'npc')) {
    assert.equal(npc.action, hubView.sections[2].actions.find((action) => action.actionId === `hub.panel:${npc.id.slice(4)}`));
    assert.equal(npc.action.event.action.type, 'hub/select-panel');
  }
  assert.deepEqual(hub.targets.filter((target) => target.kind === 'npc').map(({ id, x, y, radius }) => [id, x, y, radius]), [
    ['npc:equipment', 160, 636, 100], ['npc:supplies', 290, 466, 100], ['npc:pets', 430, 636, 100],
    ['npc:methods', 570, 466, 100], ['npc:bloodlines', 710, 636, 100], ['npc:companions', 850, 466, 100],
    ['npc:tasks', 990, 636, 100],
  ]);
  assert.deepEqual([portal.x, portal.y, portal.radius], [1080, 466, 120]);
  assert.equal(getInfiniteFlowSceneVisualKeys(hubView).background, 'scene:hub_courtyard_walk');
});

check('courtyard props collide only at their ground footprints and the lamp stays passable', () => {
  assert.deepEqual(hub.props.map(({ kind, x, y, width, height, visualAssetKey }) => [kind, x, y, width, height, visualAssetKey]), [
    ['altar', 430, 480, 120, 84, 'scene:courtyard_altar'],
    ['lamp', 1120, 628, 46, 118, 'scene:courtyard_lamp'],
    ['crate', 705, 480, 92, 68, 'scene:courtyard_crate'],
    ['pillar', 570, 628, 72, 150, 'scene:courtyard_pillar'],
  ]);
  const expectedFootprints = [
    { x: 386.8, y: 466, width: 86.4, height: 24 },
    { x: 671.88, y: 466, width: 66.24, height: 24 },
    { x: 544.08, y: 614, width: 51.84, height: 24 },
  ];
  assert.equal(hub.obstacles.length, expectedFootprints.length);
  hub.obstacles.forEach((obstacle, index) => {
    for (const property of ['x', 'y', 'width', 'height']) {
      approximately(obstacle[property], expectedFootprints[index][property], `footprint ${index}/${property}`);
    }
  });
  for (const obstacle of hub.obstacles) {
    const y = obstacle.y + obstacle.height / 2;
    const start = { x: obstacle.x - 35, y };
    const stopped = walkFor(hub, start, { x: 1, y: 0 }, 0.5);
    approximately(stopped.x, obstacle.x - 14, 'feet remain outside the painted base');
  }
  const lampWalk = walkFor(hub, { x: 1120, y: 570 }, { x: 0, y: 1 }, 0.5);
  assert.ok(lampWalk.y > 628, 'decorative lamp cannot create an invisible wall');
});

check('courtyard lateral and depth speeds match the approved prototype and bounded feet stay on the floor', () => {
  approximately(walkFor(hub, hub.spawn, { x: 1, y: 0 }, 1).x, 860, 'lateral speed');
  approximately(walkFor(hub, hub.spawn, { x: 0, y: -1 }, 0.5).y, 477.5, 'shallow depth speed');
  assert.deepEqual(stepWalkPosition(hub, { x: 80, y: 435 }, { x: -1, y: -1 }, 0.1), { x: 78, y: 434 });
  assert.deepEqual(stepWalkPosition(hub, { x: 1120, y: 650 }, { x: 1, y: 1 }, 0.1), { x: 1122, y: 652 });
});

function requireClearCourtyardFeet(position, label) {
  assert.ok(position.x >= 78 - 1e-6 && position.x <= 1122 + 1e-6
    && position.y >= 434 - 1e-6 && position.y <= 652 + 1e-6, `${label}: complete feet stay in the shallow lane`);
  for (const obstacle of hub.obstacles) {
    const x = Math.max(obstacle.x, Math.min(position.x, obstacle.x + obstacle.width));
    const y = Math.max(obstacle.y, Math.min(position.y, obstacle.y + obstacle.height));
    assert.ok(Math.hypot(position.x - x, position.y - y) >= 14 - 1e-5, `${label}: complete feet clear every prop base`);
  }
}

check('courtyard routes reach all seven NPCs and the portal with continuous collision-safe walking', () => {
  for (const target of hub.targets) {
    const path = findWalkPath(hub, hub.spawn, target);
    assert.ok(path.length > 0, `${target.id}: real route exists`);
    let previous = hub.spawn;
    for (const waypoint of path) {
      assert.ok(isWalkSegmentClear(previous, waypoint, hub), `${target.id}: smoothed route retains circular foot clearance`);
      previous = waypoint;
    }
    assert.deepEqual({ x: path.at(-1).x, y: path.at(-1).y }, { x: target.x, y: target.y });
    let position = { ...hub.spawn };
    let frames = 0;
    while (nearestWalkTarget(hub, position) !== target && frames < 120) {
      while (path.length > 0 && Math.hypot(path[0].x - position.x, path[0].y - position.y) < 6) path.shift();
      assert.ok(path.length > 0, `${target.id}: walking cannot stop outside its interaction radius`);
      const point = path[0];
      const dx = (point.x - position.x) / 260, dy = (point.y - position.y) / 145;
      const length = Math.hypot(dx, dy);
      const amplitude = Math.min(1, Math.hypot(point.x - position.x, point.y - position.y) / 14);
      position = stepWalkPosition(hub, position, { x: dx / length * amplitude, y: dy / length * amplitude }, 1 / 60);
      requireClearCourtyardFeet(position, target.id);
      frames += 1;
    }
    assert.equal(nearestWalkTarget(hub, position), target, `${target.id}: approaches within two seconds`);
  }
  for (const start of hub.targets) for (const target of hub.targets) {
    if (start === target) continue;
    const path = findWalkPath(hub, start, target);
    assert.ok(path.length > 0, `${start.id} -> ${target.id}: NPC-to-NPC route exists`);
    let previous = start;
    for (const waypoint of path) {
      assert.ok(isWalkSegmentClear(previous, waypoint, hub), `${start.id} -> ${target.id}: every segment is clear`);
      previous = waypoint;
    }
  }
});

check('click navigation rejects sealed, blocked and outside destinations without tunnelling', () => {
  const closed = emptyWorld({ obstacles: [{ x: 490, y: 0, width: 20, height: 1000 }] });
  assert.deepEqual(findWalkPath(closed, { x: 200, y: 500 }, { x: 800, y: 500 }), []);
  assert.equal(isWalkSegmentClear({ x: 200, y: 500 }, { x: 800, y: 500 }, closed), false);
  assert.deepEqual(findWalkPath(hub, hub.spawn, { x: 705, y: 480 }), [], 'crate interior cannot be a destination');
  assert.equal(isWalkPointClear({ x: 705, y: 480 }, hub), false);
  assert.deepEqual(findWalkPath(hub, hub.spawn, { x: 600, y: 420 }), [], 'whole feet must stay within lane bounds');
});

check('selected NPC still exists without a fabricated panel event and hub key stays stable', () => {
  const selectedView = buildGameViewModel(initial, { hubPanel: 'equipment' });
  const selected = buildWalkWorld(selectedView);
  assert.equal(selected.key, hub.key);
  assert.equal(selected.targets.find((target) => target.id === 'npc:equipment').action, undefined);
  assert.equal(selected.targets.find((target) => target.id === 'portal:entry').action,
    selectedView.sections[2].actions.find((action) => action.actionId === 'hub.panel:entry'));
});

let state = commit(initial, {
  type: 'run/enter', ...confirm.event.action.draft,
  seeds: { rulesVersion: 1, hiddenTaskSeed: 0x12345678 },
});
const exploreView = buildGameViewModel(state, {});
const explore = buildWalkWorld(exploreView);

check('exploration starts in one room with an original combat target and blocked adjacent doors', () => {
  assert.deepEqual([explore.width, explore.height, explore.spawn.x, explore.spawn.y], [1000, 1000, 500, 700]);
  assert.equal(nearestWalkTarget(explore, explore.spawn), undefined, 'spawn is clear of doors and their disabled hints');
  assert.equal(explore.rooms.length, 1);
  const detail = exploreView.sections[1].detail;
  assert.equal(explore.key, `explore:${detail.map.dungeonId}:${detail.map.currentNodeId}`);
  const monster = explore.targets.find((target) => target.kind === 'monster');
  assert.ok(monster);
  requireMonsterVisual(explore, exploreView, detail.currentNode.monsterId, 'opening encounter');
  assert.equal(monster.action, exploreView.sections[2].actions.find((action) => action.actionId === `node.select:${detail.currentNode.nodeId}`));
  const doors = explore.targets.filter((target) => target.kind === 'transition');
  requireFourRoomDirections(explore, exploreView, 'opening room');
  assert.deepEqual(explore.obstacles, EXPLORE_PERIMETER, 'the original perimeter remains while interior debris is removed');
  assert.ok(doors.every((door) => door.action === undefined && door.disabledReason));
  assert.equal(nearestWalkTarget(explore, walkFor(explore, explore.spawn, { x: 0, y: -1 }, 0.85)), monster);
});

state = commit(state, explore.targets.find((target) => target.kind === 'monster').action.event.command);
const combatView = buildGameViewModel(state, {});
check('combat is a separate walkable arena and preserves the attack command', () => {
  const arena = buildWalkWorld(combatView);
  assert.deepEqual([arena.width, arena.height, arena.spawn.x, arena.spawn.y], [1280, 1000, 440, 700]);
  assert.deepEqual([arena.targets[0].x, arena.targets[0].y], [820, 340]);
  assert.equal(arena.targets[0].action, combatView.sections[2].actions.find((action) => action.actionId === 'combat.action:attack'));
  assert.deepEqual(arena.obstacles, COMBAT_PERIMETER);
  requireClosedCombatDirections(arena, 'opening combat');
  assert.equal(combatView.sections[1].detail.enemy.id, exploreView.sections[1].detail.currentNode.monsterId,
    'the real encounter command preserves the opening monster identity');
  requireMonsterVisual(arena, combatView, exploreView.sections[1].detail.currentNode.monsterId, 'opening combat');
  const before = JSON.stringify(combatView);
  assert.ok(walkFor(arena, arena.spawn, { x: 0, y: -1 }, 0.4).y < arena.spawn.y);
  assert.equal(JSON.stringify(combatView), before, 'walking cannot mutate combat state');
  const changedTurn = withDetail(combatView, { ...combatView.sections[1].detail, turn: 99 });
  assert.equal(buildWalkWorld(changedTurn).key, arena.key, 'combat turns do not reset walking');
});

for (let turns = 0; state.phase === 'combat'; turns += 1) {
  assert.ok(turns < 10, 'opening combat should complete');
  const attack = buildGameViewModel(state, {}).sections[2].actions.find((action) => action.actionId === 'combat.action:attack');
  state = commit(state, attack.event.command);
}
const clearedView = buildGameViewModel(state, {});
const cleared = buildWalkWorld(clearedView);

check('clearing a room preserves its world key and opens only exact legal movement events', () => {
  assert.equal(cleared.key, explore.key);
  assert.equal(cleared.targets.some((target) => target.kind === 'monster'), false);
  requireNoMonsterVisual(cleared, clearedView, 'cleared opening encounter');
  for (const door of cleared.targets.filter((target) => target.kind === 'transition')) {
    const node = clearedView.sections[1].detail.map.nodes.find((entry) => entry.cellId === door.id.slice(5));
    if (door.id.startsWith('closed-door:')) {
      assert.equal(door.action, undefined);
      assert.equal(door.destinationNodeId, undefined);
      continue;
    }
    if (node.canMove) {
      assert.equal(door.action, clearedView.sections[2].actions.find((action) => action.actionId === node.moveActionId));
      assert.equal(door.action.event.command.type, 'run/move');
      assert.equal(door.action.event.command.nodeId, door.destinationNodeId);
    } else assert.equal(door.action, undefined);
  }
  const door = cleared.targets.find((target) => target.kind === 'transition' && target.action);
  assert.ok(door, 'a cleared opening room exposes a legal neighboring room');
  const moved = commit(state, door.action.event.command);
  assert.notEqual(buildWalkWorld(buildGameViewModel(moved, {})).key, cleared.key);
});

check('same-side branches preserve every original destination and their pre-fit gate coordinates', () => {
  const detail = clearedView.sections[1].detail;
  const current = detail.map.nodes.find((node) => node.nodeId === detail.map.currentNodeId);
  const neighbors = detail.map.nodes.filter((node) => node.isAdjacent && node.canMove && node.moveActionId);
  assert.ok(neighbors.length >= 2, 'the cleared opening room supplies two real movement actions');
  const branchNodes = neighbors.slice(0, 2).map((node, index) => ({ ...node, x: current.x + index + 1, y: current.y }));
  const branched = withDetail(clearedView, { ...detail, map: { ...detail.map, nodes: [current, ...branchNodes] } });
  const world = buildWalkWorld(branched);
  requireFourRoomDirections(world, branched, 'same-side branch fixture');
  const east = world.targets.filter((target) => target.doorSide === 'east');
  assert.equal(east.length, 2, 'the fixed room must not collapse two same-side routes to one');
  assert.deepEqual(east.map(({ x, y, radius }) => [x, y, radius]), [[875, 420, 110], [875, 580, 110]],
    'the original two-branch layout retains its world-space coordinates');
  for (const target of east) {
    const node = branchNodes.find((entry) => `door:${entry.cellId}` === target.id);
    assert.equal(target.action, clearedView.sections[2].actions.find((action) => action.actionId === node.moveActionId));
    assert.equal(target.action.event.command.nodeId, node.nodeId);
  }
});

check('duplicate or wrong-destination actions cannot unlock a door', () => {
  const door = cleared.targets.find((target) => target.kind === 'transition' && target.action);
  const actions = clearedView.sections[2].actions;
  const duplicated = withDetail(clearedView, clearedView.sections[1].detail, [...actions, door.action]);
  assert.equal(buildWalkWorld(duplicated).targets.find((target) => target.id === door.id).action, undefined);
  const wrong = { ...door.action, event: { kind: 'command', command: { type: 'run/move', nodeId: 'other-room' } } };
  const mismatched = withDetail(clearedView, clearedView.sections[1].detail,
    actions.map((action) => action === door.action ? wrong : action));
  assert.equal(buildWalkWorld(mismatched).targets.find((target) => target.id === door.id).action, undefined);
});

check('fogged neighbors never expose hidden labels, node IDs or commands', () => {
  const detail = clearedView.sections[1].detail;
  const visibleNeighbor = detail.map.nodes.find((node) => node.isAdjacent);
  const fogged = withDetail(clearedView, {
    ...detail,
    map: { ...detail.map, nodes: detail.map.nodes.map((node) => node === visibleNeighbor
      ? { ...node, state: 'fogged', title: 'SECRET_HIDDEN_TITLE', nodeId: 'SECRET_HIDDEN_NODE', canMove: true }
      : node) },
  });
  const projected = buildWalkWorld(fogged);
  assert.ok(!JSON.stringify(projected).includes('SECRET_HIDDEN'));
  const door = projected.targets.find((target) => target.id === `door:${visibleNeighbor.cellId}`);
  assert.equal(door.label, '未知区域');
  assert.equal(door.action, undefined);
  assert.equal(door.destinationNodeId, undefined);
  assert.ok(door.disabledReason);
  assert.equal(projected.rooms.length, 1, 'distant fogged rooms are not instantiated');
});

check('pending event choices open the existing detail instead of selecting a branch', () => {
  const detail = clearedView.sections[1].detail;
  const first = { ...confirm, actionId: 'pending.event:fixture:left', placement: 'node', label: '左路' };
  const second = { ...confirm, actionId: 'pending.event:fixture:right', placement: 'node', label: '右路' };
  const pending = withDetail(clearedView, {
    ...detail,
    pending: { kind: 'dungeon-event', title: '岔路碑文', message: '选择路线', actionIds: [first.actionId, second.actionId] },
  }, [first, second]);
  const target = buildWalkWorld(pending).targets.find((entry) => entry.id.startsWith('node:'));
  assert.equal(target.kind, 'event');
  assert.equal(target.label, '岔路碑文');
  assert.equal(target.action, undefined);
  const single = withDetail(pending, { ...pending.sections[1].detail,
    pending: { ...pending.sections[1].detail.pending, actionIds: [first.actionId] },
  }, [first]);
  assert.equal(buildWalkWorld(single).targets.find((entry) => entry.id.startsWith('node:')).action, undefined,
    'a single pending option still requires an explicit choice in the detail sheet');
});

const pendingKinds = {
  'equipment-offer': 'chest',
  'relic-draft': 'relic',
  'soul-recharge': 'shrine',
  'dungeon-event': 'event',
  'field-survey': 'survey',
  law: 'law',
};
const originalKinds = { monster: 'monster', trap: 'trap', portal: 'portal', reward: 'chest', exit: 'exit' };
const pendingFixtures = new Map();
const enteredChapters = new Map();
const kindsCovered = new Set();
const ranksCovered = new Set();
const nodeMonsterIdsCovered = new Set();
const visibleMonsterIdsCovered = new Set();
const aliasMonsterNodesCovered = new Map();
const combatMonsterIdsCovered = new Set();
let realNodesCovered = 0;
let realMonsterNodesCovered = 0;
let combatChaptersCovered = 0;
let originalNeighborBindingsCovered = 0;

// Test-only coverage fixture: resource and unlock overrides permit real reducer entry into
// each chapter. Relocating currentNodeId below is a rendering fixture, not route traversal,
// a saved game, or evidence that any of the 19 chapters has been completed end to end.
const richHub = {
  ...initial,
  rewardPoints: 50_000,
  lingyun: 500,
  inventory: Object.fromEntries(Object.keys(initial.inventory).map((itemId) => [itemId, 50])),
  completedDungeonIds: [...DUNGEON_ORDER],
};
function locateNodeForProjection(entered, nodeId, overrides = {}) {
  return {
    ...entered,
    phase: 'explore',
    combat: undefined,
    run: {
      ...entered.run,
      currentNodeId: nodeId,
      clearedNodeIds: [],
      discoveredNodeIds: [nodeId],
      ...overrides,
    },
  };
}

function requireOriginalActions(world, view) {
  for (const target of world.targets) {
    if (target.action === undefined) continue;
    const action = view.sections[2].actions.find((candidate) => candidate.actionId === target.action.actionId);
    assert.equal(target.action, action, `${target.id}: target must retain the original action object`);
    assert.equal(target.action.event, action.event, `${target.id}: event must be passed through untouched`);
  }
}

check('all 19 chapter themes are distinct and match the real boss and elite catalogs', () => {
  assert.equal(DUNGEON_ORDER.length, 19);
  assert.deepEqual(Object.keys(DUNGEON_WORLD_THEMES).sort(), [...DUNGEON_ORDER].sort());
  assert.equal(new Set(DUNGEON_ORDER.map((id) => DUNGEON_WORLD_THEMES[id].id)).size, 19);
  assert.equal(new Set(DUNGEON_ORDER.map((id) => DUNGEON_WORLD_THEMES[id].motif)).size, 19,
    'chapter identity must vary visibly, beyond a different dictionary key');
  assert.equal(new Set(DUNGEON_ORDER.map((id) => JSON.stringify([
    DUNGEON_WORLD_THEMES[id].ground, DUNGEON_WORLD_THEMES[id].wall, DUNGEON_WORLD_THEMES[id].accent,
  ]))).size, 19, 'each chapter has its own palette');
  for (const dungeonId of DUNGEON_ORDER) {
    const theme = DUNGEON_WORLD_THEMES[dungeonId];
    assert.equal(theme.bossNodeId, getBossDefinition(dungeonId).nodeId);
    assert.equal(theme.eliteMonsterId, DUNGEON_ELITE_MONSTERS[dungeonId]);
    assert.deepEqual([...theme.eliteNodeIds].sort(), DUNGEONS[dungeonId].nodes
      .filter((node) => node.monsterId === DUNGEON_ELITE_MONSTERS[dungeonId]).map((node) => node.id).sort(),
    `${dungeonId}: elite nodes must come from the real chapter definition`);
  }
});

for (const dungeonId of DUNGEON_ORDER) {
  check(`${dungeonId}: real reducer entry and every actual node projection`, () => {
    const entered = commit(richHub, {
      type: 'run/enter', dungeonId, protocolId: 'standard',
      seeds: { rulesVersion: 1, hiddenTaskSeed: 0x12345678 },
    });
    enteredChapters.set(dungeonId, entered);
    assert.equal(entered.phase, 'explore');
    assert.equal(entered.run.dungeonId, dungeonId);
    const entryWorld = buildWalkWorld(buildGameViewModel(entered, {}));
    assert.equal(entryWorld.theme, DUNGEON_WORLD_THEMES[dungeonId]);
    assert.equal(entryWorld.rooms.length, 1);

    for (const node of DUNGEONS[dungeonId].nodes) {
      const located = locateNodeForProjection(entered, node.id);
      const view = buildGameViewModel(located, {});
      const detail = view.sections[1].detail;
      const before = JSON.stringify(view);
      assert.equal(detail.kind, 'explore');
      assert.equal(detail.currentNode.nodeId, node.id);
      assert.equal(detail.currentNode.nodeType, node.type);
      assert.equal(detail.currentNode.monsterId, node.monsterId,
        `${dungeonId}/${node.id}: public identity must come directly from the core node`);
      if (node.type === 'monster') {
        assert.ok(MONSTERS[node.monsterId]);
        nodeMonsterIdsCovered.add(node.monsterId);
        if (node.id !== node.monsterId) aliasMonsterNodesCovered.set(`${dungeonId}/${node.id}`, node.monsterId);
        const clearedMonsterView = buildGameViewModel(locateNodeForProjection(entered, node.id, {
          clearedNodeIds: [node.id],
        }), {});
        requireNoMonsterVisual(buildWalkWorld(clearedMonsterView), clearedMonsterView,
          `${dungeonId}/${node.id}: cleared monster node`);
        realMonsterNodesCovered += 1;
      }
      const world = buildWalkWorld(view);
      const target = world.targets.find((entry) => entry.id === `node:${node.id}`);
      assert.ok(target, `${dungeonId}/${node.id}: current node needs an interactable object`);
      assert.equal(world.theme.id, dungeonId);
      assert.equal(world.key, `explore:${dungeonId}:${node.id}`);
      assert.deepEqual([world.width, world.height, world.spawn.x, world.spawn.y], [1000, 1000, 500, 700],
        `${dungeonId}/${node.id}: fixed projection does not resize the logical world or move its spawn`);
      assert.deepEqual(world.obstacles, EXPLORE_PERIMETER, `${dungeonId}/${node.id}: only interior debris is removed`);
      assert.deepEqual([target.x, target.y, target.radius], [500, 400, 115],
        `${dungeonId}/${node.id}: the current interaction keeps its original feet and range`);
      assert.equal(world.rooms.length, 1);
      assert.equal(world.rooms[0].label, node.title);
      assert.equal(target.label, detail.pending?.title ?? node.title);
      assert.equal(target.kind, detail.pending ? pendingKinds[detail.pending.kind] : originalKinds[node.type]);
      assert.ok(target.interactionLabel, `${dungeonId}/${node.id}: interaction has a readable verb`);
      kindsCovered.add(node.type);
      if (detail.pending) {
        assert.equal(target.action, undefined, `${node.id}: pending must open a choice sheet`);
        if (!pendingFixtures.has(detail.pending.kind)) pendingFixtures.set(detail.pending.kind, view);
      }
      if (target.kind === 'monster') {
        const rank = node.id === getBossDefinition(dungeonId).nodeId ? 'boss'
          : node.monsterId === DUNGEON_ELITE_MONSTERS[dungeonId] ? 'elite' : 'normal';
        assert.equal(target.rank, rank, `${node.id}: boss, elite and ordinary enemies are distinguishable`);
        ranksCovered.add(rank);
        requireMonsterVisual(world, view, node.monsterId, `${dungeonId}/${node.id}`);
        visibleMonsterIdsCovered.add(node.monsterId);

        // Location is a rendering fixture; encounter entry still uses the original public
        // command and reducer. Boss gates are handled by the dedicated chapter path below.
        if (rank !== 'boss' && !combatMonsterIdsCovered.has(node.monsterId)) {
          const start = view.sections[2].actions.find((action) => action.actionId === `node.select:${node.id}`);
          assert.ok(start?.enabled && start.event?.kind === 'command',
            `${dungeonId}/${node.id}: real encounter action`);
          const fighting = commit(located, start.event.command);
          assert.equal(fighting.phase, 'combat');
          const fightingView = buildGameViewModel(fighting, {});
          assert.equal(fightingView.sections[1].detail.enemy.id, node.monsterId,
            `${node.id}: the encounter command preserves the exploration identity`);
          requireMonsterVisual(buildWalkWorld(fightingView), fightingView, node.monsterId,
            `${dungeonId}/${node.id}: combat`);
          combatMonsterIdsCovered.add(node.monsterId);
        }
      } else requireNoMonsterVisual(world, view, `${dungeonId}/${node.id}`);
      requireOriginalActions(world, view);
      requireFourRoomDirections(world, view, `${dungeonId}/${node.id}`);
      // Revealing and clearing the catalog is only a projection fixture. The real
      // ViewModel still decides whether each original neighbor command is legal.
      const knownView = buildGameViewModel(locateNodeForProjection(entered, node.id, {
        clearedNodeIds: DUNGEONS[dungeonId].nodes.map((entry) => entry.id),
        discoveredNodeIds: DUNGEONS[dungeonId].nodes.map((entry) => entry.id),
      }), {});
      const knownWorld = buildWalkWorld(knownView);
      requireFourRoomDirections(knownWorld, knownView, `${dungeonId}/${node.id}: revealed neighbors`);
      requireOriginalActions(knownWorld, knownView);
      originalNeighborBindingsCovered += knownWorld.targets.filter((entry) => entry.id.startsWith('door:')).length;
      for (const hidden of detail.map.nodes.filter((entry) => entry.state === 'fogged')) {
        assert.equal(hidden.nodeId, undefined);
        const hiddenNode = DUNGEONS[dungeonId].nodes.find((entry) =>
          entry.position.x === hidden.x && entry.position.y === hidden.y);
        assert.ok(hiddenNode);
        assert.ok(!world.targets.some((entry) => entry.destinationNodeId === hiddenNode.id));
        // Some chapters intentionally reuse a title for visible and hidden rooms.
        const titleAlreadyPublic = detail.map.nodes.some((entry) =>
          entry.state !== 'fogged' && entry.title === hiddenNode.title);
        if (!titleAlreadyPublic && detail.pending?.title !== hiddenNode.title) {
          assert.ok(!world.targets.some((entry) => entry.label === hiddenNode.title));
        }
      }
      assert.equal(nearestWalkTarget(world, target), target);
      assert.ok(stepWalkPosition(world, world.spawn, { x: 0, y: -1 }, 0.1).y < world.spawn.y);
      assert.ok(stepWalkPosition(world, world.spawn, { x: 0, y: 1 }, 0.1).y > world.spawn.y);
      assert.equal(JSON.stringify(view), before, 'world projection and walking must not mutate the public model');
      realNodesCovered += 1;
    }

    // The test location is synthetic; starting combat still uses the real public action
    // and reducer. These checks validate arena projection, not victory over this boss.
    const boss = getBossDefinition(dungeonId);
    let bossFixture = locateNodeForProjection(entered, boss.nodeId);
    if (dungeonId === 'panopticon_city') {
      const blocked = reduceGameCommand(bossFixture, { type: 'run/select-node', nodeId: boss.nodeId });
      assert.equal(blocked.status, 'rejected', 'teleporting the test fixture must not bypass the domain boss gate');
      assert.ok(blocked.reason.message.includes('三座盲区中继'));
      // Rendering-only ready-state fixture: this does not claim those relays were played.
      const lawState = bossFixture.run.lawState;
      bossFixture = locateNodeForProjection(entered, boss.nodeId, {
        lawState: { ...lawState, law: {
          ...lawState.law,
          relays: Object.fromEntries(Object.keys(lawState.law.relays).map((id) => [id, true])),
          route: 'shadow',
        } },
      });
    }
    const bossView = buildGameViewModel(bossFixture, {});
    const bossMonsterId = bossView.sections[1].detail.currentNode.monsterId;
    if (bossView.sections[1].detail.pending) {
      requireNoMonsterVisual(buildWalkWorld(bossView), bossView, `${dungeonId}: pending before boss combat`);
    } else requireMonsterVisual(buildWalkWorld(bossView), bossView, bossMonsterId, `${dungeonId}: before boss combat`);
    const start = bossView.sections[2].actions.find((action) => action.actionId === `node.select:${boss.nodeId}`);
    assert.ok(start?.enabled && start.event?.kind === 'command', `${dungeonId}: real boss encounter action`);
    const fighting = commit(bossFixture, start.event.command);
    assert.equal(fighting.phase, 'combat');
    const arenaView = buildGameViewModel(fighting, {});
    const arena = buildWalkWorld(arenaView);
    assert.equal(arena.theme, entryWorld.theme);
    assert.equal(arena.targets[0].kind, 'monster');
    assert.equal(arena.targets[0].rank, 'boss');
    assert.equal(arena.targets[0].label, arenaView.sections[1].detail.enemy.name);
    assert.equal(arenaView.sections[1].detail.enemy.id, bossMonsterId,
      `${dungeonId}: the boss command preserves the exploration identity`);
    requireMonsterVisual(arena, arenaView, bossMonsterId, `${dungeonId}: boss combat`);
    combatMonsterIdsCovered.add(bossMonsterId);
    requireOriginalActions(arena, arenaView);
    assert.deepEqual([arena.width, arena.height, arena.spawn.x, arena.spawn.y], [1280, 1000, 440, 700]);
    assert.deepEqual([arena.targets[0].x, arena.targets[0].y, arena.targets[0].radius], [820, 340, 115]);
    assert.equal(arena.key, `combat:${dungeonId}:${bossMonsterId}`, 'the original combat key preserves live arena position');
    assert.deepEqual(arena.obstacles, COMBAT_PERIMETER);
    requireClosedCombatDirections(arena, `${dungeonId}: boss arena`);
    combatChaptersCovered += 1;
  });
}

check('chapter coverage includes all 570 real nodes, all five node kinds and all enemy ranks', () => {
  assert.equal(realNodesCovered, 570);
  assert.equal(realMonsterNodesCovered, 130);
  assert.equal(combatChaptersCovered, 19);
  assert.ok(originalNeighborBindingsCovered > realNodesCovered, 'real neighbor bindings are checked across every chapter and cell');
  assert.deepEqual([...kindsCovered].sort(), Object.keys(originalKinds).sort());
  assert.deepEqual([...ranksCovered].sort(), ['boss', 'elite', 'normal']);
});

check('all 59 catalog monsters keep their real identity from public node models into combat', () => {
  const catalogIds = Object.keys(MONSTERS).sort();
  assert.equal(catalogIds.length, 59);
  assert.deepEqual([...nodeMonsterIdsCovered].sort(), catalogIds,
    'every catalog monster is covered by a real dungeon-node public model');
  assert.deepEqual([...combatMonsterIdsCovered].sort(), catalogIds,
    'every catalog monster enters combat through its original public command');
  for (const [nodeKey, monsterId] of [
    ['demon_tower_1/upper_fog_patrol', 'fog_lesser_demon'],
    ['demon_tower_1/bone_lane_monster', 'tower_butcher'],
    ['ash_arena/cinder_lancer', 'ash_duelist'],
    ['lost_shelter/north_rescue_patrol', 'rogue_sentry'],
    ['panopticon_city/sweep_sentinel_north', 'phase_hunter_drone'],
  ]) {
    assert.equal(aliasMonsterNodesCovered.get(nodeKey), monsterId,
      `${nodeKey}: a node alias must not be interpreted as a monster ID`);
  }
});

check('missing monster identity and non-monster node types cannot infer world art from node names', () => {
  const detail = exploreView.sections[1].detail;
  const missingIdentity = withDetail(exploreView, {
    ...detail, currentNode: { ...detail.currentNode, nodeId: 'tower_butcher', monsterId: undefined },
  });
  requireNoMonsterVisual(buildWalkWorld(missingIdentity), missingIdentity, 'missing public monster identity');
  for (const nodeType of Object.keys(originalKinds).filter((kind) => kind !== 'monster')) {
    const nonMonster = withDetail(exploreView, {
      ...detail, currentNode: { ...detail.currentNode, nodeType },
    });
    requireNoMonsterVisual(buildWalkWorld(nonMonster), nonMonster, `${nodeType}: retained identity is not visibility`);
  }
});

check('a cleared node retains its original soul-recharge action and can open the real pending choice', () => {
  const entered = enteredChapters.get('demon_tower_1');
  const shrineFixture = locateNodeForProjection(entered, 'upper_fog_patrol', {
    clearedNodeIds: ['upper_fog_patrol'],
    soulSkillState: {
      rulesVersion: 1, frozenSkillIds: ['mist_fixed_point'], readySkillIds: [],
      chargesRemaining: 0, usedRechargeIds: [],
    },
  });
  const view = buildGameViewModel(shrineFixture, {});
  const world = buildWalkWorld(view);
  const shrine = world.targets.find((target) => target.id === 'node:upper_fog_patrol');
  requireNoMonsterVisual(world, view, 'cleared monster with an active soul shrine');
  const activation = view.sections[2].actions.find((action) => action.actionId === 'soul-recharge.activate:soul_node_demon_mist_watch');
  assert.ok(shrine, 'clearing a room must not remove its usable shrine');
  assert.equal(shrine.kind, 'shrine');
  assert.equal(shrine.action, activation);
  assert.equal(shrine.action.event.command.type, 'node/activate-soul-recharge');
  const activated = commit(shrineFixture, shrine.action.event.command);
  const pendingView = buildGameViewModel(activated, {});
  assert.equal(pendingView.sections[1].detail.pending.kind, 'soul-recharge');
  pendingFixtures.set('soul-recharge', pendingView);
  const pendingWorld = buildWalkWorld(pendingView);
  requireNoMonsterVisual(pendingWorld, pendingView, 'pending soul recharge on a monster node');
  assert.equal(pendingWorld.key, world.key, 'activation preserves local walking position');
  assert.equal(pendingWorld.targets.find((target) => target.id === shrine.id).action, undefined);

  const readyFixture = locateNodeForProjection(entered, 'upper_fog_patrol', {
    clearedNodeIds: ['upper_fog_patrol'],
    soulSkillState: { ...shrineFixture.run.soulSkillState, readySkillIds: ['mist_fixed_point'], chargesRemaining: 1 },
  });
  const readyView = buildGameViewModel(readyFixture, {});
  const disabled = buildWalkWorld(readyView).targets.find((target) => target.id === shrine.id);
  assert.equal(disabled.kind, 'shrine');
  assert.equal(disabled.action.enabled, false);
  assert.equal(disabled.action.event, undefined);
  assert.equal(disabled.disabledReason, disabled.action.disabledReason);
  assert.ok(disabled.disabledReason, 'an unavailable shrine keeps the original explanation');
});

check('all six real pending projections stay explicit even when only one option remains', () => {
  const entered = enteredChapters.get('demon_tower_1');
  const equipmentFixture = locateNodeForProjection(entered, entered.run.currentNodeId, {
    pendingEquipmentOffer: { offerId: 'walk-world-test-only-offer', equipmentIds: ['mist_hood', 'spirit_robe'] },
  });
  pendingFixtures.set('equipment-offer', buildGameViewModel(equipmentFixture, {}));
  const relicFixture = locateNodeForProjection(entered, entered.run.currentNodeId, {
    relicState: {
      ...entered.run.relicState,
      pendingDraft: { draftId: 'walk-world-test-only-draft', nodeId: entered.run.currentNodeId, candidateIds: ['mist_edge', 'focus_prism'] },
    },
  });
  pendingFixtures.set('relic-draft', buildGameViewModel(relicFixture, {}));
  // Test-only checkpoint snapshot generates the real law choice projection. The relay
  // completion is an input fixture here; no route playthrough is claimed by this test.
  const panopticon = enteredChapters.get('panopticon_city');
  const lawState = panopticon.run.lawState;
  const lawFixture = locateNodeForProjection(panopticon, 'south_blind_relay', {
    clearedNodeIds: ['south_blind_relay'],
    lawState: { ...lawState, law: {
      ...lawState.law,
      relays: Object.fromEntries(Object.keys(lawState.law.relays).map((id) => [id, true])),
      pendingRouteNodeId: 'south_blind_relay',
      route: null,
    } },
  });
  pendingFixtures.set('law', buildGameViewModel(lawFixture, {}));
  assert.deepEqual([...pendingFixtures.keys()].sort(), Object.keys(pendingKinds).sort());
  for (const [pendingKind, view] of pendingFixtures) {
    const detail = view.sections[1].detail;
    assert.equal(detail.pending.kind, pendingKind);
    const world = buildWalkWorld(view);
    requireNoMonsterVisual(world, view, `${pendingKind}: pending choice`);
    const target = world.targets.find((entry) => entry.id === `node:${detail.currentNode.nodeId}`);
    assert.equal(target.kind, pendingKinds[pendingKind]);
    assert.equal(target.label, detail.pending.title);
    assert.equal(target.action, undefined);
    assert.ok(detail.pending.actionIds.length > 0, `${pendingKind}: detail retains real choices`);
    const firstId = detail.pending.actionIds[0];
    assert.ok(view.sections[2].actions.some((action) => action.actionId === firstId));
    const oneOption = withDetail(view, { ...detail, pending: { ...detail.pending, actionIds: [firstId] } });
    requireNoMonsterVisual(buildWalkWorld(oneOption), oneOption, `${pendingKind}: single pending choice`);
    assert.equal(buildWalkWorld(oneOption).targets.find((entry) => entry.id === target.id).action, undefined,
      `${pendingKind}: reducing choices does not authorize an automatic decision`);
  }
});

check('a locked chapter keeps the hub portal inspectable without enabling its entry request', () => {
  const lockedView = buildGameViewModel(initial, {
    entryDraft: { dungeonId: DUNGEON_ORDER[DUNGEON_ORDER.length - 1], protocolId: 'standard' },
  });
  const lockedConfirm = lockedView.sections[2].actions.find((action) => action.actionId === 'hub.entry.confirm');
  assert.equal(lockedConfirm.enabled, false);
  assert.ok(lockedConfirm.disabledReason);
  const world = buildWalkWorld(lockedView);
  const portal = world.targets.find((target) => target.id === 'portal:entry');
  assert.equal(portal.action, lockedConfirm);
  assert.equal(portal.action.event, undefined);
  assert.equal(portal.disabledReason, undefined, 'the portal itself must still open chapter selection');
  assert.equal(portal.interactionLabel, '进入');
  assert.equal(nearestWalkTarget(world, portal), portal);
});

check('doors carry their own route forecast and the pursuer art stays loaded for the hunt', () => {
  const entered = commit({ ...createInitialState(), completedDungeonIds: ['demon_tower_1'] }, {
    type: 'run/enter', dungeonId: 'demon_tower_1', protocolId: 'standard', seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_abcd },
  });
  const run = entered.run;
  const herb = { ...entered, run: { ...run, currentNodeId: 'mist_herb_cache', clearedNodeIds: ['mist_herb_cache'],
    pursuitState: { ...run.pursuitState, status: 'stalking', nodeId: 'sealed_cache' } } };
  const model = buildGameViewModel(herb, {});
  const detail = model.sections[1].detail;
  const doors = buildWalkWorld(model).targets.filter(target => target.id.startsWith('door:'));
  assert.equal(doors.length, 4, 'four real doorways');
  for (const door of doors) {
    const expected = detail.routeForecasts.find(forecast => `door:${forecast.cellId}` === door.id);
    assert.deepEqual(door.forecast, expected, `${door.id} carries the ViewModel forecast for its own cell`);
    assert.equal(door.forecast.nodeId, door.destinationNodeId, `${door.id} forecast matches its destination`);
  }
  assert.equal(doors.find(door => door.destinationNodeId === 'sealed_cache').forecast.threat.level, 'near', 'the pursuer is behind the containment door');
  assert.equal(getInfiniteFlowSceneVisualKeys(model).lurker, `monster:${DUNGEON_WORLD_THEMES.demon_tower_1.eliteMonsterId}_world`, 'silhouette art is declared while stalking');
  const firstRunState = commit(createInitialState(), {
    type: 'run/enter', dungeonId: 'demon_tower_1', protocolId: 'standard', seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_abcd },
  });
  assert.equal(getInfiniteFlowSceneVisualKeys(buildGameViewModel(firstRunState, {})).lurker, `monster:${DUNGEON_WORLD_THEMES.demon_tower_1.eliteMonsterId}_world`,
    'a lamp chapter meets its pursuer on the first clear, so the silhouette is declared up front');
  const disabled = { ...firstRunState, run: { ...firstRunState.run, pursuitState: { ...firstRunState.run.pursuitState, status: 'disabled' } } };
  assert.equal(getInfiniteFlowSceneVisualKeys(buildGameViewModel(disabled, {})).lurker, undefined, 'a disabled pursuer loads no silhouette');
});

check('route notices name what the last step changed', () => {
  const entered = commit({ ...createInitialState(), completedDungeonIds: ['demon_tower_1'] }, {
    type: 'run/enter', dungeonId: 'demon_tower_1', protocolId: 'standard', seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_abcd },
  });
  const explore = state => buildGameViewModel(state, {}).sections[1].detail;
  const patched = patch => explore({ ...entered, run: { ...entered.run, ...patch } });
  const lamp = oil => ({ lanternState: { rulesVersion: 1, dungeonId: 'demon_tower_1', oil } });
  const stalking = { ...entered.run.pursuitState, status: 'stalking', nodeId: 'tower_butcher_patrol' };
  const base = patched(lamp(5));
  assert.equal(describeRouteChange(base, base), undefined, 'nothing changed, nothing announced');
  assert.equal(describeRouteChange(base, patched({ ...lamp(0), pressureState: { rulesVersion: 1, clearedNodeCount: 0, breachForced: true } })),
    '灯油耗尽 · 压力直接进入破界');
  assert.equal(describeRouteChange(base, patched({ ...lamp(4), pursuitState: stalking })), '血阶监猎者醒了 · 你走一步它走一步');
  assert.equal(describeRouteChange(patched({ ...lamp(5), pursuitState: stalking }), patched({ ...lamp(2), pursuitState: { ...stalking, contacts: 1, graceMoves: 1 } })),
    '甩开了血阶监猎者 · 它退回巢穴，下一步不动');
  assert.equal(describeRouteChange(patched({ ...lamp(5), pursuitState: stalking }),
    patched({ ...lamp(2), pursuitState: { ...stalking, status: 'repelled', nodeId: null, contacts: 1, graceMoves: 0, repelledReason: 'defeated' } })),
    '击败了血阶监猎者 · 本局它不会再出现');
  assert.equal(describeRouteChange(base, patched({ ...lamp(5), pressureState: { rulesVersion: 1, clearedNodeCount: 6 } })), '压力进入追猎 · 怪物 +10%');
  assert.equal(describeRouteChange(base, patched(lamp(9))), '补给添灯 · 灯油 +4');
  assert.equal(describeRouteChange(patched({ ...lamp(0), pressureState: { rulesVersion: 1, clearedNodeCount: 3, breachForced: true } }),
    patched({ ...lamp(4), pressureState: { rulesVersion: 1, clearedNodeCount: 4 } })), '重新点灯 · 破界解除，压力回到稳定');
});

check('task notices follow the hidden task from discovery to its end', () => {
  const entered = commit(createInitialState(), {
    type: 'run/enter', dungeonId: 'demon_tower_1', protocolId: 'standard', seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_abcd },
  });
  const base = buildGameViewModel(entered, {}).sections[1].detail;
  const withContract = routeContract => ({ ...base, chapterDecision: { ...base.chapterDecision, routeContract } });
  const unfound = base.chapterDecision.routeContract;
  assert.equal(unfound.status, 'disabled', 'a fresh run has found no hidden task');
  assert.equal(describeTaskChange(base, base), undefined, 'nothing changed, nothing announced');
  const found = { ...unfound, status: 'active', name: '灰坑引刃', completedTargetCount: 0, completedReadout: '0 / 2',
    nextTarget: { order: 1, nodeId: 'ash_pit_trap', nodeTitle: '灰坑回声' }, potentialRewardPoints: 60 };
  assert.equal(describeTaskChange(withContract(unfound), withContract(found)), '发现隐藏任务「灰坑引刃」 · 先去灰坑回声');
  const halfway = { ...found, completedTargetCount: 1, completedReadout: '1 / 2', nextTarget: { order: 2, nodeId: 'loose_tile_trap', nodeTitle: '松砖机关' } };
  assert.equal(describeTaskChange(withContract(found), withContract(halfway)), '「灰坑引刃」 1/2 · 下一站松砖机关');
  assert.equal(describeTaskChange(withContract(halfway), withContract({ ...halfway, status: 'secured' })), '「灰坑引刃」完成 · 出口结算 +60');
  assert.equal(describeTaskChange(withContract(halfway), withContract({ ...halfway, status: 'failed' })), '「灰坑引刃」失败 · 走错了顺序');
});

console.log(`Walk world self-check passed (${checks} checks; ${enteredChapters.size} chapters, ${realNodesCovered} real-node projections, ${originalNeighborBindingsCovered} original neighbor bindings, ${nodeMonsterIdsCovered.size} catalog identities, ${visibleMonsterIdsCovered.size} visible exploration identities, ${combatMonsterIdsCovered.size} combat identities, ${combatChaptersCovered} boss arenas, ${pendingFixtures.size} pending kinds).`);
