import { reduceGameCommand, type GameCommand } from '@infinite-flow/application';
import {
  DUNGEON_ORDER, EQUIPMENT, createInitialState, getGameAsset,
  type GameState, type ItemId, type GameAssetKind
} from '@infinite-flow/core';
import { MAIN_GOD_TASKS } from '@infinite-flow/core/task-system';
import {
  buildGameViewModel, type HubCatalogPanel, type HubShopCatalogViewModel,
  type PresentationLocalUiState, type ViewActionModel
} from '../src/index.js';

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function catalog(state: GameState, panel: HubCatalogPanel, local: PresentationLocalUiState = {}): HubShopCatalogViewModel {
  const detail = buildGameViewModel(state, { ...local, hubPanel: panel }).sections[1].detail;
  assert(detail.kind === 'hub' && detail.shop, `${panel} must have an NPC catalogue`);
  return detail.shop;
}

function action(shop: HubShopCatalogViewModel, prefix: string): ViewActionModel {
  const found = [...shop.rows.flatMap(row => row.actions), ...shop.services]
    .find(candidate => candidate.actionId.startsWith(`${prefix}::`));
  assert(found, `missing shop action ${prefix}`);
  return found;
}

function perform(state: GameState, selected: ViewActionModel, expectedType: GameCommand['type']): GameState {
  assert(selected.enabled && selected.event?.kind === 'command', `${selected.actionId} must be executable`);
  assert(selected.event.command.type === expectedType, `${selected.actionId} must preserve the domain command`);
  const result = reduceGameCommand(state, selected.event.command);
  assert(result.status === 'committed', `${selected.actionId} must commit`);
  return result.state;
}

function richState(): GameState {
  const state = createInitialState();
  state.rewardPoints = 50_000;
  state.lingyun = 100;
  for (const id of Object.keys(state.inventory) as ItemId[]) state.inventory[id] = 50;
  state.completedDungeonIds = [...DUNGEON_ORDER];
  return state;
}

export function verifyHubShops(): void {
  const initial = createInitialState();
  const original = JSON.stringify(initial);
  const counts: Record<HubCatalogPanel, number> = {
    equipment: 65, supplies: 9, pets: 6, methods: 7, bloodlines: 4, companions: 3, tasks: MAIN_GOD_TASKS.length
  };
  const actionIds = new Set<string>();
  for (const panel of Object.keys(counts) as HubCatalogPanel[]) {
    const shop = catalog(initial, panel);
    assert(shop.rows.length === counts[panel], `${panel} must expose the complete catalogue, including locked entries`);
    assert(new Set(shop.rows.map(row => row.id)).size === shop.rows.length, `${panel} row identities must be unique`);
    for (const row of shop.rows) {
      assert(row.description && row.status && row.details.length, `${panel}/${row.id} needs readable details`);
      if (panel !== 'tasks') {
        assert(row.visualAssetKey, `${panel}/${row.id} needs a real inventory image`);
        assert(row.rarity, `${panel}/${row.id} needs its approved display quality`);
      }
      if (row.visualAssetKey) {
        const [kind, assetId] = row.visualAssetKey.split(':') as [GameAssetKind, string];
        assert(getGameAsset(kind, assetId)?.key === row.visualAssetKey, 'shop icons must use verified asset keys');
      }
    }
    for (const candidate of [...shop.rows.flatMap(row => row.actions), ...shop.services]) {
      assert(!actionIds.has(candidate.actionId), `duplicate shop action ${candidate.actionId}`);
      actionIds.add(candidate.actionId);
      assert(candidate.readout, `${candidate.actionId} needs a description for a targeted condition popup`);
      // Merchants only sell and train; choosing who goes along lives on the character sheet.
      assert(!/\.select:|\.navigate:|\.equip:|\.activate:|\.toggle:(?!.*equipment)|\.memory\./.test(candidate.actionId), `shop must omit navigation and loadout actions: ${candidate.actionId}`);
      if (candidate.enabled) {
        assert(candidate.event, 'enabled action must have an event');
        if (candidate.event.kind === 'command') {
          assert(!/equip-equipment|activate-|configure-tactical-loadout|use-item|memory/.test(candidate.event.command.type), 'shop commands must not change loadout');
        }
      } else {
        assert(candidate.disabledReason && !candidate.event, 'blocked shop action must explain why and emit no event');
      }
    }
  }
  assert(JSON.stringify(initial) === original, 'catalogue projection must not mutate player progress');

  // Each merchant has its own list: layout, grouping and a short listing per entry.
  const layouts: Partial<Record<HubCatalogPanel, HubShopCatalogViewModel['layout']>> = {
    supplies: 'rows', equipment: 'rows', methods: 'rows', pets: 'cards', bloodlines: 'cards', companions: 'wide-cards'
  };
  for (const [panel, layout] of Object.entries(layouts) as [HubCatalogPanel, HubShopCatalogViewModel['layout']][]) {
    const shop = catalog(richState(), panel);
    assert(shop.layout === layout, `${panel} must use the ${layout} layout`);
    const grouped = shop.groups?.flatMap(group => group.rowIds) ?? shop.rows.map(row => row.id);
    assert(grouped.length === shop.rows.length && new Set(grouped).size === shop.rows.length, `${panel} groups must list every entry once`);
    for (const row of shop.rows) {
      assert(row.listing && row.listing.lines.length > 0, `${panel}/${row.id} needs a list summary`);
      const inline = row.actions.find(candidate => candidate.actionId === row.listing!.primaryActionId);
      assert(row.listing.primaryActionId === undefined || inline, `${panel}/${row.id} inline action must be one of its own actions`);
      assert(!row.listing.price?.includes('、'), `${panel}/${row.id} inline price must stay short`);
    }
  }
  const equipmentShop = catalog(richState(), 'equipment');
  // The quartermaster melts spare chapter materials as a service; equipment rows never carry it.
  const reforges = equipmentShop.services.filter(service => service.actionId.startsWith('hub.equipment.reforge:'));
  assert(reforges.length === 2 && reforges.every(service => service.enabled && service.event?.kind === 'command'
    && service.event.command.type === 'hub/reforge-material'), 'one executable reforge per result, not one pair per material');
  const plenty = richState();
  plenty.inventory.entropy_crystal = 80;
  assert(catalog(plenty, 'equipment').services.filter(service => service.actionId.startsWith('hub.equipment.reforge:'))
    .every(service => service.actionId.startsWith('hub.equipment.reforge:entropy_crystal:')), 'the reforge melts the material held the most of');
  assert(!reforges.some(service => service.actionId.startsWith('hub.equipment.reforge:cracked_core:')), 'cracked cores are never melted');
  assert(!equipmentShop.rows.some(row => row.actions.some(action => action.actionId.includes('reforge'))), 'equipment rows carry no reforge');
  const bare = catalog(createInitialState(), 'equipment').services.filter(service => service.actionId.startsWith('hub.equipment.reforge'));
  assert(bare.length === 1 && !bare[0]!.enabled && bare[0]!.disabledReason?.includes('5'), 'without a batch the service explains what it needs');
  assert(equipmentShop.groupStyle === 'tabs' && equipmentShop.groups?.length === 7, 'the quartermaster groups goods by equipment slot');
  const suppliesShop = catalog(richState(), 'supplies');
  assert(suppliesShop.groupStyle === 'sections' && suppliesShop.groups?.map(group => group.title).join('/') === '补给品/携行道具',
    'the supplier separates field supplies from carried items');
  const entry = buildGameViewModel(initial, { hubPanel: 'entry' }).sections[1].detail;
  assert(entry.kind === 'hub' && !entry.shop, 'entry must not eagerly build a shop');

  const initialTasks = catalog(initial, 'tasks');
  assert(initialTasks.rows.some(row => row.status === '未解锁'), 'locked tasks must remain inspectable');
  const lockedCompanion = action(catalog(initial, 'companions'), 'hub.companions.recruit:qin_che');
  assert(!lockedCompanion.enabled && lockedCompanion.disabledReason?.includes('首次通关'), 'locked recruitment must explain the chapter requirement');
  const poor = createInitialState();
  poor.rewardPoints = 0;
  const blockedPurchase = action(catalog(poor, 'supplies'), 'hub.supplies.buy:healing_pill');
  assert(!blockedPurchase.enabled && blockedPurchase.disabledReason?.includes('奖励点'), 'unaffordable purchase must retain its resource reason');

  let state = richState();
  const beforeItem = state.inventory.healing_pill;
  state = perform(state, action(catalog(state, 'supplies'), 'hub.supplies.buy:healing_pill'), 'hub/buy-item');
  assert(state.inventory.healing_pill === beforeItem + 1, 'row purchase must increase the matching inventory');

  const originalWeapon = state.equipped.weapon;
  state = perform(state, action(catalog(state, 'equipment'), 'hub.equipment.buy:armor_piercing_sword'), 'hub/buy-equipment');
  assert(state.ownedEquipment.includes('armor_piercing_sword') && state.equipped.weapon === originalWeapon, 'equipment purchase must leave wearing to player configuration');
  state = perform(state, action(catalog(state, 'equipment'), 'hub.equipment.upgrade:armor_piercing_sword'), 'hub/upgrade-equipment');
  assert(state.equipmentLevels.armor_piercing_sword === 2, 'equipment row upgrade must target the selected item');

  state = perform(state, action(catalog(state, 'pets'), 'hub.pets.buy:contract_sprite'), 'hub/buy-pet');
  state = perform(state, action(catalog(state, 'pets'), 'hub.pets.upgrade:contract_sprite'), 'hub/upgrade-pet');
  assert(state.petLevels.contract_sprite === 2, 'pet training must apply');
  const ownedPets = catalog(state, 'pets');
  assert(!ownedPets.rows.find(row => row.id === 'contract_sprite')!.actions.some(candidate => candidate.actionId.startsWith('hub.pets.buy:')),
    'an owned pet offers no second contract');
  assert(ownedPets.rows.find(row => row.id === 'contract_sprite')!.details.find(fact => fact.label === '特性')?.value.startsWith('战斗协助'),
    'the pet trait names its real effect instead of repeating the description');
  assert(ownedPets.rows.find(row => row.id === 'contract_sprite')!.details.find(fact => fact.label === '战斗辅助')?.value === '2 级 助攻：你的直接命中伤害 +9%',
    'the pet card shows its support at the current level');
  state = { ...state, ownedPets: [...state.ownedPets, 'mist_kitten'], petLevels: { ...state.petLevels, mist_kitten: 1 } };
  assert(ownedPets.rows.find(row => row.id === 'contract_sprite')!.details.find(fact => fact.label === '生效方式')?.value.includes('「角色 → 灵宠」'),
    'the pet keeper points to where the pet is sent along');
  state = perform(state, action(catalog(state, 'methods'), 'hub.methods.learn:mist_breathing'), 'hub/learn-method');
  state = perform(state, action(catalog(state, 'methods'), 'hub.methods.upgrade:mist_breathing'), 'hub/upgrade-method');
  assert(state.methodRanks.mist_breathing === 2, 'method cultivation must apply');
  state = perform(state, action(catalog(state, 'bloodlines'), 'hub.bloodlines.unlock:titan_marrow'), 'hub/unlock-bloodline');
  state = perform(state, action(catalog(state, 'bloodlines'), 'hub.bloodlines.upgrade:titan_marrow'), 'hub/upgrade-bloodline');
  assert(state.bloodlineRanks.titan_marrow === 2, 'bloodline ascension must apply');
  state = perform(state, action(catalog(state, 'companions'), 'hub.companions.recruit:qin_che'), 'hub/recruit-companion');
  state = perform(state, action(catalog(state, 'companions'), 'hub.companions.upgrade:qin_che'), 'hub/upgrade-companion');
  assert(state.companionRanks.qin_che === 2, 'companion training must apply');

  const tasks = catalog(state, 'tasks');
  assert(tasks.rows[0]?.status === '可领取', 'claimable tasks must appear before active and locked tasks');
  const taskId = tasks.rows[0]!.id;
  state = perform(state, action(tasks, `hub.tasks.claim:${taskId}`), 'hub/claim-task');
  assert(state.claimedTaskIds.includes(taskId), 'task row claim must persist the matching task');
  assert(!action(catalog(state, 'tasks'), `hub.tasks.claim:${taskId}`).enabled, 'claimed reward must not be executable again');

  const commissionState = richState();
  commissionState.ownedEquipment.push('bone_spear', 'mist_hood');
  commissionState.equipmentLevels.bone_spear = EQUIPMENT.bone_spear.maxLevel;
  commissionState.equipmentLevels.mist_hood = EQUIPMENT.mist_hood.maxLevel;
  let local: PresentationLocalUiState = {};
  for (const id of ['bone_spear', 'mist_hood']) {
    const select = action(catalog(commissionState, 'equipment', local), `hub.equipment.commission.toggle:${id}`);
    assert(select.enabled && select.event?.kind === 'local' && select.event.action.type === 'hub/set-equipment-commission-draft', 'row must select its exact commission equipment');
    local = { equipmentCommissionDraft: select.event.action.draft };
  }
  const commission = catalog(commissionState, 'equipment', local);
  const materials = commission.services.filter(service => service.actionId.startsWith('hub.equipment.commission.material:'));
  assert(materials.length === 2, 'each eligible target material must be a direct service button');
  assert(!commission.services.some(service => service.actionId === 'hub.equipment.commission.material'), 'services must not cycle material options');
  const material = materials[1]!;
  assert(material.enabled && material.event?.kind === 'local' && material.event.action.type === 'hub/set-equipment-commission-draft', 'material button must set the exact draft target');
  local = { equipmentCommissionDraft: material.event.action.draft };
  const commissioned = perform(commissionState, action(catalog(commissionState, 'equipment', local), 'hub.equipment.commission.start'), 'hub/start-equipment-commission');
  const recall = action(catalog(commissioned, 'equipment'), 'hub.equipment.commission.recall');
  assert(recall.enabled && recall.emphasis === 'danger' && recall.riskReason, 'recall must keep its explicit loss warning for confirmation');
}
