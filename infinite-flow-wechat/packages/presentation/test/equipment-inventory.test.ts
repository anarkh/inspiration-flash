import { reduceGameCommand, type GameCommand } from '@infinite-flow/application';
import {
  EQUIPMENT, createInitialState, getGameAsset,
  type EquipmentId, type GameState
} from '@infinite-flow/core';
import type { EquipmentRoll } from '@infinite-flow/core/equipment-rolls';
import {
  buildGameViewModel,
  type EquipmentItemViewModel, type GameViewModel,
  type OwnedEquipmentEntryViewModel, type ViewActionModel
} from '../src/index.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function committed(state: GameState, command: GameCommand): GameState {
  const before = JSON.stringify(state);
  const result = reduceGameCommand(state, command);
  assert(result.status === 'committed', `${command.type} must commit`);
  assert(JSON.stringify(state) === before, `${command.type} must preserve its input state`);
  return result.state;
}

function commandFrom(action: ViewActionModel): GameCommand {
  assert(action.enabled && action.event?.kind === 'command', `${action.actionId} must emit an executable command`);
  return action.event.command;
}

function inventory(view: GameViewModel): readonly OwnedEquipmentEntryViewModel[] {
  const loadout = view.sections[1].loadout;
  assert(loadout, 'the character snapshot must include its equipment inventory');
  return loadout.ownedEquipment;
}

function row(view: GameViewModel, equipmentId: EquipmentId): OwnedEquipmentEntryViewModel {
  const found = inventory(view).find(candidate => candidate.equipmentId === equipmentId);
  assert(found, `owned equipment ${equipmentId} must be visible`);
  return found;
}

function assertDeeplyFrozen(value: unknown, label: string): void {
  if (typeof value !== 'object' || value === null) return;
  assert(Object.isFrozen(value), `${label} must be frozen`);
  for (const [key, child] of Object.entries(value)) assertDeeplyFrozen(child, `${label}.${key}`);
}

function assertMetadata(item: EquipmentItemViewModel, equipmentId: EquipmentId): void {
  const source = EQUIPMENT[equipmentId];
  assert(item.equipmentId === equipmentId && item.name === source.name, `${equipmentId} must retain its actual identity and name`);
  assert(item.slot === source.slot && item.maxLevel === source.maxLevel, `${equipmentId} must retain its actual slot and level limit`);
  assert(item.description === source.description && item.rarity, `${equipmentId} must expose its real description and display quality`);
  assert(item.visualAssetKey && item.visualAssetKey === getGameAsset('equipment', equipmentId)?.key, `${equipmentId} must use its registered equipment asset`);
  assert(item.baseStatsLabel === '基础属性（Lv.1）', `${equipmentId} must label its base material at level one`);
  assert(item.baseStatsReadout && item.growthStatsReadout && item.affixReadout, `${equipmentId} must expose base, growth and fixed-affix readouts`);
}

function richInventory(): GameState {
  const initial = createInitialState();
  return {
    ...initial,
    rewardPoints: 10_000,
    ownedEquipment: [...initial.ownedEquipment, 'bone_spear', 'mist_hood', 'spirit_robe'],
    equipmentLevels: { ...initial.equipmentLevels, bone_spear: 1, mist_hood: 2, spirit_robe: 1 }
  };
}

function exploring(hub: GameState = createInitialState()): GameState {
  return committed(hub, {
    type: 'run/enter', dungeonId: 'demon_tower_1', protocolId: 'standard',
    seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_abcd }
  });
}

function hoodRoll(trapCheck: number, sourceTier: number, seed: number): EquipmentRoll {
  return {
    rulesVersion: 1, sourceTier, seed, itemPower: 3_000 + trapCheck,
    quality: 'rare',
    affixes: [{ stat: 'trapCheck', value: trapCheck, minimum: 1, maximum: trapCheck, greater: false }]
  };
}

function verifyOwnedEquipmentInventory(): void {
  const initial = createInitialState();
  const initialView = buildGameViewModel(initial);
  const initialRows = inventory(initialView);
  assert(initialRows.length === 7 && initialRows.length === initial.ownedEquipment.length, 'new players must see all seven starting pieces');
  assert(initialRows.every(item => item.equipped && !item.equipAction.enabled && !item.equipAction.event), 'starting worn pieces must remain visible with inactive wear actions');
  assert(initialRows.every(item => item.equipAction.disabledReason?.includes('已经装备')), 'starting worn pieces must explain why wearing is inactive');
  assert(!initialRows.some(item => item.equipmentId === 'bone_spear'), 'unowned catalog entries must stay out of the inventory');

  const state = richInventory();
  const before = JSON.stringify(state);
  const view = buildGameViewModel(state);
  const rows = inventory(view);
  assert(rows.length === state.ownedEquipment.length, 'the inventory must include worn starting pieces and every additional owned piece');
  assert(new Set(rows.map(item => item.equipmentId)).size === rows.length, 'each owned item must appear once');
  assert(state.ownedEquipment.every(id => rows.some(item => item.equipmentId === id)), 'the inventory must cover the full owned set');
  for (const item of rows) {
    assertMetadata(item, item.equipmentId);
    assert(item.id === `equipment/${item.equipmentId}` && item.category === item.slotLabel, `${item.equipmentId} must remain a complete inventory row`);
    assert(item.equipped === (state.equipped[item.slot] === item.equipmentId), `${item.equipmentId} must report its actual wearing state`);
    assert(item.status.includes(item.equipped ? '已装备' : '背包中'), `${item.equipmentId} must distinguish wearing from ownership`);
    assert(item.details.some(detail => detail.label === item.baseStatsLabel && detail.value === item.baseStatsReadout), `${item.equipmentId} details must keep the level-one base label`);
    assert(item.details.some(detail => detail.label === `固定词缀（Lv.${item.level}）` && detail.value === item.affixReadout), `${item.equipmentId} details must label fixed affixes at the current level`);
    assert(item.actions.length === 1 && JSON.stringify(item.actions[0]) === JSON.stringify(item.equipAction), `${item.equipmentId} must expose only its wear action`);
    assert(item.equipAction.actionId === `inventory.equipment.equip:${item.equipmentId}`, `${item.equipmentId} must use a stable inventory action identity`);
    if (item.equipAction.enabled) {
      const command = commandFrom(item.equipAction);
      assert(command.type === 'hub/equip-equipment' && command.equipmentId === item.equipmentId, `${item.equipmentId} must target the matching wear command`);
    } else {
      assert(item.equipAction.disabledReason && !item.equipAction.event, `${item.equipmentId} inactive wearing must explain its condition without an event`);
    }
  }
  const hood = row(view, 'mist_hood');
  assert(hood.level === 2 && hood.slotLabel === '头部' && !hood.equipped, 'a level-two unworn hood must report its actual level, slot and state');
  assert(hood.baseStatsReadout === '心神 +1 · 速度 +1 · 陷阱感知 +3', 'level two must retain the level-one hood material rather than include growth');
  assert(hood.growthStatsReadout === '速度 +1 · 陷阱感知 +2', 'the hood growth must remain a separate per-level readout');
  assert(hood.affixReadout.includes('雾听预兆') && hood.affixReadout.includes('陷阱感知 +3'), 'level-two fixed hood affixes must include their actual trap-check contribution');
  assert(!hood.rollReadout, 'ordinary material must not invent a random roll');
  assert(JSON.stringify(state) === before, 'inventory projection and command preflight must not alter the source state');
  assertDeeplyFrozen(rows, 'ownedEquipment');
  assert(!Object.isFrozen(state) && !Object.isFrozen(state.ownedEquipment), 'freezing the projected inventory must not freeze the domain state');
  assert(JSON.stringify(rows) === JSON.stringify(inventory(buildGameViewModel(state))), 'inventory identities and readouts must be stable across projections');

  const hubEquipped = committed(state, commandFrom(row(view, 'bone_spear').equipAction));
  assert(hubEquipped.equipped.weapon === 'bone_spear', 'the inventory wear action must preserve ordinary hub equipping');
  const hubShop = buildGameViewModel(state, { hubPanel: 'equipment' }).sections[1].detail;
  assert(hubShop.kind === 'hub' && hubShop.shop, 'the equipment NPC catalog must remain available in the hub');
  const shopActions = [...hubShop.shop.rows.flatMap(item => item.actions), ...hubShop.shop.services];
  assert(shopActions.some(action => action.actionId.startsWith('hub.equipment.buy:')), 'hub commerce must retain equipment purchases with their existing unlock conditions');
  assert(shopActions.some(action => action.event?.kind === 'command' && action.event.command.type === 'hub/upgrade-equipment'), 'hub commerce must retain equipment upgrades outside the inventory');

  const explored = exploring(state);
  assert(row(buildGameViewModel(explored), 'spirit_robe').equipAction.enabled, 'exploration must permit wearing an owned backpack item');
  const combat = committed(explored, { type: 'run/select-node', nodeId: 'fog_lesser_demon' });
  const combatView = buildGameViewModel(combat);
  assert(inventory(combatView).length === state.ownedEquipment.length, 'combat must retain the complete equipment inventory');
  for (const item of inventory(combatView)) {
    assert(!item.equipAction.enabled && item.equipAction.disabledReason?.includes('战斗中不能更换装备') && !item.equipAction.event, 'combat wearing must be clearly blocked without emitting an event');
  }
  const result = committed(explored, { type: 'run/retreat' });
  for (const item of inventory(buildGameViewModel(result))) {
    assert(!item.equipAction.enabled && item.equipAction.disabledReason && !item.equipAction.event, 'result wearing must be disabled without an event');
  }
}

function verifyEliteEquipmentMetadataAndClaim(): void {
  const ownedRoll = hoodRoll(11, 2, 31);
  const offerRoll = hoodRoll(47, 5, 32);
  const hub = createInitialState();
  const entered = exploring({
    ...hub,
    ownedEquipment: [...hub.ownedEquipment, 'mist_hood'],
    equipmentLevels: { ...hub.equipmentLevels, mist_hood: 2 },
    equipmentRolls: { mist_hood: ownedRoll }
  });
  assert(entered.run, 'elite-loot fixture must have an active run');
  const state: GameState = {
    ...entered,
    run: {
      ...entered.run,
      pendingEquipmentOffer: {
        offerId: 'inventory-three-choice',
        equipmentIds: ['mist_hood', 'spirit_robe', 'bone_spear'],
        equipmentRolls: { mist_hood: offerRoll }
      }
    }
  };
  const before = JSON.stringify(state);
  const view = buildGameViewModel(state);
  const detail = view.sections[1].detail;
  assert(detail.kind === 'explore' && detail.pending?.kind === 'equipment-offer', 'elite loot must be an explicit pending equipment choice');
  const pending = detail.pending;
  const options = pending.equipmentOptions;
  assert(options?.length === 3 && pending.actionIds.length === 3, 'the pending choice must expose exactly three metadata cards and claim identities');
  assert(options.map(item => item.equipmentId).join(',') === 'mist_hood,spirit_robe,bone_spear', 'the three cards must keep the actual offer identities and order');
  const claimActions = view.sections[2].actions.filter(action => action.event?.kind === 'command' && action.event.command.type === 'node/resolve-equipment-loot');
  assert(claimActions.length === 3, 'the pending offer must expose exactly three claim commands');
  assert(!view.sections[2].actions.some(action => action.actionId === 'pending.equipment:skip' || /放弃.*装备|跳过.*装备/.test(action.label)), 'elite equipment must not expose an abandon or skip action');
  for (const option of options) {
    assertMetadata(option, option.equipmentId);
    assert(option.level === 1, 'offered equipment metadata must describe the new level-one candidate');
    const action = claimActions.find(candidate => candidate.actionId === option.actionId);
    assert(action && pending.actionIds.includes(option.actionId), `${option.equipmentId} must link to one actual claim action`);
    const command = commandFrom(action);
    assert(command.type === 'node/resolve-equipment-loot' && command.equipmentId === option.equipmentId, 'claim commands must name the card equipment and never omit an identity');
    assert(action.label === `领取${option.name}` && action.readout?.includes('永久拥有') && action.readout.includes('探索中可手动穿戴'), 'the claim action must explain immediate permanent ownership and manual exploration wearing');
  }
  assert(!/通关后|成功结算后|结算后生效/.test([pending.message, ...claimActions.map(action => action.readout)].join(' ')), 'equipment claims must not promise usability only after clearing or settlement');
  const offeredHood = options[0]!;
  const ownedHood = row(view, 'mist_hood');
  assert(offeredHood.slotLabel === '头部' && options[1]!.slotLabel === '护甲' && options[2]!.slotLabel === '武器', 'loot cards must use the actual equipment slot labels');
  assert(offeredHood.baseStatsReadout === '心神 +1 · 速度 +1 · 陷阱感知 +47', 'the offered hood must display the offer roll rather than the owned material');
  assert(offeredHood.rollReadout?.includes('炼狱第 5 层') && offeredHood.rollReadout.includes('强度 3047') && offeredHood.rollReadout.includes('陷阱感知 +47'), 'the offer roll readout must use the exact tier, power and affix');
  assert(ownedHood.baseStatsReadout.includes('陷阱感知 +11') && ownedHood.rollReadout?.includes('炼狱第 2 层'), 'the owned hood must independently retain its existing roll');
  assert(offeredHood.affixReadout.includes('陷阱感知 +2') && ownedHood.affixReadout.includes('陷阱感知 +3'), 'candidate fixed affixes use level one while owned fixed affixes use the current level');
  assert(options[1]!.baseStatsReadout === '生命上限 +18 · 防御 +3 · 术法 +2' && !options[1]!.rollReadout, 'an unrolled armor candidate must retain its actual catalog material without a roll');
  assert(options[2]!.baseStatsReadout === '攻击 +8 · 速度 +4' && options[2]!.affixReadout.includes('雾影疾刺'), 'the weapon candidate must expose its real material and named fixed affix');
  assertDeeplyFrozen(pending, 'pending equipment offer');
  assert(JSON.stringify(state) === before && !Object.isFrozen(offerRoll) && !Object.isFrozen(offerRoll.affixes), 'pending projection must preserve and avoid freezing the source offer roll');

  const claim = claimActions.find(action => action.actionId === options[1]!.actionId);
  assert(claim, 'armor card must have its claim action');
  const acquired = committed(state, commandFrom(claim));
  assert(acquired.ownedEquipment.includes('spirit_robe') && acquired.equipmentLevels.spirit_robe === 1, 'claiming must immediately grant a permanent level-one backpack item');
  assert(acquired.equipped.armor === state.equipped.armor, 'claiming equipment must leave manual wearing to the player');
  const acquiredView = buildGameViewModel(acquired);
  const acquiredDetail = acquiredView.sections[1].detail;
  assert(acquiredDetail.kind === 'explore' && !acquiredDetail.pending?.equipmentOptions, 'claiming must clear the equipment offer projection');
  const acquiredArmor = row(acquiredView, 'spirit_robe');
  assert(!acquiredArmor.equipped && acquiredArmor.status.includes('背包中') && acquiredArmor.equipAction.enabled, 'the claimed item must immediately project into the exploration inventory as wearable');
  const equipped = committed(acquired, commandFrom(acquiredArmor.equipAction));
  assert(equipped.equipped.armor === 'spirit_robe' && equipped.ownedEquipment.includes('patched_coat'), 'wearing a claimed item must replace the armor slot while retaining the old piece');
  const equippedView = buildGameViewModel(equipped);
  assert(row(equippedView, 'spirit_robe').equipped && !row(equippedView, 'spirit_robe').equipAction.enabled, 'the worn claimed item must refresh to an inactive worn state');
  const replaced = row(equippedView, 'patched_coat');
  assert(!replaced.equipped && replaced.status.includes('背包中') && replaced.equipAction.enabled, 'the replaced starting item must remain in the backpack and be wearable');
  const restored = committed(equipped, commandFrom(replaced.equipAction));
  assert(restored.equipped.armor === 'patched_coat' && restored.ownedEquipment.includes('spirit_robe'), 'wearing the replaced item again must preserve the claimed equipment permanently');
}

verifyOwnedEquipmentInventory();
verifyEliteEquipmentMetadataAndClaim();
