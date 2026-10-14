import { reduceGameCommand, type GameCommand } from '@infinite-flow/application';
import {
  createInitialState,
  getCurrentBloodlineSurgeStatus,
  getCurrentCompanionAssistStatus,
  getEquipmentSoulSkillActionStatus,
  getWeaponSkillStatus,
  type GameState
} from '@infinite-flow/core';
import { createDungeonLawState } from '@infinite-flow/core/dungeon-laws';
import { buildGameViewModel, type ViewActionModel } from '../src/index.js';

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function commit(state: GameState, command: GameCommand): GameState {
  const result = reduceGameCommand(state, command);
  assert(result.status === 'committed', `${command.type} must commit`);
  return result.state;
}

function requireAction(state: GameState, id: string): ViewActionModel {
  const action = buildGameViewModel(state, {}).sections[2].actions.find(candidate => candidate.actionId === id);
  assert(action, `${id} must be visible without opening advanced tactics`);
  return action;
}

function commandFrom(action: ViewActionModel): GameCommand {
  assert(action.enabled && action.event?.kind === 'command', `${action.actionId} must emit a command`);
  return action.event.command;
}

function enterCombat(withMethods: boolean): GameState {
  let state = createInitialState();
  state.rewardPoints = 100_000;
  state.inventory.healing_pill = 2;
  if (withMethods) {
    state = commit(state, { type: 'hub/learn-method', methodId: 'mist_breathing' });
    state = commit(state, { type: 'hub/learn-method', methodId: 'iron_body' });
  }
  const entry = requireAction(state, 'hub.entry.confirm');
  assert(entry.event?.kind === 'local' && entry.event.action.type === 'entry/request-enter', 'entry must use the host entry flow');
  state = commit(state, {
    type: 'run/enter',
    ...entry.event.action.draft,
    seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_5678 }
  });
  state = commit(state, commandFrom(requireAction(state, 'node.select:fog_lesser_demon')));
  assert(state.phase === 'combat' && state.combat && state.run, 'fixture must reach combat');
  return state;
}

function verifyMethodChoices(): void {
  const state = enterCombat(true);
  const actions = buildGameViewModel(state, {}).sections[2].actions;
  const techniques = actions.filter(action => action.actionId.startsWith('combat.method:'));
  assert(techniques.length === 2, 'both learned entry techniques are directly selectable');
  assert(techniques.every(action => action.placement === 'advanced'), 'techniques retain the established action placement');
  assert(!actions.some(action => action.actionId === 'combat.advanced.toggle'), 'combat no longer offers an advanced tactics toggle');
  assert(commandFrom(requireAction(state, 'combat.retreat-run')).type === 'run/retreat', 'run retreat is available to the menu without a tactics gate');
  const iron = requireAction(state, 'combat.method:iron_body');
  const mist = requireAction(state, 'combat.method:mist_breathing');
  assert(iron.readout?.includes('进入守势'), 'iron body shows its actual guarding effect');
  assert(mist.readout?.includes('1 层蓄息'), 'mist breathing shows the entry rank effect');
  assert(iron.readout?.includes('每场一次，不耗回合，不触发反击'), 'technique timing and use limit are explicit');
  const command = commandFrom(iron);
  assert(command.type === 'combat/use-method-technique' && command.methodId === 'iron_body', 'selected method is included in the dispatched command');
  const selected = commit(state, command);
  assert(selected.combat?.guarding, 'selecting iron body activates guarding');
  const selectedDetail = buildGameViewModel(selected, {}).sections[1].detail;
  assert(selectedDetail.kind === 'combat' && selectedDetail.guarding, 'the actual guard state is projected for the combat host');
  assert(selected.combat?.methodTechniqueUsedIds?.join(',') === 'iron_body', 'only the chosen method is spent');
  assert(selected.combat.turn === state.combat!.turn, 'a technique does not advance the combat turn');
  assert(selected.combat.monsterHp === state.combat!.monsterHp, 'support technique does not invent an attack');
  assert(selected.player.hp === state.player.hp, 'technique does not trigger an enemy counterattack');
  const used = requireAction(selected, 'combat.method:iron_body');
  assert(!used.enabled && !used.event && used.disabledReason?.includes('已经使用'), 'used technique stays visible and disabled');
  assert(requireAction(selected, 'combat.method:mist_breathing').enabled, 'the other technique remains independently selectable');
  const afterMist = commit(selected, commandFrom(requireAction(selected, 'combat.method:mist_breathing')));
  assert(afterMist.combat?.effects?.breathStacks === 1, 'the second chosen technique applies its own effect');
  assert(afterMist.combat.turn === selected.combat.turn, 'each technique preserves the current turn');

  const learnedAfterEntry: GameState = { ...state, learnedMethods: [...state.learnedMethods, 'cloud_step'] };
  assert(!buildGameViewModel(learnedAfterEntry, {}).sections[2].actions.some(action => action.actionId === 'combat.method:cloud_step'), 'only entry snapshot methods are exposed');
  const expanded = buildGameViewModel(state, { advancedCombatExpanded: true }).sections[2].actions;
  assert(expanded.map(action => action.actionId).join(',') === actions.map(action => action.actionId).join(','), 'legacy expanded state does not affect combat actions');

  const sealed: GameState = {
    ...state,
    player: { ...state.player, hp: state.player.maxHp - 20 },
    run: {
      ...state.run!,
      dungeonId: 'dream_archive',
      lawState: {
        ...createDungeonLawState('dream_archive'),
        law: { kind: 'dream_archive', sealedFeatures: ['method', 'consumable'] }
      }
    }
  };
  for (const id of ['combat.method:iron_body', 'combat.action:art', 'combat.action:use_healing_pill']) {
    const action = requireAction(sealed, id);
    assert(!action.enabled && !action.event && action.disabledReason?.includes('封存'), `${id} preserves field sealing restrictions`);
  }
}

function verifyConfiguredAbilitiesAndFocus(): void {
  const base = enterCombat(false);
  const baseActions = buildGameViewModel(base, {}).sections[2].actions;
  assert(!baseActions.some(action => action.actionId === 'combat.companion-assist'
    || action.actionId === 'combat.bloodline-surge'
    || action.actionId.startsWith('soul-skill:')), 'unconfigured abilities remain absent');

  const configured: GameState = {
    ...base,
    run: {
      ...base.run!,
      companionSnapshot: { rulesVersion: 1, companionId: 'qin_che', rank: 1 },
      bloodlineSnapshot: { rulesVersion: 1, bloodlineId: 'titan_marrow', aspect: 'force', rank: 1 },
      soulSkillState: {
        rulesVersion: 1,
        frozenSkillIds: ['spirit_grounding'],
        readySkillIds: ['spirit_grounding'],
        chargesRemaining: 1,
        usedRechargeIds: []
      }
    },
    combat: { ...base.combat!, weaponFocus: 3, guarding: true, effects: { rustPoisonStacks: 1 } }
  };
  const model = buildGameViewModel(configured, {});
  const detail = model.sections[1].detail;
  assert(detail.kind === 'combat', 'configured fixture projects combat detail');
  const weapon = getWeaponSkillStatus(configured);
  assert(detail.focus.current === weapon.currentFocus && detail.focus.required === weapon.requiredFocus, 'focus values come from the current core weapon status');
  assert(detail.guarding === configured.combat!.guarding, 'guard indicator follows combat state');
  assert(requireAction(configured, 'combat.action:attack').enabled, 'basic attack remains a separate available command');
  assert(requireAction(configured, 'combat.action:weapon_skill').enabled === weapon.available, 'weapon skill availability still follows the core');
  assert(requireAction(configured, 'combat.companion-assist').enabled === getCurrentCompanionAssistStatus(configured).available, 'configured companion is visible with core availability');
  assert(requireAction(configured, 'combat.bloodline-surge').enabled === getCurrentBloodlineSurgeStatus(configured).available, 'configured bloodline is visible with core availability');
  assert(requireAction(configured, 'soul-skill:spirit_grounding:use').enabled === getEquipmentSoulSkillActionStatus(configured, 'spirit_grounding').available, 'configured soul skill is visible with core availability');
  assert(!model.sections[2].actions.some(action => action.actionId.startsWith('soul-skill:gauntlet_breakbeat')), 'other unconfigured soul skills remain hidden');

  const assisted = commit(configured, commandFrom(requireAction(configured, 'combat.companion-assist')));
  const surged = commit(assisted, commandFrom(requireAction(assisted, 'combat.bloodline-surge')));
  const cleansed = commit(surged, commandFrom(requireAction(surged, 'soul-skill:spirit_grounding:use')));
  for (const id of ['combat.companion-assist', 'combat.bloodline-surge', 'soul-skill:spirit_grounding']) {
    const action = requireAction(cleansed, id);
    assert(!action.enabled && !action.event && action.disabledReason, `${id} stays visible after use without an executable command`);
  }
  assert(cleansed.combat?.turn === configured.combat!.turn, 'revealed support actions preserve their original no-turn semantics');

  const lowFocus: GameState = { ...configured, combat: { ...configured.combat!, weaponFocus: 1, guarding: false } };
  const lowDetail = buildGameViewModel(lowFocus, {}).sections[1].detail;
  assert(lowDetail.kind === 'combat' && lowDetail.focus.current === 1 && !lowDetail.guarding, 'focus and guard readouts change with domain state');
  const lowWeapon = requireAction(lowFocus, 'combat.action:weapon_skill');
  assert(!lowWeapon.enabled && !lowWeapon.event, 'low focus does not become an executable weapon skill');
}

function verifyMedicineAndBasicArt(): void {
  const full = enterCombat(false);
  const fullPill = requireAction(full, 'combat.action:use_healing_pill');
  assert(!fullPill.enabled && !fullPill.event && fullPill.disabledReason?.includes('生命已满'), 'full health disables medicine without an executable command');
  assert(fullPill.readout?.includes('库存 2') && fullPill.readout.includes('基础回复 36') && fullPill.readout.includes('受场域影响'), 'medicine shows stock and qualified base healing');
  assert(fullPill.readout?.includes('推进 1 回合') && fullPill.readout.includes('反击'), 'medicine describes its turn cost and counterattack');
  const injured: GameState = { ...full, player: { ...full.player, hp: full.player.maxHp - 50 } };
  const pill = requireAction(injured, 'combat.action:use_healing_pill');
  assert(pill.enabled, 'inventory medicine is usable when hurt without occupying a carry slot');
  assert(injured.run?.tacticalLoadout?.itemIds.every(itemId => itemId !== 'healing_pill'), 'medicine fixture does not carry healing pills');
  const recovered = commit(injured, commandFrom(pill));
  assert(recovered.inventory.healing_pill === injured.inventory.healing_pill - 1, 'using medicine consumes one inventory item');
  assert(recovered.combat?.turn === injured.combat!.turn + 1, 'medicine advances exactly one turn');
  assert(recovered.player.hp > injured.player.hp && recovered.player.hp < injured.player.hp + 36, 'medicine heals before the enemy counterattack');
  const empty: GameState = { ...injured, inventory: { ...injured.inventory, healing_pill: 0 } };
  const unavailable = requireAction(empty, 'combat.action:use_healing_pill');
  assert(!unavailable.enabled && !unavailable.event && unavailable.disabledReason?.includes('库存不足'), 'no stock remains visible with an unavailable reason');

  const art = requireAction(full, 'combat.action:art');
  assert(art.enabled && art.readout?.includes('术法伤害') && art.readout.includes('推进 1 回合') && art.readout.includes('反击'), 'basic art is available without learned methods and explains its combat timing');
  const artCommand = commandFrom(art);
  assert(artCommand.type === 'combat/act' && artCommand.action === 'art', 'basic art preserves the original combat action');
  const result = reduceGameCommand(full, artCommand);
  assert(result.status === 'committed', 'basic art commits');
  const turnEvent = result.events.find(event => event.type === 'combat.turn-resolved');
  assert(turnEvent?.type === 'combat.turn-resolved' && turnEvent.turnAfter - turnEvent.turnBefore === 1, 'basic art advances one combat turn');
}

verifyMethodChoices();
verifyMedicineAndBasicArt();
verifyConfiguredAbilitiesAndFocus();
