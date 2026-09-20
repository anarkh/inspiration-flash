import type { DungeonNode } from './game';

export type VisibilityState = 'explored' | 'frontier' | 'discovered' | 'hidden';

export type VisibilityInput = {
  readonly currentNodeId: string;
  readonly clearedNodeIds: readonly string[];
  readonly discoveredNodeIds?: readonly string[];
  readonly nodes: readonly DungeonNode[];
  readonly connectionIdsByNodeId?: Readonly<Record<string, readonly string[]>>;
};

function isManhattanAdjacent(a: DungeonNode, b: DungeonNode): boolean {
  const dx = Math.abs(a.position.x - b.position.x);
  const dy = Math.abs(a.position.y - b.position.y);
  return dx + dy === 1;
}

export function getNodeVisibility(
  node: DungeonNode,
  input: VisibilityInput
): VisibilityState {
  if (node.id === input.currentNodeId) return 'explored';
  if (input.clearedNodeIds.includes(node.id)) return 'explored';

  const currentNode = input.nodes.find((candidate) => candidate.id === input.currentNodeId);
  const explicitConnections = input.connectionIdsByNodeId?.[input.currentNodeId];
  if (
    currentNode &&
    (
      explicitConnections
        ? explicitConnections.includes(node.id)
        : isManhattanAdjacent(currentNode, node)
    )
  ) {
    return 'frontier';
  }

  if (input.discoveredNodeIds?.includes(node.id)) return 'discovered';

  return 'hidden';
}
