import { reduceGameCommand, type GameCommand } from '@infinite-flow/application';
import { createInitialState, type GameState } from '@infinite-flow/core';
import {
  RUN_RELIC_DEFINITIONS,
  RUN_RELIC_FRAME_DEFINITIONS,
  generateRunRelicDraft,
} from '@infinite-flow/core/run-relics';
import { buildGameViewModel } from '../src/index.js';

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function commit(state: GameState, command: GameCommand): GameState {
  const result = reduceGameCommand(state, command);
  if (result.status === 'rejected') throw new Error(`${command.type}: ${result.reason.message}`);
  return result.state;
}

function verifyRunRelicLoadout(): void {
  const hub: GameState = {
    ...createInitialState(),
    archivedRelicIds: ['mist_edge'],
    preparedRelicFrame: 'assault',
    preparedRelicSeedId: 'mist_edge',
  };
  assert(buildGameViewModel(hub).sections[1].loadout!.runRelics.length === 0, 'archived seeds are not current acquired relics in the hub');

  const entered = commit(hub, {
    type: 'run/enter',
    dungeonId: 'demon_tower_1',
    protocolId: 'standard',
    seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_abcd },
  });
  assert(entered.run?.relicState, 'entering a dungeon creates relic state');
  assert(entered.run.relicState.seedRelicId === 'mist_edge', 'the archive seed is carried into the next run');
  assert(buildGameViewModel(entered).sections[1].loadout!.runRelics.length === 0, 'a new run must not show its seed as already acquired');

  const pending: GameState = {
    ...entered,
    run: {
      ...entered.run,
      relicState: generateRunRelicDraft(entered.run.relicState, {
        draftId: 'loadout-first-draft',
        nodeId: entered.run.currentNodeId,
      }),
    },
  };
  assert(pending.run?.relicState?.pendingDraft?.candidateIds.includes('mist_edge'), 'the archived seed must appear in the first draft');
  const pendingView = buildGameViewModel(pending);
  const beforeSelection = pendingView.sections[1].loadout!;
  assert(beforeSelection.runRelics.length === 0, 'pending draft candidates must not appear among acquired relics');
  const select = pendingView.sections[2].actions.find((action) => action.actionId === 'pending.relic:loadout-first-draft:mist_edge');
  assert(select?.enabled && select.event?.kind === 'command', 'the visible mist edge choice emits a selectable command');
  const selected = commit(pending, select.event.command);
  const sourceBefore = JSON.stringify(selected);
  const selectedView = buildGameViewModel(selected);
  const selectedLoadout = selectedView.sections[1].loadout!;
  const relic = selectedLoadout.runRelics[0];
  assert(selectedLoadout.runRelics.length === 1 && relic?.relicId === 'mist_edge', 'the selected relic appears immediately in exploration');
  assert(relic.name === RUN_RELIC_DEFINITIONS.mist_edge.name, 'the list uses the core relic name');
  assert(relic.description === RUN_RELIC_DEFINITIONS.mist_edge.description, 'the list uses the core effect description');
  assert(relic.frameName === RUN_RELIC_FRAME_DEFINITIONS.assault.name, 'the list uses the core frame name');
  assert(selectedLoadout.attack === beforeSelection.attack + 6, 'mist edge displayed attack bonus agrees with immediately derived stats');
  assert(selectedLoadout.artPower === beforeSelection.artPower + 4, 'mist edge displayed art power bonus agrees with immediately derived stats');
  assert(JSON.stringify(selected) === sourceBefore, 'relic projection must not change the source state');
  assert(Object.isFrozen(selectedLoadout.runRelics) && Object.isFrozen(relic), 'the acquired relic list and entries must be deeply frozen');
  assert(!Object.isFrozen(selected.run!.relicState), 'snapshot freezing must not freeze source state');
  assert(beforeSelection.runRelics.length === 0, 'a prior snapshot stays detached after a selection');

  const enterCombat = selectedView.sections[2].actions.find((action) => action.actionId === `node.select:${selected.run!.currentNodeId}`);
  assert(enterCombat?.enabled && enterCombat.event?.kind === 'command', 'the current node exposes the combat entry command');
  const combat = commit(selected, enterCombat.event.command);
  assert(combat.phase === 'combat', 'the first node starts combat');
  const combatLoadout = buildGameViewModel(combat).sections[1].loadout!;
  assert(JSON.stringify(combatLoadout.runRelics) === JSON.stringify(selectedLoadout.runRelics), 'combat keeps the same acquired relic list');

  const result = commit(combat, { type: 'run/retreat' });
  assert(result.phase === 'result' && result.run?.relicState?.acquiredIds.includes('mist_edge'), 'settlement retains acquired relic evidence in the run');
  assert(buildGameViewModel(result).sections[1].loadout!.runRelics.length === 0, 'settled relics must not be presented as active in the result');
  const returned = commit(result, { type: 'result/return-hub' });
  assert(returned.phase === 'hub' && !returned.run, 'returning clears the active run');
  assert(buildGameViewModel(returned).sections[1].loadout!.runRelics.length === 0, 'returning to hub leaves no relics from the completed run');
}

verifyRunRelicLoadout();
