import { describe, expect, it } from 'vitest';

import { getBossDefinition } from './boss-system';
import { createInitialState, resolveExit, type DungeonRun, type GameState } from './game';
import { DUNGEONS } from './level-content';
import { createEmptyRunLootBag } from './run-economy';
import {
  RUN_PURSUIT_BOSS_FUSION_PERCENT,
  RUN_PURSUIT_CATALOG,
  RUN_PURSUIT_RULES_VERSION,
  RUN_PURSUIT_SPAWN_CLEAR_COUNT,
  activateRunPursuit,
  advanceRunPursuit,
  carryRunPursuitThroughForcedPortal,
  createRunPursuitState,
  fuseRunPursuitAtBoss,
  getRunPursuitBossFusionPercent,
  getRunPursuitContactDamage,
  getRunPursuitDefinition,
  getRunPursuitDisplay,
  getRunPursuitProgress,
  isRunPursuitState,
  normalizeRunPursuitState,
  repelRunPursuitAtStablePortal,
  settleRunPursuit,
  type AdvanceRunPursuitInput,
  type RunPursuitNode,
  type RunPursuitSettlementReason,
  type RunPursuitState
} from './run-pursuit';

const DUNGEON_ID = 'demon_tower_1' as const;
const SPAWN_NODE_ID = RUN_PURSUIT_CATALOG[DUNGEON_ID].spawnNodeId;
const CONTAINMENT_NODE_ID = RUN_PURSUIT_CATALOG[DUNGEON_ID].containmentNodeId;

const GRID_NODES: readonly RunPursuitNode[] = [
  { id: SPAWN_NODE_ID, x: 0, y: 0 },
  { id: 'alpha_path', x: 0, y: 1 },
  { id: 'zeta_path', x: 1, y: 0 },
  { id: 'player_target', x: 1, y: 1 },
  { id: CONTAINMENT_NODE_ID, x: 2, y: 0 }
];

function dormantState(): RunPursuitState {
  return createRunPursuitState(DUNGEON_ID, true);
}

function stalkingState(overrides: Partial<RunPursuitState> = {}): RunPursuitState {
  return {
    ...activateRunPursuit(dormantState(), RUN_PURSUIT_SPAWN_CLEAR_COUNT),
    ...overrides
  };
}

function movementInput(
  playerNodeId: string,
  overrides: Partial<AdvanceRunPursuitInput> = {}
): AdvanceRunPursuitInput {
  return {
    nodes: GRID_NODES,
    blockedEdges: [],
    playerNodeId,
    containmentReady: false,
    ...overrides
  };
}

describe('run pursuit catalog and lifecycle', () => {
  it('defines the locked values for all nineteen chapters', () => {
    expect(Object.keys(RUN_PURSUIT_CATALOG)).toEqual([
      'demon_tower_1',
      'metro_abyss',
      'starfall_mine',
      'rust_hospital',
      'ash_arena',
      'dream_archive',
      'void_citadel',
      'temporal_observatory',
      'causal_clearinghouse',
      'entropy_ark',
      'mirror_cycle_city',
      'redaction_scriptorium',
      'legacy_auction_court',
      'genesis_vault',
      'silent_broadcast_tower',
      'lost_shelter',
      'false_testimony_court',
      'combat_replay_stage',
      'panopticon_city'
    ]);

    for (const [dungeonId, definition] of Object.entries(RUN_PURSUIT_CATALOG)) {
      expect(definition.dungeonId).toBe(dungeonId);
      expect(definition.spawnNodeId).not.toBe(definition.containmentNodeId);
      expect(definition.rewardAmount).toBe(1);
      expect(definition.contactDamagePercent).toBe(15);
      expect(definition.bossFusionPercent).toBe(15);
      expect(definition.spawnClearCount).toBe(6);
      expect(definition.flavorDescription.length).toBeGreaterThan(12);
      expect(definition.fusionDescription.length).toBeGreaterThan(12);
      expect(getRunPursuitDefinition(dungeonId)).toBe(definition);
    }

    expect(getRunPursuitDefinition('unknown_dungeon')).toBeUndefined();
    expect(RUN_PURSUIT_RULES_VERSION).toBe(1);
    expect(RUN_PURSUIT_SPAWN_CLEAR_COUNT).toBe(6);
    expect(RUN_PURSUIT_BOSS_FUSION_PERCENT).toBe(15);
  });

  it('locks the causal clearinghouse pursuit to real non-terminal authored nodes', () => {
    const definition = RUN_PURSUIT_CATALOG.causal_clearinghouse;
    const dungeon = DUNGEONS.causal_clearinghouse;
    const bossNodeId = getBossDefinition('causal_clearinghouse').nodeId;

    expect(definition).toMatchObject({
      dungeonId: 'causal_clearinghouse',
      name: '零和追缴者',
      spawnNodeId: 'paradox_bailiff_alpha',
      containmentNodeId: 'cause_deposition',
      materialId: 'causal_seal',
      rewardAmount: 1,
      contactDamagePercent: 15,
      bossFusionPercent: 15,
      spawnClearCount: 6
    });

    for (const nodeId of [definition.spawnNodeId, definition.containmentNodeId]) {
      const node = dungeon.nodes.find((candidate) => candidate.id === nodeId);
      expect(node).toBeDefined();
      expect(node?.id).not.toBe(bossNodeId);
      expect(node?.type).not.toBe('exit');
      expect(node?.type).not.toBe('portal');
    }
  });

  it('locks the entropy ark pursuit to its navigator spawn and ballast containment', () => {
    const definition = RUN_PURSUIT_CATALOG.entropy_ark;
    const dungeon = DUNGEONS.entropy_ark;

    expect(definition).toMatchObject({
      dungeonId: 'entropy_ark',
      name: '熵潮弃航者',
      spawnNodeId: 'dissipation_navigator_alpha',
      containmentNodeId: 'port_ballast_core',
      materialId: 'entropy_crystal',
      rewardAmount: 1,
      contactDamagePercent: 15,
      bossFusionPercent: 15,
      spawnClearCount: 6
    });
    for (const nodeId of [definition.spawnNodeId, definition.containmentNodeId]) {
      const node = dungeon.nodes.find((candidate) => candidate.id === nodeId);
      expect(node).toBeDefined();
      expect(node?.type).not.toBe('exit');
      expect(node?.type).not.toBe('portal');
    }
  });

  it('locks the mirror city pursuit to its reflected hunter spawn and event-stage containment', () => {
    const definition = RUN_PURSUIT_CATALOG.mirror_cycle_city;
    const dungeon = DUNGEONS.mirror_cycle_city;
    const bossNodeId = getBossDefinition('mirror_cycle_city').nodeId;

    expect(definition).toMatchObject({
      dungeonId: 'mirror_cycle_city',
      name: '无面追像',
      spawnNodeId: 'parallax_hunter_mirror',
      containmentNodeId: 'reflection_event_stage',
      materialId: 'phase_glass',
      rewardAmount: 1,
      contactDamagePercent: 15,
      bossFusionPercent: 15,
      spawnClearCount: 6
    });
    for (const nodeId of [definition.spawnNodeId, definition.containmentNodeId]) {
      const node = dungeon.nodes.find((candidate) => candidate.id === nodeId);
      expect(node).toBeDefined();
      expect(node?.id).not.toBe(bossNodeId);
      expect(node?.type).not.toBe('exit');
      expect(node?.type).not.toBe('portal');
    }
    expect(getRunPursuitDefinition('mirror_cycle_city')).toBe(definition);
    expect(createRunPursuitState('mirror_cycle_city', true)).toMatchObject({
      dungeonId: 'mirror_cycle_city',
      status: 'dormant'
    });
  });

  it('locks the redaction pursuit to its censor spawn and errata containment', () => {
    const definition = RUN_PURSUIT_CATALOG.redaction_scriptorium;
    const dungeon = DUNGEONS.redaction_scriptorium;

    expect(definition).toMatchObject({
      dungeonId: 'redaction_scriptorium',
      name: '终稿追删者',
      spawnNodeId: 'palimpsest_censor_alpha',
      containmentNodeId: 'errata_event_stage',
      materialId: 'redaction_ink',
      rewardAmount: 1,
      contactDamagePercent: 15,
      bossFusionPercent: 15,
      spawnClearCount: 6
    });
    for (const nodeId of [definition.spawnNodeId, definition.containmentNodeId]) {
      const node = dungeon.nodes.find((candidate) => candidate.id === nodeId);
      expect(node).toBeDefined();
      expect(node?.type).not.toBe('exit');
      expect(node?.type).not.toBe('portal');
    }
    expect(createRunPursuitState('redaction_scriptorium', true)).toMatchObject({
      dungeonId: 'redaction_scriptorium',
      status: 'dormant'
    });
  });

  it('locks the legacy auction pursuit to its inheritance spawn and testimony containment', () => {
    const definition = RUN_PURSUIT_CATALOG.legacy_auction_court;
    const dungeon = DUNGEONS.legacy_auction_court;
    const bossNodeId = getBossDefinition('legacy_auction_court').nodeId;

    expect(definition).toMatchObject({
      dungeonId: 'legacy_auction_court',
      name: '流拍追索者',
      spawnNodeId: 'inheritance_mimic_alpha',
      containmentNodeId: 'dead_team_testimony_stage',
      materialId: 'legacy_scrip',
      rewardAmount: 1,
      contactDamagePercent: 15,
      bossFusionPercent: 15,
      spawnClearCount: 6
    });
    for (const nodeId of [definition.spawnNodeId, definition.containmentNodeId]) {
      const node = dungeon.nodes.find((candidate) => candidate.id === nodeId);
      expect(node).toBeDefined();
      expect(node?.id).not.toBe(bossNodeId);
      expect(node?.type).not.toBe('exit');
      expect(node?.type).not.toBe('portal');
    }
    expect(createRunPursuitState('legacy_auction_court', true)).toMatchObject({
      dungeonId: 'legacy_auction_court',
      status: 'dormant'
    });
  });

  it('locks the genesis pursuit to real authored nodes and the Tier-14 serum reward', () => {
    const definition = RUN_PURSUIT_CATALOG.genesis_vault;
    const dungeon = DUNGEONS.genesis_vault;

    expect(definition).toMatchObject({
      dungeonId: 'genesis_vault',
      name: '失控原型',
      spawnNodeId: 'gene_stalker_alpha',
      containmentNodeId: 'genome_repair_station',
      materialId: 'genesis_serum',
      rewardAmount: 1,
      contactDamagePercent: 15,
      bossFusionPercent: 15,
      spawnClearCount: 6
    });
    for (const nodeId of [definition.spawnNodeId, definition.containmentNodeId]) {
      const node = dungeon.nodes.find((candidate) => candidate.id === nodeId);
      expect(node).toBeDefined();
      expect(node?.type).not.toBe('exit');
      expect(node?.type).not.toBe('portal');
    }
    expect(createRunPursuitState('genesis_vault', true)).toMatchObject({
      dungeonId: 'genesis_vault',
      status: 'dormant'
    });
    expect(getRunPursuitContactDamage(200, 14)).toBe(44);
    expect(getRunPursuitContactDamage(200, 14)).toBeGreaterThan(
      getRunPursuitContactDamage(200, 13)
    );
  });

  it('locks the Tier-15 pursuit to the dead-air mimic and anechoic containment', () => {
    const definition = RUN_PURSUIT_CATALOG.silent_broadcast_tower;
    const dungeon = DUNGEONS.silent_broadcast_tower;

    expect(definition).toMatchObject({
      dungeonId: 'silent_broadcast_tower',
      name: '走音替身',
      spawnNodeId: 'dead_air_mimic',
      containmentNodeId: 'anechoic_chamber',
      materialId: 'silence_core',
      rewardAmount: 1,
      contactDamagePercent: 15,
      bossFusionPercent: 15,
      spawnClearCount: 6
    });
    for (const nodeId of [definition.spawnNodeId, definition.containmentNodeId]) {
      const node = dungeon.nodes.find((candidate) => candidate.id === nodeId);
      expect(node).toBeDefined();
      expect(node?.type).not.toBe('exit');
      expect(node?.type).not.toBe('portal');
    }
    expect(createRunPursuitState('silent_broadcast_tower', true)).toMatchObject({
      dungeonId: 'silent_broadcast_tower',
      status: 'dormant'
    });
    expect(getRunPursuitContactDamage(200, 15)).toBe(45);
    expect(getRunPursuitContactDamage(200, 15)).toBeGreaterThan(
      getRunPursuitContactDamage(200, 14)
    );
  });

  it('locks the Tier-16 pursuit to the mimic survivor and containment bay', () => {
    const definition = RUN_PURSUIT_CATALOG.lost_shelter;
    const dungeon = DUNGEONS.lost_shelter;

    expect(definition).toMatchObject({
      dungeonId: 'lost_shelter',
      name: '失联接管体',
      spawnNodeId: 'mimic_survivor',
      containmentNodeId: 'containment_bay',
      materialId: 'rescue_badge',
      rewardAmount: 1,
      contactDamagePercent: 15,
      bossFusionPercent: 15,
      spawnClearCount: 6
    });
    for (const nodeId of [definition.spawnNodeId, definition.containmentNodeId]) {
      const node = dungeon.nodes.find((candidate) => candidate.id === nodeId);
      expect(node).toBeDefined();
      expect(node?.type).not.toBe('exit');
      expect(node?.type).not.toBe('portal');
    }
    expect(createRunPursuitState('lost_shelter', true)).toMatchObject({
      dungeonId: 'lost_shelter',
      status: 'dormant'
    });
    expect(getRunPursuitContactDamage(200, 16)).toBe(46);
    expect(getRunPursuitContactDamage(200, 16)).toBeGreaterThan(
      getRunPursuitContactDamage(200, 15)
    );
  });

  it('locks the Tier-17 pursuit to the hostile witness and judgment lock', () => {
    const definition = RUN_PURSUIT_CATALOG.false_testimony_court;
    const dungeon = DUNGEONS.false_testimony_court;

    expect(definition).toMatchObject({
      dungeonId: 'false_testimony_court',
      name: '伪证执行官',
      spawnNodeId: 'hostile_witness',
      containmentNodeId: 'judgment_lock',
      materialId: 'truth_fragment',
      rewardAmount: 1,
      contactDamagePercent: 15,
      bossFusionPercent: 15,
      spawnClearCount: 6
    });
    for (const nodeId of [definition.spawnNodeId, definition.containmentNodeId]) {
      const node = dungeon.nodes.find((candidate) => candidate.id === nodeId);
      expect(node).toBeDefined();
      expect(node?.type).not.toBe('exit');
      expect(node?.type).not.toBe('portal');
    }
    expect(createRunPursuitState('false_testimony_court', true)).toMatchObject({
      dungeonId: 'false_testimony_court',
      status: 'dormant'
    });
    expect(getRunPursuitContactDamage(200, 17)).toBe(47);
    expect(getRunPursuitContactDamage(200, 17)).toBeGreaterThan(
      getRunPursuitContactDamage(200, 16)
    );
  });

  it('locks the Tier-18 pursuit to cue stalker and final cut lock', () => {
    const definition = RUN_PURSUIT_CATALOG.combat_replay_stage;
    const dungeon = DUNGEONS.combat_replay_stage;

    expect(definition).toMatchObject({
      dungeonId: 'combat_replay_stage',
      name: '删镜执行体',
      spawnNodeId: 'cue_stalker',
      containmentNodeId: 'final_cut_lock',
      materialId: 'combat_reel',
      rewardAmount: 1,
      contactDamagePercent: 15,
      bossFusionPercent: 15,
      spawnClearCount: 6
    });
    for (const nodeId of [definition.spawnNodeId, definition.containmentNodeId]) {
      const node = dungeon.nodes.find((candidate) => candidate.id === nodeId);
      expect(node).toBeDefined();
      expect(node?.type).not.toBe('exit');
      expect(node?.type).not.toBe('portal');
    }
    expect(createRunPursuitState('combat_replay_stage', true)).toMatchObject({
      dungeonId: 'combat_replay_stage',
      status: 'dormant'
    });
    expect(getRunPursuitContactDamage(200, 18)).toBe(48);
  });

  it('locks the Tier-19 pursuit to the exposure-double patrol and all-sight containment', () => {
    const definition = RUN_PURSUIT_CATALOG.panopticon_city;
    const dungeon = DUNGEONS.panopticon_city;

    expect(definition).toMatchObject({
      dungeonId: 'panopticon_city',
      name: '盲区巡猎体',
      spawnNodeId: 'exposure_double_patrol',
      containmentNodeId: 'all_sight_lock',
      materialId: 'observation_shard',
      rewardAmount: 1,
      contactDamagePercent: 15,
      bossFusionPercent: 15,
      spawnClearCount: 6
    });
    for (const nodeId of [definition.spawnNodeId, definition.containmentNodeId]) {
      const node = dungeon.nodes.find((candidate) => candidate.id === nodeId);
      expect(node).toBeDefined();
      expect(node?.type).not.toBe('exit');
      expect(node?.type).not.toBe('portal');
    }
    expect(createRunPursuitState('panopticon_city', true)).toMatchObject({
      dungeonId: 'panopticon_city',
      status: 'dormant'
    });
    expect(getRunPursuitContactDamage(200, 19)).toBe(49);
    expect(getRunPursuitContactDamage(200, 19)).toBeGreaterThan(
      getRunPursuitContactDamage(200, 18)
    );
    expect(RUN_PURSUIT_CATALOG.combat_replay_stage).toMatchObject({
      spawnNodeId: 'cue_stalker',
      containmentNodeId: 'final_cut_lock',
      materialId: 'combat_reel'
    });
  });

  it('creates disabled first clears and dormant replay runs', () => {
    expect(createRunPursuitState(DUNGEON_ID, false)).toEqual({
      rulesVersion: 1,
      dungeonId: DUNGEON_ID,
      status: 'disabled',
      nodeId: null,
      contacts: 0,
      graceMoves: 0,
      rewardGranted: false,
      repelledReason: null
    });
    expect(dormantState()).toEqual({
      rulesVersion: 1,
      dungeonId: DUNGEON_ID,
      status: 'dormant',
      nodeId: null,
      contacts: 0,
      graceMoves: 0,
      rewardGranted: false,
      repelledReason: null
    });
  });

  it('activates dormant runs at 6 clears and treats repeated or later signals idempotently', () => {
    const atFive = activateRunPursuit(dormantState(), 5);
    const atSix = activateRunPursuit(dormantState(), 6);
    const atSeven = activateRunPursuit(dormantState(), 7);

    expect(atFive.status).toBe('dormant');
    expect(atSix).toMatchObject({ status: 'stalking', nodeId: SPAWN_NODE_ID });
    expect(atSeven).toMatchObject({ status: 'stalking', nodeId: SPAWN_NODE_ID });
    expect(activateRunPursuit(atSix, 6)).toBe(atSix);

    const disabled = createRunPursuitState(DUNGEON_ID, false);
    expect(activateRunPursuit(disabled, 6)).toBe(disabled);
  });
});

describe('run pursuit movement', () => {
  it('uses a stable node-id tie-break between equal shortest paths', () => {
    const result = advanceRunPursuit(stalkingState(), movementInput('player_target'));

    expect(result).toMatchObject({
      contact: false,
      moved: true,
      from: SPAWN_NODE_ID,
      to: 'alpha_path',
      contained: false,
      rewardGranted: false
    });
    expect(result.state.nodeId).toBe('alpha_path');
  });

  it('honors blocked edges in only the authored direction', () => {
    const lineNodes = [
      { id: SPAWN_NODE_ID, x: 0, y: 0 },
      { id: 'middle', x: 1, y: 0 },
      { id: 'player', x: 2, y: 0 },
      { id: CONTAINMENT_NODE_ID, x: 0, y: 1 }
    ] as const;

    const forwardBlocked = advanceRunPursuit(
      stalkingState(),
      movementInput('player', {
        nodes: lineNodes,
        blockedEdges: [{ fromNodeId: SPAWN_NODE_ID, toNodeId: 'middle' }]
      })
    );
    const reverseBlocked = advanceRunPursuit(
      stalkingState(),
      movementInput('player', {
        nodes: lineNodes,
        blockedEdges: [{ fromNodeId: 'middle', toNodeId: SPAWN_NODE_ID }]
      })
    );

    expect(forwardBlocked).toMatchObject({ moved: false, from: SPAWN_NODE_ID, to: SPAWN_NODE_ID });
    expect(reverseBlocked).toMatchObject({ moved: true, from: SPAWN_NODE_ID, to: 'middle' });
  });

  it('stays in place when the directed grid has no route', () => {
    const result = advanceRunPursuit(
      stalkingState(),
      movementInput('isolated_player', {
        nodes: [
          { id: SPAWN_NODE_ID, x: 0, y: 0 },
          { id: CONTAINMENT_NODE_ID, x: 1, y: 0 },
          { id: 'isolated_player', x: 4, y: 4 }
        ]
      })
    );

    expect(result).toMatchObject({
      contact: false,
      moved: false,
      from: SPAWN_NODE_ID,
      to: SPAWN_NODE_ID,
      contained: false,
      rewardGranted: false
    });
    expect(result.state).toBe(result.state);
    expect(result.state.nodeId).toBe(SPAWN_NODE_ID);
  });

  it('resets to spawn after contact and consumes exactly one successful-move grace', () => {
    const contacted = advanceRunPursuit(stalkingState({ contacts: 2 }), movementInput('zeta_path'));

    expect(contacted).toMatchObject({
      contact: true,
      moved: true,
      from: SPAWN_NODE_ID,
      to: 'zeta_path',
      contained: false,
      rewardGranted: false
    });
    expect(contacted.state).toMatchObject({
      status: 'stalking',
      nodeId: SPAWN_NODE_ID,
      contacts: 3,
      graceMoves: 1
    });

    const grace = advanceRunPursuit(contacted.state, movementInput('player_target'));
    expect(grace).toMatchObject({ moved: false, from: SPAWN_NODE_ID, to: SPAWN_NODE_ID });
    expect(grace.state.graceMoves).toBe(0);

    const resumed = advanceRunPursuit(grace.state, movementInput('player_target'));
    expect(resumed).toMatchObject({ moved: true, to: 'alpha_path' });
  });

  it('prioritizes prepared containment over contact and grants its material once', () => {
    const contained = advanceRunPursuit(
      stalkingState({ nodeId: 'zeta_path' }),
      movementInput(CONTAINMENT_NODE_ID, { containmentReady: true })
    );

    expect(contained).toMatchObject({
      contact: false,
      moved: true,
      from: 'zeta_path',
      to: CONTAINMENT_NODE_ID,
      contained: true,
      rewardGranted: true
    });
    expect(contained.state).toMatchObject({
      status: 'contained',
      nodeId: CONTAINMENT_NODE_ID,
      contacts: 0,
      graceMoves: 0,
      rewardGranted: true
    });

    const repeated = advanceRunPursuit(
      contained.state,
      movementInput(CONTAINMENT_NODE_ID, { containmentReady: true })
    );
    expect(repeated.state).toBe(contained.state);
    expect(repeated).toMatchObject({ contained: false, rewardGranted: false, moved: false });

    const unprepared = advanceRunPursuit(
      stalkingState({ nodeId: 'zeta_path' }),
      movementInput(CONTAINMENT_NODE_ID, { containmentReady: false })
    );
    expect(unprepared.contact).toBe(true);
    expect(unprepared.contained).toBe(false);
  });

  it('runs the genesis pursuit across the real map through contact and containment', () => {
    const dungeon = DUNGEONS.genesis_vault;
    const nodes = dungeon.nodes.map(({ id, position }) => ({
      id,
      x: position.x,
      y: position.y
    }));
    const dormant = createRunPursuitState('genesis_vault', true);
    const stalking = activateRunPursuit(dormant, RUN_PURSUIT_SPAWN_CLEAR_COUNT);

    const contact = advanceRunPursuit(stalking, {
      nodes,
      blockedEdges: [],
      playerNodeId: 'second_splice_console',
      containmentReady: false
    });
    expect(contact).toMatchObject({
      contact: true,
      moved: true,
      from: 'gene_stalker_alpha',
      to: 'second_splice_console',
      state: { nodeId: 'gene_stalker_alpha', contacts: 1, graceMoves: 1 }
    });

    let state = stalking;
    for (const expectedNodeId of ['primal_curator', 'boss_side_lock']) {
      const advanced = advanceRunPursuit(state, {
        nodes,
        blockedEdges: [],
        playerNodeId: 'genome_repair_station',
        containmentReady: true
      });
      expect(advanced).toMatchObject({ moved: true, to: expectedNodeId, contained: false });
      state = advanced.state;
    }
    const contained = advanceRunPursuit(state, {
      nodes,
      blockedEdges: [],
      playerNodeId: 'genome_repair_station',
      containmentReady: true
    });
    expect(contained).toMatchObject({
      contact: false,
      moved: true,
      to: 'genome_repair_station',
      contained: true,
      rewardGranted: true,
      state: { status: 'contained', rewardGranted: true }
    });
    expect(advanceRunPursuit(contained.state, {
      nodes,
      blockedEdges: [],
      playerNodeId: 'genome_repair_station',
      containmentReady: true
    })).toMatchObject({ moved: false, contained: false, rewardGranted: false });
  });

  it('contains the Tier-15 pursuit once on the real map', () => {
    const dungeon = DUNGEONS.silent_broadcast_tower;
    const nodes = dungeon.nodes.map(({ id, position }) => ({ id, x: position.x, y: position.y }));
    let state = activateRunPursuit(
      createRunPursuitState('silent_broadcast_tower', true),
      RUN_PURSUIT_SPAWN_CLEAR_COUNT
    );
    let rewardCount = 0;

    for (let step = 0; step < 8 && state.status === 'stalking'; step += 1) {
      const advanced = advanceRunPursuit(state, {
        nodes,
        blockedEdges: [],
        playerNodeId: 'anechoic_chamber',
        containmentReady: true
      });
      rewardCount += Number(advanced.rewardGranted);
      state = advanced.state;
    }

    expect(state).toMatchObject({
      dungeonId: 'silent_broadcast_tower',
      status: 'contained',
      nodeId: 'anechoic_chamber',
      rewardGranted: true
    });
    expect(rewardCount).toBe(1);
    expect(advanceRunPursuit(state, {
      nodes,
      blockedEdges: [],
      playerNodeId: 'anechoic_chamber',
      containmentReady: true
    })).toMatchObject({ moved: false, contained: false, rewardGranted: false });
  });

  it('contains the Tier-16 pursuit once on the real map', () => {
    const dungeon = DUNGEONS.lost_shelter;
    const nodes = dungeon.nodes.map(({ id, position }) => ({ id, x: position.x, y: position.y }));
    let state = activateRunPursuit(
      createRunPursuitState('lost_shelter', true),
      RUN_PURSUIT_SPAWN_CLEAR_COUNT
    );
    let rewardCount = 0;

    for (let step = 0; step < 8 && state.status === 'stalking'; step += 1) {
      const advanced = advanceRunPursuit(state, {
        nodes,
        blockedEdges: [],
        playerNodeId: 'containment_bay',
        containmentReady: true
      });
      rewardCount += Number(advanced.rewardGranted);
      state = advanced.state;
    }

    expect(state).toMatchObject({
      dungeonId: 'lost_shelter',
      status: 'contained',
      nodeId: 'containment_bay',
      rewardGranted: true
    });
    expect(rewardCount).toBe(1);
    expect(advanceRunPursuit(state, {
      nodes,
      blockedEdges: [],
      playerNodeId: 'containment_bay',
      containmentReady: true
    })).toMatchObject({ moved: false, contained: false, rewardGranted: false });
  });

  it('contains the Tier-17 pursuit once on the real map', () => {
    const dungeon = DUNGEONS.false_testimony_court;
    const nodes = dungeon.nodes.map(({ id, position }) => ({ id, x: position.x, y: position.y }));
    let state = activateRunPursuit(
      createRunPursuitState('false_testimony_court', true),
      RUN_PURSUIT_SPAWN_CLEAR_COUNT
    );
    let rewardCount = 0;

    for (let step = 0; step < 8 && state.status === 'stalking'; step += 1) {
      const advanced = advanceRunPursuit(state, {
        nodes,
        blockedEdges: [],
        playerNodeId: 'judgment_lock',
        containmentReady: true
      });
      rewardCount += Number(advanced.rewardGranted);
      state = advanced.state;
    }

    expect(state).toMatchObject({
      dungeonId: 'false_testimony_court',
      status: 'contained',
      nodeId: 'judgment_lock',
      rewardGranted: true
    });
    expect(rewardCount).toBe(1);
  });
});

describe('run pursuit boss, portals, and settlement', () => {
  it('preserves genesis stable-gate repel, forced carry, and boss fusion semantics', () => {
    const stalking = activateRunPursuit(
      createRunPursuitState('genesis_vault', true),
      RUN_PURSUIT_SPAWN_CLEAR_COUNT
    );
    expect(repelRunPursuitAtStablePortal(stalking)).toMatchObject({
      dungeonId: 'genesis_vault',
      status: 'repelled',
      repelledReason: 'stable_portal',
      rewardGranted: false
    });
    expect(carryRunPursuitThroughForcedPortal(stalking, 'demon_tower_1')).toMatchObject({
      dungeonId: 'demon_tower_1',
      status: 'stalking',
      nodeId: RUN_PURSUIT_CATALOG.demon_tower_1.spawnNodeId,
      graceMoves: 1,
      rewardGranted: false
    });
    const fused = fuseRunPursuitAtBoss(stalking);
    expect(fused).toMatchObject({
      dungeonId: 'genesis_vault',
      status: 'fused',
      nodeId: null,
      rewardGranted: false
    });
    expect(getRunPursuitBossFusionPercent(fused)).toBe(15);
  });

  it('preserves Tier-15 stable-gate repel, forced carry, and +15% boss fusion semantics', () => {
    const stalking = activateRunPursuit(
      createRunPursuitState('silent_broadcast_tower', true),
      RUN_PURSUIT_SPAWN_CLEAR_COUNT
    );
    expect(repelRunPursuitAtStablePortal(stalking)).toMatchObject({
      dungeonId: 'silent_broadcast_tower',
      status: 'repelled',
      repelledReason: 'stable_portal',
      rewardGranted: false
    });
    expect(carryRunPursuitThroughForcedPortal(stalking, 'demon_tower_1')).toMatchObject({
      dungeonId: 'demon_tower_1',
      status: 'stalking',
      nodeId: RUN_PURSUIT_CATALOG.demon_tower_1.spawnNodeId,
      graceMoves: 1,
      rewardGranted: false
    });
    const fused = fuseRunPursuitAtBoss(stalking);
    expect(fused).toMatchObject({
      dungeonId: 'silent_broadcast_tower',
      status: 'fused',
      nodeId: null,
      rewardGranted: false
    });
    expect(getRunPursuitBossFusionPercent(fused)).toBe(15);
  });

  it('preserves Tier-16 stable-gate repel, forced carry, grace, and +15% boss fusion semantics', () => {
    const stalking = activateRunPursuit(
      createRunPursuitState('lost_shelter', true),
      RUN_PURSUIT_SPAWN_CLEAR_COUNT
    );
    expect(repelRunPursuitAtStablePortal(stalking)).toMatchObject({
      dungeonId: 'lost_shelter',
      status: 'repelled',
      repelledReason: 'stable_portal',
      rewardGranted: false
    });
    expect(carryRunPursuitThroughForcedPortal(stalking, 'demon_tower_1')).toMatchObject({
      dungeonId: 'demon_tower_1',
      status: 'stalking',
      nodeId: RUN_PURSUIT_CATALOG.demon_tower_1.spawnNodeId,
      graceMoves: 1,
      rewardGranted: false
    });
    const fused = fuseRunPursuitAtBoss(stalking);
    expect(fused).toMatchObject({
      dungeonId: 'lost_shelter',
      status: 'fused',
      nodeId: null,
      rewardGranted: false
    });
    expect(getRunPursuitBossFusionPercent(fused)).toBe(15);
  });

  it('preserves Tier-17 stable-gate repel, forced carry, grace, and +15% boss fusion semantics', () => {
    const stalking = activateRunPursuit(
      createRunPursuitState('false_testimony_court', true),
      RUN_PURSUIT_SPAWN_CLEAR_COUNT
    );
    expect(repelRunPursuitAtStablePortal(stalking)).toMatchObject({
      dungeonId: 'false_testimony_court',
      status: 'repelled',
      repelledReason: 'stable_portal',
      rewardGranted: false
    });
    expect(carryRunPursuitThroughForcedPortal(stalking, 'demon_tower_1')).toMatchObject({
      dungeonId: 'demon_tower_1',
      status: 'stalking',
      nodeId: RUN_PURSUIT_CATALOG.demon_tower_1.spawnNodeId,
      graceMoves: 1,
      rewardGranted: false
    });
    const fused = fuseRunPursuitAtBoss(stalking);
    expect(fused).toMatchObject({
      dungeonId: 'false_testimony_court',
      status: 'fused',
      nodeId: null,
      rewardGranted: false
    });
    expect(getRunPursuitBossFusionPercent(fused)).toBe(15);
  });

  it('fuses only stalking pursuits and exposes the fixed boss scaling', () => {
    const stalking = stalkingState({ contacts: 2, graceMoves: 1 });
    const fused = fuseRunPursuitAtBoss(stalking);

    expect(fused).toMatchObject({
      status: 'fused',
      nodeId: null,
      contacts: 2,
      graceMoves: 0,
      rewardGranted: false
    });
    expect(getRunPursuitBossFusionPercent(fused)).toBe(15);
    expect(getRunPursuitBossFusionPercent(stalking)).toBe(0);
    expect(getRunPursuitBossFusionPercent(undefined)).toBe(0);
    expect(fuseRunPursuitAtBoss(fused)).toBe(fused);

    const contained = advanceRunPursuit(
      stalkingState({ nodeId: 'zeta_path' }),
      movementInput(CONTAINMENT_NODE_ID, { containmentReady: true })
    ).state;
    const repelled = repelRunPursuitAtStablePortal(stalkingState());
    for (const state of [createRunPursuitState(DUNGEON_ID, false), dormantState(), contained, repelled]) {
      expect(fuseRunPursuitAtBoss(state)).toBe(state);
    }
  });

  it('repels dormant or stalking pursuits at a stable portal without reward', () => {
    for (const state of [dormantState(), stalkingState({ contacts: 2 })]) {
      const repelled = repelRunPursuitAtStablePortal(state);
      expect(repelled).toMatchObject({
        status: 'repelled',
        nodeId: null,
        contacts: state.contacts,
        graceMoves: 0,
        rewardGranted: false,
        repelledReason: 'stable_portal'
      });
      expect(repelRunPursuitAtStablePortal(repelled)).toBe(repelled);
    }

    const disabled = createRunPursuitState(DUNGEON_ID, false);
    expect(repelRunPursuitAtStablePortal(disabled)).toBe(disabled);
  });

  it('carries only stalking pursuits through force portals using the target spawn', () => {
    const carried = carryRunPursuitThroughForcedPortal(
      stalkingState({ contacts: 3 }),
      'metro_abyss'
    );

    expect(carried).toMatchObject({
      dungeonId: 'metro_abyss',
      status: 'stalking',
      nodeId: RUN_PURSUIT_CATALOG.metro_abyss.spawnNodeId,
      contacts: 3,
      graceMoves: 1,
      rewardGranted: false,
      repelledReason: null
    });

    const dormant = dormantState();
    expect(carryRunPursuitThroughForcedPortal(dormant, 'metro_abyss')).toBe(dormant);
    expect(
      carryRunPursuitThroughForcedPortal(stalkingState(), 'missing' as 'metro_abyss')
    ).toMatchObject({ dungeonId: DUNGEON_ID, nodeId: SPAWN_NODE_ID });
  });

  it.each(['successful_exit', 'retreat', 'failure'] as const)(
    'settles stalking and dormant pursuits as %s while preserving terminal outcomes',
    (reason: RunPursuitSettlementReason) => {
      for (const state of [dormantState(), stalkingState({ contacts: 2 })]) {
        const settled = settleRunPursuit(state, reason);
        expect(settled).toMatchObject({
          status: 'repelled',
          nodeId: null,
          contacts: state.contacts,
          graceMoves: 0,
          rewardGranted: false,
          repelledReason: reason
        });
        expect(settleRunPursuit(settled, reason)).toBe(settled);
      }

      const contained = advanceRunPursuit(
        stalkingState({ nodeId: 'zeta_path' }),
        movementInput(CONTAINMENT_NODE_ID, { containmentReady: true })
      ).state;
      const fused = fuseRunPursuitAtBoss(stalkingState());
      const disabled = createRunPursuitState(DUNGEON_ID, false);

      expect(settleRunPursuit(contained, reason)).toBe(contained);
      expect(contained.rewardGranted).toBe(true);
      expect(settleRunPursuit(fused, reason)).toBe(fused);
      expect(fused.rewardGranted).toBe(false);
      expect(settleRunPursuit(disabled, reason)).toBe(disabled);
    }
  );

  it('adds exactly one pursuit serum when the ordinary exit reward uses the same item id', () => {
    const exitNode = DUNGEONS.genesis_vault.nodes.find(({ type }) => type === 'exit');
    const bossNodeId = getBossDefinition('genesis_vault').nodeId;
    if (!exitNode) throw new Error('Expected the genesis vault exit node.');

    const createExitState = (pursuitState: RunPursuitState): GameState => {
      const run: DungeonRun = {
        dungeonId: 'genesis_vault',
        currentNodeId: exitNode.id,
        clearedNodeIds: [bossNodeId],
        captures: 0,
        capturedPetIds: [],
        usedItems: [],
        damageTaken: 0,
        resolvedEventIds: [],
        eventLog: [],
        lootBag: createEmptyRunLootBag(),
        lootOffersMade: 0,
        pursuitState
      };
      const initial = createInitialState();
      return {
        ...initial,
        phase: 'explore',
        completedDungeonIds: ['genesis_vault'],
        inventory: { ...initial.inventory, genesis_serum: 0 },
        run
      };
    };
    const contained: RunPursuitState = {
      ...activateRunPursuit(
        createRunPursuitState('genesis_vault', true),
        RUN_PURSUIT_SPAWN_CLEAR_COUNT
      ),
      status: 'contained',
      nodeId: 'genome_repair_station',
      graceMoves: 0,
      rewardGranted: true
    };

    const ordinary = resolveExit(createExitState(createRunPursuitState('genesis_vault', false)));
    const rewarded = resolveExit(createExitState(contained));
    expect(ordinary.inventory.genesis_serum).toBe(4);
    expect(rewarded.inventory.genesis_serum).toBe(5);
    expect(rewarded.inventory.genesis_serum - ordinary.inventory.genesis_serum).toBe(1);
    expect(rewarded.run?.lastPursuitSettlement).toMatchObject({
      materialId: 'genesis_serum',
      rewarded: true,
      state: { status: 'contained', rewardGranted: true }
    });
    expect(resolveExit(rewarded).inventory.genesis_serum).toBe(5);
  });

  it('adds exactly one pursuit core over the ordinary Tier-15 core reward', () => {
    const exitNode = DUNGEONS.silent_broadcast_tower.nodes.find(({ type }) => type === 'exit');
    const bossNodeId = getBossDefinition('silent_broadcast_tower').nodeId;
    if (!exitNode) throw new Error('Expected the silent broadcast tower exit node.');

    const createExitState = (pursuitState: RunPursuitState): GameState => {
      const run: DungeonRun = {
        dungeonId: 'silent_broadcast_tower',
        currentNodeId: exitNode.id,
        clearedNodeIds: [bossNodeId],
        captures: 0,
        capturedPetIds: [],
        usedItems: [],
        damageTaken: 0,
        resolvedEventIds: [],
        eventLog: [],
        lootBag: createEmptyRunLootBag(),
        lootOffersMade: 0,
        pursuitState
      };
      const initial = createInitialState();
      return {
        ...initial,
        phase: 'explore',
        completedDungeonIds: ['silent_broadcast_tower'],
        inventory: { ...initial.inventory, silence_core: 0 },
        run
      };
    };
    const contained: RunPursuitState = {
      ...activateRunPursuit(
        createRunPursuitState('silent_broadcast_tower', true),
        RUN_PURSUIT_SPAWN_CLEAR_COUNT
      ),
      status: 'contained',
      nodeId: 'anechoic_chamber',
      graceMoves: 0,
      rewardGranted: true
    };

    const ordinary = resolveExit(createExitState(createRunPursuitState('silent_broadcast_tower', false)));
    const rewarded = resolveExit(createExitState(contained));
    expect(ordinary.inventory.silence_core).toBe(4);
    expect(rewarded.inventory.silence_core).toBe(5);
    expect(rewarded.inventory.silence_core - ordinary.inventory.silence_core).toBe(1);
    expect(rewarded.run?.lastPursuitSettlement).toMatchObject({
      materialId: 'silence_core',
      rewarded: true,
      state: { status: 'contained', rewardGranted: true }
    });
    expect(resolveExit(rewarded).inventory.silence_core).toBe(5);
  });

  it('adds exactly one pursuit badge over the ordinary Tier-16 badge reward', () => {
    const exitNode = DUNGEONS.lost_shelter.nodes.find(({ type }) => type === 'exit');
    const bossNodeId = getBossDefinition('lost_shelter').nodeId;
    if (!exitNode) throw new Error('Expected the lost shelter exit node.');

    const createExitState = (pursuitState: RunPursuitState): GameState => {
      const run: DungeonRun = {
        dungeonId: 'lost_shelter',
        currentNodeId: exitNode.id,
        clearedNodeIds: [bossNodeId],
        captures: 0,
        capturedPetIds: [],
        usedItems: [],
        damageTaken: 0,
        resolvedEventIds: [],
        eventLog: [],
        lootBag: createEmptyRunLootBag(),
        lootOffersMade: 0,
        pursuitState
      };
      const initial = createInitialState();
      return {
        ...initial,
        phase: 'explore',
        completedDungeonIds: ['lost_shelter'],
        inventory: { ...initial.inventory, rescue_badge: 0 },
        run
      };
    };
    const contained: RunPursuitState = {
      ...activateRunPursuit(
        createRunPursuitState('lost_shelter', true),
        RUN_PURSUIT_SPAWN_CLEAR_COUNT
      ),
      status: 'contained',
      nodeId: 'containment_bay',
      graceMoves: 0,
      rewardGranted: true
    };

    const ordinary = resolveExit(createExitState(createRunPursuitState('lost_shelter', false)));
    const rewarded = resolveExit(createExitState(contained));
    expect(ordinary.inventory.rescue_badge).toBe(4);
    expect(rewarded.inventory.rescue_badge).toBe(5);
    expect(rewarded.inventory.rescue_badge - ordinary.inventory.rescue_badge).toBe(1);
    expect(rewarded.run?.lastPursuitSettlement).toMatchObject({
      materialId: 'rescue_badge',
      rewarded: true,
      state: { status: 'contained', rewardGranted: true }
    });
    expect(resolveExit(rewarded).inventory.rescue_badge).toBe(5);
  });

  it('adds exactly one truth fragment over the ordinary Tier-17 exit reward', () => {
    const exitNode = DUNGEONS.false_testimony_court.nodes.find(({ type }) => type === 'exit');
    const bossNodeId = getBossDefinition('false_testimony_court').nodeId;
    if (!exitNode) throw new Error('Expected the false testimony court exit node.');

    const createExitState = (pursuitState: RunPursuitState): GameState => {
      const run: DungeonRun = {
        dungeonId: 'false_testimony_court',
        currentNodeId: exitNode.id,
        clearedNodeIds: [bossNodeId],
        captures: 0,
        capturedPetIds: [],
        usedItems: [],
        damageTaken: 0,
        resolvedEventIds: [],
        eventLog: [],
        lootBag: createEmptyRunLootBag(),
        lootOffersMade: 0,
        pursuitState
      };
      const initial = createInitialState();
      return {
        ...initial,
        phase: 'explore',
        completedDungeonIds: ['false_testimony_court'],
        inventory: { ...initial.inventory, truth_fragment: 0 },
        run
      };
    };
    const contained: RunPursuitState = {
      ...activateRunPursuit(
        createRunPursuitState('false_testimony_court', true),
        RUN_PURSUIT_SPAWN_CLEAR_COUNT
      ),
      status: 'contained',
      nodeId: 'judgment_lock',
      graceMoves: 0,
      rewardGranted: true
    };

    const ordinary = resolveExit(createExitState(createRunPursuitState('false_testimony_court', false)));
    const rewarded = resolveExit(createExitState(contained));
    expect(ordinary.inventory.truth_fragment).toBe(4);
    expect(rewarded.inventory.truth_fragment).toBe(5);
    expect(rewarded.inventory.truth_fragment - ordinary.inventory.truth_fragment).toBe(1);
    expect(rewarded.run?.lastPursuitSettlement).toMatchObject({
      materialId: 'truth_fragment',
      rewarded: true,
      state: { status: 'contained', rewardGranted: true }
    });
    expect(resolveExit(rewarded).inventory.truth_fragment).toBe(5);
  });

  it('adds exactly one combat reel over the ordinary Tier-18 exit reward', () => {
    const exitNode = DUNGEONS.combat_replay_stage.nodes.find(({ type }) => type === 'exit');
    const bossNodeId = getBossDefinition('combat_replay_stage').nodeId;
    if (!exitNode) throw new Error('Expected the combat replay stage exit node.');

    const createExitState = (pursuitState: RunPursuitState): GameState => {
      const run: DungeonRun = {
        dungeonId: 'combat_replay_stage',
        currentNodeId: exitNode.id,
        clearedNodeIds: [bossNodeId],
        captures: 0,
        capturedPetIds: [],
        usedItems: [],
        damageTaken: 0,
        resolvedEventIds: [],
        eventLog: [],
        lootBag: createEmptyRunLootBag(),
        lootOffersMade: 0,
        pursuitState
      };
      const initial = createInitialState();
      return {
        ...initial,
        phase: 'explore',
        completedDungeonIds: ['combat_replay_stage'],
        inventory: { ...initial.inventory, combat_reel: 0 },
        run
      };
    };
    const contained: RunPursuitState = {
      ...activateRunPursuit(
        createRunPursuitState('combat_replay_stage', true),
        RUN_PURSUIT_SPAWN_CLEAR_COUNT
      ),
      status: 'contained',
      nodeId: 'final_cut_lock',
      graceMoves: 0,
      rewardGranted: true
    };

    const ordinary = resolveExit(createExitState(createRunPursuitState('combat_replay_stage', false)));
    const rewarded = resolveExit(createExitState(contained));
    expect(ordinary.inventory.combat_reel).toBe(4);
    expect(rewarded.inventory.combat_reel).toBe(5);
    expect(rewarded.inventory.combat_reel - ordinary.inventory.combat_reel).toBe(1);
    expect(rewarded.run?.lastPursuitSettlement).toMatchObject({
      materialId: 'combat_reel',
      rewarded: true,
      state: { status: 'contained', rewardGranted: true }
    });
    expect(resolveExit(rewarded).inventory.combat_reel).toBe(5);
  });
});

describe('run pursuit validation and presentation', () => {
  it('strictly normalizes exact-key snapshots with context-aware node validation', () => {
    const dormant = dormantState();
    const moved = stalkingState({ nodeId: 'alpha_path', contacts: 1 });
    const knownNodeIds = GRID_NODES.map((node) => node.id);

    expect(normalizeRunPursuitState(dormant)).toEqual(dormant);
    expect(normalizeRunPursuitState(moved)).toBeUndefined();
    expect(normalizeRunPursuitState(moved, knownNodeIds)).toEqual(moved);
    expect(isRunPursuitState(moved, knownNodeIds)).toBe(true);
    expect(moved).toEqual(stalkingState({ nodeId: 'alpha_path', contacts: 1 }));
  });

  it.each([
    undefined,
    null,
    [],
    {},
    { ...dormantState(), futureField: true },
    (() => {
      const { nodeId: _nodeId, ...missingNodeId } = dormantState();
      return missingNodeId;
    })(),
    { ...dormantState(), rulesVersion: 2 },
    { ...dormantState(), dungeonId: 'unknown' },
    { ...dormantState(), status: 'waiting' },
    { ...dormantState(), contacts: -1 },
    { ...dormantState(), contacts: 1.5 },
    { ...dormantState(), graceMoves: -1 },
    { ...dormantState(), graceMoves: 2 },
    { ...dormantState(), nodeId: SPAWN_NODE_ID },
    { ...dormantState(), contacts: 1 },
    { ...stalkingState(), nodeId: 'unknown_node' },
    { ...stalkingState(), rewardGranted: true },
    { ...stalkingState(), repelledReason: 'failure' },
    { ...stalkingState(), status: 'contained', nodeId: SPAWN_NODE_ID, rewardGranted: true },
    { ...stalkingState(), status: 'contained', nodeId: CONTAINMENT_NODE_ID, rewardGranted: false },
    { ...stalkingState(), status: 'fused', nodeId: null, graceMoves: 1 },
    { ...stalkingState(), status: 'repelled', nodeId: null, repelledReason: null }
  ])('rejects a malformed or illegal pursuit snapshot: %o', (snapshot) => {
    expect(normalizeRunPursuitState(snapshot)).toBeUndefined();
    expect(isRunPursuitState(snapshot)).toBe(false);
  });

  it('calculates contact damage with safe normalization', () => {
    expect(getRunPursuitContactDamage(100, 3)).toBe(18);
    expect(getRunPursuitContactDamage(1, 0)).toBe(1);
    expect(getRunPursuitContactDamage(-100, -4)).toBe(1);
    expect(getRunPursuitContactDamage(Number.NaN, Number.POSITIVE_INFINITY)).toBe(1);
    expect(getRunPursuitContactDamage(99.9, 2.9)).toBe(16);
  });

  it('returns structured progress and display data for UI consumers', () => {
    const state = stalkingState({ contacts: 2, graceMoves: 1 });

    expect(getRunPursuitProgress(state, 5)).toEqual({
      status: 'stalking',
      active: true,
      currentNodeId: SPAWN_NODE_ID,
      contacts: 2,
      graceMoves: 1,
      rewardGranted: false,
      repelledReason: null,
      clearedNodeCount: 5,
      spawnClearCount: 6,
      clearsRemaining: 1
    });
    expect(getRunPursuitDisplay(state, 7)).toMatchObject({
      dungeonId: DUNGEON_ID,
      name: '血阶监猎者',
      status: 'stalking',
      statusLabel: '追猎',
      materialId: 'demon_bone',
      rewardAmount: 1,
      contactDamagePercent: 15,
      bossFusionPercent: 15,
      progress: { clearedNodeCount: 7, clearsRemaining: 0 }
    });
  });
});
