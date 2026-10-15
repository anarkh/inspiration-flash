import {
  capturePet,
  createInitialState,
  getDerivedStats,
  moveToNode,
  performCombatAction,
  resolveRetreat,
  type GameState
} from '@infinite-flow/core';
import { reduceGameCommand, type GameCommand } from '../src/index.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function committed(state: GameState, command: GameCommand): GameState {
  const result = reduceGameCommand(state, command);
  assert(result.status === 'committed', `${command.type}: fixture must commit`);
  return result.state;
}

function encounter(hub = createInitialState()): GameState {
  const entered = committed(hub, {
    type: 'run/enter', dungeonId: 'demon_tower_1', protocolId: 'standard',
    seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_abcd }
  });
  const started = committed(entered, { type: 'run/select-node', nodeId: 'fog_lesser_demon' });
  assert(started.combat && started.run, 'fixture must start a real encounter');
  return started;
}

function transition(
  state: GameState,
  command: GameCommand,
  core: (state: GameState) => GameState
): GameState {
  const snapshot = JSON.stringify(state);
  const direct = core(state);
  const reduced = reduceGameCommand(state, command);
  assert(reduced.status === 'committed', `${command.type}: transition must commit`);
  assert(JSON.stringify(direct) === JSON.stringify(reduced.state),
    `${command.type}: direct core and reducer must agree on post-combat recovery`);
  assert(JSON.stringify(state) === snapshot, `${command.type}: transition must preserve input`);
  return reduced.state;
}

function finishedResult(state: GameState, command: GameCommand): string | undefined {
  const reduced = reduceGameCommand(state, command);
  assert(reduced.status === 'committed', `${command.type}: finishing command must commit`);
  const finished = reduced.events.find(event => event.type === 'combat.finished');
  return finished?.type === 'combat.finished' ? finished.result : undefined;
}

function assertRecovered(state: GameState, phase: 'explore' | 'result', label: string): void {
  assert(state.phase === phase && !state.combat, `${label}: encounter must be finished`);
  assert(state.player.maxHp === getDerivedStats(state).maxHp, `${label}: use settled derived maximum HP`);
  assert(state.player.hp === state.player.maxHp, `${label}: finished encounter must restore full HP`);
}

const started = encounter();
assert(started.combat && started.run, 'opening combat has a run');
const injured: GameState = {
  ...started,
  player: { ...started.player, hp: 30 },
  run: { ...started.run, damageTaken: 17 }
};
const winning: GameState = { ...injured, combat: { ...started.combat, monsterHp: 1 } };
const won = transition(winning, { type: 'combat/act', action: 'attack' }, state => performCombatAction(state, 'attack'));
assertRecovered(won, 'explore', 'victory');
assert(won.run?.damageTaken === 17, 'victory healing must not erase accumulated damage');
assert(won.run.clearedNodeIds.includes(started.combat.nodeId), 'victory still clears its encounter node');
assert(won.run.lootBag.rewardPoints > injured.run!.lootBag.rewardPoints, 'victory still grants encounter rewards');
assert(JSON.stringify(won.completedDungeonIds) === JSON.stringify(injured.completedDungeonIds),
  'an ordinary encounter victory must not grant dungeon completion');

const speedy: GameState = {
  ...injured,
  player: { ...injured.player, base: { ...injured.player.base, agility: 100, luck: 100 } }
};
const escaped = transition(speedy, { type: 'combat/act', action: 'escape' }, state => performCombatAction(state, 'escape'));
assertRecovered(escaped, 'explore', 'successful escape');
assert(escaped.run?.damageTaken === 25, 'escape recovery preserves the eight-point scrape in run damage');
assert(!escaped.run.clearedNodeIds.includes(started.combat.nodeId), 'escape must not clear the monster');
assert(JSON.stringify(escaped.run.lootBag) === JSON.stringify(speedy.run!.lootBag),
  'escape recovery must not grant or discard carried rewards');

const fatalEscape: GameState = { ...speedy, player: { ...speedy.player, hp: 1 } };
const escapeFailure = transition(fatalEscape, { type: 'combat/act', action: 'escape' },
  state => performCombatAction(state, 'escape'));
assertRecovered(escapeFailure, 'result', 'fatal escape scrape');
assert(escapeFailure.run?.damageTaken === 18, 'fatal scrape records only the remaining HP as damage');
assert(escapeFailure.run.lastLootSettlement && escapeFailure.lastOutcome,
  'fatal escape must retain the failure and loot settlement');

const trapped: GameState = {
  ...injured,
  player: { ...injured.player, base: { ...injured.player.base, agility: 0, luck: 0 } },
  combat: { ...started.combat, monsterHp: 1000, monsterId: 'tower_butcher' }
};
const escapeContinues = transition(trapped, { type: 'combat/act', action: 'escape' },
  state => performCombatAction(state, 'escape'));
assert(escapeContinues.phase === 'combat' && escapeContinues.combat,
  'unsuccessful escape must leave the encounter active');
assert(escapeContinues.player.hp < trapped.player.hp && escapeContinues.player.hp > 0,
  'unsuccessful escape must retain real counter damage without healing');
assert(escapeContinues.run!.damageTaken > trapped.run!.damageTaken,
  'unsuccessful escape still accumulates the counter damage');

const doomed: GameState = { ...trapped, player: { ...trapped.player, hp: 1 } };
const defeated = transition(doomed, { type: 'combat/act', action: 'attack' },
  state => performCombatAction(state, 'attack'));
assertRecovered(defeated, 'result', 'combat defeat');
assert(defeated.run?.damageTaken === 18, 'defeat healing must retain the lethal damage in run scoring');
assert(defeated.run.lastLootSettlement && defeated.lastOutcome, 'defeat still performs normal run settlement');
assert(JSON.stringify(defeated.claimedDirectiveIds) === JSON.stringify(doomed.claimedDirectiveIds)
  && JSON.stringify(defeated.completedDungeonIds) === JSON.stringify(doomed.completedDungeonIds),
  'defeat recovery must not grant completion rewards');

const doomedEscape: GameState = { ...trapped, player: { ...trapped.player, hp: 1 } };
const caughtEscaping = transition(doomedEscape, { type: 'combat/act', action: 'escape' },
  state => performCombatAction(state, 'escape'));
assertRecovered(caughtEscaping, 'result', 'escape cut off by a lethal counter');
assert(finishedResult(winning, { type: 'combat/act', action: 'attack' }) === 'victory',
  'combat.finished reports a victory');
assert(finishedResult(speedy, { type: 'combat/act', action: 'escape' }) === 'escaped',
  'combat.finished reports a successful escape');
assert(finishedResult(fatalEscape, { type: 'combat/act', action: 'escape' }) === 'failed',
  'combat.finished reports a fatal escape scrape as a failed run, not an escape');
assert(finishedResult(doomedEscape, { type: 'combat/act', action: 'escape' }) === 'failed',
  'combat.finished reports death after a failed escape as a failed run, not an escape');
assert(finishedResult(doomed, { type: 'combat/act', action: 'attack' }) === 'failed',
  'combat.finished reports a combat defeat');

const retreated = transition(injured, { type: 'run/retreat' }, resolveRetreat);
assertRecovered(retreated, 'result', 'retreat during combat');
assert(retreated.run?.damageTaken === 17 && retreated.run.lastLootSettlement && retreated.lastOutcome,
  'combat retreat preserves damage history and performs its ordinary settlement');

// Replacing a body-bonus pet changes the actual maximum HP during capture.
const initial = createInitialState();
const capturingHub: GameState = {
  ...initial,
  ownedPets: ['void_whelp'], activePet: 'void_whelp', petLevels: { void_whelp: 1 },
  preparedItemIds: ['capture_net'], inventory: { ...initial.inventory, capture_net: 2 }
};
const captureMaximum = getDerivedStats(capturingHub).maxHp;
const captureStart = encounter({
  ...capturingHub, player: { ...capturingHub.player, hp: captureMaximum, maxHp: captureMaximum }
});
assert(captureStart.combat && captureStart.run, 'capture fixture is in a real encounter');
const captureReady: GameState = {
  ...captureStart,
  player: { ...captureStart.player, hp: 11 },
  combat: { ...captureStart.combat, monsterHp: 1 },
  run: { ...captureStart.run, damageTaken: 19 }
};
const captured = transition(captureReady, { type: 'combat/capture', petId: 'mist_kitten' },
  state => capturePet(state, 'mist_kitten'));
assertRecovered(captured, 'explore', 'successful capture');
assert(captured.player.maxHp === captureReady.player.maxHp - 14,
  'capture healing uses the new active pet maximum, not the old combat maximum');
assert(captured.activePet === 'mist_kitten' && captured.ownedPets.includes('mist_kitten'),
  'capture recovery preserves the newly owned and active pet');
assert(captured.run?.captures === 1 && captured.run.capturedPetIds.includes('mist_kitten')
  && captured.run.clearedNodeIds.includes(captureStart.combat.nodeId),
  'capture still records its reward and node completion');
assert(captured.run.damageTaken === 19 && captured.run.usedItems.includes('capture_net')
  && captured.inventory.capture_net === captureReady.inventory.capture_net - 1,
  'capture recovery preserves accumulated damage and the consumed net');

const notWeakened: GameState = {
  ...captureReady, combat: { ...captureReady.combat!, monsterHp: captureStart.combat.monsterHp }
};
const notWeakenedSnapshot = JSON.stringify(notWeakened);
const failedCapture = capturePet(notWeakened, 'mist_kitten');
const failedCaptureCommand = reduceGameCommand(notWeakened, { type: 'combat/capture', petId: 'mist_kitten' });
assert(failedCapture.phase === 'combat' && failedCapture.combat && failedCapture.player.hp === 11,
  'failed capture cannot heal an encounter that is still active');
assert(failedCapture.inventory.capture_net === notWeakened.inventory.capture_net,
  'unavailable capture keeps its net');
assert(failedCaptureCommand.status === 'rejected' && failedCaptureCommand.state === notWeakened
  && failedCaptureCommand.events.length === 0, 'rejected capture must leave reducer state and HP intact');
assert(JSON.stringify(notWeakened) === notWeakenedSnapshot, 'failed capture must preserve its input');

const exploringInjured: GameState = { ...won, player: { ...won.player, hp: 13 } };
const moved = transition(exploringInjured, { type: 'run/move', nodeId: 'blood_rune_trap' },
  state => moveToNode(state, 'blood_rune_trap'));
assert(moved.phase === 'explore' && moved.run?.currentNodeId === 'blood_rune_trap' && moved.player.hp === 13,
  'ordinary exploration movement must not trigger combat recovery');
