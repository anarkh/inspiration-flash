import { reduceGameCommand } from '@infinite-flow/application';
import { createInitialState, DUNGEON_ORDER, getCurrentDungeonDefinition, type GameState } from '@infinite-flow/core';
import { buildGameViewModel } from '../src/index.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const edgeKey = (left: string, right: string): string => [left, right].sort().join('|');
let checkedMaps = 0;
let sawNonGridTopology = false;
for (const dungeonId of ['demon_tower_1', 'temporal_observatory', 'panopticon_city'] as const) {
  for (const protocolId of ['standard', 'deep'] as const) {
    const result = reduceGameCommand({ ...createInitialState(), completedDungeonIds: [...DUNGEON_ORDER] }, {
      type: 'run/enter', dungeonId, protocolId,
      ...(protocolId === 'deep' ? { infernoTier: 1 } : {}),
      seeds: {
        rulesVersion: 1, hiddenTaskSeed: 0x1234_5678,
        ...(protocolId === 'deep' ? { infernoMapSeed: 0x2345_6789 } : {}),
      },
    });
    assert(result.status === 'committed' && result.state.run, `${dungeonId}/${protocolId}: entry commits`);
    const entered = result.state;
    const dungeon = getCurrentDungeonDefinition(entered);
    assert(dungeon, 'entry exposes its actual dungeon definition');
    for (const allKnown of [false, true]) {
      const state: GameState = allKnown ? {
        ...entered,
        run: { ...entered.run!, discoveredNodeIds: dungeon.nodes.map(node => node.id) },
      } : entered;
      const before = JSON.stringify(state);
      const detail = buildGameViewModel(state, {}).sections[1].detail;
      assert(detail.kind === 'explore', 'map projection requires explore');
      assert(JSON.stringify(state) === before, 'map projection does not change run state');
      const map = detail.map;
      const nodesByCell = new Map(map.nodes.map(node => [node.cellId, node]));
      const seen = new Set<string>();
      const exportedDomainEdges = new Set<string>();
      for (const [leftId, rightId] of map.knownEdges) {
        const left = nodesByCell.get(leftId), right = nodesByCell.get(rightId);
        assert(left?.nodeId && right?.nodeId, 'edges never reveal unknown endpoints');
        assert(left.state !== 'fogged' && right.state !== 'fogged', 'both edge endpoints are visible');
        const key = edgeKey(leftId, rightId);
        assert(leftId !== rightId && !seen.has(key), 'connections have no self edges or duplicates');
        seen.add(key);
        exportedDomainEdges.add(edgeKey(left.nodeId, right.nodeId));
        if (protocolId === 'standard') {
          assert(Math.abs(left.x - right.x) + Math.abs(left.y - right.y) === 1, 'standard edges remain physical grid neighbors');
        }
      }
      if (protocolId === 'deep') {
        const snapshot = entered.run!.infernoMap;
        assert(snapshot, 'deep run retains its generated topology');
        const knownIds = new Set(map.nodes.flatMap(node => node.nodeId ? [node.nodeId] : []));
        const expected = new Set(snapshot.nodes.flatMap(node => !knownIds.has(node.nodeId) ? [] :
          node.connectionIds.filter(id => knownIds.has(id)).map(id => edgeKey(node.nodeId, id))));
        assert(expected.size === exportedDomainEdges.size && [...expected].every(key => exportedDomainEdges.has(key)),
          'deep graph exactly matches the known subset of persisted connectionIds');
        if (allKnown) {
          const gridEdgeCount = map.nodes.reduce((count, left, index) => count + map.nodes.slice(index + 1)
            .filter(right => Math.abs(left.x - right.x) + Math.abs(left.y - right.y) === 1).length, 0);
          sawNonGridTopology ||= gridEdgeCount !== expected.size;
        }
      } else if (allKnown) {
        assert(map.nodes.length === 30 && map.knownEdges.length === 49, 'complete standard map retains all 30 rooms and 49 connections');
      }
      const current = map.nodes.find(node => node.state === 'current');
      assert(current, 'current position remains present');
      const visibleNeighbors = new Set(map.knownEdges.flatMap(([left, right]) =>
        left === current.cellId ? [right] : right === current.cellId ? [left] : []));
      assert(map.nodes.every(node => node.isAdjacent === visibleNeighbors.has(node.cellId)),
        'current connections match physical adjacency even when a route is blocked');
      checkedMaps += 1;
    }
  }
}
assert(sawNonGridTopology, 'deep fixtures exercise a topology distinct from a fabricated grid');
assert(checkedMaps === 12, 'all standard/deep visibility cases were checked');
