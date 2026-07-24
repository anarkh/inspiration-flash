import { describe, expect, it } from 'vitest';

import {
  METHOD_CULTIVATION_RULES_VERSION,
  METHOD_TECHNIQUE_CATALOG,
  METHOD_UPGRADE_COSTS,
  createMethodRunSnapshot,
  createMethodRunSnapshots,
  getMethodRank,
  getMethodTechniqueDefinition,
  getMethodTechniqueEffect,
  getMethodUpgradeCost,
  getMethodUpgradeStatus,
  isMethodRank,
  normalizeMethodCultivationProgress,
  normalizeMethodRunSnapshot,
  normalizeMethodRunSnapshots,
  type MethodCultivationProgress,
  type MethodRank,
  type MethodTechniqueEffect
} from './method-cultivation';

const METHOD_IDS = [
  'mist_breathing',
  'iron_body',
  'cloud_step',
  'gate_sense',
  'star_core_method',
  'beast_taming',
  'void_heart'
] as const;

function progress(
  ranks: MethodCultivationProgress['ranks'],
  activeMethod?: (typeof METHOD_IDS)[number]
): MethodCultivationProgress {
  return {
    rulesVersion: METHOD_CULTIVATION_RULES_VERSION,
    ranks,
    ...(activeMethod === undefined ? {} : { activeMethod })
  };
}

describe('method cultivation catalog', () => {
  it('defines all seven selected-method techniques and keeps the catalog deeply immutable', () => {
    expect(METHOD_CULTIVATION_RULES_VERSION).toBe(1);
    expect(METHOD_TECHNIQUE_CATALOG.map(({ methodId, name, requiresActivePet }) => ({
      methodId,
      name,
      requiresActivePet
    }))).toEqual([
      { methodId: 'mist_breathing', name: '归息', requiresActivePet: false },
      { methodId: 'iron_body', name: '镇岳', requiresActivePet: false },
      { methodId: 'cloud_step', name: '踏隙', requiresActivePet: false },
      { methodId: 'gate_sense', name: '定门', requiresActivePet: false },
      { methodId: 'star_core_method', name: '纳星', requiresActivePet: false },
      { methodId: 'beast_taming', name: '护主', requiresActivePet: true },
      { methodId: 'void_heart', name: '空明', requiresActivePet: false }
    ]);
    expect(METHOD_TECHNIQUE_CATALOG).toHaveLength(7);
    expect(new Set(METHOD_TECHNIQUE_CATALOG.map(({ methodId }) => methodId)).size).toBe(7);
    expect(Object.isFrozen(METHOD_TECHNIQUE_CATALOG)).toBe(true);

    for (const definition of METHOD_TECHNIQUE_CATALOG) {
      expect(Object.isFrozen(definition)).toBe(true);
      expect(Object.isFrozen(definition.effects)).toBe(true);
      expect(Object.values(definition.effects).every(Object.isFrozen)).toBe(true);
      expect(getMethodTechniqueDefinition(definition.methodId)).toBe(definition);
    }
    expect(getMethodTechniqueDefinition('unknown')).toBeUndefined();
  });

  it('uses the exact shared immutable R2 and R3 costs for every method', () => {
    expect(METHOD_UPGRADE_COSTS).toEqual({
      2: { rewardPoints: 420, lingyun: 1, items: { method_page: 1 } },
      3: { rewardPoints: 760, lingyun: 2, items: { method_page: 2 } }
    });
    expect(Object.isFrozen(METHOD_UPGRADE_COSTS)).toBe(true);

    for (const methodId of METHOD_IDS) {
      const rank2 = getMethodUpgradeCost(methodId, 2);
      const rank3 = getMethodUpgradeCost(methodId, 3);

      expect(rank2).toBe(METHOD_UPGRADE_COSTS[2]);
      expect(rank3).toBe(METHOD_UPGRADE_COSTS[3]);
      expect(Object.isFrozen(rank2)).toBe(true);
      expect(Object.isFrozen(rank2?.items)).toBe(true);
      expect(Object.isFrozen(rank3)).toBe(true);
      expect(Object.isFrozen(rank3?.items)).toBe(true);
    }
    expect(getMethodUpgradeCost('mist_breathing', 1)).toBeUndefined();
    expect(getMethodUpgradeCost('unknown', 2)).toBeUndefined();
    expect(getMethodUpgradeCost('mist_breathing', 4)).toBeUndefined();
  });
});

describe('method cultivation progress', () => {
  it('recognizes only the three legal ranks', () => {
    expect([1, 2, 3].every(isMethodRank)).toBe(true);
    expect([0, 4, 1.5, '2', Number.NaN].some(isMethodRank)).toBe(false);
  });

  it('normalizes legacy learned methods to R1 without inferring an active method', () => {
    expect(normalizeMethodCultivationProgress(
      ['mist_breathing', 'iron_body'],
      undefined
    )).toEqual({
      rulesVersion: 1,
      ranks: { mist_breathing: 1, iron_body: 1 }
    });
    expect(normalizeMethodCultivationProgress(
      ['mist_breathing'],
      { learnedMethods: ['mist_breathing'] }
    )).toEqual({
      rulesVersion: 1,
      ranks: { mist_breathing: 1 }
    });
  });

  it('deduplicates learned methods, defaults malformed ranks, and drops unknown or unlearned keys', () => {
    const normalized = normalizeMethodCultivationProgress(
      ['mist_breathing', 'mist_breathing', 'unknown', 'iron_body', 'void_heart'],
      {
        rulesVersion: 1,
        ranks: {
          mist_breathing: 2,
          iron_body: 0,
          void_heart: Number.NaN,
          gate_sense: 3,
          unknown: 3
        },
        activeMethod: 'mist_breathing'
      }
    );

    expect(normalized).toEqual({
      rulesVersion: 1,
      ranks: { mist_breathing: 2, iron_body: 1, void_heart: 1 },
      activeMethod: 'mist_breathing'
    });
    expect(Object.isFrozen(normalized)).toBe(true);
    expect(Object.isFrozen(normalized.ranks)).toBe(true);
  });

  it('treats a malformed learned-method list as empty progress', () => {
    expect(normalizeMethodCultivationProgress(
      'mist_breathing',
      { rulesVersion: 1, ranks: { mist_breathing: 3 }, activeMethod: 'mist_breathing' }
    )).toEqual({
      rulesVersion: 1,
      ranks: {}
    });
    expect(normalizeMethodCultivationProgress(null, null)).toEqual({
      rulesVersion: 1,
      ranks: {}
    });
  });

  it('resets incompatible rank data to R1 while retaining only an explicitly learned active method', () => {
    expect(normalizeMethodCultivationProgress(
      ['cloud_step'],
      { rulesVersion: 2, ranks: { cloud_step: 3 }, activeMethod: 'cloud_step' }
    )).toEqual({
      rulesVersion: 1,
      ranks: { cloud_step: 1 },
      activeMethod: 'cloud_step'
    });
    expect(normalizeMethodCultivationProgress(
      ['cloud_step'],
      { rulesVersion: 1, ranks: { cloud_step: 2 }, activeMethod: 'gate_sense' }
    )).toEqual({
      rulesVersion: 1,
      ranks: { cloud_step: 2 }
    });
    expect(normalizeMethodCultivationProgress(
      ['cloud_step'],
      { rulesVersion: 1, ranks: { cloud_step: 2 }, activeMethod: 'unknown' }
    )).toEqual({
      rulesVersion: 1,
      ranks: { cloud_step: 2 }
    });
  });

  it('reads ranks and reports exact upgrade boundaries', () => {
    const rank1 = progress({ mist_breathing: 1 });
    const rank2 = progress({ mist_breathing: 2 });
    const rank3 = progress({ mist_breathing: 3 });

    expect(getMethodRank('mist_breathing', rank2)).toBe(2);
    expect(getMethodRank('iron_body', rank2)).toBeUndefined();
    expect(getMethodRank('unknown', rank2)).toBeUndefined();
    expect(getMethodUpgradeStatus('mist_breathing', rank1)).toEqual({
      state: 'upgradeable',
      currentRank: 1,
      targetRank: 2,
      cost: { rewardPoints: 420, lingyun: 1, items: { method_page: 1 } }
    });
    expect(getMethodUpgradeStatus('mist_breathing', rank2)).toEqual({
      state: 'upgradeable',
      currentRank: 2,
      targetRank: 3,
      cost: { rewardPoints: 760, lingyun: 2, items: { method_page: 2 } }
    });
    expect(getMethodUpgradeStatus('mist_breathing', rank3)).toEqual({
      state: 'max_rank',
      currentRank: 3
    });
    expect(getMethodUpgradeStatus('iron_body', rank3)).toEqual({ state: 'not_learned' });
    expect(getMethodUpgradeStatus('unknown', rank3)).toBeUndefined();
  });
});

describe('method run snapshots and technique effects', () => {
  it('creates an immutable snapshot only for an explicitly active ranked method', () => {
    const snapshot = createMethodRunSnapshot(progress({ mist_breathing: 2 }, 'mist_breathing'));

    expect(snapshot).toEqual({ rulesVersion: 1, methodId: 'mist_breathing', rank: 2 });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(createMethodRunSnapshot(progress({ mist_breathing: 2 }))).toBeUndefined();
    expect(createMethodRunSnapshot({
      rulesVersion: 1,
      ranks: { mist_breathing: 4 },
      activeMethod: 'mist_breathing'
    })).toBeUndefined();
  });

  it('freezes every learned method and keeps the preferred method first without excluding the rest', () => {
    const snapshots = createMethodRunSnapshots(progress({
      mist_breathing: 2,
      iron_body: 1,
      void_heart: 3
    }, 'void_heart'));

    expect(snapshots).toEqual([
      { rulesVersion: 1, methodId: 'void_heart', rank: 3 },
      { rulesVersion: 1, methodId: 'mist_breathing', rank: 2 },
      { rulesVersion: 1, methodId: 'iron_body', rank: 1 }
    ]);
    expect(Object.isFrozen(snapshots)).toBe(true);
    expect(snapshots.every(Object.isFrozen)).toBe(true);
    expect(createMethodRunSnapshots(progress({}))).toEqual([]);
    expect(createMethodRunSnapshots({ rulesVersion: 2, ranks: { mist_breathing: 3 } })).toEqual([]);
  });

  it('strictly normalizes only exact current-version method snapshots', () => {
    const raw = { rulesVersion: 1, methodId: 'void_heart', rank: 3 };
    const normalized = normalizeMethodRunSnapshot(raw);

    expect(normalized).toEqual(raw);
    expect(normalized).not.toBe(raw);
    expect(Object.isFrozen(normalized)).toBe(true);
    expect(normalizeMethodRunSnapshot(undefined)).toBeUndefined();
    expect(normalizeMethodRunSnapshot({ methodId: 'void_heart', rank: 3 })).toBeUndefined();
    expect(normalizeMethodRunSnapshot({ rulesVersion: 2, methodId: 'void_heart', rank: 3 })).toBeUndefined();
    expect(normalizeMethodRunSnapshot({ rulesVersion: 1, methodId: 'unknown', rank: 3 })).toBeUndefined();
    expect(normalizeMethodRunSnapshot({ rulesVersion: 1, methodId: 'void_heart', rank: 4 })).toBeUndefined();
    expect(normalizeMethodRunSnapshot({ ...raw, used: false })).toBeUndefined();
  });

  it('strictly normalizes immutable, unique method snapshot collections', () => {
    const raw = [
      { rulesVersion: 1, methodId: 'iron_body', rank: 2 },
      { rulesVersion: 1, methodId: 'cloud_step', rank: 3 }
    ];
    const normalized = normalizeMethodRunSnapshots(raw);

    expect(normalized).toEqual(raw);
    expect(normalized).not.toBe(raw);
    expect(Object.isFrozen(normalized)).toBe(true);
    expect(normalized?.every(Object.isFrozen)).toBe(true);
    expect(normalizeMethodRunSnapshots([])).toEqual([]);
    expect(normalizeMethodRunSnapshots(raw[0])).toBeUndefined();
    expect(normalizeMethodRunSnapshots([...raw, raw[0]])).toBeUndefined();
    expect(normalizeMethodRunSnapshots([...raw, { ...raw[0], extra: true }])).toBeUndefined();
  });

  const expectedEffects: readonly (readonly [
    (typeof METHOD_IDS)[number],
    MethodRank,
    MethodTechniqueEffect
  ])[] = [
    ['mist_breathing', 1, { guarding: false, clearsRustPoison: false, clearsMirrorSlow: false, focusGain: 0, breathGain: 1, healPercent: 0 }],
    ['mist_breathing', 2, { guarding: false, clearsRustPoison: false, clearsMirrorSlow: false, focusGain: 0, breathGain: 1, healPercent: 6 }],
    ['mist_breathing', 3, { guarding: false, clearsRustPoison: false, clearsMirrorSlow: false, focusGain: 0, breathGain: 2, healPercent: 10 }],
    ['iron_body', 1, { guarding: true, clearsRustPoison: false, clearsMirrorSlow: false, focusGain: 0, breathGain: 0, healPercent: 0 }],
    ['iron_body', 2, { guarding: true, clearsRustPoison: true, clearsMirrorSlow: false, focusGain: 0, breathGain: 0, healPercent: 0 }],
    ['iron_body', 3, { guarding: true, clearsRustPoison: true, clearsMirrorSlow: false, focusGain: 0, breathGain: 0, healPercent: 8 }],
    ['cloud_step', 1, { guarding: false, clearsRustPoison: false, clearsMirrorSlow: true, focusGain: 1, breathGain: 0, healPercent: 0 }],
    ['cloud_step', 2, { guarding: false, clearsRustPoison: false, clearsMirrorSlow: true, focusGain: 2, breathGain: 0, healPercent: 0 }],
    ['cloud_step', 3, { guarding: false, clearsRustPoison: false, clearsMirrorSlow: true, focusGain: 3, breathGain: 0, healPercent: 0 }],
    ['gate_sense', 1, { guarding: false, clearsRustPoison: false, clearsMirrorSlow: false, focusGain: 1, breathGain: 0, healPercent: 0 }],
    ['gate_sense', 2, { guarding: false, clearsRustPoison: false, clearsMirrorSlow: false, focusGain: 2, breathGain: 0, healPercent: 0 }],
    ['gate_sense', 3, { guarding: false, clearsRustPoison: false, clearsMirrorSlow: false, focusGain: 3, breathGain: 0, healPercent: 0 }],
    ['star_core_method', 1, { guarding: false, clearsRustPoison: false, clearsMirrorSlow: false, focusGain: 0, breathGain: 1, healPercent: 4 }],
    ['star_core_method', 2, { guarding: false, clearsRustPoison: false, clearsMirrorSlow: false, focusGain: 0, breathGain: 2, healPercent: 8 }],
    ['star_core_method', 3, { guarding: false, clearsRustPoison: false, clearsMirrorSlow: false, focusGain: 0, breathGain: 3, healPercent: 12 }],
    ['beast_taming', 1, { guarding: true, clearsRustPoison: false, clearsMirrorSlow: false, focusGain: 0, breathGain: 0, healPercent: 0 }],
    ['beast_taming', 2, { guarding: true, clearsRustPoison: false, clearsMirrorSlow: false, focusGain: 1, breathGain: 0, healPercent: 0 }],
    ['beast_taming', 3, { guarding: true, clearsRustPoison: false, clearsMirrorSlow: false, focusGain: 2, breathGain: 0, healPercent: 8 }],
    ['void_heart', 1, { guarding: false, clearsRustPoison: true, clearsMirrorSlow: true, focusGain: 1, breathGain: 0, healPercent: 0 }],
    ['void_heart', 2, { guarding: false, clearsRustPoison: true, clearsMirrorSlow: true, focusGain: 2, breathGain: 0, healPercent: 6 }],
    ['void_heart', 3, { guarding: false, clearsRustPoison: true, clearsMirrorSlow: true, focusGain: 3, breathGain: 0, healPercent: 10 }]
  ];

  it.each(expectedEffects)(
    'resolves %s R%s exactly',
    (methodId, rank, expectedEffect) => {
      const effect = getMethodTechniqueEffect({
        rulesVersion: METHOD_CULTIVATION_RULES_VERSION,
        methodId,
        rank
      });

      expect(effect).toEqual(expectedEffect);
      expect(Object.isFrozen(effect)).toBe(true);
    }
  );

  it('returns no technique effect for legacy or malformed snapshots', () => {
    expect(getMethodTechniqueEffect(undefined)).toBeUndefined();
    expect(getMethodTechniqueEffect({ methodId: 'mist_breathing', rank: 3 })).toBeUndefined();
    expect(getMethodTechniqueEffect({ rulesVersion: 1, methodId: 'unknown', rank: 3 })).toBeUndefined();
  });
});
