import { DUNGEON_ORDER, createInitialState, getCampaignGates, listRouteContracts, type GameState } from '@infinite-flow/core';
import { buildGameViewModel, type GameViewModel, type HubEntryServiceViewModel } from '../src/index.js';

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function services(model: GameViewModel): readonly HubEntryServiceViewModel[] {
  const detail = model.sections[1].detail;
  assert(detail.kind === 'hub' && detail.entryServices, 'entry services must be projected for the portal');
  return detail.entryServices;
}

function service(model: GameViewModel, id: string): HubEntryServiceViewModel {
  const result = services(model).find((candidate) => candidate.id === id);
  assert(result, `entry service ${id} must exist`);
  return result;
}

const initial = createInitialState();
const stateBefore = JSON.stringify(initial);
const initialModel = buildGameViewModel(initial, {});
assert(services(initialModel).map(({ id }) => id).join(',') === 'dungeon,protocol,route-contract,relic-frame,relic-seed',
  'standard entry groups every service once and excludes inferno tier');
const dungeonOptions = service(initialModel, 'dungeon').options;
assert(dungeonOptions.map(({ id }) => id).join(',') === DUNGEON_ORDER.join(','), 'all nineteen chapters retain campaign order');
for (const gate of getCampaignGates(initial)) {
  const option = dungeonOptions.find(({ id }) => id === gate.dungeonId)!;
  assert(option.name === gate.dungeonName && option.description.includes(gate.requirementText), 'each chapter retains its real name and gate explanation');
  if (option.selected) assert(!option.action.enabled && !option.action.event, 'selected chapter has no duplicate selection event');
  else assert(option.action.event?.kind === 'local'
    && option.action.event.action.type === 'entry/select-dungeon'
    && option.action.event.action.dungeonId === gate.dungeonId, 'even a locked chapter can be selected for inspection');
}
const lockedGate = getCampaignGates(initial).find(({ status }) => status === 'locked')!;
const lockedModel = buildGameViewModel(initial, { entryDraft: { dungeonId: lockedGate.dungeonId, protocolId: 'standard' } });
const lockedConfirm = lockedModel.sections[2].actions.find(({ actionId }) => actionId === 'hub.entry.confirm')!;
assert(!lockedConfirm.enabled && !lockedConfirm.event && lockedConfirm.disabledReason === lockedGate.requirementText,
  'browsing a locked chapter must still disable entry with its original gate reason');
assert(service(lockedModel, 'dungeon').summary.includes('未解锁'), 'the selected locked chapter is explicit in the collapsed row');

for (const option of service(initialModel, 'protocol').options) {
  const original = initialModel.sections[2].actions.find(({ actionId }) => actionId === option.action.actionId);
  assert(JSON.stringify(option.action) === JSON.stringify(original), 'protocol selection preserves the original enabled status and event');
  assert(!/宿主|持久化|seed/.test(option.description), 'protocol explanations use player-facing language');
}
assert(service(initialModel, 'route-contract').options.length === 4, 'no contract and all three locked contract choices remain inspectable');
assert(service(initialModel, 'route-contract').options.slice(1).every(({ action }) => !action.enabled && action.disabledReason?.includes('首次通关')),
  'route options retain the first-clear gate');

const prepared: GameState = {
  ...initial,
  completedDungeonIds: [...DUNGEON_ORDER],
  infernoProgress: { demon_tower_1: 3 },
  archivedRelicIds: ['mist_edge', 'focus_prism', 'bone_shell'],
  preparedRelicFrame: 'assault',
  preparedRelicSeedId: 'focus_prism'
};
const preparedModel = buildGameViewModel(prepared, {});
const routeOptions = service(preparedModel, 'route-contract').options;
for (const contract of listRouteContracts('demon_tower_1')) {
  const option = routeOptions.find(({ id }) => id === contract.id)!;
  assert(option.action.event?.kind === 'local' && option.action.event.action.type === 'entry/select-route-contract'
    && option.action.event.action.routeContractId === contract.id, 'every contract is directly selectable with its precise original event schema');
  assert(option.description.includes('目标 1') && option.description.includes('目标 2') && option.description.includes(`${contract.rewardPoints} 奖励点`),
    'contract choices expose ordered targets and their independent reward');
}
const wrongModel = buildGameViewModel(prepared, {
  entryDraft: { dungeonId: 'demon_tower_1', protocolId: 'standard', routeContractId: listRouteContracts('metro_abyss')[0]!.id }
});
const repair = service(wrongModel, 'route-contract').options[0]!.action;
assert(repair.event?.kind === 'local' && repair.event.action.type === 'entry/select-route-contract' && repair.event.action.routeContractId === null,
  'invalid cross-chapter contract still has an explicit null repair selection');

const seeds = service(preparedModel, 'relic-seed').options;
assert(seeds.map(({ id }) => id).join(',') === 'none,mist_edge,focus_prism', 'seed choices include only current-frame archived relics');
const clearSeed = seeds[0]!.action;
assert(clearSeed.event?.kind === 'local' && clearSeed.event.action.type === 'entry/select-relic-seed'
  && clearSeed.event.action.seedRelicId === null && clearSeed.event.action.frame === 'assault', 'clear seed preserves frame and the JSON null contract');
assert(!seeds[2]!.action.enabled && seeds[2]!.selected, 'selected seed is shown without a duplicate command');
const frames = service(preparedModel, 'relic-frame').options;
assert(frames.length === 3 && frames.find(({ id }) => id === 'assault')!.selected, 'all three relic directions include the active direction');
for (const option of frames.filter(({ selected }) => !selected)) {
  assert(option.action.event?.kind === 'command' && option.action.event.command.type === 'hub/configure-relic'
    && option.action.event.command.frame === option.id && !('seedRelicId' in option.action.event.command),
    'changing relic direction uses the original command and clears incompatible seed configuration');
}

const deepModel = buildGameViewModel(prepared, { entryDraft: { dungeonId: 'demon_tower_1', protocolId: 'deep', infernoTier: 2 } });
const tier = service(deepModel, 'inferno-tier');
assert(services(deepModel).length === 6 && tier.options.length === 2, 'inferno adds a bounded two-direction layer service');
assert(tier.options[0]!.description.includes('第 1 层') && tier.options[1]!.description.includes('第 3 层'), 'layer options state their exact destination');
const topModel = buildGameViewModel(prepared, { entryDraft: { dungeonId: 'demon_tower_1', protocolId: 'deep', infernoTier: 3 } });
assert(!service(topModel, 'inferno-tier').options[1]!.action.enabled, 'the unlocked maximum still disables further ascent');
assert(deepModel.sections[2].actions.length < 20, 'expanded service choices do not enlarge the existing compact action API');

for (const model of [initialModel, lockedModel, preparedModel, wrongModel, deepModel, topModel]) {
  const ids = new Set<string>();
  for (const group of services(model)) {
    for (const { action } of group.options) {
      assert(!ids.has(action.actionId), 'service actions have unique IDs');
      ids.add(action.actionId);
      assert(action.enabled ? Boolean(action.event) : !action.event && Boolean(action.disabledReason), 'every service action obeys the enabled/event contract');
      assert(action.event?.kind !== 'local' || action.event.action.type !== 'entry/request-enter', 'entry confirmation never appears inside the service options');
    }
  }
  assert(Object.isFrozen(services(model)) && Object.isFrozen(services(model)[0]!.options[0]!.action), 'new projections remain deeply frozen');
  assert(!JSON.stringify(services(model)).includes('undefined'), 'expanded services remain valid JSON player data');
}
const shop = buildGameViewModel(initial, { hubPanel: 'equipment' }).sections[1].detail;
assert(shop.kind === 'hub' && shop.entryServices === undefined, 'other NPCs do not eagerly project entry services');
assert(JSON.stringify(initial) === stateBefore, 'building entry services never mutates player progress');
