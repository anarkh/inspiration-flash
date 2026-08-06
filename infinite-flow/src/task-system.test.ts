import { describe, expect, it } from 'vitest';
import { DUNGEON_ORDER } from './level-content';
import {
  claimTaskReward,
  createInitialState,
  enterDungeon,
  resolveRetreat,
  returnToHub,
  type DungeonId,
  type GameState,
  type RewardBundle
} from './game';

type TaskStatus = 'locked' | 'active' | 'completed' | 'claimed';
type LoadedMainGodTask = {
  id: string;
  kind: 'mainline' | 'side';
  chapterDungeonId: DungeonId;
  mainlineIndex?: number;
  title: string;
  description: string;
  hint: string;
  reward: RewardBundle;
};
type LoadedTaskSystem = {
  MAINLINE_TASKS: LoadedMainGodTask[];
  SIDE_TASKS: LoadedMainGodTask[];
  GLOBAL_SIDE_TASKS: LoadedMainGodTask[];
  MAIN_GOD_TASKS: LoadedMainGodTask[];
  evaluateTask: (state: GameState, taskId: string) => {
    task: LoadedMainGodTask;
    taskId: string;
    status: TaskStatus;
    completed: boolean;
    claimed: boolean;
    visible: boolean;
    progressText: string;
  };
  evaluateVisibleTasks: (state: GameState) => Array<ReturnType<LoadedTaskSystem['evaluateTask']>>;
  evaluateVisibleSideTasks: (state: GameState) => Array<ReturnType<LoadedTaskSystem['evaluateTask']>>;
  getNextMainlineTaskEvaluation: (state: GameState) => ReturnType<LoadedTaskSystem['evaluateTask']> | undefined;
  getUnlockedDungeonIdsFromMainline: (state: GameState) => DungeonId[];
  getMainlineRequirementText: (state: GameState, dungeonId: DungeonId) => string;
  getTaskById: (taskId: string) => LoadedTaskSystem['MAIN_GOD_TASKS'][number] | undefined;
};

async function loadTaskSystem(): Promise<LoadedTaskSystem> {
  const loaded = await import('./task-system').catch(() => undefined);

  expect(loaded).toBeDefined();
  return loaded as LoadedTaskSystem;
}

function rewardPointTotal(reward: RewardBundle): number {
  return reward.rewardPoints ?? 0;
}

function hasNonEmptyReward(reward: RewardBundle): boolean {
  return Boolean(reward.rewardPoints || reward.lingyun || Object.keys(reward.items ?? {}).length);
}

describe('persistent main god task system', () => {
  it('defines one linear mainline task for each campaign dungeon', async () => {
    const taskSystem = await loadTaskSystem();
    const mainlineIds = taskSystem.MAINLINE_TASKS.map((task) => task.id);

    expect(taskSystem.MAINLINE_TASKS).toHaveLength(19);
    expect(taskSystem.MAINLINE_TASKS.map((task) => task.chapterDungeonId)).toEqual(DUNGEON_ORDER);
    expect(taskSystem.MAINLINE_TASKS.at(-1)?.chapterDungeonId).toBe('panopticon_city');
    expect(new Set(mainlineIds).size).toBe(mainlineIds.length);
    expect(mainlineIds).toEqual(DUNGEON_ORDER.map((dungeonId) => `mainline_clear_${dungeonId}`));
    expect(taskSystem.MAINLINE_TASKS.every((task, index) => task.kind === 'mainline' && task.mainlineIndex === index)).toBe(true);
    expect(taskSystem.MAINLINE_TASKS.every((task) => task.title && task.description && task.hint)).toBe(true);
  });

  it('defines at least two restrained side tasks for every dungeon chapter', async () => {
    const taskSystem = await loadTaskSystem();
    const ids = taskSystem.MAIN_GOD_TASKS.map((task) => task.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(taskSystem.MAIN_GOD_TASKS).toEqual([
      ...taskSystem.MAINLINE_TASKS,
      ...taskSystem.SIDE_TASKS,
      ...taskSystem.GLOBAL_SIDE_TASKS
    ]);
    expect(taskSystem.SIDE_TASKS.every((task) => task.kind === 'side' && task.chapterDungeonId)).toBe(true);
    for (const dungeonId of DUNGEON_ORDER) {
      expect(taskSystem.SIDE_TASKS.filter((task) => task.chapterDungeonId === dungeonId).length).toBeGreaterThanOrEqual(2);
    }
    expect(taskSystem.MAIN_GOD_TASKS.every((task) => task.title && task.description && task.hint)).toBe(true);
    expect(taskSystem.MAIN_GOD_TASKS.every((task) => hasNonEmptyReward(task.reward))).toBe(true);
    expect(Math.max(...taskSystem.MAIN_GOD_TASKS.map((task) => rewardPointTotal(task.reward)))).toBe(260);
    expect(taskSystem.MAINLINE_TASKS).toHaveLength(19);
    expect(taskSystem.SIDE_TASKS).toHaveLength(38);
    expect(taskSystem.GLOBAL_SIDE_TASKS).toHaveLength(6);
    expect(taskSystem.MAIN_GOD_TASKS).toHaveLength(63);
    expect(taskSystem.MAIN_GOD_TASKS.filter((task) => task.kind === 'side')).toHaveLength(44);
    expect(taskSystem.MAIN_GOD_TASKS.reduce((total, task) => total + rewardPointTotal(task.reward), 0)).toBe(5560);
  });

  it('initially unlocks only the first chapter and recommends the 妖塔一层 mainline task', async () => {
    const taskSystem = await loadTaskSystem();
    const state = createInitialState();
    const evaluations = taskSystem.evaluateVisibleTasks(state);
    const sideEvaluations = taskSystem.evaluateVisibleSideTasks(state);

    expect(state.claimedTaskIds).toEqual([]);
    expect(evaluations.length).toBeGreaterThan(0);
    expect(evaluations.every((evaluation) => evaluation.visible)).toBe(true);
    expect(evaluations.every((evaluation) => !evaluation.claimed)).toBe(true);
    expect(taskSystem.getUnlockedDungeonIdsFromMainline(state)).toEqual(['demon_tower_1']);
    expect(taskSystem.getNextMainlineTaskEvaluation(state)?.task.chapterDungeonId).toBe('demon_tower_1');
    expect(sideEvaluations).toHaveLength(3);
    expect(sideEvaluations.every((evaluation) => evaluation.task.chapterDungeonId === 'demon_tower_1')).toBe(true);
  });

  it('keeps the next chapter locked until the previous mainline task is claimed', async () => {
    const taskSystem = await loadTaskSystem();
    const initial = createInitialState();
    const clearedDemonTower: GameState = {
      ...initial,
      completedDungeonIds: ['demon_tower_1']
    };
    const claimedDemonTower: GameState = {
      ...clearedDemonTower,
      claimedTaskIds: ['mainline_clear_demon_tower_1']
    };

    expect(taskSystem.evaluateTask(clearedDemonTower, 'mainline_clear_demon_tower_1').completed).toBe(true);
    expect(taskSystem.evaluateTask(clearedDemonTower, 'mainline_clear_demon_tower_1').claimed).toBe(false);
    expect(taskSystem.getUnlockedDungeonIdsFromMainline(clearedDemonTower)).toEqual(['demon_tower_1']);
    expect(taskSystem.getMainlineRequirementText(clearedDemonTower, 'metro_abyss')).toContain('妖塔一层');
    expect(taskSystem.getNextMainlineTaskEvaluation(claimedDemonTower)?.task.chapterDungeonId).toBe('metro_abyss');
    expect(taskSystem.getUnlockedDungeonIdsFromMainline(claimedDemonTower)).toEqual(['demon_tower_1', 'metro_abyss']);
  });

  it('derives chapter side-task progress from current runs, first clears, and directive claims', async () => {
    const taskSystem = await loadTaskSystem();
    const initial = createInitialState();
    const inDemonTower = enterDungeon(initial, 'demon_tower_1');
    const afterRetreat = returnToHub(resolveRetreat(inDemonTower));
    const clearedDemonTower: GameState = {
      ...initial,
      completedDungeonIds: ['demon_tower_1']
    };
    const directiveClaimed: GameState = {
      ...clearedDemonTower,
      claimedDirectiveIds: ['directive_demon_tower_1']
    };

    expect(taskSystem.evaluateTask(inDemonTower, 'side_enter_demon_tower_1').completed).toBe(true);
    expect(taskSystem.evaluateTask(afterRetreat, 'side_enter_demon_tower_1')).toMatchObject({
      completed: true,
      progressText: '1/1 已记录入口'
    });
    expect(taskSystem.evaluateTask(clearedDemonTower, 'side_enter_demon_tower_1').completed).toBe(true);
    expect(taskSystem.evaluateTask(clearedDemonTower, 'side_directive_demon_tower_1').completed).toBe(false);
    expect(taskSystem.evaluateTask(directiveClaimed, 'side_directive_demon_tower_1').completed).toBe(true);
  });

  it('derives global companion tasks from the durable roster and ranks', async () => {
    const taskSystem = await loadTaskSystem();
    const initial = createInitialState();
    const unlocked: GameState = {
      ...initial,
      completedDungeonIds: ['demon_tower_1']
    };
    const recruited: GameState = {
      ...unlocked,
      ownedCompanions: ['qin_che'],
      companionRanks: { qin_che: 1 }
    };
    const trained: GameState = {
      ...recruited,
      companionRanks: { qin_che: 2 }
    };
    const recruitedRewarded = claimTaskReward(recruited, 'side_recruit_first_companion');
    const trainedRewarded = claimTaskReward(trained, 'side_train_companion_rank_2');

    expect(taskSystem.getTaskById('side_recruit_first_companion')?.reward).toEqual({ rewardPoints: 120 });
    expect(taskSystem.getTaskById('side_train_companion_rank_2')?.reward).toEqual({ rewardPoints: 180, lingyun: 1 });
    expect(taskSystem.evaluateTask(initial, 'side_recruit_first_companion').visible).toBe(false);
    expect(taskSystem.evaluateTask(unlocked, 'side_recruit_first_companion')).toMatchObject({
      visible: true,
      completed: false,
      status: 'active'
    });
    expect(taskSystem.evaluateTask(recruited, 'side_recruit_first_companion')).toMatchObject({
      visible: true,
      completed: true,
      status: 'completed'
    });
    expect(taskSystem.evaluateTask(recruited, 'side_train_companion_rank_2')).toMatchObject({
      visible: true,
      completed: false,
      status: 'active'
    });
    expect(taskSystem.evaluateTask(trained, 'side_train_companion_rank_2')).toMatchObject({
      visible: true,
      completed: true,
      status: 'completed'
    });
    expect(recruitedRewarded.rewardPoints - recruited.rewardPoints).toBe(120);
    expect(recruitedRewarded.claimedTaskIds).toContain('side_recruit_first_companion');
    expect(trainedRewarded.rewardPoints - trained.rewardPoints).toBe(180);
    expect(trainedRewarded.lingyun - trained.lingyun).toBe(1);
    expect(trainedRewarded.claimedTaskIds).toContain('side_train_companion_rank_2');
  });

  it('derives global cultivation tasks from learned methods and normalized durable ranks', async () => {
    const taskSystem = await loadTaskSystem();
    const initial = createInitialState();
    const legacyLearned = {
      ...initial,
      learnedMethods: ['mist_breathing' as const]
    };
    const invalidSavedRank = {
      ...legacyLearned,
      methodRanks: { mist_breathing: 99 }
    } as unknown as GameState;
    const refined = {
      ...legacyLearned,
      methodRanks: { mist_breathing: 2 }
    } as GameState;
    const mastered = {
      ...legacyLearned,
      methodRanks: { mist_breathing: 3 }
    } as GameState;
    const refinedRewarded = claimTaskReward(refined, 'side_refine_first_method_rank_2');
    const masteredRewarded = claimTaskReward(mastered, 'side_master_first_method_rank_3');

    expect(taskSystem.getTaskById('side_refine_first_method_rank_2')?.reward).toEqual({ rewardPoints: 120 });
    expect(taskSystem.getTaskById('side_master_first_method_rank_3')?.reward).toEqual({ rewardPoints: 180, lingyun: 1 });
    expect(taskSystem.evaluateTask(initial, 'side_refine_first_method_rank_2')).toMatchObject({
      visible: false,
      completed: false,
      status: 'locked'
    });
    expect(taskSystem.evaluateTask(legacyLearned, 'side_refine_first_method_rank_2')).toMatchObject({
      visible: true,
      completed: false,
      progressText: '1/2 功法最高阶位'
    });
    expect(taskSystem.evaluateTask(invalidSavedRank, 'side_refine_first_method_rank_2').completed).toBe(false);
    expect(taskSystem.evaluateTask(legacyLearned, 'side_master_first_method_rank_3').visible).toBe(false);
    expect(taskSystem.evaluateTask(refined, 'side_refine_first_method_rank_2')).toMatchObject({
      visible: true,
      completed: true,
      status: 'completed'
    });
    expect(taskSystem.evaluateTask(refined, 'side_master_first_method_rank_3')).toMatchObject({
      visible: true,
      completed: false,
      status: 'active'
    });
    expect(taskSystem.evaluateTask(mastered, 'side_master_first_method_rank_3')).toMatchObject({
      visible: true,
      completed: true,
      status: 'completed'
    });
    expect(refinedRewarded.rewardPoints - refined.rewardPoints).toBe(120);
    expect(masteredRewarded.rewardPoints - mastered.rewardPoints).toBe(180);
    expect(masteredRewarded.lingyun - mastered.lingyun).toBe(1);
  });

  it('derives bloodline tasks only from normalized durable progress', async () => {
    const taskSystem = await loadTaskSystem();
    const initial = createInitialState();
    const malformed = {
      ...initial,
      bloodlineRanks: { titan_marrow: 99 },
      activeBloodline: 'titan_marrow'
    } as unknown as GameState;
    const awakened = {
      ...initial,
      bloodlineRanks: { titan_marrow: 1 },
      activeBloodline: 'titan_marrow'
    } as GameState;
    const mastered = {
      ...initial,
      bloodlineRanks: { titan_marrow: 3 },
      activeBloodline: 'titan_marrow'
    } as GameState;
    const awakenedRewarded = claimTaskReward(awakened, 'side_unlock_first_bloodline');
    const masteredRewarded = claimTaskReward(mastered, 'side_master_first_bloodline_rank_3');

    expect(taskSystem.getTaskById('side_unlock_first_bloodline')?.title).toBe('血统初醒');
    expect(taskSystem.getTaskById('side_unlock_first_bloodline')?.reward).toEqual({ rewardPoints: 150 });
    expect(taskSystem.getTaskById('side_master_first_bloodline_rank_3')?.title).toBe('祖型大成');
    expect(taskSystem.getTaskById('side_master_first_bloodline_rank_3')?.reward).toEqual({ rewardPoints: 250 });
    expect(taskSystem.evaluateTask(initial, 'side_unlock_first_bloodline')).toMatchObject({
      visible: true,
      completed: false,
      status: 'active',
      progressText: '0/1 尚未拥有血统'
    });
    expect(taskSystem.evaluateTask(initial, 'side_master_first_bloodline_rank_3').visible).toBe(false);
    expect(taskSystem.evaluateTask(malformed, 'side_unlock_first_bloodline').completed).toBe(false);
    expect(taskSystem.evaluateTask(malformed, 'side_master_first_bloodline_rank_3').visible).toBe(false);
    expect(taskSystem.evaluateTask(awakened, 'side_unlock_first_bloodline')).toMatchObject({
      visible: true,
      completed: true,
      status: 'completed',
      progressText: '1/1 已觉醒首条血统'
    });
    expect(taskSystem.evaluateTask(awakened, 'side_master_first_bloodline_rank_3')).toMatchObject({
      visible: true,
      completed: false,
      status: 'active',
      progressText: '1/3 血统最高阶位'
    });
    expect(taskSystem.evaluateTask(mastered, 'side_master_first_bloodline_rank_3')).toMatchObject({
      visible: true,
      completed: true,
      status: 'completed',
      progressText: '3/3 血统最高阶位'
    });
    expect(awakenedRewarded.rewardPoints - awakened.rewardPoints).toBe(150);
    expect(masteredRewarded.rewardPoints - mastered.rewardPoints).toBe(250);
  });

  it('treats legacy claimed flat ids as already claimed aliases for migrated mainline rewards', async () => {
    const taskSystem = await loadTaskSystem();
    const legacyClaimed: GameState = {
      ...createInitialState(),
      completedDungeonIds: ['demon_tower_1'],
      claimedTaskIds: ['clear_demon_tower']
    };

    expect(taskSystem.evaluateTask(legacyClaimed, 'mainline_clear_demon_tower_1').claimed).toBe(true);
    expect(taskSystem.getUnlockedDungeonIdsFromMainline(legacyClaimed)).toEqual(['demon_tower_1', 'metro_abyss']);
  });

  it('derives the fourteenth chapter task ids, rewards, and auction mainline gate from the canonical order', async () => {
    const taskSystem = await loadTaskSystem();
    const firstThirteenDungeonIds = DUNGEON_ORDER.slice(0, 13);
    const tasks = [
      taskSystem.getTaskById('mainline_clear_genesis_vault'),
      taskSystem.getTaskById('side_enter_genesis_vault'),
      taskSystem.getTaskById('side_directive_genesis_vault')
    ];
    const beforeAuctionClaim: GameState = {
      ...createInitialState(),
      claimedTaskIds: firstThirteenDungeonIds.slice(0, -1).map((dungeonId) => `mainline_clear_${dungeonId}`)
    };
    const afterAuctionClaim: GameState = {
      ...beforeAuctionClaim,
      claimedTaskIds: firstThirteenDungeonIds.map((dungeonId) => `mainline_clear_${dungeonId}`)
    };

    expect(taskSystem.MAINLINE_TASKS).toHaveLength(19);
    expect(taskSystem.SIDE_TASKS).toHaveLength(38);
    expect(taskSystem.GLOBAL_SIDE_TASKS).toHaveLength(6);
    expect(tasks.map((task) => task?.chapterDungeonId)).toEqual([
      'genesis_vault',
      'genesis_vault',
      'genesis_vault'
    ]);
    expect(tasks.map((task) => task?.reward.rewardPoints)).toEqual([210, 30, 40]);
    expect(taskSystem.getUnlockedDungeonIdsFromMainline(beforeAuctionClaim)).toEqual(firstThirteenDungeonIds);
    expect(taskSystem.getUnlockedDungeonIdsFromMainline(afterAuctionClaim)).toEqual(DUNGEON_ORDER.slice(0, 14));
    expect(afterAuctionClaim.claimedTaskIds.at(-1)).toBe('mainline_clear_legacy_auction_court');
    expect(taskSystem.getMainlineRequirementText(beforeAuctionClaim, 'genesis_vault')).toContain('亡队遗产拍卖庭主线');
  });

  it('derives the fifteenth chapter rewards and unlocks it only from the claimed genesis mainline', async () => {
    const taskSystem = await loadTaskSystem();
    const firstFourteenDungeonIds = DUNGEON_ORDER.slice(0, 14);
    const tasks = [
      taskSystem.getTaskById('mainline_clear_silent_broadcast_tower'),
      taskSystem.getTaskById('side_enter_silent_broadcast_tower'),
      taskSystem.getTaskById('side_directive_silent_broadcast_tower')
    ];
    const beforeGenesisClaim: GameState = {
      ...createInitialState(),
      completedDungeonIds: firstFourteenDungeonIds,
      claimedTaskIds: firstFourteenDungeonIds.slice(0, -1).map((dungeonId) => `mainline_clear_${dungeonId}`)
    };
    const afterGenesisClaim: GameState = {
      ...beforeGenesisClaim,
      claimedTaskIds: firstFourteenDungeonIds.map((dungeonId) => `mainline_clear_${dungeonId}`)
    };

    expect(tasks.map((task) => task?.chapterDungeonId)).toEqual([
      'silent_broadcast_tower',
      'silent_broadcast_tower',
      'silent_broadcast_tower'
    ]);
    expect(tasks.map((task) => task?.reward.rewardPoints)).toEqual([220, 30, 40]);
    expect(taskSystem.getUnlockedDungeonIdsFromMainline(beforeGenesisClaim)).toEqual(firstFourteenDungeonIds);
    expect(taskSystem.getUnlockedDungeonIdsFromMainline(afterGenesisClaim)).toEqual(DUNGEON_ORDER.slice(0, 15));
    expect(afterGenesisClaim.claimedTaskIds.at(-1)).toBe('mainline_clear_genesis_vault');
    expect(taskSystem.getMainlineRequirementText(beforeGenesisClaim, 'silent_broadcast_tower')).toContain('众生原型库主线');
  });

  it('derives the sixteenth chapter rewards and unlocks it only from the claimed broadcast mainline', async () => {
    const taskSystem = await loadTaskSystem();
    const firstFifteenDungeonIds = DUNGEON_ORDER.slice(0, 15);
    const tasks = [
      taskSystem.getTaskById('mainline_clear_lost_shelter'),
      taskSystem.getTaskById('side_enter_lost_shelter'),
      taskSystem.getTaskById('side_directive_lost_shelter')
    ];
    const beforeBroadcastClaim: GameState = {
      ...createInitialState(),
      completedDungeonIds: firstFifteenDungeonIds,
      claimedTaskIds: firstFifteenDungeonIds.slice(0, -1).map((dungeonId) => `mainline_clear_${dungeonId}`)
    };
    const afterBroadcastClaim: GameState = {
      ...beforeBroadcastClaim,
      claimedTaskIds: firstFifteenDungeonIds.map((dungeonId) => `mainline_clear_${dungeonId}`)
    };
    const sequenceBroken: GameState = {
      ...createInitialState(),
      completedDungeonIds: ['lost_shelter']
    };

    expect(tasks.map((task) => task?.chapterDungeonId)).toEqual([
      'lost_shelter',
      'lost_shelter',
      'lost_shelter'
    ]);
    expect(tasks.map((task) => task?.reward.rewardPoints)).toEqual([230, 30, 40]);
    expect(taskSystem.getUnlockedDungeonIdsFromMainline(beforeBroadcastClaim)).toEqual(firstFifteenDungeonIds);
    expect(taskSystem.getUnlockedDungeonIdsFromMainline(afterBroadcastClaim)).toEqual(DUNGEON_ORDER.slice(0, 16));
    expect(afterBroadcastClaim.claimedTaskIds.at(-1)).toBe('mainline_clear_silent_broadcast_tower');
    expect(taskSystem.getMainlineRequirementText(beforeBroadcastClaim, 'lost_shelter')).toContain('寂声广播塔主线');
    expect(taskSystem.evaluateTask(sequenceBroken, 'mainline_clear_lost_shelter')).toMatchObject({
      visible: false,
      completed: true,
      claimed: false,
      status: 'locked'
    });
    expect(taskSystem.getUnlockedDungeonIdsFromMainline(sequenceBroken)).toEqual(['demon_tower_1']);
  });

  it('derives the seventeenth chapter rewards and unlocks it only from the claimed shelter mainline', async () => {
    const taskSystem = await loadTaskSystem();
    const firstSixteenDungeonIds = DUNGEON_ORDER.slice(0, 16);
    const tasks = [
      taskSystem.getTaskById('mainline_clear_false_testimony_court'),
      taskSystem.getTaskById('side_enter_false_testimony_court'),
      taskSystem.getTaskById('side_directive_false_testimony_court')
    ];
    const beforeShelterClaim: GameState = {
      ...createInitialState(),
      completedDungeonIds: firstSixteenDungeonIds,
      claimedTaskIds: firstSixteenDungeonIds.slice(0, -1).map((dungeonId) => `mainline_clear_${dungeonId}`)
    };
    const afterShelterClaim: GameState = {
      ...beforeShelterClaim,
      claimedTaskIds: firstSixteenDungeonIds.map((dungeonId) => `mainline_clear_${dungeonId}`)
    };
    const sequenceBroken: GameState = {
      ...createInitialState(),
      completedDungeonIds: ['false_testimony_court']
    };

    expect(tasks.map((task) => task?.chapterDungeonId)).toEqual([
      'false_testimony_court',
      'false_testimony_court',
      'false_testimony_court'
    ]);
    expect(tasks.map((task) => task?.reward.rewardPoints)).toEqual([240, 30, 40]);
    expect(taskSystem.getUnlockedDungeonIdsFromMainline(beforeShelterClaim)).toEqual(firstSixteenDungeonIds);
    expect(taskSystem.getUnlockedDungeonIdsFromMainline(afterShelterClaim)).toEqual(DUNGEON_ORDER.slice(0, 17));
    expect(afterShelterClaim.claimedTaskIds.at(-1)).toBe('mainline_clear_lost_shelter');
    expect(taskSystem.getMainlineRequirementText(beforeShelterClaim, 'false_testimony_court')).toContain('失联避难所主线');
    expect(taskSystem.evaluateTask(sequenceBroken, 'mainline_clear_false_testimony_court')).toMatchObject({
      visible: false,
      completed: true,
      claimed: false,
      status: 'locked'
    });
    expect(taskSystem.getUnlockedDungeonIdsFromMainline(sequenceBroken)).toEqual(['demon_tower_1']);
  });

  it('derives the eighteenth chapter rewards and never promotes a portal visit into mainline progress', async () => {
    const taskSystem = await loadTaskSystem();
    const firstSeventeenDungeonIds = DUNGEON_ORDER.slice(0, 17);
    const tasks = [
      taskSystem.getTaskById('mainline_clear_combat_replay_stage'),
      taskSystem.getTaskById('side_enter_combat_replay_stage'),
      taskSystem.getTaskById('side_directive_combat_replay_stage')
    ];
    const beforeTestimonyClaim: GameState = {
      ...createInitialState(),
      completedDungeonIds: firstSeventeenDungeonIds,
      claimedTaskIds: firstSeventeenDungeonIds.slice(0, -1).map((dungeonId) => `mainline_clear_${dungeonId}`)
    };
    const afterTestimonyClaim: GameState = {
      ...beforeTestimonyClaim,
      claimedTaskIds: firstSeventeenDungeonIds.map((dungeonId) => `mainline_clear_${dungeonId}`)
    };
    const portalVisit = {
      ...createInitialState(),
      run: { dungeonId: 'combat_replay_stage' }
    } as unknown as GameState;

    expect(tasks.map((task) => task?.chapterDungeonId)).toEqual([
      'combat_replay_stage',
      'combat_replay_stage',
      'combat_replay_stage'
    ]);
    expect(tasks.map((task) => task?.reward.rewardPoints)).toEqual([250, 30, 40]);
    expect(taskSystem.getUnlockedDungeonIdsFromMainline(beforeTestimonyClaim)).toEqual(firstSeventeenDungeonIds);
    expect(taskSystem.getUnlockedDungeonIdsFromMainline(afterTestimonyClaim)).toEqual(DUNGEON_ORDER.slice(0, 18));
    expect(afterTestimonyClaim.claimedTaskIds.at(-1)).toBe('mainline_clear_false_testimony_court');
    expect(taskSystem.getMainlineRequirementText(beforeTestimonyClaim, 'combat_replay_stage')).toContain('伪证裁定庭主线');
    expect(taskSystem.evaluateTask(portalVisit, 'mainline_clear_combat_replay_stage')).toMatchObject({
      completed: false,
      claimed: false
    });
    expect(taskSystem.getUnlockedDungeonIdsFromMainline(portalVisit)).toEqual(['demon_tower_1']);
  });

  it('binds the eighteenth chapter side tasks to three takes, route choice, and boss replay', async () => {
    const taskSystem = await loadTaskSystem();
    const unlockedTaskIds = DUNGEON_ORDER.slice(0, 17).map(
      (dungeonId) => `mainline_clear_${dungeonId}`
    );
    const createReplayState = (takes: Array<object | null>, route: string | null, bossSnapshot: object | null) => ({
      ...createInitialState(),
      claimedTaskIds: unlockedTaskIds,
      run: {
        dungeonId: 'combat_replay_stage',
        combatReplayState: {
          recordings: Object.fromEntries(
            takes.flatMap((take, index) => take === null
              ? []
              : [[['take_alpha', 'take_beta', 'take_gamma'][index], take]])
          ),
          ...(route === null ? {} : { route })
        },
        lawState: {
          law: { kind: 'combat_replay_stage', takes, route, bossSnapshot }
        }
      }
    }) as unknown as GameState;
    const oneTake = createReplayState([{ action: 'attack' }, null, null], null, null);
    const allTakes = createReplayState(
      [{ action: 'attack' }, { action: 'art' }, { action: 'guard' }],
      null,
      null
    );
    const routed = createReplayState(
      [{ action: 'attack' }, { action: 'art' }, { action: 'guard' }],
      'sequence',
      null
    );
    const bossRecorded = createReplayState(
      [{ action: 'attack' }, { action: 'art' }, { action: 'guard' }],
      'sequence',
      { route: 'sequence' }
    );

    expect(taskSystem.evaluateTask(oneTake, 'side_enter_combat_replay_stage')).toMatchObject({
      visible: true,
      completed: false,
      progressText: '1/3 已完成录制'
    });
    expect(taskSystem.evaluateTask(allTakes, 'side_enter_combat_replay_stage')).toMatchObject({
      completed: true,
      progressText: '3/3 已完成录制'
    });
    expect(taskSystem.evaluateTask(routed, 'side_directive_combat_replay_stage')).toMatchObject({
      completed: false,
      progressText: '1/2 路线与首领复演'
    });
    expect(taskSystem.evaluateTask(bossRecorded, 'side_directive_combat_replay_stage')).toMatchObject({
      completed: true,
      progressText: '2/2 路线与首领复演'
    });
  });

  it('derives the nineteenth chapter counts, reward points, and unlock from the claimed replay mainline', async () => {
    const taskSystem = await loadTaskSystem();
    const firstEighteenDungeonIds = DUNGEON_ORDER.slice(0, 18);
    const tasks = [
      taskSystem.getTaskById('mainline_clear_panopticon_city'),
      taskSystem.getTaskById('side_enter_panopticon_city'),
      taskSystem.getTaskById('side_directive_panopticon_city')
    ];
    const beforeReplayClaim: GameState = {
      ...createInitialState(),
      completedDungeonIds: firstEighteenDungeonIds,
      claimedTaskIds: firstEighteenDungeonIds.slice(0, -1).map((dungeonId) => `mainline_clear_${dungeonId}`)
    };
    const afterReplayClaim: GameState = {
      ...beforeReplayClaim,
      claimedTaskIds: firstEighteenDungeonIds.map((dungeonId) => `mainline_clear_${dungeonId}`)
    };

    expect(tasks.map((task) => task?.chapterDungeonId)).toEqual([
      'panopticon_city',
      'panopticon_city',
      'panopticon_city'
    ]);
    expect(tasks.map((task) => task?.reward.rewardPoints)).toEqual([260, 30, 40]);
    expect(taskSystem.MAINLINE_TASKS).toHaveLength(19);
    expect(taskSystem.SIDE_TASKS).toHaveLength(38);
    expect(taskSystem.GLOBAL_SIDE_TASKS).toHaveLength(6);
    expect(taskSystem.MAIN_GOD_TASKS).toHaveLength(63);
    expect(taskSystem.getUnlockedDungeonIdsFromMainline(beforeReplayClaim)).toEqual(firstEighteenDungeonIds);
    expect(taskSystem.getUnlockedDungeonIdsFromMainline(afterReplayClaim)).toEqual(DUNGEON_ORDER);
    expect(afterReplayClaim.claimedTaskIds.at(-1)).toBe('mainline_clear_combat_replay_stage');
    expect(taskSystem.getMainlineRequirementText(beforeReplayClaim, 'panopticon_city')).toContain('战痕复演场主线');
  });

  it('binds the nineteenth chapter side tasks to three relays, route lock, and Boss snapshot', async () => {
    const taskSystem = await loadTaskSystem();
    const unlockedTaskIds = DUNGEON_ORDER.slice(0, 18).map(
      (dungeonId) => `mainline_clear_${dungeonId}`
    );
    const createPanopticonState = (
      relays: { north_blind_relay: boolean; central_blind_relay: boolean; south_blind_relay: boolean },
      route: string | null,
      bossSnapshot: object | null
    ) => ({
      ...createInitialState(),
      claimedTaskIds: unlockedTaskIds,
      run: {
        dungeonId: 'panopticon_city',
        lawState: {
          law: { kind: 'panopticon_city', relays, route, bossSnapshot }
        }
      }
    }) as unknown as GameState;
    const oneRelay = createPanopticonState({
      north_blind_relay: true,
      central_blind_relay: false,
      south_blind_relay: false
    }, null, null);
    const allRelays = createPanopticonState({
      north_blind_relay: true,
      central_blind_relay: true,
      south_blind_relay: true
    }, null, null);
    const routed = createPanopticonState({
      north_blind_relay: true,
      central_blind_relay: true,
      south_blind_relay: true
    }, 'shadow', null);
    const bossRecorded = createPanopticonState({
      north_blind_relay: true,
      central_blind_relay: true,
      south_blind_relay: true
    }, 'shadow', { route: 'shadow' });

    expect(taskSystem.evaluateTask(oneRelay, 'side_enter_panopticon_city')).toMatchObject({
      visible: true,
      completed: false,
      progressText: '1/3 已完成中继'
    });
    expect(taskSystem.evaluateTask(allRelays, 'side_enter_panopticon_city')).toMatchObject({
      completed: true,
      progressText: '3/3 已完成中继'
    });
    expect(taskSystem.evaluateTask(routed, 'side_directive_panopticon_city')).toMatchObject({
      completed: false,
      progressText: '1/2 路线与首领快照'
    });
    expect(taskSystem.evaluateTask(bossRecorded, 'side_directive_panopticon_city')).toMatchObject({
      completed: true,
      progressText: '2/2 路线与首领快照'
    });
  });
});
