import {
  createInitialState,
  getCombatEncounterRank,
  getCurrentCombatIntent,
  isCurrentCombatParryable,
  type CombatPresentationFrame,
  type GameState,
  type MonsterId
} from '@infinite-flow/core';
import { reduceGameCommand, validateGameCommand, type GameCommand } from '../src/index.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function apply(state: GameState, command: GameCommand): GameState {
  const result = reduceGameCommand(state, command);
  assert(result.status === 'committed', `${command.type} fixture must commit`);
  return result.state;
}

function resolve(state: GameState, command: GameCommand): { after: GameState; frames: readonly CombatPresentationFrame[] } {
  const result = reduceGameCommand(state, command);
  assert(result.status === 'committed', `${JSON.stringify(command)} must commit`);
  const event = result.events.find(candidate => candidate.type === 'combat.presentation-resolved');
  assert(event?.type === 'combat.presentation-resolved', `${JSON.stringify(command)} emits frames`);
  return { after: result.state, frames: event.frames };
}

function counterLoss(state: GameState, command: GameCommand): number {
  const { frames } = resolve(state, command);
  const impact = frames.find(frame => frame.stage === 'impact');
  const counter = frames.find(frame => frame.stage === 'counter');
  assert(impact && counter, `${JSON.stringify(command)} has impact and counter`);
  return impact.playerHp - counter.playerHp;
}

const entered = apply(createInitialState(), {
  type: 'run/enter', dungeonId: 'demon_tower_1', protocolId: 'standard',
  seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_abcd }
});
const opening = apply(entered, { type: 'run/select-node', nodeId: 'fog_lesser_demon' });
assert(opening.combat && opening.run, 'fixture has an active encounter');

function encounter(nodeId: string, monsterId: MonsterId, turn: number): GameState {
  return {
    ...opening,
    player: { ...opening.player, hp: opening.player.maxHp },
    inventory: { ...opening.inventory, armor_patch: 0 },
    combat: { ...opening.combat!, nodeId, monsterId, monsterHp: 1000, turn, weaponFocus: 0, log: [] }
  };
}

// Ordinary encounters keep their original intents on every turn.
const ordinary = encounter('fog_lesser_demon', 'fog_lesser_demon', 2);
assert(getCombatEncounterRank(ordinary) === undefined, 'ordinary monster has no encounter rank');
assert(getCurrentCombatIntent(ordinary)?.id === 'regular-pursuit', 'ordinary monster never telegraphs a heavy blow');
assert(!isCurrentCombatParryable(ordinary), 'ordinary turn is not parryable');

// Elite: turns 2, 5, 8 telegraph a heavy blow; other turns stay regular.
const eliteTurn1 = encounter('butcher_turn', 'tower_butcher', 1);
const eliteHeavy = encounter('butcher_turn', 'tower_butcher', 2);
const eliteTurn3 = encounter('butcher_turn', 'tower_butcher', 3);
assert(getCombatEncounterRank(eliteHeavy) === 'elite', 'dungeon elite monster is ranked elite');
assert(getCurrentCombatIntent(eliteTurn1)?.id === 'regular-pursuit', 'elite turn 1 is regular');
assert(getCurrentCombatIntent(eliteTurn3)?.id === 'regular-pursuit', 'elite turn 3 is regular');
const heavyIntent = getCurrentCombatIntent(eliteHeavy);
assert(heavyIntent?.id === 'heavy-blow' && heavyIntent.severity === 'danger', 'elite turn 2 telegraphs a heavy blow');
assert(heavyIntent.recommendedActions.includes('guard'), 'heavy blow recommends guarding');
assert(getCurrentCombatIntent(encounter('butcher_turn', 'tower_butcher', 5))?.id === 'heavy-blow', 'heavy blow repeats every 3 turns');
assert(isCurrentCombatParryable(eliteHeavy), 'heavy blow turn is parryable');

// Boss nodes are ranked boss and share the cadence.
const bossHeavy = encounter('bone_lane_monster', 'tower_butcher', 2);
assert(getCombatEncounterRank(bossHeavy) === 'boss', 'boss node outranks the elite table');
assert(getCurrentCombatIntent(bossHeavy)?.id === 'heavy-blow', 'boss telegraphs heavy blows too');

// Damage: a heavy blow hurts more, a guard keeps far less of it, a perfect parry halves the rest.
const regularCounter = counterLoss(eliteTurn3, { type: 'combat/act', action: 'attack' });
const heavyCounter = counterLoss(eliteHeavy, { type: 'combat/act', action: 'attack' });
assert(heavyCounter === Math.ceil(regularCounter * 1.5), `heavy blow adds 50% (${regularCounter} -> ${heavyCounter})`);
const heavyGuard = counterLoss(eliteHeavy, { type: 'combat/act', action: 'guard' });
assert(heavyGuard === Math.max(1, heavyCounter - (heavyCounter - Math.floor(heavyCounter * 0.25))),
  `guard keeps a quarter of the heavy blow (${heavyGuard})`);
const parried = resolve(eliteHeavy, { type: 'combat/act', action: 'guard', timing: 'perfect' });
const parriedCounter = parried.frames.find(frame => frame.stage === 'counter');
assert(parriedCounter?.guarded && parriedCounter.perfectParry === true, 'counter frame records the perfect parry');
const parryLoss = parried.frames[0].playerHp - parriedCounter.playerHp;
assert(parryLoss === Math.max(1, Math.ceil(heavyGuard / 2)), `perfect parry halves the guarded heavy blow (${parryLoss})`);
const plainGuard = resolve(eliteHeavy, { type: 'combat/act', action: 'guard' });
assert(plainGuard.frames.every(frame => frame.perfectParry === undefined), 'untimed guard reports no parry');
assert(plainGuard.after.combat?.weaponFocus === 2, 'guarding the telegraphed heavy blow gains 2 focus');
assert(parried.after.combat?.weaponFocus === 3, 'perfect parry adds 1 more focus');
assert(parried.after.combat?.log.some(line => line.includes('完美格挡')), 'perfect parry is logged');

// Timing is ignored everywhere a perfect parry is not possible.
const same = (state: GameState, command: GameCommand, label: string): void => {
  const timed = reduceGameCommand(state, { ...command, timing: 'perfect' } as GameCommand);
  const untimed = reduceGameCommand(state, command);
  assert(timed.status === 'committed' && untimed.status === 'committed', `${label}: both commit`);
  assert(JSON.stringify(timed.state) === JSON.stringify(untimed.state), `${label}: timing changes nothing`);
};
same(ordinary, { type: 'combat/act', action: 'guard' }, 'ordinary guard');
same(eliteTurn3, { type: 'combat/act', action: 'guard' }, 'non-heavy elite guard');
same(eliteHeavy, { type: 'combat/act', action: 'attack' }, 'attacking into a heavy blow');

// Command validation accepts only the known timing grade.
assert(validateGameCommand({ type: 'combat/act', action: 'guard', timing: 'perfect' }).ok, 'perfect timing validates');
assert(!validateGameCommand({ type: 'combat/act', action: 'guard', timing: 'great' }).ok, 'unknown timing is rejected');
const rejected = reduceGameCommand(eliteHeavy, { type: 'combat/act', action: 'guard', timing: 'great' } as unknown as GameCommand);
assert(rejected.status === 'rejected' && rejected.state === eliteHeavy, 'invalid timing leaves state untouched');
