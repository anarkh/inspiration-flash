import { describe, expect, it } from 'vitest';
import { DUNGEON_ORDER } from './level-content';
import { getCampaignProgress, getNextDungeonRecommendation } from './campaign-progress';

describe('campaign progress gates', () => {
  it('reports exactly nineteen dungeon gates in strict campaign order', () => {
    const progress = getCampaignProgress({ completedDungeonIds: [], playerPower: 150 });

    expect(progress).toHaveLength(19);
    expect(progress.map((gate) => gate.dungeonId)).toEqual(DUNGEON_ORDER);
    expect(progress.at(-1)).toMatchObject({
      dungeonId: 'panopticon_city',
      dungeonName: '天幕监察城',
      recommendedGap: 1200
    });
  });

  it('keeps only 妖塔一层 normally available at the start', () => {
    const progress = getCampaignProgress({
      completedDungeonIds: [],
      playerPower: 150,
      unlockedDungeonIds: ['demon_tower_1']
    });
    const [firstGate, ...laterGates] = progress;

    expect(firstGate.dungeonName).toBe('妖塔一层');
    expect(firstGate.status).toBe('available');
    expect(firstGate.availabilityKind).toBe('normal');
    expect(firstGate.isNextRecommended).toBe(true);
    expect(firstGate.recommendedGap).toBe(0);

    expect(laterGates.every((gate) => gate.status === 'locked')).toBe(true);
    expect(laterGates[0].requirementText).toContain('主线任务');
    expect(laterGates[0].recommendedGap).toBe(35);
  });

  it('keeps the second dungeon locked after the first is completed but not claimed', () => {
    const progress = getCampaignProgress({
      completedDungeonIds: ['demon_tower_1'],
      playerPower: 185,
      unlockedDungeonIds: ['demon_tower_1'],
      mainlineRequirementText: {
        metro_abyss: '需要先领取主线任务「妖塔一层主线」'
      }
    });
    const recommendation = getNextDungeonRecommendation({
      completedDungeonIds: ['demon_tower_1'],
      playerPower: 185,
      unlockedDungeonIds: ['demon_tower_1'],
      mainlineRequirementText: {
        metro_abyss: '需要先领取主线任务「妖塔一层主线」'
      }
    });

    expect(progress[0].status).toBe('completed');
    expect(progress[0].requirementText).toContain('已完成');
    expect(progress[1]).toMatchObject({
      dungeonId: 'metro_abyss',
      status: 'locked',
      recommendedGap: 0,
      isNextRecommended: false
    });
    expect(progress[1].requirementText).toContain('主线任务');
    expect(recommendation).toBeUndefined();
  });

  it('recommends the second dungeon after the first mainline task is claimed', () => {
    const input = {
      completedDungeonIds: ['demon_tower_1'] as const,
      playerPower: 185,
      unlockedDungeonIds: ['demon_tower_1', 'metro_abyss'] as const
    };
    const progress = getCampaignProgress(input);
    const recommendation = getNextDungeonRecommendation(input);

    expect(progress[1]).toMatchObject({
      dungeonId: 'metro_abyss',
      status: 'available',
      availabilityKind: 'normal',
      recommendedGap: 0,
      isNextRecommended: true
    });
    expect(recommendation?.dungeonId).toBe('metro_abyss');
  });

  it('does not unlock later dungeons from power alone when mainline progress is missing', () => {
    const progress = getCampaignProgress({
      completedDungeonIds: [],
      playerPower: 999,
      unlockedDungeonIds: ['demon_tower_1'],
      mainlineRequirementText: {
        metro_abyss: '需要先推进主线任务「妖塔一层主线」'
      }
    });
    const secondGate = progress[1];

    expect(secondGate).toMatchObject({
      dungeonId: 'metro_abyss',
      status: 'locked',
      recommendedGap: 0,
      isNextRecommended: false
    });
    expect(secondGate.availabilityKind).toBeUndefined();
    expect(secondGate.requirementText).toContain('主线任务');
  });

  it('ignores a non-contiguous later unlock without rewriting intermediate chapter states', () => {
    const progress = getCampaignProgress({
      completedDungeonIds: ['panopticon_city'],
      playerPower: 1350,
      unlockedDungeonIds: ['demon_tower_1', 'panopticon_city']
    });

    expect(progress[0]).toMatchObject({ dungeonId: 'demon_tower_1', status: 'available' });
    expect(progress.slice(1, 18).every((gate) => gate.status === 'locked')).toBe(true);
    expect(progress[18]).toMatchObject({
      dungeonId: 'panopticon_city',
      status: 'completed',
      isNextRecommended: false
    });
  });

  it('keeps completed dungeons explicit even when later gates open', () => {
    const progress = getCampaignProgress({
      completedDungeonIds: ['demon_tower_1', 'metro_abyss'],
      playerPower: 225,
      unlockedDungeonIds: ['demon_tower_1', 'metro_abyss', 'starfall_mine']
    });

    expect(progress[0].status).toBe('completed');
    expect(progress[1].status).toBe('completed');
    expect(progress[2]).toMatchObject({
      dungeonId: 'starfall_mine',
      status: 'available',
      availabilityKind: 'normal',
      isNextRecommended: true
    });
  });

  it('unlocks the twelfth chapter only after the mirror-city mainline reward is claimed', () => {
    const firstEleven = DUNGEON_ORDER.slice(0, 11);
    const locked = getCampaignProgress({
      completedDungeonIds: firstEleven,
      playerPower: 700,
      unlockedDungeonIds: firstEleven,
      mainlineRequirementText: { redaction_scriptorium: '需要先完成并领取主线任务「镜海轮回城主线」' }
    });
    const unlocked = getCampaignProgress({
      completedDungeonIds: firstEleven,
      playerPower: 700,
      unlockedDungeonIds: DUNGEON_ORDER
    });

    expect(DUNGEON_ORDER[11]).toBe('redaction_scriptorium');
    expect(locked[11]).toMatchObject({ dungeonId: 'redaction_scriptorium', status: 'locked', isNextRecommended: false });
    expect(locked[11].requirementText).toContain('镜海轮回城主线');
    expect(unlocked[11]).toMatchObject({ dungeonId: 'redaction_scriptorium', status: 'available', isNextRecommended: true });
  });

  it('unlocks the thirteenth chapter only after the redaction mainline reward is claimed', () => {
    const firstTwelve = DUNGEON_ORDER.slice(0, 12);
    const locked = getCampaignProgress({
      completedDungeonIds: firstTwelve,
      playerPower: 780,
      unlockedDungeonIds: firstTwelve,
      mainlineRequirementText: {
        legacy_auction_court: '需要先完成并领取主线任务「删界终稿院主线」'
      }
    });
    const unlocked = getCampaignProgress({
      completedDungeonIds: firstTwelve,
      playerPower: 780,
      unlockedDungeonIds: DUNGEON_ORDER
    });

    expect(DUNGEON_ORDER[12]).toBe('legacy_auction_court');
    expect(locked[12]).toMatchObject({
      dungeonId: 'legacy_auction_court',
      status: 'locked',
      recommendedGap: 0,
      isNextRecommended: false
    });
    expect(locked[12].requirementText).toContain('删界终稿院主线');
    expect(unlocked[12]).toMatchObject({
      dungeonId: 'legacy_auction_court',
      status: 'available',
      recommendedGap: 0,
      isNextRecommended: true
    });
  });

  it('unlocks the fourteenth chapter only after the auction mainline reward is claimed', () => {
    const firstThirteen = DUNGEON_ORDER.slice(0, 13);
    const locked = getCampaignProgress({
      completedDungeonIds: firstThirteen,
      playerPower: 820,
      unlockedDungeonIds: firstThirteen,
      mainlineRequirementText: {
        genesis_vault: '需要先完成并领取主线任务「亡队遗产拍卖庭主线」'
      }
    });
    const unlocked = getCampaignProgress({
      completedDungeonIds: firstThirteen,
      playerPower: 820,
      unlockedDungeonIds: DUNGEON_ORDER
    });

    expect(DUNGEON_ORDER[13]).toBe('genesis_vault');
    expect(locked[13]).toMatchObject({
      dungeonId: 'genesis_vault',
      status: 'locked',
      recommendedGap: 40,
      isNextRecommended: false
    });
    expect(locked[13].requirementText).toContain('亡队遗产拍卖庭主线');
    expect(unlocked[13]).toMatchObject({
      dungeonId: 'genesis_vault',
      status: 'available',
      availabilityKind: 'normal',
      recommendedGap: 40,
      isNextRecommended: true
    });
  });

  it('unlocks the fifteenth chapter only after the genesis mainline reward is claimed', () => {
    const firstFourteen = DUNGEON_ORDER.slice(0, 14);
    const locked = getCampaignProgress({
      completedDungeonIds: firstFourteen,
      playerPower: 860,
      unlockedDungeonIds: firstFourteen,
      mainlineRequirementText: {
        silent_broadcast_tower: '需要先完成并领取主线任务「众生原型库主线」'
      }
    });
    const unlocked = getCampaignProgress({
      completedDungeonIds: firstFourteen,
      playerPower: 860,
      unlockedDungeonIds: DUNGEON_ORDER
    });

    expect(DUNGEON_ORDER[14]).toBe('silent_broadcast_tower');
    expect(locked[14]).toMatchObject({
      dungeonId: 'silent_broadcast_tower',
      status: 'locked',
      recommendedGap: 90,
      isNextRecommended: false
    });
    expect(locked[14].requirementText).toContain('众生原型库主线');
    expect(unlocked[14]).toMatchObject({
      dungeonId: 'silent_broadcast_tower',
      status: 'available',
      availabilityKind: 'normal',
      recommendedGap: 90,
      isNextRecommended: true
    });
  });

  it('unlocks the sixteenth chapter only after the broadcast mainline reward is claimed', () => {
    const firstFifteen = DUNGEON_ORDER.slice(0, 15);
    const locked = getCampaignProgress({
      completedDungeonIds: firstFifteen,
      playerPower: 950,
      unlockedDungeonIds: firstFifteen,
      mainlineRequirementText: {
        lost_shelter: '需要先完成并领取主线任务「寂声广播塔主线」'
      }
    });
    const unlocked = getCampaignProgress({
      completedDungeonIds: firstFifteen,
      playerPower: 950,
      unlockedDungeonIds: DUNGEON_ORDER
    });

    expect(DUNGEON_ORDER[15]).toBe('lost_shelter');
    expect(locked[15]).toMatchObject({
      dungeonId: 'lost_shelter',
      status: 'locked',
      recommendedGap: 90,
      isNextRecommended: false
    });
    expect(locked[15].requirementText).toContain('寂声广播塔主线');
    expect(unlocked[15]).toMatchObject({
      dungeonId: 'lost_shelter',
      status: 'available',
      availabilityKind: 'normal',
      recommendedGap: 90,
      isNextRecommended: true
    });
  });

  it('unlocks the seventeenth chapter only after the shelter mainline reward is claimed', () => {
    const firstSixteen = DUNGEON_ORDER.slice(0, 16);
    const locked = getCampaignProgress({
      completedDungeonIds: firstSixteen,
      playerPower: 1040,
      unlockedDungeonIds: firstSixteen,
      mainlineRequirementText: {
        false_testimony_court: '需要先完成并领取主线任务「失联避难所主线」'
      }
    });
    const unlocked = getCampaignProgress({
      completedDungeonIds: firstSixteen,
      playerPower: 1040,
      unlockedDungeonIds: DUNGEON_ORDER
    });

    expect(DUNGEON_ORDER[16]).toBe('false_testimony_court');
    expect(locked[16]).toMatchObject({
      dungeonId: 'false_testimony_court',
      status: 'locked',
      recommendedGap: 100,
      isNextRecommended: false
    });
    expect(locked[16].requirementText).toContain('失联避难所主线');
    expect(unlocked[16]).toMatchObject({
      dungeonId: 'false_testimony_court',
      status: 'available',
      availabilityKind: 'normal',
      recommendedGap: 100,
      isNextRecommended: true
    });
  });

  it('unlocks the eighteenth chapter only after the testimony mainline reward is claimed', () => {
    const firstSeventeen = DUNGEON_ORDER.slice(0, 17);
    const locked = getCampaignProgress({
      completedDungeonIds: firstSeventeen,
      playerPower: 1140,
      unlockedDungeonIds: firstSeventeen,
      mainlineRequirementText: {
        combat_replay_stage: '需要先完成并领取主线任务「伪证裁定庭主线」'
      }
    });
    const unlocked = getCampaignProgress({
      completedDungeonIds: firstSeventeen,
      playerPower: 1140,
      unlockedDungeonIds: DUNGEON_ORDER
    });

    expect(DUNGEON_ORDER[17]).toBe('combat_replay_stage');
    expect(locked[17]).toMatchObject({
      dungeonId: 'combat_replay_stage',
      status: 'locked',
      recommendedGap: 100,
      isNextRecommended: false
    });
    expect(locked[17].requirementText).toContain('伪证裁定庭主线');
    expect(unlocked[17]).toMatchObject({
      dungeonId: 'combat_replay_stage',
      status: 'available',
      availabilityKind: 'normal',
      recommendedGap: 100,
      isNextRecommended: true
    });
  });

  it('unlocks the nineteenth chapter only after the replay mainline reward is claimed', () => {
    const firstEighteen = DUNGEON_ORDER.slice(0, 18);
    const locked = getCampaignProgress({
      completedDungeonIds: firstEighteen,
      playerPower: 1240,
      unlockedDungeonIds: firstEighteen,
      mainlineRequirementText: {
        panopticon_city: '需要先完成并领取主线任务「战痕复演场主线」'
      }
    });
    const unlocked = getCampaignProgress({
      completedDungeonIds: firstEighteen,
      playerPower: 1240,
      unlockedDungeonIds: DUNGEON_ORDER
    });

    expect(DUNGEON_ORDER[18]).toBe('panopticon_city');
    expect(locked[18]).toMatchObject({
      dungeonId: 'panopticon_city',
      status: 'locked',
      recommendedGap: 110,
      isNextRecommended: false
    });
    expect(locked[18].requirementText).toContain('战痕复演场主线');
    expect(unlocked[18]).toMatchObject({
      dungeonId: 'panopticon_city',
      status: 'available',
      availabilityKind: 'normal',
      recommendedGap: 110,
      isNextRecommended: true
    });
  });

  it('keeps sequence-broken completion explicit without marking earlier mainline chapters complete', () => {
    const progress = getCampaignProgress({
      completedDungeonIds: ['panopticon_city'],
      playerPower: 1350,
      unlockedDungeonIds: ['demon_tower_1']
    });

    expect(progress[0]).toMatchObject({ dungeonId: 'demon_tower_1', status: 'available', isNextRecommended: true });
    expect(progress.slice(1, -1).every((gate) => gate.status === 'locked')).toBe(true);
    expect(progress.at(-1)).toMatchObject({
      dungeonId: 'panopticon_city',
      status: 'completed',
      requirementText: '已完成 天幕监察城',
      recommendedGap: 0,
      isNextRecommended: false
    });
    expect(progress[17]).toMatchObject({
      dungeonId: 'combat_replay_stage',
      status: 'locked',
      isNextRecommended: false
    });
  });
});
