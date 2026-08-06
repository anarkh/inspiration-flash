import { describe, expect, it } from 'vitest';
import { DUNGEON_ORDER } from './level-content';
import {
  createDungeonLawState,
  freezeCombatReplayBossSnapshot,
  recordCombatReplayTake,
  resolveFalseTestimonyAccusation,
  resolveEscortCheckpointChoice,
  resolveBroadcastRelayChoice,
  selectCombatReplayRoute,
  signalCombatStarted,
  signalFirstNodeClear
} from './dungeon-laws';
import {
  MAIN_GOD_DIRECTIVES,
  evaluateDirective,
  getDirectiveForDungeon,
  type DirectiveRunSummary
} from './directive-system';

const baseSummary: DirectiveRunSummary = {
  dungeonId: 'demon_tower_1',
  clearedNodeIds: ['fog_lesser_demon', 'blood_rune_trap', 'tower_exit'],
  totalNodes: 5,
  damageTaken: 12,
  captures: ['mist_kitten'],
  usedItems: [],
  learnedMethods: ['mist_breathing'],
  equippedIds: ['training_blade'],
  activePet: 'mist_kitten'
};

describe('main god directive system', () => {
  it('defines one directive for every dungeon in order', () => {
    expect(DUNGEON_ORDER).toHaveLength(19);
    expect(MAIN_GOD_DIRECTIVES).toHaveLength(19);
    expect(MAIN_GOD_DIRECTIVES).toHaveLength(DUNGEON_ORDER.length);
    expect(MAIN_GOD_DIRECTIVES.map((directive) => directive.dungeonId)).toEqual(DUNGEON_ORDER);

    for (const directive of MAIN_GOD_DIRECTIVES) {
      expect(directive.id).toMatch(/^directive_/);
      expect(directive.name.length).toBeGreaterThan(0);
      expect(directive.brief.length).toBeGreaterThan(0);
      expect(directive.requiredClears).toBeGreaterThan(0);
      expect(directive.optionalObjectives.length).toBeGreaterThanOrEqual(2);
      expect(directive.reward.preview.length).toBeGreaterThan(0);
    }
  });

  it('keeps objectives tied to gameplay choices', () => {
    const objectiveKinds = MAIN_GOD_DIRECTIVES.flatMap((directive) =>
      directive.optionalObjectives.map((objective) => objective.kind)
    );

    expect(objectiveKinds).toContain('equip');
    expect(objectiveKinds).toContain('method');
    expect(objectiveKinds).toContain('capture');
    expect(objectiveKinds).toContain('low_damage');
    expect(objectiveKinds).toContain('combat_replay_complete');
    expect(objectiveKinds).toContain('panopticon_complete');
    expect(objectiveKinds).toContain('hidden_clear');
    expect(objectiveKinds).toContain('no_item');
    expect(objectiveKinds).toContain('route');
    expect(objectiveKinds).toContain('auction');
    expect(objectiveKinds).toContain('genesis_splice');
    expect(objectiveKinds).toContain('active_bloodline');
    expect(objectiveKinds).toContain('broadcast_relays');
    expect(objectiveKinds).toContain('broadcast_snapshot');
    expect(objectiveKinds).toContain('escort_checkpoints');
    expect(objectiveKinds).toContain('escort_snapshot');
    expect(
      getDirectiveForDungeon('demon_tower_1').optionalObjectives.find(
        (objective) => objective.kind === 'low_damage'
      )?.description
    ).toContain('治疗不会回退累计值');
  });

  it('frames the first low-damage target as an optional reward without weakening it', () => {
    const directive = getDirectiveForDungeon('demon_tower_1');
    const lowDamageObjective = directive.optionalObjectives.find(
      (objective) => objective.kind === 'low_damage'
    );

    expect(directive.brief).toContain('可选额外奖励');
    expect(directive.brief).toContain('不影响Boss、出口或主线通关');
    expect(lowDamageObjective).toMatchObject({
      damageLimit: 20,
      description: expect.stringContaining('不影响Boss、出口或主线通关')
    });
    expect(lowDamageObjective?.description).toContain('守势');
    expect(lowDamageObjective?.description).toContain('减伤');

    const exceeded = evaluateDirective(directive, {
      ...baseSummary,
      damageTaken: 21
    });
    expect(exceeded.status).toBe('failed');
    expect(exceeded.objectiveResults).toContainEqual(
      expect.objectContaining({
        id: 'demon_tower_1_low_damage',
        completed: false,
        progressText: '承伤 21/20'
      })
    );
  });

  it('marks a directive active while required clears are still in progress', () => {
    const directive = getDirectiveForDungeon('demon_tower_1');
    const result = evaluateDirective(directive, {
      ...baseSummary,
      clearedNodeIds: ['fog_lesser_demon'],
      damageTaken: 8,
      captures: [],
      activePet: undefined
    });

    expect(result.status).toBe('active');
    expect(result.progressText).toBe('节点清理 1/3');
    expect(result.rewardPreview).toBe(directive.reward.preview);
    expect(result.objectiveResults.some((objective) => !objective.completed)).toBe(true);
  });

  it('marks a directive completed when required clears and optional objectives are met', () => {
    const directive = getDirectiveForDungeon('demon_tower_1');
    const result = evaluateDirective(directive, baseSummary);

    expect(result.status).toBe('completed');
    expect(result.progressText).toBe('节点清理 3/3');
    expect(result.objectiveResults.every((objective) => objective.completed)).toBe(true);
  });

  it('marks a directive failed when the run clears enough nodes but misses every optional objective', () => {
    const directive = getDirectiveForDungeon('demon_tower_1');
    const result = evaluateDirective(directive, {
      ...baseSummary,
      damageTaken: 40,
      captures: [],
      usedItems: ['thunder_talisman'],
      learnedMethods: [],
      activePet: undefined
    });

    expect(result.status).toBe('failed');
    expect(result.objectiveResults.every((objective) => !objective.completed)).toBe(true);
  });

  it('locks directives for other dungeons until the matching dungeon run is evaluated', () => {
    const directive = getDirectiveForDungeon('void_citadel');
    const result = evaluateDirective(directive, baseSummary);

    expect(result.status).toBe('locked');
    expect(result.progressText).toBe('进入虚界王座后开始记录');
    expect(result.objectiveResults.every((objective) => !objective.completed)).toBe(true);
  });

  it('evaluates equipment, method, pet capture, and low damage objectives', () => {
    const directive = getDirectiveForDungeon('void_citadel');
    const result = evaluateDirective(directive, {
      dungeonId: 'void_citadel',
      clearedNodeIds: ['void_gate', 'void_knight', 'main_god_echo', 'citadel_exit'],
      totalNodes: 6,
      damageTaken: 36,
      captures: ['void_whelp'],
      usedItems: [],
      learnedMethods: ['void_heart'],
      equippedIds: ['starforged_edge', 'void_lantern'],
      activePet: 'void_whelp'
    });

    expect(result.status).toBe('completed');
    expect(result.objectiveResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'equip', completed: true }),
        expect.objectContaining({ kind: 'method', completed: true }),
        expect.objectContaining({ kind: 'capture', completed: true }),
        expect.objectContaining({ kind: 'low_damage', completed: true })
      ])
    );
  });

  it('completes capture objectives from permanent ownership without claiming a new run capture', () => {
    const directive = getDirectiveForDungeon('demon_tower_1');
    const owned = evaluateDirective(directive, {
      ...baseSummary,
      captures: [],
      ownedPetIds: ['mist_kitten']
    });
    const capturedAgain = evaluateDirective(directive, {
      ...baseSummary,
      captures: ['mist_kitten'],
      ownedPetIds: ['mist_kitten']
    });

    expect(owned.objectiveResults).toContainEqual(
      expect.objectContaining({
        id: 'demon_tower_1_capture_mist_kitten',
        completed: true,
        progressText: '已永久拥有'
      })
    );
    expect(capturedAgain.objectiveResults).toContainEqual(
      expect.objectContaining({
        id: 'demon_tower_1_capture_mist_kitten',
        completed: true,
        progressText: '本轮已捕获'
      })
    );
  });

  it('requires both temporal calibration anchors for route completion', () => {
    const directive = getDirectiveForDungeon('temporal_observatory');
    const calibratedSummary: DirectiveRunSummary = {
      dungeonId: 'temporal_observatory',
      clearedNodeIds: [
        'clockwork_scout',
        'past_calibration_anchor',
        'field_observation_deck',
        'future_calibration_anchor',
        'zero_hour_regent'
      ],
      totalNodes: 8,
      damageTaken: 48,
      captures: [],
      usedItems: [],
      learnedMethods: [],
      equippedIds: ['chronal_lens']
    };

    const completed = evaluateDirective(directive, calibratedSummary);
    expect(completed.status).toBe('completed');
    expect(completed.objectiveResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'temporal_observatory_calibration_route',
          kind: 'route',
          completed: true,
          progressText: '路线锚点 2/2'
        })
      ])
    );

    const missedFuture = evaluateDirective(directive, {
      ...calibratedSummary,
      clearedNodeIds: [
        'clockwork_scout',
        'past_calibration_anchor',
        'field_observation_deck',
        'epoch_sentinel',
        'zero_hour_regent'
      ]
    });
    expect(missedFuture.status).toBe('failed');
    expect(missedFuture.objectiveResults.find((objective) => objective.kind === 'route')).toMatchObject({
      completed: false,
      progressText: '路线锚点 1/2'
    });
  });

  it('uses only supported route, equipment, and low-damage objectives for causal clearing', () => {
    const directive = getDirectiveForDungeon('causal_clearinghouse');

    expect(directive).toMatchObject({
      id: 'directive_causal_clearinghouse',
      requiredClears: 5,
      reward: { rewardPoints: 1040, lingyun: 4, items: { causal_seal: 2 } }
    });
    expect(directive.optionalObjectives).toEqual([
      expect.objectContaining({
        id: 'causal_clearinghouse_deposition_route',
        kind: 'route',
        nodeIds: ['cause_deposition', 'effect_deposition']
      }),
      expect.objectContaining({
        id: 'causal_clearinghouse_causal_visor',
        kind: 'equip',
        equipmentId: 'causal_visor'
      }),
      expect.objectContaining({
        id: 'causal_clearinghouse_low_damage',
        kind: 'low_damage',
        damageLimit: 56
      })
    ]);

    const completed = evaluateDirective(directive, {
      dungeonId: 'causal_clearinghouse',
      clearedNodeIds: [
        'entry_docket',
        'cause_deposition',
        'contradiction_line',
        'effect_deposition',
        'zero_sum_auditor'
      ],
      totalNodes: 9,
      damageTaken: 56,
      captures: [],
      usedItems: [],
      learnedMethods: [],
      equippedIds: ['causal_visor']
    });
    expect(completed.status).toBe('completed');
    expect(completed.objectiveResults.every((objective) => objective.completed)).toBe(true);

    const missedEffect = evaluateDirective(directive, {
      dungeonId: 'causal_clearinghouse',
      clearedNodeIds: ['entry_docket', 'cause_deposition', 'contradiction_line', 'cause_bailiff', 'zero_sum_auditor'],
      totalNodes: 9,
      damageTaken: 57,
      captures: [],
      usedItems: [],
      learnedMethods: [],
      equippedIds: []
    });
    expect(missedEffect.status).toBe('failed');
    expect(missedEffect.objectiveResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'route', completed: false, progressText: '路线锚点 1/2' }),
        expect.objectContaining({ kind: 'equip', completed: false }),
        expect.objectContaining({ kind: 'low_damage', completed: false })
      ])
    );
  });

  it('requires both ballast cores, the entropy compass, and the Tier-10 damage cap', () => {
    const directive = getDirectiveForDungeon('entropy_ark');

    expect(directive).toMatchObject({
      id: 'directive_entropy_ark',
      requiredClears: 5,
      reward: { rewardPoints: 1180, lingyun: 5, items: { entropy_crystal: 2 } }
    });
    expect(directive.optionalObjectives).toEqual([
      expect.objectContaining({ id: 'entropy_ark_ballast_route', kind: 'route', nodeIds: ['port_ballast_core', 'starboard_ballast_core'] }),
      expect.objectContaining({ id: 'entropy_ark_entropy_compass', kind: 'equip', equipmentId: 'entropy_compass' }),
      expect.objectContaining({ id: 'entropy_ark_low_damage', kind: 'low_damage', damageLimit: 64 })
    ]);

    const result = evaluateDirective(directive, {
      dungeonId: 'entropy_ark',
      clearedNodeIds: ['entropy_deckhand', 'port_ballast_core', 'wake_inversion', 'starboard_ballast_core', 'last_helmsman'],
      totalNodes: 10,
      damageTaken: 64,
      captures: [],
      usedItems: [],
      learnedMethods: [],
      equippedIds: ['entropy_compass']
    });
    expect(result.status).toBe('completed');
    expect(result.objectiveResults.every((objective) => objective.completed)).toBe(true);
  });

  it('requires both phase anchors, the parallax visor, and the Tier-11 damage cap', () => {
    const directive = getDirectiveForDungeon('mirror_cycle_city');

    expect(directive).toMatchObject({
      id: 'directive_mirror_cycle_city',
      requiredClears: 6,
      reward: { rewardPoints: 1320, lingyun: 6, items: { phase_glass: 2 } }
    });
    expect(directive.optionalObjectives).toEqual([
      expect.objectContaining({ id: 'mirror_cycle_city_phase_anchor_route', kind: 'route', nodeIds: ['real_anchor', 'mirror_anchor'] }),
      expect.objectContaining({ id: 'mirror_cycle_city_parallax_visor', kind: 'equip', equipmentId: 'parallax_visor' }),
      expect.objectContaining({ id: 'mirror_cycle_city_low_damage', kind: 'low_damage', damageLimit: 70 })
    ]);

    const result = evaluateDirective(directive, {
      dungeonId: 'mirror_cycle_city',
      clearedNodeIds: ['cycle_gate', 'real_anchor', 'second_phase_mirror', 'mirror_anchor', 'third_phase_mirror', 'nameless_reflection'],
      totalNodes: 30,
      damageTaken: 70,
      captures: [],
      usedItems: [],
      learnedMethods: [],
      equippedIds: ['parallax_visor']
    });
    expect(result.status).toBe('completed');
    expect(result.objectiveResults.every((objective) => objective.completed)).toBe(true);
  });

  it('requires all three clause routes, redline edge, and the Tier-12 damage cap', () => {
    const directive = getDirectiveForDungeon('redaction_scriptorium');

    expect(directive).toMatchObject({
      id: 'directive_redaction_scriptorium',
      requiredClears: 7,
      reward: {
        rewardPoints: 1460,
        lingyun: 7,
        items: { redaction_ink: 2 },
        preview: '奖励点 1460、灵蕴 7、删界墨 2'
      }
    });
    expect(directive.optionalObjectives).toEqual([
      expect.objectContaining({ id: 'redaction_scriptorium_three_clause_route', kind: 'route', nodeIds: ['body_clause_desk', 'memory_clause_desk', 'return_clause_desk'] }),
      expect.objectContaining({ id: 'redaction_scriptorium_redline_edge', kind: 'equip', equipmentId: 'redline_edge', label: '装备朱批断章刃裁定终稿' }),
      expect.objectContaining({ id: 'redaction_scriptorium_low_damage', kind: 'low_damage', damageLimit: 76 })
    ]);

    const completed = evaluateDirective(directive, {
      dungeonId: 'redaction_scriptorium',
      clearedNodeIds: ['folio_gate', 'body_clause_desk', 'memory_clause_desk', 'final_proof_nexus', 'return_clause_desk', 'errata_event_stage', 'last_redactor'],
      totalNodes: 30,
      damageTaken: 76,
      captures: [],
      usedItems: [],
      learnedMethods: [],
      equippedIds: ['redline_edge']
    });
    expect(completed.status).toBe('completed');
    expect(completed.objectiveResults.every((objective) => objective.completed)).toBe(true);

    const missedClause = evaluateDirective(directive, {
      ...baseSummary,
      dungeonId: 'redaction_scriptorium',
      clearedNodeIds: ['folio_gate', 'body_clause_desk', 'memory_clause_desk', 'final_proof_nexus', 'errata_event_stage', 'last_redactor', 'boss_south_lock'],
      damageTaken: 77,
      equippedIds: []
    });
    expect(missedClause.status).toBe('failed');
    expect(missedClause.objectiveResults).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'route', completed: false, progressText: '路线锚点 2/3' }),
      expect.objectContaining({ kind: 'equip', completed: false }),
      expect.objectContaining({ kind: 'low_damage', completed: false })
    ]));
  });

  it('requires four auction decisions, two bids, the legacy gavel, and the Tier-13 damage cap', () => {
    const directive = getDirectiveForDungeon('legacy_auction_court');

    expect(directive).toMatchObject({
      id: 'directive_legacy_auction_court',
      requiredClears: 8,
      reward: {
        rewardPoints: 1660,
        lingyun: 8,
        items: { legacy_scrip: 2 },
        preview: '奖励点 1660、灵蕴 8、遗产筹码 2'
      }
    });
    expect(directive.optionalObjectives).toEqual([
      expect.objectContaining({
        id: 'legacy_auction_court_four_decisions_two_bids',
        kind: 'auction',
        nodeIds: ['force_lot_dais', 'guard_lot_dais', 'art_lot_dais', 'return_lot_dais'],
        bidProofNodeIds: ['force_claim_vault', 'guard_claim_vault', 'art_claim_vault', 'return_claim_vault'],
        minimumBidCount: 2
      }),
      expect.objectContaining({
        id: 'legacy_auction_court_legacy_gavel',
        kind: 'equip',
        equipmentId: 'legacy_gavel'
      }),
      expect.objectContaining({
        id: 'legacy_auction_court_low_damage',
        kind: 'low_damage',
        damageLimit: 82
      })
    ]);

    const completed = evaluateDirective(directive, {
      dungeonId: 'legacy_auction_court',
      clearedNodeIds: [
        'estate_gate',
        'force_lot_dais',
        'guard_lot_dais',
        'art_lot_dais',
        'return_lot_dais',
        'force_claim_vault',
        'guard_claim_vault',
        'estate_auctioneer'
      ],
      totalNodes: 32,
      damageTaken: 82,
      captures: [],
      usedItems: [],
      learnedMethods: [],
      equippedIds: ['legacy_gavel']
    });
    expect(completed.status).toBe('completed');
    expect(completed.rewardPreview).toBe('奖励点 1660、灵蕴 8、遗产筹码 2');
    expect(completed.objectiveResults.every((objective) => objective.completed)).toBe(true);

    const missedBid = evaluateDirective(directive, {
      ...baseSummary,
      dungeonId: 'legacy_auction_court',
      clearedNodeIds: [
        'estate_gate',
        'force_lot_dais',
        'guard_lot_dais',
        'art_lot_dais',
        'return_lot_dais',
        'force_claim_vault',
        'provenance_event_stage',
        'estate_auctioneer'
      ],
      damageTaken: 83,
      equippedIds: []
    });
    expect(missedBid.status).toBe('failed');
    expect(missedBid.objectiveResults).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'legacy_auction_court_four_decisions_two_bids', completed: false, progressText: '拍卖决策 4/4；竞价 1/2' }),
      expect.objectContaining({ kind: 'equip', completed: false }),
      expect.objectContaining({ kind: 'low_damage', completed: false })
    ]));
  });

  it('requires three diverse splices, a valid active bloodline snapshot, and the Tier-14 damage cap', () => {
    const directive = getDirectiveForDungeon('genesis_vault');
    const lawState = createDungeonLawState('genesis_vault', {
      entryBloodline: { aspect: 'force', rank: 2 }
    });
    if (lawState.law.kind !== 'genesis_vault') throw new Error('Expected genesis law state.');
    const completedLawState = {
      ...lawState,
      law: {
        ...lawState.law,
        spliceSequence: ['force', 'guard', 'force'] as const,
        bossGenomeSnapshot: ['force', 'guard', 'force'] as const
      }
    };

    expect(directive).toMatchObject({
      id: 'directive_genesis_vault',
      dungeonId: 'genesis_vault',
      requiredClears: 8,
      reward: {
        rewardPoints: 760,
        lingyun: 3,
        items: { genesis_serum: 2 },
        preview: '奖励点 760、灵蕴 3、原型血清 2'
      }
    });
    expect(directive.optionalObjectives).toEqual([
      expect.objectContaining({
        id: 'genesis_vault_three_splices_two_genes',
        kind: 'genesis_splice',
        requiredSpliceCount: 3,
        minimumUniqueGeneCount: 2
      }),
      expect.objectContaining({ id: 'genesis_vault_active_bloodline', kind: 'active_bloodline' }),
      expect.objectContaining({ id: 'genesis_vault_low_damage', kind: 'low_damage', damageLimit: 88 })
    ]);

    const completed = evaluateDirective(directive, {
      dungeonId: 'genesis_vault',
      clearedNodeIds: [
        'genesis_gate',
        'first_splice_console',
        'second_splice_console',
        'third_splice_console',
        'mosaic_gene_vault',
        'lineage_event_stage',
        'bloodline_survey_archive',
        'primal_curator'
      ],
      totalNodes: 30,
      damageTaken: 88,
      captures: [],
      usedItems: [],
      learnedMethods: [],
      equippedIds: [],
      lawState: completedLawState
    });
    expect(completed.status).toBe('completed');
    expect(completed.rewardPreview).toBe('奖励点 760、灵蕴 3、原型血清 2');
    expect(completed.objectiveResults).toEqual([
      expect.objectContaining({ completed: true, progressText: '拼接 3/3；不同基因 2/2' }),
      expect.objectContaining({ completed: true, progressText: '活性血脉快照有效' }),
      expect.objectContaining({ completed: true, progressText: '承伤 88/88' })
    ]);

    const sameGene = evaluateDirective(directive, {
      ...baseSummary,
      dungeonId: 'genesis_vault',
      clearedNodeIds: Array.from({ length: 8 }, (_, index) => `node_${index}`),
      damageTaken: 89,
      lawState: {
        ...completedLawState,
        law: {
          ...completedLawState.law,
          spliceSequence: ['force', 'force', 'force'],
          bossGenomeSnapshot: ['force', 'force', 'force']
        }
      }
    });
    expect(sameGene.status).toBe('failed');
    expect(sameGene.objectiveResults).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'genesis_splice', completed: false, progressText: '拼接 3/3；不同基因 1/2' }),
      expect.objectContaining({ kind: 'active_bloodline', completed: true }),
      expect.objectContaining({ kind: 'low_damage', completed: false })
    ]));
  });

  it('rejects missing, foreign, and malformed genesis law or bloodline snapshots', () => {
    const directive = getDirectiveForDungeon('genesis_vault');
    const valid = createDungeonLawState('genesis_vault', {
      entryBloodline: { aspect: 'renewal', rank: 1 }
    });
    if (valid.law.kind !== 'genesis_vault') throw new Error('Expected genesis law state.');
    const base = {
      ...baseSummary,
      dungeonId: 'genesis_vault' as const,
      clearedNodeIds: Array.from({ length: 8 }, (_, index) => `node_${index}`),
      damageTaken: 88
    };
    const validComplete = {
      ...valid,
      law: { ...valid.law, spliceSequence: ['renewal', 'art', 'guard'] }
    };

    for (const lawState of [
      undefined,
      createDungeonLawState('legacy_auction_court'),
      { ...validComplete, rulesVersion: 0 },
      { ...validComplete, dungeonId: 'legacy_auction_court' },
      { ...validComplete, law: { ...validComplete.law, spliceSequence: ['renewal', 'invalid', 'guard'] } },
      { ...validComplete, law: { ...validComplete.law, spliceSequence: ['renewal', 'art', 'guard', 'force'] } },
      { ...validComplete, law: { ...validComplete.law, bossGenomeSnapshot: ['renewal', 'art', 'force'] } },
      { ...validComplete, law: { ...validComplete.law, entryBloodline: { aspect: null, rank: 0 } } },
      { ...validComplete, law: { ...validComplete.law, entryBloodline: { aspect: 'renewal', rank: 4 } } }
    ]) {
      const result = evaluateDirective(directive, { ...base, lawState });
      expect(result.status).toBe('failed');
      expect(result.objectiveResults.find(({ kind }) => kind === 'genesis_splice')?.completed).toBe(false);
      expect(result.objectiveResults.find(({ kind }) => kind === 'active_bloodline')?.completed).toBe(false);
    }
  });

  it('reads the real Tier-15 relay choices and boss snapshot for the broadcast directive', () => {
    const directive = getDirectiveForDungeon('silent_broadcast_tower');
    let lawState = createDungeonLawState('silent_broadcast_tower');
    const relayChoices = [
      ['north_relay_console', 'mute'],
      ['central_relay_console', 'broadcast'],
      ['south_relay_console', 'mute']
    ] as const;

    for (const [nodeId, choice] of relayChoices) {
      lawState = signalFirstNodeClear(lawState, {
        node: { id: nodeId, type: 'reward' },
        damageTaken: 0
      });
      lawState = resolveBroadcastRelayChoice(lawState, choice).state;
    }
    lawState = signalCombatStarted(lawState, {
      nodeId: 'last_broadcaster',
      isBoss: true,
      openingAction: 'attack'
    });

    expect(directive).toMatchObject({
      id: 'directive_silent_broadcast_tower',
      dungeonId: 'silent_broadcast_tower',
      requiredClears: 8,
      reward: {
        rewardPoints: 820,
        lingyun: 4,
        items: { silence_core: 2 },
        preview: '奖励点 820、灵蕴 4、静默晶核 2'
      }
    });
    expect(directive.optionalObjectives).toEqual([
      expect.objectContaining({
        id: 'silent_broadcast_tower_three_relays_mixed',
        kind: 'broadcast_relays',
        minimumMuteCount: 1,
        minimumBroadcastCount: 1
      }),
      expect.objectContaining({
        id: 'silent_broadcast_tower_boss_snapshot',
        kind: 'broadcast_snapshot',
        maximumBossNoiseSnapshot: 4
      }),
      expect.objectContaining({
        id: 'silent_broadcast_tower_low_damage',
        kind: 'low_damage',
        damageLimit: 92
      })
    ]);

    const completed = evaluateDirective(directive, {
      dungeonId: 'silent_broadcast_tower',
      clearedNodeIds: [
        'broadcast_gate',
        'north_relay_console',
        'central_relay_console',
        'south_relay_console',
        'broadcast_memory_stage',
        'anechoic_chamber',
        'studio_side_lock',
        'last_broadcaster'
      ],
      totalNodes: 30,
      damageTaken: 92,
      captures: [],
      usedItems: [],
      learnedMethods: [],
      equippedIds: [],
      lawState
    });
    expect(completed.status).toBe('completed');
    expect(completed.objectiveResults).toEqual([
      expect.objectContaining({ completed: true, progressText: '中继 3/3；静默 2/1；广播 1/1' }),
      expect.objectContaining({ completed: true, progressText: '首领噪声 0/4' }),
      expect.objectContaining({ completed: true, progressText: '承伤 92/92' })
    ]);

    const malformed = evaluateDirective(directive, {
      ...baseSummary,
      dungeonId: 'silent_broadcast_tower',
      clearedNodeIds: Array.from({ length: 8 }, (_, index) => `broadcast_node_${index}`),
      damageTaken: 93,
      lawState: {
        ...lawState,
        law: { ...lawState.law, bossNoiseSnapshot: 7 }
      }
    });
    expect(malformed.status).toBe('failed');
    expect(malformed.objectiveResults.every((objective) => !objective.completed)).toBe(true);
  });

  it('reads the real Tier-16 checkpoint mix, living survivor, and boss snapshot', () => {
    const directive = getDirectiveForDungeon('lost_shelter');
    let lawState = createDungeonLawState('lost_shelter');

    lawState = signalFirstNodeClear(lawState, {
      node: { id: 'alarm_grid_trap', type: 'trap' },
      damageTaken: 0
    });
    const checkpointChoices = [
      ['north_checkpoint', 'treat'],
      ['central_checkpoint', 'push'],
      ['south_checkpoint', 'push']
    ] as const;
    for (const [nodeId, choice] of checkpointChoices) {
      lawState = signalFirstNodeClear(lawState, {
        node: { id: nodeId, type: 'reward' },
        damageTaken: 0
      });
      const resolution = resolveEscortCheckpointChoice(lawState, nodeId, choice, 1);
      expect(resolution.resolved).toBe(true);
      lawState = resolution.state;
    }
    lawState = signalCombatStarted(lawState, {
      nodeId: 'shelter_overseer',
      isBoss: true,
      openingAction: 'guard'
    });

    expect(directive).toMatchObject({
      id: 'directive_lost_shelter',
      dungeonId: 'lost_shelter',
      requiredClears: 8,
      reward: {
        rewardPoints: 880,
        lingyun: 4,
        items: { rescue_badge: 2 },
        preview: '奖励点 880、灵蕴 4、救援铭牌 2'
      }
    });
    expect(directive.optionalObjectives).toEqual([
      expect.objectContaining({
        id: 'lost_shelter_three_checkpoints_mixed',
        kind: 'escort_checkpoints',
        minimumTreatCount: 1,
        minimumPushCount: 1,
        requireSurvivorAlive: true
      }),
      expect.objectContaining({
        id: 'lost_shelter_boss_survivor_snapshot',
        kind: 'escort_snapshot',
        minimumBossSurvivorSnapshot: 50
      }),
      expect.objectContaining({
        id: 'lost_shelter_low_damage',
        kind: 'low_damage',
        damageLimit: 98
      })
    ]);

    const completed = evaluateDirective(directive, {
      dungeonId: 'lost_shelter',
      clearedNodeIds: [
        'shelter_gate',
        'alarm_grid_trap',
        'north_checkpoint',
        'central_checkpoint',
        'south_checkpoint',
        'survivor_memory_stage',
        'containment_bay',
        'shelter_overseer'
      ],
      totalNodes: 30,
      damageTaken: 98,
      captures: [],
      usedItems: ['healing_pill'],
      learnedMethods: [],
      equippedIds: [],
      lawState
    });
    expect(completed.status).toBe('completed');
    expect(completed.objectiveResults).toEqual([
      expect.objectContaining({ completed: true, progressText: '检查点 3/3；救治 1/1；推进 2/1；幸存者生命 80' }),
      expect.objectContaining({ completed: true, progressText: '首领战幸存者生命 80/50' }),
      expect.objectContaining({ completed: true, progressText: '承伤 98/98' })
    ]);

    const malformed = evaluateDirective(directive, {
      ...baseSummary,
      dungeonId: 'lost_shelter',
      clearedNodeIds: Array.from({ length: 8 }, (_, index) => `shelter_node_${index}`),
      damageTaken: 99,
      lawState: {
        ...lawState,
        law: { ...lawState.law, survivorHp: 0, bossSurvivorSnapshot: 0 }
      }
    });
    expect(malformed.status).toBe('failed');
    expect(malformed.objectiveResults.every((objective) => !objective.completed)).toBe(true);
  });

  it('reads the real Tier-17 three-evidence verdict and immutable boss snapshot', () => {
    const directive = getDirectiveForDungeon('false_testimony_court');
    let lawState = createDungeonLawState('false_testimony_court');
    const evidencePairs = [
      ['voice_evidence', 'voice_filter_trap'],
      ['timeline_evidence', 'timeline_checksum_trap'],
      ['residue_evidence', 'residue_sterility_trap']
    ] as const;
    for (const [evidenceNodeId, trapNodeId] of evidencePairs) {
      lawState = signalFirstNodeClear(lawState, {
        node: { id: evidenceNodeId, type: 'reward' },
        damageTaken: 0
      });
      lawState = signalFirstNodeClear(lawState, {
        node: { id: trapNodeId, type: 'trap' },
        damageTaken: 0
      });
    }
    lawState = signalFirstNodeClear(lawState, {
      node: { id: 'verdict_chamber', type: 'reward' },
      damageTaken: 0
    });
    const accusation = resolveFalseTestimonyAccusation(lawState, 'route_surveyor');
    expect(accusation.resolved).toBe(true);
    expect(accusation.correct).toBe(true);
    lawState = signalCombatStarted(accusation.state, {
      nodeId: 'false_testimony_judge',
      isBoss: true,
      openingAction: 'guard'
    });

    expect(directive).toMatchObject({
      id: 'directive_false_testimony_court',
      dungeonId: 'false_testimony_court',
      requiredClears: 8,
      reward: {
        rewardPoints: 950,
        lingyun: 4,
        items: { truth_fragment: 2 },
        preview: '奖励点 950、灵蕴 4、真证碎片 2'
      }
    });
    expect(directive.optionalObjectives).toEqual([
      expect.objectContaining({
        id: 'false_testimony_court_three_evidence_verdict',
        kind: 'false_testimony_verdict',
        requiredEvidenceCount: 3,
        minimumTrustedEvidenceCount: 2,
        requireCorrectAccusation: true,
        requireNoAppeal: true
      }),
      expect.objectContaining({
        id: 'false_testimony_court_boss_verdict_snapshot',
        kind: 'false_testimony_snapshot',
        minimumTrustedEvidenceCount: 2
      }),
      expect.objectContaining({
        id: 'false_testimony_court_low_damage',
        kind: 'low_damage',
        damageLimit: 105
      })
    ]);

    const completed = evaluateDirective(directive, {
      dungeonId: 'false_testimony_court',
      clearedNodeIds: [
        'verdict_gate',
        'voice_evidence',
        'voice_filter_trap',
        'timeline_evidence',
        'timeline_checksum_trap',
        'residue_evidence',
        'residue_sterility_trap',
        'false_testimony_judge'
      ],
      totalNodes: 30,
      damageTaken: 105,
      captures: [],
      usedItems: [],
      learnedMethods: [],
      equippedIds: [],
      lawState
    });
    expect(completed.status).toBe('completed');
    expect(completed.objectiveResults).toEqual([
      expect.objectContaining({ completed: true, progressText: '证据 3/3；可信 3/2；指控正确；未申诉' }),
      expect.objectContaining({ completed: true, progressText: '首领战可信证据 3/2；裁决正确；未申诉' }),
      expect.objectContaining({ completed: true, progressText: '承伤 105/105' })
    ]);

    const failed = evaluateDirective(directive, {
      ...baseSummary,
      dungeonId: 'false_testimony_court',
      clearedNodeIds: Array.from({ length: 8 }, (_, index) => `testimony_node_${index}`),
      damageTaken: 106,
      lawState: undefined
    });
    expect(failed.status).toBe('failed');
    expect(failed.objectiveResults.every((objective) => !objective.completed)).toBe(true);
  });

  it('requires all three Tier-18 takes, a route, the boss snapshot, and at most 112 damage', () => {
    const directive = getDirectiveForDungeon('combat_replay_stage');
    let lawState = createDungeonLawState('combat_replay_stage');
    for (const [nodeId, action, observedValue] of [
      ['take_alpha', 'attack', 120],
      ['take_beta', 'art', 140],
      ['take_gamma', 'guard', 90]
    ] as const) {
      const recorded = recordCombatReplayTake(lawState, nodeId, action, observedValue);
      expect(recorded.recorded).toBe(true);
      lawState = recorded.state;
    }
    const routed = selectCombatReplayRoute(lawState, 'sequence');
    expect(routed.selected).toBe(true);
    const frozen = freezeCombatReplayBossSnapshot(routed.state);
    expect(frozen.frozen).toBe(true);
    lawState = frozen.state;

    expect(directive).toMatchObject({
      id: 'directive_combat_replay_stage',
      dungeonId: 'combat_replay_stage',
      requiredClears: 8,
      reward: {
        rewardPoints: 1020,
        lingyun: 4,
        items: { combat_reel: 2 },
        preview: '奖励点 1020、灵蕴 4、战斗母带 2'
      }
    });
    expect(directive.optionalObjectives).toEqual([
      expect.objectContaining({
        id: 'combat_replay_stage_three_takes_route_boss',
        kind: 'combat_replay_complete'
      }),
      expect.objectContaining({
        id: 'combat_replay_stage_low_damage',
        kind: 'low_damage',
        damageLimit: 112
      })
    ]);

    const completed = evaluateDirective(directive, {
      dungeonId: 'combat_replay_stage',
      clearedNodeIds: ['stage_gate', 'take_alpha', 'take_beta', 'take_gamma', 'sequence_route', 'final_cut_director', 'final_cut_lock', 'theater_exit'],
      totalNodes: 30,
      damageTaken: 112,
      captures: [],
      usedItems: [],
      learnedMethods: [],
      equippedIds: [],
      lawState
    });
    expect(completed.status).toBe('completed');
    expect(completed.objectiveResults).toEqual([
      expect.objectContaining({ completed: true, progressText: '镜次 3/3；路线 sequence；首领已完成' }),
      expect.objectContaining({ completed: true, progressText: '承伤 112/112' })
    ]);

    expect(evaluateDirective(directive, {
      ...baseSummary,
      dungeonId: 'combat_replay_stage',
      clearedNodeIds: Array.from({ length: 8 }, (_, index) => `replay_node_${index}`),
      damageTaken: 113,
      lawState: createDungeonLawState('combat_replay_stage')
    }).status).toBe('failed');
  });

  it('requires all three Tier-19 relays, a locked route, a Boss snapshot, and at most 120 damage', () => {
    const directive = getDirectiveForDungeon('panopticon_city');
    let lawState = createDungeonLawState('panopticon_city');
    if (lawState.law.kind !== 'panopticon_city') throw new Error('Expected panopticon law state.');
    lawState.law.relays = {
      north_blind_relay: true,
      central_blind_relay: true,
      south_blind_relay: true
    };
    lawState.law.route = 'shadow';
    lawState = signalCombatStarted(lawState, {
      nodeId: 'all_sight_warden',
      isBoss: true,
      openingAction: 'attack'
    });

    expect(directive).toMatchObject({
      id: 'directive_panopticon_city',
      dungeonId: 'panopticon_city',
      requiredClears: 8,
      reward: {
        rewardPoints: 1090,
        lingyun: 5,
        items: { observation_shard: 2 },
        preview: '奖励点 1090、灵蕴 5、观测棱片 2'
      }
    });
    expect(directive.optionalObjectives).toEqual([
      expect.objectContaining({
        id: 'panopticon_city_three_relays_route_boss',
        kind: 'panopticon_complete'
      }),
      expect.objectContaining({
        id: 'panopticon_city_low_damage',
        kind: 'low_damage',
        damageLimit: 120
      })
    ]);

    const completed = evaluateDirective(directive, {
      dungeonId: 'panopticon_city',
      clearedNodeIds: ['panopticon_gate', 'north_blind_relay', 'central_blind_relay', 'south_blind_relay', 'shadow_route', 'all_sight_warden', 'all_sight_lock', 'blind_dawn_exit'],
      totalNodes: 30,
      damageTaken: 120,
      captures: [],
      usedItems: [],
      learnedMethods: [],
      equippedIds: [],
      lawState
    });
    expect(completed.status).toBe('completed');
    expect(completed.objectiveResults).toEqual([
      expect.objectContaining({ completed: true, progressText: '中继 3/3；路线 shadow；首领已完成' }),
      expect.objectContaining({ completed: true, progressText: '承伤 120/120' })
    ]);

    expect(evaluateDirective(directive, {
      ...baseSummary,
      dungeonId: 'panopticon_city',
      clearedNodeIds: Array.from({ length: 8 }, (_, index) => `panopticon_node_${index}`),
      damageTaken: 121,
      lawState: createDungeonLawState('panopticon_city')
    }).status).toBe('failed');
    expect(getDirectiveForDungeon('combat_replay_stage').reward.rewardPoints).toBe(1020);
  });
});
