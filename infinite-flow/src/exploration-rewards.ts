export const EXPLORATION_REWARD_VERSION = 1 as const;
export const EXPLORATION_SUPPLY_INTERVAL = 3 as const;

export const EXPLORATION_SUPPLY_ROTATION = [
  'healing_pill',
  'armor_patch',
  'focus_incense'
] as const;

export type ExplorationSupplyItemId = typeof EXPLORATION_SUPPLY_ROTATION[number];
export type ExplorationRewardNodeType = 'monster' | 'trap' | 'portal' | 'reward' | 'exit';

export type ExplorationRewardDungeon = Readonly<{
  tier: number;
  nodes: readonly Readonly<{
    id: string;
    type: ExplorationRewardNodeType;
  }>[];
}>;

export type ExplorationRewardRun = Readonly<{
  entryFlowVersion?: 2;
  explorationRewardVersion?: number;
  clearedNodeIds: readonly string[];
}>;

export type ExplorationClearReward = Readonly<{
  rewardPoints: number;
  items: Readonly<Partial<Record<ExplorationSupplyItemId, number>>>;
  clearedNodeCount: number;
  supplyMilestone: number;
  supplyItemId?: ExplorationSupplyItemId;
}>;

export function usesCurrentExplorationRewardRules(
  run: Pick<ExplorationRewardRun, 'entryFlowVersion' | 'explorationRewardVersion'>
): boolean {
  return run.entryFlowVersion === 2 &&
    run.explorationRewardVersion === EXPLORATION_REWARD_VERSION;
}

const EMPTY_EXPLORATION_CLEAR_REWARD: ExplorationClearReward = Object.freeze({
  rewardPoints: 0,
  items: Object.freeze({}),
  clearedNodeCount: 0,
  supplyMilestone: 0
});

function getClearRewardPoints(nodeType: ExplorationRewardNodeType, dungeonTier: number): number {
  const safeTier = Math.max(1, Math.floor(dungeonTier));
  if (nodeType === 'trap') return 20 + safeTier * 10;
  if (nodeType === 'portal') return 15 + safeTier * 5;
  return 0;
}

export function getExplorationClearReward(
  run: ExplorationRewardRun,
  dungeon: ExplorationRewardDungeon,
  nodeId: string
): ExplorationClearReward {
  if (
    !usesCurrentExplorationRewardRules(run) ||
    run.clearedNodeIds.includes(nodeId)
  ) {
    return EMPTY_EXPLORATION_CLEAR_REWARD;
  }

  const node = dungeon.nodes.find((candidate) => candidate.id === nodeId);
  if (!node || node.type === 'exit') return EMPTY_EXPLORATION_CLEAR_REWARD;

  const nonExitNodeIds = new Set(
    run.clearedNodeIds.filter((clearedNodeId) =>
      dungeon.nodes.some(
        (candidate) => candidate.id === clearedNodeId && candidate.type !== 'exit'
      )
    )
  );
  nonExitNodeIds.add(nodeId);
  const clearedNodeCount = nonExitNodeIds.size;
  const supplyMilestone =
    clearedNodeCount % EXPLORATION_SUPPLY_INTERVAL === 0
      ? clearedNodeCount / EXPLORATION_SUPPLY_INTERVAL
      : 0;
  const supplyItemId =
    supplyMilestone > 0
      ? EXPLORATION_SUPPLY_ROTATION[
          (supplyMilestone - 1) % EXPLORATION_SUPPLY_ROTATION.length
        ]
      : undefined;

  return {
    rewardPoints: getClearRewardPoints(node.type, dungeon.tier),
    items: supplyItemId ? { [supplyItemId]: 1 } : {},
    clearedNodeCount,
    supplyMilestone,
    ...(supplyItemId === undefined ? {} : { supplyItemId })
  };
}
