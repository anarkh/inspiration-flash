import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_RUN_RELIC_EFFECTS,
  RUN_RELIC_DEFINITIONS,
  RUN_RELIC_DRAFT_CANDIDATE_COUNTS,
  RUN_RELIC_EFFECT_STACKING,
  RUN_RELIC_FRAME_DEFINITIONS,
  RUN_RELIC_FRAMES,
  RUN_RELIC_IDS,
  RUN_RELIC_IDS_BY_FRAME,
  aggregateRunRelicEffects,
  archiveRunRelicState,
  createRunRelicState,
  deriveRunRelicSeed,
  generateRunRelicDraft,
  isRunRelicId,
  isRunRelicState,
  isValidRunRelicSeed,
  normalizeRunRelicState,
  selectRunRelic,
  stableRunRelicHash,
  type RunRelicFrame,
  type RunRelicId
} from './run-relics';

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('run relic definitions and effects', () => {
  it('defines exactly three unique relics for each complete frame', () => {
    expect(RUN_RELIC_FRAMES).toEqual(['assault', 'bulwark', 'wayfinder']);
    expect(RUN_RELIC_FRAME_DEFINITIONS).toEqual({
      assault: { id: 'assault', name: '强攻' },
      bulwark: { id: 'bulwark', name: '守御' },
      wayfinder: { id: 'wayfinder', name: '寻路' }
    });
    expect(RUN_RELIC_IDS).toHaveLength(9);
    expect(new Set(RUN_RELIC_IDS).size).toBe(9);
    expect(Object.keys(RUN_RELIC_DEFINITIONS)).toEqual([...RUN_RELIC_IDS]);

    const idsFromFrames = RUN_RELIC_FRAMES.flatMap((frame) => [...RUN_RELIC_IDS_BY_FRAME[frame]]);
    expect(idsFromFrames).toHaveLength(9);
    expect(new Set(idsFromFrames)).toEqual(new Set(RUN_RELIC_IDS));

    for (const frame of RUN_RELIC_FRAMES) {
      expect(RUN_RELIC_IDS_BY_FRAME[frame]).toHaveLength(3);
      for (const relicId of RUN_RELIC_IDS_BY_FRAME[frame]) {
        expect(RUN_RELIC_DEFINITIONS[relicId]).toMatchObject({ id: relicId, frame });
      }
    }
  });

  it('encodes all nine requested rule contributions exactly', () => {
    expect(RUN_RELIC_DEFINITIONS.mist_edge.effects).toEqual({
      statBonuses: { attack: 6, artPower: 4 }
    });
    expect(RUN_RELIC_DEFINITIONS.focus_prism.effects).toEqual({ combatStartFocusBonus: 1 });
    expect(RUN_RELIC_DEFINITIONS.hunter_clock.effects).toEqual({
      combatRewardPointsBonusPercent: 20
    });
    expect(RUN_RELIC_DEFINITIONS.bone_shell.effects).toEqual({ statBonuses: { defense: 4 } });
    expect(RUN_RELIC_DEFINITIONS.mending_thread.effects).toEqual({ rewardNodeHealing: 12 });
    expect(RUN_RELIC_DEFINITIONS.iron_echo.effects).toEqual({ trapDamageReductionPercent: 25 });
    expect(RUN_RELIC_DEFINITIONS.rift_step.effects).toEqual({
      statBonuses: { speed: 4, trapCheck: 4 }
    });
    expect(RUN_RELIC_DEFINITIONS.gate_anchor.effects).toEqual({
      forcedPortalBacklashReductionPercent: 35
    });
    expect(RUN_RELIC_DEFINITIONS.lucky_map.effects).toEqual({
      rewardNodeRewardPointsBonusPercent: 20
    });
  });

  it('publishes identity defaults and aggregates additive percentages into bounded multipliers', () => {
    expect(aggregateRunRelicEffects([])).toEqual(DEFAULT_RUN_RELIC_EFFECTS);
    expect(RUN_RELIC_EFFECT_STACKING).toEqual({
      duplicateRelicsStack: false,
      percentageBonuses: 'additive',
      percentageReductions: 'additive',
      maximumReductionPercent: 100
    });
    expect(RUN_RELIC_DRAFT_CANDIDATE_COUNTS).toEqual({
      ordinary: 2,
      matchingEquipmentConduit: 3
    });

    const allEffects = aggregateRunRelicEffects(RUN_RELIC_IDS);
    expect(allEffects).toEqual({
      statBonuses: { attack: 6, artPower: 4, defense: 4, speed: 4, trapCheck: 4 },
      combatStartFocusBonus: 1,
      combatRewardPointsBonusPercent: 20,
      combatRewardPointsMultiplier: 1.2,
      rewardNodeHealing: 12,
      trapDamageReductionPercent: 25,
      trapDamageMultiplier: 0.75,
      forcedPortalBacklashReductionPercent: 35,
      forcedPortalBacklashMultiplier: 0.65,
      rewardNodeRewardPointsBonusPercent: 20,
      rewardNodeRewardPointsMultiplier: 1.2
    });
    expect(Object.keys(allEffects).filter((key) => key === 'rewardNodeRewardPointsBonusPercent')).toEqual([
      'rewardNodeRewardPointsBonusPercent'
    ]);
  });

  it('does not stack duplicate relic IDs and ignores malformed IDs without mutating the list', () => {
    const relicIds = ['mist_edge', 'mist_edge', 'hunter_clock', 'unknown'] as const;
    const before = [...relicIds];

    expect(aggregateRunRelicEffects(relicIds)).toMatchObject({
      statBonuses: { attack: 6, artPower: 4, defense: 0, speed: 0, trapCheck: 0 },
      combatRewardPointsBonusPercent: 20,
      combatRewardPointsMultiplier: 1.2
    });
    expect(relicIds).toEqual(before);
  });
});

describe('run relic state and deterministic drafts', () => {
  it('creates versioned states with a readonly frame and separately validated roll and relic seeds', () => {
    expect(createRunRelicState('assault')).toEqual({
      rulesVersion: 1,
      frame: 'assault',
      acquiredIds: [],
      processedDraftIds: []
    });
    expect(createRunRelicState('wayfinder', 0xffffffff)).toEqual({
      rulesVersion: 1,
      frame: 'wayfinder',
      seed: 0xffffffff,
      acquiredIds: [],
      processedDraftIds: []
    });
    expect(createRunRelicState('wayfinder', 17, 'lucky_map')).toEqual({
      rulesVersion: 1,
      frame: 'wayfinder',
      seed: 17,
      seedRelicId: 'lucky_map',
      acquiredIds: [],
      processedDraftIds: []
    });

    for (const seed of [0, -1, 1.5, 0x100000000, Number.NaN]) {
      expect(() => createRunRelicState('assault', seed)).toThrow(TypeError);
    }
    expect(() => createRunRelicState('invalid' as RunRelicFrame)).toThrow(TypeError);
    expect(() => createRunRelicState('assault', 1, 'bone_shell')).toThrow(TypeError);
    expect(() => createRunRelicState('assault', 1, 'unknown' as RunRelicId)).toThrow(TypeError);
  });

  it('uses a stable hash and derives legal non-zero first-draft seeds without Math.random', () => {
    expect(stableRunRelicHash('hello')).toBe(1335831723);
    expect(stableRunRelicHash('hello')).toBe(stableRunRelicHash('hello'));

    const state = createRunRelicState('assault');
    const request = { draftId: 'draft:first', nodeId: 'reward:first' };
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be used');
    });

    try {
      const first = generateRunRelicDraft(state, request);
      const repeated = generateRunRelicDraft(state, request);
      expect(first).toEqual(repeated);
      expect(first.seed).toBe(deriveRunRelicSeed('assault', request.draftId, request.nodeId));
      expect(isValidRunRelicSeed(first.seed)).toBe(true);
      expect(isRunRelicState(first)).toBe(true);
    } finally {
      random.mockRestore();
    }
  });

  it('offers two ordinary candidates and all three remaining candidates for a matching conduit', () => {
    const ordinary = generateRunRelicDraft(createRunRelicState('bulwark', 42), {
      draftId: 'draft:ordinary',
      nodeId: 'reward:ordinary'
    });
    const expanded = generateRunRelicDraft(createRunRelicState('bulwark', 42), {
      draftId: 'draft:expanded',
      nodeId: 'reward:expanded',
      matchingEquipmentConduit: true
    });

    expect(ordinary.pendingDraft?.candidateIds).toHaveLength(2);
    expect(expanded.pendingDraft?.candidateIds).toHaveLength(3);
    expect(new Set(expanded.pendingDraft?.candidateIds)).toEqual(new Set(RUN_RELIC_IDS_BY_FRAME.bulwark));
    expect(ordinary.pendingDraft?.candidateIds.every((id) => RUN_RELIC_DEFINITIONS[id].frame === 'bulwark')).toBe(true);
  });

  it('places the archived relic seed first while preserving ordinary and conduit candidate limits', () => {
    const ordinarySource = createRunRelicState('assault', 42, 'hunter_clock');
    const ordinaryBefore = jsonClone(ordinarySource);
    const ordinary = generateRunRelicDraft(ordinarySource, {
      draftId: 'draft:seeded-ordinary',
      nodeId: 'reward:seeded-ordinary'
    });
    const expanded = generateRunRelicDraft(createRunRelicState('assault', 42, 'hunter_clock'), {
      draftId: 'draft:seeded-expanded',
      nodeId: 'reward:seeded-expanded',
      matchingEquipmentConduit: true
    });

    expect(ordinary.pendingDraft?.candidateIds).toHaveLength(2);
    expect(ordinary.pendingDraft?.candidateIds[0]).toBe('hunter_clock');
    expect(expanded.pendingDraft?.candidateIds).toHaveLength(3);
    expect(expanded.pendingDraft?.candidateIds[0]).toBe('hunter_clock');
    expect(new Set(expanded.pendingDraft?.candidateIds)).toEqual(new Set(RUN_RELIC_IDS_BY_FRAME.assault));
    expect(ordinarySource).toEqual(ordinaryBefore);
  });

  it('does not prioritize the relic seed after the first draft is processed', () => {
    const firstDraft = generateRunRelicDraft(createRunRelicState('assault', 123, 'mist_edge'), {
      draftId: 'draft:first-seeded',
      nodeId: 'reward:first-seeded'
    });
    const firstCandidates = firstDraft.pendingDraft?.candidateIds;
    if (!firstCandidates?.[1]) throw new Error('Expected the seed relic plus an ordinary candidate');
    const selected = selectRunRelic(firstDraft, 'draft:first-seeded', firstCandidates[1]);
    const baseline = normalizeRunRelicState({ ...selected, seedRelicId: 'bone_shell' }, 'assault');

    let request: { draftId: string; nodeId: string } | undefined;
    let baselineCandidateIds: readonly RunRelicId[] | undefined;
    for (let index = 0; index < 100; index += 1) {
      const candidateRequest = { draftId: `draft:second:${index}`, nodeId: `reward:second:${index}` };
      const candidateIds = generateRunRelicDraft(baseline, candidateRequest).pendingDraft?.candidateIds;
      if (candidateIds?.[0] !== 'mist_edge') {
        request = candidateRequest;
        baselineCandidateIds = candidateIds;
        break;
      }
    }
    if (!request || !baselineCandidateIds) throw new Error('Expected a deterministic non-seed-first draft');

    const secondDraft = generateRunRelicDraft(selected, request);
    expect(secondDraft.pendingDraft?.candidateIds).toEqual(baselineCandidateIds);
    expect(secondDraft.pendingDraft?.candidateIds[0]).not.toBe('mist_edge');
    expect(selected.seedRelicId).toBe('mist_edge');
  });

  it('never repeats acquired relics and shrinks drafts when the frame pool is exhausted', () => {
    let state = createRunRelicState('wayfinder', 77);
    const candidateCounts: number[] = [];

    for (let index = 0; index < 3; index += 1) {
      state = generateRunRelicDraft(state, {
        draftId: `draft:${index}`,
        nodeId: `reward:${index}`,
        matchingEquipmentConduit: true
      });
      const pending = state.pendingDraft;
      if (!pending) throw new Error('Expected a pending relic draft');
      candidateCounts.push(pending.candidateIds.length);
      expect(pending.candidateIds.some((id) => state.acquiredIds.includes(id))).toBe(false);
      state = selectRunRelic(state, pending.draftId, pending.candidateIds[0]);
    }

    expect(candidateCounts).toEqual([3, 2, 1]);
    expect(state.acquiredIds).toHaveLength(3);
    expect(new Set(state.acquiredIds).size).toBe(3);
    expect(state.frame).toBe('wayfinder');

    const exhausted = generateRunRelicDraft(state, {
      draftId: 'draft:exhausted',
      nodeId: 'reward:exhausted',
      matchingEquipmentConduit: true
    });
    expect(exhausted).toBe(state);
  });

  it('does not overwrite pending drafts or reopen processed draft IDs', () => {
    const pending = generateRunRelicDraft(createRunRelicState('assault', 99), {
      draftId: 'draft:one',
      nodeId: 'reward:one'
    });
    const whilePending = generateRunRelicDraft(pending, {
      draftId: 'draft:two',
      nodeId: 'reward:two'
    });
    expect(whilePending).toBe(pending);

    const candidate = pending.pendingDraft?.candidateIds[0];
    if (!candidate) throw new Error('Expected a candidate');
    const selected = selectRunRelic(pending, 'draft:one', candidate);
    expect(generateRunRelicDraft(selected, {
      draftId: 'draft:one',
      nodeId: 'reward:one'
    })).toBe(selected);
  });

  it('leaves the input untouched for invalid requests, invalid choices, and repeated choices', () => {
    const initial = createRunRelicState('assault', 123);
    expect(generateRunRelicDraft(initial, { draftId: '', nodeId: 'reward' })).toBe(initial);
    expect(generateRunRelicDraft(initial, { draftId: 'draft', nodeId: '   ' })).toBe(initial);

    const pending = generateRunRelicDraft(initial, { draftId: 'draft', nodeId: 'reward' });
    const before = jsonClone(pending);
    const offered = pending.pendingDraft?.candidateIds ?? [];
    const notOffered = RUN_RELIC_IDS_BY_FRAME.assault.find((id) => !offered.includes(id));
    if (!offered[0] || !notOffered) throw new Error('Expected ordinary draft fixtures');

    expect(selectRunRelic(pending, 'wrong-draft', offered[0])).toBe(pending);
    expect(selectRunRelic(pending, 'draft', notOffered)).toBe(pending);
    expect(selectRunRelic(pending, 'draft', 'unknown')).toBe(pending);
    expect(pending).toEqual(before);

    const selected = selectRunRelic(pending, 'draft', offered[0]);
    expect(selected).not.toBe(pending);
    expect(selected).toEqual({
      rulesVersion: 1,
      frame: 'assault',
      seed: 123,
      acquiredIds: [offered[0]],
      processedDraftIds: ['draft']
    });
    expect(selectRunRelic(selected, 'draft', offered[0])).toBe(selected);
    expect(pending).toEqual(before);
  });
});

describe('run relic persistence boundaries', () => {
  it('survives a JSON roundtrip with both seed kinds and preserves its frozen frame', () => {
    const firstDraft = generateRunRelicDraft(createRunRelicState('bulwark', undefined, 'mending_thread'), {
      draftId: 'draft:one',
      nodeId: 'reward:one'
    });
    const firstChoice = firstDraft.pendingDraft?.candidateIds[0];
    if (!firstChoice) throw new Error('Expected a first candidate');

    const selected = selectRunRelic(firstDraft, 'draft:one', firstChoice);
    const secondDraft = generateRunRelicDraft(selected, {
      draftId: 'draft:two',
      nodeId: 'reward:two',
      matchingEquipmentConduit: true
    });
    const parsed: unknown = JSON.parse(JSON.stringify(secondDraft));

    expect(isRunRelicState(parsed)).toBe(true);
    expect(normalizeRunRelicState(parsed, 'bulwark')).toEqual(secondDraft);
    expect(normalizeRunRelicState(parsed, 'bulwark').frame).toBe('bulwark');
    expect(normalizeRunRelicState(parsed, 'bulwark').seedRelicId).toBe('mending_thread');
  });

  it('repairs malformed arrays, IDs, versions, seeds, and pending drafts without changing the source', () => {
    const malformed = {
      rulesVersion: 9,
      frame: 'bulwark',
      seed: 0,
      seedRelicId: 'mist_edge',
      acquiredIds: ['bone_shell', 'bone_shell', 'mist_edge', null],
      processedDraftIds: ['draft:done', 'draft:done', '', 7],
      pendingDraft: {
        draftId: 'draft:next',
        nodeId: 'reward:next',
        candidateIds: [
          'mending_thread',
          'mending_thread',
          'bone_shell',
          'iron_echo',
          'mist_edge',
          'lucky_map'
        ]
      }
    };
    const before = jsonClone(malformed);
    const normalized = normalizeRunRelicState(malformed, 'bulwark');

    expect(isRunRelicState(malformed)).toBe(false);
    expect(normalized).toEqual({
      rulesVersion: 1,
      frame: 'bulwark',
      seed: deriveRunRelicSeed('bulwark', 'draft:next', 'reward:next'),
      acquiredIds: ['bone_shell'],
      processedDraftIds: ['draft:done'],
      pendingDraft: {
        draftId: 'draft:next',
        nodeId: 'reward:next',
        candidateIds: ['mending_thread', 'iron_echo']
      }
    });
    expect(isRunRelicState(normalized)).toBe(true);
    expect(malformed).toEqual(before);
  });

  it('uses the expected frame as the immutable authority and discards conflicting pending work', () => {
    const normalized = normalizeRunRelicState({
      rulesVersion: 1,
      frame: 'wayfinder',
      seed: 123,
      seedRelicId: 'rift_step',
      acquiredIds: ['rift_step', 'mist_edge'],
      processedDraftIds: ['draft:done'],
      pendingDraft: {
        draftId: 'draft:done',
        nodeId: 'reward',
        candidateIds: ['gate_anchor']
      }
    }, 'assault');

    expect(normalized).toEqual({
      rulesVersion: 1,
      frame: 'assault',
      seed: 123,
      acquiredIds: ['mist_edge'],
      processedDraftIds: ['draft:done']
    });
    expect(normalizeRunRelicState(null)).toEqual(createRunRelicState('assault'));
    expect(() => normalizeRunRelicState({}, 'invalid' as RunRelicFrame)).toThrow(TypeError);
  });

  it('normalizes a valid first-draft relic seed to the first slot without mutating persisted input', () => {
    const persisted = {
      rulesVersion: 1,
      frame: 'assault',
      seed: 41,
      seedRelicId: 'focus_prism',
      acquiredIds: [],
      processedDraftIds: [],
      pendingDraft: {
        draftId: 'draft:seeded',
        nodeId: 'reward:seeded',
        candidateIds: ['hunter_clock', 'focus_prism']
      }
    };
    const before = jsonClone(persisted);

    expect(isRunRelicState(persisted)).toBe(false);
    expect(normalizeRunRelicState(persisted, 'assault')).toEqual({
      ...persisted,
      pendingDraft: {
        ...persisted.pendingDraft,
        candidateIds: ['focus_prism', 'hunter_clock']
      }
    });
    expect(isRunRelicState(normalizeRunRelicState(persisted, 'assault'))).toBe(true);
    expect(persisted).toEqual(before);
  });

  it('strictly rejects malformed state shapes that normalization can repair', () => {
    const validPending = generateRunRelicDraft(createRunRelicState('assault', 5), {
      draftId: 'draft',
      nodeId: 'reward'
    });
    const malformedStates: unknown[] = [
      { ...validPending, rulesVersion: 2 },
      { ...validPending, seed: 0 },
      { ...validPending, seedRelicId: 'bone_shell' },
      { ...validPending, seedRelicId: 'unknown' },
      { ...validPending, acquiredIds: ['mist_edge', 'mist_edge'] },
      { ...validPending, acquiredIds: ['bone_shell'] },
      { ...validPending, processedDraftIds: ['done', 'done'] },
      { ...validPending, pendingDraft: { ...validPending.pendingDraft, candidateIds: [] } },
      { ...validPending, pendingDraft: { ...validPending.pendingDraft, draftId: 'done' }, processedDraftIds: ['done'] },
      { ...validPending, seed: undefined }
    ];

    expect(isRunRelicState(validPending)).toBe(true);
    for (const malformed of malformedStates) {
      expect(isRunRelicState(malformed)).toBe(false);
      expect(isRunRelicState(normalizeRunRelicState(malformed, 'assault'))).toBe(true);
    }
    expect(isRunRelicId('mist_edge')).toBe(true);
    expect(isRunRelicId('unknown')).toBe(false);
  });

  it('archives a detached immutable settlement, records abandoned work, and roundtrips as JSON', () => {
    const draft = generateRunRelicDraft(createRunRelicState('assault', 321, 'focus_prism'), {
      draftId: 'draft:one',
      nodeId: 'reward:one'
    });
    const chosen = draft.pendingDraft?.candidateIds[0];
    if (!chosen) throw new Error('Expected a chosen relic');
    const selected = selectRunRelic(draft, 'draft:one', chosen);
    const withPending = generateRunRelicDraft(selected, {
      draftId: 'draft:two',
      nodeId: 'reward:two'
    });
    const before = jsonClone(withPending);
    const settlement = archiveRunRelicState(withPending);

    expect(settlement).toEqual({
      rulesVersion: 1,
      frame: 'assault',
      seed: 321,
      seedRelicId: 'focus_prism',
      acquiredIds: [chosen],
      processedDraftIds: ['draft:one'],
      abandonedDraftId: 'draft:two',
      effects: aggregateRunRelicEffects([chosen])
    });
    expect(JSON.parse(JSON.stringify(settlement))).toEqual(settlement);
    expect(withPending).toEqual(before);

    const mutableSettlement = settlement as unknown as {
      acquiredIds: string[];
      processedDraftIds: string[];
    };
    mutableSettlement.acquiredIds.push('focus_prism');
    mutableSettlement.processedDraftIds.push('mutated');
    expect(withPending).toEqual(before);
  });
});
