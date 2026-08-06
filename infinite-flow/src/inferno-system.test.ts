import { describe, expect, it } from 'vitest';
import { getBossDefinition } from './boss-system';
import { getDungeonRouteGates } from './dungeon-routes';
import { DUNGEONS, DUNGEON_ORDER } from './level-content';
import {
  applyInfernoMapSnapshot,
  areInfernoNodesConnected,
  createInfernoMapSnapshot,
  getInfernoConnectionIds,
  getInfernoTierModifiers,
  getInfernoUnlockedTier,
  isInfernoMapSnapshot,
  repairInfernoMapSnapshot,
  validateInfernoMapTopology,
  unlockNextInfernoTier
} from './inferno-system';

function isReachableWithoutConnection(
  connectionIdsByNodeId: Readonly<Record<string, readonly string[]>>,
  startNodeId: string,
  targetNodeId: string,
  blockedLeftNodeId: string,
  blockedRightNodeId: string
): boolean {
  const visited = new Set([startNodeId]);
  const queue = [startNodeId];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (nodeId === targetNodeId) return true;
    for (const adjacentNodeId of connectionIdsByNodeId[nodeId] ?? []) {
      const isBlockedConnection =
        (nodeId === blockedLeftNodeId && adjacentNodeId === blockedRightNodeId) ||
        (nodeId === blockedRightNodeId && adjacentNodeId === blockedLeftNodeId);
      if (isBlockedConnection || visited.has(adjacentNodeId)) continue;
      visited.add(adjacentNodeId);
      queue.push(adjacentNodeId);
    }
  }
  return false;
}

describe('inferno progression and procedural maps', () => {
  it('unlocks exactly one next layer and never declares a maximum layer', () => {
    const completed = ['demon_tower_1'] as const;
    expect(getInfernoUnlockedTier({}, 'demon_tower_1', completed)).toBe(1);
    const tierTwo = unlockNextInfernoTier({}, 'demon_tower_1', 1, completed);
    expect(getInfernoUnlockedTier(tierTwo, 'demon_tower_1', completed)).toBe(2);
    expect(unlockNextInfernoTier(tierTwo, 'demon_tower_1', 1, completed)).toEqual(tierTwo);
    expect(unlockNextInfernoTier(tierTwo, 'demon_tower_1', 25, completed)).toEqual(tierTwo);
    expect(getInfernoUnlockedTier(
      unlockNextInfernoTier(tierTwo, 'demon_tower_1', 2, completed),
      'demon_tower_1',
      completed
    )).toBe(3);
    expect(getInfernoTierModifiers(100_000).enemyStatMultiplierPercent)
      .toBeGreaterThan(getInfernoTierModifiers(10_000).enemyStatMultiplierPercent);
  });

  it('freezes a connected deterministic map for one seed and changes it for another', () => {
    const dungeon = DUNGEONS.demon_tower_1;
    const bossNodeId = getBossDefinition(dungeon.id).nodeId;
    const first = createInfernoMapSnapshot({
      dungeon,
      bossNodeId,
      priorityNodeIds: ['risky_font_trap', 'mist_herb_cache'],
      seed: 41
    });
    const restored = createInfernoMapSnapshot({
      dungeon,
      bossNodeId,
      priorityNodeIds: ['risky_font_trap', 'mist_herb_cache'],
      seed: 41
    });
    const next = createInfernoMapSnapshot({
      dungeon,
      bossNodeId,
      priorityNodeIds: ['risky_font_trap', 'mist_herb_cache'],
      seed: 42
    });

    expect(first).toEqual(restored);
    expect(next.nodes).not.toEqual(first.nodes);
    expect(isInfernoMapSnapshot(first, dungeon)).toBe(true);
    expect(applyInfernoMapSnapshot(dungeon, first).grid).toMatchObject({
      width: first.width,
      height: first.height
    });
  });

  it('stores explicit symmetric connections for procedural movement', () => {
    const dungeon = DUNGEONS.metro_abyss;
    const snapshot = createInfernoMapSnapshot({
      dungeon,
      bossNodeId: getBossDefinition(dungeon.id).nodeId,
      seed: 731
    });
    const start = snapshot.nodes.find((node) => node.nodeId === dungeon.grid.startNodeId);
    const target = start?.connectionIds[0];

    expect(target).toBeTruthy();
    expect(areInfernoNodesConnected(snapshot, start!.nodeId, target!)).toBe(true);
    expect(areInfernoNodesConnected(snapshot, target!, start!.nodeId)).toBe(true);
  });

  it('preserves every law boundary and the boss/exit boundary across all chapters and seeds', () => {
    for (const dungeonId of DUNGEON_ORDER) {
      const dungeon = DUNGEONS[dungeonId];
      const bossNodeId = getBossDefinition(dungeonId).nodeId;
      const exitNodeId = dungeon.nodes.find((node) => node.type === 'exit')?.id;
      if (!exitNodeId) throw new Error(`Missing exit for ${dungeonId}`);
      const bossSourceNodeIds = getDungeonRouteGates(dungeonId)
        .filter((gate) => gate.toNodeId === bossNodeId)
        .map((gate) => gate.fromNodeId);

      for (const seed of [1, 4, 11, 41, 731]) {
        const snapshot = createInfernoMapSnapshot({ dungeon, bossNodeId, seed });
        const connections = getInfernoConnectionIds(snapshot)!;
        expect(
          validateInfernoMapTopology(snapshot, dungeon, bossNodeId),
          `${dungeonId}:${seed}`
        ).toEqual({ valid: true, errors: [] });
        expect(
          new Set(connections[bossNodeId]),
          `${dungeonId}:${seed}:boss`
        ).toEqual(new Set([...bossSourceNodeIds, exitNodeId]));
        expect(connections[exitNodeId], `${dungeonId}:${seed}:exit`).toEqual([bossNodeId]);

        for (const gate of getDungeonRouteGates(dungeonId)) {
          if (
            gate.fromNodeId === bossNodeId ||
            gate.toNodeId === bossNodeId ||
            gate.fromNodeId === exitNodeId ||
            gate.toNodeId === exitNodeId
          ) {
            continue;
          }
          expect(
            connections[gate.fromNodeId]?.includes(gate.toNodeId),
            `${dungeonId}:${seed}:${gate.id}`
          ).toBe(true);
        }
      }
    }
  });

  it('keeps the Metro calibration route reachable when the seed-11 flood gate is closed', () => {
    const dungeon = DUNGEONS.metro_abyss;
    const snapshot = createInfernoMapSnapshot({
      dungeon,
      bossNodeId: getBossDefinition(dungeon.id).nodeId,
      seed: 11
    });
    const connections = getInfernoConnectionIds(snapshot)!;

    expect(isReachableWithoutConnection(
      connections,
      'coin_turnstile',
      'signal_cache',
      'coin_turnstile',
      'north_floodgate_trap'
    )).toBe(true);
  });

  it('repairs unsafe legacy topology once while preserving the snapshot seed and schema', () => {
    const dungeon = DUNGEONS.demon_tower_1;
    const bossNodeId = getBossDefinition(dungeon.id).nodeId;
    const safe = createInfernoMapSnapshot({ dungeon, bossNodeId, seed: 41 });
    const bossSources = new Set(
      getDungeonRouteGates(dungeon.id)
        .filter((gate) => gate.toNodeId === bossNodeId)
        .map((gate) => gate.fromNodeId)
    );
    const bypassNodeId = dungeon.nodes.find((node) =>
      node.id !== bossNodeId &&
      node.type !== 'exit' &&
      !bossSources.has(node.id)
    )?.id;
    if (!bypassNodeId) throw new Error('Missing legacy bypass node');
    const unsafe = {
      ...safe,
      nodes: safe.nodes.map((node) => node.nodeId === bossNodeId
        ? { ...node, connectionIds: [...new Set([...node.connectionIds, bypassNodeId])].sort() }
        : node.nodeId === bypassNodeId
          ? { ...node, connectionIds: [...new Set([...node.connectionIds, bossNodeId])].sort() }
          : node)
    };

    expect(isInfernoMapSnapshot(unsafe, dungeon)).toBe(true);
    expect(validateInfernoMapTopology(unsafe, dungeon, bossNodeId).valid).toBe(false);
    expect(repairInfernoMapSnapshot(safe, { dungeon, bossNodeId })).toBe(safe);

    const repaired = repairInfernoMapSnapshot(unsafe, { dungeon, bossNodeId });
    expect(repaired.seed).toBe(unsafe.seed);
    expect(repaired.rulesVersion).toBe(unsafe.rulesVersion);
    expect(validateInfernoMapTopology(repaired, dungeon, bossNodeId).valid).toBe(true);
    expect(repairInfernoMapSnapshot(repaired, { dungeon, bossNodeId })).toBe(repaired);
  });
});
