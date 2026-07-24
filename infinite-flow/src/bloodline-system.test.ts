import { describe, expect, it } from 'vitest';

import {
  BLOODLINE_CATALOG,
  BLOODLINE_RULES_VERSION,
  BLOODLINE_UPGRADE_COSTS,
  createBloodlineRunSnapshot,
  createEmptyBloodlineProgress,
  getBloodlineDefinition,
  getBloodlineRank,
  getBloodlineStatBonus,
  getBloodlineSurgeEffect,
  getBloodlineUpgradeCost,
  getBloodlineUpgradeStatus,
  isBloodlineAspect,
  isBloodlineId,
  isBloodlineRank,
  normalizeBloodlineProgress,
  normalizeBloodlineRunSnapshot,
  type BloodlineAspect,
  type BloodlineId,
  type BloodlineProgress,
  type BloodlineRank,
  type BloodlineStatBonus,
  type BloodlineSurgeEffect
} from './bloodline-system';

const BLOODLINE_IDS = [
  'titan_marrow',
  'void_symbiote',
  'bastion_chitin',
  'phoenix_ember'
] as const satisfies readonly BloodlineId[];

function progress(
  ranks: BloodlineProgress['ranks'],
  active?: BloodlineId
): BloodlineProgress {
  return {
    rulesVersion: BLOODLINE_RULES_VERSION,
    ranks,
    ...(active === undefined ? {} : { active })
  };
}

describe('bloodline catalog and costs', () => {
  it('defines the four bloodlines with their fixed identities, titles, and aspects', () => {
    expect(BLOODLINE_RULES_VERSION).toBe(1);
    expect(BLOODLINE_CATALOG.map(({ id, name, title, aspect }) => ({
      id,
      name,
      title,
      aspect
    }))).toEqual([
      { id: 'titan_marrow', name: '巨灵骨髓', title: '力之始祖', aspect: 'force' },
      { id: 'void_symbiote', name: '虚界共生体', title: '术之共鸣', aspect: 'art' },
      { id: 'bastion_chitin', name: '界壁甲质', title: '守之原壳', aspect: 'guard' },
      { id: 'phoenix_ember', name: '涅槃余烬', title: '归返火种', aspect: 'renewal' }
    ]);
    expect(BLOODLINE_CATALOG).toHaveLength(4);
    expect(new Set(BLOODLINE_CATALOG.map(({ id }) => id)).size).toBe(4);

    for (const definition of BLOODLINE_CATALOG) {
      expect(getBloodlineDefinition(definition.id)).toBe(definition);
    }
    expect(getBloodlineDefinition('unknown')).toBeUndefined();
  });

  it('accepts only the authored ids, aspects, and ranks', () => {
    expect(BLOODLINE_IDS.every(isBloodlineId)).toBe(true);
    expect(['force', 'art', 'guard', 'renewal'].every(isBloodlineAspect)).toBe(true);
    expect([1, 2, 3].every(isBloodlineRank)).toBe(true);
    expect(['unknown', '', null, undefined].some(isBloodlineId)).toBe(false);
    expect(['damage', '', null, undefined].some(isBloodlineAspect)).toBe(false);
    expect([0, 4, 1.5, '2', Number.NaN].some(isBloodlineRank)).toBe(false);
  });

  it('uses the exact shared R1, R2, and R3 costs for every bloodline', () => {
    expect(BLOODLINE_UPGRADE_COSTS).toEqual({
      1: { rewardPoints: 800, lingyun: 2 },
      2: { rewardPoints: 1200, lingyun: 3, items: { genesis_serum: 1 } },
      3: { rewardPoints: 1800, lingyun: 4, items: { genesis_serum: 2 } }
    });

    for (const bloodlineId of BLOODLINE_IDS) {
      expect(getBloodlineUpgradeCost(bloodlineId, 1)).toBe(BLOODLINE_UPGRADE_COSTS[1]);
      expect(getBloodlineUpgradeCost(bloodlineId, 2)).toBe(BLOODLINE_UPGRADE_COSTS[2]);
      expect(getBloodlineUpgradeCost(bloodlineId, 3)).toBe(BLOODLINE_UPGRADE_COSTS[3]);
    }
    expect(getBloodlineUpgradeCost('unknown', 1)).toBeUndefined();
    expect(getBloodlineUpgradeCost('titan_marrow', 4)).toBeUndefined();
  });
});

describe('bloodline progress', () => {
  it('creates a deeply immutable empty progress value', () => {
    const empty = createEmptyBloodlineProgress();

    expect(empty).toEqual({ rulesVersion: 1, ranks: {} });
    expect(createEmptyBloodlineProgress()).toBe(empty);
    expect(Object.isFrozen(empty)).toBe(true);
    expect(Object.isFrozen(empty.ranks)).toBe(true);
  });

  it('keeps four independently ranked bloodlines while allowing only one active bloodline', () => {
    const normalized = normalizeBloodlineProgress({
      rulesVersion: 1,
      ranks: {
        titan_marrow: 1,
        void_symbiote: 3,
        bastion_chitin: 2,
        phoenix_ember: 1
      },
      active: 'void_symbiote'
    });

    expect(normalized).toEqual({
      rulesVersion: 1,
      ranks: {
        titan_marrow: 1,
        void_symbiote: 3,
        bastion_chitin: 2,
        phoenix_ember: 1
      },
      active: 'void_symbiote'
    });
    expect(Object.isFrozen(normalized)).toBe(true);
    expect(Object.isFrozen(normalized.ranks)).toBe(true);
  });

  it('drops unknown ids and illegal ranks without discarding valid independent progress', () => {
    expect(normalizeBloodlineProgress({
      rulesVersion: 1,
      ranks: {
        titan_marrow: 2,
        void_symbiote: 0,
        bastion_chitin: 4,
        phoenix_ember: 3,
        unknown: 1
      },
      active: 'phoenix_ember'
    })).toEqual({
      rulesVersion: 1,
      ranks: { titan_marrow: 2, phoenix_ember: 3 },
      active: 'phoenix_ember'
    });
  });

  it('keeps active only when that exact bloodline has a legal owned rank', () => {
    expect(normalizeBloodlineProgress({
      rulesVersion: 1,
      ranks: { titan_marrow: 1 },
      active: 'void_symbiote'
    })).toEqual({ rulesVersion: 1, ranks: { titan_marrow: 1 } });
    expect(normalizeBloodlineProgress({
      rulesVersion: 1,
      ranks: { titan_marrow: 0 },
      active: 'titan_marrow'
    })).toEqual({ rulesVersion: 1, ranks: {} });
    expect(normalizeBloodlineProgress({
      rulesVersion: 1,
      ranks: { titan_marrow: 1 },
      active: 'unknown'
    })).toEqual({ rulesVersion: 1, ranks: { titan_marrow: 1 } });
  });

  it.each([
    undefined,
    null,
    'legacy',
    [],
    { ranks: { titan_marrow: 3 }, active: 'titan_marrow' },
    { rulesVersion: 0, ranks: { titan_marrow: 3 }, active: 'titan_marrow' },
    { rulesVersion: 2, ranks: { titan_marrow: 3 }, active: 'titan_marrow' },
    { rulesVersion: 1, ranks: null, active: 'titan_marrow' }
  ])('normalizes malformed or legacy progress %# to empty progress', (value) => {
    expect(normalizeBloodlineProgress(value)).toBe(createEmptyBloodlineProgress());
  });

  it('reads ranks and distinguishes unlock, upgrade, and max-rank boundaries', () => {
    const empty = createEmptyBloodlineProgress();
    const rank1 = progress({ titan_marrow: 1 });
    const rank2 = progress({ titan_marrow: 2 });
    const rank3 = progress({ titan_marrow: 3 });

    expect(getBloodlineRank('titan_marrow', rank2)).toBe(2);
    expect(getBloodlineRank('void_symbiote', rank2)).toBeUndefined();
    expect(getBloodlineRank('unknown', rank2)).toBeUndefined();
    expect(getBloodlineUpgradeStatus('titan_marrow', empty)).toEqual({
      state: 'unlockable',
      targetRank: 1,
      cost: { rewardPoints: 800, lingyun: 2 }
    });
    expect(getBloodlineUpgradeStatus('titan_marrow', rank1)).toEqual({
      state: 'upgradeable',
      currentRank: 1,
      targetRank: 2,
      cost: { rewardPoints: 1200, lingyun: 3, items: { genesis_serum: 1 } }
    });
    expect(getBloodlineUpgradeStatus('titan_marrow', rank2)).toEqual({
      state: 'upgradeable',
      currentRank: 2,
      targetRank: 3,
      cost: { rewardPoints: 1800, lingyun: 4, items: { genesis_serum: 2 } }
    });
    expect(getBloodlineUpgradeStatus('titan_marrow', rank3)).toEqual({
      state: 'max_rank',
      currentRank: 3
    });
    expect(getBloodlineUpgradeStatus('unknown', rank3)).toBeUndefined();
    expect(Object.isFrozen(getBloodlineUpgradeStatus('titan_marrow', rank1))).toBe(true);
  });
});

describe('bloodline run snapshots', () => {
  it('creates an exact immutable snapshot only from a legal active ranked bloodline', () => {
    const snapshot = createBloodlineRunSnapshot(progress(
      { titan_marrow: 1, void_symbiote: 2 },
      'void_symbiote'
    ));

    expect(snapshot).toEqual({
      rulesVersion: 1,
      bloodlineId: 'void_symbiote',
      aspect: 'art',
      rank: 2
    });
    expect(Object.keys(snapshot!)).toEqual(['rulesVersion', 'bloodlineId', 'aspect', 'rank']);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(createBloodlineRunSnapshot(progress({ void_symbiote: 2 }))).toBeUndefined();
    expect(createBloodlineRunSnapshot({
      rulesVersion: 1,
      ranks: { void_symbiote: 4 },
      active: 'void_symbiote'
    })).toBeUndefined();
  });

  it('freezes a run rank and aspect instead of reading later hub progress', () => {
    const mutableHub = {
      rulesVersion: 1,
      ranks: { titan_marrow: 1, phoenix_ember: 2 },
      active: 'titan_marrow'
    };
    const snapshot = createBloodlineRunSnapshot(mutableHub);

    mutableHub.ranks.titan_marrow = 3;
    mutableHub.active = 'phoenix_ember';

    expect(snapshot).toEqual({
      rulesVersion: 1,
      bloodlineId: 'titan_marrow',
      aspect: 'force',
      rank: 1
    });
    expect(getBloodlineSurgeEffect(snapshot)).toEqual({
      forceDamage: 18,
      artDamage: 0,
      barrier: 0,
      healPercent: 0
    });
  });

  it('normalizes only exact current-version snapshots with the catalog aspect', () => {
    const raw = {
      rulesVersion: 1,
      bloodlineId: 'bastion_chitin',
      aspect: 'guard',
      rank: 3
    };
    const normalized = normalizeBloodlineRunSnapshot(raw);

    expect(normalized).toEqual(raw);
    expect(normalized).not.toBe(raw);
    expect(Object.isFrozen(normalized)).toBe(true);
    expect(normalizeBloodlineRunSnapshot(undefined)).toBeUndefined();
    expect(normalizeBloodlineRunSnapshot({
      bloodlineId: 'bastion_chitin',
      aspect: 'guard',
      rank: 3
    })).toBeUndefined();
    expect(normalizeBloodlineRunSnapshot({ ...raw, rulesVersion: 2 })).toBeUndefined();
    expect(normalizeBloodlineRunSnapshot({ ...raw, bloodlineId: 'unknown' })).toBeUndefined();
    expect(normalizeBloodlineRunSnapshot({ ...raw, aspect: 'force' })).toBeUndefined();
    expect(normalizeBloodlineRunSnapshot({ ...raw, rank: 4 })).toBeUndefined();
    expect(normalizeBloodlineRunSnapshot({ ...raw, used: false })).toBeUndefined();
    expect(normalizeBloodlineRunSnapshot({
      rulesVersion: 1,
      bloodlineId: 'bastion_chitin',
      aspect: 'guard'
    })).toBeUndefined();
  });
});

const EXPECTED_STAT_BONUSES: readonly (readonly [
  BloodlineId,
  BloodlineAspect,
  BloodlineRank,
  BloodlineStatBonus
])[] = [
  ['titan_marrow', 'force', 1, { attack: 6, maxHp: 12 }],
  ['titan_marrow', 'force', 2, { attack: 12, maxHp: 24 }],
  ['titan_marrow', 'force', 3, { attack: 20, maxHp: 40 }],
  ['void_symbiote', 'art', 1, { spirit: 1, artPower: 8 }],
  ['void_symbiote', 'art', 2, { spirit: 2, artPower: 16 }],
  ['void_symbiote', 'art', 3, { spirit: 3, artPower: 26 }],
  ['bastion_chitin', 'guard', 1, { defense: 4, maxHp: 18 }],
  ['bastion_chitin', 'guard', 2, { defense: 8, maxHp: 36 }],
  ['bastion_chitin', 'guard', 3, { defense: 13, maxHp: 56 }],
  ['phoenix_ember', 'renewal', 1, { maxHp: 12, speed: 2 }],
  ['phoenix_ember', 'renewal', 2, { maxHp: 24, speed: 4 }],
  ['phoenix_ember', 'renewal', 3, { maxHp: 36, speed: 6 }]
];

const EXPECTED_SURGE_EFFECTS: readonly (readonly [
  BloodlineId,
  BloodlineAspect,
  BloodlineRank,
  BloodlineSurgeEffect
])[] = [
  ['titan_marrow', 'force', 1, { forceDamage: 18, artDamage: 0, barrier: 0, healPercent: 0 }],
  ['titan_marrow', 'force', 2, { forceDamage: 30, artDamage: 0, barrier: 0, healPercent: 0 }],
  ['titan_marrow', 'force', 3, { forceDamage: 44, artDamage: 0, barrier: 0, healPercent: 0 }],
  ['void_symbiote', 'art', 1, { forceDamage: 0, artDamage: 20, barrier: 0, healPercent: 0 }],
  ['void_symbiote', 'art', 2, { forceDamage: 0, artDamage: 34, barrier: 0, healPercent: 0 }],
  ['void_symbiote', 'art', 3, { forceDamage: 0, artDamage: 50, barrier: 0, healPercent: 0 }],
  ['bastion_chitin', 'guard', 1, { forceDamage: 0, artDamage: 0, barrier: 20, healPercent: 0 }],
  ['bastion_chitin', 'guard', 2, { forceDamage: 0, artDamage: 0, barrier: 34, healPercent: 0 }],
  ['bastion_chitin', 'guard', 3, { forceDamage: 0, artDamage: 0, barrier: 50, healPercent: 0 }],
  ['phoenix_ember', 'renewal', 1, { forceDamage: 0, artDamage: 0, barrier: 0, healPercent: 12 }],
  ['phoenix_ember', 'renewal', 2, { forceDamage: 0, artDamage: 0, barrier: 0, healPercent: 18 }],
  ['phoenix_ember', 'renewal', 3, { forceDamage: 0, artDamage: 0, barrier: 0, healPercent: 25 }]
];

describe('bloodline combat data', () => {
  it.each(EXPECTED_STAT_BONUSES)(
    'returns the exact immutable %s R%s persistent stat bonus',
    (bloodlineId, aspect, rank, expected) => {
      const snapshot = { rulesVersion: 1, bloodlineId, aspect, rank };
      const bonus = getBloodlineStatBonus(snapshot);

      expect(bonus).toEqual(expected);
      expect(bonus).toBe(getBloodlineDefinition(bloodlineId)!.statBonuses[rank]);
      expect(Object.isFrozen(bonus)).toBe(true);
    }
  );

  it.each(EXPECTED_SURGE_EFFECTS)(
    'returns the exact immutable %s R%s once-per-battle surge effect',
    (bloodlineId, aspect, rank, expected) => {
      const snapshot = { rulesVersion: 1, bloodlineId, aspect, rank };
      const effect = getBloodlineSurgeEffect(snapshot);

      expect(effect).toEqual(expected);
      expect(effect).toBe(getBloodlineDefinition(bloodlineId)!.surgeEffects[rank]);
      expect(Object.isFrozen(effect)).toBe(true);
    }
  );

  it('keeps the catalog, costs, rank tables, bonuses, and effects deeply immutable', () => {
    expect(Object.isFrozen(BLOODLINE_CATALOG)).toBe(true);
    expect(Object.isFrozen(BLOODLINE_UPGRADE_COSTS)).toBe(true);

    for (const cost of Object.values(BLOODLINE_UPGRADE_COSTS)) {
      expect(Object.isFrozen(cost)).toBe(true);
      if (cost.items !== undefined) expect(Object.isFrozen(cost.items)).toBe(true);
    }
    for (const definition of BLOODLINE_CATALOG) {
      expect(Object.isFrozen(definition)).toBe(true);
      expect(Object.isFrozen(definition.statBonuses)).toBe(true);
      expect(Object.values(definition.statBonuses).every(Object.isFrozen)).toBe(true);
      expect(Object.isFrozen(definition.surgeEffects)).toBe(true);
      expect(Object.values(definition.surgeEffects).every(Object.isFrozen)).toBe(true);
    }
  });

  it('returns no combat data for malformed or legacy snapshots', () => {
    expect(getBloodlineStatBonus(undefined)).toBeUndefined();
    expect(getBloodlineSurgeEffect(undefined)).toBeUndefined();
    expect(getBloodlineStatBonus({
      bloodlineId: 'titan_marrow',
      aspect: 'force',
      rank: 3
    })).toBeUndefined();
    expect(getBloodlineSurgeEffect({
      rulesVersion: 1,
      bloodlineId: 'titan_marrow',
      aspect: 'art',
      rank: 3
    })).toBeUndefined();
  });
});
