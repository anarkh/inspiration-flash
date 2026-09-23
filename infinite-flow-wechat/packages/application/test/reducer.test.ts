import {
  createInitialState,
  getCombatEncounterProfile,
  type GameState
} from '@infinite-flow/core';
import {
  reduceGameCommand,
  validateGameCommand,
  type GameCommand
} from '../src/index.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function committed(state: GameState, command: GameCommand): GameState {
  const result = reduceGameCommand(state, command);
  if (result.status === 'rejected') {
    throw new Error(`${command.type} rejected: ${result.reason.message}`);
  }
  return result.state;
}

const NORMAL_ENTRY = {
  type: 'run/enter',
  dungeonId: 'demon_tower_1',
  protocolId: 'standard',
  seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_abcd }
} as const satisfies GameCommand;

function enterFirstChapter(): GameState {
  return committed(createInitialState(), NORMAL_ENTRY);
}

function resolvePendingNodeChoices(state: GameState): GameState {
  let next = state;
  if (next.run?.pendingEquipmentOffer) {
    next = committed(next, { type: 'node/resolve-equipment-loot' });
  }
  const pendingDraft = next.run?.relicState?.pendingDraft;
  const relicId = pendingDraft?.candidateIds[0];
  if (pendingDraft && relicId) {
    next = committed(next, {
      type: 'node/resolve-relic-draft',
      draftId: pendingDraft.draftId,
      relicId
    });
  }
  return next;
}

function winCurrentCombat(state: GameState): GameState {
  assert(state.combat, 'expected active combat');
  const lethal: GameState = {
    ...state,
    player: {
      ...state.player,
      hp: Math.max(state.player.hp, 10_000),
      maxHp: Math.max(state.player.maxHp, 10_000)
    },
    combat: { ...state.combat, monsterHp: 1 }
  };
  return resolvePendingNodeChoices(committed(lethal, { type: 'combat/act', action: 'attack' }));
}

// Commands are JSON-only and deep entry cannot hide an implicit map-seed request.
assert(!validateGameCommand({ type: 'hub/recover', callback: () => undefined }).ok,
  'function-bearing command must be rejected');
const invalidDeep = reduceGameCommand(createInitialState(), {
  type: 'run/enter',
  dungeonId: 'demon_tower_1',
  protocolId: 'deep',
  infernoTier: 1,
  seeds: { rulesVersion: 1, hiddenTaskSeed: 7 }
});
assert(invalidDeep.status === 'rejected' && invalidDeep.reason.code === 'invalid-seed-bundle',
  'deep entry must require its persisted map seed');

// An illegal phase rejects without replacing or mutating the state.
const hub = createInitialState();
const hubSnapshot = JSON.stringify(hub);
const invalidPhase = reduceGameCommand(hub, { type: 'combat/act', action: 'attack' });
assert(invalidPhase.status === 'rejected', 'hub combat action should reject');
assert(invalidPhase.state === hub, 'phase rejection must preserve the exact state reference');
assert(JSON.stringify(hub) === hubSnapshot, 'phase rejection must not mutate the state');

// Identical persisted seeds create identical entry snapshots and are retained in state.
const firstEntry = enterFirstChapter();
const secondEntry = enterFirstChapter();
assert(firstEntry.run?.hiddenTaskSeed === 0x1234_abcd, 'entry seed must be stored in the run');
assert(JSON.stringify(firstEntry) === JSON.stringify(secondEntry), 'same state and seeds must enter deterministically');

// One reducer call advances one ordinary combat action exactly once.
const openingCombat = committed(firstEntry, {
  type: 'run/select-node',
  nodeId: 'fog_lesser_demon'
});
assert(openingCombat.combat, 'start node should open combat');
const turnBefore = openingCombat.combat.turn;
const oneAttack = reduceGameCommand(openingCombat, { type: 'combat/act', action: 'attack' });
assert(oneAttack.status === 'committed', 'ordinary attack should commit');
assert(oneAttack.state.combat?.turn === turnBefore + 1, 'one command must advance exactly one turn');
assert(
  oneAttack.events.filter((event) => event.type === 'combat.turn-resolved').length === 1,
  'one command must emit one turn event'
);

// A cleared start node permits one adjacent grid move, while a diagonal jump is rejected unchanged.
const afterOpening = winCurrentCombat(openingCombat);
const illegalJump = reduceGameCommand(afterOpening, { type: 'run/move', nodeId: 'sealed_cache' });
assert(illegalJump.status === 'rejected' && illegalJump.reason.code === 'illegal-move',
  'non-adjacent movement should reject');
assert(illegalJump.state === afterOpening, 'illegal movement must preserve state identity');
const atTrap = committed(afterOpening, { type: 'run/move', nodeId: 'blood_rune_trap' });
assert(atTrap.run?.currentNodeId === 'blood_rune_trap', 'legal adjacent movement should change current node');

// The first chapter's command surface supports a scripted phase route through boss and exit.
let routeState = committed(atTrap, { type: 'node/handle-trap', choice: 'risk' });
routeState = committed(routeState, { type: 'run/move', nodeId: 'cracked_portal' });
routeState = committed(routeState, { type: 'run/move', nodeId: 'sealed_cache' });
routeState = resolvePendingNodeChoices(committed(routeState, { type: 'node/collect-reward' }));
routeState = committed(routeState, { type: 'run/move', nodeId: 'mist_herb_cache' });
routeState = resolvePendingNodeChoices(committed(routeState, { type: 'node/collect-reward' }));
routeState = committed(routeState, { type: 'run/move', nodeId: 'bone_lane_monster' });
routeState = committed(routeState, { type: 'run/select-node', nodeId: 'bone_lane_monster' });

// Crossing the boss threshold awakens it once; the following lethal action clears it.
assert(routeState.combat?.bossPhase === 'sealed', 'boss must begin sealed');
const bossProfile = getCombatEncounterProfile(routeState);
assert(bossProfile?.boss, 'first chapter boss profile should exist');
const nearThreshold: GameState = {
  ...routeState,
  player: {
    ...routeState.player,
    hp: Math.max(routeState.player.hp, 10_000),
    maxHp: Math.max(routeState.player.maxHp, 10_000)
  },
  combat: {
    ...routeState.combat,
    monsterHp: Math.floor(bossProfile.monster.maxHp / 2) + 1
  }
};
const awakened = reduceGameCommand(nearThreshold, { type: 'combat/act', action: 'attack' });
assert(awakened.status === 'committed', 'threshold attack should commit');
assert(awakened.state.combat?.bossPhase === 'awakened', 'boss should enter awakened phase');
assert(awakened.events.filter((event) => event.type === 'boss.awakened').length === 1,
  'awakening must emit exactly once');
const afterBoss = winCurrentCombat(awakened.state);
assert(afterBoss.run?.clearedNodeIds.includes('bone_lane_monster'), 'boss node should be cleared');
const atExit = committed(afterBoss, { type: 'run/move', nodeId: 'tower_exit' });
assert(atExit.run?.relicState, 'current entry flow should carry relic state');
const exitWithArchivedCandidate: GameState = {
  ...atExit,
  run: {
    ...atExit.run,
    relicState: {
      ...atExit.run.relicState,
      acquiredIds: atExit.run.relicState.acquiredIds.length > 0
        ? atExit.run.relicState.acquiredIds
        : ['mist_edge']
    }
  }
};
const settledResult = reduceGameCommand(exitWithArchivedCandidate, { type: 'run/resolve-exit' });
assert(settledResult.status === 'committed' && settledResult.state.phase === 'result',
  'cleared boss should unlock exit settlement');
assert(settledResult.state.completedDungeonIds.includes('demon_tower_1'),
  'exit must archive first-chapter completion');

// Replaying settlement is phase-rejected, and result archival gates returning to the hub.
const repeatedExit = reduceGameCommand(settledResult.state, { type: 'run/resolve-exit' });
assert(repeatedExit.status === 'rejected' && repeatedExit.state === settledResult.state,
  'repeat exit settlement must retain the settled state');
assert(settledResult.state.run?.lastRelicSettlement?.status === 'pending',
  'collected chapter relic should require result archival');
const blockedReturn = reduceGameCommand(settledResult.state, { type: 'result/return-hub' });
assert(blockedReturn.status === 'rejected' && blockedReturn.state === settledResult.state,
  'pending archival must block hub return without changing result state');
const relicToArchive = settledResult.state.run.lastRelicSettlement.acquiredIds[0];
assert(relicToArchive, 'pending archival should contain an acquired relic');
const archivedResult = committed(settledResult.state, {
  type: 'result/archive-relic',
  relicId: relicToArchive
});
assert(archivedResult.run?.lastRelicSettlement?.status === 'archived',
  'selected relic should be archived before returning');
const returnedHub = committed(archivedResult, { type: 'result/return-hub' });
assert(returnedHub.phase === 'hub' && returnedHub.run === undefined,
  'resolved result should return to a clean hub state');
