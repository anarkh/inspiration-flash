// The combat detail exposes the real-time fight read-only: the core's encounter config, a roster for sprites and
// name plates, spell / skill / pill availability, the turn-based escape, the capture offer and the commit template.
import { reduceGameCommand, type GameCommand } from '@infinite-flow/application';
import {
  buildActionEncounter,
  createChapterTrialState,
  createInitialState,
  getWeaponSkillStatus,
  type GameState
} from '@infinite-flow/core';
import { buildActionCombatResolveEvent, buildGameViewModel, type CombatDetailViewModel } from '../src/index.js';

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function commit(state: GameState, command: GameCommand): GameState {
  const result = reduceGameCommand(state, command);
  assert(result.status === 'committed', `${command.type} must commit`);
  return result.state;
}

function combatDetail(state: GameState): CombatDetailViewModel {
  const detail = buildGameViewModel(state, {}).sections[1].detail;
  assert(detail?.kind === 'combat', 'a fight shows the combat detail');
  return detail;
}

const trial = createChapterTrialState(1);
const netHub: GameState = { ...trial, inventory: { ...trial.inventory, capture_net: 1 }, preparedItemIds: ['capture_net'] };
const entered = commit(netHub, { type: 'run/enter', dungeonId: 'demon_tower_1', protocolId: 'standard', seeds: { rulesVersion: 1, hiddenTaskSeed: 99 } });
const fight = commit(entered, { type: 'run/select-node', nodeId: 'fog_lesser_demon' });
const snapshot = JSON.stringify(fight);
const detail = combatDetail(fight);
const action = detail.actionCombat;
assert(action, 'the combat detail carries the action fight');
assert(JSON.stringify(fight) === snapshot, 'building the view model never mutates the state');
assert(JSON.stringify(action.config) === JSON.stringify(buildActionEncounter(fight)!.config), 'the config is exactly the core encounter config');
assert(action.dungeonId === 'demon_tower_1' && action.rank === 'normal' && action.primaryArchetype === 'primary', 'the chapter and the rank');
assert(action.roster.length === 3 && action.roster.every(member => member.monsterId === 'fog_lesser_demon' && member.name === '雾中妖鬼'
  && member.visualAssetKey !== undefined), 'the roster names every enemy with its sprite');
assert(action.spell.available && action.spell.focusCost === 1 && action.spell.damage > 0, 'the spell is open');
assert(action.skill.name === getWeaponSkillStatus(fight).definition?.name && action.skill.weaponName === getWeaponSkillStatus(fight).weaponName,
  'the skill is named after the equipped weapon');
assert(action.pill.count === fight.inventory.healing_pill && action.pill.available === fight.inventory.healing_pill > 0 && action.pill.heal > 0, 'the pills');
assert(action.escape.actionId === 'combat.action:escape' && action.escape.event?.kind === 'command'
  && action.escape.event.command.type === 'combat/act', 'escape stays the turn-based action');
assert(action.capture?.petId === 'mist_kitten' && action.capture.itemId === 'capture_net' && action.capture.thresholdHp > 0, 'the capture offer');
assert(action.commit.commandType === 'combat/resolve-action' && action.commit.maxTicks === action.maxTicks, 'the commit template');
const commitEvent = buildActionCombatResolveEvent({ version: 1, ticks: 1, changes: [0, 34816] }, 'mist_kitten');
assert(commitEvent.kind === 'command' && commitEvent.command.type === 'combat/resolve-action' && commitEvent.command.capture === 'mist_kitten',
  'the commit event carries the log and the capture');
assert(detail.enemy.id === 'fog_lesser_demon' && detail.turn === 1 && detail.focus.required === 3, 'the turn-based fields stay');

const sealedNet = commit(commit({ ...createInitialState() }, {
  type: 'run/enter', dungeonId: 'demon_tower_1', protocolId: 'standard', seeds: { rulesVersion: 1, hiddenTaskSeed: 99 }
}), { type: 'run/select-node', nodeId: 'fog_lesser_demon' });
const bare = combatDetail(sealedNet).actionCombat;
assert(bare && bare.capture === undefined && !bare.pill.available && bare.pill.disabledReason, 'no net and no pills: no capture, the pill is disabled');
