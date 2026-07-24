import type { DungeonDefinition, DungeonId } from './game';
import { DUNGEONS, DUNGEON_ORDER } from './level-content';

export type CampaignGateStatus = 'available' | 'locked' | 'completed';
export type CampaignAvailabilityKind = 'normal' | 'sequence_break';

export type CampaignProgressInput = {
  completedDungeonIds: readonly DungeonId[];
  playerPower: number;
  unlockedDungeonIds?: readonly DungeonId[];
  mainlineRequirementText?: Partial<Record<DungeonId, string>>;
  dungeonOrder?: readonly DungeonId[];
  dungeons?: Record<DungeonId, DungeonDefinition>;
};

export type CampaignDungeonGate = {
  dungeonId: DungeonId;
  dungeonName: string;
  status: CampaignGateStatus;
  availabilityKind?: CampaignAvailabilityKind;
  requirementText: string;
  recommendedGap: number;
  isNextRecommended: boolean;
};

function getRecommendedGap(playerPower: number, dungeon: DungeonDefinition): number {
  return Math.max(0, dungeon.recommendedPower - playerPower);
}

function getPowerText(playerPower: number, dungeon: DungeonDefinition): string {
  const gap = getRecommendedGap(playerPower, dungeon);

  if (gap === 0) {
    return `当前战力 ${playerPower} 已达到推荐 ${dungeon.recommendedPower}`;
  }

  return `当前战力 ${playerPower}，距离推荐 ${dungeon.recommendedPower} 还差 ${gap}`;
}

export function getCampaignProgress(input: CampaignProgressInput): CampaignDungeonGate[] {
  const dungeonOrder = input.dungeonOrder ?? DUNGEON_ORDER;
  const dungeons = input.dungeons ?? DUNGEONS;
  const completedDungeonIds = new Set(input.completedDungeonIds);
  const unlockedDungeonIds = new Set<DungeonId>([dungeonOrder[0], ...(input.unlockedDungeonIds ?? [])]);
  const normallyUnlockedDungeonIds = new Set<DungeonId>();

  for (const dungeonId of dungeonOrder) {
    if (!unlockedDungeonIds.has(dungeonId)) break;
    normallyUnlockedDungeonIds.add(dungeonId);
  }

  const nextRecommendedDungeonId = dungeonOrder.find(
    (dungeonId) =>
      !completedDungeonIds.has(dungeonId) && normallyUnlockedDungeonIds.has(dungeonId)
  );

  return dungeonOrder.map((dungeonId, index) => {
    const dungeon = dungeons[dungeonId];
    const recommendedGap = getRecommendedGap(input.playerPower, dungeon);

    if (completedDungeonIds.has(dungeonId)) {
      return {
        dungeonId,
        dungeonName: dungeon.name,
        status: 'completed',
        requirementText: `已完成 ${dungeon.name}`,
        recommendedGap,
        isNextRecommended: false
      };
    }

    const previousDungeonId = dungeonOrder[index - 1];
    const isUnlockedByMainline = normallyUnlockedDungeonIds.has(dungeonId);
    const isNextRecommended = dungeonId === nextRecommendedDungeonId;

    if (isUnlockedByMainline) {
      return {
        dungeonId,
        dungeonName: dungeon.name,
        status: 'available',
        availabilityKind: 'normal',
        requirementText: `${dungeon.name} 已解锁。${getPowerText(input.playerPower, dungeon)}`,
        recommendedGap,
        isNextRecommended
      };
    }

    const previousDungeon = dungeons[previousDungeonId];
    const mainlineRequirement = input.mainlineRequirementText?.[dungeonId] ?? `需要先推进 ${previousDungeon.name} 的主线任务`;
    const requirementText = mainlineRequirement.endsWith('。') ? mainlineRequirement : `${mainlineRequirement}。`;

    return {
      dungeonId,
      dungeonName: dungeon.name,
      status: 'locked',
      requirementText: `${requirementText}${getPowerText(input.playerPower, dungeon)}`,
      recommendedGap,
      isNextRecommended: false
    };
  });
}

export function getNextDungeonRecommendation(input: CampaignProgressInput): CampaignDungeonGate | undefined {
  return getCampaignProgress(input).find((gate) => gate.isNextRecommended);
}
