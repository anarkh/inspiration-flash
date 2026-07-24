import { DUNGEONS, DUNGEON_ORDER } from './level-content';
import {
  COMPANION_CATALOG,
  COMPANION_RULES_VERSION,
  getCompanionRecruitmentStatus,
  normalizeCompanionProgress
} from './companion-system';
import type { CompanionProgress } from './companion-system';
import {
  METHOD_CULTIVATION_RULES_VERSION,
  normalizeMethodCultivationProgress
} from './method-cultivation';
import { BLOODLINE_RULES_VERSION, normalizeBloodlineProgress } from './bloodline-system';
import type { DungeonId, GameState, RewardBundle } from './game';

export type MainGodTaskStatus = 'locked' | 'active' | 'completed' | 'claimed';
export type MainGodTaskKind = 'mainline' | 'side';

export type MainGodTask = {
  id: string;
  kind: MainGodTaskKind;
  chapterDungeonId: DungeonId;
  mainlineIndex?: number;
  title: string;
  description: string;
  hint: string;
  reward: RewardBundle;
  legacyClaimIds?: string[];
  isVisible?: (state: GameState) => boolean;
  isComplete: (state: GameState) => boolean;
  getProgressText: (state: GameState) => string;
};

export type MainGodTaskEvaluation = {
  task: MainGodTask;
  taskId: string;
  status: MainGodTaskStatus;
  completed: boolean;
  claimed: boolean;
  visible: boolean;
  progressText: string;
};

const LEGACY_MAINLINE_CLAIM_IDS: Partial<Record<DungeonId, string[]>> = {
  demon_tower_1: ['clear_demon_tower'],
  metro_abyss: ['clear_metro_abyss']
};

function hasCompletedDungeon(state: GameState, dungeonId: DungeonId): boolean {
  return state.completedDungeonIds.includes(dungeonId);
}

function hasEnteredOrCompletedDungeon(state: GameState, dungeonId: DungeonId): boolean {
  return state.run?.dungeonId === dungeonId || hasCompletedDungeon(state, dungeonId);
}

function getClaimedTaskIds(state: GameState): string[] {
  return state.claimedTaskIds ?? [];
}

function getDurableCompanionProgress(state: GameState): CompanionProgress {
  return normalizeCompanionProgress({
    rulesVersion: COMPANION_RULES_VERSION,
    owned: state.ownedCompanions,
    ranks: state.companionRanks,
    active: state.activeCompanion
  });
}

function hasRecruitableOrOwnedCompanion(state: GameState): boolean {
  const progress = getDurableCompanionProgress(state);
  return COMPANION_CATALOG.some(
    (companion) =>
      getCompanionRecruitmentStatus(companion.id, progress, state.completedDungeonIds) !== 'locked'
  );
}

function hasRecruitedCompanion(state: GameState): boolean {
  return getDurableCompanionProgress(state).owned.length > 0;
}

function getHighestCompanionRank(state: GameState): number {
  const progress = getDurableCompanionProgress(state);
  return progress.owned.reduce(
    (highestRank, companionId) => Math.max(highestRank, progress.ranks[companionId] ?? 0),
    0
  );
}

function getHighestMethodRank(state: GameState): number {
  const progress = normalizeMethodCultivationProgress(state.learnedMethods, {
    rulesVersion: METHOD_CULTIVATION_RULES_VERSION,
    ranks: state.methodRanks,
    activeMethod: state.activeMethod
  });
  return Object.values(progress.ranks).reduce<number>(
    (highestRank, rank) => Math.max(highestRank, rank ?? 0),
    0
  );
}

function getHighestBloodlineRank(state: GameState): number {
  const progress = normalizeBloodlineProgress({
    rulesVersion: BLOODLINE_RULES_VERSION,
    ranks: state.bloodlineRanks,
    active: state.activeBloodline
  });
  return Object.values(progress.ranks).reduce<number>(
    (highestRank, rank) => Math.max(highestRank, rank ?? 0),
    0
  );
}

export function isTaskRewardClaimed(state: GameState, task: MainGodTask): boolean {
  const claimedTaskIds = getClaimedTaskIds(state);
  return claimedTaskIds.includes(task.id) || Boolean(task.legacyClaimIds?.some((taskId) => claimedTaskIds.includes(taskId)));
}

function getMainlineTaskId(dungeonId: DungeonId): string {
  return `mainline_clear_${dungeonId}`;
}

function isMainlineChapterVisible(state: GameState, index: number): boolean {
  if (index === 0) return true;

  const previousDungeonId = DUNGEON_ORDER[index - 1];
  const previousTask = MAINLINE_TASKS.find((task) => task.chapterDungeonId === previousDungeonId);
  return previousTask ? isTaskRewardClaimed(state, previousTask) : false;
}

function isChapterUnlocked(state: GameState, dungeonId: DungeonId): boolean {
  return getUnlockedDungeonIdsFromMainline(state).includes(dungeonId);
}

function getDungeonEntryProgress(state: GameState, dungeonId: DungeonId): string {
  if (state.run?.dungeonId === dungeonId) return '1/1 当前正在探索';
  if (hasCompletedDungeon(state, dungeonId)) return '1/1 已完成副本';
  return '0/1 尚未踏入';
}

function getDungeonClearProgress(state: GameState, dungeonId: DungeonId): string {
  return hasCompletedDungeon(state, dungeonId) ? '1/1 首次通关完成' : '0/1 尚未首次通关';
}

function getDirectiveProgress(state: GameState, dungeonId: DungeonId): string {
  return state.claimedDirectiveIds.includes(`directive_${dungeonId}`) ? '1/1 指令奖励已结算' : '0/1 指令奖励未结算';
}

const COMBAT_REPLAY_STAGE_DUNGEON_ID = 'combat_replay_stage' as DungeonId;
const PANOPTICON_CITY_DUNGEON_ID = 'panopticon_city' as DungeonId;

function getCombatReplayTaskProgress(state: GameState): {
  completedTakeCount: number;
  routeSelected: boolean;
  bossRecorded: boolean;
} {
  const replay = state.run?.dungeonId === COMBAT_REPLAY_STAGE_DUNGEON_ID
    ? state.run.combatReplayState
    : undefined;
  const law = state.run?.dungeonId === COMBAT_REPLAY_STAGE_DUNGEON_ID
    ? state.run.lawState?.law
    : undefined;
  const replayTakeCount = replay ? Object.keys(replay.recordings).length : 0;
  const lawTakeCount = law?.kind === 'combat_replay_stage'
    ? law.takes.filter((take) => take !== null).length
    : 0;

  return {
    completedTakeCount: Math.max(replayTakeCount, lawTakeCount),
    routeSelected: replay?.route !== undefined || (law?.kind === 'combat_replay_stage' && law.route !== null),
    bossRecorded: law?.kind === 'combat_replay_stage' && law.bossSnapshot !== null
  };
}

function getPanopticonTaskProgress(state: GameState): {
  completedRelayCount: number;
  routeSelected: boolean;
  bossRecorded: boolean;
} {
  const law = state.run?.dungeonId === PANOPTICON_CITY_DUNGEON_ID
    ? state.run.lawState?.law
    : undefined;

  return {
    completedRelayCount: law?.kind === 'panopticon_city'
      ? Object.values(law.relays).filter(Boolean).length
      : 0,
    routeSelected: law?.kind === 'panopticon_city' && law.route !== null,
    bossRecorded: law?.kind === 'panopticon_city' && law.bossSnapshot !== null
  };
}

export const MAINLINE_TASKS: MainGodTask[] = DUNGEON_ORDER.map((dungeonId, index) => {
  const dungeon = DUNGEONS[dungeonId];

  return {
    id: getMainlineTaskId(dungeonId),
    kind: 'mainline',
    chapterDungeonId: dungeonId,
    mainlineIndex: index,
    title: `${dungeon.name}主线`,
    description: `完成${dungeon.name}首通，并在主神空间确认章节推进。`,
    hint: `首通${dungeon.name}后领取主线奖励，解锁下一章。`,
    reward: {
      rewardPoints: 80 + index * 10,
      lingyun: index > 0 && index % 2 === 0 ? 1 : 0
    },
    legacyClaimIds: LEGACY_MAINLINE_CLAIM_IDS[dungeonId],
    isVisible: (state) => isMainlineChapterVisible(state, index),
    isComplete: (state) => hasCompletedDungeon(state, dungeonId),
    getProgressText: (state) => getDungeonClearProgress(state, dungeonId)
  };
});

export const SIDE_TASKS: MainGodTask[] = DUNGEON_ORDER.flatMap((dungeonId) => {
  const dungeon = DUNGEONS[dungeonId];

  if (dungeonId === PANOPTICON_CITY_DUNGEON_ID) {
    return [
      {
        id: `side_enter_${dungeonId}`,
        kind: 'side',
        chapterDungeonId: dungeonId,
        title: `${dungeon.name}三盲中继`,
        description: `完成${dungeon.name}北、中、南三座盲区中继，为逃逸路线制造稳定断点。`,
        hint: '依次完成北、中、南三座盲区中继。',
        reward: { rewardPoints: 30 },
        isVisible: (state) => isChapterUnlocked(state, dungeonId),
        isComplete: (state) =>
          hasCompletedDungeon(state, dungeonId) ||
          getPanopticonTaskProgress(state).completedRelayCount === 3,
        getProgressText: (state) => {
          if (hasCompletedDungeon(state, dungeonId)) return '3/3 三座盲区中继已封闭';
          return `${getPanopticonTaskProgress(state).completedRelayCount}/3 已完成中继`;
        }
      },
      {
        id: `side_directive_${dungeonId}`,
        kind: 'side',
        chapterDungeonId: dungeonId,
        title: `${dungeon.name}盲晨突围`,
        description: `锁定${dungeon.name}的逃逸路线，并将全视快照冻结进监察官战。`,
        hint: '完成三座中继、选择逃逸路线并冻结首领快照。',
        reward: { rewardPoints: 40 },
        isVisible: (state) => isChapterUnlocked(state, dungeonId),
        isComplete: (state) => {
          if (hasCompletedDungeon(state, dungeonId)) return true;
          const progress = getPanopticonTaskProgress(state);
          return progress.routeSelected && progress.bossRecorded;
        },
        getProgressText: (state) => {
          if (hasCompletedDungeon(state, dungeonId)) return '2/2 路线与首领快照已封存';
          const progress = getPanopticonTaskProgress(state);
          return `${Number(progress.routeSelected) + Number(progress.bossRecorded)}/2 路线与首领快照`;
        }
      }
    ];
  }

  if (dungeonId === COMBAT_REPLAY_STAGE_DUNGEON_ID) {
    return [
      {
        id: `side_enter_${dungeonId}`,
        kind: 'side',
        chapterDungeonId: dungeonId,
        title: `${dungeon.name}三镜录制`,
        description: `完成${dungeon.name}的三段战斗录制，为路线复演建立完整母带。`,
        hint: '依次完成甲、乙、丙三段录制。',
        reward: { rewardPoints: 30 },
        isVisible: (state) => isChapterUnlocked(state, dungeonId),
        isComplete: (state) =>
          hasCompletedDungeon(state, dungeonId) ||
          getCombatReplayTaskProgress(state).completedTakeCount === 3,
        getProgressText: (state) => {
          if (hasCompletedDungeon(state, dungeonId)) return '3/3 三段录制已封存';
          return `${getCombatReplayTaskProgress(state).completedTakeCount}/3 已完成录制`;
        }
      },
      {
        id: `side_directive_${dungeonId}`,
        kind: 'side',
        chapterDungeonId: dungeonId,
        title: `${dungeon.name}终场复盘`,
        description: `锁定${dungeon.name}的复演路线，并将三段母带冻结进首领战。`,
        hint: '完成三段录制、选择复演路线并击败首领。',
        reward: { rewardPoints: 40 },
        isVisible: (state) => isChapterUnlocked(state, dungeonId),
        isComplete: (state) => {
          if (hasCompletedDungeon(state, dungeonId)) return true;
          const progress = getCombatReplayTaskProgress(state);
          return progress.routeSelected && progress.bossRecorded;
        },
        getProgressText: (state) => {
          if (hasCompletedDungeon(state, dungeonId)) return '2/2 路线与首领复演已封存';
          const progress = getCombatReplayTaskProgress(state);
          return `${Number(progress.routeSelected) + Number(progress.bossRecorded)}/2 路线与首领复演`;
        }
      }
    ];
  }

  return [
    {
      id: `side_enter_${dungeonId}`,
      kind: 'side',
      chapterDungeonId: dungeonId,
      title: `${dungeon.name}侦察`,
      description: `记录${dungeon.name}的入口情报，给后续路线留下锚点。`,
      hint: `进入${dungeon.name}，或完成本章首通。`,
      reward: { rewardPoints: 30 },
      isVisible: (state) => isChapterUnlocked(state, dungeonId),
      isComplete: (state) => hasEnteredOrCompletedDungeon(state, dungeonId),
      getProgressText: (state) => getDungeonEntryProgress(state, dungeonId)
    },
    {
      id: `side_directive_${dungeonId}`,
      kind: 'side',
      chapterDungeonId: dungeonId,
      title: `${dungeon.name}指令复盘`,
      description: `完成${dungeon.name}的主神指令结算，补足本章支线记录。`,
      hint: `首通${dungeon.name}时完成主神指令目标。`,
      reward: { rewardPoints: 40 },
      isVisible: (state) => isChapterUnlocked(state, dungeonId),
      isComplete: (state) => state.claimedDirectiveIds.includes(`directive_${dungeonId}`),
      getProgressText: (state) => getDirectiveProgress(state, dungeonId)
    }
  ];
});

export const GLOBAL_SIDE_TASKS: MainGodTask[] = [
  {
    id: 'side_recruit_first_companion',
    kind: 'side',
    chapterDungeonId: DUNGEON_ORDER[0],
    title: '并肩者',
    description: '完成首次同伴招募，让主神空间的队伍不再只有一个人。',
    hint: '完成同伴对应章节的首通后，在主神空间招募任意一名同伴。',
    reward: { rewardPoints: 120 },
    isVisible: hasRecruitableOrOwnedCompanion,
    isComplete: hasRecruitedCompanion,
    getProgressText: (state) => hasRecruitedCompanion(state) ? '1/1 已招募首位同伴' : '0/1 尚未招募同伴'
  },
  {
    id: 'side_train_companion_rank_2',
    kind: 'side',
    chapterDungeonId: DUNGEON_ORDER[0],
    title: '协同进阶',
    description: '任意一名同伴已完成首次训练，队伍协同能力得到强化。',
    hint: '将任意已招募同伴训练至位阶 2。',
    reward: { rewardPoints: 180, lingyun: 1 },
    isVisible: hasRecruitedCompanion,
    isComplete: (state) => getHighestCompanionRank(state) >= 2,
    getProgressText: (state) => `${Math.min(getHighestCompanionRank(state), 2)}/2 同伴最高位阶`
  },
  {
    id: 'side_refine_first_method_rank_2',
    kind: 'side',
    chapterDungeonId: DUNGEON_ORDER[0],
    title: '功法精研',
    description: '任意一门已学功法完成首次精研，掌握其进阶战技。',
    hint: '将任意已学功法精研至 R2。',
    reward: { rewardPoints: 120 },
    isVisible: (state) => state.learnedMethods.length > 0,
    isComplete: (state) => getHighestMethodRank(state) >= 2,
    getProgressText: (state) => `${Math.min(getHighestMethodRank(state), 2)}/2 功法最高阶位`
  },
  {
    id: 'side_master_first_method_rank_3',
    kind: 'side',
    chapterDungeonId: DUNGEON_ORDER[0],
    title: '功法大成',
    description: '任意一门功法臻至 R3，完整掌握其专属战技。',
    hint: '将任意已精研至 R2 的功法继续提升至 R3。',
    reward: { rewardPoints: 180, lingyun: 1 },
    isVisible: (state) => getHighestMethodRank(state) >= 2,
    isComplete: (state) => getHighestMethodRank(state) >= 3,
    getProgressText: (state) => `${Math.min(getHighestMethodRank(state), 3)}/3 功法最高阶位`
  },
  {
    id: 'side_unlock_first_bloodline',
    kind: 'side',
    chapterDungeonId: DUNGEON_ORDER[0],
    title: '血统初醒',
    description: '任意一条血统完成首次觉醒，原型力量开始回应你的意志。',
    hint: '在主神空间将任意血统解锁至 R1。',
    reward: { rewardPoints: 150 },
    isVisible: () => true,
    isComplete: (state) => getHighestBloodlineRank(state) >= 1,
    getProgressText: (state) => getHighestBloodlineRank(state) >= 1
      ? '1/1 已觉醒首条血统'
      : '0/1 尚未拥有血统'
  },
  {
    id: 'side_master_first_bloodline_rank_3',
    kind: 'side',
    chapterDungeonId: DUNGEON_ORDER[0],
    title: '祖型大成',
    description: '任意一条血统臻至 R3，完整唤醒其始祖形态。',
    hint: '将任意已觉醒至 R1 的血统继续提升至 R3。',
    reward: { rewardPoints: 250 },
    isVisible: (state) => getHighestBloodlineRank(state) >= 1,
    isComplete: (state) => getHighestBloodlineRank(state) >= 3,
    getProgressText: (state) => `${Math.min(getHighestBloodlineRank(state), 3)}/3 血统最高阶位`
  }
];

export const MAIN_GOD_TASKS: MainGodTask[] = [...MAINLINE_TASKS, ...SIDE_TASKS, ...GLOBAL_SIDE_TASKS];

export function getTaskById(taskId: string): MainGodTask | undefined {
  return MAIN_GOD_TASKS.find((task) => task.id === taskId || task.legacyClaimIds?.includes(taskId));
}

export function evaluateTask(state: GameState, taskId: string): MainGodTaskEvaluation | undefined {
  const task = getTaskById(taskId);
  if (!task) return undefined;

  const visible = task.isVisible ? task.isVisible(state) : true;
  const completed = task.isComplete(state);
  const claimed = isTaskRewardClaimed(state, task);
  const status: MainGodTaskStatus = claimed ? 'claimed' : !visible ? 'locked' : completed ? 'completed' : 'active';

  return {
    task,
    taskId: task.id,
    status,
    completed,
    claimed,
    visible,
    progressText: task.getProgressText(state)
  };
}

export function getVisibleTasks(state: GameState): MainGodTask[] {
  return MAIN_GOD_TASKS.filter((task) => !task.isVisible || task.isVisible(state));
}

export function evaluateVisibleTasks(state: GameState): MainGodTaskEvaluation[] {
  return getVisibleTasks(state).flatMap((task) => {
    const evaluation = evaluateTask(state, task.id);
    return evaluation ? [evaluation] : [];
  });
}

export function getNextMainlineTaskEvaluation(state: GameState): MainGodTaskEvaluation | undefined {
  const task = MAINLINE_TASKS.find((candidate) => !isTaskRewardClaimed(state, candidate));
  return task ? evaluateTask(state, task.id) : undefined;
}

export function evaluateVisibleSideTasks(state: GameState): MainGodTaskEvaluation[] {
  return [...SIDE_TASKS, ...GLOBAL_SIDE_TASKS].flatMap((task) => {
    const evaluation = evaluateTask(state, task.id);
    return evaluation?.visible ? [evaluation] : [];
  });
}

export function getUnlockedDungeonIdsFromMainline(state: GameState): DungeonId[] {
  const unlockedDungeonIds: DungeonId[] = [];

  for (let index = 0; index < DUNGEON_ORDER.length; index += 1) {
    if (index > 0 && !isTaskRewardClaimed(state, MAINLINE_TASKS[index - 1])) break;
    unlockedDungeonIds.push(DUNGEON_ORDER[index]);
  }

  return unlockedDungeonIds;
}

export function getMainlineRequirementText(state: GameState, dungeonId: DungeonId): string {
  const index = DUNGEON_ORDER.indexOf(dungeonId);
  if (index <= 0) return `${DUNGEONS[dungeonId].name} 是第一章，默认解锁。`;

  const previousTask = MAINLINE_TASKS[index - 1];
  if (isTaskRewardClaimed(state, previousTask)) return `${DUNGEONS[dungeonId].name} 已通过主线任务解锁。`;

  return `需要先完成并领取主线任务「${previousTask.title}」，才能解锁${DUNGEONS[dungeonId].name}。`;
}
