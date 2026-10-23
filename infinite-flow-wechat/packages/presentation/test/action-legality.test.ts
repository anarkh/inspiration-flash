import { reduceGameCommand, type GameCommand } from '@infinite-flow/application';
import {
  DUNGEON_ORDER,
  DUNGEONS,
  createInitialState,
  getCampaignGates,
  type GameState
} from '@infinite-flow/core';
import { isFieldSupplyItemId, isTacticalItemId } from '@infinite-flow/core/tactical-loadout';
import { buildGameViewModel } from '../src/index.js';
import type { PresentationLocalUiState, ViewActionModel } from '../src/index.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function committed(state: GameState, command: GameCommand): GameState {
  const result = reduceGameCommand(state, command);
  assert(result.status === 'committed', `${command.type}: fixture must commit`);
  return result.state;
}

function enter(state: GameState, dungeonId: keyof typeof DUNGEONS): GameState {
  return committed(state, {
    type: 'run/enter', dungeonId, protocolId: 'standard',
    seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1357_9bdf }
  });
}

function atNode(state: GameState, nodeId: string): GameState {
  return { ...state, run: { ...state.run!, currentNodeId: nodeId, discoveredNodeIds: [...(state.run!.discoveredNodeIds ?? []), nodeId] } };
}

function collectActions(model: unknown): ViewActionModel[] {
  const found = new Set<ViewActionModel>();
  const seen = new Set<unknown>();
  const walk = (value: unknown): void => {
    if (value === null || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    const candidate = value as Partial<ViewActionModel>;
    if (typeof candidate.actionId === 'string' && typeof candidate.enabled === 'boolean') {
      found.add(value as ViewActionModel);
    }
    for (const entry of Object.values(value)) walk(entry);
  };
  walk(model);
  return [...found];
}

function actionById(state: GameState, actionId: string): ViewActionModel | undefined {
  return collectActions(buildGameViewModel(state, {})).find(action => action.actionId === actionId);
}

// A portal whose target chapter is still locked behind the main quest cannot be
// offered as an executable force/stabilize choice; core rejects both.
{
  const portalState = atNode(enter(createInitialState(), 'demon_tower_1'), 'cracked_portal');
  const target = DUNGEONS.demon_tower_1.nodes.find(node => node.id === 'cracked_portal')?.portal?.targetDungeonId;
  assert(getCampaignGates(portalState).find(gate => gate.dungeonId === target)?.status === 'locked',
    'fixture portal targets a mainline-locked chapter');
  assert(reduceGameCommand(portalState, { type: 'node/use-portal', choice: 'force' }).status === 'rejected',
    'core rejects forcing a mainline-locked portal');
  for (const choice of ['force', 'stabilize'] as const) {
    const action = actionById(portalState, `node.portal:cracked_portal:${choice}`);
    assert(action && !action.enabled, `${choice}: locked portal action is disabled`);
    assert(action.disabledReason?.includes('主线'), `${choice}: disabled reason names the mainline gate`);
  }
}

// Ordinary collection settles a field-survey reward node. The survey is no
// longer a pending decision and its ordinary-claim button must disappear.
{
  const surveyState = atNode(enter(createInitialState(), 'demon_tower_1'), 'demon_bone_cache');
  assert(actionById(surveyState, 'pending.field-survey:ordinary')?.enabled,
    'fixture offers ordinary collection for an unresolved survey');
  const claimed = committed(surveyState, { type: 'node/collect-reward' });
  const detail = buildGameViewModel(claimed, {}).sections[1].detail;
  assert(detail.kind === 'explore', 'claimed survey stays in exploration');
  assert(detail.pending?.kind !== 'field-survey', 'settled survey is no longer pending');
  assert(actionById(claimed, 'pending.field-survey:ordinary') === undefined,
    'settled survey does not keep a rejected ordinary-claim button');
}

// A carried-only tool in the bag but outside this run's tactical loadout can
// be neither used to counter a trap nor offered as an enabled counter.
{
  const unlocked: GameState = { ...createInitialState(), completedDungeonIds: [...DUNGEON_ORDER] };
  let checked = 0;
  for (const dungeonId of DUNGEON_ORDER) {
    const trap = DUNGEONS[dungeonId].nodes.find(node => {
      const item = node.trap?.counterItem;
      return item !== undefined && isTacticalItemId(item) && !isFieldSupplyItemId(item);
    });
    const item = trap?.trap?.counterItem;
    if (!trap || !item || !isTacticalItemId(item)) continue;
    const entered = atNode(enter(unlocked, dungeonId), trap.id);
    const stocked: GameState = {
      ...entered,
      inventory: { ...entered.inventory, [item]: 1 },
      run: {
        ...entered.run!,
        tacticalLoadout: { rulesVersion: 1, itemIds: [] },
        lootBag: { ...entered.run!.lootBag, items: { ...entered.run!.lootBag.items, [item]: 0 } }
      }
    };
    const actionId = `node.trap:${trap.id}:counter`;
    assert(reduceGameCommand(stocked, { type: 'node/handle-trap', choice: 'counter' }).status === 'rejected',
      `${dungeonId}: core rejects an uncarried counter item`);
    const uncarried = actionById(stocked, actionId);
    assert(uncarried && !uncarried.enabled && uncarried.disabledReason?.includes('携行'),
      `${dungeonId}: uncarried counter item is disabled with a carry reason`);
    const carried: GameState = { ...stocked, run: { ...stocked.run!, tacticalLoadout: { rulesVersion: 1, itemIds: [item] } } };
    assert(actionById(carried, actionId)?.enabled, `${dungeonId}: carried counter item is enabled`);
    assert(reduceGameCommand(carried, { type: 'node/handle-trap', choice: 'counter' }).status === 'committed',
      `${dungeonId}: enabled counter item commits`);
    checked += 1;
    break;
  }
  assert(checked === 1, 'at least one chapter has a carried-only trap counter');
}

// Deterministic playthrough over the real projected actions: every enabled
// domain command the UI offers must commit in the application reducer.
{
  let seed = 0x2468_ace1;
  const random = (): number => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return (seed >>> 0) / 0x1_0000_0000;
  };
  let steps = 0;
  let commands = 0;
  for (let episode = 0; episode < 6; episode += 1) {
    let state = createInitialState();
    let ui: PresentationLocalUiState = {};
    for (let step = 0; step < 250; step += 1) {
      const model = buildGameViewModel(state, ui);
      const enabled = collectActions(model).filter(action => action.enabled && action.event !== undefined
        && !(action.event.kind === 'command' && action.event.command.type === 'game/new')
        && !(action.event.kind === 'local' && action.event.action.type.startsWith('help/')));
      if (enabled.length === 0) break;
      const executable = enabled.filter(action => action.event?.kind === 'command'
        || action.event?.action.type === 'entry/request-enter');
      const pool = executable.length > 0 && random() < 0.85 ? executable : enabled;
      const weights = pool.map(action =>
        action.event?.kind === 'command' && action.event.command.type === 'run/retreat' ? 0.02 : 1);
      let roll = random() * weights.reduce((sum, weight) => sum + weight, 0);
      const action = pool.find((_, index) => (roll -= weights[index]!) <= 0) ?? pool[pool.length - 1]!;
      const event = action.event!;
      steps += 1;
      let command: GameCommand | undefined;
      if (event.kind === 'command') command = event.command;
      else if (event.action.type === 'entry/request-enter') {
        const draft = event.action.draft;
        command = {
          type: 'run/enter', dungeonId: draft.dungeonId, protocolId: draft.protocolId,
          ...(draft.routeContractId === undefined ? {} : { routeContractId: draft.routeContractId }),
          ...(draft.protocolId === 'deep' ? { infernoTier: draft.infernoTier ?? 1 } : {}),
          seeds: {
            rulesVersion: 1, hiddenTaskSeed: 1 + Math.floor(random() * 0xffff_fffe),
            ...(draft.protocolId === 'deep' ? { infernoMapSeed: 1 + Math.floor(random() * 0xffff_fffe) } : {})
          }
        };
      } else if (event.action.type === 'hub/select-panel') ui = { ...ui, hubPanel: event.action.panel };
      else if (event.action.type === 'hub/select-catalog-entry') {
        ui = { ...ui, hubSelections: { ...ui.hubSelections, [event.action.panel]: event.action.entityId } };
      } else if (event.action.type === 'combat/set-advanced-expanded') {
        ui = { ...ui, advancedCombatExpanded: event.action.expanded };
      }
      if (command === undefined) continue;
      const result = reduceGameCommand(state, command);
      assert(result.status === 'committed',
        `enabled ${action.actionId} (${command.type}) must commit; rejected: ${result.status === 'rejected' ? result.reason.message : ''}`);
      state = result.state;
      commands += 1;
    }
  }
  assert(commands > 600, `legality playthrough exercises real commands (${commands}/${steps})`);
}
