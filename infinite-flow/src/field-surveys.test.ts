import { describe, expect, it } from 'vitest';
import { getBossDefinition } from './boss-system';
import { EQUIPMENT } from './game';
import { DUNGEONS } from './level-content';
import { FIELD_SURVEY_CATALOG, createFieldSurveyRunState, getFieldSurveyById, getFieldSurveyByNode, getFieldSurveyHpDelta, getFieldSurveyOptionStatus, isFieldSurveyRunState, markFieldSurveyResolved, normalizeFieldSurveyRunState, resolveFieldSurveyReward } from './field-surveys';

describe('field surveys', () => {
  it('defines nineteen surveys and forty-nine unique options', () => {
    expect(FIELD_SURVEY_CATALOG).toHaveLength(19);
    expect(new Set(FIELD_SURVEY_CATALOG.flatMap((survey) => survey.options.map((option) => option.id))).size).toBe(49);
    expect(getFieldSurveyById('survey_demon_bone_marrow')).toBe(getFieldSurveyByNode('demon_bone_cache'));
    expect(getFieldSurveyById('survey_temporal_observatory_deck')).toBe(getFieldSurveyByNode('field_observation_deck'));
    expect(getFieldSurveyById('survey_causal_evidence_dais')).toBe(getFieldSurveyByNode('evidence_survey_dais'));
    expect(getFieldSurveyById('survey_entropy_ballast_deck')).toBe(getFieldSurveyByNode('entropy_ballast_deck'));
    expect(getFieldSurveyById('survey_mirror_city_parallax')).toBe(getFieldSurveyByNode('mirror_city_survey'));
    expect(getFieldSurveyById('survey_redaction_memory_archive')).toBe(getFieldSurveyByNode('memory_survey_archive'));
    expect(getFieldSurveyById('survey_legacy_auction_archive')).toBe(getFieldSurveyByNode('archive_survey_gallery'));
    expect(getFieldSurveyById('survey_genesis_bloodline_archive')).toBe(getFieldSurveyByNode('bloodline_survey_archive'));
    expect(getFieldSurveyById('survey_silent_broadcast_archive')).toBe(getFieldSurveyByNode('field_survey_archive'));
    expect(getFieldSurveyById('survey_shelter_rescue_archive')?.nodeId).toBe('field_survey_archive');
    expect(getFieldSurveyById('survey_false_testimony_archive')?.nodeId).toBe('field_survey_archive');
    expect(getFieldSurveyById('survey_combat_replay_cutting_room')).toBe(getFieldSurveyByNode('field_survey_cutting_room'));
    expect(getFieldSurveyById('survey_panopticon_refraction_lab')).toBe(getFieldSurveyByNode('refraction_lab'));
  });

  it('covers every eight-branch attunement option and keeps costs separate from rewards', () => {
    expect(FIELD_SURVEY_CATALOG.flatMap((survey) => survey.options.map((item) => item.attunementId))).toEqual([
      'mist_vanguard', 'forge_overdrive', 'rift_resonance', 'rift_anchor', 'forge_overdrive', 'forge_channeling',
      'mist_veilguard', 'rift_anchor', 'forge_overdrive', 'mist_vanguard', 'forge_channeling', 'rift_resonance',
      'mist_veilguard', 'forge_channeling', 'chronal_acceleration', 'chronal_stasis', 'chronal_acceleration', 'rift_anchor',
      'chronal_acceleration', 'forge_channeling', 'rift_resonance', 'chronal_stasis', 'chronal_stasis', 'rift_resonance',
      'chronal_stasis', 'forge_overdrive', 'forge_overdrive', 'mist_veilguard', 'rift_anchor', 'chronal_stasis',
      'forge_overdrive', 'mist_veilguard', 'rift_anchor', 'chronal_stasis',
      'forge_overdrive', 'mist_veilguard', 'rift_anchor', 'chronal_stasis',
      'forge_overdrive', 'mist_veilguard', 'rift_anchor', 'chronal_stasis',
      'forge_overdrive', 'mist_veilguard', 'rift_anchor', 'chronal_stasis',
      'forge_overdrive', 'mist_veilguard', 'rift_anchor'
    ]);
    expect(getFieldSurveyById('survey_metro_lost_property')?.options[1]).toMatchObject({ cost: { echo_coin: 1 }, itemDelta: { gate_sigil: 1 } });
    expect(getFieldSurveyById('survey_hospital_emergency_stock')?.options[1]).toMatchObject({ cost: { dispel_talisman: 1 }, itemDelta: { gate_sigil: 1, medicine_ash: 1 } });
    expect(getFieldSurveyById('survey_temporal_observatory_deck')?.options[1]).toMatchObject({ cost: { gate_sigil: 1 }, lingyunDelta: 4, hpPercent: 15 });
    expect(getFieldSurveyById('survey_causal_evidence_dais')).toMatchObject({
      nodeId: 'evidence_survey_dais',
      options: [
        { attunementId: 'chronal_acceleration', itemDelta: { causal_seal: 1 }, hpPercent: -24 },
        { attunementId: 'rift_anchor', lingyunDelta: 4, hpPercent: 18 }
      ]
    });
    expect(getFieldSurveyById('survey_entropy_ballast_deck')).toMatchObject({
      nodeId: 'entropy_ballast_deck',
      options: [
        { id: 'chronal_acceleration_entropy_forecast', attunementId: 'chronal_acceleration', rewardPointsPercent: 190, itemDelta: { entropy_crystal: 1 }, hpPercent: -26 },
        { id: 'forge_channeling_ballast_recovery', attunementId: 'forge_channeling', rewardPointsPercent: 90, lingyunDelta: 5, hpPercent: 20 }
      ]
    });
    expect(getFieldSurveyById('survey_mirror_city_parallax')).toMatchObject({
      nodeId: 'mirror_city_survey',
      options: [
        { id: 'rift_resonance_parallax_refraction', attunementId: 'rift_resonance', rewardPointsPercent: 200, itemDelta: { phase_glass: 1 }, hpPercent: -28 },
        { id: 'chronal_stasis_mirror_alignment', attunementId: 'chronal_stasis', rewardPointsPercent: 95, cost: { gate_sigil: 1 }, lingyunDelta: 6, hpPercent: 22 }
      ]
    });
    expect(getFieldSurveyById('survey_redaction_memory_archive')).toMatchObject({
      nodeId: 'memory_survey_archive',
      options: [
        { id: 'chronal_stasis_restore_deleted_line', attunementId: 'chronal_stasis', rewardPointsPercent: 100, cost: { gate_sigil: 1 }, lingyunDelta: 7, hpPercent: 24 },
        { id: 'rift_resonance_extract_redaction_ink', attunementId: 'rift_resonance', rewardPointsPercent: 210, itemDelta: { redaction_ink: 2 }, hpPercent: -30 }
      ]
    });
    expect(getFieldSurveyById('survey_legacy_auction_archive')).toMatchObject({
      nodeId: 'archive_survey_gallery',
      options: [
        { id: 'chronal_stasis_verify_hammer_chain', attunementId: 'chronal_stasis', rewardPointsPercent: 105, cost: { legacy_scrip: 1 }, lingyunDelta: 8, hpPercent: 26 },
        { id: 'forge_resonance_melt_counterfeit_lot', attunementId: 'forge_overdrive', rewardPointsPercent: 220, itemDelta: { legacy_scrip: 2 }, hpPercent: -32 }
      ]
    });
    expect(getFieldSurveyById('survey_genesis_bloodline_archive')).toMatchObject({
      nodeId: 'bloodline_survey_archive',
      options: [
        { id: 'forge_overdrive_helix_source_sample', attunementId: 'forge_overdrive', rewardPointsPercent: 230, itemDelta: { genesis_serum: 2 }, hpPercent: -34 },
        { id: 'mist_veilguard_symbiote_archive', attunementId: 'mist_veilguard', rewardPointsPercent: 115, itemDelta: { method_page: 1 }, lingyunDelta: 9, hpPercent: 26 },
        { id: 'rift_anchor_carapace_safe_sample', attunementId: 'rift_anchor', rewardPointsPercent: 110, cost: { genesis_serum: 1 }, itemDelta: { rift_dust: 1 }, hpPercent: 30 },
        { id: 'chronal_stasis_rebirth_snapshot', attunementId: 'chronal_stasis', rewardPointsPercent: 108, cost: { genesis_serum: 1 }, itemDelta: { chronal_glass: 1 }, lingyunDelta: 5 }
      ]
    });
    expect(getFieldSurveyById('survey_silent_broadcast_archive')).toMatchObject({
      nodeId: 'field_survey_archive',
      options: [
        { id: 'forge_overdrive_hushblade_frequency_cut', attunementId: 'forge_overdrive', rewardPointsPercent: 240, itemDelta: { silence_core: 2 }, hpPercent: -36 },
        { id: 'mist_veilguard_dead_air_listening', attunementId: 'mist_veilguard', rewardPointsPercent: 122, itemDelta: { method_page: 1 }, lingyunDelta: 10, hpPercent: 28 },
        { id: 'rift_anchor_anechoic_pressure_sample', attunementId: 'rift_anchor', rewardPointsPercent: 118, cost: { silence_core: 1 }, itemDelta: { rift_dust: 1 }, hpPercent: 32 },
        { id: 'chronal_stasis_last_channel_snapshot', attunementId: 'chronal_stasis', rewardPointsPercent: 116, cost: { silence_core: 1 }, itemDelta: { chronal_glass: 1 }, lingyunDelta: 6 }
      ]
    });
    expect(getFieldSurveyById('survey_shelter_rescue_archive')).toMatchObject({
      nodeId: 'field_survey_archive',
      options: [
        { id: 'forge_overdrive_rescue_carbine_breach', attunementId: 'forge_overdrive', rewardPointsPercent: 250, itemDelta: { rescue_badge: 2 }, hpPercent: -38 },
        { id: 'mist_veilguard_triage_roster', attunementId: 'mist_veilguard', rewardPointsPercent: 128, itemDelta: { method_page: 1 }, lingyunDelta: 11, hpPercent: 30 },
        { id: 'rift_anchor_evacuation_plate_recovery', attunementId: 'rift_anchor', rewardPointsPercent: 124, cost: { rescue_badge: 1 }, itemDelta: { rift_dust: 1 }, hpPercent: 34 },
        { id: 'chronal_stasis_blackbox_snapshot', attunementId: 'chronal_stasis', rewardPointsPercent: 122, cost: { rescue_badge: 1 }, itemDelta: { chronal_glass: 1 }, lingyunDelta: 7 }
      ]
    });
    expect(getFieldSurveyById('survey_false_testimony_archive')).toMatchObject({
      nodeId: 'field_survey_archive',
      options: [
        { id: 'forge_overdrive_cross_examiner_chain', attunementId: 'forge_overdrive', rewardPointsPercent: 260, itemDelta: { truth_fragment: 2 }, hpPercent: -40 },
        { id: 'mist_veilguard_forensic_review', attunementId: 'mist_veilguard', rewardPointsPercent: 134, itemDelta: { method_page: 1 }, lingyunDelta: 12, hpPercent: 32 },
        { id: 'rift_anchor_custody_bank_sample', attunementId: 'rift_anchor', rewardPointsPercent: 130, cost: { truth_fragment: 1 }, itemDelta: { rift_dust: 1 }, hpPercent: 36 },
        { id: 'chronal_stasis_appeal_snapshot', attunementId: 'chronal_stasis', rewardPointsPercent: 128, cost: { truth_fragment: 1 }, itemDelta: { chronal_glass: 1 }, lingyunDelta: 8 }
      ]
    });
    expect(getFieldSurveyById('survey_combat_replay_cutting_room')).toMatchObject({
      nodeId: 'field_survey_cutting_room',
      options: [
        { id: 'forge_overdrive_frame_engraver_cut', attunementId: 'forge_overdrive', rewardPointsPercent: 270, itemDelta: { combat_reel: 2 }, hpPercent: -42 },
        { id: 'mist_veilguard_cue_visor_review', attunementId: 'mist_veilguard', rewardPointsPercent: 140, itemDelta: { method_page: 1 }, lingyunDelta: 13, hpPercent: 34 },
        { id: 'rift_anchor_buffer_plate_sample', attunementId: 'rift_anchor', rewardPointsPercent: 136, cost: { combat_reel: 1 }, itemDelta: { rift_dust: 1 }, hpPercent: 38 },
        { id: 'chronal_stasis_thaw_metronome_snapshot', attunementId: 'chronal_stasis', rewardPointsPercent: 134, cost: { combat_reel: 1 }, itemDelta: { chronal_glass: 1 }, lingyunDelta: 9 }
      ]
    });
    expect(getFieldSurveyById('survey_panopticon_refraction_lab')).toEqual({
      id: 'survey_panopticon_refraction_lab',
      nodeId: 'refraction_lab',
      options: [
        { id: 'forge_overdrive_blindline_cutter_test', attunementId: 'forge_overdrive', name: '盲线切割器炉压断视', rewardPointsPercent: 280, itemDelta: { observation_shard: 2 }, hpPercent: -44 },
        { id: 'mist_veilguard_predictive_visor_audit', attunementId: 'mist_veilguard', name: '预判目镜雾护逆读', rewardPointsPercent: 146, itemDelta: { method_page: 1 }, lingyunDelta: 14, hpPercent: 36 },
        { id: 'rift_anchor_matte_prism_refraction', attunementId: 'rift_anchor', name: '消光护壳与逆向棱镜联合折射', rewardPointsPercent: 142, cost: { observation_shard: 1 }, itemDelta: { rift_dust: 1, chronal_glass: 1 }, lingyunDelta: 10, hpPercent: 40 }
      ]
    });
  });

  it('places late-tier surveys on real non-terminal nodes', () => {
    for (const [dungeonId, nodeId] of [['causal_clearinghouse', 'evidence_survey_dais'], ['mirror_cycle_city', 'mirror_city_survey'], ['redaction_scriptorium', 'memory_survey_archive'], ['legacy_auction_court', 'archive_survey_gallery'], ['genesis_vault', 'bloodline_survey_archive'], ['silent_broadcast_tower', 'field_survey_archive'], ['lost_shelter', 'field_survey_archive'], ['false_testimony_court', 'field_survey_archive'], ['combat_replay_stage', 'field_survey_cutting_room'], ['panopticon_city', 'refraction_lab']] as const) {
      const node = DUNGEONS[dungeonId].nodes.find((candidate) => candidate.id === nodeId);
      expect(node).toBeDefined();
      expect(node?.id).not.toBe(getBossDefinition(dungeonId).nodeId);
      expect(node?.type).not.toBe('exit');
      expect(node?.type).not.toBe('portal');
    }
  });

  it('freezes only equipped max-level valid attunements and deduplicates', () => {
    const state = createFieldSurveyRunState(['mist_hood', 'mist_hood', 'rift_belt', 'training_blade'], { mist_hood: EQUIPMENT.mist_hood.maxLevel, rift_belt: 1 }, { mist_hood: 'mist_vanguard', rift_belt: 'rift_anchor' });
    expect(state.frozenSources).toEqual([{ equipmentId: 'mist_hood', attunementId: 'mist_vanguard' }]);

    const temporal = createFieldSurveyRunState(['chronal_lens'], { chronal_lens: EQUIPMENT.chronal_lens.maxLevel }, { chronal_lens: 'chronal_acceleration' });
    expect(temporal.frozenSources).toEqual([{ equipmentId: 'chronal_lens', attunementId: 'chronal_acceleration' }]);
    expect(getFieldSurveyOptionStatus(temporal, 'survey_temporal_observatory_deck', 'chronal_acceleration_future_refraction').available).toBe(true);

    const genesis = createFieldSurveyRunState(
      ['helix_cleaver', 'symbiote_cowl', 'carapace_harness', 'rebirth_amulet'],
      {
        helix_cleaver: EQUIPMENT.helix_cleaver.maxLevel,
        symbiote_cowl: EQUIPMENT.symbiote_cowl.maxLevel,
        carapace_harness: EQUIPMENT.carapace_harness.maxLevel,
        rebirth_amulet: EQUIPMENT.rebirth_amulet.maxLevel
      },
      {
        helix_cleaver: 'forge_overdrive',
        symbiote_cowl: 'mist_veilguard',
        carapace_harness: 'rift_anchor',
        rebirth_amulet: 'chronal_stasis'
      }
    );
    expect(genesis.frozenSources).toEqual([
      { equipmentId: 'helix_cleaver', attunementId: 'forge_overdrive' },
      { equipmentId: 'symbiote_cowl', attunementId: 'mist_veilguard' },
      { equipmentId: 'carapace_harness', attunementId: 'rift_anchor' },
      { equipmentId: 'rebirth_amulet', attunementId: 'chronal_stasis' }
    ]);
    expect(getFieldSurveyById('survey_genesis_bloodline_archive')?.options.every((entry) =>
      getFieldSurveyOptionStatus(genesis, 'survey_genesis_bloodline_archive', entry.id).available
    )).toBe(true);

    const broadcast = createFieldSurveyRunState(
      ['hushblade', 'dead_air_headset', 'anechoic_mantle', 'last_channel_beacon'],
      {
        hushblade: EQUIPMENT.hushblade.maxLevel,
        dead_air_headset: EQUIPMENT.dead_air_headset.maxLevel,
        anechoic_mantle: EQUIPMENT.anechoic_mantle.maxLevel,
        last_channel_beacon: EQUIPMENT.last_channel_beacon.maxLevel
      },
      {
        hushblade: 'forge_overdrive',
        dead_air_headset: 'mist_veilguard',
        anechoic_mantle: 'rift_anchor',
        last_channel_beacon: 'chronal_stasis'
      }
    );
    expect(broadcast.frozenSources).toEqual([
      { equipmentId: 'hushblade', attunementId: 'forge_overdrive' },
      { equipmentId: 'dead_air_headset', attunementId: 'mist_veilguard' },
      { equipmentId: 'anechoic_mantle', attunementId: 'rift_anchor' },
      { equipmentId: 'last_channel_beacon', attunementId: 'chronal_stasis' }
    ]);
    expect(getFieldSurveyById('survey_silent_broadcast_archive')?.options.every((entry) =>
      getFieldSurveyOptionStatus(broadcast, 'survey_silent_broadcast_archive', entry.id).available
    )).toBe(true);
    expect(createFieldSurveyRunState(
      ['hushblade'],
      { hushblade: EQUIPMENT.hushblade.maxLevel - 1 },
      { hushblade: 'forge_overdrive' }
    ).frozenSources).toEqual([]);

    const shelter = createFieldSurveyRunState(
      ['rescue_carbine', 'triage_visor', 'evacuation_plate', 'blackbox_beacon'],
      {
        rescue_carbine: EQUIPMENT.rescue_carbine.maxLevel,
        triage_visor: EQUIPMENT.triage_visor.maxLevel,
        evacuation_plate: EQUIPMENT.evacuation_plate.maxLevel,
        blackbox_beacon: EQUIPMENT.blackbox_beacon.maxLevel
      },
      {
        rescue_carbine: 'forge_overdrive',
        triage_visor: 'mist_veilguard',
        evacuation_plate: 'rift_anchor',
        blackbox_beacon: 'chronal_stasis'
      }
    );
    expect(shelter.frozenSources).toEqual([
      { equipmentId: 'rescue_carbine', attunementId: 'forge_overdrive' },
      { equipmentId: 'triage_visor', attunementId: 'mist_veilguard' },
      { equipmentId: 'evacuation_plate', attunementId: 'rift_anchor' },
      { equipmentId: 'blackbox_beacon', attunementId: 'chronal_stasis' }
    ]);
    expect(getFieldSurveyById('survey_shelter_rescue_archive')?.options.every((entry) =>
      getFieldSurveyOptionStatus(shelter, 'survey_shelter_rescue_archive', entry.id).available
    )).toBe(true);
    expect(createFieldSurveyRunState(
      ['rescue_carbine'],
      { rescue_carbine: EQUIPMENT.rescue_carbine.maxLevel - 1 },
      { rescue_carbine: 'forge_overdrive' }
    ).frozenSources).toEqual([]);

    const panopticon = createFieldSurveyRunState(
      ['blindline_cutter', 'predictive_visor', 'matte_shell', 'inverse_prism'],
      {
        blindline_cutter: EQUIPMENT.blindline_cutter.maxLevel,
        predictive_visor: EQUIPMENT.predictive_visor.maxLevel,
        matte_shell: EQUIPMENT.matte_shell.maxLevel,
        inverse_prism: EQUIPMENT.inverse_prism.maxLevel
      },
      {
        blindline_cutter: 'forge_overdrive',
        predictive_visor: 'mist_veilguard',
        matte_shell: 'rift_anchor',
        inverse_prism: 'chronal_stasis'
      }
    );
    expect(panopticon.frozenSources).toEqual([
      { equipmentId: 'blindline_cutter', attunementId: 'forge_overdrive' },
      { equipmentId: 'predictive_visor', attunementId: 'mist_veilguard' },
      { equipmentId: 'matte_shell', attunementId: 'rift_anchor' },
      { equipmentId: 'inverse_prism', attunementId: 'chronal_stasis' }
    ]);
    expect(getFieldSurveyById('survey_panopticon_refraction_lab')?.options.every((entry) =>
      getFieldSurveyOptionStatus(panopticon, 'survey_panopticon_refraction_lab', entry.id).available
    )).toBe(true);

    const testimony = createFieldSurveyRunState(
      ['cross_examiner_sabre', 'forensic_visor', 'custody_shell', 'appeal_seal'],
      {
        cross_examiner_sabre: EQUIPMENT.cross_examiner_sabre.maxLevel,
        forensic_visor: EQUIPMENT.forensic_visor.maxLevel,
        custody_shell: EQUIPMENT.custody_shell.maxLevel,
        appeal_seal: EQUIPMENT.appeal_seal.maxLevel
      },
      {
        cross_examiner_sabre: 'forge_overdrive',
        forensic_visor: 'mist_veilguard',
        custody_shell: 'rift_anchor',
        appeal_seal: 'chronal_stasis'
      }
    );
    expect(testimony.frozenSources).toEqual([
      { equipmentId: 'cross_examiner_sabre', attunementId: 'forge_overdrive' },
      { equipmentId: 'forensic_visor', attunementId: 'mist_veilguard' },
      { equipmentId: 'custody_shell', attunementId: 'rift_anchor' },
      { equipmentId: 'appeal_seal', attunementId: 'chronal_stasis' }
    ]);
    const testimonyOption = 'rift_anchor_custody_bank_sample';
    expect(getFieldSurveyOptionStatus(testimony, 'survey_false_testimony_archive', testimonyOption).available).toBe(true);
    const resolvedTestimony = markFieldSurveyResolved(testimony, 'survey_false_testimony_archive', testimonyOption);
    expect(getFieldSurveyOptionStatus(resolvedTestimony, 'survey_false_testimony_archive', testimonyOption)).toMatchObject({
      available: false, resolved: true, reason: 'resolved'
    });
    expect(markFieldSurveyResolved(resolvedTestimony, 'survey_false_testimony_archive', testimonyOption)).toBe(resolvedTestimony);
  });

  it('strictly sanitizes and clones valid state', () => {
    const input = { rulesVersion: 1, frozenSources: [{ equipmentId: 'mist_hood', attunementId: 'mist_vanguard' }], resolvedSurveys: [{ surveyId: 'survey_demon_bone_marrow', optionId: 'mist_vanguard_fast_search' }] };
    const snapshot = JSON.parse(JSON.stringify(input));
    const result = normalizeFieldSurveyRunState(input);
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
    expect(input).toEqual(snapshot);
    expect(normalizeFieldSurveyRunState({ ...input, rulesVersion: 2 })).toBeUndefined();
    expect(normalizeFieldSurveyRunState({ ...input, resolvedSurveys: [{ surveyId: 'survey_demon_bone_marrow', optionId: 'forge_overdrive_crush_bone' }] })).toBeUndefined();
    expect(normalizeFieldSurveyRunState({ ...input, frozenSources: [...input.frozenSources, { equipmentId: 'mist_hood', attunementId: 'mist_veilguard' }] })).toBeUndefined();
    expect(isFieldSurveyRunState(result)).toBe(true);

    const genesisInput = {
      rulesVersion: 1,
      frozenSources: [{ equipmentId: 'carapace_harness', attunementId: 'rift_anchor' }],
      resolvedSurveys: [{ surveyId: 'survey_genesis_bloodline_archive', optionId: 'rift_anchor_carapace_safe_sample' }]
    };
    expect(normalizeFieldSurveyRunState(genesisInput)).toEqual(genesisInput);
    expect(normalizeFieldSurveyRunState({ ...genesisInput, rulesVersion: 0 })).toBeUndefined();
    expect(normalizeFieldSurveyRunState({ ...genesisInput, frozenSources: [] })).toBeUndefined();

    const broadcastInput = {
      rulesVersion: 1,
      frozenSources: [{ equipmentId: 'last_channel_beacon', attunementId: 'chronal_stasis' }],
      resolvedSurveys: [{ surveyId: 'survey_silent_broadcast_archive', optionId: 'chronal_stasis_last_channel_snapshot' }]
    };
    expect(normalizeFieldSurveyRunState(broadcastInput)).toEqual(broadcastInput);
    expect(normalizeFieldSurveyRunState(input)).toEqual(input);
    expect(normalizeFieldSurveyRunState({ ...broadcastInput, frozenSources: [] })).toBeUndefined();

    const shelterInput = {
      rulesVersion: 1,
      frozenSources: [{ equipmentId: 'blackbox_beacon', attunementId: 'chronal_stasis' }],
      resolvedSurveys: [{ surveyId: 'survey_shelter_rescue_archive', optionId: 'chronal_stasis_blackbox_snapshot' }]
    };
    expect(normalizeFieldSurveyRunState(shelterInput)).toEqual(shelterInput);
    expect(normalizeFieldSurveyRunState({ ...shelterInput, frozenSources: [] })).toBeUndefined();
  });

  it('reports availability, resolves once, and keeps invalid marks unchanged', () => {
    const state = createFieldSurveyRunState(['mist_hood'], { mist_hood: 3 }, { mist_hood: 'mist_vanguard' });
    expect(getFieldSurveyOptionStatus(state, 'survey_demon_bone_marrow', 'mist_vanguard_fast_search').available).toBe(true);
    const resolved = markFieldSurveyResolved(state, 'survey_demon_bone_marrow', 'mist_vanguard_fast_search');
    expect(markFieldSurveyResolved(resolved, 'survey_demon_bone_marrow', 'mist_vanguard_fast_search')).toBe(resolved);
    expect(markFieldSurveyResolved(state, 'survey_demon_bone_marrow', 'forge_overdrive_crush_bone')).toBe(state);
  });

  it('converts rewards and hp with rounding and clamping', () => {
    expect(resolveFieldSurveyReward({ rewardPoints: 101, lingyun: 2, items: { cracked_core: 1, star_iron: 0 } }, 'survey_mine_resonant_vein', 'forge_channeling_heat_refine')).toEqual({ rewardPoints: 70, lingyun: 5 });
    expect(resolveFieldSurveyReward({ items: { star_iron: -1, cracked_core: 0 } }, 'survey_mine_resonant_vein', 'forge_overdrive_overload_vein')).toEqual({ rewardPoints: 0, lingyun: 0, items: { cracked_core: 1 } });
    expect(resolveFieldSurveyReward({ rewardPoints: 1 }, 'survey_metro_lost_property', 'rift_resonance_mirror_recast')).toEqual({ rewardPoints: 1, lingyun: 0, items: { mirror_shell: 1 } });
    expect(resolveFieldSurveyReward({ rewardPoints: 500, lingyun: 1 }, 'survey_temporal_observatory_deck', 'chronal_acceleration_future_refraction')).toEqual({ rewardPoints: 850, lingyun: 1, items: { chronal_glass: 1 } });
    expect(resolveFieldSurveyReward({ rewardPoints: 500, lingyun: 1 }, 'survey_causal_evidence_dais', 'chronal_acceleration_causal_projection')).toEqual({ rewardPoints: 900, lingyun: 1, items: { causal_seal: 1 } });
    expect(resolveFieldSurveyReward({ rewardPoints: 500, lingyun: 1 }, 'survey_causal_evidence_dais', 'rift_anchor_evidence_recovery')).toEqual({ rewardPoints: 425, lingyun: 5 });
    expect(resolveFieldSurveyReward({ rewardPoints: 500, lingyun: 1 }, 'survey_entropy_ballast_deck', 'chronal_acceleration_entropy_forecast')).toEqual({ rewardPoints: 950, lingyun: 1, items: { entropy_crystal: 1 } });
    expect(resolveFieldSurveyReward({ rewardPoints: 500, lingyun: 1 }, 'survey_entropy_ballast_deck', 'forge_channeling_ballast_recovery')).toEqual({ rewardPoints: 450, lingyun: 6 });
    expect(resolveFieldSurveyReward({ rewardPoints: 500, lingyun: 1 }, 'survey_mirror_city_parallax', 'rift_resonance_parallax_refraction')).toEqual({ rewardPoints: 1000, lingyun: 1, items: { phase_glass: 1 } });
    expect(resolveFieldSurveyReward({ rewardPoints: 500, lingyun: 1 }, 'survey_mirror_city_parallax', 'chronal_stasis_mirror_alignment')).toEqual({ rewardPoints: 475, lingyun: 7 });
    expect(resolveFieldSurveyReward({ rewardPoints: 500, lingyun: 1 }, 'survey_redaction_memory_archive', 'chronal_stasis_restore_deleted_line')).toEqual({ rewardPoints: 500, lingyun: 8 });
    expect(resolveFieldSurveyReward({ rewardPoints: 500, lingyun: 1 }, 'survey_redaction_memory_archive', 'rift_resonance_extract_redaction_ink')).toEqual({ rewardPoints: 1050, lingyun: 1, items: { redaction_ink: 2 } });
    expect(resolveFieldSurveyReward({ rewardPoints: 500, lingyun: 1 }, 'survey_legacy_auction_archive', 'chronal_stasis_verify_hammer_chain')).toEqual({ rewardPoints: 525, lingyun: 9 });
    expect(resolveFieldSurveyReward({ rewardPoints: 500, lingyun: 1 }, 'survey_legacy_auction_archive', 'forge_resonance_melt_counterfeit_lot')).toEqual({ rewardPoints: 1100, lingyun: 1, items: { legacy_scrip: 2 } });
    expect(resolveFieldSurveyReward({ rewardPoints: 500, lingyun: 1, items: { genesis_serum: 1 } }, 'survey_genesis_bloodline_archive', 'forge_overdrive_helix_source_sample')).toEqual({ rewardPoints: 1150, lingyun: 1, items: { genesis_serum: 3 } });
    expect(resolveFieldSurveyReward({ rewardPoints: 500, lingyun: 1, items: { genesis_serum: 1 } }, 'survey_genesis_bloodline_archive', 'rift_anchor_carapace_safe_sample')).toEqual({ rewardPoints: 550, lingyun: 1, items: { genesis_serum: 1, rift_dust: 1 } });
    expect(getFieldSurveyById('survey_genesis_bloodline_archive')?.options[2].cost).toEqual({ genesis_serum: 1 });
    expect(resolveFieldSurveyReward({ rewardPoints: 500, lingyun: 1, items: { silence_core: 1 } }, 'survey_silent_broadcast_archive', 'forge_overdrive_hushblade_frequency_cut')).toEqual({ rewardPoints: 1200, lingyun: 1, items: { silence_core: 3 } });
    expect(resolveFieldSurveyReward({ rewardPoints: 500, lingyun: 1, items: { silence_core: 1 } }, 'survey_silent_broadcast_archive', 'rift_anchor_anechoic_pressure_sample')).toEqual({ rewardPoints: 590, lingyun: 1, items: { silence_core: 1, rift_dust: 1 } });
    expect(getFieldSurveyById('survey_silent_broadcast_archive')?.options[2].cost).toEqual({ silence_core: 1 });
    expect(getFieldSurveyById('survey_silent_broadcast_archive')?.options[2].itemDelta).toEqual({ rift_dust: 1 });
    expect(resolveFieldSurveyReward({ rewardPoints: 500, lingyun: 1, items: { rescue_badge: 1 } }, 'survey_shelter_rescue_archive', 'forge_overdrive_rescue_carbine_breach')).toEqual({ rewardPoints: 1250, lingyun: 1, items: { rescue_badge: 3 } });
    expect(resolveFieldSurveyReward({ rewardPoints: 500, lingyun: 1, items: { rescue_badge: 1 } }, 'survey_shelter_rescue_archive', 'rift_anchor_evacuation_plate_recovery')).toEqual({ rewardPoints: 620, lingyun: 1, items: { rescue_badge: 1, rift_dust: 1 } });
    expect(getFieldSurveyById('survey_shelter_rescue_archive')?.options[2].cost).toEqual({ rescue_badge: 1 });
    expect(getFieldSurveyById('survey_shelter_rescue_archive')?.options[2].itemDelta).toEqual({ rift_dust: 1 });
    expect(resolveFieldSurveyReward({ rewardPoints: 500, lingyun: 1, items: { truth_fragment: 1 } }, 'survey_false_testimony_archive', 'forge_overdrive_cross_examiner_chain')).toEqual({ rewardPoints: 1300, lingyun: 1, items: { truth_fragment: 3 } });
    expect(resolveFieldSurveyReward({ rewardPoints: 500, lingyun: 1, items: { truth_fragment: 1 } }, 'survey_false_testimony_archive', 'rift_anchor_custody_bank_sample')).toEqual({ rewardPoints: 650, lingyun: 1, items: { truth_fragment: 1, rift_dust: 1 } });
    expect(getFieldSurveyById('survey_false_testimony_archive')?.options[2].cost).toEqual({ truth_fragment: 1 });
    expect(getFieldSurveyById('survey_false_testimony_archive')?.options[2].itemDelta).toEqual({ rift_dust: 1 });
    expect(resolveFieldSurveyReward({ rewardPoints: 500, lingyun: 1, items: { combat_reel: 1 } }, 'survey_combat_replay_cutting_room', 'forge_overdrive_frame_engraver_cut')).toEqual({ rewardPoints: 1350, lingyun: 1, items: { combat_reel: 3 } });
    expect(resolveFieldSurveyReward({ rewardPoints: 500, lingyun: 1, items: { combat_reel: 1 } }, 'survey_combat_replay_cutting_room', 'rift_anchor_buffer_plate_sample')).toEqual({ rewardPoints: 680, lingyun: 1, items: { combat_reel: 1, rift_dust: 1 } });
    expect(getFieldSurveyById('survey_combat_replay_cutting_room')?.options[2].cost).toEqual({ combat_reel: 1 });
    expect(resolveFieldSurveyReward({ rewardPoints: 500, lingyun: 1, items: { observation_shard: 1 } }, 'survey_panopticon_refraction_lab', 'forge_overdrive_blindline_cutter_test')).toEqual({ rewardPoints: 1400, lingyun: 1, items: { observation_shard: 3 } });
    expect(resolveFieldSurveyReward({ rewardPoints: 500, lingyun: 1, items: { observation_shard: 1 } }, 'survey_panopticon_refraction_lab', 'rift_anchor_matte_prism_refraction')).toEqual({ rewardPoints: 710, lingyun: 11, items: { observation_shard: 1, rift_dust: 1, chronal_glass: 1 } });
    expect(getFieldSurveyById('survey_panopticon_refraction_lab')?.options[2].cost).toEqual({ observation_shard: 1 });
    expect(getFieldSurveyHpDelta(101, 'survey_demon_bone_marrow', 'forge_overdrive_crush_bone')).toBe(-12);
    expect(getFieldSurveyHpDelta(3, 'survey_hospital_emergency_stock', 'mist_veilguard_isolation_pack')).toBe(1);
    expect(getFieldSurveyHpDelta(435, 'survey_temporal_observatory_deck', 'chronal_acceleration_future_refraction')).toBe(-95);
    expect(getFieldSurveyHpDelta(500, 'survey_causal_evidence_dais', 'chronal_acceleration_causal_projection')).toBe(-120);
    expect(getFieldSurveyHpDelta(500, 'survey_causal_evidence_dais', 'rift_anchor_evidence_recovery')).toBe(90);
    expect(getFieldSurveyHpDelta(500, 'survey_entropy_ballast_deck', 'chronal_acceleration_entropy_forecast')).toBe(-130);
    expect(getFieldSurveyHpDelta(500, 'survey_entropy_ballast_deck', 'forge_channeling_ballast_recovery')).toBe(100);
    expect(getFieldSurveyHpDelta(630, 'survey_mirror_city_parallax', 'rift_resonance_parallax_refraction')).toBe(-176);
    expect(getFieldSurveyHpDelta(630, 'survey_mirror_city_parallax', 'chronal_stasis_mirror_alignment')).toBe(138);
    expect(getFieldSurveyHpDelta(700, 'survey_redaction_memory_archive', 'chronal_stasis_restore_deleted_line')).toBe(168);
    expect(getFieldSurveyHpDelta(700, 'survey_redaction_memory_archive', 'rift_resonance_extract_redaction_ink')).toBe(-210);
    expect(getFieldSurveyHpDelta(700, 'survey_legacy_auction_archive', 'chronal_stasis_verify_hammer_chain')).toBe(182);
    expect(getFieldSurveyHpDelta(700, 'survey_legacy_auction_archive', 'forge_resonance_melt_counterfeit_lot')).toBe(-224);
    expect(getFieldSurveyHpDelta(860, 'survey_genesis_bloodline_archive', 'forge_overdrive_helix_source_sample')).toBe(-292);
    expect(getFieldSurveyHpDelta(860, 'survey_genesis_bloodline_archive', 'rift_anchor_carapace_safe_sample')).toBe(258);
    expect(getFieldSurveyHpDelta(950, 'survey_silent_broadcast_archive', 'forge_overdrive_hushblade_frequency_cut')).toBe(-342);
    expect(getFieldSurveyHpDelta(950, 'survey_silent_broadcast_archive', 'rift_anchor_anechoic_pressure_sample')).toBe(304);
    expect(getFieldSurveyHpDelta(1040, 'survey_shelter_rescue_archive', 'forge_overdrive_rescue_carbine_breach')).toBe(-395);
    expect(getFieldSurveyHpDelta(1040, 'survey_shelter_rescue_archive', 'rift_anchor_evacuation_plate_recovery')).toBe(353);
    expect(getFieldSurveyHpDelta(1120, 'survey_combat_replay_cutting_room', 'forge_overdrive_frame_engraver_cut')).toBe(-470);
    expect(getFieldSurveyHpDelta(1120, 'survey_combat_replay_cutting_room', 'rift_anchor_buffer_plate_sample')).toBe(425);
    expect(getFieldSurveyHpDelta(1200, 'survey_panopticon_refraction_lab', 'forge_overdrive_blindline_cutter_test')).toBe(-528);
    expect(getFieldSurveyHpDelta(1200, 'survey_panopticon_refraction_lab', 'rift_anchor_matte_prism_refraction')).toBe(480);
  });
});
