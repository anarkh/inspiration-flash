import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../../', import.meta.url));
const bundle = await build({
  stdin: {
    contents: `
      export * from './cocos/assets/scripts/ui/walk-world.ts';
      export { createInitialState, DUNGEON_ORDER, DUNGEONS } from '@infinite-flow/core';
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
  buildWalkWorld, stepWalkPosition, nearestWalkTarget,
  createInitialState, reduceGameCommand, buildGameViewModel,
  DUNGEON_ORDER, DUNGEONS, getBossDefinition, DUNGEON_ELITE_MONSTERS, DUNGEON_WORLD_THEMES,
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

check('up, down, left and right are continuous and reversible', () => {
  const spec = emptyWorld();
  const start = spec.spawn;
  const up = walkFor(spec, start, { x: 0, y: -1 }, 1);
  const down = walkFor(spec, up, { x: 0, y: 1 }, 1);
  approximately(up.y, 280, 'up moves towards the top');
  approximately(down.y, start.y, 'down restores the original position');
  approximately(walkFor(spec, start, { x: -1, y: 0 }, 1).x, 280, 'left');
  approximately(walkFor(spec, start, { x: 1, y: 0 }, 1).x, 720, 'right');
  approximately(stepWalkPosition(spec, start, { x: 0, y: -1 }, 0.007).y, 498.46, 'no grid snapping');
});

check('diagonal walking has the same speed, with proportional joystick input', () => {
  const spec = emptyWorld();
  const start = spec.spawn;
  const diagonal = walkFor(spec, start, { x: 1, y: 1 }, 1);
  approximately(Math.hypot(diagonal.x - start.x, diagonal.y - start.y), 220, 'diagonal speed');
  approximately(diagonal.x, diagonal.y, 'diagonal axes');
  const half = walkFor(spec, start, { x: 0.5, y: 0 }, 1);
  approximately(half.x - start.x, 110, 'joystick magnitude');
});

check('frame stalls are clamped and zero or invalid time does not move', () => {
  const spec = emptyWorld();
  approximately(stepWalkPosition(spec, spec.spawn, { x: 1, y: 0 }, 10).x, 522, 'frame clamp');
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
  approximately(slid.y, 100 + 22 / Math.SQRT2, 'vertical sliding');
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

check('hub has seven people and exactly the original seeded entry request', () => {
  assert.deepEqual([hub.width, hub.height, hub.spawn.x, hub.spawn.y], [1280, 1150, 640, 820]);
  assert.equal(hub.targets.filter((target) => target.kind === 'npc').length, 7);
  const portal = hub.targets.find((target) => target.id === 'portal:entry');
  assert.equal(portal.action, confirm);
  assert.equal(portal.action.event.kind, 'local');
  assert.equal(portal.action.event.action.type, 'entry/request-enter');
  for (const npc of hub.targets.filter((target) => target.kind === 'npc')) {
    assert.equal(npc.action, hubView.sections[2].actions.find((action) => action.actionId === `hub.panel:${npc.id.slice(4)}`));
    assert.equal(npc.action.event.action.type, 'hub/select-panel');
  }
  const approach = walkFor(hub, hub.spawn, { x: 0, y: -1 }, 3);
  assert.equal(nearestWalkTarget(hub, approach), portal, 'the north portal is reachable on foot');
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
  assert.equal(monster.action, exploreView.sections[2].actions.find((action) => action.actionId === `node.select:${detail.currentNode.nodeId}`));
  const doors = explore.targets.filter((target) => target.kind === 'transition');
  assert.equal(doors.length, detail.map.nodes.filter((node) => node.isAdjacent).length);
  assert.ok(doors.every((door) => door.action === undefined && door.disabledReason));
  assert.equal(nearestWalkTarget(explore, walkFor(explore, explore.spawn, { x: 0, y: -1 }, 1.7)), monster);
});

state = commit(state, explore.targets.find((target) => target.kind === 'monster').action.event.command);
const combatView = buildGameViewModel(state, {});
check('combat is a separate walkable arena and preserves the attack command', () => {
  const arena = buildWalkWorld(combatView);
  assert.deepEqual([arena.width, arena.height, arena.spawn.x, arena.spawn.y], [1280, 1000, 440, 700]);
  assert.deepEqual([arena.targets[0].x, arena.targets[0].y], [820, 340]);
  assert.equal(arena.targets[0].action, combatView.sections[2].actions.find((action) => action.actionId === 'combat.action:attack'));
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
  for (const door of cleared.targets.filter((target) => target.kind === 'transition')) {
    const node = clearedView.sections[1].detail.map.nodes.find((entry) => entry.cellId === door.id.slice(5));
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
let realNodesCovered = 0;
let combatChaptersCovered = 0;

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
      const world = buildWalkWorld(view);
      const target = world.targets.find((entry) => entry.id === `node:${node.id}`);
      assert.ok(target, `${dungeonId}/${node.id}: current node needs an interactable object`);
      assert.equal(world.theme.id, dungeonId);
      assert.equal(world.key, `explore:${dungeonId}:${node.id}`);
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
      }
      requireOriginalActions(world, view);
      for (const door of world.targets.filter((entry) => entry.kind === 'transition')) {
        const mapNode = detail.map.nodes.find((entry) => `door:${entry.cellId}` === door.id);
        assert.ok(mapNode?.isAdjacent, `${node.id}: only physically adjacent entrances are instantiated`);
        if (door.action) {
          assert.equal(mapNode.canMove, true);
          assert.equal(door.action.actionId, mapNode.moveActionId);
          assert.deepEqual(door.action.event.command, { type: 'run/move', nodeId: mapNode.nodeId });
        } else assert.ok(door.disabledReason);
      }
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
    requireOriginalActions(arena, arenaView);
    combatChaptersCovered += 1;
  });
}

check('chapter coverage includes all 570 real nodes, all five node kinds and all enemy ranks', () => {
  assert.equal(realNodesCovered, 570);
  assert.equal(combatChaptersCovered, 19);
  assert.deepEqual([...kindsCovered].sort(), Object.keys(originalKinds).sort());
  assert.deepEqual([...ranksCovered].sort(), ['boss', 'elite', 'normal']);
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
    const target = world.targets.find((entry) => entry.id === `node:${detail.currentNode.nodeId}`);
    assert.equal(target.kind, pendingKinds[pendingKind]);
    assert.equal(target.label, detail.pending.title);
    assert.equal(target.action, undefined);
    assert.ok(detail.pending.actionIds.length > 0, `${pendingKind}: detail retains real choices`);
    const firstId = detail.pending.actionIds[0];
    assert.ok(view.sections[2].actions.some((action) => action.actionId === firstId));
    const oneOption = withDetail(view, { ...detail, pending: { ...detail.pending, actionIds: [firstId] } });
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
  assert.equal(portal.interactionLabel, '选副本');
  assert.equal(nearestWalkTarget(world, portal), portal);
});

console.log(`Walk world self-check passed (${checks} checks; ${enteredChapters.size} chapters, ${realNodesCovered} real-node projections, ${combatChaptersCovered} boss arenas, ${pendingFixtures.size} pending kinds).`);
