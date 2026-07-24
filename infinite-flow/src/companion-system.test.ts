import { describe, expect, it } from 'vitest';

import {
  COMPANION_CATALOG,
  COMPANION_RULES_VERSION,
  createCompanionRunSnapshot,
  createEmptyCompanionProgress,
  getCompanionAssistEffect,
  getCompanionAssistStatus,
  getCompanionDefinition,
  getCompanionRecruitmentStatus,
  getCompanionUpgradeCost,
  getCompanionUpgradeStatus,
  isCompanionUnlocked,
  normalizeActiveCompanion,
  normalizeCompanionProgress,
  normalizeCompanionRunSnapshot,
  type CompanionId,
  type CompanionProgress,
  type CompanionRank
} from './companion-system';

function progress(
  owned: readonly CompanionId[],
  ranks: Partial<Record<CompanionId, CompanionRank>>,
  active?: CompanionId
): CompanionProgress {
  return {
    rulesVersion: COMPANION_RULES_VERSION,
    owned,
    ranks,
    ...(active === undefined ? {} : { active })
  };
}

describe('companion catalog', () => {
  it('locks all companion identities, unlocks, recruitment costs, and assist names', () => {
    expect(COMPANION_RULES_VERSION).toBe(1);
    expect(COMPANION_CATALOG).toMatchObject([
      {
        id: 'qin_che',
        name: '秦彻',
        title: '壁垒先锋',
        unlockDungeonId: 'demon_tower_1',
        recruitCost: { rewardPoints: 480, lingyun: 1, items: { demon_bone: 2 } },
        trainingMaterial: 'demon_bone',
        assistName: '抢位援护'
      },
      {
        id: 'zhou_yingxue',
        name: '周映雪',
        title: '精神分析师',
        unlockDungeonId: 'dream_archive',
        recruitCost: { rewardPoints: 920, lingyun: 2, items: { method_page: 2 } },
        trainingMaterial: 'method_page',
        assistName: '弱点演算'
      },
      {
        id: 'lu_guanlan',
        name: '陆观澜',
        title: '战地医师',
        unlockDungeonId: 'rust_hospital',
        recruitCost: { rewardPoints: 720, lingyun: 2, items: { medicine_ash: 2 } },
        trainingMaterial: 'medicine_ash',
        assistName: '紧急处置'
      }
    ]);
    expect(getCompanionDefinition('not_a_companion')).toBeUndefined();
  });

  it('uses the fixed per-rank training costs for each companion material', () => {
    for (const definition of COMPANION_CATALOG) {
      expect(getCompanionUpgradeCost(definition.id, 2)).toEqual({
        rewardPoints: 360,
        lingyun: 1,
        items: { [definition.trainingMaterial]: 1 }
      });
      expect(getCompanionUpgradeCost(definition.id, 3)).toEqual({
        rewardPoints: 680,
        lingyun: 2,
        items: { [definition.trainingMaterial]: 2 }
      });
    }
    expect(getCompanionUpgradeCost('qin_che', 1)).toBeUndefined();
    expect(getCompanionUpgradeCost('unknown', 2)).toBeUndefined();
  });
});

describe('companion roster progress', () => {
  it('unlocks each companion only after their authored dungeon clear', () => {
    expect(isCompanionUnlocked('qin_che', [])).toBe(false);
    expect(isCompanionUnlocked('qin_che', ['demon_tower_1'])).toBe(true);
    expect(isCompanionUnlocked('zhou_yingxue', ['dream_archive'])).toBe(true);
    expect(isCompanionUnlocked('lu_guanlan', ['rust_hospital'])).toBe(true);
    expect(isCompanionUnlocked('unknown', ['demon_tower_1'])).toBe(false);
  });

  it('reports locked, recruitable, and owned recruitment states', () => {
    const empty = createEmptyCompanionProgress();
    const owned = progress(['qin_che'], { qin_che: 1 });

    expect(getCompanionRecruitmentStatus('qin_che', empty, [])).toBe('locked');
    expect(getCompanionRecruitmentStatus('qin_che', empty, ['demon_tower_1'])).toBe('recruitable');
    expect(getCompanionRecruitmentStatus('qin_che', owned, [])).toBe('owned');
    expect(getCompanionRecruitmentStatus('unknown', empty, [])).toBeUndefined();
  });

  it('reports upgrade boundaries and exact next-rank costs', () => {
    expect(getCompanionUpgradeStatus('qin_che', createEmptyCompanionProgress())).toEqual({
      state: 'not_owned'
    });
    expect(getCompanionUpgradeStatus('qin_che', progress(['qin_che'], { qin_che: 1 }))).toEqual({
      state: 'upgradeable',
      currentRank: 1,
      targetRank: 2,
      cost: { rewardPoints: 360, lingyun: 1, items: { demon_bone: 1 } }
    });
    expect(getCompanionUpgradeStatus('qin_che', progress(['qin_che'], { qin_che: 2 }))).toEqual({
      state: 'upgradeable',
      currentRank: 2,
      targetRank: 3,
      cost: { rewardPoints: 680, lingyun: 2, items: { demon_bone: 2 } }
    });
    expect(getCompanionUpgradeStatus('qin_che', progress(['qin_che'], { qin_che: 3 }))).toEqual({
      state: 'max_rank',
      currentRank: 3
    });
  });

  it('normalizes progress by filtering malformed values and deduplicating owned ids', () => {
    expect(normalizeCompanionProgress({
      rulesVersion: 1,
      owned: ['qin_che', 'qin_che', 'unknown', 'zhou_yingxue', 'lu_guanlan'],
      ranks: { qin_che: 2, zhou_yingxue: 0, lu_guanlan: 3, unknown: 1 },
      active: 'zhou_yingxue'
    })).toEqual({
      rulesVersion: 1,
      owned: ['qin_che', 'lu_guanlan'],
      ranks: { qin_che: 2, lu_guanlan: 3 }
    });
  });

  it('returns empty progress for legacy or incompatible versions', () => {
    const empty = { rulesVersion: 1, owned: [], ranks: {} };

    expect(normalizeCompanionProgress(undefined)).toEqual(empty);
    expect(normalizeCompanionProgress({ owned: ['qin_che'], ranks: { qin_che: 1 } })).toEqual(empty);
    expect(normalizeCompanionProgress({
      rulesVersion: 2,
      owned: ['qin_che'],
      ranks: { qin_che: 1 },
      active: 'qin_che'
    })).toEqual(empty);
  });

  it('legalizes active only when the id is owned', () => {
    expect(normalizeActiveCompanion('qin_che', ['qin_che'])).toBe('qin_che');
    expect(normalizeActiveCompanion('zhou_yingxue', ['qin_che'])).toBeUndefined();
    expect(normalizeActiveCompanion('unknown', ['qin_che'])).toBeUndefined();
  });
});

describe('companion run snapshot and assists', () => {
  it('creates snapshots only from a legal active owned companion with a legal rank', () => {
    expect(createCompanionRunSnapshot(progress(['qin_che'], { qin_che: 2 }, 'qin_che'))).toEqual({
      rulesVersion: 1,
      companionId: 'qin_che',
      rank: 2
    });
    expect(createCompanionRunSnapshot(progress(['qin_che'], { qin_che: 2 }))).toBeUndefined();
    expect(createCompanionRunSnapshot({
      rulesVersion: 1,
      owned: ['qin_che'],
      ranks: { qin_che: 4 },
      active: 'qin_che'
    })).toBeUndefined();
  });

  it('freezes an existing run to its snapshot rank after roster changes', () => {
    const snapshot = createCompanionRunSnapshot(progress(['qin_che'], { qin_che: 1 }, 'qin_che'));
    const changedRoster = progress(
      ['qin_che', 'zhou_yingxue'],
      { qin_che: 3, zhou_yingxue: 2 },
      'zhou_yingxue'
    );

    expect(createCompanionRunSnapshot(changedRoster)).toEqual({
      rulesVersion: 1,
      companionId: 'zhou_yingxue',
      rank: 2
    });
    expect(getCompanionAssistEffect(snapshot)).toEqual({
      guarding: true,
      focusGain: 0,
      healPercent: 0
    });
  });

  it.each([
    ['qin_che', 1, true, 0, 0],
    ['qin_che', 2, true, 1, 0],
    ['qin_che', 3, true, 1, 8],
    ['zhou_yingxue', 1, false, 1, 0],
    ['zhou_yingxue', 2, false, 2, 0],
    ['zhou_yingxue', 3, false, 3, 0],
    ['lu_guanlan', 1, false, 0, 12],
    ['lu_guanlan', 2, false, 0, 18],
    ['lu_guanlan', 3, false, 0, 25]
  ] as const)('resolves %s R%s assist', (companionId, rank, guarding, focusGain, healPercent) => {
    expect(getCompanionAssistEffect({
      rulesVersion: 1,
      companionId,
      rank
    })).toEqual({ guarding, focusGain, healPercent });
  });

  it('rejects legacy and malformed snapshots without synthesizing from the current roster', () => {
    const current = progress(['lu_guanlan'], { lu_guanlan: 3 }, 'lu_guanlan');
    const none = { guarding: false, focusGain: 0, healPercent: 0 };

    expect(normalizeCompanionRunSnapshot(undefined)).toBeUndefined();
    expect(normalizeCompanionRunSnapshot({ companionId: 'lu_guanlan', rank: 3 })).toBeUndefined();
    expect(normalizeCompanionRunSnapshot({ rulesVersion: 2, companionId: 'lu_guanlan', rank: 3 })).toBeUndefined();
    expect(normalizeCompanionRunSnapshot({ rulesVersion: 1, companionId: 'unknown', rank: 3 })).toBeUndefined();
    expect(normalizeCompanionRunSnapshot({ rulesVersion: 1, companionId: 'lu_guanlan', rank: 4 })).toBeUndefined();
    expect(getCompanionAssistEffect(undefined)).toEqual(none);
    expect(getCompanionAssistStatus(undefined)).toEqual({ active: false, effect: none });
    expect(createCompanionRunSnapshot(current)).toBeDefined();
  });
});
