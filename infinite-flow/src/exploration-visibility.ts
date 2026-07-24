import type { DungeonNode } from './game';

export type VisibilityState = 'explored' | 'frontier' | 'hidden';

export type VisibilityInput = {
  readonly currentNodeId: string;
  readonly clearedNodeIds: readonly string[];
  readonly nodes: readonly DungeonNode[];
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
  if (currentNode && isManhattanAdjacent(currentNode, node)) return 'frontier';

  return 'hidden';
}
