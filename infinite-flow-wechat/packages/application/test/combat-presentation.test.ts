import {
  createInitialState,
  getCombatEncounterProfile,
  getCurrentDungeonLaw,
  getDerivedStats,
  getHealingPillBaseHealing,
  performCombatAction,
  POST_COMBAT_RECOVERY_PERCENT,
  type CombatAction,
  type CombatPresentationFrame,
  type CombatReplayCombatState,
  type GameState
} from '@infinite-flow/core';
import { reduceGameCommand, type GameCommand } from '../src/index.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** Victory recovers a fixed share of the settled maximum on top of the HP the fight left. */
function recoveredHp(hp: number, state: GameState): number {
  const maxHp = getDerivedStats(state).maxHp;
  return Math.min(maxHp, hp + Math.floor((maxHp * POST_COMBAT_RECOVERY_PERCENT) / 100));
}

function apply(state: GameState, command: GameCommand): GameState {
  const result = reduceGameCommand(state, command);
  assert(result.status === 'committed', `${command.type} fixture must commit`);
  return result.state;
}

const entered = apply(createInitialState(), {
  type: 'run/enter', dungeonId: 'demon_tower_1', protocolId: 'standard',
  seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_abcd }
});
const opening = apply(entered, { type: 'run/select-node', nodeId: 'fog_lesser_demon' });
assert(opening.combat && opening.run, 'fixture has an active encounter');
const durable: GameState = {
  ...opening,
  combat: { ...opening.combat, monsterHp: 1000 },
  inventory: { ...opening.inventory, healing_pill: 2, armor_patch: 0 }
};

function observe(state: GameState, action: CombatAction): {
  frames: CombatPresentationFrame[];
  after: GameState;
} {
  const before = JSON.stringify(state);
  const plain = performCombatAction(state, action);
  const frames: CombatPresentationFrame[] = [];
  const after = performCombatAction(state, action, frame => {
    assert(Object.isFrozen(frame), `${action}: snapshot must be frozen`);
    assert(!Reflect.set(frame, 'playerHp', -999), `${action}: snapshot rejects mutation`);
    assert(Object.values(frame).every(value => typeof value !== 'object'), `${action}: no state references escape`);
    frames.push(frame);
  });
  assert(JSON.stringify(after) === JSON.stringify(plain), `${action}: observation cannot change domain result`);
  assert(JSON.stringify(state) === before, `${action}: observation cannot mutate input`);
  const reduced = reduceGameCommand(state, { type: 'combat/act', action });
  if (reduced.status === 'committed') {
    assert(JSON.stringify(reduced.state) === JSON.stringify(plain), `${action}: reducer preserves core state`);
    const events = reduced.events.filter(event => event.type === 'combat.presentation-resolved');
    assert(events.length === 1, `${action}: one committed command emits one animation event`);
    const event = events[0];
    assert(event.type === 'combat.presentation-resolved', 'typed event narrowing');
    assert(Object.isFrozen(event) && Object.isFrozen(event.frames), `${action}: event and frames are immutable`);
    assert(JSON.stringify(event.frames) === JSON.stringify(frames), `${action}: reducer preserves authoritative frames`);
  } else {
    assert(reduced.events.length === 0, `${action}: rejected commands emit no frames`);
  }
  return { frames, after };
}

const attacked = observe(durable, 'attack');
assert(attacked.frames.length === 2, 'attack has impact then counter');
assert(attacked.frames[0].stage === 'impact' && attacked.frames[1].stage === 'counter', 'stages are ordered');
assert(attacked.frames[0].playerHp === durable.player.hp, 'attack impact precedes retaliation');
assert(attacked.frames[0].enemyHp < 1000, 'attack impact records actual damage');
assert(attacked.frames[1].playerHp === attacked.after.player.hp, 'counter records final HP');
observe({ ...durable, combat: { ...durable.combat!, weaponFocus: 1 } }, 'art');

const lethal = observe({
  ...durable,
  player: { ...durable.player, hp: 13 },
  combat: { ...durable.combat!, monsterHp: 1 }
}, 'attack');
assert(lethal.frames.length === 1 && lethal.frames[0].enemyHp === 0, 'lethal hit captures zero before victory removes combat');
assert(lethal.after.phase === 'explore' && !lethal.after.combat, 'lethal action still settles victory');
assert(lethal.frames[0].playerHp === 13 && lethal.after.player.hp === recoveredHp(13, lethal.after),
  'victory recovers part of the settled HP without changing the actual impact frame');

const guarded = observe(durable, 'guard');
assert(guarded.frames[0].guarded && guarded.frames[1].guarded, 'counter retains the guard it consumed');
assert(!guarded.after.combat?.guarding, 'guard telemetry does not retain the consumed domain guard');
const ironState: GameState = {
  ...durable,
  learnedMethods: [...durable.learnedMethods, 'iron_body'],
  run: { ...durable.run!, methodSnapshots: [{ rulesVersion: 1, methodId: 'iron_body', rank: 1 }] },
  combat: { ...durable.combat!, monsterHp: 1 }
};
const reflected = observe(ironState, 'guard');
assert(reflected.frames[0].enemyHp === 1 && reflected.frames[1].enemyHp === 0,
  'guard reflection kill belongs to counter, before victory removes combat');

const capped = observe({ ...durable, player: { ...durable.player, hp: durable.player.maxHp - 2 } }, 'use_healing_pill');
assert(capped.frames[0].playerHp === durable.player.maxHp, 'medicine impact uses capped healing');
assert(capped.frames[1].playerHp < capped.frames[0].playerHp, 'medicine healing and enemy damage remain separate');
const polluted: GameState = {
  ...durable,
  player: { ...durable.player, hp: 10 },
  run: {
    ...durable.run!, dungeonId: 'rust_hospital',
    lawState: {
      rulesVersion: 1, dungeonId: 'rust_hospital', clearedNodeIds: [], resolvedEventIds: [],
      combatOpenings: {}, combatVictoryNodeIds: [], law: { kind: 'rust_hospital', pollution: 4 }
    }
  }
};
assert(getCurrentDungeonLaw(polluted)?.modifiers.healingPercent === -20, 'pollution fixture modifies healing');
const calm: GameState = { ...polluted, run: { ...polluted.run!, lawState: { ...polluted.run!.lawState!, law: { kind: 'rust_hospital', pollution: 0 } } } };
assert(getCombatEncounterProfile(polluted)!.monster.attack === Math.ceil(getCombatEncounterProfile(calm)!.monster.attack * 1.2),
  'high pollution really raises the enemy attack instead of an art power enemies never use');
const reducedHeal = observe(polluted, 'use_healing_pill');
assert(reducedHeal.frames[0].playerHp - polluted.player.hp === Math.ceil(getHealingPillBaseHealing(polluted) * 0.8),
  'medicine snapshot includes actual law-modified healing');
const pollutedVictory = observe({ ...polluted, combat: { ...polluted.combat!, monsterHp: 1 } }, 'attack');
assert(pollutedVictory.frames[0].playerHp === 10
  && pollutedVictory.after.player.hp === recoveredHp(10, pollutedVictory.after),
  'pollution still reduces medicine healing but cannot reduce post-combat recovery');

const staff: GameState = {
  ...durable,
  player: { ...durable.player, hp: 20 },
  equipped: { ...durable.equipped, weapon: 'ember_staff' },
  equipmentLevels: { ...durable.equipmentLevels, ember_staff: 1 },
  combat: { ...durable.combat!, weaponFocus: 3 }
};
const weapon = observe(staff, 'weapon_skill');
assert(weapon.frames[0].playerHp > staff.player.hp, 'weapon healing is captured before its counter');
assert(weapon.frames[1].playerHp < weapon.frames[0].playerHp, 'weapon healing is not reduced to net HP change');

const escaped = observe({
  ...durable, player: { ...durable.player, base: { ...durable.player.base, agility: 100, luck: 100 } }
}, 'escape');
assert(escaped.frames.length === 1 && escaped.after.phase === 'explore', 'successful escape has no invented counter');
assert(escaped.frames[0].playerHp === durable.player.hp - 8, 'escape impact includes the real scrape cost');
assert(escaped.after.player.hp === durable.player.hp - 8,
  'escape heals nothing: the real scrape cost carries out of the fight');
const escapeFallen = observe({
  ...durable,
  player: { ...durable.player, hp: 1, base: { ...durable.player.base, agility: 100, luck: 100 } }
}, 'escape');
assert(escapeFallen.frames.length === 1 && escapeFallen.frames[0].playerHp === 0
  && escapeFallen.after.phase === 'result'
  && escapeFallen.after.player.hp === getDerivedStats(escapeFallen.after).maxHp,
  'fatal escape scrape remains visible before its failure settlement restores HP');
const trapped: GameState = {
  ...durable, player: { ...durable.player, base: { ...durable.player.base, agility: 0, luck: 0 } },
  combat: { ...durable.combat!, monsterId: 'tower_butcher' }
};
const failedEscape = observe(trapped, 'escape');
assert(failedEscape.frames.length === 2, 'failed escape records its counter');
const fallen = observe({ ...trapped, player: { ...trapped.player, hp: 1 } }, 'attack');
assert(fallen.frames[1].playerHp === 0 && fallen.after.phase === 'result', 'fatal counter reports zero before failure settlement');
assert(fallen.after.player.hp === getDerivedStats(fallen.after).maxHp,
  'failure settlement restores HP without replacing the fatal counter frame');

const replay: CombatReplayCombatState = {
  rulesVersion: 1, enabled: true, cursor: 0, buffer: 0, remainingBufferHits: 0,
  firstBoostUsed: false, route: 'sequence', boss: false,
  entryGear: { frameEngraver: false, cueVisor: false, bufferPlate: false, thawMetronome: false },
  recordings: {
    take_alpha: { action: 'attack', observedValue: 50, replayValue: 50 },
    take_beta: { action: 'art', observedValue: 50, replayValue: 50 },
    take_gamma: { action: 'guard', observedValue: 5, replayValue: 5 }
  }
};
const replayKill = observe({
  ...durable, combat: { ...durable.combat!, monsterHp: 1, combatReplayState: replay }
}, 'attack');
assert(replayKill.frames.length === 1 && replayKill.frames[0].enemyHp === 0,
  'opening replay kill still reports one impact before the direct action is skipped');
const afterbeat = observe({
  ...durable, combat: { ...durable.combat!, combatReplayState: { ...replay, route: 'afterbeat' } }
}, 'attack');
assert(afterbeat.frames[1].enemyHp < afterbeat.frames[0].enemyHp,
  'counter snapshot includes delayed replay damage after monster retaliation');

const unavailable = observe(durable, 'weapon_skill');
assert(unavailable.frames.length === 0, 'unavailable skill does not emit speculative frames');
const fullPill = reduceGameCommand(durable, { type: 'combat/act', action: 'use_healing_pill' });
assert(fullPill.status === 'rejected' && fullPill.events.length === 0, 'full-health rejected medicine emits no animation event');
const wrongPhase = reduceGameCommand(createInitialState(), { type: 'combat/act', action: 'attack' });
assert(wrongPhase.status === 'rejected' && wrongPhase.events.length === 0, 'phase rejection emits no animation event');

const support = reduceGameCommand(ironState, { type: 'combat/use-method-technique', methodId: 'iron_body' });
assert(support.status === 'committed', 'support technique fixture commits');
const supportEvent = support.events.find(event => event.type === 'combat.presentation-resolved');
assert(supportEvent?.type === 'combat.presentation-resolved' && supportEvent.frames.length === 1,
  'free technique has a single authoritative impact and no counter');
assert(support.state.combat?.turn === ironState.combat?.turn, 'telemetry does not advance a support turn');

// Bloodlines are passive now: the old surge command explains itself and changes nothing.
assert(reduceGameCommand(durable, { type: 'combat/use-bloodline-surge' }).status === 'rejected', 'the surge command no longer acts');
const titan: GameState = {
  ...durable,
  run: { ...durable.run!, bloodlineSnapshot: { rulesVersion: 1, bloodlineId: 'titan_marrow', aspect: 'force', rank: 1 } }
};
const plainHit = observe(durable, 'attack');
const titanHit = observe(titan, 'attack');
// Rank 1 adds +6 attack (6 more physical damage) and its passive +5 on the hit.
assert(plainHit.frames[0].enemyHp - titanHit.frames[0].enemyHp === 11, 'a titan marrow hit carries its stat bonus plus 5 passive damage in the impact frame');

// Allies act after the player's impact and before the counterattack, each in its own frame:
// the companion strikes, the pet supports with a note and no damage.
const withParty: GameState = {
  ...durable,
  activePet: 'contract_sprite',
  ownedPets: ['contract_sprite'],
  petLevels: { contract_sprite: 1 },
  run: { ...durable.run!, companionSnapshot: { rulesVersion: 1, companionId: 'qin_che', rank: 1 } }
};
const partyTurn = observe(withParty, 'attack');
assert(partyTurn.frames.map(frame => frame.stage).join(',') === 'impact,ally,ally,counter', 'companion and pet each get a frame between impact and counter');
assert(partyTurn.frames[1].allyKind === 'companion' && (partyTurn.frames[1].allyDamage ?? 0) >= 1, 'the companion strikes first, for at least 1');
assert(partyTurn.frames[2].allyKind === 'pet' && partyTurn.frames[2].allyDamage === 0 && partyTurn.frames[2].allyNote === '助攻 +6%',
  'the pet deals no damage of its own and notes its assist');
assert(partyTurn.frames[2].enemyHp === partyTurn.frames[0].enemyHp - partyTurn.frames[1].allyDamage!,
  'ally frames carry the enemy health after each strike');
