import {
  createInitialState,
  getWeaponSkillStatus,
  type CombatPresentationFrame,
  type GameState
} from '@infinite-flow/core';
import type { CombatFocus } from '@infinite-flow/core/combat-focus';
import { reduceGameCommand, type GameCommand } from '../src/index.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function apply(state: GameState, command: GameCommand): GameState {
  const result = reduceGameCommand(state, command);
  assert(result.status === 'committed', `${command.type} fixture must commit`);
  return result.state;
}

function impactDamage(state: GameState, command: GameCommand): { after: GameState; damage: number } {
  const result = reduceGameCommand(state, command);
  assert(result.status === 'committed', `${JSON.stringify(command)} must commit`);
  const event = result.events.find(candidate => candidate.type === 'combat.presentation-resolved');
  assert(event?.type === 'combat.presentation-resolved', `${JSON.stringify(command)} emits frames`);
  const impact = event.frames.find((frame: CombatPresentationFrame) => frame.stage === 'impact');
  assert(impact, `${JSON.stringify(command)} has an impact frame`);
  return { after: result.state, damage: state.combat!.monsterHp - impact.enemyHp };
}

const entered = apply(createInitialState(), {
  type: 'run/enter', dungeonId: 'demon_tower_1', protocolId: 'standard',
  seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_abcd }
});
const opening = apply(entered, { type: 'run/select-node', nodeId: 'fog_lesser_demon' });
assert(opening.combat && opening.equipped.weapon === 'training_blade', 'fixture fights with the starter blade');

function withFocus(weaponFocus: CombatFocus): GameState {
  return { ...opening, combat: { ...opening.combat!, monsterHp: 1000, weaponFocus, log: [] } };
}

// The starter blade has no signature skill; full focus still turns into a charged strike.
const charging = getWeaponSkillStatus(withFocus(2));
assert(!charging.available && charging.definition?.id === 'charged_strike'
  && charging.unavailableReason?.includes('战意未满'), 'charged strike waits for full focus');
const ready = getWeaponSkillStatus(withFocus(3));
assert(ready.available && ready.definition?.name === '蓄势斩', 'full focus readies the charged strike');

const basic = impactDamage(withFocus(0), { type: 'combat/act', action: 'attack' });
const charged = impactDamage(withFocus(3), { type: 'combat/act', action: 'weapon_skill' });
assert(charged.damage === Math.ceil(basic.damage * 1.8), `charged strike hits for 1.8x a basic attack (${basic.damage} -> ${charged.damage})`);
assert(charged.after.combat?.weaponFocus === 0, 'charged strike spends all focus');
assert(charged.after.combat?.log.some(line => line.startsWith('你发动蓄势斩')), 'combat log names the charged strike');

// Signature skills keep priority over the fallback.
const sword = getWeaponSkillStatus({ ...withFocus(3), equipped: { ...opening.equipped, weapon: 'armor_piercing_sword' } });
assert(sword.available && sword.definition?.id === 'armor_sunder', 'signature weapons keep their own skill');
