import { describe, expect, it } from 'vitest';
import {
  getNodeVisibility,
  type VisibilityInput
} from './exploration-visibility';
import type { DungeonNode } from './game';

function makeNode(id: string, x: number, y: number): DungeonNode {
  return {
    id,
    type: 'monster',
    title: id,
    description: id,
    position: { x, y }
  };
}

const NODES: readonly DungeonNode[] = [
  makeNode('current', 0, 0),
  makeNode('adjacent', 1, 0),
  makeNode('discovered_distant', 4, 4),
  makeNode('cleared_distant', 5, 5),
  makeNode('hidden_distant', 10, 10)
];

function buildInput(overrides: Partial<VisibilityInput> = {}): VisibilityInput {
  return {
    currentNodeId: 'current',
    clearedNodeIds: ['cleared_distant'],
    discoveredNodeIds: ['discovered_distant', 'adjacent'],
    nodes: NODES,
    ...overrides
  };
}

describe('exploration-visibility', () => {
  it('classifies the current node as explored', () => {
    const input = buildInput();
    const current = NODES.find((node) => node.id === 'current')!;
    expect(getNodeVisibility(current, input)).toBe('explored');
  });

  it('classifies a cleared distant node as explored', () => {
    const input = buildInput();
    const cleared = NODES.find((node) => node.id === 'cleared_distant')!;
    expect(getNodeVisibility(cleared, input)).toBe('explored');
  });

  it('classifies an uncleared adjacent node as frontier', () => {
    const input = buildInput();
    const adjacent = NODES.find((node) => node.id === 'adjacent')!;
    expect(getNodeVisibility(adjacent, input)).toBe('frontier');
  });

  it('keeps a previously discovered distant node visible without making it frontier', () => {
    const input = buildInput();
    const discovered = NODES.find((node) => node.id === 'discovered_distant')!;
    expect(getNodeVisibility(discovered, input)).toBe('discovered');
  });

  it('classifies a distant uncleared node as hidden', () => {
    const input = buildInput();
    const hidden = NODES.find((node) => node.id === 'hidden_distant')!;
    expect(getNodeVisibility(hidden, input)).toBe('hidden');
  });

  it('does not mutate the input nodes or cleared list', () => {
    const input = buildInput();
    const originalCleared = [...input.clearedNodeIds];
    const originalDiscovered = [...(input.discoveredNodeIds ?? [])];
    const originalPositions = input.nodes.map((node) => ({ ...node.position }));

    input.nodes.forEach((node) => getNodeVisibility(node, input));

    expect(input.clearedNodeIds).toEqual(originalCleared);
    expect(input.discoveredNodeIds).toEqual(originalDiscovered);
    input.nodes.forEach((node, index) => {
      expect(node.position).toEqual(originalPositions[index]);
    });
  });
});
