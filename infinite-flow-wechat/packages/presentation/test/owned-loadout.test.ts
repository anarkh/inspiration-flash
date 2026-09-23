import { reduceGameCommand, type GameCommand } from '@infinite-flow/application';
import { DUNGEON_ORDER, createInitialState, type GameState, type ItemId } from '@infinite-flow/core';
import {
  buildHubOwnedLoadoutViewModel,
  type HubShopRowViewModel, type ViewActionModel
} from '../src/index.js';

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function commit(state: GameState, command: GameCommand): GameState {
  const result = reduceGameCommand(state, command);
  assert(result.status === 'committed', `${command.type} must commit`);
  return result.state;
}

function ownedRow(state: GameState, id: string): HubShopRowViewModel {
  const row = buildHubOwnedLoadoutViewModel(state)?.rows.find(candidate => candidate.id === id);
  assert(row, `owned row ${id} must exist`);
  return row;
}

function configure(state: GameState, id: string, commandType: GameCommand['type']): GameState {
  const action = ownedRow(state, id).actions.find(candidate => candidate.event?.kind === 'command' && candidate.event.command.type === commandType);
  assert(action?.enabled && action.event?.kind === 'command', `${id} must expose the configuration command ${commandType}`);
  return commit(state, action.event.command);
}

function verifyOwnedLoadout(): void {
  let state = createInitialState();
  const initial = buildHubOwnedLoadoutViewModel(state)!;
  assert(initial.rows.length === state.ownedEquipment.length, 'new player must see only starting owned equipment');
  assert(!initial.rows.some(row => row.id === 'equipment/armor_piercing_sword'), 'unowned equipment must not leak into preparation');
  for (const phase of ['explore', 'combat', 'result'] as const) {
    assert(buildHubOwnedLoadoutViewModel({ ...state, phase }) === undefined, `${phase} must not offer hub configuration`);
  }
  state.rewardPoints = 100_000;
  state.lingyun = 100;
  state.completedDungeonIds = [...DUNGEON_ORDER];
  for (const id of Object.keys(state.inventory) as ItemId[]) state.inventory[id] = 50;

  state = commit(state, { type: 'hub/buy-equipment', equipmentId: 'armor_piercing_sword' });
  state = configure(state, 'equipment/armor_piercing_sword', 'hub/equip-equipment');
  assert(state.equipped.weapon === 'armor_piercing_sword', 'newly purchased equipment must be wearable from preparation');

  state = commit(state, { type: 'hub/buy-pet', petId: 'contract_sprite' });
  state = commit(state, { type: 'hub/buy-pet', petId: 'starling_drone' });
  const petTarget = state.activePet === 'starling_drone' ? 'contract_sprite' : 'starling_drone';
  state = configure(state, `pets/${petTarget}`, 'hub/activate-pet');
  assert(state.activePet === petTarget, 'owned pet can be selected after purchase');

  state = commit(state, { type: 'hub/learn-method', methodId: 'mist_breathing' });
  state = commit(state, { type: 'hub/learn-method', methodId: 'iron_body' });
  const methodTarget = state.activeMethod === 'iron_body' ? 'mist_breathing' : 'iron_body';
  state = configure(state, `methods/${methodTarget}`, 'hub/activate-method');
  assert(state.activeMethod === methodTarget, 'learned method can become the preferred method');

  state = commit(state, { type: 'hub/unlock-bloodline', bloodlineId: 'titan_marrow' });
  state = commit(state, { type: 'hub/unlock-bloodline', bloodlineId: 'void_symbiote' });
  const bloodlineTarget = state.activeBloodline === 'void_symbiote' ? 'titan_marrow' : 'void_symbiote';
  state = configure(state, `bloodlines/${bloodlineTarget}`, 'hub/activate-bloodline');
  assert(state.activeBloodline === bloodlineTarget, 'awakened bloodline can be activated');

  state = commit(state, { type: 'hub/recruit-companion', companionId: 'qin_che' });
  state = commit(state, { type: 'hub/recruit-companion', companionId: 'zhou_yingxue' });
  const companionTarget = state.activeCompanion === 'zhou_yingxue' ? 'qin_che' : 'zhou_yingxue';
  state = configure(state, `companions/${companionTarget}`, 'hub/activate-companion');
  assert(state.activeCompanion === companionTarget, 'recruited companion can join the active slot');

  state = commit(state, { type: 'hub/buy-equipment', equipmentId: 'bone_spear' });
  state.equipmentMemories = {
    ...state.equipmentMemories,
    bone_spear: {
      unlockedIds: ['equipment_memory_demon_tower_1', 'equipment_memory_metro_abyss'],
      activeId: 'equipment_memory_demon_tower_1'
    }
  };
  const memoryRow = ownedRow(state, 'equipment/bone_spear');
  const memories = memoryRow.actions.filter(candidate => candidate.actionId.startsWith('hub.equipment.memory.activate:'));
  assert(memories.length === 2, 'each unlocked memory must have its own direct choice');
  assert(!memoryRow.actions.some(candidate => candidate.actionId.includes('.cycle')), 'preparation must not cycle through memories');
  const activeMemory = memories.find(candidate => candidate.actionId.includes('equipment_memory_demon_tower_1'))!;
  assert(!activeMemory.enabled && activeMemory.disabledReason?.includes('已激活') && !activeMemory.event, 'active memory stays visible with a clear disabled state');
  const nextMemory = memories.find(candidate => candidate.actionId.includes('equipment_memory_metro_abyss'))!;
  assert(nextMemory.enabled && nextMemory.event?.kind === 'command' && nextMemory.event.command.type === 'hub/activate-equipment-memory', 'unselected unlocked memory must emit a direct command');
  assert(nextMemory.event.command.memoryId === 'equipment_memory_metro_abyss', 'direct choice must target the named memory');
  state = commit(state, nextMemory.event.command);
  assert(state.equipmentMemories?.bone_spear?.activeId === 'equipment_memory_metro_abyss', 'memory configuration must persist');
  assert(!ownedRow(state, 'equipment/bone_spear').actions.find(candidate => candidate.actionId === nextMemory.actionId)?.enabled, 'selected memory must refresh to its disabled active state');

  const before = JSON.stringify(state);
  const view = buildHubOwnedLoadoutViewModel(state)!;
  const secondView = buildHubOwnedLoadoutViewModel(state)!;
  assert(JSON.stringify(state) === before, 'owned projection must not mutate state');
  assert(JSON.stringify(view) === JSON.stringify(secondView), 'configuration action identities must stay stable across projections');
  assert(Object.isFrozen(view) && Object.isFrozen(view.rows), 'owned projection is a read-only snapshot');
  assert(!view.rows.some(row => row.id.startsWith('supplies/') || row.id.startsWith('tasks/')), 'preparation must omit store supplies and tasks');
  assert(!view.rows.some(row => row.id === 'pets/mist_kitten' || row.id === 'methods/cloud_step' || row.id === 'bloodlines/phoenix_ember' || row.id === 'companions/lu_guanlan'), 'unowned progression entries must stay absent');
  const actions = view.rows.flatMap(row => row.actions);
  assert(new Set(view.rows.map(row => row.id)).size === view.rows.length, 'owned row IDs must be globally unique');
  assert(new Set(actions.map(action => action.actionId)).size === actions.length, 'owned action IDs must be globally unique');
  const commandTypes = new Set<GameCommand['type']>([
    'hub/equip-equipment', 'hub/activate-pet', 'hub/activate-method',
    'hub/activate-bloodline', 'hub/activate-companion', 'hub/activate-equipment-memory'
  ]);
  for (const action of actions as readonly ViewActionModel[]) {
    assert(action.readout, 'configuration action needs an effect description');
    if (action.enabled) {
      assert(action.event?.kind === 'command' && commandTypes.has(action.event.command.type), 'owned rows expose configuration only, never commerce or upgrades');
    } else {
      assert(action.disabledReason && !action.event, 'unavailable configuration must explain its condition');
    }
  }
}

verifyOwnedLoadout();
