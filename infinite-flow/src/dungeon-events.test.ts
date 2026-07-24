import { describe, expect, it } from 'vitest';

import { getBossDefinition } from './boss-system';
import { DUNGEONS, DUNGEON_ORDER } from './level-content';
import {
  evaluateEventOptions,
  getDungeonEvents,
  resolveDungeonEventChoice,
  type DungeonEventContext,
  type DungeonEventOutcome
} from './dungeon-events';

const blankContext: DungeonEventContext = {
  learnedMethods: [],
  ownedEquipment: [],
  equipped: [],
  ownedPets: [],
  activePetPassiveTags: [],
  inventory: {},
  stats: {
    body: 3,
    spirit: 3,
    agility: 3,
    luck: 3,
    maxHp: 90,
    attack: 12,
    artPower: 8,
    defense: 8,
    speed: 8,
    trapCheck: 5
  }
};

function expectValidOutcome(outcome: DungeonEventOutcome, expectedSuccess: boolean): void {
  expect(outcome.success).toBe(expectedSuccess);
  expect(outcome.temporaryLog.trim()).not.toBe('');

  for (const value of [outcome.rewardPoints, outcome.lingyun, outcome.damage]) {
    if (value !== undefined) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  }

  const itemAmounts = Object.values(outcome.items ?? {});
  for (const amount of itemAmounts) {
    expect(Number.isInteger(amount)).toBe(true);
    expect(amount).toBeGreaterThan(0);
  }

  if (expectedSuccess) {
    const hasReward =
      (outcome.rewardPoints ?? 0) > 0 ||
      (outcome.lingyun ?? 0) > 0 ||
      itemAmounts.length > 0;
    expect(hasReward).toBe(true);
  } else {
    expect(outcome.damage ?? 0).toBeGreaterThan(0);
  }
}

describe('dungeon events', () => {
  it('provides two valid events on unique real nodes for all eighteen dungeons', () => {
    const eventIds = new Set<string>();

    expect(DUNGEON_ORDER).toHaveLength(19);
    for (const dungeonId of DUNGEON_ORDER) {
      const events = getDungeonEvents(dungeonId);
      const eventNodeIds = new Set<string>();

      expect(events.length).toBeGreaterThanOrEqual(2);
      for (const event of events) {
        expect(event.dungeonId).toBe(dungeonId);
        expect(eventIds.has(event.id)).toBe(false);
        eventIds.add(event.id);
        expect(eventNodeIds.has(event.nodeId)).toBe(false);
        eventNodeIds.add(event.nodeId);
        expect(DUNGEONS[dungeonId].nodes.some((node) => node.id === event.nodeId)).toBe(true);
        expect(event.options.length).toBeGreaterThanOrEqual(2);
        expect(
          new Set(
            event.options.flatMap((option) => option.requirements.map((requirement) => requirement.type))
          ).size
        ).toBeGreaterThanOrEqual(2);
        expect(new Set(event.options.map((option) => option.risk)).size).toBeGreaterThanOrEqual(2);
        expect(
          new Set(
            event.options.map((option) =>
              JSON.stringify({
                rewardPoints: option.outcome.rewardPoints,
                lingyun: option.outcome.lingyun,
                items: option.outcome.items,
                damage: option.outcome.damage
              })
            )
          ).size
        ).toBeGreaterThanOrEqual(2);

        const optionIds = new Set<string>();
        for (const option of event.options) {
          expect(option.id).toBeTruthy();
          expect(optionIds.has(option.id)).toBe(false);
          optionIds.add(option.id);
          expect(option.label).toBeTruthy();
          expect(option.description).toBeTruthy();
          expect(option.risk).toMatch(/^(low|medium|high)$/);
          expect(option.requirements.length).toBeGreaterThanOrEqual(1);
          expectValidOutcome(option.outcome, true);
          expect(option.failureOutcome).toBeDefined();
          expectValidOutcome(option.failureOutcome!, false);
        }
      }
    }
  });

  it('uses method, equipment, pet passive, item, and stat requirements to mark choices available', () => {
    const prepared: DungeonEventContext = {
      ...blankContext,
      learnedMethods: ['mist_breathing'],
      ownedEquipment: ['armor_piercing_sword'],
      equipped: ['armor_piercing_sword'],
      ownedPets: ['mist_kitten'],
      activePetPassiveTags: ['trap_scout'],
      inventory: { gate_sigil: 1 },
      stats: { ...blankContext.stats, spirit: 5, trapCheck: 11 }
    };

    const towerOptions = evaluateEventOptions(getDungeonEvents('demon_tower_1')[0], prepared);
    const mineOptions = evaluateEventOptions(getDungeonEvents('starfall_mine')[0], prepared);
    const metroOptions = evaluateEventOptions(getDungeonEvents('metro_abyss')[0], prepared);

    expect(towerOptions.find((option) => option.id === 'breathe_through_runes')?.available).toBe(true);
    expect(towerOptions.find((option) => option.id === 'send_pet_first')?.available).toBe(true);
    expect(mineOptions.find((option) => option.id === 'split_star_vein')?.available).toBe(true);
    expect(metroOptions.find((option) => option.id === 'anchor_last_train')?.available).toBe(true);
  });

  it('returns failure outcomes when a conditional choice is attempted without its requirements', () => {
    const event = getDungeonEvents('demon_tower_1')[0];

    const evaluated = evaluateEventOptions(event, blankContext);
    const resolved = resolveDungeonEventChoice(event, 'breathe_through_runes', blankContext);

    expect(evaluated.find((option) => option.id === 'breathe_through_runes')?.available).toBe(false);
    expect(resolved.success).toBe(false);
    expect(resolved.damage).toBeGreaterThan(0);
    expect(resolved.temporaryLog).toContain('吐纳');
  });

  it('resolves a high-risk high-reward arena choice when its combat condition is met', () => {
    const event = getDungeonEvents('ash_arena')[0];
    const duelist: DungeonEventContext = {
      ...blankContext,
      stats: { ...blankContext.stats, attack: 25, speed: 15 },
      activePetPassiveTags: ['combat_assist']
    };

    const evaluated = evaluateEventOptions(event, duelist).find((option) => option.id === 'accept_judge_wager');
    const resolved = resolveDungeonEventChoice(event, 'accept_judge_wager', duelist);

    expect(evaluated?.risk).toBe('high');
    expect(evaluated?.available).toBe(true);
    expect(resolved.success).toBe(true);
    expect(resolved.rewardPoints).toBeGreaterThan(500);
    expect(resolved.items).toMatchObject({ cracked_core: 1 });
    expect(resolved.damage).toBeGreaterThan(0);
  });

  it('scales temporal calibration choices to Tier 8 rewards and risks', () => {
    const [pastEvent, futureEvent] = getDungeonEvents('temporal_observatory');
    const temporalOptions = [pastEvent, futureEvent].flatMap((event) => event.options);
    const calibrated: DungeonEventContext = {
      ...blankContext,
      ownedEquipment: ['chronal_lens', 'chronal_aegis', 'chronal_edge'],
      equipped: ['chronal_lens'],
      stats: { ...blankContext.stats, trapCheck: 18, speed: 20 }
    };

    expect(DUNGEONS.temporal_observatory).toMatchObject({ tier: 8, recommendedPower: 435 });
    expect([pastEvent.nodeId, futureEvent.nodeId]).toEqual([
      'past_calibration_anchor',
      'future_calibration_anchor'
    ]);
    expect(Math.min(...temporalOptions.map((option) => option.outcome.rewardPoints ?? 0))).toBeGreaterThanOrEqual(620);
    expect(Math.min(...temporalOptions.map((option) => option.failureOutcome?.damage ?? 0))).toBeGreaterThanOrEqual(56);
    expect(evaluateEventOptions(pastEvent, calibrated).every((option) => option.available)).toBe(true);
    expect(evaluateEventOptions(futureEvent, calibrated).every((option) => option.available)).toBe(true);

    const pastRisk = resolveDungeonEventChoice(pastEvent, 'overwrite_past_drift', calibrated);
    const futureRisk = resolveDungeonEventChoice(futureEvent, 'cut_to_zero_hour', calibrated);
    expect(pastRisk).toMatchObject({
      success: true,
      rewardPoints: 860,
      lingyun: 3,
      items: { chronal_glass: 2 },
      damage: 24
    });
    expect(futureRisk).toMatchObject({
      success: true,
      rewardPoints: 920,
      lingyun: 3,
      items: { chronal_glass: 2 },
      damage: 28
    });

    const failed = resolveDungeonEventChoice(futureEvent, 'cut_to_zero_hour', blankContext);
    expect(failed).toMatchObject({ success: false, damage: 72 });
  });

  it('defines exactly two causal events and keeps copied debt independent from law-ledger state', () => {
    const events = getDungeonEvents('causal_clearinghouse');
    const dungeon = DUNGEONS.causal_clearinghouse;
    const bossNodeId = getBossDefinition('causal_clearinghouse').nodeId;

    expect(dungeon.tier).toBe(9);
    expect(events).toHaveLength(2);
    expect(events.map((event) => [event.id, event.nodeId])).toEqual([
      ['causal_debt_reversal', 'contradiction_line'],
      ['entry_docket_appeal', 'entry_docket']
    ]);

    for (const event of events) {
      const node = dungeon.nodes.find((candidate) => candidate.id === event.nodeId);
      expect(node).toBeDefined();
      expect(node?.id).not.toBe(bossNodeId);
      expect(node?.type).not.toBe('exit');
      expect(node?.type).not.toBe('portal');
      expect(event.options).toHaveLength(2);
      for (const option of event.options) {
        expect(option.outcome.items?.causal_seal).toBeGreaterThan(0);
      }
    }

    const debtEvent = events[0];
    const contextSnapshot = structuredClone(blankContext);
    const copied = evaluateEventOptions(debtEvent, blankContext).find(
      (option) => option.id === 'copy_reversal_clause'
    );
    expect(copied).toMatchObject({
      available: true,
      requirements: [{ type: 'none' }],
      unmetRequirements: []
    });
    expect(resolveDungeonEventChoice(debtEvent, 'copy_reversal_clause', blankContext)).toMatchObject({
      success: true,
      items: { causal_seal: 1 }
    });
    expect(blankContext).toEqual(contextSnapshot);
  });

  it('defines the two entropy events with stable one-crystal and risky two-crystal branches', () => {
    const events = getDungeonEvents('entropy_ark');

    expect(events.map((event) => [event.id, event.nodeId])).toEqual([
      ['entropy_wake_inversion', 'wake_inversion'],
      ['ark_manifest_reconciliation', 'ark_manifest']
    ]);
    for (const event of events) {
      expect(event.options).toHaveLength(2);
      const [stable, risky] = event.options;
      expect(stable).toMatchObject({ risk: 'low', outcome: { items: { entropy_crystal: 1 } } });
      expect(risky).toMatchObject({ risk: 'high', outcome: { items: { entropy_crystal: 2 } } });
      expect(risky.outcome.rewardPoints).toBeGreaterThan(stable.outcome.rewardPoints ?? 0);
      expect(risky.outcome.damage).toBeGreaterThan(0);
      expect(risky.failureOutcome?.damage).toBeGreaterThan(stable.failureOutcome?.damage ?? 0);
    }
  });

  it('defines the two mirror-city events above entropy with one-glass and two-glass branches', () => {
    const events = getDungeonEvents('mirror_cycle_city');
    const entropyOptions = getDungeonEvents('entropy_ark').flatMap((event) => event.options);
    const maxEntropyStableReward = Math.max(...entropyOptions.filter(({ risk }) => risk === 'low').map(({ outcome }) => outcome.rewardPoints ?? 0));
    const maxEntropyRiskyReward = Math.max(...entropyOptions.filter(({ risk }) => risk === 'high').map(({ outcome }) => outcome.rewardPoints ?? 0));

    expect(events.map((event) => [event.id, event.nodeId])).toEqual([
      ['faceless_procession', 'cycle_manifest'],
      ['identity_rehearsal', 'reflection_event_stage']
    ]);
    for (const event of events) {
      expect(event.options).toHaveLength(2);
      const [stable, risky] = event.options;
      expect(stable).toMatchObject({ risk: 'low', outcome: { items: { phase_glass: 1 } } });
      expect(risky).toMatchObject({ risk: 'high', outcome: { items: { phase_glass: 2 } } });
      expect(stable.outcome.rewardPoints).toBeGreaterThan(maxEntropyStableReward);
      expect(risky.outcome.rewardPoints).toBeGreaterThan(maxEntropyRiskyReward);
      expect(risky.outcome.damage).toBeGreaterThan(0);
      expect(risky.failureOutcome?.damage).toBeGreaterThan(stable.failureOutcome?.damage ?? 0);
    }
  });

  it('defines exactly the two Tier-12 authored events with real ink risks and equipment-memory testimony', () => {
    const events = getDungeonEvents('redaction_scriptorium');
    const [erratum, testimony] = events;
    const prepared: DungeonEventContext = {
      ...blankContext,
      learnedMethods: ['gate_sense', 'void_heart'],
      ownedEquipment: ['redline_edge', 'palimpsest_mantle', 'final_proof_seal'],
      equipped: ['redline_edge'],
      inventory: { redaction_ink: 2 },
      stats: { ...blankContext.stats, attack: 34, trapCheck: 31 }
    };

    expect(events.map((event) => [event.id, event.nodeId])).toEqual([
      ['first_erratum', 'final_proof_nexus'],
      ['palimpsest_testimony', 'errata_event_stage']
    ]);
    expect(events).toHaveLength(2);
    expect(DUNGEONS.redaction_scriptorium).toMatchObject({ tier: 12, recommendedPower: 700 });
    expect(evaluateEventOptions(erratum, prepared).every((option) => option.available)).toBe(true);
    expect(evaluateEventOptions(testimony, prepared).every((option) => option.available)).toBe(true);
    expect(erratum.options).toEqual([
      expect.objectContaining({ id: 'authenticate_first_erratum', risk: 'low', requirements: expect.arrayContaining([{ type: 'method', methodId: 'gate_sense', description: '学会观门法' }, { type: 'item', itemId: 'redaction_ink', count: 1, description: '持有删界墨 1' }]), outcome: expect.objectContaining({ items: { redaction_ink: 1 } }) }),
      expect.objectContaining({ id: 'redline_first_erratum', risk: 'high', requirements: expect.arrayContaining([expect.objectContaining({ type: 'equipment', equipmentId: 'redline_edge' }), expect.objectContaining({ type: 'stat', stat: 'attack', min: 34 })]), outcome: expect.objectContaining({ items: { redaction_ink: 2 }, damage: 46 }) })
    ]);
    expect(testimony.options).toEqual([
      expect.objectContaining({ id: 'preserve_unredacted_testimony', risk: 'low', requirements: expect.arrayContaining([expect.objectContaining({ type: 'method', methodId: 'void_heart' }), expect.objectContaining({ type: 'item', itemId: 'redaction_ink', count: 1 })]), outcome: expect.objectContaining({ items: { redaction_ink: 1 } }) }),
      expect.objectContaining({ id: 'cross_examine_every_palimpsest', risk: 'high', requirements: expect.arrayContaining([expect.objectContaining({ type: 'equipment', equipmentId: 'final_proof_seal' }), expect.objectContaining({ type: 'item', itemId: 'redaction_ink', count: 1 }), expect.objectContaining({ type: 'stat', stat: 'trapCheck', min: 31 })]), outcome: expect.objectContaining({ items: { redaction_ink: 3 }, damage: 50 }) })
    ]);
    expect(resolveDungeonEventChoice(testimony, 'cross_examine_every_palimpsest', blankContext)).toMatchObject({ success: false, damage: 122 });
  });

  it('defines exactly the two Tier-13 auction events with provenance and the dead-team memory signal', () => {
    const events = getDungeonEvents('legacy_auction_court');
    const [provenance, testimony] = events;
    const redactionOptions = getDungeonEvents('redaction_scriptorium').flatMap((event) => event.options);
    const prepared: DungeonEventContext = {
      ...blankContext,
      learnedMethods: ['gate_sense', 'void_heart'],
      ownedEquipment: ['legacy_gavel', 'anonymous_veil', 'final_lot_bell'],
      equipped: ['legacy_gavel'],
      inventory: { legacy_scrip: 2 },
      stats: { ...blankContext.stats, attack: 37, trapCheck: 34 }
    };

    expect(events.map((event) => [event.id, event.nodeId])).toEqual([
      ['provenance_dispute', 'provenance_event_stage'],
      ['dead_team_testimony', 'dead_team_testimony_stage']
    ]);
    expect(events).toHaveLength(2);
    expect(evaluateEventOptions(provenance, prepared).every((option) => option.available)).toBe(true);
    expect(evaluateEventOptions(testimony, prepared).every((option) => option.available)).toBe(true);
    expect(provenance.options).toEqual([
      expect.objectContaining({
        id: 'certify_hammer_chain_provenance',
        risk: 'low',
        requirements: expect.arrayContaining([
          expect.objectContaining({ type: 'method', methodId: 'gate_sense' }),
          expect.objectContaining({ type: 'item', itemId: 'legacy_scrip', count: 1 })
        ]),
        outcome: expect.objectContaining({ rewardPoints: 1180, items: { legacy_scrip: 1 } })
      }),
      expect.objectContaining({
        id: 'break_anonymous_bid_chain',
        risk: 'high',
        requirements: expect.arrayContaining([
          expect.objectContaining({ type: 'equipment', equipmentId: 'legacy_gavel' }),
          expect.objectContaining({ type: 'stat', stat: 'attack', min: 37 })
        ]),
        outcome: expect.objectContaining({ rewardPoints: 1620, items: { legacy_scrip: 2 }, damage: 54 })
      })
    ]);
    expect(testimony.options).toEqual([
      expect.objectContaining({
        id: 'preserve_dead_team_reserve',
        risk: 'low',
        requirements: expect.arrayContaining([
          expect.objectContaining({ type: 'method', methodId: 'void_heart' }),
          expect.objectContaining({ type: 'equipment', equipmentId: 'anonymous_veil' }),
          expect.objectContaining({ type: 'item', itemId: 'legacy_scrip', count: 1 })
        ]),
        outcome: expect.objectContaining({ rewardPoints: 1240, items: { legacy_scrip: 1 } })
      }),
      expect.objectContaining({
        id: 'ring_final_lot_for_all_testimony',
        risk: 'high',
        requirements: expect.arrayContaining([
          expect.objectContaining({ type: 'equipment', equipmentId: 'final_lot_bell' }),
          expect.objectContaining({ type: 'item', itemId: 'legacy_scrip', count: 1 }),
          expect.objectContaining({ type: 'stat', stat: 'trapCheck', min: 34 })
        ]),
        outcome: expect.objectContaining({ rewardPoints: 1700, items: { legacy_scrip: 3 }, damage: 58 })
      })
    ]);

    const maxTier12Reward = Math.max(...redactionOptions.map((option) => option.outcome.rewardPoints ?? 0));
    expect(Math.max(...events.flatMap((event) => event.options).map((option) => option.outcome.rewardPoints ?? 0))).toBeGreaterThan(maxTier12Reward);
    expect(resolveDungeonEventChoice(testimony, 'ring_final_lot_for_all_testimony', blankContext)).toMatchObject({ success: false, damage: 134 });
  });

  it('defines the two Tier-14 genesis events with paid branches and an ancestor memory signal', () => {
    const events = getDungeonEvents('genesis_vault');
    const [mosaic, ancestor] = events;
    const prepared: DungeonEventContext = {
      ...blankContext,
      learnedMethods: ['gate_sense'],
      ownedEquipment: ['helix_cleaver'],
      equipped: ['helix_cleaver'],
      inventory: { focus_incense: 1, dispel_talisman: 1 },
      stats: { ...blankContext.stats, spirit: 10, attack: 40, trapCheck: 36 }
    };

    expect(events.map((event) => [event.id, event.nodeId, event.title])).toEqual([
      ['mosaic_proof', 'mosaic_gene_vault', '嵌合证明'],
      ['ancestor_echo', 'lineage_event_stage', '祖型回声']
    ]);
    expect(events).toHaveLength(2);
    expect(evaluateEventOptions(mosaic, prepared).every((option) => option.available)).toBe(true);
    expect(evaluateEventOptions(ancestor, prepared).every((option) => option.available)).toBe(true);
    expect(mosaic.options).toEqual([
      expect.objectContaining({
        id: 'calibrate_mosaic_lineage',
        risk: 'low',
        requirements: expect.arrayContaining([
          expect.objectContaining({ type: 'method', methodId: 'gate_sense' }),
          expect.objectContaining({ type: 'stat', stat: 'trapCheck', min: 36 })
        ]),
        outcome: expect.objectContaining({ rewardPoints: 1320, items: { genesis_serum: 1 } }),
        failureOutcome: expect.objectContaining({ success: false, damage: 118 })
      }),
      expect.objectContaining({
        id: 'sample_live_mosaic',
        risk: 'high',
        requirements: expect.arrayContaining([
          expect.objectContaining({ type: 'equipment', equipmentId: 'helix_cleaver' }),
          expect.objectContaining({ type: 'stat', stat: 'attack', min: 40 })
        ]),
        outcome: expect.objectContaining({ rewardPoints: 1840, items: { genesis_serum: 2 }, damage: 64 }),
        failureOutcome: expect.objectContaining({ success: false, damage: 146 })
      })
    ]);
    expect(ancestor.options).toEqual([
      expect.objectContaining({
        id: 'acknowledge_ancestor_echo',
        requirements: expect.arrayContaining([
          expect.objectContaining({ type: 'item', itemId: 'focus_incense', count: 1 }),
          expect.objectContaining({ type: 'stat', stat: 'spirit', min: 10 })
        ]),
        outcome: expect.objectContaining({ success: true, items: { genesis_serum: 1, method_page: 1 } })
      }),
      expect.objectContaining({
        id: 'sever_tainted_ancestor_echo',
        requirements: [expect.objectContaining({ type: 'item', itemId: 'dispel_talisman', count: 1 })],
        outcome: expect.objectContaining({ success: true, items: { genesis_serum: 1 } })
      })
    ]);

    expect(resolveDungeonEventChoice(ancestor, 'acknowledge_ancestor_echo', prepared).success).toBe(true);
    expect(ancestor.id).toBe('ancestor_echo');
    expect(resolveDungeonEventChoice(ancestor, 'acknowledge_ancestor_echo', blankContext)).toMatchObject({ success: false, damage: 126 });
    expect(resolveDungeonEventChoice(ancestor, 'sever_tainted_ancestor_echo', blankContext)).toMatchObject({ success: false, damage: 112 });
    expect(resolveDungeonEventChoice(mosaic, 'sample_live_mosaic', blankContext)).toMatchObject({ success: false, damage: 146 });
  });

  it('defines the two Tier-15 broadcast events with paid, failed, memory, and repeat-stable outcomes', () => {
    const events = getDungeonEvents('silent_broadcast_tower');
    const [borrowedVoice, lastBroadcast] = events;
    const prepared: DungeonEventContext = {
      ...blankContext,
      inventory: { dispel_talisman: 1, focus_incense: 1 },
      stats: { ...blankContext.stats, spirit: 13, trapCheck: 39 }
    };

    expect(events.map((event) => [event.id, event.nodeId, event.title])).toEqual([
      ['borrowed_voice', 'dead_air_gallery', '借来的队友声音'],
      ['last_broadcast', 'broadcast_memory_stage', '最后一段人声']
    ]);
    expect(evaluateEventOptions(borrowedVoice, prepared).every((option) => option.available)).toBe(true);
    expect(evaluateEventOptions(lastBroadcast, prepared).every((option) => option.available)).toBe(true);
    expect(borrowedVoice.options).toEqual([
      expect.objectContaining({
        id: 'answer_borrowed_voice',
        requirements: expect.arrayContaining([
          expect.objectContaining({ type: 'stat', stat: 'spirit', min: 12 }),
          expect.objectContaining({ type: 'stat', stat: 'trapCheck', min: 39 })
        ]),
        outcome: expect.objectContaining({ rewardPoints: 1540, items: { silence_core: 1 } }),
        failureOutcome: expect.objectContaining({ success: false, damage: 172 })
      }),
      expect.objectContaining({
        id: 'sever_borrowed_voice',
        requirements: [expect.objectContaining({ type: 'item', itemId: 'dispel_talisman', count: 1 })],
        outcome: expect.objectContaining({ rewardPoints: 1320, items: { silence_core: 1 } }),
        failureOutcome: expect.objectContaining({ success: false, damage: 168 })
      })
    ]);
    expect(lastBroadcast.options).toEqual([
      expect.objectContaining({
        id: 'listen_to_last_broadcast',
        requirements: [expect.objectContaining({ type: 'stat', stat: 'spirit', min: 13 })],
        outcome: expect.objectContaining({ success: true, rewardPoints: 1980, items: { silence_core: 2, method_page: 1 }, damage: 72 }),
        failureOutcome: expect.objectContaining({ success: false, damage: 178 })
      }),
      expect.objectContaining({
        id: 'overwrite_last_broadcast_noise',
        requirements: [expect.objectContaining({ type: 'item', itemId: 'focus_incense', count: 1 })],
        outcome: expect.objectContaining({ success: true, rewardPoints: 1480, items: { silence_core: 1 } }),
        failureOutcome: expect.objectContaining({ success: false, damage: 170 })
      })
    ]);

    const snapshot = structuredClone(prepared);
    const first = resolveDungeonEventChoice(lastBroadcast, 'listen_to_last_broadcast', prepared);
    const repeated = resolveDungeonEventChoice(lastBroadcast, 'listen_to_last_broadcast', prepared);
    expect(first).toEqual(repeated);
    expect(first.temporaryLog).toContain('随身装备记住');
    expect(prepared).toEqual(snapshot);
    expect(resolveDungeonEventChoice(borrowedVoice, 'answer_borrowed_voice', blankContext)).toMatchObject({ success: false, damage: 172 });
    expect(resolveDungeonEventChoice(borrowedVoice, 'sever_borrowed_voice', blankContext)).toMatchObject({ success: false, damage: 168 });
    expect(resolveDungeonEventChoice(lastBroadcast, 'overwrite_last_broadcast_noise', blankContext)).toMatchObject({ success: false, damage: 170 });
  });

  it('defines the two Tier-16 shelter events with discernment, paid cuts, memory listening, and stable failures', () => {
    const events = getDungeonEvents('lost_shelter');
    const [falseCall, rollCall] = events;
    const prepared: DungeonEventContext = {
      ...blankContext,
      inventory: { dispel_talisman: 1, focus_incense: 1 },
      stats: { ...blankContext.stats, spirit: 15 }
    };

    expect(events.map((event) => [event.id, event.nodeId, event.title])).toEqual([
      ['false_survivor_call', 'survivor_cell', '隔离舱里的求救'],
      ['last_roll_call', 'survivor_memory_stage', '最后一次点名']
    ]);
    expect(evaluateEventOptions(falseCall, prepared).every((option) => option.available)).toBe(true);
    expect(evaluateEventOptions(rollCall, prepared).every((option) => option.available)).toBe(true);
    expect(falseCall.options).toEqual([
      expect.objectContaining({
        id: 'discern_false_survivor_call',
        requirements: [expect.objectContaining({ type: 'stat', stat: 'spirit', min: 14 })],
        outcome: expect.objectContaining({ rewardPoints: 1650, items: { rescue_badge: 1 } }),
        failureOutcome: expect.objectContaining({ success: false, damage: 185 })
      }),
      expect.objectContaining({
        id: 'sever_false_survivor_call',
        requirements: [expect.objectContaining({ type: 'item', itemId: 'dispel_talisman', count: 1 })],
        outcome: expect.objectContaining({ rewardPoints: 1420, items: { rescue_badge: 1 } }),
        failureOutcome: expect.objectContaining({ success: false, damage: 182 })
      })
    ]);
    expect(rollCall.options).toEqual([
      expect.objectContaining({
        id: 'persist_last_roll_call',
        requirements: [expect.objectContaining({ type: 'stat', stat: 'spirit', min: 15 })],
        outcome: expect.objectContaining({ success: true, rewardPoints: 2140, items: { rescue_badge: 1, method_page: 1 }, damage: 78 }),
        failureOutcome: expect.objectContaining({ success: false, damage: 190 })
      }),
      expect.objectContaining({
        id: 'confirm_last_roll_call_identity',
        requirements: [expect.objectContaining({ type: 'item', itemId: 'focus_incense', count: 1 })],
        outcome: expect.objectContaining({ success: true, rewardPoints: 1580, items: { rescue_badge: 1 } }),
        failureOutcome: expect.objectContaining({ success: false, damage: 184 })
      })
    ]);

    const snapshot = structuredClone(prepared);
    const first = resolveDungeonEventChoice(rollCall, 'persist_last_roll_call', prepared);
    const repeated = resolveDungeonEventChoice(rollCall, 'persist_last_roll_call', prepared);
    expect(first).toEqual(repeated);
    expect(first.temporaryLog).toContain('随身装备记住');
    expect(resolveDungeonEventChoice(rollCall, 'confirm_last_roll_call_identity', prepared).temporaryLog).toContain('随身装备');
    expect(prepared).toEqual(snapshot);
    expect(resolveDungeonEventChoice(falseCall, 'discern_false_survivor_call', blankContext)).toMatchObject({ success: false, damage: 185 });
    expect(resolveDungeonEventChoice(falseCall, 'sever_false_survivor_call', blankContext)).toMatchObject({ success: false, damage: 182 });
    expect(resolveDungeonEventChoice(rollCall, 'persist_last_roll_call', blankContext)).toMatchObject({ success: false, damage: 190 });
    expect(resolveDungeonEventChoice(rollCall, 'confirm_last_roll_call_identity', blankContext)).toMatchObject({ success: false, damage: 184 });
  });

  it('defines the two Tier-17 testimony events with anonymous verification and memory listening', () => {
    const events = getDungeonEvents('false_testimony_court');
    const [anonymousTip, sealedDeposition] = events;
    const prepared: DungeonEventContext = {
      ...blankContext,
      inventory: { dispel_talisman: 1, focus_incense: 1 },
      stats: { ...blankContext.stats, spirit: 17 }
    };

    expect(events.map((event) => [event.id, event.nodeId, event.title])).toEqual([
      ['anonymous_tip', 'testimony_hall', '匿名线报的第四句话'],
      ['sealed_deposition', 'cross_exam_stage', '封存证言的最后追问']
    ]);
    expect(evaluateEventOptions(anonymousTip, prepared).every((option) => option.available)).toBe(true);
    expect(evaluateEventOptions(sealedDeposition, prepared).every((option) => option.available)).toBe(true);
    expect(anonymousTip.options).toEqual([
      expect.objectContaining({
        id: 'cross_check_anonymous_tip',
        requirements: [expect.objectContaining({ type: 'stat', stat: 'spirit', min: 16 })],
        outcome: expect.objectContaining({ rewardPoints: 1780, items: { truth_fragment: 1 } }),
        failureOutcome: expect.objectContaining({ success: false, damage: 198 })
      }),
      expect.objectContaining({
        id: 'seal_anonymous_tip_channel',
        requirements: [expect.objectContaining({ type: 'item', itemId: 'dispel_talisman', count: 1 })],
        outcome: expect.objectContaining({ rewardPoints: 1510, items: { truth_fragment: 1 } }),
        failureOutcome: expect.objectContaining({ success: false, damage: 194 })
      })
    ]);
    expect(sealedDeposition.options).toEqual([
      expect.objectContaining({
        id: 'press_sealed_deposition',
        requirements: [expect.objectContaining({ type: 'stat', stat: 'spirit', min: 17 })],
        outcome: expect.objectContaining({ rewardPoints: 2260, items: { truth_fragment: 1, method_page: 1 }, damage: 84 }),
        failureOutcome: expect.objectContaining({ success: false, damage: 205 })
      }),
      expect.objectContaining({
        id: 'stabilize_sealed_deposition',
        requirements: [expect.objectContaining({ type: 'item', itemId: 'focus_incense', count: 1 })],
        outcome: expect.objectContaining({ rewardPoints: 1640, items: { truth_fragment: 1 } }),
        failureOutcome: expect.objectContaining({ success: false, damage: 200 })
      })
    ]);

    const snapshot = structuredClone(prepared);
    expect(resolveDungeonEventChoice(sealedDeposition, 'press_sealed_deposition', prepared).temporaryLog).toContain('随身装备记住');
    expect(resolveDungeonEventChoice(sealedDeposition, 'stabilize_sealed_deposition', prepared).temporaryLog).toContain('随身装备记住');
    expect(prepared).toEqual(snapshot);
    expect(resolveDungeonEventChoice(anonymousTip, 'cross_check_anonymous_tip', blankContext)).toMatchObject({ success: false, damage: 198 });
    expect(resolveDungeonEventChoice(sealedDeposition, 'press_sealed_deposition', blankContext)).toMatchObject({ success: false, damage: 205 });
  });

  it('defines the two Tier-18 replay events on rehearsal and script projection hosts', () => {
    const events = getDungeonEvents('combat_replay_stage');
    const [uncreditedTake, lastRetake] = events;
    const prepared: DungeonEventContext = {
      ...blankContext,
      inventory: { dispel_talisman: 1, focus_incense: 1 },
      stats: { ...blankContext.stats, spirit: 19 }
    };

    expect(events.map((event) => [event.id, event.nodeId, event.title])).toEqual([
      ['uncredited_take', 'rehearsal_hall', '未署名试演'],
      ['last_retake', 'script_projection_stage', '最后一次重拍']
    ]);
    expect(evaluateEventOptions(uncreditedTake, prepared).every((option) => option.available)).toBe(true);
    expect(evaluateEventOptions(lastRetake, prepared).every((option) => option.available)).toBe(true);
    expect(uncreditedTake.options).toEqual([
      expect.objectContaining({
        id: 'trace_uncredited_take',
        requirements: [expect.objectContaining({ type: 'stat', stat: 'spirit', min: 18 })],
        outcome: expect.objectContaining({ rewardPoints: 1900, items: { combat_reel: 1 } }),
        failureOutcome: expect.objectContaining({ success: false, damage: 212 })
      }),
      expect.objectContaining({
        id: 'seal_uncredited_take',
        requirements: [expect.objectContaining({ type: 'item', itemId: 'dispel_talisman', count: 1 })],
        outcome: expect.objectContaining({ rewardPoints: 1620, items: { combat_reel: 1 } }),
        failureOutcome: expect.objectContaining({ success: false, damage: 208 })
      })
    ]);
    expect(lastRetake.options).toEqual([
      expect.objectContaining({
        id: 'perform_last_retake',
        requirements: [expect.objectContaining({ type: 'stat', stat: 'spirit', min: 19 })],
        outcome: expect.objectContaining({ rewardPoints: 2400, items: { combat_reel: 1, method_page: 1 }, damage: 90 }),
        failureOutcome: expect.objectContaining({ success: false, damage: 220 })
      }),
      expect.objectContaining({
        id: 'stabilize_last_retake',
        requirements: [expect.objectContaining({ type: 'item', itemId: 'focus_incense', count: 1 })],
        outcome: expect.objectContaining({ rewardPoints: 1760, items: { combat_reel: 1 } }),
        failureOutcome: expect.objectContaining({ success: false, damage: 216 })
      })
    ]);
  });

  it('defines the two Tier-19 panopticon events with shard and countermeasure outcomes', () => {
    const events = getDungeonEvents('panopticon_city');
    const [blindspotTheater, spectrumSwitchyard] = events;
    const prepared: DungeonEventContext = {
      ...blankContext,
      inventory: { focus_incense: 1, armor_patch: 1 },
      stats: { ...blankContext.stats, spirit: 20, trapCheck: 21 }
    };

    expect(events.map((event) => [event.id, event.nodeId, event.title])).toEqual([
      ['blindspot_theater', 'blindspot_theater', '盲区剧场的缺席观众'],
      ['spectrum_switchyard', 'spectrum_switchyard', '全谱道岔的反向折光']
    ]);
    expect(evaluateEventOptions(blindspotTheater, prepared).every((option) => option.available)).toBe(true);
    expect(evaluateEventOptions(spectrumSwitchyard, prepared).every((option) => option.available)).toBe(true);
    expect(blindspotTheater.options).toEqual([
      expect.objectContaining({
        id: 'trace_blindspot_audience',
        requirements: [expect.objectContaining({ type: 'stat', stat: 'spirit', min: 20 })],
        outcome: expect.objectContaining({ rewardPoints: 2020, items: { observation_shard: 1, dispel_talisman: 1 } }),
        failureOutcome: expect.objectContaining({ success: false, damage: 224 })
      }),
      expect.objectContaining({
        id: 'blackout_blindspot_theater',
        requirements: [expect.objectContaining({ type: 'item', itemId: 'focus_incense', count: 1 })],
        outcome: expect.objectContaining({ rewardPoints: 1740, items: { observation_shard: 1, armor_patch: 1 } }),
        failureOutcome: expect.objectContaining({ success: false, damage: 220 })
      })
    ]);
    expect(spectrumSwitchyard.options).toEqual([
      expect.objectContaining({
        id: 'invert_spectrum_switchyard',
        requirements: [expect.objectContaining({ type: 'stat', stat: 'trapCheck', min: 21 })],
        outcome: expect.objectContaining({ rewardPoints: 2540, items: { observation_shard: 2, dispel_talisman: 1 }, damage: 96 }),
        failureOutcome: expect.objectContaining({ success: false, damage: 232 })
      }),
      expect.objectContaining({
        id: 'shroud_spectrum_switchyard',
        requirements: [expect.objectContaining({ type: 'item', itemId: 'armor_patch', count: 1 })],
        outcome: expect.objectContaining({ rewardPoints: 1880, items: { observation_shard: 1, focus_incense: 1 } }),
        failureOutcome: expect.objectContaining({ success: false, damage: 228 })
      })
    ]);

    expect(resolveDungeonEventChoice(blindspotTheater, 'trace_blindspot_audience', blankContext)).toMatchObject({ success: false, damage: 224 });
    expect(resolveDungeonEventChoice(spectrumSwitchyard, 'invert_spectrum_switchyard', blankContext)).toMatchObject({ success: false, damage: 232 });
    expect(getDungeonEvents('combat_replay_stage').map(({ id }) => id)).toEqual(['uncredited_take', 'last_retake']);
  });
});
