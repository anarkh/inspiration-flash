import {
  createInitialState, DUNGEON_ORDER, DUNGEONS, getCurrentLegalAdjacentTargetIds, getCurrentRouteBlockReason, type GameState
} from '@infinite-flow/core';
import { getBossDefinition } from '@infinite-flow/core/boss-system';
import {
  createInfernoMapSnapshot, getInfernoBossSideSourceNodeIds, validateInfernoMapTopology
} from '@infinite-flow/core/inferno-system';
import { reduceGameCommand, type GameCommand } from '../src/index.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// The side approaches are the boss's neighbours on the standard map that have no law gate into it.
assert(JSON.stringify(getInfernoBossSideSourceNodeIds(DUNGEONS.demon_tower_1, 'bone_lane_monster')) === '["butcher_turn","unstable_floor_trap"]',
  'chapter 1: the butcher turn and the unstable floor reach the boss without the fog gate, as on the standard map');
assert(getInfernoBossSideSourceNodeIds(DUNGEONS.mirror_cycle_city, 'nameless_reflection').length === 0,
  'chapter 11 has no side approach on the standard map, so none on the inferno map either');

// Every chapter's inferno maps connect the side approaches, and the maps stay valid.
for (const dungeonId of DUNGEON_ORDER) {
  const bossNodeId = getBossDefinition(dungeonId).nodeId;
  const side = getInfernoBossSideSourceNodeIds(DUNGEONS[dungeonId], bossNodeId);
  for (const seed of [1, 77, 4242]) {
    const map = createInfernoMapSnapshot({ dungeon: DUNGEONS[dungeonId], seed, bossNodeId });
    const bossLinks = map.nodes.find((node) => node.nodeId === bossNodeId)!.connectionIds;
    assert(side.every((nodeId) => bossLinks.includes(nodeId)), `${dungeonId} seed ${seed}: every side approach touches the boss`);
    // A map drawn before side approaches existed (law gates and exit only) still reads as valid.
    const legacy = {
      ...map,
      nodes: map.nodes.map((node) => node.nodeId === bossNodeId
        ? { ...node, connectionIds: node.connectionIds.filter((id) => !side.includes(id)) }
        : { ...node, connectionIds: node.connectionIds.filter((id) => id !== bossNodeId || !side.includes(node.nodeId)) })
    };
    assert(validateInfernoMapTopology(legacy, DUNGEONS[dungeonId], bossNodeId).valid, `${dungeonId} seed ${seed}: a pre-0.1.35 map stays valid`);
  }
}

// In a chapter-1 inferno run with the fog risen to 3 the fog gate (at most 1) is shut: the gate room cannot enter the
// boss, a side approach can.
const entered = reduceGameCommand({ ...createInitialState(), completedDungeonIds: ['demon_tower_1'] }, {
  type: 'run/enter', dungeonId: 'demon_tower_1', protocolId: 'deep', infernoTier: 1,
  seeds: { rulesVersion: 1, hiddenTaskSeed: 7, infernoMapSeed: 9 }
} as GameCommand);
assert(entered.status === 'committed', 'the inferno run starts');
const run = entered.state.run!;
const lawState = run.lawState as { law: Record<string, unknown> };
const standingOn = (nodeId: string): GameState => ({
  ...entered.state,
  run: {
    ...run,
    currentNodeId: nodeId,
    clearedNodeIds: [...run.clearedNodeIds, nodeId],
    lawState: { ...lawState, law: { ...lawState.law, fogPressure: 3 } }
  } as NonNullable<GameState['run']>
});
assert(getCurrentRouteBlockReason(standingOn('mist_herb_cache'), 'bone_lane_monster')?.includes('雾压'), 'the fog gate is shut');
assert(!getCurrentLegalAdjacentTargetIds(standingOn('mist_herb_cache')).includes('bone_lane_monster'), 'the gate room cannot enter the boss');
assert(getCurrentRouteBlockReason(standingOn('butcher_turn'), 'bone_lane_monster') === undefined
  && getCurrentLegalAdjacentTargetIds(standingOn('butcher_turn')).includes('bone_lane_monster'), 'the side approach enters the boss anyway');

// Walking in from the side approach and starting the fight both work with the gate still shut.
const moved = reduceGameCommand(standingOn('butcher_turn'), { type: 'run/move', nodeId: 'bone_lane_monster' });
assert(moved.status === 'committed' && moved.state.run!.currentNodeId === 'bone_lane_monster', 'the side approach walks into the boss room');
const fight = reduceGameCommand(moved.state, { type: 'run/select-node', nodeId: 'bone_lane_monster' });
assert(fight.status === 'committed' && fight.state.phase === 'combat', 'and the boss fight starts');
// A map drawn before side approaches existed keeps its old rule: with the gate shut the boss stays closed.
const legacyRun = moved.state.run!;
const legacyMap = {
  ...legacyRun.infernoMap!,
  nodes: legacyRun.infernoMap!.nodes.map((node) => ({
    ...node,
    connectionIds: node.connectionIds.filter((id) => !(
      (node.nodeId === 'bone_lane_monster' && ['butcher_turn', 'unstable_floor_trap'].includes(id))
      || (id === 'bone_lane_monster' && ['butcher_turn', 'unstable_floor_trap'].includes(node.nodeId))))
  }))
};
const legacyFight = reduceGameCommand({ ...moved.state, run: { ...legacyRun, infernoMap: legacyMap } }, { type: 'run/select-node', nodeId: 'bone_lane_monster' });
assert(legacyFight.status === 'rejected' && legacyFight.reason.message.includes('首领区域尚未开放'), 'an old map without side approaches still needs the gate');
